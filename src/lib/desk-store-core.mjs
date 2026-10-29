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
// place, and an undo does the reverse. A change that touches several records
// at once (a highlight that merges with its neighbours, desk-highlights.mjs)
// builds its own plan; planWrite is what checks it before the shell commits it.

import { BOOK_ORDER, bookKeyToLabel } from "../data/books.js";
import { editRecord, emptyTrashRecord, restoreFromTrash, trashRecord, validateRecord } from "./desk-records.mjs";

/** The BroadcastChannel every tab of the notebook listens on. */
export const CHANNEL = "lit-desk";

/**
 * Whether two values are the same, with a property holding `undefined` counting
 * as missing (JSON, and so the apps, can't tell the two apart).
 */
export function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  const keys = (o) => Object.keys(o).filter((k) => o[k] !== undefined);
  const ka = keys(a);
  return ka.length === keys(b).length && ka.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k]));
}

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

/**
 * Save an edit made in an editor over the record the notebook holds now
 * (`current`, read in the same transaction as the write), not over the copy
 * the editor opened with (`opened`), so what changed meanwhile survives (BA6).
 * Null, and nothing written, when the record is gone or anything besides the
 * fields being edited has changed since it was opened (labels, a kept quote, an
 * import), since the reader edited a version that is no longer there. A
 * restamp alone (`modified`, `client`) isn't a change.
 *
 * @param {object | null} current
 * @param {object} opened
 * @param {object} changes the fields the editor sets, `{ body, marker }` for a note
 * @param {{ now?: string, client?: string }} stamp
 */
export function planEdit(current, opened, changes, stamp) {
  if (!current || current.id !== opened?.id || current.kind !== opened.kind) return null;
  const ignore = new Set([...Object.keys(changes), "modified", "client"]);
  const rest = (r) => Object.fromEntries(Object.entries(r).filter(([k]) => !ignore.has(k)));
  if (!deepEqual(rest(current), rest(opened))) return null;
  return planSave(editRecord(current, changes, stamp));
}

/**
 * Check a plan someone else built before it is committed: the same refusal
 * planSave makes, for every record the plan puts. A trash record is written
 * whole and holds a record of any kind, so it is not judged here. Returns the
 * plan's `put` and `remove` alone, without the extras its builder attached.
 */
export function planWrite(plan) {
  const put = [...(plan?.put ?? [])];
  const remove = [...(plan?.remove ?? [])];
  for (const record of put) {
    if (record?.kind === "trash") continue;
    const problems = validateRecord(record);
    if (problems.length) throw new Error(`desk-store: not saved (${problems.join("; ")})`);
  }
  return { put, remove };
}

/** Delete a record: its trash record goes in, the record comes out. */
export function planDelete(record, ctx) {
  const trash = trashRecord(record, ctx);
  return { put: [trash], remove: [record.id], trash };
}

/** The bookmarks on one verse. A verse should hold one, but a copy can bring a second. */
export function bookmarksOn(records, { bookKey, chapter, verse }) {
  return (records ?? []).filter(
    (r) => r?.kind === "bookmark" && r.bookKey === bookKey && r.chapter === chapter && r.verse === verse,
  );
}

/**
 * Bookmark a verse, planned over the notebook as it is now (`records`, read in
 * the same transaction as the write): the new bookmark, or null and nothing
 * written when the verse already holds one, so a second press, or a press
 * before the panel has read the chapter, never saves two (BA16).
 */
export function planBookmark(records, record) {
  return bookmarksOn(records, record).length ? null : planSave(record);
}

/**
 * Remove the bookmark on a verse: every one it holds, each through its trash
 * record, so the mark goes from the margin (BA16). Null when there is none.
 * `trash` lists the trash records.
 */
