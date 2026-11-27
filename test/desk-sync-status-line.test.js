// test/desk-sync-status-line.test.js
//
// What a reader of a linked browser sees of the sync (the plan's step 4g):
// the status line with "Reconnect" in the slots the desk's pages leave for
// it (sync/status-line.js), and the notice that a stop only they can settle
// is never silent (sync/stopped-notice.js). Driven through the real
// connector over the fake service, as desk-sync-connector.test.js is.

import { test } from "node:test";
import assert from "node:assert/strict";

import "./helpers/browser-env.mjs";
import { count, freshBrowser, moment, note, until } from "./helpers/sync-browser.mjs";
import { changeKey, join } from "./helpers/fake-notebook-service.mjs";
import { firstDevice, testClock } from "./helpers/sync-rig.mjs";
import { SERVICES, SLOT_EVENT } from "../src/lib/desk-sync-link.mjs";
import { STOPPED_WORDS, TELL_AGAIN_MS } from "../src/lib/desk-sync-status.mjs";

const { openStore } = await import("../src/scripts/desk/store.js");
const sync = await import("../src/scripts/desk/sync/start.js");
const { openSyncDb } = await import("../src/scripts/desk/sync/sync-db.js");
const { STOPPED_ATTR } = await import("../src/scripts/desk/sync/stopped-notice.js");

const ctx = () => ({ client: "test-web", contentVersion: "2026.11.24" });
const state = (connector) => connector.status().state;
const html = () => document.documentElement;
const text = (el, sel) => el.querySelector(sel)?.textContent ?? null;

/** A page with the two slots the desk leaves, and the places the dot goes. */
function page() {
  document.body.innerHTML = `
    <button class="desk-tab" type="button">Notebook</button>
    <div class="desk-panel__tabs"><button data-tab="settings" type="button">Settings</button></div>
    <div id="settings"><div data-desk-sync-slot hidden></div></div>
    <div id="notebook-page" class="desk-np"><div data-desk-sync-slot hidden></div></div>`;
  return { settings: document.querySelector("#settings [data-desk-sync-slot]"), notebook: document.querySelector("#notebook-page [data-desk-sync-slot]") };
}

async function linkedPage({ timed = false } = {}) {
  const browser = freshBrowser();
  // With `timed`, the engine's own clock is the browser's `clock`, which a test moves (the other tests keep the real one).
  if (timed) browser.env.now = () => new Date(browser.clock.at).toISOString();
  await sync.setSyncEnv(browser.env);
  const slots = page();
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
  // In step, the account's notice (sync/account-notice.js) asks what is new, `GET /devices`, after
  // reads of its own storage and a keyring. The request is the page's, not the test's: once it has
  // reached the service, a test that counts the calls counts only what it did itself.
  await until(() => count(browser.service, "GET", "/devices") === 1, "the account notice's look at what is new");
  return { ...browser, slots, other, mine, store, connector };
}

/** The page closes and opens again: a new connector, started by the store, over the same storage. */
async function reopen(env) {
  await sync.setSyncEnv(env);
  const slots = page();
  const store = await openStore({ ctx });
  await until(async () => (await sync.currentSync()) != null, "the connector starting");
  return { slots, store, connector: await sync.currentSync() };
}

test("an unlinked browser's slots stay empty and hidden, and nothing is styled", async () => {
  const browser = freshBrowser();
  await sync.setSyncEnv(browser.env);
  const slots = page();
  await openStore({ ctx });
  document.dispatchEvent(new CustomEvent(SLOT_EVENT));
  await moment();
  assert.equal(slots.settings.hidden, true);
  assert.equal(slots.settings.childElementCount, 0);
  assert.equal(document.querySelector("style[data-desk-sync-style]"), null);
  assert.equal(html().hasAttribute(STOPPED_ATTR), false);
});

