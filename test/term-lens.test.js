// test/term-lens.test.js
//
// Unit tests for src/lib/term-lens.mjs — where, in one chapter, a gated
// alignment term sits in the text, so Study View can mark it. See that
// module's header: each mark is handed over as the kth plain case-insensitive
// occurrence of its text in the verse, so both the writer (review-core.mjs's
// computeOccurrenceN) and the reader (indexOf) agree on the same span.
//
// In-memory fixtures only, matching the style of test/alignment-merge.test.js,
// except where a real verse and a real alignment record are the point of the
// test (Mark 12:23, Romans 3:5) — those are read from the corpus by hand and
// pasted in literally, noted at each one.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  candidateStarts,
  locateSpan,
  occurrencesByChapter,
  renderingCounts,
  chapterMarks,
} from "../src/lib/term-lens.mjs";

/* ── candidateStarts ───────────────────────────────────────────────────── */

test("candidateStarts: every start index of an overlapping substring", () => {
  // "aa" inside "aaaa" starts at every position but the last: 0, 1, 2.
  assert.deepEqual(candidateStarts("aaaa", "aa"), [0, 1, 2]);
});

test("candidateStarts: case-insensitive", () => {
  assert.deepEqual(candidateStarts("Reawaken REAWAKEN", "reawaken"), [0, 9]);
});

test("candidateStarts: an empty needle returns no positions", () => {
  assert.deepEqual(candidateStarts("anything", ""), []);
});

/* ── locateSpan ────────────────────────────────────────────────────────── */

// The real Mark 12:23 verse text (splitChapterVerses on
// src/data/chapters/mark-12.json), which renders resurrection-reawakening
// twice in one sentence: the noun "reawakening" and the verb "reawaken".
const MARK_12_23 =
  "At the reawakening, when they reawaken, whose wife will she be since " +
  "all seven had her as a wife?”";

test("locateSpan: Mark 12:23 — n=2 for 'reawaken' resolves to the standalone verb, past the noun", () => {
  const at = locateSpan(MARK_12_23, { text: "reawaken", n: 2 }, "reawakening");
  assert.ok(at);
  assert.equal(at.start, MARK_12_23.indexOf("they reawaken") + 5);
  assert.equal(at.k, 1);
});

test("locateSpan: Mark 12:23 — 'reawakening' resolves to the noun", () => {
  const at = locateSpan(MARK_12_23, { text: "reawakening", n: 1 }, "reawakening");
  assert.ok(at);
  assert.equal(at.start, MARK_12_23.indexOf("reawakening"));
  assert.equal(at.k, 0);
});

test("locateSpan: Mark 12:23 — n=1 for 'reawaken' resolves INSIDE 'reawakening', not the standalone verb", () => {
  // Not standalone: computeOccurrenceN's form-pattern branch only recognizes
  // the whole word "reawakening" at this position, so a bare "reawaken" here
  // numbers as occurrence 1 — the same position the noun does, at k=0. The
  // verb only appears at n=2 (the case above), which is why a record meaning
  // the verb has to be written with n=2, not n=1.
  const at = locateSpan(MARK_12_23, { text: "reawaken", n: 1 }, "reawakening");
  assert.ok(at);
  assert.equal(at.start, MARK_12_23.indexOf("reawakening"));
  assert.equal(at.k, 0);
});

// The real Romans 3:5 verse text (splitChapterVerses on
// src/data/chapters/romans-3.json) and the real righteousness-justness
// record for Rom.3.5 (src/data/alignment/romans-3.json: english
// [{ text: "justness", n: 1 }], term.form "justness"). "justness" is
// occurrence 1 both inside "unjustness" and as the standalone word, which is
// the ambiguity locateSpan's whole-word preference exists to break.
const ROMANS_3_5 =
  "However, if our unjustness is set side-by-side with God’s justness, " +
  "what will we say? Not that the God who imposes anger is unjust, right? " +
  "(I say this in conformity with humanity.)";

test("locateSpan: Romans 3:5 — an ambiguous n=1 ('justness' inside 'unjustness' and standalone) picks the standalone word", () => {
  const at = locateSpan(ROMANS_3_5, { text: "justness", n: 1 }, "justness");
  assert.ok(at);
  const standaloneStart = ROMANS_3_5.indexOf("God’s justness") + "God’s ".length;
  assert.equal(at.start, standaloneStart);
  assert.equal(at.k, 1); // the "unjustness" substring is candidate k=0
});

test("locateSpan: a stale record (text no longer in the verse) returns null", () => {
  const at = locateSpan(MARK_12_23, { text: "nonexistent", n: 1 }, null);
  assert.equal(at, null);
});

/* ── occurrencesByChapter ──────────────────────────────────────────────── */

