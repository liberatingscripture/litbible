// test/desk-interleaf.test.js
//
// The interleaf's grouping rule (src/lib/desk-interleaf.mjs): one band per
// paragraph that has notes, in page order, notes in reading order.

import { test } from "node:test";
import assert from "node:assert/strict";

import { bandLabel, groupIntoBands } from "../src/lib/desk-interleaf.mjs";

const note = (id, created = "2026-10-01T00:00:00Z") => ({ id, created });

test("notes in one paragraph share a band, in reading order", () => {
  const bands = groupIntoBands([
    { record: note("b"), block: 2, start: 90 },
    { record: note("a"), block: 2, start: 40 },
    { record: note("c"), block: 0, start: 5 },
  ]);
  assert.deepEqual(
    bands.map((b) => [b.block, b.records.map((r) => r.id)]),
    [
      [0, ["c"]],
      [2, ["a", "b"]],
    ],
  );
});

test("two notes on the same words keep the order they were made in", () => {
  const bands = groupIntoBands([
    { record: note("late", "2026-10-03T00:00:00Z"), block: 1, start: 10 },
    { record: note("early", "2026-10-01T00:00:00Z"), block: 1, start: 10 },
  ]);
  assert.deepEqual(bands[0].records.map((r) => r.id), ["early", "late"]);
});

test("a note not on the page has no band", () => {
  assert.deepEqual(groupIntoBands([{ record: note("x"), block: null, start: 0 }]), []);
  assert.deepEqual(groupIntoBands([{ record: note("x"), block: -1, start: 0 }]), []);
  assert.deepEqual(groupIntoBands([]), []);
});

test("the band's name counts its notes", () => {
  assert.equal(bandLabel(1), "My note on this paragraph");
  assert.equal(bandLabel(3), "My notes on this paragraph");
});
