// test/anchor-text.test.js
//
// scripts/lib/anchor-text.mjs is the reference implementation of the Study
// Desk's anchor text (STUDY-DESK-FORMAT.md). The apps run the same vectors in
// their own suites, so this file's main job is to prove the committed vectors
// (test/fixtures/anchor-vectors.json) still say what the code does. If one of
// these fails after a deliberate change, regenerate them with
// `npm run build:anchor-vectors`, bump ANCHOR_SPEC_VERSION, and tell the apps.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ANCHOR_SPEC_VERSION,
  CHANGED_GROWTH,
  CONTEXT_LENGTH,
  MIN_CONTEXT,
  chapterAnchorText,
  makeAnchor,
  normalizeAnchorText,
  resolveAnchor,
} from "../scripts/lib/anchor-text.mjs";

const vectors = JSON.parse(
  readFileSync(new URL("./fixtures/anchor-vectors.json", import.meta.url), "utf8"),
);

test("the committed vectors are for this spec version and context length", () => {
  assert.equal(vectors.specVersion, ANCHOR_SPEC_VERSION);
  assert.equal(vectors.contextLength, CONTEXT_LENGTH);
  assert.equal(vectors.minContext, MIN_CONTEXT);
  assert.equal(vectors.changedGrowth, CHANGED_GROWTH);
});

test("normalization vectors", () => {
  for (const v of vectors.normalize) {
    assert.equal(normalizeAnchorText(v.input), v.expected, v.why);
  }
});

test("chapter vectors: verse texts and the joined chapter text", () => {
  for (const c of vectors.chapters) {
    const got = chapterAnchorText(c.paragraphs);
    assert.deepEqual(
      Object.fromEntries([...got.verses].map(([n, t]) => [String(n), t])),
      c.verses,
      c.slug,
    );
    assert.equal(got.text, c.text, c.slug);
  }
});

test("resolution vectors", () => {
  const chapters = new Map(vectors.chapters.map((c) => [c.slug, chapterAnchorText(c.paragraphs)]));
  for (const v of vectors.resolve) {
    const chapter = chapters.get(v.chapter);
    const r = resolveAnchor(chapter, v.anchor);
    assert.equal(r.status, v.expected.status, v.why);
    assert.equal(r.start, v.expected.start, v.why);
    assert.equal(r.end, v.expected.end, v.why);
    if (r.start !== null) assert.equal(chapter.text.slice(r.start, r.end), v.expected.text, v.why);
    // Spec version 4: a `moved` says whether it left the anchor's verses.
    if (r.status === "moved") assert.equal(r.outsideVerses, v.expected.outsideVerses, v.why);
  }
  assert.ok(vectors.resolve.some((v) => v.expected.status === "moved" && v.expected.outsideVerses === true), "a move outside its verses");
  assert.ok(vectors.resolve.some((v) => v.expected.status === "moved" && v.expected.outsideVerses === false), "a move whose verses are gone");
});

