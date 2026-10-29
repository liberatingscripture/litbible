// src/scripts/desk/kept-list.js
//
// "What I've kept": every record in the notebook, filtered by words, kind,
// highlight color and label, with a count in words, in Bible order under a
// heading for each book and chapter, then notes on glossary entries and on
// articles, pinned footnotes and anything else. Each row edits, labels or
// deletes its record (record-rows.js), and a deletion offers the undo bar.
//
// Drawn on the notebook page (notebook-page.js, phase 1d) and as a pane on
// /desk (desk-panes.js, phase 3d), the same module in both, so the two can't
// drift apart. `idPrefix` keeps the ids of two lists on one page apart.
// A reader's words are put on the page as text, never as HTML.

import { COLORS } from "../../lib/desk-records.mjs";
import { recordReference, recordWhere } from "../../lib/desk-store-core.mjs";
import { labelCounts, labelMap, liveLabels } from "../../lib/desk-labels.mjs";
import {
  colorsPresent,
  describeCounts,
  filterRecords,
  groupRecords,
  kindsPresent,
  listable,
} from "../../lib/desk-notebook.mjs";
import { currentPanel } from "../lit-panel.js";
import { undoEntry } from "./history.js";
import { openLabelsPopover, labelsSubject } from "./labels-ui.js";
import { openNoteEditor } from "./note-editor.js";
import { nameOf, recordRow } from "./record-rows.js";
import { showUndo } from "./undo-bar.js";

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

/**
 * @param {{ store: object, ctx: () => object, idPrefix?: string,
 *   goHere?: { can(record: object): boolean, go(record: object): void } | null }} options
 *   `goHere`, given by a /desk pane, moves the LIT pane to a row's reference
 *   (BA124); the notebook page keeps plain links.
 * @returns {{ el: HTMLElement, render: () => Promise<void>, setQuery: (q: string) => void,
 *   focusCount: () => void }}
 */
