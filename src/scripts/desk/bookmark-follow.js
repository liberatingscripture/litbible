// src/scripts/desk/bookmark-follow.js
//
// A bookmark that moves as the reader reads (STUDY-DESK-FIXES.md E9, which took up B1;
// audit C25): with "Move as I read" on, open a book through "Thursday group" in
// the Notebook's list and that bookmark moves to where they read until they
// leave the book. Otherwise a bookmark stays put, and only Continue reading
// moves.
//
// The rule is src/lib/desk-bookmarks.mjs. This file keeps the tab's flag
// (sessionStorage['lit-desk-follow']: the bookmark's id and its book), clears it
// on the first page outside that book, and listens for the one signal both
// views already send, `lit:last-read` (last-read.js, from Chapter View's
// scrolling and from Read View's saves), to write the bookmark's new verse.
//
// Moving is the reader reading, so it edits the record (`modified` moves, and
// a copy of the notebook elsewhere will see the bookmark moved) but is written
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
// the shell pause the flag in desk-gate.js (BA101), except /desk.
//
// /desk follows too (E28, BVJ 2026-11-06): desk-page.js runs this with a
// position source of its own (`page: DESK_PAGE`, `place`) rather than
// `lit:last-read`, which would also move Continue reading, and reports the
// leading LIT pane's place as it changes (`hear`) and a change of which pane
// leads (`lead`, which pauses). The rules are the same as on a chapter page.
//
// One tab follows a bookmark at a time. Duplicate tab copies session storage,
// so the flag names its tab (a token), and a page that loads with it asks on
// FOLLOW_TAB_CHANNEL whether a live page holds that token; one that does
// answers, and the asking tab, the copy, drops the flag. Following a link
// announces it, and any other tab following that bookmark stops (loseFollow).

import { canEdit, editRecord } from "../../lib/desk-records.mjs";
import {
  DUPLICATE_WAIT_MS,
  FOLLOW_FLAG_KEY,
  FOLLOW_TAB_CHANNEL,
  isFollowing,
  loseFollow,
  nextFollowState,
  pageBookOf,
  parseFollowFlag,
  pausedFlag,
  positionOnPage,
  resumedFlag,
  followFlagFor,
  followMoveChanges,
  followStep,
  throttleDelay,
} from "../../lib/desk-bookmarks.mjs";
import { MOVE_KIND } from "../../lib/desk-store-core.mjs";
import { pageLastRead } from "../last-read.js";
import { glyph } from "./glyphs.js";

/** The flag as this tab holds it now; null when no bookmark is following. */
let flag = null;
/** Set by initBookmarkFollow, so a link followed on this page can start a bookmark moving at once. */
let env = null;
/** FOLLOW_TAB_CHANNEL, opened once; null where the browser has none. */
let channel = null;

function openChannel() {
  if (channel || typeof BroadcastChannel !== "function") return channel;
  try {
    channel = new BroadcastChannel(FOLLOW_TAB_CHANNEL);
  } catch {
    channel = null;
  }
  return channel;
}

