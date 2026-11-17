// Site 2.0's page frame: which item of the contents rail is current
// (src/scripts/v2-frame.js). The rule is pure, so it is tested without a page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { currentIndex } from "../src/scripts/v2-frame.js";

test("no sections, no current item", () => {
  assert.equal(currentIndex([], 100), -1);
});

test("before the first heading reaches the line, the first is current", () => {
  assert.equal(currentIndex([400, 900, 1500], 100), 0);
});

test("the last heading at or above the line is current", () => {
  assert.equal(currentIndex([-800, 100, 700], 100), 1);
  assert.equal(currentIndex([-800, 101, 700], 100), 0);
  assert.equal(currentIndex([-2000, -900, 40], 100), 2);
});

test("at the end of the page the last section is current, however short", () => {
  assert.equal(currentIndex([-1500, -200, 500], 100, true), 2);
});
