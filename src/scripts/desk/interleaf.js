// src/scripts/desk/interleaf.js
//
// The interleaf (STUDY-DESK.md, N7; "like Edwards's blank leaves"): a ruled
// band after each paragraph of a Study View chapter that has the reader's
// notes, holding those notes. It suits windows too narrow for the margin.
//
// Bands open only when the reader asks, for this page view, and are never
// remembered (interleaf-state.js), so the page can't jump on load (audit
// C13). Opening and closing hold the reader's line (keepReadingPlace), and so
// does a redraw while it is open.
//
// The bands are siblings of the scripture's blocks, marked `data-desk-band`,
// and add no text to a block: chapterBlocks() (page.js) skips them, so the
// anchor reader, Copy text, the handout and the term lens never meet one.
// Their notes are the reader's own words, set as text, in the margin notes'
// face (the `data-desk-note-font` setting reaches them through desk.css).
// "Hide my notes" (M1) and the "My notes" switch empty the interleaf too, and
// a note on a passage the reader hid (N8) stays out of it while that passage is.

import { bandLabel, groupIntoBands } from "../../lib/desk-interleaf.mjs";
import { noteOpening } from "../../lib/desk-notes.mjs";
import { placeRecord } from "../../lib/desk-records.mjs";
import { forChapter, recordReference } from "../../lib/desk-store-core.mjs";
import { keepReadingPlace } from "../keep-reading-place.js";
import { glyph } from "./glyphs.js";
import { HIDDEN_EVENT, hiddenApi } from "./hidden.js";
import { INTERLEAF_EVENT, isInterleafOpen } from "./interleaf-state.js";
import { SETTINGS_EVENT, getSetting } from "./note-settings.js";
import { chapterBlocks, chapterText, pageChapter } from "./page.js";

/**
 * @param {{ store: object | null,
 *   onEdit?: (record: object, trigger: Element, restoreFocus?: Element) => void,
 *   onAddNote?: (draft: object, trigger: Element) => void }} options
 * @returns {{ refresh(): void } | null} Null off a Study View chapter.
 */
export function createInterleaf({ store, onEdit = null, onAddNote = null }) {
  const here = pageChapter();
  const textBox = document.querySelector(".chapter-paragraphs");
  if (!store || !here || !textBox) return null;

  let notes = []; // this chapter's note records
  let shown = false; // whether bands are in the page now

  async function load() {
    const mine = forChapter(await store.byChapter(here.bookKey, here.chapter), here.bookKey, here.chapter);
    notes = mine.filter((r) => r.kind === "note");
    redraw();
  }

  function clear() {
    for (const band of textBox.querySelectorAll(":scope > [data-desk-band]")) band.remove();
  }

  /** The block (a child of the text box) a text node sits in, or -1. */
  function blockIndexOf(node, blocks) {
    for (let n = node; n && n !== textBox; n = n.parentNode) {
      const i = blocks.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  }

  function draw() {
    clear();
    shown = false;
    if (!isInterleafOpen() || getSetting("notes") !== "on" || !notes.length) return;
    const blocks = Array.from(chapterBlocks());
    const text = chapterText();
    const entries = [];
    const hid = hiddenApi();
    for (const record of notes) {
      // A note on a passage the reader hid stays out of sight with it (N8).
      if (hid?.coversRecord(record)) continue;
      const at = placeRecord(text, record);
      if (at.status === "lost" || at.start == null) continue;
      const point = text.toDom(at.start, "start");
      entries.push({ record, start: at.start, block: point ? blockIndexOf(point.node, blocks) : -1 });
    }
    for (const { block, records } of groupIntoBands(entries)) {
      blocks[block].after(bandElement(blocks[block], records));
      shown = true;
    }
  }

  // Redrawing moves the text below it, so the line being read is held.
  function redraw() {
    if (!isInterleafOpen() && !shown) return;
    keepReadingPlace(draw);
  }

  function bandElement(block, records) {
    const band = document.createElement("div");
    band.className = "desk-band";
    band.setAttribute("data-desk-band", "");
    band.setAttribute("role", "group");
    band.setAttribute("aria-label", bandLabel(records.length));

    const list = document.createElement("ul");
    list.className = "desk-band__notes";
    for (const record of records) {
      const ref = recordReference(record);
      const li = document.createElement("li");
      li.className = "desk-band__note";
      const mark = document.createElement("span");
      mark.className = "desk-band__marker";
      mark.innerHTML = glyph(record.marker, "desk-glyph desk-band__glyph");
      const words = document.createElement("span");
      words.className = "desk-band__words";
      const opening = document.createElement("span");
      opening.className = "sr-only";
      opening.textContent = noteOpening(record, ref);
      // A note's body is the reader's own words: always text, never HTML.
      words.append(opening, document.createTextNode(record.body || ""));
      li.append(mark, words);
      if (onEdit) {
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "desk-band__button";
        edit.innerHTML = `Edit<span class="sr-only"> my note on ${escapeHtml(ref)}</span>`;
        edit.addEventListener("click", () => onEdit(record, edit, edit));
        li.append(edit);
      }
      list.append(li);
    }
    band.append(list);

    // A new note on this paragraph's first verse.
    const first = Number(block.querySelector("[data-verse]")?.getAttribute("data-verse"));
    if (onAddNote && Number.isInteger(first) && first > 0) {
      const add = document.createElement("button");
      add.type = "button";
      add.className = "desk-band__button desk-band__add";
      add.innerHTML = `Add a note<span class="sr-only"> on ${escapeHtml(`${here.label}:${first}`)}</span>`;
      add.addEventListener("click", () =>
        onAddNote({ bookKey: here.bookKey, chapter: here.chapter, verse: first, endVerse: first }, add),
      );
      band.append(add);
    }
    return band;
  }

  store.subscribe(load);
  document.addEventListener(SETTINGS_EVENT, redraw);
  document.addEventListener(HIDDEN_EVENT, redraw);
  // Opening and closing are the reader's own asks: draw (or clear) at once,
  // holding the line.
  document.addEventListener(INTERLEAF_EVENT, () => keepReadingPlace(draw));
  load();

  return { refresh: redraw };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
