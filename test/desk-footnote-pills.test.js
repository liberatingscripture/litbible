// test/desk-footnote-pills.test.js
//
// src/lib/desk-footnote-pills.mjs: a footnote's Pin sits in the left margin,
// with its word or as the thumbtack alone, and never on the note's line
// (E49; one pill since E79; no "inline" since E81).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  GLYPH_WIDTH, PILL_EDGE, PILL_OFFSET, PIN_FALLBACK, PIN_MARGIN, footnotePillPlace,
} from "../src/lib/desk-footnote-pills.mjs";

const PIN = 56;
const need = (w) => w + PILL_OFFSET + PILL_EDGE;

test("a wide margin holds Pin with its word", () => {
  assert.deepEqual(footnotePillPlace({ free: 300, width: PIN }), { mode: "row", indent: 0 });
});

test("the word stays exactly while Pin, its offset and the window's edge fit", () => {
  assert.equal(footnotePillPlace({ free: need(PIN), width: PIN }).mode, "row");
  assert.equal(footnotePillPlace({ free: need(PIN) - 1, width: PIN }).mode, "glyph");
});

test("a tighter margin drops the word and moves nothing while the thumbtack fits", () => {
  assert.deepEqual(footnotePillPlace({ free: need(PIN) - 1, width: PIN }), { mode: "glyph", indent: 0 });
  assert.deepEqual(footnotePillPlace({ free: PIN_MARGIN, width: PIN }), { mode: "glyph", indent: 0 });
});

test("a margin too narrow for the thumbtack indents the list by what is missing", () => {
  assert.deepEqual(footnotePillPlace({ free: PIN_MARGIN - 1, width: PIN }), { mode: "glyph", indent: 1 });
  assert.deepEqual(footnotePillPlace({ free: 16, width: PIN }), { mode: "glyph", indent: PIN_MARGIN - 16 });
  assert.deepEqual(footnotePillPlace({ free: 0, width: PIN }), { mode: "glyph", indent: PIN_MARGIN });
  assert.deepEqual(footnotePillPlace({ free: -30, width: PIN }), { mode: "glyph", indent: PIN_MARGIN + 30 });
  // A fraction of a pixel short still clears the window's edge.
  assert.equal(footnotePillPlace({ free: PIN_MARGIN - 0.4, width: PIN }).indent, 1);
});

test("a wider face needs a wider margin for the word", () => {
  assert.equal(footnotePillPlace({ free: 90, width: 84 }).mode, "glyph");
  assert.equal(footnotePillPlace({ free: need(84), width: 84 }).mode, "row");
});

test("with no width measured yet, the Inter width stands in", () => {
  assert.equal(footnotePillPlace({ free: need(PIN_FALLBACK) }).mode, "row");
  assert.equal(footnotePillPlace({ free: need(PIN_FALLBACK) - 1 }).mode, "glyph");
});

test("a nonsense width never throws", () => {
  assert.equal(footnotePillPlace({ free: 5, width: -10 }).mode, "glyph");
  assert.equal(footnotePillPlace({ free: PILL_OFFSET + PILL_EDGE, width: -10 }).mode, "row");
});

test("Pin is never placed anywhere but the left margin, and never off the window", () => {
  for (let free = -50; free <= 400; free += 3) {
    const at = footnotePillPlace({ free, width: PIN });
    assert.ok(["row", "glyph"].includes(at.mode));
    const width = at.mode === "row" ? PIN : GLYPH_WIDTH;
    assert.ok(free + at.indent - PILL_OFFSET - width >= PILL_EDGE, String(free));
  }
});

// GLYPH_WIDTH restates desk.css: a 14px glyph, 8px of padding each side, a 1px border.
test("GLYPH_WIDTH matches the thumbtack pill desk.css draws", () => {
  const css = readFileSync(new URL("../src/styles/desk.css", import.meta.url), "utf8");
  const rule = /\.desk-pin--glyph \{([^}]*)\}/.exec(css)[1];
  const pad = /padding: \d+px (\d+)px;/.exec(rule);
  assert.ok(pad, "side padding in px");
  const border = /\.desk-pin \{[^}]*border: (\d+)px solid/.exec(css);
  const glyph = /ICON_PIN = `<svg[^>]*\swidth="(\d+)"/.exec(
    readFileSync(new URL("../src/scripts/desk/pins.js", import.meta.url), "utf8"),
  );
  assert.ok(border && glyph, "the border and the glyph's width");
  assert.equal(Number(glyph[1]) + 2 * Number(pad[1]) + 2 * Number(border[1]), GLYPH_WIDTH);
});

test("desk.css never draws Pin on the note's line", () => {
  const css = readFileSync(new URL("../src/styles/desk.css", import.meta.url), "utf8");
  assert.equal(/data-desk-fn-pills="inline"/.test(css), false);
  assert.match(css, /\.footnotes > li\.desk-fn > \.desk-fn-pills \{\s*position: absolute;/);
});

// E82 (BVJ, 2026-11-10): Pin is out of sight until the reader is at its
// footnote. A CSS rule, which happy-dom can't lay out, so the stylesheet is read.
test("E82: Pin shows on hover, focus, a link's target and while pinned, and is hidden by opacity alone", () => {
  const css = readFileSync(new URL("../src/styles/desk.css", import.meta.url), "utf8");
  const pin = "\\.footnotes > li\\.desk-fn";
  assert.match(css, new RegExp(`\\n${pin} > \\.desk-fn-pills > \\.desk-pin \\{\\s*opacity: 0;`));
  // It waits before hiding, so the pointer can cross the text-width line to reach it.
  assert.match(css, /transition: opacity 120ms ease-out 400ms;/);
  const shown = new RegExp(
    `${pin}:hover > \\.desk-fn-pills > \\.desk-pin,\\s*` +
      `${pin}:focus-within > \\.desk-fn-pills > \\.desk-pin,\\s*` +
      `${pin}:target > \\.desk-fn-pills > \\.desk-pin,\\s*` +
      `${pin} > \\.desk-fn-pills > \\.desk-pin\\[aria-pressed="true"\\] \\{\\s*opacity: 1;`,
  );
  assert.match(css, shown);
  // Never taken out of the tab order or the layout.
  const block = css.slice(css.indexOf("/* Pin shows only for the footnote"), css.indexOf("/* The popover:"));
  assert.equal(/display:\s*none|visibility:\s*hidden/.test(block), false);
  // The space between Pin and its footnote belongs to the row's hover.
  assert.match(css, /\.footnotes > li\.desk-fn > \.desk-fn-pills \{[^}]*right: 100%;\s*padding-right: 14px;/);
});
