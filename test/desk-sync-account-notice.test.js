// test/desk-sync-account-notice.test.js
//
// The account's two notices on a reading page (src/scripts/desk/sync/
// account-notice.js; BVJ, 2026-11-25): a request to delete the account or
// replace its notebook that is waiting its seven days, and a device or a way
// in that is new. Before this they were said only on the account's home.
//
// Two kinds of test. The first drives the notice itself in a happy-dom page,
// with statuses handed to it one at a time, so each rule is seen alone: what
// it says, where the dot goes, what it stores, when it keeps quiet. The
// second runs whole flows against the notebook service's own code
// (test/helpers/account-page.mjs): another sign-in asks to replace the
// notebook, another computer joins with the recovery code, and the first
// computer's next page says so.

import { test } from "node:test";
import assert from "node:assert/strict";

import "./helpers/browser-env.mjs";
import { resetDom } from "./helpers/browser-env.mjs";
import { fakeBar, handTimers, until } from "./helpers/sync-browser.mjs";

const { NEWS_EVERY_MS, NEWS_WORDS, REVIEW_WORDS, STOPPED_WORDS, TELL_AGAIN_MS, WAITING_WORDS } = await import("../src/lib/desk-sync-status.mjs");
const { SLOT_EVENT } = await import("../src/lib/desk-sync-link.mjs");
const { news, seenIn } = await import("../src/lib/desk-account.mjs");
const { WORDS, newsWords } = await import("../src/lib/desk-account-words.mjs");
const { mountAccountNotice } = await import("../src/scripts/desk/sync/account-notice.js");
const { ACCOUNT_ATTR, STOPPED_ATTR, markDots } = await import("../src/scripts/desk/sync/notice-parts.js");

const html = () => document.documentElement;
const NOW = Date.parse("2026-11-25T18:30:00.000Z");
const ME = "device-me";

/** A reading page: the header's account button, the Notebook's tab, and its Settings tab. */
function readingPage(path = "/john-3/") {
  resetDom(`https://litbible.net${path}`);
  html().removeAttribute("data-desk-tour");
  document.body.innerHTML = `
    <span data-account-entry data-account-state="in"><button type="button" class="site-header__account-btn" data-account-button>Account</button></span>
    <button type="button" class="desk-tab">Notebook</button>
    <div class="desk-panel__tabs"><button type="button" data-tab="settings">Settings</button></div>`;
  return {
    account: document.querySelector(".site-header__account-btn"),
    tab: document.querySelector(".desk-tab"),
    settings: document.querySelector('[data-tab="settings"]'),
  };
}

const says = (el) => el.getAttribute("aria-description");
const status = (state = "upToDate", account = { waiting: null, replaced: null, expires: null }) => ({ state, pending: 0, problems: {}, lastSynced: null, clock: null, account });
const request = (extra = {}) => ({ what: "delete", asked: "2026-11-25T18:00:00.000Z", due: "2026-12-02T18:00:00.000Z", platform: "web", through: "passkey", mine: false, ...extra });
const waiting = (extra) => status("upToDate", { waiting: request(extra), replaced: null, expires: null });

/** The sync's storage, as far as a notice uses it. */
function fakeDb(start = {}) {
  const kv = new Map(Object.entries(start));
  return {
    kv,
    async getAll(keys) {
      return Object.fromEntries(keys.map((key) => [key, kv.get(key)]));
    },
    async set(values) {
      for (const [key, value] of Object.entries(values)) {
        if (value === undefined) kv.delete(key);
        else kv.set(key, structuredClone(value));
      }
    },
  };
}

/** A connector that says what it is told to. */
function fakeConnector(first = status("starting", null)) {
  let now = first;
  const listeners = new Set();
  return {
    status: () => now,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    say(next) {
      now = next;
      for (const fn of [...listeners]) fn(now);
    },
    call: async () => ({ status: 200, body: {} }),
    keyring: async () => ({ notebook: "notebook-1", current: 1 }),
    device: () => ({ id: ME }),
  };
}

const device = (id, extra = {}) => ({ id, opens: true, name: id, platform: "web", added: "2026-11-25T17:00:00.000Z", how: "approval", by: ME, seen: null, ...extra });
const holder = (id, extra = {}) => ({ id, opens: true, kind: "recovery", credential: null, name: null, added: "2026-11-25T17:00:00.000Z", by: ME, ...extra });

