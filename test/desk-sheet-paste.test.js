// test/desk-sheet-paste.test.js
//
// How a sheet reads pasted or dropped HTML: pastedSheetHtml in
// src/lib/desk-sheet-format.mjs (audit BA68 and BA71, STUDY-DESK-AUDIT-1.md,
// "FA1-j"). The fixtures are shaped like what Google Docs, Microsoft Word on
// Windows and a web page or webmail really put on the clipboard (Chrome's
// StartFragment wrapper, Docs' docs-internal-guid <b>, Word's unquoted classes,
// mso-list styles and marker spans), because the bugs were in the shapes, not
// in the grammar. Whatever comes out must be the canonical form the sanitizer
// already accepts, and reading it again must change nothing.

import { test } from "node:test";
import assert from "node:assert/strict";

import { pastedSheetHtml as paste, sanitizeSheetHtml as clean } from "../src/lib/desk-sheet-format.mjs";

/** Every input the tests read, so the invariants can be held to all of them. */
const seen = [];
const read = (html) => {
  seen.push(html);
  return paste(html);
};

/* ── Google Docs ─────────────────────────────────────────────────────── */

/** Chrome's clipboard wrapper around a copied fragment. */
const chrome = (inner) => `<html><body>\n<!--StartFragment-->${inner}<!--EndFragment-->\n</body>\n</html>`;

const DOCS_GUID = `<b style="font-weight:normal;" id="docs-internal-guid-1a2b3c4d-7fff-1234-abcd-0123456789ab">`;
const DOCS_SPAN = "font-size:11pt;font-family:Arial,sans-serif;color:#000000;background-color:transparent;font-variant:normal;vertical-align:baseline;white-space:pre-wrap;";

/** A Docs paragraph of spans, each [style, text]. */
const docsP = (...spans) =>
  `<p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;">${spans
    .map(([style, text]) => `<span style="${DOCS_SPAN}${style}">${text}</span>`)
    .join("")}</p>`;

const docsLi = (text, style = "font-weight:400;") =>
  `<li dir="ltr" style="list-style-type:disc;font-size:11pt;" aria-level="1"><p dir="ltr" style="line-height:1.38;" role="presentation"><span style="${DOCS_SPAN}${style}">${text}</span></p></li>`;

const DOCS_HEADING = `<h1 dir="ltr" style="line-height:1.38;margin-top:20pt;margin-bottom:6pt;"><span style="${DOCS_SPAN}font-size:20pt;font-weight:400;">Study notes</span></h1>`;

test("Docs: a whole copy is not bold, and its headings, paragraphs and lists survive", () => {
  const html = chrome(
    `<meta charset="utf-8">${DOCS_GUID}${DOCS_HEADING}${docsP(["font-weight:400;", "Plain text"])}` +
      `<ul style="margin-top:0;padding-inline-start:48px;">${docsLi("one")}${docsLi("two", "font-weight:700;")}</ul><br /></b>`,
  );
  assert.equal(read(html), "<h2>Study notes</h2><p>Plain text</p><ul><li>one</li><li><strong>two</strong></li></ul>");
  // The sanitizer alone, which the paste path exists to improve on, bolds all of it.
  assert.match(clean(html), /^<p><strong>Study notes<br>/);
});

test("Docs: weights, italics, underline, strikethrough, superscript and subscript become tags", () => {
  const html = chrome(
    DOCS_GUID +
      docsP(
        ["font-weight:400;", "Plain, "],
        ["font-weight:700;", "bold"],
        ["font-weight:400;font-style:italic;", " italic"],
        ["font-weight:400;text-decoration:underline;-webkit-text-decoration-skip:none;text-decoration-skip-ink:none;", " under"],
        ["font-weight:400;text-decoration:line-through;", " gone"],
        ["font-weight:400;", " x"],
        ["font-weight:400;vertical-align:super;", "2"],
        ["font-weight:400;", " H"],
        ["font-weight:400;vertical-align:sub;", "2"],
        ["font-weight:400;", "O"],
      ) +
      "<br /></b>",
  );
  assert.equal(
    read(html),
    "<p>Plain, <strong>bold</strong><em> italic</em><u> under</u><s> gone</s> x<sup>2</sup> H<sub>2</sub>O</p>",
  );
});

test("Docs: underline inside a link is the link's own, and is dropped", () => {
  const link = `<a href="https://example.com/" style="text-decoration:none;"><span style="${DOCS_SPAN}color:#1155cc;font-weight:400;text-decoration:underline;-webkit-text-decoration-skip:none;">a link</span></a>`;
  const html = chrome(`${DOCS_GUID}<p dir="ltr">See ${link}</p></b>`);
  const out = read(html);
  assert.equal(out, '<p>See <a href="https://example.com/">a link</a></p>');
  assert.ok(!out.includes("<u>"));
  // Underlined text next to the link is still underlined.
  assert.equal(read(`<p><span style="text-decoration:underline;">x</span> <a href="/john-3"><span style="text-decoration:underline;">y</span></a></p>`), '<p><u>x</u> <a href="/john-3">y</a></p>');
});

