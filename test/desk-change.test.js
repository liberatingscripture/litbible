// test/desk-change.test.js
//
// src/lib/desk-change.mjs: the Study Desk's change notice (STUDY-DESK.md N3,
// audit C3). What these guard, in order of how much a reader would feel it:
// a punctuation pass must never raise a notice (the August 2026 passes curled
// 439 straight quotes and turned 413 hyphens into en dashes), a real rewording
// always must, Keep writes only what the reader chose and moves `modified`
// (principle 4), and a page on older text never speaks for newer records
// (principle 7).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { assembleChapter } from "../src/lib/anchor-core.mjs";
import {
  NOTICE_KINDS,
  changeNotice,
  changeVerses,
  excerptDiff,
  mayKeep,
  noticeWords,
  planKeep,
  proseNotice,
  releaseNoteFor,
} from "../src/lib/desk-change.mjs";
import { proseQuote } from "../src/lib/desk-prose-anchor.mjs";
import { createRecord, placeRecord, quoteFields, validateRecord, verseCopyFor } from "../src/lib/desk-records.mjs";
import { wordingDiff } from "../src/lib/desk-wording.mjs";
import { entryIds, parseDetail } from "../src/lib/release-notes-view.mjs";

const VERSION = "v20261005.5d2c847d"; // the text the page is showing
const OLDER = "v20260901.0a1b2c3d"; // the text a record was made on
const LATER = "v20261009.0a1b2c3d";
const SAME_DAY = "v20261005.ffffffff"; // can't be ordered against VERSION
const before = "2026-09-01T12:00:00.000Z";
const NOW = "2026-10-09T08:30:00.000Z";
const ctx = { client: "web/2026.10", contentVersion: VERSION };
const where = { bookKey: "romans", chapter: 8 };

const chapterOf = (...verses) => assembleChapter(new Map(verses.map((t, i) => [i + 1, t])));

const V1 = "Love is patient, love is kind.";
const V2 = "It is not envious, it does not boast, it is not arrogant.";
const V3 = "It does not dishonor others, it is not self-seeking.";
/** The chapter as the reader's records were made on it. */
const OLD = chapterOf(V1, V2, V3);

let n = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

/** The verse span of chapter text [start, end) as a record's verse fields, with its verse copy. */
function fieldsFor(chapter, needle) {
  const start = chapter.text.indexOf(needle);
  assert.notEqual(start, -1, `"${needle}" is in the chapter`);
  const q = quoteFields(chapter, start, start + needle.length);
  return { ...q, verseCopy: verseCopyFor(chapter, q.verse, q.endVerse), verseCopyAsOf: before };
}

const made = { client: "web/2026.09", contentVersion: OLDER, now: before };

/** A note on the words `needle`, as it was made on `chapter`. */
function noteOn(needle, extra = {}, chapter = OLD) {
  return createRecord("note", { ...where, ...fieldsFor(chapter, needle), body: "mine", marker: "note", ...extra }, { ...made, id: nextId() });
}

/** A highlight on the words `needle`. */
function highlightOn(needle, extra = {}, chapter = OLD) {
  return createRecord("highlight", { ...where, ...fieldsFor(chapter, needle), color: "yellow", ...extra }, { ...made, id: nextId() });
}

/** A note on whole verses `verse`..`endVerse` (no quote), with the verse copy of `chapter`. */
function wholeNote(verse, endVerse = verse, extra = {}, chapter = OLD) {
  return createRecord(
    "note",
    {
      ...where,
      verse,
      ...(endVerse !== verse ? { endVerse } : {}),
      verseCopy: verseCopyFor(chapter, verse, endVerse),
      verseCopyAsOf: before,
      body: "mine",
      marker: "note",
      ...extra,
    },
    { ...made, id: nextId() },
  );
}

const noticeOf = (chapter, record, version = VERSION) => changeNotice(chapter, record, version);

/* The same chapter after a later publish, one change each. */
const REWORDED = chapterOf(V1, "It is not envious, it never brags, it is not arrogant.", V3);
const REWRITTEN = chapterOf(V1, "Charity does not envy.", V3);
const MOVED = chapterOf("Love is patient, love is kind. It does not boast.", "It is not envious, it is not arrogant.", V3);
const GONE = new Map([
  [1, V1],
  [3, V3],
]);
const WITHOUT_V2 = assembleChapter(GONE);

/* ── The kinds ───────────────────────────────────────────────────────── */

test("the kinds of notice", () => {
  assert.deepEqual([...NOTICE_KINDS], ["changed", "verse", "lost", "reworded", "whole"]);
  assert.ok(Object.isFrozen(NOTICE_KINDS));
});

/* ── Which records can carry a notice ────────────────────────────────── */

test("only a note on verses or a highlight can carry a notice", () => {
  const bookmark = createRecord("bookmark", { ...where, verse: 2 }, { ...made, id: nextId() });
  assert.equal(noticeOf(WITHOUT_V2, bookmark), null);
  assert.equal(noticeOf(WITHOUT_V2, null), null);
  assert.equal(noticeOf(WITHOUT_V2, undefined), null);
  assert.equal(noticeOf(WITHOUT_V2, { kind: "label", name: "x" }), null);
});

test("a note on a glossary entry, an article or a term (glossaryId) is not a mark on verses", () => {
  const onEntry = createRecord("note", { glossaryEntry: "flesh-body", body: "x", marker: "note", ...fieldsFor(OLD, "does not boast") }, { ...made, id: nextId() });
  const onArticle = createRecord("note", { article: "why-lit", body: "x", marker: "note", ...fieldsFor(OLD, "does not boast") }, { ...made, id: nextId() });
  const onTerm = createRecord("note", { glossaryId: "flesh-body", body: "x", marker: "note", ...fieldsFor(OLD, "does not boast") }, { ...made, id: nextId() });
  for (const r of [onEntry, onArticle, onTerm]) assert.equal(noticeOf(REWRITTEN, r), null);
});

