// Audit 8, batch C: the Search pane, the Greek find, the commands window,
// /notebook, the LIT pane, the title menu, the tour runner and the shared
// search code. Most of these files are DOM code with no DOM in node, so a
// test reads the source for the line that holds a fix, as
// desk-notebook-panel.test.js does; the pure parts are run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { notebookSearchHref } from "../src/lib/desk-search.mjs";
import { createTourRunner } from "../src/scripts/desk/tour-runner.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const PANE = read("src/scripts/desk/search-pane.js");
const NOTEBOOK = read("src/scripts/desk/notebook-page.js");

test("GF8a-1: the Search pane never names ARTICLE_EXAMPLE without its module", () => {
  const bare = PANE.split("\n").filter((line) => /(^|[^.\w])ARTICLE_EXAMPLE\b/.test(line));
  assert.deepEqual(bare, [], "every use is gk.ARTICLE_EXAMPLE, since `gk` is the loaded Greek search");
});

test("GF8a-3: the three search surfaces tell a failed verse index from no results", () => {
  const core = read("src/scripts/search-core.js");
  assert.match(core, /export const VERSES_FAILED = /);
  for (const file of ["src/scripts/desk/search-pane.js", "src/scripts/searchbar.js", "src/scripts/search.js"]) {
    const text = read(file);
    assert.match(text, /\bVERSES_FAILED\b/, `${file} says it`);
    assert.match(text, /versesFailed/, `${file} notices it`);
  }
});

test("GF8a-4: a query too short to search clears what the last one left", () => {
  const tooShort = PANE.slice(PANE.indexOf("function tooShort()"), PANE.indexOf("input.addEventListener(\"input\""));
  assert.match(tooShort, /clearSearch\(\)/);
  const clear = PANE.slice(PANE.indexOf("function clearSearch()"), PANE.indexOf("function empty()"));
  for (const part of ["offerSeq++", "offerBox.hidden = true", "pageLine.hidden = true", "syncNotes(false)", 'tell("")']) {
    assert.ok(clear.includes(part), `clearSearch does ${part}`);
  }
});

