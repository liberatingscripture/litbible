// test/desk-sheet-passages.test.js
//
// Passages on a sheet (STUDY-DESK-FORMAT.md, "Sheets (kind 9)"): the pure
// module src/lib/desk-sheet-passages.mjs. Covers the reference wording, making
// a passage from whole verses, from a stretch of chapter text and from a
// notebook record, finding its words again in today's text, comparing two
// passages, and the order sheets are listed in. Chapters are small made-up
// ones built with anchor-core's assembleChapter.

import { test } from "node:test";
import assert from "node:assert/strict";

import { assembleChapter, rangeOf } from "../src/lib/anchor-core.mjs";
import { verseCopyFor } from "../src/lib/desk-records.mjs";
import { makeModule } from "../src/lib/desk-sheets.mjs";
import { templateModules } from "../src/lib/desk-sheet-templates.mjs";
import {
  locatePassage,
  passageForReference,
  passageFromOffsets,
  passageFromRecord,
  passageFromVerses,
  passageInsertIndex,
  passageReference,
  samePassage,
  sheetName,
  sortSheets,
} from "../src/lib/desk-sheet-passages.mjs";

const VERSION = "v20261019.9f8e7d6c";
const where = { bookKey: "john", chapter: 1 };

// "In the beginning was the word." / "The word was with God." /
// "All things came to be through it."
const chapter = assembleChapter(
  new Map([
    [1, "In the beginning was the word."],
    [2, "The word was with God."],
    [3, "All things came to be through it."],
  ]),
);

/* ── passageReference ────────────────────────────────────────────────── */

test("passageReference: a single verse has no range", () => {
  assert.equal(passageReference({ bookKey: "john", chapter: 3, verse: 16 }), "John 3:16");
});

test("passageReference: a range joins with an en dash", () => {
  assert.equal(passageReference({ bookKey: "romans", chapter: 5, verse: 6, endVerse: 10 }), "Romans 5:6–10");
});

test("passageReference: a missing endVerse reads as a single verse", () => {
  assert.equal(passageReference({ bookKey: "john", chapter: 3, verse: 16, endVerse: undefined }), "John 3:16");
  assert.equal(passageReference({ bookKey: "john", chapter: 3, verse: 16, endVerse: 16 }), "John 3:16");
});

test("passageReference: a numbered book key gets its number in front", () => {
  assert.equal(passageReference({ bookKey: "1corinthians", chapter: 13, verse: 4, endVerse: 7 }), "1 Corinthians 13:4–7");
});

/* ── passageFromVerses ───────────────────────────────────────────────── */

test("passageFromVerses: carries the book, chapter and verses", () => {
  const p = passageFromVerses(chapter, where, 2, 3);
  assert.deepEqual(
    { bookKey: p.bookKey, chapter: p.chapter, verse: p.verse, endVerse: p.endVerse },
    { bookKey: "john", chapter: 1, verse: 2, endVerse: 3 },
  );
  assert.equal("quote" in p, false);
});

test("passageFromVerses: endVerse defaults to the verse", () => {
  const p = passageFromVerses(chapter, where, 2);
  assert.equal(p.verse, 2);
  assert.equal(p.endVerse, 2);
});

test("passageFromVerses: verses given in reverse order are swapped", () => {
  const p = passageFromVerses(chapter, where, 3, 1);
  assert.equal(p.verse, 1);
  assert.equal(p.endVerse, 3);
  assert.equal(p.verseCopy, verseCopyFor(chapter, 1, 3));
});

test("passageFromVerses: verseCopy is the verses' text, as of the content version passed", () => {
  const p = passageFromVerses(chapter, where, 1, 2, VERSION);
  assert.equal(p.verseCopy, verseCopyFor(chapter, 1, 2));
  assert.equal(p.verseCopy, "In the beginning was the word. The word was with God.");
  assert.equal(p.verseCopyAsOf, VERSION);
});

test("passageFromVerses: with no chapter there are no verseCopy keys at all", () => {
  const p = passageFromVerses(null, where, 1, 2, VERSION);
  assert.equal("verseCopy" in p, false);
  assert.equal("verseCopyAsOf" in p, false);
  assert.deepEqual(p, { bookKey: "john", chapter: 1, verse: 1, endVerse: 2 });
});

