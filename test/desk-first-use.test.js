// test/desk-first-use.test.js
//
// src/lib/desk-first-use.mjs: the first-time choice, the reminder to save a
// copy, the line for Safari and the tour's bookkeeping. Every rule takes the
// time as an argument, so these run against a fixed `now`.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  HOMES, REMIND_AFTER_DAYS, SAFARI_LINE, TOUR_STEPS,
  agoPhrase, daysSince, isDesktopSafari, parseTourState, planTour, readHome, readLastExport,
  reminderDue, reminderText, savedLine, stepBody, tourOffer, wantsReminder, withOffered, withSeen,
} from "../src/lib/desk-first-use.mjs";

const NOW = new Date("2026-10-12T12:00:00Z");
const ago = (days, extraHours = 0) => new Date(NOW.getTime() - days * 86_400_000 - extraHours * 3_600_000).toISOString();

test("a stored choice reads only when it is one of the two", () => {
  assert.deepEqual(HOMES, ["browser", "browser-remind"]);
  assert.equal(readHome("browser"), "browser");
  assert.equal(readHome("browser-remind"), "browser-remind");
  for (const bad of [null, undefined, "", "account", "file", "Browser"]) assert.equal(readHome(bad), null);
  assert.equal(wantsReminder("browser-remind"), true);
  assert.equal(wantsReminder("browser"), false);
  assert.equal(wantsReminder(null), false);
});

test("lastExport reads as an ISO string, or as never", () => {
  assert.equal(readLastExport(ago(2)), ago(2));
  assert.equal(readLastExport({ at: ago(2) }), ago(2));
  for (const bad of [undefined, null, "", "yesterday", 5, {}, { at: 4 }]) assert.equal(readLastExport(bad), null);
});

test("days since counts whole days, never negative", () => {
  assert.equal(daysSince(ago(0, 5), NOW), 0);
  assert.equal(daysSince(ago(3, 1), NOW), 3);
  assert.equal(daysSince(ago(7), NOW), 7);
  assert.equal(daysSince(new Date(NOW.getTime() + 3_600_000).toISOString(), NOW), 0);
  assert.equal(daysSince("nonsense", NOW), null);
  assert.equal(daysSince(null, NOW), null);
});

test("how long ago is said in plain words", () => {
  assert.equal(agoPhrase(0), "today");
  assert.equal(agoPhrase(1), "yesterday");
  assert.equal(agoPhrase(3), "3 days ago");
});

test("the foot says when a copy was last saved", () => {
  assert.equal(savedLine(undefined, NOW), "No copy saved yet.");
  assert.equal(savedLine("garbage", NOW), "No copy saved yet.");
  assert.equal(savedLine(ago(0, 2), NOW), "Last saved a copy today.");
  assert.equal(savedLine(ago(1), NOW), "Last saved a copy yesterday.");
  assert.equal(savedLine(ago(3), NOW), "Last saved a copy 3 days ago.");
});

test("the reminder is due after a week, or with no copy, only for those who asked and with something to lose", () => {
  const base = { home: "browser-remind", hasRecords: true, now: NOW };
  assert.equal(reminderDue({ ...base, lastExport: undefined }), true);
  assert.equal(reminderDue({ ...base, lastExport: ago(REMIND_AFTER_DAYS) }), true);
  assert.equal(reminderDue({ ...base, lastExport: ago(30) }), true);
  assert.equal(reminderDue({ ...base, lastExport: ago(REMIND_AFTER_DAYS - 1, 23) }), false);
  assert.equal(reminderDue({ ...base, lastExport: ago(0) }), false);
  // Not asked for, or nothing to lose.
  assert.equal(reminderDue({ ...base, home: "browser", lastExport: undefined }), false);
  assert.equal(reminderDue({ ...base, home: null, lastExport: ago(30) }), false);
  assert.equal(reminderDue({ ...base, hasRecords: false, lastExport: ago(30) }), false);
});

test("the reminder says how many days, or that there is no copy yet", () => {
  assert.equal(reminderText(ago(9), NOW), "It’s been 9 days since you saved a copy.");
  assert.equal(reminderText(ago(1), NOW), "It’s been 1 day since you saved a copy.");
  assert.equal(reminderText(undefined, NOW), "You haven’t saved a copy yet.");
});

