// "+ From my notes…" (E62): what a sheet is offered from the notebook, and
// the parts the chosen records become (src/lib/desk-sheet-from-notes.mjs).
// It took over from N6's "+ For discussion" on 2026-11-08, whose tests on
// overlap, order, escaping and the limit continue here.

import test from "node:test";
import assert from "node:assert/strict";
import { FROM_NOTES_MAX, fitModules, itemKind, itemWords, noteHtml, notebookItems, partsFor } from "../src/lib/desk-sheet-from-notes.mjs";
import { SHEET_LIMITS, sanitizeSheetHtml, validateSheet } from "../src/lib/desk-sheet-format.mjs";
import { addModule, createSheet, makeModule } from "../src/lib/desk-sheets.mjs";

const ctx = { now: "2026-11-08T10:00:00.000Z", client: "test", contentVersion: "v1" };
const passage = (bookKey, chapter, verse, endVerse = verse) => makeModule("passage", { bookKey, chapter, verse, endVerse });
const sheetOf = (...modules) => createSheet({ title: "T", template: "x", modules }, ctx);

let n = 0;
const note = (fields) => ({
  kind: "note",
  marker: "note",
  id: `n${++n}`,
  created: "2026-10-01T00:00:00.000Z",
  modified: "2026-10-01T00:00:00.000Z",
  bookKey: "romans",
  chapter: 8,
  verse: 3,
  body: "A thought.",
  ...fields,
});
const question = (fields) => note({ marker: "question", body: "Why?", ...fields });
const highlight = (fields) => ({
  kind: "highlight",
  id: `h${++n}`,
  color: "yellow",
  created: "2026-10-01T00:00:00.000Z",
  modified: "2026-10-01T00:00:00.000Z",
  bookKey: "romans",
  chapter: 8,
  verse: 1,
  endVerse: 2,
  quote: { exact: "no condemnation", prefix: "", suffix: "" },
  ...fields,
});
const pin = (fields) => ({
  kind: "footnotePin",
  id: `p${++n}`,
  created: "2026-10-01T00:00:00.000Z",
  modified: "2026-10-01T00:00:00.000Z",
  bookKey: "romans",
  chapter: 8,
  verse: 3,
  footnote: "On “flesh.”",
  ...fields,
});
const ids = (list) => list.map((it) => it.record.id);

/* ── What is offered ─────────────────────────────────────────────────── */

test("notes of any marker, highlights and pinned footnotes on verses are offered; prose notes and other kinds are not", () => {
  assert.equal(itemKind(note({})), "note");
  assert.equal(itemKind(question({})), "question");
  assert.equal(itemKind(note({ marker: "heart" })), "note");
  assert.equal(itemKind(highlight({})), "highlight");
  assert.equal(itemKind(pin({})), "footnote");
  assert.equal(itemKind(note({ footnote: "A footnote’s words" })), "note");
  assert.equal(itemKind(note({ glossaryEntry: "flesh-body", bookKey: undefined, chapter: undefined, verse: undefined })), null);
  assert.equal(itemKind(note({ article: "many-and-all", bookKey: undefined, chapter: undefined, verse: undefined })), null);
  assert.equal(itemKind(note({ glossaryId: "g1" })), null);
  assert.equal(itemKind(note({ verse: "3" })), null);
  assert.equal(itemKind(pin({ footnote: undefined })), null);
  assert.equal(itemKind({ kind: "bookmark", bookKey: "romans", chapter: 8, verse: 3 }), null);
  assert.equal(itemKind({ kind: "place", bookKey: "romans", chapter: 8, verse: 3 }), null);
  assert.equal(itemKind(null), null);
  assert.equal(itemKind({}), null);
});

test("on a sheet with passages, a record overlapping one is offered; one outside is not", () => {
  const sheet = sheetOf(passage("romans", 8, 1, 4));
  const inside = note({ id: "a", verse: 4 });
  const range = question({ id: "b", verse: 4, endVerse: 9 });
  const before = note({ id: "c", verse: 1, endVerse: 1, chapter: 7 });
  const after = highlight({ id: "d", verse: 5, endVerse: 5 });
  const other = note({ id: "e", bookKey: "acts" });
  assert.deepEqual(ids(notebookItems(sheet, [after, before, range, inside, other])), ["a", "b"]);
});

test("a passage with no endVerse covers its one verse", () => {
  const sheet = sheetOf(makeModule("passage", { bookKey: "john", chapter: 3, verse: 16 }));
  const got = notebookItems(sheet, [note({ id: "a", bookKey: "john", chapter: 3, verse: 16 }), note({ id: "b", bookKey: "john", chapter: 3, verse: 17 })]);
  assert.deepEqual(ids(got), ["a"]);
});

