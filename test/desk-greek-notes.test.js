import { test } from "node:test";
import assert from "node:assert/strict";
import { GREEK_NOTES_KEY, greekNotesOn, greekNotesStored } from "../src/lib/desk-greek-notes.mjs";

const from = (stored) => (key) => (key in stored ? stored[key] : null);

test("the storage key is the one /privacy names", () => {
  assert.equal(GREEK_NOTES_KEY, "lit-desk-greek-notes");
});

test("a Greek search lists notes unless the reader turned them off", () => {
  assert.equal(greekNotesOn(from({})), true);
  assert.equal(greekNotesOn(from({ [GREEK_NOTES_KEY]: "off" })), false);
});

test("anything stored but off reads as on", () => {
  assert.equal(greekNotesOn(from({ [GREEK_NOTES_KEY]: "on" })), true);
  assert.equal(greekNotesOn(from({ [GREEK_NOTES_KEY]: "" })), true);
  assert.equal(greekNotesOn(from({ [GREEK_NOTES_KEY]: "OFF" })), true);
});

test("only off is stored; on removes the key", () => {
  assert.equal(greekNotesStored(false), "off");
  assert.equal(greekNotesStored(true), null);
});

test("what is stored reads back as the choice", () => {
  for (const on of [true, false]) {
    const v = greekNotesStored(on);
    assert.equal(greekNotesOn(from(v === null ? {} : { [GREEK_NOTES_KEY]: v })), on);
  }
});
