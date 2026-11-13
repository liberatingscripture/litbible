// The Study Desk's help page (src/pages/desk/help.astro; E125, BVJ 2026-11-12):
// its contents list reaches every heading, and every address a link or a
// record may cite still lands on its topic.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/pages/desk/help.astro", import.meta.url), "utf8");
const [, front, body] = src.split(/^---\r?$/m);

/** The ids the contents list names (`parts` in the frontmatter). */
const listed = [...front.matchAll(/\bid: "([^"]+)"/g)].map((m) => m[1]);
/** The ids on the page's h2 and h3 headings, the contents' own heading aside. */
const headings = [...body.matchAll(/<h[23] id="([^"]+)"/g)].map((m) => m[1]).filter((id) => id !== "contents");

test("the help page's contents list and its headings name the same topics, in order", () => {
  assert.ok(listed.length > 20, "the contents were read");
  assert.deepEqual(listed, headings);
  assert.equal(new Set(listed).size, listed.length, "no id twice");
});

test("every address the help page had before E125 is still a heading's", () => {
  // The desk links #ways-to-keep (WAYS_HREF); the rest may be cited in records.
  const old = [
    "desk-page", "sheets", "making-marks", "panel", "footnote-pins", "print-part",
    "ways-to-keep", "copies", "delete-everything", "bookmarks", "labels", "greek",
    "search", "tour", "sharing", "missing",
  ];
  for (const id of old) assert.ok(headings.includes(id), `#${id} is gone`);
  const firstUse = readFileSync(new URL("../src/lib/desk-first-use.mjs", import.meta.url), "utf8");
  assert.ok(firstUse.includes('"/desk/help/#ways-to-keep"'), "WAYS_HREF still names the address checked here");
});

test("every link within the help page lands on an id it has", () => {
  const ids = new Set([...body.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  for (const [, id] of body.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(id), `#${id} has no target`);
});

test("the help page folds nothing away and runs no script", () => {
  assert.doesNotMatch(body, /<details|<script/);
});

test("the help page's copy keeps the site's conventions", () => {
  const prose = body.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  assert.doesNotMatch(prose, /\u2014/, "no em dash");
  assert.doesNotMatch(prose, /”[.,]/, "periods and commas go inside a closing quote");
  assert.doesNotMatch(prose.replace(/<[^>]+>|\{[^}]*\}/g, ""), /["']/, "curly quotes only");
});
