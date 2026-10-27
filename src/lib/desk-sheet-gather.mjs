// src/lib/desk-sheet-gather.mjs
//
// A sheet from a search or a topic (STUDY-DESK.md, M5): the verses a search
// found, or the chapters a topic names, turned into the passages of a sheet.
// Pure: no DOM, no storage, no fetching. The client (desk/search-sheet.js)
// hands over what the search found, and reads the last verse of each chapter
// itself when a topic's chapters are wanted whole.
//
// Rules, all from STUDY-DESK-FORMAT.md, "Sheets (kind 9)", `passage`:
//   - A passage is the verses of ONE chapter, so a run of consecutive verses
//     becomes one passage, and a run never crosses a chapter.
//   - Passages come in Bible order whatever order the search listed them in
//     (relevance, say), so the sheet reads as scripture does.
//   - A passage holds a reference, never the words. These are made without
//     the chapter's text to hand, so none keeps a comparison copy
//     (`verseCopy`), which the format allows: it is for the change notice
//     only, and a passage without one simply never raises it.
//   - A sheet holds at most SHEET_LIMITS.modules parts. What fits is
//     returned, with a count of what was left out, never silently dropped.

import { BOOKS, BOOK_ORDER } from "../data/books.js";
import { passageFromVerses } from "./desk-sheet-passages.mjs";
import { SHEET_LIMITS } from "./desk-sheet-format.mjs";

const ORDER = new Map(BOOK_ORDER.map((key, i) => [key, i]));

const isWhole = (n) => Number.isInteger(n) && n >= 1;

/** Whether `ref` names a real chapter of a New Testament book. */
function inBook(ref) {
  return (
    ref != null &&
    typeof ref.bookKey === "string" &&
    ORDER.has(ref.bookKey) &&
    isWhole(ref.chapter) &&
    ref.chapter <= (BOOKS[ref.bookKey] ?? 0)
  );
}

/** Bible order: book, then chapter, then verse. */
const byPlace = (a, b) =>
  ORDER.get(a.bookKey) - ORDER.get(b.bookKey) || a.chapter - b.chapter || (a.verse ?? 0) - (b.verse ?? 0);

/** How many passages fit on a sheet that already holds `existing` parts. */
export function roomOnSheet(existing = 0) {
  return Math.max(0, SHEET_LIMITS.modules - (Number.isInteger(existing) ? existing : 0));
}

/** The first `room` passages, and how many were left out. */
function fit(passages, room) {
  const limit = Math.max(0, Math.min(Number.isInteger(room) ? room : SHEET_LIMITS.modules, SHEET_LIMITS.modules));
  return { passages: passages.slice(0, limit), leftOut: Math.max(0, passages.length - limit) };
}

/**
 * Verses (any order, repeats allowed) as passages: sorted into Bible order,
 * each run of consecutive verses in one chapter merged into one passage with
 * `verse` and `endVerse`. A reference that isn't a verse of the New Testament
 * is ignored.
 *
 * @param {{ bookKey: string, chapter: number, verse: number }[]} refs
 * @param {{ room?: number }} [options] how many passages fit; the rest are counted
 * @returns {{ passages: object[], leftOut: number }}
 */
export function passagesFromVerses(refs, { room = SHEET_LIMITS.modules } = {}) {
  const seen = new Set();
  const verses = [];
  for (const ref of Array.isArray(refs) ? refs : []) {
    if (!inBook(ref) || !isWhole(ref.verse)) continue;
    const key = `${ref.bookKey} ${ref.chapter}:${ref.verse}`;
    if (seen.has(key)) continue;
    seen.add(key);
    verses.push({ bookKey: ref.bookKey, chapter: ref.chapter, verse: ref.verse });
  }
  verses.sort(byPlace);

  const runs = [];
  for (const v of verses) {
    const run = runs[runs.length - 1];
    if (run && run.bookKey === v.bookKey && run.chapter === v.chapter && run.endVerse + 1 === v.verse) {
      run.endVerse = v.verse;
    } else {
      runs.push({ bookKey: v.bookKey, chapter: v.chapter, verse: v.verse, endVerse: v.verse });
    }
  }

  const all = runs.map((r) => passageFromVerses(null, { bookKey: r.bookKey, chapter: r.chapter }, r.verse, r.endVerse));
  return fit(all, room);
}

