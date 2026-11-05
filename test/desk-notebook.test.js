// test/desk-notebook.test.js
//
// src/lib/desk-notebook.mjs: how the notebook page groups, filters and counts
// what the notebook keeps, and the two bulk deletions at its foot.

import { test } from "node:test";
import assert from "node:assert/strict";

import { COLORS, createRecord, emptyTrashRecord, trashRecord } from "../src/lib/desk-records.mjs";
import { planWrite } from "../src/lib/desk-store-core.mjs";
import {
  BOOKMARK_MOVES,
  BOOKMARK_STAYS,
  colorsPresent,
  daysLeft,
  describeCounts,
  emptyNow,
  filterRecords,
  followTarget,
  fold,
  groupRecords,
  kindsPresent,
  planDeleteEverything,
  planEmptyTrashNow,
  planRestore,
  planRestoreAll,
  trashHeld,
  trashItems,
} from "../src/lib/desk-notebook.mjs";

const ctx = { client: "web/2026.10", contentVersion: "v20261005.5d2c847d", now: "2026-10-12T10:00:00.000Z" };
let n = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const make = (kind, fields, created = "2026-10-01T00:00:00.000Z") =>
  createRecord(kind, fields, { client: ctx.client, contentVersion: ctx.contentVersion, now: created, id: nextId() });
const note = (where, body = "x", extra = {}) => make("note", { ...where, body, marker: "note", ...extra });
const hl = (where, color = "yellow", exact = "patient") =>
  make("highlight", { ...where, color, quote: { exact, prefix: "", suffix: "" } });

test("fold ignores case, accents and spacing", () => {
  assert.equal(fold("  Ágape   LOVE "), "agape love");
});

test("filterRecords matches body, quote, reference and label names, each word, without accents", () => {
  const label = make("label", { name: "Prayer" });
  const a = note({ bookKey: "romans", chapter: 8, verse: 3 }, "Self-preservation as the drive", { labels: [label.id] });
  const b = hl({ bookKey: "john", chapter: 3, verse: 16 }, "pink", "Ágape love");
  const all = [a, b];
  const labels = new Map([[label.id, label]]);
  assert.deepEqual(filterRecords(all, { query: "SELF drive" }, labels), [a]);
  assert.deepEqual(filterRecords(all, { query: "agape" }, labels), [b]);
  assert.deepEqual(filterRecords(all, { query: "romans 8" }, labels), [a]);
  assert.deepEqual(filterRecords(all, { query: "prayer" }, labels), [a]);
  assert.deepEqual(filterRecords(all, { query: "pink" }, labels), [b]);
  assert.deepEqual(filterRecords(all, { query: "" }, labels), all);
  assert.deepEqual(filterRecords(all, { query: "zzz" }, labels), []);
});

test("filterRecords narrows by kind, colour and label", () => {
  const label = make("label", { name: "L" });
  const a = note({ bookKey: "romans", chapter: 8, verse: 3 }, "x", { labels: [label.id] });
  const b = hl({ bookKey: "john", chapter: 3, verse: 16 }, "pink");
  const c = hl({ bookKey: "john", chapter: 3, verse: 17 }, "blue");
  assert.deepEqual(filterRecords([a, b, c], { kind: "highlight" }), [b, c]);
  assert.deepEqual(filterRecords([a, b, c], { color: "blue" }), [c]);
  assert.deepEqual(filterRecords([a, b, c], { labelId: label.id }), [a]);
  assert.deepEqual(filterRecords([a, b, c], { kind: "highlight", color: "pink", query: "patient" }), [b]);
});

test("kindsPresent offers only kinds in the list, and never hidden passages", () => {
  const a = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const h = make("hidden", { bookKey: "romans", chapter: 8, verse: 4 });
  assert.deepEqual(kindsPresent([a, h]).map((k) => k.value), ["note"]);
  assert.deepEqual(colorsPresent([hl({ bookKey: "john", chapter: 3, verse: 1 }, "blue")], COLORS), ["blue"]);
});

