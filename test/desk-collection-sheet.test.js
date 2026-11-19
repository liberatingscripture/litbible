// test/desk-collection-sheet.test.js
//
// A collection onto a sheet (STUDY-DESK.md, D13: decisions 7, 8 and 20, and
// step 7 of its order of work): src/lib/desk-collection-sheet.mjs. The
// mistakes these tests are for are the ones hard to see in review: a
// bookmark's or highlight's line under the wrong passage or cut off from its
// own, two passages for one verse range, a heading read as a template's
// "Reading" part, a group split at the sheet's limit, the three orders and a
// rule's bookmarks, a skipped sheet's Leader only line in its place, repeats
// against the sheet, and a passage that arrives with an old quote. Every part
// made is put on a sheet and checked by the sheet's own validator.

import { test } from "node:test";
import assert from "node:assert/strict";

import { assembleChapter } from "../src/lib/anchor-core.mjs";
import { createRecord, validateRecord } from "../src/lib/desk-records.mjs";
import { createCollection, headingMember, itemMember, passageMember, ruleMember } from "../src/lib/desk-collections.mjs";
import { SHEET_LIMITS } from "../src/lib/desk-sheet-format.mjs";
import { noteHtml } from "../src/lib/desk-sheet-from-notes.mjs";
import { keyTermsPlacement, readingPart, templateModules } from "../src/lib/desk-sheet-templates.mjs";
import { createSheet, makeModule } from "../src/lib/desk-sheets.mjs";
import {
  bookmarkWords,
  chapterKey,
  collectionChapters,
  collectionSheetParts,
  headingHtml,
  highlightWords,
  skippedSheetWords,
  skippedSheetsNote,
} from "../src/lib/desk-collection-sheet.mjs";

const VERSION = "v20261119.1a2b3c4d";
const ctx = { now: "2026-11-19T09:00:00.000Z", client: "web/2026.11", contentVersion: VERSION };

let counter = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
/** Records made in the order called, so Bible order's ties (by `created`) follow the test's order. */
const make = (kind, fields) => {
  const n = ++counter;
  const now = new Date(Date.UTC(2026, 10, 1, 0, 0, n)).toISOString();
  return createRecord(kind, fields, { ...ctx, now, id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}` });
};

const label = (name) => make("label", { name });
const bookmark = (bookKey, chapter, verse, { endVerse = verse, name = "", labels = [] } = {}) =>
  make("bookmark", { bookKey, chapter, verse, endVerse, label: name, labels });
const highlight = (bookKey, chapter, verse, { endVerse = verse, color = "yellow", exact = "loved" } = {}) =>
  make("highlight", { bookKey, chapter, verse, endVerse, color, quote: { exact, prefix: "", suffix: "" } });
const note = (bookKey, chapter, verse, body = "A thought.", marker = "note") => make("note", { bookKey, chapter, verse, endVerse: verse, body, marker });
const pin = (bookKey, chapter, verse, footnote = "Or “world.”") => make("footnotePin", { bookKey, chapter, verse, footnote, n: 1 });
const sheetRecord = (title, modules = []) => make("sheet", { sheetFormat: 1, title, subtitle: "", template: "blank", commercial: false, modules });
const gloss = () => make("note", { glossaryEntry: "hupotasso", targetTitle: "Hupotasso", body: "No verse here.", marker: "note" });

const passage = (bookKey, chapter, verse, endVerse = verse) => passageMember({ bookKey, chapter, verse, endVerse }, { id: nextId() });
const item = (record) => itemMember(record.id, { id: nextId() });
const heading = (text) => headingMember(text, { id: nextId() });
const rule = (labelRecord) => ruleMember(labelRecord.id, { id: nextId() });

/** A collection holding `members`, in `order`. */
function collectionOf(members, order = "bible") {
  const c = createCollection({ name: "Advent series", members }, { ...ctx, id: nextId() });
  return { ...c, order };
}

// John 3:14–18 and Romans 8:1–2, as anchor text.
const john3 = assembleChapter(
  new Map([
    [14, "And just as Moses lifted up the serpent in the wilderness,"],
    [15, "so that everyone who trusts may have life of the age."],
    [16, "For God so loved the world that God gave the only Child."],
    [17, "For God did not send the Child into the world to condemn the world."],
    [18, "Whoever trusts in the Child is not condemned."],
  ]),
);
const romans8 = assembleChapter(
  new Map([
    [1, "There is therefore now no condemnation."],
    [2, "For the law of the Spirit of life has set you free."],
  ]),
);
const chapters = new Map([
  [chapterKey("john", 3), john3],
  [chapterKey("romans", 8), romans8],
]);

const plain = (html) => html.replace(/<[^>]+>/g, "").replace(/\u2060/g, "");

/** Each part in a few characters, so a block reads at a glance. */
function show(parts) {
  return parts.map((m) => {
    if (m.type === "passage") return `P ${m.bookKey} ${m.chapter}:${m.verse}${m.endVerse !== m.verse ? `-${m.endVerse}` : ""}`;
    if (m.type === "question") return `Q ${plain(m.html)}`;
    if (m.type === "text" && m.html.startsWith("<h2>")) return `# ${plain(m.html)}`;
    if (m.type === "text") return `${m.leaderOnly ? "L" : "T"} ${plain(m.html)}`;
    return m.type;
  });
}

