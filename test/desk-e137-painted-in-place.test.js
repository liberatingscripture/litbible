// A chapter opening with the Notebook expanded paints once, in place (E137).
// BVJ, 2026-11-17, clicking from chapter to chapter in a window about 1120px
// wide: each page loaded "without the notebook and then a second later adds
// the notebook," the text shifting back and forth. Where the margin is too
// narrow for the notebook the column moves left, and that move came only with
// the desk's code. Layout.astro's pre-paint script now stamps it on <html>
// (test/desk-prepaint.test.js) and global.css draws it; this file drives
// margin.js taking the move over: the same place, its own from then on.
//
// happy-dom has no layout, so the page here has a small one: a column
// centered in the window, moved by its translate, inline or stamped.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom } from "./helpers/browser-env.mjs";

const { createRail } = await import("../src/scripts/desk/margin.js");
const { standDown } = await import("../src/scripts/desk-frame.js");
const { MIN_KEY } = await import("../src/lib/desk-start.mjs");
const { FIRST_PAINT, MOVE_PROP, firstPaint } = await import("../src/lib/desk-margin.mjs");

const root = document.documentElement;
const CH = FIRST_PAINT.ch[""] * FIRST_PAINT.body * 16; // Source Sans 3, Medium
const columnWidth = () => (root.hasAttribute("data-desk-expanded") ? 48 : 52) * CH + FIRST_PAINT.pad;

let viewport = 1009; // a 1024px window less its scrollbar
Object.defineProperty(root, "clientWidth", { get: () => viewport, configurable: true });

/** A Chapter View chapter (or Read View), laid out as the browser would. */
function page({ read = false } = {}) {
  resetDom();
  for (const a of ["data-desk", "data-desk-panel", "data-desk-expanded", "data-desk-widths"]) root.removeAttribute(a);
  root.removeAttribute("style");
  localStorage.clear();
  document.body.innerHTML = read
    ? `<main><div class="rm-page"><div class="rm-toolbar"></div><h1 class="rm-title">Luke</h1><div class="rm-reader">text</div></div></main>`
    : `<main><div class="scripture-layout scripture-layout--scripture"><div class="scripture-main">
        <h1 id="chapter-title">Luke 4</h1>
        <article class="chapter"><div class="chapter-paragraphs"><div class="p">text</div></div></article>
      </div></div></main>`;
  const main = document.querySelector("main");
  main.getBoundingClientRect = () => ({ left: 0, right: viewport, top: 100, bottom: 4000, width: viewport, height: 3900 });
  const column = document.querySelector(read ? ".rm-reader" : ".scripture-main");
  column.getBoundingClientRect = () => {
    const width = columnWidth();
    // The column's own translate wins; else global.css's rule draws the stamp
    // on a chapter's column while the notebook is expanded.
    const drawn = column.style.translate
      || (!read && root.hasAttribute("data-desk-expanded") ? root.style.getPropertyValue(MOVE_PROP) : "");
    const left = (viewport - width) / 2 + (parseFloat(drawn) || 0);
    return { left, right: left + width, top: 200, bottom: 3800, width, height: 3600 };
  };
  const panel = document.createElement("section");
  panel.className = "desk-panel";
  const tab = document.createElement("button");
  return { column, panel, tab };
}

/** <html> as the pre-paint script leaves it for an expanded notebook in this window. */
function prePaint() {
  const fp = firstPaint({ viewport, ch: CH });
  root.setAttribute("data-desk", "on");
  root.setAttribute("data-desk-panel", "open");
  if (fp.expanded) root.setAttribute("data-desk-expanded", "");
  if (fp.shift) root.style.setProperty(MOVE_PROP, `${-fp.shift}px 0`);
  if (fp.center !== null) root.style.setProperty("--desk-bar-center", `${fp.center}px`);
  localStorage.setItem(MIN_KEY, "0"); // the reader left it expanded
  return fp;
}

/** How many times the column is reported moved, from here on. */
function countMoves() {
  let n = 0;
  const on = () => { n += 1; };
  document.addEventListener("desk:column-moved", on);
  return { get count() { return n; }, stop: () => document.removeEventListener("desk:column-moved", on) };
}

