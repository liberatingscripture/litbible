// test/desk-account-header.test.js
//
// The header's way into an account (the plan's step 4h; BVJ, 2026-11-24;
// Featherboa's AC-23): “Sign in,” and once this browser's notebook is linked,
// “Account ▾,” whose menu holds the sync's status, “Account and devices,” and
// “Sign out” (src/scripts/desk/account/header-entry.js). Driven in a
// happy-dom page over the real store, the real connector and the stand-in
// service, as desk-sync-status-line.test.js is. The entry's markup is written
// out here as SiteHeader.astro has it; a test at the end holds the two
// together.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import "./helpers/browser-env.mjs";
import { freshBrowser, moment, until } from "./helpers/sync-browser.mjs";
import { join } from "./helpers/fake-notebook-service.mjs";
import { firstDevice, testClock } from "./helpers/sync-rig.mjs";
import { SERVICES } from "../src/lib/desk-sync-link.mjs";
import { STOPPED_WORDS } from "../src/lib/desk-sync-status.mjs";

const { openStore } = await import("../src/scripts/desk/store.js");
const sync = await import("../src/scripts/desk/sync/start.js");
const { LAST_ATTR, LAST_KEY, start } = await import("../src/scripts/desk/account/header-entry.js");

const ctx = () => ({ client: "test-web", contentVersion: "2026.11.24" });
const state = (connector) => connector.status().state;

/** The header's entry, once at the end of its tools, and somewhere else to press. */
function header() {
  document.body.innerHTML = `<header class="site-header">
    <span class="site-header__account" data-account-entry>
      <a class="kit-btn kit-btn--plain site-header__account-link" href="/account/" data-account-signin>Sign in</a>
      <button type="button" class="kit-btn kit-btn--plain site-header__account-btn" aria-expanded="false" aria-controls="accountMenu" data-account-button hidden>Account<svg class="icon" aria-hidden="true"></svg></button>
      <div class="site-nav__menu site-header__account-menu" id="accountMenu" data-account-menu hidden>
        <div data-desk-sync-slot hidden></div>
        <a class="kit-row" href="/account/">Account and devices</a>
        <a class="kit-row" href="/account/#sign-out">Sign out</a>
      </div>
    </span></header><button id="elsewhere" type="button">Elsewhere</button>`;
  // A new page in a browser that has never shown the account button: no note, and no stamp from it.
  localStorage.removeItem(LAST_KEY);
  document.documentElement.removeAttribute(LAST_ATTR);
  const el = document.querySelector("[data-account-entry]");
  return {
    entry: {
      el,
      link: el.querySelector("[data-account-signin]"),
      button: el.querySelector("[data-account-button]"),
      menu: el.querySelector("[data-account-menu]"),
      slot: el.querySelector("[data-desk-sync-slot]"),
    },
  };
}

async function linked() {
  const browser = freshBrowser();
  await sync.setSyncEnv(browser.env);
  const parts = header();
  const other = await firstDevice(browser.service, "reader", { clock: testClock(new Date(Date.now() - 60_000).toISOString()) });
  const store = await openStore({ ctx });
  const mine = await join(browser.service, other.by);
  const connector = await sync.linkNotebook({
    store,
    service: SERVICES.local,
    token: mine.token,
    notebook: mine.keyring.notebook,
    device: { id: mine.id, key: mine.key },
    keyring: mine.keyring,
  });
  await until(() => state(connector) === "upToDate", "the notebook in step");
  return { ...browser, ...parts, mine, connector, store };
}

const key = (el, name) => el.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }));

test("a browser with no account shows “Sign in,” a plain link to the account page", async () => {
  freshBrowser();
  const { entry } = header();
  assert.equal(await start(), "out");
  assert.equal(entry.el.getAttribute("data-account-state"), "out", "the entry is shown now that it is known");
  assert.equal(entry.link.hidden, false);
  assert.equal(entry.link.getAttribute("href"), "/account/");
  assert.equal(entry.button.hidden, true);
  assert.equal(entry.menu.hidden, true);
});

test("a notebook that holds records and no link is still “Sign in”", async () => {
  const browser = freshBrowser();
  await sync.setSyncEnv(browser.env);
  const { entry } = header();
  await openStore({ ctx });
  assert.equal(await start(), "out");
  assert.equal(entry.link.hidden, false);
});

