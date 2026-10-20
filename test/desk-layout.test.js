import test from "node:test";
import assert from "node:assert/strict";
import {
  ARRANGEMENTS,
  HANDLE,
  KINDS,
  LAYOUT_KEY,
  MAX_PANES,
  MIN_HEIGHT,
  MIN_WIDTH,
  applyArrangement,
  arrangementOf,
  checkLayout,
  closePane,
  evenOut,
  findPane,
  fitSizes,
  isFollower,
  kindLabel,
  leaderFor,
  litPlace,
  minSize,
  needs,
  newPane,
  nodeAt,
  normalize,
  openingLayout,
  originalLayout,
  panes,
  pathTo,
  placeFor,
  readSaved,
  resize,
  setActive,
  setKind,
  setLitAt,
  setPaneSheet,
  setPin,
  setPlace,
  slotCount,
  splitPane,
  writeSaved,
} from "../src/lib/desk-layout.mjs";

// ---- helpers --------------------------------------------------------------

const leaf = (id, kind, pin = null) => ({ pane: { id, kind, pin } });
const cols = (sizes, ...children) => ({ split: "columns", sizes, children });
const rows = (sizes, ...children) => ({ split: "rows", sizes, children });
const mk = (root, active) => ({
  root,
  active: active !== undefined ? active : (panes(root).find((p) => p.kind === "lit")?.id ?? null),
});
const ids = (layout) => panes(layout.root).map((p) => p.id);
const kinds = (layout) => panes(layout.root).map((p) => p.kind);
const close = (actual, expected, message) => {
  assert.equal(actual.length, expected.length, message);
  actual.forEach((a, i) => assert.ok(Math.abs(a - expected[i]) < 1e-9, `${message ?? ""} [${i}] ${a} vs ${expected[i]}`));
};

// ---- the original layout --------------------------------------------------

test("the original layout is the LIT beside My Notes, 60/40", () => {
  const l = originalLayout();
  assert.equal(l.root.split, "columns");
  assert.deepEqual(l.root.sizes, [0.6, 0.4]);
  assert.deepEqual(kinds(l), ["lit", "mine"]);
  assert.deepEqual(ids(l), ["p1", "p2"]);
  assert.equal(l.active, "p1");
  assert.equal(findPane(l.root, l.active).kind, "lit");
  assert.equal(arrangementOf(l), "cols-2");
});

test("originalLayout returns a fresh object each time", () => {
  const a = originalLayout();
  a.root.sizes[0] = 0.9;
  assert.deepEqual(originalLayout().root.sizes, [0.6, 0.4]);
});

// ---- reading the tree -----------------------------------------------------

test("panes, findPane, nodeAt and pathTo read the tree in reading order", () => {
  const root = cols([0.5, 0.5], leaf("a", "lit"), rows([0.5, 0.5], leaf("b", "mine"), leaf("c", "verse")));
  assert.deepEqual(panes(root).map((p) => p.id), ["a", "b", "c"]);
  assert.deepEqual(panes(null), []);
  assert.equal(findPane(root, "c").kind, "verse");
  assert.equal(findPane(root, "zzz"), null);
  assert.deepEqual(pathTo(root, "a"), [0]);
  assert.deepEqual(pathTo(root, "c"), [1, 1]);
  assert.equal(pathTo(root, "zzz"), null);
  assert.equal(nodeAt(root, []), root);
  assert.equal(nodeAt(root, [1, 0]).pane.id, "b");
  assert.equal(nodeAt(root, [5]), null);
  assert.equal(nodeAt(root, [0, 0]), null);
});

test("isFollower and kindLabel", () => {
  for (const k of ["verse", "greek", "footnotes"]) assert.equal(isFollower(k), true, k);
  for (const k of ["lit", "mine", "sheet", "future", undefined]) assert.equal(isFollower(k), false, String(k));
  assert.equal(kindLabel("lit"), "The LIT");
  assert.equal(kindLabel("mine"), "My Notes");
  assert.equal(kindLabel("future"), "future");
});

test("newPane picks the first p-number not in use", () => {
  assert.deepEqual(newPane(originalLayout(), "verse"), { id: "p3", kind: "verse", pin: null });
  assert.equal(newPane(mk(cols([0.5, 0.5], leaf("p2", "lit"), leaf("p3", "mine"))), "greek").id, "p1");
  assert.equal(newPane(undefined, "lit").id, "p1");
});

// ---- arrangements ---------------------------------------------------------

test("there are eleven arrangements and none of them is four rows", () => {
  assert.equal(ARRANGEMENTS.length, 11);
  assert.equal(new Set(ARRANGEMENTS.map((a) => a.id)).size, 11);
  const fourRows = (shape) => !shape.slot && ((shape.split === "rows" && shape.children.length >= 4) || shape.children.some(fourRows));
  assert.equal(ARRANGEMENTS.some((a) => fourRows(a.shape)), false);
  assert.equal(ARRANGEMENTS.some((a) => /four rows/i.test(a.label)), false);
  assert.ok(ARRANGEMENTS.every((a) => slotCount(a.id) >= 1 && slotCount(a.id) <= MAX_PANES));
});

test("every arrangement round-trips through applyArrangement and arrangementOf", () => {
  for (const a of ARRANGEMENTS) {
    const l = applyArrangement(originalLayout(), a.id);
    assert.equal(arrangementOf(l), a.id, a.id);
    assert.equal(panes(l.root).length, slotCount(a.id), a.id);
    assert.equal(new Set(ids(l)).size, ids(l).length, `${a.id} has unique ids`);
    assert.ok(l.active === null || findPane(l.root, l.active)?.kind === "lit", a.id);
  }
});

test("round-trips from a four-pane layout too", () => {
  const four = applyArrangement(originalLayout(), "grid");
  for (const a of ARRANGEMENTS) {
    const l = applyArrangement(four, a.id);
    assert.equal(arrangementOf(l), a.id, a.id);
    assert.equal(panes(l.root).length, slotCount(a.id), a.id);
  }
});

test("slotCount counts the slots of each shape, and is one for an unknown id", () => {
  const expected = {
    one: 1, "cols-2": 2, "rows-2": 2, "cols-3": 3, "rows-3": 3, "one-left-two": 3,
    "two-one-right": 3, "one-over-two": 3, "two-over-one": 3, "cols-4": 4, grid: 4,
  };
  for (const [id, n] of Object.entries(expected)) assert.equal(slotCount(id), n, id);
  assert.equal(slotCount("nonsense"), 1);
});

test("arrangementOf is null for a shape the menu doesn't list", () => {
  const fourRows = mk(rows([0.25, 0.25, 0.25, 0.25], leaf("a", "lit"), leaf("b", "mine"), leaf("c", "verse"), leaf("d", "greek")));
  assert.equal(arrangementOf(fourRows), null);
  const deep = mk(cols([0.5, 0.5], leaf("a", "lit"), rows([0.5, 0.5], leaf("b", "mine"), cols([0.5, 0.5], leaf("c", "verse"), leaf("d", "greek")))));
  assert.equal(arrangementOf(deep), null);
});

test("applyArrangement keeps open panes in reading order with their ids and pins", () => {
  const pin = { at: "John 3:16" };
  const l = mk(cols([0.2, 0.3, 0.5], leaf("x", "lit"), leaf("y", "verse", pin), leaf("z", "mine")));
  const rows2 = applyArrangement(l, "rows-2");
  assert.deepEqual(ids(rows2), ["x", "y"]);
  assert.deepEqual(findPane(rows2.root, "y").pin, pin);
  const grid = applyArrangement(l, "grid");
  assert.deepEqual(ids(grid).slice(0, 3), ["x", "y", "z"]);
  assert.deepEqual(findPane(grid.root, "y").pin, pin);
  assert.equal(ids(grid).length, 4);
  assert.deepEqual(kinds(grid).slice(0, 3), ["lit", "verse", "mine"]);
});