test("order follows the sheet's passages, then verse, end verse, created, id", () => {
  const sheet = sheetOf(passage("john", 3, 1, 21), passage("romans", 8, 1, 20));
  const records = [
    note({ id: "r9", verse: 9 }),
    note({ id: "j16b", bookKey: "john", chapter: 3, verse: 16, created: "2026-10-03T00:00:00.000Z" }),
    highlight({ id: "j16a", bookKey: "john", chapter: 3, verse: 16, endVerse: 16, created: "2026-10-02T00:00:00.000Z" }),
    note({ id: "j16long", bookKey: "john", chapter: 3, verse: 16, endVerse: 18, created: "2026-10-01T00:00:00.000Z" }),
    pin({ id: "j2", bookKey: "john", chapter: 3, verse: 2 }),
    note({ id: "j16c", bookKey: "john", chapter: 3, verse: 16, created: "2026-10-03T00:00:00.000Z" }),
  ];
  assert.deepEqual(ids(notebookItems(sheet, records)), ["j2", "j16a", "j16b", "j16c", "j16long", "r9"]);
  const swapped = sheetOf(passage("romans", 8, 1, 20), passage("john", 3, 1, 21));
  assert.equal(notebookItems(swapped, records)[0].record.id, "r9");
});

test("a record overlapping two passages is offered once, under the first", () => {
  const sheet = sheetOf(passage("john", 1, 1, 3), passage("romans", 8, 1, 5), passage("romans", 8, 4, 9), passage("john", 2, 1, 2));
  const records = [note({ id: "span", verse: 4, endVerse: 5 }), note({ id: "j", bookKey: "john", chapter: 2, verse: 1 })];
  assert.deepEqual(ids(notebookItems(sheet, records)), ["span", "j"]);
});

test("on a sheet with no passage, everything eligible is offered, the most recently changed first, capped", () => {
  const sheet = sheetOf(makeModule("text", { html: "<h2>Reading</h2>" }));
  const records = [
    note({ id: "old", modified: "2026-10-01T00:00:00.000Z" }),
    highlight({ id: "new", bookKey: "john", chapter: 3, modified: "2026-10-09T00:00:00.000Z" }),
    pin({ id: "mid", modified: "2026-10-05T00:00:00.000Z" }),
    note({ id: "prose", glossaryEntry: "flesh-body", bookKey: undefined, chapter: undefined, verse: undefined }),
  ];
  assert.deepEqual(ids(notebookItems(sheet, records)), ["new", "mid", "old"]);
  const many = Array.from({ length: FROM_NOTES_MAX + 5 }, (_, i) => note({ id: `m${i}`, modified: `2026-10-${String(1 + (i % 28)).padStart(2, "0")}T00:00:00.000Z` }));
  assert.equal(notebookItems(sheet, many).length, FROM_NOTES_MAX);
});

test("nothing is offered without records or a sheet", () => {
  assert.deepEqual(notebookItems(sheetOf(passage("romans", 8, 1)), null), []);
  assert.deepEqual(notebookItems(null, [note({})]), []);
  // A part of an unknown type is not a passage, so the sheet counts as having none and is offered everything.
  const unknown = sheetOf({ id: "u", type: "future", bookKey: "romans", chapter: 8, verse: 3 });
  const one = note({ id: "one" });
  assert.deepEqual(ids(notebookItems(unknown, [one])), ["one"]);
});

test("each item carries its kind and the words the chooser shows", () => {
  const sheet = sheetOf(passage("romans", 8, 1, 20));
  const items = notebookItems(sheet, [question({ id: "q", body: "Why?" }), highlight({ id: "h" }), pin({ id: "p", verse: 4 }), note({ id: "n", verse: 5, body: "Hm." })]);
  assert.deepEqual(items.map((it) => [it.record.id, it.kind, it.words]), [
    ["h", "highlight", "no condemnation"],
    ["q", "question", "Why?"],
    ["p", "footnote", "On “flesh.”"],
    ["n", "note", "Hm."],
  ]);
  assert.equal(itemWords(highlight({ quote: undefined })), "");
  assert.equal(itemWords(note({ body: undefined })), "");
});

test("a note or footnote already on the sheet, or a highlight a passage covers exactly, is marked onSheet", () => {
  const q = question({ id: "q", body: "Why?" });
  const h = highlight({ id: "h", verse: 1, endVerse: 2 });
  const h2 = highlight({ id: "h2", verse: 1, endVerse: 3 });
  const p = pin({ id: "p", verse: 4 });
  const sheet = sheetOf(passage("romans", 8, 1, 2), passage("romans", 8, 3, 20), makeModule("question", { html: noteHtml(q) }), makeModule("text", { html: noteHtml(p) }));
  const items = notebookItems(sheet, [q, h, h2, p, note({ id: "fresh", verse: 5 })]);
  assert.deepEqual(items.map((it) => [it.record.id, it.onSheet]), [["h", true], ["h2", false], ["q", true], ["p", true], ["fresh", false]]);
});

/* ── The words a part gets ───────────────────────────────────────────── */

test("a note's text is its reference in bold, then the words", () => {
  assert.equal(noteHtml(note({ body: "Why does Paul say this?" })), "<p><strong>Romans 8:3</strong> Why does Paul say this?</p>");
  assert.equal(noteHtml(note({ verse: 3, endVerse: 5, body: "Q" })), "<p><strong>Romans 8:3–5</strong> Q</p>");
  assert.equal(noteHtml(note({ body: "" })), "<p><strong>Romans 8:3</strong></p>");
});

