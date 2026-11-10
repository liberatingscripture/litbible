// Audit 8, XA8-1: every line the desk lets a reader drag also works by click
// (WCAG 2.5.7). A press that doesn't move, or Enter, opens a menu of steps on
// the line (line-menu.js); the Greek tab's line is driven here end to end.
// The floating window's grip button is in float-window.test.js.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { settle, resetDom } from "./helpers/browser-env.mjs";

const { CLICK_SLOP, clickOrDrag, lineLimit, lineMenuPlace, toggleLineMenu } = await import(
  "../src/scripts/desk/line-menu.js"
);

test("lineLimit reads the end a line has reached from its ARIA values", () => {
  assert.equal(lineLimit({ now: 75, min: 25, max: 75 }), "max");
  assert.equal(lineLimit({ now: 25, min: 25, max: 75 }), "min");
  assert.equal(lineLimit({ now: 50, min: 25, max: 75 }), null);
  // Rounded values within half a unit count as there.
  assert.equal(lineLimit({ now: 74.6, min: 25, max: 75 }), "max");
  // Unknown values block nothing.
  assert.equal(lineLimit({ now: NaN, min: 25, max: 75 }), null);
  assert.equal(lineLimit({ now: 50, min: NaN, max: NaN }), null);
});

test("lineMenuPlace opens beside the line, flips where it doesn't fit, and stays inside the window", () => {
  const view = { width: 1000, height: 800 };
  // A vertical line: to the right of the press.
  assert.deepEqual(lineMenuPlace({ x: 400, y: 300 }, "vertical", 180, 120, view), { left: 412, top: 284 });
  // Near the right edge it opens to the left instead.
  assert.deepEqual(lineMenuPlace({ x: 900, y: 300 }, "vertical", 180, 120, view), { left: 708, top: 284 });
  // A horizontal line: below, or above near the bottom.
  assert.deepEqual(lineMenuPlace({ x: 400, y: 300 }, "horizontal", 180, 120, view), { left: 384, top: 312 });
  assert.deepEqual(lineMenuPlace({ x: 400, y: 750 }, "horizontal", 180, 120, view), { left: 384, top: 618 });
  // Never past the window's edges.
  const p = lineMenuPlace({ x: 2, y: 2 }, "vertical", 180, 120, view);
  assert.ok(p.left >= 8 && p.top >= 8);
});

function line() {
  const h = document.createElement("div");
  h.setAttribute("role", "separator");
  h.tabIndex = 0;
  h.setPointerCapture = () => {};
  document.body.append(h);
  return h;
}

function pointer(target, type, x, y) {
  target.dispatchEvent(new window.PointerEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true }));
}

test("clickOrDrag: a press that doesn't move is a click, and writes nothing", () => {
  resetDom();
  const h = line();
  const seen = [];
  h.addEventListener("pointerdown", (e) =>
    clickOrDrag(h, e, { move: () => seen.push("move"), end: () => seen.push("end"), click: () => seen.push("click") }),
  );
  pointer(h, "pointerdown", 100, 100);
  pointer(h, "pointermove", 100 + CLICK_SLOP - 1, 100);
  pointer(h, "pointerup", 100 + CLICK_SLOP - 1, 100);
  assert.deepEqual(seen, ["end", "click"]);
});

test("clickOrDrag: past the slop it is a drag, and no click follows", () => {
  resetDom();
  const h = line();
  const seen = [];
  h.addEventListener("pointerdown", (e) =>
    clickOrDrag(h, e, { move: () => seen.push("move"), end: () => seen.push("end"), click: () => seen.push("click") }),
  );
  pointer(h, "pointerdown", 100, 100);
  pointer(h, "pointermove", 120, 100);
  pointer(h, "pointerup", 120, 100);
  assert.deepEqual(seen, ["move", "end"]);
  // The listeners are gone: a later move does nothing.
  pointer(h, "pointermove", 140, 100);
  assert.deepEqual(seen, ["move", "end"]);
});

test("clickOrDrag: a drag closes the line's open menu", () => {
  resetDom();
  const h = line();
  const m = toggleLineMenu(h, { label: "L", more: "More", less: "Less", step: () => {}, at: { x: 10, y: 10 } });
  h.addEventListener("pointerdown", (e) => clickOrDrag(h, e, { move: () => {}, click: () => {} }));
  pointer(h, "pointerdown", 100, 100);
  assert.ok(m.menu.isConnected, "pressing the line leaves it");
  pointer(h, "pointermove", 120, 100);
  assert.equal(m.menu.isConnected, false, "dragging puts it away");
  pointer(h, "pointerup", 120, 100);
});

function values(h, now, min = 25, max = 75) {
  h.setAttribute("aria-valuenow", String(now));
  h.setAttribute("aria-valuemin", String(min));
  h.setAttribute("aria-valuemax", String(max));
}