/** The parts on a sheet after `existing`, checked by the sheet's own validator; returns the sheet. */
function assertValid(parts, existing = []) {
  const sheet = createSheet({ title: "Made from a collection", template: "blank", modules: [...existing, ...parts] }, ctx);
  assert.deepEqual(validateRecord(sheet), [], "the sheet is valid");
  assert.equal(new Set(sheet.modules.map((m) => m.id)).size, sheet.modules.length, "every part has its own id");
  for (const m of parts) if (m.type === "passage") assert.equal("quote" in m, false, "a passage is whole verses");
  return sheet;
}

const convert = (c, records, sheet = null, opts = {}) => collectionSheetParts(c, records, sheet, { chapters, contentVersion: VERSION, ...opts });

/* ── A passage and its lines ─────────────────────────────────────────── */

test("a bookmark and a highlight on the same verses share one passage, each line under it", () => {
  const advent = label("Advent");
  const h = highlight("john", 3, 16);
  const b = bookmark("john", 3, 16, { name: "Hope", labels: [advent.id] });
  const c = collectionOf([item(b), passage("john", 3, 16), item(h)]);
  const records = [advent, h, b, c];
  const got = convert(c, records);
  assert.deepEqual(show(got.parts), ["P john 3:16", "T Highlighted yellow", "T Bookmark “Hope,” labeled Advent"]);
  assert.deepEqual([got.added, got.alreadyOn, got.leftOut, got.skippedSheets, got.limit], [3, 0, 0, [], null]);
  assertValid(got.parts);
});

test("a line is never put under a passage of other verses", () => {
  const h16 = highlight("john", 3, 16);
  const h17 = highlight("john", 3, 17, { color: "green", exact: "did not send" });
  const b1618 = bookmark("john", 3, 16, { endVerse: 18, name: "Love" });
  // Bible order: the two passages starting at 16 come before the records on 16.
  const c = collectionOf([item(b1618), item(h17), item(h16), passage("john", 3, 16, 18), passage("john", 3, 16)]);
  const got = convert(c, [h16, h17, b1618, c]);
  assert.deepEqual(show(got.parts), [
    "P john 3:16",
    "P john 3:16-18",
    // Its passage is further up, so the line stays in its place and names its verses.
    "T John 3:16 Highlighted yellow",
    "T John 3:16–18 Bookmark “Love”",
    "P john 3:17",
    "T Highlighted green",
  ]);
  assert.equal(got.parts.filter((m) => m.type === "passage").length, 3);
  assert.equal(got.parts[2].html, "<p><strong>John 3:16</strong> Highlighted yellow</p>");
  assert.equal(got.added, 5);
  assertValid(got.parts);
});

