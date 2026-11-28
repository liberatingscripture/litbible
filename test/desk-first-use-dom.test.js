// test/desk-first-use-dom.test.js
//
// What the Notebook says about itself, and nothing that speaks first
// (Featherboa's Phase 5; src/scripts/desk/first-use.js), driven in a browser
// DOM: the foot line's four states and its place, "Start here," and the one
// reply a first mark brings ("New here? Take the tour," added to the line the
// action put up). Rules in the pure files are in test/desk-first-use.test.js.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { settle, window as happyWindow } from "./helpers/browser-env.mjs";

import {
  BACKUP_HREF, BACK_UP, KEPT_HERE, KEPT_LINKED, NEW_HERE, START_HERE, TOUR_KEY, withNever, withSeen,
} from "../src/lib/desk-first-use.mjs";
import { SERVICES, SLOT_EVENT, SYNC_META, makeLink } from "../src/lib/desk-sync-link.mjs";

const { COMMAND_EVENT, createFootLine, createStartHere, replyAtFirstUse, requestTour } = await import("../src/scripts/desk/first-use.js");
const { addToBar, barShowing, hideUndo, showChoices, showNotice, showUndo } = await import("../src/scripts/desk/undo-bar.js");

const NOW = new Date("2026-11-28T12:00:00Z");
const ago = (days) => new Date(NOW.getTime() - days * 86_400_000).toISOString();
const LINK = makeLink({
  id: "0b7c3a52-5d0e-4c55-9d7a-1a2b3c4d5e6f",
  notebook: "6a1d2e3f-4b5c-4d6e-8f70-112233445566",
  service: SERVICES.preview,
  now: "2026-11-24T12:00:00.000Z",
});

/** The commands the page asked for, from the same event the search box's "tour" sends. */
let commands;
const onCommand = (e) => commands.push(e.detail);
document.addEventListener(COMMAND_EVENT, onCommand);

beforeEach(() => {
  hideUndo();
  // The bar's root is built once and kept by the module, so it stays; the rest goes.
  for (const el of [...document.body.children]) if (!el.classList.contains("desk-undo")) el.remove();
  happyWindow.happyDOM.setURL("http://localhost/john-3/");
  document.documentElement.removeAttribute("data-desk-tour");
  localStorage.clear();
  commands = [];
});

/** A notebook the foot line can read: `records` and `meta` can change under it. */
function fakeStore({ records = [], meta = {} } = {}) {
  const s = {
    records,
    meta,
    all: async () => s.records,
    getMeta: async (key) => s.meta[key],
    entry: async () => {},
    onEntry: (fn) => {
      s.entry = fn;
      return () => {};
    },
  };
  return s;
}

const note = (created, kind = "note") => ({ id: `${kind}-${created}`, kind, created });

async function foot(store) {
  const line = createFootLine({ store, now: () => NOW });
  document.body.append(line.el);
  await settle(10);
  const words = () => line.el.querySelector(".desk-panel__foot-text").textContent;
  const backUp = () => line.el.querySelector(".desk-panel__backup");
  return { line, words, backUp };
}

/* ── The foot line ───────────────────────────────────────────────── */

test("the foot line, unlinked and empty: where it is kept, and nothing to back up", async () => {
  const { words, backUp } = await foot(fakeStore());
  assert.equal(words(), KEPT_HERE);
  assert.equal(backUp().hidden, true);
});

test("the foot line, with something kept and no backup due: the same words, and a way to back up", async () => {
  const { line, words, backUp } = await foot(fakeStore({ records: [note(ago(2))] }));
  assert.equal(words(), KEPT_HERE);
  assert.equal(backUp().hidden, false);
  assert.equal(backUp().textContent, BACK_UP);
  assert.equal(backUp().getAttribute("href"), BACKUP_HREF);
  assert.equal(backUp().getAttribute("href"), "/notebook/#backup");
  assert.equal(line.el.hasAttribute("data-due"), false);
});

