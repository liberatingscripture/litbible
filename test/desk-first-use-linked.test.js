// test/desk-first-use-linked.test.js
//
// Step 4j: every sentence about where the notebook is kept is true whether or
// not this browser's notebook syncs with an account, and the first-time card
// takes the form that fits (step 4g's list; the words BVJ answered on
// 2026-11-25). The card is driven in happy-dom with a fake store: closed
// accounts show the statement, open accounts the choice, and a linked browser
// neither, and isn't nudged toward it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom } from "./helpers/browser-env.mjs";

import {
  ACCOUNT_HREF, ACCOUNT_LINE, CARD_WORDS, HOME_KEY, TOUR_STEPS, WAYS_HREF, backupLede, keptLine, notebookIntro, nudgeLine, savedLine, stepBody,
} from "../src/lib/desk-first-use.mjs";
import { SERVICES, SYNC_META, makeLink } from "../src/lib/desk-sync-link.mjs";

const { createFirstUse, accountsOpen } = await import("../src/scripts/desk/first-use.js");
const { mountBackup } = await import("../src/scripts/desk/export-import.js");

const NOW = new Date("2026-11-25T12:00:00Z");
const LINK = makeLink({
  id: "0b7c3a52-5d0e-4c55-9d7a-1a2b3c4d5e6f",
  notebook: "6a1d2e3f-4b5c-4d6e-8f70-112233445566",
  service: SERVICES.preview,
  now: "2026-11-24T12:00:00.000Z",
});

/** A notebook with nothing in it, linked or not; `entry()` is the store's first write. */
function fakeStore({ linked = false } = {}) {
  const meta = linked ? { [SYNC_META]: LINK } : {};
  const s = {
    entry: () => {},
    all: async () => [],
    getMeta: async (key) => meta[key],
    onEntry: (fn) => {
      s.entry = fn;
      return () => {};
    },
  };
  return s;
}

function setAccounts(open) {
  if (open) document.documentElement.setAttribute("data-account", "open");
  else document.documentElement.removeAttribute("data-account");
}

async function draw({ linked = false, open = false } = {}) {
  resetDom();
  localStorage.clear();
  setAccounts(open);
  const store = fakeStore({ linked });
  let revealed = 0;
  const fu = createFirstUse({ store, reveal: () => revealed++ });
  document.body.append(fu.card, fu.foot);
  await settle(10);
  const [closedCard, askCard] = fu.card.querySelectorAll(".desk-home-card");
  return { fu, store, closedCard, askCard, revealed: () => revealed };
}

/* ── The words ──────────────────────────────────────────────────────── */

test("the Settings tab's lines name the file once the notebook also syncs", () => {
  assert.equal(keptLine(false), "Kept in this browser.");
  assert.equal(keptLine(true), "Kept in this browser and in your account.");
  assert.equal(savedLine(undefined, NOW), "Not backed up yet.");
  assert.equal(savedLine(undefined, NOW, { linked: true }), "Not backed up to a file yet.");
  assert.equal(savedLine("2026-11-22T12:00:00Z", NOW, { linked: true }), "Last backed up to a file 3 days ago.");
  assert.equal(savedLine("2026-11-22T12:00:00Z", NOW), "Last backed up 3 days ago.");
});

test("My Notebook's first line and its backup lead are true in both states", () => {
  assert.match(notebookIntro(false), /never leaves this browser unless you back it up\.$/);
  assert.doesNotMatch(notebookIntro(true), /never leaves/);
  assert.match(notebookIntro(true), /syncs with your account, locked with a key we never have\.$/);
  assert.match(backupLede(false), /Your notebook stays in this browser, and a browser can lose it/);
  assert.match(backupLede(true), /Your account keeps a synced copy too/);
  assert.match(backupLede(true), /back up your notebook now and then\.$/);
});

test("the tour's “kept” step says nothing is sent only where nothing is", () => {
  const kept = TOUR_STEPS.find((s) => s.id === "kept");
  for (const view of kept.views) {
    assert.match(stepBody(kept, view), /nothing is sent anywhere/);
    assert.doesNotMatch(stepBody(kept, view, { linked: true }), /nothing is sent/);
    assert.match(stepBody(kept, view, { linked: true }), /synced with your account, locked with a key we never have/);
  }
  // A step without words for a linked browser keeps its own.
  const other = TOUR_STEPS.find((s) => s.id !== "kept");
  assert.equal(stepBody(other, other.views[0], { linked: true }), stepBody(other, other.views[0]));
});

test("the nudge sends the reader to the card's choice only where accounts are open", () => {
  assert.equal(nudgeLine(false), "Your notebook is kept in this browser. See how to back it up.");
  assert.equal(nudgeLine(true), "Your notebook is kept in this browser. Choose where to keep it.");
});

