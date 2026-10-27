// test/desk-sheets.test.js
//
// The sheet record (STUDY-DESK-FORMAT.md, "Sheets (kind 9)"): the sanitizer in
// src/lib/desk-sheet-format.mjs, the check a sheet must pass, the operations in
// src/lib/desk-sheets.mjs, and how a sheet travels through the notebook's
// store plans and history. The sanitizer is security-relevant, so it gets the
// most: its allowlist, the dangerous links, the nesting rules, and a seeded
// fuzz that holds every output to the canonical grammar and to idempotence.
// The merge rules for sheets are in test/fixtures/merge-vectors.json.

import { test } from "node:test";
import assert from "node:assert/strict";

import { canEdit, createRecord, validateRecord } from "../src/lib/desk-records.mjs";
import {
  ALIGNMENTS,
  HINTS,
  MODULE_TYPES,
  SHEET_FORMAT,
  SHEET_LIMITS,
  SPAN_STYLES,
  cleanSheetText,
  sanitizeSheetHtml as clean,
  validateSheet,
} from "../src/lib/desk-sheet-format.mjs";
import {
  addModule,
  createSheet,
  makeModule,
  moveModule,
  planSheetChange,
  removeModule,
  setSheetFields,
  sheetTooBig,
  updateModule,
} from "../src/lib/desk-sheets.mjs";
import { describeEntry, inversePlan, makeEntry, redoPlan, stillCurrent } from "../src/lib/desk-history.mjs";
import { planDelete, planSave, planUndo, planWrite } from "../src/lib/desk-store-core.mjs";

const VERSION = "v20261012.1a2b3c4d";
const T0 = "2026-10-12T09:00:00.000Z";
const T1 = "2026-10-12T10:00:00.000Z";
const T2 = "2026-10-12T11:00:00.000Z";
const ctx = { client: "web/2026.10", contentVersion: VERSION };

let counter = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

/* ── The sanitizer: what it keeps ────────────────────────────────────── */

/** Inputs that are already canonical: each must come back byte for byte. */
const CANONICAL = [
  "",
  "<p>Plain text</p>",
  '<p data-align="center">Centered</p>',
  '<p data-align="right">Right</p>',
  '<p data-align="justify">Justified</p>',
  "<h2>Heading</h2>",
  '<h3 data-align="center">Subheading</h3>',
  "<blockquote><p>Quoted</p><ul><li>one</li></ul><ol><li>two</li></ol></blockquote>",
  "<hr>",
  "<p>a</p><hr><p>b</p>",
  "<ul><li>one</li><li>two<ul><li>nested</li></ul></li></ul>",
  "<ol><li>one<ol><li>two<ul><li>three</li></ul></li></ol></li></ol>",
  "<p><strong>b</strong> <em>i</em> <u>u</u> <s>s</s> x<sup>2</sup> H<sub>2</sub>O</p>",
  "<p><strong>bold <em>and italic</em></strong></p>",
  '<p>A <a href="https://litbible.net/read/">link</a> and <a href="mailto:a@b.org">mail</a> and <a href="/romans-8/#v3">path</a>.</p>',
  "<p>line one<br>line two</p>",
  "<p><br></p>",
  "<p>a &amp; b &lt;c&gt; “quoted” — dash…</p>",
  '<p><span data-font="handwriting" data-size="large" data-color="red" data-mark="yellow">All four</span> and <span data-color="blue">one</span></p>',
  '<p><span data-size="small">a <em>b</em></span> <a href="/x"><span data-mark="pink">c</span></a></p>',
  "<p>é is not canonical, é is</p>".replace("é", "é"),
];

test("canonical text comes back as it went in", () => {
  for (const html of CANONICAL) assert.equal(clean(html), html, html);
});

test("a value that isn't a string is empty text", () => {
  for (const v of [undefined, null, 5, {}, [], true]) assert.equal(clean(v), "");
});

test("the constants are what the format names", () => {
  assert.equal(SHEET_FORMAT, 1);
  assert.deepEqual([...MODULE_TYPES], ["passage", "text", "question", "space", "keyTerms", "pageBreak"]);
  assert.deepEqual([...HINTS], ["none", "traditional", "custom"]);
  assert.deepEqual([...ALIGNMENTS], ["center", "right", "justify"]);
  assert.deepEqual({ ...SHEET_LIMITS }, { bytes: 524288, modules: 300, title: 200, subtitle: 200, hintText: 100, questionLines: 20, spaceLines: 40 });
  for (const o of [MODULE_TYPES, HINTS, ALIGNMENTS, SHEET_LIMITS]) assert.ok(Object.isFrozen(o));
});

test("tags are mapped: div, b, i, h1, h4 to h6, strike, del, ins", () => {
  assert.equal(clean("<div>x</div>"), "<p>x</p>");
  assert.equal(clean("<b>x</b>"), "<p><strong>x</strong></p>");
  assert.equal(clean("<i>x</i>"), "<p><em>x</em></p>");
  assert.equal(clean("<h1>x</h1>"), "<h2>x</h2>");
  for (const h of ["h4", "h5", "h6"]) assert.equal(clean(`<${h}>x</${h}>`), "<h3>x</h3>");
  assert.equal(clean("<p><strike>x</strike><del>y</del></p>"), "<p><s>xy</s></p>");
  assert.equal(clean("<p><ins>x</ins></p>"), "<p><u>x</u></p>");
  assert.equal(clean("<P>Upper <STRONG>case</STRONG></P>"), "<p>Upper <strong>case</strong></p>");
});

test("other tags are unwrapped and their text kept", () => {
  assert.equal(clean("<p>a <span>b</span> <font color=red>c</font></p>"), "<p>a b c</p>");
  assert.equal(clean("<section><article>x</article></section>"), "<p>x</p>");
  assert.equal(clean("<p>a<img src=x onerror=alert(1)>b</p>"), "<p>ab</p>");
  assert.equal(clean("<table><tr><td>a</td><td>b</td></tr><tr><td>c</td></tr></table>"), "<p>ab</p><p>c</p>");
  assert.equal(clean("<custom-element>x</custom-element>"), "<p>x</p>");
  assert.equal(clean("<p>a<wbr>b</p>"), "<p>ab</p>");
});

test("script, style, svg and the like are dropped with their contents", () => {
  assert.equal(clean("<p>a</p><script>alert('x')</script><p>b</p>"), "<p>a</p><p>b</p>");
  assert.equal(clean("<style>p { color: red }</style><p>a</p>"), "<p>a</p>");
  assert.equal(clean("<p>a<svg><text>t</text><svg><g>u</g></svg>v</svg>b</p>"), "<p>ab</p>");
  assert.equal(clean("<math><mi>x</mi></math><p>a</p>"), "<p>a</p>");
  assert.equal(clean("<p>a</p><iframe src=x>fallback</iframe>"), "<p>a</p>");
  assert.equal(clean("<p>a</p><object data=x>fallback</object><embed src=y>"), "<p>a</p>");
  assert.equal(clean("<p>a</p><template><p>t</p></template><noscript>n</noscript>"), "<p>a</p>");
  assert.equal(clean("<textarea><p>x</p></textarea><select><option>o</option></select><button>b</button><p>c</p>"), "<p>c</p>");
  assert.equal(clean("<head><title>t</title></head><p>a</p>"), "<p>a</p>");
  assert.equal(clean("<input value=x><p>a</p>"), "<p>a</p>");
  assert.equal(clean("<SCRIPT>1</SCRIPT><p>a</p>"), "<p>a</p>");
  assert.equal(clean('<script>var a = "</p>";</script><p>b</p>'), "<p>b</p>");
});

test("an unclosed script or svg drops everything after it", () => {
  assert.equal(clean("<p>a</p><script>alert(1)"), "<p>a</p>");
  assert.equal(clean("<p>a</p><svg><p>b</p>"), "<p>a</p>");
  assert.equal(clean("<p>a</p><style>p{"), "<p>a</p>");
});

test("comments, declarations and processing instructions are dropped", () => {
  assert.equal(clean("<!-- hi --><p>a</p>"), "<p>a</p>");
  assert.equal(clean("<p>a<!-- <b>x</b> -->b</p>"), "<p>ab</p>");
  assert.equal(clean("<p>a</p><!-- never closed <p>b</p>"), "<p>a</p>");
  assert.equal(clean("<!DOCTYPE html><p>a</p>"), "<p>a</p>");
  assert.equal(clean('<?xml version="1.0"?><p>a</p>'), "<p>a</p>");
});

test("attributes other than href and the alignment are dropped", () => {
  assert.equal(clean('<p onclick="x()" style="color:red" class="c" id="i" title="t">a</p>'), "<p>a</p>");
  assert.equal(clean('<strong onmouseover="x()" class=c>a</strong>'), "<p><strong>a</strong></p>");
  assert.equal(clean('<a href="/x" onclick="x()" target="_blank" rel="noopener" class="c" style="x:y">a</a>'), '<p><a href="/x">a</a></p>');
  assert.equal(clean('<ul class="l" style="x"><li id="i" onclick="x()">a</li></ul>'), "<ul><li>a</li></ul>");
  assert.equal(clean("<p data-other=1 data-x>a</p>"), "<p>a</p>");
});

/* ── Links ───────────────────────────────────────────────────────────── */

test("a link keeps an http, https, mailto or site-path address", () => {
  for (const href of ["https://example.org/a?b=1", "http://example.org", "mailto:a@b.org", "/romans-8/", "/romans-8/#v3", "/", "HTTPS://EXAMPLE.ORG", "MailTo:a@b.org"]) {
    assert.equal(clean(`<a href="${href}">x</a>`), `<p><a href="${href}">x</a></p>`, href);
  }
  assert.equal(clean("<a href=https://example.org/a>x</a>"), '<p><a href="https://example.org/a">x</a></p>', "unquoted");
  assert.equal(clean("<a href='https://example.org/a'>x</a>"), '<p><a href="https://example.org/a">x</a></p>', "single quoted");
  assert.equal(clean("<a href=\"  https://example.org/a  \">x</a>"), '<p><a href="https://example.org/a">x</a></p>', "trimmed");
  assert.equal(clean('<a href="https://e.org/?a=1&amp;b=2&quot;">x</a>'), '<p><a href="https://e.org/?a=1&amp;b=2&quot;">x</a></p>', "escaped");
});

test("a link to anything else loses the link and keeps the text", () => {
  const bad = [
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    " javascript:alert(1)",
    "jav&#x61;script:alert(1)",
    "jav&#97;script:alert(1)",
    "java\tscript:alert(1)",
    "java&#9;script:alert(1)",
    "java\nscript:alert(1)",
    "\u0001javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "//evil.com",
    "/\\evil.com",
    "/ /evil.com",
    "file:///etc/passwd",
    "ftp://example.org",
    "tel:+1555",
    "example.org",
    "relative/path",
    "#anchor",
    "?q=1",
    "",
  ];
  for (const href of bad) {
    const out = clean(`<p><a href="${href}">label</a></p>`);
    assert.equal(out, "<p>label</p>", JSON.stringify(href));
  }
  assert.equal(clean("<a>no href</a>"), "<p>no href</p>");
  assert.equal(clean("<a href>empty</a>"), "<p>empty</p>");
});

test("a link's address is checked after entities are decoded, and what is kept is what was checked", () => {
  const out = clean('<a href="&#x6A;avascript:alert(1)">a</a><a href="https://e.org/a&#9;b">b</a>');
  assert.equal(out, '<p>a<a href="https://e.org/ab">b</a></p>');
  assert.equal(clean('<a href="/a&quot;onmouseover=&quot;x">q</a>'), '<p><a href="/a&quot;onmouseover=&quot;x">q</a></p>');
});

test("an a inside an a is unwrapped", () => {
  assert.equal(clean('<p><a href="/x">a<a href="/y">b</a>c</a></p>'), '<p><a href="/x">abc</a></p>');
  assert.equal(clean('<p><a href="/x"><em><a href="/y">b</a></em></a></p>'), '<p><a href="/x"><em>b</em></a></p>');
});

/* ── Named styles on a span ──────────────────────────────────────────── */

