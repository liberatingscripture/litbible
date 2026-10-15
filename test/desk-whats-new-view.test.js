// test/desk-whats-new-view.test.js
//
// src/lib/desk-whats-new-view.mjs: how "What's new for you" (STUDY-DESK.md B3)
// and the /release-notes filter "Verses in my notebook" (M10) are put in front
// of the reader, over desk-whats-new.mjs's rules. What these guard: a first
// look marks nothing "new" (there is no "since"), the "last looked" day comes
// from the feed and not the clock, a mark is named once however many records
// say the same thing, and the filter keeps exactly the rows of the page whose
// verses the reader has marked, matched by entry, place and type.

import { test } from "node:test";
import assert from "node:assert/strict";

import { whatsNewForYou } from "../src/lib/desk-whats-new.mjs";
import {
  PUBLISH_LIMIT,
  changeKey,
  hasVerseMarks,
  markLinks,
  newestDate,
  notebookChangeKeys,
  presentWhatsNew,
  seenDay,
} from "../src/lib/desk-whats-new-view.mjs";
import { entryIds } from "../src/lib/release-notes-view.mjs";

const change = (description, type = "text_updated") => ({ type, description });
const entry = (date, changes) => ({ version: `v${date.replaceAll("-", "")}.00000000`, date, label: date, changes });

const FEED = [
  entry("2026-10-02", [change("Galatians 3:27 — text updated")]),
  entry("2026-09-03", [
    change("John 3:16 — text updated"),
    change("Romans 4:6–9 — text updated"),
    change("Romans 4:6–7, 9 — footnotes h, i, j, n updated", "footnote_updated"),
  ]),
  entry("2026-09-03", [change("Romans 4:7 — text updated")]),
  entry("2026-07-01", [change("Romans 4:7 — text updated")]),
];

const note = (extra = {}) => ({ kind: "note", bookKey: "romans", chapter: 4, verse: 7, created: "2026-08-01T10:00:00Z", ...extra });

test("seenDay accepts a day and nothing else", () => {
  assert.equal(seenDay("2026-09-03"), "2026-09-03");
  for (const bad of [null, undefined, "", "2026-9-3", "2026-09-03T10:00:00Z", 20260903, {}]) assert.equal(seenDay(bad), null);
});

test("newestDate is the feed's newest publish, whatever the order", () => {
  assert.equal(newestDate(FEED), "2026-10-02");
  assert.equal(newestDate([...FEED].reverse()), "2026-10-02");
  assert.equal(newestDate([]), null);
  assert.equal(newestDate(null), null);
});

test("hasVerseMarks: only a record on a verse counts", () => {
  assert.equal(hasVerseMarks([]), false);
  assert.equal(hasVerseMarks(null), false);
  assert.equal(hasVerseMarks([{ kind: "label", name: "x" }, { kind: "trash", id: "a" }]), false);
  assert.equal(hasVerseMarks([{ kind: "note", bookKey: "romans", chapter: 4 }]), false, "a chapter-wide note isn't on a verse");
  assert.equal(hasVerseMarks([{ kind: "note", glossaryEntry: "flesh-body", bookKey: "romans", chapter: 4, verse: 7 }]), false);
  assert.equal(hasVerseMarks([note()]), true);
  assert.equal(hasVerseMarks([{ kind: "bookmark", bookKey: "romans", chapter: 4, verse: 7 }]), true);
});

test("markLinks names each mark with its verse link, once", () => {
  const links = markLinks([
    note(),
    { kind: "highlight", color: "yellow", bookKey: "galatians", chapter: 3, verse: 27 },
    { kind: "highlight", color: "blue", bookKey: "galatians", chapter: 3, verse: 27 },
    { kind: "place", ribbon: true, bookKey: "romans", chapter: 4, verse: 6, endVerse: 9 },
    { kind: "footnotePin", bookKey: "romans", chapter: 4, verse: 7 },
  ]);
  assert.deepEqual(links, [
    { text: "your note on Romans 4:7", href: "/romans-4/#v7" },
    { text: "your highlight on Galatians 3:27", href: "/galatians-3/#v27" },
    { text: "your ribbon on Romans 4:6–9", href: "/romans-4/#v6-9" },
    { text: "your pinned footnote on Romans 4:7", href: "/romans-4/#v7" },
  ]);
});

test("presentWhatsNew: nothing is new on a first look, after-the-day publishes are new after one", () => {
  const found = whatsNewForYou(FEED, [note()]);
  assert.deepEqual(found.map((e) => e.id), ["2026-09-03-2", "2026-09-03"], "newest first; the 2026-07-01 publish predates the note");

  const first = presentWhatsNew(found, null);
  assert.equal(first.fresh.length, 0);
  assert.ok(first.shown.every((e) => e.isNew === false));

  const later = presentWhatsNew(found, "2026-09-03");
  assert.equal(later.fresh.length, 0, "a publish on the day last looked is not after it");

  const earlier = presentWhatsNew(found, "2026-08-15");
  assert.equal(earlier.fresh.length, 2);
  assert.ok(earlier.shown.every((e) => e.isNew === true));
});

test("presentWhatsNew caps the publishes shown and counts the rest", () => {
  const many = Array.from({ length: PUBLISH_LIMIT + 3 }, (_, i) => ({ id: `d${i}`, date: "2026-09-03", changes: [{}] }));
  const cut = presentWhatsNew(many, null);
  assert.equal(cut.shown.length, PUBLISH_LIMIT);
  assert.equal(cut.hidden, 3);
  const all = presentWhatsNew(many, null, { limit: Infinity });
  assert.equal(all.shown.length, many.length);
  assert.equal(all.hidden, 0);
  assert.deepEqual(presentWhatsNew([], null), { shown: [], hidden: 0, fresh: [] });
});

test("notebookChangeKeys keeps the changes on a marked verse, ungated by when the mark was made", () => {
  const ids = entryIds(FEED);
  const keys = notebookChangeKeys(FEED, [note({ created: "2026-10-10T00:00:00Z" })], ids);
  assert.deepEqual(
    [...keys].sort(),
    [
      changeKey("2026-07-01", 0, "text_updated"),
      changeKey("2026-09-03-2", 1, "text_updated"),
      changeKey("2026-09-03-2", 2, "footnote_updated"),
      changeKey("2026-09-03", 0, "text_updated"),
    ].sort(),
  );
});

test("notebookChangeKeys: no marks, no keys; a mark elsewhere touches nothing", () => {
  const ids = entryIds(FEED);
  assert.equal(notebookChangeKeys(FEED, [], ids).size, 0);
  assert.equal(notebookChangeKeys(FEED, [note({ bookKey: "mark", chapter: 1, verse: 1 })], ids).size, 0);
  assert.equal(notebookChangeKeys(FEED, [{ kind: "trash", id: "x" }], ids).size, 0);
});

test("the filter's keys match the release notes page's own ids on the real feed", async () => {
  const { default: real } = await import("../src/data/release-notes.json", { with: { type: "json" } });
  const ids = entryIds(real);
  const keys = notebookChangeKeys(real, [note()], ids);
  // The Sept 3 Romans 4:6–9 change that the owner's spec names.
  assert.ok(
    [...keys].some((k) => k.startsWith("2026-09-03") && k.endsWith(":text_updated")),
    "a note on Romans 4:7 is touched by the 2026-09-03 wording change",
  );
});
