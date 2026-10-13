// test/desk-labels.test.js
//
// src/lib/desk-labels.mjs: the plans behind the reader's labels (M8). The
// store commits each plan in one transaction, so what a plan puts and removes
// here is exactly what the undo history will take back.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createRecord } from "../src/lib/desk-records.mjs";
import {
  findLabel,
  labelCounts,
  labelKey,
  labelMap,
  labelsOf,
  liveLabels,
  normalizeLabelName,
  planCreateLabel,
  planDeleteLabel,
  planNewLabelOn,
  planRenameLabel,
  planSetLabel,
} from "../src/lib/desk-labels.mjs";

const ctx = { client: "web/2026.10", contentVersion: "v20261005.5d2c847d", now: "2026-10-12T10:00:00.000Z" };
let n = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const label = (name) => createRecord("label", { name }, { ...ctx, now: "2026-10-01T00:00:00.000Z", id: nextId() });
const note = (extra = {}) =>
  createRecord("note", { bookKey: "romans", chapter: 8, verse: 3, body: "x", marker: "note", ...extra }, { ...ctx, now: "2026-10-01T00:00:00.000Z", id: nextId() });

test("names are trimmed, collapsed, and compared without case or accents", () => {
  assert.equal(normalizeLabelName("  Morning   prayer \n"), "Morning prayer");
  assert.equal(labelKey("Práyer"), labelKey("prayer"));
  assert.equal(labelKey("  PRAYER "), "prayer");
});

test("liveLabels sorts by name and findLabel matches loosely", () => {
  const a = label("Prayer");
  const b = label("advent");
  assert.deepEqual(liveLabels([a, note(), b]).map((l) => l.name), ["advent", "Prayer"]);
  assert.equal(findLabel([a, b], " prayer ")?.id, a.id);
  assert.equal(findLabel([a, b], "prayer", a.id), null);
  assert.equal(findLabel([a], "   "), null);
});

test("planCreateLabel makes a label, refuses empty and duplicate names", () => {
  const a = label("Prayer");
  const made = planCreateLabel([a], "  Advent  ", ctx);
  assert.equal(made.ok, true);
  assert.equal(made.label.name, "Advent");
  assert.deepEqual(made.plan.remove, []);
  assert.equal(made.plan.put.length, 1);
  assert.equal(planCreateLabel([a], "  ", ctx).reason, "empty");
  const dup = planCreateLabel([a], "prayer", ctx);
  assert.equal(dup.reason, "duplicate");
  assert.equal(dup.existing.id, a.id);
});

test("planRenameLabel moves modified, allows a change of case, refuses a clash", () => {
  const a = label("prayer");
  const b = label("Advent");
  const ok = planRenameLabel([a, b], a.id, "Prayer", ctx);
  assert.equal(ok.plan.put[0].name, "Prayer");
  assert.equal(ok.plan.put[0].modified, ctx.now);
  assert.equal(planRenameLabel([a, b], a.id, "advent", ctx).reason, "duplicate");
  assert.equal(planRenameLabel([a, b], a.id, "", ctx).reason, "empty");
  assert.equal(planRenameLabel([a, b], "nope", "x", ctx).reason, "missing");
  assert.deepEqual(planRenameLabel([a], a.id, "prayer", ctx).plan.put, []);
});

test("planSetLabel adds and removes, and writes nothing when nothing changes", () => {
  const l = label("Prayer");
  const r = note();
  const on = planSetLabel(r, l.id, true, ctx);
  assert.deepEqual(on.record.labels, [l.id]);
  assert.equal(on.plan.put[0].modified, ctx.now);
  assert.deepEqual(planSetLabel(on.record, l.id, true, ctx).plan.put, []);
  assert.deepEqual(planSetLabel(on.record, l.id, false, ctx).record.labels, []);
  assert.deepEqual(planSetLabel(r, l.id, false, ctx).plan.put, []);
});

test("planSetLabel refuses a record it can't edit and keeps unknown fields", () => {
  const future = { ...note(), schema: 2 };
  assert.equal(planSetLabel(future, "x", true, ctx).reason, "readonly");
  const r = { ...note(), mystery: { a: 1 } };
  assert.deepEqual(planSetLabel(r, "x", true, ctx).record.mystery, { a: 1 });
});

test("planNewLabelOn makes the label and applies it in one plan, or reuses a match", () => {
  const r = note();
  const first = planNewLabelOn([r], r, " Study ", ctx);
  assert.equal(first.plan.put.length, 2);
  assert.equal(first.label.name, "Study");
  assert.deepEqual(first.record.labels, [first.label.id]);
  const existing = label("study");
  const again = planNewLabelOn([r, existing], r, "Study", ctx);
  assert.equal(again.plan.put.length, 1);
  assert.deepEqual(again.record.labels, [existing.id]);
  assert.equal(planNewLabelOn([r], r, " ", ctx).reason, "empty");
});

test("planDeleteLabel trashes the label and strips its id from every record in one plan", () => {
  const l = label("Prayer");
  const keep = label("Advent");
  const a = note({ labels: [l.id, keep.id] });
  const b = note({ labels: [l.id] });
  const c = note({ labels: [keep.id] });
  const future = { ...note({ labels: [l.id] }), schema: 2 };
  const out = planDeleteLabel([l, keep, a, b, c, future], l.id, ctx);
  assert.equal(out.ok, true);
  assert.deepEqual(out.plan.remove, [l.id]);
  const byId = new Map(out.plan.put.map((r) => [r.id, r]));
  assert.equal(byId.get(out.trash.id).deletedId, l.id);
  assert.equal(byId.get(out.trash.id).record.name, "Prayer");
  assert.deepEqual(byId.get(a.id).labels, [keep.id]);
  assert.deepEqual(byId.get(b.id).labels, []);
  assert.equal(byId.has(c.id), false);
  assert.equal(byId.has(future.id), false);
  assert.equal(out.stripped, 2);
  assert.equal(out.untouched, 1);
  assert.equal(planDeleteLabel([l], "nope", ctx).reason, "missing");
});

test("labels with no label record are ignored for display and never stripped", () => {
  const l = label("Prayer");
  const r = note({ labels: ["gone", l.id] });
  assert.deepEqual(labelsOf(r, [l]).map((x) => x.name), ["Prayer"]);
  assert.deepEqual(labelsOf(r, labelMap([l])).map((x) => x.name), ["Prayer"]);
  assert.equal(planSetLabel(r, l.id, false, ctx).record.labels.join(), "gone");
});

test("labelCounts counts live records only", () => {
  const l = label("Prayer");
  const a = note({ labels: [l.id] });
  const b = note({ labels: [l.id] });
  const trash = { id: "t", kind: "trash", labels: [l.id] };
  assert.equal(labelCounts([l, a, b, trash]).get(l.id), 2);
});
