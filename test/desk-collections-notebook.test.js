// My Notebook's side of D13 step 5, driven on /notebook (notebook-page.js) over
// the real store on fake-indexeddb: the Collections section, "Add these N to a
// collection…" while a search or label filter is on, a label's "Add all
// bookmarks labeled Advent…", and the question before deleting a label a rule
// uses (one undo restores the label and the rule).

import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { settle, resetDom, window } from "./helpers/browser-env.mjs";
import { createRecord } from "../src/lib/desk-records.mjs";
import { createCollection, ruleMember } from "../src/lib/desk-collections.mjs";

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

// The undo bar is built once, and a reset of the page drops it; it is put back after each.
const { initUndo } = await import("../src/scripts/desk/undo-bar.js");
initUndo();
const undoBar = document.querySelector(".desk-undo");

let n = 0;
let store = null;
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

/** A page over a notebook with a label, three bookmarks on it, a note, and one collection with a rule on the label. */
async function openPage({ withRule = true } = {}) {
  globalThis.indexedDB = new IDBFactory();
  const label = make("label", { name: "Advent" });
  const marks = [1, 2, 3].map((v) => make("bookmark", { bookKey: "luke", chapter: 2, verse: v, label: `Mark ${v}`, labels: [label.id] }));
  const note = make("note", { bookKey: "john", chapter: 3, verse: 16, endVerse: 16, body: "grace", marker: "note" });
  const collection = createCollection({ name: "Advent series", members: withRule ? [ruleMember(label.id)] : [] }, opCtx());
  const seed = [label, ...marks, note, collection];
  const { openStore } = await import(`../src/scripts/desk/store.js?seed=${++n}`);
  store = await openStore({ ctx });
  await store.commit({ put: seed, remove: [] }, { record: false });
  for (const fn of hashListeners.splice(0)) window.removeEventListener("hashchange", fn);
  resetDom("http://localhost/notebook/");
  document.documentElement.dataset.contentVersion = "v1";
  document.body.innerHTML = `<h1 class="notebook-page__title">Notebook</h1><div data-notebook-page></div>`;
  document.body.append(undoBar);
  await import(`../src/scripts/desk/notebook-page.js?n=${++n}`);
  await until(() => document.querySelector("[data-np-new-label]"));
  await until(() => document.querySelector(".desk-np__label"));
  await settle(30);
  return { label, marks, note, collection };
}

const q = (sel) => document.querySelector(sel);
const byText = (sel, text) => [...document.querySelectorAll(sel)].find((el) => el.textContent.trim() === text);
const reread = async (id) => (await store.all()).find((r) => r.id === id);
const labelRowOf = (name) => [...document.querySelectorAll(".desk-np__label")].find((li) => li.querySelector(".desk-np__label-name")?.textContent === name);
const barText = () => document.querySelector(".desk-undo__text")?.textContent ?? "";

test("the Collections section lists each collection with its count, New collection…, and All my collections", async () => {
  const { collection } = await openPage();
  const section = [...document.querySelectorAll(".desk-np__group")].find((s) => s.querySelector("h3")?.textContent === "Collections");
  assert.ok(section, "a Collections section");
  const link = section.querySelector("a.desk-item__ref");
  assert.equal(link.textContent, "Advent series");
  assert.equal(link.getAttribute("href"), `/collections/?id=${encodeURIComponent(collection.id)}`);
  assert.equal(section.querySelector(".desk-item__kind").textContent, "3 items");
  assert.ok([...section.querySelectorAll("a")].some((a) => a.textContent === "All my collections" && a.getAttribute("href") === "/collections/"));
  assert.ok([...section.querySelectorAll("button")].some((b) => b.textContent === "New collection…"));
  // A collection is never a row of the list.
  assert.equal(q("[data-np-kept]")?.textContent ?? "", "");
  assert.ok(![...document.querySelectorAll(".desk-np__group .desk-np-row")].some((li) => li.dataset.id === collection.id && !section.contains(li)));
});

