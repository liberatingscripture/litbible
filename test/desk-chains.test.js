// test/desk-chains.test.js
//
// src/lib/desk-chains.mjs: "your own chains" (STUDY-DESK.md N4, phase 2a).
// What these guard: a note's body is the reader's own text, so it must be
// escaped before anything links it (typed HTML stays text); a LIT reference
// in a note becomes a chain that previews and that the cited verse can name
// ("Mentioned in your note on …"); a Hebrew Bible reference links out and is
// never a chain; and a note never counts as a mention of the verse it sits
// on, while a whole-chapter citation counts for every verse in the chapter.

import { test } from "node:test";
import assert from "node:assert/strict";

import { citedRefs, escapeText, noteBodyHtml, notesCiting } from "../src/lib/desk-chains.mjs";

const note = (id, bookKey, chapter, verse, body, extra = {}) => ({
  id,
  kind: "note",
  bookKey,
  chapter,
  verse,
  body,
  ...extra,
});

test("escapeText escapes the five HTML-significant characters and tolerates nullish input", () => {
  assert.equal(escapeText(`<b>&"`), "&lt;b&gt;&amp;&quot;");
  assert.equal(escapeText("a > b < c"), "a &gt; b &lt; c");
  assert.equal(escapeText(null), "");
  assert.equal(escapeText(undefined), "");
  assert.equal(escapeText(42), "42", "a non-string is coerced, not thrown on");
});

test("a note's body is escaped, so typed markup stays text", () => {
  const html = noteBodyHtml("<b>bold</b> & <script>x</script>");
  assert.ok(html.includes("&lt;b&gt;bold&lt;/b&gt;"), html);
  assert.ok(html.includes("&lt;script&gt;x&lt;/script&gt;"), html);
  assert.ok(!html.includes("<b>"), "no real bold tag gets through");
  assert.ok(!html.includes("<script"), "no real script tag gets through");
});

test("a LIT reference inside typed text is linked after escaping", () => {
  const html = noteBodyHtml("<b>See</b> Rom 8:28");
  assert.ok(html.includes(`<a class="sref" href="/romans-8/#v28">Rom 8:28</a>`), html);
  assert.ok(html.startsWith("&lt;b&gt;See&lt;/b&gt; "), html);
});

test("typed anchor markup is escaped, not turned into a link of the reader's own", () => {
  const html = noteBodyHtml('<a href="https://example.com">Rom 8:28</a>');
  assert.ok(!html.includes('<a href="https://example.com"'), html);
  assert.ok(html.includes(`<a class="sref" href="/romans-8/#v28">Rom 8:28</a>`), html);
});

test("a Hebrew Bible reference links out to Sefaria in a new tab and is not a chain", () => {
  const html = noteBodyHtml("Ps 22:1");
  assert.match(html, /<a class="sefaria-ref" href="https:\/\/www\.sefaria\.org\/Psalms\.22\.2[^"]*"/, html);
  assert.ok(html.includes('target="_blank"'), html);
  assert.deepEqual(citedRefs("Ps 22:1"), [], "the Hebrew Bible is not one of the LIT's verses");
});

test("citedRefs reads a verse, a range, and a whole chapter, and dedupes repeats", () => {
  const refs = citedRefs("Rom 8:28 and 1 Cor 13:4–7 and John 3 and Rom 8:28");
  assert.deepEqual(refs, [
    { bookKey: "romans", chapter: 8, from: 28, to: 28 },
    { bookKey: "1corinthians", chapter: 13, from: 4, to: 7 },
    { bookKey: "john", chapter: 3, from: null, to: null },
  ]);
});

