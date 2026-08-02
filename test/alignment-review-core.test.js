// test/alignment-review-core.test.js
//
// Unit tests for scripts/alignment-review/review-core.mjs — the pure logic
// behind the alignment review tool (see its header for the inversion it
// implements: seeding the queue from the Greek lemma, not the English scan).
// Run with `npm test` (node --test test/). No fs, no disk fixtures: every
// case is a small hand-written verse/record, mirroring the in-memory-fixture
// style of test/draft-release-notes.test.js.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  tokenizeWords,
  computeOccurrenceN,
  buildAutoProposal,
  versesInScopeForTerm,
  buildConfirmRecord,
  buildNoRenderingRecord,
  reconcileConfirmations,
  isDecided,
  progressForTerm,
  groupAbsentRecordsByPattern,
} from "../scripts/alignment-review/review-core.mjs";
import { recordKey } from "../scripts/lib/alignment-merge.mjs";
import { findFormMatches } from "../scripts/lib/alignment-forms.mjs";

/* ── Fixture builder ──────────────────────────────────────────────────────
 * A minimal scanner-shaped record (see build-alignment.mjs's push() and any
 * record in src/data/alignment/romans-8.json), for the tests that need to
 * simulate what's already on disk when the review tool runs. */
function scanRecord(overrides = {}) {
  return {
    ref: "Rom.8.3",
    english: [{ text: "self-preservation", n: 1 }],
    greek: [],
    term: { greek: "sarx", traditional: "Flesh", glossary: "flesh-body", form: "self-preservation" },
    confidence: "distinctive",
    lemma: "present",
    source: "glossary-scan",
    status: "auto",
    ...overrides,
  };
}

/* ── 1. tokenizeWords ─────────────────────────────────────────────────── */

test("tokenizeWords: offsets index correctly into the source string", () => {
  const text = "For God so loved the world.";
  const words = tokenizeWords(text);
  assert.deepEqual(words.map((w) => w.text), ["For", "God", "so", "loved", "the", "world"]);
  for (const w of words) assert.equal(text.slice(w.start, w.end), w.text);
});

test("tokenizeWords: hyphens and apostrophes stay INSIDE a word — 'life-breath' and 'Yeshua's' are each one token", () => {
  const text = "the life-breath of Yeshua's promise";
  const words = tokenizeWords(text);
  assert.deepEqual(words.map((w) => w.text), ["the", "life-breath", "of", "Yeshua's", "promise"]);
});

/* ── 2. computeOccurrenceN ────────────────────────────────────────────── */

test("computeOccurrenceN: agrees with findFormMatches numbering for every occurrence of a form", () => {
  // Load-bearing: `n` is part of a record's identity key (recordKey), so a
  // review record that numbered a span differently than the scanner would key
  // differently and duplicate the scanner's record for the same span on the
  // next rescan, instead of merging with it.
  const verseText = "Life-breath moves here, and life-breath moves there, and Life-breath sings.";
  const form = "life-breath";
  const matches = findFormMatches(verseText, form);
  assert.equal(matches.length, 3);
  for (const m of matches) {
    assert.equal(computeOccurrenceN({ verseText, form, text: m.text, start: m.start }), m.n);
  }
});

test("computeOccurrenceN: plural tail — 'life-breath' then 'life-breaths' number 1 and 2", () => {
  const verseText = "One life-breath and many life-breaths.";
  const form = "life-breath";
  const matches = findFormMatches(verseText, form);
  assert.deepEqual(matches.map((m) => m.text), ["life-breath", "life-breaths"]);
  assert.equal(computeOccurrenceN({ verseText, form, text: matches[0].text, start: matches[0].start }), 1);
  assert.equal(computeOccurrenceN({ verseText, form, text: matches[1].text, start: matches[1].start }), 2);
});

test("computeOccurrenceN: fallback path — a span whose form does not pattern-match it still returns a stable 1-based count", () => {
  // A reviewer groups "transformation of the mind" under the glossary form
  // "reorienting the mind", which never appears verbatim in the verse — the
  // scanner could never emit this record, so there's nothing to collide with;
  // the count just needs to be stable across the two occurrences.
  const verseText = "There was transformation of the mind at first, and transformation of the mind again.";
  const form = "reorienting the mind"; // does not occur in verseText at all
  const text = "transformation of the mind";
  const firstStart = verseText.indexOf(text);
  const secondStart = verseText.indexOf(text, firstStart + 1);
  assert.equal(computeOccurrenceN({ verseText, form, text, start: firstStart }), 1);
  assert.equal(computeOccurrenceN({ verseText, form, text, start: secondStart }), 2);
});

