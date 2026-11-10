// test/desk-audit8-j-labels.test.js
//
// Audit 8 decision 3's label half (BVJ, 2026-11-10): two labels made on two
// devices with one name are one label. Nothing is rewritten when the copies
// meet; the labels are joined where they are read, so every device shows the
// same label from the same records, in whatever order they met.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  findLabel,
  labelCounts,
  labelIds,
  labelMap,
  labelsOf,
  liveLabels,
  planDeleteLabel,
  planNewLabelOn,
  planRenameLabel,
  planSetLabel,
} from "../src/lib/desk-labels.mjs";
import { createRecord } from "../src/lib/desk-records.mjs";
import { mergeSets } from "../src/lib/desk-merge.mjs";
import { filterRecords } from "../src/lib/desk-notebook.mjs";
import { toMarkdown } from "../src/lib/desk-export.mjs";

const ID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const laptop = (now, id) => ({ client: "web/laptop", contentVersion: "v1", now, id });
const desktop = (now, id) => ({ client: "web/desktop", contentVersion: "v1", now, id });
const NOW = "2026-11-10T12:00:00.000Z";

// The laptop made "Sermon prep" first; the desktop made "sermon Prep" an hour
// later, before the two had met. Each put its own on a note.
const onLaptop = createRecord("label", { name: "Sermon prep" }, laptop("2026-11-10T09:00:00.000Z", ID(1)));
const onDesktop = createRecord("label", { name: "sermon Prep" }, desktop("2026-11-10T10:00:00.000Z", ID(2)));
const note = (n, labels, ctx) =>
  createRecord("note", { bookKey: "john", chapter: 3, verse: n, body: `note ${n}`, marker: "note", labels }, ctx);
const noteA = note(16, [onLaptop.id], laptop("2026-11-10T09:05:00.000Z", ID(11)));
const noteB = note(17, [onDesktop.id], desktop("2026-11-10T10:05:00.000Z", ID(12)));
const noteBoth = note(18, [onLaptop.id, onDesktop.id], laptop("2026-11-10T09:10:00.000Z", ID(13)));

const met = (first, second) => mergeSets(first, second, { now: NOW });
const laptopSet = [onLaptop, noteA, noteBoth];
const desktopSet = [onDesktop, noteB];

test("decision 3: two labels with one name list once, under the oldest's id and the name as last written", () => {
  const merged = met(laptopSet, desktopSet);
  const labels = liveLabels(merged);
  assert.equal(labels.length, 1);
  assert.equal(labels[0].id, onLaptop.id, "the oldest record's id");
  assert.equal(labels[0].name, "sermon Prep", "the name written last");
  assert.deepEqual(labelIds(merged, onDesktop.id), [onLaptop.id, onDesktop.id]);
});

test("decision 3: the joined label is the same whichever way the copies met", () => {
  const one = met(laptopSet, desktopSet);
  const two = met(desktopSet, laptopSet);
  assert.deepEqual(liveLabels(one), liveLabels(two));
  assert.deepEqual([...labelMap(one)].map(([id, l]) => [id, l.id, l.name]), [...labelMap(two)].map(([id, l]) => [id, l.id, l.name]));
});

test("decision 3: an item shows the label once, counts once, and a filter by it finds items with either id", () => {
  const merged = met(laptopSet, desktopSet);
  const map = labelMap(merged);
  const both = merged.find((r) => r.id === noteBoth.id);
  assert.deepEqual(labelsOf(both, map).map((l) => l.id), [onLaptop.id]);
  assert.deepEqual(labelsOf(merged.find((r) => r.id === noteB.id), map).map((l) => l.name), ["sermon Prep"]);
  assert.deepEqual([...labelCounts(merged)], [[onLaptop.id, 3]]);
  const notes = merged.filter((r) => r.kind === "note");
  assert.deepEqual(filterRecords(notes, { labelId: onLaptop.id }, map).map((r) => r.id).sort(), [noteA.id, noteB.id, noteBoth.id].sort());
  assert.equal(findLabel(merged, "SERMON PREP").id, onLaptop.id);
  assert.equal(findLabel(merged, "Sermon prep", onDesktop.id), null, "a name is free for its own label");
});

test("decision 3: taking the label off an item takes off both ids; putting it on an item with either is nothing to do", () => {
  const merged = met(laptopSet, desktopSet);
  const ids = labelIds(merged, onLaptop.id);
  const both = merged.find((r) => r.id === noteBoth.id);
  const off = planSetLabel(both, onLaptop.id, false, laptop(NOW), ids);
  assert.deepEqual(off.plan.put[0].labels, []);
  const b = merged.find((r) => r.id === noteB.id);
  assert.equal(planSetLabel(b, onLaptop.id, true, laptop(NOW), ids).plan.put.length, 0);
  assert.equal(planNewLabelOn(merged, b, "Sermon Prep", laptop(NOW)).plan.put.length, 0, "typing the name again adds nothing");
});

test("decision 3: renaming the label renames every record of it", () => {
  const merged = met(laptopSet, desktopSet);
  const done = planRenameLabel(merged, onDesktop.id, "Sermons", laptop(NOW));
  assert.equal(done.ok, true);
  assert.deepEqual(done.plan.put.map((r) => [r.id, r.name]).sort(), [[onLaptop.id, "Sermons"], [onDesktop.id, "Sermons"]]);
  assert.equal(done.label.id, onLaptop.id);
  assert.equal(done.label.name, "Sermons");
  // A change of case alone is the label's own name.
  const recased = planRenameLabel(merged, onLaptop.id, "Sermon Prep", laptop(NOW));
  assert.equal(recased.ok, true);
  assert.equal(recased.plan.put.length, 2);
});

test("decision 3: deleting the label trashes every record of it and takes both ids off every item", () => {
  const merged = met(laptopSet, desktopSet);
  const done = planDeleteLabel(merged, onLaptop.id, laptop(NOW));
  assert.equal(done.ok, true);
  assert.deepEqual(done.plan.remove.sort(), [onLaptop.id, onDesktop.id]);
  assert.deepEqual(done.trashes.map((t) => t.deletedId).sort(), [onLaptop.id, onDesktop.id]);
  assert.equal(done.trash.deletedId, onLaptop.id);
  assert.equal(done.stripped, 3);
  for (const r of done.plan.put.filter((p) => p.kind === "note")) assert.deepEqual(r.labels, []);
});

test("decision 3: the Markdown file lists the label once", () => {
  const md = toMarkdown(met(laptopSet, desktopSet), { exported: NOW });
  const section = md.slice(md.indexOf("## Labels"));
  assert.equal(section.split("\n").filter((l) => l.startsWith("- ")).length, 1);
  assert.match(md, /Labels: sermon Prep\n/);
});
