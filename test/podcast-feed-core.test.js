// test/podcast-feed-core.test.js
//
// Unit tests for src/lib/podcast-feed-core.ts — the pure parsing core behind the
// /found-in-translation-podcast page. Run with `npm test`. No disk fixtures:
// every case is a small inline RSS <item> shaped like the real RedCircle feed.
//
// podcast-feed-core.ts is TypeScript but contains only erasable syntax (type
// aliases, interfaces, parameter annotations), so Node's built-in type stripping
// (default-on from Node 22.18) imports it directly with the explicit .ts
// extension below — no loader, no new deps. This mirrors test/chapter-html.test.js.
//
// The core was split out of fetchPodcastEpisodes.ts precisely so these tests
// could exist: the shell imports podcastOverrides.json and podcast-feed.xml?raw,
// neither of which Node can resolve, so nothing here was testable before. The
// extractTag prefix-collision case below is the regression that proved it —
// `<itunes:episode…>` used to match `<itunes:episodeType>` on all 99 numbered
// episodes in the feed, and no test could have caught it.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseEpisodes,
  extractTag,
  normalizeTitle,
  inferReadLink,
  extractLinks,
  unescapeHtml,
} from "../src/lib/podcast-feed-core.ts";

// RedCircle emits itunes:episodeType BEFORE itunes:episode — the ordering that
// made the prefix collision reachable. Fixtures keep that order deliberately.
function item({
  type = "full",
  title = "Matthew 6",
  episode = "3",
  season = "1",
  pubDate = "Fri, 14 Aug 2026 19:50:23 +0000",
  body = "",
} = {}) {
  return [
    "<item>",
    `<itunes:episodeType>${type}</itunes:episodeType>`,
    `<itunes:title>${title}</itunes:title>`,
    `<title>${title}</title>`,
    episode === null ? "" : `<itunes:episode>${episode}</itunes:episode>`,
    season === null ? "" : `<itunes:season>${season}</itunes:season>`,
    `<pubDate>${pubDate}</pubDate>`,
    `<description><![CDATA[${body}]]></description>`,
    "</item>",
  ].join("\n");
}

const labels = (ep) => ep.links.map((l) => l.label);
const urlFor = (ep, label) => ep.links.find((l) => l.label === label)?.url;

// ---------------------------------------------------------------- extractTag

test("extractTag: reads a plain tag's content", () => {
  assert.equal(extractTag("<title>Matthew 6</title>", "title"), "Matthew 6");
});

test("extractTag: reads CDATA-wrapped content", () => {
  assert.equal(
    extractTag("<description><![CDATA[<p>hi</p>]]></description>", "description"),
    "<p>hi</p>"
  );
});

test("extractTag: tolerates attributes on the opening tag", () => {
  assert.equal(extractTag('<title lang="en">Mark 1</title>', "title"), "Mark 1");
});

test("extractTag: returns empty string for a tag that isn't present", () => {
  assert.equal(extractTag("<title>x</title>", "itunes:season"), "");
});

// The regression this whole module split exists for.
test("extractTag: a tag whose name prefixes another does not match it", () => {
  const xml =
    "<itunes:episodeType>full</itunes:episodeType><itunes:episode>7</itunes:episode>";
  assert.equal(extractTag(xml, "itunes:episode"), "7");
  assert.equal(extractTag(xml, "itunes:episodeType"), "full");
});

test("extractTag: prefix collision stays fixed when the longer tag is CDATA", () => {
  const xml =
    "<itunes:episodeType><![CDATA[bonus]]></itunes:episodeType><itunes:episode>12</itunes:episode>";
  assert.equal(extractTag(xml, "itunes:episode"), "12");
});

test("extractTag: an absent short tag does not fall back to its longer sibling", () => {
  // Only episodeType is present; asking for episode must yield nothing at all.
  const xml = "<itunes:episodeType>full</itunes:episodeType>";
  assert.equal(extractTag(xml, "itunes:episode"), "");
});

// ------------------------------------------------------------- normalizeTitle

