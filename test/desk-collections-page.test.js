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

test("E187: the page describes the feature under its title, as /sheets does, with or without collections", async () => {
  await clearAll();
  let { root, page } = await mount();
  const intro = () => root.querySelector("h1 + .desk-np__intro");
  assert.match(intro().textContent, /^A collection gathers your notes, highlights, bookmarks, sheets, and passages for one purpose/);
  assert.match(intro().textContent, /“Add to collection” in a verse’s menu or “Collections…” on a row in My Notebook\. Each can be printed or put on a sheet, and a Collections pane in the Study Desk shows one beside the LIT\./);
  assert.equal(byText(intro(), "a", "the Study Desk").getAttribute("href"), "/desk/");
  assert.equal(byText(intro(), "a", "How collections work").getAttribute("href"), "/desk/help/#collections");
  assert.equal(intro().nextElementSibling.className, "collection-page__actions", "New collection… under it");
  const form = intro().nextElementSibling.nextElementSibling;
  assert.ok(form.classList.contains("collection-page__new") && form.hidden, "its form, shut, under the button (E190)");
  assert.equal(form.nextElementSibling.textContent, "You haven’t made a collection yet.");
  assert.equal(root.querySelectorAll("a").length, 2, "one help link, not a second under the list");
  page.destroy();
  await store.change(async () => planSave(createCollection({ name: "Lent" }, opCtx())));
  ({ root, page } = await mount());
  assert.match(intro().textContent, /^A collection gathers/, "kept once there are collections");
  assert.equal(root.querySelector(".collection-page__new").nextElementSibling.className, "desk-sheet__sheets");
  page.destroy();
});

/* ── New collection, in place (E190) ─────────────────────────────── */

const newForm = (root) => root.querySelector(".collection-page__new");
const field = (root, name) => newForm(root).querySelector(`[data-focus-key="new-${name}"]`);
const type = (input, text) => {
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};
const primaries = (root) => root.querySelectorAll(".desk-sheet__btn--primary, .desk-editor__save");

test("E190: New collection… opens its form in place under the button, as /sheets' New sheet… opens its templates", async () => {
  await clearAll();
  const { root, page } = await mount();
  const fresh = byText(root, "button", "New collection…");
  assert.equal(fresh.getAttribute("aria-expanded"), "false");
  assert.equal(fresh.getAttribute("aria-controls"), newForm(root).id);
  fresh.click();
  assert.equal(document.querySelector(".desk-pick"), null, "no window");
  assert.equal(newForm(root).hidden, false);
  assert.equal(newForm(root).previousElementSibling.className, "collection-page__actions", "under the button's row");
  assert.ok(newForm(root).classList.contains("desk-sheet__passage-form"), "the Sheets chooser's card");
  assert.equal(document.activeElement, field(root, "name"), "focus in Name");
  assert.equal(newForm(root).querySelector("form").getAttribute("aria-label"), "New collection");
  // The name window's fields: Name, then an optional Description (E174).
  assert.deepEqual([...newForm(root).querySelectorAll("label")].map((l) => l.textContent), ["Name", "Description"]);
  assert.equal(field(root, "description").tagName, "TEXTAREA");
  // The opener says what it does now (E121), so Create is the one primary (E126).
  assert.equal(fresh.textContent, "Cancel");
  assert.equal(fresh.getAttribute("aria-expanded"), "true");
  assert.equal(fresh.classList.contains("desk-sheet__btn--primary"), false);
  assert.deepEqual([...primaries(root)].map((b) => b.textContent), ["Create"]);
  // Pressing it again closes the form, focus staying on it.
  fresh.click();
  assert.equal(newForm(root).hidden, true);
  assert.equal(fresh.textContent, "New collection…");
  assert.ok(fresh.classList.contains("desk-sheet__btn--primary"));
  assert.equal(document.activeElement, fresh);
  page.destroy();
});

test("E190: Create makes the collection, description and all, and goes into it with the undo bar", async () => {
  await clearAll();
  const { root, page } = await mount();
  byText(root, "button", "New collection…").click();
  type(field(root, "name"), "Advent series");
  type(field(root, "description"), "Four weeks of waiting");
  byText(newForm(root), "button", "Create").click();
  await until(() => root.querySelector("h1")?.textContent === "Advent series", 3000, "the new collection's page");
  const all = await collections();
  assert.equal(all.length, 1);
  assert.equal(all[0].name, "Advent series");
  assert.equal(all[0].description, "Four weeks of waiting");
  assert.ok(location.search.includes(`id=${encodeURIComponent(all[0].id)}`));
  assert.equal(document.querySelector(".desk-undo__text").textContent, "Advent series made.");
  // Back on the list, the form is shut and empty again.
  await page.toList();
  assert.equal(newForm(root).hidden, true);
  byText(root, "button", "New collection…").click();
  assert.equal(field(root, "name").value, "");
  page.destroy();
});

