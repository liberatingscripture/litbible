// test/desk-notebook.test.js
//
// src/lib/desk-notebook.mjs: how the notebook page groups, filters and counts
// what the notebook keeps, and the two bulk deletions at its foot.

import { test } from "node:test";
import assert from "node:assert/strict";

import { COLORS, createRecord, emptyTrashRecord } from "../src/lib/desk-records.mjs";
import { planWrite } from "../src/lib/desk-store-core.mjs";
import {
  colorsPresent,
  describeCounts,
  emptyNow,
  filterRecords,
  fold,
  groupRecords,
  kindsPresent,
  planDeleteEverything,
  planEmptyTrashNow,
  trashHeld,
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

test("groupRecords sets apart prose notes, pins and places, and shows a hidden passage as a plain row", () => {
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
  assert.equal(g.places.length, 1);
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
