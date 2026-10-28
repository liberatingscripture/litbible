// src/lib/desk-merge.mjs
//
// Merging two copies of a reader's notebook (STUDY-DESK-FORMAT.md, "Clocks"
// and kind 10 `trash`; STUDY-DESK.md, "When notes collide: rules a to e").
// Opening an export file uses it (src/lib/desk-export.mjs, "Open this copy"),
// and phase 4's sync would be the same function with a service on the other
// side. Pure: no storage, no DOM, and no clock of its own unless the caller
// leaves `now` out.
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
//      trash record, `deletedAt`, or the `modified` of the copy it holds) is
//      later than the cap is treated as the cap, and the copy written carries
//      the clamped value. The cap is `now`, or the other side's `exported`
//      time when that is earlier (an export file's own time: nothing in a file
//      can be newer than the file). One device's clock claiming the future
//      must not win every later argument, so a record that had to be clamped
//      (it "ran ahead") NEVER beats anything this side holds: it is dropped
//      when this side has a record with its id or a deletion of it, or (for a
//      trash record) the record it deletes or another deletion of it, and is
//      written, at the cap, only when this side has nothing for it. Clamping
//      on each arrival alone isn't enough: the cap moves with `now`, so the
//      same file opened again would beat an edit or a deletion made in
//      between (audit BA4, BA12). Local records are never clamped: they are
//      the reader's own.
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
//      was unless something needed filling in or a note's marker was renamed
//      (`bookmark` reads as `ribbon`, E10).
//   8. Highlights are NOT re-run through the overlap rule (desk-highlights.mjs).
//      Each client applies that only when the reader makes or removes a
//      highlight, so a merge never trims or joins one.
//   9. A malformed arriving record (no string `id`, no `kind`, an unparsable
//      `modified`, or a trash record without a `deletedId`, naming itself as
//      what it deleted, or with an unparsable `deletedAt`) is skipped and
//      reported, never written. So is one whose `kind` differs from another
//      copy of its id, on this side or in the same input: one id is one
//      record, so a trash record never replaces the note it shares an id
//      with (audit BA11). The
//      local side is trusted to be what the store holds: its records are only
//      read, leniently (a local time that won't parse loses to anything).
//      Several records with one id inside one input are merged among
//      themselves first, by the same rules (an exact tie there takes the
//      smaller JSON text, so the order of the input never matters).
//
// The result doesn't depend on the order of either input, merging the same
// incoming twice writes nothing the second time (on a later day too, which is
// what the clamp's never-beats rule is for), and merging A into B and B into
// A end with the same records, apart from the places the rules name as
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

const holds = (t) => t.record != null && typeof t.record === "object";

/** Why an arriving record can't be merged, as a plain sentence; null if it can. */
function problemWith(r) {
  if (!r || typeof r !== "object" || Array.isArray(r)) return "It is not a record.";
  if (typeof r.id !== "string" || !r.id) return "It has no id.";
  if (typeof r.kind !== "string" || !r.kind) return "It has no kind.";
  if (!parses(r.modified)) return "Its modified time is missing or is not a time.";
  if (r.kind === "trash") {
    if (typeof r.deletedId !== "string" || !r.deletedId) return "It is a trash record that doesn't say which record it deleted.";
    if (r.deletedId === r.id) return "It is a trash record that names itself as the record it deleted.";
    if (!parses(r.deletedAt)) return "It is a trash record whose deletion time is missing or is not a time.";
  }
  return null;
}

