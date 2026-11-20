// /desk's Collections pane (STUDY-DESK.md, D13, "A Collections pane on /desk",
// decisions 26 to 36; step 4 of its order of work), driven in a browser DOM:
// the list and one collection in a pane, the layout field it keeps, two panes
// at once, references that move the LIT pane, a sheet shown in a Sheets pane,
// the command row's "New collection…", "Open on its own page", and the one
// line a browser keeping no notebook gets. Over the real store on
// fake-indexeddb, with the readers faked.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle } from "./helpers/browser-env.mjs";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { createCollection, itemMember, passageMember, planAddPassage } from "../src/lib/desk-collections.mjs";
import { createRecord } from "../src/lib/desk-records.mjs";
import { createSheet, makeModule } from "../src/lib/desk-sheets.mjs";
import { planSave } from "../src/lib/desk-store-core.mjs";

globalThis.indexedDB = new IDBFactory();
globalThis.IDBKeyRange = IDBKeyRange;
const RealChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = class extends RealChannel {
  constructor(name) {
    super(name);
    this.unref?.();
  }
};

const { createCollectionPane } = await import("../src/scripts/desk/collections/collection-pane.js");
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
  for (const old of document.querySelectorAll("[data-test-root], .desk-pick")) old.remove();
  for (const r of await store.all()) await store.remove(r.id).catch(() => {});
}

async function keep(record) {
  await store.change(async () => planSave(record));
  return record;
}
const keepCollection = (name, members = []) => keep(createCollection({ name, members }, opCtx()));
const john316 = () => passageMember({ bookKey: "john", chapter: 3, verse: 16, endVerse: 16 });

/**
 * A pane as desk-panes.js mounts one: `field` is the layout's collection for
 * it, and `asked` records every showPassage and showSheet the pane makes.
 */
function pane(paneId, { shows = null, store: s = store, sheetWay = { outcome: "shown" } } = {}) {
  const field = { value: shows };
  const asked = [];
  const p = createCollectionPane({
    store: s,
    ctx,
    paneId,
    getCollection: () => field.value,
    setCollection: (id) => (field.value = id),
    showPassage: (passage, options) => asked.push(["passage", passage, options]),
    showSheet: (id, keepId) => {
      asked.push(["sheet", id, keepId]);
      return { undoLayout() { asked.push(["undo layout"]); }, ...sheetWay };
    },
    chapterText: async () => null,
    passageText: async () => "For God so loved the world.",
    parse: () => null,
  });
  p.el.dataset.testRoot = paneId;
  document.body.append(p.el);
  live.push(p);
  return { ...p, field, asked };
}

const title = (p) => p.el.querySelector(".desk-sheet__list-title")?.textContent;
const byText = (root, sel, text) => [...root.querySelectorAll(sel)].find((el) => el.textContent.trim() === text);
const click = (el, init = {}) => {
  const e = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init });
  el.dispatchEvent(e);
  return e;
};
const barText = () => document.querySelector(".desk-undo__text")?.textContent ?? "";

test("a browser keeping no notebook gets one line, as the Sheets pane does", () => {
  const p = createCollectionPane({ store: null, ctx, paneId: "p9", getCollection: () => null, setCollection: () => {} });
  assert.match(p.el.textContent, /collections can’t be saved here/);
  assert.equal(p.el.querySelector("button"), null);
});

test("the pane opens on the list; a row opens its collection and keeps it in the layout; ‹ All collections goes back to that row", async () => {
  await clearAll();
  const c = await keepCollection("Advent series", [john316()]);
  const p = pane("p2");
  await until(() => title(p) === "My collections", 3000, "the list");
  assert.equal(p.el.querySelector(".desk-sheet__list-title").tagName, "H3", "a pane's title is under its bar's");
  const row = p.el.querySelector("button.desk-sheet__open");
  click(row);
  await until(() => title(p) === "Advent series", 3000, "the collection");
  assert.equal(p.field.value, c.id, "kept on the pane in the layout (decision 26)");
  assert.equal(document.activeElement, p.el.querySelector(".desk-sheet__list-title"), "focus is on its title");
  const back = byText(p.el, "button", "‹ All collections");
  assert.ok(back.closest(".desk-sheet__top"), "in the Sheets pane's top row");
  click(back);
  await until(() => title(p) === "My collections", 3000, "the list again");
  assert.equal(p.field.value, null);
  assert.equal(document.activeElement?.dataset.focusKey, `open-${c.id}--p2`, "back on the row it came from");
});

