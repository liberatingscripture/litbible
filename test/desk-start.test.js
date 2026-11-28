import { test } from "node:test";
import assert from "node:assert/strict";
import { START_CHOICES, shownStartChoices, startChoice, startState } from "../src/lib/desk-start.mjs";

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

// "Show the Notebook" left the Display tray (DI-16): the place line's
// Notebook button opens the panel, so a stored "off" is read as shown, and
// no reader is left with the Notebook hidden and no switch to bring it back.
test("a stored Show the Notebook off is read as shown: the start choice decides", () => {
  assert.deepEqual(startState(from({ "lit-desk-show": "off" })), { open: true, minimized: true });
  assert.deepEqual(startState(from({ "lit-desk-show": "off", "lit-desk-start": "open" })), { open: true, minimized: false });
  assert.deepEqual(startState(from({ "lit-desk-show": "off", "lit-desk-start": "min" })), { open: true, minimized: true });
  assert.equal(startState(from({ "lit-desk-show": "off", "lit-desk-start": "closed" })).open, false);
  assert.equal(startState(from({ "lit-desk-show": "off", "lit-desk-panel": "closed" })).open, false);
});

// All settings (NB-25): "When a page opens, the Notebook panel is" Open,
// Minimized, or As I left it, in that order. A reader who chose "Closed"
// before the Notebook lost its Close keeps it, and sees it offered.
test("All settings offers Open, Minimized, and As I left it, and Closed only to a reader who has it", () => {
  const labels = (current) => shownStartChoices(current).map((c) => c.label);
  assert.deepEqual(labels("left"), ["Open", "Minimized", "As I left it"]);
  assert.deepEqual(labels("open"), ["Open", "Minimized", "As I left it"]);
  assert.deepEqual(labels("min"), ["Open", "Minimized", "As I left it"]);
  assert.deepEqual(labels("closed"), ["Open", "Minimized", "As I left it", "Closed"]);
  // Every stored value has a choice to show it, so the page never shows none chosen.
  for (const stored of ["open", "min", "closed", null, "sideways"]) {
    const current = startChoice(from(stored == null ? {} : { "lit-desk-start": stored }));
    assert.ok(shownStartChoices(current).some((c) => c.value === current), String(stored));
  }
  assert.deepEqual(START_CHOICES.map((c) => c.value).sort(), ["closed", "left", "min", "open"]);
});
