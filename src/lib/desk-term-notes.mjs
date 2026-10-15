// src/lib/desk-term-notes.mjs
//
// "Your note on a term, on its /glossary entry" (STUDY-DESK.md M10): under a
// glossary entry, the reader's notes made on that term's words in scripture.
// Pure: records and an entry's occurrences in, notes out. The page supplies
// the occurrences from what /glossary already carries ("Where it appears":
// a link per verse, plus the words as printed where they differ from the
// rendering's label), so nothing new is shipped for it.
//
// "On the term" means two things at once, so a note on a verse that merely
// has the term in it doesn't count:
//   - the note sits on a verse (or a run of verses) where the entry's gated
//     occurrences are, and
//   - the words the note quotes (`quote.exact`) contain the words the LIT
//     printed there for the term.
// A note on a whole verse carries no quote and so never counts: nothing says
// which of the verse's words it is about. Notes on a glossary entry or an
// article (N11) are the entry's own, already shown in its margin, and are
// left out here.
//
// Words are compared with case and typography evened out (a curly apostrophe
// against a straight one, an en dash against a hyphen), and a rendering found
// inside a longer word counts ("trust" in "entrust"), since a note that was
// made on the term's words is better shown than hidden. A split rendering
// ("speaks about … contemptuously") matches when the quote holds every piece.

import { wordingKey } from "./desk-wording.mjs";
import { liveRecords } from "./desk-store-core.mjs";

/** The mark between the pieces of a split rendering (alignment `term.form`). */
const GAP = /\s*(?:…|\.{3})\s*/;

/** A rendering's words, folded for comparing. */
const fold = (text) => wordingKey(text).toLowerCase();

/**
 * One rendering as its pieces: "speaks about … contemptuously" becomes
 * ["speaks about", "contemptuously"], "self-preservation" one piece.
 */
export function renderingPieces(rendering) {
  return String(rendering ?? "")
    .split(GAP)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * The renderings printed at one verse, from the entry's rendering label and
 * the page's `data-words` (variants joined by "|", the pieces of a split one
 * by " … "). With no variants the label itself was printed.
 *
 * @param {string} label the rendering's label (`term.form`)
 * @param {string | null | undefined} words the verse's `data-words`
 * @returns {string[][]} each rendering as its pieces
 */
export function renderingsAt(label, words) {
  const printed = words ? words.split("|") : [label];
  return printed.map(renderingPieces).filter((pieces) => pieces.length);
}

const HREF = /^\/([a-z0-9]+)-(\d+)\/#v(\d+)$/;

/** The verse an occurrence link names (`/romans-8/#v3`), or null. */
export function parseVerseHref(href) {
  const m = HREF.exec(String(href ?? ""));
  return m ? { bookKey: m[1], chapter: Number(m[2]), verse: Number(m[3]) } : null;
}

/**
 * Fold an entry's occurrence links into one entry per verse: the same verse
 * can be listed under several renderings of a term, and a note on it matches
 * any of them.
 *
 * @param {{ bookKey: string, chapter: number, verse: number, renderings: string[][] }[]} found
 * @returns {Map<string, { renderings: string[][] }>} keyed by `book-chapter:verse`
 */
export function occurrenceIndex(found) {
  const out = new Map();
  for (const { bookKey, chapter, verse, renderings } of found) {
    const key = `${bookKey}-${chapter}:${verse}`;
    const at = out.get(key) ?? { renderings: [] };
    at.renderings.push(...renderings);
    out.set(key, at);
  }
  return out;
}

/** Whether a quotation holds every piece of a rendering. */
export function quoteHolds(quote, pieces) {
  const words = fold(quote);
  return pieces.length > 0 && pieces.every((p) => words.includes(fold(p)));
}

/**
 * The reader's notes made on a term's words, in Bible order.
 *
 * @param {object[]} records the notebook
 * @param {Map<string, { renderings: string[][] }>} index from occurrenceIndex
 * @returns {object[]} note records
 */
export function termNotes(records, index) {
  if (!index.size) return [];
  const notes = (records ?? []).filter(
    (r) =>
      r &&
      r.kind === "note" &&
      !r.deleted &&
      typeof r.bookKey === "string" &&
      Number.isInteger(r.chapter) &&
      Number.isInteger(r.verse) &&
      typeof r.quote?.exact === "string" &&
      r.quote.exact &&
      !r.glossaryEntry &&
      !r.article &&
      !r.glossaryId,
  );
  return liveRecords(notes).filter((note) => {
    const last = Number.isInteger(note.endVerse) && note.endVerse >= note.verse ? note.endVerse : note.verse;
    for (let v = note.verse; v <= last; v++) {
      const at = index.get(`${note.bookKey}-${note.chapter}:${v}`);
      if (at?.renderings.some((pieces) => quoteHolds(note.quote.exact, pieces))) return true;
    }
    return false;
  });
}
