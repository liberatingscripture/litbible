// /desk's panes and the shared modules (STUDY-DESK-AUDIT-1.md BA121, BA123,
// BA124, BA125). The modules are browser code, so they run here against a
// minimal stub DOM: just enough of document, requestAnimationFrame,
// MutationObserver and elements for each one. Each test file runs in its own
// process, so the globals set here don't leak.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ---- Stubs ---------------------------------------------------------------

// Document-level listeners, by type; dispatchEvent runs them synchronously.
const docListeners = new Map();
class StubEvent {
  constructor(type) { this.type = type; }
}

// A requestAnimationFrame queue the tests flush by hand.
let frames = new Map();
let nextFrame = 1;
globalThis.requestAnimationFrame = (fn) => { const id = nextFrame++; frames.set(id, fn); return id; };
globalThis.cancelAnimationFrame = (id) => { frames.delete(id); };
function flushFrames() {
  const run = [...frames.values()];
  frames = new Map();
  for (const fn of run) fn();
}

// A MutationObserver that only records what it was told to watch.
const observers = [];
class StubObserver {
  constructor(cb) {
    this.cb = cb;
    this.targets = [];
    this.disconnects = 0;
    observers.push(this);
  }
  observe(target) { this.targets.push(target); }
  disconnect() { this.disconnects++; this.targets = []; }
}

