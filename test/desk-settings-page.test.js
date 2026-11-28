// All settings' Study part (src/scripts/desk/settings-page.js; Featherboa,
// Phase 4, part three) driven in a browser DOM, on the real store over
// fake-indexeddb: its sections and their order, Your marks and its finer
// choices, how the Notebook panel starts, and Delete in bulk, which came from
// My Notebook with its tests (GF8a-2, Audit 8 decision 8, D13, E183) and took
// NB-19's words. The part every reader gets is test/settings-page.test.js.
// The page starts itself when imported, so each test imports a fresh copy
// (`?n=`) after building the markup it looks for.

import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory, IDBDatabase } from "fake-indexeddb";
import { settle, window } from "./helpers/browser-env.mjs";

const { createRecord, TRASH_DAYS } = await import("../src/lib/desk-records.mjs");
const { createSheet } = await import("../src/lib/desk-sheets.mjs");
const { createCollection } = await import("../src/lib/desk-collections.mjs");
const { HIDE_KEY, MARK_SETTINGS } = await import("../src/lib/desk-marks.mjs");
const { START_KEY } = await import("../src/lib/desk-start.mjs");

// An open channel keeps node alive; the stores here are never closed.
const RealChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = class extends RealChannel {
  constructor(name) {
    super(name);
    this.unref();
  }
};

let n = 0;
async function until(fn, tries = 100) {
  for (let i = 0; i < tries; i++) {
    const v = fn();
    if (v) return v;
    await settle(10);
  }
  throw new Error("timed out waiting for the page");
}

const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const seedCtx = { now: "2026-11-27T12:00:00.000Z", client: "web/test", contentVersion: "v1" };
const aNote = () => createRecord("note", { bookKey: "john", chapter: 3, verse: 16, endVerse: 16, body: "grace", marker: "note" }, seedCtx);
const aLabel = () => createRecord("label", { name: "Hope" }, seedCtx);
const aSheet = () => createSheet({ title: "Advent study" }, seedCtx);
const aCollection = () => createCollection({ name: "Advent series" }, seedCtx);

// What note-settings.js stamps on <html>; it reads storage once a page, so
// each test starts from the defaults by clearing both.
const MARK_ATTRS = ["data-desk-notes", "data-desk-bookmarks", "data-desk-highlights", "data-desk-read-highlights", "data-desk-note-font"];

async function openPage({ seed = [], url = "http://localhost/settings/", account = false, start = null, noNotebook = false } = {}) {
  globalThis.indexedDB = noNotebook ? undefined : new IDBFactory();
  if (seed.length) {
    // Records already kept when the page opens, written through the real store.
    const { openStore } = await import(`../src/scripts/desk/store.js?seed=${n}`);
    const store = await openStore({ ctx });
    await store.commit({ put: seed, remove: [] }, { record: false });
  }
  localStorage.clear();
  if (start) localStorage.setItem(START_KEY, start);
  const html = document.documentElement;
  for (const a of [...MARK_ATTRS, "data-account"]) html.removeAttribute(a);
  html.dataset.contentVersion = "v1";
  html.dataset.desk = "on";
  if (account) html.dataset.account = "open";
  // The undo bar is built once a page and kept (undo-bar.js), so it stays.
  for (const child of [...document.body.children]) if (!child.classList.contains("desk-undo")) child.remove();
  window.happyDOM.setURL(url);
  document.body.insertAdjacentHTML(
    "afterbegin",
    `<div class="settings-page"><div class="settings-page__inner"><h1 class="settings-page__title">All settings</h1>
      <div class="settings-page__desk" data-settings-page><p class="settings-page__loading">Loading Study’s settings…</p>
      <span id="marks" hidden></span><span id="backup" hidden></span><span id="panel" hidden></span><span id="delete-in-bulk" hidden></span></div>
    </div></div>`,
  );
  const page = await import(`../src/scripts/desk/settings-page.js?n=${++n}`);
  await page.ready;
  await settle(20);
}

const q = (sel) => document.querySelector(sel);
const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
const key = (el, k, extra = {}) => el.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...extra }));
const button = (box, text) => [...box.querySelectorAll("button")].find((b) => b.textContent === text);
const slot = (which) => q(`[data-settings-delete="${which}"]`);
const sectionIds = () => [...document.querySelectorAll("[data-settings-page] > section")].map((s) => s.id);

