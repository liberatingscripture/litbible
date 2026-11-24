// test/desk-sync-engine.test.js
//
// The sync loop (src/lib/desk-sync-engine.mjs) against a stand-in service
// that answers as the real one does (test/helpers/fake-notebook-service.mjs):
// every state a pass can end in, every answer the service gives for a row,
// the queue across a reload and a half-finished push, the first sign-in's
// merge, and a change of key. Devices here are real in everything but
// storage: real keys, real sealed rows, the format's own merge.

import { test } from "node:test";
import assert from "node:assert/strict";

import * as ref from "../src/lib/desk-crypto.mjs";
import { Offline } from "../src/lib/desk-sync-engine.mjs";
import { createFakeService, changeKey, join } from "./helpers/fake-notebook-service.mjs";
import { firstDevice, memoryNotebook, memoryState, nextDevice, rig, settleAll, testClock } from "./helpers/sync-rig.mjs";

const rowsOf = (service, device) => service.account(device.by.account).rows;
const posts = (service) => service.calls.filter((c) => c.method === "POST" && c.path === "/rows");

/** Every row the service holds for a device's account, opened with that device's keyring, sorted by id. */
async function served(service, device) {
  const out = [];
  for (const row of rowsOf(service, device).values()) out.push((await ref.openRow({ row, keyring: device.engine.keyring() })).record);
  return out.sort((a, b) => (a.id < b.id ? -1 : 1));
}

/* ── The loop ────────────────────────────────────────────────────────── */

test("a note written on one device reaches the service sealed, and another device", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  const note = a.note("For God so loved the world");

  const status = await a.sync();
  assert.equal(status.state, "upToDate");
  assert.equal(status.pending, 0);
  const row = rowsOf(service, a).get(note.id);
  assert.equal(row.modified, note.modified);
  assert.equal(row.kid, 1);
  assert.ok(!JSON.stringify(row).includes("so loved"), "nothing of the note is readable on the service");

  await b.sync();
  assert.deepEqual(await b.notebook.get(note.id), note);
  // Nothing is owed by the device that only received it.
  const before = posts(service).length;
  await b.sync();
  await a.sync();
  assert.equal(posts(service).length, before);
});

test("an edit, a deletion, and a restore each travel, and the service keeps one row for each record", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  const note = a.note("first words");
  await settleAll(service, [a, b]);

  a.clock.tick();
  await a.edit(note.id, { body: "second words" });
  await settleAll(service, [a, b]);
  assert.equal((await b.notebook.get(note.id)).body, "second words");

  b.clock.at = a.clock.at + 5000;
  const trash = await b.remove(note.id);
  await settleAll(service, [a, b]);
  assert.equal(await a.notebook.get(note.id), undefined);
  assert.equal((await a.notebook.get(trash.id)).deletedId, note.id);
  assert.deepEqual([...rowsOf(service, a).keys()], [trash.id], "the deleted record's row left the service, and its trash record's stays");

  a.clock.at = b.clock.at + 5000;
  await a.restore(trash.id);
  await settleAll(service, [a, b]);
  assert.equal((await b.notebook.get(note.id)).body, "second words");
  assert.equal(await b.notebook.get(trash.id), undefined);
  assert.deepEqual([...rowsOf(service, a).keys()], [note.id]);
  assert.deepEqual(a.notebook.snapshot(), b.notebook.snapshot());
  assert.deepEqual(await served(service, a), a.notebook.snapshot());
});