test("normalizeTitle: folds dashes, smart quotes, and drops !?: ", () => {
  assert.equal(
    normalizeTitle("What is the Best Bible Translation:"),
    "what is the best bible translation"
  );
  assert.equal(normalizeTitle("A – B"), "a - b");
  assert.equal(normalizeTitle("Don’t Stop"), "don't stop");
});

test("normalizeTitle: collapses runs of whitespace", () => {
  assert.equal(normalizeTitle("  Mark    1  "), "mark 1");
});

// -------------------------------------------------------------- inferReadLink

test("inferReadLink: infers a chapter URL from a bare book-and-chapter title", () => {
  assert.equal(inferReadLink("Matthew 6"), "https://litbible.net/matthew-6");
});

test("inferReadLink: finds the book after an en dash", () => {
  assert.equal(
    inferReadLink("The Wisdom of the Marginalized – 1 Corinthians 1 & 2"),
    "https://litbible.net/1corinthians-1"
  );
});

test("inferReadLink: returns null when no book is named", () => {
  assert.equal(inferReadLink("No More Sacrifice!"), null);
});

// --------------------------------------------------------------- extractLinks

test("extractLinks: labels each platform and ignores unrelated hrefs", () => {
  const html = [
    '<a href="https://litbible.net/john-1">read</a>',
    '<a href="https://podcasts.apple.com/us/podcast/x/id1?i=123">apple</a>',
    '<a href="https://open.spotify.com/episode/abc">spotify</a>',
    '<a href="https://youtu.be/xyz">yt</a>',
    '<a href="https://example.com/">nope</a>',
  ].join("");
  assert.deepEqual(extractLinks(html).map((l) => l.label), [
    "Read the passage",
    "Listen on Apple Podcasts",
    "Listen on Spotify",
    "Watch on YouTube",
  ]);
});

test("extractLinks: an Apple link without an episode id is not a listen link", () => {
  // apps.apple.com app links and podcast show links both lack `i=`.
  const html = '<a href="https://apps.apple.com/app/id6772577879">app</a>';
  assert.deepEqual(extractLinks(html), []);
});

test("extractLinks: site-level litbible routes are not 'read the passage'", () => {
  const html = '<a href="https://litbible.net/glossary">glossary</a>';
  assert.deepEqual(extractLinks(html), []);
});

test("extractLinks: a repeated href is only counted once", () => {
  const html =
    '<a href="https://youtu.be/xyz">a</a><a href="https://youtu.be/xyz">b</a>';
  assert.equal(extractLinks(html).length, 1);
});

// -------------------------------------------------------------- unescapeHtml

test("unescapeHtml: decodes named and numeric entities, ampersand last", () => {
  assert.equal(unescapeHtml("a &amp;lt; b"), "a &lt; b");
  assert.equal(unescapeHtml("&#43;"), "+");
  assert.equal(unescapeHtml("1 &amp; 2"), "1 & 2");
});

// -------------------------------------------------------------- parseEpisodes

test("parseEpisodes: reads the scalar fields off an item", () => {
  const [ep] = parseEpisodes(item(), {});
  assert.equal(ep.title, "Matthew 6");
  assert.equal(ep.type, "full");
  assert.equal(ep.season, "1");
  assert.equal(ep.episode, "3");
  assert.equal(ep.pubDate, "Fri, 14 Aug 2026 19:50:23 +0000");
});

test("parseEpisodes: the episode number survives the episodeType sibling", () => {
  // End-to-end guard on the prefix collision, through the public entry point.
  const [ep] = parseEpisodes(item({ episode: "42" }), {});
  assert.equal(ep.episode, "42");
});

test("parseEpisodes: a missing episode number is undefined, not empty string", () => {
  const [ep] = parseEpisodes(item({ episode: null }), {});
  assert.equal(ep.episode, undefined);
});

test("parseEpisodes: skips trailers", () => {
  assert.deepEqual(parseEpisodes(item({ type: "trailer" }), {}), []);
});

test("parseEpisodes: marks bonus episodes", () => {
  const [ep] = parseEpisodes(item({ type: "bonus" }), {});
  assert.equal(ep.type, "bonus");
});

test("parseEpisodes: skips preview and teaser titles", () => {
  assert.deepEqual(parseEpisodes(item({ title: "Previewing Season 9" }), {}), []);
  assert.deepEqual(parseEpisodes(item({ title: "A Teaser" }), {}), []);
});

