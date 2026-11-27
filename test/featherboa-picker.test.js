// test/featherboa-picker.test.js
//
// The passage picker and the place line (Featherboa's Phase 4, part one;
// SITE-FEATHERBOA.md, "Finding a passage" and "The reading page"). The first
// tests hold what typing offers and the books (src/lib/passage-picker.mjs;
// FP-03 to FP-10); the next drive src/scripts/passage-picker.js over the
// picker's own markup in a browser DOM (the panel and the phone's sheet,
// which are one dialog, and /read's picker at full size), then
// src/scripts/place-line.js and the keys (keyboard-shortcuts.js); the last
// hold the markup and the stylesheets, which happy-dom can't lay out and
// Astro doesn't run here.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { resetDom, settle } from "./helpers/browser-env.mjs";
import { BOOKS, BOOK_ORDER } from "../src/data/books.js";

const { FIELD_HINT, IN_PROGRESS, draftNote, pickerBooks, readTyping, searchHref } = await import("../src/lib/passage-picker.mjs");
const { OPEN_EVENT, start, stepIndex } = await import("../src/scripts/passage-picker.js");
const { start: startLine } = await import("../src/scripts/place-line.js");
await import("../src/scripts/keyboard-shortcuts.js");

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// ── What typing offers (FP-03 to FP-06) ────────────────────────────────

/** Each offer as [label, address]. */
const offers = (text, options) => readTyping(text, options).offers.map(({ label, href }) => [label, href]);

test("a passage typed is offered at once, and the first offer is the one Enter takes (FP-03)", () => {
  assert.deepEqual(readTyping("rom 8"), {
    book: "romans",
    offers: [{ kind: "go", label: "Go to Romans 8", href: "/romans-8/", draft: false }],
  });
  assert.deepEqual(offers("John 3:16"), [["Go to John 3:16", "/john-3/#v16"]]);
  assert.deepEqual(offers("john 3:16-18"), [["Go to John 3:16–18", "/john-3/#v16-18"]]);
  assert.deepEqual(offers("acts 2:1-4"), [["Go to Acts 2:1–4", "/acts-2/#v1-4"]]);
  assert.deepEqual(offers("galatians 3.28"), [["Go to Galatians 3:28", "/galatians-3/#v28"]]);
});

test("it is forgiving: the search box's reading, then the 404 page's guesser (FP-04)", () => {
  assert.deepEqual(offers("jn 3 16"), [["Go to John 3:16", "/john-3/#v16"]]);
  assert.deepEqual(offers("jn 3"), [["Go to John 3", "/john-3/"]]);
  assert.deepEqual(offers("1 cor 13"), [["Go to 1 Corinthians 13", "/1corinthians-13/"]]);
  assert.deepEqual(offers("1co13"), [["Go to 1 Corinthians 13", "/1corinthians-13/"]]);
  assert.deepEqual(offers("mat 5 3"), [["Go to Matthew 5:3", "/matthew-5/#v3"]]);
  assert.equal(readTyping("1 cor 13").book, "1corinthians", "the book typed is the one the picker shows");
});

test("a book alone offers its first chapter, then its introduction (FP-04)", () => {
  assert.equal(readTyping("romans").book, "romans");
  assert.deepEqual(offers("romans"), [
    ["Go to Romans 1", "/romans-1/"],
    ["Go to Romans introduction", "/romans-intro/"],
  ]);
});

test("“Matthew intro” offers the introduction alone (FP-05, E123)", () => {
  assert.deepEqual(offers("Matthew intro"), [["Go to Matthew introduction", "/matthew-intro/"]]);
  assert.deepEqual(offers("Introduction to Mark"), [["Go to Mark introduction", "/mark-intro/"]]);
});

test("what isn't a passage offers a search for it, and an empty field offers nothing (FP-06)", () => {
  assert.deepEqual(readTyping("forgiveness"), {
    book: null,
    offers: [{ kind: "search", label: "Search for ‘forgiveness’", href: "/search/?q=forgiveness", draft: false }],
  });
  // A chapter its book doesn't have: the book's chapters show, and the one
  // row searches for what was typed.
  assert.deepEqual(readTyping("romans 17"), {
    book: "romans",
    offers: [{ kind: "search", label: "Search for ‘romans 17’", href: "/search/?q=romans%2017", draft: false }],
  });
  assert.deepEqual(readTyping(""), { book: null, offers: [] });
  assert.deepEqual(readTyping("   "), { book: null, offers: [] });
  assert.equal(searchHref("god’s love & more"), "/search/?q=god%E2%80%99s%20love%20%26%20more");
});

test("an offer of a page in progress says so; a search never does (FP-10)", () => {
  const isDraft = (book, chapter) => book === "john" && chapter === 3;
  assert.equal(readTyping("john 3", { isDraft }).offers[0].draft, true);
  assert.equal(readTyping("john 3:16", { isDraft }).offers[0].draft, true, "a verse of it too");
  assert.equal(readTyping("john 4", { isDraft }).offers[0].draft, false);
  assert.equal(readTyping("forgiveness", { isDraft: () => true }).offers[0].draft, false);
});

// ── The books (FP-08 to FP-10) ─────────────────────────────────────────

test("the 27 books in canonical order with no groups, each with its chapters and its introduction (FP-08, FP-09)", () => {
  const books = pickerBooks();
  assert.deepEqual(
    books.map((b) => b.key),
    BOOK_ORDER,
  );
  assert.equal(books.length, 27);
  for (const b of books) {
    assert.equal(b.chapters.length, BOOKS[b.key], b.key);
    assert.equal(b.chapters[0].href, `/${b.key}-1/`);
    assert.equal(b.intro.href, `/${b.key}-intro/`);
  }
  assert.equal(books[0].label, "Matthew");
  assert.equal(books.find((b) => b.key === "1corinthians").label, "1 Corinthians");
});

