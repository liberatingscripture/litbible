// test/desk-sheet-leaks.test.js
//
// The participant version's "what prints" check and the answer key's rows
// (src/lib/desk-sheet-leaks.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";

import { answerKeyLine, answerKeyRows, containsPhrase, findLeaks, leakSentence } from "../src/lib/desk-sheet-leaks.mjs";

const blank = (exact, extra = {}) => ({ passageId: "p1", ref: "Romans 3:23", exact, ...extra });

test("containsPhrase matches whole words, ignoring case and accents", () => {
  assert.equal(containsPhrase("What is Deviation?", "deviation"), true);
  assert.equal(containsPhrase("deviations", "deviation"), false);
  assert.equal(containsPhrase("The café", "CAFE"), true);
  assert.equal(containsPhrase("fell short of glory", "short of"), true);
  assert.equal(containsPhrase("short, then of", "short of"), false);
});

test("a blank on grammatical words alone is never a leak", () => {
  assert.equal(containsPhrase("the end of the day", "the"), false);
  assert.deepEqual(findLeaks([blank("of the")], [{ kind: "title", where: "the title", text: "Of the people" }]), []);
});

test("a blank's words in the title, a text part, and a question are named", () => {
  const leaks = findLeaks([blank("deviation")], [
    { kind: "title", where: "the title", text: "Deviation and grace" },
    { kind: "text", where: "text part 1", text: "Nothing here." },
    { kind: "question", where: "question 2", text: "What is deviation?" },
  ]);
  assert.deepEqual(leaks.map((l) => l.where), ["the title", "question 2"]);
  assert.equal(leakSentence(leaks[1]), "“deviation,” blanked in Romans 3:23, also prints in question 2.");
});

test("another passage that shows the words unblanked leaks; the blank's own passage does not", () => {
  const leaks = findLeaks([blank("sin")], [
    { kind: "passage", where: "Romans 3:23", text: "all have sin", passageId: "p1" },
    { kind: "passage", where: "Romans 5:12", text: "sin entered", passageId: "p2" },
  ]);
  assert.deepEqual(leaks.map((l) => l.where), ["Romans 5:12"]);
});

test("a footnote is held to the footnote rule, against every blank on the sheet (GF8b-7)", () => {
  const surfaces = [
    { kind: "footnote", where: "footnote a of Romans 3:23", text: "Other people characterized by deviation.", passageId: "p1" },
    { kind: "footnote", where: "footnote a of Mark 1:1", text: "Other people characterized by deviation.", passageId: "p2" },
  ];
  const leaks = findLeaks([blank("deviating")], surfaces);
  // blank() sits in p1; a footnote to another passage that names it is flagged too.
  assert.deepEqual(leaks.map((l) => l.where), ["footnote a of Romans 3:23", "footnote a of Mark 1:1"]);
});

test("a footnote that names the traditional word the hint hides leaks", () => {
  const leaks = findLeaks(
    [blank("self-preservation", { telltale: "flesh" })],
    [{ kind: "footnote", where: "footnote b", text: "Traditionally, flesh.", passageId: "p1" }],
  );
  assert.equal(leaks.length, 1);
});

test("nothing to report gives an empty list, and a repeat is reported once", () => {
  assert.deepEqual(findLeaks([blank("zebra")], [{ kind: "title", where: "the title", text: "Grace" }]), []);
  assert.deepEqual(findLeaks([], []), []);
  const twice = findLeaks([blank("grace"), blank("Grace")], [{ kind: "title", where: "the title", text: "Grace" }]);
  assert.equal(twice.length, 1);
});

