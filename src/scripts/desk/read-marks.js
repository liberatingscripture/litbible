// src/scripts/desk/read-marks.js
//
// Bookmarks in Read View's margin. Read View is for reading a book straight
// through, so it shows none of the reader's notes; bookmarks are the one
// piece of marginalia it shows (BVJ, 2026-10-08), the same red mark as in
// Chapter View (notes-margin.js), beside the verse, with the same
// "My bookmarks" switch. Like the notes, the marks sit in one <aside> at the
// end of <body> and add nothing to the text.

import { BOOK_ORDER } from "../../data/books.js";
import { NOTE_GAP, BOOKMARK_MARK, BOOKMARK_LANE } from "../../lib/desk-notes.mjs";
import { recordReference, MOVE_KIND, NO_CHAPTER_KINDS } from "../../lib/desk-store-core.mjs";
import { FOLLOW_CHANGED } from "./bookmark-follow.js";
import { markLook } from "./bookmark-mark.js";
import { redrawAfterMove } from "./move-redraw.js";
import { glyph } from "./glyphs.js";
import { SETTINGS_EVENT, getSetting } from "./note-settings.js";

export function createReadMarks({ store }) {
  const page = document.querySelector("[data-rm-root]");
  const text = page?.querySelector("[data-rm-text]");
  const book = page?.dataset.rmBook;
  if (!store || !text || !BOOK_ORDER.includes(book)) return null;

  const aside = document.createElement("aside");
  aside.className = "desk-notes";
  aside.setAttribute("aria-label", "My bookmarks");
  document.body.append(aside);

  let marks = [];

  async function load() {
    const all = await store.all();
    marks = all.filter((r) => r.kind === "bookmark" && r.bookKey === book);
    schedule();
  }

  let frame = 0;
  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  }

  function draw() {
    aside.replaceChildren();
    const box = text.getBoundingClientRect();
    if (getSetting("bookmarks") !== "on" || !marks.length || box.left < BOOKMARK_MARK + 12) {
      aside.hidden = true;
      return;
    }
    const right = box.left >= NOTE_GAP + BOOKMARK_MARK + 8 ? NOTE_GAP : 6;
    const lanes = [];
    for (const r of marks) {
      const verse = text.querySelector(`[data-chapter="${r.chapter}"] [data-verse="${r.verse}"]`);
      const line = verse?.getClientRects()[0];
      if (!line) continue; // a draft chapter, or a verse the text doesn't have
      const block = verse.closest("[data-chapter]");
      const lineHeight = parseFloat(getComputedStyle(block).lineHeight) || line.height;
      const mark = document.createElement("span");
      const look = markLook(r, recordReference(r));
      mark.className = look.className;
      mark.setAttribute("role", "img");
      mark.setAttribute("aria-label", look.name);
      mark.title = look.name;
      mark.innerHTML = glyph("bookmark", "desk-bookmark-mark__glyph");
      mark.style.top = `${line.top + window.scrollY + (lineHeight - BOOKMARK_MARK) / 2}px`;
      const top = line.top + window.scrollY + (lineHeight - BOOKMARK_MARK) / 2;
      // A second bookmark on the same line sits a lane out, as in Chapter View.
      let lane = 0;
      while (lanes.some((s) => s.lane === lane && Math.abs(s.top - top) < BOOKMARK_MARK)) lane++;
      lanes.push({ top, lane });
      mark.style.left = `${box.left + window.scrollX - right - BOOKMARK_MARK - lane * BOOKMARK_LANE}px`;
      aside.append(mark);
    }
    aside.hidden = !aside.childElementCount;
  }

  /* ── Going to a verse from the Notebook panel ─────────────────────── */

  const verseIn = (r) =>
    r?.bookKey === book && r.verse
      ? text.querySelector(`[data-chapter="${r.chapter}"] [data-verse="${r.verse}"]`)
      : null;

  /** Whether `reveal` can take the reader to this record here: a verse in this book. */
  const canReveal = (r) => Boolean(verseIn(r));

  // Scrolls Read View to the verse in place and marks it briefly, the way
  // Chapter View's margin marks a note's words. The address takes the verse's
  // anchor too, so a reload lands there.
  function reveal(r) {
    const verse = verseIn(r);
    if (!verse) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const top = verse.getClientRects()[0]?.top ?? verse.getBoundingClientRect().top;
    window.scrollTo({ top: window.scrollY + top - window.innerHeight / 3, behavior: reduced ? "auto" : "smooth" });
    try {
      history.replaceState(history.state, "", `#${r.bookKey}-${r.chapter}-v${r.verse}`);
    } catch (_) {}
    if (typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined") {
      const spans = text.querySelectorAll(`[data-chapter="${r.chapter}"] [data-verse="${r.verse}"]`);
      const ranges = [...spans].map((s) => {
        const range = document.createRange();
        range.selectNodeContents(s);
        return range;
      });
      CSS.highlights.set("desk-note-words", new Highlight(...ranges));
      setTimeout(() => CSS.highlights.delete("desk-note-words"), 1600);
    }
  }

  // Not a place, a sheet (autosaved every few hundred milliseconds), or a bookmark moving as the reader reads (MOVE_KIND): it writes every few seconds (BA107; NB8-1).
  store.subscribe(load, { except: [...NO_CHAPTER_KINDS, MOVE_KIND] });
  // It catches up as a jump once the reader pauses, not a slide (move-redraw.js).
  redrawAfterMove(store, load);
  window.addEventListener(FOLLOW_CHANGED, schedule);
  window.addEventListener("resize", schedule);
  document.addEventListener("desk:column-moved", schedule);
  document.addEventListener(SETTINGS_EVENT, schedule);
  document.fonts?.addEventListener?.("loadingdone", schedule);
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(text);
  new MutationObserver(schedule).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-size", "data-leading", "data-font", "data-vn", "data-desk-panel", "data-desk-expanded"],
  });
  load();
  return { refresh: schedule, reveal, canReveal };
}
