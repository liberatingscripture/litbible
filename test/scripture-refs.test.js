// test/scripture-refs.test.js
//
// Unit tests for src/lib/scripture-refs.mjs, the render-time linker that turns
// plain-text references in footnotes, intros, articles, glossary bodies and
// release notes into links: the New Testament to this site, the Hebrew Bible
// to Sefaria (the numbering map itself is tested in sefaria-refs.test.js). Most cases are lifted from the corpus as it stood
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
const ebible = (html, opts) =>
  [
    ...link(html, opts).matchAll(
      /<a class="ebible-ref" href="https:\/\/ebible\.org\/eng-web\/([^"]+)">([^<]*)<\/a>/g
    ),
  ].map((m) => [m[2], m[1]]);
const sefaria = (html, opts) =>
  [
    ...link(html, opts).matchAll(
      /<a class="sefaria-ref" href="https:\/\/www\.sefaria\.org\/([^"?]+)\?lang=en&amp;ven=[^"]+">([^<]*)<\/a>/g
    ),
  ].map((m) => [m[2], m[1]]);

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

test("Hebrew Bible references link to Sefaria, in Hebrew numbering", () => {
  assert.deepEqual(sefaria("See Deuteronomy 30:15 and Psalm 22:1."), [
    ["Deuteronomy 30:15", "Deuteronomy.30.15"],
    ["Psalm 22:1", "Psalms.22.2"],
  ]);
  // A range keeps its end, across a chapter too; the numbering maps both ends.
  assert.deepEqual(sefaria("Quotation of Joel 2:28–32; Isaiah 52:13–53:12."), [
    ["Joel 2:28–32", "Joel.3.1-5"],
    ["Isaiah 52:13–53:12", "Isaiah.52.13-53.12"],
  ]);
  // Continuations follow the same rules as the New Testament's.
  assert.deepEqual(sefaria("Isaiah 7:14 and 8:8–10; 9:6"), [
    ["Isaiah 7:14", "Isaiah.7.14"],
    ["8:8–10", "Isaiah.8.8-10"],
    ["9:6", "Isaiah.9.5"],
  ]);
  // A word between them ends the list, as it does for the New Testament.
  assert.deepEqual(sefaria("Isaiah 7:1–10:4, especially 7:14"), [["Isaiah 7:1–10:4", "Isaiah.7.1-10.4"]]);
  // A one-chapter book's number is a verse; a chapter the numbering moves
  // links its exact Hebrew range.
  assert.deepEqual(sefaria("Obadiah 15 and Malachi 4 and Job 38"), [
    ["Obadiah 15", "Obadiah.1.15"],
    ["Malachi 4", "Malachi.3.19-24"],
    ["Job 38", "Job.38"],
  ]);
  // Both halves in one text, each to its own place.
  assert.deepEqual(hrefs("(Genesis 1:2) and Mark 15:34"), [["Mark 15:34", "/mark-15/#v34"]]);
  assert.deepEqual(sefaria("(Genesis 1:2) and Mark 15:34"), [["Genesis 1:2", "Genesis.1.2"]]);
});

test("a numbered book after a list is a new reference, not another verse", () => {
  assert.deepEqual(hrefs("Romans 8:28 and 1 Corinthians 13:4"), [
    ["Romans 8:28", "/romans-8/#v28"],
    ["1 Corinthians 13:4", "/1corinthians-13/#v4"],
  ]);
  assert.deepEqual(sefaria("Isaiah 40:3, 5 and 1 Samuel 20:42"), [
    ["Isaiah 40:3", "Isaiah.40.3"],
    ["5", "Isaiah.40.5"],
    ["1 Samuel 20:42", "I_Samuel.20.42-21.1"],
  ]);
  // A book neither half carries ends the list without linking itself.
  assert.deepEqual(hrefs("Jude 14 and 1 Enoch 1:9"), [["Jude 14", "/jude-1/#v14"]]);
  assert.equal(link("1 Enoch 1:9"), "1 Enoch 1:9");
});

