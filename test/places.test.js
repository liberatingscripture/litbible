// The four places (SITE-FEATHERBOA.md, "Four places: the header";
// src/lib/places.mjs): Read, Study, Learn, and About, the rows each lists, and
// which place every page of the site is in. Every page under src/pages must
// have an answer here, so a new page is placed (or left in no place) on
// purpose.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { FOOTER_PAGES, LEGAL, LICENSE_HREF, PLACES, STUDY_HREF, normalizePath, placeBy, placeOf, readPageBook, rowOf } from "../src/lib/places.mjs";

const repo = join(import.meta.dirname, "..");

test("four places, in the header's order, and Read is a link where the others open menus", () => {
  assert.deepEqual(PLACES.map((p) => p.label), ["Read", "Study", "Learn", "About"]);
  assert.deepEqual(PLACES.map((p) => p.menu), [false, true, true, true]);
  assert.equal(placeBy("read").href, "/read");
  assert.deepEqual(PLACES.filter((p) => p.study).map((p) => p.key), ["study"], "only Study waits for the preview");
  assert.ok(Object.isFrozen(PLACES) && Object.isFrozen(PLACES[3].rows[0]), "nobody changes them by accident");
});

test("each menu's rows are the record's names (HD-07, HD-23, BP-04)", () => {
  const rows = (key) => placeBy(key).rows.map((r) => r.label);
  assert.deepEqual(rows("study"), ["Scripture", "Notebook", "Sheets", "Collections", "Help for study tools"]);
  assert.deepEqual(rows("learn"), ["Glossary", "Articles", "Podcast"]);
  assert.deepEqual(rows("about"), ["The LIT", "Commitments", "License", "The Collective", "Apps", "Release Notes", "Support", "Contact"]);
  assert.equal(rowOf("about", "license").href, LICENSE_HREF);
  assert.equal(rowOf("study", "scripture").href, STUDY_HREF);
  assert.equal(rowOf("study", "help").separate, true, "Help waits for Phase 9 below a line (HD-09)");
  for (const place of PLACES) {
    for (const row of place.rows) assert.doesNotMatch(row.label, /^My\b/, `${place.label} / ${row.label}: no "My" (HD-23)`);
  }
});

test("no menu has a What's New row, and none lists Courses (NX-29, HD-30, HD-27)", () => {
  for (const place of PLACES) {
    for (const row of place.rows) {
      assert.doesNotMatch(row.label, /what.s new/i, `${place.label} / ${row.label}`);
      assert.notEqual(normalizePath(row.href), "/courses", `${place.label} / ${row.label}`);
    }
  }
});

test("Release Notes is About's page, also listed with Read (HD-29)", () => {
  const read = rowOf("read", "release-notes");
  assert.equal(read.also, true);
  assert.equal(placeOf("/release-notes/").place, "about");
  assert.equal(placeOf("/release-notes/").row, "release-notes");
});

test("every row, and the footer's own four, opens a page the site builds", () => {
  const page = (href) => {
    const p = normalizePath(href).slice(1);
    return [`src/pages/${p}.astro`, `src/pages/${p}/index.astro`].some((f) => existsSync(join(repo, f)));
  };
  for (const place of PLACES) for (const row of place.rows) assert.ok(page(row.href), `${place.label} / ${row.label}: ${row.href}`);
  for (const row of [...FOOTER_PAGES, ...LEGAL]) assert.ok(page(row.href), `${row.label}: ${row.href}`);
  assert.deepEqual(LEGAL.map((r) => r.label), ["Privacy", "Terms of Use"]);
  assert.deepEqual(FOOTER_PAGES.map((r) => r.label), ["What’s new", "How this site is made"], "HD-33, DA-04");
  for (const row of FOOTER_PAGES) assert.equal(placeOf(row.href).place, null, `${row.label} is in no place (HD-30)`);
});

test("addresses are read as the site serves them", () => {
  for (const path of ["/glossary", "/glossary/", "/glossary/index.html", "/glossary.html", "/glossary/?q=x#trust", "/glossary#trust"]) {
    assert.equal(normalizePath(path), "/glossary", path);
  }
  assert.equal(normalizePath("/"), "/");
  assert.equal(normalizePath("/index.html"), "/");
  assert.equal(normalizePath(""), "/");
  assert.equal(normalizePath(undefined), "/");
});

test("the Read page: a chapter, an introduction, or Read View, and nothing that only looks like one", () => {
  assert.equal(readPageBook("/john-3/"), "john");
  assert.equal(readPageBook("/john-21"), "john");
  assert.equal(readPageBook("/john-22"), null, "John has 21 chapters");
  assert.equal(readPageBook("/john-0"), null);
  assert.equal(readPageBook("/1corinthians-intro/"), "1corinthians");
  assert.equal(readPageBook("/read/revelation/"), "revelation");
  assert.equal(readPageBook("/read/nope"), null);
  assert.equal(readPageBook("/nope-1"), null);
  assert.equal(readPageBook("/read"), null, "/read is Read's, but not the Read page");
  for (const path of ["/john-3", "/philemon-1", "/john-intro", "/read/john"]) {
    const where = placeOf(path);
    assert.equal(where.place, "read", path);
    assert.equal(where.readPage, true, path);
    assert.equal(where.line, false, `${path}: its place line is Phase 4's`);
  }
});

/**
 * Every page under src/pages, by file: an address it builds, and where that
 * page is. `place` null is a page in no place; `line` false is no line under
 * the header. A new page fails here until it has a row.
 */
