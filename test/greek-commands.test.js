// The Greek search commands window, run against a small stub DOM (no browser).
//   - BA114: when the search field is gone from the document (a /desk Greek
//     pane closed or redrawn), a click on a command closes the window instead
//     of silently doing nothing.
//   - From a Greek pane on /desk (no #deskPanel), the window sits beside the
//     pane, not beside the Notebook.
// greek-commands.js and float-window.js are real; only the DOM is faked.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

let winListeners;
let docListeners;
let store;
let body;
let elementsById;

class StubElement {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.parent = null;
    this.attrs = {};
    this.listeners = {};
    this.style = {};
    this.classes = new Set();
    this.dataset = {};
    this.value = "";
    this.text = "";
    this.rect = { left: 0, top: 0, width: 340, height: 100 };
    this.classList = {
      add: (c) => this.classes.add(c),
      remove: (c) => this.classes.delete(c),
    };
  }
  set className(v) { this.classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get className() { return [...this.classes].join(" "); }
  set textContent(v) { this.text = String(v); }
  get textContent() { return this.text; }
  get offsetWidth() { return this.rect.width; }
  // In the document only while every ancestor up to <body> is attached.
  get isConnected() {
    let n = this;
    while (n.parent) n = n.parent;
    return n === body;
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  append(...kids) {
    for (const k of kids) {
      if (typeof k === "string") { this.text += k; continue; }
      k.parent = this;
      this.children.push(k);
    }
  }
  before(node) {
    node.parent = this.parent;
    this.parent.children.splice(this.parent.children.indexOf(this), 0, node);
  }
  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
  }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  dispatch(type, ev) { for (const fn of this.listeners[type] ?? []) fn(ev); }
  dispatchEvent(ev) { this.dispatch(ev.type, ev); return true; }
  getBoundingClientRect() {
    // A floating window's place follows its style; anything else measures as set.
    const left = parseFloat(this.style.left) || this.rect.left;
    const top = parseFloat(this.style.top) || this.rect.top;
    const { width, height } = this.rect;
    return { left, top, width, height, right: left + width, bottom: top + height };
  }
  // Only the two selectors greek-commands.js asks the field about.
  closest(sel) {
    if (sel !== ".desk-pane" && sel !== "form") return null;
    const want = sel.replace(/^\./, "");
    for (let n = this.parent; n; n = n.parent) {
      if (n.classes.has(want) || n.tag === want) return n;
    }
    return null;
  }
  findAll(pred, out = []) {
    for (const c of this.children) {
      if (pred(c)) out.push(c);
      c.findAll(pred, out);
    }
    return out;
  }
  focus() {}
  setSelectionRange() {}
}

globalThis.window = globalThis;
globalThis.innerWidth = 1200;
globalThis.innerHeight = 800;
globalThis.addEventListener = (type, fn) => {
  if (!winListeners.has(type)) winListeners.set(type, new Set());
  winListeners.get(type).add(fn);
};
globalThis.removeEventListener = (type, fn) => winListeners.get(type)?.delete(fn);
globalThis.Option = class extends StubElement {
  constructor(label, value = "") { super("option"); this.text = label; this.value = value; }
};
const memory = () => ({
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
});
globalThis.sessionStorage = memory();
globalThis.localStorage = memory();
globalThis.document = {
  createElement: (tag) => new StubElement(tag),
  getElementById: (id) => elementsById.get(id) ?? null,
  documentElement: { hasAttribute: () => false },
  addEventListener: (type, fn) => {
    if (!docListeners.has(type)) docListeners.set(type, new Set());
    docListeners.get(type).add(fn);
  },
  removeEventListener: (type, fn) => docListeners.get(type)?.delete(fn),
  get body() { return body; },
};

const { openGreekCommands, closeGreekCommands, greekCommandsOpenFor } = await import("../src/scripts/greek-commands.js");

beforeEach(() => {
  winListeners = new Map();
  docListeners = new Map();
  store = new Map(); // no saved place (lit-greek-commands-pos), so place() runs
  elementsById = new Map();
  body = new StubElement("body");
});

