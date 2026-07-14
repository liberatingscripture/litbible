// test/search-core.test.js
//
// Unit tests for src/scripts/search-core.js — the shared search logic used
// by both the SearchBar tray and the /search page. Run with `npm test`
// (node --test test/). No fetch, no disk fixtures: the verse-index tests
// build a tiny in-memory corpus with the same shape loadVerseIndex produces.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseReference,
  parseBookOnly,
  parseReferenceJump,
  formatReferenceLabel,
  makeStudyReferenceHref,
  buildPfQuery,
  searchVerses,
  rankVerseHits,
  highlightVerseHit,
} from "../src/scripts/search-core.js";
import { stemWord } from "../src/lib/word-stem.mjs";

/** Mirrors how loadVerseIndex groups the corpus vocabulary by stem, so
 * related-form expansion in tests runs against the REAL stemmer. */
function makeIndex(verses, vocab = []) {
  const formsByStem = new Map();
  for (const w of vocab) {
    const stem = stemWord(w);
    if (!formsByStem.has(stem)) formsByStem.set(stem, []);
    formsByStem.get(stem).push(w);
  }
  return { verses, vocab, formsByStem };
}

/* ── 1. Reference + book-alias parsing ───────────────────────────────── */

test("parseReference: 'John 3:16' resolves book, chapter, verse", () => {
  assert.deepEqual(parseReference("John 3:16"), {
    bookKey: "john",
    chapter: 3,
    verse: 16,
    rangeEnd: null,
  });
});

test("parseReference: '1 cor 13' resolves numbered-book alias, chapter-only", () => {
  assert.deepEqual(parseReference("1 cor 13"), {
    bookKey: "1corinthians",
    chapter: 13,
    verse: null,
    rangeEnd: null,
  });
});

test("parseReference: 'jn 3:16-18' resolves a verse range", () => {
  const ref = parseReference("jn 3:16-18");
  assert.equal(ref.bookKey, "john");
  assert.equal(ref.chapter, 3);
  assert.equal(ref.verse, 16);
  assert.equal(ref.rangeEnd, 18);
});

test("parseReference: 'genesis 1:1' returns null (not a NT book)", () => {
  assert.equal(parseReference("genesis 1:1"), null);
});

test("parseReference: 'John' returns null (no chapter)", () => {
  assert.equal(parseReference("John"), null);
});

test("parseReference: reversed range 'john 3:18-16' drops rangeEnd (end must be > start)", () => {
  const ref = parseReference("john 3:18-16");
  assert.equal(ref.bookKey, "john");
  assert.equal(ref.chapter, 3);
  assert.equal(ref.verse, 18);
  assert.equal(ref.rangeEnd, null);
});

test("parseBookOnly: 'Romans' resolves the plain book name", () => {
  assert.deepEqual(parseBookOnly("Romans"), { bookKey: "romans" });
});

test("parseBookOnly: '1 Jn' resolves a numbered-book alias", () => {
  assert.deepEqual(parseBookOnly("1 Jn"), { bookKey: "1john" });
});

test("parseReferenceJump: a verse reference yields kind 'ref'", () => {
  assert.deepEqual(parseReferenceJump("John 3:16"), {
    kind: "ref",
    bookKey: "john",
    chapter: 3,
    verse: 16,
    rangeEnd: null,
  });
});

test("parseReferenceJump: a book-only query yields kind 'book'", () => {
  assert.deepEqual(parseReferenceJump("Romans"), {
    kind: "book",
    bookKey: "romans",
  });
});

test("parseReferenceJump: an unresolvable query returns null", () => {
  assert.equal(parseReferenceJump("qwerty"), null);
});

/* ── 2. Verse-index scanning (searchVerses) ──────────────────────────── */

test("searchVerses: matches whole words only, not substrings", () => {
  const idx = makeIndex({ john: { 3: ["For God so loved the world"] } });
  assert.equal(searchVerses(idx, "world").hits.length, 1);
  assert.equal(searchVerses(idx, "wor").hits.length, 0);
});

