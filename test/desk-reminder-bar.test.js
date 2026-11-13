// test/desk-reminder-bar.test.js
//
// The backup reminder's bar (src/scripts/desk/reminder.js, E113) driven in a
// browser DOM: each choice writes the right state and says the right words,
// the × is "Remind me tomorrow", the bar does not close by itself, and a
// notice that replaces it still works.

import { test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { settle, window as happyWindow } from "./helpers/browser-env.mjs";

const resetDomUrl = () => happyWindow.happyDOM.setURL("http://localhost/");

const { startReminder, stopReminder, paintDots, DOT_ATTR } = await import("../src/scripts/desk/reminder.js");
const { hideUndo } = await import("../src/scripts/desk/undo-bar.js");

const NOW = new Date("2026-11-13T15:30:00");
const iso = (daysAgo) => new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString();

let backedUp;
beforeEach(() => {
  stopReminder();
  hideUndo();
  // The bar's root is built once and kept by the module, so it stays; the rest goes.
  for (const el of [...document.body.children]) if (!el.classList.contains("desk-undo")) el.remove();
  resetDomUrl();
  document.documentElement.removeAttribute("data-desk-tour");
  localStorage.clear();
  localStorage.setItem("lit-desk-home", "browser-remind");
  backedUp = 0;
});

const start = (facts, extra = {}) =>
  startReminder({
    surface: "reading",
    getFacts: async () => facts,
    backUp: async () => { backedUp++; return { exported: NOW.toISOString(), name: "lit-notebook-2026-11-13.json" }; },
    now: () => NOW,
    ...extra,
  });
const due = { lastExport: iso(9), hasRecords: true, oldest: iso(60) };

const bar = () => document.querySelector(".desk-undo__bar");
const text = () => document.querySelector(".desk-undo__text")?.textContent;
const labels = () => [...document.querySelectorAll(".desk-undo__choices button")].map((b) => b.textContent);
const press = async (label) => {
  const b = [...document.querySelectorAll(".desk-undo__choices button")].find((x) => x.textContent === label);
  assert.ok(b, `a "${label}" button`);
  b.click();
  await settle(5);
};
const stored = () => {
  const raw = localStorage.getItem("lit-desk-remind");
  return raw ? JSON.parse(raw) : null;
};

test("a due reminder shows the bar with its four choices and the days", async () => {
  await start(due);
  await settle();
  assert.equal(bar().hidden, false);
  assert.equal(text(), "It’s been 9 days since you backed up your notebook.");
  assert.deepEqual(labels(), ["Back up now", "Remind me tomorrow", "Not this week", "Turn off reminders"]);
  assert.equal(document.querySelectorAll(".desk-undo__choice--primary").length, 1);
  assert.equal(document.querySelector(".desk-undo__choice--primary").textContent, "Back up now");
});

test("nothing shows when not due, when off, in a tour, or when the notebook is empty", async () => {
  await start({ lastExport: iso(2), hasRecords: true, oldest: iso(60) });
  await settle();
  assert.equal(barOrNull(), false);
  stopReminder();

  localStorage.setItem("lit-desk-home", "browser");
  await start(due);
  await settle();
  assert.equal(barOrNull(), false);
  stopReminder();

  localStorage.setItem("lit-desk-home", "browser-remind");
  document.documentElement.setAttribute("data-desk-tour", "");
  await start(due);
  await settle();
  assert.equal(barOrNull(), false);
  stopReminder();
  document.documentElement.removeAttribute("data-desk-tour");

  await start({ lastExport: null, hasRecords: false, oldest: null });
  await settle();
  assert.equal(barOrNull(), false);
});
function barOrNull() {
  const b = bar();
  return Boolean(b && !b.hidden);
}

test("a notebook never backed up says so", async () => {
  await start({ lastExport: null, hasRecords: true, oldest: iso(30) });
  await settle();
  assert.equal(text(), "You haven’t backed up your notebook yet.");
});

test("Back up now makes the file, clears the put-off, and says it is done", async () => {
  localStorage.setItem("lit-desk-remind", JSON.stringify({ until: "2099-01-01T00:00:00.000Z", kind: "tomorrow" }));
  await start(due); // a stale put-off would hold the bar; "tomorrow" in the far future does
  await settle();
  assert.equal(barOrNull(), false, "put off");
  stopReminder();
  localStorage.removeItem("lit-desk-remind");

  await start(due);
  await settle();
  await press("Back up now");
  assert.equal(backedUp, 1);
  assert.equal(text(), "Started the download of lit-notebook-2026-11-13.json. Your browser may ask where to keep it.");
  assert.equal(stored(), null);
  const dotted = document.createElement("button");
  dotted.className = "desk-tab";
  document.body.append(dotted);
  paintDots();
  assert.equal(dotted.hasAttribute(DOT_ATTR), false, "no dot once backed up");
});

test("Remind me tomorrow keeps the dot, and the put-off lasts until tomorrow", async () => {
  const tab = document.createElement("button");
  tab.className = "desk-tab";
  document.body.append(tab);
  await start(due);
  await settle();
  assert.equal(tab.hasAttribute(DOT_ATTR), true);
  assert.equal(tab.getAttribute("aria-description"), "Backup due");
  await press("Remind me tomorrow");
  assert.equal(stored().kind, "tomorrow");
  assert.equal(stored().until, new Date(2026, 10, 14).toISOString());
  assert.equal(barOrNull(), false);
  assert.equal(tab.hasAttribute(DOT_ATTR), true, "the dot stays");
});

test("the × does what Remind me tomorrow does", async () => {
  await start(due);
  await settle();
  document.querySelector(".desk-undo__close").click();
  await settle(5);
  assert.equal(stored()?.kind, "tomorrow");
  assert.equal(barOrNull(), false);
});

test("Not this week puts the dot away as well", async () => {
  const tab = document.createElement("button");
  tab.className = "desk-tab";
  document.body.append(tab);
  await start(due);
  await settle();
  await press("Not this week");
  const put = stored();
  assert.equal(put.kind, "week");
  assert.equal(Date.parse(put.until) - NOW.getTime(), 7 * 86_400_000);
  assert.equal(tab.hasAttribute(DOT_ATTR), false);
  assert.equal(tab.hasAttribute("aria-description"), false);
});

test("Turn off reminders turns them off and says where to turn them on", async () => {
  await start(due);
  await settle();
  await press("Turn off reminders");
  assert.equal(localStorage.getItem("lit-desk-home"), "browser");
  assert.equal(stored(), null);
  assert.equal(text(), "Reminders are off. You can turn them on again in the Notebook’s Settings.");
  assert.equal(barOrNull(), true, "the notice stays up to be read");
  assert.equal(document.querySelector(".desk-undo__choices"), null, "its choices are gone");
});

test("on /desk, turning reminders off adds where the Settings are", async () => {
  await start(due, { surface: "desk" });
  await settle();
  await press("Turn off reminders");
  assert.equal(text(), "Reminders are off. You can turn them on again in the Notebook’s Settings on a Scripture page.");
});

test("the bar does not close by itself", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    await start(due);
    mock.timers.tick(1000);
    await Promise.resolve();
    mock.timers.tick(60_000);
    assert.equal(barOrNull(), true);
    assert.equal(stored(), null, "nothing is put off by waiting");
  } finally {
    mock.timers.reset();
  }
});