test("parseEpisodes: skips the hard-excluded titles", () => {
  assert.deepEqual(parseEpisodes(item({ title: "Looking Ahead" }), {}), []);
});

test("parseEpisodes: falls back to inferring the read link from the title", () => {
  const [ep] = parseEpisodes(item({ title: "Mark 4", body: "" }), {});
  assert.equal(urlFor(ep, "Read the passage"), "https://litbible.net/mark-4");
});

test("parseEpisodes: keeps only the first read link when the body has several", () => {
  const body =
    '<a href="https://litbible.net/mark-4">a</a><a href="https://litbible.net/mark-5">b</a>';
  const [ep] = parseEpisodes(item({ body }), {});
  assert.equal(labels(ep).filter((l) => l === "Read the passage").length, 1);
  assert.equal(urlFor(ep, "Read the passage"), "https://litbible.net/mark-4");
});

test("parseEpisodes: orders links Read then Apple then Spotify then YouTube", () => {
  const body = [
    '<a href="https://youtu.be/xyz">yt</a>',
    '<a href="https://open.spotify.com/episode/abc">sp</a>',
    '<a href="https://litbible.net/mark-4">read</a>',
    '<a href="https://podcasts.apple.com/us/podcast/x/id1?i=9">ap</a>',
  ].join("");
  const [ep] = parseEpisodes(item({ body }), {});
  assert.deepEqual(labels(ep), [
    "Read the passage",
    "Listen on Apple Podcasts",
    "Listen on Spotify",
    "Watch on YouTube",
  ]);
});

test("parseEpisodes: overrides add platform links the feed lacks", () => {
  const overrides = {
    "Matthew 6": {
      spotify: "https://open.spotify.com/episode/S",
      apple: "https://podcasts.apple.com/us/podcast/x/id1?i=1",
      youtube: "https://youtu.be/Y",
    },
  };
  const [ep] = parseEpisodes(item(), overrides);
  assert.equal(urlFor(ep, "Listen on Spotify"), "https://open.spotify.com/episode/S");
  assert.equal(urlFor(ep, "Watch on YouTube"), "https://youtu.be/Y");
});

test("parseEpisodes: an override never displaces a link the feed already supplied", () => {
  const body = '<a href="https://youtu.be/FEED">yt</a>';
  const overrides = { "Matthew 6": { youtube: "https://youtu.be/OVERRIDE" } };
  const [ep] = parseEpisodes(item({ body }), overrides);
  assert.equal(urlFor(ep, "Watch on YouTube"), "https://youtu.be/FEED");
});

test("parseEpisodes: a read override DOES replace the feed's read link", () => {
  const body = '<a href="https://litbible.net/mark-4">read</a>';
  const overrides = { "Matthew 6": { read: "https://litbible.net/john-1" } };
  const [ep] = parseEpisodes(item({ body }), overrides);
  assert.equal(urlFor(ep, "Read the passage"), "https://litbible.net/john-1");
  assert.equal(labels(ep).filter((l) => l === "Read the passage").length, 1);
});

test("parseEpisodes: a season override wins over the feed's season", () => {
  const overrides = { "Matthew 6": { season: "bonus" } };
  const [ep] = parseEpisodes(item(), overrides);
  assert.equal(ep.season, "bonus");
});

test("parseEpisodes: an override key matches a title differing only by dash style", () => {
  const overrides = {
    "Matthew 8 & 9 - Trust": { youtube: "https://youtu.be/Y" },
  };
  const [ep] = parseEpisodes(
    item({ title: "Matthew 8 & 9 – Trust" }),
    overrides
  );
  assert.equal(urlFor(ep, "Watch on YouTube"), "https://youtu.be/Y");
});

test("parseEpisodes: preserves feed order across multiple items", () => {
  const xml = item({ title: "Mark 1" }) + item({ title: "Mark 2" });
  assert.deepEqual(
    parseEpisodes(xml, {}).map((e) => e.title),
    ["Mark 1", "Mark 2"]
  );
});

test("parseEpisodes: an empty feed yields no episodes", () => {
  assert.deepEqual(parseEpisodes("", {}), []);
});