/* ── passageForReference ("+ Passage", BA127) ─────────────────────────── */

// Romans 8 has 39 verses; Matthew 17 has no verse 21 (a gap the LIT keeps).
const versesTo = (n, skip = []) =>
  assembleChapter(new Map(Array.from({ length: n }, (_, i) => i + 1).filter((v) => !skip.includes(v)).map((v) => [v, `Verse ${v}.`])));
const romans8 = versesTo(39);
const matthew17 = versesTo(27, [21]);
const ref = (bookKey, chapter, verse = null, rangeEnd = null) => ({ bookKey, chapter, verse, rangeEnd });

test("passageForReference: a chapter alone is the whole chapter", () => {
  const { fields, problem } = passageForReference(romans8, ref("romans", 8), VERSION);
  assert.equal(problem, undefined);
  assert.equal(fields.verse, 1);
  assert.equal(fields.endVerse, 39);
  assert.equal(passageReference(fields), "Romans 8:1–39");
  assert.equal(fields.verseCopyAsOf, VERSION);
});

test("passageForReference: a verse past the chapter's end is refused", () => {
  assert.deepEqual(passageForReference(romans8, ref("romans", 8, 99)), {
    problem: "Romans 8:99 isn’t in the LIT; that chapter ends at verse 39.",
  });
});

test("passageForReference: a range past the chapter's end stops at its last verse", () => {
  const { fields } = passageForReference(romans8, ref("romans", 8, 28, 99));
  assert.equal(passageReference(fields), "Romans 8:28–39");
});

test("passageForReference: a verse the LIT doesn't have is refused", () => {
  assert.deepEqual(passageForReference(matthew17, ref("matthew", 17, 21)), { problem: "Matthew 17:21 isn’t in the LIT." });
  assert.deepEqual(passageForReference(matthew17, ref("matthew", 17, 21, 23)), { problem: "Matthew 17:21 isn’t in the LIT." });
});

test("passageForReference: a range ending in a gap ends at the verse before it", () => {
  assert.equal(passageReference(passageForReference(matthew17, ref("matthew", 17, 19, 21)).fields), "Matthew 17:19–20");
  assert.equal(passageReference(passageForReference(matthew17, ref("matthew", 17, 20, 22)).fields), "Matthew 17:20–22");
});

test("passageForReference: one verse, and a range inside the chapter, as typed", () => {
  assert.equal(passageReference(passageForReference(romans8, ref("romans", 8, 28)).fields), "Romans 8:28");
  assert.equal(passageReference(passageForReference(romans8, ref("romans", 8, 28, 30)).fields), "Romans 8:28–30");
});

test("passageForReference: a chapter the book doesn't have is named", () => {
  assert.deepEqual(passageForReference(null, ref("romans", 17)), { problem: "Romans has 16 chapters." });
  assert.deepEqual(passageForReference(null, ref("jude", 2)), { problem: "Jude has only one chapter." });
});

test("passageForReference: nothing is added when the chapter couldn't be read", () => {
  const msg = { problem: "Romans 8 couldn’t be read just now. Check the connection and try again." };
  assert.deepEqual(passageForReference(null, ref("romans", 8, 28)), msg);
  assert.deepEqual(passageForReference(assembleChapter(new Map()), ref("romans", 8)), msg);
});

/* ── passageInsertIndex (BA69) ───────────────────────────────────────── */

const types = (modules) => modules.map((m) => (m.type === "text" ? m.html.match(/^<h2>([^<]*)/)?.[1] ?? "text" : m.type));

test("passageInsertIndex: a new template's first passage goes under Reading, not after Closing", () => {
  const sheet = { modules: templateModules("bible-study") };
  assert.equal(passageInsertIndex(sheet), 2);
  assert.deepEqual(types(sheet.modules).slice(0, 2), ["Opening", "Reading"]);
  assert.equal(passageInsertIndex({ modules: templateModules("sermon") }), 1);
  assert.equal(passageInsertIndex({ modules: templateModules("lectio-divina") }), 1);
});