test("groupRecords puts text records in Bible order under book and chapter", () => {
  const j = note({ bookKey: "john", chapter: 3, verse: 16 });
  const r2 = note({ bookKey: "romans", chapter: 8, verse: 28 });
  const r1 = hl({ bookKey: "romans", chapter: 8, verse: 3 });
  const rr = note({ bookKey: "romans", chapter: 12, verse: 1 });
  const g = groupRecords([r2, rr, j, r1]);
  assert.deepEqual(g.books.map((b) => b.label), ["John", "Romans"]);
  assert.deepEqual(g.books[1].chapters.map((c) => c.label), ["Romans 8", "Romans 12"]);
  assert.deepEqual(g.books[1].chapters[0].records.map((r) => r.verse), [3, 28]);
});

test("groupRecords sets apart prose notes and pins, leaves places to their own section, and shows a hidden passage as a plain row", () => {
  const gl = note({ glossaryEntry: "flesh-body", targetTitle: "Flesh" });
  const ar = note({ article: "some-article" });
  const pin = make("footnotePin", { bookKey: "romans", chapter: 8, verse: 3, footnote: "A note" });
  const place = make("place", { bookKey: "luke", chapter: 15, verse: 11, name: "Group" });
  const hidden = make("hidden", { bookKey: "luke", chapter: 15, verse: 12 });
  const label = make("label", { name: "L" });
  const sheet = make("sheet", { title: "S" });
  const g = groupRecords([gl, ar, pin, place, hidden, label, sheet]);
  assert.equal(g.glossary.length, 1);
  assert.equal(g.articles.length, 1);
  assert.equal(g.pins.length, 1);
  assert.equal("places" in g, false);
  assert.equal(g.books.length, 0);
  assert.equal("hidden" in g, false);
  assert.deepEqual(g.other.map((r) => r.kind).sort(), ["hidden", "sheet"]);
});

test("describeCounts reads in words", () => {
  const notes = Array.from({ length: 12 }, (_, i) => note({ bookKey: "romans", chapter: 8, verse: i + 1 }));
  const hls = Array.from({ length: 4 }, (_, i) => hl({ bookKey: "john", chapter: 3, verse: i + 1 }));
  assert.equal(describeCounts([...notes, ...hls]), "12 notes, 4 highlights");
  assert.equal(describeCounts([notes[0]]), "1 note");
  assert.equal(describeCounts([]), "Nothing kept yet.");
  assert.equal(describeCounts([make("sheet", { title: "S" }), make("label", { name: "L" })]), "1 other item");
  assert.equal(describeCounts([make("footnotePin", { bookKey: "romans", chapter: 8, verse: 3, footnote: "A" })]), "1 pinned footnote");
});

test("planDeleteEverything trashes every live record, whole, in one valid plan", () => {
  const a = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const b = hl({ bookKey: "john", chapter: 3, verse: 16 });
  const l = make("label", { name: "L" });
  const oldTrash = { id: "t0", kind: "trash", deletedId: "gone", deletedAt: "2026-09-01T00:00:00.000Z" };
  const unknown = { ...a, id: nextId(), kind: "future", extra: [1] };
  const plan = planDeleteEverything([a, b, l, oldTrash, unknown], ctx);
  assert.deepEqual(plan.remove.sort(), [a.id, b.id, l.id, unknown.id].sort());
  assert.equal(plan.put.length, 4);
  assert.ok(plan.put.every((t) => t.kind === "trash"));
  const held = plan.put.find((t) => t.deletedId === unknown.id);
  assert.deepEqual(held.record, unknown);
  assert.doesNotThrow(() => planWrite(plan));
});

test("emptyNow drops the held record at once and keeps the tombstone", () => {
  const a = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const [trash] = planDeleteEverything([a], ctx).put;
  assert.ok(emptyTrashRecord(trash, "2026-10-12T10:00:01.000Z").record, "the 30 days haven't passed");
  const gone = emptyNow(trash);
  assert.equal("record" in gone, false);
  assert.equal(gone.deletedId, a.id);
  assert.equal(gone.deletedAt, trash.deletedAt);
  assert.equal(gone.deletedKind, "note");
  assert.equal(gone.modified, trash.modified);
  assert.equal(emptyNow(gone), gone);
  assert.equal(emptyNow(a), a);
});