const newTab = () => globalThis.crypto?.randomUUID?.() ?? `t${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

function readFlag() {
  try {
    return parseFollowFlag(window.sessionStorage.getItem(FOLLOW_FLAG_KEY));
  } catch {
    return null;
  }
}

/** Sent on `window` whenever this tab's flag changes, so the margin can draw the resting mark. */
export const FOLLOW_CHANGED = "desk:follow-changed";

function writeFlag(next) {
  flag = next;
  try {
    if (next) window.sessionStorage.setItem(FOLLOW_FLAG_KEY, followFlagFor(next));
    else window.sessionStorage.removeItem(FOLLOW_FLAG_KEY);
  } catch {
    /* no session storage: the bookmark simply doesn't follow */
  }
  try {
    window.dispatchEvent(new Event(FOLLOW_CHANGED));
  } catch {
    /* a stand-in window with no events */
  }
}

/**
 * What a bookmark's row says about whether it moves (BVJ, 2026-11-04): one
 * short word so the line never wraps in the Notebook's narrow list ("Bookmark ·
 * Following" is the longest), and the fuller sentence as the line's hover text.
 * "Following" is while this tab is moving it, "Moves" is a bookmark with the
 * switch on, "Stays put" one without. The words are an Opus agent's, who advised
 * against "Smart" and "Static". A row says it as drawn; the next redraw updates it.
 *
 * @param {{ id: string }} bookmark
 * @returns {{ word: string, title: string }}
 */
export function bookmarkState(bookmark) {
  if (!isFollowing(bookmark)) return { word: "Stays put", title: "Stays on its verse" };
  const mine = readFlag();
  if (mine?.id !== bookmark.id) return { word: "Moves", title: "Moves as I read, once it’s following me" };
  return mine.paused
    ? { word: "Paused", title: "Waiting where I left off. It moves again when I read on from there, or I can move it here." }
    : { word: "Following", title: "Following me now: it moves as I read in this tab" };
}

/**
 * The bookmark this tab is following or has paused, or null. While it is,
 * it only rests at its verse: it doesn't belong to it, so the verse's menu
 * and the one-bookmark-of-each-kind rule leave it out (BVJ, 2026-11-04).
 */
export function restingId() {
  return readFlag()?.id ?? null;
}

/** Whether the flag for `id` is a paused follow. */
export function isPausedHere(id) {
  const mine = readFlag();
  return mine?.id === id && mine.paused === true;
}

/**
 * How a bookmark's mark looks (BVJ, 2026-11-04): "resting" for the one this tab
 * is following or has paused (an outline), "moves" (red) or "stays" (gold).
 * bookmark-mark.js names the margin's marks from it, and a row's line draws its
 * glyph from it, so the colors are the same wherever a bookmark shows (E28).
 *
 * @param {{ id: string, follow?: boolean }} bookmark
 * @returns {"resting" | "moves" | "stays"}
 */
export function bookmarkLook(bookmark) {
  if (restingId() === bookmark.id) return "resting";
  return bookmark.follow === true ? "moves" : "stays";
}

/**
 * Write a bookmark row's "Bookmark · …" line into `el`, led by the bookmark's
 * mark in its color (E28; the words say the same, so the color is never the
 * only cue), and remember what it needs to be written again
 * (`syncBookmarkLines`).
 *
 * @param {HTMLElement} el the row's kind line
 * @param {{ id: string, follow?: boolean }} bookmark
 * @param {string} name what the row calls the kind ("Bookmark")
 */
export function drawBookmarkLine(el, bookmark, name = "Bookmark") {
  el.dataset.bookmark = bookmark.id;
  el.dataset.moves = bookmark.follow === true ? "1" : "0";
  el.dataset.kindName = name;
  const { word, title } = bookmarkState({ id: bookmark.id, kind: "bookmark", follow: bookmark.follow });
  el.innerHTML = glyph("bookmark", `desk-glyph desk-bookmark-glyph desk-bookmark-glyph--${bookmarkLook(bookmark)}`);
  el.append(`${name} · ${word}`);
  el.title = title;
}

/** Whether this tab is moving the bookmark `id` right now. */
export function isFollowedHere(id) {
  return readFlag()?.id === id;
}

/**
 * The quiet link under a moving bookmark's line (E44, BVJ 2026-11-05): "Stop
 * following" while this tab is moving it, "Start following" otherwise. Starting
 * needs a page that follows the reader (`followsHere`), so elsewhere
 * (/notebook) only the stop shows; opening the bookmark from the list still
 * starts it there.
 *
 * @param {HTMLElement} el a link made by bookmark-stop.js's followLinkButton
 */
export function drawFollowLink(el) {
  const id = el.dataset.bookmarkFollowLink;
  const where = el.dataset.where ?? "";
  const on = isFollowedHere(id);
  el.hidden = !on && !followsHere();
  el.textContent = on ? "Stop following" : "Start following";
  el.setAttribute("aria-label", `${on ? "Stop" : "Start"} following the bookmark${where ? ` on ${where}` : ""}`);
}

/** Draw every bookmark line on the page again, after the tab's flag changed. */
export function syncBookmarkLines(root = document) {
  // Each moving bookmark's link says "Stop following" or "Start following",
  // and "Move it here" shows only while it is paused.
  for (const el of root?.querySelectorAll?.("[data-bookmark-follow-link]") ?? []) drawFollowLink(el);
  for (const el of root?.querySelectorAll?.("[data-bookmark-move]") ?? []) {
    el.hidden = !isPausedHere(el.dataset.bookmarkMove);
  }
  // A page with no list drawn (and a test's stand-in document) has no lines to redraw.
  for (const el of root?.querySelectorAll?.("[data-bookmark]") ?? []) {
    drawBookmarkLine(el, { id: el.dataset.bookmark, follow: el.dataset.moves === "1" }, el.dataset.kindName);
  }
}

/**
 * "Move it here" from a row or the verse menu: the paused bookmark goes to
 * where the reader is on this page (on /desk, the leading LIT pane's place).
 * False where this page can't say (no shell).
 */
export async function moveItHereNow() {
  return env ? env.moveItHere() : false;
}

/**
 * Stop whatever is moving in this tab: the reader asked ("Stop following",
 * BVJ 2026-11-04), or followed a bookmark's link that doesn't move, since they
 * have left it for another place in the book. The bookmark keeps "Move as I
 * read" on and stays where it last was; "Start following", or opening it from
 * the list, starts it again. A moving bookmark's link takes over through
 * `followBookmark`.
 */
export function stopFollowing() {
  if (!flag && !readFlag()) return;
  dropFlag();
}

/** The tab stops moving anything, and every row's line and button say so. */
function dropFlag() {
  writeFlag(null);
  syncBookmarkLines();
}

/**
 * Whether the page this tab is on follows the reader at all: true on a chapter
 * page, Read View and /desk (E28), false on pages that set up no follower
 * (/notebook), where a link opened in place moves nothing, so a row must not
 * start a follow it can't carry out.
 */
export function followsHere() {
  return env != null;
}

/**
 * The reader followed this bookmark's link from the Notebook's list: from now on,
 * while they stay in its book in this tab, it moves with them. Call just
 * before the navigation, with the link's address. Where the reader was
 * before the link is not where the bookmark goes (BA99): a link within this
 * page moves the bookmark at the page's next report of where the reader is,
 * after the jump, and a link to another page leaves the moving to that page.
 * "Start following" (E44, E47) calls it with no link: the reader stays where
 * they are, and the next report decides (reading on from the bookmark moves
 * it; anywhere else pauses it and offers "Move it here").
 *
 * @param {{ id: string, bookKey: string }} bookmark
 * @param {string | null} [href] the link's address
 */
export function followBookmark(bookmark, href = null) {
  writeFlag({ id: bookmark.id, bookKey: bookmark.bookKey, tab: newTab() });
  // Any other tab following this bookmark stops: the link opened last wins.
  try {
    openChannel()?.postMessage({ took: flag.id, tab: flag.tab });
  } catch {
    /* the other tab keeps following until it leaves the book */
  }
  syncBookmarkLines();
  env?.followed(href);
}

/**
 * The reader moved the bookmark this tab follows to another verse in its form
 * (E46): its resting place goes with it, in whichever book that is, and the
 * next report of where the reader is is judged from there, as a fresh follow's
 * is (reading on from it moves it; anywhere else pauses it).
 *
 * @param {string} id
 * @param {string} bookKey the book it is in now
 */
export function restedAt(id, bookKey) {
  const mine = readFlag();
  if (mine?.id !== id) return;
  writeFlag({ ...mine, bookKey });
  env?.followed(null);
  syncBookmarkLines();
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
 * flagged book, and otherwise move the bookmark as the reader reads.
 *
 * @param {{ store: object | null, ctx: () => { client: string }, tell?: (about: object) => void,
 *   page?: object | null, place?: (() => object | null) | null }} options
 *   `tell` is called once when a follow pauses, to show the reader the bar that
 *   offers to move the bookmark where they are ({ record, pos, move }).
 *   `page` and `place` are for a page that says where its reader is itself
 *   (/desk: DESK_PAGE, and the leading LIT pane's place now, in last-read's
 *   shape): it reports through the functions returned, and `lit:last-read`
 *   isn't heard.
 * @returns {{ hear: (position: object | null) => void, lead: (position: object | null) => void } | null}
 *   `hear` takes a report of where the reader is; `lead` one from a LIT pane
 *   that has just become the leading one, which pauses the follow (E28). Null
 *   without a store.
 */
export function initBookmarkFollow({ store, ctx, tell = null, page: pageKind = null, place = null }) {
  const page = pageKind ?? pageBookOf(window.location.pathname);
  // Dropped on a page outside the book even when the notebook didn't open.
  writeFlag(nextFollowState(readFlag()));
  // A flag stored before tokens gets one; there is nothing to ask about it.
  if (flag && !flag.tab) writeFlag({ ...flag, tab: newTab() });
  const ch = openChannel();
  let asking = null; // the token this page is asking about, until the wait ends
  let settled = Promise.resolve();
  if (ch) {
    ch.addEventListener("message", (e) => {
      const msg = e.data;
      if (msg && typeof msg === "object" && typeof msg.ask === "string" && flag?.tab === msg.ask && asking == null) {
        ch.postMessage({ taken: msg.ask });
        return;
      }
      if (loseFollow(flag, msg)) dropFlag();
    });
    if (flag) {
      asking = flag.tab;
      ch.postMessage({ ask: asking });
      settled = new Promise((resolve) => window.setTimeout(resolve, DUPLICATE_WAIT_MS)).then(() => {
        asking = null;
      });
    }
  }
  if (!store) return null;

  let latest = null; // where the reader last was, as { bookKey, chapter, verse }
  // The report waiting to be judged came from a pane that has just become the
  // leading one (/desk): it pauses, whatever reports join it before the check.
  let newLead = false;
  // The last report the follower accepted as reading, for telling a scroll from a
  // jump (Read View's long page). Set only when a report is judged, never as it
  // arrives: a page that lands on a far verse reports twice before the first
  // judgment, and the second would count the first as reading and move the
  // bookmark there instead of pausing it.
  let heard = null;
  let lastWrite = null;
  let timer = 0;
  // The reader followed a bookmark off this page: what it reports now, as it
  // goes (its pagehide save), is where they were, not where the bookmark goes.
  let leaving = false;

  async function flush() {
    timer = 0;
    // Not before this page knows whether its tab is a copy.
    await settled;
    if (!flag || !latest) return;
    const id = flag.id;
    const pos = latest;
    const before = heard;
    const leading = newLead;
    newLead = false;
    let gone = false;
    let moved = false;
    let step = null;
    let held = null;
    try {
      await store.change(
        async ({ get }) => {
          const record = await get(id);
          // Deleted (or no longer moving, or kept by a newer client): stop following.
          if (!isFollowing(record) || !canEdit(record)) {
            gone = true;
            return null;
          }
          held = record;
          // Reading on moves it; a jump (a far chapter, another book) pauses it
          // where it was, and reading on from there resumes it (BVJ, 2026-11-04).
          step = followStep(flag, record, pos, before, { newLead: leading });
          if (step === "pause" || step === "stay") return null;
          const changes = followMoveChanges(record, pos);
          if (!changes) return null;
          moved = true;
          // A move writes the place group only (bookKey, chapter, verses and the text they were read on),
          // so editRecord stamps `placedAt` and leaves `editedAt` alone (DI3-3).
          const next = editRecord(record, { ...changes, contentVersion: ctx().contentVersion }, { now: new Date().toISOString(), client: ctx().client });
          return { put: [next], remove: [] };
        },
        { record: false, kinds: [MOVE_KIND] },
      );
    } catch (err) {
      console.error("Study Desk: the bookmark couldn't follow the reader", err);
    }
    if (moved) lastWrite = Date.now();
    if (gone && flag?.id === id) return dropFlag();
    if (flag?.id !== id) return;
    heard = step === "move" || step === "resume" ? pos : null;
    if (step === "pause") writeFlag(pausedFlag(flag, Date.now()));
    else if (step === "resume") writeFlag(resumedFlag(flag));
    if (step === "pause" || step === "resume") syncBookmarkLines();
    // The bar is shown once for a pause, on the page where the reader landed.
    if ((step === "pause" || step === "stay") && flag?.paused && !flag.told && held && tell) {
      writeFlag({ ...flag, told: true });
      tell({ record: held, pos, move: () => moveItHere() });
    }
  }

  /**
   * "Move it here": the paused bookmark goes to where the reader is now, as an
   * ordinary edit the reader can undo, and follows from there, in whichever book
   * that is. Resolves to whether it moved.
   */
  async function moveItHere() {
    const mine = readFlag();
    // On /desk, the leading LIT pane's place as it is now (E28).
    const pos = (place ? positionOnPage(place(), page) : null) ?? latest;
    if (!mine || !pos) return false;
    let plan = null;
    await store.change(async ({ get }) => {
      const record = await get(mine.id);
      if (!isFollowing(record) || !canEdit(record)) return null;
      const changes = followMoveChanges(record, pos);
      if (!changes) return null;
      plan = { put: [editRecord(record, { ...changes, contentVersion: ctx().contentVersion }, { now: new Date().toISOString(), client: ctx().client })], remove: [] };
      return plan;
    });
    writeFlag(resumedFlag(mine, pos.bookKey));
    syncBookmarkLines();
    return Boolean(plan);
  }

  function schedule() {
    if (timer || !flag) return;
    timer = window.setTimeout(flush, throttleDelay(lastWrite, Date.now()));
  }

  // After a reload or Back, the page first reports the chapter's top (no verse)
  // before the browser restores the scroll; that is not where the reader is, so
  // it is skipped until a real verse comes (it would write verse 1 over the
  // bookmark, which the restore corrects seconds later).
  // /desk reports only what its reader does, never a restore (E28).
  let settling = false;
  try {
    const type = performance.getEntriesByType?.("navigation")?.[0]?.type;
    settling = !place && (type === "reload" || type === "back_forward");
  } catch {
    settling = false;
  }

  function hear(position) {
    if (leaving) return;
    if (settling) {
      if (position && position.verse == null) return;
      settling = false;
    }
    const pos = positionOnPage(position, page);
    if (!pos) return;
    latest = pos;
    schedule();
  }

  /** A report from a pane that has just become /desk's leading one: it pauses (E28). */
  function lead(position) {
    const pos = positionOnPage(position, page);
    if (!pos || leaving) return;
    latest = pos;
    newLead = true;
    schedule();
  }

  /**
   * Forget where the reader was; for a link off the page, stop listening. What
   * the follower last accepted goes too: it belonged to the follow before, and
   * would count a far report as reading on from this one (a follow started in
   * place, E44, or a resting place moved in the form, E46).
   */
  function followed(href) {
    window.clearTimeout(timer);
    timer = 0;
    latest = null;
    heard = null;
    newLead = false;
    leaving = href != null && !onThisPage(href);
  }

  if (!place) window.addEventListener("lit:last-read", (e) => hear(e.detail ? { ...e.detail } : null));
  // Back to this page from the back-forward cache: the tab may have left the
  // book since, and the flag in session storage says so (BA101).
  window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    followed(null);
    writeFlag(nextFollowState(readFlag()));
    syncBookmarkLines();
    // The page's own last report is where the reader was as it was left (its
    // pagehide save), not where a link they only looked at took the bookmark.
    // /desk waits for its reader instead.
    if (flag && !place) hear(pageLastRead());
  });
  env = { followed, moveItHere };
  // Rows drawn before this page could follow offer "Start following" now.
  syncBookmarkLines();
  // This page may have said where the reader is before this module loaded.
  // /desk reports nothing until its reader moves (E28): what its panes opened
  // at isn't reading, and a chapter-only place would put the bookmark at verse 1.
  if (flag && !place) hear(pageLastRead());
  return { hear, lead };
}
