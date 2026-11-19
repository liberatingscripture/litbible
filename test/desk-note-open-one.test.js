// test/desk-note-open-one.test.js
//
// E156: a margin note opened by a click stays open until the reader opens
// another one or clicks anywhere outside it, so one is open at a time. Driven
// on the real notes-margin.js (the harness is the one the other margin tests
// use); what a note looks like open is CSS, so what is held here is the class,
// aria-expanded, and which clicks count as outside.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom } from "./helpers/browser-env.mjs";
import { createRecord } from "../src/lib/desk-records.mjs";

const { createNotesMargin } = await import("../src/scripts/desk/notes-margin.js");

const ctx = () => ({ now: "2026-11-18T12:00:00.000Z", client: "web/test", contentVersion: "v1" });
const note = (body, verse) =>
  createRecord("note", { bookKey: "john", chapter: 3, verse, endVerse: verse, body, marker: "note" }, ctx());

async function margin(n, { onEdit = () => {} } = {}) {
  resetDom();
  document.body.innerHTML = `<div class="chapter-paragraphs"><p id="line">For God so loved the world.</p></div>`;
  const textBox = document.querySelector(".chapter-paragraphs");
  textBox.getBoundingClientRect = () => ({ left: 400, right: 1000, top: 0, bottom: 5000, width: 600, height: 5000 });
  const range = document.createRange();
  range.selectNodeContents(document.getElementById("line"));
  const notes = Array.from({ length: n }, (_, i) => note(`note ${i}`, 16 + i));
  const source = {
    textBox,
    lineEl: () => document.getElementById("line"),
    owns: () => true,
    placed: (records) => records.map((record) => ({ record, range })),
    load: async () => ({ notes, bookmarks: [], highlights: [] }),
  };
  const store = { subscribe: () => () => {}, all: async () => [], byChapter: async () => [] };
  createNotesMargin({ store, source, onEdit });
  await settle(30);
}

const cards = () => [...document.querySelectorAll(".desk-notes .desk-note")];
const toggle = (el) => el.querySelector(".desk-note__hit");
const isOpen = (el) => el.classList.contains("desk-note--open");
const told = (el) => toggle(el).getAttribute("aria-expanded");

test("opening a second note folds the first, in the drawing and for a screen reader", async () => {
  await margin(3);
  const [a, b, c] = cards();
  toggle(a).click();
  assert.ok(isOpen(a));
  assert.equal(told(a), "true");
  toggle(b).click();
  assert.ok(!isOpen(a), "the first is folded");
  assert.equal(told(a), "false");
  assert.ok(isOpen(b));
  assert.equal(told(b), "true");
  toggle(c).click();
  assert.deepEqual(cards().map(isOpen), [false, false, true], "one open at a time");
});

test("pressing the open note again folds it", async () => {
  await margin(2);
  const [a] = cards();
  toggle(a).click();
  toggle(a).click();
  assert.ok(!isOpen(a));
  assert.equal(told(a), "false");
});

test("a click anywhere outside the open note folds it", async () => {
  await margin(2);
  const [a] = cards();
  toggle(a).click();
  document.getElementById("line").click();
  assert.ok(!isOpen(a), "a click on the scripture");
  assert.equal(told(a), "false");
  toggle(a).click();
  assert.ok(isOpen(a), "and it opens again");
  document.body.click();
  assert.ok(!isOpen(a), "a click on the page itself");
});

test("a control that stops its own click still counts as outside", async () => {
  await margin(1);
  const [a] = cards();
  const button = document.createElement("button");
  button.addEventListener("click", (e) => e.stopPropagation());
  document.body.append(button);
  toggle(a).click();
  button.click();
  assert.ok(!isOpen(a));
});

test("Edit on the open note is inside it: the note stays open while its editor opens", async () => {
  const edits = [];
  await margin(2, { onEdit: (record) => edits.push(record.body) });
  const [a] = cards();
  toggle(a).click();
  a.querySelector(".desk-note__edit").click();
  assert.deepEqual(edits, ["note 0"]);
  assert.ok(isOpen(a));
});

test("a click inside a floating panel is not outside: the editor or card the note opened", async () => {
  await margin(1);
  const [a] = cards();
  const panel = document.createElement("div");
  panel.className = "lit-panel";
  panel.innerHTML = `<textarea></textarea>`;
  document.body.append(panel);
  toggle(a).click();
  panel.querySelector("textarea").click();
  assert.ok(isOpen(a));
});

test("a click with no note open changes nothing", async () => {
  await margin(2);
  document.getElementById("line").click();
  assert.deepEqual(cards().map(isOpen), [false, false]);
  assert.deepEqual(cards().map(told), ["false", "false"]);
});
