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

test("a footnote is held to the footnote rule, against its own passage's blanks", () => {
  const surfaces = [
    { kind: "footnote", where: "footnote a of Romans 3:23", text: "Other people characterized by deviation.", passageId: "p1" },
    { kind: "footnote", where: "footnote a of Mark 1:1", text: "Other people characterized by deviation.", passageId: "p2" },
  ];
  const leaks = findLeaks([blank("deviating")], surfaces);
  assert.deepEqual(leaks.map((l) => l.where), ["footnote a of Romans 3:23"]);
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
