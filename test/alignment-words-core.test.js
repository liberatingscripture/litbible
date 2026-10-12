// test/alignment-words-core.test.js
//
// Unit tests for scripts/alignment-words/core.mjs, the pure layer of the
// word-alignment tool (alignment phase 2). In-memory fixtures only, in the
// style of test/alignment-review-core.test.js. The store and server are the
// fs/http shell and are exercised by running the tool.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  tokenizeWords,
  occurrenceN,
  locateSpan,
  pieceToTokenRange,
  buildRecords,
  describeVerse,
  mergeVerseRecords,
  serializeWordsFile,
} from "../scripts/alignment-words/core.mjs";

const VERSE = "I made the first account, Theophilus, about everything Jesus began doing and teaching";
const GREEK = [
  { t: 1, word: "Τὸν" },
  { t: 2, word: "μὲν" },
  { t: 3, word: "πρῶτον" },
  { t: 4, word: "λόγον" },
];

test("an occurrence must begin and end on word boundaries", () => {
  const text = "in the beginning in the end";
  const tokens = tokenizeWords(text);
  // "in" inside "beginning" is not an occurrence; the second real "in" is the 2nd.
  assert.equal(occurrenceN(text, tokens, "in", text.indexOf("in the end")), 2);
  assert.equal(occurrenceN(text, tokens, "in", text.indexOf("in", 3)), 0, "mid-word start is refused");
});

test("occurrenceN and locateSpan are inverses, case-insensitively", () => {
  const text = "The word, the Word, THE WORD";
  const tokens = tokenizeWords(text);
  const second = text.indexOf("the Word");
  assert.equal(occurrenceN(text, tokens, "the Word", second), 2);
  assert.equal(locateSpan(text, tokens, "the Word", 2), second);
  assert.equal(locateSpan(text, tokens, "the Word", 4), -1);
});

test("pieceToTokenRange returns the tokens a stored piece covers", () => {
  const tokens = tokenizeWords(VERSE);
  assert.deepEqual(pieceToTokenRange(VERSE, tokens, { text: "the first account", n: 1 }), [2, 4]);
  assert.equal(pieceToTokenRange(VERSE, tokens, { text: "the second account", n: 1 }), null);
});

test("buildRecords writes one record per link, Greek first, with counted n", () => {
  const records = buildRecords({
    ref: "Acts.1.1",
    greekTokens: GREEK,
    verseText: VERSE,
    links: [
      { greek: [3], english: [[3, 3]] }, // first
      { greek: [4, 1], english: [[4, 4]] }, // account (Greek given out of order)
    ],
  });
  assert.deepEqual(records, [
    { ref: "Acts.1.1", greek: [{ t: 1, form: "Τὸν" }, { t: 4, form: "λόγον" }], english: [{ text: "account", n: 1 }] },
    { ref: "Acts.1.1", greek: [{ t: 3, form: "πρῶτον" }], english: [{ text: "first", n: 1 }] },
  ]);
});

test("a rendering split by other words is one record with one piece per run", () => {
  const [rec] = buildRecords({
    ref: "Acts.1.1",
    greekTokens: GREEK,
    verseText: VERSE,
    links: [{ greek: [3], english: [[7, 7], [3, 3]] }], // given out of order
  });
  assert.deepEqual(rec.english.map((p) => p.text), ["first", "everything"]);
});

test("touching picks merge into one piece, and Greek or English may stand alone", () => {
  const records = buildRecords({
    ref: "Acts.1.1",
    greekTokens: GREEK,
    verseText: VERSE,
    links: [
      { greek: [], english: [[0, 0], [1, 1]] }, // "I made": no Greek
      { greek: [2], english: [] }, // no English
    ],
  });
  assert.equal(records.find((r) => !r.greek.length).english[0].text, "I made");
  assert.deepEqual(records.find((r) => r.greek.length).english, []);
});