test("Docs: a partial copy inside one paragraph is one plain paragraph", () => {
  const plain = `<meta charset='utf-8'><span style="${DOCS_SPAN}font-weight:400;">just a phrase</span>`;
  assert.equal(read(plain), "<p>just a phrase</p>");
  const mixed = `<meta charset='utf-8'><span style="font-weight:700;">just bold</span> and more`;
  assert.equal(read(mixed), "<p><strong>just bold</strong> and more</p>");
  // Docs' own wrapper around a fragment, with its closing line break and nothing else.
  assert.equal(read(chrome(`${DOCS_GUID}<span style="font-weight:400;">words</span><br /></b>`)), "<p>words</p>");
});

test("Docs: the copy's trailing <br> is not a paragraph", () => {
  const out = read(chrome(`${DOCS_GUID}${docsP(["font-weight:400;", "last line"])}<br /></b>`));
  assert.equal(out, "<p>last line</p>");
  assert.ok(!out.includes("<br>"));
  // An interior empty line is the writer's, and stays.
  assert.equal(read(`<p>a</p><p><br></p><p>b</p>`), "<p>a</p><p><br></p><p>b</p>");
});

/* ── <b> as a wrapper ────────────────────────────────────────────────── */

test("a <b> whose weight is normal or 400 is unwrapped; any other <b> is bold", () => {
  assert.equal(read(`<b style="font-weight:400"><p>a</p></b>`), "<p>a</p>");
  assert.equal(read(`<b style="font-weight: normal;"><p>a</p></b>`), "<p>a</p>");
  assert.equal(read(`<p>x <b style="font-weight:400">a</b></p>`), "<p>x a</p>");
  assert.equal(read(`<p><b>a</b></p>`), "<p><strong>a</strong></p>");
  assert.equal(read(`<p><b style="font-weight:bold">a</b></p>`), "<p><strong>a</strong></p>");
  assert.equal(read(`<p><b style="font-weight:700">a</b></p>`), "<p><strong>a</strong></p>");
  assert.equal(read(`<p><strong>a</strong></p>`), "<p><strong>a</strong></p>");
});

/* ── A div that wraps blocks ─────────────────────────────────────────── */

test("a div holding blocks is a wrapper: headings and lists are kept", () => {
  assert.equal(read(`<div><h2>H</h2><p>a</p><ul><li>x</li></ul></div>`), "<h2>H</h2><p>a</p><ul><li>x</li></ul>");
  // Webmail: nested divs, with the blocks a level or two down.
  assert.equal(
    read(`<div dir="ltr" class="gmail_default"><div><h3>H</h3><div><p>a</p></div></div></div>`),
    "<h3>H</h3><p>a</p>",
  );
  // A section between the div and the blocks, as in a web page.
  assert.equal(
    read(chrome(`<div class="post"><section class="body"><h2>H</h2><ol><li>x</li><li>y</li></ol></section></div>`)),
    "<h2>H</h2><ol><li>x</li><li>y</li></ol>",
  );
});

test("a div holding only inline text is still one paragraph", () => {
  assert.equal(read(`<div>just <b>text</b></div>`), "<p>just <strong>text</strong></p>");
  assert.equal(read(`<div>just <b>text</b></div>`), clean(`<div>just <b>text</b></div>`));
  assert.equal(read(`<div dir="ltr">one</div><div dir="ltr">two</div>`), "<p>one</p><p>two</p>");
});

/* ── Word ────────────────────────────────────────────────────────────── */

const WORD_HEAD =
  `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset=utf-8>` +
  `<style><!-- p.MsoNormal {margin:0in} --></style></head><body lang=EN-US style='tab-interval:.5in'>\n<!--StartFragment-->`;
const word = (inner) => `${WORD_HEAD}<div class=WordSection1>\n${inner}</div><!--EndFragment--></body></html>`;

const MSO_NORMAL = `<p class=MsoNormal>Intro <b>text</b><o:p></o:p></p>\n`;

/** A list paragraph as Word writes it: its position in `style`, its marker in an Ignore span. */
function item(level, text, { marker = "·", pos = "Middle", list = 0, font = "Symbol" } = {}) {
  return (
    `<p class=MsoListParagraphCxSp${pos} style='text-indent:-.25in;mso-list:l${list} level${level} lfo1'>` +
    `<![if !supportLists]><span style='font-family:${font};mso-fareast-font-family:Symbol;mso-bidi-font-family:Symbol'>` +
    `<span style='mso-list:Ignore'>${marker}<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; </span></span></span><![endif]>` +
    `${text}<o:p></o:p></p>\n`
  );
}

