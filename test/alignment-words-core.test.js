// test/alignment-words-core.test.js
//
// Unit tests for scripts/alignment-words/core.mjs, the pure layer of the
// word-alignment tool (alignment phase 2). In-memory fixtures only, in the
// style of test/alignment-review-core.test.js. The store and server are the
// fs/http shell and are exercised by running the tool.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  FORMAT,
  tokenizeWords,
  occurrenceN,
  locateSpan,
  pieceToTokenRange,
  mapTokens,
  carryPiece,
  buildChapterRecords,
  describeChapter,
  markStale,
  basisFor,
  serializeWordsFile,
  describeParse,
  normalizeVerseText,
} from "../scripts/alignment-words/core.mjs";

/** verse number -> { text, greek words } */
const chapter = (entries) =>
  new Map(entries.map(([v, text, words]) => [v, { text, greek: words.map((word, i) => ({ t: i + 1, word })) }]));

const V1 = "I made the first account, Theophilus";
const G1 = ["Τὸν", "μὲν", "πρῶτον", "λόγον", "ἐποιησάμην", "ὦ", "Θεόφιλε"];

// ------------------------------------------------------------ English spans

test("an occurrence must begin and end on word boundaries", () => {
  const text = "in the beginning in the end";
  const tokens = tokenizeWords(text);
  assert.equal(occurrenceN(text, tokens, "in", text.indexOf("in the end")), 2, '"in" inside "beginning" does not count');
  assert.equal(occurrenceN(text, tokens, "in", text.indexOf("in", 3)), 0, "a mid-word start is refused");
});

test("occurrenceN and locateSpan are inverses, case-insensitively", () => {
  const text = "The word, the Word, THE WORD";
  const tokens = tokenizeWords(text);
  const second = text.indexOf("the Word");
  assert.equal(occurrenceN(text, tokens, "the Word", second), 2);
  assert.equal(locateSpan(text, tokens, "the Word", 2), second);
  assert.equal(locateSpan(text, tokens, "the Word", 4), -1);
  assert.deepEqual(pieceToTokenRange(V1, tokenizeWords(V1), { text: "the first account", n: 1 }), [2, 4]);
});

test("mapTokens keeps the words a revision left alone", () => {
  const map = mapTokens(tokenizeWords("the word and the God"), tokenizeWords("the word, the one, and the God"));
  assert.deepEqual([...map], [[0, 0], [1, 1], [2, 4], [3, 5], [4, 6]]);
});

test("carryPiece moves a piece whose words survived, and refuses one a revision broke into", () => {
  assert.deepEqual(carryPiece("the first account", "so the first account", { text: "the first account", n: 1 }), [1, 3]);
  assert.equal(carryPiece("the first account", "the first written account", { text: "the first account", n: 1 }), null);
  assert.equal(carryPiece("the first account", "the earlier account", { text: "the first account", n: 1 }), null);
});

test("verse text is normalized the way the Study Desk's anchors are", () => {
  assert.equal(normalizeVerseText("  é ⟦word⟧  more​ "), "é word more");
});

// ------------------------------------------------------------ writing

test("buildChapterRecords writes one record per link, in Greek order, with counted n", () => {
  const verses = chapter([[1, V1, G1]]);
  const records = buildChapterRecords({
    refPrefix: "Acts.1",
    verses,
    links: [
      { greek: [{ v: 1, t: 3 }], english: [{ v: 1, first: 3, last: 3 }] }, // first
      { greek: [{ v: 1, t: 4 }, { v: 1, t: 1 }], english: [{ v: 1, first: 4, last: 4 }] }, // account
      { greek: [], english: [{ v: 1, first: 0, last: 0 }, { v: 1, first: 1, last: 1 }] }, // "I made", touching picks merge
    ],
  });
  assert.deepEqual(records, [
    { ref: "Acts.1.1", greek: [{ t: 1, form: "Τὸν" }, { t: 4, form: "λόγον" }], english: [{ text: "account", n: 1 }] },
    { ref: "Acts.1.1", greek: [{ t: 3, form: "πρῶτον" }], english: [{ text: "first", n: 1 }] },
    { ref: "Acts.1.1", greek: [], english: [{ text: "I made", n: 1 }] },
  ]);
});

