// Present mode keeps the screen on (E233), driven in a browser DOM with a
// stubbed Screen Wake Lock (`navigator.wakeLock`): the room's window
// (`openPresentation`, here as a phone presents a shared sheet, by taps) and
// the presenter view (`showPresenterView`) each take a lock when they open,
// take it again after the page is hidden and shown (the browser lets it go
// while hidden), and the room's window lets it go on close. Where the API is
// missing or refuses, present mode runs as before and nothing throws.
//
// happy-dom can't sleep a screen: a real phone is the only true check.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle } from "./helpers/browser-env.mjs";
import { createSheet, makeModule } from "../src/lib/desk-sheets.mjs";

// The presenter view's clock ticks every second; it mustn't keep node alive.
const realInterval = globalThis.setInterval;
globalThis.setInterval = (fn, ms, ...args) => {
  const t = realInterval(fn, ms, ...args);
  t.unref?.();
  return t;
};
// A sheet of text parts reads no chapter; anything else is a test mistake.
globalThis.fetch = window.fetch = async () => new Response("", { status: 404 });

const { openPresentation, showPresenterView } = await import("../src/scripts/desk/sheets/sheet-present.js");

const ctx = () => ({ now: new Date().toISOString(), client: "web/test", contentVersion: "v1" });
const sheet = () => createSheet({
  title: "Study",
  modules: [makeModule("text", { html: "<p>First part</p>" }), makeModule("text", { html: "<p>Second part</p>" })],
}, ctx());

// The page's visibility, as the browser would set it.
let visibility = "visible";
Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
Object.defineProperty(document, "hidden", { configurable: true, get: () => visibility === "hidden" });

/** A Screen Wake Lock that keeps every lock it gives out. `gate` holds a request until called. */
function installWakeLock({ refuse = null, gate = null } = {}) {
  const given = [];
  const types = [];
  const api = {
    request(type) {
      types.push(type);
      if (refuse === "throw") throw new TypeError("not here");
      if (refuse) return Promise.reject(new DOMException("Refused", "NotAllowedError"));
      const lock = new window.EventTarget(); // happy-dom's, to match its Event
      lock.type = type;
      lock.released = false;
      lock.release = async () => {
        if (lock.released) return;
        lock.released = true;
        lock.dispatchEvent(new Event("release"));
      };
      given.push(lock);
      return gate ? gate.then(() => lock) : Promise.resolve(lock);
    },
  };
  Object.defineProperty(navigator, "wakeLock", { configurable: true, value: api });
  return {
    types,
    given,
    held: () => given.filter((l) => !l.released),
  };
}

function removeWakeLock() {
  Object.defineProperty(navigator, "wakeLock", { configurable: true, value: undefined });
}

/** The page hidden, as the browser does it: every lock let go, then the event. */
async function hidePage(fake) {
  visibility = "hidden";
  for (const lock of fake?.held() ?? []) await lock.release();
  document.dispatchEvent(new Event("visibilitychange"));
  await settle();
}

async function showPage() {
  visibility = "visible";
  document.dispatchEvent(new Event("visibilitychange"));
  await settle();
}

test("the room's window holds the screen on while it presents, asks again after the page is hidden, and lets go on close", async () => {
  document.body.replaceChildren();
  visibility = "visible";
  const fake = installWakeLock();
  const { close } = await openPresentation({ sheet: sheet(), store: null, fullscreen: false, touch: true });
  await settle();
  assert.deepEqual(fake.types, ["screen"], "one screen lock asked for on open");
  assert.equal(fake.held().length, 1, "and held");

  await hidePage(fake);
  assert.equal(fake.given.length, 1, "nothing asked for while the page is hidden");
  assert.equal(fake.held().length, 0);

  await showPage();
  assert.equal(fake.given.length, 2, "asked for again when the page shows");
  assert.equal(fake.held().length, 1);

  // A second "visible" with the lock still held asks for nothing more.
  await showPage();
  assert.equal(fake.given.length, 2);

  close();
  await settle();
  assert.equal(fake.held().length, 0, "closing present mode lets the lock go");
  assert.ok(!document.querySelector(".present-stage"), "the stage is gone");

  await hidePage(fake);
  await showPage();
  assert.equal(fake.given.length, 2, "once closed, showing the page asks for nothing");
});

test("closing before the browser answers lets the late lock go", async () => {
  document.body.replaceChildren();
  visibility = "visible";
  let answer;
  const fake = installWakeLock({ gate: new Promise((r) => { answer = r; }) });
  const { close } = await openPresentation({ sheet: sheet(), store: null, fullscreen: false });
  close();
  answer();
  await settle();
  assert.equal(fake.given.length, 1);
  assert.equal(fake.held().length, 0, "the lock that came after the close was let go");
});

test("the presenter view holds the screen on too, and asks again after the page is hidden", async () => {
  visibility = "visible";
  const fake = installWakeLock();
  const root = document.createElement("div");
  document.body.replaceChildren(root);
  await showPresenterView({ root, sheet: sheet(), store: null });
  await settle();
  assert.deepEqual(fake.types, ["screen"]);
  assert.equal(fake.held().length, 1);

  await hidePage(fake);
  assert.equal(fake.held().length, 0);
  await showPage();
  assert.equal(fake.given.length, 2);
  assert.equal(fake.held().length, 1);
  window.dispatchEvent(new Event("pagehide")); // closes its channel
});

test("without the API, or when it refuses, present mode opens, steps, and closes as before", async () => {
  for (const setUp of [removeWakeLock, () => installWakeLock({ refuse: "reject" }), () => installWakeLock({ refuse: "throw" })]) {
    document.body.replaceChildren();
    visibility = "visible";
    const fake = setUp();
    const { close } = await openPresentation({ sheet: sheet(), store: null, fullscreen: false, touch: true });
    await settle();
    const where = document.querySelector(".present-stage__where");
    assert.equal(where.textContent, "1 of 3");
    document.querySelector('.present-stage button[aria-label="Next"]').click();
    await settle();
    assert.equal(where.textContent, "2 of 3", "the presentation still steps");
    await hidePage(fake);
    await showPage();
    if (fake) {
      assert.deepEqual(fake.types, ["screen", "screen"], "asked on open and again on showing, refused both times");
      assert.equal(fake.given.length, 0, "a refusal holds nothing");
    }
    close();
    await settle();
    assert.ok(!document.querySelector(".present-stage"));
  }
});
