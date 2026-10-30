// test/desk-sheet-check.test.js
//
// A sheet's text checked before printing (STUDY-DESK.md, S2, "Order of work"
// 2b): the pure module src/lib/desk-sheet-check.mjs. Covers the day a copy of
// the text is from, the "Text as of" line, the check a passage gets against
// today's chapter (whole verses and quoted words, with typography evened out),
// the fields that keep the new wording, a passage as a release-note record,
// the newest of several content versions, the list of references, and the summary the sheet page shows above the
// paper. Chapters are small made-up ones built with anchor-core's
// assembleChapter.

import { test } from "node:test";
import assert from "node:assert/strict";

import { assembleChapter } from "../src/lib/anchor-core.mjs";
import { verseCopyFor } from "../src/lib/desk-records.mjs";
import { passageFromOffsets, passageFromVerses, passageReference } from "../src/lib/desk-sheet-passages.mjs";
import {
  checkSummary,
  dayOf,
  dayWords,
  freshCopy,
  listReferences,
  newestVersion,
  passageAsRecord,
  passageCheck,
  textAsOfLine,
  textDay,
} from "../src/lib/desk-sheet-check.mjs";

const VERSION = "v20261018.5d2c847d";
const where = { bookKey: "john", chapter: 1 };

// "In the beginning was the word." / "The word was with God." /
// "All things came to be through it."
const chapter = assembleChapter(
  new Map([
    [1, "In the beginning was the word."],
    [2, "The word was with God."],
    [3, "All things came to be through it."],
  ]),
);

// The same chapter with verse 2's wording changed.
const changedVerse = assembleChapter(
  new Map([
    [1, "In the beginning was the word."],
    [2, "The word was beside God."],
    [3, "All things came to be through it."],
  ]),
);

// The same chapter with a different verse changed, the quoted words intact.
const otherVerseChanged = assembleChapter(
  new Map([
    [1, "In the beginning was the word."],
    [2, "The word was with God, and was God."],
    [3, "All things came to be through it."],
  ]),
);

// The quoted words themselves changed, the surroundings intact.
const quoteChanged = assembleChapter(
  new Map([
    [1, "In the start was the word."],
    [2, "The word was with God."],
    [3, "All things came to be through it."],
  ]),
);

/* ── dayOf ───────────────────────────────────────────────────────────── */

test("dayOf: a content version gives its day", () => {
  assert.equal(dayOf("v20261018.5d2c847d"), "2026-10-18");
});

test("dayOf: an ISO time gives its day", () => {
  assert.equal(dayOf("2026-10-05T12:00:00.000Z"), "2026-10-05");
});

test("dayOf: anything else gives null", () => {
  assert.equal(dayOf("unversioned"), null);
  assert.equal(dayOf(null), null);
  assert.equal(dayOf(42), null);
});

/* ── dayWords ────────────────────────────────────────────────────────── */

test("dayWords: a day in words", () => {
  assert.equal(dayWords("2026-10-18"), "October 18, 2026");
});

test("dayWords: a bad string gives null", () => {
  assert.equal(dayWords("18 October 2026"), null);
  assert.equal(dayWords(null), null);
});

/* ── textAsOfLine ────────────────────────────────────────────────────── */

test("textAsOfLine: names the day the text is from", () => {
  assert.equal(textAsOfLine(VERSION), "Text as of October 18, 2026");
});

test("textAsOfLine: a version that names no day gives null", () => {
  assert.equal(textAsOfLine("unversioned"), null);
});

test("textAsOfLine: an evening publish in the Americas names the reader's day", () => {
  // 7:09 PM Pacific on October 29 is October 30 in UTC, the version's day.
  const v = "v20261030.43c51b53";
  const at = "2026-10-30T02:09:11.000Z";
  assert.equal(textAsOfLine(v, at, "America/Los_Angeles"), "Text as of October 29, 2026");
  assert.equal(textAsOfLine(v, at, "America/New_York"), "Text as of October 29, 2026");
  assert.equal(textAsOfLine(v, at, "Europe/London"), "Text as of October 30, 2026");
});

/* ── textDay ─────────────────────────────────────────────────────────── */

test("textDay: a build time on the version's day gives that time's local day", () => {
  assert.equal(textDay("v20261030.43c51b53", "2026-10-30T02:09:11.000Z", "America/Chicago"), "2026-10-29");
  assert.equal(textDay("v20261030.43c51b53", "2026-10-30T02:09:11.000Z", "Asia/Tokyo"), "2026-10-30");
});

test("textDay: a time east of UTC can name the next day", () => {
  assert.equal(textDay("v20261029.43c51b53", "2026-10-29T20:00:00.000Z", "Asia/Tokyo"), "2026-10-30");
});

