// src/scripts/desk/tab-mine.js
//
// The Notebook panel's "My Notes" tab (BVJ, 2026-10-08: it holds bookmarks
// and highlights too): what the notebook keeps, with Delete, and for a note
// its marker glyph, its words at two lines and Edit. A caret opens one note
// for the visit; "Open all" above the list shows every note (and pinned
// footnote) in full, remembered until "Close all" (BVJ, 2026-10-13: the
// two together, replacing a checkbox at the panel's foot). A note on this page's chapter takes the reader to
// its place (BVJ, 2026-10-07: decision 7 under "the margin switch").
//
// A highlight is named by its colour ("Yellow highlight") and shows its
// words (the first 24) wearing the highlight's own tint and underline, the
// look the page and the menus' swatches give it, and, like a note's words,
// they go to its place. Lists group by colour (decided 2026-10-09): when the
// list holds a highlight, a row of choices above it narrows the list to one
// colour, and "All" brings everything back. That choice is kept for the
// visit only, and goes back to All when its colour leaves the list.
//
// Continue reading (continue-reading.js) heads the tab, with no bookmark mark:
// it is where the reader stopped, not something they marked. A bookmark is a
// row in the list like a note (E9): its name, Edit (the name, and "Move as I
// read"), and Delete. One that moves as the reader reads says so, and following
// its link starts it moving (bookmark-follow.js).
//
// A record whose wording has changed under it (change-notice.js) carries a
// flag under its words, "Wording changed · Review" (or "Not in the text ·
// Review" when its verses are gone), which opens the card beside it, and a
// line above the list counts them. A notice is judged only where the
// chapter's text is on the page, so on Chapter View's "Everything" list only
// this chapter's records can carry one, and in Read View only this book's.
//
// When a publish since the reader last looked touched their verses, one line
// says so, linking to the notebook page's "What's new for you" (whats-new.js).
//
// Pinned footnotes (pins.js) are their own group under the list, "Pinned
// footnotes": each with its reference, the footnote as it read when pinned,
// cut at a few lines, Unpin, and a way to it: on its own chapter the
// Footnotes list, scrolled to and focused; anywhere else its verse's page.
// A pin whose footnote was rewritten carries the same flag the notes do.
// The group follows the list's scope and hides while a highlight colour is
// chosen, since that choice is about highlights.
//
// On a Chapter View chapter the tab starts on that chapter's records, and a
// small choice at its top switches to everything kept; on an article or the
// glossary it starts on the notes on this page (N11); elsewhere it lists
// everything. An article also offers a note on the whole article here.
// N11 is out of version 1 (note-sources.js, PROSE_NOTES), so for now an
// article and the glossary list everything, with no such offer.
//
// On /desk (3g; BVJ, 2026-10-19) the tab is a pane that follows the LIT
// pane, as This verse does, but by keeping its list as it is and scrolling
// it: as the reader moves through the text, the pane makes sure the records
// on the passage being read are in view (`follow`), without lining them up
// with their verses. Notes never sit beside a pane's text there. A
// record's reference and words move the LIT pane to it (`goHere`).
//
// Labels (M8) narrow the list the way colours do: when any label is on a
// record in the list, a row of choices above it narrows it to one label. They
// are made on the notebook page (/notebook/) and put on a record there or with
// its "Labels…" button.
//
// This is also what "What I've kept" was (E17, BVJ, 2026-11-02; kept-list.js
// still draws that list on the notebook page): a search over words, a
// reference and labels, a "Show" choice of kind, a count in words, and the
// list in Bible order under a heading for each chapter (and for notes on
// glossary entries, notes on articles, and anything else) once it spans more
// than one. Those headings are rows of the list, so a row is found by
// `.desk-item`, never by its position.
//
// On /desk the list follows the LIT pane (E22): the row followed to is the
// first record at or after the reading line (the last before it, with none
// after), scrolled to when out of view and marked `aria-current="location"`
// when it is in the chapter being read. With nothing kept in that chapter a
// line says so, and the list shows the nearest records instead of staying put.

import { shortQuote } from "../../lib/desk-notes.mjs";
import { COLORS, canEdit, onFootnote } from "../../lib/desk-records.mjs";
import { isFollowing } from "../../lib/desk-bookmarks.mjs";
import { labelMap, labelsOf, liveLabels } from "../../lib/desk-labels.mjs";
import { describeCounts, filterRecords, followTarget, groupRecords, kindsPresent, listable } from "../../lib/desk-notebook.mjs";
import { passageLabel } from "../../lib/desk-passage.mjs";
import {
  kindName,
  liveRecords,
  recordHref,
  recordReadHref,
  recordReference,
  recordWhere,
  takeOff,
} from "../../lib/desk-store-core.mjs";
import { currentPanel } from "../lit-panel.js";
import { flagButton, noticesFor, openNotice } from "./change-notice.js";
import { labelsSubject, openLabelsPopover } from "./labels-ui.js";
import { glyph } from "./glyphs.js";
import { fillNoteWords } from "./note-words.js";
import { undoEntry } from "./history.js";
import { SETTINGS_EVENT, getSetting, setSetting } from "./note-settings.js";
import { canRevealFootnote, revealFootnote, unpinRecord } from "./pins.js";
import { drawBookmarkLine, followBookmark, stopFollowing } from "./bookmark-follow.js";
import { continueSection } from "./continue-reading.js";
import { showUndo } from "./undo-bar.js";

