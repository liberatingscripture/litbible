// src/scripts/desk/actions.js
//
// "Yours": the reader's own actions in the verse menu and the selection
// panel (STUDY-DESK.md, placement 1). chapter-tools.js offers each panel
// through the `lit:panel-actions` event before placing it; this adds a row.
//   - Study View: Add a note, and Bookmark (Remove bookmark when the verse
//     has one). From the verse menu a note covers the whole verse or range;
//     from a selection it quotes the selected words.
//   - Study View also has "Show in notebook", which opens the Notebook panel
//     on "This verse" at the verse (N10), the first verse of a selection.
//     Offering it in the selection panel too keeps the way in when verse
//     numbers are hidden (audit C10).
//   - Read View: Bookmark only. Notes are a Study View tool, and Read View
//     shows none (audit C2; BVJ, 2026-10-07).
// Highlights join this row once BDR answers the overlap rule's details
// (talk-through item 20).

import { createRecord, quoteFields } from "../../lib/desk-records.mjs";
import { recordReference } from "../../lib/desk-store-core.mjs";
import { rangeToOffsets } from "../../lib/desk-anchor-dom.mjs";
import { bookKeyToLabel } from "../../data/books.js";
import { closePanel, currentPanel } from "../lit-panel.js";
import { openNoteEditor } from "./note-editor.js";
import { chapterText, pageChapter } from "./page.js";
import { showUndo } from "./undo-bar.js";

export function initActions({ store, ctx, showVerse = null }) {
  if (!store) return;
  const here = pageChapter();

  document.addEventListener("lit:panel-actions", (e) => {
    const d = e.detail;
    const where =
      d.view === "study" && here
        ? { bookKey: here.bookKey, chapter: here.chapter }
        : d.view === "read" && d.book && d.chapter
          ? { bookKey: d.book, chapter: d.chapter }
          : null;
    if (!where) return;

    const heading = document.createElement("p");
    heading.className = "lit-panel__subheading";
    heading.textContent = "Yours";

    const bookmark = button("Bookmark");
    const row = document.createElement("div");
    row.className = "lit-panel__row";
    if (d.view === "study") {
      const note = button("Add a note");
      note.addEventListener("click", () => addNote(d, where, note));
      row.append(note);
      row.classList.add("lit-panel__row--halves");
    }
    row.append(bookmark);
    d.append(heading);
    d.append(row);
    if (d.view === "study" && showVerse) {
      const show = button("Show in notebook");
      show.addEventListener("click", () => {
        d.acting?.();
        closePanel();
        showVerse(d.start);
      });
      const second = document.createElement("div");
      second.className = "lit-panel__row";
      second.append(show);
      d.append(second);
    }

    // A bookmark is one verse: the first the menu or selection covers.
    const verse = d.start;
    let existing = null;
    store
      .byChapter(where.bookKey, where.chapter)
      .then((records) => {
        existing = records.find((r) => r.kind === "bookmark" && r.verse === verse) ?? null;
        if (existing) bookmark.textContent = "Remove bookmark";
      })
      .catch(() => {});

    bookmark.addEventListener("click", async () => {
      d.acting?.();
      const ref = `${bookKeyToLabel(where.bookKey)} ${where.chapter}:${verse}`;
      if (existing) {
        const trash = await store.remove(existing.id);
        bookmark.textContent = "Removed ✓";
        setTimeout(closePanel, 700);
        if (trash) {
          showUndo(`Bookmark on ${ref} removed.`, async () => {
            if (!(await store.undo(trash.id))) throw new Error("nothing to bring back");
          });
        }
        return;
      }
      const now = new Date().toISOString();
      await store.save(
        createRecord("bookmark", { ...where, verse, endVerse: verse }, { now, ...ctx() }),
      );
      bookmark.textContent = "Bookmarked ✓";
      setTimeout(closePanel, 700);
    });
  });

  function addNote(d, where, btn) {
    d.acting?.();
    let draft = { ...where, verse: d.start, endVerse: d.end };
    if (d.kind === "selection" && d.range) {
      try {
        const text = chapterText();
        const offsets = rangeToOffsets(text, d.range);
        if (offsets) draft = { ...where, ...quoteFields(text, offsets[0], offsets[1]) };
      } catch (err) {
        console.error("Study Desk: couldn't read the selection; the note covers its verses", err);
      }
    }
    // Opens beside what the menu was opened from: the verse number, or the
    // selection.
    const trigger = (d.kind === "selection" && d.range) || currentPanel()?.trigger || btn;
    const restoreFocus = currentPanel()?.restoreFocus ?? null;
    openNoteEditor({ trigger, store, ctx, ref: recordReference(draft), draft, restoreFocus });
  }
}

function button(label) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "lit-panel__btn";
  b.textContent = label;
  return b;
}
