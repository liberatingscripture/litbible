// The undo bar's words for a collection (D13; BVJ, 2026-11-20, E205): "Open the collection"
// is left out where that collection's view is on screen already, and one
// added record or sheet is named rather than counted. Over the real store on
// fake-indexeddb.

import { test } from "node:test";
import assert from "node:assert/strict";
import "./helpers/browser-env.mjs";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { createCollection } from "../src/lib/desk-collections.mjs";
import { createRecord } from "../src/lib/desk-records.mjs";
import { planSave } from "../src/lib/desk-store-core.mjs";
import { createSheet } from "../src/lib/desk-sheets.mjs";
import { passageFromVerses } from "../src/lib/desk-sheet-passages.mjs";

globalThis.indexedDB = new IDBFactory();
globalThis.IDBKeyRange = IDBKeyRange;
const RealChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = class extends RealChannel {
  constructor(name) {
    super(name);
    this.unref?.();
  }
};

const { addPassageToCollection, collectionLink, collectionHref } = await import("../src/scripts/desk/collections/add-passage.js");
const { addRecordsToCollection } = await import("../src/scripts/desk/collections/add-records.js");
const { openStore } = await import("../src/scripts/desk/store.js");

const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const store = await openStore({ ctx });
const barText = () => document.querySelector(".desk-undo__text")?.textContent ?? "";
const barLink = () => document.querySelector(".desk-undo__link")?.getAttribute("href") ?? null;
const stamp = (id) => {
  const el = document.createElement("section");
  el.setAttribute("data-collection-shown", id);
  document.body.append(el);
  return el;
};

let n = 0;
const recordId = () => `01J00000000000000000001${String(++n).padStart(3, "0")}`;
const stamped = () => ({ now: new Date().toISOString(), ...ctx() });

async function aCollection(name) {
  const made = createCollection({ name }, stamped());
  await store.change(async () => planSave(made));
  return made;
}

async function aNote(verse) {
  const note = createRecord(
    "note",
    { bookKey: "john", chapter: 3, verse, endVerse: verse, body: "grace", marker: "note" },
    { ...stamped(), id: recordId() },
  );
  await store.change(async () => planSave(note));
  return note;
}

test("N.1: the link is there normally and left out while the collection's view is on screen", async () => {
  const c = await aCollection("Advent series");
  assert.deepEqual(
    { href: collectionLink(c.id)?.href },
    { href: collectionHref(c.id) },
  );
  const shown = stamp(c.id);
  assert.equal(collectionLink(c.id), null);
  shown.remove();
  assert.notEqual(collectionLink(c.id), null);
});

test("N.1: an add made while the collection is on screen says so with no link", async () => {
  const c = await aCollection("Lent group");
  const shown = stamp(c.id);
  try {
    assert.equal(await addPassageToCollection({ store, ctx, collectionId: c.id, fields: passageFromVerses(null, { bookKey: "luke", chapter: 2 }, 10) }), "added");
    assert.equal(barText(), "Luke 2:10 added to Lent group.");
    assert.equal(barLink(), null);
  } finally {
    shown.remove();
  }
});

test("N.2: one record added is named by its kind and reference; two or more are counted", async () => {
  const c = await aCollection("Advent small group");
  const one = await aNote(16);
  assert.equal(await addRecordsToCollection({ store, ctx, collectionId: c.id, recordIds: [one.id] }), "added");
  assert.equal(barText(), "Note on John 3:16 added to Advent small group.");

  const two = await aNote(17);
  const three = await aNote(18);
  assert.equal(await addRecordsToCollection({ store, ctx, collectionId: c.id, recordIds: [two.id, three.id] }), "added");
  assert.equal(barText(), "2 added to Advent small group.");
});

test("N.2: one sheet added is named by its name", async () => {
  const c = await aCollection("Readings");
  const sheet = { ...createSheet({ title: "Week 1: The Magnificat" }, stamped()), id: recordId() };
  await store.change(async () => planSave(sheet));
  assert.equal(await addRecordsToCollection({ store, ctx, collectionId: c.id, recordIds: [sheet.id] }), "added");
  assert.equal(barText(), "Week 1: The Magnificat added to Readings.");
});
