// src/lib/desk-sync.mjs
//
// The rules of syncing the notebook with the LIT notebook service (the plan's
// step 4g in STUDY-DESK.md, "Order of work," 4; STUDY-DESK-ENCRYPTION.md,
// "The service's interface," "Records"). Pure: no storage, no network, no DOM.
// The loop that applies them is src/lib/desk-sync-engine.mjs, and the browser's
// half is src/scripts/desk/sync/.
//
// THE QUEUE IS A DIFFERENCE, NOT A LIST. Nothing here records "this edit still
// has to go up." For each record the device keeps a small entry, the BASE:
// the service's revision of the row it last saw, and the digest of the local
// copy for which nothing is owed. What has to be pushed is whatever in the
// notebook no longer matches its entry. So an edit made offline is queued by
// being saved, it survives a reload because the notebook does, and a push that
// half succeeded leaves exactly the other half still owed. No write to the
// notebook has to carry a mark in the same transaction for this to hold.
//
// What an entry holds:
//   id     the record's id
//   rev    the row's revision as this device last saw it; 0 when the service
//          has no row for the id as far as this device knows
//   hash   the digest of the local copy for which nothing is owed. Usually
//          that is the copy the service holds, as this client reads it. null
//          means "whatever is here is owed"
//   del    on a trash record's row: the id of the record it deleted
//   held   why the service's row is not merged here: "aside" (this client
//          can't open it yet: a version or a key it doesn't know), "ahead"
//          (its times are past this device's clock), "skip" (it can't be read
//          at all: a seal that doesn't open, a record the format refuses)
//   sent   the digest this device last pushed for the id (the damper, below)
//   stuck  { hash, why }: a local copy that can't be pushed as it is (the
//          service refused the row, or it can't be sealed), until it changes
//
// THE RULES, each a decision of this step's unless it names another source.
// BVJ went through them on 2026-11-24 and said yes to each but the tie (rule
// 2 is still a proposal, and on the trash record's tie in desk-merge.mjs BVJ
// said "Ask BDR"). Every one still waits on BDR: STUDY-DESK-ENCRYPTION.md,
// "Still open," 74 to 84.
//
// 1. Pull before push, always. A row from the service is opened, read as any
//    arriving record is (readIncoming, the door a backup's records pass too),
//    and merged by the format's own engine (desk-merge.mjs) against this
//    device's clock.
// 2. The row the service holds wins an exact tie (SERVICE_WINS_TIE). That is
//    the format's PROPOSAL of step 4d ("Clocks"), which BDR has not confirmed
//    and BVJ has not decided; it is one constant here so a change is cheap.
// 3. After a merge, a local copy that differs from the service's row is owed
//    (pushed against that row's revision), with three exceptions:
//    - a copy that was only clamped is never pushed (step 4d's note): the
//      row is kept ("ahead") and judged again once this clock reaches it;
//    - while a row is held "aside" or "ahead," nothing is pushed for its id,
//      not even a later edit: this device hasn't read what it would replace;
//    - THE DAMPER: a copy this device already pushed for that id, which
//      another device then replaced, is not pushed again. Two clients whose
//      merges disagree about one record would otherwise trade pushes for
//      ever. Each ends holding its own copy until the record next changes.
// 4. A row is removed from the service only on evidence. A record gone from
//    this notebook is never reason enough: its row goes only when the
//    notebook holds what replaced it, already on the service (the trash
//    record that deleted it; for a trash record, the record it deleted, live
//    again, or the other trash record it collapsed into). A record that is
//    simply missing is fetched again, never deleted for everyone.
// 5. When an arriving deletion loses to a record that lives here (rule b: the
//    edit is the later action), that record is pushed again. The device that
//    deleted it removed its row, and nothing else would put it back.
// 6. A row a device couldn't read ("skip") is not overwritten by the copy
//    this device happens to hold. Only a later change to that copy pushes
//    over it.

import { canonical, mergeRecords } from "./desk-merge.mjs";
import { readIncoming } from "./desk-export.mjs";
import { Refusal, keyOf, openRow, sha256, toBase64url, utf8 } from "./desk-crypto.mjs";

