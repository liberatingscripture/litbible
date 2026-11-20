// The Sheets and Collections panes' header link to their own page (E180; BVJ,
// 2026-11-19: "have an Open sheets page and Open collections page button on
// the header of their respective panes"). Which kinds have one is data
// (`page` in KINDS, read by kindPage); a press on the link opens the page and
// never starts dragging the pane by its header.

import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDom } from "./helpers/browser-env.mjs";

const { KINDS, kindPage, originalLayout, panes } = await import("../src/lib/desk-layout.mjs");
const { startPaneMove } = await import("../src/scripts/desk/pane-move.js");

test("the Sheets and Collections kinds name their list pages; no other kind has one", () => {
  assert.deepEqual(kindPage("sheet"), { href: "/sheets/", name: "Sheets page" });
  assert.deepEqual(kindPage("collection"), { href: "/collections/", name: "Collections page" });
  for (const k of KINDS) {
    if (k.kind === "sheet" || k.kind === "collection") continue;
    assert.equal(kindPage(k.kind), null, `${k.kind} has no page link`);
  }
  assert.equal(kindPage("future"), null, "an unknown kind has none");
  for (const k of KINDS.filter((x) => x.page)) {
    assert.match(k.page.href, /^\/[a-z]+\/$/, "a page on this site, by path");
    assert.match(k.page.name, /^[A-Z][a-z]+ page$/);
  }
});

function twoPanes() {
  resetDom();
  let layout = originalLayout("john 3:16");
  const [a, b] = panes(layout.root);
  const panesBox = document.body.appendChild(document.createElement("div"));
  panesBox.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600 });
  const paneEls = new Map();
  for (const [p, left] of [[a, 0], [b, 600]]) {
    const el = panesBox.appendChild(document.createElement("section"));
    el.className = "desk-pane";
    el.dataset.paneId = p.id;
    el.getBoundingClientRect = () => ({ left, top: 0, width: left ? 400 : 600, height: 600, right: left ? 1000 : 600, bottom: 600 });
    const head = el.appendChild(document.createElement("div"));
    head.className = "desk-pane__head";
    head.setPointerCapture = () => {};
    const link = head.appendChild(document.createElement("a"));
    link.className = "desk-pane__page";
    link.href = "/sheets/";
    link.append(document.createElement("span"));
    paneEls.set(p.id, { el, head, link });
  }
  const drop = panesBox.appendChild(document.createElement("div"));
  drop.hidden = true;
  const miss = panesBox.appendChild(document.createElement("div"));
  miss.hidden = true;
  const committed = [];
  document.elementsFromPoint = () => [paneEls.get(b.id).el];
  const opts = {
    getLayout: () => layout,
    panesBox, paneEls, drop, miss,
    commit: (next) => { committed.push(next); layout = next; },
    announce: () => {},
  };
  // Press `on` (the header or something in it), then move over the other pane.
  const pressAndMove = (on) => {
    const head = paneEls.get(a.id).head;
    head.addEventListener("pointerdown", (ev) => startPaneMove(ev, a.id, opts), { once: true });
    on.dispatchEvent(new PointerEvent("pointerdown", { button: 0, clientX: 100, clientY: 100, bubbles: true }));
    head.dispatchEvent(new PointerEvent("pointermove", { clientX: 800, clientY: 300, bubbles: true }));
    head.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  };
  return { a, paneEls, drop, miss, committed, pressAndMove };
}

test("a press on the header's page link, or on its glyph, never drags the pane", () => {
  const { a, paneEls, drop, miss, committed, pressAndMove } = twoPanes();
  pressAndMove(paneEls.get(a.id).link.firstElementChild);
  assert.equal(drop.hidden, true, "no drop box");
  assert.equal(miss.hidden, true);
  assert.equal(committed.length, 0, "nothing moved");
  assert.equal(document.documentElement.classList.contains("desk-ws--moving"), false);
});

test("the header itself still drags", () => {
  const { a, paneEls, committed, pressAndMove } = twoPanes();
  pressAndMove(paneEls.get(a.id).head);
  assert.equal(committed.length, 1, "the drag still works from the header");
});