const liveKinds = async () => {
  const { openStore } = await import(`../src/scripts/desk/store.js?check=${n}`);
  const store = await openStore({ ctx });
  return (await store.all()).filter((r) => r.kind !== "trash").map((r) => r.kind).sort();
};

// The browser refusing a write (quota, a database closed by another tab).
function refuseWrites() {
  const real = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function (stores, mode, ...rest) {
    if (mode === "readwrite") throw new Error("QuotaExceededError");
    return real.call(this, stores, mode, ...rest);
  };
  return () => (IDBDatabase.prototype.transaction = real);
}

const quiet = (fn) => async () => {
  const log = console.error;
  console.error = () => {};
  try {
    await fn();
  } finally {
    console.error = log;
  }
};

/* ── Delete in bulk's undo. First: a page keeps one history (history.js),
   made with the first notebook it opens, so this test's must be it. ── */

test("a bulk deletion offers its Undo in the bar, and Undo brings everything back", async () => {
  await openPage({ seed: [aNote(), aLabel()] });
  const box = slot("marks");
  click(box.querySelector("button"));
  click(button(box, "Delete all notes, highlights, and bookmarks"));
  await until(() => box.querySelector(".settings-page__none"));
  assert.deepEqual(await liveKinds(), []);
  assert.equal(q(".desk-undo__bar").hidden, false);
  assert.equal(q(".desk-undo__text").textContent, "All notes, highlights, and bookmarks deleted: 2 items moved to the trash.");
  assert.equal(slot("trash").querySelector("button").textContent, "Empty the trash now…", "what was deleted waits in the trash");
  click(q(".desk-undo__undo"));
  await until(() => box.querySelector("button"));
  assert.deepEqual(await liveKinds(), ["label", "note"]);
  assert.equal(slot("trash").textContent, "The trash is empty.");
});

/* ── The page ── */

test("Study's sections, in order: Your marks, the backup, the Notebook panel, and Delete in bulk last (NB-24 to NB-29)", async () => {
  await openPage();
  assert.equal(q(".settings-page__loading"), null, "the loading line gives way");
  assert.deepEqual(sectionIds(), ["marks", "backup", "panel", "delete-in-bulk"]);
  assert.ok(
    sectionIds().every((id) => document.querySelectorAll(`[id="${id}"]`).length === 1),
    "the page's empty ids for the help page's links give way to the sections",
  );
  const sections = [...document.querySelectorAll("[data-settings-page] > section")];
  assert.deepEqual(
    sections.map((s) => document.getElementById(s.getAttribute("aria-labelledby"))?.textContent),
    ["Your marks", "Back up your notebook", "The Notebook panel", "Delete in bulk"],
    "each section is named by its heading",
  );
  assert.ok(sections.every((s) => s.firstElementChild.tagName === "H2"), "each opens with its heading");
});

test("where accounts are open, a link to them follows the backup (DI-21)", async () => {
  await openPage({ account: true });
  assert.deepEqual(sectionIds(), ["marks", "backup", "account", "panel", "delete-in-bulk"]);
  const link = q("#account a");
  assert.equal(link.getAttribute("href"), "/account/");
  assert.equal(link.textContent, "Account and devices");
});

test("where the browser keeps no notebook, there is no backup, and Delete in bulk says why", quiet(async () => {
  await openPage({ noNotebook: true });
  assert.deepEqual(sectionIds(), ["marks", "panel", "delete-in-bulk"]);
  assert.match(q("#delete-in-bulk .settings-page__none").textContent, /isn’t letting the site keep a notebook/);
  assert.equal(q("[data-settings-delete]"), null);
  assert.ok(q('[data-settings-switch="marks"]'), "the settings that need no notebook still work");
}));

test("an address naming a part goes to it once the page is drawn, and a broken one is left alone (SEC4-2)", async () => {
  const seen = [];
  const real = window.HTMLElement.prototype.scrollIntoView;
  window.HTMLElement.prototype.scrollIntoView = function () {
    seen.push(this.id);
  };
  try {
    await openPage({ url: "http://localhost/settings/#delete-in-bulk" });
    assert.deepEqual(seen, ["delete-in-bulk"]);
    seen.length = 0;
    await openPage({ url: "http://localhost/settings/#%E0%A4%A" });
    assert.deepEqual(seen, []);
  } finally {
    window.HTMLElement.prototype.scrollIntoView = real;
  }
});

