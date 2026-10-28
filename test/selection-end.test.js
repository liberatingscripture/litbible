// Tests for src/lib/selection-end.mjs: where a mouse selection ends when the
// drag finishes off the text (STUDY-DESK-AUDIT-1.md, BA23).
import { test } from "node:test";
import assert from "node:assert/strict";
import { pullBackSelectionEnd } from "../src/lib/selection-end.mjs";

const text = { textTop: 100, textBottom: 2000 };

test("an end inside the text is left where the browser put it", () => {
  assert.equal(pullBackSelectionEnd({ ...text, endInText: true, forward: true, pointerY: 500 }), false);
});

test("a drag down that ends over a window drawn on the text pulls back (BA23)", () => {
  assert.equal(pullBackSelectionEnd({ ...text, endInText: false, forward: true, pointerY: 500 }), true);
  assert.equal(pullBackSelectionEnd({ ...text, endInText: false, forward: true, pointerY: 2000 }), true);
});

test("a drag down past the text's end still runs to the end", () => {
  assert.equal(pullBackSelectionEnd({ ...text, endInText: false, forward: true, pointerY: 2001 }), false);
});

test("a drag up pulls back over the text and runs to the start above it", () => {
  assert.equal(pullBackSelectionEnd({ ...text, endInText: false, forward: false, pointerY: 300 }), true);
  assert.equal(pullBackSelectionEnd({ ...text, endInText: false, forward: false, pointerY: 99 }), false);
});
