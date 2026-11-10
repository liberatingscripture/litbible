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

for (const [name, text] of [["My Notebook page", "notebook"], ["Help for the Study Desk", "help"]]) {
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
