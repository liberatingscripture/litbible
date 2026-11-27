// Two rules of the site's stylesheets that break silently (CLAUDE.md, "Rules
// that apply everywhere"; SITE-FEATHERBOA.md, "Night" and "Sizes"), held over
// every stylesheet but the /apps mirror:
// - a text column is sized with --ch, never the ch unit, which is the "0" of
//   whichever face is painting and moves the column when the webfont lands;
// - every dark rule is written twice, for the device's setting (the media
//   query, guarded so a reader who forces light keeps light) and for the
//   reader's (the Display tray's Dark), the same in both.

import { test } from "node:test";
import assert from "node:assert/strict";
import { styleSources, declarations, isMirrored } from "./helpers/featherboa-css.mjs";

const sources = styleSources().filter((s) => !isMirrored(s.rel));

test("columns are sized with --ch, never the ch unit (but as a var() fallback)", () => {
  const bad = [];
  for (const { rel, css } of sources) {
    for (const d of declarations(css)) {
      // A fallback inside var(--token, 72ch) is only read if the token is missing.
      const value = d.value.replace(/var\(--[\w-]+,\s*[\d.]+ch\)/g, "");
      if (/(^|[\s(,*+-])[\d.]+ch\b/.test(value)) bad.push(`${rel}:${d.line} ${d.prop}: ${d.value}`);
    }
  }
  assert.deepEqual(bad, []);
});

const MEDIA = "@media (prefers-color-scheme: dark)";
const FOLLOW = /^(?::global\()?:root:not\(\[data-theme="light"\]\)\)?\s*/;
const FORCE = /^(?::global\()?:root\[data-theme="dark"\]\)?\s*/;

/** The dark rules of one stylesheet: selector (guard removed) -> declarations,
 *  for each of the two ways in, and the rules in the media query left bare. */
function darkRules(css) {
  const follow = new Map();
  const force = new Map();
  const bare = [];
  for (const d of declarations(css)) {
    const ctx = d.context;
    const media = ctx.findIndex((p) => p.startsWith(MEDIA));
    const decl = `${d.prop}: ${d.value}${d.important ? " !important" : ""}`;
    if (media >= 0) {
      // The rule's own selector list, each selector guarded.
      const sel = ctx[ctx.length - 1];
      if (sel.startsWith("@") || ctx.slice(media + 1).some((p) => p.startsWith("@media"))) continue;
      const parts = sel.split(/,\s*/);
      if (!parts.every((p) => FOLLOW.test(p))) {
        bare.push(sel);
        continue;
      }
      for (const p of parts) push(follow, p.replace(FOLLOW, ""), decl, ctx.slice(0, media));
    } else {
      const sel = ctx[ctx.length - 1];
      const parts = sel.split(/,\s*/);
      if (!parts.some((p) => FORCE.test(p))) continue;
      for (const p of parts) if (FORCE.test(p)) push(force, p.replace(FORCE, ""), decl, ctx.slice(0, -1));
    }
  }
  return { follow, force, bare };
}
function push(map, sel, decl, outer) {
  const key = [...outer, sel].join(" | ");
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(decl);
}

test("every dark rule is written for both the device's setting and the reader's, the same in both", () => {
  const problems = [];
  for (const { rel, css } of sources) {
    if (!css.includes("prefers-color-scheme: dark") && !css.includes('data-theme="dark"')) continue;
    const { follow, force, bare } = darkRules(css);
    for (const sel of bare) problems.push(`${rel}: "${sel}" in the dark media query without :root:not([data-theme="light"])`);
    for (const [sel, decls] of follow) {
      if (!force.has(sel)) problems.push(`${rel}: "${sel}" has no :root[data-theme="dark"] twin`);
      else if (force.get(sel).join("; ") !== decls.join("; ")) problems.push(`${rel}: "${sel}" differs between the two dark selectors`);
    }
    for (const sel of force.keys()) if (!follow.has(sel)) problems.push(`${rel}: "${sel}" has no media-query twin`);
  }
  assert.deepEqual(problems, []);
});
