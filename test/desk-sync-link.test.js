// test/desk-sync-link.test.js
//
// What says a browser syncs its notebook (src/lib/desk-sync-link.mjs, the
// plan's step 4g): the link, the services a page may talk to, and the look
// the desk's first stage takes at the notebook without creating it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";

import { SERVICES, SYNC_DB, SYNC_META, allowedService, makeLink, peekLinked, readLink } from "../src/lib/desk-sync-link.mjs";

const NOTEBOOK = "6b0b6f0e-2f0f-4c53-9d0a-0a7f1c4f2b11";
const LINK = "0f9d3c52-7a61-4d0e-8a57-3e5b6f1c2d90";
const link = (extra = {}) => ({ ...makeLink({ id: LINK, notebook: NOTEBOOK, service: SERVICES.preview, now: "2026-11-24T12:00:00.000Z" }), ...extra });

/** The notebook's database as desk/store.js makes it, with one meta value. */
function notebookDb(idb, { meta = true, value } = {}) {
  return new Promise((resolve, reject) => {
    const open = idb.open("lit-desk", 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore("records", { keyPath: "id" });
      if (meta) open.result.createObjectStore("meta");
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      if (!meta || value === undefined) {
        db.close();
        resolve();
        return;
      }
      const tx = db.transaction("meta", "readwrite");
      tx.objectStore("meta").put(value, SYNC_META);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => reject(tx.error);
    };
  });
}

test("the names a privacy page and a test can hold the storage to", () => {
  assert.equal(SYNC_META, "sync");
  assert.equal(SYNC_DB, "lit-desk-sync");
});

test("only the three services are ever accepted, and the local one only on a local page", () => {
  assert.equal(allowedService(SERVICES.production, "https://litbible.net"), SERVICES.production);
  assert.equal(allowedService(SERVICES.preview, "https://litbible.net"), SERVICES.preview);
  assert.equal(allowedService(SERVICES.local, "http://localhost:4321"), SERVICES.local);
  assert.equal(allowedService(SERVICES.local, "http://127.0.0.1:4321"), SERVICES.local);
  assert.equal(allowedService(SERVICES.local, "http://[::1]:4321"), SERVICES.local);
  assert.equal(allowedService(SERVICES.local, "https://litbible.net"), null, "the live site never talks to a local service");
  assert.equal(allowedService(SERVICES.local, "https://localhost.example.com"), null);
  assert.equal(allowedService(SERVICES.local, undefined), null);
  for (const other of [
    "https://notebook.litbible.net/",
    "https://notebook.litbible.net.example.com",
    "http://notebook.litbible.net",
    "https://example.com",
    "http://localhost:8788",
    "",
    null,
    undefined,
    {},
  ]) {
    assert.equal(allowedService(other, "http://localhost:4321"), null, String(other));
  }
});

test("a link reads back as it was made, and nothing else reads as a link", () => {
  const made = link();
  assert.deepEqual(readLink(made), made);
  assert.deepEqual(readLink({ ...made, extra: "left out" }), made);
  assert.equal(readLink({ ...made, since: 5 }).since, null);
  for (const bad of [
    null,
    undefined,
    "sync",
    {},
    { ...made, v: 2 },
    { ...made, link: "not-an-id" },
    { ...made, notebook: "" },
    { ...made, service: "https://example.com" },
    { ...made, service: undefined },
  ]) {
    assert.equal(readLink(bad), null, JSON.stringify(bad));
  }
  assert.throws(() => makeLink({ id: LINK, notebook: NOTEBOOK, service: "https://example.com", now: "x" }), /not a link/);
});

test("the look says linked only for a notebook that holds a link", async () => {
  const idb = new IDBFactory();
  await notebookDb(idb, { value: link() });
  assert.equal(await peekLinked({ idb }), true);
});

test("the look says not linked for a notebook without one, or with something else under the name", async () => {
  const none = new IDBFactory();
  await notebookDb(none);
  assert.equal(await peekLinked({ idb: none }), false);

  const other = new IDBFactory();
  await notebookDb(other, { value: { v: 1, link: "x" } });
  assert.equal(await peekLinked({ idb: other }), false);

  const old = new IDBFactory();
  await notebookDb(old, { meta: false });
  assert.equal(await peekLinked({ idb: old }), false, "a database without the meta table");
});

test("the look never creates the notebook", async () => {
  const idb = new IDBFactory();
  assert.equal(await peekLinked({ idb }), false);
  assert.deepEqual(await idb.databases(), [], "no database was left behind");
});

test("the look gives up, as not linked, when the browser doesn't answer", async () => {
  const stuck = { open: () => ({}) };
  assert.equal(await peekLinked({ idb: stuck, timeout: 20 }), false);
  const throws = {
    open() {
      throw new Error("refused");
    },
  };
  assert.equal(await peekLinked({ idb: throws }), false);
});
