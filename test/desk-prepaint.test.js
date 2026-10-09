// test/desk-prepaint.test.js
//
// The Study Desk's switch in Layout.astro's pre-paint script. It can't import,
// so it repeats src/lib/app-platform.mjs's test; this runs the script itself,
// as written in Layout.astro, against the same devices isAppPlatform is tested
// on, so the two can't drift apart. It also checks the preview link: ?desk=on
// and ?desk=off set the flag and leave the address. It also checks that a width
// dragged in the notebook (sessionStorage) is stamped only while the notebook is
// open, the desk is on, and the values are in range.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { APP_PLATFORM_UA, isAppPlatform } from "../src/lib/app-platform.mjs";
import { isAppPlatform as gateIsAppPlatform } from "../src/scripts/announcement-gate.js";

const layout = readFileSync(new URL("../src/layouts/Layout.astro", import.meta.url), "utf8");
const match = /define:vars=\{\{ appUa: APP_PLATFORM_UA\.source, appUaFlags: APP_PLATFORM_UA\.flags \}\}>([\s\S]*?)<\/script>/.exec(layout);

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
};

/**
 * Run the script with a fake page; returns what it left behind. `session` is the
 * page's sessionStorage at load (the notebook's widths from this visit), and
 * `props` is what the script set on the page's inline style.
 */
function run({ href = "https://litbible.net/romans-8/", ua = UA.windows, touch = 0, stored = {}, session = {} } = {}) {
  const attrs = {};
  const props = {};
  const store = new Map(Object.entries(stored));
  const sessionStore = new Map(Object.entries(session));
  const replaced = [];
  const page = {
    document: {
      documentElement: {
        setAttribute: (k, v) => { attrs[k] = v; },
        style: { setProperty: (k, v) => { props[k] = v; } },
      },
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
    navigator: { userAgent: ua, maxTouchPoints: touch },
  };
  const fn = new Function("appUa", "appUaFlags", ...Object.keys(page), match[1]);
  fn(APP_PLATFORM_UA.source, APP_PLATFORM_UA.flags, ...Object.values(page));
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
  ];
  for (const [ua, touch] of devices) {
    const { attrs } = run({ ua, touch, stored: { "lit-desk-preview": "on" } });
    const computer = !isAppPlatform({ userAgent: ua, maxTouchPoints: touch });
    assert.equal(attrs["data-desk"] === "on", computer, ua);
  }
});

test("without the flag, nothing is set", () => {
  assert.deepEqual(run().attrs, {});
  assert.deepEqual(run({ stored: { "lit-desk-panel": "open" } }).attrs, {});
});

test("a notebook left open is stamped before paint, since Study View chapters narrow to 48 with it", () => {
  const open = run({ stored: { "lit-desk-preview": "on", "lit-desk-panel": "open" } });
  assert.deepEqual(open.attrs, { "data-desk": "on", "data-desk-panel": "open" });
  const closed = run({ stored: { "lit-desk-preview": "on" } });
  assert.deepEqual(closed.attrs, { "data-desk": "on" });
  const phone = run({ ua: UA.iphone, touch: 5, stored: { "lit-desk-preview": "on", "lit-desk-panel": "open" } });
  assert.deepEqual(phone.attrs, {});
});

test("a width dragged in the notebook is stamped before paint, with its measure", () => {
  const r = run({
    stored: { "lit-desk-preview": "on", "lit-desk-panel": "open" },
    session: { "lit-desk-measure": "50", "lit-desk-width": "360" },
  });
  assert.deepEqual(r.attrs, { "data-desk": "on", "data-desk-panel": "open", "data-desk-widths": "" });
  assert.equal(r.props["--desk-measure"], "50");
  assert.equal(r.props["--desk-width"], "360px");
});

test("a dragged width is not applied while the notebook is closed", () => {
  const r = run({
    stored: { "lit-desk-preview": "on" },
    session: { "lit-desk-measure": "50", "lit-desk-width": "360" },
  });
  assert.deepEqual(r.attrs, { "data-desk": "on" });
  assert.deepEqual(r.props, {});
});

test("a dragged width outside its range, or not a number, sets nothing", () => {
  const stored = { "lit-desk-preview": "on", "lit-desk-panel": "open" };
  const cases = [
    { "lit-desk-measure": "30", "lit-desk-width": "360" },
    { "lit-desk-measure": "80", "lit-desk-width": "360" },
    { "lit-desk-measure": "50", "lit-desk-width": "200" },
    { "lit-desk-measure": "wide", "lit-desk-width": "360" },
    { "lit-desk-measure": "50", "lit-desk-width": "tall" },
  ];
  for (const session of cases) {
    const r = run({ stored, session });
    assert.deepEqual(r.attrs, { "data-desk": "on", "data-desk-panel": "open" }, JSON.stringify(session));
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
