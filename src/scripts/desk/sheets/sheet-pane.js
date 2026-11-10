// src/scripts/desk/sheets/sheet-pane.js
//
// /desk's Sheets pane (STUDY-DESK.md, S1; "Order of work", 3f): the sheet
// editor (sheet-editor.js) in a pane, and what only a pane has (S12, part 1,
// step 1). The editor is the host-free part, so another page can hold it.
//
// - **"Add to sheet" adds to a pane.** Every open Sheets pane is listed, and
//   the one last worked in is the target of the LIT pane's verse menu and
//   selection ("Add to sheet", offered while a sheet is open) and of the
//   Search pane's add buttons (`addTarget`, `onAddTarget`).
// - **The command row's "New sheet…" names a pane** (`desk:sheet-new` with
//   its `paneId`), which opens that pane's template chooser.
// - **Which sheet it shows is the layout's** (`setPaneSheet`, handed in by
//   desk-panes.js as `getSheet` and `setSheet`), and its ids carry its pane id.
// - **"Take the Sheets tour"** at the foot of its list sends `desk:sheet-tour`
//   (E63), which desk-page.js answers; the tour itself is sheet-tour.js, and
//   `useAsTarget` is its, so the LIT pane's menu offers its pane's sheet.

import {
  passageFromOffsets,
  passageFromVerses,
  sheetName,
} from "../../../lib/desk-sheet-passages.mjs";
import { rangeToOffsets } from "../../../lib/desk-anchor-dom.mjs";
import { closePanel } from "../../lit-panel.js";
import { buttons, make } from "../dom.js";
import { createSheetEditor } from "./sheet-editor.js";

const button = buttons("desk-sheet__btn");

/* ── "Add to sheet" in the LIT pane's menus ───────────────────────────── */

// Every open Sheets pane, and the one last worked in, which a verse menu or
// selection adds to.
const openPanes = new Set();
let lastUsed = null;
let listening = false;

function targetPane() {
  const showing = [...openPanes].filter((p) => p.sheet());
  if (lastUsed && showing.includes(lastUsed)) return lastUsed;
  return showing[0] ?? null;
}

/**
 * The sheet "Add to sheet" adds to: the one in the Sheets pane last worked in,
 * else the first showing one, as `{ id, name }`; null when no Sheets pane shows
 * a sheet. The Search pane's add buttons (3m) follow the same rule.
 */
export function addTarget() {
  const pane = targetPane();
  const s = pane?.sheet();
  // `ready` saves a new sheet not yet written (SH6-7); call it before writing to `id`.
  return s ? { id: s.id, name: sheetName(s), ready: pane.persist } : null;
}

const targetListeners = new Set();
const targetChanged = () => { for (const fn of targetListeners) fn(); };

/**
 * Make this pane's editor the one "Add to sheet" adds to, as working in it
 * does: for the Sheets tour (E63), which opens the LIT pane's verse menu
 * without the reader having touched its pane.
 */
export function useAsTarget(editor) {
  if (!openPanes.has(editor)) return;
  lastUsed = editor;
  targetChanged();
}

/** Called when the sheet `addTarget` names may have changed; returns the way to stop. */
export function onAddTarget(fn) {
  targetListeners.add(fn);
  return () => targetListeners.delete(fn);
}

function listenForPanels() {
  if (listening) return;
  listening = true;
  document.addEventListener("lit:panel-actions", (e) => {
    const d = e.detail;
    if (d.view !== "desk" || !d.book || !d.chapter) return;
    const pane = targetPane();
    if (!pane) return;
    const heading = make("p", "lit-panel__subheading", "Sheets");
    const add = button(`Add to “${sheetName(pane.sheet())}”`, "lit-panel__btn");
    add.addEventListener("click", async () => {
      d.acting?.();
      const where = { bookKey: d.book, chapter: d.chapter };
      let fields = null;
      try {
        const text = d.textFor?.() ?? null;
        if (d.kind === "selection" && d.range && text) {
          const offsets = rangeToOffsets(text, d.range);
          if (offsets) fields = passageFromOffsets(text, where, offsets[0], offsets[1], pane.contentVersion());
        }
        fields ??= passageFromVerses(text, where, d.start, d.end, pane.contentVersion());
      } catch (err) {
        console.error("Study Desk: couldn't read the passage for the sheet", err);
        fields = passageFromVerses(null, where, d.start, d.end);
      }
      const added = await pane.addPassage(fields);
      const again = added?.again === true;
      add.textContent = !added ? "Couldn’t add it" : again ? "Added again ✓" : "Added ✓";
      // Why "again" stays on screen long enough to read (BA75).
      if (again) row.after(make("p", "lit-panel__hint", added.message));
      if (d.kind === "selection") window.getSelection()?.removeAllRanges();
      setTimeout(closePanel, again ? 2500 : 700);
    });
    const row = make("div", "lit-panel__row");
    row.append(add);
    d.append(heading);
    d.append(row);
  });
}

/* ── The pane ─────────────────────────────────────────────────────────── */

/**
 * @param {{ store: object | null, ctx: () => { client: string, contentVersion: string },
 *   paneId: string, getSheet: () => string | null, setSheet: (id: string | null) => void,
 *   showPassage?: ((passage: object) => void) | null }} options
 *   `getSheet` and `setSheet` are which sheet the pane shows, kept by the page;
 *   `showPassage` moves the LIT pane to a passage, where there is one.
 * @returns {{ el: HTMLElement, destroy: () => void, editor: object }}
 *   `editor` is the sheet editor, for the Sheets tour (sheet-tour.js).
 */
export function createSheetPane({ store, ctx, paneId, getSheet, setSheet, showPassage = null }) {
  const editor = createSheetEditor({
    store,
    ctx,
    idSuffix: paneId,
    getSheet,
    setSheet,
    showPassage,
    onSheetChange: targetChanged,
    onTour: () => document.dispatchEvent(new CustomEvent("desk:sheet-tour", { detail: { paneId } })),
  });
  // A browser keeping no notebook shows a line and nothing to add to.
  if (!store) return { el: editor.el, destroy() {}, editor };

  openPanes.add(editor);
  listenForPanels();
  editor.el.addEventListener("pointerdown", () => { lastUsed = editor; targetChanged(); });
  editor.el.addEventListener("focusin", () => { lastUsed = editor; targetChanged(); });

  // "New sheet…" in the command row (E68), for this pane. Registered synchronously
  // as the pane is built, because command-row.js sends the event right after
  // its commit; a pane built later would miss it (DK6-10).
  const onNewSheet = (e) => {
    if (e.detail?.paneId === paneId) editor.newSheet();
  };
  document.addEventListener("desk:sheet-new", onNewSheet);

  return {
    el: editor.el,
    editor,
    destroy() {
      editor.destroy();
      document.removeEventListener("desk:sheet-new", onNewSheet);
      openPanes.delete(editor);
      if (lastUsed === editor) lastUsed = null;
      targetChanged();
    },
  };
}
