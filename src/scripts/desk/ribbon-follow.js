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
// written at most once every few seconds and only when the verse changed.

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
import { loadLastRead } from "../last-read.js";

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
 * before the navigation; on the page the link stays on, the follower picks it
 * up at once.
 *
 * @param {{ id: string, bookKey: string }} ribbon
 */
export function followRibbon(ribbon) {
  writeFlag({ id: ribbon.id, bookKey: ribbon.bookKey });
  env?.restart();
}

/**
 * Start following on this page: drop the flag if the page is outside the
 * flagged book, and otherwise move the ribbon as the reader reads.
 *
 * @param {{ store: object | null, ctx: () => { client: string } }} options
 */
export function initRibbonFollow({ store, ctx }) {
  if (!store) return;
  const page = pageBookOf(window.location.pathname);
  writeFlag(nextRibbonState(readFlag(), page));

  let latest = null; // where the reader last was, as { bookKey, chapter, verse }
  let lastWrite = null;
  let timer = 0;

  async function flush() {
    timer = 0;
    // A ribbon opened into another book is about to be followed there, by the
    // page that loads next; this page's reading says nothing about it.
    if (!flag || !latest || latest.bookKey !== flag.bookKey) return;
    const record = await store.get(flag.id);
    // Deleted (or never a ribbon, or kept by a newer client): stop following.
    if (!isRibbon(record) || !canEdit(record)) {
      writeFlag(null);
      return;
    }
    const changes = ribbonMoveChanges(record, latest);
    if (!changes) return;
    lastWrite = Date.now();
    const next = editRecord(record, changes, { now: new Date().toISOString(), client: ctx().client });
    try {
      await store.commit({ put: [next], remove: [] }, { record: false });
    } catch (err) {
      console.error("Study Desk: the ribbon couldn't follow the reader", err);
    }
  }

  function schedule() {
    if (timer || !flag) return;
    timer = window.setTimeout(flush, throttleDelay(lastWrite, Date.now()));
  }

  function hear(position) {
    const pos = positionOnPage(position, page);
    if (!pos) return;
    latest = pos;
    schedule();
  }

  window.addEventListener("lit:last-read", (e) => hear(e.detail ? { ...e.detail } : null));
  // The arrival record was saved before this module loaded.
  const start = () => hear(loadLastRead());
  env = { restart: start };
  if (flag) start();
}