test("passageInsertIndex: later passages follow the last one", () => {
  const modules = templateModules("bible-study");
  const p = makeModule("passage", { bookKey: "romans", chapter: 8, verse: 28, endVerse: 28 });
  modules.splice(2, 0, p);
  assert.equal(passageInsertIndex({ modules }), 3);
});

test("passageInsertIndex: at the end with no passage and no reading part", () => {
  assert.equal(passageInsertIndex({ modules: templateModules("blank") }), 1);
  assert.equal(passageInsertIndex({ modules: [] }), 0);
  assert.equal(passageInsertIndex({ modules: [makeModule("text", { html: "<h2>Our passage</h2>" })] }), 1);
});

/* ── passageFromOffsets ──────────────────────────────────────────────── */

test("passageFromOffsets: offsets covering exactly whole verses give no quote", () => {
  const [start, end] = rangeOf(chapter, 1, 2);
  const p = passageFromOffsets(chapter, where, start, end, VERSION);
  assert.equal("quote" in p, false);
  assert.equal(p.verse, 1);
  assert.equal(p.endVerse, 2);
  assert.equal(p.verseCopyAsOf, VERSION);
});

test("passageFromOffsets: offsets inside one verse give a quote sliced from the text", () => {
  const [vs] = rangeOf(chapter, 1, 1);
  const start = vs + 7; // "beginning"
  const end = start + "beginning".length;
  const p = passageFromOffsets(chapter, where, start, end);
  assert.equal(p.verse, 1);
  assert.equal(p.endVerse, 1);
  assert.equal(p.quote.exact, "beginning");
  assert.equal(p.quote.prefix, "In the ");
  assert.equal(p.quote.suffix, chapter.text.slice(end, end + 32));
  assert.equal(p.quote.suffix, " was the word. The word was with");
});

test("passageFromOffsets: offsets spanning two verses give verse and endVerse of both", () => {
  const start = chapter.spans.get(1)[0] + 17; // "was the word."
  const end = chapter.spans.get(2)[0] + 5; // "The w"
  const p = passageFromOffsets(chapter, where, start, end);
  assert.equal(p.verse, 1);
  assert.equal(p.endVerse, 2);
  assert.equal(p.quote.exact, chapter.text.slice(start, end));
  assert.equal(p.quote.exact, "was the word. The w");
});

/* ── passageFromRecord ───────────────────────────────────────────────── */

test("passageFromRecord: a whole-verse record (bookmark-like) is its verses, with no quote", () => {
  const p = passageFromRecord({ bookKey: "john", chapter: 1, verse: 2 });
  assert.deepEqual(p, { bookKey: "john", chapter: 1, verse: 2, endVerse: 2 });
});

test("passageFromRecord: a whole-verse record with the chapter gains its verseCopy", () => {
  const p = passageFromRecord({ bookKey: "john", chapter: 1, verse: 2, endVerse: 3 }, chapter, VERSION);
  assert.equal(p.verseCopy, verseCopyFor(chapter, 2, 3));
  assert.equal(p.verseCopyAsOf, VERSION);
  assert.equal("quote" in p, false);
});

test("passageFromRecord: a quote found in the chapter is read again, and kept", () => {
  const record = {
    bookKey: "john",
    chapter: 1,
    verse: 1,
    quote: { exact: "beginning", prefix: "In the ", suffix: " was the word." },
  };
  const p = passageFromRecord(record, chapter, VERSION);
  assert.equal(p.quote.exact, "beginning");
  assert.equal(p.quote.prefix, "In the ");
  assert.equal(p.verseCopyAsOf, VERSION);
});

test("passageFromRecord: a quote that now covers whole verses drops", () => {
  const record = {
    bookKey: "john",
    chapter: 1,
    verse: 1,
    quote: { exact: "In the beginning was the word.", prefix: "", suffix: " The word was w" },
  };
  const p = passageFromRecord(record, chapter);
  assert.equal("quote" in p, false);
  assert.equal(p.verse, 1);
  assert.equal(p.endVerse, 1);
});

test("passageFromRecord: a quote with no chapter is kept, its context defaulting to empty", () => {
  const p = passageFromRecord({ bookKey: "john", chapter: 1, verse: 1, quote: { exact: "beginning" } });
  assert.deepEqual(p.quote, { exact: "beginning", prefix: "", suffix: "" });
  assert.equal("verseCopy" in p, false);
});

