// test/desk-prepaint.test.js
//
// The Study Desk's switch in Layout.astro's pre-paint script. It can't import,
// so it repeats src/lib/app-platform.mjs's test; this runs the script itself,
// as written in Layout.astro, against the same devices isAppPlatform is tested
// on, so the two can't drift apart. It also checks the preview link: ?desk=on
// and ?desk=off set the flag and leave the address. It also checks that a width
// dragged in the notebook (sessionStorage) is stamped only while the notebook is
// open (minimized or expanded alike: BS-15, Featherboa's Phase 5, opening and
// minimizing move no scripture), the desk is on, and the values are in range,
// that the open notebook is always stamped expanded, and that the widths are
// applied only where the window holds them (BA30; BA25's "narrow windows aren't
// stamped expanded" is withdrawn): the script repeats src/lib/desk-margin.mjs's firstPaint. And
// that a page without the Notebook panel (a book's introduction, an article,
// the glossary; E124) gets data-desk alone, whatever the reader kept. And that
// a chapter opening with the notebook open is stamped with the move left
// its first placement will make, and its column's center, so it paints once,
// in place (E137), and nothing else is.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { APP_PLATFORM_UA, isAppPlatform } from "../src/lib/app-platform.mjs";
import { isAppPlatform as gateIsAppPlatform } from "../src/scripts/announcement-gate.js";
import {
  EDGE, FIRST_PAINT, GAP, KEEP_LEFT, MIN_WIDTH, MOVE_PROP, firstPaint, measureRange, placeInMargin,
} from "../src/lib/desk-margin.mjs";
import { READING_SURFACES, hasPanel } from "../src/scripts/desk-frame.js";
import { SWITCH_KEY, SWITCH_PARAM, SWITCH_VALUES } from "../src/lib/desk-account-words.mjs";

const layout = readFileSync(new URL("../src/layouts/Layout.astro", import.meta.url), "utf8");
const match = /define:vars=\{\{ appUa: APP_PLATFORM_UA\.source, appUaFlags: APP_PLATFORM_UA\.flags, deskFit, deskPanel, deskChapter \}\}>([\s\S]*?)<\/script>/.exec(layout);
// What Layout.astro hands the script.
const deskFit = { ...FIRST_PAINT, edge: EDGE, gap: GAP, minWidth: MIN_WIDTH };

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  // An Android tablet in desktop site mode (BA26): Chrome, then Firefox.
  linuxChrome: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  linuxFirefox: "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
  chromebook: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
};

/**
 * Run the script with a fake page; returns what it left behind. `session` is the
 * page's sessionStorage at load (the notebook's widths from this visit), and
 * `props` is what the script set on the page's inline style. `viewport` is the
 * width the page lays out in, `scrollbar` the classic scrollbar the window
 * reserves beside it, `html` what the earlier pre-paint scripts stamped (the
 * reader's font and text size) and `rootPx` the browser's root font size.
 * `surface` is the page's deskSurface, from which Layout.astro works out what
 * it hands the script: `deskPanel` (hasPanel) and `deskChapter` (the first
 * reading surface, whose column firstPaint knows). The default is a Chapter
 * View chapter.
 */
function run({
  href = "https://litbible.net/romans-8/", ua = UA.windows, touch = 0, uaData = undefined, stored = {}, session = {},
  viewport = 1440, scrollbar = 15, html = {}, rootPx = 16, surface = "chapter",
  deskPanel = hasPanel(surface), deskChapter = deskPanel && surface === READING_SURFACES[0].kind,
} = {}) {
  const attrs = { ...html };
  const props = {};
  const store = new Map(Object.entries(stored));
  const sessionStore = new Map(Object.entries(session));
  const replaced = [];
  const page = {
    document: {
      documentElement: {
        setAttribute: (k, v) => { attrs[k] = v; },
        getAttribute: (k) => (k in attrs ? attrs[k] : null),
        style: { setProperty: (k, v) => { props[k] = v; } },
        appendChild: () => {},
        removeChild: () => {},
      },
      // The throwaway element the script measures the scrollbar on.
      createElement: () => ({ style: {}, offsetWidth: 99, clientWidth: 99 - scrollbar }),
    },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    sessionStorage: {
      getItem: (k) => (sessionStore.has(k) ? sessionStore.get(k) : null),
    },
    location: { href },
    history: { state: null, replaceState: (_s, _t, url) => replaced.push(url) },
    navigator: { userAgent: ua, maxTouchPoints: touch, userAgentData: uaData },
    innerWidth: viewport + scrollbar,
    getComputedStyle: () => ({ fontSize: `${rootPx}px` }),
    deskFit,
    deskPanel,
    deskChapter,
  };
  const fn = new Function("appUa", "appUaFlags", ...Object.keys(page), match[1]);
  fn(APP_PLATFORM_UA.source, APP_PLATFORM_UA.flags, ...Object.values(page));
  for (const k of Object.keys(html)) delete attrs[k];
  return { attrs, stored: Object.fromEntries(store), replaced, props };
}

