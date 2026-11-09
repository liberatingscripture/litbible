// NB8-2 driven: a bookmark, highlight or pin that fails to save says so in the
// undo bar's notice instead of failing silently, and a failed bookmark press
// leaves the verse menu open and the button usable again.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { settle, resetDom } from "./helpers/browser-env.mjs";
import { prepareStudyParagraph } from "../src/lib/chapter-html.ts";

const john3 = JSON.parse(readFileSync(new URL("../src/data/chapters/john-3.json", import.meta.url), "utf8"));
const ctx = () => ({ client: "web/test", contentVersion: "v1" });

/** John 3 as Chapter View renders it, footnotes list included. */
function chapterPage() {
  const seen = new Set();
  const state = { currentVerse: null };
  const body = john3.paragraphs.map((p) => `<div class="p">${prepareStudyParagraph(p, "john", 3, seen, state)}</div>`).join("");
  const notes = john3.footnotes
    .map((f) => `<li id="${f.id}"><span class="fn-body">${f.html}</span> <a class="footnote-backlink" href="#${f.refId}">${f.label}</a></li>`)
    .join("");
  document.body.innerHTML = `
    <main><div class="scripture-layout scripture-layout--scripture"><div class="scripture-main">
      <h1 id="chapter-title">John 3</h1>
      <article class="chapter" data-last-read-book="john" data-last-read-chapter="3">
        <div class="chapter-paragraphs">${body}</div>
        <section class="footnotes-wrap"><ol class="footnotes">${notes}</ol></section>
      </article>
    </div></div></main>`;
}

/** An empty page of John 3; the undo bar, built once per process, is kept and cleared. */
function fresh() {
  const bar = document.querySelector(".desk-undo");
  resetDom();
  chapterPage();
  if (bar) {
    bar.querySelector(".desk-undo__text").textContent = "";
    bar.querySelector(".desk-undo__bar").hidden = true;
    document.body.append(bar);
  }
}

/** A notebook whose writes all fail. */
function failingStore() {
  const fail = async () => {
    throw new Error("quota");
  };
  return {
    byChapter: async () => [],
    byKind: async () => [],
    all: async () => [],
    get: async () => null,
    change: fail,
    save: fail,
    remove: fail,
    lastEntry: () => null,
    subscribe: () => () => {},
    onEntry: () => () => {},
  };
}

const barText = () => document.querySelector(".desk-undo__text")?.textContent ?? "";
const barShown = () => document.querySelector(".desk-undo__bar")?.hidden === false;

async function openMenu({ kind = "verse" } = {}) {
  const { showPanel } = await import("../src/scripts/lit-panel.js");
  const panel = document.createElement("div");
  const trigger = document.querySelector("#v16");
  showPanel(trigger, panel);
  let closed = false;
  const detail = {
    view: "study",
    kind,
    start: 16,
    end: 16,
    panel,
    append: (el) => panel.append(el),
    acting: () => {},
  };
  document.dispatchEvent(new CustomEvent("lit:panel-actions", { detail }));
  await settle(20);
  return { panel, closedNow: () => closed || !panel.isConnected };
}

test("NB8-2: a bookmark that can't be saved shows the notice, keeps the menu open and frees the button", async () => {
  fresh();
  const { initActions } = await import("../src/scripts/desk/actions.js");
  initActions({ store: failingStore(), ctx });
  const { panel, closedNow } = await openMenu();
  const add = [...panel.querySelectorAll("button")].find((b) => b.textContent === "Add bookmark");
  assert.ok(add, "the menu offers Add bookmark");
  add.click();
  await settle(20);
  assert.match(barText(), /couldn’t be saved in this browser, so nothing changed/);
  assert.ok(barShown(), "the bar is showing");
  assert.equal(closedNow(), false, "the menu stays open");
  assert.equal(add.hasAttribute("aria-disabled"), false, "the button can be pressed again");
});

test("NB8-2: a highlight that can't be saved shows the notice", async () => {
  fresh();
  CSS.highlights = new Map();
  globalThis.Highlight = class Highlight {};
  const { initActions } = await import("../src/scripts/desk/actions.js");
  initActions({ store: failingStore(), ctx });
  const { panel } = await openMenu();
  const swatch = panel.querySelector(".desk-swatch");
  assert.ok(swatch, "the menu offers a highlight swatch");
  swatch.click();
  await settle(20);
  assert.match(barText(), /highlight couldn’t be saved in this browser, so nothing changed/);
});

test("NB8-2: a pin that can't be saved shows the notice and frees the button", async () => {
  fresh();
  const { initPins } = await import("../src/scripts/desk/pins.js");
  assert.ok(initPins({ store: failingStore(), ctx }));
  await settle(20);
  const pin = document.querySelector("button[data-desk-pin]");
  assert.ok(pin, "a footnote has its Pin button");
  pin.click();
  await settle(20);
  assert.match(barText(), /pin couldn’t be saved in this browser, so nothing changed/);
  assert.equal(pin.hasAttribute("aria-disabled"), false, "the button is free again");
});