/** The interface this client speaks (`GET /` answers it as `interface`). */
export const INTERFACE = 1;

/** One `POST /rows` carries at most this many rows, to put and to remove together (the spec's "Limits"). */
export const MAX_ROWS = 500;
/** A request's body is at most 4,194,304 bytes. This is the room a batch of rows is given inside it. */
export const BODY_BUDGET = 4_000_000;

/**
 * Whether the row the service holds wins an exact tie in `modified` against
 * this device's copy. PROPOSED in step 4d, not decided: see rule 2 above.
 */
export const SERVICE_WINS_TIE = true;

/** The merge's tiebreak for a row from the service: negative means the incoming copy. */
export const tiebreak = SERVICE_WINS_TIE ? () => -1 : undefined;

/* ── Digests ─────────────────────────────────────────────────────────── */

/**
 * A record's digest: 16 bytes of SHA-256 over its canonical JSON (keys
 * sorted), as base64url. Two copies with the same fields give the same text,
 * whatever order a client wrote them in.
 */
export async function digest(record) {
  return toBase64url((await sha256(utf8(canonical(record)))).subarray(0, 16));
}

const instant = (t) => {
  const n = typeof t === "string" ? Date.parse(t) : NaN;
  return Number.isNaN(n) ? -Infinity : n;
};

/** What the planner needs of a local record: its digest, when it was written, and what a trash record deleted. */
export async function summarize(record) {
  const out = { hash: await digest(record), t: instant(record.modified) };
  if (record.kind === "trash" && typeof record.deletedId === "string") out.del = record.deletedId;
  return out;
}

/**
 * The latest time a record carries that the merge's clamp reads (desk-merge:
 * `modified`; a trash record's `deletedAt` and its held copy's `modified`; a
 * bookmark's two stamps), as milliseconds.
 */
export function latestStamp(record) {
  let at = instant(record?.modified);
  const take = (t) => {
    at = Math.max(at, instant(t));
  };
  if (record?.kind === "trash") {
    take(record.deletedAt);
    if (record.record && typeof record.record === "object") take(record.record.modified);
  }
  if (record?.kind === "bookmark") {
    take(record.placedAt);
    take(record.editedAt);
  }
  return at;
}

/* ── Opening what arrives ────────────────────────────────────────────── */

/** The two refusals of a row that mean "keep it aside and fetch the keyring" (the spec's "Opening," step 1). */
const ASIDE = new Set(["version", "missingKey"]);

/**
 * Opens rows with a keyring. Each ends one of three ways, as the spec's
 * "Opening" says: opened; aside (`why` is "version" or "missingKey"); or
 * skipped, to be reported (`why` is the reference's word for the check that
 * failed). Nothing here deletes or overwrites anything.
 *
 * @param {object[]} rows rows as the service answers them
 * @param {object} keyring the keyring in memory
 * @returns {Promise<{ opened: { row: object, record: object }[], aside: { row: object, why: string }[],
 *   skipped: { row: object, why: string }[] }>}
 */
export async function openRows(rows, keyring) {
  const out = { opened: [], aside: [], skipped: [] };
  for (const row of rows) {
    try {
      const { record } = await openRow({ row, keyring });
      out.opened.push({ row, record });
    } catch (err) {
      if (!(err instanceof Refusal)) throw err;
      (ASIDE.has(err.why) ? out.aside : out.skipped).push({ row, why: err.why });
    }
  }
  return out;
}

/** True when a row kept aside can be tried again: a version this client reads, under a key it now holds. */
export function canOpenNow(row, keyring) {
  return row?.v === 1 && keyOf(keyring, row.kid) != null;
}

/** Of several rows for one id, the one with the highest revision (a conflict's row and a pulled one can meet). */
export function latestRows(rows) {
  const byId = new Map();
  for (const row of rows) {
    const seen = byId.get(row.id);
    if (!seen || row.rev > seen.rev) byId.set(row.id, row);
  }
  return [...byId.values()];
}

/* ── Merging what arrives ────────────────────────────────────────────── */

/**
 * The local records a set of arriving ones can touch: the copy of each id,
 * the record an arriving deletion deletes, and every local deletion of any of
 * those ids. The merge's rules read nothing else, so merging against these
 * gives the same writes as merging against the whole notebook (rule c's
 * emptying of unrelated trash is the store's own purge at open).
 */
