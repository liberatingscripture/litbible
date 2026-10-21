import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FIRST_PASSAGE,
  checkPassage,
  formatPassage,
  parsePassage,
  passageLabel,
  sameChapter,
  startingPassage,
  stepChapter,
} from "../src/lib/desk-passage.mjs";

const p = (bookKey, chapter, verse = null) => ({ bookKey, chapter, verse });

// ---- checkPassage ---------------------------------------------------------

test("checkPassage keeps a valid passage, with a missing verse as null", () => {
  assert.deepEqual(checkPassage({ bookKey: "john", chapter: 3, verse: 16 }), p("john", 3, 16));
  assert.deepEqual(checkPassage({ bookKey: "john", chapter: 3 }), p("john", 3, null));
  assert.deepEqual(checkPassage({ bookKey: "john", chapter: 3, verse: null }), p("john", 3, null));
  assert.deepEqual(checkPassage({ bookKey: "john", chapter: 21 }), p("john", 21, null));
});

test("checkPassage returns a new, clean object", () => {
  const input = { bookKey: "john", chapter: 3, verse: 16, extra: true };
  const out = checkPassage(input);
  assert.notEqual(out, input);
  assert.deepEqual(Object.keys(out).sort(), ["bookKey", "chapter", "verse"]);
});

test("checkPassage rejects an unknown book", () => {
  assert.equal(checkPassage(p("genesis", 1)), null);
  assert.equal(checkPassage(p("John", 3)), null);
  assert.equal(checkPassage(p("", 1)), null);
  assert.equal(checkPassage(p(undefined, 1)), null);
  assert.equal(checkPassage(p(5, 1)), null);
  assert.equal(checkPassage(p("toString", 1)), null, "not an inherited property");
  assert.equal(checkPassage(p("__proto__", 1)), null);
});

test("checkPassage rejects a chapter the book has not got", () => {
  assert.equal(checkPassage(p("john", 0)), null);
  assert.equal(checkPassage(p("john", -1)), null);
  assert.equal(checkPassage(p("john", 22)), null);
  assert.ok(checkPassage(p("john", 21)));
  assert.equal(checkPassage(p("john", 3.5)), null);
  assert.equal(checkPassage(p("john", "3")), null);
  assert.equal(checkPassage(p("john", NaN)), null);
  assert.equal(checkPassage(p("john", undefined)), null);
  assert.equal(checkPassage(p("philemon", 2)), null);
});

test("checkPassage rejects a verse that is not a whole number from 1", () => {
  assert.equal(checkPassage(p("john", 3, 0)), null);
  assert.equal(checkPassage(p("john", 3, 1.5)), null);
  assert.equal(checkPassage(p("john", 3, -2)), null);
  assert.equal(checkPassage(p("john", 3, "16")), null);
  assert.equal(checkPassage(p("john", 3, NaN)), null);
  assert.deepEqual(checkPassage(p("john", 3, 1)), p("john", 3, 1));
});

test("checkPassage rejects what is not an object", () => {
  for (const bad of [null, undefined, "john 3", 5, true, 0, ""]) {
    assert.equal(checkPassage(bad), null, String(bad));
  }
  assert.equal(checkPassage({}), null);
  assert.equal(checkPassage([]), null);
});

// ---- parsePassage ---------------------------------------------------------

test("parsePassage reads a chapter and verse, or a chapter alone", () => {
  assert.deepEqual(parsePassage("john 3:16"), p("john", 3, 16));
  assert.deepEqual(parsePassage("john 3"), p("john", 3, null));
  assert.deepEqual(parsePassage("1corinthians 13:4"), p("1corinthians", 13, 4));
});

test("parsePassage trims whitespace around the string", () => {
  assert.deepEqual(parsePassage("  john 3:16\n"), p("john", 3, 16));
  assert.deepEqual(parsePassage("\tjohn 3 "), p("john", 3, null));
});

