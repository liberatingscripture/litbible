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
  assert.equal(vectors.version, 4);
  assert.ok(vectors.cases.length >= 15);
  const names = vectors.cases.map((c) => c.name);
  assert.equal(new Set(names).size, names.length, "case names are unique");
  for (const c of vectors.cases) {
    assert.ok(["a", "b", "c", "collapse", "keep", "clamp", "skip", "migrate"].includes(c.rule), `${c.name}: rule`);
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
// A migrate case changes the shape of what arrives, never of what is local.
for (const c of vectors.cases) if (c.rule === "migrate") ONE_SIDED.add(c.name);
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
  assert.ok(Date.parse(kept.modified) > Date.now() - 600_000);
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

/* ── Audit 2: DI-3, DI-8, DI-10, DI-12 ───────────────────────────────── */

import { editRecord as editForAudit2, restoreFromTrash as restoreForAudit2, trashRecord as trashForAudit2, createRecord as createForAudit2, validateRecord as validateForAudit2, MAX_NOTE_BODY } from "../src/lib/desk-records.mjs";

const A2 = { client: "web/test", contentVersion: "v20261005.5d2c847d" };
const A2_NOW = "2026-11-04T12:00:00.000Z";
const a2note = (body, modified, id = "00000000-0000-4000-8000-0000000000a1") => ({
  ...createForAudit2("note", { bookKey: "john", chapter: 3, verse: 16, body, marker: "note" }, { ...A2, now: "2026-11-01T00:00:00.000Z", id }),
  modified,
});

test("two copies of one trash id converge on the newer held words, whichever side is local (DI-3)", () => {
  const first = a2note("first words", "2026-11-01T00:00:00.000Z");
  const newest = a2note("my newest words", "2026-11-02T00:00:00.000Z");
  const deletedAt = "2026-11-03T00:00:00.000Z";
  // The same trash id and the same `modified`, holding different words: the tie that diverged for ever.
  const x = { ...trashForAudit2(first, { ...A2, now: deletedAt, id: "00000000-0000-4000-8000-0000000000b1" }), record: newest };
  const y = { ...trashForAudit2(first, { ...A2, now: deletedAt, id: "00000000-0000-4000-8000-0000000000b1" }) };
  const xIntoY = mergeSets([y], [x], { now: A2_NOW });
  const yIntoX = mergeSets([x], [y], { now: A2_NOW });
  assert.deepEqual(xIntoY, yIntoX);
  assert.equal(xIntoY.find((r) => r.kind === "trash").record.body, "my newest words");
});

test("an edit a few seconds ahead of this clock is not dropped as ahead (DI-8)", () => {
  const held = a2note("old", "2026-11-04T11:00:00.000Z");
  const edit = a2note("new", "2026-11-04T12:00:02.000Z");
  const out = mergeRecords([held], [edit], { now: A2_NOW });
  assert.equal(out.ahead.length, 0);
  assert.equal(out.put[0].body, "new");
  const far = a2note("new", "2026-11-04T13:00:00.000Z");
  assert.equal(mergeRecords([held], [far], { now: A2_NOW }).ahead.length, 1);
});

test("an edit always outranks the version it was made over, even on a clock running behind (DI-8)", () => {
  const record = a2note("x", "2026-11-04T12:00:00.000Z");
  const edited = editForAudit2(record, { body: "y" }, { now: "2026-11-04T11:59:58.000Z" });
  assert.equal(edited.modified, "2026-11-04T12:00:00.001Z");
  const restored = restoreForAudit2(trashForAudit2(record, { ...A2, now: "2026-11-04T12:00:00.000Z" }), { now: "2026-11-04T11:00:00.000Z" });
  assert.equal(restored.modified, "2026-11-04T12:00:00.001Z");
});

test("a file's `exported` time with an offset caps in the format's own form (DI-12)", () => {
  const local = [];
  const ahead = a2note("later than the file", "2026-11-04T09:00:00.000Z");
  const out = mergeRecords(local, [ahead], { now: A2_NOW, exported: "2026-11-04T01:00:00+00:00" });
  assert.equal(out.put[0].modified, "2026-11-04T01:00:00.000Z");
  assert.deepEqual(validateForAudit2(out.put[0]), []);
});

test("a trash record holding a record with another id is skipped, and never restored (DI-10)", () => {
  const mine = a2note("mine", "2026-11-01T00:00:00.000Z");
  const other = a2note("other", "2026-11-01T00:00:00.000Z", "00000000-0000-4000-8000-0000000000c1");
  const bad = { ...trashForAudit2(other, { ...A2, now: "2026-11-02T00:00:00.000Z" }), record: { ...mine, body: "overwritten" } };
  const out = mergeRecords([mine], [bad], { now: A2_NOW });
  assert.equal(out.skipped.length, 1);
  assert.deepEqual(out.put, []);
  assert.equal(restoreForAudit2(bad), null);
});

test("a note's words have a limit (SEC-6)", () => {
  const big = a2note("x".repeat(MAX_NOTE_BODY + 1), "2026-11-01T00:00:00.000Z");
  assert.match(validateForAudit2(big).join(";"), /too long/);
  assert.deepEqual(validateForAudit2(a2note("x".repeat(MAX_NOTE_BODY), "2026-11-01T00:00:00.000Z")), []);
});

test("three devices that create, edit, delete, restore and swap copies end with one notebook (DI-3, property)", () => {
  let seed = 20261104;
  const rnd = (n) => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed % n;
  };
  const BASE = Date.parse("2026-11-01T00:00:00.000Z");
  const iso = (tick) => new Date(BASE + tick * 1000).toISOString();
  const sameSet = (p, q) => JSON.stringify(p) === JSON.stringify(q);

  for (let history = 0; history < 4000; history++) {
    let tick = 0;
    const devices = [[], [], []];
    let ids = 0;
    for (let step = 0; step < 24; step++) {
      tick++;
      const d = rnd(3);
      const mine = devices[d];
      const live = mine.filter((r) => r.kind === "note");
      const trashed = mine.filter((r) => r.kind === "trash" && r.record);
      const op = rnd(5);
      if (op === 0 || (!live.length && !trashed.length)) {
        const id = `00000000-0000-4000-8000-${String(++ids).padStart(12, "0")}`;
        mine.push(a2note(`words ${tick}`, iso(tick), id));
      } else if (op === 1 && live.length) {
        const r = live[rnd(live.length)];
        mine.splice(mine.indexOf(r), 1, editForAudit2(r, { body: `edit ${tick}` }, { now: iso(tick) }));
      } else if (op === 2 && live.length) {
        const r = live[rnd(live.length)];
        mine.splice(mine.indexOf(r), 1, trashForAudit2(r, { ...A2, now: iso(tick), id: `00000000-0000-4000-8000-b${String(++ids).padStart(11, "0")}` }));
      } else if (op === 3 && trashed.length) {
        const t = trashed[rnd(trashed.length)];
        mine.splice(mine.indexOf(t), 1);
        mine.push(restoreForAudit2(t, { now: iso(tick) }));
      } else {
        const e = rnd(3);
        if (e !== d) {
          devices[d] = mergeSets(devices[d], devices[e], { now: iso(tick) });
          devices[e] = mergeSets(devices[e], devices[d], { now: iso(tick) });
        }
      }
    }
    // Everyone swaps with everyone until nothing changes.
    for (let round = 0; round < 4; round++) {
      for (const i of [0, 1, 2]) for (const j of [0, 1, 2]) if (i !== j) devices[i] = mergeSets(devices[i], devices[j], { now: iso(tick + 1) });
    }
    const [x, y, z] = devices.map((s) => [...s].sort((p, q) => (p.id < q.id ? -1 : 1)));
    assert.ok(sameSet(x, y) && sameSet(y, z), `history ${history} ended with different notebooks`);
  }
});
