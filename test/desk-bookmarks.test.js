// test/desk-bookmarks.test.js
//
// src/lib/desk-bookmarks.mjs: the rules for a bookmark that moves as the reader
// reads (STUDY-DESK-FIXES.md E9, audit C25) and for Continue reading. The ones that
// matter: a bookmark follows the reader only inside the book it was opened
// into, a flag from anywhere else is ignored, a bookmark is only written when
// the verse changed, and Continue reading's address agrees with last-read.js's.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createRecord } from "../src/lib/desk-records.mjs";
import {
  BOOKMARK_NAME_MAX,
  DESK_PAGE,
  MAX_FOLLOWING,
  MOVE_EVERY_MS,
  PAUSE_EXPIRES_MS,
  canFollowMore,
  cleanBookmarkName,
  continueItem,
  followFlagFor,
  followMoveChanges,
  followStep,
  followingOf,
  isFollowing,
  lastReadHref,
  loseFollow,
  nextFollowState,
  pageBookOf,
  parseFollowFlag,
  pausedFlag,
  positionOnPage,
  readingOn,
  resumedFlag,
  throttleDelay,
} from "../src/lib/desk-bookmarks.mjs";
import { continueHref } from "../src/scripts/last-read.js";

const ctx = { now: "2026-10-12T12:00:00.000Z", client: "web/2026.10", contentVersion: "v20261012.aaaaaaaa" };
let n = 0;
const bookmark = (bookKey, chapter, verse, extra = {}) =>
  createRecord("bookmark", { bookKey, chapter, verse, endVerse: verse, ...extra }, { ...ctx, id: `b${++n}` });

test("a bookmark name is tidied and cut, and an empty one is allowed", () => {
  assert.equal(cleanBookmarkName("  Thursday   group \n"), "Thursday group");
  assert.equal(cleanBookmarkName("x".repeat(100)).length, BOOKMARK_NAME_MAX);
  assert.equal(cleanBookmarkName(null), "");
  assert.equal(cleanBookmarkName("   "), "");
});

test("a bookmark name is cut by character, never through an emoji", () => {
  const kept = cleanBookmarkName("x".repeat(39) + "😀");
  assert.ok(kept.isWellFormed(), "no lone surrogate");
  assert.equal(kept, "x".repeat(39) + "😀", "the emoji fits, so it is kept whole");
  const dropped = cleanBookmarkName("x".repeat(40) + "😀");
  assert.ok(dropped.isWellFormed(), "no lone surrogate");
  assert.equal(dropped, "x".repeat(40), "the emoji past the limit is dropped whole");
  assert.doesNotThrow(() => encodeURIComponent(dropped));
});

test("only a bookmark with follow: true moves", () => {
  const plain = bookmark("john", 3, 16);
  const moving = bookmark("john", 3, 17, { follow: true });
  const off = bookmark("john", 3, 18, { follow: false });
  const note = createRecord("note", { body: "x", marker: "note", bookKey: "john", chapter: 3, verse: 1 }, ctx);
  assert.deepEqual([plain, moving, off, note].map(isFollowing), [false, true, false, false]);
  assert.deepEqual(followingOf([plain, moving, off, note]), [moving]);
});

test("a few bookmarks may move; plain ones are not counted", () => {
  const six = Array.from({ length: MAX_FOLLOWING }, (_, i) => bookmark("john", 1, i + 1, { follow: true }));
  const plain = Array.from({ length: 20 }, (_, i) => bookmark("john", 2, i + 1));
  assert.equal(canFollowMore([...six.slice(1), ...plain]), true);
  assert.equal(canFollowMore([...six, ...plain]), false);
  assert.equal(canFollowMore([...six, ...plain], six[0].id), true, "one that already moves may stay on");
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
  const f = parseFollowFlag(followFlagFor({ id: "abc", bookKey: "romans", extra: 1 }));
  assert.deepEqual(f, { id: "abc", bookKey: "romans" });
  assert.deepEqual(parseFollowFlag(followFlagFor({ id: "abc", bookKey: "romans", tab: "t1" })), { id: "abc", bookKey: "romans", tab: "t1" });
  assert.deepEqual(parseFollowFlag('{"id":"abc","bookKey":"romans","tab":""}'), { id: "abc", bookKey: "romans" }, "an empty token is none");
  assert.deepEqual(parseFollowFlag('{"id":"abc","bookKey":"romans","tab":7}'), { id: "abc", bookKey: "romans" }, "a token is a string");
  for (const bad of [null, "", "not json", "{}", '{"id":"x","bookKey":"nope"}', '{"id":"","bookKey":"romans"}', "[]"]) {
    assert.equal(parseFollowFlag(bad), null, String(bad));
  }
});

