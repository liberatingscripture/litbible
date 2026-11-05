// src/scripts/desk/move-redraw.js
//
// A bookmark that moves as the reader reads (E9) writes a new verse every few
// seconds, and the views that draw it in the margin stay quiet about that
// (QUIET_KINDS), or the mark would slide along under the reader with every
// scroll. BVJ's look, 2026-11-04: it should still catch up, as a jump once the
// reader has paused, not as a glide. So a view asks for one redraw
// `MOVE_SETTLE_MS` after the last move, longer than the gap between writes
// (MOVE_EVERY_MS, 4 s): it jumps when the reading pauses, and any other redraw
// puts it in its place sooner.

import { MOVE_KIND } from "../../lib/desk-store-core.mjs";

export const MOVE_SETTLE_MS = 5000;

/**
 * Call `redraw` once the bookmark has stopped moving for MOVE_SETTLE_MS.
 *
 * @param {{ subscribe: Function }} store
 * @param {() => void} redraw
 * @returns {() => void} stop listening
 */
export function redrawAfterMove(store, redraw) {
  let timer = 0;
  const off = store.subscribe(
    () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = 0;
        redraw();
      }, MOVE_SETTLE_MS);
    },
    { kinds: [MOVE_KIND] },
  );
  return () => {
    window.clearTimeout(timer);
    if (typeof off === "function") off();
  };
}
