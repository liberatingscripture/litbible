import test from "node:test";
import assert from "node:assert/strict";
import {
  gatherMessage,
  passagesFromChapters,
  passagesFromVerses,
  roomOnSheet,
  searchSheetTitle,
} from "../src/lib/desk-sheet-gather.mjs";
import { SHEET_LIMITS } from "../src/lib/desk-sheet-format.mjs";
import { makeModule } from "../src/lib/desk-sheets.mjs";
import { passageReference } from "../src/lib/desk-sheet-passages.mjs";

const v = (bookKey, chapter, verse) => ({ bookKey, chapter, verse });
const refs = (list) => list.passages.map(passageReference);

test("verses come out in Bible order, whatever order they came in", () => {
  const got = passagesFromVerses([v("romans", 8, 2), v("matthew", 5, 3), v("john", 3, 16), v("romans", 1, 7)]);
  assert.deepEqual(refs(got), ["Matthew 5:3", "John 3:16", "Romans 1:7", "Romans 8:2"]);
  assert.equal(got.leftOut, 0);
});

test("consecutive verses of one chapter become one range", () => {
  const got = passagesFromVerses([v("john", 3, 17), v("john", 3, 16), v("john", 3, 18), v("john", 3, 20)]);
  assert.deepEqual(refs(got), ["John 3:16–18", "John 3:20"]);
  assert.equal(got.passages[0].verse, 16);
  assert.equal(got.passages[0].endVerse, 18);
});

test("a run never crosses a chapter or a book", () => {
  const got = passagesFromVerses([v("john", 3, 36), v("john", 4, 1), v("john", 4, 2), v("acts", 1, 1)]);
  assert.deepEqual(refs(got), ["John 3:36", "John 4:1–2", "Acts 1:1"]);
});

test("repeats collapse, and a reference that is not a verse is ignored", () => {
  const got = passagesFromVerses([
    v("john", 3, 16),
    v("john", 3, 16),
    v("psalms", 23, 1),
    v("john", 99, 1),
    v("john", 3, 0),
    v("john", 3, 1.5),
    null,
    { bookKey: "john" },
  ]);
  assert.deepEqual(refs(got), ["John 3:16"]);
  assert.deepEqual(passagesFromVerses(null).passages, []);
  assert.deepEqual(passagesFromVerses([]).passages, []);
});

test("a passage from a search holds a reference and no copy of the words", () => {
  const [p] = passagesFromVerses([v("john", 3, 16)]).passages;
  assert.deepEqual(Object.keys(p).sort(), ["bookKey", "chapter", "endVerse", "verse"]);
  const module = makeModule("passage", p);
  assert.equal(module.type, "passage");
  assert.deepEqual(module.blanks, []);
  assert.deepEqual(module.footnotes, []);
  assert.equal("verseCopy" in module, false);
});

test("what does not fit on the sheet is counted, not dropped silently", () => {
  const every = [];
  // Separate passages: four single verses in each chapter of five books.
  for (const [book, chapters] of [["matthew", 28], ["mark", 16], ["luke", 24], ["john", 21], ["acts", 28]]) {
    for (let c = 1; c <= chapters; c++) for (const verse of [1, 3, 5, 7]) every.push(v(book, c, verse));
  }
  // A room larger than the limit is held to the limit, so count them unbounded
  // by taking the runs a chapter at a time.
  const all = { passages: [] };
  for (const [book, chapters] of [["matthew", 28], ["mark", 16], ["luke", 24], ["john", 21], ["acts", 28]]) {
    for (let c = 1; c <= chapters; c++) all.passages.push(...passagesFromVerses(every.filter((r) => r.bookKey === book && r.chapter === c)).passages);
  }
  assert.ok(all.passages.length > SHEET_LIMITS.modules, "the fixture is bigger than a sheet");
  const got = passagesFromVerses(every);
  assert.equal(got.passages.length, SHEET_LIMITS.modules);
  assert.equal(got.leftOut, all.passages.length - SHEET_LIMITS.modules);
  assert.deepEqual(got.passages, all.passages.slice(0, SHEET_LIMITS.modules), "the first in Bible order are kept");

  const some = passagesFromVerses(every.slice(0, 20), { room: 5 });
  assert.equal(some.passages.length, 5);
  assert.equal(some.leftOut, 15);
  assert.equal(passagesFromVerses(every.slice(0, 20), { room: 0 }).leftOut, 20);
});

