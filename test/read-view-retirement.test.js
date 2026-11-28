import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { BOOKS, BOOK_ORDER } from "../src/data/books.js";
import { readViewRedirects, studyAddress, studyContinueHref, studyRecord } from "../src/lib/read-view-retirement.mjs";

// ---- addresses --------------------------------------------------------------

test("a Read View book page with no anchor goes to the book's first chapter", () => {
  assert.equal(studyAddress("/read/john", ""), "/john-1/");
  assert.equal(studyAddress("/read/john/", ""), "/john-1/");
  assert.equal(studyAddress("/read/1corinthians/", "#"), "/1corinthians-1/");
});

test("#ch-N goes to that chapter", () => {
  assert.equal(studyAddress("/read/john/", "#ch-10"), "/john-10/");
  assert.equal(studyAddress("/read/john", "ch-3"), "/john-3/");
});

test("a verse anchor goes to its chapter and verse, a letter kept, its own book winning", () => {
  assert.equal(studyAddress("/read/luke/", "#luke-10-v25"), "/luke-10/#v25");
  assert.equal(studyAddress("/read/john/", "#john-3-v16b"), "/john-3/#v16b");
  assert.equal(studyAddress("/read/luke/", "#1john-4-v8"), "/1john-4/#v8");
});

test("a block anchor keeps its own id, which Chapter View shares", () => {
  assert.equal(studyAddress("/read/john/", "#john-8-p9"), "/john-8/#john-8-p9");
  assert.equal(studyAddress("/read/1peter/", "#1peter-2-p2"), "/1peter-2/#1peter-2-p2");
});

test("a chapter, book or anchor that doesn't exist falls back, never to a missing page", () => {
  assert.equal(studyAddress("/read/john/", "#ch-22"), "/john-1/");
  assert.equal(studyAddress("/read/john/", "#ch-0"), "/john-1/");
  assert.equal(studyAddress("/read/john/", "#john-99-v1"), "/john-1/");
  assert.equal(studyAddress("/read/john/", "#luke-1-p3x"), "/john-1/");
  assert.equal(studyAddress("/read/john/", "#something-else"), "/john-1/");
  assert.equal(studyAddress("/read/john/", "#<script>"), "/john-1/");
});

test("an address that isn't a Read View book page is left alone", () => {
  for (const path of ["/read", "/read/", "/read/genesis/", "/read/john/extra", "/john-3/", "/", "", null, undefined]) {
    assert.equal(studyAddress(path, "#ch-3"), null, String(path));
  }
});

test("every book and chapter answers with a real Chapter View address", () => {
  for (const book of BOOK_ORDER) {
    for (let ch = 1; ch <= BOOKS[book]; ch++) {
      assert.equal(studyAddress(`/read/${book}/`, `#ch-${ch}`), `/${book}-${ch}/`);
      assert.equal(studyAddress(`/read/${book}/`, `#${book}-${ch}-v1`), `/${book}-${ch}/#v1`);
    }
  }
});

// ---- redirects -------------------------------------------------------------

test("readViewRedirects covers every book once, to its first chapter", () => {
  const rules = readViewRedirects();
  assert.equal(Object.keys(rules).length, BOOK_ORDER.length);
  for (const book of BOOK_ORDER) assert.equal(rules[`/read/${book}`], `/${book}-1/`, book);
  assert.equal(rules["/read"], undefined, "the /read landing page stays");
});

test("each redirect agrees with studyAddress for the same book", () => {
  for (const [from, to] of Object.entries(readViewRedirects())) assert.equal(studyAddress(from, ""), to, from);
});

// ---- saved places ----------------------------------------------------------

test("a Continue reading record from Read View is read as a Chapter View place", () => {
  const read = { v: 1, book: "romans", chapter: 8, verse: 3, view: "read", t: 5 };
  assert.deepEqual(studyRecord(read), { ...read, view: "study" });
  assert.equal(read.view, "read", "the record it was given is not changed");
});

test("a Chapter View record, or something that isn't a record, comes back as it was", () => {
  const study = { v: 1, book: "romans", chapter: 8, verse: null, view: "study", t: 5 };
  assert.equal(studyRecord(study), study);
  assert.equal(studyRecord(null), null);
  assert.equal(studyRecord("x"), "x");
});

test("Continue reading goes to Chapter View whichever view the record came from", () => {
  assert.equal(studyContinueHref({ book: "romans", chapter: 8, verse: 3, view: "read" }), "/romans-8/#v3");
  assert.equal(studyContinueHref({ book: "romans", chapter: 8, verse: null, view: "read" }), "/romans-8/");
  assert.equal(studyContinueHref({ book: "john", chapter: 3, verse: 16, view: "study" }), "/john-3/#v16");
});

// ---- switched on (Featherboa, Phase 4; WB-44) ----------------------------------

const page = readFileSync("src/pages/read/[book].astro", "utf8");

test("each book's old page forwards with these rules, keeping its anchor", () => {
  assert.match(page, /import "\.\.\/\.\.\/scripts\/read-view-redirect\.js";/);
  const script = readFileSync("src/scripts/read-view-redirect.js", "utf8");
  assert.match(script, /import \{ studyAddress \} from "\.\.\/lib\/read-view-retirement\.mjs";/);
  assert.match(script, /window\.location\.replace\(to\)/, "replace, so Back skips the old address");
});

test("without scripts it goes to the book's first chapter, and it is never indexed", () => {
  assert.match(page, /const first = `\/\$\{bookKey\}-1\/`;/);
  assert.match(page, /<noscript><meta http-equiv="refresh" content=\{`0; url=\$\{first\}`\} \/><\/noscript>/);
  assert.match(page, /<meta name="robots" content="noindex" \/>/);
  assert.match(page, /<a href=\{first\}>/, "a link to follow where a browser refreshes nothing");
  const config = readFileSync("astro.config.mjs", "utf8");
  assert.match(config, /if \(slug\.startsWith\('read\/'\)\) return false;/, "out of the sitemap");
});

test("Read View's page, script, styles, and toolbar are gone", () => {
  for (const file of ["src/components/ReadMenu.astro", "src/scripts/read-mode.js", "src/styles/read-mode.css"]) {
    assert.equal(existsSync(file), false, `${file} retired with Read View`);
  }
  assert.doesNotMatch(page, /Layout|ReadMenu|read-mode/, "the old page is only its forwarding");
});
