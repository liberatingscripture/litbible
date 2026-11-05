// src/scripts/desk/bookmark-mark.js
//
// How a bookmark's mark in the margin looks and is named (BVJ, 2026-11-04): red
// for a bookmark that moves, gold for one that stays put, so which is which
// shows at a glance, and an outline for the one this tab is following (or has
// paused), which only rests at its verse until the follow ends. The colour is
// never the only cue: the mark's name says it too.

import { restingId } from "./bookmark-follow.js";

/**
 * @param {{ id: string, follow?: boolean }} record
 * @param {string} ref the verse, "Luke 1:2"
 * @returns {{ className: string, name: string }}
 */
export function markLook(record, ref) {
  if (restingId() === record.id) {
    return {
      className: "desk-bookmark-mark desk-bookmark-mark--resting",
      name: `Bookmark that moves, resting here while it follows you, ${ref}`,
    };
  }
  return record.follow === true
    ? { className: "desk-bookmark-mark desk-bookmark-mark--moves", name: `Bookmark that moves, ${ref}` }
    : { className: "desk-bookmark-mark desk-bookmark-mark--stays", name: `Bookmark that stays put, ${ref}` };
}
