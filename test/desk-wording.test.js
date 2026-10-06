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
    { op: "del", text: "Blessed" },
    { op: "ins", text: "Gratified" },
    { op: "same", text: "are those whose lawlessness is let go" },
  ]);
});

test("wordingDiff treats typography-only differences as the same, shown as they read now", () => {
  assert.deepEqual(wordingDiff(`"Don't," he said`, "“Don’t,” he said"), [{ op: "same", text: "“Don’t,” he said" }]);
});

test("wordingDiff handles a dash as its own word and keeps the new spacing", () => {
  assert.deepEqual(wordingDiff("the light - the true light", "the light — the faithful light"), [
    { op: "same", text: "the light — the" },
    { op: "del", text: "true" },
    { op: "ins", text: "faithful" },
    { op: "same", text: "light" },
  ]);
});

test("wordingDiff on an insertion and a deletion", () => {
  assert.deepEqual(wordingDiff("love is kind", "love is very kind"), [
    { op: "same", text: "love is" },
    { op: "ins", text: "very" },
    { op: "same", text: "kind" },
  ]);
  assert.deepEqual(wordingDiff("love is very kind", "love is kind"), [
    { op: "same", text: "love is" },
    { op: "del", text: "very" },
    { op: "same", text: "kind" },
  ]);
});

test("a very long passage that changed shows as replaced whole", () => {
  const long = Array.from({ length: 700 }, (_, i) => `w${i}`).join(" ");
  const changed = long.replace("w350", "x350");
  const d = wordingDiff(long, changed);
  assert.deepEqual(d.map((r) => r.op), ["del", "ins"]);
  assert.deepEqual(wordingDiff(long, long), [{ op: "same", text: long }]);
});