test("drafts: a whole book, a chapter, and an introduction, and the words under a book's chapters (FP-10)", () => {
  const books = pickerBooks({
    draftChaptersByBook: { luke: [23, 24] },
    fullyDraftBooks: ["revelation"],
    draftIntros: ["acts"],
  });
  const luke = books.find((b) => b.key === "luke");
  assert.equal(luke.draft, false);
  assert.equal(luke.note, "Chapters 23–24 in progress");
  assert.deepEqual(
    luke.chapters.filter((c) => c.draft).map((c) => c.n),
    [23, 24],
  );
  assert.equal(books.find((b) => b.key === "revelation").draft, true);
  assert.deepEqual(books.find((b) => b.key === "acts").intro, { href: "/acts-intro/", draft: true });
  assert.equal(draftNote([4]), "Chapter 4 in progress");
  assert.equal(draftNote([2, 3, 4]), "Chapters 2–4 in progress");
  assert.equal(draftNote([8, 7, 5, 2, 1]), "Chapters 1–2, 5, 7–8 in progress");
  assert.equal(draftNote([]), "");
  assert.equal(IN_PROGRESS, "in progress");
  assert.equal(FIELD_HINT, "book, chapter, or verse");
});

test("the arrows step through a grid by its columns, and Home and End go to its ends", () => {
  assert.equal(stepIndex("ArrowRight", 3, 27, 3), 4);
  assert.equal(stepIndex("ArrowRight", 26, 27, 3), 26, "no wrapping past the end");
  assert.equal(stepIndex("ArrowLeft", 0, 27, 3), 0);
  assert.equal(stepIndex("ArrowDown", 3, 27, 3), 6);
  assert.equal(stepIndex("ArrowDown", 25, 27, 3), 26);
  assert.equal(stepIndex("ArrowUp", 4, 27, 3), 1);
  assert.equal(stepIndex("ArrowUp", 1, 27, 3), 0);
  assert.equal(stepIndex("Home", 9, 27, 3), 0);
  assert.equal(stepIndex("End", 9, 27, 3), 26);
  assert.equal(stepIndex("Enter", 9, 27, 3), null);
});

// ── The picker on a page ───────────────────────────────────────────────

/** The picker as PassagePicker.astro draws it (its hooks are held to the
 *  component at the end). */
function picker({ full = false, book = "", chapter, drafts } = {}) {
  const progress = `<span class="sr-only">, </span><span class="picker__progress">${IN_PROGRESS}</span>`;
  const bookHref = (key) => (full ? `#picker-${key}` : `/read/#picker-${key}`);
  const attrs = [
    full ? "data-picker-full" : "",
    book ? `data-book="${book}"` : "",
    chapter === undefined ? "" : `data-chapter="${chapter}"`,
  ].join(" ");
  const books = pickerBooks(drafts);
  return `<div class="picker" data-picker ${attrs}>
    <div class="picker__top">
      <form class="picker__form" action="/search/" method="get" role="search" data-picker-form>
        <label class="sr-only" for="picker-field">Book, chapter, or verse</label>
        <input id="picker-field" class="kit-field picker__field" type="search" name="q" placeholder="${FIELD_HINT}" data-picker-field>
      </form>
      ${full ? "" : `<button type="button" class="kit-icon picker__close" aria-label="Close picker" data-picker-close>×</button>`}
    </div>
    <div class="picker__offers" id="picker-offers" role="listbox" aria-label="Passages" data-picker-offers hidden></div>
    <p class="sr-only" role="status" data-picker-status></p>
    <a class="kit-row picker__continue" href="/read/" data-picker-continue hidden>Continue: <span data-picker-continue-label></span></a>
    <div class="picker__panes">
      <ol class="picker__books" aria-label="Books" data-picker-books>${books
        .map(
          (b) => `
        <li class="picker__book-item"><a class="kit-tab picker__book${b.draft ? " kit-tab--draft" : ""}" id="picker-tab-${b.key}" href="${bookHref(b.key)}" data-picker-book="${b.key}">${b.label}${b.draft ? progress : ""}</a></li>`,
        )
        .join("")}
      </ol>
      <div class="picker__chapters">${books
        .map(
          (b) => `
        <section class="picker__section" id="picker-${b.key}" data-picker-section="${b.key}">
          <h2 class="picker__name">${b.label}</h2>
          <ol class="picker__grid" data-picker-grid>${b.chapters
            .map(
              (c) =>
                `<li class="picker__cell"><a class="kit-tab picker__chapter${c.draft ? " kit-tab--draft" : ""}" href="${c.href}"${b.key === book && c.n === chapter ? ' aria-current="page"' : ""} data-picker-chapter="${c.n}"><span class="sr-only">Chapter </span>${c.n}</a></li>`,
            )
            .join("")}</ol>
          ${b.note ? `<p class="picker__note">${b.note}</p>` : ""}
          <a class="kit-row picker__intro${b.intro.draft ? " kit-row--draft" : ""}" href="${b.intro.href}"${b.key === book && chapter === "intro" ? ' aria-current="page"' : ""}>Introduction${b.intro.draft ? progress : ""}</a>
        </section>`,
        )
        .join("")}
      </div>
    </div>
    <a class="kit-row picker__foot" href="/release-notes/">Release Notes</a>
  </div>`;
}

/** A page with the dialog Layout.astro draws, its picker kept in a
 *  <template> until the first opening: on John 3 (the header's Read, the
 *  place line's book and chapter, and its ›), or with `book: ""` a page that
 *  names no passage (the header's Read alone). */
function page({ book = "john", chapter = 3, drafts } = {}) {
  const line = book
    ? `<div class="place-line place-line--reading" data-place-line>
        <p class="place-line__trail">
          <a class="kit-btn kit-btn--plain place-line__pick" id="line-book" href="/read/" data-picker-open="books">John</a>
          <a class="kit-btn kit-btn--plain place-line__pick" id="line-chapter" href="/read/#picker-john" data-picker-open="chapters">Chapter 3</a>
        </p>
        <nav class="place-line__turn" aria-label="Chapters"><a class="kit-icon" id="line-next" href="/john-4/" rel="next" aria-label="Next: John 4">›</a></nav>
      </div>`
    : "";
  document.body.innerHTML = `
    <header class="site-header"><nav class="site-nav"><a class="kit-tab site-nav__place" id="header-read" href="/read/" data-picker-open="books">Read</a></nav></header>
    ${line}
    <main id="main-content"><h1>John 3</h1></main>
    <dialog class="picker-dialog" id="passagePicker" aria-label="Choose passage" data-picker-dialog><template data-picker-template>${picker({ book, chapter: book ? chapter : undefined, drafts })}</template></dialog>`;
}

