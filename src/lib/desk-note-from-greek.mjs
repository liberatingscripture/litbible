// src/lib/desk-note-from-greek.mjs
//
// A note started from the Greek (STUDY-DESK.md, "Order of work", 4k; BVJ,
// 2026-11-23): an ordinary note on its verse or verses, kind 2 with no new
// field, whose body opens with the Greek the reader chose, quoted. Two ways
// in, both of BVJ's (2026-11-23): one word chosen in the Greek tab or pane,
// or a run of the Greek selected there. Pure: the tab hands in the words.
//
// Nothing here anchors a note to Greek words; that, and bookmarks and
// highlights on the Greek, are version 2. The note hangs on the LIT's whole
// verses like any note made from a verse number, so it shows in the margin,
// My Notes and This verse with nothing new to draw.

import { W, splitSigns } from "./desk-greek.mjs";
import { MAX_NOTE_BODY } from "./desk-records.mjs";

// The opening and closing marks round the Greek. Curly, as all reader-facing
// quotes on the site are.
const OPEN = "“";
const CLOSE = "”";

/** Text without the SBLGNT's text-critical signs, which mean nothing outside the tab. */
const withoutSigns = (s) =>
  splitSigns(s)
    .filter((p) => !p.sign)
    .map((p) => p.text)
    .join("");

/**
 * The Greek of some words as the reader selected it (BVJ, 2026-11-23: no
 * punctuation the selection doesn't hold). Between the words, everything the
 * tab shows (a comma, a raised dot, a bracket); at either edge only what the
 * selection reaches over, handed in as `lead` (before the first word) and
 * `trail` (after the last), so a word's comma comes only if it was selected
 * too. One chosen word with neither is the word alone. Spaces are evened out
 * and the SBLGNT's signs left out. A run that crosses into another verse
 * carries that verse's number before its first word ("λόγος. 2 οὗτος ἦν"),
 * as a copy of the tab's text does.
 *
 * @param {{ w: any[], verse: number }[]} words in reading order (flattenWords' items)
 * @param {{ lead?: string, trail?: string }} [edges] the selected text before the first word and after the last
 * @returns {string}
 */
export function greekQuote(words, { lead = "", trail = "" } = {}) {
  const list = (words ?? []).filter((x) => x?.w);
  if (!list.length) return "";
  let s = lead ?? "";
  let last = list[0].verse;
  list.forEach(({ w, verse }, i) => {
    if (verse !== last) {
      s += ` ${verse} `;
      last = verse;
    }
    if (i > 0) s += w[W.pre] ?? "";
    s += w[W.text] ?? "";
    if (i < list.length - 1) s += w[W.post] ?? "";
  });
  s += trail ?? "";
  return withoutSigns(s).replace(/\s+/g, " ").trim();
}

/**
 * The verses a note on these words covers: the first word's and the last's.
 * @param {{ verse: number }[]} words in reading order
 * @returns {{ verse: number, endVerse: number } | null}
 */
export function greekVerses(words) {
  const vs = (words ?? []).map((x) => x?.verse).filter((v) => Number.isInteger(v));
  if (!vs.length) return null;
  return { verse: Math.min(...vs), endVerse: Math.max(...vs) };
}

/**
 * The body a new note opens with: the Greek in curly quotes, then a new line
 * for the reader's words. A quote too long for a note is cut, with an
 * ellipsis, leaving room to write.
 *
 * @param {string} quote
 * @param {number} [max] the longest body a note keeps
 * @returns {string}
 */
export function greekNoteBody(quote, max = MAX_NOTE_BODY) {
  let q = String(quote ?? "").trim();
  if (!q) return "";
  // Room for the marks, the new line, and a page of the reader's own words.
  const room = Math.max(1, max - 4 - 4000);
  if (q.length > room) q = `${q.slice(0, room).trimEnd()}…`;
  return `${OPEN}${q}${CLOSE}\n`;
}

/**
 * Everything the note editor needs for a note started from the Greek, or
 * null when the words hold no verse.
 *
 * @param {{ bookKey: string, chapter: number }} here the chapter shown
 * @param {{ w: any[], verse: number }[]} words the word chosen, or the words selected
 * @param {{ lead?: string, trail?: string }} [edges] greekQuote's: what a selection holds beyond its words
 * @returns {{ draft: { bookKey: string, chapter: number, verse: number, endVerse: number }, body: string } | null}
 */
export function noteFromGreek(here, words, edges) {
  const span = greekVerses(words);
  const body = greekNoteBody(greekQuote(words, edges));
  if (!here || !span || !body) return null;
  return { draft: { bookKey: here.bookKey, chapter: here.chapter, ...span }, body };
}

/**
 * The button's words: what it will do, and where the note goes.
 * @param {{ verse: number, endVerse: number }} span
 * @param {"word" | "selection"} from
 */
export function greekNoteLabel(span, from) {
  const where =
    span.endVerse && span.endVerse !== span.verse ? `verses ${span.verse}–${span.endVerse}` : `verse ${span.verse}`;
  return `Add a note on ${where} with ${from === "selection" ? "the selected Greek" : "this word"}`;
}
