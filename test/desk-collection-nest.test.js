// Bible order's nesting (D13; BVJ, 2026-11-20, E193): a record wholly inside
// a collected passage goes under that passage, one level deep, and the rule
// for a record two passages hold. src/lib/desk-collection-nest.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { nestRows } from "../src/lib/desk-collection-nest.mjs";

const passage = (key, verse, endVerse, { bookKey = "luke", chapter = 1 } = {}) => ({
  type: "passage",
  key,
  member: { id: key, type: "passage", bookKey, chapter, verse, ...(endVerse ? { endVerse } : {}) },
});
const record = (key, kind, verse, endVerse, { bookKey = "luke", chapter = 1 } = {}) => ({
  type: "record",
  key,
  member: { id: key, type: "item", recordId: `r-${key}` },
  record: { id: `r-${key}`, kind, bookKey, chapter, verse, ...(endVerse ? { endVerse } : {}) },
  rule: null,
});
const keys = (rows) => rows.map((r) => (r.children ? `${r.key}[${r.children.map((c) => c.key).join(",")}]` : r.key));

test("a record wholly inside a passage goes under it; a partial one stands alone", () => {
  const rows = [
    passage("p46", 46, 55),
    record("n46", "note", 46),
    record("h52", "highlight", 52),
    record("pin", "footnotePin", 46),
    record("over", "note", 54, 56),
    record("after", "bookmark", 60),
  ];
  assert.deepEqual(keys(nestRows(rows)), ["p46[n46,h52,pin]", "over", "after"]);
});

test("a smaller passage nests under the wider one, and its records go beside it, one level deep", () => {
  const rows = [passage("p46", 46, 55), record("n46", "note", 46), passage("p54", 54), record("b54", "bookmark", 54)];
  assert.deepEqual(keys(nestRows(rows)), ["p46[n46,p54,b54]"]);
});

test("two passages that partly overlap are both hosts; a record in both goes under the first", () => {
  const rows = [passage("a", 1, 10), passage("b", 5, 15), record("in-both", "note", 6, 8), record("only-b", "note", 12)];
  assert.deepEqual(keys(nestRows(rows)), ["a[in-both]", "b[only-b]"]);
});

test("another chapter, another book, sheets and rows on no verse never nest", () => {
  const sheet = { type: "record", key: "s", member: { id: "s" }, record: { id: "rs", kind: "sheet" }, rule: null };
  const article = { type: "record", key: "art", member: { id: "art" }, record: { id: "ra", kind: "note" }, rule: null };
  const rows = [
    { type: "group", key: "group:Sheets", title: "Sheets" },
    sheet,
    passage("p", 1, 10),
    record("ch2", "note", 3, null, { chapter: 2 }),
    record("john", "note", 3, null, { bookKey: "john" }),
    article,
  ];
  const out = nestRows(rows);
  assert.deepEqual(keys(out), ["group:Sheets", "s", "p", "ch2", "john", "art"]);
  assert.equal(out[2] === rows[2], true, "a passage with nothing under it is the very row given");
});

test("two passages on the same verses: the first is the host", () => {
  const rows = [passage("one", 3, 4), passage("two", 3, 4)];
  assert.deepEqual(keys(nestRows(rows)), ["one[two]"]);
});

test("nothing to nest gives back the same list", () => {
  const rows = [passage("p", 1, 2), record("n", "note", 5)];
  assert.equal(nestRows(rows) === rows, true);
});
