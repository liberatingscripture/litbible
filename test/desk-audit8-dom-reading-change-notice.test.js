// The change notice's card, driven (Audit 8):
//   NB8-8    Keep and Delete stay focusable and aria-disabled while they work,
//            and a press while busy does nothing
//   GF8b-10  a card's result closes only its own card, and a failure after the
//            card has gone is told in the bar instead

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { settle, resetDom } from "./helpers/browser-env.mjs";
import { createRecord } from "../src/lib/desk-records.mjs";
import { prepareStudyParagraph } from "../src/lib/chapter-html.ts";

const { openNotice } = await import("../src/scripts/desk/change-notice.js");
const { showPanel, currentPanel } = await import("../src/scripts/lit-panel.js");

const john3 = JSON.parse(readFileSync(new URL("../src/data/chapters/john-3.json", import.meta.url), "utf8"));
const ctx = () => ({ client: "web/test", contentVersion: "v1" });

function page() {
  const bar = document.querySelector(".desk-undo");
  resetDom();
  const seen = new Set();
  const state = { currentVerse: null };
  const body = john3.paragraphs.map((p) => `<div class="p">${prepareStudyParagraph(p, "john", 3, seen, state)}</div>`).join("");
  document.documentElement.dataset.contentVersion = "v1";
  document.body.innerHTML = `<article class="chapter" data-last-read-book="john" data-last-read-chapter="3"><div class="chapter-paragraphs">${body}</div></article>`;
  if (bar) {
    bar.querySelector(".desk-undo__text").textContent = "";
    bar.querySelector(".desk-undo__bar").hidden = true;
    document.body.append(bar);
  }
}

/** A note on John 3:16 whose verse read differently when it was made, so it carries a notice. */
const oldNote = () =>
  createRecord(
    "note",
    { bookKey: "john", chapter: 3, verse: 16, endVerse: 16, body: "mine", marker: "note", verseCopy: "For God so loved something else entirely." },
    { now: "2026-11-01T12:00:00.000Z", ...ctx() },
  );

/** A notebook whose reads and writes wait for the test. */
function heldStore(record) {
  const store = {
    held: [],
    removes: 0,
    gets: 0,
    get: () => {
      store.gets++;
      return new Promise((resolve, reject) => store.held.push({ resolve, reject, value: record }));
    },
    remove: () => {
      store.removes++;
      return new Promise((resolve, reject) => store.held.push({ resolve, reject }));
    },
    change: async () => {},
    lastEntry: () => null,
  };
  return store;
}

function open(store, record) {
  page();
  const trigger = document.body.appendChild(document.createElement("button"));
  const panel = openNotice(trigger, record, { store, ctx });
  assert.ok(panel, "the note carries a notice on this page");
  return {
    panel,
    keep: panel.querySelector(".desk-notice__keep"),
    del: panel.querySelector(".desk-notice__delete"),
    error: panel.querySelector(".desk-notice__error"),
  };
}

const barText = () => document.querySelector(".desk-undo__text")?.textContent ?? "";

test("NB8-8: Keep and Delete go aria-disabled (not disabled) while Keep works, focus stays, and presses are ignored", async () => {
  const record = oldNote();
  const store = heldStore(record);
  const { keep, del } = open(store, record);
  assert.ok(keep, "the card offers Keep");
  keep.focus();
  keep.click();
  await settle(10);
  assert.equal(store.gets, 1);
  for (const b of [keep, del]) {
    assert.equal(b.getAttribute("aria-disabled"), "true");
    assert.equal(b.disabled, false);
  }
  assert.equal(document.activeElement, keep, "focus stays on Keep");
  keep.click();
  del.click();
  await settle(10);
  assert.equal(store.gets, 1, "a second Keep does nothing");
  assert.equal(store.removes, 0, "Delete does nothing while Keep works");
});

test("NB8-8: a failed Delete leaves the buttons pressable again, with focus where it was, and says why on the card", async () => {
  const record = oldNote();
  const store = heldStore(record);
  const { del, keep, error } = open(store, record);
  del.focus();
  del.click();
  await settle(10);
  assert.equal(del.getAttribute("aria-disabled"), "true");
  store.held[0].reject(new Error("quota"));
  await settle(10);
  assert.equal(del.hasAttribute("aria-disabled"), false);
  assert.equal(keep.hasAttribute("aria-disabled"), false);
  assert.equal(document.activeElement, del);
  assert.equal(error.hidden, false);
  assert.match(error.textContent, /so it is still in your notebook/);
});

test("GF8b-10: a result closes only its own card; another panel opened meanwhile stays", async () => {
  const record = oldNote();
  const store = heldStore(record);
  const { panel, del } = open(store, record);
  del.click();
  await settle(10);
  // The card is replaced by another panel while the delete is still running.
  const other = document.createElement("div");
  other.textContent = "another panel";
  showPanel(document.body.querySelector("button"), other);
  assert.equal(currentPanel()?.el, other);
  store.held[0].resolve(null);
  await settle(10);
  assert.equal(currentPanel()?.el, other, "the other panel was not closed by the card's result");
  assert.ok(other.isConnected);
  assert.equal(panel.isConnected, false);
});

test("GF8b-10: a failure after the card has gone is told in the bar", async () => {
  const record = oldNote();
  const store = heldStore(record);
  const { del } = open(store, record);
  del.click();
  await settle(10);
  const { closePanel } = await import("../src/scripts/lit-panel.js");
  closePanel();
  store.held[0].reject(new Error("quota"));
  await settle(10);
  assert.match(barText(), /so it is still in your notebook/);
});

test("GF8b-10: Keep's version check is bounded, so a stalled request can't hold the buttons", async () => {
  const record = oldNote();
  const store = heldStore(record);
  const seen = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (url, init) => {
    seen.push({ url: String(url), signal: init?.signal });
    return new Promise(() => {}); // never answers
  };
  try {
    // Two publishes on one day can't be ordered, so Keep asks the site for its version.
    record.contentVersion = "v20261109.aaaaaaaa";
    const { keep } = open(store, record);
    document.documentElement.dataset.contentVersion = "v20261109.bbbbbbbb";
    keep.click();
    await settle(10);
    store.held[0].resolve(record);
    await settle(30);
    const version = seen.find((r) => r.url.includes("/api/version.json"));
    assert.ok(version, "the page asked the site for its version");
    assert.ok(version.signal instanceof AbortSignal, "with a timeout signal");
  } finally {
    globalThis.fetch = realFetch;
  }
});
