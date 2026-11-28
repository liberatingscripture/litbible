// test/featherboa-continuous.test.js
//
// A chapter's page reads on through its book (SITE-FEATHERBOA.md, "A whole
// book"; SITE-FEATHERBOA-BUILD.md, Phase 4's checks): the address follows the
// chapter being read without adding to the history, the arrows load the
// chapter they name and land on it, a run of drafts is one entry, and a
// print is the one chapter in view (WB-01 to WB-12, WB-23, WB-29 to WB-34,
// WB-37). src/scripts/read-on.js runs here on a small copy of the page.
//
// happy-dom has no layout, so the test lays the reading column out itself:
// every verse is a 40px line, a heading 60px, Go deeper and the footnotes
// 100px each, a hidden element nothing, in a window 768px tall (the reading
// line 76.8px down). Never assert.equal two elements (happy-dom runs out of
// memory printing a failure): compare ids, numbers, and booleans.

import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { window, settle, resetDom } from "./helpers/browser-env.mjs";
import { BOOKS, bookKeyToLabel } from "../src/data/books.js";
import { VERSE_COUNTS } from "../src/data/verse-counts.js";
import { bookProgress, bookUnits, draftGreekLink, unitBeside } from "../src/lib/read-on.mjs";

const { startReadingOn, READ_ON_EVENT } = await import("../src/scripts/read-on.js");

/* ── The page's layout ───────────────────────────────────────────────── */

const VERSE = 40;
const HEADING = 60;
const SECTION = 100;
/** A verse this far down the window has reached the reading line (10% of 768px). */
const AT_LINE = 76;

/** A phone's page, whose own title is drawn only once a chapter is above it (ScriptureHeader.astro). */
let phoneTitle = false;

function ownHeight(el) {
  if (el.hidden || el.matches("script, template, style")) return 0;
  if (el.matches("[data-verse]")) return VERSE;
  if (phoneTitle && el.id === "chapter-title" && !document.documentElement.hasAttribute("data-read-on-above")) return 0;
  if (el.matches(".app-banner-stand-in")) return 100; // Android's app banner, above the text until it scrolls away
  if (el.matches("h1, h2")) return HEADING;
  if (el.matches(".read-on__stub, .read-on__retry")) return VERSE;
  if (el.matches(".go-deeper, .footnotes-wrap")) return SECTION;
  return null; // as tall as what it holds
}

/** Every element of the reading column and where it lies on the page: { top, height }. */
function layout() {
  const boxes = new Map();
  let y = 0;
  const walk = (el) => {
    const top = y;
    const own = ownHeight(el);
    if (own != null) {
      y += own;
      boxes.set(el, { top, height: own });
      for (const inner of el.querySelectorAll("*")) boxes.set(inner, { top, height: own });
      return;
    }
    for (const child of el.children) walk(child);
    boxes.set(el, { top, height: y - top });
  };
  const main = document.querySelector(".scripture-main");
  if (main) walk(main);
  return boxes;
}

const proto = window.Element.prototype;
proto.getBoundingClientRect = function getBoundingClientRect() {
  const box = layout().get(this);
  const top = (box?.top ?? 0) - window.scrollY;
  const height = box?.height ?? 0;
  const width = box ? 640 : 0;
  return { x: 0, y: top, left: 0, top, right: width, bottom: top + height, width, height };
};
proto.getClientRects = function getClientRects() {
  const box = layout().get(this);
  return box && box.height > 0 ? [this.getBoundingClientRect()] : [];
};
proto.scrollIntoView = function scrollIntoView() {
  window.scrollTo(0, layout().get(this)?.top ?? 0);
};

/** Scroll the window, as a reader does, and let the page answer. */
async function scrollTo(y) {
  window.scrollTo(0, y);
  window.dispatchEvent(new window.Event("scroll"));
  await settle();
}

async function until(check, what) {
  for (let i = 0; i < 60; i++) {
    if (check()) return;
    await settle();
  }
  assert.fail(`timed out waiting for ${what}`);
}

/* ── The page and the chapters it fetches ────────────────────────────── */

