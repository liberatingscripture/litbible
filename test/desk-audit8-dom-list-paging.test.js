// "Show N more" on the notebook page's list (kept-list.js) and the margin's
// "N more notes" (notes-margin.js), driven (Audit 8, LG8-2 and GF8b-6).

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom } from "./helpers/browser-env.mjs";
import { createRecord } from "../src/lib/desk-records.mjs";

const { createKeptList } = await import("../src/scripts/desk/kept-list.js");
const { createNotesMargin } = await import("../src/scripts/desk/notes-margin.js");

const ctx = () => ({ now: "2026-11-09T12:00:00.000Z", client: "web/test", contentVersion: "v1" });
const note = (body, chapter, verse) =>
  createRecord("note", { bookKey: "john", chapter, verse, endVerse: verse, body, marker: "note" }, ctx());

async function keptList(records) {
  const store = { all: async () => records, subscribe: () => () => {}, lastEntry: () => null };
  const list = createKeptList({ store, ctx });
  document.body.append(list.el);
  await list.render();
  await settle();
  return list;
}
const rows = (list) => list.el.querySelectorAll(".desk-item");

test("the notebook page draws 200 rows, then Show 37 more, with the count over the whole list", async () => {
  resetDom();
  const records = Array.from({ length: 237 }, (_, i) => note(`word ${i}`, 1 + (i % 3), 1 + Math.floor(i / 3)));
  const list = await keptList(records);
  assert.equal(rows(list).length, 200);
  assert.match(list.el.querySelector("[data-np-count]").textContent, /237/);
  const more = list.el.querySelector(".desk-np__more");
  assert.equal(more.textContent, "Show 37 more");
  more.click();
  await settle();
  assert.equal(rows(list).length, 237);
  assert.equal(list.el.querySelector(".desk-np__more"), null);
  assert.ok(list.el.contains(document.activeElement), "focus stays in the list");
});

test("a search starts at the first page again", async () => {
  resetDom();
  const records = Array.from({ length: 450 }, (_, i) => note(i < 300 ? `grace ${i}` : `peace ${i}`, 1, 1 + (i % 30)));
  const list = await keptList(records);
  list.el.querySelector(".desk-np__more").click();
  await settle();
  assert.equal(rows(list).length, 400);
  list.setQuery("grace");
  await list.render({ reuse: true });
  assert.equal(rows(list).length, 200, "back to one page of the 300 that match");
  assert.equal(list.el.querySelector(".desk-np__more").textContent, "Show 100 more");
});

function margin(n, { showVerse = () => {} } = {}) {
  resetDom();
  document.body.innerHTML = `<div class="chapter-paragraphs"><p id="line">For God so loved the world.</p></div>`;
  const textBox = document.querySelector(".chapter-paragraphs");
  textBox.getBoundingClientRect = () => ({ left: 400, right: 1000, top: 0, bottom: 5000, width: 600, height: 5000 });
  const range = document.createRange();
  range.selectNodeContents(document.getElementById("line"));
  const notes = Array.from({ length: n }, (_, i) => note(`note ${i}`, 3, 16));
  const source = {
    textBox,
    lineEl: () => document.getElementById("line"),
    owns: () => true,
    placed: (records) => records.map((record) => ({ record, range })),
    load: async () => ({ notes, bookmarks: [], highlights: [] }),
  };
  const store = { subscribe: () => () => {}, all: async () => [], byChapter: async () => [] };
  createNotesMargin({ store, source, onEdit: () => {}, showVerse });
}

test("eight notes on one verse draw five and a button naming the verse, which opens This verse", async () => {
  const opened = [];
  margin(8, { showVerse: (v) => opened.push(v) });
  await settle(30);
  assert.equal(document.querySelectorAll(".desk-note").length, 5);
  const button = document.querySelector("button.desk-note__more");
  assert.ok(button);
  assert.equal(button.textContent, "3 more notes");
  assert.equal(button.getAttribute("aria-label"), "3 more notes on John 3:16");
  button.click();
  assert.deepEqual(opened, [16]);
});

test("five notes draw no button, and with no This verse to open every note is drawn", async () => {
  margin(5);
  await settle(30);
  assert.equal(document.querySelector("button.desk-note__more"), null);
  margin(8, { showVerse: null });
  await settle(30);
  assert.equal(document.querySelectorAll(".desk-note").length, 8);
  assert.equal(document.querySelector("button.desk-note__more"), null);
});
