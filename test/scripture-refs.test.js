// test/scripture-refs.test.js
//
// Unit tests for src/lib/scripture-refs.mjs, the render-time linker that turns
// plain-text NT references in footnotes, intros, articles, glossary bodies and
// release notes into links. Most cases are lifted from the corpus as it stood
// on 2026-09-27, so each one is a shape a reader actually meets.

import { test } from "node:test";
import assert from "node:assert/strict";

import { linkScriptureRefs, mapHtmlText } from "../src/lib/scripture-refs.mjs";

// Every verse exists unless a test says otherwise.
const link = (html, opts) => linkScriptureRefs(html, opts);
const hrefs = (html, opts) =>
  [...link(html, opts).matchAll(/<a class="sref" href="([^"]+)"[^>]*>([^<]*)<\/a>/g)].map(
    (m) => [m[2], m[1]]
  );

test("a single reference links to its verse, with a trailing slash", () => {
  assert.equal(
    link("as it is written (Romans 2:24)."),
    'as it is written (<a class="sref" href="/romans-2/#v24">Romans 2:24</a>).'
  );
});

test("verse ranges keep both ends in the fragment; hyphen or en dash", () => {
  assert.deepEqual(hrefs("1 Corinthians 12:12-27"), [["1 Corinthians 12:12-27", "/1corinthians-12/#v12-27"]]);
  assert.deepEqual(hrefs("Matthew 5:3–12"), [["Matthew 5:3–12", "/matthew-5/#v3-12"]]);
});

test("chapter-only references and chapter ranges link to the chapter", () => {
  assert.deepEqual(hrefs("the letter (1 Corinthians 13), Paul"), [["1 Corinthians 13", "/1corinthians-13/"]]);
  assert.deepEqual(hrefs("(2 Corinthians 10–13)"), [["2 Corinthians 10–13", "/2corinthians-10/"]]);
  assert.deepEqual(hrefs("Melchizedek (Hebrews 6-9), opening"), [["Hebrews 6-9", "/hebrews-6/"]]);
});

test("a cross-chapter range links its start", () => {
  assert.deepEqual(hrefs("Galatians 5:25–6:1"), [["Galatians 5:25–6:1", "/galatians-5/#v25"]]);
});

test("\"1 John\" is never read as \"John\"", () => {
  assert.deepEqual(hrefs("the same word in 1 John 4:10 and John 4:10"), [
    ["1 John 4:10", "/1john-4/#v10"],
    ["John 4:10", "/john-4/#v10"],
  ]);
});

test("semicolon lists: a C:V continues the book, a bare number after ; does not", () => {
  assert.deepEqual(hrefs("(Matthew 3:17; John 3:35; 5:20)"), [
    ["Matthew 3:17", "/matthew-3/#v17"],
    ["John 3:35", "/john-3/#v35"],
    ["5:20", "/john-5/#v20"],
  ]);
  // "; 36" could be a chapter or a verse, so it stays plain.
  assert.equal(
    link("(John 5:19–22; 36)"),
    '(<a class="sref" href="/john-5/#v19-22">John 5:19–22</a>; 36)'
  );
});

test("comma and \"and\" lists continue with verses of the same chapter", () => {
  assert.deepEqual(hrefs("See 1 Corinthians 1:8, 3:13, and 4:3."), [
    ["1 Corinthians 1:8", "/1corinthians-1/#v8"],
    ["3:13", "/1corinthians-3/#v13"],
    ["4:3", "/1corinthians-4/#v3"],
  ]);
  assert.deepEqual(hrefs("(Ephesians 4:10–16, 25; 5:28–31)"), [
    ["Ephesians 4:10–16", "/ephesians-4/#v10-16"],
    ["25", "/ephesians-4/#v25"],
    ["5:28–31", "/ephesians-5/#v28-31"],
  ]);
  assert.deepEqual(hrefs("Key Passages Ephesians 1:7, 8, 10b: “Through"), [
    ["Ephesians 1:7", "/ephesians-1/#v7"],
    ["8", "/ephesians-1/#v8"],
    ["10b", "/ephesians-1/#v10"],
  ]);
  assert.deepEqual(hrefs("2 Timothy 2:14-17, 19: “Keep"), [
    ["2 Timothy 2:14-17", "/2timothy-2/#v14-17"],
    ["19", "/2timothy-2/#v19"],
  ]);
});

test("chapter-only lists continue with chapters", () => {
  assert.deepEqual(hrefs("In 1 Corinthians 11 and 14, Paul’s words"), [
    ["1 Corinthians 11", "/1corinthians-11/"],
    ["14", "/1corinthians-14/"],
  ]);
});

test("a verse-part suffix stays in the link text and out of the fragment", () => {
  assert.deepEqual(hrefs("Rom 1:26b and Rom 1:27a"), [
    ["Rom 1:26b", "/romans-1/#v26"],
    ["Rom 1:27a", "/romans-1/#v27"],
  ]);
});