/* ── Your marks (DI-11 to DI-13) ── */

test("Your marks, then its finer choices: one off leaves the switch on, and hiding all brings back what showed", async () => {
  await openPage();
  const sw = (name) => q(`[data-settings-switch="${name}"]`);
  assert.equal(sw("marks").getAttribute("role"), "switch");
  assert.equal(sw("marks").textContent, "Your marks");
  assert.equal(sw("marks").getAttribute("aria-checked"), "true");
  const finer = q(".settings-page__finer");
  assert.equal(finer.getAttribute("role"), "group");
  assert.equal(finer.getAttribute("aria-label"), "Which of your marks show");
  assert.deepEqual([...finer.querySelectorAll('[role="switch"]')].map((b) => b.dataset.settingsSwitch), ["notes", "bookmarks", "highlights"]);
  assert.deepEqual([sw("notes").textContent, sw("bookmarks").textContent], ["Notes in the margin", "Bookmarks"]);

  click(sw("notes"));
  assert.equal(sw("notes").getAttribute("aria-checked"), "false");
  assert.equal(localStorage.getItem(MARK_SETTINGS.notes.key), "off");
  assert.equal(sw("marks").getAttribute("aria-checked"), "true", "bookmarks and highlights still show");

  click(sw("marks"));
  assert.equal(sw("marks").getAttribute("aria-checked"), "false");
  assert.equal(sw("bookmarks").getAttribute("aria-checked"), "false");
  assert.ok(localStorage.getItem(HIDE_KEY), "what showed is remembered");

  click(sw("marks"));
  assert.equal(sw("marks").getAttribute("aria-checked"), "true");
  assert.equal(sw("notes").getAttribute("aria-checked"), "false", "notes stay off, as they were");
  assert.equal(sw("bookmarks").getAttribute("aria-checked"), "true");
  assert.equal(localStorage.getItem(HIDE_KEY), null);
});

test("Highlights says where the browser can't draw them, and the line under Your marks follows the shortcuts", async () => {
  await openPage();
  const highlights = q('[data-settings-switch="highlights"]');
  const drawn = "highlights" in CSS && typeof globalThis.Highlight !== "undefined";
  assert.equal(highlights.disabled, !drawn);
  assert.equal(highlights.textContent, drawn ? "Highlights" : "Highlights (this browser can’t draw them)");

  const marks = q('[data-settings-switch="marks"]');
  const hint = () => document.getElementById(marks.getAttribute("aria-describedby")).textContent;
  assert.equal(marks.getAttribute("aria-keyshortcuts"), "H");
  assert.match(hint(), /Press H to hide or show them; nothing is deleted\./);
  // The page's Keyboard switch (src/scripts/settings-page.js) says so this way.
  localStorage.setItem("lit-shortcuts", "off");
  document.dispatchEvent(new window.CustomEvent("lit:shortcuts-changed"));
  assert.equal(marks.hasAttribute("aria-keyshortcuts"), false);
  assert.equal(hint(), "Your notes, highlights, and bookmarks. Hiding them deletes nothing.");
});

/* ── How the Notebook panel starts (NB-25) ── */

const choices = (group) => [...group.querySelectorAll('[role="radio"]')];
const chosen = (group) => choices(group).filter((b) => b.getAttribute("aria-checked") === "true").map((b) => b.dataset.settingsChoice);
const choice = (group, value) => group.querySelector(`[data-settings-choice="${value}"]`);

