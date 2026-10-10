// src/scripts/desk/actions.js
//
// "My Notebook": the reader's own actions in the verse menu and the selection
// panel (STUDY-DESK.md, placement 1). chapter-tools.js offers each panel
// through the `lit:panel-actions` event before placing it; this adds a row.
//   - Study View: Add a note, and Bookmark (Remove bookmark when the verse
//     has one). From the verse menu a note covers the whole verse or range;
//     from a selection it quotes the selected words.
//   - Study View also has "Show in notebook", which opens the Notebook panel
//     on "This verse" at the verse (N10), the first verse of a selection.
//     Offering it in the selection panel too keeps the way in when verse
//     numbers are hidden (audit C10).
//   - Highlight: four colours, and Remove highlight once the words hold one.
//     From the verse menu it marks the whole verse or range; from a selection,
//     the selected words. Study View always offers it; Read View's selection
//     panel offers it only while Read View's highlights are shown (audit C2),
//     since a mark made where it can't be seen would be a puzzle. How a new
//     highlight meets the ones already there (merging, trimming, leaving a
//     changed one alone) is src/lib/desk-highlights.mjs's; this reads the
//     page, asks it for a plan, and commits that.
//   - Read View: Bookmark and Highlight only. Notes are a Study View tool, and
//     Read View shows none (audit C2; BVJ, 2026-10-07).

