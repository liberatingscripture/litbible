// A collection onto a sheet, driven in a browser DOM (D13, step 7): the
// collection page's "Add to sheet…" and its window's "New sheet" row (there is
// no "Make a sheet" button, decision 36), and the Collection
// choice in the Sheets pane's "+ From my notes…". The converter's own rules are
// test/desk-collection-sheet.test.js; these are the wiring: the buttons, the
// one change that writes, the undo bar's words and its "Open the sheet" link,
// the pick window's list, and nothing written when nothing makes a part.
// Over the real store on fake-indexeddb, chapters faked.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle } from "./helpers/browser-env.mjs";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { createCollection, passageMember } from "../src/lib/desk-collections.mjs";
import { createSheet, makeModule } from "../src/lib/desk-sheets.mjs";
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
const { openFromNotes } = await import("../src/scripts/desk/sheets/add-forms.js");
const { openStore } = await import("../src/scripts/desk/store.js");

const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const opCtx = () => ({ now: new Date().toISOString(), ...ctx() });

async function until(fn, ms = 3000, what = "the condition") {
  const end = Date.now() + ms;
  while (!(await fn())) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

const store = await openStore({ ctx });
const byKind = async (kind) => (await store.all()).filter((r) => r.kind === kind && !r.deleted);

async function clearAll() {
  for (const r of await store.all()) await store.remove(r.id).catch(() => {});
}

const byText = (root, sel, text) => [...root.querySelectorAll(sel)].find((el) => el.textContent.trim() === text);

async function mount(id) {
  for (const old of document.querySelectorAll("[data-test-root], .desk-pick")) old.remove();
  history.replaceState(null, "", `/collections/?id=${encodeURIComponent(id)}`);
  const root = document.createElement("div");
  root.dataset.testRoot = "";
  document.body.append(root);
  const page = await mountCollectionsPage(root, { store, ctx, base: "/", chapterText: async () => null, passageText: async () => "", parse: () => null });
  return { root, page };
}

const john316 = () => passageMember({ bookKey: "john", chapter: 3, verse: 16, endVerse: 16 });
async function keepCollection(name, members) {
  const c = createCollection({ name, description: "", members }, opCtx());
  await store.change(async () => planSave(c));
  return c;
}
const barText = () => document.querySelector(".desk-undo__text")?.textContent ?? "";
const barLink = () => document.querySelector(".desk-undo a")?.getAttribute("href") ?? "";

test("the actions row has Add to sheet… after Add passage…, and no Make a sheet (decision 36)", async () => {
  await clearAll();
  const c = await keepCollection("Advent series", [john316()]);
  const { root, page } = await mount(c.id);
  const names = [...root.querySelectorAll(".collection-page__actions > button")].map((b) => b.textContent.trim());
  assert.deepEqual(names.slice(0, 2), ["Add passage…", "Add to sheet…"]);
  assert.ok(!names.includes("Make a sheet"));
  page.destroy();
});

/** Add to sheet…'s window, then its "New sheet" row, which makes a sheet of the collection. */
async function newSheetRow(root) {
  byText(root, "button", "Add to sheet…").click();
  await until(() => document.querySelector(".desk-pick .desk-pick__action"), 3000, "the window");
  document.querySelector(".desk-pick .desk-pick__action").click();
}

test("New sheet writes a sheet named after the collection, without Blank canvas's empty part, and says so with a link", async () => {
  await clearAll();
  const c = await keepCollection("Advent series", [john316()]);
  const { root, page } = await mount(c.id);
  await newSheetRow(root);
  await until(async () => (await byKind("sheet")).length === 1, 3000, "the sheet");
  const [sheet] = await byKind("sheet");
  assert.equal(sheet.title, "Advent series");
  assert.deepEqual(sheet.modules.map((m) => m.type), ["passage"]);
  assert.equal(sheet.modules[0].verse, 16);
  await until(() => /Advent series is on a new sheet/.test(barText()), 3000, "the bar");
  assert.equal(barLink(), `/sheets/?id=${encodeURIComponent(sheet.id)}`);
  page.destroy();
});

test("New sheet for a collection with nothing that makes a part says so and writes nothing", async () => {
  await clearAll();
  const c = await keepCollection("Empty", []);
  const { root, page } = await mount(c.id);
  await newSheetRow(root);
  await until(() => /nothing to put on a sheet/.test(barText()), 3000, "the notice");
  assert.equal((await byKind("sheet")).length, 0);
  page.destroy();
});

test("Add to sheet… lists the sheets and a New sheet row; a pick appends the parts, and a second says it is all there already", async () => {
  await clearAll();
  const c = await keepCollection("Advent series", [john316()]);
  const mine = createSheet({ title: "Week 1", template: "blank", modules: [makeModule("text")] }, opCtx());
  await store.change(async () => planSave(mine));
  const { root, page } = await mount(c.id);
  byText(root, "button", "Add to sheet…").click();
  await until(() => document.querySelector(".desk-pick .desk-pick__row"), 3000, "the window");
  const win = document.querySelector(".desk-pick");
  assert.equal(win.querySelector(".desk-pick__action .desk-pick__name").textContent, "New sheet");
  const rows = [...win.querySelectorAll(".desk-pick__row:not(.desk-pick__action) .desk-pick__name")].map((e) => e.textContent);
  assert.deepEqual(rows, ["Week 1"]);
  win.querySelector(".desk-pick__row:not(.desk-pick__action)").click();
  await until(async () => (await byKind("sheet"))[0].modules.length === 2, 3000, "the parts");
  const [after] = await byKind("sheet");
  assert.equal(after.modules[1].type, "passage");
  await until(() => /Advent series added to “Week 1\.”/.test(barText()), 3000, "the bar");
  assert.equal(barLink(), `/sheets/?id=${encodeURIComponent(mine.id)}`);

  byText(root, "button", "Add to sheet…").click();
  await until(() => document.querySelector(".desk-pick .desk-pick__row:not(.desk-pick__action)"), 3000, "the window again");
  document.querySelector(".desk-pick .desk-pick__row:not(.desk-pick__action)").click();
  await until(() => /is on “Week 1” already\. Nothing was added/.test(barText()), 3000, "the already-there notice");
  assert.equal((await byKind("sheet"))[0].modules.length, 2);
  page.destroy();
});

/* ── The Collection choice in "+ From my notes…" ──────────────────── */

function fakeHost(sheet) {
  const said = [];
  const host = {
    store,
    ctx,
    opCtx,
    say: (t) => said.push(t),
    cards: new Map(),
    sheet: () => host.current,
    current: sheet,
    insertIndex: (s) => s.modules.length,
    focusNewPart() {},
    change(op) {
      host.current = op(host.current);
      return Promise.resolve(true);
    },
  };
  return { host, said };
}

test("From my notes… with no collections says so in one line, linking the Collections page", async () => {
  await clearAll();
  const sheet = createSheet({ title: "S", template: "blank", modules: [makeModule("text")] }, opCtx());
  const { host } = fakeHost(sheet);
  const box = document.createElement("div");
  document.body.append(box);
  await openFromNotes(host, box, () => {});
  const line = [...box.querySelectorAll("p")].find((p) => /no collections yet/.test(p.textContent));
  assert.ok(line);
  assert.equal(line.querySelector("a").getAttribute("href"), "/collections/");
  assert.equal(line.querySelector("a").getAttribute("rel"), "noopener noreferrer");
  box.remove();
});

test("From my notes… lists collections, and a pick adds the collection's parts as one block", async () => {
  await clearAll();
  await keepCollection("Advent series", [john316()]);
  const sheet = createSheet({ title: "S", template: "blank", modules: [makeModule("text")] }, opCtx());
  const { host } = fakeHost(sheet);
  const box = document.createElement("div");
  document.body.append(box);
  let closed = null;
  await openFromNotes(host, box, (refocus) => (closed = refocus));
  const pick = [...box.querySelectorAll("button")].find((b) => /Advent series/.test(b.textContent));
  assert.ok(pick);
  pick.click();
  await until(() => host.current.modules.length === 2, 3000, "the block");
  assert.equal(host.current.modules[1].type, "passage");
  assert.equal(closed, false);
  await settle();
  box.remove();
});
