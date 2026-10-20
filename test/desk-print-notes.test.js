import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHANGED_NOTE,
  LOST_NOTE,
  LOST_VERSE_NOTE,
  PRINT_QUOTE_WORDS,
  blockForVerse,
  planNotes,
  printHeading,
  standing,
} from "../src/lib/desk-print-notes.mjs";

test("a note stands where its words are, or says they have changed, or lost", () => {
  assert.equal(standing("found"), "here");
  assert.equal(standing("moved"), "here");
  assert.equal(standing("changed"), "changed", "found between its edges, with other words between");
  assert.equal(standing("verse"), "changed", "only its verses were found");
  assert.equal(standing("lost"), "lost");
  assert.equal(standing("anything else"), "lost", "an unknown status is never trusted");
});

test("a printed note leads with its reference and a short quotation", () => {
  const record = { quote: { exact: "nothing is now a verdict against those in Christ Jesus, for the law", prefix: "", suffix: "" } };
  const h = printHeading(record, "Romans 8:1");
  assert.equal(h.ref, "Romans 8:1");
  assert.equal(h.quote.split(" ").length, PRINT_QUOTE_WORDS);
  assert.ok(h.quote.endsWith("…"), "cut where it was longer");
  assert.equal(h.warning, "");
});

test("a note on whole verses has no quotation", () => {
  assert.deepEqual(printHeading({ verse: 3 }, "Romans 8:3"), { ref: "Romans 8:3", quote: "", warning: "" });
  assert.equal(printHeading({ quote: null }, "Romans 8:3").quote, "");
});

test("a short quotation is whole", () => {
  assert.equal(printHeading({ quote: { exact: "a verdict" } }, "Romans 8:1").quote, "a verdict");
});

test("a note whose words moved on says so, and so does one whose words are gone", () => {
  assert.equal(printHeading({}, "Romans 8:1", "changed").warning, CHANGED_NOTE);
  assert.equal(printHeading({ quote: { exact: "a verdict" } }, "Romans 8:1", "lost").warning, LOST_NOTE);
  assert.equal(printHeading({}, "Romans 8:1", "here").warning, "");
});

test("a lost note with no quotation names its verse, not its words", () => {
  assert.equal(printHeading({ verse: 99 }, "Romans 8:99", "lost").warning, LOST_VERSE_NOTE);
});

test("a verse is found in the first block that holds it", () => {
  const blocks = [[1, 2], [3], [3, 4], [5]];
  assert.equal(blockForVerse(blocks, 2), 0);
  assert.equal(blockForVerse(blocks, 3), 1, "a verse running over a break counts where it begins");
  assert.equal(blockForVerse(blocks, 5), 3);
  assert.equal(blockForVerse(blocks, 9), null);
});

test("a range takes the first of its verses the page has", () => {
  const blocks = [[1], [3], [4]];
  assert.equal(blockForVerse(blocks, 2, 4), 1, "verse 2 is a gap, so 3");
  assert.equal(blockForVerse(blocks, 7, 9), null);
  assert.equal(blockForVerse(blocks, 4, 2), 2, "a backwards range is read as one verse");
  assert.equal(blockForVerse(blocks, null), null);
  assert.equal(blockForVerse(blocks, undefined, 4), null);
});

const item = (id, block, offset, verse, rank) => ({ id, block, offset, verse, rank });

test("notes go beside their blocks, in the order of the blocks", () => {
  const plan = planNotes([item("c", 4, 300, 6, 2), item("a", 0, 10, 1, 0), item("b", 4, 280, 6, 1)]);
  assert.deepEqual(plan.rows, [
    { block: 0, ids: ["a"] },
    { block: 4, ids: ["b", "c"] },
  ]);
  assert.deepEqual(plan.strays, []);
});

test("within a block, notes read in the order of their first words", () => {
  const plan = planNotes([
    item("late", 2, 90, 5, 0),
    item("early", 2, 20, 4, 1),
    item("whole verse", 2, null, 4, 2),
  ]);
  assert.deepEqual(plan.rows[0].ids, ["early", "late", "whole verse"], "a note with no words goes last");
});

test("two notes on the same words keep the order they were made in", () => {
  const plan = planNotes([item("second", 1, 40, 2, 5), item("first", 1, 40, 2, 3)]);
  assert.deepEqual(plan.rows[0].ids, ["first", "second"]);
});

test("a note with no block goes to the end, in the notebook's order", () => {
  const plan = planNotes([item("x", null, null, 40, 7), item("a", 0, 1, 1, 0), item("y", null, null, 41, 2)]);
  assert.deepEqual(plan.rows, [{ block: 0, ids: ["a"] }]);
  assert.deepEqual(plan.strays, ["y", "x"]);
});

test("nothing in, nothing out", () => {
  assert.deepEqual(planNotes([]), { rows: [], strays: [] });
});

test("a note on a footnote quotes the footnote's opening words in print", () => {
  const onFn = { kind: "note", footnote: "The Greek sarx means flesh, body, and the self in Paul.", body: "mine", marker: "note" };
  assert.equal(printHeading(onFn, "Romans 8:3").quote, "The Greek sarx means flesh, body, and the…");
  assert.equal(printHeading({ kind: "note", footnote: "The Greek sarx means flesh." }, "Romans 8:3").quote, "The Greek sarx means flesh.", "a short footnote is whole");
});
