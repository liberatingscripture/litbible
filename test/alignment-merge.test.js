// test/alignment-merge.test.js
//
// Unit tests for scripts/lib/alignment-merge.mjs — record identity, merge, and
// ordering for src/data/alignment/. Run with `npm test` (node --test test/).
// No fs, no disk fixtures: every case is a small hand-written record shaped
// like the real files (see src/data/alignment/romans-8.json), mirroring the
// in-memory-fixture style of test/draft-release-notes.test.js.
//
// These files are the one generated artifact in the repo that is COMMITTED,
// because it carries human review state (see the module's own header). So the
// merge rules ARE the contract between build-alignment.mjs (the scanner) and
// scripts/alignment-review/ (a human) — these tests pin the rules down, with
// particular attention to the bugs that motivated them.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  recordKey,
  sortRecords,
  mergeScanWithExisting,
  applyReviewDecision,
  rejectRecordsByKey,
} from "../scripts/lib/alignment-merge.mjs";

/* ── Fixture builder ──────────────────────────────────────────────────────
 * A minimal scanner-shaped record (see build-alignment.mjs's push() and any
 * record in src/data/alignment/romans-8.json). Defaults are Rom.8.3
 * flesh-body/"self-preservation" n:1 — the same span build-alignment.mjs
 * actually emits — with overrides for whatever a test needs to vary. */
