// src/lib/desk-search-pane.mjs
//
// The rules behind /desk's Search pane (STUDY-DESK.md, "Order of work", 3m):
// where a result goes, which books the pane's book menu offers, how long a
// query must be, and what its "add to a sheet" controls say. Pure and
// unit-tested; the pane that draws it is src/scripts/desk/search-pane.js, which
// takes what a search finds from search-core.js and never copies its parsing.
//
// BVJ's answers (2026-11-01, 3m):
// - the pane stands alone, and its book menu offers "The book I’m reading
//   (John)", which sets the filter to that book and keeps it when the LIT pane
//   moves;
// - a glossary result opens in the pane, an article result in a new tab, and
//   a verse or topic result moves the LIT pane; an intro result shows in a
//   Book Intro pane (E53, 2026-11-06; it opened in a new tab before);
// - results can go on an open Sheets pane's sheet.

import { BOOKS, BOOK_ORDER, bookKeyToLabel } from "../data/books.js";
import { hasGreek } from "./greek-detect.mjs";
import { kindLabel } from "./desk-layout.mjs";

/** The shortest query searched as the tray does (a Greek query has no minimum). */
export const MIN_QUERY_LEN = 3;

/** How many verse rows show before "Show more". */
export const PAGE = 20;

/** The book menu's value for "The book I’m reading". */
export const READING = "@reading";

/**
 * Whether a query is long enough to search: three letters, or any Greek
 * letters while the Greek is searched at all (ὁ, ἐν). The tray's `longEnough`.
 */
export function longEnoughQuery(text, greekOn = false) {
  const q = String(text ?? "").trim();
  return q.length >= MIN_QUERY_LEN || (Boolean(greekOn) && hasGreek(q));
}

/**
 * Where a result's address goes:
 * - `{ type: "passage", bookKey, chapter, verse }`: a chapter of the LIT (verse
 *   null when the address names none, or a topic's whole chapter), which moves
 *   the LIT pane;
 * - `{ type: "glossary", id }`: an entry, which opens in the pane;
 * - `{ type: "intro", bookKey }`: a book's introduction, which shows in a Book
 *   Intro pane (E53);
 * - `{ type: "tab", href }`: anything else (an article, a page of the site,
 *   another site), which opens in a new tab.
 * A verse range `#v16-18` goes to its first verse.
 */
export function resultTarget(href) {
  const raw = String(href ?? "");
  let url;
  try {
    url = new URL(raw, "https://local.invalid");
  } catch (_) {
    return { type: "tab", href: raw };
  }
  if (url.origin !== "https://local.invalid") return { type: "tab", href: raw };
  const path = url.pathname.replace(/\/+$/, "");
  if (path === "/glossary") {
    let id = "";
    try { id = decodeURIComponent(url.hash.slice(1)); } catch (_) { id = url.hash.slice(1); }
    return id ? { type: "glossary", id } : { type: "tab", href: raw };
  }
  const intro = /^\/([0-9a-z]+)-intro$/.exec(path);
  if (intro && Object.hasOwn(BOOKS, intro[1])) return { type: "intro", bookKey: intro[1] };
  const m = /^\/([0-9a-z]+)-(\d+)$/.exec(path);
  if (m && Object.hasOwn(BOOKS, m[1])) {
    const chapter = Number(m[2]);
    if (chapter >= 1 && chapter <= BOOKS[m[1]]) {
      const v = /^#v(\d+)(?:-\d+)?$/.exec(url.hash);
      return { type: "passage", bookKey: m[1], chapter, verse: v ? Number(v[1]) : null };
    }
  }
  return { type: "tab", href: raw };
}

/**
 * The book menu's options: All books, "The book I’m reading (John)" when there
 * is one, then every book in Bible order. `reading` is a book key or null.
 */
export function bookOptions(reading = null) {
  const out = [{ value: "", label: "All books" }];
  if (reading && Object.hasOwn(BOOKS, reading)) {
    out.push({ value: READING, label: `The book I’m reading (${bookKeyToLabel(reading)})` });
  }
  for (const key of BOOK_ORDER) out.push({ value: key, label: bookKeyToLabel(key) });
  return out;
}

/**
 * The book filter a menu choice sets: "" for all books, the book being read
 * for "The book I’m reading", else the book chosen. A book the corpus doesn't
 * have is no filter. Choosing "The book I’m reading" fixes the book at that
 * moment, so the list holds still when the LIT pane moves.
 */
export function bookFilterFor(choice, reading = null) {
  if (choice === READING) return reading && Object.hasOwn(BOOKS, reading) ? reading : "";
  return typeof choice === "string" && Object.hasOwn(BOOKS, choice) ? choice : "";
}

/** A verse row's reference, as the sheet rules take it. */
export const verseRef = (hit) => ({ bookKey: hit.bookKey, chapter: hit.chapter, verse: hit.verse });

/** The name of a verse row's + button. */
export const addVerseLabel = (hit) => `Add ${bookKeyToLabel(hit.bookKey)} ${hit.chapter}:${hit.verse} to the sheet`;

