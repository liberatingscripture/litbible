// src/lib/read-on.mjs
//
// A book read straight on (SITE-FEATHERBOA.md, "A whole book"): the pure
// pieces the reading page's loader (src/scripts/read-on.js) and Study's LIT
// pane (src/scripts/desk/lit-pane.js) share. Both scroll chapter after
// chapter, so both need the same answers: what comes next (a published
// chapter, or a run of drafts as one entry), what a draft entry says, how a
// fetched chapter's ids are renamed so two chapters on one page never share
// one, which verse the reading line has reached, and how far through its
// book a verse is. Shared reader code may import this; it imports nothing of
// the desk's (test/desk-gate-imports.test.js). Pure and unit-tested
// (test/desk-corpus.test.js, test/featherboa-continuous.test.js).

import { BOOKS, BOOK_ORDER, bookKeyToLabel } from "../data/books.js";
import { VERSE_COUNTS } from "../data/verse-counts.js";

/**
 * One book in reading order, as units: a published chapter is one unit,
 * `{ bookKey, chapters: [n], draft: false }`; a run of drafts is one,
 * `{ bookKey, chapters: [23, 24], draft: true }`, so a reader scrolls past
 * Acts in one step rather than 28. Each chapter in a run still names the
 * unit, so a passage in it lands there.
 *
 * @param {string} bookKey
 * @param {Iterable<number>} drafts the book's draft chapters
 *   (draft-chapters.mjs's `draftChaptersByBook[bookKey]`)
 */
export function bookUnits(bookKey, drafts = []) {
  const draft = new Set(drafts);
  const units = [];
  for (let chapter = 1; chapter <= (BOOKS[bookKey] ?? 0); chapter++) {
    const last = units.at(-1);
    if (!draft.has(chapter)) units.push({ bookKey, chapters: [chapter], draft: false });
    else if (last?.draft) last.chapters.push(chapter);
    else units.push({ bookKey, chapters: [chapter], draft: true });
  }
  return units;
}

/**
 * The New Testament as Study's LIT pane scrolls through it (STUDY-DESK.md,
 * D9): Matthew 1 to Revelation 22, one book's units after another. A run of
 * drafts never crosses a book.
 *
 * @param {Record<string, number[]>} draftsByBook the draft chapters of each book
 */
export function corpusUnits(draftsByBook = {}) {
  return BOOK_ORDER.flatMap((bookKey) => bookUnits(bookKey, draftsByBook[bookKey] ?? []));
}

/** The index of the unit holding a chapter, or -1. */
export function unitIndex(units, bookKey, chapter) {
  return units.findIndex((u) => u.bookKey === bookKey && u.chapters.includes(chapter));
}

/** Whether a unit is a whole book of more than one chapter. */
const wholeBook = (u) => u.chapters.length === BOOKS[u.bookKey] && u.chapters.length > 1;

/** A unit's heading: "John 3", "Luke 23–24", or "Acts" for a book still wholly in draft. */
export function unitHeading(u) {
  const book = bookKeyToLabel(u.bookKey);
  if (u.draft && wholeBook(u)) return book;
  const first = u.chapters[0];
  const last = u.chapters.at(-1);
  return first === last ? `${book} ${first}` : `${book} ${first}–${last}`;
}

/** What a draft entry says. */
export function draftStubText(u) {
  if (wholeBook(u)) return `${bookKeyToLabel(u.bookKey)} is still being translated.`;
  return u.chapters.length === 1 ? "This chapter is still being translated." : "These chapters are still being translated.";
}

/**
 * The reading page's link from a draft entry to its Greek in Study (BVJ:
 * "A draft chapter's line links to that chapter's Greek in Study"), at the
 * run's first chapter, as Study's own links name a passage (E8). Until
 * Phase 9 moves Study, that is /desk, which only the Study preview opens.
 */
export function draftGreekLink(u) {
  const label = u.chapters.length > 1 && !wholeBook(u) ? "Read their Greek in Study" : "Read its Greek in Study";
  return { label, href: `/desk/?place=${u.bookKey}-${u.chapters[0]}` };
}

/**
 * The unit after (or before) a chapter's in its book, or null at the book's
 * end (or start): the reading page reads on within a book, and its way on
 * leads to the next.
 *
 * @param {ReturnType<typeof bookUnits>} units one book's units
 * @param {number} chapter
 * @param {1 | -1} step
 */
export function unitBeside(units, chapter, step) {
  const at = units.findIndex((u) => u.chapters.includes(chapter));
  if (at < 0) return null;
  return units[at + step] ?? null;
}

const ELEMENT = 1;
const REFS = ["aria-describedby", "aria-labelledby"];

