// "Surfaces" (SITE-FEATHERBOA.md): one shadow, and it means "this floats over
// the page and will go away." Every shadow in the site's stylesheets is the
// float's token, none, or a line drawn without blur (an edge or a ring, not a
// shadow), but for the places a later phase replaces: the Sheets' paper and
// present mode (Phase 11). Each phase deletes its lines here. And two corner
// radii ("Surfaces," "Shapes"): 6px on what is pressed, 10px on what floats,
// and round only for a switch, a color dot, and the emblem.

import { test } from "node:test";
import assert from "node:assert/strict";
import { styleSources, declarations, splitTop, isMirrored } from "./helpers/featherboa-css.mjs";

const LATER = new Map([
  ["src/styles/pages/sheets-page.css", 11],
  ["src/styles/desk-sheet-view.css", 11],
]);

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
    if (v === "none" || v === "var(--shadow-float)") return null;
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
  assert.deepEqual(bad, [], `${bad.length} shadows:\n${bad.join("\n")}`);
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

/** A radius is a token, 0, or inherit, up to four of them. */
const ONE = String.raw`(?:0|var\(--radius-(?:press|float|round)\))`;
const RADIUS = new RegExp(String.raw`^(?:inherit|${ONE}(?: ${ONE}){0,3})$`);
/** The round things ("Shapes"): a switch, a color dot, and the emblem (the
 *  LSC mark is the Collective's emblem). */
const ROUND = /switch|(?:^|[-_.])dots?(?:$|[-_\s:[.),])|swatch|emblem|lsc-mark/i;

test("two corner radii (SU-04, KT-13, KT-14): 6px pressed, 10px floating, round only for a switch, a color dot, and the emblem", () => {
  const bad = [];
  for (const { rel, css } of styleSources()) {
    if (isMirrored(rel) || LATER.has(rel) || rel === "src/styles/tokens.css") continue;
    for (const d of declarations(css)) {
      if (!/^border(-(top|bottom)-(left|right)|-(start|end)-(start|end))?-radius$/.test(d.prop)) continue;
      const v = d.value.trim();
      const rule = d.context[d.context.length - 1] || "";
      if (!RADIUS.test(v)) bad.push(`${rel}:${d.line} ${rule} { ${d.prop}: ${v} } (not a radius token)`);
      else if (v.includes("--radius-round") && !ROUND.test(rule)) bad.push(`${rel}:${d.line} ${rule} { ${d.prop}: ${v} } (round, but not a switch, a dot, or the emblem)`);
    }
  }
  assert.deepEqual(bad, [], `${bad.length} radii:\n${bad.join("\n")}`);
});

test("the radius reader takes tokens and refuses the rest", () => {
  for (const ok of ["0", "inherit", "var(--radius-press)", "var(--radius-float) var(--radius-float) 0 0"]) assert.match(ok, RADIUS);
  for (const no of ["4px", "50%", "999px", "var(--radius-press) 2px", "calc(var(--radius-press) + 2px)"]) assert.doesNotMatch(no, RADIUS);
  assert.match(".desk-switch::before", ROUND);
  assert.match(".kit-dot", ROUND);
  assert.match(":is(.kit-dot)", ROUND);
  assert.match(".color-dots button", ROUND);
  assert.doesNotMatch(".dotted-rule", ROUND);
});

test("blur reads a shadow's third length", () => {
  assert.equal(blur("0 1px 2px rgba(29, 35, 28, 0.08)"), 2);
  assert.equal(blur("-1px 0 0 rgba(var(--ink-rgb), 0.25)"), 0);
  assert.equal(blur("0 0 0 2px var(--focus-ring)"), 0);
  assert.equal(blur("inset 0 1px 0 #fff"), 0);
});