test("parsePassage rejects what is not a lowercase book key, a space, and numbers", () => {
  for (const bad of ["John 3:16", "john", "john 3:", "jn 3:16", "john3", "john  3", "john 3:16:2", "john 3-16", "john :16", "", "  "]) {
    assert.equal(parsePassage(bad), null, JSON.stringify(bad));
  }
});

test("parsePassage rejects non-strings", () => {
  for (const bad of [null, undefined, 5, {}, [], true, p("john", 3)]) {
    assert.equal(parsePassage(bad), null, String(bad));
  }
});

test("parsePassage rejects a chapter or verse out of range", () => {
  assert.equal(parsePassage("john 22"), null);
  assert.equal(parsePassage("john 0"), null);
  assert.equal(parsePassage("john 3:0"), null);
  assert.equal(parsePassage("john 1000"), null);
  assert.equal(parsePassage("philemon 2"), null);
  assert.deepEqual(parsePassage("philemon 1:25"), p("philemon", 1, 25));
});

// ---- formatPassage --------------------------------------------------------

test("formatPassage writes a verse, or just the chapter without one", () => {
  assert.equal(formatPassage(p("john", 3, 16)), "john 3:16");
  assert.equal(formatPassage(p("john", 3)), "john 3");
  assert.equal(formatPassage({ bookKey: "john", chapter: 3 }), "john 3");
  assert.equal(formatPassage(p("1corinthians", 13, 4)), "1corinthians 13:4");
});

test("formatPassage is null for an invalid passage", () => {
  assert.equal(formatPassage(p("john", 22)), null);
  assert.equal(formatPassage(p("nope", 1)), null);
  assert.equal(formatPassage(p("john", 3, 0)), null);
  assert.equal(formatPassage(null), null);
  assert.equal(formatPassage("john 3"), null);
});

test("formatPassage and parsePassage round-trip", () => {
  for (const passage of [p("john", 3, 16), p("john", 3), p("1corinthians", 13, 4), p("revelation", 22, 21), p("philemon", 1), p("matthew", 1, 1)]) {
    assert.deepEqual(parsePassage(formatPassage(passage)), passage, JSON.stringify(passage));
  }
  for (const text of ["john 3:16", "john 3", "2timothy 3:16", "jude 1:3"]) {
    assert.equal(formatPassage(parsePassage(text)), text);
  }
});

// ---- passageLabel ---------------------------------------------------------

test("passageLabel names a passage for a reader", () => {
  assert.equal(passageLabel(p("john", 3, 16)), "John 3:16");
  assert.equal(passageLabel(p("john", 3)), "John 3");
  assert.equal(passageLabel(p("1corinthians", 13)), "1 Corinthians 13");
  assert.equal(passageLabel(p("1corinthians", 13, 4)), "1 Corinthians 13:4");
});

test("passageLabel is empty for an invalid passage", () => {
  assert.equal(passageLabel(p("john", 22)), "");
  assert.equal(passageLabel(p("nope", 1)), "");
  assert.equal(passageLabel(null), "");
  assert.equal(passageLabel(undefined), "");
  assert.equal(passageLabel("john 3"), "");
});

// ---- sameChapter ----------------------------------------------------------

test("sameChapter compares book and chapter, ignoring the verse", () => {
  assert.equal(sameChapter(p("john", 3, 16), p("john", 3, 1)), true);
  assert.equal(sameChapter(p("john", 3), p("john", 3, 16)), true);
  assert.equal(sameChapter(p("john", 3), p("john", 4)), false);
  assert.equal(sameChapter(p("john", 3), p("mark", 3)), false);
  assert.equal(sameChapter(null, p("john", 3)), false);
  assert.equal(sameChapter(p("john", 3), undefined), false);
  assert.equal(sameChapter(null, null), false);
  assert.equal(typeof sameChapter(null, null), "boolean");
});

// ---- stepChapter ----------------------------------------------------------