test("planEmptyTrashNow writes only trash that still holds something", () => {
  const a = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const b = note({ bookKey: "romans", chapter: 8, verse: 4 });
  const { put } = planDeleteEverything([a, b], ctx);
  const tomb = emptyNow(put[1]);
  const plan = planEmptyTrashNow([put[0], tomb, a]);
  assert.deepEqual(plan.put.map((t) => t.deletedId), [a.id]);
  assert.deepEqual(plan.remove, []);
  assert.equal(trashHeld([put[0], tomb]), 1);
  assert.deepEqual(planEmptyTrashNow([tomb]).put, []);
});

/* ── The record a following list brings up (E17, E22) ─────────────────── */

test("followTarget is the first record at or after the reading line, by the end of its verses", () => {
  const a = note({ bookKey: "matthew", chapter: 5, verse: 3 });
  const b = note({ bookKey: "matthew", chapter: 5, verse: 9, endVerse: 12 });
  const c = note({ bookKey: "matthew", chapter: 6, verse: 1 });
  const all = [a, b, c];
  assert.deepEqual(followTarget(all, { bookKey: "matthew", chapter: 5, verse: 2 }), { record: a, here: true });
  assert.deepEqual(followTarget(all, { bookKey: "matthew", chapter: 5, verse: 4 }), { record: b, here: true });
  // A range still holds the line while the reader is inside it.
  assert.deepEqual(followTarget(all, { bookKey: "matthew", chapter: 5, verse: 11 }), { record: b, here: true });
  assert.deepEqual(followTarget(all, { bookKey: "matthew", chapter: 5, verse: 13 }), { record: c, here: false });
  // No verse: the chapter's first.
  assert.deepEqual(followTarget(all, { bookKey: "matthew", chapter: 5 }), { record: a, here: true });
});

test("followTarget with nothing after the line is the last record before it, and says it is not here", () => {
  const a = note({ bookKey: "matthew", chapter: 5, verse: 3 });
  const b = note({ bookKey: "matthew", chapter: 5, verse: 9 });
  assert.deepEqual(followTarget([a, b], { bookKey: "matthew", chapter: 5, verse: 30 }), { record: b, here: true });
  assert.deepEqual(followTarget([a, b], { bookKey: "matthew", chapter: 9, verse: 1 }), { record: b, here: false });
});

test("followTarget crosses books, so a chapter with nothing kept still finds the nearest records (E22)", () => {
  const john = note({ bookKey: "john", chapter: 3, verse: 16 });
  const acts = note({ bookKey: "acts", chapter: 2, verse: 1 });
  assert.deepEqual(followTarget([john, acts], { bookKey: "luke", chapter: 1, verse: 1 }), { record: john, here: false });
  assert.deepEqual(followTarget([john, acts], { bookKey: "romans", chapter: 8, verse: 1 }), { record: acts, here: false });
  assert.deepEqual(followTarget([john, acts], { bookKey: "matthew", chapter: 28, verse: 1 }), { record: john, here: false });
});

test("followTarget passes over records with no place, and is null with none placed or no passage", () => {
  const g = make("note", { glossaryEntry: "flesh", body: "x", marker: "note" });
  const a = note({ bookKey: "john", chapter: 3, verse: 16 });
  assert.deepEqual(followTarget([g, a], { bookKey: "john", chapter: 3, verse: 1 }), { record: a, here: true });
  assert.equal(followTarget([g], { bookKey: "john", chapter: 3, verse: 1 }), null);
  assert.equal(followTarget([a], null), null);
  assert.equal(followTarget([a], { bookKey: "nowhere", chapter: 1 }), null);
  assert.equal(followTarget([], { bookKey: "john", chapter: 3 }), null);
});

