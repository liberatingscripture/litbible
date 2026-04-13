#!/usr/bin/env node
/**
 * draft-release-notes.mjs
 *
 * Analyzes git content changes and drafts a release notes entry.
 * Detects: new/modified chapters, intros, glossary, and articles.
 * For modified chapters, identifies whether paragraphs or footnotes changed
 * and extracts the affected verse numbers.
 *
 * Usage:
 *   node scripts/draft-release-notes.mjs --since <git-ref>
 *   node scripts/draft-release-notes.mjs --since HEAD~5
 *   node scripts/draft-release-notes.mjs --since v1.0.0
 *
 * Flags:
 *   --since <ref>   Required. Git ref to compare against (tag, commit, branch).
 *   --write         Prepend the draft entry to src/data/release-notes.json.
 */

import { execSync } from "child_process";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { resolve, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(__dirname, "..");

// ── Parse args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const sinceIdx = args.indexOf("--since");
const writeFlag = args.includes("--write");

if (sinceIdx === -1 || !args[sinceIdx + 1]) {
  console.error(
    "Usage: node scripts/draft-release-notes.mjs --since <git-ref> [--write]"
  );
  process.exit(1);
}

const baseRef = args[sinceIdx + 1];

try {
  execSync(`git rev-parse "${baseRef}"`, { cwd: root, stdio: "pipe" });
} catch {
  console.error(`Error: git ref "${baseRef}" not found.`);
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns files changed between baseRef and HEAD with the given diff-filter. */
function gitChanged(diffFilter) {
  return execSync(
    `git diff --name-only --diff-filter=${diffFilter} "${baseRef}" HEAD`,
    { cwd: root }
  )
    .toString()
    .trim()
    .split("\n")
    .filter(Boolean);
}


/** Extract all verse numbers found in an HTML string. */
function extractVerses(html) {
  return [...(html ?? "").matchAll(/id="v(\d+)"/g)].map((m) =>
    parseInt(m[1], 10)
  );
}

/** Describe a sorted list of verse numbers as a compact range string.
 *  e.g. [1,2,3,5,6] → "1–3, 5–6" */
function formatVerseRange(verses) {
  if (!verses.length) return "";
  const sorted = [...new Set(verses)].sort((a, b) => a - b);
  const ranges = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}–${end}`);
      start = end = sorted[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}–${end}`);
  return ranges.join(", ");
}

// ── Load canonical book order ─────────────────────────────────────────────────

const { BOOKS, BOOK_ORDER, bookKeyToLabel } = await import("../src/data/books.js");

// ── Categorise changed files ──────────────────────────────────────────────────

const addedFiles = gitChanged("A");
const modifiedFiles = gitChanged("M");
const allChanged = [...addedFiles, ...modifiedFiles];

const CHAPTER_RE = /^src\/data\/chapters\/([\w]+)-(\d+)\.json$/;
const INTRO_RE = /^src\/data\/intros\/([\w]+)-intro\.md$/;
const ARTICLE_RE = /^src\/content\/articles\//;
const GLOSSARY_RE = /^src\/content\/glossary\/(.+)\.md$/;

const addedChapters = addedFiles.filter((f) => CHAPTER_RE.test(f));
const modifiedChapters = modifiedFiles.filter((f) => CHAPTER_RE.test(f));
const addedIntros = addedFiles.filter((f) => INTRO_RE.test(f));
const modifiedIntros = modifiedFiles.filter((f) => INTRO_RE.test(f));
const addedGlossary = addedFiles.filter((f) => GLOSSARY_RE.test(f));
const modifiedGlossary = modifiedFiles.filter((f) => GLOSSARY_RE.test(f));
const addedArticles = addedFiles.filter((f) => ARTICLE_RE.test(f));
const modifiedArticles = modifiedFiles.filter((f) => ARTICLE_RE.test(f));

const changes = [];

// newByBook collects both brand-new chapter files AND placeholder→real upgrades.
// It is emitted after both passes so placeholders detected in the modified loop
// are included in the grouping.
const newByBook = /** @type {Record<string, number[]>} */ ({});

// ── Collect newly added chapter files ────────────────────────────────────────

for (const file of addedChapters) {
  const m = file.match(CHAPTER_RE);
  if (!m) continue;
  const [, bookKey, chStr] = m;
  (newByBook[bookKey] ??= []).push(parseInt(chStr, 10));
}

// ── Modified chapters ─────────────────────────────────────────────────────────