export function planUnbookmark(records, place, ctx) {
  const plans = bookmarksOn(records, place).map((r) => planDelete(r, ctx));
  if (!plans.length) return null;
  return {
    put: plans.flatMap((p) => p.put),
    remove: plans.flatMap((p) => p.remove),
    trash: plans.map((p) => p.trash),
  };
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

/**
 * What a write tells the other tabs: the ids it touched and, when known, the
 * kinds of record those were (`changeKinds`), so a tab can skip a notice about
 * records it doesn't draw (BA107). `kinds` null or absent means "unknown", and
 * every listener then hears it.
 */
export function changeMessage(ids, kinds = null) {
  const message = { v: 1, ids: [...new Set(ids)] };
  if (Array.isArray(kinds)) message.kinds = [...kinds];
  return message;
}

/** The ids a message names, or null for anything this code didn't send. */
export function readChangeMessage(data) {
  if (data?.v !== 1 || !Array.isArray(data.ids)) return null;
  return data.ids.every((id) => typeof id === "string") ? data.ids : null;
}

/**
 * The kinds a message names, or null when it names none: a message from a tab
 * running an older copy of the page, whose listeners must hear it all.
 */
export function readChangeKinds(data) {
  if (!Array.isArray(data?.kinds)) return null;
  return data.kinds.every((k) => typeof k === "string") ? data.kinds : null;
}

/* ── Who needs to hear a change (BA107) ──────────────────────────────── */

/**
 * The kinds of record a write changes, for a listener that draws only some
 * kinds: every kind it puts, and every kind it replaces or removes (`before`:
 * the records as they stood in the same transaction, null where there was
 * none), so a record that changes kind is heard as both. A trash record counts
 * as itself and as what it holds, since a deletion is a note leaving the
 * notes (and a restore the trash record leaving the trash), and a view that
 * draws notes must hear both.
 *
 * Null when the kinds can't be told, which every listener then hears: a
 * record with no kind, or a removal when `before` wasn't read.
 *
 * @param {{ put: object[], remove: string[] }} plan
 * @param {(object | null)[] | undefined} before
 * @returns {string[] | null}
 */
export function changeKinds(plan, before) {
  if (plan.remove.length && !Array.isArray(before)) return null;
  const kinds = new Set();
  let known = true;
  const add = (r) => {
    if (typeof r?.kind !== "string") {
      known = false;
      return;
    }
    kinds.add(r.kind);
    if (r.kind === "trash") {
      for (const held of [r.deletedKind, r.record?.kind]) if (typeof held === "string") kinds.add(held);
    }
  };
  for (const r of plan.put) add(r);
  for (const r of before ?? []) if (r) add(r);
  return known ? [...kinds].sort() : null;
}

/**
 * Whether a listener hears a change. `filter` is what it subscribed with:
 * `{ kinds }` hears a change touching any of those kinds, `{ except }` one
 * touching any kind outside those, and none (or both empty) hears everything.
 * A change of unknown kinds (`kinds` null) is heard by all.
 */
export function hearsChange(filter, kinds) {
  if (!filter || !Array.isArray(kinds)) return true;
  if (Array.isArray(filter.kinds) && !kinds.some((k) => filter.kinds.includes(k))) return false;
  if (Array.isArray(filter.except) && !kinds.some((k) => !filter.except.includes(k))) return false;
  return true;
}

/**
 * The notebook's listeners: `add(fn, filter)` returns the way to remove it,
 * and `notify(ids, origin, kinds)` calls each listener that hears the change
 * as `fn(ids, origin, kinds)`. A listener that subscribes with no filter hears
 * every change, as before.
 */
export function listenerSet() {
  const entries = new Set();
  return {
    add(fn, filter) {
      const entry = { fn, filter };
      entries.add(entry);
      return () => entries.delete(entry);
    },
    notify(ids, origin, kinds = null) {
      for (const { fn, filter } of entries) if (hearsChange(filter, kinds)) fn(ids, origin, kinds);
    },
  };
}

/**
 * A notebook meta value changed (BA96): "last looked" for What's new, the last
 * copy saved. It names no record, so a tab hearing it redraws only what reads
 * meta, never the marks; readChangeMessage ignores it.
 */
export function metaMessage(key) {
  return { v: 1, meta: String(key) };
}

/** The meta key a message names, or null for anything else. */
export function readMetaMessage(data) {
  return data?.v === 1 && typeof data.meta === "string" && data.meta && !("ids" in data) ? data.meta : null;
}

/* ── Reading the notebook ────────────────────────────────────────────── */

const bookIndex = (key) => {
  const i = BOOK_ORDER.indexOf(key);
  return i === -1 ? Infinity : i;
};

/** Bible order, then the order records were made: the notebook's one order. */
export function byPlace(a, b) {
  return (
    bookIndex(a.bookKey) - bookIndex(b.bookKey) ||
    (a.chapter ?? 0) - (b.chapter ?? 0) ||
    (a.verse ?? 0) - (b.verse ?? 0) ||
    String(a.created).localeCompare(String(b.created))
  );
}

/**
 * The records a reader sees, in Bible order then the order they were made.
 * Trash records are left out; records not on the text (a label, a mark rule, a
 * sheet) come last.
 */
export function liveRecords(records) {
  return records.filter((r) => r && r.kind !== "trash").sort(byPlace);
}

/** One chapter's records, in the same order. */
export function forChapter(records, bookKey, chapter) {
  return liveRecords(records.filter((r) => r?.bookKey === bookKey && r.chapter === chapter));
}

/**
 * An article's slug today: `slug` followed through `renamed` (old slug to
 * new, src/data/article-slugs.json) to its end, since an article may be
 * renamed more than once. A loop stops where it would repeat.
 */
export function currentSlug(slug, renamed = {}) {
  const seen = new Set([slug]);
  let at = slug;
  while (Object.hasOwn(renamed, at) && !seen.has(renamed[at])) {
    at = renamed[at];
    seen.add(at);
  }
  return at;
}

/**
 * The reader's notes on one glossary entry or article (N11, provisional): `type`
 * is "glossaryEntry" or "article"; an `id` of null takes every entry or
 * article of that type. `renamed` maps an article's old slug to its new one
 * (src/data/article-slugs.json), so a note follows a renamed article.
 */
export function forProse(records, type, id = null, renamed = {}) {
  const current = (v) => (type === "article" ? currentSlug(v, renamed) : v);
  return liveRecords(records.filter((r) => r?.kind === "note" && typeof r[type] === "string" && (id == null || current(r[type]) === id)));
}

/**
 * "Romans 8:3", "Romans 8:3–5", "Glossary: Flesh" or an article's title for a
 * note on one (N11), or "" for a record on neither.
 */
export function recordReference(r) {
  if (typeof r?.glossaryEntry === "string") return `Glossary: ${r.targetTitle || r.glossaryEntry}`;
  if (typeof r?.article === "string") return r.targetTitle || r.article;
  if (!r?.bookKey || !r.chapter) return "";
  const base = `${bookKeyToLabel(r.bookKey)} ${r.chapter}`;
  if (!r.verse) return base;
  return r.endVerse && r.endVerse !== r.verse ? `${base}:${r.verse}–${r.endVerse}` : `${base}:${r.verse}`;
}

/**
 * Where a record is, as a sentence names it: recordReference's answer, except
 * for a note on a footnote (M11), which is "a footnote in Romans 8:3", since
 * the verse alone would call it a note on the verse.
 */
export function recordWhere(r) {
  const ref = recordReference(r);
  return ref && r?.kind === "note" && typeof r.footnote === "string" ? `a footnote in ${ref}` : ref;
}

/**
 * The Study View link for a record on the text, in the format's address form
 * (`/romans-8/#v3`, `#v3-5` for a range), or null for one that isn't.
 */
export function recordHref(r) {
  if (typeof r?.glossaryEntry === "string") return `/glossary/#${r.glossaryEntry}`;
  if (typeof r?.article === "string") return `/articles/${r.article}/`;
  if (!r?.bookKey || !r.chapter) return null;
  const path = `/${r.bookKey}-${r.chapter}/`;
  if (!r.verse) return path;
  return r.endVerse && r.endVerse !== r.verse ? `${path}#v${r.verse}-${r.endVerse}` : `${path}#v${r.verse}`;
}

/**
 * The Read View link for a record on the text: the verse in its book's Read
 * View (`/read/romans/#romans-8-v3`, Read View's own verse ids), or the
 * chapter (`#ch-8`) for one with no verse. Null for one not on the text.
 */
export function recordReadHref(r) {
  if (!r?.bookKey || !r.chapter) return null;
  const path = `/read/${r.bookKey}/`;
  return r.verse ? `${path}#${r.bookKey}-${r.chapter}-v${r.verse}` : `${path}#ch-${r.chapter}`;
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
  footnotePin: "Pinned footnote",
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
