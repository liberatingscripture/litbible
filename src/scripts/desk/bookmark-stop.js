// src/scripts/desk/bookmark-stop.js
//
// "Stop following" (BVJ, 2026-11-04) and "Start following" (E44, 2026-11-05):
// ending a bookmark's moving by hand, and starting it without going through
// the list. Stopping ends this tab's follow (stopFollowing, bookmark-follow.js)
// and leaves the bookmark where it last was with "Move as I read" still on.
// The link is in the bookmark's row in the Notebook's lists, one link whose
// label says which; in the verse menu, "Start following" sits beside "Edit
// bookmark…" and the resting bookmark's "Leave it here" is the stop.

import { bookKeyToLabel } from "../../data/books.js";
import {
  drawFollowLink,
  followBookmark,
  isFollowedHere,
  isPausedHere,
  moveItHereNow,
  stopFollowing,
} from "./bookmark-follow.js";
import { announce, showUndo } from "./undo-bar.js";

/**
 * The bar shown once when a follow pauses (BVJ, 2026-11-04): the bookmark
 * waits where the reader left off while they look around, with a button to
 * bring it to where they are now.
 *
 * @param {{ record: object, move: () => Promise<boolean> }} about
 */
export function showPausedBar({ record, move }) {
  const name = record.label ? `“${record.label}”` : "Your bookmark";
  const where = `${bookKeyToLabel(record.bookKey)} ${record.chapter}:${record.verse}`;
  showUndo(`${name} is staying at ${where} while you look around.`, move, { label: "Move it here" });
}

/**
 * The row's "Move it here", shown only while the bookmark is paused: the same
 * as the bar's button, for a reader who didn't see the bar.
 */
export function moveItHereButton(bookmark, where = "") {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "desk-item__stop";
  b.textContent = "Move it here";
  // The visible words first, so "click Move it here" finds it (2.5.3; XA8-4); the
  // rest tells one row's button from another's.
  b.setAttribute("aria-label", `Move it here, the bookmark${where ? ` on ${where}` : ""}`);
  b.dataset.bookmarkMove = bookmark.id;
  b.hidden = !isPausedHere(bookmark.id);
  b.addEventListener("click", async (e) => {
    e.stopPropagation();
    const moved = await moveItHereNow();
    announce(moved ? "The bookmark moved here and follows again." : "Open a chapter to move it here.");
  });
  return b;
}

/** Press the button's work, said aloud. `where` names the verse ("Luke 1:1"). */
export function stopFollowingNow(where) {
  stopFollowing();
  announce(`The bookmark${where ? ` on ${where}` : ""} stopped following. It stays on its verse until you start it again.`);
}

/**
 * "Start following" (E44): the bookmark follows the reader from here, by the
 * rule opening it from the list follows (`followBookmark`: one tab at a time,
 * the flag in session storage). Only a bookmark with "Move as I read" on is
 * offered it, so it is already within the six that may move.
 *
 * @param {{ id: string, bookKey: string }} bookmark
 * @param {string} where the bookmark's reference ("Luke 1:1")
 */
export function startFollowingNow(bookmark, where) {
  followBookmark(bookmark);
  announce(`The bookmark${where ? ` on ${where}` : ""} is following you now.`);
}

/**
 * The row's quiet link for a bookmark with "Move as I read" on: "Stop
 * following" while this tab is moving it, else "Start following" (E44, BVJ
 * 2026-11-05: one link that swaps its label, not an On/Off switch, since a
 * follow is this tab's and the switch is the record's). syncBookmarkLines
 * redraws it as the flag changes.
 *
 * @param {{ id: string, bookKey: string }} bookmark
 * @param {string} where the bookmark's reference, for the accessible name
 */
export function followLinkButton(bookmark, where = "") {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "desk-item__stop";
  b.dataset.bookmarkFollowLink = bookmark.id;
  b.dataset.where = where;
  drawFollowLink(b);
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isFollowedHere(bookmark.id)) stopFollowingNow(where);
    else startFollowingNow(bookmark, where);
  });
  return b;
}
