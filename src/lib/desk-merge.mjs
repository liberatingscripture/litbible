// src/lib/desk-merge.mjs
//
// Merging two copies of a reader's notebook (STUDY-DESK-FORMAT.md, "Clocks"
// and kind 10 `trash`; STUDY-DESK.md, "When notes collide: rules a to e").
// Phase 1's import of an export file uses it, and phase 4's sync is the same
// function with a service on the other side. Pure: no storage, no DOM, and no
// clock of its own unless the caller leaves `now` out. NOTHING CALLS IT YET;
// phase 1d's import will.
//
// The rules, in the order they apply. a to c are BDR's answers of 2026-10-09,
// settled with the apps; the collapse rule (6) is the website's proposal of
// 2026-10-12, for BDR to confirm, and the apps should not implement it until
// they have.
//
//   a. The newer writing wins, for every kind, notes included. Two records
//      with one `id`: the later `modified` wins and the older is discarded
//      (BVJ, going with BDR: no conflict copy). Times compare as instants, not
//      as strings, since fractional digits and offsets can differ. An exact
//      tie goes to the optional `tiebreak` (a sync service passes its revision
//      order); with none, the LOCAL copy stays and nothing is written.
//   clamp. A record arriving from the other side whose `modified` (or, for a
//      trash record, `deletedAt`) is later than `now` is treated as `now`, and
//      the copy written carries the clamped value. One device's clock claiming
//      the future must not win every later argument. Local records are never
//      clamped: they are the reader's own.
//   b. Deleted on one side, edited on the other: a live record X against a
//      trash record whose `deletedId` is X, from either side. The later action
//      wins: if the live record's `modified` is later than the trash record's
//      `deletedAt`, the record lives and the trash record goes. Earlier or
//      EQUAL, the deletion stands. (An undo restamps `modified`, which is why
//      an undo outlasts the deletion it undoes: restoreFromTrash.) When the
//      deletion stands over a copy newer than the one the trash record holds
//      (edited on one device, deleted later on another that hadn't seen the
//      edit), the trash record takes the newer copy, so an undo or a restore
//      from the trash brings back the reader's last words. Same principle as
//      rule 6's "newer content", and the same proposal (2026-10-12).
//   c. 30 days in the trash, then a tombstone kept forever, so a stale backup
//      can't revive a deleted record. A tombstone keeps `deletedAt`, which is
//      all rule b compares, so it blocks a stale live record exactly as the
//      full trash record did. After merging, emptyTrashRecord runs on every
//      surviving trash record, local ones too.
//   6. Two trash records for one deletion (same `deletedId`, different ids:
//      two devices each deleted it) collapse to ONE, so the notebook doesn't
//      carry a duplicate forever. The survivor is the one with the later
//      `deletedAt` (a tie: the lower `id`, by plain string comparison), so
//      every client keeps the same id and the copies converge. That makes its
//      `deletedAt` the later deletion, which is rule b's "later action wins":
//      an edit made between the two deletions does not bring the record back.
//      Its `record` and `deletedKind` come from whichever trash record holds
//      the NEWER content, judged by the held record's `modified` (rule a); if
//      only one still holds content, that one; if neither, none; on a tie, the
//      survivor's own. Its `modified` is the later of the two.
//   7. Principle 6, keep what you don't understand. A record of an unknown
//      kind, from a newer schema, or with fields this code doesn't know merges
//      by the same id and `modified` rules and is written back exactly as it
//      arrived. Nothing kind-specific is read or validated here. The one
//      change to an arriving record is migrateRecord, which returns it as it
//      was unless something needed filling in.
//   8. Highlights are NOT re-run through the overlap rule (desk-highlights.mjs).
//      Each client applies that only when the reader makes or removes a
//      highlight, so a merge never trims or joins one.
//   9. A malformed arriving record (no string `id`, no `kind`, an unparsable
//      `modified`, or a trash record without a `deletedId` or with an
//      unparsable `deletedAt`) is skipped and reported, never written. The
//      local side is trusted to be what the store holds: its records are only
//      read, leniently (a local time that won't parse loses to anything).
//      Several records with one id inside one input are merged among
//      themselves first, by the same rules (an exact tie there takes the
//      smaller JSON text, so the order of the input never matters).
//
// The result doesn't depend on the order of either input, merging the same
// incoming twice writes nothing the second time, and merging A into B and B
// into A end with the same records, apart from the places the rules name as
// one-sided: the local copy staying on an exact tie, clamping, and skipping.

