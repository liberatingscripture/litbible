// test/desk-sync-property.test.js
//
// The sync loop under orders nobody wrote down. Several devices of one
// account write, edit, delete, and restore at random; they go offline and
// come back; a page reloads; an answer is lost on its way back; one device's
// whole pass lands in the middle of another's request; and the key changes
// partway. Whatever the order, three things hold at the end: every device
// has the same notebook, the service's rows open to that notebook (so a
// device that joins afterward gets it too), and no record anyone wrote has
// vanished (each is live or in the trash).
//
// The runs are seeded, so a failure names the seed that reproduces it.

import { test } from "node:test";
import assert from "node:assert/strict";

import * as ref from "../src/lib/desk-crypto.mjs";
import { Offline } from "../src/lib/desk-sync-engine.mjs";
import { createFakeService, changeKey } from "./helpers/fake-notebook-service.mjs";
import { firstDevice, nextDevice, settleAll, testClock } from "./helpers/sync-rig.mjs";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** A small seeded generator (mulberry32): the same seed gives the same run. */
function seeded(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

async function served(service, device) {
  const out = [];
  const keyring = device.engine.keyring();
  for (const row of service.account(device.by.account).rows.values()) out.push((await ref.openRow({ row, keyring })).record);
  return out.sort((a, b) => (a.id < b.id ? -1 : 1));
}

/**
 * One run. `offsets` are each device's clock against the world's, in
 * milliseconds; `keyChanges` is how many times the key changes on the way;
 * `wait` is how far the world moves on before the devices settle (for a
 * clock that ran far ahead, long enough for every other clock to reach it).
 */
async function run(seed, { offsets, steps = 70, keyChanges = 1, wait = 10 * MINUTE }) {
  const rand = seeded(seed);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const service = createFakeService();
  let world = Date.parse("2026-11-24T12:00:00.000Z");
  const devices = [await firstDevice(service, `run-${seed}`)];
  for (let i = 1; i < offsets.length; i++) devices.push(await nextDevice(service, devices[0]));
  const setClocks = () => devices.forEach((d, i) => (d.clock.at = world + offsets[i]));
  setClocks();

  const offline = new Set();
  const passing = new Set();
  const pass = async (d) => {
    if (passing.has(d)) return;
    passing.add(d);
    try {
      await d.sync();
    } finally {
      passing.delete(d);
    }
  };
  let nested = false;
  let interleave = true;
  service.onCall = async (call) => {
    const d = devices.find((x) => x.by.token === call.token);
    if (d && offline.has(d)) throw new Offline();
    // Now and then another device's whole pass lands in the middle of this request.
    if (interleave && !nested && rand() < 0.12) {
      const others = devices.filter((x) => x !== d && !offline.has(x) && !passing.has(x));
      if (others.length) {
        nested = true;
        try {
          await pass(pick(others));
        } finally {
          nested = false;
        }
      }
    }
  };

  const written = new Set();
  const changeAt = new Set();
  for (let i = 1; i <= keyChanges; i++) changeAt.add(Math.floor((steps * i) / (keyChanges + 1)));

  for (let step = 0; step < steps; step++) {
    world += pick([0, 0, 1, 250, 1000, 5000, MINUTE]);
    setClocks();
    const d = pick(devices);
    const roll = rand();
    const all = await d.notebook.all();
    const live = all.filter((r) => r.kind !== "trash");
    const trash = all.filter((r) => r.kind === "trash" && r.record);
    if (roll < 0.22) written.add(d.note(`written at step ${step}`).id);
    else if (roll < 0.42 && live.length) await d.edit(pick(live).id, { body: `edited at step ${step}` });
    else if (roll < 0.52 && live.length) await d.remove(pick(live).id);
    else if (roll < 0.58 && trash.length) await d.restore(pick(trash).id);
    else if (roll < 0.64) offline.has(d) ? offline.delete(d) : offline.add(d);
    else if (roll < 0.67) d.reload();
    else if (roll < 0.7) service.loseAnswer(1);
    else await pass(d);

    if (changeAt.has(step)) {
      // A device that is in step with the service changes the key, keeping every device.
      const by = pick(devices.filter((x) => !offline.has(x)).concat(devices[0]));
      offline.delete(by);
      await pass(by);
      if (by.engine.status().state === "upToDate" && by.engine.keyring().current === service.account(by.by.account).kid) {
        by.by.keyring = by.engine.keyring();
        await changeKey(service, by.by, { kept: devices.map((x) => x.by) });
        // Half the time the account pages forget to hand the engine its new keyring.
        if (rand() < 0.5) await by.engine.adopt(by.by.keyring);
      }
    }
  }

  // Everyone comes back online, the world moves on, and the devices sync until nothing changes.
  offline.clear();
  interleave = false;
  service.loseAnswer(0);
  world += wait;
  setClocks();
  await settleAll(service, devices, { rounds: 30 });

  const label = `seed ${seed}`;
  const want = devices[0].notebook.snapshot();
  devices.forEach((d, i) => {
    assert.equal(d.engine.status().state, "upToDate", `${label}: device ${i}`);
    assert.equal(d.engine.status().pending, 0, `${label}: device ${i} owes nothing`);
    assert.deepEqual(d.notebook.snapshot(), want, `${label}: device ${i} holds the same notebook as device 0`);
  });
  assert.deepEqual(await served(service, devices[0]), want, `${label}: the service's rows open to that notebook`);
  const account = service.account(devices[0].by.account);
  assert.ok(
    [...account.rows.values()].every((row) => row.kid === account.kid),
    `${label}: every row is under the current key`,
  );

  const kept = new Set(want.map((r) => (r.kind === "trash" ? r.deletedId : r.id)));
  for (const id of written) assert.ok(kept.has(id), `${label}: record ${id} is neither live nor in the trash`);

  // A device that joins now, and pulls from the start, holds the same notebook.
  devices[0].by.keyring = devices[0].engine.keyring();
  const fresh = await nextDevice(service, devices[0], { clock: testClock(new Date(world + Math.max(...offsets)).toISOString()) });
  await fresh.sync();
  assert.deepEqual(fresh.notebook.snapshot(), want, `${label}: a device that joins afterward`);
  return { records: want.length, calls: service.calls.length };
}

test("devices whose clocks are within the format's five minutes end with one notebook, whatever the order", async () => {
  let records = 0;
  for (let seed = 1; seed <= 60; seed++) {
    records += (await run(seed, { offsets: [0, -90_000, 150_000] })).records;
  }
  assert.ok(records > 300, "the runs wrote enough to mean something");
});

test("four devices, the key changed twice on the way", async () => {
  for (let seed = 101; seed <= 125; seed++) {
    await run(seed, { offsets: [0, 30_000, -60_000, 120_000], steps: 90, keyChanges: 2 });
  }
});

test("exact ties everywhere: every device on one clock that barely moves", async () => {
  for (let seed = 201; seed <= 230; seed++) {
    await run(seed, { offsets: [0, 0, 0], keyChanges: 0 });
  }
});

test("one clock two hours ahead: the devices agree once the others' clocks reach it", async () => {
  for (let seed = 301; seed <= 330; seed++) {
    await run(seed, { offsets: [0, 2 * HOUR, -30_000], wait: 3 * HOUR });
  }
});
