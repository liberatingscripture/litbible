// test/desk-sync-engine.test.js
//
// The sync loop (src/lib/desk-sync-engine.mjs) against a stand-in service
// that answers as the real one does (test/helpers/fake-notebook-service.mjs):
// every state a pass can end in, every answer the service gives for a row,
// the queue across a reload and a half-finished push, the first sign-in's
// merge, and a change of key. Devices here are real in everything but
// storage: real keys, real sealed rows, the format's own merge. Clocks,
// rows that can't be read, and the checks against a service that lost rows
// are test/desk-sync-engine-edges.test.js.

import { test } from "node:test";
import assert from "node:assert/strict";

import * as ref from "../src/lib/desk-crypto.mjs";
import { createFakeService, changeKey, join } from "./helpers/fake-notebook-service.mjs";
import { firstDevice, memoryNotebook, nextDevice, rig, settleAll, testClock } from "./helpers/sync-rig.mjs";

const rowsOf = (service, device) => service.account(device.by.account).rows;
const posts = (service, device) =>
  service.calls.filter((c) => c.method === "POST" && c.path === "/rows" && (!device || c.token === device.by.token));
const isPost = (call, device) => call.method === "POST" && call.path === "/rows" && call.token === device.by.token;

/** Every row the service holds for a device's account, opened with that device's keyring, sorted by id. */
async function served(service, device) {
  const out = [];
  for (const row of rowsOf(service, device).values()) out.push((await ref.openRow({ row, keyring: device.engine.keyring() })).record);
  return out.sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** A record of a kind this client doesn't know, as large as a test asks. */
const future = (device, id, chars) => ({
  id,
  kind: "futureKind",
  schema: 1,
  created: device.clock.now(),
  modified: device.clock.now(),
  client: "test",
  contentVersion: "2026.11.24",
  labels: [],
  blob: "x".repeat(chars),
});

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

/* ── Every state a pass can end in ───────────────────────────────────── */

test("offline: edits wait, survive a reload, and go up oldest first when the service is back", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  await a.sync();
  service.offline();
  const first = a.note("written offline, first");
  a.clock.tick();
  const second = a.note("written offline, second");
  a.clock.tick();
  await a.edit(first.id, { body: "the first, edited after the second was written" });

  const status = await a.sync();
  assert.equal(status.state, "offline");
  assert.equal(status.pending, 2, "the reader is told how much is waiting");
  assert.equal(rowsOf(service, a).size, 0);

  // The page closes and opens again while still offline. Nothing in memory carried the queue.
  a.reload();
  const again = await a.sync();
  assert.equal(again.state, "offline");
  assert.equal(again.pending, 2);

  service.online();
  const back = await a.sync();
  assert.equal(back.state, "upToDate");
  assert.equal(back.pending, 0);
  const sent = posts(service).at(-1).body.put.map((row) => row.id);
  assert.deepEqual(sent, [second.id, first.id], "the order the records were last written, oldest first");
  assert.deepEqual(await served(service, a), a.notebook.snapshot());
});

test("a change made while offline is counted without a request being made", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  await a.sync();
  service.offline();
  assert.equal((await a.sync()).pending, 0);
  const calls = service.calls.length;
  a.note();
  a.note();
  const status = await a.engine.tally();
  assert.equal(status.state, "offline");
  assert.equal(status.pending, 2);
  assert.equal(service.calls.length, calls);
});

test("signed out by the service: nothing here is removed, and a new session sends what waited", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  a.note("before");
  await a.sync();
  service.endSession(a.by.token);
  const waiting = a.note("written after the session ended");

  const status = await a.sync();
  assert.equal(status.state, "signedOut");
  assert.equal(status.pending, 1);
  assert.equal((await a.notebook.all()).length, 2, "the notebook is whole");
  assert.ok(a.state.kept.meta.sealed, "the keyring is kept");
  assert.equal(rowsOf(service, a).has(waiting.id), false);

  // The reader signs in again (the account pages' work): a new session, the same device and keys.
  a.by.token = service.signIn(a.by.account);
  a.engine.resume();
  assert.equal((await a.sync()).state, "upToDate");
  assert.ok(rowsOf(service, a).has(waiting.id));
});

