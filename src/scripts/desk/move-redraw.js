// src/scripts/desk/move-redraw.js
//
// A bookmark that moves as the reader reads (E9) writes a new verse every few
// seconds, and the views that draw it in the margin stay quiet about that
// (QUIET_KINDS), or the mark would slide along under the reader with every
// scroll. BVJ's look, 2026-11-04: it should still catch up, as a jump once the
// reader has paused, not as a glide. So a view asks for one redraw
// `MOVE_SETTLE_MS` after the last move: it jumps when the reading pauses, and
// any other redraw puts it in its place sooner. It was 5 seconds over a 4-second
// write gap, so the mark could lag nine seconds behind the reader; E45 (BVJ,
// 2026-11-05) shortens both: a 2-second write gap (MOVE_EVERY_MS) and a
// 2.5-second settle. The settle must stay longer than the gap, or steady
// scrolling, writing every 2 seconds, would redraw between two writes and the
// mark would step along rather than wait for a pause.

import { MOVE_KIND } from "../../lib/desk-store-core.mjs";

export const MOVE_SETTLE_MS = 2500;

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
