// test/desk-tour-standing-bar.test.js
//
// A tour starting closes a bar that stays (BVJ, 2026-11-13, step l of the
// pass of 2026-11-12): the layout's keyless Undo (E131) and the backup
// reminder's choices (E113). Closing it that way is no answer, so the
// reminder's × handler doesn't run. A bar that closes by itself is left alone.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { settle } from "./helpers/browser-env.mjs";

const { createTourRunner } = await import("../src/scripts/desk/tour-runner.js");
const { showUndo, showChoices, hideUndo, barShowing } = await import("../src/scripts/desk/undo-bar.js");

const steps = [{ id: "one", title: "Step one", partName: "Part", number: 1, of: 1, nextPart: null, body: { default: "Words." } }];

let runner = null;
beforeEach(async () => {
  runner?.end();
  await settle(5);
  runner = createTourRunner();
  document.querySelector(".desk-tour")?.remove();
  document.documentElement.removeAttribute("data-desk-tour");
  hideUndo();
});

test("a tour starting closes the reminder's bar of choices, without counting as its ×", async () => {
  let closed = 0;
  let pressed = 0;
  showChoices("It’s been 9 days since you backed up your notebook.", [{ label: "Back up now", primary: true, onPress: () => pressed++ }], {
    onClose: () => closed++,
  });
  assert.equal(barShowing(), true);
  runner.start({ steps, act: async () => null });
  await settle(5);
  assert.equal(runner.running(), true);
  assert.equal(barShowing(), false, "the bar is closed");
  assert.equal(closed, 0, "the × handler (Remind me tomorrow) did not run");
  assert.equal(pressed, 0);
});

test("a tour starting closes a keyless Undo (a layout change, E131)", async () => {
  let undone = 0;
  showUndo("Book Intro shown in place of Greek.", () => undone++, { keyless: true });
  assert.equal(barShowing(), true);
  runner.start({ steps, act: async () => null });
  await settle(5);
  assert.equal(barShowing(), false);
  assert.equal(undone, 0, "closing is not pressing Undo");
});

test("a tour starting leaves an ordinary Undo, which closes by itself and stays on Ctrl+Z", async () => {
  showUndo("Note deleted.", () => {});
  runner.start({ steps, act: async () => null });
  await settle(5);
  assert.equal(barShowing(), true);
});
