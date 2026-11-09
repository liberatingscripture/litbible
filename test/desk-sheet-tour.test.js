// test/desk-sheet-tour.test.js
//
// The Sheets tour (STUDY-DESK-FIXES.md E63) writes nothing but its seen list.
// Its steps run in the browser, so these read the code: the tour reaches
// storage only through first-use.js's save functions and never touches the
// notebook's store; the editor's example mode keeps a change in memory and
// never writes the new sheet; /desk answers `?sheet-tour` and the list's link;
// and the rules a chapter page loads (desk-first-use.mjs) stay free of the
// sheet modules, so the Sheets tour's steps add nothing to that page.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
// Comments name what the code must not do, so they are left out of the checks.
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("the Sheets tour stores only its seen list, through first-use.js, and writes no record", () => {
  const tour = code("src/scripts/desk/sheets/sheet-tour.js");
  assert.doesNotMatch(tour, /localStorage\./);
  assert.doesNotMatch(tour, /sessionStorage\./);
  assert.doesNotMatch(tour, /\bstore\.(save|change|remove|commit|writeNow)\b/);
  assert.match(tour, /import \{[^}]*\bsaveSheetTourList\b[^}]*\} from "\.\.\/first-use\.js"/);
  // The sheet it shows is the editor's example: made in memory, ended at the finish.
  assert.match(tour, /\.setExample\(true\)/);
  assert.match(tour, /\.endExample\(\)/);
});

test("the sheet editor's example mode changes nothing in the store", () => {
  const editor = code("src/scripts/desk/sheets/sheet-editor.js");
  // A change in example mode is made in memory, before anything is written.
  assert.match(editor, /if \(destroyed \|\| !sheet\) return Promise\.resolve\(false\);\s*if \(example\) return Promise\.resolve\(changeInMemory\(/);
  // And a new sheet is never written while it is on: not by a change, Print,
  // Present, Open on its own page, or an add from another pane.
  assert.match(editor, /function persistDraft\(\) \{\s*if \(!draft \|\| example\) return;/);
  const inMemory = editor.slice(editor.indexOf("function changeInMemory"), editor.indexOf("function failed"));
  assert.ok(inMemory.length > 0);
  assert.doesNotMatch(inMemory, /\bstore\./);
});

test("/desk starts the Sheets tour from its address and from a Sheets pane's link", () => {
  const page = code("src/scripts/desk/desk-page.js");
  assert.match(page, /"sheet-tour"/);
  assert.match(page, /addEventListener\("desk:sheet-tour"/);
  assert.match(code("src/scripts/desk/sheets/sheet-pane.js"), /new CustomEvent\("desk:sheet-tour"/);
});

test("the tours' rules import no sheet module, so a chapter page loads none", () => {
  const rules = code("src/lib/desk-first-use.mjs");
  for (const m of rules.matchAll(/^import [^;]*? from "([^"]+)"/gm)) {
    assert.doesNotMatch(m[1], /sheet/, m[1]);
  }
});
