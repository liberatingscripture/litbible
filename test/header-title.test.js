// The header's title is chosen before first paint (E138).
//
// The header shows "The Liberation & Inclusion Translation" where it fits and
// "LIT Bible" where it doesn't. The choice was made by a bundled script that
// waited for idle time, so every page in a window too narrow for the long
// title painted the long title and swapped it up to two seconds later (BVJ,
// 2026-11-17). It is now an inline script right after the header's row.
//
// When it measures matters as much as where it sits. Measured as the page
// parses, the row is in its fallback fonts, which are wider, and the layout
// that forces makes the browser paint sooner: in a new tab that painted the
// wrong title for some 50 ms in about one load in ten, across 90px of window
// widths. So the script asks for the row's fonts and measures when they have
// settled, or at the first frame if they haven't by then.
//
// The first tests hold the script to its place. The rest run its own text
// against a page with a small layout, since happy-dom has none.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { settle, resetDom } from "./helpers/browser-env.mjs";

const source = readFileSync(new URL("../src/components/SiteHeader.astro", import.meta.url), "utf8");
const scripts = [...source.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].map((m) => ({ attrs: m[1], code: m[2], at: m.index }));
const titleScripts = scripts.filter((s) => s.code.includes(".title-truncatable") || s.code.includes(".title-alt"));

test("one script chooses the title, and it is inline", () => {
  assert.equal(titleScripts.length, 1, "a second script choosing the title would undo the first");
  assert.match(titleScripts[0].attrs, /\bis:inline\b/, "a bundled script runs after first paint");
});

