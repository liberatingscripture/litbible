// src/lib/desk-whats-new.mjs
//
// What's new for you (STUDY-DESK.md B3) and the "Verses in my notebook"
// filter on /release-notes (M10), phase 2a: the release notes narrowed to the
// verses the reader has marked. Pure: release-notes.json and the notebook in,
// a list out. It reads the same feed and the same verse parsing as the change
// notice (changeVerses in desk-change.mjs), so the two can't disagree about
// which verses a publish touched, and it writes nothing.
//
// Which marks count: notes on verses, highlights, bookmarks, pinned footnotes
// and ribbons, the records that sit on a verse. Which changes count: a
// change to a verse's wording (text_updated) and a change to a footnote on
// it (footnote_added, footnote_updated). A chapter's metadata and an intro,
// glossary or article change are not "your verses".
//
// "Since your last visit" is a day (YYYY-MM-DD) the caller keeps; a change
// only counts as new for a mark if it was published on or after the day the
// mark's text was taken (textDay), since a change the reader made their mark
// on top of is not news to them.

import { changeVerses, textDay } from "./desk-change.mjs";
import { entryIds } from "./release-notes-view.mjs";

/** The change types that touch a verse a reader may have marked. */
export const VERSE_CHANGE_TYPES = Object.freeze(["text_updated", "footnote_added", "footnote_updated"]);

const ON_A_VERSE = new Set(["note", "highlight", "bookmark", "footnotePin", "place"]);

/** A mark's verses as { bookKey, chapter, from, to }, or null. */
export function markVerses(record) {
  if (!record || !ON_A_VERSE.has(record.kind)) return null;
  if (record.glossaryEntry || record.article) return null;
  if (typeof record.bookKey !== "string" || !Number.isInteger(record.chapter)) return null;
  if (!Number.isInteger(record.verse)) return null;
  return { bookKey: record.bookKey, chapter: record.chapter, from: record.verse, to: record.endVerse ?? record.verse };
}

/** The marks among `records` that a change touches. */
export function marksTouched(change, records) {
  if (!VERSE_CHANGE_TYPES.includes(change?.type)) return [];
  const v = changeVerses(change);
  if (!v) return [];
  return (records ?? []).filter((r) => {
    const m = markVerses(r);
    return m && m.bookKey === v.bookKey && m.chapter === v.chapter && v.ranges.some(([a, b]) => a <= m.to && m.from <= b);
  });
}

/**
 * The publishes that touched the reader's verses, newest first:
 * `[{ id, date, label, href, changes: [{ change, index, records }] }]`, where
 * `index` is the change's place in its entry. A change counts for a mark only
 * when it was published on or after the day the mark's text was taken.
 *
 * @param {object[]} entries release-notes.json, newest first
 * @param {object[]} records the notebook
 * @param {{ since?: string | null }} [opts] only entries dated after this day
 */
export function whatsNewForYou(entries, records, { since = null } = {}) {
  if (!Array.isArray(entries)) return [];
  const ids = entryIds(entries);
  const out = [];
  entries.forEach((entry, i) => {
    if (since && !(entry.date > since)) return;
    const changes = [];
    (entry.changes ?? []).forEach((change, index) => {
      const touched = marksTouched(change, records).filter((r) => {
        const day = textDay(r);
        return !day || entry.date >= day;
      });
      if (touched.length) changes.push({ change, index, records: touched });
    });
    if (changes.length) out.push({ id: ids[i], date: entry.date, label: entry.label, href: `/release-notes/#${ids[i]}`, changes });
  });
  return out;
}

/** "Three changes since your last visit touch your verses", or null for none. */
export function whatsNewLine(found, { sinceVisit = false } = {}) {
  const n = (found ?? []).reduce((sum, e) => sum + e.changes.length, 0);
  if (!n) return null;
  const words = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
  const count = words[n] ?? String(n);
  const noun = n === 1 ? "change" : "changes";
  const verb = n === 1 ? "touches" : "touch";
  return `${count} ${noun}${sinceVisit ? " since your last visit" : ""} ${verb} your verses`;
}
