// test/desk-sheet-lit.test.js
//
// What a sheet knows about the LIT (STUDY-DESK.md, 3h): the pure module
// src/lib/desk-sheet-lit.mjs. Covers the key terms box, blanks, the footnotes
// that give a blank away, which footnotes print, and the commercial check.
// Chapters are small made-up ones built with anchor-core's assembleChapter.

import { test } from "node:test";
import assert from "node:assert/strict";

import { assembleChapter, rangeOf } from "../src/lib/anchor-core.mjs";
import {
  blankFromOffsets,
  blankHint,
  blanksGivenAway,
  booksToCheck,
  collectKeyTerms,
  commercialShare,
  completeBooks,
  countWords,
  footnoteKey,
  footnoteRows,
  htmlToText,
  keyTermLine,
  locateBlank,
  marksInRange,
  overlapsBlank,
  setFootnoteChoices,
  telltaleStems,
  termForWords,
  termMarkOffsets,
  traditionalWord,
} from "../src/lib/desk-sheet-lit.mjs";

const V6 = "Sin is a deviation from the way.";
const V7 = "People who miss the mark are sinners.";
const V8 = "Grace abounds for everyone here.";

const chapter = assembleChapter(
  new Map([
    [6, V6],
    [7, V7],
    [8, V8],
  ]),
);

/** Offsets of `needle` in the chapter's text (kth occurrence from 0). */
function at(ch, needle, k = 0, fold = false) {
  const hay = fold ? ch.text.toLowerCase() : ch.text;
  const want = fold ? needle.toLowerCase() : needle;
  let from = 0;
  let i = -1;
  for (let n = 0; n <= k; n++) {
    i = hay.indexOf(want, from);
    from = i + 1;
  }
  return { start: i, end: i + needle.length };
}

const TERMS = {
  hamartia: { traditional: "Sin", greek: "hamartia", title: "Sin" },
  sarx: { traditional: "Flesh", greek: "sarx", title: "Flesh" },
};

/* ── termMarkOffsets ─────────────────────────────────────────────────── */

test("termMarkOffsets: finds the kth occurrence, case-insensitively", () => {
  // "the" appears in v6 ("the way") and "The" nowhere else in v6; use v7 "mark"/"sinners"
  const ch = assembleChapter(new Map([[1, "Sin and SIN and sin."]]));
  const data = {
    marks: [
      { v: 1, text: "sin", k: 0, id: "hamartia" },
      { v: 1, text: "sin", k: 2, id: "hamartia" },
    ],
  };
  const got = termMarkOffsets(ch, data);
  assert.deepEqual(
    got.map((m) => [m.start, m.end]),
    [
      [0, 3],
      [ch.text.lastIndexOf("sin"), ch.text.lastIndexOf("sin") + 3],
    ],
  );
  assert.equal(ch.text.slice(got[1].start, got[1].end), "sin");
  const second = termMarkOffsets(ch, { marks: [{ v: 1, text: "Sin", k: 1, id: "x" }] });
  assert.equal(second[0].start, ch.text.toLowerCase().indexOf("sin", 1));
  assert.equal(ch.text.slice(second[0].start, second[0].end), "SIN");
});

test("termMarkOffsets: offsets are in chapter text, past earlier verses", () => {
  const got = termMarkOffsets(chapter, { marks: [{ v: 7, text: "sinners", k: 0, id: "hamartia" }] });
  const want = at(chapter, "sinners");
  assert.deepEqual(got, [{ start: want.start, end: want.end, id: "hamartia", v: 7 }]);
});

test("termMarkOffsets: a mark whose text is not in its verse is skipped", () => {
  const got = termMarkOffsets(chapter, {
    marks: [
      { v: 6, text: "sinners", k: 0, id: "hamartia" }, // that word is in v7
      { v: 6, text: "deviation", k: 1, id: "hamartia" }, // only one occurrence
      { v: 6, text: "deviation", k: 0, id: "hamartia" },
    ],
  });
  assert.equal(got.length, 1);
  assert.equal(chapter.text.slice(got[0].start, got[0].end), "deviation");
});

test("termMarkOffsets: a mark whose verse is missing is skipped", () => {
  const got = termMarkOffsets(chapter, { marks: [{ v: 99, text: "Sin", k: 0, id: "hamartia" }] });
  assert.deepEqual(got, []);
});

test("termMarkOffsets: no term data, or no marks, gives nothing", () => {
  assert.deepEqual(termMarkOffsets(chapter, null), []);
  assert.deepEqual(termMarkOffsets(chapter, {}), []);
});

