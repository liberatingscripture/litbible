// addPassageToCollection (D13): the one way a passage goes into a collection
// from outside its page, which steps 3 and 4 share. Over the real store on
// fake-indexeddb, reading what the undo bar says.

import { test } from "node:test";
import assert from "node:assert/strict";
import "./helpers/browser-env.mjs";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { createCollection } from "../src/lib/desk-collections.mjs";
import { planSave } from "../src/lib/desk-store-core.mjs";
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

const { addPassageToCollection, collectionHref } = await import("../src/scripts/desk/collections/add-passage.js");
const { openStore } = await import("../src/scripts/desk/store.js");

const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const store = await openStore({ ctx });
const bar = () => document.querySelector(".desk-undo__bar");
const barText = () => document.querySelector(".desk-undo__text")?.textContent ?? "";
const barLink = () => document.querySelector(".desk-undo__link")?.getAttribute("href") ?? null;

async function aCollection(name) {
  const made = createCollection({ name }, { now: new Date().toISOString(), ...ctx() });
  await store.change(async () => planSave(made));
  return made;
}

const luke210 = passageFromVerses(null, { bookKey: "luke", chapter: 2 }, 10);

test("a passage is added once, with Undo and Open the collection; a repeat writes nothing and says so", async () => {
  const c = await aCollection("Advent series");
  assert.equal(await addPassageToCollection({ store, ctx, collectionId: c.id, fields: luke210 }), "added");
  assert.equal(barText(), "Luke 2:10 added to Advent series.");
  assert.equal(barLink(), collectionHref(c.id));
  assert.equal(bar().hidden, false);
  const after = (await store.all()).find((r) => r.id === c.id);
  assert.deepEqual(
    after.members.map((m) => [m.type, m.bookKey, m.chapter, m.verse]),
    [["passage", "luke", 2, 10]],
  );

  assert.equal(await addPassageToCollection({ store, ctx, collectionId: c.id, fields: luke210 }), "again");
  assert.equal(barText(), "Luke 2:10 is already in Advent series.");
  assert.equal(barLink(), collectionHref(c.id));
  assert.equal((await store.all()).find((r) => r.id === c.id).members.length, 1);
});

test("a collection that is gone adds nothing and says so", async () => {
  assert.equal(await addPassageToCollection({ store, ctx, collectionId: "no-such-collection", fields: luke210, name: "Lent" }), "failed");
  assert.match(barText(), /may have been deleted\. Nothing was added\./);
});
