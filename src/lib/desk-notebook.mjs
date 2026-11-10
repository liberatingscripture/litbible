// src/lib/desk-notebook.mjs
//
// What the notebook page (/notebook/, src/scripts/desk/notebook-page.js) shows
// and does, apart from the page: how the records are grouped (Bible order,
// under a book and chapter; then notes on glossary entries and on articles;
// pinned footnotes as their own list; places have a section of their own), how a
// filter narrows them, how the counts read in words, and the two bulk
// deletions at the page's foot. Pure: no storage, no DOM.
//
// "Delete all marks" and "Delete all sheets" (Delete everything until Audit 8
// decision 8) each trash their records in one plan, so each is one
// undoable step and the 30 days of the trash still apply. "Empty the trash
// now" is the shared-computer button: it drops the content of every trash
// record at once, as emptyTrashRecord does at 30 days, and keeps each
// tombstone so a stale backup still can't bring a record back (A-F10). That
// one is deliberately not undoable: undoing it would be the point it exists to
// prevent.

import { BOOK_ORDER, bookKeyToLabel } from "../data/books.js";
import { TRASH_DAYS, restoreFromTrash, trashRecord } from "./desk-records.mjs";
import { bookmarksOn, kindName, recordReference } from "./desk-store-core.mjs";
import { canFollowMore, isFollowing } from "./desk-bookmarks.mjs";
import { findLabel, labelsOf } from "./desk-labels.mjs";

/* ── Text matching ───────────────────────────────────────────────────── */