test("termMarkOffsets: of two overlapping marks the first wins", () => {
  const got = termMarkOffsets(chapter, {
    marks: [
      { v: 6, text: "a deviation", k: 0, id: "hamartia" },
      { v: 6, text: "deviation from", k: 0, id: "sarx" },
    ],
  });
  assert.equal(got.length, 1);
  assert.equal(got[0].id, "hamartia");
});

test("termMarkOffsets: result is sorted by start whatever the order given", () => {
  const got = termMarkOffsets(chapter, {
    marks: [
      { v: 8, text: "Grace", k: 0, id: "sarx" },
      { v: 6, text: "deviation", k: 0, id: "hamartia" },
      { v: 7, text: "mark", k: 0, id: "hamartia" },
    ],
  });
  assert.deepEqual(
    got.map((m) => chapter.text.slice(m.start, m.end)),
    ["deviation", "mark", "Grace"],
  );
});

test("termMarkOffsets: g is carried only when present", () => {
  const got = termMarkOffsets(chapter, {
    marks: [
      { v: 6, text: "deviation", k: 0, id: "hamartia", g: 0 },
      { v: 7, text: "mark", k: 0, id: "hamartia" },
    ],
  });
  assert.equal(got[0].g, 0);
  assert.equal("g" in got[1], false);
});

/* ── marksInRange ────────────────────────────────────────────────────── */

test("marksInRange: overlap is half-open", () => {
  const marks = [
    { start: 0, end: 5, id: "a" },
    { start: 5, end: 10, id: "b" },
    { start: 10, end: 15, id: "c" },
  ];
  assert.deepEqual(
    marksInRange(marks, 5, 10).map((m) => m.id),
    ["b"],
  );
  // A mark ending exactly at start is out; one starting exactly at end is out.
  assert.deepEqual(
    marksInRange(marks, 4, 11).map((m) => m.id),
    ["a", "b", "c"],
  );
  assert.deepEqual(marksInRange(marks, 15, 20), []);
});

/* ── collectKeyTerms ─────────────────────────────────────────────────── */

function marksFor(ch, specs) {
  return specs.map(({ text, id, g, k = 0 }) => {
    const { start, end } = at(ch, text, k, true);
    return g === undefined ? { start, end, id } : { start, end, id, g };
  });
}

test("collectKeyTerms: terms come in the order the passages first use them", () => {
  const p1 = { chapter, terms: TERMS, marks: marksFor(chapter, [{ text: "Grace", id: "sarx" }]) };
  const p2 = {
    chapter,
    terms: TERMS,
    marks: marksFor(chapter, [
      { text: "deviation", id: "hamartia" },
      { text: "Grace", id: "sarx" },
    ]),
  };
  const got = collectKeyTerms([p1, p2]);
  assert.deepEqual(
    got.map((t) => t.id),
    ["sarx", "hamartia"],
  );
});

test("collectKeyTerms: renderings are deduplicated without case, keeping the first casing", () => {
  const ch = assembleChapter(new Map([[1, "Sin and sin and SIN and deviation."]]));
  const marks = marksFor(ch, [
    { text: "Sin", id: "hamartia" },
    { text: "sin", id: "hamartia", k: 1 },
    { text: "SIN", id: "hamartia", k: 2 },
    { text: "deviation", id: "hamartia" },
  ]);
  const [term] = collectKeyTerms([{ chapter: ch, marks, terms: TERMS }]);
  assert.deepEqual(term.renderings, ["Sin", "deviation"]);
});

test("collectKeyTerms: a split rendering (shared g) is joined with an ellipsis, once", () => {
  const ch = assembleChapter(new Map([[1, "She speaks about Christ contemptuously."]]));
  const marks = marksFor(ch, [
    { text: "speaks about", id: "hamartia", g: 3 },
    { text: "contemptuously", id: "hamartia", g: 3 },
  ]);
  const [term] = collectKeyTerms([{ chapter: ch, marks, terms: TERMS }]);
  assert.deepEqual(term.renderings, ["speaks about … contemptuously"]);
});

test("collectKeyTerms: the same split rendering in a second passage is not repeated", () => {
  const ch = assembleChapter(new Map([[1, "She speaks about Christ contemptuously."]]));
  const marks = marksFor(ch, [
    { text: "speaks about", id: "hamartia", g: 0 },
    { text: "contemptuously", id: "hamartia", g: 0 },
  ]);
  const p = { chapter: ch, marks, terms: TERMS };
  const [term] = collectKeyTerms([p, p]);
  assert.equal(term.renderings.length, 1);
});

