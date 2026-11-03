import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
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

test("a block anchor keeps its own id, which Study View shares", () => {
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

test("every book and chapter answers with a real Study View address", () => {
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

test("a Continue reading record from Read View is read as a Study View place", () => {
  const read = { v: 1, book: "romans", chapter: 8, verse: 3, view: "read", t: 5 };
  assert.deepEqual(studyRecord(read), { ...read, view: "study" });
  assert.equal(read.view, "read", "the record it was given is not changed");
});

test("a Study View record, or something that isn't a record, comes back as it was", () => {
  const study = { v: 1, book: "romans", chapter: 8, verse: null, view: "study", t: 5 };
  assert.equal(studyRecord(study), study);
  assert.equal(studyRecord(null), null);
  assert.equal(studyRecord("x"), "x");
});

test("Continue reading goes to Study View whichever view the record came from", () => {
  assert.equal(studyContinueHref({ book: "romans", chapter: 8, verse: 3, view: "read" }), "/romans-8/#v3");
  assert.equal(studyContinueHref({ book: "romans", chapter: 8, verse: null, view: "read" }), "/romans-8/");
  assert.equal(studyContinueHref({ book: "john", chapter: 3, verse: 16, view: "study" }), "/john-3/#v16");
});

// ---- dormant until 8c -----------------------------------------------------------

test("nothing in the site imports the retirement rules before the launch cutover", () => {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(astro|js|mjs|ts)$/.test(name)) files.push(full);
    }
  };
  walk("src");
  walk("scripts");
  const users = files
    .filter((f) => !/read-view-retirement\.mjs$|read-view-redirect\.js$/.test(f))
    .filter((f) => /read-view-retirement|read-view-redirect/.test(readFileSync(f, "utf8")));
  assert.deepEqual(users, [], "wire these in at 8c, and then delete this test");
});

// ---- the preview's swaps (html[data-desk="on"]) --------------------------------

test("with the preview on, /read swaps the Read View card for the Study Desk card", () => {
  const page = readFileSync("src/pages/read.astro", "utf8");
  const css = readFileSync("src/styles/pages/read.css", "utf8");
  assert.match(page, /view-card--read/);
  assert.match(page, /view-card--desk/);
  assert.match(page, /href="\/desk\/\?place=matthew-5"/);
  // Both cards are in the page; the attribute decides which one shows.
  assert.match(css, /\.view-card--desk\s*\{\s*display:\s*none/);
  assert.match(css, /html\[data-desk="on"\] \.view-card--desk\s*\{\s*display:\s*flex/);
  assert.match(css, /html\[data-desk="on"\] \.view-card--read\s*\{\s*display:\s*none/);
  // "Available now" goes with the preview from the apps card to the desk card.
  assert.match(css, /html\[data-desk="on"\] \.view-card__badge--apps\s*\{\s*display:\s*none/);
});

test("with the preview on, the chapter picker's footer link opens the Study Desk", () => {
  const menu = readFileSync("src/components/ReadMenu.astro", "utf8");
  assert.match(menu, /dataset\.desk === "on"/);
  assert.match(menu, /"\/desk\/\?place=" \+ crossViewKey \+ "-1"/);
  assert.match(menu, / in the Study Desk →/);
  assert.match(menu, / in Read View →/, "everyone else keeps Read View");
});
