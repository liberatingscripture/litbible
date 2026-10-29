import test from "node:test";
import assert from "node:assert/strict";
import { MAX_SPLIT, MIN_SPLIT, clampSplit, forgetsSplit, splitFromPointer } from "../src/lib/desk-greek-split.mjs";

test("a share stays between a quarter and three quarters", () => {
  assert.equal(clampSplit(0.5), 0.5);
  assert.equal(clampSplit(0), MIN_SPLIT);
  assert.equal(clampSplit(1), MAX_SPLIT);
  assert.equal(clampSplit(0.25), 0.25);
  assert.equal(clampSplit(0.75), 0.75);
});

test("something that is not a number is no share", () => {
  for (const bad of [null, undefined, NaN, Infinity, "0.5"]) assert.equal(clampSplit(bad), null);
});

test("the entry's share is what lies below the pointer", () => {
  const room = { top: 100, bottom: 500 };
  assert.equal(splitFromPointer({ ...room, y: 300 }), 0.5);
  assert.equal(splitFromPointer({ ...room, y: 200 }), 0.75);
  assert.equal(splitFromPointer({ ...room, y: 400 }), 0.25);
});

test("dragging past either end stops at the bound", () => {
  const room = { top: 100, bottom: 500 };
  assert.equal(splitFromPointer({ ...room, y: 0 }), MAX_SPLIT);
  assert.equal(splitFromPointer({ ...room, y: 900 }), MIN_SPLIT);
});

test("no room, no share", () => {
  assert.equal(splitFromPointer({ y: 5, top: 10, bottom: 10 }), null);
  assert.equal(splitFromPointer({ y: 5, top: 10, bottom: 0 }), null);
});

// The tab's wiring in miniature: the share it holds, kept in a storage that
// throws (a browser blocking site data), and the listener it hears widths on.
function tabWith(storage) {
  const tab = { share: null };
  const keptSplit = () => {
    try {
      return clampSplit(parseFloat(storage.getItem("lit-desk-greek-split")));
    } catch (_) {
      return null;
    }
  };
  tab.onWidths = (detail) => {
    if (forgetsSplit(tab.share, detail)) tab.share = null;
  };
  tab.move = (next) => {
    tab.share = next;
    try {
      storage.setItem("lit-desk-greek-split", String(next));
    } catch (_) {}
    tab.onWidths({ kept: tab.share != null }); // setShare's own event
  };
  tab.kept = keptSplit;
  return tab;
}
const blocked = {
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("blocked");
  },
};

test("with storage blocked, a moved line survives its own event (BA113)", () => {
  const tab = tabWith(blocked);
  tab.move(0.6);
  assert.equal(tab.kept(), null, "nothing can be read back");
  assert.equal(tab.share, 0.6);
});

test("Reset widths forgets the line, kept or not (BA113)", () => {
  const tab = tabWith(blocked);
  tab.move(0.6);
  tab.onWidths({ kept: false });
  assert.equal(tab.share, null);
});

test("other handles' events leave the line alone", () => {
  assert.equal(forgetsSplit(0.6, { kept: true }), false);
  assert.equal(forgetsSplit(0.6, undefined), false);
  assert.equal(forgetsSplit(null, { kept: false }), false);
  assert.equal(forgetsSplit(0.6, { kept: false }), true);
});
