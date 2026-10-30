// src/scripts/last-read.js
//
// "Continue reading": the one record of where a reader last was, across both
// views, and the links that offer it back. Study View writes it as the page
// is read (trackStudyView, below); Read View writes it beside its own
// per-book resume position (read-mode.js). Draft chapters are never recorded.
//
// One key, lit_last_read, in localStorage:
//   { v: 1, book, chapter, verse | null, view: "study" | "read", t }
// It never leaves the browser (see /privacy). Every read and write is wrapped,
// because storage can be missing or throw (private windows, blocked site
// data), and the site must behave exactly as before when it does.

import { BOOKS, bookKeyToLabel } from "../data/books.js";

const KEY = "lit_last_read";

// The verse a reader is "on" is the last verse number above this line, as a
// fraction of the viewport height: near the top, where a reader scrolls what
// they are reading (BVJ, 2026-10-29). It was 30%, which put a following
// ribbon and Continue reading a verse or two past the top of the screen.
const READING_LINE = 0.1;
// The line is never above where a link to a verse puts its number (the
// markers' scroll-margin-top, below Read View's toolbar), give or take this
// much rounding, so a verse just opened counts as the one being read.
const LANDING_SLACK = 8;

/** @returns {{v: 1, book: string, chapter: number, verse: number | null, view: "study" | "read", t: number} | null} */
export function loadLastRead() {
  try {
    const r = JSON.parse(window.localStorage.getItem(KEY) || "null");
    if (!r || r.v !== 1) return null;
    // Own keys only: `constructor` is not a book (BA103).
    const chapters = typeof r.book === "string" && Object.hasOwn(BOOKS, r.book) ? BOOKS[r.book] : 0;
    if (!chapters || !Number.isInteger(r.chapter) || r.chapter < 1 || r.chapter > chapters) return null;
    if (r.verse != null && !(Number.isInteger(r.verse) && r.verse >= 1)) return null;
    if (r.view !== "study" && r.view !== "read") return null;
    return r;
  } catch {
    return null;
  }
}

/**
 * Where this page last said the reader was, or null before it has said so:
 * what this page saved, never what another tab or an earlier page left in
 * storage. A ribbon that follows the reader starts from this (BA99, BA100).
 */
let savedHere = null;

/** @returns {{ book: string, chapter: number, verse: number | null, view: "study" | "read" } | null} */
export function pageLastRead() {
  return savedHere ? { ...savedHere } : null;
}

export function saveLastRead({ book, chapter, verse = null, view }) {
  // The Study Desk's tour moves the page to show things (src/scripts/desk/
  // tour.js), and that is not the reader's reading: nothing is recorded, and
  // no ribbon follows, while it runs.
  if (document.documentElement.hasAttribute("data-desk-tour")) return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ v: 1, book, chapter, verse: verse ?? null, view, t: Date.now() }),
    );
  } catch {
    /* storage unavailable: Continue reading just doesn't appear */
  }
  savedHere = { book, chapter, verse: verse ?? null, view };
  // Tells the Study Desk where the reader is (a ribbon they opened a book
  // through follows them, src/lib/desk-places.mjs). Sent even when storage
  // failed, and heard by nothing unless the desk is on.
  try {
    window.dispatchEvent(
      new CustomEvent("lit:last-read", { detail: { book, chapter, verse: verse ?? null, view } }),
    );
  } catch {
    /* an old browser without CustomEvent: nothing to tell */
  }
}

export function clearLastRead() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

/** Back to the view the reader was using, at the verse when there is one. */
export function continueHref(r) {
  if (r.view === "read") {
    const anchor = r.verse ? `${r.book}-${r.chapter}-v${r.verse}` : `ch-${r.chapter}`;
    return `/read/${r.book}/#${anchor}`;
  }
  return `/${r.book}-${r.chapter}/${r.verse ? `#v${r.verse}` : ""}`;
}

