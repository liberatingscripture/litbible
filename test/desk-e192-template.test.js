// "Save as template" in the sheet editor (STUDY-DESK-FIXES.md E192; BVJ,
// 2026-11-20), driven in a browser DOM over the real notebook store on
// fake-indexeddb. It moved from the list's rows into the editor's header row,
// with the other actions on the whole sheet, in both hosts (a Sheets pane and
// /sheets/' editor), never to the sheet's foot. It keeps the sheet open, says
// so in the undo bar with Undo, and says why when it can't be used, which a
// part added makes it.

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import "./helpers/browser-env.mjs";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { addModule, createSheet, isOwnTemplate, makeModule, planSheetChange } from "../src/lib/desk-sheets.mjs";

globalThis.indexedDB = new IDBFactory();
globalThis.IDBKeyRange = IDBKeyRange;
// An open channel keeps node alive; the stores here are never closed.
const RealChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = class extends RealChannel {
  constructor(name) {
    super(name);
    this.unref?.();
  }
};

const { openStore } = await import("../src/scripts/desk/store.js");
const { createHistory } = await import("../src/scripts/desk/history.js");
const { createSheetEditor } = await import("../src/scripts/desk/sheets/sheet-editor.js");

const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const opCtx = () => ({ now: new Date().toISOString(), ...ctx() });
const here = await openStore({ ctx });
const other = await openStore({ ctx }); // another tab's
createHistory({ store: here, ctx });

