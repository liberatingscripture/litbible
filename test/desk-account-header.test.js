// test/desk-account-header.test.js
//
// The header's way into an account (the plan's step 4h; BVJ, 2026-11-24):
// “Sign in,” and once this browser's notebook is linked, a small account
// button whose menu holds the sync's status, “Account and devices,” and
// “Sign out” (src/scripts/desk/account/header-entry.js). Driven in a
// happy-dom page over the real store, the real connector and the stand-in
// service, as desk-sync-status-line.test.js is. The entry's markup is written
// out here as SiteHeader.astro has it; the last test holds the two together.

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
const { start } = await import("../src/scripts/desk/account/header-entry.js");

const ctx = () => ({ client: "test-web", contentVersion: "2026.11.24" });
const state = (connector) => connector.status().state;

/** The header's two copies of the entry (the nav's and the actions'), and somewhere else to press. */
function header() {
  const entry = (variant) => `
    <span class="site-header__account site-header__account--${variant}" data-account-entry>
      <a class="site-header__account-link" href="/account/" data-account-signin>Sign in</a>
      <button type="button" class="site-header__account-btn" aria-expanded="false" aria-controls="accountMenu-${variant}" data-account-button hidden>
        <span class="sr-only">Account</span>
      </button>
      <div class="site-nav__menu site-header__account-menu" id="accountMenu-${variant}" data-account-menu hidden>
        <div data-desk-sync-slot hidden></div>
        <a href="/account/">Account and devices</a>
        <a href="/account/#sign-out">Sign out</a>
      </div>
    </span>`;
  document.body.innerHTML = `<header class="site-header">${entry("nav")}${entry("actions")}</header><button id="elsewhere" type="button">Elsewhere</button>`;
  const [nav, actions] = [...document.querySelectorAll("[data-account-entry]")].map((el) => ({
    el,
    link: el.querySelector("[data-account-signin]"),
    button: el.querySelector("[data-account-button]"),
    menu: el.querySelector("[data-account-menu]"),
    slot: el.querySelector("[data-desk-sync-slot]"),
  }));
  return { nav, actions };
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
  return { ...browser, ...parts, mine, connector };
}

const key = (el, name) => el.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }));

test("a browser with no account shows “Sign in,” a plain link to the account page", async () => {
  freshBrowser();
  const { nav, actions } = header();
  assert.equal(await start(), "out");
  for (const entry of [nav, actions]) {
    assert.equal(entry.el.getAttribute("data-account-state"), "out", "the entry is shown now that it is known");
    assert.equal(entry.link.hidden, false);
    assert.equal(entry.link.getAttribute("href"), "/account/");
    assert.equal(entry.button.hidden, true);
    assert.equal(entry.menu.hidden, true);
  }
});

test("a notebook that holds records and no link is still “Sign in”", async () => {
  const browser = freshBrowser();
  await sync.setSyncEnv(browser.env);
  const { nav } = header();
  await openStore({ ctx });
  assert.equal(await start(), "out");
  assert.equal(nav.link.hidden, false);
});

test("a page with no entry does nothing", async () => {
  freshBrowser();
  document.body.innerHTML = "<p>No header here.</p>";
  assert.equal(await start(), null);
});

test("a linked browser shows the account button, and its menu holds the status, the account page, and “Sign out”", async () => {
  const { nav, actions } = await linked();
  assert.equal(await start(), "in");
  for (const entry of [nav, actions]) {
    assert.equal(entry.el.getAttribute("data-account-state"), "in");
    assert.equal(entry.link.hidden, true);
    assert.equal(entry.button.hidden, false);
    assert.equal(entry.button.getAttribute("data-tip"), "Account", "an icon-only control carries the shared tooltip");
    assert.equal(entry.button.textContent.trim(), "Account", "and its name");
  }

  nav.button.click();
  assert.equal(nav.menu.hidden, false);
  assert.equal(nav.button.getAttribute("aria-expanded"), "true");
  assert.equal(nav.slot.hidden, false, "the status line took its slot");
  assert.equal(nav.slot.querySelector(".desk-sync__line").textContent, "Your notebook is in sync.");
  assert.deepEqual([...nav.menu.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")]), [
    ["Account and devices", "/account/"],
    ["Sign out", "/account/#sign-out"],
  ]);

  // A second press closes it; the other copy's menu is its own.
  nav.button.click();
  assert.equal(nav.menu.hidden, true);
  assert.equal(nav.button.getAttribute("aria-expanded"), "false");
  assert.equal(actions.menu.hidden, true);
});

test("the menu's keys: the arrows open it and move among its items, Escape returns to the button, and a press elsewhere closes it", async () => {
  const { nav, actions } = await linked();
  await start();
  const links = [...nav.menu.querySelectorAll("a")];

  nav.button.focus();
  key(nav.button, "ArrowDown");
  assert.equal(nav.menu.hidden, false);
  // In step, the status line has no button, so the first item is the account page's link.
  assert.equal(document.activeElement === links[0], true);
  key(nav.menu, "ArrowDown");
  assert.equal(document.activeElement === links[1], true);
  key(nav.menu, "ArrowDown");
  assert.equal(document.activeElement === links[0], true, "it goes round");
  key(nav.menu, "End");
  assert.equal(document.activeElement === links[1], true);
  key(nav.menu, "Home");
  assert.equal(document.activeElement === links[0], true);

  key(nav.menu, "Escape");
  assert.equal(nav.menu.hidden, true);
  assert.equal(document.activeElement === nav.button, true, "focus is back on the button");

  key(nav.button, "ArrowUp");
  assert.equal(document.activeElement === links[1], true, "Arrow Up opens it at its last item");

  // Opening the other copy closes this one, and a press elsewhere closes whichever is open.
  actions.button.click();
  assert.equal(nav.menu.hidden, true);
  assert.equal(actions.menu.hidden, false);
  document.getElementById("elsewhere").click();
  assert.equal(actions.menu.hidden, true);
});

test("when the sync has stopped, the button says so, and the menu holds the reason and “Reconnect,” which opens the account page", async () => {
  const { service, went, nav, mine, connector } = await linked();
  await start();
  service.endSession(mine.token);
  await connector.syncNow();
  await until(() => state(connector) === "signedOut", "signed out");
  await moment();
  assert.equal(nav.button.getAttribute("aria-description"), STOPPED_WORDS, "the dot's words, for a screen reader");

  nav.button.focus();
  key(nav.button, "ArrowDown");
  assert.match(nav.slot.querySelector(".desk-sync__line").textContent, /^You’ve been signed out\. Your notebook is still on this computer/);
  const again = nav.slot.querySelector(".desk-sync__again");
  assert.equal(again.hidden, false);
  assert.equal(again.textContent, "Reconnect");
  assert.equal(document.activeElement === again, true, "the menu's first item is now the button");
  again.click();
  assert.deepEqual(went, ["/account/"]);
});

test("SiteHeader.astro's entry has the parts this module reads, in both copies", () => {
  const source = readFileSync(new URL("../src/components/SiteHeader.astro", import.meta.url), "utf8");
  const count = (text) => source.split(text).length - 1;
  for (const part of ["data-account-entry", 'data-account-signin>Sign in</a>', "data-account-button", "data-account-menu hidden", "<div data-desk-sync-slot hidden></div>", '<a href="/account/">Account and devices</a>', '<a href="/account/#sign-out">Sign out</a>']) {
    assert.equal(count(part), 2, `${part}: once in the nav's tools and once in the actions`);
  }
  assert.equal(count('class="menu-overlay__account"'), 1, "and the menu's own link, for a window too narrow for either");
});
