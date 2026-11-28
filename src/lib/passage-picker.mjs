// src/lib/passage-picker.mjs
//
// The passage picker's books and what its field offers (SITE-FEATHERBOA.md,
// "Finding a passage"; FP-03 to FP-06, FP-09, FP-10). Pure: PassagePicker.astro
// draws the books and chapters from pickerBooks() at build time, and
// src/scripts/passage-picker.js asks readTyping() at each keystroke.
//
// Typing is read as the search box reads a reference (search-core.js's
// parseReferenceJump), then by the 404 page's guesser (resolveMistypedPath),
// so "rom 8," "1 cor 13," "romans," "Matthew intro," and "jn 3 16" all land
// on a passage. Anything else offers a search for what was typed, so typing
// never dead-ends. Both readers live in search-core.js, which every page
// already loads with its search box, and which Node can import.
// test/featherboa-picker.test.js holds it.

import { BOOKS, BOOK_ORDER, bookKeyToLabel } from "../data/books.js";
import { chapterRuns } from "./chapter-nav.mjs";
import { formatReferenceLabel, parseReferenceJump, resolveMistypedPath } from "../scripts/search-core.js";

/** The field's placeholder, in the record's words (FP-03). */
export const FIELD_HINT = "book, chapter, or verse";

/** What a draft carries beside it (FP-10). */
export const IN_PROGRESS = "in progress";

// The site builds to directory format, so each address takes its slash and
// skips the 308.
const chapterHref = (book, chapter) => `/${book}-${chapter}/`;
const introHref = (book) => `/${book}-intro/`;

/** /search with what was typed (FP-06). */
export const searchHref = (text) => `/search/?q=${encodeURIComponent(text)}`;

/** The words under a book's chapters that say which are in progress, or "". */
export function draftNote(chapters) {
  const sorted = [...chapters].sort((a, b) => a - b);
  if (!sorted.length) return "";
  return sorted.length === 1
    ? `Chapter ${sorted[0]} ${IN_PROGRESS}`
    : `Chapters ${chapterRuns(sorted)} ${IN_PROGRESS}`;
}

/**
 * The 27 books, in canonical order with no groups (FP-08), each with its
 * chapters and its introduction (FP-09), and what is still in progress
 * (FP-10): a whole book (`draft`), a chapter, or an introduction.
 *
 * @param {{ draftChaptersByBook?: Record<string, number[]>,
 *   fullyDraftBooks?: Iterable<string>, draftIntros?: Iterable<string> }} [drafts]
 * @returns {{ key: string, label: string, draft: boolean, note: string,
 *   chapters: { n: number, href: string, draft: boolean }[],
 *   intro: { href: string, draft: boolean } }[]}
 */
export function pickerBooks({ draftChaptersByBook = {}, fullyDraftBooks = [], draftIntros = [] } = {}) {
  const wholeDrafts = new Set(fullyDraftBooks);
  const introDrafts = new Set(draftIntros);
  return BOOK_ORDER.map((key) => {
    const drafts = new Set(draftChaptersByBook[key] ?? []);
    return {
      key,
      label: bookKeyToLabel(key),
      draft: wholeDrafts.has(key),
      note: draftNote(drafts),
      chapters: Array.from({ length: BOOKS[key] }, (_, i) => ({
        n: i + 1,
        href: chapterHref(key, i + 1),
        draft: drafts.has(i + 1),
      })),
      intro: { href: introHref(key), draft: introDrafts.has(key) },
    };
  });
}

/** A chapter or an introduction from a picker address, or null. */
function placeOfHref(href) {
  const m = /^\/([0-9a-z]+)-(intro|\d+)\/(?:#.*)?$/.exec(href);
  if (!m || !BOOKS[m[1]]) return null;
  return { book: m[1], chapter: m[2] === "intro" ? "intro" : Number(m[2]) };
}

/**
 * What the field offers for `text` (FP-03 to FP-06): `{ book, offers }`.
 * `book` is the book the typing names, whose chapters the picker shows, or
 * null. Each offer is `{ kind: "go" | "search", label, href, draft }`; the
 * first is what Enter takes. An empty field offers nothing.
 *
 * - A passage: "Go to Romans 8," "Go to John 3:16."
 * - A book's introduction: "Go to Matthew introduction" (E123).
 * - A book alone: its first chapter, then its introduction.
 * - A chapter the book doesn't have, or anything that isn't a passage: the
 *   one row "Search for ‘forgiveness’."
 *
 * @param {string} text
 * @param {{ isDraft?: (book: string, chapter: number | "intro") => boolean }} [options]
 *   says which pages are in progress, so an offer can say so too
 */
export function readTyping(text, { isDraft = () => false } = {}) {
  const typed = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!typed) return { book: null, offers: [] };

  const go = (label, href) => {
    const place = placeOfHref(href);
    return { kind: "go", label: `Go to ${label}`, href, draft: Boolean(place && isDraft(place.book, place.chapter)) };
  };
  const search = { kind: "search", label: `Search for ‘${typed}’`, href: searchHref(typed), draft: false };

  const jump = parseReferenceJump(typed);
  if (jump?.kind === "ref") {
    const { bookKey, chapter, verse, rangeEnd } = jump;
    if (chapter > BOOKS[bookKey]) return { book: bookKey, offers: [search] };
    const hash = verse ? `#v${verse}${rangeEnd ? `-${rangeEnd}` : ""}` : "";
    return { book: bookKey, offers: [go(formatReferenceLabel(jump), `${chapterHref(bookKey, chapter)}${hash}`)] };
  }
  if (jump?.kind === "book") {
    const name = bookKeyToLabel(jump.bookKey);
    const intro = go(`${name} introduction`, introHref(jump.bookKey));
    if (jump.intro) return { book: jump.bookKey, offers: [intro] };
    return { book: jump.bookKey, offers: [go(`${name} 1`, chapterHref(jump.bookKey, 1)), intro] };
  }

  // The 404 page's guesser reads what the search box can't: "jn 3 16,"
  // "john/3." Only a chapter or an introduction it is sure of; never Read
  // View, which the Read page replaces.
  const guess = resolveMistypedPath(`/${typed.replace(/ /g, "-")}`);
  const place = guess?.sure ? placeOfHref(guess.href) : null;
  if (place) return { book: place.book, offers: [go(guess.label, guess.href)] };

  return { book: null, offers: [search] };
}
