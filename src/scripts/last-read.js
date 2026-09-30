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
// fraction of the viewport height: roughly where the eye rests while reading.
const READING_LINE = 0.3;

/** @returns {{v: 1, book: string, chapter: number, verse: number | null, view: "study" | "read", t: number} | null} */
export function loadLastRead() {
  try {
    const r = JSON.parse(window.localStorage.getItem(KEY) || "null");
    if (!r || r.v !== 1) return null;
    const chapters = BOOKS[r.book];
    if (!chapters || !Number.isInteger(r.chapter) || r.chapter < 1 || r.chapter > chapters) return null;
    if (r.verse != null && !Number.isInteger(r.verse)) return null;
    if (r.view !== "study" && r.view !== "read") return null;
    return r;
  } catch {
    return null;
  }
}

export function saveLastRead({ book, chapter, verse = null, view }) {
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ v: 1, book, chapter, verse: verse ?? null, view, t: Date.now() }),
    );
  } catch {
    /* storage unavailable: Continue reading just doesn't appear */
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

/** Last marker above the reading line, or null above the first one. */
export function verseAtReadingLine(markers, idToVerse) {
  const line = window.innerHeight * READING_LINE;
  let verse = null;
  for (const m of markers) {
    if (m.getBoundingClientRect().top > line) break;
    verse = idToVerse(m.id);
  }
  return verse;
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
  const hashVerse = () => {
    const m = /^#v(\d+)/.exec(window.location.hash);
    return m ? Number(m[1]) : null;
  };
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
