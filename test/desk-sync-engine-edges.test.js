// test/desk-sync-engine-edges.test.js
//
// The sync loop where things are not as they should be: clocks that differ,
// an exact tie, rows this client can't read, a copy another client replaced
// with an older one, a notebook that lost records without a trace, and a
// service restored from an older copy. With them, what the status says.
// The loop's ordinary work is test/desk-sync-engine.test.js.

import { test } from "node:test";
import assert from "node:assert/strict";

import * as ref from "../src/lib/desk-crypto.mjs";
import { emptyTrashRecord } from "../src/lib/desk-records.mjs";
import { createFakeService, changeKey } from "./helpers/fake-notebook-service.mjs";
import { firstDevice, nextDevice, settleAll } from "./helpers/sync-rig.mjs";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const rowsOf = (service, device) => service.account(device.by.account).rows;
const posts = (service, device) =>
  service.calls.filter((c) => c.method === "POST" && c.path === "/rows" && (!device || c.token === device.by.token));
const isPost = (call, device) => call.method === "POST" && call.path === "/rows" && call.token === device.by.token;

async function served(service, device) {
  const out = [];
  for (const row of rowsOf(service, device).values()) out.push((await ref.openRow({ row, keyring: device.engine.keyring() })).record);
  return out.sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** A record sealed as a device would seal it, for a test to stand on the service by hand. */
const sealFor = (device, record, { keyring = device.by.keyring, kid = keyring.current } = {}) =>
  ref.sealRecord({ record, notebookKey: ref.keyOf(keyring, kid), kid });

/* ── Clocks ──────────────────────────────────────────────────────────── */

test("a row from a clock far ahead waits until this device's clock reaches it, and an edit made here in between gives way", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  const note = a.note("the first words");
  await settleAll(service, [a, b]);

  // A's clock runs two hours fast.
  a.clock.at += 2 * HOUR;
  const fast = await a.edit(note.id, { body: "from the fast clock" });
  await a.sync();

  let status = await b.sync();
  assert.equal(status.state, "upToDate");
  assert.equal(status.problems.ahead, 1);
  assert.equal((await b.notebook.get(note.id)).body, "the first words", "it is not taken yet");

  // B edits the record meanwhile. The edit isn't pushed over a row B hasn't judged.
  b.clock.tick(60_000);
  await b.edit(note.id, { body: "B's edit, made in between" });
  status = await b.sync();
  assert.equal(status.problems.blocked, 1);
  assert.equal(posts(service, b).length, 0);
  b.reload();
  status = await b.sync();
  assert.equal(status.problems.ahead, 1, "the kept row survives a reload");
  assert.equal(status.problems.blocked, 1);
  assert.equal(posts(service, b).length, 0);

  // B's clock comes within five minutes of the stamp. The format's rule: the faster clock's edit
  // stands on both, even over the edit made in between.
  b.clock.at = Date.parse(fast.modified) - 4 * 60_000;
  status = await b.sync();
  assert.equal(status.problems.ahead, 0);
  assert.equal(status.problems.blocked, 0);
  assert.equal((await b.notebook.get(note.id)).body, "from the fast clock");
  assert.equal(posts(service, b).length, 0);
  assert.deepEqual(a.notebook.snapshot(), b.notebook.snapshot());
  assert.deepEqual(await served(service, a), a.notebook.snapshot());
});

test("a record this device doesn't have, from a clock far ahead, is shown at this device's time and never pushed that way", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  a.clock.at += 2 * HOUR;
  const note = a.note("written on the fast clock");
  await a.sync();

  await b.sync();
  const shown = await b.notebook.get(note.id);
  assert.equal(shown.body, "written on the fast clock", "the reader has the words at once");
  assert.equal(shown.modified, b.clock.now(), "at this device's time");
  b.reload();
  await b.sync();
  assert.equal(posts(service, b).length, 0, "the copy it capped is not sent back");
  assert.equal(rowsOf(service, a).get(note.id).modified, note.modified);

  b.clock.at = Date.parse(note.modified) - 60_000;
  await b.sync();
  assert.deepEqual(await b.notebook.get(note.id), note, "once its clock arrives it holds the record as written");
  assert.equal(posts(service, b).length, 0);
});