/* ── 3. buildAutoProposal ─────────────────────────────────────────────── */

test("buildAutoProposal: returns the LONGEST matching form when forms is longest-first", () => {
  const verseText = "Have faithful trust in what is unseen.";
  const forms = ["faithful trust", "trust"]; // longest-first, as loadTerms sorts them
  const proposal = buildAutoProposal({ verseText, forms });
  assert.equal(proposal.form, "faithful trust");
  assert.equal(proposal.text, "faithful trust");
});

test("buildAutoProposal: returns null when nothing matches — the cold-start case", () => {
  const verseText = "Something else entirely.";
  const forms = ["faithful trust", "trust"];
  assert.equal(buildAutoProposal({ verseText, forms }), null);
});

/* ── 4. versesInScopeForTerm ──────────────────────────────────────────── */

test("versesInScopeForTerm: unions refs across multiple lemmas, dedupes, and excludes refs whose chapter isn't in publishedChapters", () => {
  const refsByLemma = new Map([
    ["l1", ["Rom.8.3", "Rom.8.4", "Rom.9.1"]],
    ["l2", ["Rom.8.4", "Rom.8.5"]],
  ]);
  const publishedChapters = new Set(["Rom.8"]); // Rom.9 is a draft — must not read as a gap
  const osisRank = new Map([["Rom", 0]]);
  const refs = versesInScopeForTerm({ lemmas: ["l1", "l2"], refsByLemma, publishedChapters, osisRank });
  assert.deepEqual(refs, ["Rom.8.3", "Rom.8.4", "Rom.8.5"]); // Rom.8.4 deduped, Rom.9.1 excluded
});

test("versesInScopeForTerm: canonical order via osisRank — across books, and numerically within a book (v.9 before v.10)", () => {
  const refsByLemma = new Map([["l1", ["Rom.8.10", "Rom.8.9", "Matt.5.1"]]]);
  const publishedChapters = new Set(["Rom.8", "Matt.5"]);
  const osisRank = new Map([
    ["Matt", 0],
    ["Rom", 1],
  ]);
  const refs = versesInScopeForTerm({ lemmas: ["l1"], refsByLemma, publishedChapters, osisRank });
  // A string sort would place "Rom.8.10" before "Rom.8.9" — assert it doesn't.
  assert.deepEqual(refs, ["Matt.5.1", "Rom.8.9", "Rom.8.10"]);
});

/* ── 5. buildConfirmRecord / buildNoRenderingRecord ───────────────────── */

// The scanner's own field order (see build-alignment.mjs's push()). These
// files are committed, so a reordering here would churn every diff.
const RECORD_KEY_ORDER = ["ref", "english", "greek", "term", "confidence", "lemma", "source", "status"];

test("buildConfirmRecord: exact shape, including confidence: null, source: review, status: confirmed", () => {
  const verseText = "For what the Torah could not do, weakened as it was by self-preservation, God did.";
  const span = { text: "self-preservation", start: verseText.indexOf("self-preservation") };
  const term = { greek: "sarx", traditional: "Flesh", id: "flesh-body" };
  const record = buildConfirmRecord({ ref: "Rom.8.3", term, span, verseText });
  assert.deepEqual(record, {
    ref: "Rom.8.3",
    english: [{ text: "self-preservation", n: 1 }],
    greek: [],
    term: { greek: "sarx", traditional: "Flesh", glossary: "flesh-body", form: "self-preservation" },
    confidence: null,
    lemma: "present",
    source: "review",
    status: "confirmed",
  });
  assert.deepEqual(Object.keys(record), RECORD_KEY_ORDER);
});

test("buildNoRenderingRecord: exact shape — english: [] and term.form: null", () => {
  const term = { greek: "sarx", traditional: "Flesh", id: "flesh-body" };
  const record = buildNoRenderingRecord({ ref: "Rom.8.20", term });
  assert.deepEqual(record, {
    ref: "Rom.8.20",
    english: [],
    greek: [],
    term: { greek: "sarx", traditional: "Flesh", glossary: "flesh-body", form: null },
    confidence: null,
    lemma: "present",
    source: "review",
    status: "no-rendering",
  });
  assert.deepEqual(Object.keys(record), RECORD_KEY_ORDER);
});

/* ── 6. reconcileConfirmations ────────────────────────────────────────── */

