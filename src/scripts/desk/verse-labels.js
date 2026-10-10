// src/scripts/desk/verse-labels.js
//
// A Study View verse number names the reader's notes and highlights on its
// verse (STUDY-DESK.md, "Still open": "How a screen reader learns a verse has
// notes"; the highlights came in phase 1c). The rules are in
// src/lib/desk-verse.mjs; this file reads the notebook and sets the label.
//
// chapter-tools.js makes each verse number a button and gives it the plain
// name "Verse 1". While the desk is on, this overrides that name with
// "Verse 1, 1 note of mine", "Verse 1, highlighted yellow" or both, colours
// first. The notes and highlights themselves sit outside the scripture's
// reading order (audit C24), so someone reading the verse would never come
// across them; the verse number, already the keyboard's way into each verse,
// is where a screen reader hears that a verse has them, and the verse menu
// lists them.
//
// A mark whose wording has changed (change-notice.js) is counted on each of
// its verses too, and verseLabel says so ("…, 1 changed since I marked it"):
// this is the one place a screen reader meets a waiting notice in reading
// order, since the flags sit outside the scripture. A mark that is lost isn't
// on the page to be met, so it adds nothing here (the Notebook's lists name
// it).
//
// It adds no text to the scripture: the only thing it touches is an attribute.
// Each kind counts only while the reader is showing it: notes while "My notes"
// is on, highlights while "My highlights" is on (both are turned off by "Hide
// my notes"). A verse goes back to the plain "Verse N" for whatever is hidden,
// so nothing on the page mentions what the reader chose not to see.

import { forChapter } from "../../lib/desk-store-core.mjs";
import { highlightColors, noteCounts, verseLabel } from "../../lib/desk-verse.mjs";
import { noticesFor } from "./change-notice.js";
import { SETTINGS_EVENT, getSetting } from "./note-settings.js";
import { pageChapter } from "./page.js";

/**
 * @param {{ store: object }} options
 * @returns {{ refresh(): Promise<void> } | null} Null off a Study View chapter.
 */
export function createVerseLabels({ store }) {
  const here = pageChapter();
  const textBox = document.querySelector(".chapter-paragraphs");
  if (!store || !here || !textBox) return null;

  let records = []; // this chapter's live records

  /**
   * How many of the marks being shown carry a change notice, on each verse
   * they cover: notes while "My notes" is on, highlights while "My
   * highlights" is. A lost mark isn't counted.
   */
  function noticeCounts() {
    const shown = records.filter(
      (r) =>
        (r.kind === "note" && getSetting("notes") === "on") ||
        (r.kind === "highlight" && getSetting("highlights") === "on"),
    );
    const counts = new Map();
    for (const [id, notice] of noticesFor(shown)) {
      if (notice.kind === "lost") continue;
      const r = shown.find((x) => x.id === id);
      if (!Number.isInteger(r?.verse)) continue;
      const last = Number.isInteger(r.endVerse) ? Math.max(r.verse, r.endVerse) : r.verse;
      for (let v = r.verse; v <= last; v++) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return counts;
  }

  /** Set every verse number's name from the records and the "My notes" and "My highlights" switches. */
  function apply() {
    const counts = getSetting("notes") === "on" ? noteCounts(records) : new Map();
    const colors = getSetting("highlights") === "on" ? highlightColors(records) : new Map();
    const changed = noticeCounts();
    for (const sup of textBox.querySelectorAll("sup.vn")) {
      // chapter-tools.js makes it a button at init; one it hasn't reached yet
      // is left for it, and picked up on the next refresh.
      if (sup.getAttribute("role") !== "button") continue;
      const verse = parseInt(sup.textContent, 10);
      if (!Number.isFinite(verse)) continue;
      const label = verseLabel(verse, counts.get(verse) ?? 0, colors.get(verse) ?? [], changed.get(verse) ?? 0);
      if (sup.getAttribute("aria-label") !== label) sup.setAttribute("aria-label", label);
    }
  }

  /** Read the notebook again, then relabel. */
  async function refresh() {
    records = forChapter(await store.byChapter(here.bookKey, here.chapter), here.bookKey, here.chapter);
    apply();
  }

  store.subscribe(refresh);
  document.addEventListener(SETTINGS_EVENT, apply);
  refresh();

  return { refresh };
}
