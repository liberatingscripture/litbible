// test/search-rows.test.js
//
// The rows and tabs of search, drawn once for /search, the reading page's
// Search, and the header's magnifier (src/lib/search-rows.mjs; SE-31).

import test from "node:test";
import assert from "node:assert/strict";
import { window } from "./helpers/browser-env.mjs";

const rows = await import("../src/lib/search-rows.mjs");

function host() {
  const el = document.createElement("div");
  document.body.append(el);
  return el;
}

test("the tabs: the notebook's with the preview, the Greek's where it is searched", () => {
  assert.deepEqual(rows.visibleTabs().map((t) => t.id), ["keyword", "subject", "glossary", "article", "intro"]);
  assert.deepEqual(rows.visibleTabs({ desk: true, greek: true }).map((t) => t.id), ["keyword", "subject", "glossary", "article", "intro", "notebook", "greek"]);
});

test("a tab opens on Scripture, or the first with results", () => {
  assert.equal(rows.openingTab({ keyword: 3, glossary: 1 }), "keyword");
  assert.equal(rows.openingTab({ keyword: 0, subject: 0, glossary: 2, article: 1 }), "glossary");
  assert.equal(rows.openingTab({ keyword: 0, intro: 1 }), "intro");
  assert.equal(rows.openingTab({}), "keyword");
});

test("a tab's mode and back", () => {
  assert.equal(rows.tabForMode("subject"), "subject");
  assert.equal(rows.tabForMode("all"), null);
  assert.equal(rows.modeForTab("greek"), "greek");
});

test("the tab row shows counts, dims a tab with none, and keeps it clickable", () => {
  const h = host();
  const picked = [];
  rows.renderTabs(h, {
    tabs: rows.visibleTabs(),
    counts: { keyword: 75, subject: 6, glossary: 0, article: 2, intro: 0 },
    active: "keyword",
    onPick: (id) => picked.push(id),
  });
  const tabs = [...h.querySelectorAll("[role=tab]")];
  assert.equal(tabs.length, 5);
  assert.equal(tabs[0].getAttribute("aria-selected"), "true");
  assert.equal(tabs[0].tabIndex, 0);
  assert.equal(tabs[1].tabIndex, -1);
  assert.match(tabs[0].textContent, /Scripture\s+75/);
  assert.equal(tabs[2].classList.contains("search-tab--none"), true);
  assert.equal(tabs[1].classList.contains("search-tab--none"), false);
  assert.match(tabs[2].getAttribute("aria-label"), /no results/);
  assert.ok(tabs.every((t) => t.classList.contains("kit-tab")));
  tabs[2].click();
  assert.deepEqual(picked, ["glossary"]);
});

test("a tab with no count (the Greek's) shows no number", () => {
  const h = host();
  rows.renderTabs(h, { tabs: rows.visibleTabs({ greek: true }), counts: { keyword: 1 }, active: "greek", onPick() {} });
  const greek = h.querySelector("[data-tab=greek]");
  assert.equal(greek.textContent, "Greek");
  assert.equal(greek.getAttribute("aria-label"), null);
});

test("arrow keys move the one tab stop", () => {
  const h = host();
  rows.renderTabs(h, { tabs: rows.visibleTabs(), counts: {}, active: "keyword", onPick() {} });
  const tabs = [...h.querySelectorAll("[role=tab]")];
  tabs[0].focus();
  h.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  assert.equal(tabs[1].tabIndex, 0);
  assert.equal(tabs[0].tabIndex, -1);
  h.dispatchEvent(new window.KeyboardEvent("keydown", { key: "End", bubbles: true }));
  assert.equal(tabs[4].tabIndex, 0);
});

test("a verse row: reference, then the verse with its match in a mark", () => {
  const html = rows.verseRowHtml({ label: "John 3:16", href: "/john-3/#v16", html: "God so <mark>loved</mark> the world" });
  assert.match(html, /<span class="search-row__ref">John 3:16<\/span>/);
  assert.match(html, /<mark>loved<\/mark>/);
  assert.doesNotMatch(html, /type="checkbox"/);
});

test("Select adds a box on a verse row and a chapter row", () => {
  const v = rows.verseRowHtml({ label: "John 3:16", href: "/john-3/#v16", html: "x", ref: { bookKey: "john", chapter: 3, verse: 16 }, pick: true });
  assert.match(v, /data-pick="john 3:16"/);
  const c = rows.titleRowHtml({ title: "John 3", href: "/john-3/", ref: { bookKey: "john", chapter: 3 }, pick: true });
  assert.match(c, /data-pick="john 3"/);
});

