// src/scripts/desk/readonly-notebook.js
//
// Reading the notebook without being the desk: the pages that only need to
// look at it (the search tray and /search, /release-notes' filter) open its
// IndexedDB database read-only and never create it. store.js owns the
// database's creation and upgrades, and a reader who has written nothing yet
// has none, so a look must not make one. A page that also runs the shell has
// the database open already, and the two simply share it.

import { migrateRecord } from "../../lib/desk-records.mjs";

const DB_NAME = "lit-desk";
const RECORDS = "records";

let connection = null;

/**
 * The notebook's database if it exists, or null. Opening without a version
 * and aborting the upgrade that fires when there is nothing to open is how
 * "open it if it's there" is asked of IndexedDB without creating it.
 */
function openExisting() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    let request;
    try {
      request = indexedDB.open(DB_NAME);
    } catch (_) {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => request.transaction.abort();
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RECORDS)) {
        db.close();
        resolve(null);
        return;
      }
      // A newer site opening the database in another tab waits for this one.
      db.onversionchange = () => {
        db.close();
        connection = null;
      };
      resolve(db);
    };
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

/** Every record in the notebook (trash included), or none if there is no notebook. */
export async function readRecords() {
  connection ||= await openExisting();
  if (!connection) return [];
  try {
    const tx = connection.transaction(RECORDS, "readonly");
    return await new Promise((resolve, reject) => {
      const all = tx.objectStore(RECORDS).getAll();
      // As store.js reads them: a renamed note marker by its new name (E10).
      all.onsuccess = () => resolve((all.result ?? []).map(migrateRecord));
      all.onerror = () => reject(all.error);
    });
  } catch (_) {
    // A connection closed by a version change, or a browser that refuses.
    connection = null;
    return [];
  }
}