/** /read: the picker at full size under the page's title. */
function readPage(url = "http://localhost/read/") {
  resetDom(url);
  document.body.innerHTML = `
    <header class="site-header"><nav class="site-nav"><a class="kit-tab site-nav__place" id="header-read" href="/read/" aria-current="page" data-picker-open="books">Read</a></nav></header>
    <main id="main-content"><h1>Read the LIT Online</h1>${picker({ full: true })}</main>`;
}

const $ = (selector) => document.querySelector(selector);
const dialog = () => $("[data-picker-dialog]");
const field = () => $("[data-picker-field]");
const focusedId = () => document.activeElement?.id ?? "";
const shown = () => $("[data-picker-section][data-shown]")?.dataset.pickerSection;
const expanded = () => [...document.querySelectorAll("[data-picker-open]")].map((b) => b.getAttribute("aria-expanded"));
const rows = () => [...document.querySelectorAll("[data-picker-offers] [role='option']")];
const chosen = () => rows().findIndex((r) => r.getAttribute("aria-selected") === "true");

/** Presses a key; true when something took it. */
function key(target, name, init = {}) {
  const event = new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

/** Types into the picker's field. */
function type(text) {
  field().value = text;
  field().dispatchEvent(new Event("input", { bubbles: true }));
}

const record = (book, chapter, verse = null) =>
  localStorage.setItem("lit_last_read", JSON.stringify({ v: 1, book, chapter, verse, view: "study", t: 1 }));

// Where each offer went (the picker's `go`), and whether each click that
// reached the page had been taken (happy-dom would otherwise follow a link).
let went = [];
const clicks = [];
document.addEventListener("click", (event) => {
  clicks.push(event.defaultPrevented);
  event.preventDefault();
});

let stop = () => {};
const begin = () => {
  stop = start({ doc: document, win: window, go: (href) => went.push(href) });
};

beforeEach(() => {
  stop();
  stop = () => {};
  went = [];
  clicks.length = 0;
  resetDom();
  localStorage.clear();
});

test("the place line's book opens the panel at the books, with focus in the field (FP-02, RP-29)", () => {
  page();
  begin();
  const book = $("#line-book");
  assert.equal(book.getAttribute("href"), "/read/", "a link to /read without JavaScript");
  assert.equal(book.getAttribute("role"), "button");
  assert.equal(book.getAttribute("aria-controls"), "passagePicker");
  assert.equal(book.getAttribute("aria-haspopup"), "dialog");
  assert.deepEqual(expanded(), ["false", "false", "false"]);
  book.click();
  assert.equal(clicks.at(-1), true, "the press went no further");
  assert.equal(dialog().open, true);
  assert.equal(focusedId(), "picker-field");
  assert.deepEqual(expanded(), ["true", "true", "true"], "every way in says it is open");
  assert.equal($("#picker-tab-john").getAttribute("aria-selected"), "true", "the page's book is chosen");
  assert.equal(shown(), "john");
  assert.equal($("[data-picker]").hasAttribute("data-picker-ready"), true);
});

test("the place line's chapter opens it at the page's chapter, one stop in the grid (RP-29)", () => {
  page();
  begin();
  $("#line-chapter").click();
  assert.equal(dialog().open, true);
  assert.equal(document.activeElement?.dataset.pickerChapter, "3");
  assert.equal(document.activeElement?.getAttribute("aria-current"), "page");
  const stops = [...document.querySelectorAll("#picker-john [data-picker-chapter]")].filter((c) => c.tabIndex === 0);
  assert.deepEqual(
    stops.map((c) => c.dataset.pickerChapter),
    ["3"],
  );
});

test("the header's Read opens the same panel (FP-15, HD-03)", () => {
  page();
  begin();
  $("#header-read").click();
  assert.equal(dialog().open, true);
  assert.equal(focusedId(), "picker-field");
  key(field(), "Escape");
  assert.equal(focusedId(), "header-read", "and gives focus back to it");
});

test("the dialog's picker waits in its template until it first opens, then stays (FP-02)", () => {
  page();
  begin();
  assert.equal(document.querySelectorAll("[data-picker-dialog] a").length, 0, "none of its links is in the page yet");
  assert.equal(field() === null, true);
  $("#header-read").click();
  assert.equal(dialog().open, true);
  assert.equal($("[data-picker-dialog] template") === null, true, "put in place");
  assert.equal(focusedId(), "picker-field");
  key(field(), "Escape");
  assert.equal(dialog().open, false);
  document.dispatchEvent(new CustomEvent(OPEN_EVENT, { cancelable: true }));
  assert.equal(dialog().open, true);
  assert.equal(document.querySelectorAll("[data-picker]").length, 1, "once");
  assert.equal(focusedId(), "picker-field");
});

test("the arrows, Home, and End move inside the chapters, and turn no chapter (FP-13)", () => {
  page();
  begin();
  let turned = 0;
  $("#line-next").addEventListener("click", () => turned++);
  $("#line-chapter").click();
  const at = () => document.activeElement?.dataset.pickerChapter;
  assert.equal(key(document.activeElement, "ArrowRight"), true);
  assert.equal(at(), "4");
  key(document.activeElement, "ArrowLeft");
  assert.equal(at(), "3");
  key(document.activeElement, "End");
  assert.equal(at(), "21", "John has 21");
  key(document.activeElement, "Home");
  assert.equal(at(), "1");
  const stops = [...document.querySelectorAll("#picker-john [data-picker-chapter]")].filter((c) => c.tabIndex === 0);
  assert.deepEqual(
    stops.map((c) => c.dataset.pickerChapter),
    ["1"],
    "still one stop, where focus is",
  );
  assert.equal(key(document.body, "ArrowRight"), false, "the page's arrows stand down while it is open");
  assert.equal(turned, 0);
});

test("Escape empties the field first, then closes, and focus goes back to what opened it", () => {
  page();
  begin();
  $("#line-book").click();
  type("rom");
  assert.equal($("[data-picker-offers]").hidden, false);
  assert.equal(key(field(), "Escape"), true);
  assert.equal(field().value, "");
  assert.equal($("[data-picker-offers]").hidden, true);
  assert.equal(dialog().open, true, "the words went, the picker stayed");
  key(field(), "Escape");
  assert.equal(dialog().open, false);
  assert.equal(focusedId(), "line-book");
  assert.deepEqual(expanded(), ["false", "false", "false"]);
});

test("“rom 8” offers “Go to Romans 8” at once, shows Romans, and Enter goes there (FP-03)", () => {
  page();
  begin();
  $("#line-book").click();
  type("rom 8");
  assert.deepEqual(
    rows().map((r) => [r.textContent, r.getAttribute("href"), r.getAttribute("aria-selected")]),
    [["Go to Romans 8", "/romans-8/", "true"]],
  );
  assert.equal(field().getAttribute("role"), "combobox");
  assert.equal(field().getAttribute("aria-controls"), "picker-offers");
  assert.equal(field().getAttribute("aria-expanded"), "true");
  assert.equal(field().getAttribute("aria-activedescendant"), rows()[0].id);
  assert.equal($("[data-picker-status]").textContent, "Go to Romans 8", "said aloud");
  assert.equal(shown(), "romans", "the book typed is shown below");
  $("[data-picker-form]").requestSubmit();
  assert.deepEqual(went, ["/romans-8/"]);
  assert.equal(dialog().open, false, "closed on the way");
});

test("the arrows choose among the offers: “romans,” then Down, goes to its introduction (FP-04)", () => {
  page();
  begin();
  $("#line-book").click();
  type("romans");
  assert.equal(chosen(), 0);
  assert.equal(key(field(), "ArrowDown"), true);
  assert.equal(chosen(), 1);
  assert.equal(field().getAttribute("aria-activedescendant"), "picker-offer-1");
  key(field(), "ArrowDown");
  assert.equal(chosen(), 0, "round again");
  key(field(), "ArrowUp");
  assert.equal(chosen(), 1);
  $("[data-picker-form]").requestSubmit();
  assert.deepEqual(went, ["/romans-intro/"]);
});

test("“forgiveness” offers the search, and Enter runs it (FP-06)", () => {
  page();
  begin();
  $("#line-book").click();
  type("forgiveness");
  assert.deepEqual(
    rows().map((r) => [r.textContent, r.dataset.kind]),
    [["Search for ‘forgiveness’", "search"]],
  );
  $("[data-picker-form]").requestSubmit();
  assert.deepEqual(went, ["/search/?q=forgiveness"]);
});

test("an empty field offers nothing, and Enter goes nowhere", () => {
  page();
  begin();
  $("#line-book").click();
  type("   ");
  assert.equal($("[data-picker-offers]").hidden, true);
  assert.equal(field().getAttribute("aria-expanded"), "false");
  assert.equal(field().hasAttribute("aria-activedescendant"), false);
  assert.equal($("[data-picker-status]").textContent, "");
  $("[data-picker-form]").requestSubmit();
  assert.deepEqual(went, []);
  assert.equal(dialog().open, true);
});

test("a page in progress is offered with “in progress” beside it, and still opens (FP-10)", () => {
  page({ drafts: { draftChaptersByBook: { luke: [23, 24] } } });
  begin();
  $("#line-book").click();
  type("luke 23");
  assert.equal(rows()[0].classList.contains("kit-row--draft"), true);
  assert.equal(rows()[0].textContent, "Go to Luke 23, in progress");
  assert.equal($("[data-picker-status]").textContent, "Go to Luke 23, in progress");
  type("luke 22");
  assert.equal(rows()[0].classList.contains("kit-row--draft"), false);
  type("luke 23");
  $("[data-picker-form]").requestSubmit();
  assert.deepEqual(went, ["/luke-23/"]);
});

test("the books are tabs: the arrows, Home, and End show and focus one, and Space and a press show one (FP-09)", () => {
  page();
  begin();
  $("#line-book").click();
  const tab = (k) => $(`#picker-tab-${k}`);
  const focusedBook = () => document.activeElement?.dataset.pickerBook;
  assert.equal($("[data-picker-books]").getAttribute("role"), "tablist");
  assert.equal(tab("john").getAttribute("role"), "tab");
  assert.equal(tab("john").getAttribute("aria-controls"), "picker-john");
  assert.equal($("#picker-john").getAttribute("role"), "tabpanel");
  assert.deepEqual(
    [...document.querySelectorAll("[data-picker-book]")].filter((t) => t.tabIndex === 0).map((t) => t.dataset.pickerBook),
    ["john"],
    "one stop: the book shown",
  );
  tab("john").focus();
  assert.equal(key(tab("john"), "ArrowRight"), true);
  assert.equal(shown(), "acts");
  assert.equal(focusedBook(), "acts");
  key(document.activeElement, "End");
  assert.equal(shown(), "revelation");
  key(document.activeElement, "Home");
  assert.equal(shown(), "matthew");
  tab("mark").focus();
  key(tab("mark"), " ");
  assert.equal(shown(), "mark", "Space shows the book focused");
  assert.equal($("#picker-mark .picker__intro").getAttribute("href"), "/mark-intro/", "its introduction under its chapters");
  assert.equal(document.querySelectorAll("#picker-mark [data-picker-chapter]").length, 16);
  tab("luke").click();
  assert.equal(clicks.at(-1), true, "a book is a link to its chapters on /read, not followed");
  assert.equal(shown(), "luke");
  assert.equal(focusedBook(), "luke");
  assert.equal(document.querySelectorAll("[data-picker-section][data-shown]").length, 1);
});

test("a press outside, its ×, and a chapter chosen close it; a press for a new tab leaves it open", async () => {
  page();
  begin();
  $("#line-book").click();
  dialog().dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  assert.equal(dialog().open, false, "a press on the dimmed page lands on the dialog itself");
  assert.equal(focusedId(), "line-book");

  $("#line-chapter").click();
  $("[data-picker-close]").click();
  assert.equal(dialog().open, false, "its ×");
  assert.equal(focusedId(), "line-chapter");

  $("#line-book").click();
  const mark4 = $('#picker-mark [data-picker-chapter="4"]');
  mark4.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true }));
  await settle();
  assert.equal(dialog().open, true, "a new tab's press leaves it open");
  mark4.click();
  assert.equal(clicks.at(-1), false, "the link is followed");
  assert.equal(dialog().open, true, "until the press has drawn");
  await settle();
  assert.equal(dialog().open, false);
  assert.deepEqual(went, [], "the link goes by itself");
});

