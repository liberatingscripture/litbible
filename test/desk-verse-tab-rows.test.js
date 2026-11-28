// This verse's rows driven over the real notebook store (E147, E148, E149;
// BVJ, 2026-11-17). A row there has what its row in My Notes has: "It should
// have all the options to interact with it on both tabs." Labels are for
// bookmarks alone, and the margin's "N more notes" opens the tab at the
// verse's notes, which take focus and a moment's tint.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { settle } from "./helpers/browser-env.mjs";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { prepareStudyParagraph } from "../src/lib/chapter-html.ts";
import { createRecord, verseCopyFor } from "../src/lib/desk-records.mjs";

globalThis.indexedDB = new IDBFactory();
globalThis.IDBKeyRange = IDBKeyRange;
// An open channel keeps node alive; the store here is never closed.
const RealChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = class extends RealChannel {
  constructor(name) {
    super(name);
    this.unref?.();
  }
};

const john3 = JSON.parse(readFileSync(new URL("../src/data/chapters/john-3.json", import.meta.url), "utf8"));
let n = 0;
const ctx = () => ({ client: "web/test", contentVersion: "v1", now: `2026-11-17T10:00:${String(n).padStart(2, "0")}.000Z` });
const make = (kind, fields) =>
  createRecord(kind, fields, { ...ctx(), id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` });

/** John 3 as Chapter View renders it. */
function chapterPage() {
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

chapterPage();
const { openStore } = await import("../src/scripts/desk/store.js");
const { createHistory } = await import("../src/scripts/desk/history.js");
const { hideUndo } = await import("../src/scripts/desk/undo-bar.js");
const { chapterText } = await import("../src/scripts/desk/page.js");
const { createVerseTab } = await import("../src/scripts/desk/tab-verse.js");

const store = await openStore({ ctx });
createHistory({ store, ctx });

const words16 = verseCopyFor(chapterText(), 16).split(/\s+/).slice(0, 4).join(" ");
const label = await store.save(make("label", { name: "False teachers" }));
const bookmark = await store.save(make("bookmark", { bookKey: "john", chapter: 3, verse: 16, label: "Gospel in brief", labels: [label.id] }));
const highlight = await store.save(
  make("highlight", { bookKey: "john", chapter: 3, verse: 16, color: "green", quote: { exact: words16, prefix: "", suffix: "" } }),
);
// A note that carries a label from before E149: kept in the record, never shown.
const note = await store.save(make("note", { bookKey: "john", chapter: 3, verse: 16, body: "Loved, not tolerated.", marker: "note", labels: [label.id] }));

const edits = [];
const tab = createVerseTab({
  store,
  here: { bookKey: "john", chapter: 3, label: "John 3" },
  visible: () => true,
  panelOpen: () => true,
  onEdit: (r) => edits.push(r.id),
  onAddNote: () => {},
  ctx,
});
document.body.append(tab.el);

const row = (id) => tab.el.querySelector(`.desk-verse__mine [data-id="${id}"]`);
const texts = (li, sel) => [...li.querySelectorAll(sel)].map((x) => x.textContent.trim());
const barText = () => document.querySelector(".desk-undo__text")?.textContent ?? "";

async function showVerse16() {
  tab.setVerse(16);
  await tab.render();
  await settle(20);
}

beforeEach(() => hideUndo());

test("E148: a bookmark's row has its reference, name, line, Edit, Remove, labels and Labels…", async () => {
  await showVerse16();
  const li = row(bookmark.id);
  assert.ok(li, "the bookmark is listed");
  const ref = li.querySelector(".desk-item__ref");
  assert.equal(ref.textContent, "John 3:16");
  assert.equal(ref.tagName, "A", "the reference goes to its place");
  assert.equal(li.querySelector(".desk-item__bookmark-name")?.textContent, "Gospel in brief");
  assert.match(li.querySelector(".desk-item__kind").textContent, /Bookmark/);
  assert.match(li.querySelector(".desk-item__kind").textContent, /Stays put/);
  assert.deepEqual(texts(li, ".desk-chip"), ["False teachers"]);
  assert.deepEqual(texts(li, ".desk-item__tag"), ["Labels…", "Collections…"]);
  assert.deepEqual(texts(li, ".desk-verse__actions button"), ["Edit", "Remove"]);
  li.querySelector(".desk-item__edit").click();
  assert.deepEqual(edits, [bookmark.id], "Edit opens the bookmark's form");
});

test("E148: a highlight's row has its reference, its colour in words, its words and Remove, and no Labels…", async () => {
  await showVerse16();
  const li = row(highlight.id);
  assert.ok(li, "the highlight is listed");
  assert.equal(li.querySelector(".desk-item__ref").textContent, "John 3:16");
  assert.equal(li.querySelector(".desk-item__kind").textContent, "Green highlight");
  assert.equal(li.querySelector(".desk-verse__highlight .desk-swatch")?.dataset.color, "green");
  assert.match(li.querySelector(".desk-verse__highlight").textContent, new RegExp(words16.split(" ")[0]));
  assert.deepEqual(texts(li, ".desk-verse__actions button"), ["Remove"]);
  assert.deepEqual(texts(li, ".desk-item__tag"), ["Collections…"], "no Labels…, only Collections…");
  assert.ok(!li.querySelector(".desk-item__labels"));
  assert.ok(!li.querySelector(".desk-chip"));
});

test("E149: a note keeps its stored label but shows no chip and no Labels…; it has Edit and Delete", async () => {
  await showVerse16();
  const li = row(note.id);
  assert.ok(li, "the note is listed");
  assert.equal(li.querySelector(".desk-item__kind").textContent, "Note");
  assert.match(li.querySelector(".desk-verse__words").textContent, /Loved, not tolerated\./);
  assert.ok(!li.querySelector(".desk-chip"));
  assert.deepEqual(texts(li, ".desk-item__tag"), ["Collections…"]);
  assert.ok(!li.querySelector(".desk-item__labels"));
  assert.deepEqual(texts(li, ".desk-verse__actions button"), ["Edit", "Delete"]);
  assert.deepEqual((await store.get(note.id)).labels, [label.id], "the record still holds it");
});

test("E148: Remove on a highlight takes it off and offers Undo, naming it as My Notes does", async () => {
  await showVerse16();
  row(highlight.id).querySelector(".desk-verse__remove").click();
  for (let i = 0; i < 100 && row(highlight.id); i++) await settle(10);
  assert.equal(row(highlight.id), null, "the row is gone");
  assert.equal(await store.get(highlight.id), undefined);
  assert.equal(barText(), "Green highlight on John 3:16 removed.");
  document.querySelector(".desk-undo__undo").click();
  for (let i = 0; i < 100 && !(await store.get(highlight.id)); i++) await settle(10);
  assert.ok(await store.get(highlight.id), "Undo puts it back");
});

test("E147: showNotes puts focus on the verse's notes and tints them for a moment", async () => {
  await showVerse16();
  await tab.showNotes();
  const section = tab.el.querySelector(".desk-verse__notes");
  assert.ok(document.activeElement === section.querySelector(".desk-verse__subhead"), "focus is on the notes' subhead");
  // "Notes," not "My Notes": Featherboa drops "My" (Phase 5).
  assert.equal(document.activeElement.textContent, "Notes");
  assert.ok(section.classList.contains("desk-verse__notes--flash"), "the tint starts");
  assert.ok(row(note.id), "the notes are drawn");
});

test("E149: My Notebook's rows show labels and Labels… on a bookmark, never on a note", async () => {
  const { recordRow } = await import("../src/scripts/desk/record-rows.js");
  const labels = new Map([[label.id, label]]);
  const actions = { labels, onLabels() {}, onDelete() {} };
  const markRow = recordRow(bookmark, actions);
  const noteRow = recordRow(note, actions);
  assert.deepEqual(texts(markRow, ".desk-chip"), ["False teachers"]);
  assert.ok(markRow.querySelector(".desk-item__labels"), "a bookmark takes Labels…");
  assert.equal(noteRow.querySelector(".desk-chip"), null);
  assert.equal(noteRow.querySelector(".desk-item__labels"), null);
});