test("the card's words follow the site's conventions", () => {
  const all = [...Object.values(CARD_WORDS.closed), ...Object.values(CARD_WORDS.open), CARD_WORDS.remind, CARD_WORDS.remindNote, CARD_WORDS.ways];
  for (const text of all) {
    assert.doesNotMatch(text, /["'—]/, text);
    assert.doesNotMatch(text, /”[.,]/, text);
  }
  assert.doesNotMatch(CARD_WORDS.closed.more, /being planned/);
});

/* ── The card ───────────────────────────────────────────────────────── */

test("accounts closed: the statement, which says an account is coming and isn't needed", async () => {
  const { closedCard, askCard } = await draw();
  assert.equal(accountsOpen(), false);
  assert.equal(closedCard.hidden, false);
  assert.equal(askCard.hidden, true);
  assert.equal(closedCard.querySelector("h3").textContent, CARD_WORDS.closed.title);
  const more = closedCard.querySelector(".desk-home-card__more");
  assert.ok(more.textContent.startsWith(CARD_WORDS.closed.more));
  assert.equal(more.querySelector("a").getAttribute("href"), WAYS_HREF);
  closedCard.querySelector(".desk-home-card__done").click();
  assert.equal(localStorage.getItem(HOME_KEY), "browser");
  assert.equal(closedCard.hidden, true, "answered, it goes");
});

test("accounts open: the choice, with no account plainly an answer", async () => {
  const { closedCard, askCard } = await draw({ open: true });
  assert.equal(closedCard.hidden, true);
  assert.equal(askCard.hidden, false);
  assert.equal(askCard.querySelector("h3").textContent, CARD_WORDS.open.title);
  const account = askCard.querySelector(".desk-home-card__account");
  assert.equal(account.getAttribute("href"), ACCOUNT_HREF);
  assert.equal(account.textContent, CARD_WORDS.open.account);
  assert.ok(askCard.querySelector(".desk-home-card__more").textContent.startsWith(CARD_WORDS.open.more));
  // Keeping it here, with the reminder, is the answer the card stores.
  askCard.querySelector(".desk-setting__input").click();
  const keep = [...askCard.querySelectorAll("button")].find((b) => b.textContent === CARD_WORDS.open.keep);
  keep.click();
  assert.equal(localStorage.getItem(HOME_KEY), "browser-remind");
  assert.equal(askCard.hidden, true);
});

for (const open of [false, true]) {
  test(`a browser that syncs shows neither form, and isn't nudged (accounts ${open ? "open" : "closed"})`, async () => {
    const { fu, store, closedCard, askCard, revealed } = await draw({ linked: true, open });
    assert.equal(closedCard.hidden, true);
    assert.equal(askCard.hidden, true);
    store.entry();
    assert.equal(revealed(), 0, "the first write doesn't point the reader at a card that isn't there");
    const kept = fu.foot.querySelector(".desk-panel__kept").textContent;
    assert.match(kept, /^Kept in this browser and in your account\. Not backed up to a file yet\./);
  });
}

test("an unlinked browser with no answer is nudged once, and its foot says what it always did", async () => {
  const { fu, store, revealed } = await draw();
  store.entry();
  store.entry();
  assert.equal(revealed(), 1);
  assert.match(fu.foot.querySelector(".desk-panel__kept").textContent, /^Kept in this browser\. Not backed up yet\./);
});

test("UX9b-4: the Settings tab's account line shows only while accounts are open and the browser doesn't sync", async () => {
  for (const [open, linked, shown] of [[true, false, true], [false, false, false], [true, true, false], [false, true, false]]) {
    const { fu } = await draw({ open, linked });
    const line = fu.foot.querySelector(".desk-home__account");
    assert.ok(line, "the line is in the foot");
    assert.equal(line.hidden, !shown, "accounts " + (open ? "open" : "closed") + ", " + (linked ? "linked" : "not linked"));
    const a = line.querySelector("a");
    assert.equal(a.getAttribute("href"), ACCOUNT_HREF);
    assert.equal(a.textContent, ACCOUNT_LINE);
    assert.equal(line.textContent, ACCOUNT_LINE, "the whole sentence is the link");
    assert.equal(a.getAttribute("target"), null, "it opens in the same tab");
  }
  assert.equal(ACCOUNT_LINE, "Keep it in step across your devices with an account.");
});

test("UX9b-7: the card's account link has no ellipsis", () => {
  assert.equal(CARD_WORDS.open.account, "Set up an account");
});

/* ── My Notebook's backup section ───────────────────────────────────── */

test("the backup section's lead follows the link", () => {
  const ctx = () => ({ client: "web/test", contentVersion: "v1" });
  for (const linked of [false, true]) {
    resetDom();
    const el = document.createElement("section");
    document.body.append(el);
    mountBackup(el, { store: fakeStore({ linked }), ctx, linked });
    assert.equal(el.querySelector("h2 + p").textContent, backupLede(linked));
  }
});
