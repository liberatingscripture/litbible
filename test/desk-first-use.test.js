// test/desk-first-use.test.js
//
// src/lib/desk-first-use.mjs: the first-time choice, the reminder to save a
// copy, the line for Safari and the tour's bookkeeping. Every rule takes the
// time as an argument, so these run against a fixed `now`.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CONTACT_HREF, DESK_STAGE, DESK_TOUR_LINK, DESK_TOUR_PARTS, DESK_TOUR_STEPS, HOMES, REMIND_AFTER_DAYS, SAFARI_LINE,
  DESK_TOUR_KEY, SHEET_TOUR_KEY, SHEET_TOUR_LINK, SHEET_TOUR_PAGE_LINK, SHEET_TOUR_PARTS, SHEET_TOUR_STEPS,
  TOUR_KEY, TOUR_LINK, TOUR_PARTS, TOUR_STEPS,
  FEEDBACK_HREF, FEEDBACK_LABEL, agoPhrase, daysSince, isDesktopSafari, localDay, parseTourState, planTour, readHome, readLastExport,
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
  assert.match(stepBody(TOUR_STEPS[0], "read"), /“Highlight” while “My highlights” is on in Display options, and “Add bookmark\.”/);
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
  assert.ok(read.includes("actions"));
  for (const id of ["note", "margin", "pin", "verse", "greek"]) assert.ok(!read.includes(id), id);
  // An article or the glossary: no notes there in version 1 (N11, BVJ 2026-10-29),
  // so nothing from "Marking the text".
  const prose = planTour({ available: all, view: "prose" }).map((s) => s.id);
  for (const id of ["actions", "note", "margin"]) assert.ok(!prose.includes(id), id);
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
  assert.deepEqual(study, ["panel", "verse", "greek", "search"]);
  // The default keeps them.
  assert.ok(planTour({ available: all, view: "study" }).some((s) => s.id === "actions"));
});