test("the foot line, due: when the last backup was made", async () => {
  const { line, words, backUp } = await foot(fakeStore({ records: [note(ago(30))], meta: { lastExport: ago(9) } }));
  assert.equal(words(), "Last backed up 9 days ago.");
  assert.equal(backUp().hidden, false);
  assert.equal(line.el.hasAttribute("data-due"), true);
});

test("the foot line, due with no backup yet", async () => {
  const { line, words } = await foot(fakeStore({ records: [note(ago(30))] }));
  assert.equal(words(), "Not backed up yet.");
  assert.equal(line.el.hasAttribute("data-due"), true);
});

test("the foot line, at exactly seven days it is due, and a day short it is not", async () => {
  assert.equal((await foot(fakeStore({ records: [note(ago(30))], meta: { lastExport: ago(7) } }))).words(), "Last backed up 7 days ago.");
  document.body.replaceChildren();
  assert.equal((await foot(fakeStore({ records: [note(ago(30))], meta: { lastExport: ago(6) } }))).words(), KEPT_HERE);
});

test("the foot line, linked: the account's words, no Back up link, never due", async () => {
  const { line, words, backUp } = await foot(fakeStore({ records: [note(ago(90))], meta: { [SYNC_META]: LINK } }));
  assert.equal(words(), KEPT_LINKED);
  assert.doesNotMatch(words(), /only/);
  assert.equal(backUp().hidden, true);
  assert.equal(line.el.hasAttribute("data-due"), false);
});

test("refresh changes the words, never the place: the same line, still in the page", async () => {
  const store = fakeStore();
  const { line, words, backUp } = await foot(store);
  const textNode = line.el.querySelector(".desk-panel__foot-text");
  assert.equal(words(), KEPT_HERE);
  assert.equal(backUp().hidden, true);

  // A first record: a way to back up appears, the words stay.
  store.records = [note(ago(1))];
  await line.refresh();
  assert.equal(words(), KEPT_HERE);
  assert.equal(backUp().hidden, false);

  // A week passes without a backup.
  store.records = [note(ago(10))];
  await line.refresh();
  assert.equal(words(), "Not backed up yet.");
  assert.equal(line.el.hasAttribute("data-due"), true);

  // A backup is made on the notebook page.
  store.meta.lastExport = ago(0);
  await line.refresh();
  assert.equal(words(), KEPT_HERE);
  assert.equal(line.el.hasAttribute("data-due"), false);

  // The account is linked.
  store.meta[SYNC_META] = LINK;
  await line.refresh();
  assert.equal(words(), KEPT_LINKED);
  assert.equal(backUp().hidden, true);

  assert.equal(line.el.isConnected, true);
  assert.equal(line.el.parentNode === document.body, true);
  assert.equal(line.el.querySelector(".desk-panel__foot-text") === textNode, true, "the words change inside the same element");
});

test("coming back to the window reads the notebook again (a backup made in another tab)", async () => {
  const store = fakeStore({ records: [note(ago(30))] });
  const { words } = await foot(store);
  assert.equal(words(), "Not backed up yet.");
  store.meta.lastExport = ago(0);
  window.dispatchEvent(new window.Event("focus"));
  await settle(10);
  assert.equal(words(), KEPT_HERE);
});

test("a refresh overtaken by a newer one doesn't draw its older answer", async () => {
  const store = fakeStore({ records: [note(ago(30))] });
  const { line, words } = await foot(store);
  const reads = [];
  store.all = () => new Promise((resolve) => reads.push(resolve));
  const first = line.refresh();
  const second = line.refresh();
  reads[1]([note(ago(1))]);
  await second;
  reads[0]([note(ago(30))]);
  await first;
  assert.equal(words(), KEPT_HERE, "the newer read stands");
});

