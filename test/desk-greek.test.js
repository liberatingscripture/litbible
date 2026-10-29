import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import {
  borrowedFor, firstWordOf, flattenWords, indexOfWord, joinAnd, lsjShard, moveFrom, nearestVerse, noteVerseFor, orderSenses,
  SIGNS, W, renderingsIn, splitSigns, stepShard, strongNumber, termsForLemma, ubsShard, verseGreek, versesOf,
} from "../src/lib/desk-greek.mjs";

// [verse, t, text, pre, post, lemma, pos, parse, sense]
const word = (verse, t, text, pre = "", post = " ") => [verse, t, text, pre, post, 0, "N-", "----NSF-", null];
const chapter = [
  [word(1, 1, "Οὐδὲν"), word(1, 2, "ἄρα", "", ", "), word(2, 1, "ὁ", "⸂"), word(2, 2, "νόμος", "", "⸃ ")],
  [word(3, 1, "τὸ"), word(3, 2, "γὰρ", "", ".")],
];
const flat = flattenWords(chapter);

test("a chapter's words flatten in reading order, each knowing its paragraph", () => {
  assert.equal(flat.length, 6);
  assert.deepEqual(flat.map((x) => x.p), [0, 0, 0, 0, 1, 1]);
  assert.deepEqual(versesOf(flat), [1, 2, 3]);
});

test("a verse's text is its words joined as SBL prints them", () => {
  assert.equal(verseGreek(flat, 1), "Οὐδὲν ἄρα,");
  assert.equal(verseGreek(flat, 2), "⸂ὁ νόμος⸃");
  assert.equal(verseGreek(flat, 9), "");
});

test("signs are split from the text around them", () => {
  assert.deepEqual(splitSigns("⸂τῷ"), [{ text: "⸂", sign: true }, { text: "τῷ", sign: false }]);
  assert.deepEqual(splitSigns("a⸃, "), [{ text: "a", sign: false }, { text: "⸃", sign: true }, { text: ", ", sign: false }]);
  assert.deepEqual(splitSigns(""), []);
});

test("the arrow keys move by word and by verse, and stop at the chapter's edges", () => {
  assert.equal(moveFrom(flat, 2, "ArrowRight"), 3);
  assert.equal(moveFrom(flat, 2, "ArrowLeft"), 1);
  assert.equal(moveFrom(flat, 0, "ArrowLeft"), null);
  assert.equal(moveFrom(flat, 5, "ArrowRight"), null);
  assert.equal(moveFrom(flat, 3, "Home"), 0);
  assert.equal(moveFrom(flat, 3, "End"), 5);
  assert.equal(moveFrom(flat, 3, "ArrowDown"), 4, "the next verse's first word");
  assert.equal(moveFrom(flat, 3, "ArrowUp"), 0, "the previous verse's first word");
  assert.equal(moveFrom(flat, 1, "ArrowUp"), null, "nothing before verse 1");
  assert.equal(moveFrom(flat, 5, "ArrowDown"), null, "nothing after the last verse");
  assert.equal(moveFrom(flat, 0, "x"), null);
  assert.equal(moveFrom([], 0, "Home"), null);
});

test("a word is found by its verse and place", () => {
  assert.equal(firstWordOf(flat, 2), 2);
  assert.equal(indexOfWord(flat, 2, 2), 3);
  assert.equal(indexOfWord(flat, 2, 9), -1);
});

test("each lexicon file is found by the rule the data was cut with", () => {
  assert.equal(ubsShard("008063001000000"), String(8063 % 64).padStart(2, "0"));
  assert.equal(ubsShard("000064001"), "00", "two digits, padded");
  assert.equal(strongNumber("G4561"), 4561);
  assert.equal(strongNumber(null), null);
  assert.equal(strongNumber("H12"), null);
  assert.equal(stepShard("G4561"), String(4561 % 64).padStart(2, "0"));
  assert.equal(lsjShard("G4561"), String(4561 % 128).padStart(3, "0"));
  assert.equal(lsjShard("G5"), "005");
  assert.equal(stepShard(null), null);
});

test("the sense UBS gives at this word comes first, every other in order", () => {
  const senses = [{ code: "a" }, { code: "b" }, { code: "c" }];
  const o = orderSenses(senses, 1);
  assert.equal(o.here.sense.code, "b");
  assert.equal(o.here.index, 1);
  assert.deepEqual(o.others.map((x) => x.sense.code), ["a", "c"]);
  assert.deepEqual(o.others.map((x) => x.index), [0, 2]);
});

test("a word with no sense, or one past the entry's end, labels none", () => {
  const senses = [{ code: "a" }, { code: "b" }];
  assert.equal(orderSenses(senses, null).here, null);
  assert.deepEqual(orderSenses(senses, null).others.map((x) => x.sense.code), ["a", "b"]);
  assert.equal(orderSenses(senses, 5).here, null);
  assert.deepEqual(orderSenses(undefined, 0), { here: null, others: [] });
});

