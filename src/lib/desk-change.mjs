// src/lib/desk-change.mjs
//
// The Study Desk's change notice (STUDY-DESK.md N3, audit C3): when a later
// publish moves the words a reader's note or highlight was made on, the mark
// says so, shows exactly what changed, and offers Keep or Delete. This is the
// pure half: records and today's text in, a notice (or nothing) out, and the
// record Keep would write. Nothing here touches the page, the notebook or the
// clock unless the caller leaves the time out. The panel and the margin that
// show a notice are src/scripts/desk/*.
//
// It follows the format (STUDY-DESK-FORMAT.md, "Finding a mark again"): a
// `changed`, `verse` or `lost` placement shows a notice, and Keep writes the
// found position as the new quote with a fresh `verseCopy`. A mark whose words
// are still found carries no notice, and neither does one whose words moved
// only in typography. The decisions behind the rest:
//
//   - Punctuation passes don't count (C3). The corpus has had mechanical
//     passes (439 straight quotes curled, 413 number-range hyphens turned to
//     en dashes in August 2026) that changed no wording, so a notice is raised
//     only where desk-wording's comparison, which evens out quotes, dashes and
//     spacing, says the words differ: for a quoted mark that has been carried
//     along, its quote against the words it now sits on (so a change
//     elsewhere in the verse doesn't count either); for a note on whole
//     verses, its `verseCopy` against today's verses. The exception is
//     `verse`: the mark has moved to whole verses, and the reader must be
//     told whatever the cause.
//   - Records from the apps have no `verseCopy`. They are judged the same way
//     where the quote decides, and show no diff; a note on whole verses with
//     no copy can't be judged, and carries no notice.
//   - A record made on NEWER text than this page has (principle 7) gets no
//     notice: the page is the one behind, so nothing it says would be true.
//   - Keep goes through editRecord, so `modified` moves (principle 4), and
//     only when the reader asks. mayKeep answers whether this page may be the
//     one to rewrite the record; it extends mayRewriteAnchor's "fetch
//     /api/version.json first" for two publishes on one day.
//   - A note on a glossary entry or an article (N11) has no
//     verses, so no `verseCopy`: its notice (proseNotice) compares the quote
//     alone, and falls to the whole entry or article instead of a verse.
//   - The release notes supply the date and reason, never the comparison
//     (releaseNoteFor): publishes logged in release-notes-skip.md have no
//     entry, and entries truncate long passages.
//
// The words shown to the reader are here too (noticeWords), so the panel, the
// margin and a screen reader's name for the mark all say the same thing.

import {
  canEdit,
  compareContentVersions,
  editRecord,
  placeRecord,
  proseTarget,
  quoteFields,
  verseCopyFor,
} from "./desk-records.mjs";
import { placeProse, proseQuote } from "./desk-prose-anchor.mjs";
import { wordingChanged, wordingDiff, wordingKey } from "./desk-wording.mjs";
import { changeBook, entryIds, parseDetail } from "./release-notes-view.mjs";

/** The kinds of notice. "changed", "verse", "lost" and "reworded" are on verses; "changed" and "whole" are on prose. */
export const NOTICE_KINDS = Object.freeze(["changed", "verse", "lost", "reworded", "whole"]);

/* ── Noticing ────────────────────────────────────────────────────────── */

/** A note or highlight on scripture verses: the marks that keep a `verseCopy`. */
function isVerseMark(record) {
  if (record?.kind !== "note" && record?.kind !== "highlight") return false;
  if (record.kind === "note" && (proseTarget(record) || record.glossaryId)) return false;
  return (
    typeof record.bookKey === "string" &&
    Number.isInteger(record.chapter) &&
    Number.isInteger(record.verse) &&
    (record.endVerse == null || Number.isInteger(record.endVerse))
  );
}

