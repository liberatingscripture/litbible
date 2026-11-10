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
//   - Two label records with one name (made on two devices before they met)
//     are one label (BVJ, 2026-11-10, Audit 8 decision 3). Nothing is
//     rewritten at merge: every record keeps the id it was given, and the
//     labels are joined where they are read. The joined label takes the id
//     of the oldest record and the name as last written, so every device
//     shows the same thing from the same records. Renaming or deleting it
//     renames or deletes every record in it, and taking it off an item takes
//     off every id of it.
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

/** A name that reads as nothing: empty, or only marks and invisible format characters (GF8c-9). */
export function readsAsNothing(name) {
  return labelKey(name).replace(/[\p{Cf}\s]/gu, "") === "";
}

/** Older first: by `created`, then by id, so every device picks the same one. */
const older = (a, b) =>
  (String(a.created ?? "") < String(b.created ?? "") ? -1 : String(a.created ?? "") > String(b.created ?? "") ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
/** Written later first: by `modified`, then by id. */
const later = (a, b) =>
  (String(a.modified ?? "") > String(b.modified ?? "") ? -1 : String(a.modified ?? "") < String(b.modified ?? "") ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * The live label records grouped by name (`labelKey`): for each name, the
 * label as shown (`label`: the oldest record, carrying the name as last
 * written) and every record's id (`ids`, the shown one first).
 * @returns {Map<string, { label: object, ids: string[] }>}
 */
export function labelGroups(records) {
  const byKey = new Map();
  for (const r of records) {
    if (r?.kind !== "label" || typeof r.name !== "string" || !r.name || typeof r.id !== "string") continue;
    const key = labelKey(r.name);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(r);
  }
  const groups = new Map();
  for (const [key, members] of byKey) {
    const first = [...members].sort(older)[0];
    const name = [...members].sort(later)[0].name;
    const label = name === first.name ? first : { ...first, name };
    groups.set(key, { label, ids: [first.id, ...members.filter((m) => m !== first).sort(older).map((m) => m.id)] });
  }
  return groups;
}

/** The labels to list, one per name (two records with one name show once), by name. */
export function liveLabels(records) {
  return sortedGroups(records).map((g) => g.label);
}

const byName = (a, b) => a.label.name.localeCompare(b.label.name, undefined, { sensitivity: "base" }) || (a.label.id < b.label.id ? -1 : 1);
const sortedGroups = (records) => [...labelGroups(records).values()].sort(byName);

/** The ids of every record in the label `id` belongs to (just `[id]` when it names no live label). */
export function labelIds(records, id) {
  for (const g of labelGroups(records).values()) if (g.ids.includes(id)) return [...g.ids];
  return [id];
}

/** The label with this name (compared as above), or null. `exceptId` skips the label that id belongs to. */
export function findLabel(records, name, exceptId = null) {
  const key = labelKey(name);
  if (!key) return null;
  const group = labelGroups(records).get(key);
  if (!group || (exceptId && group.ids.includes(exceptId))) return null;
  return group.label;
}

/** Every label record's id to the label as shown, for showing. */
export function labelMap(records) {
  const map = new Map();
  for (const g of sortedGroups(records)) for (const id of g.ids) map.set(id, g.label);
  return map;
}

/**
 * The labels to show on a record: its label ids that have a label record, in
 * the order of the record's list, each label once. Ids with no label record
 * are left out.
 */
export function labelsOf(record, labels) {
  const map = labels instanceof Map ? labels : labelMap(labels);
  const shown = new Map();
  for (const id of record?.labels ?? []) {
    const l = map.get(id);
    if (l && !shown.has(l.id)) shown.set(l.id, l);
  }
  return [...shown.values()];
}

/**
 * How many live records (not labels, not trash) carry each label, by the
 * label's shown id; an item with two ids of one label counts once. An id
 * that names no label is counted under itself.
 */
export function labelCounts(records) {
  const map = labelMap(records);
  const counts = new Map();
  for (const r of records) {
    if (!r || r.kind === "trash" || r.kind === "label") continue;
    for (const id of new Set((r.labels ?? []).map((x) => map.get(x)?.id ?? x))) counts.set(id, (counts.get(id) ?? 0) + 1);
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
  if (readsAsNothing(clean)) return fail("empty");
  const existing = findLabel(records, clean);
  if (existing) return fail("duplicate", { existing });
  const label = createRecord("label", { name: clean }, ctx);
  return { ok: true, plan: { put: [label], remove: [] }, label };
}

/**
 * Rename a label: every record of it (two with one name are one label), so the
 * name shown is the new one on every device. A new name that is the label's
 * own, in other case, is allowed.
 */
export function planRenameLabel(records, id, name, ctx) {
  const label = records.find((r) => r?.kind === "label" && r.id === id);
  if (!label) return fail("missing");
  const clean = normalizeLabelName(name);
  if (readsAsNothing(clean)) return fail("empty");
  const existing = findLabel(records, clean, id);
  if (existing) return fail("duplicate", { existing });
  const ids = labelIds(records, id);
  const members = records.filter((r) => r?.kind === "label" && ids.includes(r.id));
  if (!members.some(canEdit)) return fail("readonly");
  const put = members.filter((m) => canEdit(m) && m.name !== clean).map((m) => editRecord(m, { name: clean }, ctx));
  const shown = labelMap([...records.filter((r) => !put.some((p) => p.id === r?.id)), ...put]).get(id) ?? label;
  return { ok: true, plan: { put, remove: [] }, label: shown };
}

/**
 * Put a label on a record, or take it off. `ids` are every id of the label
 * (`labelIds`): one already there means it is on, and taking it off takes off
 * all of them. Nothing to write when the record is already as asked. A record
 * this code can't edit (an unknown kind, a newer schema) is refused.
 */
export function planSetLabel(record, labelId, on, ctx, ids = [labelId]) {
  if (!record || typeof record.id !== "string") return fail("missing");
  if (!canEdit(record)) return fail("readonly");
  const have = record.labels ?? [];
  const all = new Set([labelId, ...ids]);
  if (have.some((id) => all.has(id)) === Boolean(on)) return { ok: true, plan: { put: [], remove: [] }, record };
  const labels = on ? [...have, labelId] : have.filter((id) => !all.has(id));
  const next = editRecord(record, { labels }, ctx);
  return { ok: true, plan: { put: [next], remove: [] }, record: next };
}

/**
 * Make a label and put it on a record, in one plan (the "New label" field on a
 * row). A name that already exists takes that label instead of making a second.
 */
export function planNewLabelOn(records, record, name, ctx) {
  const clean = normalizeLabelName(name);
  if (readsAsNothing(clean)) return fail("empty");
  const existing = findLabel(records, clean);
  const made = existing ? null : planCreateLabel(records, clean, ctx);
  const label = existing ?? made.label;
  const applied = planSetLabel(record, label.id, true, ctx, existing ? labelIds(records, label.id) : [label.id]);
  if (!applied.ok) return applied;
  return {
    ok: true,
    plan: { put: [...(made?.plan.put ?? []), ...applied.plan.put], remove: [] },
    label,
    record: applied.record,
  };
}

/**
 * Delete a label: a trash record goes in for every record of it (two with one
 * name are one label) and they come out, and every record carrying one of
 * their ids has it removed, all in one plan. Records this code can't edit keep
 * the id (it points at nothing, which is harmless) and are counted in
 * `untouched`.
 */
export function planDeleteLabel(records, id, ctx) {
  const label = records.find((r) => r?.kind === "label" && r.id === id);
  if (!label) return fail("missing");
  const ids = new Set(labelIds(records, id));
  const members = records.filter((r) => r?.kind === "label" && ids.has(r.id));
  const trashes = members.map((m) => planDelete(m, ctx).trash);
  const put = [...trashes];
  let untouched = 0;
  let stripped = 0;
  for (const r of records) {
    if (!r || r.kind === "trash" || r.kind === "label" || !(r.labels ?? []).some((x) => ids.has(x))) continue;
    if (!canEdit(r)) {
      untouched++;
      continue;
    }
    put.push(editRecord(r, { labels: r.labels.filter((x) => !ids.has(x)) }, ctx));
    stripped++;
  }
  const trash = trashes[members.indexOf(label)];
  return { ok: true, plan: { put, remove: [...ids] }, trash, trashes, stripped, untouched };
}
