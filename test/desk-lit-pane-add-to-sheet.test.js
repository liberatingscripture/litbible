// "Add to sheet" in /desk's LIT pane (STUDY-DESK-FIXES.md E170 and E172; BVJ,
// 2026-11-19): the LIT pane's verse menu and selection panel have Chapter
// View's "Add to sheet ▸" row, and it stays that row while a Sheets pane shows
// a sheet: no one-press "Add to “…”" (E172, as collections have none). A pick
// of the pane's sheet in the flyout goes through the pane (`paneSheet`), so
// the passage shows there at once. Over the real actions.js, with a notebook
// stub and a stand-in for the Sheets pane.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { settle, resetDom } from "./helpers/browser-env.mjs";
import { prepareStudyParagraph } from "../src/lib/chapter-html.ts";
import { createSheet } from "../src/lib/desk-sheets.mjs";

globalThis.Highlight = class Highlight {};
CSS.highlights = new Map();

const john3 = JSON.parse(readFileSync(new URL("../src/data/chapters/john-3.json", import.meta.url), "utf8"));
const ctx = () => ({ client: "web/test", contentVersion: "v1" });

/** John 3 as Chapter View renders it, standing in for the LIT pane's text. */
function chapterPage() {
  resetDom();
  const seen = new Set();
  const state = { currentVerse: null };
  const body = john3.paragraphs.map((p) => `<div class="p">${prepareStudyParagraph(p, "john", 3, seen, state)}</div>`).join("");
  document.body.innerHTML = `
    <main><div class="scripture-layout scripture-layout--scripture"><div class="scripture-main">
      <h1 id="chapter-title">John 3</h1>
      <article class="chapter" data-last-read-book="john" data-last-read-chapter="3">
        <div class="chapter-paragraphs">${body}</div>
      </article>
    </div></div></main>`;
}

const freedom = { ...createSheet({ title: "Freedom" }, { now: "2026-11-18T10:00:00.000Z", ...ctx() }), modified: "2026-11-18T10:00:00.000Z" };
const lent = { ...createSheet({ title: "Lent" }, { now: "2026-11-17T10:00:00.000Z", ...ctx() }), modified: "2026-11-17T10:00:00.000Z" };

const writes = [];
/** A notebook holding two sheets; a direct write is recorded, never applied. */
const store = {
  byChapter: async () => [],
  byKind: async (kind) => (kind === "sheet" ? [freedom, lent] : []),
  all: async () => [freedom, lent],
  get: async (id) => [freedom, lent].find((s) => s.id === id) ?? null,
  change: async (fn) => {
    writes.push(fn);
    return null;
  },
  save: async () => {},
  remove: async () => null,
  lastEntry: () => null,
  subscribe: () => () => {},
  onEntry: () => () => {},
};

// The Sheets pane, as sheet-pane.js's `paneSheet` gives it: null while no
// Sheets pane shows a sheet.
let inPane = null;
const added = [];
let answer = { message: "John 3:16 added.", again: false };
const paneSheet = () =>
  inPane && {
    ...inPane,
    add: async (fields) => {
      added.push(fields);
      return answer;
    },
  };

chapterPage();
const { initActions } = await import("../src/scripts/desk/actions.js");
const { showPanel } = await import("../src/scripts/lit-panel.js");
initActions({ store, ctx, paneSheet });

/** A menu opened on John 3:16 in `view`; returns the panel once its rows are drawn. */
async function openMenu(view = "desk") {
  chapterPage();
  const panel = document.createElement("div");
  showPanel(document.querySelector("#v16"), panel);
  const detail = {
    view,
    kind: "verse",
    start: 16,
    end: 16,
    panel,
    book: "john",
    chapter: 3,
    append: (el) => panel.append(el),
    acting: () => {},
  };
  document.dispatchEvent(new CustomEvent("lit:panel-actions", { detail }));
  await settle(20);
  return panel;
}

const names = (box) => [...box.querySelectorAll(".lit-flyout__menu button")].map((b) => b.textContent.trim());

