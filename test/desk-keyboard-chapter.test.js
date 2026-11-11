// ← → and [ ] on /desk (keyboard-shortcuts.js): the page has no Previous/Next
// links, so the keys ask the desk with a `lit:desk-chapter` event, which
// desk-page.js answers by stepping the pane being read. Driven in a browser DOM.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "./helpers/browser-env.mjs";

await import("../src/scripts/keyboard-shortcuts.js");

const root = document.documentElement;
let heard;
let answer;
document.addEventListener("lit:desk-chapter", (e) => {
  heard.push(e.detail.step);
  if (answer) e.preventDefault();
});

beforeEach(() => {
  heard = [];
  answer = true;
  document.body.innerHTML = "";
  root.removeAttribute("data-desk");
  localStorage.removeItem("lit-shortcuts");
});

/** Press a key on the page; true when a shortcut took it. */
function press(key, init = {}, target = document.body) {
  const ev = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(ev);
  return ev.defaultPrevented;
}

test("with the desk on and no Previous/Next on the page, the arrows and brackets ask the desk", () => {
  root.setAttribute("data-desk", "on");
  assert.equal(press("ArrowRight"), true);
  assert.equal(press("ArrowLeft"), true);
  assert.equal(press("]"), true);
  assert.equal(press("["), true);
  assert.deepEqual(heard, [1, -1, 1, -1]);
});

test("a key the desk doesn't take is left to the browser", () => {
  root.setAttribute("data-desk", "on");
  answer = false;
  assert.equal(press("ArrowRight"), false);
  assert.deepEqual(heard, [1]);
});

test("without the desk, nothing is asked", () => {
  assert.equal(press("ArrowRight"), false);
  assert.deepEqual(heard, []);
});

test("Chapter View's own Previous/Next win, and the desk isn't asked", () => {
  root.setAttribute("data-desk", "on");
  document.body.innerHTML = `<nav class="chapter-nav"><a rel="next" href="#next">Next</a></nav>`;
  let clicked = 0;
  document.querySelector("a").addEventListener("click", (e) => { e.preventDefault(); clicked++; });
  assert.equal(press("ArrowRight"), true);
  assert.equal(clicked, 1);
  assert.deepEqual(heard, []);
});

test("the keys stand down in a field, with a modifier or Shift, and when switched off", () => {
  root.setAttribute("data-desk", "on");
  const field = document.createElement("input");
  document.body.append(field);
  assert.equal(press("ArrowRight", {}, field), false);
  assert.equal(press("ArrowRight", { altKey: true }), false);
  assert.equal(press("ArrowRight", { shiftKey: true }), false);
  localStorage.setItem("lit-shortcuts", "off");
  assert.equal(press("ArrowRight"), false);
  assert.deepEqual(heard, []);
});