const PAGES = {
  "index.astro": { path: "/", place: null, line: false },
  "[slug].astro": { path: "/romans-8", place: "read", line: false },
  "[book]-intro.astro": { path: "/romans-intro", place: "read", line: false },
  "read/[book].astro": { path: "/read/romans", place: "read", line: false },
  "read.astro": { path: "/read", place: "read", name: "Books" },
  "desk.astro": { path: "/desk", place: "study", line: false },
  "desk/help.astro": { path: "/desk/help", place: "study", line: false },
  "notebook.astro": { path: "/notebook", place: "study", line: false },
  "sheets.astro": { path: "/sheets", place: "study", line: false },
  "collections.astro": { path: "/collections", place: "study", line: false },
  "glossary.astro": { path: "/glossary", place: "learn", name: "Glossary" },
  "articles.astro": { path: "/articles", place: "learn", name: "Articles" },
  "articles/[...slug].astro": { path: "/articles/some-article", place: "learn", name: "Articles", up: "/articles" },
  "found-in-translation-podcast.astro": { path: "/found-in-translation-podcast", place: "learn", name: "Podcast" },
  "about.astro": { path: "/about", place: "about", name: "The LIT" },
  "translation-commitments.astro": { path: "/translation-commitments", place: "about", name: "Commitments" },
  "license.astro": { path: "/license", place: "about", name: "License" },
  "liberating-scripture-collective.astro": { path: "/liberating-scripture-collective", place: "about", name: "The Collective" },
  "apps.astro": { path: "/apps", place: "about", name: "Apps" },
  "release-notes.astro": { path: "/release-notes", place: "about", name: "Release Notes" },
  "support.astro": { path: "/support", place: "about", name: "Support" },
  "contact.astro": { path: "/contact", place: "about", name: "Contact" },
  "contact/thanks.astro": { path: "/contact/thanks", place: "about", name: "Contact", up: "/contact" },
  "privacy.astro": { path: "/privacy", place: null, name: "Privacy" },
  "terms.astro": { path: "/terms", place: null, name: "Terms of Use" },
  "account.astro": { path: "/account", place: null, name: "Account" },
  "account/connect.astro": { path: "/account/connect", place: null, name: "Account", up: "/account/" },
  "delete-account.astro": { path: "/delete-account", place: null, name: "Delete account" },
  "404.astro": { path: "/404", place: null, name: "Page not found" },
  "courses.astro": { path: "/courses", place: null, name: "Courses" },
  "search.astro": { path: "/search", place: null, name: "Search" },
  "app-support.astro": { path: "/app-support", place: null, name: "App support" },
  "app-support/thanks.astro": { path: "/app-support/thanks", place: null, name: "App support", up: "/app-support" },
  "unsubscribe.astro": { path: "/unsubscribe", place: null, name: "Unsubscribe" },
  "colophon.astro": { path: "/colophon", place: null, name: "How this site is made" },
  "whats-new.astro": { path: "/whats-new", place: null, name: "What’s new" },
};

function pageFiles(dir = "src/pages", base = "") {
  const out = [];
  for (const e of readdirSync(join(repo, dir), { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...pageFiles(`${dir}/${e.name}`, rel));
    else if (e.name.endsWith(".astro")) out.push(rel);
  }
  return out.sort();
}

test("every page under src/pages has a place, or none on purpose", () => {
  assert.deepEqual(pageFiles(), Object.keys(PAGES).sort(), "a page was added or removed: give it a row in PAGES (and src/lib/places.mjs)");
  for (const [file, want] of Object.entries(PAGES)) {
    const where = placeOf(want.path);
    assert.equal(where.place, want.place, `${file}: place`);
    assert.equal(where.line, want.line ?? true, `${file}: the line under the header`);
    if (want.name) assert.equal(where.name, want.name, `${file}: the line's name`);
    assert.equal(where.up, want.up ?? null, `${file}: the name's link`);
    // With a trailing slash, as Astro builds it, the answer is the same.
    assert.deepEqual(placeOf(`${want.path}/`.replace(/\/+$/, "/")), where, `${file}: with a slash`);
  }
});

test("a page in no menu marks no place (HD-22), and the line names it alone", () => {
  for (const path of ["/privacy", "/terms", "/account", "/account/connect", "/delete-account", "/404", "/courses"]) {
    const where = placeOf(path);
    assert.equal(where.place, null, path);
    assert.equal(where.row, null, path);
    assert.equal(where.line, true, path);
  }
});

test("Home has no place and no line (HD-14)", () => {
  assert.deepEqual(placeOf("/"), { place: null, row: null, current: null, name: null, up: null, line: false, readPage: false, home: true });
});

test("a row's own page is the current page; a page inside it is current within it", () => {
  assert.equal(placeOf("/glossary").current, "page");
  assert.equal(placeOf("/articles/some-article").current, "true");
  assert.equal(placeOf("/articles/some-article").row, "articles");
  assert.equal(placeOf("/contact/thanks").current, "true");
  assert.equal(placeOf("/notebook/").row, "notebook");
  assert.equal(placeOf("/desk/").row, "scripture");
  assert.equal(placeOf("/read/").row, "books");
});

test("an address the site doesn't know has no place and no line", () => {
  for (const path of ["/nope", "/learn", "/read/nope", "/john-99"]) {
    assert.deepEqual(placeOf(path), { place: null, row: null, current: null, name: null, up: null, line: false, readPage: false, home: false }, path);
  }
});
