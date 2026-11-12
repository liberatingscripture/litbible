// The sheet editor (sheet-editor.js, with part-cards.js) driven in a browser
// DOM over the real notebook store on fake-indexeddb (Audit 8). A second
// store on the same database is another tab: its writes reach the editor's
// store through BroadcastChannel, as they do between real tabs.
//
// - SH8-4: a card that saved its own change shows the stored minutes, its
//   lines preview follows its field, and its head key follows its saves.
// - DI8-7: another tab's minutes or Leader only show in the head of a card
//   being typed in.
// - SH8-7: leaving the title shows another tab's rename, unless this tab's
//   own save of it failed, when the reader's words stay.
// - XA8-10: removing the last part puts focus on the empty sheet's line.
// - DI8-5: a save the upgraded notebook refused says to reload, and keeps the words.
// - SH8-8: the editor's live region speaks without waiting for a frame.

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { settle } from "./helpers/browser-env.mjs";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { createSheet, makeModule, planSheetChange, setSheetFields, updateModule } from "../src/lib/desk-sheets.mjs";

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

const { NOTEBOOK_UPGRADED, openStore } = await import("../src/scripts/desk/store.js");
const { createSheetEditor } = await import("../src/scripts/desk/sheets/sheet-editor.js");

const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const opCtx = () => ({ now: new Date().toISOString(), ...ctx() });
const here = await openStore({ ctx }); // this tab's
const other = await openStore({ ctx }); // another tab's

/** Waits until `fn()` (which may be async) is truthy, or fails after `ms`. */
async function until(fn, ms = 3000, what = "the condition") {
  const end = Date.now() + ms;
  while (!(await fn())) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** A change to a stored sheet, as another tab makes it. */
const elsewhere = (id, op) => other.change(async ({ get }) => planSheetChange(await get(id), op));
const stored = async (id) => here.get(id);
const quietly = async (fn) => {
  const error = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = error;
  }
};

let editor = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

/** The editor on a new sheet of `modules`, saved first; `store` defaults to this tab's. */
async function editorOn(modules, { store = here } = {}) {
  const sheet = createSheet({ title: "Study", modules }, opCtx());
  await here.save(sheet);
  let shown = sheet.id;
  editor = createSheetEditor({ store, ctx, idSuffix: "t", getSheet: () => shown, setSheet: (id) => { shown = id; }, askFirst: false });
  document.body.replaceChildren(editor.el);
  await until(() => editor.el.querySelector(".desk-sheet__title"), 3000, "the sheet");
  const card = (m) => editor.el.querySelector(`[data-module-id="${m.id}"]`);
  return { sheet, el: editor.el, card };
}

/** Types into a rich-text field as the browser would report it (no execCommand here). */
function type(editable, html) {
  editable.focus();
  editable.innerHTML = html;
  editable.dispatchEvent(new Event("input", { bubbles: true }));
}

const minutesOf = (card) => card.querySelector(".desk-sheet__minutes input");
const setField = (input, value) => {
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
};

test("a minutes value out of range goes back to what is stored, not to what the card was built with (SH8-4)", async () => {
  const part = makeModule("text", { html: "<p>Opening words</p>" });
  const { sheet, card } = await editorOn([part]);
  const field = minutesOf(card(part));
  setField(field, "10");
  await until(async () => (await stored(sheet.id)).modules[0].minutes === 10, 3000, "the minutes to save");
  setField(field, "999");
  assert.equal(field.value, "10");
});

test("a part's tools read Leader only, then minutes, then Move, in tab order too (E87)", async () => {
  const part = makeModule("text", { html: "<p>Words</p>" });
  const { card } = await editorOn([part]);
  const tools = [...card(part).querySelector(".desk-sheet__module-tools").children];
  const at = (sel) => tools.findIndex((n) => n.matches(sel) || n.querySelector(sel));
  assert.ok(at(".desk-sheet__leader") >= 0 && at(".desk-sheet__minutes") >= 0 && at(".desk-sheet__icon") >= 0);
  assert.ok(at(".desk-sheet__leader") < at(".desk-sheet__minutes"), "Leader only comes before the minutes");
  assert.ok(at(".desk-sheet__minutes") < at(".desk-sheet__icon"), "and the minutes before Move");
});