test("slowed by the limiter: the pass stops and says how long to wait", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  a.note();
  service.slowDown(1);
  const status = await a.sync();
  assert.equal(status.state, "slowed");
  assert.equal(status.retry, 60);
  assert.equal(status.pending, 1);
  assert.equal(service.calls.length, 1, "one request was refused, and nothing was sent after it");
  assert.equal((await a.sync()).state, "upToDate");
});

test("the service asks to be sent a request again (busy): it is, without the reader hearing of it", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  a.note();
  service.busy(2);
  assert.equal((await a.sync()).state, "upToDate");
  assert.ok(!a.statuses.some((s) => s.state === "error"));
  service.busy(5);
  a.note();
  const status = await a.sync();
  assert.equal(status.state, "error");
  assert.equal(status.reason, "busy");
});

test("the service fails: the pass ends in an error, and the next one sends what waited", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const note = a.note();
  service.fail(1);
  const status = await a.sync();
  assert.equal(status.state, "error");
  assert.equal(status.reason, "error");
  assert.equal(a.engine.failures(), 1);
  assert.equal((await a.sync()).state, "upToDate");
  assert.equal(a.engine.failures(), 0);
  assert.ok(rowsOf(service, a).has(note.id));
});

test("removed by a change of key: the device stops, says so, and keeps its notebook, its keys, and its queue", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  a.note("shared");
  await settleAll(service, [a, b]);
  const unsent = b.note("written on the device that is about to be removed");

  await changeKey(service, a.by, { kept: [a.by], removed: [b.by] });
  await a.engine.adopt(a.by.keyring);
  // Removing a device ends its sessions. Before it signs in again it is only signed out.
  assert.equal((await b.sync()).state, "signedOut");
  // It signs in again and finds no keyring for itself.
  b.by.token = service.signIn(b.by.account);
  b.engine.resume();
  const status = await b.sync();
  assert.equal(status.state, "removed");
  assert.equal(status.pending, 1);
  assert.equal((await b.notebook.all()).length, 2);
  assert.ok(b.state.kept.meta.sealed);
  assert.equal(b.engine.keyring().current, 1, "it keeps the keys it had");
  assert.equal(rowsOf(service, a).has(unsent.id), false);
});

test("the account's notebook was replaced: the device never joins the new one by itself", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  a.note();
  await a.sync();
  service.replaceNotebook(a.by.account);
  const status = await a.sync();
  assert.equal(status.state, "otherNotebook");
  assert.equal(status.notebook, null);
  assert.equal(status.replaced.platform, "web");
  assert.equal((await a.notebook.all()).length, 1);
  assert.equal(posts(service).length, 1, "nothing was pushed to it");
});

test("a keyring from the service that doesn't prove itself is reported and never used", async () => {
  for (const [name, forge, why] of [
    ["another notebook's", () => ref.firstKeyring(ref.newId(), ref.randomBytes(32)), "notebook"],
    ["one with other bytes for a key the device holds", (held) => ({ ...held, keys: [{ kid: 1, key: ref.randomBytes(32) }] }), "keyChanged"],
  ]) {
    const service = createFakeService();
    const a = await firstDevice(service);
    const b = await nextDevice(service, a);
    await settleAll(service, [a, b]);
    // The service swaps B's sealed keyring for one it made up, and B's session is a new one.
    const forged = await ref.sealKeyring({ keyring: forge(b.by.keyring), recipientPublic: b.by.key.public });
    const account = service.account(b.by.account);
    account.devices.get(b.by.id).keyring = { kid: 1, enc: ref.toBase64url(forged.enc), ct: ref.toBase64url(forged.ct) };
    b.by.token = service.signIn(b.by.account);
    b.engine.resume();
    const status = await b.sync();
    assert.equal(status.state, "cantOpen", name);
    assert.equal(status.why, why, name);
    assert.deepEqual(b.engine.keyring(), b.by.keyring, "the keyring it held is the one it still holds");
    assert.equal(service.calls.filter((c) => c.path === "/session/proof").length, 0, "and it proved nothing with the other");
  }
});