test("two passages are never made for one verse range, in any order", () => {
  const h = highlight("john", 3, 16);
  const b = bookmark("john", 3, 16, { name: "Hope" });
  const members = [item(h), passage("john", 3, 16), item(b)];
  const c = collectionOf(members);
  const records = [h, b, c];
  // By type: Passages, then Highlights, then Bookmarks; the group names make no part, so the three are neighbors.
  const byType = convert({ ...c, order: "type" }, records);
  assert.deepEqual(show(byType.parts), ["P john 3:16", "T Highlighted yellow", "T Bookmark “Hope”"]);
  // My order with a heading between: the bookmark keeps its place under the heading, and names its verses.
  const mine = convert(collectionOf([item(h), heading("Week 2"), item(b), passage("john", 3, 16)], "mine"), records);
  assert.deepEqual(show(mine.parts), ["P john 3:16", "T Highlighted yellow", "# Week 2", "T John 3:16 Bookmark “Hope”"]);
  assert.equal(mine.added, 3, "the passage member rides on the passage the highlight made");
  for (const got of [byType, mine]) {
    assert.equal(got.parts.filter((m) => m.type === "passage").length, 1);
    assertValid(got.parts);
  }
});

test("a line a group has already is said once", () => {
  const a = highlight("john", 3, 16, { exact: "For God so" });
  const b = highlight("john", 3, 16, { exact: "the world that" });
  const bare = bookmark("john", 3, 16);
  const c = collectionOf([item(a), item(b), item(bare)]);
  const got = convert(c, [a, b, bare, c]);
  assert.deepEqual(show(got.parts), ["P john 3:16", "T Highlighted yellow"]);
  assert.equal(got.added, 3);
});

test("the lines' words: a bookmark's name and labels, whichever it has, and a highlight's color", () => {
  const [a, l, e] = [label("Advent"), label("Lent"), label("Easter")];
  const labels = [a, l, e];
  const words = (name, ids) => bookmarkWords({ kind: "bookmark", label: name, labels: ids }, labels);
  assert.equal(words("Hope", [a.id]), "Bookmark “Hope,” labeled Advent");
  assert.equal(words("Hope", [a.id, l.id]), "Bookmark “Hope,” labeled Advent and Lent");
  assert.equal(words("Hope", [a.id, l.id, e.id]), "Bookmark “Hope,” labeled Advent, Lent, and Easter");
  assert.equal(words("Hope", []), "Bookmark “Hope”");
  assert.equal(words("", [l.id]), "Bookmark labeled Lent");
  assert.equal(words("  ", ["gone"]), "", "a label id with no label is not named");
  assert.equal(words("Start here.", [a.id]), "Bookmark “Start here,” labeled Advent");
  assert.equal(words("Why?", [a.id]), "Bookmark “Why?” labeled Advent");
  assert.equal(highlightWords({ color: "pink" }), "Highlighted pink");
  assert.equal(highlightWords({ color: "mauve" }), "Highlighted");
  // Escaped, never read as markup.
  const b = bookmark("john", 3, 16, { name: "<b>bold</b> & co" });
  const c = collectionOf([item(b)]);
  const got = convert(c, [b, c]);
  assert.equal(got.parts[1].html, "<p>Bookmark “&lt;b&gt;bold&lt;/b&gt; &amp; co”</p>");
});

/* ── Notes and pinned footnotes ──────────────────────────────────────── */

test("notes and pinned footnotes become the parts “+ From my notes…” makes, a note with no verse included", () => {
  const q = note("john", 3, 15, "Why the serpent?", "question");
  const n = note("john", 3, 14, "First.\n\nSecond.");
  const p = pin("john", 3, 16);
  const g = gloss();
  const c = collectionOf([item(q), item(n), item(p), item(g)]);
  const got = convert(c, [q, n, p, g, c], null, { lines: 5 });
  assert.deepEqual(show(got.parts), ["T John 3:14 First.Second.", "Q John 3:15 Why the serpent?", "T John 3:16 Or “world.”", "T Glossary: Hupotasso No verse here."]);
  assert.equal(got.parts[0].html, noteHtml(n));
  assert.equal(got.parts[1].lines, 5);
  assert.equal(got.parts[1].answer, "");
  assert.equal(got.added, 4);
  assertValid(got.parts);
});

/* ── Headings ────────────────────────────────────────────────────────── */