test("applyArrangement closes from the end when there are fewer slots", () => {
  const four = applyArrangement(originalLayout(), "grid");
  const [a, b, c, d] = ids(four);
  assert.deepEqual(ids(applyArrangement(four, "cols-3")), [a, b, c]);
  assert.deepEqual(ids(applyArrangement(four, "cols-2")), [a, b]);
  assert.deepEqual(ids(applyArrangement(four, "one")), [a]);
  assert.ok(!ids(applyArrangement(four, "one")).includes(d));
});

test("applyArrangement fills new slots with the first kind not open, in KINDS order", () => {
  // From the original (lit, mine): the next two are verse then greek.
  const three = applyArrangement(originalLayout(), "cols-3");
  assert.deepEqual(kinds(three), ["lit", "mine", "verse"]);
  const four = applyArrangement(originalLayout(), "cols-4");
  assert.deepEqual(kinds(four), ["lit", "mine", "verse", "greek"]);
  // From My Notes alone: lit comes first in KINDS, then verse.
  const alone = mk(leaf("p1", "mine"));
  assert.deepEqual(kinds(applyArrangement(alone, "cols-3")), ["mine", "lit", "verse"]);
  // lit and verse open: My Notes is the first one missing.
  const lv = mk(cols([0.5, 0.5], leaf("p1", "lit"), leaf("p2", "verse")));
  assert.deepEqual(kinds(applyArrangement(lv, "cols-3")), ["lit", "verse", "mine"]);
  // The fill order is KINDS order.
  const order = KINDS.map((k) => k.kind);
  assert.deepEqual(order.slice(0, 4), ["lit", "mine", "verse", "greek"]);
});

test("applyArrangement gives new panes ids that are free and no pin", () => {
  const l = mk(cols([0.5, 0.5], leaf("p2", "lit"), leaf("p3", "mine")));
  const next = applyArrangement(l, "cols-3");
  assert.deepEqual(ids(next), ["p2", "p3", "p1"]);
  assert.equal(findPane(next.root, "p1").pin, null);
});

test("applyArrangement starts sizes even", () => {
  const l = applyArrangement(originalLayout(), "cols-3");
  close(l.root.sizes, [1 / 3, 1 / 3, 1 / 3]);
  const grid = applyArrangement(originalLayout(), "grid");
  close(grid.root.sizes, [0.5, 0.5]);
  for (const c of grid.root.children) close(c.sizes, [0.5, 0.5]);
  close(applyArrangement(originalLayout(), "rows-2").root.sizes, [0.5, 0.5]);
});

test("applyArrangement keeps the active LIT pane, or settles to another", () => {
  const l = mk(cols([0.5, 0.5], leaf("a", "mine"), leaf("b", "lit")), "b");
  assert.equal(applyArrangement(l, "cols-3").active, "b");
  // Only room for the first pane (My Notes): no LIT pane is left.
  assert.equal(applyArrangement(l, "one").active, null);
  const two = mk(cols([0.5, 0.5], leaf("a", "lit"), leaf("b", "lit")), "b");
  assert.equal(applyArrangement(two, "one").active, "a");
});

test("an unknown arrangement id returns the layout unchanged", () => {
  const l = originalLayout();
  assert.equal(applyArrangement(l, "nonsense"), l);
});

// ---- normalize ------------------------------------------------------------

test("normalize collapses a split with one child", () => {
  const node = { split: "columns", sizes: [1], children: [leaf("a", "lit")] };
  assert.deepEqual(normalize(node), leaf("a", "lit"));
  const nested = rows([0.5, 0.5], cols([1], leaf("a", "lit")), leaf("b", "mine"));
  assert.deepEqual(normalize(nested), rows([0.5, 0.5], leaf("a", "lit"), leaf("b", "mine")));
});

test("normalize flattens same-direction nesting with sizes scaled by share", () => {
  const node = cols([0.5, 0.5], cols([0.5, 0.5], leaf("a", "lit"), leaf("b", "mine")), leaf("c", "verse"));
  const n = normalize(node);
  assert.equal(n.split, "columns");
  assert.deepEqual(n.children.map((c) => c.pane.id), ["a", "b", "c"]);
  close(n.sizes, [0.25, 0.25, 0.5]);
});

test("normalize flattens when the inner split is last and uneven", () => {
  const node = cols([0.4, 0.6], leaf("a", "lit"), cols([0.25, 0.75], leaf("b", "mine"), leaf("c", "verse")));
  const n = normalize(node);
  assert.deepEqual(n.children.map((c) => c.pane.id), ["a", "b", "c"]);
  close(n.sizes, [0.4, 0.15, 0.45]);
});

test("normalize keeps cross-direction nesting", () => {
  const node = cols([0.6, 0.4], leaf("a", "lit"), rows([0.5, 0.5], leaf("b", "mine"), leaf("c", "verse")));
  const n = normalize(node);
  assert.equal(n.split, "columns");
  assert.equal(n.children[1].split, "rows");
  assert.deepEqual(n.sizes, [0.6, 0.4]);
  assert.deepEqual(n.children[1].sizes, [0.5, 0.5]);
});

test("normalize makes sizes sum to 1, and evens bad ones", () => {
  close(normalize(cols([1, 3], leaf("a", "lit"), leaf("b", "mine"))).sizes, [0.25, 0.75]);
  close(normalize(cols(undefined, leaf("a", "lit"), leaf("b", "mine"))).sizes, [0.5, 0.5]);
  close(normalize(cols([1], leaf("a", "lit"), leaf("b", "mine"))).sizes, [0.5, 0.5]);
  assert.deepEqual(normalize(leaf("a", "lit")), leaf("a", "lit"));
});

// ---- closePane ------------------------------------------------------------

test("closing a pane gives its room to the neighbors", () => {
  const l = mk(cols([0.2, 0.3, 0.5], leaf("a", "lit"), leaf("b", "mine"), leaf("c", "verse")));
  const next = closePane(l, "b");
  assert.deepEqual(ids(next), ["a", "c"]);
  close(next.root.sizes, [0.2 / 0.7, 0.5 / 0.7]);
  assert.ok(Math.abs(next.root.sizes.reduce((x, y) => x + y, 0) - 1) < 1e-9);
});

test("closing one of two panes leaves the other as the whole layout", () => {
  const next = closePane(originalLayout(), "p2");
  assert.deepEqual(next.root, leaf("p1", "lit"));
  assert.equal(next.active, "p1");
});

test("closing a pane out of a nested split collapses the split it leaves", () => {
  const l = mk(cols([0.6, 0.4], leaf("a", "lit"), rows([0.5, 0.5], leaf("b", "mine"), leaf("c", "verse"))));
  const next = closePane(l, "b");
  assert.equal(next.root.split, "columns");
  assert.deepEqual(next.root.children.map((c) => c.pane.id), ["a", "c"]);
  close(next.root.sizes, [0.6, 0.4]);
  assert.equal(arrangementOf(next), "cols-2");
});

test("the last pane can't be closed", () => {
  const l = mk(leaf("p1", "lit"));
  assert.equal(closePane(l, "p1"), l);
});

test("closing the active LIT pane makes another LIT pane active", () => {
  const l = mk(cols([0.4, 0.3, 0.3], leaf("a", "lit"), leaf("b", "lit"), leaf("c", "mine")), "a");
  assert.equal(closePane(l, "a").active, "b");
  // Closing a non-active pane keeps the active one.
  assert.equal(closePane(l, "b").active, "a");
  assert.equal(closePane(l, "c").active, "a");
});

test("closing the only LIT pane leaves no active pane", () => {
  const next = closePane(originalLayout(), "p1");
  assert.equal(next.active, null);
  assert.equal(leaderFor(setKind(next, "p2", "verse"), "p2"), null);
});