test("a keyring that goes backward after a change of key is refused", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  await settleAll(service, [a, b]);
  const old = service.account(a.by.account).devices.get(b.by.id).keyring;
  await changeKey(service, a.by, { kept: [a.by, b.by] });
  await a.engine.adopt(a.by.keyring);
  assert.equal((await b.sync()).state, "upToDate");
  assert.equal(b.engine.keyring().current, 2);
  // Later the service hands B the keyring from before the change. A reload forgets nothing: the
  // highest key the device accepted is written down.
  service.account(a.by.account).devices.get(b.by.id).keyring = old;
  b.by.token = service.signIn(b.by.account);
  b.reload();
  const status = await b.sync();
  assert.equal(status.state, "cantOpen");
  assert.equal(status.why, "backward");
  assert.equal(b.engine.keyring().current, 2);
});

test("a wrong proof is sent once, never again in a loop", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  await a.sync();
  // The service's stored hash is for some other key.
  service.account(a.by.account).proofHash = ref.toBase64url(ref.randomBytes(32));
  a.by.token = service.signIn(a.by.account);
  a.engine.resume();
  const status = await a.sync();
  assert.equal(status.state, "cantOpen");
  assert.equal(status.reason, "proof");
  assert.equal(service.calls.filter((c) => c.path === "/session/proof").length, 1);
});

/* ── Every answer for a row ──────────────────────────────────────────── */

test("refused: a row the service won't take stays here, the rows beside it are stored, and it is not sent again until it changes", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const note = a.note("deleted, with a time the service won't take");
  const beside = a.note("an ordinary note");
  await a.sync();
  a.clock.tick();
  const trash = await a.remove(note.id);
  // A trash record's times need only parse (the format); the service asks the Z form (the spec's "Still open," 31).
  a.notebook.write({ put: [{ ...trash, deletedAt: trash.deletedAt.replace("Z", "+00:00") }] });
  a.clock.tick();
  await a.edit(beside.id, { body: "edited in the same push" });

  const status = await a.sync();
  assert.equal(status.state, "upToDate");
  assert.equal(status.problems.stuck, 1);
  assert.equal(status.pending, 0);
  const rows = rowsOf(service, a);
  assert.equal(rows.has(trash.id), false, "the refused row was not stored");
  assert.ok(rows.has(note.id), "and the row it would have replaced was not removed without it");
  assert.equal((await ref.openRow({ row: rows.get(beside.id), keyring: a.engine.keyring() })).record.body, "edited in the same push");
  assert.equal(a.state.kept.rows.get(trash.id).stuck.why, "refused:deletedAt");

  const before = posts(service).length;
  await a.sync();
  a.reload();
  await a.sync();
  assert.equal(posts(service).length, before, "nothing is sent again while it is unchanged, across a reload too");

  // The record changes to one the service takes.
  a.notebook.write({ put: [trash] });
  assert.equal((await a.sync()).problems.stuck, 0);
  assert.deepEqual([...rowsOf(service, a).keys()].sort(), [beside.id, trash.id].sort());
});

test("conflict, changed: another device's push landed first, and the later writing wins on both", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  const note = a.note("the first words");
  await settleAll(service, [a, b]);

  a.clock.tick(1000);
  await a.edit(note.id, { body: "A's edit, made first" });
  b.clock.at = a.clock.at + 2000;
  await b.edit(note.id, { body: "B's edit, made later" });
  // A's push arrives between B's pull and B's push.
  let raced = false;
  service.onCall = async (call) => {
    if (raced || !isPost(call, b)) return;
    raced = true;
    await a.sync();
  };
  await b.sync();
  service.onCall = null;
  assert.ok(raced);
  await settleAll(service, [a, b]);
  assert.equal((await a.notebook.get(note.id)).body, "B's edit, made later");
  assert.deepEqual(a.notebook.snapshot(), b.notebook.snapshot());
  assert.deepEqual(await served(service, a), a.notebook.snapshot());
});

