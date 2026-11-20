// "Collections…" on a row (D13, step 4, decision 24): the button on each kind
// of row and its place after Labels…, and its popover (collections-popover.js):
// a checkbox per collection that writes the collection alone, an inline New
// collection. Over the real store on fake-indexeddb.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { settle } from "./helpers/browser-env.mjs";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { createRecord } from "../src/lib/desk-records.mjs";
import { createCollection, holdsItem, itemMember } from "../src/lib/desk-collections.mjs";
import { createSheet } from "../src/lib/desk-sheets.mjs";
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

const { openStore } = await import("../src/scripts/desk/store.js");
const { createHistory } = await import("../src/scripts/desk/history.js");
const { recordRow } = await import("../src/scripts/desk/record-rows.js");
const { openCollectionsPopover, collectionsSubject } = await import("../src/scripts/desk/collections/collections-popover.js");
const { mountCollectionsPage } = await import("../src/scripts/desk/collections/collection-page.js");
const { closePanel } = await import("../src/scripts/lit-panel.js");

let n = 0;
const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const opCtx = () => ({ now: new Date().toISOString(), ...ctx() });
const make = (kind, fields) => createRecord(kind, fields, { ...opCtx(), id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` });

const store = await openStore({ ctx });
createHistory({ store, ctx });

async function until(fn, ms = 3000, what = "the condition") {
  const end = Date.now() + ms;
  while (!(await fn())) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

const note = await store.save(make("note", { bookKey: "john", chapter: 3, verse: 16, endVerse: 16, body: "grace", marker: "note" }));
const highlight = await store.save(
  make("highlight", { bookKey: "john", chapter: 3, verse: 16, endVerse: 16, color: "green", quote: { exact: "so loved", prefix: "", suffix: "" } }),
);
const bookmark = await store.save(make("bookmark", { bookKey: "john", chapter: 3, verse: 16, label: "Gospel" }));
const pin = await store.save(make("footnotePin", { bookKey: "john", chapter: 3, verse: 5, endVerse: 5, footnote: "A pinned footnote." }));
const sheet = await store.save(createSheet({ title: "Sunday handout" }, opCtx()));

async function aCollection(name, members = []) {
  const made = createCollection({ name, members }, opCtx());
  await store.change(async () => planSave(made));
  return made;
}
const fresh = (id) => store.get(id);

let trigger;
beforeEach(() => {
  closePanel({ force: true });
  document.body.replaceChildren();
  trigger = document.createElement("button");
  trigger.textContent = "Collections…";
  document.body.append(trigger);
});

const buttonsOf = (li) => [...li.querySelectorAll(".desk-np-row__buttons button")].map((b) => b.textContent);
const boxes = (panel) => [...panel.querySelectorAll("input[type=checkbox]")];
const rowsText = (panel) => boxes(panel).map((b) => b.parentElement.textContent);

test("a row has Collections… after Labels… and before Delete: bookmark, note, highlight, pinned footnote, sheet", () => {
  const actions = { labels: new Map(), onEdit() {}, onLabels() {}, onCollections() {}, onDelete() {} };
  const labelAt = (li) => buttonsOf(li).indexOf("Labels…");
  const collAt = (li) => buttonsOf(li).indexOf("Collections…");
  const bm = recordRow(bookmark, actions);
  assert.ok(labelAt(bm) >= 0 && collAt(bm) === labelAt(bm) + 1, "after Labels…");
  assert.equal(collAt(bm), buttonsOf(bm).length - 2, "and before Delete");
  for (const r of [note, highlight, pin, sheet]) {
    const li = recordRow(r, actions);
    assert.ok(collAt(li) >= 0, `${r.kind} has Collections…`);
    assert.equal(labelAt(li), -1, `${r.kind} has no Labels…`);
    assert.equal(collAt(li), buttonsOf(li).length - 2, `${r.kind}: before Delete`);
  }
});

test("the row names its subject in its label, as Labels… does, and carries the class and no handler no button", () => {
  const li = recordRow(note, { labels: new Map(), onLabels() {}, onCollections() {}, onDelete() {} });
  const b = li.querySelector(".desk-item__collections");
  assert.equal(b.className, "desk-item__edit desk-item__collections");
  assert.equal(b.getAttribute("aria-label"), "Collections for note on John 3:16");
  assert.equal(recordRow(sheet, { labels: new Map(), onLabels() {}, onCollections() {}, onDelete() {} }).querySelector(".desk-item__collections").getAttribute("aria-label"), "Collections for sheet “Sunday handout”");
  // A list that gives no handler (a collection's own page, the Trash) has none.
  const none = recordRow(note, { labels: new Map(), onLabels() {}, onDelete() {} });
  assert.ok(!none.querySelector(".desk-item__collections"));
});

test("the collection page's rows still have no buttons", async () => {
  const c = await aCollection("Advent series", [itemMember(note.id), itemMember(bookmark.id)]);
  history.replaceState(null, "", `/collections/?id=${encodeURIComponent(c.id)}`);
  const root = document.createElement("div");
  document.body.append(root);
  const page = await mountCollectionsPage(root, {
    store,
    ctx,
    base: "/",
    chapterText: async () => null,
    passageText: async () => "",
    parse: () => null,
  });
  await until(() => root.querySelectorAll(".desk-np-row").length >= 2, 3000, "the rows");
  assert.ok(!root.querySelector(".desk-item__collections"), "no Collections…");
  assert.ok(!root.querySelector(".desk-item__labels"), "no Labels…");
  for (const li of root.querySelectorAll(".desk-np-row")) {
    assert.ok(![...li.querySelectorAll("button")].some((b) => ["Edit", "Labels…", "Collections…"].includes(b.textContent)));
  }
  page.destroy();
});

test("it opens focused, names the record, lists the collections, and ticks those that hold it", async () => {
  const a = await aCollection("Advent series", [itemMember(note.id)]);
  const b = await aCollection("Christmas Eve");
  const panel = await openCollectionsPopover({ trigger, store, ctx, recordId: note.id, name: collectionsSubject(note, "John 3:16") });
  assert.ok(document.body.contains(panel));
  assert.equal(document.activeElement, panel);
  assert.equal(panel.querySelector(".lit-panel__heading").textContent, "Collections");
  assert.equal(panel.querySelector(".desk-labels__for").textContent, "note on John 3:16");
  const ticked = new Map(boxes(panel).map((x) => [x.parentElement.textContent, x.checked]));
  assert.equal(ticked.get("Advent series"), true);
  assert.equal(ticked.get("Christmas Eve"), false);
  assert.ok(rowsText(panel).includes("Advent series") && rowsText(panel).includes("Christmas Eve"));
  void a;
  void b;
});

test("ticking puts the record in, unticking takes it out; the collection alone is written, one step each", async () => {
  const c = await aCollection("Lent");
  const before = await fresh(note.id);
  const panel = await openCollectionsPopover({ trigger, store, ctx, recordId: note.id, name: "note" });
  const box = boxes(panel).find((x) => x.parentElement.textContent === "Lent");
  box.checked = true;
  box.dispatchEvent(new Event("change", { bubbles: true }));
  await until(async () => holdsItem(await fresh(c.id), note.id), 3000, "the item added");
  assert.equal((await fresh(note.id)).modified, before.modified, "the record's modified did not move");
  assert.deepEqual(await fresh(note.id), before, "the record is untouched");

  const again = boxes(panel).find((x) => x.parentElement.textContent === "Lent");
  again.checked = false;
  again.dispatchEvent(new Event("change", { bubbles: true }));
  await until(async () => !holdsItem(await fresh(c.id), note.id), 3000, "the item removed");
  assert.deepEqual(await fresh(note.id), before, "still untouched");

  // One step each: Ctrl+Z puts the item back.
  const { undoEntry } = await import("../src/scripts/desk/history.js");
  await undoEntry(store.lastEntry());
  await until(async () => holdsItem(await fresh(c.id), note.id), 3000, "the undo");
});

test("a collection another tab deleted is told so and the box goes back", async () => {
  const c = await aCollection("Gone soon");
  const panel = await openCollectionsPopover({ trigger, store, ctx, recordId: highlight.id, name: "highlight" });
  const box = boxes(panel).find((x) => x.parentElement.textContent === "Gone soon");
  await store.remove(c.id);
  box.checked = true;
  box.dispatchEvent(new Event("change", { bubbles: true }));
  await settle(50);
  assert.equal(box.checked === false || !document.body.contains(box), true);
});

test("the New collection field makes one with this record as its first member, in one write", async () => {
  const panel = await openCollectionsPopover({ trigger, store, ctx, recordId: bookmark.id, name: "bookmark" });
  const input = panel.querySelector(".desk-labels__input");
  const form = panel.querySelector(".desk-labels__new");
  // An empty name is said, and nothing is made.
  const count = async () => (await store.all()).filter((r) => r.kind === "collection").length;
  const was = await count();
  input.value = "   ";
  form.requestSubmit();
  await settle(30);
  assert.match(panel.querySelector(".desk-labels__error").textContent, /Type a name first/);
  assert.equal(await count(), was);

  input.value = "Easter";
  form.requestSubmit();
  await until(async () => (await count()) === was + 1, 3000, "the new collection");
  const made = (await store.all()).find((r) => r.kind === "collection" && r.name === "Easter");
  assert.deepEqual(made.members.map((m) => [m.type, m.recordId]), [["item", bookmark.id]]);
  assert.equal(input.value, "", "the field is cleared");
  await until(() => rowsText(panel).includes("Easter"), 3000, "the list redrawn");
  assert.equal(boxes(panel).find((x) => x.parentElement.textContent === "Easter").checked, true);
});

test("a record gone from the notebook closes the popover", async () => {
  const stray = await store.save(make("note", { bookKey: "john", chapter: 3, verse: 1, endVerse: 1, body: "x", marker: "note" }));
  await openCollectionsPopover({ trigger, store, ctx, recordId: stray.id, name: "note" });
  await store.remove(stray.id);
  await settle(50);
  assert.ok(!document.querySelector(".desk-labels"), "the popover closed");
});

test("the list is by name, so ticking a box leaves the order alone", async () => {
  for (const r of await store.all()) if (r.kind === "collection") await store.remove(r.id);
  await aCollection("Zeta list");
  await new Promise((r) => setTimeout(r, 5));
  await aCollection("Alpha list"); // changed last, but first by name
  await new Promise((r) => setTimeout(r, 5));
  const panel = await openCollectionsPopover({ trigger, store, ctx, recordId: note.id, name: "note" });
  const names = () => rowsText(panel).join("|");
  assert.equal(names(), "Alpha list|Zeta list");
  const box = boxes(panel).find((x) => x.parentElement.textContent === "Zeta list");
  box.checked = true;
  box.dispatchEvent(new Event("change", { bubbles: true }));
  await until(async () => (await store.all()).some((r) => r.name === "Zeta list" && holdsItem(r, note.id)), 3000, "the tick");
  await settle(50);
  assert.equal(names(), "Alpha list|Zeta list");
});

test("a sheet's row in a list of sheets has Collections… before Delete, and it opens the popover", async () => {
  const { sheetRow } = await import("../src/scripts/desk/sheets/my-sheets.js");
  const host = { store, opCtx, idSuffix: "t", say() {}, content: document.body, sheetHref: (s) => `/sheets/?id=${s.id}` };
  const ul = document.createElement("ul");
  const li = sheetRow(host, sheet, ul);
  ul.append(li);
  document.body.append(ul);
  const names = [...li.querySelectorAll("button")].map((b) => b.textContent);
  assert.deepEqual(names, ["Edit", "Duplicate", "Collections…", "Delete"]);
  const b = li.querySelector('[data-focus-key^="collections-"]');
  assert.equal(b.getAttribute("aria-label"), "Collections for sheet “Sunday handout”");
  b.click();
  await until(() => document.querySelector(".desk-labels"), 3000, "the popover");
  assert.equal(document.querySelector(".desk-labels__for").textContent, "sheet “Sunday handout”");
  // A list with no store (a page that cannot write) has none.
  const bare = sheetRow({ ...host, store: null }, sheet, ul);
  assert.ok(![...bare.querySelectorAll("button")].some((x) => x.textContent === "Collections…"));
});