const name = (book) => bookKeyToLabel(book);

function verses(book, n, count) {
  const spans = [];
  for (let v = 1; v <= count; v++) {
    const note = v === 2 ? `<sup class="fn-ref"><a href="#fn-a" id="fnref-a">a</a></sup>` : "";
    spans.push(`<span data-verse="${v}"><sup id="v${v}" class="vn">${v}</sup><span class="vn-gap">&nbsp;</span>Words of ${name(book)} ${n}:${v}.${note}</span>`);
  }
  // A block's own id is book-namespaced already (john-8-p9).
  return `<div class="p" id="${book}-${n}-p1">${spans.join(" ")}</div>`;
}

function chapterPage(book, n, count, drafts = []) {
  const last = BOOKS[book];
  const nav = {};
  for (let c = 1; c <= last; c++) {
    nav[c] = [
      c > 1 ? `/${book}-${c - 1}/` : "",
      c > 1 ? `${name(book)} ${c - 1}` : "",
      c < last ? `/${book}-${c + 1}/` : "",
      c < last ? `${name(book)} ${c + 1}` : "",
    ];
  }
  const [prev, , next] = nav[n];
  const data = JSON.stringify({ book, chapter: n, drafts, nav });
  return `
<nav class="place-line" aria-label="Place">
  <button type="button" class="place-line__pick" data-picker-open="chapters">Chapter ${n}</button>
  <span class="place-line__turn"><a href="${prev}" rel="prev" aria-label="Previous">‹</a><a href="${next}" rel="next" aria-label="Next">›</a></span>
</nav>
<span class="site-header__picker-label">${name(book)} ${n}</span>
<a data-study-place href="/desk/?place=${book}-${n}">Study ${name(book)} ${n}</a>
<div class="scripture-layout scripture-layout--scripture">
  <div class="scripture-main" aria-labelledby="chapter-title">
    <div data-pagefind-ignore><header class="scripture-header scripture-header--reads-on"><div class="chapter-head">
      <h1 id="chapter-title" class="chapter-title chapter-head__title">${name(book)} ${n}</h1>
      <span class="chapter-head__go"><a class="kit-btn kit-btn--plain" href="#go-deeper-title" data-go-deeper data-book="${book}" data-chapter="${n}">Go deeper</a></span>
    </div></header></div>
    <article class="chapter" data-last-read-book="${book}" data-last-read-chapter="${n}">
      <div class="chapter-paragraphs">${verses(book, n, count)}</div>
      <script type="application/json" id="read-on-data">${data}</script>
      <section class="go-deeper" aria-labelledby="go-deeper-title"><h2 id="go-deeper-title">Go deeper</h2></section>
      <section class="footnotes-wrap" aria-labelledby="footnotes-title"><h2 id="footnotes-title">Footnotes</h2>
        <ol class="footnotes"><li id="fn-a"><div class="fn-body"><a href="#fnref-a" class="footnote-backlink">a</a><span>A note on ${name(book)} ${n}:2.</span></div></li></ol>
      </section>
      <template data-read-on-end><nav class="chapter-ctas">The end of ${name(book)}</nav></template>
    </article>
    <div class="print-credit" hidden><p>The credit line.</p><p>litbible.net/${book}-${n}</p></div>
  </div>
</div>`;
}

const titleOf = (book, n) => `${name(book)} ${n} | Liberation and Inclusion Translation`;

// The chapters' pages, as fetch hands them over: every chapter `VERSES` verses long.
let VERSES = 50;
const fetched = [];
globalThis.fetch = async (url) => {
  const path = String(url);
  fetched.push(path);
  const m = /^\/([a-z0-9]+)-(\d+)\/$/.exec(path);
  if (!m) return { ok: false, status: 404, text: async () => "" };
  const page = `<!doctype html><html lang="en"><head><title>${titleOf(m[1], Number(m[2]))}</title></head><body>${chapterPage(m[1], Number(m[2]), VERSES)}</body></html>`;
  return { ok: true, status: 200, text: async () => page };
};

