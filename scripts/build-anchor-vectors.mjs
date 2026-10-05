#!/usr/bin/env node
// scripts/build-anchor-vectors.mjs
//
// Writes test/fixtures/anchor-vectors.json: the test vectors for the Study
// Desk's anchor text (STUDY-DESK-FORMAT.md), which the website and both apps
// run in their own test suites so the three implementations can't drift.
//
// On demand only, like build:alignment: the output is committed, because the
// apps fetch it from the repo and because its "before" texts come from git
// history, which a CI checkout doesn't have. Every input is copied into the
// file, so the vectors stay valid as the corpus moves on. test/anchor-text.test.js
// checks the committed file against scripts/lib/anchor-text.mjs.
//
//   npm run build:anchor-vectors

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ANCHOR_SPEC_VERSION,
  CONTEXT_LENGTH,
  chapterAnchorText,
  makeAnchor,
  normalizeAnchorText,
  resolveAnchor,
} from "./lib/anchor-text.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "test/fixtures/anchor-vectors.json");

const readNow = (slug) =>
  JSON.parse(readFileSync(join(ROOT, "src/data/chapters", slug + ".json"), "utf8")).paragraphs;
const readAt = (rev, slug) =>
  JSON.parse(
    execFileSync("git", ["show", `${rev}:src/data/chapters/${slug}.json`], { cwd: ROOT, encoding: "utf8" }),
  ).paragraphs;

// ── Normalization ──────────────────────────────────────────────────────────
const NORMALIZE = [
  ["both bracket forms are removed", "⟦ The generosity be with you. ⟧", "The generosity be with you."],
  ["the retired bracket form the Word masters carry is removed too", "[| Then Jesus said |]", "Then Jesus said"],
  ["a bracket mid-verse leaves one space, not two (John 9:39)", "Jesus said, ⟧ “I came", "Jesus said, “I came"],
  ["a literal no-break space is a space", "a b", "a b"],
  ["line breaks and runs of whitespace become one space", "line one\n  line two\t end", "line one line two end"],
  ["zero-width characters and soft hyphens are removed", "re­orient​ing⁠ minds﻿", "reorienting minds"],
  ["text is composed (NFC)", "Iēsous", "Iēsous"],
  ["curly quotes, apostrophes and dashes are kept as written", "“Don’t,” he said—‘wait’ – 3–4", "“Don’t,” he said—‘wait’ – 3–4"],
  ["leading and trailing whitespace is trimmed", "  word  ", "word"],
].map(([why, input, expected]) => {
  if (normalizeAnchorText(input) !== expected) throw new Error(`normalize vector disagrees: ${why}`);
  return { why, input, expected };
});

// ── Chapters: paragraphs in, verse texts out ───────────────────────────────
const CHAPTERS = [
  ["john-7", "⟦ opens John 7:53–8:11 at the foot of the chapter"],
  ["john-8", "⟦ ⟧ around the rest of John 7:53–8:11 (john-8-p9)"],
  ["john-9", "⟦ ⟧ around John 9:38–39a; the ⟧ falls mid-verse"],
  ["john-11", "a bracket that runs straight into the verse (john-11-p16)"],
  ["luke-22", "⟦ opening mid-paragraph, after 22:42 (luke-22-p18)"],
  ["mark-16", "⟦ ⟧ around Mark 16:9–20 across paragraphs"],
  ["romans-16", "two bracketed spans: verse 24 and the doxology"],
  ["luke-1", "poetry blocks with verse numbers mid-line (1:70–75)"],
  ["2corinthians-6", "a paragraph set as lines with <br> (6:2)"],
  ["hebrews-2", "a continuation paragraph that also opens the next verse (2:8–9)"],
  ["matthew-17", "a verse-number gap (17:21 is not in the source text)"],
  ["romans-4", "used by the rewording vectors below"],
  ["galatians-3", "used by the rewording vectors below"],
  ["matthew-20", "used by the paragraph-merge vectors below"],
].map(([slug, why]) => {
  const paragraphs = readNow(slug);
  const { verses, text } = chapterAnchorText(paragraphs);
  return { slug, why, paragraphs, verses: Object.fromEntries(verses), text };
});
const chapterBySlug = new Map(CHAPTERS.map((c) => [c.slug, chapterAnchorText(c.paragraphs)]));

