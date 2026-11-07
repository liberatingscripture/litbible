// test/desk-footnote-pills.test.js
//
// src/lib/desk-footnote-pills.mjs: whether a footnote's Pin and "+ Note" sit
// side by side in the left margin, behind one "⋯" pill, or on the note's line
// (E49). The widths are the real ones in Inter: Pin 32px, "+ Note" 56px.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PILL_EDGE, PILL_GAP, PILL_OFFSET, ROW_FALLBACK, STACK_FALLBACK, footnotePillMode,
} from "../src/lib/desk-footnote-pills.mjs";

const ROW = 32 + PILL_GAP + 56; // 92
const STACK = 56;

test("a wide margin: both pills side by side", () => {
  assert.equal(footnotePillMode({ free: 300, row: ROW, stack: STACK }), "row");
  assert.equal(footnotePillMode({ free: ROW + PILL_OFFSET + PILL_EDGE, row: ROW, stack: STACK }), "row");
});

test("a margin that holds the row to the pixel, and one short of it", () => {
  const need = ROW + PILL_OFFSET + PILL_EDGE;
  assert.equal(footnotePillMode({ free: need, row: ROW, stack: STACK }), "row");
  assert.equal(footnotePillMode({ free: need - 1, row: ROW, stack: STACK }), "more");
});

test("a narrower margin: the stack behind the ⋯ pill", () => {
  assert.equal(footnotePillMode({ free: 90, row: ROW, stack: STACK }), "more");
  const need = STACK + PILL_OFFSET + PILL_EDGE;
  assert.equal(footnotePillMode({ free: need, row: ROW, stack: STACK }), "more");
  assert.equal(footnotePillMode({ free: need - 1, row: ROW, stack: STACK }), "inline");
});

test("no margin: the pills stay on the note's line", () => {
  assert.equal(footnotePillMode({ free: 0, row: ROW, stack: STACK }), "inline");
  assert.equal(footnotePillMode({ free: 40, row: ROW, stack: STACK }), "inline");
  assert.equal(footnotePillMode({ free: -30, row: ROW, stack: STACK }), "inline");
});

test("a wider face (OpenDyslexic) needs more room for the same modes", () => {
  const wide = { row: 128, stack: 84 };
  assert.equal(footnotePillMode({ free: 130, ...wide }), "more");
  assert.equal(footnotePillMode({ free: 128 + PILL_OFFSET + PILL_EDGE, ...wide }), "row");
  assert.equal(footnotePillMode({ free: 100, ...wide }), "inline");
});

test("before anything is measured the fallbacks decide", () => {
  assert.equal(footnotePillMode({ free: ROW_FALLBACK + PILL_OFFSET + PILL_EDGE }), "row");
  assert.equal(footnotePillMode({ free: STACK_FALLBACK + PILL_OFFSET + PILL_EDGE }), "more");
  assert.equal(footnotePillMode({ free: 20 }), "inline");
});

test("a measured width of zero or less is treated as zero, not as room", () => {
  assert.equal(footnotePillMode({ free: 5, row: -10, stack: -10 }), "inline");
});
