// test/go-deeper.test.js
//
// Unit tests for "Go deeper" under each chapter (audit X3): which chapters a
// podcast episode is about (episodeChapters, in podcast-feed-core.ts), and the
// pure helpers in src/lib/go-deeper.mjs that index articles and episodes by
// chapter and lay out the rows. The shell (go-deeper-data.ts) loads Astro
// collections, so it is exercised by the build rather than here.
//
// podcast-feed-core.ts is erasable TypeScript, imported directly through
// Node's type stripping, as test/podcast-feed-core.test.js does.

import { test } from "node:test";
import assert from "node:assert/strict";

import { episodeChapters } from "../src/lib/podcast-feed-core.ts";
import { byChapter, chapterLinks, goDeeperRows } from "../src/lib/go-deeper.mjs";

const episode = (title, links = []) => ({ title, type: "full", pubDate: "", links });
const keys = (refs) => refs.map((r) => `${r.bookKey}-${r.chapter}`);
const read = (url) => ({ label: "Read the passage", url });

/* ── episodeChapters ───────────────────────────────────────────────────── */

test("episodeChapters: one chapter in the title", () => {
  assert.deepEqual(keys(episodeChapters(episode("Philemon 1"))), ["philemon-1"]);
});

test("episodeChapters: two chapters joined with & or and", () => {
  assert.deepEqual(
    keys(episodeChapters(episode("Did Jesus Oppose Patriarchy? – Matthew 19 & 20 with Kalie May Hargrove"))),
    ["matthew-19", "matthew-20"],
  );
  assert.deepEqual(keys(episodeChapters(episode("Romans 1:24–32 and 2"))), ["romans-1", "romans-2"]);
});

test("episodeChapters: a chapter range expands to every chapter in it", () => {
  assert.deepEqual(
    keys(episodeChapters(episode("Why is Peter Called Satan by Jesus? – Matthew 16-18 with Avery Arden"))),
    ["matthew-16", "matthew-17", "matthew-18"],
  );
});

test("episodeChapters: half-chapter letters don't stop a range", () => {
  assert.deepEqual(keys(episodeChapters(episode("Blood and Glory (Hebrews 6b-9)"))), [
    "hebrews-6",
    "hebrews-7",
    "hebrews-8",
    "hebrews-9",
  ]);
});

test("episodeChapters: a dash after a verse is a verse range, not a chapter range", () => {
  assert.deepEqual(keys(episodeChapters(episode("Galatians 3:6-29"))), ["galatians-3"]);
  assert.deepEqual(keys(episodeChapters(episode("Revelation 12:1-13 – the dragon"))), ["revelation-12"]);
});

test("episodeChapters: a dash before words is not a range", () => {
  assert.deepEqual(keys(episodeChapters(episode("Matthew 5 – Part One"))), ["matthew-5"]);
});

test("episodeChapters: comma lists, and two books in one title", () => {
  assert.deepEqual(keys(episodeChapters(episode("Mark 1, 2 and 4"))), ["mark-1", "mark-2", "mark-4"]);
  assert.deepEqual(keys(episodeChapters(episode("1 John 4 and John 3"))), ["1john-4", "john-3"]);
});

test("episodeChapters: the title wins over a Read the passage link", () => {
  // The feed's own link for this episode once pointed at Matthew 25.
  const ep = episode("How Does Jesus' Arrest & Trial Expose State Violence? – Matthew 26 with Brian Murphy", [
    read("https://litbible.net/matthew-25/"),
  ]);
  assert.deepEqual(keys(episodeChapters(ep)), ["matthew-26"]);
});

test("episodeChapters: a title naming no chapter falls back to the Read link", () => {
  const ep = episode("In the Beginning was the Conversation", [read("https://litbible.net/john-1/")]);
  assert.deepEqual(keys(episodeChapters(ep)), ["john-1"]);
});

test("episodeChapters: the fallback accepts only a New Testament chapter on this site", () => {
  assert.deepEqual(episodeChapters(episode("A conversation", [read("https://litbible.net/genesis-1/")])), []);
  assert.deepEqual(episodeChapters(episode("A conversation", [read("https://example.com/john-1/")])), []);
  assert.deepEqual(episodeChapters(episode("A conversation")), []);
});

