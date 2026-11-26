// test/desk-format-lengths.test.js
//
// STUDY-DESK-FORMAT.md, "How a length is counted": a field's limit in
// characters counts code points, a note's body counts UTF-16 code units, and
// a size counts bytes of UTF-8. The apps count from that sentence, so these
// hold the website's validators to it. "🙂" is one code point, two UTF-16
// units, and four bytes, so each limit is tried with it at the limit and one
// past it.

import { test } from "node:test";
import assert from "node:assert/strict";

import { BOOKMARK_NAME_MAX } from "../src/lib/desk-bookmarks.mjs";
import { LABEL_NAME_MAX, MAX_NOTE_BODY, createRecord, validateRecord } from "../src/lib/desk-records.mjs";
import { SHEET_LIMITS } from "../src/lib/desk-sheet-format.mjs";
import { createSheet } from "../src/lib/desk-sheets.mjs";
import { COLLECTION_LIMITS } from "../src/lib/desk-collection-format.mjs";
import { createCollection } from "../src/lib/desk-collections.mjs";

const EMOJI = "🙂";
const ctx = { client: "web/2026.11", contentVersion: "v20261126.5d2c847d", now: "2026-11-26T12:00:00.000Z" };
let n = 0;
const at = () => ({ ...ctx, id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` });
const make = (kind, fields) => createRecord(kind, fields, at());
const valid = (record) => validateRecord(record).length === 0;

test("an emoji is one code point, two UTF-16 units, and four bytes, as the cases below assume", () => {
  assert.equal(Array.from(EMOJI).length, 1);
  assert.equal(EMOJI.length, 2);
  assert.equal(new TextEncoder().encode(EMOJI).length, 4);
});

test("a field's limit in characters counts code points", () => {
  const cases = [
    ["a bookmark's label", BOOKMARK_NAME_MAX, (s) => make("bookmark", { bookKey: "mark", chapter: 4, verse: 35, label: s })],
    ["a label's name", LABEL_NAME_MAX, (s) => make("label", { name: s })],
    ["a sheet's title", SHEET_LIMITS.title, (s) => ({ ...createSheet({ title: "x" }, at()), title: s })],
    ["a sheet's subtitle", SHEET_LIMITS.subtitle, (s) => ({ ...createSheet({ title: "x" }, at()), subtitle: s })],
    ["a collection's name", COLLECTION_LIMITS.name, (s) => ({ ...createCollection({ name: "x" }, at()), name: s })],
    ["a collection's description", COLLECTION_LIMITS.description, (s) => ({ ...createCollection({ name: "x" }, at()), description: s })],
  ];
  for (const [what, max, build] of cases) {
    assert.ok(valid(build(EMOJI.repeat(max))), `${what}: ${max} emoji (${2 * max} UTF-16 units) is within the limit`);
    assert.ok(!valid(build(EMOJI.repeat(max + 1))), `${what}: ${max + 1} emoji is past it`);
    assert.ok(!valid(build("x".repeat(max + 1))), `${what}: ${max + 1} letters is past it`);
  }
});

test("a note's body counts UTF-16 code units", () => {
  const note = (body) => make("note", { bookKey: "john", chapter: 3, verse: 16, body, marker: "note" });
  assert.ok(valid(note(EMOJI.repeat(MAX_NOTE_BODY / 2))), "65,536 units of emoji");
  assert.ok(!valid(note(`${EMOJI.repeat(MAX_NOTE_BODY / 2)}x`)), "one unit more");
  assert.ok(valid(note("x".repeat(MAX_NOTE_BODY))));
  assert.ok(!valid(note(EMOJI.repeat(MAX_NOTE_BODY / 2 + 1))), "fewer code points than the limit, but more units");
});

test("a sheet's size counts bytes of its JSON in UTF-8", () => {
  const sheet = createSheet({ title: "x" }, at());
  const room = SHEET_LIMITS.bytes - new TextEncoder().encode(JSON.stringify(sheet)).length;
  // A subtitle can't hold that much, so the bytes go in a field this version doesn't check.
  const filled = (s) => ({ ...sheet, extra: s });
  assert.ok(!validateRecord(filled("x".repeat(room - 20))).some((p) => /KB/.test(p)), "inside the limit in bytes");
  assert.ok(validateRecord(filled(EMOJI.repeat(Math.ceil(room / 4) + 4))).some((p) => /KB/.test(p)), "past it in bytes, though not in units");
});
