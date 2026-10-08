// test/desk-margin.test.js
//
// src/lib/desk-margin.mjs: where the Notebook panel goes. It fills the right
// margin beside the reading column and moves nothing when the margin is wide
// enough; otherwise the column moves left only as far as the panel needs.
// The widths below are real ones: Study View's column is 622px at the
// default text size with the desk's 52 measure, 787px at Extra large.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  EDGE, GAP, MAX_WIDTH, MIN_HEIGHT, MIN_WIDTH, TAB_EDGE, TAB_GAP, TAB_WIDTH,
  nextCollapsed, panelHeight, placeFloating, placeInMargin,
} from "../src/lib/desk-margin.mjs";

/** A column `width` wide, centred in a page `viewport` wide, moved left by `shift`. */
function centred(viewport, width, shift = 0) {
  const left = (viewport - width) / 2 - shift;
  return { viewport, column: { left, right: left + width }, main: { left: 0 }, shift };
}

test("a wide margin: the panel fills it, beside the text, and nothing moves", () => {
  const m = centred(1425, 622); // a 1440px window
  const at = placeInMargin(m);
  assert.equal(at.shift, 0);
  assert.equal(at.over, false);
  assert.equal(at.left, m.column.right + GAP);
  assert.equal(at.left + at.width, 1425 - EDGE);
  assert.ok(at.width >= MIN_WIDTH && at.width <= MAX_WIDTH);
});

test("a very wide margin: the panel stops at its widest and keeps to the text's side", () => {
  const m = centred(1905, 622); // a 1920px window
  const at = placeInMargin(m);
  assert.equal(at.width, MAX_WIDTH);
  assert.equal(at.left, m.column.right + GAP);
  assert.equal(at.shift, 0);
});

test("exactly enough margin still moves nothing", () => {
  const viewport = 1600;
  const width = viewport - 2 * (MIN_WIDTH + GAP + EDGE);
  const at = placeInMargin(centred(viewport, width));
  assert.equal(at.width, MIN_WIDTH);
  assert.equal(at.shift, 0);
});

test("a narrow margin: the column moves left only as far as the panel needs", () => {
  const m = centred(1265, 787); // a 1280px window at Extra large
  const room = 1265 - EDGE - (m.column.right + GAP);
  const at = placeInMargin(m);
  assert.equal(at.width, MIN_WIDTH);
  assert.equal(at.shift, Math.round(MIN_WIDTH - room));
  assert.equal(at.over, false);
  assert.equal(at.left, 1265 - EDGE - MIN_WIDTH);
});

test("the answer holds once applied: measuring the moved column gives the same move", () => {
  const first = placeInMargin(centred(1265, 787));
  const again = placeInMargin(centred(1265, 787, first.shift));
  assert.deepEqual(again, first);
});

test("a window too narrow to move far enough: the panel lies over the line ends", () => {
  const m = centred(885, 787); // a 900px window at Extra large
  const at = placeInMargin(m);
  assert.equal(at.over, true);
  assert.equal(at.shift, Math.round(m.column.left), "the column moves as far as its own margin allows");
  assert.equal(at.width, MIN_WIDTH);
});

/* ── Height: down to EDGE above the window's bottom ─────────────────── */

test("at the top of the page the panel starts level with the text and reaches EDGE above the bottom", () => {
  // The rail starts 202px down (Romans 8's title) and runs far below.
  assert.equal(panelHeight({ top: 202, bottom: 5000 }, 860), 860 - EDGE - 202);
});

test("scrolled past the start, it pins EDGE from the top and fills the window less both gaps", () => {
  assert.equal(panelHeight({ top: -1500, bottom: 3000 }, 860), 860 - 2 * EDGE);
});

test("at the footer it ends with the rail, until it would get shorter than MIN_HEIGHT", () => {
  assert.equal(panelHeight({ top: -4000, bottom: 600 }, 860), 600 - EDGE);
  assert.equal(panelHeight({ top: -4000, bottom: 100 }, 860), MIN_HEIGHT);
});

test("a heading low on the screen still ends the panel EDGE above the bottom, short until scrolled", () => {
  // An article title 735px down an 860px window.
  assert.equal(panelHeight({ top: 735, bottom: 6000 }, 860), 860 - EDGE - 735);
  assert.equal(panelHeight({ top: 900, bottom: 6000 }, 860), 0, "below the window: nothing to show yet");
});

test("a rail ending on screen and shorter than MIN_HEIGHT caps the floor at its own height", () => {
  assert.equal(panelHeight({ top: 300, bottom: 400 }, 860), 100);
});

/* ── A narrow window: the floating notebook ─────────────────────────── */

test("floating: the column moves only as far as the collapsed tab needs", () => {
  const m = centred(885, 787); // a 900px window at Extra large: 49px a side
  const at = placeFloating(m);
  const need = m.column.right + TAB_GAP - (885 - TAB_EDGE - TAB_WIDTH);
  assert.equal(at.shift, Math.round(need));
  assert.equal(at.tabOver, false);
  assert.ok(m.column.right - at.shift + TAB_GAP <= at.tab.left, "the tab clears the moved text");
  assert.equal(at.tab.left + at.tab.width, 885 - TAB_EDGE);
});

test("floating: where the margin already holds the tab, nothing moves", () => {
  const at = placeFloating(centred(885, 622)); // default size: 131px a side
  assert.equal(at.shift, 0);
  assert.equal(at.tabOver, false);
});

test("floating: the expanded panel takes its narrowest width at the window's edge", () => {
  const at = placeFloating(centred(885, 622));
  assert.equal(at.panel.width, MIN_WIDTH);
  assert.equal(at.panel.left + at.panel.width, 885 - EDGE);
});

test("floating: the answer holds once applied", () => {
  const first = placeFloating(centred(885, 787));
  assert.deepEqual(placeFloating(centred(885, 787, first.shift)), first);
});

test("floating: a column with no room to move leaves the tab over the text, and says so", () => {
  const m = centred(800, 790);
  const at = placeFloating(m);
  assert.equal(at.tabOver, true);
  assert.equal(at.shift, Math.round(m.column.left));
});

test("the notebook collapses when it starts floating, unless the reader is opening it", () => {
  // A page opening with it remembered open, or a window narrowed under it.
  assert.equal(nextCollapsed({ floating: true, wasFloating: false, collapsed: false, opening: false }), true);
  // The reader pressing Notebook in a narrow window.
  assert.equal(nextCollapsed({ floating: true, wasFloating: false, collapsed: false, opening: true }), false);
  // Already floating: as the reader left it.
  assert.equal(nextCollapsed({ floating: true, wasFloating: true, collapsed: false, opening: false }), false);
  assert.equal(nextCollapsed({ floating: true, wasFloating: true, collapsed: true, opening: false }), true);
  // In the margin it is never collapsed.
  assert.equal(nextCollapsed({ floating: false, wasFloating: true, collapsed: true, opening: false }), false);
});
