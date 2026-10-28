// test/verse-counts.test.js
//
// src/data/verse-counts.js: the verse count of every New Testament chapter.
// What these guard: the table covers every book and chapter in BOOK_ORDER
// and BOOKS, with positive integers; each count equals the last verse in
// the SBLGNT file, or the last anchor in the LIT file where the LIT is
// larger (so the table cannot drift from the text); and verseCount answers 0
// for anything that is not a chapter.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

import { BOOKS, BOOK_ORDER } from "../src/data/books.js";
import { VERSE_COUNTS, verseCount } from "../src/data/verse-counts.js";

const readJson = (url) => JSON.parse(readFileSync(url, "utf8"));

// The last verse number in the SBLGNT chapter file (element 0 of each word).
function greekLastVerse(bookKey, chapter) {
  const data = readJson(new URL(`../public/greek/text/${bookKey}-${chapter}.json`, import.meta.url));
  let max = 0;
  for (const para of data.paragraphs) {
    for (const word of para) max = Math.max(max, word[0]);
  }
  return max;
}

// The last verse anchor (id="vN") in the LIT chapter file, or null when the
// chapter is an unwritten stub with no anchors (or has no file).
function litLastVerse(bookKey, chapter) {
  const url = new URL(`../src/data/chapters/${bookKey}-${chapter}.json`, import.meta.url);
  if (!existsSync(url)) return null;
  const data = readJson(url);
  let max = null;
  for (const para of data.paragraphs) {
    for (const m of String(para).matchAll(/id="v(\d+)"/g)) {
      const n = Number(m[1]);
      if (max === null || n > max) max = n;
    }
  }
  return max;
}

test("every book in BOOK_ORDER has exactly BOOKS[key] positive integer counts, and no others", () => {
  assert.deepEqual(Object.keys(VERSE_COUNTS), BOOK_ORDER);
  for (const key of BOOK_ORDER) {
    const counts = VERSE_COUNTS[key];
    assert.equal(counts.length, BOOKS[key], `${key} has ${counts.length} chapters, BOOKS says ${BOOKS[key]}`);
    for (const [i, n] of counts.entries()) {
      assert.ok(Number.isInteger(n) && n > 0, `${key} ${i + 1} is ${n}, not a positive integer`);
    }
  }
});

test("each chapter's count is the larger of its SBLGNT and LIT last verse", () => {
  for (const key of BOOK_ORDER) {
    for (let ch = 1; ch <= BOOKS[key]; ch++) {
      const greek = greekLastVerse(key, ch);
      const lit = litLastVerse(key, ch) ?? 0;
      const want = Math.max(greek, lit);
      assert.equal(verseCount(key, ch), want, `${key} ${ch}: greek ${greek}, lit ${lit}`);
      assert.equal(VERSE_COUNTS[key][ch - 1], want, `${key} ${ch} in the table`);
    }
  }
});

test("verseCount returns 0 for an unknown book, chapter 0, and a chapter past the end", () => {
  assert.equal(verseCount("tobit", 1), 0);
  assert.equal(verseCount("constructor", 1), 0, "an inherited property is not a book");
  assert.equal(verseCount("matthew", 0), 0);
  assert.equal(verseCount("matthew", 29), 0, "Matthew has 28 chapters");
  assert.equal(verseCount("philemon", 2), 0);
});

test("verseCount gives the last verse number, so a gap is inside the chapter", () => {
  assert.equal(verseCount("matthew", 17), 27, "17:21 is missing from the text but inside the count");
  assert.equal(verseCount("john", 3), 36);
  assert.equal(verseCount("jude", 1), 25);
});
