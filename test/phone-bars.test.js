// test/phone-bars.test.js
//
// The phone's two bars (SITE-FEATHERBOA.md, "The phone"; Featherboa's Phase
// 3): on a chapter or a book's introduction under 700px, the header's
// reading row at the top (the emblem, the chapter's name as the picker, and
// Aa) and the bar at the thumb (Previous, Search, Menu, Next), which hide
// together on a scroll down and come back on any scroll up. The first tests
// hold src/lib/phone-bars.mjs's rule; the next hold the markup and the
// stylesheets to the record, since happy-dom has no layout and Astro doesn't
// run here; the rest drive src/scripts/phone-bars.js over the bars' own
// markup, written out below, with a window whose scroll the test moves.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import "./helpers/browser-env.mjs";
import { NUDGE, PHONE_QUERY, barState, barValue, scrolled } from "../src/lib/phone-bars.mjs";

const { start } = await import("../src/scripts/phone-bars.js");

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// ── The rule ───────────────────────────────────────────────────────────

test("in their own place at the top of the page the bars always show", () => {
  assert.deepEqual(barState({ y: 40, lastY: 0, home: 120, away: false, held: false }), { afloat: false, away: false });
  assert.deepEqual(barState({ y: 100, lastY: 400, home: 120, away: true, held: false }), { afloat: false, away: false });
  assert.equal(barValue({ afloat: false, away: false }), "");
});

test("past it, a scroll down hides them, any scroll up brings them back, and a still page keeps them as they are", () => {
  assert.deepEqual(barState({ y: 500, lastY: 400, home: 120, away: false, held: false }), { afloat: true, away: true });
  assert.deepEqual(barState({ y: 480, lastY: 500, home: 120, away: true, held: false }), { afloat: true, away: false });
  assert.deepEqual(barState({ y: 480, lastY: 480, home: 120, away: true, held: false }), { afloat: true, away: true });
  assert.equal(barValue({ afloat: true, away: true }), "away afloat");
  assert.equal(barValue({ afloat: true, away: false }), "afloat");
});

test("held (search, the picker, the tray, or the menu open, or a keyboard in a bar), they stay", () => {
  assert.deepEqual(barState({ y: 900, lastY: 400, home: 120, away: false, held: true }), { afloat: true, away: false });
  assert.deepEqual(barState({ y: 900, lastY: 400, home: 120, away: true, held: true }), { afloat: true, away: false });
});

test("a nudge under eight pixels either way changes nothing, and a slow scroll still adds up", () => {
  assert.equal(NUDGE, 8);
  let s = { afloat: true, away: false, mark: 500 };
  const step = (y) => (s = scrolled({ y, mark: s.mark, home: 120, away: s.away, held: false }));
  step(504);
  assert.equal(s.away, false, "four pixels down: still showing");
  assert.equal(s.mark, 500, "measured from where they last answered");
  step(507);
  assert.equal(s.away, false);
  step(509);
  assert.equal(s.away, true, "nine pixels down in all: hidden");
  step(503);
  assert.equal(s.away, true, "six back up: still hidden");
  assert.equal(s.mark, 509, "hidden, the mark is the lowest point");
  step(500);
  assert.equal(s.away, false, "nine back up: shown");
  step(100);
  assert.deepEqual({ afloat: s.afloat, away: s.away }, { afloat: false, away: false }, "home: in their place");
});