test("E190: Enter in Name creates, and a description left empty is not kept", async () => {
  await clearAll();
  const { root, page } = await mount();
  byText(root, "button", "New collection…").click();
  type(field(root, "name"), "Lent");
  newForm(root).querySelector("form").requestSubmit();
  await until(() => root.querySelector("h1")?.textContent === "Lent", 3000, "the new collection's page");
  const [made] = await collections();
  assert.equal("description" in made, false);
  page.destroy();
});

test("E190: an empty name is told so and nothing is written; Cancel and Escape put the form away and forget the words", async () => {
  await clearAll();
  const { root, page } = await mount();
  const fresh = byText(root, "button", "New collection…");
  fresh.click();
  type(field(root, "name"), "   ");
  newForm(root).querySelector("form").requestSubmit();
  await settle();
  assert.match(newForm(root).querySelector(".desk-sheet__problem").textContent, /Type a name first/);
  assert.equal((await collections()).length, 0);
  assert.equal(document.activeElement, field(root, "name"));
  byText(newForm(root), "button", "Cancel").click();
  assert.equal(newForm(root).hidden, true);
  assert.equal(document.activeElement, fresh, "focus back on New collection…");
  assert.equal(fresh.textContent, "New collection…");
  fresh.click();
  assert.equal(field(root, "name").value, "", "Cancel forgot the words");
  assert.equal(newForm(root).querySelector(".desk-sheet__problem").textContent, "", "and the problem line");
  type(field(root, "name"), "Pentecost");
  field(root, "name").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  assert.equal(newForm(root).hidden, true);
  assert.equal(document.activeElement, fresh);
  fresh.click();
  assert.equal(field(root, "name").value, "");
  assert.equal((await collections()).length, 0);
  page.destroy();
});

test("E190: a change elsewhere draws the list again with the form still open, its words kept and focus in its field", async () => {
  await clearAll();
  const { root, page } = await mount();
  byText(root, "button", "New collection…").click();
  type(field(root, "name"), "Holy Week");
  field(root, "description").focus();
  type(field(root, "description"), "Palm Sunday to Easter");
  const before = newForm(root);
  // Another tab makes a collection: the list is drawn again.
  await store.change(async () => planSave(createCollection({ name: "Lent" }, opCtx())));
  await until(() => root.querySelector(".desk-sheet__sheet"), 3000, "the other tab's collection");
  assert.notEqual(newForm(root), before, "a new form");
  assert.equal(newForm(root).hidden, false, "still open");
  assert.equal(field(root, "name").value, "Holy Week");
  assert.equal(field(root, "description").value, "Palm Sunday to Easter");
  assert.equal(document.activeElement, field(root, "description"), "focus where it was");
  const opener = root.querySelector('[data-focus-key="new"]');
  assert.equal(opener.textContent, "Cancel", "the opener still says Cancel");
  assert.equal(opener.getAttribute("aria-expanded"), "true");
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

test("Add ▾ › Passage… refuses what it cannot read and writes nothing", async () => {
  await clearAll();
  const made = createCollection({ name: "Readings", members: [] }, opCtx());
  await store.change(async () => planSave(made));
  const chapter = Array.from({ length: 3 }, (_, i) => `⟦v${i + 1}⟧ Verse ${i + 1}. `).join("");
  assert.ok(chapter);
  const { root, page } = await mount(`?id=${made.id}`);
  assert.equal(root.querySelector("h1").textContent, "Readings");
  byText(root, "button", "Add").click();
  byText(document, "[role=menuitem]", "Passage…").click();
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
  assert.deepEqual(words, ["Add", "Add to sheet…", "Rename…", "Print", "Delete", "Open in the Study Desk"]);
  const desk = actions.lastElementChild;
  assert.equal(desk.tagName, "A");
  assert.equal(desk.getAttribute("href"), `/desk/?collection=${encodeURIComponent(c.id)}`);
  assert.equal(desk.target, "", "the same tab, as a sheet's Edit in Study Desk");
  assert.ok(desk.classList.contains("desk-sheet__btn--quiet"));
  page.destroy();
});