test("the script is in Layout.astro where this test expects it", () => {
  assert.ok(match, "the desk's pre-paint script wasn't found; update this test with it");
});

test("announcement-gate.js still hands out the one isAppPlatform", () => {
  assert.equal(gateIsAppPlatform, isAppPlatform);
});

test("with the flag on, the desk is on exactly where isAppPlatform says it's a computer", () => {
  const devices = [
    [UA.windows, 10],
    [UA.mac, 0],
    [UA.mac, 5], // iPadOS
    [UA.iphone, 5],
    [UA.android, 5],
    [UA.linuxChrome, 5], // an Android tablet in desktop site mode (BA26)
    [UA.linuxFirefox, 5],
    [UA.linuxChrome, 0], // a Linux computer
    [UA.chromebook, 10], // a touch Chromebook is a computer
    [UA.linuxChrome, 0, { mobile: true }],
    [UA.windows, 0, { mobile: false }],
  ];
  for (const [ua, touch, uaData] of devices) {
    const { attrs } = run({ ua, touch, uaData, stored: { "lit-desk-preview": "on" } });
    const computer = !isAppPlatform({ userAgent: ua, maxTouchPoints: touch, userAgentData: uaData });
    assert.equal(attrs["data-desk"] === "on", computer, `${ua} ${touch}`);
  }
});

test("an Android tablet in desktop site mode doesn't get the desk (BA26)", () => {
  const on = { "lit-desk-preview": "on" };
  assert.deepEqual(run({ ua: UA.linuxChrome, touch: 5, stored: on }).attrs, {});
  assert.deepEqual(run({ ua: UA.linuxFirefox, touch: 5, stored: on }).attrs, {});
  assert.deepEqual(run({ ua: UA.linuxChrome, uaData: { mobile: true }, stored: on }).attrs, {});
  assert.equal(run({ ua: UA.linuxChrome, stored: on }).attrs["data-desk"], "on");
  assert.equal(run({ ua: UA.chromebook, touch: 10, stored: on }).attrs["data-desk"], "on");
});

test("without the flag, nothing is set", () => {
  assert.deepEqual(run().attrs, {});
  assert.deepEqual(run({ stored: { "lit-desk-panel": "open" } }).attrs, {});
});

// Accounts (the plan's step 4h) are closed for everyone until one browser opens them with
// ?account=preview, which this script stores on whatever page it is given ("?account=, on
// every page," below). The stamp is on every device, since /delete-account/ shows its box
// on a phone too; the header's way in also needs the desk's.
test("accounts opened in this browser are stamped before paint, on every device, and nowhere else", () => {
  assert.equal("data-account" in run({ stored: { "lit-desk-preview": "on" } }).attrs, false);
  for (const value of ["preview", "local"]) {
    assert.deepEqual(run({ stored: { "lit-desk-account": value } }).attrs, { "data-account": "open" }, value);
  }
  assert.deepEqual(run({ ua: UA.iphone, touch: 5, stored: { "lit-desk-account": "preview" } }).attrs, { "data-account": "open" });
  assert.deepEqual(run({ surface: "home", stored: { "lit-desk-account": "preview", "lit-desk-preview": "on" } }).attrs, { "data-account": "open", "data-desk": "on" });
  assert.deepEqual(run({ stored: { "lit-desk-account": "yes" } }).attrs, {}, "only the two values the gate writes");
});

// The header's account button is narrower than "Sign in," and which of the two a browser gets
// is read from its notebook after the page has painted. The entry's script keeps a note of what
// it showed (lit-desk-account-last), and this script stamps it, so the row holds the right room
// from first paint and nothing in it moves (E231).
test("what the header showed last is stamped with accounts open, and never without", () => {
  const open = { "lit-desk-account": "preview", "lit-desk-preview": "on" };
  assert.deepEqual(run({ stored: { ...open, "lit-desk-account-last": "in" } }).attrs["data-account-last"], "in");
  assert.equal("data-account-last" in run({ stored: open }).attrs, false, "no note: “Sign in”'s room");
  assert.equal("data-account-last" in run({ stored: { ...open, "lit-desk-account-last": "out" } }).attrs, false, "only the one value the entry writes");
  assert.equal("data-account-last" in run({ stored: { "lit-desk-preview": "on", "lit-desk-account-last": "in" } }).attrs, false, "accounts are closed here: no entry to hold room for");
  assert.equal("data-account-last" in run({ href: "https://litbible.net/romans-8/?account=off", stored: { ...open, "lit-desk-account-last": "in" } }).attrs, false);
});