test("desktop Safari is told apart from the browsers that borrow its name", () => {
  const safari =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
  const chrome =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
  const edge = `${chrome} Edg/126.0.0.0`;
  const opera = `${chrome} OPR/110.0.0.0`;
  const firefox = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0";
  const iphone =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  const windowsChrome =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
  assert.equal(isDesktopSafari(safari), true);
  for (const ua of [chrome, edge, opera, firefox, iphone, windowsChrome, "", undefined]) {
    assert.equal(isDesktopSafari(ua), false, String(ua));
  }
  assert.match(SAFARI_LINE, /seven days/);
});

test("the tour's steps have unique ids and wording for every view they may meet", () => {
  const ids = TOUR_STEPS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of TOUR_STEPS) {
    for (const view of ["study", "read", "prose"]) assert.ok(stepBody(s, view).length > 20, `${s.id}/${view}`);
    // Reader-facing prose: no em dashes, no straight quotes.
    for (const text of [s.title, ...Object.values(s.body)]) assert.doesNotMatch(text, /[—"']/);
  }
  assert.match(stepBody(TOUR_STEPS[0], "read"), /Bookmark and Highlight/);
  assert.doesNotMatch(stepBody(TOUR_STEPS[0], "read"), /Add a note/);
});

test("the tour state reads a list of strings and nothing else", () => {
  assert.deepEqual(parseTourState(null).seen, []);
  assert.deepEqual(parseTourState("not json").seen, []);
  assert.deepEqual(parseTourState('{"a":1}').seen, []);
  assert.deepEqual(parseTourState('["actions", 5, "margin"]').seen, ["actions", "margin"]);
  // Ids this code doesn't know are kept in the list, not counted as steps.
  const p = parseTourState('["actions","future-step","offered","offered:margin"]');
  assert.deepEqual(p.seen, ["actions"]);
  assert.equal(p.offeredWhole, true);
  assert.deepEqual(p.offeredSteps, ["margin"]);
  assert.deepEqual(p.list, ["actions", "future-step", "offered", "offered:margin"]);
});

test("marking steps seen or offered adds without repeating", () => {
  assert.deepEqual(withSeen(["a"], ["a", "b"]), ["a", "b"]);
  assert.deepEqual(withOffered([]), ["offered"]);
  assert.deepEqual(withOffered(["offered"]), ["offered"]);
  assert.deepEqual(withOffered([], ["x", "y"]), ["offered:x", "offered:y"]);
});

test("the whole tour is offered once, then never unasked", () => {
  assert.equal(tourOffer(null).kind, "first");
  assert.equal(tourOffer("[]").kind, "first");
  const offered = JSON.stringify(withOffered([]));
  assert.equal(tourOffer(offered).kind, null);
});

test("a reader who has seen the tour is offered only what is new, once", () => {
  const all = TOUR_STEPS.map((s) => s.id);
  assert.equal(tourOffer(JSON.stringify(all)).kind, null);

  // A later phase adds steps: simulate by a reader who saw all but two.
  const some = all.slice(0, -2);
  const offer = tourOffer(JSON.stringify(some));
  assert.equal(offer.kind, "new");
  assert.deepEqual(offer.ids, all.slice(-2));

  // Once those were offered, they are not offered again.
  const after = JSON.stringify(withOffered(some, offer.ids));
  assert.equal(tourOffer(after).kind, null);
});

test("a tour takes the steps whose target is on the page, numbered", () => {
  const steps = planTour({ available: new Set(["actions", "panel", "kept", "search"]) });
  assert.deepEqual(steps.map((s) => s.id), ["actions", "panel", "search", "kept"]);
  assert.deepEqual(steps.map((s) => `${s.number} of ${s.of}`), ["1 of 4", "2 of 4", "3 of 4", "4 of 4"]);

  const fresh = planTour({ available: new Set(TOUR_STEPS.map((s) => s.id)), only: ["kept", "gone"] });
  assert.deepEqual(fresh.map((s) => s.id), ["kept"]);
  assert.equal(fresh[0].of, 1);

  assert.deepEqual(planTour({ available: new Set() }), []);
});