test("E170: with no sheet in a Sheets pane, the LIT pane's menu has Chapter View's Add to sheet flyout", async () => {
  inPane = null;
  const panel = await openMenu();
  const row = panel.querySelector(".desk-sheet-add");
  assert.ok(row, "an Add to sheet row");
  assert.equal(row.querySelector(".lit-flyout__trigger")?.textContent.trim(), "Add to sheet");
  assert.equal(row.querySelector(".lit-flyout__split"), null, "not split");
  assert.deepEqual(names(row), ["“Freedom”", "“Lent”", "New sheet…"]);
});

test("E170: the row sits before Add to collection, as in Chapter View", async () => {
  inPane = null;
  const panel = await openMenu();
  const rows = [...panel.children];
  const sheet = rows.findIndex((el) => el.classList.contains("desk-sheet-add"));
  const collection = rows.findIndex((el) => el.classList.contains("desk-collection-add"));
  assert.ok(sheet >= 0 && collection > sheet);
});

test("E172: with a sheet in a Sheets pane the row is still the plain flyout, the five changed last: no one-press add", async () => {
  inPane = { id: lent.id, name: "Lent" };
  added.length = 0;
  writes.length = 0;
  const panel = await openMenu();
  const row = panel.querySelector(".desk-sheet-add");
  assert.equal(row.querySelector(".lit-flyout__split"), null, "not split");
  const trigger = row.querySelector(".lit-flyout__trigger");
  assert.equal(trigger?.textContent.trim(), "Add to sheet", "the row never names a sheet");
  assert.equal([...row.querySelectorAll("button")].some((b) => /^Add to “/.test(b.textContent)), false);
  // The pane's sheet keeps its place among the others: newest change first.
  assert.deepEqual(names(row), ["“Freedom”", "“Lent”", "New sheet…"]);
  trigger.click();
  await settle(5);
  assert.equal(added.length + writes.length, 0, "opening the flyout adds nothing");
});

test("E170: a pick of the pane's sheet in the flyout goes through the pane; another sheet is written directly", async () => {
  inPane = { id: lent.id, name: "Lent" };
  answer = { message: "John 3:16 added.", again: false };
  added.length = 0;
  writes.length = 0;
  let panel = await openMenu();
  const pick = (title) => [...panel.querySelectorAll(".desk-sheet-add .lit-flyout__menu button")].find((b) => b.textContent.trim() === title);
  pick("“Lent”").click();
  await settle(5);
  assert.equal(added.length, 1);
  assert.deepEqual([added[0].bookKey, added[0].chapter, added[0].verse, added[0].endVerse], ["john", 3, 16, 16]);
  assert.equal(writes.length, 0, "written through the pane, not the notebook");
  panel = await openMenu();
  pick("“Freedom”").click();
  await settle(5);
  assert.equal(added.length, 1, "the pane wasn't asked");
  assert.equal(writes.length, 1, "one change to the notebook");
});

test("E170: a passage already on the pane's sheet is added again, and the line saying so shows under the pick", async () => {
  inPane = { id: lent.id, name: "Lent" };
  answer = { message: "John 3:16 added again; it was already on the sheet.", again: true };
  const panel = await openMenu();
  const lentPick = [...panel.querySelectorAll(".desk-sheet-add .lit-flyout__menu button")].find((b) => b.textContent.trim() === "“Lent”");
  lentPick.click();
  await settle(5);
  assert.equal(lentPick.textContent, "Added again ✓");
  assert.equal(panel.ownerDocument.body.textContent.includes("John 3:16 added again; it was already on the sheet."), true);
});

test("E172: Chapter View's row is the same plain flyout, a Sheets pane or not", async () => {
  inPane = { id: lent.id, name: "Lent" };
  const panel = await openMenu("study");
  const row = panel.querySelector(".desk-sheet-add");
  assert.ok(row);
  assert.equal(row.querySelector(".lit-flyout__split"), null);
  assert.equal(row.querySelector(".lit-flyout__trigger")?.textContent.trim(), "Add to sheet");
});

test("E170: Read View still has no Add to sheet row", async () => {
  inPane = null;
  const panel = await openMenu("read");
  assert.equal(panel.querySelector(".desk-sheet-add"), null);
});
