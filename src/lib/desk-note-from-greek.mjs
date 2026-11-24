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
 * The Greek of some words, as it reads in the tab: each word with the
 * punctuation round it, spaces evened out, and the signs left out. A run that
 * crosses into another verse carries that verse's number before its first
 * word ("… λόγος. 2 οὗτος ἦν …"), as a copy of the tab's text does. One word
 * alone is the word, without the punctuation after it.
 *
 * @param {{ w: any[], verse: number }[]} words in reading order (flattenWords' items)
 * @returns {string}
 */
export function greekQuote(words) {
  const list = (words ?? []).filter((x) => x?.w);
  if (!list.length) return "";
  if (list.length === 1) return withoutSigns(String(list[0].w[W.text] ?? "")).trim();
  let s = "";
  let last = list[0].verse;
  for (const { w, verse } of list) {
    if (verse !== last) {
      s += ` ${verse} `;
      last = verse;
    }
    s += withoutSigns(`${w[W.pre] ?? ""}${w[W.text] ?? ""}${w[W.post] ?? ""}`);
  }
  return s.replace(/\s+/g, " ").trim();
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
 * @returns {{ draft: { bookKey: string, chapter: number, verse: number, endVerse: number }, body: string } | null}
 */
export function noteFromGreek(here, words) {
  const span = greekVerses(words);
  const body = greekNoteBody(greekQuote(words));
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
