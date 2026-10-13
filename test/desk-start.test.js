import { test } from "node:test";
import assert from "node:assert/strict";
import { startChoice, startState } from "../src/lib/desk-start.mjs";

const from = (stored) => (key) => (key in stored ? stored[key] : null);

test("with nothing stored the notebook starts open and minimized", () => {
  assert.deepEqual(startState(from({})), { open: true, minimized: true });
});

test("as the reader left it: closed, or restored", () => {
  assert.deepEqual(startState(from({ "lit-desk-panel": "closed" })).open, false);
  assert.deepEqual(startState(from({ "lit-desk-min": "0" })), { open: true, minimized: false });
});

test("a chosen start wins over what the reader did last", () => {
  const left = { "lit-desk-panel": "closed", "lit-desk-min": "0" };
  assert.deepEqual(startState(from({ ...left, "lit-desk-start": "min" })), { open: true, minimized: true });
  assert.deepEqual(startState(from({ ...left, "lit-desk-start": "open" })), { open: true, minimized: false });
  assert.equal(startState(from({ "lit-desk-start": "closed" })).open, false);
});

test("an unknown choice reads as the default", () => {
  assert.equal(startChoice(from({ "lit-desk-start": "sideways" })), "left");
  assert.equal(startChoice(from({})), "left");
});
