// test/verse-text.test.js
//
// Unit tests for scripts/lib/verse-text.mjs — the chapter-HTML → per-verse
// plain-text splitter shared by the shipped search index
// (build-verse-index.mjs), the alignment scanner (build-alignment.mjs), and
// the alignment review tool. All three read verse text through this module, so
// a change here moves the search index AND the character offsets the alignment
// dataset's `n` counting depends on.
//
// In-memory fixtures only, matching the style of the other suites here.

import { test } from "node:test";
import assert from "node:assert/strict";

import { htmlToPlainText, splitChapterVerses } from "../scripts/lib/verse-text.mjs";

const fnRef = (label) =>
  `<sup class="fn-ref"><a id="fnref-${label}" href="#fn-${label}" role="doc-noteref">${label}</a></sup>`;

const verseSup = (n) => `<sup id="v${n}" class="vn">${n}</sup>`;

test("htmlToPlainText: drops footnote-reference superscripts entirely", () => {
  assert.equal(
    htmlToPlainText(`<p>Gaius${fnRef("a")} greets you.</p>`),
    "Gaius greets you.",
  );
});

test("htmlToPlainText: decodes the entity set chapters actually use", () => {
  assert.equal(
    htmlToPlainText("<p>a&nbsp;b&mdash;c&#39;d&amp;e</p>"),
    "a b—c'd&e",
  );
});

test("htmlToPlainText: removes the literal bracket markers around contested passages", () => {
  assert.equal(
    htmlToPlainText("<p>[| The generosity be with you. |]</p>"),
    "The generosity be with you.",
  );
});

test("htmlToPlainText: a removed marker leaves no double space behind", () => {
  const text = htmlToPlainText("<p>before [| after</p>");
  assert.equal(text, "before after");
  assert.ok(!/ {2}/.test(text), "should not contain a doubled space");
});

test("splitChapterVerses: maps each verse number to its own text", () => {
  const verses = splitChapterVerses([
    `<p><span class="vglue">${verseSup(1)}&nbsp;First</span> verse here. ` +
      `<span class="vglue">${verseSup(2)}&nbsp;Second</span> verse here.</p>`,
  ]);
  assert.equal(verses.get(1), "First verse here.");
  assert.equal(verses.get(2), "Second verse here.");
});

// The regression this module's bracket strip exists for. Chunks run from one
// verse marker to the NEXT, so the opening `[|` — which leads its paragraph,
// ahead of that paragraph's first verse marker — was filed under the previous
// verse. Live cases were Mark 16:8 (carrying v9's marker), John 7:52 (7:53's),
// and Romans 16:23 (16:24's).
test("splitChapterVerses: an opening bracket marker does not leak onto the previous verse", () => {
  const verses = splitChapterVerses([
    `<p><span class="vglue">${verseSup(23)}&nbsp;Gaius</span> greets you.</p>`,
    `<p>[|${fnRef("m")} <span class="vglue">${verseSup(24)}&nbsp;The</span> ` +
      `generosity be with you. |]${fnRef("n")}</p>`,
  ]);
  assert.equal(verses.get(23), "Gaius greets you.");
  assert.equal(verses.get(24), "The generosity be with you.");
});

test("splitChapterVerses: a closing bracket marker does not survive in its own verse", () => {
  const verses = splitChapterVerses([
    `<p>[|${fnRef("e")} <span class="vglue">${verseSup(20)}&nbsp;They</span> ` +
      `went out announcing him. |]${fnRef("m")}</p>`,
  ]);
  assert.equal(verses.get(20), "They went out announcing him.");
});

test("splitChapterVerses: a verse spanning a paragraph break is joined into one entry", () => {
  const verses = splitChapterVerses([
    `<p><span class="vglue">${verseSup(11)}&nbsp;No</span> one, Sir.</p>`,
    `<p><span class="vglue">${verseSup(11)}&nbsp;Go</span> on your way.</p>`,
  ]);
  assert.equal(verses.get(11), "No one, Sir. Go on your way.");
});

test("splitChapterVerses: verses with no body text are omitted rather than stored empty", () => {
  const verses = splitChapterVerses([
    `<p><span class="vglue">${verseSup(1)}&nbsp;Real</span> text.</p>`,
    `<p><span class="vglue">${verseSup(2)}</span>${fnRef("a")}</p>`,
  ]);
  assert.equal(verses.get(1), "Real text.");
  assert.equal(verses.has(2), false);
});

test("splitChapterVerses: tolerates empty and missing paragraph input", () => {
  assert.equal(splitChapterVerses([]).size, 0);
  assert.equal(splitChapterVerses(undefined).size, 0);
});
