// The template's description in the sheet editor (E80; BVJ, 2026-11-10),
// driven in a browser DOM over the real notebook store on fake-indexeddb: a
// sheet started from a built-in template shows what the template is for above
// its parts, the reader hides it per sheet, and that is remembered in the
// notebook's own settings, never on the sheet.

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import "./helpers/browser-env.mjs";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { createSheet, makeModule, planSheetChange, removeModule } from "../src/lib/desk-sheets.mjs";
import { TEMPLATES, templateModules } from "../src/lib/desk-sheet-templates.mjs";

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
const { createSheetEditor } = await import("../src/scripts/desk/sheets/sheet-editor.js");

const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const opCtx = () => ({ now: new Date().toISOString(), ...ctx() });
const here = await openStore({ ctx });
const other = await openStore({ ctx }); // another tab's

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

/** The editor on a saved sheet; returns the description's box. */
async function editorOn(sheet) {
  await here.save(sheet);
  let shown = sheet.id;
  editor = createSheetEditor({ store: here, ctx, idSuffix: "t", getSheet: () => shown, setSheet: (id) => { shown = id; }, askFirst: false });
  document.body.replaceChildren(editor.el);
  await until(() => editor.el.querySelector(".desk-sheet__title"), 3000, "the sheet");
  return editor.el.querySelector(".desk-sheet__about");
}

const from = (id) => createSheet({ title: "Study", template: id, modules: templateModules(id) }, opCtx());
const bibleStudy = TEMPLATES.find((t) => t.id === "bible-study");

test("a sheet from a template says what the template is for, between its title and its parts", async () => {
  const box = await editorOn(from("bible-study"));
  assert.equal(box.hidden, false);
  assert.equal(box.getAttribute("role"), "note");
  assert.equal(box.querySelector("p").textContent, `${bibleStudy.name}. ${bibleStudy.about}`);
  const order = [...editor.el.querySelectorAll(".desk-sheet__subtitle, .desk-sheet__about, .desk-sheet__modules")].map((n) => n.className);
  assert.deepEqual(order, ["desk-sheet__subtitle", "desk-sheet__about", "desk-sheet__modules"]);
  assert.equal(box.querySelector("button").getAttribute("aria-label"), "Hide this description");
});

test("a blank canvas and a sheet of the reader’s own parts show none", async () => {
  assert.equal((await editorOn(from("blank"))).hidden, true);
  editor.destroy();
  const own = createSheet({ title: "Mine", template: "bible-study", modules: [makeModule("text", { html: "<h2>Welcome</h2>" })] }, opCtx());
  assert.equal((await editorOn(own)).hidden, true);
});

test("hiding it is for that sheet, is remembered, and never touches the sheet", async () => {
  const sheet = from("bible-study");
  const twin = from("bible-study");
  await here.save(twin);
  const box = await editorOn(sheet);
  const before = JSON.stringify(await here.get(sheet.id));
  box.querySelector("button").click();
  assert.equal(box.hidden, true);
  assert.equal(document.activeElement, editor.el.querySelector(".desk-sheet__title"), "focus stays in the sheet");
  await until(async () => (await here.getMeta("sheetAboutHidden"))?.includes(sheet.id), 3000, "the setting to save");
  assert.equal(JSON.stringify(await here.get(sheet.id)), before, "the sheet record is as it was");

  // Opened again, it stays hidden; another sheet from the same template still shows its own.
  editor.destroy();
  const again = await editorOn(sheet);
  await pause(50);
  assert.equal(again.hidden, true);
  editor.destroy();
  const second = await editorOn(twin);
  await pause(50);
  assert.equal(second.hidden, false);
});

test("it goes when the sheet is reshaped, here or in another tab", async () => {
  const sheet = from("swedish");
  const box = await editorOn(sheet);
  assert.equal(box.hidden, false);
  await other.change(async ({ get }) => planSheetChange(await get(sheet.id), (s) => removeModule(s, s.modules[1].id, opCtx())));
  await until(() => box.hidden, 3000, "the description to go");
});
