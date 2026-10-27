// src/scripts/desk/store.js
//
// The notebook in this browser: one IndexedDB database, kept in step across
// the reader's open tabs with a BroadcastChannel (STUDY-DESK.md, "How it would
// be built", Storage). The thin shell over src/lib/desk-store-core.mjs, which
// decides what each change writes; this file only commits the plans (its own,
// and a multi-record one from a caller, through `commit`) and tells the other
// tabs which records moved.
//
// Records are stored as the format's logical records, unchanged (principle 6:
// a field or kind this code doesn't know is written back as it came).
//
// Every write this tab makes for the reader also leaves a history entry
// (src/lib/desk-history.mjs): the records it touched, as they stood just before
// and just after. That is recorded here, in the one place every write passes
// through, so a note, a bookmark, a highlight that merges with its neighbours
// and a deletion are all undoable without each caller saying how. A change
// that arrives from another tab is never an entry, and neither is the purge
// of expired trash at open or the history's own undo and redo, which write
// with `record: false`. `onEntry` and `lastEntry` are how the history hears.
//
// A change that depends on what the notebook holds (deleting, undoing a
// deletion, the purge, the history's own steps, the note editor's save) reads
// and writes in one transaction, through `change`, so another tab's write
// can't land between the reading and the writing (BA13). And a write that
// fails partway is aborted, so none of it is kept (BA5): under the IndexedDB
// spec a request that throws (a record the browser can't clone, say) doesn't
// abort the transaction by itself, and the requests before it would commit.
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
  planWrite,
  readChangeMessage,
  touched,
} from "../../lib/desk-store-core.mjs";
import { isNoop, makeEntry } from "../../lib/desk-history.mjs";

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

  let entrySeq = 0;
  let latest = null;
  const entryListeners = new Set();
  const entryId = () => globalThis.crypto?.randomUUID?.() ?? `entry-${Date.now().toString(36)}-${++entrySeq}`;

  /**
   * Write a plan in one transaction and tell everyone. `build` is the plan, or
   * a function that makes it from what the notebook holds: it is handed
   * `{ get, all }`, which read inside the same transaction, and may return
   * null to write nothing. It must await nothing but those reads, or the
   * transaction closes under it. Resolves to the plan written, or null.
   *
   * With `record` (the default) it also remembers the change for the history:
   * the records it touches are read in the same transaction, ahead of the
   * writes (requests in a transaction run in the order they were made, so
   * those reads see the notebook as it was), and the entry is announced once
   * the write is safe. Anything that throws before then aborts the whole
   * transaction and rejects with its own error.
   */
  /** Transactions waiting for what they read before they write (writeNow). */
  const reading = new Set();

  async function apply(build, { record = true } = {}) {
    if (typeof build !== "function" && !build.put.length && !build.remove.length) return build;
    const tx = db.transaction(RECORDS, "readwrite");
    const done = committed(tx);
    // Handled below; this keeps an abort from also reporting itself unhandled.
    done.catch(() => {});
    const objects = tx.objectStore(RECORDS);
    let plan;
    let ids = [];
    let was = [];
    try {
      if (typeof build === "function") {
        reading.add(tx);
        try {
          plan = await build({ get: (id) => request(objects.get(id)), all: () => request(objects.getAll()) });
        } finally {
          reading.delete(tx);
        }
      } else plan = build;
      if (plan && (plan.put.length || plan.remove.length)) {
        ids = touched(plan);
        was = record ? ids.map((id) => objects.get(id)) : [];
        for (const r of plan.put) objects.put(r);
        for (const id of plan.remove) objects.delete(id);
      }
    } catch (err) {
      try {
        tx.abort();
      } catch {
        /* already finished */
      }
      throw err;
    }
    await done;
    if (!ids.length) return plan ?? null;
    channel?.postMessage(changeMessage(ids));
    if (record) {
      const entry = makeEntry(plan, new Map(ids.map((id, i) => [id, was[i].result ?? null])), entryId());
      // A change that left the notebook as it found it isn't worth undoing,
      // and clears `latest` so a caller asking for its entry gets nothing
      // rather than the one before.
      latest = isNoop(entry) ? null : entry;
      if (latest) {
        for (const fn of entryListeners) {
          try {
            fn(entry);
          } catch (err) {
            console.error("Study Desk: a history listener failed", err);
          }
        }
      }
    }
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

    /**
     * Small facts about this notebook that aren't records (when a copy was last
     * saved, whether the browser was asked to keep it). Never synced or exported.
     */
    getMeta,
    setMeta,

    /** Save a new or edited record. */
    async save(record) {
      await apply(planSave(record));
      askToPersist();
      return record;
    },

    /**
     * Commit a plan that writes several records at once (a highlight that
     * merges with its neighbours, and the history's undo and redo), in one
     * transaction. Refuses a malformed record before anything is written.
     * Resolves to the plan; an empty one does nothing. The change is
     * remembered for the history unless `record` is false, which is how the
     * history writes its own undo and redo.
     */
    async commit(plan, { record = true } = {}) {
      const checked = planWrite(plan);
      if (!checked.put.length && !checked.remove.length) return plan;
      await apply(checked, { record });
      askToPersist();
      return plan;
    },

    /**
     * Write a plan for a page that is going away (`pagehide`), when nothing
     * after the event will run (BA72): the writes are made before this
     * returns, with no read first, and the transaction is committed at once.
     * A transaction that has to read, or that isn't committed, doesn't
     * survive the page closing, and neither does one opened behind a
     * transaction still waiting for its read, so those are aborted first:
     * they could never finish, and the caller writes what they would have
     * (checked in Chrome, 2026-10-27). Not remembered for the history.
     * Throws on a malformed record, as `commit` refuses one; returns whether
     * anything was written.
     */
    writeNow(plan) {
      const checked = planWrite(plan);
      if (!checked.put.length && !checked.remove.length) return false;
      for (const stuck of reading) {
        try {
          stuck.abort();
        } catch {
          /* already finished */
        }
      }
      reading.clear();
      const tx = db.transaction(RECORDS, "readwrite");
      const objects = tx.objectStore(RECORDS);
      for (const r of checked.put) objects.put(r);
      for (const id of checked.remove) objects.delete(id);
      tx.commit?.();
      channel?.postMessage(changeMessage(touched(checked)));
      return true;
    },

    /**
     * A change that depends on what the notebook holds now, read and written
     * in one transaction. `build({ get, all })` reads through those two and
     * nothing else, and returns the plan, or null to write nothing. The plan
     * is written as it is, so a caller writing the reader's own record checks
     * it first (planSave, planWrite). Resolves to what `build` returned.
     * Remembered for the history unless `record` is false.
     */
    async change(build, { record = true } = {}) {
      let made = null;
      await apply(
        async (reads) => {
          made = await build(reads);
          return made ? { put: made.put ?? [], remove: made.remove ?? [] } : null;
        },
        { record },
      );
      if (made) askToPersist();
      return made;
    },

    /** Delete a record; resolves to the trash record that holds it. */
    async remove(id) {
      const plan = await store.change(async ({ get }) => {
        const record = await get(id);
        return record && record.kind !== "trash" ? planDelete(record, ctx()) : null;
      });
      return plan?.trash ?? null;
    },

    /** Undo a deletion; resolves to the record brought back, or null. */
    async undo(trashId) {
      const plan = await store.change(async ({ get }) => {
        const trash = await get(trashId);
        return trash?.kind === "trash" ? planUndo(trash, ctx()) : null;
      });
      return plan?.record ?? null;
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

    /**
     * Called with each history entry (src/lib/desk-history.mjs) as this tab
     * writes it. Changes from other tabs, the purge below and the history's
     * own undo and redo make none.
     */
    onEntry(fn) {
      entryListeners.add(fn);
      return () => entryListeners.delete(fn);
    },

    /**
     * The entry the latest write made, or null when it made none (it changed
     * nothing). A caller reads it straight after awaiting its own write, to
     * offer that one change back.
     */
    lastEntry: () => latest,
  };

  // Trash past its 30 days keeps only its tombstone (desk-records). Not
  // something the reader did, so not something to undo.
  // Read and written together, so a restore in another tab meanwhile isn't
  // answered with an emptied trash record beside the record it brought back.
  await apply(async ({ all }) => planPurge(await all(), new Date().toISOString()), { record: false });

  return store;
}
