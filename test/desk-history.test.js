// test/desk-history.test.js
//
// src/lib/desk-history.mjs: what a change leaves behind so Ctrl+Z can take it
// back, and when it may. The shell (src/scripts/desk/history.js) and the store
// (src/scripts/desk/store.js) are thin around these, so the cases that matter
// are here: what an undo and a redo write, what counts as overtaken, and what
// the bar says. A small in-memory notebook at the top runs the real planners
// (planSave, planDelete, planHighlight) through the same steps the browser's
// store and history take.

import { test } from "node:test";
import assert from "node:assert/strict";

import { assembleChapter } from "../src/lib/anchor-core.mjs";
import {
  HISTORY_LIMIT,
  describeEntry,
  inversePlan,
  isNoop,
  lowerFirst,
  makeEntry,
  pushEntry,
  redoPlan,
  stillCurrent,
} from "../src/lib/desk-history.mjs";
import { placeHighlights, planHighlight } from "../src/lib/desk-highlights.mjs";
import { createRecord } from "../src/lib/desk-records.mjs";
import { liveRecords, planDelete, planSave, planUndo, planWrite } from "../src/lib/desk-store-core.mjs";

const VERSION = "v20261005.5d2c847d";
const T0 = "2026-10-05T12:00:00.000Z";
const T1 = "2026-10-09T08:00:00.000Z";
const T2 = "2026-10-09T08:05:00.000Z";
const T3 = "2026-10-09T08:10:00.000Z";
const ctx = { client: "web/2026.10", contentVersion: VERSION };

let n = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

function note(where, extra = {}) {
  return createRecord(
    "note",
    { body: "mine", marker: "note", ...where, ...extra },
    { ...ctx, now: T0, id: nextId() },
  );
}

/**
 * The browser's store, in memory: apply a plan the way store.js does (read what
 * the plan touches, write, make the entry) so a test can run the history's
 * steps over it.
 */
function notebook(records = []) {
  const held = new Map(records.map((r) => [r.id, r]));
  let seq = 0;
  const nb = {
    held,
    last: null,
    get: (id) => held.get(id) ?? null,
    apply(plan, { record = true } = {}) {
      const checked = planWrite(plan);
      const ids = [...new Set([...checked.put.map((r) => r.id), ...checked.remove])];
      const before = new Map(ids.map((id) => [id, held.get(id) ?? null]));
      for (const r of checked.put) held.set(r.id, structuredClone(r));
      for (const id of checked.remove) held.delete(id);
      if (record) {
        const entry = makeEntry(checked, before, `e${++seq}`);
        nb.last = isNoop(entry) ? null : entry;
      }
      return nb.last;
    },
    /** What history.js does to take an entry back or do it again: the entry, or null if it was overtaken. */
    step(entry, side, now) {
      const have = new Map(entry.after.map(({ id }) => [id, held.get(id) ?? null]));
      if (!stillCurrent(entry, have, side)) return null;
      const plan = (side === "undo" ? inversePlan : redoPlan)(entry, { now, client: ctx.client });
      nb.apply(plan, { record: false });
      return entry;
    },
  };
  return nb;
}

const stored = (nb, id) => nb.get(id);

/* ── Recording ───────────────────────────────────────────────────────── */

test("makeEntry keeps every touched record as it stood on each side, absent as null", () => {
  const old = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const edited = { ...old, body: "new", modified: T1 };
  const entry = makeEntry({ put: [edited], remove: [] }, new Map([[old.id, old]]), "e");
  assert.equal(entry.id, "e");
  assert.deepEqual(entry.before, [{ id: old.id, record: old }]);
  assert.deepEqual(entry.after, [{ id: old.id, record: edited }]);

  const fresh = note({ bookKey: "romans", chapter: 8, verse: 4 });
  const added = makeEntry({ put: [fresh], remove: [] }, new Map(), "e");
  assert.deepEqual(added.before, [{ id: fresh.id, record: null }]);
  assert.deepEqual(added.after, [{ id: fresh.id, record: fresh }]);
});

test("makeEntry keeps a copy, so a record changed afterwards does not rewrite history", () => {
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const entry = makeEntry({ put: [r], remove: [] }, new Map(), "e");
  r.body = "changed after";
  assert.equal(entry.after[0].record.body, "mine");
});

