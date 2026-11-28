// test/desk-reminder.test.js
//
// src/lib/desk-reminder.mjs (E113, BVJ 2026-11-13; Featherboa's Phase 5): when
// a backup is due and the words of the Notebook's foot line. The reminder's bar,
// its checkbox and its put-offs are gone, and nothing writes their keys. Every
// rule takes the time as an argument, so these run against a fixed `now`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  BACK_UP, KEPT_HERE, KEPT_LINKED, REMIND_AFTER_DAYS, backupDue, backupLede, footLine, notebookIntro, savedLine,
} from "../src/lib/desk-reminder.mjs";
import * as firstUse from "../src/lib/desk-first-use.mjs";
import * as reminder from "../src/lib/desk-reminder.mjs";

const NOW = new Date("2026-11-13T15:30:00");
const ago = (days, extraHours = 0) => new Date(NOW.getTime() - days * 86_400_000 - extraHours * 3_600_000).toISOString();
const base = { hasRecords: true, now: NOW };

test("due when the last backup is a week old", () => {
  assert.equal(REMIND_AFTER_DAYS, 7);
  assert.equal(backupDue({ ...base, lastExport: ago(7) }), true);
  assert.equal(backupDue({ ...base, lastExport: ago(40) }), true);
  assert.equal(backupDue({ ...base, lastExport: ago(6, 23) }), false);
  assert.equal(backupDue({ ...base, lastExport: ago(0) }), false);
});

test("with no backup yet, due by the oldest record's age", () => {
  assert.equal(backupDue({ ...base, lastExport: null, oldest: ago(7) }), true);
  assert.equal(backupDue({ ...base, lastExport: null, oldest: ago(6) }), false);
  assert.equal(backupDue({ ...base, lastExport: null, oldest: null }), false);
  // A backup on record wins over the age of the oldest record.
  assert.equal(backupDue({ ...base, lastExport: ago(1), oldest: ago(90) }), false);
});

test("not due when the notebook is empty", () => {
  assert.equal(backupDue({ ...base, hasRecords: false, lastExport: ago(30) }), false);
  assert.equal(backupDue({ ...base, hasRecords: false, oldest: ago(30) }), false);
});

test("the saved line counts days, or says there has been no backup", () => {
  assert.equal(savedLine(ago(9), NOW), "Last backed up 9 days ago.");
  assert.equal(savedLine(ago(1), NOW), "Last backed up yesterday.");
  assert.equal(savedLine(ago(0), NOW), "Last backed up today.");
  assert.equal(savedLine(null, NOW), "Not backed up yet.");
});

test("UX9b-2: where the notebook syncs, the saved line names the file", () => {
  assert.equal(savedLine(ago(9), NOW, { linked: true }), "Last backed up to a file 9 days ago.");
  assert.equal(savedLine(null, NOW, { linked: true }), "Not backed up to a file yet.");
  assert.equal(savedLine(null, NOW, { linked: false }), "Not backed up yet.");
});

test("the foot line's four states", () => {
  const facts = { ...base, lastExport: ago(2) };
  assert.deepEqual(footLine({ ...facts, linked: true }), { text: KEPT_LINKED, due: false, backUp: false });
  assert.deepEqual(footLine(facts), { text: KEPT_HERE, due: false, backUp: true });
  assert.deepEqual(footLine({ ...base, lastExport: ago(9) }), { text: "Last backed up 9 days ago.", due: true, backUp: true });
  assert.deepEqual(footLine({ now: NOW }), { text: KEPT_HERE, due: false, backUp: false });
  // The words.
  assert.equal(KEPT_HERE, "Kept in this browser only.");
  assert.equal(KEPT_LINKED, "Kept in this browser and in your account.");
  assert.equal(BACK_UP, "Back up…");
});

test("a linked notebook is never told it is kept in one browser only (step 4g's list)", () => {
  for (const lastExport of [null, ago(1), ago(30)]) {
    const { text } = footLine({ ...base, lastExport, oldest: ago(90), linked: true, now: NOW });
    assert.doesNotMatch(text, /only/);
    assert.match(text, /account/);
  }
  assert.match(notebookIntro(false), /never leaves this browser/);
  assert.doesNotMatch(notebookIntro(true), /never leaves/);
  assert.match(backupLede(true), /Your account keeps a synced copy too/);
  assert.doesNotMatch(backupLede(false), /account/);
});

test("the reminder's bar and its rules are gone", () => {
  for (const name of [
    "HOME_KEY", "REMIND_KEY", "PUT_OFF_KINDS", "WEEK_SAID", "TOMORROW_SAID", "backedUpSaid", "remindersOffSaid",
    "reminderDue", "reminderState", "reminderText", "putOffValue", "readPutOff", "startOfTomorrow", "wantsReminder",
  ]) {
    assert.ok(!(name in reminder), name);
  }
});

test("desk-first-use.mjs re-exports the rules, so its callers keep working", () => {
  for (const name of ["backupDue", "footLine", "REMIND_AFTER_DAYS", "savedLine", "KEPT_HERE", "KEPT_LINKED", "BACK_UP"]) {
    assert.ok(name in firstUse, name);
  }
});

test("stage one never imports the module that pulls in the layout rules", () => {
  for (const f of ["../src/scripts/desk/first-stage.js", "../src/scripts/desk/reminder.js", "../src/lib/desk-first-stage.mjs"]) {
    assert.doesNotMatch(readFileSync(new URL(f, import.meta.url), "utf8"), /desk-first-use\.mjs/, f);
  }
});
