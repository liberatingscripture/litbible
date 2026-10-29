// src/lib/desk-ribbon-change.mjs
//
// What renaming, moving and making a ribbon decide, as plans over the records
// the notebook holds *now* (STUDY-DESK-AUDIT-1.md BA102). Each function takes
// the `{ get, all }` that `store.change` hands its builder, so the read and
// the write are one transaction: a ribbon another tab (or a /desk pane)
// deleted meanwhile is reported as gone and nothing is written, instead of
// the reader's stale copy coming back beside its own trash record, and the
// name and the limit are checked against what the notebook holds at the
// write, not what the form saw when it opened.
//
// Pure: no DOM, no store of its own. Every function resolves to
// `{ plan, problem, record }`: `plan` is what to write (null for nothing),
// `problem` a plain sentence for the reader when the change was refused, and
// `record` the ribbon as it will be (or, when nothing needed writing, as it is).

import { createRecord, editRecord } from "./desk-records.mjs";
import { canAddRibbon, cleanRibbonName, isRibbon, ribbonNameProblem, ribbonsOf } from "./desk-places.mjs";
import { planSave } from "./desk-store-core.mjs";

/** Said when the ribbon being changed is no longer in the notebook. */
export const RIBBON_GONE = "That ribbon has been deleted.";

/** Said when the notebook filled up with ribbons while a new one was being named. */
export const RIBBON_LIMIT_REACHED = "You already have six ribbons. Move one of them here instead.";

const refused = (problem) => ({ plan: null, problem, record: null });

/** The ribbon `id` as the notebook holds it now, or null when it is gone, in the trash, or not a ribbon. */
async function liveRibbon(get, id) {
  const current = await get(id);
  return current && current.kind !== "trash" && isRibbon(current) ? current : null;
}

/**
 * Rename a ribbon. Refused when it is gone, or when the name is empty or
 * another ribbon (as the notebook holds them now) already has it. The same
 * name over itself writes nothing and is not a problem.
 */
export async function planRibbonRename({ get, all }, id, rawName, stamp) {
  const current = await liveRibbon(get, id);
  if (!current) return refused(RIBBON_GONE);
  const problem = ribbonNameProblem(rawName, ribbonsOf(await all()), id);
  if (problem) return refused(problem);
  const name = cleanRibbonName(rawName);
  if (current.name === name) return { plan: null, problem: null, record: current };
  const record = editRecord(current, { name }, stamp);
  return { plan: planSave(record), problem: null, record };
}

/**
 * Move a ribbon to `place` ({ bookKey, chapter, verse, endVerse }). Refused
 * when it is gone; writes nothing when it is already there.
 */
export async function planRibbonMove({ get }, id, place, stamp) {
  const current = await liveRibbon(get, id);
  if (!current) return refused(RIBBON_GONE);
  const there =
    current.bookKey === place.bookKey &&
    current.chapter === place.chapter &&
    current.verse === place.verse &&
    (current.endVerse ?? current.verse) === (place.endVerse ?? place.verse);
  if (there) return { plan: null, problem: null, record: current };
  const record = editRecord(current, place, stamp);
  return { plan: planSave(record), problem: null, record };
}

/**
 * Make a new ribbon at `place`. Refused when the name is empty or taken, or
 * when the notebook already holds as many ribbons as it keeps, both checked
 * against the records as they are now.
 *
 * @param {{ now?: string, client?: string, contentVersion?: string }} stamp
 */
export async function planRibbonCreate({ all }, rawName, place, stamp) {
  const ribbons = ribbonsOf(await all());
  const problem = ribbonNameProblem(rawName, ribbons);
  if (problem) return refused(problem);
  if (!canAddRibbon(ribbons)) return refused(RIBBON_LIMIT_REACHED);
  const record = createRecord("place", { name: cleanRibbonName(rawName), ribbon: true, ...place }, stamp);
  return { plan: planSave(record), problem: null, record };
}