test("makeEntry covers a deletion: the trash record in, the live record out", () => {
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const plan = planDelete(r, { ...ctx, now: T1, id: nextId() });
  const entry = makeEntry(plan, new Map([[r.id, r]]), "e");
  assert.equal(entry.before.length, 2);
  assert.equal(entry.before.find((s) => s.id === r.id).record.body, "mine");
  assert.equal(entry.before.find((s) => s.id === plan.trash.id).record, null);
  assert.equal(entry.after.find((s) => s.id === r.id).record, null);
  assert.equal(entry.after.find((s) => s.id === plan.trash.id).record.deletedId, r.id);
});

test("makeEntry says a removal wins when a plan puts and removes one id, as the write does", () => {
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const entry = makeEntry({ put: [r], remove: [r.id] }, new Map([[r.id, r]]), "e");
  assert.equal(entry.after[0].record, null);
});

test("a change that leaves the notebook as it found it is a no-op", () => {
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  assert.equal(isNoop(makeEntry({ put: [r], remove: [] }, new Map([[r.id, structuredClone(r)]]), "e")), true);
  assert.equal(isNoop(makeEntry({ put: [{ ...r, body: "x" }], remove: [] }, new Map([[r.id, r]]), "e")), false);
  assert.equal(isNoop(makeEntry({ put: [r], remove: [] }, new Map(), "e")), false);
  // A touched stamp is not a change anyone made.
  assert.equal(isNoop(makeEntry({ put: [{ ...r, modified: T1 }], remove: [] }, new Map([[r.id, r]]), "e")), true);
});

test("pushEntry forgets the oldest past the limit and leaves the old stack alone", () => {
  assert.equal(HISTORY_LIMIT, 50);
  const stack = [{ id: "a" }, { id: "b" }];
  assert.deepEqual(pushEntry(stack, { id: "c" }, 3).map((e) => e.id), ["a", "b", "c"]);
  assert.deepEqual(pushEntry(stack, { id: "c" }, 2).map((e) => e.id), ["b", "c"]);
  assert.equal(stack.length, 2);
  let big = [];
  for (let i = 0; i < 60; i++) big = pushEntry(big, { id: `e${i}` });
  assert.equal(big.length, 50);
  assert.equal(big[0].id, "e10");
});

/* ── The writes ──────────────────────────────────────────────────────── */

test("inversePlan removes what was absent and puts back the rest, stamped as the reader's act", () => {
  const old = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const edit = makeEntry({ put: [{ ...old, body: "new", modified: T1 }], remove: [] }, new Map([[old.id, old]]), "e");
  const undo = inversePlan(edit, { now: T2, client: "web/2026.11" });
  assert.deepEqual(undo.remove, []);
  assert.equal(undo.put.length, 1);
  assert.equal(undo.put[0].body, "mine");
  assert.equal(undo.put[0].modified, T2);
  assert.equal(undo.put[0].client, "web/2026.11");
  assert.equal(undo.put[0].created, T0);

  const fresh = note({ bookKey: "romans", chapter: 8, verse: 4 });
  const add = makeEntry({ put: [fresh], remove: [] }, new Map(), "e");
  assert.deepEqual(inversePlan(add, { now: T2, client: ctx.client }), { put: [], remove: [fresh.id] });
});

test("inversePlan outranks the change it undoes under the newer-modified rule", () => {
  const old = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const edited = { ...old, body: "new", modified: T1 };
  const entry = makeEntry({ put: [edited], remove: [] }, new Map([[old.id, old]]), "e");
  const [back] = inversePlan(entry, { now: T2, client: ctx.client }).put;
  assert.ok(Date.parse(back.modified) > Date.parse(edited.modified));
});

test("inversePlan leaves the entry itself unchanged", () => {
  const old = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const entry = makeEntry({ put: [{ ...old, body: "new", modified: T1 }], remove: [] }, new Map([[old.id, old]]), "e");
  const copy = structuredClone(entry);
  inversePlan(entry, { now: T2, client: ctx.client });
  redoPlan(entry, { now: T2, client: ctx.client });
  assert.deepEqual(entry, copy);
});

test("undoing a deletion brings the record back stamped, and removes the trash record", () => {
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const plan = planDelete(r, { ...ctx, now: T1, id: nextId() });
  const entry = makeEntry(plan, new Map([[r.id, r]]), "e");
  const undo = inversePlan(entry, { now: T2, client: ctx.client });
  assert.deepEqual(undo.remove, [plan.trash.id]);
  assert.equal(undo.put.length, 1);
  assert.equal(undo.put[0].id, r.id);
  assert.equal(undo.put[0].modified, T2);
  assert.equal(undo.put[0].body, "mine");
});

