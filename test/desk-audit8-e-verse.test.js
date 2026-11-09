// test/desk-audit8-e-verse.test.js
//
// Study Desk Audit 8, batch E: verse spans are bounded by their chapter
// (GF8c-1), the Markdown reader refuses a verse past its chapter and reads a
// hostile line in linear time (SEC8-1), and a bookmark cannot sit on a verse
// the LIT leaves out (GF8c-5). Each test names the finding it guards.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

import { noteCounts, highlightColors, bookmarkedVerses, recordsOnVerse, verseLabel } from "../src/lib/desk-verse.mjs";
import { blockForVerse } from "../src/lib/desk-print-notes.mjs";
import { completeBooks } from "../src/lib/desk-sheet-lit.mjs";
import { parseImport, parseReference } from "../src/lib/desk-export.mjs";
import { bookmarkPlace, NOT_A_VERSE } from "../src/lib/desk-bookmark-change.mjs";
import { VERSE_GAPS, isVerseGap } from "../src/data/verse-gaps.js";
import { BOOKS, BOOK_ORDER } from "../src/data/books.js";
import { VERSE_COUNTS } from "../src/data/verse-counts.js";

const HUGE = 30000000;
const ctx = { client: "web/2026.11", contentVersion: "v20261109.0000000" };

// GF8c-1: a range runs no further than its chapter, so a huge end verse costs no more than the chapter's own verses.
test("GF8c-1: a note on a huge range counts only the verses its chapter has, and quickly", () => {
  const start = performance.now();
  const counts = noteCounts([{ id: "a", kind: "note", bookKey: "romans", chapter: 8, verse: 3, endVerse: HUGE }]);
  assert.ok(performance.now() - start < 1000, "no per-verse loop past the chapter");
  assert.equal(counts.size, 39 - 3 + 1, "verses 3 to 39 of Romans 8");
  assert.equal(counts.get(39), 1);
  assert.equal(counts.has(40), false);
});

test("GF8c-1: highlights and bookmarks are bounded by the chapter too", () => {
  const colors = highlightColors([{ id: "h", kind: "highlight", color: "yellow", bookKey: "john", chapter: 3, verse: 16, endVerse: HUGE }]);
  assert.equal(colors.size, 36 - 16 + 1);
  const marked = bookmarkedVerses([{ id: "b", kind: "bookmark", bookKey: "jude", chapter: 1, verse: 1, endVerse: HUGE }]);
  assert.equal(marked.size, 25);
});

test("GF8c-1: a record on a chapter the New Testament lacks covers its first verse only", () => {
  const counts = noteCounts([{ id: "a", kind: "note", bookKey: "romans", chapter: 99, verse: 1, endVerse: HUGE }]);
  assert.deepEqual([...counts.keys()], [1]);
});

test("GF8c-1: a normal range inside its chapter is untouched", () => {
  const counts = noteCounts([{ id: "a", kind: "note", bookKey: "romans", chapter: 8, verse: 3, endVerse: 5 }]);
  assert.deepEqual([...counts.keys()].sort((x, y) => x - y), [3, 4, 5]);
  assert.deepEqual(recordsOnVerse([{ id: "a", kind: "note", bookKey: "romans", chapter: 8, verse: 3, endVerse: 5 }], 5).length, 1);
});

test("GF8c-1: a verse label over a huge range still names its colours", () => {
  const colors = highlightColors([
    { id: "a", kind: "highlight", color: "pink", bookKey: "romans", chapter: 8, verse: 1, endVerse: HUGE },
    { id: "b", kind: "highlight", color: "yellow", bookKey: "romans", chapter: 8, verse: 1 },
  ]);
  assert.deepEqual(colors.get(1), ["yellow", "pink"]);
  assert.equal(verseLabel(1, 0, colors.get(1)), "Verse 1, highlighted yellow and pink");
});

test("GF8c-1: blockForVerse stops at the page's last verse and still finds a verse inside the range", () => {
  const blocks = [[1, 2], [3, 4], [5]];
  const start = performance.now();
  assert.equal(blockForVerse(blocks, 5, HUGE), 2);
  assert.equal(blockForVerse(blocks, 4, HUGE), 1);
  assert.equal(blockForVerse(blocks, 9, HUGE), null, "no verse of the page is in range");
  assert.ok(performance.now() - start < 1000);
});

test("GF8c-1: completeBooks does not loop past a chapter's end, and still counts a book quoted whole", () => {
  const jude = Array.from({ length: 25 }, (_, i) => i + 1);
  const versesOf = (book, c) => (book === "jude" && c === 1 ? jude : null);
  const start = performance.now();
  const out = completeBooks([{ bookKey: "jude", chapter: 1, verse: 1, endVerse: HUGE }], versesOf);
  assert.ok(performance.now() - start < 1000);
  assert.deepEqual(out, ["jude"]);
  const short = completeBooks([{ bookKey: "jude", chapter: 1, verse: 1, endVerse: 10 }], versesOf);
  assert.deepEqual(short, []);
});

test("GF8c-1: the Markdown reader refuses a verse past its chapter's last, and says how many it has", () => {
  const md = "<!-- lit-notebook -->\n\n## Romans 8:3–40\n\nA note.\n\n<!-- lit-notebook end -->\n";
  const out = parseImport(md);
  assert.equal(out.records.length, 0);
  assert.ok(out.problems.some((p) => /Romans 8 has 39 verses/.test(p.message)), JSON.stringify(out.problems));
});

