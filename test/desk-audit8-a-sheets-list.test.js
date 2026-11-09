// test/desk-audit8-a-sheets-list.test.js
//
// Audit 8's fixes to the lists of sheets (/sheets/ and a Sheets pane's, whose
// rows are my-sheets.js's). They run in the browser, so these read the code,
// as test/desk-sheet-page-list.test.js does:
// - SH8-1 (LV8-1): /sheets/' list was emptied and rebuilt on every sheet save
//   anywhere, closing "New sheet…" and dropping focus. Now only its rows are
//   built again, off the page, and put in only when what they show moved.
// - XA8-4: "Save as template"'s accessible name holds its visible words.
// - XA8-15: a row button that can't be used says why to a keyboard and a
//   screen reader, not only in a title.
// - SH8-5: a failed Delete says so, and a second press can't send another.
// - XA8-8: importing a shared sheet is announced.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Comments name what the code must not do, so they are left out of the checks.
const code = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
const between = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));

test("a change elsewhere redraws /sheets/' rows in place, only when they moved (SH8-1)", () => {
  const page = code("src/scripts/desk/sheets/sheet-page.js");
  const list = between(page, "async function showList(", "async function readList(");
  // The page is emptied once, for the view, never by a change.
  assert.equal(list.match(/replaceChildren/g)?.length, 1);
  const update = between(list, "async function update(", "const stop = store.subscribe(");
  assert.doesNotMatch(update, /replaceChildren|showList\(|\+\+viewSeq/);
  // Built off the page and compared with what is shown before anything moves.
  assert.ok(update.indexOf("rowsHtml(next)") < update.indexOf("shown[0].before(...next)"));
  assert.match(update, /if \(html === drawn\)/);
  // The subscription asks for that update, and a row's action does too.
  assert.match(between(list, "const stop = store.subscribe(", "if (focusKey)"), /update\(\);/);
  assert.match(list, /listRows\(root, store, first, \(key\) => update\(key\)\)/);
  // Focus on a row is kept by the control's own key, or lands on the heading, never the page.
  assert.match(update, /at\.closest\("\[data-focus-key\]"\)/);
  assert.match(list, /\|\| root\.querySelector\("\.sheets-page__title"\)/);
});

test("each row's buttons have keys of their own, and nothing in a row changes between two drawings (SH8-1)", () => {
  const rows = code("src/scripts/desk/sheets/my-sheets.js");
  for (const key of ["duplicate-", "template-", "delete-"]) assert.ok(rows.includes(`focusKey = \`${key}\${`), key);
  // An id from a counter would differ each time, and every save would redraw the list.
  assert.doesNotMatch(between(rows, "export function sheetRow(", "export function ownTemplatesList("), /\+\+\w*[Cc]ount/);
});

test("Save as template's accessible name starts with its visible words (XA8-4)", () => {
  const rows = code("src/scripts/desk/sheets/my-sheets.js");
  assert.match(rows, /keep\.setAttribute\("aria-label", `Save as template, \$\{sheetName\(s\)\}`\)/);
});

test("a row button that can't be used stays reachable and says why (XA8-15)", () => {
  const rows = code("src/scripts/desk/sheets/my-sheets.js");
  const row = between(rows, "export function sheetRow(", "export function ownTemplatesList(");
  assert.doesNotMatch(row, /\.disabled = true/);
  const why = between(rows, "function unavailable(", "export function ownTemplatesList(");
  assert.match(why, /busy\(b\)/);
  assert.match(why, /aria-describedby/);
  assert.match(why, /"sr-only"/);
  // Its press does nothing.
  assert.match(row, /if \(!isBusy\(dup\)\) duplicate\(/);
  assert.match(row, /if \(!isBusy\(keep\)\) saveAsTemplate\(/);
});

test("Delete says when it fails, and a second press waits for the first (SH8-5)", () => {
  const rows = code("src/scripts/desk/sheets/my-sheets.js");
  const remove = between(rows, "async function removeRow(", "async function saveAsTemplate(");
  assert.match(remove, /if \(isBusy\(del\)\) return;/);
  assert.match(remove, /try \{\s*trash = await host\.store\.remove\(record\.id\);\s*\} catch/);
  assert.match(remove, /listProblem\(host, `The \$\{isOwnTemplate\(record\) \? "template" : "sheet"\} couldn’t be deleted/);
});

test("importing a shared sheet is announced through a region always in the page (XA8-8)", () => {
  const page = code("src/scripts/desk/sheets/sheet-page.js");
  assert.match(page, /import \{ announce \} from "\.\.\/undo-bar\.js";/);
  const take = between(page, "function sharedBanner(", "function openShareDialog(");
  assert.match(take, /announce\("Copied into your notebook\./);
});
