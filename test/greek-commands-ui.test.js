// The pure pieces behind the Greek search commands' screens
// (src/lib/greek-commands-ui.mjs): putting a command in the field, building a
// word, the query a parsing starts, and a result verse read off a chapter.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  builderQuery,
  editSpan,
  formsLine,
  insertAtCursor,
  parsingQuery,
  replaceWord,
  verseGreek,
} from "../src/lib/greek-commands-ui.mjs";
import { codeFits, parseGreekQuery } from "../src/lib/greek-query.mjs";

// ── Putting a command in the field ──────────────────────────────────────

const put = (value, text, at = value.length, to = at) => insertAtCursor(value, at, to, text);

test("a command that joins the text before it adds no space, and none after", () => {
  assert.deepEqual(put("", ".gen"), { value: ".gen", caret: 4 });
  assert.deepEqual(put("πίστις", ".gen"), { value: "πίστις.gen", caret: 10 });
  assert.deepEqual(put("πίστις", "/"), { value: "πίστις/", caret: 7 });
  assert.deepEqual(put("πίστις, ", "="), { value: "πίστις, =", caret: 9 });
  assert.deepEqual(put("πίστις and ", "\""), { value: "πίστις and \"", caret: 12 });
});

test("a comma takes the space before it away and leaves one after", () => {
  assert.deepEqual(put("πίστις", ", "), { value: "πίστις, ", caret: 8 });
  assert.deepEqual(put("πίστις  ", ", "), { value: "πίστις, ", caret: 8 });
  const mid = put("πίστις  Χριστός", ", ", 6);
  assert.deepEqual(mid, { value: "πίστις, Χριστός", caret: 8 });
});

test("other commands get a space before when they follow a word, and one after", () => {
  assert.deepEqual(put("πίστις", "~0"), { value: "πίστις ~0 ", caret: 10 });
  assert.deepEqual(put("πίστις.gen ", "&"), { value: "πίστις.gen & ", caret: 13 });
  assert.deepEqual(put("", "~v"), { value: "~v ", caret: 3 });
  assert.deepEqual(put("pistis", "pistis.gen"), { value: "pistis pistis.gen ", caret: 18 });
});

test("a star takes no space after, so a parsing can follow it", () => {
  const star = put("πίστις, ", "*");
  assert.deepEqual(star, { value: "πίστις, *", caret: 9 });
  assert.equal(put(star.value, ".gen").value, "πίστις, *.gen");
  assert.equal(put("πίστις", "*").value, "πίστις *");
});

test("inserting in the middle or over a selection keeps the rest, with no doubled space", () => {
  assert.deepEqual(put("πίστις Χριστός", ".gen", 6), { value: "πίστις.gen Χριστός", caret: 10 });
  assert.deepEqual(put("a b", "&", 1), { value: "a & b", caret: 3 });
  assert.deepEqual(put("abc def", "&", 0, 3), { value: "& def", caret: 1 });
  assert.deepEqual(put("πίστις", ".gen", 99), { value: "πίστις.gen", caret: 10 }, "a cursor past the end is the end");
  assert.deepEqual(put("πίστις", ".gen", null, null), { value: "πίστις.gen", caret: 10 }, "no cursor is the end");
});

test("every insertion the window offers leaves a query that reads", () => {
  let v = "";
  for (const t of ["πίστις", ".gen", ", ", "Ἰησοῦς", "/", "Χριστός", ".gen", "~0"]) {
    v = insertAtCursor(v, v.length, v.length, t).value;
  }
  assert.equal(parseGreekQuery(v).error, undefined, v);
});

// ── Build a word ────────────────────────────────────────────────────────

test("Build a word joins the word and its filters, or starts from a star", () => {
  assert.equal(builderQuery("πίστις", ["gen"]), "πίστις.gen");
  assert.equal(builderQuery("", ["aor", "impv"]), "*.aor.impv");
  assert.equal(builderQuery("  πίστις  ", []), "πίστις");
  assert.equal(builderQuery("", []), "", "nothing chosen adds nothing");
  assert.equal(builderQuery("", ["", "gen"]), "*.gen", "an unchosen picker is left out");
  assert.equal(builderQuery("πίστις", ["gen", "noun"]), "πίστις.noun.gen", "filters read in the order of a parsing");
  assert.equal(parseGreekQuery(builderQuery("", ["pres", "ptc", "nom"])).error, undefined);
});

// ── A word's parsing as a search ────────────────────────────────────────

test("a parsing starts a search for every word parsed so", () => {
  assert.equal(parsingQuery("V-", "2AAD-P--"), "*.aor.act.impv.2nd.pl");
  assert.equal(parsingQuery("N-", "----GSF-"), "*.noun.gen.sg.fem");
  assert.equal(parsingQuery("RA", "----NSM-"), "*.art.nom.sg.masc");
  assert.equal(parsingQuery("RP", "----GP--"), "*.pron.gen.pl");
  assert.equal(parsingQuery("V-", "-PAPNSM-"), "*.pres.act.ptc.nom.sg.masc");
  assert.equal(parsingQuery("A-", "----NSMC"), "*.adj.nom.sg.masc.comp");
  assert.equal(parsingQuery("C-", "--------"), "*.conj");
  assert.equal(parsingQuery("", ""), null, "a word with no parsing starts nothing");
});

