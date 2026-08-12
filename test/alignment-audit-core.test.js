// test/alignment-audit-core.test.js
//
// Unit tests for scripts/lib/alignment-audit-core.mjs — the staleness check
// behind `npm run audit:alignment`. Run with `npm test` (node --test test/).
//
// WHAT IS ACTUALLY AT RISK HERE. This check is the only thing standing between
// a reworded verse and a /glossary page that goes on linking readers to a
// rendering the verse no longer contains: mergeScanWithExisting keeps reviewed
// records whole, and build:alignment reports dropped SCAN records only. So the
// failure mode that matters most is not a missed stale record — it is a check
// so noisy with false positives that a real finding gets scrolled past. The
// Mark 15:31 case below is exactly that hazard, drawn from the live dataset.
//
// No disk: every case is an inline Map(verse -> plain text) shaped the way
// splitChapterVerses returns one, and inline records shaped like a real
// src/data/alignment/ file's `records` entries.

import { test } from "node:test";
import assert from "node:assert/strict";

import { auditChapterRecords } from "../scripts/lib/alignment-audit-core.mjs";

/* ── Fixture builders ────────────────────────────────────────────────────── */

/** One decided record, defaulted to the commonest shape (a confirmed review). */
function record({ ref, text, n = 1, form = null, status = "confirmed", english }) {
  return {
    ref,
    english: english ?? [{ text, n }],
    greek: [],
    term: { greek: "x", traditional: "X", glossary: "x-term", form },
    confidence: null,
    lemma: "present",
    source: "review",
    status,
  };
}

const verses = (entries) => new Map(entries);

/* ── 1. The substring fallback, which is where false positives come from ──
 * computeOccurrenceN tries the form pattern first and falls back to plain
 * substring counting. Re-deriving `n` by whole-word matching alone would call
 * a large number of perfectly good records stale. This is the live Mark 15:31
 * pair: the confirmed form is "restoration", which does not occur in the verse
 * at all, so BOTH records were numbered through the fallback — and "restore"
 * is occurrence 2 only because the one inside "restored" consumed number 1. */

const MARK_15_31 =
  "Likewise, the lead priests, along with the Bible scholars, were also mocking " +
  "him to each other, saying, “He restored others, but he can’t restore himself!";

test("an n reachable only through the substring fallback is not stale", () => {
  const { checked, stale } = auditChapterRecords({
    chapter: 15,
    verses: verses([[31, MARK_15_31]]),
    records: [
      record({ ref: "Mark.15.31", text: "restore", n: 2, form: "restoration" }),
      record({ ref: "Mark.15.31", text: "restored", n: 1, form: "restoration" }),
    ],
  });

  assert.equal(checked, 2);
  assert.deepEqual(stale, [], "the substring fallback was not mirrored");
});

test("the form-pattern path is honored when the form does match", () => {
  // The ordinary case: the form occurs, so findFormMatches numbers the span and
  // the fallback never runs. formPattern allows a plural/possessive tail, so
  // "life-breaths" is still occurrence 2 of the form "life-breath".
  const { stale } = auditChapterRecords({
    chapter: 3,
    verses: verses([[8, "The life-breath blows where it wills, and life-breaths scatter."]]),
    records: [record({ ref: "John.3.8", text: "life-breaths", n: 2, form: "life-breath" })],
  });

  assert.deepEqual(stale, []);
});

/* ── 2. Real staleness, which is the thing being hunted ──────────────────── */

test("a rendering edited out of the verse is reported", () => {
  const { checked, stale } = auditChapterRecords({
    chapter: 8,
    verses: verses([[3, "…because of self-protection."]]),
    records: [record({ ref: "Rom.8.3", text: "self-preservation", form: "self-preservation" })],
  });

  assert.equal(checked, 1);
  assert.equal(stale.length, 1);
  assert.equal(stale[0].ref, "Rom.8.3");
  assert.equal(stale[0].text, "self-preservation");
  assert.equal(stale[0].reason, "does not occur");
  assert.equal(stale[0].verseText, "…because of self-protection.");
});

