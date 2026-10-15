// src/lib/desk-whats-new-view.mjs
//
// How "What's new for you" (STUDY-DESK.md B3) and the /release-notes filter
// "Verses in my notebook" (M10) are put in front of the reader. The rules for
// which publishes touch which marks are desk-whats-new.mjs's; this is the
// layer between those and the page, kept pure so it can be tested: the day
// the reader last looked, which publishes are new to them, how many show
// before "Show more", how a mark is named in a sentence, and which rows of
// the release notes page the filter keeps.
//
// "Last looked" is a day (YYYY-MM-DD) kept in the notebook's meta, and it is
// the date of the newest publish in the feed at the time, never the device's
// clock: a wrong clock can't hide news, and a publish that lands later the
// same day as a look still counts as new. (One landing on the same day as
// the newest publish already seen is the one case it can't tell apart.)

import { marksTouched, markVerses } from "./desk-whats-new.mjs";
import { recordHref, recordReference } from "./desk-store-core.mjs";

/** The notebook meta key holding the day the reader last looked. */
export const SEEN_KEY = "whatsNewSeen";

/** How many publishes the notebook page lists before "Show more". */
export const PUBLISH_LIMIT = 10;

/** A saved "last looked" day if it is one, else null (never seen, or a stray value). */
export function seenDay(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/** The date of the newest publish in the feed, or null for an empty one. */
export function newestDate(entries) {
  let newest = null;
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (typeof entry?.date === "string" && (newest === null || entry.date > newest)) newest = entry.date;
  }
  return newest;
}

/** Whether any record sits on a verse, so a change to verses could matter to it. */
export function hasVerseMarks(records) {
  return (records ?? []).some((r) => markVerses(r) !== null);
}

const MARK_NAMES = { note: "note", highlight: "highlight", bookmark: "bookmark", footnotePin: "pinned footnote" };

/**
 * A mark named in a sentence, with its link: `{ text: "your note on Romans
 * 4:7", href: "/romans-4/#v7" }`. Marks that read the same ("your highlight on
 * Romans 4:7" twice) come out once.
 */
export function markLinks(records) {
  const seen = new Set();
  const out = [];
  for (const r of records ?? []) {
    const name = r.kind === "place" ? (r.ribbon ? "ribbon" : "place") : (MARK_NAMES[r.kind] ?? "mark");
    const text = `your ${name} on ${recordReference(r)}`;
    if (seen.has(text)) continue;
    seen.add(text);
    out.push({ text, href: recordHref(r) });
  }
  return out;
}

/**
 * What the notebook page lists, from whatsNewForYou's answer.
 *
 * Each publish is marked `isNew` when it came after the day the reader last
 * looked; with no such day (a first look) nothing is new, since "since your
 * last visit" has nothing to be since. Only the first `limit` publishes are
 * in `shown`; `hidden` counts the rest.
 *
 * @param {object[]} found whatsNewForYou(...), newest first
 * @param {string | null} seen the day last looked
 * @returns {{ shown: object[], hidden: number, fresh: object[] }} `fresh` is
 *   every new publish, shown or not, for the line above the list
 */
export function presentWhatsNew(found, seen, { limit = PUBLISH_LIMIT } = {}) {
  const marked = (found ?? []).map((entry) => ({ ...entry, isNew: seen !== null && entry.date > seen }));
  return { shown: marked.slice(0, limit), hidden: Math.max(0, marked.length - limit), fresh: marked.filter((e) => e.isNew) };
}

/* ── The filter on /release-notes ────────────────────────────────────── */

/** The key a row of the release notes page and the feed share: entry id, place in the entry, type. */
export const changeKey = (id, index, type) => `${id}:${index}:${type}`;

/**
 * The changes of the feed that touch a verse the reader has marked, as a Set
 * of changeKey()s. Unlike "What's new for you" this is every publish, not
 * only those after the mark was made: the filter answers "which of these are
 * about my verses", and a reader who bookmarked a verse today still wants the
 * history of it.
 *
 * @param {object[]} entries release-notes.json, newest first
 * @param {object[]} records the notebook
 * @param {string[]} ids entryIds(entries)
 */
export function notebookChangeKeys(entries, records, ids) {
  const keys = new Set();
  (entries ?? []).forEach((entry, i) => {
    (entry.changes ?? []).forEach((change, index) => {
      if (marksTouched(change, records).length) keys.add(changeKey(ids[i], index, change.type));
    });
  });
  return keys;
}
