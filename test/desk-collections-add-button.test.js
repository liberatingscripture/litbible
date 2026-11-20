// A collection's "Add ▾" (STUDY-DESK-FIXES.md, E177; BVJ, 2026-11-19), driven
// in a browser DOM on the /collections page and in /desk's Collections pane:
// the menu and its keys, Passage… and its ×, Sheet… and A label's bookmarks…
// (E154's pick window), the page's From My Notebook link, and the pane's From
// My Notes. Over the real store on fake-indexeddb, with the readers faked. The
// menu is the desk's one button menu (button-menu.js), which the sheet's gap
// pill uses too.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle } from "./helpers/browser-env.mjs";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { createCollection, isBookmarkRule } from "../src/lib/desk-collections.mjs";
import { createRecord } from "../src/lib/desk-records.mjs";
import { createSheet, makeModule } from "../src/lib/desk-sheets.mjs";
import { planSave } from "../src/lib/desk-store-core.mjs";
import { noWayLinkLabel, noWayMessage, replacedMessage } from "../src/lib/desk-search-pane.mjs";

globalThis.indexedDB = new IDBFactory();
globalThis.IDBKeyRange = IDBKeyRange;
const RealChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = class extends RealChannel {
  constructor(name) {
    super(name);
    this.unref?.();
  }
};

const { mountCollectionsPage } = await import("../src/scripts/desk/collections/collection-page.js");
const { createCollectionPane } = await import("../src/scripts/desk/collections/collection-pane.js");
const { openButtonMenu } = await import("../src/scripts/desk/button-menu.js");
const { openStore } = await import("../src/scripts/desk/store.js");
const { initUndo } = await import("../src/scripts/desk/undo-bar.js");

const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const opCtx = () => ({ now: new Date().toISOString(), ...ctx() });
const store = await openStore({ ctx });
initUndo();