async function until(fn, ms = 3000, what = "the condition") {
  const end = Date.now() + ms;
  while (!(await fn())) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

let editor = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

/** The editor on a saved sheet, as a Sheets pane has it, or as /sheets/ does with `page`. */
async function editorOn(sheet, { page = false } = {}) {
  await here.save(sheet);
  let shown = sheet.id;
  editor = createSheetEditor({
    store: here,
    ctx,
    idSuffix: "t",
    getSheet: () => shown,
    setSheet: (id) => { shown = id; },
    askFirst: false,
    ...(page ? { onList: () => {}, onDone: () => {} } : {}),
  });
  document.body.replaceChildren(editor.el);
  await until(() => editor.el.querySelector(".desk-sheet__title"), 3000, "the sheet");
  return editor.el.querySelector(".desk-sheet__top");
}

const keepIn = (top) => [...top.querySelectorAll("button")].find((b) => b.textContent === "Save as template");
const why = (b) => document.getElementById(b.getAttribute("aria-describedby"))?.textContent ?? "";
/** The row's controls in order, by their own words (a link's new-tab mark left out). */
const labels = (top) =>
  [...top.children]
    .flatMap((c) => (c.matches("a, button") ? [c] : c.matches(".desk-sheet__top-end") ? [...c.querySelectorAll("button")] : []))
    .map((b) => b.firstChild?.textContent ?? b.textContent);
const templates = async () => (await here.all()).filter(isOwnTemplate);
const passage = () => makeModule("passage", { bookKey: "john", chapter: 3, verse: 16, endVerse: 16 });
const sheetOf = (title, modules = [makeModule("text", { html: "<h2>Opening</h2>" }), passage()], extra = {}) =>
  ({ ...createSheet({ title, modules }, opCtx()), ...extra });

test("in a Sheets pane it is in the header row, after the other actions on the whole sheet", async () => {
  const top = await editorOn(sheetOf("Lent study"));
  assert.deepEqual(labels(top), ["‹ All sheets", "Present", "Print or share", "Open on its own page", "Save as template"]);
  assert.ok(!editor.el.querySelector(".desk-sheet__license, .desk-sheet__modules")?.contains(keepIn(top)), "not at the sheet's foot");
});

test("on /sheets/' editor it follows ‹ All sheets, before Close", async () => {
  const top = await editorOn(sheetOf("Lent study"), { page: true });
  assert.deepEqual(labels(top), ["‹ All sheets", "Save as template", "Close"]);
});

test("a press keeps the sheet open, makes a template of its parts without the passages, and says so with Undo", async () => {
  const sheet = sheetOf("Lent study");
  const top = await editorOn(sheet);
  const keep = keepIn(top);
  assert.equal(keep.hasAttribute("aria-disabled"), false);
  assert.match(why(keep), /as a template of your own that New sheet offers/);
  const before = (await templates()).length;
  keep.click();
  await until(async () => (await templates()).length === before + 1, 3000, "the template");
  const t = (await templates()).find((r) => r.title === "Lent study");
  assert.ok(t, "named as the sheet is");
  assert.deepEqual(t.modules.map((m) => m.type), ["text"], "the passage is left out");
  assert.equal(editor.sheet()?.id, sheet.id, "the sheet stays open");
  assert.ok(editor.el.contains(keep), "in the same view");
  await until(() => document.querySelector(".desk-undo__text")?.textContent, 3000, "the undo bar");
  assert.equal(document.querySelector(".desk-undo__text").textContent, "Saved “Lent study” as a template. New sheet now offers it.");
  assert.equal(document.querySelector(".desk-undo__bar").hidden, false);
  const undo = document.querySelector(".desk-undo__undo");
  assert.equal(undo.textContent, "Undo");
  undo.click();
  await until(async () => !(await templates()).some((r) => r.id === t.id), 3000, "Undo to take the template away");
  assert.ok(await here.get(sheet.id), "and leave the sheet");
});

test("a second press while the first saves makes one template", async () => {
  const top = await editorOn(sheetOf("Psalms"));
  const keep = keepIn(top);
  const before = (await templates()).filter((r) => r.title === "Psalms").length;
  keep.click();
  assert.equal(keep.getAttribute("aria-disabled"), "true", "busy while it saves");
  keep.click();
  await until(() => !keep.hasAttribute("aria-disabled"), 3000, "the save to finish");
  await pause(50);
  assert.equal((await templates()).filter((r) => r.title === "Psalms").length, before + 1);
});

test("a sheet of passages alone says why it can't, and adding a part of its own makes it usable", async () => {
  const sheet = sheetOf("Readings", [passage()]);
  const top = await editorOn(sheet);
  const keep = keepIn(top);
  assert.equal(keep.disabled, false, "not disabled, so a keyboard reaches it");
  assert.equal(keep.getAttribute("aria-disabled"), "true");
  assert.match(why(keep), /only passages/);
  assert.match(keep.title, /only passages/);
  const before = (await templates()).length;
  keep.click();
  await pause(50);
  assert.equal((await templates()).length, before, "a press makes nothing");
  // A part added, here or in another tab, and it can be used.
  await other.change(async ({ get }) => planSheetChange(await get(sheet.id), (s) => addModule(s, makeModule("text", { html: "<p>Pray</p>" }), 0, opCtx())));
  await until(() => !keep.hasAttribute("aria-disabled"), 3000, "the button to be usable");
  assert.match(why(keep), /New sheet offers/);
});

test("a sheet of a newer format says why it can't", async () => {
  const top = await editorOn(sheetOf("From the future", undefined, { sheetFormat: 99 }));
  const keep = keepIn(top);
  assert.equal(keep.getAttribute("aria-disabled"), "true");
  assert.match(why(keep), /newer version/);
});

test("a template has none: it is one already", async () => {
  const sheet = sheetOf("Weekly shape", [makeModule("text", { html: "<h2>Opening</h2>" })], { isTemplate: true });
  const top = await editorOn(sheet);
  assert.equal(keepIn(top), undefined);
});

test("the Sheets tour's example sheet, which is never saved, says why it can't", async () => {
  const top = await editorOn(sheetOf("Tour"));
  const keep = keepIn(top);
  editor.setExample(true);
  assert.equal(keep.getAttribute("aria-disabled"), "true");
  assert.match(why(keep), /tour’s example sheet/);
  const before = (await templates()).length;
  keep.click();
  await pause(50);
  assert.equal((await templates()).length, before, "the tour writes nothing");
  editor.setExample(false);
  assert.equal(keep.hasAttribute("aria-disabled"), false);
});