test("Word: bullets become a ul, with nesting by level and no typed markers", () => {
  const html = word(
    MSO_NORMAL +
      item(1, "one", { pos: "First" }) +
      item(1, "<b>two</b>") +
      item(2, "two-a", { marker: "o", font: '"Courier New"' }) +
      item(2, "two-b", { marker: "§", font: "Wingdings" }) +
      item(1, "<i>three</i>", { pos: "Last" }),
  );
  const out = read(html);
  assert.equal(
    out,
    "<p>Intro <strong>text</strong></p><ul><li>one</li><li><strong>two</strong><ul><li>two-a</li><li>two-b</li></ul></li><li><em>three</em></li></ul>",
  );
  for (const gone of ["·", "§", "&nbsp;", " ", "o:p", "Times New Roman", "mso"]) assert.ok(!out.includes(gone), gone);
});

test("Word: numbers and letters become an ol, nested by level", () => {
  const html = word(
    item(1, "first", { marker: "1.", pos: "First", list: 1 }) +
      item(1, "second", { marker: "2.", list: 1 }) +
      item(2, "sub", { marker: "a.", list: 1 }) +
      item(3, "subsub", { marker: "i.", list: 1 }) +
      item(1, "third", { marker: "(a)", pos: "Last", list: 1 }),
  );
  assert.equal(
    read(html),
    "<ol><li>first</li><li>second<ol><li>sub<ol><li>subsub</li></ol></li></ol></li><li>third</li></ol>",
  );
});

test("Word: a bullet list can hold a numbered one", () => {
  const html = word(item(1, "a", { pos: "First" }) + item(2, "b", { marker: "1.", list: 1 }) + item(2, "c", { marker: "2.", list: 1 }) + item(1, "d", { pos: "Last" }));
  assert.equal(read(html), "<ul><li>a<ol><li>b</li><li>c</li></ol></li><li>d</li></ul>");
});

test("Word: a list that starts at level 2 still comes out well-formed", () => {
  const out = read(word(item(2, "deep", { pos: "First" }) + item(1, "top", { pos: "Last" })));
  assert.equal(out, "<ul><li><ul><li>deep</li></ul></li><li>top</li></ul>");
  assert.equal(clean(out), out);
});

test("Word: a normal paragraph between two runs makes two lists", () => {
  const html = word(
    item(1, "a", { pos: "First" }) + item(1, "b", { pos: "Last" }) + MSO_NORMAL + item(1, "c", { pos: "First" }) + item(1, "d", { pos: "Last" }),
  );
  assert.equal(read(html), "<ul><li>a</li><li>b</li></ul><p>Intro <strong>text</strong></p><ul><li>c</li><li>d</li></ul>");
});

test("Word: a List Paragraph with no numbering and no marker stays a paragraph", () => {
  assert.equal(read(word(`<p class=MsoListParagraph>No list here<o:p></o:p></p>\n` + MSO_NORMAL)), "<p>No list here</p><p>Intro <strong>text</strong></p>");
  // Beside a real list it is still a paragraph, after it.
  assert.equal(
    read(word(item(1, "a", { pos: "First" }) + item(1, "b", { pos: "Last" }) + `<p class=MsoListParagraph>Aside</p>\n`)),
    "<ul><li>a</li><li>b</li></ul><p>Aside</p>",
  );
});

test("Word: a copy of a single list item is a one-item list", () => {
  const out = read(word(item(1, "only", { pos: "First" })));
  assert.equal(out, "<ul><li>only</li></ul>");
});

/* ── Invariants ──────────────────────────────────────────────────────── */

test("canonical sheet html passes through unchanged", () => {
  const canonical = [
    `<h2>T</h2><p data-align="center">a <strong>b</strong> <span data-color="red">c</span></p><ul><li>x</li></ul>`,
    `<h3>H</h3><blockquote><p>q</p></blockquote><hr><ol><li>one<ul><li>nested</li></ul></li></ol>`,
    `<p>x<sup>2</sup> <a href="/john-3">link</a><br>next</p>`,
  ];
  for (const html of canonical) assert.equal(read(html), html);
});

test("anything that isn't a non-empty string reads as empty", () => {
  for (const v of ["", undefined, null, 5, {}, [], ["<p>a</p>"]]) assert.equal(paste(v), "");
});

test("scripts, styles, classes and handlers never survive", () => {
  const out = read(
    chrome(
      `<style>p { color: red }</style><script>alert(1)</script><p class="x" style="color:red;font-weight:700" onclick="steal()">b</p>` +
        `<div class=WordSection1><script>alert(2)</script><p class="y" id="z">c</p></div>`,
    ),
  );
  // The paragraph's own weight is not a span's, so nothing is made bold from it.
  assert.equal(out, "<p>b</p><p>c</p>");
  for (const bad of ["alert", "script", "style", "class", "onclick", "color"]) assert.ok(!out.includes(bad), bad);
});

test("every fixture reads to a canonical form that reads to itself", () => {
  assert.ok(seen.length > 20, "the invariants need the fixtures above to have run");
  for (const html of seen) {
    const out = paste(html);
    assert.equal(clean(out), out, `not canonical: ${JSON.stringify(out)}`);
    assert.equal(paste(out), out, `not stable: ${JSON.stringify(out)}`);
  }
});