import { emptyTrashRecord, migrateRecord } from "./desk-records.mjs";

/* ── Times ───────────────────────────────────────────────────────────── */

/** A time as milliseconds, or -Infinity when it is missing or won't parse. */
function instant(t) {
  const n = typeof t === "string" ? Date.parse(t) : NaN;
  return Number.isNaN(n) ? -Infinity : n;
}

function parses(t) {
  return typeof t === "string" && !Number.isNaN(Date.parse(t));
}

/* ── Comparing records ───────────────────────────────────────────────── */

/** JSON with every object's keys sorted: equal records give equal text. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .filter((k) => value[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

const sameRecord = (a, b) => canonical(a) === canonical(b);

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/* ── Checking what arrives (rule 9) ──────────────────────────────────── */

/** Why an arriving record can't be merged, as a plain sentence; null if it can. */
function problemWith(r) {
  if (!r || typeof r !== "object" || Array.isArray(r)) return "It is not a record.";
  if (typeof r.id !== "string" || !r.id) return "It has no id.";
  if (typeof r.kind !== "string" || !r.kind) return "It has no kind.";
  if (!parses(r.modified)) return "Its modified time is missing or is not a time.";
  if (r.kind === "trash") {
    if (typeof r.deletedId !== "string" || !r.deletedId) return "It is a trash record that doesn't say which record it deleted.";
    if (!parses(r.deletedAt)) return "It is a trash record whose deletion time is missing or is not a time.";
  }
  return null;
}

/** The record with its times no later than `now` (the same object if they are). */
function clamped(r, now, nowMs) {
  let out = r;
  if (instant(out.modified) > nowMs) out = { ...out, modified: now };
  if (out.kind === "trash" && instant(out.deletedAt) > nowMs) out = { ...out, deletedAt: now };
  return out;
}

/* ── Rule a ──────────────────────────────────────────────────────────── */

/** Two copies of one id from the same input: later wins, a tie the smaller JSON. */
function pickWithin(x, y) {
  const dx = instant(x.modified);
  const dy = instant(y.modified);
  if (dx !== dy) return dx > dy ? x : y;
  return canonical(x) <= canonical(y) ? x : y;
}

/** A local and an arriving copy of one id: later wins; a tie, `tiebreak`, else local. */
function pickAcross(local, incoming, tiebreak) {
  const dl = instant(local.modified);
  const di = instant(incoming.modified);
  if (dl > di) return local;
  if (di > dl) return incoming;
  const t = tiebreak ? tiebreak(local, incoming) : 0;
  return t < 0 ? incoming : local;
}

function dedupe(records, pick) {
  const out = new Map();
  for (const r of records) {
    const seen = out.get(r.id);
    out.set(r.id, seen ? pick(seen, r) : r);
  }
  return out;
}

/* ── Rule 6 ──────────────────────────────────────────────────────────── */

const holds = (t) => t.record != null && typeof t.record === "object";

/** Several trash records for one deletion, as the one that survives. */
function collapseTrash(group) {
  if (group.length === 1) return group[0];
  // The later deletion; a tie, the lower id. A total order, so it can't depend on arrival.
  const survivor = [...group].sort((a, b) => instant(b.deletedAt) - instant(a.deletedAt) || byId(a, b))[0];
  // The newest content among those that still hold any; a tie, the survivor's own, then the lower id.
  const donor = group
    .filter(holds)
    .sort(
      (a, b) =>
        instant(b.record.modified) - instant(a.record.modified) ||
        (a === survivor ? -1 : b === survivor ? 1 : 0) ||
        byId(a, b),
    )[0];
  const modified = group.reduce((m, t) => (instant(t.modified) > instant(m) ? t.modified : m), survivor.modified);
  const out = { ...survivor, modified };
  if (donor && donor !== survivor) {
    out.record = donor.record;
    if (donor.deletedKind != null) out.deletedKind = donor.deletedKind;
  }
  return out;
}

