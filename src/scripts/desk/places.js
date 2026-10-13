// src/scripts/desk/places.js
//
// The "Places" group (STUDY-DESK.md B1): Continue reading, Read View's place
// in each book and the reader's ribbons, shown together. It is one element,
// `placesSection`, that the Notebook panel's My Notes tab puts above its list
// and the /notebook/ page mounts as it is.
//
// Continue reading and Read View's places stay where reader code keeps them
// (localStorage: `lit_last_read`, `lit_rm_resume_<book>`) and are only read
// here; they are not notebook records, because whether reading places sync is
// still open. Ribbons are `place` records. On a chapter, an intro or a book's
// Read View, places in that book come first.
//
// Each place links to where it is, in the view it was kept in; a ribbon, which
// keeps no view, links to the one the reader is in (Read View's from Read
// View, as the notebook's other rows do). Following a ribbon starts it
// following the reader through the book (ribbon-follow.js, desk-places.mjs).
// Rename and Delete are for ribbons; a delete offers Undo in the bar, like
// every other deletion.
//
// A ribbon's name is the reader's own words: always text, never HTML.

import { editRecord } from "../../lib/desk-records.mjs";
import {
  RIBBON_NAME_MAX,
  cleanRibbonName,
  pageBookOf,
  placeItems,
  readPlacesFrom,
  ribbonNameProblem,
  ribbonsOf,
} from "../../lib/desk-places.mjs";
import { webClient } from "../../lib/desk-store-core.mjs";
import { loadLastRead } from "../last-read.js";
import { undoEntry } from "./history.js";
import { readBook } from "./page.js";
import { followRibbon } from "./ribbon-follow.js";
import { showUndo } from "./undo-bar.js";

let seq = 0;

/** What a write is stamped with when the caller doesn't say (the /notebook/ page). */
function pageCtx() {
  const contentVersion = document.documentElement.dataset.contentVersion || "unversioned";
  return { client: webClient(contentVersion), contentVersion };
}

/** Read View's per-book places, as localStorage holds them. */
function storedReadPlaces() {
  const entries = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith("lit_rm_resume_")) entries.push([key, window.localStorage.getItem(key)]);
    }
  } catch {
    /* storage unavailable: no Read View places */
  }
  return readPlacesFrom(entries);
}

/**
 * The Places group as an element. It draws itself, keeps itself in step with
 * the notebook (this tab's changes and other tabs'), with Continue reading
 * moving as the reader reads, and has nothing to show for a reader with no
 * places: it stays hidden unless `emptyText` is given. `section.refresh()`
 * redraws it at once; the My Notes tab calls that when it is shown.
 *
 * @param {{ store: object | null, ctx?: (() => { client: string }) | null,
 *   emptyText?: string | null }} options
 * @returns {HTMLElement & { refresh: () => Promise<void> }}
 */
