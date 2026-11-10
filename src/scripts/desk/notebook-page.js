// src/scripts/desk/notebook-page.js
//
// The notebook page, /notebook/ (STUDY-DESK.md, phase 1d): everything the
// notebook keeps on one page, where the panel beside the text keeps only
// what belongs to the page being read. Loaded by desk-gate.js on a computer
// with the preview switched on, when the page carries [data-notebook-page].
// It is not a reading surface, so there is no panel here and no margin: this
// module opens the notebook itself and draws into that element.
//
// The page, top to bottom: My Notes (kept-list.js, which /desk's pane
// of that name shares: filters by words, kind, highlight colour and label, a
// count in words, and the records in Bible order); What's new for you (whats-new.js: the
// release notes that touched their verses); Labels (make, rename, delete); Save a
// copy and Open a copy (export-import.js); Trash, where a deleted item can be
// restored for its 30 days (trash-list.js; E12); and Delete in bulk: "Delete
// all marks", "Delete all sheets" (Audit 8 decision 8; one "Delete everything"
// until 2026-11-10) and the shared-computer button "Empty the trash now".
//
// It keeps in step with the other tabs (store.subscribe). Every write goes
// through the store, so Ctrl+Z undoes it, and a deletion offers the undo bar.
// A reader's words are put on the page as text, never as HTML.

import {
  labelCounts,
  liveLabels,
  planCreateLabel,
  planDeleteLabel,
  planRenameLabel,
} from "../../lib/desk-labels.mjs";
import { bulkCounts, planDeleteMarks, planDeleteSheets, planEmptyTrashNow, trashHeld } from "../../lib/desk-notebook.mjs";
import { addDeskStyle, deskCtx as ctx } from "./boot.js";
import { mountBackup } from "./export-import.js";
import { createHistory, undoEntry } from "./history.js";
import { createKeptList } from "./kept-list.js";
import { continueSection } from "./continue-reading.js";
import { openStore } from "./store.js";
import { START_CHOICES, START_KEY, startChoice } from "../../lib/desk-start.mjs";
import { initUndo, showUndo } from "./undo-bar.js";
import { createTrashList } from "./trash-list.js";
import { mountWhatsNew } from "./whats-new.js";
import { planWrite, QUIET_KINDS } from "../../lib/desk-store-core.mjs";
import { TRASH_DAYS } from "../../lib/desk-records.mjs";
import { el } from "./dom.js";
import { plural } from "./desk-text.js";