/* ── chapterLinks ──────────────────────────────────────────────────────── */

test("chapterLinks: the chapters a rendered article links, in first-link order", () => {
  const html = [
    '<a class="sref" href="/romans-8/#v3">Romans 8:3</a>',
    '<a href="https://litbible.net/john-3">John 3</a>',
    '<a href="https://www.litbible.net/romans-8/">again</a>',
    '<a class="sref" href="/1corinthians-13/#v4-7">1 Corinthians 13:4–7</a>',
  ].join(" ");
  assert.deepEqual(chapterLinks(html), ["romans-8", "john-3", "1corinthians-13"]);
});

test("chapterLinks: other pages and other sites are not chapters", () => {
  const html =
    '<a href="/glossary/#flesh-body">flesh</a> <a href="/articles/x/">x</a> ' +
    '<a href="https://example.com/john-3/">elsewhere</a> <a href="/read/john/#ch-3">read</a>';
  assert.deepEqual(chapterLinks(html), []);
});

/* ── byChapter ─────────────────────────────────────────────────────────── */

test("byChapter: indexes each item under every chapter it names, keeping order", () => {
  const a = { id: "a", keys: ["john-3", "john-4"] };
  const b = { id: "b", keys: ["john-3"] };
  const map = byChapter([a, b], (x) => x.keys);
  assert.deepEqual(map.get("john-3"), [a, b]);
  assert.deepEqual(map.get("john-4"), [a]);
  assert.equal(map.has("john-5"), false);
});

test("byChapter: an item naming a chapter twice is listed once", () => {
  const a = { keys: ["john-3", "john-3"] };
  assert.deepEqual(byChapter([a], (x) => x.keys).get("john-3"), [a]);
});

/* ── goDeeperRows ──────────────────────────────────────────────────────── */

const n = (count, prefix) => Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);

test("goDeeperRows: one row per kind with something, in a fixed order", () => {
  const rows = goDeeperRows({
    episodes: ["e1"],
    articles: ["a1"],
    terms: ["t1", "t2"],
    intro: { label: "Introduction to John", href: "/john-intro/" },
  });
  assert.deepEqual(
    rows.map((r) => [r.kind, r.label]),
    [
      ["listen", "Listen"],
      ["read", "Read"],
      ["terms", "Key terms"],
      ["book", "Book"],
    ],
  );
});

test("goDeeperRows: a kind with nothing gets no row, and nothing at all gets none", () => {
  assert.deepEqual(
    goDeeperRows({ terms: ["t1"] }).map((r) => r.kind),
    ["terms"],
  );
  assert.deepEqual(goDeeperRows({}), []);
});

test("goDeeperRows: two episodes and three articles show, the rest wait in `more`", () => {
  const [listen, readRow] = goDeeperRows({ episodes: n(3, "e"), articles: n(5, "a") });
  assert.deepEqual(listen.items, ["e1", "e2"]);
  assert.deepEqual(listen.more, ["e3"]);
  assert.deepEqual(readRow.items, ["a1", "a2", "a3"]);
  assert.deepEqual(readRow.more, ["a4", "a5"]);
});

test("goDeeperRows: nothing held back when a list fits", () => {
  const [listen, readRow] = goDeeperRows({ episodes: n(2, "e"), articles: n(1, "a") });
  assert.deepEqual(listen.more, []);
  assert.deepEqual(readRow.more, []);
});

test("goDeeperRows: key terms and the book always show whole", () => {
  const rows = goDeeperRows({ terms: n(20, "t"), intro: { label: "I", href: "/x/" } });
  assert.equal(rows[0].items.length, 20);
  assert.deepEqual(rows[0].more, []);
  assert.deepEqual(rows[1].more, []);
});

test("goDeeperRows: the limits can be changed", () => {
  const [listen, readRow] = goDeeperRows(
    { episodes: n(3, "e"), articles: n(3, "a") },
    { episodes: 1, articles: 0 },
  );
  assert.deepEqual(listen.items, ["e1"]);
  assert.deepEqual(readRow.items, []);
  assert.deepEqual(readRow.more, ["a1", "a2", "a3"]);
});
