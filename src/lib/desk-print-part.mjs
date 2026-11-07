// src/lib/desk-print-part.mjs
//
// The rules behind the verse menu's and the selection panel's "Print ▸"
// (STUDY-DESK-FIXES.md, E40): printing just some verses, or just the words
// selected, instead of the whole chapter. Pure and unit-tested. The page side
// is src/scripts/desk/print-part.js; the whole-chapter prints are
// desk-print-notes.mjs's.

/** What a part can be printed as: the plain text, with my notes, or with room to write. */
export const PART_KINDS = Object.freeze(["plain", "notes", "room"]);

/**
 * The items of the "Print ▸" flyout for a verse menu (`what` "verse") or a
 * selection panel ("selection"), in order. "These verses" for a range.
 * "With my notes" is left out where the browser keeps no notebook, as the
 * Print menu leaves it out.
 *
 * @param {{ what: "verse" | "selection", start?: number, end?: number, notebook?: boolean }} o
 * @returns {{ kind: "plain" | "notes" | "room", label: string }[]}
 */
export function partChoices({ what, start = 1, end = start, notebook = true }) {
  const noun = what === "selection" ? "This selection" : start === end ? "This verse" : "These verses";
  const labels = { plain: noun, notes: `${noun} with my notes`, room: `${noun} with room to write` };
  return PART_KINDS.filter((kind) => kind !== "notes" || notebook).map((kind) => ({ kind, label: labels[kind] }));
}

/**
 * Whether a record sits on any of the verses `start` to `end`. A record whose
 * verse is no number (from a newer schema, or a chapter-wide record) is not
 * on any.
 */
export function onVerses(record, start, end) {
  const first = record?.verse;
  if (!Number.isInteger(first)) return false;
  const last = Number.isInteger(record.endVerse) && record.endVerse >= first ? record.endVerse : first;
  return first <= end && last >= start;
}

/**
 * Which of a chapter's verse spans a print of verses `start` to `end` keeps.
 * `blocks` is, for each block of the chapter's text, the verse number of each
 * of its spans in order. A block with no kept span is dropped whole; inside a
 * kept block, a span of another verse is dropped on its own.
 *
 * @param {number[][]} blocks
 * @returns {{ any: boolean, keep: boolean[] }[]}
 */
export function planVerses(blocks, start, end) {
  return blocks.map((verses) => {
    const keep = verses.map((v) => Number.isInteger(v) && v >= start && v <= end);
    return { any: keep.some(Boolean), keep };
  });
}

/**
 * The footnotes a print of some spans cites: the ids (without "#") that the
 * spans' footnote links point to, in order and without repeats.
 *
 * @param {string[]} hrefs each footnote link's href in the kept spans
 */
export function citedFootnoteIds(hrefs) {
  const ids = [];
  for (const href of hrefs) {
    const id = String(href ?? "").replace(/^#/, "");
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** The heading printed above a part: the reference, then the translation's name. */
export function partHeading(ref) {
  return `${ref} (LIT)`;
}

/** The title over the notes printed after a selection's words. */
export const SELECTION_NOTES_TITLE = "My notes";

/**
 * The notes a part prints: live notes on its verses (the caller has already
 * limited the records to the chapter), a note on a footnote included when its
 * footnote's verse is among them.
 */
export function notesForPart(records, start, end) {
  return records.filter((r) => r?.kind === "note" && onVerses(r, start, end));
}
