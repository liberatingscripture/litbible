// test/desk-first-use-linked-wiring.test.js
//
// What carries "accounts open" and "this browser syncs" from the page to the
// words step 4j wrote (Audit 9, UX9b-1). test/desk-first-use-linked.test.js
// holds the words as pure functions; these drive the three places that read
// the state and pass it on: the panel's nudge after a first write, the tour's
// "kept" step, and My Notebook's first line, with the shell's one line that
// hands the tour the store. A change that dropped any of them would tell a
// synced reader again that nothing is sent anywhere.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { IDBFactory } from "fake-indexeddb";
import { settle, resetDom, window } from "./helpers/browser-env.mjs";

import { TOUR_STEPS, stepBody } from "../src/lib/desk-first-use.mjs";
import { notebookIntro } from "../src/lib/desk-reminder.mjs";
import { SERVICES, SYNC_META, makeLink } from "../src/lib/desk-sync-link.mjs";

// An open channel keeps node alive; the stores here are never closed.
const RealChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = class extends RealChannel {
  constructor(name) {
    super(name);
    this.unref();
  }
};

const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const LINK = makeLink({
  id: "0b7c3a52-5d0e-4c55-9d7a-1a2b3c4d5e6f",
  notebook: "6a1d2e3f-4b5c-4d6e-8f70-112233445566",
  service: SERVICES.preview,
  now: "2026-11-24T12:00:00.000Z",
});

/** A store with nothing in it; `meta` is its kept settings, `entry()` its first write. */
function fakeStore(meta = {}) {
  const s = {
    meta,
    entry: () => {},
    byChapter: async () => [],
    all: async () => [],
    get: async () => null,
    getMeta: async (key) => s.meta[key],
    subscribe: () => () => {},
    onEntry: (fn) => {
      s.entry = fn;
      return () => {};
    },
    onMeta: () => () => {},
    persisted: async () => true,
    lastEntry: () => null,
  };
  return s;
}

async function until(fn, tries = 100) {
  for (let i = 0; i < tries; i++) {
    const v = fn();
    if (v) return v;
    await settle(10);
  }
  throw new Error("timed out waiting for the page");
}

// The panel is too large to stand up here (and createPanel does not yet build in happy-dom: see the
// report on panel.js's `shown`), so the lines that hand the foot line the store are read as text. The
// foot line's own words, linked and not, are driven in test/desk-first-use-linked.test.js.
test("the panel builds its foot line from the store, so the foot line can read the link, and gives the sync's slot its place", () => {
  const src = readFileSync(new URL("../src/scripts/desk/panel.js", import.meta.url), "utf8");
  assert.match(src, /createFootLine\(\{\s*store\s*[,}]/);
  assert.match(src, /foot\.showSlot\(\)/);
});

for (const linked of [false, true]) {
  test(`My Notebook's first line says where the notebook is kept (${linked ? "a browser that syncs" : "this browser alone"})`, async () => {
    globalThis.indexedDB = new IDBFactory();
    if (linked) {
      // Linked as the account pages link it: the link in the notebook's own settings.
      const { openStore } = await import(`../src/scripts/desk/store.js?seed=${linked}`);
      const store = await openStore({ ctx });
      await store.setMeta(SYNC_META, LINK);
    }
    resetDom("http://localhost/notebook/");
    document.documentElement.dataset.contentVersion = "v1";
    document.body.innerHTML = `<h1 class="notebook-page__title">Notebook</h1><div data-notebook-page></div>`;
    await import(`../src/scripts/desk/notebook-page.js?linked=${linked}`);
    // The page drawn to its end, as test/desk-audit8-dom-search-notebook.test.js waits for it.
    await until(() => document.querySelector("[data-np-new-label]"));
    await settle(20);
    const intro = document.querySelector(".desk-np__intro");
    assert.equal(intro.textContent, notebookIntro(linked));
    if (linked) assert.doesNotMatch(intro.textContent, /never leaves/);
  });
}

test("the tour's “kept” step reads whether this browser syncs, as the page opens and on coming back to the window", async () => {
  resetDom();
  sessionStorage.clear();
  localStorage.clear();
  document.body.innerHTML = `<main><h1>Glossary</h1></main><aside id="deskPanel"></aside>`;
  const panel = {
    el: document.getElementById("deskPanel"),
    snapshot: () => ({}),
    restore: () => {},
    isOpen: () => true,
    showTab: () => true,
    showGreekWord: null,
  };
  // A browser that syncs as the page opens.
  const store = fakeStore({ [SYNC_META]: LINK });
  const { createTour } = await import("../src/scripts/desk/tour.js");
  const { COMMAND_EVENT } = await import("../src/scripts/desk/first-use.js");
  createTour({ panel, store });
  await settle(10);
  const kept = TOUR_STEPS.find((s) => s.id === "kept");

  const bodyOfKept = async () => {
    document.dispatchEvent(new CustomEvent(COMMAND_EVENT, { detail: { id: "tour", only: ["kept"] } }));
    await settle(50);
    const card = document.querySelector(".desk-tour");
    assert.ok(card, "the tour card is up");
    const body = card.querySelector(".desk-tour__body").textContent;
    card.querySelector(".desk-tour__skip").click();
    await settle(50);
    return body;
  };

  const linked = await bodyOfKept();
  assert.equal(linked, stepBody(kept, "prose", { linked: true }));
  assert.doesNotMatch(linked, /nothing is sent/);

  // Unlinked in another tab (Stop syncing, or signing out); the reader comes back to this one.
  store.meta = {};
  window.dispatchEvent(new window.Event("focus"));
  await settle(10);
  const alone = await bodyOfKept();
  assert.equal(alone, stepBody(kept, "prose"));
  assert.match(alone, /nothing is sent anywhere/);
});

// The shell is too large to stand up here, so its one line that hands the tour the store is read as
// text, as test/desk-notebook-panel.test.js reads the panel's.
test("the shell hands the tour the store, so the tour can read the link", () => {
  const src = readFileSync(new URL("../src/scripts/desk/shell.js", import.meta.url), "utf8");
  const call = /createTour\((\{[^}]*\})\)/.exec(src)?.[1];
  assert.ok(call, "the shell starts the tour");
  assert.match(call, /[{,]\s*store\s*[:,}]/);
});