test("E186: the list's New collection sits beside its title, as a Sheets pane's New sheet does, with or without collections", async () => {
  await clearAll();
  const p = pane("p2");
  await until(() => title(p) === "My collections", 3000, "the empty list");
  const head = () => p.el.querySelector(".desk-sheet__list-head");
  const words = () => [...head().children].map((n) => n.textContent.trim());
  assert.deepEqual(words(), ["My collections", "New collection"], "one row, no ellipsis");
  assert.ok(head().querySelector("button").classList.contains("desk-sheet__btn--primary"));
  assert.equal(p.el.firstElementChild, head(), "the row comes first");
  assert.equal(head().nextElementSibling.className, "desk-np__intro", "the intro under it");
  assert.equal(p.el.querySelector(".collection-page__actions"), null, "no second row of its own");
  await keepCollection("Advent series", [john316()]);
  await until(() => p.el.querySelector(".desk-sheet__sheet"), 3000, "the row");
  assert.deepEqual(words(), ["My collections", "New collection"]);
  assert.equal(head().nextElementSibling.className, "desk-sheet__sheets", "the cards under it");
});

test("a reload shows the collection the layout kept", async () => {
  await clearAll();
  const c = await keepCollection("Lent", [john316()]);
  const p = pane("p3", { shows: c.id });
  await until(() => title(p) === "Lent", 3000, "the kept collection");
});

test("the pane's actions end with Open on its own page in a new tab, in Print's place, and its members lie on the pane", async () => {
  await clearAll();
  const c = await keepCollection("Advent series", [john316()]);
  const p = pane("p2", { shows: c.id });
  await until(() => title(p) === "Advent series");
  const actions = p.el.querySelector(".collection-page__actions");
  const words = [...actions.children].map((b) => b.childNodes[0].textContent.trim());
  assert.deepEqual(words, ["Add", "Add to sheet…", "Rename…", "Delete", "Open on its own page"]);
  const own = actions.lastElementChild;
  assert.equal(own.tagName, "A");
  assert.equal(own.getAttribute("href"), `/collections/?id=${encodeURIComponent(c.id)}`);
  assert.equal(own.target, "_blank");
  assert.match(own.textContent, /\(opens in a new tab\)/);
  const members = p.el.querySelector(".collection-page__sheet");
  assert.ok(!members.classList.contains("v2-sheet"), "not a card inside a card (decision 26)");
});

test("two Collections panes at once keep their own order switch and keys", async () => {
  await clearAll();
  const c = await keepCollection("Twice", [john316()]);
  const a = pane("pa", { shows: c.id });
  const b = pane("pb", { shows: c.id });
  await until(() => title(a) === "Twice" && title(b) === "Twice");
  const names = (p) => new Set([...p.el.querySelectorAll(".desk-seg__input")].map((r) => r.name));
  assert.deepEqual([...names(a)], ["collection-order-pa"]);
  assert.deepEqual([...names(b)], ["collection-order-pb"]);
  // Opening one in a pane leaves the other alone.
  click(byText(a.el, "button", "‹ All collections"));
  await until(() => title(a) === "My collections");
  assert.equal(title(b), "Twice");
  assert.equal(b.field.value, c.id);
});

test("a passage's reference moves the LIT pane beside this one, as a jump; a modified click is the browser's", async () => {
  await clearAll();
  const c = await keepCollection("Advent series", [john316()]);
  const p = pane("p2", { shows: c.id });
  await until(() => p.el.querySelector(".desk-item__ref"));
  const ref = p.el.querySelector(".desk-item__ref");
  assert.equal(ref.textContent, "John 3:16");
  const modified = click(ref, { ctrlKey: true });
  assert.equal(modified.defaultPrevented, false);
  assert.deepEqual(p.asked, []);
  const plain = click(ref);
  assert.equal(plain.defaultPrevented, true);
  assert.deepEqual(p.asked, [["passage", { bookKey: "john", chapter: 3, verse: 16 }, { beside: "p2", asker: "collection" }]]);
});

test("a note's reference moves the LIT pane too (decision 29)", async () => {
  await clearAll();
  const note = await keep(createRecord("note", { bookKey: "romans", chapter: 8, verse: 18, endVerse: 18, body: "hope", marker: "note" }, ctx()));
  const c = await keepCollection("Hope", [itemMember(note.id)]);
  const p = pane("p2", { shows: c.id });
  await until(() => p.el.querySelector(".desk-item__ref"));
  click(p.el.querySelector(".desk-item__ref"));
  assert.equal(p.asked.length, 1);
  assert.equal(p.asked[0][0], "passage");
  assert.equal(p.asked[0][1].bookKey, "romans");
  assert.equal(p.asked[0][1].chapter, 8);
  assert.deepEqual(p.asked[0][2], { beside: "p2", asker: "collection" });
});