for (const file of modifiedChapters) {
  const m = file.match(CHAPTER_RE);
  if (!m) continue;
  const [, bookKey, chStr] = m;
  const chapter = parseInt(chStr, 10);
  const label = bookKeyToLabel(bookKey);

  let oldJson, newJson;
  try {
    oldJson = JSON.parse(
      execSync(`git show "${baseRef}:${file}"`, { cwd: root }).toString()
    );
  } catch {
    changes.push({
      type: "text_updated",
      description: `${label} ${chapter} — updated`,
    });
    continue;
  }

  // Placeholder chapters have "indexed": false. If the old version was a
  // placeholder and the new one is not, treat this as a newly published chapter
  // rather than a content edit.
  if (oldJson.indexed === false) {
    const newIndexed = JSON.parse(readFileSync(resolve(root, file), "utf-8")).indexed;
    if (newIndexed !== false) {
      (newByBook[bookKey] ??= []).push(chapter);
      continue; // will be handled in the "completed placeholders" pass below
    }
    // Still a placeholder — skip entirely
    continue;
  }
  try {
    newJson = JSON.parse(readFileSync(resolve(root, file), "utf-8"));
  } catch {
    changes.push({
      type: "text_updated",
      description: `${label} ${chapter} — updated`,
    });
    continue;
  }

  const oldParas = oldJson.paragraphs ?? [];
  const newParas = newJson.paragraphs ?? [];
  const parasChanged = JSON.stringify(oldParas) !== JSON.stringify(newParas);

  const oldFns = oldJson.footnotes ?? [];
  const newFns = newJson.footnotes ?? [];
  const fnsChanged = JSON.stringify(oldFns) !== JSON.stringify(newFns);
  const fnAdded = newFns.length > oldFns.length;

  // Find verse numbers in changed paragraphs
  const changedVerses = new Set();
  if (parasChanged) {
    const maxLen = Math.max(oldParas.length, newParas.length);
    for (let i = 0; i < maxLen; i++) {
      if (oldParas[i] !== newParas[i]) {
        const html = newParas[i] ?? oldParas[i] ?? "";
        for (const v of extractVerses(html)) changedVerses.add(v);
      }
    }
  }

  const verseStr = formatVerseRange([...changedVerses]);
  const ref = verseStr ? `${label} ${chapter}:${verseStr}` : `${label} ${chapter}`;

  if (!parasChanged && !fnsChanged) {
    // Only metadata (topics, title, description) changed
    changes.push({
      type: "metadata_updated",
      description: `${label} ${chapter} — metadata updated`,
    });
  } else if (parasChanged && fnsChanged) {
    changes.push({
      type: "text_updated",
      description: `${ref} — text and footnotes updated`,
    });
  } else if (parasChanged) {
    changes.push({
      type: "text_updated",
      description: `${ref} — text updated`,
    });
  } else {
    // footnotes only
    changes.push({
      type: fnAdded ? "footnote_added" : "footnote_updated",
      description: `${ref} — footnote ${fnAdded ? "added" : "updated"}`,
    });
  }
}

// ── Emit new/completed chapters (grouped by book) ────────────────────────────

for (const bookKey of BOOK_ORDER) {
  const chapters = newByBook[bookKey];
  if (!chapters) continue;
  chapters.sort((a, b) => a - b);
  const label = bookKeyToLabel(bookKey);
  const total = BOOKS[bookKey];

  if (chapters.length === total) {
    changes.push({ type: "chapter_added", description: `${label} added` });
  } else if (chapters.length === 1) {
    changes.push({
      type: "chapter_added",
      description: `${label} ${chapters[0]} added`,
    });
  } else {
    changes.push({
      type: "chapter_added",
      description: `${label} chapters ${formatVerseRange(chapters)} added`,
    });
  }
}

// ── Intros ────────────────────────────────────────────────────────────────────

for (const file of [...addedIntros, ...modifiedIntros]) {
  const m = file.match(INTRO_RE);
  if (!m) continue;
  const label = bookKeyToLabel(m[1]);
  const isNew = addedIntros.includes(file);
  changes.push({
    type: "intro_updated",
    description: `${label} Introduction ${isNew ? "added" : "updated"}`,
  });
}

// ── Glossary entries ──────────────────────────────────────────────────────────
// Each entry is a separate markdown file; read its frontmatter to get the
// traditional word for a human-readable description.

function readGlossaryTraditional(file) {
  try {
    const content = readFileSync(resolve(root, file), "utf-8");
    // Match both quoted forms: `traditional: "Good [1]"` and unquoted: `traditional: Angel`
    const m = content.match(/^traditional:\s*(?:"([^"]+)"|'([^']+)'|(.+?))\s*$/m);
    return m ? (m[1] ?? m[2] ?? m[3]).trim() : basename(file, ".md");
  } catch {
    return basename(file, ".md");
  }
}

for (const file of addedGlossary) {
  const traditional = readGlossaryTraditional(file);
  changes.push({
    type: "glossary_added",
    description: `Glossary entry for ${traditional} added`,
  });
}

for (const file of modifiedGlossary) {
  const traditional = readGlossaryTraditional(file);
  changes.push({
    type: "glossary_updated",
    description: `Glossary entry for ${traditional} updated`,
  });
}

// ── Articles ──────────────────────────────────────────────────────────────────

for (const file of addedArticles) {
  changes.push({
    type: "article_added",
    description: `Article added: ${basename(file, ".md").replace(/-/g, " ")}`,
  });
}
for (const file of modifiedArticles) {
  changes.push({
    type: "article_updated",
    description: `Article updated: ${basename(file, ".md").replace(/-/g, " ")}`,
  });
}

// ── Output ────────────────────────────────────────────────────────────────────

if (changes.length === 0) {
  console.log(`No content changes detected since ${baseRef}.`);
  process.exit(0);
}

const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const entry = {
  version: today,
  date: today,
  label: new Date().toLocaleDateString("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "long",
    day: "numeric",
  }),
  changes,
};

if (writeFlag) {
  const rnPath = resolve(root, "src/data/release-notes.json");
  let existing = [];
  if (existsSync(rnPath)) {
    existing = JSON.parse(readFileSync(rnPath, "utf-8"));
  }
  // Don't duplicate entries for the same date
  const sameDay = existing.findIndex((e) => e.date === today);
  if (sameDay !== -1) {
    existing[sameDay].changes = entry.changes;
    console.log(
      `✓ Updated existing ${today} entry with ${changes.length} change(s) in src/data/release-notes.json`
    );
  } else {
    existing.unshift(entry);
    console.log(
      `✓ Prepended ${changes.length} change(s) to src/data/release-notes.json`
    );
  }
  writeFileSync(rnPath, JSON.stringify(existing, null, 2) + "\n");
} else {
  console.log(JSON.stringify(entry, null, 2));
  console.log(
    "\nRe-run with --write to prepend this entry to src/data/release-notes.json"
  );
}