function elements(node, out) {
  for (const child of node.childNodes) {
    if (child.nodeType !== ELEMENT) continue;
    out.push(child);
    elements(child, out);
  }
  return out;
}

const classes = (el) => ` ${el.getAttribute("class") ?? ""} `;

/**
 * Prefix every id in the given blocks (and the links and references that
 * name one), in place, so a chapter can sit on a page beside another: the
 * ids a chapter's page carries (`v16`, `fnref-a`, `fn-a`, `go-deeper-title`)
 * would repeat. An `aria-describedby` or `aria-labelledby` that pointed at
 * one of them follows it, and a footnote letter's link keeps the footnote it
 * names in `data-fn`, since a popover opens the note. An id that already
 * starts with the prefix (`john-3-p4` under "john-3-") is left alone.
 *
 * Only attributes change. The text, the `data-verse` spans and the markup are
 * the page's own, so the anchor text read off a loaded chapter is the page's
 * character for character (test/desk-anchor-dom.test.js sweeps every
 * published chapter through this). Pure: it needs only childNodes,
 * getAttribute and setAttribute, so the tests run it on their small DOM.
 *
 * @param {Iterable<Node>} blocks a chapter's `.p` containers, and any other
 *   part of its page brought with it
 * @param {string} prefix e.g. "p1-john-3-" (a desk pane) or "john-3-" (the reading page)
 */
export function prepareLitBlocks(blocks, prefix) {
  const all = [];
  for (const b of blocks) {
    if (b.nodeType !== ELEMENT) continue;
    all.push(b);
    elements(b, all);
  }
  const renamed = new Set();
  for (const el of all) {
    const id = el.getAttribute("id");
    if (!id || id.startsWith(prefix)) continue;
    renamed.add(id);
    el.setAttribute("id", prefix + id);
  }
  for (const el of all) {
    for (const name of REFS) {
      const v = el.getAttribute(name);
      if (!v) continue;
      el.setAttribute(name, v.split(/\s+/).map((t) => (renamed.has(t) ? prefix + t : t)).join(" "));
    }
    if (String(el.tagName).toLowerCase() !== "a") continue;
    const href = el.getAttribute("href") ?? "";
    if (!href.startsWith("#")) continue;
    const target = href.slice(1);
    const parent = el.parentNode;
    if (parent?.getAttribute && classes(parent).includes(" fn-ref ")) el.setAttribute("data-fn", target);
    if (renamed.has(target)) el.setAttribute("href", `#${prefix}${target}`);
  }
}

/** The prefix for one chapter on the reading page: "john-3-". */
export const readOnPrefix = (bookKey, chapter) => `${bookKey}-${chapter}-`;

/** The prefix for one chapter in one of Study's LIT panes: "p1-john-3-". */
export const litPrefix = (paneId, bookKey, chapter) => `${paneId}-${bookKey}-${chapter}-`;

/**
 * Which of a chapter's verse starts the reading line has reached (E29): the
 * last one, in document order, whose top is at or above the line, stopping at
 * the first below it. `tops` is each `[data-verse]` span's top, in document
 * order (a verse running over two blocks has a span in each, so the later one
 * is a nearer mark). The spans are measured, never the verse numbers: a
 * number hidden by the Display tray is an absolutely positioned 1px box, and
 * where its containing block is outside a pane's scroller it doesn't move as
 * the pane scrolls, so every hidden number read as verse 1.
 *
 * @param {Iterable<number>} tops read lazily, so a generator measures only
 *   as far as the line
 * @param {number} line
 * @returns {number} the index in `tops`, or -1 when even the first is below the line
 */
export function indexAtLine(tops, line) {
  let at = -1;
  let i = 0;
  for (const top of tops) {
    if (top > line) break;
    at = i++;
  }
  return at;
}

/**
 * How far through its book a verse is, from 0 to 1, measured in verses, so
 * a long chapter counts for more (the progress line, "The progress line").
 * The verse counts as read once the reading line reaches it: the first verse
 * of a book is a little way in, its last is the whole way.
 *
 * @param {string} bookKey
 * @param {number} chapter
 * @param {number} verse 0 for a chapter's start, before its first verse
 */
export function bookProgress(bookKey, chapter, verse) {
  const counts = VERSE_COUNTS[bookKey];
  if (!counts?.length) return 0;
  const total = counts.reduce((n, c) => n + c, 0);
  const ch = Math.min(Math.max(1, Math.trunc(chapter) || 1), counts.length);
  const before = counts.slice(0, ch - 1).reduce((n, c) => n + c, 0);
  const within = Math.min(Math.max(0, Math.trunc(verse) || 0), counts[ch - 1]);
  return Math.min(1, (before + within) / total);
}
