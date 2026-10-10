// src/scripts/desk/tab-mine.js
//
// The Notebook panel's "My Notes" tab (BVJ, 2026-10-08: it holds bookmarks
// and highlights too): what the notebook keeps, with Delete, and for a note
// its marker glyph, its words at two lines (or in full, by the toggle at the
// panel's foot) and Edit. A note on this page's chapter takes the reader to
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
// A record whose wording has changed under it (change-notice.js) carries a
// flag under its words, "Wording changed · Review" (or "Not in the text ·
// Review" when its verses are gone), which opens the card beside it, and a
// line above the list counts them. A notice is judged only where the
// chapter's text is on the page, so on Study View's "Everything" list only
// this chapter's records can carry one, and in Read View only this book's.
//
// On a Study View chapter the tab starts on that chapter's records, and a
// small choice at its top switches to everything kept; on an article or the
// glossary it starts on the notes on this page (N11); elsewhere it lists
// everything. An article also offers a note on the whole article here.

import { shortQuote } from "../../lib/desk-notes.mjs";
import { COLORS } from "../../lib/desk-records.mjs";
import {
  kindName,
  liveRecords,
  recordHref,
  recordReadHref,
  recordReference,
} from "../../lib/desk-store-core.mjs";
import { flagButton, noticesFor, openNotice } from "./change-notice.js";
import { glyph } from "./glyphs.js";
import { undoEntry } from "./history.js";
import { SETTINGS_EVENT, getSetting } from "./note-settings.js";
import { showUndo } from "./undo-bar.js";

// A note's caret in the list: down to show the rest, turned up while open.
const ICON_CARET = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
  stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M6 9l6 6 6-6" /></svg>`;

// The words of a highlight shown in the list: about this many.
const HIGHLIGHT_WORDS = 24;

// Which colour the list is narrowed to (null: everything). Kept for the visit.
let colorFilter = null;

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
 * @returns {{ el: HTMLElement, render: (opts?: { focusIndex?: number | null }) => Promise<void> }}
 */
