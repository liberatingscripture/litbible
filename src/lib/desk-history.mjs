// src/lib/desk-history.mjs
//
// Ctrl+Z for the Study Desk's notebook: what one change leaves behind so it
// can be taken back, and the rules for taking it back. Pure: no storage, no
// DOM, no clock unless the caller leaves it out. The store
// (src/scripts/desk/store.js) records an entry for every change the reader
// makes in this tab, and src/scripts/desk/history.js keeps the stacks and
// listens for the keys; this file is what they ask.
//
// An entry is { id, before, after }, where `before` and `after` list every
// record id the change touched with the record as it stood on that side
// (null: absent). Because it keeps whole records, one shape covers every
// change the notebook can make: a note added, edited or deleted (a deletion
// removes the live record and puts a trash record in its place, so both are
// ids of the entry), a bookmark, a highlight that merges or trims its
// neighbours.
//
// Two rules decide whether a change may be taken back:
//   - Undoing is the reader acting, so every record put back is stamped with
//     the time of the undo and this client (principle 4). Under the newer
//     `modified` wins rule of a sync, the undone state must outrank the change
//     it undoes, or another device would keep the change: the stamp is
//     stepped past every time on the record it replaces (its `modified`, a
//     trash record's `deletedAt` and the `modified` of the copy it holds), as
//     well as past the put-back record's own, so it outranks that change even
//     on a clock running behind the one that made it (laterThanAll; audit 3
//     DI3-1). A record this code
//     can't edit comes back as it was with only `modified` and `client`
//     restamped, the fields every client reads (principle 6; Audit 8 DI8-2).
//     A trash record
//     put back is the deletion made again, so its `deletedAt` moves to the
//     same time: a copy of the notebook saved in between holds the record
//     the undo brought back, and an old `deletedAt` would lose to it (BA7).
//     For the same reason undoing an add deletes what was added, through a
//     trash record, rather than simply removing it, which a copy saved
//     before the undo would bring back as new. Each entry allots that trash
//     record's id when it is made (`undoTrash`), so a redo can take it away
//     again.
//   - A change is undone only while the notebook still holds what it left
//     (stillCurrent). If another tab, or a later change to the same record,
//     has moved a record on, putting the old state back would erase that
//     work, so the history says so instead. Records are compared whole
//     except for the fields the stamp above writes, `modified` and `client`,
//     and a trash record's `deletedAt`: an undo restamps the record it restores, and the change
//     before it in the history still holds the record as it was stamped
//     then. Compared with the stamp, undoing a deletion would overtake the
//     edit beneath it and nothing could be undone twice in a row. Words,
//     verses, colours and every other field still count; a stamp alone
//     isn't a change anyone made.

import { canEdit, laterThanAll, newId as freshId, trashRecord } from "./desk-records.mjs";
import { deepEqual, kindName, takeOff, liveRecords, recordWhere, touched } from "./desk-store-core.mjs";

/** How many changes one page visit remembers. */
export const HISTORY_LIMIT = 50;

