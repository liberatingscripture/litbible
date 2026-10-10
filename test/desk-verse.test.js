import { test } from "node:test";
import assert from "node:assert/strict";
import { adjacentVerse, highlightColors, noteCounts, recordsOnVerse, verseLabel } from "../src/lib/desk-verse.mjs";

const note = (id, verse, endVerse) => ({ id, kind: "note", bookKey: "romans", chapter: 8, verse, ...(endVerse ? { endVerse } : {}) });
const bookmark = (id, verse, endVerse) => ({ id, kind: "bookmark", bookKey: "romans", chapter: 8, verse, ...(endVerse ? { endVerse } : {}) });
const highlight = (id, verse, color, endVerse) => ({ id, kind: "highlight", bookKey: "romans", chapter: 8, verse, color, ...(endVerse ? { endVerse } : {}) });

test("a record covers its verse, and with a range every verse in it", () => {
  const records = [note("a", 3), note("b", 3, 5), note("c", 5), bookmark("d", 4, 6)];
  assert.deepEqual(recordsOnVerse(records, 3).map((r) => r.id), ["a", "b"]);
  assert.deepEqual(recordsOnVerse(records, 4).map((r) => r.id), ["b", "d"], "the range's middle");
  assert.deepEqual(recordsOnVerse(records, 5).map((r) => r.id), ["b", "c", "d"], "and its last verse");
  assert.deepEqual(recordsOnVerse(records, 6).map((r) => r.id), ["d"]);
  assert.deepEqual(recordsOnVerse(records, 2), [], "nothing before it");
  assert.deepEqual(recordsOnVerse(records, 7), [], "nothing after it");
});

test("a record with no endVerse, or an equal one, is one verse", () => {
  assert.deepEqual(recordsOnVerse([note("a", 3)], 4), []);
  assert.deepEqual(recordsOnVerse([{ id: "a", kind: "note", verse: 3, endVerse: 3 }], 3).map((r) => r.id), ["a"]);
  assert.deepEqual(recordsOnVerse([{ id: "a", kind: "note", verse: 3, endVerse: 3 }], 4), []);
});

test("records without a numeric verse cover no verse, and the order given is kept", () => {
  const records = [
    { id: "chapter", kind: "note", bookKey: "romans", chapter: 8 },
    { id: "text", kind: "note", verse: "3" },
    note("late", 3),
    { id: "label", kind: "label" },
    note("early", 3),
  ];
  assert.deepEqual(recordsOnVerse(records, 3).map((r) => r.id), ["late", "early"], "input order, not alphabetical");
  assert.deepEqual(recordsOnVerse(undefined, 3), []);
});

test("the next verse steps over a gap in the numbering", () => {
  const verses = [18, 19, 20, 22, 23]; // Matthew 17 style: no 21
  assert.equal(adjacentVerse(verses, 20, +1), 22);
  assert.equal(adjacentVerse(verses, 22, -1), 20);
  assert.equal(adjacentVerse(verses, 19, +1), 20, "no gap, the plain next one");
});

test("there is no verse past either edge of the chapter", () => {
  const verses = [1, 2, 3];
  assert.equal(adjacentVerse(verses, 3, +1), null);
  assert.equal(adjacentVerse(verses, 1, -1), null);
  assert.equal(adjacentVerse([], 1, +1), null);
  assert.equal(adjacentVerse([], 1, -1), null);
});

test("a verse not on the page still finds its neighbour in that direction", () => {
  const verses = [1, 2, 3, 5, 6];
  assert.equal(adjacentVerse(verses, 4, +1), 5);
  assert.equal(adjacentVerse(verses, 4, -1), 3);
  assert.equal(adjacentVerse(verses, 0, +1), 1);
  assert.equal(adjacentVerse(verses, 0, -1), null);
  assert.equal(adjacentVerse(verses, 9, -1), 6);
  assert.equal(adjacentVerse(verses, 9, +1), null);
});

test("the list need not arrive sorted, and is left as it was", () => {
  const verses = [5, 1, 3, 2, 6];
  assert.equal(adjacentVerse(verses, 3, +1), 5);
  assert.equal(adjacentVerse(verses, 3, -1), 2);
  assert.equal(adjacentVerse(verses, 6, +1), null);
  assert.equal(adjacentVerse(verses, 1, -1), null);
  assert.deepEqual(verses, [5, 1, 3, 2, 6], "the caller's list is not sorted in place");
});

test("a note on several verses counts once on each, and a bookmark counts on none", () => {
  const counts = noteCounts([note("a", 3, 5), note("b", 4), note("c", 9), bookmark("d", 3, 6), bookmark("e", 4)]);
  assert.equal(counts.get(3), 1);
  assert.equal(counts.get(4), 2);
  assert.equal(counts.get(5), 1);
  assert.equal(counts.get(9), 1);
  assert.equal(counts.has(6), false, "a bookmark alone leaves a verse out of the map");
  assert.equal(counts.has(7), false);
  assert.deepEqual([...counts.keys()].sort((x, y) => x - y), [3, 4, 5, 9]);
});

test("counting notes ignores records with no verse, and two notes on one verse make two", () => {
  const counts = noteCounts([note("a", 2), note("b", 2), { id: "c", kind: "note", bookKey: "romans", chapter: 8 }]);
  assert.equal(counts.get(2), 2);
  assert.equal(counts.size, 1);
  assert.equal(noteCounts([]).size, 0);
  assert.equal(noteCounts(undefined).size, 0);
});

