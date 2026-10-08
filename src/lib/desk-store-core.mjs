// src/lib/desk-store-core.mjs
//
// The Study Desk notebook's rules for what a change writes, kept apart from
// IndexedDB so Node can test them (src/scripts/desk/store.js is the shell that
// applies them). Each operation returns a write plan, { put, remove }, which
// the shell commits in one transaction and then announces to the reader's
// other tabs. Pure: no storage, no DOM.
//
// Deleting follows desk-records' provisional trash record (talk-through item
// 20): a deletion removes the live record and puts a trash record in its
// place, and an undo does the reverse.

import { BOOK_ORDER, bookKeyToLabel } from "../data/books.js";
import { emptyTrashRecord, restoreFromTrash, trashRecord, validateRecord } from "./desk-records.mjs";

/** The BroadcastChannel every tab of the notebook listens on. */
export const CHANNEL = "lit-desk";

/** The ids a plan touches, which is what the other tabs are told. */
export function touched(plan) {
  return [...new Set([...plan.put.map((r) => r.id), ...plan.remove])];
}

/** Save a new or edited record. Refuses one the format says is malformed. */
export function planSave(record) {
  const problems = validateRecord(record);
  if (problems.length) throw new Error(`desk-store: not saved (${problems.join("; ")})`);
  return { put: [record], remove: [] };
}

/** Delete a record: its trash record goes in, the record comes out. */
export function planDelete(record, ctx) {
  const trash = trashRecord(record, ctx);
  return { put: [trash], remove: [record.id], trash };
}

/**
 * Undo a deletion: the record comes back and its trash record goes. Null when
 * there is nothing to bring back (the trash has been emptied).
 */
export function planUndo(trash, ctx) {
  const record = restoreFromTrash(trash, ctx);
  if (!record) return null;
  return { put: [record], remove: [trash.id], record };
}

/** Empty every trash record that has waited its 30 days, keeping the tombstones. */
export function planPurge(records, now) {
  const put = [];
  for (const r of records) {
    if (r.kind !== "trash") continue;
    const emptied = emptyTrashRecord(r, now);
    if (emptied !== r) put.push(emptied);
  }
  return { put, remove: [] };
}

/* ── What tabs tell each other ───────────────────────────────────────── */

export function changeMessage(ids) {
  return { v: 1, ids: [...new Set(ids)] };
}

/** The ids a message names, or null for anything this code didn't send. */
export function readChangeMessage(data) {
  if (data?.v !== 1 || !Array.isArray(data.ids)) return null;
  return data.ids.every((id) => typeof id === "string") ? data.ids : null;
}

/* ── Reading the notebook ────────────────────────────────────────────── */

const bookIndex = (key) => {
  const i = BOOK_ORDER.indexOf(key);
  return i === -1 ? Infinity : i;
};

/**
 * The records a reader sees, in Bible order then the order they were made.
 * Trash records are left out; records not on the text (a label, a mark rule, a
 * sheet) come last.
 */
export function liveRecords(records) {
  return records
    .filter((r) => r && r.kind !== "trash")
    .sort(
      (a, b) =>
        bookIndex(a.bookKey) - bookIndex(b.bookKey) ||
        (a.chapter ?? 0) - (b.chapter ?? 0) ||
        (a.verse ?? 0) - (b.verse ?? 0) ||
        String(a.created).localeCompare(String(b.created)),
    );
}

/** One chapter's records, in the same order. */
export function forChapter(records, bookKey, chapter) {
  return liveRecords(records.filter((r) => r?.bookKey === bookKey && r.chapter === chapter));
}

/** "Romans 8:3", "Romans 8:3–5", or "" for a record not on the text. */
export function recordReference(r) {
  if (!r?.bookKey || !r.chapter) return "";
  const base = `${bookKeyToLabel(r.bookKey)} ${r.chapter}`;
  if (!r.verse) return base;
  return r.endVerse && r.endVerse !== r.verse ? `${base}:${r.verse}–${r.endVerse}` : `${base}:${r.verse}`;
}

/**
 * The Study View link for a record on the text, in the format's address form
 * (`/romans-8/#v3`, `#v3-5` for a range), or null for one that isn't.
 */
export function recordHref(r) {
  if (!r?.bookKey || !r.chapter) return null;
  const path = `/${r.bookKey}-${r.chapter}/`;
  if (!r.verse) return path;
  return r.endVerse && r.endVerse !== r.verse ? `${path}#v${r.verse}-${r.endVerse}` : `${path}#v${r.verse}`;
}

const KIND_NAMES = {
  highlight: "Highlight",
  note: "Note",
  hidden: "Hidden passage",
  bookmark: "Bookmark",
  place: "Place",
  markRule: "Mark rule",
  label: "Label",
  sheet: "Sheet",
};

/** What a reader calls a record's kind. An unknown kind is just "Item". */
export function kindName(kind) {
  return KIND_NAMES[kind] ?? "Item";
}

/**
 * The `client` field for a record the website writes: `web/2026.10`, the year
 * and month of the text the page was built from, so it moves with each month's
 * publishes without a version number of its own to keep.
 */
export function webClient(contentVersion) {
  const m = /^v(\d{4})(\d{2})\d{2}\./.exec(contentVersion ?? "");
  return m ? `web/${m[1]}.${m[2]}` : "web/dev";
}
