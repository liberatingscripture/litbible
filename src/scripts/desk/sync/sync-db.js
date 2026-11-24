// src/scripts/desk/sync/sync-db.js
//
// The sync's own storage: a second IndexedDB database beside the notebook's,
// made only when a browser is linked to an account (the plan's step 4g;
// src/lib/desk-sync-link.mjs says what links one). It holds no record and
// none of a record's words. What it holds:
//
//   kv    "link"    the link's id, so a state made for another copy of the
//                   notebook is never used
//         "token"   the session (STUDY-DESK-ENCRYPTION.md, "How a request is
//                   carried"); never a cookie, never in local storage
//         "device"  { id, key: { privateKey, public }, sign }: the device's
//                   key pair, and its signing pair, as CryptoKeys whose
//                   private halves can't be read out (the spec's "Where each
//                   client keeps its keys," "The website")
//         "meta"    the loop's own state: the cursor, the sealed keyring as
//                   the service holds it, the highest key accepted, and when
//                   everything was last in step
//         "told"    { state, at }: the stop the reader was last told of
//                   ("signedOut", say) and when, so the next page doesn't say
//                   it again (./stopped-notice.js)
//   rows  one entry for each row, by record id (src/lib/desk-sync.mjs)
//   held  rows kept until they can be read or their time comes
//
// The loop writes "meta", `rows`, and `held` together, in one transaction
// (`write`), and nothing else writes them. "token" and "device" are written
// by whoever signs the reader in (step 4h) through the connector.

import { SYNC_DB } from "../../../lib/desk-sync-link.mjs";

const VERSION = 1;
const KV = "kv";
const ROWS = "rows";
const HELD = "held";

const request = (r) =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

const committed = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("desk-sync: transaction aborted"));
  });

function open(idb) {
  return new Promise((resolve, reject) => {
    const req = idb.open(SYNC_DB, VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (event.oldVersion < 1) {
        db.createObjectStore(KV);
        db.createObjectStore(ROWS, { keyPath: "id" });
        db.createObjectStore(HELD, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Opens the sync's storage, making it if this browser has none.
 *
 * @param {{ idb?: IDBFactory }} [options]
 */
export async function openSyncDb({ idb = globalThis.indexedDB } = {}) {
  if (!idb) throw new Error("desk-sync: IndexedDB isn't available");
  let db = null;
  const connect = async () => {
    const conn = await open(idb);
    // Another tab deleting the database (signing out) or a newer page upgrading it waits for this one to let go.
    conn.onversionchange = () => {
      conn.close();
      if (db === conn) db = null;
    };
    db = conn;
    return conn;
  };
  await connect();
  const conn = async () => db ?? connect();

  return {
    /** One value from `kv`. */
    async get(key) {
      const tx = (await conn()).transaction(KV, "readonly");
      return request(tx.objectStore(KV).get(key));
    },

    /** Several values from `kv`, read together. */
    async getAll(keys) {
      const tx = (await conn()).transaction(KV, "readonly");
      const store = tx.objectStore(KV);
      const values = await Promise.all(keys.map((key) => request(store.get(key))));
      return Object.fromEntries(keys.map((key, i) => [key, values[i]]));
    },

    /** Writes values to `kv` together. A value of `undefined` removes its key. Never "meta": that is `write`'s. */
    async set(values) {
      const tx = (await conn()).transaction(KV, "readwrite");
      const done = committed(tx);
      const store = tx.objectStore(KV);
      for (const [key, value] of Object.entries(values)) {
        if (key === "meta") throw new Error("desk-sync: the loop's state is written by the loop");
        if (value === undefined) store.delete(key);
        else store.put(value, key);
      }
      await done;
    },

    /** The loop's state, as the engine reads it (src/lib/desk-sync-engine.mjs, `state`). */
    async read() {
      const tx = (await conn()).transaction([KV, ROWS, HELD], "readonly");
      const [meta, rows, held] = await Promise.all([
        request(tx.objectStore(KV).get("meta")),
        request(tx.objectStore(ROWS).getAll()),
        request(tx.objectStore(HELD).getAll()),
      ]);
      return { meta: meta ?? {}, rows, held };
    },

    /** Commits the loop's state: meta, entries, and kept rows, all or none. */
    async write({ meta, rows, held }) {
      const tx = (await conn()).transaction([KV, ROWS, HELD], "readwrite");
      const done = committed(tx);
      try {
        if (meta) tx.objectStore(KV).put(meta, "meta");
        const entries = tx.objectStore(ROWS);
        for (const entry of rows?.put ?? []) entries.put(entry);
        for (const id of rows?.remove ?? []) entries.delete(id);
        const kept = tx.objectStore(HELD);
        for (const hold of held?.put ?? []) kept.put(hold);
        for (const id of held?.remove ?? []) kept.delete(id);
      } catch (err) {
        try {
          tx.abort();
        } catch {
          /* already finished */
        }
        done.catch(() => {});
        throw err;
      }
      await done;
    },

    /** Empties every table: the keys, the session, and the loop's state. The notebook is not touched. */
    async clear() {
      const tx = (await conn()).transaction([KV, ROWS, HELD], "readwrite");
      const done = committed(tx);
      for (const name of [KV, ROWS, HELD]) tx.objectStore(name).clear();
      await done;
    },

    close() {
      db?.close();
      db = null;
    },
  };
}
