// Featherboa's tokens (src/styles/tokens.css) hold the record's values
// (SITE-FEATHERBOA.md: "Color," "Sizes, space, and the measure," "Surfaces,"
// "Motion," "Night"), so a page built from them can't drift from it. The
// contrast table computed from these colors is featherboa-contrast.test.js.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readTokens, resolve, parseColor } from "./helpers/featherboa-css.mjs";

const { day, night, byFont } = readTokens();
const val = (name, theme = day) => {
  assert.ok(theme.has(name), `${name} is not in tokens.css`);
  return theme.get(name);
};
const px = (v) => {
  const m = v.match(/^([\d.]+)(px|rem)$/);
  assert.ok(m, `not a length: ${v}`);
  return m[2] === "rem" ? Number(m[1]) * 16 : Number(m[1]);
};

test("the colors: paper, ink, LIT Green, deep green, sunshine, red", () => {
  const brand = {
    "--brand-paper": "#FAFAF8",
    "--brand-ink": "#1D231C",
    "--brand-lit-green": "#209D50",
    "--brand-deep-green": "#0F6B33",
    "--brand-sunshine": "#FFD23F",
    "--brand-red": "#B3261E",
  };
  for (const [name, hex] of Object.entries(brand)) assert.equal(val(name).toUpperCase(), hex, name);
  // Each role points at its color by day.
  const roles = {
    "--color-page": "#FAFAF8",
    "--color-text": "#1D231C",
    "--color-mark": "#209D50",
    "--color-press": "#0F6B33",
    "--color-own": "#FFD23F",
    "--color-danger": "#B3261E",
  };
  for (const [name, hex] of Object.entries(roles)) assert.equal(resolve(val(name), day).toUpperCase(), hex, name);
});

test("grays are ink at 78% and 66%, never a separate gray", () => {
  assert.equal(val("--text-2-alpha"), "0.78");
  assert.equal(val("--text-3-alpha"), "0.66");
  assert.match(val("--color-text-2"), /^rgba\(var\(--color-text-rgb\), var\(--text-2-alpha\)\)$/);
  assert.match(val("--color-text-3"), /^rgba\(var\(--color-text-rgb\), var\(--text-3-alpha\)\)$/);
});

test("night: the page #111411, its text #ECEEE8, LIT Green lifted to #2DB463", () => {
  assert.equal(resolve(val("--color-page", night), night).toUpperCase(), "#111411");
  assert.equal(resolve(val("--color-text", night), night).toUpperCase(), "#ECEEE8");
  assert.equal(resolve(val("--color-mark", night), night).toUpperCase(), "#2DB463");
});

test("each *-rgb triple is its color, by day and by night", () => {
  for (const theme of [day, night]) {
    for (const [rgb, hex] of [["--color-page-rgb", "--color-page"], ["--color-text-rgb", "--color-text"]]) {
      const triple = resolve(val(rgb, theme), theme).split(",").map((n) => Number(n.trim()));
      assert.deepEqual(triple, parseColor(resolve(`var(${hex})`, theme)).slice(0, 3), rgb);
    }
  }
});

