// src/lib/desk-places.mjs
//
// Places and ribbons (STUDY-DESK.md B1, audit C25): the rules behind the
// Notebook's "Places" group. Pure: no storage, no DOM, no clock of its own.
//
// Three things count as a place, and only one of them is a notebook record:
//   - "Continue reading": the one `lit_last_read` record (last-read.js);
//   - Read View's per-book places: `lit_rm_resume_<book>` (read-mode.js),
//     a chapter anchor and a scroll offset per book;
//   - ribbons: `place` records with `ribbon: true` and a name (format kind 5),
//     the only ones the reader makes here.
// The first two are kept in this browser by reader code and are NOT turned
// into notebook records: whether reading places sync is still open (the
// format, kind 5; BVJ leans against). This file only reads what they hold, so
// the Places group can show all three together.
//
// The rule for when a ribbon moves (C25): a ribbon follows the reader only
// while they stay in the book they opened it into. Following a ribbon's link
// from Places leaves a flag in sessionStorage (`lit-desk-ribbon`, one tab's
// worth, never shared); while every page the tab lands on is in that book, the
// ribbon moves to where the reader reads, and the first page outside the book
// clears the flag. Otherwise only Continue reading moves. Moving is the reader
// reading, not editing by hand, so the shell writes it without a history entry
// (store.commit with record: false), throttled by `throttleDelay`.

import { BOOKS, BOOK_ORDER, bookKeyToLabel } from "../data/books.js";
import { recordHref, recordReadHref, recordReference } from "./desk-store-core.mjs";

/** The tab's flag: which ribbon is following the reader, and into which book. */
export const RIBBON_FLAG_KEY = "lit-desk-ribbon";

/** "A few per reader" (B1). Past this, a new ribbon asks to move an old one. */
export const MAX_RIBBONS = 6;

/** The longest name a ribbon takes, in code points (an emoji counts once). */
export const RIBBON_NAME_MAX = 40;

/** A followed ribbon is written at most this often, and only when the verse changed. */
export const MOVE_EVERY_MS = 4000;

/* ── Naming ribbons ──────────────────────────────────────────────────── */

/** A ribbon's name as it is kept: whitespace tidied, cut at RIBBON_NAME_MAX. */
export function cleanRibbonName(raw) {
  const tidy = String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
  // Cut by code point, so an emoji at the limit is never split in two.
  return Array.from(tidy)
    .slice(0, RIBBON_NAME_MAX)
    .join("")
    .trim();
}

/** A real ribbon record: a place with `ribbon: true` and a name. */
export function isRibbon(r) {
  return r?.kind === "place" && r.ribbon === true && typeof r.name === "string" && r.name !== "";
}

/** The ribbons among `records`, by name. */
export function ribbonsOf(records) {
  return records.filter(isRibbon).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }));
}

/**
 * Why `raw` can't name a ribbon, as a plain sentence, or null when it can.
 * `exceptId` is the ribbon being renamed, which may keep its own name.
 */
