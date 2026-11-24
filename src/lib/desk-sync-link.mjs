// src/lib/desk-sync-link.mjs
//
// What says "this browser syncs its notebook," and with which service (the
// plan's step 4g). Pure, and small on purpose: the notebook's store and the
// desk's first stage read it to decide whether to download the connector at
// all, so nothing here may import the connector, the sync rules, or the
// encryption.
//
// THE LINK is one value in the notebook's own meta store (the `meta` table of
// the `lit-desk` database, beside "last backed up"), under SYNC_META:
//
//   { v: 1, link, notebook, service, since }
//
//   link      a random id made when the browser was linked. The sync's own
//             database carries the same id. A sync state whose id differs was
//             made for another copy of the notebook (the browser's data was
//             cleared in part, or a backup of the profile was restored), and
//             is never used.
//   notebook  the account's notebook id, as the service answers it
//   service   the service's origin, one of SERVICES
//   since     when the browser was linked
//
// With no such value the browser isn't linked, the connector is never
// downloaded, and nothing about the notebook leaves the computer. The value
// is in the notebook's database, not beside it, so that a notebook that was
// deleted, or made anew, is not linked: a sync state that outlived its
// notebook would otherwise find every record "missing."
//
// The sync's own state is a second IndexedDB database, SYNC_DB, made only
// when a browser is linked: the device's keys (CryptoKeys that can't be read
// out), the session, the sealed keyring, and one small entry for each row
// (src/lib/desk-sync.mjs). It holds no record in the clear: the only record
// bytes in it are rows this device is keeping until it can read them or their
// time comes, sealed exactly as the service sent them.

/** The key of the link in the notebook's meta store. */
export const SYNC_META = "sync";

/** The sync's own database. */
export const SYNC_DB = "lit-desk-sync";

/** The Web Lock one tab holds while it does the syncing for every tab of the browser. */
export const SYNC_LOCK = "lit-desk-sync";

/** The BroadcastChannel the tabs share the sync's status on. Nothing of the notebook travels on it. */
export const SYNC_CHANNEL = "lit-desk-sync";

/** The event a page sends when it has made a place for the status line (`[data-desk-sync-slot]`). */
export const SLOT_EVENT = "desk:sync-slot";

/**
 * The services a browser may be linked to (STUDY-DESK-ENCRYPTION.md, "How a
 * request is carried"). The local one is `wrangler dev` in
 * workers/notebook-service/, and is accepted only on a page that is itself
 * served from this computer.
 */
export const SERVICES = Object.freeze({
  production: "https://notebook.litbible.net",
  preview: "https://notebook-preview.litbible.net",
  local: "http://localhost:8787",
});

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * The service's origin if a page at `pageOrigin` may sync with it, else
 * null. Only the three origins above are ever accepted, whatever a caller
 * hands in: a link is read back from storage, and a stored address must
 * never be able to send a session to another host.
 */
export function allowedService(service, pageOrigin) {
  if (typeof service !== "string") return null;
  if (service === SERVICES.production || service === SERVICES.preview) return service;
  if (service !== SERVICES.local) return null;
  try {
    return LOCAL_HOSTS.has(new URL(pageOrigin).hostname) ? service : null;
  } catch {
    return null;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A new link. `id` is a random UUID (crypto.randomUUID()), `now` this device's time. */
export function makeLink({ id, notebook, service, now }) {
  const link = { v: 1, link: id, notebook, service, since: now };
  if (!readLink(link)) throw new Error("desk-sync: not a link");
  return link;
}

/** A stored link if it is one this code reads, else null. */
export function readLink(value) {
  if (!value || typeof value !== "object" || value.v !== 1) return null;
  if (typeof value.link !== "string" || !UUID.test(value.link)) return null;
  if (typeof value.notebook !== "string" || !UUID.test(value.notebook)) return null;
  if (!Object.values(SERVICES).includes(value.service)) return null;
  return { v: 1, link: value.link, notebook: value.notebook, service: value.service, since: typeof value.since === "string" ? value.since : null };
}

/**
 * Whether the browser is linked, read without the store and without creating
 * the notebook's database (as the first stage's other looks are,
 * src/lib/desk-first-stage.mjs). Resolves true or false; false when it can't
 * tell, since a page that can't read the notebook has nothing to sync.
 *
 * @param {{ idb: IDBFactory, timeout?: number }} options
 */
export function peekLinked({ idb, timeout = 3000 }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (answer, db = null) => {
      try {
        db?.close();
      } catch {
        /* already closed */
      }
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(answer);
    };
    const timer = setTimeout(() => finish(false), timeout);
    let open;
    try {
      open = idb.open("lit-desk");
    } catch {
      finish(false);
      return;
    }
    // No notebook yet: creating one here would leave an empty database without the store's tables.
    open.onupgradeneeded = () => open.transaction.abort();
    open.onerror = (e) => {
      e?.preventDefault?.();
      finish(false);
    };
    open.onsuccess = () => {
      const db = open.result;
      if (done) return finish(false, db);
      try {
        if (!db.objectStoreNames.contains("meta")) return finish(false, db);
        const req = db.transaction("meta", "readonly").objectStore("meta").get(SYNC_META);
        req.onsuccess = () => finish(readLink(req.result) != null, db);
        req.onerror = () => finish(false, db);
      } catch {
        finish(false, db);
      }
    };
  });
}
