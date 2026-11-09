// src/data/verse-gaps.js
//
// The verse numbers the LIT leaves out inside a chapter it has text for: a
// traditional verse the source text does not carry (src/data/chapters/CLAUDE.md,
// "Verse-number gaps"). Each number here is inside its chapter's count
// (verse-counts.js) but names no verse on the page, so a bookmark on it would
// mark nothing. Plain data with no imports, so browser code can read it without
// the chapter files. Only published chapters are listed: a draft's gaps are not
// known here. test/desk-audit8-e-verse.test.js checks this list against the
// chapter files, so a chapter whose anchors change fails until it is updated.

export const VERSE_GAPS = {
  matthew: { 17: [21], 18: [11], 23: [14] },
  mark: { 7: [16], 9: [44, 46], 11: [26], 15: [28] },
  luke: { 17: [36], 23: [17] },
  john: { 5: [4] },
};

/** Whether the LIT has no verse with this number in this chapter: a gap, not a verse on the page. */
export function isVerseGap(bookKey, chapter, verse) {
  if (!Object.hasOwn(VERSE_GAPS, bookKey)) return false;
  const gaps = VERSE_GAPS[bookKey];
  return Object.hasOwn(gaps, chapter) && gaps[chapter].includes(verse);
}
