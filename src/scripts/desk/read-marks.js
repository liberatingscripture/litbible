// src/scripts/desk/read-marks.js
//
// Bookmarks in Read View's margin. Read View is for reading a book straight
// through, so it shows none of the reader's notes; bookmarks are the one
// piece of marginalia it shows (BVJ, 2026-10-08), the same red mark as in
// Study View (notes-margin.js), beside the verse, with the same
// "My bookmarks" switch. Like the notes, the marks sit in one <aside> at the
// end of <body> and add nothing to the text.

import { BOOK_ORDER } from "../../data/books.js";
import { NOTE_GAP, RIBBON } from "../../lib/desk-notes.mjs";
import { recordReference } from "../../lib/desk-store-core.mjs";
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
    if (getSetting("bookmarks") !== "on" || !marks.length || box.left < RIBBON + 12) {
      aside.hidden = true;
      return;
    }
    const right = box.left >= NOTE_GAP + RIBBON + 8 ? NOTE_GAP : 6;
    for (const r of marks) {
      const verse = text.querySelector(`[data-chapter="${r.chapter}"] [data-verse="${r.verse}"]`);
      const line = verse?.getClientRects()[0];
      if (!line) continue; // a draft chapter, or a verse the text doesn't have
      const block = verse.closest("[data-chapter]");
      const lineHeight = parseFloat(getComputedStyle(block).lineHeight) || line.height;
      const mark = document.createElement("span");
      mark.className = "desk-ribbon";
      mark.setAttribute("role", "img");
      mark.setAttribute("aria-label", `Bookmark, ${recordReference(r)}`);
      mark.title = `Bookmark, ${recordReference(r)}`;
      mark.innerHTML = glyph("bookmark", "desk-ribbon__glyph");
      mark.style.top = `${line.top + window.scrollY + (lineHeight - RIBBON) / 2}px`;
      mark.style.left = `${box.left + window.scrollX - right - RIBBON}px`;
      aside.append(mark);
    }
    aside.hidden = !aside.childElementCount;
  }

  store.subscribe(load);
  window.addEventListener("resize", schedule);
  document.addEventListener("desk:column-moved", schedule);
  document.addEventListener(SETTINGS_EVENT, schedule);
  document.fonts?.addEventListener?.("loadingdone", schedule);
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(text);
  new MutationObserver(schedule).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-size", "data-leading", "data-font", "data-vn", "data-desk-panel"],
  });
  load();
  return { refresh: schedule };
}
