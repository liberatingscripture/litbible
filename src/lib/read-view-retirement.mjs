// src/lib/read-view-retirement.mjs
//
// The rules for Read View's retirement at the Study Desk's launch (STUDY-DESK.md,
// E8, "At launch"; work session 8b, BVJ 2026-11-02). Built and tested, and
// **not switched on**: nothing imports this yet, because `/read/<book>` is what
// every reader has until the launch. Work session 8c is the cutover, which wires
// these in and then removes Read View's code, copy and docs:
//
// - `readViewRedirects()`: the Astro `redirects` entries for `/read/<book>`,
//   spread into astro.config.mjs's `redirects` at 8c. A static redirect page
//   is a meta refresh, which drops the address's `#fragment`, so it is only
//   the no-script fallback.
// - `studyAddress(pathname, hash)`: where an old Read View address belongs in
//   Chapter View, anchors included. At 8c `/read/[book].astro` becomes a small
//   noindex page whose script (src/scripts/read-view-redirect.js) does
//   `location.replace(studyAddress(...))`, so an old `#ch-10` or
//   `#luke-10-v25` link keeps its place; the pages leave the sitemap.
//   Search results that built Read View anchors (search-core.js) take the
//   same function's chapter and verse forms.
// - `studyRecord(r)` and `studyContinueHref(r)`: "Continue reading"
//   (`lit_last_read`, last-read.js) records written by Read View (`view:
//   "read"`) are read as Chapter View places, not dropped: the same book,
//   chapter and verse, in the other view. Read View's per-book resume
//   positions (`lit_rm_*`) are let go (E9's answer), since the reader never
//   made them.
//
// Pure and unit-tested (test/read-view-retirement.test.js).

import { BOOKS, BOOK_ORDER } from "../data/books.js";

const known = (bookKey) => typeof bookKey === "string" && Object.hasOwn(BOOKS, bookKey);
const chapterOf = (bookKey, n) => known(bookKey) && Number.isInteger(n) && n >= 1 && n <= BOOKS[bookKey];

/** Chapter View's chapter address: `/john-3/`. */
const chapterPath = (bookKey, chapter) => `/${bookKey}-${chapter}/`;

/**
 * Where an old Read View address belongs in Chapter View, or null when the
 * path isn't a Read View book page (so the caller leaves the address alone).
 *
 * - `/read/john/` and anything unrecognized after it: `/john-1/`, the book's start.
 * - `#ch-10` (a chapter heading, Chapter View's old "Switch to Read View"):
 *   `/john-10/`.
 * - `#luke-10-v25` (a verse, as search and Continue reading linked it):
 *   `/luke-10/#v25`. A verse with a letter (`#john-3-v16b`) keeps it. The
 *   anchor's own book wins over the path's, as it does in Read View.
 * - `#john-8-p9` (one block of a verse, "Or copy one part"): `/john-8/#john-8-p9`,
 *   since Chapter View's block ids are the same ids.
 *
 * A chapter the book hasn't got falls back to the book's start rather than a
 * page that doesn't exist.
 */
export function studyAddress(pathname, hash = "") {
  const path = /^\/read\/([a-z0-9]+)\/?$/.exec(String(pathname ?? ""));
  if (!path || !known(path[1])) return null;
  const book = path[1];
  const fragment = String(hash ?? "").replace(/^#/, "");

  const chapter = /^ch-(\d{1,3})$/.exec(fragment);
  if (chapter && chapterOf(book, Number(chapter[1]))) return chapterPath(book, Number(chapter[1]));

  const verse = /^([a-z0-9]+)-(\d{1,3})-v(\d{1,3}[a-z]?)$/.exec(fragment);
  if (verse && chapterOf(verse[1], Number(verse[2]))) return `${chapterPath(verse[1], Number(verse[2]))}#v${verse[3]}`;

  const block = /^([a-z0-9]+)-(\d{1,3})-p(\d{1,3})$/.exec(fragment);
  if (block && chapterOf(block[1], Number(block[2]))) return `${chapterPath(block[1], Number(block[2]))}#${fragment}`;

  return chapterPath(book, 1);
}

/** Astro's `redirects` entries for every `/read/<book>`: `{ "/read/john": "/john-1/", ... }`. */
export function readViewRedirects() {
  return Object.fromEntries(BOOK_ORDER.map((book) => [`/read/${book}`, chapterPath(book, 1)]));
}

/**
 * A "Continue reading" record, read as a Chapter View place: `view` becomes
 * "study", everything else as it was. A record that is already Chapter View's,
 * or isn't a record, comes back as it is.
 */
export function studyRecord(r) {
  if (!r || typeof r !== "object" || r.view !== "read") return r;
  return { ...r, view: "study" };
}

/** Where "Continue reading" goes for any record: Chapter View, at the verse when there is one. */
export function studyContinueHref(r) {
  return `/${r.book}-${r.chapter}/${r.verse ? `#v${r.verse}` : ""}`;
}