test("occurrencesByChapter: groups by 'bookKey-chapter'", () => {
  const gated = new Map([
    [
      "life-breath",
      new Map([
        [
          "life-breath",
          [
            { bookKey: "matthew", chapter: 1, verse: 1, record: { ref: "Matt.1.1" } },
            { bookKey: "matthew", chapter: 2, verse: 5, record: { ref: "Matt.2.5" } },
          ],
        ],
      ]),
    ],
  ]);
  const byChapter = occurrencesByChapter(gated);
  assert.deepEqual([...byChapter.keys()].sort(), ["matthew-1", "matthew-2"]);
  assert.deepEqual(byChapter.get("matthew-1"), [
    { id: "life-breath", form: "life-breath", verse: 1, record: { ref: "Matt.1.1" } },
  ]);
  assert.deepEqual(byChapter.get("matthew-2"), [
    { id: "life-breath", form: "life-breath", verse: 5, record: { ref: "Matt.2.5" } },
  ]);
});

/* ── renderingCounts ───────────────────────────────────────────────────── */

test("renderingCounts: per term, counts occurrences (records) not verses, most frequent first", () => {
  const gated = new Map([
    [
      "law-torah",
      new Map([
        // Two records at the same verse: counted as 2, not 1.
        ["Torah", [{ verse: 2, record: {} }, { verse: 2, record: {} }]],
        ["torah", [{ verse: 9, record: {} }]],
      ]),
    ],
  ]);
  const counts = renderingCounts(gated);
  assert.deepEqual(counts.get("law-torah"), [
    { form: "Torah", count: 2 },
    { form: "torah", count: 1 },
  ]);
});

/* ── chapterMarks ──────────────────────────────────────────────────────── */

test("chapterMarks: marks are sorted by (verse, start), and carry no `start` field", () => {
  const verses = new Map([
    [1, "First reawaken word."],
    [2, "Second reawaken word, reawaken again."],
  ]);
  const occurrences = [
    // Fed out of verse order on purpose.
    { id: "t", form: "reawaken", verse: 2, record: { ref: "X.1.2", english: [{ text: "reawaken", n: 2 }] } },
    { id: "t", form: "reawaken", verse: 1, record: { ref: "X.1.1", english: [{ text: "reawaken", n: 1 }] } },
  ];
  const { marks, unresolved } = chapterMarks(occurrences, verses);
  assert.deepEqual(unresolved, []);
  assert.deepEqual(marks, [
    { v: 1, text: "reawaken", k: 0, id: "t", form: "reawaken" },
    { v: 2, text: "reawaken", k: 1, id: "t", form: "reawaken" },
  ]);
  assert.ok(!("start" in marks[0]));
});

test("chapterMarks: a record whose verse is missing from the map goes to unresolved", () => {
  const verses = new Map([[1, "First reawaken word."]]);
  const occurrences = [
    { id: "t", form: "reawaken", verse: 5, record: { ref: "X.1.5", english: [{ text: "reawaken", n: 1 }] } },
  ];
  const { marks, unresolved } = chapterMarks(occurrences, verses);
  assert.deepEqual(marks, []);
  assert.deepEqual(unresolved, [{ ref: "X.1.5", text: "reawaken", n: 1 }]);
});

test("chapterMarks: a span that can't be located in its verse goes to unresolved", () => {
  const verses = new Map([[1, "No matching word here."]]);
  const occurrences = [
    { id: "t", form: null, verse: 1, record: { ref: "X.1.1", english: [{ text: "zzz", n: 1 }] } },
  ];
  const { marks, unresolved } = chapterMarks(occurrences, verses);
  assert.deepEqual(marks, []);
  assert.deepEqual(unresolved, [{ ref: "X.1.1", text: "zzz", n: 1 }]);
});

test("chapterMarks: several english spans on one record yield one mark per locatable span", () => {
  const verses = new Map([[1, "Grace and truth appear here."]]);
  const occurrences = [
    {
      id: "t",
      form: null,
      verse: 1,
      record: { ref: "X.1.1", english: [{ text: "Grace", n: 1 }, { text: "truth", n: 1 }] },
    },
  ];
  const { marks, unresolved } = chapterMarks(occurrences, verses);
  assert.deepEqual(unresolved, []);
  assert.deepEqual(marks, [
    { v: 1, text: "Grace", k: 0, id: "t", form: null },
    { v: 1, text: "truth", k: 0, id: "t", form: null },
  ]);
});

test("chapterMarks: a span with empty text is skipped, not counted as unresolved", () => {
  const verses = new Map([[1, "Some words here."]]);
  const occurrences = [
    {
      id: "t",
      form: null,
      verse: 1,
      record: { ref: "X.1.1", english: [{ text: "", n: 1 }, { text: "words", n: 1 }] },
    },
  ];
  const { marks, unresolved } = chapterMarks(occurrences, verses);
  assert.deepEqual(unresolved, []);
  assert.equal(marks.length, 1);
  assert.equal(marks[0].text, "words");
});
