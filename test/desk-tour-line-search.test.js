// The notebook tour's search step on a chapter (Featherboa's Phase 4): the
// page's one search field waits behind the place line's Search
// (place-line.js), so the step presses it, types ">", and at the end puts
// the field's words and the line back as they were. One tour per file: every
// createTour listens for the same command, so a second one in the process
// would start with it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom } from "./helpers/browser-env.mjs";

const { start: startLine } = await import("../src/scripts/place-line.js");
const { createTour } = await import("../src/scripts/desk/tour.js");
const { COMMAND_EVENT } = await import("../src/scripts/desk/first-use.js");

test("the search step presses the place line's Search, types “>”, and puts both back", async () => {
  resetDom();
  sessionStorage.clear();
  localStorage.clear();
  document.body.innerHTML = `
    <div class="place-line place-line--reading" data-place-line>
      <div class="place-line__commands"><a class="kit-btn kit-btn--plain" href="/search" data-line-search>Search</a></div>
      <div class="place-line__find" id="lineFind" data-line-find hidden>
        <div class="searchbar" data-searchbar data-open="false"><input id="site-search-input" type="search" value="grace"><button type="button" class="searchbar__close">Close results</button></div>
        <button type="button" class="kit-icon place-line__find-close" aria-label="Close search" data-line-find-close>Close</button>
      </div>
    </div>
    <main><div class="scripture-layout scripture-layout--scripture"><div class="scripture-main">
      <h1 id="chapter-title">John 3</h1>
      <article class="chapter" data-last-read-book="john" data-last-read-chapter="3">
        <div class="chapter-paragraphs"><p><sup class="vn" id="v1">1</sup> For God so loved the world.</p></div>
      </article>
    </div></div></main>
    <aside id="deskPanel"></aside>`;
  const line = document.querySelector("[data-place-line]");
  const search = document.querySelector("[data-line-search]");
  const find = document.querySelector("[data-line-find]");
  const input = document.getElementById("site-search-input");
  // happy-dom has no layout: Search shows, and the field only while the
  // line's find is open.
  const box = (width) => ({ left: 100, right: 100 + width, top: 10, bottom: 46, width, height: 36 });
  search.getBoundingClientRect = () => box(80);
  input.getBoundingClientRect = () => box(find.hidden ? 0 : 400);
  let shut = 0;
  document.querySelector(".searchbar__close").addEventListener("click", () => shut++);
  const typed = [];
  input.addEventListener("input", () => typed.push(input.value));
  document.addEventListener("click", (e) => e.preventDefault()); // happy-dom would follow a link

  const stopLine = startLine({ doc: document, win: window });
  const el = document.getElementById("deskPanel");
  const panel = { el, snapshot: () => ({}), restore: () => {}, isOpen: () => false, showTab: () => {}, showGreekWord: null };
  createTour({ panel });
  document.dispatchEvent(new CustomEvent(COMMAND_EVENT, { detail: { id: "tour", only: ["search"] } }));
  await settle(300);
  assert.equal(Boolean(document.querySelector(".desk-tour")), true, "the step is showing");
  assert.equal(line.hasAttribute("data-search-open"), true, "the line's Search was pressed");
  assert.equal(search.getAttribute("aria-expanded"), "true");
  assert.equal(find.hidden, false);
  assert.equal(input.value, ">", "the box's commands, typed");

  document.querySelector(".desk-tour__skip").click();
  await settle(50);
  assert.equal(Boolean(document.querySelector(".desk-tour")), false, "the tour is over");
  assert.equal(input.value, "grace", "the field's words are back");
  assert.equal(line.hasAttribute("data-search-open"), false, "and the line");
  assert.equal(find.hidden, true);
  assert.equal(search.getAttribute("aria-expanded"), "false");
  assert.ok(shut >= 1, "the results closed");
  assert.deepEqual(typed, [">", "grace"]);
  stopLine();
});
