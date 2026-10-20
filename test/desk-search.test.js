import { test } from "node:test";
import assert from "node:assert/strict";
import { notebookSearchHref, searchNotebook, searchTokens, snippetParts } from "../src/lib/desk-search.mjs";

const base = { schema: 1, created: "2026-10-01T00:00:00Z", modified: "2026-10-01T00:00:00Z", client: "web/test", contentVersion: "v1", labels: [] };
const note = (id, bookKey, chapter, verse, body, extra = {}) => ({ ...base, id, kind: "note", bookKey, chapter, verse, body, marker: "note", ...extra });
const prose = (id, body, extra) => ({ ...base, id, kind: "note", body, marker: "note", ...extra });

test("a query is folded into word tokens, and a lone letter is dropped beside longer words", () => {
  assert.deepEqual(searchTokens("Lemá  Sabachthani"), ["lema", "sabachthani"]);
  assert.deepEqual(searchTokens("God’s reign"), ["god", "reign"]);
  assert.deepEqual(searchTokens("a"), ["a"]);
  assert.deepEqual(searchTokens("  "), []);
});

test("words match by their beginning, ignoring case and accents, and every word must be there", () => {
  const records = [note("a", "romans", 8, 3, "On LIBERATION from the law"), note("b", "romans", 8, 4, "Law only")];
  assert.deepEqual(searchNotebook(records, "liber").map((h) => h.id), ["a"]);
  assert.deepEqual(searchNotebook(records, "law").map((h) => h.id), ["a", "b"]);
  assert.deepEqual(searchNotebook(records, "law liberation").map((h) => h.id), ["a"]);
  assert.deepEqual(searchNotebook(records, "iberation"), [], "not mid-word");
  assert.deepEqual(searchNotebook([note("c", "john", 1, 1, "Logós")], "logos").map((h) => h.id), ["c"]);
  assert.deepEqual(searchNotebook(records, ""), []);
});

test("results come in Bible order, then glossary notes, then article notes", () => {
  const records = [
    prose("art", "grace here", { article: "grace-article", targetTitle: "Grace" }),
    prose("gl", "grace here", { glossaryEntry: "grace", targetTitle: "Grace entry" }),
    note("late", "romans", 12, 1, "grace"),
    note("early", "matthew", 5, 3, "grace"),
    note("mid", "romans", 8, 2, "grace"),
  ];
  assert.deepEqual(searchNotebook(records, "grace").map((h) => h.id), ["early", "mid", "late", "gl", "art"]);
  const onEntry = searchNotebook(records, "grace").find((h) => h.id === "gl");
  assert.equal(onEntry.reference, "Glossary: Grace entry");
  assert.equal(onEntry.href, "/glossary/#grace");
});

test("each kind is found by its own words, and a hidden or trashed record never is", () => {
  const records = [
    { ...base, id: "h", kind: "highlight", bookKey: "john", chapter: 3, verse: 16, color: "yellow", quote: { exact: "loved the world", prefix: "", suffix: "" } },
    { ...base, id: "b", kind: "bookmark", bookKey: "john", chapter: 3, verse: 17, label: "Sunday world sermon" },
    { ...base, id: "p", kind: "place", bookKey: "john", chapter: 3, verse: 1, name: "World ribbon", ribbon: true },
    { ...base, id: "f", kind: "footnotePin", bookKey: "john", chapter: 3, verse: 16, footnote: "The world here means all", n: 1 },
    { ...base, id: "x", kind: "hidden", bookKey: "john", chapter: 3, verse: 18, body: "world, brace for this" },
    { ...base, id: "t", kind: "trash", deletedId: "n", deletedKind: "note", deletedAt: base.created, record: note("n", "john", 3, 2, "world") },
    note("n2", "john", 3, 2, "no match"),
  ];
  const hits = searchNotebook(records, "world");
  assert.deepEqual(hits.map((h) => h.id), ["p", "h", "f", "b"]);
  assert.equal(hits.find((h) => h.id === "p").label, "Ribbon");
  assert.equal(hits.find((h) => h.id === "f").label, "Pinned footnote");
  assert.equal(hits[0].reference, "John 3:1");
  assert.equal(hits[0].href, "/john-3/#v1");
});

test("a label name finds the records that carry it, and says so", () => {
  const records = [
    { ...base, id: "L", kind: "label", name: "Thursday group" },
    note("a", "luke", 15, 11, "The lost son", { labels: ["L"] }),
    note("b", "luke", 15, 4, "The lost sheep"),
  ];
  const hits = searchNotebook(records, "thursday");
  assert.deepEqual(hits.map((h) => h.id), ["a"]);
  assert.equal(hits[0].parts.map((p) => p.text).join(""), "Label: Thursday group");
  assert.deepEqual(searchNotebook(records, "lost thursday").map((h) => h.id), ["a"], "the body and the label together");
  assert.equal(hits[0].kind, "note");
});

test("the book filter keeps one book's records", () => {
  const records = [note("a", "luke", 1, 1, "word"), note("b", "john", 1, 1, "word")];
  assert.deepEqual(searchNotebook(records, "word", { bookKey: "john" }).map((h) => h.id), ["b"]);
});

test("a snippet is parts to draw: the match marked, the cut shown, no HTML made", () => {
  const text = "<b>Before</b> the long preface that runs on and on and on before it ever reaches the point, which is liberation, and then more words follow after it for a good while, and then a great many more words follow after those words as well, so that the cut is certain";
  const parts = snippetParts(text, ["liber"]);
  assert.deepEqual(parts.filter((p) => p.mark).map((p) => p.text), ["liberation"]);
  assert.ok(parts[0].text.startsWith("…"), "cut at the start");
  assert.ok(parts.at(-1).text.endsWith("…"), "and at the end");
  assert.equal(snippetParts("nothing here", ["liber"]), null);
  const short = snippetParts("A line\nover two\n\nlines", ["two"]);
  assert.equal(short.map((p) => p.text).join(""), "A line over two lines", "whitespace collapsed");
  assert.ok(!short[0].text.startsWith("…"));
});

test("the notebook page's address carries the query", () => {
  assert.equal(notebookSearchHref("grace & peace"), "/notebook/?q=grace%20%26%20peace");
  assert.equal(notebookSearchHref("  "), "/notebook/");
});

test("a note on a footnote is found by the words of its footnote", () => {
  const onFn = note("fn", "romans", 8, 3, "My own reading of it", { footnote: "The Greek sarx means flesh here." });
  assert.deepEqual(searchNotebook([onFn], "sarx").map((h) => h.id), ["fn"]);
  assert.deepEqual(searchNotebook([onFn], "reading").map((h) => h.id), ["fn"], "its own words still count");
});
