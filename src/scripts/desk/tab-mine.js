// src/scripts/desk/tab-mine.js
//
// The Notebook panel's "My Notes" tab (BVJ, 2026-10-08: it holds bookmarks
// too, and highlights once they exist): what the notebook keeps, with
// Delete, and for a note its marker glyph, its words at two lines (or in
// full, by the toggle at the panel's foot) and Edit. A note on this page's
// chapter takes the reader to its place (BVJ, 2026-10-07: decision 7 under
// "the margin switch").
//
// On a Study View chapter the tab starts on that chapter's records, and a
// small choice at its top switches to everything kept; elsewhere it lists
// everything.

import {
  forChapter,
  kindName,
  liveRecords,
  recordHref,
  recordReadHref,
  recordReference,
} from "../../lib/desk-store-core.mjs";
import { glyph } from "./glyphs.js";
import { SETTINGS_EVENT, getSetting } from "./note-settings.js";
import { showUndo } from "./undo-bar.js";

// A note's caret in the list: down to show the rest, turned up while open.
const ICON_CARET = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
  stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M6 9l6 6 6-6" /></svg>`;

/**
 * @param {{ store: object | null, storeError: unknown, here: object | null,
 *   inReadView: boolean, visible: () => boolean, afterRender?: () => void,
 *   onEdit?: (record: object, trigger: Element) => void,
 *   goHere?: { can(record: object): boolean, go(record: object): void } | null }} options
 *   `visible` says whether the tab can be seen, so a hidden one isn't drawn;
 *   `afterRender` lets the panel bring its foot up to date.
 * @returns {{ el: HTMLElement, render: (opts?: { focusIndex?: number | null }) => Promise<void> }}
 */
export function createMineTab({ store, storeError, here, inReadView, visible, afterRender = () => {}, onEdit = null, goHere = null }) {
  const el = document.createElement("div");
  el.className = "desk-mine";
  el.innerHTML = `
    ${here ? `<div class="desk-seg desk-mine__scope" role="radiogroup" aria-label="Which of my notes">
      <label class="desk-seg__option">
        <input type="radio" class="desk-seg__input" name="desk-mine-scope" value="chapter" checked />
        <span class="desk-seg__text"></span>
      </label>
      <label class="desk-seg__option">
        <input type="radio" class="desk-seg__input" name="desk-mine-scope" value="everything" />
        <span class="desk-seg__text">Everything</span>
      </label>
    </div>` : ""}
    <ul class="desk-list"></ul>
    <p class="desk-panel__empty" hidden></p>`;
  if (here) el.querySelector(".desk-seg__text").textContent = here.label;

  const list = el.querySelector(".desk-list");
  const empty = el.querySelector(".desk-panel__empty");
  const openNotes = new Set(); // notes clicked open in the list, for this visit
  let scope = here ? "chapter" : "everything";
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
      empty.hidden = false;
      empty.textContent =
        "This browser isn't letting the site keep a notebook. Private windows sometimes don't.";
      if (storeError) console.error("Study Desk: the notebook didn't open", storeError);
      return;
    }
    const records =
      scope === "chapter" && here
        ? forChapter(await store.byChapter(here.bookKey, here.chapter), here.bookKey, here.chapter)
        : liveRecords(await store.all());
    if (seq !== renderSeq) return; // a newer render has started

    list.replaceChildren(...records.map(rowFor));
    empty.hidden = records.length > 0;
    empty.textContent = scope === "chapter" ? `Nothing kept for ${here.label} yet.` : "Nothing kept yet.";

    markCut();

    if (focusIndex !== null) {
      const rows = list.querySelectorAll(".desk-item__delete");
      const target = rows[Math.min(focusIndex, rows.length - 1)];
      (target ?? el.closest(".desk-panel__body") ?? el).focus({ preventScroll: false });
    }
    afterRender();
  }

  function rowFor(r) {
    const li = document.createElement("li");
    li.className = "desk-item";
    li.dataset.id = r.id;
    const ref = recordReference(r);
    const href = inReadView ? recordReadHref(r) : recordHref(r);
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
    kind.textContent = kindName(r.kind);
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
    } else {
      const words = r.label ?? r.name ?? r.quote?.exact;
      if (typeof words === "string" && words) {
        const p = document.createElement("p");
        p.className = "desk-item__words";
        p.textContent = words;
        li.append(p);
      }
    }
    const del = document.createElement("button");
    del.type = "button";
    del.className = "desk-item__delete";
    del.textContent = "Delete";
    del.setAttribute("aria-label", `Delete ${kindName(r.kind).toLowerCase()}${ref ? ` on ${ref}` : ""}`);
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
    await render({ focusIndex: index });
    const ref = recordReference(r);
    showUndo(`${kindName(r.kind)}${ref ? ` on ${ref}` : ""} deleted.`, async () => {
      const back = await store.undo(trash.id);
      if (!back) throw new Error("nothing to bring back");
      await render();
      list.querySelector(`[data-id="${CSS.escape(back.id)}"] .desk-item__delete`)?.focus();
    });
  }

  document.addEventListener(SETTINGS_EVENT, markCut);

  return { el, render };
}
