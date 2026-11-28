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
// release notes that touched their verses); Labels (make, rename, delete); Back up
// your notebook and Merge a backup (export-import.js, which All settings shows too); and
// Trash, where a deleted item can be restored for its 30 days (trash-list.js; E12). How the
// Notebook panel starts and Delete in bulk moved to All settings in Featherboa's Phase 4
// (NB-25 to NB-27; desk/settings-page.js), and the page's last line says so.
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
import { collectionName, labelBookmarks, planLabelRulesToItems, rulesUsing } from "../../lib/desk-collections.mjs";
import { openAddLabel } from "./collections/add-records.js";
import { addDeskStyle, deskCtx as ctx } from "./boot.js";
import { mountBackup } from "./export-import.js";
import { createHistory, undoEntry } from "./history.js";
import { createKeptList } from "./kept-list.js";
import { continueSection } from "./continue-reading.js";
import { openStore } from "./store.js";
import { initUndo, showUndo } from "./undo-bar.js";
import { createTrashList } from "./trash-list.js";
import { mountWhatsNew } from "./whats-new.js";
import { planWrite, QUIET_KINDS } from "../../lib/desk-store-core.mjs";
import { TRASH_DAYS } from "../../lib/desk-records.mjs";
import { SLOT_EVENT, SYNC_META, readLink } from "../../lib/desk-sync-link.mjs";
import { notebookIntro } from "../../lib/desk-reminder.mjs";
import { SETTINGS_HREF } from "../../lib/display-tray.mjs";
import { el } from "./dom.js";
import { plural } from "./desk-text.js";


