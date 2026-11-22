// Radio buttons survive the print dialog (STUDY-DESK-FIXES.md, E216; BVJ,
// 2026-11-21). Edge clears every native radio about 100 ms after the dialog
// closes; src/scripts/print-radios.js puts them back. These tests play Edge's
// part (clear them after `afterprint`) and check what the page shows.

import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { resetDom } from "./helpers/browser-env.mjs";

await import("../src/scripts/print-radios.js");

const radio = (name, value, checked, parent = document.body) => {
  const input = document.createElement("input");
  input.type = "radio";
  input.name = name;
  input.value = value;
  input.checked = checked;
  parent.append(input);
  return input;
};

/** The Sheets toolbar's two groups, Leader and US Letter chosen. */
function toolbar() {
  const bar = document.createElement("div");
  document.body.append(bar);
  return {
    leader: radio("sheet-copy", "leader", true, bar),
    participant: radio("sheet-copy", "participant", false, bar),
    letter: radio("sheet-paper", "letter", true, bar),
    a4: radio("sheet-paper", "a4", false, bar),
  };
}

const print = () => window.dispatchEvent(new Event("beforeprint"));
const printed = () => window.dispatchEvent(new Event("afterprint"));
const clearAll = () => document.querySelectorAll('input[type="radio"]').forEach((r) => { r.checked = false; });
const state = (t) => [t.leader, t.participant, t.letter, t.a4].map((r) => r.checked);

beforeEach(() => {
  resetDom();
  mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
});
afterEach(() => {
  // Let any restoring run out, so one test's timer never reaches the next.
  mock.timers.tick(5000);
  mock.timers.reset();
});

test("a radio the browser cleared after printing is checked again", () => {
  const t = toolbar();
  print();
  printed();
  clearAll(); // Edge, a moment after afterprint
  assert.deepEqual(state(t), [false, false, false, false]);
  mock.timers.tick(100);
  assert.deepEqual(state(t), [true, false, true, false]);
});

test("it holds whenever in the next seconds the browser clears them", () => {
  const t = toolbar();
  print();
  printed();
  mock.timers.tick(1500);
  clearAll();
  mock.timers.tick(100);
  assert.deepEqual(state(t), [true, false, true, false]);
});

test("a choice the reader makes after printing is kept", () => {
  const t = toolbar();
  print();
  printed();
  clearAll();
  t.participant.checked = true; // the reader's click, before the next tick
  mock.timers.tick(300);
  assert.deepEqual(state(t), [false, true, true, false]);
});

test("a radio's own page redrawn meanwhile is left alone", () => {
  const t = toolbar();
  print();
  printed();
  clearAll();
  t.leader.parentElement.remove();
  assert.doesNotThrow(() => mock.timers.tick(300));
  assert.equal(document.querySelectorAll('input[type="radio"]').length, 0);
});

test("a group with nothing checked before printing stays that way", () => {
  const none = [radio("lit-size", "s", false), radio("lit-size", "m", false)];
  print();
  printed();
  mock.timers.tick(300);
  assert.deepEqual(none.map((r) => r.checked), [false, false]);
});

test("the two radios of one name in two forms are two groups", () => {
  const a = document.createElement("form");
  const b = document.createElement("form");
  document.body.append(a, b);
  const first = radio("copy", "x", true, a);
  const second = radio("copy", "x", true, b);
  print();
  printed();
  clearAll();
  mock.timers.tick(100);
  assert.deepEqual([first.checked, second.checked], [true, true]);
});

test("it stops after a few seconds and sets nothing then", () => {
  const t = toolbar();
  print();
  printed();
  mock.timers.tick(3500);
  clearAll();
  mock.timers.tick(500);
  assert.deepEqual(state(t), [false, false, false, false]);
});

test("a second print holds what is checked then, not what was before", () => {
  const t = toolbar();
  print();
  printed();
  t.participant.checked = true;
  mock.timers.tick(200);
  print();
  printed();
  clearAll();
  mock.timers.tick(100);
  assert.deepEqual(state(t), [false, true, true, false]);
});

test("an afterprint with no beforeprint sets nothing", () => {
  const t = toolbar();
  clearAll();
  printed();
  mock.timers.tick(300);
  assert.deepEqual(state(t), [false, false, false, false]);
});
