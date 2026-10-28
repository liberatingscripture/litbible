// src/lib/desk-sheets.mjs
//
// Making and changing a sheet (STUDY-DESK-FORMAT.md, "Sheets (kind 9)"): the
// operations the sheet pane will call, with no UI of their own. A sheet is one
// record, so each operation returns the whole sheet, changed through
// editRecord (the one place `modified` moves, principle 4), and the caller
// saves it with planSave like any other record. Pure: no DOM, no storage, and
// no clock or randomness unless the caller leaves `now` or an id out.
//
// Three rules the operations keep:
//   - An operation that changes nothing returns the sheet it was given, the
//     very same object, so the caller can tell and `modified` doesn't move
//     for a change nobody made.
//   - A module of a type this code doesn't know is kept where it is, whole
//     (principle 6): it can be moved and removed, never edited, and a sheet
//     of a newer sheet format can't be changed at all (canEdit).
//   - Formatted text is sanitized here as it is saved (sanitizeSheetHtml),
//     so what reaches the store is already in the canonical form.

import { canEdit, createRecord, editRecord } from "./desk-records.mjs";
import { MODULE_TYPES, SHEET_FORMAT, SHEET_LIMITS, sanitizeSheetHtml } from "./desk-sheet-format.mjs";
import { planSave } from "./desk-store-core.mjs";

/** The fields a new module of each type starts with (besides its `id` and `type`). */
const DEFAULTS = {
  passage: () => ({ blanks: [], footnotes: [] }),
  text: () => ({ html: "" }),
  question: () => ({ html: "", answer: "", lines: 0 }),
  space: () => ({ lines: 4 }),
  keyTerms: () => ({ omit: [] }),
  pageBreak: () => ({}),
};

/** The formatted-text fields of a module, which are sanitized whenever they are set. */
const FORMATTED = ["html", "answer"];

function sanitizeFields(fields) {
  const out = { ...fields };
  for (const f of FORMATTED) if (typeof out[f] === "string") out[f] = sanitizeSheetHtml(out[f]);
  return out;
}

function newId() {
  return globalThis.crypto.randomUUID();
}

/** Whether two JSON values are the same. */
function same(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => same(x, b[i]));
  const keys = (o) => Object.keys(o).filter((k) => o[k] !== undefined);
  const ka = keys(a);
  return ka.length === keys(b).length && ka.every((k) => Object.hasOwn(b, k) && same(a[k], b[k]));
}

/**
 * A new module. `fields` fill in or replace the type's defaults; `id` and
 * `type` are not among them.
 *
 * @param {string} type one of MODULE_TYPES
 * @param {object} [fields]
 * @param {{ id?: string }} [opts]
 */
export function makeModule(type, fields = {}, { id } = {}) {
  if (!MODULE_TYPES.includes(type)) throw new Error(`desk-sheets: unknown module type "${type}"`);
  for (const f of ["id", "type"]) {
    if (f in fields) throw new Error(`desk-sheets: "${f}" is set by makeModule, not passed in`);
  }
  return { id: id ?? newId(), type, ...sanitizeFields({ ...DEFAULTS[type](), ...fields }) };
}

/**
 * A new sheet. `template` is a record of where it came from; a blank one
 * starts with one empty text module, any other with the modules it is given
 * (none, if none).
 *
 * @param {{ title?: string, subtitle?: string, template?: string, commercial?: boolean, modules?: object[] }} fields
 * @param {{ now?: string, client: string, contentVersion: string, id?: string }} ctx
 */
export function createSheet({ title = "", subtitle = "", template = "blank", commercial = false, modules } = {}, ctx) {
  return createRecord(
    "sheet",
    {
      sheetFormat: SHEET_FORMAT,
      title,
      subtitle,
      template,
      commercial,
      modules: modules ?? (template === "blank" ? [makeModule("text")] : []),
    },
    ctx,
  );
}

/* ── Changing a sheet ────────────────────────────────────────────────── */

function mustEdit(sheet) {
  if (sheet?.kind !== "sheet") throw new Error("desk-sheets: not a sheet");
  if (!canEdit(sheet)) throw new Error(`desk-sheets: sheet ${sheet.id} can't be edited here (sheet format ${sheet.sheetFormat})`);
  if (!Array.isArray(sheet.modules)) throw new Error(`desk-sheets: sheet ${sheet.id} has no list of modules`);
}

function indexOfModule(sheet, moduleId) {
  const at = sheet.modules.findIndex((m) => m?.id === moduleId);
  if (at < 0) throw new Error(`desk-sheets: the sheet has no module "${moduleId}"`);
  return at;
}

function withModules(sheet, modules, ctx) {
  return editRecord(sheet, { modules }, ctx);
}

/**
 * The sheet with `module` inserted at `index` (the end by default; clamped).
 * Refuses a second key terms module, a 301st module, and an id already used.
 */
