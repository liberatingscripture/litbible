// scripts/lib/alignment-audit-core.mjs
//
// Does every DECIDED alignment record still describe the text it points at?
//
// WHY THIS IS NEEDED AT ALL. mergeScanWithExisting keeps a non-`auto` record
// WHOLE — right for preserving human judgment, and exactly why a reviewed
// record survives a rescan even when the verse it cites was reworded out from
// under it. `build:alignment` reports dropped SCAN records and never reviewed
// ones, so nothing in the pipeline notices, and /glossary goes on publishing a
// verse link for a rendering the verse no longer contains. This is the check
// that notices. It is deliberately NOT part of CI (owner decision) — run it by
// hand whenever the scripture text has changed, before committing decisions.
//
// THE SUBTLETY, and the reason this is a module rather than a throwaway script:
// the test has to mirror computeOccurrenceN EXACTLY, INCLUDING ITS SUBSTRING
// FALLBACK. Re-deriving `n` by whole-word matching alone reports false
// positives — Mark 15:31 legitimately numbers "restore" as occurrence 2 by
// counting the one inside "restored". So the question asked here is never
// "where does this text occur" but "is there ANY position in today's verse that
// computeOccurrenceN would number the way this record is numbered". Ask it that
// way and both of that function's paths — the form pattern and the substring
// fallback — are covered without being reimplemented.
//
// Pure: no fs, argv, or process access, so it unit-tests against in-memory Maps
// (test/alignment-audit-core.test.js). The shell — scripts/audit-alignment.mjs —
// walks the chapter and alignment files and builds those Maps. Same split as
// verse-index-core.mjs and release-notes-core.mjs, for the same reason.
//
// It imports UP into the review tool for computeOccurrenceN rather than keeping
// a copy: agreeing with the writer is the entire premise, and a second copy of
// the numbering rule is the one way this check could quietly stop being true.
// review-core.mjs is pure and has no fs of its own, so nothing else comes with it.
//
// THE SECOND CHECK, and why it is separate. computeOccurrenceN is deliberately
// case-INSENSITIVE, while `english[].text` separately "preserves the casing as
// written" (CLAUDE.md). So a record can keep numbering correctly while its text
// records a capitalization the verse no longer has, and the numbering check
// above passes it silently — that is not a hypothetical: decapitalizing three
// "Triumphant Message" verses on 2026-08-20 drifted three confirmed records
// this way, and turned up a fourth (2Cor.2.12) that had drifted earlier and
// gone unreported. Findings carry `kind`, because the two want opposite
// remedies: a `missing` record no longer describes its verse and should be
// DELETED back into the review queue, while a `casing` record still points at
// the right span and should be REPAIRED IN PLACE. Reporting them as one kind
// would push a repair toward deletion, which throws away a human verdict.

import { computeOccurrenceN } from "../alignment-review/review-core.mjs";

/**
 * Every start index where `needle` occurs in `hay`, case-insensitively, as a
 * plain substring. Substring rather than whole-word ON PURPOSE — see the
 * fallback note above; narrowing to word boundaries here would re-introduce
 * exactly the false positives this is written to avoid.
 *
 * @returns {number[]}
 */
function candidateStarts(hay, needle) {
  const out = [];
  const h = String(hay).toLowerCase();
  const n = String(needle).toLowerCase();
  if (!n) return out;
  for (let i = h.indexOf(n); i !== -1; i = h.indexOf(n, i + 1)) out.push(i);
  return out;
}

/**
 * Whether this record's verdict is a human's, and so survives a rescan whole.
 * `auto` records are the scanner's own and are rewritten every run, so they
 * cannot go stale in the sense this module cares about.
 */
function isDecidedRecord(record) {
  return Boolean(record?.status) && record.status !== "auto";
}

/**
 * Whether a decided record makes a claim about the verse's TEXT that can be
 * re-checked. `rejected` and `no-rendering` both assert the absence of a
 * rendering, and `english` is empty on the latter — there is no span to look
 * for, so there is nothing here to verify. (A `no-rendering` verse that has
 * since GAINED a rendering is a real possibility and is not detectable from
 * the English side; the review queue is where that surfaces.)
 */