test("searchVerses: a multi-word query matches consecutive tokens as a phrase", () => {
  const idx = makeIndex({ john: { 3: ["For God so loved the world"] } });
  assert.equal(searchVerses(idx, "god so loved").hits.length, 1);
  assert.equal(searchVerses(idx, "so god").hits.length, 0);
});

test("searchVerses: hyphens act as word boundaries", () => {
  const idx = makeIndex({ john: { 1: ["the well-known truth"] } });
  assert.equal(searchVerses(idx, "well").hits.length, 1);
  assert.equal(searchVerses(idx, "wellknown").hits.length, 0);
});

test("searchVerses: diacritics are folded for matching", () => {
  const idx = makeIndex({
    matthew: { 27: ["Elí Elí lemá sabachthani"] },
  });
  // "lema" is 4 chars, so this is an exact whole-word match after folding
  // ("lemá" -> "lema"), independent of related-form expansion.
  assert.equal(searchVerses(idx, "lema").hits.length, 1);
});

test("searchVerses: a single 5+ char token expands to its related forms", () => {
  assert.equal(stemWord("liberation"), stemWord("liberate"));

  const idx = makeIndex(
    { luke: { 4: ["proclaim liberate to the captives"] } },
    ["liberation", "liberate"],
  );
  const { hits } = searchVerses(idx, "liberation");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].bookKey, "luke");
  // Matched via the related form, not the token as typed.
  assert.equal(hits[0].exactRuns, 0);
});

test("searchVerses: the bookKey option scopes the scan to one book", () => {
  const idx = makeIndex({
    john: { 10: ["the good shepherd"] },
    mark: { 6: ["shepherd compassion"] },
  });
  assert.equal(searchVerses(idx, "shepherd").hits.length, 2);
  const scoped = searchVerses(idx, "shepherd", { bookKey: "john" });
  assert.equal(scoped.hits.length, 1);
  assert.equal(scoped.hits[0].bookKey, "john");
});

/* ── 3. rankVerseHits ordering ────────────────────────────────────────── */

test("rankVerseHits: exact-form hits outrank related-form-only hits, even with fewer runs", () => {
  const relatedOnly = { id: "related", exactRuns: 0, runs: [{}, {}, {}] };
  const exact = { id: "exact", exactRuns: 1, runs: [{}] };
  const ranked = rankVerseHits([relatedOnly, exact]);
  assert.deepEqual(
    ranked.map((h) => h.id),
    ["exact", "related"],
  );
});

test("rankVerseHits: among equal exactness, more runs outranks fewer", () => {
  const fewer = { id: "fewer", exactRuns: 1, runs: [{}] };
  const more = { id: "more", exactRuns: 1, runs: [{}, {}] };
  const ranked = rankVerseHits([fewer, more]);
  assert.deepEqual(
    ranked.map((h) => h.id),
    ["more", "fewer"],
  );
});

test("rankVerseHits: ties preserve input (Bible) order", () => {
  const first = { id: "first", exactRuns: 1, runs: [{}] };
  const second = { id: "second", exactRuns: 1, runs: [{}] };
  const ranked = rankVerseHits([first, second]);
  assert.deepEqual(
    ranked.map((h) => h.id),
    ["first", "second"],
  );
});

test("rankVerseHits: returns a new array and does not mutate the input", () => {
  const a = { id: "a", exactRuns: 0, runs: [{}] };
  const b = { id: "b", exactRuns: 1, runs: [{}] };
  const input = [a, b];
  const ranked = rankVerseHits(input);
  assert.notEqual(ranked, input);
  assert.deepEqual(
    input.map((h) => h.id),
    ["a", "b"],
  );
});

/* ── 4. nearestVocabWord conservatism (via searchVerses.correction) ──── */

