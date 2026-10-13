// test/desk-places.test.js
//
// src/lib/desk-places.mjs: the Places group's rules (STUDY-DESK.md B1, audit
// C25). The ones that matter: a ribbon follows the reader only inside the book
// it was opened into, a flag from anywhere else is ignored, a ribbon is only
// written when the verse changed, and Continue reading's address agrees with
// last-read.js's.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createRecord } from "../src/lib/desk-records.mjs";
import {
  MAX_RIBBONS,
  RIBBON_NAME_MAX,
  canAddRibbon,
  cleanRibbonName,
  isRibbon,
  lastReadHref,
  nextRibbonState,
  pageBookOf,
  parseRibbonFlag,
  placeItems,
  positionOnPage,
  readPlacesFrom,
  ribbonFlagFor,
  ribbonMoveChanges,
  ribbonNameProblem,
  ribbonsOf,
  throttleDelay,
} from "../src/lib/desk-places.mjs";
import { continueHref } from "../src/scripts/last-read.js";

const ctx = { now: "2026-10-12T12:00:00.000Z", client: "web/2026.10", contentVersion: "v20261012.aaaaaaaa" };
let n = 0;
const ribbon = (name, bookKey, chapter, verse) =>
  createRecord("place", { name, ribbon: true, bookKey, chapter, verse, endVerse: verse }, { ...ctx, id: `r${++n}` });

test("a ribbon name is tidied, cut, and checked against the others", () => {
  assert.equal(cleanRibbonName("  Thursday   group \n"), "Thursday group");
  assert.equal(cleanRibbonName("x".repeat(100)).length, RIBBON_NAME_MAX);
  assert.equal(cleanRibbonName(null), "");
  const rs = [ribbon("Thursday group", "romans", 8, 1)];
  assert.match(ribbonNameProblem("  ", rs), /name/);
  assert.match(ribbonNameProblem("thursday GROUP", rs), /already/);
  assert.equal(ribbonNameProblem("thursday group", rs, rs[0].id), null, "a ribbon may keep its own name");
  assert.equal(ribbonNameProblem("Morning reading", rs), null);
});

test("only a named place with ribbon: true is a ribbon, and ribbons are listed by name", () => {
  const a = ribbon("beta", "john", 1, 1);
  const b = ribbon("Alpha", "john", 1, 1);
  const bare = createRecord("place", { name: "", bookKey: "john", chapter: 3, verse: 16 }, ctx);
  assert.equal(isRibbon(bare), false);
  assert.equal(isRibbon(createRecord("bookmark", { bookKey: "john", chapter: 3, verse: 16 }, ctx)), false);
  assert.deepEqual(ribbonsOf([a, bare, b]).map((r) => r.name), ["Alpha", "beta"]);
});

test("a few ribbons per reader", () => {
  const six = Array.from({ length: MAX_RIBBONS }, (_, i) => ribbon(`r${i}`, "john", 1, 1));
  assert.equal(canAddRibbon(six.slice(1)), true);
  assert.equal(canAddRibbon(six), false);
});

test("pageBookOf reads a book from a chapter, an intro or a Read View path", () => {
  assert.deepEqual(pageBookOf("/john-3/"), { bookKey: "john", kind: "chapter", chapter: 3 });
  assert.deepEqual(pageBookOf("/1corinthians-13"), { bookKey: "1corinthians", kind: "chapter", chapter: 13 });
  assert.deepEqual(pageBookOf("/john-intro/"), { bookKey: "john", kind: "intro" });
  assert.deepEqual(pageBookOf("/read/romans/"), { bookKey: "romans", kind: "read" });
  for (const path of ["/", "/search/", "/articles/x/", "/john-99/", "/john-0/", "/read/nowhere/", "/glossary/", "/notebook/"]) {
    assert.equal(pageBookOf(path), null, path);
  }
});

test("the flag round-trips and refuses anything that isn't one", () => {
  const f = parseRibbonFlag(ribbonFlagFor({ id: "abc", bookKey: "romans", extra: 1 }));
  assert.deepEqual(f, { id: "abc", bookKey: "romans" });
  for (const bad of [null, "", "not json", "{}", '{"id":"x","bookKey":"nope"}', '{"id":"","bookKey":"romans"}', "[]"]) {
    assert.equal(parseRibbonFlag(bad), null, String(bad));
  }
});

test("the flag lasts while the tab stays in the book and ends on the first page outside it", () => {
  const flag = { id: "abc", bookKey: "romans" };
  assert.equal(nextRibbonState(flag, pageBookOf("/romans-9/")), flag);
  assert.equal(nextRibbonState(flag, pageBookOf("/read/romans/")), flag);
  assert.equal(nextRibbonState(flag, pageBookOf("/romans-intro/")), flag, "the book's own intro is still the book");
  assert.equal(nextRibbonState(flag, pageBookOf("/john-3/")), null);
  assert.equal(nextRibbonState(flag, pageBookOf("/read/john/")), null);
  assert.equal(nextRibbonState(flag, pageBookOf("/search/")), null);
  assert.equal(nextRibbonState(null, pageBookOf("/romans-9/")), null);
});