export function addModule(sheet, module, index = sheet?.modules?.length, ctx) {
  mustEdit(sheet);
  if (!module || typeof module.id !== "string" || !module.id || typeof module.type !== "string" || !module.type) {
    throw new Error("desk-sheets: a module needs an id and a type");
  }
  if (sheet.modules.some((m) => m?.id === module.id)) throw new Error(`desk-sheets: the sheet already has a module "${module.id}"`);
  if (sheet.modules.length >= SHEET_LIMITS.modules) throw new Error(`desk-sheets: a sheet holds at most ${SHEET_LIMITS.modules} modules`);
  if (module.type === "keyTerms" && sheet.modules.some((m) => m?.type === "keyTerms")) {
    throw new Error("desk-sheets: a sheet has at most one key terms module");
  }
  const at = Math.min(Math.max(Number.isInteger(index) ? index : sheet.modules.length, 0), sheet.modules.length);
  const modules = [...sheet.modules];
  modules.splice(at, 0, module);
  return withModules(sheet, modules, ctx);
}

/**
 * The sheet with a module moved so it sits at `toIndex` in the result
 * (clamped). The sheet itself when that is where it already is.
 */
export function moveModule(sheet, moduleId, toIndex, ctx) {
  mustEdit(sheet);
  if (!Number.isInteger(toIndex)) throw new Error("desk-sheets: moveModule needs a whole-number position");
  const from = indexOfModule(sheet, moduleId);
  const to = Math.min(Math.max(toIndex, 0), sheet.modules.length - 1);
  if (to === from) return sheet;
  const modules = [...sheet.modules];
  const [moved] = modules.splice(from, 1);
  modules.splice(to, 0, moved);
  return withModules(sheet, modules, ctx);
}

/** The sheet without one module. */
export function removeModule(sheet, moduleId, ctx) {
  mustEdit(sheet);
  const at = indexOfModule(sheet, moduleId);
  return withModules(sheet, sheet.modules.filter((_, i) => i !== at), ctx);
}

/**
 * The sheet with `changes` merged, field by field, into one module. A module
 * of a type this code doesn't know can't be changed, and neither `id` nor
 * `type` can. The sheet itself when nothing differs afterwards.
 */
export function updateModule(sheet, moduleId, changes, ctx) {
  mustEdit(sheet);
  const at = indexOfModule(sheet, moduleId);
  const old = sheet.modules[at];
  if (!MODULE_TYPES.includes(old.type)) {
    throw new Error(`desk-sheets: module "${moduleId}" is of a type this version doesn't know ("${old.type}")`);
  }
  for (const f of ["id", "type"]) {
    if (f in changes) throw new Error(`desk-sheets: a module's "${f}" can't change`);
  }
  const next = { ...old, ...sanitizeFields(changes) };
  if (same(next, old)) return sheet;
  return withModules(sheet, sheet.modules.map((m, i) => (i === at ? next : m)), ctx);
}

const SHEET_FIELDS = ["title", "subtitle", "commercial"];

/** The sheet with a new title, subtitle or commercial setting; the sheet itself when none differs. */
export function setSheetFields(sheet, changes, ctx) {
  mustEdit(sheet);
  for (const f of Object.keys(changes)) {
    if (!SHEET_FIELDS.includes(f)) throw new Error(`desk-sheets: "${f}" isn't a field to set here (${SHEET_FIELDS.join(", ")})`);
  }
  if (Object.keys(changes).every((f) => same(changes[f], sheet[f]))) return sheet;
  return editRecord(sheet, changes, ctx);
}

/**
 * Plan one change to a sheet over the record the notebook holds now
 * (`current`, read in the same transaction as the write), never over a copy
 * read earlier, so a save another tab made to the sheet's other parts
 * survives (BA129). `op` is one of the operations above, given the sheet.
 *
 * - `{ gone: true }`: there is no sheet here to change (deleted meanwhile, or
 *   in a format this code can't edit), so nothing is written.
 * - `{ refused: error }`: the operation refused the change (a 301st part, say).
 * - `{ sheet: current, changed: false }`: it changed nothing.
 * - `{ sheet: next, changed: true, put: [next], remove: [] }`: the plan.
 *
 * Throws as planSave does when the changed sheet can't be saved (over its
 * 512 KB, BA128), so the caller's transaction writes nothing.
 */
export function planSheetChange(current, op) {
  if (current?.kind !== "sheet" || !canEdit(current)) return { gone: true };
  let next;
  try {
    next = op(current);
  } catch (refused) {
    return { refused };
  }
  if (next === current) return { sheet: current, changed: false };
  return { sheet: next, changed: true, ...planSave(next) };
}

/** Whether an error is the size limit refusing a sheet ("a sheet is at most 512 KB"). */
export function sheetTooBig(error) {
  return String(error?.message ?? "").includes(`a sheet is at most ${SHEET_LIMITS.bytes / 1024} KB`);
}
