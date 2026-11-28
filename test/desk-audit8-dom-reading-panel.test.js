// The Notebook panel's Print…, driven (Audit 8, XA8-11: a control says what it
// opens). Since Featherboa's Phase 5 it is a row of the title's menu
// (notebook-menu.js) that opens the Print menu in a small window of its own: a
// menu item marked as opening a dialog, and a dialog, with Escape and focus
// going back to the title. Where the page can't print, there is no Print….

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom } from "./helpers/browser-env.mjs";

const ctx = () => ({ client: "web/test", contentVersion: "v1" });

function page() {
  resetDom();
  document.body.innerHTML = `
    <main><div class="scripture-layout scripture-layout--scripture"><div class="scripture-main">
      <h1 id="chapter-title">John 3</h1>
      <article class="chapter" data-last-read-book="john" data-last-read-chapter="3">
        <div class="chapter-paragraphs"><div class="p"><span data-verse="16" id="v16">16</span> text</div></div>
      </article>
    </div></div></main>`;
  return {
    byChapter: async () => [], all: async () => [], get: async () => null, getMeta: async () => null,
    subscribe: () => () => {}, onEntry: () => () => {}, onMeta: () => () => {}, persisted: async () => true, lastEntry: () => null,
  };
}

const rowsOf = (title) =>
  Array.from(document.getElementById(title.getAttribute("aria-controls")).querySelectorAll('[role="menuitem"]'));
const key = (target, k) => target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));

test("XA8-11: Print… is a menu row that opens a dialog, and Escape gives focus back to the title", async () => {
  const store = page();
  const { createPanel } = await import("../src/scripts/desk/panel.js");
  const panel = createPanel({ store, ctx, printRoom: { can: () => true, print: async () => {} } });
  panel.restore({ ...panel.snapshot(), hidden: false, collapsed: false });
  await settle(20);
  const title = document.querySelector(".desk-panel__title-button");
  title.click();
  const print = rowsOf(title).find((r) => r.textContent === "Print…");
  assert.ok(print, "the menu has Print…");
  assert.equal(print.getAttribute("aria-haspopup"), "dialog", "it says it opens a window");
  print.click();
  const box = document.getElementById("deskPanelPrint");
  assert.ok(box, "the window is there");
  assert.equal(box.getAttribute("role"), "dialog");
  assert.equal(box.getAttribute("aria-label"), "Print");
  assert.equal(box.hidden, false, "Print… opened it");
  assert.equal(document.getElementById("deskPanelMenu").hidden, true, "in the menu's place");
  assert.equal(Boolean(document.activeElement && box.contains(document.activeElement)), true, "focus went into it");
  key(document.activeElement, "Escape");
  assert.equal(box.hidden, true, "Escape closes it");
  assert.equal(document.activeElement === title, true, "and gives focus back to the title");
  assert.equal(panel.isOpen(), true, "without minimizing the Notebook");
});

test("XA8-11: where the page can't print, the title's menu has no Print…", async () => {
  const store = page();
  const { createPanel } = await import("../src/scripts/desk/panel.js");
  createPanel({ store, ctx, printRoom: { can: () => false, print: async () => {} } });
  await settle(20);
  const titles = document.querySelectorAll(".desk-panel__title-button");
  const title = titles[titles.length - 1];
  assert.deepEqual(rowsOf(title).map((r) => r.querySelector(".desk-panel__menu-label").firstChild.textContent).slice(0, 2), ["Whole notebook", "Notebook actions"]);
  assert.equal(document.querySelectorAll("#deskPanelPrint").length, 0, "and no window for it");
});
