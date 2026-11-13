// test/desk-reminder.test.js
//
// src/lib/desk-reminder.mjs (E113, BVJ 2026-11-13): when the backup reminder
// is due, what it says, and how a put-off is kept. Every rule takes the time
// as an argument, so these run against a fixed `now`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  HOME_KEY, REMIND_AFTER_DAYS, REMIND_KEY, PUT_OFF_KINDS, WEEK_SAID, TOMORROW_SAID, backedUpSaid,
  putOffValue, readPutOff, reminderDue, reminderState, reminderText, remindersOffSaid, startOfTomorrow, wantsReminder,
} from "../src/lib/desk-reminder.mjs";
import * as firstUse from "../src/lib/desk-first-use.mjs";
import { META_STORE, LAST_EXPORT_META, REMIND_HOME, REMIND_HOME_KEY } from "../src/lib/desk-first-stage.mjs";

const NOW = new Date("2026-11-13T15:30:00");
const ago = (days, extraHours = 0) => new Date(NOW.getTime() - days * 86_400_000 - extraHours * 3_600_000).toISOString();
const base = { home: "browser-remind", hasRecords: true, now: NOW };

test("due when the last backup is a week old", () => {
  assert.equal(REMIND_AFTER_DAYS, 7);
  assert.equal(reminderDue({ ...base, lastExport: ago(7) }), true);
  assert.equal(reminderDue({ ...base, lastExport: ago(40) }), true);
  assert.equal(reminderDue({ ...base, lastExport: ago(6, 23) }), false);
  assert.equal(reminderDue({ ...base, lastExport: ago(0) }), false);
});

test("with no backup yet, due by the oldest record's age", () => {
  assert.equal(reminderDue({ ...base, lastExport: null, oldest: ago(7) }), true);
  assert.equal(reminderDue({ ...base, lastExport: null, oldest: ago(6) }), false);
  assert.equal(reminderDue({ ...base, lastExport: null, oldest: null }), false);
  // A backup on record wins over the age of the oldest record.
  assert.equal(reminderDue({ ...base, lastExport: ago(1), oldest: ago(90) }), false);
});

test("not due when reminders are off or the notebook is empty", () => {
  assert.equal(reminderDue({ ...base, home: "browser", lastExport: ago(30) }), false);
  assert.equal(reminderDue({ ...base, home: null, lastExport: ago(30) }), false);
  assert.equal(reminderDue({ ...base, hasRecords: false, lastExport: ago(30) }), false);
});

test("the message counts days, or says there has been no backup", () => {
  assert.equal(reminderText(ago(9), NOW), "It’s been 9 days since you backed up your notebook.");
  assert.equal(reminderText(ago(1), NOW), "It’s been 1 day since you backed up your notebook.");
  assert.equal(reminderText(null, NOW), "You haven’t backed up your notebook yet.");
});

test("a put-off lasts until tomorrow, or a week", () => {
  const tomorrow = JSON.parse(putOffValue("tomorrow", NOW));
  assert.equal(tomorrow.kind, "tomorrow");
  assert.equal(tomorrow.until, startOfTomorrow(NOW).toISOString());
  assert.equal(startOfTomorrow(NOW).getHours(), 0);
  const week = JSON.parse(putOffValue("week", NOW));
  assert.equal(week.kind, "week");
  assert.equal(Date.parse(week.until) - NOW.getTime(), 7 * 86_400_000);
  assert.deepEqual(PUT_OFF_KINDS, ["tomorrow", "week"]);
});

test("a put-off is read defensively and expires", () => {
  assert.equal(readPutOff(putOffValue("tomorrow", NOW), NOW)?.kind, "tomorrow");
  const later = new Date(NOW.getTime() + 86_400_000);
  assert.equal(readPutOff(putOffValue("tomorrow", NOW), later), null, "tomorrow has come");
  assert.equal(readPutOff(putOffValue("week", NOW), later)?.kind, "week");
  for (const stray of [null, undefined, "", "soon", "{", "[]", "5", '{"kind":"month","until":"2099-01-01"}', '{"kind":"week"}', '{"kind":"week","until":"x"}', { kind: 3 }]) {
    assert.equal(readPutOff(stray, NOW), null, String(stray));
  }
});

