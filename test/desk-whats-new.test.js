// test/desk-whats-new.test.js
//
// src/lib/desk-whats-new.mjs: "What's new for you" (STUDY-DESK.md B3) and the
// "Verses in my notebook" filter (M10). What these guard: a publish is news
// for a mark only when it touched the mark's own verses (overlap, not the
// chapter), only for the change types that alter a verse's wording or its
// footnotes, and only when it came out on or after the day the mark's text
// was taken, since a change the reader's mark was made on top of is not news
// to them. The last test runs the real release-notes feed, so a change to its
// wording that stops the description parsing shows up here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { changeVerses } from "../src/lib/desk-change.mjs";
import {
  isNewChange,
  markVerses,
  marksTouched,
  onAFootnote,
  seenMark,
  whatsNewForYou,
  whatsNewLine,
} from "../src/lib/desk-whats-new.mjs";

const romans4 = (description, type = "text_updated") => ({
  type,
  description,
  location: { bookKey: "romans", chapter: 4 },
});

const entry = (date, changes, label = date) => ({ version: `v${date}`, date, label, changes });

const MARK_CREATED = "2026-08-01T09:00:00.000Z";

test("markVerses gives a note, highlight or bookmark its verses, with a range's end", () => {
  assert.deepEqual(markVerses({ kind: "note", bookKey: "romans", chapter: 4, verse: 7 }), {
    bookKey: "romans",
    chapter: 4,
    from: 7,
    to: 7,
  });
  assert.deepEqual(markVerses({ kind: "highlight", bookKey: "romans", chapter: 4, verse: 6, endVerse: 9 }), {
    bookKey: "romans",
    chapter: 4,
    from: 6,
    to: 9,
  });
  assert.deepEqual(markVerses({ kind: "bookmark", bookKey: "romans", chapter: 4, verse: 6 }), {
    bookKey: "romans",
    chapter: 4,
    from: 6,
    to: 6,
  });
});

test("markVerses gives nothing for a glossary note, an article note, a label, or a note with no verse", () => {
  assert.equal(markVerses({ kind: "note", bookKey: "romans", chapter: 4, verse: 7, glossaryEntry: "flesh-body" }), null);
  assert.equal(markVerses({ kind: "note", bookKey: "romans", chapter: 4, verse: 7, article: "some-article" }), null);
  assert.equal(markVerses({ kind: "label", bookKey: "romans", chapter: 4, verse: 7 }), null);
  assert.equal(markVerses({ kind: "note", bookKey: "romans", chapter: 4 }), null, "a chapter-level note");
  assert.equal(markVerses(null), null);
});

test("marksTouched matches only the marks whose verses overlap the changed range", () => {
  const change = romans4("Romans 4:6–9 — text updated");
  const records = [
    { id: "after", kind: "note", bookKey: "romans", chapter: 4, verse: 10 },
    { id: "on-nine", kind: "note", bookKey: "romans", chapter: 4, verse: 9 },
    { id: "before", kind: "note", bookKey: "romans", chapter: 4, verse: 5 },
    { id: "straddles", kind: "note", bookKey: "romans", chapter: 4, verse: 5, endVerse: 6 },
    { id: "other-chapter", kind: "note", bookKey: "romans", chapter: 5, verse: 7 },
    { id: "highlight", kind: "highlight", bookKey: "romans", chapter: 4, verse: 6, color: "yellow" },
    { id: "glossary", kind: "note", bookKey: "romans", chapter: 4, verse: 7, glossaryEntry: "flesh-body" },
  ];
  assert.deepEqual(
    marksTouched(change, records).map((r) => r.id),
    ["on-nine", "straddles", "highlight"],
    "in the notebook's own order",
  );
});

test("marksTouched ignores intro, glossary and other change types, whatever they say", () => {
  const records = [{ id: "n", kind: "note", bookKey: "romans", chapter: 4, verse: 6 }];
  for (const type of ["intro_updated", "glossary_updated", "chapter_added", "article_updated"]) {
    const change = { type, description: "Romans 4:6 — changed", location: { bookKey: "romans", chapter: 4, verse: 6 } };
    assert.deepEqual(marksTouched(change, records), [], type);
  }
});