test("collectKeyTerms: omitted reflects the omit list", () => {
  const marks = marksFor(chapter, [
    { text: "deviation", id: "hamartia" },
    { text: "Grace", id: "sarx" },
  ]);
  const got = collectKeyTerms([{ chapter, marks, terms: TERMS }], ["sarx"]);
  assert.deepEqual(
    got.map((t) => [t.id, t.omitted]),
    [
      ["hamartia", false],
      ["sarx", true],
    ],
  );
});

test("collectKeyTerms: carries traditional, greek and title from the term info", () => {
  const marks = marksFor(chapter, [{ text: "deviation", id: "hamartia" }]);
  const [term] = collectKeyTerms([{ chapter, marks, terms: TERMS }]);
  assert.equal(term.traditional, "sin");
  assert.equal(term.greek, "hamartia");
  assert.equal(term.title, "Sin");
});

test("collectKeyTerms: a mark whose id has no term info is skipped", () => {
  const marks = marksFor(chapter, [
    { text: "deviation", id: "mystery" },
    { text: "Grace", id: "sarx" },
  ]);
  const got = collectKeyTerms([{ chapter, marks, terms: TERMS }]);
  assert.deepEqual(
    got.map((t) => t.id),
    ["sarx"],
  );
});

/* ── keyTermLine ─────────────────────────────────────────────────────── */

test("keyTermLine: rendering, traditionally the lowercased traditional, then the Greek", () => {
  assert.equal(
    keyTermLine({ renderings: ["self-preservation"], traditional: "Flesh", greek: "sarx" }),
    "self-preservation, traditionally flesh, sarx",
  );
});

test("keyTermLine: several renderings are joined with a slash", () => {
  assert.equal(
    keyTermLine({ renderings: ["self-preservation", "family"], traditional: "Flesh", greek: "sarx" }),
    "self-preservation / family, traditionally flesh, sarx",
  );
});

test("keyTermLine: leaves out a missing traditional or Greek", () => {
  assert.equal(keyTermLine({ renderings: ["x"], traditional: "", greek: "" }), "x");
  assert.equal(keyTermLine({ renderings: ["x"], traditional: "Sin", greek: "" }), "x, traditionally sin");
});

/* ── blankFromOffsets ────────────────────────────────────────────────── */

test("blankFromOffsets: stores verse, exact, prefix and suffix from makeAnchor", () => {
  const { start, end } = at(chapter, "deviation");
  const b = blankFromOffsets(chapter, start, end, { id: "b1" });
  assert.equal(b.id, "b1");
  assert.equal(b.verse, 6);
  assert.equal(b.exact, "deviation");
  assert.equal(b.prefix, "Sin is a ");
  assert.equal(b.suffix, chapter.text.slice(end, end + 32));
  assert.ok(b.suffix.startsWith(" from the way. People"));
  assert.equal(b.hint, "none");
  assert.equal("hintText" in b, false);
});

test("blankFromOffsets: hintText is kept only for hint custom", () => {
  const { start, end } = at(chapter, "deviation");
  const custom = blankFromOffsets(chapter, start, end, { id: "b", hint: "custom", hintText: "a word" });
  assert.equal(custom.hint, "custom");
  assert.equal(custom.hintText, "a word");
  const emptyCustom = blankFromOffsets(chapter, start, end, { id: "b", hint: "custom" });
  assert.equal(emptyCustom.hintText, "");
  const trad = blankFromOffsets(chapter, start, end, { id: "b", hint: "traditional", hintText: "ignored" });
  assert.equal("hintText" in trad, false);
});

/* ── locateBlank ─────────────────────────────────────────────────────── */

test("locateBlank: a blank found inside the passage prints", () => {
  const { start, end } = at(chapter, "deviation");
  const blank = blankFromOffsets(chapter, start, end, { id: "b" });
  const [s, e] = rangeOf(chapter, 6, 7);
  const r = locateBlank(chapter, blank, { start: s, end: e }, 7);
  assert.equal(r.status, "found");
  assert.equal(r.start, start);
  assert.equal(r.end, end);
  assert.equal(r.prints, true);
});

