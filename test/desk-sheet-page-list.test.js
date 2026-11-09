// test/desk-sheet-page-list.test.js
//
// /sheets/'s list has a Sheets pane's row actions (STUDY-DESK-FIXES.md E64;
// BVJ, 2026-11-09): Duplicate, Save as template and Delete on each sheet, and
// the reader's own templates under "My templates". The rows are my-sheets.js's,
// the pane's own, so the two lists can't drift apart. They run in the browser,
// so these read the code: the page reaches the rows only by import(), since
// they bring the history, which a page opened to print or present has no use
// for; my-sheets.js imports nothing of the editor's, so drawing the list
// never loads the editor either.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(ROOT, path), "utf8");
// Comments name what the code must not do, so they are left out of the checks.
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const STATIC_IMPORT = /^\s*(?:import|export)\s[^;]*?\sfrom\s+["'](\.[^"']+)["']|^\s*import\s+["'](\.[^"']+)["']/gm;

/** Every file a module reaches by static imports, as repo paths. */
function staticClosure(entry) {
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
  walk(join(ROOT, entry));
  return seen;
}

test("the Sheets page reaches the list's rows only by import()", () => {
  const reached = staticClosure("src/scripts/desk/sheets/sheet-page.js");
  for (const file of ["src/scripts/desk/sheets/sheet-page-list.js", "src/scripts/desk/sheets/my-sheets.js", "src/scripts/desk/history.js"]) {
    assert.ok(!reached.has(file), `${file} is not in the sheet page's chunk`);
  }
  assert.ok(code("src/scripts/desk/sheets/sheet-page.js").includes('import("./sheet-page-list.js")'));
});

test("drawing the list never loads the editor: the rows' modules import nothing of it", () => {
  const reached = staticClosure("src/scripts/desk/sheets/sheet-page-list.js");
  assert.ok(reached.has("src/scripts/desk/sheets/my-sheets.js"));
  assert.ok(reached.has("src/scripts/desk/history.js"), "Delete's Undo needs the history");
  for (const file of ["src/scripts/desk/sheets/sheet-editor.js", "src/scripts/desk/sheets/sheet-page-edit.js"]) {
    assert.ok(!reached.has(file), `${file} is not reached by the list's rows`);
  }
});

test("the page's rows are the pane's: my-sheets.js's sheetRow and ownTemplatesList", () => {
  const rows = code("src/scripts/desk/sheets/my-sheets.js");
  assert.match(rows, /export function sheetRow\(/);
  assert.match(rows, /export function ownTemplatesList\(/);
  // A row's name is a link where the host gives an address, else a button.
  assert.match(rows, /host\.sheetHref\?\.\(record\)/);
  const page = code("src/scripts/desk/sheets/sheet-page-list.js");
  assert.match(page, /import \{ ownTemplatesList, sheetRow \} from "\.\/my-sheets\.js"/);
  // The history starts before a row can write, so Delete's Undo works.
  assert.ok(page.indexOf("createHistory(") < page.indexOf("sheetRow("));
});

test("the page lists the reader's templates, and opens one in the editor", () => {
  const page = code("src/scripts/desk/sheets/sheet-page.js");
  assert.match(page, /const mine = sortSheets\(all\.filter\(isOwnTemplate\)\)/);
  assert.match(page, /isOwnTemplate\(r\) \? "&view=edit" : ""/);
});