export function createMineTab({ store, storeError, scope: pageScope = null, addAction = null, inReadView, visible, afterRender = () => {}, onEdit = null, goHere = null, ctx = null, showInText = null }) {
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
    <div class="desk-mine__colors" role="group" aria-label="Show highlights of one colour" hidden></div>
    <p class="desk-mine__changed" hidden></p>
    <ul class="desk-list"></ul>
    <p class="desk-panel__empty" hidden></p>`;
  if (pageScope) el.querySelector(".desk-seg__text").textContent = pageScope.label;
  const addButton = el.querySelector(".desk-mine__add");
  if (addButton) {
    addButton.textContent = addAction.label;
    addButton.addEventListener("click", () => addAction.run(addButton));
  }

  const list = el.querySelector(".desk-list");
  const empty = el.querySelector(".desk-panel__empty");
  const colors = el.querySelector(".desk-mine__colors");
  const changed = el.querySelector(".desk-mine__changed");
  const openNotes = new Set(); // notes clicked open in the list, for this visit
  let scope = pageScope ? "chapter" : "everything";
  for (const radio of el.querySelectorAll(".desk-mine__scope input")) {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      scope = radio.value;
      render();
    });
  }

  let renderSeq = 0;
  async function render({ focusIndex = null } = {}) {
    if (!visible() && focusIndex === null) return;
    const seq = ++renderSeq;
    if (!store) {
      list.replaceChildren();
      colors.hidden = true;
      changed.hidden = true;
      empty.hidden = false;
      empty.textContent =
        "This browser isn't letting the site keep a notebook. Private windows sometimes don't.";
      if (storeError) console.error("Study Desk: the notebook didn't open", storeError);
      return;
    }
    const kept =
      scope === "chapter" && pageScope ? await pageScope.load(store) : liveRecords(await store.all());
    if (seq !== renderSeq) return; // a newer render has started

    // The colours this list holds. A choice of colour that has left it (the
    // last of its highlights deleted, or the list changed to another scope)
    // goes back to All rather than leaving an empty list under a choice.
    const present = COLORS.filter((c) => kept.some((r) => colorOf(r) === c));
    if (colorFilter && !present.includes(colorFilter)) colorFilter = null;
    drawColors(present);
    const records = colorFilter ? kept.filter((r) => colorOf(r) === colorFilter) : kept;

    const notices = store && ctx ? noticesFor(records) : new Map();
    drawChanged(records, notices);
    list.replaceChildren(...records.map((r) => rowFor(r, notices.get(r.id))));
    empty.hidden = records.length > 0;
    empty.textContent = colorFilter
      ? `No ${colorFilter} highlights here.`
      : scope === "chapter"
        ? pageScope.empty
        : "Nothing kept yet.";

    markCut();

    if (focusIndex !== null) {
      const rows = list.querySelectorAll(".desk-item__delete");
      const target = rows[Math.min(focusIndex, rows.length - 1)];
      (target ?? el.closest(".desk-panel__body") ?? el).focus({ preventScroll: false });
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
    const index = Array.from(list.children).indexOf(li);
    openNotice(trigger, r, {
      store,
      ctx,
      showInText,
      restoreFocus: trigger,
      onDone: async (what) => {
        if (what === "show") return;
        if (what === "delete") return render({ focusIndex: index });
        await render();
        const row = list.querySelector(`[data-id="${CSS.escape(r.id)}"]`);
        const back = row?.querySelector("a.desk-item__ref") ?? row?.querySelector(".desk-item__delete");
        back?.focus({ preventScroll: true });
      },
    });
  }

  function rowFor(r, notice = null) {
    const li = document.createElement("li");
    li.className = "desk-item";
    li.dataset.id = r.id;
    const ref = recordReference(r);
    const href = inReadView ? recordReadHref(r) ?? recordHref(r) : recordHref(r);
    const head = document.createElement(href ? "a" : "span");
    head.className = "desk-item__ref";
    head.textContent = ref || kindName(r.kind);
    if (href) head.href = href;
    // A record on this page (a note on this Study View chapter, a verse of
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
    kind.textContent = nameOf(r);
    li.append(head, kind);
    if (r.kind === "note") {
      // Led by its marker, at two lines unless hovered, focused, opened by
      // its caret (kept open for this visit), or the list shows notes in
      // full. The note itself goes to its place, as its reference does
      // (BVJ, 2026-10-07).
      const row = document.createElement("div");
      row.className = "desk-item__note-row";
      if (openNotes.has(r.id)) row.classList.add("desk-item__note-row--open");
      const note = document.createElement(href ? "a" : "span");
      note.className = "desk-item__note";
      if (href) note.href = href;
      if (revealHere) note.addEventListener("click", goTo);
      note.innerHTML = glyph(r.marker, "desk-glyph desk-item__glyph");
      const words = document.createElement("span");
      words.className = "desk-item__words";
      // A note's body is the reader's own words: always text, never HTML.
      words.textContent = r.body || "(the marker only)";
      note.append(words);
      const more = document.createElement("button");
      more.type = "button";
      more.className = "desk-item__more";
      more.hidden = true; // shown when the words are cut off (markCut)
      more.innerHTML = ICON_CARET;
      const syncMore = () => {
        const open = openNotes.has(r.id);
        more.setAttribute("aria-expanded", String(open));
        more.setAttribute("aria-label", `${open ? "Show less of" : "Show all of"} the note${ref ? ` on ${ref}` : ""}`);
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
        edit.setAttribute("aria-label", `Edit note${ref ? ` on ${ref}` : ""}`);
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
        li.append(p);
      }
    }
    if (notice) li.append(flagButton(r, notice, (trigger) => openCard(trigger, r, li)));
    const del = document.createElement("button");
    del.type = "button";
    del.className = "desk-item__delete";
    del.textContent = "Delete";
    del.setAttribute("aria-label", `Delete ${nameOf(r).toLowerCase()}${ref ? ` on ${ref}` : ""}`);
    del.addEventListener("click", () => remove(r, li));
    li.append(del);
    return li;
  }

  // A caret only where there is more to show: on notes whose words run past
  // two lines, or that the reader has opened. None while the list shows
  // notes in full.
  function markCut() {
    requestAnimationFrame(() => {
      const full = getSetting("listFull") === "full";
      for (const row of list.querySelectorAll(".desk-item__note-row")) {
        const more = row.querySelector(".desk-item__more");
        const words = row.querySelector(".desk-item__words");
        const open = row.classList.contains("desk-item__note-row--open");
        more.hidden = full || !(open || words.scrollHeight > words.clientHeight + 1);
      }
    });
  }

  async function remove(r, li) {
    const index = Array.from(list.children).indexOf(li);
    const trash = await store.remove(r.id);
    if (!trash) return;
    // The change this made, read before anything else can write: the undo
    // button, like Ctrl+Z, takes back exactly this one (history.js).
    const entry = store.lastEntry();
    await render({ focusIndex: index });
    const ref = recordReference(r);
    showUndo(`${nameOf(r)}${ref ? ` on ${ref}` : ""} deleted.`, async () => {
      await undoEntry(entry);
      await render();
      list.querySelector(`[data-id="${CSS.escape(r.id)}"] .desk-item__delete`)?.focus();
    });
  }

  document.addEventListener(SETTINGS_EVENT, markCut);

  return { el, render };
}
