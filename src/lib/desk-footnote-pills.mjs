// src/lib/desk-footnote-pills.mjs
//
// Where a footnote's Pin goes in Chapter View's Footnotes list
// (STUDY-DESK-FIXES.md, E49; BVJ, 2026-11-06). Pure: src/scripts/desk/
// footnote-pills.js measures the page and applies the answer, as
// desk-margin.mjs does for the Notebook panel.
//
// Pin belongs in the left margin, level with the footnote's first line, so no
// footnote grows and the note keeps the whole width. **It never moves to the
// note's right** (BVJ, 2026-11-10; E81). Two modes, by how much free margin
// the list has to its left:
//
//   "row"    Pin fits with its word, the thumbtack and "Pin";
//   "glyph"  it doesn't: the word goes and the thumbtack alone stays.
//
// The margin is kept wide enough for the thumbtack: desk-margin.mjs moves and
// widens the column no further than PIN_MARGIN allows (its `keepLeft`). Where
// the window itself leaves less (a narrow window, a large text size), nothing
// the desk moved is to blame, and the list is indented by what is missing
// (`indent`), so Pin still sits on the left and inside the window.
//
// Until 2026-11-10 "Add a note" sat beside Pin, a third mode, "more", folded
// the two behind one "⋯" pill where only one fitted, and a footnote with a
// margin note beside it kept Pin on the note's line ("inline", which E81
// retired). Notes on a footnote were removed then (E79).

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
 * Pin with the thumbtack alone: its 14px glyph, 8px of padding each side and
 * the 1px border (.desk-pin--glyph in desk.css). No face changes it.
 */
export const GLYPH_WIDTH = 32;
/** The left margin a footnote needs for the thumbtack alone. */
export const PIN_MARGIN = GLYPH_WIDTH + PILL_OFFSET + PILL_EDGE;

/**
 * @param {object} m
 * @param {number} m.free the footnotes' left edge, in px from the window's
 *   left edge and before any indent: the margin there is, with the column as
 *   the page has it now
 * @param {number} [m.width] Pin's width with its word, measured
 * @returns {{ mode: "row" | "glyph", indent: number }} `indent` is how far
 *   right the list moves so the thumbtack fits, in px; 0 wherever the margin
 *   holds it
 */
export function footnotePillPlace({ free, width = PIN_FALLBACK }) {
  if (free >= Math.max(width, 0) + PILL_OFFSET + PILL_EDGE) return { mode: "row", indent: 0 };
  return { mode: "glyph", indent: Math.max(0, Math.ceil(PIN_MARGIN - free)) };
}
