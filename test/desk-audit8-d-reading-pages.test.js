// test/desk-audit8-d-reading-pages.test.js
//
// Study Desk Audit 8, batch D (reading pages with the desk on: the Notebook
// panel, the margin, marks, bookmarks, change notices, the first stage, the
// shell, the tour). Most of this code needs a browser to run, so what is held
// here is the source that carries each rule, plus the pure parts run for real
// (the filter the views subscribe with, the clamp on a verse span).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MOVE_KIND, NO_CHAPTER_KINDS, hearsChange } from "../src/lib/desk-store-core.mjs";
import { verseCount } from "../src/data/verse-counts.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const dir = "src/scripts/desk/";
const code = (file) => read(`${dir}${file}`).replace(/\/\/.*$/gm, "");

test("NB8-1: the six reading-page views and What's new ignore sheets, places and bookmark moves", () => {
  for (const file of ["notes-margin.js", "highlights.js", "verse-labels.js", "pins.js", "footnote-notes.js", "read-marks.js", "whats-new.js"]) {
    const src = code(file);
    assert.match(src, /\{ except: \[\.\.\.NO_CHAPTER_KINDS, MOVE_KIND\] \}/, file);
    assert.doesNotMatch(src, /except: QUIET_KINDS/, file);
  }
  // What that filter hears: a sheet autosave and a place are not heard, a note,
  // a highlight, a bookmark and a trash record are.
  const filter = { except: [...NO_CHAPTER_KINDS, MOVE_KIND] };
  assert.equal(hearsChange(filter, ["sheet"]), false);
  assert.equal(hearsChange(filter, ["place"]), false);
  assert.equal(hearsChange(filter, [MOVE_KIND]), false);
  assert.equal(hearsChange(filter, ["note"]), true);
  assert.equal(hearsChange(filter, ["sheet", "highlight"]), true);
  assert.equal(hearsChange(filter, null), true);
});

test("NB8-1: the Notebook panel ignores sheets and places but still hears a bookmark move", () => {
  const src = code("panel.js");
  assert.match(src, /store\?\.subscribe\(\(\) => render\(\), \{ except: NO_CHAPTER_KINDS \}\)/);
  const filter = { except: NO_CHAPTER_KINDS };
  assert.equal(hearsChange(filter, ["sheet"]), false);
  assert.equal(hearsChange(filter, [MOVE_KIND]), true);
});

test("GF8b-8: What's new redraws once reading pauses, not on every bookmark move", () => {
  const src = code("whats-new.js");
  assert.match(src, /redrawAfterMove\(store, \(\) => draw\(\)\)/);
});

