// test/desk-hidden.test.js
//
// The hidden passage's rules (src/lib/desk-hidden.mjs): which verses are
// covered, how overlapping records merge, Show for this page view, M1's veil,
// and the records the form makes.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createRecord, validateRecord } from "../src/lib/desk-records.mjs";
import {
  coversRange,
  earlyCache,
  groupAt,
  hiddenFields,
  hiddenRecords,
  hiddenVerses,
  passageRef,
  planHidden,
  veilText,
} from "../src/lib/desk-hidden.mjs";

const ctx = { client: "web/test", contentVersion: "v20261001.abcd1234" };
let n = 0;
const hide = (bookKey, chapter, verse, endVerse, body, created) =>
  createRecord(
    "hidden",
    { bookKey, chapter, verse, endVerse, ...(body ? { body } : {}) },
    { now: created ?? `2026-10-0${1 + (n % 9)}T00:00:00.000Z`, id: `h${++n}`, ...ctx },
  );

const john3 = { bookKey: "john", chapter: 3 };

test("a record covers its verses, and only on its own chapter", () => {
  const records = [hide("john", 3, 3, 5), hide("john", 4, 1, 2), hide("romans", 3, 1, 1)];
  const groups = planHidden(records, john3);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].verses, [3, 4, 5]);
  assert.deepEqual([...hiddenVerses(groups)].sort(), [3, 4, 5]);
});

test("a verse the text lacks hides nothing", () => {
  const groups = planHidden([hide("matthew", 17, 20, 22)], { bookKey: "matthew", chapter: 17, verses: [19, 20, 22, 23] });
  assert.deepEqual(groups[0].verses, [20, 22]);
});

test("overlapping records are one passage; neighbours stay two", () => {
  const a = hide("john", 3, 3, 5, "first");
  const b = hide("john", 3, 5, 7, "second");
  const c = hide("john", 3, 8, 9);
  const groups = planHidden([c, b, a], john3);
  assert.deepEqual(groups.map((g) => [g.start, g.end]), [[3, 7], [8, 9]]);
  assert.deepEqual(groups[0].ids.sort(), [a.id, b.id].sort());
  assert.deepEqual(groups[0].notes, ["first", "second"]);
});

test("a record inside another widens nothing", () => {
  const groups = planHidden([hide("john", 3, 2, 9), hide("john", 3, 4, 5)], john3);
  assert.deepEqual(groups.map((g) => [g.start, g.end]), [[2, 9]]);
});

test("notes to self are trimmed, left out when empty, and listed once", () => {
  const groups = planHidden(
    [hide("john", 3, 3, 4, "  careful  "), hide("john", 3, 3, 4, "careful"), hide("john", 3, 3, 4, "   "), hide("john", 3, 3, 4)],
    john3,
  );
  assert.deepEqual(groups[0].notes, ["careful"]);
});

test("Show is for this page view: a passage is shown when every record in it is", () => {
  const a = hide("john", 3, 3, 5);
  const b = hide("john", 3, 4, 6);
  const shownA = planHidden([a, b], { ...john3, revealed: new Set([a.id]) });
  assert.equal(shownA[0].revealed, false);
  assert.equal(hiddenVerses(shownA).size, 4);
  const shownBoth = planHidden([a, b], { ...john3, revealed: new Set([a.id, b.id]) });
  assert.equal(shownBoth[0].revealed, true);
  assert.equal(hiddenVerses(shownBoth).size, 0);
});

test("coversRange asks about any verse in a range", () => {
  const records = [hide("john", 3, 5, 6)];
  assert.equal(coversRange(records, "john", 3, 1, 4), false);
  assert.equal(coversRange(records, "john", 3, 4, 5), true);
  assert.equal(coversRange(records, "john", 3, 6), true);
  assert.equal(coversRange(records, "john", 2, 5), false);
  assert.equal(coversRange(records, "john", 3, 5, 6, new Set([records[0].id])), false);
});

test("groupAt finds the passage a verse is in", () => {
  const groups = planHidden([hide("john", 3, 3, 5), hide("john", 3, 9, 9)], john3);
  assert.equal(groupAt(groups, 4).start, 3);
  assert.equal(groupAt(groups, 6), null);
  assert.equal(groupAt(groups, 9).end, 9);
});

test("malformed, trashed and other-kind records are ignored", () => {
  const odd = [
    { kind: "hidden", id: "x1", bookKey: "john", chapter: 3, verse: "3" },
    { kind: "hidden", id: "x2", bookKey: "john", chapter: 3, verse: 5, endVerse: 4 },
    { kind: "trash", id: "x3", deletedId: "h1" },
    { kind: "note", id: "x4", bookKey: "john", chapter: 3, verse: 3, body: "a", marker: "note" },
    null,
  ];
  assert.deepEqual(hiddenRecords(odd), []);
  assert.deepEqual(planHidden(odd, john3), []);
});

test("the veil says what the note says, and M1 keeps the note off it", () => {
  const [g] = planHidden([hide("john", 3, 3, 5, "Violent language ahead")], john3);
  const open = veilText(g, john3);
  assert.equal(open.title, "Passage hidden by your note");
  assert.equal(open.ref, "John 3:3–5");
  assert.equal(open.note, "Violent language ahead");
  assert.equal(open.name, "Passage hidden by your note, John 3:3–5");
  const shared = veilText(g, { ...john3, hideNotes: true });
  assert.equal(shared.title, "Passage hidden");
  assert.equal(shared.note, "");
  assert.ok(!shared.name.includes("by your note"));
});

test("a passage of one verse names one verse", () => {
  assert.equal(passageRef("john", 3, 16), "John 3:16");
  assert.equal(passageRef("1corinthians", 13, 4, 7), "1 Corinthians 13:4–7");
});

test("the form's fields: ordered, trimmed, no empty note, and valid", () => {
  assert.deepEqual(hiddenFields({ bookKey: "john", chapter: 3, start: 7, end: 3, note: "  hi  " }), {
    bookKey: "john",
    chapter: 3,
    verse: 3,
    endVerse: 7,
    body: "hi",
  });
  const bare = hiddenFields({ bookKey: "john", chapter: 3, start: 3, note: "   " });
  assert.equal("body" in bare, false);
  assert.equal(bare.endVerse, 3);
  const record = createRecord("hidden", hiddenFields({ bookKey: "john", chapter: 3, start: 3, end: 5, note: "x" }), ctx);
  assert.deepEqual(validateRecord(record), []);
});

test("a note to self must be text", () => {
  const record = createRecord("hidden", { bookKey: "john", chapter: 3, verse: 3, endVerse: 3, body: 5 }, ctx);
  assert.ok(validateRecord(record).some((p) => p.includes("body")));
});

test("the early cache holds where passages sit and never a note", () => {
  const cache = earlyCache([hide("john", 3, 3, 5, "private"), hide("john", 3, 9, 9), hide("romans", 8, 1, 2)]);
  assert.deepEqual(cache, { "john-3": [[3, 5], [9, 9]], "romans-8": [[1, 2]] });
  assert.ok(!JSON.stringify(cache).includes("private"));
});