test("a heading is an <h2> that a template never takes for its Reading part", () => {
  for (const words of ["Reading", "read", "The  text", "THE READING"]) {
    const html = headingHtml(words);
    assert.notEqual(html, `<h2>${words.replace(/\s+/g, " ")}</h2>`);
    assert.equal(plain(html), words.replace(/\s+/g, " "), "the words are the reader's, unchanged");
    const m = makeModule("text", { html });
    assert.equal(m.html, html, "already in the canonical form");
    assert.equal(readingPart({ modules: [m] }), null, words);
  }
  assert.equal(headingHtml("Week 1"), "<h2>Week 1</h2>");
  assert.equal(headingHtml("Readings for <Advent>"), "<h2>Readings for &lt;Advent&gt;</h2>");
  assert.equal(headingHtml("   "), "");

  // A collection of notes alone under a "Reading" heading, on a sheet with no passage.
  const n = note("romans", 8, 1);
  const c = collectionOf([heading("Reading"), item(n), heading(""), heading("Discussion")], "mine");
  const got = convert(c, [n, c]);
  assert.deepEqual(show(got.parts), ["# Reading", "T Romans 8:1 A thought.", "# Discussion"]);
  assert.equal(readingPart({ modules: got.parts }), null, "no part of the block is the reading");
  assertValid(got.parts);

  // On a template's sheet, its own reading part is still the one found.
  const template = templateModules("bible-study");
  const own = readingPart({ modules: template });
  assert.ok(own);
  assert.equal(readingPart({ modules: [...template, ...got.parts] }), own);

  // And with a passage under it, the key terms box measures the reading from the passage, not the heading.
  const h = highlight("john", 3, 16);
  const c2 = collectionOf([heading("Reading"), item(h)], "mine");
  const block = convert(c2, [h, c2]).parts;
  const placed = keyTermsPlacement({ modules: [makeModule("keyTerms"), ...block] });
  assert.equal(placed.before, 1, "the box's place before the reading is after the heading, at the passage");
});

/* ── The three orders, and a rule's bookmarks ────────────────────────── */

test("the parts follow the page's order: Bible order, By type, and My order", () => {
  const advent = sheetRecord("Advent week 1");
  const b = bookmark("romans", 8, 1, { name: "Freedom" });
  const q = note("john", 3, 14, "Who is lifted up?", "question");
  const h = highlight("john", 3, 18, { color: "blue", exact: "Whoever trusts" });
  const members = [item(b), heading("First"), passage("john", 3, 16), item(q), item(advent), item(h)];
  const records = [advent, b, q, h];
  const c = collectionOf(members);
  records.push(c);

  assert.deepEqual(show(convert(c, records).parts), [
    "L Also in this collection: the sheet “Advent week 1.”",
    "Q John 3:14 Who is lifted up?",
    "P john 3:16",
    "P john 3:18",
    "T Highlighted blue",
    "P romans 8:1",
    "T Bookmark “Freedom”",
  ]);
  assert.deepEqual(show(convert({ ...c, order: "type" }, records).parts), [
    "L Also in this collection: the sheet “Advent week 1.”",
    "P john 3:16",
    "Q John 3:14 Who is lifted up?",
    "P john 3:18",
    "T Highlighted blue",
    "P romans 8:1",
    "T Bookmark “Freedom”",
  ]);
  const mine = convert({ ...c, order: "mine" }, records);
  assert.deepEqual(show(mine.parts), [
    "P romans 8:1",
    "T Bookmark “Freedom”",
    "# First",
    "P john 3:16",
    "Q John 3:14 Who is lifted up?",
    "L Also in this collection: the sheet “Advent week 1.”",
    "P john 3:18",
    "T Highlighted blue",
  ]);
  // The collection's own order is the default; `order` overrides it, as the page's switch would.
  assert.deepEqual(show(convert({ ...c, order: "mine" }, records, null, { order: "bible" }).parts)[0], "L Also in this collection: the sheet “Advent week 1.”");
  // An order this code doesn't know is shown as Bible order, as the page shows it.
  assert.deepEqual(show(convert({ ...c, order: "someday" }, records).parts), show(convert(c, records).parts));
  for (const order of ["bible", "type", "mine"]) assertValid(convert({ ...c, order }, records).parts);
});

