// The collections page driven in a browser DOM (D13, step 2): the list and the
// empty page, "New collection…", one collection (add a passage, the order
// switch, headings, moving, Remove, Rename, Delete), and My Notebook's new
// bulk-delete box. Over the real store on fake-indexeddb, with the chapter
// reader and the passage reader faked, so nothing touches the network.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle } from "./helpers/browser-env.mjs";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { createCollection, passageMember } from "../src/lib/desk-collections.mjs";
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

const { mountCollectionsPage } = await import("../src/scripts/desk/collections/collection-page.js");
const { openStore } = await import("../src/scripts/desk/store.js");
const { openNewCollection } = await import("../src/scripts/desk/collections/new-collection.js");

const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const opCtx = () => ({ now: new Date().toISOString(), ...ctx() });

async function until(fn, ms = 3000, what = "the condition") {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

const store = await openStore({ ctx });
const collections = async () => (await store.all()).filter((r) => r.kind === "collection" && !r.deleted);

async function clearAll() {
  for (const r of await store.all()) await store.remove(r.id).catch(() => {});
}

// A chapter whose anchor text has verses 1 to 3, as passageForReference reads it.
const fakeChapter = async () => null;

async function mount(search = "") {
  // Only the last test's page and windows go; the undo bar is made once and kept.
  for (const old of document.querySelectorAll("[data-test-root], .desk-pick")) old.remove();
  history.replaceState(null, "", `/collections/${search}`);
  const root = document.createElement("div");
  root.dataset.testRoot = "";
  document.body.append(root);
  const page = await mountCollectionsPage(root, {
    store,
    ctx,
    base: "/",
    chapterText: fakeChapter,
    passageText: async () => "For God so loved the world.",
    parse: (raw) => {
      const m = /^john (\d+):(\d+)(?:-(\d+))?$/i.exec(raw.trim());
      return m ? { bookKey: "john", chapter: Number(m[1]), verse: Number(m[2]), endVerse: m[3] ? Number(m[3]) : undefined } : null;
    },
  });
  return { root, page };
}

const byText = (root, sel, text) => [...root.querySelectorAll(sel)].find((el) => el.textContent.trim() === text);

test("with no collections the page says what they are, offers New collection…, and links the help", async () => {
  await clearAll();
  const { root, page } = await mount();
  assert.equal(root.querySelector("h1").textContent, "My collections");
  assert.ok(byText(root, "button", "New collection…"));
  const link = byText(root, "a", "How collections work");
  assert.equal(link.getAttribute("href"), "/desk/help/#collections");
  assert.equal(root.querySelectorAll(".desk-sheet__sheet").length, 0);
  assert.ok(!byText(root, "button", "Make a sheet"));
  page.destroy();
});

test("New collection… makes one and goes into it", async () => {
  await clearAll();
  const { root, page } = await mount();
  byText(root, "button", "New collection…").click();
  const win = document.querySelector(".desk-pick");
  assert.ok(win, "the name window is open");
  win.querySelector("input").value = "Advent series";
  win.querySelector("form").requestSubmit();
  await until(async () => true);
  await until(() => root.querySelector("h1")?.textContent === "Advent series", 3000, "the new collection's page");
  const all = await collections();
  assert.equal(all.length, 1);
  assert.equal(all[0].name, "Advent series");
  assert.ok(location.search.includes(`id=${encodeURIComponent(all[0].id)}`));
  page.destroy();
});

test("an empty name is told so and nothing is written", async () => {
  await clearAll();
  const { root, page } = await mount();
  byText(root, "button", "New collection…").click();
  const win = document.querySelector(".desk-pick");
  win.querySelector("input").value = "   ";
  win.querySelector("form").requestSubmit();
  await settle();
  assert.match(win.querySelector(".desk-sheet__problem").textContent, /Type a name first/);
  assert.equal((await collections()).length, 0);
  win.querySelector(".desk-editor__actions button").click();
  page.destroy();
});

test("the list shows name, description, count and when it changed, and Delete trashes with an undo", async () => {
  await clearAll();
  const made = createCollection({ name: "Lent", description: "Forty days", members: [] }, opCtx());
  await store.change(async () => planSave(made));
  const { root, page } = await mount();
  const card = root.querySelector(".desk-sheet__sheet");
  assert.match(card.querySelector(".desk-sheet__open-name").textContent, /Lent/);
  const meta = card.querySelector(".desk-sheet__open-meta").textContent;
  assert.match(meta, /Forty days/);
  assert.match(meta, /0 items|none|nothing/i);
  byText(card, "button", "Delete").click();
  await until(() => root.querySelectorAll(".desk-sheet__sheet").length === 0, 3000, "the card to go");
  assert.equal((await collections()).length, 0);
  assert.equal(document.querySelector(".desk-undo__text").textContent, "Lent deleted.");
  page.destroy();
});

test("a collection that isn't there says so, with the way back", async () => {
  await clearAll();
  const { root, page } = await mount("?id=nope");
  assert.equal(root.querySelector("h1").textContent, "Collection not found");
  assert.ok(root.querySelector("a.sheets-page__back"));
  page.destroy();
});

test("Add passage… refuses what it cannot read and writes nothing", async () => {
  await clearAll();
  const made = createCollection({ name: "Readings", members: [] }, opCtx());
  await store.change(async () => planSave(made));
  const chapter = Array.from({ length: 3 }, (_, i) => `⟦v${i + 1}⟧ Verse ${i + 1}. `).join("");
  assert.ok(chapter);
  const { root, page } = await mount(`?id=${made.id}`);
  assert.equal(root.querySelector("h1").textContent, "Readings");
  byText(root, "button", "Add passage…").click();
  const input = root.querySelector('[data-focus-key="add-input"]');
  assert.ok(input && !input.closest(".collection-page__form").hidden);
  input.value = "Nonsense";
  input.closest("form").requestSubmit();
  await settle();
  assert.ok(root.querySelector(".desk-sheet__problem").textContent.length > 0);
  assert.equal((await collections())[0].members.length, 0);
  page.destroy();
});

test("the order switch writes the collection's order and My order shows the heading form", async () => {
  await clearAll();
  const made = createCollection({ name: "Ordered", members: [] }, opCtx());
  await store.change(async () => planSave(made));
  const { root, page } = await mount(`?id=${made.id}`);
  assert.ok(!byText(root, "button", "Add a heading"), "no headings outside My order");
  const mine = [...root.querySelectorAll(".desk-seg__input")].find((i) => i.value === "mine");
  mine.checked = true;
  mine.dispatchEvent(new Event("change", { bubbles: true }));
  await until(() => byText(root, "button", "Add a heading"), 3000, "My order's heading button");
  assert.equal((await collections())[0].order, "mine");
  byText(root, "button", "Add a heading").click();
  const input = root.querySelector('[data-focus-key="heading-input"]');
  input.value = "Week 1";
  input.closest("form").requestSubmit();
  await until(() => root.querySelector(".collection-page__heading"), 3000, "the heading row");
  assert.match(root.querySelector(".collection-page__heading").textContent, /Week 1/);
  assert.ok(root.querySelector(".collection-page__heading").classList.contains("v2-rule"));
  assert.equal((await collections())[0].members.filter((m) => m.type === "heading").length, 1);
  page.destroy();
});

test("Rename… changes the name and description, and Delete goes back to the list with the collection in the trash", async () => {
  await clearAll();
  const made = createCollection({ name: "Old", members: [] }, opCtx());
  await store.change(async () => planSave(made));
  const { root, page } = await mount(`?id=${made.id}`);
  byText(root, "button", "Rename…").click();
  const win = document.querySelector(".desk-pick");
  const [name, description] = win.querySelectorAll("input, textarea");
  name.value = "New name";
  description.value = "About it";
  win.querySelector("form").requestSubmit();
  await until(() => root.querySelector("h1")?.textContent === "New name", 3000, "the renamed title");
  assert.match(root.querySelector(".collection-page__description").textContent, /About it/);
  byText(root, "button", "Delete").click();
  await until(() => root.querySelector("h1")?.textContent === "My collections", 3000, "the list");
  assert.equal((await collections()).length, 0);
  page.destroy();
});

test("openNewCollection keeps a first member for step 3, and gives focus back after Create", async () => {
  await clearAll();
  let got = null;
  const member = { type: "passage", id: "m1", bookKey: "john", chapter: 3, verse: 16, endVerse: 16 };
  const from = document.createElement("button");
  from.id = "from-the-menu";
  document.body.append(from);
  openNewCollection({ store, ctx, firstMember: member, lead: "John 3:16 will be its first passage.", back: () => from, onCreated: (c) => (got = c) });
  const win = document.querySelector(".desk-pick");
  assert.match(win.textContent, /first passage/);
  win.querySelector("input").value = "From a verse";
  win.querySelector("form").requestSubmit();
  await until(() => got, 3000, "onCreated");
  const [saved] = await collections();
  assert.equal(saved.members.length, 1);
  assert.equal(saved.members[0].type, "passage");
  await until(() => !document.querySelector(".desk-pick"), 3000, "the window to close");
  assert.equal(document.activeElement?.id, "from-the-menu");
  from.remove();
});

test("a passage shows its words, ↓ moves it in My order, and Remove takes it out", async () => {
  await clearAll();
  const a = passageMember({ bookKey: "john", chapter: 3, verse: 16, endVerse: 16 });
  const b = passageMember({ bookKey: "john", chapter: 1, verse: 1, endVerse: 1 });
  const made = { ...createCollection({ name: "Two", members: [a, b] }, opCtx()), order: "mine" };
  await store.change(async () => planSave(made));
  const { root, page } = await mount(`?id=${made.id}`);
  await until(() => root.querySelectorAll("[data-row-key]").length === 2, 3000, "two rows");
  assert.match(root.textContent, /For God so loved the world/);
  const rows = () => [...root.querySelectorAll("[data-row-key]")].map((r) => r.dataset.rowKey);
  const first = rows()[0];
  const arrow = (where, key) => root.querySelector(`[data-focus-key="${where}-${key}"]`);
  // As in the sheet editor, ↑ is off on the first row and ↓ on the last.
  assert.deepEqual([arrow("up", first).disabled, arrow("down", first).disabled, arrow("down", rows()[1]).disabled], [true, false, true]);
  arrow("down", first).click();
  await until(() => rows()[1] === first, 3000, "the row to move down");
  root.querySelector(`[data-focus-key="remove-${rows()[0]}"]`).click();
  await until(() => rows().length === 1, 3000, "the row to go");
  assert.equal((await collections())[0].members.length, 1);
  page.destroy();
});

test("a collection's page ends its actions with a quiet Open in the Study Desk, in this tab (decision 27)", async () => {
  await clearAll();
  const c = createCollection({ name: "Advent series", members: [passageMember({ bookKey: "john", chapter: 3, verse: 16, endVerse: 16 })] }, { now: new Date().toISOString(), ...ctx() });
  await store.change(async () => planSave(c));
  const { root, page } = await mount(`?id=${encodeURIComponent(c.id)}`);
  const actions = root.querySelector(".collection-page__actions");
  const words = [...actions.children].map((n) => n.textContent.trim());
  assert.deepEqual(words, ["Add passage…", "Add to sheet…", "Rename…", "Print", "Delete", "Open in the Study Desk"]);
  const desk = actions.lastElementChild;
  assert.equal(desk.tagName, "A");
  assert.equal(desk.getAttribute("href"), `/desk/?collection=${encodeURIComponent(c.id)}`);
  assert.equal(desk.target, "", "the same tab, as a sheet's Edit in Study Desk");
  assert.ok(desk.classList.contains("desk-sheet__btn--quiet"));
  page.destroy();
});
