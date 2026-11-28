// Featherboa's labels (SITE-FEATHERBOA.md, "Controls," "Labels"; CT-04,
// CT-05, CT-06, CT-09, CT-16): no "My" a reader sees, no article after a
// label's verb ("Add note," not "Add a note"), "Study," never "Study Desk,"
// and no Chapter View, Read View, or "Scripture page" (E130's name) once the
// Read page takes their place (ST-10).
// Held over the words the code draws, comments left out
// (test/helpers/featherboa-labels.mjs). The files that keep today's words
// until their surface's phase renames them are in LATER, by that phase
// (SITE-FEATHERBOA-BUILD.md, Phase 2: "done here for the shared pieces and
// with each surface's own phase for the rest"); each phase deletes its
// entries, and a file left with nothing to rename fails until it does.

import { test } from "node:test";
import assert from "node:assert/strict";
import { findLabels, withoutComments, RULES } from "./helpers/featherboa-labels.mjs";

/** The owner's own words, which no label rule reaches (root CLAUDE.md, "Key
 *  Conventions": the owner's text is reported, never changed). */
const ALLOWED = [{ file: "src/pages/about.astro", why: "BVJ's own story, in the first person" }];

/** Files whose words wait for their surface's phase, by phase. */
export const LATER = new Map([
  ["src/lib/desk-account-words.mjs", 13], // signing in and the account
  ["src/lib/desk-commands.mjs", 9], // Study's frame
  ["src/lib/desk-doc-odt.mjs", 11], // Sheets
  ["src/lib/desk-export.mjs", 10], // the Notebook
  ["src/lib/desk-first-stage.mjs", 13], // first visit, the tours, and help
  ["src/lib/desk-first-use.mjs", 13], // first visit, the tours, and help
  ["src/lib/desk-layout.mjs", 9], // Study's frame
  ["src/lib/desk-lit-marks.mjs", 10], // the Notebook
  ["src/lib/desk-notes.mjs", 10], // the Notebook
  ["src/lib/desk-print-part.mjs", 11], // Sheets
  ["src/lib/desk-search-pane.mjs", 9], // Study's search pane
  ["src/lib/desk-search.mjs", 9], // Study's search pane
  ["src/lib/desk-sheet-check.mjs", 11], // Sheets
  ["src/lib/desk-slides-odp.mjs", 11], // Sheets
  ["src/pages/404.astro", 7], // every other page
  ["src/pages/account/connect.astro", 13], // signing in and the account
  ["src/pages/collections.astro", 11], // collections
  ["src/pages/contact.astro", 7], // every other page
  ["src/pages/desk.astro", 9], // Study's frame
  ["src/pages/desk/help.astro", 13], // first visit, the tours, and help
  ["src/pages/notebook.astro", 10], // the Notebook
  ["src/pages/privacy.astro", 13], // privacy words wait for SK5
  ["src/pages/sheets.astro", 11], // Sheets
  ["src/pages/terms.astro", 13], // privacy words wait for SK5
  ["src/scripts/desk-gate.js", 9], // Study's frame
  ["src/scripts/desk/actions.js", 9], // Study's frame
  ["src/scripts/desk/backup-file.js", 10], // the Notebook
  ["src/scripts/desk/bookmark-follow.js", 10], // the Notebook
  ["src/scripts/desk/bookmark-form.js", 10], // the Notebook
  ["src/scripts/desk/change-notice.js", 9], // Study's frame
  ["src/scripts/desk/collections/add-passage.js", 11], // collections
  ["src/scripts/desk/collections/add-records.js", 11], // collections
  ["src/scripts/desk/collections/collection-add.js", 11], // collections
  ["src/scripts/desk/collections/collection-list.js", 11], // collections
  ["src/scripts/desk/collections/collection-page.js", 11], // collections
  ["src/scripts/desk/collections/collection-pane.js", 11], // collections
  ["src/scripts/desk/collections/collection-sheet.js", 11], // collections
  ["src/scripts/desk/collections/collection-view.js", 11], // collections
  ["src/scripts/desk/collections/collections-popover.js", 11], // collections
  ["src/scripts/desk/collections/new-collection.js", 11], // collections
  ["src/scripts/desk/command-row.js", 9], // Study's frame
  ["src/scripts/desk/desk-page.js", 9], // Study's frame
  ["src/scripts/desk/desk-panes.js", 9], // Study's frame: "on its Scripture page" (ST-10)
  ["src/scripts/desk/desk-tour.js", 13], // first visit, the tours, and help
  ["src/scripts/desk/export-import.js", 10], // the Notebook
  ["src/scripts/desk/first-stage.js", 13], // first visit, the tours, and help
  ["src/scripts/desk/history.js", 9], // Study's frame
  ["src/scripts/desk/kept-list.js", 10], // the Notebook
  ["src/scripts/desk/labels-ui.js", 10], // the Notebook
  ["src/scripts/desk/lit-pane.js", 9], // Study's frame
  ["src/scripts/desk/note-editor.js", 10], // the Notebook
  ["src/scripts/desk/notebook-page.js", 10], // the Notebook
  ["src/scripts/desk/notebook-search.js", 10], // the Notebook
  ["src/scripts/desk/notes-margin.js", 10], // the Notebook
  ["src/scripts/desk/panel.js", 9], // Study's frame
  ["src/scripts/desk/pins.js", 9], // Study's frame
  ["src/scripts/desk/print-link.js", 9], // Study's frame
  ["src/scripts/desk/print-look.js", 9], // Study's frame
  ["src/scripts/desk/print-menu.js", 9], // Study's frame
  ["src/scripts/desk/prose-actions.js", 9], // Study's frame
  ["src/scripts/desk/read-marks.js", 10], // the Notebook
  ["src/scripts/desk/search-pane.js", 9], // Study's search pane
  ["src/scripts/desk/sheets/add-bar.js", 11], // Sheets
  ["src/scripts/desk/sheets/commercial-confirm.js", 11], // Sheets
  ["src/scripts/desk/sheets/insert-menu.js", 11], // Sheets
  ["src/scripts/desk/sheets/my-sheets.js", 11], // Sheets
  ["src/scripts/desk/sheets/search-sheet.js", 11], // Sheets
  ["src/scripts/desk/sheets/sheet-add.js", 11], // Sheets
  ["src/scripts/desk/sheets/sheet-cards.js", 11], // Sheets
  ["src/scripts/desk/sheets/sheet-editor.js", 11], // Sheets
  ["src/scripts/desk/sheets/sheet-lit.js", 11], // Sheets
  ["src/scripts/desk/sheets/sheet-page-edit.js", 11], // Sheets
  ["src/scripts/desk/sheets/sheet-page.js", 11], // Sheets
  ["src/scripts/desk/sheets/sheet-save.js", 11], // Sheets
  ["src/scripts/desk/sheets/sheet-slides.js", 11], // Sheets
  ["src/scripts/desk/shell.js", 9], // Study's frame
  ["src/scripts/desk/store.js", 9], // Study's frame
  ["src/scripts/desk/sync/account-notice.js", 13], // signing in and the account
  ["src/scripts/desk/sync/connector.js", 13], // signing in and the account
  ["src/scripts/desk/sync/status-line.js", 13], // signing in and the account
  ["src/scripts/desk/sync/stopped-notice.js", 13], // signing in and the account
  ["src/scripts/desk/tab-greek.js", 12], // the Greek
  ["src/scripts/desk/tab-mine.js", 10], // the Notebook
  ["src/scripts/desk/tab-verse.js", 9], // Study's frame
  ["src/scripts/desk/title-menu.js", 9], // Study's frame
  ["src/scripts/desk/tour-runner.js", 13], // first visit, the tours, and help
  ["src/scripts/desk/tour.js", 13], // first visit, the tours, and help
  ["src/scripts/desk/trash-list.js", 10], // the Notebook
  ["src/scripts/desk/undo-bar.js", 9], // Study's frame
  ["src/scripts/greek-builder.js", 6], // Search: the Greek builder
  ["src/scripts/search-core.js", 6], // Search
  ["src/scripts/search.js", 6], // Search
  ["src/scripts/sheet-share-gate.js", 11], // Sheets
]);