test("a record without a book, chapter or whole-number verse is not placed", () => {
  const base = noteOn("does not boast");
  const { bookKey: _b, ...noBook } = base;
  assert.equal(noticeOf(REWRITTEN, noBook), null);
  assert.equal(noticeOf(REWRITTEN, { ...base, chapter: "8" }), null);
  assert.equal(noticeOf(REWRITTEN, { ...base, chapter: 8.5 }), null);
  assert.equal(noticeOf(REWRITTEN, { ...base, verse: "2" }), null);
  assert.equal(noticeOf(REWRITTEN, { ...base, verse: undefined }), null);
  assert.equal(noticeOf(REWRITTEN, { ...base, endVerse: "3" }), null);
  // Sanity: the unbroken record does get a notice.
  assert.equal(noticeOf(REWRITTEN, base).kind, "verse");
});

test("a record made on newer text than the page has gets no notice, whatever happened to its words", () => {
  for (const chapter of [REWORDED, REWRITTEN, WITHOUT_V2]) {
    assert.equal(noticeOf(chapter, noteOn("does not boast", { contentVersion: LATER })), null);
    assert.equal(noticeOf(chapter, highlightOn("does not boast", { contentVersion: LATER })), null);
  }
  assert.equal(noticeOf(WITHOUT_V2, wholeNote(2, 2, { contentVersion: LATER })), null);
});

test("a record on the same text, on older text, or on text the page can't order against, is judged", () => {
  assert.equal(noticeOf(REWRITTEN, noteOn("does not boast", { contentVersion: VERSION })).kind, "verse");
  assert.equal(noticeOf(REWRITTEN, noteOn("does not boast", { contentVersion: OLDER })).kind, "verse");
  assert.equal(noticeOf(REWRITTEN, noteOn("does not boast", { contentVersion: SAME_DAY })).kind, "verse", "two publishes on one day");
  assert.equal(noticeOf(REWRITTEN, noteOn("does not boast", { contentVersion: "unversioned" })).kind, "verse");
});

/* ── Words still found: nothing to say ───────────────────────────────── */

test("a mark whose words are still found carries no notice", () => {
  assert.equal(noticeOf(OLD, noteOn("does not boast")), null);
  assert.equal(noticeOf(OLD, highlightOn("does not boast")), null);
  // Elsewhere in the chapter ("moved") is still the reader's words.
  assert.equal(noticeOf(MOVED, noteOn("does not boast")), null);
  assert.equal(noticeOf(MOVED, highlightOn("does not boast")), null);
});

test("words still found carry no notice even when the verse around them was reworded", () => {
  const around = chapterOf(V1, "It is not envious, it does not boast, it is not puffed up.", V3);
  assert.equal(noticeOf(around, noteOn("does not boast")), null);
  assert.equal(noticeOf(around, highlightOn("does not boast")), null);
});

/* ── Changed ─────────────────────────────────────────────────────────── */

test("the words are gone but their context survives: changed, with exactly what changed", () => {
  const note = noteOn("does not boast");
  const notice = noticeOf(REWORDED, note);
  assert.equal(notice.kind, "changed");
  assert.equal(notice.status, "changed");
  assert.equal(REWORDED.text.slice(notice.start, notice.end), "never brags");
  assert.equal(notice.before, V2);
  assert.equal(notice.now, "It is not envious, it never brags, it is not arrogant.");
  assert.deepEqual(notice.diff, wordingDiff(notice.before, notice.now));
  assert.deepEqual(
    notice.diff.filter((r) => r.op !== "same").map((r) => [r.op, r.text]),
    [["del", "does not boast,"], ["ins", "never brags,"]],
  );
  assert.equal(noticeOf(REWORDED, highlightOn("does not boast")).kind, "changed", "and so for a highlight");
});

test("a quote that failed only on typography raises no notice (verse copy: straight quotes then, curly now)", () => {
  const then = chapterOf(`He said, "Do not be afraid." Then he left.`);
  const today = chapterOf("He said, “Do not be afraid.” Then he left.");
  for (const make of [noteOn, highlightOn]) {
    const record = make(`"Do not be afraid."`, {}, then);
    assert.equal(typeof record.verseCopy, "string");
    // The format keeps quotes as written, so the quote is no longer found: a "changed" placement…
    assert.equal(placeRecord(today, record).status, "changed");
    // …but nobody's words moved, so there is nothing to tell the reader.
    assert.equal(noticeOf(today, record), null);
  }
  // The marked words decide, not the rest of the verse: here the verse was
  // also reworded after them, but the words the mark sits on are the same.
  const after = chapterOf("He said, “Do not be afraid.” Then he went away.");
  const record = highlightOn(`"Do not be afraid."`, {}, then);
  assert.equal(placeRecord(after, record).status, "changed");
  assert.equal(noticeOf(after, record), null);
});

test("a whole-verse note whose verse copy differs only in typography raises no notice either", () => {
  const then = chapterOf(`He said, "Don't be afraid" (verses 9-11).`);
  const today = chapterOf("He said, “Don’t be afraid” (verses 9–11).");
  assert.equal(noticeOf(today, wholeNote(1, 1, {}, then)), null);
});

test("a record with no verse copy (made in an app) is compared by its quote against the words now marked", () => {
  const then = chapterOf(`He said, "Do not be afraid." Then he left.`);
  const today = chapterOf("He said, “Do not be afraid.” Then he left.");
  const fromApp = (record) => {
    const { verseCopy: _c, verseCopyAsOf: _a, ...bare } = record;
    return bare;
  };
  // Typography only: the quote and the words now there agree once evened out.
  const bare = fromApp(noteOn(`"Do not be afraid."`, {}, then));
  assert.equal(placeRecord(today, bare).status, "changed");
  assert.equal(noticeOf(today, bare), null);
  // A real change: the words now there differ. There is no copy to show, so no before or diff.
  const rewritten = chapterOf("He said, “Fear nothing.” Then he left.");
  const notice = noticeOf(rewritten, fromApp(noteOn(`"Do not be afraid."`, {}, then)));
  assert.equal(notice.kind, "changed");
  assert.equal(rewritten.text.slice(notice.start, notice.end), "“Fear nothing.”");
  assert.equal(notice.before, null);
  assert.equal(notice.diff, null);
  assert.equal(notice.now, "He said, “Fear nothing.” Then he left.", "today's verse is still shown");
});