// Site 2.0's restyle stamp (E132) went with Site 2.0 (SITE-FEATHERBOA-BUILD.md,
// Phase 0): the flag stamps nothing on a phone, and data-restyle on nothing.
test("the flag no longer stamps data-restyle, on any device", () => {
  const on = { "lit-desk-preview": "on" };
  for (const [ua, touch] of [[UA.windows, 0], [UA.mac, 5], [UA.iphone, 5], [UA.android, 5], [UA.linuxChrome, 5]]) {
    assert.equal("data-restyle" in run({ ua, touch, stored: on }).attrs, false, `${ua} ${touch}`);
  }
  assert.deepEqual(run({ href: "https://litbible.net/romans-8/?desk=on", ua: UA.iphone, touch: 5 }).attrs, {});
});

test("an open notebook is stamped before paint, minimized or expanded, and marked as making room (BS-15)", () => {
  const open = run({ stored: { "lit-desk-preview": "on", "lit-desk-panel": "open" } });
  assert.deepEqual(open.attrs, { "data-desk": "on", "data-desk-panel": "open", "data-desk-expanded": "" });
  // It starts open (and minimized) until the reader closes it (BVJ, 2026-10-13).
  const fresh = run({ stored: { "lit-desk-preview": "on" } });
  assert.deepEqual(fresh.attrs, { "data-desk": "on", "data-desk-panel": "open", "data-desk-expanded": "" });
  const closed = run({ stored: { "lit-desk-preview": "on", "lit-desk-panel": "closed" } });
  assert.deepEqual(closed.attrs, { "data-desk": "on" });
  // A start the reader chose on the notebook page wins (src/lib/desk-start.mjs).
  const chosenClosed = run({ stored: { "lit-desk-preview": "on", "lit-desk-panel": "open", "lit-desk-start": "closed" } });
  assert.deepEqual(chosenClosed.attrs, { "data-desk": "on" });
  for (const start of ["min", "open"]) {
    const r = run({ stored: { "lit-desk-preview": "on", "lit-desk-panel": "closed", "lit-desk-start": start } });
    assert.deepEqual(r.attrs["data-desk-panel"], "open", start);
  }
  // Minimized or expanded, an open notebook keeps its room: data-desk-expanded
  // (what global.css keys the 48 measure on) goes on with data-desk-panel (BS-15,
  // reversing BVJ's 2026-10-14 rule that only the expanded one made room).
  const expanded = run({ stored: { "lit-desk-preview": "on", "lit-desk-min": "0" } });
  assert.deepEqual(expanded.attrs, { "data-desk": "on", "data-desk-panel": "open", "data-desk-expanded": "" });
  const chosenOpen = run({ stored: { "lit-desk-preview": "on", "lit-desk-start": "open" } });
  assert.deepEqual(chosenOpen.attrs, { "data-desk": "on", "data-desk-panel": "open", "data-desk-expanded": "" });
  const chosenMin = run({ stored: { "lit-desk-preview": "on", "lit-desk-start": "min", "lit-desk-min": "0" } });
  assert.deepEqual(chosenMin.attrs, { "data-desk": "on", "data-desk-panel": "open", "data-desk-expanded": "" });
  const phone = run({ ua: UA.iphone, touch: 5, stored: { "lit-desk-preview": "on", "lit-desk-panel": "open" } });
  assert.deepEqual(phone.attrs, {});
  // "Show the Notebook" left the Display tray (DI-16): a stored "off" is read
  // as shown, and nothing stamps data-desk-show any more.
  for (const start of ["min", "left"]) {
    const shown = run({ stored: { "lit-desk-preview": "on", "lit-desk-show": "off", "lit-desk-start": start } });
    assert.deepEqual(shown.attrs, { "data-desk": "on", "data-desk-panel": "open", "data-desk-expanded": "" }, start);
  }
  const shownClosed = run({ stored: { "lit-desk-preview": "on", "lit-desk-show": "off", "lit-desk-start": "closed" } });
  assert.deepEqual(shownClosed.attrs, { "data-desk": "on" });
});

// E124 (BVJ, 2026-11-12): book introductions, articles and the glossary have no
// Notebook panel in version 1, so nothing of the panel is stamped there: no
// open panel, no expanded one, no dragged widths.
test("a page without the Notebook panel gets data-desk alone, whatever the reader kept (E124)", () => {
  const states = [
    {},
    { "lit-desk-panel": "open" },
    { "lit-desk-min": "0" },
    { "lit-desk-start": "open" },
    { "lit-desk-start": "min" },
    { "lit-desk-show": "off" },
    { "lit-desk-panel": "closed" },
  ];
  const session = { "lit-desk-measure": "50", "lit-desk-width": "360" };
  for (const kind of ["intro", "article", "glossary"]) {
    assert.equal(hasPanel(kind), false, kind);
    // In a window where a chapter's column would be moved, too (E137).
    for (const viewport of [1440, 1009]) {
      for (const kept of states) {
        const r = run({ surface: kind, viewport, stored: { "lit-desk-preview": "on", ...kept }, session });
        assert.deepEqual(r.attrs, { "data-desk": "on" }, `${kind} ${viewport} ${JSON.stringify(kept)}`);
        assert.deepEqual(r.props, {}, `${kind} ${viewport} ${JSON.stringify(kept)}`);
      }
    }
    // The preview link still works there, and the reader's panel keys are left as they were.
    const on = run({ surface: kind, href: "https://litbible.net/glossary/?desk=on", stored: { "lit-desk-min": "0" } });
    assert.deepEqual(on.attrs, { "data-desk": "on" });
    assert.equal(on.stored["lit-desk-min"], "0");
  }
  // The same reader on a chapter gets the panel as before. Read View, which
  // had it too, retired in Featherboa's Phase 4.
  assert.equal(hasPanel("read"), false);
  for (const kind of ["chapter"]) {
    const r = run({ surface: kind, stored: { "lit-desk-preview": "on", "lit-desk-min": "0" } });
    assert.deepEqual(r.attrs, { "data-desk": "on", "data-desk-panel": "open", "data-desk-expanded": "" }, kind);
  }
});

