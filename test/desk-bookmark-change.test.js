// test/desk-bookmark-change.test.js
//
// src/lib/desk-bookmark-change.mjs: naming a bookmark and turning "Move as I
// read" on or off, over the records the notebook holds at the write
// (STUDY-DESK-AUDIT-1.md BA102; STUDY-DESK.md E9). The store is a fake whose
// `get` waits a turn, as a real read does, and whose records can change
// between the form opening and the write.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createRecord } from "../src/lib/desk-records.mjs";
import { MAX_FOLLOWING } from "../src/lib/desk-bookmarks.mjs";
import {
  BOOKMARK_GONE,
  BOOKMARK_NEWER,
  FOLLOW_LIMIT_REACHED,
  planBookmarkEdit,
} from "../src/lib/desk-bookmark-change.mjs";

const ctx = { now: "2026-10-28T12:00:00.000Z", client: "web/2026.10", contentVersion: "v20261028.aaaaaaaa" };
const later = { now: "2026-10-28T13:00:00.000Z", client: "web/2026.10" };
const bookmark = (id, extra = {}, verse = 1) =>
  createRecord("bookmark", { bookKey: "john", chapter: 3, verse, endVerse: verse, ...extra }, { ...ctx, id });

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

test("a name is tidied and written over the record as it is now", async () => {
  const s = fake([bookmark("a", { label: "Thursday" })]);
  s.records[0] = { ...s.records[0], verse: 16, endVerse: 16 };
  const out = await planBookmarkEdit(s, "a", { name: "  Friday  group " }, later);
  assert.equal(out.problem, null);
  assert.equal(out.plan.put[0].label, "Friday group");
  assert.equal(out.plan.put[0].verse, 16, "a move made meanwhile is kept");
  assert.equal(out.plan.put[0].modified, later.now);
});

test("two bookmarks may share a name, and a bookmark needs none", async () => {
  const s = fake([bookmark("a", { label: "Thursday" }), bookmark("b")]);
  const out = await planBookmarkEdit(s, "b", { name: "thursday" }, later);
  assert.equal(out.problem, null);
  assert.equal(out.plan.put[0].label, "thursday");
});

test("an emptied name removes the label, and nothing else", async () => {
  const s = fake([bookmark("a", { label: "Thursday", follow: true })]);
  const out = await planBookmarkEdit(s, "a", { name: "   " }, later);
  assert.equal("label" in out.plan.put[0], false);
  assert.equal(out.plan.put[0].follow, true);
});

test("the same values over themselves write nothing", async () => {
  const s = fake([bookmark("a", { label: "Thursday", follow: true })]);
  assert.equal((await planBookmarkEdit(s, "a", { name: "Thursday", follow: true }, later)).plan, null);
  const plain = fake([bookmark("a")]);
  assert.equal((await planBookmarkEdit(plain, "a", { name: "", follow: false }, later)).plan, null);
});

test("turning the switch off takes `follow` out, so a plain bookmark is as it was", async () => {
  const s = fake([bookmark("a", { follow: true })]);
  const out = await planBookmarkEdit(s, "a", { follow: false }, later);
  assert.equal("follow" in out.plan.put[0], false);
  const on = await planBookmarkEdit(fake([bookmark("b")]), "b", { follow: true }, later);
  assert.equal(on.plan.put[0].follow, true);
});

test("a bookmark deleted before the change is written is not brought back", async () => {
  const held = bookmark("a");
  const s = fake([held]);
  s.records.splice(0, 1, trashed(held));
  const out = await planBookmarkEdit(s, "a", { name: "Friday" }, later);
  assert.equal(out.plan, null);
  assert.equal(out.problem, BOOKMARK_GONE);
  assert.equal((await planBookmarkEdit(fake([]), "a", { name: "x" }, later)).plan, null);
});

test("a record that is not a bookmark is refused", async () => {
  const note = createRecord("note", { body: "hi", bookKey: "john", chapter: 3, verse: 1, endVerse: 1 }, { ...ctx, id: "a" });
  const out = await planBookmarkEdit(fake([note]), "a", { name: "Friday" }, later);
  assert.equal(out.plan, null);
  assert.equal(out.problem, BOOKMARK_GONE);
});

test("a bookmark from a newer schema is refused rather than thrown on", async () => {
  const newer = { ...bookmark("a"), schema: 99 };
  const out = await planBookmarkEdit(fake([newer]), "a", { name: "x" }, later);
  assert.equal(out.plan, null);
  assert.equal(out.problem, BOOKMARK_NEWER);
});

test("only the bookmarks that move count against the limit of six", async () => {
  const moving = Array.from({ length: MAX_FOLLOWING }, (_, i) => bookmark(`m${i}`, { follow: true }, i + 1));
  const plain = Array.from({ length: 10 }, (_, i) => bookmark(`p${i}`, {}, i + 20));
  const s = fake([...moving, ...plain]);
  const out = await planBookmarkEdit(s, "p0", { follow: true }, later);
  assert.equal(out.plan, null);
  assert.equal(out.problem, FOLLOW_LIMIT_REACHED);
  // A plain bookmark can be renamed at the limit, and one that moves may keep moving.
  assert.equal((await planBookmarkEdit(s, "p0", { name: "x" }, later)).problem, null);
  assert.equal((await planBookmarkEdit(s, "m0", { follow: true, name: "x" }, later)).problem, null);
  // Turning one off makes room.
  const off = await planBookmarkEdit(s, "m0", { follow: false }, later);
  assert.equal(off.problem, null);
});

test("the limit is checked against the notebook at the write, not the form's list", async () => {
  const s = fake([bookmark("p0")]);
  // Another tab turned six on after the form opened.
  for (let i = 0; i < MAX_FOLLOWING; i++) s.records.push(bookmark(`m${i}`, { follow: true }, i + 1));
  const out = await planBookmarkEdit(s, "p0", { follow: true }, later);
  assert.equal(out.problem, FOLLOW_LIMIT_REACHED);
});