test("conflict, changed, the other way: the row that landed first is the later writing, and this device takes it", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  const note = a.note("the first words");
  await settleAll(service, [a, b]);
  a.clock.tick(5000);
  await a.edit(note.id, { body: "A's edit, the later" });
  b.clock.at = a.clock.at - 2000;
  await b.edit(note.id, { body: "B's edit, the earlier" });
  let raced = false;
  service.onCall = async (call) => {
    if (raced || !isPost(call, b)) return;
    raced = true;
    await a.sync();
  };
  const status = await b.sync();
  service.onCall = null;
  assert.equal(status.state, "upToDate");
  assert.equal((await b.notebook.get(note.id)).body, "A's edit, the later");
  assert.equal(posts(service, b).length, 1, "B's losing copy was sent once and not again");
  assert.deepEqual(await served(service, a), a.notebook.snapshot());
});

test("conflict, changed, without the row: the device pulls it and merges", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  const note = a.note("the first words");
  await settleAll(service, [a, b]);
  a.clock.tick(1000);
  await a.edit(note.id, { body: "A's edit" });
  b.clock.at = a.clock.at - 500;
  await b.edit(note.id, { body: "B's edit, the earlier" });
  service.withoutConflictRows = true;
  let raced = false;
  service.onCall = async (call) => {
    if (raced || !isPost(call, b)) return;
    raced = true;
    await a.sync();
  };
  await b.sync();
  service.onCall = null;
  assert.ok(raced);
  await settleAll(service, [a, b]);
  assert.equal((await b.notebook.get(note.id)).body, "A's edit");
  assert.deepEqual(a.notebook.snapshot(), b.notebook.snapshot());
});

test("conflict, gone: a record deleted elsewhere and edited here later lives, and is pushed as new", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  const note = a.note("the first words");
  await settleAll(service, [a, b]);

  // B deletes it and syncs. A, which hasn't heard, edits it afterward: the edit is the later action.
  b.clock.tick(1000);
  const trash = await b.remove(note.id);
  await b.sync();
  assert.deepEqual([...rowsOf(service, a).keys()], [trash.id]);
  a.clock.at = b.clock.at + 5000;
  await a.edit(note.id, { body: "edited after it was deleted elsewhere" });

  await settleAll(service, [a, b]);
  assert.equal((await b.notebook.get(note.id)).body, "edited after it was deleted elsewhere");
  assert.equal(await b.notebook.get(trash.id), undefined);
  assert.deepEqual([...rowsOf(service, a).keys()], [note.id], "the record's row is back, and the deletion's is gone");
  assert.deepEqual(a.notebook.snapshot(), b.notebook.snapshot());
});

test("a deletion that loses to a record already synced: the record is pushed again", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  const c = await nextDevice(service, a);
  const note = a.note("the first words");
  await settleAll(service, [a, b, c]);

  a.clock.tick(60_000);
  await a.edit(note.id, { body: "edited, and synced" });
  await a.sync();
  // Another client, whose rules let an earlier deletion through, puts its trash record and removes
  // the record's row. (This client's own loop never does: it would have met a conflict.) B's hands
  // make the trash record; its clock is a minute behind A's edit.
  const trash = await b.remove(note.id);
  const sealed = await ref.sealRecord({ record: trash, notebookKey: ref.keyOf(b.by.keyring, 1), kid: 1 });
  const account = service.account(a.by.account);
  account.rows.delete(note.id);
  account.rev += 2;
  account.rows.set(trash.id, { ...sealed, rev: account.rev });

  await settleAll(service, [a, c]);
  assert.equal((await c.notebook.get(note.id)).body, "edited, and synced");
  assert.ok(rowsOf(service, a).has(note.id), "the row the other client removed is back");
  assert.equal(rowsOf(service, a).has(trash.id), false, "and the deletion that lost is gone from the service");
  assert.deepEqual(await served(service, a), a.notebook.snapshot());
  assert.deepEqual(a.notebook.snapshot(), c.notebook.snapshot());
});