test("citedRefs cites a list continuation only when it has its own chapter:verse (BA89)", () => {
  assert.deepEqual(citedRefs("Romans 8:28, 30"), [{ bookKey: "romans", chapter: 8, from: 28, to: 28 }], "a bare 30 is prose");
  assert.deepEqual(citedRefs("See Romans 8:28, 3 reasons why"), [{ bookKey: "romans", chapter: 8, from: 28, to: 28 }]);
  assert.deepEqual(citedRefs("John 3:16 and 2 others"), [{ bookKey: "john", chapter: 3, from: 16, to: 16 }]);
  assert.deepEqual(citedRefs("Luke 2:1, 100 years"), [{ bookKey: "luke", chapter: 2, from: 1, to: 1 }]);
  assert.deepEqual(citedRefs("Romans 8:28, 9:1"), [
    { bookKey: "romans", chapter: 8, from: 28, to: 28 },
    { bookKey: "romans", chapter: 9, from: 1, to: 1 },
  ]);
  assert.deepEqual(citedRefs("Romans 8:28; 9:1"), [
    { bookKey: "romans", chapter: 8, from: 28, to: 28 },
    { bookKey: "romans", chapter: 9, from: 1, to: 1 },
  ]);
  assert.deepEqual(citedRefs("John 3:16 and 4:2"), [
    { bookKey: "john", chapter: 3, from: 16, to: 16 },
    { bookKey: "john", chapter: 4, from: 2, to: 2 },
  ]);
});

test("citedRefs ignores a verse past the end of its chapter (BA89)", () => {
  assert.deepEqual(citedRefs("Luke 2:100"), []);
  assert.deepEqual(citedRefs("Luke 2:52"), [{ bookKey: "luke", chapter: 2, from: 52, to: 52 }]);
  assert.deepEqual(citedRefs("Matthew 17:21"), [{ bookKey: "matthew", chapter: 17, from: 21, to: 21 }], "a gap inside the chapter still counts");
});

test("citedRefs reads any case, short names, and a period between chapter and verse (BA94)", () => {
  assert.deepEqual(citedRefs("john 3:16 and Gal 3.28 and 1Cor 13:4 and Mt 5:3"), [
    { bookKey: "john", chapter: 3, from: 16, to: 16 },
    { bookKey: "galatians", chapter: 3, from: 28, to: 28 },
    { bookKey: "1corinthians", chapter: 13, from: 4, to: 4 },
    { bookKey: "matthew", chapter: 5, from: 3, to: 3 },
  ]);
  assert.deepEqual(citedRefs("mark 3 places and jn 3"), [], "a short or lowercase name needs a verse");
  assert.deepEqual(citedRefs("Mark 3"), [{ bookKey: "mark", chapter: 3, from: null, to: null }]);
  assert.deepEqual(citedRefs("gen 1:1 and the meeting is 3:15"), []);
});

test("citedRefs expands a range into a later chapter, one entry per chapter (BA94)", () => {
  assert.deepEqual(citedRefs("John 3:16–4:2"), [
    { bookKey: "john", chapter: 3, from: 16, to: 36 },
    { bookKey: "john", chapter: 4, from: 1, to: 2 },
  ]);
  assert.deepEqual(citedRefs("Hebrews 6–9"), [6, 7, 8, 9].map((chapter) => ({ bookKey: "hebrews", chapter, from: null, to: null })));
  assert.deepEqual(citedRefs("Galatians 5:25–6:1"), [
    { bookKey: "galatians", chapter: 5, from: 25, to: 26 },
    { bookKey: "galatians", chapter: 6, from: 1, to: 1 },
  ]);
});

test("citedRefs gives an invalid range end only its start (BA94)", () => {
  assert.deepEqual(citedRefs("John 21:25–22:1"), [{ bookKey: "john", chapter: 21, from: 25, to: 25 }], "John has 21 chapters");
});

test("a chapter-spanning range counts for a verse in a middle or last chapter (BA94)", () => {
  const records = [note("span", "romans", 1, 1, "John 3:16–5:3")];
  assert.equal(notesCiting(records, { bookKey: "john", chapter: 3, verse: 20 }).length, 1, "first chapter, after the start");
  assert.equal(notesCiting(records, { bookKey: "john", chapter: 3, verse: 15 }).length, 0, "first chapter, before the start");
  assert.equal(notesCiting(records, { bookKey: "john", chapter: 4, verse: 30 }).length, 1, "middle chapter");
  assert.equal(notesCiting(records, { bookKey: "john", chapter: 5, verse: 3 }).length, 1, "last chapter, at the end");
  assert.equal(notesCiting(records, { bookKey: "john", chapter: 5, verse: 4 }).length, 0, "last chapter, past the end");
});