test("NB8-2: a bookmark, highlight or pin that fails to save says so in the bar", () => {
  const actions = code("actions.js");
  assert.match(actions, /couldn't be changed", err\);[\s\S]*?showNotice\("That couldn’t be saved in this browser, so nothing changed\. Try again\."\)/);
  assert.match(actions, /couldn't change the highlight", err\);\s*showNotice\(/);
  assert.match(code("pins.js"), /pinned or unpinned", err\);\s*showNotice\(/);
});

test("NB8-4 and GF8b-8: the lists wait for the next key, and My Notes reads every row before writing any", () => {
  for (const file of ["tab-mine.js", "kept-list.js"]) {
    const src = code(file);
    assert.match(src, /const QUERY_DELAY_MS = 150/, file);
    assert.match(src, /setTimeout\(takeQuery, QUERY_DELAY_MS\)/, file);
  }
  const mine = code("tab-mine.js");
  const body = mine.slice(mine.indexOf("function markCut()"), mine.indexOf("async function remove("));
  const reads = body.indexOf("scrollHeight");
  const writes = body.indexOf("caret.hidden =");
  assert.ok(reads > 0 && writes > reads, "scrollHeight is read before any caret is written");
  assert.doesNotMatch(body.slice(0, writes), /\.hidden =/, "no write before the last read");
  // A filter alone redraws from the records already read.
  const kept = code("kept-list.js");
  // …but waits for a full read still in flight, rather than drawing older records.
  assert.match(kept, /reuse && lastRecords && !reading\) records = lastRecords/);
  assert.match(kept, /reuse && reading\) records = await reading/);
  assert.equal((kept.match(/render\(\{ reuse: true \}\)/g) ?? []).length, 4);
});

test("NB8-5: a margin circle that opened nothing is not marked expanded", () => {
  const src = code("notes-margin.js");
  const open = src.slice(src.indexOf("function openPopover("), src.indexOf("function reveal("));
  const at = open.indexOf("if (!pop.isConnected) return;");
  assert.ok(at > open.indexOf("showPanel(circle, pop"), "checked after showPanel");
  assert.ok(at < open.indexOf("popId = record.id"), "checked before popId is set");
  assert.ok(at < open.indexOf('circle.setAttribute("aria-expanded", "true")'));
});

test("NB8-7: the note editor stops a paste at the limit and names a too-long body", () => {
  const src = code("note-editor.js");
  assert.match(src, /body\.maxLength = MAX_NOTE_BODY/);
  assert.match(src, /\/too long\/i\.test\(err\?\.message/);
});

test("NB8-8: Keep, Delete and the bookmark form's Save use aria-disabled, so focus stays", () => {
  assert.doesNotMatch(code("change-notice.js"), /\.disabled = /);
  assert.doesNotMatch(code("bookmark-form.js"), /saveButton\.disabled/);
  assert.match(code("bookmark-form.js"), /isBusy\(saveButton\)/);
  assert.match(code("change-notice.js"), /if \(working\) return;/);
});

test("GF8b-10: a change notice's result closes only its own card, and a failure after it closed is told in the bar", () => {
  const src = code("change-notice.js");
  assert.match(src, /const stillOpen = \(\) => currentPanel\(\)\?\.el === panel;/);
  const keep = src.slice(src.indexOf("async function doKeep()"), src.indexOf("keep?.addEventListener"));
  assert.doesNotMatch(keep, /closePanel\(\)/, "doKeep and doDelete close through leave()");
  assert.match(src, /if \(!stillOpen\(\)\) return void showNotice\(message\)/);
  assert.match(src, /AbortSignal\.timeout/);
});

test("NB8-9: a Greek result held for a shell that never comes is followed as a link", () => {
  const src = code("first-stage.js");
  const stand = src.slice(src.indexOf("stand: () => {"), src.indexOf("}).then((api) => {"));
  assert.match(stand, /e\.type === "lit:greek-word"/);
  assert.match(stand, /window\.location\.assign\(`\$\{window\.location\.pathname\}\?greek=\$\{word\.verse\}\.\$\{word\.t\}#v\$\{word\.verse\}`\)/);
  // The same address the search box's own link has (greekHref).
  assert.equal(`/john-3/?greek=${16}.${7}#v${16}`, "/john-3/?greek=16.7#v16");
});

test("NB8-10: every start-up step after the panel is run through tryStart", () => {
  const src = code("shell.js");
  for (const init of [
    "createPrintPart(",
    "initActions(",
    "initBookmarkFollow(",
    "initCommands(",
    "initGreekLink(",
    "initProseActions(",
    "createTour(",
    "createVerseLabels(",
    "createHighlights(",
    "initPrintLink(",
  ]) {
    const calls = src.split("\n").filter((line) => line.includes(init) && !line.includes("import"));
    assert.ok(calls.length >= 1, init);
    for (const line of calls) assert.match(line, /tryStart\(/, line);
  }
  assert.match(src, /function tryStart\(what, fn\) \{\s*try \{\s*return fn\(\);\s*\} catch \(err\) \{/);
});

test("NB8-11: placing the notes on footnotes reads the footnote list once", () => {
  const sources = code("note-sources.js");
  assert.match(sources, /if \(footnotes === undefined\) footnotes = footnoteList\(\);\s*const li = footnoteElementFor\(r, footnotes\);/);
  const notes = code("footnote-notes.js");
  assert.match(notes, /export function footnoteElementFor\(record, known = undefined\)/);
  assert.match(notes, /const list = known === undefined \? footnoteList\(\) : known;/);
});

test("NB8-13: a Trash row starts no follow and stops none", () => {
  const src = code("record-rows.js");
  assert.match(src, /isFollowing\(r\) && !trash\) kind\.after\(/);
  assert.match(src, /if \(href && r\.kind === "bookmark" && !trash\) \{/);
});

test("NB8-14: Enter confirming an input method's word does not save the bookmark form", () => {
  assert.match(code("bookmark-form.js"), /e\.key === "Enter" && !e\.isComposing/);
});

test("GF8b-4: the tour's example editor leaves a kept draft alone", () => {
  const src = code("note-editor.js");
  assert.match(src, /const draftKey = example \? null :/);
  assert.match(src, /if \(draftKey\) clearDraft\(\);/);
  assert.doesNotMatch(src.slice(src.indexOf("onClose: () => {"), src.indexOf("extra: {")), /^\s*clearDraft\(\);/m);
});

test("XA8-4: Move it here's accessible name begins with its visible words", () => {
  const src = read(`${dir}bookmark-stop.js`);
  assert.match(src, /b\.setAttribute\("aria-label", `Move it here, the bookmark/);
  assert.match(src, /b\.textContent = "Move it here"/);
});

test("XA8-11: the Notebook's Print button is a disclosure, not a menu button", () => {
  const src = code("panel.js");
  const box = src.slice(src.indexOf("function printBox()"), src.indexOf("// M1 hides everything"));
  assert.doesNotMatch(box, /aria-haspopup/);
  assert.match(box, /aria-expanded/);
  assert.match(box, /aria-controls/);
});

test("LV8-6: the tour's Greek step lets go of the word it chose", () => {
  const src = code("tour.js");
  const step = src.slice(src.indexOf("async greek()"), src.indexOf("async undo()"));
  assert.match(step, /later\(\(\) => panel\.el\.querySelector\("\.desk-greek__close"\)\?\.click\(\)\)/);
  // The button it presses is the Greek tab's own.
  assert.match(code("tab-greek.js"), /class="desk-greek__close"/);
});

test("GF8c-1: a note's notice is counted on the verses it covers, never past its chapter", () => {
  const src = read(`${dir}verse-labels.js`);
  const text = src.match(/export function lastCounted\(r\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(text, "lastCounted is there");
  // The function itself, run with the real chapter lengths (the module can't be
  // imported here: it reads page code that imports JSON).
  const lastCounted = new Function("verseCount", `return (${text.replace("export ", "")});`)(verseCount);
  const john3 = { bookKey: "john", chapter: 3, verse: 16 };
  assert.equal(lastCounted(john3), 16);
  assert.equal(lastCounted({ ...john3, endVerse: 18 }), 18);
  assert.equal(lastCounted({ ...john3, endVerse: 2_000_000 }), 36);
  assert.equal(lastCounted({ ...john3, endVerse: 5 }), 16);
  assert.equal(lastCounted({ ...john3, verse: 90, endVerse: 95 }), 90);
  assert.equal(lastCounted({ bookKey: "nowhere", chapter: 1, verse: 4, endVerse: 9_000_000 }), 4);
  // And the loop uses it.
  assert.match(code("verse-labels.js"), /last = lastCounted\(r\)/);
});

test("GF8b-5: a tour step that waits for a frame opens nothing once its run has ended", () => {
  const src = code("tour.js");
  assert.match(src, /act: \(step, \{ live = \(\) => true \} = \{\}\) => STEPS\[step\.id\]\?\.\(live\) \?\? null/);
  const slice = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
  // The click that opens something comes after a live() check that follows the wait.
  const menu = slice("async function openVerseMenu(live)", "async function selectWords(live)");
  assert.ok(menu.indexOf("if (!live()) return null;") < menu.indexOf("state.verse.click()"));
  const select = slice("async function selectWords(live)", "function exampleNote(");
  assert.ok(select.indexOf("if (!live()) return null;") < select.indexOf("addRange(range)"));
  const note = slice("async note(live)", "async margin(live)");
  assert.ok(note.indexOf("if (!live()) return null;") < note.indexOf("add.click()"));
  const margin = slice("async margin(live)", "async pin(live)");
  assert.ok(margin.indexOf("if (!live()) return null;") < margin.indexOf("exampleNote(line)"));
  const pin = slice("async pin(live)", "async panel()");
  assert.ok(pin.indexOf("if (!live()) return null;") < pin.indexOf("ref.click()"));
  const search = slice("async search(live)", "// The notebook page's link");
  assert.ok(search.indexOf("if (!live()) return null;") < search.indexOf('input.value = ">"'));
});