function relevant(local, arriving, also) {
  const ids = new Set(also);
  for (const r of arriving) {
    ids.add(r.id);
    if (r.kind === "trash" && typeof r.deletedId === "string") ids.add(r.deletedId);
  }
  return local.filter((r) => ids.has(r.id) || (r.kind === "trash" && ids.has(r.deletedId)));
}

/**
 * What merging opened rows into the notebook would do, and what became of
 * each row. Run inside the notebook's own transaction: it awaits nothing.
 *
 * @param {object[]} local every record the notebook holds
 * @param {{ row: object, record: object }[]} opened rows already opened, one per id
 * @param {{ now: string, also?: string[] }} opts this device's clock, and the
 *   ids of rows that couldn't be opened, whose local copies `after` carries too
 * @returns {{ plan: { put: object[], remove: string[] },
 *   outcomes: { row: object, how: "merged" | "ahead" | "skip", why?: string, read?: object, written?: boolean }[],
 *   after: Map<string, object> }}
 *   `plan` is the write; each outcome says how its row fared (`read` is the
 *   record as this client reads it, before any clamp); `after` holds the
 *   touched local records as the plan leaves them.
 */
export function planIncoming(local, opened, { now, also = [] }) {
  const outcomes = [];
  const usable = [];
  const rowOf = new Map();
  const unread = [...also];
  for (const { row, record } of opened) {
    const read = readIncoming(record);
    if (read.skipped) {
      outcomes.push({ row, how: "skip", why: read.skipped.detail ?? read.skipped.reason });
      unread.push(row.id);
    } else {
      usable.push(read.record);
      rowOf.set(read.record, row);
    }
  }
  const mine = relevant(local, usable, unread);
  const merged = mergeRecords(mine, usable, { now, tiebreak });
  const settled = new Set();
  for (const { record, reason } of merged.skipped) {
    settled.add(record);
    outcomes.push({ row: rowOf.get(record), how: "skip", why: reason });
  }
  for (const { record, written } of merged.ahead) {
    settled.add(record);
    outcomes.push({ row: rowOf.get(record), how: "ahead", read: record, written });
  }
  for (const record of usable) if (!settled.has(record)) outcomes.push({ row: rowOf.get(record), how: "merged", read: record });

  const after = new Map(mine.filter((r) => typeof r?.id === "string").map((r) => [r.id, r]));
  for (const id of merged.remove) after.delete(id);
  for (const r of merged.put) after.set(r.id, r);
  return { plan: { put: merged.put, remove: merged.remove }, outcomes, after };
}

/**
 * The base entries and held rows that follow a merge (rules 3, 5 and 6).
 *
 * @param {{ outcomes: object[], after: Map<string, object>, base: Map<string, object>, now: string, tolerance: number }} input
 *   `outcomes` and `after` are planIncoming's; an outcome may also be
 *   `{ row, how: "aside", why }` or `{ row, how: "skip", why }` from openRows.
 * @returns {Promise<{ entries: object[], hold: object[], release: string[], reports: { id: string, how: string, why?: string }[] }>}
 *   `entries` replace their ids' entries; `hold` are rows to keep
 *   (`{ id, why, row, due? }`); `release` are ids whose held row can go.
 */
