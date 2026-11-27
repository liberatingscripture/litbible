// The Print menu (src/scripts/desk/print-menu.js, E16) driven in a browser DOM:
// a choice names a new tab only when it opens one (E136). In the Notebook on a
// chapter page, that chapter's choices print in place, so a link there must
// not carry target="_blank" and promise a tab it never opens.

import { test } from "node:test";
import assert from "node:assert/strict";
import "./helpers/browser-env.mjs";

const { createPrintMenu } = await import("../src/scripts/desk/print-menu.js");

const choices = (menu) => [...menu.el.querySelectorAll("[data-print]")].filter((a) => !a.hidden);

test("this page's chapter prints in place, so its choices carry no target", () => {
  const here = { bookKey: "john", chapter: 3 };
  const menu = createPrintMenu({ id: "t1", start: () => here, here, inPlace: { plain() {}, notes() {}, room() {} } });
  menu.open();
  assert.equal(choices(menu).length, 3);
  for (const a of choices(menu)) {
    assert.equal(a.getAttribute("target"), null, `${a.dataset.print} opens no tab`);
    assert.match(a.getAttribute("href"), /^\/john-3\/\?print=/, "the address stays, for a middle click");
  }
});

test("another chapter opens a new tab, and opening the menu again at this page's takes the target off", () => {
  const here = { bookKey: "john", chapter: 3 };
  let at = { bookKey: "romans", chapter: 8 };
  const menu = createPrintMenu({ id: "t2", start: () => at, here, inPlace: { plain() {}, notes() {}, room() {} } });
  menu.open();
  for (const a of choices(menu)) assert.equal(a.getAttribute("target"), "_blank");
  at = here;
  menu.open();
  for (const a of choices(menu)) assert.equal(a.getAttribute("target"), null);
});

test("on /desk, with no chapter of its own, every choice opens a new tab", () => {
  const menu = createPrintMenu({ id: "t3", start: () => ({ bookKey: "mark", chapter: 1 }) });
  menu.open();
  for (const a of choices(menu)) {
    assert.equal(a.getAttribute("target"), "_blank");
    assert.equal(a.getAttribute("rel"), "noopener");
  }
});

test("Read View's book choices are buttons, with no target", () => {
  const menu = createPrintMenu({ id: "t4", book: "john", inPlace: { plain() {}, notes() {}, room() {} } });
  menu.open();
  for (const b of choices(menu)) {
    assert.equal(b.tagName, "BUTTON");
    assert.equal(b.getAttribute("target"), null);
  }
});
