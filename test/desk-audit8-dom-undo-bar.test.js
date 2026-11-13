// The notice bar (undo-bar.js) driven in a browser DOM (Audit 8, LG8-8): it
// closes itself after ten seconds but never while the pointer is over it or
// focus is on its buttons, Undo runs the callback, and what it says reaches the
// live region.

import { test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { settle } from "./helpers/browser-env.mjs";

const { showUndo, showNotice, announce, hideUndo, CLOSE_AFTER_MS } = await import("../src/scripts/desk/undo-bar.js");

const bar = () => document.querySelector(".desk-undo__bar");
const live = () => document.querySelector("[data-undo-live]");
const undoButton = () => document.querySelector(".desk-undo__undo");
const fire = (el, type) => el.dispatchEvent(new window.Event(type, { bubbles: true }));

beforeEach(() => {
  // The module keeps its bar across tests; close it and start from a clean page body.
  hideUndo();
  mock.timers.enable({ apis: ["setTimeout"] });
});
afterEach(() => {
  mock.timers.reset();
  hideUndo();
});

test("the bar closes by itself after the full time, and not before", () => {
  showUndo("Note deleted.", () => {});
  assert.equal(bar().hidden, false);
  assert.equal(document.querySelector(".desk-undo__text").textContent, "Note deleted.");
  mock.timers.tick(CLOSE_AFTER_MS - 1);
  assert.equal(bar().hidden, false, "still open just before the time is up");
  mock.timers.tick(1);
  assert.equal(bar().hidden, true);
});

test("focus on the bar's button holds it open; leaving starts the full time again", () => {
  showUndo("Note deleted.", () => {});
  undoButton().focus();
  fire(bar(), "focusin");
  mock.timers.tick(CLOSE_AFTER_MS * 3);
  assert.equal(bar().hidden, false, "never closes under the reader's focus");

  document.activeElement.blur();
  fire(bar(), "focusout");
  mock.timers.tick(1); // the release check runs after the event
  mock.timers.tick(CLOSE_AFTER_MS - 1);
  assert.equal(bar().hidden, false, "the time starts over when focus leaves");
  mock.timers.tick(1);
  assert.equal(bar().hidden, true);
});

test("a pointer over the bar holds it open until the pointer leaves", () => {
  showUndo("Note deleted.", () => {});
  fire(bar(), "pointerenter");
  mock.timers.tick(CLOSE_AFTER_MS * 2);
  assert.equal(bar().hidden, false);
  fire(bar(), "pointerleave");
  mock.timers.tick(1);
  mock.timers.tick(CLOSE_AFTER_MS);
  assert.equal(bar().hidden, true);
});

test("Undo runs the callback, then the bar closes and says it is done", async () => {
  mock.timers.reset();
  let ran = 0;
  showUndo("Note deleted.", async () => { ran++; });
  undoButton().click();
  await settle(60);
  assert.equal(ran, 1);
  assert.equal(bar().hidden, true);
  assert.equal(live().textContent, "Undone.");
});

test("an Undo that throws says nothing changed and stays open for another try", async () => {
  mock.timers.reset();
  const errors = mock.method(console, "error", () => {});
  try {
    let calls = 0;
    showUndo("Note deleted.", async () => { calls++; throw new Error("no"); });
    undoButton().click();
    await settle(60);
    assert.equal(bar().hidden, false);
    assert.match(document.querySelector(".desk-undo__text").textContent, /couldn’t be undone, so nothing changed/);
    assert.match(live().textContent, /nothing changed/);
    undoButton().click();
    await settle(60);
    assert.equal(calls, 2, "the button works again");
  } finally {
    errors.mock.restore();
  }
});

test("the spoken notice names the key that undoes, and a notice has no button", () => {
  showUndo("Note deleted.", () => {});
  mock.timers.tick(50);
  assert.match(live().textContent, /^Note deleted\. Press (Ctrl\+Z|⌘Z) to undo\.$/);
  assert.equal(undoButton().hidden, false);

  showNotice("That can’t be undone any more.");
  mock.timers.tick(50);
  assert.equal(live().textContent, "That can’t be undone any more.");
  assert.equal(undoButton().hidden, true);
  assert.equal(bar().hidden, false);
});

test("hideUndo(n) takes down only its own notice, never a newer one", () => {
  const first = showUndo("One.", () => {});
  const second = showNotice("Two.");
  hideUndo(first);
  assert.equal(bar().hidden, false, "the older notice's number leaves the newer bar up");
  hideUndo(second);
  assert.equal(bar().hidden, true);
});

test("when the bar closes with focus on its button, focus isn't left on a hidden element", () => {
  // happy-dom has no layout, so the opener never counts as showing and focus
  // falls to the page's main region, as the skip link does.
  const main = document.createElement("main");
  main.id = "main-content";
  document.body.append(main);
  showUndo("Note deleted.", () => {});
  document.querySelector(".desk-undo__close").focus();
  assert.equal(document.activeElement, document.querySelector(".desk-undo__close"));
  hideUndo();
  assert.equal(bar().hidden, true);
  assert.equal(document.activeElement, main);
  main.remove();
});

test("announce says the same message twice by emptying the region first", () => {
  announce("Nothing to undo.");
  assert.equal(live().textContent, "");
  mock.timers.tick(50);
  assert.equal(live().textContent, "Nothing to undo.");
  announce("Nothing to undo.");
  assert.equal(live().textContent, "", "emptied so a screen reader hears it again");
  mock.timers.tick(50);
  assert.equal(live().textContent, "Nothing to undo.");
});

test("E131: a keyless bar names no key and never closes by itself", () => {
  showUndo("Layout changed.", () => {}, { keyless: true });
  mock.timers.tick(50);
  assert.equal(live().textContent, "Layout changed.");
  mock.timers.tick(CLOSE_AFTER_MS * 6);
  assert.equal(bar().hidden, false, "still showing well past the closing time");
  assert.equal(undoButton().hidden, false);
});

test("E131: a keyless bar closes on Close and is replaced by the next notice; an ordinary one still closes", () => {
  // Earlier tests may leave the bar "held"; a release check clears it.
  showUndo("Setup.", () => {});
  fire(bar(), "focusout");
  mock.timers.tick(1);
  showUndo("Layout changed.", () => {}, { keyless: true });
  document.querySelector(".desk-undo__close").click();
  assert.equal(bar().hidden, true);
  mock.timers.tick(1); // a focusout's release check runs after the event

  showUndo("Layout changed.", () => {}, { keyless: true });
  showUndo("Note deleted.", () => {});
  mock.timers.tick(50);
  assert.match(live().textContent, /Press (Ctrl\+Z|⌘Z) to undo\.$/, "the ordinary bar names the key again");
  mock.timers.tick(CLOSE_AFTER_MS);
  assert.equal(bar().hidden, true, "and closes after ten seconds");

  showUndo("Layout changed.", () => {}, { keyless: true });
  showNotice("Plain.");
  mock.timers.tick(CLOSE_AFTER_MS);
  assert.equal(bar().hidden, true, "a notice replacing a keyless bar closes as notices do");
});

test("E131: a keyless bar's button runs its undo and closes the bar", async () => {
  mock.timers.reset();
  let ran = 0;
  showUndo("Layout changed.", () => { ran++; }, { keyless: true });
  undoButton().click();
  await settle(60);
  assert.equal(ran, 1);
  assert.equal(bar().hidden, true);
});

test("E127: a notice can carry a link that opens in a new tab, and the next notice drops it", () => {
  showNotice("There’s no room.", { link: { label: "Open the sheet", href: "/sheets/?id=a" } });
  const a = document.querySelector(".desk-undo__link");
  assert.equal(a.getAttribute("href"), "/sheets/?id=a");
  assert.equal(a.target, "_blank");
  assert.match(a.rel, /noopener/);
  assert.match(a.textContent, /^Open the sheet \(opens in a new tab\)$/);
  assert.equal(undoButton().hidden, true, "a notice has no Undo");
  showNotice("Plain.");
  assert.equal(document.querySelector(".desk-undo__link"), null);
});
