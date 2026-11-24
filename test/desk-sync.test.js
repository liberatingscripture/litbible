// test/desk-sync.test.js
//
// The pure rules of the sync (src/lib/desk-sync.mjs): what is owed, what may
// be removed and on what evidence, how a push's answer is read, how rows are
// split into requests, and the small sums (digests, waiting, the clock's
// offset). The loop that applies them is tested against a stand-in service in
// test/desk-sync-engine.test.js.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  BODY_BUDGET,
  MAX_ROWS,
  batches,
  clockOffset,
  digest,
  latestRows,
  latestStamp,
  planPush,
  readPushAnswer,
  retryDelay,
  summarize,
} from "../src/lib/desk-sync.mjs";

const at = (s) => Date.parse(`2026-11-24T12:00:${String(s).padStart(2, "0")}.000Z`);
const here = (entries) => new Map(entries.map(([id, hash, t = 0, del]) => [id, { hash, t: at(t), ...(del ? { del } : {}) }]));
const base = (entries) => new Map(entries.map((e) => [e.id, e]));

/* ── Digests ─────────────────────────────────────────────────────────── */

test("a digest is the same whatever order a client wrote the fields in, and differs when a field does", async () => {
  const one = await digest({ id: "a", kind: "note", body: "words", labels: ["x", "y"], nested: { b: 1, a: 2 } });
  const two = await digest({ nested: { a: 2, b: 1 }, labels: ["x", "y"], body: "words", kind: "note", id: "a" });
  assert.equal(one, two);
  assert.match(one, /^[A-Za-z0-9_-]{22}$/, "16 bytes, base64url");
  assert.notEqual(one, await digest({ id: "a", kind: "note", body: "word", labels: ["x", "y"], nested: { b: 1, a: 2 } }));
  assert.notEqual(one, await digest({ id: "a", kind: "note", body: "words", labels: ["y", "x"], nested: { b: 1, a: 2 } }), "a list's order is part of it");
});

test("a summary carries when the record was written, and what a trash record deleted", async () => {
  const note = await summarize({ id: "n", kind: "note", modified: "2026-11-24T12:00:05.000Z" });
  assert.equal(note.t, at(5));
  assert.equal(note.del, undefined);
  const trash = await summarize({ id: "t", kind: "trash", deletedId: "n", modified: "2026-11-24T12:00:06.000Z" });
  assert.equal(trash.del, "n");
  assert.equal((await summarize({ id: "x", kind: "note", modified: "not a time" })).t, -Infinity);
});

test("the latest stamp reads every time the merge's clamp reads", () => {
  assert.equal(latestStamp({ kind: "note", modified: "2026-11-24T12:00:05.000Z" }), at(5));
  assert.equal(
    latestStamp({ kind: "trash", modified: "2026-11-24T12:00:05.000Z", deletedAt: "2026-11-24T12:00:09.000Z", record: { modified: "2026-11-24T12:00:07.000Z" } }),
    at(9),
  );
  assert.equal(latestStamp({ kind: "trash", modified: "2026-11-24T12:00:05.000Z", deletedAt: "2026-11-24T12:00:04.000Z", record: { modified: "2026-11-24T12:00:30.000Z" } }), at(30));
  assert.equal(latestStamp({ kind: "bookmark", modified: "2026-11-24T12:00:05.000Z", placedAt: "2026-11-24T12:00:20.000Z", editedAt: "2026-11-24T12:00:01.000Z" }), at(20));
});

test("of several rows for one id, the one with the highest revision is read", () => {
  const rows = latestRows([
    { id: "a", rev: 3 },
    { id: "b", rev: 9 },
    { id: "a", rev: 7 },
    { id: "a", rev: 5 },
  ]);
  assert.deepEqual(rows, [
    { id: "a", rev: 7 },
    { id: "b", rev: 9 },
  ]);
});

/* ── What is owed ────────────────────────────────────────────────────── */

test("a record is owed when it is new or no longer matches its entry, oldest writing first", () => {
  const plan = planPush(
    here([
      ["new", "h1", 30],
      ["same", "h2", 1],
      ["edited", "h3b", 10],
      ["tie-b", "h4", 20],
      ["tie-a", "h5", 20],
    ]),
    base([
      { id: "same", rev: 4, hash: "h2" },
      { id: "edited", rev: 5, hash: "h3" },
    ]),
  );
  assert.deepEqual(plan.put, [
    { id: "edited", rev: 5 },
    { id: "tie-a", rev: 0 },
    { id: "tie-b", rev: 0 },
    { id: "new", rev: 0 },
  ]);
  assert.deepEqual(plan.remove, []);
});

