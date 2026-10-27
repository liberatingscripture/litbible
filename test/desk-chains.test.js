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

test("citedRefs reads a list continuation after a verse", () => {
  assert.deepEqual(citedRefs("Romans 8:28, 30"), [
    { bookKey: "romans", chapter: 8, from: 28, to: 28 },
    { bookKey: "romans", chapter: 8, from: 30, to: 30 },
  ]);
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

test("notesCiting returns hits in the order the records are given, not sorted", () => {
  const records = [
    note("later-verse", "romans", 5, 1, "Rom 8:28"),
    note("earlier-verse", "romans", 4, 1, "Rom 8:28"),
  ];
  const ids = notesCiting(records, { bookKey: "romans", chapter: 8, verse: 28 }).map((h) => h.record.id);
  assert.deepEqual(ids, ["later-verse", "earlier-verse"]);
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