test("locateBlank: a blank whose words now sit outside the passage is lost", () => {
  const { start, end } = at(chapter, "Grace");
  const blank = blankFromOffsets(chapter, start, end, { id: "b" });
  const [s, e] = rangeOf(chapter, 6, 6); // the passage no longer reaches v8
  const r = locateBlank(chapter, blank, { start: s, end: e }, 6);
  assert.deepEqual(r, { status: "lost", start: null, end: null, prints: false });
});

test("locateBlank: a blank whose words moved within the passage still prints", () => {
  // The blank is on "mark" in v7; the word is now in v6 instead, which is
  // outside the blank's own verse but inside the passage (6-7).
  const { start, end } = at(chapter, "mark");
  const blank = blankFromOffsets(chapter, start, end, { id: "b" });
  const moved = assembleChapter(
    new Map([
      [6, "Sin is a mark from the way."],
      [7, "People who miss it are sinners."],
      [8, V8],
    ]),
  );
  const [s, e] = rangeOf(moved, 6, 7);
  const r = locateBlank(moved, blank, { start: s, end: e }, 7);
  assert.equal(r.status, "moved");
  assert.equal(r.prints, true);
  assert.equal(moved.text.slice(r.start, r.end), "mark");
});

test("locateBlank: words deleted from the text, verse still there, gives verse and does not print", () => {
  const { start, end } = at(chapter, "deviation");
  const blank = blankFromOffsets(chapter, start, end, { id: "b" });
  const now = assembleChapter(
    new Map([
      [6, "Completely different sentence entirely."],
      [7, V7],
      [8, V8],
    ]),
  );
  const [s, e] = rangeOf(now, 6, 7);
  const r = locateBlank(now, blank, { start: s, end: e }, 7);
  assert.deepEqual(r, { status: "verse", start: null, end: null, prints: false });
});

test("locateBlank: words deleted and the verse gone gives lost", () => {
  const { start, end } = at(chapter, "deviation");
  const blank = blankFromOffsets(chapter, start, end, { id: "b" });
  // No verse from 6 to 8 is left in the chapter.
  const now = assembleChapter(new Map([[1, "Something else entirely."]]));
  const [s, e] = rangeOf(now, 1, 1);
  const r = locateBlank(now, blank, { start: s, end: e }, 8);
  assert.deepEqual(r, { status: "lost", start: null, end: null, prints: false });
});

test("locateBlank: reworded words with the context surviving is changed and prints", () => {
  const { start, end } = at(chapter, "deviation");
  const blank = blankFromOffsets(chapter, start, end, { id: "b" });
  const now = assembleChapter(
    new Map([
      [6, "Sin is a departure from the way."],
      [7, V7],
      [8, V8],
    ]),
  );
  const [s, e] = rangeOf(now, 6, 7);
  const r = locateBlank(now, blank, { start: s, end: e }, 7);
  assert.equal(r.status, "changed");
  assert.equal(now.text.slice(r.start, r.end), "departure");
  assert.equal(r.prints, true);
});

test("locateBlank: an endVerse before the blank's verse still searches the blank's verse", () => {
  const { start, end } = at(chapter, "deviation");
  const blank = blankFromOffsets(chapter, start, end, { id: "b" });
  const [s, e] = rangeOf(chapter, 6, 6);
  const r = locateBlank(chapter, blank, { start: s, end: e }, 1);
  assert.equal(r.status, "found");
  assert.equal(r.prints, true);
});

/* ── overlapsBlank ───────────────────────────────────────────────────── */

test("overlapsBlank: half-open overlap, ignoring blanks with no place", () => {
  const located = [
    { start: 10, end: 20 },
    { start: null, end: null },
  ];
  assert.equal(overlapsBlank(located, 15, 18), true);
  assert.equal(overlapsBlank(located, 0, 10), false);
  assert.equal(overlapsBlank(located, 20, 25), false);
  assert.equal(overlapsBlank(located, 19, 25), true);
  assert.equal(overlapsBlank([], 0, 100), false);
});

/* ── blankHint / termForWords ────────────────────────────────────────── */

test("blankHint: a custom hint is the trimmed text", () => {
  assert.equal(blankHint({ hint: "custom", hintText: "  a word  " }, null, [], TERMS), "a word");
});

test("blankHint: a custom hint of only spaces, or none, is null", () => {
  assert.equal(blankHint({ hint: "custom", hintText: "   " }, null, [], TERMS), null);
  assert.equal(blankHint({ hint: "custom" }, null, [], TERMS), null);
});