test("a page with no entry does nothing", async () => {
  freshBrowser();
  document.body.innerHTML = "<p>No header here.</p>";
  assert.equal(await start(), null);
});

test("a linked browser shows “Account,” and its menu holds the status, the account page, and “Sign out”", async () => {
  const { entry } = await linked();
  assert.equal(await start(), "in");
  assert.equal(entry.el.getAttribute("data-account-state"), "in");
  assert.equal(entry.link.hidden, true);
  assert.equal(entry.button.hidden, false);
  assert.equal(entry.button.textContent.trim(), "Account", "its word is its name");

  entry.button.click();
  assert.equal(entry.menu.hidden, false);
  assert.equal(entry.button.getAttribute("aria-expanded"), "true");
  assert.equal(entry.slot.hidden, false, "the status line took its slot");
  assert.equal(entry.slot.querySelector(".desk-sync__line").textContent, "Your notebook is in sync.");
  assert.deepEqual([...entry.menu.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")]), [
    ["Account and devices", "/account/"],
    ["Sign out", "/account/#sign-out"],
  ]);

  // A second press closes it.
  entry.button.click();
  assert.equal(entry.menu.hidden, true);
  assert.equal(entry.button.getAttribute("aria-expanded"), "false");
});

test("the entry can be drawn again: the menu is wired once, and stopping the sync puts “Sign in” back", async () => {
  // The account page draws it again when it opens accounts, links the browser, or stops syncing in it.
  const { entry, store } = await linked();
  assert.equal(await start(), "in");
  assert.equal(await start(), "in");
  entry.button.click();
  assert.equal(entry.menu.hidden, false, "one press opens it: a second wiring would have opened and shut it");
  assert.equal(entry.button.getAttribute("aria-expanded"), "true");

  await sync.unlink({ store });
  assert.equal(await start(), "out");
  assert.equal(entry.el.getAttribute("data-account-state"), "out");
  assert.equal(entry.link.hidden, false);
  assert.equal(entry.button.hidden, true);
  assert.equal(entry.menu.hidden, true, "an open menu is shut with its button");
  assert.equal(entry.button.getAttribute("aria-expanded"), "false");
});

test("the entry is as wide as what it shows: the button never keeps the words' width (E231)", async () => {
  const { entry } = await linked();
  // A layout, which happy-dom has none of: "Sign in" is 79px wide.
  entry.el.getBoundingClientRect = () => ({ width: 79 });
  assert.equal(await start(), "in");
  assert.equal(entry.el.style.minWidth, "", "no width is fixed on the entry, so the tools sit beside the button");
  assert.equal(entry.el.getAttribute("style"), null);
});

test("a linked browser leaves a note of what its header showed, for the next page's first paint; signing out takes it away", async () => {
  const { store } = await linked();
  assert.equal(localStorage.getItem(LAST_KEY), null);
  assert.equal(await start(), "in");
  assert.equal(localStorage.getItem(LAST_KEY), "in");
  assert.equal(document.documentElement.getAttribute(LAST_ATTR), "in", "and the stamp on this page follows it");

  await sync.unlink({ store });
  assert.equal(await start(), "out");
  assert.equal(localStorage.getItem(LAST_KEY), null);
  assert.equal(document.documentElement.hasAttribute(LAST_ATTR), false);
});

test("a browser with no account leaves no note", async () => {
  freshBrowser();
  header();
  assert.equal(await start(), "out");
  assert.equal(localStorage.getItem(LAST_KEY), null);
  assert.equal(document.documentElement.hasAttribute(LAST_ATTR), false);
});

