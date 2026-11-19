// The live rule on the collection's page and the ways a label's bookmarks get
// in (D13, step 5): the rule's line ("Every bookmark labeled Advent · 2"), "from
// Advent", "Leave it out of this collection" and bringing one back, "Stop adding
// new ones" and "Remove"; addLabelToCollection and addRecordsToCollection; and
// the pick window's two choices (decision 23). Over the real store on
// fake-indexeddb.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle } from "./helpers/browser-env.mjs";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { createRecord } from "../src/lib/desk-records.mjs";
import { createCollection, itemMember, ruleMember } from "../src/lib/desk-collections.mjs";
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
const { addLabelToCollection, addRecordsToCollection, openAddLabel, openAddRecords } = await import("../src/scripts/desk/collections/add-records.js");
const { openPickWindow, closePickWindow } = await import("../src/scripts/desk/pick-window.js");
const { openStore } = await import("../src/scripts/desk/store.js");

let n = 0;
const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const opCtx = () => ({ now: new Date().toISOString(), ...ctx() });
const make = (kind, fields) => createRecord(kind, fields, { ...opCtx(), id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` });
const store = await openStore({ ctx });

async function until(fn, ms = 3000, what = "the condition") {
  const end = Date.now() + ms;
  while (!(await fn())) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

const advent = await store.save(make("label", { name: "Advent" }));
const lent = await store.save(make("label", { name: "Lent" }));
const b1 = await store.save(make("bookmark", { bookKey: "luke", chapter: 1, verse: 38, label: "Here I am", labels: [advent.id] }));
const b2 = await store.save(make("bookmark", { bookKey: "luke", chapter: 2, verse: 10, label: "Good news", labels: [advent.id] }));
const b3 = await store.save(make("bookmark", { bookKey: "john", chapter: 1, verse: 5, label: "Light", labels: [advent.id] }));
const plain = await store.save(make("bookmark", { bookKey: "john", chapter: 3, verse: 16, label: "Gospel" }));
const note = await store.save(make("note", { bookKey: "john", chapter: 3, verse: 16, endVerse: 16, body: "grace", marker: "note" }));

async function aCollection(name, members = []) {
  const made = createCollection({ name, members }, opCtx());
  await store.change(async () => planSave(made));
  return made;
}
const reread = async (id) => (await store.all()).find((r) => r.id === id);
const barText = () => document.querySelector(".desk-undo__text")?.textContent ?? "";
const barLink = () => document.querySelector(".desk-undo__link")?.textContent ?? null;
const byText = (root, sel, text) => [...root.querySelectorAll(sel)].find((el) => el.textContent.trim() === text);

async function mount(id) {
  for (const old of document.querySelectorAll("[data-test-root], .desk-pick")) old.remove();
  history.replaceState(null, "", `/collections/?id=${id}`);
  const root = document.createElement("div");
  root.dataset.testRoot = "";
  document.body.append(root);
  const page = await mountCollectionsPage(root, {
    store,
    ctx,
    base: "/",
    chapterText: async () => null,
    passageText: async () => "words",
    parse: () => null,
  });
  return { root, page };
}

test("a rule's line counts its bookmarks, and each says it is from the label", async () => {
  const c = await aCollection("Advent series", [ruleMember(advent.id)]);
  const { root, page } = await mount(c.id);
  const line = root.querySelector(".collection-page__rule");
  assert.ok(line.textContent.startsWith("Every bookmark labeled Advent · 3"));
  assert.ok(byText(line, "button", "Stop adding new ones").classList.contains("desk-item__stop"));
  assert.ok(byText(line, "button", "Remove").classList.contains("desk-item__stop"));
  const kinds = [...root.querySelectorAll(".desk-item__kind")].map((k) => k.textContent);
  assert.equal(kinds.length, 3);
  assert.ok(kinds.every((k) => k.endsWith("from Advent")));
  assert.equal(root.querySelectorAll(".desk-item__delete").length, 3);
  assert.ok([...root.querySelectorAll(".desk-item__delete")].every((b) => b.textContent === "Leave it out of this collection"));
  page.destroy();
});

test("Leave it out puts the bookmark in the rule's exceptions; the line counts it and brings it back", async () => {
  const c = await aCollection("Advent series", [ruleMember(advent.id)]);
  const { root, page } = await mount(c.id);
  root.querySelector(".desk-item__delete").click();
  await until(async () => (await reread(c.id)).members[0].except.length === 1);
  assert.match(barText(), /left out of Advent series\.$/);
  const left = (await reread(c.id)).members[0].except[0];
  assert.ok([b1.id, b2.id, b3.id].includes(left));
  await until(() => root.querySelector(".collection-page__rule").textContent.includes("1 left out"));
  assert.ok(root.querySelector(".collection-page__rule").textContent.startsWith("Every bookmark labeled Advent · 2"));
  assert.equal(root.querySelectorAll(".desk-item__delete").length, 2);

  byText(root.querySelector(".collection-page__rule"), "button", [...root.querySelectorAll(".collection-page__rule button")].find((b) => b.textContent.startsWith("Bring back")).textContent).click();
  await until(async () => (await reread(c.id)).members[0].except.length === 0);
  await until(() => !root.querySelector(".collection-page__rule").textContent.includes("left out"));
  assert.equal(root.querySelectorAll(".desk-item__delete").length, 3);
  page.destroy();
});

test("Stop adding new ones turns the rule into items; Remove takes the rule and keeps a bookmark added by hand", async () => {
  const stop = await aCollection("Advent series", [ruleMember(advent.id)]);
  let { root, page } = await mount(stop.id);
  byText(root, "button", "Stop adding new ones").click();
  await until(async () => (await reread(stop.id)).members.every((m) => m.type === "item"));
  const after = await reread(stop.id);
  assert.deepEqual(after.members.map((m) => m.recordId).sort(), [b1.id, b2.id, b3.id].sort());
  assert.match(barText(), /^Advent’s 3 bookmarks stay in Advent series, and new ones won’t be added\.$/);
  await until(() => !root.querySelector(".collection-page__rule"));
  assert.ok(![...root.querySelectorAll(".desk-item__kind")].some((k) => k.textContent.includes("from")));
  page.destroy();

  const rm = await aCollection("Both ways", [ruleMember(advent.id), itemMember(b1.id)]);
  ({ root, page } = await mount(rm.id));
  byText(root, "button", "Remove").click();
  await until(async () => (await reread(rm.id)).members.length === 1);
  assert.deepEqual((await reread(rm.id)).members.map((m) => [m.type, m.recordId]), [["item", b1.id]]);
  assert.match(barText(), /The rule “Advent” was removed from Both ways\./);
  await until(() => root.querySelectorAll(".desk-item").length === 1);
  page.destroy();
});

test("a rule whose label is gone says so and can only be removed", async () => {
  const gone = await store.save(make("label", { name: "Gone" }));
  const c = await aCollection("Old", [ruleMember(gone.id)]);
  await store.remove(gone.id);
  const { root, page } = await mount(c.id);
  const line = root.querySelector(".collection-page__rule");
  assert.match(line.textContent, /label for this rule is gone/);
  assert.equal(line.querySelectorAll("button").length, 1);
  assert.equal(line.querySelector("button").textContent, "Remove");
  page.destroy();
});

test("addLabelToCollection adds the bookmarks as items, or the rule, and says where they went", async () => {
  const items = await aCollection("Items");
  assert.equal(await addLabelToCollection({ store, ctx, collectionId: items.id, label: { id: advent.id, name: "Advent" }, rule: false }), "added");
  assert.equal(barText(), "3 added to Items.");
  assert.match(barLink(), /^Open the collection/);
  assert.deepEqual((await reread(items.id)).members.map((m) => m.type), ["item", "item", "item"]);
  assert.equal(await addLabelToCollection({ store, ctx, collectionId: items.id, label: { id: advent.id, name: "Advent" }, rule: false }), "again");
  assert.match(barText(), /already\.$/);

  const ruled = await aCollection("Ruled");
  assert.equal(await addLabelToCollection({ store, ctx, collectionId: ruled.id, label: { id: advent.id, name: "Advent" }, rule: true }), "added");
  assert.equal(barText(), "3 labeled Advent added to Ruled, and new ones will be.");
  assert.deepEqual((await reread(ruled.id)).members.map((m) => [m.type, m.match?.label]), [["rule", advent.id]]);
  assert.equal(await addLabelToCollection({ store, ctx, collectionId: ruled.id, label: { id: advent.id, name: "Advent" }, rule: true }), "again");
  assert.equal(barText(), "Ruled adds every bookmark labeled Advent already.");

  assert.equal(await addLabelToCollection({ store, ctx, collectionId: "nope", label: { id: advent.id, name: "Advent" }, rule: true, name: "Nope" }), "failed");
  assert.match(barText(), /may have been deleted\. Nothing was added\.$/);
});

test("addRecordsToCollection adds once, counts ones already there, and one undo takes the write back", async () => {
  const c = await aCollection("Mixed", [itemMember(note.id)]);
  assert.equal(await addRecordsToCollection({ store, ctx, collectionId: c.id, recordIds: [note.id, plain.id, b1.id, b1.id] }), "added");
  assert.equal(barText(), "2 added to Mixed. 1 was there already.");
  assert.equal((await reread(c.id)).members.length, 3);
  document.querySelector(".desk-undo__undo").click();
  await until(async () => (await reread(c.id)).members.length === 1);
  assert.equal(await addRecordsToCollection({ store, ctx, collectionId: c.id, recordIds: [note.id] }), "again");
  assert.equal(barText(), "That is in Mixed already.");
});

test("the pick window's choices: the first is chosen unless value names another, and a pick hears the choice", async () => {
  closePickWindow("page");
  const heard = [];
  openPickWindow({
    heading: "Labels",
    title: "Add to a collection",
    noun: ["collection", "collections"],
    items: [{ id: "a", name: "Advent series" }],
    choices: { label: "Which bookmarks", options: [{ value: "now", label: "Only the 2 labeled Advent now" }, { value: "rule", label: "These 2, and any you label Advent from now on" }] },
    onPick: (item, choice) => heard.push([item.id, choice]),
  });
  const radios = [...document.querySelectorAll(".desk-pick input[type=radio]")];
  assert.deepEqual(radios.map((r) => r.checked), [true, false]);
  assert.equal(document.querySelector(".desk-pick [role=radiogroup]").getAttribute("aria-label"), "Which bookmarks");
  radios[1].checked = true;
  radios[1].dispatchEvent(new Event("change", { bubbles: true }));
  document.querySelector(".desk-pick__row[data-pick=a]").click();
  assert.deepEqual(heard, [["a", "rule"]]);

  openPickWindow({
    heading: "x",
    title: "y",
    noun: ["a", "b"],
    items: [{ id: "a", name: "A" }],
    choices: { label: "c", value: "rule", options: [{ value: "now", label: "now" }, { value: "rule", label: "rule" }] },
    onPick: (item, choice) => heard.push(choice),
  });
  assert.deepEqual([...document.querySelectorAll(".desk-pick input[type=radio]")].map((r) => r.checked), [false, true]);
  closePickWindow("page");
});

test("a label's window lists the collections with the two choices, and New collection… makes one that follows the choice", async () => {
  closePickWindow("page");
  await openAddLabel({ store, ctx, label: { id: advent.id, name: "Advent" }, count: 3 });
  const win = document.querySelector(".desk-pick");
  const labels = [...win.querySelectorAll(".desk-setting__label")].map((s) => s.textContent);
  assert.deepEqual(labels, ["Only the 3 labeled Advent now", "These 3, and any you label Advent from now on"]);
  assert.deepEqual([...win.querySelectorAll("input[type=radio]")].map((r) => r.checked), [false, true]);
  const names = [...win.querySelectorAll(".desk-pick__row:not(.desk-pick__action) .desk-pick__name")].map((s) => s.textContent);
  assert.ok(names.includes("Advent series"));

  // Choosing a collection with the rule choice adds a rule.
  const target = await aCollection("Pick me");
  closePickWindow("page");
  await openAddLabel({ store, ctx, label: { id: advent.id, name: "Advent" }, count: 3 });
  document.querySelector(`.desk-pick__row[data-pick="${target.id}"]`).click();
  await until(async () => (await reread(target.id)).members.length === 1);
  assert.equal((await reread(target.id)).members[0].type, "rule");

  // New collection… with the first choice holds the bookmarks as items.
  closePickWindow("page");
  await openAddLabel({ store, ctx, label: { id: advent.id, name: "Advent" }, count: 3 });
  const radios = [...document.querySelectorAll(".desk-pick input[type=radio]")];
  radios[0].checked = true;
  radios[0].dispatchEvent(new Event("change", { bubbles: true }));
  document.querySelector(".desk-pick__action").click();
  await until(() => document.querySelector(".desk-pick input[type=text], .desk-pick input:not([type])"));
  const field = document.querySelector(".desk-pick input");
  field.value = "From the label";
  field.closest("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await until(async () => (await store.all()).some((r) => r.kind === "collection" && r.name === "From the label"));
  const made = (await store.all()).find((r) => r.name === "From the label");
  assert.deepEqual(made.members.map((m) => m.type), ["item", "item", "item"]);
  closePickWindow("page");
});

test("Add these N: the window lists the collections and a pick adds the records as items", async () => {
  closePickWindow("page");
  const c = await aCollection("For these");
  await openAddRecords({ store, ctx, recordIds: [note.id, plain.id] });
  const win = document.querySelector(".desk-pick");
  assert.match(win.textContent, /Choose the collection for these 2\./);
  assert.equal(win.querySelector(".desk-pick__action .desk-pick__name").textContent, "New collection…");
  win.querySelector(`.desk-pick__row[data-pick="${c.id}"]`).click();
  await until(async () => (await reread(c.id)).members.length === 2);
  assert.equal(barText(), "2 added to For these.");
  await settle(10);
});
