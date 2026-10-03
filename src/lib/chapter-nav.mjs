// src/lib/chapter-nav.mjs
//
// The one rule for Previous and Next across Study View: every book's intro,
// then its chapters, in canonical order, stepping over pages that are still
// drafts. The top buttons (ScriptureHeader), the bottom buttons on chapter
// and intro pages, and a draft page's "nearest published page" links all ask
// this module, so they can't disagree about where a reader goes next.
//
// Pure: which pages are drafts is injected (see chapter-nav-data.mjs for the
// build shell), so the tests can describe any shape of unfinished corpus.

import { BOOKS, BOOK_ORDER, bookKeyToLabel } from "../data/books.js";

/** [20, 23, 24] → "20, 23–24" */
export function chapterRuns(chapters) {
  const runs = [];
  let start = chapters[0];
  let prev = start;
  for (const n of [...chapters.slice(1), Number.NaN]) {
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    runs.push(start === prev ? String(start) : `${start}–${prev}`);
    start = n;
    prev = n;
  }
  return runs.join(", ");
}

/**
 * Every Study View page in reading order.
 * @param {{ isDraftChapter: (bookKey: string, chapter: number) => boolean,
 *           isDraftIntro: (bookKey: string) => boolean }} drafts
 * @returns {{ bookKey: string, chapter: number | "intro", draft: boolean }[]}
 */
export function readingSequence({ isDraftChapter, isDraftIntro }) {
  const pages = [];
  for (const bookKey of BOOK_ORDER) {
    pages.push({ bookKey, chapter: "intro", draft: isDraftIntro(bookKey) });
    for (let chapter = 1; chapter <= BOOKS[bookKey]; chapter++) {
      pages.push({ bookKey, chapter, draft: isDraftChapter(bookKey, chapter) });
    }
  }
  return pages;
}

/** Canonical href, with the trailing slash so there is no 308 hop. */
export function pageHref({ bookKey, chapter }) {
  return chapter === "intro" ? `/${bookKey}-intro/` : `/${bookKey}-${chapter}/`;
}

/** "John 2", "Luke introduction" */
export function pageLabel({ bookKey, chapter }) {
  const book = bookKeyToLabel(bookKey);
  return chapter === "intro" ? `${book} introduction` : `${book} ${chapter}`;
}

export function joinList(parts) {
  if (parts.length <= 2) return parts.join(" and ");
  return `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}`;
}

/**
 * What isn't finished yet, as a reader would name it: whole draft books
 * first, then partly drafted books with their chapter runs, each group in
 * canonical order ("Acts", "Revelation", "Luke 23–24"). The /read lede and
 * the /about FAQ both print this, so they can't disagree.
 * @param {{ draftChaptersByBook: Record<string, number[]>,
 *           fullyDraftBooks: Set<string> }} drafts
 * @returns {string[]}
 */
export function unfinishedTexts({ draftChaptersByBook, fullyDraftBooks }) {
  return [
    ...BOOK_ORDER.filter((k) => fullyDraftBooks.has(k)).map((k) => bookKeyToLabel(k)),
    ...BOOK_ORDER.filter(
      (k) => !fullyDraftBooks.has(k) && draftChaptersByBook[k]?.length,
    ).map((k) => `${bookKeyToLabel(k)} ${chapterRuns(draftChaptersByBook[k])}`),
  ];
}

/**
 * Names a run of skipped draft pages the way a reader would say it:
 * "Luke 23–24", "Acts" (a whole book, intro included), "the Luke
 * introduction". Returns the sentence the bottom buttons print, too.
 * @param {{ bookKey: string, chapter: number | "intro" }[]} pages  in reading order
 */
export function describeSkipped(pages) {
  const byBook = new Map();
  for (const p of pages) {
    const entry = byBook.get(p.bookKey) ?? { intro: false, chapters: [] };
    if (p.chapter === "intro") entry.intro = true;
    else entry.chapters.push(p.chapter);
    byBook.set(p.bookKey, entry);
  }

  const parts = [];
  let plural = byBook.size > 1;
  let onlyIntros = true;
  for (const [bookKey, { intro, chapters }] of byBook) {
    const book = bookKeyToLabel(bookKey);
    if (chapters.length) onlyIntros = false;
    if (intro && chapters.length === BOOKS[bookKey]) {
      parts.push(book);
      continue;
    }
    if (intro) parts.push(`the ${book} introduction`);
    if (chapters.length) parts.push(`${book} ${chapterRuns(chapters)}`);
    if (chapters.length > 1 || (intro && chapters.length)) plural = true;
  }

  const text = joinList(parts);
  const sentence =
    text.charAt(0).toUpperCase() +
    text.slice(1) +
    ` ${plural ? "are" : "is"} still being ${onlyIntros ? "written" : "translated"}.`;
  return { text, sentence };
}

/**
 * Previous and next published pages from any page (a draft included), and
 * what was stepped over to reach them.
 * @returns {{ prev: {href: string, label: string} | null,
 *             next: {href: string, label: string} | null,
 *             prevSkipped: {text: string, sentence: string} | null,
 *             nextSkipped: {text: string, sentence: string} | null }}
 */
export function neighbours(pages, bookKey, chapter) {
  const i = pages.findIndex((p) => p.bookKey === bookKey && p.chapter === chapter);
  const none = { prev: null, next: null, prevSkipped: null, nextSkipped: null };
  if (i < 0) return none;

  function walk(step) {
    const skipped = [];
    for (let j = i + step; j >= 0 && j < pages.length; j += step) {
      if (!pages[j].draft) return { page: pages[j], skipped };
      skipped.push(pages[j]);
    }
    return { page: null, skipped };
  }

  const back = walk(-1);
  const fwd = walk(1);
  const link = (p) => (p ? { href: pageHref(p), label: pageLabel(p) } : null);
  return {
    prev: link(back.page),
    next: link(fwd.page),
    prevSkipped: back.skipped.length ? describeSkipped(back.skipped.reverse()) : null,
    nextSkipped: fwd.skipped.length ? describeSkipped(fwd.skipped) : null,
  };
}
