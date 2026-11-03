// src/lib/desk-bookmarks.mjs
//
// Bookmarks that move as the reader reads, and "Continue reading" (STUDY-DESK.md
// E9, which took up B1's places and ribbons and audit C25): the rules behind a
// bookmark's name and its "Move as I read" switch, and the one row the
// Notebook keeps above its list. Pure: no storage, no DOM, no clock of its own.
//
// There is one feature, Bookmarks. A bookmark (format kind 4) is a verse, an
// optional name (`label`) and an optional `follow: true`, "Move as I read".
// A bookmark stays on its verse unless that switch is on (BVJ, 2026-11-02).
// The notebook used to keep a second kind for the same idea, a `place` with
// `ribbon: true`; migrateRecord (desk-records.mjs) reads one of those as a
// bookmark that follows, so nothing here knows the old shape.
//
// "Continue reading" is the one place that is not a bookmark: it is where the
// reader stopped, not something they marked. It is `lit_last_read`
// (last-read.js), kept in this browser and never a notebook record, and the
// Notebook shows it first with no bookmark mark. Read View's per-book places
// (`lit_rm_resume_<book>`) are no longer listed (E9: the reader never made
// them); read-mode.js keeps writing them for Read View's own use.
//
// The rule for when a bookmark moves (C25): a bookmark with the switch on
// follows the reader only while they stay in the book they opened it into.
// Following its link from the list leaves a flag in sessionStorage
// (`lit-desk-follow`, one tab's worth, never shared); while every page the tab
// lands on is in that book, the bookmark moves to where the reader reads, and
// the first page outside the book clears the flag. Otherwise only Continue
// reading moves. Moving is the reader reading, not editing by hand, so the
// shell writes it without a history entry (store.commit with record: false),
// throttled by `throttleDelay`.

import { BOOKS, bookKeyToLabel } from "../data/books.js";

/** The tab's flag: which bookmark is following the reader, and into which book. */
export const FOLLOW_FLAG_KEY = "lit-desk-follow";

/**
 * "A few per reader" (B1). Past this, "Move as I read" asks the reader to turn
 * it off on another bookmark first. Only bookmarks that move count: a plain
 * bookmark is as many as the reader likes.
 */
export const MAX_FOLLOWING = 6;

/** The longest name a bookmark takes, in code points (an emoji counts once). */
export const BOOKMARK_NAME_MAX = 40;

/** A followed bookmark is written at most this often, and only when the verse changed. */
export const MOVE_EVERY_MS = 4000;

/* ── Naming and following ────────────────────────────────────────────── */

/**
 * A bookmark's name as it is kept: whitespace tidied, cut at BOOKMARK_NAME_MAX.
 * Empty is a bookmark with no name, which is allowed; names are the reader's
 * own words and need not differ.
 */
export function cleanBookmarkName(raw) {
  const tidy = String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
  // Cut by code point, so an emoji at the limit is never split in two.
  return Array.from(tidy)
    .slice(0, BOOKMARK_NAME_MAX)
    .join("")
    .trim();
}

/** A bookmark with "Move as I read" on. */
export function isFollowing(r) {
  return r?.kind === "bookmark" && r.follow === true;
}

/** The bookmarks among `records` that move as the reader reads. */
export function followingOf(records) {
  return records.filter(isFollowing);
}

/**
 * Whether another bookmark may be set to move (a reader at the limit turns one
 * off first). `exceptId` is the bookmark being changed, which may stay on.
 */
export function canFollowMore(records, exceptId = null) {
  return followingOf(records).filter((r) => r.id !== exceptId).length < MAX_FOLLOWING;
}

/* ── Pages ───────────────────────────────────────────────────────────── */

/**
 * Which book a page belongs to, from its path, and what kind of page it is:
 * { bookKey, kind: "chapter" | "intro" | "read", chapter? }, or null for any
 * page outside a book (the home page, search, an article).
 */
export function pageBookOf(pathname) {
  const path = String(pathname ?? "");
  let m = /^\/read\/([a-z0-9]+)\/?$/.exec(path);
  if (m && Object.hasOwn(BOOKS, m[1])) return { bookKey: m[1], kind: "read" };
  m = /^\/([a-z0-9]+)-intro\/?$/.exec(path);
  if (m && Object.hasOwn(BOOKS, m[1])) return { bookKey: m[1], kind: "intro" };
  m = /^\/([a-z0-9]+)-(\d+)\/?$/.exec(path);
  if (m && Object.hasOwn(BOOKS, m[1])) {
    const chapter = Number(m[2]);
    if (chapter >= 1 && chapter <= BOOKS[m[1]]) return { bookKey: m[1], kind: "chapter", chapter };
  }
  return null;
}

/**
 * The channel a tab's pages use to tell a duplicated tab from the tab it was
 * copied from. A browser's Duplicate tab copies session storage, flag and
 * all, so without it both tabs moved the bookmark, each to wherever it was
 * read last (BVJ, 2026-10-29). The flag carries the tab's own token (`tab`);
 * a page that loads with the flag asks whether a live page already holds
 * that token, and if one answers, this tab is the copy and doesn't follow.
 * Following a bookmark's link announces it too, so the tab whose link was
 * opened last is the one the bookmark follows.
 */