/* ── Opening a page, alone ───────────────────────────────────────────── */

const added = [];
const errors = [];
const consoleError = console.error;
console.error = (...args) => {
  errors.push(args.map(String).join(" "));
};

/** Open a chapter's page and start it reading on. `state` is history.state before it starts. */
function open(book, n, { count = VERSES, drafts = [], state = null } = {}) {
  resetDom(`http://localhost/${book}-${n}/`);
  history.replaceState(state, "", `/${book}-${n}/`);
  const html = document.documentElement;
  for (const a of ["data-read-on", "data-read-on-more", "data-read-on-above", "data-read-on-print", "data-desk-print"]) html.removeAttribute(a);
  html.style.removeProperty("--read-progress");
  document.title = titleOf(book, n);
  document.body.innerHTML = chapterPage(book, n, count, drafts);
  window.scrollTo(0, 0);
  fetched.length = 0;
  // Every listener the page adds goes when the test ends, so each test's page is alone.
  const undo = [window, document].map((target) => {
    const own = Object.hasOwn(target, "addEventListener");
    const add = target.addEventListener;
    target.addEventListener = function addEventListener(type, fn, opts) {
      added.push([target, type, fn, opts]);
      return add.call(this, type, fn, opts);
    };
    return () => {
      if (own) target.addEventListener = add;
      else delete target.addEventListener;
    };
  });
  try {
    return startReadingOn(document.querySelector("article.chapter"));
  } finally {
    for (const u of undo) u();
  }
}

afterEach(async () => {
  await settle();
  for (const [target, type, fn, opts] of added.splice(0)) target.removeEventListener(type, fn, opts);
  const said = errors.splice(0);
  assert.deepEqual(said, [], "nothing logged an error");
});

process.on("exit", () => {
  console.error = consoleError;
});

const loaded = (n) => document.querySelector(`.read-on__chapter[data-chapter="${n}"]`);
const pageChapter = () => document.querySelector("article.chapter");
const turn = (rel) => document.querySelector(`.place-line a[rel="${rel}"]`);

function click(el) {
  const e = new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
  el.dispatchEvent(e);
  return e;
}

/** Scroll so a chapter's verse sits on the reading line. */
async function readAt(n, verse) {
  const box = loaded(n) ?? (Number(pageChapter().dataset.lastReadChapter) === n ? pageChapter() : null);
  assert.ok(box, `chapter ${n} is on the page`);
  await scrollTo(layout().get(box.querySelector(`[data-verse="${verse}"]`)).top - AT_LINE);
}

/** Count a method's calls, still calling it; returns [calls, restore]. */
function spy(target, key) {
  const calls = [];
  const own = Object.hasOwn(target, key);
  const real = target[key];
  target[key] = function counted(...args) {
    calls.push(args);
    return real.apply(this, args);
  };
  return [calls, () => (own ? (target[key] = real) : delete target[key])];
}

/* ── The address follows ─────────────────────────────────────────────── */