export async function settle({ outcomes, after, base, tolerance }) {
  const next = new Map();
  const entryOf = (id) => next.get(id) ?? base.get(id);
  const hold = [];
  const release = [];
  const reports = [];
  const hashHere = async (id) => (after.has(id) ? digest(after.get(id)) : null);
  const forced = new Set();

  for (const { row, how, why, read } of outcomes) {
    const id = row.id;
    const prev = entryOf(id);
    // The damper is for a copy another device replaced. A row whose revision went back was not
    // replaced: the service lost what this device sent, and is owed it again.
    const kept = prev?.sent && row.rev >= prev.rev ? { sent: prev.sent } : {};
    if (how === "aside") {
      next.set(id, { id, rev: row.rev, hash: prev?.hash ?? (await hashHere(id)), ...kept, held: "aside" });
      hold.push({ id, why: "aside", row });
      reports.push({ id, how, why });
      continue;
    }
    if (how === "skip") {
      // Unreadable here. What this device holds is settled as it stands (rule 6).
      next.set(id, { id, rev: row.rev, hash: await hashHere(id), ...kept, held: "skip" });
      release.push(id);
      reports.push({ id, how, why });
      continue;
    }
    const del = read.kind === "trash" && typeof read.deletedId === "string" ? { del: read.deletedId } : {};
    if (how === "ahead") {
      // Dropped, or written clamped. Either way the copy here is not pushed, and the row waits for this clock.
      next.set(id, { id, rev: row.rev, hash: await hashHere(id), ...del, ...kept, held: "ahead" });
      hold.push({ id, why: "ahead", row, due: latestStamp(read) - tolerance });
      reports.push({ id, how });
      continue;
    }
    // Merged. The service's copy, as this client reads it, against what the notebook now holds.
    const served = await digest(read);
    const here = await hashHere(id);
    const settledHere = here === null || here === served || kept.sent === here;
    next.set(id, { id, rev: row.rev, hash: settledHere && here !== null ? here : served, ...del, ...kept });
    release.push(id);
    // Rule 5: an arriving deletion that lost to a live record.
    if (del.del && after.has(del.del) && after.get(del.del).kind !== "trash") forced.add(del.del);
  }

  for (const id of forced) {
    const entry = entryOf(id);
    if (!entry || entry.held === "aside" || entry.held === "ahead") continue;
    const { sent: _sent, stuck: _stuck, ...rest } = entry;
    next.set(id, { ...rest, hash: null });
  }
  return { entries: [...next.values()], hold, release, reports };
}

/* ── What is owed ────────────────────────────────────────────────────── */

const blocked = (entry) => entry?.held === "aside" || entry?.held === "ahead";

/**
 * What this device owes the service: rows to put and rows to remove.
 *
 * @param {Map<string, { hash: string, t: number, del?: string }>} local every local record, summarized
 * @param {Map<string, object>} base the entries
 * @returns {{ put: { id: string, rev: number }[], remove: { id: string, rev: number }[], forget: string[],
 *   missing: string[], waiting: number, blocked: number, stuck: number }}
 *   `put` is in the order the records were written, oldest first; `remove`
 *   holds only rows whose replacement is already on the service (rule 4);
 *   `forget` are entries with nothing on either side; `missing` are records
 *   the service has and this notebook lost without a trace; `waiting`
 *   counts removals whose evidence goes up in this same push; `blocked` and
 *   `stuck` count changed copies that can't be pushed now.
 */
export function planPush(local, base) {
  const put = [];
  const out = { put, remove: [], forget: [], missing: [], waiting: 0, blocked: 0, stuck: 0 };
  for (const [id, here] of local) {
    const entry = base.get(id);
    if (blocked(entry)) {
      if (entry.hash !== here.hash) out.blocked++;
      continue;
    }
    if (entry && entry.hash === here.hash) continue;
    if (entry?.stuck && entry.stuck.hash === here.hash) {
      out.stuck++;
      continue;
    }
    put.push({ id, rev: entry?.rev ?? 0, t: here.t });
  }
  put.sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  out.put = put.map(({ id, rev }) => ({ id, rev }));

  /** On the service as it is here: its row is known and nothing is owed for it. */
  const synced = (id) => {
    const here = local.get(id);
    const entry = base.get(id);
    return Boolean(here && entry && entry.rev > 0 && !entry.held && entry.hash === here.hash);
  };
  const trashOf = new Map();
  for (const [id, here] of local) {
    if (!here.del) continue;
    if (!trashOf.has(here.del)) trashOf.set(here.del, []);
    trashOf.get(here.del).push(id);
  }
  const going = new Set(out.put.map((p) => p.id));
  for (const [id, entry] of base) {
    if (local.has(id)) continue;
    if (entry.rev === 0) {
      out.forget.push(id);
      continue;
    }
    // Nothing is pushed for a row this device hasn't read yet, a removal included.
    if (blocked(entry)) continue;
    const deletions = trashOf.get(entry.del ?? id) ?? [];
    // A trash record's row: the record it deleted lives again, or another deletion of it stands.
    // Any other row: a deletion of it stands.
    const replacedBy = entry.del ? [...(local.has(entry.del) && !local.get(entry.del).del ? [entry.del] : []), ...deletions] : deletions;
    if (replacedBy.some(synced)) out.remove.push({ id, rev: entry.rev });
    // Its replacement goes up in this push, and the removal follows it. One whose replacement can't
    // go up (stuck, or blocked) waits with it, and is counted there.
    else if (replacedBy.some((r) => going.has(r))) out.waiting++;
    // A row with no replacement here and no trace of why is missing, unless it was never merged
    // here at all ("skip"), which left nothing here to miss.
    else if (!replacedBy.length && !entry.held) out.missing.push(id);
  }
  return out;
}

