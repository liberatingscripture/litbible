// Site 2.0's /search page links (src/scripts/v2-search.js): "Always showing
// five, when there are five or more pages of results" (BVJ, 2026-11-16).
// search.js uses this rule only with the restyle's stamp; without it, its own
// buildPageRange runs unchanged.

import { test } from "node:test";
import assert from "node:assert/strict";
import { v2PageRange, v2Search } from "../src/scripts/v2-search.js";

const nums = (list) => list.filter((x) => x !== "…");

test("under five pages, every page and no gap", () => {
  assert.deepEqual(v2PageRange(1, 1), [1]);
  for (const c of [1, 2, 4]) assert.deepEqual(v2PageRange(c, 4), [1, 2, 3, 4]);
  assert.deepEqual(v2PageRange(1, 0), []);
});

test("five pages: all five", () => {
  for (const c of [1, 3, 5]) assert.deepEqual(v2PageRange(c, 5), [1, 2, 3, 4, 5]);
});

test("six pages: five numbers and one gap", () => {
  assert.deepEqual(v2PageRange(1, 6), [1, 2, 3, "…", 5, 6]);
  assert.deepEqual(v2PageRange(3, 6), [1, 2, 3, 4, "…", 6]);
  assert.deepEqual(v2PageRange(4, 6), [1, "…", 3, 4, 5, 6]);
  assert.deepEqual(v2PageRange(6, 6), [1, 2, "…", 4, 5, 6]);
});

test("twelve pages: the first, a middle, and the last page", () => {
  assert.deepEqual(v2PageRange(1, 12), [1, 2, 3, "…", 11, 12]);
  assert.deepEqual(v2PageRange(2, 12), [1, 2, 3, "…", 11, 12]);
  assert.deepEqual(v2PageRange(6, 12), [1, "…", 5, 6, 7, "…", 12]);
  assert.deepEqual(v2PageRange(3, 12), [1, 2, 3, 4, "…", 12]);
  assert.deepEqual(v2PageRange(10, 12), [1, "…", 9, 10, 11, 12]);
  assert.deepEqual(v2PageRange(12, 12), [1, 2, "…", 10, 11, 12]);
});

test("from five pages on, always exactly five numbers, the current one among them, in order", () => {
  for (let total = 5; total <= 40; total++) {
    for (let c = 1; c <= total; c++) {
      const list = v2PageRange(c, total);
      const n = nums(list);
      assert.equal(n.length, 5, `${c} of ${total}`);
      assert.ok(n.includes(c), `${c} of ${total} shows the current page`);
      assert.equal(n[0], 1);
      assert.equal(n[4], total);
      for (let i = 1; i < list.length; i++) {
        if (list[i] === "…") {
          assert.notEqual(list[i - 1], "…");
          assert.ok(list[i + 1] - list[i - 1] > 1, "a gap stands for pages left out");
        } else if (list[i - 1] !== "…") {
          assert.equal(list[i], list[i - 1] + 1, "numbers side by side are consecutive");
        }
      }
    }
  }
});

test("a page outside the range is held to it", () => {
  assert.deepEqual(v2PageRange(0, 12), v2PageRange(1, 12));
  assert.deepEqual(v2PageRange(99, 12), v2PageRange(12, 12));
});

test("without a document (and so without the stamp) the 2.0 look is off", () => {
  assert.equal(v2Search(), false);
});
