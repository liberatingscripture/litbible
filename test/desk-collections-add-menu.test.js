// "Add to collection ▸" in the verse menu and the selection panel (D13, step 3):
// where the row sits, what its flyout lists, what a pick writes, New
// collection…, All collections…, the finger's chips, and the views that have
// none. Over the real actions.js and the real store on fake-indexeddb.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { settle, resetDom } from "./helpers/browser-env.mjs";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { prepareStudyParagraph } from "../src/lib/chapter-html.ts";
import { createCollection } from "../src/lib/desk-collections.mjs";
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
globalThis.Highlight = class Highlight {};
CSS.highlights = new Map();

const john3 = JSON.parse(readFileSync(new URL("../src/data/chapters/john-3.json", import.meta.url), "utf8"));
const ctx = () => ({ client: "web/test", contentVersion: "v1" });

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

chapterPage();
const { openStore } = await import("../src/scripts/desk/store.js");
const { initActions } = await import("../src/scripts/desk/actions.js");
const { showPanel } = await import("../src/scripts/lit-panel.js");
const { chapterText } = await import("../src/scripts/desk/page.js");
const store = await openStore({ ctx });
initActions({ store, ctx, showVerse: () => {}, printPart: { can: () => true, printVerses: () => {}, printSelection: () => {} } });

const collections = async () => (await store.all()).filter((r) => r.kind === "collection" && !r.deleted);
async function clearAll() {
  for (const r of await store.all()) await store.remove(r.id).catch(() => {});
}
async function aCollection(name, modified) {
  const made = { ...createCollection({ name }, { now: modified, ...ctx() }), modified };
  await store.change(async () => planSave(made));
  return made;
}
async function until(fn, ms = 3000, what = "the condition") {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

const barText = () => document.querySelector(".desk-undo__text")?.textContent ?? "";
const barLink = () => document.querySelector(".desk-undo__link")?.getAttribute("href") ?? null;

/** Open the panel on John 3 and return it with the row the collection code added. */
async function openMenu({ view = "study", kind = "verse", start = 16, end = 16, chips = false, range = null } = {}) {
  // The page is made once (the undo bar is made once, and a reset would lose it); a window left open goes.
  for (const old of document.querySelectorAll(".desk-pick")) old.remove();
  const panel = document.createElement("div");
  if (chips) panel.classList.add("lit-panel--chips");
  showPanel(document.querySelector(`#v${start}`), panel);
  const detail = {
    view,
    kind,
    start,
    end,
    range,
    panel,
    book: "john",
    chapter: 3,
    append: (el) => panel.append(el),
    acting: () => {},
    textFor: () => chapterText(),
  };
  document.dispatchEvent(new CustomEvent("lit:panel-actions", { detail }));
  await settle(20);
  const box = panel.querySelector(".desk-collection-add");
  return { panel, box, detail };
}

/** The flyout row's items (the buttons in the flyout), or the chips' buttons. */
const itemsOf = (panel) => [...panel.querySelectorAll(".desk-collection-add .lit-panel__btn")].filter((b) => !b.classList.contains("lit-flyout__trigger"));
const labels = (panel) => itemsOf(panel).map((b) => b.textContent);
const pressed = async (b) => {
  b.click();
  await settle(20);
};

test("the row sits right after Add to sheet, and the menu holds nothing else new", async () => {
  await clearAll();
  const { panel, box } = await openMenu();
  assert.ok(box);
  const kids = [...panel.children];
  const sheet = kids.findIndex((el) => el.classList.contains("desk-sheet-add"));
  assert.ok(sheet >= 0);
  assert.equal(kids.indexOf(box), sheet + 1);
  assert.equal(box.querySelector(".lit-flyout__trigger").textContent.startsWith("Add to collection"), true);
});

test("with no collections the flyout holds New collection… alone", async () => {
  await clearAll();
  const { panel } = await openMenu();
  assert.deepEqual(labels(panel), ["New collection…"]);
});

test("the flyout lists the five changed last, then New collection…, and All collections… only past five", async () => {
  await clearAll();
  for (let i = 1; i <= 5; i++) await aCollection(`C${i}`, `2026-11-0${i}T00:00:00.000Z`);
  let { panel } = await openMenu();
  await until(() => labels(panel).length === 6, 3000, "the flyout");
  assert.deepEqual(labels(panel), ["“C5”", "“C4”", "“C3”", "“C2”", "“C1”", "New collection…"]);

  await aCollection("C6", "2026-11-06T00:00:00.000Z");
  ({ panel } = await openMenu());
  await until(() => labels(panel).includes("All collections…"), 3000, "All collections…");
  assert.deepEqual(labels(panel), ["“C6”", "“C5”", "“C4”", "“C3”", "“C2”", "New collection…", "All collections…"]);
});

test("a pick adds the verse, with Undo and Open the collection; a repeat is refused; the row never remembers the pick", async () => {
  await clearAll();
  const c = await aCollection("Advent series", "2026-11-01T00:00:00.000Z");
  let { panel } = await openMenu();
  await until(() => labels(panel).length === 2, 3000, "the flyout");
  await pressed(itemsOf(panel)[0]);
  await until(() => barText() === "John 3:16 added to Advent series.", 3000, "the undo bar");
  assert.match(barLink(), new RegExp(`collections/\\?id=${c.id}`));
  const [saved] = await collections();
  assert.deepEqual(
    saved.members.map((m) => [m.type, m.bookKey, m.chapter, m.verse, m.endVerse]),
    [["passage", "john", 3, 16, 16]],
  );
  assert.equal(typeof saved.members[0].verseCopy, "string");
  assert.equal("quote" in saved.members[0], false);

  ({ panel } = await openMenu());
  await until(() => labels(panel).length === 2, 3000, "the flyout again");
  assert.equal(panel.querySelector(".desk-collection-add .lit-flyout__trigger").textContent.includes("Advent"), false);
  await pressed(itemsOf(panel)[0]);
  await until(() => barText() === "John 3:16 is already in Advent series.", 3000, "the repeat notice");
  assert.equal((await collections())[0].members.length, 1);
});

test("a verse range adds as one passage of whole verses", async () => {
  await clearAll();
  await aCollection("Range", "2026-11-01T00:00:00.000Z");
  const { panel } = await openMenu({ start: 16, end: 18 });
  await until(() => labels(panel).length === 2, 3000, "the flyout");
  await pressed(itemsOf(panel)[0]);
  await until(() => barText() === "John 3:16–18 added to Range.", 3000, "the undo bar");
  const [saved] = await collections();
  assert.deepEqual([saved.members[0].verse, saved.members[0].endVerse], [16, 18]);
});

test("a selection of part of two verses adds both, whole, with no quote", async () => {
  await clearAll();
  await aCollection("Parts", "2026-11-01T00:00:00.000Z");
  const textIn = (n) => {
    const walker = document.createTreeWalker(document.querySelector(".chapter"), 4);
    let afterMarker = false;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (afterMarker && node.data.trim().length > 10) return node;
      if (node.parentElement?.id === `v${n}`) afterMarker = true;
    }
    return null;
  };
  const a = textIn(16);
  const b = textIn(17);
  const range = document.createRange();
  range.setStart(a, 5);
  range.setEnd(b, 5);
  const { panel } = await openMenu({ kind: "selection", start: 16, end: 17, range });
  await until(() => labels(panel).length === 2, 3000, "the flyout");
  await pressed(itemsOf(panel)[0]);
  await until(() => /added to Parts/.test(barText()), 3000, "the undo bar");
  const [saved] = await collections();
  const [m] = saved.members;
  assert.deepEqual([m.verse, m.endVerse], [16, 17]);
  assert.equal("quote" in m, false);
  assert.equal(barText(), "John 3:16–17 added to Parts.");
});