test("marksTouched counts a footnote change that names one of the reader's verses", () => {
  const records = [
    { id: "on-seven", kind: "note", bookKey: "romans", chapter: 4, verse: 7 },
    { id: "on-eight", kind: "note", bookKey: "romans", chapter: 4, verse: 8 },
  ];
  // The real shape: a footnote change whose verses are only in the description.
  const change = romans4("Romans 4:6–7, 9 — footnotes h, i, j, n updated", "footnote_updated");
  assert.deepEqual(marksTouched(change, records).map((r) => r.id), ["on-seven"]);

  const single = romans4("Romans 4:7 — footnote a updated", "footnote_added");
  assert.deepEqual(marksTouched(single, records).map((r) => r.id), ["on-seven"]);
});

test("whatsNewForYou drops a change published before the day the mark's text was taken", () => {
  const entries = [entry("2026-07-30", [romans4("Romans 4:6–9 — text updated")])];
  const marks = [{ id: "n", kind: "note", bookKey: "romans", chapter: 4, verse: 7, created: MARK_CREATED }];
  assert.deepEqual(whatsNewForYou(entries, marks), []);
});

test("whatsNewForYou counts a change published on the mark's own day", () => {
  const entries = [entry("2026-08-01", [romans4("Romans 4:6–9 — text updated")])];
  const marks = [{ id: "n", kind: "note", bookKey: "romans", chapter: 4, verse: 7, created: MARK_CREATED }];
  const found = whatsNewForYou(entries, marks);
  assert.equal(found.length, 1);
  assert.equal(found[0].changes[0].records[0].id, "n");
});

test("whatsNewForYou takes the day from the mark's content version over its creation time", () => {
  // The text was taken on 2026-09-05, so a change dated the 3rd is older than the text.
  const marks = [
    {
      id: "n",
      kind: "note",
      bookKey: "romans",
      chapter: 4,
      verse: 7,
      created: MARK_CREATED,
      contentVersion: "v20260905.abcdef12",
    },
  ];
  assert.deepEqual(whatsNewForYou([entry("2026-09-03", [romans4("Romans 4:6–9 — text updated")])], marks), []);
  assert.equal(whatsNewForYou([entry("2026-09-05", [romans4("Romans 4:6–9 — text updated")])], marks).length, 1);
});

test("whatsNewForYou honours since strictly: an entry on that day is not new", () => {
  const change = romans4("Romans 4:6–9 — text updated");
  const entries = [entry("2026-09-03", [change]), entry("2026-08-21", [romans4("Romans 4:6–9 — text updated")])];
  const marks = [{ id: "n", kind: "note", bookKey: "romans", chapter: 4, verse: 7, created: MARK_CREATED }];

  assert.deepEqual(
    whatsNewForYou(entries, marks, { since: "2026-09-03" }).map((e) => e.date),
    [],
    "the day of the last visit is not after it",
  );
  assert.deepEqual(
    whatsNewForYou(entries, marks, { since: "2026-08-21" }).map((e) => e.date),
    ["2026-09-03"],
  );
  assert.deepEqual(
    whatsNewForYou(entries, marks, { since: null }).map((e) => e.date),
    ["2026-09-03", "2026-08-21"],
    "no since means everything",
  );
});

test("whatsNewForYou returns entries newest first, with the release-notes link for each", () => {
  const change = romans4("Romans 4:6–9 — text updated");
  const entries = [entry("2026-09-03", [change]), entry("2026-08-21", [romans4("Romans 4:6–9 — text updated")], "August")];
  const marks = [{ id: "n", kind: "note", bookKey: "romans", chapter: 4, verse: 7, created: MARK_CREATED }];
  const found = whatsNewForYou(entries, marks);
  assert.deepEqual(
    found.map((e) => [e.id, e.href, e.date, e.label]),
    [
      ["2026-09-03", "/release-notes/#2026-09-03", "2026-09-03", "2026-09-03"],
      ["2026-08-21", "/release-notes/#2026-08-21", "2026-08-21", "August"],
    ],
  );
});

