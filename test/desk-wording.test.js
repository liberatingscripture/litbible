// test/desk-wording.test.js
//
// src/lib/desk-wording.mjs decides whether a note's verse changed since the
// note was made (STUDY-DESK.md, N3 and C3). The cases that matter most are the
// ones it must NOT flag: the corpus's mechanical passes (curling straight
// quotes, en dashes in ranges) changed no wording.

import { test } from "node:test";
import assert from "node:assert/strict";

import { wordingChanged, wordingDiff, wordingKey } from "../src/lib/desk-wording.mjs";

test("the August passes change no wording: curled quotes and en-dash ranges", () => {
  assert.equal(
    wordingChanged(`He said, "Don't be afraid." (see verses 9-11)`, "He said, “Don’t be afraid.” (see verses 9–11)"),
    false,
  );
});

test("dash spacing and whitespace don't count", () => {
  assert.equal(wordingChanged("the light — the true light", "the light—the true  light"), false);
  assert.equal(wordingChanged("Abba, Father", " Abba,\nFather "), false);
});

test("a changed word counts, and so does a change of case", () => {
  assert.equal(wordingChanged("Blessed are those whose lawlessness", "Gratified are those whose lawlessness"), true);
  assert.equal(wordingChanged("the Triumphant Message", "the triumphant message"), true);
});

test("wordingKey keeps letters and other punctuation as written", () => {
  assert.equal(wordingKey("“Iēsous,” he said — ‘wait’"), `"Iēsous," he said-'wait'`);
});

test("wordingDiff shows the old words before the new, with the rest unchanged", () => {
  assert.deepEqual(wordingDiff("Blessed are those whose lawlessness is let go", "Gratified are those whose lawlessness is let go"), [
    { op: "del", text: "Blessed", lead: "" },
    { op: "ins", text: "Gratified", lead: "" },
    { op: "same", text: "are those whose lawlessness is let go", lead: " " },
  ]);
});

test("wordingDiff treats typography-only differences as the same, shown as they read now", () => {
  assert.deepEqual(wordingDiff(`"Don't," he said`, "“Don’t,” he said"), [{ op: "same", text: "“Don’t,” he said", lead: "" }]);
});

test("wordingDiff handles a dash as its own word and keeps the new spacing", () => {
  assert.deepEqual(wordingDiff("the light - the true light", "the light — the faithful light"), [
    { op: "same", text: "the light — the", lead: "" },
    { op: "del", text: "true", lead: " " },
    { op: "ins", text: "faithful", lead: " " },
    { op: "same", text: "light", lead: " " },
  ]);
});

test("wordingDiff on an insertion and a deletion", () => {
  assert.deepEqual(wordingDiff("love is kind", "love is very kind"), [
    { op: "same", text: "love is", lead: "" },
    { op: "ins", text: "very", lead: " " },
    { op: "same", text: "kind", lead: " " },
  ]);
  assert.deepEqual(wordingDiff("love is very kind", "love is kind"), [
    { op: "same", text: "love is", lead: "" },
    { op: "del", text: "very", lead: " " },
    { op: "same", text: "kind", lead: " " },
  ]);
});

test("a very long passage that changed shows as replaced whole", () => {
  const long = Array.from({ length: 700 }, (_, i) => `w${i}`).join(" ");
  const changed = long.replace("w350", "x350");
  const d = wordingDiff(long, changed);
  assert.deepEqual(d.map((r) => r.op), ["del", "ins"]);
  assert.deepEqual(wordingDiff(long, long), [{ op: "same", text: long, lead: "" }]);
  assert.deepEqual(d.map((r) => r.lead), ["", ""], "the fallback's runs open their texts, so they have no lead");
});

test("a run's lead is the whitespace before its first word, so a renderer can tell a space from none", () => {
  // The motivating case: nothing separates "well", "-" and "known", and a plain
  // `text` gives a renderer no way to know that.
  const d = wordingDiff("a well-known road", "a well-established road");
  assert.deepEqual(d, [
    { op: "same", text: "a well-", lead: "" },
    { op: "del", text: "known", lead: "" },
    { op: "ins", text: "established", lead: "" },
    { op: "same", text: "road", lead: " " },
  ]);
  assert.equal(d.map((r) => r.lead + r.text).join(""), "a well-" + "known" + "established" + " road");
});

test("a run's lead comes from the text the run came from: old for a deletion, new for the rest", () => {
  const d = wordingDiff("the  true\nlight", "the faithful light");
  assert.deepEqual(d, [
    { op: "same", text: "the", lead: "" },
    { op: "del", text: "true", lead: "  " },
    { op: "ins", text: "faithful", lead: " " },
    { op: "same", text: "light", lead: " " },
  ]);
  // A "same" run reads as the new text, so its lead does too.
  assert.deepEqual(wordingDiff("a\n\nb", "a b"), [{ op: "same", text: "a b", lead: "" }]);
  assert.deepEqual(wordingDiff("a\nb c", "a  c"), [
    { op: "same", text: "a", lead: "" },
    { op: "del", text: "b", lead: "\n" },
    { op: "same", text: "c", lead: "  " },
  ]);
});

test("the first word of a text has no lead, whatever opens the text", () => {
  assert.deepEqual(wordingDiff("   old words", "   new words"), [
    { op: "del", text: "old", lead: "" },
    { op: "ins", text: "new", lead: "" },
    { op: "same", text: "words", lead: " " },
  ]);
  assert.deepEqual(wordingDiff("", "added"), [{ op: "ins", text: "added", lead: "" }]);
  assert.deepEqual(wordingDiff("gone", ""), [{ op: "del", text: "gone", lead: "" }]);
});