test("New collection… makes one with the passage as its first member, and says so on the undo bar", async () => {
  await clearAll();
  const { panel } = await openMenu();
  const fresh = itemsOf(panel).find((b) => b.textContent === "New collection…");
  await pressed(fresh);
  const win = document.querySelector(".desk-pick");
  assert.ok(win);
  assert.match(win.textContent, /Add to collection/);
  assert.match(win.textContent, /John 3:16 will be its first passage\./);
  // A name, and a description from the start (E174).
  const [name, description] = win.querySelectorAll("input, textarea");
  assert.equal(description?.tagName, "TEXTAREA", "a description field under the name");
  name.value = "From a verse";
  description.value = "Verses on love.";
  win.querySelector("form").requestSubmit();
  await until(() => barText() === "John 3:16 added to From a verse.", 3000, "the undo bar");
  const [saved] = await collections();
  assert.equal(saved.name, "From a verse");
  assert.equal(saved.description, "Verses on love.");
  assert.deepEqual(saved.members.map((m) => [m.type, m.verse]), [["passage", 16]]);
  assert.match(barLink(), new RegExp(`collections/\\?id=${saved.id}`));
});

test("All collections… opens E154's window over every collection, and a pick there adds as a flyout pick does", async () => {
  await clearAll();
  for (let i = 1; i <= 7; i++) await aCollection(`C${i}`, `2026-11-0${i}T00:00:00.000Z`);
  const { panel } = await openMenu();
  await until(() => labels(panel).includes("All collections…"), 3000, "All collections…");
  await pressed(itemsOf(panel).find((b) => b.textContent === "All collections…"));
  const win = document.querySelector(".desk-pick");
  assert.ok(win);
  assert.match(win.textContent, /All collections/);
  assert.match(win.textContent, /Choose the collection for John 3:16\./);
  const rows = [...win.querySelectorAll(".desk-pick__row")];
  assert.equal(rows.length, 7);
  assert.match(rows[6].querySelector(".desk-pick__detail").textContent, /^Changed /);
  rows[6].click();
  await until(() => barText() === "John 3:16 added to C1.", 3000, "the undo bar");
  const c1 = (await collections()).find((c) => c.name === "C1");
  assert.equal(c1.members.length, 1);
});

test("a finger's chips are flat: a heading, then each choice as a row, with no flyout", async () => {
  await clearAll();
  await aCollection("Chip", "2026-11-01T00:00:00.000Z");
  const { panel } = await openMenu({ chips: true });
  await until(() => labels(panel).length === 2, 3000, "the chips");
  assert.equal(panel.querySelector(".desk-collection-add .lit-flyout"), null);
  assert.equal(panel.querySelector(".desk-collection-add .lit-panel__subheading").textContent, "Add to collection");
  assert.deepEqual(labels(panel), ["“Chip”", "New collection…"]);
});

test("/desk's LIT pane has the row, after Add to sheet's (E170); Read View has none", async () => {
  await clearAll();
  const desk = await openMenu({ view: "desk" });
  assert.ok(desk.box);
  const rows = [...desk.panel.children];
  assert.ok(rows.findIndex((el) => el.classList.contains("desk-sheet-add")) >= 0, "Add to sheet's row");
  assert.ok(rows.indexOf(desk.box) > rows.findIndex((el) => el.classList.contains("desk-sheet-add")));
  const read = await openMenu({ view: "read" });
  assert.equal(read.box, null);
  const glossary = await openMenu({ view: "glossary" });
  assert.equal(glossary.box, null);
});
