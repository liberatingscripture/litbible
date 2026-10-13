// test/greek-parse.test.js
//
// Unit tests for src/lib/greek-parse.mjs, MorphGNT's codes in words. The
// alignment tool's own tests (test/alignment-words-core.test.js) cover the same
// function through core.mjs's re-export.

import { test } from "node:test";
import assert from "node:assert/strict";
import { describeParse } from "../src/lib/greek-parse.mjs";

test("a verb: part of speech, tense, voice, mood, person and number", () => {
  assert.equal(describeParse("V-", "3AAI-S--"), "verb, aorist active indicative, 3rd person singular");
  assert.equal(describeParse("V-", "3PMI-P--"), "verb, present middle indicative, 3rd person plural");
});

test("a participle: the mood code reads as participle, with case and gender", () => {
  assert.equal(describeParse("V-", "-AAPNSM-"), "verb, aorist active participle, nominative masculine singular");
  assert.equal(describeParse("V-", "-PPPGPF-"), "verb, present passive participle, genitive feminine plural");
});

test("a noun: case, gender and number, with no verbal part", () => {
  assert.equal(describeParse("N-", "----VSM-"), "noun, vocative masculine singular");
  assert.equal(describeParse("N-", "----DPN-"), "noun, dative neuter plural");
});

test("an adjective or article: a degree is added after the case", () => {
  assert.equal(describeParse("A-", "----NSMC"), "adjective, nominative masculine singular, comparative");
  assert.equal(describeParse("RA", "----ASM-"), "article, accusative masculine singular");
});

test("an indeclinable or an empty parse gives the part of speech alone", () => {
  assert.equal(describeParse("C-", "--------"), "conjunction");
  assert.equal(describeParse("D-", ""), "adverb");
  assert.equal(describeParse("D-", undefined), "adverb");
  assert.equal(describeParse("PREP", ""), "PREP", "an unknown part of speech is shown as its code");
});