test("blankHint: traditional reads the term of the overlapping mark, lowercased", () => {
  const marks = marksFor(chapter, [{ text: "deviation", id: "hamartia" }]);
  const where = at(chapter, "deviation");
  assert.equal(blankHint({ hint: "traditional" }, where, marks, TERMS), "traditionally sin");
});

test("blankHint: traditional with no mark under the words is null", () => {
  const marks = marksFor(chapter, [{ text: "Grace", id: "sarx" }]);
  const where = at(chapter, "deviation");
  assert.equal(blankHint({ hint: "traditional" }, where, marks, TERMS), null);
});

test("blankHint: traditional with the blank's place unknown is null", () => {
  const marks = marksFor(chapter, [{ text: "deviation", id: "hamartia" }]);
  assert.equal(blankHint({ hint: "traditional" }, null, marks, TERMS), null);
  assert.equal(blankHint({ hint: "traditional" }, { start: null, end: null }, marks, TERMS), null);
});

test("blankHint: no hint is null", () => {
  const marks = marksFor(chapter, [{ text: "deviation", id: "hamartia" }]);
  assert.equal(blankHint({ hint: "none" }, at(chapter, "deviation"), marks, TERMS), null);
});

test("termForWords: the first overlapping mark with a traditional wins", () => {
  const marks = marksFor(chapter, [
    { text: "deviation", id: "mystery" }, // no term info
    { text: "from the way", id: "sarx" },
  ]);
  const { start } = at(chapter, "deviation");
  const end = at(chapter, "from the way").end;
  assert.deepEqual(termForWords(start, end, marks, TERMS), { id: "sarx", traditional: "flesh" });
});

test("termForWords: null when nothing overlaps or terms are missing", () => {
  const marks = marksFor(chapter, [{ text: "Grace", id: "sarx" }]);
  const w = at(chapter, "deviation");
  assert.equal(termForWords(w.start, w.end, marks, TERMS), null);
  assert.equal(termForWords(0, 5, marks, undefined), null);
});

/* ── telltaleStems / blanksGivenAway ─────────────────────────────────── */

test("telltaleStems: short and common words never count", () => {
  const stems = telltaleStems("the that this with from they were");
  assert.equal(stems.size, 0);
  assert.equal(telltaleStems("the cat sat").size, 0);
});

test("telltaleStems: stems related words alike and folds diacritics", () => {
  const a = telltaleStems("Café");
  const b = telltaleStems("cafe");
  assert.deepEqual([...a], [...b]);
  assert.equal(a.size, 1);
  assert.deepEqual([...telltaleStems("deviation")], [...telltaleStems("deviating")]);
});

test("telltaleStems: tolerates null", () => {
  assert.equal(telltaleStems(null).size, 0);
  assert.equal(telltaleStems(undefined).size, 0);
});

test("blanksGivenAway: a note with the blank's stem gives it away", () => {
  const blanks = [{ exact: "deviating" }, { exact: "grace" }];
  assert.deepEqual(blanksGivenAway("People characterized by deviation", blanks), [{ exact: "deviating" }]);
});

test("blanksGivenAway: common and short words never trigger", () => {
  const blanks = [{ exact: "the" }, { exact: "that" }];
  assert.deepEqual(blanksGivenAway("the way that it was", blanks), []);
});

test("blanksGivenAway: folds diacritics when matching", () => {
  assert.deepEqual(blanksGivenAway("A Café nearby", [{ exact: "cafe" }]), [{ exact: "cafe" }]);
});

test("blanksGivenAway: an empty note, or no blanks, gives nothing away", () => {
  assert.deepEqual(blanksGivenAway("", [{ exact: "deviation" }]), []);
  assert.deepEqual(blanksGivenAway("deviation", []), []);
});

/* ── footnoteKey ─────────────────────────────────────────────────────── */

const notes = [
  { id: "a", verse: 6, text: "Lit. “missing the mark.”" },
  { id: "b", verse: 6, text: "Or “a path.”" },
  { id: "c", verse: 7, text: "Or “a path.”" },
];

test("footnoteKey: verse and full text, no n when the note has no twin", () => {
  assert.deepEqual(footnoteKey(notes, "a"), { verse: 6, footnote: "Lit. “missing the mark.”" });
  // Same text in a different verse is not a twin.
  assert.deepEqual(footnoteKey(notes, "b"), { verse: 6, footnote: "Or “a path.”" });
});

