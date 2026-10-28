// test/desk-prepaint.test.js
//
// The Study Desk's switch in Layout.astro's pre-paint script. It can't import,
// so it repeats src/lib/app-platform.mjs's test; this runs the script itself,
// as written in Layout.astro, against the same devices isAppPlatform is tested
// on, so the two can't drift apart. It also checks the preview link: ?desk=on
// and ?desk=off set the flag and leave the address. It also checks that a width
// dragged in the notebook (sessionStorage) is stamped only while the notebook is
// open, the desk is on, and the values are in range, and that the notebook is
// stamped expanded, and the widths applied, only where the window holds them
// (BA25, BA30): the script repeats src/lib/desk-margin.mjs's firstPaint.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { APP_PLATFORM_UA, isAppPlatform } from "../src/lib/app-platform.mjs";
import { isAppPlatform as gateIsAppPlatform } from "../src/scripts/announcement-gate.js";
import { EDGE, FIRST_PAINT, GAP, MAX_MEASURE, MIN_MEASURE, MIN_WIDTH, firstPaint } from "../src/lib/desk-margin.mjs";

const layout = readFileSync(new URL("../src/layouts/Layout.astro", import.meta.url), "utf8");
const match = /define:vars=\{\{ appUa: APP_PLATFORM_UA\.source, appUaFlags: APP_PLATFORM_UA\.flags, deskFit \}\}>([\s\S]*?)<\/script>/.exec(layout);
// What Layout.astro hands the script.
const deskFit = { ...FIRST_PAINT, edge: EDGE, gap: GAP, minWidth: MIN_WIDTH, minMeasure: MIN_MEASURE, maxMeasure: MAX_MEASURE };

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
 */
