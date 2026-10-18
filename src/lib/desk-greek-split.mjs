// src/lib/desk-greek-split.mjs
//
// The line between the Greek text and the word's entry in the Notebook's
// Greek tab is draggable (BVJ, 2026-10-17). The split is the entry's share of
// the room the two have together (the text's share is the rest), kept between
// a quarter and three quarters so neither can be dragged shut: a quarter
// Greek over three quarters entry, or the reverse, and everything between.
// Pure, so the rule is tested without a page (test/desk-greek-split.test.js);
// the handle is in src/scripts/desk/tab-greek.js.

export const MIN_SPLIT = 0.25;
export const MAX_SPLIT = 0.75;
/** One arrow-key press moves the line this much of the room; Shift takes five. */
export const SPLIT_STEP = 0.05;

/** A share held to its bounds; anything that isn't a number is no share (null). */
export function clampSplit(share) {
  if (typeof share !== "number" || !Number.isFinite(share)) return null;
  return Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, share));
}

/**
 * The entry's share when the line is dragged to `y`, in the same coordinates
 * as `top` and `bottom`, the room the text and the entry share together.
 * @returns {number | null} null where there is no room to measure
 */
export function splitFromPointer({ y, top, bottom }) {
  const room = bottom - top;
  if (!(room > 0)) return null;
  return clampSplit((bottom - y) / room);
}
