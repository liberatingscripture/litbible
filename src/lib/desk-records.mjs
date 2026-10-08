// src/lib/desk-records.mjs
//
// The Study Desk's records, as STUDY-DESK-FORMAT.md (draft 1) defines them:
// the nine kinds (draft 1 had ten; `legend` was dropped 2026-10-07), the
// fields every record carries, and the few rules every client keeps when it
// makes or changes one. Pure: no storage, no DOM, no
// clock or randomness of its own unless the caller leaves them out.
//
// Three of the format's principles are enforced here rather than left to each
// caller:
//   4. `modified` changes only when the reader changes something. editRecord
//      is the one way to change a record, and the only place `modified` moves.
//   6. Keep what you don't understand. Nothing here drops a field it doesn't
//      know, and a record of an unknown kind, or written by a newer schema,
//      can't be edited at all: canEdit says no, and editRecord refuses. It is
//      carried as it arrived.
//   7. A client on older text never corrects a record made on newer text.
//      mayRewriteAnchor answers that from `contentVersion`.
//
// Deleting is here PROVISIONALLY (phase 1b, BVJ 2026-10-05): the `trash`
// record's fields are the website's proposal to BDR (STUDY-DESK.md,
// "Questions for the apps", item 20, question 4), built ahead of the answer
// because nothing leaves the browser yet and only the preview writes records.
// If the apps answer differently, migrateRecord is where the change goes.
// Merging is still NOT here, and waits on the same answer.

import { BOOKS } from "../data/books.js";
import { makeAnchor, rangeOf, resolveAnchor } from "./anchor-core.mjs";

/** The format version this code writes. */
export const SCHEMA_VERSION = 1;

export const KINDS = Object.freeze([
  "highlight",
  "note",
  "hidden",
  "bookmark",
  "place",
  "markRule",
  "label",
  "sheet",
  "trash",
]);

export const COLORS = Object.freeze(["yellow", "green", "blue", "pink"]);

export const MARKERS = Object.freeze([
  "note",
  "emphasis",
  "question",
  "heart",
  "bookmark",
  "lightbulb",
  "flame",
]);

/** Kinds that sit on the text, and so carry `bookKey`, `chapter` and verses. */
const ON_THE_TEXT = new Set(["highlight", "note", "hidden", "bookmark", "place"]);

/** Fields a reader's edit may never change. */
const FIXED = new Set(["id", "kind", "schema", "created"]);

function newId() {
  return globalThis.crypto.randomUUID();
}

/**
 * A new record. `fields` holds the kind's own fields (`color`, `quote`,
 * `body`, the verses…); the fields every record carries are filled in here.
 *
 * @param {string} kind one of KINDS
 * @param {object} fields
 * @param {{ now?: string, client: string, contentVersion: string, id?: string }} ctx
 */
export function createRecord(kind, fields, { now, client, contentVersion, id } = {}) {
  if (!KINDS.includes(kind)) throw new Error(`desk-records: unknown kind "${kind}"`);
  if (kind === "trash") throw new Error("desk-records: a trash record is made by trashRecord, from the record it holds");
  for (const f of FIXED) {
    if (fields && f in fields) throw new Error(`desk-records: "${f}" is set by createRecord, not passed in`);
  }
  const at = now ?? new Date().toISOString();
  return {
    id: id ?? newId(),
    kind,
    schema: SCHEMA_VERSION,
    created: at,
    modified: at,
    client,
    contentVersion,
    labels: [],
    ...fields,
  };
}

/**
 * Whether this client may change a record. A record of an unknown kind or a
 * newer schema is carried untouched (principle 6), and a trash record is
 * written whole, never edited.
 */
export function canEdit(record) {
  return (
    KINDS.includes(record?.kind) &&
    record.kind !== "trash" &&
    Number.isInteger(record.schema) &&
    record.schema <= SCHEMA_VERSION
  );
}

/**
 * The reader changed something: a new record with `changes` applied and
 * `modified` moved to `now`. Every field the change doesn't name survives,
 * including fields this code doesn't know.
 */