/**
 * Whole chapters (a topic's) as passages, one each, in Bible order, each from
 * verse 1 to the chapter's last. The last verse is the caller's to supply
 * (`lastVerse`), because only the page has the chapter's text; a chapter
 * with none is counted in `unknown` and left out, never guessed at.
 *
 * @param {{ bookKey: string, chapter: number, lastVerse?: number | null }[]} chapters
 * @param {{ room?: number }} [options]
 * @returns {{ passages: object[], leftOut: number, unknown: number }}
 */
export function passagesFromChapters(chapters, { room = SHEET_LIMITS.modules } = {}) {
  const seen = new Set();
  const list = [];
  for (const c of Array.isArray(chapters) ? chapters : []) {
    if (!inBook(c)) continue;
    const key = `${c.bookKey} ${c.chapter}`;
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({ bookKey: c.bookKey, chapter: c.chapter, lastVerse: c.lastVerse });
  }
  list.sort(byPlace);

  let unknown = 0;
  const all = [];
  for (const c of list) {
    if (!isWhole(c.lastVerse)) {
      unknown++;
      continue;
    }
    all.push(passageFromVerses(null, { bookKey: c.bookKey, chapter: c.chapter }, 1, c.lastVerse));
  }
  return { ...fit(all, room), unknown };
}

/**
 * The title of a sheet made from a search: `Search: “liberation”`. For a
 * topic's chapters it is the topic's label when `label` is given (the one
 * every chapter carries), else `Topic: “forgive”`. The query's own quotes are
 * dropped (a quoted phrase is shown inside the curly ones), whitespace is
 * collapsed, and the title is cut to the format's limit.
 */
export function searchSheetTitle(query, { kind = "search", label = null } = {}) {
  const tidy = (text) =>
    String(text ?? "")
      .replace(/["“”]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const cut = (text, closing = "") => {
    const chars = Array.from(text);
    return chars.length <= SHEET_LIMITS.title ? text : `${chars.slice(0, SHEET_LIMITS.title - 1 - closing.length).join("")}…${closing}`;
  };
  if (kind === "topic" && tidy(label)) return cut(tidy(label));
  return cut(`${kind === "topic" ? "Topic" : "Search"}: “${tidy(query)}”`, "”");
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** A sheet's name inside curly quotes: any quotes in the name itself turn single. */
const quoted = (name) => String(name ?? "").replace(/“/g, "‘").replace(/”/g, "’");

/**
 * What to tell the reader after the sheet was made or added to, in the site's
 * voice (American spelling, Oxford comma, curly quotes, periods inside).
 *
 * `leftOut` counts the passages the sheet had no room for, and `unread` the
 * chapters whose last verse couldn't be read (passagesFromChapters' `unknown`),
 * told apart, since only the first has anything to do with the limit (BA131).
 *
 * @param {{ made: boolean, name: string, added: number, leftOut?: number, unread?: number }} what
 */
export function gatherMessage({ made, name, added, leftOut = 0, unread = 0 }) {
  const lead = made
    ? `Made “${quoted(name)}” with ${plural(added, "passage", "passages")}.`
    : `Added ${plural(added, "passage", "passages")} to “${quoted(name)}.”`;
  const parts = [lead];
  if (leftOut) {
    const rest = `${leftOut} more ${leftOut === 1 ? "passage" : "passages"} didn’t fit`;
    parts.push(`${rest}, since a sheet holds at most ${SHEET_LIMITS.modules} parts.`);
  }
  if (unread) {
    parts.push(`${plural(unread, "chapter", "chapters")} couldn’t be read just now, so ${unread === 1 ? "it wasn’t" : "they weren’t"} added.`);
  }
  return parts.join(" ");
}