/**
 * Whether the words a `changed` mark was carried to really differ from the
 * words it quoted, once typography is evened out. The marked words are what
 * the notice is about, so a change elsewhere in the verse doesn't count, and
 * neither does a quote mark curled inside them. The verse copy isn't needed
 * for this, which is why the apps' records, which have none, are judged the
 * same way.
 */
function markedWordsMoved(chapter, record, at) {
  if (!record.quote?.exact || at.start == null) return true;
  return wordingKey(record.quote.exact) !== wordingKey(chapter.text.slice(at.start, at.end));
}

/**
 * The notice a note or highlight on verses carries in today's text, or null.
 * `chapter` is anchor-core's chapter for the record's own chapter, and
 * `pageVersion` the content version of the text the page is showing.
 *
 *   changed    the quoted words are gone and the mark sits on the words now
 *              between their context, which differ from them in more than
 *              typography
 *   verse      nothing usable is left; the mark has fallen to whole verses
 *   lost       the record's verses are no longer in the chapter
 *   reworded   a note on whole verses (no quote) whose verses read differently
 *              than when it was written
 *
 * @returns {null | {
 *   kind: "changed" | "verse" | "lost" | "reworded",
 *   status: string,       // placeRecord's status for the record
 *   start: number|null,   // chapter-text offsets where the mark is drawn today
 *   end: number|null,     //   (null when lost)
 *   before: string|null,  // record.verseCopy, if it is a string
 *   now: string|null,     // today's anchor text of the record's verses (null when lost)
 *   diff: object[]|null,  // wordingDiff(before, now), when both are strings
 * }}
 */
export function changeNotice(chapter, record, pageVersion) {
  if (!isVerseMark(record)) return null;
  // Made on newer text than this page has (principle 7): nothing true to say.
  if (compareContentVersions(record.contentVersion, pageVersion) === 1) return null;

  const at = placeRecord(chapter, record);
  const endVerse = record.endVerse ?? record.verse;
  const now = at.status === "lost" ? null : verseCopyFor(chapter, record.verse, endVerse);
  const before = typeof record.verseCopy === "string" ? record.verseCopy : null;
  const diff = before !== null && now !== null ? wordingDiff(before, now) : null;
  const notice = (kind) => ({ kind, status: at.status, start: at.start, end: at.end, before, now, diff });

  if (at.status === "lost") return notice("lost");
  // Whole verses now carry the mark, so the reader must be told, typography or not.
  if (at.status === "verse") return notice("verse");
  if (at.status === "changed") {
    return markedWordsMoved(chapter, record, at) ? notice("changed") : null;
  }
  // found / moved: the words are still there. Only a note on whole verses can
  // have reworded under the reader.
  if (record.kind === "note" && !record.quote && before !== null && now !== null && wordingChanged(before, now)) {
    return notice("reworded");
  }
  return null;
}

/**
 * The notice a note on a glossary entry or an article carries (N11), or null.
 * `text` is the body's anchor text as proseAnchorText reads it from the page.
 * Only a note that quotes the body can have lost its place: `changed` when the
 * words now between the quote's context really differ, `whole` when nothing
 * usable is left and the note has fallen to the entry or article as a whole
 * (start and end are then null).
 *
 * @returns {null | {kind: "changed"|"whole", status: string, start: number|null,
 *   end: number|null, before: null, now: null, diff: null}}
 */
export function proseNotice(text, record) {
  if (record?.kind !== "note" || !proseTarget(record) || !record.quote?.exact) return null;
  const at = placeProse(text, record);
  const notice = (kind) => ({ kind, status: at.status, start: at.start, end: at.end, before: null, now: null, diff: null });
  if (at.status === "changed") {
    return wordingKey(record.quote.exact) === wordingKey(text.text.slice(at.start, at.end)) ? null : notice("changed");
  }
  if (at.status === "whole") return notice("whole");
  return null;
}

/* ── Keeping ─────────────────────────────────────────────────────────── */