test("the query a parsing starts is read, and the word it came from fits it", () => {
  for (const [pos, parse] of [["V-", "2AAD-P--"], ["N-", "----GSF-"], ["RA", "----NSM-"], ["RP", "----GP--"], ["V-", "-PAPNSM-"], ["A-", "----NSMC"]]) {
    const q = parsingQuery(pos, parse);
    const parsed = parseGreekQuery(q);
    assert.equal(parsed.error, undefined, q);
    assert.equal(parsed.terms.length, 1, q);
    assert.equal(codeFits(parsed.terms[0].filters, pos + parse), true, q);
  }
});

// ── "Did you mean…?" ────────────────────────────────────────────────────

test("a suggestion replaces the word it corrects, not part of another", () => {
  assert.equal(replaceWord("πίστις.genetive", "genetive", "genitive"), "πίστις.genitive");
  assert.equal(replaceWord("genetive, πίστις.gen", "genetive", "genitive"), "genitive, πίστις.gen");
  assert.equal(replaceWord("pistis xgenetive genetive", "genetive", "genitive"), "pistis xgenetive genitive", "whole words only");
  assert.equal(replaceWord("πίστις.GENETIVE", "genetive", "genitive"), "πίστις.genitive", "case is not a barrier");
  assert.equal(replaceWord("πίστις.gen", "genetive", "genitive"), "πίστις.gen", "absent is unchanged");
  assert.equal(replaceWord("a.b", "a.b", "c"), "c", "regex characters are literal");
});

// ── A verse read off a chapter ──────────────────────────────────────────

// [verse, t, text, pre, post, lemma, pos, parse, sense]
const chapter = {
  paragraphs: [
    [
      [16, 1, "εἰδότες", "", " ", 0, "V-", "-XAPNPM-", 0],
      [16, 2, "⸀δὲ", "", " ", 1, "C-", "--------", 0],
      [16, 3, "πίστεως", "", " ", 2, "N-", "----GSF-", 0],
      [16, 4, "Χριστοῦ", "", ", ", 3, "N-", "----GSM-", 0],
      [17, 1, "ἄλλο", "", "", 4, "A-", "----NSN-", 0],
    ],
  ],
};
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

test("a verse's Greek is drawn with every marked word marked, and those words named", () => {
  const v = verseGreek(chapter, 16, [3, 4], esc);
  assert.equal(v.html, "εἰδότες δὲ <mark>πίστεως</mark> <mark>Χριστοῦ</mark>,");
  assert.deepEqual(v.words.map((w) => w.form), ["πίστεως", "Χριστοῦ"]);
  assert.equal(v.words[0].said, "noun, genitive feminine singular");
  assert.equal(v.words[1].said, "noun, genitive masculine singular");
  assert.equal(formsLine(v.words), "πίστεως … Χριστοῦ");
});

test("marked words come back in reading order, signs and punctuation off the form", () => {
  const v = verseGreek(chapter, 16, [4, 2], esc);
  assert.deepEqual(v.words.map((w) => w.t), [2, 4]);
  assert.equal(v.words[0].form, "δὲ", "the text-critical sign is not part of the form");
  assert.doesNotMatch(v.html, /⸀/);
});

test("a verse the chapter lacks, or a missing chapter, gives nothing", () => {
  assert.deepEqual(verseGreek(chapter, 99, [1], esc), { html: "", words: [] });
  assert.deepEqual(verseGreek(null, 16, [1], esc), { html: "", words: [] });
  assert.equal(formsLine([]), "");
});

test("the Greek is escaped as the caller says", () => {
  const odd = { paragraphs: [[[1, 1, "a<b", "", "", 0, "N-", "--------", 0]]] };
  assert.equal(verseGreek(odd, 1, [1], esc).html, "<mark>a&lt;b</mark>");
});

// ── Typing a command in, so undo keeps working (BA147) ──────────────────

test("a command replaces only what changed, so undo takes back only that", () => {
  assert.deepEqual(editSpan("πίστις", "πίστις.gen"), { start: 6, end: 6, text: ".gen" });
  assert.deepEqual(editSpan("πίστις  Χριστός", "πίστις, Χριστός"), { start: 6, end: 7, text: "," }, "the space both share stays");
  assert.deepEqual(editSpan("abc def", "& def"), { start: 0, end: 3, text: "&" });
  assert.deepEqual(editSpan("", "*.aor.impv"), { start: 0, end: 0, text: "*.aor.impv" });
  assert.deepEqual(editSpan("same", "same"), { start: 4, end: 4, text: "" });
  assert.deepEqual(editSpan("aa", "aaa"), { start: 2, end: 2, text: "a" }, "a repeated letter is still one insertion");
  for (const [a, b] of [["πίστις", "πίστις.gen"], ["x y", "x & y"], ["old query", "πίστις.gen"], ["ab", ""]]) {
    const { start, end, text } = editSpan(a, b);
    assert.equal(a.slice(0, start) + text + a.slice(end), b);
  }
});
