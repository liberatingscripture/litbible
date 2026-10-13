// src/scripts/desk/notebook-page.js
//
// The notebook page, /notebook/ (STUDY-DESK.md, phase 1d): everything the
// notebook keeps on one page, where the panel beside the text keeps only
// what belongs to the page being read. Loaded by desk-gate.js on a computer
// with the preview switched on, when the page carries [data-notebook-page].
// It is not a reading surface, so there is no panel here and no margin: this
// module opens the notebook itself and draws into that element.
//
// The page, top to bottom: filters (words, kind, highlight colour, label) and
// a count in words; the records in Bible order under a heading for each book
// and chapter, then notes on glossary entries and on articles, pinned
// footnotes, places and anything else; Labels (make, rename, delete); Save a
// copy and Open a copy (export-import.js); and Delete everything, with the
// shared-computer button "Empty the trash now".
//
// It keeps in step with the other tabs (store.subscribe). Every write goes
// through the store, so Ctrl+Z undoes it, and a deletion offers the undo bar.
// A reader's words are put on the page as text, never as HTML.

import { COLORS } from "../../lib/desk-records.mjs";
import { recordReference } from "../../lib/desk-store-core.mjs";
import {
  labelCounts,
  labelMap,
  liveLabels,
  planCreateLabel,
  planDeleteLabel,
  planRenameLabel,
} from "../../lib/desk-labels.mjs";
import {
  colorsPresent,
  describeCounts,
  filterRecords,
  groupRecords,
  kindsPresent,
  listable,
  planDeleteEverything,
  planEmptyTrashNow,
  trashHeld,
} from "../../lib/desk-notebook.mjs";
import { currentPanel } from "../lit-panel.js";
import { addDeskStyle, deskCtx as ctx } from "./boot.js";
import { mountBackup } from "./export-import.js";
import { createHistory, undoEntry } from "./history.js";
import { openLabelsPopover, labelsSubject } from "./labels-ui.js";
import { openNoteEditor } from "./note-editor.js";
import { nameOf, recordRow } from "./record-rows.js";
import { placesSection } from "./places.js";
import { openStore } from "./store.js";
import { START_CHOICES, START_KEY, startChoice } from "../../lib/desk-start.mjs";
import { initUndo, showUndo } from "./undo-bar.js";

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

// How the Notebook panel starts on each page (src/lib/desk-start.mjs; BVJ,
// 2026-10-13): kept as the reader chooses, and "As I left it" stores nothing.
function mountStartChoice(box) {
  let current = "left";
  try { current = startChoice((k) => localStorage.getItem(k)); } catch (_) {}
  for (const { value, label } of START_CHOICES) {
    const option = el("label", "desk-np__start-option");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "desk-np-start";
    input.value = value;
    input.checked = value === current;
    input.addEventListener("change", () => {
      if (!input.checked) return;
      try {
        if (value === "left") localStorage.removeItem(START_KEY);
        else localStorage.setItem(START_KEY, value);
      } catch (_) {}
    });
    option.append(input, document.createTextNode(` ${label}`));
    box.append(option);
  }
}

