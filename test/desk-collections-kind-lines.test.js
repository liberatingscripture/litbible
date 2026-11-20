// The kind line's glyphs (a pinned footnote's thumbtack, a sheet's page; E197)
// and a highlight's words kept in the chapter's lines (E198; record-words.js,
// record-rows.js). BVJ, 2026-11-20.

import { test } from "node:test";
import assert from "node:assert/strict";
import "./helpers/browser-env.mjs";
import { splitQuoteIntoLines } from "../src/lib/desk-quote-lines.mjs";

// happy-dom has an IntersectionObserver that never reports; without one the rows read at once.
delete globalThis.IntersectionObserver;

const { recordRow } = await import("../src/scripts/desk/record-rows.js");

const LINES = ["Take notice! From now on,", "All generations will call me fortunate,", "Because the Mighty One did great things"];

test("a quote across poetry lines is split at each line", () => {
  assert.deepEqual(
    splitQuoteIntoLines(LINES, { exact: "From now on, All generations will call me fortunate," }),
    ["From now on,", "All generations will call me fortunate,"],
  );
});

test("a quote starting mid-line and ending mid-line", () => {
  assert.deepEqual(splitQuoteIntoLines(LINES, "now on, All generations will"), ["now on,", "All generations will"]);
});

test("whitespace differences are ignored", () => {
  assert.deepEqual(splitQuoteIntoLines(LINES, "From   now on,\n\u00a0All generations"), ["From now on,", "All generations"]);
});

test("a quote inside one line is one piece; one not found is null", () => {
  assert.deepEqual(splitQuoteIntoLines(LINES, "call me fortunate"), ["call me fortunate"]);
  assert.equal(splitQuoteIntoLines(LINES, "nothing like this"), null);
  assert.equal(splitQuoteIntoLines([], "x"), null);
});

test("the prefix picks among repeated words", () => {
  const lines = ["the Lord said", "and the Lord said"];
  assert.deepEqual(splitQuoteIntoLines(lines, { exact: "the Lord said", prefix: "and " }), ["the Lord said"]);
});

const hl = (extra = {}) => ({
  id: "h1", kind: "highlight", color: "yellow", bookKey: "luke", chapter: 1, verse: 51, endVerse: 52,
  quote: { exact: "From now on, All generations will call me fortunate," }, ...extra,
});
const rowOf = (record, readLines) =>
  recordRow(record, { labels: new Map(), onLabels() {}, onDelete() {}, readLines });
const tick = () => new Promise((r) => setTimeout(r, 0));

test("a highlight row shows its words in lines and keeps the tint", async () => {
  const calls = [];
  const li = rowOf(hl(), async (...a) => (calls.push(a), LINES));
  const sample = li.querySelector(".desk-swatch__sample");
  assert.ok(sample, "flat words first, in the tint");
  assert.equal(sample.textContent, hl().quote.exact);
  await tick();
  await tick();
  const after = li.querySelector(".desk-swatch[data-color='yellow'] .desk-swatch__sample");
  assert.ok(after, "same tint element");
  assert.equal(after.querySelectorAll("br").length, 1);
  assert.equal(after.textContent, "From now on,All generations will call me fortunate,");
  assert.deepEqual(calls[0], ["luke", 1, 51, 52]);
});

test("an unreadable chapter or a missing quote keeps the flat words; one word is never read", async () => {
  const a = rowOf(hl(), async () => null);
  const b = rowOf(hl(), async () => ["unrelated text"]);
  let read = 0;
  const c = rowOf(hl({ quote: { exact: "fortunate" } }), async () => (read++, LINES));
  await tick();
  await tick();
  assert.equal(a.querySelectorAll("br").length, 0);
  assert.equal(b.querySelector(".desk-swatch__sample").textContent, hl().quote.exact);
  assert.equal(read, 0);
  assert.equal(c.querySelectorAll("br").length, 0);
});

test("a pinned footnote and a sheet lead their kind line with a hidden glyph; the words are unchanged", () => {
  const pin = rowOf({ id: "p1", kind: "footnotePin", bookKey: "luke", chapter: 1, verse: 5, footnote: "A note." });
  const kind = pin.querySelector(".desk-item__kind");
  assert.ok(kind.firstElementChild.matches("svg[aria-hidden='true']"));
  assert.equal(kind.textContent.trim(), "Pinned footnote");
  const sheet = rowOf({ id: "s1", kind: "sheet", title: "Lent", modules: [] });
  const k2 = sheet.querySelector(".desk-item__kind");
  assert.ok(k2.firstElementChild.matches("svg.desk-kind-glyph--sheet[aria-hidden='true']"));
  assert.equal(k2.textContent.trim(), "Sheet");
});