test("SBL abbreviations, with or without a period", () => {
  assert.deepEqual(hrefs("(1 Cor 2:3) … (2 Cor. 7:15) … Matt 10:37 … Heb 13:12"), [
    ["1 Cor 2:3", "/1corinthians-2/#v3"],
    ["2 Cor. 7:15", "/2corinthians-7/#v15"],
    ["Matt 10:37", "/matthew-10/#v37"],
    ["Heb 13:12", "/hebrews-13/#v12"],
  ]);
});

test("a one-chapter book's number is a verse", () => {
  assert.deepEqual(hrefs("Compare to Philemon 9."), [["Philemon 9", "/philemon-1/#v9"]]);
  assert.deepEqual(hrefs("Jude 5–7"), [["Jude 5–7", "/jude-1/#v5-7"]]);
});

test("Hebrew Bible references never link, and neither do their continuations", () => {
  assert.equal(
    link("Isaiah 7:1–10:4, especially 7:14 and 8:8–10"),
    "Isaiah 7:1–10:4, especially 7:14 and 8:8–10"
  );
  assert.deepEqual(hrefs("(Genesis 1:2 NASB) and Mark 15:34"), [["Mark 15:34", "/mark-15/#v34"]]);
});

test("a reference tagged with another translation stays plain", () => {
  for (const s of [
    "all from their masters’ table.” (Matthew 15:21-27 NRSVue) Jesus",
    "(2 Corinthians 13:10 NRSVue)",
    "(Mark 7:21-22 ESV)",
    "(John 12:16 NIV).",
    "Matthew 5:3, ESV",
    "Matthew 5:3 (NRSV)",
  ]) {
    assert.equal(link(s), s, s);
  }
  // The tag covers the whole list before it.
  assert.equal(link("Matthew 5:3–12; 6:1 NRSVue"), "Matthew 5:3–12; 6:1 NRSVue");
  // Our own tag links; so does a tag that doesn't follow the reference directly.
  assert.deepEqual(hrefs("(Colossians 3:11 LIT)"), [["Colossians 3:11", "/colossians-3/#v11"]]);
  assert.deepEqual(hrefs("Matthew 15:21–27 (see NRSVue)"), [["Matthew 15:21–27", "/matthew-15/#v21-27"]]);
});

test("bare chapter:verse with no book never links", () => {
  assert.equal(link("(1:20–25)"), "(1:20–25)");
  assert.equal(link("TDNT (1:464)"), "TDNT (1:464)");
});

test("a chapter the book doesn't have is not a reference", () => {
  assert.equal(link("John 30:1"), "John 30:1");
  assert.equal(link("Jude 0"), "Jude 0");
});

test("text already inside a link, script or code is left alone", () => {
  const html = '(<a href="/hebrews-10">Hebrews 10:32–34</a>) and Hebrews 11:1';
  assert.equal(
    link(html),
    '(<a href="/hebrews-10">Hebrews 10:32–34</a>) and <a class="sref" href="/hebrews-11/#v1">Hebrews 11:1</a>'
  );
  assert.equal(link("<code>John 3:16</code>"), "<code>John 3:16</code>");
});

test("attributes are never touched", () => {
  const html = '<span title="John 3:16">see</span>';
  assert.equal(link(html), html);
});

test("references inside inline markup still link", () => {
  assert.equal(
    link("<strong>1 Peter 2:9-10</strong>: “You are"),
    '<strong><a class="sref" href="/1peter-2/#v9-10">1 Peter 2:9-10</a></strong>: “You are'
  );
});

test("a non-breaking space between name and number is a space", () => {
  assert.deepEqual(hrefs("1&nbsp;Corinthians&nbsp;13:4"), [["1&nbsp;Corinthians&nbsp;13:4", "/1corinthians-13/#v4"]]);
});

test("a source typo like \"1: Corinthians\" doesn't link or crash", () => {
  assert.equal(link("in 1: Corinthians 1:8 and 3:13."), "in 1: Corinthians 1:8 and 3:13.");
});

test("hasVerse: a missing verse links the chapter; a missing continuation stops the list", () => {
  const hasVerse = (key, ch, v) => !(key === "matthew" && ch === 17 && v === 21);
  assert.deepEqual(hrefs("Matthew 17:21", { hasVerse }), [["Matthew 17:21", "/matthew-17/"]]);
  const upTo25 = (key, ch, v) => v <= 25;
  assert.deepEqual(hrefs("John 3:16, 1995", { hasVerse: upTo25 }), [["John 3:16", "/john-3/#v16"]]);
  // A range whose end is missing keeps just its start.
  assert.deepEqual(hrefs("John 3:16–30", { hasVerse: upTo25 }), [["John 3:16–30", "/john-3/#v16"]]);
});

test("isDraft marks the link for the preview", () => {
  const isDraft = (key) => key === "acts";
  assert.equal(
    link("Acts 2:1", { isDraft, hasVerse: () => false }),
    '<a class="sref" href="/acts-2/" data-draft>Acts 2:1</a>'
  );
});

test("mapHtmlText leaves tags and comments byte-identical", () => {
  const html = '<p class="x">a <!-- b --> <em>c</em></p>';
  assert.equal(mapHtmlText(html, (t) => t.toUpperCase()), '<p class="x">A <!-- b --> <em>C</em></p>');
});