test("spec 4: a moved result says whether it left the anchor's verses while they still exist (audit 3 DI3-2)", () => {
  const then = chapterAnchorText([
    '<p><span class="vglue"><sup id="v1" class="vn">1</sup>&nbsp;Love</span> is patient and love is kind to all who ask of it. <span class="vglue"><sup id="v2" class="vn">2</sup>&nbsp;It</span> is not envious, it does not boast, it is not arrogant.</p>',
  ]);
  const s = then.text.indexOf("does not boast");
  const a = makeAnchor(then, s, s + "does not boast".length);
  assert.equal(a.verse, 2);
  // The verse boundary moved across the words: the move begins inside verse 2, so it is silent.
  const boundary = chapterAnchorText([
    '<p><span class="vglue"><sup id="v1" class="vn">1</sup>&nbsp;Love</span> is patient and love is kind to all who ask of it. It is not envious, it does <span class="vglue"><sup id="v2" class="vn">2</sup>&nbsp;not</span> boast, it is not arrogant.</p>',
  ]);
  const straddle = resolveAnchor(boundary, { ...a, verse: 2, endVerse: 2 });
  assert.equal(straddle.status, "moved");
  assert.equal(straddle.outsideVerses, true, "the words now begin in verse 1, outside the mark's verse 2");
  // The same words in verse 1 while verse 2 stands reworded: outside.
  const other = chapterAnchorText([
    '<p><span class="vglue"><sup id="v1" class="vn">1</sup>&nbsp;Love</span> is patient and love is kind, it does not boast, it is not arrogant. <span class="vglue"><sup id="v2" class="vn">2</sup>&nbsp;It</span> is not envious, it never brags, it is not proud.</p>',
  ]);
  assert.equal(resolveAnchor(other, a).status, "moved");
  assert.equal(resolveAnchor(other, a).outsideVerses, true);
  // The anchor's verses no longer exist: a move, but nothing to say against them.
  assert.equal(resolveAnchor(other, { ...a, verse: 9, endVerse: 9 }).status, "moved");
  assert.equal(resolveAnchor(other, { ...a, verse: 9, endVerse: 9 }).outsideVerses, false);
  // A move that begins inside the anchor's verses is silent: the words now cross out of verse 2's end.
  const crossing = chapterAnchorText([
    '<p><span class="vglue"><sup id="v1" class="vn">1</sup>&nbsp;Love</span> is patient and love is kind to all who ask of it. <span class="vglue"><sup id="v2" class="vn">2</sup>&nbsp;It</span> is not envious, it does <span class="vglue"><sup id="v3" class="vn">3</sup>&nbsp;not</span> boast, it is not arrogant.</p>',
  ]);
  const inside = resolveAnchor(crossing, a);
  assert.equal(inside.status, "moved");
  assert.equal(inside.outsideVerses, false);
});

test("no bracket marker survives in any vector chapter's text", () => {
  for (const c of vectors.chapters) assert.doesNotMatch(c.text, /[⟦⟧]|\[\||\|\]/, c.slug);
});

const chapter = chapterAnchorText([
  '<p id="t-1-p1"><span class="vglue"><sup id="v1" class="vn">1</sup>&nbsp;Love</span> is patient, love is kind.<sup class="fn-ref"><a href="#fn-a">a</a></sup> <span class="vglue"><sup id="v2" class="vn">2</sup>&nbsp;It</span> is not envious.</p>',
  '<p id="t-1-p2">It does not boast. <span class="vglue"><sup id="v3" class="vn">3</sup>&nbsp;Love</span> never fails.</p>',
]);

test("chapterAnchorText: verse numbers and footnote letters contribute nothing; a continuation joins its verse", () => {
  assert.equal(chapter.verses.get(1), "Love is patient, love is kind.");
  assert.equal(chapter.verses.get(2), "It is not envious. It does not boast.");
  assert.equal(chapter.text, "Love is patient, love is kind. It is not envious. It does not boast. Love never fails.");
  assert.deepEqual(chapter.spans.get(3), [chapter.text.indexOf("Love never"), chapter.text.length]);
});

test("makeAnchor: records the verses touched and context across a verse boundary", () => {
  const s = chapter.text.indexOf("kind. It is");
  const a = makeAnchor(chapter, s, s + "kind. It is".length);
  assert.equal(a.verse, 1);
  assert.equal(a.endVerse, 2);
  assert.equal(a.suffix, " not envious. It does not boast.");
});

test("resolveAnchor: the stored context chooses between repeated words", () => {
  const second = chapter.text.indexOf("love is");
  const a = makeAnchor(chapter, second, second + 4);
  assert.deepEqual(resolveAnchor(chapter, a), { status: "found", start: second, end: second + 4 });
});

test("resolveAnchor: a stored quote is normalized before matching (an old app quote with ⟦ or a line break)", () => {
  const a = { verse: 1, endVerse: 1, exact: "⟦patient,\nlove", prefix: "Love is ", suffix: " is kind" };
  const r = resolveAnchor(chapter, a);
  assert.equal(r.status, "found");
  assert.equal(chapter.text.slice(r.start, r.end), "patient, love");
});

