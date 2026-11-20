// E189 (BVJ, 2026-11-19: "they use different approaches. Probably best to
// consolidate them"): every line the desk lets a reader drag answers the same
// way, through `wireLine` (line-menu.js). The margin lines, the floating
// Notebook's edge, the Greek tab's line and /desk's pane lines all use it.
// Driven in a browser DOM, with the pane lines' pure rules (`lineWords`,
// `lineBounds`, `isEven`) tested beside it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom, window } from "./helpers/browser-env.mjs";

const { wireLine, CLICK_SLOP } = await import("../src/scripts/desk/line-menu.js");
const { HANDLE, isEven, lineBounds, lineWords, originalLayout, resize } = await import("../src/lib/desk-layout.mjs");

const PointerEvent = window.PointerEvent ?? window.MouseEvent;

function line(attrs = {}) {
  const h = document.createElement("div");
  h.setAttribute("role", "separator");
  h.tabIndex = 0;
  h.setPointerCapture = () => {};
  for (const [k, v] of Object.entries(attrs)) h.setAttribute(k, v);
  document.body.append(h);
  return h;
}

function key(target, k, init = {}) {
  const ev = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(ev);
  return ev.defaultPrevented;
}

function pointer(target, type, x, y) {
  target.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true }));
}

/** A line wired with every call written down. */
function wired(along) {
  const h = line({ "aria-valuenow": "50", "aria-valuemin": "20", "aria-valuemax": "80", "aria-valuetext": "Half and half" });
  const calls = [];
  wireLine(h, {
    along,
    draggingClass: "dragging",
    begin: (e) => ({ x: e.clientX }),
    drag: (s, ev) => calls.push(["drag", ev.clientX - s.x, h.classList.contains("dragging")]),
    end: (_, moved) => calls.push(["end", moved]),
    nudge: (dir, big) => calls.push(["nudge", dir, big]),
    toEnd: (dir) => calls.push(["toEnd", dir]),
    menu: () => ({
      label: "Sizes",
      more: "More",
      less: "Less",
      step: (dir) => calls.push(["step", dir]),
      reset: { label: "Even", run: () => calls.push(["reset"]) },
    }),
  });
  return { h, calls };
}

const menuOf = (h) => document.getElementById(h.getAttribute("aria-controls"));

test("a line running down the page: Left and Right step it, Shift a bigger step, Home and End to its ends", () => {
  resetDom();
  const { h, calls } = wired("vertical");
  assert.equal(key(h, "ArrowRight"), true);
  assert.equal(key(h, "ArrowLeft", { shiftKey: true }), true);
  assert.equal(key(h, "Home"), true);
  assert.equal(key(h, "End"), true);
  // Up and Down run along it, so they are left alone; so is a key with Ctrl.
  assert.equal(key(h, "ArrowUp"), false);
  assert.equal(key(h, "ArrowRight", { ctrlKey: true }), false);
  assert.deepEqual(calls, [["nudge", 1, false], ["nudge", -1, true], ["toEnd", -1], ["toEnd", 1]]);
});

test("a line running across: Up and Down step it", () => {
  resetDom();
  const { h, calls } = wired("horizontal");
  key(h, "ArrowDown");
  key(h, "ArrowUp", { shiftKey: true });
  assert.equal(key(h, "ArrowLeft"), false);
  assert.deepEqual(calls, [["nudge", 1, false], ["nudge", -1, true]]);
});

test("Enter, Space or a click opens the line's menu; a drag doesn't, and says it moved", () => {
  resetDom();
  const { h, calls } = wired("vertical");
  key(h, "Enter");
  assert.equal(menuOf(h)?.getAttribute("aria-label"), "Sizes");
  key(h, "Enter");
  assert.equal(h.hasAttribute("aria-controls"), false, "a second Enter closes it");
  key(h, " ");
  assert.ok(menuOf(h), "Space opens it");
  key(h, " ");

  // A press released without moving is a click.
  pointer(h, "pointerdown", 100, 100);
  pointer(h, "pointermove", 100 + CLICK_SLOP - 1, 100);
  pointer(h, "pointerup", 100 + CLICK_SLOP - 1, 100);
  assert.ok(menuOf(h), "the click opened it");
  assert.deepEqual(calls.at(-1), ["end", false]);
  const open = menuOf(h);
  const items = [...open.querySelectorAll('[role="menuitem"]')].map((b) => b.textContent);
  assert.deepEqual(items, ["More", "Less", "Even"]);

  // A drag puts the menu away, carries the dragging class, and opens nothing.
  calls.length = 0;
  pointer(h, "pointerdown", 100, 100);
  pointer(h, "pointermove", 130, 100);
  pointer(h, "pointerup", 130, 100);
  assert.equal(open.isConnected, false);
  assert.equal(h.hasAttribute("aria-controls"), false);
  assert.deepEqual(calls, [["drag", 30, true], ["end", true]]);
  assert.equal(h.classList.contains("dragging"), false, "the class comes off at the end");
});

test("the grip follows the pointer along the line, and sits mid-line on focus", () => {
  resetDom();
  const { h } = wired("vertical");
  h.getBoundingClientRect = () => ({ left: 0, right: 12, top: 100, bottom: 500, width: 12, height: 400 });
  pointer(h, "pointermove", 4, 340);
  assert.equal(h.style.getPropertyValue("--grip-y"), "240px");
  h.dispatchEvent(new FocusEvent("focus"));
  assert.equal(h.style.getPropertyValue("--grip-y"), "200px");
});