test("a verse number is named for the notes on it", () => {
  assert.equal(verseLabel(1, 0), "Verse 1");
  assert.equal(verseLabel(1), "Verse 1", "a missing count is none");
  assert.equal(verseLabel(12, undefined), "Verse 12");
  assert.equal(verseLabel(1, 1), "Verse 1, 1 note of mine");
  assert.equal(verseLabel(1, 2), "Verse 1, 2 notes of mine");
  assert.equal(verseLabel(16, 5), "Verse 16, 5 notes of mine");
});

test("a highlight covers each verse in its range, and a verse no highlight covers is left out", () => {
  const colors = highlightColors([highlight("a", 3, "yellow", 5)]);
  assert.deepEqual([...colors.keys()].sort((x, y) => x - y), [3, 4, 5]);
  assert.deepEqual(colors.get(3), ["yellow"]);
  assert.deepEqual(colors.get(4), ["yellow"], "the range's middle");
  assert.deepEqual(colors.get(5), ["yellow"], "and its last verse");
  assert.equal(colors.has(2), false, "nothing before it");
  assert.equal(colors.has(6), false, "nothing after it");
});

test("a verse's colours come in COLORS order, each once, whatever order they were made in", () => {
  const colors = highlightColors([
    highlight("a", 4, "pink"),
    highlight("b", 4, "blue"),
    highlight("c", 4, "yellow"),
    highlight("d", 4, "pink"), // the same colour again, overlapping
    highlight("e", 3, "green", 4),
  ]);
  assert.deepEqual(colors.get(4), ["yellow", "green", "blue", "pink"]);
  assert.deepEqual(colors.get(3), ["green"]);
});

test("notes, bookmarks, colourless and unknown-colour records do not count as highlights", () => {
  const colors = highlightColors([
    note("a", 2),
    bookmark("b", 3),
    { id: "c", kind: "highlight", bookKey: "romans", chapter: 8, verse: 4, color: "red" },
    { id: "d", kind: "highlight", bookKey: "romans", chapter: 8, verse: 5 },
    { id: "e", kind: "highlight", bookKey: "romans", chapter: 8, color: "yellow" },
  ]);
  assert.equal(colors.size, 0);
  assert.equal(highlightColors(undefined).size, 0);
  assert.equal(highlightColors([]).size, 0);
});

test("an unknown colour leaves the verse's known ones alone, and a note does not stand in for a colour", () => {
  const colors = highlightColors([
    highlight("a", 4, "red"),
    highlight("b", 4, "yellow"),
    note("c", 4),
    note("d", 5),
  ]);
  assert.deepEqual(colors.get(4), ["yellow"]);
  assert.equal(colors.has(5), false, "a note on verse 5 is not a colour there");
});

test("a verse number names its highlights, colours first", () => {
  assert.equal(verseLabel(3, 0, []), "Verse 3");
  assert.equal(verseLabel(3, 0), "Verse 3", "colours default to none");
  assert.equal(verseLabel(3, 0, null), "Verse 3", "and so does a null list");
  assert.equal(verseLabel(3, 0, ["yellow"]), "Verse 3, highlighted yellow");
  assert.equal(verseLabel(3, 0, ["yellow", "pink"]), "Verse 3, highlighted yellow and pink");
  assert.equal(verseLabel(3, 0, ["yellow", "green", "pink"]), "Verse 3, highlighted yellow, green and pink", "no comma before the last and");
  assert.equal(verseLabel(3, 0, ["yellow", "green", "blue", "pink"]), "Verse 3, highlighted yellow, green, blue and pink");
});

test("a verse number names its notes and its highlights together, colours first", () => {
  assert.equal(verseLabel(3, 1, []), "Verse 3, 1 note of mine");
  assert.equal(verseLabel(3, 1, ["yellow"]), "Verse 3, highlighted yellow, 1 note of mine");
  assert.equal(verseLabel(3, 2, ["yellow", "pink"]), "Verse 3, highlighted yellow and pink, 2 notes of mine");
});

test("colours are named in COLORS order, each once, and a name the page does not draw is left out", () => {
  assert.equal(verseLabel(3, 0, ["pink", "yellow"]), "Verse 3, highlighted yellow and pink", "the order given does not matter");
  assert.equal(verseLabel(3, 0, ["yellow", "yellow"]), "Verse 3, highlighted yellow", "each once");
  assert.equal(verseLabel(3, 0, ["red"]), "Verse 3", "not a colour, so no highlight");
  assert.equal(verseLabel(3, 0, ["red", "green"]), "Verse 3, highlighted green");
});

test("a verse number says how many of its marks changed since the reader made them, last of all", () => {
  assert.equal(verseLabel(3, 0, [], 1), "Verse 3, 1 changed since I marked it");
  assert.equal(verseLabel(3, 0, [], 2), "Verse 3, 2 changed since I marked them");
  assert.equal(verseLabel(3, 1, ["yellow"], 1), "Verse 3, highlighted yellow, 1 note of mine, 1 changed since I marked it");
  assert.equal(
    verseLabel(3, 2, ["yellow", "pink"], 3),
    "Verse 3, highlighted yellow and pink, 2 notes of mine, 3 changed since I marked them",
  );
});

test("no changed marks, or a missing count, add nothing to the label", () => {
  assert.equal(verseLabel(3, 1, ["yellow"], 0), "Verse 3, highlighted yellow, 1 note of mine");
  assert.equal(verseLabel(3, 1, ["yellow"], undefined), "Verse 3, highlighted yellow, 1 note of mine");
  assert.equal(verseLabel(3, 0, [], null), "Verse 3");
  assert.equal(verseLabel(3, 0, [], -1), "Verse 3", "a negative count is none");
});
