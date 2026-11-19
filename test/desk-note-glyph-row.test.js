// test/desk-note-glyph-row.test.js
//
// E155: a margin note's glyph stays in the note's first row. The glyph's button
// (`.desk-note__hit`) is a grid item in `.desk-note__toggle`, which stretches to
// the whole note, and a button centers what it holds, so on a tall note the
// glyph sat beside its middle (and past the fade on a cut-off one). It is CSS
// alone, and happy-dom lays nothing out, so what is held here is the rule, and
// the one fact it depends on: the click area comes from the button's ::after,
// positioned against the toggle, never from the button's own height.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles/desk.css", import.meta.url), "utf8");

// The declaration block of the first rule whose selector is exactly `selector`:
// one that follows a closing brace or a comment's closing slash, so a grouped
// rule that merely ends with the selector does not count.
function ruleBody(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\>]/g, "\\$&");
  const m = css.match(new RegExp(`(?:^|[}/])\\s*${escaped}\\s*\\{([^{}]*)\\}`));
  assert.ok(m, `desk.css has a rule for ${selector}`);
  return m[1];
}

test("the glyph's button starts at the note's first row instead of stretching", () => {
  assert.match(ruleBody(".desk-note__toggle > .desk-note__hit"), /align-self:\s*start/);
});

test("the note is still clicked anywhere: the button's ::after covers the toggle", () => {
  // The button itself is not positioned, so its ::after is placed against the
  // toggle (`.desk-stretch`, position: relative), whatever height the button has.
  assert.match(ruleBody(".desk-stretch"), /position:\s*relative/);
  assert.match(
    css,
    /\.desk-stretch > :is\(\.desk-note__hit[^)]*\)::after\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0/,
  );
  assert.doesNotMatch(ruleBody(".desk-note__toggle > .desk-note__hit"), /position\s*:/);
});

test("the glyph keeps its small drop so it sits level with the first line", () => {
  assert.match(ruleBody(".desk-note__glyph"), /margin-top:\s*0\.22em/);
});