test("the ten sizes: Fraunces's four, the three reading sizes, the labels, the verse number", () => {
  const clampRange = (v) => {
    const m = v.match(/^clamp\(([\d.]+rem), .+, ([\d.]+rem)\)$/);
    assert.ok(m, `not a clamp: ${v}`);
    return [px(m[1]), px(m[2])];
  };
  assert.deepEqual(clampRange(val("--size-headline")), [56, 104], "Headline, 56 to 104");
  assert.equal(val("--leading-headline"), "0.95");
  assert.deepEqual(clampRange(val("--size-title")), [48, 62], "Title, 48 to 62");
  assert.equal(val("--leading-title"), "1");
  assert.equal(px(val("--size-heading")), 28, "Heading, 28");
  assert.equal(val("--leading-heading"), "1.15");
  assert.equal(px(val("--size-subhead")), 21, "Subhead, 21");
  assert.equal(val("--leading-subhead"), "1.2");
  assert.equal(px(val("--size-label")), 14.5, "Label, 14.5");
  assert.equal(val("--leading-label"), "1.4");
  assert.equal(px(val("--size-small-label")), 12.5, "Small label, 12.5");
  assert.equal(val("--leading-small-label"), "1.4");
  assert.equal(val("--size-verse-number"), "0.56em");
  // The reading sizes are refit for Source Sans 3 ("measured when it is
  // built"): Scripture over Text over Margin, and nothing under the Small label.
  const [scripture, text, margin] = ["--size-scripture", "--size-text", "--size-margin"].map((n) => px(val(n)));
  assert.ok(scripture > text && text > margin && margin >= 12.5, `${scripture} > ${text} > ${margin} >= 12.5`);
  for (const n of ["--leading-scripture", "--leading-text", "--leading-margin"]) {
    const l = Number(val(n));
    assert.ok(l >= 1.4 && l <= 1.65, `${n} ${l}`);
  }
});

test("one spacing scale of nine steps, and the three columns", () => {
  const steps = [4, 8, 12, 16, 24, 32, 48, 64, 96];
  steps.forEach((s, i) => assert.equal(val(`--space-${i + 1}`), `${s}px`));
  assert.equal(day.has("--space-10"), false);
  assert.equal(val("--col-side"), "220px");
  assert.equal(val("--col-text"), "660px");
  assert.equal(val("--col-margin"), "320px");
});

test("two corner radii and the round; one shadow, which night drops for an edge and a lighter float", () => {
  assert.equal(val("--radius-press"), "6px");
  assert.equal(val("--radius-float"), "10px");
  assert.equal(val("--radius-round"), "999px");
  const shadows = [...day.entries()].filter(([, v]) => /\d+px \d+px/.test(v)).map(([k]) => k);
  assert.deepEqual(shadows, ["--shadow-float"], "one shadow token");
  assert.equal(val("--shadow-float", night), "none");
  assert.notEqual(resolve(val("--color-float", night), night), resolve(val("--color-page", night), night));
});

test("four speeds, exits at two thirds, and one curve that never overshoots", () => {
  assert.equal(val("--dur-instant"), "0ms");
  assert.equal(val("--dur-quick"), "120ms");
  assert.equal(val("--dur-settled"), "180ms");
  assert.equal(val("--dur-large"), "260ms");
  for (const s of ["quick", "settled", "large"]) {
    const arrive = parseFloat(val(`--dur-${s}`));
    assert.equal(parseFloat(val(`--dur-${s}-out`)), Math.round((arrive * 2) / 3), `--dur-${s}-out`);
  }
  const m = val("--ease").match(/^cubic-bezier\(([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+)\)$/);
  assert.ok(m, "the curve is a cubic-bezier");
  const [x1, y1, x2, y2] = m.slice(1).map(Number);
  assert.ok(y1 > x1, "it arrives fast (an ease-out)");
  assert.ok(y1 <= 1 && y2 <= 1 && x2 <= 1, "nothing bounces");
});

test("the focus ring is deep green, 2px, 2px off the control", () => {
  assert.equal(val("--focus-ring"), "var(--color-press)");
  assert.equal(val("--focus-width"), "2px");
  assert.equal(val("--focus-offset"), "2px");
});

test("--ch is per face: Source Sans 3, OpenDyslexic, Atkinson", () => {
  assert.equal(val("--ch"), "0.497em");
  assert.equal(byFont.get('html[data-font="dyslexic"] --ch'), "0.5em");
  assert.equal(byFont.get('html[data-font="atkinson"] --ch'), "0.648em");
});

test("Fraunces's softness and wonk start at the specimen's", () => {
  assert.equal(val("--fraunces-heading"), '"SOFT" 50, "WONK" 1');
  assert.equal(val("--fraunces-numeral"), '"SOFT" 100, "WONK" 1');
});