test("a member row's buttons follow its kind, before its words, so a keyboard takes it as a narrow pane shows it (decision 35)", async () => {
  await clearAll();
  const c = await keepCollection("Order", [john316()]);
  const p = pane("p2", { shows: c.id });
  await until(() => p.el.querySelector(".desk-np-row .desk-item__pin-row"));
  const li = p.el.querySelector(".desk-np-row");
  const classes = [...li.children].map((n) => n.className.split(" ")[0]);
  const at = (cls) => classes.indexOf(cls);
  assert.ok(at("desk-item__ref") < at("desk-item__kind"));
  assert.equal(at("desk-np-row__buttons"), at("desk-item__kind") + 1, classes.join(" "));
  assert.ok(at("desk-item__pin-row") > at("desk-np-row__buttons"), "the words come after the buttons");
});

test("a sheet in the collection shows in a Sheets pane, this pane keeping its place; the bar says what it took the place of", async () => {
  await clearAll();
  const sheet = await keep(createSheet({ title: "Week 1", template: "blank", modules: [makeModule("text")] }, opCtx()));
  const c = await keepCollection("Series", [itemMember(sheet.id)]);
  const p = pane("p2", { shows: c.id, sheetWay: { outcome: "replaced", replaced: { id: "p3", kind: "verse" } } });
  await until(() => byText(p.el, ".desk-item__ref", "Week 1"));
  const plain = click(byText(p.el, ".desk-item__ref", "Week 1"));
  assert.equal(plain.defaultPrevented, true);
  assert.deepEqual(p.asked[0], ["sheet", sheet.id, "p2"]);
  assert.match(barText(), /^Sheets shown in place of This verse\./);
  click(byText(document.body, ".desk-undo button", "Undo"));
  assert.deepEqual(p.asked.at(-1), ["undo layout"]);
});

test("with no room for a Sheets pane, the notice says why and offers the sheet's page", async () => {
  await clearAll();
  const sheet = await keep(createSheet({ title: "Week 2", template: "blank", modules: [makeModule("text")] }, opCtx()));
  const c = await keepCollection("Series", [itemMember(sheet.id)]);
  const p = pane("p2", { shows: c.id, sheetWay: { outcome: "none", reason: "pinned" } });
  await until(() => byText(p.el, ".desk-item__ref", "Week 2"));
  click(byText(p.el, ".desk-item__ref", "Week 2"));
  assert.match(barText(), /this collection keep their places/);
  const link = document.querySelector(".desk-undo__link");
  assert.equal(link.textContent.trim().startsWith("Open the sheet"), true);
  assert.equal(link.getAttribute("href"), `/sheets/?id=${encodeURIComponent(sheet.id)}`);
});

test("desk:collection-new for this pane opens the name window, and Create shows the new collection here", async () => {
  await clearAll();
  const a = pane("pa");
  const b = pane("pb");
  await until(() => title(a) === "My collections" && title(b) === "My collections");
  document.dispatchEvent(new CustomEvent("desk:collection-new", { detail: { paneId: "pb" } }));
  const win = document.querySelector(".desk-pick");
  assert.ok(win, "the name window is open");
  const input = win.querySelector("input[type=text], input:not([type])");
  input.value = "Holy Week";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  click(byText(win, "button", "Create"));
  await until(() => title(b) === "Holy Week", 3000, "the new collection in the pane that asked");
  assert.equal(title(a), "My collections", "the other pane is left as it was");
  const made = (await store.all()).find((r) => r.kind === "collection");
  assert.equal(b.field.value, made.id);
  assert.match(barText(), /^Holy Week made\./);
});

test("a change to the notebook draws the pane again: a passage added elsewhere appears at once (decision 31)", async () => {
  await clearAll();
  const c = await keepCollection("Grows", []);
  const p = pane("p2", { shows: c.id });
  await until(() => title(p) === "Grows");
  assert.equal(p.el.querySelector(".desk-item__ref"), null);
  // As the LIT pane's "Add to collection ▸" adds one (add-passage.js).
  await store.change(async ({ all }) => planAddPassage(await all(), c.id, { bookKey: "john", chapter: 1, verse: 1, endVerse: 1 }, opCtx()));
  await until(() => byText(p.el, ".desk-item__ref", "John 1:1"), 3000, "the added passage");
});

test("destroy stops the pane listening", async () => {
  await clearAll();
  const p = pane("p2");
  await until(() => title(p) === "My collections");
  p.destroy();
  live.splice(live.indexOf(p), 1);
  document.dispatchEvent(new CustomEvent("desk:collection-new", { detail: { paneId: "p2" } }));
  await settle();
  assert.equal(document.querySelector(".desk-pick"), null);
});