test("redoing a deletion puts the trash record back exactly as it was", () => {
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const plan = planDelete(r, { ...ctx, now: T1, id: nextId() });
  const entry = makeEntry(plan, new Map([[r.id, r]]), "e");
  const redo = redoPlan(entry, { now: T3, client: "web/2026.11" });
  assert.deepEqual(redo.remove, [r.id]);
  assert.equal(redo.put.length, 1);
  assert.deepEqual(redo.put[0], plan.trash);
  assert.equal(redo.put[0].modified, T1);
});

test("redoPlan is inversePlan from the other side: it puts the edited note back, stamped", () => {
  const old = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const entry = makeEntry({ put: [{ ...old, body: "new", modified: T1 }], remove: [] }, new Map([[old.id, old]]), "e");
  const redo = redoPlan(entry, { now: T3, client: ctx.client });
  assert.equal(redo.put[0].body, "new");
  assert.equal(redo.put[0].modified, T3);
  const fresh = note({ bookKey: "romans", chapter: 8, verse: 4 });
  const add = makeEntry({ put: [fresh], remove: [] }, new Map(), "e");
  const again = redoPlan(add, { now: T3, client: ctx.client });
  assert.equal(again.put[0].id, fresh.id);
  assert.equal(again.put[0].modified, T3);
});

test("a record this code can't edit comes back exactly as it was, unstamped", () => {
  const newer = { ...note({ bookKey: "romans", chapter: 8, verse: 3 }), schema: 2, extra: { kept: true } };
  const plan = planDelete(newer, { ...ctx, now: T1, id: nextId() });
  const entry = makeEntry(plan, new Map([[newer.id, newer]]), "e");
  const undo = inversePlan(entry, { now: T2, client: ctx.client });
  assert.deepEqual(undo.put[0], newer);
  assert.equal(undo.put[0].modified, T0);
});

test("a missing clock or client is not invented: the clock is read, the client left as it was", () => {
  const old = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const entry = makeEntry({ put: [{ ...old, body: "new", modified: T1 }], remove: [] }, new Map([[old.id, old]]), "e");
  const [back] = inversePlan(entry).put;
  assert.ok(Date.parse(back.modified) > Date.parse(T1));
  assert.equal(back.client, old.client);
});

/* ── Whether the change may still be taken back ──────────────────────── */

test("stillCurrent holds while the notebook has what the entry left, in every record", () => {
  const old = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const edited = { ...old, body: "new", modified: T1 };
  const entry = makeEntry({ put: [edited], remove: [] }, new Map([[old.id, old]]), "e");
  assert.equal(stillCurrent(entry, new Map([[old.id, edited]]), "undo"), true);
  assert.equal(stillCurrent(entry, new Map([[old.id, edited]])), true, "undo is the default");
  assert.equal(stillCurrent(entry, new Map([[old.id, { ...edited, body: "newer" }]]), "undo"), false);
  assert.equal(stillCurrent(entry, new Map([[old.id, { ...edited, modified: T2 }]]), "undo"), true, "a stamp alone is not a change");
  assert.equal(stillCurrent(entry, new Map([[old.id, old]]), "undo"), false);
  assert.equal(stillCurrent(entry, new Map(), "undo"), false, "a record deleted since is overtaken");
});

test("stillCurrent for a redo asks for what the entry started from", () => {
  const old = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const entry = makeEntry({ put: [{ ...old, body: "new", modified: T1 }], remove: [] }, new Map([[old.id, old]]), "e");
  assert.equal(stillCurrent(entry, new Map([[old.id, old]]), "redo"), true);
  assert.equal(stillCurrent(entry, new Map([[old.id, { ...old, body: "else" }]]), "redo"), false);
});

test("stillCurrent treats an absent record as null, whatever shape the notebook is given in", () => {
  const fresh = note({ bookKey: "romans", chapter: 8, verse: 4 });
  const add = makeEntry({ put: [fresh], remove: [] }, new Map(), "e");
  // After the add the record is there; before it, absent.
  assert.equal(stillCurrent(add, new Map([[fresh.id, fresh]]), "undo"), true);
  assert.equal(stillCurrent(add, { [fresh.id]: fresh }, "undo"), true);
  assert.equal(stillCurrent(add, [{ id: fresh.id, record: fresh }], "undo"), true);
  assert.equal(stillCurrent(add, new Map(), "redo"), true);
  assert.equal(stillCurrent(add, new Map([[fresh.id, undefined]]), "redo"), true);
  assert.equal(stillCurrent(add, {}, "redo"), true);
  assert.equal(stillCurrent(add, [], "redo"), true);
  assert.equal(stillCurrent(add, new Map([[fresh.id, fresh]]), "redo"), false);
});

