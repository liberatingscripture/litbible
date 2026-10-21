import test from "node:test";
import assert from "node:assert/strict";
import { DISCUSSION_HEADING, discussionModules, discussionNotes, questionHtml } from "../src/lib/desk-sheet-discussion.mjs";
import { SHEET_LIMITS, sanitizeSheetHtml, validateSheet } from "../src/lib/desk-sheet-format.mjs";
import { addModule, createSheet, makeModule } from "../src/lib/desk-sheets.mjs";

const ctx = { now: "2026-10-20T10:00:00.000Z", client: "test", contentVersion: "v1" };
const passage = (bookKey, chapter, verse, endVerse = verse) => makeModule("passage", { bookKey, chapter, verse, endVerse });
const sheetOf = (...modules) => createSheet({ title: "T", template: "x", modules }, ctx);

let n = 0;
const note = (fields) => ({
  kind: "note",
  marker: "question",
  id: `n${++n}`,
  created: "2026-10-01T00:00:00.000Z",
  bookKey: "romans",
  chapter: 8,
  verse: 3,
  body: "Why?",
  ...fields,
});
const ids = (list) => list.map((r) => r.id);

test("a question overlapping a passage is found; one outside it is not", () => {
  const sheet = sheetOf(passage("romans", 8, 1, 4));
  const inside = note({ id: "a", verse: 4 });
  const range = note({ id: "b", verse: 4, endVerse: 9 });
  const before = note({ id: "c", verse: 1, endVerse: 1, chapter: 7 });
  const after = note({ id: "d", verse: 5 });
  assert.deepEqual(ids(discussionNotes(sheet, [after, before, range, inside])), ["a", "b"]);
});

test("a passage with no endVerse covers its one verse", () => {
  const sheet = sheetOf(makeModule("passage", { bookKey: "john", chapter: 3, verse: 16 }));
  const got = discussionNotes(sheet, [note({ id: "a", bookKey: "john", chapter: 3, verse: 16 }), note({ id: "b", bookKey: "john", chapter: 3, verse: 17 })]);
  assert.deepEqual(ids(got), ["a"]);
});

test("same chapter number in another book does not overlap", () => {
  const sheet = sheetOf(passage("romans", 8, 1, 4));
  assert.deepEqual(discussionNotes(sheet, [note({ bookKey: "acts" })]), []);
});

test("order follows the sheet's passages, then verse, end verse, created, id", () => {
  const sheet = sheetOf(passage("john", 3, 1, 21), passage("romans", 8, 1, 20));
  const records = [
    note({ id: "r9", verse: 9 }),
    note({ id: "j16b", bookKey: "john", chapter: 3, verse: 16, created: "2026-10-03T00:00:00.000Z" }),
    note({ id: "j16a", bookKey: "john", chapter: 3, verse: 16, created: "2026-10-02T00:00:00.000Z" }),
    note({ id: "j16long", bookKey: "john", chapter: 3, verse: 16, endVerse: 18, created: "2026-10-01T00:00:00.000Z" }),
    note({ id: "j2", bookKey: "john", chapter: 3, verse: 2 }),
    note({ id: "j16c", bookKey: "john", chapter: 3, verse: 16, created: "2026-10-03T00:00:00.000Z" }),
  ];
  assert.deepEqual(ids(discussionNotes(sheet, records)), ["j2", "j16a", "j16b", "j16c", "j16long", "r9"]);
  // The same notes with the passages swapped: Romans first.
  const swapped = sheetOf(passage("romans", 8, 1, 20), passage("john", 3, 1, 21));
  assert.equal(discussionNotes(swapped, records)[0].id, "r9");
});

test("a note overlapping two passages appears once, under the first", () => {
  const sheet = sheetOf(passage("john", 1, 1, 3), passage("romans", 8, 1, 5), passage("romans", 8, 4, 9), passage("john", 2, 1, 2));
  const records = [note({ id: "span", verse: 4, endVerse: 5 }), note({ id: "j", bookKey: "john", chapter: 2, verse: 1 })];
  assert.deepEqual(ids(discussionNotes(sheet, records)), ["span", "j"]);
});