test("a verse copy that isn't a string is ignored", () => {
  const notice = noticeOf(REWORDED, noteOn("does not boast", { verseCopy: 7 }));
  assert.equal(notice.kind, "changed");
  assert.equal(notice.before, null);
  assert.equal(notice.diff, null);
});

/* ── Whole verses ────────────────────────────────────────────────────── */

test("nothing usable is left: the mark has fallen to whole verses", () => {
  const notice = noticeOf(REWRITTEN, noteOn("does not boast"));
  assert.equal(notice.kind, "verse");
  assert.equal(notice.status, "verse");
  assert.equal(REWRITTEN.text.slice(notice.start, notice.end), "Charity does not envy.");
  assert.equal(notice.before, V2);
  assert.equal(notice.now, "Charity does not envy.");
  assert.ok(notice.diff.some((r) => r.op !== "same"));
  assert.equal(noticeOf(REWRITTEN, highlightOn("does not boast")).kind, "verse");
});

test("falling to whole verses is always a notice, even when the words are the same once typography is evened out", () => {
  const then = chapterOf(`"Peace!"`);
  const today = chapterOf("“Peace!”");
  // No context to find the words by, and quotes are kept as written: whole verse.
  const record = createRecord(
    "note",
    { ...where, verse: 1, quote: { exact: `"Peace!"`, prefix: "", suffix: "" }, verseCopy: then.text, verseCopyAsOf: before, body: "x", marker: "note" },
    { ...made, id: nextId() },
  );
  const notice = noticeOf(today, record);
  assert.equal(notice.kind, "verse");
  assert.deepEqual(notice.diff, [{ op: "same", text: "“Peace!”", lead: "" }], "and the diff shows nothing changed");
});

/* ── Lost ────────────────────────────────────────────────────────────── */

test("the record's verses are gone: lost, with nowhere to draw it", () => {
  for (const record of [noteOn("does not boast"), highlightOn("does not boast"), wholeNote(2)]) {
    const notice = noticeOf(WITHOUT_V2, record);
    assert.equal(notice.kind, "lost");
    assert.equal(notice.status, "lost");
    assert.equal(notice.start, null);
    assert.equal(notice.end, null);
    assert.equal(notice.before, record.verseCopy);
    assert.equal(notice.now, null);
    assert.equal(notice.diff, null);
  }
});

test("a note on a range is lost only when none of its verses is left", () => {
  const range = wholeNote(2, 3);
  assert.equal(noticeOf(chapterOf(V1), range).kind, "lost");
  // With verse 2 gone and verse 3 still there, the range still has text, now shorter.
  const notice = noticeOf(WITHOUT_V2, range);
  assert.equal(notice.kind, "reworded");
  assert.equal(notice.now, V3);
});

/* ── Reworded ────────────────────────────────────────────────────────── */

test("a note on whole verses whose verses read differently since: reworded", () => {
  const note = wholeNote(2);
  const notice = noticeOf(REWORDED, note);
  assert.equal(notice.kind, "reworded");
  assert.equal(notice.status, "found");
  assert.equal(REWORDED.text.slice(notice.start, notice.end), notice.now);
  assert.equal(notice.before, V2);
  assert.ok(notice.diff.some((r) => r.op === "ins" && r.text === "never brags,"));
});

test("a note on several whole verses is reworded when any of them is", () => {
  const range = wholeNote(2, 3);
  const after = chapterOf(V1, V2, "It does not shame others, it is not self-seeking.");
  const notice = noticeOf(after, range);
  assert.equal(notice.kind, "reworded");
  assert.equal(notice.before, `${V2} ${V3}`);
  assert.equal(notice.now, `${V2} It does not shame others, it is not self-seeking.`);
  assert.equal(noticeOf(OLD, range), null, "and none when they read the same");
});

test("a whole-verse note is not reworded by typography, by a missing verse copy, or by a verse beside it", () => {
  assert.equal(noticeOf(OLD, wholeNote(2)), null);
  const { verseCopy: _c, ...noCopy } = wholeNote(2);
  assert.equal(noticeOf(REWORDED, noCopy), null, "nothing to compare against");
  assert.equal(noticeOf(chapterOf(V1, V2, "A new third verse."), wholeNote(2)), null);
});

test("reworded is for notes alone: a highlight or a quoted note whose words are found has none", () => {
  assert.equal(noticeOf(REWORDED, highlightOn("It is not envious")), null);
  assert.equal(noticeOf(REWORDED, noteOn("It is not envious")), null);
});

/* ── planKeep: the records Keep writes ───────────────────────────────── */

const clean = (r) => JSON.parse(JSON.stringify(r));

function keep(chapter, record, extra = {}) {
  const notice = noticeOf(chapter, record);
  const out = planKeep({ text: chapter, record, notice, now: NOW, ctx, ...extra });
  return { notice, out };
}

/** The invariants every Keep result keeps. */
function assertKept(record, out) {
  assert.deepEqual(validateRecord(out), []);
  assert.equal(out.id, record.id);
  assert.equal(out.created, record.created);
  assert.equal(out.modified, NOW, "modified moves when the reader acts (principle 4)");
  assert.equal(out.client, ctx.client);
  assert.equal(out.contentVersion, ctx.contentVersion);
  assert.equal(out.verseCopyAsOf, NOW);
  assert.equal(out.body, record.body);
  assert.equal(out.color, record.color);
}

test("Keep on changed words: the quote, verses and verse copy follow the words now marked", () => {
  const record = noteOn("does not boast", { future: { keep: "me" } });
  const frozen = clean(record);
  const { out } = keep(REWORDED, record);
  assertKept(record, out);
  assert.equal(out.quote.exact, "never brags");
  assert.equal(out.quote.prefix, REWORDED.text.slice(REWORDED.text.indexOf("never brags") - 32, REWORDED.text.indexOf("never brags")));
  assert.equal(out.verse, 2);
  assert.equal(out.endVerse, 2);
  assert.equal(out.verseCopy, "It is not envious, it never brags, it is not arrogant.");
  assert.deepEqual(out.future, { keep: "me" }, "fields this code doesn't know survive");
  assert.deepEqual(clean(record), frozen, "the record it was given is untouched");
  assert.equal(noticeOf(REWORDED, out), null, "and the notice does not come back");
});

