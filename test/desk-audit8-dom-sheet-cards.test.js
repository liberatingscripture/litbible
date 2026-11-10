// A sheet's cards, driven (Audit 8, LG8-8: cut from sheet-editor.js into
// sheets/sheet-cards.js). The editor drives them too, over a real store, in
// desk-audit8-dom-sheets-*.test.js; these hold the cards' own rules with a
// host that records what they ask of it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom } from "./helpers/browser-env.mjs";

const { createSheetCards, headingOf, TYPE_NAMES } = await import("../src/scripts/desk/sheets/sheet-cards.js");
const { createSheet, makeModule, updateModule, removeModule } = await import("../src/lib/desk-sheets.mjs");

const ctx = { now: "2026-11-10T00:00:00.000Z", client: "web/test", contentVersion: "v1" };

function setup(modules, { readOnly = false } = {}) {
  resetDom();
  let sheet = createSheet({ title: "Study", modules }, ctx);
  const asked = [];
  const cards = new Map();
  const cardHost = { readOnly: () => readOnly, sheet: () => sheet, change: async () => true, opCtx: () => ctx, say: () => {}, idSuffix: "t", showPassage: null };
  const view = createSheetCards({
    cards,
    cardHost,
    idSuffix: "t",
    sheet: () => sheet,
    readOnly: () => readOnly,
    insertForm: () => null,
    forgetForm: () => asked.push(["forgetForm"]),
    worked: (id) => asked.push(["worked", id]),
    move: (id, by) => asked.push(["move", id, by]),
    moveTo: (id, to) => asked.push(["moveTo", id, to]),
    remove: (id, name) => asked.push(["remove", id, name]),
    openInsertMenu: (_b, m, called) => asked.push(["menu", m.id, called]),
    showConflict: (_c, m, from) => asked.push(["conflict", m.id, from]),
  });
  const wrap = document.body.appendChild(document.createElement("div"));
  const list = wrap.appendChild(view.makeList());
  view.draw();
  return { view, cards, list, asked, sheet: () => sheet, set: (next) => { sheet = next; } };
}

const heading = makeModule("text", { html: "<h2>Opening</h2>" });
const space = makeModule("space", { lines: 4 });
const brk = makeModule("pageBreak");

test("each part is a listed card in the sheet's order, with Move disabled at the ends", () => {
  const { list, cards } = setup([heading, space, brk]);
  assert.equal(list.getAttribute("role"), "list");
  const items = [...list.querySelectorAll(':scope > [role="listitem"]')];
  assert.deepEqual(items.map((el) => el.dataset.moduleId), [heading.id, space.id, brk.id]);
  const moveUp = (el) => el.querySelector('[aria-label^="Move"][aria-label$="up"]');
  const moveDown = (el) => el.querySelector('[aria-label^="Move"][aria-label$="down"]');
  assert.equal(moveUp(items[0]).disabled, true);
  assert.equal(moveDown(items[0]).disabled, false);
  assert.equal(moveDown(items[2]).disabled, true);
  assert.equal(cards.get(space.id).name, TYPE_NAMES.space);
  assert.equal(headingOf(heading), "Opening");
});

test("the header's buttons and the gap's pill ask the host", () => {
  const { list, asked } = setup([heading, space]);
  const second = list.children[1];
  second.querySelector('[aria-label="Move Space to write up"]').click();
  second.querySelector('[aria-label="Remove Space to write"]').click();
  list.children[0].querySelector(".desk-sheet__after-btn").click();
  assert.deepEqual(asked.filter(([k]) => k !== "worked"), [
    ["move", space.id, -1],
    ["remove", space.id, "Space to write"],
    ["menu", heading.id, "Opening"],
  ]);
  assert.equal(list.children[0].querySelector(".desk-sheet__after-btn").getAttribute("aria-label"), "Add a part after Opening", "a text part is called by its heading");
});

test("one gap pill takes Tab, and the arrows, Home and End move between them", () => {
  const { list } = setup([heading, space, brk]);
  const pills = () => [...list.querySelectorAll(".desk-sheet__after-btn")];
  assert.deepEqual(pills().map((b) => b.tabIndex), [0, -1, -1]);
  pills()[0].focus();
  pills()[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
  assert.equal(document.activeElement, pills()[1]);
  assert.deepEqual(pills().map((b) => b.tabIndex), [-1, 0, -1]);
  pills()[1].dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }));
  assert.equal(document.activeElement, pills()[2]);
  pills()[2].dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }));
  assert.equal(document.activeElement, pills()[0]);
});

test("a redraw keeps the cards that didn't change, and rebuilds one that did with focus on the same header control", () => {
  const { view, list, set, sheet } = setup([heading, space, brk]);
  const before = [...list.children];
  set(updateModule(sheet(), space.id, { leaderOnly: true }, ctx));
  view.draw();
  assert.equal(list.children[0], before[0], "an unchanged card is the same element");
  assert.equal(list.children[2], before[2]);
  // A page break's kind doesn't change, so focus on its Remove survives a rebuild.
  const remove = list.children[2].querySelector('[aria-label="Remove Page break"]');
  remove.focus();
  set({ ...sheet(), modules: sheet().modules.map((m) => (m.id === brk.id ? { ...m, prompt: "x" } : m)) });
  view.draw();
  assert.notEqual(list.children[2], before[2], "the changed card was rebuilt");
  assert.equal(document.activeElement?.getAttribute("aria-label"), "Remove Page break", "focus is on the same control");
});

test("a part gone takes its card, and an empty sheet says so beside the list", () => {
  const { view, list, cards, set, sheet } = setup([space]);
  set(removeModule(sheet(), space.id, ctx));
  view.draw();
  assert.equal(list.children.length, 0);
  assert.equal(cards.size, 0);
  const none = list.parentNode.querySelector(".desk-sheet__none");
  assert.ok(none && none.nextElementSibling === list, "the line is before the list, not in it");
  assert.equal(none.tabIndex, -1, "it can take focus when the last part goes");
});

test("a lone heading shows its prompt, and a read-only sheet has no tools or gaps", async () => {
  const lone = makeModule("text", { html: "<h2>Response</h2>", prompt: "What will you do?" });
  const { list } = setup([lone]);
  await settle(5);
  const box = list.querySelector(".desk-rich-editor > .desk-rich");
  assert.equal(box?.dataset.hint, "What will you do?");
  assert.equal(box.getAttribute("aria-description"), "What will you do?");
  const ro = setup([space], { readOnly: true });
  assert.equal(ro.list.querySelector(".desk-sheet__after-btn"), null);
  assert.equal(ro.list.querySelector('[aria-label^="Remove"]'), null);
});

test("clear takes every card down", () => {
  const { view, cards } = setup([heading, space]);
  view.clear();
  assert.equal(cards.size, 0);
});
