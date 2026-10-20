// test/desk-corpus.test.js — the LIT pane's corpus (src/lib/desk-corpus.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";

import { BOOKS, BOOK_ORDER } from "../src/data/books.js";
import { corpusUnits, draftStubText, unitHeading, unitIndex } from "../src/lib/desk-corpus.mjs";

const drafts = { luke: [23, 24], acts: Array.from({ length: 28 }, (_, i) => i + 1), john: [5] };

test("with no drafts, every chapter of the New Testament is one unit, in order", () => {
  const units = corpusUnits({});
  const total = BOOK_ORDER.reduce((n, b) => n + BOOKS[b], 0);
  assert.equal(units.length, total);
  assert.deepEqual(units[0], { bookKey: "matthew", chapters: [1], draft: false });
  assert.deepEqual(units.at(-1), { bookKey: "revelation", chapters: [22], draft: false });
  assert.ok(units.every((u) => !u.draft && u.chapters.length === 1));
});

test("a run of drafts in one book is one unit, and runs never cross books", () => {
  const units = corpusUnits(drafts);
  const luke = units.filter((u) => u.bookKey === "luke");
  assert.deepEqual(luke.at(-1), { bookKey: "luke", chapters: [23, 24], draft: true });
  const acts = units.filter((u) => u.bookKey === "acts");
  assert.equal(acts.length, 1);
  assert.equal(acts[0].chapters.length, 28);
  // John 5 alone, between published chapters.
  const i = unitIndex(units, "john", 5);
  assert.deepEqual(units[i], { bookKey: "john", chapters: [5], draft: true });
  assert.deepEqual(units[i - 1].chapters, [4]);
  assert.deepEqual(units[i + 1].chapters, [6]);
});

test("every chapter in a draft run finds its stub", () => {
  const units = corpusUnits(drafts);
  assert.equal(unitIndex(units, "acts", 1), unitIndex(units, "acts", 17));
  assert.equal(unitIndex(units, "luke", 23), unitIndex(units, "luke", 24));
  assert.equal(unitIndex(units, "jude", 2), -1);
});

test("headings and stub wording", () => {
  const units = corpusUnits(drafts);
  const at = (b, c) => units[unitIndex(units, b, c)];
  assert.equal(unitHeading(at("john", 3)), "John 3");
  assert.equal(unitHeading(at("luke", 24)), "Luke 23–24");
  assert.equal(unitHeading(at("acts", 9)), "Acts");
  assert.equal(unitHeading(at("john", 5)), "John 5");
  assert.equal(draftStubText(at("acts", 1)), "Acts is still being translated.");
  assert.equal(draftStubText(at("luke", 23)), "These chapters are still being translated.");
  assert.equal(draftStubText(at("john", 5)), "This chapter is still being translated.");
});