test("a rule's bookmarks come as the page shows them, its left-out ones not at all", () => {
  const advent = label("Advent");
  const lent = label("Lent");
  const b1 = bookmark("romans", 8, 1, { labels: [advent.id] });
  const b2 = bookmark("john", 3, 16, { name: "Hope", labels: [advent.id, lent.id] });
  const out = bookmark("john", 3, 17, { labels: [advent.id] });
  const other = bookmark("john", 3, 18, { labels: [lent.id] });
  const r = { ...rule(advent), except: [out.id] };
  const c = collectionOf([passage("john", 3, 14), r]);
  const records = [advent, lent, b1, b2, out, other, c];
  const bible = convert(c, records);
  assert.deepEqual(show(bible.parts), ["P john 3:14", "P john 3:16", "T Bookmark “Hope,” labeled Advent and Lent", "P romans 8:1", "T Bookmark labeled Advent"]);
  // In My order a rule's bookmarks come after every member, in Bible order.
  const mine = convert(collectionOf([r, heading("Week 1"), passage("romans", 8, 2)], "mine"), records);
  assert.deepEqual(show(mine.parts), ["# Week 1", "P romans 8:2", "P john 3:16", "T Bookmark “Hope,” labeled Advent and Lent", "P romans 8:1", "T Bookmark labeled Advent"]);
  assert.equal(bible.added, 3);
  assertValid(bible.parts);
});

/* ── Sheets ──────────────────────────────────────────────────────────── */

test("a sheet is skipped, named in a Leader only line where it sat, and returned so the reader is told", () => {
  const s1 = sheetRecord("Advent week 1");
  const s2 = sheetRecord("   ");
  const s3 = sheetRecord("Why Advent?");
  const n1 = note("john", 3, 14, "Before.");
  const n2 = note("john", 3, 15, "After.");
  const c = collectionOf([item(n1), item(s1), item(n2), item(s2), item(s3)], "mine");
  const got = convert(c, [s1, s2, s3, n1, n2, c]);
  assert.deepEqual(show(got.parts), [
    "T John 3:14 Before.",
    "L Also in this collection: the sheet “Advent week 1.”",
    "T John 3:15 After.",
    "L Also in this collection: an untitled sheet.",
    "L Also in this collection: the sheet “Why Advent?”",
  ]);
  assert.equal(got.parts[1].leaderOnly, true);
  assert.equal(got.parts[0].leaderOnly, undefined, "only the sheets' lines are Leader only");
  assert.deepEqual(got.skippedSheets, [
    { id: s1.id, title: "Advent week 1" },
    { id: s2.id, title: "Untitled sheet" },
    { id: s3.id, title: "Why Advent?" },
  ]);
  assert.equal(got.added, 2, "the sheets are counted apart");
  assert.equal(skippedSheetWords({ title: "Week 2" }), "Also in this collection: the sheet “Week 2.”");
  assert.equal(skippedSheetsNote(2), "2 sheets weren’t added; each is a sheet of its own.");
  assert.equal(skippedSheetsNote(1), "1 sheet wasn’t added; it is a sheet of its own.");
  assert.equal(skippedSheetsNote(0), "");
  assertValid(got.parts);
});

/* ── Repeats against the sheet ───────────────────────────────────────── */

test("verses the sheet holds get no second passage, and their lines name their verses", () => {
  const n = note("john", 3, 14);
  const h = highlight("john", 3, 16);
  const b = bookmark("john", 3, 18, { name: "Trust" });
  const c = collectionOf([passage("john", 3, 16), item(h), item(n), passage("john", 3, 17), item(b)]);
  const records = [n, h, b, c];
  const existing = [
    makeModule("passage", { bookKey: "john", chapter: 3, verse: 16, endVerse: 16 }),
    makeModule("text", { html: noteHtml(n) }),
    // Part of verse 18 counts as holding verse 18: repeats are checked by verses.
    makeModule("passage", { bookKey: "john", chapter: 3, verse: 18, endVerse: 18, quote: { exact: "Whoever trusts", prefix: "", suffix: " in the Child" } }),
  ];
  const got = convert(c, records, { modules: existing });
  assert.deepEqual(show(got.parts), ["T John 3:16 Highlighted yellow", "P john 3:17", "T John 3:18 Bookmark “Trust”"]);
  assert.deepEqual([got.added, got.alreadyOn, got.leftOut], [3, 2, 0]);
  assertValid(got.parts, existing);
});

