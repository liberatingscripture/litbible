// This verse's Collections section (D13, step 4, decision 11) over the real
// store on fake-indexeddb: the sentence naming the collections that hold the
// verse (one, two, three), its links, "Add to collection…" adding the verse
// whole through E154's pick window with the "New collection…" row above the
// list, a repeat refused, and the section hearing a collection's write (which
// wakes no view of marks). Also the pick window's action row on its own.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { settle } from "./helpers/browser-env.mjs";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { prepareStudyParagraph } from "../src/lib/chapter-html.ts";
import { createRecord, verseCopyFor } from "../src/lib/desk-records.mjs";
import { createCollection, itemMember, passageMember } from "../src/lib/desk-collections.mjs";
import { passageFromVerses } from "../src/lib/desk-sheet-passages.mjs";
import { planSave } from "../src/lib/desk-store-core.mjs";

globalThis.indexedDB = new IDBFactory();
globalThis.IDBKeyRange = IDBKeyRange;
const RealChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = class extends RealChannel {
  constructor(name) {
    super(name);
    this.unref?.();
  }
};

const john3 = JSON.parse(readFileSync(new URL("../src/data/chapters/john-3.json", import.meta.url), "utf8"));
let n = 0;
const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const opCtx = () => ({ now: new Date().toISOString(), ...ctx() });
const make = (kind, fields) => createRecord(kind, fields, { ...opCtx(), id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` });

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
const { openPickWindow, closePickWindow } = await import("../src/scripts/desk/pick-window.js");
const { collectionHref } = await import("../src/scripts/desk/collections/add-passage.js");

const store = await openStore({ ctx });
createHistory({ store, ctx });

const tab = createVerseTab({
  store,
  here: { bookKey: "john", chapter: 3, label: "John 3" },
  visible: () => true,
  panelOpen: () => true,
  onEdit() {},
  onAddNote() {},
  ctx,
});
document.body.append(tab.el);

const section = () => tab.el.querySelector(".desk-verse__collections");
const line = () => section().querySelector(".desk-verse__collections-line");
const addButton = () => section().querySelector(".desk-verse__collections-add");
const barText = () => document.querySelector(".desk-undo__text")?.textContent ?? "";
const pick = () => document.querySelector(".desk-pick");

async function until(fn, ms = 3000, what = "the condition") {
  const end = Date.now() + ms;
  while (!(await fn())) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

async function clearCollections() {
  for (const r of await store.all()) if (r.kind === "collection") await store.remove(r.id);
}
async function aCollection(name, members = []) {
  const made = createCollection({ name, members }, opCtx());
  await store.change(async () => planSave(made));
  return made;
}
const p16 = (verse = 16) => passageMember(passageFromVerses(null, { bookKey: "john", chapter: 3 }, verse));
const collections = async () => (await store.all()).filter((r) => r.kind === "collection");

async function showVerse(v) {
  tab.setVerse(v);
  await tab.render();
  await settle(20);
}

beforeEach(async () => {
  hideUndo();
  closePickWindow("page");
  for (const w of document.querySelectorAll(".desk-pick")) w.remove();
  await clearCollections();
});

test("with no collection the section shows its line and its button, so the reader can start one", async () => {
  await showVerse(16);
  assert.equal(section().hidden, false);
  assert.equal(section().querySelector(".desk-verse__subhead").textContent, "Collections");
  assert.equal(line().textContent, "Not in any collection yet.");
  assert.equal(addButton().textContent, "Add to collection…");
  assert.ok(addButton().classList.contains("desk-item__tag"));
});

test("the sentence names the collections that hold the verse: one, two, three, each a link", async () => {
  const a = await aCollection("Advent series", [p16()]);
  await showVerse(16);
  assert.equal(line().textContent, "In Advent series.");
  assert.equal(line().querySelector("a").getAttribute("href"), collectionHref(a.id));

  const note = await store.save(make("note", { bookKey: "john", chapter: 3, verse: 16, endVerse: 16, body: "x", marker: "note" }));
  await aCollection("Christmas Eve service", [itemMember(note.id)]);
  await showVerse(16);
  assert.equal(line().textContent, "In Advent series and Christmas Eve service.");

  await aCollection("Baptism class", [p16()]);
  await showVerse(16);
  assert.equal(line().textContent, "In Advent series, Baptism class, and Christmas Eve service.");
  assert.equal(line().querySelectorAll("a").length, 3);

  // Another verse, held by none of them.
  await showVerse(17);
  assert.equal(line().textContent, "Not in any collection yet.");
  await store.remove(note.id);
});

test("the section hears a collection written, though a collection wakes no view of marks", async () => {
  await showVerse(16);
  assert.equal(line().textContent, "Not in any collection yet.");
  await aCollection("Lent", [p16()]);
  await until(() => line().textContent === "In Lent.", 3000, "the line redrawn");
});

test("Add to collection… opens the pick window with its lead, the collections, and New collection… on top", async () => {
  await aCollection("Lent");
  await aCollection("Easter");
  await showVerse(16);
  addButton().click();
  await until(() => pick(), 3000, "the pick window");
  const win = pick();
  assert.match(win.textContent, /Add to collection/);
  assert.match(win.textContent, /All collections/);
  assert.equal(win.querySelector(".desk-pick__lead").textContent, "John 3:16 goes into the collection you pick.");
  const rows = [...win.querySelectorAll(".desk-pick__row")];
  assert.equal(rows[0].dataset.pickAction !== undefined, true, "New collection… is first");
  assert.equal(rows[0].textContent, "New collection…");
  assert.deepEqual(rows.slice(1).map((b) => b.querySelector(".desk-pick__name").textContent).sort(), ["Easter", "Lent"]);
  assert.ok(rows.slice(1).every((b) => /^Changed /.test(b.querySelector(".desk-pick__detail").textContent)));
});

test("a pick adds the verse whole as a passage with its words, says so, and a repeat is refused", async () => {
  const c = await aCollection("Advent series");
  await showVerse(16);
  addButton().click();
  await until(() => pick(), 3000, "the pick window");
  pick().querySelector("[data-pick]").click();
  await until(async () => (await collections())[0].members.length === 1, 3000, "the passage added");
  const held = (await collections())[0].members[0];
  assert.deepEqual([held.type, held.bookKey, held.chapter, held.verse, held.endVerse], ["passage", "john", 3, 16, 16]);
  assert.equal(held.verseCopy, verseCopyFor(chapterText(), 16), "it keeps the verse's words");
  assert.equal(barText(), "John 3:16 added to Advent series.");
  assert.equal(document.querySelector(".desk-undo__link").getAttribute("href"), collectionHref(c.id));
  await until(() => line().textContent === "In Advent series.", 3000, "the sentence");

  addButton().click();
  await until(() => pick(), 3000, "the pick window again");
  pick().querySelector("[data-pick]").click();
  await until(() => /already in Advent series/.test(barText()), 3000, "the repeat said");
  assert.equal((await collections())[0].members.length, 1);
});

test("New collection… makes one with the verse as its first passage, with an undo bar and a link", async () => {
  await showVerse(16);
  addButton().click();
  await until(() => pick(), 3000, "the pick window");
  pick().querySelector("[data-pick-action]").click();
  await until(() => pick()?.querySelector("form"), 3000, "the name window");
  const win = pick();
  assert.match(win.textContent, /John 3:16 will be its first passage\./);
  assert.match(win.textContent, /Add to collection/, "the heading stays at its default");
  win.querySelector("input").value = "Advent series";
  win.querySelector("form").requestSubmit();
  await until(async () => (await collections()).length === 1, 3000, "the collection");
  const made = (await collections())[0];
  assert.equal(made.name, "Advent series");
  assert.deepEqual(made.members.map((m) => [m.type, m.chapter, m.verse, m.endVerse]), [["passage", 3, 16, 16]]);
  assert.equal(made.members[0].verseCopy, verseCopyFor(chapterText(), 16));
  assert.equal(barText(), "John 3:16 added to Advent series.");
  assert.equal(document.querySelector(".desk-undo__link").getAttribute("href"), collectionHref(made.id));
  await until(() => line().textContent === "In Advent series.", 3000, "the sentence");
});

test("the pick window's action row is never filtered away, and isn't counted or picked", async () => {
  let pressed = 0;
  const picked = [];
  openPickWindow({
    heading: "Add to collection",
    title: "All collections",
    noun: ["collection", "collections"],
    items: [
      { id: "a", name: "Advent series" },
      { id: "b", name: "Lent" },
    ],
    onPick: (item) => picked.push(item.id),
    action: { label: "New collection…", onPress: () => pressed++ },
  });
  const win = pick();
  const input = win.querySelector(".desk-pick__filter");
  const names = () => [...win.querySelectorAll(".desk-pick__row")].map((b) => b.textContent);
  assert.deepEqual(names(), ["New collection…", "Advent series", "Lent"]);
  input.value = "zzz";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  assert.deepEqual(names(), ["New collection…"], "a filter that matches nothing still leaves it");
  assert.equal(win.querySelector(".desk-pick__list").hidden, false);
  input.value = "len";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  assert.deepEqual(names(), ["New collection…", "Lent"]);
  win.querySelector("[data-pick-action]").click();
  assert.equal(pressed, 1);
  assert.deepEqual(picked, [], "onPick never hears it");
  assert.ok(!pick(), "pressing it closes the window");
});

test("with no notebook the Collections section stays hidden", async () => {
  const quiet = createVerseTab({
    store: null,
    here: { bookKey: "john", chapter: 3, label: "John 3" },
    visible: () => true,
    panelOpen: () => true,
    ctx: null,
  });
  document.body.append(quiet.el);
  quiet.setVerse(16);
  await quiet.render();
  assert.equal(quiet.el.querySelector(".desk-verse__collections").hidden, true);
  quiet.destroy();
});