// ── Finding a mark again ───────────────────────────────────────────────────
// Each anchor is made on one text (often an older revision, from git) and
// resolved against a chapter above.
function anchorOn(chapter, quote, verse, occurrence = 1) {
  const [lo, hi] = chapter.spans.get(verse);
  let i = lo - 1;
  for (let k = 0; k < occurrence; k++) {
    i = chapter.text.indexOf(quote, i + 1);
    if (i === -1 || i >= hi) throw new Error(`"${quote}" (${occurrence}) not in verse ${verse}`);
  }
  return makeAnchor(chapter, i, i + quote.length);
}

const RESOLVE_CASES = [
  {
    why: "Romans 4:7 reworded on 2026-09-03 (Gratified → How greatly fortunate); the context before it changed too",
    madeOn: { rev: "97c964a^", slug: "romans-4" },
    quote: "Gratified", verse: 7, against: "romans-4",
  },
  {
    why: "Galatians 3:27 reworded on 2026-08-21 (submersed → immersed)",
    madeOn: { rev: "d75da55^", slug: "galatians-3" },
    quote: "were submersed for Christ", verse: 27, against: "galatians-3",
  },
  {
    why: "Matthew 20:7 after 2026-08-18's merge moved every paragraph's position: verse and quote still find it",
    madeOn: { rev: "63aa937^", slug: "matthew-20" },
    quote: "Because no one hired us", verse: 7, against: "matthew-20",
  },
  {
    why: "the same merge dropped a quotation mark that sat inside the quote",
    madeOn: { rev: "63aa937^", slug: "matthew-20" },
    quote: "“‘You go to the vineyard", verse: 7, against: "matthew-20",
  },
  {
    why: "a word that occurs three times in the verse: the stored context picks the third",
    madeOn: { slug: "john-9" }, quote: "see", verse: 39, occurrence: 3, against: "john-9",
  },
  {
    why: "an anchor whose verse numbers are wrong but whose words are in the chapter",
    madeOn: { slug: "hebrews-2" }, quote: "bestowed with the laurel wreath", verse: 9, against: "hebrews-2",
    override: { verse: 3, endVerse: 3 },
  },
  {
    why: "a quote that crosses a paragraph boundary inside one verse (Hebrews 2:8)",
    madeOn: { slug: "hebrews-2" }, quote: null, verse: 8, against: "hebrews-2",
  },
  {
    why: "verses that no longer exist in the chapter",
    madeOn: { slug: "matthew-17" }, quote: null, verse: 20, against: "matthew-17",
    override: { verse: 21, endVerse: 21, exact: "this kind does not go out", prefix: "", suffix: "" },
  },
];

const RESOLVE = RESOLVE_CASES.map((c) => {
  const made = c.madeOn.rev
    ? chapterAnchorText(readAt(c.madeOn.rev, c.madeOn.slug))
    : chapterBySlug.get(c.madeOn.slug);
  let anchor;
  if (c.quote === null) {
    // The whole of a verse that runs across two paragraphs.
    const [s, e] = made.spans.get(c.verse);
    anchor = makeAnchor(made, s, e);
  } else {
    anchor = anchorOn(made, c.quote, c.verse, c.occurrence);
  }
  anchor = { ...anchor, ...(c.override || {}) };
  const chapter = chapterBySlug.get(c.against);
  const r = resolveAnchor(chapter, anchor);
  return {
    why: c.why,
    ...(c.madeOn.rev ? { madeOn: `${c.madeOn.slug} at ${c.madeOn.rev}` } : {}),
    chapter: c.against,
    anchor,
    expected: {
      status: r.status,
      text: r.start === null ? null : chapter.text.slice(r.start, r.end),
      start: r.start,
      end: r.end,
    },
  };
});

const out = {
  spec: "STUDY-DESK-FORMAT.md",
  specVersion: ANCHOR_SPEC_VERSION,
  contextLength: CONTEXT_LENGTH,
  offsets: "UTF-16 code units into a chapter's anchor text (verse texts joined by one space)",
  generatedBy: "npm run build:anchor-vectors (scripts/build-anchor-vectors.mjs)",
  normalize: NORMALIZE,
  chapters: CHAPTERS,
  resolve: RESOLVE,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(
  `Wrote ${NORMALIZE.length} normalization, ${CHAPTERS.length} chapter and ${RESOLVE.length} resolution vectors to ${OUT.replace(ROOT + "/", "")}`,
);
for (const r of RESOLVE) console.log(`  ${r.expected.status.padEnd(8)} ${JSON.stringify(r.expected.text?.slice(0, 50))}  ← ${r.why}`);