test("reconcileConfirmations: a collision with an existing scan record keeps the EXISTING record, just flips status to confirmed", () => {
  // So accepting the scanner's own proposal doesn't erase the fact that the
  // scanner found it: source stays "glossary-scan", confidence stays whatever
  // the scanner judged, not the review-built record's null.
  const existing = [scanRecord()]; // Rom.8.3, flesh-body, "self-preservation", n1, distinctive
  const built = [
    buildConfirmRecord({
      ref: "Rom.8.3",
      term: { greek: "sarx", traditional: "Flesh", id: "flesh-body" },
      span: { text: "self-preservation", start: 0 },
      verseText: "self-preservation only",
    }),
  ];
  const result = reconcileConfirmations({ existing, built, recordKey });
  assert.equal(result.length, 1);
  assert.equal(result[0].status, "confirmed");
  assert.equal(result[0].source, "glossary-scan");
  assert.equal(result[0].confidence, "distinctive");
});

test("reconcileConfirmations: a built record with no collision is returned as-is", () => {
  const built = [
    buildConfirmRecord({
      ref: "Rom.8.20",
      term: { greek: "sarx", traditional: "Flesh", id: "flesh-body" },
      span: { text: "family", start: 0 },
      verseText: "family only",
    }),
  ];
  const result = reconcileConfirmations({ existing: [], built, recordKey });
  assert.deepEqual(result, built);
  assert.equal(result[0], built[0]); // same object, not cloned
});

/* ── 7. isDecided / progressForTerm ───────────────────────────────────── */

test("isDecided: any non-auto record settles the (ref, term) pair", () => {
  assert.equal(isDecided([{ status: "auto" }]), false);
  assert.equal(isDecided([{ status: "confirmed" }]), true);
  assert.equal(isDecided([{ status: "no-rendering" }]), true);
  assert.equal(isDecided([]), false);
  assert.equal(isDecided(undefined), false);
});

test("progressForTerm: counts done/remaining across a queue; a ref absent from recordsByRef counts as not done", () => {
  const recordsByRef = new Map([
    ["Rom.8.3", [{ status: "auto" }]],
    ["Rom.8.9", [{ status: "confirmed" }]],
    ["Rom.8.12", [{ status: "no-rendering" }]],
    // "Rom.8.20" intentionally has no entry at all
  ]);
  const queue = ["Rom.8.3", "Rom.8.9", "Rom.8.12", "Rom.8.20"];
  assert.deepEqual(progressForTerm({ queue, recordsByRef }), { total: 4, done: 2, remaining: 2 });
});

/* ── 8. groupAbsentRecordsByPattern ───────────────────────────────────── */

test("groupAbsentRecordsByPattern: groups by (glossary, form) sorted largest first, ignoring non-absent and rejected records", () => {
  // Mirrors the real case: most flesh-body/"family" records are the same
  // mistake (vocative adelphoi read as sarx), so grouping turns them into one
  // decision; a differently-worded outlier under the same glossary id lands in
  // its own group instead of being folded in.
  const familyTerm = { greek: "sarx", traditional: "Flesh", glossary: "flesh-body", form: "family" };
  const outlierTerm = { greek: "sarx", traditional: "Flesh", glossary: "flesh-body", form: "self-preservation" };

  const family = [
    scanRecord({ ref: "Rom.8.12", english: [{ text: "Family", n: 1 }], term: familyTerm, lemma: "absent" }),
    scanRecord({ ref: "Rom.9.3", english: [{ text: "family", n: 1 }], term: familyTerm, lemma: "absent" }),
    scanRecord({ ref: "Rom.10.1", english: [{ text: "family", n: 1 }], term: familyTerm, lemma: "absent" }),
  ];
  const outlier = scanRecord({
    ref: "Luke.9.23",
    english: [{ text: "self-preservation", n: 1 }],
    term: outlierTerm,
    lemma: "absent",
  });
  const present = scanRecord({ ref: "Rom.8.4", term: familyTerm, lemma: "present" }); // not absent — must be ignored
  const rejected = scanRecord({ ref: "Rom.8.5", term: familyTerm, lemma: "absent", status: "rejected" }); // must be ignored

  const groups = groupAbsentRecordsByPattern([...family, outlier, present, rejected]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].id, "flesh-body|family");
  assert.equal(groups[0].records.length, 3);
  assert.equal(groups[1].id, "flesh-body|self-preservation");
  assert.equal(groups[1].records.length, 1);
});