async function until(fn, ms = 3000, what = "the condition") {
  const end = Date.now() + ms;
  while (!(await fn())) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

const live = [];
async function clearAll() {
  for (const p of live.splice(0)) p.destroy();
  for (const old of document.querySelectorAll("[data-test-root], .desk-pick, [role=menu]")) old.remove();
  for (const r of await store.all()) await store.remove(r.id).catch(() => {});
}

let n = 0;
const make = (kind, fields) => createRecord(kind, fields, { ...opCtx(), id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` });
async function keep(record) {
  await store.change(async () => planSave(record));
  return record;
}
const keepCollection = (name, members = []) => keep(createCollection({ name, members }, opCtx()));
const collection = async (id) => (await store.all()).find((r) => r.id === id);

async function page(id) {
  history.replaceState(null, "", `/collections/?id=${encodeURIComponent(id)}`);
  const root = document.createElement("div");
  root.dataset.testRoot = "";
  document.body.append(root);
  const p = await mountCollectionsPage(root, {
    store,
    ctx,
    base: "/",
    chapterText: async () => null,
    passageText: async () => "For God so loved the world.",
    parse: () => null,
  });
  live.push(p);
  return root;
}

function pane(paneId, shows, { showMine } = {}) {
  const p = createCollectionPane({
    store,
    ctx,
    paneId,
    getCollection: () => shows,
    setCollection: () => {},
    showPassage: () => null,
    showSheet: () => ({ outcome: "shown" }),
    ...(showMine ? { showMine } : {}),
    chapterText: async () => null,
    passageText: async () => "For God so loved the world.",
    parse: () => null,
  });
  p.el.dataset.testRoot = paneId;
  document.body.append(p.el);
  live.push(p);
  return p;
}

const byText = (root, sel, text) => [...root.querySelectorAll(sel)].find((el) => el.textContent.trim() === text);
const addButton = (root) => root.querySelector(".collection-page__add");
const menuEl = () => document.querySelector("[role=menu]");
const lines = () => [...menuEl().querySelectorAll("[role=menuitem]")];
const lineWords = () => lines().map((b) => b.querySelector(".desk-title__label").textContent);
const lineNamed = (words) => lines().find((b) => b.querySelector(".desk-title__label").textContent === words);
const key = (el, k) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
const barText = () => document.querySelector(".desk-undo__text")?.textContent ?? "";

test("Add ▾ is the page's one primary button, and opens a menu of four: Passage…, Sheet…, A label's bookmarks…, From My Notebook", async () => {
  await clearAll();
  const c = await keepCollection("Readings");
  const root = await page(c.id);
  await until(() => addButton(root), 3000, "the collection");
  const add = addButton(root);
  assert.equal(add.textContent.trim(), "Add");
  assert.ok(add.classList.contains("desk-sheet__btn--primary"));
  assert.equal(root.querySelectorAll(".desk-sheet__btn--primary").length, 1, "one primary button (E126)");
  assert.equal(add.getAttribute("aria-haspopup"), "menu");
  assert.equal(add.getAttribute("aria-expanded"), "false");
  add.click();
  assert.ok(menuEl(), "the menu opens");
  assert.equal(menuEl().getAttribute("aria-label"), "Add to Readings");
  assert.equal(add.getAttribute("aria-expanded"), "true");
  assert.equal(add.getAttribute("aria-controls"), menuEl().id);
  assert.deepEqual(lineWords(), ["Passage…", "Sheet…", "A label’s bookmarks…", "From My Notebook"]);
  assert.equal(document.activeElement, lineNamed("Passage…"), "focus on its first line");
  // Nothing to choose from: each says why, beside it and in its description.
  const sheet = lineNamed("Sheet…");
  assert.equal(sheet.getAttribute("aria-disabled"), "true");
  assert.equal(sheet.querySelector(".desk-title__hint").textContent, "no sheets yet");
  const label = lineNamed("A label’s bookmarks…");
  assert.equal(label.getAttribute("aria-disabled"), "true");
  assert.equal(label.querySelector(".desk-title__hint").textContent, "no labeled bookmarks yet");
  assert.notEqual(sheet.getAttribute("aria-describedby"), label.getAttribute("aria-describedby"), "each reason has its own id");
  // BVJ: "On /collections it should Go to My Notebook": a link, in this tab.
  const notebook = lineNamed("From My Notebook");
  assert.equal(notebook.tagName, "A");
  assert.equal(notebook.getAttribute("href"), "/notebook/");
  assert.equal(notebook.target, "");
  // The arrows pass over the disabled lines.
  key(document.activeElement, "ArrowDown");
  assert.equal(document.activeElement, notebook);
  key(document.activeElement, "ArrowDown");
  assert.equal(document.activeElement, lineNamed("Passage…"), "and wrap");
  // Escape closes it and hands focus back to Add.
  key(document.activeElement, "Escape");
  assert.equal(menuEl(), null);
  assert.equal(document.activeElement, add);
  assert.equal(add.getAttribute("aria-expanded"), "false");
  // A second press while it is open closes it.
  add.click();
  add.click();
  assert.equal(menuEl(), null);
});

test("Passage… shows the field with focus in it; its × and Escape close it and hand focus back to Add", async () => {
  await clearAll();
  const c = await keepCollection("Readings");
  const root = await page(c.id);
  await until(() => addButton(root), 3000, "the collection");
  const form = () => root.querySelector(".collection-page__form");
  assert.ok(form().hidden, "closed to start");
  addButton(root).click();
  lineNamed("Passage…").click();
  assert.equal(menuEl(), null, "the menu closes first");
  assert.ok(!form().hidden);
  const input = root.querySelector('[data-focus-key="add-input"]');
  assert.equal(document.activeElement, input);
  assert.equal(root.querySelector(".desk-sheet__insert-title").textContent, "Add a passage");
  const shut = form().querySelector('.desk-sheet__icon[aria-label="Close"]');
  assert.ok(shut, "a × named Close");
  shut.click();
  assert.ok(form().hidden);
  assert.equal(document.activeElement, addButton(root));
  addButton(root).click();
  lineNamed("Passage…").click();
  assert.ok(!form().hidden);
  key(input, "Escape");
  assert.ok(form().hidden);
  assert.equal(document.activeElement, addButton(root));
});

test("Sheet… lists the reader's sheets, no templates; a pick adds the sheet, and the bar says so", async () => {
  await clearAll();
  const sheet = await keep(createSheet({ title: "Week 1", template: "blank", modules: [makeModule("text")] }, opCtx()));
  await keep({ ...createSheet({ title: "My template", template: "blank", modules: [makeModule("text")] }, opCtx()), isTemplate: true });
  const c = await keepCollection("Readings");
  const root = await page(c.id);
  await until(() => addButton(root), 3000, "the collection");
  addButton(root).click();
  const line = lineNamed("Sheet…");
  assert.equal(line.getAttribute("aria-disabled"), null, "there is a sheet to choose");
  line.click();
  await until(() => document.querySelector(".desk-pick"), 3000, "the pick window");
  const rows = [...document.querySelectorAll(".desk-pick .desk-pick__row")];
  assert.deepEqual(rows.map((r) => r.querySelector(".desk-pick__name").textContent), ["Week 1"], "no template");
  rows[0].click();
  await until(async () => (await collection(c.id)).members.some((m) => m.type === "item" && m.recordId === sheet.id), 3000, "the sheet added");
  await until(() => barText() === "Week 1 added to Readings.", 3000, "the bar");
  // Opened again, the window says the collection holds it.
  await until(() => addButton(root), 3000, "the view drawn again");
  addButton(root).click();
  lineNamed("Sheet…").click();
  await until(() => document.querySelector(".desk-pick .desk-pick__detail"), 3000, "the window again");
  assert.equal(document.querySelector(".desk-pick .desk-pick__detail").textContent, "In Readings already");
  document.querySelector(".desk-pick").remove();
});

test("A label's bookmarks… lists the labels on a bookmark with their counts, and decision 23's two choices; the first choice adds a rule", async () => {
  await clearAll();
  const advent = await keep(make("label", { name: "Advent" }));
  await keep(make("label", { name: "Unused" }));
  await keep(make("bookmark", { bookKey: "luke", chapter: 1, verse: 38, label: "Here I am", labels: [advent.id] }));
  await keep(make("bookmark", { bookKey: "luke", chapter: 2, verse: 10, label: "Good news", labels: [advent.id] }));
  const c = await keepCollection("Readings");
  const root = await page(c.id);
  await until(() => addButton(root), 3000, "the collection");
  addButton(root).click();
  lineNamed("A label’s bookmarks…").click();
  await until(() => document.querySelector(".desk-pick"), 3000, "the pick window");
  const win = document.querySelector(".desk-pick");
  const rows = [...win.querySelectorAll(".desk-pick__row")];
  assert.deepEqual(rows.map((r) => r.querySelector(".desk-pick__name").textContent), ["Advent"], "only a label on a bookmark");
  assert.equal(rows[0].querySelector(".desk-pick__detail").textContent, "2 bookmarks");
  const choices = [...win.querySelectorAll("input[type=radio]")];
  assert.deepEqual(
    choices.map((r) => r.closest("label").textContent.trim()),
    ["Only the ones with that label now", "Those, and any you give that label from now on"],
  );
  assert.ok(choices[1].checked, "the rule is chosen to start, as the label's own shortcut");
  rows[0].click();
  await until(async () => (await collection(c.id)).members.some(isBookmarkRule), 3000, "the rule added");
  await until(() => barText() === "2 labeled Advent added to Readings, and new ones will be.", 3000, "the bar");
});

test("in /desk's Collections pane the last line is From My Notes, which asks for a My Notes pane and keeps this one", async () => {
  await clearAll();
  const c = await keepCollection("Readings");
  const asked = [];
  const p = pane("p3", c.id, { showMine: (keepId) => asked.push(keepId) });
  await until(() => addButton(p.el), 3000, "the collection");
  addButton(p.el).click();
  assert.deepEqual(lineWords(), ["Passage…", "Sheet…", "A label’s bookmarks…", "From My Notes"]);
  assert.equal(menuEl().id, "collectionAddMenu-p3", "the pane's id on the menu's");
  const mine = lineNamed("From My Notes");
  assert.equal(mine.tagName, "BUTTON");
  mine.click();
  assert.deepEqual(asked, ["p3"], "this pane keeps its place");
  assert.equal(menuEl(), null);
});

test("a host with no way to the notebook's list has no fourth line", async () => {
  await clearAll();
  const c = await keepCollection("Readings");
  const p = pane("p4", c.id);
  await until(() => addButton(p.el), 3000, "the collection");
  addButton(p.el).click();
  assert.deepEqual(lineWords(), ["Passage…", "Sheet…", "A label’s bookmarks…"]);
  key(document.activeElement, "Escape");
});

test("a My Notes pane the desk can't open or puts in another's place is said as the other kinds are (E127)", () => {
  assert.equal(replacedMessage("mine", "greek"), "My Notes shown in place of Greek.");
  const said = noWayMessage("mine", "full", { collection: true });
  assert.match(said, /^There’s no room for a My Notes pane/);
  assert.match(said, /this collection keep their places/);
  assert.match(said, /or open My Notebook\.$/);
  assert.equal(noWayLinkLabel("mine"), "Open My Notebook");
});

test("the button menu: a link line is a link, a click on a line closes the menu first, and a menu with every line disabled still takes focus", async () => {
  for (const old of document.querySelectorAll("[role=menu]")) old.remove();
  const button = document.createElement("button");
  document.body.append(button);
  const picked = [];
  openButtonMenu({
    button,
    id: "testMenu",
    label: "Test",
    items: [
      { label: "One", type: "one" },
      { label: "Two", type: "two", disabled: true, why: "not now" },
      { label: "Away", type: "away", href: "/elsewhere/" },
    ],
    onPick: (type) => picked.push([type, Boolean(menuEl())]),
  });
  assert.ok(menuEl().classList.contains("desk-pane__menu--plain"));
  lineNamed("Two").click();
  assert.deepEqual(picked, [], "a disabled line does nothing");
  assert.equal(lineNamed("Away").getAttribute("href"), "/elsewhere/");
  lineNamed("One").click();
  assert.deepEqual(picked, [["one", false]], "closed before the pick runs");
  openButtonMenu({ button, id: "testMenu2", label: "Test", items: [{ label: "Only", type: "x", disabled: true, why: "no" }], onPick: () => {} });
  assert.equal(document.activeElement, menuEl());
  key(menuEl(), "Escape");
  assert.equal(document.activeElement, button);
  button.remove();
  await settle();
});
