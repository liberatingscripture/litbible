// Site 2.0's glossary pane (src/scripts/v2-glossary.js): the pure parts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { orderRail, scrollToShow, sortKeyOf } from "../src/scripts/v2-glossary.js";

test("sortKeyOf reads the switch as the page does", () => {
  assert.equal(sortKeyOf("true"), "traditional");
  assert.equal(sortKeyOf("false"), "lit");
  assert.equal(sortKeyOf(null), "lit");
});

test("orderRail sorts by the label for the key, as the entries are sorted", () => {
  const items = [
    { id: "a", lit: "Liberation", traditional: "Salvation" },
    { id: "b", lit: "Alignment / Justice", traditional: "Righteousness" },
    { id: "c", lit: "Messenger", traditional: "Angel" },
  ];
  assert.deepEqual(orderRail(items, "lit").map((i) => i.id), ["b", "a", "c"]);
  assert.deepEqual(orderRail(items, "traditional").map((i) => i.id), ["c", "b", "a"]);
  // A copy: the input keeps its order.
  assert.deepEqual(items.map((i) => i.id), ["a", "b", "c"]);
});

test("orderRail matches localeCompare on the same strings", () => {
  const labels = ["Good -2-", "Good -1-", "Gehenna/Hell", "gentiles", "Glory"];
  const items = labels.map((l) => ({ lit: l }));
  assert.deepEqual(
    orderRail(items, "lit").map((i) => i.lit),
    [...labels].sort((a, b) => a.localeCompare(b)),
  );
});

test("scrollToShow leaves an item in view alone", () => {
  assert.equal(scrollToShow(100, 400, 200, 30), 100);
});

test("scrollToShow brings an item above the view down into it", () => {
  assert.equal(scrollToShow(300, 400, 120, 30), 112);
  assert.equal(scrollToShow(10, 400, 4, 30), 0);
});

test("scrollToShow brings an item below the view up into it", () => {
  assert.equal(scrollToShow(0, 400, 500, 30), 138);
});