export const FOLLOW_TAB_CHANNEL = "lit-desk-follow-tab";

/** How long a page with the flag waits for another page to claim its tab. */
export const DUPLICATE_WAIT_MS = 250;

/**
 * The flag as stored text, or null for anything that isn't one: { id,
 * bookKey, tab }, `tab` only when the flag has one (a flag stored before
 * tokens has none).
 */
export function parseFollowFlag(raw) {
  try {
    const f = JSON.parse(raw ?? "null");
    if (!(typeof f?.id === "string" && f.id && Object.hasOwn(BOOKS, f.bookKey))) return null;
    return typeof f.tab === "string" && f.tab ? { id: f.id, bookKey: f.bookKey, tab: f.tab } : { id: f.id, bookKey: f.bookKey };
  } catch {
    return null;
  }
}

/** The flag to store for a bookmark opened into its book, with the tab's token when it has one. */
export function followFlagFor(bookmark) {
  return JSON.stringify(bookmark.tab ? { id: bookmark.id, bookKey: bookmark.bookKey, tab: bookmark.tab } : { id: bookmark.id, bookKey: bookmark.bookKey });
}

/**
 * Whether a message on FOLLOW_TAB_CHANNEL means this page should stop
 * following: another tab answered that it holds this tab's token (`taken`,
 * so this tab is a copy), or another tab followed the same bookmark's link
 * since (`took`, with a different token).
 */
export function loseFollow(flag, message) {
  if (!flag?.tab || !message || typeof message !== "object") return false;
  if (message.taken === flag.tab) return true;
  return message.took === flag.id && typeof message.tab === "string" && message.tab !== flag.tab;
}

/**
 * The flag after landing on `page` (pageBookOf's answer, null outside any
 * book): the same flag while the page is in the flagged book, its intro
 * included, and none once the reader has left it.
 */
export function nextFollowState(flag, page) {
  if (!flag) return null;
  return page && page.bookKey === flag.bookKey ? flag : null;
}

/**
 * Where the reader is on `page`, from the last-read record (the signal both
 * views already send), as { bookKey, chapter, verse } for a bookmark to move
 * to, or null when this page's position isn't known or isn't reading. A
 * record from another page (a draft chapter records nothing, so the last one
 * is stale) is ignored. A chapter opened at its top has no verse yet, and a
 * bookmark needs one: that is verse 1.
 *
 * @param {{ book: string, chapter: number, verse: number | null, view: string } | null} position
 * @param {ReturnType<typeof pageBookOf>} page
 */
export function positionOnPage(position, page) {
  if (!position || !page || position.book !== page.bookKey) return null;
  if (page.kind === "chapter" && !(position.view === "study" && position.chapter === page.chapter)) return null;
  if (page.kind === "read" && position.view !== "read") return null;
  if (page.kind === "intro") return null;
  return { bookKey: position.book, chapter: position.chapter, verse: position.verse || 1 };
}

/**
 * What a followed bookmark changes to when the reader is at `pos`, or null
 * when it is there already (so nothing is written).
 */
export function followMoveChanges(record, pos) {
  if (!pos) return null;
  if (record.bookKey === pos.bookKey && record.chapter === pos.chapter && record.verse === pos.verse && (record.endVerse ?? record.verse) === pos.verse) {
    return null;
  }
  return { bookKey: pos.bookKey, chapter: pos.chapter, verse: pos.verse, endVerse: pos.verse };
}

/**
 * How long to wait before the next write of a moving bookmark: 0 when `gap` ms
 * have passed since the last one, else the rest of the wait.
 */
export function throttleDelay(lastWriteAt, now, gap = MOVE_EVERY_MS) {
  if (lastWriteAt == null) return 0;
  return Math.max(0, lastWriteAt + gap - now);
}

/* ── Continue reading ────────────────────────────────────────────────── */

/**
 * Continue reading's address, in the view it was kept in. This restates
 * last-read.js's continueHref, which a Node test can import to hold the two
 * together (test/desk-bookmarks.test.js).
 */
export function lastReadHref(r) {
  if (r.view === "read") {
    const anchor = r.verse ? `${r.book}-${r.chapter}-v${r.verse}` : `ch-${r.chapter}`;
    return `/read/${r.book}/#${anchor}`;
  }
  return `/${r.book}-${r.chapter}/${r.verse ? `#v${r.verse}` : ""}`;
}

const VIEW_NAMES = { study: "Chapter View", read: "Read View" };

/**
 * The one row the Notebook keeps above its list, from the last-read record, or
 * null when there is none: { title, detail, href, bookKey }. It is not a
 * bookmark and carries no bookmark mark.
 */
export function continueItem(lastRead) {
  if (!lastRead) return null;
  const where = `${bookKeyToLabel(lastRead.book)} ${lastRead.chapter}${lastRead.verse ? `:${lastRead.verse}` : ""}`;
  return {
    title: where,
    detail: `Continue reading · ${VIEW_NAMES[lastRead.view] ?? "Chapter View"}`,
    href: lastReadHref(lastRead),
    bookKey: lastRead.book,
  };
}
