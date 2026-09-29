// test/read-aloud.test.js
//
// Unit tests for src/lib/read-aloud.mjs, the pure half of "Read aloud"
// (audit X9): how a chapter is cut into pieces for the device's voice, how
// the player moves between verses, and which voices are offered.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_CHUNK,
  RATES,
  DEFAULT_RATE,
  speechChunks,
  buildChunks,
  firstChunkOf,
  nextVerseStart,
  previousVerseStart,
  spokenBookName,
  chapterIntro,
  englishVoices,
  pickVoice,
  voiceLabel,
  rateLabel,
} from "../src/lib/read-aloud.mjs";

test("a short verse is one piece", () => {
  assert.deepEqual(speechChunks("Jesus wept."), ["Jesus wept."]);
});

test("empty and blank text give no pieces", () => {
  assert.deepEqual(speechChunks(""), []);
  assert.deepEqual(speechChunks("  \n "), []);
  assert.deepEqual(speechChunks(undefined), []);
});

test("poetry lines are spoken one at a time", () => {
  assert.deepEqual(speechChunks("The Spirit of the Lord is on me,\nbecause God has anointed me"), [
    "The Spirit of the Lord is on me,",
    "because God has anointed me",
  ]);
});

test("whitespace inside a line collapses", () => {
  assert.deepEqual(speechChunks("  In the   beginning  was "), ["In the beginning was"]);
});

test("a long line breaks after a sentence, packing sentences that fit", () => {
  const a = "A".repeat(90) + ".";
  const b = "B".repeat(90) + "!";
  const c = "C".repeat(90) + "?";
  const pieces = speechChunks([a, b, c].join(" "), 200);
  assert.deepEqual(pieces, [a + " " + b, c]);
});

test("a sentence end may carry closing quotes", () => {
  const first = "“" + "x".repeat(120) + ".”";
  const second = "y".repeat(120) + ".";
  assert.deepEqual(speechChunks(first + " " + second, 200), [first, second]);
});

test("a long sentence breaks after a clause, then at spaces", () => {
  const clause = "word ".repeat(30).trim() + ",";
  const pieces = speechChunks([clause, clause, clause].join(" "), 200);
  assert.ok(pieces.length >= 2);
  for (const p of pieces) assert.ok(p.length <= 200, p.length);
  assert.equal(pieces.join(" "), [clause, clause, clause].join(" "));

  const run = "word ".repeat(100).trim(); // no punctuation at all
  const words = speechChunks(run, 50);
  for (const p of words) assert.ok(p.length <= 50);
  assert.equal(words.join(" "), run);
});

test("no piece is longer than the limit, and no word is lost", () => {
  // About 400 characters with commas but only one sentence end, the shape of
  // the longest published verse.
  const verse = Array.from({ length: 16 }, (_, i) => `clause number ${i + 1} of the list`).join(", ") + ".";
  const pieces = speechChunks(verse);
  for (const p of pieces) assert.ok(p.length <= MAX_CHUNK);
  assert.equal(pieces.join(" "), verse);
});

test("buildChunks: intro first, then each verse's pieces, gaps skipped", () => {
  const chunks = buildChunks(
    [
      { verse: 1, text: "One." },
      { verse: 2, text: "Line a\nLine b" },
      { verse: 3, text: "" },
      { verse: 4, text: "Four." },
    ],
    { intro: "John, chapter 11." }
  );
  assert.deepEqual(chunks, [
    { verse: null, text: "John, chapter 11." },
    { verse: 1, text: "One." },
    { verse: 2, text: "Line a" },
    { verse: 2, text: "Line b" },
    { verse: 4, text: "Four." },
  ]);
});

test("buildChunks without an intro starts at the first verse", () => {
  assert.deepEqual(buildChunks([{ verse: 5, text: "Five." }]), [{ verse: 5, text: "Five." }]);
});

const CH = buildChunks(
  [
    { verse: 1, text: "One." },
    { verse: 2, text: "Two a\nTwo b" },
    { verse: 3, text: "Three." },
  ],
  { intro: "Intro." }
);
// 0 intro, 1 v1, 2 v2a, 3 v2b, 4 v3

test("firstChunkOf finds a verse's first piece", () => {
  assert.equal(firstChunkOf(CH, 1), 1);
  assert.equal(firstChunkOf(CH, 2), 2);
  assert.equal(firstChunkOf(CH, 3), 4);
  assert.equal(firstChunkOf(CH, 9), -1);
});

test("next verse skips the rest of this verse", () => {
  assert.equal(nextVerseStart(CH, 0), 1);
  assert.equal(nextVerseStart(CH, 1), 2);
  assert.equal(nextVerseStart(CH, 2), 4);
  assert.equal(nextVerseStart(CH, 3), 4);
  assert.equal(nextVerseStart(CH, 4), -1);
});

test("previous verse goes to the start of the verse before", () => {
  assert.equal(previousVerseStart(CH, 4), 2);
  assert.equal(previousVerseStart(CH, 3), 1);
  assert.equal(previousVerseStart(CH, 2), 1);
  assert.equal(previousVerseStart(CH, 1), 0);
  assert.equal(previousVerseStart(CH, 0), 0);
});