test("the named styles are the format's lists, frozen", () => {
  assert.deepEqual(
    { font: [...SPAN_STYLES.font], size: [...SPAN_STYLES.size], color: [...SPAN_STYLES.color], mark: [...SPAN_STYLES.mark] },
    {
      font: ["sans", "serif", "display", "handwriting", "atkinson"],
      size: ["small", "large", "larger"],
      color: ["red", "blue", "green", "purple", "gray"],
      mark: ["yellow", "green", "blue", "pink"],
    },
  );
  for (const o of [SPAN_STYLES, ...Object.values(SPAN_STYLES)]) assert.ok(Object.isFrozen(o));
});

test("a span keeps its valid names, written in the order font, size, color, mark", () => {
  for (const [k, list] of Object.entries(SPAN_STYLES)) {
    for (const v of list) assert.equal(clean(`<p>a<span data-${k}="${v}">b</span></p>`), `<p>a<span data-${k}="${v}">b</span></p>`, `${k}=${v}`);
  }
  assert.equal(
    clean('<p><span data-mark="pink" data-color="blue" data-size="small" data-font="atkinson">x</span></p>'),
    '<p><span data-font="atkinson" data-size="small" data-color="blue" data-mark="pink">x</span></p>',
  );
  assert.equal(clean('<p><span data-color=" RED ">x</span></p>'), '<p><span data-color="red">x</span></p>');
  assert.equal(clean('<span data-color="red">loose</span>'), '<p><span data-color="red">loose</span></p>');
});

test("a span's other attributes are dropped, and CSS values are never turned into names", () => {
  assert.equal(
    clean('<p><span data-color="red" style="color:blue" class="x" id="i" onclick="x()" color="green">a</span></p>'),
    '<p><span data-color="red">a</span></p>',
  );
  assert.equal(clean('<p><span style="color:red; font-size:2em; background:yellow; font-family:serif">a</span></p>'), "<p>a</p>");
  assert.equal(clean('<p><span class="red" color="red" data-other="red">a</span></p>'), "<p>a</p>");
  assert.equal(clean('<p><font color="red" size="5" face="serif">a</font></p>'), "<p>a</p>");
  assert.equal(clean('<p><mark data-mark="yellow">a</mark></p>'), "<p>a</p>");
  assert.equal(clean('<p><strong data-color="red">a</strong></p>'), "<p><strong>a</strong></p>");
});

test("a style outside its list is dropped, and a span left with none is unwrapped", () => {
  assert.equal(clean('<p><span data-color="orange">a</span></p>'), "<p>a</p>");
  assert.equal(clean('<p><span data-color="#f00">a</span></p>'), "<p>a</p>");
  assert.equal(clean('<p><span data-mark="red" data-font="comic">a</span></p>'), "<p>a</p>");
  assert.equal(clean('<p><span data-font="comic" data-size="large">a</span></p>'), '<p><span data-size="large">a</span></p>');
  assert.equal(clean('<p><span data-size="small" data-color="">a</span></p>'), '<p><span data-size="small">a</span></p>');
  assert.equal(clean("<p><span>a <em>b</em></span></p>"), "<p>a <em>b</em></p>");
  assert.equal(clean('<p><span data-color="red" data-color="blue">a</span></p>'), '<p><span data-color="red">a</span></p>', "the first of a repeated attribute counts");
  assert.equal(clean('<p><span data-color="bogus" data-color="red">a</span></p>'), "<p>a</p>");
});

test("nested spans with nothing between them become one, however deep, the inner winning", () => {
  assert.equal(clean('<p><span data-color="red"><span data-mark="pink">x</span></span></p>'), '<p><span data-color="red" data-mark="pink">x</span></p>');
  assert.equal(
    clean('<p><span data-color="red" data-size="large"><span data-color="blue">x</span></span></p>'),
    '<p><span data-size="large" data-color="blue">x</span></p>',
  );
  assert.equal(
    clean('<p><span data-font="serif"><span data-color="red"><span data-color="green" data-mark="yellow"><span data-size="small">x</span></span></span></span></p>'),
    '<p><span data-font="serif" data-size="small" data-color="green" data-mark="yellow">x</span></p>',
  );
  assert.equal(clean('<p><span data-color="red"><span style="x"><span data-mark="pink">x</span></span></span></p>'), '<p><span data-color="red" data-mark="pink">x</span></p>');
  assert.equal(
    clean('<p><span data-color="red"> <span data-mark="pink">x</span> </span></p>'),
    '<p><span data-color="red" data-mark="pink">x</span></p>',
    "whitespace at the edges of a block is trimmed first, leaving the inner span the only child",
  );
  // Something else beside the inner span keeps the nesting.
  const kept = '<p><span data-color="red"><span data-mark="pink">x</span> y</span></p>';
  assert.equal(clean(kept), kept);
  const viaEm = '<p><span data-color="red"><em><span data-mark="pink">x</span></em></span></p>';
  assert.equal(clean(viaEm), viaEm);
  const deep = '<span data-size="large">'.repeat(60) + "x" + "</span>".repeat(60);
  assert.equal(clean(deep), '<p><span data-size="large">x</span></p>');
});

test("adjacent spans with identical styles are joined; different styles are not", () => {
  assert.equal(clean('<p><span data-color="red">a</span><span data-color="red">b</span></p>'), '<p><span data-color="red">ab</span></p>');
  assert.equal(
    clean('<p><span data-color="red" data-size="large">a</span><span data-size="large" data-color="red">b</span></p>'),
    '<p><span data-size="large" data-color="red">ab</span></p>',
  );
  const apart = '<p><span data-color="red">a</span><span data-color="blue">b</span></p>';
  assert.equal(clean(apart), apart);
  const subset = '<p><span data-color="red">a</span><span data-size="large" data-color="red">b</span></p>';
  assert.equal(clean(subset), subset);
  const spaced = '<p><span data-color="red">a</span> <span data-color="red">b</span></p>';
  assert.equal(clean(spaced), spaced);
  assert.equal(
    clean('<p><span data-color="red">a</span><span style="x">m</span><span data-color="red">b</span></p>'),
    '<p><span data-color="red">a</span>m<span data-color="red">b</span></p>',
    "an unwrapped span leaves its text between",
  );
  assert.equal(clean('<p><span data-color="red"><em>a</em></span><span data-color="red"><em>b</em></span></p>'), '<p><span data-color="red"><em>ab</em></span></p>');
});

test("a span with no text and no break is dropped, like any empty inline element", () => {
  assert.equal(clean('<p>a<span data-color="red"></span>b</p>'), "<p>ab</p>");
  assert.equal(clean('<p><span data-color="red"><em></em></span></p>'), "");
  assert.equal(clean('<p>a<span data-color="red"> </span>b</p>'), "<p>a b</p>");
  const withBreak = '<p>a<span data-color="red"><br></span>b</p>';
  assert.equal(clean(withBreak), withBreak);
  assert.equal(clean('<p>a<span data-color="red"><br></span></p>'), "<p>a</p>");
  assert.equal(clean('<p><span data-color="red">a</span><span data-color="blue"></span><span data-color="red">b</span></p>'), '<p><span data-color="red">ab</span></p>');
});

test("spans nest in any order with the other inline tags, inside or outside a link", () => {
  for (const html of [
    '<p><span data-color="red"><strong>a</strong></span><strong><span data-color="red">b</span></strong></p>',
    '<p><em><span data-mark="yellow">a <sub>b</sub></span></em></p>',
    '<p><a href="/x"><span data-color="red">a</span></a></p>',
    '<p><span data-color="red"><a href="/x">a</a></span></p>',
    '<ul><li><span data-size="small">a</span><ul><li><span data-size="large">b</span></li></ul></li></ul>',
    '<h2><span data-font="display">Title</span></h2>',
  ]) assert.equal(clean(html), html);
  assert.equal(clean('<p><span data-color="red"><a href="/x">a<a href="/y">b</a></a></span></p>'), '<p><span data-color="red"><a href="/x">ab</a></span></p>');
});

test("a span is inline only: a block inside it is unwrapped, and it takes no alignment", () => {
  assert.equal(clean('<span data-color="red"><p>a</p><p>b</p></span>'), '<p><span data-color="red">a<br>b</span></p>');
  assert.equal(clean('<p><span data-color="red" data-align="center">a</span></p>'), '<p><span data-color="red">a</span></p>');
  assert.equal(clean('<span data-color="red" data-align="center" style="text-align:right">a</span>'), '<p><span data-color="red">a</span></p>');
  assert.equal(clean('<blockquote><span data-color="red">a</span></blockquote>'), '<blockquote><p><span data-color="red">a</span></p></blockquote>');
});

test("the inline depth cap still applies to spans", () => {
  const colors = ["red", "blue"];
  let html = "x";
  for (let i = 0; i < 100; i++) html = `<span data-color="${colors[i % 2]}"><em>${html}</em></span>`;
  const out = clean(html);
  assert.ok(out.includes("x"));
  assert.equal(clean(out), out);
});