test("Keep on a highlight whose words changed", () => {
  const record = highlightOn("does not boast");
  const { out } = keep(REWORDED, record);
  assertKept(record, out);
  assert.equal(out.kind, "highlight");
  assert.equal(out.quote.exact, "never brags");
  assert.equal(noticeOf(REWORDED, out), null);
});

test("Keep on changed words follows them to the verses they now stand in", () => {
  // A mark that began across verses 2–3, whose words now stand in verse 3 alone.
  const then = OLD;
  const record = noteOn("dishonor", { verse: 2, endVerse: 3 }, then);
  assert.equal(record.endVerse, 3);
  const after = chapterOf(V1, V2, "It does not shame others, it is not self-seeking.");
  const { notice, out } = keep(after, record);
  assert.equal(notice.kind, "changed");
  assertKept(record, out);
  assert.equal(out.quote.exact, "shame");
  assert.equal(out.verse, 3);
  assert.equal(out.endVerse, 3);
  assert.equal(out.verseCopy, "It does not shame others, it is not self-seeking.");
  assert.equal(noticeOf(after, out), null);
});

test("Keep on changed words that now cross verses names both", () => {
  const record = noteOn("arrogant. It does");
  assert.deepEqual([record.verse, record.endVerse], [2, 3]);
  const after = chapterOf(V1, V2, "It must not dishonor others, it is not self-seeking.");
  const { notice, out } = keep(after, record);
  assert.equal(notice.kind, "changed");
  assertKept(record, out);
  assert.equal(out.quote.exact, "arrogant. It must");
  assert.deepEqual([out.verse, out.endVerse], [2, 3]);
  assert.equal(out.verseCopy, verseCopyFor(after, 2, 3));
  assert.equal(noticeOf(after, out), null);
});

test("Keep on whole verses: a note loses its quote entirely and keeps its verses", () => {
  const record = noteOn("does not boast", { future: 1 });
  assert.ok("quote" in record);
  const frozen = clean(record);
  const { out } = keep(REWRITTEN, record);
  assertKept(record, out);
  assert.equal("quote" in out, false, "the key is absent, not undefined");
  assert.equal(Object.hasOwn(out, "quote"), false);
  assert.equal(out.verse, 2);
  assert.equal(out.endVerse, 2);
  assert.equal(out.verseCopy, "Charity does not envy.");
  assert.equal(out.future, 1);
  assert.deepEqual(clean(record), frozen);
  assert.equal(noticeOf(REWRITTEN, out), null, "now a note on a whole verse that reads as it did");
});

test("Keep on whole verses: a highlight's quote becomes the whole range, and its verses stay", () => {
  const record = highlightOn("does not boast");
  const { notice, out } = keep(REWRITTEN, record);
  assertKept(record, out);
  assert.equal(out.quote.exact, "Charity does not envy.");
  assert.equal(out.quote.exact, REWRITTEN.text.slice(notice.start, notice.end));
  assert.equal(out.verse, 2);
  assert.equal(out.endVerse, 2);
  assert.equal(out.verseCopy, "Charity does not envy.");
  assert.equal(noticeOf(REWRITTEN, out), null);
});

test("Keep on whole verses spanning a range covers every verse that is still there", () => {
  const record = highlightOn("boast, it is not arrogant. It does not dishonor");
  const after = chapterOf(V1, "Charity does not envy.", "It is gentle.");
  const { notice, out } = keep(after, record);
  assert.equal(notice.kind, "verse");
  assertKept(record, out);
  assert.equal(out.quote.exact, "Charity does not envy. It is gentle.");
  assert.deepEqual([out.verse, out.endVerse], [2, 3]);
  const note = noteOn("boast, it is not arrogant. It does not dishonor");
  const kept = keep(after, note).out;
  assert.equal("quote" in kept, false);
  assert.deepEqual([kept.verse, kept.endVerse], [2, 3]);
});

test("Keep on a reworded whole-verse note retakes the verse copy and nothing else", () => {
  const record = wholeNote(2, 2, { future: "x" });
  const { notice, out } = keep(REWORDED, record);
  assert.equal(notice.kind, "reworded");
  assertKept(record, out);
  assert.equal(out.verseCopy, "It is not envious, it never brags, it is not arrogant.");
  assert.equal("quote" in out, false);
  assert.deepEqual({ ...out, verseCopy: 0, verseCopyAsOf: 0, contentVersion: 0, modified: 0, client: 0 }, { ...record, verseCopy: 0, verseCopyAsOf: 0, contentVersion: 0, modified: 0, client: 0 });
  assert.equal(noticeOf(REWORDED, out), null);
});

test("Keep without a clock uses the clock, and still moves modified", () => {
  const record = noteOn("does not boast");
  const notice = noticeOf(REWORDED, record);
  const out = planKeep({ text: REWORDED, record, notice, ctx });
  assert.deepEqual(validateRecord(out), []);
  assert.ok(Date.parse(out.modified) > Date.parse(record.modified));
  assert.equal(out.verseCopyAsOf, out.modified);
});

test("Keep writes nothing for a lost notice, no notice, or a record this client can't edit", () => {
  const lost = noteOn("does not boast");
  const lostNotice = noticeOf(WITHOUT_V2, lost);
  assert.equal(lostNotice.kind, "lost");
  assert.equal(planKeep({ text: WITHOUT_V2, record: lost, notice: lostNotice, now: NOW, ctx }), null);
  assert.equal(planKeep({ text: OLD, record: lost, notice: null, now: NOW, ctx }), null);

  const newer = { ...noteOn("does not boast"), schema: 2 };
  assert.equal(planKeep({ text: REWORDED, record: newer, notice: noticeOf(REWORDED, newer), now: NOW, ctx }), null);
  const unknown = { ...noteOn("does not boast"), kind: "constellation" };
  assert.equal(planKeep({ text: REWORDED, record: unknown, notice: { kind: "changed", start: 0, end: 3 }, now: NOW, ctx }), null);
  assert.equal(planKeep({ text: REWORDED, record: null, notice: { kind: "changed", start: 0, end: 3 }, now: NOW, ctx }), null);
});

