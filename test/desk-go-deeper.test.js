import { test } from "node:test";
import assert from "node:assert/strict";
import { excerpt, notesHere } from "../src/lib/desk-go-deeper.mjs";

const verseNote = (id, bookKey, chapter, verse, body, extra = {}) => ({
  id,
  kind: "note",
  created: "2026-10-01T00:00:00Z",
  bookKey,
  chapter,
  verse,
  body,
  ...extra,
});
const entryNote = (id, glossaryEntry, body, extra = {}) => ({
  id,
  kind: "note",
  created: "2026-10-01T00:00:00Z",
  glossaryEntry,
  targetTitle: "Flesh",
  body,
  ...extra,
});
const articleNote = (id, article, body, extra = {}) => ({
  id,
  kind: "note",
  created: "2026-10-01T00:00:00Z",
  article,
  targetTitle: "Many and All",
  body,
  ...extra,
});

const where = {
  bookKey: "romans",
  chapter: 8,
  terms: [{ id: "flesh-body", label: "Flesh", href: "/glossary/#flesh-body" }],
  articles: [{ slug: "many-and-all", title: "Many and All", href: "/articles/many-and-all/" }],
};

test("an excerpt is plain, short, and cut at a word", () => {
  assert.equal(excerpt("  one\n\ntwo   three "), "one two three");
  assert.equal(excerpt(""), "");
  assert.equal(excerpt(undefined), "");
  const long = excerpt("word ".repeat(60));
  assert.ok(long.endsWith("…") && long.length <= 112, long);
  assert.ok(!/\s…$/.test(long));
  assert.equal(excerpt("a".repeat(300)).length, 111, "a word with no break is cut where it stands");
});

test("a note on a listed glossary entry or article belongs, and says what it is on", () => {
  const records = [entryNote("a", "flesh-body", "Think of Mom"), articleNote("bb", "many-and-all", "Check this")];
  const items = notesHere(records, where);
  assert.deepEqual(
    items.map((i) => [i.kind, i.subject, i.excerpt, i.href]),
    [
      ["term", "My note on Flesh", "Think of Mom", "/glossary/#flesh-body"],
      ["article", "My note on “Many and All”", "Check this", "/articles/many-and-all/"],
    ],
  );
});

test("notes on entries and articles Go deeper doesn't list are left out", () => {
  const records = [entryNote("a", "grace-favor", "x"), articleNote("bb", "other-article", "y")];
  assert.deepEqual(notesHere(records, where), []);
});

test("a note on an article under its old slug follows the rename", () => {
  const items = notesHere([articleNote("a", "old-slug", "kept")], { ...where, renamed: { "old-slug": "many-and-all" } });
  assert.deepEqual(items.map((i) => i.href), ["/articles/many-and-all/"]);
});

test("a note elsewhere that cites this chapter belongs, as a mention", () => {
  const records = [verseNote("a", "john", 3, 16, "Compare Romans 8:3 here"), verseNote("bb", "john", 3, 17, "Nothing to do with it")];
  const items = notesHere(records, where);
  assert.deepEqual(items.map((i) => [i.kind, i.subject, i.href]), [["cites", "My note on John 3:16 mentions this chapter", "/john-3/#v16"]]);
});

test("a note on this chapter itself isn't a mention of it", () => {
  assert.deepEqual(notesHere([verseNote("a", "romans", 8, 3, "See Romans 8:3")], where), []);
});

test("a note on an entry that also cites the chapter is listed once, as a note on the entry", () => {
  const items = notesHere([entryNote("a", "flesh-body", "See Romans 8")], where);
  assert.deepEqual(items.map((i) => i.kind), ["term"]);
});

test("a note on an unlisted entry that cites the chapter is a mention, by its title", () => {
  const items = notesHere([entryNote("a", "grace-favor", "See Romans 8", { targetTitle: "Grace" })], where);
  assert.deepEqual(items.map((i) => [i.subject, i.href]), [["My note on “Grace” mentions this chapter", "/glossary/#grace-favor"]]);
});

test("with no notes, or no body, nothing is invented", () => {
  assert.deepEqual(notesHere([], where), []);
  assert.deepEqual(notesHere(undefined, where), []);
  const items = notesHere([entryNote("a", "flesh-body", "")], where);
  assert.deepEqual(items.map((i) => i.excerpt), [""], "a marker alone is still a note, with no excerpt");
});

test("terms come first in Go deeper's order, then articles, then mentions in Bible order (Mark before Acts)", () => {
  const records = [
    verseNote("m2", "mark", 1, 2, "Romans 8 again"),
    verseNote("m1", "acts", 2, 1, "Romans 8 too"),
    articleNote("art", "many-and-all", "a"),
    entryNote("trm", "flesh-body", "t"),
  ];
  assert.deepEqual(notesHere(records, where).map((i) => i.id), ["trm", "art", "m2", "m1"]);
});