test("a record deleted here while its row waited ahead comes back once this clock reaches the edit", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  const note = a.note("the first words");
  await settleAll(service, [a, b]);
  a.clock.at += 2 * HOUR;
  const fast = await a.edit(note.id, { body: "from the fast clock" });
  await a.sync();
  await b.sync();

  // B deletes the copy it holds. Its deletion is the earlier action by the stamps.
  b.clock.tick(60_000);
  await b.remove(note.id);
  await settleAll(service, [b, a]);
  assert.ok(rowsOf(service, a).has(note.id), "the record's row is not removed: B hasn't judged it");
  assert.equal((await a.notebook.get(note.id)).body, "from the fast clock");

  b.clock.at = Date.parse(fast.modified);
  a.clock.at = Math.max(a.clock.at, b.clock.at);
  await settleAll(service, [b, a]);
  assert.equal((await b.notebook.get(note.id)).body, "from the fast clock");
  assert.deepEqual(a.notebook.snapshot(), b.notebook.snapshot());
  assert.deepEqual(await served(service, a), a.notebook.snapshot());
});

test("an exact tie goes to the row the service holds, in a pull and in a conflict alike", async () => {
  for (const path of ["pull", "conflict"]) {
    const service = createFakeService();
    const a = await firstDevice(service);
    const b = await nextDevice(service, a);
    const note = a.note("the first words");
    await settleAll(service, [a, b]);
    a.clock.tick(1000);
    b.clock.at = a.clock.at;
    const mine = await a.edit(note.id, { body: "A's edit" });
    const theirs = await b.edit(note.id, { body: "B's edit" });
    assert.equal(mine.modified, theirs.modified, "the two edits carry the same time");

    if (path === "pull") {
      await a.sync();
      await b.sync();
      assert.equal(posts(service, b).length, 0, path);
    } else {
      let raced = false;
      service.onCall = async (call) => {
        if (raced || !isPost(call, b)) return;
        raced = true;
        await a.sync();
      };
      await b.sync();
      service.onCall = null;
      assert.equal(posts(service, b).length, 1, path);
    }
    await settleAll(service, [a, b]);
    assert.equal((await b.notebook.get(note.id)).body, "A's edit", path);
    assert.equal((await a.notebook.get(note.id)).body, "A's edit", path);
    assert.deepEqual(await served(service, a), a.notebook.snapshot(), path);
  }
});

test("two devices that each put their own words into one deletion, at the same instant, end with one trash record", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  const c = await nextDevice(service, a);
  const note = a.note("the first words");
  await settleAll(service, [a, b, c]);

  // A and B each edit the note at the same instant, and neither has synced when C deletes it.
  a.clock.tick(500);
  b.clock.at = a.clock.at;
  await a.edit(note.id, { body: "A's words" });
  await b.edit(note.id, { body: "B's words" });
  c.clock.at = a.clock.at + 500;
  const trash = await c.remove(note.id);
  await c.sync();

  // The deletion is the later action, so it stands on both, and each puts its newer words into
  // the trash record (the format's rule b). A's push of that record lands just before B's.
  let raced = false;
  service.onCall = async (call) => {
    if (raced || !isPost(call, b)) return;
    raced = true;
    await a.sync();
  };
  await b.sync();
  service.onCall = null;
  assert.ok(raced);
  await settleAll(service, [a, b, c]);
  assert.equal((await b.notebook.get(trash.id)).record.body, "A's words", "the row the service took first stands");
  assert.deepEqual(b.notebook.snapshot(), a.notebook.snapshot());
  assert.deepEqual(c.notebook.snapshot(), a.notebook.snapshot());
  assert.deepEqual(await served(service, a), a.notebook.snapshot());
});

/* ── The damper ──────────────────────────────────────────────────────── */