/**
 * One browser, as a notice sees it: its storage, its clock, its bar, and who
 * can open the notebook. `page()` is a page of it being opened: the notice is
 * mounted on a fresh page with the connector's first status said.
 */
function rig({ db = fakeDb({ seen: [ME] }), lists = { devices: [device(ME, { how: "setup", by: null })], holders: [] } } = {}) {
  const r = {
    db,
    lists,
    now: NOW,
    reads: 0,
    readFails: null,
    logged: [],
    went: [],
    pages: [],
    page({ path = "/john-3/", first = status("upToDate"), prepare = () => {} } = {}) {
      for (const old of r.pages.splice(0)) old.off();
      const dom = readingPage(path);
      prepare();
      const timers = handTimers();
      const bar = fakeBar();
      const connector = fakeConnector(first);
      const off = mountAccountNotice(connector, {
        db: r.db,
        nowMs: () => r.now,
        bar: async () => bar,
        go: (href) => r.went.push(href),
        locale: "en-US",
        setTimer: timers.set,
        clearTimer: timers.clear,
        log: (...args) => r.logged.push(args),
        account: async () => ({
          readLists: async () => {
            r.reads += 1;
            if (r.readFails) throw r.readFails;
            return r.lists;
          },
          news,
          seenIn,
          newsWords,
          ok: WORDS.ok,
        }),
      });
      const page = { ...dom, timers, bar, connector, off };
      r.pages.push(page);
      return page;
    },
  };
  return r;
}

/** Lets the notice finish what a status started: it reads its storage, and may read the lists. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 15));

/* ── A request that waits ───────────────────────────────────────────────── */

test("a request someone else made is told on the page being read: the dot where a stop's goes, and the bar with “Review”", async () => {
  const r = rig();
  const page = r.page({ first: waiting() });
  await until(() => page.bar.shown.length === 1, "the bar");
  const shown = page.bar.shown[0];
  assert.equal(shown.message, "Someone signed in to your account asked to delete your account. It takes effect on December 2.");
  assert.deepEqual(shown.choices.map((c) => [c.label, c.primary === true]), [[REVIEW_WORDS, true]]);
  assert.equal(html().getAttribute(ACCOUNT_ATTR), "waiting");
  for (const el of [page.account, page.tab, page.settings]) assert.equal(says(el), WAITING_WORDS);
  assert.deepEqual(r.db.kv.get("asked"), { key: "delete:2026-11-25T18:00:00.000Z", at: NOW }, "what was said is kept, with when");

  await page.bar.press();
  assert.deepEqual(r.went, ["/account/"], "“Review” opens the account page, where the request can be canceled");

  // The same request on the next pass is not said twice.
  page.connector.say(waiting());
  await settled();
  assert.equal(page.bar.shown.length, 1);
});

test("the next page shows the dot and says nothing more, until a day has passed", async () => {
  const r = rig();
  const first = r.page({ first: waiting({ what: "replace" }) });
  await until(() => first.bar.shown.length === 1, "the bar");
  assert.match(first.bar.shown[0].message, /^Someone signed in to your account asked to replace your account’s notebook\. /);

  r.now += 60 * 60_000;
  const next = r.page({ first: waiting({ what: "replace" }) });
  await settled();
  assert.equal(next.bar.shown.length, 0, "said an hour ago");
  assert.equal(html().getAttribute(ACCOUNT_ATTR), "waiting", "the dot is there for as long as the request waits");

  r.now += TELL_AGAIN_MS;
  const later = r.page({ first: waiting({ what: "replace" }) });
  await until(() => later.bar.shown.length === 1, "the bar, a day later");
});

test("a request this browser's own sign-in made isn't announced to its reader", async () => {
  const r = rig();
  const page = r.page({ first: waiting({ mine: true }) });
  await settled();
  assert.equal(page.bar.shown.length, 0);
  assert.equal(html().hasAttribute(ACCOUNT_ATTR), false);
  assert.equal(says(page.account), null);
  assert.equal(r.db.kv.has("asked"), false);
});

