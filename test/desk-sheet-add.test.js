import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ADD_MENU_SHEETS,
  addMenuSheets,
  addedMessage,
  newSheetWithPassage,
  planAddToSheet,
} from "../src/lib/desk-sheet-add.mjs";
import { SHEET_LIMITS } from "../src/lib/desk-sheet-format.mjs";
import { createSheet, makeModule, templateFromSheet } from "../src/lib/desk-sheets.mjs";
import { validateRecord } from "../src/lib/desk-records.mjs";

const ctx = { now: "2026-11-08T12:00:00.000Z", client: "web/test", contentVersion: "test" };
const john316 = { bookKey: "john", chapter: 3, verse: 16, endVerse: 16 };
const sheet = (title, modified, modules) => ({ ...createSheet({ title, modules }, ctx), modified });

test("the flyout lists the reader's sheets, newest change first, at most five", () => {
  const records = Array.from({ length: 7 }, (_, i) => sheet(`S${i}`, `2026-11-0${i + 1}T00:00:00.000Z`));
  const got = addMenuSheets(records);
  assert.equal(got.length, ADD_MENU_SHEETS);
  assert.deepEqual(got.map((s) => s.name), ["S6", "S5", "S4", "S3", "S2"]);
});

test("templates, other records, newer formats and full sheets stay off the list", () => {
  const mine = sheet("Mine", "2026-11-01T00:00:00.000Z");
  const template = templateFromSheet(mine, ctx);
  const newer = { ...sheet("Newer", "2026-11-02T00:00:00.000Z"), sheetFormat: 999 };
  const full = sheet("Full", "2026-11-03T00:00:00.000Z", Array.from({ length: SHEET_LIMITS.modules }, () => makeModule("text")));
  const note = { kind: "note", id: "n1" };
  assert.deepEqual(addMenuSheets([mine, template, newer, full, note]).map((s) => s.name), ["Mine"]);
});

test("an untitled sheet is named as the lists name it", () => {
  assert.equal(addMenuSheets([sheet("", "2026-11-01T00:00:00.000Z")])[0].name, "Untitled sheet");
});

test("a passage goes after the sheet's last passage, as a valid sheet", () => {
  const s = createSheet({ title: "Study", modules: [makeModule("text"), makeModule("passage", { bookKey: "mark", chapter: 1, verse: 1, endVerse: 1 }), makeModule("question")] }, ctx);
  const plan = planAddToSheet(s, john316, ctx);
  assert.equal(plan.changed, true);
  assert.equal(plan.again, false);
  assert.deepEqual(plan.sheet.modules.map((m) => m.type), ["text", "passage", "passage", "question"]);
  assert.equal(plan.sheet.modules[2].bookKey, "john");
  assert.deepEqual(plan.put, [plan.sheet]);
  assert.deepEqual(validateRecord(plan.sheet), []);
});

test("the same words again are added and said to be again", () => {
  const s = createSheet({ title: "Study", modules: [makeModule("passage", john316)] }, ctx);
  const plan = planAddToSheet(s, john316, ctx);
  assert.equal(plan.again, true);
  assert.equal(plan.sheet.modules.length, 2);
});

test("a full sheet, a deleted one or a newer format writes nothing", () => {
  const full = createSheet({ modules: Array.from({ length: SHEET_LIMITS.modules }, () => makeModule("text")) }, ctx);
  assert.equal(planAddToSheet(full, john316, ctx).full, true);
  assert.equal(planAddToSheet(undefined, john316, ctx).gone, true);
  assert.equal(planAddToSheet({ ...createSheet({}, ctx), sheetFormat: 999 }, john316, ctx).gone, true);
});

test("New sheet holds the passage alone, named after it", () => {
  const s = newSheetWithPassage(john316, ctx);
  assert.equal(s.title, "John 3:16");
  assert.equal(s.template, "blank");
  assert.deepEqual(s.modules.map((m) => m.type), ["passage"]);
  assert.deepEqual(validateRecord(s), []);
});

test("what the undo bar says", () => {
  assert.equal(addedMessage(john316, "Easter"), "John 3:16 added to “Easter.”");
  assert.equal(addedMessage(john316, "Easter", { again: true }), "John 3:16 added to “Easter” again; it was already there.");
  assert.equal(addedMessage(john316, "John 3:16", { made: true }), "John 3:16 is on a new sheet, “John 3:16.”");
});

test("Add to sheet is Chapter View's: /desk's LIT pane keeps its own add", () => {
  const src = readFileSync(new URL("../src/scripts/desk/sheets/sheet-add.js", import.meta.url), "utf8");
  assert.match(src, /if \(d\.view !== "study"\) return null;/);
});