test("stillCurrent compares whole records: a stored undefined field is not a difference, a changed value is", () => {
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const entry = makeEntry({ put: [r], remove: [] }, new Map(), "e");
  assert.equal(stillCurrent(entry, new Map([[r.id, { ...r, extra: undefined }]]), "undo"), true);
  assert.equal(stillCurrent(entry, new Map([[r.id, { ...r, labels: ["x"] }]]), "undo"), false);
  assert.equal(stillCurrent(entry, new Map([[r.id, { ...r, extra: null }]]), "undo"), false);
});

test("stillCurrent ignores the stamp an undo or redo writes, and nothing else", () => {
  const old = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const edited = { ...old, body: "new", modified: T1 };
  const entry = makeEntry({ put: [edited], remove: [] }, new Map([[old.id, old]]), "e");
  // Restamped by a later undo of something above it: still what the entry left.
  assert.equal(stillCurrent(entry, new Map([[old.id, { ...edited, modified: T3, client: "web/2026.11" }]]), "undo"), true);
  // But any real difference, stamp or not, is a change.
  assert.equal(stillCurrent(entry, new Map([[old.id, { ...edited, modified: T3, body: "other" }]]), "undo"), false);
  assert.equal(stillCurrent(entry, new Map([[old.id, { ...edited, modified: T3, marker: "heart" }]]), "undo"), false);
  assert.equal(stillCurrent(entry, new Map([[old.id, { ...edited, modified: T3, verse: 4 }]]), "undo"), false);
});

test("stillCurrent needs every touched record to match, not just one", () => {
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const plan = planDelete(r, { ...ctx, now: T1, id: nextId() });
  const entry = makeEntry(plan, new Map([[r.id, r]]), "e");
  const now = new Map([
    [r.id, null],
    [plan.trash.id, plan.trash],
  ]);
  assert.equal(stillCurrent(entry, now, "undo"), true);
  // The trash was emptied by another tab (or the record put back by hand).
  assert.equal(stillCurrent(entry, new Map([[r.id, null]]), "undo"), false);
  assert.equal(stillCurrent(entry, new Map([[r.id, r], [plan.trash.id, plan.trash]]), "undo"), false);
});

test("stillCurrent refuses a side it doesn't know", () => {
  const entry = makeEntry({ put: [note({ bookKey: "romans", chapter: 8, verse: 3 })], remove: [] }, new Map(), "e");
  assert.throws(() => stillCurrent(entry, new Map(), "sideways"), /side/);
});

/* ── Undo and redo through the notebook, with the real planners ──────── */

test("a note: add, edit and delete each undo and redo, in order, and an undo is not a new change", () => {
  const nb = notebook();
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const added = (nb.apply(planSave(r)), nb.last);
  const edited = (nb.apply(planSave({ ...r, body: "second", modified: T1 })), nb.last);
  const trash = planDelete(nb.get(r.id), { ...ctx, now: T2, id: nextId() });
  const deleted = (nb.apply(trash), nb.last);
  assert.equal(nb.get(r.id), null);

  // Undo the deletion: the note is back with the second wording.
  const afterDelete = nb.step(deleted, "undo", T3);
  assert.equal(stored(nb, r.id).body, "second");
  assert.equal(stored(nb, trash.trash.id), null);
  assert.equal(nb.last, deleted, "the history's own write made no entry");

  // Then the edit, then the add.
  const afterEdit = nb.step(edited, "undo", "2026-10-09T09:00:00.000Z");
  assert.equal(stored(nb, r.id).body, "mine");
  const afterAdd = nb.step(added, "undo", "2026-10-09T09:01:00.000Z");
  assert.equal(stored(nb, r.id), null);

  // And redo them in the opposite order. Each undo restamped the note, and
  // none of that counts as the note having been changed under the next.
  assert.notEqual(nb.step(afterAdd, "redo", "2026-10-09T09:02:00.000Z"), null);
  assert.equal(stored(nb, r.id).body, "mine");
  assert.notEqual(nb.step(afterEdit, "redo", "2026-10-09T09:03:00.000Z"), null);
  assert.equal(stored(nb, r.id).body, "second");
  const redone = nb.step(afterDelete, "redo", "2026-10-09T09:04:00.000Z");
  assert.notEqual(redone, null);
  assert.equal(stored(nb, r.id), null);
  assert.deepEqual(stored(nb, trash.trash.id), trash.trash, "the trash record is exactly as deleted");
});