test("a link may cross a verse boundary; `v` is written only where it differs from the record's verse", () => {
  const verses = chapter([
    [1, "about everything Jesus began doing and teaching", ["περὶ", "πάντων"]],
    [2, "until the day", ["ἄχρι", "ἧς", "ἡμέρας"]],
  ]);
  const [rec] = buildChapterRecords({
    refPrefix: "Acts.1",
    verses,
    // Greek from verse 2 rendered by English that sits in verse 1, plus a word of verse 2.
    links: [{ greek: [{ v: 2, t: 1 }], english: [{ v: 2, first: 0, last: 0 }, { v: 1, first: 6, last: 6 }] }],
  });
  assert.deepEqual(rec, {
    ref: "Acts.1.2",
    greek: [{ t: 1, form: "ἄχρι" }],
    english: [{ v: 1, text: "teaching", n: 1 }, { text: "until", n: 1 }],
  });
  const d = describeChapter({ verses, records: [rec] });
  assert.deepEqual(d.links[0].english, [{ v: 1, first: 6, last: 6 }, { v: 2, first: 0, last: 0 }]);
  assert.deepEqual(d.verses.get(1).unlinkedEnglish, [0, 1, 2, 3, 4, 5], "verse 1's 'teaching' is covered by verse 2's record");
});

test("Greek forms are stored NFC whatever the source gives", () => {
  const verses = chapter([[1, "word", ["λόγον".normalize("NFD")]]]);
  const [rec] = buildChapterRecords({ refPrefix: "X.1", verses, links: [{ greek: [{ v: 1, t: 1 }], english: [] }] });
  assert.equal(rec.greek[0].form, "λόγον".normalize("NFC"));
});

test("buildChapterRecords refuses what would not mean what the reviewer saw", () => {
  const verses = chapter([[1, V1, G1]]);
  const refuse = (links) =>
    assert.throws(() => buildChapterRecords({ refPrefix: "Acts.1", verses, links }), (e) => e.statusCode === 400);
  refuse([{ greek: [], english: [] }]); // empty link
  refuse([{ greek: [{ v: 1, t: 99 }], english: [] }]); // no such Greek word
  refuse([{ greek: [{ v: 2, t: 1 }], english: [] }]); // no such verse
  refuse([{ greek: [{ v: 1, t: 1 }] }, { greek: [{ v: 1, t: 1 }] }]); // Greek word twice
  refuse([{ english: [{ v: 1, first: 2, last: 3 }] }, { english: [{ v: 1, first: 3, last: 4 }] }]); // English word twice
  refuse([{ english: [{ v: 1, first: 2, last: 99 }] }]); // out of range
});

// ------------------------------------------------------------ reading

test("complete only when every Greek and English word is covered", () => {
  const verses = chapter([[1, "the first account", ["τὸν", "πρῶτον", "λόγον"]]]);
  const records = buildChapterRecords({
    refPrefix: "X.1",
    verses,
    links: [{ greek: [1, 2, 3].map((t) => ({ v: 1, t })), english: [{ v: 1, first: 0, last: 2 }] }],
  });
  assert.equal(describeChapter({ verses, records }).verses.get(1).complete, true);
  const none = describeChapter({ verses, records: [] }).verses.get(1);
  assert.equal(none.complete, false);
  assert.deepEqual(none.unlinkedGreek, [1, 2, 3]);
});

test("a verse with no SBLGNT words is outside the source and never complete", () => {
  const verses = chapter([[53, "Then each went home", []]]);
  const records = buildChapterRecords({ refPrefix: "John.7", verses, links: [{ english: [{ v: 53, first: 0, last: 3 }] }] });
  const s = describeChapter({ verses, records }).verses.get(53);
  assert.equal(s.outsideSource, true);
  assert.equal(s.complete, false);
});

// The regression the basis exists for: a revision that adds a repeated word.
test("a revision inserting a repeated word carries every link to its own word, never the one before it", () => {
  const G = ["ὁ", "λόγος", "ὁ", "θεός"];
  const before = chapter([[1, "the word and the God", G]]);
  const records = buildChapterRecords({
    refPrefix: "X.1",
    verses: before,
    links: [
      { greek: [{ v: 1, t: 1 }], english: [{ v: 1, first: 0, last: 0 }] },
      { greek: [{ v: 1, t: 2 }], english: [{ v: 1, first: 1, last: 1 }] },
      { english: [{ v: 1, first: 2, last: 2 }] },
      { greek: [{ v: 1, t: 3 }], english: [{ v: 1, first: 3, last: 3 }] }, // the second "the"
      { greek: [{ v: 1, t: 4 }], english: [{ v: 1, first: 4, last: 4 }] },
    ],
  });
  const basis = basisFor({ verses: before, records });
  const after = chapter([[1, "the word, the one, and the God", G]]);
  const d = describeChapter({ verses: after, basis, records });
  const article = d.links.find((l) => l.greek[0]?.t === 3);
  assert.deepEqual(article.english, [{ v: 1, first: 5, last: 5 }], 'ὁ (t 3) stays on "the God", not the inserted "the one"');
  assert.equal(article.moved, true);
  assert.equal(d.stale.length, 0);
  assert.deepEqual(d.verses.get(1).unlinkedEnglish, [2, 3], "only the inserted words are open");
  assert.equal(d.verses.get(1).changed, true);

  // Saving writes the carried links at their new place, against the new basis.
  const saved = buildChapterRecords({ refPrefix: "X.1", verses: after, links: d.links });
  assert.deepEqual(saved.find((r) => r.greek[0]?.t === 3).english, [{ text: "the", n: 3 }]);
});