test("whatsNewForYou numbers two publishes on one day the way release-notes does", () => {
  // Counted from the oldest entry, so the plain id stays with it when a newer one is prepended.
  const entries = [entry("2026-09-03", [romans4("Romans 4:6–9 — text updated")]), entry("2026-09-03", [romans4("Romans 4:6–9 — text updated")])];
  const marks = [{ id: "n", kind: "note", bookKey: "romans", chapter: 4, verse: 7, created: MARK_CREATED }];
  assert.deepEqual(whatsNewForYou(entries, marks).map((e) => e.href), [
    "/release-notes/#2026-09-03-2",
    "/release-notes/#2026-09-03",
  ]);
});

test("whatsNewForYou keeps each change's index in its entry and drops changes that touch nothing", () => {
  const entries = [
    entry("2026-09-03", [
      { type: "intro_updated", description: "Romans intro — updated", location: { bookKey: "romans", chapter: 4 } },
      romans4("Romans 4:6–9 — text updated"),
      romans4("Romans 4:1 — text updated"),
    ]),
  ];
  const marks = [{ id: "n", kind: "note", bookKey: "romans", chapter: 4, verse: 7, created: MARK_CREATED }];
  const found = whatsNewForYou(entries, marks);
  assert.equal(found.length, 1);
  assert.deepEqual(
    found[0].changes.map((c) => [c.index, c.change.description]),
    [[1, "Romans 4:6–9 — text updated"]],
  );
});

test("whatsNewForYou tolerates a missing feed or notebook", () => {
  assert.deepEqual(whatsNewForYou(undefined, []), []);
  assert.deepEqual(whatsNewForYou([entry("2026-09-03", [romans4("Romans 4:6 — text updated")])], undefined), []);
});

test("whatsNewLine is null when nothing touches the reader's verses", () => {
  assert.equal(whatsNewLine([]), null);
  assert.equal(whatsNewLine(undefined), null);
  assert.equal(whatsNewLine([{ id: "x", changes: [] }]), null);
});

test("whatsNewLine words one change, and says since the last visit when asked", () => {
  assert.equal(whatsNewLine([{ changes: [1] }]), "One change touches your verses");
  assert.equal(whatsNewLine([{ changes: [1] }], { sinceVisit: true }), "One change since your last visit touches your verses");
});

test("whatsNewLine counts across entries and agrees on the plural", () => {
  const found = [{ changes: [1, 2] }, { changes: [3] }];
  assert.equal(whatsNewLine(found), "Three changes touch your verses");
  assert.equal(whatsNewLine(found, { sinceVisit: true }), "Three changes since your last visit touch your verses");
  assert.equal(whatsNewLine([{ changes: [1, 2] }]), "Two changes touch your verses");
});

test("whatsNewForYou finds the real feed's changes to Romans 4:7, Galatians 3:27 and Romans 8:28", () => {
  const entries = JSON.parse(readFileSync(new URL("../src/data/release-notes.json", import.meta.url), "utf8"));
  const marks = [
    { id: "rom4", kind: "note", bookKey: "romans", chapter: 4, verse: 7, created: MARK_CREATED },
    { id: "gal3", kind: "note", bookKey: "galatians", chapter: 3, verse: 27, created: MARK_CREATED },
    { id: "rom8", kind: "note", bookKey: "romans", chapter: 8, verse: 28, created: MARK_CREATED },
  ];
  const descriptions = whatsNewForYou(entries, marks).flatMap((e) => e.changes.map((c) => c.change.description));
  for (const wanted of [
    "Romans 4:6–9 — text updated",
    "Galatians 3:27 — text updated",
    "Romans 8:28 — text updated",
  ]) {
    assert.ok(descriptions.includes(wanted), `${wanted} is in what's new; found ${JSON.stringify(descriptions)}`);
  }
});