test("the answer key lists each passage's blanks in order, with hints", () => {
  const rows = answerKeyRows([
    { ref: "Romans 3:23", blanks: [{ answer: "deviation", hint: "traditionally: sin" }, { answer: "glory" }] },
    { ref: "John 3:16", blanks: [] },
    { ref: "Mark 1:1", blanks: [{ answer: "  " }] },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(answerKeyLine(rows[0]), "Romans 3:23: 1. deviation (traditionally: sin); 2. glory");
});

test("Hebrew points do not defeat the check (DK6-4)", () => {
  assert.equal(containsPhrase("שלום עליכם", "שָׁלוֹם"), true);
  assert.equal(containsPhrase("שָׁלוֹם", "שלום"), true);
});

test("the traditional word a hint hides leaks from a title or question too (DK6-5)", () => {
  const b = blank("self-preservation", { telltale: "flesh" });
  const leaks = findLeaks([b], [
    { kind: "title", where: "the title", text: "Life in the flesh" },
    { kind: "question", where: "the question “What is flesh?”", text: "What is flesh?" },
    { kind: "passage", where: "Romans 8:5", text: "flesh", passageId: "p1" },
  ]);
  assert.deepEqual(leaks.map((l) => l.where), ["the title", "the question “What is flesh?”"]);
  assert.equal(leakSentence(leaks[0]), "“self-preservation,” blanked in Romans 3:23, is given away by “flesh” in the title.");
});

test("each alternative of a slashed traditional word gives the blank away, and the sentence names the one found (E85)", () => {
  // A blank whose verse holds two words of its term's family could be either.
  const leaks = findLeaks([blank("trusts", { telltale: "faith / believe" })], [
    { kind: "title", where: "the title", text: "What we believe" },
    { kind: "question", where: "question 1", text: "Where is faith in this?" },
    { kind: "text", where: "text part 1", text: "Nothing of the kind" },
  ]);
  assert.deepEqual(leaks.map((l) => [l.where, l.telltale]), [["the title", "believe"], ["question 1", "faith"]]);
  assert.equal(leakSentence(leaks[0]), "“trusts,” blanked in Romans 3:23, is given away by “believe” in the title.");
  // A word the list writes with a slash is read the same way: "Gehenna hell" in a row is found nowhere.
  const valley = blank("Hinnom Valley", { telltale: "Gehenna/hell" });
  const hell = findLeaks([valley], [{ kind: "title", where: "the title", text: "Heaven and hell" }]);
  assert.deepEqual(hell.map((l) => l.telltale), ["hell"]);
  const gehenna = findLeaks([valley], [{ kind: "question", where: "question 3", text: "Where was gehenna?" }]);
  assert.equal(leakSentence(gehenna[0]), "“Hinnom Valley,” blanked in Romans 3:23, is given away by “Gehenna” in question 3.");
});

test("the entry's own word gives away a blank on another word of its family (E85)", () => {
  // "trusted" renders pisteuo, traditionally "believe"; a question about "faith" tells just the same.
  const trusted = blank("trusted", { telltale: "believe", also: "faith" });
  const leaks = findLeaks([trusted], [
    { kind: "question", where: "question 1", text: "What is faith?" },
    { kind: "title", where: "the title", text: "What we believe" },
    { kind: "text", where: "text part 1", text: "Nothing of the kind" },
    { kind: "passage", where: "Romans 4:5", text: "faith counted", passageId: "p1" },
  ]);
  assert.deepEqual(leaks.map((l) => [l.where, l.telltale]), [["question 1", "faith"], ["the title", "believe"]]);
  assert.equal(leakSentence(leaks[0]), "“trusted,” blanked in Romans 3:23, is given away by “faith” in question 1.");
});

test("a phrase's telling word gives the blank away without the small word that carries it (E85)", () => {
  // "have mercy" in a row is rare in a question; "mercy" is what tells, and "have" tells nothing.
  const mercy = findLeaks([blank("shows compassion", { telltale: "have mercy" })], [
    { kind: "question", where: "question 2", text: "Where do you see mercy here?" },
    { kind: "title", where: "the title", text: "What we have" },
  ]);
  assert.deepEqual(mercy.map((l) => [l.where, l.telltale]), [["question 2", "mercy"]]);
  const peace = blank("make peace", { telltale: "make atonement/be merciful" });
  const found = findLeaks([peace], [
    { kind: "title", where: "the title", text: "A day of atonement" },
    { kind: "question", where: "question 1", text: "Who is merciful?" },
    { kind: "text", where: "text part 1", text: "What will you make of it, and be?" },
  ]);
  assert.deepEqual(found.map((l) => [l.where, l.telltale]), [["the title", "atonement"], ["question 1", "merciful"]]);
  // The phrase as written is still found, and named whole.
  const whole = findLeaks([blank("violates the marriage covenant", { telltale: "commit adultery", also: "adultery" })], [
    { kind: "title", where: "the title", text: "You shall not commit adultery" },
    { kind: "question", where: "question 1", text: "What counts as adultery?" },
  ]);
  assert.deepEqual(whole.map((l) => l.telltale), ["commit adultery", "adultery"]);
});

test("a place named by a quotation closes its period inside the quote (SH6-8)", () => {
  const l = { words: "sin", ref: "Romans 3:23", where: "the text part “Note the word…”" };
  assert.equal(leakSentence(l), "“sin,” blanked in Romans 3:23, also prints in the text part “Note the word….”");
});

test("many blanks against many surfaces stay quick (DK6-3)", () => {
  const blanks = Array.from({ length: 200 }, (_, i) => blank(`word${i}x`));
  const text = "lorem ipsum dolor ".repeat(600);
  const surfaces = Array.from({ length: 100 }, (_, i) => ({ kind: "text", where: `t${i}`, text }));
  const t = Date.now();
  assert.deepEqual(findLeaks(blanks, surfaces), []);
  assert.ok(Date.now() - t < 1500);
});

test("GF8c-4: a blank on a possessive is given away by its word alone, and not the other way round only", () => {
  assert.equal(containsPhrase("Who is God?", "God’s"), true);
  assert.equal(containsPhrase("Jesus Christ", "Christ’s"), true);
  assert.equal(containsPhrase("What does God want?", "God's love"), false, "the rest of the phrase must still be there");
  assert.equal(containsPhrase("What does God love?", "God’s love"), true);
  assert.equal(containsPhrase("God’s love", "God"), true);
  assert.equal(containsPhrase("Who is Godson?", "God’s"), false, "whole words only");
  const leaks = findLeaks(
    [{ passageId: "p1", ref: "Romans 3:23", exact: "God’s" }],
    [{ kind: "question", where: "question 1", text: "What does God want?" }],
  );
  assert.deepEqual(leaks.map((l) => l.where), ["question 1"]);
});