// ---- splitPane ------------------------------------------------------------

test("splitting at each edge puts the newcomer on the right side and in the right direction", () => {
  const base = mk(leaf("p1", "lit"));
  const fresh = { id: "p2", kind: "mine", pin: null };
  const cases = [
    ["left", "columns", ["p2", "p1"]],
    ["right", "columns", ["p1", "p2"]],
    ["top", "rows", ["p2", "p1"]],
    ["bottom", "rows", ["p1", "p2"]],
  ];
  for (const [edge, split, order] of cases) {
    const next = splitPane(base, "p1", edge, fresh);
    assert.equal(next.root.split, split, edge);
    assert.deepEqual(next.root.children.map((c) => c.pane.id), order, edge);
    close(next.root.sizes, [0.5, 0.5], edge);
    assert.equal(next.active, "p1", edge);
  }
});

test("a split shares the target's share 50/50", () => {
  const l = mk(cols([0.6, 0.4], leaf("a", "lit"), leaf("b", "mine")));
  const next = splitPane(l, "b", "bottom", { id: "c", kind: "verse", pin: null });
  assert.equal(next.root.split, "columns");
  close(next.root.sizes, [0.6, 0.4]);
  const inner = next.root.children[1];
  assert.equal(inner.split, "rows");
  assert.deepEqual(inner.children.map((c) => c.pane.id), ["b", "c"]);
  close(inner.sizes, [0.5, 0.5]);
});

test("splitting along the split's own direction gives a flat result", () => {
  const l = mk(cols([0.6, 0.4], leaf("a", "lit"), leaf("b", "mine")));
  const next = splitPane(l, "b", "right", { id: "c", kind: "verse", pin: null });
  assert.equal(next.root.split, "columns");
  assert.deepEqual(next.root.children.map((c) => c.pane.id), ["a", "b", "c"]);
  assert.ok(next.root.children.every((c) => c.pane));
  close(next.root.sizes, [0.6, 0.2, 0.2]);
  assert.equal(arrangementOf(next), "cols-3");
  const left = splitPane(l, "a", "left", { id: "c", kind: "verse", pin: null });
  assert.deepEqual(left.root.children.map((c) => c.pane.id), ["c", "a", "b"]);
  close(left.root.sizes, [0.3, 0.3, 0.4]);
});

test("moving an existing pane removes it from its old place", () => {
  const l = applyArrangement(originalLayout(), "cols-3");
  const [a, b, c] = ids(l);
  const next = splitPane(l, a, "top", c);
  assert.equal(panes(next.root).length, 3);
  assert.deepEqual(ids(next).slice().sort(), [a, b, c].slice().sort());
  assert.equal(next.root.split, "columns");
  const first = next.root.children[0];
  assert.equal(first.split, "rows");
  assert.deepEqual(first.children.map((x) => x.pane.id), [c, a]);
  assert.equal(next.root.children[1].pane.id, b);
  close(next.root.sizes, [0.5, 0.5]);
  assert.equal(arrangementOf(next), "two-one-right");
});

test("moving a pane keeps its kind and pin", () => {
  const pin = { at: "Mark 1:1" };
  const l = mk(cols([0.5, 0.5], leaf("a", "lit"), leaf("b", "verse", pin)));
  const next = splitPane(l, "a", "bottom", "b");
  assert.deepEqual(findPane(next.root, "b"), { id: "b", kind: "verse", pin });
  assert.equal(next.root.split, "rows");
});

test("a pane dropped onto itself is a no-op", () => {
  const l = originalLayout();
  assert.equal(splitPane(l, "p1", "right", "p1"), l);
});

test("a new pane when four are open is refused, but moving one is allowed", () => {
  const l = applyArrangement(originalLayout(), "grid");
  assert.equal(panes(l.root).length, MAX_PANES);
  const fresh = { id: "p9", kind: "sheet", pin: null };
  assert.equal(splitPane(l, ids(l)[0], "left", fresh), l);
  const moved = splitPane(l, ids(l)[0], "left", ids(l)[3]);
  assert.notEqual(moved, l);
  assert.equal(panes(moved.root).length, 4);
});

test("an unknown target, edge or moving pane is a no-op", () => {
  const l = originalLayout();
  const fresh = { id: "p9", kind: "verse", pin: null };
  assert.equal(splitPane(l, "nope", "left", fresh), l);
  assert.equal(splitPane(l, "nope", "left", "p2"), l);
  assert.equal(splitPane(l, "p1", "middle", fresh), l);
  assert.equal(splitPane(l, "p1", undefined, fresh), l);
  assert.equal(splitPane(l, "p1", "left", "nope"), l);
});

test("dropping a pane back on the side it already sits changes the order of nothing", () => {
  const l = originalLayout();
  const next = splitPane(l, "p1", "right", "p2");
  assert.deepEqual(ids(next), ["p1", "p2"]);
  assert.equal(next.root.split, "columns");
});

test("splitting the active LIT pane's neighbor leaves active alone; moving the active LIT works", () => {
  const l = originalLayout();
  assert.equal(splitPane(l, "p2", "bottom", { id: "p3", kind: "verse", pin: null }).active, "p1");
  const moved = splitPane(l, "p2", "top", "p1");
  assert.equal(moved.active, "p1");
  assert.deepEqual(ids(moved), ["p1", "p2"]);
  assert.equal(moved.root.split, "rows");
});

// ---- setKind, setPin, setActive, leaderFor --------------------------------

test("setKind changes the kind and drops a pin the new kind doesn't follow", () => {
  const l = mk(cols([0.5, 0.5], leaf("a", "lit"), leaf("b", "verse", { at: "John 1:1" })));
  const greek = setKind(l, "b", "greek");
  assert.equal(findPane(greek.root, "b").kind, "greek");
  assert.deepEqual(findPane(greek.root, "b").pin, { at: "John 1:1" });
  const notes = setKind(l, "b", "mine");
  assert.equal(findPane(notes.root, "b").kind, "mine");
  assert.equal(findPane(notes.root, "b").pin, null);
});

test("setKind with the same kind or an unknown pane returns the layout", () => {
  const l = originalLayout();
  assert.equal(setKind(l, "p1", "lit"), l);
  assert.equal(setKind(l, "nope", "verse"), l);
});

test("setKind away from the active LIT pane settles active", () => {
  const l = mk(cols([0.5, 0.5], leaf("a", "lit"), leaf("b", "lit")), "a");
  assert.equal(setKind(l, "a", "mine").active, "b");
  assert.equal(setKind(originalLayout(), "p1", "mine").active, null);
});

test("setPin only works on following kinds and stores { at }", () => {
  const l = mk(cols([0.34, 0.33, 0.33], leaf("a", "lit"), leaf("b", "verse"), leaf("c", "mine")));
  const pinned = setPin(l, "b", true, "Romans 8:1");
  assert.deepEqual(findPane(pinned.root, "b").pin, { at: "Romans 8:1" });
  assert.deepEqual(findPane(setPin(l, "b", true).root, "b").pin, { at: null });
  assert.deepEqual(findPane(setPin(l, "b", true, 42).root, "b").pin, { at: null });
  assert.equal(findPane(setPin(pinned, "b", false).root, "b").pin, null);
  for (const kind of ["verse", "greek", "footnotes"]) {
    const x = mk(cols([0.5, 0.5], leaf("a", "lit"), leaf("b", kind)));
    assert.deepEqual(findPane(setPin(x, "b", true, "x").root, "b").pin, { at: "x" }, kind);
  }
  assert.equal(setPin(l, "a", true, "x"), l);
  assert.equal(setPin(l, "c", true, "x"), l);
  assert.equal(setPin(l, "nope", true, "x"), l);
  const sheet = mk(cols([0.5, 0.5], leaf("a", "lit"), leaf("b", "sheet")));
  assert.equal(setPin(sheet, "b", true, "x"), sheet);
});

