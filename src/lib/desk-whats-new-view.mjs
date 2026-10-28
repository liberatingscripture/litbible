// src/lib/desk-whats-new-view.mjs
//
// How "What's new for you" (STUDY-DESK.md B3) is put in front of the reader.
// The rules for which publishes touch which marks are desk-whats-new.mjs's;
// this is the layer between those and the page, kept pure so it can be
// tested: the day the reader last looked, which publishes are new to them,
// how many show before "Show more" and how a mark is named in a sentence.
//
// "Last looked" is kept in the notebook's meta as the date of the newest
// publish in the feed at the time, never the device's clock, and how many
// changes that publish held ("2026-10-26+3", seenValue): a wrong clock can't
// hide news, a publish that lands later the same day as a look still counts
// as new, and so does one the drafter folded into the day already seen (BA92).

import { isNewChange, markVerses, seenMark } from "./desk-whats-new.mjs";
import { recordHref, recordWhere } from "./desk-store-core.mjs";

/** The notebook meta key holding the day the reader last looked. */
export const SEEN_KEY = "whatsNewSeen";

/** How many publishes the notebook page lists before "Show more". */
export const PUBLISH_LIMIT = 10;

export { seenMark };

/** The date of the newest publish in the feed, or null for an empty one. */
export function newestDate(entries) {
  let newest = null;
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (typeof entry?.date === "string" && (newest === null || entry.date > newest)) newest = entry.date;
  }
  return newest;
}

/**
 * What to save as "last looked" after a look at `entries`: the newest date
 * and the number of changes its publish holds ("2026-10-26+3"), or null for an
 * empty feed. Where a day has two entries, the newest (listed first) counts.
 */
export function seenValue(entries) {
  const day = newestDate(entries);
  if (!day) return null;
  const entry = entries.find((e) => e?.date === day);
  return `${day}+${Array.isArray(entry?.changes) ? entry.changes.length : 0}`;
}

/** Whether any record sits on a verse, so a change to verses could matter to it. */
export function hasVerseMarks(records) {
  return (records ?? []).some((r) => markVerses(r) !== null);
}

const MARK_NAMES = { note: "note", highlight: "highlight", bookmark: "bookmark", footnotePin: "pinned footnote" };

/**
 * The separator before item `i` of `n` in a list read aloud, with the Oxford
 * comma: "a and b", "a, b, and c". Nothing before the first.
 */
export function listSeparator(i, n) {
  if (i <= 0) return "";
  if (i < n - 1) return ", ";
  return n === 2 ? " and " : ", and ";
}

/** Items joined by `listSeparator`: "a", "a and b", "a, b, and c". */
export function joinList(items) {
  return items.map((item, i) => listSeparator(i, items.length) + item).join("");
}

/**
 * The reader's marks named in a sentence, one entry for each place they sit,
 * with its link. Marks at one place share it: `{ text: "your note, highlight,
 * and bookmark on Luke 24:4", href: "/luke-24/#v4" }`, not the verse said
 * three times. A note on a footnote is its own place, "your note on a footnote
 * in Luke 24:4" (recordWhere), never merged with a note on the verse (BA90).
 * Places and the kinds within a place keep the order first seen;
 * marks that read the same ("your highlight on Romans 4:7" twice) come out
 * once. Join the entries with `listSeparator`.
 */
export function markLinks(records) {
  const places = new Map();
  for (const r of records ?? []) {
    const name = r.kind === "place" ? (r.ribbon ? "ribbon" : "place") : (MARK_NAMES[r.kind] ?? "mark");
    const where = recordWhere(r);
    let place = places.get(where);
    if (!place) {
      place = { names: [], href: recordHref(r) };
      places.set(where, place);
    }
    if (!place.names.includes(name)) place.names.push(name);
  }
  return [...places].map(([where, { names, href }]) => ({ text: `your ${joinList(names)} on ${where}`, href }));
}

/**
 * What the notebook page lists, from whatsNewForYou's answer.
 *
 * Each publish is marked `isNew` when it holds a change from after the reader
 * last looked (isNewChange: a later day, or past the count on the day seen);
 * with no "last looked" (a first look) nothing is new, since "since your last
 * visit" has nothing to be since. Only the first `limit` publishes are in
 * `shown`; `hidden` counts the rest.
 *
 * @param {object[]} found whatsNewForYou(...), newest first
 * @param {string | { day: string, count: number | null } | null} seen last looked
 * @returns {{ shown: object[], hidden: number, fresh: object[] }} `fresh` is
 *   every new publish, shown or not, holding only its new changes, for the
 *   line above the list
 */
export function presentWhatsNew(found, seen, { limit = PUBLISH_LIMIT } = {}) {
  const mark = seenMark(seen);
  const fresh = [];
  const marked = (found ?? []).map((entry) => {
    const changes = mark ? entry.changes.filter((c) => isNewChange(entry, c.index, mark)) : [];
    if (changes.length) fresh.push({ ...entry, isNew: true, changes });
    return { ...entry, isNew: changes.length > 0 };
  });
  return { shown: marked.slice(0, limit), hidden: Math.max(0, marked.length - limit), fresh };
}