test("footnoteKey: identical notes in one verse get n by position", () => {
  const twins = [
    { id: "x", verse: 3, text: "See also." },
    { id: "y", verse: 3, text: "See also." },
    { id: "z", verse: 3, text: "Other." },
  ];
  assert.deepEqual(footnoteKey(twins, "x"), { verse: 3, footnote: "See also.", n: 1 });
  assert.deepEqual(footnoteKey(twins, "y"), { verse: 3, footnote: "See also.", n: 2 });
  assert.equal("n" in footnoteKey(twins, "z"), false);
});

test("footnoteKey: an unknown id is null", () => {
  assert.equal(footnoteKey(notes, "nope"), null);
});

/* ── footnoteRows ────────────────────────────────────────────────────── */

test("footnoteRows: with no choice a footnote prints, undecided", () => {
  const rows = footnoteRows(notes, ["a", "c"], [], []);
  assert.deepEqual(rows, [
    { id: "a", verse: 6, text: "Lit. “missing the mark.”", print: true, decided: false, givesAway: [] },
    { id: "c", verse: 7, text: "Or “a path.”", print: true, decided: false, givesAway: [] },
  ]);
});

test("footnoteRows: a spoiler footnote defaults to not printing and lists the blank", () => {
  const list = [{ id: "s", verse: 6, text: "People characterized by deviation." }];
  const blank = { exact: "deviating" };
  const [row] = footnoteRows(list, ["s"], [], [blank]);
  assert.equal(row.print, false);
  assert.equal(row.decided, false);
  assert.deepEqual(row.givesAway, [blank]);
});

test("footnoteRows: an explicit choice overrides the default both ways and sets decided", () => {
  const list = [
    { id: "s", verse: 6, text: "People characterized by deviation." },
    { id: "t", verse: 6, text: "Plain note." },
  ];
  const blank = { exact: "deviating" };
  const choices = [
    { verse: 6, footnote: "People characterized by deviation.", print: true },
    { verse: 6, footnote: "Plain note.", print: false },
  ];
  const rows = footnoteRows(list, ["s", "t"], choices, [blank]);
  assert.equal(rows[0].print, true);
  assert.equal(rows[0].decided, true);
  assert.deepEqual(rows[0].givesAway, [blank]); // still reported
  assert.equal(rows[1].print, false);
  assert.equal(rows[1].decided, true);
});

test("footnoteRows: choices match by wording, ignoring quote and dash typography", () => {
  const list = [{ id: "a", verse: 2, text: "He said “yes” – twice." }];
  const choices = [{ verse: 2, footnote: 'He said "yes" - twice.', print: false }];
  const [row] = footnoteRows(list, ["a"], choices, []);
  assert.equal(row.decided, true);
  assert.equal(row.print, false);
});

test("footnoteRows: a choice for another verse does not match", () => {
  const choices = [{ verse: 7, footnote: "Lit. “missing the mark.”", print: false }];
  const [row] = footnoteRows(notes, ["a"], choices, []);
  assert.equal(row.decided, false);
  assert.equal(row.print, true);
});

test("footnoteRows: n tells apart identical notes in one verse", () => {
  const twins = [
    { id: "x", verse: 3, text: "See also." },
    { id: "y", verse: 3, text: "See also." },
  ];
  const choices = [{ verse: 3, footnote: "See also.", n: 2, print: false }];
  const rows = footnoteRows(twins, ["x", "y"], choices, []);
  assert.equal(rows[0].decided, false);
  assert.equal(rows[0].print, true);
  assert.equal(rows[1].decided, true);
  assert.equal(rows[1].print, false);
});

test("footnoteRows: a choice with no n means the first of identical notes", () => {
  const twins = [
    { id: "x", verse: 3, text: "See also." },
    { id: "y", verse: 3, text: "See also." },
  ];
  const choices = [{ verse: 3, footnote: "See also.", print: false }];
  const rows = footnoteRows(twins, ["x", "y"], choices, []);
  assert.equal(rows[0].decided, true);
  assert.equal(rows[1].decided, false);
});

test("footnoteRows: a choice whose footnote has gone is ignored, as is an unknown id", () => {
  const choices = [{ verse: 6, footnote: "A note that no longer exists.", print: false }];
  const rows = footnoteRows(notes, ["a", "nope"], choices, []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].decided, false);
  assert.equal(rows[0].print, true);
});

test("footnoteRows: tolerates choices being null", () => {
  const rows = footnoteRows(notes, ["a"], null, []);
  assert.equal(rows[0].print, true);
});

