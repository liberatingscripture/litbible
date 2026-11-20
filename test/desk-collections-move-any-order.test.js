// A row moves in any of a collection's three orders, and the move switches to
// My order (BVJ, 2026-11-20, E212): until the reader has arranged My order
// (`arranged`, or a heading), My order starts from the order on screen with
// the move made; once arranged, the move is made in My order beside the row it
// passed. The model's side, src/lib/desk-collections.mjs (`moveShown`,
// `shownRows`, `isArranged`); the page's is test/desk-collections-sheets.test.js.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRecord, validateRecord } from "../src/lib/desk-records.mjs";
import { validateCollection } from "../src/lib/desk-collection-format.mjs";
import {
  addHeading,
  addItems,
  addRule,
  collectionRows,
  createCollection,
  isArranged,
  moveRow,
  moveShown,
  moveTarget,
  passageMember,
  setOrder,
  shownRows,
} from "../src/lib/desk-collections.mjs";

const ctx = { now: "2026-11-20T09:00:00.000Z", client: "web/2026.11", contentVersion: "v1" };
const later = { ...ctx, now: "2026-11-20T10:00:00.000Z" };
let counter = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
const make = (kind, fields) => createRecord(kind, fields, { ...ctx, id: nextId() });

const advent = make("label", { name: "Advent" });
const n1 = make("note", { bookKey: "luke", chapter: 1, verse: 30, endVerse: 30, body: "Do not be afraid", marker: "note" });
const h1 = make("highlight", { bookKey: "luke", chapter: 1, verse: 50, endVerse: 50, color: "yellow", quote: { exact: "mercy" } });
const b1 = make("bookmark", { bookKey: "luke", chapter: 2, verse: 7, endVerse: 7, label: "", labels: [advent.id] });
const records = [advent, n1, h1, b1];
const P1 = passageMember({ bookKey: "luke", chapter: 1, verse: 26, endVerse: 38 }, { id: nextId() });
const P2 = passageMember({ bookKey: "john", chapter: 3, verse: 16, endVerse: 16 }, { id: nextId() });

/** Added out of Bible order: John 3:16, the highlight, the note, Luke 1:26–38, then the rule (Luke 2:7). */
function built(order = "bible") {
  let c = createCollection({ name: "Advent", members: [P2] }, ctx);
  c = addItems(c, [h1.id, n1.id], ctx);
  c = { ...c, members: [...c.members, P1] };
  c = addRule(c, advent.id, records, ctx);
  return { ...c, order };
}

const name = (r) => (r.type === "passage" ? `${r.member.bookKey} ${r.member.chapter}:${r.member.verse}` : r.type === "heading" ? `# ${r.text}` : `${r.record.kind}${r.member ? "" : " (rule)"}`);
const names = (c, order) => collectionRows(c, records, { order }).rows.filter((r) => r.type !== "group").map(name);
const shown = (c, order) => shownRows(c, records, order).map(name);
const keyOf = (c, label, order = "mine") => shownRows(c, records, order).find((r) => name(r) === label).key;

test("shownRows: the rows as drawn, without group labels; Bible order's nested rows right after their passage", () => {
  const c = built();
  assert.deepEqual(shown(c, "bible"), ["luke 1:26", "note", "highlight", "bookmark (rule)", "john 3:16"]);
  assert.deepEqual(shown(c, "type"), ["luke 1:26", "john 3:16", "note", "highlight", "bookmark (rule)"]);
  assert.deepEqual(shown(c, "mine"), ["john 3:16", "highlight", "note", "luke 1:26", "bookmark (rule)"]);
});

test("isArranged: the flag, or a heading made before it; choosing an order doesn't arrange", () => {
  const c = built();
  assert.equal(isArranged(c), false);
  assert.equal(isArranged(setOrder(c, "mine", later)), false);
  assert.equal(isArranged({ ...c, arranged: true }), true);
  assert.equal(isArranged({ ...c, members: [...c.members, { id: nextId(), type: "heading", text: "Week 1" }] }), true);
  const moved = moveRow(c, keyOf(c, "luke 1:26"), null, records, later);
  assert.equal(moved.arranged, true, "a move in My order arranges it");
  assert.equal(addHeading(c, "Week 1", null, records, later).arranged, true, "so does a heading");
});