/**
 * Splits rows to send into requests the service takes: at most MAX_ROWS in
 * one, and no more than BODY_BUDGET characters of them. A single row is
 * always sent, whatever its size (the largest a record can make fits).
 *
 * @template T
 * @param {T[]} items
 * @param {(item: T) => number} sizeOf the characters an item adds to a body
 * @returns {T[][]}
 */
export function batches(items, sizeOf) {
  const out = [];
  let batch = [];
  let size = 0;
  for (const item of items) {
    const n = sizeOf(item);
    if (batch.length && (batch.length === MAX_ROWS || size + n > BODY_BUDGET)) {
      out.push(batch);
      batch = [];
      size = 0;
    }
    batch.push(item);
    size += n;
  }
  if (batch.length) out.push(batch);
  return out;
}

/**
 * Reads the answer to a `POST /rows` against what was sent. The service
 * answers each row for itself, in the request's order.
 *
 * @param {{ put: { id: string }[], remove: { id: string }[] }} sent
 * @param {object} answer the answer's body
 * @returns {{ id: string, did: "stored" | "refused" | "changed" | "gone" | "removed", rev?: number, why?: string, row?: object }[]}
 *   `changed` is a conflict with a row that stands (`row` when the answer
 *   carried it); `gone` a conflict because the service has no such row.
 */
export function readPushAnswer(sent, answer) {
  const puts = Array.isArray(answer?.put) ? answer.put : [];
  const removes = Array.isArray(answer?.remove) ? answer.remove : [];
  if (puts.length !== sent.put.length || removes.length !== sent.remove.length) {
    throw new Error("desk-sync: the service answered a different number of rows than were sent");
  }
  const out = [];
  sent.put.forEach(({ id }, i) => {
    const a = puts[i] ?? {};
    if (a.conflict === "changed") out.push({ id, did: "changed", ...(a.row ? { row: a.row } : {}) });
    else if (a.conflict === "gone") out.push({ id, did: "gone" });
    else if (typeof a.refused === "string") out.push({ id, did: "refused", why: a.refused });
    else if (Number.isSafeInteger(a.rev) && a.rev > 0) out.push({ id, did: "stored", rev: a.rev });
    else throw new Error("desk-sync: the service's answer for a row is not one the interface gives");
  });
  sent.remove.forEach(({ id }, i) => {
    const a = removes[i] ?? {};
    if (a.conflict === "changed") out.push({ id, did: "changed", ...(a.row ? { row: a.row } : {}) });
    else if (a.removed === true) out.push({ id, did: "removed" });
    else throw new Error("desk-sync: the service's answer for a removal is not one the interface gives");
  });
  return out;
}

/* ── Waiting, and the reader's clock ─────────────────────────────────── */

/** How long to wait before the next try after `failures` failed ones in a row: 5 seconds, doubling to 5 minutes. */
export function retryDelay(failures) {
  return Math.min(5 * 60_000, 5_000 * 2 ** Math.max(0, Math.min(failures, 10) - 1));
}

/**
 * How far this device's clock is from the service's, in milliseconds
 * (positive: this clock is ahead), or null when it can't be told. The
 * service sends its time first in every answer.
 */
export function clockOffset(serviceTime, deviceNow) {
  const there = typeof serviceTime === "string" ? Date.parse(serviceTime) : NaN;
  return Number.isNaN(there) ? null : deviceNow - there;
}