test("a copy this device pushed, replaced on the service by one that loses to it, is not pushed back until it changes", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const note = a.note("the words as this device has them");
  await a.sync();
  // A client whose rules differ from this one's writes an older copy over the row.
  const older = { ...note, body: "an older copy", modified: new Date(Date.parse(note.modified) - 60_000).toISOString() };
  service.plant(a.by.account, await sealFor(a, older));

  const before = posts(service).length;
  assert.equal((await a.sync()).state, "upToDate");
  await a.sync();
  assert.equal(posts(service).length, before, "it does not trade pushes with the other client");
  assert.equal((await a.notebook.get(note.id)).body, "the words as this device has them", "and it keeps its own copy");

  a.clock.tick(1000);
  await a.edit(note.id, { body: "edited again" });
  await a.sync();
  assert.deepEqual(await served(service, a), a.notebook.snapshot(), "its next change goes up");
});

test("two devices that empty a deletion on different days settle, and agree once both have", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  const note = a.note("deleted, and then thirty days pass");
  await settleAll(service, [a, b]);
  a.clock.tick(1000);
  const trash = await a.remove(note.id);
  b.clock.at = a.clock.at;
  await settleAll(service, [a, b]);

  // Thirty days on. A's clock passes the day first, and its store drops what the deletion held.
  a.clock.at += 30 * DAY + 60_000;
  b.clock.at = a.clock.at - DAY;
  const emptied = emptyTrashRecord(await a.notebook.get(trash.id), a.clock.now());
  assert.equal(emptied.record, undefined);
  a.notebook.write({ put: [emptied] });
  const before = posts(service).length;
  await settleAll(service, [a, b, a, b]);
  assert.ok(posts(service).length - before <= 3, "they do not trade the two copies back and forth");

  // B's clock passes the day too.
  a.clock.at += 2 * DAY;
  b.clock.at += 2 * DAY;
  b.notebook.write({ put: [emptyTrashRecord(await b.notebook.get(trash.id), b.clock.now())] });
  await settleAll(service, [a, b]);
  assert.deepEqual(a.notebook.snapshot(), b.notebook.snapshot());
  assert.deepEqual(await served(service, a), a.notebook.snapshot());
  assert.equal((await a.notebook.get(trash.id)).record, undefined);
});

/* ── Rows this client can't read ─────────────────────────────────────── */

test("a row in a version this client doesn't know is kept aside: nothing is merged, overwritten, or removed", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const note = a.note("held here in the form this client knows");
  await a.sync();
  // A newer client writes the record's row in a version of the row this one can't open.
  const newer = service.plant(a.by.account, { ...(await sealFor(a, { ...note, body: "rewritten by a newer client" })), v: 2 });

  let status = await a.sync();
  assert.equal(status.state, "upToDate");
  assert.equal(status.problems.aside, 1);
  assert.equal((await a.notebook.get(note.id)).body, "held here in the form this client knows");

  // An edit here is not pushed over it, and neither is a deletion's removal.
  a.clock.tick(1000);
  await a.edit(note.id, { body: "edited here" });
  status = await a.sync();
  assert.equal(status.problems.blocked, 1);
  a.clock.tick(1000);
  await a.remove(note.id);
  a.reload();
  status = await a.sync();
  assert.equal(status.problems.aside, 1);
  assert.deepEqual(rowsOf(service, a).get(note.id), newer, "the row stands as the newer client wrote it");
  assert.equal(posts(service, a).filter((c) => c.body.remove.length).length, 0);
});

test("a row under a key this device doesn't hold is kept aside, and read once the key arrives", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  await settleAll(service, [a, b]);
  // A row sealed under the next key reaches B before any keyring that holds it.
  const next = ref.nextKeyring(a.by.keyring, ref.randomBytes(32));
  const note = a.note("sealed under a key B doesn't hold yet");
  a.notebook.write({ remove: [note.id] });
  service.plant(a.by.account, await sealFor(a, note, { keyring: next }));

  let status = await b.sync();
  assert.equal(status.problems.aside, 1);
  assert.equal(await b.notebook.get(note.id), undefined);

  await changeKey(service, a.by, { kept: [a.by, b.by], next });
  status = await b.sync();
  assert.equal(status.state, "upToDate");
  assert.equal(status.problems.aside, 0);
  assert.deepEqual(await b.notebook.get(note.id), note);
});