test("Tab stays inside: from the last stop to the field, and back (FP-02)", () => {
  page();
  begin();
  $("#line-book").click();
  const foot = $(".picker__foot");
  foot.focus();
  assert.equal(key(foot, "Tab"), true);
  assert.equal(focusedId(), "picker-field");
  assert.equal(key(field(), "Tab", { shiftKey: true }), true);
  assert.equal(document.activeElement?.classList.contains("picker__foot"), true);
  field().focus();
  assert.equal(key(field(), "Tab"), false, "between them, Tab is the browser's");
});

test("G opens the panel at the books, hanging under the place line's book inside the window (FP-02, FP-13)", () => {
  page();
  begin();
  const root = document.documentElement;
  Object.defineProperty(root, "clientWidth", { configurable: true, get: () => 1440 });
  const book = $("#line-book");
  let left = 300;
  book.getBoundingClientRect = () => ({ top: 60, bottom: 96, left, right: left + 80, width: 80, height: 36 });
  dialog().getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 800, height: 0 });
  try {
    assert.equal(key(document.body, "g"), true);
    assert.equal(dialog().open, true);
    assert.equal(focusedId(), "picker-field");
    assert.equal(dialog().style.getPropertyValue("--picker-top"), "104px", "8px under it");
    assert.equal(dialog().style.getPropertyValue("--picker-left"), "300px");
    assert.equal(key(field(), "g"), false, "in the field, g is typed");
    key(field(), "Escape");
    assert.equal(dialog().open, false);
    left = 900;
    key(document.body, "g");
    assert.equal(dialog().style.getPropertyValue("--picker-left"), "624px", "kept 16px inside the window's edge");
  } finally {
    delete root.clientWidth;
  }
});