test("a minutes field left without typing shows what another tab stored meanwhile (SH8-4, DI8-7)", async () => {
  // A key terms box is drawn in place (`update`), so its head keeps focus.
  const box = makeModule("keyTerms", { minutes: 5 });
  const { sheet, card, el } = await editorOn([box]);
  const field = minutesOf(card(box));
  field.focus();
  await elsewhere(sheet.id, (s) => updateModule(s, box.id, { minutes: 7 }, opCtx()));
  await until(() => el.querySelector(".desk-sheet__planned")?.textContent.includes("7 min"), 3000, "the other tab's minutes");
  assert.ok(document.activeElement === field, "the field kept focus");
  assert.equal(field.value, "5", "and what the reader sees in it while there");
  field.blur();
  assert.equal(field.value, "7");
});

test("a card's own minutes, then another tab's change to it: the card is drawn in place and keeps focus (SH8-4)", async () => {
  const box = makeModule("keyTerms");
  const { sheet, card } = await editorOn([box]);
  const before = card(box);
  const field = minutesOf(before);
  setField(field, "12");
  await until(async () => (await stored(sheet.id)).modules[0].minutes === 12, 3000, "the minutes to save");
  await elsewhere(sheet.id, (s) => updateModule(s, box.id, { omit: ["agape"] }, opCtx()));
  await until(async () => (await stored(sheet.id)).modules[0].omit?.length === 1);
  await settle(100);
  assert.ok(card(box) === before, "not rebuilt");
  assert.ok(document.activeElement === field, "focus stayed in the minutes field");
});

test("a space's ruled preview follows its lines field (SH8-4)", async () => {
  const space = makeModule("space", { lines: 4 });
  const { card } = await editorOn([space]);
  const ruled = card(space).querySelector(".desk-sheet__ruled");
  assert.equal(ruled.style.getPropertyValue("--lines"), "4");
  setField(card(space).querySelector(".desk-sheet__lines input"), "2");
  assert.equal(ruled.style.getPropertyValue("--lines"), "2");
});

test("a question's ruled preview follows its lines field and hides at 0 (E104)", async () => {
  const q = makeModule("question", { lines: 3 });
  const { card } = await editorOn([q]);
  const ruled = card(q).querySelector(".desk-sheet__ruled");
  assert.ok(ruled, "the card draws the lines it prints");
  assert.equal(ruled.hidden, false);
  assert.equal(ruled.style.getPropertyValue("--lines"), "3");
  setField(card(q).querySelector(".desk-sheet__lines input"), "0");
  assert.equal(ruled.hidden, true, "no lines, no preview");
  setField(card(q).querySelector(".desk-sheet__lines input"), "12");
  assert.equal(ruled.hidden, false);
  assert.equal(ruled.style.getPropertyValue("--lines"), "6", "drawn up to six");
});

test("another tab's minutes and Leader only show in the head of a part being typed in (DI8-7)", async () => {
  const part = makeModule("text", { html: "<p>Words</p>" });
  const { sheet, card } = await editorOn([part]);
  const before = card(part);
  const editable = before.querySelector(".desk-rich");
  editable.focus();
  await elsewhere(sheet.id, (s) => updateModule(s, part.id, { minutes: 9, leaderOnly: true }, opCtx()));
  await until(async () => (await stored(sheet.id)).modules[0].minutes === 9);
  await settle(100);
  assert.ok(card(part) === before, "the card the reader is in stays");
  assert.ok(document.activeElement === editable);
  assert.equal(minutesOf(before).value, "9");
  assert.equal(before.querySelector(".desk-sheet__leader input").checked, true);
});

test("leaving the title shows a rename another tab made while it had focus (SH8-7)", async () => {
  const { sheet, el } = await editorOn([makeModule("text")]);
  const title = el.querySelector(".desk-sheet__title");
  title.focus();
  await elsewhere(sheet.id, (s) => setSheetFields(s, { title: "Renamed elsewhere" }, opCtx()));
  await until(async () => editor.sheet()?.title === "Renamed elsewhere", 3000, "the editor to hear the rename");
  assert.equal(title.value, "Study", "left alone while the reader is in it");
  title.blur();
  await settle();
  assert.equal(title.value, "Renamed elsewhere");
});

test("leaving the title after its save failed keeps the reader's words (SH8-7)", async () => {
  let failing = true;
  const store = Object.create(here);
  store.change = (...args) => (failing ? Promise.reject(Object.assign(new Error("full"), { name: "QuotaExceededError" })) : here.change(...args));
  const { el } = await editorOn([makeModule("text")], { store });
  const title = el.querySelector(".desk-sheet__title");
  title.focus();
  title.value = "My own words";
  title.dispatchEvent(new Event("input", { bubbles: true }));
  await quietly(async () => {
    await until(() => el.querySelector(".desk-sheet__saved")?.textContent.includes("wasn’t saved"), 3000, "the failed save");
    title.blur();
    await settle(50);
  });
  failing = false;
  assert.equal(title.value, "My own words");
});

