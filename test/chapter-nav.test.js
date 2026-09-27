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
  neighbours,
  pageHref,
  pageLabel,
  readingSequence,
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

test("an ordinary step goes to the next chapter, and chapter 1 goes back to its intro", () => {
  const n = nav("john", 3);
  assert.deepEqual(n.prev, { href: "/john-2/", label: "John 2" });
  assert.deepEqual(n.next, { href: "/john-4/", label: "John 4" });
  assert.equal(n.prevSkipped, null);
  assert.equal(n.nextSkipped, null);
  assert.deepEqual(nav("john", 1).prev, { href: "/john-intro/", label: "John introduction" });
});

test("Mark 16 steps over Luke's unwritten intro to Luke 1, and back", () => {
  const fwd = nav("mark", 16);
  assert.deepEqual(fwd.next, { href: "/luke-1/", label: "Luke 1" });
  assert.equal(fwd.nextSkipped.sentence, "The Luke introduction is still being written.");
  const back = nav("luke", 1);
  assert.deepEqual(back.prev, { href: "/mark-16/", label: "Mark 16" });
  assert.equal(back.prevSkipped.text, "the Luke introduction");
});

test("Luke 22 steps over Luke 23–24 to the John introduction", () => {
  const n = nav("luke", 22);
  assert.deepEqual(n.next, { href: "/john-intro/", label: "John introduction" });
  assert.equal(n.nextSkipped.sentence, "Luke 23–24 are still being translated.");
  assert.equal(nav("john", "intro").prevSkipped.text, "Luke 23–24");
});

test("a whole unfinished book is named once, intro included", () => {
  const n = nav("john", 21);
  assert.deepEqual(n.next, { href: "/romans-intro/", label: "Romans introduction" });
  assert.equal(n.nextSkipped.sentence, "Acts is still being translated.");
  const back = nav("romans", "intro");
  assert.deepEqual(back.prev, { href: "/john-21/", label: "John 21" });
  assert.equal(back.prevSkipped.text, "Acts");
});

test("the last published page has no Next, but still says why", () => {
  const n = nav("jude", 1);
  assert.equal(n.next, null);
  assert.equal(n.nextSkipped.sentence, "Revelation is still being translated.");
  assert.deepEqual(n.prev, { href: "/jude-intro/", label: "Jude introduction" });
});

test("the first page has no Previous and nothing skipped", () => {
  const n = nav("matthew", "intro");
  assert.equal(n.prev, null);
  assert.equal(n.prevSkipped, null);
});

test("a draft page finds the nearest published page on either side", () => {
  const n = nav("acts", 5);
  assert.deepEqual(n.prev, { href: "/john-21/", label: "John 21" });
  assert.deepEqual(n.next, { href: "/romans-intro/", label: "Romans introduction" });
  assert.equal(n.prevSkipped.text, "the Acts introduction and Acts 1–4");
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