function makesTextClaim(record) {
  return (
    record.status !== "rejected" &&
    record.status !== "no-rendering" &&
    Array.isArray(record.english) &&
    record.english.length > 0
  );
}

/**
 * @typedef {object} StaleFinding
 * @property {string} ref      OSIS ref as the record carries it
 * @property {string} text     the English span the record claims
 * @property {number} n        the occurrence number it claims
 * @property {string|null} form  term.form, which drives the form-pattern path
 * @property {"missing"|"casing"} kind  what to do about it — `missing` means the
 *   record no longer describes its verse and should be deleted back into the
 *   review queue; `casing` means it still points at the right span and only its
 *   as-written text is stale, so it should be repaired in place
 * @property {string} reason   human-readable, for the report
 * @property {string} [verseText]  today's text, when there is any
 * @property {string} [actual]  on a `casing` finding, what the verse reads at
 *   the position this record numbers — i.e. what `text` should be repaired to
 */

/**
 * Audit one chapter's alignment records against that chapter's current text.
 *
 * @param {object} args
 * @param {number} args.chapter  the chapter this file covers, from its filename
 * @param {object[]} args.records  the file's `records` array
 * @param {Map<number, string>} args.verses  verse number -> plain text, exactly
 *   as splitChapterVerses returns it
 * @returns {{ checked: number, stale: StaleFinding[] }} `checked` counts records
 *   examined, not spans — one record with two spans is one checked record.
 */
export function auditChapterRecords({ chapter, records, verses }) {
  let checked = 0;
  /** @type {StaleFinding[]} */
  const stale = [];

  for (const record of records || []) {
    if (!isDecidedRecord(record) || !makesTextClaim(record)) continue;
    checked++;

    const parts = String(record.ref || "").split(".");
    const verse = Number(parts[parts.length - 1]);
    const refChapter = Number(parts[parts.length - 2]);
    const form = record.term?.form ?? null;

    // A record filed under the wrong chapter describes text it cannot reach.
    // Cheap to check here, and the alternative is a confusing "does not occur".
    if (Number.isFinite(refChapter) && refChapter !== chapter) {
      stale.push({
        ref: record.ref,
        text: record.english[0]?.text,
        n: record.english[0]?.n,
        form,
        kind: "missing",
        reason: `ref names chapter ${refChapter} but sits in the chapter ${chapter} file`,
      });
      continue;
    }

    const text = verses.get(verse);
    if (text == null) {
      stale.push({
        ref: record.ref,
        text: record.english[0]?.text,
        n: record.english[0]?.n,
        form,
        kind: "missing",
        reason: "verse has no text",
      });
      continue;
    }

    // Every span, not just english[0]. Phase 1 never emits more than one, but
    // phase 2 is many-to-many by design and each span is its own claim.
    for (const span of record.english) {
      const starts = candidateStarts(text, span.text);
      const numbering = starts.filter(
        (start) =>
          computeOccurrenceN({ verseText: text, form, text: span.text, start }) === span.n,
      );

      if (!numbering.length) {
        stale.push({
          ref: record.ref,
          text: span.text,
          n: span.n,
          form,
          kind: "missing",
          reason: starts.length
            ? `occurs ${starts.length}× but never numbers as n=${span.n}`
            : "does not occur",
          verseText: text,
        });
        continue;
      }

      // The record numbers correctly. Ask the second question: at any of the
      // positions it could be numbering, does the verse actually read what the
      // record says it reads? One matching position is enough — where a verse
      // carries both casings ("Torah" and "torah" in Romans 8:2, deliberately),
      // the record is describing whichever one it numbers, and requiring every
      // candidate to match would report that legitimate pair as drift.
      if (numbering.some((start) => text.slice(start, start + span.text.length) === span.text)) {
        continue;
      }

      const start = numbering[0];
      const actual = text.slice(start, start + span.text.length);
      stale.push({
        ref: record.ref,
        text: span.text,
        n: span.n,
        form,
        kind: "casing",
        reason: `numbers as n=${span.n}, but the verse reads “${actual}” there`,
        verseText: text,
        actual,
      });
    }
  }

  return { checked, stale };
}