test("stale reasons: English broken into, Greek changed, overlap, and a verse that is gone", () => {
  const G = ["τὸν", "λόγον"];
  const before = chapter([[1, "the account", G]]);
  const records = buildChapterRecords({
    refPrefix: "X.1",
    verses: before,
    links: [{ greek: [{ v: 1, t: 1 }, { v: 1, t: 2 }], english: [{ v: 1, first: 0, last: 1 }] }],
  });
  const basis = basisFor({ verses: before, records });

  const english = describeChapter({ verses: chapter([[1, "the story", G]]), basis, records });
  assert.equal(english.stale[0].reason, "english");
  assert.deepEqual(english.stale[0].relinkGreek, [{ v: 1, t: 1 }, { v: 1, t: 2 }], "its Greek is offered back");
  assert.deepEqual(english.verses.get(1).unlinkedGreek, [1, 2], "a stale record covers nothing");

  const greek = describeChapter({ verses: chapter([[1, "the account", ["τὸν", "ἄλλον"]]]), basis, records });
  assert.equal(greek.stale[0].reason, "greek");
  assert.deepEqual(greek.stale[0].relinkGreek, [{ v: 1, t: 1 }]);

  const nfd = chapter([[1, "the account", G.map((w) => w.normalize("NFD"))]]);
  assert.equal(describeChapter({ verses: nfd, basis, records }).stale.length, 0, "normalization alone is not a change");

  const twice = describeChapter({ verses: before, basis, records: [...records, ...records] });
  assert.equal(twice.stale[0].reason, "clash");

  const gone = describeChapter({ verses: chapter([[2, "other", ["ἄλλο"]]]), basis, records });
  assert.equal(gone.stale[0].reason, "verse");
});

test("a record marked stale stays stale even if its words come back", () => {
  const verses = chapter([[1, "the account", ["τὸν", "λόγον"]]]);
  const [rec] = buildChapterRecords({
    refPrefix: "X.1",
    verses,
    links: [{ greek: [{ v: 1, t: 1 }], english: [{ v: 1, first: 0, last: 0 }] }],
  });
  const marked = markStale({ record: rec, reason: "english" });
  assert.equal(marked.stale, "english");
  const d = describeChapter({ verses, basis: basisFor({ verses, records: [marked] }), records: [marked] });
  assert.equal(d.links.length, 0);
  assert.equal(d.stale[0].reason, "english");
});

// ------------------------------------------------------------ the file

test("serializeWordsFile writes the format, one basis verse and one record per line", () => {
  const text = serializeWordsFile({
    bookKey: "acts",
    chapter: 1,
    basis: { 10: "ten", 2: "two" },
    records: [{ ref: "Acts.1.2", greek: [{ t: 1, form: "Τὸν" }], english: [{ text: "two", n: 1 }] }],
  });
  const parsed = JSON.parse(text);
  assert.equal(parsed.format, FORMAT);
  assert.deepEqual(Object.keys(parsed.basis), ["2", "10"]);
  assert.ok(text.includes('\n    "2": "two",\n    "10": "ten"\n'), "basis in verse order, one per line");
  assert.equal(text.split("\n").filter((l) => l.includes('"ref"')).length, 1);
  assert.ok(text.endsWith("}\n"));
  assert.deepEqual(JSON.parse(serializeWordsFile({ bookKey: "acts", chapter: 1, records: [] })).records, []);
});

test("basisFor records every verse a record touches, including across a boundary", () => {
  const verses = chapter([[1, "one", ["α"]], [2, "two", ["β"]], [3, "three", ["γ"]]]);
  const basis = basisFor({
    verses,
    records: [{ ref: "X.1.2", greek: [{ t: 1, form: "β" }], english: [{ v: 1, text: "one", n: 1 }] }],
  });
  assert.deepEqual(basis, { 1: "one", 2: "two" });
});

// ------------------------------------------------------------ MorphGNT codes

test("describeParse puts MorphGNT's codes in words", () => {
  assert.equal(describeParse("V-", "3AMI-S--"), "verb, aorist middle indicative, 3rd person singular");
  assert.equal(describeParse("V-", "-PAN----"), "verb, present active infinitive");
  assert.equal(describeParse("V-", "-AAPNSM-"), "verb, aorist active participle, nominative masculine singular");
  assert.equal(describeParse("RA", "----ASM-"), "article, accusative masculine singular");
  assert.equal(describeParse("N-", "----VSM-"), "noun, vocative masculine singular");
  assert.equal(describeParse("A-", "----NSMC"), "adjective, nominative masculine singular, comparative");
  assert.equal(describeParse("C-", "--------"), "conjunction");
});