test("on the account page the request is the page's to show: the dot, no bar, and the next page still says it", async () => {
  const r = rig();
  const page = r.page({ path: "/account/", first: waiting(), prepare: () => document.body.insertAdjacentHTML("beforeend", '<div data-account-page="account"></div>') });
  await settled();
  assert.equal(page.bar.shown.length, 0);
  assert.equal(html().getAttribute(ACCOUNT_ATTR), "waiting");
  assert.equal(r.db.kv.has("asked"), false, "nothing is recorded");
  assert.equal(r.reads, 0, "and the account's home reads who can open the notebook itself");

  const next = r.page({ first: waiting() });
  await until(() => next.bar.shown.length === 1, "the bar on the next page");
});

test("a request that is gone takes its bar and its dot with it, and a new one is said", async () => {
  const r = rig();
  const page = r.page({ first: waiting() });
  await until(() => page.bar.shown.length === 1, "the bar");
  assert.equal(page.bar.up, true);

  page.connector.say(status("upToDate"));
  await until(() => !r.db.kv.has("asked"), "what was said to be forgotten");
  assert.equal(page.bar.up, false, "canceled, or carried out: the bar no longer says so");
  assert.equal(html().hasAttribute(ACCOUNT_ATTR), false);
  for (const el of [page.account, page.tab, page.settings]) assert.equal(says(el), null);

  page.connector.say(waiting({ asked: "2026-11-25T18:20:00.000Z" }));
  await until(() => page.bar.shown.length === 2, "the new request to be said");
});

test("a stop outranks it: the bar comes down, the buttons say the stop, and the request's words come back when the stop ends", async () => {
  const r = rig();
  const page = r.page({ first: waiting() });
  await until(() => page.bar.shown.length === 1, "the bar");

  // The stopped notice's own half of the dot (./stopped-notice.js), as it marks it.
  markDots(document, "stopped", true);
  page.connector.say(status("signedOut", { waiting: request(), replaced: null, expires: null }));
  await settled();
  assert.equal(page.bar.up, false, "the stop is what the page says now");
  assert.equal(html().hasAttribute(ACCOUNT_ATTR), false);
  assert.equal(html().getAttribute(STOPPED_ATTR), "stopped");
  assert.equal(says(page.tab), STOPPED_WORDS);

  markDots(document, "stopped", false);
  page.connector.say(waiting());
  await settled();
  assert.equal(html().getAttribute(ACCOUNT_ATTR), "waiting");
  assert.equal(says(page.tab), WAITING_WORDS);
  assert.equal(page.bar.shown.length, 1, "and it was said already");
});

test("the bar waits its turn: never over a tour, another notice, or a sheet's page", async () => {
  const r = rig();
  const page = r.page({ first: waiting(), prepare: () => html().setAttribute("data-desk-tour", "") });
  await settled();
  assert.equal(page.bar.shown.length, 0, "a tour is running");
  assert.equal(html().getAttribute(ACCOUNT_ATTR), "waiting", "the dot doesn't wait");
  assert.equal(r.db.kv.has("asked"), false, "not said yet");
  assert.deepEqual(page.timers.waiting(), [5000]);

  // Still running at the next try; over by the one after.
  await page.timers.fire();
  assert.equal(page.bar.shown.length, 0);
  html().removeAttribute("data-desk-tour");
  page.bar.showNotice("Note saved.");
  await page.timers.fire();
  assert.equal(page.bar.shown.length, 0, "another notice is up");
  page.bar.up = false;
  await page.timers.fire();
  await until(() => page.bar.shown.length === 1, "the bar, once the page is free");

  const sheet = r.page({ path: "/sheets/", first: waiting({ asked: "2026-11-25T18:25:00.000Z" }), prepare: () => document.body.insertAdjacentHTML("beforeend", "<div data-sheet-page></div>") });
  await settled();
  assert.equal(sheet.bar.shown.length, 0, "a sheet's own page is never interrupted");
  assert.equal(html().getAttribute(ACCOUNT_ATTR), "waiting");
});

test("a tab or a button built late takes the dot's words when the page says a slot is there", async () => {
  const r = rig();
  const page = r.page({ first: waiting() });
  await until(() => page.bar.shown.length === 1, "the bar");
  const late = document.createElement("button");
  late.setAttribute("data-desk-toggle", "");
  document.body.append(late);
  assert.equal(says(late), null);
  document.dispatchEvent(new CustomEvent(SLOT_EVENT));
  assert.equal(says(late), WAITING_WORDS);
  // What some other code said of a button is never written over.
  page.tab.setAttribute("aria-description", "Backup due");
  document.dispatchEvent(new CustomEvent(SLOT_EVENT));
  assert.equal(says(page.tab), "Backup due");
  page.tab.removeAttribute("aria-description");
});