test("it sits right after the row it measures, ahead of the rest of the header", () => {
  const { at } = titleScripts[0];
  const rowEnd = source.indexOf('class="site-header__menu-toggle"');
  assert.ok(rowEnd > 0, "the row's last control");
  assert.ok(at > rowEnd, "after the brand, the nav, and the actions, which set the title's room");
  for (const later of ['class="site-header__search-strip"', 'class="font-tray"', 'class="menu-overlay"']) {
    const i = source.indexOf(later);
    assert.ok(i > at, `before ${later}, so nothing delays it`);
  }
  // The Study Desk's header has no long title, so it gets no script.
  assert.match(source.slice(at - 40, at), /\{!deskTitle && \(\s*$/);
});

test("nothing waits for idle time or a timer, and nothing is measured as the page parses", () => {
  const { code } = titleScripts[0];
  assert.doesNotMatch(code, /requestIdleCallback|setTimeout|DOMContentLoaded|addEventListener\("load"/);
  // fonts.ready is settled already while a page parses with nothing loading,
  // so waiting on it measures the fallbacks.
  assert.doesNotMatch(code, /fonts\.ready/);
  // The one direct call is inside `again`, which the fonts run; everything
  // else goes through a frame.
  assert.equal(code.split("measureIfChanged();").length - 1, 1);
  assert.match(code, /const again = \(\) => \{\s*width = -1;\s*measureIfChanged\(\);\s*\};/);
  assert.match(code, /\blater\(\);/, "the first frame measures if the fonts haven't");
});

// ── Running it ──────────────────────────────────────────────────────────

const PREFIX = 300; // "The Liberation & Inclusion"
const WORD = 120; // "Translation"
const LONG = PREFIX + WORD;
const SHORT = 110; // "LIT Bible"

const observers = [];
class FakeResizeObserver {
  constructor(cb) {
    this.cb = cb;
    observers.push(this);
  }
  observe(el) {
    this.el = el;
  }
}
window.ResizeObserver = FakeResizeObserver;
globalThis.ResizeObserver = FakeResizeObserver;

/**
 * A header as SiteHeader.astro writes it, with a layout.
 *
 * `room` is the width the title's box may take in the row's own fonts, and
 * `fallbackGap` how much less it has while they are missing (the fallbacks
 * are wider). `navShown`: the nav is displayed (a computer) or folded into
 * the menu button (a phone). `fonts`: "memory" (they settle in the script's
 * own turn, as going from page to page), "pending" (they settle when the
 * test says: cached on disk, or on the network), or "none" (no
 * document.fonts).
 */
function mount({ room, fallbackGap = 0, rowWidth = 1000, navShown = true, font = "", longTitle = true, fonts = "memory" }) {
  resetDom();
  observers.length = 0;
  const root = document.documentElement;
  font ? root.setAttribute("data-font", font) : root.removeAttribute("data-font");
  document.body.innerHTML = `
    <header class="site-header"><div class="site-header__inner">
      <a class="site-header__brand" href="/"><span class="site-header__title" data-w="600" data-f='"Crimson Text", "Crimson Fallback", Georgia, serif'>
        ${longTitle ? `<span class="title-long"><span class="title-prefix">The Liberation &amp; Inclusion</span><span class="title-truncatable">Translation</span></span>` : ""}
        <span class="title-alt">LIT Bible</span>
      </span></a>
      <nav class="site-nav"><ul class="site-nav__list">
        <li><a href="/about" data-w="500">About</a></li>
        <li><a href="/glossary" data-w="500">Glossary</a></li>
        <li><button type="button" data-w="500">Learn</button></li>
        <li><a class="site-header__cta" href="/read" data-w="700">Read</a></li>
      </ul></nav>
      <div class="site-header__actions"><button type="button" data-f="Arial, sans-serif">Aa</button></div>
    </div></header>`;
  const row = document.querySelector(".site-header__inner");
  const title = row.querySelector(".site-header__title");
  const long = row.querySelector(".title-long");
  const word = row.querySelector(".title-truncatable");
  const short = row.querySelector(".title-alt");
  const nav = row.querySelector(".site-nav");
  const page = { room, fallbackGap, rowWidth, navShown, long, short, measured: 0, fontsIn: false, asked: [], loads: [] };
  const roomNow = () => page.room - (page.fontsIn ? 0 : page.fallbackGap);
  const longShown = () => long && long.style.display !== "none";
  const get = (el, name, fn) => Object.defineProperty(el, name, { get: fn, configurable: true });
  get(row, "clientWidth", () => page.rowWidth);
  get(title, "scrollWidth", () => (longShown() ? LONG : SHORT));
  get(title, "clientWidth", () => Math.min(roomNow(), longShown() ? LONG : SHORT));
  if (word) {
    get(word, "scrollWidth", () => (longShown() ? WORD : 0));
    // Only "Translation" gives way; the prefix is rigid.
    get(word, "clientWidth", () => (longShown() ? Math.max(0, Math.min(WORD, roomNow() - PREFIX)) : 0));
  }
  // The script reads the nav's display once per measurement, and each of the
  // row's elements' font once, to ask for it.
  globalThis.getComputedStyle = (el) => {
    if (el === nav) {
      page.measured += 1;
      return { display: page.navShown ? "flex" : "none" };
    }
    return { fontWeight: el.dataset.w || "400", fontFamily: el.dataset.f || "Inter, sans-serif" };
  };
  // `check` answers "loaded" from the start, as it does for a cached face
  // once a layout has asked for it: the script must not be put off by that.
  const fontSet = {
    check: () => true,
    load: (face) => {
      page.asked.push(face);
      if (fonts === "memory") return Promise.resolve().then(() => { page.fontsIn = true; });
      return new Promise((resolve, reject) => { page.loads.push({ resolve, reject }); });
    },
  };
  Object.defineProperty(document, "fonts", { configurable: true, value: fonts === "none" ? undefined : fontSet });
  page.arrive = () => {
    page.fontsIn = true;
    for (const l of page.loads) l.resolve();
  };
  page.shows = () => (!long ? "short only" : long.style.display === "" ? "unmeasured" : longShown() ? "long" : "short");
  return page;
}

/** Runs the header's script as the parser would: once, at once. */
const run = () => new Function(titleScripts[0].code)();
/** The rest of the script's own turn: promises, but no frame and no timer. */
const turn = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

test("nothing is measured while the page is parsing", () => {
  const page = mount({ room: LONG - 50 });
  run();
  assert.equal(page.measured, 0);
  assert.equal(page.shows(), "unmeasured");
});

test("fonts in memory: measured in the script’s own turn, before any frame, and in those fonts", async () => {
  // Going from page to page. The fallbacks wouldn't fit; the fonts do.
  let page = mount({ room: LONG, fallbackGap: 40 });
  run();
  await turn();
  assert.equal(page.shows(), "long");
  assert.equal(page.short.style.display, "none");
  assert.equal(page.measured, 1);

  page = mount({ room: LONG - 50 });
  run();
  await turn();
  assert.equal(page.shows(), "short");
  assert.equal(page.long.style.display, "none");
  // The first frame finds nothing changed.
  await settle();
  assert.equal(page.measured, 1);
});

test("with the nav showing, the short title comes as soon as “Translation” can’t show in full", async () => {
  let page = mount({ room: LONG - 2 });
  run();
  await turn();
  assert.equal(page.shows(), "short");
  // A pixel of rounding is not a clipped word.
  page = mount({ room: LONG - 1 });
  run();
  await turn();
  assert.equal(page.shows(), "long");
});

test("with the nav folded away, the short title comes when the long one overflows its box", async () => {
  let page = mount({ room: LONG - 3, navShown: false });
  run();
  await turn();
  assert.equal(page.shows(), "short");
  page = mount({ room: LONG - 2, navShown: false });
  run();
  await turn();
  assert.equal(page.shows(), "long", "two pixels of rounding are allowed");
  page = mount({ room: 200, navShown: false });
  run();
  await turn();
  assert.equal(page.shows(), "short");
});

test("OpenDyslexic always takes the short title, without measuring", async () => {
  const page = mount({ room: 5000, font: "dyslexic" });
  run();
  await turn();
  assert.equal(page.shows(), "short");
  assert.equal(page.measured, 0);
  // Atkinson measures as the default font does.
  const atkinson = mount({ room: LONG, font: "atkinson" });
  run();
  await turn();
  assert.equal(atkinson.shows(), "long");
  assert.equal(atkinson.measured, 1);
});

test("it asks for every font the row is drawn in, once each, whatever fonts.check() says", () => {
  const page = mount({ room: LONG });
  run();
  assert.equal(document.fonts.check('600 1em "Crimson Text"'), true, "a cached face reads as loaded before it can be drawn");
  assert.deepEqual(page.asked, ['600 1em "Crimson Text"', "500 1em Inter", "700 1em Inter", "400 1em Arial"]);
});

test("fonts on the way: it waits for all of them, and measures the moment the last settles", async () => {
  // A new tab: the fonts are cached, and usable a few milliseconds on.
  const page = mount({ room: LONG, fallbackGap: 40, fonts: "pending" });
  run();
  await turn();
  assert.equal(page.measured, 0, "no measurement of the fallbacks, and no layout to hurry a paint");

  // One font in is not the row's own widths yet.
  page.loads[0].resolve();
  await turn();
  assert.equal(page.measured, 0);

  page.arrive();
  await turn(); // no frame and no timer between the fonts and the answer
  assert.equal(page.shows(), "long");
  assert.equal(page.measured, 1);
  await settle();
  assert.equal(page.measured, 1, "and the first frame has nothing to do");
});

test("fonts slower than the first frame: the frame shows the fallbacks’ own answer, then the fonts’", async () => {
  // A first visit, the fonts still on the network.
  const page = mount({ room: LONG, fallbackGap: 40, fonts: "pending" });
  run();
  await settle(); // the first frame
  assert.equal(page.shows(), "short", "the fallbacks don't fit, and an unmeasured title is never left up");
  assert.equal(page.measured, 1);

  page.arrive();
  await turn();
  assert.equal(page.shows(), "long", "the title changes as the letters do");
  assert.equal(page.measured, 2);
});

test("a font that fails to load still gets the row measured", async () => {
  const page = mount({ room: LONG - 50, fonts: "pending" });
  run();
  page.loads[1].reject(new Error("network"));
  await turn();
  assert.equal(page.shows(), "short");
  assert.equal(page.measured, 1);
});

test("a browser with no document.fonts measures at the first frame", async () => {
  const page = mount({ room: LONG - 50, fonts: "none" });
  run();
  assert.equal(page.measured, 0);
  await settle();
  assert.equal(page.shows(), "short");
});

test("after that it measures only when the row’s width or the reader’s font changes", async () => {
  const page = mount({ room: LONG - 50 });
  run();
  await settle();
  assert.equal(page.shows(), "short");
  assert.equal(page.measured, 1);

  // A phone's address bar: resize after resize at the same width.
  for (let i = 0; i < 3; i++) window.dispatchEvent(new Event("resize"));
  observers[0].cb();
  await settle();
  assert.equal(page.measured, 1, "nothing was measured");

  // A wider window, with room for the long title.
  page.rowWidth = 1300;
  page.room = LONG + 40;
  observers[0].cb();
  await settle();
  assert.equal(page.shows(), "long");
  assert.equal(page.measured, 2);

  // The Display tray announces a font change by a resize that changes no width.
  document.documentElement.setAttribute("data-font", "dyslexic");
  window.dispatchEvent(new Event("resize"));
  await settle();
  assert.equal(page.shows(), "short");
  document.documentElement.removeAttribute("data-font");
  window.dispatchEvent(new Event("resize"));
  await settle();
  assert.equal(page.shows(), "long");
});

test("the account's entry changed width after the paint: the title is fitted again, though the row's width didn't change", async () => {
  // “Sign in” gave way to the narrower account button (or the other way), which the row's own width never shows.
  const page = mount({ room: LONG - 30 });
  run();
  await settle();
  assert.equal(page.shows(), "short");
  assert.equal(page.measured, 1);

  page.room = LONG + 10; // the button is 40px narrower than the words
  window.dispatchEvent(new Event("resize"));
  await settle();
  assert.equal(page.measured, 1, "a resize at the same width measures nothing");
  document.dispatchEvent(new CustomEvent("lit:header-tools"));
  assert.equal(page.shows(), "long", "at once, with no frame to wait for");
  assert.equal(page.measured, 2);

  page.room = LONG - 30; // signed out: the words are back
  document.dispatchEvent(new CustomEvent("lit:header-tools"));
  assert.equal(page.shows(), "short");
});

test("it watches the row, whose width follows the window", () => {
  mount({ room: LONG });
  run();
  assert.equal(observers.length, 1);
  assert.equal(observers[0].el, document.querySelector(".site-header__inner"));
});

test("a header with no long title is left alone", async () => {
  const page = mount({ room: 100, longTitle: false });
  run();
  await settle();
  assert.equal(page.short.getAttribute("style"), null);
  assert.equal(observers.length, 0);
  assert.equal(page.asked.length, 0);
});