/**
 * The record Keep writes, or null when there is nothing to write. The reader
 * has seen the notice and accepted where the mark is now (format: "Keep writes
 * the found position as the new quote, with a fresh verseCopy"). Every write
 * goes through editRecord, so `modified` moves (principle 4); `now` is that
 * time, and the clock when left out.
 *
 *   changed   the quote, verses and verse copy follow the words now marked
 *   verse     a note becomes a note on whole verses (its quote is dropped, the
 *             key gone, not undefined); a highlight's quote becomes the whole
 *             range, since a highlight always has one
 *   reworded  the verse copy is retaken, so the notice doesn't come back
 *   whole     (prose) the note becomes a note on the whole entry or article
 *
 * Null for a "lost" notice (there is no text to keep it on, only Delete), for
 * a record this client can't edit (canEdit), and for a notice that doesn't fit
 * the record. `text` is the chapter for a record on verses, and the prose
 * anchor text for a note on an entry or article. The caller checks mayKeep.
 *
 * @param {object} args
 * @param {object} args.text anchor-core's chapter, or proseAnchorText's text
 * @param {object} args.record
 * @param {ReturnType<typeof changeNotice> | ReturnType<typeof proseNotice>} args.notice
 * @param {string} [args.now] an ISO time; the clock when left out
 * @param {{ client?: string, contentVersion: string }} args.ctx
 */
export function planKeep({ text, record, notice, now = new Date().toISOString(), ctx = {} }) {
  if (!notice || notice.kind === "lost" || !canEdit(record)) return null;
  const stamp = { now, client: ctx.client };
  const { quote: _quote, ...withoutQuote } = record;

  if (proseTarget(record)) {
    if (notice.kind === "changed" && Number.isInteger(notice.start) && Number.isInteger(notice.end)) {
      return editRecord(record, { quote: proseQuote(text, notice.start, notice.end), contentVersion: ctx.contentVersion }, stamp);
    }
    if (notice.kind === "whole") return editRecord(withoutQuote, { contentVersion: ctx.contentVersion }, stamp);
    return null;
  }

  const fresh = (verse, endVerse) => {
    const verseCopy = verseCopyFor(text, verse, endVerse);
    return verseCopy === null ? null : { verseCopy, verseCopyAsOf: now, contentVersion: ctx.contentVersion };
  };
  const hasRange = Number.isInteger(notice.start) && Number.isInteger(notice.end);

  if (notice.kind === "changed" && hasRange) {
    const at = quoteFields(text, notice.start, notice.end);
    const copy = fresh(at.verse, at.endVerse);
    return copy && editRecord(record, { ...at, ...copy }, stamp);
  }
  if (notice.kind === "verse") {
    const copy = fresh(record.verse, record.endVerse ?? record.verse);
    if (!copy) return null;
    if (record.kind === "highlight") {
      if (!hasRange) return null;
      return editRecord(record, { quote: quoteFields(text, notice.start, notice.end).quote, ...copy }, stamp);
    }
    return editRecord(withoutQuote, copy, stamp);
  }
  if (notice.kind === "reworded") {
    const copy = fresh(record.verse, record.endVerse ?? record.verse);
    return copy && editRecord(record, copy, stamp);
  }
  return null;
}

/**
 * Whether this page may be the one to rewrite the record when the reader
 * chooses Keep. Never when it was made on newer text than the page has
 * (principle 7). When the two versions can't be ordered (two publishes on one
 * day share a date, and only the date orders them), it may only if the page
 * holds the newest text there is: the caller fetches /api/version.json and
 * passes its `version` as `liveVersion`, and a page showing exactly that
 * version cannot be behind any record. This extends mayRewriteAnchor's "the
 * client should fetch /api/version.json first". With no `liveVersion` (offline,
 * or not fetched yet) an unorderable record may not be kept.
 */
