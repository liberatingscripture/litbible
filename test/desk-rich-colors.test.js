// A sheet's text colors against its highlights (Audit 8, XA8-12; BVJ,
// 2026-11-10). A leader can give a word both a color and a highlight, so in
// dark mode every pair must still reach 4.5:1 (WCAG 1.4.3), on the raised
// surface the editor sits on and on the page's own. Read from the stylesheet itself,
// so a later change to a color or a tint is checked here too. Light mode is
// checked on the raised surface, where the editor sits.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The colors and tints are desk-sheet-view.css's since Audit 8, LG8-10.
const css = readFileSync(new URL("../src/styles/desk-sheet-view.css", import.meta.url), "utf8");
const COLORS = ["red", "blue", "green", "purple", "gray"];
const MARKS = ["yellow", "green", "blue", "pink"];

/** Every value a custom property is given in desk.css, in order: light, then the two dark blocks. */
function values(name) {
  const re = new RegExp(`${name}:\\s*([^;]+);`, "g");
  return [...css.matchAll(re)].map((m) => m[1].trim());
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgba = (s) => {
  const [r, g, b, a] = s.match(/[\d.]+/g).map(Number);
  return { rgb: [r, g, b], a };
};
const lum = (c) => {
  const [r, g, b] = c.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const over = ({ rgb, a }, ground) => rgb.map((v, i) => Math.round(v * a + ground[i] * (1 - a)));

function theme(i) {
  const color = Object.fromEntries(COLORS.map((c) => [c, hex(values(`--desk-rich-${c}`)[i])]));
  const mark = Object.fromEntries(MARKS.map((m) => [m, rgba(values(`--desk-hl-${m}`)[i])]));
  return { color, mark };
}

test("XA8-12: the two dark blocks agree, for the colors and the tints", () => {
  for (const c of COLORS) {
    const v = values(`--desk-rich-${c}`);
    assert.equal(v.length, 3, `--desk-rich-${c}: light and two dark`);
    assert.equal(v[1], v[2], `--desk-rich-${c}: both dark blocks`);
  }
  for (const m of MARKS) {
    const v = values(`--desk-hl-${m}`);
    assert.equal(v.length, 3, `--desk-hl-${m}: light and two dark`);
    assert.equal(v[1], v[2], `--desk-hl-${m}: both dark blocks`);
  }
});

function pairs(t, grounds) {
  const out = [];
  for (const [gName, ground] of Object.entries(grounds)) {
    for (const c of COLORS) {
      out.push({ what: `${c} on ${gName}`, ratio: contrast(t.color[c], ground) });
      for (const m of MARKS) {
        out.push({ what: `${c} on ${m} over ${gName}`, ratio: contrast(t.color[c], over(t.mark[m], ground)) });
      }
    }
  }
  return out;
}

test("XA8-12: in dark mode every text color is 4.5:1 on every highlight, on both surfaces", () => {
  const failing = pairs(theme(1), { raised: hex("#1d1d1f"), surface: hex("#161617") })
    .filter((p) => p.ratio < 4.5)
    .map((p) => `${p.what} ${p.ratio.toFixed(2)}`);
  assert.deepEqual(failing, []);
});

test("in light mode every text color is 4.5:1 on every highlight, on the editor's raised surface", () => {
  const failing = pairs(theme(0), { raised: hex("#FAFAF8") })
    .filter((p) => p.ratio < 4.5)
    .map((p) => `${p.what} ${p.ratio.toFixed(2)}`);
  assert.deepEqual(failing, []);
});