/* ── setFootnoteChoices ──────────────────────────────────────────────── */

test("setFootnoteChoices: writes a decision for each footnote given", () => {
  const next = setFootnoteChoices([], notes, ["a", "b"], false);
  assert.deepEqual(next, [
    { verse: 6, footnote: "Lit. “missing the mark.”", print: false },
    { verse: 6, footnote: "Or “a path.”", print: false },
  ]);
});

test("setFootnoteChoices: replaces an existing choice rather than duplicating it", () => {
  const before = [{ verse: 6, footnote: "Lit. “missing the mark.”", print: false }];
  const next = setFootnoteChoices(before, notes, ["a"], true);
  assert.equal(next.length, 1);
  assert.equal(next[0].print, true);
});

test("setFootnoteChoices: replaces by wording, so a typographic variant is not duplicated", () => {
  const list = [{ id: "a", verse: 2, text: "He said “yes” – twice." }];
  const before = [{ verse: 2, footnote: 'He said "yes" - twice.', print: false }];
  const next = setFootnoteChoices(before, list, ["a"], true);
  assert.equal(next.length, 1);
  assert.equal(next[0].print, true);
  assert.equal(next[0].footnote, "He said “yes” – twice.");
});

test("setFootnoteChoices: keeps unrelated choices, and does not mutate its input", () => {
  const other = { verse: 99, footnote: "Gone note.", print: false };
  const before = [other];
  const next = setFootnoteChoices(before, notes, ["a"], true);
  assert.equal(next.length, 2);
  assert.deepEqual(next[0], other);
  assert.equal(before.length, 1);
});

test("setFootnoteChoices: ignores ids that are not footnotes, and a null choices list", () => {
  assert.deepEqual(setFootnoteChoices(null, notes, ["nope"], true), []);
});

test("setFootnoteChoices: twins each get their own choice by n", () => {
  const twins = [
    { id: "x", verse: 3, text: "See also." },
    { id: "y", verse: 3, text: "See also." },
  ];
  const next = setFootnoteChoices([], twins, ["x", "y"], true);
  assert.deepEqual(next, [
    { verse: 3, footnote: "See also.", n: 1, print: true },
    { verse: 3, footnote: "See also.", n: 2, print: true },
  ]);
});

/* ── countWords / htmlToText / commercialShare ───────────────────────── */

test("countWords: counts runs holding a letter or digit", () => {
  assert.equal(countWords("In the beginning"), 3);
  assert.equal(countWords("  spaced   out  "), 2);
  assert.equal(countWords("— – ... 3:16 word"), 2);
  assert.equal(countWords(""), 0);
  assert.equal(countWords(null), 0);
});

test("htmlToText: block tags become spaces so adjacent blocks count as separate words", () => {
  const text = htmlToText("<p>a</p><p>b</p>");
  assert.equal(countWords(text), 2);
  assert.equal(countWords(htmlToText("<h2>One</h2><ul><li>two</li><li>three</li></ul>")), 3);
  assert.equal(countWords(htmlToText("line one<br>line two")), 4);
});

test("htmlToText: inline tags vanish and entities are decoded", () => {
  assert.equal(htmlToText("<p>one <strong>two</strong>three</p>").replace(/\s+/g, " ").trim(), "one twothree");
  assert.equal(htmlToText("a &amp; b &lt;c&gt; &quot;d&quot;&nbsp;e"), 'a & b <c> "d" e');
  assert.equal(htmlToText(null), "");
});

test("htmlToText: &amp;lt; decodes once, not twice", () => {
  assert.equal(htmlToText("&amp;lt;"), "&lt;");
});

test("commercialShare: totals and share", () => {
  assert.deepEqual(commercialShare(30, 70), { lit: 30, own: 70, total: 100, share: 0.3, over: false });
});

test("commercialShare: an empty sheet has a null share and is not over", () => {
  assert.deepEqual(commercialShare(0, 0), { lit: 0, own: 0, total: 0, share: null, over: false });
});

test("commercialShare: over only when strictly above half", () => {
  assert.equal(commercialShare(50, 50).over, false);
  assert.equal(commercialShare(51, 49).over, true);
  assert.equal(commercialShare(10, 0).over, true);
  assert.equal(commercialShare(0, 10).over, false);
});

/* ── booksToCheck / completeBooks ────────────────────────────────────── */

