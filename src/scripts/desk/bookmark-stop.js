// src/scripts/desk/bookmark-stop.js
//
// "Stop following" (BVJ, 2026-11-04): a way to end a bookmark's moving by
// hand. It stops this tab following (stopFollowing, bookmark-follow.js) and
// leaves the bookmark where it last was with "Move as I read" still on, so
// opening it from the list starts it again. The button is in the bookmark's row
// in the Notebook's lists and in the verse menu; it shows only while this tab
// is moving that bookmark.

import { bookKeyToLabel } from "../../data/books.js";
import { isFollowedHere, isPausedHere, moveItHereNow, stopFollowing } from "./bookmark-follow.js";
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
  b.setAttribute("aria-label", `Move the bookmark${where ? ` on ${where}` : ""} to where I am reading`);
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
  announce(`The bookmark${where ? ` on ${where}` : ""} stopped following. It stays on its verse until you open it from your list again.`);
}

/**
 * The row's button, hidden unless this tab is moving the bookmark;
 * syncBookmarkLines shows and hides it as the flag changes.
 *
 * @param {{ id: string }} bookmark
 * @param {string} where the bookmark's reference, for the accessible name
 */
export function stopFollowButton(bookmark, where = "") {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "desk-item__stop";
  b.textContent = "Stop following";
  b.setAttribute("aria-label", `Stop following the bookmark${where ? ` on ${where}` : ""}`);
  b.dataset.bookmarkStop = bookmark.id;
  b.hidden = !isFollowedHere(bookmark.id);
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    stopFollowingNow(where);
  });
  return b;
}