// A note's caret in the list: down to show the rest, turned up while open.
const ICON_CARET = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
  stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M6 9l6 6 6-6" /></svg>`;

// The words of a highlight shown in the list: about this many.
const HIGHLIGHT_WORDS = 24;
// A note on a footnote quotes this many words of the footnote.
const FOOTNOTE_WORDS = 12;

// Numbers each tab's ids, since /desk can show several My Notes panes.
let seq = 0;

/** A highlight's colour if the format knows it; null for anything else, which is shown plainly. */
function colorOf(r) {
  return r?.kind === "highlight" && COLORS.includes(r.color) ? r.color : null;
}

/** What a reader calls a record's kind: "Yellow highlight", or the plain kind name. */
function nameOf(r) {
  const color = colorOf(r);
  return color ? `${color[0].toUpperCase()}${color.slice(1)} highlight` : kindName(r.kind);
}

/**
 * A highlight's words as the page shows them: a swatch wrapped round a sample,
 * which desk.css gives the colour's tint and underline. A colour the format
 * doesn't know gets plain text.
 */
function highlightedWords(color, words) {
  if (!color) return document.createTextNode(words);
  const swatch = document.createElement("span");
  swatch.className = "desk-swatch";
  swatch.dataset.color = color;
  const sample = document.createElement("span");
  sample.className = "desk-swatch__sample";
  sample.textContent = words;
  swatch.append(sample);
  return swatch;
}

/**
 * @param {{ store: object | null, storeError: unknown,
 *   scope: { label: string, empty: string, load: (store: object) => Promise<object[]> } | null,
 *   addAction?: { label: string, run: (trigger: Element) => void } | null,
 *   inReadView: boolean, visible: () => boolean, afterRender?: () => void,
 *   onEdit?: (record: object, trigger: Element) => void,
 *   goHere?: { can(record: object): boolean, go(record: object): void } | null,
 *   ctx?: (() => object) | null,
 *   showInText?: { can(record: object): boolean, go(record: object): void } | null }} options
 *   `visible` says whether the tab can be seen, so a hidden one isn't drawn;
 *   `afterRender` lets the panel bring its foot up to date. `ctx` and
 *   `showInText` are what the change notice's card needs.
 * @returns {{ el: HTMLElement, render: (opts?: { focusIndex?: number | null }) => Promise<void>,
 *   follow: (passage: object) => void, destroy: () => void }}
 */
