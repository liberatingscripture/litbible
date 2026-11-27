// The collection views' host (STUDY-DESK.md, D13, "Where the page and the pane
// share code"; step 2 of the Collections pane's order of work): the list and
// one collection drawn for a host that isn't the page, as /desk's Collections
// pane will be. Its `open(id)` and `toList()` replace the page's `go(href)`; a
// host with an `idSuffix` gives its own order switch and focus keys, and
// everything a view looks for is found inside the host's own element, so two
// hosts at once never answer for each other. Over the real store on
// fake-indexeddb, with the readers faked.

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

const { collectionView, viewHost } = await import("../src/scripts/desk/collections/collection-view.js");
const { collectionList } = await import("../src/scripts/desk/collections/collection-list.js");
const { openStore } = await import("../src/scripts/desk/store.js");
const { initUndo } = await import("../src/scripts/desk/undo-bar.js");

const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const opCtx = () => ({ now: new Date().toISOString(), ...ctx() });
const store = await openStore({ ctx });
initUndo();

async function until(fn, ms = 3000, what = "the condition") {
  const end = Date.now() + ms;
  while (!(await fn())) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

async function clearAll() {
  for (const old of document.querySelectorAll("[data-test-root], .desk-pick")) old.remove();
  for (const r of await store.all()) await store.remove(r.id).catch(() => {});
}

async function keep(name, members = []) {
  const c = createCollection({ name, members }, opCtx());
  await store.change(async () => planSave(c));
  return c;
}

/**
 * A host as a pane makes one: no addresses, its own id, and its own element.
 * `shows` is the collection it shows, or null for the list; `calls` records
 * every open and toList.
 */
function paneHost(idSuffix, shows = null) {
  const root = document.createElement("div");
  root.dataset.testRoot = idSuffix;
  document.body.append(root);
  const calls = [];
  const host = {
    ...viewHost({ store, ctx, base: "/", chapterText: async () => null, passageText: async () => "For God so loved the world.", parse: () => null }),
    root,
    idSuffix,
    backLabel: "All collections",
    shows,
    calls,
    open(id) {
      calls.push(["open", id]);
      host.shows = id;
      return host.refresh();
    },
    toList() {
      calls.push(["list"]);
      host.shows = null;
      return host.refresh();
    },
    async refresh(focus = []) {
      const view = host.shows ? await collectionView(host, host.shows) : await collectionList(host);
      root.replaceChildren(...view.nodes);
      const to = focus.map((k) => root.querySelector(`[data-focus-key="${CSS.escape(k)}"]`)).find(Boolean);
      to?.focus();
    },
  };
  return host;
}

const byText = (root, sel, text) => [...root.querySelectorAll(sel)].find((el) => el.textContent.trim() === text);
const keys = (root) => [...root.querySelectorAll("[data-focus-key]")].map((el) => el.dataset.focusKey);

test("a host with an id gives its order switch and every focus key that id, and two never share a radio group", async () => {
  await clearAll();
  const c = await keep("Advent series", [passageMember({ bookKey: "john", chapter: 3, verse: 16, endVerse: 16 })]);
  const a = paneHost("pa", c.id);
  const b = paneHost("pb", c.id);
  await a.refresh();
  await b.refresh();
  const radios = (h) => [...h.root.querySelectorAll(".desk-seg__input")];
  assert.deepEqual([...new Set(radios(a).map((r) => r.name))], ["collection-order-pa"]);
  assert.deepEqual([...new Set(radios(b).map((r) => r.name))], ["collection-order-pb"]);
  assert.ok(keys(a.root).length > 5);
  assert.ok(keys(a.root).every((k) => k.endsWith("--pa")), keys(a.root).join(" "));
  assert.ok(keys(b.root).every((k) => k.endsWith("--pb")));
  // Choosing My order in one leaves the other's choice as it was (the mock's bug).
  const checked = (h) => radios(h).find((r) => r.checked)?.value;
  const before = checked(b);
  radios(a).find((r) => r.value === "mine").checked = true;
  assert.equal(checked(a), "mine");
  assert.equal(checked(b), before);
});

test("the page's keys stay the plain words when a host has no id", async () => {
  await clearAll();
  const c = await keep("Plain");
  const h = paneHost("", c.id);
  await h.refresh();
  assert.ok(keys(h.root).includes("add"));
  assert.ok(keys(h.root).includes("title"));
  assert.equal(h.root.querySelector(".desk-seg__input").name, "collection-order");
});

test("with no addresses, the list's rows and the way back are buttons that call open and toList", async () => {
  await clearAll();
  const c = await keep("Lent");
  const h = paneHost("p1");
  await h.refresh();
  assert.equal(h.root.querySelector(".desk-sheet__sheet a"), null);
  const row = h.root.querySelector("button.desk-sheet__open");
  assert.match(row.textContent, /Lent/);
  row.click();
  await until(() => h.root.querySelector(".sheets-page__title")?.textContent === "Lent", 3000, "the collection");
  assert.deepEqual(h.calls, [["open", c.id]]);
  const back = byText(h.root, "button", "All collections");
  assert.ok(back);
  back.click();
  await until(() => h.root.querySelector(".sheets-page__title")?.textContent === "My collections", 3000, "the list");
  assert.deepEqual(h.calls.at(-1), ["list"]);
});

test("a host's addresses make the list's rows links, a plain click opening in place and a modified one left alone", async () => {
  await clearAll();
  const c = await keep("Linked");
  const h = paneHost("p2");
  h.href = (id) => `/collections/?id=${id}`;
  await h.refresh();
  const link = h.root.querySelector("a.desk-sheet__open");
  assert.equal(link.getAttribute("href"), `/collections/?id=${c.id}`);
  const modified = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true });
  link.dispatchEvent(modified);
  assert.equal(modified.defaultPrevented, false);
  assert.deepEqual(h.calls, []);
  const plain = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
  link.dispatchEvent(plain);
  assert.equal(plain.defaultPrevented, true);
  assert.deepEqual(h.calls, [["open", c.id]]);
});

test("Delete in a collection goes back to the host's list", async () => {
  await clearAll();
  const c = await keep("Gone soon");
  const h = paneHost("p3", c.id);
  await h.refresh();
  byText(h.root, "button", "Delete").click();
  await until(() => h.calls.length > 0, 3000, "toList");
  assert.deepEqual(h.calls, [["list"]]);
  assert.equal((await store.all()).filter((r) => r.kind === "collection" && !r.deleted).length, 0);
});

test("a window gives focus back to the button in its own host, not another host's", async () => {
  await clearAll();
  const c = await keep("Twice shown");
  const a = paneHost("pa", c.id);
  const b = paneHost("pb", c.id);
  await a.refresh();
  await b.refresh();
  byText(b.root, "button", "Rename…").click();
  const win = document.querySelector(".desk-pick");
  assert.ok(win, "the name window is open");
  byText(win, "button", "Cancel").click();
  await settle();
  assert.ok(b.root.contains(document.activeElement), "focus is back in the host that opened it");
  assert.equal(document.activeElement.textContent.trim(), "Rename…");
});