test("a row whose seal doesn't open is skipped and reported: the copy here stays, and only a later change goes over it", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const note = a.note("the copy this device holds");
  const other = a.note("another note");
  await a.sync();
  const good = rowsOf(service, a).get(note.id);
  const flipped = good.ct.slice(0, 40) + (good.ct[40] === "A" ? "B" : "A") + good.ct.slice(41);
  service.plant(a.by.account, { ...good, ct: flipped });

  let status = await a.sync();
  assert.equal(status.state, "upToDate");
  assert.equal(status.problems.unread, 1);
  assert.equal((await a.notebook.get(note.id)).body, "the copy this device holds");
  const before = posts(service).length;
  a.reload();
  await a.sync();
  assert.equal(posts(service).length, before, "the copy it happens to hold is not pushed over a row it couldn't read");

  a.clock.tick(1000);
  await a.edit(note.id, { body: "changed after that" });
  status = await a.sync();
  assert.equal(status.problems.unread, 0);
  assert.deepEqual(await served(service, a), a.notebook.snapshot());
  assert.ok(await a.notebook.get(other.id));
});

test("a row that opens to a record the format refuses is skipped and reported, and stays on the service", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  const good = a.note("a good note");
  await settleAll(service, [a, b]);
  const bad = { ...good, id: ref.newId(), labels: "not a list" };
  const planted = service.plant(a.by.account, await sealFor(a, bad));
  const logs = [];
  const c = await nextDevice(service, a, { log: (...args) => logs.push(args) });

  for (const device of [a, b, c]) {
    const status = await device.sync();
    assert.equal(status.state, "upToDate");
    assert.equal(status.problems.unread, 1);
    assert.equal(await device.notebook.get(bad.id), undefined);
  }
  assert.deepEqual(rowsOf(service, a).get(bad.id), planted);
  assert.ok(
    logs.some(([what, report]) => what === "a row was not merged" && report.id === bad.id && report.how === "skip"),
    "it is reported",
  );
  assert.equal((await c.notebook.all()).length, 1);
});

/* ── Evidence, and a service that lost rows ──────────────────────────── */

test("a record gone from this notebook without a trace is fetched again, never removed for everyone", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  const notes = [a.note("one"), a.note("two"), a.note("three")];
  await settleAll(service, [a, b]);

  // Something outside the desk removes a record from this browser's store. No deletion was made.
  a.notebook.write({ remove: [notes[1].id] });
  const status = await a.sync();
  assert.equal(status.state, "upToDate");
  assert.deepEqual(await a.notebook.get(notes[1].id), notes[1], "it is back");
  assert.equal(rowsOf(service, a).size, 3);
  assert.equal(posts(service).filter((c) => c.body.remove.length).length, 0, "no removal was ever sent");
  await b.sync();
  assert.equal((await b.notebook.all()).length, 3);
});

test("a notebook emptied behind the desk's back is filled again from the service", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  for (let i = 0; i < 20; i++) a.note(`note ${i}`);
  await a.sync();
  const whole = a.notebook.snapshot();
  a.notebook.write({ remove: whole.map((r) => r.id) });
  a.reload();
  assert.equal((await a.sync()).state, "upToDate");
  assert.deepEqual(a.notebook.snapshot(), whole);
  assert.equal(rowsOf(service, a).size, 20);
});

test("a read of the notebook that fails leaves the edit owed: a later pass sends it, with no reload", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  const note = a.note("the first words");
  await settleAll(service, [a, b]);
  a.clock.tick();
  await a.edit(note.id, { body: "the second words" });

  // The browser's database refuses one read (a blocked upgrade, a closing connection; Audit 9, SY9-1).
  const get = a.notebook.get;
  let failing = 1;
  a.notebook.get = async (id) => {
    if (failing-- > 0) throw new Error("UnknownError: the database is closing");
    return get(id);
  };
  const failed = await a.sync();
  assert.equal(failed.state, "error");
  assert.equal(failed.pending, 1, "the reader is told the edit waits");
  assert.equal((await served(service, a)).find((r) => r.id === note.id).body, "the first words");

  // The next pass, in the same page, reads the record again and sends it.
  const status = await a.sync();
  assert.equal(status.state, "upToDate");
  assert.equal(status.pending, 0);
  assert.equal((await served(service, a)).find((r) => r.id === note.id).body, "the second words");
  await b.sync();
  assert.equal((await b.notebook.get(note.id)).body, "the second words", "and another device has it");
});

