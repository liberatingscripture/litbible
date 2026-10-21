// src/lib/desk-corpus.mjs
//
// The New Testament as /desk's LIT pane scrolls through it (STUDY-DESK.md, D9,
// "Phase 3a's answers", 5; "Order of work", 3e): Matthew 1 to Revelation 22,
// one chapter after another across the books, with no setting for a chapter
// or a book. A run of draft chapters in one book is one stub, as Read View
// prints it, so a reader scrolls past Acts in one step rather than 28; each
// chapter in the run still names the stub, so a passage in it lands there.
// Pure and unit-tested; the pane is src/scripts/desk/lit-pane.js.

import { BOOKS, BOOK_ORDER, bookKeyToLabel } from "../data/books.js";

/**
 * The corpus in reading order, as units: a published chapter is one unit,
 * `{ bookKey, chapters: [n], draft: false }`; a run of drafts in one book is
 * one, `{ bookKey, chapters: [23, 24], draft: true }`.
 *
 * @param {Record<string, number[]>} draftsByBook the draft chapters of each
 *   book (draft-chapters.mjs's `draftChaptersByBook`)
 */
export function corpusUnits(draftsByBook = {}) {
  const units = [];
  for (const bookKey of BOOK_ORDER) {
    const drafts = new Set(draftsByBook[bookKey] ?? []);
    for (let chapter = 1; chapter <= BOOKS[bookKey]; chapter++) {
      const last = units.at(-1);
      if (!drafts.has(chapter)) units.push({ bookKey, chapters: [chapter], draft: false });
      else if (last?.draft && last.bookKey === bookKey) last.chapters.push(chapter);
      else units.push({ bookKey, chapters: [chapter], draft: true });
    }
  }
  return units;
}

/** The index of the unit holding a chapter, or -1. */
export function unitIndex(units, bookKey, chapter) {
  return units.findIndex((u) => u.bookKey === bookKey && u.chapters.includes(chapter));
}

/** Whether a unit is a whole book. */
const wholeBook = (u) => u.chapters.length === BOOKS[u.bookKey];

/** A unit's heading: "John 3", "Luke 23–24", or "Acts" for a book still wholly in draft. */
export function unitHeading(u) {
  const book = bookKeyToLabel(u.bookKey);
  if (u.draft && wholeBook(u) && u.chapters.length > 1) return book;
  const first = u.chapters[0];
  const last = u.chapters.at(-1);
  return first === last ? `${book} ${first}` : `${book} ${first}–${last}`;
}

/** What a draft stub says. */
export function draftStubText(u) {
  if (wholeBook(u) && u.chapters.length > 1) return `${bookKeyToLabel(u.bookKey)} is still being translated.`;
  return u.chapters.length === 1 ? "This chapter is still being translated." : "These chapters are still being translated.";
}