test("a page outside the book no longer ends the flag; only a pause that has run out does", () => {
  const flag = { id: "abc", bookKey: "romans" };
  assert.equal(nextFollowState(flag), flag);
  assert.equal(nextFollowState(null), null);
  const paused = pausedFlag(flag, 1000);
  assert.deepEqual(paused, { id: "abc", bookKey: "romans", paused: true, since: 1000, told: false });
  assert.equal(nextFollowState(paused, 1000 + PAUSE_EXPIRES_MS), paused, "right at the limit it still waits");
  assert.equal(nextFollowState(paused, 1000 + PAUSE_EXPIRES_MS + 1), null, "a pause from long ago is let go");
  assert.deepEqual(resumedFlag({ ...paused, tab: "t" }, "mark"), { id: "abc", bookKey: "mark", tab: "t" });
});

test("a pause survives being stored and read back", () => {
  const flag = { id: "abc", bookKey: "romans", tab: "t", paused: true, since: 5, told: true };
  assert.deepEqual(parseFollowFlag(followFlagFor(flag)), flag);
  assert.deepEqual(parseFollowFlag(followFlagFor({ id: "abc", bookKey: "romans" })), { id: "abc", bookKey: "romans" });
  assert.deepEqual(parseFollowFlag('{"id":"abc","bookKey":"romans","paused":"yes"}'), { id: "abc", bookKey: "romans" });
});

test("reading on is the book's own chapters within one of where the bookmark sits; anything else is a jump", () => {
  const record = { bookKey: "luke", chapter: 1, verse: 12 };
  const at = (bookKey, chapter) => ({ bookKey, chapter, verse: 1 });
  assert.equal(readingOn(record, at("luke", 1)), true);
  assert.equal(readingOn(record, at("luke", 2)), true, "Next chapter");
  assert.equal(readingOn(record, at("luke", 3)), false);
  assert.equal(readingOn(record, at("mark", 1)), false, "the next book's first chapter is a jump, offered with the bar");
  assert.equal(readingOn(record, at("luke", 4), at("luke", 3)), true, "scrolling Read View keeps up with the last place heard");
  assert.equal(readingOn(record, null), false);
});

test("what a followed bookmark does at each report", () => {
  const record = { bookKey: "luke", chapter: 1, verse: 12 };
  const near = { bookKey: "luke", chapter: 2, verse: 3 };
  const far = { bookKey: "luke", chapter: 9, verse: 3 };
  const flag = { id: "abc", bookKey: "luke" };
  const paused = { ...flag, paused: true };
  assert.equal(followStep(flag, record, near), "move");
  assert.equal(followStep(flag, record, far), "pause");
  assert.equal(followStep(paused, record, far), "stay");
  assert.equal(followStep(paused, record, near), "resume");
});

test("E28: a LIT pane that has just become /desk's leading one pauses the follow wherever it is", () => {
  const record = { bookKey: "luke", chapter: 1, verse: 12 };
  const near = { bookKey: "luke", chapter: 1, verse: 14 };
  const flag = { id: "abc", bookKey: "luke" };
  const paused = { ...flag, paused: true };
  assert.equal(followStep(flag, record, near, null, { newLead: true }), "pause", "even on the bookmark's own chapter");
  assert.equal(followStep(paused, record, near, null, { newLead: true }), "stay", "a paused one stays paused, never resumes on the change itself");
  assert.equal(followStep(paused, record, near), "resume", "reading on from it in the new pane resumes it");
  // The LIT pane scrolls on from one book into the next: that is still a jump.
  assert.equal(followStep(flag, { bookKey: "matthew", chapter: 28, verse: 20 }, { bookKey: "mark", chapter: 1, verse: 1 }), "pause");
});

test("the reader's position counts only on the page it was recorded for", () => {
  const study = { book: "romans", chapter: 8, verse: 12, view: "study" };
  assert.deepEqual(positionOnPage(study, pageBookOf("/romans-8/")), { bookKey: "romans", chapter: 8, verse: 12 });
  assert.equal(positionOnPage(study, pageBookOf("/romans-9/")), null, "a draft chapter records nothing, so the last record is stale");
  assert.equal(positionOnPage(study, pageBookOf("/read/romans/")), null, "a Chapter View record is not Read View's");
  assert.equal(positionOnPage(study, pageBookOf("/romans-intro/")), null);
  assert.equal(positionOnPage(study, pageBookOf("/john-3/")), null);
  const read = { book: "romans", chapter: 5, verse: null, view: "read" };
  assert.deepEqual(positionOnPage(read, pageBookOf("/read/romans/")), { bookKey: "romans", chapter: 5, verse: 1 }, "a chapter's top is verse 1");
  assert.equal(positionOnPage(read, pageBookOf("/romans-5/")), null);
  assert.equal(positionOnPage(null, pageBookOf("/romans-5/")), null);
});

