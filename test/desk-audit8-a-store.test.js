// test/desk-audit8-a-store.test.js
//
// Audit 8, DI8-5: after a `versionchange` the store closed its connection and
// every later call threw on it for the rest of the page's life. Now the next
// call opens the database again: after a deletion that works, and after a
// newer page's upgrade it rejects with NOTEBOOK_UPGRADED, which a caller can
// tell apart, rather than InvalidStateError from a closed connection. Run
// against fake-indexeddb, as test/desk-store.test.js runs the store.

import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";

import { createRecord } from "../src/lib/desk-records.mjs";
import { planSave } from "../src/lib/desk-store-core.mjs";

const ctx = () => ({ client: "web/2026.11", contentVersion: "v20261109.1" });
let n = 0;
const note = () =>
  createRecord(
    "note",
    { body: "mine", marker: "note", bookKey: "romans", chapter: 8, verse: 3 },
    { ...ctx(), now: "2026-11-09T12:00:00.000Z", id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` },
  );

// An open channel keeps node alive; the stores here are never closed.
const RealChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = class extends RealChannel {
  constructor(name) {
    super(name);
    this.unref();
  }
};
Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });

const { DB_NAME, NOTEBOOK_UPGRADED, openStore } = await import("../src/scripts/desk/store.js");

const done = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

test("after a newer page upgrades the database elsewhere, every call says so by name", async () => {
  globalThis.indexedDB = new IDBFactory();
  const store = await openStore({ ctx });
  const r = note();
  await store.save(r);
  // Another tab, running a later DB_VERSION: the store lets go, so this opens.
  const newer = await done(indexedDB.open(DB_NAME, 2));
  newer.close();
  for (const call of [() => store.get(r.id), () => store.all(), () => store.save(note()), () => store.change(async ({ get }) => (await get(r.id), null))]) {
    await assert.rejects(call(), (err) => err?.name === NOTEBOOK_UPGRADED && /reload/.test(err.message));
  }
  assert.throws(() => store.writeNow(planSave(note())), (err) => err?.name !== "InvalidStateError" && /closed/.test(err.message));
});

test("after the database is deleted elsewhere, the next write opens it again", async () => {
  globalThis.indexedDB = new IDBFactory();
  const store = await openStore({ ctx });
  await store.save(note());
  await done(indexedDB.deleteDatabase(DB_NAME));
  const r = note();
  await store.save(r);
  assert.deepEqual(await store.all(), [r]);
  assert.equal(store.writeNow(planSave(note())), true, "writeNow works again once the connection is back");
});

test("calls made together while the database is closed share one reopening, in order", async () => {
  globalThis.indexedDB = new IDBFactory();
  const store = await openStore({ ctx });
  await done(indexedDB.deleteDatabase(DB_NAME));
  const a = note();
  const b = { ...a, body: "second", modified: "2026-11-09T12:00:01.000Z" };
  // Asked one after the other, so the second write lands last.
  await Promise.all([store.save(a), store.save(b)]);
  assert.equal((await store.get(a.id)).body, "second");
});