const termData = {
  terms: {
    "flesh-body": { title: "Flesh", traditional: "Flesh", lemmas: ["σάρξ", "σαρκικός"] },
    "other": { title: "Other", lemmas: [] },
    "bare": { title: "Bare" },
  },
  marks: [
    { v: 3, text: "self-preservation", id: "flesh-body", form: "self-preservation" },
    { v: 3, text: "Self-Preservation", id: "flesh-body", form: "Self-preservation" },
    { v: 4, text: "body", id: "flesh-body", form: "body" },
    { v: 3, text: "x", id: "other", form: "x" },
  ],
};

test("a lemma finds the page's glossary terms that govern it", () => {
  assert.deepEqual(termsForLemma(termData, "σάρξ"), [{ id: "flesh-body", title: "Flesh", traditional: "Flesh" }]);
  assert.deepEqual(termsForLemma(termData, "σάρξ".normalize("NFD")), termsForLemma(termData, "σάρξ"), "typed either way");
  assert.deepEqual(termsForLemma(termData, "λόγος"), []);
  assert.deepEqual(termsForLemma(null, "σάρξ"), []);
  assert.deepEqual(termsForLemma(termData, ""), []);
});

test("a verse's renderings of a term are its distinct forms in order", () => {
  assert.deepEqual(renderingsIn(termData, "flesh-body", 3), ["self-preservation"]);
  assert.deepEqual(renderingsIn(termData, "flesh-body", 4), ["body"]);
  assert.deepEqual(renderingsIn(termData, "flesh-body", 9), []);
  assert.deepEqual(renderingsIn(null, "flesh-body", 3), []);
});

test("renderings read as a sentence", () => {
  assert.equal(joinAnd([]), "");
  assert.equal(joinAnd(["a"]), "a");
  assert.equal(joinAnd(["a", "b"]), "a and b");
  assert.equal(joinAnd(["a", "b", "c"]), "a, b, and c");
  assert.equal(joinAnd(["a", "b", "c", "d"]), "a, b, c, and d");
});

test("a verse inside a borrowed passage names it", () => {
  const borrowed = [[53, 53, "macula-sblgnt"]];
  assert.deepEqual(borrowedFor(borrowed, 53), [53, 53, "macula-sblgnt"]);
  assert.equal(borrowedFor(borrowed, 52), null);
  assert.equal(borrowedFor(undefined, 1), null);
});

/* ── A note on a span, and a verse the Greek lacks ─────────────── */

const GREEK_TEXT = new URL("../public/greek/text/", import.meta.url);
const chapters = readdirSync(GREEK_TEXT).filter((f) => f.endsWith(".json")).map((f) => ({
  file: f,
  data: JSON.parse(readFileSync(new URL(f, GREEK_TEXT), "utf8")),
}));

test("a verse's note is the nearest at or before it, or none", () => {
  assert.equal(noteVerseFor([22, 25], 22), 22);
  assert.equal(noteVerseFor([22, 25], 23), 22);
  assert.equal(noteVerseFor([22, 25], 99), 25);
  assert.equal(noteVerseFor([22, 25], 21), null);
  assert.equal(noteVerseFor([], 3), null);
  assert.equal(noteVerseFor(undefined, 3), null);
});

// Run with `exact` it is the lookup the tab used to make; it fails for eight verses.
function unreached(lookup) {
  const bad = [];
  for (const { file, data } of chapters) {
    const noteVerses = (data.apparatus ?? []).map((a) => a[0]);
    const signed = new Set();
    for (const words of data.paragraphs) {
      for (const w of words) {
        if ([w[W.pre], w[W.text], w[W.post]].some((t) => [...t].some((c) => SIGNS.includes(c)))) signed.add(w[W.verse]);
      }
    }
    for (const verse of signed) if (lookup(noteVerses, verse) == null) bad.push(`${file.replace(".json", "")}:${verse}`);
  }
  return bad;
}

test("every verse with an apparatus sign reaches a note", () => {
  assert.equal(chapters.length, 260);
  assert.deepEqual(unreached(noteVerseFor), []);
});

test("the old exact-verse lookup left eight signs leading nowhere", () => {
  const exact = (noteVerses, verse) => (noteVerses.includes(verse) ? verse : null);
  assert.equal(unreached(exact).length, 8);
});

test("a passage's verse opens at that verse, else the nearest before, else after", () => {
  assert.equal(nearestVerse([1, 2, 3], 2), 2);
  assert.equal(nearestVerse([1, 2, 4], 3), 2);
  assert.equal(nearestVerse([3, 4], 1), 3);
  assert.equal(nearestVerse([1, 2, 3], 99), 3);
  assert.equal(nearestVerse([], 1), null);
  assert.equal(nearestVerse([1, 2], null), null);
  assert.equal(nearestVerse([1, 2], "2"), null);
  assert.equal(nearestVerse([1, 2], NaN), null);
});

test("Matthew 17:21, which neither text has, opens at 17:20", () => {
  const mt = chapters.find((c) => c.file === "matthew-17.json").data;
  const verses = versesOf(flattenWords(mt.paragraphs));
  assert.equal(verses.includes(21), false);
  assert.equal(nearestVerse(verses, 21), 20);
});
