// Audit 8, batch C: what is still checked by reading source. The behavior of
// the Search pane, the commands window, /notebook, the tour runner, the LIT
// pane and the title menu is driven in a browser DOM by
// desk-audit8-dom-search-*.test.js. What stays here could not be driven in a
// happy-dom page: a layout the page measures, a real IME, a whole page script,
// or the sheet pane that supplies an "add to" target.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { notebookSearchHref } from "../src/lib/desk-search.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");


test("GF8a-3: searchbar.js and /search tell a failed verse index from no results", () => {
  // The Search pane's is driven (desk-audit8-dom-search-pane.test.js); these two
  // are whole page scripts that run on load, so they are read.
  const core = read("src/scripts/search-core.js");
  assert.match(core, /export const VERSES_FAILED = /);
  for (const file of ["src/scripts/searchbar.js", "src/scripts/search.js"]) {
    const text = read(file);
    assert.match(text, /\bVERSES_FAILED\b/, `${file} says it`);
    assert.match(text, /versesFailed/, `${file} notices it`);
  }
  // And each offers Try again after it, as their Greek failures do (2026-11-10):
  // loadVerseIndex forgets a failure, so the same search asks again.
  assert.match(read("src/scripts/searchbar.js"), /if \(showK && versesFailed\) appendRetry\(\);/);
  const page = read("src/scripts/search.js");
  assert.match(page, /if \(c\.versesFailed\) appendRetry\(\);/, "with a count");
  assert.match(page, /if \(!parsedJump && lastSearchCache\.versesFailed\) appendRetry\(\);/, "with nothing found");
  assert.match(core, /promise = null|verseIndexPromise = null/, "the loader forgets a failure");
});

test("SH8-3: /search's gather adds through the editor's placement and canonical-form rule", () => {
  // The Search pane's add is driven (desk-audit8-dom-search-pane.test.js);
  // /search's search-sheet.js is a page script that runs on load.
  for (const file of ["src/scripts/desk/sheets/search-sheet.js"]) {
    const text = read(file);
    // planAddPassages (desk-sheet-add.mjs, tested there) plans over the canonical
    // form and places each passage by passageInsertIndex.
    assert.match(text, /planAddPassages\(/, `${file} adds through planAddPassages`);
    assert.ok(!/addModule\([^)]*undefined/.test(text), `${file} no longer appends after the last part`);
  }
});

test("GF8a-9: choosing a Greek word from the find's suggestions gives focus back to the text", () => {
  // The Greek pane's find needs the pane's layout and a selection; the Search
  // pane's two suggestions are driven.
  const find = read("src/scripts/desk/greek-find.js");
  assert.match(find, /if \(!\(await selectWord\(hit\.verse, hit\.t, \{ focus: true \}\)\)\) focusText\(\)/);
});

test("SEC8-3: the notebook search words travel in the fragment, not the request", () => {
  assert.equal(notebookSearchHref("grace & peace"), "/notebook/#q=grace%20%26%20peace");
  assert.equal(notebookSearchHref("  "), "/notebook/");
  assert.ok(!notebookSearchHref("pistis").includes("?"), "no query string for the server to log");
  // The page reading the fragment is driven (desk-audit8-dom-search-notebook.test.js).
});

test("GK8-2: Enter, Tab and ArrowRight in the tray and /search ignore a composition", () => {
  // A real IME composition can't be made in happy-dom, and both files run on load.
  for (const file of ["src/scripts/searchbar.js", "src/scripts/search.js"]) {
    assert.match(read(file), /e\.isComposing \|\| e\.keyCode === 229/, file);
  }
});

test("DK8-3: the Study Desk tour drops the sync step where its second LIT pane can't fit", () => {
  // Needs the page's measured width and height, which a happy-dom page lacks.
  const tour = read("src/scripts/desk/desk-tour.js");
  assert.match(tour, /addPaneNeeds\(base, "column", width, height\)\) ids\.delete\("sync"\)/);
});

test("DK8-6 and DK8-8: the help page names the Read page and says every Print choice opens a tab", () => {
  const help = read("src/pages/desk/help.astro");
  assert.ok(!/“Go to passage” in Read View/.test(help));
  assert.match(help, /Each choice opens the\s+chapter in a new tab and prints\s+there/);
  assert.ok(!help.includes("A chapter other than"));
});
