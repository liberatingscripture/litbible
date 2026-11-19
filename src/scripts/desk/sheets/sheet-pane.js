// src/scripts/desk/sheets/sheet-pane.js
//
// /desk's Sheets pane (STUDY-DESK.md, S1; "Order of work", 3f): the sheet
// editor (sheet-editor.js) in a pane, and what only a pane has (S12, part 1,
// step 1). The editor is the host-free part, so another page can hold it.
//
// - **"Add to sheet" adds to a pane.** Every open Sheets pane is listed, and
//   the one last worked in is the target of the LIT pane's verse menu and
//   selection (`paneSheet`: the one-press part of their "Add to sheet" row,
//   ../sheets/sheet-add.js; E170) and of the Search pane's add buttons
//   (`addTarget`, `onAddTarget`).
// - **The command row's "New sheet…" names a pane** (`desk:sheet-new` with
//   its `paneId`), which opens that pane's template chooser.
// - **Which sheet it shows is the layout's** (`setPaneSheet`, handed in by
//   desk-panes.js as `getSheet` and `setSheet`), and its ids carry its pane id.
// - **"Take the Sheets tour"** at the foot of its list sends `desk:sheet-tour`
//   (E63), which desk-page.js answers; the tour itself is sheet-tour.js, and
//   `useAsTarget` is its, so the LIT pane's menu offers its pane's sheet.

import { sheetName } from "../../../lib/desk-sheet-passages.mjs";
import { buttons } from "../dom.js";
import { createSheetEditor } from "./sheet-editor.js";

const button = buttons("desk-sheet__btn");

/* ── "Add to sheet" in the LIT pane's menus ───────────────────────────── */

// Every open Sheets pane, and the one last worked in, which a verse menu or
// selection adds to.
const openPanes = new Set();
let lastUsed = null;

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

/**
 * The sheet the LIT pane's "Add to sheet" row adds to in one press (E170;
 * sheet-add.js, handed this by desk-page.js): the one in the Sheets pane last
 * worked in, as `{ id, name, add(fields) }`, where `add` goes through that
 * pane's editor, so the passage shows there at once. Null when no Sheets pane
 * shows a sheet, and the row is Chapter View's flyout alone.
 */
export function paneSheet() {
  const pane = targetPane();
  const s = pane?.sheet();
  return s ? { id: s.id, name: sheetName(s), add: (fields) => pane.addPassage(fields) } : null;
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