export function editRecord(record, changes, { now, client } = {}) {
  if (!canEdit(record)) {
    throw new Error(`desk-records: record ${record?.id} can't be edited here (kind "${record?.kind}", schema ${record?.schema})`);
  }
  for (const f of Object.keys(changes)) {
    if (FIXED.has(f)) throw new Error(`desk-records: "${f}" can't change`);
  }
  return {
    ...record,
    ...changes,
    modified: now ?? new Date().toISOString(),
    ...(client ? { client } : {}),
  };
}

/* ── Deleting (provisional: talk-through item 20) ──────────────────────── */

/** How long a trash record keeps the whole deleted record (M7). */
export const TRASH_DAYS = 30;

/**
 * Delete a record: the trash record that replaces it. The live record is
 * removed and this written in its place, never a flag on the live record
 * (iOS found flag flips unreliable in sync). `record` holds the whole deleted
 * record as it was, fields this code doesn't know included, so a record of any
 * kind can be deleted and brought back intact.
 */
export function trashRecord(record, { now, client, contentVersion, id } = {}) {
  if (!record || typeof record.id !== "string") throw new Error("desk-records: nothing to delete");
  if (record.kind === "trash") throw new Error("desk-records: a trash record isn't deleted again");
  const at = now ?? new Date().toISOString();
  return {
    id: id ?? newId(),
    kind: "trash",
    schema: SCHEMA_VERSION,
    created: at,
    modified: at,
    client,
    contentVersion,
    labels: [],
    deletedId: record.id,
    deletedAt: at,
    record,
  };
}

/**
 * Undo a deletion: the record the trash record holds, back in the notebook.
 * Undoing is the reader acting, so `modified` moves (principle 4); that is what
 * lets an undo outlast the deletion when two copies of the notebook meet
 * (item 20, question 2). A record this code can't edit (an unknown kind, a
 * newer schema) comes back exactly as it was deleted, per principle 6.
 * Null when the trash record has been emptied and holds only its tombstone.
 */
export function restoreFromTrash(trash, { now, client } = {}) {
  if (trash?.kind !== "trash") throw new Error("desk-records: not a trash record");
  if (!trash.record) return null;
  if (!canEdit(trash.record)) return trash.record;
  return {
    ...trash.record,
    modified: now ?? new Date().toISOString(),
    ...(client ? { client } : {}),
  };
}

/**
 * After TRASH_DAYS a trash record drops what it held and keeps only its
 * tombstone (`deletedId`, `deletedAt`), indefinitely, so a stale backup can't
 * bring the record back (A-F10). The same record when it isn't due yet, or is
 * already empty. Emptying isn't the reader changing anything, so `modified`
 * stays put.
 */
export function emptyTrashRecord(trash, now = new Date().toISOString()) {
  if (trash?.kind !== "trash" || !("record" in trash)) return trash;
  const due = Date.parse(trash.deletedAt) + TRASH_DAYS * 86_400_000;
  if (!(Date.parse(now) >= due)) return trash;
  const { record: _dropped, ...tombstone } = trash;
  return tombstone;
}

/**
 * Bring a record up to SCHEMA_VERSION. At schema 1 there is nothing to do; the
 * hook exists so a later format change has one place to go. A record from a
 * newer schema is returned unchanged, and canEdit keeps it read-only.
 */