test("Add these N shows while a search or label filter is on, counts what a collection can hold, and a pick adds them", async () => {
  const { note, marks, collection } = await openPage({ withRule: false });
  const holder = () => q("[data-np-add-these]");
  assert.equal(holder().hidden, true);
  const box = q("#deskNpQuery");
  box.value = "Mark";
  box.dispatchEvent(new window.Event("input", { bubbles: true }));
  await until(() => !holder().hidden);
  const button = holder().querySelector("button");
  assert.equal(button.textContent, "Add these 3 to a collection…");
  button.click();
  const win = await until(() => q(".desk-pick"));
  win.querySelector(`.desk-pick__row[data-pick="${collection.id}"]`).click();
  await until(async () => (await reread(collection.id)).members.length === 3);
  assert.deepEqual((await reread(collection.id)).members.map((m) => m.recordId).sort(), marks.map((m) => m.id).sort());
  await until(() => barText());
  assert.equal(barText(), "3 added to Advent series.");

  box.value = "";
  box.dispatchEvent(new window.Event("input", { bubbles: true }));
  await until(() => holder().hidden);
  void note;
});

test("a label's Add all bookmarks labeled Advent… opens the window with the two choices", async () => {
  await openPage({ withRule: false });
  const row = labelRowOf("Advent");
  const button = [...row.querySelectorAll("button")].find((b) => b.textContent === "Add all bookmarks labeled Advent…");
  assert.ok(button);
  button.click();
  const win = await until(() => q(".desk-pick"));
  assert.deepEqual([...win.querySelectorAll(".desk-setting__label")].map((s) => s.textContent), [
    "Only the 3 labeled Advent now",
    "These 3, and any you label Advent from now on",
  ]);
});

test("deleting a label a rule uses asks first; Yes keeps its bookmarks as items and one undo restores both", async () => {
  const { label, marks, collection } = await openPage();
  const row = labelRowOf("Advent");
  row.querySelector(".desk-item__delete").click();
  const ask = await until(() => q(".desk-np__label .desk-np__ask"));
  assert.equal(ask.querySelector(".desk-np__ask-text").textContent, "Advent is used by Advent series. Keep its 3 bookmarks there?");
  // Asking writes nothing.
  assert.equal((await reread(collection.id)).members[0].type, "rule");
  [...ask.querySelectorAll("button")].find((b) => b.textContent === "Yes, keep them").click();
  await until(async () => (await reread(collection.id)).members.every((m) => m.type === "item"));
  assert.deepEqual((await reread(collection.id)).members.map((m) => m.recordId).sort(), marks.map((m) => m.id).sort());
  assert.ok(!(await reread(label.id)) || (await reread(label.id)).kind === "trash");
  await until(() => barText());
  assert.match(barText(), /^Label “Advent” deleted\./);
  assert.match(barText(), /Its bookmarks stay in the collections that used it\./);
  document.querySelector(".desk-undo__undo").click();
  await until(async () => (await reread(collection.id)).members[0]?.type === "rule");
  await until(async () => (await reread(label.id))?.kind === "label");
  await until(async () => (await reread(marks[0].id)).labels?.[0] === label.id);
});

test("No deletes the label and leaves the rule, which then has no label; Cancel changes nothing", async () => {
  const { label, collection } = await openPage();
  let row = labelRowOf("Advent");
  row.querySelector(".desk-item__delete").click();
  let ask = await until(() => q(".desk-np__label .desk-np__ask"));
  [...ask.querySelectorAll("button")].find((b) => b.textContent === "Cancel").click();
  await until(() => !q(".desk-np__ask"));
  assert.equal((await reread(label.id)).kind, "label");
  assert.equal((await reread(collection.id)).members[0].type, "rule");

  row = labelRowOf("Advent");
  row.querySelector(".desk-item__delete").click();
  ask = await until(() => q(".desk-np__label .desk-np__ask"));
  [...ask.querySelectorAll("button")].find((b) => b.textContent === "No, just delete the label").click();
  await until(async () => (await reread(label.id))?.kind !== "label");
  assert.equal((await reread(collection.id)).members[0].type, "rule");
});

test("a label no rule uses is deleted at once, as before", async () => {
  const { label } = await openPage({ withRule: false });
  labelRowOf("Advent").querySelector(".desk-item__delete").click();
  await until(async () => (await reread(label.id))?.kind !== "label");
  assert.ok(!q(".desk-np__ask"));
});
