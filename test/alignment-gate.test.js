// test/alignment-gate.test.js
//
// Unit tests for src/lib/alignment-gate.mjs — the display gate for the
// alignment dataset (src/data/alignment/): which records a reader may be
// shown, and which terms are reviewed enough to show at all. See that
// module's header for the publishing rule this pins down.
//
// In-memory fixtures only, matching the style of test/alignment-merge.test.js.

import { test } from "node:test";
import assert from "node:assert/strict";

import { verdict, gatedOccurrences } from "../src/lib/alignment-gate.mjs";

/* A minimal record builder, defaulting to a shown (confirmed) flesh-body
 * record shaped like a real entry in src/data/alignment/romans-8.json. */
function rec(overrides = {}) {
  return {
    ref: "Rom.8.3",
    english: [{ text: "self-preservation", n: 1 }],
    term: { greek: "sarx", traditional: "Flesh", glossary: "flesh-body", form: "self-preservation" },
    confidence: null,
    lemma: "present",
    source: "review",
    status: "confirmed",
    ...overrides,
  };
}

/* ── verdict ───────────────────────────────────────────────────────────── */

test("verdict: rejected and no-rendering are ignored, regardless of confidence", () => {
  assert.equal(verdict(rec({ status: "rejected", confidence: "distinctive" })), null);
  assert.equal(verdict(rec({ status: "no-rendering", confidence: "distinctive" })), null);
});

test("verdict: lemma absent is ignored whatever the status", () => {
  assert.equal(verdict(rec({ status: "confirmed", lemma: "absent" })), null);
  assert.equal(verdict(rec({ status: "auto", confidence: "distinctive", lemma: "absent" })), null);
  const noStatus = rec({ lemma: "absent" });
  delete noStatus.status;
  assert.equal(verdict(noStatus), null);
});

test("verdict: confirmed always shows, regardless of confidence", () => {
  assert.equal(verdict(rec({ status: "confirmed", confidence: null })), "show");
  assert.equal(verdict(rec({ status: "confirmed", confidence: "common" })), "show");
});

test("verdict: auto shows only when confidence is distinctive, otherwise withholds", () => {
  assert.equal(verdict(rec({ status: "auto", confidence: "distinctive" })), "show");
  assert.equal(verdict(rec({ status: "auto", confidence: "common" })), "withhold");
});

test("verdict: a missing status counts as auto", () => {
  const distinctive = rec({ confidence: "distinctive" });
  delete distinctive.status;
  assert.equal(verdict(distinctive), "show");

  const common = rec({ confidence: "common" });
  delete common.status;
  assert.equal(verdict(common), "withhold");
});

/* ── gatedOccurrences ──────────────────────────────────────────────────── */

test("gatedOccurrences: groups by term.form, not by the written text ('Life-breath' and 'life-breath' share a form)", () => {
  const term = { greek: "nephesh", traditional: "Life-breath", glossary: "life-breath", form: "life-breath" };
  const files = [
    {
      bookKey: "matthew",
      chapter: 1,
      records: [
        rec({ ref: "Matt.1.1", english: [{ text: "Life-breath", n: 1 }], term }),
        rec({ ref: "Matt.1.2", english: [{ text: "life-breath", n: 1 }], term }),
      ],
    },
  ];
  const gated = gatedOccurrences(files);
  const forms = gated.get("life-breath");
  assert.equal(forms.size, 1);
  assert.equal(forms.get("life-breath").length, 2);
});

test("gatedOccurrences: a single withhold record anywhere drops the whole term, even across different files", () => {
  const term = { greek: "sarx", traditional: "Flesh", glossary: "flesh-body", form: "family" };
  const files = [
    {
      bookKey: "mark",
      chapter: 10,
      records: [rec({ ref: "Mark.10.8", english: [{ text: "family", n: 1 }], term, status: "confirmed" })],
    },
    {
      bookKey: "romans",
      chapter: 8,
      records: [
        rec({ ref: "Rom.8.12", english: [{ text: "Family", n: 1 }], term, status: "auto", confidence: "common" }),
      ],
    },
  ];
  const gated = gatedOccurrences(files);
  assert.equal(gated.has("flesh-body"), false);
});

