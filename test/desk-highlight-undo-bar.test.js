// E144 driven: every highlight that changes the notebook puts up the undo bar,
// a plain new one included, over the real notebook store on fake-indexeddb.
// Until 2026-11-17 only a removal or a colour cutting into another did, so in
// Chrome on a laptop BVJ saw no bar after a highlight unless it overlapped an
// earlier one.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { settle } from "./helpers/browser-env.mjs";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { prepareStudyParagraph } from "../src/lib/chapter-html.ts";

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
// The CSS Custom Highlight API, which the desk needs before it offers Highlight.
CSS.highlights = new Map();
globalThis.Highlight = class Highlight {};

const john3 = JSON.parse(readFileSync(new URL("../src/data/chapters/john-3.json", import.meta.url), "utf8"));
const ctx = () => ({ client: "web/test", contentVersion: "v1" });

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
const { initActions } = await import("../src/scripts/desk/actions.js");
const { hideUndo } = await import("../src/scripts/desk/undo-bar.js");
const { showPanel } = await import("../src/scripts/lit-panel.js");

const store = await openStore({ ctx });
createHistory({ store, ctx });
initActions({ store, ctx });

const bar = () => document.querySelector(".desk-undo__bar");
const barText = () => document.querySelector(".desk-undo__text")?.textContent ?? "";
const undoButton = () => document.querySelector(".desk-undo__undo");
const live = () => document.querySelector("[data-undo-live]")?.textContent ?? "";
const highlights = async () => (await store.byChapter("john", 3)).filter((r) => r.kind === "highlight");

/** Waits until `fn()` (which may be async) is truthy, or fails after `ms`. */
async function until(fn, what, ms = 3000) {
  const end = Date.now() + ms;
  while (!(await fn())) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await settle(10);
  }
}

/** Open the verse menu on `start`–`end` and press a colour in its Highlight row. */
async function highlight(start, end, color) {
  const panel = document.createElement("div");
  showPanel(document.querySelector(`#v${start}`), panel);
  const detail = { view: "study", kind: "verse", start, end, panel, append: (el) => panel.append(el), acting: () => {} };
  document.dispatchEvent(new CustomEvent("lit:panel-actions", { detail }));
  const swatch = panel.querySelector(`.desk-swatch[aria-label="Highlight ${color}"]`);
  assert.ok(swatch, `the menu offers a ${color} swatch`);
  swatch.click();
  await until(() => !panel.isConnected, "the menu to close after the press");
  await settle(80); // the bar's spoken notice lands after a short timeout
}

beforeEach(() => hideUndo());

test("E144: the first highlight in an empty notebook shows the undo bar, and its Undo takes the highlight off", async () => {
  await highlight(16, 16, "yellow");
  assert.equal(bar().hidden, false, "the bar is showing");
  assert.equal(barText(), "John 3:16 highlighted yellow.");
  assert.equal(undoButton().textContent, "Undo");
  assert.equal(undoButton().hidden, false);
  assert.match(live(), /^John 3:16 highlighted yellow\. Press (Ctrl\+Z|⌘Z) to undo\.$/, "it is still announced (BA18)");
  assert.equal((await highlights()).length, 1);

  undoButton().click();
  await until(async () => (await highlights()).length === 0, "the highlight to be taken off");
  await until(() => /^Undone:/.test(barText()), "the bar to say it was undone");
  assert.equal(undoButton().textContent, "Redo");
});

test("E144: a plain highlight after earlier marks shows the bar too", async () => {
  await highlight(17, 17, "yellow");
  assert.equal(bar().hidden, false);
  hideUndo();
  // Apart from the yellow on 3:17, touching no other colour.
  await highlight(19, 19, "green");
  assert.equal(bar().hidden, false, "the bar is showing for the second highlight");
  assert.equal(barText(), "John 3:19 highlighted green.");
  assert.equal(undoButton().textContent, "Undo");
});

test("E144: widening a highlight of the same colour shows the bar", async () => {
  await highlight(17, 18, "yellow");
  assert.equal(bar().hidden, false);
  assert.equal(barText(), "John 3:17–18 highlighted yellow.");
});

test("a colour over another still shows the bar, and a press that changes nothing shows none", async () => {
  await highlight(21, 21, "green");
  hideUndo();
  await highlight(21, 21, "pink");
  assert.equal(bar().hidden, false);
  assert.equal(barText(), "John 3:21 highlighted pink.");
  hideUndo();
  await highlight(21, 21, "pink");
  assert.equal(bar().hidden, true, "the words were already pink, so nothing was written and nothing is offered");
});
