// src/lib/desk-footnote-pills.mjs
//
// Where a footnote's Pin goes in Chapter View's Footnotes list
// (STUDY-DESK-FIXES.md, E49; BVJ, 2026-11-06). Pure: src/scripts/desk/
// footnote-pills.js measures the page and applies the answer, as
// desk-margin.mjs does for the Notebook panel.
//
// Pin belongs in the left margin, level with the footnote's first line, so no
// footnote grows and the note keeps the whole width. Two modes, by how much
// free margin the list has to its left:
//
//   "row"     Pin fits in the margin;
//   "inline"  it doesn't: Pin stays on the note's line, on its right (where
//             it sat before E49).
//
// Until 2026-11-10 "Add a note" sat beside Pin, and a third mode, "more",
// folded the two behind one "⋯" pill where only one fitted. Notes on a
// footnote can no longer be added (BVJ, 2026-11-10; STUDY-DESK-FIXES.md,
// E79), and one pill has nothing to fold.
//
// A footnote with one of the reader's margin notes beside it is drawn
// "inline" whatever the list's mode, since a margin note sits in that same
// left margin; that case is a class in desk.css and needs no rule here.

/** Between Pin's right edge and the footnote (the letter). */
export const PILL_OFFSET = 14;
/** Between Pin's left edge and the window's edge. */
export const PILL_EDGE = 8;
/**
 * The width used before Pin has been measured: the thumbtack and the word
 * "Pin" in Inter. A wider face, OpenDyslexic, is why the real width is
 * measured once it exists.
 */
export const PIN_FALLBACK = 56;

/**
 * @param {object} m
 * @param {number} m.free the list's left edge, in px from the window's left
 *   edge: the margin there is, with the column as the page has it now
 * @param {number} [m.width] Pin's width, measured
 * @returns {"row" | "inline"}
 */
export function footnotePillMode({ free, width = PIN_FALLBACK }) {
  return free >= Math.max(width, 0) + PILL_OFFSET + PILL_EDGE ? "row" : "inline";
}
