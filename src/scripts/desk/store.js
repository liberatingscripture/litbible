// src/scripts/desk/store.js
//
// The notebook in this browser: one IndexedDB database, kept in step across
// the reader's open tabs with a BroadcastChannel (STUDY-DESK.md, "How it would
// be built", Storage). The thin shell over src/lib/desk-store-core.mjs, which
// decides what each change writes; this file only commits the plans and tells
// the other tabs which records moved.
//
// Records are stored as the format's logical records, unchanged (principle 6:
// a field or kind this code doesn't know is written back as it came).
//
// Persistent storage is asked for on the first write, not on load. Chrome
// grants it by engagement without asking, but Firefox shows a prompt, and
// asking a reader with an empty notebook would be asking for nothing.
// Safari grants it mainly to Home Screen web apps and clears script-written
// storage after seven days of use without a visit, which is why export (1d)
// and sync (phase 4) are the real backup.

import {
  CHANNEL,
  changeMessage,
  planDelete,
  planPurge,
  planSave,
  planUndo,
  readChangeMessage,
  touched,
} from "../../lib/desk-store-core.mjs";

const DB_NAME = "lit-desk";
const DB_VERSION = 1;
const RECORDS = "records";
const META = "meta";

const request = (r) =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

const committed = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("desk-store: transaction aborted"));
  });

function openDatabase() {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      const records = db.createObjectStore(RECORDS, { keyPath: "id" });
      records.createIndex("kind", "kind");
      // A record not on the text has no bookKey, so it simply isn't indexed.
      records.createIndex("chapter", ["bookKey", "chapter"]);
      db.createObjectStore(META);
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

/**
 * Open the notebook. Rejects when this browser can't keep one (IndexedDB
 * missing or refused, as some private windows do); the panel says so.
 *
 * @param {{ ctx: () => { client: string, contentVersion: string } }} options
 *   what every record this tab writes is stamped with
 */
export async function openStore({ ctx }) {
  if (!globalThis.indexedDB) throw new Error("desk-store: IndexedDB isn't available");
  const db = await openDatabase();
  // A newer version of the site opening the database in another tab (a later
  // DB_VERSION) waits for this one to let go.
  db.onversionchange = () => db.close();

  const listeners = new Set();
  const notify = (ids, origin) => {
    for (const fn of listeners) fn(ids, origin);
  };

  let channel = null;
  if (globalThis.BroadcastChannel) {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (e) => {
      const ids = readChangeMessage(e.data);
      if (ids) notify(ids, "other-tab");
    };
  }

  const read = async (fn) => {
    const tx = db.transaction(RECORDS, "readonly");
    return request(fn(tx.objectStore(RECORDS)));
  };

  async function getMeta(key) {
    const tx = db.transaction(META, "readonly");
    return request(tx.objectStore(META).get(key));
  }

  async function setMeta(key, value) {
    const tx = db.transaction(META, "readwrite");
    tx.objectStore(META).put(value, key);
    await committed(tx);
  }

  async function apply(plan) {
    if (!plan.put.length && !plan.remove.length) return plan;
    const tx = db.transaction(RECORDS, "readwrite");
    const store = tx.objectStore(RECORDS);
    for (const r of plan.put) store.put(r);
    for (const id of plan.remove) store.delete(id);
    await committed(tx);
    const ids = touched(plan);
    channel?.postMessage(changeMessage(ids));
    notify(ids, "this-tab");
    return plan;
  }

  let persistAsked = false;
  async function askToPersist() {
    if (persistAsked || !navigator.storage?.persist) return;
    persistAsked = true;
    try {
      if (await navigator.storage.persisted()) return;
      if (await getMeta("persistAsked")) return;
      const granted = await navigator.storage.persist();
      await setMeta("persistAsked", { at: new Date().toISOString(), granted });
      notify([], "this-tab");
    } catch {
      /* not offered here; the notebook still works */
    }
  }

  const store = {
    get: (id) => read((s) => s.get(id)),
    all: () => read((s) => s.getAll()),
    byChapter: (bookKey, chapter) => read((s) => s.index("chapter").getAll([bookKey, chapter])),

    /** Save a new or edited record. */
    async save(record) {
      await apply(planSave(record));
      askToPersist();
      return record;
    },

    /** Delete a record; resolves to the trash record that holds it. */
    async remove(id) {
      const record = await store.get(id);
      if (!record || record.kind === "trash") return null;
      const plan = await apply(planDelete(record, ctx()));
      return plan.trash;
    },

    /** Undo a deletion; resolves to the record brought back, or null. */
    async undo(trashId) {
      const trash = await store.get(trashId);
      if (trash?.kind !== "trash") return null;
      const plan = planUndo(trash, ctx());
      if (!plan) return null;
      await apply(plan);
      return plan.record;
    },

    /**
     * Whether the browser has promised to keep the notebook: true, false, or
     * null where it can't say.
     */
    async persisted() {
      try {
        return navigator.storage?.persisted ? await navigator.storage.persisted() : null;
      } catch {
        return null;
      }
    },

    /** Called with (ids, "this-tab" | "other-tab") after every change. */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };

  // Trash past its 30 days keeps only its tombstone (desk-records).
  await apply(planPurge(await store.all(), new Date().toISOString()));

  return store;
}