// The script can't import, so Layout.astro works deskPanel out at build from
// what each page says it is. A page that stopped saying so would lose its stamps
// silently (a chapter opening expanded would reflow), so each one is read here.
test("Layout hands the script hasPanel of the page's deskSurface, and each reading page names its own", () => {
  assert.match(layout, /const deskPanel = hasPanel\(deskSurface\);/);
  // And whether it is the page whose column firstPaint knows (E137): Chapter
  // View, the first reading surface, as margin.js tells it.
  assert.match(layout, /const deskChapter = deskPanel && deskSurface === READING_SURFACES\[0\]\.kind;/);
  assert.equal(READING_SURFACES[0].kind, "chapter");
  const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  assert.match(read("../src/layouts/ScriptureLayout.astro"), /const deskSurface = pagefindType === "scripture" \? "chapter" : pagefindType === "intro" \? "intro" : undefined;/);
  assert.match(read("../src/layouts/ScriptureLayout.astro"), /<Layout [^>]*deskSurface=\{deskSurface\}/);
  assert.match(read("../src/pages/articles/[...slug].astro"), /\bdeskSurface="article"/);
  assert.match(read("../src/pages/glossary.astro"), /\bdeskSurface="glossary"/);
});

test("a width dragged in the notebook is stamped before paint, with its measure", () => {
  const r = run({
    stored: { "lit-desk-preview": "on", "lit-desk-panel": "open", "lit-desk-min": "0" },
    session: { "lit-desk-measure": "50", "lit-desk-width": "360" },
  });
  assert.deepEqual(r.attrs, { "data-desk": "on", "data-desk-panel": "open", "data-desk-expanded": "", "data-desk-widths": "" });
  assert.equal(r.props["--desk-measure"], "50");
  assert.equal(r.props["--desk-width"], "360px");
  // The widths place the column without a move (global.css's margin-right).
  assert.equal(MOVE_PROP in r.props, false);
});

test("a dragged width is applied while the notebook is minimized, as when expanded (BS-15)", () => {
  const session = { "lit-desk-measure": "50", "lit-desk-width": "360" };
  const r = run({ stored: { "lit-desk-preview": "on", "lit-desk-panel": "open" }, session });
  assert.deepEqual(r.attrs, { "data-desk": "on", "data-desk-panel": "open", "data-desk-expanded": "", "data-desk-widths": "" });
  assert.equal(r.props["--desk-measure"], "50");
  assert.equal(r.props["--desk-width"], "360px");
  assert.equal(MOVE_PROP in r.props, false);
  const expandedRun = run({ stored: { "lit-desk-preview": "on", "lit-desk-panel": "open", "lit-desk-min": "0" }, session });
  assert.deepEqual(r.attrs, expandedRun.attrs);
  assert.deepEqual(r.props, expandedRun.props);
});

test("a dragged width is not applied while the notebook is closed", () => {
  const r = run({
    stored: { "lit-desk-preview": "on", "lit-desk-panel": "closed" },
    session: { "lit-desk-measure": "50", "lit-desk-width": "360" },
  });
  assert.deepEqual(r.attrs, { "data-desk": "on" });
  assert.deepEqual(r.props, {});
});

test("a dragged width under MIN_WIDTH, or not a number, sets nothing", () => {
  const stored = { "lit-desk-preview": "on", "lit-desk-panel": "open", "lit-desk-min": "0" };
  const cases = [
    { "lit-desk-measure": "50", "lit-desk-width": "200" },
    { "lit-desk-measure": "wide", "lit-desk-width": "360" },
    { "lit-desk-measure": "50", "lit-desk-width": "tall" },
    { "lit-desk-measure": "Infinity", "lit-desk-width": "360" },
    { "lit-desk-measure": "50", "lit-desk-width": "Infinity" },
  ];
  for (const session of cases) {
    const r = run({ stored, session });
    assert.deepEqual(r.attrs, { "data-desk": "on", "data-desk-panel": "open", "data-desk-expanded": "" }, JSON.stringify(session));
    assert.deepEqual(r.props, {}, JSON.stringify(session));
  }
});

