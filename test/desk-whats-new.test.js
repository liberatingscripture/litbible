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

import { markVerses, marksTouched, whatsNewForYou, whatsNewLine } from "../src/lib/desk-whats-new.mjs";

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