// What a write that the browser refused says (quota, a database closed by
// another tab's upgrade), as labels-ui.js says it (GF8a-2).
const WRITE_FAILED = "That couldn’t be saved in this browser, so nothing changed. Try again.";

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
  // The way back to /desk (BVJ, 2026-11-06): the header's Study Desk link is
  // on the home page only since E50, and this page is one of the desk's own,
  // as /sheets is with its "Edit in Study Desk".
  const back = el("a", "notebook-page__desk", "Open the Study Desk");
  back.href = `${String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/")}desk/`;
  const backLine = el("p", "notebook-page__desk-line");
  backLine.append(back);
  (document.querySelector(".notebook-page__title") ?? root).after(backLine);

  let store = null;
  try {
    store = await openStore({ ctx });
  } catch (err) {
    console.error("Study Desk: the notebook didn’t open", err);
  }
  if (!store) {
    root.append(el("p", "desk-panel__empty", "This browser isn’t letting the site keep a notebook. Private windows sometimes don’t. Open the site in a regular window to keep notes."));
    return;
  }
  initUndo();
  createHistory({ store, ctx });

  root.innerHTML = `
    <p class="desk-np__intro">Everything the notebook keeps in this browser, in Bible order. It never leaves this computer unless you save a copy.</p>
    <nav class="desk-np__jump" aria-label="On this page">
      <a href="#continue">Continue reading</a>
      <a href="#kept">My Notes</a>
      <a href="#whats-new">What’s new for you</a>
      <a href="#labels">Labels</a>
      <a href="#panel">The Notebook panel</a>
      <a href="#backup">Save a copy</a>
      <a href="#trash">Trash</a>
      <a href="#delete-everything">Delete in bulk</a>
    </nav>
    <section class="desk-np__section" id="continue" data-np-continue></section>
    <section class="desk-np__section" id="kept" aria-labelledby="deskNpKeptTitle">
      <h2 class="desk-np__h2" id="deskNpKeptTitle">My Notes</h2>
      <div data-np-kept></div>
    </section>
    <section class="desk-np__section" id="whats-new" data-np-whats-new></section>
    <section class="desk-np__section" id="labels" aria-labelledby="deskNpLabelsTitle">
      <h2 class="desk-np__h2" id="deskNpLabelsTitle">Labels</h2>
      <p>Labels are your own tags. Put them on a note, highlight, or bookmark with its Labels… button, then filter by them above.</p>
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
      <p class="desk-np__note">“As I left it” starts minimized, then follows what you last did: a panel you minimize stays minimized, and one you open out stays open.</p>
    </section>
    <section class="desk-np__section desk-backup" id="backup" data-np-backup></section>
    <section class="desk-np__section" id="trash" aria-labelledby="deskNpTrashTitle">
      <h2 class="desk-np__h2" id="deskNpTrashTitle">Trash</h2>
      <p>What you delete waits here for ${TRASH_DAYS} days. Restore an item to put it back where it was; after ${TRASH_DAYS} days only a record that it was deleted remains, and a saved copy is the only way back.</p>
      <div data-np-trash-list></div>
    </section>
    <section class="desk-np__section" id="delete-everything" aria-labelledby="deskNpDeleteTitle">
      <h2 class="desk-np__h2" id="deskNpDeleteTitle">Delete in bulk</h2>
      <p>Each moves what it names in this browser to the trash. Choose Undo (or press Ctrl+Z, ⌘Z on a Mac) to bring it back until you leave the page, or restore it from the Trash above. The trash keeps each item for ${TRASH_DAYS} days, then only a record that it was deleted.</p>
      <div class="desk-np__danger">
        <h3 class="desk-np__h3">Delete all notes and marks</h3>
        <p>Every note, highlight, bookmark, pinned footnote, and label. Your sheets and templates stay.</p>
        <div data-np-delete-box></div>
      </div>
      <div class="desk-np__danger">
        <h3 class="desk-np__h3">Delete all sheets</h3>
        <p>Every sheet, and your own templates. Your notes and marks stay.</p>
        <div data-np-delete-sheets-box></div>
      </div>
      <div class="desk-np__danger">
        <h3 class="desk-np__h3">Empty the trash now</h3>
        <p>For a shared computer. Wipes the words of everything in the trash at once, instead of after ${TRASH_DAYS} days. Only a record that each item was deleted stays. This can’t be undone.</p>
        <div data-np-trash-box></div>
      </div>
    </section>
    <p class="sr-only" role="status" data-np-status></p>`;

  const q = (sel) => root.querySelector(sel);
  const kept = createKeptList({ store, ctx });
  q("[data-np-kept]").replaceWith(kept.el);
  const labelList = q("[data-np-labels]");
  const noLabels = q("[data-np-no-labels]");
  const labelError = q("[data-np-label-error]");
  const trashList = createTrashList({ store, ctx, announce: (message) => announce(message), onChange: () => render() });
  q("[data-np-trash-list]").replaceWith(trashList.el);
  const deleteBox = q("[data-np-delete-box]");
  const deleteSheetsBox = q("[data-np-delete-sheets-box]");
  const trashBox = q("[data-np-trash-box]");
  const statusEl = q("[data-np-status]");

  mountBackup(q("[data-np-backup]"), { store, ctx });
  // The release notes that touched the reader's verses (B3), drawn and kept
  // up to date by whats-new.js.
  mountWhatsNew(q("[data-np-whats-new]"), { store });
  mountStartChoice(q("[data-np-start]"));
  // Continue reading, drawn and kept up to date by continue-reading.js. Bookmarks
  // are in My Notes with the rest (E9).
  q("[data-np-continue]").append(
    continueSection({ emptyText: "Nothing to continue yet. Where you stop reading appears here." }),
  );

  let renderSeq = 0;
  // The records the last draw saw, for putting a section back after Cancel.
  let latestRecords = [];

  const announce = (message) => {
    statusEl.textContent = "";
    setTimeout(() => (statusEl.textContent = message), 50);
  };

  /* ── The records ───────────────────────────────────────────────── */

  async function render() {
    const seq = ++renderSeq;
    const [records] = await Promise.all([store.all(), kept.render()]);
    if (seq !== renderSeq) return;
    latestRecords = records;
    drawLabels(records);
    trashList.draw(records);
    drawDanger(records);
  }

  /* ── Labels ────────────────────────────────────────────────────── */

  const labelMessages = {
    empty: "Type a name first.",
    duplicate: "You already have a label with that name.",
    readonly: "That label was saved by a newer version, so it can’t be changed here.",
    missing: "That label isn’t in the notebook any more.",
    failed: WRITE_FAILED,
  };
  const sayLabel = (message) => {
    labelError.hidden = !message;
    labelError.textContent = message ?? "";
  };

  q("[data-np-new-label]").addEventListener("submit", async (e) => {
    e.preventDefault();
    sayLabel(null);
    const box = q("#deskNpNewLabel");
    const done = await writeOver((records) => planCreateLabel(records, box.value, ctx()));
    if (!done.ok) return sayLabel(labelMessages[done.reason]);
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
        // The list is not redrawn around a focused field (drawLabels), so the
        // form lets go of focus first, or it would stay on screen (DK8-1).
        if (document.activeElement === input) input.blur();
        await render();
        labelList.querySelector(`[data-id="${CSS.escape(label.id)}"] .desk-item__edit`)?.focus();
      };
      cancel.addEventListener("click", back);
      form.addEventListener("keydown", (e) => {
        // Escape ends an IME or dead-key composition first (GF8a-10).
        if (e.key === "Escape" && !e.isComposing) {
          e.stopPropagation();
          back();
        }
      });
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        sayLabel(null);
        const done = await writeOver((records) => planRenameLabel(records, label.id, input.value, ctx()));
        if (!done.ok) return sayLabel(labelMessages[done.reason]);
        announce(`Label renamed to “${done.label.name}.”`);
        back();
      });
    });

    del.addEventListener("click", async () => {
      sayLabel(null);
      const index = Array.from(labelList.children).indexOf(li);
      const done = await writeOver((records) => planDeleteLabel(records, label.id, ctx()));
      if (!done.ok) return sayLabel(labelMessages[done.reason]);
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

  /* ── Delete in bulk, and the trash ───────────────────────────── */

  // Three buttons that each ask again, on the page, before they act. Redrawn
  // only to bring a count up to date, never while the question is showing.
  const danger = {
    delete: { box: deleteBox, asking: false },
    sheets: { box: deleteSheetsBox, asking: false },
    trash: { box: trashBox, asking: false },
  };

  function drawDanger(records) {
    const counts = bulkCounts(records);
    const held = trashHeld(records);
    drawAsk(danger.delete, {
      count: counts.marks,
      ready: (n) => n > 0,
      button: "Delete all notes and marks…",
      none: "There are no notes or marks to delete.",
      question: (n) =>
        `Are you sure? This moves ${plural(n, "item", "items")} (every note, highlight, bookmark, pinned footnote, and label) to the trash. Your sheets and templates stay.`,
      confirm: "Delete all notes and marks",
      failed: "That couldn’t be saved in this browser, so nothing was deleted. Try again.",
      run: () => deleteInBulk(planDeleteMarks, (n) => `All notes and marks deleted: ${plural(n, "item", "items")} moved to the trash.`),
    });
    drawAsk(danger.sheets, {
      count: counts.sheets,
      ready: (n) => n > 0,
      button: "Delete all sheets…",
      none: "There are no sheets to delete.",
      question: (n) => `Are you sure? This moves ${plural(n, "sheet", "sheets")} (templates included) to the trash. Your notes and marks stay.`,
      confirm: "Delete all sheets",
      failed: "That couldn’t be saved in this browser, so nothing was deleted. Try again.",
      run: () => deleteInBulk(planDeleteSheets, (n) => `All sheets deleted: ${plural(n, "sheet", "sheets")} moved to the trash.`),
    });
    drawAsk(danger.trash, {
      count: held,
      ready: (n) => n > 0,
      button: "Empty the trash now…",
      none: "The trash is empty.",
      question: (n) =>
        `Are you sure? The words of ${plural(n, "deleted item", "deleted items")} will be gone for good. This can’t be undone.`,
      confirm: "Empty the trash now",
      failed: "That couldn’t be saved in this browser, so nothing was wiped. Try again.",
      run: emptyTrash,
    });
  }

  let askSeq = 0;
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
      const text = el("p", "desk-np__ask-text", spec.question(spec.count));
      // The group is named by the question, so it is read when focus lands on Cancel (NB-10).
      text.id = `deskNpAsk-${++askSeq}`;
      group.setAttribute("aria-labelledby", text.id);
      const yes = el("button", "desk-np__danger-button", spec.confirm);
      yes.type = "button";
      const no = el("button", "", "Cancel");
      no.type = "button";
      const failed = el("p", "desk-np__error");
      failed.setAttribute("role", "alert");
      failed.hidden = true;
      group.append(text, failed, yes, no);
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
        if ((await spec.run()) === false) {
          // Nothing was written: the question stays, with the reason, ready to ask again (GF8a-2).
          state.asking = true;
          failed.textContent = spec.failed;
          failed.hidden = false;
          yes.disabled = false;
          yes.focus();
        }
      });
    });
    state.box.replaceChildren(ask);
  }

  /**
   * Plan a change over the notebook as it is, and write it, in one
   * transaction (DI-9): another tab's write between the read and the write
   * can't be overwritten from a stale copy. `make` takes every record and
   * returns a plan, or a result with `ok` and a `plan` (the labels'); a result
   * that isn't `ok`, or an empty plan, writes nothing. Resolves to what `make`
   * returned.
   */
  async function writeOver(make, { record = true } = {}) {
    let made;
    try {
      await store.change(
        async ({ all }) => {
          made = make(await all());
          const plan = made?.plan ?? made;
          const none = !plan || made.ok === false || !(plan.put?.length || plan.remove?.length);
          return none ? null : planWrite(plan);
        },
        { record },
      );
    } catch (err) {
      // The transaction aborted: nothing was written, and the reader is told (GF8a-2).
      console.error("Study Desk: the notebook write failed", err);
      return { ok: false, reason: "failed" };
    }
    return made;
  }

  async function deleteInBulk(planFor, said) {
    const plan = await writeOver((records) => planFor(records, ctx()));
    if (plan.reason === "failed") return false;
    if (!plan.remove.length) return true;
    const entry = store.lastEntry();
    await render();
    const message = said(plan.remove.length);
    announce(message);
    kept.focusCount();
    if (entry) showUndo(message, async () => {
      await undoEntry(entry);
      await render();
    });
    return true;
  }

  async function emptyTrash() {
    // Not remembered for undo: undoing it would bring back what it was for.
    const plan = await writeOver((records) => planEmptyTrashNow(records), { record: false });
    if (plan.reason === "failed") return false;
    if (!plan.put.length) return true;
    await render();
    announce(`The trash is empty. The words of ${plural(plan.put.length, "item", "items")} are gone.`);
    trashBox.querySelector("p")?.setAttribute("tabindex", "-1");
    trashBox.querySelector("p")?.focus();
    return true;
  }

  // Search's "more in your notebook" link arrives with the words in the
  // fragment (#q=…), which a browser never sends to the server (SEC8-3); an
  // older link carries them as ?q=…, still read for now. They go into the
  // filter and out of the address, so the reader's search isn't kept in the
  // history or a bookmark of the page (SEC4-1).
  const takeAsked = () => {
    const url = new URL(window.location.href);
    const fromHash = askedInHash(url.hash);
    const fromQuery = url.searchParams.get("q");
    const asked = fromHash ?? fromQuery;
    if (asked) kept.setQuery(asked);
    if (fromHash !== null || url.searchParams.has("q")) {
      url.searchParams.delete("q");
      history.replaceState(history.state, "", `${url.pathname}${url.search}${fromHash !== null ? "" : url.hash}`);
    }
  };
  takeAsked();
  // The link followed again from this very page changes only the fragment, and
  // the list is already drawn, so it is filtered again here.
  window.addEventListener("hashchange", () => {
    takeAsked();
    kept.render({ reuse: true });
  });

  // A bookmark that moves as the reader reads writes every few seconds, and
  // says so (MOVE_KIND), so it isn't a reason to redraw the page under a reader
  // who is typing or has a menu open (BA107). A reading place another client
  // kept is quiet too, except that two things here count places, as items:
  // the bulk deletions' numbers and whether there is anything to delete. A new
  // place changes those, so a place the last draw hadn't seen draws again;
  // moving one doesn't, and deleting one arrives with its trash record, which
  // isn't excepted.
  store.subscribe(() => render(), { except: QUIET_KINDS });
  store.subscribe((ids) => {
    if (ids.some((id) => !latestRecords.some((r) => r?.id === id))) render();
  }, { kinds: ["place"] });
  await render();

  // The page is drawn after the browser has looked for the address's #part
  // (#backup, #labels), so go to it now. A fragment that isn't valid
  // percent-encoding (#%E0) names no part and is left alone (SEC4-2).
  const target = window.location.hash && document.getElementById(partId(window.location.hash.slice(1)));
  if (target) target.scrollIntoView({ block: "start" });
}

/** The words in an address's `#q=…` fragment, or null when it holds none (or isn't valid percent-encoding). */
function askedInHash(hash) {
  if (!String(hash).startsWith("#q=")) return null;
  try {
    return decodeURIComponent(hash.slice(3));
  } catch {
    return "";
  }
}

function partId(fragment) {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return "";
  }
}

start();
