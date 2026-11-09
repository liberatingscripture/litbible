// The note editor, driven (Audit 8):
//   NB8-7   a paste stops at the limit, and a too-long body is named as such
//   GF8b-4  the tour's example editor leaves a kept draft alone

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom } from "./helpers/browser-env.mjs";
import { MAX_NOTE_BODY } from "../src/lib/desk-records.mjs";

const { openNoteEditor, setEditorPreview } = await import("../src/scripts/desk/note-editor.js");
const { closePanel } = await import("../src/scripts/lit-panel.js");

const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const draft = { bookKey: "john", chapter: 3, verse: 16, endVerse: 16 };
const DRAFT_KEY = "lit-desk-note-draft";

function open(store = {}) {
  closePanel({ force: true });
  resetDom();
  const trigger = document.body.appendChild(document.createElement("button"));
  return openNoteEditor({ trigger, store, ctx, ref: "John 3:16", draft, text: () => null });
}

test("NB8-7: the note's field takes no more than the limit", () => {
  setEditorPreview(null);
  const panel = open();
  assert.equal(panel.querySelector("textarea").maxLength, MAX_NOTE_BODY);
});

test("NB8-7: a body the store refuses as too long is named as such, and the words stay", async () => {
  setEditorPreview(null);
  const store = {
    save: async () => {
      throw new Error("desk-store: the note is too long");
    },
  };
  const panel = open(store);
  const body = panel.querySelector("textarea");
  body.value = "my words";
  panel.querySelector(".desk-editor__save").click();
  await settle(20);
  const error = panel.querySelector(".desk-editor__error");
  assert.equal(error.hidden, false);
  assert.match(error.textContent, /too long to keep/);
  assert.ok(error.textContent.includes(MAX_NOTE_BODY.toLocaleString("en-US")));
  assert.equal(body.value, "my words");
});

test("NB8-7: any other failure gets the plain sentence, not the length one", async () => {
  setEditorPreview(null);
  const panel = open({ save: async () => { throw new Error("quota"); } });
  panel.querySelector("textarea").value = "x";
  panel.querySelector(".desk-editor__save").click();
  await settle(20);
  assert.match(panel.querySelector(".desk-editor__error").textContent, /couldn’t be saved in this browser/);
});

test("GF8b-4: the tour's example editor leaves a kept draft alone when it closes", () => {
  closePanel({ force: true }); // an editor an earlier test left open clears the draft as it closes
  const kept = JSON.stringify({ key: `new:${JSON.stringify(["john", 3, 16, 16, null, null, null, null])}`, body: "my unsaved words", marker: "note" });
  sessionStorage.setItem(DRAFT_KEY, kept);
  setEditorPreview("An example note.");
  try {
    const panel = open();
    assert.equal(panel.querySelector("textarea").value, "An example note.", "the example's words, not the draft");
    closePanel({ force: true });
    assert.equal(sessionStorage.getItem(DRAFT_KEY), kept, "the draft is still there");
  } finally {
    setEditorPreview(null);
  }
});

test("GF8b-4: an ordinary editor brings a kept draft back and clears it when it closes", () => {
  closePanel({ force: true });
  const key = `new:${JSON.stringify(["john", 3, 16, 16, null, null, null, null])}`;
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ key, body: "my unsaved words", marker: "note" }));
  setEditorPreview(null);
  const panel = open();
  assert.equal(panel.querySelector("textarea").value, "my unsaved words");
  closePanel({ force: true });
  assert.equal(sessionStorage.getItem(DRAFT_KEY), null);
});