test("the reader's position counts only on the page it was recorded for", () => {
  const study = { book: "romans", chapter: 8, verse: 12, view: "study" };
  assert.deepEqual(positionOnPage(study, pageBookOf("/romans-8/")), { bookKey: "romans", chapter: 8, verse: 12 });
  assert.equal(positionOnPage(study, pageBookOf("/romans-9/")), null, "a draft chapter records nothing, so the last record is stale");
  assert.equal(positionOnPage(study, pageBookOf("/read/romans/")), null, "a Study View record is not Read View's");
  assert.equal(positionOnPage(study, pageBookOf("/romans-intro/")), null);
  assert.equal(positionOnPage(study, pageBookOf("/john-3/")), null);
  const read = { book: "romans", chapter: 5, verse: null, view: "read" };
  assert.deepEqual(positionOnPage(read, pageBookOf("/read/romans/")), { bookKey: "romans", chapter: 5, verse: 1 }, "a chapter's top is verse 1");
  assert.equal(positionOnPage(read, pageBookOf("/romans-5/")), null);
  assert.equal(positionOnPage(null, pageBookOf("/romans-5/")), null);
});

test("a ribbon is written only when the reader is somewhere else", () => {
  const r = ribbon("Thursday group", "romans", 8, 12);
  assert.equal(ribbonMoveChanges(r, { bookKey: "romans", chapter: 8, verse: 12 }), null);
  assert.equal(ribbonMoveChanges(r, null), null);
  assert.deepEqual(ribbonMoveChanges(r, { bookKey: "romans", chapter: 8, verse: 15 }), {
    bookKey: "romans",
    chapter: 8,
    verse: 15,
    endVerse: 15,
  });
  assert.deepEqual(ribbonMoveChanges(r, { bookKey: "romans", chapter: 9, verse: 1 }), {
    bookKey: "romans",
    chapter: 9,
    verse: 1,
    endVerse: 1,
  });
  // A range ribbon (made elsewhere) at its first verse still counts as moved to a single verse.
  const range = { ...r, endVerse: 14 };
  assert.ok(ribbonMoveChanges(range, { bookKey: "romans", chapter: 8, verse: 12 }));
});

test("the throttle waits out the gap since the last write", () => {
  assert.equal(throttleDelay(null, 1000), 0);
  assert.equal(throttleDelay(1000, 1500, 4000), 3500);
  assert.equal(throttleDelay(1000, 5000, 4000), 0);
  assert.equal(throttleDelay(1000, 9000, 4000), 0);
});

test("Read View places come from its resume keys, in Bible order, and skip junk", () => {
  const got = readPlacesFrom([
    ["lit_rm_resume_romans", JSON.stringify({ anchor: "ch-8", scrollY: 100 })],
    ["lit_rm_resume_john", JSON.stringify({ anchor: "ch-3", scrollY: 5 })],
    ["lit_rm_resume_nowhere", JSON.stringify({ anchor: "ch-1" })],
    ["lit_rm_resume_mark", JSON.stringify({ anchor: "ch-99" })],
    ["lit_rm_resume_luke", "not json"],
    ["lit_rm_resume_acts", JSON.stringify({ scrollY: 1 })],
    ["lit_rm_focus", "on"],
  ]);
  assert.deepEqual(got, [
    { bookKey: "john", chapter: 3 },
    { bookKey: "romans", chapter: 8 },
  ]);
});

test("Continue reading's address agrees with last-read.js's", () => {
  for (const r of [
    { book: "luke", chapter: 15, verse: 11, view: "study" },
    { book: "luke", chapter: 15, verse: null, view: "study" },
    { book: "1corinthians", chapter: 13, verse: 4, view: "read" },
    { book: "john", chapter: 3, verse: null, view: "read" },
  ]) {
    assert.equal(lastReadHref(r), continueHref(r));
  }
});

test("places are listed with this book first, Continue reading, ribbons by name, then Read View places", () => {
  const records = [ribbon("Morning reading", "john", 1, 1), ribbon("Thursday group", "romans", 8, 12)];
  const items = placeItems({
    lastRead: { book: "luke", chapter: 15, verse: 11, view: "study" },
    readPlaces: [
      { bookKey: "john", chapter: 3 },
      { bookKey: "romans", chapter: 5 },
    ],
    records,
    thisBook: "romans",
  });
  assert.deepEqual(items.map((i) => `${i.type}:${i.title}`), [
    "ribbon:Thursday group",
    "read:Romans 5",
    "continue:Luke 15:11",
    "ribbon:Morning reading",
    "read:John 3",
  ]);
  const cont = items.find((i) => i.type === "continue");
  assert.equal(cont.detail, "Continue reading · Study View");
  assert.equal(cont.href, "/luke-15/#v11");
  assert.equal(items[0].sub, "Romans 8:12");
  assert.equal(items[0].href, "/romans-8/#v12");
  assert.equal(items[1].detail, "Read View");
  assert.equal(items[1].href, "/read/romans/#ch-5");
});

test("without a book in mind, Continue reading leads, and Read View sends a ribbon to Read View", () => {
  const records = [ribbon("Thursday group", "romans", 8, 12)];
  const items = placeItems({ lastRead: { book: "john", chapter: 3, verse: null, view: "read" }, records, inReadView: true });
  assert.deepEqual(items.map((i) => i.type), ["continue", "ribbon"]);
  assert.equal(items[0].detail, "Continue reading · Read View");
  assert.equal(items[0].title, "John 3");
  assert.equal(items[1].href, "/read/romans/#romans-8-v12");
});

test("a place another client kept is listed, unnamed and read-only", () => {
  const theirs = createRecord("place", { name: "", bookKey: "mark", chapter: 4, verse: 35 }, ctx);
  const items = placeItems({ records: [theirs, createRecord("bookmark", { bookKey: "mark", chapter: 4, verse: 1 }, ctx)] });
  assert.equal(items.length, 1);
  assert.equal(items[0].type, "reading");
  assert.equal(items[0].title, "Mark 4:35");
});

test("nothing to show gives an empty list", () => {
  assert.deepEqual(placeItems({}), []);
});