function rec(overrides = {}) {
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

/* ── 1. recordKey ─────────────────────────────────────────────────────── */

test("recordKey: a normal scan record keys as ref|glossary|text-lower|n", () => {
  assert.equal(recordKey(rec()), "Rom.8.3|flesh-body|self-preservation|1");
});

test("recordKey: a no-rendering record (english: [], term.form: null) does not throw, and keys as ref|glossary||0", () => {
  // Regression: before recordKey was hardened, a no-rendering record made
  // readExisting() throw, the error was swallowed, and every preserved review
  // status in that chapter's file silently vanished on the next scan.
  const noRendering = {
    ref: "Rom.8.12",
    english: [],
    greek: [],
    term: { greek: "sarx", traditional: "Flesh", glossary: "flesh-body", form: null },
    confidence: null,
    lemma: "present",
    source: "review",
    status: "no-rendering",
  };
  assert.doesNotThrow(() => recordKey(noRendering));
  assert.equal(recordKey(noRendering), "Rom.8.12|flesh-body||0");
});

test("recordKey: 'Torah' and 'torah' at the same n collide — case-insensitive by design", () => {
  const upper = rec({ term: { greek: "nomos", traditional: "Law", glossary: "law-torah", form: "Torah" }, english: [{ text: "Torah", n: 1 }] });
  const lower = rec({ term: { greek: "nomos", traditional: "Law", glossary: "law-torah", form: "Torah" }, english: [{ text: "torah", n: 1 }] });
  assert.equal(recordKey(upper), recordKey(lower));
});

test("recordKey: tolerates term: null", () => {
  const record = { ref: "Rom.8.1", english: [{ text: "foo", n: 1 }], term: null };
  assert.equal(recordKey(record), "Rom.8.1||foo|1");
});

/* ── 2. sortRecords ───────────────────────────────────────────────────── */

test("sortRecords: orders by verse, then glossary id, then english text (case-insensitive), then n", () => {
  const A = rec(); // Rom.8.3, flesh-body, "self-preservation", n1
  const B = rec({
    term: { greek: "nomos", traditional: "Law", glossary: "law-torah", form: "Torah" },
    english: [{ text: "Torah", n: 1 }],
  });
  const C = rec({
    term: { greek: "nomos", traditional: "Law", glossary: "law-torah", form: "Torah" },
    english: [{ text: "torah", n: 2 }],
  });
  const D = rec({ ref: "Rom.8.9" });
  // Scrambled input; expected: verse 3 before verse 9; within verse 3,
  // "flesh-body" before "law-torah"; within "law-torah", same text
  // case-folded ("torah") so n breaks the tie.
  assert.deepEqual(sortRecords([D, C, A, B]), [A, B, C, D]);
});

test("sortRecords: order does not depend on source or status — a review record and a scan record sort identically whichever order they went in", () => {
  // This invariant exists so a review session doesn't churn the file's git
  // diff: only (verse, glossary, text, n) determine position, never how the
  // record was produced.
  const reviewed = rec({ ref: "Rom.8.20", source: "review", status: "confirmed" });
  const scanned = rec({ ref: "Rom.8.3", source: "glossary-scan", status: "auto" });
  const sortedA = sortRecords([reviewed, scanned]);
  const sortedB = sortRecords([scanned, reviewed]);
  assert.deepEqual(sortedA, sortedB);
  assert.deepEqual(sortedA, [scanned, reviewed]); // verse 3 before verse 20
});

/* ── 3. mergeScanWithExisting ─────────────────────────────────────────── */

test("mergeScanWithExisting: a scan record matching an existing auto record — the fresh record wins", () => {
  const prev = rec({ lemma: "unchecked", status: "auto" });
  const fresh = rec({ lemma: "present", status: "auto" });
  const { records, preserved } = mergeScanWithExisting({
    scanned: [fresh],
    existing: new Map([[recordKey(prev), prev]]),
    corpusAvailable: true,
  });
  assert.deepEqual(records, [fresh]);
  assert.equal(preserved, 0);
});

test("mergeScanWithExisting: a scan record matching an existing confirmed record keeps the WHOLE prior record", () => {
  // Regression: the old code donated only status/greek onto the fresh record
  // and dropped everything else, silently discarding a hand-edited term.form
  // (and any phase-2 greek array) the scanner has no way to re-derive.
  const prev = rec({
    term: { greek: "sarx", traditional: "Flesh", glossary: "flesh-body", form: "HAND-EDITED-FORM" },
    greek: [{ t: 12, form: "σαρκὸς" }],
    status: "confirmed",
  });
  const fresh = rec({
    term: { greek: "sarx", traditional: "Flesh", glossary: "flesh-body", form: "self-preservation" },
    status: "auto",
  });
  const { records, preserved } = mergeScanWithExisting({
    scanned: [fresh],
    existing: new Map([[recordKey(prev), prev]]), // same key: term.form isn't part of recordKey
    corpusAvailable: true,
  });
  assert.deepEqual(records, [prev]);
  assert.equal(records[0].term.form, "HAND-EDITED-FORM");
  assert.deepEqual(records[0].greek, [{ t: 12, form: "σαρκὸς" }]);
  assert.equal(preserved, 1);
});

test("mergeScanWithExisting: an existing review record with no scan counterpart is carried forward, and counted in `carried`", () => {
  // The central bug fix this module exists for: a review record for a
  // rendering the scanner structurally cannot rediscover (the glossary
  // doesn't list it, or it's a "no distinct rendering here" verdict) must
  // survive a rescan that produces no matching record at all.
  const reviewOnly = rec({ ref: "Rom.8.20", source: "review", status: "confirmed" });
  const { records, carried, preserved, stale } = mergeScanWithExisting({
    scanned: [],
    existing: new Map([[recordKey(reviewOnly), reviewOnly]]),
    corpusAvailable: true,
  });
  assert.deepEqual(records, [reviewOnly]);
  assert.equal(carried, 1);
  assert.equal(preserved, 0);
  assert.deepEqual(stale, []);
});

test("mergeScanWithExisting: a confirmed glossary-scan record with no scan counterpart is dropped and reported in `stale`", () => {
  const prev = rec({ source: "glossary-scan", status: "confirmed" });
  const { records, stale, carried } = mergeScanWithExisting({
    scanned: [],
    existing: new Map([[recordKey(prev), prev]]),
    corpusAvailable: true,
  });
  assert.deepEqual(records, []);
  assert.deepEqual(stale, [{ key: recordKey(prev), record: prev }]);
  assert.equal(carried, 0);
});

test("mergeScanWithExisting: an auto glossary-scan record with no scan counterpart is dropped silently — stale stays empty", () => {
  const prev = rec({ source: "glossary-scan", status: "auto" });
  const { records, stale } = mergeScanWithExisting({
    scanned: [],
    existing: new Map([[recordKey(prev), prev]]),
    corpusAvailable: true,
  });
  assert.deepEqual(records, []);
  assert.deepEqual(stale, []);
});

test("mergeScanWithExisting: corpusAvailable false carries the prior record's lemma onto the fresh record; corpusAvailable true does not", () => {
  const prev = rec({ lemma: "present", status: "auto" });

  const noCorpus = mergeScanWithExisting({
    scanned: [rec({ lemma: "unchecked", status: "auto" })],
    existing: new Map([[recordKey(prev), prev]]),
    corpusAvailable: false,
  });
  assert.equal(noCorpus.records[0].lemma, "present"); // carried from prev, not left "unchecked"

  const withCorpus = mergeScanWithExisting({
    scanned: [rec({ lemma: "unchecked", status: "auto" })],
    existing: new Map([[recordKey(prev), prev]]),
    corpusAvailable: true,
  });
  assert.equal(withCorpus.records[0].lemma, "unchecked"); // fresh wins, not overwritten by prev
});

test("mergeScanWithExisting: output is sorted (sortRecords applied to the merge result)", () => {
  const late = rec({ ref: "Rom.8.9" });
  const early = rec({ ref: "Rom.8.3" });
  const { records } = mergeScanWithExisting({
    scanned: [late, early], // fed out of order
    existing: new Map(),
    corpusAvailable: true,
  });
  assert.deepEqual(records, [early, late]);
});

/* ── 4. applyReviewDecision ───────────────────────────────────────────── */

test("applyReviewDecision: replaces every prior record for (ref, glossary) and leaves other verses and other terms untouched", () => {
  const target = rec(); // Rom.8.3, flesh-body — the slot being replaced
  const otherVerse = rec({ ref: "Rom.8.9" }); // same term, different verse
  const otherTerm = rec({
    term: { greek: "nomos", traditional: "Law", glossary: "law-torah", form: "Torah" },
    english: [{ text: "Torah", n: 1 }],
  }); // same verse, different term
  const replacement = rec({
    term: { greek: "sarx", traditional: "Flesh", glossary: "flesh-body", form: "family" },
    english: [{ text: "family", n: 1 }],
    source: "review",
    status: "confirmed",
  });

  const result = applyReviewDecision({
    existingRecords: [target, otherVerse, otherTerm],
    ref: "Rom.8.3",
    termGlossary: "flesh-body",
    records: [replacement],
  });

  assert.equal(result.length, 3);
  assert.ok(result.includes(replacement));
  assert.ok(result.includes(otherVerse));
  assert.ok(result.includes(otherTerm));
  assert.ok(!result.includes(target));
});

test("applyReviewDecision: passing two records writes both — the two-renderings-in-one-verse case", () => {
  const original = rec({ english: [{ text: "self-preservation", n: 1 }] });
  const first = rec({ english: [{ text: "self-preservation", n: 1 }], source: "review", status: "confirmed" });
  const second = rec({ english: [{ text: "flesh", n: 1 }], source: "review", status: "confirmed" });

  const result = applyReviewDecision({
    existingRecords: [original],
    ref: "Rom.8.3",
    termGlossary: "flesh-body",
    records: [first, second],
  });

  assert.equal(result.length, 2);
  assert.ok(result.includes(first));
  assert.ok(result.includes(second));
});

test("applyReviewDecision: records: [] clears the slot", () => {
  const target = rec();
  const result = applyReviewDecision({
    existingRecords: [target],
    ref: "Rom.8.3",
    termGlossary: "flesh-body",
    records: [],
  });
  assert.deepEqual(result, []);
});

/* ── 5. rejectRecordsByKey ────────────────────────────────────────────── */

test("rejectRecordsByKey: flips only the listed keys to status: rejected and returns the right changed count", () => {
  const a = rec({ ref: "Rom.8.3" });
  const b = rec({ ref: "Rom.8.9" });
  const c = rec({ ref: "Rom.8.12", english: [{ text: "family", n: 1 }] }); // not targeted

  const { records, changed } = rejectRecordsByKey({
    existingRecords: [a, b, c],
    keys: [recordKey(a), recordKey(b)],
  });

  assert.equal(changed, 2);
  assert.equal(records.find((r) => r.ref === "Rom.8.3").status, "rejected");
  assert.equal(records.find((r) => r.ref === "Rom.8.9").status, "rejected");
  assert.equal(records.find((r) => r.ref === "Rom.8.12").status, "auto");
});

test("rejectRecordsByKey: an already-rejected record is not double-counted", () => {
  const already = rec({ status: "rejected" });
  const { records, changed } = rejectRecordsByKey({
    existingRecords: [already],
    keys: [recordKey(already)],
  });
  assert.equal(changed, 0);
  assert.equal(records[0].status, "rejected");
});

test("rejectRecordsByKey: does not mutate the input records", () => {
  const original = rec({ status: "auto" });
  rejectRecordsByKey({ existingRecords: [original], keys: [recordKey(original)] });
  assert.equal(original.status, "auto"); // the returned array holds a new object, not this one
});