/**
 * The button that adds every verse found to the sheet showing, named by it.
 * The sheet's name is in curly quotes, any quotes inside it turned single.
 */
export function addAllLabel(name, count) {
  const quoted = String(name ?? "").replace(/“/g, "‘").replace(/”/g, "’");
  return `Add ${count === 1 ? "this verse" : "these verses"} to “${quoted}”`;
}

/** How many of `total` rows show after one more page, and how many remain hidden. */
export function nextPage(shown, total, page = PAGE) {
  const next = Math.min(total, Math.max(0, shown) + page);
  return { shown: next, hidden: total - next };
}

/**
 * What a plain click on a passage result says it did (E34; BVJ, 2026-11-05:
 * a result offers the LIT pane or the passage's page, and the LIT pane choice
 * says which happened). `outcome` is desk-page.js's `showPassage`: "moved"
 * the leading LIT pane, "opened" a new one, "replaced" (no LIT pane, none could
 * open, and one took another pane's place) or "placed" (no LIT pane, and no
 * room for one). `label` is the passage, "John 3:16". Empty for anything else,
 * and for the last two: the undo bar and the no-room notice say those
 * (E127: `replacedMessage`, `noWayMessage`), where everyone sees them.
 */
export function passageMoveMessage(outcome, label) {
  if (outcome === "moved") return `The LIT pane moved to ${label}.`;
  if (outcome === "opened") return `A LIT pane opened at ${label}.`;
  return "";
}

/**
 * What a plain click on an intro result says it did (E53). `result` is
 * desk-layout.mjs's `showIntroIn`: `outcome` "shown" or "opened" (a Book Intro
 * pane), "replaced" or "none"; `moved`, the LIT's new place, or null. `book` is
 * the book's name, `movedLabel` that place's ("Romans 1"). Empty for the last
 * two, which the undo bar and the no-room notice say (E127).
 */
export function introMoveMessage(result, book, movedLabel = "") {
  const lit = result?.moved && movedLabel ? ` The LIT moved to ${movedLabel}.` : "";
  if (result?.outcome === "shown") return `The Book Intro pane shows ${book}.${lit}`;
  if (result?.outcome === "opened") return `A Book Intro pane opened at ${book}.${lit}`;
  return "";
}

/**
 * The undo bar's words for a pane the desk opened in place of another (E127;
 * BVJ, 2026-11-12): "Book Intro shown in place of Greek.", each kind named as
 * its "Show in this pane" menu names it. `extra` is a sentence of what else
 * happened; `at` is the passage a LIT pane opened at.
 */
export function replacedMessage(kind, replacedKind, { at = "", extra = "" } = {}) {
  const what = kind === "lit" && at ? `${kindLabel(kind)} shown at ${at}` : `${kindLabel(kind)} shown`;
  return `${what} in place of ${kindLabel(replacedKind)}.${extra ? ` ${extra}` : ""}`;
}

const NO_WAY = {
  lit: { a: "a LIT pane", open: "open the passage on its page" },
  intro: { a: "a Book Intro pane", open: "open the introduction on its page" },
  sheet: { a: "a Sheets pane", open: "open the sheet on its page" },
  greek: { a: "a Greek pane", open: "open the word on its page" },
  search: { a: "a Search pane", open: "use the search page" },
};

/**
 * The notice for a pane that couldn't open and had none to take the place of
 * (E127): why, and both ways on, closing a pane and trying again or opening it
 * on its page (the notice's link). `reason` is `makeWayFor`'s: "full" (four
 * panes) or "window" (fewer, and the window can't hold another). `search`: a
 * Search pane asked, so it keeps its place too.
 */
export function noWayMessage(kind, reason, { search = false } = {}) {
  const w = NO_WAY[kind] ?? { a: "another pane", open: "open it on its page" };
  const keeps = search
    ? "LIT panes, panes set to “Stay here,” and this search keep their places"
    : "LIT panes and panes set to “Stay here” keep their places";
  if (reason === "window") {
    return `There’s no room for ${w.a} in a window this size, and no pane can make way: ${keeps}. Make the window larger or close a pane and try again, or ${w.open}.`;
  }
  return `There’s no room for ${w.a}, and no pane can make way: ${keeps}. Close a pane and try again, or ${w.open}.`;
}

/**
 * The words of that notice's link. `what` is the passage ("John 3:16") for a
 * LIT pane or the book ("Romans") for an introduction; the others need none.
 */
export function noWayLinkLabel(kind, what = "") {
  if (kind === "lit") return `Open ${what}`;
  if (kind === "intro") return `Open the ${what} introduction`;
  if (kind === "sheet") return "Open the sheet";
  if (kind === "greek") return "Open the Greek word";
  return "Open the search page";
}

/** The name of a result's link to its passage's own page, which opens in a new tab (E34). */
export const pageLinkLabel = (label) => `Open ${label} on its page, in a new tab`;


/**
 * The words of the pane's link to /search (E115): "Open the search page" while
 * no search has run (the box is empty), "See results on the search page" once one has.
 */
export const pageLinkText = (searched) =>
  searched ? "See results on the search page" : "Open the search page";
