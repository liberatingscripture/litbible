// src/lib/desk-sheet-check.mjs
//
// A sheet's text checked before printing (STUDY-DESK.md, S2; "Order of
// work", 2b). A passage is read from today's chapter whenever the sheet is
// shown (STUDY-DESK-FORMAT.md, "Sheets (kind 9)", rule 1), so a printed sheet
// always carries the current text. What can go stale is the leader's work
// around it: a question about a word the verse no longer has, a blank chosen
// on the old wording. So every passage keeps `verseCopy`, its verses' anchor
// text when it was added, and this module says whether today's wording still
// matches it, which words moved, and the day the text on the page is from.
//
// The comparison is N3's (desk-wording.mjs): quotes, dashes and spacing are
// evened out first, so the August 2026 passes that curled quotes and changed
// hyphens to en dashes raise nothing. A passage that starts or ends inside a
// verse (it has a `quote`) is judged on its own words only, the way a quoted
// note is (desk-change.mjs): the rest of the verse doesn't print.
//
// Pure: the chapter is anchor-core's shape ({ verses, spans, text }), built by
// whoever has the page. Nothing here writes a record; the Sheet pane writes
// what `freshCopy` returns when the reader keeps the new wording.

import { compareContentVersions, verseCopyFor } from "./desk-records.mjs";
import { locatePassage, passageFromOffsets, passageReference } from "./desk-sheet-passages.mjs";
import { wordingChanged, wordingDiff } from "./desk-wording.mjs";

const VERSION = /^v(\d{4})(\d{2})(\d{2})\.[0-9a-f]+$/;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * The day (YYYY-MM-DD) in a content version ("v20261018.5d2c847d") or an ISO
 * time, or null for anything else ("unversioned", a dev build).
 */