test("the address follows the chapter being read by replaceState, adding nothing to the history", async () => {
  const events = [];
  const hear = (e) => events.push(e.detail);
  document.addEventListener(READ_ON_EVENT, hear);
  const [pushes, unpush] = spy(history, "pushState");
  const [replaces, unreplace] = spy(history, "replaceState");
  try {
    const reading = open("john", 4);
    assert.ok(reading, "a published chapter's page reads on");
    const length = history.length;
    await settle();
    assert.ok(document.documentElement.hasAttribute("data-read-on"));
    assert.equal(location.pathname, "/john-4/");
    assert.ok(fetched.includes("/john-5/"), "the next chapter's page is fetched ahead");
    assert.equal(document.querySelectorAll(".read-on__chapter").length, 0, "nothing loads while the page's own end is far below");

    // Nearing John 4's end (its foot within 2.5 windows), John 5 comes in below.
    await scrollTo(400);
    await until(() => loaded(5), "John 5 to load");
    const five = loaded(5);
    assert.ok(five.parentElement.classList.contains("read-on--after"));
    assert.equal(five.querySelector("h2.read-on__heading")?.id, "john-5-heading");
    assert.equal(five.querySelector("h2.read-on__heading")?.textContent, "John 5");
    assert.equal(location.pathname, "/john-4/", "the address waits until John 5 is being read");

    // Its ids are prefixed, so none repeats the page's own; a block's id is kept.
    assert.ok(five.contains(document.getElementById("john-5-v16")));
    assert.ok(pageChapter().contains(document.getElementById("v16")));
    assert.ok(five.contains(document.getElementById("john-5-p1")));
    assert.equal(document.getElementById("john-5-john-5-p1"), null);
    assert.equal(five.querySelector(".fn-ref a")?.getAttribute("href"), "#john-5-fn-a");
    assert.equal(five.querySelector(".fn-ref a")?.dataset.fn, "fn-a");
    assert.equal(five.querySelector(".footnote-backlink")?.getAttribute("href"), "#john-5-fnref-a");
    assert.equal(five.querySelector(".chapter-head a[data-go-deeper]")?.getAttribute("href"), "#john-5-go-deeper-title");

    // The Study Desk hears it came, with its text.
    const came = events.find((d) => d.type === "loaded");
    assert.deepEqual([came?.book, came?.chapter], ["john", 5]);
    assert.equal(came.box.closest(".read-on__chapter")?.dataset.chapter, "5");
    assert.ok(came.box.classList.contains("chapter-paragraphs"));

    // Reading John 5: the address, the title, the line, and the progress line follow.
    await readAt(5, 10);
    assert.equal(location.pathname, "/john-5/");
    assert.deepEqual(history.state?.readOn, { book: "john", chapter: 5, verse: null });
    assert.equal(document.title, titleOf("john", 5));
    assert.match(document.querySelector(".place-line__pick").textContent, /Chapter 5/);
    assert.equal(turn("prev")?.getAttribute("href"), "/john-4/");
    assert.equal(turn("next")?.getAttribute("href"), "/john-6/");
    assert.equal(turn("next")?.getAttribute("aria-label"), "Next: John 6");
    assert.equal(document.querySelector(".site-header__picker-label").textContent, "John 5");
    assert.equal(document.querySelector("a[data-study-place]").getAttribute("href"), "/desk/?place=john-5");
    assert.equal(document.querySelector("a[data-study-place]").textContent, "Study John 5");
    assert.deepEqual(reading.placeNow(), { book: "john", chapter: 5, verse: 10 });
    assert.equal(document.documentElement.style.getPropertyValue("--read-progress"), String(bookProgress("john", 5, 10)));
    assert.deepEqual(events.filter((d) => d.type === "place").map((d) => d.chapter), [5]);

    // Within the chapter the address isn't set again (Safari limits the calls).
    const calls = replaces.length;
    await readAt(5, 30);
    assert.equal(replaces.length, calls);
    assert.deepEqual(reading.placeNow(), { book: "john", chapter: 5, verse: 30 });

    // Back up into the page's own chapter, its own address.
    await readAt(4, 50);
    assert.equal(location.pathname, "/john-4/");
    assert.equal(document.title, titleOf("john", 4));
    assert.equal(turn("next")?.getAttribute("href"), "/john-5/");

    assert.equal(history.length, length, "no history entry was added");
    assert.equal(pushes.length, 0, "nothing was pushed");
  } finally {
    unpush();
    unreplace();
    document.removeEventListener(READ_ON_EVENT, hear);
  }
});

/* ── The arrows ──────────────────────────────────────────────────────── */

