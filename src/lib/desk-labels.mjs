// src/lib/desk-labels.mjs
//
// The reader's labels (STUDY-DESK.md, M8; STUDY-DESK-FORMAT.md kind 8
// `label`): a name, and every record's `labels` field listing the ids of the
// labels on it. Readers meet them as "Labels" (the site's topics may be
// renamed tags; that is recommended, not decided). Pure: no storage, no DOM.
//
// Each function returns a write plan, { put, remove }, for store.commit, so a
// change that touches several records (a new label that goes straight onto a
// record, deleting a label that is on forty notes) is one transaction and one
// entry in the undo history.
//
// Two rules:
//   - A name is unique without regard to case or accents ("Prayer" and
//     "prayer" and "práyer" are one label), after trimming and collapsing
//     spaces. What the reader typed is kept as written.
//   - A label id on a record whose label record is missing (deleted on
//     another device, or not synced yet) is ignored when showing the record,
//     and never stripped on its own (principle 6): the label may arrive.
//     Deleting a label on purpose does strip its id, in the same plan, so the
//     undo of that one step brings every record's label back.

import { canEdit, createRecord, editRecord } from "./desk-records.mjs";
import { planDelete } from "./desk-store-core.mjs";

/** A name as it is kept: trimmed, runs of whitespace collapsed, NFC. */
export function normalizeLabelName(name) {
  return String(name ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
}

/** What two names are compared by: no case, no accents. */
export function labelKey(name) {
  return normalizeLabelName(name)
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase();
}

export const sameLabelName = (a, b) => labelKey(a) === labelKey(b);

/** The live label records, by name. */
export function liveLabels(records) {
  return records
    .filter((r) => r?.kind === "label" && typeof r.name === "string" && r.name)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || (a.id < b.id ? -1 : 1));
}

/** The label with this name (compared as above), or null. `exceptId` skips one label. */
export function findLabel(records, name, exceptId = null) {
  const key = labelKey(name);
  if (!key) return null;
  return liveLabels(records).find((l) => l.id !== exceptId && labelKey(l.name) === key) ?? null;
}

/** id to label record, for showing. */
export function labelMap(records) {
  return new Map(liveLabels(records).map((l) => [l.id, l]));
}

/**
 * The labels to show on a record: its label ids that have a label record, in
 * the order of the record's list. Ids with no label record are left out.
 */
export function labelsOf(record, labels) {
  const map = labels instanceof Map ? labels : labelMap(labels);
  return (record?.labels ?? []).map((id) => map.get(id)).filter(Boolean);
}

/** How many live records (not labels, not trash) carry each label id. */
export function labelCounts(records) {
  const counts = new Map();
  for (const r of records) {
    if (!r || r.kind === "trash" || r.kind === "label") continue;
    for (const id of new Set(r.labels ?? [])) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

const fail = (reason, extra = {}) => ({ ok: false, reason, ...extra });

/**
 * Make a label.
 * @returns {{ ok: true, plan, label } | { ok: false, reason: "empty" | "duplicate", existing? }}
 */
export function planCreateLabel(records, name, ctx) {
  const clean = normalizeLabelName(name);
  if (!clean) return fail("empty");
  const existing = findLabel(records, clean);
  if (existing) return fail("duplicate", { existing });
  const label = createRecord("label", { name: clean }, ctx);
  return { ok: true, plan: { put: [label], remove: [] }, label };
}

/** Rename a label. A new name that is the label's own, in other case, is allowed. */
export function planRenameLabel(records, id, name, ctx) {
  const label = records.find((r) => r?.kind === "label" && r.id === id);
  if (!label) return fail("missing");
  const clean = normalizeLabelName(name);
  if (!clean) return fail("empty");
  const existing = findLabel(records, clean, id);
  if (existing) return fail("duplicate", { existing });
  if (!canEdit(label)) return fail("readonly");
  if (label.name === clean) return { ok: true, plan: { put: [], remove: [] }, label };
  const next = editRecord(label, { name: clean }, ctx);
  return { ok: true, plan: { put: [next], remove: [] }, label: next };
}

/**
 * Put a label on a record, or take it off. Nothing to write when the record
 * is already as asked. A record this code can't edit (an unknown kind, a newer
 * schema) is refused.
 */
export function planSetLabel(record, labelId, on, ctx) {
  if (!record || typeof record.id !== "string") return fail("missing");
  if (!canEdit(record)) return fail("readonly");
  const have = record.labels ?? [];
  if (have.includes(labelId) === Boolean(on)) return { ok: true, plan: { put: [], remove: [] }, record };
  const labels = on ? [...have, labelId] : have.filter((id) => id !== labelId);
  const next = editRecord(record, { labels }, ctx);
  return { ok: true, plan: { put: [next], remove: [] }, record: next };
}

/**
 * Make a label and put it on a record, in one plan (the "New label" field on a
 * row). A name that already exists takes that label instead of making a second.
 */
export function planNewLabelOn(records, record, name, ctx) {
  const clean = normalizeLabelName(name);
  if (!clean) return fail("empty");
  const existing = findLabel(records, clean);
  const made = existing ? null : planCreateLabel(records, clean, ctx);
  const label = existing ?? made.label;
  const applied = planSetLabel(record, label.id, true, ctx);
  if (!applied.ok) return applied;
  return {
    ok: true,
    plan: { put: [...(made?.plan.put ?? []), ...applied.plan.put], remove: [] },
    label,
    record: applied.record,
  };
}

/**
 * Delete a label: its trash record goes in and the label comes out, and every
 * record carrying its id has the id removed, all in one plan. Records this
 * code can't edit keep the id (it points at nothing, which is harmless) and
 * are counted in `untouched`.
 */
export function planDeleteLabel(records, id, ctx) {
  const label = records.find((r) => r?.kind === "label" && r.id === id);
  if (!label) return fail("missing");
  const trash = planDelete(label, ctx);
  const put = [trash.trash];
  let untouched = 0;
  let stripped = 0;
  for (const r of records) {
    if (!r || r.kind === "trash" || r.id === id || !(r.labels ?? []).includes(id)) continue;
    if (!canEdit(r)) {
      untouched++;
      continue;
    }
    put.push(editRecord(r, { labels: r.labels.filter((x) => x !== id) }, ctx));
    stripped++;
  }
  return { ok: true, plan: { put, remove: [id] }, trash: trash.trash, stripped, untouched };
}