export function placesSection({ store, ctx = null, emptyText = null }) {
  const stamp = ctx ?? pageCtx;
  const n = ++seq;
  const section = document.createElement("section");
  section.className = "desk-places";
  section.setAttribute("aria-labelledby", `deskPlacesTitle${n}`);
  section.hidden = true;

  const title = document.createElement("h3");
  title.className = "desk-mine__pins-title desk-places__title";
  title.id = `deskPlacesTitle${n}`;
  title.tabIndex = -1;
  title.textContent = "Places";
  const list = document.createElement("ul");
  list.className = "desk-list desk-places__list";
  const empty = document.createElement("p");
  empty.className = "desk-places__empty";
  empty.hidden = true;
  section.append(title, list, empty);

  // A row being renamed must not be redrawn under the reader's typing.
  let editing = false;
  let stale = false;
  let renderSeq = 0;

  // Where focus should land once the next draw finishes. A draw another one
  // overtakes leaves it for that one, so a redraw from the notebook's own
  // change can't swallow it.
  let wantFocus = null;

  async function render({ focus = null } = {}) {
    if (focus) wantFocus = focus;
    if (editing) {
      stale = true;
      return;
    }
    const mine = ++renderSeq;
    let records = [];
    try {
      records = store ? await store.all() : [];
    } catch (err) {
      console.error("Study Desk: couldn't read the places", err);
    }
    if (mine !== renderSeq || editing) return;
    const page = pageBookOf(window.location.pathname);
    const items = placeItems({
      lastRead: loadLastRead(),
      readPlaces: storedReadPlaces(),
      records,
      thisBook: page?.bookKey ?? null,
      inReadView: Boolean(readBook()),
    });
    const ribbons = ribbonsOf(records);
    list.replaceChildren(...items.map((item) => rowFor(item, ribbons)));
    section.hidden = items.length === 0 && !emptyText;
    empty.hidden = items.length > 0 || !emptyText;
    empty.textContent = items.length ? "" : (emptyText ?? "");
    if (wantFocus === "title") title.focus({ preventScroll: true });
    else if (wantFocus) (list.querySelector(wantFocus) ?? title).focus({ preventScroll: true });
    wantFocus = null;
  }

  function rowFor(item, ribbons) {
    const li = document.createElement("li");
    li.className = `desk-item desk-item--place desk-item--place-${item.type}`;
    li.dataset.place = item.key;
    const head = document.createElement("a");
    head.className = "desk-item__ref";
    head.textContent = item.title;
    head.href = item.href;
    const kind = document.createElement("span");
    kind.className = "desk-item__kind";
    kind.textContent = item.detail;
    li.append(head, kind);
    if (item.sub) {
      const where = document.createElement("p");
      where.className = "desk-item__words desk-places__where";
      where.textContent = item.sub;
      li.append(where);
    }
    if (item.type === "ribbon") {
      const ribbon = ribbons.find((r) => r.id === item.id);
      // The tab remembers which ribbon the reader opened their book through,
      // so it moves with them. A modified click opens elsewhere and doesn't.
      head.addEventListener("click", (e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
        if (ribbon) followRibbon(ribbon);
      });
      if (store && ribbon) li.append(actionsFor(ribbon, li));
    }
    return li;
  }

  function actionsFor(ribbon, li) {
    const box = document.createElement("div");
    box.className = "desk-places__actions";
    const rename = document.createElement("button");
    rename.type = "button";
    rename.className = "desk-item__edit desk-places__rename";
    rename.textContent = "Rename";
    rename.setAttribute("aria-label", `Rename ribbon ${ribbon.name}`);
    rename.addEventListener("click", () => startRename(ribbon, li));
    const del = document.createElement("button");
    del.type = "button";
    del.className = "desk-item__delete desk-places__delete";
    del.textContent = "Delete";
    del.setAttribute("aria-label", `Delete ribbon ${ribbon.name}`);
    del.addEventListener("click", () => remove(ribbon, li));
    box.append(rename, del);
    return box;
  }

  /* ── Rename ──────────────────────────────────────────────────── */

  function startRename(ribbon, li) {
    editing = true;
    const id = `deskPlacesName${n}`;
    const form = document.createElement("form");
    form.className = "desk-places__rename-form";
    form.setAttribute("novalidate", "");
    const label = document.createElement("label");
    label.className = "sr-only";
    label.htmlFor = id;
    label.textContent = "Ribbon name";
    const input = document.createElement("input");
    input.type = "text";
    input.id = id;
    input.className = "desk-places__name";
    input.maxLength = RIBBON_NAME_MAX;
    input.autocomplete = "off";
    input.value = ribbon.name;
    const save = document.createElement("button");
    save.type = "submit";
    save.className = "desk-places__save";
    save.textContent = "Save";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "desk-item__edit";
    cancel.textContent = "Cancel";
    const problem = document.createElement("p");
    problem.className = "desk-places__problem";
    problem.setAttribute("role", "alert");
    problem.hidden = true;
    form.append(label, input, save, cancel, problem);
    li.replaceChildren(form);
    input.focus();
    input.select();

    const finish = async (focus) => {
      editing = false;
      stale = false;
      await render({ focus });
    };
    cancel.addEventListener("click", () => {
      finish(`[data-place="${CSS.escape(ribbon.id)}"] .desk-places__rename`);
    });
    // Escape cancels the rename, not the whole panel.
    form.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      cancel.click();
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      let records = [];
      try {
        records = ribbonsOf(await store.all());
      } catch (err) {
        console.error("Study Desk: couldn't read the ribbons", err);
      }
      const bad = ribbonNameProblem(input.value, records, ribbon.id);
      if (bad) {
        problem.hidden = false;
        problem.textContent = bad;
        input.focus();
        return;
      }
      const name = cleanRibbonName(input.value);
      try {
        const current = (await store.get(ribbon.id)) ?? ribbon;
        if (current.name !== name) {
          await store.save(editRecord(current, { name }, { now: new Date().toISOString(), client: stamp().client }));
        }
      } catch (err) {
        console.error("Study Desk: the ribbon wasn't renamed", err);
        problem.hidden = false;
        problem.textContent = "The ribbon couldn’t be renamed in this browser.";
        return;
      }
      finish(`[data-place="${CSS.escape(ribbon.id)}"] .desk-places__rename`);
    });
  }

  /* ── Delete ──────────────────────────────────────────────────── */

  async function remove(ribbon, li) {
    const rows = Array.from(list.children);
    const index = rows.indexOf(li);
    const trash = await store.remove(ribbon.id);
    if (!trash) return;
    // The change this made, read at once: the undo button, like Ctrl+Z,
    // takes back exactly this one (history.js).
    const entry = store.lastEntry();
    const next = rows[index + 1] ?? rows[index - 1];
    await render({
      focus: next ? `[data-place="${CSS.escape(next.dataset.place)}"] a.desk-item__ref` : "title",
    });
    showUndo(`Ribbon “${ribbon.name}” deleted.`, async () => {
      await undoEntry(entry);
      await render({ focus: `[data-place="${CSS.escape(ribbon.id)}"] .desk-places__delete` });
    });
  }

  /* ── Keeping in step ─────────────────────────────────────────── */

  // Quiet while out of sight: the My Notes tab calls `refresh` when it shows.
  const visible = () => Boolean(section.parentElement?.getClientRects().length);
  const whenSeen = () => {
    if (visible()) render();
  };
  store?.subscribe(whenSeen);
  // Another tab's Continue reading or Read View place.
  window.addEventListener("storage", (e) => {
    if (e.key === null || e.key === "lit_last_read" || e.key?.startsWith("lit_rm_resume_")) whenSeen();
  });
  // This tab's Continue reading moves as the reader reads: a slow redraw.
  let timer = 0;
  window.addEventListener("lit:last-read", () => {
    if (timer) return;
    timer = window.setTimeout(() => {
      timer = 0;
      whenSeen();
    }, 2000);
  });

  section.refresh = () => render();
  render();
  return section;
}
