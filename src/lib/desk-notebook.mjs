// src/lib/desk-notebook.mjs
//
// What the notebook page (/notebook/, src/scripts/desk/notebook-page.js) shows
// and does, apart from the page: how the records are grouped (Bible order,
// under a book and chapter; then notes on glossary entries and on articles;
// pinned footnotes and places as their own lists), how a
// filter narrows them, how the counts read in words, and the two bulk
// deletions at the page's foot. Pure: no storage, no DOM.
//
// "Delete everything" trashes every live record in one plan, so it is one
// undoable step and the 30 days of the trash still apply. "Empty the trash
// now" is the shared-computer button: it drops the content of every trash
// record at once, as emptyTrashRecord does at 30 days, and keeps each
// tombstone so a stale backup still can't bring a record back (A-F10). That
// one is deliberately not undoable: undoing it would be the point it exists to
// prevent.

import { BOOK_ORDER, bookKeyToLabel } from "../data/books.js";
import { trashRecord } from "./desk-records.mjs";
import { kindName, recordReference } from "./desk-store-core.mjs";
import { labelsOf } from "./desk-labels.mjs";

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
  { value: "place", plural: "Places", one: "place", many: "places" },
]);

/** The records the page lists: everything live except labels (they have their own section) and trash. */
export function listable(records) {
  return records.filter((r) => r && r.kind !== "trash" && r.kind !== "label");
}

/** Which of the filter's kinds have at least one record. */
export function kindsPresent(records) {
  const present = new Set(records.map((r) => r.kind));
  return KIND_CHOICES.filter((k) => present.has(k.value));
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
    if (kind && r.kind !== kind) return false;
    if (color && !(r.kind === "highlight" && r.color === color)) return false;
    if (labelId && !(r.labels ?? []).includes(labelId)) return false;
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
 *   places     places and ribbons
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
  const places = [];
  const other = [];
  for (const r of listable(records)) {
    if (r.kind === "footnotePin") pins.push(r);
    else if (r.kind === "place") places.push(r);
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
    places: places.sort(byPlace),
    other: other.sort(byCreated),
  };
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
export function planDeleteEverything(records, ctx) {
  const put = [];
  const remove = [];
  for (const r of records) {
    if (!r || r.kind === "trash" || typeof r.id !== "string") continue;
    put.push(trashRecord(r, ctx));
    remove.push(r.id);
  }
  return { put, remove };
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
