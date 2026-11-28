// test/header-menus.test.js
//
// The header (SITE-FEATHERBOA.md, "Four places: the header"; Featherboa's
// Phase 3): "LIT Bible," then Read, Study, Learn, and About from
// src/lib/places.mjs, Read a link and the other three <details> menus, and
// the news marks on them (src/lib/news.mjs); and the menu sheet the "Menu"
// buttons open (MenuSheet.astro; "The phone," "The menu"). The first tests
// hold SiteHeader.astro, MenuSheet.astro, Layout.astro, and the stylesheets
// to the record, since happy-dom has no layout and Astro doesn't run here;
// the rest drive src/scripts/header-menus.js over the header's and the
// sheet's own markup, written out below from the same places, with a list
// of news, a day, and storage of their own.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { settle } from "./helpers/browser-env.mjs";
import { PLACES, STUDY_HREF } from "../src/lib/places.mjs";
import { SEEN_KEY, WHATS_NEW_HREF } from "../src/lib/news.mjs";

const { start } = await import("../src/scripts/header-menus.js");

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const header = read("src/components/SiteHeader.astro");
const sheetMarkup = read("src/components/MenuSheet.astro");
const script = read("src/scripts/header-menus.js");
const layout = read("src/layouts/Layout.astro");
const headerCss = read("src/styles/header.css");
const footerCss = read("src/styles/footer.css");
const globalCss = read("src/styles/global.css");

// ── The markup and the stylesheets ─────────────────────────────────────

test("the places are places.mjs's, in its order: Read a link, the others menus with ▾", () => {
  assert.deepEqual(PLACES.map((p) => p.label), ["Read", "Study", "Learn", "About"]);
  assert.ok(header.includes("{PLACES.map((place) =>"), "the header draws every place from the one list");
  assert.ok(header.includes('<a class="kit-tab site-nav__place" href={place.href} aria-current={placeCurrent(place)} data-picker-open={place.key === "read" ? "books" : undefined}>{place.label}</a>'), "a place with no menu is a link (HD-02), and Read opens the passage picker (FP-15)");
  assert.ok(header.includes('<details class="site-nav__group" name="site-nav" data-nav-group={place.key}>'), "a menu opens without JavaScript, one at a time where the browser can");
  assert.ok(header.includes('<summary class="kit-tab site-nav__place" aria-current={placeCurrent(place)}>'));
  assert.ok(header.includes('{place.label}<Icon name="down" />'), "the menu's ▾ is the icon set's, never a typed glyph");
  assert.ok(header.includes('<a class="kit-row" href={hrefOf(row)} aria-current={currentOf(row)}>'), "its rows are the kit's");
  assert.doesNotMatch(header, /site-nav__plain|site-nav__group-btn|site-header__cta/, "today's five links and header C's buttons are gone");
});

