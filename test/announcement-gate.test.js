// test/announcement-gate.test.js
//
// Unit tests for src/scripts/announcement-gate.js, the rules every site
// announcement shares (audit F5). It is a browser module that reads
// sessionStorage, document, location and navigator when it is called, so
// each test installs small fakes on globalThis and restores them after.

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  countPageview,
  hasCookie,
  isVerseDeepLink,
  isOverScripture,
  isAppPlatform,
  shouldAnnounce,
} from "../src/scripts/announcement-gate.js";

const GLOBALS = ["sessionStorage", "document", "location", "navigator"];
let saved;

function install(name, value) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

/** A page the gate would allow: second pageview, no cookie, not scripture. */
function page({ pv = 1, cookie = "", hash = "", pathname = "/about/", scripture = false } = {}) {
  install("sessionStorage", memoryStorage({ lit_pv: String(pv) }));
  install("document", {
    cookie,
    querySelector: () => (scripture ? {} : null),
  });
  install("location", { hash, pathname });
}

beforeEach(() => {
  saved = GLOBALS.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
});

afterEach(() => {
  for (const [name, desc] of saved) {
    if (desc) Object.defineProperty(globalThis, name, desc);
    else delete globalThis[name];
  }
});

/* ── countPageview ─────────────────────────────────────────────────────── */

test("countPageview counts up from nothing and stores the total", () => {
  install("sessionStorage", memoryStorage());
  assert.equal(countPageview(), 1);
  assert.equal(countPageview(), 2);
  assert.equal(sessionStorage.getItem("lit_pv"), "2");
});

test("countPageview treats unusable storage as a first pageview", () => {
  install("sessionStorage", {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  });
  assert.equal(countPageview(), 1);
});

/* ── hasCookie ─────────────────────────────────────────────────────────── */

test("hasCookie finds a cookie by exact name, wherever it sits", () => {
  install("document", { cookie: "a=1; lit_apps_launch_v1=1; b=2" });
  assert.equal(hasCookie("lit_apps_launch_v1"), true);
  assert.equal(hasCookie("a"), true);
  assert.equal(hasCookie("lit_apps_launch"), false);
  assert.equal(hasCookie("lit_apps_launch_v"), false);
});

test("hasCookie is false with no cookies", () => {
  install("document", { cookie: "" });
  assert.equal(hasCookie("lit_apps_launch_v1"), false);
});

/* ── isVerseDeepLink ───────────────────────────────────────────────────── */

test("isVerseDeepLink: every link a reader can share into scripture", () => {
  for (const hash of ["#v16", "#v16-17", "#john-8-p9", "#john-3-v16", "#1corinthians-13-v4"]) {
    assert.equal(isVerseDeepLink(hash), true, hash);
  }
});

test("isVerseDeepLink: other anchors are not verse links", () => {
  for (const hash of ["", "#", "#v", "#fn-a", "#fnref-a", "#ch-3", "#top", "#john-3", "#go-deeper-title"]) {
    assert.equal(isVerseDeepLink(hash), false, hash);
  }
});

test("isVerseDeepLink reads location.hash by default", () => {
  page({ hash: "#v16" });
  assert.equal(isVerseDeepLink(), true);
});

/* ── isOverScripture ───────────────────────────────────────────────────── */

test("isOverScripture asks for a Study View chapter or intro, or Read View", () => {
  let asked = "";
  const root = { querySelector: (sel) => ((asked = sel), null) };
  assert.equal(isOverScripture(root), false);
  for (const cls of [".scripture-layout--scripture", ".scripture-layout--intro", ".rm-page"]) {
    assert.ok(asked.includes(cls), cls);
  }
  assert.equal(isOverScripture({ querySelector: () => ({}) }), true);
});

/* ── isAppPlatform ─────────────────────────────────────────────────────── */

const UA = {
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  android:
    "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  linux: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
};

test("isAppPlatform: iPhone and Android are app platforms", () => {
  assert.equal(isAppPlatform({ userAgent: UA.iphone, maxTouchPoints: 5 }), true);
  assert.equal(isAppPlatform({ userAgent: UA.android, maxTouchPoints: 5 }), true);
});

test("isAppPlatform: iPadOS reports a Mac, so a touch-screen Mac counts", () => {
  assert.equal(isAppPlatform({ userAgent: UA.mac, maxTouchPoints: 5 }), true);
  assert.equal(isAppPlatform({ userAgent: UA.mac, maxTouchPoints: 0 }), false);
});

test("isAppPlatform: computers are not", () => {
  assert.equal(isAppPlatform({ userAgent: UA.windows, maxTouchPoints: 10 }), false);
  assert.equal(isAppPlatform({ userAgent: UA.linux, maxTouchPoints: 0 }), false);
  assert.equal(isAppPlatform({}), false);
});

/* ── shouldAnnounce ────────────────────────────────────────────────────── */

const COOKIE = "lit_apps_launch_v1";

test("shouldAnnounce: opens on a second pageview with nothing against it", () => {
  page({ pv: 1 });
  assert.equal(shouldAnnounce({ cookie: COOKIE }), true);
});

test("shouldAnnounce: never on a session's first pageview", () => {
  page({ pv: 0 });
  assert.equal(shouldAnnounce({ cookie: COOKIE }), false);
});

test("shouldAnnounce: never once its own cookie is set", () => {
  page({ cookie: `${COOKIE}=1` });
  assert.equal(shouldAnnounce({ cookie: COOKIE }), false);
});

test("shouldAnnounce: another announcement's cookie doesn't count", () => {
  page({ cookie: "lit_welcome_v1=1" });
  assert.equal(shouldAnnounce({ cookie: COOKIE }), true);
});

test("shouldAnnounce: never on a shared verse link", () => {
  page({ hash: "#v16-17" });
  assert.equal(shouldAnnounce({ cookie: COOKIE }), false);
});

test("shouldAnnounce: never on /apps or /privacy", () => {
  for (const pathname of ["/apps", "/apps/", "/privacy", "/privacy/"]) {
    page({ pathname });
    assert.equal(shouldAnnounce({ cookie: COOKIE }), false, pathname);
  }
  page({ pathname: "/apps/beta/" });
  assert.equal(shouldAnnounce({ cookie: COOKIE }), true);
});

test("shouldAnnounce: never over scripture, unless the announcement opts out", () => {
  page({ scripture: true });
  assert.equal(shouldAnnounce({ cookie: COOKIE }), false);
  page({ scripture: true });
  assert.equal(shouldAnnounce({ cookie: COOKIE, overScripture: true }), true);
});

test("shouldAnnounce: the announcement's own rule can say no", () => {
  page();
  assert.equal(shouldAnnounce({ cookie: COOKIE, skip: () => true }), false);
  page();
  assert.equal(shouldAnnounce({ cookie: COOKIE, skip: () => false }), true);
});

test("shouldAnnounce: the announcement's own rule is asked last", () => {
  let asked = 0;
  const skip = () => (asked++, false);
  page({ scripture: true });
  shouldAnnounce({ cookie: COOKIE, skip });
  page({ pv: 0 });
  shouldAnnounce({ cookie: COOKIE, skip });
  assert.equal(asked, 0);
});

test("shouldAnnounce: counts the pageview even when it says no", () => {
  page({ pv: 0, scripture: true });
  assert.equal(shouldAnnounce({ cookie: COOKIE }), false);
  assert.equal(shouldAnnounce({ cookie: COOKIE }), false);
  assert.equal(sessionStorage.getItem("lit_pv"), "2");
});

test("shouldAnnounce: works with no options at all", () => {
  page();
  assert.equal(shouldAnnounce(), true);
});
