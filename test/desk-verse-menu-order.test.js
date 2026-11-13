// The Study Desk's rows in the verse menu and the selection panel, in the
// owner's order (E112; BVJ, 2026-11-12): after the shared Copy text and Share
// rows, the My Notebook heading, Highlight, Add a note with Add bookmark (and
// the verse's bookmarks beneath), Add to sheet, Print, then Show in Notebook.
// Each row keeps its label and its condition; this checks only the order, and
// that a row whose condition fails is absent.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { settle, resetDom } from "./helpers/browser-env.mjs";
import { prepareStudyParagraph } from "../src/lib/chapter-html.ts";

const john3 = JSON.parse(readFileSync(new URL("../src/data/chapters/john-3.json", import.meta.url), "utf8"));
const ctx = () => ({ client: "web/test", contentVersion: "v1" });

/** John 3 as Chapter View renders it, so the menu's highlight row can read the words. */
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

/** A notebook with nothing in it; every read answers at once. */
function emptyStore() {
  return {
    byChapter: async () => [],
    byKind: async () => [],
    all: async () => [],
    get: async () => null,
    change: async () => null,
    save: async () => {},
    remove: async () => null,
    lastEntry: () => null,
    subscribe: () => () => {},
    onEntry: () => () => {},
  };
}

/** The label a row the desk adds is known by, for the order check. */
function labelOf(el) {
  if (el.classList.contains("lit-panel__subheading")) return "heading";
  if (el.classList.contains("desk-hl-row")) return "highlight";
  if (el.classList.contains("desk-bookmark-menu")) return "bookmarks";
  const text = el.textContent;
  if (text.includes("Add a note")) return "notes and bookmark";
  if (text.includes("Add bookmark")) return "bookmark";
  if (text.startsWith("Add to sheet")) return "sheet";
  if (text.startsWith("Print")) return "print";
  if (text.includes("Show in Notebook")) return "show";
  return null;
}

// initActions adds a document listener, so it runs once for the file. What the
// scenarios vary (whether Print can print, the highlight setting, the view) is
// read at each press.
globalThis.Highlight = class Highlight {};
CSS.highlights = new Map();
let printOn = false;
chapterPage();
const { initActions } = await import("../src/scripts/desk/actions.js");
const { showPanel } = await import("../src/scripts/lit-panel.js");
initActions({
  store: emptyStore(),
  ctx,
  showVerse: () => {},
  printPart: { can: () => printOn, printVerses: () => {}, printSelection: () => {} },
});

/** The desk's rows in a menu opened on John 3:16 in `view`, in the order they were added. */
async function deskRows({ view = "study", kind = "verse" } = {}) {
  chapterPage();
  const panel = document.createElement("div");
  showPanel(document.querySelector("#v16"), panel);
  const detail = {
    view,
    kind,
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
  return [...panel.children].map(labelOf).filter(Boolean);
}

test("E112: Chapter View's menu adds Highlight, Add a note and Add bookmark, Add to sheet, Print, then Show in Notebook", async () => {
  printOn = true;
  const rows = await deskRows();
  assert.deepEqual(rows, ["heading", "highlight", "notes and bookmark", "bookmarks", "sheet", "print", "show"]);
});

test("E112: without Print, the rows that remain keep the order", async () => {
  printOn = false;
  const rows = await deskRows();
  assert.deepEqual(rows, ["heading", "highlight", "notes and bookmark", "bookmarks", "sheet", "show"]);
});

test("E112: Read View's selection panel has Highlight before Add bookmark, with no note, sheet or Show row", async () => {
  printOn = false;
  const rows = await deskRows({ view: "read", kind: "selection" });
  assert.deepEqual(rows, ["heading", "highlight", "bookmark", "bookmarks"]);
});
