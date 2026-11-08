// Two tabs on one sheet (STUDY-DESK.md, S12, part 4): src/lib/desk-sheet-tabs.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  changedUnderReader,
  editingMessage,
  editingReply,
  readEditingMessage,
} from "../src/lib/desk-sheet-tabs.mjs";

test("a message is read back only in its own shape", () => {
  const who = editingMessage("who", "tab-a", "sheet-1");
  assert.deepEqual(readEditingMessage(who), { type: "who", tab: "tab-a", sheet: "sheet-1" });
  assert.deepEqual(readEditingMessage(editingMessage("here", "tab-b", "sheet-1")).type, "here");
  for (const bad of [null, "who", {}, { ...who, v: 2 }, { ...who, type: "bye" }, { ...who, tab: "" }, { ...who, sheet: 3 }, { ...who, sheet: "x".repeat(201) }]) {
    assert.equal(readEditingMessage(bad), null);
  }
});

test("a tab answers for the sheets its editors show, and counts answers about the one it asks after", () => {
  const who = readEditingMessage(editingMessage("who", "tab-a", "s1"));
  const here = readEditingMessage(editingMessage("here", "tab-b", "s1"));
  assert.equal(editingReply(who, { tab: "tab-b", showing: ["s1"] }), "answer");
  assert.equal(editingReply(who, { tab: "tab-b", showing: ["s2"] }), null, "another sheet");
  assert.equal(editingReply(who, { tab: "tab-b", showing: [] }), null, "the list, or printing and presenting");
  assert.equal(editingReply(who, { tab: "tab-a", showing: ["s1"] }), null, "never its own");
  assert.equal(editingReply(here, { tab: "tab-a", asking: "s1" }), "count");
  assert.equal(editingReply(here, { tab: "tab-a", asking: "s2" }), null);
  assert.equal(editingReply(here, { tab: "tab-b", asking: "s1" }), null, "another pane in the same tab");
  assert.equal(editingReply(null, { tab: "tab-a" }), null);
});

test("the line shows only when a part's typed fields moved", () => {
  const drawn = JSON.stringify({ id: "m1", type: "question", html: "<p>Why?</p>", answer: "" });
  assert.equal(changedUnderReader(drawn, { id: "m1", type: "question", html: "<p>Why?</p>", minutes: 5 }), false);
  assert.equal(changedUnderReader(drawn, { id: "m1", type: "question", html: "<p>Why not?</p>" }), true);
  assert.equal(changedUnderReader(drawn, { id: "m1", type: "question", html: "<p>Why?</p>", answer: "<p>Because</p>" }), true);
  assert.equal(changedUnderReader("", { html: "x" }), false, "a card never drawn");
  assert.equal(changedUnderReader("{not json", { html: "x" }), false);
});

test("the sheet editor asks before editing and draws the line", () => {
  const src = readFileSync(new URL("../src/scripts/desk/sheets/sheet-editor.js", import.meta.url), "utf8");
  assert.match(src, /await editedElsewhere\(id\)/);
  assert.match(src, /changedUnderReader\(card\.json, m\)/);
  assert.match(src, /addEditor\(/);
});