test("showSlot exposes the sync's place to its status line, which the foot holds hidden until then", async () => {
  const seen = [];
  const hear = () => seen.push(true);
  document.addEventListener(SLOT_EVENT, hear);
  const { line } = await foot(fakeStore({ meta: { [SYNC_META]: LINK } }));
  const slot = line.el.querySelector("[data-desk-sync-slot]");
  assert.ok(slot, "the foot holds the slot");
  assert.equal(slot.hidden, true, "hidden until the sync's line draws into it");
  assert.equal(slot.parentNode === line.el, true);
  assert.equal(seen.length, 0);
  line.showSlot();
  document.removeEventListener(SLOT_EVENT, hear);
  assert.equal(seen.length, 1, "the status line is told its place is on the page");
});

test("where the browser keeps no notebook, the foot line is hidden and says nothing", async () => {
  const line = createFootLine({ store: null, now: () => NOW });
  document.body.append(line.el);
  assert.equal(line.el.hidden, true);
  assert.equal(line.el.textContent, "");
  await line.refresh();
  line.showSlot();
  assert.equal(line.el.textContent, "");
});

/* ── Start here ──────────────────────────────────────────────────── */

const buttons = (el) => [...el.querySelectorAll("button")].map((b) => b.textContent);

test("Start here is shown with no tour state: its words, its filled button, and the way past it", () => {
  const start = createStartHere();
  document.body.append(start.el);
  assert.equal(start.el.hidden, false);
  assert.equal(start.el.querySelector(".desk-start__lead").textContent, START_HERE.lead);
  assert.deepEqual(buttons(start.el), [START_HERE.take, START_HERE.skip]);
  assert.equal(start.el.querySelector(".desk-start__take").classList.contains("kit-btn--filled"), true);
  assert.equal(start.el.querySelector(".desk-start__skip").classList.contains("kit-btn--filled"), false);
  start.destroy();
});

test("Start here is hidden once a step has been seen, and for a reader who said they know their way", () => {
  localStorage.setItem(TOUR_KEY, JSON.stringify(withSeen([], ["actions"])));
  const seen = createStartHere();
  assert.equal(seen.el.hidden, true);
  seen.destroy();

  localStorage.setItem(TOUR_KEY, JSON.stringify(withNever([])));
  const never = createStartHere();
  assert.equal(never.el.hidden, true);
  never.destroy();

  // An unreadable stored value reads as nothing seen.
  localStorage.setItem(TOUR_KEY, "not json");
  const stray = createStartHere();
  assert.equal(stray.el.hidden, false);
  stray.destroy();
});

test("“Take the tour” asks for the tour, the way the search box's command does, and writes nothing", () => {
  const start = createStartHere();
  document.body.append(start.el);
  start.el.querySelector(".desk-start__take").click();
  assert.deepEqual(commands, [{ id: "tour" }]);
  assert.equal(localStorage.getItem(TOUR_KEY), null, "the tour marks its steps seen as it goes, not the button");
  assert.equal(start.el.hidden, false, "it stays until a step is seen");
  start.destroy();
});

test("requestTour asks for the whole tour, or for just the steps named", () => {
  requestTour();
  requestTour(["kept"]);
  assert.deepEqual(commands, [{ id: "tour" }, { id: "tour", only: ["kept"] }]);
});

test("“I know my way around” writes the never marker, takes the line away, and hands focus on", () => {
  localStorage.setItem(TOUR_KEY, JSON.stringify(["later:2026-11-30"]));
  let after = 0;
  const start = createStartHere({ afterSkip: () => after++ });
  document.body.append(start.el);
  start.el.querySelector(".desk-start__skip").click();
  assert.deepEqual(JSON.parse(localStorage.getItem(TOUR_KEY)), ["never"], "the marker the old offer's “Don't show this again” wrote; a later marker is dropped");
  assert.equal(start.el.hidden, true);
  assert.equal(after, 1);
  assert.deepEqual(commands, [], "it asks for no tour");
  start.destroy();
});

