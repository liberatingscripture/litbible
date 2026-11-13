// test/desk-tour-placement.test.js
//
// Where the tour runner puts its card (src/scripts/desk/tour-runner.js), with
// the sizes measured on the Sheets page at 1280 by 768 stubbed in, since
// happy-dom lays nothing out. A step marked `tight` whose target leaves no room
// on either side gets its card above the target, right edges level (BVJ,
// 2026-11-13: the Sheets tour's parts and passage steps on /sheets hid the
// minutes box, the × and the Add button); without `tight`, or with room beside
// the target (a Sheets pane on /desk), the card goes beside it as before.

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { settle, window } from "./helpers/browser-env.mjs";

const { createTourRunner } = await import("../src/scripts/desk/tour-runner.js");

const steps = [{ id: "one", title: "Step one", partName: "Part", number: 1, of: 1, nextPart: null, body: { default: "Words." } }];
const CARD = { width: 340, height: 311 };
const proto = window.HTMLElement.prototype;
const saved = {
  offsetWidth: Object.getOwnPropertyDescriptor(proto, "offsetWidth"),
  offsetHeight: Object.getOwnPropertyDescriptor(proto, "offsetHeight"),
};

let runner = null;
beforeEach(() => {
  Object.defineProperty(document.documentElement, "clientWidth", { value: 1280, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 768, configurable: true });
  const sized = (name, fallback) => ({
    configurable: true,
    get() {
      return this.classList?.contains("desk-tour") ? CARD[name] : fallback.get.call(this);
    },
  });
  Object.defineProperty(proto, "offsetWidth", sized("width", saved.offsetWidth));
  Object.defineProperty(proto, "offsetHeight", sized("height", saved.offsetHeight));
  document.querySelector(".desk-tour")?.remove();
  document.documentElement.removeAttribute("data-desk-tour");
  runner = createTourRunner();
});

afterEach(async () => {
  runner?.end();
  await settle(5);
  Object.defineProperty(proto, "offsetWidth", saved.offsetWidth);
  Object.defineProperty(proto, "offsetHeight", saved.offsetHeight);
  delete document.documentElement.clientWidth;
});

/** A target drawn at `rect`, in the page so the runner counts it as connected. */
function target(rect) {
  const el = document.createElement("div");
  document.body.append(el);
  el.getBoundingClientRect = () => ({ ...rect, width: rect.right - rect.left, height: rect.bottom - rect.top, x: rect.left, y: rect.top });
  return el;
}

async function cardAt(result) {
  runner.start({ steps, act: async () => result });
  await settle(20);
  const card = document.querySelector(".desk-tour");
  return { left: card.style.left, top: card.style.top };
}

// The Sheets page's first part: the column runs 170 to 1095 in a 1280 window.
const sheetsPart = { left: 170, right: 1095, top: 381, bottom: 541 };

test("a tight step whose target fills the column puts the card above it, right edges level", async () => {
  const at = await cardAt({ el: target(sheetsPart), side: "left", tight: true });
  assert.deepEqual(at, { left: `${1095 - 340}px`, top: `${381 - 12 - 311}px` });
});

test("with no room above, a tight step's card goes below the target", async () => {
  const at = await cardAt({ el: target({ left: 170, right: 1095, top: 200, bottom: 300 }), side: "left", tight: true });
  assert.deepEqual(at, { left: `${1095 - 340}px`, top: `${300 + 12}px` });
});

test("without tight, the card is pushed over the target's side, as the other tours' steps are", async () => {
  const at = await cardAt({ el: target(sheetsPart), side: "left" });
  assert.deepEqual(at, { left: `${1280 - 340 - 12}px`, top: `${381 + 8}px` });
});

test("a tight step with room beside its target (a Sheets pane on /desk) keeps the card beside it", async () => {
  const at = await cardAt({ el: target({ left: 859, right: 1216, top: 545, bottom: 770 }), side: "left", tight: true });
  assert.equal(at.left, `${859 - 340 - 12}px`);
});
