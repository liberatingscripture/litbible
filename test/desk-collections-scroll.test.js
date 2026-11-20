// The Collections views' scrolling and the pane's header (BVJ, 2026-11-20):
// a move reveals the moved row (E200; `refresh(focus, { reveal: true })`), a
// plain redraw does not; opening a collection or going back to the list starts
// at the top of the page (window) and of the pane (its body; E204); and a
// Collections pane tells the desk its name for the header (E69's place, E203),
// or nothing on the list. Driven in a browser DOM over the real store on
// fake-indexeddb.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle } from "./helpers/browser-env.mjs";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { createCollection, passageMember } from "../src/lib/desk-collections.mjs";
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
const { createCollectionPane } = await import("../src/scripts/desk/collections/collection-pane.js");
const { openStore } = await import("../src/scripts/desk/store.js");

const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const opCtx = () => ({ now: new Date().toISOString(), ...ctx() });
const store = await openStore({ ctx });

async function until(fn, ms = 3000, what = "the condition") {
  const end = Date.now() + ms;
  while (!(await fn())) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

async function keepOrdered(name) {
  const a = passageMember({ bookKey: "john", chapter: 3, verse: 16, endVerse: 16 });
  const b = passageMember({ bookKey: "john", chapter: 1, verse: 1, endVerse: 1 });
  const made = { ...createCollection({ name, members: [a, b] }, opCtx()), order: "mine" };
  await store.change(async () => planSave(made));
  return made;
}

const rowKeys = (root) => [...root.querySelectorAll("[data-row-key]")].map((r) => r.dataset.rowKey);

/** Record every scrollIntoView call as the row key it was made on ("none" for a bare element). */
function recordReveals() {
  const calls = [];
  const real = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function scrollIntoView() {
    calls.push(this.closest?.("[data-row-key]")?.dataset.rowKey ?? "none");
  };
  return { calls, restore: () => (Element.prototype.scrollIntoView = real) };
}

/** Record every window.scrollTo call. */
function recordWindowScrolls() {
  const calls = [];
  const real = globalThis.scrollTo;
  globalThis.scrollTo = (x, y) => calls.push([x, y]);
  return { calls, restore: () => (globalThis.scrollTo = real) };
}

async function mountPage(search = "") {
  history.replaceState(null, "", `/collections/${search}`);
  const root = document.createElement("div");
  root.dataset.testRoot = "";
  document.body.append(root);
  const page = await mountCollectionsPage(root, {
    store,
    ctx,
    base: "/",
    chapterText: async () => null,
    passageText: async () => "For God so loved the world.",
    parse: () => null,
  });
  return { root, page };
}

test("refresh with reveal scrolls the focused row into view; a plain redraw scrolls nothing", async () => {
  const made = await keepOrdered("Reveal test");
  const { root, page } = await mountPage(`?id=${made.id}`);
  await until(() => rowKeys(root).length === 2, 3000, "two rows");
  const [first] = rowKeys(root);
  const rev = recordReveals();
  try {
    await page.refresh([`down-${first}`]);
    assert.deepEqual(rev.calls, [], "a plain redraw leaves the scroll alone");
    await page.refresh([`down-${first}`], { reveal: true });
    assert.deepEqual(rev.calls, [first], "the moved row is revealed");
  } finally {
    rev.restore();
    page.destroy();
  }
});

test("opening a collection and going back to the list start the page at its top", async () => {
  const made = await keepOrdered("Top test");
  const { page } = await mountPage();
  const win = recordWindowScrolls();
  try {
    await page.open(made.id);
    assert.deepEqual(win.calls.at(-1), [0, 0], "a collection opens at the top");
    win.calls.length = 0;
    await page.toList();
    assert.deepEqual(win.calls.at(-1), [0, 0], "the list starts at the top");
  } finally {
    win.restore();
    page.destroy();
  }
});

test("a Collections pane starts a different collection at its top, and keeps the scroll of a redraw", async () => {
  const made = await keepOrdered("Pane top");
  const field = { value: null };
  const body = document.createElement("div");
  body.className = "desk-pane__body";
  body.style.overflow = "auto";
  document.body.append(body);
  const p = createCollectionPane({
    store,
    ctx,
    paneId: "pscroll",
    getCollection: () => field.value,
    setCollection: (id) => (field.value = id),
    chapterText: async () => null,
    passageText: async () => "For God so loved the world.",
    parse: () => null,
  });
  body.append(p.el);
  try {
    await until(() => p.el.querySelector(".desk-sheet__list-title"), 3000, "the list");
    body.scrollTop = 120;
    assert.equal(body.scrollTop, 120, "the body takes a scroll to set up the check");
    await p.show(made.id);
    assert.equal(body.scrollTop, 0, "a different collection opens at the top");
    body.scrollTop = 80;
    await p.show(made.id);
    assert.equal(body.scrollTop, 80, "a redraw of the same collection keeps its scroll");
    body.scrollTop = 40;
    await p.show(null);
    assert.equal(body.scrollTop, 0, "back to the list starts at the top");
  } finally {
    p.destroy();
    body.remove();
  }
});

test("a Collections pane reports the name of the collection it shows, and nothing on the list or for a missing one", async () => {
  const made = await keepOrdered("Advent series");
  const field = { value: null };
  const names = [];
  const onNamed = (e) => {
    if (e.detail.paneId === "pname") names.push(e.detail.name);
  };
  document.addEventListener("desk:collection-named", onNamed);
  const p = createCollectionPane({
    store,
    ctx,
    paneId: "pname",
    getCollection: () => field.value,
    setCollection: (id) => (field.value = id),
    chapterText: async () => null,
    passageText: async () => "For God so loved the world.",
    parse: () => null,
  });
  document.body.append(p.el);
  try {
    await until(() => p.el.querySelector(".desk-sheet__list-title"), 3000, "the list");
    await p.show(made.id);
    assert.equal(names.at(-1), "Advent series", "the header names the open collection");
    await p.show("no-such-collection");
    assert.equal(names.at(-1), null, "a collection that isn't there names nothing");
    await p.show(null);
    assert.equal(names.at(-1), null, "the list names nothing");
  } finally {
    document.removeEventListener("desk:collection-named", onNamed);
    p.destroy();
  }
});