test("Keep ignores a notice that doesn't fit the record", () => {
  const record = noteOn("does not boast");
  assert.equal(planKeep({ text: REWORDED, record, notice: { kind: "whole", start: null, end: null }, now: NOW, ctx }), null);
  assert.equal(planKeep({ text: REWORDED, record, notice: { kind: "changed", start: null, end: null }, now: NOW, ctx }), null);
  assert.equal(planKeep({ text: REWORDED, record, notice: { kind: "mystery" }, now: NOW, ctx }), null);
});

/* ── mayKeep ─────────────────────────────────────────────────────────── */

test("Keep is allowed when the record was made on this text or older", () => {
  assert.equal(mayKeep({ contentVersion: OLDER }, VERSION), true);
  assert.equal(mayKeep({ contentVersion: VERSION }, VERSION), true);
  assert.equal(mayKeep({ contentVersion: OLDER }, VERSION, "v20270101.00000000"), true, "an older record needs no live check");
});

test("Keep is refused when the record was made on newer text, whatever the live version says", () => {
  assert.equal(mayKeep({ contentVersion: LATER }, VERSION), false);
  assert.equal(mayKeep({ contentVersion: LATER }, VERSION, VERSION), false);
});

test("two publishes on one day can't be ordered: Keep only if the page holds the newest text there is", () => {
  const record = { contentVersion: SAME_DAY };
  assert.equal(mayKeep(record, VERSION), false, "no live version fetched yet");
  assert.equal(mayKeep(record, VERSION, null), false);
  assert.equal(mayKeep(record, VERSION, "v20261005.99999999"), false, "a newer publish exists than the page has");
  assert.equal(mayKeep(record, VERSION, VERSION), true, "the page is the newest: no record can be on newer text");
  assert.equal(mayKeep({}, VERSION), false, "a record with no version is unorderable too");
  assert.equal(mayKeep({}, VERSION, VERSION), true);
});

/* ── excerptDiff ─────────────────────────────────────────────────────── */

