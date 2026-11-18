// E146 driven: when the note editor asks about unsaved words, its row is
// Close without saving, Cancel and Save, and Cancel cancels the closing
// (BVJ, 2026-11-17: "I would expect cancel to *cancel closing the note
// dialogue*"). Until then the asking Cancel discarded the words. A second ×,
// Escape, verse number or footnote letter still discards (NB-2).

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { resetDom } from "./helpers/browser-env.mjs";

const { openNoteEditor, setEditorPreview } = await import("../src/scripts/desk/note-editor.js");
const { closePanel, holdPanel, currentPanel } = await import("../src/scripts/lit-panel.js");

const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const draft = { bookKey: "john", chapter: 3, verse: 16, endVerse: 16 };
const DRAFT_KEY = "lit-desk-note-draft";

function open({ record } = {}) {
  const trigger = document.body.appendChild(document.createElement("button"));
  return openNoteEditor({ trigger, store: {}, ctx, ref: "John 3:16", draft, record, text: () => null });
}

const parts = (panel) => ({
  body: panel.querySelector("textarea"),
  discard: panel.querySelector(".desk-editor__discard"),
  cancel: panel.querySelector(".desk-editor__cancel"),
  close: panel.querySelector(".lit-panel__close"),
  del: panel.querySelector(".desk-editor__delete"),
  message: panel.querySelector(".desk-editor__error"),
});

function type(body, words) {
  body.value = words;
  body.dispatchEvent(new Event("input", { bubbles: true }));
}

/** The labels of the buttons a reader sees in the row, in order. */
const row = (panel) =>
  [...panel.querySelectorAll(".desk-editor__actions button")].filter((b) => !b.hidden).map((b) => b.textContent);

beforeEach(() => {
  closePanel({ force: true });
  sessionStorage.removeItem(DRAFT_KEY);
  setEditorPreview(null);
  resetDom();
});

test("E146: an editor holding no words closes on Cancel at once, and offers no Close without saving", () => {
  const panel = open();
  assert.deepEqual(row(panel), ["Cancel", "Save"]);
  parts(panel).cancel.click();
  assert.equal(panel.isConnected, false);
});

test("E146: Cancel with words asks, and the row becomes Close without saving, Cancel, Save", () => {
  const panel = open();
  const { body, cancel, message } = parts(panel);
  type(body, "my words");
  cancel.click();
  assert.equal(panel.isConnected, true, "the editor stays");
  assert.deepEqual(row(panel), ["Close without saving", "Cancel", "Save"]);
  assert.equal(message.hidden, false);
  assert.match(message.textContent, /aren’t saved yet.*close without saving.*Cancel to keep writing/);
});

test("E146: Cancel while it asks keeps the editor and the words, and puts the row back", () => {
  const panel = open();
  const { body, cancel, message } = parts(panel);
  type(body, "my words");
  cancel.click();
  cancel.click();
  assert.equal(panel.isConnected, true, "Cancel cancelled the closing");
  assert.equal(body.value, "my words");
  assert.deepEqual(row(panel), ["Cancel", "Save"]);
  assert.equal(message.hidden, true);
  assert.equal(document.activeElement, body, "back to writing");
  assert.ok(JSON.parse(sessionStorage.getItem(DRAFT_KEY)).body === "my words", "the draft is still kept");
  // Asked again, it asks again rather than discarding.
  cancel.click();
  assert.equal(panel.isConnected, true);
  assert.deepEqual(row(panel), ["Close without saving", "Cancel", "Save"]);
});

test("E146: Close without saving closes and forgets the words", () => {
  const panel = open();
  const { body, cancel, discard } = parts(panel);
  type(body, "my words");
  cancel.click();
  discard.click();
  assert.equal(panel.isConnected, false);
  assert.equal(currentPanel(), null);
  assert.equal(sessionStorage.getItem(DRAFT_KEY), null);
});

test("E146: writing on answers the question as Cancel does", () => {
  const panel = open();
  const { body, cancel, message } = parts(panel);
  type(body, "my words");
  cancel.click();
  type(body, "my words, and more");
  assert.deepEqual(row(panel), ["Cancel", "Save"]);
  assert.equal(message.hidden, true);
  cancel.click();
  assert.equal(panel.isConnected, true, "a fresh ask, not a discard");
});

test("E146: a verse number pressed over the editor asks with the same three buttons, and Cancel keeps writing", () => {
  const panel = open();
  const { body, cancel } = parts(panel);
  type(body, "my words");
  assert.equal(holdPanel(), true, "a verse number is held off once");
  assert.deepEqual(row(panel), ["Close without saving", "Cancel", "Save"]);
  cancel.click();
  assert.equal(panel.isConnected, true);
  assert.equal(body.value, "my words");
  assert.equal(holdPanel(), true, "the next verse number asks again");
});

test("NB-2 still: a second × with nothing typed between discards, so asking never traps anyone", () => {
  const panel = open();
  const { body, close } = parts(panel);
  type(body, "my words");
  close.click();
  assert.equal(panel.isConnected, true);
  close.click();
  assert.equal(panel.isConnected, false);
});

test("E146: editing a note, Delete stands aside while it asks and comes back after", () => {
  const record = { id: "n1", kind: "note", bookKey: "john", chapter: 3, verse: 16, endVerse: 16, body: "kept", marker: "note" };
  const panel = open({ record });
  const { body, cancel } = parts(panel);
  assert.deepEqual(row(panel), ["Delete", "Cancel", "Save"]);
  type(body, "kept, and changed");
  cancel.click();
  assert.deepEqual(row(panel), ["Close without saving", "Cancel", "Save"], "one button on the left, never Delete beside a discard");
  cancel.click();
  assert.deepEqual(row(panel), ["Delete", "Cancel", "Save"]);
});

test("E146: a failed save's sentence is not cleared by the question going away", async () => {
  const trigger = document.body.appendChild(document.createElement("button"));
  const store = { save: async () => { throw new Error("quota"); } };
  const panel = openNoteEditor({ trigger, store, ctx, ref: "John 3:16", draft, text: () => null });
  const { body, cancel, message } = parts(panel);
  type(body, "my words");
  cancel.click();
  panel.querySelector(".desk-editor__save").click();
  await new Promise((r) => setTimeout(r, 20));
  assert.match(message.textContent, /couldn’t be saved/);
  type(body, "my words, again");
  assert.equal(message.hidden, false);
  assert.match(message.textContent, /couldn’t be saved/);
});
