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

const { addPassageToCollection, collectionHref, collectionLink, setCollectionOpener } = await import("../src/scripts/desk/collections/add-passage.js");
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

test("Open the collection is the page's link, until /desk gives an opener; then a plain click shows it there (decision 27)", () => {
  const plain = collectionLink("c-1");
  assert.deepEqual(plain, { label: "Open the collection", href: collectionHref("c-1") });
  const shown = [];
  setCollectionOpener((id) => shown.push(id));
  try {
    const link = collectionLink("c-1");
    assert.equal(link.href, collectionHref("c-1"), "still the page, for a modified click");
    link.open();
    assert.deepEqual(shown, ["c-1"]);
  } finally {
    setCollectionOpener(null);
  }
  assert.equal("open" in collectionLink("c-1"), false, "a chapter page has none");
});

const { alsoInside } = await import("../src/scripts/desk/collections/add-passage.js");

test("a passage inside one the collection holds says so; the smallest holder is named (E194)", async () => {
  const c = await aCollection("Advent small group");
  const lk = (verse, endVerse) => passageFromVerses(null, { bookKey: "luke", chapter: 1 }, verse, endVerse);
  assert.equal(await addPassageToCollection({ store, ctx, collectionId: c.id, fields: lk(46, 55) }), "added");
  assert.equal(barText(), "Luke 1:46–55 added to Advent small group.");

  assert.equal(await addPassageToCollection({ store, ctx, collectionId: c.id, fields: lk(54) }), "added");
  assert.equal(barText(), "Luke 1:54 added to Advent small group. It’s also inside Luke 1:46–55.");
  assert.equal(barLink(), collectionHref(c.id));

  assert.equal(await addPassageToCollection({ store, ctx, collectionId: c.id, fields: lk(50, 52) }), "added");
  assert.equal(await addPassageToCollection({ store, ctx, collectionId: c.id, fields: lk(51) }), "added");
  assert.equal(barText(), "Luke 1:51 added to Advent small group. It’s also inside Luke 1:50–52.");
});

test("an exact duplicate is still refused, and says so with no extra sentence (E194)", async () => {
  const c = await aCollection("Lent group");
  const fields = passageFromVerses(null, { bookKey: "luke", chapter: 1 }, 46, 55);
  await addPassageToCollection({ store, ctx, collectionId: c.id, fields });
  assert.equal(await addPassageToCollection({ store, ctx, collectionId: c.id, fields }), "again");
  assert.equal(barText(), "Luke 1:46–55 is already in Lent group.");
  assert.equal((await store.all()).find((r) => r.id === c.id).members.length, 1);
});

test("a passage not inside any held one says nothing extra (E194)", async () => {
  const c = await aCollection("Week of prayer");
  await addPassageToCollection({ store, ctx, collectionId: c.id, fields: passageFromVerses(null, { bookKey: "luke", chapter: 1 }, 46, 55) });
  assert.equal(await addPassageToCollection({ store, ctx, collectionId: c.id, fields: passageFromVerses(null, { bookKey: "luke", chapter: 1 }, 10) }), "added");
  assert.equal(barText(), "Luke 1:10 added to Week of prayer.");
  // Reaching past the held verses is not inside them.
  assert.equal(await addPassageToCollection({ store, ctx, collectionId: c.id, fields: passageFromVerses(null, { bookKey: "luke", chapter: 1 }, 54, 60) }), "added");
  assert.equal(barText(), "Luke 1:54–60 added to Week of prayer.");
});

test("alsoInside reads the collection as given, ignoring records and other chapters", () => {
  const collection = {
    members: [
      { type: "item", recordId: "n1" },
      { type: "passage", bookKey: "luke", chapter: 1, verse: 46, endVerse: 55 },
    ],
  };
  assert.equal(alsoInside(collection, { bookKey: "luke", chapter: 1, verse: 47 }), " It’s also inside Luke 1:46–55.");
  assert.equal(alsoInside(collection, { bookKey: "luke", chapter: 2, verse: 47 }), "");
  assert.equal(alsoInside(null, { bookKey: "luke", chapter: 1, verse: 47 }), "");
});