test("a service restored from an older copy is given back what this device still holds", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const early = [a.note("one"), a.note("two"), a.note("three")];
  await a.sync();
  const mark = service.account(a.by.account).rev;
  a.clock.tick(1000);
  const late = [a.note("four"), a.note("five")];
  await a.edit(early[0].id, { body: "one, edited after the copy was made" });
  await a.sync();
  const whole = a.notebook.snapshot();

  // The service goes back: the two later notes are gone, and the edit with them.
  service.goBack(a.by.account, mark);
  assert.equal(rowsOf(service, a).size, 2);
  // The device notices at its next push: the service's last revision is behind what it has pulled.
  a.clock.tick(1000);
  const newest = a.note("six");
  assert.equal((await a.sync()).state, "upToDate");
  assert.deepEqual(a.notebook.snapshot().length, whole.length + 1, "nothing here was taken away");
  assert.deepEqual(await served(service, a), a.notebook.snapshot(), "and the service holds all of it again");
  assert.ok(rowsOf(service, a).has(late[0].id) && rowsOf(service, a).has(late[1].id) && rowsOf(service, a).has(newest.id));

  const fresh = await nextDevice(service, a);
  await fresh.sync();
  assert.deepEqual(fresh.notebook.snapshot(), a.notebook.snapshot());
});

test("a row the service went back on, to an older copy, is replaced with the one this device holds", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const note = a.note("the first words");
  await a.sync();
  const old = { ...rowsOf(service, a).get(note.id) };
  a.clock.tick(1000);
  await a.edit(note.id, { body: "the later words" });
  await a.sync();
  // The restore brings back the first row, at its first revision.
  const account = service.account(a.by.account);
  account.rows.set(note.id, old);
  account.rev = old.rev;

  a.clock.tick(1000);
  a.note("another, so there is something to push");
  assert.equal((await a.sync()).state, "upToDate");
  assert.equal((await ref.openRow({ row: rowsOf(service, a).get(note.id), keyring: a.engine.keyring() })).record.body, "the later words");
  assert.deepEqual(await served(service, a), a.notebook.snapshot());
});

/* ── What the status says ────────────────────────────────────────────── */

test("a pass with nothing to do leaves \"up to date\" as it is: no flicker through \"syncing\"", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  a.note();
  await a.sync();
  const said = a.statuses.length;
  await a.sync();
  await a.sync();
  assert.deepEqual(
    a.statuses.slice(said).map((s) => s.state),
    ["upToDate", "upToDate"],
  );
  a.note();
  await a.sync();
  assert.deepEqual(
    a.statuses.slice(said + 2).map((s) => s.state),
    ["syncing", "upToDate"],
  );
});

test("a pass asked for while one runs is that same pass", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  a.note();
  const first = a.sync();
  const second = a.sync();
  assert.equal(first, second);
  await first;
  assert.equal(posts(service).length, 1);
});

test("the status carries the last time everything was in step, and how far this clock is from the service's", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  // The service's clock is ten minutes ahead of this device's.
  service.time = () => new Date(a.clock.at + 600_000).toISOString();
  a.note();
  const status = await a.sync();
  assert.equal(status.lastSynced, a.clock.now());
  assert.equal(status.clock, -600_000);
  a.clock.tick(5000);
  service.offline();
  const later = await a.sync();
  assert.equal(later.state, "offline");
  assert.equal(later.lastSynced, status.lastSynced, "a pass that failed doesn't move it");
});

test("a request waiting on the account is read again within a quarter of an hour", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  assert.equal((await a.sync()).account.waiting, null);
  // The interface's shape (waitingOut, waiting.js): a request made on a phone, not by this browser.
  const waiting = { what: "replace", asked: a.clock.now(), due: "2026-12-01T12:00:00.000Z", platform: "ios", through: "apple", mine: false };
  service.account(a.by.account).waiting = waiting;
  a.clock.tick(5 * 60_000);
  assert.equal((await a.sync()).account.waiting, null, "not asked again on every pass");
  a.clock.tick(11 * 60_000);
  assert.deepEqual((await a.sync()).account.waiting, waiting);
});

