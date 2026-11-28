// src/scripts/desk/tab-footnotes.js
//
// The Notebook panel's Footnotes tab (Featherboa's Phase 5; SITE-FEATHERBOA.md,
// "The Notebook panel": BS-14, WB-20, WB-28): the footnotes of the chapter in
// view, each note whole, in the page's order, read off the page so they say
// exactly what the page's own list says, links included. Where the Notebook
// runs, that list leaves the reading flow (reading-page.css, WB-18), so this is
// where a chapter's notes are read; a footnote letter in the text still opens
// its own note.
//
// It is /desk's Footnotes pane (footnotes-view.js) over this page's text: the
// page's own chapter, or one it has read on into (page.js's chapterFootnotes).
// "Verse 3" takes the reader to the verse on the page, and with a notebook
// each note has its Pin, as in the page's list. A draft in view, or a chapter
// that didn't load, says so in one line.
//
// createFootnotesTab({ store, place, visible })
//   → { el, render, setVerse, focusHeading, showNote, destroy }
//   `place()` is the chapter in view (page.js's chapterOnPage:
//   `{ bookKey, chapter, label, plural, draft, failed }`), `visible()`
//   whether the tab can be seen; it draws only then, as every tab does.
//   `showNote(id)` marks one of its notes (by its id on the page) with the
//   others on its verse, brings it into view and puts focus on it: a pinned
//   footnote's link in Notes, which the page's list can't show here (pins.js).

import { createFootnotesView } from "./footnotes-view.js";
import { chapterFootnotes, verseNumber } from "./page.js";

/**
 * @param {{ store: object | null,
 *   place: () => ({ bookKey: string, chapter: number, label: string,
 *     plural?: boolean, draft?: boolean, failed?: boolean } | null),
 *   visible?: () => boolean }} options
 */
export function createFootnotesTab({ store, place, visible = () => true }) {
  const el = document.createElement("div");
  el.className = "desk-panel__fns";
  let at = null;
  // The verse showNote asked for, marked while its chapter is the one in view.
  let asked = null;
  const view = createFootnotesView({ idSuffix: "-panel", store, onVerse: (verse) => goToVerse(verse) });
  // The one line a draft or a chapter that didn't load gets in the list's place.
  const line = document.createElement("p");
  line.className = "desk-panel__empty";
  line.hidden = true;
  el.append(view.el, line);

  /** The verse on the page, a third of the way down, with focus on its number. */
  function goToVerse(verse) {
    const number = at ? verseNumber(at.bookKey, at.chapter, verse) : null;
    if (!number) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({
      top: Math.max(0, window.scrollY + number.getBoundingClientRect().top - window.innerHeight / 3),
      behavior: reduced ? "auto" : "smooth",
    });
    number.focus({ preventScroll: true });
  }

  function render() {
    if (!visible()) return;
    at = place();
    const notes = at && !at.failed && !at.draft ? chapterFootnotes(at.bookKey, at.chapter) : null;
    view.el.hidden = !notes;
    line.hidden = Boolean(notes);
    if (notes) {
      view.show(notes, asked?.key === `${at.bookKey} ${at.chapter}` ? asked.verse : null);
      return;
    }
    line.textContent = !at
      ? "No chapter in view."
      : at.draft
        ? at.plural
          ? `${at.label} are still being translated, so they have no footnotes yet.`
          : `${at.label} is still being translated, so it has no footnotes yet.`
        : `${at.label} didn’t load, so its footnotes aren’t here.`;
  }

  return {
    el,
    render,
    setVerse() {},
    focusHeading() {
      const title = el.querySelector(".desk-fns__title");
      if (!title) return;
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    },
    showNote(id) {
      const here = place();
      const notes = here && !here.failed && !here.draft ? chapterFootnotes(here.bookKey, here.chapter) : null;
      const note = notes?.footnotes.find((f) => f.id === id);
      if (!note) return false;
      asked = { key: `${here.bookKey} ${here.chapter}`, verse: note.verse };
      render();
      const li = view.el.querySelector(`li[data-fn="${CSS.escape(note.id)}"]`);
      if (!li) return false;
      // The list scrolls to the verse when it changes; a second press, after
      // the reader has scrolled the tab, brings the note back as well.
      li.scrollIntoView?.({ block: "nearest" });
      li.tabIndex = -1;
      li.focus({ preventScroll: true });
      return true;
    },
    destroy() {},
  };
}