test("E28: on /desk the leading LIT pane's place counts in any book, and only a chapter the book has", () => {
  assert.equal(pageBookOf("/desk/"), null, "/desk is no book's page");
  const desk = (book, chapter, verse = null) => ({ book, chapter, verse, view: "desk" });
  assert.deepEqual(positionOnPage(desk("romans", 8, 12), DESK_PAGE), { bookKey: "romans", chapter: 8, verse: 12 });
  assert.deepEqual(positionOnPage(desk("jude", 1), DESK_PAGE), { bookKey: "jude", chapter: 1, verse: 1 }, "a chapter alone is verse 1");
  assert.equal(positionOnPage(desk("jude", 2), DESK_PAGE), null, "Jude has one chapter");
  assert.equal(positionOnPage(desk("genesis", 1), DESK_PAGE), null);
  assert.equal(positionOnPage(desk("romans", 0), DESK_PAGE), null);
  assert.equal(positionOnPage(null, DESK_PAGE), null);
});

test("a followed bookmark is written only when the reader is somewhere else", () => {
  const r = bookmark("romans", 8, 12, { label: "Thursday group", follow: true });
  assert.equal(followMoveChanges(r, { bookKey: "romans", chapter: 8, verse: 12 }), null);
  assert.equal(followMoveChanges(r, null), null);
  assert.deepEqual(followMoveChanges(r, { bookKey: "romans", chapter: 8, verse: 15 }), {
    bookKey: "romans",
    chapter: 8,
    verse: 15,
    endVerse: 15,
  });
  assert.deepEqual(followMoveChanges(r, { bookKey: "romans", chapter: 9, verse: 1 }), {
    bookKey: "romans",
    chapter: 9,
    verse: 1,
    endVerse: 1,
  });
  // A range bookmark (made elsewhere) at its first verse still counts as moved to a single verse.
  const range = { ...r, endVerse: 14 };
  assert.ok(followMoveChanges(range, { bookKey: "romans", chapter: 8, verse: 12 }));
});

test("the throttle waits out the gap since the last write", () => {
  assert.equal(throttleDelay(null, 1000), 0);
  assert.equal(throttleDelay(1000, 1500, 4000), 3500);
  assert.equal(throttleDelay(1000, 5000, 4000), 0);
  assert.equal(throttleDelay(1000, 9000, 4000), 0);
  // The default gap is MOVE_EVERY_MS, 2 seconds since E45 (STUDY-DESK-FORMAT.md
  // tells the apps the website's rate, so a change here is a change there).
  assert.equal(MOVE_EVERY_MS, 2000);
  assert.equal(throttleDelay(1000, 1500), 1500);
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

test("loseFollow: a copied tab, or another tab opening the same bookmark, stops this one", () => {
  const flag = { id: "r1", bookKey: "romans", tab: "t1" };
  assert.equal(loseFollow(flag, { taken: "t1" }), true, "another page holds this tab's token: this tab is the copy");
  assert.equal(loseFollow(flag, { taken: "t2" }), false);
  assert.equal(loseFollow(flag, { took: "r1", tab: "t2" }), true, "another tab followed this bookmark's link since");
  assert.equal(loseFollow(flag, { took: "r1", tab: "t1" }), false, "this tab's own announcement");
  assert.equal(loseFollow(flag, { took: "r2", tab: "t2" }), false, "another bookmark");
  assert.equal(loseFollow(flag, { ask: "t1" }), false, "a question is answered, not obeyed");
  assert.equal(loseFollow(flag, null), false);
  assert.equal(loseFollow(flag, "taken"), false);
  assert.equal(loseFollow(null, { taken: "t1" }), false);
  assert.equal(loseFollow({ id: "r1", bookKey: "romans" }, { taken: "t1" }), false, "no token, nothing to match");
});

test("an inherited property name is not a book", () => {
  for (const bookKey of ["constructor", "toString", "__proto__"]) {
    assert.equal(parseFollowFlag(JSON.stringify({ id: "x", bookKey })), null, bookKey);
    assert.equal(pageBookOf(`/${bookKey}-1/`), null, bookKey);
    assert.equal(pageBookOf(`/${bookKey}-intro/`), null, bookKey);
    assert.equal(pageBookOf(`/read/${bookKey}/`), null, bookKey);
  }
  assert.deepEqual(parseFollowFlag('{"id":"x","bookKey":"romans"}'), { id: "x", bookKey: "romans" });
});

test("Continue reading is one row, with its address and the view it was kept in", () => {
  const item = continueItem({ book: "luke", chapter: 15, verse: 11, view: "study" });
  assert.equal(item.title, "Luke 15:11");
  assert.equal(item.detail, "Continue reading · Chapter View");
  assert.equal(item.href, "/luke-15/#v11");
  assert.equal(item.bookKey, "luke");
  const read = continueItem({ book: "john", chapter: 3, verse: null, view: "read" });
  assert.equal(read.title, "John 3");
  assert.equal(read.detail, "Continue reading · Read View");
  assert.equal(continueItem(null), null);
});
