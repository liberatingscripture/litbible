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
  hasVerseMarks,
  joinList,
  listSeparator,
  markLinks,
  newestDate,
  presentWhatsNew,
  seenDay,
} from "../src/lib/desk-whats-new-view.mjs";

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

test("markLinks names each mark with its verse link, once, grouped by place", () => {
  const links = markLinks([
    note(),
    { kind: "highlight", color: "yellow", bookKey: "galatians", chapter: 3, verse: 27 },
    { kind: "highlight", color: "blue", bookKey: "galatians", chapter: 3, verse: 27 },
    { kind: "place", ribbon: true, bookKey: "romans", chapter: 4, verse: 6, endVerse: 9 },
    { kind: "footnotePin", bookKey: "romans", chapter: 4, verse: 7 },
  ]);
  assert.deepEqual(links, [
    { text: "your note and pinned footnote on Romans 4:7", href: "/romans-4/#v7" },
    { text: "your highlight on Galatians 3:27", href: "/galatians-3/#v27" },
    { text: "your ribbon on Romans 4:6–9", href: "/romans-4/#v6-9" },
  ]);
});

const luke = (kind, verse = 4) => ({ kind, bookKey: "luke", chapter: 24, verse });

test("markLinks: one item, and nothing at all", () => {
  assert.deepEqual(markLinks([luke("note")]), [{ text: "your note on Luke 24:4", href: "/luke-24/#v4" }]);
  assert.deepEqual(markLinks([]), []);
  assert.deepEqual(markLinks(null), []);
});

test("markLinks: marks at one place share it, with the Oxford comma from three", () => {
  assert.deepEqual(markLinks([luke("note"), luke("highlight"), luke("bookmark")]), [
    { text: "your note, highlight, and bookmark on Luke 24:4", href: "/luke-24/#v4" },
  ]);
  assert.deepEqual(markLinks([luke("note"), luke("highlight")]), [
    { text: "your note and highlight on Luke 24:4", href: "/luke-24/#v4" },
  ]);
  assert.deepEqual(markLinks([luke("note"), luke("note")]), [{ text: "your note on Luke 24:4", href: "/luke-24/#v4" }]);
});

test("markLinks: places and kinds keep the order first seen", () => {
  const links = markLinks([
    luke("note", 4),
    luke("highlight", 5),
    luke("bookmark", 5),
    luke("highlight", 4),
  ]);
  assert.deepEqual(links, [
    { text: "your note and highlight on Luke 24:4", href: "/luke-24/#v4" },
    { text: "your highlight and bookmark on Luke 24:5", href: "/luke-24/#v5" },
  ]);
});

test("listSeparator and joinList: Oxford comma from three items on", () => {
  assert.equal(listSeparator(0, 3), "");
  assert.equal(joinList(["a"]), "a");
  assert.equal(joinList(["a", "b"]), "a and b");
  assert.equal(joinList(["a", "b", "c"]), "a, b, and c");
  assert.equal(joinList(["a", "b", "c", "d"]), "a, b, c, and d");
  assert.equal(joinList([]), "");
  // two places: "a and b"; the second place's kinds group inside it
  const two = markLinks([luke("note", 4), luke("highlight", 5), luke("bookmark", 5)])
    .map((l, i, all) => listSeparator(i, all.length) + l.text)
    .join("");
  assert.equal(two, "your note on Luke 24:4 and your highlight and bookmark on Luke 24:5");
  // three places, each a group of its own
  const text = markLinks([luke("note", 4), luke("highlight", 5), luke("bookmark", 6)])
    .map((l, i, all) => listSeparator(i, all.length) + l.text)
    .join("");
  assert.equal(text, "your note on Luke 24:4, your highlight on Luke 24:5, and your bookmark on Luke 24:6");
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
