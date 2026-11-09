// test/desk-audit8-e-labels.test.js
//
// Study Desk Audit 8, batch E: names that read as nothing are refused as empty
// (GF8c-9), a bookmark's name is cut between graphemes so an emoji sequence or
// a flag is never split (GF8c-9), and noteOpening's comma follows the
// quotation's own closing marks (GF8c-10).

import { test } from "node:test";
import assert from "node:assert/strict";

import { planCreateLabel, planNewLabelOn, planRenameLabel } from "../src/lib/desk-labels.mjs";
import { BOOKMARK_NAME_MAX, cleanBookmarkName } from "../src/lib/desk-bookmarks.mjs";
import { noteOpening } from "../src/lib/desk-notes.mjs";
import { createRecord, validateRecord } from "../src/lib/desk-records.mjs";

const ctx = { client: "web/2026.11", contentVersion: "v20261109.0000000", now: "2026-11-09T10:00:00.000Z" };
const COMBINING_ACUTE = "́";
const ZWSP = "​";
const WORD_JOINER = "⁠";
const SOFT_HYPHEN = "­";

// GF8c-9: a label whose name reads as nothing is refused.
test("GF8c-9: a lone combining mark, a zero-width space, a word joiner or a soft hyphen is an empty name", () => {
  for (const name of [COMBINING_ACUTE, ZWSP, WORD_JOINER, SOFT_HYPHEN, `${ZWSP} ${SOFT_HYPHEN}`]) {
    assert.equal(planCreateLabel([], name, ctx).reason, "empty", JSON.stringify(name));
  }
});

test("GF8c-9: a second such name is refused too, rather than making a second invisible label", () => {
  const first = planCreateLabel([], COMBINING_ACUTE, ctx);
  assert.equal(first.ok, false);
  assert.equal(planCreateLabel([], COMBINING_ACUTE, ctx).reason, "empty");
});

test("GF8c-9: a name with letters beside an invisible mark is still a name", () => {
  const made = planCreateLabel([], `${ZWSP}Prayer`, ctx);
  assert.equal(made.ok, true);
});

test("GF8c-9: renaming to a blank name and attaching one are refused as empty too", () => {
  const label = { id: "l1", kind: "label", name: "Prayer", modified: "2026-11-01T00:00:00.000Z", client: "x" };
  assert.equal(planRenameLabel([label], "l1", COMBINING_ACUTE, ctx).reason, "empty");
  const record = { id: "n1", kind: "note", bookKey: "romans", chapter: 8, verse: 1, body: "x", modified: "2026-11-01T00:00:00.000Z", client: "x", labels: [] };
  assert.equal(planNewLabelOn([label], record, ZWSP, ctx).reason, "empty");
});

// GF8c-9: a bookmark's name is cut by grapheme and never past the code point limit.
test("GF8c-9: a family emoji at the limit is not split, and the name stops before it", () => {
  const family = "👨‍👩‍👧‍👦"; // one grapheme of 7 code points
  const name = cleanBookmarkName("a".repeat(BOOKMARK_NAME_MAX - 2) + family);
  assert.equal(name, "a".repeat(BOOKMARK_NAME_MAX - 2));
  assert.ok(!/‍$/.test(name), "no trailing joiner");
});

test("GF8c-9: a flag at the limit is not split in half", () => {
  const flag = "🇺🇸";
  const name = cleanBookmarkName("a".repeat(BOOKMARK_NAME_MAX - 1) + flag);
  assert.equal(name, "a".repeat(BOOKMARK_NAME_MAX - 1));
});

test("GF8c-9: a name within the limit is kept whole, emoji and all", () => {
  assert.equal(cleanBookmarkName("Thursday 👨‍👩‍👧 group"), "Thursday 👨‍👩‍👧 group");
  assert.equal(cleanBookmarkName("🇺🇸🇫🇷"), "🇺🇸🇫🇷");
});

test("GF8c-9: a cut name passes the record check (code points, not graphemes)", () => {
  const cut = cleanBookmarkName("🇺🇸".repeat(30));
  const record = createRecord("bookmark", { bookKey: "romans", chapter: 8, verse: 1, endVerse: 1, label: cut }, ctx);
  assert.deepEqual(validateRecord(record), []);
  assert.ok(Array.from(cut).length <= BOOKMARK_NAME_MAX);
});

// GF8c-10: noteOpening's comma.
test("GF8c-10: no comma after a quotation that ends in its own closing mark or a dash", () => {
  assert.equal(noteOpening({ quote: { exact: "said, “Come and see.”" } }, "John 1:39"), "My note on ‘said, “Come and see.”’ John 1:39: ");
  assert.equal(noteOpening({ quote: { exact: "Is it I, Lord?”" } }, "Matthew 26:22"), "My note on ‘Is it I, Lord?”’ Matthew 26:22: ");
  assert.equal(noteOpening({ quote: { exact: "a voice—" } }, "John 12:28"), "My note on ‘a voice—’ John 12:28: ");
  assert.equal(noteOpening({ quote: { exact: "in Christ Jesus" } }, "Romans 8:1"), "My note on ‘in Christ Jesus,’ Romans 8:1: ", "the ordinary comma stays");
});

test("GF8c-10: a question or exclamation mark keeps its place with no comma", () => {
  assert.equal(noteOpening({ quote: { exact: "against us?" } }, "Romans 8:31"), "My note on ‘against us?’ Romans 8:31: ");
  assert.equal(noteOpening({ quote: { exact: "Stand up!" } }, "Mark 2:11"), "My note on ‘Stand up!’ Mark 2:11: ");
});