/** Text as it is compared in the filter: no case, no accents, spaces collapsed. */
export function fold(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** The words of a record that the filter looks in, as one folded string. */
export function searchText(record, labels = new Map()) {
  const parts = [
    recordReference(record),
    kindName(record.kind),
    record.body,
    record.note,
    record.name,
    record.label,
    record.quote?.exact,
    record.footnote,
    record.targetTitle,
    record.color,
    ...labelsOf(record, labels).map((l) => l.name),
  ];
  return fold(parts.filter((p) => typeof p === "string").join(" \n "));
}

/* ── Sorting into the page's groups ──────────────────────────────────── */

const bookIndex = (key) => {
  const i = BOOK_ORDER.indexOf(key);
  return i === -1 ? Infinity : i;
};

const byPlace = (a, b) =>
  bookIndex(a.bookKey) - bookIndex(b.bookKey) ||
  (a.chapter ?? 0) - (b.chapter ?? 0) ||
  (a.verse ?? 0) - (b.verse ?? 0) ||
  String(a.created).localeCompare(String(b.created));

const byCreated = (a, b) => String(a.created).localeCompare(String(b.created)) || (a.id < b.id ? -1 : 1);

/** Filter choices, in the order they are offered. */
export const KIND_CHOICES = Object.freeze([
  { value: "note", plural: "Notes", one: "note", many: "notes" },
  { value: "highlight", plural: "Highlights", one: "highlight", many: "highlights" },
  { value: "bookmark", plural: "Bookmarks", one: "bookmark", many: "bookmarks" },
  { value: "footnotePin", plural: "Pinned footnotes", one: "pinned footnote", many: "pinned footnotes" },
]);

/**
 * The records the page lists: everything live except labels and places, which
 * have sections of their own (places.js draws places with Continue reading and
 * Read View's places, which aren't records), and trash.
 */
export function listable(records) {
  return records.filter((r) => r && r.kind !== "trash" && r.kind !== "label" && r.kind !== "place");
}

/**
 * What My Notes lists: not a sheet, which is a page of its own with a list on
 * /sheets and in the Sheets pane (LV3-3, BVJ 2026-11-07). The notebook page's
 * "What I've kept" still lists sheets, under "Sheets" (S12).
 */
export function withoutSheets(records) {
  return records.filter((r) => r?.kind !== "sheet");
}

// Bookmarks split two more ways in the Show menu once a list holds both (BVJ,
// 2026-11-04): the ones that move as the reader reads and the ones that stay put.
export const BOOKMARK_MOVES = "bookmark:moves";
export const BOOKMARK_STAYS = "bookmark:stays";
const BOOKMARK_SPLITS = Object.freeze([
  { value: BOOKMARK_MOVES, plural: "Bookmarks that move" },
  { value: BOOKMARK_STAYS, plural: "Bookmarks that stay put" },
]);

/** Which of the filter's kinds have at least one record. */
export function kindsPresent(records) {
  const present = new Set(records.map((r) => r.kind));
  const kinds = KIND_CHOICES.filter((k) => present.has(k.value));
  const moving = records.filter((r) => r.kind === "bookmark" && r.follow === true).length;
  const staying = records.filter((r) => r.kind === "bookmark").length - moving;
  if (!moving || !staying) return kinds;
  const at = kinds.findIndex((k) => k.value === "bookmark") + 1;
  return [...kinds.slice(0, at), ...BOOKMARK_SPLITS, ...kinds.slice(at)];
}

/** The highlight colours in use, in the format's order. */
export function colorsPresent(records, colors) {
  return colors.filter((c) => records.some((r) => r.kind === "highlight" && r.color === c));
}

/**
 * Narrow a list. `query` is matched against reference, words, quote, labels
 * and kind, without case or accents, each word of it in turn (all must be
 * there). `kind`, `color` and `labelId` are null for "any".
 */
export function filterRecords(records, { query = "", kind = null, color = null, labelId = null } = {}, labels = new Map()) {
  const words = fold(query).split(" ").filter(Boolean);
  return records.filter((r) => {
    if (kind === BOOKMARK_MOVES) {
      if (!(r.kind === "bookmark" && r.follow === true)) return false;
    } else if (kind === BOOKMARK_STAYS) {
      if (!(r.kind === "bookmark" && r.follow !== true)) return false;
    } else if (kind && r.kind !== kind) return false;
    if (color && !(r.kind === "highlight" && r.color === color)) return false;
    if (labelId && !(r.labels ?? []).some((id) => id === labelId || labels.get(id)?.id === labelId)) return false;
    if (!words.length) return true;
    const hay = searchText(r, labels);
    return words.every((w) => hay.includes(w));
  });
}

/**
 * The page's groups for a (filtered) list of records:
 *   books      [{ bookKey, label, chapters: [{ chapter, label, records }] }]
 *              in Bible order: notes, highlights, bookmarks and anything else
 *              on the text that has no list of its own below
 *   glossary   notes on glossary entries, by entry
 *   articles   notes on articles, by article
 *   pins       pinned footnotes, in Bible order
 *   other      records of a kind this code doesn't list in the groups above
 *              (a mark rule, a sheet, a kind from a newer version, and a
 *              hidden passage, which the owner is holding back from this
 *              release: one arriving from a file shows as a plain row)
 */
export function groupRecords(records) {
  const books = new Map();
  const glossary = [];
  const articles = [];
  const pins = [];
  const other = [];
  for (const r of listable(records)) {
    if (r.kind === "footnotePin") pins.push(r);
    else if (r.kind === "note" && typeof r.glossaryEntry === "string") glossary.push(r);
    else if (r.kind === "note" && typeof r.article === "string") articles.push(r);
    else if (["note", "highlight", "bookmark"].includes(r.kind) && r.bookKey && r.chapter) {
      if (!books.has(r.bookKey)) books.set(r.bookKey, new Map());
      const chapters = books.get(r.bookKey);
      if (!chapters.has(r.chapter)) chapters.set(r.chapter, []);
      chapters.get(r.chapter).push(r);
    } else other.push(r);
  }
  return {
    books: [...books.entries()]
      .sort(([a], [b]) => bookIndex(a) - bookIndex(b))
      .map(([bookKey, chapters]) => ({
        bookKey,
        label: bookKeyToLabel(bookKey),
        chapters: [...chapters.entries()]
          .sort(([a], [b]) => a - b)
          .map(([chapter, list]) => ({ chapter, label: `${bookKeyToLabel(bookKey)} ${chapter}`, records: list.sort(byPlace) })),
      })),
    glossary: glossary.sort((a, b) => a.glossaryEntry.localeCompare(b.glossaryEntry) || byCreated(a, b)),
    articles: articles.sort((a, b) => a.article.localeCompare(b.article) || byCreated(a, b)),
    pins: pins.sort(byPlace),
    other: other.sort(byCreated),
  };
}

/**
 * The record a following list brings into view for a reader at `passage`
 * (E17/E22): the first record on the text at or after it, in Bible order, by
 * the end of its verses; with none after, the last one before it. `here` says
 * the record is in the passage's own chapter, so the list can tell a reader
 * who has nothing kept where they are apart from one who has. `records` come
 * in the list's own order; one with no place (a note on a glossary entry or
 * an article) is passed over. Null when no record has a place.
 *
 * @param {object[]} records
 * @param {{ bookKey: string, chapter: number, verse?: number | null } | null | undefined} passage
 * @returns {{ record: object, here: boolean } | null}
 */
export function followTarget(records, passage) {
  const book = bookIndex(passage?.bookKey);
  if (!passage?.bookKey || !Number.isInteger(passage.chapter) || book === Infinity) return null;
  const verse = passage.verse ?? 0;
  const here = (r) => r.bookKey === passage.bookKey && r.chapter === passage.chapter;
  let before = null;
  for (const r of records) {
    const rb = bookIndex(r?.bookKey);
    if (rb === Infinity || !Number.isInteger(r.chapter)) continue;
    const last = Number.isInteger(r.endVerse) ? Math.max(r.verse ?? 0, r.endVerse) : r.verse ?? 0;
    const after = rb - book || r.chapter - passage.chapter || last - verse;
    if (after >= 0) return { record: r, here: here(r) };
    before = r;
  }
  return before ? { record: before, here: here(before) } : null;
}

/* ── Counts in words ─────────────────────────────────────────────────── */

/**
 * "12 notes, 4 highlights" for a list, "Nothing kept yet." for none. Kinds in
 * the filter's order, then "3 other items".
 */
export function describeCounts(records) {
  const list = listable(records);
  if (!list.length) return "Nothing kept yet.";
  const parts = [];
  for (const k of KIND_CHOICES) {
    const n = list.filter((r) => r.kind === k.value).length;
    if (n) parts.push(`${n} ${n === 1 ? k.one : k.many}`);
  }
  const known = new Set(KIND_CHOICES.map((k) => k.value));
  const rest = list.filter((r) => !known.has(r.kind)).length;
  if (rest) parts.push(`${rest} other ${rest === 1 ? "item" : "items"}`);
  return parts.join(", ");
}

/* ── Deleting in bulk ────────────────────────────────────────────────── */

/**
 * Every live record to the trash, in one plan: a trash record for each, and
 * each record removed. Labels go too. Records of any kind, including ones this
 * code doesn't know, are trashed whole (trashRecord keeps all their fields),
 * so one undo brings the lot back.
 */
export function planDeleteEverything(records, ctx, { which = "all" } = {}) {
  const put = [];
  const remove = [];
  for (const r of records) {
    if (!r || r.kind === "trash" || typeof r.id !== "string") continue;
    if (which !== "all" && (which === "sheets") !== (r.kind === "sheet")) continue;
    put.push(trashRecord(r, ctx));
    remove.push(r.id);
  }
  return { put, remove };
}

/**
 * The notebook page's two bulk deletions (Audit 8 decision 8; BVJ,
 * 2026-11-10): "Delete all marks" takes every record but sheets (notes,
 * highlights, bookmarks, pinned footnotes, labels, and any kind this code
 * doesn't know), and "Delete all sheets" takes the sheets and the reader's
 * own templates, which are sheets too. Each is one undoable step, as
 * Delete everything was.
 */
export const planDeleteMarks = (records, ctx) => planDeleteEverything(records, ctx, { which: "marks" });
export const planDeleteSheets = (records, ctx) => planDeleteEverything(records, ctx, { which: "sheets" });

/** How many records each bulk deletion would take: { marks, sheets }. */
export function bulkCounts(records) {
  let marks = 0;
  let sheets = 0;
  for (const r of records) {
    if (!r || r.kind === "trash" || typeof r.id !== "string") continue;
    if (r.kind === "sheet") sheets++;
    else marks++;
  }
  return { marks, sheets };
}

/**
 * A trash record without the record it holds, however recent it is: what
 * emptyTrashRecord does at 30 days, done now. The tombstone (`deletedId`,
 * `deletedAt`, `deletedKind`) stays. The same object when it is already empty.
 * `modified` stays put: emptying isn't the reader changing the notebook.
 */
export function emptyNow(trash) {
  if (trash?.kind !== "trash" || !("record" in trash)) return trash;
  const { record: _dropped, ...tombstone } = trash;
  return tombstone;
}

/** The plan that empties every trash record now; nothing to write when none holds anything. */
export function planEmptyTrashNow(records) {
  const put = [];
  for (const r of records) {
    if (r?.kind !== "trash") continue;
    const emptied = emptyNow(r);
    if (emptied !== r) put.push(emptied);
  }
  return { put, remove: [] };
}

/** How many trash records still hold a deleted record. */
export function trashHeld(records) {
  return records.filter((r) => r?.kind === "trash" && "record" in r && r.record != null).length;
}

/* ── Restoring from the trash (STUDY-DESK-FIXES.md E12) ────────────────────── */

/**
 * The trash records that still hold a record, the latest deletion first (on a
 * tie, the lower id, so every client lists them alike). An emptied one is only
 * a tombstone and isn't listed.
 */
export function trashItems(records) {
  return records
    .filter((r) => r?.kind === "trash" && r.record != null && typeof r.record === "object")
    .sort((a, b) => Date.parse(b.deletedAt) - Date.parse(a.deletedAt) || (a.id < b.id ? -1 : 1));
}

/**
 * Whole days a trash record has left before its words are dropped (TRASH_DAYS
 * after `deletedAt`), counted up, so a record deleted a moment ago has 30 and
 * one in its last hours has 1. Zero once it is due.
 */
export function daysLeft(trash, now = new Date().toISOString()) {
  const left = Date.parse(trash?.deletedAt) + TRASH_DAYS * 86_400_000 - Date.parse(now);
  return Number.isFinite(left) ? Math.max(0, Math.ceil(left / 86_400_000)) : 0;
}

/**
 * Bring one record back from the trash, planned over the notebook as it is now
 * (`records`, read in the same transaction as the write): the record, under
 * its own id with a fresh `modified` (restoreFromTrash), and its trash record
 * gone. Nothing else is edited: a label id on it that no longer names a label
 * is left, and is not drawn (labelsOf). Two cases are settled here, on BVJ's
 * calls of 2026-11-02:
 *   - a bookmark onto a verse that already holds one of its kind is refused
 *     (`bookmark`), so a restore never makes the second the rule forbids (a
 *     verse takes one that stays put and one that moves); a label whose name
 *     is kept already is refused too (`label`);
 *   - a bookmark that moved as the reader reads comes back still, unless
 *     six already move, and then comes back plain (`movesNoMore: true`).
 *
 * @returns {{ ok: true, plan: { put: object[], remove: string[] }, record: object, movesNoMore: boolean }
 *   | { ok: false, reason: string }}
 */
export function planRestore(records, trashId, ctx) {
  const trash = records.find((r) => r?.kind === "trash" && r.id === trashId);
  if (!trash) return { ok: false, reason: "missing" };
  if (!trash.record) return { ok: false, reason: "emptied" };
  const live = records.filter((r) => r && r.kind !== "trash");
  const held = trash.record;
  if (live.some((r) => r.id === held.id)) return { ok: false, reason: "exists" };
  // A verse takes one bookmark of each kind, one that stays put and one that moves.
  if (held.kind === "bookmark" && bookmarksOn(live, held).some((r) => isFollowing(r) === isFollowing(held))) {
    return { ok: false, reason: "bookmark" };
  }
  if (held.kind === "label" && findLabel(live, held.name)) return { ok: false, reason: "label" };
  let record = restoreFromTrash(trash, ctx);
  let movesNoMore = false;
  if (isFollowing(record) && !canFollowMore(live)) {
    const { follow: _follow, ...plain } = record;
    record = plain;
    movesNoMore = true;
  }
  return { ok: true, plan: { put: [record], remove: [trash.id] }, record, movesNoMore };
}

/**
 * Every record in the trash that can come back, in one plan, each judged over
 * what the ones before it brought (two bookmarks on one verse bring one;
 * the seventh to move comes back plain). The latest deletion goes first, so it
 * is the one that stays. `skipped` lists the trash records left in the trash
 * and why.
 */
export function planRestoreAll(records, ctx) {
  const put = [];
  const remove = [];
  const skipped = [];
  let movesNoMore = 0;
  let held = records;
  for (const trash of trashItems(records)) {
    const done = planRestore(held, trash.id, ctx);
    if (!done.ok) {
      skipped.push({ trash, reason: done.reason });
      continue;
    }
    put.push(...done.plan.put);
    remove.push(...done.plan.remove);
    if (done.movesNoMore) movesNoMore++;
    held = [...held.filter((r) => r.id !== trash.id), ...done.plan.put];
  }
  return { plan: { put, remove }, restored: put.length, skipped, movesNoMore };
}