test("GF8c-1: the Markdown reader still takes a verse inside its chapter", () => {
  const md = "<!-- lit-notebook -->\n\n## Romans 8:3–39\n\nA note.\n\n<!-- lit-notebook end -->\n";
  const out = parseImport(md, { ctx });
  assert.equal(out.records.length, 1, JSON.stringify(out.problems));
  assert.equal(out.records[0].endVerse, 39);
});

test("GF8c-1: the Markdown reader refuses a huge end verse without a loop", () => {
  const md = `<!-- lit-notebook -->\n\n## John 3:16–${HUGE}\n\nA note.\n\n<!-- lit-notebook end -->\n`;
  const start = performance.now();
  const out = parseImport(md);
  assert.ok(performance.now() - start < 1000);
  assert.equal(out.records.length, 0);
  assert.ok(out.problems.some((p) => /John 3 has 36 verses/.test(p.message)));
});

// SEC8-1: the reader's two quadratic patterns, now linear.
test("SEC8-1: a 100 KB heading line of spaces parses in well under a second", () => {
  const md = `<!-- lit-notebook -->\n\n## ${" ".repeat(100000)}\n\nA note.\n\n<!-- lit-notebook end -->\n`;
  const start = performance.now();
  parseImport(md);
  assert.ok(performance.now() - start < 1000, "the heading pattern is linear");
});

test("SEC8-1: a 100 KB line of repeated lit-notebook openers parses in well under a second", () => {
  const md = `<!-- lit-notebook ${"<!-- lit-notebook ".repeat(6000)}\n\n## Romans 8:1\n\nA note.\n\n<!-- lit-notebook end -->\n`;
  const start = performance.now();
  parseImport(md);
  assert.ok(performance.now() - start < 1000, "the header pattern is linear");
});

test("SEC8-1: a reference with a long run of spaces inside it is read in linear time", () => {
  const start = performance.now();
  assert.deepEqual(parseReference(`John${" ".repeat(100000)}3:16`), { bookKey: "john", chapter: 3, verse: 16, endVerse: 16 });
  assert.ok(performance.now() - start < 1000);
});

test("SEC8-1: parseReference reads the forms it always read", () => {
  assert.deepEqual(parseReference("Romans 8:3–4"), { bookKey: "romans", chapter: 8, verse: 3, endVerse: 4 });
  assert.deepEqual(parseReference("Romans 8:3-4"), { bookKey: "romans", chapter: 8, verse: 3, endVerse: 4 });
  assert.deepEqual(parseReference("John 3 : 16 — 18"), { bookKey: "john", chapter: 3, verse: 16, endVerse: 18 });
  assert.deepEqual(parseReference("1 John 2:1"), { bookKey: "1john", chapter: 2, verse: 1, endVerse: 1 });
  assert.deepEqual(parseReference("Romans 8"), { bookKey: "romans", chapter: 8, verse: null, endVerse: null });
  assert.equal(parseReference("Hesitations 2:1"), null);
});

// GF8c-5: the verses the LIT leaves out.
test("GF8c-5: a bookmark cannot be moved to a verse the LIT leaves out, and the others are fine", () => {
  assert.equal(bookmarkPlace({ bookKey: "matthew", chapter: 17, verse: 21 }).problem, "Matthew 17:21 isn’t in the LIT.");
  assert.equal(bookmarkPlace({ bookKey: "john", chapter: 5, verse: 4 }).problem, "John 5:4 isn’t in the LIT.");
  assert.equal(bookmarkPlace({ bookKey: "matthew", chapter: 17, verse: 20 }).place.verse, 20);
  assert.equal(bookmarkPlace({ bookKey: "matthew", chapter: 17, verse: 27 }).place.verse, 27, "the last verse is a verse");
  assert.equal(bookmarkPlace({ bookKey: "matthew", chapter: 17, verse: 28 }).problem, "Matthew 17 has 27 verses.");
  assert.equal(bookmarkPlace({ bookKey: "matthew", chapter: 17, verse: null }).place.verse, 1, "a chapter alone is verse 1");
  assert.equal(bookmarkPlace(null).problem, NOT_A_VERSE);
});

test("GF8c-5: isVerseGap answers for a gap and not for a verse", () => {
  assert.equal(isVerseGap("mark", 9, 44), true);
  assert.equal(isVerseGap("mark", 9, 45), false);
  assert.equal(isVerseGap("romans", 8, 3), false);
  assert.equal(isVerseGap("constructor", 1, 1), false, "an inherited name is not a book");
});

test("GF8c-5: the gap list is the one the published chapters carry (checked against the chapter files)", () => {
  const found = {};
  for (const key of BOOK_ORDER) {
    for (let ch = 1; ch <= BOOKS[key]; ch++) {
      const url = new URL(`../src/data/chapters/${key}-${ch}.json`, import.meta.url);
      if (!existsSync(url)) continue;
      const data = JSON.parse(readFileSync(url, "utf8"));
      if (data.indexed === false) continue;
      const have = new Set();
      for (const para of data.paragraphs) for (const m of String(para).matchAll(/id="v(\d+)"/g)) have.add(Number(m[1]));
      const gaps = [];
      for (let v = 1; v <= VERSE_COUNTS[key][ch - 1]; v++) if (!have.has(v)) gaps.push(v);
      if (gaps.length) found[`${key}:${ch}`] = gaps;
    }
  }
  const listed = {};
  for (const [book, chapters] of Object.entries(VERSE_GAPS)) {
    for (const [ch, gaps] of Object.entries(chapters)) listed[`${book}:${ch}`] = gaps;
  }
  assert.deepEqual(listed, found, "src/data/verse-gaps.js matches the chapter files");
});