test("G with the place line scrolled out of sight opens the panel at the window's top, centered (FP-02)", () => {
  page();
  begin();
  const root = document.documentElement;
  Object.defineProperty(root, "clientWidth", { configurable: true, get: () => 1440 });
  // Read far down the chapter: the line and the header are above the window.
  $("#line-book").getBoundingClientRect = () => ({ top: -1420, bottom: -1384, left: 4, right: 84, width: 80, height: 36 });
  for (const way of document.querySelectorAll("[data-picker-open]")) {
    if (way.id !== "line-book") way.getBoundingClientRect = () => ({ top: -1480, bottom: -1444, left: 200, right: 260, width: 60, height: 36 });
  }
  dialog().getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 800, height: 0 });
  try {
    assert.equal(key(document.body, "g"), true);
    assert.equal(dialog().open, true);
    assert.equal(dialog().style.getPropertyValue("--picker-top"), "16px", "in the window, never above it");
    assert.equal(dialog().style.getPropertyValue("--picker-left"), "320px", "centered");
  } finally {
    delete root.clientWidth;
  }
});

test("G does nothing with the keys switched off, or once the script has gone", () => {
  page();
  begin();
  localStorage.setItem("lit-shortcuts", "off");
  assert.equal(key(document.body, "g"), false);
  assert.equal(dialog().open, false);
  localStorage.removeItem("lit-shortcuts");
  stop();
  const ev = new CustomEvent(OPEN_EVENT, { cancelable: true });
  document.dispatchEvent(ev);
  assert.equal(ev.defaultPrevented, false);
  assert.equal(key(document.body, "g"), false);
  assert.equal(dialog().open, false);
});

test("Continue reading is the first row once the reader has read elsewhere (FP-07, NX-12, NB-32)", () => {
  record("romans", 8, 28);
  page();
  begin();
  $("#line-book").click();
  const cont = $("[data-picker-continue]");
  assert.equal(cont.hidden, false);
  assert.equal(cont.getAttribute("href"), "/romans-8/#v28");
  assert.equal(cont.textContent.replace(/\s+/g, " ").trim(), "Continue: Romans 8");
  assert.equal(shown(), "john", "the page's own book is still the one shown");
});

test("Continue reading isn't offered for the page being read", () => {
  record("john", 3);
  page();
  begin();
  $("#line-book").click();
  assert.equal($("[data-picker-continue]").hidden, true);
});

test("on a page that names no passage the picker opens at the reader's book, else Matthew", () => {
  record("romans", 8);
  page({ book: "" });
  begin();
  $("#header-read").click();
  assert.equal(shown(), "romans");
  assert.equal($("[data-picker-continue]").hidden, false);
  key(field(), "Escape");
  localStorage.clear();
  $("#header-read").click();
  assert.equal(shown(), "matthew");
  assert.equal($("[data-picker-continue]").hidden, true, "nothing to continue");
});

test("/read is the picker at full size: the book its address names, else the reader's, else Matthew (FP-16, BP-08)", async () => {
  readPage("http://localhost/read/#picker-mark");
  begin();
  assert.equal(shown(), "mark");
  assert.equal($("[data-picker]").hasAttribute("data-picker-ready"), true);
  window.happyDOM.setURL("http://localhost/read/#picker-luke");
  await settle();
  assert.equal(shown(), "luke", "a book's link on the page is its address");
  stop();

  record("romans", 8);
  readPage();
  begin();
  assert.equal(shown(), "romans");
  assert.equal($("[data-picker-continue]").hidden, false, "Continue reading, first");
  stop();

  localStorage.clear();
  readPage();
  begin();
  assert.equal(shown(), "matthew");
});

test("on /read, Read and G come to the field, and typing goes as in the panel (FP-15, FP-16)", () => {
  readPage();
  begin();
  $("#header-read").click();
  assert.equal(clicks.at(-1), true);
  assert.equal(focusedId(), "picker-field");
  field().blur();
  assert.equal(key(document.body, "g"), true);
  assert.equal(focusedId(), "picker-field");
  type("jn 3 16");
  $("[data-picker-form]").requestSubmit();
  assert.deepEqual(went, ["/john-3/#v16"]);
  $('#picker-matthew [data-picker-chapter="5"]').focus();
  assert.equal(key(document.activeElement, "ArrowRight"), true);
  assert.equal(document.activeElement?.dataset.pickerChapter, "6", "the arrows are the grid's");
});

// ── Search on the place line (FP-27 to FP-30) ──────────────────────────

