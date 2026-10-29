// test/desk-ribbon-change.test.js
//
// src/lib/desk-ribbon-change.mjs: renaming, moving and making a ribbon over
// the records the notebook holds at the write (STUDY-DESK-AUDIT-1.md BA102).
// The store is a fake whose `get` waits a turn, as a real read does, and whose
// records can change between the form opening and the write.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createRecord } from "../src/lib/desk-records.mjs";
import { MAX_RIBBONS } from "../src/lib/desk-places.mjs";
import {
  RIBBON_GONE,
  RIBBON_LIMIT_REACHED,
  planRibbonCreate,
  planRibbonMove,
  planRibbonRename,
} from "../src/lib/desk-ribbon-change.mjs";

const ctx = { now: "2026-10-28T12:00:00.000Z", client: "web/2026.10", contentVersion: "v20261028.aaaaaaaa" };
const later = { now: "2026-10-28T13:00:00.000Z", client: "web/2026.10" };
const ribbon = (id, name, verse = 1) =>
  createRecord("place", { name, ribbon: true, bookKey: "john", chapter: 3, verse, endVerse: verse }, { ...ctx, id });

/** A store's `{ get, all }` over a mutable list of records; both wait a turn. */
function fake(records) {
  const wait = () => new Promise((resolve) => setImmediate(resolve));
  return {
    records,
    get: async (id) => {
      await wait();
      return records.find((r) => r.id === id) ?? null;
    },
    all: async () => {
      await wait();
      return records.slice();
    },
  };
}

const trashed = (r) => ({ id: `trash-${r.id}`, kind: "trash", schema: r.schema, held: r });

test("a rename writes the new name over the record as it is now", async () => {
  const held = ribbon("a", "Thursday");
  const s = fake([held, ribbon("b", "Sunday")]);
  const out = await planRibbonRename(s, "a", "  Friday  group ", later);
  assert.equal(out.problem, null);
  assert.equal(out.plan.put.length, 1);
  assert.equal(out.plan.put[0].name, "Friday group");
  assert.equal(out.plan.put[0].id, "a");
  assert.equal(out.plan.put[0].modified, later.now);
});

test("a rename keeps what changed meanwhile, such as a move made in another tab", async () => {
  const s = fake([ribbon("a", "Thursday", 1)]);
  s.records[0] = { ...s.records[0], verse: 16, endVerse: 16 };
  const out = await planRibbonRename(s, "a", "Friday", later);
  assert.equal(out.plan.put[0].verse, 16);
});

test("a ribbon deleted before the rename is written is not brought back", async () => {
  const held = ribbon("a", "Thursday");
  const s = fake([held]);
  // The form saw the ribbon; another tab deletes it before the transaction reads.
  s.records.splice(0, 1, trashed(held));
  const out = await planRibbonRename(s, "a", "Friday", later);
  assert.equal(out.plan, null);
  assert.equal(out.problem, RIBBON_GONE);
  const bare = fake([]);
  assert.equal((await planRibbonRename(bare, "a", "Friday", later)).plan, null);
});

test("a record that is no longer a ribbon is refused", async () => {
  const note = createRecord("note", { body: "hi", bookKey: "john", chapter: 3, verse: 1, endVerse: 1 }, { ...ctx, id: "a" });
  const out = await planRibbonRename(fake([note]), "a", "Friday", later);
  assert.equal(out.plan, null);
  assert.equal(out.problem, RIBBON_GONE);
});

test("a rename to a name another ribbon took meanwhile is refused", async () => {
  const s = fake([ribbon("a", "Thursday"), ribbon("b", "Sunday")]);
  // Another tab renames b to "Friday" after this form opened.
  s.records[1] = { ...s.records[1], name: "Friday" };
  const out = await planRibbonRename(s, "a", "friday", later);
  assert.equal(out.plan, null);
  assert.equal(out.problem, "You already have a ribbon with that name.");
});

test("an empty name is refused, and the same name over itself writes nothing", async () => {
  const s = fake([ribbon("a", "Thursday")]);
  assert.equal((await planRibbonRename(s, "a", "   ", later)).problem, "Give the ribbon a name.");
  const same = await planRibbonRename(s, "a", "Thursday", later);
  assert.equal(same.plan, null);
  assert.equal(same.problem, null);
  assert.equal(same.record.id, "a");
  // Capitals alone are a change of its own name, not a clash.
  assert.equal((await planRibbonRename(s, "a", "THURSDAY", later)).plan.put[0].name, "THURSDAY");
});

const place = { bookKey: "luke", chapter: 10, verse: 25, endVerse: 25 };

test("a move writes the new place over the record as it is now", async () => {
  const s = fake([ribbon("a", "Thursday")]);
  const out = await planRibbonMove(s, "a", place, later);
  assert.equal(out.problem, null);
  assert.deepEqual(
    [out.plan.put[0].bookKey, out.plan.put[0].chapter, out.plan.put[0].verse, out.plan.put[0].endVerse],
    ["luke", 10, 25, 25],
  );
  assert.equal(out.plan.put[0].name, "Thursday");
});

test("a ribbon deleted before the move is written is not brought back", async () => {
  const held = ribbon("a", "Thursday");
  const s = fake([held]);
  s.records.splice(0, 1, trashed(held));
  const out = await planRibbonMove(s, "a", place, later);
  assert.equal(out.plan, null);
  assert.equal(out.problem, RIBBON_GONE);
  assert.equal((await planRibbonMove(fake([]), "a", place, later)).problem, RIBBON_GONE);
});

test("moving a ribbon to where it already is writes nothing", async () => {
  const s = fake([ribbon("a", "Thursday", 25)]);
  s.records[0] = { ...s.records[0], bookKey: "luke", chapter: 10 };
  const out = await planRibbonMove(s, "a", place, later);
  assert.equal(out.plan, null);
  assert.equal(out.problem, null);
});

test("a new ribbon is made when the name is free and there is room", async () => {
  const s = fake([ribbon("a", "Thursday")]);
  const out = await planRibbonCreate(s, " Sunday ", place, ctx);
  assert.equal(out.problem, null);
  const made = out.plan.put[0];
  assert.equal(made.name, "Sunday");
  assert.equal(made.ribbon, true);
  assert.equal(made.kind, "place");
  assert.equal(out.record, made);
});

test("a new ribbon whose name another ribbon took meanwhile is refused", async () => {
  const s = fake([ribbon("a", "Thursday")]);
  // The form opened with one ribbon; a second tab made "Sunday" before the save.
  s.records.push(ribbon("b", "Sunday"));
  const out = await planRibbonCreate(s, "sunday", place, ctx);
  assert.equal(out.plan, null);
  assert.equal(out.problem, "You already have a ribbon with that name.");
});

test("a new ribbon is refused when the limit was reached meanwhile", async () => {
  const s = fake([ribbon("a", "One")]);
  for (let i = 2; i <= MAX_RIBBONS; i++) s.records.push(ribbon(`r${i}`, `Ribbon ${i}`));
  const out = await planRibbonCreate(s, "Seventh", place, ctx);
  assert.equal(out.plan, null);
  assert.equal(out.problem, RIBBON_LIMIT_REACHED);
});

test("a deleted ribbon does not count toward the limit", async () => {
  const records = [];
  for (let i = 1; i <= MAX_RIBBONS; i++) records.push(ribbon(`r${i}`, `Ribbon ${i}`));
  records[0] = trashed(records[0]);
  const out = await planRibbonCreate(fake(records), "Again", place, ctx);
  assert.equal(out.problem, null);
  assert.ok(out.plan);
});