test("the menu: two steps that keep it open, then a reset that closes it", async () => {
  resetDom();
  const h = line();
  values(h, 50);
  const steps = [];
  let resets = 0;
  const m = toggleLineMenu(h, {
    label: "Text width",
    more: "Wider text",
    less: "Narrower text",
    step: (dir) => steps.push(dir),
    reset: { label: "Reset widths", run: () => resets++ },
    at: { x: 100, y: 100 },
  });
  const menu = m.menu;
  assert.equal(menu.getAttribute("role"), "menu");
  assert.equal(menu.getAttribute("aria-label"), "Text width");
  assert.equal(h.getAttribute("aria-controls"), menu.id);
  const items = [...menu.querySelectorAll('[role="menuitem"]')];
  assert.deepEqual(items.map((b) => b.textContent), ["Wider text", "Narrower text", "Reset widths"]);
  assert.equal(document.activeElement, items[0], "focus goes to the first step");

  items[0].click();
  items[1].click();
  assert.deepEqual(steps, [1, -1]);
  assert.ok(menu.isConnected, "a step leaves the menu open");

  items[2].click();
  assert.equal(resets, 1);
  assert.equal(menu.isConnected, false, "the reset closes it");
  assert.equal(document.activeElement, h, "and focus goes back to the line");
  assert.equal(h.hasAttribute("aria-controls"), false);
});

test("the menu: a step at its end is disabled with its reason, and the menu says so", async () => {
  resetDom();
  const h = line();
  values(h, 70);
  const m = toggleLineMenu(h, {
    label: "Entry size",
    more: "Larger entry",
    less: "Smaller entry",
    step: () => values(h, 75),
    at: { x: 100, y: 100 },
  });
  const [larger, smaller] = m.menu.querySelectorAll('[role="menuitem"]');
  assert.equal(larger.hasAttribute("aria-disabled"), false);
  larger.click();
  await settle(5);
  assert.equal(larger.getAttribute("aria-disabled"), "true", "at the top, Larger is disabled");
  assert.match(larger.textContent, /goes no further/);
  assert.equal(smaller.hasAttribute("aria-disabled"), false);
  const why = document.getElementById(m.menu.getAttribute("aria-describedby"));
  assert.match(why.textContent, /^Larger entry is unavailable: it goes no further\.$/);
  assert.equal(document.activeElement, smaller, "focus moved off the disabled step");
  // No reset was given, so none is offered.
  assert.equal(m.menu.querySelectorAll('[role="menuitem"]').length, 2);
});

test("the menu: Escape closes it back to the line; a second click on the line closes it", () => {
  resetDom();
  const h = line();
  values(h, 50);
  const opts = { label: "L", more: "More", less: "Less", step: () => {}, at: { x: 10, y: 10 } };
  const m = toggleLineMenu(h, opts);
  m.menu.querySelector('[role="menuitem"]').dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
  );
  assert.equal(m.menu.isConnected, false);
  assert.equal(document.activeElement, h);

  const again = toggleLineMenu(h, opts);
  assert.ok(again.menu.isConnected);
  assert.equal(toggleLineMenu(h, opts), null, "toggling an open menu closes it");
  assert.equal(again.menu.isConnected, false);
});

// The Greek tab, driven: Enter on its line opens the menu, the steps move the
// line a tenth of the room, and "Let the entry size itself" is the reset.
const greekRoot = new URL("../public/", import.meta.url);
globalThis.fetch = async (url) => {
  const path = String(url).replace(/^https?:\/\/[^/]+/, "").replace(/^\//, "").split("?")[0];
  const file = new URL(path, greekRoot);
  if (!path.startsWith("greek/") || !existsSync(file)) return { ok: false, status: 404, json: async () => ({}) };
  const text = readFileSync(file, "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(text) };
};

test("the Greek tab's line: Enter opens its menu; the steps and the reset work", async () => {
  resetDom();
  sessionStorage.clear();
  const { createGreekTab } = await import("../src/scripts/desk/tab-greek.js");
  document.body.innerHTML = `<div class="chapter-paragraphs"></div>`;
  const t = createGreekTab({ here: { bookKey: "john", chapter: 3, label: "John 3" }, visible: () => true, openVerse: () => {} });
  document.body.append(t.el);
  await t.render();
  await settle(30);
  const split = t.el.querySelector(".desk-greek__split");
  split.focus();
  split.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  const menu = document.getElementById(split.getAttribute("aria-controls"));
  assert.ok(menu, "Enter opened the line's menu");
  let items = [...menu.querySelectorAll('[role="menuitem"]')];
  // The entry sizes itself to start with, so there is nothing to reset yet.
  assert.deepEqual(items.map((b) => b.textContent), ["Larger entry", "Smaller entry"]);
  items[0].click();
  await settle(5);
  // happy-dom has no layout, so the measured share is the even split, 50.
  assert.equal(split.getAttribute("aria-valuenow"), "60");
  assert.equal(sessionStorage.getItem("lit-desk-greek-split"), "0.6");
  items[0].click();
  items[0].click();
  items[0].click();
  await settle(5);
  assert.equal(split.getAttribute("aria-valuenow"), "75", "held at the top bound");
  assert.equal(items[0].getAttribute("aria-disabled"), "true");

  // Closed and reopened (by Space this time), it offers the reset.
  menu.querySelector('[role="menuitem"]:not([aria-disabled])').dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
  );
  split.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
  const again = document.getElementById(split.getAttribute("aria-controls"));
  items = [...again.querySelectorAll('[role="menuitem"]')];
  assert.equal(items.at(-1).textContent, "Let the entry size itself");
  items.at(-1).click();
  await settle(5);
  assert.equal(sessionStorage.getItem("lit-desk-greek-split"), null, "the kept share is forgotten");
  assert.equal(t.el.hasAttribute("data-split"), false);
});
