#!/usr/bin/env node
/**
 * draft-release-notes.mjs
 *
 * Analyzes git content changes and drafts a release notes entry.
 * Detects: new/modified chapters, intros, glossary, and articles.
 * For modified chapters, identifies whether paragraphs or footnotes changed
 * and extracts the affected verse numbers.
 *
 * Reader-facing text only: modified chapters already diff rendered verse/
 * footnote text (attribute- or metadata-only chapter edits collapse to one
 * "metadata updated" line), and modified intros/glossary/articles are compared
 * with HTML attributes and whitespace normalized away, so mechanical edits
 * (e.g. stripping target="_blank" from links) don't produce changelog noise.
 *
 * Each change object carries (see the release-notes.json schema shared with the
 * iOS/Android apps):
 *   - type         change category (footnote_updated, text_updated, chapter_added, …)
 *   - description   self-contained human summary incl. the verse reference
 *   - detail        the pure "before → after" (footnote/text edits only)
 *   - location      { bookKey, chapter, verse? } for scripture changes, so apps
 *                   can deep-link to bookKey chapter:verse. verse is omitted for
 *                   whole-chapter changes; footnoteId is intentionally NOT emitted
 *                   yet (a stable id needs a matching anchor in the chapter JSON).
 *   - relabel       the footnote letter-cascade note (e.g. "footnotes formerly
 *                   t–mm relabeled u–nn"), kept out of `description` so apps can
 *                   mute or hide it. Present only when a relabel occurred.
 * All of location/detail/relabel are additive and optional; `description` alone
 * always renders a complete row for apps that haven't adopted the new fields.
 *
 * Inserted/removed vs. edited footnotes. When a note is inserted or removed
 * mid-chapter every later letter shifts, and a naive label-to-label comparison
 * reads the shift's starting label as an edit — pairing two unrelated notes into
 * a "before → after" that claims the displaced note was rewritten. The core
 * identifies that label instead and reports it as added or removed, wording
 * `description` accordingly ("footnote q added" / "footnote q removed") and
 * putting only the genuinely new or deleted text in `detail`. The letter shift
 * itself still rides along in `relabel`.
 *   - `type` for an insertion is footnote_added even when `relabel` is present
 *     (a cascade no longer forces footnote_updated).
 *   - a removal is described precisely but stays typed footnote_updated: there
 *     is deliberately no footnote_removed value, since adding one would be a
 *     breaking contract change for a client that doesn't know it.
 * Buckets holding a mix of actions keep the umbrella "updated" wording and type.
 *
 * This file is the CLI/git shell only: it parses args, resolves the base ref,
 * lists changed files, reads their old/new content, then delegates all diff→
 * changes logic to buildChanges() in scripts/lib/release-notes-core.mjs (the
 * pure, unit-tested core — see test/draft-release-notes.test.js). Finally it
 * wraps the changes in the dated envelope and prints or --writes them.
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
import { resolve } from "path";
import { fileURLToPath } from "url";

import { buildChanges } from "./lib/release-notes-core.mjs";

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

// ── Git/fs wiring for the pure core ───────────────────────────────────────────

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

/** Raw file content at baseRef, or null if the file didn't exist there. */
function readBase(file) {
  try {
    return execSync(`git show "${baseRef}:${file}"`, {
      cwd: root,
      stdio: ["pipe", "pipe", "ignore"],
    }).toString();
  } catch {
    return null;
  }
}

/** Current raw file content from the working tree, or null if it's gone. */
function readNow(file) {
  const path = resolve(root, file);
  return existsSync(path) ? readFileSync(path, "utf-8") : null;
}

const changes = buildChanges({
  addedFiles: gitChanged("A"),
  modifiedFiles: gitChanged("M"),
  readBase,
  readNow,
});

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
  // Don't duplicate entries for the same date — merge new changes in
  const sameDay = existing.findIndex((e) => e.date === today);
  if (sameDay !== -1) {
    // Append only changes whose description isn't already present, so running
    // the script multiple times on the same day accumulates rather than overwrites.
    const existingDescriptions = new Set(
      existing[sameDay].changes.map((c) => c.description)
    );
    const novel = entry.changes.filter(
      (c) => !existingDescriptions.has(c.description)
    );
    existing[sameDay].changes.push(...novel);
    console.log(
      `✓ Merged ${novel.length} new change(s) into existing ${today} entry in src/data/release-notes.json`
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
