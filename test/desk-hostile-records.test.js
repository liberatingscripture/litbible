// test/desk-hostile-records.test.js
//
// SEC Q2 (audit 2, BVJ's answer 2026-11-04, option B): a record this code
// can't edit (a newer schema, an unknown kind) is kept whatever its own fields
// hold, so the places that DRAW those fields check their type. These feed
// hostile values through the pure drawing helpers.

import { test } from "node:test";
import assert from "node:assert/strict";

import { glyph } from "../src/scripts/desk/glyphs.js";
import { noteBodyHtml } from "../src/lib/desk-chains.mjs";
import { markerName } from "../src/lib/desk-notes.mjs";
import { planImport } from "../src/lib/desk-export.mjs";
import { BOOKMARK_NAME_MAX } from "../src/lib/desk-bookmarks.mjs";
import { LABEL_NAME_MAX, MAX_RECORD_BYTES, SCHEMA_VERSION, createRecord, recordBytes, trashRecord, validateRecord } from "../src/lib/desk-records.mjs";
import { SHEET_FORMAT } from "../src/lib/desk-sheet-format.mjs";
import { planWrite } from "../src/lib/desk-store-core.mjs";

const HOSTILE = ["constructor", "__proto__", "toString", "hasOwnProperty", 12345, null, undefined, {}, ["note"], "<img src=x onerror=alert(1)>"];

const ctx = { client: "web/2026.11", contentVersion: "v20261105.5d2c847d", now: "2026-11-05T12:00:00.000Z" };
let n = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const make = (kind, fields) => createRecord(kind, fields, { ...ctx, id: nextId() });
const NOW = "2026-11-07T12:00:00.000Z";

test("a marker this code doesn't know is named as the plain note's, never off the prototype (SEC3-5)", () => {
  assert.equal(markerName("question"), "Question");
  for (const marker of HOSTILE) {
    const name = markerName(marker);
    assert.equal(name, "Note", `marker ${String(marker)}`);
  }
});

test("a record over 1 MB as JSON is refused whatever its schema or kind (SEC3-1, decision 7)", () => {
  const big = "x".repeat(MAX_RECORD_BYTES);
  const newerNote = { ...make("note", { bookKey: "john", chapter: 3, verse: 16, body: big, marker: "note" }), schema: SCHEMA_VERSION + 1 };
  assert.ok(recordBytes(newerNote) > MAX_RECORD_BYTES);
  assert.match(validateRecord(newerNote).join(";"), /too large to keep/);
  const newerSheet = { ...make("sheet", { title: "x", modules: [{ id: "m", type: "text", html: big }] }), sheetFormat: SHEET_FORMAT + 1 };
  assert.match(validateRecord(newerSheet).join(";"), /too large to keep/);
  const alien = { ...make("note", { bookKey: "john", chapter: 3, verse: 16, body: "x", marker: "note" }), kind: "voiceMemo", audio: big };
  assert.match(validateRecord(alien).join(";"), /too large to keep/);
  // The import's door: refused with a plain reason, and never written.
  const out = planImport([], [newerNote, newerSheet, alien], { now: NOW });
  assert.deepEqual(out.plan.put, []);
  assert.equal(out.skipped.length, 3);
  for (const s of out.skipped) assert.equal(s.reason, "It is too large to keep (over 1 MB).");
  // A trash record is judged by the merge, but the ceiling holds for it too.
  const trash = { ...trashRecord(make("note", { bookKey: "john", chapter: 3, verse: 16, body: "x", marker: "note" }), { ...ctx, now: NOW, id: nextId() }), extra: big };
  const held = planImport([], [trash], { now: NOW });
  assert.deepEqual(held.plan.put, []);
  assert.equal(held.skipped[0].reason, "It is too large to keep (over 1 MB).");
  // And the store refuses to write one.
  assert.throws(() => planWrite({ put: [newerNote], remove: [] }), /too large/);
  // A real record far below it is untouched: the ceiling is far above every real limit.
  assert.deepEqual(validateRecord({ ...make("note", { bookKey: "john", chapter: 3, verse: 16, body: "x".repeat(60_000), marker: "note" }), schema: SCHEMA_VERSION + 1 }), []);
});

test("a deletion holding a record over 1 MB is kept as its tombstone, not as the record (SEC3-1 with DI3-4)", () => {
  const live = { ...make("note", { bookKey: "john", chapter: 3, verse: 16, body: "x".repeat(MAX_RECORD_BYTES), marker: "note" }), schema: SCHEMA_VERSION + 1 };
  const trash = trashRecord({ ...live, body: "small" }, { ...ctx, now: NOW, id: nextId() });
  const out = planImport([], [{ ...trash, record: live }], { now: NOW });
  assert.equal(out.plan.put.length, 1);
  assert.equal(out.plan.put[0].kind, "trash");
  assert.ok(!("record" in out.plan.put[0]), "the oversized copy is dropped");
  assert.equal(out.warnings.length, 1);
});

test("a bookmark's name and a label's name have a limit (SEC3-4)", () => {
  const long = "n".repeat(BOOKMARK_NAME_MAX + 1);
  assert.match(validateRecord(make("bookmark", { bookKey: "mark", chapter: 4, verse: 35, label: long })).join(";"), /label is too long/);
  assert.deepEqual(validateRecord(make("bookmark", { bookKey: "mark", chapter: 4, verse: 35, label: "n".repeat(BOOKMARK_NAME_MAX) })), []);
  assert.deepEqual(validateRecord(make("bookmark", { bookKey: "mark", chapter: 4, verse: 35, label: "🙂".repeat(BOOKMARK_NAME_MAX) })), [], "counted by character, as the form cuts it");
  assert.match(validateRecord(make("label", { name: "l".repeat(LABEL_NAME_MAX + 1) })).join(";"), /name is too long/);
  assert.deepEqual(validateRecord(make("label", { name: "l".repeat(LABEL_NAME_MAX) })), []);
  const out = planImport([], [make("bookmark", { bookKey: "mark", chapter: 4, verse: 35, label: "n".repeat(5_000_000) }), make("label", { name: "l".repeat(5_000_000) })], { now: NOW });
  assert.deepEqual(out.plan.put, []);
  assert.equal(out.skipped.length, 2);
});

test("a marker that isn't one of the seven draws the plain note's glyph, never other text (SEC Q2)", () => {
  const plain = glyph("note");
  for (const marker of HOSTILE) {
    const svg = glyph(marker);
    assert.equal(svg, plain, `marker ${String(marker)}`);
    assert.ok(!/function|\[object|onerror|undefined/.test(svg));
  }
});

test("a class name built from a marker's draw can't be steered by it (SEC Q2)", () => {
  assert.match(glyph("emphasis", "desk-glyph"), /^<svg class="desk-glyph"/);
});

test("a note body that isn't text, or holds markup, never becomes markup (SEC Q2)", () => {
  const html = noteBodyHtml("<img src=x onerror=alert(1)> John 3:16");
  assert.ok(!/<img/.test(html));
  assert.match(html, /&lt;img/);
});
