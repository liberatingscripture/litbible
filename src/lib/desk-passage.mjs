// src/lib/desk-passage.mjs
//
// A passage on /desk (STUDY-DESK.md, D9; "Order of work", 3d): the chapter
// and verse a following pane (This verse, Greek) shows. It is kept in the
// layout as a short string, "john 3:16", either as the place the following
// panes share or as a pinned pane's own (`pin.at`, src/lib/desk-layout.mjs).
// This reads and writes that string, names it for a reader, and steps from
// chapter to chapter across the books. Pure and unit-tested.

import { BOOKS, BOOK_ORDER, bookKeyToLabel } from "../data/books.js";

/** Where a reader starts who has nothing else to go on. */
export const FIRST_PASSAGE = Object.freeze({ bookKey: "matthew", chapter: 1, verse: 1 });

const isCount = (n) => Number.isInteger(n) && n > 0;

/**
 * A passage, checked: a known book, a chapter it has, and a verse that is a
 * whole number from 1 (or null for none). Anything else is null.
 */
export function checkPassage(p) {
  if (!p || typeof p !== "object") return null;
  const { bookKey, chapter } = p;
  const verse = p.verse ?? null;
  if (typeof bookKey !== "string" || !Object.hasOwn(BOOKS, bookKey)) return null;
  if (!isCount(chapter) || chapter > BOOKS[bookKey]) return null;
  if (verse !== null && !isCount(verse)) return null;
  return { bookKey, chapter, verse };
}

/** "john 3:16" (or "john 3") back to a passage, or null when it isn't one. */
export function parsePassage(at) {
  if (typeof at !== "string") return null;
  const m = /^([a-z0-9]+) (\d{1,3})(?::(\d{1,3}))?$/.exec(at.trim());
  if (!m) return null;
  return checkPassage({ bookKey: m[1], chapter: Number(m[2]), verse: m[3] ? Number(m[3]) : null });
}

/** A passage as the layout keeps it: "john 3:16", or null when it isn't one. */
export function formatPassage(p) {
  const ok = checkPassage(p);
  if (!ok) return null;
  return `${ok.bookKey} ${ok.chapter}${ok.verse ? `:${ok.verse}` : ""}`;
}

/** A passage's name for a reader: "John 3:16", or "John 3" with no verse. */
export function passageLabel(p) {
  const ok = checkPassage(p);
  if (!ok) return "";
  return `${bookKeyToLabel(ok.bookKey)} ${ok.chapter}${ok.verse ? `:${ok.verse}` : ""}`;
}

/** Whether two passages are in one chapter. */
export const sameChapter = (a, b) => Boolean(a && b && a.bookKey === b.bookKey && a.chapter === b.chapter);

/**
 * The chapter before (`dir` -1) or after (+1) a passage's, across the books
 * (Matthew 28, then Mark 1), with no verse; null past either end of the New
 * Testament.
 */
export function stepChapter(p, dir) {
  const ok = checkPassage(p);
  if (!ok || (dir !== 1 && dir !== -1)) return null;
  const chapter = ok.chapter + dir;
  if (chapter >= 1 && chapter <= BOOKS[ok.bookKey]) return { bookKey: ok.bookKey, chapter, verse: null };
  const i = BOOK_ORDER.indexOf(ok.bookKey) + dir;
  const book = BOOK_ORDER[i];
  if (!book) return null;
  return { bookKey: book, chapter: dir > 0 ? 1 : BOOKS[book], verse: null };
}

/**
 * Where a following pane starts when the layout has no passage yet: the
 * reader's "Continue reading" place (localStorage['lit_last_read'], as
 * last-read.js keeps it), or the start of Matthew.
 */
export function startingPassage(lastRead) {
  const fromRecord = checkPassage({
    bookKey: lastRead?.book,
    chapter: Number(lastRead?.chapter),
    verse: lastRead?.verse == null ? null : Number(lastRead.verse),
  });
  return fromRecord ?? { ...FIRST_PASSAGE };
}