test("noteBodyHtml writes data-end on a range into a later chapter, and none otherwise (BA94)", () => {
  assert.ok(noteBodyHtml("John 3:16–4:2").includes(' data-end="4:2"'));
  assert.ok(noteBodyHtml("Hebrews 6–9").includes(' data-end="9"'));
  assert.ok(!noteBodyHtml("John 3:16–18").includes("data-end"));
  assert.ok(!noteBodyHtml("John 21:25–22:1").includes("data-end"));
});

test("noteBodyHtml follows note mode: no link for a bare continuation or a missing verse (BA89)", () => {
  const html = noteBodyHtml("See Romans 8:28, 3 reasons why");
  assert.equal((html.match(/<a /g) ?? []).length, 1, html);
  assert.ok(html.endsWith("</a>, 3 reasons why"), html);
  assert.equal(noteBodyHtml("Luke 2:100"), "Luke 2:100");
});

test("a long run of spaces does not stall noteBodyHtml (BA95)", () => {
  const text = "John" + " ".repeat(40000);
  const started = performance.now();
  const html = noteBodyHtml(text);
  const took = performance.now() - started;
  assert.equal(html, text);
  assert.ok(took < 50, `took ${took.toFixed(1)} ms`);
});

test("citedRefs is empty for a body with no references", () => {
  assert.deepEqual(citedRefs("Nothing cited here."), []);
  assert.deepEqual(citedRefs(""), []);
});

test("notesCiting finds a note on Romans 4:7 that cites Romans 8:28", () => {
  const records = [note("a", "romans", 4, 7, "compare Rom 8:28")];
  const hits = notesCiting(records, { bookKey: "romans", chapter: 8, verse: 28 });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].record.id, "a");
  assert.deepEqual(hits[0].ref, { bookKey: "romans", chapter: 8, from: 28, to: 28 });
});

test("notesCiting does not return a note sitting on the verse that cites it", () => {
  const records = [note("self", "romans", 8, 28, "my own Rom 8:28 gloss")];
  assert.deepEqual(notesCiting(records, { bookKey: "romans", chapter: 8, verse: 28 }), []);
});

test("notesCiting counts a whole-chapter citation for every verse in it", () => {
  const records = [note("ch", "romans", 4, 7, "all of Romans 8 bears on this")];
  for (const verse of [1, 28, 39]) {
    const hits = notesCiting(records, { bookKey: "romans", chapter: 8, verse });
    assert.equal(hits.length, 1, `verse ${verse}`);
    assert.deepEqual(hits[0].ref, { bookKey: "romans", chapter: 8, from: null, to: null });
  }
});

test("notesCiting keeps a whole-chapter citation out of another chapter", () => {
  const records = [note("ch", "romans", 4, 7, "all of Romans 8")];
  assert.deepEqual(notesCiting(records, { bookKey: "romans", chapter: 7, verse: 1 }), []);
});

test("notesCiting matches a verse range against the verse asked about", () => {
  const records = [note("r", "john", 1, 1, "John 3:16–18")];
  assert.equal(notesCiting(records, { bookKey: "john", chapter: 3, verse: 18 }).length, 1, "inside the range");
  assert.equal(notesCiting(records, { bookKey: "john", chapter: 3, verse: 19 }).length, 0, "after the range");
});