test("setActive only accepts a LIT pane", () => {
  const l = mk(cols([0.34, 0.33, 0.33], leaf("a", "lit"), leaf("b", "lit"), leaf("c", "mine")), "a");
  assert.equal(setActive(l, "b").active, "b");
  assert.equal(setActive(l, "a"), l);
  assert.equal(setActive(l, "c"), l);
  assert.equal(setActive(l, "nope"), l);
});

test("leaderFor is the active LIT pane for an unpinned follower, else null", () => {
  const l = mk(
    cols([0.2, 0.2, 0.2, 0.2, 0.2], leaf("a", "lit"), leaf("b", "verse"), leaf("c", "greek", { at: "John 1:1" }), leaf("d", "mine"), leaf("e", "footnotes")),
    "a",
  );
  assert.equal(leaderFor(l, "b"), "a");
  assert.equal(leaderFor(l, "e"), "a");
  assert.equal(leaderFor(l, "c"), null, "pinned");
  assert.equal(leaderFor(l, "a"), null, "the LIT leads, it doesn't follow");
  assert.equal(leaderFor(l, "d"), null, "not a follower");
  assert.equal(leaderFor(l, "nope"), null);
  assert.equal(leaderFor(setActive(l, "a"), "b"), "a");
});

// ---- sizes ----------------------------------------------------------------

test("one pane is 280 by 160", () => {
  assert.deepEqual(minSize(leaf("a", "lit")), { w: MIN_WIDTH, h: MIN_HEIGHT });
  assert.equal(MIN_WIDTH, 280);
  assert.equal(MIN_HEIGHT, 160);
  assert.equal(HANDLE, 6);
});

test("minSize adds across columns and down rows, with a handle between", () => {
  assert.deepEqual(minSize(originalLayout().root), { w: 280 * 2 + 6, h: 160 });
  const three = applyArrangement(originalLayout(), "cols-3").root;
  assert.deepEqual(minSize(three), { w: 280 * 3 + 12, h: 160 });
  const r2 = applyArrangement(originalLayout(), "rows-2").root;
  assert.deepEqual(minSize(r2), { w: 280, h: 160 * 2 + 6 });
  const grid = applyArrangement(originalLayout(), "grid").root;
  assert.deepEqual(minSize(grid), { w: 280 * 2 + 6, h: 160 * 2 + 6 });
  const oneLeftTwo = applyArrangement(originalLayout(), "one-left-two").root;
  assert.deepEqual(minSize(oneLeftTwo), { w: 280 * 2 + 6, h: 160 * 2 + 6 });
});

test("needs says null, wider, taller or larger for an arrangement id", () => {
  const w = 280 * 2 + 6;
  assert.equal(needs("cols-2", w, 160), null);
  assert.equal(needs("cols-2", w - 1, 160), "wider");
  assert.equal(needs("cols-2", w, 159), "taller");
  assert.equal(needs("cols-2", w - 1, 159), "larger");
  assert.equal(needs("one", 280, 160), null);
  assert.equal(needs("one", 279, 160), "wider");
  assert.equal(needs("rows-2", 280, 160 * 2 + 6), null);
  assert.equal(needs("rows-2", 280, 160 * 2 + 5), "taller");
  assert.equal(needs("grid", 566, 326), null);
  assert.equal(needs("grid", 565, 326), "wider");
  assert.equal(needs("cols-4", 5000, 5000), null);
  assert.equal(needs("nonsense", 1, 1), null);
});

test("needs reads a tree the same way", () => {
  const root = originalLayout().root;
  assert.equal(needs(root, 566, 160), null);
  assert.equal(needs(root, 565, 160), "wider");
  assert.equal(needs(root, 566, 159), "taller");
  assert.equal(needs(root, 100, 100), "larger");
  assert.equal(needs(leaf("a", "lit"), 280, 160), null);
  const grid = applyArrangement(originalLayout(), "grid").root;
  assert.equal(needs(grid, 566, 325), "taller");
});

// ---- resize ---------------------------------------------------------------

test("resize moves only the two children beside the line", () => {
  const l = mk(cols([0.4, 0.3, 0.3], leaf("a", "lit"), leaf("b", "mine"), leaf("c", "verse")));
  const length = 1000 + 2 * HANDLE;
  close(resize(l, [], 0, 10, length).root.sizes, [0.41, 0.29, 0.3]);
  close(resize(l, [], 1, 10, length).root.sizes, [0.4, 0.31, 0.29]);
  close(resize(l, [], 1, -10, length).root.sizes, [0.4, 0.29, 0.31]);
});

test("resize clamps so neither child goes below its minimum", () => {
  const l = originalLayout();
  const length = 1000 + HANDLE;
  const min = 280 / 1000;
  const right = resize(l, [], 0, 100000, length);
  close(right.root.sizes, [1 - min, min]);
  const left = resize(l, [], 0, -100000, length);
  close(left.root.sizes, [min, 1 - min]);
  assert.ok(Math.abs(left.root.sizes.reduce((a, b) => a + b, 0) - 1) < 1e-9);
});

test("resize respects a nested child's larger minimum", () => {
  const l = mk(cols([0.5, 0.5], leaf("a", "lit"), rows([0.5, 0.5], leaf("b", "mine"), cols([0.5, 0.5], leaf("c", "verse"), leaf("d", "greek")))));
  // The right child holds two columns inside, so it needs 566px.
  const next = resize(l, [], 0, 100000, 1000 + HANDLE);
  close(next.root.sizes, [1 - 566 / 1000, 566 / 1000]);
});

test("resize works along rows with heights, on a nested path", () => {
  const l = mk(cols([0.5, 0.5], leaf("a", "lit"), rows([0.5, 0.5], leaf("b", "mine"), leaf("c", "verse"))));
  const length = 400 + HANDLE;
  const next = resize(l, [1], 0, 40, length);
  close(next.root.children[1].sizes, [0.6, 0.4]);
  close(next.root.sizes, [0.5, 0.5]);
  const low = resize(l, [1], 0, -100000, length);
  close(low.root.children[1].sizes, [160 / 400, 1 - 160 / 400]);
});

test("where both minimums can't fit, resize splits the pair by their minimums", () => {
  const l = originalLayout();
  // 400px usable is less than 2 x 280.
  const next = resize(l, [], 0, 50, 400 + HANDLE);
  close(next.root.sizes, [0.5, 0.5]);
  const mixed = mk(cols([0.5, 0.5], leaf("a", "lit"), rows([0.5, 0.5], leaf("b", "mine"), cols([0.5, 0.5], leaf("c", "verse"), leaf("d", "greek")))));
  const squeezed = resize(mixed, [], 0, 999, 600 + HANDLE);
  const minA = 280 / 600;
  const minB = 566 / 600;
  close(squeezed.root.sizes, [minA / (minA + minB), minB / (minA + minB)]);
});

test("resize with a bad index, path or length returns the layout unchanged", () => {
  const l = originalLayout();
  assert.equal(resize(l, [], -1, 10, 1000), l);
  assert.equal(resize(l, [], 1, 10, 1000), l, "no line after the last child");
  assert.equal(resize(l, [], 5, 10, 1000), l);
  assert.equal(resize(l, [7], 0, 10, 1000), l, "no such node");
  assert.equal(resize(l, [0], 0, 10, 1000), l, "a pane has no lines");
  for (const bad of [0, -5, NaN, undefined, null]) assert.equal(resize(l, [], 0, 10, bad), l, String(bad));
  assert.equal(resize(l, [], 0, 10, HANDLE), l, "no room left once the handle is taken");
  assert.equal(resize(l, [], 0, 10, HANDLE - 1), l);
});

