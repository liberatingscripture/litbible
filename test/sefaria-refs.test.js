// test/sefaria-refs.test.js
//
// Unit tests for src/lib/sefaria-refs.mjs: the Hebrew Bible books the
// linker sends to Sefaria, and the map from English verse numbers
// to the Hebrew numbering Sefaria uses. Every mapped chapter was checked
// verse by verse against Sefaria's JPS 1917 text on 2026-09-28; these pin one
// case of each kind of difference so a later edit can't quietly undo one.

import { test } from "node:test";
import assert from "node:assert/strict";

import { HB_BOOKS, chapterCount, isLinkable, toHebrew, sefariaHref } from "../src/lib/sefaria-refs.mjs";

const S = "https://www.sefaria.org/";
const QUERY = "?lang=en&ven=english%7CTHE_JPS_TANAKH:_Gender-Sensitive_Edition";
const href = (key, start, end) => sefariaHref(key, start, end)?.replace(S, "").replace(QUERY, "") ?? null;
const cv = (chapter, verse = null) => ({ chapter, verse });

test("all 39 books, with chapter counts English Bibles give", () => {
  assert.equal(HB_BOOKS.length, 39);
  assert.equal(chapterCount("genesis"), 50);
  assert.equal(chapterCount("psalms"), 150);
  assert.equal(chapterCount("malachi"), 4); // three in Hebrew
  assert.equal(chapterCount("joel"), 3); // four in Hebrew
  assert.equal(chapterCount("obadiah"), 1);
  assert.equal(chapterCount("matthew"), 0);
});

test("most verses are numbered alike", () => {
  assert.deepEqual(toHebrew("deuteronomy", 30, 15), cv(30, 15));
  assert.deepEqual(toHebrew("isaiah", 53, 5), cv(53, 5));
  assert.deepEqual(toHebrew("psalms", 23, 1), cv(23, 1)); // no numbered heading
});

test("a psalm's heading is its first verse in Hebrew", () => {
  assert.deepEqual(toHebrew("psalms", 22, 1), cv(22, 2));
  assert.deepEqual(toHebrew("psalms", 51, 4), cv(51, 6)); // a two-verse heading
  assert.deepEqual(toHebrew("psalms", 3, 8), cv(3, 9));
  // Psalm 13 is the same length in both, so only the text shows it: the
  // heading is verse 1 and English 5–6 are one Hebrew verse.
  assert.deepEqual(toHebrew("psalms", 13, 1), cv(13, 2));
  assert.deepEqual(toHebrew("psalms", 13, 5), cv(13, 6));
  assert.deepEqual(toHebrew("psalms", 13, 6), cv(13, 6));
});

test("a verse moved across a chapter boundary", () => {
  assert.deepEqual(toHebrew("joel", 2, 28), cv(3, 1));
  assert.deepEqual(toHebrew("joel", 3, 1), cv(4, 1));
  assert.deepEqual(toHebrew("malachi", 4, 5), cv(3, 23));
  assert.deepEqual(toHebrew("jeremiah", 9, 24), cv(9, 23));
  assert.deepEqual(toHebrew("isaiah", 9, 6), cv(9, 5));
  assert.deepEqual(toHebrew("jonah", 1, 17), cv(2, 1));
  assert.deepEqual(toHebrew("daniel", 4, 1), cv(3, 31));
});

test("merged, split and missing verses", () => {
  // The Decalogue's short commandments are one Hebrew verse.
  assert.deepEqual(toHebrew("exodus", 20, 14), cv(20, 13));
  assert.deepEqual(toHebrew("exodus", 20, 17), cv(20, 14));
  // One English verse, two Hebrew ones.
  assert.deepEqual(toHebrew("1samuel", 20, 42), { chapter: 20, verse: 42, end: cv(21, 1) });
  // Nehemiah 7:68 isn't in the Hebrew text.
  assert.deepEqual(toHebrew("nehemiah", 7, 68), cv(7, null));
});

test("addresses", () => {
  assert.equal(href("genesis", cv(1, 1)), "Genesis.1.1");
  assert.equal(href("1samuel", cv(3, 10)), "I_Samuel.3.10");
  assert.equal(href("songofsongs", cv(2, 1)), "Song_of_Songs.2.1");
  assert.equal(href("isaiah", cv(52, 13), cv(53, 12)), "Isaiah.52.13-53.12");
  assert.equal(href("psalms", cv(22, 1), cv(22, 5)), "Psalms.22.2-6");
  assert.equal(href("1samuel", cv(20, 42)), "I_Samuel.20.42-21.1");
  assert.equal(href("nehemiah", cv(7, 68)), "Nehemiah.7");
});

test("a whole chapter links as one unless the numbering moves it", () => {
  assert.equal(href("job", cv(38)), "Job.38");
  assert.equal(href("psalms", cv(22)), "Psalms.22");
  assert.equal(href("genesis", cv(1), cv(3)), "Genesis.1-3");
  assert.equal(href("joel", cv(3)), "Joel.4.1-21");
  assert.equal(href("malachi", cv(4)), "Malachi.3.19-24");
  assert.equal(href("daniel", cv(4)), "Daniel.3.31-4.34");
});

test("what English Bibles don't have is not linked", () => {
  assert.equal(isLinkable("psalms", 151), false);
  assert.equal(isLinkable("genesis", 1, 32), false);
  assert.equal(href("malachi", cv(3, 19)), null);
  assert.equal(href("genesis", cv(1, 1), cv(1, 40)), null);
});
