#!/usr/bin/env node
// scripts/build-api2-vectors.mjs
//
// Writes test/fixtures/api2-vectors.json: the test vectors for the content
// API, version 2 (API-2-FORMAT.md), which the apps run against their own
// ingest and test/api2.test.js runs against scripts/lib/api2-core.mjs.
//
// On demand only, like build:anchor-vectors: the output is committed. It holds
//   hashes    every chapter's `hash` and `words` (wordsHash: its text, verse
//             spans and footnote texts), beside `source`, the SHA-256 of the
//             version 1 chapter file it was built from (the same hash the
//             version 1 manifest lists), so an app or a test can tell which
//             entries describe the text it has;
//   chapters  whole version 2 files for chapters chosen for their edges, each
//             with its version 1 input copied in, so they stay valid as the
//             corpus moves on;
//   synthetic hand-written inputs for edges the corpus doesn't have today.
//
//   npm run build:api2-vectors
//
// It refuses to write when the words would change under the same `api`
// (wordsChanges): for every chapter whose version 1 file is the one the
// committed vectors were made from, and for every copied sample and
// hand-written input. A change to the rules that make the words is a new `api`
// number and folder (API-2-FORMAT.md, "The spec bump rule"), so this is where
// such a change is caught before it reaches the apps. `--allow-words-change`
// writes anyway; use it only for a deliberate fix made before any app reads
// version 2, and say so in the PR.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ANCHOR_SPEC_VERSION } from "./lib/anchor-text.mjs";
import { API_VERSION, buildChapterV2, sha256, wordsChanges, wordsHash } from "./lib/api2-core.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHAPTERS = join(ROOT, "src/data/chapters");
const OUT = join(ROOT, "test/fixtures/api2-vectors.json");

const inputOf = (c) => ({
  bookKey: c.bookKey,
  chapter: c.chapter,
  indexed: c.indexed,
  title: c.title,
  description: c.description,
  topics: c.topics,
  paragraphs: c.paragraphs,
  footnotes: c.footnotes,
});

// ── Every chapter's hash ───────────────────────────────────────────────────
const hashes = {};
for (const name of readdirSync(CHAPTERS).filter((n) => n.endsWith(".json")).sort()) {
  const raw = readFileSync(join(CHAPTERS, name));
  const v2 = buildChapterV2(JSON.parse(raw.toString("utf8")));
  hashes[name.replace(/\.json$/, "")] = { source: sha256(raw), hash: v2.hash, words: wordsHash(v2) };
}

// ── Chapters, whole ────────────────────────────────────────────────────────
const SAMPLE = [
  ["colossians-4", "a footnote letter ahead of the first verse marker: `at` 0, the first verse's start"],
  ["john-5", "a footnote letter at a verse's first word (fn-c, at 5:5's start), which also explains the gap where 5:4 would be"],
  ["mark-16", "a ⟦ ahead of a verse marker: the mark starts at 16:9's start, and ends after the last word before ⟧"],
  ["john-7", "a ⟦ opening 7:53 at the foot of the chapter, with no ⟧ in the chapter (`closes` false, `end` the text's end)"],
  ["john-8", "a ⟧ with no ⟦ in the chapter (`opens` false, `start` 0)"],
  ["john-9", "a mid-verse ⟧ (9:39): the space either side of it collapses to one, and the mark ends before it"],
  ["john-11", "a quote inside a vglue span (11:8), and a ⟦ running straight into the verse (john-11-p16)"],
  ["luke-22", "a ⟦ opening mid-paragraph, after 22:42"],
  ["romans-16", "two marks in one chapter: verse 24 and the doxology"],
  ["2corinthians-6", "a bare <br> in a plain paragraph (6:2): a `p` block with two `lines`"],
  ["hebrews-2", "a verse crossing a block boundary (2:8 continues into the next paragraph, which then opens 2:9)"],
  ["luke-1", "hbq blocks with lines, and verse numbers mid-line (1:70–75)"],
  ["romans-8", "an <em> run"],
  ["matthew-17", "a verse-number gap (17:21 is not in the source text)"],
  ["acts-2", "a placeholder draft (`indexed` false): empty text, its placeholder <figure> kept"],
];
const chapters = SAMPLE.map(([slug, why]) => {
  const input = inputOf(JSON.parse(readFileSync(join(CHAPTERS, `${slug}.json`), "utf8")));
  return { slug, why, input, expected: buildChapterV2(input) };
});

