// E176: My Notes (tab-mine.js, the Notebook panel's tab and /desk's pane) has the line under its count that My
// Notebook's list has: "Add these N to a collection…" while the search or a label narrows the list, and a link to
// My Notebook, which opens in a new tab on /desk. Driven over the real store on fake-indexeddb.

import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { settle, resetDom, window } from "./helpers/browser-env.mjs";
import { createRecord } from "../src/lib/desk-records.mjs";
import { createCollection } from "../src/lib/desk-collections.mjs";

const RealChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = class extends RealChannel {
  constructor(name) {
    super(name);
    this.unref();
  }
};

const { initUndo } = await import("../src/scripts/desk/undo-bar.js");
initUndo();
const undoBar = document.querySelector(".desk-undo");

let n = 0;
async function until(fn, tries = 150) {
  for (let i = 0; i < tries; i++) {
    const v = await fn();
    if (v) return v;
    await settle(10);
  }
  throw new Error("timed out waiting for the tab");
}

const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const opCtx = () => ({ now: new Date().toISOString(), ...ctx() });
const make = (kind, fields) => createRecord(kind, fields, { ...opCtx(), id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` });

/** My Notes over a notebook with a label on three bookmarks, a note, and one empty collection. */
async function openTab(options = {}) {
  globalThis.indexedDB = new IDBFactory();
  const label = make("label", { name: "Advent" });
  const marks = [1, 2, 3].map((v) => make("bookmark", { bookKey: "luke", chapter: 2, verse: v, label: `Mark ${v}`, labels: [label.id] }));
  const note = make("note", { bookKey: "john", chapter: 3, verse: 16, endVerse: 16, body: "grace", marker: "note" });
  const collection = createCollection({ name: "Advent series", members: [] }, opCtx());
  const { openStore } = await import(`../src/scripts/desk/store.js?seed=${++n}`);
  const store = await openStore({ ctx });
  await store.commit({ put: [label, ...marks, note, collection], remove: [] }, { record: false });
  resetDom("http://localhost/desk/");
  document.documentElement.dataset.contentVersion = "v1";
  document.body.append(undoBar);
  const { createMineTab } = await import(`../src/scripts/desk/tab-mine.js?n=${++n}`);
  const tab = createMineTab({ store, storeError: null, inReadView: false, visible: () => true, ctx, ...options });
  document.body.append(tab.el);
  await tab.render();
  return { tab, store, label, marks, note, collection };
}

const line = (tab) => tab.el.querySelector("[data-mine-links]");
const addThese = (tab) => line(tab).querySelector("button");
const reread = async (store, id) => (await store.all()).find((r) => r.id === id);
// The line's words as they show: its hidden parts left out.
const shownText = (tab) => [...line(tab).children].filter((c) => !c.hidden).map((c) => c.textContent).join("");

test("My Notes links to My Notebook in the same tab, with nothing to add while nothing narrows the list", async () => {
  const { tab } = await openTab();
  assert.equal(line(tab).hidden, false);
  const link = line(tab).querySelector("a");
  assert.equal(link.textContent, "My Notebook");
  assert.equal(link.getAttribute("href"), "/notebook/");
  assert.equal(link.getAttribute("target"), null);
  assert.equal(addThese(tab).hidden, true);
  // The line sits right under the count.
  assert.equal(line(tab).previousElementSibling, tab.el.querySelector(".desk-mine__count"));
  tab.destroy();
});

test("on /desk the link opens My Notebook in a new tab and says so", async () => {
  const { tab } = await openTab({ notebookInNewTab: true });
  const link = line(tab).querySelector("a");
  assert.equal(link.getAttribute("target"), "_blank");
  assert.match(link.getAttribute("rel"), /noopener/);
  assert.match(link.getAttribute("rel"), /noreferrer/);
  assert.equal(link.textContent.replace(/\s+/g, " "), "My Notebook (opens in a new tab)");
  assert.ok(link.querySelector(".desk-newtab"));
  tab.destroy();
});

test("a search offers Add these N, and a pick adds exactly what the list shows", async () => {
  const { tab, store, marks, collection } = await openTab();
  const box = tab.el.querySelector('input[type="search"]');
  box.value = "Mark";
  box.dispatchEvent(new window.Event("input", { bubbles: true }));
  await until(() => !addThese(tab).hidden);
  assert.equal(addThese(tab).textContent, "Add these 3 to a collection…");
  assert.equal(shownText(tab), "Add these 3 to a collection… · My Notebook");
  addThese(tab).click();
  const win = await until(() => document.querySelector(".desk-pick"));
  win.querySelector(`.desk-pick__row[data-pick="${collection.id}"]`).click();
  await until(async () => (await reread(store, collection.id)).members.length === 3);
  assert.deepEqual((await reread(store, collection.id)).members.map((m) => m.recordId).sort(), marks.map((m) => m.id).sort());
  await until(() => document.querySelector(".desk-undo__text")?.textContent);
  assert.equal(document.querySelector(".desk-undo__text").textContent, "3 added to Advent series.");

  // Clearing the search takes the offer away; the link stays.
  box.value = "";
  box.dispatchEvent(new window.Event("search", { bubbles: true }));
  await until(() => addThese(tab).hidden);
  assert.equal(shownText(tab), "My Notebook");
  tab.destroy();
});

test("a label alone offers it too, and a search that finds one says “this one”", async () => {
  const { tab, label } = await openTab();
  const pill = [...tab.el.querySelectorAll(".desk-mine__label")].find((b) => b.dataset.choice === label.id);
  pill.click();
  await until(() => !addThese(tab).hidden);
  assert.equal(addThese(tab).textContent, "Add these 3 to a collection…");
  pill.click(); // lets go of it
  await until(() => addThese(tab).hidden);

  const box = tab.el.querySelector('input[type="search"]');
  box.value = "grace";
  box.dispatchEvent(new window.Event("input", { bubbles: true }));
  await until(() => !addThese(tab).hidden);
  assert.equal(addThese(tab).textContent, "Add this one to a collection…");
  tab.destroy();
});

test("without a notebook there is no line at all", async () => {
  resetDom("http://localhost/desk/");
  const { createMineTab } = await import(`../src/scripts/desk/tab-mine.js?n=${++n}`);
  const tab = createMineTab({ store: null, storeError: null, inReadView: false, visible: () => true, ctx });
  document.body.append(tab.el);
  await tab.render();
  assert.equal(line(tab).hidden, true);
  tab.destroy();
});
