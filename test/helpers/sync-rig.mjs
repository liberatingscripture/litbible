// test/helpers/sync-rig.mjs
//
// What the sync's tests stand a device on: a notebook in memory that behaves
// as the desk's store does (records read through migrateRecord, a change read
// and written as one step), the sync's own state in memory, a clock a test
// can set, and a reader's hands (write a note, edit it, delete it, restore
// it) that stamp as the desk stamps. The service is
// test/helpers/fake-notebook-service.mjs.

import { createRecord, editRecord, migrateRecord, restoreFromTrash, trashRecord } from "../../src/lib/desk-records.mjs";
import { createSyncEngine } from "../../src/lib/desk-sync-engine.mjs";
import { join, newDevice, setUp } from "./fake-notebook-service.mjs";

const copy = (value) => (value === undefined ? value : JSON.parse(JSON.stringify(value)));

/** A notebook in memory with the store's three methods, and `onChange(ids)` for what a view would hear. */
export function memoryNotebook() {
  const records = new Map();
  const listeners = new Set();
  const read = (r) => (r ? migrateRecord(copy(r)) : undefined);
  const apply = (plan) => {
    const ids = [...plan.put.map((r) => r.id), ...plan.remove];
    for (const r of plan.put) records.set(r.id, copy(r));
    for (const id of plan.remove) records.delete(id);
    for (const fn of listeners) fn(ids);
  };
  return {
    records,
    all: async () => [...records.values()].map(read),
    get: async (id) => read(records.get(id)),
    async change(build) {
      const plan = await build({ get: async (id) => read(records.get(id)), all: async () => [...records.values()].map(read) });
      if (plan && (plan.put?.length || plan.remove?.length)) apply({ put: plan.put ?? [], remove: plan.remove ?? [] });
      return plan;
    },
    /** A write the reader makes (not the sync). */
    write(plan) {
      apply({ put: plan.put ?? [], remove: plan.remove ?? [] });
    },
    onChange(fn) {
      listeners.add(fn);
    },
    /** Every record, sorted by id, as plain data: what two notebooks are compared by. */
    snapshot: () => [...records.values()].map(copy).sort((a, b) => (a.id < b.id ? -1 : 1)),
  };
}

/** The sync's state in memory, with the engine's two methods. `writes` counts commits. */
export function memoryState(meta = {}) {
  const kept = { meta: { ...meta }, rows: new Map(), held: new Map() };
  return {
    kept,
    writes: 0,
    async read() {
      return copy({ meta: kept.meta, rows: [...kept.rows.values()], held: [...kept.held.values()] });
    },
    async write({ meta: next, rows, held }) {
      this.writes++;
      if (next) kept.meta = copy(next);
      for (const entry of rows?.put ?? []) kept.rows.set(entry.id, copy(entry));
      for (const id of rows?.remove ?? []) kept.rows.delete(id);
      for (const hold of held?.put ?? []) kept.held.set(hold.id, copy(hold));
      for (const id of held?.remove ?? []) kept.held.delete(id);
    },
  };
}

/** A clock a test moves: `clock.at` is milliseconds, `clock.now()` the format's time. */
export function testClock(start = "2026-11-24T12:00:00.000Z") {
  const clock = {
    at: Date.parse(start),
    now: () => new Date(clock.at).toISOString(),
    tick(ms = 1000) {
      clock.at += ms;
      return clock;
    },
  };
  return clock;
}

let seq = 0;

/**
 * A device around the engine: its notebook, its state, its clock, and a
 * reader's hands. `by` is a device from the fake service's `setUp` or `join`.
 */
export async function rig(service, by, { clock = testClock(), notebook = memoryNotebook(), state, log } = {}) {
  state ??= memoryState({ notebook: by.keyring.notebook });
  const statuses = [];
  const make = () =>
    createSyncEngine({
      notebook,
      state,
      api: service.api(() => by.token),
      device: { id: by.id, key: by.key },
      now: clock.now,
      sleep: async () => {},
      onStatus: (s) => statuses.push(s),
      log,
    });
  let engine = make();
  await engine.adopt(by.keyring);
  notebook.onChange((ids) => engine.touch(ids));
  const ctx = () => ({ now: clock.now(), client: `test-${by.id.slice(0, 4)}`, contentVersion: "2026.11.24" });
  const device = {
    by,
    notebook,
    state,
    clock,
    statuses,
    get engine() {
      return engine;
    },
    sync: () => engine.pass(),
    /** A page reload: a new engine over the same notebook and state, nothing kept in memory. */
    reload() {
      engine = make();
      return device;
    },

    /** The reader writes a note. Returns the record. */
    note(body = `note ${++seq}`, fields = {}) {
      const record = createRecord("note", { bookKey: "john", chapter: 3, verse: 16, body, marker: "note", ...fields }, ctx());
      notebook.write({ put: [record] });
      return record;
    },
    /** The reader edits a record's fields. Returns the new record. */
    async edit(id, changes) {
      const record = editRecord(await notebook.get(id), changes, ctx());
      notebook.write({ put: [record] });
      return record;
    },
    /** The reader deletes a record. Returns the trash record. */
    async remove(id) {
      const trash = trashRecord(await notebook.get(id), ctx());
      notebook.write({ put: [trash], remove: [id] });
      return trash;
    },
    /** The reader restores from the trash. Returns the record. */
    async restore(trashId) {
      const record = restoreFromTrash(await notebook.get(trashId), ctx());
      notebook.write({ put: [record], remove: [trashId] });
      return record;
    },
    live: async () => (await notebook.all()).filter((r) => r.kind !== "trash"),
  };
  return device;
}

/** A first device with a notebook set up on the service, ready to sync. */
export async function firstDevice(service, account = `account-${++seq}`, options) {
  return rig(service, await setUp(service, account), options);
}

/** Another device of the same account, joined, ready to sync. */
export async function nextDevice(service, from, options) {
  return rig(service, await join(service, from.by), options);
}

/** A device signed in to the account that holds no keyring yet (for a test that hands it one itself). */
export { newDevice };

/** Syncs every device, round after round, until a whole round changes nothing on the service or in any notebook. */
export async function settleAll(service, devices, { rounds = 12 } = {}) {
  const picture = () => JSON.stringify([devices.map((d) => d.notebook.snapshot()), service.calls.filter((c) => c.method === "POST" && c.path === "/rows").length]);
  for (let i = 0; i < rounds; i++) {
    const before = picture();
    for (const d of devices) await d.sync();
    if (picture() === before) return i;
  }
  throw new Error(`the devices were still changing after ${rounds} rounds`);
}
