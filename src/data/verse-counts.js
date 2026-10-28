// src/data/verse-counts.js
//
// The number of verses in every New Testament chapter, for the browser.
// Some browser code has no chapter files to ask: the Study Desk checks whether
// a verse a reader types in a note exists (src/lib/desk-chains.mjs). So the
// counts are committed here, in a plain module with no imports.
//
// A chapter's count is its LAST verse number, not the number of verses
// present. Matthew 17 has no verse 21, but its count is 27, so 17:21 is
// inside the chapter. VERSE_COUNTS[book][n - 1] is the count for chapter n.
//
// Each count is the larger of the SBLGNT (public/greek/text/) and the LIT
// (src/data/chapters/) last verse. The two agree wherever the LIT is written;
// the unwritten chapters rest on the Greek alone. test/verse-counts.test.js
// checks this table against both sources, so a change to scripture that moves
// a last verse fails the test until the table is updated.

export const VERSE_COUNTS = {
  matthew: [25, 23, 17, 25, 48, 34, 29, 34, 38, 42, 30, 50, 58, 36, 39, 28, 27, 35, 30, 34, 46, 46, 39, 51, 46, 75, 66, 20],
  mark: [45, 28, 35, 41, 43, 56, 37, 38, 50, 52, 33, 44, 37, 72, 47, 20],
  luke: [80, 52, 38, 44, 39, 49, 50, 56, 62, 42, 54, 59, 35, 35, 32, 31, 37, 43, 48, 47, 38, 71, 56, 53],
  john: [51, 25, 36, 54, 47, 71, 53, 59, 41, 42, 57, 50, 38, 31, 27, 33, 26, 40, 42, 31, 25],
  acts: [26, 47, 26, 37, 42, 15, 60, 40, 43, 48, 30, 25, 52, 28, 41, 40, 34, 28, 40, 38, 40, 30, 35, 27, 27, 32, 44, 31],
  romans: [32, 29, 31, 25, 21, 23, 25, 39, 33, 21, 36, 21, 14, 23, 33, 27],
  "1corinthians": [31, 16, 23, 21, 13, 20, 40, 13, 27, 33, 34, 31, 13, 40, 58, 24],
  "2corinthians": [24, 17, 18, 18, 21, 18, 16, 24, 15, 18, 33, 21, 13],
  galatians: [24, 21, 29, 31, 26, 18],
  ephesians: [23, 22, 21, 32, 33, 24],
  philippians: [30, 30, 21, 23],
  colossians: [29, 23, 25, 18],
  "1thessalonians": [10, 20, 13, 18, 28],
  "2thessalonians": [12, 17, 18],
  "1timothy": [20, 15, 16, 16, 25, 21],
  "2timothy": [18, 26, 17, 22],
  titus: [16, 15, 15],
  philemon: [25],
  hebrews: [14, 18, 19, 16, 14, 20, 28, 13, 28, 39, 40, 29, 25],
  james: [27, 26, 18, 17, 20],
  "1peter": [25, 25, 22, 19, 14],
  "2peter": [21, 22, 18],
  "1john": [10, 29, 24, 21, 21],
  "2john": [13],
  "3john": [15],
  jude: [25],
  revelation: [20, 29, 22, 11, 14, 17, 17, 13, 21, 11, 19, 18, 18, 20, 8, 21, 18, 24, 21, 15, 27, 21],
};

// Verses in a chapter, or 0 for an unknown book, or a chapter that is not
// in it (chapter 0, a chapter past the book's end, a fraction).
export function verseCount(bookKey, chapter) {
  if (!Object.prototype.hasOwnProperty.call(VERSE_COUNTS, bookKey)) return 0;
  const n = Number(chapter);
  const chapters = VERSE_COUNTS[bookKey];
  if (!Number.isInteger(n) || n < 1 || n > chapters.length) return 0;
  return chapters[n - 1];
}
