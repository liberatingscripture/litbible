// The title menu (title-menu.js, DK8-4) and the Notebook actions window
// (commands-window.js through notebook-search.js, GF8a-7 and GF8a-8) driven in
// a browser DOM.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, window } from "./helpers/browser-env.mjs";
import { originalLayout } from "../src/lib/desk-layout.mjs";

const { createTitleMenu } = await import("../src/scripts/desk/title-menu.js");
const { openCommands } = await import("../src/scripts/desk/notebook-search.js");
const { closeCommandsWindow } = await import("../src/scripts/desk/commands-window.js");

const same = (a, b, message) => assert.ok(a === b, message ?? "not the same element");
const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
const rowsOf = () => [...document.querySelectorAll(".desk-cmds__name")].map((n) => n.textContent);

// ---- the title menu ----

function titleMenu() {
  document.body.innerHTML = `<div class="desk-title"><h1><button type="button" class="desk-title__button" aria-expanded="false"><span>Study Desk</span></button></h1></div><div id="panes"></div>`;
  const wrap = document.querySelector(".desk-title");
  const titleButton = wrap.querySelector("button");
  const layout = originalLayout();
  const menu = createTitleMenu({
    wrap,
    titleButton,
    getLayout: () => layout,
    panesBox: document.getElementById("panes"),
    commit: () => {},
    announce: () => {},
    getTour: () => null,
    inTour: () => false,
    layoutWindow: { open() {}, close() {} },
    printWindow: { open() {}, close() {} },
  });
  // The links open a new tab; here the click is only observed.
  wrap.addEventListener("click", (e) => e.target.closest?.("a") && e.preventDefault());
  return { menu, wrap, titleButton };
}

// Help moved to the command row under the header (E68); its test is below.
for (const [name, text] of [["My Notebook", "notebook"], ["Send feedback on the preview", "feedback"]]) {
  test(`DK8-4: choosing "${name}" (a new-tab link) closes the menu and gives focus back to the title button`, () => {
    const { menu, titleButton } = titleMenu();
    click(titleButton);
    assert.equal(menu.el.hidden, false, "the menu is open");
    const link = [...menu.el.querySelectorAll("a[role=menuitem]")].find((a) => a.textContent.includes(name));
    assert.ok(link, text);
    assert.equal(link.target, "_blank");
    link.focus();
    click(link);
    assert.equal(menu.el.hidden, true, "the menu closed");
    same(document.activeElement, titleButton, "focus is on the title button, not lost to the page");
    assert.equal(titleButton.getAttribute("aria-expanded"), "false");
  });
}

// ---- the command row (E68) ----

const { createCommandRow } = await import("../src/scripts/desk/command-row.js");

function commandRow() {
  document.body.innerHTML = `<div id="row"></div><div id="panes"></div>`;
  const panesBox = document.getElementById("panes");
  // A desk-sized room, so Add pane is available.
  panesBox.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1400, bottom: 800, width: 1400, height: 800 });
  const layout = originalLayout();
  const opened = [];
  const row = createCommandRow({
    row: document.getElementById("row"),
    getLayout: () => layout,
    panesBox,
    commit: () => {},
    announce: () => {},
    inTour: () => false,
    layoutWindow: { open: () => opened.push("layout"), close() {} },
    printWindow: { open: () => opened.push("print"), close() {} },
  });
  return { row, opened };
}

test("E68: the command row holds Add pane, Layout…, New sheet…, Print… and Help, in words", () => {
  const { row } = commandRow();
  const words = [...row.el.querySelectorAll(".desk-cmdrow__label")].map((n) => n.textContent);
  assert.deepEqual(words, ["Add pane", "Layout…", "New sheet…", "Print…", "Help"]);
  const help = row.el.querySelector("a.desk-cmdrow__btn");
  assert.equal(help.target, "_blank");
  assert.ok(help.textContent.includes("(opens in a new tab)"), "the new tab is said in words too");
  assert.ok(help.querySelector(".desk-newtab"), "and to the eye (E71)");
});

test("E68: Layout… and Print… open their windows", () => {
  const { row, opened } = commandRow();
  click(row.layoutButton);
  click(row.printButton);
  assert.deepEqual(opened, ["layout", "print"]);
});

test("E68: Add pane opens its menu at column or row, then the kinds; Escape steps back, then closes onto the button", () => {
  const { row } = commandRow();
  click(row.addButton);
  assert.equal(row.addMenu.hidden, false);
  assert.equal(row.addButton.getAttribute("aria-expanded"), "true");
  const first = row.addMenu.querySelector("[role=menuitem]");
  same(document.activeElement, first, "focus is on the first line");
  assert.equal(first.textContent.trim().startsWith("Add column"), true);
  click(first);
  assert.ok(row.addMenu.textContent.includes("‹ Add column"), "the kinds, with a way back");
  const esc = () => row.addMenu.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  document.activeElement.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  assert.ok(!row.addMenu.textContent.includes("‹ Add column"), "back at column or row");
  assert.equal(row.addMenu.hidden, false);
  esc();
  assert.equal(row.addMenu.hidden, true);
  same(document.activeElement, row.addButton, "focus is back on Add pane");
});

// ---- the Notebook actions window ----

function readingPage() {
  document.documentElement.removeAttribute("data-desk-panel");
  document.body.innerHTML = `<div class="scripture-layout--scripture"><div class="scripture-main"></div></div><button type="button" id="opener">Actions</button>`;
  return document.getElementById("opener");
}

test("GF8a-7: the open Notebook actions window draws again when the Notebook opens, and when a setting changes", async () => {
  const opener = readingPage();
  openCommands({ opener });
  assert.ok(rowsOf().includes("Open the Notebook"), "offered while the Notebook is closed");
  // The Notebook opens (the shell stamps <html>): the window is still up and is drawn again.
  document.documentElement.setAttribute("data-desk-panel", "");
  await until(() => !rowsOf().includes("Open the Notebook"));
  document.documentElement.removeAttribute("data-desk-panel");
  await until(() => rowsOf().includes("Open the Notebook"));
  // A setting changes (note-settings.js announces desk:settings), here the marks being hidden.
  const before = rowsOf().join("|");
  localStorage.setItem("lit-desk-notes", "off");
  localStorage.setItem("lit-desk-bookmarks", "off");
  localStorage.setItem("lit-desk-highlights", "off");
  document.dispatchEvent(new window.Event("desk:settings"));
  assert.notEqual(rowsOf().join("|"), before, "the list says what it now does");
  localStorage.clear();
  document.dispatchEvent(new window.Event("desk:settings"));
  assert.equal(rowsOf().join("|"), before);
  closeCommandsWindow("close");
});

test("GF8a-8: a chosen command takes the window away and, if nothing else took focus, the opener has it back", async () => {
  const opener = readingPage();
  openCommands({ opener });
  const row = [...document.querySelectorAll("button.desk-cmds__row")].find((b) => b.textContent.includes("Open the Notebook"));
  assert.ok(row);
  row.focus();
  click(row); // runs the command (the shell would act on lit:desk-command) and closes the window
  assert.equal(document.querySelector(".desk-cmds"), null, "the window is closed");
  await settle(20);
  same(document.activeElement, opener, "focus went back to the control that opened it");
});

test("GF8a-8: closing the window with its × also gives the opener focus", async () => {
  const opener = readingPage();
  openCommands({ opener });
  closeCommandsWindow("close");
  same(document.activeElement, opener);
});

async function until(fn, tries = 100) {
  for (let i = 0; i < tries; i++) {
    if (fn()) return true;
    await settle(10);
  }
  throw new Error("timed out");
}