export function ribbonNameProblem(raw, ribbons, exceptId = null) {
  const name = cleanRibbonName(raw);
  if (!name) return "Give the ribbon a name.";
  const clash = ribbons.some((r) => r.id !== exceptId && r.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  return clash ? "You already have a ribbon with that name." : null;
}

/** Whether another ribbon may be made (a reader at the limit moves one instead). */
export function canAddRibbon(ribbons) {
  return ribbons.length < MAX_RIBBONS;
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
 * all, so without it both tabs moved the ribbon, each to wherever it was
 * read last (BVJ, 2026-10-29). The flag carries the tab's own token (`tab`);
 * a page that loads with the flag asks whether a live page already holds
 * that token, and if one answers, this tab is the copy and doesn't follow.
 * Following a ribbon's link announces it too, so the tab whose link was
 * opened last is the one the ribbon follows.
 */
export const RIBBON_TAB_CHANNEL = "lit-desk-ribbon-tab";

/** How long a page with the flag waits for another page to claim its tab. */
export const DUPLICATE_WAIT_MS = 250;

/**
 * The flag as stored text, or null for anything that isn't one: { id,
 * bookKey, tab }, `tab` only when the flag has one (a flag stored before
 * tokens has none).
 */
export function parseRibbonFlag(raw) {
  try {
    const f = JSON.parse(raw ?? "null");
    if (!(typeof f?.id === "string" && f.id && Object.hasOwn(BOOKS, f.bookKey))) return null;
    return typeof f.tab === "string" && f.tab ? { id: f.id, bookKey: f.bookKey, tab: f.tab } : { id: f.id, bookKey: f.bookKey };
  } catch {
    return null;
  }
}

/** The flag to store for a ribbon opened into its book, with the tab's token when it has one. */
export function ribbonFlagFor(ribbon) {
  return JSON.stringify(ribbon.tab ? { id: ribbon.id, bookKey: ribbon.bookKey, tab: ribbon.tab } : { id: ribbon.id, bookKey: ribbon.bookKey });
}

/**
 * Whether a message on RIBBON_TAB_CHANNEL means this page should stop
 * following: another tab answered that it holds this tab's token (`taken`,
 * so this tab is a copy), or another tab followed the same ribbon's link
 * since (`took`, with a different token).
 */
export function loseRibbon(flag, message) {
  if (!flag?.tab || !message || typeof message !== "object") return false;
  if (message.taken === flag.tab) return true;
  return message.took === flag.id && typeof message.tab === "string" && message.tab !== flag.tab;
}

/**
 * The flag after landing on `page` (pageBookOf's answer, null outside any
 * book): the same flag while the page is in the flagged book, its intro
 * included, and none once the reader has left it.
 */
export function nextRibbonState(flag, page) {
  if (!flag) return null;
  return page && page.bookKey === flag.bookKey ? flag : null;
}

/**
 * Where the reader is on `page`, from the last-read record (the signal both
 * views already send), as { bookKey, chapter, verse } for a ribbon to move
 * to, or null when this page's position isn't known or isn't reading. A
 * record from another page (a draft chapter records nothing, so the last one
 * is stale) is ignored. A chapter opened at its top has no verse yet, and a
 * ribbon needs one: that is verse 1.
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
 * What a followed ribbon changes to when the reader is at `pos`, or null when
 * it is there already (so nothing is written).
 */
export function ribbonMoveChanges(record, pos) {
  if (!pos) return null;
  if (record.bookKey === pos.bookKey && record.chapter === pos.chapter && record.verse === pos.verse && (record.endVerse ?? record.verse) === pos.verse) {
    return null;
  }
  return { bookKey: pos.bookKey, chapter: pos.chapter, verse: pos.verse, endVerse: pos.verse };
}

/**
 * How long to wait before the next write of a moving ribbon: 0 when `gap` ms
 * have passed since the last one, else the rest of the wait.
 */
export function throttleDelay(lastWriteAt, now, gap = MOVE_EVERY_MS) {
  if (lastWriteAt == null) return 0;
  return Math.max(0, lastWriteAt + gap - now);
}

/* ── What the Places group shows ─────────────────────────────────────── */

/**
 * Read View's per-book places from storage entries ([key, text] pairs, as
 * localStorage holds them): `lit_rm_resume_<book>` is { anchor: "ch-8",
 * scrollY }. Read View keeps a chapter, never a verse. Bible order.
 */
export function readPlacesFrom(entries) {
  const out = [];
  for (const [key, raw] of entries) {
    const m = /^lit_rm_resume_([a-z0-9]+)$/.exec(String(key));
    if (!m || !Object.hasOwn(BOOKS, m[1])) continue;
    try {
      const a = /^ch-(\d+)$/.exec(JSON.parse(raw)?.anchor ?? "");
      const chapter = a ? Number(a[1]) : 0;
      if (chapter >= 1 && chapter <= BOOKS[m[1]]) out.push({ bookKey: m[1], chapter });
    } catch {
      /* not ours; skip it */
    }
  }
  return out.sort((a, b) => BOOK_ORDER.indexOf(a.bookKey) - BOOK_ORDER.indexOf(b.bookKey));
}

/**
 * Continue reading's address, in the view it was kept in. This restates
 * last-read.js's continueHref, which a Node test can import to hold the two
 * together (test/desk-places.test.js).
 */
export function lastReadHref(r) {
  if (r.view === "read") {
    const anchor = r.verse ? `${r.book}-${r.chapter}-v${r.verse}` : `ch-${r.chapter}`;
    return `/read/${r.book}/#${anchor}`;
  }
  return `/${r.book}-${r.chapter}/${r.verse ? `#v${r.verse}` : ""}`;
}

const VIEW_NAMES = { study: "Study View", read: "Read View" };

/**
 * The Places group's rows, in the order they are shown:
 * { key, type, title, detail, sub, href, bookKey, id }
 *   - `type`: "continue" (Continue reading), "ribbon", "reading" (a place
 *     another client kept, shown but not changed here) or "read" (Read View's
 *     place in a book);
 *   - `title` is the link's words, `detail` says what kind of place it is and
 *     `sub` (a ribbon's reference) what it points at;
 *   - `id` is the record's id for a ribbon or a reading place.
 * Places in `thisBook` come first, then Continue reading, ribbons by name,
 * other clients' places, and Read View's places in Bible order. `inReadView`
 * sends a ribbon to Read View's address, as the notebook's other rows do.
 *
 * @param {{ lastRead?: object | null, readPlaces?: { bookKey: string, chapter: number }[],
 *   records?: object[], thisBook?: string | null, inReadView?: boolean }} input
 */
export function placeItems({ lastRead = null, readPlaces = [], records = [], thisBook = null, inReadView = false }) {
  const items = [];

  if (lastRead) {
    const where = `${bookKeyToLabel(lastRead.book)} ${lastRead.chapter}${lastRead.verse ? `:${lastRead.verse}` : ""}`;
    items.push({
      key: "continue",
      type: "continue",
      title: where,
      detail: `Continue reading · ${VIEW_NAMES[lastRead.view] ?? "Study View"}`,
      sub: "",
      href: lastReadHref(lastRead),
      bookKey: lastRead.book,
      id: null,
    });
  }

  for (const r of ribbonsOf(records)) {
    items.push({
      key: r.id,
      type: "ribbon",
      title: r.name,
      detail: "Ribbon",
      sub: recordReference(r),
      href: (inReadView ? recordReadHref(r) : null) ?? recordHref(r),
      bookKey: r.bookKey,
      id: r.id,
    });
  }

  for (const r of records) {
    // A place another client kept, without a ribbon's name.
    if (r?.kind !== "place" || isRibbon(r) || !r.bookKey || !r.chapter) continue;
    items.push({
      key: r.id,
      type: "reading",
      title: recordReference(r),
      detail: "Reading place",
      sub: "",
      href: recordHref(r),
      bookKey: r.bookKey,
      id: r.id,
    });
  }

  for (const p of readPlaces) {
    items.push({
      key: `read-${p.bookKey}`,
      type: "read",
      title: `${bookKeyToLabel(p.bookKey)} ${p.chapter}`,
      detail: "Read View",
      sub: "",
      href: `/read/${p.bookKey}/#ch-${p.chapter}`,
      bookKey: p.bookKey,
      id: null,
    });
  }

  const rank = { continue: 0, ribbon: 1, reading: 2, read: 3 };
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const here = (x) => (thisBook && x.item.bookKey === thisBook ? 0 : 1);
      return here(a) - here(b) || rank[a.item.type] - rank[b.item.type] || a.i - b.i;
    })
    .map((x) => x.item);
}