test("the removed Greek search commands step is gone, and a reader who saw it is not offered a new tour for it (2026-11-02)", () => {
  assert.ok(!TOUR_STEPS.some((s) => s.id === "greek-commands"));
  // The Greek step still comes after "This verse" and before the third part, in Chapter View only.
  const all = new Set(TOUR_STEPS.map((s) => s.id));
  const study = planTour({ available: all, view: "study" }).map((s) => s.id);
  assert.equal(study[study.indexOf("greek") + 1], "undo");
  // A reader who took the tour while the step existed has its id stored: it
  // is ignored as an unknown id, offers nothing, and is kept in their list.
  const stored = [...TOUR_STEPS.map((s) => s.id), "greek-commands"];
  const state = parseTourState(JSON.stringify(stored));
  assert.ok(!state.seen.includes("greek-commands"));
  assert.ok(state.list.includes("greek-commands"));
  assert.equal(tourOffer(JSON.stringify(stored)).kind, null);
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

/* ── The Study Desk tour (E24) ── */

test("the Study Desk tour has its own steps, wording and parts", () => {
  const ids = DESK_TOUR_STEPS.map((s) => s.id);
  // Sheets and New sheet joined on 2026-11-08 (E59; BVJ: the tour should have a step about sheets).
  assert.deepEqual(ids, ["panes", "mine", "sync", "stay", "sheets", "title", "newsheet", "add", "layout"]);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of DESK_TOUR_STEPS) {
    assert.ok(DESK_TOUR_PARTS[s.part], s.id);
    assert.ok(stepBody(s, null).length > 20, s.id);
    // Reader-facing prose: no em dashes, no straight quotes.
    for (const text of [s.title, s.more ?? "", ...Object.values(s.body)]) assert.doesNotMatch(text, /[—"']/, s.id);
    assert.ok(s.id !== "never" && !s.id.startsWith("later:") && !s.id.startsWith("offered"), s.id);
  }
  // Parts run in order, never interleaved.
  assert.deepEqual(DESK_TOUR_STEPS.map((s) => s.part), [...DESK_TOUR_STEPS.map((s) => s.part)].sort());
  // The wording BVJ chose for the third step (2026-11-02), with the clause
  // saying the second LIT pane is the tour's (Audit 4, TR4-6; BVJ, 2026-11-07).
  assert.equal(DESK_TOUR_STEPS[2].title, "Reading in sync");
  assert.match(stepBody(DESK_TOUR_STEPS[2], null), /follow the LIT pane\. Move through the LIT, and they move with it\. With two LIT panes open, as here for the tour, the one you selected most recently is marked with a flag\.$/);
});

test("the three tours share no step id, so each one's list means only its own", () => {
  const notebook = new Set(TOUR_STEPS.map((s) => s.id));
  for (const s of DESK_TOUR_STEPS) assert.ok(!notebook.has(s.id), s.id);
  // The Sheets tour (E63) joined them on 2026-11-09.
  const desk = new Set(DESK_TOUR_STEPS.map((s) => s.id));
  for (const s of SHEET_TOUR_STEPS) assert.ok(!notebook.has(s.id) && !desk.has(s.id), s.id);
});

test("the Study Desk tour has an address of its own, beside the notebook tour's", () => {
  assert.equal(DESK_TOUR_LINK, "/desk/?desk-tour");
  assert.equal(TOUR_LINK, "/john-3/?desk-tour");
});

test("a reader of one tour is a first-time reader of the other", () => {
  const notebookDone = JSON.stringify(TOUR_STEPS.map((s) => s.id));
  // The notebook's list says nothing about the desk's steps, and the reverse.
  assert.equal(tourOffer(notebookDone, { steps: DESK_TOUR_STEPS }).kind, "first");
  const deskDone = JSON.stringify(DESK_TOUR_STEPS.map((s) => s.id));
  assert.equal(tourOffer(deskDone, { steps: DESK_TOUR_STEPS }).kind, null);
  assert.equal(tourOffer(deskDone).kind, "first");
  // Ids of the other tour are kept in the list but not counted as seen.
  const p = parseTourState(JSON.stringify(["actions", "panes"]), DESK_TOUR_STEPS);
  assert.deepEqual(p.seen, ["panes"]);
  assert.deepEqual(p.list, ["actions", "panes"]);
});

test("the Study Desk tour's offer follows the same markers: later, never, new steps", () => {
  const first = tourOffer(null, { today: "2026-11-02", steps: DESK_TOUR_STEPS });
  assert.equal(first.kind, "first");
  // "Remind me later" is written as soon as the offer is shown.
  const waiting = JSON.stringify(withLater(first.list, "2026-11-02"));
  assert.equal(tourOffer(waiting, { today: "2026-11-02", steps: DESK_TOUR_STEPS }).snoozed, true);
  // Without a day (the title menu's quiet line asks this), the reader is still owed the tour.
  assert.equal(tourOffer(waiting, { steps: DESK_TOUR_STEPS }).kind, "first");
  assert.equal(tourOffer(waiting, { today: "2026-11-03", steps: DESK_TOUR_STEPS }).kind, "first");
  // "Don't show this again" ends the line and the offers of new steps.
  const never = JSON.stringify(withNever(first.list));
  assert.equal(tourOffer(never, { steps: DESK_TOUR_STEPS }).kind, null);
  // A later step is offered alone, once.
  const some = DESK_TOUR_STEPS.map((s) => s.id).slice(0, -1);
  const offer = tourOffer(JSON.stringify(some), { steps: DESK_TOUR_STEPS });
  assert.equal(offer.kind, "new");
  assert.deepEqual(offer.ids, ["layout"]);
  assert.equal(tourOffer(JSON.stringify(withOffered(some, offer.ids)), { steps: DESK_TOUR_STEPS }).kind, null);
});

test("planning the Study Desk tour numbers its steps, splits it in two parts and leaves out what can't be shown", () => {
  const all = new Set(DESK_TOUR_STEPS.map((s) => s.id));
  const plan = planTour({ available: all, steps: DESK_TOUR_STEPS, parts: DESK_TOUR_PARTS });
  assert.deepEqual(plan.map((s) => `${s.number} of ${s.of}`), Array.from({ length: 9 }, (_, i) => `${i + 1} of 9`));
  assert.equal(plan[0].partName, "What’s on the desk");
  assert.equal(plan[0].nextPart, 5);
  assert.equal(plan[5].partName, "Changing the desk");
  assert.equal(plan.at(-1).nextPart, null);
  // Where the browser keeps no notebook, My Notes is left out.
  const bare = planTour({ available: all, canKeep: false, steps: DESK_TOUR_STEPS, parts: DESK_TOUR_PARTS });
  // My Notes and New sheet (a sheet is kept in the notebook) are left out.
  assert.deepEqual(bare.map((s) => s.id), ["panes", "sync", "stay", "sheets", "title", "add", "layout"]);
  // A step whose target isn't there (no room for another pane) is left out.
  const cramped = new Set(all);
  cramped.delete("add");
  assert.ok(!planTour({ available: cramped, steps: DESK_TOUR_STEPS, parts: DESK_TOUR_PARTS }).some((s) => s.id === "add"));
});

test("Audit 7's wording: the desk tour's cards name what the page has now, and the notebook tour's first names Add to sheet", () => {
  const desk = (id) => DESK_TOUR_STEPS.find((s) => s.id === id);
  // TR7-5: the Sheets card links the Sheets tour, as My Notes links the notebook tour.
  assert.equal(desk("sheets").more, "See one made, printed, and presented: the Sheets tour");
  assert.ok(desk("mine").more);
  // TR7-1: seven templates since Audit 5, so the card lists none of them in full.
  assert.doesNotMatch(stepBody(desk("newsheet"), null), /sermon preparation, a class session/);
  // TR7-2: Full screen (E43) and My notebook page are in the title menu; E68:
  // the card names the command row first.
  assert.match(stepBody(desk("title"), null), /^Under the header: Add pane, Layout, New sheet, Print, and Help\./);
  assert.match(stepBody(desk("title"), null), /full screen/);
  assert.match(stepBody(desk("title"), null), /My Notebook/);
  // TR7-3: "Add to sheet" in Chapter View's verse menu (PR #520); Read View has none.
  assert.match(stepBody(TOUR_STEPS[0], "study"), /“Add to sheet”/);
  assert.doesNotMatch(stepBody(TOUR_STEPS[0], "read"), /Add to sheet/);
});

/* ── The feedback invitation (Phase 6) ── */

test("the feedback invitation names the stage and opens the contact form about the desk", () => {
  assert.equal(DESK_STAGE, "preview", "the label changes to beta at the public launch, in this one constant");
  assert.equal(FEEDBACK_LABEL, `Send feedback on the ${DESK_STAGE}`);
  assert.ok(FEEDBACK_HREF.startsWith(CONTACT_HREF));
  assert.equal(new URL(FEEDBACK_HREF, "https://litbible.net").searchParams.get("about"), "study-desk");
});

/* ── The Sheets tour (E63) ── */

test("the Sheets tour has its own eight steps, wording and parts", () => {
  const ids = SHEET_TOUR_STEPS.map((s) => s.id);
  assert.deepEqual(ids, ["list", "templates", "parts", "passage", "blanks", "words", "print", "present"]);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(SHEET_TOUR_PARTS, ["Making a sheet", "Using a sheet"]);
  for (const s of SHEET_TOUR_STEPS) {
    assert.ok(SHEET_TOUR_PARTS[s.part], s.id);
    assert.ok(stepBody(s, null).length > 20, s.id);
    // Reader-facing prose: no em dashes, no straight quotes.
    for (const text of [s.title, s.more ?? "", ...Object.values(s.body)]) assert.doesNotMatch(text, /[—"']/, s.id);
    assert.ok(s.id !== "never" && !s.id.startsWith("later:") && !s.id.startsWith("offered"), s.id);
    // A sheet is a notebook record: no notebook, no tour.
    assert.equal(s.notebook, true, s.id);
    assert.equal(s.views, undefined, s.id);
  }
  // Parts run in order, never interleaved.
  assert.deepEqual(SHEET_TOUR_STEPS.map((s) => s.part), [...SHEET_TOUR_STEPS.map((s) => s.part)].sort());
});

test("the Sheets tour has an address of its own on /desk, and one on the Sheets page", () => {
  assert.equal(SHEET_TOUR_LINK, "/desk/?sheet-tour");
  assert.equal(SHEET_TOUR_PAGE_LINK, "/sheets/?sheet-tour");
});

test("the Sheets tour has the Sheets page's wording where the two pages differ (E63)", () => {
  // "present" read alike once the Sheets pane's "Present…" lost its ellipsis (E71).
  const differs = ["list", "templates", "passage", "print"];
  for (const s of SHEET_TOUR_STEPS) {
    const page = stepBody(s, "page");
    assert.ok(page.length > 20, s.id);
    assert.doesNotMatch(page, /[—"']/, s.id);
    // The page has no Sheets pane of the tour's.
    assert.doesNotMatch(page, /A Sheets pane is shown here only for the tour/, s.id);
    if (differs.includes(s.id)) assert.notEqual(page, stepBody(s, "desk"), s.id);
    else assert.equal(page, stepBody(s, "desk"), s.id);
    // On /desk every step reads its default.
    assert.equal(stepBody(s, "desk"), s.body.default, s.id);
  }
});

test("the tours' keys are declared with their rules, and first-use.js hands on the same ones", async () => {
  assert.equal(TOUR_KEY, "lit-desk-tour");
  assert.equal(DESK_TOUR_KEY, "lit-desk-page-tour");
  assert.equal(SHEET_TOUR_KEY, "lit-desk-sheet-tour");
  const firstUse = await import("../src/scripts/desk/first-use.js");
  assert.equal(firstUse.TOUR_KEY, TOUR_KEY);
  assert.equal(firstUse.DESK_TOUR_KEY, DESK_TOUR_KEY);
  assert.equal(firstUse.SHEET_TOUR_KEY, SHEET_TOUR_KEY);
});

test("planning the Sheets tour numbers its eight steps in two parts, and with no notebook there is none", () => {
  const all = new Set(SHEET_TOUR_STEPS.map((s) => s.id));
  const plan = planTour({ available: all, steps: SHEET_TOUR_STEPS, parts: SHEET_TOUR_PARTS });
  assert.deepEqual(plan.map((s) => `${s.number} of ${s.of}`), Array.from({ length: 8 }, (_, i) => `${i + 1} of 8`));
  assert.equal(plan[0].partName, "Making a sheet");
  assert.equal(plan[0].nextPart, 6);
  assert.equal(plan[6].partName, "Using a sheet");
  assert.equal(plan.at(-1).nextPart, null);
  assert.deepEqual(planTour({ available: all, canKeep: false, steps: SHEET_TOUR_STEPS, parts: SHEET_TOUR_PARTS }), []);
});

test("the Sheets tour's offer is its own: a reader done with both other tours is a first-time reader of it", () => {
  const both = JSON.stringify([...TOUR_STEPS, ...DESK_TOUR_STEPS].map((s) => s.id));
  assert.equal(tourOffer(both, { steps: SHEET_TOUR_STEPS }).kind, "first");
  const done = JSON.stringify(SHEET_TOUR_STEPS.map((s) => s.id));
  assert.equal(tourOffer(done, { steps: SHEET_TOUR_STEPS }).kind, null);
  // And its list says nothing about theirs.
  assert.equal(tourOffer(done, { steps: DESK_TOUR_STEPS }).kind, "first");
  assert.equal(tourOffer(done).kind, "first");
});

test("the notebook tour was cut from 14 steps to 10 (BVJ, 2026-11-02), and retired ids offer nothing", () => {
  const study = planTour({ available: new Set(TOUR_STEPS.map((s) => s.id)), view: "study" }).map((s) => s.id);
  // "Pin a footnote" follows "This verse" (Audit 4, TR4-3; BVJ, 2026-11-07).
  assert.deepEqual(study, ["actions", "note", "margin", "panel", "verse", "pin", "greek", "undo", "search", "kept"]);
  assert.equal(TOUR_STEPS.find((s) => s.id === "pin").part, TOUR_STEPS.find((s) => s.id === "verse").part);
  // The menu step names what the cut steps taught; "Move as I read" is left
  // to the help page and the Edit bookmark form (Audit 4, TR4-2; BVJ, 2026-11-07).
  assert.match(stepBody(TOUR_STEPS[0], "study"), /“Highlight,” “Add a note,” and “Add bookmark\.”/);
  for (const view of ["study", "read"]) assert.doesNotMatch(stepBody(TOUR_STEPS[0], view), /Move as I read/);
  // A reader who took the 14-step tour has the retired ids stored: ignored, kept, and no "new" offer.
  const retired = ["highlight", "bookmark", "widths", "notebook-page"];
  const stored = [...TOUR_STEPS.map((s) => s.id), ...retired];
  const state = parseTourState(JSON.stringify(stored));
  for (const id of retired) assert.ok(!state.seen.includes(id) && state.list.includes(id), id);
  assert.equal(tourOffer(JSON.stringify(stored)).kind, null);
});
