// A notebook's life with freshly made keys: what one device seals, the
// service keeps, and another device opens. The walkthrough test does this
// with the vectors' fixed values; here every key, nonce, and code is random,
// as on a real device, and the flows the walkthrough doesn't reach are run:
// a rename, signing out, a conflict, paging, and two requests racing.
import { describe, expect, it } from "vitest";
import { call, freshAccount } from "./call.js";
import {
  approve,
  catchUp,
  cardFor,
  changeKey,
  joinThrough,
  keyChangeRequest,
  must,
  newDevice,
  note,
  pull,
  push,
  ref,
  rowFor,
  setUp,
  setupRequest,
  trash,
} from "./notebook.js";

const un = ref.fromBase64url;

describe("a notebook, from setup to a change of key", () => {
  it("sets up with a passkey and a recovery code, and every way in works", async () => {
    const { account, device: first, holders } = await setUp({ passkey: true, recovery: true });
    const [passkey, recovery] = holders;

    const byPasskey = await joinThrough(account, passkey, { name: "Safari on Mac" });
    const byCode = await joinThrough(account, recovery, { name: "Firefox on Windows" });
    const approved = await approve(byPasskey);

    const lists = await must("GET", "/devices", { token: first.token });
    expect(lists.devices.map((d) => [d.id, d.how, d.by])).toEqual([
      [first.id, "setup", null],
      [byPasskey.id, "passkey", passkey.id],
      [byCode.id, "recovery", recovery.id],
      [approved.id, "approval", byPasskey.id],
    ]);
    // Two holders made in one request have one time, so their order is by id: compare as a set.
    expect(new Set(lists.holders.map((h) => [h.id, h.kind, h.by].join()))).toEqual(
      new Set([[passkey.id, "passkey", first.id].join(), [recovery.id, "recovery", first.id].join()]),
    );

    // Every device holds the same key, and each opens what another sealed.
    const record = note({ body: "ἐν ἀρχῇ ἦν ὁ λόγος" });
    await push(approved, [await rowFor(approved.held, record)]);
    for (const device of [first, byPasskey, byCode, approved]) {
      expect((await pull(device)).records).toEqual([record]);
    }
  });

  it("lets a device rename itself, and the others read the new card", async () => {
    const { device, held } = await setUp();
    const other = await approve(device);
    const before = await must("GET", "/devices", { token: device.token });
    const renamed = await must("PUT", `/devices/${device.id}`, {
      token: device.token,
      body: { lists: before.lists, kid: 1, card: await cardFor(device, held, { name: "The study's computer" }) },
    });
    expect(renamed.lists).toBe(before.lists + 1);

    const after = await must("GET", "/devices", { token: other.token });
    const entry = after.devices.find((d) => d.id === device.id);
    const opened = await ref.openDeviceCard({
      notebookKey: ref.keyOf(other.held, 1),
      kid: entry.card.kid,
      notebook: other.held.notebook,
      deviceId: device.id,
      nonce: un(entry.card.nonce),
      ct: un(entry.card.ct),
    });
    expect(opened.card.name).toBe("The study's computer");
  });

  it("signs a device out: its entry, its keyring, and its session go, and the key stays", async () => {
    const { device } = await setUp();
    const other = await approve(device);
    const before = await must("GET", "/devices", { token: device.token });
    const out = await must("DELETE", `/devices/${other.id}`, { token: other.token });
    expect(out.lists).toBe(before.lists + 1);

    expect((await call("GET", "/account", { token: other.token })).status).toBe(401);
    const after = await must("GET", "/devices", { token: device.token });
    expect(after.devices.map((d) => d.id)).toEqual([device.id]);
    expect(after.kid).toBe(1);
    // The first device is still open: signing out is not a change of key.
    expect((await must("GET", "/account", { token: device.token })).session.open).toBe(true);
  });

  it("removes a device with a change of key, and only the kept devices go on", async () => {
    const { account, device: first, holders } = await setUp({ passkey: true, recovery: true });
    const kept = await approve(first);
    const lost = await approve(first);
    await push(first, [await rowFor(first.held), await rowFor(first.held)]);

    const { answer } = await changeKey(first, { removeDevices: [lost.id] });
    expect(answer.kid).toBe(2);

    // The removed device: no session, no entry, no sealed keyring.
    expect((await call("GET", "/rows?since=0", { token: lost.token })).status).toBe(401);
    const again = await newDevice(account);
    expect((await call("GET", `/keyring?device=${lost.id}`, { token: again.token })).body.error).toBe("not_found");

    // The kept device was closed by the change, catches up, and reads on.
    expect((await call("GET", "/rows?since=0", { token: kept.token })).body.error).toBe("not_open");
    await catchUp(kept);
    expect(kept.held.current).toBe(2);
    expect((await pull(kept)).records).toHaveLength(2);

    // Both holders were kept, so each still opens the notebook, and to the new key.
    const viaCode = await joinThrough(account, holders[1]);
    expect(viaCode.held.current).toBe(2);

    // The device that changed the key seals the old rows again.
    const old = await must("GET", "/rows?old=1&since=0", { token: first.token });
    expect(old.rows).toHaveLength(2);
    const resealed = [];
    for (const row of old.rows) {
      const { record } = await ref.openRow({ row, keyring: first.held });
      resealed.push(await rowFor(first.held, record, row.rev));
    }
    const pushed = await push(first, resealed);
    expect(pushed.put.every((item) => item.rev > 2)).toBe(true);
    expect((await must("GET", "/rows?old=1&since=0", { token: first.token })).rows).toEqual([]);
  });

  it("switches to “this device only”: the passkey holder goes and a recovery code is made", async () => {
    const { account, device, holders } = await setUp({ passkey: true, recovery: false });
    const { added } = await changeKey(device, { removeHolders: [holders[0].id], add: ["recovery"] });
    const lists = await must("GET", "/devices", { token: device.token });
    expect(lists.holders.map((h) => h.kind)).toEqual(["recovery"]);
    const back = await joinThrough(account, added[0]);
    expect(back.held.current).toBe(2);
  });
});

