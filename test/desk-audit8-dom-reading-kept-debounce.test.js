// The notebook list waits for the next key before filtering (Audit 8, GF8b-8
// and NB8-4): typing redraws once the typing pauses, and the browser's own
// clear (a `search` event) redraws at once.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom } from "./helpers/browser-env.mjs";
import { createRecord } from "../src/lib/desk-records.mjs";

const { createKeptList } = await import("../src/scripts/desk/kept-list.js");
const { createMineTab } = await import("../src/scripts/desk/tab-mine.js");

const ctx = () => ({ now: "2026-11-09T12:00:00.000Z", client: "web/test", contentVersion: "v1" });
const note = (body, verse) =>
  createRecord("note", { bookKey: "john", chapter: 3, verse, endVerse: verse, body, marker: "note" }, ctx());
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = (list) => list.el.querySelectorAll("[data-id]").length;

async function listOfTwo() {
  resetDom();
  const records = [note("light", 19), note("darkness", 19)];
  const store = { all: async () => records, subscribe: () => () => {}, lastEntry: () => null };
  const list = createKeptList({ store, ctx });
  document.body.append(list.el);
  await list.render();
  await settle();
  assert.equal(rows(list), 2);
  return list;
}

function type(list, value) {
  const box = list.el.querySelector('input[type="search"]');
  box.value = value;
  box.dispatchEvent(new Event("input", { bubbles: true }));
  return box;
}

test("GF8b-8: typing filters only once the typing pauses, and each key restarts the wait", async () => {
  const list = await listOfTwo();
  type(list, "l");
  await wait(100);
  type(list, "li");
  await wait(100);
  assert.equal(rows(list), 2, "200 ms in, but never 150 ms since the last key: nothing redrawn");
  await wait(120);
  await settle();
  assert.equal(rows(list), 1, "150 ms after the last key it filters");
});

test("GF8b-8: the browser's own clear filters at once, with no wait", async () => {
  const list = await listOfTwo();
  const box = type(list, "light");
  await wait(150 + 120);
  await settle();
  assert.equal(rows(list), 1);
  box.value = "";
  box.dispatchEvent(new Event("search", { bubbles: true }));
  await settle();
  assert.equal(rows(list), 2, "the clear redrew without waiting for a timer");
});

// My Notes (tab-mine.js) waits the same way.
async function mineOfTwo() {
  resetDom();
  const records = [note("light", 19), note("darkness", 19)];
  const store = {
    all: async () => records,
    byChapter: async () => records,
    get: async () => null,
    getMeta: async () => null,
    subscribe: () => () => {},
    onMeta: () => () => {},
    lastEntry: () => null,
  };
  const tab = createMineTab({ store, storeError: null, inReadView: false, visible: () => true });
  document.body.append(tab.el);
  await tab.render();
  await settle();
  const count = () => tab.el.querySelectorAll("li[data-id]").length;
  assert.equal(count(), 2);
  return { tab, count, box: tab.el.querySelector('input[type="search"]') };
}

test("NB8-4: My Notes filters only once the typing pauses, and a `search` event filters at once", async () => {
  const { count, box } = await mineOfTwo();
  const type = (value) => {
    box.value = value;
    box.dispatchEvent(new Event("input", { bubbles: true }));
  };
  type("l");
  await wait(100);
  type("li");
  await wait(100);
  assert.equal(count(), 2, "200 ms in, but never 150 ms since the last key: nothing redrawn");
  await wait(120);
  await settle();
  assert.equal(count(), 1, "150 ms after the last key it filters");
  box.value = "";
  box.dispatchEvent(new Event("search", { bubbles: true }));
  await settle();
  assert.equal(count(), 2, "the browser's clear redraws without waiting");
});
