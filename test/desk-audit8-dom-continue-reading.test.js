// The Notebook's "Continue reading" row (continue-reading.js) driven in a
// browser DOM (Audit 8, LG8-8): it draws where the reader stopped, leaves out
// what is on screen, follows the reader's saves, and lets go on destroy.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { settle } from "./helpers/browser-env.mjs";

const { continueSection } = await import("../src/scripts/desk/continue-reading.js");

const KEY = "lit_last_read";
const keep = (record) => window.localStorage.setItem(KEY, JSON.stringify({ v: 1, verse: null, t: 1, ...record }));
const rows = (s) => [...s.querySelectorAll("[data-place='continue']")];

beforeEach(() => {
  window.localStorage.clear();
  document.body.replaceChildren();
});

test("nothing read yet: the section stays hidden, or shows the empty text when given one", () => {
  const quiet = continueSection();
  assert.equal(quiet.hidden, true);
  assert.equal(rows(quiet).length, 0);
  const told = continueSection({ emptyText: "Nothing read yet." });
  assert.equal(told.hidden, false);
  assert.equal(told.querySelector(".desk-continue__empty").textContent, "Nothing read yet.");
  assert.equal(told.querySelector(".desk-continue__empty").hidden, false);
});

test("a kept place draws as a link to where the reader was, in the view it was kept in", () => {
  keep({ book: "john", chapter: 3, verse: 16, view: "study" });
  const s = continueSection();
  assert.equal(s.hidden, false);
  const [row] = rows(s);
  const link = row.querySelector("a");
  assert.equal(link.textContent, "John 3:16");
  assert.match(link.getAttribute("href"), /john-3/);
  assert.match(row.textContent, /Continue reading · Scripture page/);

  keep({ book: "john", chapter: 3, verse: null, view: "read" });
  const read = continueSection();
  assert.match(rows(read)[0].textContent, /Read View/);
  assert.match(rows(read)[0].querySelector("a").getAttribute("href"), /\/read\/john/);
});

test("the place already on screen is left out", () => {
  keep({ book: "john", chapter: 3, view: "study" });
  assert.equal(continueSection({ here: () => ({ bookKey: "john", chapter: 3 }) }).hidden, true);
  assert.equal(continueSection({ here: () => ({ bookKey: "john", chapter: 4 }) }).hidden, false);
  assert.equal(continueSection({ here: () => ({ bookKey: "john" }) }).hidden, true, "Read View names a whole book");
});

test("a damaged record in storage is treated as no place", () => {
  window.localStorage.setItem(KEY, "{not json");
  assert.equal(continueSection().hidden, true);
  keep({ book: "constructor", chapter: 1, view: "study" });
  assert.equal(continueSection().hidden, true);
});

test("refresh redraws at once from what storage holds now", () => {
  const s = continueSection();
  assert.equal(s.hidden, true);
  keep({ book: "mark", chapter: 2, view: "study" });
  s.refresh();
  assert.equal(rows(s)[0].querySelector("a").textContent, "Mark 2");
  window.localStorage.clear();
  s.refresh();
  assert.equal(rows(s).length, 0);
  assert.equal(s.hidden, true);
});

test("another tab's save (a storage event) redraws it, but only while it is in sight", () => {
  const s = continueSection();
  document.body.append(s);
  // happy-dom has no layout, so the section never counts as seen; give it a box.
  let seen = false;
  s.parentElement.getClientRects = () => (seen ? [{}] : []);
  keep({ book: "acts", chapter: 1, view: "study" });
  window.dispatchEvent(new window.StorageEvent("storage", { key: KEY }));
  assert.equal(rows(s).length, 0, "out of sight, it stays quiet");
  seen = true;
  window.dispatchEvent(new window.StorageEvent("storage", { key: KEY }));
  assert.equal(rows(s)[0].querySelector("a").textContent, "Acts 1");
  s.destroy();
});

test("destroy lets go of the page's events", async () => {
  const s = continueSection();
  document.body.append(s);
  s.parentElement.getClientRects = () => [{}];
  s.destroy();
  keep({ book: "acts", chapter: 2, view: "study" });
  window.dispatchEvent(new window.StorageEvent("storage", { key: KEY }));
  window.dispatchEvent(new window.CustomEvent("lit:last-read", {}));
  await settle(10);
  assert.equal(rows(s).length, 0, "a destroyed section no longer follows storage");
});