test("the arrows load the chapter they name and land on its heading, with focus there", async () => {
  open("john", 4);
  await settle();
  const length = history.length;

  const go = async (rel, n) => {
    const e = click(turn(rel));
    assert.ok(e.defaultPrevented, `${rel} is answered in the page`);
    await until(() => location.pathname === `/john-${n}/`, `John ${n}`);
  };

  await go("next", 5);
  assert.equal(loaded(5)?.getBoundingClientRect().top, 0, "John 5 starts at the window's top");
  assert.equal(document.activeElement?.id, "john-5-heading");

  await go("next", 6);
  assert.ok(fetched.includes("/john-6/"));
  assert.equal(loaded(6)?.getBoundingClientRect().top, 0);
  assert.equal(document.activeElement?.id, "john-6-heading");

  // Back to a chapter already on the page: nothing is fetched again.
  const fetches = fetched.length;
  await go("prev", 5);
  assert.equal(fetched.length, fetches);
  assert.equal(loaded(5)?.getBoundingClientRect().top, 0);
  assert.equal(document.activeElement?.id, "john-5-heading");

  // And to the page's own chapter, whose heading takes focus as a loaded one's does.
  await go("prev", 4);
  assert.equal(document.querySelector("[data-read-on-page]").getBoundingClientRect().top, 0);
  assert.equal(document.activeElement?.id, "chapter-title");
  assert.equal(document.getElementById("chapter-title").getAttribute("tabindex"), "-1");

  assert.equal(history.length, length, "turning chapters adds no history entry");
});

test("into another book or an introduction the arrows stay links", async () => {
  open("john", 4);
  await settle();
  const line = document.querySelector(".place-line");
  line.insertAdjacentHTML("beforeend", `<a id="acts" href="/acts-1/" rel="next">›</a><a id="intro" href="/john-intro/" rel="prev">‹</a>`);
  const left = [];
  // After the page's own listener: was the click left to the browser? Then keep happy-dom from leaving.
  const after = (e) => {
    left.push([e.target.id, !e.defaultPrevented]);
    e.preventDefault();
  };
  document.addEventListener("click", after);
  try {
    click(document.getElementById("acts"));
    click(document.getElementById("intro"));
  } finally {
    document.removeEventListener("click", after);
  }
  assert.deepEqual(left, [["acts", true], ["intro", true]]);
  await settle();
  assert.equal(document.querySelectorAll(".read-on__chapter").length, 0, "nothing was loaded for them");
});

/* ── Drafts ──────────────────────────────────────────────────────────── */

test("a run of drafts is one entry, never fetched, and the book's way on follows it", async () => {
  const reading = open("luke", 22, { count: 10, drafts: [23, 24] });
  await until(() => document.querySelector(".read-on__chapter--draft"), "the drafts' entry");
  await settle();
  const entries = [...document.querySelectorAll(".read-on--after > .read-on__chapter")];
  assert.equal(entries.length, 1, "Luke 23 and 24 are one entry");
  const draft = entries[0];
  assert.ok(draft.classList.contains("read-on__chapter--draft"));
  assert.equal(draft.dataset.chapters, "23 24");
  assert.equal(draft.querySelector("h2")?.textContent, "Luke 23–24");
  assert.deepEqual(
    [...draft.querySelectorAll(".read-on__stub")].map((p) => p.textContent),
    ["These chapters are still being translated.", "Read their Greek in Study"],
  );
  assert.equal(draft.querySelector(".read-on__greek a")?.getAttribute("href"), "/desk/?place=luke-23");
  assert.deepEqual(fetched.filter((u) => /luke-2[34]/.test(u)), [], "a draft's page is never fetched");

  // The book's way on comes after its last chapter.
  const end = document.querySelector(".read-on--after > .read-on__end");
  assert.ok(end, "the way on is placed");
  assert.equal(end.previousElementSibling?.dataset.chapters, "23 24");
  assert.match(end.textContent, /The end of Luke/);

  // Reading into it: the address names its first chapter; Continue reading records nothing.
  await scrollTo(layout().get(draft).top);
  assert.equal(location.pathname, "/luke-23/");
  assert.equal(reading.placeNow(), null);
  assert.equal(document.querySelectorAll(".read-on__chapter").length, 1, "nothing more loads after the book's end");
});

/* ── Above ───────────────────────────────────────────────────────────── */

