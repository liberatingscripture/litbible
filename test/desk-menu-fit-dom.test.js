// Menus and flyouts stay inside the window (E179; BVJ, 2026-11-19): the pane
// menu's Add pane flyout grew from its four sides to the eight kinds without
// being placed again, so its foot ran off the screen, and any scroll closes
// the menu, so it could not be reached. The command row's Add pane menu and
// the windows that hang from the row had no cap either, nor had /sheets'
// Save as menu.
//
// happy-dom has no layout, so each test gives the elements it measures a size:
// a menu or flyout is 50px a line, cut to its max-height, placed where its
// style puts it.

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { window } from "./helpers/browser-env.mjs";
import { originalLayout, panes } from "../src/lib/desk-layout.mjs";

const { createKindMenu } = await import("../src/scripts/desk/kind-menu.js");
const { createCommandRow } = await import("../src/scripts/desk/command-row.js");
const { createSaveMenu } = await import("../src/scripts/desk/sheets/sheet-save.js");

const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
const LINE = 50;

const proto = window.HTMLElement.prototype;
const saved = {
  offsetHeight: Object.getOwnPropertyDescriptor(proto, "offsetHeight"),
  offsetWidth: Object.getOwnPropertyDescriptor(proto, "offsetWidth"),
  rect: proto.getBoundingClientRect,
  innerHeight: Object.getOwnPropertyDescriptor(window, "innerHeight"),
  innerWidth: Object.getOwnPropertyDescriptor(window, "innerWidth"),
};

afterEach(() => {
  for (const key of ["offsetHeight", "offsetWidth"]) {
    if (saved[key]) Object.defineProperty(proto, key, saved[key]);
    else delete proto[key];
  }
  proto.getBoundingClientRect = saved.rect;
  for (const key of ["innerHeight", "innerWidth"]) {
    if (saved[key]) Object.defineProperty(window, key, saved[key]);
    else delete window[key];
  }
});

/** A window of `width` by `height`, and a layout where `sizeOf(el)` and `rectOf(el)` say what each element measures. */
function fakeLayout({ width = 1200, height }, rectOf) {
  Object.defineProperty(window, "innerHeight", { value: height, configurable: true });
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  const lines = (el) => el.querySelectorAll("button").length * LINE;
  const tall = (el) => {
    const cap = parseFloat(el.style.maxHeight);
    return Number.isFinite(cap) ? Math.min(lines(el), cap) : lines(el);
  };
  Object.defineProperty(proto, "offsetHeight", { configurable: true, get() { return tall(this); } });
  Object.defineProperty(proto, "offsetWidth", { configurable: true, get() { return 200; } });
  proto.getBoundingClientRect = function getBoundingClientRect() {
    const own = rectOf(this);
    if (own) return { ...own, width: own.right - own.left, height: own.bottom - own.top, x: own.left, y: own.top };
    const top = parseFloat(this.style.top) || 0;
    const left = parseFloat(this.style.left) || 0;
    const h = tall(this);
    return { top, left, bottom: top + h, right: left + 200, width: 200, height: h, x: left, y: top };
  };
}

// ---- the pane menu's Add pane flyout ----

function paneMenu() {
  const layout = originalLayout();
  const id = panes(layout.root)[0].id;
  document.body.innerHTML = `<div id="panes"><div class="desk-pane__head"><button type="button" aria-expanded="false">The LIT</button></div></div>`;
  const panesBox = document.getElementById("panes");
  const button = panesBox.querySelector("button");
  const paneEls = new Map(panes(layout.root).map((p) => [p.id, { el: document.createElement("div") }]));
  const menu = createKindMenu({
    getLayout: () => layout,
    panesBox,
    paneEls,
    commit: () => {},
    announce: () => {},
    sizePane: () => {},
  });
  return { menu, id, button, panesBox };
}

/** The menu hangs from y 150 to 630 on the left; its Add pane line is at y 600, near the window's foot. */
const paneRects = (el) => {
  if (el.id === "panes") return { left: 0, top: 0, right: 1400, bottom: 800 };
  if (el.matches?.(".desk-pane__menu:not(.desk-pane__fly)")) return { left: 40, top: 150, right: 390, bottom: 630 };
  if (el.matches?.(".desk-pane__menu-item--fly")) return { left: 44, top: 600, right: 386, bottom: 640 };
  return null;
};

function openAddFlyout(height) {
  fakeLayout({ height }, paneRects);
  const { menu, id, button } = paneMenu();
  menu.open(id, button);
  const trigger = [...document.querySelectorAll(".desk-pane__menu-item--fly")].find((b) => b.textContent.includes("Add pane"));
  assert.ok(trigger, "the menu has an Add pane line");
  assert.notEqual(trigger.getAttribute("aria-disabled"), "true", "with room for a pane");
  click(trigger);
  const fly = document.querySelector(".desk-pane__fly");
  assert.ok(fly, "the flyout opened");
  return { fly, menu };
}