test("an entry with no hash means whatever is here is owed", () => {
  const plan = planPush(here([["n", "h", 1]]), base([{ id: "n", rev: 7, hash: null }]));
  assert.deepEqual(plan.put, [{ id: "n", rev: 7 }]);
});

test("nothing is pushed for a row kept aside or ahead, and the change that waits is counted", () => {
  const plan = planPush(
    here([
      ["aside-same", "h1"],
      ["aside-edited", "h2b"],
      ["ahead-edited", "h3b"],
    ]),
    base([
      { id: "aside-same", rev: 3, hash: "h1", held: "aside" },
      { id: "aside-edited", rev: 4, hash: "h2", held: "aside" },
      { id: "ahead-edited", rev: 5, hash: "h3", held: "ahead" },
      { id: "aside-gone", rev: 6, hash: null, held: "aside" },
    ]),
  );
  assert.deepEqual(plan.put, []);
  assert.deepEqual(plan.remove, []);
  assert.deepEqual(plan.missing, [], "a row this device never read is not a record it lost");
  assert.equal(plan.blocked, 2);
});

test("a row that couldn't be read is not pushed over by the copy here, until that copy changes", () => {
  const entries = base([{ id: "n", rev: 3, hash: "h", held: "skip" }]);
  assert.deepEqual(planPush(here([["n", "h"]]), entries).put, []);
  assert.deepEqual(planPush(here([["n", "h2"]]), entries).put, [{ id: "n", rev: 3 }]);
});

test("a copy the service refused is not sent again until it changes", () => {
  const entries = base([{ id: "n", rev: 0, hash: null, stuck: { hash: "h", why: "refused:deletedAt" } }]);
  const plan = planPush(here([["n", "h"]]), entries);
  assert.deepEqual(plan.put, []);
  assert.equal(plan.stuck, 1);
  assert.deepEqual(planPush(here([["n", "h2"]]), entries).put, [{ id: "n", rev: 0 }]);
});

/* ── Removal, on evidence ────────────────────────────────────────────── */

test("a deleted record's row is removed only once its trash record is on the service", () => {
  const local = here([["t", "ht", 5, "n"]]);
  // The trash record hasn't gone up: it is put, and the removal waits for the next plan.
  let plan = planPush(local, base([{ id: "n", rev: 3, hash: "hn" }]));
  assert.deepEqual(plan.put, [{ id: "t", rev: 0 }]);
  assert.deepEqual(plan.remove, []);
  assert.equal(plan.waiting, 1);
  // It has.
  plan = planPush(
    local,
    base([
      { id: "n", rev: 3, hash: "hn" },
      { id: "t", rev: 4, hash: "ht", del: "n" },
    ]),
  );
  assert.deepEqual(plan.put, []);
  assert.deepEqual(plan.remove, [{ id: "n", rev: 3 }]);
  assert.equal(plan.waiting, 0);
});

test("a removal whose trash record can't go up waits with it, and is not counted as pending", () => {
  const local = here([["t", "ht", 5, "n"]]);
  const plan = planPush(
    local,
    base([
      { id: "n", rev: 3, hash: "hn" },
      { id: "t", rev: 0, hash: null, stuck: { hash: "ht", why: "refused:deletedAt" } },
    ]),
  );
  assert.deepEqual(plan.remove, []);
  assert.equal(plan.waiting, 0);
  assert.equal(plan.stuck, 1);
  assert.deepEqual(plan.missing, []);
});

test("a restored record's trash row is removed once the record is back on the service", () => {
  const local = here([["n", "hn2", 9]]);
  let plan = planPush(local, base([{ id: "t", rev: 4, hash: "ht", del: "n" }]));
  assert.deepEqual(plan.put, [{ id: "n", rev: 0 }]);
  assert.deepEqual(plan.remove, []);
  assert.equal(plan.waiting, 1);
  plan = planPush(
    local,
    base([
      { id: "t", rev: 4, hash: "ht", del: "n" },
      { id: "n", rev: 5, hash: "hn2" },
    ]),
  );
  assert.deepEqual(plan.remove, [{ id: "t", rev: 4 }]);
});

test("a trash record that collapsed into another is removed once the other is on the service", () => {
  const plan = planPush(
    here([["t1", "h1", 5, "n"]]),
    base([
      { id: "t1", rev: 6, hash: "h1", del: "n" },
      { id: "t2", rev: 7, hash: "h2", del: "n" },
    ]),
  );
  assert.deepEqual(plan.remove, [{ id: "t2", rev: 7 }]);
});