// The base class of every stub element; lit-panel.js checks `instanceof Node`.
class StubNode {}
class StubElement extends StubNode {
  constructor(tag = "div") {
    super();
    this.tag = tag;
    this.children = [];
    this.attrs = {};
    this.listeners = {};
    this.style = {};
    this.dataset = {};
    this.classes = new Set();
    this.classList = {
      add: (c) => this.classes.add(c),
      remove: (c) => this.classes.delete(c),
      contains: (c) => this.classes.has(c),
    };
    this.innerHTML = "";
    this.textContent = "";
    this.rect = { left: 300, top: 200, width: 40, height: 20 };
    this.offsetWidth = 200;
    this.offsetHeight = 100;
    this.parentElement = null;
  }
  set className(v) { this.classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get className() { return [...this.classes].join(" "); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  append(...kids) { for (const k of kids) { if (k instanceof StubElement) k.parentElement = this; this.children.push(k); } }
  appendChild(k) { this.append(k); return k; }
  remove() {}
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  click(ev) { for (const fn of this.listeners.click ?? []) fn(ev); }
  getBoundingClientRect() {
    const r = this.rect;
    return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.left + r.width, bottom: r.top + r.height };
  }
  closest() { return null; }
  contains() { return false; }
  querySelectorAll() { return []; }
  focus() {}
}

const documentElement = new StubElement("html");
documentElement.hasAttribute = () => false;
let body;

globalThis.Node = StubNode;
globalThis.Element = StubElement;
globalThis.CustomEvent = StubEvent;
globalThis.MutationObserver = StubObserver;
globalThis.window = globalThis;
globalThis.scrollX = 0;
globalThis.scrollY = 0;
globalThis.innerWidth = 1000;
globalThis.innerHeight = 800;
globalThis.matchMedia = () => ({ matches: false });
globalThis.getComputedStyle = () => ({ getPropertyValue: () => "" });
globalThis.document = {
  documentElement,
  get body() { return body; },
  createElement: (tag) => new StubElement(tag),
  createTextNode: (text) => ({ text }),
  querySelector: () => null,
  contains: () => true,
  addEventListener(type, fn) {
    if (!docListeners.has(type)) docListeners.set(type, new Set());
    docListeners.get(type).add(fn);
  },
  removeEventListener(type, fn) { docListeners.get(type)?.delete(fn); },
  dispatchEvent(ev) { for (const fn of [...(docListeners.get(ev.type) ?? [])]) fn(ev); },
};
body = new StubElement("body");
body.appendChild = (el) => { el.parentElement = body; return el; };

const { addDeskText, deskChaptersMoved, onDeskChapters } = await import("../src/scripts/desk/page.js");
const { watchLitRecords } = await import("../src/scripts/desk/lit-records.js");
const { recordRow } = await import("../src/scripts/desk/record-rows.js");
const { showPanel, closePanel } = await import("../src/scripts/lit-panel.js");

/**
 * A LIT pane's text holding `chapters` ([["john", 3], ...]) as sections, the
 * way deskChapterBoxes reads them. `connected` false is a pane built off the
 * page.
 */
function litText(chapters = [], connected = true) {
  const c = {
    isConnected: connected,
    chapters,
    querySelectorAll(sel) {
      assert.equal(sel, ".desk-lit__chapter[data-key]");
      return this.chapters.map(([book, chapter]) => ({
        dataset: { book, chapter: String(chapter) },
        querySelector: (s) => (s === ".chapter-paragraphs" ? { children: [] } : null),
      }));
    },
  };
  return c;
}

beforeEach(() => {
  frames = new Map();
  observers.length = 0;
  globalThis.scrollX = 0;
  globalThis.scrollY = 0;
});

// ---- BA121: onDeskChapters ----------------------------------------------

test("onDeskChapters calls back once, a frame later, when a pane gains a chapter", () => {
  const text = litText([["john", 3]]);
  const off = addDeskText(text);
  let calls = 0;
  const stop = onDeskChapters(() => calls++);
  text.chapters = [["john", 3], ["john", 4]];
  deskChaptersMoved();
  deskChaptersMoved(); // a second event in the same frame is coalesced
  assert.equal(calls, 0, "not before the frame");
  flushFrames();
  assert.equal(calls, 1);
  stop();
  off();
});

test("onDeskChapters stays quiet when the event comes but the chapters are the same", () => {
  const text = litText([["john", 3]]);
  const off = addDeskText(text);
  let calls = 0;
  const stop = onDeskChapters(() => calls++);
  deskChaptersMoved();
  flushFrames();
  assert.equal(calls, 0);
  // Two panes showing one chapter, then one: the set of chapters is unchanged.
  const second = litText([["john", 3]]);
  const offSecond = addDeskText(second);
  flushFrames();
  assert.equal(calls, 0, "a second pane on the same chapter changes nothing");
  stop();
  offSecond();
  off();
});

test("onDeskChapters hears a pane's text coming off the desk's list", () => {
  const a = litText([["john", 3]]);
  const b = litText([["romans", 8]]);
  const offA = addDeskText(a);
  const offB = addDeskText(b);
  let calls = 0;
  const stop = onDeskChapters(() => calls++);
  offB();
  flushFrames();
  assert.equal(calls, 1);
  stop();
  offA();
});

test("onDeskChapters stops calling back after the function it returned is called", () => {
  const text = litText([["john", 3]]);
  const off = addDeskText(text);
  let calls = 0;
  const stop = onDeskChapters(() => calls++);
  stop();
  text.chapters = [["john", 4]];
  deskChaptersMoved();
  flushFrames();
  assert.equal(calls, 0);
  assert.equal(docListeners.get("lit:desk-texts").size, 0, "the listener is removed");
  off();
});

test("onDeskChapters drops a callback already waiting for its frame when stopped", () => {
  const text = litText([["john", 3]]);
  const off = addDeskText(text);
  let calls = 0;
  const stop = onDeskChapters(() => calls++);
  text.chapters = [["john", 4]];
  deskChaptersMoved();
  stop();
  flushFrames();
  assert.equal(calls, 0);
  off();
});

// ---- BA123: watchLitRecords lets go of a removed text --------------------

const fakeStore = () => ({ subscribe() {}, byChapter: async () => [] });

test("watchLitRecords stops watching a text taken off the list, and keeps the rest", () => {
  const a = litText();
  const b = litText();
  const offA = addDeskText(a);
  const offB = addDeskText(b);
  watchLitRecords({ store: fakeStore(), onChange() {} });
  const [observer] = observers;
  assert.deepEqual(observer.targets, [a, b]);
  assert.equal(observer.disconnects, 0);

  offA();
  assert.equal(observer.disconnects, 1, "the observer let go of everything");
  assert.deepEqual(observer.targets, [b], "and watches only what remains");
  offB();
});

test("watchLitRecords does not start over when a text is only added", () => {
  const a = litText();
  const offA = addDeskText(a);
  watchLitRecords({ store: fakeStore(), onChange() {} });
  const [observer] = observers;
  const b = litText();
  const offB = addDeskText(b);
  assert.equal(observer.disconnects, 0);
  assert.deepEqual(observer.targets, [a, b]);
  offA();
  offB();
});

test("watchLitRecords watches a text that isn't on the page yet", () => {
  const offPage = litText([], false);
  const off = addDeskText(offPage);
  watchLitRecords({ store: fakeStore(), onChange() {} });
  const [observer] = observers;
  assert.deepEqual(observer.targets, [offPage]);
  off();
});

// ---- BA124: a row's reference in a /desk pane ----------------------------

const note = {
  schema: 1, id: "n1", kind: "note", created: "2026-10-01T00:00:00Z", modified: "2026-10-01T00:00:00Z",
  client: "web/test", contentVersion: "v1", labels: [],
  bookKey: "john", chapter: 3, verse: 16, endVerse: 16, marker: "note", body: "God so loved",
};

function row(extra = {}) {
  const li = recordRow(note, { labels: new Map(), onLabels() {}, onDelete() {}, ...extra });
  const link = li.children.find((c) => c.className.includes("desk-item__ref"));
  return { li, link };
}

/** A click event that records whether it was prevented. */
const click = (extra = {}) => ({
  button: 0, ctrlKey: false, metaKey: false, shiftKey: false,
  prevented: false,
  preventDefault() { this.prevented = true; },
  ...extra,
});

test("a plain click on a row's reference goes there in the pane and is prevented", () => {
  const went = [];
  const { link } = row({ goHere: { can: () => true, go: (r) => went.push(r) } });
  assert.equal(link.href, "/john-3/#v16");
  const e = click();
  link.click(e);
  assert.deepEqual(went, [note]);
  assert.equal(e.prevented, true);
});

test("a ctrl-click, meta-click, shift-click or middle click on the reference is left to the browser", () => {
  const went = [];
  const { link } = row({ goHere: { can: () => true, go: (r) => went.push(r) } });
  for (const extra of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { button: 1 }]) {
    const e = click(extra);
    link.click(e);
    assert.equal(e.prevented, false, JSON.stringify(extra));
  }
  assert.equal(went.length, 0);
});