const footOf = (fly) => parseFloat(fly.style.top) + fly.offsetHeight;

test("the Add pane flyout is placed again when its kinds replace its sides, and stays inside the window", () => {
  const { fly, menu } = openAddFlyout(640);
  assert.equal(fly.querySelectorAll("button").length, 4, "four sides");
  assert.ok(footOf(fly) <= 640 - 8, `the sides end inside the window (at ${footOf(fly)})`);
  const sidesTop = parseFloat(fly.style.top);
  const below = [...fly.querySelectorAll("button")].find((b) => b.textContent.startsWith("Below"));
  click(below);
  assert.ok(fly.textContent.includes("‹ Below"), "the kinds, with a way back");
  const kinds = fly.querySelectorAll("button").length;
  assert.ok(kinds * LINE > 640 - 8 - sidesTop, "the kinds would have run past the window's foot where the sides were");
  assert.ok(footOf(fly) <= 640 - 8, `the kinds end inside the window (at ${footOf(fly)}), moved up`);
  assert.ok(parseFloat(fly.style.top) >= 8, "and not past its top");
  assert.ok(document.querySelector(".desk-pane__fly"), "still open");
  menu.close({ focus: false });
});

test("a window shorter than the kinds cuts the flyout to its height, and it scrolls", () => {
  const { fly, menu } = openAddFlyout(420);
  click([...fly.querySelectorAll("button")].find((b) => b.textContent.startsWith("Below")));
  assert.equal(fly.style.maxHeight, `${420 - 16}px`, "as tall as the window less its edges");
  assert.equal(parseFloat(fly.style.top), 8, "from the window's top edge");
  assert.ok(footOf(fly) <= 420 - 8, "to its foot");
  // Back to the sides, placed again level with the line where they fit.
  fly.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
  assert.equal(fly.querySelectorAll("button").length, 4, "back at the sides");
  assert.ok(footOf(fly) <= 420 - 8);
  menu.close({ focus: false });
});

// ---- the command row ----

function commandRow(height) {
  fakeLayout({ height }, (el) => {
    if (el.id === "panes") return { left: 0, top: 0, right: 1400, bottom: 800 };
    if (el.id === "deskAddMenu" || el.id === "win") return { left: 16, top: 116, right: 266, bottom: 116 + el.offsetHeight };
    return null;
  });
  document.body.innerHTML = `<div id="row"></div><div id="panes"></div><div id="win"></div>`;
  let layout = originalLayout();
  return createCommandRow({
    row: document.getElementById("row"),
    getLayout: () => layout,
    panesBox: document.getElementById("panes"),
    commit: (next) => { layout = next; },
    announce: () => {},
    inTour: () => false,
    layoutWindow: { open() {}, close() {} },
    printWindow: { open() {}, close() {} },
  });
}

test("the command row's Add pane menu stops at the window's foot at its kinds, and the cap comes off going back", () => {
  const row = commandRow(500);
  click(row.addButton);
  assert.equal(row.addMenu.style.maxHeight, "", "column and row fit");
  click(row.addMenu.querySelector("[role=menuitem]"));
  assert.ok(row.addMenu.textContent.includes("‹ Add column"), "the kinds");
  assert.equal(row.addMenu.style.maxHeight, `${500 - 116 - 8}px`, "cut to the room under its top");
  row.addMenu.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  assert.ok(!row.addMenu.textContent.includes("‹ Add column"), "back at column or row");
  assert.equal(row.addMenu.style.maxHeight, "", "which fit again");
});

test("a window hung from the command row (Layout…, Print…) stops at the window's foot", () => {
  const row = commandRow(400);
  const win = document.getElementById("win");
  win.innerHTML = "<button></button>".repeat(12);
  row.hang(win, row.layoutButton);
  assert.equal(win.style.maxHeight, `${400 - 116 - 8}px`);
  win.innerHTML = "<button></button>".repeat(2);
  row.hang(win, row.layoutButton);
  assert.equal(win.style.maxHeight, "", "no cap where it fits");
});

// ---- /sheets' Save as ▾ ----

test("a sheet's Save as menu stops at the window's foot in a short window", () => {
  const top = 116;
  const at = (height) => {
    fakeLayout({ height }, (el) => (el.matches?.(".sheets-page__save-menu") ? { left: 16, top, right: 266, bottom: top + el.offsetHeight } : null));
    document.body.innerHTML = "";
    const save = createSaveMenu({ version: () => "Leader version", onChoose: () => {} });
    document.body.append(save.el);
    const button = save.el.querySelector(".sheets-page__save-button");
    const menu = save.el.querySelector("[role=menu]");
    click(button);
    assert.equal(menu.hidden, false, "it opened");
    return menu;
  };
  const short = at(320);
  assert.ok(short.querySelectorAll("button").length * LINE > 320 - top - 8, "taller than the room under it");
  assert.equal(short.style.maxHeight, `${320 - top - 8}px`);
  assert.equal(at(2000).style.maxHeight, "", "no cap where it fits");
});
