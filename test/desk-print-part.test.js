import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  citedFootnoteIds,
  notesForPart,
  onVerses,
  partChoices,
  partHeading,
  planVerses,
} from "../src/lib/desk-print-part.mjs";

test("the Print flyout names what it prints, for a verse, a range and a selection", () => {
  const labels = (o) => partChoices(o).map((c) => c.label);
  assert.deepEqual(labels({ what: "verse", start: 16, end: 16 }), [
    "This verse",
    "This verse with my notes",
    "This verse with room to write",
  ]);
  assert.deepEqual(labels({ what: "verse", start: 16, end: 18 }), [
    "These verses",
    "These verses with my notes",
    "These verses with room to write",
  ]);
  assert.deepEqual(labels({ what: "selection", start: 16, end: 18 }), [
    "This selection",
    "This selection with my notes",
    "This selection with room to write",
  ]);
  assert.deepEqual(
    partChoices({ what: "verse", start: 1, end: 1 }).map((c) => c.kind),
    ["plain", "notes", "room"],
  );
});

test("with my notes is left out where the browser keeps no notebook", () => {
  const choices = partChoices({ what: "verse", start: 3, end: 3, notebook: false });
  assert.deepEqual(choices.map((c) => c.kind), ["plain", "room"]);
});

test("a record is on the verses it overlaps, and a record with no verse is on none", () => {
  assert.equal(onVerses({ verse: 3 }, 3, 3), true);
  assert.equal(onVerses({ verse: 3 }, 4, 6), false);
  assert.equal(onVerses({ verse: 3, endVerse: 5 }, 5, 9), true, "a note across verses 3 to 5 touches verse 5");
  assert.equal(onVerses({ verse: 3, endVerse: 5 }, 6, 9), false);
  assert.equal(onVerses({ verse: 8, endVerse: 5 }, 5, 5), false, "an end before the start is read as the one verse");
  assert.equal(onVerses({}, 1, 99), false);
  assert.equal(onVerses({ verse: "3" }, 1, 99), false, "a verse that is not a number is never trusted");
  assert.equal(onVerses(null, 1, 99), false);
});

test("a print of verses keeps the spans of those verses and drops a block with none", () => {
  // Three blocks: verses 1 and 2 share the first; the second holds verse 2's
  // second paragraph and verse 3; the third is verse 4 alone.
  const plan = planVerses([[1, 2], [2, 3], [4]], 2, 3);
  assert.deepEqual(plan, [
    { any: true, keep: [false, true] },
    { any: true, keep: [true, true] },
    { any: false, keep: [false] },
  ]);
  // A span with no verse number (an unnumbered line) is not kept.
  assert.deepEqual(planVerses([[Number.NaN, 5]], 5, 5), [{ any: true, keep: [false, true] }]);
  assert.deepEqual(planVerses([], 1, 2), []);
});

test("the footnotes a print cites are those its kept verses link to, once each", () => {
  assert.deepEqual(citedFootnoteIds(["#fn-3", "#fn-1", "#fn-3", "", null, undefined]), ["fn-3", "fn-1"]);
  assert.deepEqual(citedFootnoteIds([]), []);
});

test("a part's notes are the live notes on its verses", () => {
  const records = [
    { id: "a", kind: "note", verse: 16 },
    { id: "b", kind: "note", verse: 17, endVerse: 19 },
    { id: "c", kind: "note", verse: 3 },
    { id: "d", kind: "highlight", verse: 16 },
    { id: "e", kind: "bookmark", verse: 16 },
  ];
  assert.deepEqual(notesForPart(records, 16, 17).map((r) => r.id), ["a", "b"]);
  assert.deepEqual(notesForPart(records, 18, 18).map((r) => r.id), ["b"]);
  assert.deepEqual(notesForPart(records, 1, 2), []);
});

test("the heading names the passage and the translation", () => {
  assert.equal(partHeading("John 3:16–18"), "John 3:16–18 (LIT)");
});

// The flyout is shared code (E39): the verse menu and the selection panel use
// it for every reader, and the desk imports it from there. Shared code never
// imports the desk's.
test("the shared flyout is not desk code, and the desk uses it", () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  for (const file of ["panel-flyout.js", "panel-pieces.js", "chapter-tools.js", "verse-image.js", "lit-panel.js"]) {
    const source = read(`../src/scripts/${file}`);
    assert.doesNotMatch(source, /^\s*import[^;]*["'][^"']*\/desk\//m, `${file} imports desk code`);
  }
  assert.match(read("../src/scripts/desk/actions.js"), /from "\.\.\/panel-flyout\.js"/);
  assert.doesNotMatch(read("../src/scripts/desk/actions.js"), /function flyoutRow/);
  assert.doesNotMatch(read("../src/styles/desk.css"), /desk-bookmark-fly/);
});
