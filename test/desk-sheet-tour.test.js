// test/desk-sheet-tour.test.js
//
// The Sheets tour (STUDY-DESK-FIXES.md E63) writes nothing but its seen list.
// Its steps run in the browser, so these read the code: the tour reaches
// storage only through first-use.js's save functions and never touches the
// notebook's store; the editor's example mode keeps a change in memory and
// never writes the new sheet; /desk answers `?sheet-tour` and the list's link;
// and the rules a chapter page loads (desk-first-use.mjs) stay free of the
// sheet modules, so the Sheets tour's steps add nothing to that page.
//
// It runs on the Sheets page too (BVJ, 2026-11-09): one tour (sheet-tour.js)
// and two hosts, the desk's (sheet-tour-desk.js) and the page's (in
// sheet-page.js). The tour imports nothing that is the desk's alone, and the
// page reaches it only by `import()`, so a page opened to print or present
// loads none of it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
// Comments name what the code must not do, so they are left out of the checks.
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("the Sheets tour stores only its seen list, through first-use.js, and writes no record", () => {
  const tour = code("src/scripts/desk/sheets/sheet-tour.js");
  const desk = code("src/scripts/desk/sheets/sheet-tour-desk.js");
  for (const file of [tour, desk]) {
    assert.doesNotMatch(file, /localStorage\./);
    assert.doesNotMatch(file, /sessionStorage\./);
    assert.doesNotMatch(file, /\bstore\.(save|change|remove|commit|writeNow)\b/);
  }
  assert.match(tour, /import \{[^}]*\bsaveSheetTourList\b[^}]*\} from "\.\.\/first-use\.js"/);
  // The sheet it shows is the editor's example: made in memory, and on /desk
  // ended at the finish (the Sheets page takes its editor down instead).
  assert.match(tour, /\.setExample\(true\)/);
  assert.match(desk, /\.endExample\(\)/);
});

test("the tour imports nothing that is the desk's alone; its desk host does", () => {
  const imports = (path) => [...code(path).matchAll(/^\s*import\s[^;]*?\sfrom\s+"([^"]+)"/gm)].map((m) => m[1]);
  const tour = imports("src/scripts/desk/sheets/sheet-tour.js");
  for (const desk of ["lit-panel.js", "sheet-pane.js", "desk-layout.mjs"]) {
    assert.ok(!tour.some((from) => from.endsWith(`/${desk}`)), desk);
    assert.ok(imports("src/scripts/desk/sheets/sheet-tour-desk.js").some((from) => from.endsWith(`/${desk}`)), desk);
  }
  // /desk builds the tour through its host.
  assert.match(code("src/scripts/desk/desk-page.js"), /import \{ createDeskSheetTour \} from "\.\/sheets\/sheet-tour-desk\.js"/);
});

const STATIC_IMPORT = /^\s*(?:import|export)\s[^;]*?\sfrom\s+["'](\.[^"']+)["']|^\s*import\s+["'](\.[^"']+)["']/gm;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("the Sheets page reaches the tour only by import(), so printing or presenting loads none of it", () => {
  const seen = new Set();
  const walk = (file) => {
    const rel = relative(ROOT, file).replaceAll("\\", "/");
    if (seen.has(rel)) return;
    seen.add(rel);
    for (const m of readFileSync(file, "utf8").matchAll(STATIC_IMPORT)) {
      const to = join(dirname(file), m[1] ?? m[2]);
      if (existsSync(to)) walk(to);
    }
  };
  walk(join(ROOT, "src/scripts/desk/sheets/sheet-page.js"));
  for (const file of [
    "src/scripts/desk/sheets/sheet-tour.js",
    "src/scripts/desk/sheets/sheet-tour-desk.js",
    "src/scripts/desk/tour-runner.js",
    "src/scripts/desk/first-use.js",
    // The offer's rules bring desk-layout.mjs with them, so they come by
    // import() as well, and Continue reading's reader with them.
    "src/lib/desk-first-use.mjs",
    "src/lib/desk-layout.mjs",
    "src/scripts/last-read.js",
  ]) {
    assert.ok(!seen.has(file), `${file} is not in the sheet page's chunk`);
  }
  const page = code("src/scripts/desk/sheets/sheet-page.js");
  assert.ok(page.includes('import("./sheet-tour.js")'));
  assert.ok(page.includes('import("../../../lib/desk-first-use.mjs")'));
  assert.ok(page.includes('import("../../last-read.js")'));
});

test("the Sheets page starts the tour from its address, and draws the tour's sheet without its links", () => {
  const page = code("src/scripts/desk/sheets/sheet-page.js");
  assert.match(page, /"sheet-tour"/);
  // `drawSheet` takes `demo`: no shared banner, no links row ("‹ My sheets",
  // "Edit in Study Desk"), and Edit back to the tour's editor.
  assert.match(page, /async function drawSheet\(root, \{[^}]*\bdemo = null \}\)/);
  assert.match(page, /shared && !demo \? \[sharedBanner\(/);
  assert.match(page, /\.\.\.\(demo \? \[\] : \[back\]\)/);
  assert.match(page, /\.\.\.\(demo \|\| shared \? \[\] : \[edit\]\)/);
  assert.match(page, /if \(demo\) \{\s*demo\.onEdit\(\);\s*return;\s*\}/);
  // The tour's host never writes the address or history.
  const host = page.slice(page.indexOf("function tourHost("), page.indexOf("export async function showSharedOnPhone"));
  assert.ok(host.length > 0);
  assert.doesNotMatch(host, /history\.(pushState|replaceState)/);
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
