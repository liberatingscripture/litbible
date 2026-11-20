// A collection's passage, drawn as a scripture page sets it (STUDY-DESK-FIXES.md
// E171; BVJ, 2026-11-19): its paragraphs and poetry lines, italics, and verse
// numbers, with no footnote letters, cut at three lines with a caret that
// shows all of it, and whole on paper. Over the real store on fake-indexeddb,
// with the passage reader faked; happy-dom has no layout, so a box's heights
// are set by the test.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { settle } from "./helpers/browser-env.mjs";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { createCollection, passageMember } from "../src/lib/desk-collections.mjs";
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

// The words' height, and the box's: three lines are 80px here. An open box
// shows all of its words.
let wordsHeight = 40;
const isWords = (el) => el.classList?.contains("desk-sheet__words");
const opened = (el) => Boolean(el.closest?.(".desk-item__pin-row--open"));
Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
  configurable: true,
  get() { return isWords(this) ? wordsHeight : 0; },
});
Object.defineProperty(HTMLElement.prototype, "clientHeight", {
  configurable: true,
  get() { return isWords(this) ? (opened(this) ? wordsHeight : Math.min(wordsHeight, 80)) : 0; },
});

const { mountCollectionsPage } = await import("../src/scripts/desk/collections/collection-page.js");
const { openStore } = await import("../src/scripts/desk/store.js");

const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const opCtx = () => ({ now: new Date().toISOString(), ...ctx() });
const store = await openStore({ ctx });