test("buildRecords refuses what would not mean what the reviewer saw", () => {
  const base = { ref: "Acts.1.1", greekTokens: GREEK, verseText: VERSE };
  const code = (links) => assert.throws(() => buildRecords({ ...base, links }), (e) => e.statusCode === 400);
  code([{ greek: [], english: [] }]); // empty link
  code([{ greek: [9], english: [] }]); // no such Greek word
  code([{ greek: [1], english: [] }, { greek: [1], english: [] }]); // Greek word twice
  code([{ greek: [1], english: [[2, 3]] }, { greek: [2], english: [[3, 4]] }]); // English word twice
  code([{ greek: [1], english: [[2, 99]] }]); // out of range
  code([{ greek: [1], english: [[2, 4], [3, 5]] }]); // overlap inside one link
});

test("describeVerse: complete only when every Greek and English word is covered", () => {
  const verseText = "the first account";
  const greekTokens = [{ t: 1, word: "τὸν" }, { t: 2, word: "πρῶτον" }, { t: 3, word: "λόγον" }];
  const records = buildRecords({
    ref: "X.1.1",
    greekTokens,
    verseText,
    links: [{ greek: [1, 2, 3], english: [[0, 2]] }],
  });
  assert.equal(describeVerse({ verseText, greekTokens, records }).complete, true);

  const part = describeVerse({ verseText, greekTokens, records: records.slice(0, 0) });
  assert.equal(part.complete, false);
  assert.deepEqual(part.unlinkedGreek, [1, 2, 3]);
  assert.deepEqual(part.unlinkedEnglish, [0, 1, 2]);
});

test("describeVerse reports a record stale when the English or the Greek moved under it", () => {
  const greekTokens = [{ t: 1, word: "τὸν" }, { t: 2, word: "λόγον" }];
  const records = buildRecords({
    ref: "X.1.1",
    greekTokens,
    verseText: "the account",
    links: [{ greek: [1, 2], english: [[0, 1]] }],
  });
  const reworded = describeVerse({ verseText: "the story", greekTokens, records });
  assert.equal(reworded.stale.length, 1);
  assert.equal(reworded.stale[0].reason, "english");
  assert.deepEqual(reworded.stale[0].relinkGreek, [1, 2], "the Greek is still good, so it can be re-linked");
  assert.deepEqual(reworded.unlinkedGreek, [1, 2], "a stale record covers nothing");
  assert.equal(reworded.complete, false);

  const otherGreek = describeVerse({
    verseText: "the account",
    greekTokens: [{ t: 1, word: "τὸν" }, { t: 2, word: "ἄλλον" }],
    records,
  });
  assert.equal(otherGreek.stale.length, 1, "a changed Greek form is caught by the stored form");
  assert.equal(otherGreek.stale[0].reason, "greek");
  assert.deepEqual(otherGreek.stale[0].relinkGreek, [1], "only the word that still matches is offered back");

  // Normalization alone must not make a record stale.
  const decomposed = greekTokens.map((g) => ({ ...g, word: g.word.normalize("NFD") }));
  assert.equal(describeVerse({ verseText: "the account", greekTokens: decomposed, records }).stale.length, 0);
});

test("serializeWordsFile puts each record on one line and ends with a newline", () => {
  const text = serializeWordsFile({
    bookKey: "acts",
    chapter: 1,
    records: [{ ref: "Acts.1.1", greek: [{ t: 1, form: "Τὸν" }], english: [{ text: "the", n: 1 }] }],
  });
  assert.ok(text.endsWith("}\n"));
  assert.equal(text.split("\n").filter((l) => l.includes('"ref"')).length, 1);
  assert.deepEqual(JSON.parse(text).records.length, 1);
  assert.deepEqual(JSON.parse(serializeWordsFile({ bookKey: "acts", chapter: 1, records: [] })).records, []);
});

test("mergeVerseRecords replaces one verse and keeps unresolved stale records", () => {
  const rec = (verse, text) => ({ ref: `Acts.1.${verse}`, greek: [], english: [{ text, n: 1 }] });
  const merged = mergeVerseRecords({
    records: [rec(1, "a"), rec(2, "old"), rec(3, "c")],
    verse: 2,
    fresh: [rec(2, "new")],
    keptStale: [rec(2, "stale")],
  });
  assert.deepEqual(merged.map((r) => r.english[0].text), ["a", "new", "stale", "c"]);

  const dropped = mergeVerseRecords({ records: merged, verse: 2, fresh: [], keptStale: [] });
  assert.deepEqual(dropped.map((r) => r.english[0].text), ["a", "c"]);
});
