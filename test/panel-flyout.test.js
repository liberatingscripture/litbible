// test/panel-flyout.test.js
//
// panel-flyout.js (flyoutRow) under a stub DOM: the one flyout the reader tools'
// panels and the Study Desk's menus share (src/scripts/CLAUDE.md, "One set of
// actions, two ways in"). Audit 3, LG3-9. The stub has what the module touches
// and no more: attributes with reflected `hidden`, `disabled` and `id`; a focus
// that moves document.activeElement and fires a bubbling focusout; keydown that
// bubbles from the focused element and can be stopped; a fake window timer. It
// has no layout, so where the flyout is placed is not checked, and focus is
// only as real as the module needs.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const SEL = /^([a-z]*)((?::not\([^)]*\))*)$/i;

/** Enough of a selector for the module: a tag, and `:not([attr])` or `:not(:disabled)` clauses. */
function matchesSel(el, sel) {
  const m = SEL.exec(sel);
  if (!m) throw new Error(`panel-flyout stub: selector "${sel}" isn't supported`);
  if (m[1] && el.tagName !== m[1].toUpperCase()) return false;
  for (const [, inner] of m[2].matchAll(/:not\(([^)]*)\)/g)) {
    const attr = /^\[([\w-]+)\]$/.exec(inner);
    if (attr) {
      if (el.attrs.has(attr[1])) return false;
    } else if (inner === ":disabled") {
      if (el.disabled) return false;
    } else {
      throw new Error(`panel-flyout stub: :not(${inner}) isn't supported`);
    }
  }
  return true;
}

class El {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.attrs = new Map();
    this.children = [];
    this.parent = null;
    this.listeners = {};
    this.style = {};
    this.textContent = "";
    this.classes = new Set();
  }
  get className() { return [...this.classes].join(" "); }
  set className(v) { this.classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get classList() {
    return { add: (...c) => c.forEach((x) => this.classes.add(x)), contains: (c) => this.classes.has(c) };
  }
  get id() { return this.attrs.get("id") ?? ""; }
  set id(v) { this.attrs.set("id", String(v)); }
  get hidden() { return this.attrs.has("hidden"); }
  set hidden(v) { if (v) this.attrs.set("hidden", ""); else this.attrs.delete("hidden"); }
  get disabled() { return this.attrs.has("disabled"); }
  set disabled(v) { if (v) this.attrs.set("disabled", ""); else this.attrs.delete("disabled"); }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  append(...nodes) {
    for (const n of nodes) {
      if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1);
      n.parent = this;
      this.children.push(n);
    }
  }
  matches(sel) { return matchesSel(this, sel); }
  querySelectorAll(sel) {
    const out = [];
    const walk = (node) => {
      for (const c of node.children) {
        if (matchesSel(c, sel)) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
  contains(node) {
    for (let n = node; n; n = n.parent) if (n === this) return true;
    return false;
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 200, height: 40, right: 200, bottom: 40 };
  }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  /** An event aimed at this element only (pointerenter, click, pointerleave). */
  dispatch(type, ev = {}) {
    for (const fn of this.listeners[type] ?? []) fn({ target: this, relatedTarget: null, preventDefault() {}, ...ev });
  }
  /** An event that bubbles up from this element, as keydown and focusout do. */
  bubble(type, ev = {}) {
    const e = {
      target: this, relatedTarget: null, preventDefault() {},
      stopPropagation() { this.stopped = true; }, ...ev,
    };
    for (let n = this; n && !e.stopped; n = n.parent) for (const fn of n.listeners[type] ?? []) fn(e);
    return e;
  }
  focus() {
    const prev = doc.activeElement;
    if (prev === this) return;
    doc.activeElement = this;
    prev?.bubble("focusout", { relatedTarget: this });
  }
}

// The document the module reads: a body, the focused element, and listeners
// that a signal can remove (the module's away-listeners use one).
const doc = {
  body: null,
  activeElement: null,
  listeners: {},
  createElement: (tag) => new El(tag),
  addEventListener(type, fn, opts = {}) {
    (this.listeners[type] ??= new Set()).add(fn);
    opts.signal?.addEventListener("abort", () => this.listeners[type]?.delete(fn));
  },
  fire(type, ev) { for (const fn of [...(this.listeners[type] ?? [])]) fn(ev); },
};
globalThis.document = doc;

let timers;
let timerId = 0;
globalThis.window = {
  innerWidth: 1000,
  innerHeight: 800,
  setTimeout: (fn) => { const id = ++timerId; timers.set(id, fn); return id; },
  clearTimeout: (id) => timers.delete(id),
};
const runTimers = () => { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } };

