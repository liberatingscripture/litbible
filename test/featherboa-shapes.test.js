// "Surfaces" (SITE-FEATHERBOA.md): one shadow, and it means "this floats over
// the page and will go away." Every shadow in the site's stylesheets is the
// float's token, none, or a line drawn without blur (an edge or a ring, not a
// shadow), but for the places a later phase replaces: the Study Desk's four
// button kinds (the kit, Phase 2) and the Sheets' paper and present mode
// (Phase 11). Each phase deletes its lines here. The two corner radii
// (SU-04) join this file with the kit, which gives them their controls.

import { test } from "node:test";
import assert from "node:assert/strict";
import { styleSources, declarations, splitTop, isMirrored } from "./helpers/featherboa-css.mjs";

const LATER = new Map([["src/styles/pages/sheets-page.css", 11]]);
// The desk's button kinds keep their shadows until the kit (Phase 2).
const KINDS = /^var\(--desk-(btn-(rest|lift|press)|primary-press)\)$/;

/** The blur of one shadow: its third length, 0 when it has none. */
function blur(shadow) {
  const lengths = shadow
    .replace(/\binset\b/g, " ")
    .replace(/(rgba?|hsla?|color-mix)\([^()]*(\([^()]*\)[^()]*)*\)|var\([^()]*\)|#[0-9a-f]{3,8}\b/gi, " ")
    .replace(/\b(transparent|currentcolor|white|black)\b/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return lengths.length >= 3 ? parseFloat(lengths[2]) : 0;
}

function verdict(d) {
  const v = d.value.trim();
  if (d.prop === "box-shadow" || d.prop === "text-shadow") {
    if (v === "none" || v === "var(--shadow-float)" || KINDS.test(v)) return null;
    if (/^var\(/.test(v)) return "a shadow token other than --shadow-float";
    return splitTop(v).every((s) => blur(s) === 0) ? null : "a blurred shadow";
  }
  if (d.prop === "filter" && /drop-shadow\(/.test(v)) return "a drop shadow";
  return null;
}

test("one shadow (SU-05): the float's token, or a line with no blur", () => {
  const bad = [];
  for (const { rel, css } of styleSources()) {
    if (isMirrored(rel) || LATER.has(rel) || rel === "src/styles/tokens.css") continue;
    for (const d of declarations(css)) {
      const why = verdict(d);
      if (why) bad.push(`${rel}:${d.line} ${d.prop}: ${d.value} (${why})`);
    }
  }
  assert.deepEqual(bad, []);
});

test("what wears the shadow is a float: the float's surface in the same rule", () => {
  const bad = [];
  for (const { rel, css } of styleSources()) {
    if (isMirrored(rel)) continue;
    const rules = new Map();
    for (const d of declarations(css)) {
      const key = d.context.join(" | ");
      if (!rules.has(key)) rules.set(key, []);
      rules.get(key).push(d);
    }
    for (const [key, decls] of rules) {
      const wears = decls.find((d) => d.prop === "box-shadow" && d.value.trim() === "var(--shadow-float)");
      if (!wears) continue;
      const bg = decls.find((d) => d.prop === "background" || d.prop === "background-color");
      // A tooltip is the one float drawn in the text's own color (its words
      // in the page's), so it reads as a label and not as a menu.
      const ok = bg && (/var\(--color-float\)/.test(bg.value) || /^var\(--text\)$/.test(bg.value.trim()));
      // The menu's side tray (Phase 3 makes it a float like the others).
      const later = /\.menu-overlay__panel$/.test(key);
      if (!ok && !later) bad.push(`${rel}:${wears.line} ${key} (background: ${bg ? bg.value : "none"})`);
    }
  }
  assert.deepEqual(bad, []);
});

test("blur reads a shadow's third length", () => {
  assert.equal(blur("0 1px 2px rgba(29, 35, 28, 0.08)"), 2);
  assert.equal(blur("-1px 0 0 rgba(var(--ink-rgb), 0.25)"), 0);
  assert.equal(blur("0 0 0 2px var(--focus-ring)"), 0);
  assert.equal(blur("inset 0 1px 0 #fff"), 0);
});
