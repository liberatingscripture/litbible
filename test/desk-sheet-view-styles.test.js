// Audit 8, LG8-10: a phone showing a shared sheet brings only the sheets' own
// look, desk-sheet-view.css (a sheet's formatted text and its buttons), not
// all of desk.css (about 200 KB) that it used to add through boot.js. Checked
// by what the viewer's module downloads, its static imports (a `?inline`
// stylesheet counted as its file), as desk-search-styles.test.js checks the
// search's.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const STATIC_IMPORT = /^\s*(?:import|export)\s[^;]*?\sfrom\s+["'](\.[^"']+)["']|^\s*import\s+["'](\.[^"']+)["']/gm;

function staticClosure(entry) {
  const seen = new Set();
  const walk = (file) => {
    const rel = relative(root, file).replaceAll("\\", "/");
    if (seen.has(rel)) return;
    seen.add(rel);
    if (!/\.m?js$/.test(file)) return;
    for (const m of readFileSync(file, "utf8").matchAll(STATIC_IMPORT)) {
      const to = join(dirname(file), (m[1] ?? m[2]).replace(/\?.*$/, ""));
      if (existsSync(to)) walk(to);
    }
  };
  walk(join(root, entry));
  return seen;
}

test("LG8-10: the phone's sheet viewer carries desk-sheet-view.css and none of the desk's other sheets", () => {
  const closure = staticClosure("src/scripts/desk/sheets/sheet-page.js");
  for (const heavy of ["src/styles/desk.css", "src/styles/desk-search.css", "src/styles/desk-tab.css", "src/scripts/desk/boot.js"]) {
    assert.ok(!closure.has(heavy), `the viewer reaches ${heavy}`);
  }
  assert.ok(closure.has("src/styles/desk-sheet-view.css"));
  const page = read("src/scripts/desk/sheets/sheet-page.js");
  assert.match(page, /export async function showSharedOnPhone\(root, fragment\) \{\s*addSheetViewStyle\(\);/);
  // A computer's sheet page still gets all of the desk's styles, first.
  assert.match(page, /\(await import\("\.\.\/boot\.js"\)\)\.addDeskStyle\(\);/);
});

test("LG8-10: every desk page adds desk-sheet-view.css ahead of desk.css", () => {
  const closure = staticClosure("src/scripts/desk/boot.js");
  assert.ok(closure.has("src/styles/desk-sheet-view.css"));
  assert.match(read("src/scripts/desk/boot.js"), /addSearchStyle\(\);\s*addSheetViewStyle\(\);\s*if \(document\.querySelector\("style\[data-desk\]"\)\) return;/);
});

test("LG8-10: a sheet's text, its buttons and the highlight tints are styled in desk-sheet-view.css alone", () => {
  const view = read("src/styles/desk-sheet-view.css");
  const desk = read("src/styles/desk.css");
  for (const [what, re] of [
    [".desk-rich {", /^\.desk-rich \{/m],
    ["a named color", /\[data-color="red"\] \{/],
    ["a background", /\[data-mark="yellow"\] \{/],
    [".desk-sheet__btn {", /^\.desk-sheet__btn \{/m],
    ["--desk-rich-red", /--desk-rich-red:/],
    ["--desk-hl-yellow", /--desk-hl-yellow:/],
  ]) {
    assert.match(view, re, `${what} is in desk-sheet-view.css`);
    assert.doesNotMatch(desk, re, `${what} is in desk.css too`);
  }
});
