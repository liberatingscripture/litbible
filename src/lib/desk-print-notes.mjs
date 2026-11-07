// src/lib/desk-print-notes.mjs
//
// The rules behind "Print with my notes" (STUDY-DESK.md, M6): a chapter, or a
// whole book from Read View, printed with the reader's notes in a column
// beside the text and their highlights shown. Pure: positions in, a plan out,
// so Node can test what the page does. src/scripts/desk/print-notes.js reads
// the page and the notebook, builds what print needs, and takes it away again.
//
// What the printed page promises:
//   - a note sits beside the block (paragraph or poetry quotation) that holds
//     its first word, in full, never cut off, with its reference and a short
//     quotation of the words it hangs on. A block holding several notes lists
//     them in reading order;
//   - a note whose words have changed still prints, beside the verse it was
//     made on and saying so; one whose verse is not on the page at all prints
//     at the end, under its own heading, so nothing the reader wrote is lost
//     to the printer;
//   - plain printing (Ctrl+P) is not this: it stays the text and its
//     footnotes (print.css).

import { bookKeyToLabel } from "../data/books.js";
import { shortQuote } from "./desk-notes.mjs";

/** How many words of the quotation each printed note leads with. */
export const PRINT_QUOTE_WORDS = 8;

/** What a printed note says where the words it hangs on have changed since. */
export const CHANGED_NOTE = "The wording has changed since I wrote this.";

/** What it says where its words were found in another verse while its own still stands (anchor spec version 4). */
export const MOVED_NOTE = "The words this note was on have moved to another verse.";

/** What it says where its verse is on the page but its words are gone. */
export const LOST_NOTE = "The words I wrote this on are no longer in the text.";

/** What it says where it was made on whole verses and its verse is not in the text. */
export const LOST_VERSE_NOTE = "The verse I wrote this on is not in the text.";

/** The heading over notes that have no place on the printed page. */
export const STRAYS_TITLE = "Notes that are not on these pages";

/**
 * How a note stands against today's text, from `placeRecord`'s placement (or
 * its status alone): "here" (its words are where they were), "moved" (its
 * words were found in another verse while its own still stands, which the
 * screen's change notice says too; anchor spec version 4, audit 3 DI3-2),
 * "changed" (found, but the wording between its edges differs, or only its
 * verses were found) or "lost". A `moved` whose placement isn't given, or
 * that stays inside its verses, is "here", as a pinned footnote's is.
 *
 * @param {string | { status: string, outsideVerses?: boolean }} at
 * @returns {"here" | "moved" | "changed" | "lost"}
 */
export function standing(at) {
  const status = typeof at === "string" ? at : at?.status;
  if (status === "moved") return typeof at === "object" && at.outsideVerses === true ? "moved" : "here";
  if (status === "found") return "here";
  if (status === "changed" || status === "verse") return "changed";
  return "lost";
}

/**
 * What heads a printed note: its reference, the words it hangs on in short
 * (none for a note on whole verses; a footnote's for a note on one), and a line saying so when the wording
 * has moved. `how` is `standing`'s answer. A moved note prints beside the
 * verse its words are in now, as the screen draws it, under its own
 * reference, so the line says where it went.
 *
 * @returns {{ ref: string, quote: string, warning: string }}
 */
export function printHeading(record, ref, how = "here") {
  // A note on a footnote (M11) quotes the footnote's opening words.
  const exact = typeof record?.quote?.exact === "string" ? record.quote.exact
    : record?.kind === "note" && typeof record.footnote === "string" ? record.footnote : "";
  const warning =
    how === "changed" ? CHANGED_NOTE : how === "moved" ? MOVED_NOTE : how === "lost" ? (exact ? LOST_NOTE : LOST_VERSE_NOTE) : "";
  return {
    ref: ref || "",
    quote: exact ? shortQuote(exact, PRINT_QUOTE_WORDS) : "",
    warning,
  };
}

/**
 * The first block holding one of these verses, or null. `blockVerses` lists,
 * for each block, the verse numbers it holds in order; a verse that runs over
 * a break counts in the first block that begins it. Tries `verse`, then each
 * verse up to `endVerse`, since a note on 5–7 is still somewhere when only 6
 * is on the page.
 *
 * @param {number[][]} blockVerses
 * @returns {number | null} a block's index
 */
export function blockForVerse(blockVerses, verse, endVerse = verse) {
  if (!Number.isInteger(verse)) return null;
  const last = Number.isInteger(endVerse) && endVerse >= verse ? endVerse : verse;
  for (let v = verse; v <= last; v++) {
    const at = blockVerses.findIndex((vs) => vs.includes(v));
    if (at >= 0) return at;
  }
  return null;
}

/**
 * Which notes go beside which block, and in what order.
 *
 * Each item: `block` (the index of the block that holds the note's first
 * word, or null where nothing on the page does), `offset` (where its words
 * start within that block's chapter, or null when only its verse is known),
 * `verse` and `rank` (its place in the list the notebook gave, which is the
 * order the reader made them in within a verse). Within a block, notes go in
 * reading order: by offset (those with none last), then verse, then rank.
 *
 * @param {{ id: string, block: number | null, offset?: number | null, verse?: number | null, rank: number }[]} items
 * @returns {{ rows: { block: number, ids: string[] }[], strays: string[] }}
 *   `rows` in the order of the blocks, `strays` in the notebook's order
 */
export function planNotes(items) {
  const num = (n) => (Number.isFinite(n) ? n : Infinity);
  const inBlock = new Map();
  const strays = [];
  for (const it of items) {
    if (it.block == null) {
      strays.push(it);
    } else {
      if (!inBlock.has(it.block)) inBlock.set(it.block, []);
      inBlock.get(it.block).push(it);
    }
  }
  const rows = [...inBlock.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([block, list]) => ({
      block,
      ids: list
        .sort((a, b) => num(a.offset) - num(b.offset) || num(a.verse) - num(b.verse) || a.rank - b.rank)
        .map((it) => it.id),
    }));
  return { rows, strays: strays.sort((a, b) => a.rank - b.rank).map((it) => it.id) };
}

