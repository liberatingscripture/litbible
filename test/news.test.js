// News in the header (SITE-FEATHERBOA.md, "News in the header"; NX-26,
// NX-27, NX-29, HD-31, HD-32; src/lib/news.mjs): which menus carry a dot and
// which rows say "New," given what a reader has seen, and what they have seen
// once they open a menu. The list ships empty; the last tests hold what must
// be true before its first entry.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  NEWS,
  NEWS_PLACES,
  SEEN_KEY,
  WHATS_NEW_HREF,
  checkNews,
  dayOf,
  liveNews,
  markedPlaces,
  markedRows,
  parseSeen,
  seenAfterOpening,
  unseen,
} from "../src/lib/news.mjs";
import { PLACES, placeBy } from "../src/lib/places.mjs";

const repo = join(import.meta.dirname, "..");

const SAMPLE = [
  { id: "episode-romans-8", place: "learn", row: "podcast" },
  { id: "article-trust", place: "learn", row: "articles", until: "2027-01-31" },
  { id: "sheets-share", place: "study", row: "sheets" },
  { id: "app-2-1", place: "about", row: "apps", until: "2026-12-01" },
];

test("the list ships empty, frozen, and good", () => {
  assert.ok(Array.isArray(NEWS));
  assert.ok(Object.isFrozen(NEWS));
  assert.deepEqual(checkNews(NEWS, PLACES), []);
});

test("news marks a place with a menu, never Read (NX-27, HD-32)", () => {
  assert.deepEqual([...NEWS_PLACES], ["study", "learn", "about"]);
  for (const key of NEWS_PLACES) assert.equal(placeBy(key).menu, true, key);
  assert.deepEqual(checkNews(SAMPLE, PLACES), [], "an episode and an article mark Learn, a feature Study, an app update About's Apps");
});

test("a bad entry is named, one sentence each", () => {
  const problems = checkNews(
    [
      { id: "Two Words", place: "learn", row: "glossary" },
      { id: "twice", place: "learn", row: "glossary" },
      { id: "twice", place: "learn", row: "glossary" },
      { id: "read-row", place: "read", row: "books" },
      { id: "no-row", place: "about", row: "whats-new" },
      { id: "also-row", place: "about", row: "release-notes", until: "soon" },
      { id: "extra", place: "study", row: "notebook", title: "Words belong on the What's New page" },
    ],
    PLACES,
  );
  assert.deepEqual(problems, [
    '"Two Words" is not an id (lowercase letters, digits, and hyphens)',
    "twice is used twice",
    'read-row: "read" is not a place news may mark (study, learn, about)',
    'no-row: "whats-new" is not a row of about',
    "also-row: until is a day written YYYY-MM-DD",
    "extra: title is not part of an entry",
  ]);
});

test("an entry shows through its last day, and one with no last day always", () => {
  assert.deepEqual(liveNews(SAMPLE, "2026-11-27").map((n) => n.id), ["episode-romans-8", "article-trust", "sheets-share", "app-2-1"]);
  assert.deepEqual(liveNews(SAMPLE, "2026-12-01").map((n) => n.id), ["episode-romans-8", "article-trust", "sheets-share", "app-2-1"], "its last day included");
  assert.deepEqual(liveNews(SAMPLE, "2026-12-02").map((n) => n.id), ["episode-romans-8", "article-trust", "sheets-share"]);
  assert.deepEqual(liveNews(SAMPLE, "2027-02-01").map((n) => n.id), ["episode-romans-8", "sheets-share"]);
  assert.equal(dayOf(new Date(2027, 0, 5, 23, 59)), "2027-01-05", "the reader's own day");
});

test("a dot on each menu holding something unseen, and “New” beside each row (NX-26)", () => {
  assert.deepEqual(markedPlaces(SAMPLE, []), ["learn", "study", "about"]);
  assert.deepEqual(markedRows(SAMPLE, []), ["learn:podcast", "learn:articles", "study:sheets", "about:apps"]);
  const seen = ["episode-romans-8", "article-trust"];
  assert.deepEqual(markedPlaces(SAMPLE, seen), ["study", "about"], "Learn's dot is gone once both are seen");
  assert.deepEqual(markedRows(SAMPLE, seen), ["study:sheets", "about:apps"]);
  assert.deepEqual(unseen(SAMPLE, SAMPLE.map((n) => n.id)), []);
  assert.deepEqual(markedPlaces([], []), [], "no news, no marks");
});

test("opening a menu sees all of its news, and the note keeps only ids still in the list", () => {
  const after = seenAfterOpening(SAMPLE, ["gone-long-ago", "sheets-share"], "learn");
  assert.deepEqual(after, ["sheets-share", "episode-romans-8", "article-trust"]);
  assert.deepEqual(markedPlaces(SAMPLE, after), ["about"]);
  assert.deepEqual(seenAfterOpening(SAMPLE, after, "learn"), after, "opening it again changes nothing");
  assert.deepEqual(seenAfterOpening(SAMPLE, [], "read"), [], "a place with no news sees nothing new");
});

test("the note is read back whatever a browser kept", () => {
  assert.deepEqual(parseSeen('["a","b"]'), ["a", "b"]);
  assert.deepEqual(parseSeen('["a",3,null]'), ["a"]);
  for (const junk of [null, undefined, "", "{", '{"a":1}', "42", "true"]) assert.deepEqual(parseSeen(junk), [], String(junk));
});

// ---------- Before the first entry ----------

test("the marks link the What's New page, which must exist once there is news (HD-31)", () => {
  assert.equal(WHATS_NEW_HREF, "/whats-new");
  if (NEWS.length === 0) return;
  const page = WHATS_NEW_HREF.slice(1);
  assert.ok(
    [`src/pages/${page}.astro`, `src/pages/${page}/index.astro`].some((f) => existsSync(join(repo, f))),
    "news links the What's New page: build it before the first entry",
  );
});

test("/privacy names the key the marks write once there is news (test/desk-storage-keys.test.js allows it until then)", () => {
  if (NEWS.length === 0) return;
  const privacy = readFileSync(join(repo, "src/pages/privacy.astro"), "utf8");
  assert.ok(privacy.includes(`<code>${SEEN_KEY}</code>`), `/privacy must name ${SEEN_KEY}: BVJ words it`);
});

test("SiteHeader.astro draws the marks from this list, and nothing when it is empty", () => {
  const header = readFileSync(join(repo, "src/components/SiteHeader.astro"), "utf8");
  assert.match(header, /import \{[^}]*\bNEWS\b[^}]*\} from "\.\.\/lib\/news\.mjs"/);
  for (const part of ["data-news-dot", "data-news-row", "data-news-more"]) assert.ok(header.includes(part), part);
});