test("passageFromRecord: a record without a bookKey is null", () => {
  assert.equal(passageFromRecord({ chapter: 1, verse: 1 }), null);
  assert.equal(passageFromRecord(null), null);
});

/* ── locatePassage ───────────────────────────────────────────────────── */

test("locatePassage: whole verses are found at their span", () => {
  const r = locatePassage(chapter, { bookKey: "john", chapter: 1, verse: 2, endVerse: 3 });
  assert.equal(r.status, "found");
  assert.deepEqual([r.start, r.end], rangeOf(chapter, 2, 3));
});

test("locatePassage: whole verses that are no longer in the chapter are lost", () => {
  const r = locatePassage(chapter, { bookKey: "john", chapter: 1, verse: 8, endVerse: 9 });
  assert.deepEqual(r, { status: "lost", start: null, end: null });
});

test("locatePassage: a quote that is still there is found", () => {
  const p = { bookKey: "john", chapter: 1, verse: 1, quote: { exact: "beginning", prefix: "In the ", suffix: " was" } };
  const r = locatePassage(chapter, p);
  assert.equal(r.status, "found");
  assert.equal(chapter.text.slice(r.start, r.end), "beginning");
});

test("locatePassage: a quote whose words are gone is not reported as found", () => {
  const p = { bookKey: "john", chapter: 1, verse: 2, quote: { exact: "Lord", prefix: "The word was with ", suffix: "." } };
  const r = locatePassage(chapter, p);
  assert.notEqual(r.status, "found");
  assert.notEqual(r.status, "moved");
});

/* ── samePassage ─────────────────────────────────────────────────────── */

test("samePassage: identical references and quotes are the same passage", () => {
  const a = { bookKey: "john", chapter: 3, verse: 16, endVerse: 17, quote: { exact: "so loved" } };
  const b = { bookKey: "john", chapter: 3, verse: 16, endVerse: 17, quote: { exact: "so loved", prefix: "x" } };
  assert.equal(samePassage(a, b), true);
});

test("samePassage: a different quote is a different passage", () => {
  const a = { bookKey: "john", chapter: 3, verse: 16, quote: { exact: "so loved" } };
  const b = { bookKey: "john", chapter: 3, verse: 16, quote: { exact: "the world" } };
  assert.equal(samePassage(a, b), false);
  assert.equal(samePassage(a, { bookKey: "john", chapter: 3, verse: 16 }), false);
});

test("samePassage: endVerse defaults to the verse", () => {
  assert.equal(samePassage({ bookKey: "john", chapter: 3, verse: 16 }, { bookKey: "john", chapter: 3, verse: 16, endVerse: 16 }), true);
  assert.equal(samePassage({ bookKey: "john", chapter: 3, verse: 16, endVerse: 17 }, { bookKey: "john", chapter: 3, verse: 16 }), false);
});

/* ── sheetName and sortSheets ────────────────────────────────────────── */

test("sheetName: the trimmed title, or a fallback when there is none", () => {
  assert.equal(sheetName({ title: "  Romans notes  " }), "Romans notes");
  assert.equal(sheetName({ title: "   " }), "Untitled sheet");
  assert.equal(sheetName({}), "Untitled sheet");
  assert.equal(sheetName(undefined), "Untitled sheet");
});

test("sortSheets: newest change first, ties by name, input not mutated", () => {
  const input = [
    { title: "Beta", modified: "2026-10-01T00:00:00.000Z" },
    { title: "Alpha", modified: "2026-10-01T00:00:00.000Z" },
    { title: "Gamma", modified: "2026-10-18T00:00:00.000Z" },
    { title: "Delta", modified: "2026-09-01T00:00:00.000Z" },
  ];
  const before = input.map((s) => s.title);
  const sorted = sortSheets(input).map((s) => s.title);
  assert.deepEqual(sorted, ["Gamma", "Alpha", "Beta", "Delta"]);
  assert.deepEqual(input.map((s) => s.title), before);
  assert.notEqual(sortSheets(input), input);
});