test("a record that is simply gone is never removed from the service: it is reported missing", () => {
  const plan = planPush(
    here([]),
    base([
      { id: "n", rev: 3, hash: "hn" },
      { id: "t", rev: 4, hash: "ht", del: "other" },
      { id: "never", rev: 0, hash: null },
      { id: "unread", rev: 5, hash: null, held: "skip" },
    ]),
  );
  assert.deepEqual(plan.remove, []);
  assert.deepEqual(plan.missing.sort(), ["n", "t"]);
  assert.deepEqual(plan.forget, ["never"], "an entry with nothing on either side goes");
});

test("a deletion here is no evidence against a row whose trash record is kept aside", () => {
  const plan = planPush(
    here([["t", "ht", 5, "n"]]),
    base([
      { id: "n", rev: 3, hash: "hn" },
      { id: "t", rev: 4, hash: "ht", del: "n", held: "aside" },
    ]),
  );
  assert.deepEqual(plan.remove, [], "the trash record's row isn't known to hold what this device holds");
});

/* ── Requests ────────────────────────────────────────────────────────── */

test("rows are split into requests of at most 500, and within the room a body has", () => {
  const many = Array.from({ length: 1203 }, (_, i) => ({ i }));
  assert.deepEqual(
    batches(many, () => 100).map((b) => b.length),
    [MAX_ROWS, MAX_ROWS, 203],
  );
  const big = Array.from({ length: 7 }, (_, i) => ({ i }));
  assert.deepEqual(
    batches(big, () => 1_400_000).map((b) => b.length),
    [2, 2, 2, 1],
  );
  assert.ok(2 * 1_400_000 <= BODY_BUDGET && 3 * 1_400_000 > BODY_BUDGET);
  assert.deepEqual(
    batches([{ i: 0 }], () => BODY_BUDGET * 2).map((b) => b.length),
    [1],
    "one row is always sent",
  );
  assert.deepEqual(batches([], () => 1), []);
  assert.ok(BODY_BUDGET < 4_194_304, "the budget leaves room inside the service's limit for the rest of the body");
});

test("a push's answer is read row by row, in the order sent", () => {
  const sent = { put: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }], remove: [{ id: "e" }, { id: "f" }, { id: "g" }] };
  const row = { id: "c", rev: 9 };
  const read = readPushAnswer(sent, {
    put: [{ id: "a", rev: 12 }, { id: "b", refused: "deletedAt" }, { id: "c", conflict: "changed", row }, { id: "d", conflict: "gone" }],
    remove: [{ id: "e", removed: true }, { id: "f", conflict: "changed" }, { id: "g", conflict: "changed", row: { id: "g", rev: 4 } }],
  });
  assert.deepEqual(read, [
    { id: "a", did: "stored", rev: 12 },
    { id: "b", did: "refused", why: "deletedAt" },
    { id: "c", did: "changed", row },
    { id: "d", did: "gone" },
    { id: "e", did: "removed" },
    { id: "f", did: "changed" },
    { id: "g", did: "changed", row: { id: "g", rev: 4 } },
  ]);
});

test("an answer that isn't the interface's is an error, never read as stored", () => {
  const sent = { put: [{ id: "a" }], remove: [{ id: "b" }] };
  assert.throws(() => readPushAnswer(sent, { put: [], remove: [{ id: "b", removed: true }] }), /a different number of rows/);
  assert.throws(() => readPushAnswer(sent, { put: [{ id: "a" }], remove: [{ id: "b", removed: true }] }), /not one the interface gives/);
  assert.throws(() => readPushAnswer(sent, { put: [{ id: "a", rev: 0 }], remove: [{ id: "b", removed: true }] }), /not one the interface gives/);
  assert.throws(() => readPushAnswer(sent, { put: [{ id: "a", rev: 3 }], remove: [{ id: "b" }] }), /not one the interface gives/);
  assert.throws(() => readPushAnswer(sent, null), /a different number of rows/);
});

/* ── Waiting, and the clock ──────────────────────────────────────────── */

test("the wait after a failure starts at five seconds and doubles to five minutes", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 50].map(retryDelay),
    [5_000, 5_000, 10_000, 20_000, 40_000, 80_000, 160_000, 300_000, 300_000, 300_000],
  );
});

test("the clock's offset is this device's time less the service's, or nothing when the service sent no time", () => {
  assert.equal(clockOffset("2026-11-24T12:00:00.000Z", at(30)), 30_000);
  assert.equal(clockOffset("2026-11-24T12:00:45.000Z", at(30)), -15_000);
  assert.equal(clockOffset(undefined, at(30)), null);
  assert.equal(clockOffset("soon", at(30)), null);
});
