import test from "node:test";
import assert from "node:assert/strict";

import {
  findVerseMarkers,
  locateVerseSpanInParagraphs,
  splitTrailingBlockClose,
  splitTrailingSeparator,
  splitComposedAtParagraphSeam,
  findUnseparatedVerseMarkers,
  opensWithContinuationText,
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

// A continuation paragraph usually goes on to OPEN a later verse, so "has no
// verse marker" was never the right test for one. It found 122 of the corpus's
// 208 continuations, and the other 86 were not merely unhandled but silently
// mis-handled - the verse read as single-paragraph, so a restore wrote the
// master's whole verse into the head block and left the continuation text
// standing in the next one. hebrews-2:8 and hebrews-8:8 shipped that way, each
// printing its continuation sentence twice.
test("a continuation paragraph is recognized even when it opens a later verse", () => {
  const paras = [
    `<blockquote id="p1" class="hbq"><p class="hbq-line">${vglue(8, "you")} arranged it.”</p></blockquote>`,
    `<p id="p2">You see, with the arrangement of it. ${vglue(9, "but")} we see Jesus.</p>`,
  ];
  const loc = locateVerseSpanInParagraphs(paras, 8);
  assert.equal(loc.spansMultipleParagraphs, true, "verse 8 continues into p2 ahead of verse 9's marker");
  assert.deepEqual(loc.paragraphIndices, [0, 1]);
});

test("a paragraph that opens straight onto its own marker is not a continuation", () => {
  const paras = [
    `<p id="p1">${vglue(1, "One")} word.</p>`,
    `<p id="p2">${vglue(2, "Two")} words.</p>`,
  ];
  const loc = locateVerseSpanInParagraphs(paras, 1);
  assert.equal(loc.spansMultipleParagraphs, false);
  assert.equal(loc.paragraphIndex, 0);
});

// A bracketed passage opens `⟦` + the footnote anchor explaining it, and both
// belong to the verse whose marker FOLLOWS them - john-11-p16 opens verse 28,
// it does not continue verse 27.
test("a bracket marker and its footnote anchor do not make a paragraph a continuation", () => {
  const fnref = '<sup class="fn-ref"><a id="fnref-w" href="#fn-w" role="doc-noteref">w</a></sup>';
  assert.equal(opensWithContinuationText(`<p id="p2">⟦${fnref}${vglue(28, "After")} she said this.</p>`), false);
  assert.equal(opensWithContinuationText(`<p id="p2">She said this. ${vglue(28, "After")} that.</p>`), true);
  assert.equal(opensWithContinuationText('<p id="p2">plain continuation</p>'), true);
  assert.equal(opensWithContinuationText('<p id="p2"></p>'), false);
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

// The separator between one verse and the next lives INSIDE the earlier
// verse's span, because that span ends at the next verse's marker. The master
// has no separator to contribute, so a restore that does not split it off
// eats it - 135 markers across the two restore PRs did exactly that.

test("a verse's span includes the space separating it from the next marker", () => {
  const paras = [`<p id="x-p1">${vglue(1, "One")} word. ${vglue(2, "Two")} words.</p>`];
  const loc = locateVerseSpanInParagraphs(paras, 1);
  const span = paras[0].slice(loc.start, loc.end);
  assert.ok(span.endsWith(" "), "the span really does end with the separator");
  const { body, sep } = splitTrailingSeparator(span);
  assert.equal(sep, " ");
  assert.equal(body + sep, span, "recomposing is lossless");
});

test("the two splitters divide the work: closing tags take their own whitespace", () => {
  // A LAST verse never leaked, because splitTrailingBlockClose's match already
  // reaches back over the whitespace before the tag. Only a verse followed by
  // another marker in the same paragraph ends in bare whitespace, and that is
  // the case splitTrailingSeparator exists for.
  const last = "text. </p>";
  const { body: lastBody, close } = splitTrailingBlockClose(last);
  assert.equal(close, " </p>", "the closer carries the whitespace with it");
  assert.deepEqual(splitTrailingSeparator(lastBody), { body: "text.", sep: "" }, "nothing left to peel");
  assert.equal(lastBody + close, last, "recomposing is lossless");

  const middle = "text. ";
  const { body: midBody, close: midClose } = splitTrailingBlockClose(middle);
  assert.equal(midClose, "", "no closing tag to find");
  const { body, sep } = splitTrailingSeparator(midBody);
  assert.equal(body, "text.");
  assert.equal(sep, " ");
  assert.equal(body + sep + midClose, middle, "content + sep + close rebuilds the span");
});

test("splitTrailingSeparator is a no-op when there is nothing to peel", () => {
  assert.deepEqual(splitTrailingSeparator("text."), { body: "text.", sep: "" });
  assert.deepEqual(splitTrailingSeparator(""), { body: "", sep: "" });
  assert.deepEqual(splitTrailingSeparator(null), { body: "", sep: "" });
});

test("findUnseparatedVerseMarkers flags a marker welded to the previous sentence", () => {
  const paras = [`<p id="x-p1">${vglue(1, "One")} word.${vglue(2, "Two")} words.</p>`];
  const hits = findUnseparatedVerseMarkers(paras);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].verse, 2);
  assert.equal(hits[0].paragraphIndex, 0);
});

test("findUnseparatedVerseMarkers accepts a marker that opens its own block", () => {
  const paras = [
    `<p id="x-p1">${vglue(1, "One")} word.</p>`,
    `<blockquote id="x-p2" class="hbq"><p class="hbq-line">${vglue(2, "Two")} words.</p></blockquote>`,
  ];
  assert.deepEqual(findUnseparatedVerseMarkers(paras), [], "an opening tag is separator enough");
});

test("findUnseparatedVerseMarkers tolerates empty and missing input", () => {
  assert.deepEqual(findUnseparatedVerseMarkers([]), []);
  assert.deepEqual(findUnseparatedVerseMarkers(undefined), []);
  assert.deepEqual(findUnseparatedVerseMarkers([""]), []);
});