/* ── The merge ───────────────────────────────────────────────────────── */

function checkNow(now) {
  const at = now ?? new Date().toISOString();
  if (!parses(at)) throw new Error(`desk-merge: "${now}" is not a time`);
  return at;
}

/** Everything both public functions need: the merged records and what was skipped. */
function combine(local, incoming, { now, tiebreak } = {}) {
  const at = checkNow(now);
  const nowMs = Date.parse(at);

  const skipped = [];
  const arriving = [];
  for (const raw of incoming ?? []) {
    const why = problemWith(raw);
    if (why) skipped.push({ record: raw, reason: why });
    else arriving.push(clamped(migrateRecord(raw), at, nowMs));
  }

  const mine = dedupe(
    (local ?? []).filter((r) => typeof r?.id === "string" && r.id),
    pickWithin,
  );
  const theirs = dedupe(arriving, pickWithin);

  const merged = new Map(mine);
  for (const [id, r] of theirs) {
    merged.set(id, mine.has(id) ? pickAcross(mine.get(id), r, tiebreak) : r);
  }

  // Rule 6: one trash record per deleted id.
  const trashFor = new Map();
  for (const r of merged.values()) {
    if (r.kind === "trash" && typeof r.deletedId === "string" && r.deletedId) {
      if (!trashFor.has(r.deletedId)) trashFor.set(r.deletedId, []);
      trashFor.get(r.deletedId).push(r);
    }
  }
  for (const [deletedId, group] of trashFor) {
    for (const t of group) merged.delete(t.id);
    const survivor = collapseTrash(group);
    merged.set(survivor.id, survivor);

    // Rules b and c: the later action wins, and equal times mean the deletion stands.
    const live = merged.get(deletedId);
    if (live && live.kind !== "trash") {
      if (instant(live.modified) > instant(survivor.deletedAt)) merged.delete(survivor.id);
      else {
        merged.delete(deletedId);
        if (!holds(survivor) || instant(live.modified) > instant(survivor.record.modified)) {
          merged.set(survivor.id, { ...survivor, record: live, deletedKind: live.kind });
        }
      }
    }
  }

  // Rule c: what has waited its 30 days keeps only its tombstone.
  for (const [id, r] of merged) {
    if (r.kind === "trash") merged.set(id, emptyTrashRecord(r, at));
  }

  return { records: [...merged.values()].sort(byId), skipped };
}

/**
 * Merge two copies of the notebook into one.
 *
 * @param {object[]} a the local records
 * @param {object[]} b the arriving records (the side that is clamped and checked)
 * @param {{ now?: string, tiebreak?: (local: object, incoming: object) => number }} [opts]
 *   `tiebreak` decides an exact tie in `modified`, as a comparator on which copy
 *   is newer: positive when the local copy is, negative when the incoming one
 *   is, 0 (or absent) to leave the local copy.
 * @returns {object[]} the merged records, sorted by id
 */
export function mergeSets(a, b, opts) {
  return combine(a, b, opts).records;
}

/**
 * The write plan that turns the local records into the merged set, in the
 * shape desk-store-core's planWrite takes.
 *
 * @param {object[]} local what the store holds now
 * @param {object[]} incoming an export file's records, or a sync's
 * @param {{ now?: string, tiebreak?: (local: object, incoming: object) => number }} [opts]
 * @returns {{ put: object[], remove: string[], skipped: { record: unknown, reason: string }[] }}
 *   `put` holds only records that are new or changed; `remove` the local ids
 *   that went (a deleted record, or a trash record that collapsed or was
 *   cleared by an edit); `skipped` the arriving records that couldn't be merged.
 */
export function mergeRecords(local, incoming, opts) {
  const { records, skipped } = combine(local, incoming, opts);
  const before = new Map();
  for (const r of local ?? []) if (typeof r?.id === "string" && r.id) before.set(r.id, r);
  const put = records.filter((r) => !before.has(r.id) || !sameRecord(before.get(r.id), r));
  const kept = new Set(records.map((r) => r.id));
  const remove = [...before.keys()].filter((id) => !kept.has(id)).sort();
  return { put, remove, skipped };
}
