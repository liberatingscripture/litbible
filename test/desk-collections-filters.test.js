// D13 step 6: the notebook search finding collections by name (kept-list.js, drawn on /notebook), the pure
// helpers under it, and no "My collections" in /desk's title menu (E180). My Notebook's list and My Notes (tab-mine.js)
// have no collection filter (E175: BVJ took it out, since a collection's page and the Collections pane show what
// it holds), so those tests hold that it is gone.

import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { settle, resetDom, window } from "./helpers/browser-env.mjs";
import { createRecord } from "../src/lib/desk-records.mjs";
import { collectionsNamed, createCollection, filterableCollections, itemMember, passageMember, ruleMember } from "../src/lib/desk-collections.mjs";

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

test("My Notebook's list has no collection filter, and lists every record with collections kept", async () => {
  const { marks, note, other } = await openPage();
  assert.equal(q("#deskNpCollection"), null);
  const labels = [...document.querySelectorAll("[data-notebook-page] label")].map((l) => l.textContent.trim());
  assert.equal(labels.includes("Collection"), false);
  assert.equal([...document.querySelectorAll("[data-notebook-page] option")].some((o) => o.textContent === "Any collection"), false);
  const ids = rowIds();
  for (const id of [note.id, other.id, ...marks.map((m) => m.id)]) assert.ok(ids.includes(id), "every record is listed");
  assert.equal(/Showing/.test(q("[data-np-count]").textContent), false);
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
  // The collection comes first, and the line under it doesn't deny that it matched.
  const lists = [...q("[data-np-lists]").children];
  assert.equal(lists.indexOf(group), 0);
  assert.equal(lists[1].textContent, "Nothing else matches. Clear the search or a filter to see more.");
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

test("My Notes has no collection filter: no row of collections, and every record listed", async () => {
  const { marks, note, other, records } = notebook();
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
  const pressed = [...tab.el.querySelectorAll("button")].map((b) => b.textContent);
  for (const name of ["All collections", "Advent series", "Gifts of the Spirit"]) assert.equal(pressed.includes(name), false, `no “${name}” button`);
  assert.equal(tab.el.querySelector('[aria-label="Show items in one collection"]'), null);
  const ids = [...tab.el.querySelectorAll(".desk-list:not(.desk-mine__pin-list) .desk-item[data-id]")].map((li) => li.dataset.id);
  for (const id of [note.id, other.id, ...marks.map((m) => m.id)]) assert.ok(ids.includes(id), "every record is listed");
  tab.destroy();
  tab.el.remove();
});

test("/desk's title menu has no My collections, as it has no My sheets (E180)", async () => {
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
  assert.ok(labels.some((l) => l.startsWith("My Notebook")), "My Notebook stays");
  assert.ok(!labels.some((l) => /My (collections|sheets)/.test(l)), "neither list page is in the title menu");
  assert.ok(!items.some((a) => /^\/(collections|sheets)\//.test(a.getAttribute("href") ?? "")));
});
