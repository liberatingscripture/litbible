// src/scripts/desk/actions.js
//
// "My Notebook": the reader's own actions in the verse menu and the selection
// panel (STUDY-DESK.md, placement 1). chapter-tools.js offers each panel
// through the `lit:panel-actions` event before placing it; this adds a row.
//   - Chapter View: Add a note, and Bookmark (Remove bookmark when the verse
//     has one). From the verse menu a note covers the whole verse or range;
//     from a selection it quotes the selected words.
//   - Chapter View also has "Show in Notebook", which opens the Notebook panel
//     on "This verse" at the verse (N10), the first verse of a selection.
//     Offering it in the selection panel too keeps the way in when verse
//     numbers are hidden (audit C10).
//   - Highlight: four colours, and Remove highlight once the words hold one.
//     From the verse menu it marks the whole verse or range; from a selection,
//     the selected words. Chapter View always offers it; Read View's selection
//     panel offers it only while Read View's highlights are shown (audit C2),
//     since a mark made where it can't be seen would be a puzzle. How a new
//     highlight meets the ones already there (merging, trimming, leaving a
//     changed one alone) is src/lib/desk-highlights.mjs's; this reads the
//     page, asks it for a plan, and commits that.
//   - Edit bookmark…, right after Remove bookmark once the verse holds one: its
//     name and "Move as I read" (E9, bookmark-form.js). Pressing Bookmark opens
//     the same form at once (BVJ, 2026-11-04), so it is named as it is made.
//     A bookmark that moves has "Start following" beside its Edit (E44).
//   - "Print ▸" after Bookmark (E40, print-part.js): this verse or range (Chapter
//     View's verse menu) or the selected words (either view's selection panel),
//     plainly, with my notes, or with room to write. Its flyout is the shared
//     one (panel-flyout.js), as Bookmark's is.
//   - "Add to sheet ▸" after Print, in Chapter View only (S12, part 2;
//     sheets/sheet-add.js): the reader's sheets and New sheet.
//   - Read View: Bookmark and Highlight only. Notes are a Chapter View tool, and
//     Read View shows none (audit C2; BVJ, 2026-10-07).
//   - /desk's LIT pane (3f, 3g): Add a note, Bookmark and Highlight, with the chapter and its text from the panel's detail (`book`,
//     `chapter`, `textFor`), so a pane's own words are read even when another
//     pane shows the same chapter. Highlights are drawn on the pane as on
//     Chapter View (highlights.js), under Chapter View's setting.

import { COLORS, createRecord, quoteFields } from "../../lib/desk-records.mjs";
import { bookmarksOn, planBookmark, planUnbookmark, planWrite, recordReference } from "../../lib/desk-store-core.mjs";
import { rangeOf } from "../../lib/anchor-core.mjs";
import { rangeToOffsets } from "../../lib/desk-anchor-dom.mjs";
import {
  COLOR_WORDS,
  overlappingHighlights,
  placeHighlights,
  planHighlight,
} from "../../lib/desk-highlights.mjs";
import { bookKeyToLabel } from "../../data/books.js";
import { bookmarkedMessage, highlightedMessage } from "../../lib/desk-announce.mjs";
import { closePanel, currentPanel } from "../lit-panel.js";
import { flyoutRow } from "../panel-flyout.js";
import { partChoices } from "../../lib/desk-print-part.mjs";
import { openBookmarkForm } from "./bookmark-form.js";
import { followsHere, isPausedHere, restingId } from "./bookmark-follow.js";
import { startFollowingNow, stopFollowingNow } from "./bookmark-stop.js";
import { openNoteEditor } from "./note-editor.js";
import { createSheetAdd } from "./sheets/sheet-add.js";
import { getSetting, hiddenNotice, highlightSetting, highlightsSupported, setSetting } from "./note-settings.js";
import { blockAt, chapterText, chapterTextFor, pageChapter } from "./page.js";
import { undoEntry } from "./history.js";
import { announce, showNotice, showUndo } from "./undo-bar.js";