test("resolveAnchor: reworded text between surviving context is offered as changed", () => {
  const reworded = chapterAnchorText([
    '<p id="t-1-p1"><span class="vglue"><sup id="v1" class="vn">1</sup>&nbsp;Love</span> is generous, love is kind.</p>',
  ]);
  const s = chapter.text.indexOf("patient");
  const r = resolveAnchor(reworded, makeAnchor(chapter, s, s + "patient".length));
  assert.equal(r.status, "changed");
  assert.equal(reworded.text.slice(r.start, r.end), "generous");
});

test("resolveAnchor: with nothing to go on, a mark falls back to its whole verse", () => {
  const r = resolveAnchor(chapter, { verse: 3, endVerse: 3, exact: "abides", prefix: "", suffix: "" });
  assert.equal(r.status, "verse");
  assert.equal(chapter.text.slice(r.start, r.end), "Love never fails.");
});

test("resolveAnchor, rule e: repeated words with too little agreeing context fall to the verse", () => {
  // "is" twice in verse 1, and again in verse 2.
  const second = chapter.text.indexOf("is kind");
  const a = { ...makeAnchor(chapter, second, second + 2), prefix: "", suffix: "" };
  const r = resolveAnchor(chapter, a);
  assert.equal(r.status, "verse");
  assert.equal(chapter.text.slice(r.start, r.end), "Love is patient, love is kind.");
});

test("resolveAnchor, rule e: a single occurrence needs no context", () => {
  const r = resolveAnchor(chapter, { verse: 3, endVerse: 3, exact: "never", prefix: "", suffix: "" });
  assert.equal(r.status, "found");
});

test("resolveAnchor, rule e: a changed region longer than twice the quote plus CHANGED_GROWTH falls to the verse", () => {
  const long = chapterAnchorText([
    '<p id="t-1-p1"><span class="vglue"><sup id="v1" class="vn">1</sup>&nbsp;Love</span> is ' +
      "x".repeat(2 * "patient".length + CHANGED_GROWTH + 1) + ", love is kind.</p>",
  ]);
  const fits = chapterAnchorText([
    '<p id="t-1-p1"><span class="vglue"><sup id="v1" class="vn">1</sup>&nbsp;Love</span> is ' +
      "x".repeat(2 * "patient".length + CHANGED_GROWTH) + ", love is kind.</p>",
  ]);
  const s = chapter.text.indexOf("patient");
  const a = makeAnchor(chapter, s, s + "patient".length);
  assert.equal(resolveAnchor(long, a).status, "verse");
  assert.equal(resolveAnchor(fits, a).status, "changed");
});

test("spec 3: rewording one word of a mark seldom lands it silently on other words (audit DI-1)", () => {
  // Every 3-word mark in three chapters; the middle word is replaced. The mark
  // may be found again, flagged, or fall to its verse, but a `found` or
  // `moved` on a different stretch of words must be rare. Audit 2 measured
  // 6.7% for this shape before spec 3.
  let trials = 0;
  let silentWrong = 0;
  for (const slug of ["john-3", "romans-8", "colossians-3"]) {
    const paragraphs = JSON.parse(
      readFileSync(new URL(`../src/data/chapters/${slug}.json`, import.meta.url), "utf8"),
    ).paragraphs;
    const chapter = chapterAnchorText(paragraphs);
    for (const [, [vs, ve]] of chapter.spans) {
      const words = [...chapter.text.slice(vs, ve).matchAll(/\S+/g)];
      for (let i = 0; i + 2 < words.length; i++) {
        const start = vs + words[i].index;
        const end = vs + words[i + 2].index + words[i + 2][0].length;
        const anchor = makeAnchor(chapter, start, end);
        const mid = words[i + 1];
        const exact = chapter.text.slice(start, vs + mid.index) + "zzqx" + chapter.text.slice(vs + mid.index + mid[0].length, end);
        const r = resolveAnchor(chapter, { ...anchor, exact });
        trials++;
        if ((r.status === "found" || r.status === "moved") && chapter.text.slice(r.start, r.end) !== exact) silentWrong++;
      }
    }
  }
  assert.ok(trials > 500, `trials: ${trials}`);
  assert.ok(silentWrong / trials < 0.02, `${silentWrong} of ${trials}`);
});