test("E137: the rail takes over the move the page was painted with, and the column never moves", async () => {
  viewport = 1009;
  const { column, panel, tab } = page();
  const fp = prePaint();
  assert.equal(fp.shift, 85);
  const painted = column.getBoundingClientRect().left;
  assert.equal(Math.round(painted), 150, "painted moved: 85px left of center");

  const moves = countMoves();
  const rail = createRail(panel, tab);
  // Taken over as the rail is made: its own translate, and the stamp gone.
  assert.equal(column.style.translate, "-85px 0");
  assert.equal(root.style.getPropertyValue(MOVE_PROP), "");
  assert.equal(column.getBoundingClientRect().left, painted, "in the same place");

  rail.show(); // as the panel does on a page that starts open
  assert.deepEqual(rail.state(), { floating: false, collapsed: false }, "expanded, in the margin");
  assert.equal(column.style.translate, "-85px 0", "the first placement makes the same move");
  assert.equal(column.getBoundingClientRect().left, painted);
  assert.equal(root.hasAttribute("data-desk-expanded"), true);
  assert.equal(root.style.getPropertyValue("--desk-bar-center"), "419.5px", "the center it was stamped with");
  assert.equal(moves.count, 0, "nothing was told the column moved, since it didn't");

  // From here the move is the rail's as before: a wider window needs less…
  viewport = 1085;
  window.dispatchEvent(new Event("resize"));
  await settle(5);
  assert.equal(column.style.translate, "-47px 0");
  assert.equal(moves.count, 1);
  // …and one whose margin holds the notebook, none: no translate at all, and
  // no stamp left behind to bring one back.
  viewport = 1265;
  window.dispatchEvent(new Event("resize"));
  await settle(5);
  assert.equal(column.style.translate, "");
  assert.equal(root.style.getPropertyValue(MOVE_PROP), "");
  assert.equal(Math.round(column.getBoundingClientRect().left), 363, "centered");
  moves.stop();
  rail.destroy();
});

test("E137: minimizing and hiding the Notebook put the column back", () => {
  viewport = 1009;
  const { column, panel, tab } = page();
  prePaint();
  const rail = createRail(panel, tab);
  rail.show();
  assert.equal(column.style.translate, "-85px 0");
  // Folded to its tab, the column is the 52 column, centered: the tab needs no room here.
  rail.collapse();
  assert.equal(root.hasAttribute("data-desk-expanded"), false);
  assert.equal(column.style.translate, "");
  rail.expand();
  assert.equal(column.style.translate, "-85px 0");
  rail.hide();
  assert.equal(column.style.translate, "");
  assert.equal(root.style.getPropertyValue("--desk-bar-center"), "");
  assert.equal(root.style.getPropertyValue(MOVE_PROP), "");
  rail.destroy();
});

test("E137: with no stamp the rail starts from an unmoved column, as before", () => {
  // A wide window: nothing is stamped and nothing moves.
  viewport = 1265;
  let { column, panel, tab } = page();
  assert.equal(prePaint().shift, 0);
  let rail = createRail(panel, tab);
  assert.equal(column.style.translate, "");
  rail.show();
  assert.equal(column.style.translate, "");
  assert.equal(rail.state().collapsed, false);
  rail.destroy();

  // A page that was not stamped though its margin is narrow (the notebook
  // expanded by the reader after load, say): the rail makes the move itself.
  viewport = 1009;
  ({ column, panel, tab } = page());
  root.setAttribute("data-desk", "on");
  const moves = countMoves();
  rail = createRail(panel, tab);
  assert.equal(column.style.translate, "");
  rail.show({ expand: true });
  assert.equal(column.style.translate, "-85px 0");
  assert.equal(moves.count, 1);
  moves.stop();
  rail.destroy();
});

test("E137: a stamp is taken over only where it is drawn", () => {
  viewport = 1009;
  // Not while the notebook isn't marked expanded (global.css's rule needs it).
  let { column, panel, tab } = page();
  root.setAttribute("data-desk", "on");
  root.style.setProperty(MOVE_PROP, "-85px 0");
  let rail = createRail(panel, tab);
  assert.equal(column.style.translate, "");
  assert.equal(root.style.getPropertyValue(MOVE_PROP), "", "and it doesn't linger");
  rail.destroy();

  // Not in Read View, whose column the stamp was never worked out for.
  ({ column, panel, tab } = page({ read: true }));
  root.setAttribute("data-desk", "on");
  root.setAttribute("data-desk-expanded", "");
  root.style.setProperty(MOVE_PROP, "-85px 0");
  rail = createRail(panel, tab);
  for (const el of document.querySelectorAll(".rm-toolbar, .rm-reader")) assert.equal(el.style.translate, "");
  assert.equal(root.style.getPropertyValue(MOVE_PROP), "");
  rail.destroy();
});

test("E137: if the desk never loads, standing down puts the column back", () => {
  viewport = 1009;
  const { column } = page();
  prePaint();
  assert.equal(Math.round(column.getBoundingClientRect().left), 150, "painted moved");
  standDown();
  assert.equal(root.style.getPropertyValue(MOVE_PROP), "");
  assert.equal(root.style.getPropertyValue("--desk-bar-center"), "");
  assert.equal(root.hasAttribute("data-desk-expanded"), false);
  assert.equal(column.style.translate, "");
  // Without the stamp the column is where the page's own rules put it.
  assert.equal(column.getBoundingClientRect().left, (viewport - columnWidth()) / 2);

  // The same after the rail has taken the move over and the Notebook then failed.
  const next = page();
  prePaint();
  createRail(next.panel, next.tab);
  assert.equal(next.column.style.translate, "-85px 0");
  standDown();
  assert.equal(next.column.style.translate, "");
});