export function initActions({ store, ctx, showVerse = null, printPart = null }) {
  if (!store) return;
  const here = pageChapter();
  const sheetRow = createSheetAdd({ store, ctx });

  document.addEventListener("lit:panel-actions", (e) => {
    const d = e.detail;
    const where =
      d.view === "study" && here
        ? { bookKey: here.bookKey, chapter: here.chapter }
        : (d.view === "read" || d.view === "desk") && d.book && d.chapter
          ? { bookKey: d.book, chapter: d.chapter }
          : null;
    if (!where) return;
    const notes = d.view === "study" || d.view === "desk";

    const heading = document.createElement("p");
    heading.className = "lit-panel__subheading";
    // "My Notebook" (BVJ, 2026-10-09; it was "Yours").
    heading.textContent = "My Notebook";

    // "Add bookmark" while the verse holds none (BVJ, 2026-11-04); once it does, a "Bookmark ▸" flyout takes its place.
    const bookmark = button("Add bookmark");
    const row = document.createElement("div");
    row.className = "lit-panel__row";
    if (notes) {
      const note = button("Add a note");
      note.addEventListener("click", () => addNote(d, where, note));
      row.append(note);
      row.classList.add("lit-panel__row--halves");
    }
    row.append(bookmark);
    d.append(heading);
    d.append(row);
    // What the verse holds, drawn once the notebook has been read: each bookmark
    // that belongs to it with Remove and Edit bookmark… right beside, an add
    // button for the kind it lacks, and the one this tab is following, which
    // only rests here (BVJ, 2026-11-04).
    const bookmarkBox = document.createElement("div");
    bookmarkBox.className = "desk-bookmark-menu";
    d.append(bookmarkBox);
    // "Print ▸" right after Bookmark (E40): this verse or selection on paper.
    const printBox = printRow(d, where);
    if (printBox) d.append(printBox);
    // "Add to sheet ▸" right after it (S12): Chapter View only.
    const sheetBox = sheetRow(d, where);
    if (sheetBox) d.append(sheetBox);
    // Chapter View and /desk always offer Highlight (pressing a colour turns the
    // page's highlights on if they were hidden); Read View's panel only while that
    // view shows them. No row when this page can't read the words (the chapter
    // isn't on it), since a mark can't be placed without them.
    if (highlightsSupported() && (d.view !== "read" || getSetting(highlightSetting()) === "on") && markOf(d, where)) {
      d.append(highlightRow(d, where));
    }
    // Show in Notebook (Chapter View).
    const second = document.createElement("div");
    second.className = "lit-panel__row";
    if (d.view === "study" && showVerse) {
      const show = button("Show in Notebook");
      show.addEventListener("click", () => {
        d.acting?.();
        closePanel();
        showVerse(d.start);
      });
      second.append(show);
    }
    second.hidden = second.childElementCount < 1;
    d.append(second);

    // A bookmark is one verse: the first the menu or selection covers.
    const verse = d.start;
    const place = { ...where, verse };
    const ref = `${bookKeyToLabel(where.bookKey)} ${where.chapter}:${verse}`;

    // One press is one change: a button stands down until the panel closes, and
    // each change is planned over the notebook as it is when written, so a press
    // before the panel has read the chapter never saves a second bookmark of a
    // kind the verse holds (BA16).
    let busy = false;
    const guarded = (btn, work) => async () => {
      if (busy) return;
      busy = true;
      btn.setAttribute("aria-disabled", "true");
      d.acting?.();
      try {
        await work(btn);
      } catch (err) {
        console.error("Study Desk: the bookmark couldn't be changed", err);
        // Said in the bar, as the editor says it in its own place (NB8-2). The
        // menu stays open, so the press can be tried again.
        showNotice("That couldn’t be saved in this browser, so nothing changed. Try again.");
        busy = false;
        btn.removeAttribute("aria-disabled");
      }
    };

    // Make a bookmark of the given kind and open its form, the switch fixed at
    // the kind (`lock`) when the verse already holds the other one.
    const addBookmark = (follow, lock) => async (btn) => {
      const now = new Date().toISOString();
      const record = createRecord("bookmark", { ...place, endVerse: verse, ...(follow ? { follow: true } : {}) }, { now, ...ctx() });
      const resting = restingId();
      await store.change(({ all }) => all().then((records) => planBookmark(records, record, { except: resting })));
      const hidden = hiddenNotice("bookmarks", bookmarkedMessage(ref));
      if (hidden) showUndo(hidden.message, hidden.show, { label: hidden.label });
      else announce(bookmarkedMessage(ref));
      // The form for its name and "Move as I read" opens at once, in the menu's
      // place (BVJ, 2026-11-04); closing it leaves the bookmark as made.
      editBookmark(d, record, btn, lock);
    };

    const removeBookmark = (b) => async (btn) => {
      const resting = restingId();
      const plan = await store.change(({ all }) =>
        all().then((records) => planUnbookmark(records, place, ctx(), { id: b.id, except: resting })),
      );
      // The change this made, read at once: the undo button, like Ctrl+Z, takes
      // back exactly this one (history.js).
      const entry = plan ? store.lastEntry() : null;
      btn.textContent = "Removed ✓";
      setTimeout(closePanel, 700);
      if (entry) showUndo(`Bookmark on ${ref} removed.`, () => undoEntry(entry));
    };

    const lineOf = (...buttons) => {
      const r = document.createElement("div");
      r.className = "lit-panel__row";
      r.append(...buttons);
      return r;
    };

    function drawBookmarks(records) {
      const resting = restingId();
      const held = bookmarksOn(records, place, { except: resting });
      const restingHere = resting ? bookmarksOn(records, place).find((b) => b.id === resting) : null;
      bookmarkBox.replaceChildren();
      const items = [];
      // With nothing of its own on the verse, the one button adds a plain bookmark.
      bookmark.hidden = held.length > 0;
      // The note button takes the whole row when Bookmark steps aside.
      row.classList.toggle("lit-panel__row--halves", notes && !bookmark.hidden);
      const kindWord = (b) => (b.follow === true ? "bookmark that moves" : "bookmark that stays put");
      for (const b of held) {
        const both = held.length > 1;
        // "Remove bookmark “Advent”": the name, cut where it won't fit, after the
        // word that says what is removed (BVJ, 2026-11-04); the full name is the
        // button's accessible name.
        const named = b.label ? `bookmark ${shownName(b.label)}` : both ? kindWord(b) : "bookmark";
        const whole = b.label ? `bookmark “${b.label}”` : named;
        const remove = button(`Remove ${named}`);
        remove.setAttribute("aria-label", `Remove ${whole}`);
        remove.addEventListener("click", guarded(remove, removeBookmark(b)));
        const edit = button(b.label || both ? `Edit ${named}…` : "Edit bookmark…");
        edit.setAttribute("aria-label", `Edit ${whole}`);
        edit.addEventListener("click", () => editBookmark(d, b, edit));
        // Edit sits right beside Remove (BVJ, 2026-11-04). A bookmark that
        // moves, and isn't the one this tab follows (that one only rests here,
        // below), has "Start following" beside Edit (E44), where this page
        // can follow the reader.
        const line = [edit];
        if (b.follow === true && followsHere()) {
          const start = button("Start following");
          start.setAttribute("aria-label", `Start following ${whole}`);
          start.addEventListener("click", () => {
            d.acting?.();
            startFollowingNow(b, ref);
            closePanel();
          });
          line.push(start);
        }
        items.push(lineOf(remove), lineOf(...line));
      }
      // A verse takes a bookmark of each kind; the one it lacks may be added.
      if (held.length) {
        if (!held.some((b) => b.follow === true)) {
          const add = button("Add a bookmark that moves");
          add.addEventListener("click", guarded(add, addBookmark(true, true)));
          items.push(lineOf(add));
        }
        if (!held.some((b) => b.follow !== true)) {
          const add = button("Add a bookmark that stays put");
          add.addEventListener("click", guarded(add, addBookmark(false, false)));
          items.push(lineOf(add));
        }
      }
      // The bookmark this tab is moving rests here: it isn't the verse's, so there
      // is no Remove, only letting it stay here, or editing it.
      if (restingHere) {
        const paused = isPausedHere(restingHere.id);
        const name = restingHere.label ? `“${restingHere.label}”` : "A bookmark";
        const line = document.createElement("p");
        line.className = "lit-panel__hint";
        line.textContent = `${name} is resting here while it ${paused ? "waits for you" : "follows you"}.`;
        const leave = button("Leave it here");
        leave.addEventListener("click", () => {
          d.acting?.();
          stopFollowingNow(ref);
          closePanel();
        });
        const edit = button("Edit bookmark…");
        edit.addEventListener("click", () => editBookmark(d, restingHere, edit));
        items.push(line, lineOf(leave, edit));
      }
      // Once the verse holds bookmarks, a mouse gets them in one "Bookmark ▸"
      // flyout (BVJ, 2026-11-04); a finger's chips stay flat, and a verse with
      // none keeps its one press.
      const flat = Boolean(d.panel?.classList.contains("lit-panel--chips"));
      if (items.length && !flat) {
        const name = held.length ? "Bookmark" : isPausedHere(restingHere.id) ? "Paused bookmark" : "Following bookmark";
        bookmarkBox.append(flyoutRow(name, items, { pointerFocus: d.kind !== "selection" }));
      } else {
        bookmarkBox.append(...items);
      }
    }

    // Until the notebook is read, the one button is a plain Bookmark.
    bookmark.addEventListener("click", guarded(bookmark, addBookmark(false, null)));
    store
      .byChapter(where.bookKey, where.chapter)
      .then(drawBookmarks)
      .catch((err) => console.error("Study Desk: the verse menu couldn't draw the verse's bookmarks", err));
  });

  /**
   * The "Print ▸" flyout (E40): the verse or range (Chapter View's verse
   * menu) or the selected words (either view's selection panel) printed
   * plainly, with my notes, or with room to write (desk/print-part.js). A
   * finger's chips stay flat, under a small "Print" heading. Null where the
   * page can't print a part, and for a panel whose words it can't read.
   */
  function printRow(d, where) {
    if (!printPart?.can()) return null;
    const verses = d.kind === "verse" && d.view === "study";
    const words = d.kind === "selection" && (d.view === "study" || d.view === "read") && Boolean(d.richText);
    if (!verses && !words) return null;
    const run = (kind) => {
      d.acting?.();
      const part = { start: d.start, end: d.end, ref: d.ref };
      closePanel();
      if (words) {
        window.getSelection()?.removeAllRanges();
        return printPart.printSelection(kind, { ...part, bookKey: where.bookKey, chapter: where.chapter, richText: d.richText });
      }
      return printPart.printVerses(kind, part);
    };
    const items = partChoices({ what: words ? "selection" : "verse", start: d.start, end: d.end, notebook: true }).map((c) => {
      const b = button(c.label);
      b.addEventListener("click", () => {
        run(c.kind).catch((err) => console.error("Study Desk: the print didn't start", err));
      });
      return b;
    });
    if (d.panel?.classList.contains("lit-panel--chips")) {
      const box = document.createElement("div");
      box.className = "desk-print-part";
      const label = document.createElement("p");
      label.className = "lit-panel__subheading";
      label.textContent = "Print";
      box.append(label);
      for (const b of items) {
        const r = document.createElement("div");
        r.className = "lit-panel__row";
        r.append(b);
        box.append(r);
      }
      return box;
    }
    return flyoutRow("Print", items, { pointerFocus: d.kind !== "selection" });
  }

  // The bookmark is one verse: the first the menu or selection covers.
  function editBookmark(d, record, btn, lock = null) {
    d.acting?.();
    const trigger = (d.kind === "selection" && d.range) || currentPanel()?.trigger || btn;
    const restoreFocus =
      currentPanel()?.restoreFocus ?? (d.kind === "selection" ? verseNumberOf(d.range, d.start) : null);
    openBookmarkForm({ trigger, store, ctx, record, restoreFocus, lock });
  }

  function addNote(d, where, btn) {
    d.acting?.();
    let draft = { ...where, verse: d.start, endVerse: d.end };
    // The LIT pane on /desk reads its own chapter; Chapter View, the page's.
    const textOf = d.textFor ?? chapterText;
    if (d.kind === "selection" && d.range) {
      try {
        const text = textOf();
        const offsets = rangeToOffsets(text, d.range);
        if (offsets) draft = { ...where, ...quoteFields(text, offsets[0], offsets[1]) };
      } catch (err) {
        console.error("Study Desk: couldn't read the selection; the note covers its verses", err);
      }
    }
    // Opens beside what the menu was opened from: the verse number, or the
    // selection.
    const trigger = (d.kind === "selection" && d.range) || currentPanel()?.trigger || btn;
    // A selection's panel has no button to return to, so focus goes back to
    // the verse number the selection starts in once the note is saved or
    // cancelled (BA21).
    const restoreFocus =
      currentPanel()?.restoreFocus ?? (d.kind === "selection" ? verseNumberOf(d.range, d.start) : null);
    openNoteEditor({ trigger, store, ctx, ref: recordReference(draft), draft, restoreFocus, text: textOf });
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
      // The LIT pane on /desk reads its own chapter; Chapter View and Read
      // View, the page's.
      const text = d.textFor ? d.textFor() : chapterTextFor(where.bookKey, where.chapter);
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
      const mark = markOf(d, where);
      if (mark) {
        const { text } = mark;
        // Read, planned and written in one transaction, so a write from another
        // tab between the two can't be overwritten from a stale copy (DI-9).
        const plan = await store.change(async ({ all }) => {
          const records = (await all()).filter((r) => r.bookKey === where.bookKey && r.chapter === where.chapter);
          const placed = placeHighlights(text, records, ctx().contentVersion);
          const made = planHighlight({
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
          return { ...made, ...planWrite(made) };
        });
        const changed = plan.put.length > 0 || plan.remove.length > 0;
        const entry = changed ? store.lastEntry() : null;

        // A reader who just highlighted should see it, so hidden highlights
        // come back on; the most recent action wins. Only a colour does this:
        // taking a highlight off asks nothing of the switch.
        const name = highlightSetting();
        if (color && getSetting(name) === "off") setSetting(name, "on");

        const ref = recordReference({ ...where, verse: d.start, endVerse: d.end });
        if (entry && color === null) {
          showUndo(`Highlight on ${ref} removed.`, () => undoEntry(entry));
        } else if (entry && plan.summary.otherColors > 0) {
          showUndo(`${ref} highlighted ${COLOR_WORDS[color]}.`, () => undoEntry(entry));
        } else if (entry && color) {
          // A highlight touching no other colour has no bar to show, but
          // making one is still announced (BA18).
          announce(highlightedMessage(COLOR_WORDS[color], ref));
        }
        // The selection has done its job, and would hide the new colour.
        if (d.kind === "selection") window.getSelection()?.removeAllRanges();
      }
    } catch (err) {
      console.error("Study Desk: couldn't change the highlight", err);
      showNotice("The highlight couldn’t be saved in this browser, so nothing changed. Try again.");
    } finally {
      busy = false;
      closePanel();
    }
  }
}

/**
 * The verse number of `verse` in the chapter text `range` starts in: Study
 * View's, or the LIT pane's own (ids there carry the pane and chapter, hence
 * the suffix match). Null when it isn't to be found.
 */
function verseNumberOf(range, verse) {
  const at = range?.startContainer;
  const box = (at instanceof Element ? at : at?.parentElement)?.closest(".chapter-paragraphs");
  return box?.querySelector(`sup.vn[id$="v${verse}"]`) ?? null;
}

/** A bookmark's name as the menu shows it: in quotes, cut with an ellipsis when long. */
function shownName(name, max = 14) {
  const letters = Array.from(name);
  return `“${letters.length > max ? `${letters.slice(0, max).join("").trimEnd()}…` : name}”`;
}

function button(label) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "lit-panel__btn";
  b.textContent = label;
  return b;
}