/* ── What is new ────────────────────────────────────────────────────────── */

const withJoin = (extra = {}) => ({
  devices: [device(ME, { how: "setup", by: null }), device("device-2", { name: "Chrome on a Mac", how: "recovery", by: null, ...extra })],
  holders: [],
});

test("a device that joined is told once: a dot on the account button alone, and the bar with “Review” and “OK”", async () => {
  const r = rig({ lists: withJoin() });
  const page = r.page();
  await until(() => page.bar.shown.length === 1, "the bar");
  const shown = page.bar.shown[0];
  assert.equal(shown.message, "“Chrome on a Mac” joined your notebook on November 25, with your recovery code.");
  assert.deepEqual(shown.choices.map((c) => [c.label, c.primary === true]), [[REVIEW_WORDS, true], [WORDS.ok, false]]);
  assert.equal(html().getAttribute(ACCOUNT_ATTR), "news");
  assert.equal(says(page.account), NEWS_WORDS);
  assert.equal(says(page.tab), null, "the Notebook's tab has nothing to say of it");
  assert.equal(says(page.settings), null);
  assert.equal(r.reads, 1, "one read of who can open the notebook");
  assert.deepEqual(r.db.kv.get("news"), { at: NOW, unseen: ["device-2"], told: ["device-2"] }, "ids and times, and no name");

  // Another pass on this page reads nothing again and says nothing again.
  page.connector.say(status("upToDate"));
  await settled();
  assert.equal(r.reads, 1);
  assert.equal(page.bar.shown.length, 1);

  await shown.choices[0].onPress();
  assert.deepEqual(r.went, ["/account/"], "“Review” opens the account page, where a device can be removed");
});

test("“OK” marks it seen, as the account page's own does: the dot goes, and no page says it again", async () => {
  const r = rig({ lists: withJoin() });
  const page = r.page();
  await until(() => page.bar.shown.length === 1, "the bar");
  await page.bar.shown[0].choices[1].onPress();
  assert.deepEqual(r.db.kv.get("seen"), [ME, "device-2"]);
  assert.equal(html().hasAttribute(ACCOUNT_ATTR), false);
  assert.equal(says(page.account), null);

  r.now += NEWS_EVERY_MS;
  const next = r.page();
  await until(() => r.reads === 2, "the next read, when it is due");
  await settled();
  assert.equal(next.bar.shown.length, 0);
  assert.equal(html().hasAttribute(ACCOUNT_ATTR), false);
});

test("closed without an answer, the bar is not put up again; the dot stays until the account page's “OK”", async () => {
  const r = rig({ lists: withJoin() });
  const page = r.page();
  await until(() => page.bar.shown.length === 1, "the bar");

  // The next page, a minute later: no read is due, so the dot comes from what was kept.
  r.now += 60_000;
  const next = r.page();
  await until(() => html().getAttribute(ACCOUNT_ATTR) === "news", "the dot on the next page");
  assert.equal(next.bar.shown.length, 0, "said once");
  assert.equal(r.reads, 1, "and nothing was asked of the service for it");

  // A read falls due, and still nothing is said twice.
  r.now += NEWS_EVERY_MS;
  const third = r.page();
  await until(() => r.reads === 2, "the read that is due");
  await settled();
  assert.equal(third.bar.shown.length, 0);
  assert.equal(html().getAttribute(ACCOUNT_ATTR), "news");

  // The account page's “OK” writes `seen`; the page after shows no dot, with no read.
  await r.db.set({ seen: seenIn(r.lists) });
  r.now += 60_000;
  const last = r.page();
  await settled();
  assert.equal(html().hasAttribute(ACCOUNT_ATTR), false);
  assert.equal(last.bar.shown.length, 0);
  assert.equal(r.reads, 2);
});