describe("records", () => {
  it("answers a stale edit with the row as it stands, and takes the merged one", async () => {
    const { device: one } = await setUp();
    const two = await approve(one);
    const record = note({ body: "first" });
    const [{ rev }] = (await push(one, [await rowFor(one.held, record)])).put;

    // Both devices edit the record they last saw at `rev`. One gets there first.
    const fromOne = { ...record, body: "from one", modified: "2026-11-23T19:00:00.000Z" };
    const fromTwo = { ...record, body: "from two", modified: "2026-11-23T19:00:01.000Z" };
    const won = (await push(one, [await rowFor(one.held, fromOne, rev)])).put[0];
    expect(won.rev).toBe(rev + 1);
    const lost = (await push(two, [await rowFor(two.held, fromTwo, rev)])).put[0];
    expect(lost.conflict).toBe("changed");
    expect(lost.row.rev).toBe(won.rev);

    // The device opens the row it was sent, merges as the format says, and pushes again.
    const theirs = (await ref.openRow({ row: lost.row, keyring: two.held })).record;
    expect(theirs.body).toBe("from one");
    const merged = (await push(two, [await rowFor(two.held, fromTwo, lost.row.rev)])).put[0];
    expect(merged.rev).toBe(won.rev + 1);
    expect((await pull(one)).records).toEqual([fromTwo]);
  });

  it("deletes a record: its row goes, and a trash record carries the deletion", async () => {
    const { device: one } = await setUp();
    const two = await approve(one);
    const record = note();
    const [{ rev }] = (await push(one, [await rowFor(one.held, record)])).put;
    const tombstone = trash(record);

    const answer = await push(one, [await rowFor(one.held, tombstone)], [{ id: record.id, rev }]);
    expect(answer.remove).toEqual([{ id: record.id, removed: true }]);
    const seen = await pull(two);
    expect(seen.records).toEqual([tombstone]);
    expect(seen.rows[0].deletedAt).toBe(tombstone.deletedAt);
    // Removing it again is what was asked for already.
    expect((await push(two, [], [{ id: record.id, rev }])).remove).toEqual([{ id: record.id, removed: true }]);
  });

  it("gives rows in pages by revision, and a cursor that never skips one", async () => {
    const { device } = await setUp();
    const records = Array.from({ length: 7 }, (_, i) => note({ body: `note ${i}` }));
    const rows = [];
    for (const record of records) rows.push(await rowFor(device.held, record));
    await push(device, rows.slice(0, 4));
    const first = await must("GET", "/rows?since=0", { token: device.token });
    expect(first.rows.map((row) => row.rev)).toEqual([1, 2, 3, 4]);
    expect([first.next, first.more]).toEqual([4, false]);

    await push(device, rows.slice(4));
    const second = await must("GET", `/rows?since=${first.next}`, { token: device.token });
    expect(second.rows.map((row) => row.rev)).toEqual([5, 6, 7]);
    const none = await must("GET", `/rows?since=${second.next}`, { token: device.token });
    expect([none.rows, none.next, none.more]).toEqual([[], 7, false]);
    expect((await pull(device)).records).toEqual(records);
  });
});

describe("two requests at once", () => {
  it("lets only one of two devices set up", async () => {
    const account = freshAccount();
    const one = await setupRequest({ account });
    const two = await setupRequest({ account });
    const answers = await Promise.all([
      call("POST", "/notebook", { token: one.device.token, body: one.body }),
      call("POST", "/notebook", { token: two.device.token, body: two.body }),
    ]);
    expect(answers.map((a) => a.status).sort()).toEqual([200, 409]);
    expect(answers.find((a) => a.status === 409).body.error).toBe("already_set_up");
    const winner = answers[0].status === 200 ? one : two;
    const { notebook, lists } = await must("GET", "/account", { token: winner.device.token });
    expect(notebook).toBe(winner.held.notebook);
    // Nothing of the loser's was kept: one device, and the winner's holder.
    const kept = await must("GET", "/devices", { token: winner.device.token });
    expect([kept.devices.length, kept.holders.length, lists]).toEqual([1, 1, 1]);
    expect(kept.devices[0].id).toBe(winner.device.id);
  });

  it("gives two pushes at once their own revisions", async () => {
    const { device: one } = await setUp();
    const two = await approve(one);
    const answers = await Promise.all([
      push(one, [await rowFor(one.held), await rowFor(one.held)]),
      push(two, [await rowFor(two.held), await rowFor(two.held)]),
    ]);
    const revs = answers.flatMap((a) => a.put.map((item) => item.rev)).sort();
    expect(revs).toEqual([1, 2, 3, 4]);
    expect((await pull(one)).rows.map((row) => row.rev)).toEqual([1, 2, 3, 4]);
  });

  it("applies one of two changes of key, and tells the other the key is old", async () => {
    const { device: one } = await setUp();
    const two = await approve(one);
    const first = await keyChangeRequest(one);
    const second = await keyChangeRequest(two);
    const answers = await Promise.all([
      call("POST", "/notebook/key", { token: one.token, body: first.body }),
      call("POST", "/notebook/key", { token: two.token, body: second.body }),
    ]);
    expect(answers.map((a) => a.status).sort()).toEqual([200, 403]);
    // The loser's session was closed by the winner's change, so it is told to catch up first.
    expect(answers.find((a) => a.status !== 200).body.error).toBe("not_open");
    expect((await must("GET", "/account", { token: one.token })).kid).toBe(2);
  });
});