test("“I know my way around” keeps the steps already seen", () => {
  localStorage.setItem(TOUR_KEY, JSON.stringify(["offered"]));
  const start = createStartHere();
  start.el.querySelector(".desk-start__skip").click();
  assert.deepEqual(JSON.parse(localStorage.getItem(TOUR_KEY)), ["offered", "never"]);
  start.destroy();
});

test("Start here follows the tour state when another tab (or the tour) changes it", () => {
  const start = createStartHere();
  document.body.append(start.el);
  assert.equal(start.el.hidden, false);
  localStorage.setItem(TOUR_KEY, JSON.stringify(["actions"]));
  window.dispatchEvent(new window.StorageEvent("storage", { key: TOUR_KEY }));
  assert.equal(start.el.hidden, true);
  // Another key says nothing about it.
  localStorage.removeItem(TOUR_KEY);
  window.dispatchEvent(new window.StorageEvent("storage", { key: "lit-desk-page-tour" }));
  assert.equal(start.el.hidden, true);
  start.destroy();
  // Destroyed, it listens no more.
  window.dispatchEvent(new window.StorageEvent("storage", { key: TOUR_KEY }));
  assert.equal(start.el.hidden, true);
});

/* ── A reply at the first use ────────────────────────────────────── */

const barLinks = () => [...document.querySelectorAll(".desk-undo__link")].map((a) => a.textContent);
const barText = () => document.querySelector(".desk-undo__text")?.textContent;

/** The first write: the line the action brings is up, then the store reports the entry. */
async function firstMark(store, records, { say = "Highlighted." } = {}) {
  store.records = records;
  showUndo(say, () => {});
  await store.entry();
  await settle(10);
}

test("the first highlight adds “New here? Take the tour” to its own line, after Undo", async () => {
  const store = fakeStore();
  replyAtFirstUse({ store });
  await firstMark(store, [note(ago(0), "highlight")]);
  assert.equal(barText(), "Highlighted.");
  assert.equal(document.querySelector(".desk-undo__undo").textContent, "Undo");
  assert.deepEqual(barLinks(), [NEW_HERE]);
  const link = document.querySelector(".desk-undo__link");
  assert.equal(link.previousElementSibling.classList.contains("desk-undo__undo"), true, "it follows the button it joins");
  assert.equal(link.getAttribute("href"), "/john-3/?desk-tour");
  // A plain click asks for the tour here, not in a new tab.
  link.click();
  assert.deepEqual(commands, [{ id: "tour" }]);
});

test("a first note or bookmark, which bring no line of their own, is answered with a line that says what was done", async () => {
  for (const [kind, said] of [["note", "Note saved."], ["bookmark", "Bookmark added."]]) {
    hideUndo();
    const store = fakeStore({ records: [note(ago(0), kind)] });
    replyAtFirstUse({ store });
    await store.entry();
    await settle(10);
    assert.equal(barShowing(), true, kind);
    assert.equal(barText(), said);
    assert.deepEqual(barLinks(), [NEW_HERE], kind);
  }
});

test("it is said once: a second mark in the same visit adds nothing", async () => {
  const store = fakeStore();
  replyAtFirstUse({ store });
  await firstMark(store, [note(ago(0), "highlight")]);
  assert.deepEqual(barLinks(), [NEW_HERE]);
  hideUndo();
  await firstMark(store, [note(ago(0), "highlight"), note(ago(0), "note")], { say: "Note saved." });
  assert.deepEqual(barLinks(), []);
});

test("only the first mark counts: a write into a notebook that already holds marks adds nothing", async () => {
  const store = fakeStore();
  replyAtFirstUse({ store });
  await firstMark(store, [note(ago(5), "note"), note(ago(0), "highlight")]);
  assert.deepEqual(barLinks(), []);
  // And the first write that wasn't the first mark ended the watch.
  hideUndo();
  await firstMark(store, [note(ago(0), "highlight")]);
  assert.deepEqual(barLinks(), []);
});