test("state: the bar, and the dots, by what was put off", () => {
  const facts = { ...base, lastExport: ago(9) };
  const open = reminderState(facts);
  assert.equal(open.due, true);
  assert.equal(open.bar, true);
  assert.equal(open.dots, true);
  assert.equal(open.text, "It’s been 9 days since you backed up your notebook.");

  const tomorrow = reminderState({ ...facts, putOff: putOffValue("tomorrow", NOW) });
  assert.equal(tomorrow.bar, false, "the bar waits");
  assert.equal(tomorrow.dots, true, "the dot and the Settings notice stay");

  const week = reminderState({ ...facts, putOff: putOffValue("week", NOW) });
  assert.equal(week.bar, false);
  assert.equal(week.dots, false, "everything waits a week");

  const stray = reminderState({ ...facts, putOff: "garbage" });
  assert.equal(stray.bar, true, "a stray stored value is no put-off");

  const off = reminderState({ ...facts, home: "browser", putOff: null });
  assert.deepEqual([off.due, off.bar, off.dots], [false, false, false]);

  const recent = reminderState({ ...base, lastExport: ago(1) });
  assert.deepEqual([recent.due, recent.bar, recent.dots], [false, false, false]);
});

test("the words the bar says afterward", () => {
  assert.equal(TOMORROW_SAID, "You’ll be reminded tomorrow.");
  assert.equal(WEEK_SAID, "You’ll be reminded in a week.");
  assert.equal(backedUpSaid("lit-notebook-2026-11-13.json"), "Started the download of lit-notebook-2026-11-13.json. Your browser may ask where to keep it.");
  assert.equal(backedUpSaid(undefined), "Started the download of your backup. Your browser may ask where to keep it.");
  assert.equal(remindersOffSaid(false), "Reminders are off. You can turn them on again in the Notebook’s Settings.");
  assert.equal(remindersOffSaid(true), "Reminders are off. You can turn them on again in the Notebook’s Settings on a chapter page.");
  for (const s of [TOMORROW_SAID, WEEK_SAID, backedUpSaid("x.json"), remindersOffSaid(true)]) assert.doesNotMatch(s, /—/);
});

test("desk-first-use.mjs re-exports the rules, so its callers keep working", () => {
  for (const name of ["reminderDue", "reminderText", "reminderState", "REMIND_AFTER_DAYS", "savedLine", "REMIND_KEY", "HOME_KEY"]) {
    assert.ok(name in firstUse, name);
  }
});

test("the keys and names stage one peeks with are the store's", () => {
  const store = readFileSync(new URL("../src/scripts/desk/store.js", import.meta.url), "utf8");
  assert.equal(HOME_KEY, "lit-desk-home");
  assert.equal(REMIND_KEY, "lit-desk-remind");
  assert.equal(REMIND_HOME_KEY, HOME_KEY);
  assert.ok(wantsReminder(REMIND_HOME));
  assert.match(store, new RegExp(`["']${META_STORE}["']`));
  assert.match(readFileSync(new URL("../src/scripts/desk/backup-file.js", import.meta.url), "utf8"), new RegExp(`["']${LAST_EXPORT_META}["']`));
  assert.match(store, /getMeta/);
});

test("stage one never imports the module that pulls in the layout rules", () => {
  for (const f of ["../src/scripts/desk/first-stage.js", "../src/scripts/desk/reminder.js", "../src/lib/desk-first-stage.mjs"]) {
    assert.doesNotMatch(readFileSync(new URL(f, import.meta.url), "utf8"), /desk-first-use\.mjs/, f);
  }
});

test("stage one loads the reminder's code only for a reader who asked for reminders", () => {
  // A static import would put reminder.js and its rules in every chapter page's first download.
  const src = readFileSync(new URL("../src/scripts/desk/first-stage.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /^import[^;]*["']\.\/reminder\.js["']/m);
  assert.match(src, /readLocal\(REMIND_HOME_KEY\) !== REMIND_HOME\) return;\s*import\("\.\/reminder\.js"\)/);
});