export function continueLabel(r) {
  return `${bookKeyToLabel(r.book)} ${r.chapter}`;
}

/** The reading line for `markers`, in px from the top of the window. */
export function readingLine(markers) {
  let landing = 0;
  try {
    if (markers[0]) landing = (parseFloat(window.getComputedStyle(markers[0]).scrollMarginTop) || 0) + LANDING_SLACK;
  } catch {
    /* no styles to read: the fraction alone */
  }
  return Math.max(window.innerHeight * READING_LINE, landing);
}

/** Last marker above the reading line, or null above the first one. */
export function verseAtReadingLine(markers, idToVerse) {
  const line = readingLine(markers);
  let verse = null;
  for (const m of markers) {
    if (m.getBoundingClientRect().top > line) break;
    verse = idToVerse(m.id);
  }
  return verse;
}

/**
 * The verse an address's `#vN` names, when this page has it, else null. A
 * verse the page lacks (Matthew 17:21, which the LIT doesn't print, or
 * `#v999`) is not where the reader is (BA104). `ids` are the verse markers'
 * ids, `v41` or `v41b` (src/data/chapters/CLAUDE.md).
 *
 * @param {string} hash
 * @param {string[]} ids
 */
export function verseInHash(hash, ids) {
  const m = /^#v(\d+)/.exec(hash);
  if (!m) return null;
  return ids.some((id) => /^v(\d+)/.exec(id)?.[1] === m[1]) ? Number(m[1]) : null;
}

/**
 * Study View: record this chapter on arrival (at the verse in the address,
 * if any), then follow the reader down the page. `root` carries the book and
 * chapter as data attributes, and is only rendered on published chapters.
 */
export function trackStudyView(root) {
  const book = root.dataset.lastReadBook;
  const chapter = Number(root.dataset.lastReadChapter);
  if (!book || !chapter) return;

  const markers = Array.from(root.querySelectorAll('sup.vn[id^="v"]'));
  const idToVerse = (id) => Number(id.slice(1)) || null;
  const hashVerse = () => verseInHash(window.location.hash, markers.map((m) => m.id));
  const save = (verse) => saveLastRead({ book, chapter, verse, view: "study" });

  save(hashVerse());

  let timer = 0;
  window.addEventListener(
    "scroll",
    () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => save(verseAtReadingLine(markers, idToVerse)), 500);
    },
    { passive: true },
  );
  window.addEventListener("pagehide", () => {
    window.clearTimeout(timer);
    save(verseAtReadingLine(markers, idToVerse) ?? hashVerse());
  });
}

/**
 * Fill every Continue link on the page, or leave them hidden when there is
 * nothing to continue. Wrappers ([data-continue-reading]) carry a forget
 * button; the phone menu's link ([data-continue-menu]) does not.
 */
export function mountContinueReading() {
  const record = loadLastRead();
  const wrappers = Array.from(document.querySelectorAll("[data-continue-reading]"));
  const menuLinks = Array.from(document.querySelectorAll("a[data-continue-menu]"));
  if (!record) return;

  const href = continueHref(record);
  const label = continueLabel(record);
  const fill = (link) => {
    link.href = href;
    const text = link.querySelector("[data-continue-label]");
    if (text) text.textContent = label;
  };

  for (const link of menuLinks) {
    fill(link);
    link.hidden = false;
  }

  for (const wrapper of wrappers) {
    const link = wrapper.querySelector("a[data-continue-link]");
    if (link) fill(link);
    wrapper.hidden = false;
    wrapper.querySelector("[data-continue-forget]")?.addEventListener("click", () => {
      clearLastRead();
      for (const el of [...wrappers, ...menuLinks]) el.hidden = true;
      // The button just vanished under the keyboard user's focus. Both pages
      // that carry one put it straight under the page's h1, so land there.
      const heading = document.querySelector("h1");
      if (heading instanceof HTMLElement) {
        if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
    });
  }
}