// SZ-17: the text drags only within 45 to 75 of the face's characters, so a
// measure kept in one face can be outside another's range once the reader
// changes the face. widths.js holds it to the range (placeWithWidths), and so
// does the script, or the page would paint one column and then draw another.
test("a measure outside the face's range is held to it, as widths.js holds it", () => {
  const stored = { "lit-desk-preview": "on", "lit-desk-panel": "open", "lit-desk-min": "0" };
  for (const [font, kept, held] of [["", 30, 37.8], ["", 80, 62.8], ["atkinson", 60, 51.3], ["dyslexic", 40, 48]]) {
    const html = font ? { "data-font": font } : {};
    const session = { "lit-desk-measure": String(kept), "lit-desk-width": "360" };
    const r = run({ stored, session, html, viewport: 1800 });
    const at = JSON.stringify({ font, kept });
    assert.equal(r.props["--desk-measure"], String(held), at);
    assert.equal(r.attrs["data-desk-widths"], "", at);
    const want = firstPaint({ viewport: 1800, ch: chPx({ font }), kept: { measure: kept, width: 360 }, range: measureRange(font) });
    assert.deepEqual(r.props, stamps(want), at);
  }
});

test("without the desk on, a dragged width is not applied even with the notebook open", () => {
  const r = run({
    stored: { "lit-desk-panel": "open" },
    session: { "lit-desk-measure": "50", "lit-desk-width": "360" },
  });
  assert.deepEqual(r.attrs, {});
  assert.deepEqual(r.props, {});
});

test("?desk=on sets the flag and leaves the address, keeping the rest of it", () => {
  const r = run({ href: "https://litbible.net/romans-8/?desk=on&x=1#v3" });
  assert.equal(r.stored["lit-desk-preview"], "on");
  assert.equal(r.attrs["data-desk"], "on");
  assert.deepEqual(r.replaced, ["/romans-8/?x=1#v3"]);
});

test("?desk=off clears it, and the remembered panel with it", () => {
  const r = run({ href: "https://litbible.net/?desk=off", stored: { "lit-desk-preview": "on", "lit-desk-panel": "open" } });
  assert.equal("lit-desk-preview" in r.stored, false);
  assert.equal("lit-desk-panel" in r.stored, false);
  assert.deepEqual(r.attrs, {});
  assert.deepEqual(r.replaced, ["/"]);
});

test("any other value is left alone, address included", () => {
  const r = run({ href: "https://litbible.net/?desk=yes" });
  assert.deepEqual(r.stored, {});
  assert.deepEqual(r.replaced, []);
});

/* ── ?account=, on every page ───────────────────────────────────────────── */

// It was read only on the account pages at first, so on the home page it stayed in the
// address and opened nothing (BVJ, 2026-11-25). The script reads it wherever it runs.
test("?account=preview on any page opens accounts in this browser and leaves the address", () => {
  // The home page, with the Study Desk already on: what BVJ did.
  const home = run({ surface: "home", href: "https://litbible.net/?account=preview", stored: { "lit-desk-preview": "on" } });
  assert.equal(home.stored[SWITCH_KEY], "preview");
  assert.deepEqual(home.attrs, { "data-account": "open", "data-desk": "on" }, "so the header's “Sign in” is in the row from first paint");
  assert.deepEqual(home.replaced, ["/"]);

  // A chapter, keeping the rest of the address.
  const chapter = run({ href: "https://litbible.net/romans-8/?account=preview&x=1#v3" });
  assert.equal(chapter.stored[SWITCH_KEY], "preview");
  assert.deepEqual(chapter.attrs, { "data-account": "open" });
  assert.deepEqual(chapter.replaced, ["/romans-8/?x=1#v3"]);

  // A phone: accounts open there too (its basics), with no desk.
  const phone = run({ href: "https://litbible.net/about/?account=preview", ua: UA.iphone, touch: 5 });
  assert.equal(phone.stored[SWITCH_KEY], "preview");
  assert.deepEqual(phone.attrs, { "data-account": "open" });
  assert.deepEqual(phone.replaced, ["/about/"]);
});

test("the script stores the switch under the words module's key, for each of its values", () => {
  for (const value of SWITCH_VALUES) {
    const r = run({ href: `https://litbible.net/?${SWITCH_PARAM}=${value}` });
    assert.deepEqual(r.stored, { [SWITCH_KEY]: value }, value);
    assert.deepEqual(r.attrs, { "data-account": "open" }, value);
    assert.deepEqual(r.replaced, ["/"], value);
  }
});

test("?account=off closes accounts again, on any page", () => {
  const r = run({ href: "https://litbible.net/glossary/?account=off", surface: "glossary", stored: { [SWITCH_KEY]: "preview", "lit-desk-preview": "on" } });
  assert.equal(SWITCH_KEY in r.stored, false);
  assert.equal("data-account" in r.attrs, false);
  assert.equal(r.attrs["data-desk"], "on", "the Study Desk's own switch is untouched");
  assert.deepEqual(r.replaced, ["/glossary/"]);
});