// A note on a footnote and a pinned footnote sit on a footnote, not on the
// verse's words (BA90; desk rule 23).
const noteOnFootnote = { id: "nf", kind: "note", footnote: "Because he wrote it.", n: "a", bookKey: "romans", chapter: 4, verse: 7 };
const pin = { id: "pin", kind: "footnotePin", bookKey: "romans", chapter: 4, verse: 7 };
const plainNote = { id: "pn", kind: "note", bookKey: "romans", chapter: 4, verse: 7 };

test("onAFootnote is true for a pinned footnote and a note on a footnote, and nothing else", () => {
  assert.equal(onAFootnote(noteOnFootnote), true);
  assert.equal(onAFootnote(pin), true);
  assert.equal(onAFootnote(plainNote), false);
  assert.equal(onAFootnote({ kind: "highlight", bookKey: "romans", chapter: 4, verse: 7 }), false);
  assert.equal(onAFootnote(null), false);
});

test("a wording change does not touch a note on a footnote or a pinned footnote", () => {
  const wording = romans4("Romans 4:6–9 — text updated");
  assert.deepEqual(marksTouched(wording, [noteOnFootnote]), []);
  assert.deepEqual(marksTouched(wording, [pin]), []);
  assert.deepEqual(marksTouched(wording, [noteOnFootnote, pin, plainNote]).map((r) => r.id), ["pn"]);
});

test("footnote_added and footnote_updated touch a note on a footnote and a pinned footnote", () => {
  for (const type of ["footnote_added", "footnote_updated"]) {
    const change = romans4("Romans 4:6–9 — footnote h updated", type);
    assert.deepEqual(marksTouched(change, [noteOnFootnote, pin]).map((r) => r.id), ["nf", "pin"], type);
  }
});

test("an ordinary note on the verse is touched by all three change types", () => {
  for (const type of ["text_updated", "footnote_added", "footnote_updated"]) {
    assert.deepEqual(marksTouched(romans4("Romans 4:6–9 — updated", type), [plainNote]).map((r) => r.id), ["pn"], type);
  }
});

// "Last looked" is a day and the number of changes its publish held (BA92).
const roman = (extra = {}) => ({ id: "n", kind: "note", bookKey: "romans", chapter: 4, verse: 7, created: MARK_CREATED, ...extra });
const threeChanges = () => [
  romans4("Romans 4:6–9 — text updated"),
  romans4("Romans 4:6–9 — text updated"),
  romans4("Romans 4:6–9 — text updated"),
];

test("seenMark reads a bare day, a day with a count, and nothing else", () => {
  assert.deepEqual(seenMark("2026-09-03"), { day: "2026-09-03", count: null });
  assert.deepEqual(seenMark("2026-09-03+4"), { day: "2026-09-03", count: 4 });
  assert.deepEqual(seenMark("2026-09-03+0"), { day: "2026-09-03", count: 0 });
  for (const bad of [null, undefined, "", "2026-9-3", "2026-09-03T10:00:00Z", "2026-09-03+", 20260903, {}]) {
    assert.equal(seenMark(bad), null, String(bad));
  }
});

test("whatsNewForYou with a counted since returns only the changes past the count on that day", () => {
  const entries = [entry("2026-10-26", threeChanges())];
  const found = whatsNewForYou(entries, [roman()], { since: "2026-10-26+2" });
  assert.equal(found.length, 1);
  assert.deepEqual(found[0].changes.map((c) => c.index), [2]);
  assert.equal(found[0].firstOfDay, true);
  assert.deepEqual(whatsNewForYou(entries, [roman()], { since: "2026-10-26+3" }), [], "all three were seen");
  assert.deepEqual(whatsNewForYou(entries, [roman()], { since: "2026-10-26" }), [], "a bare day: nothing on it is new");
});

test("isNewChange: a later day is new, the same day only past the count, an earlier day never", () => {
  const first = { date: "2026-10-26", firstOfDay: true };
  assert.equal(isNewChange({ date: "2026-10-27" }, 0, "2026-10-26+3"), true);
  assert.equal(isNewChange(first, 2, "2026-10-26+3"), false);
  assert.equal(isNewChange(first, 3, "2026-10-26+3"), true);
  assert.equal(isNewChange(first, 0, "2026-10-26"), false, "a bare day has no count");
  assert.equal(isNewChange({ date: "2026-10-25", firstOfDay: true }, 9, "2026-10-26+3"), false);
  assert.equal(isNewChange(first, 0, null), true, "no last look: everything counts");
});

