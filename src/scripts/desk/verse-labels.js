// src/scripts/desk/verse-labels.js
//
// A Study View verse number names the reader's notes on its verse (STUDY-DESK.md,
// "Still open": "How a screen reader learns a verse has notes"). The rules are
// in src/lib/desk-verse.mjs; this file reads the notebook and sets the label.
//
// chapter-tools.js makes each verse number a button and gives it the plain
// name "Verse 1". While the desk is on, this overrides that name with
// "Verse 1, 1 note of mine". The notes themselves sit outside the scripture's
// reading order (audit C24), so someone reading the verse would never come
// across them; the verse number, already the keyboard's way into each verse,
// is where a screen reader hears that a verse has notes, and the verse menu
// lists them.
//
// It adds no text to the scripture: the only thing it touches is an attribute.
// When the reader hides their notes ("My notes" off), every number goes back to
// the plain "Verse N", so nothing on the page mentions what the reader chose
// not to see.

import { forChapter } from "../../lib/desk-store-core.mjs";
import { noteCounts, verseLabel } from "../../lib/desk-verse.mjs";
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

  /** Set every verse number's name from the records and the "My notes" switch. */
  function apply() {
    const counts = getSetting("notes") === "on" ? noteCounts(records) : new Map();
    for (const sup of textBox.querySelectorAll("sup.vn")) {
      // chapter-tools.js makes it a button at init; one it hasn't reached yet
      // is left for it, and picked up on the next refresh.
      if (sup.getAttribute("role") !== "button") continue;
      const verse = parseInt(sup.textContent, 10);
      if (!Number.isFinite(verse)) continue;
      const label = verseLabel(verse, counts.get(verse) ?? 0);
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