test("a browser that keeps no local storage still gets its entry", async () => {
  const { entry } = await linked();
  const blocked = { setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
  assert.equal(await start({ storage: blocked }), "in");
  assert.equal(entry.button.hidden, false);
  assert.equal(await start({ storage: null }), "in");
});

test("the menu's keys: the arrows open it and move among its items, Escape returns to the button, and a press elsewhere closes it", async () => {
  const { entry } = await linked();
  await start();
  const links = [...entry.menu.querySelectorAll("a")];

  entry.button.focus();
  key(entry.button, "ArrowDown");
  assert.equal(entry.menu.hidden, false);
  // In step, the status line has no button, so the first item is the account page's link.
  assert.equal(document.activeElement === links[0], true);
  key(entry.menu, "ArrowDown");
  assert.equal(document.activeElement === links[1], true);
  key(entry.menu, "ArrowDown");
  assert.equal(document.activeElement === links[0], true, "it goes round");
  key(entry.menu, "End");
  assert.equal(document.activeElement === links[1], true);
  key(entry.menu, "Home");
  assert.equal(document.activeElement === links[0], true);

  key(entry.menu, "Escape");
  assert.equal(entry.menu.hidden, true);
  assert.equal(document.activeElement === entry.button, true, "focus is back on the button");

  key(entry.button, "ArrowUp");
  assert.equal(document.activeElement === links[1], true, "Arrow Up opens it at its last item");

  document.getElementById("elsewhere").click();
  assert.equal(entry.menu.hidden, true);
  assert.equal(entry.button.getAttribute("aria-expanded"), "false");
});

test("when the sync has stopped, the button says so, and the menu holds the reason and “Reconnect,” which opens the account page", async () => {
  const { service, went, entry, mine, connector } = await linked();
  await start();
  service.endSession(mine.token);
  await connector.syncNow();
  await until(() => state(connector) === "signedOut", "signed out");
  await moment();
  assert.equal(entry.button.getAttribute("aria-description"), STOPPED_WORDS, "the dot's words, for a screen reader");

  entry.button.focus();
  key(entry.button, "ArrowDown");
  assert.match(entry.slot.querySelector(".desk-sync__line").textContent, /^You’ve been signed out\. Your notebook is still in this browser/);
  const again = entry.slot.querySelector(".desk-sync__again");
  assert.equal(again.hidden, false);
  assert.equal(again.textContent, "Reconnect");
  assert.equal(document.activeElement === again, true, "the menu's first item is now the button");
  again.click();
  assert.deepEqual(went, ["/account/"]);
});

test("SiteHeader.astro's entry has the parts this module reads, once, and the menu sheet its own row", () => {
  const source = readFileSync(new URL("../src/components/SiteHeader.astro", import.meta.url), "utf8");
  const count = (text) => source.split(text).length - 1;
  for (const part of [
    "data-account-entry",
    'data-account-signin>Sign in</a>',
    "data-account-button",
    'aria-controls="accountMenu"',
    'id="accountMenu" data-account-menu hidden',
    "<div data-desk-sync-slot hidden></div>",
    '<a class="kit-row" href="/account/">Account and devices</a>',
    '<a class="kit-row" href="/account/#sign-out">Sign out</a>',
  ]) {
    assert.equal(count(part), 1, `${part}: once, at the end of the header's tools`);
  }
  assert.match(source, />Account<Icon name="down" \/><\/button>/, "the button says its word, then the menu's ▾");
  const sheet = readFileSync(new URL("../src/components/MenuSheet.astro", import.meta.url), "utf8");
  assert.equal(
    sheet.split('<li class="menu-sheet__account"><a class="kit-row" href="/account/">Account</a></li>').length - 1,
    1,
    "and the menu sheet's own row, for a window too narrow for the entry",
  );
  // check:links holds a fragment to an element on the page it names, so the page's sheet carries the id.
  const page = readFileSync(new URL("../src/pages/account.astro", import.meta.url), "utf8");
  assert.equal(page.split('id="sign-out" data-account-page="account"').length - 1, 1, "“Sign out” lands on the account page's sheet");
});

test("the note is read before paint under the same name, and the stylesheet holds the button's room from it", () => {
  const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
  const layout = read("../src/layouts/Layout.astro");
  assert.ok(layout.includes(`s.getItem('${LAST_KEY}')==='in')d.setAttribute('${LAST_ATTR}','in')`), "Layout.astro's pre-paint script stamps the note");
  const css = read("../src/styles/header.css");
  const before = `html[${LAST_ATTR}="in"] .site-header__account:not([data-account-state])`;
  assert.match(css, new RegExp(`${before.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\.site-header__account-link \\{\\s*display: none;`), "the words give up their room");
  assert.match(css, new RegExp(`${before.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\.site-header__account-btn \\{\\s*display: inline-flex;`), "and the button, still hidden, takes its own");
  assert.doesNotMatch(read("../src/scripts/desk/account/header-entry.js"), /style\.minWidth/, "nothing fixes the entry's width");
});
