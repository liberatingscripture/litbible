// scripts/lib/verse-index-core.mjs
//
// The pure paragraph-HTML → per-verse plain-text core of build-verse-index.mjs.
// Given one chapter's `paragraphs` array it returns the verse-indexed text array
// that ships in public/search/verses.json — with NO fs, argv, or process access
// of its own. The wrapper (scripts/build-verse-index.mjs) walks the chapter
// files, skips drafts, orders the output, and derives the corpus vocabulary.
//
// This split mirrors scripts/lib/release-notes-core.mjs and exists for the same
// reason: the extraction can then be unit-tested directly against in-memory
// fixtures (test/build-verse-index.test.js). verses.json is a website asset
// rather than part of the mobile-app contract, but it backs live scripture
// search, so a silent extraction regression ships straight to readers. Keep the
// tests pointed at extractVerses, so they exercise what the build actually runs.
//
// WHAT LIVES HERE vs IN ./verse-text.mjs. The splitting itself is NOT
// index-specific — build-alignment.mjs and the alignment review tool read the
// same chapters and must agree with search on where a verse starts and ends, so
// it lives in ./verse-text.mjs and every consumer shares it. What remains here
// is the one thing only the search index wants: the DENSE array shape below.

import { splitChapterVerses } from "./verse-text.mjs";

/**
 * Split one chapter's paragraphs into the shipped shape: a DENSE array, index 0
 * = verse 1, "" for verse numbers with no content. The client indexes into it
 * positionally, so it can be neither sparse nor a Map. `null` means "no verses
 * here" — the wrapper's signal to skip the chapter entirely.
 *
 * @param {string[]} paragraphs
 * @returns {string[] | null}
 */
export function extractVerses(paragraphs) {
  const byVerse = splitChapterVerses(paragraphs);
  if (!byVerse.size) return null;

  const maxVerse = Math.max(...byVerse.keys());
  const verses = [];
  for (let v = 1; v <= maxVerse; v++) verses.push(byVerse.get(v) || "");
  return verses;
}