test("the start: Open, Minimized, or As I left it, which stores nothing; the arrows, Home, and End choose as they go", async () => {
  await openPage();
  const group = q('[data-settings-choices="start"]');
  assert.equal(group.getAttribute("role"), "radiogroup");
  assert.equal(group.className, "kit-choices");
  assert.equal(document.getElementById(group.getAttribute("aria-labelledby")).textContent, "When a page opens, the Notebook panel is");
  assert.deepEqual(choices(group).map((b) => b.textContent), ["Open", "Minimized", "As I left it"]);
  assert.ok(choices(group).every((b) => b.className === "kit-tab"));
  assert.deepEqual(chosen(group), ["left"]);
  assert.deepEqual(choices(group).map((b) => b.tabIndex), [-1, -1, 0], "one stop, on the choice");

  click(choice(group, "open"));
  assert.equal(localStorage.getItem(START_KEY), "open");
  assert.deepEqual(chosen(group), ["open"]);
  click(choice(group, "left"));
  assert.equal(localStorage.getItem(START_KEY), null, "As I left it stores nothing");

  choice(group, "left").focus();
  key(document.activeElement, "ArrowLeft");
  assert.equal(document.activeElement.dataset.settingsChoice, "min");
  assert.equal(localStorage.getItem(START_KEY), "min");
  key(document.activeElement, "Home");
  assert.equal(document.activeElement.dataset.settingsChoice, "open");
  assert.equal(localStorage.getItem(START_KEY), "open");
  key(document.activeElement, "ArrowLeft");
  assert.equal(document.activeElement.dataset.settingsChoice, "left", "the arrows wrap");
  assert.equal(localStorage.getItem(START_KEY), null);
  key(document.activeElement, "End");
  assert.deepEqual(chosen(group), ["left"]);

  // Another tab's choice.
  localStorage.setItem(START_KEY, "min");
  window.dispatchEvent(new window.StorageEvent("storage", { key: START_KEY }));
  assert.deepEqual(chosen(group), ["min"]);
});

test("a reader who chose Closed before the Notebook lost its Close still sees it, last, for the visit", async () => {
  await openPage({ start: "closed" });
  const group = q('[data-settings-choices="start"]');
  assert.deepEqual(choices(group).map((b) => b.dataset.settingsChoice), ["open", "min", "left", "closed"]);
  assert.deepEqual(chosen(group), ["closed"]);
  click(choice(group, "min"));
  assert.equal(localStorage.getItem(START_KEY), "min");
  assert.ok(choice(group, "closed"), "it stays until the page is left");
});

/* ── Delete in bulk (NB-26, NB-27; Audit 8 decision 8; D13; NB-19's words) ── */

test("Delete in bulk: four choices in red words, named for what they take, with the trash's days", async () => {
  await openPage({ seed: [aSheet(), aNote(), aCollection()] });
  const bulk = q("#delete-in-bulk");
  assert.deepEqual(
    [...bulk.querySelectorAll(".settings-page__h3")].map((h) => h.textContent),
    ["Delete all notes, highlights, and bookmarks", "Delete all sheets", "Delete all collections", "Empty the trash now"],
  );
  assert.deepEqual(
    ["marks", "sheets", "collections"].map((k) => slot(k).querySelector("button").textContent),
    ["Delete all notes, highlights, and bookmarks…", "Delete all sheets…", "Delete all collections…"],
  );
  for (const k of ["marks", "sheets", "collections"]) assert.equal(slot(k).querySelector("button").className, "kit-btn kit-btn--danger");
  assert.equal(slot("trash").textContent, "The trash is empty.");
  assert.doesNotMatch(bulk.textContent, /\bmarks\b/, "the things kept are named, never “marks” (NB-19)");
  assert.equal(bulk.querySelector('a[href="/notebook/#trash"]').textContent, "Trash");
  assert.match(bulk.textContent, new RegExp(`The trash keeps each item for ${TRASH_DAYS} days`));
});

test("decision 8: the first takes notes and labels and leaves sheets and collections; Cancel is first, and focus lands on what took its place", async () => {
  await openPage({ seed: [aSheet(), aNote(), aLabel(), aCollection()] });
  const box = slot("marks");
  click(box.querySelector("button"));
  const ask = box.querySelector(".settings-page__ask");
  assert.equal(ask.getAttribute("role"), "group");
  assert.equal(
    document.getElementById(ask.getAttribute("aria-labelledby")).textContent,
    "Are you sure? This moves 2 items (every note, highlight, bookmark, pinned footnote, and label) to the trash. Your sheets, templates, and collections stay.",
  );
  assert.equal(document.activeElement.textContent, "Cancel", "the safe answer first");
  const yes = button(box, "Delete all notes, highlights, and bookmarks");
  assert.equal(yes.className, "kit-btn kit-btn--danger");
  click(yes);
  await until(() => box.querySelector(".settings-page__none"));
  assert.equal(box.textContent, "There are no notes, highlights, or bookmarks to delete.");
  assert.ok(document.activeElement.classList.contains("settings-page__none"), "focus lands on the line");
  assert.deepEqual(await liveKinds(), ["collection", "sheet"]);
});