test("a verse that lost an occurrence is reported with the count it now has", () => {
  // The subtler edit: the words are still there, but not enough of them, so an
  // `n` that used to resolve no longer does.
  const { stale } = auditChapterRecords({
    chapter: 15,
    verses: verses([[31, "He can’t restore himself!"]]),
    records: [record({ ref: "Mark.15.31", text: "restore", n: 2, form: "restoration" })],
  });

  assert.equal(stale.length, 1);
  assert.equal(stale[0].reason, "occurs 1× but never numbers as n=2");
});

test("an apostrophe changing shape is reported", () => {
  // The repair-in-place case: the wording is unchanged and only the characters
  // moved, so this one gets fixed rather than deleted. It still has to surface.
  const { stale } = auditChapterRecords({
    chapter: 1,
    verses: verses([[1, "the Anointed One’s people"]]),
    records: [record({ ref: "Rom.1.1", text: "Anointed One's", form: "Anointed One" })],
  });

  assert.equal(stale.length, 1);
  assert.equal(stale[0].reason, "does not occur");
});

test("a verse the chapter no longer carries is reported", () => {
  const { stale } = auditChapterRecords({
    chapter: 17,
    verses: verses([[35, "One will be taken."]]),
    records: [record({ ref: "Luke.17.36", text: "taken", form: "taken" })],
  });

  assert.equal(stale.length, 1);
  assert.equal(stale[0].reason, "verse has no text");
  assert.equal(stale[0].verseText, undefined, "there is no text to quote back");
});

test("a record filed under the wrong chapter is reported as such", () => {
  const { stale } = auditChapterRecords({
    chapter: 8,
    verses: verses([[12, "Family, we owe nothing to self-preservation."]]),
    records: [record({ ref: "Rom.9.3", text: "Family", form: "family" })],
  });

  assert.equal(stale.length, 1);
  assert.match(stale[0].reason, /^ref names chapter 9 but sits in the chapter 8 file$/);
});

/* ── 3. What the audit must leave alone ──────────────────────────────────── */

test("auto records are not checked", () => {
  // The scanner rewrites them on every run, so they cannot go stale in the
  // sense this module means. Checking them would flood the report.
  const { checked, stale } = auditChapterRecords({
    chapter: 8,
    verses: verses([[3, "…because of self-protection."]]),
    records: [
      record({ ref: "Rom.8.3", text: "self-preservation", form: "x", status: "auto" }),
      { ref: "Rom.8.4", english: [{ text: "nowhere", n: 1 }], term: null },
    ],
  });

  assert.equal(checked, 0, "an auto or status-less record was checked");
  assert.deepEqual(stale, []);
});

test("rejected and no-rendering records are not checked", () => {
  // Both assert the ABSENCE of a rendering. A rejected record keeps the English
  // that was rejected, so re-checking it would report the false positive the
  // reviewer already dismissed; a no-rendering record has no span at all.
  const { checked, stale } = auditChapterRecords({
    chapter: 8,
    verses: verses([[12, "Family, we owe nothing."]]),
    records: [
      record({ ref: "Rom.8.12", text: "Family", form: "family", status: "rejected" }),
      record({ ref: "Rom.8.12", english: [], status: "no-rendering" }),
    ],
  });

  assert.equal(checked, 0);
  assert.deepEqual(stale, []);
});

/* ── 4. Shapes phase 2 will bring ────────────────────────────────────────── */

test("every span of a multi-span record is checked, and the record counts once", () => {
  // Phase 1 never emits english.length > 1, but the schema is many-to-many and
  // `checked` counts records rather than spans, so the report stays readable.
  const { checked, stale } = auditChapterRecords({
    chapter: 2,
    verses: verses([[12, "Torah is not torah."]]),
    records: [
      record({
        ref: "Rom.2.12",
        english: [
          { text: "Torah", n: 1 },
          { text: "covenant", n: 1 },
        ],
        form: "Torah",
      }),
    ],
  });

  assert.equal(checked, 1);
  assert.equal(stale.length, 1);
  assert.equal(stale[0].text, "covenant");
});

test("an empty or absent records array is handled", () => {
  assert.deepEqual(auditChapterRecords({ chapter: 1, verses: verses([]), records: [] }), {
    checked: 0,
    stale: [],
  });
  assert.deepEqual(auditChapterRecords({ chapter: 1, verses: verses([]) }), {
    checked: 0,
    stale: [],
  });
});