test("?desk= and ?account= together are both read, and the address is rewritten once", () => {
  const r = run({ surface: "home", href: "https://litbible.net/?desk=on&account=preview&x=1" });
  assert.equal(r.stored["lit-desk-preview"], "on");
  assert.equal(r.stored[SWITCH_KEY], "preview");
  assert.deepEqual(r.attrs, { "data-account": "open", "data-desk": "on" });
  assert.deepEqual(r.replaced, ["/?x=1"]);

  const off = run({ href: "https://litbible.net/?account=off&desk=off", stored: { [SWITCH_KEY]: "local", "lit-desk-preview": "on" } });
  assert.deepEqual(off.stored, {});
  assert.deepEqual(off.attrs, {});
  assert.deepEqual(off.replaced, ["/"]);
});

test("an ?account= value the switch doesn't know is left alone, address and storage both", () => {
  const r = run({ href: "https://litbible.net/?account=yes", stored: { [SWITCH_KEY]: "preview" } });
  assert.deepEqual(r.stored, { [SWITCH_KEY]: "preview" });
  assert.deepEqual(r.replaced, []);
  assert.deepEqual(r.attrs, { "data-account": "open" }, "what was stored before still stands");

  const none = run({ href: "https://litbible.net/?account=" });
  assert.deepEqual(none.stored, {});
  assert.deepEqual(none.replaced, []);
});

/* ── Only where the window holds it (BA25, BA30) ─────────────────────── */

const expandedStart = { "lit-desk-preview": "on", "lit-desk-min": "0" };

/** px per measure unit on Chapter View, as the script works it out. */
function chPx({ font = "", size = "", rootPx = 16 } = {}) {
  return FIRST_PAINT.ch[font] * FIRST_PAINT.scale[size] * FIRST_PAINT.body * rootPx;
}

/**
 * What the script puts on <html>'s inline style for a Chapter View chapter,
 * from firstPaint's answer: the widths, the column's move left as a whole
 * translate (MOVE_PROP), and the column's center wherever it isn't the
 * window's.
 */
function stamps(want) {
  const props = {};
  if (want.widths) {
    props["--desk-measure"] = String(want.widths.measure);
    props["--desk-width"] = `${want.widths.width}px`;
  }
  if (want.shift) props[MOVE_PROP] = `${-want.shift}px 0`;
  if (want.center !== null) props["--desk-bar-center"] = `${want.center}px`;
  return props;
}

test("in a window too narrow for the margin, the notebook is still stamped expanded, unmoved (BS-15, once BA25)", () => {
  // 280 + 16 + 24 + 38 + 48 × 0.497 × 1.33 × 16 + 32 ≈ 897.66 at the default font and
  // size: the notebook, its edge and gap, the margin the column keeps on its
  // left for a footnote's Pin (E81), and the column.
  // Where it floats it is stamped expanded all the same, with no move: the
  // folded tab and its few pixels come with the first placement.
  const narrowRun = run({ stored: expandedStart, viewport: 897 });
  assert.deepEqual(narrowRun.attrs, { "data-desk": "on", "data-desk-panel": "open", "data-desk-expanded": "" });
  assert.deepEqual(narrowRun.props, {});
  assert.deepEqual(run({ stored: expandedStart, viewport: 898 }).attrs, { "data-desk": "on", "data-desk-panel": "open", "data-desk-expanded": "" });
  assert.ok(MOVE_PROP in run({ stored: expandedStart, viewport: 898 }).props, "from 898px the margin holds it, with the column moved");
  // What counts is the width less the scrollbar, which the script measures.
  assert.equal(MOVE_PROP in run({ stored: expandedStart, viewport: 897, scrollbar: 0 }).props, false);
  assert.equal(MOVE_PROP in run({ stored: expandedStart, viewport: 898, scrollbar: 0 }).props, true);
  assert.equal("data-desk-expanded" in run({ stored: expandedStart, viewport: 897, scrollbar: 0 }).attrs, true);
  // A larger text size widens the column, so a half-screen window floats it.
  const lg = { "data-size": "lg" };
  assert.equal(MOVE_PROP in run({ stored: expandedStart, viewport: 945, html: lg }).props, false);
  assert.equal(MOVE_PROP in run({ stored: expandedStart, viewport: 1000, html: lg }).props, true);
  assert.equal("data-desk-expanded" in run({ stored: expandedStart, viewport: 945, html: lg }).attrs, true);
});

