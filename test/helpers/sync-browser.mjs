// test/helpers/sync-browser.mjs
//
// A browser for the connector's tests (the plan's step 4g): the real store
// (desk/store.js) and the real sync storage over fake-indexeddb, the real
// carrier (sync/service.js) over the fake service's `fetch`, and stand-ins
// for the three things a test has to hold still: timers (fired by hand), the
// Web Lock that picks the tab that syncs, and the notice bar. Import
// ./browser-env.mjs before this file.

import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";

import { createRecord } from "../../src/lib/desk-records.mjs";
import { createFakeService } from "./fake-notebook-service.mjs";
import { resetDom } from "./browser-env.mjs";

/** Timers a test fires by hand. `waiting()` lists the delays still set. */
export function handTimers() {
  const list = [];
  return {
    set(fn, ms) {
      const t = { fn, ms, live: true };
      list.push(t);
      return t;
    },
    clear(t) {
      if (t) t.live = false;
    },
    /** Fires every timer set now that `pick` takes (all of them, with none), oldest first. Returns how many. */
    async fire(pick = () => true) {
      const due = list.filter((t) => t.live && pick(t.ms));
      for (const t of due) {
        t.live = false;
        await t.fn();
      }
      return due.length;
    },
    waiting: () => list.filter((t) => t.live).map((t) => t.ms),
  };
}

/** Web Locks, as far as the connector uses them: one holder of a name at a time, the next when it lets go. */
export function fakeLocks() {
  const tails = new Map();
  return {
    request(name, fn) {
      const before = tails.get(name) ?? Promise.resolve();
      const run = before.then(() => fn());
      tails.set(
        name,
        run.then(
          () => {},
          () => {},
        ),
      );
      return run;
    },
  };
}

/** The notice bar (desk/undo-bar.js), as far as the stopped notice uses it. */
export function fakeBar() {
  const bar = {
    /** Every bar of choices put up: { message, choices, n }. */
    shown: [],
    /** Every plain notice put up. */
    notices: [],
    up: false,
    n: 0,
    showChoices(message, choices) {
      bar.up = true;
      bar.n += 1;
      bar.shown.push({ message, choices, n: bar.n });
      return bar.n;
    },
    showNotice(message) {
      bar.up = true;
      bar.n += 1;
      bar.notices.push(message);
      return bar.n;
    },
    hideUndo(n) {
      if (n === undefined || n === bar.n) bar.up = false;
    },
    barShowing: () => bar.up,
    /** The reader presses the latest bar's first choice; the bar closes when the press is done, as the real one does. */
    async press() {
      const latest = bar.shown.at(-1);
      await latest.choices[0].onPress();
      if (bar.n === latest.n) bar.up = false;
    },
  };
  return bar;
}

/** Waits until `check` is true, looking every few milliseconds. */
export async function until(check, what = "what the test waited for") {
  for (let i = 0; i < 600; i++) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.fail(`${what} never happened`);
}

/** A moment for messages between tabs and work already asked for. */
export const moment = (ms = 30) => new Promise((r) => setTimeout(r, ms));

let seq = 0;
/** A note as the desk writes one, stamped a few seconds ago so no clock in a test calls it ahead. */
export function note(body = `note ${++seq}`, fields = {}) {
  return createRecord(
    "note",
    { bookKey: "john", chapter: 3, verse: 16, body, marker: "note", ...fields },
    { now: new Date(Date.now() - 5000 + ++seq).toISOString(), client: "test-web", contentVersion: "2026.11.24" },
  );
}

// The channel class browser-env.mjs left (it doesn't hold the process open).
const BaseChannel = globalThis.BroadcastChannel;
let browsers = 0;

/**
 * A fresh browser: an empty IndexedDB, an empty page at the dev server's
 * address (the one a local service answers), a service, and the stand-ins.
 * `env` is what the sync's code takes in place of the browser's own parts.
 */
export function freshBrowser() {
  globalThis.indexedDB = new IDBFactory();
  // Each browser has its own channels: a store left open by an earlier test
  // (a store is never closed) must not hear this browser's tabs, as it would
  // by name alone, all of them being in one process.
  const browser = ++browsers;
  globalThis.BroadcastChannel = class extends BaseChannel {
    constructor(name) {
      super(`${name}#${browser}`);
    }
  };
  resetDom("http://localhost:4321/john-3/");
  document.documentElement.removeAttribute("data-desk-sync");
  document.documentElement.removeAttribute("data-desk-tour");
  document.head.querySelector("style[data-desk-sync-style]")?.remove();
  const service = createFakeService();
  const timers = handTimers();
  const bar = fakeBar();
  const clock = { at: Date.now() };
  const logged = [];
  const env = {
    fetch: service.fetch,
    locks: fakeLocks(),
    setTimer: timers.set,
    clearTimer: timers.clear,
    bar: async () => bar,
    nowMs: () => clock.at,
    log: (...args) => logged.push(args),
  };
  return { service, timers, bar, clock, env, logged };
}

/** The records a store holds that aren't trash, as their bodies, sorted. */
export const bodies = async (store) => (await store.all()).filter((r) => r.kind === "note").map((r) => r.body).sort();

/** How many requests of one kind the service has had. */
export const count = (service, method, path) => service.calls.filter((c) => c.method === method && c.path.startsWith(path)).length;