test("previous verse at the first verse without an intro stays there", () => {
  const plain = buildChunks([
    { verse: 1, text: "A\nB" },
    { verse: 2, text: "C" },
  ]);
  assert.equal(previousVerseStart(plain, 1), 0);
  assert.equal(previousVerseStart(plain, 0), 0);
  assert.equal(previousVerseStart(plain, 2), 0);
});

test("numbered books are said as ordinals", () => {
  assert.equal(spokenBookName("1 Corinthians"), "First Corinthians");
  assert.equal(spokenBookName("2 Timothy"), "Second Timothy");
  assert.equal(spokenBookName("3 John"), "Third John");
  assert.equal(spokenBookName("Romans"), "Romans");
  assert.equal(chapterIntro("1 Peter", 2), "First Peter, chapter 2.");
});

const V = (name, lang, extra = {}) => ({
  name,
  lang,
  voiceURI: name,
  localService: true,
  default: false,
  ...extra,
});

test("only English voices are offered, on-device ones first", () => {
  const voices = [
    V("Google US English", "en-US", { localService: false }),
    V("Microsoft David - English (United States)", "en-US"),
    V("Amélie", "fr-CA"),
    V("Microsoft Zira - English (United States)", "en-US"),
  ];
  assert.deepEqual(
    englishVoices(voices, "en-US").map((v) => v.name),
    [
      "Microsoft David - English (United States)",
      "Microsoft Zira - English (United States)",
      "Google US English",
    ]
  );
});

test("the reader's own English and the better voices come first", () => {
  const voices = [
    V("Samantha", "en-US"),
    V("Daniel", "en-GB"),
    V("Serena (Premium)", "en-GB"),
    V("Ava (Enhanced)", "en-US"),
  ];
  assert.deepEqual(
    englishVoices(voices, "en-GB").map((v) => v.name),
    ["Serena (Premium)", "Daniel", "Ava (Enhanced)", "Samantha"]
  );
});

test("Apple's novelty, MacinTalk and Eloquence voices are left out", () => {
  const voices = [
    V("Bad News", "en-US"),
    V("Zarvox", "en-US"),
    V("Fred", "en-US"),
    V("Grandpa (English (United States))", "en-US"),
    V("Samantha", "en-US"),
  ];
  assert.deepEqual(englishVoices(voices).map((v) => v.name), ["Samantha"]);
});

test("pickVoice: the saved voice, else the device default, else the first", () => {
  const voices = [
    V("Google US English", "en-US", { localService: false }),
    V("Karen", "en-AU"),
    V("Samantha", "en-US", { default: true }),
  ];
  assert.equal(pickVoice(voices, "Karen", "en-US").name, "Karen");
  assert.equal(pickVoice(voices, "Gone", "en-US").name, "Samantha");
  assert.equal(pickVoice(voices, null, "en-US").name, "Samantha");

  const noDefault = voices.map((v) => ({ ...v, default: false }));
  assert.equal(pickVoice(noDefault, null, "en-US").name, "Samantha");
});

test("pickVoice starts with a downloaded premium or enhanced voice in the reader's English", () => {
  const voices = [
    V("Samantha", "en-US", { default: true }),
    V("Ava (Premium)", "en-US"),
    V("Serena (Premium)", "en-GB"),
  ];
  assert.equal(pickVoice(voices, null, "en-US").name, "Ava (Premium)");
  assert.equal(pickVoice(voices, null, "en-GB").name, "Serena (Premium)");
  // Only another English's premium voice: the default stands.
  assert.equal(pickVoice(voices.slice(0, 1).concat(voices[2]), null, "en-US").name, "Samantha");
  // A saved choice still wins.
  assert.equal(pickVoice(voices, "Samantha", "en-US").name, "Samantha");
});

test("pickVoice never starts with an online voice while the device has one", () => {
  const natural = V("Microsoft Jenny Online (Natural) - English (United States)", "en-US", {
    localService: false,
  });
  assert.equal(pickVoice([natural, V("Microsoft Zira - English (United States)", "en-US")], null, "en-US").name,
    "Microsoft Zira - English (United States)");
  // With nothing on the device, an online voice is all there is.
  assert.equal(pickVoice([natural], null, "en-US"), natural);
});

test("pickVoice never starts with an online default", () => {
  const voices = [
    V("Microsoft Aria Online (Natural) - English (United States)", "en-US", {
      localService: false,
      default: true,
    }),
    V("Microsoft David - English (United States)", "en-US"),
  ];
  assert.equal(pickVoice(voices, null, "en-US").name, "Microsoft David - English (United States)");
});

test("pickVoice with no English voice leaves it to the browser", () => {
  assert.equal(pickVoice([V("Amélie", "fr-CA")], null, "en-US"), null);
  assert.equal(pickVoice([], null, "en-US"), null);
});

test("voice labels drop Windows' language suffix and say when a voice is online", () => {
  assert.equal(voiceLabel(V("Microsoft David - English (United States)", "en-US")), "Microsoft David");
  assert.equal(
    voiceLabel(V("Microsoft Aria Online (Natural) - English (United States)", "en-US", { localService: false })),
    "Microsoft Aria Online (Natural)"
  );
  assert.equal(voiceLabel(V("Google UK English Female", "en-GB", { localService: false })), "Google UK English Female (online)");
  assert.equal(voiceLabel(V("Samantha", "en-US")), "Samantha");
});

test("speeds", () => {
  assert.ok(RATES.includes(DEFAULT_RATE));
  assert.equal(rateLabel(1.25), "1.25×");
});
