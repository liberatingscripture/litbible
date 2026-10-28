import { test } from "node:test";
import assert from "node:assert/strict";
import { printLook, printing } from "../src/scripts/desk/print-look.js";

// A window with a print() the test controls, and a count of the listeners it holds.
class FakeWindow extends EventTarget {
  constructor(onPrint = () => {}) {
    super();
    this.onPrint = onPrint;
    this.live = new Set(); // "type/capture" for each listener added and not yet removed
  }
  print() {
    this.onPrint();
  }
  addEventListener(type, fn, opts) {
    this.live.add(`${type}/${Boolean(opts)}`);
    super.addEventListener(type, fn, opts);
  }
  removeEventListener(type, fn, opts) {
    this.live.delete(`${type}/${Boolean(opts)}`);
    super.removeEventListener(type, fn, opts);
  }
}

// A root element that is only its attributes.
function fakeRoot() {
  const attrs = new Map();
  return {
    setAttribute: (k, v) => attrs.set(k, String(v)),
    removeAttribute: (k) => attrs.delete(k),
    getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
    hasAttribute: (k) => attrs.has(k),
  };
}

const ATTR = "data-desk-print";

test("an ordinary print sets the look around print() and takes it away on afterprint", async () => {
  const order = [];
  const root = fakeRoot();
  let during = null;
  const win = new FakeWindow(() => {
    order.push("print");
    during = root.getAttribute(ATTR);
  });
  let undone = 0;
  const steps = {
    build: async () => {
      order.push(`build:${root.hasAttribute(ATTR)}`);
      return { undo: () => undone++ };
    },
    ready: async () => order.push(`ready:${root.hasAttribute(ATTR)}`),
  };
  assert.equal(await printLook("notes", steps, { win, root }), true);
  assert.equal(during, "notes");
  assert.deepEqual(order, ["build:false", "ready:true", "print"]);
  assert.equal(printing(), true, "still under way until the dialog ends");
  win.dispatchEvent(new Event("afterprint"));
  assert.equal(root.hasAttribute(ATTR), false);
  assert.equal(undone, 1);
  assert.equal(printing(), false);
  win.dispatchEvent(new Event("keydown"));
  assert.equal(undone, 1, "a later event does not undo again");
});

for (const type of ["pointerdown", "keydown", "focus"]) {
  test(`with no dialog, the next ${type} ends the print`, async () => {
    const root = fakeRoot();
    const win = new FakeWindow(); // print() returns and no afterprint ever comes
    let undone = 0;
    await printLook("room", { build: async () => ({ undo: () => undone++ }) }, { win, root });
    assert.equal(root.getAttribute(ATTR), "room", "the look stays until the reader acts");
    assert.equal(undone, 0);
    win.dispatchEvent(new Event(type));
    assert.equal(root.hasAttribute(ATTR), false);
    assert.equal(undone, 1);
    assert.equal(printing(), false);
    win.dispatchEvent(new Event("afterprint"));
    assert.equal(undone, 1, "nothing is undone twice");
  });
}

test("only one desk print runs at a time", async () => {
  const root = fakeRoot();
  const win = new FakeWindow();
  let release;
  const held = new Promise((resolve) => (release = resolve));
  let printed = 0;
  win.onPrint = () => printed++;
  const first = printLook("notes", { build: async () => (await held, null) }, { win, root });
  let secondBuilt = false;
  const second = await printLook("room", { build: async () => { secondBuilt = true; } }, { win, root });
  assert.equal(second, false);
  assert.equal(secondBuilt, false);
  release();
  assert.equal(await first, true);
  assert.equal(printed, 1, "the second never printed");
  assert.equal(root.getAttribute(ATTR), "notes");
  win.dispatchEvent(new Event("afterprint"));
  assert.equal(await printLook("room", {}, { win, root }), true, "free again once the first ended");
  assert.equal(root.getAttribute(ATTR), "room");
  win.dispatchEvent(new Event("afterprint"));
});

test("a build or ready that fails leaves no look behind and frees the next print", async () => {
  const realError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  try {
    // build fails: nothing was set, nothing to undo
    let root = fakeRoot();
    let win = new FakeWindow(() => assert.fail("must not print"));
    assert.equal(await printLook("notes", { build: async () => { throw new Error("no build"); } }, { win, root }), true);
    assert.equal(root.hasAttribute(ATTR), false);
    assert.equal(printing(), false);

    // ready fails: the look was set and build's undo is owed
    root = fakeRoot();
    win = new FakeWindow(() => assert.fail("must not print"));
    let undone = 0;
    await printLook(
      "notes",
      { build: async () => ({ undo: () => undone++ }), ready: async () => { throw new Error("no fonts"); } },
      { win, root },
    );
    assert.equal(root.hasAttribute(ATTR), false);
    assert.equal(undone, 1);
    assert.equal(printing(), false);
    assert.equal(logged.length, 2, "each failure was logged");

    // and the next print works
    root = fakeRoot();
    win = new FakeWindow();
    assert.equal(await printLook("room", {}, { win, root }), true);
    assert.equal(root.getAttribute(ATTR), "room");
    win.dispatchEvent(new Event("afterprint"));
  } finally {
    console.error = realError;
  }
  assert.equal(printing(), false);
});

test("every listener is taken off the window when the print ends", async () => {
  const root = fakeRoot();
  const win = new FakeWindow();
  await printLook("notes", {}, { win, root });
  for (const key of ["afterprint/false", "focus/true", "pointerdown/true", "keydown/true"]) {
    assert.ok(win.live.has(key), `${key} is listening during the print`);
  }
  win.dispatchEvent(new Event("afterprint"));
  assert.equal(win.live.size, 0, `still listening: ${[...win.live].join(", ")}`);
});
