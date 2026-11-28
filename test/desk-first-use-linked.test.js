// test/desk-first-use-linked.test.js
//
// Step 4j: every sentence about where the notebook is kept is true whether or
// not this browser's notebook syncs with an account (step 4g's list; the words
// BVJ answered on 2026-11-25). Featherboa's Phase 5 took the first-time card
// away; the foot line, driven here in happy-dom with a fake store, is where
// the Notebook says where it is kept, and in a linked browser it never says
// "this browser only."

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom } from "./helpers/browser-env.mjs";

import {
  ACCOUNT_HREF, ACCOUNT_LINE, BACK_UP, KEPT_HERE, KEPT_LINKED, TOUR_STEPS, accountLineShown, backupLede, footLine, notebookIntro, savedLine, stepBody,
} from "../src/lib/desk-first-use.mjs";
import { SERVICES, SYNC_META, makeLink } from "../src/lib/desk-sync-link.mjs";

const { createFootLine, accountsOpen } = await import("../src/scripts/desk/first-use.js");
const { mountBackup } = await import("../src/scripts/desk/export-import.js");

const NOW = new Date("2026-11-25T12:00:00Z");
const LINK = makeLink({
  id: "0b7c3a52-5d0e-4c55-9d7a-1a2b3c4d5e6f",
  notebook: "6a1d2e3f-4b5c-4d6e-8f70-112233445566",
  service: SERVICES.preview,
  now: "2026-11-24T12:00:00.000Z",
});

/** A notebook, linked or not, holding `records`. */
function fakeStore({ linked = false, records = [], lastExport } = {}) {
  const meta = linked ? { [SYNC_META]: LINK } : {};
  if (lastExport) meta.lastExport = lastExport;
  const s = {
    entry: () => {},
    all: async () => records,
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

/** The foot line drawn for a store, with the page's account stamp set. */
async function draw({ linked = false, open = false, records = [], lastExport } = {}) {
  resetDom();
  localStorage.clear();
  setAccounts(open);
  const store = fakeStore({ linked, records, lastExport });
  const fl = createFootLine({ store, now: () => NOW });
  document.body.append(fl.el);
  await settle(10);
  return {
    fl,
    text: () => fl.el.querySelector(".desk-panel__foot-text").textContent,
    backUp: () => fl.el.querySelector(".desk-panel__backup"),
  };
}

/* ── The words ──────────────────────────────────────────────────────── */

test("the backup lines name the file once the notebook also syncs", () => {
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

test("UX9b-4: the account line shows only while accounts are open and the browser doesn't sync", () => {
  for (const [open, linked, shown] of [[true, false, true], [false, false, false], [true, true, false], [false, true, false]]) {
    assert.equal(accountLineShown(open, linked), shown, "accounts " + (open ? "open" : "closed") + ", " + (linked ? "linked" : "not linked"));
  }
  assert.equal(ACCOUNT_LINE, "Keep it in step across your devices with an account.");
  assert.equal(ACCOUNT_HREF, "/account/");
});

/* ── The foot line ──────────────────────────────────────────────────── */

for (const open of [false, true]) {
  test(`a browser that syncs is told it is kept here and in the account, never "this browser only" (accounts ${open ? "open" : "closed"})`, async () => {
    for (const records of [[], [{ kind: "note", created: "2026-01-01T00:00:00Z" }]]) {
      const { text, backUp } = await draw({ linked: true, open, records });
      assert.equal(text(), KEPT_LINKED);
      assert.doesNotMatch(text(), /only/);
      assert.equal(backUp().hidden, true, "the sync's own line has its own words, so no Back up link");
    }
  });
}

test("a linked foot line stays linked when a backup would be due, and an unlinked one says what it always did", async () => {
  const old = [{ kind: "note", created: "2026-01-01T00:00:00Z" }];
  const linked = await draw({ linked: true, records: old });
  assert.equal(linked.text(), KEPT_LINKED);
  assert.equal(linked.fl.el.hasAttribute("data-due"), false);
  const alone = await draw({ records: old });
  assert.equal(alone.text(), "Not backed up yet.");
  assert.equal(alone.fl.el.hasAttribute("data-due"), true);
  assert.equal(alone.backUp().hidden, false);
  assert.equal(alone.backUp().textContent, BACK_UP);
  const here = await draw({ records: [{ kind: "note", created: "2026-11-24T00:00:00Z" }] });
  assert.equal(here.text(), KEPT_HERE);
  assert.deepEqual(footLine({ hasRecords: true, linked: true, now: NOW }).text, KEPT_LINKED);
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