test("only notes marked as questions, on verses, are gathered", () => {
  const sheet = sheetOf(passage("romans", 8, 1, 20));
  const records = [
    note({ id: "ok" }),
    note({ id: "plain", marker: "note" }),
    note({ id: "none", marker: undefined }),
    note({ id: "prose", glossaryEntry: "flesh-body", bookKey: undefined, chapter: undefined, verse: undefined }),
    note({ id: "article", article: "many-and-all", bookKey: undefined, chapter: undefined, verse: undefined }),
    note({ id: "gid", glossaryId: "g1" }),
    { ...note({ id: "hl" }), kind: "highlight" },
    note({ id: "other", chapter: 9 }),
    note({ id: "badverse", verse: "3" }),
    null,
    {},
    note({ id: "onfn", footnote: "A footnote’s words", verse: 5 }),
  ];
  assert.deepEqual(ids(discussionNotes(sheet, records)), ["ok", "onfn"]);
});

test("nothing found without passages or records", () => {
  assert.deepEqual(discussionNotes(sheetOf(), [note({})]), []);
  assert.deepEqual(discussionNotes(sheetOf(passage("romans", 8, 1)), null), []);
  assert.deepEqual(discussionNotes(null, [note({})]), []);
  const unknown = sheetOf({ id: "u", type: "future", bookKey: "romans", chapter: 8, verse: 3 });
  assert.deepEqual(discussionNotes(unknown, [note({})]), []);
});

test("a question's text is its reference in bold, then the words", () => {
  assert.equal(questionHtml(note({ body: "Why does Paul say this?" })), "<p><strong>Romans 8:3</strong> Why does Paul say this?</p>");
  assert.equal(questionHtml(note({ verse: 3, endVerse: 5, body: "Q" })), "<p><strong>Romans 8:3–5</strong> Q</p>");
  assert.equal(questionHtml(note({ body: "" })), "<p><strong>Romans 8:3</strong></p>");
});

test("the body is escaped, never read as markup", () => {
  const html = questionHtml(note({ body: "Is a < b & <script>alert(1)</script> <b>bold</b>?" }));
  assert.equal(html, "<p><strong>Romans 8:3</strong> Is a &lt; b &amp; &lt;script&gt;alert(1)&lt;/script&gt; &lt;b&gt;bold&lt;/b&gt;?</p>");
  assert.ok(!html.includes("<script"));
});

test("blank lines make paragraphs and single newlines make breaks", () => {
  const html = questionHtml(note({ body: "First line\nsecond line\n\nNext paragraph\r\n\r\n\r\nLast" }));
  assert.equal(html, "<p><strong>Romans 8:3</strong> First line<br>second line</p><p>Next paragraph</p><p>Last</p>");
});

test("questionHtml is always canonical", () => {
  for (const body of ["", "  ", "x", "a\n\nb", "  spaced   out \n words ", "<i>x</i> & y", "a\n"]) {
    const html = questionHtml(note({ body }));
    assert.equal(sanitizeSheetHtml(html), html, JSON.stringify(body));
  }
  assert.equal(sanitizeSheetHtml(DISCUSSION_HEADING), DISCUSSION_HEADING);
  assert.equal(DISCUSSION_HEADING, "<h2>For discussion</h2>");
});