export function migrateRecord(record) {
  return record;
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/**
 * Problems with the fields the format names, as plain sentences; empty when
 * there are none. Unknown fields are never a problem, and a record of an
 * unknown kind or a newer schema is checked only for the fields every record
 * carries, since its own fields aren't this code's to judge.
 */
export function validateRecord(r) {
  const problems = [];
  const need = (ok, msg) => ok || problems.push(msg);

  need(typeof r?.id === "string" && r.id.length > 0, "id is missing");
  need(typeof r?.kind === "string" && r.kind.length > 0, "kind is missing");
  need(Number.isInteger(r?.schema) && r.schema >= 1, "schema is not a positive integer");
  need(ISO.test(r?.created ?? ""), "created is not an ISO 8601 UTC time");
  need(ISO.test(r?.modified ?? ""), "modified is not an ISO 8601 UTC time");
  need(typeof r?.client === "string", "client is missing");
  need(typeof r?.contentVersion === "string", "contentVersion is missing");
  need(Array.isArray(r?.labels) && r.labels.every((l) => typeof l === "string"), "labels is not a list of IDs");
  if (problems.length || !canEdit(r)) return problems;

  const k = r.kind;
  if (ON_THE_TEXT.has(k) && !(k === "note" && r.glossaryId)) {
    need(r.bookKey in BOOKS, `bookKey "${r.bookKey}" is not a book`);
    need(Number.isInteger(r.chapter) && r.chapter >= 1 && r.chapter <= (BOOKS[r.bookKey] ?? 0), "chapter is out of range");
    need(Number.isInteger(r.verse) && r.verse >= 1, "verse is not a positive integer");
    need(r.endVerse == null || (Number.isInteger(r.endVerse) && r.endVerse >= r.verse), "endVerse comes before verse");
  }
  if (r.quote != null) {
    const q = r.quote;
    need(typeof q.exact === "string" && q.exact.length > 0, "quote.exact is empty");
    need(typeof q.prefix === "string" && typeof q.suffix === "string", "quote needs prefix and suffix");
  }
  if (k === "highlight") {
    need(COLORS.includes(r.color), `color "${r.color}" is not one of ${COLORS.join(", ")}`);
    need(r.quote != null, "a highlight needs a quote");
  }
  if (k === "note") {
    need(typeof r.body === "string", "body is not text");
    need(MARKERS.includes(r.marker), `marker "${r.marker}" is not one of ${MARKERS.join(", ")}`);
  }
  if (k === "place") need(typeof r.name === "string", "name is not text");
  if (k === "label") need(typeof r.name === "string" && r.name.length > 0, "name is empty");
  if (k === "markRule") need(COLORS.includes(r.color), `color "${r.color}" is not one of ${COLORS.join(", ")}`);
  return problems;
}

/* ── Anchors ─────────────────────────────────────────────────────────── */

/**
 * The fields a record keeps for chapter text [start, end): its verses and its
 * quote. `chapter` is the anchor-core shape, from either builder.
 */
export function quoteFields(chapter, start, end) {
  const a = makeAnchor(chapter, start, end);
  return {
    verse: a.verse,
    endVerse: a.endVerse,
    quote: { exact: a.exact, prefix: a.prefix, suffix: a.suffix },
  };
}

/** The verses' anchor text, for `verseCopy` (C3, A-F8). */
export function verseCopyFor(chapter, verse, endVerse = verse) {
  const r = rangeOf(chapter, verse, endVerse);
  return r ? chapter.text.slice(r[0], r[1]) : null;
}

/**
 * Where a record sits in today's text: resolveAnchor for a quoted record, and
 * the whole verse range for one with no quote (a note on a whole verse, a
 * bookmark, a place), which is "found" as long as the verses exist.
 * Nothing is written back (principle 5).
 */
export function placeRecord(chapter, record) {
  const endVerse = record.endVerse ?? record.verse;
  if (record.quote) {
    return resolveAnchor(chapter, { verse: record.verse, endVerse, ...record.quote });
  }
  const r = rangeOf(chapter, record.verse, endVerse);
  return r ? { status: "found", start: r[0], end: r[1] } : { status: "lost", start: null, end: null };
}

/* ── Content versions (principle 7) ──────────────────────────────────── */

const VERSION = /^v(\d{8})\.([0-9a-f]+)$/;

/**
 * Order two `contentVersion` strings (`v20261004.5d2c847d`): -1, 0 or 1, or
 * null when they can't be ordered. Only the date orders them, since the hash
 * is a fingerprint, so two different publishes on one day are null.
 */
export function compareContentVersions(a, b) {
  if (a === b) return 0;
  const ma = VERSION.exec(a ?? "");
  const mb = VERSION.exec(b ?? "");
  if (!ma || !mb || ma[1] === mb[1]) return null;
  return ma[1] < mb[1] ? -1 : 1;
}

/**
 * Whether a client whose text is `currentVersion` may rewrite this record's
 * anchor when the reader acts (Keep, Mark the new words). Never when the
 * record was made on newer text than the client has, and not when the two
 * can't be ordered: the client should fetch /api/version.json first.
 */
export function mayRewriteAnchor(record, currentVersion) {
  const c = compareContentVersions(record.contentVersion, currentVersion);
  return c !== null && c <= 0;
}
