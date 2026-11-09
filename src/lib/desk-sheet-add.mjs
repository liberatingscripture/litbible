// src/lib/desk-sheet-add.mjs
//
// "Add to sheet ▸" on a chapter page (STUDY-DESK.md, S12, part 2, way 3; BVJ,
// 2026-11-08, decision 3): the verse menu and the selection panel list the
// reader's sheets, newest change first, and "New sheet". Picking one adds the
// passage without leaving the page. Pure: the page reads the notebook and
// writes the plan in one `store.change`, as every change to a sheet is
// written (BA129).

import { canEdit } from "./desk-records.mjs";
import { SHEET_LIMITS } from "./desk-sheet-format.mjs";
import { passageInsertIndex, passageReference, samePassage, sheetName, sortSheets } from "./desk-sheet-passages.mjs";
import { addModule, createSheet, isOwnTemplate, makeModule, planSheetChange } from "./desk-sheets.mjs";

/** How many sheets the flyout lists; the rest are on /sheets and /desk. */
export const ADD_MENU_SHEETS = 5;

/**
 * The flyout's sheets: the reader's own that can take a passage (no
 * templates, none a newer format made, none already full), newest change
 * first, at most `max`.
 *
 * @returns {{ id: string, name: string }[]}
 */
export function addMenuSheets(records, max = ADD_MENU_SHEETS) {
  const sheets = (records ?? []).filter(
    (r) => r?.kind === "sheet" && !isOwnTemplate(r) && canEdit(r) && (r.modules?.length ?? 0) < SHEET_LIMITS.modules,
  );
  return sortSheets(sheets)
    .slice(0, max)
    .map((s) => ({ id: s.id, name: sheetName(s) }));
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
 * "New sheet": a blank sheet holding the passage alone, named after it, so
 * the leader can find it in their list and rename it there.
 */
export function newSheetWithPassage(fields, ctx) {
  return createSheet({ title: passageReference(fields), template: "blank", modules: [makeModule("passage", fields)] }, ctx);
}

/** What the undo bar says once a passage is added. */
export function addedMessage(fields, name, { made = false, again = false } = {}) {
  const ref = passageReference(fields);
  if (made) return `${ref} is on a new sheet, “${name}.”`;
  return again ? `${ref} added to “${name}” again; it was already there.` : `${ref} added to “${name}.”`;
}