export function mayKeep(record, pageVersion, liveVersion = null) {
  const c = compareContentVersions(record?.contentVersion, pageVersion);
  if (c === null) return typeof liveVersion === "string" && liveVersion === pageVersion;
  return c <= 0;
}

/* ── Showing ─────────────────────────────────────────────────────────── */

/**
 * A wordingDiff, shortened for a small panel: runs of unchanged words longer
 * than `context` words are cut down to their edges beside the change, with "…"
 * where words were left out. Deletions and insertions are never shortened. A
 * diff with nothing deleted or inserted has nothing to show: [].
 *
 *   leading run   its last `context` words, after "… "
 *   trailing run  its first `context` words, before " …"
 *   middle run    longer than 2 × `context`: its first and last `context` words
 *                 joined by " … "
 *
 * Each run keeps its `lead` (the whitespace before its first word), so the
 * pieces still join the way the text read.
 *
 * @param {{op: string, text: string, lead?: string}[]} runs from wordingDiff
 */
export function excerptDiff(runs, { context = 6 } = {}) {
  if (!Array.isArray(runs) || !runs.some((r) => r.op !== "same")) return [];
  const last = runs.length - 1;
  return runs.map((run, i) => {
    if (run.op !== "same") return run;
    const words = run.text.split(/\s+/).filter(Boolean);
    if (i === 0 && words.length > context) {
      return { ...run, text: `… ${words.slice(-context).join(" ")}` };
    }
    if (i === last && words.length > context) {
      return { ...run, text: `${words.slice(0, context).join(" ")} …` };
    }
    if (i > 0 && i < last && words.length > 2 * context) {
      return { ...run, text: `${words.slice(0, context).join(" ")} … ${words.slice(-context).join(" ")}` };
    }
    return run;
  });
}

/**
 * What the reader is told. `ref` is the mark's reference as the page words it
 * ("Romans 8:3"), used when the verses are gone. `keep` is the Keep button's
 * label, or null where there is nothing to keep (lost). Straight apostrophes,
 * like the rest of the desk's own strings.
 *
 * @returns {{ title: string, text: string, keep: string|null }}
 */
export function noticeWords(notice, record, ref) {
  const noun = record?.kind === "highlight" ? "highlight" : "note";
  const target = proseTarget(record);
  const whole = target
    ? target.type === "glossaryEntry" ? "entry" : "article"
    : (record?.endVerse ?? record?.verse) > record?.verse ? "passage" : "verse";

  switch (notice?.kind) {
    case "changed":
      return {
        title: "The wording changed",
        text: `Your ${noun} has been carried along to the words that now stand in place of the ones you marked.`,
        keep: "Keep on the new words",
      };
    case "verse":
      return {
        title: "The wording changed",
        text: `We couldn't find the words you marked, so your ${noun} is on the whole ${whole} for now.`,
        keep: `Keep on the whole ${whole}`,
      };
    case "whole":
      return {
        title: "The wording changed",
        text: `We couldn't find the words you marked, so your note is on the whole ${whole} for now.`,
        keep: `Keep on the whole ${whole}`,
      };
    case "lost":
      return {
        title: "Not in the text",
        text: `${ref} isn't in the text any more, so your ${noun} can't be shown on the page.`,
        keep: null,
      };
    case "reworded":
      return {
        title: "The wording changed",
        text: `The ${whole}'s wording changed after you wrote this note.`,
        keep: "Keep",
      };
    default:
      return { title: "The wording changed", text: "", keep: null };
  }
}

/* ── The release note ────────────────────────────────────────────────── */

// "Luke 11:2, 20, 43–44, 47 — text updated": the chapter, then the verses.
const DESCRIPTION = /^(.+?) (\d+):(.+?) — /;
// One piece of that list: "47", "43–44", or a run into the next chapter ("53–8:11").
const PIECE = /^(\d+)(?:\s*[–-]\s*(?:(\d+):)?(\d+))?$/;