test("a Hebrew Bible reference in another text's numbering or wording stays plain", () => {
  for (const s of [
    "(Genesis 2:7 CEB)",
    "(Zechariah 9:10, Alter’s Translation)",
    "Psalm 40:6 LXX",
    "Psalm 51:4 (MT)",
    "Romans 3:4 (LXX Ps 51:4) quotes",
  ]) {
    assert.deepEqual(sefaria(s), [], s);
  }
  // The Greek or Hebrew "of" a verse is still cited in English numbering.
  assert.deepEqual(sefaria("the Hebrew of Psalm 51:4"), [["Psalm 51:4", "Psalms.51.6"]]);
});

test("the apocrypha link to the World English Bible on eBible.org", () => {
  // The notes' own citations; a range opens at its first verse.
  assert.deepEqual(ebible("Sirach 6:24–30; Sirach 14:20–27; Sirach 51:23–27; Wisdom 3:1"), [
    ["Sirach 6:24–30", "SIR06.htm#V24"],
    ["Sirach 14:20–27", "SIR14.htm#V20"],
    ["Sirach 51:23–27", "SIR51.htm#V23"],
    ["Wisdom 3:1", "WIS03.htm#V1"],
  ]);
  assert.deepEqual(ebible("an allusion to 2 Maccabees 7, where"), [["2 Maccabees 7", "2MA07.htm"]]);
  assert.deepEqual(ebible("Wisdom of Solomon 7:1 and Tobit 4:15"), [
    ["Wisdom of Solomon 7:1", "WIS07.htm#V1"],
    ["Tobit 4:15", "TOB04.htm#V15"],
  ]);
  // None of them goes to Sefaria any more.
  assert.deepEqual(sefaria("Sirach 51:23; Wisdom 3:1"), []);
  // "Wisdom" is a word too, so it needs a verse.
  assert.deepEqual(ebible("Wisdom 2:1 … the Wisdom 2 talk"), [["Wisdom 2:1", "WIS02.htm#V1"]]);
  // A verse the WEB leaves out, as modern English Bibles do, isn't a reference.
  assert.deepEqual(ebible("Sirach 26:20"), []);
  // Tagged with another translation, it cites that wording.
  assert.deepEqual(ebible("(Sirach 6:24 NRSV)"), []);
});

test("a book title in italics links with its numbers, the italics kept inside", () => {
  assert.equal(
    link("a reference to <em>Wisdom of Solomon</em> 7:1–2, “I also"),
    'a reference to <a class="ebible-ref" href="https://ebible.org/eng-web/WIS07.htm#V1"><em>Wisdom of Solomon</em> 7:1–2</a>, “I also'
  );
  assert.equal(
    link("(e.g., <em>Wisdom of Solomon</em> 7–10; <em>Sirach</em> 24)"),
    '(e.g., <a class="ebible-ref" href="https://ebible.org/eng-web/WIS07.htm"><em>Wisdom of Solomon</em> 7–10</a>; ' +
      '<a class="ebible-ref" href="https://ebible.org/eng-web/SIR24.htm"><em>Sirach</em> 24</a>)'
  );
  assert.equal(link("<em>Romans</em> 8:28"), '<a class="sref" href="/romans-8/#v28"><em>Romans</em> 8:28</a>');
  // Any other italic title is left exactly as it was, even one ending in a
  // book's name.
  for (const s of ["<em>Psalms of Solomon</em> 17", "Plato, <em>Republic</em> 413", "<em>Wisdom</em> is"]) {
    assert.equal(link(s), s, s);
  }
});

test("a chapter or verse English Bibles don't have is not a reference", () => {
  assert.equal(link("Psalm 151:1"), "Psalm 151:1");
  assert.equal(link("Malachi 5"), "Malachi 5");
  assert.equal(link("Genesis 1:40"), "Genesis 1:40");
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
