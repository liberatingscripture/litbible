#!/usr/bin/env node
/**
 * validate-chapters.mjs
 *
 * Validates chapter JSON files for structural and referential correctness.
 * Run on all chapters or pass specific file paths as arguments.
 *
 * Usage:
 *   node scripts/validate-chapters.mjs                        # validate all
 *   node scripts/validate-chapters.mjs src/data/chapters/john-3.json  # specific file(s)
 *   node scripts/validate-chapters.mjs --fix                  # re-serialize to normalize formatting
 *
 * Exit codes:
 *   0 — all files valid (warnings may be present)
 *   1 — one or more errors found
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { resolve, join, relative } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(__dirname, "..");
const chaptersDir = join(root, "src/data/chapters");

const args = process.argv.slice(2);
const fixMode = args.includes("--fix");
const filePaths = args.filter((a) => !a.startsWith("--"));

// ── Resolve target files ──────────────────────────────────────────────────────

const files =
  filePaths.length > 0
    ? filePaths.map((f) => resolve(f))
    : readdirSync(chaptersDir)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .map((f) => join(chaptersDir, f));

if (files.length === 0) {
  console.error("No chapter files found.");
  process.exit(1);
}

// ── Required top-level fields ─────────────────────────────────────────────────

const REQUIRED_FIELDS = [
  "bookKey",
  "chapter",
  "type",
  "title",
  "description",
  "paragraphs",
  "footnotes",
];

// ── Known critical-text verse omissions ───────────────────────────────────────
// The LIT follows the SBLGNT, which omits these traditionally numbered verses.
// Gaps listed here are expected; any other gap is flagged as a likely typo.
const KNOWN_OMITTED_VERSES = {
  "matthew-17": [21],
  "matthew-18": [11],
  "matthew-23": [14],
  "mark-7": [16],
  "mark-9": [44, 46],
  "mark-11": [26],
  "mark-15": [28],
  "luke-17": [36],
  "luke-23": [17],
  "john-5": [4],
  "acts-8": [37],
  "acts-15": [34],
  "acts-24": [7],
  "acts-28": [29],
  "romans-16": [24],
};

// ── Validation ────────────────────────────────────────────────────────────────

let totalErrors = 0;
let totalWarnings = 0;
let totalFixed = 0;

for (const filePath of files) {
  const rel = relative(root, filePath).replace(/\\/g, "/");
  let raw;

  // ── Readable ──────────────────────────────────────────────────────────────
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch (e) {
    console.error(`✗ ${rel}: cannot read file — ${e.message}`);
    totalErrors++;
    continue;
  }

  // ── Valid JSON ────────────────────────────────────────────────────────────
  let data;
  try {
    // Strip a UTF-8 BOM if present (some Windows editors add one)
    data = JSON.parse(raw.replace(/^﻿/, ""));
  } catch (e) {
    console.error(`✗ ${rel}: invalid JSON — ${e.message}`);
    totalErrors++;
    continue;
  }

  const errors = [];
  const warnings = [];

  // ── Required fields ───────────────────────────────────────────────────────
  for (const field of REQUIRED_FIELDS) {
    if (data[field] === undefined) {
      errors.push(`missing required field "${field}"`);
    }
  }

  // ── Array types ───────────────────────────────────────────────────────────
  if (data.paragraphs !== undefined && !Array.isArray(data.paragraphs)) {
    errors.push('"paragraphs" must be an array');
  }
  if (data.footnotes !== undefined && !Array.isArray(data.footnotes)) {
    errors.push('"footnotes" must be an array');
  }

  // ── Footnote structural consistency ───────────────────────────────────────
  if (Array.isArray(data.footnotes)) {
    for (const fn of data.footnotes) {
      if (!fn.id || !fn.label) continue;
      if (fn.id !== `fn-${fn.label}`) {
        errors.push(
          `footnote id "${fn.id}" does not match label "${fn.label}" (expected "fn-${fn.label}")`
        );
      }
      if (fn.refId !== `fnref-${fn.label}`) {
        errors.push(
          `footnote refId "${fn.refId}" does not match label "${fn.label}" (expected "fnref-${fn.label}")`
        );
      }
    }
  }

  // ── Footnote ↔ paragraph cross-reference consistency ──────────────────────
  if (Array.isArray(data.paragraphs) && Array.isArray(data.footnotes)) {
    const paraHtml = data.paragraphs.join("\n");

    // Every fnref-X anchor in paragraph HTML must have a matching footnote
    const refsInParas = new Set(
      [...paraHtml.matchAll(/id="fnref-([^"]+)"/g)].map((m) => m[1])
    );
    const fnLabels = new Map(data.footnotes.map((fn) => [fn.label, fn.id]));

    for (const ref of refsInParas) {
      if (!fnLabels.has(ref)) {
        errors.push(
          `paragraphs reference fnref-${ref} but no footnote with label "${ref}" exists`
        );
      }
    }

    // Every footnote must be referenced somewhere in the paragraphs
    for (const [label] of fnLabels) {
      if (!refsInParas.has(label)) {
        warnings.push(
          `footnote fn-${label} is not referenced in any paragraph`
        );
      }
    }
  }

  // ── Verse number sequence checks ──────────────────────────────────────────
  // A verse number may appear twice (a verse spanning a paragraph break repeats
  // its number, deduped at render time), but must never decrease, and gaps are
  // only allowed for known SBLGNT omissions.
  if (Array.isArray(data.paragraphs)) {
    const paraHtml = data.paragraphs.join("\n");
    const verses = [...paraHtml.matchAll(/<sup id="v(\d+)" class="vn"/g)].map(
      (m) => Number(m[1])
    );

    if (verses.length === 0) {
      if (data.indexed !== false) {
        warnings.push(
          "no verse markers found (expected for in-progress drafts with \"indexed\": false)"
        );
      }
    } else {
      // Order: non-decreasing
      for (let i = 1; i < verses.length; i++) {
        if (verses[i] < verses[i - 1]) {
          errors.push(
            `verse numbers out of order: v${verses[i]} appears after v${verses[i - 1]}`
          );
        }
      }

      // Repetition: at most twice
      const counts = new Map();
      for (const v of verses) counts.set(v, (counts.get(v) ?? 0) + 1);
      for (const [v, n] of counts) {
        if (n > 2) {
          warnings.push(
            `verse v${v} appears ${n} times (max expected is 2, for a verse spanning a paragraph break)`
          );
        }
      }

      // Gaps: only known SBLGNT omissions
      const allowedGaps = new Set(
        KNOWN_OMITTED_VERSES[`${data.bookKey}-${data.chapter}`] ?? []
      );
      const present = new Set(verses);
      const max = Math.max(...verses);
      for (let v = 1; v <= max; v++) {
        if (!present.has(v) && !allowedGaps.has(v)) {
          warnings.push(
            `verse v${v} is missing (not a known SBLGNT omission — add to KNOWN_OMITTED_VERSES if intentional)`
          );
        }
      }
    }
  }

  // ── Anchor and internal-link integrity ────────────────────────────────────
  // Every href="#X" in paragraphs or footnotes must resolve to an id rendered
  // on the chapter page; chapter links like /john-3 must have a chapter file.
  if (Array.isArray(data.paragraphs) && Array.isArray(data.footnotes)) {
    const allHtml =
      data.paragraphs.join("\n") +
      "\n" +
      data.footnotes.map((fn) => fn.html ?? "").join("\n");

    const ids = new Set(
      [...allHtml.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])
    );
    for (const fn of data.footnotes) {
      if (fn.id) ids.add(fn.id); // <li id="fn-X"> rendered from footnotes array
    }

    for (const m of allHtml.matchAll(/\bhref="#([^"]+)"/g)) {
      if (!ids.has(m[1])) {
        warnings.push(`href="#${m[1]}" has no matching id in this chapter`);
      }
    }

    for (const m of allHtml.matchAll(/\bhref="\/(\d?[a-z]+-\d+)"/g)) {
      const target = join(chaptersDir, `${m[1]}.json`);
      try {
        readFileSync(target);
      } catch {
        warnings.push(
          `link to /${m[1]} but src/data/chapters/${m[1]}.json does not exist`
        );
      }
    }
  }

  // ── Prose straight-quote check (footnotes) ────────────────────────────────
  // In footnote HTML, strip HTML tags and flag any remaining ASCII double
  // quotes (U+0022) — prose quotes should be Unicode curly quotes.
  if (Array.isArray(data.footnotes)) {
    for (const fn of data.footnotes) {
      if (!fn.html) continue;
      const prose = fn.html.replace(/<[^>]+>/g, "");
      if (prose.includes('"')) {
        warnings.push(
          `footnote fn-${fn.label} contains straight ASCII double quotes in prose text — use curly quotes (\u201c\u201d) instead`
        );
      }
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────
  for (const msg of errors) {
    console.error(`✗ ${rel}: ${msg}`);
    totalErrors++;
  }
  for (const msg of warnings) {
    console.warn(`⚠ ${rel}: ${msg}`);
    totalWarnings++;
  }

  // ── Fix mode: re-serialize to normalize formatting ────────────────────────
  if (fixMode && errors.length === 0) {
    const normalized = JSON.stringify(data, null, 2) + "\n";
    if (normalized !== raw) {
      writeFileSync(filePath, normalized, "utf-8");
      console.log(`  fixed ${rel}`);
      totalFixed++;
    }
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log("");
if (totalErrors === 0 && totalWarnings === 0) {
  console.log(`✓ All ${files.length} chapter file(s) valid.`);
} else {
  if (totalErrors > 0)
    console.error(`${totalErrors} error(s) in ${files.length} file(s) checked.`);
  if (totalWarnings > 0)
    console.warn(`${totalWarnings} warning(s) in ${files.length} file(s) checked.`);
}
if (fixMode && totalFixed > 0) {
  console.log(`${totalFixed} file(s) reformatted.`);
}

process.exit(totalErrors > 0 ? 1 : 0);
