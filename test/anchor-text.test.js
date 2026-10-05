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
  CONTEXT_LENGTH,
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
  }
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
