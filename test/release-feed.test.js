// test/release-feed.test.js
//
// src/scripts/desk/release-feed.js: the desk's one read of the release notes
// feed. What these guard (BA88): a fetch that fails is forgotten, so the next
// reader tries again instead of being handed a stored null for the rest of the
// page; a success is kept and shared; and a copy kept in sessionStorage is
// keyed by the content version, so a new publish never reads a stale one. It
// is a browser module with module-level state, so each test installs small
// fakes on globalThis and imports a fresh copy of the module.

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

const URL_OF_MODULE = new URL("../src/scripts/desk/release-feed.js", import.meta.url).href;
const GLOBALS = ["document", "sessionStorage", "fetch"];
const ENTRIES = [{ date: "2026-10-26", label: "Oct 26", changes: [] }];

let saved;
let fresh = 0;

function install(name, value) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

/** A page with a content version (or none), a storage, and a fetch that plays `replies` in turn. */
function page({ version, replies, storage = memoryStorage() }) {
  const dataset = version ? { contentVersion: version } : {};
  install("document", { documentElement: { dataset } });
  install("sessionStorage", storage);
  const calls = [];
  install("fetch", async (url) => {
    calls.push(url);
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
    if (reply === "reject") throw new Error("offline");
    return { ok: reply !== "not-ok", json: async () => reply };
  });
  return { calls, storage };
}

/** A fresh copy of the module, so its module-level state starts empty. */
const load = async () => (await import(`${URL_OF_MODULE}?t=${++fresh}`)).loadReleaseNotes;

beforeEach(() => {
  saved = Object.fromEntries(GLOBALS.map((g) => [g, Object.getOwnPropertyDescriptor(globalThis, g)]));
});

afterEach(() => {
  for (const g of GLOBALS) {
    if (saved[g]) Object.defineProperty(globalThis, g, saved[g]);
    else delete globalThis[g];
  }
});

test("a rejected fetch is forgotten: the next call fetches again and gets the entries", async () => {
  const { calls } = page({ replies: ["reject", ENTRIES] });
  const loadReleaseNotes = await load();
  assert.equal(await loadReleaseNotes(), null);
  assert.equal(calls.length, 1);
  assert.deepEqual(await loadReleaseNotes(), ENTRIES);
  assert.equal(calls.length, 2, "the failure was not kept");
});

test("a response that is not ok is forgotten the same way", async () => {
  const { calls } = page({ replies: ["not-ok", ENTRIES] });
  const loadReleaseNotes = await load();
  assert.equal(await loadReleaseNotes(), null);
  assert.deepEqual(await loadReleaseNotes(), ENTRIES);
  assert.equal(calls.length, 2);
});

test("a body that is not a list is forgotten too", async () => {
  const { calls } = page({ replies: [{ error: true }, ENTRIES] });
  const loadReleaseNotes = await load();
  assert.equal(await loadReleaseNotes(), null);
  assert.deepEqual(await loadReleaseNotes(), ENTRIES);
  assert.equal(calls.length, 2);
});

test("a success is kept: later calls fetch nothing and share the result", async () => {
  const { calls } = page({ replies: [ENTRIES] });
  const loadReleaseNotes = await load();
  const first = loadReleaseNotes();
  assert.deepEqual(await first, ENTRIES);
  const second = loadReleaseNotes();
  assert.equal(second, first, "the same promise comes back");
  assert.deepEqual(await second, ENTRIES);
  assert.equal(calls.length, 1);
});

test("calls made while the first fetch is pending share that one fetch", async () => {
  const { calls } = page({ replies: [ENTRIES] });
  const loadReleaseNotes = await load();
  const all = await Promise.all([loadReleaseNotes(), loadReleaseNotes(), loadReleaseNotes()]);
  for (const got of all) assert.deepEqual(got, ENTRIES);
  assert.equal(calls.length, 1);
});

test("with a content version, the entries are kept in sessionStorage and a new page reads them without fetching", async () => {
  const { calls, storage } = page({ version: "v20261026.abc", replies: [ENTRIES] });
  assert.deepEqual(await (await load())(), ENTRIES);
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(storage.getItem("lit-desk-release-feed")), { v: "v20261026.abc", entries: ENTRIES });

  // Another page of the same visit: a fresh module over the same storage.
  const next = page({ version: "v20261026.abc", replies: ["reject"], storage });
  assert.deepEqual(await (await load())(), ENTRIES);
  assert.equal(next.calls.length, 0, "read from the kept copy");
});

test("a kept copy from another content version is not used", async () => {
  const { storage } = page({ version: "v20261025.abc", replies: [ENTRIES] });
  await (await load())();

  const newer = [{ date: "2026-10-27", label: "Oct 27", changes: [] }];
  const next = page({ version: "v20261027.def", replies: [newer], storage });
  assert.deepEqual(await (await load())(), newer);
  assert.equal(next.calls.length, 1);
  assert.equal(JSON.parse(storage.getItem("lit-desk-release-feed")).v, "v20261027.def");
});

test("with no content version, nothing is kept in sessionStorage", async () => {
  const { storage } = page({ replies: [ENTRIES] });
  assert.deepEqual(await (await load())(), ENTRIES);
  assert.equal(storage.getItem("lit-desk-release-feed"), null);
});

test("a storage that throws does not fail the load", async () => {
  const { calls } = page({
    version: "v20261026.abc",
    replies: [ENTRIES],
    storage: {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    },
  });
  assert.deepEqual(await (await load())(), ENTRIES);
  assert.equal(calls.length, 1);
});
