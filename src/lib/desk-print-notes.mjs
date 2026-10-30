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

import { shortQuote } from "./desk-notes.mjs";

/** How many words of the quotation each printed note leads with. */
export const PRINT_QUOTE_WORDS = 8;

/** What a printed note says where the words it hangs on have changed since. */
export const CHANGED_NOTE = "The wording has changed since I wrote this.";

/** What it says where its verse is on the page but its words are gone. */
export const LOST_NOTE = "The words I wrote this on are no longer in the text.";

/** What it says where it was made on whole verses and its verse is not in the text. */
export const LOST_VERSE_NOTE = "The verse I wrote this on is not in the text.";

/** The heading over notes that have no place on the printed page. */
export const STRAYS_TITLE = "Notes that are not on these pages";

/**
 * How a note stands against today's text, from `placeRecord`'s status:
 * "here" (its words are where they were), "changed" (found, but the wording
 * between its edges differs, or only its verses were found) or "lost".
 *
 * @param {string} status
 * @returns {"here" | "changed" | "lost"}
 */
export function standing(status) {
  if (status === "found" || status === "moved") return "here";
  if (status === "changed" || status === "verse") return "changed";
  return "lost";
}

/**
 * What heads a printed note: its reference, the words it hangs on in short
 * (none for a note on whole verses; a footnote's for a note on one), and a line saying so when the wording
 * has moved. `how` is `standing`'s answer.
 *
 * @returns {{ ref: string, quote: string, warning: string }}
 */
export function printHeading(record, ref, how = "here") {
  // A note on a footnote (M11) quotes the footnote's opening words.
  const exact = typeof record?.quote?.exact === "string" ? record.quote.exact
    : record?.kind === "note" && typeof record.footnote === "string" ? record.footnote : "";
  return {
    ref: ref || "",
    quote: exact ? shortQuote(exact, PRINT_QUOTE_WORDS) : "",
    warning: how === "changed" ? CHANGED_NOTE : how === "lost" ? (exact ? LOST_NOTE : LOST_VERSE_NOTE) : "",
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
// chapter's Study View page in a new tab with `?print=<kind>`, and the shell
// there starts that print once the page has loaded (desk/print-link.js), as a
// sheet's "Print or share…" opens /sheets/ (BVJ, 2026-10-29).

/** The address parameter that asks a Study View page to print. */
export const PRINT_PARAM = "print";

/** Plain printing, "Print with my notes" (M6) and "Print with room to write" (N9). */
export const PRINT_KINDS = Object.freeze(["plain", "notes", "room"]);

/** A kind from the parameter, or null for anything else. */
export function parsePrintParam(value) {
  return PRINT_KINDS.includes(value) ? value : null;
}

/** The Study View address that prints a chapter as `kind`. */
export function printHref(bookKey, chapter, kind) {
  return `/${bookKey}-${chapter}/?${PRINT_PARAM}=${kind}`;
}