test("book headings stand only in Bible order", () => {
  const verses = [
    { bookKey: "matthew", bookLabel: "Matthew", label: "Matthew 5:14", href: "/matthew-5/#v14", html: "a" },
    { bookKey: "matthew", bookLabel: "Matthew", label: "Matthew 5:15", href: "/matthew-5/#v15", html: "b" },
    { bookKey: "john", bookLabel: "John", label: "John 1:5", href: "/john-1/#v5", html: "c" },
  ];
  const ordered = rows.verseRowsHtml(verses, { bibleOrder: true });
  assert.equal((ordered.match(/search-heading__title/g) || []).length, 2);
  const relevance = rows.verseRowsHtml(verses, { bibleOrder: false });
  assert.equal((relevance.match(/search-heading__title/g) || []).length, 0);
});

test("text is escaped", () => {
  const html = rows.titleRowHtml({ title: "<b>x</b>", href: "/a/?b=1&c=2" });
  assert.doesNotMatch(html, /<b>/);
  assert.match(html, /&amp;c=2/);
});

test("the reference's rows: Go to, and Study with the preview", () => {
  const answer = { label: "John 3:16", goHref: "/john-3/#v16", studyHref: "/desk/?place=john-3:16" };
  const off = rows.referenceRowsHtml(answer, { desk: false });
  assert.match(off, /Go to <strong>John 3:16/);
  assert.doesNotMatch(off, /Study/);
  const on = rows.referenceRowsHtml(answer, { desk: true });
  assert.match(on, /Study <strong>John 3:16/);
  const intro = rows.referenceRowsHtml({ ...answer, intro: true }, { desk: true });
  assert.doesNotMatch(intro, /Study/);
});

test("where Study opens", () => {
  assert.equal(rows.studyHrefFor({ kind: "verse", bookKey: "john", chapter: 3, verse: 16 }), "/desk/?place=john-3:16");
  assert.equal(rows.studyHrefFor({ kind: "chapter", bookKey: "john", chapter: 3, verse: null }), "/desk/?place=john-3");
  assert.equal(rows.studyHrefFor({ kind: "book", bookKey: "john" }), "/desk/?place=john-1");
  assert.equal(rows.studyHrefFor({ kind: "book", bookKey: "john", intro: true }), null);
  assert.equal(rows.studyHrefFor({ kind: "chapter", bookKey: "john", chapter: 99 }), "/desk/?place=john-1");
});

test("the chapters line", () => {
  const many = rows.chaptersLineHtml({ first: "John 1", count: 6, query: "light" });
  assert.match(many, /John 1 is one of 6 chapters about light/);
  assert.match(many, /See all 6 →/);
  const one = rows.chaptersLineHtml({ first: "John 1", count: 1, query: "light" });
  assert.match(one, /John 1 is a chapter about light\./);
  assert.doesNotMatch(one, /See all/);
});

test("the glossary line", () => {
  assert.match(rows.glossaryLineHtml({ term: "trust", href: "/glossary/#trust", count: 1 }), /Trust is in the glossary →/);
  assert.match(rows.glossaryLineHtml({ term: "trust", href: "/glossary/#trust", count: 3 }), /Trust and 2 more are in the glossary/);
});

test("the glossary line names an entry's own word, as the entry writes it (SE-21)", () => {
  const faith = { traditional: "Faith", lit: "trust / faithfulness", greek: "pistis" };
  assert.equal(rows.glossaryLineTerm("trust", faith), "Trust");
  assert.equal(rows.glossaryLineTerm("Faithfulness", faith), "Faithfulness");
  assert.equal(rows.glossaryLineTerm("faith", faith), "Faith");
  assert.equal(rows.glossaryLineTerm("pistis", faith), "Pistis");
  assert.equal(rows.glossaryLineTerm("“trust”", faith), "Trust");
  // An entry that only uses the word in its prose gets no line.
  assert.equal(rows.glossaryLineTerm("trusting", faith), null);
  assert.equal(rows.glossaryLineTerm("light", faith), null);
  assert.equal(rows.glossaryLineTerm("trust", undefined), null);
  assert.equal(rows.glossaryLineTerm("", faith), null);
});

test("See all results keeps the tab and the book", () => {
  assert.equal(rows.seeAllHref("/search", { q: "light" }), "/search/?q=light");
  assert.equal(rows.seeAllHref("/search/", { q: "light love", mode: "subject", book: "john" }), "/search/?q=light+love&mode=subject&book=john");
});

test("the count at the field's end", () => {
  assert.equal(rows.resultsCount(1), "1 result");
  assert.equal(rows.resultsCount(1200), "1,200 results");
});
