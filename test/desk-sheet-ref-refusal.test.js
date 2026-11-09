import test from "node:test";
import assert from "node:assert/strict";
import { describeRefusal } from "../src/lib/desk-sheet-ref-refusal.mjs";
import { parseReference } from "../src/scripts/search-core.js";
import { bookKeyToLabel } from "../src/data/books.js";

const why = (text) => describeRefusal(text.replace(/[–—]/g, "-"), { parse: parseReference, label: bookKeyToLabel });

test("a Hebrew Bible book is named as outside the New Testament", () => {
  assert.match(why("Isaiah 61:1-2"), /New Testament, so Isaiah isn’t in it/);
  assert.match(why("psalm 23"), /so Psalms isn’t in it/);
  assert.match(why("1 Samuel 3"), /1 Samuel isn’t in it/);
});

test("an apocryphal book is too", () => {
  assert.match(why("Sirach 3:1"), /Sirach isn’t in it/);
});

test("a range across chapters says to add one chapter at a time", () => {
  assert.match(why("Matthew 5-7"), /one chapter at a time. Add Matthew 5 and then/);
  assert.match(why("John 3:16–4:2"), /one chapter at a time. Add John 3 and/);
});

test("a one-chapter book is told to give verses, never the next chapter (GF8c-2)", () => {
  for (const t of ["Jude 3-5", "Philemon 4-7", "2 John 1-3", "3 John 2-4", "Jude 1:3-2:1"]) {
    const m = why(t);
    assert.match(m, /has one chapter, so give its verses as .+ 1:3–5\./, t);
    assert.doesNotMatch(m, /next chapter/, t);
  }
  assert.match(why("Jude 3-5"), /^Jude has one chapter/);
});

test("anything else keeps the form's own sentence", () => {
  assert.equal(why("blorp"), null);
  assert.equal(why("Romans"), null);
  assert.equal(why("Hezekiah 3"), null);
});