test("in step, every slot says so, with no button", async () => {
  const { slots } = await linkedPage();
  for (const slot of [slots.settings, slots.notebook]) {
    assert.equal(slot.hidden, false);
    assert.equal(text(slot, ".desk-sync__label"), "Sync");
    assert.equal(text(slot, ".desk-sync__line"), "Your notebook is in sync.");
    assert.match(text(slot, ".desk-sync__detail li"), /^Last synced at /);
    assert.equal(slot.querySelector(".desk-sync__again").hidden, true);
    assert.equal(slot.querySelector(".desk-sync").dataset.state, "ok");
    const group = slot.querySelector('[role="group"]');
    assert.equal(document.getElementById(group.getAttribute("aria-labelledby")).textContent, "Sync");
  }
  assert.equal(document.querySelectorAll("style[data-desk-sync-style]").length, 1);
  assert.equal(html().hasAttribute(STOPPED_ATTR), false);
});

test("offline shows what waits and “Reconnect,” which tries again and says how it went", async () => {
  const { service, timers, store, slots, connector } = await linkedPage();
  const slot = slots.settings;
  const button = slot.querySelector(".desk-sync__again");
  service.offline();
  await store.save(note("written offline"));
  await moment();
  await timers.fire((ms) => ms === 2000);
  await until(() => state(connector) === "offline", "offline");
  assert.equal(text(slot, ".desk-sync__line"), "You’re offline. Your notebook is in this browser, and 1 change will sync when you’re back online.");
  assert.equal(button.hidden, false);
  assert.equal(button.textContent, "Reconnect");
  assert.equal(slot.querySelector(".desk-sync").dataset.state, "stopped");
  assert.equal(text(slot, '[role="status"]'), text(slot, ".desk-sync__line"), "the change of state is said in the line's place");
  assert.equal(html().hasAttribute(STOPPED_ATTR), false, "offline mends itself: no dot, no notice");

  // Still offline: the press is taken, the pass runs, and the button comes back.
  const calls = service.calls.length;
  button.focus();
  button.click();
  assert.equal(button.getAttribute("aria-disabled"), "true", "busy, never disabled: it keeps focus");
  await until(() => service.calls.length > calls, "a request after the press");
  await connector.idle();
  await until(() => !button.hasAttribute("aria-disabled"), "the button free again");
  assert.equal(button.hidden, false);

  // Back online: the press syncs, the button goes, and focus moves to the line that says so.
  service.online();
  button.click();
  await until(() => state(connector) === "upToDate", "in step");
  assert.equal(button.hidden, true);
  assert.equal(text(slot, ".desk-sync__line"), "Your notebook is in sync.");
  assert.equal(document.activeElement.className, "desk-sync__line");
  assert.equal(service.account("reader").rows.size, 1);
});

test("a slot made later is drawn when the page says so, and all are emptied when the browser is unlinked", async () => {
  const { slots, store } = await linkedPage();
  const late = document.createElement("div");
  late.setAttribute("data-desk-sync-slot", "");
  late.hidden = true;
  document.body.append(late);
  document.dispatchEvent(new CustomEvent(SLOT_EVENT));
  assert.equal(late.hidden, false);
  assert.equal(text(late, ".desk-sync__line"), "Your notebook is in sync.");

  await sync.unlink({ store });
  for (const slot of [slots.settings, slots.notebook, late]) {
    assert.equal(slot.hidden, true);
    assert.equal(slot.childElementCount, 0);
  }
});

test("a sign-out is never silent: a dot, and a notice with the line's own words, once", async () => {
  const { service, bar, env, mine, connector } = await linkedPage();
  service.endSession(mine.token);
  await connector.syncNow();
  await until(() => bar.shown.length === 1, "the notice");
  assert.equal(html().getAttribute(STOPPED_ATTR), "stopped");
  assert.equal(document.querySelector(".desk-tab").getAttribute("aria-description"), STOPPED_WORDS);
  assert.equal(document.querySelector('[data-tab="settings"]').getAttribute("aria-description"), STOPPED_WORDS);
  assert.match(bar.shown[0].message, /^You’ve been signed out\. Your notebook is still in this browser/);
  assert.deepEqual(bar.shown[0].choices.map((c) => c.label), ["Reconnect"]);
  const db = await openSyncDb();
  assert.equal((await db.get("told")).state, "signedOut");

  // The next page says it with the dot and the line, and doesn't put the notice up again.
  const next = await reopen(env);
  await until(() => state(next.connector) === "signedOut", "signed out, on the next page");
  await moment();
  assert.equal(html().getAttribute(STOPPED_ATTR), "stopped");
  assert.match(text(next.slots.settings, ".desk-sync__line"), /^You’ve been signed out\./);
  assert.equal(next.slots.settings.querySelector(".desk-sync__again").hidden, false);
  assert.equal(bar.shown.length, 1);
  db.close();
});