test("a failed backup says so and leaves the choices to try again", async () => {
  const spy = mock.method(console, "error", () => {});
  try {
    await start(due, { backUp: async () => { throw new Error("blocked"); } });
    await settle();
    await press("Back up now");
    assert.equal(text(), "That didn’t work. Try again.");
    assert.equal(labels().length, 4);
    assert.equal(document.querySelector(".desk-undo__choice--primary").getAttribute("aria-disabled"), null);
  } finally {
    spy.mock.restore();
  }
});

test("a choice made in another tab comes through the storage event", async () => {
  await start(due);
  await settle();
  assert.equal(barOrNull(), true);
  localStorage.setItem("lit-desk-remind", JSON.stringify({ until: new Date(NOW.getTime() + 86_400_000).toISOString(), kind: "week" }));
  window.dispatchEvent(new window.StorageEvent("storage", { key: "lit-desk-remind" }));
  await settle(5);
  assert.equal(barOrNull(), false, "the bar comes down");
});

test("a page still in its first stage gets the desk's stylesheet only when the bar comes up", async () => {
  // The bar's look is desk.css, which a reading page otherwise adds only with the shell.
  const deskStyles = () => document.querySelectorAll("style[data-desk]").length;
  for (const s of document.querySelectorAll("style[data-desk]")) s.remove();
  await start({ lastExport: iso(2), hasRecords: true, oldest: iso(60) });
  await settle();
  assert.equal(deskStyles(), 0, "not due: nothing loaded");
  stopReminder();

  await start(due);
  await settle();
  assert.equal(barOrNull(), true);
  assert.equal(deskStyles(), 1, "due: desk.css, once");
});
