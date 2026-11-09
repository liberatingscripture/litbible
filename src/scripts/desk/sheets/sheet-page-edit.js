// src/scripts/desk/sheets/sheet-page-edit.js
//
// The sheet editor on the Sheets page (STUDY-DESK.md, S12, part 1, step 2):
// /sheets/'s host for sheet-editor.js, as sheet-pane.js is /desk's.
// sheet-page.js imports this file only when the reader presses Edit or New
// sheet…, or when the Sheets tour wants its editor (E63), so the page stays
// light for printing and presenting.
//
// - **Which sheet it edits is the address**: `/sheets/?id=<id>&view=edit`. A
//   new sheet isn't written until its first change (SH6-7), so it has no id
//   until then, and the address gains one when it is saved.
// - **The page's own list and versions stand in for the editor's**: "‹ All
//   sheets" goes to the page's list (`onList`), and Done back to the sheet's
//   versions (`onDone`), where the pane has "Present…" and "Print or share…".
//   Cancel, when another tab is editing the sheet, goes back to its versions
//   too (`onCancel`; S12, part 4).
// - **Ctrl+Z and the undo bar** start with the first editor, before it can
//   write anything; the page never writes a record before then.
// - Nothing here is a pane's: no LIT pane to show a passage in, and no "Add
//   to sheet" target.

import { createHistory } from "../history.js";
import { initUndo } from "../undo-bar.js";
import { createSheetEditor } from "./sheet-editor.js";
import { templateChooser } from "./my-sheets.js";
import { isOwnTemplate } from "../../../lib/desk-sheets.mjs";
import { sortSheets } from "../../../lib/desk-sheet-passages.mjs";
import { make } from "../dom.js";

/**
 * Put the editor in `root`, on the sheet `id`, or on a new sheet from
 * `template` (a built-in template's id or one of the reader's own).
 *
 * @param {{ root: HTMLElement, store: object, ctx: () => object, id?: string | null,
 *   template?: string | object | null, onSaved: (id: string) => void,
 *   onList: () => void, onDone: (id: string) => void, onCancel: (id: string) => void,
 *   askFirst?: boolean }} options
 *   `onSaved` is told the sheet's id once it has one, for the address;
 *   `askFirst: false` opens it without the two-tab question (sent from a Sheets pane).
 * @returns {{ destroy: () => void, editor: object }}
 *   `editor` is the sheet editor itself, for the Sheets tour (E63), which
 *   turns it to its example mode and starts the tour's sheet in it.
 */
export function editSheet({ root, store, ctx, id = null, template = null, onSaved, onList, onDone, onCancel, askFirst = true }) {
  initUndo();
  createHistory({ store, ctx });
  let shown = id;
  const editor = createSheetEditor({
    store,
    ctx,
    idSuffix: "page",
    getSheet: () => shown,
    setSheet: (next) => {
      if (next && next !== shown) onSaved(next);
      shown = next;
    },
    onList,
    onDone,
    onCancel,
    askFirst,
  });
  root.replaceChildren(make("h1", "sr-only", "Edit a sheet"), editor.el);
  root.classList.add("sheets-page--editing");
  // Chosen before the editor's first view, which then stays out of the way.
  if (template) editor.startFrom(template);
  return {
    editor,
    destroy() {
      editor.destroy();
      root.classList.remove("sheets-page--editing");
    },
  };
}

/**
 * The templates "New sheet…" offers on /sheets/, under `opener`: the
 * built-in ones and the reader's own. Hidden until `toggle()`.
 */
export async function newSheetChooser({ opener, store, onPick }) {
  let mine = [];
  try {
    mine = sortSheets((await store.all()).filter((r) => r.kind === "sheet" && isOwnTemplate(r)));
  } catch (err) {
    console.error("Study Desk: couldn't read the templates", err);
  }
  return templateChooser({ opener, mine, idSuffix: "page", onPick });
}