test("without goHere, or where it can't take the record, a click is untouched", () => {
  const plain = row().link;
  assert.equal((plain.listeners.click ?? []).length, 0);
  const declined = row({ goHere: { can: () => false, go() { assert.fail("not asked"); } } }).link;
  const e = click();
  declined.click(e);
  assert.equal(e.prevented, false);
});

// ---- BA125: a panel opened from a LIT pane is pinned to the screen -------

/** A trigger element, inside an ancestor marked `[data-panels-pin]` or not. */
function trigger(pinned) {
  const t = new StubElement("span");
  t.parentElement = {
    closest: (sel) => (sel === "[data-panels-pin]" && pinned ? {} : null),
  };
  return t;
}

test("a panel opened from inside a [data-panels-pin] ancestor is pinned, in viewport coordinates", () => {
  globalThis.scrollX = 0;
  globalThis.scrollY = 500;
  const t = trigger(true);
  t.rect = { left: 300, top: 200, width: 40, height: 20 };
  const el = showPanel(t, new StubElement("div"));
  // Unpinned, top would be scrollY + rect.bottom + 8 = 728 (document); pinned
  // it's the same place on the screen: 728 - 500 = 228.
  assert.ok(el.classes.has("lit-panel--pinned"));
  assert.equal(el.style.top, "228px");
  assert.equal(el.style.left, `${300 + 20 - 100}px`);
  closePanel();
});

test("a panel opened with pinned: true and a non-Node trigger is pinned the same way", () => {
  globalThis.scrollX = 30;
  globalThis.scrollY = 500;
  const rectOnly = { getBoundingClientRect: () => ({ left: 300, top: 200, right: 340, bottom: 220, width: 40, height: 20 }) };
  const el = showPanel(rectOnly, new StubElement("div"), {
    pinned: true,
    place: () => ({ left: 330, top: 720 }), // document coordinates
  });
  assert.ok(el.classes.has("lit-panel--pinned"));
  assert.equal(el.style.left, "300px");
  assert.equal(el.style.top, "220px");
  closePanel();
});

test("a panel opened from an ordinary trigger is not pinned", () => {
  globalThis.scrollY = 500;
  const t = trigger(false);
  const el = showPanel(t, new StubElement("div"));
  assert.equal(el.classes.has("lit-panel--pinned"), false);
  assert.equal(el.style.top, "728px", "still in document coordinates");
  closePanel();
});

test("a bottom sheet is never pinned", () => {
  globalThis.matchMedia = () => ({ matches: true });
  const el = showPanel(trigger(true), new StubElement("div"));
  assert.ok(el.classes.has("lit-panel--sheet"));
  assert.equal(el.classes.has("lit-panel--pinned"), false);
  globalThis.matchMedia = () => ({ matches: false });
  closePanel();
});