test("stepChapter moves a chapter within a book, dropping the verse", () => {
  assert.deepEqual(stepChapter(p("john", 3, 16), 1), p("john", 4));
  assert.deepEqual(stepChapter(p("john", 3, 16), -1), p("john", 2));
  assert.equal(stepChapter(p("john", 3, 16), 1).verse, null);
});

test("stepChapter crosses from one book to the next", () => {
  assert.deepEqual(stepChapter(p("matthew", 28), 1), p("mark", 1));
  assert.deepEqual(stepChapter(p("mark", 1), -1), p("matthew", 28));
  assert.deepEqual(stepChapter(p("mark", 16, 8), 1), p("luke", 1));
  assert.deepEqual(stepChapter(p("luke", 1, 3), -1), p("mark", 16));
});

test("stepChapter treats a single-chapter book as one chapter", () => {
  assert.deepEqual(stepChapter(p("philemon", 1), 1), p("hebrews", 1));
  assert.deepEqual(stepChapter(p("hebrews", 1), -1), p("philemon", 1));
});

test("stepChapter is null past either end of the New Testament", () => {
  assert.equal(stepChapter(p("matthew", 1), -1), null);
  assert.equal(stepChapter(p("revelation", 22), 1), null);
  assert.deepEqual(stepChapter(p("revelation", 22), -1), p("revelation", 21));
  assert.deepEqual(stepChapter(p("matthew", 1), 1), p("matthew", 2));
});

test("stepChapter is null for a bad direction or an invalid passage", () => {
  for (const dir of [0, 2, -2, "1", null, undefined, NaN]) {
    assert.equal(stepChapter(p("john", 3), dir), null, String(dir));
  }
  assert.equal(stepChapter(p("john", 22), 1), null);
  assert.equal(stepChapter(p("nope", 1), 1), null);
  assert.equal(stepChapter(null, 1), null);
});

test("stepChapter does not change the passage it is given", () => {
  const start = p("matthew", 28, 20);
  stepChapter(start, 1);
  assert.deepEqual(start, p("matthew", 28, 20));
});

// ---- startingPassage ------------------------------------------------------

test("startingPassage takes the Continue reading record's place", () => {
  assert.deepEqual(
    startingPassage({ v: 1, book: "romans", chapter: 8, verse: 3, view: "study" }),
    { bookKey: "romans", chapter: 8, verse: 3 },
  );
});

test("startingPassage keeps a missing verse as null", () => {
  assert.deepEqual(startingPassage({ v: 1, book: "romans", chapter: 8, verse: null, view: "read" }), p("romans", 8));
  assert.deepEqual(startingPassage({ book: "romans", chapter: 8 }), p("romans", 8));
});

test("startingPassage reads numbers kept as strings", () => {
  assert.deepEqual(startingPassage({ book: "romans", chapter: "8", verse: "3" }), p("romans", 8, 3));
});

test("startingPassage falls back to the first passage for nothing usable", () => {
  const bads = [
    null, undefined, "garbage", 5, {}, [],
    { book: "nope", chapter: 1 },
    { book: "john", chapter: 99 },
    { book: "john", chapter: "x" },
    { book: "john", chapter: 3, verse: 0 },
    { book: "john", chapter: 3, verse: "abc" },
  ];
  for (const bad of bads) {
    assert.deepEqual(startingPassage(bad), { bookKey: "matthew", chapter: 1, verse: 1 }, JSON.stringify(bad));
  }
});

test("the fallback is a copy: changing it leaves FIRST_PASSAGE alone", () => {
  const a = startingPassage(null);
  assert.notEqual(a, FIRST_PASSAGE);
  a.chapter = 9;
  a.bookKey = "john";
  assert.deepEqual(FIRST_PASSAGE, { bookKey: "matthew", chapter: 1, verse: 1 });
  assert.deepEqual(startingPassage(null), { bookKey: "matthew", chapter: 1, verse: 1 });
  assert.ok(Object.isFrozen(FIRST_PASSAGE));
});