test("notesCiting ignores highlights, bookmarks and notes with empty bodies", () => {
  const records = [
    { id: "hl", kind: "highlight", bookKey: "romans", chapter: 4, verse: 7, color: "yellow", body: "Rom 8:28" },
    { id: "bm", kind: "bookmark", bookKey: "romans", chapter: 4, verse: 7, body: "Rom 8:28" },
    note("empty", "romans", 4, 7, ""),
    note("blank", "romans", 4, 7, "   \n  "),
    note("none", "romans", 4, 7, undefined),
  ];
  assert.deepEqual(notesCiting(records, { bookKey: "romans", chapter: 8, verse: 28 }), []);
});

test("notesCiting skips deleted notes", () => {
  const records = [note("gone", "romans", 4, 7, "Rom 8:28", { deleted: true })];
  assert.deepEqual(notesCiting(records, { bookKey: "romans", chapter: 8, verse: 28 }), []);
});

test("notesCiting includes a glossary-entry note that cites the verse", () => {
  const entry = { id: "g1", kind: "note", glossaryEntry: "flesh-body", body: "See Romans 8:3 on the flesh." };
  const hits = notesCiting([entry], { bookKey: "romans", chapter: 8, verse: 3 });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].record.id, "g1");
});

test("notesCiting returns hits in the citing notes' own order: Bible order, chapter, verse, then created (BA93)", () => {
  const records = [
    note("c-1corinthians", "1corinthians", 1, 1, "Rom 8:28", { created: "2026-01-01T00:00:00.000Z" }),
    note("b-romans-5", "romans", 5, 1, "Rom 8:28", { created: "2026-01-01T00:00:00.000Z" }),
    note("a-romans-4-v9", "romans", 4, 9, "Rom 8:28", { created: "2026-01-02T00:00:00.000Z" }),
    note("a-romans-4-v1-late", "romans", 4, 1, "Rom 8:28", { created: "2026-01-03T00:00:00.000Z" }),
    note("a-romans-4-v1-early", "romans", 4, 1, "Rom 8:28", { created: "2026-01-01T00:00:00.000Z" }),
    note("z-matthew", "matthew", 5, 3, "Rom 8:28", { created: "2026-02-01T00:00:00.000Z" }),
  ];
  const ids = (list) => notesCiting(list, { bookKey: "romans", chapter: 8, verse: 28 }).map((h) => h.record.id);
  const expected = ["z-matthew", "a-romans-4-v1-early", "a-romans-4-v1-late", "a-romans-4-v9", "b-romans-5", "c-1corinthians"];
  assert.deepEqual(ids(records), expected);
  assert.deepEqual(ids([...records].reverse()), expected, "the order doesn't depend on the order given");
});

test("notesCiting puts notes with no book (glossary or article notes) after the rest (BA93)", () => {
  const entry = { id: "g1", kind: "note", glossaryEntry: "flesh-body", body: "See Romans 8:28.", created: "2026-01-01T00:00:00.000Z" };
  const records = [entry, note("late-book", "revelation", 1, 1, "Rom 8:28"), note("early-book", "matthew", 1, 1, "Rom 8:28")];
  const ids = notesCiting(records, { bookKey: "romans", chapter: 8, verse: 28 }).map((h) => h.record.id);
  assert.deepEqual(ids, ["early-book", "late-book", "g1"]);
});

test("notesCiting tolerates a missing notebook", () => {
  assert.deepEqual(notesCiting(undefined, { bookKey: "romans", chapter: 8, verse: 28 }), []);
});

test("notesCiting lists a note on a footnote that cites its own verse, but not a verse note that does (BA20)", () => {
  const onFootnote = note("fn", "romans", 8, 3, "See Romans 8:3", {
    footnote: "Greek sarx, flesh; the whole self.",
    n: 2,
    marker: "note",
  });
  const verseNote = note("vn", "romans", 8, 3, "See Romans 8:3", { marker: "note" });
  const hits = notesCiting([onFootnote, verseNote], { bookKey: "romans", chapter: 8, verse: 3 });
  assert.deepEqual(hits.map((h) => h.record.id), ["fn"]);
  assert.deepEqual(hits[0].ref, { bookKey: "romans", chapter: 8, from: 3, to: 3 });
});