test("a removal that meets a conflict: the record was edited elsewhere after it was deleted here", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  const note = a.note("the first words");
  await settleAll(service, [a, b]);
  b.clock.tick(1000);
  const trash = await b.remove(note.id);
  a.clock.at = b.clock.at + 3000;
  await a.edit(note.id, { body: "A's later edit" });
  // A's edit lands after B has put its trash record, and before B removes the record's row.
  let raced = false;
  service.onCall = async (call) => {
    if (raced || !isPost(call, b) || !call.body.remove?.length) return;
    raced = true;
    await a.sync();
  };
  await b.sync();
  service.onCall = null;
  assert.ok(raced);
  await settleAll(service, [a, b]);
  assert.equal((await b.notebook.get(note.id)).body, "A's later edit");
  assert.equal(await a.notebook.get(trash.id), undefined);
  assert.deepEqual(a.notebook.snapshot(), b.notebook.snapshot());
  assert.deepEqual(await served(service, a), a.notebook.snapshot());
});

/* ── The queue ───────────────────────────────────────────────────────── */

test("a push whose answer is lost: the rows are not sent twice, and nothing is lost", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const notes = [a.note("one"), a.note("two"), a.note("three")];
  service.loseAnswer(1, (call) => call.method === "POST" && call.path === "/rows");
  assert.equal((await a.sync()).state, "offline");
  assert.equal(rowsOf(service, a).size, 3, "the service stored them");
  assert.equal(a.state.kept.rows.size, 0, "and the device never heard");

  const status = await a.sync();
  assert.equal(status.state, "upToDate");
  assert.equal(posts(service).length, 1, "the pull brought its own rows back, so nothing was pushed again");
  for (const note of notes) assert.equal(a.state.kept.rows.get(note.id).rev, rowsOf(service, a).get(note.id).rev);
});

test("a push that half succeeds: the half that was stored is not sent again, and the other half is", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  for (let i = 0; i < 700; i++) a.note(`note ${i}`);
  // The first request of 500 is answered. The second never reaches the service.
  let seen = 0;
  service.onCall = (call) => {
    if (isPost(call, a) && ++seen === 2) service.offline();
  };
  const status = await a.sync();
  service.onCall = null;
  assert.equal(status.state, "offline");
  assert.equal(status.pending, 200);
  assert.equal(rowsOf(service, a).size, 500);

  a.reload();
  service.online();
  assert.equal((await a.sync()).state, "upToDate");
  assert.equal(rowsOf(service, a).size, 700);
  assert.deepEqual(
    posts(service).map((c) => c.body.put.length),
    [500, 200, 200],
    "the second request, sent again whole, and nothing of the first",
  );
});

test("a merge whose state was never written: the rows are pulled again and change nothing", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  a.note("one");
  a.note("two");
  await a.sync();
  // B's notebook takes the merge, and the write of the sync's own state fails (the page closed).
  const write = b.state.write.bind(b.state);
  let failed = false;
  b.state.write = async (changes) => {
    if (!failed && changes.rows?.put?.length) {
      failed = true;
      throw new Error("the page closed");
    }
    return write(changes);
  };
  assert.equal((await b.sync()).state, "error");
  assert.equal((await b.notebook.all()).length, 2);
  assert.equal(b.state.kept.rows.size, 0);
  // With or without a reload, the next pass starts from what was written.
  assert.equal((await b.sync()).state, "upToDate");
  assert.equal(b.state.kept.rows.size, 2);
  assert.equal(posts(service, b).length, 0, "B pushed nothing");
  assert.deepEqual(a.notebook.snapshot(), b.notebook.snapshot());
});

test("more rows than one request takes go up in several, each within the service's limits", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  for (let i = 0; i < 1203; i++) a.note(`note ${i}`);
  assert.equal((await a.sync()).state, "upToDate");
  assert.deepEqual(
    posts(service).map((c) => c.body.put.length),
    [500, 500, 203],
  );
  assert.equal(rowsOf(service, a).size, 1203);

  const b = await nextDevice(service, a);
  assert.equal((await b.sync()).state, "upToDate");
  assert.equal((await b.notebook.all()).length, 1203);
  assert.equal(service.calls.filter((c) => c.method === "GET" && c.path.startsWith("/rows?since") && c.token === b.by.token).length, 3, "three pages");
  assert.equal(posts(service, b).length, 0);
});

