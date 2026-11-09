// src/scripts/desk/sheets/sheet-page-list.js
//
// The rows of /sheets/'s list (STUDY-DESK-FIXES.md E64; BVJ, 2026-11-09):
// each sheet with Duplicate, Save as template and Delete, and the reader's
// own templates under "My templates", as a Sheets pane's list has them
// (my-sheets.js draws both). Until then the page listed its sheets as plain
// links, since it never wrote a record; S12 gave it an editor, and with it
// the reason for the actions.
//
// sheet-page.js imports this file by import() when it draws the list, never
// statically: the rows bring the history (Ctrl+Z and the undo bar's Undo for
// a deletion), which a page opened to print or present has no use for, and a
// test holds history.js out of the page's chunk. Nothing here is the
// editor's: Duplicate opens the copy in the page's editor through
// `openEditor`, which loads it then.

import { createHistory } from "../history.js";
import { announce, initUndo } from "../undo-bar.js";
import { ownTemplatesList, sheetRow } from "./my-sheets.js";
import { make } from "../dom.js";

/**
 * The list's rows for `sheets` and the reader's templates (`mine`), both
 * already sorted. A row's name is a link (`href`); Duplicate opens the copy
 * in the editor (`openEditor(id)`), and Save as template and Delete redraw
 * the list with focus on the row named by its key (`redraw(focusKey)`).
 *
 * @returns {{ list: HTMLElement | null, own: HTMLElement | null }}
 */
export function pageListRows({ store, ctx, root, sheets, mine, href, openEditor, redraw }) {
  // Started before any row can write, as the editor's host starts them.
  initUndo();
  createHistory({ store, ctx });
  const host = {
    store,
    opCtx: ctx,
    idSuffix: "page",
    say: announce,
    content: root,
    sheetHref: href,
    openSheet: (id) => openEditor(id),
    showList: ({ focus = null } = {}) => redraw(focus),
    headingTag: "h2",
  };
  let list = null;
  if (sheets.length) {
    list = make("ul", "desk-sheet__sheets sheets-page__sheets");
    for (const s of sheets) list.append(sheetRow(host, s, list));
  }
  return { list, own: mine.length ? ownTemplatesList(host, mine) : null };
}