test("textDay: no build time, or one from another day, keeps the version's day", () => {
  assert.equal(textDay(VERSION, null, "America/Los_Angeles"), "2026-10-18");
  assert.equal(textDay(VERSION, "2026-10-19T02:00:00.000Z", "America/Los_Angeles"), "2026-10-18");
  assert.equal(textDay(VERSION, "not a time", "America/Los_Angeles"), "2026-10-18");
  assert.equal(textDay(VERSION, "2026-10-18T02:00:00", "America/Los_Angeles"), "2026-10-18");
});

test("textDay: a time zone the browser doesn't know keeps the version's day", () => {
  assert.equal(textDay("v20261030.43c51b53", "2026-10-30T02:09:11.000Z", "Nowhere/Atlantis"), "2026-10-30");
});

test("textDay: a version that names no day gives null", () => {
  assert.equal(textDay("unversioned", "2026-10-30T02:09:11.000Z"), null);
});

/* ── passageCheck, whole verses ──────────────────────────────────────── */

test("passageCheck: whole verses with the same wording are same", () => {
  const m = passageFromVerses(chapter, where, 1, 2, VERSION);
  assert.deepEqual(passageCheck(chapter, m), { state: "same" });
});

test("passageCheck: whole verses whose wording changed are changed, with a diff", () => {
  const m = passageFromVerses(chapter, where, 1, 2, VERSION);
  const check = passageCheck(changedVerse, m);
  assert.equal(check.state, "changed");
  assert.equal(check.before, m.verseCopy);
  assert.equal(check.now, verseCopyFor(changedVerse, 1, 2));
  assert.ok(Array.isArray(check.diff));
  assert.ok(check.diff.some((run) => run.op === "del"));
  assert.ok(check.diff.some((run) => run.op === "ins"));
});

test("passageCheck: a change only of typography (quotes, dashes) is same", () => {
  const straight = assembleChapter(new Map([[1, 'He said "well-known" words.']]));
  const curly = assembleChapter(new Map([[1, "He said “well–known” words."]]));
  const m = passageFromVerses(straight, where, 1, 1, VERSION);
  assert.deepEqual(passageCheck(curly, m), { state: "same" });
});

test("passageCheck: a passage with no verseCopy is unchecked", () => {
  const m = { bookKey: "john", chapter: 1, verse: 1, endVerse: 2 };
  assert.deepEqual(passageCheck(chapter, m), { state: "unchecked" });
});

test("passageCheck: verses the chapter no longer has are lost", () => {
  const m = passageFromVerses(chapter, where, 1, 1, VERSION);
  const moved = { ...m, verse: 9, endVerse: 9 };
  assert.deepEqual(passageCheck(chapter, moved), { state: "lost" });
});

test("passageCheck: a null chapter is lost", () => {
  const m = passageFromVerses(chapter, where, 1, 2, VERSION);
  assert.deepEqual(passageCheck(null, m), { state: "lost" });
});

/* ── passageCheck, quoted passages ───────────────────────────────────── */

const quoteStart = chapter.text.indexOf("the beginning");
const quotePassage = passageFromOffsets(chapter, where, quoteStart, quoteStart + "the beginning".length, VERSION);

test("passageCheck: a quote with the same words is same", () => {
  assert.equal(quotePassage.quote.exact, "the beginning");
  assert.deepEqual(passageCheck(chapter, quotePassage), { state: "same" });
});

test("passageCheck: a quote is same when a different verse changed and its words are intact", () => {
  assert.deepEqual(passageCheck(otherVerseChanged, quotePassage), { state: "same" });
});

test("passageCheck: a quote whose words changed is changed, with before as the quote", () => {
  const check = passageCheck(quoteChanged, quotePassage);
  assert.equal(check.state, "changed");
  assert.equal(check.before, "the beginning");
});

/* ── freshCopy ───────────────────────────────────────────────────────── */

test("freshCopy: a whole-verse passage gets a fresh verseCopy and its version", () => {
  const m = passageFromVerses(chapter, where, 1, 2, VERSION);
  const fresh = freshCopy(changedVerse, m, "v20261019.aaaaaaaa");
  assert.equal(fresh.verseCopy, verseCopyFor(changedVerse, 1, 2));
  assert.equal(fresh.verseCopyAsOf, "v20261019.aaaaaaaa");
});

test("freshCopy: a quoted passage keeps a quote key and a fresh verseCopy, with no where keys", () => {
  const fresh = freshCopy(quoteChanged, quotePassage, "v20261019.aaaaaaaa");
  assert.equal("quote" in fresh, true);
  assert.equal("bookKey" in fresh, false);
  assert.equal("chapter" in fresh, false);
  assert.ok(fresh.verseCopy);
});