test("resize never mutates its input", () => {
  const l = originalLayout();
  const before = structuredClone(l);
  const next = resize(l, [], 0, 100, 1006);
  assert.deepEqual(l, before);
  assert.notEqual(next, l);
  assert.notEqual(next.root, l.root);
});

test("evenOut shares a split's room evenly again", () => {
  const l = mk(cols([0.2, 0.3, 0.5], leaf("a", "lit"), leaf("b", "mine"), leaf("c", "verse")));
  close(evenOut(l, []).root.sizes, [1 / 3, 1 / 3, 1 / 3]);
  const nested = mk(cols([0.7, 0.3], leaf("a", "lit"), rows([0.8, 0.2], leaf("b", "mine"), leaf("c", "verse"))));
  const next = evenOut(nested, [1]);
  close(next.root.children[1].sizes, [0.5, 0.5]);
  close(next.root.sizes, [0.7, 0.3]);
  assert.equal(evenOut(l, [0]), l, "a pane has nothing to even out");
  assert.equal(evenOut(l, [9]), l);
});

// ---- fitSizes -------------------------------------------------------------

test("fitSizes returns the same sizes for a tree that already fits", () => {
  const root = cols([0.5, 0.3, 0.2], leaf("a", "lit"), leaf("b", "mine"), rows([0.7, 0.3], leaf("c", "verse"), leaf("d", "greek")));
  const fitted = fitSizes(root, 3000, 2000);
  close(fitted.sizes, [0.5, 0.3, 0.2]);
  close(fitted.children[2].sizes, [0.7, 0.3]);
  assert.deepEqual(panes(fitted).map((p) => p.id), ["a", "b", "c", "d"]);
  assert.equal(fitted.split, "columns");
  assert.equal(fitted.children[2].split, "rows");
});

test("fitSizes raises a short child to exactly its minimum fraction", () => {
  const root = cols([0.9, 0.1], leaf("a", "lit"), leaf("b", "mine"));
  const fitted = fitSizes(root, 1006, 500);
  const usable = 1006 - HANDLE;
  close(fitted.sizes, [1 - 280 / usable, 280 / usable]);
  const stacked = rows([0.1, 0.9], leaf("a", "lit"), leaf("b", "mine"));
  const down = fitSizes(stacked, 500, 806);
  close(down.sizes, [160 / (806 - HANDLE), 1 - 160 / (806 - HANDLE)]);
});