test("gatedOccurrences: ignored records (rejected / no-rendering / lemma absent) neither count nor withhold", () => {
  const term = { greek: "sarx", traditional: "Flesh", glossary: "flesh-body", form: "family" };
  const files = [
    {
      bookKey: "mark",
      chapter: 10,
      records: [
        rec({ ref: "Mark.10.8", english: [{ text: "family", n: 1 }], term, status: "confirmed" }),
        rec({ ref: "Mark.10.9", english: [{ text: "Family", n: 1 }], term, status: "rejected" }),
        rec({
          ref: "Mark.10.10",
          english: [],
          term: { ...term, form: null },
          status: "no-rendering",
        }),
        rec({ ref: "Mark.10.11", english: [{ text: "family", n: 1 }], term, status: "auto", lemma: "absent" }),
      ],
    },
  ];
  const gated = gatedOccurrences(files);
  const forms = gated.get("flesh-body");
  // The term still publishes (nothing withheld it), and only the confirmed
  // record is counted.
  assert.equal(forms.size, 1);
  assert.equal(forms.get("family").length, 1);
});

test("gatedOccurrences: a term whose only shown record has no term.form is left out entirely", () => {
  const files = [
    {
      bookKey: "mark",
      chapter: 10,
      records: [
        rec({
          ref: "Mark.10.8",
          english: [{ text: "family", n: 1 }],
          term: { greek: "sarx", traditional: "Flesh", glossary: "flesh-body", form: null },
          status: "confirmed",
        }),
      ],
    },
  ];
  const gated = gatedOccurrences(files);
  assert.equal(gated.has("flesh-body"), false);
});

test("gatedOccurrences: a term whose only records are no-rendering is left out entirely", () => {
  const files = [
    {
      bookKey: "mark",
      chapter: 10,
      records: [
        rec({
          ref: "Mark.10.8",
          english: [],
          term: { greek: "sarx", traditional: "Flesh", glossary: "flesh-body", form: null },
          status: "no-rendering",
        }),
      ],
    },
  ];
  const gated = gatedOccurrences(files);
  assert.equal(gated.has("flesh-body"), false);
});

test("gatedOccurrences: a record with no term.glossary is skipped entirely", () => {
  const files = [
    {
      bookKey: "mark",
      chapter: 10,
      records: [rec({ term: null, status: "confirmed" })],
    },
  ];
  const gated = gatedOccurrences(files);
  assert.equal(gated.size, 0);
});

test("gatedOccurrences: verse is parsed from the last dot-segment of ref", () => {
  const files = [
    {
      bookKey: "1corinthians",
      chapter: 10,
      records: [rec({ ref: "1Cor.10.5" })],
    },
  ];
  const gated = gatedOccurrences(files);
  const occ = gated.get("flesh-body").get("self-preservation")[0];
  assert.equal(occ.verse, 5);
  assert.equal(occ.bookKey, "1corinthians");
  assert.equal(occ.chapter, 10);
});

test("gatedOccurrences: preserves input order within a form", () => {
  const term = { greek: "sarx", traditional: "Flesh", glossary: "flesh-body", form: "family" };
  const files = [
    {
      bookKey: "mark",
      chapter: 10,
      records: [
        rec({ ref: "Mark.10.9", english: [{ text: "family", n: 1 }], term, status: "confirmed" }),
        rec({ ref: "Mark.10.8", english: [{ text: "family", n: 1 }], term, status: "confirmed" }),
      ],
    },
  ];
  const gated = gatedOccurrences(files);
  const list = gated.get("flesh-body").get("family");
  assert.deepEqual(
    list.map((o) => o.verse),
    [9, 8], // input order, not sorted by verse
  );
});

test("gatedOccurrences: a file with no `records` field is tolerated", () => {
  const files = [
    { bookKey: "mark", chapter: 10 }, // no records at all
    { bookKey: "romans", chapter: 8, records: [rec({ ref: "Rom.8.3" })] },
  ];
  const gated = gatedOccurrences(files);
  assert.equal(gated.get("flesh-body").get("self-preservation").length, 1);
});
