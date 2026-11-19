// D13 step 6: the collection filter in My Notebook's list (kept-list.js, drawn on /notebook), the notebook search
// finding collections by name, the pure helpers under both, and "My collections" in /desk's title menu. My Notes
// (tab-mine.js) is driven in its own test beside the label filter's.

import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { settle, resetDom, window } from "./helpers/browser-env.mjs";
import { createRecord } from "../src/lib/desk-records.mjs";
import {
  collectionFilter,
  collectionsNamed,
  createCollection,
  filterableCollections,
  itemMember,
  leaveOut,
  passageMember,
  ruleMember,
} from "../src/lib/desk-collections.mjs";

const RealChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = class extends RealChannel {
  constructor(name) {
    super(name);
    this.unref();
  }
};
const hashListeners = [];
const realAdd = window.addEventListener.bind(window);
window.addEventListener = (type, fn, ...rest) => {
  if (type === "hashchange") hashListeners.push(fn);
  return realAdd(type, fn, ...rest);
};

const { initUndo } = await import("../src/scripts/desk/undo-bar.js");
initUndo();
const undoBar = document.querySelector(".desk-undo");

let n = 0;
async function until(fn, tries = 150) {
  for (let i = 0; i < tries; i++) {
    const v = fn();
    if (v) return v;
    await settle(10);
  }
  throw new Error("timed out waiting for the page");
}