test("a chapter loaded above keeps the reader's line where it was, and only a scroll up asks for it", async () => {
  open("john", 4);
  await settle();
  await scrollTo(0);
  assert.equal(document.querySelectorAll(".read-on--before > *").length, 0, "nothing loads above by itself");
  const head = () => document.querySelector("[data-read-on-page]");

  // At the page's top no scroll event can say "up", so the wheel does.
  window.dispatchEvent(new window.WheelEvent("wheel", { deltaY: -120 }));
  await until(() => loaded(3), "John 3 to load above");
  await settle();
  assert.ok(loaded(3).parentElement.classList.contains("read-on--before"));
  assert.equal(head().getBoundingClientRect().top, 0, "John 4's heading hasn't moved");
  assert.equal(window.scrollY, layout().get(loaded(3)).height);
  assert.ok(document.documentElement.hasAttribute("data-read-on-above"));
  assert.equal(location.pathname, "/john-4/");

  // A scroll up near the top (John 3's top 100px above the window's) brings
  // the one before that, and John 3 stays where the reader had it.
  await scrollTo(100);
  await until(() => loaded(2), "John 2 to load above");
  await settle();
  assert.equal(loaded(3).getBoundingClientRect().top, -100);
  assert.equal(window.scrollY, layout().get(loaded(2)).height + 100);
  assert.equal(location.pathname, "/john-3/", "John 3 is the chapter at the reading line");
});

/** A phone's page: a chapter loaded above draws the page's own title, and the reader's line holds. */
async function phoneAbove({ banner }) {
  phoneTitle = true;
  try {
    open("john", 4);
    if (banner) document.querySelector(".scripture-main").prepend(Object.assign(document.createElement("div"), { className: "app-banner-stand-in" }));
    await settle();
    await scrollTo(0);
    const title = document.getElementById("chapter-title");
    const verse = () => pageChapter().querySelector("[data-verse]");
    assert.equal(title.getBoundingClientRect().height, 0, "the top row names the chapter");
    const was = verse().getBoundingClientRect().top;
    window.dispatchEvent(new window.WheelEvent("wheel", { deltaY: -120 }));
    await until(() => loaded(3), "John 3 to load above");
    await settle();
    assert.equal(title.getBoundingClientRect().height, HEADING, "a heading between chapters now");
    assert.equal(verse().getBoundingClientRect().top, was, "John 4's first verse hasn't moved");
  } finally {
    phoneTitle = false;
  }
}

test("on a phone the page's own title is drawn once a chapter is above it, and the reader's line still holds", () => phoneAbove({ banner: false }));

test("the same under Android's app banner, which puts the reading line above the title", () => phoneAbove({ banner: true }));

/* ── Printing ────────────────────────────────────────────────────────── */