async function until(fn, ms = 3000, what = "the condition") {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** Matthew 5:1–4 as `passageWords` hands it over: a paragraph, then poetry, with no footnote letters. */
function matthew5() {
  const el = document.createElement("div");
  el.className = "desk-sheet__words chapter-paragraphs";
  el.innerHTML = [
    `<p><span data-verse="1"><span class="vglue"><sup class="vn" data-osis="Matt.5.1">1</sup>&#8288;Having</span> seen the crowds, Jesus went up the hill.</span>`,
    ` <span data-verse="2"><span class="vglue"><sup class="vn" data-osis="Matt.5.2">2</sup>&#8288;He</span> taught them, saying,</span></p>`,
    `<blockquote class="hbq" aria-describedby="hbq-description">`,
    `<p class="hbq-line"><span data-verse="3"><span class="vglue"><sup class="vn" data-osis="Matt.5.3">3</sup>&#8288;How</span> greatly fortunate are the poor who are with the <em>Life-breath</em></span></p>`,
    `<p class="hbq-line"><span data-verse="3">because the Heavenly Reign is for them.</span></p>`,
    `</blockquote>`,
  ].join("");
  return el;
}

/** One collection holding Matthew 5:1–4, on its page; `words` is what the passage reader gives. */
async function mountOne(words) {
  for (const r of await store.all()) await store.remove(r.id).catch(() => {});
  for (const old of document.querySelectorAll("[data-test-root]")) old.remove();
  const member = passageMember({ bookKey: "matthew", chapter: 5, verse: 1, endVerse: 4, verseCopy: "Having seen the crowds" });
  const made = createCollection({ name: "Beatitudes", members: [member] }, opCtx());
  await store.change(async () => planSave(made));
  history.replaceState(null, "", `/collections/?id=${encodeURIComponent(made.id)}`);
  const root = document.createElement("div");
  root.dataset.testRoot = "";
  document.body.append(root);
  const page = await mountCollectionsPage(root, {
    store,
    ctx,
    base: "/",
    chapterText: async () => null,
    passageText: async () => words(),
    parse: () => null,
  });
  await until(() => root.querySelector(".desk-np-row .desk-sheet__words p"), 3000, "the passage's words");
  await settle(5);
  return { root, page, row: () => root.querySelector(".desk-np-row") };
}

test("a passage's words keep their paragraphs, poetry lines, italics, and verse numbers", async () => {
  wordsHeight = 40;
  const { page, row } = await mountOne(matthew5);
  const words = row().querySelector(".desk-sheet__words.chapter-paragraphs");
  assert.ok(words, "in a sheet passage's look");
  assert.equal(words.querySelectorAll(":scope > p").length, 1);
  assert.equal(words.querySelectorAll("blockquote.hbq > p.hbq-line").length, 2, "each poetry line a line of its own");
  assert.deepEqual([...words.querySelectorAll("sup.vn")].map((s) => s.textContent), ["1", "2", "3"]);
  assert.equal(words.querySelector("em")?.textContent, "Life-breath");
  assert.equal(words.querySelector("sup.fn-ref"), null);
  // Nothing of the plain-text row it replaced.
  assert.equal(row().querySelector(".desk-item__words"), null);
  page.destroy();
});

test("plain text from the passage reader shows as one paragraph", async () => {
  wordsHeight = 40;
  const { page, row } = await mountOne(() => "Having seen\n  the crowds.");
  const words = row().querySelector(".desk-sheet__words");
  assert.deepEqual([...words.children].map((c) => c.tagName), ["P"]);
  assert.equal(words.textContent, "Having seen the crowds.");
  page.destroy();
});

test("words that fit in three lines have no caret", async () => {
  wordsHeight = 60;
  const { page, row } = await mountOne(matthew5);
  await settle(5);
  const caret = row().querySelector(".desk-item__more");
  assert.ok(caret.hidden);
  assert.ok(!row().querySelector(".desk-item__pin-row--cut"));
  page.destroy();
});

test("words past three lines are cut, and the caret shows all of them and keeps them open through a redraw", async () => {
  wordsHeight = 200;
  const { page, row } = await mountOne(matthew5);
  await settle(5);
  let caret = row().querySelector(".desk-item__more");
  assert.ok(!caret.hidden, "a caret where the words are cut");
  assert.ok(row().querySelector(".desk-item__pin-row--cut"));
  assert.equal(caret.getAttribute("aria-expanded"), "false");
  assert.equal(caret.getAttribute("aria-label"), "Show all of Matthew 5:1–4");
  caret.click();
  await settle(5);
  assert.equal(caret.getAttribute("aria-expanded"), "true");
  assert.equal(caret.getAttribute("aria-label"), "Show less of Matthew 5:1–4");
  assert.ok(row().querySelector(".desk-item__pin-row--open"));
  assert.ok(!row().querySelector(".desk-item__pin-row--cut"), "no fade while open");
  assert.ok(!caret.hidden, "the caret stays to close it");
  // A redraw keeps it open for the visit.
  page.refresh();
  await until(() => row()?.querySelector(".desk-sheet__words p"), 3000, "the redraw");
  await settle(5);
  caret = row().querySelector(".desk-item__more");
  assert.equal(caret.getAttribute("aria-expanded"), "true");
  caret.click();
  await settle(5);
  assert.equal(caret.getAttribute("aria-expanded"), "false");
  assert.ok(row().querySelector(".desk-item__pin-row--cut"));
  page.destroy();
});

test("on paper every passage is whole and the caret is gone", () => {
  // The rows' rules are desk.css's, where the page and /desk's Collections
  // pane both read them (its "Collections (D13)" section).
  const desk = readFileSync(new URL("../src/styles/desk.css", import.meta.url), "utf8");
  const from = desk.indexOf("/* ── Collections (D13)");
  assert.ok(from > 0, "desk.css has the Collections section");
  const css = desk.slice(from, desk.indexOf("/* One sheet */", from));
  const print = css.slice(css.indexOf("@media print"));
  assert.ok(print.length > 0, "a print block");
  assert.match(print, /\.desk-item__pin-row \.desk-sheet__words \{[^}]*max-height: none;[^}]*mask-image: none;/);
  assert.match(print, /\.desk-item__more \{[^}]*display: none;/);
  // On screen the cut is three lines, and the words' own outer margins don't
  // count toward it: a last paragraph's margin would cut words that fit.
  assert.match(css, /\.desk-item__pin-row \.desk-sheet__words \{[^}]*max-height: 3lh;/);
  assert.match(css, /\.desk-sheet__words > :last-child > :last-child \{\s*margin-bottom: 0;/);
  assert.match(css, /\.desk-sheet__words > :first-child > :first-child \{\s*margin-top: 0;/);
});

test("the page carries the poetry blocks' description, as /sheets does", () => {
  const astro = readFileSync(new URL("../src/pages/collections.astro", import.meta.url), "utf8");
  assert.match(astro, /<div id="hbq-description" hidden>/);
});
