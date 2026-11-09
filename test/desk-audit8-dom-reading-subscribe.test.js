// NB8-1 driven: each reading-page view, the Notebook panel and What's new
// subscribe to the notebook with a filter. A sheet autosaving (kinds ["sheet"])
// or a place being saved must redraw none of the reading-page views, and the
// bookmark moving as the reader reads must redraw none of them at once.
// The store here is the real listener set (src/lib/desk-store-core.mjs) with
// reads that are counted, so the test checks what the views do, not how they
// ask.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom } from "./helpers/browser-env.mjs";
import { MOVE_KIND, listenerSet } from "../src/lib/desk-store-core.mjs";

/** The notebook as the views read it, with every read counted. */
function countingStore() {
  const listeners = listenerSet();
  const store = {
    reads: 0,
    subscribe: (fn, filter) => listeners.add(fn, filter),
    fire: (kinds) => listeners.notify(["x"], "local", kinds),
    all: async () => (store.reads++, []),
    byChapter: async () => (store.reads++, []),
    get: async () => (store.reads++, null),
    getMeta: async () => (store.reads++, null),
    lastEntry: () => null,
    onEntry: () => () => {},
    onMeta: () => () => {},
    persisted: async () => true,
  };
  return store;
}

/** A Chapter View chapter, as the views find it. */
function chapterPage() {
  document.body.innerHTML = `
    <main><div class="scripture-layout scripture-layout--scripture"><div class="scripture-main">
      <h1 id="chapter-title">John 3</h1>
      <article class="chapter" data-last-read-book="john" data-last-read-chapter="3">
        <div class="chapter-paragraphs"><div class="p"><span class="verse-num" data-verse="16" id="v16">16</span>For God so loved the world.</div></div>
      </article>
    </div></div></main>`;
}

/** Read View's page, as createReadMarks finds it. */
function readPage() {
  document.body.innerHTML = `<div data-rm-root data-rm-book="john"><div data-rm-text><div class="rm-block" data-chapter="3"><span data-verse="16">16</span> text</div></div></div>`;
}

/** What each kind of change does to a view: how many reads it set off. */
async function readsAfter(store, kinds) {
  await settle(20);
  const before = store.reads;
  store.fire(kinds);
  await settle(20);
  return store.reads - before;
}

async function assertHearsOnlyContent(store, name) {
  assert.equal(await readsAfter(store, ["sheet"]), 0, `${name}: a sheet autosave redraws nothing`);
  assert.equal(await readsAfter(store, ["place"]), 0, `${name}: a place redraws nothing`);
  assert.equal(await readsAfter(store, [MOVE_KIND]), 0, `${name}: a bookmark move waits for reading to pause`);
  assert.ok((await readsAfter(store, ["note"])) > 0, `${name}: a note redraws`);
  assert.ok((await readsAfter(store, ["sheet", "highlight"])) > 0, `${name}: a mixed change with a highlight redraws`);
}

test("NB8-1: the verse labels hear notes but not sheets, places or bookmark moves", async () => {
  resetDom();
  chapterPage();
  const store = countingStore();
  const { createVerseLabels } = await import("../src/scripts/desk/verse-labels.js");
  assert.ok(createVerseLabels({ store }));
  await assertHearsOnlyContent(store, "verse labels");
});

test("NB8-1: the Read View bookmarks hear bookmarks but not sheets, places or bookmark moves", async () => {
  resetDom();
  readPage();
  const store = countingStore();
  const { createReadMarks } = await import("../src/scripts/desk/read-marks.js");
  assert.ok(createReadMarks({ store }));
  await assertHearsOnlyContent(store, "read marks");
});

test("NB8-1: the highlights hear highlights but not sheets, places or bookmark moves", async () => {
  resetDom();
  chapterPage();
  CSS.highlights = new Map();
  globalThis.Highlight = class Highlight {};
  const store = countingStore();
  const { createHighlights } = await import("../src/scripts/desk/highlights.js");
  assert.ok(createHighlights({ store }));
  await assertHearsOnlyContent(store, "highlights");
});

test("NB8-1: What's new hears marks but not sheets, places or bookmark moves", async () => {
  resetDom();
  const store = countingStore();
  const { mountWhatsNew } = await import("../src/scripts/desk/whats-new.js");
  mountWhatsNew(document.body.appendChild(document.createElement("section")), { store });
  await assertHearsOnlyContent(store, "What's new");
});

test("NB8-1: the margin notes hear notes but not sheets, places or bookmark moves", async () => {
  resetDom();
  chapterPage();
  const store = countingStore();
  const textBox = document.querySelector(".chapter-paragraphs");
  const source = {
    textBox,
    owns: () => false,
    placed: () => [],
    load: async (st) => {
      await st.all();
      return { notes: [], bookmarks: [], highlights: [] };
    },
  };
  const { createNotesMargin } = await import("../src/scripts/desk/notes-margin.js");
  assert.ok(createNotesMargin({ store, source, onEdit: () => {} }));
  await assertHearsOnlyContent(store, "margin notes");
});

test("NB8-1: pinned footnotes and the notes on footnotes hear marks but not sheets, places or bookmark moves", async () => {
  resetDom();
  chapterPage();
  const store = countingStore();
  const { initPins } = await import("../src/scripts/desk/pins.js");
  assert.ok(initPins({ store, ctx: () => ({ client: "web/test", contentVersion: "v1" }) }));
  await assertHearsOnlyContent(store, "pins");
});

test("NB8-1: the Notebook panel ignores sheets and places, but hears a bookmark move", async () => {
  resetDom();
  chapterPage();
  const store = countingStore();
  const { createPanel } = await import("../src/scripts/desk/panel.js");
  createPanel({ store, ctx: () => ({ client: "web/test", contentVersion: "v1" }) });
  await settle(20);
  assert.equal(await readsAfter(store, ["sheet"]), 0, "a sheet autosave redraws nothing");
  assert.equal(await readsAfter(store, ["place"]), 0, "a place redraws nothing");
  assert.ok((await readsAfter(store, [MOVE_KIND])) > 0, "a bookmark move redraws My Notes (NB8-3)");
  assert.ok((await readsAfter(store, ["note"])) > 0, "a note redraws");
});