async function start() {
  const root = document.querySelector("[data-notebook-page]");
  if (!root) return;
  addDeskStyle();
  root.replaceChildren();
  root.classList.add("desk-np");

  let store = null;
  try {
    store = await openStore({ ctx });
  } catch (err) {
    console.error("Study Desk: the notebook didn’t open", err);
  }
  if (!store) {
    root.append(el("p", "desk-panel__empty", "This browser isn’t letting the site keep a notebook. Private windows sometimes don’t."));
    return;
  }
  initUndo();
  createHistory({ store, ctx });

  root.innerHTML = `
    <p class="desk-np__intro">Everything the notebook keeps in this browser, in Bible order. It never leaves this computer unless you save a copy.</p>
    <nav class="desk-np__jump" aria-label="On this page">
      <a href="#kept">What I’ve kept</a>
      <a href="#places">Places</a>
      <a href="#labels">Labels</a>
      <a href="#panel">The Notebook panel</a>
      <a href="#backup">Save a copy</a>
      <a href="#delete-everything">Delete everything</a>
    </nav>
    <section class="desk-np__section" id="kept" aria-labelledby="deskNpKeptTitle">
      <h2 class="desk-np__h2" id="deskNpKeptTitle">What I’ve kept</h2>
      <div class="desk-np__filters" role="search" aria-label="Filter my notebook">
        <div class="desk-np__field desk-np__field--grow">
          <label for="deskNpQuery">Search my notebook</label>
          <input type="search" id="deskNpQuery" autocomplete="off" placeholder="Words, a reference, a label" />
        </div>
        <div class="desk-np__field">
          <label for="deskNpKind">Show</label>
          <select id="deskNpKind"></select>
        </div>
        <div class="desk-np__field" data-np-label-field hidden>
          <label for="deskNpLabel">Label</label>
          <select id="deskNpLabel"></select>
        </div>
        <div class="desk-np__field desk-mine__colors" role="group" aria-label="Show highlights of one colour" data-np-colors hidden></div>
      </div>
      <p class="desk-np__count" aria-live="polite" data-np-count></p>
      <div class="desk-np__lists" data-np-lists></div>
    </section>
    <section class="desk-np__section" id="places" data-np-places></section>
    <section class="desk-np__section" id="labels" aria-labelledby="deskNpLabelsTitle">
      <h2 class="desk-np__h2" id="deskNpLabelsTitle">Labels</h2>
      <p>Labels are your own tags. Put them on a note, highlight or bookmark with its Labels… button, then filter by them above.</p>
      <form class="desk-np__new-label" data-np-new-label>
        <label for="deskNpNewLabel">New label</label>
        <input type="text" id="deskNpNewLabel" maxlength="60" autocomplete="off" />
        <button type="submit">Add</button>
      </form>
      <p class="desk-np__error" role="alert" data-np-label-error hidden></p>
      <ul class="desk-np__labels" data-np-labels></ul>
      <p class="desk-panel__empty" data-np-no-labels hidden>No labels yet.</p>
    </section>
    <section class="desk-np__section" id="panel" aria-labelledby="deskNpPanelTitle">
      <h2 class="desk-np__h2" id="deskNpPanelTitle">The Notebook panel</h2>
      <fieldset class="desk-np__start" data-np-start>
        <legend>When a page opens, the Notebook panel is</legend>
      </fieldset>
      <p class="desk-np__note">“As I left it” starts minimized, then follows what you last did: a panel you close stays closed, and one you open out stays open.</p>
    </section>
    <section class="desk-np__section desk-backup" id="backup" data-np-backup></section>
    <section class="desk-np__section" id="delete-everything" aria-labelledby="deskNpDeleteTitle">
      <h2 class="desk-np__h2" id="deskNpDeleteTitle">Delete everything</h2>
      <div class="desk-np__danger">
        <p>Moves every note, highlight, bookmark, label and place in this browser to the trash. You can undo it right away. The trash keeps each one for 30 days, then only a marker that it was deleted.</p>
        <div data-np-delete-box></div>
      </div>
      <div class="desk-np__danger">
        <h3 class="desk-np__h3">Empty the trash now</h3>
        <p>For a shared computer. Wipes the words of everything in the trash at once, instead of after 30 days. Only a marker that each item was deleted stays. This can’t be undone.</p>
        <div data-np-trash-box></div>
      </div>
    </section>
    <p class="sr-only" role="status" data-np-status></p>`;

  const q = (sel) => root.querySelector(sel);
  const queryBox = q("#deskNpQuery");
  const kindSelect = q("#deskNpKind");
  const labelSelect = q("#deskNpLabel");
  const labelField = q("[data-np-label-field]");
  const colorBox = q("[data-np-colors]");
  const countEl = q("[data-np-count]");
  const lists = q("[data-np-lists]");
  const labelList = q("[data-np-labels]");
  const noLabels = q("[data-np-no-labels]");
  const labelError = q("[data-np-label-error]");
  const deleteBox = q("[data-np-delete-box]");
  const trashBox = q("[data-np-trash-box]");
  const statusEl = q("[data-np-status]");

  mountBackup(q("[data-np-backup]"), { store, ctx });
  mountStartChoice(q("[data-np-start]"));
  // Continue reading, Read View's places and the reader's ribbons (B1), drawn
  // and kept up to date by places.js.
  q("[data-np-places]").append(
    placesSection({ store, ctx, emptyText: "No places yet. Continue reading and your ribbons appear here." }),
  );

  const filters = { query: "", kind: null, color: null, labelId: null };
  let renderSeq = 0;
  // The records the last draw saw, for putting a section back after Cancel.
  let latestRecords = [];
  // The row whose Edit or Labels… button opened the panel now showing, so the
  // panel can be pointed at the new button when a save redraws the list.
  let activeRow = null;

  const announce = (message) => {
    statusEl.textContent = "";
    setTimeout(() => (statusEl.textContent = message), 50);
  };

  /* ── The records ───────────────────────────────────────────────── */

  async function render() {
    const seq = ++renderSeq;
    const records = await store.all();
    if (seq !== renderSeq) return;
    latestRecords = records;
    const all = listable(records);
    const labels = labelMap(records);
    drawControls(all, records);
    const shown = filterRecords(all, filters, labels);
    drawList(shown, all, labels);
    drawLabels(records);
    drawDanger(records);
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
          b.textContent = "All colours";
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
      lists.replaceChildren(el("p", "desk-panel__empty", "Notes, highlights and bookmarks you make while reading appear here."));
      return;
    }
    if (!shown.length) {
      lists.replaceChildren(el("p", "desk-panel__empty", "Nothing matches. Clear the search or a filter to see more."));
      return;
    }

    const actions = {
      labels,
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

  /** Focus the Delete button now at `index`, or the page's count if none is left. */
  function focusDelete(index) {
    const buttons = lists.querySelectorAll(".desk-item__delete");
    const target = buttons[Math.min(index, buttons.length - 1)];
    (target ?? countEl).focus?.({ preventScroll: false });
    if (!target) {
      countEl.tabIndex = -1;
      countEl.focus({ preventScroll: false });
    }
  }

  async function removeRecord(r, li) {
    const index = Array.from(lists.querySelectorAll(".desk-item")).indexOf(li);
    const trash = await store.remove(r.id);
    if (!trash) return;
    // Read before anything else can write: the bar's Undo, like Ctrl+Z, takes
    // back exactly this change (history.js).
    const entry = store.lastEntry();
    await render();
    focusDelete(index);
    const ref = recordReference(r);
    showUndo(`${nameOf(r)}${ref ? ` on ${ref}` : ""} ${r.kind === "footnotePin" ? "unpinned" : "deleted"}.`, async () => {
      await undoEntry(entry);
      await render();
      lists.querySelector(`[data-id="${CSS.escape(r.id)}"] .desk-item__delete`)?.focus();
    });
  }

  /* ── Filters ───────────────────────────────────────────────────── */

  queryBox.addEventListener("input", () => {
    filters.query = queryBox.value;
    render();
  });
  kindSelect.addEventListener("change", () => {
    filters.kind = kindSelect.value || null;
    // A colour only means something among highlights.
    if (filters.kind && filters.kind !== "highlight") filters.color = null;
    render();
  });
  labelSelect.addEventListener("change", () => {
    filters.labelId = labelSelect.value || null;
    render();
  });

  /* ── Labels ────────────────────────────────────────────────────── */

  const labelMessages = {
    empty: "Type a name first.",
    duplicate: "You already have a label with that name.",
    readonly: "That label was saved by a newer version, so it can’t be changed here.",
    missing: "That label isn’t in the notebook any more.",
  };
  const sayLabel = (message) => {
    labelError.hidden = !message;
    labelError.textContent = message ?? "";
  };

  q("[data-np-new-label]").addEventListener("submit", async (e) => {
    e.preventDefault();
    sayLabel(null);
    const box = q("#deskNpNewLabel");
    const done = planCreateLabel(await store.all(), box.value, ctx());
    if (!done.ok) return sayLabel(labelMessages[done.reason]);
    await store.commit(done.plan);
    box.value = "";
    announce(`Label “${done.label.name}” added.`);
  });

  function drawLabels(records) {
    const labels = liveLabels(records);
    const counts = labelCounts(records);
    noLabels.hidden = labels.length > 0;
    // A row being renamed keeps its field: the list is redrawn around it only
    // when nothing in it has focus.
    if (labelList.contains(document.activeElement) && document.activeElement.matches("input")) return;
    labelList.replaceChildren(...labels.map((l) => labelRow(l, counts.get(l.id) ?? 0)));
  }

  function labelRow(label, count) {
    const li = el("li", "desk-np__label");
    li.dataset.id = label.id;
    const name = el("span", "desk-np__label-name", label.name);
    const used = el("span", "desk-np__label-used", count ? `On ${plural(count, "item", "items")}` : "Not used yet");
    const rename = el("button", "desk-item__edit", "Rename");
    rename.type = "button";
    rename.setAttribute("aria-label", `Rename label ${label.name}`);
    const del = el("button", "desk-item__delete", "Delete");
    del.type = "button";
    del.setAttribute("aria-label", `Delete label ${label.name}`);
    li.append(name, used, rename, del);

    rename.addEventListener("click", () => {
      const form = el("form", "desk-np__rename");
      const input = el("input");
      input.type = "text";
      input.maxLength = 60;
      input.value = label.name;
      input.setAttribute("aria-label", `New name for label ${label.name}`);
      const save = el("button", "", "Save");
      save.type = "submit";
      const cancel = el("button", "", "Cancel");
      cancel.type = "button";
      form.append(input, save, cancel);
      li.replaceChildren(form);
      input.focus();
      input.select();
      const back = async () => {
        await render();
        labelList.querySelector(`[data-id="${CSS.escape(label.id)}"] .desk-item__edit`)?.focus();
      };
      cancel.addEventListener("click", back);
      form.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          back();
        }
      });
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        sayLabel(null);
        const done = planRenameLabel(await store.all(), label.id, input.value, ctx());
        if (!done.ok) return sayLabel(labelMessages[done.reason]);
        await store.commit(done.plan);
        announce(`Label renamed to “${done.label.name}”.`);
        back();
      });
    });

    del.addEventListener("click", async () => {
      sayLabel(null);
      const index = Array.from(labelList.children).indexOf(li);
      const done = planDeleteLabel(await store.all(), label.id, ctx());
      if (!done.ok) return sayLabel(labelMessages[done.reason]);
      await store.commit(done.plan);
      const entry = store.lastEntry();
      await render();
      const buttons = labelList.querySelectorAll(".desk-item__delete");
      (buttons[Math.min(index, buttons.length - 1)] ?? q("#deskNpNewLabel")).focus();
      const was = done.stripped ? ` It was on ${plural(done.stripped, "item", "items")}.` : "";
      showUndo(`Label “${label.name}” deleted.${was}`, async () => {
        await undoEntry(entry);
        await render();
      });
    });
    return li;
  }

  /* ── Delete everything, and the trash ─────────────────────────── */

  // Two buttons that each ask again, on the page, before they act. Redrawn
  // only to bring a count up to date, never while the question is showing.
  const danger = {
    delete: { box: deleteBox, asking: false },
    trash: { box: trashBox, asking: false },
  };

  function drawDanger(records) {
    const live = records.filter((r) => r && r.kind !== "trash");
    const held = trashHeld(records);
    drawAsk(danger.delete, {
      count: live.length,
      ready: (n) => n > 0,
      button: "Delete everything…",
      none: "There is nothing to delete.",
      question: (n) => `Are you sure? This deletes ${plural(n, "item", "items")} from this browser.`,
      confirm: "Delete everything",
      run: deleteEverything,
    });
    drawAsk(danger.trash, {
      count: held,
      ready: (n) => n > 0,
      button: "Empty the trash now…",
      none: "The trash is empty.",
      question: (n) =>
        `Are you sure? The words of ${plural(n, "deleted item", "deleted items")} will be gone for good. This can’t be undone.`,
      confirm: "Empty the trash now",
      run: emptyTrash,
    });
  }

  function drawAsk(state, spec) {
    if (state.asking && spec.ready(spec.count)) {
      // Keep the question open, but bring its number up to date.
      state.box.querySelector(".desk-np__ask-text").textContent = spec.question(spec.count);
      return;
    }
    state.asking = false;
    if (!spec.ready(spec.count)) {
      state.box.replaceChildren(el("p", "desk-np__none", spec.none));
      return;
    }
    const ask = el("button", "desk-np__danger-button", spec.button);
    ask.type = "button";
    ask.addEventListener("click", () => {
      state.asking = true;
      const group = el("div", "desk-np__ask");
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", "Confirm");
      const text = el("p", "desk-np__ask-text", spec.question(spec.count));
      const yes = el("button", "desk-np__danger-button", spec.confirm);
      yes.type = "button";
      const no = el("button", "", "Cancel");
      no.type = "button";
      group.append(text, yes, no);
      state.box.replaceChildren(group);
      // Cancel first: the safe answer is the one under the reader's hand.
      no.focus();
      no.addEventListener("click", () => {
        state.asking = false;
        drawDanger(latestRecords);
        state.box.querySelector("button")?.focus();
      });
      yes.addEventListener("click", async () => {
        yes.disabled = true;
        state.asking = false;
        await spec.run();
      });
    });
    state.box.replaceChildren(ask);
  }

  async function deleteEverything() {
    const records = await store.all();
    const plan = planDeleteEverything(records, ctx());
    if (!plan.remove.length) return;
    await store.commit(plan);
    const entry = store.lastEntry();
    await render();
    const message = `Everything deleted: ${plural(plan.remove.length, "item", "items")} moved to the trash.`;
    announce(message);
    countEl.tabIndex = -1;
    countEl.focus();
    if (entry) showUndo(message, async () => {
      await undoEntry(entry);
      await render();
    });
  }

  async function emptyTrash() {
    const records = await store.all();
    const plan = planEmptyTrashNow(records);
    if (!plan.put.length) return;
    // Not remembered for undo: undoing it would bring back what it was for.
    await store.commit(plan, { record: false });
    await render();
    announce(`The trash is empty. The words of ${plural(plan.put.length, "item", "items")} are gone.`);
    trashBox.querySelector("p")?.setAttribute("tabindex", "-1");
    trashBox.querySelector("p")?.focus();
  }

  // Search's "more in your notebook" link arrives with the words (?q=…).
  const asked = new URLSearchParams(window.location.search).get("q");
  if (asked) {
    queryBox.value = asked;
    filters.query = asked;
  }

  store.subscribe(() => render());
  await render();

  // The page is drawn after the browser has looked for the address's #part
  // (#backup, #labels), so go to it now.
  const target = window.location.hash && document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
  if (target) target.scrollIntoView({ block: "start" });
}

start();