afterEach(() => closeGreekCommands());

/** A search field inside a /desk pane, both in the document. */
function deskField(paneRect, fieldRect = { left: paneRect.left + 20, top: 120, width: 200, height: 30 }) {
  const pane = new StubElement("div");
  pane.className = "desk-pane";
  pane.rect = { ...paneRect, width: paneRect.right - paneRect.left, height: 600, bottom: paneRect.top + 600 };
  const field = new StubElement("input");
  field.rect = fieldRect;
  pane.append(field);
  body.append(pane);
  return { pane, field };
}

const windowEl = () => body.children.find((c) => c.classes.has("greek-cmds"));
const commandButton = () => windowEl().findAll((e) => e.tag === "button" && e.classes.has("greek-cmd") && e.dataset.insert)[0];
const click = (btn) => btn.dispatch("click", { detail: 0 });

test("a click after the field left the document closes the window and writes nothing (BA114)", () => {
  const { field } = deskField({ left: 600, right: 1000, top: 100 });
  openGreekCommands({ field, source: "notebook", focus: false });
  assert.equal(greekCommandsOpenFor(field), true);
  const btn = commandButton();
  assert.ok(btn, "the window lists command buttons");

  field.remove(); // the pane was redrawn
  assert.equal(field.isConnected, false);
  click(btn);

  assert.equal(greekCommandsOpenFor(field), false);
  assert.equal(windowEl(), undefined);
  assert.equal(field.value, "");
});

test("the same click with the field in the document inserts the command", () => {
  const { field } = deskField({ left: 600, right: 1000, top: 100 });
  openGreekCommands({ field, source: "notebook", focus: false });
  const btn = commandButton();

  click(btn);

  assert.ok(field.value.includes(btn.dataset.insert.trim()));
  assert.equal(greekCommandsOpenFor(field), true);
  assert.ok(windowEl());
});

test("closing the whole pane has the same effect as removing the field", () => {
  const { pane, field } = deskField({ left: 600, right: 1000, top: 100 });
  openGreekCommands({ field, source: "notebook", focus: false });
  const btn = commandButton();

  pane.remove();
  click(btn);

  assert.equal(greekCommandsOpenFor(field), false);
  assert.equal(windowEl(), undefined);
});

test("from a /desk pane the window sits to the pane's left when there is room", () => {
  const { field } = deskField({ left: 600, right: 1000, top: 100 });
  openGreekCommands({ field, source: "notebook", focus: false });
  // 600 - 340 (window width) - 16 (gap)
  assert.equal(windowEl().style.left, "244px");
  assert.equal(windowEl().style.top, "120px"); // level with the field
});

test("from a pane near the window's left edge it goes to the pane's right", () => {
  const { field } = deskField({ left: 100, right: 500, top: 100 });
  openGreekCommands({ field, source: "notebook", focus: false });
  // The pane's left has no room (100 - 340 - 16 < 8), so 500 + 16.
  assert.equal(windowEl().style.left, "516px");
  assert.equal(windowEl().style.top, "120px");
});

test("with no room on either side of the pane it falls back to below the field", () => {
  const { field } = deskField({ left: 100, right: 1100, top: 100 });
  openGreekCommands({ field, source: "notebook", focus: false });
  // Right of the pane would end at 1456, past the edge: against the right edge, under the field.
  assert.equal(windowEl().style.left, "844px"); // 1200 - 340 - 16
  assert.equal(windowEl().style.top, "160px"); // field bottom (150) + 10
});

test("with the Notebook panel present, the window keeps to the Notebook's left, not the pane's", () => {
  const panel = new StubElement("aside");
  panel.rect = { left: 900, top: 0, width: 300, height: 800 };
  elementsById.set("deskPanel", panel);
  body.append(panel);
  const { field } = deskField({ left: 600, right: 880, top: 100 });
  openGreekCommands({ field, source: "notebook", focus: false });
  // 900 - 340 - 16; the pane's left (which would give 244) is not used.
  assert.equal(windowEl().style.left, "544px");
});
