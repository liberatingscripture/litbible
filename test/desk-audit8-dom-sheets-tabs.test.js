// Two tabs on one sheet, driven in a browser DOM (Audit 8): the sheet editor
// over the real notebook store on fake-indexeddb, and a second store on the
// same database as the other tab, whose writes reach the editor through
// BroadcastChannel as they do between real tabs. The rules themselves
// (movedUnderReader, keptFields, newerSheet) are tested in
// desk-audit8-a-sheet-tabs.test.js; these hold the editor to them.
//
// - SH8-2: a field that moved and that the reader isn't in loads at once,
//   and "Keep mine" writes only the fields that differ from the other version.
// - DI8-4: a closing tab writes over the newest copy it has heard of.

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { settle } from "./helpers/browser-env.mjs";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { createSheet, makeModule, planSheetChange, updateModule } from "../src/lib/desk-sheets.mjs";

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
const here = await openStore({ ctx }); // this tab's
const other = await openStore({ ctx }); // another tab's

async function until(fn, ms = 3000, what = "the condition") {
  const end = Date.now() + ms;
  while (!(await fn())) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

const elsewhere = (id, op) => other.change(async ({ get }) => planSheetChange(await get(id), op));
const storedPart = async (id, i = 0) => (await here.get(id)).modules[i];

let editor = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

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

function type(editable, html) {
  editable.focus();
  editable.innerHTML = html;
  editable.dispatchEvent(new Event("input", { bubbles: true }));
}

/** A question card's two fields: the question and the answer. */
const fieldsOf = (card) => [...card.querySelectorAll(".desk-rich")];

test("typing in a question while another tab changes only its answer: the answer loads at once, with no line (SH8-2)", async () => {
  const q = makeModule("question", { html: "<p>Why?</p>", answer: "<p>Because</p>" });
  const { sheet, card } = await editorOn([q]);
  const [question, answer] = fieldsOf(card(q));
  type(question, "<p>Why not?</p>");
  await until(async () => (await storedPart(sheet.id)).html === "<p>Why not?</p>", 3000, "the typing to save");
  await elsewhere(sheet.id, (s) => updateModule(s, q.id, { answer: "<p>Because B</p>" }, opCtx()));
  await until(() => answer.textContent === "Because B", 3000, "the other tab's answer to show");
  assert.ok(document.activeElement === question, "the reader is still in the question");
  assert.equal(question.textContent, "Why not?");
  await settle(50);
  assert.equal(card(q).querySelector(".desk-sheet__conflict"), null, "no “Changed in another tab” line");
});

test("Keep mine writes the field the reader typed in, and leaves the other tab's answer as it is (SH8-2)", async () => {
  const q = makeModule("question", { html: "<p>Why?</p>", answer: "<p>Because</p>" });
  const { sheet, card } = await editorOn([q]);
  const [question, answer] = fieldsOf(card(q));
  // Typed, not yet saved, when the other tab's change to both fields arrives.
  type(question, "<p>Mine</p>");
  await elsewhere(sheet.id, (s) => updateModule(s, q.id, { html: "<p>Theirs</p>", answer: "<p>Their answer</p>" }, opCtx()));
  await until(() => card(q).querySelector(".desk-sheet__conflict"), 3000, "the line on the part");
  assert.equal(question.textContent, "Mine", "the reader's words stay where they type");
  const keep = [...card(q).querySelectorAll(".desk-sheet__conflict button")].find((b) => b.textContent === "Keep mine");
  keep.click();
  await until(async () => (await storedPart(sheet.id)).html === "<p>Mine</p>", 3000, "the reader's question to be kept");
  await settle(100);
  assert.equal((await storedPart(sheet.id)).answer, "<p>Their answer</p>", "the other tab's answer isn't reverted");
  assert.equal(answer.textContent, "Their answer", "and it is what the answer field shows");
});

test("a closing tab writes over the copy another tab saved while its own save was landing (DI8-4)", async () => {
  const one = makeModule("text", { html: "<p>one</p>" });
  const two = makeModule("text", { html: "<p>two</p>" });
  // This tab's saves take a while to start, so one is still landing when the page closes.
  const slow = Object.create(here);
  slow.change = (...args) => new Promise((r) => setTimeout(r, 400)).then(() => here.change(...args));
  const { sheet, card } = await editorOn([one, two], { store: slow });
  // This tab types in part one and leaves it, which asks for the save.
  const first = fieldsOf(card(one))[0];
  type(first, "<p>one, mine</p>");
  first.blur();
  // Meanwhile the other tab saves part two, and this tab hears of it.
  await elsewhere(sheet.id, (s) => updateModule(s, two.id, { html: "<p>two, theirs</p>" }, opCtx()));
  await settle(100);
  // The page closes before its own save has landed.
  window.dispatchEvent(new Event("pagehide"));
  await settle(600);
  const saved = await here.get(sheet.id);
  assert.equal(saved.modules[0].html, "<p>one, mine</p>", "this tab's typing is kept");
  assert.equal(saved.modules[1].html, "<p>two, theirs</p>", "the other tab's part is not written over");
});