// What a write that the browser refused says (quota, a database closed by
// another tab's upgrade), as labels-ui.js says it (GF8a-2).
const WRITE_FAILED = "That couldn’t be saved in this browser, so nothing changed. Try again.";

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

  // Whether this browser's notebook syncs with an account: the page's first
  // line and its backup section say so (step 4j). Read before the page is
  // drawn, so neither line changes under the reader.
  let linked = false;
  try {
    linked = readLink(await store.getMeta(SYNC_META)) != null;
  } catch (_) {
    /* unread: the words for a notebook kept here alone */
  }

  root.innerHTML = `
    <p class="desk-np__intro">${notebookIntro(linked)}</p>
    <div data-desk-sync-slot hidden></div>
    <nav class="desk-np__jump" aria-label="On this page">
      <a href="#continue">Continue reading</a>
      <a href="#kept">My Notes</a>
      <a href="#whats-new">What’s new for you</a>
      <a href="#labels">Labels</a>
      <a href="#backup">Back up</a>
      <a href="#trash">Trash</a>
    </nav>
    <section class="desk-np__section" id="continue" data-np-continue></section>
    <section class="desk-np__section" id="kept" aria-labelledby="deskNpKeptTitle">
      <h2 class="desk-np__h2" id="deskNpKeptTitle">My Notes</h2>
      <div data-np-kept></div>
    </section>
    <section class="desk-np__section" id="whats-new" data-np-whats-new></section>
    <section class="desk-np__section" id="labels" aria-labelledby="deskNpLabelsTitle">
      <h2 class="desk-np__h2" id="deskNpLabelsTitle">Labels</h2>
      <p>Labels are your own tags for bookmarks. Put them on a bookmark with its Labels… button, then filter by them above.</p>
      <form class="desk-np__new-label" data-np-new-label>
        <label for="deskNpNewLabel">New label</label>
        <input type="text" id="deskNpNewLabel" maxlength="60" autocomplete="off" />
        <button type="submit">Add</button>
      </form>
      <p class="desk-np__error" role="alert" data-np-label-error hidden></p>
      <ul class="desk-np__labels" data-np-labels></ul>
      <p class="desk-panel__empty" data-np-no-labels hidden>No labels yet.</p>
    </section>
    <section class="desk-np__section desk-backup" id="backup" data-np-backup></section>
    <section class="desk-np__section" id="trash" aria-labelledby="deskNpTrashTitle">
      <h2 class="desk-np__h2" id="deskNpTrashTitle">Trash</h2>
      <p>What you delete waits here for ${TRASH_DAYS} days. Restore an item to put it back where it was; after ${TRASH_DAYS} days only a record that it was deleted remains, and a backup is the only way back.</p>
      <div data-np-trash-list></div>
    </section>
    <p class="desk-np__moved" data-np-moved>How the Notebook panel opens on each page, and Delete in bulk (“Empty the trash now” among its choices), are in <a href="${SETTINGS_HREF}">All settings</a>.</p>
    <p class="sr-only" role="status" data-np-status></p>`;
  // The synced notebook's status line takes its slot, in a browser linked to an
  // account (sync/status-line.js); nothing hears this anywhere else.
  document.dispatchEvent(new CustomEvent(SLOT_EVENT));

  const q = (sel) => root.querySelector(sel);
  const kept = createKeptList({ store, ctx });
  q("[data-np-kept]").replaceWith(kept.el);
  const labelList = q("[data-np-labels]");
  const noLabels = q("[data-np-no-labels]");
  const labelError = q("[data-np-label-error]");
  const trashList = createTrashList({ store, ctx, announce: (message) => announce(message), onChange: () => render() });
  q("[data-np-trash-list]").replaceWith(trashList.el);
  const statusEl = q("[data-np-status]");

  mountBackup(q("[data-np-backup]"), { store, ctx, linked });
  // The release notes that touched the reader's verses (B3), drawn and kept
  // up to date by whats-new.js.
  mountWhatsNew(q("[data-np-whats-new]"), { store });
  // Continue reading, drawn and kept up to date by continue-reading.js. Bookmarks
  // are in My Notes with the rest (E9).
  q("[data-np-continue]").append(
    continueSection({ emptyText: "Nothing to continue yet. Where you stop reading appears here." }),
  );

  let renderSeq = 0;
  // The records the last draw saw, for the label rows' collections.
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
    // "Add all bookmarks labeled Advent…" (D13, step 5): the pick window with decision 23's two choices.
    const bookmarks = labelBookmarks(latestRecords, label.id).length;
    const addAll = bookmarks ? el("button", "desk-item__edit", `Add all bookmarks labeled ${label.name}…`) : null;
    if (addAll) {
      addAll.type = "button";
      addAll.setAttribute("aria-haspopup", "dialog");
      addAll.addEventListener("click", () => {
        const at = addAll.getBoundingClientRect();
        openAddLabel({
          store,
          ctx,
          label: { id: label.id, name: label.name },
          count: bookmarks,
          near: { left: at.left, top: at.bottom + 8 },
          back: () => addAll,
        });
      });
    }
    li.append(name, used, rename, ...(addAll ? [addAll] : []), del);

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

    /** Delete the label; `keep` turns the rules that use it into the bookmarks they hold, in the same write (one Ctrl+Z). */
    async function deleteLabel(keep) {
      sayLabel(null);
      const index = Array.from(labelList.children).indexOf(li);
      let refused = [];
      let kept = 0;
      const done = await writeOver((records) => {
        const gone = planDeleteLabel(records, label.id, ctx());
        if (!gone.ok || !keep) return gone;
        const turned = planLabelRulesToItems(records, label.id, ctx());
        refused = turned.refused;
        kept = turned.put.length;
        return { ...gone, plan: { put: [...turned.put, ...gone.plan.put], remove: gone.plan.remove } };
      });
      if (!done.ok) {
        await render();
        return sayLabel(labelMessages[done.reason]);
      }
      const entry = store.lastEntry();
      await render();
      const buttons = labelList.querySelectorAll(".desk-item__delete");
      (buttons[Math.min(index, buttons.length - 1)] ?? q("#deskNpNewLabel")).focus();
      const was = done.stripped ? ` It was on ${plural(done.stripped, "item", "items")}.` : "";
      const full = refused.length
        ? ` ${plural(refused.length, "collection was", "collections were")} full, so ${refused.length === 1 ? "its" : "their"} rule stays and says the label is gone.`
        : "";
      const stays = keep && kept ? " Its bookmarks stay in the collections that used it." : "";
      showUndo(`Label “${label.name}” deleted.${was}${stays}${full}`, async () => {
        await undoEntry(entry);
        await render();
      });
    }

    // A label a collection's rule uses asks first, on the row, as Delete in bulk does in All settings (D13, step 5).
    function askKeep(using) {
      const names = [...new Set(using.map(({ collection }) => collectionName(collection)))];
      const where = names.length < 3 ? names.join(" and ") : `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
      const group = el("div", "desk-np__ask");
      group.setAttribute("role", "group");
      const text = el("p", "desk-np__ask-text", `${label.name} is used by ${where}. Keep its ${bookmarks === 1 ? "bookmark" : `${bookmarks} bookmarks`} there?`);
      text.id = `deskNpKeep-${label.id}`;
      group.setAttribute("aria-labelledby", text.id);
      const yes = el("button", "", bookmarks === 1 ? "Yes, keep it" : "Yes, keep them");
      yes.type = "button";
      const no = el("button", "", "No, just delete the label");
      no.type = "button";
      const cancel = el("button", "", "Cancel");
      cancel.type = "button";
      group.append(text, yes, no, cancel);
      li.replaceChildren(group);
      cancel.focus();
      const back = async () => {
        await render();
        labelList.querySelector(`[data-id="${CSS.escape(label.id)}"] .desk-item__delete`)?.focus();
      };
      cancel.addEventListener("click", back);
      group.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !e.isComposing) {
          e.stopPropagation();
          back();
        }
      });
      yes.addEventListener("click", () => deleteLabel(true));
      no.addEventListener("click", () => deleteLabel(false));
    }

    del.addEventListener("click", () => {
      const using = rulesUsing(latestRecords, label.id);
      if (using.length) askKeep(using);
      else deleteLabel(false);
    });
    return li;
  }

  /* ── Writing ───────────────────────────────────────────────── */

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
  // kept is quiet too: nothing here lists or counts places since the bulk
  // deletions, which counted them, moved to All settings (which listens for a
  // new one), and deleting one arrives with its trash record, which isn't
  // excepted.
  store.subscribe(() => render(), { except: QUIET_KINDS });
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