/** The record with its times no later than the cap (the same object if they are). */
function clamped(r, cap, capMs) {
  let out = r;
  if (instant(out.modified) > capMs) out = { ...out, modified: cap };
  if (out.kind === "trash") {
    if (instant(out.deletedAt) > capMs) out = { ...out, deletedAt: cap };
    // The copy a trash record holds too, or a held copy from the future would
    // outrank every later one, and an undo would bring back its words (BA12).
    if (holds(out) && instant(out.record.modified) > capMs) out = { ...out, record: { ...out.record, modified: cap } };
  }
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

/** The latest time an arriving record may carry: `now`, or `exported` if earlier. */
function capOf(at, exported) {
  const nowMs = Date.parse(at);
  return parses(exported) && Date.parse(exported) < nowMs ? [exported, Date.parse(exported)] : [at, nowMs];
}

const kindName = (kind) => (kind === "trash" ? "trash record" : kind);
const aKind = (kind) => `${/^[aeiou]/i.test(kindName(kind)) ? "an" : "a"} ${kindName(kind)}`;

/** Everything both public functions need: the merged records, what was skipped and what ran ahead. */
function combine(local, incoming, { now, exported, tiebreak } = {}) {
  const at = checkNow(now);
  const [cap, capMs] = capOf(at, exported);

  const skipped = [];
  const arriving = [];
  const rawOf = new Map();
  const ahead = new Set();
  for (const raw of incoming ?? []) {
    const why = problemWith(raw);
    if (why) {
      skipped.push({ record: raw, reason: why });
      continue;
    }
    const migrated = migrateRecord(raw);
    const r = clamped(migrated, cap, capMs);
    if (r !== migrated) ahead.add(r);
    rawOf.set(r, raw);
    arriving.push(r);
  }

  const mine = dedupe(
    (local ?? []).filter((r) => typeof r?.id === "string" && r.id),
    pickWithin,
  );

  // Rule 9: one id is one record. Copies of one id in different kinds, within
  // the input or against this side, are left out, whatever their order.
  const kindsIn = new Map();
  for (const r of arriving) {
    if (!kindsIn.has(r.id)) kindsIn.set(r.id, new Set());
    kindsIn.get(r.id).add(r.kind);
  }
  const fitting = arriving.filter((r) => {
    const here = mine.get(r.id);
    let why = null;
    if (kindsIn.get(r.id).size > 1) why = "Another record in the same file has its id but is of another kind.";
    else if (here && here.kind !== r.kind) why = `It is ${aKind(r.kind)} with the id of ${aKind(here.kind)} here.`;
    if (why) skipped.push({ record: rawOf.get(r), reason: why });
    return !why;
  });
  const theirs = dedupe(fitting, pickWithin);

  // The clamp: a record that ran ahead never beats anything this side holds.
  const deletedHere = new Set();
  for (const r of mine.values()) if (r.kind === "trash" && typeof r.deletedId === "string") deletedHere.add(r.deletedId);
  const ranAhead = [];
  for (const [id, r] of theirs) {
    if (!ahead.has(r)) continue;
    const touches =
      mine.has(id) || (r.kind === "trash" ? mine.has(r.deletedId) || deletedHere.has(r.deletedId) : deletedHere.has(id));
    ranAhead.push({ record: rawOf.get(r), written: !touches });
    if (touches) theirs.delete(id);
  }

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

  return { records: [...merged.values()].sort(byId), skipped, ahead: ranAhead };
}

/**
 * Merge two copies of the notebook into one.
 *
 * @param {object[]} a the local records
 * @param {object[]} b the arriving records (the side that is clamped and checked)
 * @param {{ now?: string, exported?: string, tiebreak?: (local: object, incoming: object) => number }} [opts]
 *   `exported` is when the arriving copy was made (an export file's own time),
 *   which caps its records' times when it is earlier than `now`; a sync leaves
 *   it out. `tiebreak` decides an exact tie in `modified`, as a comparator on
 *   which copy is newer: positive when the local copy is, negative when the
 *   incoming one is, 0 (or absent) to leave the local copy.
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
 * @param {{ now?: string, exported?: string, tiebreak?: (local: object, incoming: object) => number }} [opts]
 * @returns {{ put: object[], remove: string[], skipped: { record: unknown, reason: string }[],
 *   ahead: { record: unknown, written: boolean }[] }}
 *   `put` holds only records that are new or changed; `remove` the local ids
 *   that went (a deleted record, or a trash record that collapsed or was
 *   cleared by an edit); `skipped` the arriving records that couldn't be
 *   merged; `ahead` the arriving records whose times ran past the cap, each
 *   `written` (at the cap) or not (what this side holds stayed).
 */
export function mergeRecords(local, incoming, opts) {
  const { records, skipped, ahead } = combine(local, incoming, opts);
  const before = new Map();
  for (const r of local ?? []) if (typeof r?.id === "string" && r.id) before.set(r.id, r);
  const put = records.filter((r) => !before.has(r.id) || !sameRecord(before.get(r.id), r));
  const kept = new Set(records.map((r) => r.id));
  const remove = [...before.keys()].filter((id) => !kept.has(id)).sort();
  return { put, remove, skipped, ahead };
}