test("GF8a-5 and GF8a-6: an open entry keeps its bar and has its own note line", () => {
  const entry = PANE.slice(PANE.indexOf("async function openEntry"), PANE.indexOf("// ---- the Greek ----"));
  assert.ok(!/entryBox\.replaceChildren\(bar, (fail|clone|make)/.test(entry), "the bar is not replaced once focus is on it");
  assert.match(entry, /below\(clone\)/);
  assert.match(PANE, /el\.append\(live, top, results, entryBox\)/, "the live region is outside the hidden top");
  assert.match(PANE, /entryBox\.hidden \|\| !entryNote \? note : entryNote/);
});

test("SEC8-2: the glossary entry is made inert before it is imported", () => {
  assert.match(PANE, /makeInert\(document\.importNode\(source, true\)\)/);
  assert.match(PANE, /from "\.\.\/\.\.\/lib\/desk-inert\.mjs"/);
});

test("SH8-3: both gathers add through the editor's placement and canonical-form rule", () => {
  for (const file of ["src/scripts/desk/search-pane.js", "src/scripts/desk/sheets/search-sheet.js"]) {
    const text = read(file);
    // planAddPassages (desk-sheet-add.mjs, tested there) plans over the canonical
    // form and places each passage by passageInsertIndex.
    assert.match(text, /planAddPassages\(/, `${file} adds through planAddPassages`);
    assert.ok(!/addModule\([^)]*undefined/.test(text), `${file} no longer appends after the last part`);
  }
});

test("GF8a-11: a pane closed during a gather still reports it, and a throwing ready() is caught", () => {
  const gather = PANE.slice(PANE.indexOf("async function gather"), PANE.indexOf("// ---- links in the results ----"));
  assert.ok(gather.indexOf("try {") < gather.indexOf("target.ready?.()"), "ready() runs inside the try");
  assert.ok(!/busy = false;\s*if \(destroyed\) return;/.test(gather), "the early return is gone");
});

test("GF8a-12: a commands window that finished loading after the pane closed does not open", () => {
  const open = PANE.slice(PANE.indexOf("function openCommands("), PANE.indexOf("async function runGreek"));
  assert.match(open, /if \(destroyed\) return;/);
});

test("GF8a-9: the suggestions in the Greek search give focus back to the field", () => {
  assert.match(PANE, /input\.focus\(\{ preventScroll: true \}\); \/\/ the button is about to be redrawn away/);
  const find = read("src/scripts/desk/greek-find.js");
  assert.match(find, /if \(!\(await selectWord\(hit\.verse, hit\.t, \{ focus: true \}\)\)\) focusText\(\)/);
});

test("GF8a-2: a refused write on /notebook is caught and told", () => {
  const write = NOTEBOOK.slice(NOTEBOOK.indexOf("async function writeOver"), NOTEBOOK.indexOf("async function deleteEverything"));
  assert.match(write, /catch \(err\)/);
  assert.match(write, /reason: "failed"/);
  assert.match(NOTEBOOK, /failed: WRITE_FAILED/);
  assert.match(NOTEBOOK, /await spec\.run\(\)\) === false/, "the confirm button is given back");
});

test("DK8-1 and GF8a-10: the rename form lets go of focus before redrawing, and Escape waits out a composition", () => {
  assert.match(NOTEBOOK, /if \(document\.activeElement === input\) input\.blur\(\);\s*await render\(\);/);
  assert.match(NOTEBOOK, /e\.key === "Escape" && !e\.isComposing/);
});

test("SEC8-3: the notebook search words travel in the fragment, not the request", () => {
  assert.equal(notebookSearchHref("grace & peace"), "/notebook/#q=grace%20%26%20peace");
  assert.equal(notebookSearchHref("  "), "/notebook/");
  assert.ok(!notebookSearchHref("pistis").includes("?"), "no query string for the server to log");
  // The page reads the fragment (and still the old ?q=), and strips both.
  assert.match(NOTEBOOK, /startsWith\("#q="\)/);
  assert.match(NOTEBOOK, /url\.searchParams\.get\("q"\)/);
  assert.match(NOTEBOOK, /history\.replaceState/);
});

test("GF8a-7 and GF8a-8: the Notebook actions window draws again and returns focus", () => {
  const win = read("src/scripts/desk/commands-window.js");
  assert.match(win, /"desk:settings"/);
  assert.match(win, /attributeFilter: \["data-desk-panel"\]/);
  assert.match(win, /reason === "command" && was\?\.opener/);
  assert.match(read("src/scripts/desk/notebook-search.js"), /refresh: commandList/);
});

test("GK8-2: Enter, Tab and ArrowRight in the tray and /search ignore a composition", () => {
  for (const file of ["src/scripts/searchbar.js", "src/scripts/search.js"]) {
    assert.match(read(file), /e\.isComposing \|\| e\.keyCode === 229/, file);
  }
});

test("DK8-4: the title menu's two new-tab links hand focus back to the title button", () => {
  const menu = read("src/scripts/desk/title-menu.js");
  assert.match(menu, /for \(const link of links\) link\.addEventListener\("click", \(\) => closeTitleMenu\(\)\)/);
});

test("DK8-5: a late chapter load only clears the flag of its own generation", () => {
  const lit = read("src/scripts/desk/lit-pane.js");
  assert.match(lit, /if \(n === seq\) loadingDown = false;/);
  assert.match(lit, /if \(n === seq\) loadingUp = false;/);
});

test("DK8-3: the Study Desk tour drops the sync step where its second LIT pane can't fit", () => {
  const tour = read("src/scripts/desk/desk-tour.js");
  assert.match(tour, /addPaneNeeds\(base, "column", width, height\)\) ids\.delete\("sync"\)/);
});

test("GF8b-5: a later() registered after the tour ended runs at once", () => {
  const runner = createTourRunner();
  let ran = 0;
  runner.later(() => ran++);
  assert.equal(ran, 1, "no run is going, so nothing else would ever undo it");
  runner.later(() => {
    throw new Error("a closer that throws");
  });
  assert.equal(runner.running(), false);
});

test("DK8-9: step tokens count across runs", () => {
  const runner = read("src/scripts/desk/tour-runner.js");
  assert.match(runner, /let tokens = 0;/);
  assert.match(runner, /const token = \(run\.token = \+\+tokens\);/);
  assert.ok(!/run\.token\+\+/.test(runner) && !/\+\+run\.token/.test(runner));
  assert.match(runner, /act\(step, \{ live \}\)/);
});

test("DK8-6 and DK8-8: the help page names the Read page and says every Print choice opens a tab", () => {
  const help = read("src/pages/desk/help.astro");
  assert.ok(!/“Go to passage” in Read View/.test(help));
  assert.match(help, /Each choice opens the\s+chapter in a new tab and prints there/);
  assert.ok(!help.includes("A chapter other than"));
});