/* ── Restoring from the trash (E12) ──────────────────────────────────── */

const trashed = (record, at) => trashRecord(record, { ...ctx, now: at, id: nextId() });
const NOW = "2026-10-20T10:00:00.000Z";
const T = "2026-10-12T10:00:00.000Z";

test("trashItems lists what the trash still holds, the latest deletion first, and not a tombstone", () => {
  const a = trashed(note({ bookKey: "romans", chapter: 8, verse: 3 }), "2026-10-10T00:00:00.000Z");
  const b = trashed(note({ bookKey: "romans", chapter: 8, verse: 4 }), "2026-10-15T00:00:00.000Z");
  const gone = emptyNow(trashed(note({ bookKey: "romans", chapter: 8, verse: 5 }), "2026-10-18T00:00:00.000Z"));
  const live = note({ bookKey: "john", chapter: 3, verse: 16 });
  assert.deepEqual(trashItems([a, live, gone, b]).map((t) => t.id), [b.id, a.id]);
  assert.deepEqual(trashItems([live]), []);
});

test("daysLeft counts up to the 30th day and stops at zero", () => {
  const t = trashed(note({ bookKey: "romans", chapter: 8, verse: 3 }), "2026-10-01T00:00:00.000Z");
  assert.equal(daysLeft(t, "2026-10-01T00:00:01.000Z"), 30);
  assert.equal(daysLeft(t, "2026-10-20T00:00:00.000Z"), 11);
  assert.equal(daysLeft(t, "2026-10-30T23:59:59.000Z"), 1);
  assert.equal(daysLeft(t, "2026-10-31T00:00:00.000Z"), 0);
  assert.equal(daysLeft(t, "2027-01-01T00:00:00.000Z"), 0);
  assert.equal(daysLeft({}, NOW), 0);
});

test("planRestore brings the record back under its id with a new modified, and takes the trash record away", () => {
  const a = note({ bookKey: "romans", chapter: 8, verse: 3 }, "words");
  const t = trashed(a, "2026-10-10T00:00:00.000Z");
  const done = planRestore([t], t.id, { ...ctx, now: NOW });
  assert.equal(done.ok, true);
  assert.deepEqual(done.plan.remove, [t.id]);
  assert.equal(done.plan.put.length, 1);
  assert.equal(done.record.id, a.id);
  assert.equal(done.record.body, "words");
  assert.equal(done.record.modified, NOW, "restoring is the reader acting");
  assert.ok(Date.parse(done.record.modified) > Date.parse(t.deletedAt), "so it outranks the deletion in a merge");
  assert.doesNotThrow(() => planWrite(done.plan));
});

test("planRestore refuses what is gone, emptied, or already back", () => {
  const a = note({ bookKey: "romans", chapter: 8, verse: 3 });
  const t = trashed(a, T);
  assert.deepEqual(planRestore([], t.id, ctx), { ok: false, reason: "missing" });
  assert.deepEqual(planRestore([live0()], t.id, ctx), { ok: false, reason: "missing" });
  assert.deepEqual(planRestore([emptyNow(t)], t.id, ctx), { ok: false, reason: "emptied" });
  assert.deepEqual(planRestore([t, a], t.id, ctx), { ok: false, reason: "exists" });
  function live0() {
    return note({ bookKey: "john", chapter: 1, verse: 1 });
  }
});

test("planRestore leaves a bookmark in the trash when its verse already holds one", () => {
  const where = { bookKey: "john", chapter: 3, verse: 16 };
  const old = trashed(make("bookmark", where), T);
  const fresh = make("bookmark", where);
  assert.deepEqual(planRestore([old, fresh], old.id, ctx), { ok: false, reason: "bookmark" });
  assert.equal(planRestore([old], old.id, ctx).ok, true, "a bookmark elsewhere is no obstacle");
  const other = make("bookmark", { ...where, verse: 17 });
  assert.equal(planRestore([old, other], old.id, ctx).ok, true);
});