test("a stop that still stands a day later is said again", async () => {
  const { service, bar, clock, env, mine, connector } = await linkedPage();
  service.endSession(mine.token);
  await connector.syncNow();
  await until(() => bar.shown.length === 1, "the notice");
  bar.up = false; // the reader closed it

  clock.at += TELL_AGAIN_MS - 60_000;
  let next = await reopen(env);
  await until(() => state(next.connector) === "signedOut", "signed out");
  await moment();
  assert.equal(bar.shown.length, 1, "not within the day");

  clock.at += 2 * 60_000;
  next = await reopen(env);
  await until(() => bar.shown.length === 2, "the notice, a day on");
});

test("“Reconnect” opens the account page for a stop only the reader can settle, and signing in again clears the stop", async () => {
  const { service, bar, went, mine, connector, slots } = await linkedPage();
  service.endSession(mine.token);
  await connector.syncNow();
  await until(() => bar.shown.length === 1, "the notice");

  // Another pass would end the same way, so neither button asks for one: each opens the account
  // page, which names the real step (BVJ, 2026-11-24).
  const calls = service.calls.length;
  await bar.press();
  assert.deepEqual(went, ["/account/"]);
  const button = slots.settings.querySelector(".desk-sync__again");
  assert.equal(button.hidden, false);
  button.click();
  assert.deepEqual(went, ["/account/", "/account/"]);
  assert.equal(button.hasAttribute("aria-disabled"), false, "no pass was started");
  await moment();
  assert.equal(service.calls.length, calls, "and nothing was asked of the service");
  assert.equal(bar.shown.length, 1, "nor the notice said again");

  // Signed in again (what the account page does): the stop is over everywhere it was said.
  await connector.setSession(service.signIn("reader"));
  await until(() => state(connector) === "upToDate", "in step");
  await until(() => !html().hasAttribute(STOPPED_ATTR), "the dot gone");
  assert.equal(document.querySelector(".desk-tab").hasAttribute("aria-description"), false);
  assert.equal(bar.up, false, "the notice came down");
  assert.equal(text(slots.settings, ".desk-sync__line"), "Your notebook is in sync.");
  const db = await openSyncDb();
  await until(async () => (await db.get("told")) === undefined, "what was told forgotten");
  db.close();
});

test("one stop that becomes another: the notice still up changes its words", async () => {
  const { service, bar, other, mine, connector, slots } = await linkedPage();
  service.endSession(mine.token);
  await connector.syncNow();
  await until(() => bar.shown.length === 1, "the notice");
  assert.match(bar.shown[0].message, /^You’ve been signed out\./);

  // Meanwhile this browser was removed from the notebook. The reader signs in again, the notice
  // still on the screen, and finds that out.
  await changeKey(service, other.by, { kept: [other.by], removed: [mine] });
  await connector.setSession(service.signIn("reader"));
  await until(() => state(connector) === "removed", "removed");
  await until(() => bar.shown.length === 2, "the notice for the new stop");
  assert.match(bar.shown[1].message, /^This browser was removed from your notebook’s devices/);
  assert.equal(bar.up, true);
  assert.match(text(slots.settings, ".desk-sync__line"), /^This browser was removed/);
  assert.equal(html().getAttribute(STOPPED_ATTR), "stopped");
  const db = await openSyncDb();
  assert.equal((await db.get("told")).state, "removed");
  db.close();
});

