// test/desk-store-core.test.js
//
// src/lib/desk-store-core.mjs: what each notebook change writes. The
// IndexedDB shell (src/scripts/desk/store.js) commits these plans as they
// come, so a plan that's wrong here is a notebook that's wrong in the browser.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createRecord } from "../src/lib/desk-records.mjs";
import {
  CHANNEL,
  changeMessage,
  forChapter,
  kindName,
  liveRecords,
  planDelete,
  planPurge,
  planSave,
  planUndo,
  readChangeMessage,
  recordHref,
  recordReference,
  touched,
  webClient,
} from "../src/lib/desk-store-core.mjs";

const base = { client: "web/2026.10", contentVersion: "v20261005.5d2c847d" };
let n = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

function note(where, extra = {}) {
  return createRecord(
    "note",
    { body: "mine", marker: "note", ...where, ...extra },
    { ...base, now: "2026-10-05T12:00:00.000Z", id: nextId() },
  );
}

test("planSave puts a valid record and refuses a malformed one", () => {
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  assert.deepEqual(planSave(r), { put: [r], remove: [] });
  assert.throws(() => planSave({ ...r, marker: "star" }), /not saved/);
  assert.throws(() => planSave({ ...r, chapter: 17 }), /chapter is out of range/);
});

test("planDelete puts the trash record and removes the live one", () => {
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const plan = planDelete(r, { ...base, now: "2026-10-06T00:00:00.000Z" });
  assert.equal(plan.put.length, 1);
  assert.equal(plan.put[0], plan.trash);
  assert.equal(plan.trash.kind, "trash");
  assert.equal(plan.trash.deletedId, r.id);
  assert.deepEqual(plan.remove, [r.id]);
  assert.deepEqual(touched(plan), [plan.trash.id, r.id]);
});

test("planUndo puts the record back and removes its trash record", () => {
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const { trash } = planDelete(r, { ...base, now: "2026-10-06T00:00:00.000Z" });
  const plan = planUndo(trash, { ...base, now: "2026-10-06T00:00:05.000Z" });
  assert.equal(plan.record.id, r.id);
  assert.equal(plan.record.modified, "2026-10-06T00:00:05.000Z");
  assert.deepEqual(plan.put, [plan.record]);
  assert.deepEqual(plan.remove, [trash.id]);
});

test("planUndo has nothing to do once the trash is emptied", () => {
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const { trash } = planDelete(r, { ...base, now: "2026-08-01T00:00:00.000Z" });
  const [emptied] = planPurge([trash], "2026-10-01T00:00:00.000Z").put;
  assert.equal(planUndo(emptied, base), null);
});

test("planPurge empties only trash past its 30 days", () => {
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const old = planDelete(r, { ...base, now: "2026-08-01T00:00:00.000Z" }).trash;
  const fresh = planDelete(note({ bookKey: "john", chapter: 3, verse: 16 }), { ...base, now: "2026-09-30T00:00:00.000Z" }).trash;
  const plan = planPurge([r, old, fresh], "2026-10-01T00:00:00.000Z");
  assert.equal(plan.put.length, 1);
  assert.equal(plan.put[0].id, old.id);
  assert.equal("record" in plan.put[0], false);
  assert.deepEqual(plan.remove, []);
  assert.deepEqual(planPurge([r, fresh], "2026-10-01T00:00:00.000Z"), { put: [], remove: [] });
});

test("change messages: what tabs send each other, and nothing else is read", () => {
  assert.equal(CHANNEL, "lit-desk");
  assert.deepEqual(changeMessage(["a", "b", "a"]), { v: 1, ids: ["a", "b"] });
  assert.deepEqual(readChangeMessage({ v: 1, ids: ["a"] }), ["a"]);
  assert.deepEqual(readChangeMessage({ v: 1, ids: [] }), []);
  for (const bad of [null, "a", { v: 2, ids: ["a"] }, { v: 1 }, { v: 1, ids: [1] }]) {
    assert.equal(readChangeMessage(bad), null);
  }
});

test("liveRecords leaves trash out and orders by Bible order, then verse, then age", () => {
  const john = note({ bookKey: "john", chapter: 3, verse: 16 });
  const rom8v28 = note({ bookKey: "romans", chapter: 8, verse: 28 });
  const rom8v3 = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const matt = note({ bookKey: "matthew", chapter: 5, verse: 3 });
  const label = createRecord("label", { name: "Lent" }, { ...base, id: nextId() });
  const { trash } = planDelete(note({ bookKey: "mark", chapter: 1, verse: 1 }), base);
  const got = liveRecords([rom8v28, label, john, trash, rom8v3, matt]);
  assert.deepEqual(got.map((r) => r.id), [matt.id, john.id, rom8v3.id, rom8v28.id, label.id]);
});

test("forChapter keeps one chapter's records", () => {
  const a = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const b = note({ bookKey: "romans", chapter: 9, verse: 3 });
  const c = note({ bookKey: "1corinthians", chapter: 8, verse: 1 });
  assert.deepEqual(forChapter([a, b, c], "romans", 8), [a]);
});

test("references and links use the site's address form", () => {
  const one = { bookKey: "1corinthians", chapter: 13, verse: 4 };
  const range = { ...one, endVerse: 7 };
  assert.equal(recordReference(one), "1 Corinthians 13:4");
  assert.equal(recordReference(range), "1 Corinthians 13:4–7");
  assert.equal(recordReference({ ...one, endVerse: 4 }), "1 Corinthians 13:4");
  assert.equal(recordReference({ kind: "label" }), "");
  assert.equal(recordHref(one), "/1corinthians-13/#v4");
  assert.equal(recordHref(range), "/1corinthians-13/#v4-7");
  assert.equal(recordHref({ bookKey: "romans", chapter: 8 }), "/romans-8/");
  assert.equal(recordHref({ kind: "sheet" }), null);
});

test("kindName names every kind but trash, and an unknown kind plainly", () => {
  assert.equal(kindName("note"), "Note");
  assert.equal(kindName("hidden"), "Hidden passage");
  assert.equal(kindName("voiceMemo"), "Item");
});

test("webClient is the year and month of the page's text", () => {
  assert.equal(webClient("v20261005.5d2c847d"), "web/2026.10");
  assert.equal(webClient("unversioned"), "web/dev");
  assert.equal(webClient(undefined), "web/dev");
});
