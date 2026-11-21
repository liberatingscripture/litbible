// The "Collections…" button says where the item is (E202): "In Advent small
// group", "In 2 collections", or "Collections…", live, by the popover's own test.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { createRecord } from "../src/lib/desk-records.mjs";
import { createCollection, itemMember, removeItem } from "../src/lib/desk-collections.mjs";
import { planSave } from "../src/lib/desk-store-core.mjs";

globalThis.indexedDB = new IDBFactory();
globalThis.IDBKeyRange = IDBKeyRange;
await import("./helpers/browser-env.mjs");
const RealChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = class extends RealChannel {
  constructor(name) {
    super(name);
    this.unref?.();
  }
};

const { openStore } = await import("../src/scripts/desk/store.js");
const { collectionsTag, collectionsSubject, openCollectionsPopover, keepCollectionsWords } = await import(
  "../src/scripts/desk/collections/collections-popover.js"
);
const { closePanel } = await import("../src/scripts/lit-panel.js");

let n = 0;
const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const opCtx = () => ({ now: new Date().toISOString(), ...ctx() });
const make = (kind, fields) => createRecord(kind, fields, { ...opCtx(), id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` });

const store = await openStore({ ctx });
const note = await store.save(make("note", { bookKey: "john", chapter: 3, verse: 16, endVerse: 16, body: "grace", marker: "note" }));

async function until(fn, what) {
  const end = Date.now() + 3000;
  while (!fn()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

async function aCollection(name, members = []) {
  const made = createCollection({ name, members }, opCtx());
  await store.change(async () => planSave(made));
  return made;
}

beforeEach(() => {
  closePanel({ force: true });
  document.body.replaceChildren();
});

const tagFor = () => {
  const tag = collectionsTag({ store, ctx, record: note, reference: "John 3:16" });
  document.body.append(tag);
  return tag;
};

test("none: Collections…, and the label keeps today's words", async () => {
  const tag = tagFor();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(tag.textContent, "Collections…");
  assert.equal(tag.getAttribute("aria-label"), "Collections for note on John 3:16");
});

test("one, then two, then back to none: the words follow every write, from the store directly", async () => {
  const tag = tagFor();
  const advent = await aCollection("Advent small group", [itemMember(note.id)]);
  await until(() => tag.textContent === "In Advent small group", "the collection's name");
  assert.equal(tag.getAttribute("aria-label"), "In Advent small group, collections for note on John 3:16");
  assert.ok(tag.getAttribute("aria-label").startsWith(tag.textContent), "the name contains the visible words at its start");

  await aCollection("Lent", [itemMember(note.id)]);
  await until(() => tag.textContent === "In 2 collections", "the count");
  assert.equal(tag.getAttribute("aria-label"), "In 2 collections, collections for note on John 3:16");

  // `removeItem` is imported at the top on purpose: a dynamic import() in here
  // yields to the event loop, which ends an IndexedDB transaction, so the
  // store's write after it threw TransactionInactiveError on Node 22 (CI's
  // Node 24 resolves a cached module without yielding, which hid it).
  await store.change(async ({ all }) => {
    const records = await all();
    const [mine] = records.filter((r) => r.id === advent.id);
    return planSave(removeItem(mine, note.id, opCtx()));
  });
  await until(() => tag.textContent === "In Lent", "one left");
});

test("a tick in the popover updates the button", async () => {
  await aCollection("Zebra only"); // "Lent" from the test before already holds the note
  const tag = tagFor();
  await until(() => tag.textContent === "In Lent", "the first read");
  const panel = await openCollectionsPopover({ trigger: tag, store, ctx, recordId: note.id, name: collectionsSubject(note, "John 3:16") });
  const box = [...panel.querySelectorAll("input[type=checkbox]")].find((x) => x.parentElement.textContent === "Zebra only");
  box.checked = true;
  box.dispatchEvent(new Event("change", { bubbles: true }));
  await until(() => tag.textContent === "In 2 collections", "the tick");
  box.checked = false;
  box.dispatchEvent(new Event("change", { bubbles: true }));
  await until(() => tag.textContent === "In Lent", "the untick");
});

test("a list's buttons share one listener and one read, and one that has left the document is dropped", async () => {
  let all = 0;
  let subscribed = 0;
  const fake = {
    all: async () => {
      all++;
      return [];
    },
    subscribe(fn) {
      subscribed++;
      fake.fn = fn;
      return () => {};
    },
  };
  const buttons = Array.from({ length: 30 }, () => {
    const b = document.createElement("button");
    document.body.append(b);
    keepCollectionsWords(b, { store: fake, recordId: "x", subject: "note" });
    return b;
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(subscribed, 1, "one listener for the store");
  assert.equal(all, 1, "one read for the whole list");
  fake.fn(["c"], "this-tab", ["collection"]);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(all, 2, "one read for a collection's change");
  fake.fn(["n"], "this-tab", ["note"]);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(all, 2, "no read for a note's change");
  for (const b of buttons) b.remove();
  fake.fn(["n"], "this-tab", ["note"]);
  fake.fn(["c"], "this-tab", ["collection"]);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(all, 2, "no read once every button has left");
});
