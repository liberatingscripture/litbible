// The notebook tour's Greek step, driven (Audit 8, LV8-6): the tour opens a
// word in the Greek tab to show it, and lets go of that word when the step is
// undone, through the tab's own close button, so the tab reads as it did.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom } from "./helpers/browser-env.mjs";

const { createTour } = await import("../src/scripts/desk/tour.js");
const { COMMAND_EVENT } = await import("../src/scripts/desk/first-use.js");

test("LV8-6: ending the tour on the Greek step presses the entry's close button", async () => {
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
    <aside id="deskPanel"><button role="tab" data-tab="greek">Greek</button></aside>`;
  const el = document.getElementById("deskPanel");
  let closed = 0;
  const opened = [];
  const panel = {
    el,
    snapshot: () => ({}),
    restore: () => {},
    isOpen: () => true,
    showTab: () => {},
    showGreekWord: async (verse, word) => {
      opened.push([verse, word]);
      const close = document.createElement("button");
      close.className = "desk-greek__close";
      close.addEventListener("click", () => {
        closed++;
        close.remove();
      });
      el.append(close);
    },
  };
  createTour({ panel });
  document.dispatchEvent(new CustomEvent(COMMAND_EVENT, { detail: { id: "tour", only: ["greek"] } }));
  await settle(50);
  assert.equal(opened.length, 1, "the step opened a Greek word");
  assert.equal(closed, 0, "and left it open while the step shows");
  const card = document.querySelector(".desk-tour");
  assert.ok(card, "the tour card is up");
  card.querySelector(".desk-tour__skip").click();
  await settle(50);
  assert.equal(closed, 1, "ending the tour let go of the word through its close button");
});