test("a write that isn't a mark (a sheet, a label) is no first mark, though it ends the watch", async () => {
  const store = fakeStore();
  replyAtFirstUse({ store });
  await firstMark(store, [note(ago(0), "sheet")], { say: "Sheet made." });
  assert.deepEqual(barLinks(), []);
  assert.equal(barShowing(), true);
});

test("never once the tour has been taken: a step seen", async () => {
  localStorage.setItem(TOUR_KEY, JSON.stringify(["actions"]));
  const store = fakeStore();
  replyAtFirstUse({ store });
  await firstMark(store, [note(ago(0), "highlight")]);
  assert.deepEqual(barLinks(), []);
  assert.equal(barText(), "Highlighted.", "the action's own line is left as it was");
});

test("never once the tour has been declined: “I know my way around”", async () => {
  const start = createStartHere();
  document.body.append(start.el);
  start.el.querySelector(".desk-start__skip").click();
  start.destroy();
  const store = fakeStore();
  replyAtFirstUse({ store });
  await firstMark(store, [note(ago(0), "highlight")]);
  assert.deepEqual(barLinks(), []);
  hideUndo();
  // A note, which brings no line of its own, brings none here either.
  const another = fakeStore({ records: [note(ago(0), "note")] });
  replyAtFirstUse({ store: another });
  await another.entry();
  await settle(10);
  assert.equal(barShowing(), false);
});

test("it adds nothing to a bar of choices, which has its own ×, and puts the reply on a line of its own", async () => {
  const store = fakeStore();
  replyAtFirstUse({ store });
  store.records = [note(ago(0), "highlight")];
  showChoices("Choose one.", [{ label: "One", onPress: () => {} }]);
  await store.entry();
  await settle(10);
  assert.equal(barText(), "Highlighted.", "the choices gave way to a line of the reply's own");
  assert.deepEqual(barLinks(), [NEW_HERE]);
});

test("where the browser keeps no notebook there is nothing to watch", () => {
  assert.doesNotThrow(() => replyAtFirstUse({ store: null }));
  assert.doesNotThrow(() => replyAtFirstUse({ store: { all: async () => [] } }));
});

/* ── addToBar ────────────────────────────────────────────────────── */

test("addToBar joins the notice that is up, after its button and any link it has, and says whether it did", () => {
  assert.equal(addToBar({ label: "Nothing up", href: "/x/" }), false, "no bar, nothing to join");
  showUndo("Highlighted.", () => {}, { link: { label: "Open it", href: "/a/" } });
  assert.equal(addToBar({ label: "Second", href: "/b/" }), true);
  assert.equal(barLinks().length, 2);
  assert.match(barLinks()[0], /^Open it/);
  assert.match(barLinks()[1], /^Second/);
  assert.deepEqual([...document.querySelectorAll(".desk-undo__link")].map((a) => a.getAttribute("href")), ["/a/", "/b/"]);
});

test("addToBar joins a plain notice, and leaves a bar of choices alone", () => {
  showNotice("Saved.");
  assert.equal(addToBar({ label: "More", href: "/c/", open: () => {} }), true);
  assert.equal(document.querySelector(".desk-undo__link").textContent, "More");
  showChoices("Choose one.", [{ label: "One", onPress: () => {} }]);
  assert.equal(addToBar({ label: "Nope", href: "/d/" }), false);
  assert.deepEqual(barLinks(), []);
});

test("the link a notice carries goes with that notice only", () => {
  showUndo("Highlighted.", () => {});
  addToBar({ label: NEW_HERE, href: "/john-3/?desk-tour", open: () => {} });
  assert.deepEqual(barLinks(), [NEW_HERE]);
  showUndo("Note saved.", () => {});
  assert.deepEqual(barLinks(), [], "the next notice starts without it");
});