/** A copy that shares nothing with the original, so a later edit can't reach into an entry. */
function snapshot(value) {
  if (value == null) return null;
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

/**
 * Records without the fields an undo or redo restamps (see the top of this
 * file); null (or undefined) is a record that isn't there.
 */
function content(record) {
  if (record == null) return null;
  const { modified: _modified, client: _client, ...rest } = record;
  if (record.kind === "trash") delete rest.deletedAt;
  // A bookmark's two group stamps move with an undo as `modified` does (DI3-3).
  if (record.kind === "bookmark") {
    delete rest.placedAt;
    delete rest.editedAt;
  }
  return rest;
}

/** Whether two records hold the same thing, a stamp apart or not. */
const sameRecord = (a, b) => deepEqual(content(a), content(b));

/**
 * A lookup from id to record from any of the shapes a caller has to hand: a
 * Map, a plain object, or a list of { id, record } (an entry's own). An id it
 * doesn't hold is absent.
 */
function lookup(states) {
  if (states instanceof Map) return (id) => states.get(id) ?? null;
  if (Array.isArray(states)) {
    const byId = new Map(states.map((s) => [s.id, s.record ?? null]));
    return (id) => byId.get(id) ?? null;
  }
  return (id) => (states && Object.hasOwn(states, id) ? states[id] : null) ?? null;
}

/* ── Recording ───────────────────────────────────────────────────────── */

/**
 * The entry for a plan that was just written. `before` is what the notebook
 * held under each id the plan touches, read before the write (a Map, an
 * object, or a list of { id, record }; an id it doesn't hold was absent).
 * `after` is what the plan left: its record for an id it puts, null for one
 * it removes (a removal wins if a plan did both, as it does when written).
 */
export function makeEntry(plan, before, id, { newId = freshId } = {}) {
  const was = lookup(before);
  const put = new Map((plan.put ?? []).map((r) => [r.id, r]));
  const gone = new Set(plan.remove ?? []);
  const ids = touched({ put: plan.put ?? [], remove: plan.remove ?? [] });
  const entry = {
    id,
    before: ids.map((rid) => ({ id: rid, record: snapshot(was(rid)) })),
    after: ids.map((rid) => ({ id: rid, record: gone.has(rid) ? null : snapshot(put.get(rid) ?? null) })),
  };
  // A record the change added, which an undo deletes through a trash record
  // with this id (see the top of this file). Not one the change brought back
  // from the trash (a restore, E12): the trash record it took away is in
  // `before`, and putting that back is the deletion again, so a second would
  // leave two trash records for one deletion.
  const restored = heldIds(entry.before);
  entry.undoTrash = entry.after
    .filter((a, i) => a.record && a.record.kind !== "trash" && entry.before[i].record == null && !restored.has(a.id))
    .map((a) => ({ id: a.id, trashId: newId() }));
  return entry;
}

/** Whether a change left the notebook as it found it, a stamp aside. Such a change isn't worth remembering. */
export function isNoop(entry) {
  return entry.before.every((b, i) => sameRecord(b.record, entry.after[i]?.record));
}

/** Add an entry to a stack, forgetting the oldest beyond `limit`. Returns a new stack. */
export function pushEntry(stack, entry, limit = HISTORY_LIMIT) {
  const next = [...stack, entry];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

/* ── Taking a change back, or doing it again ─────────────────────────── */

/** Every time a record carries that a stamp over it must step past (see the top of this file). */
const timesOf = (r) => (r ? [r.modified, r.deletedAt, r.placedAt, r.editedAt, r.record?.modified] : []);

/**
 * A record put back by an undo or a redo: stamped with the reader's act (only
 * `modified` and `client` when it isn't ours to edit), and stepped past `replaced`, the records it goes
 * back over, so it outranks that change wherever the copies meet (DI3-1). A
 * trash record is a deletion made again, now.
 */
function restamped(record, replaced, { now, client } = {}) {
  const at = laterThanAll(now ?? new Date().toISOString(), ...timesOf(record), ...replaced.flatMap(timesOf));
  const by = client ? { client } : {};
  if (record.kind === "trash") return { ...snapshot(record), modified: at, deletedAt: at, ...by };
  // A record this code can't edit gets only the fields every client reads
  // restamped, so it outranks the change it takes back too (DI8-2).
  if (!canEdit(record)) return { ...snapshot(record), modified: at, ...by };
  // An undo puts the whole bookmark back, so both of its group stamps move with it.
  const stamps = record.kind === "bookmark" ? { placedAt: at, editedAt: at } : {};
  return { ...snapshot(record), modified: at, ...by, ...stamps };
}

/**
 * The plan that puts one side of an entry back, over the other side (`over`).
 * What a put-back record replaces is the other side's record under its id
 * and, since a deletion and its record are two ids, the other side's trash
 * record for a live record, or the live record for a trash record.
 */
function planFor(states, over, ctx) {
  const was = lookup(over);
  const trashOver = new Map();
  for (const { record } of over) if (record?.kind === "trash" && record.deletedId) trashOver.set(record.deletedId, record);
  const put = [];
  const remove = [];
  for (const { id, record } of states) {
    if (record == null) {
      remove.push(id);
      continue;
    }
    const other = record.kind === "trash" ? was(record.deletedId) : trashOver.get(id);
    put.push(restamped(record, [was(id), other], ctx));
  }
  return { put, remove };
}

/**
 * The write that takes an entry's change back: every id that was absent before
 * is removed, every other put back as it was, stamped `now` by `client`
 * (see the top of this file for which records are not). A record the change
 * added is deleted, so a trash record holding it goes in under the id the
 * entry allotted (`undoTrash`).
 *
 * @param {{ before: { id: string, record: object | null }[],
 *   after: { id: string, record: object | null }[],
 *   undoTrash?: { id: string, trashId: string }[] }} entry
 * @param {{ now?: string, client?: string, contentVersion?: string }} [ctx]
 * @returns {{ put: object[], remove: string[] }}
 */
export function inversePlan(entry, ctx = {}) {
  const plan = planFor(entry.before, entry.after, ctx);
  const now = ctx.now ?? new Date().toISOString();
  for (const { id, trashId } of entry.undoTrash ?? []) {
    const added = entry.after.find((a) => a.id === id)?.record;
    if (!added) continue;
    // trashRecord steps the deletion past the added record's own `modified`.
    plan.put.push(
      trashRecord(snapshot(added), {
        now,
        client: ctx.client ?? added.client,
        contentVersion: ctx.contentVersion ?? added.contentVersion,
        id: trashId,
      }),
    );
  }
  return plan;
}

/**
 * The write that does a taken-back change again: the same as inversePlan, from
 * `after`, which also takes away the trash record an undone add left.
 */
export function redoPlan(entry, ctx = {}) {
  const plan = planFor(entry.after, entry.before, ctx);
  for (const { trashId } of entry.undoTrash ?? []) plan.remove.push(trashId);
  return plan;
}

/**
 * Whether the notebook still holds what the entry left (`side` "undo", the
 * default) or what it started from (`side` "redo"), in every record it
 * touched. `current` is what the notebook holds now under those ids (a Map, an
 * object, or a list of { id, record }); an id it doesn't hold is absent. Whole
 * records are compared, apart from their stamp (see the top of this file), so
 * any change to the words or anything else, by another tab or a later change
 * to the same record, means the entry was overtaken.
 */
export function stillCurrent(entry, current, side = "undo") {
  if (side !== "undo" && side !== "redo") throw new Error(`desk-history: side is "undo" or "redo", not "${side}"`);
  const have = lookup(current);
  const expected = side === "undo" ? entry.after : entry.before;
  return expected.every(({ id, record }) => sameRecord(have(id), record));
}

/* ── Saying what a change was ────────────────────────────────────────── */

/** The records on one side of an entry that are the reader's (a trash record is bookkeeping). */
const livePart = (states) => states.map((s) => s.record).filter((r) => r && r.kind !== "trash");

/** The ids of the records that a trash record on this side holds. */
const heldIds = (states) =>
  new Set(states.map((s) => s.record).filter((r) => r?.kind === "trash" && r.record?.id).map((r) => r.record.id));

/** What a highlight is in this respect: its colour counts, so a new colour is a new mark. */
const sortOf = (r) => (r.kind === "highlight" ? `highlight:${r.color}` : r.kind);

/**
 * A short sentence for what an entry changed, worked out from its records:
 * "Note on Romans 8:3 added.", "Highlight on Romans 8:3–4 changed." The
 * trash records a deletion writes are left out, and the record they hold is
 * what is described. A change to several records of a kind (a highlight that
 * merges with its neighbours) reads as one change, on the first record's
 * reference in Bible order.
 *
 *   added      a record, or a mark of a colour that wasn't there, appeared
 *   changed    records that were there still are, in a different state
 *              ("edited" for a note; the notebook's other kinds say "changed")
 *   removed    none is left ("deleted" for a note)
 *   restored   what the trash held is back
 *
 * A highlight erased from the middle of another leaves two pieces of one
 * colour, which is a change to that colour's highlight and not a new one,
 * hence the colour in `sortOf`.
 */
export function describeEntry(entry) {
  const before = livePart(entry.before);
  const after = livePart(entry.after);
  const beforeIds = new Set(before.map((r) => r.id));
  const named = (r, verb) => {
    if (r.kind === "sheet") return `Sheet “${r.title || "Untitled"}” ${verb}.`;
    const where = recordWhere(r);
    return `${kindName(r.kind)}${where ? ` on ${where}` : ""} ${verb}.`;
  };
  const first = (records) => liveRecords(records)[0];

  if (after.length === 0) {
    const gone = first(before);
    return gone ? named(gone, takeOff(gone.kind)[1]) : "Notebook changed.";
  }

  const held = heldIds(entry.before);
  const fresh = after.filter((r) => !beforeIds.has(r.id));
  if (fresh.length && fresh.length === after.length && fresh.every((r) => held.has(r.id))) {
    return named(first(fresh), "restored");
  }

  const sorts = new Set(before.map(sortOf));
  const added = fresh.filter((r) => !sorts.has(sortOf(r)));
  if (added.length) return named(first(added), "added");

  const shown = first(after);
  return named(shown, shown.kind === "note" ? "edited" : "changed");
}

/** "Note on Romans 8:3 added." as it reads after "Undone: ". */
export function lowerFirst(sentence) {
  return sentence.charAt(0).toLowerCase() + sentence.slice(1);
}