test("an entry can be undone, redone and undone again", () => {
  const nb = notebook();
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  nb.apply(planSave(r));
  const edit = (nb.apply(planSave({ ...r, body: "second", modified: T1 })), nb.last);
  nb.step(edit, "undo", T2);
  assert.equal(stored(nb, r.id).modified, T2, "undoing stamps the record as the reader's act");
  nb.step(edit, "redo", T3);
  assert.equal(stored(nb, r.id).body, "second");
  assert.equal(stored(nb, r.id).modified, T3);
  assert.notEqual(nb.step(edit, "undo", "2026-10-09T09:00:00.000Z"), null);
  assert.equal(stored(nb, r.id).body, "mine");
});

test("a change that was overtaken is not undone", () => {
  const nb = notebook();
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  nb.apply(planSave(r));
  const edit = (nb.apply(planSave({ ...r, body: "second", modified: T1 })), nb.last);
  // Another tab edits the same note again.
  nb.apply(planSave({ ...r, body: "third", modified: T2 }), { record: false });
  assert.equal(nb.step(edit, "undo", T3), null);
  assert.equal(stored(nb, r.id).body, "third");
});

test("a later change to the same note overtakes the earlier one, but not the later one", () => {
  const nb = notebook();
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const added = (nb.apply(planSave(r)), nb.last);
  const edit = (nb.apply(planSave({ ...r, body: "second", modified: T1 })), nb.last);
  assert.equal(nb.step(added, "undo", T2), null, "the add can't go while the edit stands on it");
  assert.notEqual(nb.step(edit, "undo", T2), null);
});

test("undoing an old change leaves the later changes to other records alone", () => {
  const nb = notebook();
  const a = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const b = note({ bookKey: "romans", chapter: 8, verse: 5 });
  const addA = (nb.apply(planSave(a)), nb.last);
  nb.apply(planSave(b));
  assert.notEqual(nb.step(addA, "undo", T2), null);
  assert.equal(stored(nb, a.id), null);
  assert.equal(stored(nb, b.id).body, "mine");
});

/* Highlights, through planHighlight. */

const V1 = "Love is patient, love is kind.";
const V2 = "It is not envious.";
const V3 = "It does not boast.";
const chapter = assembleChapter(
  new Map([
    [1, V1],
    [2, V2],
    [3, V3],
  ]),
);
const where = { bookKey: "1corinthians", chapter: 13 };
const range = (needle) => {
  const start = chapter.text.indexOf(needle);
  assert.notEqual(start, -1);
  return [start, start + needle.length];
};

function mark(nb, needle, color, now) {
  const [start, end] = range(needle);
  const placed = placeHighlights(chapter, [...nb.held.values()], VERSION);
  const plan = planHighlight({ chapter, placed, start, end, color, where, now, ctx });
  nb.apply(plan);
  return { plan, entry: nb.last };
}

const liveHighlights = (nb) => liveRecords([...nb.held.values()]).filter((r) => r.kind === "highlight");

test("a new highlight undoes to nothing and redoes", () => {
  const nb = notebook();
  const { entry } = mark(nb, "patient", "yellow", T1);
  assert.equal(liveHighlights(nb).length, 1);
  const undone = nb.step(entry, "undo", T2);
  assert.equal(liveHighlights(nb).length, 0);
  nb.step(undone, "redo", T3);
  assert.equal(liveHighlights(nb)[0].quote.exact, "patient");
});

