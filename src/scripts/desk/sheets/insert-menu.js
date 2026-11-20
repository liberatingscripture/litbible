// src/scripts/desk/sheets/insert-menu.js
//
// The menu under a sheet card's gap "Add" pill (BVJ, 2026-11-08): the parts
// the add bar offers, each added right after that card, so a long sheet needn't
// be scrolled to its end. Taken out of the sheet editor (now sheet-editor.js)
// (Audit 6, LG6-2), as kind-menu.js and title-menu.js were out of
// desk-page.js's `start()`, so the next bug in it means reading this file, not
// 1,600 lines of shared locals. Since E177 the menu itself is the desk's one
// button menu (../button-menu.js), which a collection's "Add ▾" uses too;
// this file holds the sheet's lines.
//
// What a pick does is the pane's (`onPick(type)`: "Passage…" opens the passage
// form under the card, anything else adds that part after it); the menu only
// closes first. One key terms box per sheet, as in the bar, so the caller says
// whether the sheet has one. Keys and closing are button-menu.js's.
//
// - `button` the pill; it gets `aria-expanded` and `aria-controls`, and focus
//   back on Escape.
// - `id` the menu's element id (unique per pane and card).
// - `name` what the card is called, for the menu's accessible name.
// - `hasTerms` whether the sheet already holds a key terms box.
// - `onPick(type)` a part was chosen, after the menu closed.
// - `onClose(close)` the menu is closing; `close` is the handle's own, so the
//   pane can tell whether the menu it holds is this one.
//
// Returns `{ close(refocus) }`.

import { buttonMenuPlace, openButtonMenu } from "../button-menu.js";

/**
 * The menu's lines, in order: label, part type, and for the key terms box
 * whether it is disabled and why.
 *
 * @param {boolean} hasTerms the sheet already holds a key terms box
 * @returns {{ label: string, type: string, disabled: boolean, why: string | null }[]}
 */
export function insertItems(hasTerms) {
  const line = (label, type, disabled = false, why = null) => ({ label, type, disabled, why });
  return [
    line("Passage…", "passage"),
    line("Text", "text"),
    line("Question", "question"),
    line("Space to write", "space"),
    line("Page break", "pageBreak"),
    line("Key terms box", "keyTerms", !!hasTerms, hasTerms ? "already on the sheet" : null),
  ];
}

/** Where the menu goes: button-menu.js's rule, kept under its old name for the sheet's tests. */
export const insertMenuPlace = buttonMenuPlace;

export function openInsertMenu({ button, id, name, hasTerms, onPick, onClose }) {
  return openButtonMenu({
    button,
    id,
    label: `Add a part after ${name}`,
    items: insertItems(hasTerms),
    className: "desk-sheet__insert-menu",
    onPick,
    onClose,
  });
}