/** The verse ranges a description names, or null when it names none this can read. */
function descriptionRanges(description, chapter) {
  const m = DESCRIPTION.exec(description ?? "");
  if (!m || (chapter != null && Number(m[2]) !== chapter)) return null;
  const ranges = [];
  for (const piece of m[3].split(/\s*,\s*|\s+and\s+/)) {
    const p = PIECE.exec(piece.trim());
    if (!p) return null;
    const from = Number(p[1]);
    let to = p[3] === undefined ? from : Number(p[3]);
    // A run into a later chapter takes the rest of this one.
    if (p[2] !== undefined && Number(p[2]) !== Number(m[2])) to = Infinity;
    ranges.push([from, Math.max(from, to)]);
  }
  return ranges.length ? ranges : null;
}

/**
 * Which verses a release-notes change touched: `{ bookKey, chapter, ranges }`
 * with `ranges` a list of [from, to] verse spans, or null when it can't tell.
 * Read from the description first ("Luke 11:2, 20, 43–44, 47 — text updated",
 * and "Romans 16:24 and 25–27 — …"), which the drafter writes for every
 * change; failing that the `v. N:` labels of the detail, and failing that
 * `location.verse`. The book and chapter are `location`'s, or, for the older
 * rows that have none, the description's own.
 */
export function changeVerses(change) {
  const bookKey = changeBook(change);
  const chapter = Number.isInteger(change?.location?.chapter)
    ? change.location.chapter
    : Number(DESCRIPTION.exec(change?.description ?? "")?.[2]) || null;
  if (!bookKey || !chapter) return null;

  let ranges = descriptionRanges(change.description, chapter);
  if (!ranges) {
    const labelled = (parseDetail(change.detail) ?? [])
      .map((s) => /^v\. (\d+)$/.exec(s.label ?? "")?.[1])
      .filter(Boolean)
      .map((n) => [Number(n), Number(n)]);
    if (labelled.length) ranges = labelled;
  }
  if (!ranges && Number.isInteger(change.location?.verse)) ranges = [[change.location.verse, change.location.verse]];
  return ranges ? { bookKey, chapter, ranges } : null;
}

/** The day (YYYY-MM-DD) the record's text was taken, or null. */
function textDay(record) {
  const v = /^v(\d{4})(\d{2})(\d{2})\.[0-9a-f]+$/.exec(record?.contentVersion ?? "");
  if (v) return `${v[1]}-${v[2]}-${v[3]}`;
  for (const t of [record?.verseCopyAsOf, record?.created]) {
    if (typeof t === "string" && /^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  }
  return null;
}

/**
 * The release note that most likely says why a mark's verses changed: the
 * newest entry, dated on or after the day the record's text was taken, with a
 * "text_updated" change to the record's chapter that touched any of its verses
 * (footnote changes don't alter a verse's wording). `entries` is
 * release-notes.json, newest first. It supplies the date and the link only:
 * what changed comes from the verse copy (C3), since a publish kept out of the
 * feed has no entry and a long entry truncates.
 *
 * @returns {null | { date: string, label: string, id: string, href: string }}
 */
export function releaseNoteFor(entries, record) {
  const since = textDay(record);
  if (!Array.isArray(entries) || !since || !Number.isInteger(record?.verse)) return null;
  const from = record.verse;
  const to = record.endVerse ?? record.verse;
  const ids = entryIds(entries);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!(entry.date >= since)) continue;
    for (const change of entry.changes ?? []) {
      if (change?.type !== "text_updated") continue;
      const v = changeVerses(change);
      if (!v || v.bookKey !== record.bookKey || v.chapter !== record.chapter) continue;
      if (v.ranges.some(([a, b]) => a <= to && from <= b)) {
        return { date: entry.date, label: entry.label, id: ids[i], href: `/release-notes/#${ids[i]}` };
      }
    }
  }
  return null;
}
