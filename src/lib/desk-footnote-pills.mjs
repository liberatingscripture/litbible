// src/lib/desk-footnote-pills.mjs
//
// Where a footnote's Pin and "+ Note" go in Chapter View's Footnotes list
// (STUDY-DESK-FIXES.md, E49; BVJ, 2026-11-06). Pure: src/scripts/desk/
// footnote-pills.js measures the page and applies the answer, as
// desk-margin.mjs does for the Notebook panel.
//
// The pills belong in the left margin, side by side and level with the
// footnote's first line, so no footnote grows and the note keeps the whole
// width. Three modes, by how much free margin the list has to its left:
//
//   "row"     both pills fit side by side in the margin;
//   "more"    only a narrow stack fits: one small "⋯" pill sits in the
//             margin and opens the two stacked under it;
//   "inline"  even that doesn't fit: the pills stay on the note's line, on
//             its right (where they sat before E49).
//
// A footnote with one of the reader's margin notes beside it is drawn
// "inline" whatever the list's mode, since a margin note sits in that same
// left margin; that case is a class in desk.css and needs no rule here.

/** Between the pills' right edge and the footnote (the letter). */
export const PILL_OFFSET = 14;
/** Between the pills' left edge and the window's edge. */
export const PILL_EDGE = 8;
/** Between the two pills in a row. */
export const PILL_GAP = 4;
/**
 * Widths used before the buttons have been measured (Pin is a 32px glyph
 * pill, "+ Note" about 56px in Inter; a wider face, OpenDyslexic, is why the
 * real widths are measured once they exist).
 */
export const ROW_FALLBACK = 96;
export const STACK_FALLBACK = 60;

/**
 * @param {object} m
 * @param {number} m.free the list's left edge, in px from the window's left
 *   edge: the margin there is, with the column as the page has it now
 * @param {number} [m.row] the two pills side by side, measured
 * @param {number} [m.stack] the wider of the two, which is what the opened
 *   "⋯" stack needs (the "⋯" pill itself is narrower)
 * @returns {"row" | "more" | "inline"}
 */
export function footnotePillMode({ free, row = ROW_FALLBACK, stack = STACK_FALLBACK }) {
  const fits = (width) => free >= width + PILL_OFFSET + PILL_EDGE;
  if (fits(Math.max(row, 0))) return "row";
  if (fits(Math.max(stack, 0))) return "more";
  return "inline";
}
