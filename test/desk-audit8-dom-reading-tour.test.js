// The notebook tour's Footnotes step, driven. It took the place of the Greek
// step (Audit 8, LV8-6, which let go of the word it opened in the Greek tab)
// when the Greek left the Notebook for Study (Featherboa's Phase 5): the step
// shows the Notebook's Footnotes tab, marks that tab without remembering it,
// and the tour's end puts the panel back as the tour found it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom } from "./helpers/browser-env.mjs";

const { createTour } = await import("../src/scripts/desk/tour.js");
const { COMMAND_EVENT } = await import("../src/scripts/desk/first-use.js");

function page() {
  resetDom();
  sessionStorage.clear();
  localStorage.clear();
  document.body.innerHTML = `
    <main><div class="scripture-layout scripture-layout--scripture"><div class="scripture-main">
      <h1 id="chapter-title">John 3</h1>
      <article class="chapter" data-last-read-book="john" data-last-read-chapter="3">
        <div class="chapter-paragraphs"><p><sup class="vn" id="v1">1</sup> text</p></div>
      </article>
    </div></div></main>
    <aside id="deskPanel">
      <button role="tab" data-tab="mine">Notes</button><button role="tab" data-tab="footnotes">Footnotes</button><button role="tab" data-tab="verse">This verse</button>
    </aside>`;
  const el = document.getElementById("deskPanel");
  // happy-dom lays nothing out, and the tour marks only what is drawn: give
  // the tab buttons a box.
  for (const b of el.querySelectorAll('[role="tab"]')) {
    const box = { top: 10, bottom: 40, left: 0, right: 80, width: 80, height: 30, x: 0, y: 10 };
    b.getClientRects = () => [box];
    b.getBoundingClientRect = () => box;
  }
  const shown = [];
  const restored = [];
  const panel = {
    el,
    snapshot: () => ({ tab: "mine" }),
    restore: (s) => restored.push(s.tab),
    isOpen: () => true,
    showTab: (id, opts = {}) => {
      shown.push(`${id} remember:${opts.remember} focus:${opts.focus}`);
      return true;
    },
  };
  createTour({ panel });
  return { el, shown, restored };
}

test("the Footnotes step shows the Footnotes tab without remembering it, and the tour's end restores the panel", async () => {
  const { el, shown, restored } = page();
  document.dispatchEvent(new CustomEvent(COMMAND_EVENT, { detail: { id: "tour", only: ["footnotes"] } }));
  await settle(50);
  assert.deepEqual(shown, ["footnotes remember:false focus:false"], "the step showed the tab, writing none of its keys");
  const card = document.querySelector(".desk-tour");
  assert.ok(card, "the tour card is up");
  assert.match(card.textContent, /Footnotes/);
  assert.match(card.textContent, /each one whole/);
  assert.equal(el.querySelector('[data-tab="footnotes"]').classList.contains("desk-tour-target"), true, "the card marks the Footnotes tab");
  card.querySelector(".desk-tour__skip").click();
  await settle(50);
  assert.equal(el.querySelector('[data-tab="footnotes"]').classList.contains("desk-tour-target"), false, "the mark goes with the card");
  assert.deepEqual(restored, ["mine"], "the tour put the panel back as it found it");
});

test("a Notebook with no Footnotes tab (a draft's) leaves the step out", async () => {
  const { el, shown } = page();
  el.querySelector('[data-tab="footnotes"]').remove();
  document.dispatchEvent(new CustomEvent(COMMAND_EVENT, { detail: { id: "tour", only: ["footnotes"] } }));
  await settle(50);
  assert.equal(shown.some((s) => s.startsWith("footnotes")), false, "nothing showed the tab");
});