test("booksToCheck: a one-chapter book is checked once its chapter is touched", () => {
  assert.deepEqual(booksToCheck([{ bookKey: "philemon", chapter: 1 }]), ["philemon"]);
  assert.deepEqual(
    booksToCheck([
      { bookKey: "philemon", chapter: 1 },
      { bookKey: "jude", chapter: 1 },
    ]),
    ["philemon", "jude"],
  );
});

test("booksToCheck: a multi-chapter book needs every chapter touched", () => {
  const some = [1, 2, 3].map((chapter) => ({ bookKey: "colossians", chapter }));
  assert.deepEqual(booksToCheck(some), []);
  const all = [1, 2, 3, 4, 2].map((chapter) => ({ bookKey: "colossians", chapter }));
  assert.deepEqual(booksToCheck(all), ["colossians"]);
});

test("booksToCheck: an unknown book is never checked", () => {
  assert.deepEqual(booksToCheck([{ bookKey: "notabook", chapter: 1 }]), []);
});

const range = (n) => Array.from({ length: n }, (_, i) => i + 1);

test("completeBooks: a passage covering every verse makes the book complete", () => {
  const passages = [{ bookKey: "philemon", chapter: 1, verse: 1, endVerse: 25 }];
  assert.deepEqual(
    completeBooks(passages, () => range(25)),
    ["philemon"],
  );
});

test("completeBooks: several passages together can cover a chapter", () => {
  const passages = [
    { bookKey: "jude", chapter: 1, verse: 1, endVerse: 10 },
    { bookKey: "jude", chapter: 1, verse: 11, endVerse: 25 },
  ];
  assert.deepEqual(
    completeBooks(passages, () => range(25)),
    ["jude"],
  );
});

test("completeBooks: a passage without endVerse covers just its verse", () => {
  assert.deepEqual(
    completeBooks([{ bookKey: "philemon", chapter: 1, verse: 1 }], () => [1]),
    ["philemon"],
  );
  assert.deepEqual(
    completeBooks([{ bookKey: "philemon", chapter: 1, verse: 1 }], () => [1, 2]),
    [],
  );
});

test("completeBooks: a missing verse means the book is not complete", () => {
  const passages = [{ bookKey: "philemon", chapter: 1, verse: 1, endVerse: 24 }];
  assert.deepEqual(
    completeBooks(passages, () => range(25)),
    [],
  );
});

test("completeBooks: verses unknown (null or empty) keep the book from counting", () => {
  const passages = [{ bookKey: "philemon", chapter: 1, verse: 1, endVerse: 25 }];
  assert.deepEqual(
    completeBooks(passages, () => null),
    [],
  );
  assert.deepEqual(
    completeBooks(passages, () => []),
    [],
  );
});

test("completeBooks: every chapter of a multi-chapter book must be covered", () => {
  const verses = { 1: 3, 2: 2, 3: 2, 4: 2 };
  const full = [1, 2, 3, 4].map((chapter) => ({ bookKey: "colossians", chapter, verse: 1, endVerse: verses[chapter] }));
  assert.deepEqual(
    completeBooks(full, (_b, c) => range(verses[c])),
    ["colossians"],
  );
  const gap = full.map((p) => (p.chapter === 3 ? { ...p, endVerse: 1 } : p));
  assert.deepEqual(
    completeBooks(gap, (_b, c) => range(verses[c])),
    [],
  );
});

test("completeBooks: only the books that are complete are returned", () => {
  const passages = [
    { bookKey: "philemon", chapter: 1, verse: 1, endVerse: 25 },
    { bookKey: "jude", chapter: 1, verse: 1, endVerse: 5 },
  ];
  assert.deepEqual(
    completeBooks(passages, (b) => range(25)),
    ["philemon"],
  );
});

test("traditionalWord: lowercases and drops the glossary's own disambiguator", () => {
  assert.equal(traditionalWord({ traditional: "Good [2]" }), "good");
  assert.equal(traditionalWord({ traditional: "Sin" }), "sin");
  assert.equal(traditionalWord(null), "");
});

test("collectKeyTerms and termForWords print a disambiguated term plainly", () => {
  const terms = { good: { traditional: "Good [2]", greek: "agathos", title: "Beneficial" } };
  const marks = marksFor(chapter, [{ text: "deviation", id: "good" }]);
  const [term] = collectKeyTerms([{ chapter, marks, terms }]);
  assert.equal(term.traditional, "good");
  assert.equal(keyTermLine(term), "deviation, traditionally good, agathos");
  assert.equal(termForWords(marks[0].start, marks[0].end, marks, terms).traditional, "good");
});
