// The notebook tour's acts after an await, driven with the real runner (Audit 8,
// GF8b-5): a step that waited for a frame opens, presses and types nothing once
// its run has ended. One tour per file: every createTour listens for the same
// command, so a second one in the process would start with it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom } from "./helpers/browser-env.mjs";

const { createTour } = await import("../src/scripts/desk/tour.js");
const { COMMAND_EVENT } = await import("../src/scripts/desk/first-use.js");

/** Every control a step could press, made "visible" (happy-dom has no layout), below the window so each step scrolls and waits for a frame first. */
function shown(el) {
  el.getClientRects = () => [{ width: 20, height: 20 }];
  el.getBoundingClientRect = () => ({ left: 100, right: 120, top: 5000, bottom: 5020, width: 20, height: 20 });
  return el;
}

test("GF8b-5: a step that waits for a frame opens nothing once the tour has ended", async () => {
  resetDom();
  sessionStorage.clear();
  localStorage.clear();
  document.body.innerHTML = `
    <div data-searchbar><input id="site-search-input" type="search" /></div>
    <main><div class="scripture-layout scripture-layout--scripture"><div class="scripture-main">
      <h1 id="chapter-title">John 3</h1>
      <article class="chapter" data-last-read-book="john" data-last-read-chapter="3">
        <div class="chapter-paragraphs"><p><sup class="vn" id="v1">1</sup> text<sup class="fn-ref"><a id="fnref-a" href="#fn-a">a</a></sup> more text</p></div>
      </article>
    </div></div></main>
    <aside id="deskPanel"><button role="tab" data-tab="verse">This verse</button><button role="tab" data-tab="greek">Greek</button></aside>`;
  const sup = shown(document.getElementById("v1"));
  const ref = shown(document.getElementById("fnref-a"));
  const input = shown(document.getElementById("site-search-input"));
  const clicks = [];
  document.addEventListener("click", (e) => {
    if (e.target === sup) clicks.push("verse number");
    if (e.target === ref) clicks.push("footnote letter");
  });
  const typed = [];
  input.addEventListener("input", () => typed.push(input.value));

  const el = document.getElementById("deskPanel");
  const panel = { el, snapshot: () => ({}), restore: () => {}, isOpen: () => true, showTab: () => {}, showGreekWord: null };
  createTour({ panel });
  for (const id of ["actions", "note", "pin", "search"]) {
    document.dispatchEvent(new CustomEvent(COMMAND_EVENT, { detail: { id: "tour", only: [id] } }));
    // The step is now waiting for a frame; the reader ends the tour first.
    const card = document.querySelector(".desk-tour");
    assert.ok(card, `the ${id} step started`);
    card.querySelector(".desk-tour__skip").click();
    await settle(600);
    assert.deepEqual(clicks, [], `${id}: nothing was pressed after the tour ended`);
    assert.equal(typed.includes(">"), false, `${id}: nothing was typed into the search box`);
  }
});
