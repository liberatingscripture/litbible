// The text line's grip in the sheet's left margin (E137), driven in a browser
// DOM: it shows while the pointer is on the bare page anywhere in that margin,
// and never over a margin note, a note's circle, or anything else lying there
// (BVJ, 2026-11-17: "it shouldn't show when interacting with a margin note or
// note glyph").

import { test } from "node:test";
import assert from "node:assert/strict";
import { window } from "./helpers/browser-env.mjs";

const { createWidths } = await import("../src/scripts/desk/widths.js");

// The page: a column 600px wide from x 300, its text 16px inside it, with a
// note and a note's circle lying in the margin to its left.
document.body.innerHTML = `
  <main id="main">
    <div class="scripture-main" style="padding-left: 16px; padding-right: 16px">
      <p id="text">In the beginning</p>
      <button type="button" id="pin">Pin</button>
    </div>
  </main>
  <aside class="desk-notes">
    <div class="desk-note"><button type="button" class="desk-note__hit" id="note">A note</button></div>
    <button type="button" class="desk-circle" id="circle"></button>
  </aside>
  <div class="desk-panel" id="panel"></div>`;

const column = document.querySelector(".scripture-main");
const main = document.getElementById("main");
const box = (left, top, width, height) => () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });
column.getBoundingClientRect = box(300, 100, 600, 1900);

const widths = createWidths({ column, panel: document.getElementById("panel"), onChange: () => {} });
const line = document.querySelector(".desk-gutter--text");
line.getBoundingClientRect = box(302, 100, 12, 1900);
widths.placeHandles({ top: 100, height: 1900, column: column.getBoundingClientRect(), panelLeft: 924 });

const PointerEvent = window.PointerEvent ?? window.MouseEvent;
function move(target, x, y, init = {}) {
  target.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: x, clientY: y, pointerType: "mouse", buttons: 0, ...init }));
}
const shown = () => line.classList.contains("desk-gutter--near");

// With no sheet drawn (no stylesheet here), the margin is the 49px a sheet
// takes: x 251 to 316, where the text starts.

test("the grip shows on the bare page anywhere in the sheet's left margin, at the pointer's height", () => {
  move(main, 260, 500);
  assert.equal(shown(), true, "left of the column, on the page");
  assert.equal(line.style.getPropertyValue("--grip-y"), "400px");

  move(column, 310, 640);
  assert.equal(shown(), true, "in the column's own padding");
  assert.equal(line.style.getPropertyValue("--grip-y"), "540px");

  move(line, 305, 700);
  assert.equal(shown(), true, "on the line itself");
});

test("it is gone outside the margin", () => {
  move(main, 260, 500);
  move(column, 320, 500);
  assert.equal(shown(), false, "over the text");

  move(main, 260, 500);
  move(main, 240, 500);
  assert.equal(shown(), false, "left of the sheet");

  move(main, 260, 500);
  move(main, 260, 2100);
  assert.equal(shown(), false, "below the reading area");
});

test("it never shows over a margin note, a note's circle, or a Pin", () => {
  for (const id of ["note", "circle", "pin"]) {
    move(main, 260, 500);
    assert.equal(shown(), true);
    move(document.getElementById(id), 262, 500);
    assert.equal(shown(), false, `over #${id}`);
  }
});

test("it stays away while a circle's popover is open", () => {
  const circle = document.getElementById("circle");
  circle.setAttribute("aria-expanded", "true");
  move(main, 260, 500);
  assert.equal(shown(), false);
  circle.setAttribute("aria-expanded", "false");
  move(main, 260, 500);
  assert.equal(shown(), true);
});

test("a held button or a finger draws nothing", () => {
  move(main, 260, 500, { buttons: 1 });
  assert.equal(shown(), false, "a selection being dragged across");
  move(main, 260, 500, { pointerType: "touch" });
  assert.equal(shown(), false, "a finger");
});

// A sheet, as Site 2.0 paints one: the column's ::before, reaching past the
// column's box by its (negative) left and right.
const realStyle = globalThis.getComputedStyle;
let sheet = null;
globalThis.getComputedStyle = (el, pseudo) => (pseudo === "::before" && sheet ? sheet : realStyle.call(window, el, pseudo));
const place = () => widths.placeHandles({ top: 100, height: 1900, column: column.getBoundingClientRect(), panelLeft: 924 });

test("with a sheet drawn, the margin runs from the sheet's own left edge", () => {
  sheet = { content: '""', left: "-200px", right: "-12px" };
  move(main, 120, 500);
  assert.equal(shown(), true, "under the notes' part of the sheet");
  move(main, 90, 500);
  assert.equal(shown(), false, "left of the sheet");
  sheet = null;
});

test("the Notebook's line draws its grip between the sheet and the Notebook", () => {
  const book = document.querySelector(".desk-gutter--book");
  // Its reach is x 894 to 924; the sheet ends at 912, so the space between
  // is 912 to 924 and its middle is 24px into the line.
  sheet = { content: '""', left: "-49px", right: "-12px" };
  place();
  assert.equal(book.style.width, "30px");
  assert.equal(book.style.getPropertyValue("--grip-x"), "24px");

  sheet = null;
  place();
  assert.equal(book.style.getPropertyValue("--grip-x"), "", "with no sheet the grip keeps the middle");
});

test("with the handles hidden there is no grip", () => {
  move(main, 260, 500);
  assert.equal(shown(), true);
  widths.hideHandles();
  assert.equal(shown(), false);
  move(main, 260, 500);
  assert.equal(shown(), false);
});