test("removing the last part puts focus on the line saying the sheet is empty (XA8-10)", async () => {
  const part = makeModule("text", { html: "<p>Only part</p>" });
  const { card, el } = await editorOn([part]);
  card(part).querySelector('button[aria-label^="Remove"]').click();
  await until(() => el.querySelector(".desk-sheet__none"), 3000, "the empty sheet's line");
  await settle(50);
  const none = el.querySelector(".desk-sheet__none");
  assert.ok(document.activeElement === none);
  // happy-dom focuses any element; a browser needs the tabindex for this.
  assert.equal(none.tabIndex, -1);
});

test("a save the upgraded notebook refused says to reload, and the words typed stay (DI8-5)", async () => {
  const store = Object.create(here);
  store.change = () => Promise.reject(Object.assign(new Error("upgraded"), { name: NOTEBOOK_UPGRADED }));
  const part = makeModule("text", { html: "<p>Saved words</p>" });
  const { card, el } = await editorOn([part], { store });
  const editable = card(part).querySelector(".desk-rich");
  type(editable, "<p>Words not yet saved</p>");
  await quietly(() => until(() => el.querySelector(".desk-sheet__saved")?.textContent.startsWith("Not saved"), 3000, "the failed save"));
  assert.match(el.querySelector(".desk-sheet__saved").textContent, /newer Study Desk opened in another tab.*reload this page/);
  assert.match(card(part).querySelector(".desk-rich").textContent, /Words not yet saved/);
});

test("the editor's announcements don't wait for a frame, which a hidden tab never draws (SH8-8)", async () => {
  const part = makeModule("text", { html: "<p>Words</p>" });
  const { card, el } = await editorOn([part]);
  const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = globalThis.requestAnimationFrame = () => 0;
  try {
    setField(minutesOf(card(part)), "5");
    await until(() => el.querySelector("[aria-live]").textContent, 3000, "the announcement");
    assert.equal(el.querySelector("[aria-live]").textContent, "Text: 5 minutes planned.");
  } finally {
    window.requestAnimationFrame = globalThis.requestAnimationFrame = raf;
  }
});

test("focus in a text part's header stays on its control when another tab's change rebuilds the card", async () => {
  // A text part has no `update`, so another tab's change to it rebuilds the card.
  const part = makeModule("text", { html: "<p>Opening words</p>" });
  const { sheet, card } = await editorOn([part]);
  minutesOf(card(part)).focus();
  await elsewhere(sheet.id, (s) => updateModule(s, part.id, { html: "<p>Words from the other tab</p>" }, opCtx()));
  await until(() => card(part)?.textContent.includes("Words from the other tab"), 3000, "the other tab's words");
  const field = minutesOf(card(part));
  assert.ok(document.activeElement === field, "focus is on the rebuilt card's minutes field, not the page");
});

// ---- teardown and the tour's example mode (Audit 8, LG8-8) ----

test("a destroyed editor lets go: another tab's change draws nothing", async () => {
  const one = makeModule("text", { html: "<p>one</p>" });
  const { sheet, el } = await editorOn([one]);
  const shown = el.querySelector(`[data-module-id="${one.id}"] .desk-rich`);
  editor.destroy();
  editor = null;
  await other.change(async ({ get }) => planSheetChange(await get(sheet.id), (s) => updateModule(s, one.id, { html: "<p>theirs</p>" }, opCtx())));
  await settle(200);
  assert.equal(shown.textContent, "one", "the old editor didn't redraw");
});

test("example mode changes the sheet on screen and writes nothing; endExample shows the stored sheet again", async () => {
  const one = makeModule("text", { html: "<p>one</p>" });
  const { sheet, el } = await editorOn([one]);
  const stored = JSON.stringify(await here.get(sheet.id));
  editor.setExample(true);
  const title = el.querySelector(".desk-sheet__title");
  title.focus();
  title.value = "Tour title";
  title.dispatchEvent(new Event("input", { bubbles: true }));
  title.blur();
  await settle(700);
  assert.equal(JSON.stringify(await here.get(sheet.id)), stored, "nothing written");
  editor.endExample();
  const back = await (async () => {
    const end = Date.now() + 3000;
    while (Date.now() < end) {
      const t = editor.el.querySelector(".desk-sheet__title");
      if (t && t !== title) return t;
      await settle(10);
    }
    return null;
  })();
  assert.equal(back?.value, "Study", "the stored title is back");
});
