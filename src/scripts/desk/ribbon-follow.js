// src/scripts/desk/ribbon-follow.js
//
// A ribbon that follows the reader (STUDY-DESK.md B1, audit C25): open a book
// through "Thursday group" in the Places group and that ribbon moves to where
// they read until they leave the book. Otherwise only Continue reading moves.
//
// The rule is src/lib/desk-places.mjs. This file keeps the tab's flag
// (sessionStorage['lit-desk-ribbon']: the ribbon's id and its book), clears it
// on the first page outside that book, and listens for the one signal both
// views already send, `lit:last-read` (last-read.js, from Study View's
// scrolling and from Read View's saves), to write the ribbon's new verse.
//
// Moving is the reader reading, so it edits the record (`modified` moves, and
// a copy of the notebook elsewhere will see the ribbon moved) but is written
// with `record: false`: it makes no history entry, since Ctrl+Z would
// otherwise undo reading instead of the reader's last deliberate change. It is
// written at most once every few seconds and only when the verse changed, and
// read and written in one transaction, so a rename made in another tab in
// between isn't saved over (BA102).
//
// It moves only to where *this page* says the reader is (pageLastRead and the
// event), never to what storage holds: `lit_last_read` is shared by every tab
// and outlives the page, so it can be another tab's place in the book or the
// reader's place before they followed the link (BA99, BA100). Pages without
// the shell drop the flag in desk-gate.js (BA101).

import { canEdit, editRecord } from "../../lib/desk-records.mjs";
import {
  RIBBON_FLAG_KEY,
  isRibbon,
  nextRibbonState,
  pageBookOf,
  parseRibbonFlag,
  positionOnPage,
  ribbonFlagFor,
  ribbonMoveChanges,
  throttleDelay,
} from "../../lib/desk-places.mjs";
import { pageLastRead } from "../last-read.js";

/** The flag as this tab holds it now; null when no ribbon is following. */
let flag = null;
/** Set by initRibbonFollow, so a link followed on this page can start a ribbon moving at once. */
let env = null;

function readFlag() {
  try {
    return parseRibbonFlag(window.sessionStorage.getItem(RIBBON_FLAG_KEY));
  } catch {
    return null;
  }
}

function writeFlag(next) {
  flag = next;
  try {
    if (next) window.sessionStorage.setItem(RIBBON_FLAG_KEY, ribbonFlagFor({ id: next.id, bookKey: next.bookKey }));
    else window.sessionStorage.removeItem(RIBBON_FLAG_KEY);
  } catch {
    /* no session storage: the ribbon simply doesn't follow */
  }
}

/**
 * The reader followed this ribbon's link from the Places group: from now on,
 * while they stay in its book in this tab, it moves with them. Call just
 * before the navigation, with the link's address. Where the reader was
 * before the link is not where the ribbon goes (BA99): a link within this
 * page moves the ribbon at the page's next report of where the reader is,
 * after the jump, and a link to another page leaves the moving to that page.
 *
 * @param {{ id: string, bookKey: string }} ribbon
 * @param {string | null} [href] the link's address
 */
export function followRibbon(ribbon, href = null) {
  writeFlag({ id: ribbon.id, bookKey: ribbon.bookKey });
  env?.followed(href);
}

/** Whether `href` is this page, its hash aside. */
function onThisPage(href) {
  try {
    const url = new URL(href, window.location.href);
    const path = (p) => p.replace(/\/+$/, "");
    return url.origin === window.location.origin && path(url.pathname) === path(window.location.pathname);
  } catch {
    return false;
  }
}

/**
 * Start following on this page: drop the flag if the page is outside the
 * flagged book, and otherwise move the ribbon as the reader reads.
 *
 * @param {{ store: object | null, ctx: () => { client: string } }} options
 */
export function initRibbonFollow({ store, ctx }) {
  const page = pageBookOf(window.location.pathname);
  // Dropped on a page outside the book even when the notebook didn't open.
  writeFlag(nextRibbonState(readFlag(), page));
  if (!store) return;

  let latest = null; // where the reader last was, as { bookKey, chapter, verse }
  let lastWrite = null;
  let timer = 0;
  // The reader followed a ribbon off this page: what it reports now, as it
  // goes (its pagehide save), is where they were, not where the ribbon goes.
  let leaving = false;

  async function flush() {
    timer = 0;
    // A ribbon opened into another book is about to be followed there, by the
    // page that loads next; this page's reading says nothing about it.
    if (!flag || !latest || latest.bookKey !== flag.bookKey) return;
    const id = flag.id;
    const pos = latest;
    let gone = false;
    let moved = false;
    try {
      await store.change(
        async ({ get }) => {
          const record = await get(id);
          // Deleted (or never a ribbon, or kept by a newer client): stop following.
          if (!isRibbon(record) || !canEdit(record)) {
            gone = true;
            return null;
          }
          const changes = ribbonMoveChanges(record, pos);
          if (!changes) return null;
          moved = true;
          const next = editRecord(record, changes, { now: new Date().toISOString(), client: ctx().client });
          return { put: [next], remove: [] };
        },
        { record: false },
      );
    } catch (err) {
      console.error("Study Desk: the ribbon couldn't follow the reader", err);
    }
    if (moved) lastWrite = Date.now();
    if (gone && flag?.id === id) writeFlag(null);
  }

  function schedule() {
    if (timer || !flag) return;
    timer = window.setTimeout(flush, throttleDelay(lastWrite, Date.now()));
  }

  function hear(position) {
    if (leaving) return;
    const pos = positionOnPage(position, page);
    if (!pos) return;
    latest = pos;
    schedule();
  }

  /** Forget where the reader was; for a link off the page, stop listening. */
  function followed(href) {
    window.clearTimeout(timer);
    timer = 0;
    latest = null;
    leaving = href != null && !onThisPage(href);
  }

  window.addEventListener("lit:last-read", (e) => hear(e.detail ? { ...e.detail } : null));
  // Back to this page from the back-forward cache: the tab may have left the
  // book since, and the flag in session storage says so (BA101).
  window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    followed(null);
    writeFlag(nextRibbonState(readFlag(), page));
  });
  env = { followed };
  // This page may have said where the reader is before this module loaded.
  if (flag) hear(pageLastRead());
}