export function createKeptList({ store, ctx, idPrefix = "deskNp", goHere = null }) {
  const root = el("div", "desk-kept");
  root.innerHTML = `
    <div class="desk-np__filters" role="search" aria-label="Filter my notebook">
      <div class="desk-np__field desk-np__field--grow">
        <label for="${idPrefix}Query">Search my notebook</label>
        <input type="search" id="${idPrefix}Query" autocomplete="off" placeholder="Words, a reference, a label" />
      </div>
      <div class="desk-np__field">
        <label for="${idPrefix}Kind">Show</label>
        <select id="${idPrefix}Kind"></select>
      </div>
      <div class="desk-np__field" data-np-label-field hidden>
        <label for="${idPrefix}Label">Label</label>
        <select id="${idPrefix}Label"></select>
      </div>
      <div class="desk-np__field desk-mine__colors" role="group" aria-label="Show highlights of one color" data-np-colors hidden></div>
    </div>
    <p class="desk-np__count" aria-live="polite" data-np-count></p>
    <p class="desk-np__error" role="alert" data-np-delete-error hidden></p>
    <div class="desk-np__lists" data-np-lists></div>`;

  const q = (sel) => root.querySelector(sel);
  const queryBox = q(`#${idPrefix}Query`);
  const kindSelect = q(`#${idPrefix}Kind`);
  const labelSelect = q(`#${idPrefix}Label`);
  const labelField = q("[data-np-label-field]");
  const colorBox = q("[data-np-colors]");
  const countEl = q("[data-np-count]");
  const deleteError = q("[data-np-delete-error]");
  const lists = q("[data-np-lists]");

  const filters = { query: "", kind: null, color: null, labelId: null };
  let renderSeq = 0;
  // The row whose Edit or Labels… button opened the panel now showing, so the
  // panel can be pointed at the new button when a save redraws the list.
  let activeRow = null;

  async function render() {
    const seq = ++renderSeq;
    const records = await store.all();
    if (seq !== renderSeq) return;
    const all = listable(records);
    const labels = labelMap(records);
    drawControls(all, records);
    const shown = filterRecords(all, filters, labels);
    drawList(shown, all, labels);
    deleteError.hidden = true;
    // A save that redrew the list took the button the open panel belongs to;
    // point the panel at its replacement, so closing it returns focus.
    const panel = currentPanel();
    if (panel && activeRow) {
      const b = lists.querySelector(`[data-id="${CSS.escape(activeRow.id)}"] ${activeRow.selector}`);
      if (b) {
        panel.trigger = b;
        panel.restoreFocus = b;
      }
    }
  }

  function drawControls(all, records) {
    const kinds = kindsPresent(all);
    if (filters.kind && !kinds.some((k) => k.value === filters.kind)) filters.kind = null;
    kindSelect.replaceChildren(
      new Option("Everything", ""),
      ...kinds.map((k) => new Option(k.plural, k.value)),
    );
    kindSelect.value = filters.kind ?? "";
    kindSelect.disabled = kinds.length === 0;

    const inUse = labelCounts(records);
    const labels = liveLabels(records).filter((l) => inUse.has(l.id));
    if (filters.labelId && !labels.some((l) => l.id === filters.labelId)) filters.labelId = null;
    labelField.hidden = labels.length === 0;
    labelSelect.replaceChildren(new Option("Any label", ""), ...labels.map((l) => new Option(l.name, l.id)));
    labelSelect.value = filters.labelId ?? "";

    const present = colorsPresent(all, COLORS);
    if (filters.color && !present.includes(filters.color)) filters.color = null;
    const focused = colorBox.contains(document.activeElement) ? document.activeElement.dataset.choice : null;
    colorBox.hidden = present.length === 0;
    colorBox.replaceChildren(
      ...(present.length ? ["all", ...present] : []).map((choice) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "desk-swatch";
        b.dataset.choice = choice;
        b.setAttribute("aria-pressed", String(choice === (filters.color ?? "all")));
        if (choice === "all") {
          b.textContent = "All colors";
        } else {
          b.dataset.color = choice;
          b.setAttribute("aria-label", `Only ${choice} highlights`);
          b.innerHTML = `<span class="desk-swatch__sample" aria-hidden="true">ab</span>`;
        }
        b.addEventListener("click", () => {
          filters.color = choice === "all" || choice === filters.color ? null : choice;
          render();
        });
        return b;
      }),
    );
    if (focused) colorBox.querySelector(`[data-choice="${focused}"]`)?.focus({ preventScroll: true });
  }

  function drawList(shown, all, labels) {
    const active = Boolean(filters.query.trim() || filters.kind || filters.color || filters.labelId);
    countEl.textContent = !all.length
      ? "Nothing kept yet."
      : active
        ? `${describeCounts(shown) === "Nothing kept yet." ? "Nothing matches" : `Showing ${describeCounts(shown)}`} (of ${all.length} kept).`
        : `${describeCounts(all)}.`;

    if (!all.length) {
      lists.replaceChildren(el("p", "desk-panel__empty", "Notes, highlights, and bookmarks you make while reading appear here."));
      return;
    }
    if (!shown.length) {
      lists.replaceChildren(el("p", "desk-panel__empty", "Nothing matches. Clear the search or a filter to see more."));
      return;
    }

    const actions = {
      labels,
      goHere,
      onEdit: (record, trigger) => {
        activeRow = { id: record.id, selector: ".desk-item__edit:not(.desk-item__labels)" };
        openNoteEditor({ trigger, store, ctx, ref: recordReference(record), record, restoreFocus: trigger });
        followPanel();
      },
      onLabels: (record, trigger) => {
        activeRow = { id: record.id, selector: ".desk-item__labels" };
        openLabelsPopover({ trigger, store, ctx, recordId: record.id, name: labelsSubject(record, recordReference(record)) }).then(followPanel);
      },
      onDelete: removeRecord,
    };
    // Forget the row once its panel has closed.
    function followPanel() {
      const panel = currentPanel();
      if (!panel) return;
      const was = panel.onClose;
      panel.onClose = () => {
        was?.();
        activeRow = null;
      };
    }

    const out = [];
    const group = (title, level, records) => {
      const section = el("section", "desk-np__group");
      section.append(el(`h${level}`, `desk-np__h${level}`, title));
      const ul = el("ul", "desk-list");
      ul.append(...records.map((r) => recordRow(r, actions)));
      section.append(ul);
      return section;
    };
    const groups = groupRecords(shown);
    for (const book of groups.books) {
      const section = el("section", "desk-np__book");
      section.append(el("h3", "desk-np__h3", book.label));
      for (const chapter of book.chapters) section.append(group(chapter.label, 4, chapter.records));
      out.push(section);
    }
    if (groups.glossary.length) out.push(group("Notes on glossary entries", 3, groups.glossary));
    if (groups.articles.length) out.push(group("Notes on articles", 3, groups.articles));
    if (groups.pins.length) out.push(group("Pinned footnotes", 3, groups.pins));
    if (groups.other.length) out.push(group("Other items", 3, groups.other));
    lists.replaceChildren(...out);
  }

  function focusCount() {
    countEl.tabIndex = -1;
    countEl.focus({ preventScroll: false });
  }

  /** Focus the Delete button now at `index`, or the count if none is left. */
  function focusDelete(index) {
    const buttons = lists.querySelectorAll(".desk-item__delete");
    const target = buttons[Math.min(index, buttons.length - 1)];
    if (target) target.focus({ preventScroll: false });
    else focusCount();
  }

  async function removeRecord(r, li) {
    const index = Array.from(lists.querySelectorAll(".desk-item")).indexOf(li);
    deleteError.hidden = true;
    let trash = null;
    try {
      trash = await store.remove(r.id);
    } catch (err) {
      console.error("Study Desk: the item wasn't deleted", err);
      deleteError.hidden = false;
      deleteError.textContent = "That item couldn’t be deleted in this browser.";
      return;
    }
    if (!trash) return;
    // Read before anything else can write: the bar's Undo, like Ctrl+Z, takes
    // back exactly this change (history.js).
    const entry = store.lastEntry();
    await render();
    focusDelete(index);
    const ref = recordWhere(r);
    showUndo(`${nameOf(r)}${ref ? ` on ${ref}` : ""} ${r.kind === "footnotePin" ? "unpinned" : "deleted"}.`, async () => {
      await undoEntry(entry);
      await render();
      lists.querySelector(`[data-id="${CSS.escape(r.id)}"] .desk-item__delete`)?.focus();
    });
  }

  queryBox.addEventListener("input", () => {
    filters.query = queryBox.value;
    render();
  });
  kindSelect.addEventListener("change", () => {
    filters.kind = kindSelect.value || null;
    // A color only means something among highlights.
    if (filters.kind && filters.kind !== "highlight") filters.color = null;
    render();
  });
  labelSelect.addEventListener("change", () => {
    filters.labelId = labelSelect.value || null;
    render();
  });

  function setQuery(text) {
    queryBox.value = text;
    filters.query = text;
  }

  return { el: root, render, setQuery, focusCount };
}
