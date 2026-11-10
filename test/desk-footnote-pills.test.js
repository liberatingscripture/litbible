// test/desk-footnote-pills.test.js
//
// src/lib/desk-footnote-pills.mjs: whether a footnote's Pin sits in the left
// margin or on the note's line (E49; one pill since E79).

import { test } from "node:test";
import assert from "node:assert/strict";

import { PILL_EDGE, PILL_OFFSET, PIN_FALLBACK, footnotePillMode } from "../src/lib/desk-footnote-pills.mjs";

const PIN = 56;

test("a wide margin: Pin in the margin", () => {
  assert.equal(footnotePillMode({ free: 300, width: PIN }), "row");
});

test("a margin that holds Pin to the pixel, and one short of it", () => {
  const need = PIN + PILL_OFFSET + PILL_EDGE;
  assert.equal(footnotePillMode({ free: need, width: PIN }), "row");
  assert.equal(footnotePillMode({ free: need - 1, width: PIN }), "inline");
});

test("no margin: Pin stays on the note's line", () => {
  assert.equal(footnotePillMode({ free: 0, width: PIN }), "inline");
  assert.equal(footnotePillMode({ free: 40, width: PIN }), "inline");
  assert.equal(footnotePillMode({ free: -30, width: PIN }), "inline");
});

test("a wider face (OpenDyslexic) needs more room", () => {
  assert.equal(footnotePillMode({ free: 90, width: 84 }), "inline");
  assert.equal(footnotePillMode({ free: 84 + PILL_OFFSET + PILL_EDGE, width: 84 }), "row");
});

test("before anything is measured the fallback decides", () => {
  assert.equal(footnotePillMode({ free: PIN_FALLBACK + PILL_OFFSET + PILL_EDGE }), "row");
  assert.equal(footnotePillMode({ free: PIN_FALLBACK + PILL_OFFSET + PILL_EDGE - 1 }), "inline");
});

test("a measured width of zero or less is treated as zero, not as room", () => {
  assert.equal(footnotePillMode({ free: 5, width: -10 }), "inline");
  assert.equal(footnotePillMode({ free: PILL_OFFSET + PILL_EDGE, width: -10 }), "row");
});

test("there is no third mode: the ⋯ fold went with Add a note (E79)", () => {
  for (let free = -50; free <= 400; free += 7) {
    assert.ok(["row", "inline"].includes(footnotePillMode({ free, width: PIN })));
  }
});
