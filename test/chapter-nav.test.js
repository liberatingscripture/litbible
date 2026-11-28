// test/chapter-nav.test.js
//
// Unit tests for src/lib/chapter-nav.mjs, the one Previous/Next rule. The
// fixture is the corpus's own shape in 2026-09: Luke's intro and chapters
// 23–24, and the whole of Acts and Revelation, are still drafts.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  chapterRuns,
  describeSkipped,
  joinList,
  neighbours,
  pageHref,
  pageLabel,
  readingSequence,
  unfinishedTexts,
} from "../src/lib/chapter-nav.mjs";
import { BOOKS } from "../src/data/books.js";

const DRAFT_BOOKS = new Set(["acts", "revelation"]);
const pages = readingSequence({
  isDraftChapter: (book, ch) => DRAFT_BOOKS.has(book) || (book === "luke" && ch >= 23),
  isDraftIntro: (book) => DRAFT_BOOKS.has(book) || book === "luke",
});
const nav = (book, ch) => neighbours(pages, book, ch);
const acts = (from, to) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ bookKey: "acts", chapter: from + i }));

test("the sequence is every intro then its chapters, in canonical order", () => {
  const total = Object.values(BOOKS).reduce((a, n) => a + n, 0);
  assert.equal(pages.length, total + Object.keys(BOOKS).length);
  assert.deepEqual(pages.slice(0, 2).map((p) => [p.bookKey, p.chapter]), [
    ["matthew", "intro"],
    ["matthew", 1],
  ]);
});

test("hrefs carry the trailing slash and labels read the way the buttons print them", () => {
  assert.equal(pageHref({ bookKey: "john", chapter: 2 }), "/john-2/");
  assert.equal(pageHref({ bookKey: "1corinthians", chapter: "intro" }), "/1corinthians-intro/");
  assert.equal(pageLabel({ bookKey: "john", chapter: 2 }), "John 2");
  assert.equal(pageLabel({ bookKey: "1corinthians", chapter: "intro" }), "1 Corinthians introduction");
});

test("an ordinary step goes to the next chapter, and chapter 1 goes back past its introduction", () => {
  const n = nav("john", 3);
  assert.deepEqual(n.prev, { href: "/john-2/", label: "John 2" });
  assert.deepEqual(n.next, { href: "/john-4/", label: "John 4" });
  assert.equal(n.prevSkipped, null);
  assert.equal(n.nextSkipped, null);
  // A chapter's way on steps over introductions ("Luke 24" back from John 1;
  // SITE-FEATHERBOA.md, "A whole book"); here Luke 23–24 are drafts too.
  assert.deepEqual(nav("john", 1).prev, { href: "/luke-22/", label: "Luke 22" });
  assert.equal(nav("john", 1).prevSkipped.sentence, "Luke 23–24 are still being translated.");
});

test("a chapter steps over an introduction, written or not, and says nothing of it", () => {
  const fwd = nav("mark", 16);
  assert.deepEqual(fwd.next, { href: "/luke-1/", label: "Luke 1" });
  assert.equal(fwd.nextSkipped, null);
  const back = nav("luke", 1);
  assert.deepEqual(back.prev, { href: "/mark-16/", label: "Mark 16" });
  assert.equal(back.prevSkipped, null);
  // An introduction's own way on still steps through the others.
  assert.deepEqual(nav("mark", "intro").next, { href: "/mark-1/", label: "Mark 1" });
  assert.deepEqual(nav("mark", "intro").prev, { href: "/matthew-28/", label: "Matthew 28" });
  assert.equal(
    describeSkipped([{ bookKey: "luke", chapter: "intro" }]).sentence,
    "The Luke introduction is still being written.",
  );
});

test("Luke 22 steps over Luke 23–24 and John's introduction to John 1", () => {
  const n = nav("luke", 22);
  assert.deepEqual(n.next, { href: "/john-1/", label: "John 1" });
  assert.equal(n.nextSkipped.sentence, "Luke 23–24 are still being translated.");
  assert.equal(nav("john", "intro").prevSkipped.text, "Luke 23–24");
});

test("a whole unfinished book is named once, intro included", () => {
  const n = nav("john", 21);
  assert.deepEqual(n.next, { href: "/romans-1/", label: "Romans 1" });
  assert.equal(n.nextSkipped.sentence, "Acts is still being translated.");
  const back = nav("romans", "intro");
  assert.deepEqual(back.prev, { href: "/john-21/", label: "John 21" });
  assert.equal(back.prevSkipped.text, "Acts");
  assert.deepEqual(nav("romans", 1).prev, { href: "/john-21/", label: "John 21" });
  assert.equal(nav("romans", 1).prevSkipped.text, "Acts");
});

test("the last published page has no Next, but still says why", () => {
  const n = nav("jude", 1);
  assert.equal(n.next, null);
  assert.equal(n.nextSkipped.sentence, "Revelation is still being translated.");
  assert.deepEqual(n.prev, { href: "/3john-1/", label: "3 John 1" });
});

test("the first page has no Previous and nothing skipped", () => {
  const n = nav("matthew", "intro");
  assert.equal(n.prev, null);
  assert.equal(n.prevSkipped, null);
});

test("a draft page finds the nearest published page on either side", () => {
  const n = nav("acts", 5);
  assert.deepEqual(n.prev, { href: "/john-21/", label: "John 21" });
  assert.deepEqual(n.next, { href: "/romans-1/", label: "Romans 1" });
  assert.equal(n.prevSkipped.text, "Acts 1–4");
  // A draft introduction's page walks through introductions as before.
  assert.deepEqual(nav("acts", "intro").next, { href: "/romans-intro/", label: "Romans introduction" });
});

test("an unknown page gets no navigation rather than a guess", () => {
  assert.deepEqual(nav("enoch", 1), { prev: null, next: null, prevSkipped: null, nextSkipped: null });
});

test("describeSkipped agrees in number and names each book", () => {
  assert.equal(describeSkipped([{ bookKey: "luke", chapter: 23 }]).sentence, "Luke 23 is still being translated.");
  assert.equal(
    describeSkipped([{ bookKey: "acts", chapter: "intro" }, ...acts(1, 28), { bookKey: "romans", chapter: "intro" }])
      .sentence,
    "Acts and the Romans introduction are still being translated."
  );
  assert.equal(describeSkipped(acts(3, 3)).text, "Acts 3");
});

test("chapterRuns collapses consecutive chapters into en-dash ranges", () => {
  assert.equal(chapterRuns([20, 23, 24]), "20, 23–24");
  assert.equal(chapterRuns([1]), "1");
  assert.equal(chapterRuns([1, 2, 3, 5, 7, 8]), "1–3, 5, 7–8");
});

test("unfinished texts name whole books first, then partial ones with their runs", () => {
  assert.deepEqual(
    unfinishedTexts({
      draftChaptersByBook: { luke: [23, 24], acts: [1, 2], revelation: [1], john: [] },
      fullyDraftBooks: new Set(["acts", "revelation"]),
    }),
    ["Acts", "Revelation", "Luke 23–24"],
  );
  assert.deepEqual(unfinishedTexts({ draftChaptersByBook: {}, fullyDraftBooks: new Set() }), []);
});

test("joinList reads as a sentence at every length", () => {
  assert.equal(joinList(["Acts"]), "Acts");
  assert.equal(joinList(["Acts", "Revelation"]), "Acts and Revelation");
  assert.equal(joinList(["Acts", "Revelation", "Luke 23–24"]), "Acts, Revelation, and Luke 23–24");
});