test("isNewChange: an older second entry of the same day is never new", () => {
  const older = { date: "2026-10-26", firstOfDay: false };
  assert.equal(isNewChange(older, 9, "2026-10-26+1"), false);
  assert.equal(isNewChange({ date: "2026-10-26" }, 9, "2026-10-26+1"), true, "firstOfDay unset is treated as the newest");
});

test("whatsNewForYou: a day's older second entry is not new past the count", () => {
  const entries = [entry("2026-10-26", [romans4("Romans 4:6–9 — text updated")]), entry("2026-10-26", threeChanges())];
  const found = whatsNewForYou(entries, [roman()], { since: "2026-10-26+1" });
  assert.deepEqual(found, [], "the newest entry is within the count; the second is older, so it is never new");
});

// The release notes date a publish in Pacific time; a mark's text day must
// agree (BA92).
test("a content version's UTC build day counts for a publish dated the Pacific day before", () => {
  const marks = [roman({ contentVersion: "v20261026.abcdef12" })];
  assert.equal(whatsNewForYou([entry("2026-10-25", [romans4("Romans 4:6–9 — text updated")])], marks).length, 1);
  assert.equal(whatsNewForYou([entry("2026-10-24", [romans4("Romans 4:6–9 — text updated")])], marks).length, 0);
});

test("a timestamp is read as its Pacific day", () => {
  const evening = [entry("2026-10-25", [romans4("Romans 4:6–9 — text updated")])];
  // 03:00 UTC on the 26th is 8 pm on the 25th in Pacific time.
  assert.equal(whatsNewForYou(evening, [roman({ created: "2026-10-26T03:00:00.000Z" })]).length, 1);
  // 20:00 UTC on the 26th is 1 pm on the 26th: the 25th's publish predates it.
  assert.equal(whatsNewForYou(evening, [roman({ created: "2026-10-26T20:00:00.000Z" })]).length, 0);
});

// A text_updated row that names no verse is the whole chapter (BA98).
test("changeVerses reads a text_updated row with no verse as the whole chapter", () => {
  const whole = { bookKey: "john", chapter: 7, ranges: [[1, Infinity]] };
  assert.deepEqual(
    changeVerses({ type: "text_updated", description: "John 7 — updated", location: { bookKey: "john", chapter: 7 } }),
    whole,
  );
  assert.deepEqual(changeVerses({ type: "text_updated", description: "John 7 — text updated" }), whole, "no location");
  assert.equal(changeVerses({ type: "footnote_updated", description: "John 8 — footnote k updated" }), null);
});

test("a mark anywhere in the chapter is touched by a whole-chapter text_updated row", () => {
  const change = { type: "text_updated", description: "John 7 — updated", location: { bookKey: "john", chapter: 7 } };
  const mark = (verse) => ({ id: `m${verse}`, kind: "highlight", bookKey: "john", chapter: 7, verse });
  assert.deepEqual(marksTouched(change, [mark(1), mark(37), mark(53)]).map((r) => r.id), ["m1", "m37", "m53"]);
  assert.deepEqual(marksTouched(change, [{ ...mark(5), chapter: 8 }]), [], "another chapter is not touched");
});

test("every text_updated row in the real feed names a book and a chapter", () => {
  const entries = JSON.parse(readFileSync(new URL("../src/data/release-notes.json", import.meta.url), "utf8"));
  let rows = 0;
  for (const e of entries) {
    for (const c of e.changes ?? []) {
      if (c.type !== "text_updated") continue;
      rows++;
      const v = changeVerses(c);
      assert.ok(v && v.bookKey && v.chapter, `${e.date}: ${c.description}`);
    }
  }
  assert.ok(rows > 0);
  console.log(`# real feed: ${rows} text_updated rows checked`);
});