export function createMineTab({ store, storeError, scope: pageScope = null, addAction = null, inReadView, visible, afterRender = () => {}, onEdit = null, goHere = null, ctx = null, showInText = null }) {
  const n = ++seq;
  // Which colour the list is narrowed to (null: everything), and the label
  // (an id; null: everything). Each tab's own, so two My Notes panes on /desk
  // narrow apart (BA31); a tab lasts the visit.
  let colorFilter = null;
  let labelFilter = null;
  // The search words and the kind chosen in "Show" (a record kind; null for
  // everything), likewise this tab's own.
  let query = "";
  let kindFilter = null;
  // Whether anything narrows the list now, and the record whose Labels… button
  // opened the popover now showing (so a redraw can point the popover at the
  // button that replaces it).
  let narrowed = false;
  let labelsRow = null;
  const el = document.createElement("div");
  el.className = "desk-mine";
  el.innerHTML = `
    ${pageScope ? `<div class="desk-seg desk-mine__scope" role="radiogroup" aria-label="Which of my notes">
      <label class="desk-seg__option">
        <input type="radio" class="desk-seg__input" name="desk-mine-scope" value="chapter" checked />
        <span class="desk-seg__text"></span>
      </label>
      <label class="desk-seg__option">
        <input type="radio" class="desk-seg__input" name="desk-mine-scope" value="everything" />
        <span class="desk-seg__text">Everything</span>
      </label>
    </div>` : ""}
    ${addAction && store ? `<button type="button" class="desk-mine__add"></button>` : ""}
    <div class="desk-mine__filters" role="search" aria-label="Filter my notebook" hidden>
      <div class="desk-mine__field desk-mine__field--grow">
        <label for="deskMineQuery${n}">Search my notebook</label>
        <input type="search" id="deskMineQuery${n}" autocomplete="off" placeholder="Words, a reference, a label" />
      </div>
      <div class="desk-mine__field">
        <label for="deskMineKind${n}">Show</label>
        <select id="deskMineKind${n}"></select>
      </div>
    </div>
    <div class="desk-mine__colors" role="group" aria-label="Show highlights of one color" hidden></div>
    <div class="desk-mine__labels" role="group" aria-label="Show items with one label" hidden></div>
    <p class="desk-mine__whatsnew" hidden><a href="/notebook/#whats-new"></a></p>
    <p class="desk-mine__changed" hidden></p>
    <p class="desk-mine__count" hidden></p>
    <p class="desk-mine__here" hidden></p>
    <button type="button" class="desk-mine__all" hidden></button>
    <ul class="desk-list"></ul>
    <p class="desk-panel__empty" hidden></p>
    <section class="desk-mine__pins" aria-labelledby="deskMinePinsTitle${n}" hidden>
      <h3 class="desk-mine__pins-title" id="deskMinePinsTitle${n}">Pinned footnotes</h3>
      <ul class="desk-list desk-mine__pin-list"></ul>
    </section>`;
  if (pageScope) el.querySelector(".desk-seg__text").textContent = pageScope.label;
  // Continue reading (continue-reading.js) sits above everything else, whatever the scope.
  const continued = continueSection();
  el.prepend(continued);
  const addButton = el.querySelector(".desk-mine__add");
  if (addButton) {
    addButton.textContent = addAction.label;
    addButton.addEventListener("click", () => addAction.run(addButton));
  }

  // The tab's own list, not Continue reading's (also a .desk-list, and first
  // in the tree now that it is prepended): each drew into the other's list.
  const list = el.querySelector(":scope > .desk-list");
  const empty = el.querySelector(".desk-panel__empty");
  const pinBox = el.querySelector(".desk-mine__pins");
  const pinList = el.querySelector(".desk-mine__pin-list");
  const colors = el.querySelector(".desk-mine__colors");
  const labelRow = el.querySelector(".desk-mine__labels");
  const changed = el.querySelector(".desk-mine__changed");
  const whatsNew = el.querySelector(".desk-mine__whatsnew");
  const allButton = el.querySelector(".desk-mine__all");
  const filterBox = el.querySelector(".desk-mine__filters");
  const queryBox = el.querySelector(`#deskMineQuery${n}`);
  const kindSelect = el.querySelector(`#deskMineKind${n}`);
  const countLine = el.querySelector(".desk-mine__count");
  const hereLine = el.querySelector(".desk-mine__here");
  // The rows of the list; headings sit among them.
  const rowsOf = () => list.querySelectorAll(":scope > .desk-item");
  const rowOf = (id) => list.querySelector(`:scope > .desk-item[data-id="${CSS.escape(id)}"]`);
  queryBox.addEventListener("input", () => {
    query = queryBox.value;
    render();
  });
  kindSelect.addEventListener("change", () => {
    kindFilter = kindSelect.value || null;
    // A colour only means something among highlights.
    if (kindFilter && kindFilter !== "highlight") colorFilter = null;
    render();
  });
  allButton.addEventListener("click", () => {
    if (getSetting("listFull") === "full") {
      openNotes.clear();
      for (const row of list.querySelectorAll(".desk-item__note-row--open")) {
        row.classList.remove("desk-item__note-row--open");
        row.querySelector(".desk-item__more")?.setAttribute("aria-expanded", "false");
      }
      setSetting("listFull", "lines");
    } else setSetting("listFull", "full");
  });
  const openNotes = new Set(); // notes clicked open in the list, for this visit
  let scope = pageScope ? "chapter" : "everything";
  for (const radio of el.querySelectorAll(".desk-mine__scope input")) {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      scope = radio.value;
      render();
    });
  }

  let shown = []; // the records the list shows now, in its order
  let following = null; // the passage /desk's LIT pane is at (follow)
  let followedOnce = false;

  /**
   * /desk: make sure the records on this passage are in view. The row looked
   * for is `followTarget`'s; when it is already in view the list stays put,
   * so a reader moving through the text sees it move only as needed. With
   * nothing kept in the chapter the nearest records are brought up instead,
   * and a line says there is nothing here (`markHere`).
   */
  function follow(p) {
    following = p ?? null;
    markHere();
    if (!p?.bookKey || !list.isConnected) return;
    const hit = followTarget(shown, p);
    const row = hit ? rowOf(hit.record.id) : null;
    const box = row ? scroller(el) : null;
    if (!box) return;
    const r = row.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    if (r.top >= b.top && r.bottom <= b.bottom) return;
    box.scrollTop = Math.max(0, box.scrollTop + (r.top - b.top) - 8);
  }

  /**
   * Mark the row being followed to (E22) when it is in the chapter being
   * read, and say so when nothing in the list is.
   */
  function markHere() {
    for (const row of list.querySelectorAll('[aria-current="location"]')) row.removeAttribute("aria-current");
    const hit = following?.bookKey ? followTarget(shown, following) : null;
    if (hit?.here) rowOf(hit.record.id)?.setAttribute("aria-current", "location");
    const label =
      following?.bookKey && following.chapter ? passageLabel({ bookKey: following.bookKey, chapter: following.chapter }) : "";
    const say = Boolean(label) && shown.length > 0 && !hit?.here;
    hereLine.hidden = !say;
    if (say) hereLine.textContent = `${narrowed ? "Nothing shown" : "Nothing kept"} in ${label}.`;
  }

  let renderSeq = 0;
  async function render({ focusIndex = null, focusPin = null } = {}) {
    if (!visible() && focusIndex === null && focusPin === null) return;
    const seq = ++renderSeq;
    if (!store) {
      list.replaceChildren();
      shown = [];
      filterBox.hidden = true;
      countLine.hidden = true;
      hereLine.hidden = true;
      pinBox.hidden = true;
      colors.hidden = true;
      labelRow.hidden = true;
      changed.hidden = true;
      empty.hidden = false;
      empty.textContent =
        "This browser isn’t letting the site keep a notebook. Private windows sometimes don’t. Open the site in a regular window to keep notes.";
      if (storeError) console.error("Study Desk: the notebook didn't open", storeError);
      return;
    }
    const everyRecord = await store.all(); // once a render: a clone of every sheet too (DK-5)
    const everything =
      scope === "chapter" && pageScope ? await pageScope.load(store) : liveRecords(everyRecord);
    if (seq !== renderSeq) return; // a newer render has started
    // Pins have a group of their own, and a reading place another client kept
    // is not listed (E9: only what the reader marked); nor is a label, which
    // is not a mark at all (`listable`).
    const marks = listable(everything);
    const kept = marks.filter((r) => r.kind !== "footnotePin");
    const allPins = marks.filter((r) => r.kind === "footnotePin");
    continued.refresh();

    // The colours this list holds. A choice of colour that has left it (the
    // last of its highlights deleted, or the list changed to another scope)
    // goes back to All rather than leaving an empty list under a choice.
    const present = COLORS.filter((c) => kept.some((r) => colorOf(r) === c));
    if (colorFilter && !present.includes(colorFilter)) colorFilter = null;
    drawColors(present);
    // The labels on something in this list; a choice that has left it goes
    // back to All, as the colour does.
    const labels = liveLabels(everyRecord);
    if (seq !== renderSeq) return;
    const inUse = labels.filter((l) => everything.some((r) => (r.labels ?? []).includes(l.id)));
    if (labelFilter && !inUse.some((l) => l.id === labelFilter)) labelFilter = null;
    drawLabels(inUse);
    const kinds = kindsPresent(marks);
    if (kindFilter && !kinds.some((k) => k.value === kindFilter)) kindFilter = null;
    drawFilters(kinds, marks.length > 0);

    narrowed = Boolean(query.trim() || kindFilter || colorFilter || labelFilter);
    const labelsById = labelMap(everyRecord);
    const matched = filterRecords(marks, { query, kind: kindFilter, color: colorFilter, labelId: labelFilter }, labelsById);
    const records = matched.filter((r) => r.kind !== "footnotePin");
    const pins = matched.filter((r) => r.kind === "footnotePin");
    const notices = store && ctx ? noticesFor([...records, ...pins]) : new Map();
    drawChanged([...records, ...pins], notices);
    drawCount(marks, matched);

    // In Bible order, under a heading for each chapter once there is more
    // than one place to tell apart.
    const groups = groupRecords(records);
    const sections = [];
    for (const book of groups.books) {
      for (const chapter of book.chapters) sections.push({ title: chapter.label, records: chapter.records });
    }
    if (groups.glossary.length) sections.push({ title: "Notes on glossary entries", records: groups.glossary });
    if (groups.articles.length) sections.push({ title: "Notes on articles", records: groups.articles });
    if (groups.other.length) sections.push({ title: "Other items", records: groups.other });
    const nodes = [];
    for (const section of sections) {
      if (sections.length > 1) nodes.push(headingFor(section.title));
      nodes.push(...section.records.map((r) => rowFor(r, notices.get(r.id), labelsById)));
    }
    list.replaceChildren(...nodes);
    shown = sections.flatMap((section) => section.records);
    markHere();
    pinBox.hidden = pins.length === 0;
    pinList.replaceChildren(...pins.map((r) => pinRowFor(r, notices.get(r.id), labelsById)));
    empty.hidden = records.length > 0 || pins.length > 0;
    empty.textContent =
      query.trim() || kindFilter
        ? "Nothing matches. Clear the search or a filter to see more."
        : labelFilter
          ? "Nothing here has that label."
          : colorFilter
            ? `No ${colorFilter} highlights here.`
            : scope === "chapter"
              ? pageScope.empty
              : "Nothing kept yet.";
    // A save that redrew the list took the button the open Labels… popover
    // belongs to; point it at the one that replaced it, so closing it returns
    // focus there.
    const open = currentPanel();
    if (open && labelsRow) {
      const b = el.querySelector(`[data-id="${CSS.escape(labelsRow)}"] .desk-item__tag`);
      if (b) {
        open.trigger = b;
        open.restoreFocus = b;
      }
    }

    markCut();
    drawWhatsNew(everyRecord, seq);

    if (focusIndex !== null) {
      const rows = list.querySelectorAll(".desk-item__delete");
      const target = rows[Math.min(focusIndex, rows.length - 1)];
      (target ?? el.closest(".desk-panel__body") ?? el).focus({ preventScroll: false });
    }
    if (focusPin !== null) {
      const rows = pinList.querySelectorAll(".desk-item__delete");
      const target = rows[Math.min(focusPin, rows.length - 1)] ?? list.querySelector(".desk-item__delete");
      (target ?? el.closest(".desk-panel__body") ?? el).focus({ preventScroll: false });
    }
    // /desk's first drawing: show the passage being read.
    if (following && !followedOnce) {
      followedOnce = true;
      follow(following);
    }
    afterRender();
  }

  // The choices above the list: "All" and one toggle per colour present,
  // shown only when the list holds a highlight. Redrawn with the list, so the
  // button that was pressed gets focus back.
  function drawColors(present) {
    const focused = colors.contains(document.activeElement) ? document.activeElement.dataset.choice : null;
    colors.hidden = present.length === 0;
    colors.replaceChildren(
      ...(present.length ? ["all", ...present] : []).map((choice) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "desk-swatch";
        b.dataset.choice = choice;
        b.setAttribute("aria-pressed", String(choice === (colorFilter ?? "all")));
        if (choice === "all") {
          b.textContent = "All";
        } else {
          b.dataset.color = choice;
          b.setAttribute("aria-label", `Only ${choice} highlights`);
          b.innerHTML = `<span class="desk-swatch__sample" aria-hidden="true">ab</span>`;
        }
        // Pressing the colour that is already chosen lets go of it.
        b.addEventListener("click", () => {
          colorFilter = choice === "all" || choice === colorFilter ? null : choice;
          render();
        });
        return b;
      }),
    );
    if (focused) colors.querySelector(`[data-choice="${focused}"]`)?.focus({ preventScroll: true });
  }

  // The same for labels: "All labels" and one button per label on something
  // in the list, shown only when there is one. Redrawn with the list, so the
  // button that was pressed gets focus back.
  function drawLabels(inUse) {
    const focused = labelRow.contains(document.activeElement) ? document.activeElement.dataset.choice : null;
    labelRow.hidden = inUse.length === 0;
    labelRow.replaceChildren(
      ...(inUse.length ? [{ id: "all", name: "All labels" }, ...inUse] : []).map((l) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "desk-mine__label";
        b.dataset.choice = l.id;
        b.setAttribute("aria-pressed", String(l.id === (labelFilter ?? "all")));
        b.textContent = l.name;
        // Pressing the label that is already chosen lets go of it.
        b.addEventListener("click", () => {
          labelFilter = l.id === "all" || l.id === labelFilter ? null : l.id;
          render();
        });
        return b;
      }),
    );
    if (focused) labelRow.querySelector(`[data-choice="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
  }

  // The search and "Show" above the list, hidden while nothing is kept. The
  // search box is never rebuilt, so a redraw under a reader typing in it
  // leaves what they have typed and where the caret is.
  function drawFilters(kinds, any) {
    filterBox.hidden = !any;
    const values = ["", ...kinds.map((k) => k.value)];
    if (values.join("|") !== [...kindSelect.options].map((o) => o.value).join("|")) {
      kindSelect.replaceChildren(new Option("Everything", ""), ...kinds.map((k) => new Option(k.plural, k.value)));
    }
    kindSelect.value = kindFilter ?? "";
  }

  // "12 notes, 4 highlights." for the list, or what the narrowing leaves of it.
  function drawCount(all, matched) {
    countLine.hidden = all.length === 0;
    if (!all.length) return;
    countLine.textContent = narrowed
      ? `${describeCounts(matched) === "Nothing kept yet." ? "Nothing matches" : `Showing ${describeCounts(matched)}`} (of ${all.length} kept).`
      : `${describeCounts(all)}.`;
  }

  // A chapter's heading among the rows. Not a list item to a screen reader
  // (the list stays a list of records), but still a heading to move by.
  function headingFor(title) {
    const li = document.createElement("li");
    li.className = "desk-mine__heading";
    li.setAttribute("role", "presentation");
    const h = document.createElement("h3");
    h.className = "desk-mine__heading-text";
    h.textContent = title;
    li.append(h);
    return li;
  }

  // The labels on a record, and the button that opens them (the notebook
  // page's row has the same pair).
  function labelsFor(li, r, on, labelsById) {
    const chips = labelsOf(r, labelsById);
    if (chips.length) {
      const ul = document.createElement("ul");
      ul.className = "desk-chips";
      ul.setAttribute("aria-label", "Labels");
      for (const l of chips) {
        const chip = document.createElement("li");
        chip.className = "desk-chip";
        chip.textContent = l.name;
        ul.append(chip);
      }
      li.append(ul);
    }
    if (!store || !ctx || !canEdit(r)) return;
    const tag = document.createElement("button");
    tag.type = "button";
    tag.className = "desk-item__tag";
    tag.textContent = "Labels…";
    tag.setAttribute("aria-label", `Labels for ${labelsSubject(r, on)}`);
    tag.addEventListener("click", () => {
      labelsRow = r.id;
      // Forget the record once its popover has closed.
      openLabelsPopover({ trigger: tag, store, ctx, recordId: r.id, name: labelsSubject(r, on) }).then(() => {
        const open = currentPanel();
        if (!open) return;
        const done = open.onClose;
        open.onClose = () => {
          done?.();
          labelsRow = null;
        };
      });
    });
    li.append(tag);
  }

  // One line above the list when a publish since the reader last looked
  // touched their verses (B3), linking to the notebook page's section. Not
  // waited for: the feed is fetched (once per tab) after the list is drawn,
  // and only when something kept sits on a verse.
  async function drawWhatsNew(records, seq) {
    let line = null;
    try {
      line = await (await import("./whats-new.js")).panelLine(store, records); // a chunk of its own (LG-10)
    } catch (err) {
      console.error("Study Desk: what's new couldn't be worked out", err);
    }
    if (seq !== renderSeq) return;
    whatsNew.hidden = !line;
    if (line) {
      const link = whatsNew.querySelector("a");
      link.textContent = line.text;
      link.href = line.href;
    }
    afterRender();
  }

  // One line above the list when the wording has changed under any of it.
  function drawChanged(records, notices) {
    let moved = 0;
    let gone = 0;
    for (const r of records) {
      const n = notices.get(r.id);
      if (!n) continue;
      if (n.kind === "lost") gone++;
      else moved++;
    }
    const parts = [];
    if (moved) parts.push(`The wording has changed under ${moved} of these.`);
    if (gone) parts.push(`${gone} of these ${gone === 1 ? "is" : "are"} not in the text any more.`);
    changed.hidden = parts.length === 0;
    changed.textContent = parts.join(" ");
  }

  /** The card for a row's notice, and where focus goes once the reader has chosen. */
  function openCard(trigger, r, li) {
    const index = Array.from(rowsOf()).indexOf(li);
    openNotice(trigger, r, {
      store,
      ctx,
      showInText,
      restoreFocus: trigger,
      onDone: async (what) => {
        if (what === "show") return;
        if (what === "delete") return render({ focusIndex: index });
        await render();
        const back = () => {
          const row = list.querySelector(`[data-id="${CSS.escape(r.id)}"]`);
          (row?.querySelector("a.desk-item__ref") ?? row?.querySelector(".desk-item__delete"))?.focus({ preventScroll: true });
        };
        back();
        // The notebook's first write of a visit draws the list once more
        // (the store tells the panel it asked the browser to keep it), which
        // would take focus off the row: look again.
        setTimeout(() => {
          if (!document.activeElement || document.activeElement === document.body) back();
        }, 400);
      },
    });
  }

  function rowFor(r, notice = null, labelsById = new Map()) {
    const li = document.createElement("li");
    li.className = "desk-item";
    li.dataset.id = r.id;
    const ref = recordReference(r);
    const href = inReadView ? recordReadHref(r) ?? recordHref(r) : recordHref(r);
    const head = document.createElement(href ? "a" : "span");
    head.className = "desk-item__ref";
    head.textContent = ref || kindName(r.kind);
    if (href) head.href = href;
    // A record on this page (a note on this Chapter View chapter, a verse of
    // the book Read View shows) is gone to in place, scrolled to and marked,
    // rather than reloading. Otherwise it is an ordinary link.
    const goTo = (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      goHere.go(r);
    };
    const revealHere = Boolean(href && goHere?.can(r));
    if (revealHere) head.addEventListener("click", goTo);
    const kind = document.createElement("span");
    kind.className = "desk-item__kind";
    if (r.kind === "bookmark") drawBookmarkLine(kind, r, nameOf(r));
    else kind.textContent = nameOf(r);
    li.append(head, kind);
    // A bookmark that moves as the reader reads starts doing so from this link
    // (a modified click opens elsewhere and doesn't); one that stays put stops
    // whatever was moving, since the reader has gone to it instead.
    if (href && r.kind === "bookmark") {
      head.addEventListener("click", (e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
        if (isFollowing(r)) followBookmark(r, head.href);
        else stopFollowing();
      });
    }
    // A note on a footnote (M11) says so, and quotes the footnote's opening
    // words; it is still a note, and the reference above still names the
    // verse that holds the footnote's letter.
    const on = onFootnote(r) ? recordWhere(r) : ref;
    if (onFootnote(r)) {
      const line = document.createElement("p");
      line.className = "desk-item__on-fn";
      line.textContent = `On a footnote: “${shortQuote(r.footnote, FOOTNOTE_WORDS)}”`;
      li.append(line);
    }
    if (r.kind === "note") {
      // Led by its marker, at two lines unless hovered, focused, opened by
      // its caret (kept open for this visit), or the list shows notes in
      // full. The note itself goes to its place, as its reference does
      // (BVJ, 2026-10-07).
      const row = document.createElement("div");
      row.className = "desk-item__note-row";
      if (openNotes.has(r.id)) row.classList.add("desk-item__note-row--open");
      // A link in the words can't sit inside a link, so the note's own link
      // is its marker, stretched over the row (desk-stretch); the words'
      // links are lifted above it. The reference above is the same link by
      // name, so the marker's is left to the mouse.
      const note = document.createElement("div");
      note.className = "desk-item__note";
      const mark = glyph(r.marker, "desk-glyph desk-item__glyph");
      if (href) {
        note.classList.add("desk-stretch", "desk-item__note--go");
        const go = document.createElement("a");
        go.className = "desk-item__go";
        go.href = href;
        go.tabIndex = -1;
        go.setAttribute("aria-hidden", "true");
        go.innerHTML = mark;
        if (revealHere) go.addEventListener("click", goTo);
        note.append(go);
      } else {
        note.innerHTML = mark;
      }
      const words = document.createElement("span");
      words.className = "desk-item__words";
      fillNoteWords(words, r.body, "(the marker only)");
      note.append(words);
      const more = document.createElement("button");
      more.type = "button";
      more.className = "desk-item__more";
      more.hidden = true; // shown when the words are cut off (markCut)
      more.innerHTML = ICON_CARET;
      const syncMore = () => {
        const open = openNotes.has(r.id);
        more.setAttribute("aria-expanded", String(open));
        more.setAttribute("aria-label", `${open ? "Show less of" : "Show all of"} the note${on ? ` on ${on}` : ""}`);
      };
      syncMore();
      more.addEventListener("click", () => {
        if (openNotes.has(r.id)) openNotes.delete(r.id);
        else openNotes.add(r.id);
        row.classList.toggle("desk-item__note-row--open", openNotes.has(r.id));
        syncMore();
      });
      row.append(note, more);
      li.append(row);
      if (onEdit) {
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "desk-item__edit";
        edit.textContent = "Edit";
        edit.setAttribute("aria-label", `Edit note${on ? ` on ${on}` : ""}`);
        edit.addEventListener("click", (e) => {
          e.stopPropagation();
          onEdit(r, edit);
        });
        li.append(edit);
      }
    } else if (r.kind === "highlight") {
      // Its first words, wearing its own colour, go to its place as a note's
      // do. A highlight of a colour we don't know shows them plain.
      const quote = shortQuote(r.quote?.exact, HIGHLIGHT_WORDS);
      if (quote) {
        const words = document.createElement(href ? "a" : "p");
        words.className = "desk-item__highlight";
        if (href) words.href = href;
        if (revealHere) words.addEventListener("click", goTo);
        words.append(highlightedWords(colorOf(r), quote));
        li.append(words);
      }
    } else {
      const words = r.label ?? r.name ?? r.quote?.exact;
      if (typeof words === "string" && words) {
        const p = document.createElement("p");
        p.className = "desk-item__words";
        p.textContent = words;
        // A bookmark's name sits right under its reference, above the line that
        // says whether it moves (BVJ, 2026-11-04).
        if (r.kind === "bookmark") {
          p.className = "desk-item__bookmark-name";
          li.insertBefore(p, kind);
        } else {
          li.append(p);
        }
      }
    }
    // A bookmark's name, and whether it moves as the reader reads (E9).
    if (r.kind === "bookmark" && onEdit && canEdit(r)) {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "desk-item__edit";
      edit.textContent = "Edit";
      edit.setAttribute("aria-label", `Edit bookmark${on ? ` on ${on}` : ""}`);
      edit.addEventListener("click", (e) => {
        e.stopPropagation();
        onEdit(r, edit);
      });
      li.append(edit);
    }
    labelsFor(li, r, on, labelsById);
    if (notice) li.append(flagButton(r, notice, (trigger) => openCard(trigger, r, li)));
    const del = document.createElement("button");
    del.type = "button";
    del.className = "desk-item__delete";
    del.textContent = takeOff(r.kind)[0];
    del.setAttribute("aria-label", `${takeOff(r.kind)[0]} ${nameOf(r).toLowerCase()}${on ? ` on ${on}` : ""}`);
    del.addEventListener("click", () => remove(r, li));
    li.append(del);
    return li;
  }

  /**
   * A pinned footnote's row: where it is, the footnote as pinned, a flag if
   * it was rewritten, and Unpin. The footnote is the reader's pin, not their
   * words, but it is still put on the page as text, never as HTML.
   */
  function pinRowFor(r, notice = null, labelsById = new Map()) {
    const li = document.createElement("li");
    li.className = "desk-item desk-item--pin";
    li.dataset.id = r.id;
    const ref = recordReference(r);
    const href = inReadView ? recordReadHref(r) ?? recordHref(r) : recordHref(r);
    const head = document.createElement(href ? "a" : "span");
    head.className = "desk-item__ref";
    head.textContent = ref || kindName(r.kind);
    if (href) head.href = href;
    // On its own chapter the Footnotes list is gone to in place; anywhere
    // else this is the ordinary link to the verse.
    if (href && canRevealFootnote(r)) {
      head.addEventListener("click", (e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
        if (revealFootnote(r)) e.preventDefault();
      });
    }
    const kind = document.createElement("span");
    kind.className = "desk-item__kind";
    kind.textContent = kindName(r.kind);
    const words = document.createElement("p");
    words.className = "desk-item__words desk-item__pin-text";
    words.textContent = r.footnote;
    li.append(head, kind, words);
    labelsFor(li, r, ref, labelsById);
    if (notice) li.append(flagButton(r, notice, (trigger) => openPinCard(trigger, r, li)));
    const unpin = document.createElement("button");
    unpin.type = "button";
    unpin.className = "desk-item__delete";
    unpin.textContent = "Unpin";
    unpin.setAttribute("aria-label", `Unpin footnote${ref ? ` on ${ref}` : ""}`);
    unpin.addEventListener("click", () => unpinRow(r, li));
    li.append(unpin);
    return li;
  }

  /** The card for a pin's notice; focus goes back to the row, or the next one if the pin went. */
  function openPinCard(trigger, r, li) {
    const index = Array.from(pinList.children).indexOf(li);
    openNotice(trigger, r, {
      store,
      ctx,
      showInText,
      restoreFocus: trigger,
      onDone: async (what) => {
        if (what === "show") return;
        if (what === "delete") return render({ focusPin: index });
        await render();
        pinList.querySelector(`[data-id="${CSS.escape(r.id)}"] .desk-item__delete`)?.focus({ preventScroll: true });
      },
    });
  }

  async function unpinRow(r, li) {
    const index = Array.from(pinList.children).indexOf(li);
    const done = await unpinRecord(store, r, {
      afterUndo: async () => {
        await render();
        pinList.querySelector(`[data-id="${CSS.escape(r.id)}"] .desk-item__delete`)?.focus();
      },
    });
    if (done) await render({ focusPin: index });
  }

  // A caret only where there is more to show: on notes whose words run past
  // two lines, or that the reader has opened. None while the list shows
  // notes in full. "Open all" shows only when a note is cut off or a pinned
  // footnote is listed (they cut at three lines), and "Close all" whenever
  // the list is in full and has a note or pin.
  function markCut() {
    requestAnimationFrame(() => {
      const full = getSetting("listFull") === "full";
      let more = 0;
      for (const row of list.querySelectorAll(".desk-item__note-row")) {
        const caret = row.querySelector(".desk-item__more");
        const words = row.querySelector(".desk-item__words");
        const open = row.classList.contains("desk-item__note-row--open");
        const cut = words.scrollHeight > words.clientHeight + 1;
        caret.hidden = full || !(open || cut);
        if (full || cut) more++;
      }
      const pins = !pinBox.hidden && pinList.children.length > 0;
      allButton.hidden = !(more || pins);
      allButton.textContent = full ? "Close all" : "Open all";
    });
  }

  async function remove(r, li) {
    const index = Array.from(rowsOf()).indexOf(li);
    const trash = await store.remove(r.id);
    if (!trash) return;
    // The change this made, read before anything else can write: the undo
    // button, like Ctrl+Z, takes back exactly this one (history.js).
    const entry = store.lastEntry();
    await render({ focusIndex: index });
    const ref = recordWhere(r);
    showUndo(`${nameOf(r)}${ref ? ` on ${ref}` : ""} ${takeOff(r.kind)[1]}.`, async () => {
      await undoEntry(entry);
      await render();
      list.querySelector(`[data-id="${CSS.escape(r.id)}"] .desk-item__delete`)?.focus();
    });
  }

  document.addEventListener(SETTINGS_EVENT, markCut);

  // Take the tab down, for a My Notes pane on /desk that closes (BA31).
  function destroy() {
    document.removeEventListener(SETTINGS_EVENT, markCut);
    continued.destroy();
  }

  return { el, render, follow, destroy };
}

/** The nearest ancestor that scrolls vertically, or null. */
function scroller(node) {
  for (let p = node.parentElement; p; p = p.parentElement) {
    const y = getComputedStyle(p).overflowY;
    if (y === "auto" || y === "scroll") return p;
  }
  return null;
}