const words = (prefix, count) => Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`).join(" ");

test("excerptDiff cuts long unchanged runs to the words beside the change", () => {
  const a = `${words("a", 20)} old ${words("b", 20)}`;
  const b = `${words("a", 20)} new ${words("b", 20)}`;
  const runs = excerptDiff(wordingDiff(a, b));
  assert.deepEqual(runs.map((r) => [r.op, r.text]), [
    ["same", "… a15 a16 a17 a18 a19 a20"],
    ["del", "old"],
    ["ins", "new"],
    ["same", "b1 b2 b3 b4 b5 b6 …"],
  ]);
});

test("excerptDiff cuts a long middle run to both its ends, and leaves short ones whole", () => {
  const a = `${words("a", 3)} old1 ${words("m", 15)} old2 ${words("z", 3)}`;
  const b = `${words("a", 3)} new1 ${words("m", 15)} new2 ${words("z", 3)}`;
  const runs = excerptDiff(wordingDiff(a, b));
  assert.deepEqual(runs.map((r) => [r.op, r.text]), [
    ["same", "a1 a2 a3"],
    ["del", "old1"],
    ["ins", "new1"],
    ["same", "m1 m2 m3 m4 m5 m6 … m10 m11 m12 m13 m14 m15"],
    ["del", "old2"],
    ["ins", "new2"],
    ["same", "z1 z2 z3"],
  ]);
  const short = `${words("a", 3)} old1 ${words("m", 12)} old2 ${words("z", 3)}`.replace("old1", "new1").replace("old2", "new2");
  const kept = excerptDiff(wordingDiff(`${words("a", 3)} old1 ${words("m", 12)} old2 ${words("z", 3)}`, short));
  assert.equal(kept[3].text, words("m", 12), "12 words is not more than 2 × 6");
});

test("excerptDiff never shortens a deletion or an insertion, and keeps each run's lead", () => {
  const long = words("x", 30);
  const runs = excerptDiff(wordingDiff(`start ${long} end`, "start end"));
  assert.deepEqual(runs.map((r) => [r.op, r.text, r.lead]), [
    ["same", "start", ""],
    ["del", long, " "],
    ["same", "end", " "],
  ]);
  const cut = excerptDiff(wordingDiff(`${words("a", 12)} old`, `${words("a", 12)} new`));
  assert.equal(cut[0].lead, "");
  assert.equal(cut[1].lead, " ");
  assert.equal(cut[2].lead, " ");
  assert.equal(cut.map((r) => r.lead + r.text).join(""), "… a7 a8 a9 a10 a11 a12 old new", "and they still read as one line");
});

test("excerptDiff takes a different context, and has nothing to show for a diff with no change", () => {
  const a = `${words("a", 10)} old ${words("b", 10)}`;
  const b = `${words("a", 10)} new ${words("b", 10)}`;
  const runs = excerptDiff(wordingDiff(a, b), { context: 2 });
  assert.equal(runs[0].text, "… a9 a10");
  assert.equal(runs.at(-1).text, "b1 b2 …");
  assert.deepEqual(excerptDiff(wordingDiff("the same words", "the same words")), []);
  assert.deepEqual(excerptDiff(wordingDiff(`“Don’t”`, `"Don't"`)), [], "typography alone is no change");
  assert.deepEqual(excerptDiff([]), []);
  assert.deepEqual(excerptDiff(wordingDiff("a b c", "a b c"), { context: 1 }), []);
});

test("excerptDiff leaves a short leading or trailing run as it is", () => {
  const runs = excerptDiff(wordingDiff("one two old three four", "one two new three four"));
  assert.deepEqual(runs.map((r) => r.text), ["one two", "old", "new", "three four"]);
});

/* ── noticeWords ─────────────────────────────────────────────────────── */

test("noticeWords: changed", () => {
  const notice = { kind: "changed" };
  assert.deepEqual(noticeWords(notice, { kind: "note", verse: 2 }, "Romans 8:2"), {
    title: "The wording changed",
    text: "Your note has been carried along to the words that now stand in place of the ones you marked.",
    keep: "Keep on the new words",
  });
  assert.equal(
    noticeWords(notice, { kind: "highlight", verse: 2 }, "Romans 8:2").text,
    "Your highlight has been carried along to the words that now stand in place of the ones you marked.",
  );
});

test("noticeWords: verse falls back to the whole verse, or the whole passage for a range", () => {
  const notice = { kind: "verse" };
  assert.deepEqual(noticeWords(notice, { kind: "note", verse: 2, endVerse: 2 }, "Romans 8:2"), {
    title: "The wording changed",
    text: "We couldn't find the words you marked, so your note is on the whole verse for now.",
    keep: "Keep on the whole verse",
  });
  assert.deepEqual(noticeWords(notice, { kind: "highlight", verse: 2, endVerse: 4 }, "Romans 8:2–4"), {
    title: "The wording changed",
    text: "We couldn't find the words you marked, so your highlight is on the whole passage for now.",
    keep: "Keep on the whole passage",
  });
  assert.equal(noticeWords(notice, { kind: "note", verse: 2 }, "Romans 8:2").keep, "Keep on the whole verse", "no endVerse is one verse");
});

test("noticeWords: whole, for a note on an entry or an article", () => {
  const notice = { kind: "whole" };
  assert.deepEqual(noticeWords(notice, { kind: "note", glossaryEntry: "flesh-body" }, "Glossary"), {
    title: "The wording changed",
    text: "We couldn't find the words you marked, so your note is on the whole entry for now.",
    keep: "Keep on the whole entry",
  });
  assert.deepEqual(noticeWords(notice, { kind: "note", article: "why-lit" }, "Article"), {
    title: "The wording changed",
    text: "We couldn't find the words you marked, so your note is on the whole article for now.",
    keep: "Keep on the whole article",
  });
});

test("noticeWords: lost names the reference and offers no Keep", () => {
  assert.deepEqual(noticeWords({ kind: "lost" }, { kind: "note", verse: 36 }, "Luke 17:36"), {
    title: "Not in the text",
    text: "Luke 17:36 isn't in the text any more, so your note can't be shown on the page.",
    keep: null,
  });
  assert.equal(
    noticeWords({ kind: "lost" }, { kind: "highlight", verse: 36 }, "Luke 17:36").text,
    "Luke 17:36 isn't in the text any more, so your highlight can't be shown on the page.",
  );
});

test("noticeWords: reworded", () => {
  assert.deepEqual(noticeWords({ kind: "reworded" }, { kind: "note", verse: 2 }, "Romans 8:2"), {
    title: "The wording changed",
    text: "The verse's wording changed after you wrote this note.",
    keep: "Keep",
  });
  assert.equal(
    noticeWords({ kind: "reworded" }, { kind: "note", verse: 2, endVerse: 3 }, "Romans 8:2–3").text,
    "The passage's wording changed after you wrote this note.",
  );
});

test("noticeWords uses straight apostrophes and covers every kind", () => {
  for (const kind of NOTICE_KINDS) {
    const words = noticeWords({ kind }, { kind: "note", verse: 2 }, "Romans 8:2");
    assert.ok(words.title && words.text, kind);
    assert.equal(/[‘’]/.test(words.title + words.text + (words.keep ?? "")), false, `${kind}: no curly apostrophe`);
  }
  assert.deepEqual(noticeWords(null, { kind: "note" }, ""), { title: "The wording changed", text: "", keep: null }, "nothing to say for no notice");
});

/* ── Prose notes (N11) ───────────────────────────────────────────────── */

const BODY = "Flesh is the body, and also the pull toward self-preservation that the letters name. It is not an insult.";
const PROSE = assembleChapter(new Map([[1, BODY]]));

function proseNote(needle, extra = {}, text = PROSE) {
  const start = text.text.indexOf(needle);
  assert.notEqual(start, -1);
  return createRecord(
    "note",
    { glossaryEntry: "flesh-body", targetTitle: "Flesh", quote: proseQuote(text, start, start + needle.length), body: "mine", marker: "note", ...extra },
    { ...made, id: nextId() },
  );
}
const proseOf = (body) => assembleChapter(new Map([[1, body]]));

test("proseNotice: words still found carry no notice", () => {
  assert.equal(proseNotice(PROSE, proseNote("self-preservation")), null);
  assert.equal(proseNotice(proseOf(`Intro. ${BODY}`), proseNote("self-preservation")), null);
});

test("proseNotice: the words changed but their context survives", () => {
  const record = proseNote("self-preservation");
  const after = proseOf(BODY.replace("self-preservation", "self-protection"));
  const notice = proseNotice(after, record);
  assert.equal(notice.kind, "changed");
  assert.equal(notice.status, "changed");
  assert.equal(after.text.slice(notice.start, notice.end), "self-protection");
  assert.deepEqual([notice.before, notice.now, notice.diff], [null, null, null]);
});

test("proseNotice: a change in typography alone is no notice", () => {
  const then = proseOf(`He called it "the flesh" - a word with a past.`);
  const record = proseNote(`"the flesh" - a word`, {}, then);
  const after = proseOf("He called it “the flesh” — a word with a past.");
  assert.equal(proseNotice(after, record), null);
});

test("proseNotice: nothing usable left falls to the whole entry", () => {
  const record = proseNote("self-preservation");
  const notice = proseNotice(proseOf("Something else entirely."), record);
  assert.equal(notice.kind, "whole");
  assert.equal(notice.status, "whole");
  assert.equal(notice.start, null);
  assert.equal(notice.end, null);
});

test("proseNotice: a note with no quote, no prose target, or on verses has none", () => {
  const { quote: _q, ...whole } = proseNote("self-preservation");
  assert.equal(proseNotice(proseOf("Something else entirely."), whole), null);
  assert.equal(proseNotice(PROSE, noteOn("does not boast")), null);
  assert.equal(proseNotice(PROSE, highlightOn("does not boast")), null);
  assert.equal(proseNotice(PROSE, null), null);
});

test("Keep on a prose note whose words changed follows them", () => {
  const record = proseNote("self-preservation", { future: 2 });
  const after = proseOf(BODY.replace("self-preservation", "self-protection"));
  const notice = proseNotice(after, record);
  const out = planKeep({ text: after, record, notice, now: NOW, ctx });
  assert.deepEqual(validateRecord(out), []);
  assert.equal(out.quote.exact, "self-protection");
  assert.deepEqual(out.quote, proseQuote(after, notice.start, notice.end));
  assert.equal(out.modified, NOW);
  assert.equal(out.contentVersion, ctx.contentVersion);
  assert.equal(out.glossaryEntry, "flesh-body");
  assert.equal(out.future, 2);
  assert.equal("verseCopy" in out, false, "prose notes keep no verse copy");
  assert.equal(proseNotice(after, out), null);
});

test("Keep on a prose note that fell to the whole entry drops its quote", () => {
  const record = proseNote("self-preservation");
  const after = proseOf("Something else entirely.");
  const notice = proseNotice(after, record);
  const out = planKeep({ text: after, record, notice, now: NOW, ctx });
  assert.deepEqual(validateRecord(out), []);
  assert.equal("quote" in out, false);
  assert.equal(out.glossaryEntry, "flesh-body");
  assert.equal(out.modified, NOW);
  assert.equal(proseNotice(after, out), null);
  assert.equal(planKeep({ text: after, record, notice: { kind: "verse" }, now: NOW, ctx }), null, "a verse notice has no meaning here");
});

/* ── The release note ────────────────────────────────────────────────── */

const change = (description, verse, extra = {}) => ({
  type: "text_updated",
  description,
  location: { bookKey: "romans", chapter: 8, verse },
  ...extra,
});
const ENTRIES = [
  {
    date: "2026-10-04",
    label: "October 4, 2026",
    changes: [{ type: "footnote_updated", description: "Romans 8:3 — footnote updated", location: { bookKey: "romans", chapter: 8, verse: 3 } }],
  },
  { date: "2026-10-04", label: "October 4, 2026", changes: [change("Romans 8:2–4, 10 — text updated", 2)] },
  { date: "2026-09-20", label: "September 20, 2026", changes: [change("Romans 8:5 — text updated", 5), { type: "text_updated", description: "John 3:16 — text updated", location: { bookKey: "john", chapter: 3, verse: 16 } }] },
  { date: "2026-08-01", label: "August 1, 2026", changes: [change("Romans 8:3 — text updated", 3)] },
];
const taken = (extra) => ({ bookKey: "romans", chapter: 8, verse: 3, contentVersion: OLDER, ...extra });

test("releaseNoteFor finds the newest entry that changed the record's verses", () => {
  const hit = releaseNoteFor(ENTRIES, taken());
  assert.deepEqual(hit, { date: "2026-10-04", label: "October 4, 2026", id: "2026-10-04", href: "/release-notes/#2026-10-04" });
});

test("releaseNoteFor uses the page's own ids, so two publishes on one day link to the right one", () => {
  const ids = entryIds(ENTRIES);
  assert.deepEqual(ids.slice(0, 2), ["2026-10-04-2", "2026-10-04"]);
  assert.equal(releaseNoteFor(ENTRIES, taken()).id, ids[1], "the text_updated one, not the footnote one above it");
  const both = [ENTRIES[1], { ...ENTRIES[1], changes: [change("Romans 8:3 — text updated", 3)] }, ...ENTRIES.slice(2)];
  const hit = releaseNoteFor(both, taken());
  assert.equal(hit.id, "2026-10-04-2", "the later publish of the day, which is first in the list");
  assert.equal(hit.href, "/release-notes/#2026-10-04-2");
});

test("releaseNoteFor counts only verse-text changes, never a footnote", () => {
  const onlyFootnote = [ENTRIES[0]];
  assert.equal(releaseNoteFor(onlyFootnote, taken()), null);
});

test("releaseNoteFor matches any verse in the record's range, in a list or a range of the entry", () => {
  assert.equal(releaseNoteFor(ENTRIES, taken({ verse: 10 })).id, "2026-10-04", "10 is in the list");
  assert.equal(releaseNoteFor(ENTRIES, taken({ verse: 9, endVerse: 11 })).id, "2026-10-04", "a range reaching 10");
  assert.equal(releaseNoteFor(ENTRIES, taken({ verse: 4 })).id, "2026-10-04", "the end of 2–4");
  assert.equal(releaseNoteFor(ENTRIES, taken({ verse: 5, endVerse: 6 })).id, "2026-09-20");
  assert.equal(releaseNoteFor(ENTRIES, taken({ verse: 6, endVerse: 9 })), null, "nothing touched 6 to 9");
  assert.equal(releaseNoteFor(ENTRIES, taken({ verse: 1 })), null);
});

test("releaseNoteFor is for the record's own book and chapter", () => {
  assert.equal(releaseNoteFor(ENTRIES, taken({ chapter: 9 })), null);
  assert.equal(releaseNoteFor(ENTRIES, taken({ bookKey: "john", chapter: 3, verse: 16 })).id, "2026-09-20");
  assert.equal(releaseNoteFor(ENTRIES, taken({ bookKey: "john", chapter: 8, verse: 3 })), null);
});

test("releaseNoteFor ignores entries from before the record's text was taken, and counts the day itself", () => {
  assert.equal(releaseNoteFor(ENTRIES, taken({ contentVersion: "v20261005.5d2c847d" })), null, "everything is older");
  assert.equal(releaseNoteFor(ENTRIES, taken({ contentVersion: "v20261004.5d2c847d" })).id, "2026-10-04", "the same day may be a later publish");
  assert.equal(releaseNoteFor(ENTRIES, taken({ verse: 5, contentVersion: "v20260920.00000000" })).id, "2026-09-20");
  assert.equal(releaseNoteFor(ENTRIES, taken({ verse: 5, contentVersion: "v20260921.00000000" })), null);
});

test("releaseNoteFor dates the record from its content version, then its verse copy, then its creation", () => {
  const noVersion = { bookKey: "romans", chapter: 8, verse: 5 };
  assert.equal(releaseNoteFor(ENTRIES, { ...noVersion, contentVersion: "unversioned", verseCopyAsOf: "2026-09-20T01:00:00.000Z" }).id, "2026-09-20");
  assert.equal(releaseNoteFor(ENTRIES, { ...noVersion, verseCopyAsOf: "2026-09-21T01:00:00.000Z" }), null);
  assert.equal(releaseNoteFor(ENTRIES, { ...noVersion, created: "2026-09-01T00:00:00.000Z" }).id, "2026-09-20");
  assert.equal(releaseNoteFor(ENTRIES, { ...noVersion, verseCopyAsOf: "soon", created: "2026-09-01T00:00:00.000Z" }).id, "2026-09-20");
  assert.equal(releaseNoteFor(ENTRIES, noVersion), null, "no date to go by");
  assert.equal(releaseNoteFor(ENTRIES, { ...noVersion, contentVersion: "v20260801.00000000", verseCopyAsOf: "2026-10-09T00:00:00.000Z" }).id, "2026-09-20", "the content version wins");
});

test("releaseNoteFor copes with nothing to look at", () => {
  assert.equal(releaseNoteFor([], taken()), null);
  assert.equal(releaseNoteFor(undefined, taken()), null);
  assert.equal(releaseNoteFor(ENTRIES, null), null);
  assert.equal(releaseNoteFor(ENTRIES, { ...taken(), verse: undefined }), null);
  assert.equal(releaseNoteFor([{ date: "2026-10-04", label: "x" }], taken()), null, "an entry with no changes");
});

test("releaseNoteFor reads the older rows that have no location from their description", () => {
  const old = [{ date: "2026-05-28", label: "May 28, 2026", changes: [{ type: "text_updated", description: "John 1:49 — text updated" }] }];
  assert.equal(releaseNoteFor(old, { bookKey: "john", chapter: 1, verse: 49, contentVersion: "v20260101.00000000" }).id, "2026-05-28");
  assert.equal(releaseNoteFor(old, { bookKey: "john", chapter: 1, verse: 48, contentVersion: "v20260101.00000000" }), null);
});

/* ── Which verses a release-notes change touched ─────────────────────── */

test("changeVerses reads the description's list of verses and ranges", () => {
  const read = (description, location) => changeVerses({ type: "text_updated", description, ...(location ? { location } : {}) });
  assert.deepEqual(read("Romans 8:3 — text updated"), { bookKey: "romans", chapter: 8, ranges: [[3, 3]] });
  assert.deepEqual(read("Luke 11:2, 20, 43–44, 47 — text updated"), { bookKey: "luke", chapter: 11, ranges: [[2, 2], [20, 20], [43, 44], [47, 47]] });
  assert.deepEqual(read("1 Corinthians 5:10–11 — text updated"), { bookKey: "1corinthians", chapter: 5, ranges: [[10, 11]] });
  assert.deepEqual(read("Luke 13:32-35 — text updated"), { bookKey: "luke", chapter: 13, ranges: [[32, 35]] }, "a hyphen reads as a range too");
  assert.deepEqual(
    read("Romans 16:24 and 25–27 — now bracketed as contested text, the same marking used at Mark 16:9–20 and John 7:53–8:11"),
    { bookKey: "romans", chapter: 16, ranges: [[24, 24], [25, 27]] },
    "only the part before the dash is the verse list",
  );
  assert.deepEqual(read("John 7:53–8:11 — text updated"), { bookKey: "john", chapter: 7, ranges: [[53, Infinity]] }, "a run into the next chapter takes the rest of this one");
});

test("changeVerses falls back to the detail's verse labels, then to location.verse", () => {
  const location = { bookKey: "luke", chapter: 1, verse: 38 };
  assert.deepEqual(
    changeVerses({ description: "Luke 1 — text updated", detail: `v. 38: "Sovereign;" → "Lord;"; v. 43: "Sovereign" → "Lord"; fn. b: "a" → "b"`, location }),
    { bookKey: "luke", chapter: 1, ranges: [[38, 38], [43, 43]] },
    "footnote labels are not verses",
  );
  assert.deepEqual(changeVerses({ description: "Luke 1 — text updated", location }), { bookKey: "luke", chapter: 1, ranges: [[38, 38]] });
  assert.equal(changeVerses({ description: "Luke 1 — text updated", location: { bookKey: "luke", chapter: 1 } }), null);
  assert.equal(changeVerses({ description: "Something else" }), null);
  assert.equal(changeVerses(null), null);
});

test("changeVerses trusts location for the chapter, and won't read a verse list from another chapter", () => {
  assert.deepEqual(
    changeVerses({ description: "Luke 2:5 — text updated", location: { bookKey: "luke", chapter: 3, verse: 9 } }),
    { bookKey: "luke", chapter: 3, ranges: [[9, 9]] },
  );
});

test("every text_updated change in the real release notes yields its verses, agreeing with its location and detail", () => {
  const entries = JSON.parse(readFileSync(new URL("../src/data/release-notes.json", import.meta.url), "utf8"));
  let checked = 0;
  let withDetail = 0;
  for (const entry of entries) {
    for (const c of entry.changes) {
      if (c.type !== "text_updated") continue;
      checked++;
      const v = changeVerses(c);
      assert.ok(v && v.ranges.length > 0, `no verses read from "${c.description}" (${entry.date})`);
      assert.ok(v.ranges.every(([a, b]) => Number.isInteger(a) && a >= 1 && b >= a), `bad range in "${c.description}"`);
      if (c.location) {
        assert.equal(v.bookKey, c.location.bookKey, `book of "${c.description}"`);
        assert.equal(v.chapter, c.location.chapter, `chapter of "${c.description}"`);
        if (c.location.verse != null) {
          assert.ok(v.ranges.some(([a, b]) => a <= c.location.verse && c.location.verse <= b), `location.verse of "${c.description}"`);
        }
      }
      // The description and the detail are written by the same drafter and must agree.
      for (const s of parseDetail(c.detail) ?? []) {
        const label = /^v\. (\d+)$/.exec(s.label ?? "");
        if (!label) continue;
        withDetail++;
        assert.ok(v.ranges.some(([a, b]) => a <= Number(label[1]) && Number(label[1]) <= b), `detail verse ${label[1]} of "${c.description}"`);
      }
      // A record on the first changed verse, made long before, is pointed at an entry no older than this one.
      const record = { bookKey: v.bookKey, chapter: v.chapter, verse: v.ranges[0][0], contentVersion: "v20200101.00000000" };
      const hit = releaseNoteFor(entries, record);
      assert.ok(hit, `no release note found for "${c.description}"`);
      assert.ok(hit.date >= entry.date, `"${c.description}" (${entry.date}) found an older entry ${hit.date}`);
    }
  }
  assert.ok(checked > 200, `the real file has plenty of text_updated changes (read ${checked})`);
  assert.ok(withDetail > 200, "and plenty of verse labels to cross-check against");
});