const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const opCtx = () => ({ now: new Date().toISOString(), ...ctx() });
const make = (kind, fields) => createRecord(kind, fields, { ...opCtx(), id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` });

function notebook({ collections = true } = {}) {
  const label = make("label", { name: "Advent" });
  const marks = [1, 2].map((v) => make("bookmark", { bookKey: "luke", chapter: 2, verse: v, label: `Mark ${v}`, labels: [label.id] }));
  const note = make("note", { bookKey: "john", chapter: 3, verse: 16, endVerse: 16, body: "grace", marker: "note" });
  const other = make("note", { bookKey: "john", chapter: 1, verse: 1, endVerse: 1, body: "word", marker: "note" });
  const advent = createCollection(
    {
      name: "Advent series",
      members: [
        ruleMember(label.id),
        itemMember(note.id),
        passageMember({ bookKey: "luke", chapter: 1, verse: 26, endVerse: 27 }),
        passageMember({ bookKey: "luke", chapter: 1, verse: 30 }),
      ],
    },
    opCtx(),
  );
  const gifts = createCollection({ name: "Gifts of the Spirit", members: [] }, opCtx());
  return { label, marks, note, other, advent, gifts, records: [label, ...marks, note, other, ...(collections ? [advent, gifts] : [])] };
}

test("collectionFilter holds a collection's items and its rule's bookmarks, less any left out, and counts its passages", () => {
  const { marks, note, other, advent, records } = notebook();
  const held = collectionFilter(records, advent.id);
  assert.deepEqual([...held.ids].sort(), [note.id, ...marks.map((m) => m.id)].sort());
  assert.equal(held.ids.has(other.id), false);
  assert.equal(held.passages, 2);
  const left = leaveOut(advent, marks[0].id, records, opCtx());
  const narrower = collectionFilter(records.map((r) => (r.id === advent.id ? left : r)), advent.id);
  assert.equal(narrower.ids.has(marks[0].id), false);
  assert.equal(narrower.ids.has(marks[1].id), true);
  assert.equal(collectionFilter(records, "nope").ids.size, 0);
});

test("filterableCollections lists collections by name, and collectionsNamed finds them by the words of a search", () => {
  const { records, advent, gifts } = notebook();
  assert.deepEqual(filterableCollections(records).map((c) => c.id), [advent.id, gifts.id]);
  assert.deepEqual(collectionsNamed(records, "  ADVENT ").map((c) => c.id), [advent.id]);
  assert.deepEqual(collectionsNamed(records, "spirit gifts").map((c) => c.id), [gifts.id]);
  assert.deepEqual(collectionsNamed(records, "advent gifts"), []);
  assert.deepEqual(collectionsNamed(records, "   "), []);
  assert.deepEqual(filterableCollections(notebook({ collections: false }).records), []);
});

async function openPage(options) {
  globalThis.indexedDB = new IDBFactory();
  const seeded = notebook(options);
  const { openStore } = await import(`../src/scripts/desk/store.js?seed=${++n}`);
  const store = await openStore({ ctx });
  await store.commit({ put: seeded.records, remove: [] }, { record: false });
  for (const fn of hashListeners.splice(0)) window.removeEventListener("hashchange", fn);
  resetDom("http://localhost/notebook/");
  document.documentElement.dataset.contentVersion = "v1";
  document.body.innerHTML = `<h1 class="notebook-page__title">Notebook</h1><div data-notebook-page></div>`;
  document.body.append(undoBar);
  await import(`../src/scripts/desk/notebook-page.js?n=${++n}`);
  await until(() => document.querySelector("[data-np-count]")?.textContent);
  await settle(30);
  return seeded;
}

const q = (sel) => document.querySelector(sel);
const rowIds = () => [...document.querySelectorAll("[data-np-lists] .desk-list > .desk-item")].map((li) => li.dataset.id);
const type = async (box, text) => {
  box.value = text;
  box.dispatchEvent(new window.Event("input", { bubbles: true }));
  await settle(250);
};

test("the collection filter appears with a collection, starts on Any collection, and narrows to what one holds", async () => {
  const { marks, note, other, advent } = await openPage();
  const select = q("#deskNpCollection");
  assert.equal(q("[data-np-collection-field]").hidden, false);
  assert.deepEqual([...select.options].map((o) => o.textContent), ["Any collection", "Advent series", "Gifts of the Spirit"]);
  assert.equal(select.value, "");
  assert.equal(q("[data-np-passages]").hidden, true);

  select.value = advent.id;
  select.dispatchEvent(new window.Event("change", { bubbles: true }));
  await until(() => /Showing/.test(q("[data-np-count]").textContent));
  assert.match(q("[data-np-count]").textContent, /^Showing 1 note, 2 bookmarks \(of \d+ kept\)\.$/);
  const ids = rowIds();
  for (const id of [note.id, ...marks.map((m) => m.id)]) assert.ok(ids.includes(id), "a held record is listed");
  assert.equal(ids.includes(other.id), false);
  const line = q("[data-np-passages]");
  assert.equal(line.hidden, false);
  assert.equal(line.textContent, "Its 2 passages are on its page.");
  assert.equal(line.querySelector("a").getAttribute("href"), `/collections/?id=${encodeURIComponent(advent.id)}`);

  select.value = "";
  select.dispatchEvent(new window.Event("change", { bubbles: true }));
  await until(() => !/Showing/.test(q("[data-np-count]").textContent));
  assert.equal(q("[data-np-passages]").hidden, true);
  assert.ok(rowIds().includes(other.id));
});

test("a collection with nothing in it shows nothing, and no passage line", async () => {
  const { gifts } = await openPage();
  const select = q("#deskNpCollection");
  select.value = gifts.id;
  select.dispatchEvent(new window.Event("change", { bubbles: true }));
  await until(() => /Nothing matches/.test(q("[data-np-count]").textContent));
  assert.equal(q("[data-np-passages]").hidden, true);
});

test("with no collection there is no collection filter", async () => {
  await openPage({ collections: false });
  assert.equal(q("[data-np-collection-field]").hidden, true);
});

test("searching finds collections by name as links, never as rows or in the count", async () => {
  const { advent, gifts, other } = await openPage();
  const box = q("#deskNpQuery");
  await type(box, "gifts");
  const group = await until(() => q("[data-np-named]"));
  assert.equal(group.querySelector("h3").textContent, "Collections");
  const links = [...group.querySelectorAll("a.desk-item__ref")];
  assert.deepEqual(links.map((a) => a.textContent), ["Gifts of the Spirit"]);
  assert.equal(links[0].getAttribute("href"), `/collections/?id=${encodeURIComponent(gifts.id)}`);
  assert.match(q("[data-np-count]").textContent, /^Nothing matches \(of \d+ kept\)\.$/);
  // The group's rows are the only place a collection is drawn, and no record row is one.
  assert.equal(rowIds().filter((id) => id === gifts.id || id === advent.id).length, 1);

  await type(box, "advent");
  const again = await until(() => q("[data-np-named]"));
  assert.deepEqual([...again.querySelectorAll("a.desk-item__ref")].map((a) => a.textContent), ["Advent series"]);
  assert.match(q("[data-np-count]").textContent, /^Showing 2 bookmarks \(of \d+ kept\)\.$/);

  await type(box, "");
  assert.equal(q("[data-np-named]"), null);
  void other;
});

test("My Notes mirrors the label filter: a row of collections, All collections first, narrowing to what one holds", async () => {
  const { marks, note, other, advent, records } = notebook();
  const store = {
    all: async () => records,
    byChapter: async (bookKey, chapter) => records.filter((r) => r.bookKey === bookKey && r.chapter === chapter),
    subscribe: () => () => {},
    lastEntry: () => null,
  };
  resetDom("http://localhost/desk/");
  const { createMineTab } = await import("../src/scripts/desk/tab-mine.js");
  const tab = createMineTab({ store, storeError: null, inReadView: false, visible: () => true });
  document.body.append(tab.el);
  await tab.render();
  const row = tab.el.querySelector("[data-mine-collections]");
  assert.equal(row.hidden, false);
  const buttons = () => [...row.querySelectorAll("button")];
  assert.deepEqual(buttons().map((b) => b.textContent), ["All collections", "Advent series", "Gifts of the Spirit"]);
  assert.equal(buttons()[0].getAttribute("aria-pressed"), "true");
  const ids = () => [...tab.el.querySelectorAll(".desk-list:not(.desk-mine__pin-list) .desk-item[data-id]")].map((li) => li.dataset.id);
  assert.ok(ids().includes(other.id));

  buttons()[1].click();
  await until(() => !ids().includes(other.id));
  assert.deepEqual(ids().sort(), [note.id, ...marks.map((m) => m.id)].sort());
  assert.equal(buttons()[1].getAttribute("aria-pressed"), "true");
  const line = tab.el.querySelector("[data-mine-passages]");
  assert.equal(line.hidden, false);
  assert.equal(line.textContent, "Its 2 passages are on its page.");
  assert.equal(line.querySelector("a").getAttribute("href"), `/collections/?id=${encodeURIComponent(advent.id)}`);

  // Pressing the chosen one lets go of it.
  buttons()[1].click();
  await until(() => ids().includes(other.id));
  assert.equal(tab.el.querySelector("[data-mine-passages]").hidden, true);
  tab.destroy();
  tab.el.remove();
});

test("/desk's title menu lists My collections beside My Notebook, opening in a new tab", async () => {
  resetDom("http://localhost/desk/");
  document.body.innerHTML = `<div class="desk-title"><button class="desk-title__button"><span>Study Desk</span></button></div>`;
  const { createTitleMenu } = await import(`../src/scripts/desk/title-menu.js?n=${++n}`);
  const wrap = document.querySelector(".desk-title");
  const menu = createTitleMenu({
    wrap,
    titleButton: wrap.querySelector("button"),
    announce: () => {},
    getTour: () => null,
    inTour: () => false,
    layoutWindow: { close() {} },
    printWindow: { close() {} },
  });
  const items = [...menu.el.querySelectorAll("a.desk-title__item")];
  const labels = items.map((a) => a.querySelector(".desk-title__label").textContent);
  const at = (name) => labels.findIndex((l) => l.startsWith(name));
  assert.ok(at("My collections") > 0 && at("My collections") === at("My Notebook") + 1);
  const mine = items[at("My collections")];
  assert.equal(mine.getAttribute("href"), "/collections/");
  assert.equal(mine.getAttribute("target"), "_blank");
  assert.match(mine.getAttribute("rel"), /noopener/);
});
