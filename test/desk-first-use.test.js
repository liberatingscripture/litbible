// test/desk-first-use.test.js
//
// src/lib/desk-first-use.mjs: the first-time choice, the reminder to save a
// copy, the line for Safari and the tour's bookkeeping. Every rule takes the
// time as an argument, so these run against a fixed `now`.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  HOMES, REMIND_AFTER_DAYS, SAFARI_LINE, TOUR_PARTS, TOUR_STEPS,
  agoPhrase, daysSince, isDesktopSafari, localDay, parseTourState, planTour, readHome, readLastExport,
  reminderDue, reminderText, savedLine, stepBody, tourOffer, wantsReminder, withLater, withNever, withOffered, withSeen,
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
    assert.ok(s.views.length && s.views.every((v) => ["study", "read", "prose"].includes(v)), s.id);
    assert.ok(TOUR_PARTS[s.part], s.id);
    for (const view of s.views) assert.ok(stepBody(s, view).length > 20, `${s.id}/${view}`);
    // Reader-facing prose: no em dashes, no straight quotes.
    for (const text of [s.title, ...Object.values(s.body)]) assert.doesNotMatch(text, /[—"']/);
  }
  assert.match(stepBody(TOUR_STEPS[0], "read"), /“Bookmark,” and “Highlight” while “My highlights” is on/);
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

test("localDay is the local calendar day, zero-padded", () => {
  assert.equal(localDay(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
  assert.equal(localDay(new Date(2026, 9, 14, 0, 1)), "2026-10-14");
  assert.equal(localDay(new Date(2026, 11, 31, 12)), "2026-12-31");
});

test("no tour step id collides with a marker", () => {
  for (const s of TOUR_STEPS) {
    assert.ok(s.id !== "never" && !s.id.startsWith("later:") && !s.id.startsWith("offered"), s.id);
  }
});

test("the tour state reads never and the later day", () => {
  assert.equal(parseTourState(null).never, false);
  assert.equal(parseTourState(null).laterDay, null);
  assert.equal(parseTourState('["never"]').never, true);
  assert.equal(parseTourState('["later:2026-10-14"]').laterDay, "2026-10-14");
  // Malformed markers are ignored but kept in the list.
  const bad = parseTourState('["later:","later:2026-1-4","later:2026-10-14x","later: 2026-10-14","Later:2026-10-14"]');
  assert.equal(bad.laterDay, null);
  assert.equal(bad.list.length, 5);
  // Several somehow: the greatest wins.
  assert.equal(parseTourState('["later:2026-10-14","later:2026-11-02","later:2026-09-30"]').laterDay, "2026-11-02");
  // Offer markers are unaffected.
  const p = parseTourState('["offered","offered:margin","later:2026-10-14","never"]');
  assert.equal(p.offeredWhole, true);
  assert.deepEqual(p.offeredSteps, ["margin"]);
  assert.deepEqual(p.seen, []);
});

test("a later day and a never are recorded without repeating or mutating", () => {
  const start = ["actions", "later:2026-10-10"];
  assert.deepEqual(withLater(start, "2026-10-14"), ["actions", "later:2026-10-14"]);
  assert.deepEqual(start, ["actions", "later:2026-10-10"]);
  assert.deepEqual(withLater([], "2026-10-14"), ["later:2026-10-14"]);

  assert.deepEqual(withNever(["actions", "later:2026-10-14"]), ["actions", "never"]);
  assert.deepEqual(withNever(["never"]), ["never"]);
  assert.deepEqual(withNever([]), ["never"]);
  const l = ["later:2026-10-14"];
  withNever(l);
  assert.deepEqual(l, ["later:2026-10-14"]);
});

test("never ends every offer, first or new", () => {
  assert.equal(tourOffer(JSON.stringify(["never"])).kind, null);
  assert.equal(tourOffer(JSON.stringify(["never"]), { today: "2030-01-01" }).kind, null);
  const some = TOUR_STEPS.map((s) => s.id).slice(0, -2);
  assert.equal(tourOffer(JSON.stringify(some)).kind, "new");
  assert.equal(tourOffer(JSON.stringify(withNever(some))).kind, null);
  assert.equal(tourOffer(JSON.stringify(withNever(some)), { today: "2030-01-01" }).kind, null);
});

test("Remind me later holds the offer until a later day", () => {
  const first = JSON.stringify(withLater([], "2026-10-14"));
  assert.deepEqual(tourOffer(first, { today: "2026-10-14" }), { kind: null, list: ["later:2026-10-14"], snoozed: true });
  assert.equal(tourOffer(first, { today: "2026-10-13" }).snoozed, true);
  assert.equal(tourOffer(first, { today: "2026-10-15" }).kind, "first");
  assert.equal(tourOffer(first, { today: "2026-10-15" }).snoozed, undefined);
  // Without `today`, the later marker isn't consulted.
  assert.equal(tourOffer(first).kind, "first");

  const some = TOUR_STEPS.map((s) => s.id).slice(0, -2);
  const waiting = JSON.stringify(withLater(some, "2026-10-14"));
  assert.equal(tourOffer(waiting, { today: "2026-10-14" }).snoozed, true);
  const back = tourOffer(waiting, { today: "2026-10-15" });
  assert.equal(back.kind, "new");
  assert.equal(back.ids.length, 2);
});

test("old data holding only the offered marker still makes no first offer", () => {
  assert.equal(tourOffer('["offered"]', { today: "2026-10-14" }).kind, null);
  assert.equal(tourOffer('["offered"]').kind, null);
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

test("a tour leaves out the steps that don't belong to the page's view", () => {
  const all = new Set(TOUR_STEPS.map((s) => s.id));
  const read = planTour({ available: all, view: "read" }).map((s) => s.id);
  assert.ok(read.includes("bookmark") && read.includes("ribbon"));
  for (const id of ["note", "margin", "highlight", "pin", "verse", "greek", "widths"]) assert.ok(!read.includes(id), id);
  // An article or the glossary: no notes there in version 1 (N11, BVJ 2026-10-29),
  // so nothing from "Marking the text".
  const prose = planTour({ available: all, view: "prose" }).map((s) => s.id);
  for (const id of ["actions", "note", "margin", "bookmark", "ribbon"]) assert.ok(!prose.includes(id), id);
  assert.ok(prose.length);
});

test("where the browser keeps no notebook, the tour leaves out marking the text and keeping it (BA34)", () => {
  const all = new Set(TOUR_STEPS.map((s) => s.id));
  for (const view of ["study", "read", "prose"]) {
    const ids = planTour({ available: all, view, canKeep: false }).map((s) => s.id);
    assert.ok(ids.length, view);
    for (const s of TOUR_STEPS) {
      if (s.notebook) assert.ok(!ids.includes(s.id), `${view}: ${s.id}`);
    }
    // No step is left from "Marking the text".
    assert.ok(planTour({ available: all, view, canKeep: false }).every((s) => s.part !== 0), view);
  }
  const study = planTour({ available: all, view: "study", canKeep: false }).map((s) => s.id);
  assert.deepEqual(study, ["panel", "verse", "greek", "greek-commands", "widths", "search"]);
  // The default keeps them.
  assert.ok(planTour({ available: all, view: "study" }).some((s) => s.id === "actions"));
});

test("the Greek search commands step follows the Greek step, in Study View only, and is offered as new", () => {
  const all = new Set(TOUR_STEPS.map((s) => s.id));
  const study = planTour({ available: all, view: "study" }).map((s) => s.id);
  assert.equal(study[study.indexOf("greek") + 1], "greek-commands");
  for (const view of ["read", "prose"]) {
    assert.ok(!planTour({ available: all, view }).some((s) => s.id === "greek-commands"), view);
  }
  // It is planned only where its target is (a page without the Greek tab leaves it out).
  const noGreek = new Set([...all].filter((id) => id !== "greek-commands"));
  assert.ok(!planTour({ available: noGreek, view: "study" }).some((s) => s.id === "greek-commands"));

  // A reader who took the tour before it existed is offered it, once, and only it.
  const before = TOUR_STEPS.map((s) => s.id).filter((id) => id !== "greek-commands");
  const offer = tourOffer(JSON.stringify(before));
  assert.equal(offer.kind, "new");
  assert.deepEqual(offer.ids, ["greek-commands"]);
  assert.equal(tourOffer(JSON.stringify(withOffered(before, offer.ids))).kind, null);
  // And a tour of just what is new is that one step.
  const only = planTour({ available: all, only: offer.ids, view: "study" });
  assert.deepEqual(only.map((s) => s.id), ["greek-commands"]);
});

test("each step knows its part and where the next part starts", () => {
  const steps = planTour({ available: new Set(TOUR_STEPS.map((s) => s.id)), view: "study" });
  const firstOfPart = (p) => steps.findIndex((s) => s.part === p);
  assert.equal(steps[0].partName, TOUR_PARTS[0]);
  assert.equal(steps[0].nextPart, firstOfPart(1));
  assert.equal(steps[firstOfPart(1)].nextPart, firstOfPart(2));
  assert.equal(steps.at(-1).nextPart, null, "the last part has nowhere to skip to");
  // Parts run in order, never interleaved.
  assert.deepEqual(steps.map((s) => s.part), [...steps.map((s) => s.part)].sort());
});
