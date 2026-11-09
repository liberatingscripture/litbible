// Audit 8, batch G: the Greek tab's apparatus marks and keyboard selection,
// and the Greek search builder's composition flag. These are DOM files with no
// DOM in node, so each test reads the source for the line that holds the fix,
// as desk-audit8-c-search-and-pages.test.js does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const TAB = read("src/scripts/desk/tab-greek.js");
const BUILDER = read("src/scripts/greek-builder.js");

test("GK8-3: an apparatus note is built with appendLang, not marked grc as a whole", () => {
  assert.doesNotMatch(TAB, /n\.lang\s*=\s*"grc"/, "no whole-note lang mark");
  const start = TAB.indexOf("for (const note of notes)");
  assert.ok(start > 0, "the apparatus loop is there");
  const loop = TAB.slice(start, start + 400);
  assert.match(loop, /appendLang\(n, note\.replace\(lead, ""\)\)/, "the note's text goes through appendLang");
});

test("GK8-4: the word keys stand down on Shift, as they do on Ctrl, Meta and Alt", () => {
  const guard = TAB.match(/if \(!word \|\| e\.ctrlKey[^\n]*\) return;/);
  assert.ok(guard, "the keydown guard is there");
  assert.match(guard[0], /e\.shiftKey/, "Shift is in the guard");
  assert.match(guard[0], /e\.ctrlKey/);
  assert.match(guard[0], /e\.metaKey/);
  assert.match(guard[0], /e\.altKey/);
});

test("GK8-6: the builder's composing flag is cleared by an input outside a composition and by blur", () => {
  const input = BUILDER.match(/input\.addEventListener\("input"[\s\S]*?\}\);/);
  assert.ok(input, "the input listener is there");
  assert.match(input[0], /if \(e\.isComposing\) return;\s*composing = false;\s*typed\(\);/);
  assert.match(
    BUILDER,
    /input\.addEventListener\("blur", \(\) => \{\s*composing = false;\s*\}\);/,
    "blur clears the flag",
  );
});