test("a device this browser approved isn't news here, and one another device approved is", async () => {
  const r = rig({ lists: withJoin({ how: "approval", by: ME }) });
  const page = r.page();
  await until(() => r.reads === 1, "the read");
  await settled();
  assert.equal(page.bar.shown.length, 0, "its reader approved it in this browser");
  assert.equal(html().hasAttribute(ACCOUNT_ATTR), false);

  r.lists = {
    devices: [...r.lists.devices, device("device-3", { name: "Safari on an iPhone", how: "approval", by: "device-2" })],
    holders: [holder("holder-9", { by: "device-2" })],
  };
  r.now += NEWS_EVERY_MS;
  const next = r.page();
  await until(() => next.bar.shown.length === 1, "the bar");
  assert.equal(
    next.bar.shown[0].message,
    "“Safari on an iPhone” joined your notebook on November 25, approved from “Chrome on a Mac.” A new recovery code was added to your notebook on November 25 from “Chrome on a Mac.”",
    "each thing that is new in its own sentence, as the account page writes them",
  );
  assert.deepEqual(r.db.kv.get("news").unseen, ["device-3", "holder-9"]);
});

test("a browser with no list of what its reader knows takes everything there as known, as the account's home does", async () => {
  const r = rig({ db: fakeDb(), lists: withJoin() });
  const page = r.page();
  await until(() => r.db.kv.has("seen"), "the list to be made");
  await settled();
  assert.deepEqual(r.db.kv.get("seen"), [ME, "device-2"]);
  assert.equal(page.bar.shown.length, 0);
  assert.equal(html().hasAttribute(ACCOUNT_ATTR), false);
});

test("a read that fails says nothing, isn't asked again on every pass, and is tried again a minute later", async () => {
  const r = rig({ lists: withJoin() });
  r.readFails = Object.assign(new Error("offline"), { name: "Offline" });
  const page = r.page();
  await until(() => r.reads === 1, "the read");
  await settled();
  assert.equal(page.bar.shown.length, 0);
  assert.equal(html().hasAttribute(ACCOUNT_ATTR), false);
  assert.deepEqual(r.logged, [], "a service that can't be reached is no surprise");
  assert.equal(r.db.kv.has("news"), false, "nothing is kept of a read that didn't happen");

  page.connector.say(status("upToDate"));
  await settled();
  assert.equal(r.reads, 1, "not on the very next pass");

  r.readFails = new Error("something else");
  r.now += 60_000;
  page.connector.say(status("upToDate"));
  await until(() => r.reads === 2, "the next try");
  await settled();
  assert.equal(r.logged.length, 1, "a failure nobody expected is logged");

  r.readFails = null;
  r.now += 60_000;
  page.connector.say(status("upToDate"));
  await until(() => page.bar.shown.length === 1, "the bar, once the read works");
});

test("found on a page that couldn't say it, it is read again and said on the next, whether a read is due or not", async () => {
  const r = rig({ lists: withJoin() });
  const sheet = r.page({ path: "/sheets/", prepare: () => document.body.insertAdjacentHTML("beforeend", "<div data-sheet-page></div>") });
  await until(() => r.reads === 1, "the read");
  await settled();
  assert.equal(sheet.bar.shown.length, 0, "a sheet's own page is never interrupted");
  assert.equal(html().getAttribute(ACCOUNT_ATTR), "news", "the dot is on its header all the same");
  assert.deepEqual(r.db.kv.get("news"), { at: NOW, unseen: ["device-2"], told: [] });

  r.now += 60_000;
  const next = r.page();
  await until(() => next.bar.shown.length === 1, "the bar on the next page");
  assert.equal(r.reads, 2, "the name is never kept, so it is read again");
});

test("with both to say, the request that waits is said first and what is new takes its turn", async () => {
  const r = rig({ lists: withJoin() });
  const page = r.page({ first: waiting() });
  await until(() => page.bar.shown.length === 1 && r.reads === 1, "the first bar, and the read");
  await settled();
  assert.match(page.bar.shown[0].message, /asked to delete your account/);
  assert.equal(html().getAttribute(ACCOUNT_ATTR), "waiting", "the dot says the more pressing of the two");
  assert.equal(says(page.account), WAITING_WORDS);
  assert.deepEqual(r.db.kv.get("news").told, [], "not said yet");

  page.bar.up = false; // the reader closes the first
  await page.timers.fire();
  await until(() => page.bar.shown.length === 2, "the second bar");
  assert.match(page.bar.shown[1].message, /joined your notebook/);
});