test("after a step the menu says what the line came to", async () => {
  resetDom();
  const { h, calls } = wired("vertical");
  key(h, "Enter");
  menuOf(h).querySelector('[role="menuitem"]').click();
  assert.deepEqual(calls.at(-1), ["step", 1]);
  await settle(10);
  await settle(80);
  const live = document.getElementById("deskLineSaid");
  assert.equal(live?.getAttribute("role"), "status");
  assert.equal(live.textContent, "Half and half");
});

// ---- the floating Notebook's edge, driven ----------------------------------

test("the floating Notebook's edge: Home widens it to the most, End narrows it to the least, Enter opens its menu", async () => {
  resetDom();
  sessionStorage.clear();
  const { createFloatResize } = await import("../src/scripts/desk/float-resize.js");
  const { keptFloatWidth } = await import("../src/scripts/desk/widths.js");
  const { floatBounds } = await import("../src/lib/desk-margin.mjs");
  const panel = document.createElement("div");
  document.body.append(panel);
  panel.getBoundingClientRect = () => ({ left: 600, right: 920, top: 0, bottom: 800, width: 320, height: 800 });
  const edge = createFloatResize(panel, () => {});
  edge.update({ visible: true, width: 320, viewport: 1000 });
  const handle = panel.querySelector(".desk-panel__edge");
  const { min, max } = floatBounds(1000);

  key(handle, "Home");
  assert.equal(keptFloatWidth(), max);
  key(handle, "End");
  assert.equal(keptFloatWidth(), min);
  key(handle, "ArrowLeft");
  assert.equal(keptFloatWidth(), 336, "Left widens it a step from where it is drawn");

  key(handle, "Enter");
  const items = [...menuOf(handle).querySelectorAll('[role="menuitem"]')].map((b) => b.textContent);
  assert.deepEqual(items, ["Wider Notebook", "Narrower Notebook", "Reset widths"]);
});

// ---- the pane lines' rules -------------------------------------------------

const leaf = (id, kind) => ({ pane: { id, kind, pin: null } });
const cols = (sizes, ...children) => ({ split: "columns", sizes, children });
const rows = (sizes, ...children) => ({ split: "rows", sizes, children });

test("lineWords names each step by what grows", () => {
  assert.deepEqual(lineWords(cols([0.6, 0.4], leaf("a", "lit"), leaf("b", "mine")), 0), {
    label: "Pane widths",
    more: "Make the LIT wider",
    less: "Make My Notes wider",
    reset: "Make the columns the same width",
  });
  // A stack is named by all it holds.
  const stack = cols([0.5, 0.5], leaf("a", "lit"), rows([0.5, 0.5], leaf("b", "mine"), leaf("c", "greek")));
  assert.equal(lineWords(stack, 0).less, "Make My Notes and Greek wider");
  // Rows grow taller.
  const two = rows([0.5, 0.5], leaf("a", "verse"), leaf("b", "footnotes"));
  assert.deepEqual(lineWords(two, 0), {
    label: "Pane heights",
    more: "Make This verse taller",
    less: "Make Footnotes taller",
    reset: "Make the rows the same height",
  });
});

test("lineWords names the sides where both hold the same kinds", () => {
  const twins = cols([0.5, 0.5], leaf("a", "lit"), leaf("b", "lit"));
  assert.equal(lineWords(twins, 0).more, "Make the left side wider");
  assert.equal(lineWords(twins, 0).less, "Make the right side wider");
  const stacked = rows([0.5, 0.5], leaf("a", "lit"), leaf("b", "lit"));
  assert.equal(lineWords(stacked, 0).more, "Make the top taller");
  assert.equal(lineWords(stacked, 0).less, "Make the bottom taller");
});

test("lineBounds is where resize stops the line", () => {
  const l = originalLayout();
  const length = 1000 + HANDLE;
  const b = lineBounds(l.root, 0, length);
  assert.ok(Math.abs(b.min - 0.28) < 1e-9 && Math.abs(b.max - 0.72) < 1e-9);
  assert.ok(Math.abs(resize(l, [], 0, -1e6, length).root.sizes[0] - b.min) < 1e-9);
  assert.ok(Math.abs(resize(l, [], 0, 1e6, length).root.sizes[0] - b.max) < 1e-9);
  // Too little room for both minimums: the line has nowhere to go.
  const tight = lineBounds(l.root, 0, 400 + HANDLE);
  assert.equal(tight.min, tight.max);
  // No line there, or nothing measured.
  assert.equal(lineBounds(l.root, 1, length), null);
  assert.equal(lineBounds(l.root, 0, 0), null);
  assert.equal(lineBounds(leaf("a", "lit"), 0, length), null);
});

test("isEven tells a split already shared evenly", () => {
  assert.equal(isEven(cols([0.5, 0.5], leaf("a", "lit"), leaf("b", "mine"))), true);
  assert.equal(isEven(cols([1 / 3, 1 / 3, 1 / 3], leaf("a", "lit"), leaf("b", "mine"), leaf("c", "verse"))), true);
  assert.equal(isEven(cols([0.6, 0.4], leaf("a", "lit"), leaf("b", "mine"))), false);
  assert.equal(isEven(leaf("a", "lit")), true);
});