test("a phone is under 700px, the width the stylesheets use", () => {
  assert.equal(PHONE_QUERY, "(max-width: 699px)");
  const css = read("src/styles/header.css");
  assert.match(css, /@media screen and \(max-width: 699px\) \{\s*\.site-header\.site-header--reading \{\s*position: sticky;/);
  assert.match(css, /html\[data-bars~="away"\] \.site-header\.site-header--reading \{\s*transform: translateY\(-100%\);/);
  assert.match(css, /html\[data-bars~="away"\] \.phone-bar \{\s*transform: translateY\(100%\);/);
});

// ── The markup and the stylesheets ─────────────────────────────────────

const bar = read("src/components/PhoneBar.astro");
const header = read("src/components/SiteHeader.astro");
const scriptureLayout = read("src/layouts/ScriptureLayout.astro");

test("the bar: Previous, Search, Menu, and Next, each the kit's plain button with its icon and its word (PH-02 to PH-04)", () => {
  const words = [...bar.matchAll(/<span class="phone-bar__word">([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(words)], ["Previous", "Search", "Menu", "Next"]);
  for (const name of ["back", "search", "menu", "forward"]) assert.ok(bar.includes(`<Icon name="${name}" />`), name);
  assert.equal(bar.split('class="kit-btn kit-btn--plain phone-bar__item"').length - 1, 6, "Previous and Next twice each (there, and unavailable), Search, and Menu");
  assert.ok(bar.includes('<nav class="phone-bar" aria-label="Chapters, search, and menu" data-phone-bar data-pagefind-ignore>'));
});

test("Previous and Next follow the one rule and name where they go; at either end of the book one is drawn unavailable in its place", () => {
  assert.ok(bar.includes("const { prev, next } = navFor(key, chapter);"));
  assert.ok(bar.includes('href={prev.href} rel="prev" aria-label={`Previous: ${prev.label}`}'));
  assert.ok(bar.includes('href={next.href} rel="next" aria-label={`Next: ${next.label}`}'));
  assert.equal(bar.split('role="link" aria-disabled="true"').length - 1, 2, "no href, so never a stop or a press");
});

test("without JavaScript Search goes to /search and Menu to the footer's links (PH-26)", () => {
  assert.ok(bar.includes('href="/search" data-bar-search'));
  assert.ok(bar.includes('href="#footer-nav" data-menu-toggle'));
  assert.ok(read("src/components/SiteFooter.astro").includes('id="footer-nav"'));
});

test("the top row: the emblem goes home, the chapter's name is the picker, then Aa; and the search field's place (PH-01, PH-09)", () => {
  assert.ok(header.includes("{picker && <span class=\"sr-only site-header__home\">Home</span>}"));
  assert.match(header, /<a class="kit-btn kit-btn--plain site-header__picker" href="\/read" data-rm-also>/);
  assert.match(header, /<span class="sr-only">Go to passage\. Current:&nbsp;<\/span>\s*<span class="site-header__picker-label">\{picker\}<\/span>\s*<Icon name="down" \/>/);
  assert.ok(header.includes('<div class="site-header__find" id="phoneFind" data-phone-find hidden>'));
  assert.ok(header.includes('aria-label="Close search" data-phone-find-close'));
  assert.ok(header.includes('${picker ? "site-header--reading" : ""}'), "the row's own class, only where there is a picker");
});

test("only a chapter or an introduction has the bars", () => {
  assert.ok(scriptureLayout.includes('import PhoneBar from "../components/PhoneBar.astro";'));
  assert.match(scriptureLayout, /\{isScriptureLike && \(\s*<PhoneBar bookKey=\{pagefindBook\} chapter=\{headerKind === "intro" \? "intro" : \(headerChapter \?\? 1\)\} \/>/);
  assert.match(scriptureLayout, /picker=\{phonePicker\}/);
  assert.ok(read("src/layouts/Layout.astro").includes("picker={picker}"), "Layout hands the picker to the header");
});

test("the bars take the places of the toolbar and the title's round buttons on a phone, and a page prefetches the bar's neighbors (PH-06)", () => {
  assert.doesNotMatch(scriptureLayout, /tools-search-toggle|tools-search-close|data-compact/, "the toolbar's phone search and its compact mode are gone");
  assert.ok(scriptureLayout.includes('".phone-bar a[rel]"'), "the bar's Previous and Next are prefetched as the title's are");
  assert.match(read("src/styles/scripture-tools.css"), /@media \(max-width: 699px\) \{\s*\.scripture-layout--scripture \.scripture-tools,\s*\.scripture-layout--intro \.scripture-tools \{\s*display: none;/);
  const scriptureHeader = read("src/components/ScriptureHeader.astro");
  assert.match(scriptureHeader, /@media screen and \(max-width: 699px\) \{[^@]*\.chapter-nav \{\s*display: none;/, "screen only: paper keeps its title");
});

test("paper has neither bar nor the menu sheet", () => {
  assert.match(read("src/styles/print.css"), /\.menu-sheet,\s*\.phone-bar,/);
});

// ── Driving phone-bars.js ──────────────────────────────────────────────

const MAIN_TOP = 120; // where the page's main content starts: the banner and the row above it

/** A reading page's two bars, as SiteHeader.astro, ScriptureLayout.astro,
 *  and PhoneBar.astro draw them, with the page's search field in the
 *  toolbar where it waits. */
function draw() {
  document.body.innerHTML = `
    <header class="site-header site-header--reading">
      <div class="site-header__inner">
        <a class="site-header__brand" href="/"><span class="sr-only site-header__home">Home</span></a>
        <a class="kit-btn kit-btn--plain site-header__picker" href="/read" data-rm-also>John 3</a>
        <div class="site-header__find" id="phoneFind" data-phone-find hidden>
          <button type="button" class="kit-icon site-header__find-close" aria-label="Close search" data-phone-find-close>Close</button>
        </div>
        <div class="site-header__actions"><button type="button" class="kit-icon" data-font-toggle aria-expanded="false">Aa</button></div>
      </div>
    </header>
    <main id="main-content">
      <div class="scripture-tools"><span id="before">before</span><div class="searchbar" data-searchbar data-open="false"><input type="search" id="site-search-input"><button type="button" class="searchbar__close">Close results</button></div><span id="after">after</span></div>
      <p>For God so loved the world.</p>
    </main>
    <nav class="phone-bar" aria-label="Chapters, search, and menu" data-phone-bar>
      <a class="kit-btn kit-btn--plain phone-bar__item" href="/john-2" rel="prev">Previous</a>
      <a class="kit-btn kit-btn--plain phone-bar__item" href="/search" data-bar-search>Search</a>
      <a class="kit-btn kit-btn--plain phone-bar__item" href="#footer-nav" data-menu-toggle>Menu</a>
      <a class="kit-btn kit-btn--plain phone-bar__item" href="/john-4" rel="next">Next</a>
    </nav>`;
  const root = document.documentElement;
  Object.defineProperty(root, "scrollHeight", { value: 20000, configurable: true });
  const page = {
    row: document.querySelector(".site-header--reading"),
    find: document.getElementById("phoneFind"),
    findClose: document.querySelector("[data-phone-find-close]"),
    aa: document.querySelector("[data-font-toggle]"),
    tools: document.querySelector(".scripture-tools"),
    searchbar: document.querySelector("[data-searchbar]"),
    input: document.getElementById("site-search-input"),
    resultsClose: document.querySelector(".searchbar__close"),
    search: document.querySelector("[data-bar-search]"),
    next: document.querySelector('.phone-bar a[rel="next"]'),
    bars: () => root.getAttribute("data-bars") ?? "",
  };
  return page;
}

/** A window whose scroll position and width the test sets, its frames run
 *  when the test says. Its events are happy-dom's window's. */
function phoneWindow({ phone = true } = {}) {
  const frames = [];
  const media = {
    matches: phone,
    listeners: [],
    addEventListener(type, fn) {
      this.listeners.push(fn);
    },
  };
  let y = 0;
  const win = {
    get scrollY() {
      return y;
    },
    innerHeight: 800,
    matchMedia: (query) => {
      assert.equal(query, PHONE_QUERY);
      return media;
    },
    addEventListener: (...args) => window.addEventListener(...args),
    requestAnimationFrame: (fn) => frames.push(fn),
    media,
    /** Scrolls to `to` and lets the frame the scroll asked for run. */
    scrollTo(to) {
      y = to;
      window.dispatchEvent(new Event("scroll"));
      while (frames.length) frames.shift()();
    },
    /** The reader's first touch of the page. */
    touch() {
      window.dispatchEvent(new Event("wheel"));
    },
  };
  return win;
}

/** Draws the page, starts the script on it, and stops it after `fn`. */
async function withBars({ phone = true } = {}, fn) {
  const page = draw();
  const win = phoneWindow({ phone });
  // happy-dom has no layout: the main content starts at MAIN_TOP in the page.
  document.getElementById("main-content").getBoundingClientRect = () => ({ top: MAIN_TOP - win.scrollY });
  const stop = start({ doc: document, win });
  try {
    await fn({ ...page, win });
  } finally {
    stop();
  }
  assert.equal(document.documentElement.hasAttribute("data-bars"), false, "stopping takes the attribute away");
}

const key = (el, name) => el.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }));

test("nothing hides before the reader first scrolls, touches, clicks, or types, so a link to a verse arrives with both bars", () =>
  withBars({}, ({ win, bars }) => {
    assert.equal(bars(), "");
    win.scrollTo(2400);
    assert.equal(bars(), "afloat", "a jump down the page by a link: shown, over the text");
    win.touch();
    win.scrollTo(2500);
    assert.equal(bars(), "away afloat", "the reader's own scroll down hides them");
  }));

test("both go on a scroll down past the row's place and come back on any scroll up; in their place they always show (PH-05)", () =>
  withBars({}, ({ win, bars }) => {
    win.touch();
    win.scrollTo(60);
    assert.equal(bars(), "", "still in their own place");
    win.scrollTo(400);
    assert.equal(bars(), "away afloat");
    win.scrollTo(395);
    assert.equal(bars(), "away afloat", "a nudge back up is nothing");
    win.scrollTo(380);
    assert.equal(bars(), "afloat", "a scroll up is");
    win.scrollTo(900);
    assert.equal(bars(), "away afloat");
    win.scrollTo(40);
    assert.equal(bars(), "");
  }));

test("Search opens the page's own field in place of the top row, held there until it closes (PH-09)", () =>
  withBars({}, ({ win, bars, row, find, tools, searchbar, input, search }) => {
    assert.equal(search.getAttribute("role"), "button", "a script makes the link a button");
    assert.equal(search.getAttribute("aria-controls"), "phoneFind");
    assert.equal(search.getAttribute("aria-expanded"), "false");

    search.click();
    assert.equal(row.hasAttribute("data-search-open"), true);
    assert.equal(find.hidden, false);
    assert.equal(find.contains(searchbar), true, "the field moved into the row");
    assert.equal(tools.contains(searchbar), false, "so the page still has only one");
    assert.equal(search.getAttribute("aria-expanded"), "true");
    assert.equal(document.activeElement === input, true, "focus is in the field");

    win.touch();
    win.scrollTo(1200);
    assert.equal(bars(), "afloat", "searching holds both bars");

    searchbar.dataset.open = "true";
    key(input, "Escape");
    assert.equal(row.hasAttribute("data-search-open"), true, "Escape closes the results first (searchbar.js's)");
    searchbar.dataset.open = "false";
    key(input, "Escape");
    assert.equal(row.hasAttribute("data-search-open"), false, "then the field");
    assert.equal(find.hidden, true);
    assert.equal(tools.contains(searchbar), true, "back in the toolbar");
    assert.equal(searchbar.previousElementSibling?.id, "before", "in its own place");
    assert.equal(searchbar.nextElementSibling?.id, "after");
    assert.equal(search.getAttribute("aria-expanded"), "false");
    assert.equal(document.activeElement === search, true, "focus is back on Search");
  }));

test("the row's close puts the field back and closes its results the way their own close does", () =>
  withBars({}, ({ row, findClose, resultsClose, search }) => {
    let closed = 0;
    resultsClose.addEventListener("click", () => closed++);
    search.click();
    findClose.click();
    assert.equal(row.hasAttribute("data-search-open"), false);
    assert.equal(closed, 1);
    assert.equal(document.activeElement === search, true);
    search.click();
    search.click();
    assert.equal(row.hasAttribute("data-search-open"), false, "Search again closes it too");
  }));

test("an open picker, Display tray, or menu, or a keyboard's focus in either bar, holds them", () =>
  withBars({}, ({ win, bars, aa, next }) => {
    win.touch();
    win.scrollTo(600);
    assert.equal(bars(), "away afloat");
    aa.setAttribute("aria-expanded", "true");
    win.scrollTo(400);
    win.scrollTo(900);
    assert.equal(bars(), "afloat", "the tray is open");
    aa.setAttribute("aria-expanded", "false");
    win.scrollTo(1200);
    assert.equal(bars(), "away afloat");
    win.scrollTo(1100);
    next.focus();
    win.scrollTo(1500);
    assert.equal(bars(), "afloat", "a keyboard in the bar keeps it");
    next.blur();
    win.scrollTo(1900);
    assert.equal(bars(), "away afloat");
  }));

test("wider than a phone nothing hides, and leaving a phone's width closes the search field", () => {
  return withBars({ phone: false }, ({ win, bars, row, search }) => {
    win.touch();
    win.scrollTo(900);
    assert.equal(bars(), "");
    win.media.matches = true;
    search.click();
    assert.equal(row.hasAttribute("data-search-open"), true);
    win.media.matches = false;
    for (const fn of win.media.listeners) fn();
    assert.equal(row.hasAttribute("data-search-open"), false);
    assert.equal(bars(), "");
  });
});

test("a page without the bars is left alone", () => {
  document.body.innerHTML = "<header class=\"site-header\"></header><main id=\"main-content\"></main>";
  const stop = start({ doc: document, win: phoneWindow() });
  assert.equal(document.documentElement.hasAttribute("data-bars"), false);
  stop();
});