/** The place line as PlaceLine.astro draws it on John 3, with the page's
 *  one SearchBar waiting in its hidden find. */
function linePage() {
  document.body.innerHTML = `
    <div class="place-line place-line--reading" data-place-line>
      <div class="place-line__inner">
        <p class="place-line__trail"><a class="kit-btn kit-btn--plain place-line__pick" href="/read/" data-picker-open="books">John</a></p>
        <div class="place-line__commands">
          <a class="kit-btn kit-btn--plain" id="line-search" href="/search" data-line-search>Search</a>
          <nav class="place-line__turn" aria-label="Chapters">
            <a class="kit-icon" id="line-prev" href="/john-2/" rel="prev" aria-label="Previous: John 2">‹</a>
            <a class="kit-icon" id="line-next" href="/john-4/" rel="next" aria-label="Next: John 4">›</a>
          </nav>
        </div>
        <div class="place-line__find" id="lineFind" data-line-find hidden>
          <div class="searchbar" data-searchbar data-open="false"><input type="search" id="site-search-input"><button type="button" class="searchbar__close">Close results</button></div>
          <button type="button" class="kit-icon place-line__find-close" aria-label="Close search" data-line-find-close>×</button>
        </div>
      </div>
    </div>
    <main id="main-content"><p>For God so loved the world.</p></main>`;
  // searchbar.js's own close, which the line presses to close the results.
  let shut = 0;
  $(".searchbar__close").addEventListener("click", () => {
    shut++;
    $("[data-searchbar]").dataset.open = "false";
  });
  return { shut: () => shut };
}

const lineOpen = () => $("[data-place-line]").hasAttribute("data-search-open");

test("the line's Search is a link to /search that the script makes a button; its icons get tips (FP-28, RP-30)", () => {
  linePage();
  stop = startLine({ doc: document, win: window });
  const search = $("#line-search");
  assert.equal(search.getAttribute("href"), "/search");
  assert.equal(search.getAttribute("role"), "button");
  assert.equal(search.getAttribute("aria-controls"), "lineFind");
  assert.equal(search.getAttribute("aria-expanded"), "false");
  assert.equal($("#line-prev").dataset.tip, "Previous: John 2");
  assert.equal($("#line-next").dataset.tip, "Next: John 4");
  assert.equal($("[data-line-find-close]").dataset.tip, "Close search");
});

test("pressing Search opens the field in place of the line; Escape closes the results, then the field (FP-30)", () => {
  const { shut } = linePage();
  stop = startLine({ doc: document, win: window });
  const search = $("#line-search");
  search.click();
  assert.equal(clicks.at(-1), true, "not followed to /search");
  assert.equal(lineOpen(), true);
  assert.equal($("[data-line-find]").hidden, false);
  assert.equal(search.getAttribute("aria-expanded"), "true");
  assert.equal(focusedId(), "site-search-input");
  $("[data-searchbar]").dataset.open = "true";
  key($("#site-search-input"), "Escape");
  assert.equal(lineOpen(), true, "Escape is the results' first (searchbar.js)");
  $("[data-searchbar]").dataset.open = "false";
  assert.equal(key($("#site-search-input"), "Escape"), true);
  assert.equal(lineOpen(), false);
  assert.equal($("[data-line-find]").hidden, true);
  assert.equal(search.getAttribute("aria-expanded"), "false");
  assert.equal(focusedId(), "line-search", "focus back on Search");
  assert.equal(shut(), 1, "the results closed the way their own button closes them");
});

test("its × closes it too, and a press for a new tab is left to the browser", () => {
  linePage();
  stop = startLine({ doc: document, win: window });
  const search = $("#line-search");
  search.click();
  $("[data-line-find-close]").click();
  assert.equal(lineOpen(), false);
  assert.equal(focusedId(), "line-search");
  search.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true }));
  assert.equal(clicks.at(-1), false, "/search opens in its tab");
  assert.equal(lineOpen(), false);
});

test("/ presses Search, and ← → [ ] turn the chapter by the line's arrows (FP-13, FP-30, RP-30)", () => {
  linePage();
  stop = startLine({ doc: document, win: window });
  assert.equal(key(document.body, "/"), true);
  assert.equal(lineOpen(), true);
  assert.equal(focusedId(), "site-search-input");
  assert.equal(key($("#site-search-input"), "/"), false, "in the field, / is typed");
  key($("#site-search-input"), "Escape");
  const turned = [];
  for (const a of document.querySelectorAll(".place-line a[rel]")) a.addEventListener("click", () => turned.push(a.getAttribute("rel")));
  assert.equal(key(document.body, "ArrowRight"), true);
  assert.equal(key(document.body, "ArrowLeft"), true);
  assert.equal(key(document.body, "]"), true);
  assert.equal(key(document.body, "["), true);
  assert.deepEqual(turned, ["next", "prev", "next", "prev"]);
});

test("the field closes when the window narrows to a phone's, whose top row borrows it (PH-10)", () => {
  linePage();
  const query = {
    matches: false,
    addEventListener(type, listener) {
      if (type === "change") this.change = listener;
    },
  };
  stop = startLine({ doc: document, win: { matchMedia: () => query } });
  $("#line-search").click();
  query.matches = true;
  query.change();
  assert.equal(lineOpen(), false);
  assert.notEqual(focusedId(), "line-search", "the line isn't drawn there, so focus isn't sent to it");
});

// ── The markup and the stylesheets ─────────────────────────────────────

const placeLine = read("src/components/PlaceLine.astro");
const pickerSource = read("src/components/PassagePicker.astro");
const pickerMarkup = pickerSource.slice(pickerSource.indexOf("---", 3) + 3);
const layout = read("src/layouts/Layout.astro");
const scriptureLayout = read("src/layouts/ScriptureLayout.astro");
const readSource = read("src/pages/read.astro");
const readMarkup = readSource.slice(readSource.indexOf("---", 3) + 3);
const headerCss = read("src/styles/header.css");
const pickerCss = read("src/styles/picker.css");

/** The place line's reading half, as written. */
const readingLine = placeLine.slice(placeLine.indexOf("{reading ? ("), placeLine.indexOf('<div class="place-line">'));

