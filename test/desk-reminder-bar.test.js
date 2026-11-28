// test/desk-reminder-bar.test.js
//
// What is left of src/scripts/desk/reminder.js after Featherboa's Phase 5 took
// the backup reminder's bar away: the facts the Notebook's foot line reads from
// the store (first-use.js draws the line; test/desk-first-use-dom.test.js).
// The bar's choices, its put-offs and its dots are gone, and no test here
// drives them.

import { test } from "node:test";
import assert from "node:assert/strict";

const { factsFromStore } = await import("../src/scripts/desk/reminder.js");

test("UX9b-2: the facts from a store say whether the browser syncs", async () => {
  const { SYNC_META, SERVICES, makeLink } = await import("../src/lib/desk-sync-link.mjs");
  const link = makeLink({ id: "0b7c3a52-5d0e-4c55-9d7a-1a2b3c4d5e6f", notebook: "6a1d2e3f-4b5c-4d6e-8f70-112233445566", service: SERVICES.preview, now: "2026-11-24T12:00:00.000Z" });
  const store = (meta) => ({ all: async () => [], getMeta: async (key) => meta[key] });
  assert.equal((await factsFromStore(store({ [SYNC_META]: link }))).linked, true);
  assert.equal((await factsFromStore(store({}))).linked, false);
});

test("the facts: whether the notebook holds anything, its oldest live record, and the last backup", async () => {
  const records = [
    { kind: "note", created: "2026-11-05T00:00:00.000Z" },
    { kind: "highlight", created: "2026-10-01T00:00:00.000Z" },
    // A record in the trash is not live: it neither counts nor sets the oldest.
    { kind: "trash", created: "2026-01-01T00:00:00.000Z" },
    null,
  ];
  const store = { all: async () => records, getMeta: async (key) => (key === "lastExport" ? { at: "2026-11-10T00:00:00.000Z" } : undefined) };
  assert.deepEqual(await factsFromStore(store), {
    lastExport: "2026-11-10T00:00:00.000Z",
    hasRecords: true,
    oldest: "2026-10-01T00:00:00.000Z",
    linked: false,
  });
  const empty = await factsFromStore({ all: async () => [{ kind: "trash", created: "2026-01-01T00:00:00.000Z" }], getMeta: async () => undefined });
  assert.deepEqual(empty, { lastExport: null, hasRecords: false, oldest: null, linked: false });
  // A stray stored shape reads as never backed up.
  assert.equal((await factsFromStore({ all: async () => [], getMeta: async () => "yesterday" })).lastExport, null);
});

test("a store that cannot be read gives no facts, rather than breaking the line", async () => {
  assert.equal(await factsFromStore({ all: async () => { throw new Error("gone"); } }), null);
});