import { COLORS, createRecord, quoteFields } from "../../lib/desk-records.mjs";
import { recordReference } from "../../lib/desk-store-core.mjs";
import { rangeOf } from "../../lib/anchor-core.mjs";
import { rangeToOffsets } from "../../lib/desk-anchor-dom.mjs";
import {
  COLOR_WORDS,
  overlappingHighlights,
  placeHighlights,
  planHighlight,
} from "../../lib/desk-highlights.mjs";
import { bookKeyToLabel } from "../../data/books.js";
import { closePanel, currentPanel } from "../lit-panel.js";
import { openNoteEditor } from "./note-editor.js";
import { getSetting, highlightSetting, setSetting } from "./note-settings.js";
import { blockAt, chapterText, chapterTextFor, pageChapter } from "./page.js";
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
    // "My Notebook" (BVJ, 2026-10-09; it was "Yours").
    heading.textContent = "My Notebook";

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
    // Study View always offers Highlight (pressing a colour turns the page's
    // highlights on if they were hidden); Read View's panel only while that
    // view shows them. No row when this page can't read the words (the chapter
    // isn't on it), since a mark can't be placed without them.
    if ((d.view === "study" || getSetting(highlightSetting()) === "on") && markOf(d, where)) {
      d.append(highlightRow(d, where));
    }
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

  /**
   * The words a panel acts on, as chapter text: { text, start, end }, or null
   * when this page doesn't show the chapter or the words can't be found. A
   * verse menu covers its verse or range; a selection, the selected words,
   * or its verses where the selection can't be read. The text is read fresh
   * on every call and used at once: its map points at today's DOM nodes, so
   * it is never kept across a change to the page.
   */
  function markOf(d, where) {
    try {
      const text = chapterTextFor(where.bookKey, where.chapter);
      if (!text) return null;
      let offsets = null;
      if (d.kind === "selection" && d.range) {
        try {
          offsets = rangeToOffsets(text, d.range);
        } catch (err) {
          console.error("Study Desk: couldn't read the selection; the highlight covers its verses", err);
        }
      }
      offsets ??= rangeOf(text, d.start, d.end);
      return offsets ? { text, start: offsets[0], end: offsets[1] } : null;
    } catch (err) {
      console.error("Study Desk: couldn't read the page for a highlight", err);
      return null;
    }
  }

  /**
   * The Highlight row: a swatch for each colour, then Remove highlight, which
   * stays hidden until the notebook says the words hold a highlight this
   * client may change (the way Bookmark learns "Remove bookmark"). It sits on
   * the swatches' line, so appearing moves nothing.
   */
  function highlightRow(d, where) {
    const group = document.createElement("div");
    group.className = "desk-hl-row";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Highlight");
    // Said once on the row, so four samples of colour read as what they do.
    // Screen readers have it from the group's name and each button's.
    const label = document.createElement("span");
    label.className = "desk-hl-row__label";
    label.setAttribute("aria-hidden", "true");
    label.textContent = "Highlight";
    group.append(label);
    for (const color of COLORS) {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "desk-swatch";
      swatch.dataset.color = color;
      const word = COLOR_WORDS[color];
      swatch.setAttribute("aria-label", `Highlight ${word}`);
      swatch.title = word.charAt(0).toUpperCase() + word.slice(1);
      const sample = document.createElement("span");
      sample.className = "desk-swatch__sample";
      sample.setAttribute("aria-hidden", "true");
      sample.textContent = "ab";
      swatch.append(sample);
      swatch.addEventListener("click", () => highlight(d, where, color));
      group.append(swatch);
    }

    const remove = button("Remove highlight");
    remove.hidden = true;
    remove.addEventListener("click", () => highlight(d, where, null));
    group.append(remove);

    store
      .byChapter(where.bookKey, where.chapter)
      .then((records) => {
        const mark = markOf(d, where);
        if (!mark) return;
        const placed = placeHighlights(mark.text, records, ctx().contentVersion);
        remove.hidden = !overlappingHighlights(placed, mark.start, mark.end).length;
      })
      .catch(() => {});
    return group;
  }

  // One press at a time: a second click while the first is still reading the
  // notebook would plan against records that don't have its result yet.
  let busy = false;

  /**
   * Highlight the panel's words in `color`, or take highlighting off them
   * (`color` null). The plan is made from the records and the page as they are
   * now, both read at the press.
   */
  async function highlight(d, where, color) {
    if (busy) return;
    busy = true;
    d.acting?.();
    try {
      const records = await store.byChapter(where.bookKey, where.chapter);
      const mark = markOf(d, where);
      if (mark) {
        const { text } = mark;
        const placed = placeHighlights(text, records, ctx().contentVersion);
        const plan = planHighlight({
          chapter: text,
          placed,
          start: mark.start,
          end: mark.end,
          color,
          blockAt: (pos) => blockAt(text, pos),
          where,
          now: new Date().toISOString(),
          ctx: ctx(),
        });
        const changed = plan.put.length > 0 || plan.remove.length > 0;
        if (changed) await store.commit(plan);

        // A reader who just highlighted should see it, so hidden highlights
        // come back on; the most recent action wins. Only a colour does this:
        // taking a highlight off asks nothing of the switch.
        const name = highlightSetting();
        if (color && getSetting(name) === "off") setSetting(name, "on");

        const ref = recordReference({ ...where, verse: d.start, endVerse: d.end });
        if (changed && color === null) {
          showUndo(`Highlight removed from ${ref}.`, () => undoPlan(plan));
        } else if (changed && plan.summary.otherColors > 0) {
          showUndo(`${ref} highlighted ${COLOR_WORDS[color]}.`, () => undoPlan(plan));
        }
        // The selection has done its job, and would hide the new colour.
        if (d.kind === "selection") window.getSelection()?.removeAllRanges();
      }
    } catch (err) {
      console.error("Study Desk: couldn't change the highlight", err);
    } finally {
      busy = false;
      closePanel();
    }
  }

  /**
   * Put back what a highlight changed. Undoing is the reader acting, so the
   * records it restores are stamped with the time of the undo: under the newer
   * `modified` wins rule they must outrank the edit they undo, or another
   * device would keep the edit.
   */
  function undoPlan(plan) {
    const at = new Date().toISOString();
    const { client } = ctx();
    return store.commit({
      put: plan.undo.put.map((r) => ({ ...r, modified: at, client })),
      remove: plan.undo.remove,
    });
  }
}

function button(label) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "lit-panel__btn";
  b.textContent = label;
  return b;
}
