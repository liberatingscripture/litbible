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
    data = JSON.parse(raw);
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