test("nothing is read or said while the sync is starting, syncing, or stopped", async () => {
  const r = rig({ lists: withJoin() });
  const page = r.page({ first: status("starting", null) });
  for (const state of ["syncing", "signedOut", "removed", "otherNotebook", "noKeys", "cantOpen"]) {
    page.connector.say(status(state));
    await settled();
  }
  assert.equal(r.reads, 0);
  assert.equal(page.bar.shown.length, 0);
  assert.equal(html().hasAttribute(ACCOUNT_ATTR), false);
});

test("taking the notice off takes its bar and its dot with it", async () => {
  const r = rig({ lists: withJoin() });
  const page = r.page();
  await until(() => page.bar.shown.length === 1, "the bar");
  page.off();
  assert.equal(page.bar.up, false);
  assert.equal(html().hasAttribute(ACCOUNT_ATTR), false);
  assert.equal(says(page.account), null);
  r.pages.length = 0;
});

/* ── Whole flows, against the service's own code ────────────────────────── */

const { SAFARI_MAC, browser, openPage, saveCode, synced, use, world } = await import("./helpers/account-page.mjs");
const { openStore } = await import("../src/scripts/desk/store.js");
const { openSyncDb } = await import("../src/scripts/desk/sync/sync-db.js");
const sync = await import("../src/scripts/desk/sync/start.js");

const CTX = () => ({ client: "test-web", contentVersion: "2026.11.25" });

/** A reader with an account and a synced notebook, set up on a computer whose key stays on its devices. */
async function setUpReader(w) {
  const b = browser(w);
  b.went = [];
  Object.assign(b.syncEnv, { go: (href) => b.went.push(href), locale: "en-US" });
  const page = await openPage(b);
  await page.press(WORDS.create);
  await page.shows(WORDS.setupTitle);
  page.root.querySelector("#account-key-device").checked = true;
  await page.press(WORDS.setupContinue);
  await page.shows(WORDS.codeTitle);
  const code = await saveCode(page);
  await page.shows(WORDS.homeTitle);
  await synced(page);
  await page.shows(WORDS.thisComputer);
  return { b, code };
}

/** A chapter opened in `b`: the real store and the real connector, started as a reading page starts them. */
async function openChapter(b) {
  await use(b);
  const dom = readingPage();
  b.bar.up = false; // a new page has no bar up
  const before = { bars: b.bar.shown.length, sent: b.w.sent.length };
  const store = await openStore({ ctx: CTX });
  const connector = await sync.startSync({ store });
  await until(() => connector.status().state === "upToDate", `the sync to settle (it is ${connector.status().state})`);
  return { ...dom, connector, bars: () => b.bar.shown.slice(before.bars), asked: (path) => b.w.sent.slice(before.sent).filter((s) => s.method === "GET" && s.path === path).length };
}

async function kept(b, key) {
  const db = await openSyncDb({ idb: b.idb });
  try {
    return await db.get(key);
  } finally {
    db.close();
  }
}

test("another sign-in asks to replace the notebook: the computer that has it says so on its next page, and a cancel on the account page ends it everywhere", async () => {
  const w = world();
  const first = await setUpReader(w);
  const second = browser(w, { creds: first.b.creds, userAgent: SAFARI_MAC });
  const page2 = await openPage(second);
  await page2.press(WORDS.signInPasskey);
  await page2.shows(WORDS.joinTitle);
  await page2.press(WORDS.replaceAsk);
  await page2.shows(WORDS.replaceAsked);

  // The first computer's reader opens a chapter.
  const chapter = await openChapter(first.b);
  await until(() => chapter.bars().length === 1, "the bar on the chapter");
  const said = chapter.bars()[0];
  assert.match(said.message, /^Someone signed in to your account asked to replace your account’s notebook\. It takes effect on [A-Z][a-z]+ \d{1,2}(, \d{4})?\.$/);
  assert.deepEqual(said.choices.map((c) => c.label), [REVIEW_WORDS]);
  assert.equal(html().getAttribute(ACCOUNT_ATTR), "waiting");
  assert.equal(says(chapter.account), WAITING_WORDS);
  assert.equal(says(chapter.tab), WAITING_WORDS);
  assert.equal((await kept(first.b, "asked")).key.startsWith("replace:"), true);
  await said.choices[0].onPress();
  assert.deepEqual(first.b.went, ["/account/"]);

  // On the account page the request is the page's own to show, with its Cancel.
  const home = await openPage(first.b, { header: true });
  await synced(home);
  await home.shows("Someone signed in to your account asked to replace your account’s notebook.");
  assert.equal(first.b.bar.shown.length, 1, "no bar on the account page");
  await home.press(WORDS.cancelRequest);
  await home.shows(WORDS.canceled);
  await until(() => home.ctx.S.connector.status().account?.waiting === null, "the sync to hear that the request is gone, without waiting fifteen minutes");
  assert.equal(html().hasAttribute(ACCOUNT_ATTR), false, "and the dot is gone from this page's header");

  // The next chapter has no dot and no bar, and what was said is forgotten.
  const after = await openChapter(first.b);
  await until(async () => (await kept(first.b, "asked")) === undefined, "what was said to be forgotten");
  assert.equal(after.bars().length, 0);
  assert.equal(html().hasAttribute(ACCOUNT_ATTR), false);
  assert.equal(says(after.account), null);
});