test("decision 8 and E183: the second takes the sheets and says notes, highlights, bookmarks, and collections stay", async () => {
  await openPage({ seed: [aSheet(), aSheet(), aNote()] });
  const box = slot("sheets");
  assert.equal(box.previousElementSibling.textContent, "Every sheet, and your own templates. Your notes, highlights, bookmarks, and collections stay.");
  click(box.querySelector("button"));
  assert.equal(
    box.querySelector(".settings-page__ask-text").textContent,
    "Are you sure? This moves 2 sheets (templates included) to the trash. Your notes, highlights, bookmarks, and collections stay.",
  );
  click(button(box, "Delete all sheets"));
  await until(() => box.querySelector(".settings-page__none"));
  assert.equal(box.textContent, "There are no sheets to delete.");
  assert.deepEqual(await liveKinds(), ["note"]);
});

test("D13: the third takes the collections alone; Escape or Cancel puts its button back, focused", async () => {
  await openPage({ seed: [aNote(), aCollection(), aCollection()] });
  const marks = slot("marks");
  click(marks.querySelector("button"));
  key(document.activeElement, "Escape");
  assert.equal(marks.querySelector(".settings-page__ask"), null);
  assert.equal(document.activeElement.textContent, "Delete all notes, highlights, and bookmarks…");

  const box = slot("collections");
  click(box.querySelector("button"));
  assert.equal(box.querySelector(".settings-page__ask-text").textContent, "Are you sure? This moves 2 collections to the trash. What’s in them stays in your notebook.");
  click(button(box, "Cancel"));
  assert.equal(document.activeElement.textContent, "Delete all collections…");
  click(box.querySelector("button"));
  click(button(box, "Delete all collections"));
  await until(() => box.querySelector(".settings-page__none"));
  assert.equal(box.textContent, "There are no collections to delete.");
  assert.deepEqual(await liveKinds(), ["note"]);
});

test("GF8a-2: a refused deletion says so, keeps its question, and gives its button back", quiet(async () => {
  await openPage({ seed: [aLabel()] });
  const box = slot("marks");
  click(box.querySelector("button"));
  const yes = button(box, "Delete all notes, highlights, and bookmarks");
  const restore = refuseWrites();
  try {
    click(yes);
    await settle(50);
    const failed = box.querySelector(".settings-page__error");
    assert.equal(failed.hidden, false);
    assert.equal(failed.textContent, "That couldn’t be saved in this browser, so nothing was deleted. Try again.");
    assert.equal(yes.hasAttribute("aria-disabled"), false, "asking again is possible");
    assert.ok(document.activeElement === yes, "focus stays on it");
  } finally {
    restore();
  }
  assert.deepEqual(await liveKinds(), ["label"]);
}));

test("GF8a-2: a refused \"Empty the trash now\" says so; pressed again it empties the trash", quiet(async () => {
  await openPage({ seed: [aLabel()] });
  const marks = slot("marks");
  click(marks.querySelector("button"));
  click(button(marks, "Delete all notes, highlights, and bookmarks"));
  const box = slot("trash");
  await until(() => box.querySelector("button")?.textContent === "Empty the trash now…");
  assert.equal(
    box.previousElementSibling.textContent,
    `For a shared computer. Wipes the words of everything in the trash at once, instead of after ${TRASH_DAYS} days. Only a record that each item was deleted stays. This can’t be undone.`,
  );
  click(box.querySelector("button"));
  assert.equal(box.querySelector(".settings-page__ask-text").textContent, "Are you sure? The words of 1 deleted item will be gone for good. This can’t be undone.");
  const yes = button(box, "Empty the trash now");
  const restore = refuseWrites();
  try {
    click(yes);
    await settle(50);
    assert.equal(box.querySelector(".settings-page__error").textContent, "That couldn’t be saved in this browser, so nothing was wiped. Try again.");
    assert.equal(yes.hasAttribute("aria-disabled"), false);
  } finally {
    restore();
  }
  click(yes);
  await until(() => box.querySelector(".settings-page__none"));
  assert.equal(box.textContent, "The trash is empty.");
  const status = q('[data-settings-page] > [role="status"]');
  await until(() => status.textContent);
  assert.equal(status.textContent, "The trash is empty. The words of 1 item are gone.");
}));
