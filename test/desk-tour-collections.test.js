// The Study Desk tour's two collection cards (D13, decision 22's second answer;
// BVJ, 2026-11-19: "Add to the desk tour"), driven with the real tour and
// runner over a stand-in page: the first shows a Collections pane for the
// step and takes it away, the second opens the LIT pane's verse menu at its
// "Add to collection" row and closes it, and the reader's layout comes back.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom } from "./helpers/browser-env.mjs";

const { createDeskTour } = await import("../src/scripts/desk/desk-tour.js");
const { originalLayout, panes, setKind } = await import("../src/lib/desk-layout.mjs");
const { currentPanel, showPanel } = await import("../src/scripts/lit-panel.js");

const rect = (r) => () => ({ ...r, width: r.right - r.left, height: r.bottom - r.top, x: r.left, y: r.top });

test("the collection cards show a Collections pane, then the verse menu's Add to collection, and leave nothing behind", async () => {
  resetDom();
  localStorage.clear();
  sessionStorage.clear();

  const panesBox = document.createElement("div");
  panesBox.getBoundingClientRect = rect({ left: 0, right: 1400, top: 100, bottom: 900 });
  document.body.append(panesBox);

  // The reader's own layout: the original, with My Notes turned to Greek.
  const mine = setKind(originalLayout("john 3:16"), "p2", "greek");
  let layout = mine;
  const paneEls = new Map();
  const menuOpened = [];

  // Each pane drawn as desk-page.js draws its record: a header button and a body.
  function draw() {
    panesBox.replaceChildren();
    paneEls.clear();
    for (const pane of panes(layout.root)) {
      const el = document.createElement("section");
      const kindButton = document.createElement("button");
      kindButton.textContent = pane.kind;
      const body = document.createElement("div");
      body.getBoundingClientRect = rect({ left: 0, right: 700, top: 140, bottom: 880 });
      if (pane.kind === "lit") {
        body.innerHTML = `<p><sup class="vn" id="p1-john-3-v16">16</sup> For God so loved the world.</p>`;
        const sup = body.querySelector("sup");
        sup.getBoundingClientRect = rect({ left: 20, right: 30, top: 200, bottom: 214 });
        // The verse menu as chapter-tools.js opens it, with the desk's row.
        sup.addEventListener("click", () => {
          const menu = document.createElement("div");
          menu.innerHTML = `<div class="lit-panel__row lit-flyout"><button type="button" class="lit-flyout__trigger">Add to sheet</button></div>
            <div class="lit-panel__row lit-flyout"><button type="button" class="lit-flyout__trigger">Add to collection</button></div>`;
          menuOpened.push(menu);
          showPanel(sup, menu, { pinned: true });
        });
      }
      el.append(kindButton, body);
      panesBox.append(el);
      const lead = document.createElement("span");
      lead.hidden = true;
      const pin = document.createElement("button");
      paneEls.set(pane.id, { el, body, kindButton, lead, pin, kind: pane.kind });
    }
  }
  draw();

  const div = () => document.body.appendChild(document.createElement("div"));
  const frozen = [];
  const tour = createDeskTour({
    canKeep: true,
    getLayout: () => layout,
    setLayout: (next) => {
      layout = next;
      draw();
    },
    freeze: (on) => frozen.push(on),
    paneEls,
    panesBox,
    titleButton: document.body.appendChild(document.createElement("button")),
    titleMenu: div(),
    commandRow: div(),
    addMenu: div(),
    openTitleMenu() {},
    closeTitleMenu() {},
    showAddKinds() {},
    closeAdd() {},
    newSheet: () => null,
    layoutMenu: div(),
    openLayoutMenu() {},
    closeLayoutMenu() {},
    refreshLayoutMenu() {},
    shapeButtons: [],
  });

  tour.start({ only: ["collections", "collect"] });
  await settle(30);
  const card = document.querySelector(".desk-tour");
  assert.ok(card, "the tour's card is up");

  // Card 1: a Collections pane beside the original layout's two, its name marked.
  const title = () => card.querySelector(".desk-tour__title").textContent;
  assert.equal(title(), "Collections");
  const kinds = panes(layout.root).map((p) => p.kind);
  assert.deepEqual(kinds, ["lit", "mine", "collection"]);
  const shown = panes(layout.root).find((p) => p.kind === "collection");
  assert.equal(shown.collection, undefined, "the pane shows the list, no collection opened");
  assert.ok(paneEls.get(shown.id).kindButton.classList.contains("desk-tour-target"));
  const more = card.querySelector(".desk-tour__more a");
  assert.equal(more.getAttribute("href"), "/desk/help/#collections");
  assert.equal(more.target, "_blank");
  assert.equal(more.rel, "noopener noreferrer");

  // Card 2: the pane is gone again, and the LIT pane's verse menu is open at
  // its Add to collection row, which is marked and not pressed.
  card.querySelector(".desk-tour__next").click();
  await settle(30);
  assert.equal(title(), "Adding to a collection");
  assert.deepEqual(panes(layout.root).map((p) => p.kind), ["lit", "mine"]);
  assert.equal(menuOpened.length, 1);
  assert.equal(currentPanel()?.el, menuOpened[0]);
  const row = Array.from(menuOpened[0].querySelectorAll("button")).find((b) => b.textContent === "Add to collection");
  assert.ok(row.classList.contains("desk-tour-target"));
  assert.ok(card.querySelector(".desk-tour__more").hidden, "this card links nowhere");

  // Done: the menu closed, the reader's own layout back, saving on again.
  card.querySelector(".desk-tour__next").click();
  await settle(30);
  assert.equal(currentPanel(), null);
  assert.equal(layout, mine);
  assert.deepEqual(frozen, [true, false]);
  // Nothing about collections was written: only the tour's seen list.
  assert.deepEqual(Object.keys(localStorage).sort(), ["lit-desk-page-tour"]);
});