test("a stop another tab has said: a notice still up here from the stop before comes down", async () => {
  const { service, bar, clock, other, mine, connector } = await linkedPage();
  service.endSession(mine.token);
  await connector.syncNow();
  await until(() => bar.shown.length === 1, "the notice");

  // Another tab of this browser has said the new stop already.
  const db = await openSyncDb();
  await db.set({ told: { state: "removed", at: clock.at } });
  db.close();
  await changeKey(service, other.by, { kept: [other.by], removed: [mine] });
  await connector.setSession(service.signIn("reader"));
  await until(() => state(connector) === "removed", "removed");
  await until(() => bar.up === false, "the old notice down");
  assert.equal(bar.shown.length, 1, "and it isn't said twice");
});

test("a replaced notebook is said, and its “Reconnect” opens the account page too", async () => {
  const { service, bar, went, connector } = await linkedPage();
  const account = service.account("reader");
  account.notebook = "00000000-0000-4000-8000-000000000000";
  await connector.syncNow();
  await until(() => bar.shown.length === 1, "the notice");
  assert.equal(state(connector), "otherNotebook");
  assert.match(bar.shown[0].message, /^Your account’s notebook was replaced/);
  assert.match(bar.shown[0].message, /nothing in it was changed\./);

  await bar.press();
  assert.deepEqual(went, ["/account/"]);
  assert.equal(bar.notices.length, 0);
});

test("on the account page the stop is the page's to show: no notice, no button on the line, and the next page still says it", async () => {
  const { service, bar, env, mine, connector, slots } = await linkedPage();
  const account = document.createElement("div");
  account.setAttribute("data-account-page", "account");
  document.body.append(account);
  service.endSession(mine.token);
  await connector.syncNow();
  await until(() => state(connector) === "signedOut", "signed out");
  await moment();
  assert.equal(bar.shown.length, 0, "the page names the step itself");
  assert.equal(html().getAttribute(STOPPED_ATTR), "stopped", "the dot still shows");
  assert.match(text(slots.settings, ".desk-sync__line"), /^You’ve been signed out\./);
  assert.equal(slots.settings.querySelector(".desk-sync__again").hidden, true, "a button that opened this page would go nowhere");
  const db = await openSyncDb();
  assert.equal(await db.get("told"), undefined, "and it isn't counted as said");
  db.close();

  await reopen(env);
  await until(() => bar.shown.length === 1, "the notice, on the next page");
});

test("the notice waits its turn: never over a tour, another notice, or a sheet's page", async () => {
  const { service, timers, bar, mine, connector } = await linkedPage();
  html().setAttribute("data-desk-tour", "");
  service.endSession(mine.token);
  await connector.syncNow();
  await until(() => timers.waiting().includes(5000), "the notice waiting");
  assert.equal(bar.shown.length, 0);
  assert.equal(html().getAttribute(STOPPED_ATTR), "stopped", "the dot doesn't wait");

  // Still in the tour, and then another notice is up: it keeps waiting.
  await timers.fire((ms) => ms === 5000);
  await until(() => timers.waiting().includes(5000), "still waiting");
  html().removeAttribute("data-desk-tour");
  bar.up = true;
  await timers.fire((ms) => ms === 5000);
  await until(() => timers.waiting().includes(5000), "waiting for the other notice");
  assert.equal(bar.shown.length, 0);

  bar.up = false;
  await timers.fire((ms) => ms === 5000);
  await until(() => bar.shown.length === 1, "the notice, in its turn");
});

test("on a sheet's own page the notice never comes up, and the next page says it", async () => {
  const { service, timers, bar, env, mine, connector } = await linkedPage();
  const sheet = document.createElement("div");
  sheet.setAttribute("data-sheet-page", "");
  document.body.append(sheet);
  service.endSession(mine.token);
  await connector.syncNow();
  await until(() => timers.waiting().includes(5000), "the notice waiting");
  for (let i = 0; i < 30; i++) await timers.fire((ms) => ms === 5000);
  await moment();
  assert.equal(bar.shown.length, 0, "present mode is never interrupted");
  const db = await openSyncDb();
  assert.equal(await db.get("told"), undefined, "and it isn't counted as said");
  db.close();

  await reopen(env);
  await until(() => bar.shown.length === 1, "the notice, on the next page");
});

