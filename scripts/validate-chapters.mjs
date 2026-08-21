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
// Where a verse begins inside a paragraph, and therefore what must sit before
// its marker. Shared with the reconciliation toolchain rather than restated
// here: a second copy of that rule is the one way it could quietly stop
// agreeing with the tools that repair against it.
import { findUnseparatedVerseMarkers } from "./reconcile/lib/verse-span.mjs";
// The corpus's own on-disk shape, one footnote per line. --fix emitting plain
// JSON.stringify disagreed with 133 of the 206 footnote-bearing chapters, so
// running a documented command rewrote most of the corpus as formatting churn.
import { serializeChapter } from "./lib/chapter-serialize.mjs";

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

/** Visit every prose-bearing string in a chapter with a human-readable label.
 *  Paragraphs are named by their own id where they have one, so a message can
 *  point at "paragraph john-3-p1" rather than at an array index. */
function forEachProse(data, visit) {
  if (Array.isArray(data.paragraphs)) {
    data.paragraphs.forEach((p, i) => {
      const id = typeof p === "string" ? p.match(/id="([^"]+)"/)?.[1] : null;
      visit(p, `paragraph ${id ?? i + 1}`);
    });
  }
  if (Array.isArray(data.footnotes)) {
    for (const fn of data.footnotes) visit(fn.html, `footnote fn-${fn.label}`);
  }
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
  // Each verse id must appear exactly once (duplicates are invalid HTML and make
  // the #vN anchor ambiguous), must never decrease, and gaps are only allowed for
  // known SBLGNT omissions. A verse spanning a paragraph break keeps its marker
  // only at its start; the continuation paragraph carries no marker.
  if (Array.isArray(data.paragraphs)) {
    const paraHtml = data.paragraphs.join("\n");
    const verses = [...paraHtml.matchAll(/<sup id="v(\d+)" class="vn"/g)].map(
      (m) => Number(m[1])
    );

    // Suffixed verse ids (id="v41b") are not a supported shape. They were once
    // used to re-show a verse number on a continuation paragraph while dodging
    // the uniqueness check below, but every consumer matches id="v(\d+)" — so a
    // suffixed marker is invisible to the verse split (its digits leak into the
    // text as a stray number), gets no data-osis, is never namespaced in Reading
    // Mode, and makes the changelog blame the wrong verse. The corpus convention
    // is that a continuation paragraph carries NO marker; 187 paragraphs across
    // 76 chapters already do it that way. To share just part of a verse, link to
    // the block's own id (see "Sharing part of a verse" in CLAUDE.md).
    // The suffix must start with a letter: `v\d+[^"]+` would backtrack and match
    // a plain id="v14" as "v1" + "4".
    for (const m of paraHtml.matchAll(/<sup id="(v\d+[a-z][^"]*)" class="vn"/g)) {
      errors.push(
        `suffixed verse id: id="${m[1]}" — a continuation paragraph carries no ` +
          `verse marker (drop the <sup> and its vglue wrapper)`
      );
    }

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

      // Uniqueness: each verse id must appear exactly once. A repeat is invalid
      // HTML (epubcheck rejects duplicate ids) and makes the #vN anchor ambiguous;
      // the continuation paragraph of a paragraph-spanning verse carries no marker.
      const counts = new Map();
      for (const v of verses) counts.set(v, (counts.get(v) ?? 0) + 1);
      for (const [v, n] of counts) {
        if (n > 1) {
          errors.push(
            `duplicate verse id: v${v} appears ${n} times (must be unique — the ` +
              `continuation paragraph of a verse spanning a paragraph break carries no marker)`
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

  // ── Prose straight-quote check (paragraphs + footnotes) ───────────────────
  // Strip HTML tags (so attribute quotes are exempt) and flag any remaining
  // ASCII quotes (U+0022, U+0027). Prose must use the Unicode curly forms:
  // opening/closing doubles for quotations, singles for nested quotations,
  // and the right single quote for apostrophes and possessives.
  //
  // Errors, not warnings: a warning fails neither CI nor the pre-commit hook,
  // and an unenforced rule is how 439 straight quotes accumulated across 96
  // chapters before the 2026-08 cleanup. Paragraphs are checked alongside
  // footnotes — the original rule covered footnotes only, so straight quotes
  // in the scripture text itself were never caught at all.
  const straightQuoteChecks = [
    ['"', "double", "“”"],
    ["'", "single", "‘’ (or ’ for an apostrophe)"],
  ];
  const checkProse = (html, where) => {
    if (typeof html !== "string") return;
    const prose = html.replace(/<[^>]+>/g, "");
    for (const [char, name, replacement] of straightQuoteChecks) {
      if (prose.includes(char)) {
        errors.push(
          `${where} contains straight ASCII ${name} quotes in prose text — use curly quotes ${replacement} instead`
        );
      }
    }
    // Same defect in disguise: an entity survives a literal-character scan but
    // decodes to a straight quote in the rendered page and the verse index.
    const entity = prose.match(/&(?:quot|apos|#0*3[49]|#x2[27]);/i);
    if (entity) {
      errors.push(
        `${where} contains an entity-encoded straight quote (${entity[0]}) in prose text — write the curly character directly`
      );
    }
  };
  if (Array.isArray(data.paragraphs)) {
    data.paragraphs.forEach((p, i) => {
      const id = typeof p === "string" ? p.match(/id="([^"]+)"/)?.[1] : null;
      checkProse(p, `paragraph ${id ?? i + 1}`);
    });
  }
  if (Array.isArray(data.footnotes)) {
    for (const fn of data.footnotes) checkProse(fn.html, `footnote fn-${fn.label}`);
  }

  // ── Footnote quote balance ────────────────────────────────────────────────
  // A footnote is a self-contained editorial object, so its curly double quotes
  // must balance INSIDE it. Cheap, and it is what found every defect of the
  // 2026-08 shared-note cleanup: five copies of the hupotasso note had lost the
  // closing ” of a quotation from TDNT, and no master-vs-repo diff could raise
  // it, because both sides were fragmented. Doubles only — a curly ’ is an
  // apostrophe far more often than a nested closer, so singles cannot be counted.
  if (Array.isArray(data.footnotes)) {
    for (const fn of data.footnotes) {
      const text = String(fn.html ?? "").replace(/<[^>]*>/g, "");
      const open = (text.match(/“/g) || []).length;
      const close = (text.match(/”/g) || []).length;
      if (open !== close) {
        errors.push(
          `footnote fn-${fn.label} has unbalanced curly double quotes (${open} “ / ${close} ”) — a footnote must open and close its own quotations`
        );
      }
    }
  }

  // ── Footnote anchor sequence ──────────────────────────────────────────────
  // The anchors must appear in the document in the same order as footnotes[],
  // because the labels are positional (a…z, then aa…zz) and a reader meets them
  // in reading order. The referential check above proves each anchor RESOLVES,
  // never that the sequence agrees — which is how 2corinthians-5 shipped fn-f
  // and fn-g transposed (anchor order e g f h) with every link still working.
  if (Array.isArray(data.paragraphs) && Array.isArray(data.footnotes)) {
    const order = [...data.paragraphs.join("\n").matchAll(/id="fnref-([^"]+)"/g)].map((m) => m[1]);
    const dupes = [...new Set(order.filter((l, i) => order.indexOf(l) !== i))];
    if (dupes.length) {
      errors.push(
        `footnote anchor(s) appear more than once: ${dupes.map((d) => `fnref-${d}`).join(", ")} — the return link becomes ambiguous`
      );
    }
    const seen = order.filter((l, i) => order.indexOf(l) === i);
    const expected = data.footnotes.map((fn) => fn.label).filter((l) => seen.includes(l));
    if (JSON.stringify(seen) !== JSON.stringify(expected)) {
      let i = 0;
      while (i < seen.length && seen[i] === expected[i]) i++;
      errors.push(
        `footnote anchors run out of order: at position ${i + 1} the text has "${seen[i]}" but footnotes[] has "${expected[i]}"`
      );
    }
  }

  // The helper hands back a fixed-width slice, so it can open mid-tag. Drop
  // that leading fragment before stripping, or its attributes read as prose.
  const tail = (before) =>
    String(before)
      .replace(/^[^<>]*>/, "")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .slice(-24);
  // ── Verse-marker separators ───────────────────────────────────────────────
  // sup.vn is inline-block and no CSS supplies a gap, so the space before a
  // verse marker has to be in the text; without it the number welds to the
  // preceding sentence ("sheep.12 The"). The one legitimate shape is a
  // paragraph opening a bracketed passage, where the [| marker and its footnote
  // anchor precede the first verse — that exemption lives here at the call
  // site, not in the shared helper, matching how the changelog handles the
  // same case.
  if (Array.isArray(data.paragraphs)) {
    for (const hit of findUnseparatedVerseMarkers(data.paragraphs)) {
      const p = String(data.paragraphs[hit.paragraphIndex] ?? "");
      if (/^<(?:p|blockquote)\b[^>]*>\[\|<sup class="fn-ref">/.test(p)) continue;
      errors.push(
        `verse ${hit.verse} marker has no separator before it — "…${tail(hit.before)}${hit.verse}" welds the number to the preceding sentence`
      );
    }
  }

  // ── Fragmented tag runs ───────────────────────────────────────────────────
  // Word splits a styled phrase at every run boundary, and those boundaries
  // rarely fall on a word: the 2026-02 import carried in
  // <em>ekd</em><em>e</em><em>me</em><em>o</em>, which renders correctly and so
  // hid for months while defeating every text search over the corpus (a search
  // for "ekdemeo" finds nothing). Only attribute-less same-name seams count —
  // two real <sup class="fn-ref"> anchors in a row are a legitimate shape.
  {
    const seamRe = /<\/([a-z]+)><\1>/g;
    const scanSeams = (html, where) => {
      for (const m of String(html ?? "").matchAll(seamRe)) {
        errors.push(
          `${where} splits a <${m[1]}> run at "${m[0]}" — collapse the seam so the phrase is one run and stays searchable`
        );
      }
    };
    forEachProse(data, scanSeams);
  }

  // ── En dash in numeric ranges ─────────────────────────────────────────────
  // "Matthew 5:3–12", never a hyphen. A repo-only convention: the Word masters
  // keep hyphens, because Word autocorrects a dash between WORDS and not
  // between digits, so every restore from a master pulls ranges back toward the
  // hyphen. Two exclusions — anything inside a tag (id="john-3-p1"), and a URL
  // printed as visible link text, where an en dash breaks the link.
  {
    const isUrl = (tok) =>
      tok.includes("://") ||
      /(^|\/)www\./.test(tok) ||
      /\b[a-z0-9-]+\.(?:com|org|net|edu|gov)\b/i.test(tok);
    const scanRanges = (html, where) => {
      for (const part of String(html ?? "").split(/(<[^>]*>)/).filter((_, i) => i % 2 === 0)) {
        for (const tok of part.split(/\s+/)) {
          if (/[0-9]-[0-9]/.test(tok) && !isUrl(tok)) {
            errors.push(`${where} writes the numeric range "${tok}" with a hyphen — use an en dash (–)`);
          }
        }
      }
    };
    forEachProse(data, scanRanges);
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
    const normalized = serializeChapter(data);
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
