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
//      further than the column's own left margin allows. Only the column moves
//      (a translate on its own elements, so nothing reflows): the header, the
//      tool row and the full-width bands, the license band above the footer
//      among them, stay where they are and keep their full width. An earlier
//      version padded <main> instead, which cut the license band short.
//   3. Even that isn't enough (a narrow window): the panel floats (`over`).
//      It becomes a window the reader can expand and collapse (BVJ,
//      2026-10-07), placed by placeFloating below: expanded, it takes
//      MIN_WIDTH at the window's edge and lies over the ends of the lines;
//      collapsed, it is a tab at the window's edge that keeps clear of the
//      text.
// Only pages with a reading column have the panel at all
// (src/scripts/desk-frame.js, READING_SURFACES); BVJ, 2026-10-06.
//
// Vertically, the panel runs from level with the text (or EDGE from the top
// once the reader has scrolled past that) to EDGE above the bottom of the
// window, the same gap it keeps from the window's right edge.

export const GAP = 24; // between the column and the panel
export const EDGE = 16; // between the panel and the window's edge
// The narrowest the panel gets; where the margin is narrower, the text
// column moves instead. 220px was tried, which kept the text still down to
// about 1157px windows but left the panel noticeably narrow; BVJ chose the
// 280px panel with the column moving (2026-10-06). At the 52 measure the
// text moved from about 1205px windows down at the default size (58px at
// 1162px). Study View chapters narrow to 48 while the panel is open
// (2026-10-08): there nothing moves at 1280px, where the panel gets 304px;
// it gets 347px at 1366 and 384px at 1440.
export const MIN_WIDTH = 280;
export const MAX_WIDTH = 440;
export const MIN_HEIGHT = 240;

/**
 * @param {object} m measurements, in px from the viewport's left edge
 * @param {number} m.viewport the width the page lays out in (clientWidth)
 * @param {{ left: number, right: number }} m.column the reading column as
 *   measured now
 * @param {{ left: number }} m.main <main>'s box
 * @param {number} [m.shift] how far the column is moved left already, so its
 *   unmoved position can be worked out
 * @returns {{ left: number, width: number, shift: number, over: boolean }}
 *   the panel's left edge and width, how far left the column should be moved,
 *   and whether the panel lies over the text
 */
export function placeInMargin({ viewport, column, main, shift = 0 }) {
  // Where the column would be with nothing moved.
  const left = column.left + shift;
  const right = column.right + shift;

  const room = viewport - EDGE - (right + GAP);
  if (room >= MIN_WIDTH) {
    return { left: right + GAP, width: Math.min(room, MAX_WIDTH), shift: 0, over: false };
  }

  const need = MIN_WIDTH - room;
  const canMove = Math.max(0, left - main.left);
  const move = Math.min(need, canMove);
  const width = Math.min(MIN_WIDTH, Math.max(0, viewport - 2 * EDGE));
  return {
    left: viewport - EDGE - width,
    width,
    shift: Math.round(move),
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

/* ── A narrow window: the floating notebook ─────────────────────────── */

// The collapsed notebook: a tab at the window's right edge, TAB_EDGE from it
// and at least TAB_GAP from the text.
export const TAB_WIDTH = 40;
export const TAB_EDGE = 8;
export const TAB_GAP = 8;

/**
 * Where the floating notebook goes, once placeInMargin has said the margin
 * can't hold it (`over`). The column moves left only as far as the collapsed
 * tab needs, and moves the same whether the notebook is expanded or
 * collapsed, so expanding and collapsing it never moves the text under it.
 * Expanded, the panel lies over the ends of the lines, as a floating window
 * does; collapsed, the tab keeps clear of them (`tabOver` says it couldn't,
 * which takes very large text in a window well under 900px).
 *
 * @param {object} m the same measurements placeInMargin takes
 * @returns {{ panel: { left: number, width: number },
 *   tab: { left: number, width: number }, shift: number, tabOver: boolean }}
 */
export function placeFloating({ viewport, column, main, shift = 0 }) {
  const left = column.left + shift;
  const right = column.right + shift;
  const tabLeft = viewport - TAB_EDGE - TAB_WIDTH;
  const need = Math.max(0, right + TAB_GAP - tabLeft);
  const move = Math.min(need, Math.max(0, left - main.left));
  const width = Math.min(MIN_WIDTH, Math.max(0, viewport - 2 * EDGE));
  return {
    panel: { left: viewport - EDGE - width, width },
    tab: { left: tabLeft, width: TAB_WIDTH },
    shift: Math.round(move),
    tabOver: move < need,
  };
}

/**
 * Whether the open notebook is collapsed after a placement. It collapses
 * whenever it starts floating, so it never lands on the text unasked: a page
 * opening with the notebook remembered open, or a window narrowed under it.
 * The exception is the reader opening it just now, which asks to see it.
 * Otherwise it stays as the reader left it; in the margin it is never
 * collapsed.
 *
 * @param {{ floating: boolean, wasFloating: boolean, collapsed: boolean,
 *   opening: boolean }} s
 */
export function nextCollapsed({ floating, wasFloating, collapsed, opening }) {
  if (!floating) return false;
  if (opening) return false;
  if (!wasFloating) return true;
  return collapsed;
}