test("planRestore leaves a label in the trash when its name is kept again, in any case", () => {
  const old = trashed(make("label", { name: "Prayer" }), T);
  const again = make("label", { name: "prayer" });
  assert.deepEqual(planRestore([old, again], old.id, ctx), { ok: false, reason: "label" });
  assert.equal(planRestore([old], old.id, ctx).ok, true);
});

test("planRestore brings a following bookmark back plain when six already move", () => {
  const moving = (verse) => make("bookmark", { bookKey: "john", chapter: 3, verse, follow: true });
  const six = [1, 2, 3, 4, 5, 6].map(moving);
  const old = trashed(moving(9), T);
  const full = planRestore([old, ...six], old.id, ctx);
  assert.equal(full.ok, true);
  assert.equal(full.movesNoMore, true);
  assert.equal("follow" in full.record, false);
  assert.equal(full.record.verse, 9);
  const room = planRestore([old, ...six.slice(1)], old.id, ctx);
  assert.equal(room.movesNoMore, false);
  assert.equal(room.record.follow, true);
});

test("planRestore leaves a label id that names nothing, and a record this code can't edit comes back as it was", () => {
  const withGone = trashed(note({ bookKey: "romans", chapter: 8, verse: 3 }, "x", { labels: ["no-such-label"] }), T);
  assert.deepEqual(planRestore([withGone], withGone.id, ctx).record.labels, ["no-such-label"]);
  const newer = { ...note({ bookKey: "romans", chapter: 8, verse: 3 }), schema: 99 };
  const t = trashed(newer, T);
  assert.deepEqual(planRestore([t], t.id, { ...ctx, now: NOW }).record, newer);
});

test("planRestoreAll restores the lot, judging each over those before it, and says what stayed", () => {
  const where = { bookKey: "john", chapter: 3, verse: 16 };
  const a = trashed(note({ bookKey: "romans", chapter: 8, verse: 3 }), "2026-10-10T00:00:00.000Z");
  const early = trashed(make("bookmark", where), "2026-10-11T00:00:00.000Z");
  const late = trashed(make("bookmark", where), "2026-10-14T00:00:00.000Z");
  const gone = emptyNow(trashed(note({ bookKey: "romans", chapter: 8, verse: 9 }), "2026-10-09T00:00:00.000Z"));
  const all = planRestoreAll([a, early, late, gone], { ...ctx, now: NOW });
  assert.equal(all.restored, 2);
  assert.deepEqual(all.plan.remove.sort(), [a.id, late.id].sort(), "the later deletion's bookmark is the one that stays");
  assert.deepEqual(all.skipped.map((s) => [s.trash.id, s.reason]), [[early.id, "bookmark"]]);
  assert.doesNotThrow(() => planWrite(all.plan));
  assert.equal(planRestoreAll([], ctx).restored, 0);
});

test("the Show menu splits bookmarks into moving and staying put only when a list holds both", () => {
  const mark = (extra) => ({ kind: "bookmark", id: `b${Math.random()}`, bookKey: "luke", chapter: 1, verse: 1, ...extra });
  const moving = mark({ follow: true });
  const plain = mark({});
  const values = (records) => kindsPresent(records).map((k) => k.value);
  assert.deepEqual(values([moving]), ["bookmark"]);
  assert.deepEqual(values([plain]), ["bookmark"]);
  assert.deepEqual(values([moving, plain]), ["bookmark", BOOKMARK_MOVES, BOOKMARK_STAYS]);
  const records = [moving, plain, { kind: "note", id: "n1", bookKey: "luke", chapter: 1, verse: 2, body: "x" }];
  assert.deepEqual(values(records), ["note", "bookmark", BOOKMARK_MOVES, BOOKMARK_STAYS]);
  assert.deepEqual(filterRecords(records, { kind: BOOKMARK_MOVES }), [moving]);
  assert.deepEqual(filterRecords(records, { kind: BOOKMARK_STAYS }), [plain]);
  assert.equal(filterRecords(records, { kind: "bookmark" }).length, 2);
});