export function dayOf(stamp) {
  if (typeof stamp !== "string") return null;
  const m = VERSION.exec(stamp) ?? ISO_DAY.exec(stamp);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** A YYYY-MM-DD day in words: "October 18, 2026". Null for anything else. */
export function dayWords(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day ?? "");
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/**
 * The day the text is from, as the reader counts days. A content version's
 * day is the build's UTC day (build-api-manifest.mjs), so a publish on an
 * American evening is already tomorrow in it (BVJ's A4 print, 2026-10-29).
 * When the page also names the build's time (`updatedAt`, version.json's,
 * on <html data-content-updated>) and that time falls on the version's own
 * UTC day, the day is that time's in `timeZone` (the reader's when
 * omitted). Otherwise it is the version's day, as before.
 */
export function textDay(contentVersion, updatedAt, timeZone) {
  const day = dayOf(contentVersion);
  if (!day || typeof updatedAt !== "string" || !/Z$/.test(updatedAt) || dayOf(updatedAt) !== day) return day;
  const time = new Date(updatedAt);
  if (Number.isNaN(time.getTime())) return day;
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(time);
  } catch {
    return day;
  }
  const part = (type) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/**
 * The line a copy of the sheet carries: "Text as of October 18, 2026", from
 * the content version the passages were read from and its build time
 * (textDay). Null when the version names no day (a dev build), and then the
 * copy prints no date rather than a wrong one.
 */
export function textAsOfLine(contentVersion, updatedAt, timeZone) {
  const words = dayWords(textDay(contentVersion, updatedAt, timeZone));
  return words ? `Text as of ${words}` : null;
}

/**
 * The newest of the content versions a sheet's passages were read from (each
 * chapter's page names its own build), for its "Text as of" line. A version
 * naming a day beats one that doesn't ("unversioned"); two that can't be
 * ordered keep the first; null when there are none.
 */
export function newestVersion(versions) {
  let best = null;
  for (const v of versions) {
    if (typeof v !== "string" || !v) continue;
    if (best == null || (!VERSION.test(best) && VERSION.test(v)) || compareContentVersions(v, best) === 1) best = v;
  }
  return best;
}

/**
 * A passage against today's chapter:
 *   { state: "same" }       the wording matches its copy
 *   { state: "changed", before, now, diff }
 *                           the wording moved since the passage was added;
 *                           `diff` is wordingDiff's runs, old to new
 *   { state: "unchecked" }  no copy to compare (a passage gathered from a
 *                           search, or added before its chapter was read)
 *   { state: "lost" }       its verses are gone from the chapter
 *
 * A quoted passage is "same" while its words are found as written ("found"
 * or "moved"), and "changed" when they had to be matched by their
 * surroundings ("changed") or not at all ("verse"); `before` is then the
 * quoted words and `now` what stands there today.
 */
export function passageCheck(chapter, m) {
  const endVerse = m.endVerse ?? m.verse;
  if (!chapter || verseCopyFor(chapter, m.verse, endVerse) == null) return { state: "lost" };
  if (m.quote?.exact) {
    const at = locatePassage(chapter, m);
    if (at.start == null) return { state: "lost" };
    if (at.status === "found" || at.status === "moved") return { state: "same" };
    const now = chapter.text.slice(at.start, at.end);
    if (!wordingChanged(m.quote.exact, now)) return { state: "same" };
    return { state: "changed", before: m.quote.exact, now, diff: wordingDiff(m.quote.exact, now) };
  }
  if (typeof m.verseCopy !== "string") return { state: "unchecked" };
  const now = verseCopyFor(chapter, m.verse, endVerse);
  if (!wordingChanged(m.verseCopy, now)) return { state: "same" };
  return { state: "changed", before: m.verseCopy, now, diff: wordingDiff(m.verseCopy, now) };
}

/**
 * The fields that make a passage current again ("Keep the new wording"): a
 * fresh copy of today's verses, and for a quoted passage its quote taken
 * again from where its words stand now, or dropped when they now cover whole
 * verses. `quote: undefined` removes the old one when merged over the module.
 * Null when the verses are gone.
 */
export function freshCopy(chapter, m, contentVersion) {
  const endVerse = m.endVerse ?? m.verse;
  if (!chapter || verseCopyFor(chapter, m.verse, endVerse) == null) return null;
  const where = { bookKey: m.bookKey, chapter: m.chapter };
  if (m.quote?.exact) {
    const at = locatePassage(chapter, m);
    if (at.start == null) return null;
    const fields = passageFromOffsets(chapter, where, at.start, at.end, contentVersion);
    const { bookKey, chapter: n, ...rest } = fields;
    return { quote: undefined, ...rest };
  }
  return { verseCopy: verseCopyFor(chapter, m.verse, endVerse), verseCopyAsOf: contentVersion };
}

/**
 * The passage as a record the release notes can be searched for
 * (desk-change.mjs, releaseNoteFor): its verses, and the day its copy was
 * taken. A passage's `verseCopyAsOf` is the content version it was read from
 * (a note's is a time); releaseNoteFor reads a day from either field.
 */
export function passageAsRecord(m) {
  const version = VERSION.test(m.verseCopyAsOf ?? "") ? m.verseCopyAsOf : undefined;
  return {
    bookKey: m.bookKey,
    chapter: m.chapter,
    verse: m.verse,
    endVerse: m.endVerse ?? m.verse,
    contentVersion: version,
    verseCopyAsOf: version ? undefined : m.verseCopyAsOf,
  };
}

/** "Romans 8:1–4", "Romans 8:1–4 and Galatians 5:13", "A, B, and C" (the Oxford comma). */
export function listReferences(refs) {
  if (refs.length <= 1) return refs[0] ?? "";
  if (refs.length === 2) return `${refs[0]} and ${refs[1]}`;
  return `${refs.slice(0, -1).join(", ")}, and ${refs[refs.length - 1]}`;
}

/**
 * What the sheet page says above the paper before it is printed, from each
 * passage and its check ([{ m, check }], in sheet order). Null when nothing
 * changed. A passage whose verses are gone is already reported where it would
 * print, so it isn't repeated here.
 */
export function checkSummary(items) {
  const changed = items.filter((x) => x.check?.state === "changed").map((x) => passageReference(x.m));
  if (!changed.length) return null;
  const one = changed.length === 1;
  return {
    count: changed.length,
    headline: one
      ? `The wording of ${changed[0]} has changed since you added it.`
      : `The wording of ${listReferences(changed)} has changed since you added them.`,
    advice: "The sheet prints today’s wording. Check your blanks, questions, and notes against it, then keep the new wording on the Study Desk.",
  };
}
