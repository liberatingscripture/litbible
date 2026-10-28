// src/lib/desk-whats-new.mjs
//
// What's new for you (STUDY-DESK.md B3), phase 2a: the release notes narrowed
// to the verses the reader has marked. Pure: release-notes.json and the notebook in,
// a list out. It reads the same feed and the same verse parsing as the change
// notice (changeVerses in desk-change.mjs), so the two can't disagree about
// which verses a publish touched, and it writes nothing.
//
// Which marks count: notes on verses, highlights, bookmarks, pinned footnotes
// and ribbons, the records that sit on a verse. Which changes count: a
// change to a verse's wording (text_updated) and a change to a footnote on
// it (footnote_added, footnote_updated). A chapter's metadata and an intro,
// glossary or article change are not "your verses". A pinned footnote and a
// note on a footnote (M11) sit on a footnote, not on its verse's words, so only
// the footnote changes touch them (BA90; desk rule 23).
//
// "Since your last visit" is a day (YYYY-MM-DD) the caller keeps, with how
// many changes that day's publish held when the reader looked ("2026-10-26+3",
// seenMark): the drafter folds a second publish on one day into that day's
// entry, appending its changes, so the ones past the count are new (BA92). A
// change only counts for a mark if it was published on or after the day the
// mark's text was taken (textDay), since a change the reader made their mark
// on top of is not news to them.

import { changeVerses, textDay } from "./desk-change.mjs";
import { onFootnote } from "./desk-records.mjs";
import { entryIds } from "./release-notes-view.mjs";

/** The change types that touch a verse a reader may have marked. */
export const VERSE_CHANGE_TYPES = Object.freeze(["text_updated", "footnote_added", "footnote_updated"]);

const ON_A_VERSE = new Set(["note", "highlight", "bookmark", "footnotePin", "place"]);

/** The change types that touch a mark on a footnote rather than on the words. */
const FOOTNOTE_CHANGE_TYPES = new Set(["footnote_added", "footnote_updated"]);

/** Whether a mark sits on one of a verse's footnotes: a pin, or a note on a footnote. */
export function onAFootnote(record) {
  return record?.kind === "footnotePin" || onFootnote(record);
}

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
  const wording = !FOOTNOTE_CHANGE_TYPES.has(change.type);
  return (records ?? []).filter((r) => {
    if (wording && onAFootnote(r)) return false;
    const m = markVerses(r);
    return m && m.bookKey === v.bookKey && m.chapter === v.chapter && v.ranges.some(([a, b]) => a <= m.to && m.from <= b);
  });
}

/**
 * A saved "last looked" value as `{ day, count }`: "2026-10-26+3" is the day
 * and the number of changes its publish held then; a bare day (saved before
 * BA92) has `count: null`, and nothing on that day is new. Null for anything
 * else (never looked, or a stray value).
 */
export function seenMark(value) {
  if (value && typeof value === "object" && typeof value.day === "string") return value;
  const m = typeof value === "string" ? /^(\d{4}-\d{2}-\d{2})(?:\+(\d+))?$/.exec(value) : null;
  return m ? { day: m[1], count: m[2] === undefined ? null : Number(m[2]) } : null;
}

/**
 * Whether a change came after the reader last looked: its publish is dated
 * after the day, or it is the newest publish of that day (`firstOfDay`, the
 * one the drafter folds later changes into) and sits past the count. With no
 * "last looked" everything counts.
 *
 * @param {{ date: string, firstOfDay?: boolean }} entry
 * @param {number} index the change's place in its entry
 * @param {string | { day: string, count: number | null } | null} since
 */
export function isNewChange(entry, index, since) {
  const mark = seenMark(since);
  if (!mark) return true;
  if (entry.date > mark.day) return true;
  return entry.date === mark.day && mark.count !== null && entry.firstOfDay !== false && index >= mark.count;
}

/**
 * The publishes that touched the reader's verses, newest first:
 * `[{ id, date, label, href, firstOfDay, changes: [{ change, index, records }] }]`,
 * where `index` is the change's place in its entry and `firstOfDay` says the
 * entry is its day's newest. A change counts for a mark only when it was
 * published on or after the day the mark's text was taken.
 *
 * @param {object[]} entries release-notes.json, newest first
 * @param {object[]} records the notebook
 * @param {{ since?: string | object | null }} [opts] only the changes new
 *   since this "last looked" value (isNewChange)
 */
export function whatsNewForYou(entries, records, { since = null } = {}) {
  if (!Array.isArray(entries)) return [];
  const ids = entryIds(entries);
  const mark = seenMark(since);
  const days = new Set();
  const out = [];
  entries.forEach((entry, i) => {
    const firstOfDay = !days.has(entry.date);
    days.add(entry.date);
    const changes = [];
    (entry.changes ?? []).forEach((change, index) => {
      if (mark && !isNewChange({ date: entry.date, firstOfDay }, index, mark)) return;
      const touched = marksTouched(change, records).filter((r) => {
        const day = textDay(r);
        return !day || entry.date >= day;
      });
      if (touched.length) changes.push({ change, index, records: touched });
    });
    if (changes.length) {
      out.push({ id: ids[i], date: entry.date, label: entry.label, href: `/release-notes/#${ids[i]}`, firstOfDay, changes });
    }
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
