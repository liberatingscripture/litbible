// The margin's circle popover, driven (Audit 8, NB8-5): while an editor holds
// unsaved words, pressing a circle opens nothing, so the circle must not be
// marked expanded.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom } from "./helpers/browser-env.mjs";
import { createRecord } from "../src/lib/desk-records.mjs";

const { createNotesMargin } = await import("../src/scripts/desk/notes-margin.js");
const { openNoteEditor } = await import("../src/scripts/desk/note-editor.js");
const { currentPanel, closePanel } = await import("../src/scripts/lit-panel.js");

const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const note = createRecord("note", { bookKey: "john", chapter: 3, verse: 16, endVerse: 16, body: "mine", marker: "note" }, { now: "2026-11-09T12:00:00.000Z", ...ctx() });

function margin() {
  resetDom();
  closePanel({ force: true });
  document.body.innerHTML = `<div class="chapter-paragraphs"><p id="line">For God so loved the world.</p></div>`;
  const textBox = document.querySelector(".chapter-paragraphs");
  // Room in the margin for circles but not for notes in full.
  textBox.getBoundingClientRect = () => ({ left: 100, right: 700, top: 0, bottom: 100, width: 600, height: 100 });
  const range = document.createRange();
  range.selectNodeContents(document.getElementById("line"));
  const source = {
    textBox,
    lineEl: () => document.getElementById("line"),
    owns: () => true,
    placed: (records) => records.map((record) => ({ record, range })),
    load: async () => ({ notes: [note], bookmarks: [], highlights: [] }),
  };
  const store = { subscribe: () => () => {}, all: async () => [], byChapter: async () => [] };
  createNotesMargin({ store, source, onEdit: () => {} });
  return { store };
}

test("NB8-5: a circle pressed while an editor holds unsaved words opens nothing and isn't marked expanded", async () => {
  const { store } = margin();
  await settle(30);
  const circle = document.querySelector(".desk-circle");
  assert.ok(circle, "the note is drawn as a circle");
  // An editor with words typed in it.
  const trigger = document.body.appendChild(document.createElement("button"));
  const editor = openNoteEditor({ trigger, store, ctx, ref: "John 3:16", draft: { bookKey: "john", chapter: 3, verse: 16, endVerse: 16 }, text: () => null });
  const body = editor.querySelector("textarea");
  body.value = "unsaved";
  body.dispatchEvent(new Event("input", { bubbles: true }));
  assert.equal(currentPanel()?.el, editor);
  circle.click();
  await settle(10);
  assert.equal(currentPanel()?.el, editor, "the editor kept the panel");
  assert.notEqual(circle.getAttribute("aria-expanded"), "true", "the circle that opened nothing is not expanded");
  assert.equal(document.querySelector(".desk-note-pop"), null);
});

test("NB8-5: with nothing in the way, the circle opens its popover and is marked expanded", async () => {
  margin();
  await settle(30);
  const circle = document.querySelector(".desk-circle");
  circle.click();
  await settle(10);
  assert.ok(document.querySelector(".desk-note-pop"));
  assert.equal(circle.getAttribute("aria-expanded"), "true");
});