test("fitSizes takes the room from siblings in proportion to their slack", () => {
  const root = cols([0.1, 0.5, 0.4], leaf("a", "lit"), leaf("b", "mine"), leaf("c", "verse"));
  const fitted = fitSizes(root, 1000 + 2 * HANDLE, 500);
  const min = 0.28;
  const deficit = min - 0.1;
  const slackB = 0.5 - min;
  const slackC = 0.4 - min;
  close(fitted.sizes, [min, 0.5 - (deficit * slackB) / (slackB + slackC), 0.4 - (deficit * slackC) / (slackB + slackC)]);
  assert.ok(Math.abs(fitted.sizes.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(fitted.sizes.every((x) => x >= min - 1e-12));
});

test("fitSizes shares the room by the minimums where they can't all fit", () => {
  const even2 = fitSizes(originalLayout().root, 400, 500);
  close(even2.sizes, [0.5, 0.5]);
  const mixed = cols([0.5, 0.5], leaf("a", "lit"), rows([0.5, 0.5], leaf("b", "mine"), cols([0.5, 0.5], leaf("c", "verse"), leaf("d", "greek"))));
  const fitted = fitSizes(mixed, 600, 800);
  close(fitted.sizes, [280 / 846, 566 / 846]);
  // Too short for two rows as well.
  const tall = rows([0.8, 0.2], leaf("a", "lit"), leaf("b", "mine"));
  close(fitSizes(tall, 500, 100).sizes, [0.5, 0.5]);
});

test("fitSizes recurses, fitting a nested split against its own pixel share", () => {
  const root = cols([0.5, 0.5], leaf("a", "lit"), rows([0.5, 0.5], leaf("b", "mine"), cols([0.9, 0.1], leaf("c", "verse"), leaf("d", "greek"))));
  const fitted = fitSizes(root, 1200, 700);
  close(fitted.sizes, [0.5, 0.5]);
  const inner = fitted.children[1].children[1];
  // The inner columns get half of the outer's usable width.
  const usable = (1200 - HANDLE) * 0.5 - HANDLE;
  const min = 280 / usable;
  close(inner.sizes, [0.9 - (min - 0.1), min]);
  // Its row sizes were never short, so they stay.
  close(fitted.children[1].sizes, [0.5, 0.5]);
});

test("fitSizes raises a nested split's column to the pixels it needs, then fits that split inside", () => {
  // 1000px: the right column holds two panes and needs 566px, more than its half.
  const root = cols([0.5, 0.5], leaf("a", "lit"), cols([0.5, 0.5], leaf("b", "mine"), leaf("c", "verse")));
  const fitted = fitSizes(root, 1000, 500);
  close(fitted.sizes, [1 - 566 / 994, 566 / 994]);
  close(fitted.children[1].sizes, [0.5, 0.5]);
});

test("fitSizes gives a lone pane back as it is", () => {
  const p = leaf("a", "lit");
  assert.equal(fitSizes(p, 10, 10), p);
});

test("fitSizes doesn't mutate its input and returns a new tree", () => {
  const root = cols([0.9, 0.1], leaf("a", "lit"), rows([0.95, 0.05], leaf("b", "mine"), leaf("c", "verse")));
  const before = structuredClone(root);
  const fitted = fitSizes(root, 700, 500);
  assert.deepEqual(root, before);
  assert.notEqual(fitted, root);
  assert.notEqual(fitted.sizes, root.sizes);
});

test("fitSizes on a dragged grid gives the left column exactly its minimum", () => {
  const grid = applyArrangement(originalLayout(), "grid");
  const dragged = splitPane(grid, "p1", "left", "p4");
  assert.equal(panes(dragged.root).length, 4);
  const fitted = fitSizes(dragged.root, 1123, 496);
  assert.equal(fitted.split, "columns");
  close(fitted.sizes, [(280 * 2 + 6) / (1123 - 6), 1 - (280 * 2 + 6) / (1123 - 6)]);
  // The left column's own children fit exactly, too.
  const left = fitted.children[0];
  assert.equal(left.split, "rows");
  assert.equal(left.children[0].split, "columns");
  close(left.children[0].sizes, [0.5, 0.5]);
});

// ---- keeping it -----------------------------------------------------------

test("the storage key is the one /privacy names", () => {
  assert.equal(LAYOUT_KEY, "lit-desk-layout");
});

test("a layout round-trips through writeSaved and readSaved", () => {
  const last = applyArrangement(originalLayout(), "grid");
  const mine = originalLayout();
  const text = writeSaved({ last, mine, start: "default" });
  const saved = readSaved(text);
  assert.deepEqual(saved.last, last);
  assert.deepEqual(saved.mine, mine);
  assert.equal(saved.start, "default");
  assert.deepEqual(checkLayout(originalLayout()), originalLayout());
});

test("a pin and an unknown kind survive a round trip", () => {
  const l = mk(cols([0.5, 0.5], leaf("a", "lit"), leaf("b", "greek", { at: "John 1:1" })), "a");
  assert.deepEqual(checkLayout(structuredClone(l)), l);
});

test("checkLayout rejects what isn't a layout", () => {
  for (const bad of [null, undefined, "x", 5, true, {}, { root: null }, { root: "x" }, { root: {} }, []]) {
    assert.equal(checkLayout(bad), null, JSON.stringify(bad));
  }
});

test("checkLayout rejects duplicate ids", () => {
  const dup = { root: cols([0.5, 0.5], leaf("a", "lit"), leaf("a", "mine")), active: "a" };
  assert.equal(checkLayout(dup), null);
});

test("checkLayout rejects more than four panes", () => {
  const five = { root: cols([0.2, 0.2, 0.2, 0.2, 0.2], ...["a", "b", "c", "d", "e"].map((i) => leaf(i, "mine"))), active: null };
  assert.equal(checkLayout(five), null);
  const four = { root: cols([0.25, 0.25, 0.25, 0.25], ...["a", "b", "c", "d"].map((i) => leaf(i, "mine"))), active: null };
  assert.ok(checkLayout(four));
});

test("checkLayout rejects a split with fewer than two children", () => {
  assert.equal(checkLayout({ root: { split: "columns", sizes: [1], children: [leaf("a", "lit")] }, active: "a" }), null);
  assert.equal(checkLayout({ root: { split: "columns", sizes: [], children: [] }, active: null }), null);
  assert.equal(checkLayout({ root: { split: "columns", sizes: [1, 1] }, active: null }), null);
  const inner = cols([0.5, 0.5], leaf("a", "lit"), { split: "rows", sizes: [1], children: [leaf("b", "mine")] });
  assert.equal(checkLayout({ root: inner, active: "a" }), null);
});

test("checkLayout rejects a bad split name", () => {
  const bad = { root: { split: "diagonal", sizes: [0.5, 0.5], children: [leaf("a", "lit"), leaf("b", "mine")] }, active: "a" };
  assert.equal(checkLayout(bad), null);
});

test("checkLayout rejects non-string or empty ids and kinds", () => {
  assert.equal(checkLayout({ root: leaf("a", 5), active: null }), null);
  assert.equal(checkLayout({ root: leaf("a", ""), active: null }), null);
  assert.equal(checkLayout({ root: leaf("a", null), active: null }), null);
  assert.equal(checkLayout({ root: leaf(1, "lit"), active: null }), null);
  assert.equal(checkLayout({ root: leaf("", "lit"), active: null }), null);
  assert.equal(checkLayout({ root: cols([0.5, 0.5], leaf("a", "lit"), leaf("b", ["mine"])), active: "a" }), null);
});

test("checkLayout keeps a kind it doesn't know", () => {
  const l = checkLayout({ root: cols([0.5, 0.5], leaf("a", "lit"), leaf("b", "timeline")), active: "a" });
  assert.equal(findPane(l.root, "b").kind, "timeline");
});

test("checkLayout drops a pin on a kind that doesn't follow, and cleans one that does", () => {
  const l = checkLayout({
    root: cols([0.25, 0.25, 0.25, 0.25], leaf("a", "lit", { at: "x" }), leaf("b", "verse", { at: "John 3:16", extra: 1 }), leaf("c", "greek", { at: 5 }), leaf("d", "footnotes", "nope")),
    active: "a",
  });
  assert.equal(findPane(l.root, "a").pin, null);
  assert.deepEqual(findPane(l.root, "b").pin, { at: "John 3:16" });
  assert.deepEqual(findPane(l.root, "c").pin, { at: null });
  assert.equal(findPane(l.root, "d").pin, null);
});

test("checkLayout replaces bad sizes with even ones", () => {
  const make = (sizes) => checkLayout({ root: { split: "columns", sizes, children: [leaf("a", "lit"), leaf("b", "mine")] }, active: "a" });
  for (const sizes of [undefined, [1], [0.5, 0.5, 0], [0, 1], [-1, 2], ["a", "b"], [NaN, 1], [Infinity, 1], "x"]) {
    close(make(sizes).root.sizes, [0.5, 0.5], JSON.stringify(sizes));
  }
  close(make([0.7, 0.3]).root.sizes, [0.7, 0.3]);
  close(make([1, 3]).root.sizes, [0.25, 0.75], "sizes that don't sum to 1 are scaled");
});

test("checkLayout normalizes the tree it reads", () => {
  const l = checkLayout({ root: cols([0.5, 0.5], cols([0.5, 0.5], leaf("a", "lit"), leaf("b", "mine")), leaf("c", "verse")), active: "a" });
  assert.deepEqual(l.root.children.map((c) => c.pane.id), ["a", "b", "c"]);
  close(l.root.sizes, [0.25, 0.25, 0.5]);
});

test("checkLayout settles the active pane", () => {
  const root = () => cols([0.5, 0.5], leaf("a", "mine"), leaf("b", "lit"));
  assert.equal(checkLayout({ root: root(), active: "b" }).active, "b");
  assert.equal(checkLayout({ root: root(), active: "a" }).active, "b", "a pane that isn't LIT");
  assert.equal(checkLayout({ root: root(), active: "zzz" }).active, "b");
  assert.equal(checkLayout({ root: root(), active: 7 }).active, "b");
  assert.equal(checkLayout({ root: root() }).active, "b");
  assert.equal(checkLayout({ root: cols([0.5, 0.5], leaf("a", "mine"), leaf("b", "verse")), active: "a" }).active, null);
});

test("checkLayout accepts a single pane", () => {
  assert.deepEqual(checkLayout({ root: leaf("a", "lit"), active: "a" }), { root: leaf("a", "lit"), active: "a" });
});

test("readSaved of garbage gives nothing saved and the 'last' start", () => {
  const empty = { last: null, mine: null, start: "last" };
  for (const text of ["not json", "", "{", "null", "5", "[]", '"x"', undefined, null, "{}"]) {
    assert.deepEqual(readSaved(text), empty, String(text));
  }
});

test("readSaved checks last and mine separately", () => {
  const good = originalLayout();
  const text = JSON.stringify({ last: { root: { split: "bad" } }, mine: good, start: "default" });
  const saved = readSaved(text);
  assert.equal(saved.last, null);
  assert.deepEqual(saved.mine, good);
  assert.equal(saved.start, "default");
});

test("start 'default' without a saved default reads as 'last'", () => {
  const text = JSON.stringify({ last: originalLayout(), mine: null, start: "default" });
  assert.equal(readSaved(text).start, "last");
  const badMine = JSON.stringify({ last: originalLayout(), mine: { nope: 1 }, start: "default" });
  assert.equal(readSaved(badMine).start, "last");
  assert.equal(readSaved(JSON.stringify({ mine: originalLayout(), start: "whatever" })).start, "last");
});

test("writeSaved writes the saved state as text", () => {
  const parsed = JSON.parse(writeSaved({ last: originalLayout(), mine: null, start: "default" }));
  assert.equal(parsed.v, 1);
  assert.equal(parsed.start, "default");
  assert.deepEqual(parsed.last, originalLayout());
  assert.equal(parsed.mine, null);
  const odd = JSON.parse(writeSaved({ start: "weird" }));
  assert.equal(odd.start, "last");
  assert.equal(odd.last, null);
  assert.equal(odd.mine, null);
  assert.equal(JSON.parse(writeSaved({ last: null, mine: null, start: undefined })).start, "last");
});

test("openingLayout picks the default, the last, or the original", () => {
  const last = applyArrangement(originalLayout(), "rows-2");
  const mine = applyArrangement(originalLayout(), "cols-3");
  assert.equal(openingLayout({ last, mine, start: "default" }), mine);
  assert.equal(openingLayout({ last, mine, start: "last" }), last);
  assert.equal(openingLayout({ last: null, mine, start: "last" }), mine);
  assert.equal(openingLayout({ last, mine: null, start: "default" }), last);
  assert.deepEqual(openingLayout({ last: null, mine: null, start: "last" }), originalLayout());
  assert.deepEqual(openingLayout(readSaved("garbage")), originalLayout());
});

// ---- purity ---------------------------------------------------------------

test("no changer mutates the layout it is given", () => {
  const layouts = [
    originalLayout(),
    applyArrangement(originalLayout(), "grid"),
    mk(cols([0.2, 0.3, 0.5], leaf("a", "lit"), leaf("b", "verse", { at: "John 1:1" }), rows([0.5, 0.5], leaf("c", "mine"), leaf("d", "greek")))),
  ];
  for (const l of layouts) {
    const [first, second] = ids(l);
    const last = ids(l).at(-1);
    const calls = {
      applyArrangement: () => ARRANGEMENTS.map((a) => applyArrangement(l, a.id)),
      closePane: () => ids(l).map((id) => closePane(l, id)),
      splitPaneNew: () => ["left", "right", "top", "bottom"].map((e) => splitPane(l, first, e, { id: "pz", kind: "sheet", pin: null })),
      splitPaneMove: () => ["left", "right", "top", "bottom"].map((e) => splitPane(l, first, e, last)),
      setKind: () => ids(l).flatMap((id) => KINDS.map((k) => setKind(l, id, k.kind))),
      setPin: () => ids(l).flatMap((id) => [setPin(l, id, true, "John 3:16"), setPin(l, id, false)]),
      setActive: () => ids(l).map((id) => setActive(l, id)),
      resize: () => [resize(l, [], 0, 120, 1006), resize(l, [], 0, -99999, 1006), resize(l, [1], 0, 30, 500)],
      evenOut: () => [evenOut(l, []), evenOut(l, [1])],
      normalize: () => [normalize(l.root)],
      newPane: () => [newPane(l, "lit")],
      checkLayout: () => [checkLayout(l)],
      leaderFor: () => ids(l).map((id) => leaderFor(l, id)),
    };
    for (const [name, run] of Object.entries(calls)) {
      const before = structuredClone(l);
      run();
      assert.deepEqual(l, before, `${name} left its input alone`);
    }
    assert.ok(second === undefined || typeof second === "string");
  }
});

test("a changer's result doesn't share structure that later changes would corrupt", () => {
  const l = originalLayout();
  const next = setKind(l, "p2", "verse");
  next.root.sizes[0] = 0.99;
  findPane(next.root, "p1").kind = "mine";
  assert.deepEqual(l, originalLayout());
});

// ---- the shared place (3d) ------------------------------------------------

test("the kept kind is labeled with a curly apostrophe and does not follow", () => {
  const entry = KINDS.find((k) => k.kind === "kept");
  assert.ok(entry);
  assert.equal(entry.label, "What I\u2019ve kept");
  assert.equal(entry.follows, false);
  assert.equal(kindLabel("kept"), "What I\u2019ve kept");
  assert.equal(isFollower("kept"), false);
});

test("setPlace sets the place the following panes share", () => {
  const l = originalLayout();
  const next = setPlace(l, "john 3:16");
  assert.equal(next.place, "john 3:16");
  assert.equal(next.active, l.active);
  assert.deepEqual(next.root, l.root);
  assert.equal(setPlace(next, "mark 1").place, "mark 1");
});

test("setPlace returns the same object when nothing changes", () => {
  const l = setPlace(originalLayout(), "john 3:16");
  assert.equal(setPlace(l, "john 3:16"), l);
});

test("setPlace ignores a value that is not a non-empty string", () => {
  const l = originalLayout();
  for (const bad of [undefined, null, "", 5, {}, ["john 3"], true]) {
    assert.equal(setPlace(l, bad), l, String(bad));
  }
  const placed = setPlace(l, "john 3");
  assert.equal(setPlace(placed, ""), placed);
  assert.equal(setPlace(placed, null), placed);
});

test("setPlace does not mutate its input", () => {
  const l = originalLayout();
  const before = structuredClone(l);
  const next = setPlace(l, "john 3:16");
  assert.deepEqual(l, before);
  assert.notEqual(next, l);
  assert.equal("place" in l, false);
});

test("placeFor is null for a pane that does not follow, or does not exist", () => {
  const l = setPlace(mk(cols([0.25, 0.25, 0.25, 0.25], leaf("a", "lit"), leaf("b", "mine"), leaf("c", "sheet"), leaf("d", "kept"))), "john 3:16");
  for (const id of ["a", "b", "c", "d", "nope"]) assert.equal(placeFor(l, id), null, id);
});

test("placeFor gives an unpinned following pane the shared place", () => {
  const l = setPlace(mk(cols([0.25, 0.25, 0.25, 0.25], leaf("a", "lit"), leaf("b", "verse"), leaf("c", "greek"), leaf("d", "footnotes"))), "john 3:16");
  for (const id of ["b", "c", "d"]) assert.equal(placeFor(l, id), "john 3:16", id);
});

test("placeFor gives a pinned pane its own passage", () => {
  const l = setPlace(mk(cols([0.5, 0.25, 0.25], leaf("a", "lit"), leaf("b", "verse", { at: "romans 8:1" }), leaf("c", "greek"))), "john 3:16");
  assert.equal(placeFor(l, "b"), "romans 8:1");
  assert.equal(placeFor(l, "c"), "john 3:16");
});

test("placeFor falls back to the shared place for a pin with no passage yet", () => {
  const l = setPlace(mk(cols([0.5, 0.5], leaf("a", "lit"), leaf("b", "verse", { at: null }))), "john 3:16");
  assert.equal(placeFor(l, "b"), "john 3:16");
});

test("placeFor is null when no place is set anywhere", () => {
  const l = mk(cols([0.5, 0.5], leaf("a", "lit"), leaf("b", "verse")));
  assert.equal(placeFor(l, "b"), null);
  const pinnedNone = mk(cols([0.5, 0.5], leaf("a", "lit"), leaf("b", "verse", { at: null })));
  assert.equal(placeFor(pinnedNone, "b"), null);
  const pinned = mk(cols([0.5, 0.5], leaf("a", "lit"), leaf("b", "verse", { at: "mark 1" })));
  assert.equal(placeFor(pinned, "b"), "mark 1");
});

test("the shared place survives applyArrangement, closePane and splitPane", () => {
  const base = setPlace(applyArrangement(originalLayout(), "cols-3"), "john 3:16");
  assert.equal(base.place, "john 3:16");
  for (const a of ARRANGEMENTS) assert.equal(applyArrangement(base, a.id).place, "john 3:16", a.id);
  assert.equal(closePane(base, ids(base)[1]).place, "john 3:16");
  const [a, b, c] = ids(base);
  assert.equal(splitPane(base, a, "top", c).place, "john 3:16", "moving an open pane");
  assert.equal(splitPane(base, b, "bottom", { id: "p9", kind: "verse", pin: null }).place, "john 3:16", "adding a new pane");
  assert.equal(setKind(base, b, "verse").place, "john 3:16");
  assert.equal(setPin(setKind(base, b, "verse"), b, true, "mark 1").place, "john 3:16");
  assert.equal(setActive(base, a).place, "john 3:16");
});

test("checkLayout keeps a string place and drops anything else", () => {
  const root = () => cols([0.5, 0.5], leaf("a", "lit"), leaf("b", "verse"));
  assert.equal(checkLayout({ root: root(), active: "a", place: "john 3:16" }).place, "john 3:16");
  for (const bad of [undefined, null, "", 5, {}, ["john 3"], true]) {
    const l = checkLayout({ root: root(), active: "a", place: bad });
    assert.equal("place" in l, false, String(bad));
  }
  assert.equal("place" in checkLayout({ root: root(), active: "a" }), false);
});

test("a place round-trips through writeSaved and readSaved", () => {
  const last = setPlace(applyArrangement(originalLayout(), "grid"), "john 3:16");
  const mine = setPlace(originalLayout(), "romans 8");
  const saved = readSaved(writeSaved({ last, mine, start: "last" }));
  assert.equal(saved.last.place, "john 3:16");
  assert.equal(saved.mine.place, "romans 8");
  assert.deepEqual(saved.last, last);
  assert.deepEqual(saved.mine, mine);
  const plain = readSaved(writeSaved({ last: originalLayout(), mine: null, start: "last" }));
  assert.equal("place" in plain.last, false);
});

// Phase 3e: each LIT pane keeps its reader's place, and the active one leads.

// Two LIT panes: p1 (active) and p3, the new one beside My Notes (p2).
const twoLit = () => {
  const layout = originalLayout();
  return splitPane(layout, "p2", "right", newPane(layout, "lit"));
};

test("setLitAt on the active LIT pane sets its place and the shared place to the same passage", () => {
  const l = originalLayout();
  const before = structuredClone(l);
  const next = setLitAt(l, "p1", "john 3:16");
  assert.equal(findPane(next.root, "p1").at, "john 3:16");
  assert.equal(next.place, "john 3:16");
  assert.equal(next.active, "p1");
  assert.deepEqual(l, before, "the original layout is not mutated");
  assert.equal("place" in l, false);
  assert.equal("at" in findPane(l.root, "p1"), false);
});

test("setLitAt on a LIT pane that is not active sets its place and leaves the shared place alone", () => {
  const withPlace = setPlace(twoLit(), "mark 1");
  const next = setLitAt(withPlace, "p3", "romans 8:1");
  assert.equal(findPane(next.root, "p3").at, "romans 8:1");
  assert.equal(next.place, "mark 1");
  assert.equal(next.active, "p1");
  assert.equal(findPane(next.root, "p1").at, undefined);
  assert.equal("place" in setLitAt(twoLit(), "p3", "romans 8:1"), false, "no shared place is added");
});

test("setLitAt returns the same layout for a non-LIT pane, a bad passage, or no change", () => {
  const l = twoLit();
  assert.equal(setLitAt(l, "p2", "john 3:16"), l, "My Notes has no place");
  assert.equal(setLitAt(l, "nope", "john 3:16"), l, "no such pane");
  for (const bad of [undefined, null, "", 5, {}, ["john 3:16"]]) {
    assert.equal(setLitAt(l, "p1", bad), l, String(bad));
  }
  const set = setLitAt(l, "p1", "john 3:16");
  assert.equal(setLitAt(set, "p1", "john 3:16"), set, "the active pane's same passage again");
  const other = setLitAt(set, "p3", "romans 8:1");
  assert.equal(setLitAt(other, "p3", "romans 8:1"), other, "a non-active LIT pane's same passage again");
});

test("setActive to the other LIT pane copies its passage into the shared place", () => {
  const l = setLitAt(twoLit(), "p3", "romans 8:1");
  const next = setActive(l, "p3");
  assert.equal(next.active, "p3");
  assert.equal(next.place, "romans 8:1");
});

test("setActive to a LIT pane with no passage leaves the shared place unchanged", () => {
  const l = setPlace(twoLit(), "mark 1");
  const next = setActive(l, "p3");
  assert.equal(next.active, "p3");
  assert.equal(next.place, "mark 1");
});

test("litPlace is the pane's own passage, else the shared place, and null for a non-LIT pane", () => {
  const l = setPlace(setLitAt(twoLit(), "p3", "romans 8:1"), "mark 1");
  assert.equal(litPlace(l, "p3"), "romans 8:1");
  assert.equal(litPlace(l, "p1"), "mark 1", "no passage of its own: the shared place");
  assert.equal(litPlace(l, "p2"), null, "My Notes is not a LIT pane");
  assert.equal(litPlace(l, "nope"), null);
  assert.equal(litPlace(twoLit(), "p1"), null, "no passage anywhere");
});

test("a following pane gets the active LIT pane's passage once it is set", () => {
  const withGreek = splitPane(originalLayout(), "p2", "bottom", { id: "p3", kind: "greek", pin: null });
  assert.equal(placeFor(withGreek, "p3"), null);
  const next = setLitAt(withGreek, "p1", "john 3:16");
  assert.equal(placeFor(next, "p3"), "john 3:16");
});

test("closing the active LIT pane makes the other LIT pane active, and its passage the shared place", () => {
  const l = setLitAt(twoLit(), "p3", "romans 8:1");
  const next = closePane(l, "p1");
  assert.deepEqual(ids(next), ["p2", "p3"]);
  assert.equal(next.active, "p3");
  assert.equal(next.place, "romans 8:1");
});

test("setKind drops a LIT pane's passage, and changing it back starts with none", () => {
  const l = setLitAt(twoLit(), "p3", "romans 8:1");
  assert.equal(findPane(l.root, "p3").at, "romans 8:1");
  const notes = setKind(l, "p3", "mine");
  assert.equal(findPane(notes.root, "p3").kind, "mine");
  assert.equal("at" in findPane(notes.root, "p3"), false);
  const back = setKind(notes, "p3", "lit");
  assert.equal(findPane(back.root, "p3").kind, "lit");
  assert.equal("at" in findPane(back.root, "p3"), false);
  assert.equal(litPlace(back, "p3"), null);
});

test("checkLayout keeps a LIT pane's passage and the shared place, and drops a passage that is not one", () => {
  const root = {
    split: "columns",
    sizes: [0.34, 0.33, 0.33],
    children: [
      { pane: { id: "a", kind: "lit", pin: null, at: "john 3:16" } },
      { pane: { id: "b", kind: "mine", pin: null, at: "romans 8:1" } },
      { pane: { id: "c", kind: "lit", pin: null, at: 5 } },
    ],
  };
  const l = checkLayout({ root, active: "a", place: "john 3:16" });
  assert.equal(findPane(l.root, "a").at, "john 3:16");
  assert.equal("at" in findPane(l.root, "b"), false, "a passage on My Notes is dropped");
  assert.equal("at" in findPane(l.root, "c"), false, "a passage that is not a string is dropped");
  assert.equal(l.place, "john 3:16");
});

// ---- the sheet a Sheet pane shows (3f) ----

const withSheetPane = () => {
  const layout = originalLayout();
  return setKind(layout, "p2", "sheet");
};

test("setPaneSheet sets and clears the sheet a Sheet pane shows, without mutating", () => {
  const l = withSheetPane();
  const before = structuredClone(l);
  const next = setPaneSheet(l, "p2", "sheet-1");
  assert.equal(findPane(next.root, "p2").sheet, "sheet-1");
  assert.deepEqual(l, before);
  const cleared = setPaneSheet(next, "p2", null);
  assert.equal("sheet" in findPane(cleared.root, "p2"), false);
});

test("setPaneSheet leaves other kinds, and an unchanged sheet, alone", () => {
  const l = withSheetPane();
  assert.equal(setPaneSheet(l, "p1", "sheet-1"), l, "a LIT pane has no sheet");
  assert.equal(setPaneSheet(l, "nope", "sheet-1"), l);
  const one = setPaneSheet(l, "p2", "sheet-1");
  assert.equal(setPaneSheet(one, "p2", "sheet-1"), one);
  assert.equal(setPaneSheet(l, "p2", ""), l, "an empty id is no sheet, which it already shows");
});

test("setKind drops a Sheet pane's sheet", () => {
  const l = setPaneSheet(withSheetPane(), "p2", "sheet-1");
  const next = setKind(l, "p2", "mine");
  assert.equal("sheet" in findPane(next.root, "p2"), false);
});

test("checkLayout keeps a Sheet pane's sheet and drops one anywhere else", () => {
  const l = checkLayout(mk(cols([0.5, 0.5], { pane: { id: "a", kind: "sheet", sheet: "s-1" } }, { pane: { id: "b", kind: "mine", sheet: "s-2" } })));
  assert.equal(findPane(l.root, "a").sheet, "s-1");
  assert.equal("sheet" in findPane(l.root, "b"), false);
  const bad = checkLayout(mk(cols([0.5, 0.5], { pane: { id: "a", kind: "sheet", sheet: 7 } }, leaf("b", "mine"))));
  assert.equal("sheet" in findPane(bad.root, "a"), false);
});
