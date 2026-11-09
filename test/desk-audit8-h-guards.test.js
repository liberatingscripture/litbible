// test/desk-audit8-h-guards.test.js
//
// LG8-5 (Study Desk Audit 8): four guards survived deliberate breakage. One
// test each, named for the mutation that found it (A5, M2, I4, N4).

import { test } from "node:test";
import assert from "node:assert/strict";

import { chapterAnchorText, resolveAnchor, MIN_CONTEXT } from "../scripts/lib/anchor-text.mjs";
import { mergeRecords, mergeSets, CLOCK_TOLERANCE_MS } from "../src/lib/desk-merge.mjs";
import { createRecord } from "../src/lib/desk-records.mjs";
import { parseImport, BACKUP_FORMAT, BACKUP_VERSION } from "../src/lib/desk-export.mjs";
import { makeInert } from "../src/lib/desk-inert.mjs";
import { parseHtml } from "./helpers/mini-dom.js";

/* ── A5: on a tie between occurrences, the first (STUDY-DESK-FORMAT.md, "Finding a mark again") ── */

const verse = (n, text) => `<span class="vglue"><sup id="v${n}" class="vn">${n}</sup>&nbsp;${text}</span>`;

test("A5: two occurrences whose context agrees equally are told apart by position: the first wins", () => {
  const chapter = chapterAnchorText([`<p>${verse(1, "Peace be with you. Peace be with you.")}</p>`]);
  const [first, second] = [chapter.text.indexOf("Peace"), chapter.text.lastIndexOf("Peace")];
  assert.notEqual(first, second);
  // Each occurrence is followed by " be with you.", so a stored suffix of exactly
  // MIN_CONTEXT characters agrees with both, to the same length, with no prefix to split them.
  const suffix = " be with";
  assert.equal(suffix.length, MIN_CONTEXT);
  const anchor = { verse: 1, endVerse: 1, exact: "Peace", prefix: "", suffix };
  assert.deepEqual(resolveAnchor(chapter, anchor), { status: "found", start: first, end: first + "Peace".length });
});

/* ── M2: a file's own `exported` time is exact; only `now` gets room for skew (BA4, DI-8) ── */

const day = (n) => `2026-10-${String(n).padStart(2, "0")}T12:00:00.000Z`;
const NOTE = { bookKey: "john", chapter: 3, verse: 16, body: "a note", marker: "note" };
const made = (modified) => ({
  ...createRecord("note", NOTE, { client: "web/test", contentVersion: "v20261005.5d2c847d", now: "2026-10-01T00:00:00.000Z", id: "00000000-0000-4000-8000-0000000000b1" }),
  modified,
});
const at = (iso, ms) => new Date(Date.parse(iso) + ms).toISOString();

test("M2: a record dated within the clock tolerance after its file's own `exported` is still clamped to it", () => {
  const exported = "2026-10-11T08:00:00.000Z";
  const within = at(exported, CLOCK_TOLERANCE_MS - 60_000); // 4 minutes after the file says it was saved
  const plan = mergeRecords([], [made(within)], { now: day(20), exported });
  assert.equal(plan.put.length, 1);
  assert.equal(plan.put[0].modified, exported, "nothing in a file can be newer than the file");
  assert.deepEqual(plan.ahead.map((a) => a.written), [true]);
  assert.equal(mergeSets([], [made(within)], { now: day(20), exported })[0].modified, exported);
});

test("M2: the same few minutes after `now` (another device's clock) are tolerated, and left as they are", () => {
  const now = day(12);
  const within = at(now, CLOCK_TOLERANCE_MS - 60_000);
  const plan = mergeRecords([], [made(within)], { now });
  assert.equal(plan.put[0].modified, within);
  assert.deepEqual(plan.ahead, []);
  const beyond = at(now, CLOCK_TOLERANCE_MS + 60_000);
  assert.equal(mergeRecords([], [made(beyond)], { now }).put[0].modified, now);
});

/* ── I4: a backup with no records says so ── */

test("I4: a backup file with no `records` list reports it and brings in nothing", () => {
  for (const data of [{ format: BACKUP_FORMAT, version: BACKUP_VERSION }, { format: BACKUP_FORMAT, version: BACKUP_VERSION, records: "x" }, { format: BACKUP_FORMAT, version: BACKUP_VERSION, records: null }]) {
    const back = parseImport(JSON.stringify(data));
    assert.equal(back.kind, "backup");
    assert.deepEqual(back.records, []);
    assert.deepEqual(back.problems, [{ line: null, message: "This backup file has no entries in it." }]);
  }
  // An empty list is a backup with nothing in it, not a malformed one.
  const empty = parseImport(JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, records: [] }));
  assert.deepEqual(empty.problems, []);
});

/* ── N4: an inline style on a fetched page's part is stripped ── */

test("N4: makeInert strips an inline style from the element that carries it and from every element inside", () => {
  const root = parseHtml('<div style="background:url(https://x/y)"><p style="color:red">a <span style="position:fixed;inset:0">b</span></p></div>');
  const div = root.querySelector("div");
  assert.equal(div.getAttribute("style"), "background:url(https://x/y)", "the fixture does carry the style before the scrub");
  makeInert(root);
  assert.equal(root.querySelector("div").getAttribute("style"), null);
  assert.equal(root.querySelector("p").getAttribute("style"), null);
  assert.equal(root.querySelector("span").getAttribute("style"), null);
});
