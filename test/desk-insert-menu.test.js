// The sheet gap pill's menu (src/scripts/desk/sheets/insert-menu.js; Audit 6, LG6-2):
// its lines and where it is placed.
import test from "node:test";
import assert from "node:assert/strict";
import { insertItems, insertMenuPlace } from "../src/scripts/desk/sheets/insert-menu.js";

test("the menu offers the add bar's parts, passage first", () => {
  assert.deepEqual(insertItems(false).map((x) => x.type), ["passage", "text", "question", "space", "pageBreak", "keyTerms"]);
  assert.equal(insertItems(false)[0].label, "Passage…");
  assert.ok(insertItems(false).every((x) => !x.disabled && x.why === null));
});

test("a sheet with a key terms box gets that line disabled, with its reason", () => {
  const terms = insertItems(true).find((x) => x.type === "keyTerms");
  assert.equal(terms.disabled, true);
  assert.equal(terms.why, "already on the sheet");
  assert.equal(insertItems(true).filter((x) => x.disabled).length, 1);
});

test("the menu opens under its pill where it fits, else above", () => {
  const view = { width: 1000, height: 800 };
  assert.deepEqual(insertMenuPlace({ left: 100, top: 200, bottom: 230 }, 200, 300, view), { left: 100, top: 234 });
  // Under it, 704 + 300 runs past 800 less 8, so above: 670 - 4 - 300.
  assert.deepEqual(insertMenuPlace({ left: 100, top: 670, bottom: 700 }, 200, 300, view), { left: 100, top: 366 });
});

test("a menu that fits on neither side takes the roomier one and scrolls, never past the window (E179)", () => {
  const view = { width: 1000, height: 800 };
  // 88px under the button and 88 over it: under, cut to 88.
  assert.deepEqual(insertMenuPlace({ left: 100, top: 100, bottom: 700 }, 200, 300, view), { left: 100, top: 704, maxHeight: 88 });
  // 258px under, 488 over: over, from 8px below the window's top.
  assert.deepEqual(insertMenuPlace({ left: 100, top: 500, bottom: 530 }, 200, 600, view), { left: 100, top: 8, maxHeight: 488 });
});

test("the menu stays 8px inside the window's sides", () => {
  const view = { width: 1000, height: 800 };
  assert.equal(insertMenuPlace({ left: 900, top: 0, bottom: 30 }, 200, 100, view).left, 792);
  assert.equal(insertMenuPlace({ left: -40, top: 0, bottom: 30 }, 200, 100, view).left, 8);
});
