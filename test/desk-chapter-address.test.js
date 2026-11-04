// A stored book key must never become an address (SEC-1 of the 2026-11-03
// audit). A record from a newer schema, or a sheet in a newer format, is
// carried untouched without its fields being checked (validateRecord stops at
// canEdit), so `bookKey` can hold anything a backup file or a sync brought.
// "/attacker.example/x" in `/${bookKey}-1/` is `//attacker.example/x-1/`, an
// address on another site, which a sheet's passage fetched and imported into
// the page. Every place that builds a chapter's address from a stored value
// asks desk-passage.mjs first; these tests hold the rule and each sink.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BOOKS, BOOK_ORDER } from "../src/data/books.js";
import { chapterPath, isChapterAddress } from "../src/lib/desk-passage.mjs";
import { recordHref, recordReadHref } from "../src/lib/desk-store-core.mjs";
import { chapterCodes } from "../src/lib/desk-sheet-copy.mjs";
import { parseImport, planImport } from "../src/lib/desk-export.mjs";

const BAD_BOOKS = [
  "/attacker.example/x",
  "//attacker.example/x",
  "https://attacker.example/x",
  "\\\\attacker.example\\x",
  "..",
  "john/../x",
  "john/",
  "JOHN",
  " john",
  "john ",
  "",
  "__proto__",
  "constructor",
  "toString",
  "hasOwnProperty",
  null,
  undefined,
  5,
  {},
  ["john"],
];

const BAD_CHAPTERS = [0, -1, 1.5, NaN, Infinity, "3", "3a", null, undefined, {}, 22];

test("isChapterAddress and chapterPath accept every real chapter and nothing that leaves the site", () => {
  let n = 0;
  for (const bookKey of BOOK_ORDER) {
    for (let chapter = 1; chapter <= BOOKS[bookKey]; chapter++) {
      assert.equal(isChapterAddress(bookKey, chapter), true, `${bookKey} ${chapter}`);
      const path = chapterPath(bookKey, chapter);
      // One slash in front, no scheme, no host, no second slash, no dots.
      assert.match(path, /^\/[a-z0-9]+-\d+\/$/, `${bookKey} ${chapter}`);
      n++;
    }
  }
  assert.equal(n, 260);
  assert.equal(chapterPath("john", 3), "/john-3/");
  assert.equal(chapterPath("1corinthians", 13), "/1corinthians-13/");
});

test("isChapterAddress refuses an unknown book, a prototype name, or a chapter the book lacks", () => {
  for (const bookKey of BAD_BOOKS) {
    assert.equal(isChapterAddress(bookKey, 1), false, `book ${JSON.stringify(bookKey)}`);
    assert.equal(chapterPath(bookKey, 1), null, `book ${JSON.stringify(bookKey)}`);
  }
  for (const chapter of BAD_CHAPTERS) {
    const book = chapter === 22 ? "john" : "romans"; // John has 21 chapters
    assert.equal(isChapterAddress(book, chapter), false, `chapter ${JSON.stringify(chapter)}`);
    assert.equal(chapterPath(book, chapter), null, `chapter ${JSON.stringify(chapter)}`);
  }
  assert.equal(isChapterAddress("john", 21), true);
  assert.equal(isChapterAddress("john", 22), false);
});

test("recordHref and recordReadHref give no link for a record whose book key is not a book", () => {
  // The audit's note: schema 2, so validateRecord never looked at its fields.
  const note = { kind: "note", schema: 2, bookKey: "/evil.example/john", chapter: 3, verse: 16 };
  assert.equal(recordHref(note), null);
  assert.equal(recordReadHref(note), null);
  assert.equal(recordHref({ ...note, bookKey: "john", chapter: 99 }), null);
  assert.equal(recordReadHref({ ...note, bookKey: "john", chapter: 99 }), null);
  assert.equal(recordHref({ ...note, bookKey: "__proto__" }), null);
  // A real record is unchanged.
  const real = { kind: "note", schema: 1, bookKey: "john", chapter: 3, verse: 16 };
  assert.equal(recordHref(real), "/john-3/#v16");
  assert.equal(recordHref({ ...real, endVerse: 18 }), "/john-3/#v16-18");
  assert.equal(recordHref({ ...real, verse: undefined }), "/john-3/");
  assert.equal(recordReadHref(real), "/read/john/#john-3-v16");
  assert.equal(recordReadHref({ ...real, verse: undefined }), "/read/john/#ch-3");
});

test("chapterCodes prints no code for a passage that names no chapter", () => {
  const modules = [
    { id: "m1", type: "passage", bookKey: "/attacker.example/x", chapter: 1, verse: 1 },
    { id: "m2", type: "passage", bookKey: "john", chapter: 99, verse: 1 },
    { id: "m3", type: "passage", bookKey: "romans", chapter: 8, verse: 1 },
  ];
  const codes = chapterCodes(modules);
  assert.deepEqual(
    codes.map((c) => c.key),
    ["romans-8"],
  );
  assert.equal(codes[0].url, "https://litbible.net/romans-8/#v1");
});

test("a newer-format sheet with a poisoned passage is carried untouched on import, and refused at every address", () => {
  const T = "2026-11-01T00:00:00.000Z";
  const poisoned = (over) => ({
    id: "poisoned-sheet-1",
    kind: "sheet",
    schema: 1,
    created: T,
    modified: T,
    client: "x",
    contentVersion: "unversioned",
    labels: [],
    sheetFormat: 2, // a format this code can't edit, so it isn't field-checked
    title: "Lent week 1",
    subtitle: "",
    template: "blank",
    modules: [{ id: "m1", type: "passage", bookKey: "/attacker.example/x", chapter: 1, verse: 1, blanks: [], footnotes: [] }],
    ...over,
  });
  for (const variant of [{}, { sheetFormat: 1, schema: 2 }]) {
    const record = poisoned(variant);
    const file = JSON.stringify({ format: "lit-notebook", version: 1, exported: T, records: [record] });
    const read = parseImport(file, {});
    const planned = planImport([], read.records, { now: "2026-11-03T00:00:00.000Z", exported: read.exported });
    const put = planned.plan.put.find((r) => r.id === record.id);
    // Principle 6: what this code can't edit is kept, whole, for the client that can.
    assert.ok(put, `kept: ${JSON.stringify(variant)}`);
    assert.equal(put.modules[0].bookKey, "/attacker.example/x");
    // But nothing builds an address from it.
    const m = put.modules[0];
    assert.equal(chapterPath(m.bookKey, m.chapter), null);
    assert.deepEqual(chapterCodes(put.modules), []);
    assert.equal(recordHref({ ...put, bookKey: m.bookKey, chapter: m.chapter }), null);
  }
});

test("chapter-page.js builds its fetch address only through chapterPath, and refuses before it fetches", () => {
  // The module reads import.meta.env, which node:test has no value for, so this
  // reads its source: the one fetch of a chapter page must stay behind the guard.
  const src = readFileSync(new URL("../src/scripts/desk/chapter-page.js", import.meta.url), "utf8");
  assert.match(src, /import \{ chapterPath \} from "\.\.\/\.\.\/lib\/desk-passage\.mjs"/);
  assert.doesNotMatch(src, /\$\{bookKey\}-\$\{chapter\}/, "an address built from a raw book key");
  assert.match(src, /if \(!href\) return Promise\.reject/);
  const fetches = src.match(/\bfetch\(/g) ?? [];
  assert.equal(fetches.length, 1);
  assert.match(src, /fetch\(href,/);
});