test("large records are batched by size: no request passes the body's limit", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  // A kind this client doesn't know may be any size up to the format's ceiling.
  for (let i = 0; i < 6; i++) a.notebook.write({ put: [future(a, `big-${i}`, 900_000)] });
  assert.equal((await a.sync()).state, "upToDate");
  assert.deepEqual(
    posts(service).map((c) => c.body.put.length),
    [3, 3],
  );
  assert.equal(rowsOf(service, a).size, 6);

  const b = await nextDevice(service, a);
  await b.sync();
  assert.deepEqual(b.notebook.snapshot(), a.notebook.snapshot(), "a record of an unknown kind arrives as it was written");
});

test("a record too large to seal stays here and is reported, and the rest go up", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  a.notebook.write({ put: [future(a, "too-big", 1_100_000)] });
  const note = a.note();
  const status = await a.sync();
  assert.equal(status.state, "upToDate");
  assert.equal(status.problems.stuck, 1);
  assert.deepEqual([...rowsOf(service, a).keys()], [note.id]);
  assert.equal(a.state.kept.rows.get("too-big").stuck.why, "seal:recordSize");
  const before = service.calls.length;
  await a.sync();
  assert.equal(posts(service).length, 1, "and it is not tried again as it is");
  assert.ok(service.calls.length > before);
});

/* ── The first sign-in ───────────────────────────────────────────────── */

test("the first sign-in merges this browser's notebook into the account's, and the account's into it", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const shared = a.note("in both, older on the account");
  const onlyThere = a.note("only on the account");
  const deletedThere = a.note("deleted on the account");
  await a.sync();
  a.clock.tick(1000);
  const trash = await a.remove(deletedThere.id);
  await a.sync();

  // A browser that kept a notebook of its own before it ever signed in: one record it shares with the
  // account (from a backup, say) and has edited since, one of its own, and a stale copy of the deleted one.
  const notebook = memoryNotebook();
  const clock = testClock("2026-11-24T13:00:00.000Z");
  notebook.write({ put: [{ ...shared, body: "in both, newer in this browser", modified: "2026-11-24T12:30:00.000Z" }, deletedThere] });
  const b = await rig(service, await join(service, a.by), { notebook, clock });
  const onlyHere = b.note("only in this browser");
  a.clock.at = clock.at;

  const first = await b.sync();
  assert.equal(first.state, "upToDate");
  assert.equal(
    b.statuses.findIndex((s) => s.state === "upToDate"),
    b.statuses.length - 1,
    "it says it is up to date once, at the end",
  );
  await settleAll(service, [b, a]);
  const bodies = (await a.live()).map((r) => r.body).sort();
  assert.deepEqual(bodies, ["in both, newer in this browser", "only in this browser", "only on the account"]);
  assert.equal(await b.notebook.get(deletedThere.id), undefined, "the account's deletion stands over the browser's stale copy");
  assert.ok(await b.notebook.get(trash.id));
  assert.ok(await a.notebook.get(onlyHere.id));
  assert.ok(await b.notebook.get(onlyThere.id));
  assert.deepEqual(a.notebook.snapshot(), b.notebook.snapshot());
  assert.deepEqual(await served(service, a), a.notebook.snapshot());
});

test("the first sign-in of a browser with a notebook, into an account with none yet: everything goes up", async () => {
  const service = createFakeService();
  const notebook = memoryNotebook();
  const local = await firstDevice(service, "new-account", { notebook });
  const written = [local.note("kept here for months"), local.note("and another")];
  const trash = await local.remove(written[1].id);
  assert.equal((await local.sync()).state, "upToDate");
  assert.deepEqual([...rowsOf(service, local).keys()].sort(), [written[0].id, trash.id].sort());
  assert.deepEqual(await served(service, local), local.notebook.snapshot());
});

/* ── A change of key ─────────────────────────────────────────────────── */