test("another computer joins with the recovery code: the first says so on its next page, with one request, and “OK” there is the account page's own", async () => {
  const w = world();
  const first = await setUpReader(w);
  const second = browser(w, { creds: first.b.creds, userAgent: SAFARI_MAC });
  const page2 = await openPage(second);
  await page2.press(WORDS.signInPasskey);
  await page2.shows(WORDS.joinTitle);
  await page2.press(WORDS.joinRecovery);
  page2.fill("account-join-recovery", first.code);
  await page2.press(WORDS.joinOpen);
  await page2.shows(WORDS.joined);
  await synced(page2);

  const chapter = await openChapter(first.b);
  await until(() => chapter.bars().length === 1, "the bar on the chapter");
  const said = chapter.bars()[0];
  assert.match(said.message, /^“Safari on Mac” joined your notebook on [A-Z][a-z]+ \d{1,2}, with your recovery code\.$/);
  assert.deepEqual(said.choices.map((c) => c.label), [REVIEW_WORDS, WORDS.ok]);
  assert.equal(html().getAttribute(ACCOUNT_ATTR), "news");
  assert.equal(says(chapter.account), NEWS_WORDS);
  assert.equal(says(chapter.tab), null);
  assert.equal(chapter.asked("/devices"), 1, "one request for it");
  const news1 = await kept(first.b, "news");
  assert.equal(news1.unseen.length, 1);
  assert.deepEqual(news1.told, news1.unseen);

  // The next chapter: the dot, no bar, and nothing asked of the service for it.
  const next = await openChapter(first.b);
  await until(() => html().getAttribute(ACCOUNT_ATTR) === "news", "the dot on the next chapter");
  assert.equal(next.bars().length, 0);
  assert.equal(next.asked("/devices"), 0);

  // The account page still says it, and its “OK” is the one that ends it.
  const home = await openPage(first.b);
  await synced(home);
  await home.shows("“Safari on Mac” joined your notebook");
  await home.press(WORDS.ok);
  const last = await openChapter(first.b);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(html().hasAttribute(ACCOUNT_ATTR), false);
  assert.equal(last.bars().length, 0);

  // And the second computer was never news to itself.
  const own = await openChapter(second);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(own.bars().length, 0);
  assert.equal(html().hasAttribute(ACCOUNT_ATTR), false);
});

test("“OK” on the bar is the account page's “OK”: its home then has nothing new to say", async () => {
  const w = world();
  const first = await setUpReader(w);
  const second = browser(w, { creds: first.b.creds, userAgent: SAFARI_MAC });
  const page2 = await openPage(second);
  await page2.press(WORDS.signInPasskey);
  await page2.shows(WORDS.joinTitle);
  await page2.press(WORDS.joinRecovery);
  page2.fill("account-join-recovery", first.code);
  await page2.press(WORDS.joinOpen);
  await page2.shows(WORDS.joined);
  await synced(page2);

  const chapter = await openChapter(first.b);
  await until(() => chapter.bars().length === 1, "the bar on the chapter");
  await chapter.bars()[0].choices[1].onPress();
  assert.equal(html().hasAttribute(ACCOUNT_ATTR), false);

  const home = await openPage(first.b);
  await synced(home);
  await home.shows("Safari on Mac");
  assert.equal(home.root.querySelector(".account__notice"), null, "nothing new on the account's home");
});
