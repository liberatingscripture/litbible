// test/desk-audit8-j-stamps.test.js
//
// Audit 8's stamp rules (BVJ, 2026-11-10), each walked through the meeting of
// two copies that broke it:
// - DI8-1: a stamp never steps more than CLOCK_TOLERANCE_MS past the clock, so a
//   record once stamped by a clock running ahead can heal.
// - DI8-2: restoring, or undoing the deletion of, a record this code can't edit
//   restamps `modified` and `client`, so the restore outranks the deletion.

import { test } from "node:test";
import assert from "node:assert/strict";

import { CLOCK_TOLERANCE_MS, createRecord, editRecord, laterThan, laterThanAll, restoreFromTrash, trashRecord } from "../src/lib/desk-records.mjs";
import { CLOCK_TOLERANCE_MS as MERGE_TOLERANCE, mergeSets } from "../src/lib/desk-merge.mjs";
import { inversePlan, makeEntry } from "../src/lib/desk-history.mjs";

const at = (iso, ms) => new Date(Date.parse(iso) + ms).toISOString();
const NOW = "2026-11-10T12:00:00.000Z";
const AHEAD = "2030-06-01T00:00:00.000Z"; // a laptop clock set years ahead for an afternoon
const NOTE = { bookKey: "john", chapter: 3, verse: 16, body: "a note", marker: "note" };
const note = (modified, extra = {}) => ({
  ...createRecord("note", NOTE, { client: "web/laptop", contentVersion: "v1", now: "2026-11-01T00:00:00.000Z", id: "00000000-0000-4000-8000-0000000000d1" }),
  modified,
  ...extra,
});
const byId = (set, id) => set.find((r) => r.id === id || r.deletedId === id);

test("one tolerance for the merge and the stamps", () => {
  assert.equal(MERGE_TOLERANCE, CLOCK_TOLERANCE_MS);
  assert.equal(CLOCK_TOLERANCE_MS, 5 * 60_000);
});

test("DI8-1: a stamp steps past a version within the tolerance, and not past one further ahead", () => {
  const within = at(NOW, CLOCK_TOLERANCE_MS - 1000);
  assert.equal(laterThan(within, NOW), at(within, 1), "a phone a few minutes fast is still stepped past");
  assert.equal(laterThan(at(NOW, CLOCK_TOLERANCE_MS + 1000), NOW), NOW);
  assert.equal(laterThan(AHEAD, NOW), NOW);
  // laterThanAll judges every version against the clock, not against a time already stepped.
  assert.equal(laterThanAll(NOW, within, AHEAD), at(within, 1));
  assert.equal(laterThanAll(NOW, AHEAD, within), at(within, 1));
});

test("DI8-1: an edit, a deletion, a restore and an undo over a version from a clock running ahead are stamped now", () => {
  const ahead = note(AHEAD);
  assert.equal(editRecord(ahead, { body: "fixed clock" }, { now: NOW, client: "web/laptop" }).modified, NOW);
  const trash = trashRecord(ahead, { now: NOW, client: "web/laptop", contentVersion: "v1", id: "00000000-0000-4000-8000-0000000000d2" });
  assert.equal(trash.deletedAt, NOW);
  assert.equal(restoreFromTrash(trash, { now: at(NOW, 1000) }).modified, at(NOW, 1000));
  const edited = editRecord(ahead, { body: "fixed clock" }, { now: NOW });
  const entry = makeEntry({ put: [edited], remove: [] }, new Map([[ahead.id, ahead]]), "e");
  assert.equal(inversePlan(entry, { now: at(NOW, 2000) }).put[0].modified, at(NOW, 2000));
});

test("DI8-1: a note written while the clock ran ahead heals: the next edit reaches the other copy, and its deletion too", () => {
  // The laptop's clock ran ahead when the note was written; the desktop got a
  // copy (a backup opened there), clamped to when it arrived.
  const written = note(AHEAD, { body: "written while the clock was wrong" });
  const arrived = "2026-11-05T00:00:00.000Z";
  const desktop = mergeSets([], [written], { now: arrived });
  assert.equal(byId(desktop, written.id).modified, arrived, "clamped on arrival");

  // The clock is put right; the reader edits the note on the laptop.
  const edited = editRecord(written, { body: "edited with the right time" }, { now: NOW, client: "web/laptop" });
  const met = mergeSets(desktop, [edited], { now: at(NOW, 1000) });
  assert.equal(byId(met, written.id).body, "edited with the right time", "the edit reaches the desktop");

  // And deleting it on the laptop deletes it on the desktop.
  const deletion = trashRecord(edited, { now: at(NOW, 5000), client: "web/laptop", contentVersion: "v1", id: "00000000-0000-4000-8000-0000000000d3" });
  const after = mergeSets(met, [deletion], { now: at(NOW, 6000) });
  assert.equal(after.some((r) => r.id === written.id), false, "the note is gone");
  assert.ok(after.some((r) => r.kind === "trash" && r.deletedId === written.id));
});

test("DI8-2: a restored record this code can't edit stays restored when its deletion arrives again", () => {
  const alien = { ...note("2026-11-09T00:00:00.000Z"), kind: "voiceMemo", audio: "…", client: "ios/1" };
  const deletion = trashRecord(alien, { now: "2026-11-09T12:00:00.000Z", client: "web/desk", contentVersion: "v1", id: "00000000-0000-4000-8000-0000000000d4" });
  const restored = restoreFromTrash(deletion, { now: NOW, client: "web/desk" });
  assert.equal(restored.audio, "…", "every field the website doesn't know is kept");
  assert.equal(restored.client, "web/desk");
  // Last week's backup, which still holds the deletion, is opened.
  const met = mergeSets([restored], [deletion], { now: at(NOW, 1000) });
  assert.ok(byId(met, alien.id)?.kind === "voiceMemo", "still restored");
});

test("DI8-2: undoing the deletion of a record this code can't edit outranks that deletion too", () => {
  const newer = { ...note("2026-11-09T00:00:00.000Z"), schema: 99, extra: { kept: true } };
  const deletion = trashRecord(newer, { now: "2026-11-09T12:00:00.000Z", client: "web/desk", contentVersion: "v1", id: "00000000-0000-4000-8000-0000000000d5" });
  const entry = makeEntry({ put: [deletion], remove: [newer.id] }, new Map([[newer.id, newer]]), "e");
  const back = inversePlan(entry, { now: NOW, client: "web/desk" }).put.find((r) => r.id === newer.id);
  assert.deepEqual(back.extra, { kept: true });
  const met = mergeSets([back], [deletion], { now: at(NOW, 1000) });
  assert.ok(byId(met, newer.id)?.kind === "note", "the undo stands");
});