test("adding the same collection to the same sheet twice adds nothing the second time", () => {
  const advent = label("Advent");
  const s = sheetRecord("Advent week 1");
  const n = note("john", 3, 14);
  const h = highlight("john", 3, 16);
  const b = bookmark("john", 3, 16, { name: "Hope", labels: [advent.id] });
  const far = bookmark("john", 3, 16, { name: "Again" });
  const c = collectionOf([heading("Week 1"), item(h), item(b), item(s), heading("Week 2"), item(n), item(far), passage("romans", 8, 1)], "mine");
  const records = [advent, s, n, h, b, far, c];
  const first = convert(c, records, { modules: [] });
  assert.deepEqual(show(first.parts), [
    "# Week 1",
    "P john 3:16",
    "T Highlighted yellow",
    "T Bookmark “Hope,” labeled Advent",
    "L Also in this collection: the sheet “Advent week 1.”",
    "# Week 2",
    "T John 3:14 A thought.",
    "T John 3:16 Bookmark “Again”",
    "P romans 8:1",
  ]);
  const sheet = assertValid(first.parts);
  const second = convert(c, records, sheet);
  assert.deepEqual(second.parts, []);
  assert.deepEqual([second.added, second.alreadyOn, second.leftOut, second.skippedSheets.length], [0, 5, 0, 1]);
  // A heading the sheet holds is added again when something new is under it.
  const n2 = note("romans", 8, 2, "New since.");
  const grown = { ...c, members: [...c.members, item(n2)] };
  const third = convert(grown, [...records, n2], sheet);
  assert.deepEqual(show(third.parts), ["# Week 2", "T Romans 8:2 New since."]);
});

/* ── Whole verses ────────────────────────────────────────────────────── */

test("a passage that arrives with an old quote, and a highlight on part of a verse, are whole verses", () => {
  const old = { ...passage("john", 3, 17), quote: { exact: "did not send", prefix: "For God ", suffix: " the Child" } };
  const h = highlight("john", 3, 16, { exact: "so loved the world" });
  const c = collectionOf([old, item(h)]);
  const got = convert(c, [h, c]);
  assert.deepEqual(show(got.parts), ["P john 3:16", "T Highlighted yellow", "P john 3:17"]);
  const [p16, , p17] = got.parts;
  assert.equal(p16.verseCopy, "For God so loved the world that God gave the only Child.");
  assert.equal(p17.verseCopy, "For God did not send the Child into the world to condemn the world.");
  assert.equal(p17.verseCopyAsOf, VERSION);
  assert.deepEqual([p17.blanks, p17.footnotes], [[], []]);
  assertValid(got.parts);
});

test("chapters: the ones a collection needs are listed once, in Bible order, and read through a Map or a function", () => {
  const advent = label("Advent");
  const b = bookmark("romans", 8, 2, { labels: [advent.id] });
  const h = highlight("john", 3, 16);
  const n = note("acts", 2, 1);
  const c = collectionOf([item(b), passage("john", 3, 14), item(h), item(n), rule(advent), passage("romans", 8, 1)]);
  const records = [advent, b, h, n, c];
  assert.deepEqual(collectionChapters(c, records), [
    { bookKey: "john", chapter: 3 },
    { bookKey: "romans", chapter: 8 },
  ]);
  assert.deepEqual(collectionChapters(collectionOf([]), []), []);

  const asked = [];
  const viaFunction = collectionSheetParts(c, records, null, {
    chapters: (bookKey, chapter) => {
      asked.push(`${bookKey} ${chapter}`);
      return chapters.get(chapterKey(bookKey, chapter));
    },
    contentVersion: VERSION,
  });
  assert.ok(!asked.includes("acts 2"), "a note's chapter isn't read");
  assert.deepEqual(viaFunction.parts.map((m) => m.verseCopy ?? null), convert(c, records).parts.map((m) => m.verseCopy ?? null));
  // A chapter that couldn't be read: the passage is still made, with no comparison copy.
  const unread = collectionSheetParts(c, records, null, { contentVersion: VERSION });
  assert.ok(unread.parts.filter((m) => m.type === "passage").every((m) => !("verseCopy" in m)));
  assertValid(unread.parts);
});