function run({
  href = "https://litbible.net/romans-8/", ua = UA.windows, touch = 0, uaData = undefined, stored = {}, session = {},
  viewport = 1440, scrollbar = 15, html = {}, rootPx = 16,
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

test("an open notebook is stamped before paint; only an expanded one is marked as making room", () => {
  const open = run({ stored: { "lit-desk-preview": "on", "lit-desk-panel": "open" } });
  assert.deepEqual(open.attrs, { "data-desk": "on", "data-desk-panel": "open" });
  // It starts open (and minimized) until the reader closes it (BVJ, 2026-10-13).
  const fresh = run({ stored: { "lit-desk-preview": "on" } });
  assert.deepEqual(fresh.attrs, { "data-desk": "on", "data-desk-panel": "open" });
  const closed = run({ stored: { "lit-desk-preview": "on", "lit-desk-panel": "closed" } });
  assert.deepEqual(closed.attrs, { "data-desk": "on" });
  // A start the reader chose on the notebook page wins (src/lib/desk-start.mjs).
  const chosenClosed = run({ stored: { "lit-desk-preview": "on", "lit-desk-panel": "open", "lit-desk-start": "closed" } });
  assert.deepEqual(chosenClosed.attrs, { "data-desk": "on" });
  for (const start of ["min", "open"]) {
    const r = run({ stored: { "lit-desk-preview": "on", "lit-desk-panel": "closed", "lit-desk-start": start } });
    assert.deepEqual(r.attrs["data-desk-panel"], "open", start);
  }
  // Minimized, it is open but narrows nothing: data-desk-expanded (what global.css
  // keys the 48 measure on) is stamped only when it starts expanded (BVJ, 2026-10-14).
  const expanded = run({ stored: { "lit-desk-preview": "on", "lit-desk-min": "0" } });
  assert.deepEqual(expanded.attrs, { "data-desk": "on", "data-desk-panel": "open", "data-desk-expanded": "" });
  const chosenOpen = run({ stored: { "lit-desk-preview": "on", "lit-desk-start": "open" } });
  assert.deepEqual(chosenOpen.attrs, { "data-desk": "on", "data-desk-panel": "open", "data-desk-expanded": "" });
  const chosenMin = run({ stored: { "lit-desk-preview": "on", "lit-desk-start": "min", "lit-desk-min": "0" } });
  assert.deepEqual(chosenMin.attrs, { "data-desk": "on", "data-desk-panel": "open" });
  const phone = run({ ua: UA.iphone, touch: 5, stored: { "lit-desk-preview": "on", "lit-desk-panel": "open" } });
  assert.deepEqual(phone.attrs, {});
});

test("a width dragged in the notebook is stamped before paint, with its measure", () => {
  const r = run({
    stored: { "lit-desk-preview": "on", "lit-desk-panel": "open", "lit-desk-min": "0" },
    session: { "lit-desk-measure": "50", "lit-desk-width": "360" },
  });
  assert.deepEqual(r.attrs, { "data-desk": "on", "data-desk-panel": "open", "data-desk-expanded": "", "data-desk-widths": "" });
  assert.equal(r.props["--desk-measure"], "50");
  assert.equal(r.props["--desk-width"], "360px");
});

test("a dragged width is not applied while the notebook is minimized", () => {
  const r = run({
    stored: { "lit-desk-preview": "on", "lit-desk-panel": "open" },
    session: { "lit-desk-measure": "50", "lit-desk-width": "360" },
  });
  assert.deepEqual(r.attrs, { "data-desk": "on", "data-desk-panel": "open" });
  assert.deepEqual(r.props, {});
});

test("a dragged width is not applied while the notebook is closed", () => {
  const r = run({
    stored: { "lit-desk-preview": "on", "lit-desk-panel": "closed" },
    session: { "lit-desk-measure": "50", "lit-desk-width": "360" },
  });
  assert.deepEqual(r.attrs, { "data-desk": "on" });
  assert.deepEqual(r.props, {});
});

test("a dragged width outside its range, or not a number, sets nothing", () => {
  const stored = { "lit-desk-preview": "on", "lit-desk-panel": "open", "lit-desk-min": "0" };
  const cases = [
    { "lit-desk-measure": "30", "lit-desk-width": "360" },
    { "lit-desk-measure": "80", "lit-desk-width": "360" },
    { "lit-desk-measure": "50", "lit-desk-width": "200" },
    { "lit-desk-measure": "wide", "lit-desk-width": "360" },
    { "lit-desk-measure": "50", "lit-desk-width": "tall" },
  ];
  for (const session of cases) {
    const r = run({ stored, session });
    assert.deepEqual(r.attrs, { "data-desk": "on", "data-desk-panel": "open", "data-desk-expanded": "" }, JSON.stringify(session));
    assert.deepEqual(r.props, {}, JSON.stringify(session));
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

/* ── Only where the window holds it (BA25, BA30) ─────────────────────── */

const expandedStart = { "lit-desk-preview": "on", "lit-desk-min": "0" };

/** px per measure unit on Study View, as the script works it out. */
function chPx({ font = "", size = "", rootPx = 16 } = {}) {
  return FIRST_PAINT.ch[font] * FIRST_PAINT.scale[size] * FIRST_PAINT.body * rootPx;
}

test("in a window too narrow for the margin, the notebook isn't stamped expanded (BA25)", () => {
  // 280 + 16 + 24 + 48 × 0.63086 × 18 + 32 ≈ 897.06 at the default font and size,
  // the width at which the notebook was seen to float in the browser.
  assert.deepEqual(run({ stored: expandedStart, viewport: 897 }).attrs, { "data-desk": "on", "data-desk-panel": "open" });
  assert.deepEqual(run({ stored: expandedStart, viewport: 898 }).attrs, { "data-desk": "on", "data-desk-panel": "open", "data-desk-expanded": "" });
  // What counts is the width less the scrollbar, which the script measures.
  assert.equal("data-desk-expanded" in run({ stored: expandedStart, viewport: 897, scrollbar: 0 }).attrs, false);
  assert.equal("data-desk-expanded" in run({ stored: expandedStart, viewport: 898, scrollbar: 0 }).attrs, true);
  // A larger text size widens the column, so a half-screen window floats it.
  const lg = { "data-size": "lg" };
  assert.equal("data-desk-expanded" in run({ stored: expandedStart, viewport: 945, html: lg }).attrs, false);
  assert.equal("data-desk-expanded" in run({ stored: expandedStart, viewport: 985, html: lg }).attrs, true);
});

test("widths kept in a wider window are given way as widths.js gives them, or left off (BA30)", () => {
  const session = { "lit-desk-measure": "60", "lit-desk-width": "600" };
  const wide = run({ stored: expandedStart, session, viewport: 1440 });
  assert.deepEqual(wide.props, { "--desk-measure": "60", "--desk-width": "600px" });
  const mid = run({ stored: expandedStart, session, viewport: 1085 });
  const want = firstPaint({ viewport: 1085, ch: chPx(), kept: { measure: 60, width: 600 } });
  assert.ok(want.widths.width < 600);
  assert.deepEqual(mid.props, { "--desk-measure": String(want.widths.measure), "--desk-width": `${want.widths.width}px` });
  assert.equal(mid.attrs["data-desk-widths"], "");
  // Too narrow for even the narrowest widths: none, and the 48 column floats.
  const narrow = run({ stored: expandedStart, session, viewport: 600 });
  assert.deepEqual(narrow.props, {});
  assert.deepEqual(narrow.attrs, { "data-desk": "on", "data-desk-panel": "open" });
});

test("the script decides as firstPaint does, for every font, size and window", () => {
  const keptCases = [null, { measure: 48, width: 300 }, { measure: 60, width: 440 }, { measure: 72, width: 600 }, { measure: 36, width: 280 }];
  for (const font of Object.keys(FIRST_PAINT.ch)) {
    for (const size of Object.keys(FIRST_PAINT.scale)) {
      for (const rootPx of [16, 20]) {
        const html = { ...(font ? { "data-font": font } : {}), ...(size ? { "data-size": size } : {}) };
        const ch = chPx({ font, size, rootPx });
        for (const kept of keptCases) {
          const session = kept ? { "lit-desk-measure": String(kept.measure), "lit-desk-width": String(kept.width) } : {};
          for (let viewport = 600; viewport <= 1800; viewport += 7) {
            const r = run({ stored: expandedStart, session, viewport, html, rootPx });
            const want = firstPaint({ viewport, ch, kept });
            const at = JSON.stringify({ font, size, rootPx, kept, viewport });
            assert.equal("data-desk-expanded" in r.attrs, want.expanded, at);
            assert.equal("data-desk-widths" in r.attrs, Boolean(want.widths), at);
            const props = want.widths ? { "--desk-measure": String(want.widths.measure), "--desk-width": `${want.widths.width}px` } : {};
            assert.deepEqual(r.props, props, at);
          }
        }
      }
    }
  }
});
