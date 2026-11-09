// The bookmark form and the "Move it here" button, driven (Audit 8):
//   NB8-8   Save stays focusable and aria-disabled while it writes, and a second
//           press while busy does nothing
//   NB8-14  Enter confirming an input method's word doesn't save
//   XA8-4   "Move it here" has an accessible name that begins with its visible words

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom } from "./helpers/browser-env.mjs";
import { createRecord } from "../src/lib/desk-records.mjs";

const { openBookmarkForm } = await import("../src/scripts/desk/bookmark-form.js");
const { moveItHereButton } = await import("../src/scripts/desk/bookmark-stop.js");

const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const bookmark = () =>
  createRecord("bookmark", { bookKey: "john", chapter: 3, verse: 16, endVerse: 16 }, { now: "2026-11-09T12:00:00.000Z", ...ctx() });

/** A notebook whose `change` waits for the test to answer it. */
function heldStore() {
  const store = {
    changes: [],
    byChapter: async () => [],
    all: async () => [],
    lastEntry: () => null,
    change: (fn) =>
      new Promise((resolve, reject) => {
        store.changes.push({ resolve, reject });
      }),
  };
  return store;
}

function open(store) {
  resetDom();
  const trigger = document.body.appendChild(document.createElement("button"));
  const form = openBookmarkForm({ trigger, store, ctx, record: bookmark() });
  return {
    form,
    save: form.querySelector(".desk-editor__save"),
    name: form.querySelector(".desk-bookmark-form__name"),
    error: form.querySelector(".desk-editor__error"),
  };
}

test("NB8-8: Save keeps focus and is aria-disabled, not disabled, while it writes; a second press does nothing", async () => {
  const store = heldStore();
  const { save, error } = open(store);
  await settle(10);
  save.focus();
  save.click();
  await settle(10);
  assert.equal(store.changes.length, 1, "the press started one write");
  assert.equal(save.getAttribute("aria-disabled"), "true");
  assert.equal(save.disabled, false, "not `disabled`");
  assert.equal(document.activeElement, save, "focus stays on Save");
  save.click();
  await settle(10);
  assert.equal(store.changes.length, 1, "a press while busy starts no second write");

  store.changes[0].reject(new Error("quota"));
  await settle(10);
  assert.equal(error.hidden, false, "the failure is said in the form");
  assert.match(error.textContent, /couldn’t be saved in this browser/);
  assert.equal(save.hasAttribute("aria-disabled"), false, "Save is free to press again");
  assert.equal(document.activeElement, save, "focus never left Save");
  save.click();
  await settle(10);
  assert.equal(store.changes.length, 2, "and pressing it again writes again");
});

test("NB8-14: Enter that confirms an input method's word doesn't save; a plain Enter does", async () => {
  const store = heldStore();
  const { name } = open(store);
  await settle(10);
  name.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true, cancelable: true }));
  await settle(10);
  assert.equal(store.changes.length, 0, "composing Enter saves nothing");
  name.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  await settle(10);
  assert.equal(store.changes.length, 1, "plain Enter saves");
});

test("XA8-4: Move it here's accessible name begins with its visible words", () => {
  resetDom();
  const b = moveItHereButton({ id: "b1" }, "John 3:16");
  const visible = b.textContent.trim();
  assert.equal(visible, "Move it here");
  assert.ok(b.getAttribute("aria-label").startsWith(visible), b.getAttribute("aria-label"));
  assert.match(b.getAttribute("aria-label"), /John 3:16/, "and still names the row's bookmark");
});