const { flyoutRow } = await import("../src/scripts/panel-flyout.js");

let container;
beforeEach(() => {
  timers = new Map();
  doc.listeners = {};
  doc.body = new El("body");
  doc.activeElement = doc.body;
  container = new El("div");
  doc.body.append(container);
});

function item(label, { disabled = false, ariaDisabled = false } = {}) {
  const b = doc.createElement("button");
  b.textContent = label;
  b.disabled = disabled;
  if (ariaDisabled) b.setAttribute("aria-disabled", "true");
  return b;
}

/** A plain row (one trigger, then its flyout) in the container. */
function build(opts = {}, items = [item("Copy text"), item("Copy link"), item("Copy with footnotes")]) {
  const row = flyoutRow("Copy", items, opts);
  container.append(row);
  return { row, trigger: row.children[0], fly: row.children[1], items };
}

const press = (key) => doc.activeElement.bubble("keydown", { key });

test("the flyout starts shut, and its items are menu items", () => {
  const { trigger, fly, items } = build();
  assert.equal(fly.hidden, true);
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  assert.equal(trigger.getAttribute("aria-haspopup"), "menu");
  assert.equal(fly.getAttribute("role"), "menu");
  for (const i of items) assert.equal(i.getAttribute("role"), "menuitem");
});

test("hover opens the flyout and takes no focus", () => {
  const { trigger, fly } = build();
  trigger.dispatch("pointerenter", { pointerType: "mouse" });
  assert.equal(fly.hidden, false);
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  assert.equal(doc.activeElement, doc.body);
});

test("a touch doesn't open the flyout on the way in", () => {
  const { trigger, fly } = build();
  trigger.dispatch("pointerenter", { pointerType: "touch" });
  assert.equal(fly.hidden, true);
});

test("a click on a flyout that hover opened moves focus in, and a second click shuts it (NB3-1)", () => {
  const { trigger, fly, items } = build();
  trigger.dispatch("pointerenter", { pointerType: "mouse" });
  trigger.dispatch("click", { detail: 1 });
  assert.equal(fly.hidden, false, "the click does not shut the flyout hover opened");
  assert.equal(doc.activeElement, items[0]);

  trigger.dispatch("click", { detail: 1 });
  assert.equal(fly.hidden, true, "a second click shuts it");
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  assert.equal(doc.activeElement, trigger, "and gives focus back to the trigger");
});

test("a click that opens the flyout moves focus in, and a second click shuts it", () => {
  const { trigger, fly, items } = build();
  trigger.dispatch("click", { detail: 1 });
  assert.equal(fly.hidden, false);
  assert.equal(doc.activeElement, items[0]);
  trigger.dispatch("click", { detail: 1 });
  assert.equal(fly.hidden, true);
  assert.equal(doc.activeElement, trigger);
});

test("Enter (a button's click with no pointer) and ArrowRight open it with focus on the first item", () => {
  const { trigger, fly, items } = build();
  trigger.focus();
  trigger.dispatch("click", { detail: 0 });
  assert.equal(fly.hidden, false);
  assert.equal(doc.activeElement, items[0]);

  press("Escape");
  assert.equal(fly.hidden, true);
  trigger.focus();
  trigger.dispatch("keydown", { key: "ArrowRight" });
  assert.equal(fly.hidden, false);
  assert.equal(doc.activeElement, items[0]);
});

