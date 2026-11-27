// One spacing scale (SITE-FEATHERBOA.md, "Sizes"; SZ-12): every gap, padding,
// and margin is 4, 8, 12, 16, 24, 32, 48, 64, or 96 pixels, written as the
// scale's tokens (--space-1 to --space-9 in tokens.css). The rule holds for
// Featherboa's new stylesheets, which join NEW as each phase writes one; an
// old stylesheet comes under it when its surface is redrawn.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { declarations, repo } from "./helpers/featherboa-css.mjs";

/** Featherboa's new stylesheets, each held to the scale whole. */
const NEW = ["src/styles/kit.css"];

const SPACING = /^(margin|padding)(-(top|right|bottom|left|block|inline)(-(start|end))?)?$|^(gap|row-gap|column-gap)$/;
const STEP = /^(0|auto|var\(--space-[1-9]\))$/;

/** Why a spacing value is off the scale, or null. */
export function offScale(prop, value) {
  if (!SPACING.test(prop)) return null;
  const parts = value.trim().split(/\s+/);
  if (parts.length > 4) return "more than four values";
  const bad = parts.filter((p) => !STEP.test(p) || (p === "auto" && !prop.startsWith("margin")));
  return bad.length ? `${bad.join(" ")} is not on the scale` : null;
}

test("the scale is the nine steps, 4 to 96", () => {
  const tokens = readFileSync(join(repo, "src/styles/tokens.css"), "utf8");
  const steps = [...tokens.matchAll(/--space-([1-9]):\s*(\d+)px;/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.deepEqual(steps, [[1, 4], [2, 8], [3, 12], [4, 16], [5, 24], [6, 32], [7, 48], [8, 64], [9, 96]]);
});

test("every gap, padding, and margin in the new stylesheets is a step on the scale (SZ-12)", () => {
  const bad = [];
  for (const rel of NEW) {
    for (const d of declarations(readFileSync(join(repo, rel), "utf8"))) {
      const why = offScale(d.prop, d.value);
      if (why) bad.push(`${rel}:${d.line} ${d.prop}: ${d.value} (${why})`);
    }
  }
  assert.deepEqual(bad, [], `${bad.length} off the scale:\n${bad.join("\n")}`);
});

test("the scale reader takes steps and refuses the rest", () => {
  assert.equal(offScale("padding", "0 var(--space-3)"), null);
  assert.equal(offScale("margin-inline", "auto"), null);
  assert.equal(offScale("color", "6px"), null);
  assert.match(offScale("padding", "6px"), /not on the scale/);
  assert.match(offScale("gap", "auto"), /not on the scale/);
  assert.match(offScale("margin", "calc(var(--space-2) + 1px)"), /not on the scale/);
});