test("room on a sheet is what its parts leave of the limit", () => {
  assert.equal(roomOnSheet(0), SHEET_LIMITS.modules);
  assert.equal(roomOnSheet(12), SHEET_LIMITS.modules - 12);
  assert.equal(roomOnSheet(SHEET_LIMITS.modules + 5), 0);
  assert.equal(roomOnSheet(undefined), SHEET_LIMITS.modules);
});

test("topic chapters are whole chapters, one each, in Bible order", () => {
  const got = passagesFromChapters([
    { bookKey: "romans", chapter: 8, lastVerse: 39 },
    { bookKey: "john", chapter: 3, lastVerse: 36 },
    { bookKey: "john", chapter: 3, lastVerse: 36 },
    { bookKey: "mark", chapter: 16, lastVerse: 20 },
  ]);
  assert.deepEqual(refs(got), ["Mark 16:1–20", "John 3:1–36", "Romans 8:1–39"]);
  assert.equal(got.leftOut, 0);
  assert.equal(got.unknown, 0);
});

test("a chapter whose length is not known is counted and left out", () => {
  const got = passagesFromChapters([
    { bookKey: "john", chapter: 3, lastVerse: 36 },
    { bookKey: "john", chapter: 4 },
    { bookKey: "john", chapter: 5, lastVerse: 0 },
    { bookKey: "genesis", chapter: 1, lastVerse: 31 },
  ]);
  assert.deepEqual(refs(got), ["John 3:1–36"]);
  assert.equal(got.unknown, 2);
});

test("topic chapters respect the room too", () => {
  const list = [1, 2, 3, 4].map((c) => ({ bookKey: "matthew", chapter: c, lastVerse: 25 }));
  const got = passagesFromChapters(list, { room: 3 });
  assert.equal(got.passages.length, 3);
  assert.equal(got.leftOut, 1);
});

test("the title of a search sheet", () => {
  assert.equal(searchSheetTitle("liberation"), "Search: “liberation”");
  assert.equal(searchSheetTitle('  "good  news" '), "Search: “good news”");
  assert.equal(searchSheetTitle("forgive", { kind: "topic", label: "forgiveness" }), "forgiveness");
  assert.equal(searchSheetTitle("forgive", { kind: "topic" }), "Topic: “forgive”");
  assert.equal(searchSheetTitle("forgive", { kind: "topic", label: "  " }), "Topic: “forgive”");
  const long = searchSheetTitle("x".repeat(500));
  assert.ok(Array.from(long).length <= SHEET_LIMITS.title);
  assert.ok(long.endsWith("…”"));
});

test("what the reader is told", () => {
  assert.equal(gatherMessage({ made: true, name: "Search: “liberation”", added: 12 }), "Made “Search: ‘liberation’” with 12 passages.");
  assert.equal(gatherMessage({ made: true, name: "Mercy", added: 1 }), "Made “Mercy” with 1 passage.");
  assert.equal(gatherMessage({ made: false, name: "Thursday group", added: 3 }), "Added 3 passages to “Thursday group.”");
  assert.equal(
    gatherMessage({ made: false, name: "Big", added: 2, leftOut: 1 }),
    `Added 2 passages to “Big.” 1 more passage didn’t fit, since a sheet holds at most ${SHEET_LIMITS.modules} parts.`,
  );
  assert.match(gatherMessage({ made: true, name: "A", added: 300, leftOut: 7 }), /7 more passages didn’t fit/);
  for (const text of [gatherMessage({ made: true, name: "A", added: 1, leftOut: 2 })]) assert.equal(text.includes("—"), false);
});