const allowed = (rel) => ALLOWED.some((a) => a.file === rel);

test("no label breaks the rules outside the files a later phase renames", () => {
  const why = Object.fromEntries(RULES.map((r) => [r.id, r.why]));
  const bad = findLabels()
    .filter((f) => !LATER.has(f.rel) && !allowed(f.rel))
    .map((f) => `${f.rel}:${f.line} “${f.text}”: ${why[f.rule]}`);
  assert.deepEqual(bad, [], `${bad.length} labels:\n${bad.join("\n")}`);
});

test("each file waiting for a later phase still has words to rename (the phase that renames them deletes its entry)", () => {
  const files = new Set(findLabels().map((f) => f.rel));
  const done = [...LATER.keys()].filter((rel) => !files.has(rel));
  assert.deepEqual(done, [], `nothing left to rename in: ${done.join(", ")}; delete their entries from LATER`);
});

test("the rules' reader leaves comments out and keeps what a reader sees", () => {
  assert.equal(withoutComments('const a = "My notes"; // in My order').trimEnd(), 'const a = "My notes";');
  assert.match(withoutComments('fetch("https://example.org/a//b")'), /a\/\/b/);
  assert.equal(withoutComments("/* My order */ x").trim(), "x");
  assert.equal(withoutComments("<!-- Study Desk --> y").trim(), "y");
  const find = (line, id) => findLabels([{ rel: "x.js", lines: [line] }]).filter((f) => f.rule === id).map((f) => f.text);
  assert.deepEqual(find('label: "My sheets"', "my"), ["My sheets"]);
  assert.deepEqual(find('label: "my sheets"', "my"), []);
  assert.deepEqual(find('button("Add a note")', "article"), ["Add a note"]);
  assert.deepEqual(find('aria-label="Remove the rule"', "article"), ["Remove the rule"]);
  assert.deepEqual(find("<a href='/'>Go to the home page</a>", "article"), ["Go to the home page"]);
  assert.deepEqual(find('hint("Choose the sheet for this.")', "article"), []);
  assert.deepEqual(find('button("Add note")', "article"), []);
  assert.deepEqual(find('"Open in Study Desk"', "study-desk"), ["Study Desk"]);
  assert.deepEqual(find('"Switch to Read View"', "views"), ["Read View"]);
  assert.deepEqual(find('"Open the Scripture page"', "scripture-page"), ["Scripture page"]);
  assert.deepEqual(find('"on Scripture pages"', "scripture-page"), ["Scripture pages"]);
});
