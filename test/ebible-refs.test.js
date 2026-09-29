// test/ebible-refs.test.js
//
// Unit tests for src/lib/ebible-refs.mjs: the apocryphal books the linker
// sends to the World English Bible on eBible.org, their verse counts (read
// from eBible's own pages on 2026-09-28), and the addresses built from them.

import { test } from "node:test";
import assert from "node:assert/strict";

import { APOCRYPHA, chapterCount, isLinkable, ebibleHref } from "../src/lib/ebible-refs.mjs";

const PAGE = "https://ebible.org/eng-web/";
const href = (key, start, end) => ebibleHref(key, start, end)?.replace(PAGE, "") ?? null;
const cv = (chapter, verse = null) => ({ chapter, verse });

test("the books, with the chapter counts eBible has", () => {
  assert.equal(APOCRYPHA.length, 12);
  assert.equal(chapterCount("sirach"), 51);
  assert.equal(chapterCount("wisdom"), 19);
  assert.equal(chapterCount("2maccabees"), 15);
  assert.equal(chapterCount("manasseh"), 1);
  assert.equal(chapterCount("enoch"), 0); // not in the WEB
  assert.equal(chapterCount("genesis"), 0); // Sefaria's, not this module's
});

test("addresses: the chapter page, and the verse's anchor", () => {
  assert.equal(href("sirach", cv(6, 24)), "SIR06.htm#V24");
  assert.equal(href("wisdom", cv(3, 1)), "WIS03.htm#V1");
  assert.equal(href("1maccabees", cv(2, 50)), "1MA02.htm#V50");
  assert.equal(href("2maccabees", cv(7)), "2MA07.htm");
  // A range opens at its first verse, once its end is known to exist.
  assert.equal(href("sirach", cv(14, 20), cv(14, 27)), "SIR14.htm#V20");
  assert.equal(href("sirach", cv(14, 20), cv(14, 40)), null);
});

test("what eBible doesn't have is not linked", () => {
  assert.equal(isLinkable("wisdom", 20), false);
  assert.equal(isLinkable("wisdom", 3, 20), false);
  assert.equal(isLinkable("wisdom", 3, 0), false);
  // Verses the WEB leaves out, as modern English Bibles do.
  assert.equal(isLinkable("sirach", 11, 16), false);
  assert.equal(isLinkable("sirach", 26, 20), false);
  assert.equal(isLinkable("sirach", 26, 28), true);
});