test("a failure that keeps coming is said after five passes in a row and ten minutes, with its reason, while the retries go on (SY9b-4)", async () => {
  const { service, timers, bar, clock, store, slots, connector } = await linkedPage({ timed: true });
  const slot = slots.settings;
  const button = slot.querySelector(".desk-sync__again");
  service.refuseAs("too_large");
  await store.save(note("a note the service will not take"));
  await moment();

  const fail = async (n) => {
    await connector.syncNow();
    await until(() => connector.status().state === "error" && connector.status().streak === n, `failed pass ${n}`);
    await connector.idle();
  };
  // Five in a row inside ten minutes, and six, say nothing.
  for (let n = 1; n <= 6; n++) {
    await fail(n);
    clock.at += 60_000;
    assert.equal(bar.shown.length, 0, `after ${n} failures in ${n - 1} minutes nothing is said`);
    assert.match(text(slot, ".desk-sync__line"), /^Sync ran into a problem and will try again\./);
  }
  assert.ok(connector.status().failingFor < 10 * 60_000);
  // The first failing pass after ten minutes since the first failure says it.
  clock.at += 4 * 60_000 + 1;
  await fail(7);
  await until(() => bar.shown.length === 1, "the notice after ten minutes");
  const words = "Sync keeps running into a problem, so changes made here aren’t syncing. They are saved in this browser. It will keep trying. If this goes on, let us know on the Contact page and mention “too_large.”";
  // (The test moves only the device's clock, so the clock notice follows the words as a further line.)
  assert.ok(bar.shown[0].message.startsWith(words), bar.shown[0].message);
  assert.equal(text(slot, ".desk-sync__line"), "Sync keeps running into a problem, so changes made here aren’t syncing. They are saved in this browser.");
  assert.equal(text(slot, ".desk-sync__detail li"), "It will keep trying. If this goes on, let us know on the Contact page and mention “too_large.”");
  assert.deepEqual(bar.shown[0].choices.map((c) => c.label), ["Reconnect"]);
  assert.equal(html().hasAttribute(STOPPED_ATTR), false, "no dot: nothing has stopped");
  assert.equal(button.hidden, false);

  // Retrying goes on behind the notice, and is said once, not at every failure.
  assert.ok(timers.waiting().length > 0, "a retry is waiting");
  const calls = service.calls.length;
  await timers.fire((ms) => ms >= 5000);
  await until(() => service.calls.length > calls, "a retry after the notice");
  await connector.idle();
  assert.equal(connector.status().streak, 8);
  assert.equal(bar.shown.length, 1, "said once");
  const db = await openSyncDb();
  assert.equal((await db.get("told")).state, "error:too_large");
  db.close();

  // A pass that succeeds starts the count over.
  service.refuseAs(null);
  await connector.syncNow();
  await until(() => state(connector) === "upToDate", "in step again");
  assert.equal(connector.status().streak, undefined);
});

test("a different reason starts the count and the time over, and so does a success", async () => {
  const { service, bar, clock, store, connector } = await linkedPage({ timed: true });
  await store.save(note("a note"));
  await moment();
  const pass = async () => {
    await connector.syncNow();
    await connector.idle();
  };
  service.refuseAs("too_large");
  for (let i = 0; i < 4; i++) await pass();
  assert.equal(connector.status().streak, 4);
  clock.at += 9 * 60_000;
  service.refuseAs("bad_request");
  await pass();
  assert.equal(connector.status().streak, 1, "another reason: one");
  assert.equal(connector.status().reason, "bad_request");
  assert.equal(connector.status().failingFor, 0, "and its time starts over");
  clock.at += 9 * 60_000;
  for (let i = 0; i < 4; i++) await pass();
  assert.equal(connector.status().streak, 5);
  assert.equal(connector.status().failingFor, 9 * 60_000, "five passes, but not ten minutes since the first of this reason");
  assert.equal(bar.shown.length, 0);
  service.refuseAs(null);
  await pass();
  assert.equal(state(connector), "upToDate");
  clock.at += 11 * 60_000;
  service.refuseAs("bad_request");
  await pass();
  assert.equal(connector.status().streak, 1, "a success in between: one");
  assert.equal(connector.status().failingFor, 0);
  assert.equal(bar.shown.length, 0);
});
