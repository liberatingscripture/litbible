import test from "node:test";
import assert from "node:assert/strict";

import {
  findVerseMarkers,
  locateVerseSpanInParagraphs,
  splitTrailingBlockClose,
  splitComposedAtParagraphSeam,
} from "../lib/verse-span.mjs";
import { missingClosers } from "../lib/block-structure.mjs";

const vglue = (n, word) => `<span class="vglue"><sup id="v${n}" class="vn">${n}</sup>&nbsp;${word}</span>`;

test("a verse that is last in its paragraph owns the closing tag, which is why it must be split off", () => {
  const paras = [`<p id="x-p1">${vglue(1, "One")} word. ${vglue(2, "Two")} words.</p>`];
  const loc = locateVerseSpanInParagraphs(paras, 2);
  assert.equal(loc.spansMultipleParagraphs, false);
  const span = paras[0].slice(loc.start, loc.end);
  assert.ok(span.endsWith("</p>"), "the span really does include the paragraph's closing tag");
  const { body, close } = splitTrailingBlockClose(span);
  assert.equal(close, "</p>");
  assert.equal(body + close, span);
});

test("splitTrailingBlockClose leaves inline closers alone", () => {
  assert.deepEqual(splitTrailingBlockClose("some <em>word</em>"), { body: "some <em>word</em>", close: "" });
  assert.deepEqual(splitTrailingBlockClose("a</span></p>"), { body: "a</span>", close: "</p>" });
  assert.deepEqual(splitTrailingBlockClose("line</p></blockquote>"), { body: "line", close: "</p></blockquote>" });
});

test("the paragraph seam is found where the composition kept the repo's own opening tag", () => {
  const headSpan = `${vglue(1, "From:")} Paul, an emissary</p>`;
  const tailPara = '<p id="e-p2">To: The sacred in Ephesus</p>';
  const composed = `${vglue(1, "From:")} Paul, a sent one</p><p id="e-p2">To: The holy in Ephesus</p>`;
  const r = splitComposedAtParagraphSeam(composed, headSpan, tailPara);
  assert.equal(r.ok, true);
  assert.equal(r.head, `${vglue(1, "From:")} Paul, a sent one</p>`);
  assert.equal(r.tail, '<p id="e-p2">To: The holy in Ephesus</p>');
});

test("the seam split refuses when the composition dropped the continuation's opening tag", () => {
  const headSpan = `${vglue(1, "From:")} Paul</p>`;
  const tailPara = '<p id="e-p2">To: The sacred</p>';
  const r = splitComposedAtParagraphSeam(`${vglue(1, "From:")} Paul To: The sacred`, headSpan, tailPara);
  assert.equal(r.ok, false);
  assert.match(r.reason, /did not preserve/);
});

test("the seam split refuses an ambiguous seam", () => {
  const headSpan = `${vglue(1, "A")}</p>`;
  const tailPara = "<p>B</p>";
  const r = splitComposedAtParagraphSeam(`${vglue(1, "A")}</p><p>B</p><p>C</p>`, headSpan, tailPara);
  assert.equal(r.ok, false);
  assert.match(r.reason, /more than once/);
});

test("the seam split refuses when a verse marker moved into the continuation", () => {
  const headSpan = `${vglue(1, "A")}</p>`;
  const tailPara = '<p id="p2">B</p>';
  const composed = `${vglue(1, "A")}</p><p id="p2">${vglue(2, "B")}</p>`;
  const r = splitComposedAtParagraphSeam(composed, headSpan, tailPara);
  assert.equal(r.ok, false);
  assert.match(r.reason, /verse marker/);
});

test("the continuation paragraph carries no marker of its own", () => {
  const paras = [`<p id="p1">${vglue(1, "From:")} Paul</p>`, '<p id="p2">To: The sacred</p>'];
  const loc = locateVerseSpanInParagraphs(paras, 1);
  assert.equal(loc.spansMultipleParagraphs, true);
  assert.deepEqual(loc.paragraphIndices, [0, 1]);
  assert.equal(findVerseMarkers(paras[1]).length, 0);
});

test("missingClosers names exactly the tags a truncated paragraph lost", () => {
  assert.equal(missingClosers('<p id="a">text</p>'), "");
  assert.equal(missingClosers('<p id="a">text'), "</p>");
  assert.equal(missingClosers('<blockquote id="b"><p>one</p><p>two'), "</p></blockquote>");
  assert.equal(missingClosers("<p>text</em></p>"), "", "inline tags are not block structure");
});

test("missingClosers declines mis-nested markup rather than guessing", () => {
  assert.equal(missingClosers("<p>a</blockquote>"), null);
  assert.equal(missingClosers("</p>"), null);
});