/* ── Guards no other test reaches (Audit 9, SY9b-1) ──────────────────── */

test("a pull that finds the notebook on a newer key catches up in that pass: a device that only reads opens the new rows at once", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  a.note("before the change");
  await settleAll(service, [a, b]);
  // B's account page changes the key and never tells B's engine. B's session is the one that changed it,
  // so it stays open and the service answers B's pull; only the page's kid says B is behind.
  await changeKey(service, b.by, { kept: [a.by, b.by] });
  await a.sync();
  const note = a.note("written under the new key");
  assert.equal((await a.sync()).state, "upToDate");
  assert.equal(rowsOf(service, a).get(note.id).kid, 2);

  const keyrings = () => service.calls.filter((c) => c.token === b.by.token && c.path.startsWith("/keyring")).length;
  const fetched = keyrings();
  const sent = posts(service, b).length;
  const status = await b.sync();
  assert.equal(status.state, "upToDate");
  assert.equal(status.problems.aside, 0, "nothing waits for a key it could have fetched");
  assert.equal(b.engine.keyring().current, 2);
  assert.equal((await b.notebook.get(note.id)).body, "written under the new key");
  assert.equal(keyrings() - fetched, 1, "one keyring fetched");
  assert.equal(posts(service, b).length, sent, "and nothing sent: A had sealed every row again");
});

test("a kept row whose record has since moved on is let go, never merged again over the newer one", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  const b = await nextDevice(service, a);
  const note = a.note("the first words");
  await settleAll(service, [a, b]);
  // The first row, as the service sends it.
  const older = structuredClone(rowsOf(service, a).get(note.id));
  delete older.deletedAt;
  a.clock.tick(60_000);
  await a.edit(note.id, { body: "the later words" });
  await settleAll(service, [a, b]);
  const entry = structuredClone(b.state.kept.rows.get(note.id));
  assert.ok(entry.rev > older.rev);

  // A hold on the first row, due now, beside an entry already past it. Today's engine leaves none (a pulled
  // row replaces the hold on its record), so the test stands one there, as an older copy of the sync's
  // state would, and B reloads.
  b.state.kept.held.set(note.id, { id: note.id, why: "ahead", row: older, due: 0 });
  b.reload();
  const sent = posts(service, b).length;
  const status = await b.sync();
  assert.equal(status.state, "upToDate");
  assert.equal(status.problems.ahead, 0);
  assert.equal(b.state.kept.held.has(note.id), false, "the hold is let go");
  assert.deepEqual(b.state.kept.rows.get(note.id), entry, "the entry stays on the newer row");
  assert.equal((await b.notebook.get(note.id)).body, "the later words");
  assert.equal(posts(service, b).length, sent, "and nothing is sent");
});

test("a pass told to catch up again and again stops after three catch-ups, in error, and the next pass goes on", async () => {
  const service = createFakeService();
  const a = await firstDevice(service);
  a.note("before");
  await a.sync();
  const note = a.note("held back while the key keeps changing");
  // The key changes again at every push, so every push is refused as old_key (a stand-in for a service
  // that answers old_key for ever). The test stops a pass that has no bound, rather than hang.
  let pushes = 0;
  service.onCall = async (call) => {
    if (!isPost(call, a)) return;
    if (++pushes > 8) throw new Error("the pass did not stop");
    await changeKey(service, a.by, { kept: [a.by] });
  };
  const keyrings = () => service.calls.filter((c) => c.token === a.by.token && c.path.startsWith("/keyring")).length;
  const fetched = keyrings();
  const status = await a.sync();
  service.onCall = null;
  assert.equal(status.state, "error");
  assert.equal(status.reason, "behind");
  assert.equal(pushes, 4, "the first push and one after each of three catch-ups");
  assert.equal(keyrings() - fetched, 3);
  assert.equal(status.pending, 1, "the note still waits");

  // With the key still, the next pass catches up once more and sends it.
  assert.equal((await a.sync()).state, "upToDate");
  assert.equal(rowsOf(service, a).get(note.id).kid, a.by.keyring.current);
});