test("not arranged, Bible order: My order becomes the order on screen, with the move made", () => {
  const c = built();
  const moved = moveShown(c, "bible", keyOf(c, "john 3:16", "bible"), keyOf(c, "bookmark (rule)", "bible"), records, later);
  assert.equal(moved.order, "mine");
  assert.equal(moved.arranged, true);
  assert.deepEqual(names(moved, "mine"), ["luke 1:26", "note", "highlight", "john 3:16", "bookmark (rule)"]);
  assert.deepEqual(validateRecord(moved), []);
  // A rule's bookmark the move puts above a member is an item where it stands.
  const down = moveShown(c, "bible", keyOf(c, "highlight", "bible"), keyOf(c, "john 3:16", "bible"), records, later);
  assert.deepEqual(names(down, "mine"), ["luke 1:26", "note", "bookmark", "highlight", "john 3:16"]);
});

test("not arranged, By type: My order starts from the groups' order, labels left out", () => {
  const c = built("type");
  const moved = moveShown(c, "type", keyOf(c, "note", "type"), keyOf(c, "john 3:16", "type"), records, later);
  assert.deepEqual(names(moved, "mine"), ["luke 1:26", "note", "john 3:16", "highlight", "bookmark (rule)"]);
});

test("arranged: the move is made in My order beside the row it passed, and the rest stays", () => {
  // Arranged: Luke 1:26–38 moved to the top of My order, then a heading over it.
  let c = built("mine");
  c = moveRow(c, keyOf(c, "luke 1:26"), keyOf(c, "john 3:16"), records, ctx);
  c = addHeading(c, "Week 1", keyOf(c, "luke 1:26"), records, ctx);
  c = setOrder(c, "bible", ctx);
  assert.deepEqual(names(c, "mine"), ["# Week 1", "luke 1:26", "john 3:16", "highlight", "note", "bookmark (rule)"]);
  assert.deepEqual(shown(c, "bible"), ["luke 1:26", "note", "highlight", "bookmark (rule)", "john 3:16"]);

  // Down past the note on screen: just below the note in My order.
  const down = moveShown(c, "bible", keyOf(c, "luke 1:26", "bible"), keyOf(c, "highlight", "bible"), records, later);
  assert.equal(down.order, "mine");
  assert.deepEqual(names(down, "mine"), ["# Week 1", "john 3:16", "highlight", "note", "luke 1:26", "bookmark (rule)"]);

  // Up above the rule's bookmark on screen: just above it in My order, at the end of the members.
  const up = moveShown(c, "bible", keyOf(c, "john 3:16", "bible"), keyOf(c, "bookmark (rule)", "bible"), records, later);
  assert.deepEqual(names(up, "mine"), ["# Week 1", "luke 1:26", "highlight", "note", "john 3:16", "bookmark (rule)"]);

  // Already true of My order (the highlight is just above the note there): only the order changes.
  const same = moveShown(c, "bible", keyOf(c, "highlight", "bible"), keyOf(c, "note", "bible"), records, later);
  assert.equal(same.order, "mine");
  assert.deepEqual(same.members, c.members);
});

test("nothing moves when the row is where it would go; an unknown row throws; My order is moveRow", () => {
  const c = built();
  const rows = shownRows(c, records, "bible");
  assert.equal(moveShown(c, "bible", rows[1].key, rows[2].key, records, later), c, "already right above it");
  assert.equal(moveShown(c, "bible", rows[1].key, rows[1].key, records, later), c);
  assert.equal(moveTarget(rows, rows[0].key, "up"), null, "↑ is off on the first row");
  assert.throws(() => moveShown(c, "bible", "nope", null, records, later), /shows no row/);
  const mine = shownRows(c, records, "mine");
  assert.deepEqual(moveShown(c, "mine", mine[3].key, mine[0].key, records, later).members, moveRow(c, mine[3].key, mine[0].key, records, later).members);
});

test("arranged is true or false in the record, and absent means false", () => {
  const c = built();
  assert.deepEqual(validateCollection({ ...c, arranged: true }), []);
  assert.deepEqual(validateCollection({ ...c, arranged: false }), []);
  assert.ok(validateCollection({ ...c, arranged: "yes" }).some((p) => /arranged/.test(p)));
  assert.equal("arranged" in c, false, "a new collection carries no flag");
});