test("the modules are a heading then a question per note, and the sheet stays valid", () => {
  let sheet = sheetOf(passage("romans", 8, 1, 20), makeModule("text", { html: "<p>Intro</p>" }));
  const records = [note({ id: "a", verse: 9, body: "Second?" }), note({ id: "b", verse: 2, body: "First?\n\nMore" })];
  const got = discussionModules(sheet, records);
  assert.equal(got.found, 2);
  assert.equal(got.already, 0);
  assert.equal(got.dropped, 0);
  assert.deepEqual(got.modules.map((m) => m.type), ["text", "question", "question"]);
  assert.equal(got.modules[0].html, "<h2>For discussion</h2>");
  assert.equal(got.modules[1].html, "<p><strong>Romans 8:2</strong> First?</p><p>More</p>");
  assert.equal(got.modules[2].html, "<p><strong>Romans 8:9</strong> Second?</p>");
  for (const q of got.modules.slice(1)) {
    assert.equal(q.answer, "");
    assert.equal(q.lines, 3);
  }
  assert.equal(new Set(got.modules.map((m) => m.id)).size, 3);
  let at = 1;
  for (const m of got.modules) sheet = addModule(sheet, m, at++, ctx);
  assert.deepEqual(validateSheet(sheet), []);
  assert.deepEqual(sheet.modules.map((m) => m.type), ["passage", "text", "question", "question", "text"]);
});

test("lines can be chosen", () => {
  const sheet = sheetOf(passage("romans", 8, 1, 20));
  const got = discussionModules(sheet, [note({})], { lines: 5 });
  assert.equal(got.modules[1].lines, 5);
});

test("gathering again adds only the new questions, without a second heading", () => {
  let sheet = sheetOf(passage("romans", 8, 1, 20));
  const first = note({ id: "a", verse: 2, body: "One?" });
  const g1 = discussionModules(sheet, [first]);
  sheet = g1.modules.reduce((s, m) => addModule(s, m, undefined, ctx), sheet);

  const same = discussionModules(sheet, [first]);
  assert.deepEqual(same.modules, []);
  assert.equal(same.found, 1);
  assert.equal(same.already, 1);

  const second = note({ id: "b", verse: 5, body: "Two?" });
  const g2 = discussionModules(sheet, [first, second]);
  assert.equal(g2.already, 1);
  assert.equal(g2.found, 2);
  assert.deepEqual(g2.modules.map((m) => m.type), ["question"]);
  assert.equal(g2.modules[0].html, "<p><strong>Romans 8:5</strong> Two?</p>");
});

test("a heading left behind with no questions is not a reason to skip a new one", () => {
  const heading = makeModule("text", { html: DISCUSSION_HEADING });
  const sheet = sheetOf(passage("romans", 8, 1, 20), heading);
  const got = discussionModules(sheet, [note({})]);
  assert.deepEqual(got.modules.map((m) => m.type), ["text", "question"]);
});

test("nothing found returns no modules", () => {
  const sheet = sheetOf(passage("romans", 8, 1, 20));
  assert.deepEqual(discussionModules(sheet, []), { modules: [], found: 0, already: 0, dropped: 0 });
  assert.deepEqual(discussionModules(sheet, [note({ marker: "note" })]), { modules: [], found: 0, already: 0, dropped: 0 });
});

test("the sheet's limit on modules is respected, and what didn't fit is counted", () => {
  const filler = Array.from({ length: SHEET_LIMITS.modules - 4 }, () => makeModule("space"));
  const sheet = sheetOf(passage("romans", 8, 1, 20), ...filler);
  assert.equal(sheet.modules.length, SHEET_LIMITS.modules - 3);
  const records = [1, 2, 3, 4, 5].map((v) => note({ id: `q${v}`, verse: v, body: `Q${v}` }));
  const got = discussionModules(sheet, records);
  // Room for three more: the heading and two questions.
  assert.equal(got.modules.length, 3);
  assert.equal(got.dropped, 3);
  assert.equal(got.found, 5);
  assert.equal(got.modules.length + sheet.modules.length, SHEET_LIMITS.modules);

  const full = sheetOf(passage("romans", 8, 1, 20), ...Array.from({ length: SHEET_LIMITS.modules - 1 }, () => makeModule("space")));
  assert.equal(full.modules.length, SHEET_LIMITS.modules);
  const none = discussionModules(full, records);
  assert.deepEqual(none.modules, []);
  assert.equal(none.dropped, 5);
});