test("freshCopy: a quoted passage whose verses are gone is null", () => {
  const laterOnly = assembleChapter(new Map([[2, "The word was with God."], [3, "All things came to be through it."]]));
  assert.equal(freshCopy(laterOnly, quotePassage, VERSION), null);
});

test("freshCopy: verses the chapter no longer has are null", () => {
  const m = passageFromVerses(chapter, where, 1, 1, VERSION);
  assert.equal(freshCopy(chapter, { ...m, verse: 9, endVerse: 9 }, VERSION), null);
});

/* ── passageAsRecord ─────────────────────────────────────────────────── */

test("passageAsRecord: a content version moves to contentVersion", () => {
  const m = passageFromVerses(chapter, where, 1, 2, VERSION);
  const record = passageAsRecord(m);
  assert.equal(record.contentVersion, VERSION);
  assert.equal(record.verseCopyAsOf, undefined);
  assert.equal(record.endVerse, 2);
});

test("passageAsRecord: an ISO time stays in verseCopyAsOf", () => {
  const iso = "2026-10-05T12:00:00.000Z";
  const m = passageFromVerses(chapter, where, 1, 2, iso);
  const record = passageAsRecord(m);
  assert.equal(record.verseCopyAsOf, iso);
  assert.equal(record.contentVersion, undefined);
});

test("passageAsRecord: endVerse defaults to verse", () => {
  const record = passageAsRecord({ bookKey: "john", chapter: 1, verse: 2 });
  assert.equal(record.endVerse, 2);
});

/* ── listReferences ──────────────────────────────────────────────────── */

test("listReferences: nothing is an empty string", () => {
  assert.equal(listReferences([]), "");
});

test("listReferences: one reference is itself", () => {
  assert.equal(listReferences(["John 1:1–2"]), "John 1:1–2");
});

test("listReferences: two are joined with and", () => {
  assert.equal(listReferences(["John 1:1", "Romans 8:1–4"]), "John 1:1 and Romans 8:1–4");
});

test("listReferences: three take the Oxford comma", () => {
  assert.equal(listReferences(["A", "B", "C"]), "A, B, and C");
});

/* ── checkSummary ────────────────────────────────────────────────────── */

test("checkSummary: null when nothing changed", () => {
  const m = passageFromVerses(chapter, where, 1, 2, VERSION);
  assert.equal(checkSummary([{ m, check: { state: "same" } }]), null);
  assert.equal(checkSummary([]), null);
});

test("checkSummary: one changed passage names its reference", () => {
  const m = passageFromVerses(chapter, where, 1, 2, VERSION);
  const summary = checkSummary([{ m, check: passageCheck(changedVerse, m) }]);
  assert.equal(summary.count, 1);
  assert.equal(summary.headline, `The wording of ${passageReference(m)} has changed since you added it.`);
  assert.match(summary.headline, /John 1:1–2/);
  assert.match(summary.headline, /since you added it\.$/);
});

test("checkSummary: two changed and one same lists only the two", () => {
  const a = passageFromVerses(chapter, where, 1, 2, VERSION);
  const b = passageFromVerses(chapter, where, 2, 2, VERSION);
  const c = passageFromVerses(chapter, where, 3, 3, VERSION);
  const items = [
    { m: a, check: { state: "changed" } },
    { m: b, check: { state: "same" } },
    { m: c, check: { state: "changed" } },
  ];
  const summary = checkSummary(items);
  assert.equal(summary.count, 2);
  assert.equal(
    summary.headline,
    `The wording of ${passageReference(a)} and ${passageReference(c)} has changed since you added them.`,
  );
  assert.ok(!summary.headline.includes(passageReference(b)));
  assert.match(summary.headline, /since you added them\.$/);
});

/* ── newestVersion ───────────────────────────────────────────────────── */

test("newestVersion: the latest day wins, whatever the order", () => {
  assert.equal(newestVersion(["v20261004.aaaaaaaa", "v20261018.bbbbbbbb", "v20261010.cccccccc"]), "v20261018.bbbbbbbb");
});

test("newestVersion: versions that can't be ordered keep the first", () => {
  assert.equal(newestVersion(["v20261018.aaaaaaaa", "v20261018.bbbbbbbb"]), "v20261018.aaaaaaaa");
});

test("newestVersion: a version naming a day beats one that doesn't", () => {
  assert.equal(newestVersion(["unversioned", "v20261018.bbbbbbbb"]), "v20261018.bbbbbbbb");
  assert.equal(newestVersion(["v20261018.bbbbbbbb", "unversioned"]), "v20261018.bbbbbbbb");
});

test("newestVersion: nothing usable gives null", () => {
  assert.equal(newestVersion([]), null);
  assert.equal(newestVersion([null, undefined, ""]), null);
});
