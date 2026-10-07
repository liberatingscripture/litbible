// test/desk-margin.test.js
//
// src/lib/desk-margin.mjs: where the Notebook panel goes. It fills the right
// margin beside the reading column and moves nothing when the margin is wide
// enough; otherwise the column moves left only as far as the panel needs.
// The widths below are real ones: Study View's column is 622px at the
// default text size with the desk's 52 measure, 787px at Extra large.

import { test } from "node:test";
import assert from "node:assert/strict";

import { EDGE, GAP, MAX_WIDTH, MIN_WIDTH, PLAIN_WIDTH, placeInMargin } from "../src/lib/desk-margin.mjs";

/** A column `width` wide, centred in a page `viewport` wide, moved left by pad / 2. */
function centred(viewport, width, pad = 0) {
  const left = (viewport - pad - width) / 2;
  return { viewport, column: { left, right: left + width }, main: { left: 0 }, pad };
}

test("a wide margin: the panel fills it, beside the text, and nothing moves", () => {
  const m = centred(1425, 622); // a 1440px window
  const at = placeInMargin(m);
  assert.equal(at.pad, 0);
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
  assert.equal(at.pad, 0);
});

test("exactly enough margin still moves nothing", () => {
  const viewport = 1600;
  const width = viewport - 2 * (MIN_WIDTH + GAP + EDGE);
  const at = placeInMargin(centred(viewport, width));
  assert.equal(at.width, MIN_WIDTH);
  assert.equal(at.pad, 0);
});

test("a narrow margin: the column moves left only as far as the panel needs", () => {
  const m = centred(1265, 787); // a 1280px window at Extra large
  const room = 1265 - EDGE - (m.column.right + GAP);
  const at = placeInMargin(m);
  assert.equal(at.width, MIN_WIDTH);
  assert.equal(at.pad, Math.round(2 * (MIN_WIDTH - room)));
  assert.equal(at.over, false);
  assert.equal(at.left, 1265 - EDGE - MIN_WIDTH);
});

test("the answer holds once applied: measuring the moved column gives the same padding", () => {
  const first = placeInMargin(centred(1265, 787));
  const again = placeInMargin(centred(1265, 787, first.pad));
  assert.deepEqual(again, first);
});

test("a window too narrow to move far enough: the panel lies over the line ends", () => {
  const m = centred(885, 787); // a 900px window at Extra large
  const at = placeInMargin(m);
  assert.equal(at.over, true);
  assert.equal(at.pad, Math.round(2 * m.column.left), "the column moves as far as its own margin allows");
  assert.equal(at.width, MIN_WIDTH);
});

test("a page with no reading column reserves the panel's room on the right of <main>", () => {
  const at = placeInMargin({ viewport: 1425, column: null, main: { left: 0 } });
  assert.equal(at.width, PLAIN_WIDTH);
  assert.equal(at.left, 1425 - EDGE - PLAIN_WIDTH);
  assert.equal(at.pad, PLAIN_WIDTH + GAP + EDGE);
  assert.equal(at.over, false);
});