test("“LIT Bible” always, named in full for a screen reader, and the title's swap is gone (HD-10)", () => {
  assert.ok(header.includes('<span class="site-header__title">LIT Bible<span class="sr-only">, the Liberation and Inclusion Translation, home</span></span>'));
  assert.doesNotMatch(header, /title-truncatable|title-alt|title-prefix|lit:header-tools|is:inline>\s*\(\(\) =>/);
  assert.equal(existsSync(new URL("../test/header-title.test.js", import.meta.url)), false, "its test went with it");
  // Every tab still carries the full name (HD-11): Layout's default, which each page's own title builds on.
  assert.match(layout, /title = "Liberation and Inclusion Translation",/);
});

test("Study shows on a computer with the Study preview on, from 1100px, in the header and the footer", () => {
  assert.match(headerCss, /\.site-nav__item--study \{\s*display: none;\s*\}/);
  assert.match(headerCss, /@media \(min-width: 1100px\) \{\s*html\[data-desk\] \.site-nav__item--study \{\s*display: block;/);
  assert.match(footerCss, /\.footer-group--study \{\s*display: none;\s*\}/);
  assert.match(footerCss, /@media \(min-width: 1100px\) \{\s*html\[data-desk\] \.footer-group--study \{\s*display: block;/);
  assert.match(headerCss, /\.menu-sheet__group--study \{\s*display: none;\s*\}/);
  assert.match(headerCss, /@media \(min-width: 1100px\) \{\s*html\[data-desk\] \.menu-sheet__group--study \{\s*display: block;/, "and the menu sheet's group where the header has it");
  assert.ok(script.includes('const STUDY_QUERY = "(min-width: 1100px)";'), "its news counts only there too");
});

test("the full header holds from 700px, 900px in OpenDyslexic; narrower, the row's “Menu” opens the menu sheet", () => {
  assert.match(headerCss, /\.site-nav \{\s*display: none;/);
  assert.match(headerCss, /@media \(min-width: 700px\) \{[^@]*html:not\(\[data-font="dyslexic"\]\) \.site-nav \{\s*display: flex;[^@]*html:not\(\[data-font="dyslexic"\]\) \.site-header__menu-toggle \{\s*display: none;/);
  assert.match(headerCss, /@media \(min-width: 900px\) \{[^@]*html\[data-font="dyslexic"\] \.site-nav \{\s*display: flex;[^@]*html\[data-font="dyslexic"\] \.site-header__menu-toggle \{\s*display: none;/);
  assert.match(header, /<button\s+class="kit-btn kit-btn--plain site-header__menu-toggle"\s+type="button"\s+aria-controls="menuSheet"\s+aria-expanded="false"\s+aria-haspopup="dialog"\s+data-menu-toggle\s*>\s*<Icon name="menu" \/>Menu/, "the kit's plain button: its icon and its word");
  assert.ok(header.includes("<MenuSheet search={search} deskHref={deskHref} account={!deskTitle} />"), "the header draws the sheet, after itself");
  assert.doesNotMatch(header + globalCss + headerCss, /menu-overlay|mobileMenu|menu-open/, "the menu overlay is gone");
});

test("the menu sheet: a modal <dialog> titled “Menu,” the places as groups with their rows, then Search, Account, and “Get the app” (PH-11 to PH-15, HD-35)", () => {
  assert.ok(sheetMarkup.includes('<dialog class="menu-sheet" id="menuSheet" aria-labelledby="menuSheetTitle" data-menu-sheet>'));
  assert.ok(sheetMarkup.includes('<h2 class="menu-sheet__title" id="menuSheetTitle">Menu</h2>'));
  assert.ok(sheetMarkup.includes('<button type="button" class="kit-icon menu-sheet__close" aria-label="Close menu" data-menu-close>'), "its × is the kit's icon button, named");
  assert.ok(sheetMarkup.includes("{PLACES.map((place) => ("), "every place from the one list, Read included");
  assert.ok(sheetMarkup.includes('aria-current={where.place === place.key ? "true" : undefined}'), "the place the page is in is marked");
  assert.ok(sheetMarkup.includes('<a class="kit-row" href={hrefOf(row)} aria-current={currentOf(row)}>'), "its rows are the kit's, the page's own on");
  assert.ok(sheetMarkup.includes('<li class="menu-sheet__search"><a class="kit-row" href="/search" data-search-toggle>Search</a></li>'));
  assert.ok(sheetMarkup.includes('<li><a class="kit-row" href="/apps">Get the app</a></li>'), "NX-11");
  assert.ok(script.includes("sheet.showModal()"), "opened modally: the page behind, the line under the header included, goes inert");
  assert.match(headerCss, /\.menu-sheet__panel \{[^}]*background: var\(--color-float\);[^}]*box-shadow: var\(--shadow-float\);/, "a float");
  assert.match(headerCss, /\.menu-sheet \{[^}]*max-width: var\(--col-text\);/, "no wider than the text column");
});

test("Study's Scripture row goes where the place line's Study link goes", () => {
  assert.equal(PLACES.find((p) => p.key === "study").rows[0].href, STUDY_HREF);
  assert.ok(header.includes('const hrefOf = (row: Row) => (row.key === "scripture" ? deskHref : row.href);'));
  assert.match(header, /deskHref = STUDY_HREF \} = Astro\.props;/);
  assert.ok(layout.includes("deskHref={deskHref}"), "Layout hands it on");
  const scripture = read("src/layouts/ScriptureLayout.astro");
  assert.match(scripture, /deskHref=\{isScriptureLike \? deskPlaceHref : undefined\}/, "a chapter or an introduction passes its “Study John 3” address");
  assert.match(scripture, /studyHref: deskPlaceHref/, "the same address the place line's Study link takes");
});

test("the magnifier: a strip, the page's own box, or none on the Read page and in Study's header (HD-13)", () => {
  assert.ok(layout.includes('const search = deskTitle || where.readPage ? "none" : pageSearch ? "page" : "strip";'));
  assert.ok(header.includes('{search === "strip" && (\n        <a href="/search" class="kit-icon site-header__search" data-search-toggle aria-label="Search">'));
  assert.ok(header.includes('{search === "page" && (\n        <a href="/search" class="kit-icon site-header__search" data-search-here aria-label="Search">'));
  assert.equal(header.split('id="headerSearch"').length - 1, 1, "one strip, drawn only in strip mode");
  assert.match(header, /\{search === "strip" && \(\s*<div class="site-header__search-strip" id="headerSearch" hidden>/);
});

test("without JavaScript the menus are links in <details>, and below the full header Read and Menu stand in", () => {
  assert.ok(header.includes('<a class="kit-btn kit-btn--plain" href="/read">Read</a>'));
  assert.ok(header.includes('<a class="kit-btn kit-btn--plain" href="#footer-nav">Menu</a>'), "Menu goes to the footer's links");
  assert.ok(read("src/components/SiteFooter.astro").includes('id="footer-nav"'));
});

test("the line under the header is on every page but Home and Study's own, a chapter's the place line, and never on paper", () => {
  assert.ok(layout.includes('import PlaceLine from "../components/PlaceLine.astro";'));
  assert.match(layout, /\{readingLine && !deskTitle \? \(\s*<PlaceLine where=\{where\} reading=\{readingLine\} \/>\s*\) : where\.line && !deskTitle && \(/);
  assert.match(read("src/styles/print.css"), /\.site-header,\s*\.place-line,/);
  // The menu sheet is a modal dialog, so the rest of the page, the line
  // included, is inert while it is open (the sheet's test, above).
});

test("the header's and the footer's stylesheets load on every page, after the kit", () => {
  const at = (name) => layout.indexOf(`import "../styles/${name}";`);
  assert.ok(at("kit.css") > 0);
  assert.ok(at("header.css") > at("kit.css"));
  assert.ok(at("footer.css") > at("header.css"));
});

// ── Driving header-menus.js ────────────────────────────────────────────

/** The header's places as SiteHeader.astro draws them, with the news marks
 *  drawn hidden for the entries in `news`, and somewhere else to press. */
function draw(news = []) {
  const newsPlaces = new Set(news.map((e) => e.place));
  const newsRows = new Set(news.map((e) => `${e.place}:${e.row}`));
  const rowHtml = (place, row) =>
    `${row.separate ? '<li class="site-nav__menu-sep" role="separator"></li>' : ""}<li><a class="kit-row" href="${row.href}">${row.label}${
      newsRows.has(`${place.key}:${row.key}`) ? `<span class="site-nav__new" data-news-row="${place.key}:${row.key}" hidden><span class="sr-only">, </span>New</span>` : ""
    }</a></li>`;
  const more = (place) =>
    newsPlaces.has(place.key)
      ? `<li class="site-nav__menu-sep" role="separator" data-news-more="${place.key}" hidden></li><li data-news-more="${place.key}" hidden><a class="kit-row" href="${WHATS_NEW_HREF}">See what’s new →</a></li>`
      : "";
  const items = PLACES.map((place) =>
    !place.menu
      ? `<li><a class="kit-tab site-nav__place" href="${place.href}">${place.label}</a></li>`
      : `<li><details class="site-nav__group" name="site-nav" data-nav-group="${place.key}"><summary class="kit-tab site-nav__place">${place.label}${
          newsPlaces.has(place.key) ? `<span class="site-nav__dot" data-news-dot="${place.key}" hidden><span class="sr-only">, new</span></span>` : ""
        }</summary><ul class="site-nav__menu">${place.rows.map((row) => rowHtml(place, row)).join("")}${more(place)}</ul></details></li>`,
  ).join("");
  document.body.innerHTML = `<header class="site-header"><nav class="site-nav" aria-label="Primary"><ul class="site-nav__list">${items}</ul></nav></header><main><button id="elsewhere" type="button">Elsewhere</button></main>`;
  const group = (key) => {
    const el = document.querySelector(`details[data-nav-group="${key}"]`);
    return {
      el,
      summary: el.querySelector("summary"),
      menu: el.querySelector(".site-nav__menu"),
      rows: () => [...el.querySelectorAll(".site-nav__menu a")].filter((a) => a.closest("[hidden]") == null),
      dot: el.querySelector("[data-news-dot]"),
      more: [...el.querySelectorAll("[data-news-more]")],
    };
  };
  return { study: group("study"), learn: group("learn"), about: group("about"), elsewhere: document.getElementById("elsewhere") };
}

/** A browser's storage, with a log of what was asked of it. */
function memory(initial = {}) {
  const data = new Map(Object.entries(initial));
  const log = [];
  return {
    log,
    getItem(k) {
      log.push(`get ${k}`);
      return data.has(k) ? data.get(k) : null;
    },
    setItem(k, v) {
      log.push(`set ${k}`);
      data.set(k, String(v));
    },
    removeItem(k) {
      log.push(`remove ${k}`);
      data.delete(k);
    },
  };
}

const key = (el, name) => el.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }));
const TODAY = "2027-01-15";

/** Draws the header, starts the script on it, and stops it after `fn`. */
async function withHeader({ news = [], storage = memory(), today = TODAY } = {}, fn) {
  const parts = draw(news);
  const stop = start({ doc: document, news, today, storage });
  try {
    await fn({ ...parts, storage });
  } finally {
    stop();
  }
}

test("the drawing above is SiteHeader.astro's", () => {
  for (const part of [
    '<details class="site-nav__group" name="site-nav" data-nav-group={place.key}>',
    '<ul class="site-nav__menu">',
    '<li class="site-nav__menu-sep" role="separator"></li>',
    '<span class="site-nav__dot" data-news-dot={place.key} hidden><span class="sr-only">, new</span></span>',
    '<span class="site-nav__new" data-news-row={`${place.key}:${row.key}`} hidden><span class="sr-only">, </span>New</span>',
    '<li class="site-nav__menu-sep" role="separator" data-news-more={place.key} hidden></li>',
    '<li data-news-more={place.key} hidden>',
    '<a class="kit-row" href={WHATS_NEW_HREF}>See what’s new →</a>',
  ]) {
    assert.ok(header.includes(part), part);
  }
});

test("one menu open at a time, and a press elsewhere closes it", () =>
  withHeader({}, ({ learn, about, elsewhere }) => {
    learn.el.open = true;
    about.el.open = true;
    assert.equal(about.el.open, true);
    assert.equal(learn.el.open, false, "opening About closed Learn");
    elsewhere.click();
    assert.equal(about.el.open, false);
  }));

test("the keys: Arrow Down or Up on a place opens its menu at its first or last row, the arrows, Home, and End move, and Escape returns to the place", () =>
  withHeader({}, ({ learn, about }) => {
    const rows = learn.rows();
    assert.deepEqual(rows.map((a) => a.textContent), ["Glossary", "Articles", "Podcast"]);

    key(learn.summary, "ArrowDown");
    assert.equal(learn.el.open, true);
    assert.equal(document.activeElement === rows[0], true, "the first row");
    key(rows[0], "ArrowDown");
    assert.equal(document.activeElement === rows[1], true);
    key(rows[1], "End");
    assert.equal(document.activeElement === rows[2], true);
    key(rows[2], "ArrowDown");
    assert.equal(document.activeElement === rows[0], true, "it goes round");
    key(rows[0], "ArrowUp");
    assert.equal(document.activeElement === rows[2], true, "both ways");
    key(rows[2], "Home");
    assert.equal(document.activeElement === rows[0], true);

    key(rows[0], "Escape");
    assert.equal(learn.el.open, false);
    assert.equal(document.activeElement === learn.summary, true, "focus is back on Learn");

    key(about.summary, "ArrowUp");
    assert.equal(about.el.open, true);
    const aboutRows = about.rows();
    assert.equal(aboutRows.at(-1).textContent, "Contact");
    assert.equal(document.activeElement === aboutRows.at(-1), true, "Arrow Up opens at the last row");
    assert.equal(learn.el.open, false);
    key(about.summary, "Escape");
    assert.equal(about.el.open, false, "Escape on the place closes its menu too");
  }));

test("Tab out of a menu closes it; moving within it doesn't", () =>
  withHeader({}, ({ about, elsewhere }) => {
    key(about.summary, "ArrowDown");
    const [first, second] = about.rows();
    first.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: second }));
    assert.equal(about.el.open, true);
    second.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: elsewhere }));
    assert.equal(about.el.open, false);
  }));

test("Study's last row, help, is set apart, and the arrows reach it", () =>
  withHeader({}, ({ study }) => {
    const rows = study.rows();
    assert.deepEqual(rows.map((a) => a.textContent), ["Scripture", "Notebook", "Sheets", "Collections", "Help for study tools"]);
    assert.equal(study.menu.querySelectorAll('[role="separator"]').length, 1);
    key(study.summary, "ArrowUp");
    assert.equal(document.activeElement === rows.at(-1), true);
  }));

test("with no news there are no marks, and storage is never read or written", () =>
  withHeader({}, ({ learn, storage }) => {
    assert.equal(document.querySelectorAll("[data-news-dot], [data-news-row], [data-news-more]").length, 0);
    learn.el.open = true;
    learn.el.open = false;
    assert.deepEqual(storage.log, []);
  }));

const NEWS = [
  { id: "glossary-shalom", place: "learn", row: "glossary" },
  { id: "podcast-season-4", place: "learn", row: "podcast" },
  { id: "apps-2-0", place: "about", row: "apps", until: "2027-01-31" },
];

test("news: a dot on each place it marks, “New” beside each row, and “See what’s new →” at the menu's foot (NX-26, HD-31)", () =>
  withHeader({ news: NEWS }, ({ learn, about, study }) => {
    assert.equal(learn.dot.hidden, false);
    assert.equal(about.dot.hidden, false);
    assert.equal(study.dot, null, "a place without news has no dot drawn at all");
    const shown = [...document.querySelectorAll("[data-news-row]")].filter((el) => !el.hidden).map((el) => el.dataset.newsRow);
    assert.deepEqual(shown, ["learn:glossary", "learn:podcast", "about:apps"]);
    for (const el of [...learn.more, ...about.more]) assert.equal(el.hidden, false);
    const last = about.rows().at(-1);
    assert.equal(last.textContent, "See what’s new →");
    assert.equal(last.getAttribute("href"), WHATS_NEW_HREF);
    assert.equal(learn.dot.textContent, ", new", "the dot is named with its place");
  }));

test("opening a menu sees its news: the dot goes at once, “New” stays until the menu closes, and the next page shows none", async () => {
  const storage = memory();
  await withHeader({ news: NEWS, storage }, ({ learn, about }) => {
    learn.el.open = true;
    assert.equal(learn.dot.hidden, true, "the dot goes as the menu opens");
    assert.deepEqual(JSON.parse(storage.getItem(SEEN_KEY)), ["glossary-shalom", "podcast-season-4"]);
    const glossaryNew = document.querySelector('[data-news-row="learn:glossary"]');
    assert.equal(glossaryNew.hidden, false, "“New” stays while the reader looks");
    assert.equal(learn.rows().at(-1).textContent, "See what’s new →");

    learn.el.open = false;
    assert.equal(glossaryNew.hidden, true, "and goes once the menu closes");
    for (const el of learn.more) assert.equal(el.hidden, true);
    assert.equal(about.dot.hidden, false, "About's news is still unseen");
  });

  await withHeader({ news: NEWS, storage }, ({ learn, about }) => {
    assert.equal(learn.dot.hidden, true, "the next page remembers");
    assert.equal(document.querySelector('[data-news-row="learn:podcast"]').hidden, true);
    assert.equal(about.dot.hidden, false);
    about.el.open = true;
    assert.deepEqual(JSON.parse(storage.getItem(SEEN_KEY)), ["glossary-shalom", "podcast-season-4", "apps-2-0"]);
  });
});

test("an entry past its last day shows nothing", () =>
  withHeader({ news: NEWS, today: "2027-02-01" }, ({ about, learn }) => {
    assert.equal(about.dot.hidden, true);
    assert.equal(document.querySelector('[data-news-row="about:apps"]').hidden, true);
    for (const el of about.more) assert.equal(el.hidden, true);
    assert.equal(learn.dot.hidden, false, "the others still show");
  }));

test("where storage is blocked the marks still show, and opening a menu clears them for the page", () => {
  const blocked = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };
  return withHeader({ news: NEWS, storage: blocked }, ({ learn }) => {
    assert.equal(learn.dot.hidden, false);
    learn.el.open = true;
    assert.equal(learn.dot.hidden, true);
    learn.el.open = false;
    assert.equal(document.querySelector('[data-news-row="learn:glossary"]').hidden, true);
  });
});

test("a note a browser kept from older news is read, and pared to what is still in the list", () =>
  withHeader({ news: NEWS, storage: memory({ [SEEN_KEY]: JSON.stringify(["gone-2026", "apps-2-0"]) }) }, ({ about, learn, storage }) => {
    assert.equal(about.dot.hidden, true, "About's news was seen on an earlier page");
    learn.el.open = true;
    assert.deepEqual(JSON.parse(storage.getItem(SEEN_KEY)), ["apps-2-0", "glossary-shalom", "podcast-season-4"]);
  }));

// ── The menu sheet ─────────────────────────────────────────────────────

/** The header as draw() has it with its "Menu" button, the menu sheet as
 *  MenuSheet.astro draws it, and the phone bar's Menu, a link until the
 *  script takes it over; each news mark drawn hidden. */
function drawSheet(news = []) {
  const parts = draw(news);
  const newsPlaces = new Set(news.map((e) => e.place));
  const newsRows = new Set(news.map((e) => `${e.place}:${e.row}`));
  const menuDot = '<span class="site-nav__dot" data-news-menu hidden><span class="sr-only">, new</span></span>';
  document
    .querySelector(".site-header")
    .insertAdjacentHTML(
      "beforeend",
      `<button class="kit-btn kit-btn--plain site-header__menu-toggle" type="button" aria-controls="menuSheet" aria-expanded="false" aria-haspopup="dialog" data-menu-toggle>Menu${newsPlaces.size ? menuDot : ""}</button>`,
    );
  const rowHtml = (place, row) =>
    `${row.separate ? '<li class="site-nav__menu-sep" role="separator"></li>' : ""}<li><a class="kit-row" href="${row.href}">${row.label}${
      newsRows.has(`${place.key}:${row.key}`) ? `<span class="site-nav__new" data-news-row="${place.key}:${row.key}" hidden><span class="sr-only">, </span>New</span>` : ""
    }</a></li>`;
  const more = (place) =>
    newsPlaces.has(place.key)
      ? `<li class="site-nav__menu-sep" role="separator" data-news-more="${place.key}" hidden></li><li data-news-more="${place.key}" hidden><a class="kit-row" href="${WHATS_NEW_HREF}">See what’s new →</a></li>`
      : "";
  const groups = PLACES.map(
    (place) =>
      `<div class="menu-sheet__group menu-sheet__group--${place.key}"><h3 class="menu-sheet__heading" id="menuSheet-${place.key}">${place.label}${
        newsPlaces.has(place.key) ? `<span class="site-nav__dot" data-news-dot="${place.key}" hidden><span class="sr-only">, new</span></span>` : ""
      }</h3><ul class="menu-sheet__rows" aria-labelledby="menuSheet-${place.key}">${place.rows.map((row) => rowHtml(place, row)).join("")}${more(place)}</ul></div>`,
  ).join("");
  const barNews = news.some((e) => e.place === "learn" || e.place === "about");
  document.body.insertAdjacentHTML(
    "beforeend",
    `<dialog class="menu-sheet" id="menuSheet" aria-labelledby="menuSheetTitle" data-menu-sheet><div class="menu-sheet__panel"><div class="menu-sheet__head"><h2 class="menu-sheet__title" id="menuSheetTitle">Menu</h2><button type="button" class="kit-icon menu-sheet__close" aria-label="Close menu" data-menu-close>Close</button></div><nav class="menu-sheet__nav" aria-labelledby="menuSheetTitle"><div class="menu-sheet__groups">${groups}</div><ul class="menu-sheet__foot"><li><a class="kit-row" href="/apps">Get the app</a></li></ul></nav></div></dialog>` +
      `<nav class="phone-bar" data-phone-bar><a class="kit-btn kit-btn--plain phone-bar__item" href="#footer-nav" data-menu-toggle>Menu${barNews ? menuDot : ""}</a></nav>`,
  );
  const sheet = document.getElementById("menuSheet");
  return {
    ...parts,
    sheet,
    close: sheet.querySelector("[data-menu-close]"),
    headerMenu: document.querySelector(".site-header [data-menu-toggle]"),
    barMenu: document.querySelector(".phone-bar [data-menu-toggle]"),
    glossaryRow: sheet.querySelector(".menu-sheet__group--learn a"),
    sheetDot: (place) => sheet.querySelector(`[data-news-dot="${place}"]`),
    sheetRow: (id) => sheet.querySelector(`[data-news-row="${id}"]`),
    headerDot: (place) => document.querySelector(`.site-nav [data-news-dot="${place}"]`),
    menuDots: () => [...document.querySelectorAll("[data-news-menu]")],
  };
}

/** Draws the header and the sheet, starts the script on them (the sheet
 *  showing Study's group only when `wide`), and stops it after `fn`. A link
 *  pressed here goes nowhere, since happy-dom would follow it. */
async function withSheet({ news = [], storage = memory(), wide = false, modal = true } = {}, fn) {
  const parts = drawSheet(news);
  if (!modal) Object.defineProperty(parts.sheet, "showModal", { value: undefined });
  const stop = start({ doc: document, news, today: TODAY, storage, wide: () => wide });
  const stay = (event) => {
    if (event.target.closest?.("a[href]")) event.preventDefault();
  };
  document.addEventListener("click", stay, true);
  try {
    await fn({ ...parts, storage });
  } finally {
    document.removeEventListener("click", stay, true);
    stop();
  }
}

test("the drawing above is MenuSheet.astro's", () => {
  for (const part of [
    '<div class={`menu-sheet__group menu-sheet__group--${place.key}`}>',
    '<ul class="menu-sheet__rows" aria-labelledby={`menuSheet-${place.key}`}>',
    '<span class="site-nav__dot" data-news-dot={place.key} hidden><span class="sr-only">, new</span></span>',
    '<span class="site-nav__new" data-news-row={`${place.key}:${row.key}`} hidden><span class="sr-only">, </span>New</span>',
    '<li class="site-nav__menu-sep" role="separator" data-news-more={place.key} hidden></li>',
    '<a class="kit-row" href={WHATS_NEW_HREF}>See what’s new →</a>',
  ]) {
    assert.ok(sheetMarkup.includes(part), part);
  }
  assert.ok(header.includes('<span class="site-nav__dot" data-news-menu hidden><span class="sr-only">, new</span></span>'), "the header's Menu carries the dot");
  assert.ok(read("src/components/PhoneBar.astro").includes('<span class="site-nav__dot" data-news-menu hidden><span class="sr-only">, new</span></span>'), "and the bar's");
});

test("either menu button opens the sheet as a modal dialog, both say so, and focus moves to its ×", () =>
  withSheet({}, ({ sheet, close, headerMenu, barMenu, learn }) => {
    assert.equal(barMenu.getAttribute("role"), "button", "the bar's link becomes a button");
    assert.equal(barMenu.getAttribute("aria-controls"), "menuSheet");
    assert.equal(barMenu.getAttribute("aria-haspopup"), "dialog");
    assert.equal(barMenu.getAttribute("aria-expanded"), "false");

    learn.el.open = true;
    headerMenu.click();
    assert.equal(sheet.open, true);
    assert.equal(learn.el.open, false, "a header menu that was open closes");
    assert.equal(headerMenu.getAttribute("aria-expanded"), "true");
    assert.equal(barMenu.getAttribute("aria-expanded"), "true");
    assert.equal(document.activeElement === close, true, "focus is on the ×");
    close.click();

    barMenu.click();
    assert.equal(sheet.open, true, "the bar's opens the same sheet");
    assert.equal(location.hash, "", "and doesn't go to the footer");
    close.click();
  }));

test("it closes on its ×, on Escape, on a press on the dimmed page, and a frame after one of its links; focus goes back to the button that opened it", () =>
  withSheet({}, async ({ sheet, close, headerMenu, barMenu, glossaryRow }) => {
    barMenu.click();
    close.click();
    assert.equal(sheet.open, false, "its ×");
    assert.equal(headerMenu.getAttribute("aria-expanded"), "false");
    assert.equal(barMenu.getAttribute("aria-expanded"), "false");
    assert.equal(document.activeElement === barMenu, true, "focus is back on the bar's Menu");

    headerMenu.click();
    key(close, "Escape");
    assert.equal(sheet.open, false, "Escape");
    assert.equal(document.activeElement === headerMenu, true, "and on the header's");

    headerMenu.click();
    sheet.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    assert.equal(sheet.open, false, "a press outside the panel lands on the dialog itself");

    headerMenu.click();
    glossaryRow.click();
    assert.equal(sheet.open, true, "a link: not at once, so the press draws");
    await settle();
    assert.equal(sheet.open, false, "a frame later");

    headerMenu.click();
    glossaryRow.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true }));
    await settle();
    assert.equal(sheet.open, true, "a click that opens a tab leaves it open");
    close.click();
  }));

test("Tab stays inside the sheet, and a page brought back whole finds it closed", () =>
  withSheet({}, ({ sheet, close, headerMenu }) => {
    headerMenu.click();
    const stops = [...sheet.querySelectorAll("a[href], button:not([disabled])")];
    const last = stops.at(-1);
    last.focus();
    key(last, "Tab");
    assert.equal(document.activeElement === close, true, "from the last stop to the first");
    close.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
    assert.equal(document.activeElement === last, true, "and back");

    const shown = new Event("pageshow");
    Object.defineProperty(shown, "persisted", { value: true });
    window.dispatchEvent(shown);
    assert.equal(sheet.open, false);
    assert.equal(headerMenu.getAttribute("aria-expanded"), "false");
  }));

test("where a browser has no modal dialog, the bar's Menu stays a link to the footer's links", () =>
  withSheet({ modal: false }, ({ barMenu, headerMenu, sheet }) => {
    assert.equal(barMenu.hasAttribute("role"), false);
    headerMenu.click();
    assert.equal(sheet.open, false);
  }));

test("the sheet's news: a dot on the menu buttons until it opens, its marks while it is open, none after", async () => {
  const storage = memory();
  await withSheet({ news: NEWS, storage }, ({ sheet, close, headerMenu, sheetDot, sheetRow, headerDot, menuDots }) => {
    assert.equal(menuDots().length, 2);
    for (const dot of menuDots()) assert.equal(dot.hidden, false, "the header's Menu and the bar's carry a dot");
    assert.equal(sheetDot("learn").hidden, false);
    assert.equal(sheetRow("learn:glossary").hidden, false);
    assert.deepEqual(storage.log, [`get ${SEEN_KEY}`], "read once, as the page loads");

    headerMenu.click();
    assert.deepEqual(JSON.parse(storage.getItem(SEEN_KEY)), ["glossary-shalom", "podcast-season-4", "apps-2-0"], "opening it sees what it holds");
    for (const dot of menuDots()) assert.equal(dot.hidden, true, "the buttons' dots go at once");
    assert.equal(headerDot("learn").hidden, true, "as do the header's own");
    assert.equal(sheetDot("learn").hidden, false, "the sheet's stay while the reader looks");
    assert.equal(sheetRow("about:apps").hidden, false);
    for (const el of sheet.querySelectorAll("[data-news-more]")) assert.equal(el.hidden, false);

    close.click();
    assert.equal(sheetDot("learn").hidden, true, "and go when it closes");
    assert.equal(sheetRow("learn:glossary").hidden, true);
    for (const el of sheet.querySelectorAll("[data-news-more]")) assert.equal(el.hidden, true);
  });

  await withSheet({ news: NEWS, storage }, ({ menuDots }) => {
    for (const dot of menuDots()) assert.equal(dot.hidden, true, "the next page remembers");
  });
});

test("Study's news counts on the menu buttons only where the sheet shows Study", async () => {
  const news = [{ id: "sheets-present", place: "study", row: "sheets" }];
  await withSheet({ news }, ({ menuDots }) => {
    assert.equal(menuDots().length, 1, "the bar draws no dot for Study, never in its sheet");
    assert.equal(menuDots()[0].hidden, true, "a phone or a narrow window: no Study in the sheet");
  });
  await withSheet({ news, wide: true }, ({ menuDots, headerMenu, sheetDot }) => {
    assert.equal(menuDots()[0].hidden, false, "a computer with the preview, from 1100px");
    headerMenu.click();
    assert.equal(menuDots()[0].hidden, true);
    assert.equal(sheetDot("study").hidden, false);
  });
});