test("a print is the one chapter being read, with its own address in the credit", async () => {
  open("john", 4);
  await settle();
  const html = document.documentElement;
  const printing = () => [...document.querySelectorAll("[data-read-on-printing]")].map((el) => (el.hasAttribute("data-read-on-page") ? "page" : el.dataset.chapter));
  const credit = () => document.querySelectorAll(".print-credit p")[1].textContent;
  const print = () => window.dispatchEvent(new window.Event("beforeprint"));
  const done = () => window.dispatchEvent(new window.Event("afterprint"));

  click(turn("next"));
  await until(() => location.pathname === "/john-5/", "John 5");
  print();
  assert.ok(html.hasAttribute("data-read-on-print"));
  assert.deepEqual(printing(), ["5"]);
  assert.equal(credit(), "litbible.net/john-5");
  done();
  assert.ok(!html.hasAttribute("data-read-on-print"));
  assert.deepEqual(printing(), []);
  assert.equal(credit(), "litbible.net/john-4");

  // Study's prints are of the page's own chapter.
  html.setAttribute("data-desk-print", "");
  print();
  assert.deepEqual(printing(), ["page", "page"]);
  assert.equal(credit(), "litbible.net/john-4");
  done();
  html.removeAttribute("data-desk-print");

  // In the page's own chapter, that is the one printed.
  click(turn("prev"));
  await until(() => location.pathname === "/john-4/", "John 4");
  print();
  assert.deepEqual(printing(), ["page", "page"]);
  done();

  // On paper everything but the marked chapter goes.
  const css = readFileSync(new URL("../src/styles/reading-page.css", import.meta.url), "utf8");
  const paper = css.slice(css.indexOf("@media print"));
  assert.match(paper, /html\[data-read-on-print\] :is\(\[data-read-on-page\], \.read-on__chapter\):not\(\[data-read-on-printing\]\)\s*\{\s*display: none !important;/);
});

/* ── Coming back ─────────────────────────────────────────────────────── */

test("leaving keeps the verse in history.state, and a reload or Back lands on it", async () => {
  open("john", 4);
  await settle();
  click(turn("next"));
  await until(() => location.pathname === "/john-5/", "John 5");
  await readAt(5, 12);
  window.dispatchEvent(new window.Event("pagehide"));
  const kept = history.state;
  assert.deepEqual(kept?.readOn, { book: "john", chapter: 5, verse: 12 });

  const [, unstub] = spy(performance, "getEntriesByType");
  try {
    for (const type of ["reload", "back_forward"]) {
      performance.getEntriesByType = () => [{ type }];
      history.scrollRestoration = "auto";
      // The address was John 5's, so that page opens, and goes back to verse 12.
      open("john", 5, { state: kept });
      const verse = pageChapter().querySelector('[data-verse="12"]');
      assert.equal(window.scrollY, layout().get(verse).top, type);
      assert.equal(history.scrollRestoration, "manual");
      await settle();
      assert.equal(location.pathname, "/john-5/");
    }
    // A place kept for another chapter is not this page's: it opens at the top.
    performance.getEntriesByType = () => [{ type: "reload" }];
    open("john", 4, { state: kept });
    assert.equal(window.scrollY, 0);
    await settle();
  } finally {
    unstub();
  }
});

/* ── Go deeper and links inside a chapter ────────────────────────────── */

test("Go deeper goes to the chapter's own section, or asks the Notebook where the section has left the page", async () => {
  open("john", 4);
  await settle();
  click(turn("next"));
  await until(() => location.pathname === "/john-5/", "John 5");
  const five = loaded(5);
  const go = five.querySelector(".chapter-head a[data-go-deeper]");

  let e = click(go);
  assert.ok(e.defaultPrevented);
  assert.equal(window.scrollY, layout().get(document.getElementById("john-5-go-deeper-title")).top);
  assert.equal(document.activeElement?.id, "john-5-go-deeper-title");

  // Where the Notebook panel runs, the section is out of the flow (WB-18):
  // This verse shows it under "This chapter" instead.
  const asked = [];
  const hear = (ev) => asked.push(ev.detail);
  document.addEventListener("lit:desk-command", hear);
  try {
    five.querySelector(".go-deeper").hidden = true;
    const y = window.scrollY;
    click(go);
    assert.deepEqual(asked, [{ id: "show-this-chapter", book: "john", chapter: 5 }]);
    assert.equal(window.scrollY, y, "the page stays put");
  } finally {
    document.removeEventListener("lit:desk-command", hear);
  }

  // A footnote's way back inside a loaded chapter scrolls in place: no fragment, no history.
  const length = history.length;
  e = click(five.querySelector(".footnote-backlink"));
  assert.ok(e.defaultPrevented);
  assert.equal(document.activeElement?.id, "john-5-fnref-a");
  assert.equal(location.hash, "");
  assert.equal(history.length, length);
});

/* ── The rules (src/lib/read-on.mjs) ─────────────────────────────────── */
// Which chapter comes next across books is the chapter-nav rule
// (test/chapter-nav.test.js); the draft runs across the whole New Testament
// are test/desk-corpus.test.js's.

test("the chapter beside one is the next unit in its book: a run of drafts is one step, and a book's ends have none", () => {
  const units = bookUnits("luke", [23, 24]);
  assert.deepEqual(unitBeside(units, 21, 1)?.chapters, [22]);
  assert.deepEqual(unitBeside(units, 22, 1)?.chapters, [23, 24]);
  assert.equal(unitBeside(units, 22, 1)?.draft, true);
  assert.equal(unitBeside(units, 24, 1), null, "the book's end: its way on is a link (WB-10)");
  assert.deepEqual(unitBeside(units, 24, -1)?.chapters, [22]);
  assert.deepEqual(unitBeside(units, 23, -1)?.chapters, [22]);
  assert.equal(unitBeside(units, 1, -1), null);
  assert.equal(unitBeside(units, 30, 1), null, "a chapter the book hasn't got");
});

test("a draft's entry links its Greek in Study, worded for one chapter, a run, or a whole book", () => {
  assert.deepEqual(draftGreekLink({ bookKey: "luke", chapters: [24], draft: true }), { label: "Read its Greek in Study", href: "/desk/?place=luke-24" });
  assert.deepEqual(draftGreekLink({ bookKey: "luke", chapters: [23, 24], draft: true }), { label: "Read their Greek in Study", href: "/desk/?place=luke-23" });
  const [titus] = bookUnits("titus", [1, 2, 3]);
  assert.deepEqual(titus.chapters, [1, 2, 3]);
  assert.deepEqual(draftGreekLink(titus), { label: "Read its Greek in Study", href: "/desk/?place=titus-1" });
});

test("the progress line counts verses through the book, so a long chapter counts for more (WB-34)", () => {
  const counts = VERSE_COUNTS.john;
  const total = counts.reduce((n, c) => n + c, 0);
  const sum = (to) => counts.slice(0, to).reduce((n, c) => n + c, 0);
  assert.equal(bookProgress("john", 1, 0), 0, "before the book's first verse");
  assert.equal(bookProgress("john", 1, 1), 1 / total);
  assert.equal(bookProgress("john", 4, 10), (sum(3) + 10) / total);
  assert.equal(bookProgress("john", 21, counts[20]), 1, "the last verse is the whole way");
  const share = (n) => bookProgress("john", n + 1, 0) - bookProgress("john", n, 0);
  assert.ok(share(6) > share(2), "John 6 (71 verses) moves the line further than John 2 (25)");
  // Out of range is held to the book, never past either end.
  assert.equal(bookProgress("john", 99, 999), 1);
  assert.equal(bookProgress("john", 3, -5), bookProgress("john", 3, 0));
  assert.equal(bookProgress("john", 3, 999), sum(3) / total);
  assert.equal(bookProgress("nobook", 1, 1), 0);
});

test("the book's way on after a run of drafts names none of them again: the entries above it already do", async () => {
  const { navFor } = await import("../src/lib/chapter-nav-data.mjs");
  // Acts 28's own foot names the drafts it steps back over, 2 to 27, which
  // under the entry "Acts 2–28" would read as a contradiction.
  assert.equal(navFor("acts", 28).prevSkipped?.sentence, "Acts 2–27 are still being translated.");
  const slug = readFileSync(new URL("../src/pages/[slug].astro", import.meta.url), "utf8");
  assert.match(slug, /<template data-read-on-end>\s*<ChapterCtas bookKey=\{normalizedBookKey\} chapter=\{bookEnd\} showPrevSkipped=\{false\} \/>/);
  const ctas = readFileSync(new URL("../src/components/ChapterCtas.astro", import.meta.url), "utf8");
  assert.match(ctas, /\[showPrevSkipped \? prevSkipped : null, nextSkipped\]/, "the note going on stays");
});

test("scroll anchoring is off on body as well as the root, or a reader at the page's end loads the whole book", () => {
  // Headless Chrome, John 3 at 1440×900, the window put at the page's very
  // end: with the root's anchoring off and body's on, the window kept to the
  // new end as each chapter arrived below, so John 4 through 16 loaded in
  // two seconds. With both off (or both on) only John 4 loads.
  const css = readFileSync(new URL("../src/styles/reading-page.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const rule = css.match(/([^{}]*)\{\s*overflow-anchor:\s*none;\s*\}/);
  assert.ok(rule, "reading-page.css turns scroll anchoring off");
  const selectors = rule[1].split(",").map((s) => s.trim());
  assert.ok(selectors.includes("html[data-read-on]"), "on the root");
  assert.ok(selectors.includes("html[data-read-on] body"), "and on body");
});