test("widths kept in a wider window are given way as widths.js gives them, or left off (BA30)", () => {
  const session = { "lit-desk-measure": "60", "lit-desk-width": "600" };
  const wide = run({ stored: expandedStart, session, viewport: 1440 });
  assert.equal(wide.props["--desk-measure"], "60");
  assert.equal(wide.props["--desk-width"], "600px");
  const mid = run({ stored: expandedStart, session, viewport: 1085 });
  const want = firstPaint({ viewport: 1085, ch: chPx(), kept: { measure: 60, width: 600 } });
  assert.ok(want.widths.width < 600);
  assert.deepEqual(mid.props, stamps(want));
  assert.equal(mid.props["--desk-measure"], String(want.widths.measure));
  assert.equal(mid.props["--desk-width"], `${want.widths.width}px`);
  assert.equal(mid.attrs["data-desk-widths"], "");
  // Too narrow for even the narrowest widths: none, and the 48 column floats,
  // still stamped expanded (BS-15) but unmoved.
  const narrow = run({ stored: expandedStart, session, viewport: 600 });
  assert.deepEqual(narrow.props, {});
  assert.deepEqual(narrow.attrs, { "data-desk": "on", "data-desk-panel": "open", "data-desk-expanded": "" });
  // A minimized notebook is given the same widths, the same way (BS-15).
  assert.deepEqual(run({ stored: { "lit-desk-preview": "on" }, session, viewport: 1085 }).props, mid.props);
});

test("the script decides as firstPaint does, for every font, size and window", () => {
  // Each face's range has its ends among these (SZ-17): 30.8 to 51.3 in
  // Atkinson, 37.8 to 62.8 by default, 48 to 110.4 in OpenDyslexic.
  const keptCases = [
    null, { measure: 48, width: 300 }, { measure: 60, width: 440 }, { measure: 72, width: 600 }, { measure: 36, width: 280 },
    { measure: 110, width: 320 },
  ];
  for (const font of Object.keys(FIRST_PAINT.ch)) {
    for (const size of Object.keys(FIRST_PAINT.scale)) {
      for (const rootPx of [16, 20]) {
        const html = { ...(font ? { "data-font": font } : {}), ...(size ? { "data-size": size } : {}) };
        const ch = chPx({ font, size, rootPx });
        const range = measureRange(font);
        for (const kept of keptCases) {
          const session = kept ? { "lit-desk-measure": String(kept.measure), "lit-desk-width": String(kept.width) } : {};
          for (let viewport = 600; viewport <= 1800; viewport += 7) {
            const r = run({ stored: expandedStart, session, viewport, html, rootPx });
            const want = firstPaint({ viewport, ch, kept, range });
            const at = JSON.stringify({ font, size, rootPx, kept, viewport });
            assert.equal("data-desk-expanded" in r.attrs, want.expanded, at);
            assert.equal("data-desk-widths" in r.attrs, Boolean(want.widths), at);
            assert.deepEqual(r.props, stamps(want), at);
          }
        }
      }
    }
  }
});

/* ── Painted once, in place (E137) ───────────────────────────────────── */

// BVJ, 2026-11-17, clicking from chapter to chapter with the Notebook open in
// a window about 1120px wide: the page loaded "without the notebook and then a
// second later adds the notebook," the text shifting back and forth. The
// column's move left came only with the desk's code. Now the script stamps it.

const FONTS = { "Source Sans 3": "", OpenDyslexic: "dyslexic" };
const SIZES = { Medium: "", "Extra large": "xl" };
// A 1024px, an 1100px and a 1280px window, each less a 15px scrollbar.
const WINDOWS = [1024, 1100, 1280];

test("E137: the move left is stamped before paint exactly as placeInMargin will make it", () => {
  // The moves a reader gets, by window, at the default root size.
  const expected = {
    "Source Sans 3 Medium": [85, 47, 0],
    "Source Sans 3 Extra large": [null, 118, 28], // null: too narrow, the notebook floats and folds
    "OpenDyslexic Medium": [87, 49, 0],
    "OpenDyslexic Extra large": [null, 120, 30],
  };
  for (const [fontName, font] of Object.entries(FONTS)) {
    for (const [sizeName, size] of Object.entries(SIZES)) {
      const html = { ...(font ? { "data-font": font } : {}), ...(size ? { "data-size": size } : {}) };
      const ch = chPx({ font, size });
      const width = FIRST_PAINT.measure * ch + FIRST_PAINT.pad;
      WINDOWS.forEach((win, i) => {
        const at = `${fontName} ${sizeName} ${win}`;
        const viewport = win - 15;
        const r = run({ stored: expandedStart, viewport, scrollbar: 15, html });
        // The first placement, from the page as it would be measured: the
        // column centered in the window, nothing moved yet.
        const left = (viewport - width) / 2;
        const placed = placeInMargin({ viewport, column: { left, right: left + width }, main: { left: 0 }, keepLeft: KEEP_LEFT });
        const shift = expected[`${fontName} ${sizeName}`][i];
        if (shift === null) {
          assert.equal(placed.over, true, at);
          assert.deepEqual(r.attrs, { "data-desk": "on", "data-desk-panel": "open", "data-desk-expanded": "" }, at);
          assert.deepEqual(r.props, {}, at);
          return;
        }
        assert.equal(placed.over, false, at);
        assert.equal(placed.shift, shift, at);
        assert.equal("data-desk-expanded" in r.attrs, true, at);
        if (shift === 0) {
          // Wide enough: nothing moves, and nothing new is stamped.
          assert.deepEqual(r.props, {}, at);
          return;
        }
        assert.deepEqual(r.props, { [MOVE_PROP]: `${-shift}px 0`, "--desk-bar-center": `${viewport / 2 - shift}px` }, at);
        // The move is the one the placement makes from the moved column too,
        // which is how margin.js meets it: measured moved, with `shift` given.
        const again = placeInMargin({
          viewport, column: { left: left - shift, right: left - shift + width }, main: { left: 0 }, shift, keepLeft: KEEP_LEFT,
        });
        assert.equal(again.shift, shift, at);
        // And the stamped center is the moved column's, as margin.js measures it.
        const center = (left - shift + (left - shift + width)) / 2;
        assert.ok(Math.abs(parseFloat(r.props["--desk-bar-center"]) - center) < 1e-9, at);
      });
    }
  }
});

