// test/desk-store.test.js
//
// The real IndexedDB shell, src/scripts/desk/store.js, run against
// fake-indexeddb (Audit 2, LG-1). The pure planners have their own tests;
// this holds the layer that commits them: a transaction that aborts whole,
// the read-then-write of `change`, `writeNow`, the upgrade handler, the
// change notices between two stores, and the request for persistent storage.

import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";

import { createRecord } from "../src/lib/desk-records.mjs";
import { planSave } from "../src/lib/desk-store-core.mjs";

const ctx = () => ({ client: "web/2026.11", contentVersion: "v20261104.1" });
let n = 0;
const note = (extra = {}) =>
  createRecord(
    "note",
    { body: "mine", marker: "note", bookKey: "romans", chapter: 8, verse: 3, ...extra },
    { ...ctx(), now: "2026-11-04T12:00:00.000Z", id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` },
  );

/** A fresh browser: its own database, and a navigator.storage that answers as told. */
async function freshBrowser({ persisted = false, grant = true } = {}) {
  // The last test's request for persistent storage may still be in flight; let it land first.
  await settled();
  globalThis.indexedDB = new IDBFactory();
  const calls = { persist: 0 };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      storage: {
        persisted: async () => persisted,
        persist: async () => {
          calls.persist += 1;
          if (grant === "throw") throw new Error("not offered");
          return grant;
        },
      },
    },
  });
  return calls;
}

// An open channel keeps node alive; the stores here are never closed.
const RealChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = class extends RealChannel {
  constructor(name) {
    super(name);
    this.unref();
  }
};

const { DB_NAME, openStore, settled } = await import("../src/scripts/desk/store.js");
const settle = () => new Promise((r) => setTimeout(r, 20));

test("a saved record is read back, and by chapter", async () => {
  await freshBrowser();
  const store = await openStore({ ctx });
  const r = note();
  await store.save(r);
  assert.deepEqual(await store.get(r.id), r);
  assert.deepEqual(await store.byChapter("romans", 8), [r]);
  assert.deepEqual(await store.byChapter("romans", 9), []);
});

test("a malformed record is refused before anything is written", async () => {
  await freshBrowser();
  const store = await openStore({ ctx });
  await assert.rejects(store.save({ ...note(), marker: "spark" }), /not saved/);
  assert.deepEqual(await store.all(), []);
});

test("a change that throws writes nothing, even after a put was queued", async () => {
  await freshBrowser();
  const store = await openStore({ ctx });
  const good = note();
  await assert.rejects(
    store.change(async ({ get }) => {
      await get("nothing");
      throw new Error("build failed");
    }),
    /build failed/,
  );
  // A record the browser can't clone throws inside the transaction (BA5): the put before it must not survive.
  await assert.rejects(store.commit({ put: [good, { ...note(), poison: () => {} }], remove: [] }));
  assert.deepEqual(await store.all(), []);
});

test("a put that fails with QuotaExceededError inside a change writes nothing, remembers nothing, and tells no one", async () => {
  await freshBrowser();
  const store = await openStore({ ctx });
  const saved = note();
  await store.save(saved);
  await settle(); // the first save's persist request lands before the counts below start
  const entry = store.lastEntry();
  assert.ok(entry, "the earlier save is in the history");

  // Only a notice naming this change's records counts: the BroadcastChannel is
  // shared by every store in the process, so an earlier test's store can post
  // a change that this one hears as another tab's.
  const failing = new Set();
  let heard = 0;
  store.subscribe((ids) => { if (ids.some((id) => failing.has(id))) heard += 1; });
  let entries = 0;
  store.onEntry(() => { entries += 1; });

  // fake-indexeddb cannot fill a disk, so the second put in the change throws
  // the error a full disk gives. The put before it has already been queued.
  const realPut = IDBObjectStore.prototype.put;
  let puts = 0;
  IDBObjectStore.prototype.put = function (...args) {
    if (this.name === "records" && ++puts === 2) {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    }
    return realPut.apply(this, args);
  };
  const first = note();
  const second = note();
  failing.add(first.id).add(second.id);
  try {
    await assert.rejects(
      store.change(() => ({ put: [first, second], remove: [] })),
      (err) => err.name === "QuotaExceededError",
    );
  } finally {
    IDBObjectStore.prototype.put = realPut;
  }
  await settle();

  assert.equal(await store.get(first.id), undefined, "the put before the failure is rolled back");
  assert.equal(await store.get(second.id), undefined);
  assert.equal(store.lastEntry(), entry, "no history entry is written for the failed change");
  assert.equal(entries, 0, "and no history listener hears of one");
  assert.equal(heard, 0, "no change listener is told");

  // The store is not left broken: the next write goes through.
  const later = note();
  await store.save(later);
  assert.deepEqual((await store.get(later.id)).body, "mine");
});

// This found committed() settling on the transaction's error event, while
// tx.error was still null, so the change rejected with null (Audit 3
// follow-up, 2026-11-07); the abort, which carries the error, is now the one
// rejection.
test("a transaction that aborts with QuotaExceededError after the puts were queued (Chrome's full disk) rejects the change, writes nothing, remembers nothing, and tells no one", async () => {
  await freshBrowser();
  const store = await openStore({ ctx });
  const saved = note();
  await store.save(saved);
  await settle(); // the first save's persist request lands before the counts below start
  const entry = store.lastEntry();
  assert.ok(entry, "the earlier save is in the history");

  // As in the test above, only a notice naming this change's records counts.
  const failing = new Set();
  let heard = 0;
  store.subscribe((ids) => { if (ids.some((id) => failing.has(id))) heard += 1; });
  let entries = 0;
  store.onEntry(() => { entries += 1; });

  // Chrome takes the put and fails the write later, when the transaction runs
  // it: the request's error event bubbles to the transaction, which aborts
  // with that error. In fake-indexeddb the write a request runs is the backing
  // store's storeRecord, called from the transaction's queue, and one that
  // throws takes the same path (the request's error, then the transaction's
  // abort). The backing store is shared by every connection to the database,
  // so a second connection reaches the one this store writes to. The patch is
  // on that one object, and deleting it brings back the prototype's method.
  const probe = await new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  const backing = probe.transaction("records", "readonly").objectStore("records")._rawObjectStore;
  probe.close();
  const storeRecord = backing.storeRecord;
  let writes = 0;
  backing.storeRecord = function (record, ...rest) {
    if (failing.has(record.value?.id) && ++writes === 2) {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    }
    return storeRecord.call(this, record, ...rest);
  };
  const first = note();
  const second = note();
  const third = note();
  const fourth = note();
  failing.add(first.id).add(second.id).add(third.id).add(fourth.id);
  try {
    await assert.rejects(
      store.change(() => ({ put: [first, second], remove: [] })),
      (err) => err?.name === "QuotaExceededError",
    );
    assert.equal(writes, 2, "both puts were taken, and the second failed when the transaction ran it");
    // commit, the other writer that waits for its transaction, takes the same path.
    writes = 0;
    await assert.rejects(
      store.commit({ put: [third, fourth], remove: [] }),
      (err) => err?.name === "QuotaExceededError",
    );
    assert.equal(writes, 2);
  } finally {
    delete backing.storeRecord;
  }
  await settle();

  for (const r of [first, second, third, fourth]) {
    assert.equal(await store.get(r.id), undefined, "nothing the failed changes wrote is kept");
  }
  assert.equal(store.lastEntry(), entry, "no history entry is written for the failed changes");
  assert.equal(entries, 0, "and no history listener hears of one");
  assert.equal(heard, 0, "no change listener is told");

  // The store is not left broken: the next write goes through.
  const later = note();
  await store.save(later);
  assert.deepEqual((await store.get(later.id)).body, "mine");
});

test("change reads and writes in one transaction", async () => {
  await freshBrowser();
  const store = await openStore({ ctx });
  const r = note();
  await store.save(r);
  const plan = await store.change(async ({ get, all }) => {
    assert.equal((await get(r.id)).id, r.id);
    assert.equal((await all()).length, 1);
    return planSave({ ...r, body: "changed", modified: "2026-11-04T13:00:00.000Z" });
  });
  assert.equal(plan.put[0].body, "changed");
  assert.equal((await store.get(r.id)).body, "changed");
});

test("remove puts a trash record in the notebook and undo brings the record back", async () => {
  await freshBrowser();
  const store = await openStore({ ctx });
  const r = note();
  await store.save(r);
  const trash = await store.remove(r.id);
  assert.equal(trash.kind, "trash");
  assert.equal(await store.get(r.id), undefined);
  const back = await store.undo(trash.id);
  assert.equal(back.id, r.id);
  assert.equal((await store.get(r.id)).body, "mine");
});

test("a write leaves one history entry; a record:false write leaves none", async () => {
  await freshBrowser();
  const store = await openStore({ ctx });
  const heard = [];
  store.onEntry((e) => heard.push(e));
  await store.save(note());
  assert.equal(heard.length, 1);
  assert.equal(store.lastEntry(), heard[0]);
  await store.commit(planSave(note()), { record: false });
  assert.equal(heard.length, 1);
});

test("writeNow writes before it returns, without a read", async () => {
  await freshBrowser();
  const store = await openStore({ ctx });
  const r = note();
  assert.equal(store.writeNow(planSave(r)), true);
  assert.equal(store.writeNow({ put: [], remove: [] }), false);
  await settle();
  assert.equal((await store.get(r.id)).id, r.id);
  assert.throws(() => store.writeNow({ put: [{ ...r, marker: "spark" }], remove: [] }), /not saved/);
});

test("a second store hears the first one's change as another tab's", async () => {
  await freshBrowser();
  const a = await openStore({ ctx });
  const b = await openStore({ ctx });
  const heard = [];
  b.subscribe((ids, origin) => heard.push([ids, origin]));
  const metas = [];
  b.onMeta((key, origin) => metas.push([key, origin]));
  const r = note();
  await a.save(r);
  await a.setMeta("lastExport", "2026-11-04");
  await settle();
  assert.deepEqual(heard, [[[r.id], "other-tab"]]);
  assert.deepEqual(metas.filter(([k]) => k === "lastExport"), [["lastExport", "other-tab"]]);
  assert.equal(await b.getMeta("lastExport"), "2026-11-04");
});

test("a listener that asks for other kinds isn't told", async () => {
  await freshBrowser();
  const store = await openStore({ ctx });
  const heard = [];
  store.subscribe((ids) => heard.push(ids), { kinds: ["highlight"] });
  await store.save(note());
  assert.deepEqual(heard, []);
});

test("the first write asks the browser to keep the notebook, once, and remembers it", async () => {
  const calls = await freshBrowser({ grant: true });
  const store = await openStore({ ctx });
  await store.save(note());
  await store.save(note());
  await settle();
  assert.equal(calls.persist, 1);
  assert.equal((await store.getMeta("persistAsked")).granted, true);
});

test("a refused request is asked again only after a day, and a rejected one is ignored", async () => {
  const calls = await freshBrowser({ grant: false });
  const first = await openStore({ ctx });
  await first.save(note());
  await settle();
  assert.equal(calls.persist, 1);
  // Same database, a new visit: the stored "no" is under a day old, so nothing is asked.
  const second = await openStore({ ctx });
  await second.save(note());
  await settle();
  assert.equal(calls.persist, 1);
  // Aged past a day, it is asked again.
  await second.setMeta("persistAsked", { at: new Date(Date.now() - 2 * 86_400_000).toISOString(), granted: false });
  const third = await openStore({ ctx });
  await third.save(note());
  await settle();
  assert.equal(calls.persist, 2);

  await freshBrowser({ grant: "throw" });
  const quiet = await openStore({ ctx });
  await quiet.save(note());
  assert.equal((await quiet.all()).length, 1);
});

test("askToKeep answers true, false or null, and persisted says what the browser promised", async () => {
  await freshBrowser({ grant: true, persisted: true });
  const store = await openStore({ ctx });
  assert.equal(await store.askToKeep(), true);
  assert.equal(await store.persisted(), true);
  await freshBrowser({ grant: "throw" });
  const other = await openStore({ ctx });
  assert.equal(await other.askToKeep(), null);
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
  assert.equal(await other.askToKeep(), null);
  assert.equal(await other.persisted(), null);
});

test("opening a database from version 1 keeps its records and its indexes", async () => {
  await freshBrowser();
  const first = await openStore({ ctx });
  const r = note();
  await first.save(r);
  const second = await openStore({ ctx });
  assert.deepEqual(await second.byChapter("romans", 8), [r]);
});

test("opening refuses where the browser keeps no database", async () => {
  await freshBrowser();
  delete globalThis.indexedDB;
  const { openStore: open } = await import("../src/scripts/desk/store.js");
  await assert.rejects(open({ ctx }), /IndexedDB isn't available/);
});

test("the purge at open drops trash past its 30 days and records no history", async () => {
  await freshBrowser();
  const first = await openStore({ ctx });
  const r = note();
  await first.save(r);
  const trash = await first.remove(r.id);
  // Age the trash record beyond 30 days, then reopen.
  await first.change(async ({ get }) => {
    const t = await get(trash.id);
    return { put: [{ ...t, deletedAt: "2026-01-01T00:00:00.000Z" }], remove: [] };
  }, { record: false });
  const second = await openStore({ ctx });
  const left = await second.get(trash.id);
  assert.ok(!left || !left.record, "the record inside is emptied");
  assert.equal(second.lastEntry(), null);
});