test("a highlight that merges two and trims a third undoes in one step, restoring all of them", () => {
  const nb = notebook();
  mark(nb, "patient", "yellow", T1);
  mark(nb, "kind", "yellow", T1);
  mark(nb, "love is", "green", T1);
  const snapshotOf = () => [...nb.held.values()].filter((r) => r.kind !== "trash").map((r) => [r.id, r.quote?.exact, r.color]).sort();
  const before = snapshotOf();
  // One yellow mark across "patient, love is kind" joins the two yellows.
  const { entry } = mark(nb, "patient, love is kind", "yellow", T2);
  assert.notDeepEqual(snapshotOf(), before);
  assert.ok(entry.before.length >= 3, "the merge touched the survivor, the absorbed highlight and its trash");
  const undone = nb.step(entry, "undo", T3);
  assert.notEqual(undone, null);
  assert.deepEqual(snapshotOf(), before);
  assert.notEqual(nb.step(undone, "redo", "2026-10-09T09:00:00.000Z"), null);
  assert.equal(liveHighlights(nb).filter((h) => h.color === "yellow").length, 1);
});

test("removing a highlight undoes and its trash record goes with it", () => {
  const nb = notebook();
  mark(nb, "patient", "yellow", T1);
  const { entry } = mark(nb, "patient", null, T2);
  assert.equal(liveHighlights(nb).length, 0);
  assert.ok([...nb.held.values()].some((r) => r.kind === "trash"));
  nb.step(entry, "undo", T3);
  assert.equal(liveHighlights(nb).length, 1);
  assert.ok(![...nb.held.values()].some((r) => r.kind === "trash"));
});

test("undoing the deletion planUndo would also bring back matches the history's", () => {
  // planUndo (the store's own undo) and the history's inverse agree on the record.
  const nb = notebook();
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  nb.apply(planSave(r));
  const plan = planDelete(r, { ...ctx, now: T1, id: nextId() });
  nb.apply(plan);
  const viaStore = planUndo(plan.trash, { client: ctx.client, now: T2 });
  const viaHistory = inversePlan(nb.last, { client: ctx.client, now: T2 });
  assert.deepEqual(viaHistory.put, [viaStore.record]);
  assert.deepEqual(viaHistory.remove, [plan.trash.id]);
});

/* ── Saying what a change was ────────────────────────────────────────── */

const entryFor = (plan, before = []) => makeEntry(plan, new Map(before.map((r) => [r.id, r])), "e");

test("describeEntry: a note added, edited and deleted", () => {
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  assert.equal(describeEntry(entryFor({ put: [r], remove: [] })), "Note on Romans 8:3 added.");
  assert.equal(describeEntry(entryFor({ put: [{ ...r, body: "x", modified: T1 }], remove: [] }, [r])), "Note on Romans 8:3 edited.");
  assert.equal(describeEntry(entryFor(planDelete(r, { ...ctx, now: T1, id: nextId() }), [r])), "Note on Romans 8:3 deleted.");
});

test("describeEntry: a bookmark added and removed, and a range reads as one", () => {
  const b = createRecord("bookmark", { bookKey: "romans", chapter: 8, verse: 3, endVerse: 3 }, { ...ctx, now: T0, id: nextId() });
  assert.equal(describeEntry(entryFor({ put: [b], remove: [] })), "Bookmark on Romans 8:3 added.");
  assert.equal(describeEntry(entryFor(planDelete(b, { ...ctx, now: T1, id: nextId() }), [b])), "Bookmark on Romans 8:3 removed.");
  const ranged = note({ bookKey: "romans", chapter: 8, verse: 3, endVerse: 4 });
  assert.equal(describeEntry(entryFor({ put: [ranged], remove: [] })), "Note on Romans 8:3–4 added.");
});

test("describeEntry: a note on a glossary entry or an article reads as its reference does", () => {
  const g = note({}, { glossaryEntry: "flesh-body", targetTitle: "Flesh" });
  assert.equal(describeEntry(entryFor({ put: [g], remove: [] })), "Note on Glossary: Flesh added.");
  const a = note({}, { article: "why-lit", targetTitle: "Why a new translation" });
  assert.equal(describeEntry(entryFor({ put: [a], remove: [] })), "Note on Why a new translation added.");
});

test("describeEntry: a record with no place reads without one", () => {
  const label = createRecord("label", { name: "Favourites" }, { ...ctx, now: T0, id: nextId() });
  assert.equal(describeEntry(entryFor({ put: [label], remove: [] })), "Label added.");
});

