import test from "node:test";
import assert from "node:assert/strict";
import { MAX_SPLIT, MIN_SPLIT, clampSplit, splitFromPointer } from "../src/lib/desk-greek-split.mjs";

test("a share stays between a quarter and three quarters", () => {
  assert.equal(clampSplit(0.5), 0.5);
  assert.equal(clampSplit(0), MIN_SPLIT);
  assert.equal(clampSplit(1), MAX_SPLIT);
  assert.equal(clampSplit(0.25), 0.25);
  assert.equal(clampSplit(0.75), 0.75);
});

test("something that is not a number is no share", () => {
  for (const bad of [null, undefined, NaN, Infinity, "0.5"]) assert.equal(clampSplit(bad), null);
});

test("the entry's share is what lies below the pointer", () => {
  const room = { top: 100, bottom: 500 };
  assert.equal(splitFromPointer({ ...room, y: 300 }), 0.5);
  assert.equal(splitFromPointer({ ...room, y: 200 }), 0.75);
  assert.equal(splitFromPointer({ ...room, y: 400 }), 0.25);
});

test("dragging past either end stops at the bound", () => {
  const room = { top: 100, bottom: 500 };
  assert.equal(splitFromPointer({ ...room, y: 0 }), MAX_SPLIT);
  assert.equal(splitFromPointer({ ...room, y: 900 }), MIN_SPLIT);
});

test("no room, no share", () => {
  assert.equal(splitFromPointer({ y: 5, top: 10, bottom: 10 }), null);
  assert.equal(splitFromPointer({ y: 5, top: 10, bottom: 0 }), null);
});
