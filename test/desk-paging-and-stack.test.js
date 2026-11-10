// LG8-2 (long lists page) and GF8b-6 (the margin stack is capped), the pure
// halves (BVJ, 2026-11-10, Audit 8 decision 7).

import { test } from "node:test";
import assert from "node:assert/strict";
import { LIST_PAGE_SIZE, chapterKeysOf, moreRowsText, pageRows, pagedEntries } from "../src/lib/desk-notebook.mjs";
import { STACK_MAX, layoutCapped, moreNotesName, moreNotesText } from "../src/lib/desk-notes.mjs";

test("pageRows: a page of 200, then the next batch, never more than a page at a time", () => {
  assert.equal(LIST_PAGE_SIZE, 200);
  assert.deepEqual(pageRows(150), { shown: 150, left: 0, next: 0 });
  assert.deepEqual(pageRows(200), { shown: 200, left: 0, next: 0 });
  assert.deepEqual(pageRows(237), { shown: 200, left: 37, next: 37 });
  assert.deepEqual(pageRows(1000), { shown: 200, left: 800, next: 200 });
  assert.deepEqual(pageRows(1000, 400), { shown: 400, left: 600, next: 200 });
  assert.deepEqual(pageRows(300, 900), { shown: 300, left: 0, next: 0 }, "a list that shrank clamps");
  assert.deepEqual(pageRows(300, 10), { shown: 200, left: 100, next: 100 }, "never below a page");
  assert.equal(moreRowsText(200), "Show 200 more");
  assert.equal(moreRowsText(37), "Show 37 more");
});

test("pagedEntries pages by rows: a heading appears only with a row, and a longer limit extends a shorter one", () => {
  const rec = (id) => ({ id });
  const sections = [
    { title: "John 1", records: [rec("a"), rec("b")] },
    { title: "John 2", records: [rec("c"), rec("d"), rec("e")] },
    { title: "John 3", records: [rec("f")] },
  ];
  const kinds = (es) => es.map((e) => (e.type === "heading" ? `#${e.title}` : e.record.id));
  assert.deepEqual(kinds(pagedEntries(sections, 2)), ["#John 1", "a", "b"], "no heading for a chapter with no row shown");
  assert.deepEqual(kinds(pagedEntries(sections, 3)), ["#John 1", "a", "b", "#John 2", "c"]);
  const short = pagedEntries(sections, 3);
  const long = pagedEntries(sections, 6);
  assert.deepEqual(long.slice(0, short.length), short);
  assert.deepEqual(kinds(pagedEntries(sections.slice(0, 1), 5)), ["a", "b"], "one section takes no heading");
  assert.deepEqual(pagedEntries(sections, 0), []);
});

test("chapterKeysOf names the chapters records sit on", () => {
  const keys = chapterKeysOf([{ bookKey: "john", chapter: 3 }, { bookKey: "john", chapter: 3 }, { kind: "note", body: "prose" }]);
  assert.deepEqual([...keys], ["john 3"]);
});

const item = (id, top, verse = 16) => ({ id, top, verse, lineHeight: 30, noteLine: 22, height: 22 });

test("layoutCapped: past five on one line the rest fold into one control", () => {
  const items = Array.from({ length: 8 }, (_, i) => item(`n${i}`, 100));
  const { shown, more } = layoutCapped(items);
  assert.equal(STACK_MAX, 5);
  assert.deepEqual(shown.map((s) => s.id), ["n0", "n1", "n2", "n3", "n4", "more:0"]);
  assert.deepEqual(more, [{ id: "more:0", ids: ["n5", "n6", "n7"], count: 3, verse: 16, sameVerse: true }]);
  const ys = shown.map((s) => s.y);
  assert.deepEqual([...ys].sort((a, b) => a - b), ys, "the control sits below the last note drawn");
  assert.ok(ys[5] > ys[4]);
});

test("layoutCapped: five or fewer fold nothing, and separate lines are separate stacks", () => {
  const five = layoutCapped(Array.from({ length: 5 }, (_, i) => item(`n${i}`, 100)));
  assert.equal(five.more.length, 0);
  assert.equal(five.shown.length, 5);
  const far = layoutCapped([
    ...Array.from({ length: 6 }, (_, i) => item(`a${i}`, 100)),
    ...Array.from({ length: 6 }, (_, i) => item(`b${i}`, 900, 17)),
  ]);
  assert.deepEqual(far.more.map((m) => [m.count, m.verse]), [[1, 16], [1, 17]]);
});

test("layoutCapped: a note that would start below the text's foot folds too, and mixed verses say so", () => {
  const items = [item("a", 100, 1), item("b", 500, 2), item("c", 520, 3)];
  const { shown, more } = layoutCapped(items, { bottom: 510 });
  assert.deepEqual(shown.filter((s) => !s.id.startsWith("more")).map((s) => s.id), ["a"]);
  assert.equal(more[0].count, 2);
  assert.equal(more[0].sameVerse, false);
  assert.equal(more[0].verse, 2);
  assert.equal(layoutCapped(items, { maxStack: Infinity }).more.length, 0);
});

test("the control's words", () => {
  assert.equal(moreNotesText(3), "3 more notes");
  assert.equal(moreNotesText(1), "1 more note");
  assert.equal(moreNotesName(3, "John 3:16"), "3 more notes on John 3:16");
  assert.equal(moreNotesName(2, "John 3:16", false), "2 more notes from John 3:16");
});
