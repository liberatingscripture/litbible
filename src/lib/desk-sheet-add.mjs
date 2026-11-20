// src/lib/desk-sheet-add.mjs
//
// "Add to sheet ▸" on a chapter page (STUDY-DESK.md, S12, part 2, way 3; BVJ,
// 2026-11-08, decision 3): the verse menu and the selection panel list the
// reader's sheets, newest change first, and "New sheet…" (a name window, as
// "New collection…" is; E172). Picking one adds the passage without leaving the
// page. Past five, "All sheets…" opens a window listing every one (E154). No
// add is ever one press (E172, as D13's decision 17 is for collections). Pure: the page reads the notebook and
// writes the plan in one `store.change`, as every change to a sheet is
// written (BA129).

import { canEdit } from "./desk-records.mjs";
import { SHEET_LIMITS } from "./desk-sheet-format.mjs";
import { passageInsertIndex, passageReference, samePassage, sheetName, sortSheets } from "./desk-sheet-passages.mjs";
import { addModule, createSheet, isOwnTemplate, makeModule, planSheetChange } from "./desk-sheets.mjs";

/**
 * How many sheets the flyout lists. Past that it ends in "All sheets…", a
 * window listing every one (E154).
 */
export const ADD_MENU_SHEETS = 5;

/**
 * Every sheet that can take a passage: the reader's own (no templates, none a
 * newer format made, none already full), newest change first. "All sheets…"
 * lists them all, with when each was last changed.
 *
 * @returns {{ id: string, name: string, modified: string | null }[]}
 */
export function addableSheets(records) {
  const sheets = (records ?? []).filter(
    (r) => r?.kind === "sheet" && !isOwnTemplate(r) && canEdit(r) && (r.modules?.length ?? 0) < SHEET_LIMITS.modules,
  );
  return sortSheets(sheets).map((s) => ({ id: s.id, name: sheetName(s), modified: s.modified ?? null }));
}

/**
 * The flyout's sheets: `addableSheets`' first `max`.
 *
 * @returns {{ id: string, name: string }[]}
 */
export function addMenuSheets(records, max = ADD_MENU_SHEETS) {
  return addableSheets(records)
    .slice(0, max)
    .map(({ id, name }) => ({ id, name }));
}

/** Whether the flyout ends in "All sheets…": only when it can't list them all. */
export function needsAllSheets(sheets, max = ADD_MENU_SHEETS) {
  return (sheets?.length ?? 0) > max;
}

/**
 * The passage added to `current` (the sheet as read in the write's own
 * transaction), where a passage goes when nobody is working in the sheet
 * (`passageInsertIndex`: after its last passage, else under its reading
 * part). `planSheetChange`'s result, plus `again` when the same words were
 * already on it, which adds them again and says so (BA75).
 */
export function planAddToSheet(current, fields, ctx) {
  const again = current?.modules?.some((m) => m?.type === "passage" && samePassage(m, fields)) === true;
  if ((current?.modules?.length ?? 0) >= SHEET_LIMITS.modules) return { full: true };
  const plan = planSheetChange(current, (s) => addModule(s, makeModule("passage", fields), passageInsertIndex(s), ctx));
  return { ...plan, again };
}

/**
 * A run of passages (a search's or topic's, gathered) added to `current` as
 * the editor would add them: over the sheet in today's canonical form
 * (`planSheetChange`), each where `passageInsertIndex` puts it, so the run
 * lands after the sheet's last passage, in order, or under its reading part
 * (SH8-3). Returns `planSheetChange`'s result.
 *
 * @param {object} current the sheet as read in the write's own transaction
 * @param {object[]} passages passage fields, in the order to add them
 */
export function planAddPassages(current, passages, ctx) {
  return planSheetChange(current, (s) => {
    let next = s;
    for (const fields of passages ?? []) next = addModule(next, makeModule("passage", fields), passageInsertIndex(next), ctx);
    return next;
  });
}

/**
 * "New sheet…": a blank sheet holding the passage alone, with the title the
 * reader gave it in the name window (E172, as "New collection…" asks for a
 * name), which starts as the passage's reference; a blank title falls back to
 * that reference, so the sheet can be found in a list.
 */
export function newSheetWithPassage(fields, ctx, title = "") {
  const named = String(title ?? "").trim().slice(0, SHEET_LIMITS.title);
  return createSheet({ title: named || passageReference(fields), template: "blank", modules: [makeModule("passage", fields)] }, ctx);
}

/**
 * What the undo bar says once a passage is added, to a sheet already kept or
 * one just made (E172: the reader named it, so it says what "New collection…"
 * says).
 */
export function addedMessage(fields, name, { again = false } = {}) {
  const ref = passageReference(fields);
  return again ? `${ref} added to “${name}” again; it was already there.` : `${ref} added to “${name}.”`;
}