// ── Synthetic ──────────────────────────────────────────────────────────────
const vn = (n) => `<span class="vglue"><sup id="v${n}" class="vn">${n}</sup>&nbsp;`;
const fn = (l) => `<sup class="fn-ref"><a id="fnref-${l}" href="#fn-${l}" role="doc-noteref">${l}</a></sup>`;
const note = (l, html) => ({ id: `fn-${l}`, refId: `fnref-${l}`, label: l, html });
const SYNTHETIC = [
  {
    why: "an <em> run crossing a verse boundary is one run, and covers the space between the verses",
    paragraphs: [`<p id="test-1-p1">${vn(1)}Alpha</span> beta <em>gamma ${vn(2)}delta</span> epsilon</em> zeta.</p>`],
    footnotes: [],
  },
  {
    why: "a footnote letter standing between two spaces: the spaces collapse to one, and the letter sits before it",
    paragraphs: [`<p id="test-1-p1">${vn(1)}Alpha</span> ${fn("a")} beta.</p>`],
    footnotes: [note("a", "A note with <em>emphasis</em>&nbsp;and a&nbsp;space.")],
  },
  {
    why: "a verse crossing a block boundary: the one space between the blocks belongs to neither, and the verse span covers both",
    paragraphs: [
      `<p id="test-1-p1">${vn(1)}One</span> two:</p>`,
      `<blockquote id="test-1-p2" class="hbq"><p class="hbq-line">three four,</p><p class="hbq-line">five ${vn(2)}six.</span></p></blockquote>`,
    ],
    footnotes: [],
  },
  {
    why: "a draft holding the translation so far (`indexed` false, as a book imported ahead of its publication): its text and ranges, served like any chapter's",
    indexed: false,
    paragraphs: [`<p id="test-1-p1">${vn(1)}Alpha</span> beta.${fn("a")} ${vn(2)}Gamma</span> delta.</p>`],
    footnotes: [note("a", "A note.")],
  },
].map(({ why, indexed = true, paragraphs, footnotes }) => {
  const input = {
    bookKey: "test",
    chapter: 1,
    indexed,
    title: "Test 1",
    description: "",
    topics: [],
    paragraphs,
    footnotes,
  };
  return { why, input, expected: buildChapterV2(input) };
});

// ── The words must not change under one api ────────────────────────────────
const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
const moved = wordsChanges(previous, hashes, buildChapterV2);
if (moved.length && !process.argv.includes("--allow-words-change")) {
  console.error(
    `❌ The words would change under api ${API_VERSION} (text, verse spans or footnote text):\n` +
      moved.map((m) => `   ${m}`).join("\n") +
      `\nA change to the rules that make the words is a new api number and folder ` +
      `(API-2-FORMAT.md, "The spec bump rule"). Nothing was written.`,
  );
  process.exit(1);
}
if (moved.length) console.warn(`⚠️  Words changed under api ${API_VERSION}, written anyway (--allow-words-change):\n   ${moved.join("\n   ")}`);

writeFileSync(
  OUT,
  JSON.stringify(
    {
      api: API_VERSION,
      anchorSpec: ANCHOR_SPEC_VERSION,
      note:
        "Vectors for the content API, version 2 (API-2-FORMAT.md). `hashes[slug].source` is the SHA-256 of the version 1 chapter file, as the version 1 manifest lists it; `hash` is the version 2 chapter's hash when built from that file, and `words` the fingerprint of its text, verse spans and footnote texts. `chapters` and `synthetic` copy their version 1 input, and `expected` is the whole version 2 chapter file. `anchorSpec` here is information only (the Study Desk's rule number when these were written); a chapter file doesn't carry it. Regenerate with `npm run build:api2-vectors`.",
      hashes,
      chapters,
      synthetic: SYNTHETIC,
    },
    null,
    1,
  ) + "\n",
);
console.log(`✅ ${OUT} — ${Object.keys(hashes).length} hashes, ${chapters.length} chapters, ${SYNTHETIC.length} synthetic`);