test("validateSheet accepts canonical span html in text, question and answer, and refuses the rest", () => {
  const canonical = '<p><span data-font="serif" data-color="red">Read</span> slowly.</p>';
  assert.deepEqual(validateRecord(withModule({ id: "t", type: "text", html: canonical })), []);
  assert.deepEqual(validateRecord(withModule({ id: "q", type: "question", html: canonical, answer: canonical, lines: 2 })), []);
  for (const html of [
    '<p><span style="color:red">x</span></p>',
    '<p><span data-color="orange">x</span></p>',
    '<p><span data-color="red" data-font="serif">x</span></p>',
    '<p><span data-color="red"><span data-mark="pink">x</span></span></p>',
    "<p><span>x</span></p>",
  ]) {
    assert.ok(hasProblem(withModule({ id: "t", type: "text", html }), /formatted-text form/), html);
    assert.ok(hasProblem(withModule({ id: "q", type: "question", html: canonical, answer: html, lines: 0 }), /answer is not in the sheet's/), html);
  }
  const made = makeModule("text", { html: '<p><span data-mark="pink" data-font="serif">x</span></p>' }, { id: "t" });
  assert.equal(made.html, '<p><span data-font="serif" data-mark="pink">x</span></p>');
});

/* ── Alignment ───────────────────────────────────────────────────────── */

test("alignment comes from data-align, align, or style, in that order", () => {
  assert.equal(clean('<p data-align="center">a</p>'), '<p data-align="center">a</p>');
  assert.equal(clean('<p data-align="CENTER ">a</p>'), '<p data-align="center">a</p>');
  assert.equal(clean('<p align="right">a</p>'), '<p data-align="right">a</p>');
  assert.equal(clean('<p style="text-align:justify">a</p>'), '<p data-align="justify">a</p>');
  assert.equal(clean('<p style="color:red; TEXT-ALIGN : Center !important; margin:0">a</p>'), '<p data-align="center">a</p>');
  assert.equal(clean('<p data-align="center" align="right" style="text-align:justify">a</p>'), '<p data-align="center">a</p>');
  assert.equal(clean('<p align="right" style="text-align:justify">a</p>'), '<p data-align="right">a</p>');
  assert.equal(clean('<h2 style="text-align:right">a</h2><h3 align="center">b</h3>'), '<h2 data-align="right">a</h2><h3 data-align="center">b</h3>');
  assert.equal(clean('<div style="text-align:center">a</div>'), '<p data-align="center">a</p>');
  assert.equal(clean('<h1 align="center">a</h1>'), '<h2 data-align="center">a</h2>');
});

test("left and anything else is no attribute", () => {
  for (const v of ["left", "start", "end", "middle", "", "inherit", "center center", "1"]) {
    assert.equal(clean(`<p data-align="${v}">a</p>`), "<p>a</p>", v);
    assert.equal(clean(`<p style="text-align:${v}">a</p>`), "<p>a</p>", v);
  }
});

test("alignment is kept on p, h2 and h3 only", () => {
  assert.equal(clean('<blockquote><h2 data-align="center">a</h2><p data-align="right">b</p></blockquote>'), '<blockquote><p>a</p><p data-align="right">b</p></blockquote>');
  assert.equal(clean('<ul data-align="center"><li data-align="center">a</li></ul>'), "<ul><li>a</li></ul>");
  assert.equal(clean('<p><strong data-align="center">a</strong></p>'), "<p><strong>a</strong></p>");
});

/* ── Nesting ─────────────────────────────────────────────────────────── */

test("loose text and inline runs at the top are wrapped in a paragraph", () => {
  assert.equal(clean("hello"), "<p>hello</p>");
  assert.equal(clean("a<strong>b</strong>c"), "<p>a<strong>b</strong>c</p>");
  assert.equal(clean("a<p>b</p>c"), "<p>a</p><p>b</p><p>c</p>");
  assert.equal(clean("<br>"), "<p><br></p>");
  assert.equal(clean("  \n  "), "");
  assert.equal(clean("<p>a</p>\n\n  <p>b</p>\n"), "<p>a</p><p>b</p>");
});

test("a blockquote holds p, ul and ol: headings become paragraphs, a nested quote joins, an hr goes", () => {
  assert.equal(clean("<blockquote>loose</blockquote>"), "<blockquote><p>loose</p></blockquote>");
  assert.equal(clean('<blockquote><h2 data-align="center">t</h2><h3>u</h3></blockquote>'), "<blockquote><p>t</p><p>u</p></blockquote>");
  assert.equal(clean("<blockquote><p>a</p><blockquote><p>b</p></blockquote><p>c</p></blockquote>"), "<blockquote><p>a</p><p>b</p><p>c</p></blockquote>");
  assert.equal(clean("<blockquote><p>a</p><hr><p>b</p></blockquote>"), "<blockquote><p>a</p><p>b</p></blockquote>");
  assert.equal(clean("<blockquote></blockquote><blockquote> <p> </p></blockquote>"), "");
});

test("a list holds only items: anything else is wrapped in one", () => {
  assert.equal(clean("<ul>loose<li>a</li>more</ul>"), "<ul><li>loose</li><li>a</li><li>more</li></ul>");
  assert.equal(clean("<ul><p>a</p><li>b</li></ul>"), "<ul><li>a</li><li>b</li></ul>");
  assert.equal(clean("<ul>\n  <li>a</li>\n  <li>b</li>\n</ul>"), "<ul><li>a</li><li>b</li></ul>");
  assert.equal(clean("<ul><li>a</li><ul><li>b</li></ul></ul>"), "<ul><li>a</li><li><ul><li>b</li></ul></li></ul>");
});

test("an unclosed item ends where the next begins", () => {
  assert.equal(clean("<ul><li>a<li>b<li>c</ul>"), "<ul><li>a</li><li>b</li><li>c</li></ul>");
  assert.equal(clean("<ul><li>a<ul><li>b</ul><li>c</ul>"), "<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>");
});

test("an item holds inline content first, then at most one nested list, the lists merged", () => {
  assert.equal(clean("<ul><li>a<ul><li>x</li></ul>b</li></ul>"), "<ul><li>ab<ul><li>x</li></ul></li></ul>");
  assert.equal(clean("<ul><li>a<ul><li>x</li></ul><ol><li>y</li></ol></li></ul>"), "<ul><li>a<ul><li>x</li><li>y</li></ul></li></ul>");
  assert.equal(clean("<ul><li>a<ol><li>x</li></ol><ul><li>y</li></ul></li></ul>"), "<ul><li>a<ol><li>x</li><li>y</li></ol></li></ul>");
  assert.equal(clean("<ul><li>a<ul></ul></li></ul>"), "<ul><li>a</li></ul>");
  assert.equal(clean("<ul><li><ul><li>only nested</li></ul></li></ul>"), "<ul><li><ul><li>only nested</li></ul></li></ul>");
});

test("blocks in an item become its inline content, one line break between", () => {
  assert.equal(clean("<ul><li><p>one</p><p>two</p></li></ul>"), "<ul><li>one<br>two</li></ul>");
  assert.equal(clean("<ul><li>text<p>para</p><blockquote>quote</blockquote></li></ul>"), "<ul><li>text<br>para<br>quote</li></ul>");
  assert.equal(clean("<ul><li><h2>h</h2></li></ul>"), "<ul><li>h</li></ul>");
  assert.equal(clean("<ul><li><p>a</p><hr><p>b</p></li></ul>"), "<ul><li>a<br>b</li></ul>");
});

test("lists nest three deep at most: a deeper list's items join the third, after the item that held them", () => {
  const four = "<ul><li>1<ul><li>2<ul><li>3<ul><li>4<ul><li>5</li></ul></li></ul></li><li>3b</li></ul></li></ul></li></ul>";
  assert.equal(clean(four), "<ul><li>1<ul><li>2<ul><li>3</li><li>4</li><li>5</li><li>3b</li></ul></li></ul></li></ul>");
  const mixed = "<ol><li>1<ol><li>2<ol><li>3<ul><li>4</li></ul></li></ol></li></ol></li></ol>";
  assert.equal(clean(mixed), "<ol><li>1<ol><li>2<ol><li>3</li><li>4</li></ol></li></ol></li></ol>");
});

test("a block inside a paragraph, heading or inline element is unwrapped, blocks separated by a break", () => {
  assert.equal(clean("<p>a<p>b</p></p>"), "<p>a<br>b</p>");
  assert.equal(clean("<p>a<div>b</div>c</p>"), "<p>a<br>b<br>c</p>");
  assert.equal(clean("<h2>a<blockquote>b</blockquote></h2>"), "<h2>a<br>b</h2>");
  assert.equal(clean("<p><strong>a<p>b</p></strong></p>"), "<p><strong>a<br>b</strong></p>");
  assert.equal(clean("<p>a<ul><li>b</li><li>c</li></ul>d</p>"), "<p>a<br>b<br>c<br>d</p>");
  assert.equal(clean("<p>a<hr>b</p>"), "<p>ab</p>");
  assert.equal(clean('<a href="/x"><p>one</p><p>two</p></a>'), '<p><a href="/x">one<br>two</a></p>');
});

test("an item outside a list reads as a paragraph", () => {
  assert.equal(clean("<li>a</li><li>b</li>"), "<p>a</p><p>b</p>");
  assert.equal(clean("<blockquote><li>a</li></blockquote>"), "<blockquote><p>a</p></blockquote>");
});

test("the same tag nested in itself with nothing else collapses", () => {
  assert.equal(clean("<p><em><em>x</em></em></p>"), "<p><em>x</em></p>");
  assert.equal(clean("<p><strong><b>x</b></strong></p>"), "<p><strong>x</strong></p>");
  assert.equal(clean("<p><em><em><em>x</em></em></em></p>"), "<p><em>x</em></p>");
  assert.equal(clean("<p><em><em>x</em> y</em></p>"), "<p><em><em>x</em> y</em></p>");
  assert.equal(clean("<p><em><strong></strong><em>x</em></strong></em></p>"), "<p><em>x</em></p>");
});

test("very deep nesting can't overflow the stack and still sanitizes", () => {
  const deep = "<em>".repeat(5000) + "x" + "</em>".repeat(5000);
  const out = clean(deep);
  assert.ok(out.includes("x"));
  assert.equal(clean(out), out);
  const quotes = "<blockquote>".repeat(5000) + "y" + "</blockquote>".repeat(5000);
  assert.equal(clean(quotes), "<blockquote><p>y</p></blockquote>");
  const lists = "<ul><li>".repeat(5000) + "z" + "</li></ul>".repeat(5000);
  assert.equal(clean(clean(lists)), clean(lists));
});

/* ── Whitespace and empties ──────────────────────────────────────────── */

test("runs of whitespace become one space, trimmed at the edges of a block and beside a break", () => {
  assert.equal(clean("<p>  a \t\n b   c </p>"), "<p>a b c</p>");
  assert.equal(clean("<p>a <br> b</p>"), "<p>a<br>b</p>");
  assert.equal(clean("<p><em>a </em><br><em> b</em></p>"), "<p><em>a</em><br><em>b</em></p>");
  assert.equal(clean("<p>a <em> b </em> c</p>"), "<p>a <em>b </em>c</p>");
  assert.equal(clean("<p><strong> a</strong> </p>"), "<p><strong>a</strong></p>");
  assert.equal(clean("<h2>\n  Title \n</h2>"), "<h2>Title</h2>");
  assert.equal(clean("<ul><li>  a  </li></ul>"), "<ul><li>a</li></ul>");
  assert.equal(clean("<p>a&#32; &#9;b</p>"), "<p>a b</p>");
});

test("a no-break space is a character, not whitespace", () => {
  assert.equal(clean("<p>a&nbsp;&nbsp;b</p>"), "<p>a  b</p>");
  assert.equal(clean("<p>&nbsp;</p>"), "<p> </p>");
  assert.equal(clean("<p>  a  </p>"), "<p>  a  </p>");
});

test("empty blocks and inline elements are dropped", () => {
  assert.equal(clean("<p></p><p> </p><h2></h2><h3>\n</h3><ul><li></li></ul><ol></ol>"), "");
  assert.equal(clean("<p>a<em></em><strong> </strong>b</p>"), "<p>a b</p>");
  assert.equal(clean("<p>a<em></em>b</p>"), "<p>ab</p>");
  assert.equal(clean("<p><em></em></p>"), "");
  assert.equal(clean("<p><a href=\"/x\"></a>a</p>"), "<p>a</p>");
  assert.equal(clean("<ul><li></li><li>a</li><li> </li></ul>"), "<ul><li>a</li></ul>");
});

test("a block with only breaks becomes one break; a trailing break after text goes", () => {
  assert.equal(clean("<p><br></p>"), "<p><br></p>");
  assert.equal(clean("<p><br><br><br></p>"), "<p><br></p>");
  assert.equal(clean("<p> <br> <br> </p>"), "<p><br></p>");
  assert.equal(clean("<h2><br></h2>"), "<h2><br></h2>");
  assert.equal(clean("<ul><li><br></li></ul>"), "<ul><li><br></li></ul>");
  assert.equal(clean("<p>a<br></p>"), "<p>a</p>");
  assert.equal(clean("<p>a<br><br></p>"), "<p>a</p>");
  assert.equal(clean("<p>a<em>b<br></em></p>"), "<p>a<em>b</em></p>");
  assert.equal(clean("<p>a<em><br></em></p>"), "<p>a</p>");
  assert.equal(clean("<p><br>a</p>"), "<p><br>a</p>");
  assert.equal(clean("<p>a<br><br>b</p>"), "<p>a<br><br>b</p>");
  assert.equal(clean("<ul><li>a<br><ul><li>b</li></ul></li></ul>"), "<ul><li>a<ul><li>b</li></ul></li></ul>");
  assert.equal(clean("<ul><li><br><ul><li>b</li></ul></li></ul>"), "<ul><li><ul><li>b</li></ul></li></ul>");
});

test("adjacent inline runs of one kind are joined", () => {
  assert.equal(clean("<p><em>a</em><em>b</em></p>"), "<p><em>ab</em></p>");
  assert.equal(clean("<p><i>a</i><em>b</em></p>"), "<p><em>ab</em></p>");
  assert.equal(clean("<p><em>a</em><em>b</em><em>c</em></p>"), "<p><em>abc</em></p>");
  assert.equal(clean("<p><em><strong>a</strong></em><em><strong>b</strong></em></p>"), "<p><em><strong>ab</strong></em></p>");
  assert.equal(clean("<p><em>a</em> <em>b</em></p>"), "<p><em>a</em> <em>b</em></p>");
  assert.equal(clean("<p><strong>a</strong><em>b</em></p>"), "<p><strong>a</strong><em>b</em></p>");
  assert.equal(clean('<p><a href="/x">a</a><a href="/x">b</a></p>'), '<p><a href="/x">ab</a></p>');
  assert.equal(clean('<p><a href="/x">a</a><a href="/y">b</a></p>'), '<p><a href="/x">a</a><a href="/y">b</a></p>');
  assert.equal(clean("<p><em>a</em><span></span><em>b</em></p>"), "<p><em>ab</em></p>");
  assert.equal(clean("<p>a<br><em>b</em><br><em>c</em></p>"), "<p>a<br><em>b</em><br><em>c</em></p>");
});

/* ── Entities and characters ─────────────────────────────────────────── */

test("the named entities decode and are written as themselves", () => {
  assert.equal(
    clean("<p>&amp;&lt;&gt;&quot;&apos;&nbsp;&mdash;&ndash;&hellip;&lsquo;&rsquo;&ldquo;&rdquo;&shy;</p>"),
    "<p>&amp;&lt;&gt;\"' —–…‘’“”­</p>",
  );
});

test("numeric entities decode; invalid ones become the replacement character", () => {
  assert.equal(clean("<p>&#65;&#x42;&#X43;&#128512;</p>"), "<p>ABC\u{1F600}</p>");
  assert.equal(clean("<p>&#0;&#xD800;&#xDFFF;&#1114112;&#99999999999999999999;</p>"), "<p>�����</p>");
});

test("an unknown or unfinished entity stays literal, its ampersand escaped", () => {
  assert.equal(clean("<p>&foo; &amp &#65 &Amp; &constructor; &#;</p>"), "<p>&amp;foo; &amp;amp &amp;#65 &amp;Amp; &amp;constructor; &amp;#;</p>");
});

test("decoding happens once: an escaped entity stays what it spells", () => {
  assert.equal(clean("<p>&amp;lt;script&amp;gt;</p>"), "<p>&amp;lt;script&amp;gt;</p>");
  assert.equal(clean("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>"), "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
});

test("text that looks like a tag but isn't one stays text", () => {
  assert.equal(clean("<p>1 < 2 and 3 > 2</p>"), "<p>1 &lt; 2 and 3 &gt; 2</p>");
  assert.equal(clean("<p>a <3 b</p>"), "<p>a &lt;3 b</p>");
  assert.equal(clean("a <b"), "<p>a &lt;b</p>");
  // A tag the input ends inside of makes the rest text, close tags and all (BA67).
  assert.equal(clean('<p>x <a href="unterminated</p>'), '<p>x &lt;a href="unterminated&lt;/p&gt;</p>');
  assert.equal(clean("<p>x <a title='y <b>bold</b></p>"), "<p>x &lt;a title='y &lt;b&gt;bold&lt;/b&gt;&lt;/p&gt;</p>");
});

test("an unfinished tag costs one scan, not one per character after it (BA67)", () => {
  for (const hostile of ["<a ".repeat(16384), `<a x="${"<a ".repeat(16384)}`, `<p>${"<b c='".repeat(8192)}`]) {
    const start = performance.now();
    const out = clean(hostile);
    const ms = performance.now() - start;
    assert.ok(ms < 500, `${hostile.slice(0, 12)}… took ${Math.round(ms)} ms`);
    assert.equal(clean(out), out);
  }
});

test("text is NFC, and every other character is literal", () => {
  assert.equal(clean("<p>é</p>"), "<p>é</p>");
  assert.equal(clean("<p>ἀγάπη — “Torah” ‘x’ ✓ \u{1F600}</p>".normalize("NFD")), "<p>ἀγάπη — “Torah” ‘x’ ✓ \u{1F600}</p>".normalize("NFC"));
  assert.equal(clean("<p><em>e</em><em>́</em></p>"), "<p><em>é</em></p>");
});

test("tags are read the way a browser reads them: quotes, newlines, odd attributes", () => {
  assert.equal(clean('<p\n class="a>b"\n>text</p\n>'), "<p>text</p>");
  assert.equal(clean("<P><B>x</B></P >"), "<p><strong>x</strong></p>");
  assert.equal(clean('<a href="/x" href="https://evil.example">x</a>'), '<p><a href="/x">x</a></p>');
  assert.equal(clean('<p foo=">" bar>x</p>'), "<p>x</p>");
  assert.equal(clean("<p/>x"), "<p>x</p>");
  assert.equal(clean("</p></div>text</em>"), "<p>text</p>");
  assert.equal(clean("<b>a<i>b</b>c</i>"), "<p><strong>a<em>b</em></strong>c</p>");
});

/* ── Idempotence and the grammar, on a fuzz ──────────────────────────── */

/** A seeded generator, so a failure can be repeated. */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAGS = [
  "p", "div", "span", "span", "span", "mark", "b", "i", "u", "s", "strong", "em", "sup", "sub", "a", "br", "hr", "h1", "h2", "h3", "h4", "h6", "blockquote",
  "ul", "ol", "li", "table", "tr", "td", "font", "center", "strike", "del", "ins", "section", "pre", "code", "img", "svg", "script",
  "style", "iframe", "button", "input", "textarea", "template", "noscript", "title", "math", "object", "embed", "select",
];
const ATTRS = [
  "", "", "", ' onclick="alert(1)"', ' style="text-align:center;color:red"', ' style="text-align: right"', ' class="x"', ' id="y"',
  ' href="https://example.org/a?b=1&c=2"', ' href="/romans-8/#v3"', ' href="javascript:alert(1)"', ' href="jav&#x61;script:alert(1)"',
  ' href="//evil.example"', ' href="mailto:a@b.org"', ' href=/x', ' align="right"', ' align=center', ' data-align="justify"',
  ' data-align="left"', ' data-font="serif"', ' data-font="comic"', ' data-size="large"', ' data-size="huge"', ' data-color="red"',
  ' data-color="#ff0000"', ' data-color="RED "', ' data-mark="yellow"', ' data-mark="red"', ' data-font="sans" data-font="serif"',
  ' data-mark="pink" data-color="blue" data-size="small" data-font="atkinson"', ' color="red"', ' onerror=alert(1)', ' src="x"', ' style="background:url(javascript:alert(1))"', " href='/q'", ' href',
];
const WORDS = [
  "alpha", "beta", " ", "  ", "\n", "\t", "one two", "Liberation", "ἀγάπη", "é", " ", "“quoted”", "x < y", "a > b", "5 & 6",
  "&amp;", "&lt;", "&gt;", "&quot;", "&nbsp;", "&mdash;", "&#65;", "&#x42;", "&#0;", "&#xD800;", "&bogus;", "&amp", "&#", "<", ">",
  "\"", "'", "<!-- c -->", "<!-- open", "<!x>", "<?pi?>", "<3", "</", "<a", "<p x=", '<p x="',
];

function randomSoup(rand, size) {
  const pick = (list) => list[Math.floor(rand() * list.length)];
  let out = "";
  for (let i = 0; i < size; i++) {
    const roll = rand();
    if (roll < 0.34) out += pick(WORDS);
    else if (roll < 0.66) out += `<${pick(TAGS)}${pick(ATTRS)}${rand() < 0.1 ? "/" : ""}>`;
    else if (roll < 0.94) out += `</${pick(TAGS)}>`;
    else out += pick(["<P>", "</P>", "<LI>", "<Br>", "<A HREF='/x'>", "<EM >"]);
  }
  return out;
}

const NAMES = new Set(["p", "h2", "h3", "blockquote", "hr", "ul", "ol", "li", "strong", "em", "u", "s", "sup", "sub", "a", "span", "br"]);
const INLINE_NAMES = new Set(["strong", "em", "u", "s", "sup", "sub", "a", "span"]);
const TOP = new Set(["p", "h2", "h3", "blockquote", "ul", "ol", "hr"]);
const IN_QUOTE = new Set(["p", "ul", "ol"]);

/**
 * Hold sanitized output to the canonical grammar by reading it with its own
 * small parser: only the allowed tags, only the allowed attributes with allowed
 * values, nesting as the format fixes it, no stray angle brackets.
 */
function assertCanonicalGrammar(html, label) {
  assert.ok(!/<\s*script/i.test(html), `${label}: contains <script`);
  const TAG = /<(\/?)([a-z0-9]+)((?: [a-z-]+="[^"]*")*)>/g;
  assert.ok(!/[<>]/.test(html.replace(TAG, "")), `${label}: stray angle bracket in ${html}`);
  assert.ok(!/(^|[^&])&(?!(amp|lt|gt|quot);)/.test(html), `${label}: unescaped ampersand`);

  const stack = [];
  let closedSpan = null;
  let last = 0;
  let m;
  const parent = () => stack[stack.length - 1]?.name ?? "#top";
  const listDepth = () => stack.filter((e) => e.name === "ul" || e.name === "ol").length;
  const hasA = () => stack.some((e) => e.name === "a");
  const text = (s) => {
    if (!s) return;
    const p = parent();
    assert.ok(p === "p" || p === "h2" || p === "h3" || p === "li" || INLINE_NAMES.has(p), `${label}: text directly in ${p}: ${html}`);
    assert.ok(!/ {2}|\t|\n|\r|\f/.test(s), `${label}: whitespace not collapsed in ${JSON.stringify(s)}`);
    assert.equal(s, s.normalize("NFC"), `${label}: not NFC`);
  };
  TAG.lastIndex = 0;
  while ((m = TAG.exec(html))) {
    text(html.slice(last, m.index));
    last = TAG.lastIndex;
    const [, close, name, attrText] = m;
    assert.ok(NAMES.has(name), `${label}: tag ${name} is not allowed`);
    if (close) {
      assert.equal(attrText, "", `${label}: attributes on a close tag`);
      const closed = stack.pop();
      assert.equal(closed?.name, name, `${label}: mismatched </${name}>`);
      if (name === "span") closedSpan = { end: TAG.lastIndex, attrText: closed.attrText };
      continue;
    }
    const attrs = [...attrText.matchAll(/ ([a-z-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]);
    for (const [k, v] of attrs) {
      if (name === "a" && k === "href") {
        const decoded = v.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
        assert.ok(/^(https?|mailto):/i.test(decoded) || (decoded.startsWith("/") && !decoded.startsWith("//") && !decoded.startsWith("/\\")), `${label}: bad href ${decoded}`);
        assert.ok(!/[\x00-\x1f\x7f]/.test(decoded), `${label}: control character in href`);
      } else if (k === "data-align" && (name === "p" || name === "h2" || name === "h3")) {
        assert.ok(ALIGNMENTS.includes(v), `${label}: bad align ${v}`);
      } else if (name === "span" && /^data-(font|size|color|mark)$/.test(k)) {
        assert.ok(SPAN_STYLES[k.slice(5)].includes(v), `${label}: bad span style ${k}=${v}`);
      } else assert.fail(`${label}: attribute ${k} on <${name}>`);
    }
    assert.equal(attrs.length, new Set(attrs.map((a) => a[0])).size, `${label}: repeated attribute`);
    if (name === "a") assert.equal(attrs.length, 1, `${label}: a without href`);
    if (name === "span") {
      assert.ok(attrs.length >= 1, `${label}: span with no style`);
      const order = attrs.map((a) => ["data-font", "data-size", "data-color", "data-mark"].indexOf(a[0]));
      assert.deepEqual(order, [...order].sort((x, y) => x - y), `${label}: span styles out of order`);
      assert.ok(!(closedSpan && closedSpan.end === m.index && closedSpan.attrText === attrText), `${label}: adjacent spans with the same styles`);
    }

    const p = parent();
    if (p === "#top") assert.ok(TOP.has(name), `${label}: ${name} at the top level`);
    else if (p === "blockquote") assert.ok(IN_QUOTE.has(name), `${label}: ${name} in a blockquote`);
    else if (p === "ul" || p === "ol") assert.equal(name, "li", `${label}: ${name} in a list`);
    else if (p === "li") {
      assert.ok(INLINE_NAMES.has(name) || name === "br" || name === "ul" || name === "ol", `${label}: ${name} in an item`);
    } else assert.ok(INLINE_NAMES.has(name) || name === "br", `${label}: ${name} in ${p}`);
    if (name === "ul" || name === "ol") assert.ok(listDepth() < 3, `${label}: lists nested deeper than three`);
    if (name === "a") assert.ok(!hasA(), `${label}: a in an a`);
    if (name === "blockquote") assert.ok(!stack.some((e) => e.name === "blockquote"), `${label}: blockquote in blockquote`);
    if (name !== "br" && name !== "hr") stack.push({ name, attrText });
  }
  text(html.slice(last));
  assert.equal(stack.length, 0, `${label}: unclosed element`);
}

test("a fuzz of tag soup: every output is canonical, hostile pieces are gone, and sanitizing again changes nothing", () => {
  const rand = prng(20261018);
  for (let i = 0; i < 1500; i++) {
    const input = randomSoup(rand, 3 + Math.floor(rand() * 45));
    const once = clean(input);
    assertCanonicalGrammar(once, `#${i} ${JSON.stringify(input)}`);
    assert.equal(clean(once), once, `#${i} not idempotent: ${JSON.stringify(input)} -> ${once}`);
    assert.ok(!/<[^>]* on[a-z]+\s*=/i.test(once), `#${i}: event handler`);
    assert.ok(!/<[^>]* style\s*=/i.test(once), `#${i}: style attribute`);
    assert.ok(!/href="\s*javascript:/i.test(once), `#${i}: javascript link`);
  }
});

test("a fuzz of well-formed pieces too: nested blocks, lists and links", () => {
  const rand = prng(7);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const block = (d) => {
    const r = rand();
    const inner = () => (d > 4 ? "x" : Array.from({ length: 1 + Math.floor(rand() * 3) }, () => block(d + 1)).join(pick(["", " ", "\n", "<br>"])));
    if (r < 0.2) return `<${pick(["p", "div", "h1", "h2", "h4"])}${pick(ATTRS)}>${inner()}</${pick(["p", "div", "h1"])}>`;
    if (r < 0.35) return `<${pick(["ul", "ol"])}>${Array.from({ length: 1 + Math.floor(rand() * 3) }, () => `<li>${inner()}</li>`).join("")}</${pick(["ul", "ol"])}>`;
    if (r < 0.45) return `<blockquote>${inner()}</blockquote>`;
    if (r < 0.52) return `<span${pick(ATTRS)}>${inner()}</span>`;
    if (r < 0.6) return `<${pick(["b", "i", "em", "u", "s", "span", "sup"])}>${inner()}</${pick(["b", "i", "em", "u", "s", "span", "sup"])}>`;
    if (r < 0.7) return `<a${pick(ATTRS)}>${inner()}</a>`;
    return pick(["word", " spaced ", "a&amp;b", "<br>", "<hr>", "ἀγάπη", ""]);
  };
  for (let i = 0; i < 600; i++) {
    const input = block(0) + block(0);
    const once = clean(input);
    assertCanonicalGrammar(once, `#${i} ${input}`);
    assert.equal(clean(once), once, `#${i} not idempotent: ${input} -> ${once}`);
  }
});

test("every input in this file's own cases is idempotent", () => {
  for (const html of CANONICAL) assert.equal(clean(clean(html)), clean(html));
});

/* ── Checking a sheet ────────────────────────────────────────────────── */

const passage = (over = {}) => ({
  id: "m-passage",
  type: "passage",
  bookKey: "romans",
  chapter: 8,
  verse: 1,
  endVerse: 4,
  verseCopy: "Therefore, nothing is now a verdict",
  verseCopyAsOf: VERSION,
  blanks: [{ id: "b1", verse: 3, exact: "self-preservation", prefix: "powerless under ", suffix: ", God sent", hint: "traditional", hintText: "" }],
  footnotes: [{ verse: 2, footnote: "A note.", n: 1, print: true }],
  ...over,
});

function goodSheet(over = {}) {
  return createRecord(
    "sheet",
    {
      sheetFormat: 1,
      title: "Freedom and the Life-breath",
      subtitle: "Thursday group",
      template: "bible-study",
      commercial: false,
      modules: [
        passage(),
        { id: "m-text", type: "text", html: "<p>Read slowly.</p>" },
        { id: "m-question", type: "question", html: "<p>What is lifted?</p>", answer: "", lines: 4 },
        { id: "m-space", type: "space", lines: 6 },
        { id: "m-terms", type: "keyTerms", omit: ["flesh-body"] },
        { id: "m-break", type: "pageBreak" },
      ],
      ...over,
    },
    { ...ctx, now: T0, id: nextId() },
  );
}

const withModule = (m) => goodSheet({ modules: [m] });
const problemsOf = (sheet) => validateRecord(sheet);
const hasProblem = (sheet, re) => problemsOf(sheet).some((p) => re.test(p));

test("a good sheet has no problems, by validateSheet and by validateRecord", () => {
  const s = goodSheet();
  assert.deepEqual(validateSheet(s), []);
  assert.deepEqual(validateRecord(s), []);
  assert.deepEqual(validateRecord(goodSheet({ modules: [] })), []);
  assert.deepEqual(validateRecord(goodSheet({ commercial: undefined })), []);
  assert.deepEqual(validateRecord(goodSheet({ subtitle: "" })), []);
});

test("a sheet's own fields are checked", () => {
  assert.ok(hasProblem(goodSheet({ sheetFormat: 0 }), /sheetFormat/));
  assert.ok(hasProblem(goodSheet({ sheetFormat: "1" }), /sheetFormat/));
  assert.ok(hasProblem(goodSheet({ title: 5 }), /title/));
  assert.ok(hasProblem(goodSheet({ title: "x".repeat(201) }), /title/));
  assert.deepEqual(validateRecord(goodSheet({ title: "x".repeat(200) })), []);
  assert.deepEqual(validateRecord(goodSheet({ title: "\u{1F600}".repeat(200) })), [], "characters, not code units");
  assert.ok(hasProblem(goodSheet({ subtitle: "x".repeat(201) }), /subtitle/));
  assert.ok(hasProblem(goodSheet({ subtitle: undefined }), /subtitle/));
  assert.ok(hasProblem(goodSheet({ template: "" }), /template/));
  assert.ok(hasProblem(goodSheet({ template: 3 }), /template/));
  assert.ok(hasProblem(goodSheet({ commercial: "yes" }), /commercial/));
  assert.ok(hasProblem(goodSheet({ modules: {} }), /modules is not a list/));
  assert.ok(hasProblem(goodSheet({ modules: undefined }), /modules is not a list/));
});

test("a sheet is checked only after the fields every record carries", () => {
  const s = { ...goodSheet(), id: "" };
  assert.deepEqual(validateRecord(s), ["id is missing"]);
});

test("modules are objects with a unique id and a type", () => {
  assert.ok(hasProblem(goodSheet({ modules: ["x"] }), /Module 1 is not an object/));
  assert.ok(hasProblem(goodSheet({ modules: [null] }), /Module 1 is not an object/));
  assert.ok(hasProblem(goodSheet({ modules: [[]] }), /Module 1 is not an object/));
  assert.ok(hasProblem(goodSheet({ modules: [{ type: "pageBreak" }] }), /Module 1 has no id/));
  assert.ok(hasProblem(goodSheet({ modules: [{ id: "", type: "pageBreak" }] }), /Module 1 has no id/));
  assert.ok(hasProblem(goodSheet({ modules: [{ id: "a" }] }), /Module 1 has no type/));
  assert.ok(hasProblem(goodSheet({ modules: [{ id: "a", type: "" }] }), /Module 1 has no type/));
  assert.ok(hasProblem(goodSheet({ modules: [{ id: "a", type: "pageBreak" }, { id: "a", type: "pageBreak" }] }), /Module 2 repeats the id/));
});

test("a sheet holds at most 300 modules", () => {
  const many = (n) => Array.from({ length: n }, (_, i) => ({ id: `m${i}`, type: "pageBreak" }));
  assert.deepEqual(validateRecord(goodSheet({ modules: many(300) })), []);
  assert.ok(hasProblem(goodSheet({ modules: many(301) }), /at most 300 modules/));
});

test("a sheet is at most 512 KB as JSON", () => {
  const big = { id: "big", type: "text", html: `<p>${"x".repeat(524288)}</p>` };
  assert.ok(hasProblem(goodSheet({ modules: [big] }), /512 KB/));
  const justUnder = { id: "ok", type: "text", html: `<p>${"é".repeat(200000)}</p>` };
  assert.deepEqual(validateRecord(goodSheet({ modules: [justUnder] })), [], "400 KB of two-byte characters");
  const overInBytes = { id: "over", type: "text", html: `<p>${"é".repeat(270000)}</p>` };
  assert.ok(hasProblem(goodSheet({ modules: [overInBytes] }), /512 KB/), "counted in bytes, not characters");
  // An unknown module's weight counts too.
  assert.ok(hasProblem(goodSheet({ modules: [{ id: "u", type: "mapPin", blob: "x".repeat(600000) }] }), /512 KB/));
});

test("a sheet over the size limit is refused without sanitizing its modules (BA67)", () => {
  const heavy = { id: "h", type: "text", html: "<a ".repeat(200000) };
  const start = performance.now();
  const problems = validateSheet(goodSheet({ modules: [heavy, { id: "h", type: "text", html: 5 }] }));
  assert.ok(performance.now() - start < 500);
  assert.deepEqual(problems, [`a sheet is at most ${SHEET_LIMITS.bytes / 1024} KB`], "its modules aren't looked at");
});

test("leaderOnly is absent or true or false, on every known type", () => {
  for (const m of [passage(), { id: "t", type: "text", html: "" }, { id: "q", type: "question", html: "", answer: "", lines: 0 }, { id: "s", type: "space", lines: 1 }, { id: "k", type: "keyTerms", omit: [] }, { id: "p", type: "pageBreak" }]) {
    assert.deepEqual(validateRecord(withModule({ ...m, leaderOnly: true })), [], m.type);
    assert.deepEqual(validateRecord(withModule({ ...m, leaderOnly: false })), [], m.type);
    assert.ok(hasProblem(withModule({ ...m, leaderOnly: "yes" }), /leaderOnly/), m.type);
  }
});

test("a module of a type this code doesn't know is checked for id and type alone", () => {
  const unknown = { id: "u", type: "mapPin", leaderOnly: "whatever", coordinates: { lat: 1 }, anything: [1, 2, null] };
  assert.deepEqual(validateRecord(withModule(unknown)), []);
  assert.ok(hasProblem(withModule({ ...unknown, id: "" }), /no id/));
});

test("a passage names verses of one real chapter", () => {
  assert.deepEqual(validateRecord(withModule(passage({ endVerse: null, blanks: [] }))), []);
  assert.deepEqual(validateRecord(withModule(passage({ endVerse: undefined, blanks: [] }))), []);
  assert.deepEqual(validateRecord(withModule(passage({ endVerse: 1, blanks: [] }))), []);
  assert.ok(hasProblem(withModule(passage({ bookKey: "hezekiah" })), /not a book/));
  assert.ok(hasProblem(withModule(passage({ bookKey: "constructor" })), /not a book/));
  assert.ok(hasProblem(withModule(passage({ chapter: 0 })), /chapter/));
  assert.ok(hasProblem(withModule(passage({ chapter: 17 })), /chapter/));
  assert.ok(hasProblem(withModule(passage({ chapter: "8" })), /chapter/));
  assert.ok(hasProblem(withModule(passage({ verse: 0 })), /verse is not a positive integer/));
  assert.ok(hasProblem(withModule(passage({ verse: 1.5 })), /verse/));
  assert.ok(hasProblem(withModule(passage({ endVerse: 0 })), /endVerse/));
  assert.ok(hasProblem(withModule(passage({ verse: 5, endVerse: 4 })), /endVerse/));
});

test("a passage's quote, copies, blanks and footnote choices", () => {
  assert.deepEqual(validateRecord(withModule(passage({ quote: { exact: "x", prefix: "", suffix: "" } }))), []);
  assert.ok(hasProblem(withModule(passage({ quote: { exact: "", prefix: "", suffix: "" } })), /quote\.exact/));
  assert.ok(hasProblem(withModule(passage({ quote: { exact: "x", prefix: 1, suffix: "" } })), /prefix and suffix/));
  assert.ok(hasProblem(withModule(passage({ quote: "x" })), /quote is not an object/));
  assert.deepEqual(validateRecord(withModule(passage({ verseCopy: null, verseCopyAsOf: null }))), []);
  assert.deepEqual(validateRecord(withModule(passage({ verseCopy: undefined, verseCopyAsOf: undefined }))), []);
  assert.ok(hasProblem(withModule(passage({ verseCopy: 5 })), /verseCopy/));
  assert.ok(hasProblem(withModule(passage({ verseCopyAsOf: {} })), /verseCopyAsOf/));
  assert.ok(hasProblem(withModule(passage({ blanks: undefined })), /blanks is not a list/));
  assert.ok(hasProblem(withModule(passage({ footnotes: "none" })), /footnotes is not a list/));
  assert.deepEqual(validateRecord(withModule(passage({ blanks: [], footnotes: [] }))), []);
});

test("a blank has an id, a verse inside the passage, words, context, and a hint", () => {
  const blank = (over) => passage({ blanks: [{ id: "b1", verse: 3, exact: "x", prefix: "", suffix: "", hint: "none", ...over }] });
  assert.deepEqual(validateRecord(withModule(blank({}))), []);
  assert.deepEqual(validateRecord(withModule(blank({ hint: "custom", hintText: "traditionally sin" }))), []);
  assert.deepEqual(validateRecord(withModule(blank({ hintText: null }))), []);
  assert.ok(hasProblem(withModule(blank({ id: "" })), /blank 1 has no id/));
  assert.ok(hasProblem(withModule(blank({ verse: 5 })), /outside the passage/));
  assert.ok(hasProblem(withModule(blank({ verse: 0 })), /outside the passage/));
  assert.ok(hasProblem(withModule(blank({ verse: "3" })), /outside the passage/));
  assert.deepEqual(validateRecord(withModule(blank({ verse: 1 }))), []);
  assert.deepEqual(validateRecord(withModule(blank({ verse: 4 }))), []);
  assert.ok(hasProblem(withModule(blank({ exact: "" })), /no words/));
  assert.ok(hasProblem(withModule(blank({ prefix: undefined })), /prefix and suffix/));
  assert.ok(hasProblem(withModule(blank({ hint: "loud" })), /hint "loud"/));
  assert.ok(hasProblem(withModule(blank({ hint: "custom" })), /custom hint with no text/));
  assert.ok(hasProblem(withModule(blank({ hint: "custom", hintText: "" })), /custom hint with no text/));
  assert.ok(hasProblem(withModule(blank({ hintText: "x".repeat(101) })), /hint of more than 100/));
  assert.deepEqual(validateRecord(withModule(blank({ hint: "custom", hintText: "x".repeat(100) }))), []);
  assert.ok(hasProblem(withModule(blank({ hintText: 5 })), /hint of more than 100/));
  assert.ok(
    hasProblem(
      withModule(passage({ blanks: [{ id: "b", verse: 3, exact: "x", prefix: "", suffix: "", hint: "none" }, { id: "b", verse: 3, exact: "y", prefix: "", suffix: "", hint: "none" }] })),
      /repeats the id/,
    ),
  );
  // A passage of one verse takes blanks in that verse only.
  assert.ok(hasProblem(withModule(passage({ endVerse: null, blanks: [{ id: "b", verse: 2, exact: "x", prefix: "", suffix: "", hint: "none" }] })), /outside the passage/));
});

test("a footnote choice names a verse and a footnote and says whether it prints", () => {
  const choice = (over) => passage({ footnotes: [{ verse: 2, footnote: "A note.", n: 1, print: false, ...over }] });
  assert.deepEqual(validateRecord(withModule(choice({}))), []);
  assert.deepEqual(validateRecord(withModule(choice({ n: undefined }))), []);
  assert.deepEqual(validateRecord(withModule(choice({ n: null }))), []);
  assert.ok(hasProblem(withModule(choice({ verse: 0 })), /verse/));
  assert.ok(hasProblem(withModule(choice({ footnote: "" })), /footnote text/));
  assert.ok(hasProblem(withModule(choice({ n: 0 })), /n that is not/));
  assert.ok(hasProblem(withModule(choice({ n: 1.5 })), /n that is not/));
  assert.ok(hasProblem(withModule(choice({ print: "yes" })), /print/));
  assert.ok(hasProblem(withModule(choice({ print: undefined })), /print/));
});

test("a text module's html must already be in the canonical form", () => {
  assert.deepEqual(validateRecord(withModule({ id: "t", type: "text", html: "" })), []);
  assert.deepEqual(validateRecord(withModule({ id: "t", type: "text", html: "<p>a <strong>b</strong></p>" })), []);
  for (const html of ["<div>a</div>", "plain", "<p>a</p> ", "<p><b>a</b></p>", "<script>x</script>", '<p onclick="x">a</p>', "<p> a</p>"]) {
    assert.ok(hasProblem(withModule({ id: "t", type: "text", html }), /not in the sheet's formatted-text form/), html);
  }
  assert.ok(hasProblem(withModule({ id: "t", type: "text", html: 5 }), /formatted-text form/));
  assert.ok(hasProblem(withModule({ id: "t", type: "text" }), /formatted-text form/));
});

test("a question: html and answer canonical, lines 0 to 20", () => {
  const q = (over) => ({ id: "q", type: "question", html: "<p>Why?</p>", answer: "", lines: 0, ...over });
  assert.deepEqual(validateRecord(withModule(q({}))), []);
  assert.deepEqual(validateRecord(withModule(q({ answer: "<p>Because.</p>", lines: 20 }))), []);
  assert.ok(hasProblem(withModule(q({ html: "<b>x</b>" })), /html is not in the sheet's/));
  assert.ok(hasProblem(withModule(q({ answer: "<b>x</b>" })), /answer is not in the sheet's/));
  assert.ok(hasProblem(withModule(q({ answer: undefined })), /answer/));
  assert.ok(hasProblem(withModule(q({ lines: -1 })), /lines/));
  assert.ok(hasProblem(withModule(q({ lines: 21 })), /lines/));
  assert.ok(hasProblem(withModule(q({ lines: 2.5 })), /lines/));
  assert.ok(hasProblem(withModule(q({ lines: "3" })), /lines/));
});

test("a space: lines 1 to 40", () => {
  assert.deepEqual(validateRecord(withModule({ id: "s", type: "space", lines: 1 })), []);
  assert.deepEqual(validateRecord(withModule({ id: "s", type: "space", lines: 40 })), []);
  for (const lines of [0, 41, 1.5, "4", undefined, null]) assert.ok(hasProblem(withModule({ id: "s", type: "space", lines }), /lines/), String(lines));
});

test("key terms: omit is a list of strings, and a sheet has at most one", () => {
  assert.deepEqual(validateRecord(withModule({ id: "k", type: "keyTerms", omit: [] })), []);
  assert.ok(hasProblem(withModule({ id: "k", type: "keyTerms", omit: "flesh-body" }), /omit/));
  assert.ok(hasProblem(withModule({ id: "k", type: "keyTerms", omit: [1] }), /omit/));
  assert.ok(hasProblem(withModule({ id: "k", type: "keyTerms" }), /omit/));
  const two = goodSheet({ modules: [{ id: "k1", type: "keyTerms", omit: [] }, { id: "k2", type: "keyTerms", omit: [] }] });
  assert.ok(hasProblem(two, /at most one key terms module/));
});

test("a page break holds nothing to check", () => {
  assert.deepEqual(validateRecord(withModule({ id: "p", type: "pageBreak", anything: 1 })), []);
});

test("problems read as plain sentences naming where they are", () => {
  const problems = validateRecord(goodSheet({ modules: [passage({ chapter: 99 }), { id: "s", type: "space", lines: 0 }] }));
  assert.equal(problems.length, 2);
  assert.match(problems[0], /^Module 1 \(passage\): chapter is out of range$/);
  assert.match(problems[1], /^Module 2 \(space\): lines is not a whole number from 1 to 40$/);
});

test("a sheet in a newer sheet format is checked for the common fields only, and can't be edited", () => {
  const newer = { ...goodSheet(), sheetFormat: 2, title: 17, modules: "something new", futureField: { kept: true } };
  assert.deepEqual(validateRecord(newer), []);
  assert.equal(canEdit(newer), false);
  assert.equal(canEdit(goodSheet()), true);
  assert.equal(canEdit({ ...goodSheet(), sheetFormat: 1 }), true);
  assert.equal(canEdit({ ...goodSheet(), sheetFormat: 0 }), true, "a malformed lower number is the validator's to refuse");
  assert.equal(canEdit({ ...goodSheet(), schema: 2 }), false);
  // Another kind is untouched by the sheet rule.
  assert.equal(canEdit({ ...createRecord("label", { name: "x" }, { ...ctx, now: T0 }), sheetFormat: 9 }), true);
});

test("cleanSheetText sanitizes a sheet's formatted fields whatever its format (BA66)", () => {
  const hostile = '<p>Hi<img src=x onerror="alert(1)"></p><script>alert(2)</script>';
  const newer = {
    ...goodSheet(),
    sheetFormat: 2,
    modules: [
      { id: "t", type: "text", html: hostile },
      { id: "q", type: "question", html: hostile, answer: `<p onclick="x()">A</p>`, lines: 2 },
      { id: "u", type: "mapPin", html: hostile },
    ],
    futureField: { kept: true },
  };
  assert.deepEqual(validateRecord(newer), [], "a newer format isn't checked, so validateRecord can't catch it");
  const out = cleanSheetText(newer);
  assert.equal(out.modules[0].html, "<p>Hi</p>");
  assert.equal(out.modules[1].html, "<p>Hi</p>");
  assert.equal(out.modules[1].answer, "<p>A</p>");
  assert.equal(out.modules[2], newer.modules[2], "a module type this code doesn't know is carried untouched");
  assert.deepEqual(out.futureField, { kept: true });
  assert.equal(out.sheetFormat, 2);
  assert.equal(newer.modules[0].html, hostile, "the record passed in isn't changed");

  const good = goodSheet();
  assert.equal(cleanSheetText(good), good, "a sheet already clean is returned as itself");
  const label = createRecord("label", { name: "x" }, { ...ctx, now: T0 });
  assert.equal(cleanSheetText(label), label);
  assert.equal(cleanSheetText({ ...good, modules: "something new" }).modules, "something new");
});

/* ── Making and changing sheets ──────────────────────────────────────── */

const at = (now) => ({ now, client: "web/2026.11" });

test("createSheet: a blank sheet starts with one empty text module", () => {
  const s = createSheet({}, { ...ctx, now: T0, id: nextId() });
  assert.equal(s.kind, "sheet");
  assert.equal(s.sheetFormat, SHEET_FORMAT);
  assert.equal(s.template, "blank");
  assert.equal(s.title, "");
  assert.equal(s.subtitle, "");
  assert.equal(s.commercial, false);
  assert.equal(s.modules.length, 1);
  assert.equal(s.modules[0].type, "text");
  assert.equal(s.modules[0].html, "");
  assert.match(s.modules[0].id, /^[0-9a-f-]{36}$/);
  assert.equal(s.created, T0);
  assert.equal(s.modified, T0);
  assert.deepEqual(validateRecord(s), []);
});

test("createSheet: another template starts with the modules it is given, or none", () => {
  const bare = createSheet({ template: "sermon", title: "Sunday" }, { ...ctx, now: T0, id: nextId() });
  assert.deepEqual(bare.modules, []);
  assert.equal(bare.title, "Sunday");
  const given = createSheet({ template: "class", modules: [makeModule("pageBreak")], commercial: true }, { ...ctx, now: T0, id: nextId() });
  assert.equal(given.modules.length, 1);
  assert.equal(given.commercial, true);
  assert.deepEqual(createSheet({ modules: [] }, { ...ctx, now: T0, id: nextId() }).modules, [], "blank, but told otherwise");
  assert.deepEqual(validateRecord(bare), []);
});

test("makeModule: defaults per type, an id, and html sanitized", () => {
  assert.deepEqual(makeModule("passage", { bookKey: "romans", chapter: 8, verse: 1 }, { id: "p" }), {
    id: "p", type: "passage", blanks: [], footnotes: [], bookKey: "romans", chapter: 8, verse: 1,
  });
  assert.deepEqual(makeModule("text", {}, { id: "t" }), { id: "t", type: "text", html: "" });
  assert.deepEqual(makeModule("question", {}, { id: "q" }), { id: "q", type: "question", html: "", answer: "", lines: 0 });
  assert.deepEqual(makeModule("space", {}, { id: "s" }), { id: "s", type: "space", lines: 4 });
  assert.deepEqual(makeModule("keyTerms", {}, { id: "k" }), { id: "k", type: "keyTerms", omit: [] });
  assert.deepEqual(makeModule("pageBreak", {}, { id: "b" }), { id: "b", type: "pageBreak" });
  assert.deepEqual(makeModule("text", { html: "<div><b>Hi</b></div>" }, { id: "t" }).html, "<p><strong>Hi</strong></p>");
  const q = makeModule("question", { html: "<i>Why?</i>", answer: "<script>x</script>Because", lines: 3 }, { id: "q" });
  assert.equal(q.html, "<p><em>Why?</em></p>");
  assert.equal(q.answer, "<p>Because</p>");
  assert.notEqual(makeModule("text").id, makeModule("text").id);
  assert.notEqual(makeModule("passage").blanks, makeModule("passage").blanks, "defaults are not shared");
  assert.deepEqual(makeModule("text", { leaderOnly: true }, { id: "t" }), { id: "t", type: "text", html: "", leaderOnly: true });
});

test("makeModule refuses an unknown type and fields that are not its to take", () => {
  assert.throws(() => makeModule("mapPin"), /unknown module type/);
  assert.throws(() => makeModule("text", { id: "x" }), /"id"/);
  assert.throws(() => makeModule("text", { type: "space" }), /"type"/);
});

const sheetOf = (...modules) => createSheet({ template: "class", title: "T", modules }, { ...ctx, now: T0, id: nextId() });
const ids = (s) => s.modules.map((m) => m.id);

test("addModule inserts at an index, clamped, and moves `modified`", () => {
  const s = sheetOf(makeModule("text", {}, { id: "a" }), makeModule("text", {}, { id: "b" }));
  assert.deepEqual(ids(addModule(s, makeModule("space", {}, { id: "c" }), undefined, at(T1))), ["a", "b", "c"]);
  assert.deepEqual(ids(addModule(s, makeModule("space", {}, { id: "c" }), 1, at(T1))), ["a", "c", "b"]);
  assert.deepEqual(ids(addModule(s, makeModule("space", {}, { id: "c" }), 0, at(T1))), ["c", "a", "b"]);
  assert.deepEqual(ids(addModule(s, makeModule("space", {}, { id: "c" }), 99, at(T1))), ["a", "b", "c"]);
  assert.deepEqual(ids(addModule(s, makeModule("space", {}, { id: "c" }), -5, at(T1))), ["c", "a", "b"]);
  const next = addModule(s, makeModule("space", {}, { id: "c" }), 1, at(T1));
  assert.equal(next.modified, T1);
  assert.equal(next.client, "web/2026.11");
  assert.equal(next.created, T0);
  assert.equal(s.modified, T0, "the original is unchanged");
  assert.deepEqual(ids(s), ["a", "b"]);
  assert.deepEqual(validateRecord(next), []);
});

test("addModule refuses a second key terms module, a 301st module, a repeated id, and a malformed module", () => {
  const withTerms = sheetOf(makeModule("keyTerms", {}, { id: "k" }));
  assert.throws(() => addModule(withTerms, makeModule("keyTerms", {}, { id: "k2" }), 0, at(T1)), /at most one key terms/);
  assert.doesNotThrow(() => addModule(withTerms, makeModule("pageBreak", {}, { id: "p" }), 0, at(T1)));
  const full = sheetOf(...Array.from({ length: 300 }, (_, i) => makeModule("pageBreak", {}, { id: `m${i}` })));
  assert.throws(() => addModule(full, makeModule("pageBreak", {}, { id: "extra" }), 0, at(T1)), /at most 300/);
  const s = sheetOf(makeModule("text", {}, { id: "a" }));
  assert.throws(() => addModule(s, makeModule("text", {}, { id: "a" }), 0, at(T1)), /already has a module/);
  assert.throws(() => addModule(s, { type: "text" }, 0, at(T1)), /id and a type/);
  assert.throws(() => addModule(s, null, 0, at(T1)), /id and a type/);
});

test("moveModule puts a module at a position in the result, clamped, and returns the sheet when nothing moves", () => {
  const s = sheetOf(...["a", "b", "c", "d"].map((id) => makeModule("pageBreak", {}, { id })));
  assert.deepEqual(ids(moveModule(s, "a", 2, at(T1))), ["b", "c", "a", "d"]);
  assert.deepEqual(ids(moveModule(s, "d", 0, at(T1))), ["d", "a", "b", "c"]);
  assert.deepEqual(ids(moveModule(s, "b", 99, at(T1))), ["a", "c", "d", "b"]);
  assert.deepEqual(ids(moveModule(s, "c", -4, at(T1))), ["c", "a", "b", "d"]);
  assert.equal(moveModule(s, "b", 1, at(T1)), s);
  assert.equal(moveModule(s, "d", 99, at(T1)), s);
  assert.equal(moveModule(s, "a", -1, at(T1)), s);
  assert.equal(moveModule(s, "a", 0, at(T1)).modified, T0);
  assert.equal(moveModule(s, "a", 2, at(T1)).modified, T1);
  assert.throws(() => moveModule(s, "zzz", 0, at(T1)), /no module "zzz"/);
  assert.throws(() => moveModule(s, "a", 1.5, at(T1)), /whole-number/);
  assert.throws(() => moveModule(s, "a", "1", at(T1)), /whole-number/);
});

test("removeModule takes one module out", () => {
  const s = sheetOf(...["a", "b", "c"].map((id) => makeModule("pageBreak", {}, { id })));
  const next = removeModule(s, "b", at(T1));
  assert.deepEqual(ids(next), ["a", "c"]);
  assert.equal(next.modified, T1);
  assert.deepEqual(ids(s), ["a", "b", "c"]);
  assert.throws(() => removeModule(s, "zzz", at(T1)), /no module/);
  assert.deepEqual(ids(removeModule(removeModule(removeModule(s, "a", at(T1)), "b", at(T1)), "c", at(T1))), []);
});

test("updateModule merges fields, sanitizes html and answer, and returns the sheet when nothing changes", () => {
  const s = sheetOf(makeModule("text", { html: "<p>one</p>" }, { id: "t" }), makeModule("question", { html: "<p>Q</p>" }, { id: "q" }));
  const a = updateModule(s, "t", { html: "<div><b>two</b></div>" }, at(T1));
  assert.equal(a.modules[0].html, "<p><strong>two</strong></p>");
  assert.equal(a.modified, T1);
  assert.equal(s.modules[0].html, "<p>one</p>");
  const q = updateModule(s, "q", { answer: "<i>A</i>", lines: 5, leaderOnly: true }, at(T1));
  assert.deepEqual({ ...q.modules[1], id: undefined }, { id: undefined, type: "question", html: "<p>Q</p>", answer: "<p><em>A</em></p>", lines: 5, leaderOnly: true });
  assert.equal(updateModule(s, "t", { html: "<p>one</p>" }, at(T1)), s);
  assert.equal(updateModule(s, "t", { html: "<div>one</div>" }, at(T1)), s, "the same after sanitizing");
  assert.equal(updateModule(s, "t", {}, at(T1)), s);
  assert.equal(updateModule(s, "q", { lines: 0 }, at(T1)), s);
  assert.deepEqual(validateRecord(a), []);
  // A non-text value is passed through for the validator to refuse.
  assert.ok(hasProblem(updateModule(s, "t", { html: 5 }, at(T1)), /formatted-text form/));
  // A nested change is compared whole.
  const p = sheetOf(makeModule("passage", { bookKey: "romans", chapter: 8, verse: 1 }, { id: "p" }));
  assert.equal(updateModule(p, "p", { blanks: [] }, at(T1)), p);
  assert.notEqual(updateModule(p, "p", { blanks: [{ id: "b" }] }, at(T1)), p);
});

test("updateModule refuses an id or type change, an unknown module, and a module of an unknown type", () => {
  const unknown = { id: "u", type: "mapPin", caption: "Jerusalem" };
  const s = sheetOf(makeModule("text", {}, { id: "t" }), unknown);
  assert.throws(() => updateModule(s, "t", { id: "x" }, at(T1)), /"id"/);
  assert.throws(() => updateModule(s, "t", { type: "space" }, at(T1)), /"type"/);
  assert.throws(() => updateModule(s, "zzz", { html: "" }, at(T1)), /no module/);
  assert.throws(() => updateModule(s, "u", { caption: "x" }, at(T1)), /type this version doesn't know/);
});

test("setSheetFields changes the title, subtitle and commercial setting only", () => {
  const s = sheetOf(makeModule("text", {}, { id: "t" }));
  const next = setSheetFields(s, { title: "New", subtitle: "Sub", commercial: true }, at(T1));
  assert.equal(next.title, "New");
  assert.equal(next.subtitle, "Sub");
  assert.equal(next.commercial, true);
  assert.equal(next.modified, T1);
  assert.equal(next.template, s.template);
  assert.equal(setSheetFields(s, { title: "T" }, at(T1)), s);
  assert.equal(setSheetFields(s, {}, at(T1)), s);
  assert.equal(setSheetFields(s, { commercial: false }, at(T1)), s);
  assert.throws(() => setSheetFields(s, { template: "x" }, at(T1)), /isn't a field/);
  assert.throws(() => setSheetFields(s, { modules: [] }, at(T1)), /isn't a field/);
  assert.throws(() => setSheetFields(s, { id: "x" }, at(T1)), /isn't a field/);
  assert.throws(() => setSheetFields(s, { title: "New", sheetFormat: 2 }, at(T1)), /isn't a field/);
});

test("a change moves `modified` (principle 4), and a refused or empty one doesn't touch the sheet", () => {
  const s = sheetOf(makeModule("text", {}, { id: "t" }));
  const before = JSON.stringify(s);
  moveModule(s, "t", 0, at(T1));
  setSheetFields(s, { title: "T" }, at(T1));
  assert.throws(() => removeModule(s, "nope", at(T1)));
  assert.equal(JSON.stringify(s), before);
  assert.equal(addModule(s, makeModule("pageBreak"), 0, at(T2)).modified, T2);
});

test("unknown module types are kept in place by add, move and remove, whole", () => {
  const unknown = { id: "u", type: "mapPin", coordinates: { lat: 31.7, lng: 35.2 }, extra: [1, null, { a: true }] };
  const s = sheetOf(makeModule("text", {}, { id: "a" }), unknown, makeModule("text", {}, { id: "b" }));
  const added = addModule(s, makeModule("pageBreak", {}, { id: "c" }), 1, at(T1));
  assert.deepEqual(added.modules[2], unknown);
  const moved = moveModule(added, "a", 3, at(T1));
  assert.deepEqual(moved.modules.find((m) => m.id === "u"), unknown);
  const moveUnknown = moveModule(s, "u", 0, at(T1));
  assert.deepEqual(moveUnknown.modules[0], unknown);
  const removed = removeModule(s, "a", at(T1));
  assert.deepEqual(removed.modules[0], unknown);
  assert.deepEqual(removeModule(s, "u", at(T1)).modules.map((m) => m.id), ["a", "b"]);
  assert.deepEqual(validateRecord(moved), []);
});

test("every operation refuses a sheet this version can't edit, and anything that isn't a sheet", () => {
  const newer = { ...sheetOf(makeModule("text", {}, { id: "a" })), sheetFormat: 2 };
  assert.throws(() => addModule(newer, makeModule("pageBreak"), 0, at(T1)), /can't be edited/);
  assert.throws(() => moveModule(newer, "a", 0, at(T1)), /can't be edited/);
  assert.throws(() => removeModule(newer, "a", at(T1)), /can't be edited/);
  assert.throws(() => updateModule(newer, "a", { html: "" }, at(T1)), /can't be edited/);
  assert.throws(() => setSheetFields(newer, { title: "x" }, at(T1)), /can't be edited/);
  const note = createRecord("note", { bookKey: "john", chapter: 3, verse: 16, body: "x", marker: "note" }, { ...ctx, now: T0 });
  assert.throws(() => removeModule(note, "a", at(T1)), /not a sheet/);
  assert.throws(() => addModule(undefined, makeModule("pageBreak"), 0, at(T1)), /not a sheet/);
});

/* ── The notebook's store plans and history ──────────────────────────── */

test("planSave puts a good sheet and refuses a malformed one", () => {
  const s = sheetOf(makeModule("text", { html: "<p>Hi</p>" }, { id: "t" }));
  assert.deepEqual(planSave(s), { put: [s], remove: [] });
  assert.throws(() => planSave({ ...s, modules: [{ id: "t", type: "text", html: "<div>raw</div>" }] }), /formatted-text form/);
  assert.throws(() => planSave({ ...s, modules: [{ id: "s", type: "space", lines: 0 }] }), /lines/);
  assert.throws(() => planSave({ ...s, title: "x".repeat(201) }), /title/);
  assert.throws(() => planWrite({ put: [{ ...s, template: "" }], remove: [] }), /template/);
  assert.doesNotThrow(() => planSave({ ...s, sheetFormat: 2, modules: "newer" }), "a newer format is the newer client's to judge");
});

test("a sheet is deleted to the trash and brought back whole, and an undo outlasts the deletion", () => {
  const s = sheetOf(makePassageModule(), makeModule("text", { html: "<p>Hi</p>" }, { id: "t" }));
  const del = planDelete(s, { ...ctx, now: T1, id: nextId() });
  assert.deepEqual(del.remove, [s.id]);
  assert.equal(del.trash.deletedKind, "sheet");
  assert.deepEqual(del.trash.record, s);
  const undo = planUndo(del.trash, { now: T2, client: "web/2026.11" });
  assert.deepEqual(undo.remove, [del.trash.id]);
  assert.equal(undo.record.modified, T2);
  assert.deepEqual({ ...undo.record, modified: s.modified, client: s.client }, s);
  assert.doesNotThrow(() => planWrite(undo));
  // A sheet of a newer format comes back exactly as it was deleted.
  const newer = { ...s, sheetFormat: 2, futureField: 1 };
  const back = planUndo(planDelete(newer, { ...ctx, now: T1, id: nextId() }).trash, { now: T2, client: "web/2026.11" });
  assert.deepEqual(back.record, newer);
});

function makePassageModule() {
  return makeModule("passage", { bookKey: "romans", chapter: 8, verse: 1, endVerse: 4 }, { id: "p" });
}

test("history: a sheet edit takes back, redoes, and is overtaken by another change", () => {
  const s = sheetOf(makeModule("text", { html: "<p>One</p>" }, { id: "t" }));
  const edited = updateModule(s, "t", { html: "<p>Two</p>" }, at(T1));
  const entry = makeEntry({ put: [edited], remove: [] }, new Map([[s.id, s]]), "e");
  assert.equal(describeEntry(entry), "Sheet “T” changed.");
  assert.equal(stillCurrent(entry, new Map([[s.id, edited]]), "undo"), true);
  const [back] = inversePlan(entry, at(T2)).put;
  assert.equal(back.modules[0].html, "<p>One</p>");
  assert.equal(back.modified, T2);
  assert.ok(Date.parse(back.modified) > Date.parse(edited.modified));
  assert.deepEqual(validateRecord(back), []);
  const [again] = redoPlan(entry, at(T2)).put;
  assert.equal(again.modules[0].html, "<p>Two</p>");
  const later = updateModule(edited, "t", { html: "<p>Three</p>" }, at(T2));
  assert.equal(stillCurrent(entry, new Map([[s.id, later]]), "undo"), false);
});

test("history: a sheet deletion describes itself and undoes", () => {
  const s = sheetOf(makeModule("text", {}, { id: "t" }));
  const plan = planDelete(s, { ...ctx, now: T1, id: nextId() });
  const entry = makeEntry(plan, new Map([[s.id, s]]), "e");
  assert.equal(describeEntry(entry), "Sheet “T” removed.");
  const undo = inversePlan(entry, at(T2));
  assert.deepEqual(undo.remove, [plan.trash.id]);
  assert.equal(undo.put[0].id, s.id);
  assert.equal(undo.put[0].modified, T2);
  assert.equal(stillCurrent(entry, new Map([[s.id, null], [plan.trash.id, plan.trash]]), "undo"), true);
  // And the sheet coming back reads as restored.
  const restore = makeEntry({ put: [undo.put[0]], remove: [plan.trash.id] }, new Map([[plan.trash.id, plan.trash]]), "e2");
  assert.equal(describeEntry(restore), "Sheet “T” restored.");
});

test("history: a new sheet is added, and an untitled one is named so", () => {
  const s = createSheet({}, { ...ctx, now: T0, id: nextId() });
  assert.equal(describeEntry(makeEntry({ put: [s], remove: [] }, new Map(), "e")), "Sheet “Untitled” added.");
  const named = setSheetFields(s, { title: "Freedom" }, at(T1));
  assert.equal(describeEntry(makeEntry({ put: [named], remove: [] }, new Map([[s.id, s]]), "e")), "Sheet “Freedom” changed.");
});

/* ── Changing a sheet over what the store holds now (BA129, BA128) ───── */

/**
 * A stand-in for the notebook store's `change(build)` (src/scripts/desk/store.js):
 * it runs build({ get, all }) over the stored records, and only if build returns
 * without throwing applies the { put, remove } it gave back. Each get() hands out
 * a copy, as IndexedDB does, so no tab can reach into what is stored.
 */
function stubStore(records) {
  const map = new Map(records.map((r) => [r.id, structuredClone(r)]));
  return {
    map,
    async change(build) {
      const plan = await build({
        get: async (id) => structuredClone(map.get(id)) ?? undefined,
        all: async () => [...map.values()].map((r) => structuredClone(r)),
      });
      for (const r of plan?.put ?? []) map.set(r.id, structuredClone(r));
      for (const id of plan?.remove ?? []) map.delete(id);
      return plan;
    },
  };
}

/** What the sheet pane's change() does: plan the operation over the record as stored now. */
const changeThrough = (store, id, op) => store.change(async ({ get }) => planSheetChange(await get(id), op));

const twoTexts = () => sheetOf(makeModule("text", { html: "<p>X0</p>" }, { id: "x" }), makeModule("text", { html: "<p>Y0</p>" }, { id: "y" }));
const htmlOf = (sheet, id) => sheet.modules.find((m) => m.id === id).html;

test("BA129: two tabs editing different parts of one sheet keep both edits", async () => {
  const sheet = twoTexts();
  const store = stubStore([sheet]);
  // Both tabs opened the sheet as it was; neither hears the other's save.
  const tabA = structuredClone(sheet);
  const tabB = structuredClone(sheet);

  await changeThrough(store, sheet.id, (s) => updateModule(s, "x", { html: "<p>X by B</p>" }, at(T1)));
  const plan = await changeThrough(store, sheet.id, (s) => updateModule(s, "y", { html: "<p>Y by A</p>" }, at(T2)));

  assert.equal(plan.changed, true);
  const stored = store.map.get(sheet.id);
  assert.equal(htmlOf(stored, "x"), "<p>X by B</p>");
  assert.equal(htmlOf(stored, "y"), "<p>Y by A</p>");
  assert.equal(stored.modified, T2);
  assert.deepEqual(validateRecord(stored), []);

  // Why it matters: the old way applied A's edit to A's stale copy and saved
  // the whole sheet, which wrote B's edit away.
  const old = new Map([[sheet.id, tabB]]);
  const savedByB = updateModule(tabB, "x", { html: "<p>X by B</p>" }, at(T1));
  old.set(sheet.id, savedByB);
  const savedByA = updateModule(tabA, "y", { html: "<p>Y by A</p>" }, at(T2));
  old.set(sheet.id, savedByA);
  assert.equal(htmlOf(old.get(sheet.id), "y"), "<p>Y by A</p>");
  assert.equal(htmlOf(old.get(sheet.id), "x"), "<p>X0</p>", "the stale copy loses the other tab's edit");
});

test("BA128: an edit that pushes the sheet past its size limit throws and writes nothing", async () => {
  const sheet = twoTexts();
  const store = stubStore([sheet]);
  const before = structuredClone(store.map.get(sheet.id));
  const huge = `<p>${"a".repeat(600 * 1024)}</p>`;

  let thrown;
  try {
    await changeThrough(store, sheet.id, (s) => updateModule(s, "x", { html: huge }, at(T1)));
  } catch (e) {
    thrown = e;
  }
  assert.ok(thrown, "planSheetChange throws, so the store's transaction writes nothing");
  assert.equal(sheetTooBig(thrown), true);
  assert.deepEqual(store.map.get(sheet.id), before);

  // The tab keeps the last saved copy, so the next small edit still saves.
  const plan = await changeThrough(store, sheet.id, (s) => updateModule(s, "y", { html: "<p>Y small</p>" }, at(T2)));
  assert.equal(plan.changed, true);
  const stored = store.map.get(sheet.id);
  assert.equal(htmlOf(stored, "y"), "<p>Y small</p>");
  assert.equal(htmlOf(stored, "x"), "<p>X0</p>");
});

test("planSheetChange: nothing to change when there is no editable sheet", () => {
  const op = () => assert.fail("the operation must not run");
  assert.deepEqual(planSheetChange(null, op), { gone: true });
  assert.deepEqual(planSheetChange(undefined, op), { gone: true });
  const note = { id: nextId(), kind: "note", modified: T0 };
  assert.deepEqual(planSheetChange(note, op), { gone: true });
  const newer = { ...sheetOf(makeModule("text", {}, { id: "t" })), sheetFormat: SHEET_FORMAT + 1 };
  assert.deepEqual(planSheetChange(newer, op), { gone: true });
});

test("planSheetChange: an operation that refuses comes back as refused, not thrown", () => {
  const modules = Array.from({ length: SHEET_LIMITS.modules }, (_, i) => makeModule("text", {}, { id: `m${i}` }));
  const full = sheetOf(...modules);
  const out = planSheetChange(full, (s) => addModule(s, makeModule("text", {}, { id: "one-more" }), undefined, at(T1)));
  assert.equal(Object.keys(out).join(), "refused");
  assert.ok(out.refused instanceof Error);
  assert.match(out.refused.message, new RegExp(`at most ${SHEET_LIMITS.modules} modules`));
});

test("planSheetChange: a change that changes nothing returns the very same sheet", () => {
  const s = twoTexts();
  const out = planSheetChange(s, (cur) => updateModule(cur, "x", { html: "<p>X0</p>" }, at(T1)));
  assert.deepEqual(Object.keys(out).sort(), ["changed", "sheet"]);
  assert.equal(out.changed, false);
  assert.equal(out.sheet, s);
});

test("planSheetChange: a change comes back as a plan to put the new sheet", () => {
  const s = twoTexts();
  const out = planSheetChange(s, (cur) => updateModule(cur, "x", { html: "<p>X1</p>" }, at(T1)));
  assert.equal(out.changed, true);
  assert.equal(htmlOf(out.sheet, "x"), "<p>X1</p>");
  assert.equal(out.put.length, 1);
  assert.equal(out.put[0], out.sheet);
  assert.deepEqual(out.remove, []);
  assert.equal(out.sheet.modified, T1);
  assert.equal(htmlOf(s, "x"), "<p>X0</p>", "the record it was given is not touched");
});

test("sheetTooBig: only the size limit's error is the size limit", () => {
  assert.equal(sheetTooBig(new Error("desk-sheets: not a sheet")), false);
  assert.equal(sheetTooBig(new Error("QuotaExceededError")), false);
  assert.equal(sheetTooBig(undefined), false);
  assert.equal(sheetTooBig(null), false);
  assert.equal(sheetTooBig("a sheet is at most 512 KB"), false, "a string is not an error");
  assert.equal(sheetTooBig(new Error("desk-store: not saved (… a sheet is at most 512 KB …)")), true);
});
