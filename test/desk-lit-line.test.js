// test/desk-lit-line.test.js
//
// indexAtLine (src/lib/desk-lit-text.mjs): which verse start the LIT pane's
// reading line has reached, read from the verses' own spans (E29), so the
// location field and keep() work with the verse numbers hidden.

import { test } from "node:test";
import assert from "node:assert/strict";
import { indexAtLine } from "../src/lib/desk-lit-text.mjs";

test("the last start at or above the line", () => {
  assert.equal(indexAtLine([10, 40, 70, 100], 75), 2);
  assert.equal(indexAtLine([10, 40, 70, 100], 70), 2);
  assert.equal(indexAtLine([10, 40, 70, 100], 500), 3);
});

test("none when the first start is below the line", () => {
  assert.equal(indexAtLine([10, 40], 5), -1);
  assert.equal(indexAtLine([], 5), -1);
});

test("two verses starting on one line: the later one", () => {
  assert.equal(indexAtLine([10, 32, 32, 60], 40), 2);
});

test("stops at the first start below the line, as the walk always did", () => {
  // A box out of order (a span measured oddly) past one below the line is not reached.
  assert.equal(indexAtLine([10, 50, 20], 30), 0);
});
