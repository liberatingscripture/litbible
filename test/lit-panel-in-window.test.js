// A panel pinned to the screen stays inside the window as it grows (BVJ,
// 2026-11-19: the Study Desk tour's verse menu ran past the window's foot,
// its "Add to collection" row cut off). The Study Desk adds rows to the verse
// menu after showPanel has measured it, and a pinned panel can't be scrolled
// to, so lit-panel.js watches its size and moves it up by what runs over.
// happy-dom has no layout, so the panel's box follows its `top` and a height
// the test sets, and the watcher is a stand-in the test calls.

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { resetDom } from "./helpers/browser-env.mjs";

const { showPanel, closePanel } = await import("../src/scripts/lit-panel.js");

let watchers;
const realObserver = globalThis.ResizeObserver;

beforeEach(() => {
  resetDom();
  watchers = [];
  globalThis.ResizeObserver = class {
    constructor(fn) {
      this.fn = fn;
      this.off = false;
      watchers.push(this);
    }
    observe() {}
    disconnect() {
      this.off = true;
    }
  };
});

afterEach(() => {
  closePanel({ force: true });
  globalThis.ResizeObserver = realObserver;
});

/** A verse number near the top of the window, inside a pane whose panels pin, or not. */
function verseNumber({ pinned = true } = {}) {
  const pane = document.createElement("div");
  if (pinned) pane.setAttribute("data-panels-pin", "");
  const sup = document.createElement("sup");
  pane.append(sup);
  document.body.append(pane);
  sup.getBoundingClientRect = () => ({ left: 100, right: 110, top: 200, bottom: 214, width: 10, height: 14, x: 100, y: 200 });
  return sup;
}

/** A panel `size.height` tall, its box drawn from its own `top`. */
function panelOf(size) {
  const el = document.createElement("div");
  Object.defineProperty(el, "offsetHeight", { get: () => size.height });
  Object.defineProperty(el, "offsetWidth", { get: () => 300 });
  el.getBoundingClientRect = () => {
    const top = parseFloat(el.style.top) || 0;
    return { top, bottom: top + size.height, left: 0, right: 300, width: 300, height: size.height, x: 0, y: top };
  };
  return el;
}

const grow = () => {
  for (const w of watchers) if (!w.off) w.fn([]);
};

test("a pinned menu that grows past the window's foot moves up by what runs over", () => {
  const size = { height: 300 };
  const el = showPanel(verseNumber(), panelOf(size), { sheet: false });
  assert.ok(el.classList.contains("lit-panel--pinned"));
  const placed = parseFloat(el.style.top);
  assert.equal(placed, 222, "placed below its verse number, where it fitted");

  // The notebook read, rows added: it now runs 60px past the window's foot, less the margin.
  size.height = innerHeight - placed + 48;
  grow();
  assert.equal(el.getBoundingClientRect().bottom, innerHeight - 12);

  // Growing within the window moves nothing.
  const top = el.style.top;
  size.height -= 20;
  grow();
  assert.equal(el.style.top, top);
});

test("a pinned panel taller than the window stops at the top margin, where its own max-height scrolls it", () => {
  const size = { height: 300 };
  const el = showPanel(verseNumber(), panelOf(size), { sheet: false });
  size.height = innerHeight + 200;
  grow();
  assert.equal(el.style.top, "12px");
});

test("a panel that scrolls with the page, or one being dragged, is left where it is", () => {
  const size = { height: 300 };
  const loose = showPanel(verseNumber({ pinned: false }), panelOf(size), { sheet: false });
  assert.ok(!loose.classList.contains("lit-panel--pinned"));
  const top = loose.style.top;
  size.height = innerHeight;
  grow();
  assert.equal(loose.style.top, top);

  const dragSize = { height: 300 };
  const dragged = showPanel(verseNumber(), panelOf(dragSize), { sheet: false });
  dragged.classList.add("lit-panel--dragging");
  const at = dragged.style.top;
  dragSize.height = innerHeight;
  grow();
  assert.equal(dragged.style.top, at);
});

test("closing the panel stops watching it", () => {
  showPanel(verseNumber(), panelOf({ height: 300 }), { sheet: false });
  assert.equal(watchers.length, 1);
  closePanel();
  assert.equal(watchers[0].off, true);
});
