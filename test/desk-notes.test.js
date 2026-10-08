import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CIRCLE,
  CIRCLE_ROOM,
  FULL_ROOM,
  circlesPerRow,
  layoutCircles,
  layoutFull,
  marginMode,
  noteOpening,
  noteWidth,
  popoverPlace,
  notesInTheWay,
  shortQuote,
} from "../src/lib/desk-notes.mjs";

const LINE = 31.5; // 18px at a 1.75 line height
const NOTE_LINE = 21.75; // 15px at 1.45

test("the margin shows notes in full from about 230px, circles below that, then nothing", () => {
  assert.equal(marginMode(FULL_ROOM), "full");
  assert.equal(marginMode(FULL_ROOM - 1), "circles");
  assert.equal(marginMode(CIRCLE_ROOM), "circles");
  assert.equal(marginMode(CIRCLE_ROOM - 1), "none");
});

test("a note sits level with its word's line", () => {
  const [n] = layoutFull([{ id: "a", top: 100, lineHeight: LINE, noteLine: NOTE_LINE, height: NOTE_LINE }]);
  assert.equal(n.y, 100 + (LINE - NOTE_LINE) / 2);
  assert.equal(n.cut, false);
});

test("a long note is left alone unless it runs into the next one", () => {
  const notes = layoutFull([
    { id: "a", top: 0, lineHeight: LINE, noteLine: NOTE_LINE, height: 200 },
    { id: "b", top: 400, lineHeight: LINE, noteLine: NOTE_LINE, height: 40 },
  ]);
  assert.equal(notes[0].cut, false, "200px of note, 400px to the next: nothing changes");
});

test("a note that would run into the one below is cut where that one begins", () => {
  const notes = layoutFull([
    { id: "a", top: 0, lineHeight: LINE, noteLine: NOTE_LINE, height: 90 },
    { id: "b", top: LINE, lineHeight: LINE, noteLine: NOTE_LINE, height: 40 },
  ]);
  assert.equal(notes[0].cut, true);
  assert.equal(notes[0].maxHeight, notes[1].y - notes[0].y - 6);
  assert.equal(notes[1].cut, false, "the last note is never cut");
});

test("two notes on one line stack: the second starts below the first's first line", () => {
  const notes = layoutFull([
    { id: "a", top: 50, lineHeight: LINE, noteLine: NOTE_LINE, height: 60 },
    { id: "b", top: 50, lineHeight: LINE, noteLine: NOTE_LINE, height: 20 },
  ]);
  assert.ok(notes[1].y >= notes[0].y + NOTE_LINE);
  assert.equal(notes[0].cut, true, "and the first is cut at one line");
  assert.equal(notes[0].maxHeight, NOTE_LINE);
});

test("circles on neighbouring lines keep their own lines", () => {
  const c = layoutCircles(
    [
      { id: "a", top: 0, lineHeight: LINE },
      { id: "b", top: LINE, lineHeight: LINE },
    ],
    { perRow: 5 },
  );
  assert.equal(c[0].slot, 0);
  assert.equal(c[1].slot, 0);
  assert.notEqual(c[0].y, c[1].y);
});

test("circles that would overlap sit side by side, in reading order away from the text", () => {
  const c = layoutCircles(
    [
      { id: "a", top: 0, lineHeight: LINE },
      { id: "b", top: 0, lineHeight: LINE },
    ],
    { perRow: 5 },
  );
  assert.equal(c[0].y, c[1].y);
  assert.deepEqual(c.map((x) => [x.id, x.slot]), [["a", 1], ["b", 0]]);
});

test("past a full row, circles stack below", () => {
  const c = layoutCircles(
    [
      { id: "a", top: 0, lineHeight: LINE },
      { id: "b", top: 0, lineHeight: LINE },
    ],
    { perRow: 1 },
  );
  assert.equal(c[1].y, c[0].y + CIRCLE + 6);
});

test("how many circles fit", () => {
  assert.equal(circlesPerRow(CIRCLE_ROOM), 1);
  assert.equal(circlesPerRow(200), 5);
});

test("a circle's note opens below when that keeps its words clear and fits", () => {
  const p = popoverPlace({ circleTop: 100, words: { top: 100, bottom: 125 }, height: 120, viewBottom: 800 });
  assert.equal(p.side, "below");
  assert.ok(p.top >= 125, "never over the words");
});

test("it opens below the words, not just the circle, when they run on", () => {
  const p = popoverPlace({ circleTop: 100, words: { top: 100, bottom: 190 }, height: 120, viewBottom: 800 });
  assert.equal(p.side, "below");
  assert.ok(p.top >= 190);
});

test("near the bottom of the window it opens above", () => {
  const p = popoverPlace({ circleTop: 700, words: { top: 700, bottom: 725 }, height: 120, viewBottom: 800 });
  assert.equal(p.side, "above");
  assert.ok(p.top + 120 <= 700);
});

test("only a note a bookmark's mark is in the way of makes room", () => {
  const hit = notesInTheWay(
    [
      { id: "a", y: 0, height: 60 },
      { id: "b", y: 100, height: 20 },
    ],
    [40],
  );
  assert.deepEqual([...hit], ["a"]);
});

test("a mark just past a cut note's shown lines isn't in its way", () => {
  assert.equal(notesInTheWay([{ id: "a", y: 0, height: 22 }], [30]).size, 0);
});

test("notes in full fill the margin, up to a readable line", () => {
  assert.equal(noteWidth(300), 300 - 24 - 16);
  assert.equal(noteWidth(2000), 520);
});

test("short quotes stay whole; long ones keep ten words", () => {
  assert.equal(shortQuote("nothing is now a verdict"), "nothing is now a verdict");
  assert.equal(shortQuote("one two three four five six seven eight nine ten eleven"), "one two three four five six seven eight nine ten…");
});

test("a note opens, for screen readers, with the words it hangs on", () => {
  assert.equal(
    noteOpening({ quote: { exact: "nothing is now a verdict" } }, "Romans 8:1"),
    "My note on ‘nothing is now a verdict’, Romans 8:1: ",
  );
  assert.equal(noteOpening({}, "Romans 8:1–2"), "My note on Romans 8:1–2: ");
});