test("describeEntry: highlights added, changed and removed, from the real planner", () => {
  const nb = notebook();
  assert.equal(describeEntry(mark(nb, "patient", "yellow", T1).entry), "Highlight on 1 Corinthians 13:1 added.");

  // Widening it takes in "love is": one highlight, changed.
  assert.equal(describeEntry(mark(nb, "Love is patient", "yellow", T2).entry), "Highlight on 1 Corinthians 13:1 changed.");

  // Another colour over part of it: a new mark of a colour that wasn't there.
  assert.equal(describeEntry(mark(nb, "patient", "pink", T2).entry), "Highlight on 1 Corinthians 13:1 added.");

  // Trimming the end of what's left is a change to it.
  assert.equal(describeEntry(mark(nb, "Love", null, T3).entry), "Highlight on 1 Corinthians 13:1 changed.");

  // Erasing a whole highlight takes it away.
  const { entry } = mark(nb, "patient", null, T3);
  assert.match(describeEntry(entry), /^Highlight on 1 Corinthians 13:1 (removed|changed)\.$/);

  const solo = notebook();
  mark(solo, "kind", "green", T1);
  assert.equal(describeEntry(mark(solo, "kind", null, T2).entry), "Highlight on 1 Corinthians 13:1 removed.");
});

test("describeEntry: erasing the middle of a highlight splits it, which is a change and not a new highlight", () => {
  const nb = notebook();
  mark(nb, "Love is patient, love is kind", "yellow", T1);
  const { entry, plan } = mark(nb, "patient", null, T2);
  assert.equal(plan.put.filter((r) => r.kind === "highlight").length, 2, "the highlight was cut into two records");
  assert.ok(plan.summary.split === 1);
  assert.equal(describeEntry(entry), "Highlight on 1 Corinthians 13:1 changed.");
  // And undoing it puts the one highlight back.
  const undone = nb.step(entry, "undo", T3);
  assert.notEqual(undone, null);
  assert.deepEqual(liveHighlights(nb).map((h) => h.quote.exact), ["Love is patient, love is kind"]);
});

test("describeEntry: several highlights read as one change on the first, in Bible order", () => {
  const nb = notebook();
  mark(nb, "not envious", "yellow", T1);
  mark(nb, "patient", "yellow", T1);
  // Erase everything across verses 1 to 2: both go, and the earlier verse is named.
  const { entry } = mark(nb, "patient, love is kind. It is not envious", null, T2);
  assert.ok(entry.before.filter((s) => s.record?.kind === "highlight").length >= 2);
  assert.equal(describeEntry(entry), "Highlight on 1 Corinthians 13:1 removed.");
});

test("describeEntry: a highlight range names both verses, with an en dash", () => {
  const nb = notebook();
  const { entry } = mark(nb, "kind. It is not envious", "yellow", T1);
  assert.equal(describeEntry(entry), "Highlight on 1 Corinthians 13:1–2 added.");
});

test("describeEntry: a deletion is described by the record the trash holds, never as a trash record", () => {
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const text = describeEntry(entryFor(planDelete(r, { ...ctx, now: T1, id: nextId() }), [r]));
  assert.doesNotMatch(text, /item|trash/i);
  assert.match(text, /^Note on Romans 8:3 /);
});

test("describeEntry: bringing a deleted record back from the trash reads as restored", () => {
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const trash = planDelete(r, { ...ctx, now: T1, id: nextId() }).trash;
  const restore = planUndo(trash, { client: ctx.client, now: T2 });
  assert.equal(describeEntry(entryFor(restore, [trash])), "Note on Romans 8:3 restored.");
});

test("describeEntry: an entry with nothing the reader keeps on either side still reads as a sentence", () => {
  const r = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const trash = planDelete(r, { ...ctx, now: T1, id: nextId() }).trash;
  assert.equal(describeEntry(entryFor({ put: [], remove: [trash.id] }, [trash])), "Notebook changed.");
});

test("lowerFirst lowers the first letter only, for the bar's 'Undone: ' sentence", () => {
  assert.equal(lowerFirst("Note on Romans 8:3 added."), "note on Romans 8:3 added.");
  assert.equal(lowerFirst("Mark rule changed."), "mark rule changed.");
  assert.equal(lowerFirst(""), "");
});

test("no sentence the history makes holds an em dash; a verse range takes an en dash", () => {
  const r = note({ bookKey: "romans", chapter: 8, verse: 3, endVerse: 5 });
  const sentences = [
    describeEntry(entryFor({ put: [r], remove: [] })),
    describeEntry(entryFor(planDelete(r, { ...ctx, now: T1, id: nextId() }), [r])),
  ];
  for (const s of sentences) assert.doesNotMatch(s, /—/);
  assert.equal(sentences[0], "Note on Romans 8:3–5 added.");
});
