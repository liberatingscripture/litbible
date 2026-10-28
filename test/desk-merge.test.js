// test/desk-merge.test.js
//
// src/lib/desk-merge.mjs: merging two copies of a reader's notebook. The
// vectors in test/fixtures/merge-vectors.json are shared with the two apps, so
// they carry the rules (a, b, c, the trash collapse, principle 6); the tests
// below them check the properties the rules add up to: the result doesn't
// depend on input order, merging twice writes nothing, and two copies merging
// into each other end alike.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { mergeRecords, mergeSets } from "../src/lib/desk-merge.mjs";
import { planWrite } from "../src/lib/desk-store-core.mjs";

const vectors = JSON.parse(readFileSync(new URL("./fixtures/merge-vectors.json", import.meta.url), "utf8"));
const clone = (x) => JSON.parse(JSON.stringify(x));
/** A case's options: its `now`, and the arriving copy's `exported` time when it gives one. */
const opts = (c) => ({ now: c.now, ...(c.exported ? { exported: c.exported } : {}) });

/** What the store holds once a plan has been committed. */
function apply(local, plan) {
  const gone = new Set(plan.remove);
  const held = new Map(local.filter((r) => !gone.has(r.id)).map((r) => [r.id, r]));
  for (const r of plan.put) held.set(r.id, r);
  return [...held.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** A fixed pseudo-random shuffle, so a failure can be repeated. */
function shuffled(items, seed) {
  const out = [...items];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

test("the vectors are well formed", () => {
  assert.equal(vectors.version, 2);
  assert.ok(vectors.cases.length >= 15);
  const names = vectors.cases.map((c) => c.name);
  assert.equal(new Set(names).size, names.length, "case names are unique");
  for (const c of vectors.cases) {
    assert.ok(["a", "b", "c", "collapse", "keep", "clamp", "skip"].includes(c.rule), `${c.name}: rule`);
    assert.deepEqual(
      c.expect.map((r) => r.id),
      c.expect.map((r) => r.id).sort(),
      `${c.name}: expect is sorted by id`,
    );
  }
});

for (const c of vectors.cases) {
  test(`vector ${c.name}: mergeSets`, () => {
    assert.deepEqual(mergeSets(clone(c.local), clone(c.incoming), opts(c)), c.expect);
  });

  test(`vector ${c.name}: mergeRecords`, () => {
    const local = clone(c.local);
    const plan = mergeRecords(local, clone(c.incoming), opts(c));
    assert.deepEqual(apply(local, plan), c.expect);
    assert.equal(plan.skipped.length, c.skipped ?? 0);
    for (const s of plan.skipped) assert.ok(typeof s.reason === "string" && s.reason.endsWith("."), `${c.name}: reason is a sentence`);
    // Only what is new or changed is put, and only what went is removed.
    const before = new Map(local.map((r) => [r.id, JSON.stringify(r)]));
    for (const r of plan.put) assert.notEqual(before.get(r.id), JSON.stringify(r), `${c.name}: ${r.id} is unchanged`);
    for (const id of plan.remove) assert.ok(before.has(id), `${c.name}: ${id} wasn't local`);
    // The store accepts it.
    assert.doesNotThrow(() => planWrite(plan), c.name);
  });

  test(`vector ${c.name}: input order doesn't matter`, () => {
    for (const seed of [1, 2, 3]) {
      const got = mergeSets(shuffled(clone(c.local), seed), shuffled(clone(c.incoming), seed + 10), opts(c));
      assert.deepEqual(got, c.expect);
    }
  });

  test(`vector ${c.name}: merging the same records again writes nothing`, () => {
    const merged = mergeSets(clone(c.local), clone(c.incoming), opts(c));
    const again = mergeRecords(merged, clone(c.incoming), opts(c));
    assert.deepEqual(again.put, []);
    assert.deepEqual(again.remove, []);
    const once = mergeRecords(clone(c.local), clone(c.incoming), opts(c));
    const next = mergeRecords(apply(clone(c.local), once), clone(c.incoming), opts(c));
    assert.deepEqual({ put: next.put, remove: next.remove }, { put: [], remove: [] });
  });
}

// Merging A into B and B into A end alike. The rules name three one-sided
// places: the local copy staying on an exact tie, clamping, and skipping, plus
// migrating, which is done to arriving records only.
const ONE_SIDED = new Set([
  "a-same-instant-written-two-ways-keeps-local",
  "a-exact-tie-keeps-local",
  "keep-older-trash-record-takes-its-deletedKind-from-what-it-holds",
]);
for (const c of vectors.cases.filter((c) => !["clamp", "skip"].includes(c.rule) && !ONE_SIDED.has(c.name))) {
  test(`vector ${c.name}: A into B equals B into A`, () => {
    const ab = mergeSets(clone(c.local), clone(c.incoming), opts(c));
    const ba = mergeSets(clone(c.incoming), clone(c.local), opts(c));
    assert.deepEqual(ba, ab);
  });
}

test("copies that each saw the other's writes converge, three at a time", () => {
  // Three devices, each holding some of the same history; any order of meeting ends alike.
  const pool = vectors.cases
    .filter((c) => c.rule === "collapse" || c.rule === "b" || c.rule === "c")
    .map((c) => ({ now: c.now, records: [...c.local, ...c.incoming] }))
    .filter((p) => p.now === vectors.cases[0].now);
  for (const { records } of pool) {
    const one = records.filter((_, i) => i % 3 === 0);
    const two = records.filter((_, i) => i % 3 === 1);
    const three = records.filter((_, i) => i % 3 === 2);
    const now = vectors.cases[0].now;
    const m = (x, y) => mergeSets(clone(x), clone(y), { now });
    const left = m(m(one, two), three);
    const right = m(one, m(two, three));
    const other = m(three, m(two, one));
    assert.deepEqual(right, left);
    assert.deepEqual(other, left);
  }
});

/* ── Ties and the clock ──────────────────────────────────────────────── */

const note = (over = {}) => ({
  id: "n1", kind: "note", schema: 1, created: "2026-10-01T09:00:00.000Z", modified: "2026-10-10T09:00:00.000Z",
  client: "web/2026.10", contentVersion: "v20261012.1a2b3c4d", labels: [],
  bookKey: "john", chapter: 3, verse: 16, body: "x", marker: "note", ...over,
});
const NOW = "2026-10-12T12:00:00.000Z";

test("a tiebreak decides an exact tie: positive keeps local, negative takes incoming, zero keeps local", () => {
  const local = note({ body: "local" });
  const incoming = note({ body: "incoming" });
  const seen = [];
  const take = (v) => (l, i) => (seen.push([l.body, i.body]), v);
  assert.equal(mergeSets([local], [incoming], { now: NOW, tiebreak: take(1) })[0].body, "local");
  assert.equal(mergeSets([local], [incoming], { now: NOW, tiebreak: take(-1) })[0].body, "incoming");
  assert.equal(mergeSets([local], [incoming], { now: NOW, tiebreak: take(0) })[0].body, "local");
  assert.deepEqual(seen, [["local", "incoming"], ["local", "incoming"], ["local", "incoming"]]);
  const plan = mergeRecords([local], [incoming], { now: NOW, tiebreak: () => -1 });
  assert.deepEqual(plan.put.map((r) => r.body), ["incoming"]);
});

test("a tiebreak is not asked when one copy is newer", () => {
  const plan = mergeRecords([note({ modified: "2026-10-09T09:00:00.000Z" })], [note({ body: "newer" })], {
    now: NOW,
    tiebreak: () => assert.fail("asked"),
  });
  assert.equal(plan.put[0].body, "newer");
});

test("the tiebreak does not decide anything between a record and its trash", () => {
  const live = note({ modified: "2026-10-05T09:00:00.000Z" });
  const trash = {
    id: "t1", kind: "trash", schema: 1, created: "2026-10-05T09:00:00.000Z", modified: "2026-10-05T09:00:00.000Z",
    client: "web/2026.10", contentVersion: "v20261012.1a2b3c4d", labels: [],
    deletedId: "n1", deletedKind: "note", deletedAt: "2026-10-05T09:00:00.000Z", record: live,
  };
  const got = mergeSets([live], [trash], { now: NOW, tiebreak: () => 1 });
  assert.deepEqual(got, [trash]);
});

test("now defaults to the clock", () => {
  const future = new Date(Date.now() + 86_400_000 * 40).toISOString();
  const [kept] = mergeSets([], [note({ modified: future })]);
  assert.ok(Date.parse(kept.modified) <= Date.now());
  assert.ok(Date.parse(kept.modified) > Date.now() - 60_000);
});

test("a now that isn't a time is refused rather than clamping everything to nothing", () => {
  assert.throws(() => mergeSets([], [note()], { now: "later" }), /not a time/);
});

test("nothing in the inputs is changed", () => {
  const local = [note({ body: "a" })];
  const incoming = [note({ modified: "2099-01-01T00:00:00.000Z", body: "b" })];
  const before = JSON.stringify([local, incoming]);
  mergeRecords(local, incoming, { now: NOW });
  mergeSets(local, incoming, { now: NOW });
  assert.equal(JSON.stringify([local, incoming]), before);
});

test("an empty or missing side is fine", () => {
  assert.deepEqual(mergeSets([], []), []);
  assert.deepEqual(mergeSets(undefined, undefined), []);
  const plan = mergeRecords([note()], [], { now: NOW });
  assert.deepEqual({ put: plan.put, remove: plan.remove, skipped: plan.skipped }, { put: [], remove: [], skipped: [] });
});

test("a trash record already in the notebook is emptied when its 30 days pass, even with nothing arriving", () => {
  const trash = {
    id: "t1", kind: "trash", schema: 1, created: "2026-08-01T09:00:00.000Z", modified: "2026-08-01T09:00:00.000Z",
    client: "web/2026.10", contentVersion: "v20261012.1a2b3c4d", labels: [],
    deletedId: "n1", deletedKind: "note", deletedAt: "2026-08-01T09:00:00.000Z", record: note(),
  };
  const plan = mergeRecords([trash], [], { now: NOW });
  assert.equal(plan.put.length, 1);
  assert.ok(!("record" in plan.put[0]));
  assert.equal(plan.put[0].modified, trash.modified);
});

test("a removed trash record is named in remove, and so is a record that was deleted", () => {
  const live = note({ modified: "2026-10-08T09:00:00.000Z" });
  const trash = {
    id: "t1", kind: "trash", schema: 1, created: "2026-10-05T09:00:00.000Z", modified: "2026-10-05T09:00:00.000Z",
    client: "web/2026.10", contentVersion: "v20261012.1a2b3c4d", labels: [],
    deletedId: "n1", deletedKind: "note", deletedAt: "2026-10-05T09:00:00.000Z", record: note({ modified: "2026-10-03T09:00:00.000Z" }),
  };
  assert.deepEqual(mergeRecords([trash], [live], { now: NOW }).remove, ["t1"]);
  const early = note({ modified: "2026-10-04T09:00:00.000Z" });
  assert.deepEqual(mergeRecords([early], [trash], { now: NOW }).remove, ["n1"]);
});

/* ── A clock running ahead (BA4, BA12) ───────────────────────────────── */

const day = (n) => `2026-10-${String(n).padStart(2, "0")}T12:00:00.000Z`;
const fast = note({ modified: "2026-10-20T09:00:00.000Z", body: "from a clock eight days fast" });

test("a file from a fast clock, opened again after an edit here, leaves the edit (BA4)", () => {
  const first = mergeRecords([], [fast], { now: day(12) });
  assert.equal(first.put[0].modified, day(12));
  const edited = [{ ...first.put[0], modified: day(13), body: "edited here the next day" }];
  const again = mergeRecords(edited, [fast], { now: day(14) });
  assert.deepEqual({ put: again.put, remove: again.remove }, { put: [], remove: [] });
  assert.deepEqual(again.ahead.map((a) => a.written), [false]);
});

test("a file from a fast clock, opened again after a deletion here, doesn't bring the record back (BA4)", () => {
  const first = mergeRecords([], [fast], { now: day(12) });
  const trash = {
    id: "t1", kind: "trash", schema: 1, created: day(13), modified: day(13), client: "web/2026.10",
    contentVersion: "v20261012.1a2b3c4d", labels: [], deletedId: "n1", deletedKind: "note", deletedAt: day(13), record: first.put[0],
  };
  const again = mergeRecords([trash], [fast], { now: day(14) });
  assert.deepEqual({ put: again.put, remove: again.remove }, { put: [], remove: [] });
});

test("a deletion from a fast clock, opened again after an undo here, doesn't delete again (BA4)", () => {
  const trash = {
    id: "t1", kind: "trash", schema: 1, created: "2026-10-20T09:00:00.000Z", modified: "2026-10-20T09:00:00.000Z",
    client: "web/2026.10", contentVersion: "v20261012.1a2b3c4d", labels: [], deletedId: "n1", deletedKind: "note",
    deletedAt: "2026-10-20T09:00:00.000Z", record: note(),
  };
  // Nothing here for it, so the deletion is taken, at the cap.
  const first = mergeRecords([], [trash], { now: day(12) });
  assert.equal(first.put[0].deletedAt, day(12));
  // Undone here the next day: the note is back, newer than the deletion.
  const undone = [note({ modified: day(13), body: "back" })];
  const again = mergeRecords(undone, [trash], { now: day(14) });
  assert.deepEqual({ put: again.put, remove: again.remove }, { put: [], remove: [] });
});

test("an export file's own time caps its records, so opening it on any later day writes the same thing", () => {
  const exported = "2026-10-11T08:00:00.000Z";
  const late = note({ modified: "2026-10-11T09:00:00.000Z", body: "an hour after the file" });
  const a = mergeSets([], [late], { now: day(12), exported });
  const b = mergeSets([], [late], { now: day(20), exported });
  assert.deepEqual(a, b);
  assert.equal(a[0].modified, exported);
});

test("ahead lists every arriving record that ran past the cap, written or not, and nothing else", () => {
  const plan = mergeRecords([note({ id: "n2" })], [fast, note({ id: "n2", modified: "2099-01-01T00:00:00.000Z" }), note({ id: "n3" })], { now: day(12) });
  assert.deepEqual(
    plan.ahead.map((a) => [a.record.id, a.written]).sort(),
    [["n1", true], ["n2", false]],
  );
  // The record reported is the one that arrived, unclamped.
  assert.equal(plan.ahead.find((a) => a.record.id === "n2").record.modified, "2099-01-01T00:00:00.000Z");
});

test("an exported time that isn't a time is ignored, and now caps alone", () => {
  assert.equal(mergeSets([], [fast], { now: day(12), exported: "yesterday" })[0].modified, day(12));
});