/* ── The sheet's limits ──────────────────────────────────────────────── */

const filler = (n) => Array.from({ length: n }, () => makeModule("space", { lines: 1 }));

test("a passage and its lines never split at the 300-part limit; the block stops before them", () => {
  const n = note("john", 3, 14);
  const h = highlight("john", 3, 16);
  const b = bookmark("john", 3, 16, { name: "Hope" });
  const later = note("romans", 8, 1);
  const c = collectionOf([item(n), item(h), item(b), item(later)]);
  const records = [n, h, b, later, c];

  // Room for 3: the note fits, the group of three doesn't, and nothing after it is added.
  const existing = filler(SHEET_LIMITS.modules - 3);
  const got = convert(c, records, { modules: existing });
  assert.deepEqual(show(got.parts), ["T John 3:14 A thought."]);
  assert.deepEqual([got.added, got.alreadyOn, got.leftOut, got.limit], [1, 0, 3, "parts"]);
  assertValid(got.parts, existing);

  // Room for 4: everything.
  const roomy = convert(c, records, { modules: filler(SHEET_LIMITS.modules - 5) });
  assert.equal(roomy.parts.length, 5);
  assert.equal(roomy.limit, null);

  // A heading is never left last when what follows it didn't fit.
  const mine = collectionOf([item(n), heading("Week 2"), item(h), item(b)], "mine");
  const cut = convert(mine, [n, h, b, mine], { modules: filler(SHEET_LIMITS.modules - 2) });
  assert.deepEqual(show(cut.parts), ["T John 3:14 A thought."]);
  assert.equal(cut.leftOut, 2);

  // A full sheet takes nothing.
  const full = convert(c, records, { modules: filler(SHEET_LIMITS.modules) });
  assert.deepEqual([full.parts, full.leftOut, full.limit], [[], 4, "parts"]);
});

test("the sheet's size is a limit too, and a group never splits there either", () => {
  const n = note("john", 3, 14);
  const h = highlight("john", 3, 16);
  const c = collectionOf([item(n), item(h)]);
  const records = [n, h, c];
  const long = assembleChapter(new Map([[14, "Short."], [16, "x".repeat(4000)]]));
  const base = createSheet({ title: "Big", template: "blank", modules: [] }, ctx);
  const baseBytes = new TextEncoder().encode(JSON.stringify(base)).length;
  // Text that leaves about 2,800 bytes past the 2 KB kept for the sheet's own fields.
  const big = makeModule("text", { html: `<p>${"y".repeat(SHEET_LIMITS.bytes - baseBytes - 2048 - 2800)}</p>` });
  const sheet = { ...base, modules: [big] };
  const got = collectionSheetParts(c, records, sheet, { chapters: new Map([[chapterKey("john", 3), long]]), contentVersion: VERSION });
  assert.deepEqual(show(got.parts), ["T John 3:14 A thought."]);
  assert.deepEqual([got.added, got.leftOut, got.limit], [1, 1, "size"]);
  assertValid(got.parts, [big]);
});

test("nothing to make from nothing", () => {
  const empty = convert(collectionOf([]), []);
  assert.deepEqual(empty, { parts: [], added: 0, alreadyOn: 0, leftOut: 0, skippedSheets: [], limit: null });
  assert.deepEqual(collectionSheetParts(null, null, null).parts, []);
  // A record in the trash, or gone, isn't shown on the page, so it isn't on the sheet either.
  const gone = collectionOf([itemMember("missing", { id: nextId() })]);
  assert.deepEqual(convert(gone, [gone]).parts, []);
});
