// scripts/lib/anchor-text.mjs
//
// The reference implementation of the Study Desk's anchor text: how the
// website, the iOS app and the Android app read a chapter as plain text when
// they place a reader's note or highlight, and how they find it again after
// the wording moves. STUDY-DESK-FORMAT.md is the spec; this file is its
// executable form, and `npm run build:anchor-vectors` turns it into the test
// vectors the two apps run in their own test suites
// (test/fixtures/anchor-vectors.json).
//
// The pure half (normalization, making an anchor, finding it again) lives in
// src/lib/anchor-core.mjs, because the website's own pages need it too:
// src/lib/desk-anchor-dom.mjs builds the same chapter text from the rendered
// page, and test/desk-anchor-dom.test.js checks the two agree on every
// published chapter. This file re-exports all of it, so it stays the one place
// the apps are pointed at.
//
// What stays here is reading a chapter from its JSON paragraphs. It is built
// on splitChapterVerses (scripts/lib/verse-text.mjs) on purpose: that is
// already the one splitter search and the alignment dataset share, so a note,
// a search hit and an alignment record can never disagree on where a verse
// starts and ends. normalizeAnchorText adds only rules the corpus doesn't
// exercise today (Unicode composition, zero-width characters, a literal
// no-break space), so it changes no verse text the splitter produces.

import { splitChapterVerses } from "./verse-text.mjs";
import { assembleChapter, normalizeAnchorText } from "../../src/lib/anchor-core.mjs";

export {
  ANCHOR_SPEC_VERSION,
  CONTEXT_LENGTH,
  assembleChapter,
  makeAnchor,
  normalizeAnchorText,
  resolveAnchor,
} from "../../src/lib/anchor-core.mjs";

/**
 * A chapter as anchor text: each verse's text, and the whole chapter as one
 * string (verses in order, joined by a single space) with each verse's span
 * in it.
 *
 * @param {string[]} paragraphs a chapter JSON's `paragraphs`
 */
export function chapterAnchorText(paragraphs) {
  const verses = new Map();
  for (const [n, text] of splitChapterVerses(paragraphs)) {
    verses.set(n, normalizeAnchorText(text));
  }
  return assembleChapter(verses);
}