test("opening focuses the first item that isn't disabled", () => {
  const { trigger, items } = build({}, [item("Copy text", { disabled: true }), item("Copy link")]);
  trigger.dispatch("keydown", { key: "ArrowRight" });
  assert.equal(doc.activeElement, items[1]);
});

test("the arrows step through the items and pass over a disabled or aria-disabled one (DK3-7)", () => {
  const { trigger, items } = build({}, [
    item("Copy text"),
    item("Copy link", { disabled: true }),
    item("Copy image", { ariaDisabled: true }),
    item("Copy with footnotes"),
  ]);
  const [first, , , last] = items;
  trigger.dispatch("keydown", { key: "ArrowRight" });
  assert.equal(doc.activeElement, first);
  press("ArrowDown");
  assert.equal(doc.activeElement, last, "ArrowDown skips the two passed-over items");
  press("ArrowDown");
  assert.equal(doc.activeElement, first, "and wraps to the top");
  press("ArrowUp");
  assert.equal(doc.activeElement, last, "ArrowUp wraps to the bottom, skipping the same two");
  press("ArrowUp");
  assert.equal(doc.activeElement, first);
});

test("Escape and ArrowLeft shut it and give focus back to the trigger, and the key stops at the flyout", () => {
  const { trigger, fly, items } = build();
  const reached = [];
  container.addEventListener("keydown", (e) => reached.push(e.key));

  trigger.dispatch("keydown", { key: "ArrowRight" });
  assert.equal(doc.activeElement, items[0]);
  press("Escape");
  assert.equal(fly.hidden, true);
  assert.equal(doc.activeElement, trigger);

  trigger.dispatch("keydown", { key: "ArrowRight" });
  press("ArrowLeft");
  assert.equal(fly.hidden, true);
  assert.equal(doc.activeElement, trigger);
  assert.deepEqual(reached, [], "neither key reaches the panel around the flyout");
});

test("pointerFocus: false keeps a mouse click from moving focus in; the keyboard still does", () => {
  const { trigger, fly, items } = build({ pointerFocus: false });
  trigger.dispatch("click", { detail: 1 });
  assert.equal(fly.hidden, false);
  assert.equal(doc.activeElement, doc.body, "a mouse click leaves focus where it was");

  trigger.dispatch("keydown", { key: "ArrowRight" });
  assert.equal(doc.activeElement, items[0], "ArrowRight always moves focus in");
});

test("pointerFocus: false: a click on a flyout hover opened keeps focus out too", () => {
  const { trigger, fly } = build({ pointerFocus: false });
  trigger.dispatch("pointerenter", { pointerType: "mouse" });
  trigger.dispatch("click", { detail: 1 });
  assert.equal(fly.hidden, false, "the click takes the hover-opened flyout");
  assert.equal(doc.activeElement, doc.body);
});

test("leaving the row shuts a hover-opened flyout after a beat", () => {
  const { row, trigger, fly } = build();
  trigger.dispatch("pointerenter", { pointerType: "mouse" });
  row.dispatch("pointerleave");
  runTimers();
  assert.equal(fly.hidden, true);
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
});

test("leaving the row does not shut a flyout that holds focus", () => {
  const { row, trigger, fly, items } = build();
  trigger.dispatch("pointerenter", { pointerType: "mouse" });
  trigger.dispatch("click", { detail: 1 });
  assert.equal(doc.activeElement, items[0]);
  row.dispatch("pointerleave");
  runTimers();
  assert.equal(fly.hidden, false, "it stays until focus leaves it, not the pointer");
});

test("a press outside the row shuts the flyout, and leaves focus alone (NB3-12)", () => {
  const { trigger, fly } = build();
  trigger.dispatch("pointerenter", { pointerType: "mouse" });
  const outside = doc.createElement("button");
  container.append(outside);
  doc.fire("pointerdown", { target: outside });
  assert.equal(fly.hidden, true);
  assert.equal(doc.activeElement, doc.body);
});