/** Every file under `dir` whose name ends in one of `exts`. */
function filesUnder(dir, exts) {
  const out = [];
  for (const entry of readdirSync(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...filesUnder(rel, exts));
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(rel);
  }
  return out;
}

test("the place line: “John ▾ / Chapter 3 ▾,” then Search, ‹ ›, the Notebook, and “Study John 3” (RP-29, FP-28, RP-32)", () => {
  const order = [
    'data-picker-open="books"',
    'data-picker-open="chapters"',
    "data-line-search",
    'class="place-line__turn"',
    'rel="prev"',
    'rel="next"',
    "place-line__notebook",
    "data-study-place",
    "data-line-find",
  ];
  const at = order.map((s) => readingLine.indexOf(s));
  assert.deepEqual(
    order.filter((_, i) => at[i] < 0),
    [],
    "every part is there",
  );
  assert.deepEqual(
    [...at].sort((a, b) => a - b),
    at,
    "in that order",
  );
  assert.ok(readingLine.includes('<a class="kit-btn kit-btn--plain place-line__pick" href="/read/" data-picker-open="books">'), "the book: /read without JavaScript");
  assert.ok(readingLine.includes('href={`/read/#picker-${book}`} data-picker-open="chapters">'), "the chapter: the book's chapters on /read");
  assert.ok(readingLine.includes('{intro ? "Introduction" : `Chapter ${reading.chapter}`}<Icon name="down" />'));
  assert.ok(readingLine.includes('<a class="kit-btn kit-btn--plain" href="/search" data-line-search>'), "Search: /search without JavaScript");
});

test("the line's arrows are plain icons named for where they go, and say when there is nowhere (RP-30, CO-11)", () => {
  assert.ok(readingLine.includes('<a class="kit-icon" href={turn.prev.href} rel="prev" aria-label={`Previous: ${turn.prev.label}`}>'));
  assert.ok(readingLine.includes('<a class="kit-icon" href={turn.next.href} rel="next" aria-label={`Next: ${turn.next.label}`}>'));
  assert.equal((readingLine.match(/role="link" aria-disabled="true"/g) ?? []).length, 2);
  assert.ok(placeLine.includes("navFor(book, reading.chapter)"), "the one Previous/Next rule, which steps over drafts");
  for (const file of filesUnder("src", [".astro", ".css", ".js", ".mjs"])) {
    assert.doesNotMatch(read(file), /\bnav-button\b/, `${file}: no round arrow button left`);
  }
});