/**
 * The pieces of one text node a printed highlight tints (BA146): Firefox
 * prints a copy of the page that leaves its Custom Highlights behind, so
 * print-notes.js wraps each highlighted run in a print-only <mark> instead.
 * Each piece is clipped to the node; empty ones go, and where two overlap
 * (records from another device can), the one that starts first keeps the
 * overlap, so no character is wrapped twice.
 *
 * @param {number} length the text node's length
 * @param {{ start: number, end: number, color: string }[]} pieces
 * @returns {{ start: number, end: number, color: string }[]} in text order
 */
export function markPieces(length, pieces) {
  const out = [];
  let reached = 0;
  const sorted = pieces
    .map((p) => ({ ...p, start: Math.max(0, p.start), end: Math.min(length, p.end) }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  for (const p of sorted) {
    const start = Math.max(p.start, reached);
    if (p.end <= start) continue;
    out.push({ start, end: p.end, color: p.color });
    reached = p.end;
  }
  return out;
}

/* ── Printing a chapter from /desk ─────────────────────────────────────── */

// /desk has no chapter page of its own to print, so its Print menu opens the
// chapter's Chapter View page in a new tab with `?print=<kind>`, and the shell
// there starts that print once the page has loaded (desk/print-link.js), as a
// sheet's "Print or share…" opens /sheets/ (BVJ, 2026-10-29).

/** The address parameter that asks a Chapter View page to print. */
export const PRINT_PARAM = "print";

/** Plain printing, "Print with my notes" (M6) and "Print with room to write" (N9). */
export const PRINT_KINDS = Object.freeze(["plain", "notes", "room"]);

/** A kind from the parameter, or null for anything else. */
export function parsePrintParam(value) {
  return PRINT_KINDS.includes(value) ? value : null;
}

/**
 * The Print menu's one-time mark, in localStorage since its new tab shares no
 * session: a page prints itself only for the address the menu was just pressed
 * for. A link from anywhere else (a chat, an email, a shared sheet) must not
 * open a print preview of the reader's notes on its own (SEC-4). A referrer
 * can't say this: some browsers and extensions leave it out, and a link in a
 * sheet on /desk would carry one.
 */
export const PRINT_ASK_KEY = "lit-desk-print-ask";
export const PRINT_ASK_MS = 60_000;

/** The mark for a press of the Print menu on `href`. */
export function printAsk(href, now) {
  return `${now} ${href}`;
}

/** Whether `stored`, the mark as read, asks for `href` at the time `now`. */
export function printWasAsked(stored, href, now) {
  if (typeof stored !== "string") return false;
  const space = stored.indexOf(" ");
  const age = now - Number(stored.slice(0, space));
  return stored.slice(space + 1) === href && age >= 0 && age <= PRINT_ASK_MS;
}

/** The Chapter View address that prints a chapter as `kind`. */
export function printHref(bookKey, chapter, kind) {
  return `/${bookKey}-${chapter}/?${PRINT_PARAM}=${kind}`;
}

/* ── The shared Print menu (E16) ───────────────────────────────────────── */

// One menu, on /desk and in the Notebook (desk/print-menu.js): a chapter
// choice, then the three prints. This decides what each choice does for the
// chapter picked, so the two places cannot drift apart again.

/** Each print's name on the menu; the book's, where the menu prints a book. */
export const PRINT_LABELS = Object.freeze({ plain: "The chapter", notes: "With my notes", room: "With room to write" });
export const PRINT_BOOK_LABELS = Object.freeze({ plain: "The book", notes: "With my notes", room: "With room to write" });

/**
 * What the Print menu shows for the chapter picked.
 *
 * `passage` is the chapter picked ({ bookKey, chapter }) or null; `drafts` is
 * the draft chapters by book where the page knows them; `notebook` is whether
 * the browser keeps a notebook ("With my notes" needs one, and is left out
 * without); `here` is the Chapter View chapter this page already shows, whose
 * prints run in place instead of opening a tab; `book` is a Read View's book,
 * where the menu prints that book in place and picks nothing.
 *
 * Each choice is `{ kind, label, state, href, inPlace }`: `state` is "on",
 * "off" (shown, but nothing to open) or "hidden" (can never work here).
 * `message` is a line that says why choices are off, or null.
 *
 * @returns {{ message: string | null, choices: Array<object> }}
 */
export function printMenuState({ passage = null, drafts = {}, notebook = true, here = null, book = null } = {}) {
  const labels = book ? PRINT_BOOK_LABELS : PRINT_LABELS;
  const name = book
    ? bookKeyToLabel(book)
    : passage ? `${bookKeyToLabel(passage.bookKey)} ${passage.chapter}` : "";
  const draft = Boolean(!book && passage && (drafts[passage.bookKey] ?? []).includes(passage.chapter));
  const message = book || (passage && !draft)
    ? null
    : !passage ? "Type a chapter to print it." : `${name} is a draft, with no text to print yet.`;
  const live = Boolean(book || (passage && !draft));
  const inPlace = Boolean(book || (here && passage && here.bookKey === passage.bookKey && here.chapter === passage.chapter));
  return {
    message,
    choices: PRINT_KINDS.map((kind) => ({
      kind,
      label: labels[kind],
      state: kind === "notes" && !notebook ? "hidden" : live ? "on" : "off",
      href: live && !book ? printHref(passage.bookKey, passage.chapter, kind) : null,
      inPlace: live && inPlace,
    })),
  };
}