test("E137: every font, size and window gets the move placeInMargin makes", () => {
  for (const font of Object.keys(FIRST_PAINT.ch)) {
    for (const size of Object.keys(FIRST_PAINT.scale)) {
      const html = { ...(font ? { "data-font": font } : {}), ...(size ? { "data-size": size } : {}) };
      const ch = chPx({ font, size });
      const width = FIRST_PAINT.measure * ch + FIRST_PAINT.pad;
      for (let viewport = 700; viewport <= 1500; viewport += 1) {
        const r = run({ stored: expandedStart, viewport, html });
        const left = (viewport - width) / 2;
        const placed = placeInMargin({ viewport, column: { left, right: left + width }, main: { left: 0 }, keepLeft: KEEP_LEFT });
        const at = JSON.stringify({ font, size, viewport });
        assert.equal("data-desk-expanded" in r.attrs, true, at); // BS-15: even where it floats
        const stamped = MOVE_PROP in r.props ? -parseFloat(r.props[MOVE_PROP]) : 0;
        assert.equal(stamped, placed.over ? 0 : placed.shift, at);
        assert.equal("--desk-bar-center" in r.props, stamped > 0, at);
      }
    }
  }
});

test("BS-15: a minimized Notebook is stamped exactly as an expanded one; nothing for a closed one or with the desk off", () => {
  // 1009px: where an open notebook moves the column 85px.
  const moved = run({ stored: expandedStart, viewport: 1009 });
  assert.equal(moved.props[MOVE_PROP], "-85px 0");
  const minimized = [
    { "lit-desk-preview": "on" }, // open and minimized, the default
    { "lit-desk-preview": "on", "lit-desk-min": "1" },
    { "lit-desk-preview": "on", "lit-desk-min": "0", "lit-desk-start": "min" },
  ];
  for (const stored of minimized) {
    const r = run({ stored, viewport: 1009 });
    assert.deepEqual(r.props, moved.props, JSON.stringify(stored));
    assert.deepEqual(r.attrs, moved.attrs, JSON.stringify(stored));
    assert.equal("data-desk-expanded" in r.attrs, true, JSON.stringify(stored));
  }
  const states = [
    { "lit-desk-preview": "on", "lit-desk-min": "0", "lit-desk-panel": "closed" },
    { "lit-desk-preview": "on", "lit-desk-min": "0", "lit-desk-start": "closed" },
    { "lit-desk-min": "0" }, // the desk off
  ];
  for (const stored of states) {
    const r = run({ stored, viewport: 1009 });
    assert.deepEqual(r.props, {}, JSON.stringify(stored));
    assert.equal("data-desk-expanded" in r.attrs, false, JSON.stringify(stored));
  }
  // A phone or tablet never has the desk.
  assert.deepEqual(run({ ua: UA.iphone, touch: 5, stored: expandedStart, viewport: 1009 }).props, {});
  assert.deepEqual(run({ ua: UA.mac, touch: 5, stored: expandedStart, viewport: 1009 }).props, {});
});

test("E137: the reader's widths stamp the column's center, since they leave it off center, and no move", () => {
  const session = { "lit-desk-measure": "50", "lit-desk-width": "360" };
  for (const viewport of [1009, 1085, 1265, 1440]) {
    const r = run({ stored: expandedStart, session, viewport });
    const want = firstPaint({ viewport, ch: chPx(), kept: { measure: 50, width: 360 } });
    assert.ok(want.widths, String(viewport));
    assert.equal(MOVE_PROP in r.props, false, String(viewport));
    // The column ends GAP before the notebook, which ends EDGE before the window's edge.
    const right = viewport - EDGE - want.widths.width - GAP;
    const columnWidth = want.widths.measure * chPx() + FIRST_PAINT.pad;
    assert.ok(Math.abs(parseFloat(r.props["--desk-bar-center"]) - (right - columnWidth / 2)) < 1e-9, String(viewport));
    assert.deepEqual(r.props, stamps(want), String(viewport));
  }
});