test("a pinned footnote's text is the footnote's words; a note on a footnote has those first, then its own", () => {
  assert.equal(noteHtml(pin({ footnote: "On “flesh.”" })), "<p><strong>Romans 8:3</strong> On “flesh.”</p>");
  assert.equal(noteHtml(note({ footnote: "On “flesh.”", body: "Worth saying aloud." })), "<p><strong>Romans 8:3</strong> On “flesh.”</p><p>Worth saying aloud.</p>");
});

test("the body is escaped, never read as markup", () => {
  const html = noteHtml(note({ body: "Is a < b & <script>alert(1)</script> <b>bold</b>?" }));
  assert.equal(html, "<p><strong>Romans 8:3</strong> Is a &lt; b &amp; &lt;script&gt;alert(1)&lt;/script&gt; &lt;b&gt;bold&lt;/b&gt;?</p>");
  assert.ok(!html.includes("<script"));
});

test("blank lines make paragraphs and single newlines make breaks", () => {
  const html = noteHtml(note({ body: "First line\nsecond line\n\nNext paragraph\r\n\r\n\r\nLast" }));
  assert.equal(html, "<p><strong>Romans 8:3</strong> First line<br>second line</p><p>Next paragraph</p><p>Last</p>");
});

test("noteHtml is always canonical", () => {
  for (const body of ["", "  ", "x", "a\n\nb", "  spaced   out \n words ", "<i>x</i> & y", "a\n"]) {
    const html = noteHtml(note({ body }));
    assert.equal(sanitizeSheetHtml(html), html, JSON.stringify(body));
  }
  assert.equal(sanitizeSheetHtml(noteHtml(pin({}))), noteHtml(pin({})));
});

/* ── The parts ───────────────────────────────────────────────────────── */

test("each kind becomes its part, in the order chosen, and the sheet stays valid", () => {
  let sheet = sheetOf(passage("romans", 8, 1, 20), makeModule("text", { html: "<p>Intro</p>" }));
  const items = notebookItems(sheet, [question({ id: "q", verse: 9, body: "Second?" }), note({ id: "n", verse: 2, body: "First.\n\nMore" }), pin({ id: "p", verse: 4 }), highlight({ id: "h", verse: 5, endVerse: 6 })]);
  const made = partsFor(items, { contentVersion: "v1" });
  assert.deepEqual(made.map((m) => m.type), ["text", "text", "passage", "question"]);
  assert.equal(made[0].html, "<p><strong>Romans 8:2</strong> First.</p><p>More</p>");
  assert.equal(made[1].html, "<p><strong>Romans 8:4</strong> On “flesh.”</p>");
  assert.deepEqual([made[2].bookKey, made[2].chapter, made[2].verse, made[2].endVerse], ["romans", 8, 5, 6]);
  assert.equal(made[3].html, "<p><strong>Romans 8:9</strong> Second?</p>");
  assert.equal(made[3].answer, "");
  assert.equal(made[3].lines, 3);
  assert.equal(new Set(made.map((m) => m.id)).size, 4);
  let at = 1;
  for (const m of made) sheet = addModule(sheet, m, at++, ctx);
  assert.deepEqual(validateSheet(sheet), []);
  assert.deepEqual(sheet.modules.map((m) => m.type), ["passage", "text", "text", "passage", "question", "text"]);
});

test("a question's lines can be chosen, and a record nothing can be made of is skipped", () => {
  const made = partsFor([{ record: question({}), kind: "question" }, { record: { kind: "bookmark" }, kind: "highlight" }], { lines: 5 });
  assert.equal(made.length, 1);
  assert.equal(made[0].lines, 5);
  assert.deepEqual(partsFor(null), []);
});

test("the sheet's limit on modules is respected, and what didn't fit is counted", () => {
  const filler = Array.from({ length: SHEET_LIMITS.modules - 4 }, () => makeModule("space"));
  const sheet = sheetOf(passage("romans", 8, 1, 20), ...filler);
  assert.equal(sheet.modules.length, SHEET_LIMITS.modules - 3);
  const made = partsFor([1, 2, 3, 4, 5].map((v) => ({ record: note({ id: `q${v}`, verse: v, body: `Q${v}` }), kind: "note" })));
  const got = fitModules(sheet, made);
  assert.equal(got.modules.length, 3);
  assert.equal(got.dropped, 2);
  assert.equal(got.modules.length + sheet.modules.length, SHEET_LIMITS.modules);
  const full = sheetOf(passage("romans", 8, 1, 20), ...Array.from({ length: SHEET_LIMITS.modules - 1 }, () => makeModule("space")));
  assert.deepEqual(fitModules(full, made), { modules: [], dropped: 5 });
  assert.deepEqual(fitModules(null, null), { modules: [], dropped: 0 });
});