test("searchVerses: corrects a genuine typo to the nearest vocab word", () => {
  const idx = makeIndex({ john: { 2: ["went up to jerusalem"] } }, [
    "jerusalem",
  ]);
  const { hits, correction } = searchVerses(idx, "jeribulem");
  assert.equal(correction, "jerusalem");
  assert.ok(hits.length >= 1);
});

test("searchVerses: does not correct an explicitly quoted token", () => {
  const idx = makeIndex({ john: { 2: ["went up to jerusalem"] } }, [
    "jerusalem",
  ]);
  const { hits, correction } = searchVerses(idx, '"jeribulem"');
  assert.equal(correction, "");
  assert.equal(hits.length, 0);
});

test("searchVerses: does not correct a short (<=4 char) token", () => {
  const idx = makeIndex({ john: { 1: ["God is love"] } }, ["love"]);
  const { hits, correction } = searchVerses(idx, "lofe");
  assert.equal(correction, "");
  assert.equal(hits.length, 0);
});

test("searchVerses: refuses to correct when no vocab word is close enough", () => {
  const idx = makeIndex({ mark: { 1: ["welcome the foreigners"] } }, [
    "foreigners",
  ]);
  const { hits, correction } = searchVerses(idx, "forgivness");
  assert.equal(correction, "");
  assert.equal(hits.length, 0);
});

/* ── 5. Adjacent core helpers ─────────────────────────────────────────── */

test("buildPfQuery: a multi-word query becomes an exact phrase", () => {
  assert.deepEqual(buildPfQuery("god so"), {
    pfQuery: '"god so"',
    exactSingleToken: false,
    exactToken: "",
  });
});

test("buildPfQuery: a short (1-4 char) token is quoted for exact matching", () => {
  assert.deepEqual(buildPfQuery("god"), {
    pfQuery: '"god"',
    exactSingleToken: true,
    exactToken: "god",
  });
});

test("buildPfQuery: a 5+ char token passes through unquoted", () => {
  assert.deepEqual(buildPfQuery("grace"), {
    pfQuery: "grace",
    exactSingleToken: false,
    exactToken: "",
  });
});

test("buildPfQuery: an explicitly quoted query stays exact", () => {
  assert.deepEqual(buildPfQuery('"grace"'), {
    pfQuery: '"grace"',
    exactSingleToken: true,
    exactToken: "grace",
  });
});

test("formatReferenceLabel: formats a verse reference", () => {
  assert.equal(
    formatReferenceLabel({
      bookKey: "john",
      chapter: 3,
      verse: 16,
      rangeEnd: null,
    }),
    "John 3:16",
  );
});

test("formatReferenceLabel: formats a verse range with an en dash", () => {
  assert.equal(
    formatReferenceLabel({
      bookKey: "john",
      chapter: 3,
      verse: 16,
      rangeEnd: 18,
    }),
    "John 3:16–18",
  );
});

test("makeStudyReferenceHref: builds a Study View deep link", () => {
  assert.equal(
    makeStudyReferenceHref({
      bookKey: "john",
      chapter: 3,
      verse: 16,
      rangeEnd: null,
    }),
    "/john-3#v16",
  );
});

test("makeStudyReferenceHref: builds a ranged deep link", () => {
  assert.equal(
    makeStudyReferenceHref({
      bookKey: "john",
      chapter: 3,
      verse: 16,
      rangeEnd: 18,
    }),
    "/john-3#v16-18",
  );
});

test("highlightVerseHit: wraps the matched run in <mark>", () => {
  assert.equal(
    highlightVerseHit({ text: "God so loved", runs: [{ start: 0, end: 3 }] }),
    "<mark>God</mark> so loved",
  );
});

test("highlightVerseHit: escapes HTML in the verse text", () => {
  assert.equal(highlightVerseHit({ text: "1 < 2", runs: [] }), "1 &lt; 2");
});
