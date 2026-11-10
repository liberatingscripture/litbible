// A floating window closed mid-drag must not report a move (audit BA116).
// float-window.js is client code, so it runs here against a minimal stub DOM:
// just enough of document, window listeners, and elements for the module.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Window-level listeners, by type.
let winListeners;
let body;

class StubElement {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.parent = null;
    this.attrs = {};
    this.listeners = {};
    this.style = {};
    this.classes = new Set();
    this.rect = { left: 100, top: 100, width: 200, height: 100 };
    this.classList = {
      add: (c) => this.classes.add(c),
      remove: (c) => this.classes.delete(c),
    };
  }
  set className(v) { this.classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get className() { return [...this.classes].join(" "); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  append(...kids) { for (const k of kids) { k.parent = this; this.children.push(k); } }
  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
  }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  dispatch(type, ev) { for (const fn of this.listeners[type] ?? []) fn(ev); }
  getBoundingClientRect() {
    // Position follows style, as for a fixed-position element; a removed
    // element measures as nothing, as in a browser.
    if (!this.parent) return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
    const left = parseFloat(this.style.left) || this.rect.left;
    const top = parseFloat(this.style.top) || this.rect.top;
    return { left, top, width: this.rect.width, height: this.rect.height, right: left + this.rect.width, bottom: top + this.rect.height };
  }
  closest() { return null; }
  focus() {}
}

function fire(type, ev = {}) {
  for (const fn of [...(winListeners.get(type) ?? [])]) fn(ev);
}
const count = (type) => (winListeners.get(type) ?? new Set()).size;

globalThis.innerWidth = 1000;
globalThis.innerHeight = 800;
globalThis.addEventListener = (type, fn) => {
  if (!winListeners.has(type)) winListeners.set(type, new Set());
  winListeners.get(type).add(fn);
};
globalThis.removeEventListener = (type, fn) => winListeners.get(type)?.delete(fn);
globalThis.document = {
  createElement: (tag) => new StubElement(tag),
  get body() { return body; },
};

const { createFloatWindow } = await import("../src/scripts/float-window.js");

beforeEach(() => {
  winListeners = new Map();
  body = new StubElement("body");
});

function make() {
  const moved = [];
  const win = createFloatWindow({
    heading: "Test",
    title: "A window",
    place: (el) => { el.style.left = "100px"; el.style.top = "100px"; },
    onMoved: (at) => moved.push(at),
  });
  const header = win.el.children[0];
  return { win, header, moved };
}

function startDrag(header) {
  header.dispatch("pointerdown", {
    button: 0, target: header, clientX: 150, clientY: 110, preventDefault() {},
  });
}

function moveTo(win, x, y) {
  fire("pointermove", { clientX: x, clientY: y });
}

test("a normal drag reports the new place once", () => {
  const { win, header, moved } = make();
  win.show();
  startDrag(header);
  assert.ok(win.el.classes.has("lit-panel--dragging"));
  moveTo(win, 250, 210);
  fire("pointerup");
  assert.deepEqual(moved, [{ left: 200, top: 200 }]);
  assert.ok(!win.el.classes.has("lit-panel--dragging"));
  assert.equal(count("pointermove") + count("pointerup") + count("pointercancel"), 0);
});

test("closing mid-drag ends the drag and reports nothing", () => {
  const { win, header, moved } = make();
  win.show();
  startDrag(header);
  moveTo(win, 250, 210);
  win.close();
  assert.ok(!win.el.classes.has("lit-panel--dragging"));
  assert.equal(count("pointermove") + count("pointerup") + count("pointercancel"), 0);
  fire("pointerup");
  assert.deepEqual(moved, []);
  assert.equal(win.isOpen(), false);
});

test("Escape mid-drag does the same", () => {
  const { win, header, moved } = make();
  win.show();
  startDrag(header);
  moveTo(win, 250, 210);
  win.el.dispatch("keydown", { key: "Escape", preventDefault() {}, stopPropagation() {} });
  fire("pointerup");
  assert.deepEqual(moved, []);
  assert.equal(count("pointermove") + count("pointerup") + count("pointercancel"), 0);
});

test("the window opens and drags again after being closed mid-drag", () => {
  const { win, header, moved } = make();
  win.show();
  startDrag(header);
  moveTo(win, 250, 210);
  win.close();
  fire("pointerup");

  win.show();
  assert.equal(win.isOpen(), true);
  assert.equal(count("resize"), 1);
  startDrag(header);
  moveTo(win, 160, 130);
  fire("pointerup");
  assert.deepEqual(moved, [{ left: 110, top: 120 }]);
});

test("GK6-8: Escape while composing leaves the window open", () => {
  const { win } = make();
  win.show();
  win.el.dispatch("keydown", { key: "Escape", isComposing: true, preventDefault() {}, stopPropagation() {} });
  assert.equal(win.isOpen(), true);
  win.el.dispatch("keydown", { key: "Escape", preventDefault() {}, stopPropagation() {} });
  assert.equal(win.isOpen(), false);
});

// XA8-1: the grip is a button, "Move to the other side", for a reader who
// can click but not drag, or has no pointer.
const grip = (header) => header.children[0];
const key = (k, shiftKey = false) => ({ key: k, shiftKey, preventDefault() {} });

test("XA8-1: the grip is a named button", () => {
  const { header } = make();
  assert.equal(grip(header).tag, "button");
  assert.equal(grip(header).attrs["aria-label"], "Move to the other side");
});

test("XA8-1: a click on the grip moves the window across, at the same height", () => {
  const { win, header, moved } = make();
  win.show();
  // At left 100 (width 200) in a 1000px window it is on the left side.
  grip(header).dispatch("click", {});
  assert.deepEqual(moved, [{ left: 792, top: 100 }]);
  grip(header).dispatch("click", {});
  assert.deepEqual(moved.at(-1), { left: 8, top: 100 });
});

test("XA8-1: a drag that ends on the grip is not also its click", () => {
  const { win, header, moved } = make();
  win.show();
  startDrag(header);
  moveTo(win, 250, 210);
  fire("pointerup");
  grip(header).dispatch("click", {});
  assert.deepEqual(moved, [{ left: 200, top: 200 }]);
});

test("XA8-1: a press that barely moves is a click, not a drag", () => {
  const { win, header, moved } = make();
  win.show();
  startDrag(header);
  moveTo(win, 152, 111);
  fire("pointerup");
  assert.deepEqual(moved, [], "no drag was reported");
  grip(header).dispatch("click", {});
  assert.deepEqual(moved, [{ left: 792, top: 100 }]);
});

test("XA8-1: the grip's arrow keys move the window, Shift by more", () => {
  const { win, header, moved } = make();
  win.show();
  grip(header).dispatch("keydown", key("ArrowDown"));
  assert.deepEqual(moved.at(-1), { left: 100, top: 116 });
  grip(header).dispatch("keydown", key("ArrowRight", true));
  assert.deepEqual(moved.at(-1), { left: 164, top: 116 });
  grip(header).dispatch("keydown", key("Tab"));
  assert.equal(moved.length, 2, "other keys pass");
});
