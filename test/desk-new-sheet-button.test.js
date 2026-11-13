// The "New sheet" button while the template chooser is open (E121; BVJ,
// 2026-11-12): it reads "Cancel", takes the ordinary control's look instead of
// the primary green, and says whether the chooser is open. Every way the
// chooser opens or closes (the button, Cancel, Escape, a template picked) goes
// through the one toggle, so the label, the class and aria-expanded stay in step.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle } from "./helpers/browser-env.mjs";

const { mySheetsList } = await import("../src/scripts/desk/sheets/my-sheets.js");

/** A Sheets pane's list over an empty store, with the host's calls recorded. */
function paneList() {
  const content = document.createElement("div");
  const picked = [];
  const host = {
    store: { remove: async () => null, get: async () => null, save: async () => {}, lastEntry: () => null },
    opCtx: () => ({ now: new Date().toISOString(), client: "web/test", contentVersion: "v1" }),
    idSuffix: "e121",
    say: () => {},
    content,
    openSheet: async () => {},
    startFrom: (template) => picked.push(template),
    showList: async () => {},
    onTour: null,
  };
  const { list } = mySheetsList(host, { sheets: [], mine: [] });
  content.append(list);
  document.body.replaceChildren(content);
  return { content, picked };
}

/** The button's state, as the reader meets it: its name, its look and its disclosure. */
function stateOf(button) {
  return {
    name: button.textContent,
    primary: button.classList.contains("desk-sheet__btn--primary"),
    ordinary: button.classList.contains("desk-sheet__btn"),
    expanded: button.getAttribute("aria-expanded"),
  };
}

test("New sheet reads Cancel, in the ordinary white look, while the chooser is open, and back again when it shuts", async () => {
  const { content } = paneList();
  const fresh = content.querySelector(".desk-sheet__list-head button");
  const chooser = content.querySelector(".desk-sheet__templates");

  assert.deepEqual(stateOf(fresh), { name: "New sheet", primary: true, ordinary: true, expanded: "false" });
  assert.equal(chooser.hidden, true);

  fresh.click();
  await settle();
  assert.equal(chooser.hidden, false);
  assert.deepEqual(stateOf(fresh), { name: "Cancel", primary: false, ordinary: true, expanded: "true" });
  assert.equal(document.activeElement === chooser.querySelector("button"), true, "focus moves into the chooser, as before");

  fresh.click();
  await settle();
  assert.equal(chooser.hidden, true);
  assert.deepEqual(stateOf(fresh), { name: "New sheet", primary: true, ordinary: true, expanded: "false" });
  assert.equal(document.activeElement === fresh, true, "Cancel by the button returns focus to it");
});

test("Cancel inside the chooser and Escape both shut it and restore the button", async () => {
  const { content } = paneList();
  const fresh = content.querySelector(".desk-sheet__list-head button");
  const chooser = content.querySelector(".desk-sheet__templates");

  fresh.click();
  await settle();
  const cancel = [...chooser.querySelectorAll("button")].find((b) => b.textContent === "Cancel");
  cancel.click();
  await settle();
  assert.equal(chooser.hidden, true);
  assert.equal(stateOf(fresh).name, "New sheet");
  assert.equal(stateOf(fresh).primary, true);

  fresh.click();
  await settle();
  chooser.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await settle();
  assert.equal(chooser.hidden, true);
  assert.deepEqual(stateOf(fresh), { name: "New sheet", primary: true, ordinary: true, expanded: "false" });
});

test("picking a template shuts the chooser and hands the choice on; the button is restored", async () => {
  const { content, picked } = paneList();
  const fresh = content.querySelector(".desk-sheet__list-head button");
  const chooser = content.querySelector(".desk-sheet__templates");

  fresh.click();
  await settle();
  chooser.querySelector("button").click();
  await settle();
  assert.equal(picked.length, 1, "the host is handed one template");
  assert.equal(chooser.hidden, true);
  assert.equal(stateOf(fresh).name, "New sheet");
  assert.equal(stateOf(fresh).primary, true);
});

test("the chooser's own toggle, as the tour and the editor call it, keeps the button in step", async () => {
  const { content } = paneList();
  const fresh = content.querySelector(".desk-sheet__list-head button");
  const chooser = content.querySelector(".desk-sheet__templates");

  chooser.toggle();
  await settle();
  assert.equal(stateOf(fresh).name, "Cancel");
  assert.equal(stateOf(fresh).primary, false);
  chooser.toggle();
  await settle();
  assert.equal(stateOf(fresh).name, "New sheet");
  assert.equal(stateOf(fresh).expanded, "false");
});
