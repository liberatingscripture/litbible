import { test } from "node:test";
import assert from "node:assert/strict";
import {
  occurrenceIndex,
  parseVerseHref,
  quoteHolds,
  renderingPieces,
  renderingsAt,
  termNotes,
} from "../src/lib/desk-term-notes.mjs";

const note = (id, verse, exact, extra = {}) => ({
  id,
  kind: "note",
  created: `2026-10-0${id.length}T00:00:00Z`,
  bookKey: "romans",
  chapter: 8,
  verse,
  ...(exact ? { quote: { exact, prefix: "", suffix: "" } } : {}),
  body: "mine",
  ...extra,
});

const flesh = occurrenceIndex([
  { bookKey: "romans", chapter: 8, verse: 3, renderings: renderingsAt("self-preservation", null) },
  { bookKey: "romans", chapter: 8, verse: 5, renderings: renderingsAt("self-preservation", null) },
  { bookKey: "mark", chapter: 10, verse: 8, renderings: renderingsAt("family", null) },
]);

test("a split rendering is its pieces, and a plain one is one", () => {
  assert.deepEqual(renderingPieces("speaks about … contemptuously"), ["speaks about", "contemptuously"]);
  assert.deepEqual(renderingPieces("self-preservation"), ["self-preservation"]);
  assert.deepEqual(renderingPieces(""), []);
});

test("the words printed at a verse are the label unless the page says otherwise", () => {
  assert.deepEqual(renderingsAt("leave", null), [["leave"]]);
  assert.deepEqual(renderingsAt("leave", "left|leaves"), [["left"], ["leaves"]]);
  assert.deepEqual(renderingsAt("a", "speaks about … contemptuously"), [["speaks about", "contemptuously"]]);
});

test("an occurrence link names its verse", () => {
  assert.deepEqual(parseVerseHref("/1corinthians-13/#v4"), { bookKey: "1corinthians", chapter: 13, verse: 4 });
  assert.equal(parseVerseHref("/romans-8/"), null);
  assert.equal(parseVerseHref("/glossary/#flesh-body"), null);
  assert.equal(parseVerseHref(undefined), null);
});

test("the same verse under two renderings is one occurrence with both", () => {
  const index = occurrenceIndex([
    { bookKey: "romans", chapter: 2, verse: 12, renderings: [["torah"]] },
    { bookKey: "romans", chapter: 2, verse: 12, renderings: [["law"]] },
  ]);
  assert.equal(index.size, 1);
  assert.deepEqual(index.get("romans-2:12").renderings, [["torah"], ["law"]]);
});

test("a quote holds a rendering regardless of case, quotes and dashes", () => {
  assert.equal(quoteHolds("Self-Preservation", ["self-preservation"]), true);
  assert.equal(quoteHolds("self‐preservation", ["self-preservation"]), true, "a Unicode hyphen");
  assert.equal(quoteHolds("God’s people", ["god's people"]), true);
  assert.equal(quoteHolds("speaks about Christ contemptuously", ["speaks about", "contemptuously"]), true);
  assert.equal(quoteHolds("speaks about Christ", ["speaks about", "contemptuously"]), false, "every piece is needed");
  assert.equal(quoteHolds("the flesh", []), false);
});

test("a note counts when it quotes the term's words at a verse that has them", () => {
  const records = [note("a", 3, "self-preservation"), note("bb", 5, "Self-preservation, then")];
  assert.deepEqual(termNotes(records, flesh).map((r) => r.id), ["a", "bb"]);
});

test("a note on a whole verse, or on other words of the verse, doesn't", () => {
  const records = [note("a", 3, null), note("bb", 3, "God sent his own Son")];
  assert.deepEqual(termNotes(records, flesh), []);
});

test("a note on the right words at a verse the term isn't rendered in doesn't", () => {
  assert.deepEqual(termNotes([note("a", 4, "self-preservation")], flesh), []);
  assert.deepEqual(termNotes([note("a", 3, "self-preservation", { chapter: 9 })], flesh), []);
});

test("a note on a run of verses counts through any verse in it", () => {
  const records = [note("a", 2, "self-preservation", { endVerse: 4 }), note("bb", 6, "self-preservation", { endVerse: 7 })];
  assert.deepEqual(termNotes(records, flesh).map((r) => r.id), ["a"]);
});

test("the words as printed count where they differ from the label", () => {
  const index = occurrenceIndex([{ bookKey: "romans", chapter: 8, verse: 3, renderings: renderingsAt("leave", "left") }]);
  assert.deepEqual(termNotes([note("a", 3, "left")], index).map((r) => r.id), ["a"]);
  assert.deepEqual(termNotes([note("bb", 3, "leave")], index), [], "the label alone is not what was printed");
});

test("notes on a glossary entry or an article are the entry's own, not repeated", () => {
  const records = [
    note("a", 3, "self-preservation", { glossaryEntry: "flesh-body" }),
    note("bb", 3, "self-preservation", { article: "many-and-all" }),
    note("ccc", 3, "self-preservation", { glossaryId: "flesh-body" }),
  ];
  assert.deepEqual(termNotes(records, flesh), []);
});

test("other kinds of record, and an entry with no occurrences, give nothing", () => {
  const highlight = { ...note("a", 3, "self-preservation"), kind: "highlight", color: "yellow" };
  assert.deepEqual(termNotes([highlight], flesh), []);
  assert.deepEqual(termNotes([note("a", 3, "self-preservation")], occurrenceIndex([])), []);
  assert.deepEqual(termNotes(undefined, flesh), []);
});

test("notes come in Bible order", () => {
  const records = [
    note("late", 5, "self-preservation"),
    { ...note("mark", 8, "family"), bookKey: "mark", chapter: 10 },
    note("early", 3, "self-preservation"),
  ];
  assert.deepEqual(termNotes(records, flesh).map((r) => r.id), ["mark", "early", "late"]);
});
