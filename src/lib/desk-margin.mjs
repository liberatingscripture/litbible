// src/lib/desk-margin.mjs
//
// Where the Study Desk's Notebook panel goes: in the right margin beside the
// reading column, so the text stays where it is (BVJ, 2026-10-06: "the
// notebook should fill the margin, not just push everything aside"). Pure:
// the shell (src/scripts/desk/margin.js) measures the page and applies the
// answer.
//
// The rule, in order:
//   1. The margin is wide enough (MIN_WIDTH): the panel fills it, from a gap
//      after the column to just short of the window's edge, up to MAX_WIDTH,
//      and keeps to the text's side when the margin is wider than that.
//      Nothing on the page moves.
//   2. It isn't: the column moves left only as far as the panel needs, and no
//      further than the column's own left margin allows. The page moves by
//      padding <main> on the right, which shifts a centred column by half the
//      padding, so `pad` is twice the move. The header never moves.
//   3. Even that isn't enough (a narrow window): the panel takes MIN_WIDTH at
//      the window's edge and lies over the ends of the lines (`over`).
// Only pages with a reading column have the panel at all
// (src/scripts/desk-frame.js, READING_SURFACES); BVJ, 2026-10-06.
//
// Vertically, the panel runs from level with the text (or EDGE from the top
// once the reader has scrolled past that) to EDGE above the bottom of the
// window, the same gap it keeps from the window's right edge.

export const GAP = 24; // between the column and the panel
export const EDGE = 16; // between the panel and the window's edge
export const MIN_WIDTH = 280;
export const MAX_WIDTH = 440;
export const MIN_HEIGHT = 240;

/**
 * @param {object} m measurements, in px from the viewport's left edge
 * @param {number} m.viewport the width the page lays out in (clientWidth)
 * @param {{ left: number, right: number }} m.column the reading column as
 *   measured now
 * @param {{ left: number }} m.main <main>'s box
 * @param {number} [m.pad] the padding currently applied to <main>, so the
 *   column's unmoved position can be worked out (it sits pad / 2 to the left)
 * @returns {{ left: number, width: number, pad: number, over: boolean }}
 *   the panel's left edge and width, the padding <main> should have, and
 *   whether the panel lies over the text
 */
export function placeInMargin({ viewport, column, main, pad = 0 }) {
  // Where the column would be with nothing moved.
  const left = column.left + pad / 2;
  const right = column.right + pad / 2;

  const room = viewport - EDGE - (right + GAP);
  if (room >= MIN_WIDTH) {
    return { left: right + GAP, width: Math.min(room, MAX_WIDTH), pad: 0, over: false };
  }

  const need = MIN_WIDTH - room;
  const canMove = Math.max(0, left - main.left);
  const move = Math.min(need, canMove);
  const width = Math.min(MIN_WIDTH, Math.max(0, viewport - 2 * EDGE));
  return {
    left: viewport - EDGE - width,
    width,
    pad: Math.round(2 * move),
    over: move < need,
  };
}

/**
 * The panel's height, given where its rail sits in the window: from its top
 * (never above EDGE, since the panel pins there) to EDGE above the window's
 * bottom. When the page's heading is low on the screen the panel is short,
 * and it grows as the reader scrolls.
 *
 * Once the rail's end is on screen (the footer coming into view), the panel
 * ends with it instead, but no shorter than MIN_HEIGHT (or the rail itself),
 * so it rides up with the page rather than shrinking to nothing.
 *
 * @param {{ top: number, bottom: number }} rail the rail's box in the window
 * @param {number} windowHeight
 */
export function panelHeight(rail, windowHeight) {
  const top = Math.max(EDGE, rail.top);
  const windowBottom = windowHeight - EDGE;
  if (rail.bottom >= windowBottom) return Math.round(Math.max(0, windowBottom - top));
  const floor = Math.min(MIN_HEIGHT, Math.max(0, rail.bottom - rail.top));
  return Math.round(Math.max(floor, rail.bottom - top));
}
