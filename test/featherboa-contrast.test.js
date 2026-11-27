// Featherboa's contrast table ("Night," SITE-FEATHERBOA.md), computed from
// the colors in src/styles/tokens.css with the WCAG 2 formula, by day and by
// night: every pair clears its threshold (4.5:1 for words, 3:1 for LIT Green,
// which marks and sets large type but never small words), and comes out at
// the record's figure, within 0.1 (the table rounds to one place, and gives
// the one night pair of deep green and the page as both 9.6 and 9.7). A token
// change that moves a pair fails here first.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readTokens, resolve, parseColor, over, contrast } from "./helpers/featherboa-css.mjs";

const { day, night, nightMedia, nightAttr } = readTokens();
const color = (theme, name) => parseColor(resolve(`var(${name})`, theme));

/** What a pair's words stand on, opaque: the page, or a wash over it. */
function ground(theme, layer) {
  const page = color(theme, "--color-page");
  return layer ? over(color(theme, layer), page) : page;
}
function ratio(theme, fg, layer, bgToken) {
  const bg = bgToken ? color(theme, bgToken) : ground(theme, layer);
  return contrast(over(color(theme, fg), bg), bg);
}

// The record's table: [what, words, what they sit on, day, night, threshold].
// "on" is a wash laid over the page, or (bg:) a solid fill.
const TABLE = [
  ["ink on paper (scripture, all body text)", "--color-text", {}, 15.4, 15.9, 4.5],
  ["second ink on paper (captions, secondary labels)", "--color-text-2", {}, 7.6, 9.0, 4.5],
  ["third ink on paper (counts, dates)", "--color-text-3", {}, 5.1, 5.9, 4.5],
  ["third ink on the darkest tint (counts in a selected sidebar row)", "--color-text-3", { on: "--color-tint-strong" }, 4.8, 5.4, 4.5],
  ["deep green on paper (links, plain green commands)", "--color-press", {}, 6.3, 9.6, 4.5],
  ["the label on the filled button", "--color-on-press", { bg: "--color-press" }, 6.6, 9.7, 4.5],
  // The table says 13.3 by day, the proposal's figure, but "Color" keeps
  // today's four highlighter colors ("Unchanged"), whose yellow gives 13.4.
  ["ink on a highlight (highlighted scripture)", "--color-text", { on: "--hl-yellow" }, 13.4, 8.1, 4.5],
  ["red on paper (deleting, errors)", "--color-danger", {}, 6.3, 7.5, 4.5],
  ["LIT Green on paper (the chapter numeral, the “you are here” line)", "--color-mark", {}, 3.4, 6.9, 3],
];

for (const [what, fg, { on, bg }, dayFigure, nightFigure, threshold] of TABLE) {
  test(`contrast: ${what}, ${dayFigure} by day and ${nightFigure} by night`, () => {
    for (const [theme, figure, name] of [[day, dayFigure, "day"], [night, nightFigure, "night"]]) {
      const r = ratio(theme, fg, on, bg);
      assert.ok(r >= threshold, `${name}: ${r.toFixed(2)} is under ${threshold}`);
      assert.ok(Math.abs(r - figure) <= 0.1, `${name}: ${r.toFixed(2)}, the record says ${figure}`);
    }
  });
}

test("every highlighter color has a night wash whose words read at 8:1 or more, and 4.5 by day", () => {
  for (const wash of ["--hl-yellow", "--hl-green", "--hl-blue", "--hl-pink"]) {
    assert.ok(nightMedia.has(wash), `${wash} has no night value`);
    const n = ratio(night, "--color-text", wash);
    assert.ok(n >= 8, `${wash} by night: ${n.toFixed(2)}`);
    const d = ratio(day, "--color-text", wash);
    assert.ok(d >= 4.5, `${wash} by day: ${d.toFixed(2)}`);
  }
});

test("the night is written the same in both dark selectors (the device's setting and the reader's)", () => {
  assert.deepEqual([...nightAttr.entries()].sort(), [...nightMedia.entries()].sort());
  assert.ok(nightMedia.size > 10, "the night block is missing");
});