test("a change of key: the device that made it reseals every row, and the others take the new key and go on", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  for (let i = 0; i < 5; i++) a.note(`note ${i}`);
  await settleAll(service, [a, b]);
  const before = a.notebook.snapshot();
  const queued = b.note("written on B before it heard of the new key");

  await changeKey(service, a.by, { kept: [a.by, b.by] });
  await a.engine.adopt(a.by.keyring);
  assert.equal((await a.sync()).state, "upToDate");
  assert.ok([...rowsOf(service, a).values()].every((row) => row.kid === 2), "every row is under the new key");
  assert.deepEqual(await served(service, a), before, "and nothing in a record changed");
  assert.deepEqual(a.notebook.snapshot(), before);

  // B's session closed with the change. It is told, fetches its keyring, checks it, proves, and goes on.
  const status = await b.sync();
  assert.equal(status.state, "upToDate");
  assert.equal(b.engine.keyring().current, 2);
  assert.equal(b.state.kept.meta.highest, 2);
  assert.equal(rowsOf(service, a).get(queued.id).kid, 2, "what it had queued went up under the new key");
  await settleAll(service, [a, b]);
  assert.deepEqual(a.notebook.snapshot(), b.notebook.snapshot());
  assert.equal(a.notebook.snapshot().length, 6);
  assert.equal(posts(service, b).length, 1, "B sent its one note, and resealed nothing A had done");
});

test("the key changes between a device's pull and its push: it takes the new key in the same pass and sends again", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  await settleAll(service, [a, b]);
  const note = b.note("pushed just as the key changes");
  let changed = false;
  service.onCall = async (call) => {
    if (changed || !isPost(call, b)) return;
    changed = true;
    await changeKey(service, a.by, { kept: [a.by, b.by] });
  };
  const status = await b.sync();
  service.onCall = null;
  assert.ok(changed);
  assert.equal(status.state, "upToDate");
  assert.equal(rowsOf(service, a).get(note.id).kid, 2);
  assert.equal(b.engine.keyring().current, 2);
});

test("a push refused for an old key (old_key): the session that changed the key, mid-push", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  a.note("before");
  await a.sync();
  const note = a.note("pushed just as this same session changes the key");
  // The account pages change the key from this session while a pass is between its pull and its push.
  let changed = false;
  service.onCall = async (call) => {
    if (changed || !isPost(call, a)) return;
    changed = true;
    await changeKey(service, a.by, { kept: [a.by] });
  };
  const status = await a.sync();
  service.onCall = null;
  assert.ok(changed);
  assert.equal(status.state, "upToDate");
  assert.equal(a.engine.keyring().current, 2);
  assert.equal(rowsOf(service, a).get(note.id).kid, 2);
  assert.ok([...rowsOf(service, a).values()].every((row) => row.kid === 2), "and the older rows were sealed again");
});

test("resealing is finished by any device with the new keyring when the first stops partway", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  for (let i = 0; i < 6; i++) a.note(`note ${i}`);
  await settleAll(service, [a, b]);
  await changeKey(service, a.by, { kept: [a.by, b.by] });
  // The device that changed the key goes offline before it reseals anything.
  service.offline();
  await a.engine.adopt(a.by.keyring);
  assert.equal((await a.sync()).state, "offline");
  service.online();
  assert.ok([...rowsOf(service, a).values()].every((row) => row.kid === 1));

  assert.equal((await b.sync()).state, "upToDate");
  assert.ok([...rowsOf(service, a).values()].every((row) => row.kid === 2), "B resealed them");
  await settleAll(service, [a, b]);
  assert.deepEqual(a.notebook.snapshot(), b.notebook.snapshot());
  assert.equal(a.state.kept.meta.resealed, 2);
  assert.equal(posts(service, a).length, 1, "A, back online, found nothing left to seal again");
});

test("the session that changed the key and never told the engine still ends on the new key", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  a.note();
  await a.sync();
  await changeKey(service, a.by, { kept: [a.by] });
  const note = a.note("after the change");
  const status = await a.sync();
  assert.equal(status.state, "upToDate");
  assert.equal(a.engine.keyring().current, 2);
  assert.equal(rowsOf(service, a).get(note.id).kid, 2);
  assert.ok([...rowsOf(service, a).values()].every((row) => row.kid === 2));
});

test("a keyring handed to the engine is checked like one from the service", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  await a.sync();
  await assert.rejects(() => a.engine.adopt(ref.firstKeyring(ref.newId(), ref.randomBytes(32))), (err) => err.why === "notebook");
  await assert.rejects(() => a.engine.adopt({ ...a.by.keyring, keys: [{ kid: 1, key: ref.randomBytes(32) }] }), (err) => err.why === "keyChanged");
  assert.deepEqual(a.engine.keyring(), a.by.keyring);
});