test("Study's ways in on the line, “Study John 3” and the Notebook, show only on a computer with the preview (RP-32, ST-15, CT-09, DI-16)", () => {
  assert.ok(placeLine.includes("const studyName = intro ? `Study ${bookName}` : `Study ${bookName} ${reading?.chapter}`;"));
  assert.ok(readingLine.includes('<a class="kit-btn kit-btn--plain place-line__study" href={reading.studyHref} data-study-place>{studyName}</a>'));
  assert.ok(readingLine.includes('<button type="button" class="kit-btn kit-btn--plain place-line__notebook" data-desk-toggle aria-expanded="false" aria-controls="deskPanel">'));
  assert.match(
    headerCss,
    /\.place-line__notebook,\s*\.place-line__study \{\s*display: none;\s*\}\s*@media \(min-width: 1100px\) \{\s*html\[data-desk\] \.place-line__notebook,\s*html\[data-desk\] \.place-line__study \{\s*display: inline-flex;/,
  );
  assert.match(scriptureLayout, /studyHref: deskPlaceHref/, "the chapter's own address in Study (an introduction's chapter 1)");
  assert.doesNotMatch(placeLine + scriptureLayout, /Switch to Read View|Study Desk</, "RP-31: no Read View pill, and Study by its new name");
});

test("a reading page's one search field waits in the line, and the header has no magnifier there (FP-27, FP-31)", () => {
  assert.match(
    readingLine,
    /<div class="place-line__find" id="lineFind" data-line-find hidden>\s*<SearchBar placeholder="Search the LIT, or go to a passage" \/>\s*<button type="button" class="kit-icon place-line__find-close" aria-label="Close search" data-line-find-close>/,
  );
  assert.doesNotMatch(scriptureLayout, /<SearchBar\b/, "no field in the reading row");
  assert.ok(layout.includes('const search = deskTitle || where.readPage ? "none" : pageSearch ? "page" : "strip";'), "every other page keeps the header's magnifier");
  assert.match(headerCss, /@media screen and \(max-width: 699px\) \{\s*\.place-line--reading \{\s*display: none;/, "a phone's bars do the line's work (PH-10)");
});

test("Layout draws the line on a chapter and the picker's dialog on every page but /read and Study's own (FP-02, FP-15)", () => {
  assert.match(layout, /\{readingLine && !deskTitle \? \(\s*<PlaceLine where=\{where\} reading=\{readingLine\} \/>/);
  assert.match(
    layout,
    /\{!deskTitle && !pickerInPage && \(\s*<dialog class="picker-dialog" id="passagePicker" aria-label="Choose passage" data-picker-dialog data-pagefind-ignore>\s*<template data-picker-template>\s*<PassagePicker book=\{readingLine\?\.book\} chapter=\{readingLine\?\.chapter\} \/>\s*<\/template>/,
    "kept in a template until it first opens",
  );
  assert.match(
    layout,
    /\{!deskTitle && \(\s*<script>\s*import "\.\.\/scripts\/passage-picker\.js";\s*<\/script>/,
    "the script, outside the template, on every page with a picker",
  );
  assert.doesNotMatch(pickerSource, /<script\b/, "inside the template no script would run");
  assert.match(scriptureLayout, /readingLine=\{readingLine\}/);
  for (const file of ["src/layouts/Layout.astro", "src/layouts/ScriptureLayout.astro", "src/layouts/SearchLayout.astro", "src/pages/read.astro", "src/components/SiteHeader.astro"]) {
    assert.doesNotMatch(read(file), /import ReadMenu/, `${file}: today's Go to passage is gone (FP-01)`);
  }
  for (const file of filesUnder("src", [".astro", ".js", ".mjs", ".ts", ".css"])) {
    assert.doesNotMatch(read(file), /data-rm-also/, `${file}: the phone's picker is the passage picker's sheet now`);
  }
});

test("the picker reads top to bottom: the field, its offers, Continue, the 27 books, the chapters, and Release Notes last (FP-03, FP-07, FP-12, HD-29, NX-28)", () => {
  const order = ["data-picker-field", "data-picker-offers", "data-picker-continue", "data-picker-books", "data-picker-section", "picker__foot"];
  const at = order.map((s) => pickerMarkup.indexOf(s));
  assert.deepEqual(
    order.filter((_, i) => at[i] < 0),
    [],
  );
  assert.deepEqual(
    [...at].sort((a, b) => a - b),
    at,
  );
  const links = [...pickerMarkup.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
  assert.equal(links.at(-1), '<a class="kit-row picker__foot" href="/release-notes/">', "Release Notes is its last row");
  assert.ok(pickerMarkup.includes('href="/release-notes/">Release Notes</a>'));
  assert.match(pickerMarkup, /\{!full && \(\s*<button type="button" class="kit-icon picker__close" aria-label="Close picker" data-picker-close>/, "/read's has no ×");
  assert.ok(pickerMarkup.includes("placeholder={FIELD_HINT}"));
});

test("no “Read the whole book” row, and the books and chapters are the kit's tabs (FP-11, RP-47, FP-10)", () => {
  for (const file of filesUnder("src", [".astro", ".js", ".mjs"])) {
    assert.doesNotMatch(read(file), /Read the whole book/i, file);
  }
  assert.ok(pickerMarkup.includes('class:list={["kit-tab", "picker__book", b.draft && "kit-tab--draft"]}'));
  assert.ok(pickerMarkup.includes('class:list={["kit-tab", "picker__chapter", c.draft && "kit-tab--draft"]}'));
  assert.ok(pickerMarkup.includes('class:list={["kit-row", "picker__intro", b.intro.draft && "kit-row--draft"]}'));
  assert.ok(pickerMarkup.includes("{c.draft && <span class=\"sr-only\">, {IN_PROGRESS}</span>}"), "a draft chapter's number says so aloud");
  assert.match(read("src/styles/kit.css"), /\.kit-tab--draft,\s*\.kit-row--draft:not\(\[aria-selected="true"\], \[aria-current\]:not\(\[aria-current="false"\]\)\) \{\s*color: rgba\(var\(--color-text-rgb\), var\(--text-3-alpha\)\);/, "dimmed to the third ink, never faded");
});

test("the test's picker is the component's: every hook the script reads is in PassagePicker.astro", () => {
  for (const hook of [
    "data-picker\n",
    'data-picker-full={full ? "" : undefined}',
    "data-book={book || undefined}",
    "data-chapter={chapter === undefined ? undefined : String(chapter)}",
    'action="/search/" method="get" role="search" data-picker-form',
    '<label class="sr-only" for="picker-field">Book, chapter, or verse</label>',
    'id="picker-field"',
    'type="search"',
    'name="q"',
    "data-picker-field",
    'id="picker-offers" role="listbox" aria-label="Passages" data-picker-offers hidden',
    '<p class="sr-only" role="status" data-picker-status></p>',
    '<a class="kit-row picker__continue" href="/read/" data-picker-continue hidden>',
    "Continue: <span data-picker-continue-label></span>",
    'aria-label="Books" data-picker-books',
    "id={`picker-tab-${b.key}`}",
    "href={bookHref(b.key)}",
    "data-picker-book={b.key}",
    "id={`picker-${b.key}`}",
    "data-picker-section={b.key}",
    "data-picker-grid",
    'aria-current={b.key === book && c.n === chapter ? "page" : undefined}',
    "data-picker-chapter={c.n}",
    'aria-current={b.key === book && chapter === "intro" ? "page" : undefined}',
  ]) {
    assert.ok(pickerSource.includes(hook), hook);
  }
  assert.ok(pickerSource.includes("const bookHref = (key: string) => (full ? `#picker-${key}` : `/read/#picker-${key}`);"));
});

test("/read is the page's title, the owner's lede, and the picker at full size, and nothing else (FP-16, FP-22, FP-25, BP-08)", () => {
  assert.match(readSource, /<Layout[^>]*\bpickerInPage\b[^>]*>/);
  assert.ok(readMarkup.includes("<PassagePicker full />"));
  assert.ok(readMarkup.includes('<h1 class="read-title">Read the LIT Online</h1>'));
  assert.ok(readMarkup.includes('<p class="read-lede">'));
  assert.doesNotMatch(readMarkup, /view-card|ContinueReading|whats-new|Read View|Chapter View|Study Desk/, "no card, chip, or disclosure left");
  assert.ok(readMarkup.includes('location.replace("/license/"+h)'), "the license's old addresses still forward (FP-19)");
});

test("the panel opens at Quick speed and the phone's sheet at Large, rising nearly to the top (FP-02, FP-14, PH-10)", () => {
  assert.match(pickerCss, /@media \(min-width: 700px\) \{\s*\.picker-dialog\[open\] \{\s*animation: picker-in var\(--dur-quick\) var\(--ease\);/);
  assert.match(pickerCss, /@media \(max-width: 699px\) \{\s*\.picker-dialog \{[^}]*height: calc\(100dvh - var\(--space-7\)\);/);
  assert.match(pickerCss, /\.picker-dialog\[open\] \{\s*transform: none;\s*transition:\s*transform var\(--dur-large\) var\(--ease\)/);
  assert.match(pickerCss, /html:has\(\.picker-dialog\[open\]\) \{\s*overflow: hidden;/, "the page behind stays still");
  assert.match(pickerCss, /\.picker:not\(\[data-picker-ready\]\) \.picker__section:target,/, "without JavaScript, /read shows the book its address names");
});

test("the books stand three to a row wherever the picker is wide enough (FP-08)", () => {
  // A container query adds no weight, so its rule must come after the one it
  // changes: written first, the books stood in one column and the panel
  // scrolled.
  const wide = pickerCss.indexOf("@container picker (min-width: 640px)");
  const base = pickerCss.indexOf(".picker__books {");
  assert.ok(wide > 0 && base > 0, "both rules are there");
  assert.ok(base < wide, "the three-column rule comes after the books' own");
  assert.match(pickerCss.slice(wide), /\.picker__books \{\s*grid-template-columns: repeat\(3, max-content\);/);
});
