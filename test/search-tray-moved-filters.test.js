// /search in the 2.0 look: search.js (startV2Search, v2-search.js) moves the
// tray's book and type filters into the page's left pane, and often does so
// before the tray (searchbar.js) sets itself up at idle. The tray looked for its
// menus only inside itself, so it skipped its setup whenever the move came
// first: no completion, no tips, and nothing stopped Enter from submitting its
// form. Here the filters are moved before the tray loads, the order that broke.
// The network is a stub with an empty verse index and nothing else.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, window } from "./helpers/browser-env.mjs";

const reply = (body) => ({
  ok: body !== null,
  status: body !== null ? 200 : 404,
  json: async () => {
    if (body === null) throw new Error("404");
    return body;
  },
  text: async () => JSON.stringify(body ?? ""),
});
globalThis.fetch = async (url) =>
  reply(String(url).split("?")[0] === "/search/verses.json" ? { verses: {}, vocab: [] } : null);
globalThis.__pagefind = { search: async () => ({ results: [] }) };

// SearchBar.astro's markup as /search renders it (open), and the 2.0 pane.
document.body.innerHTML = `
  <div class="searchbar" data-searchbar data-open="true" data-default-mode="">
    <form class="searchbar__form" data-searchbar-form role="search">
      <div class="searchbar__input-wrap">
        <input id="site-search-input" class="searchbar__input" type="search" />
        <div class="searchbar__ghost" data-ghost hidden><span data-ghost-typed></span><span data-ghost-rest></span></div>
      </div>
    </form>
    <div class="searchbar__panel">
      <div class="searchbar__filters">
        <div class="searchbar__filter searchbar__filter--book">
          <select id="searchbar-book" class="searchbar__book"><option value="">All books</option></select>
          <button type="button" class="searchbar__tip"><span class="searchbar__tooltip">Narrows scripture results</span></button>
        </div>
        <div class="searchbar__filter searchbar__filter--mode">
          <select id="searchbar-mode" class="searchbar__mode"><option value="all">All results</option></select>
          <button type="button" class="searchbar__tip"><span class="searchbar__tooltip">Topic, Keyword…</span></button>
        </div>
      </div>
      <div data-active-filters hidden></div>
      <div class="searchbar__status"></div>
      <div data-greek-line hidden></div>
      <div data-greek-offer hidden></div>
      <div class="searchbar__jump" data-jump hidden></div>
      <div data-groups></div>
      <a class="searchbar__full" href="/search">Go to full search</a>
      <button type="button" class="searchbar__close">Close</button>
    </div>
  </div>
  <div data-v2-search-pane><div data-v2-search-filters></div></div>
  <p id="elsewhere">Elsewhere on the page</p>`;

// The page's move, before the tray has set itself up.
document.querySelector("[data-v2-search-filters]").append(document.querySelector(".searchbar__filters"));

await import("../src/scripts/searchbar.js");
await settle(20);

const root = document.querySelector("[data-searchbar]");
const input = document.getElementById("site-search-input");
const tip = document.querySelector(".searchbar__filter--mode .searchbar__tip");

test("the filters are outside the tray, as on /search in 2.0", () => {
  assert.equal(root.querySelector(".searchbar__book"), null);
});

test("the tray still sets itself up: a reference draws its jump", async () => {
  input.value = "John 3:16";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await settle(200);
  const first = root.querySelector("a.searchbar__jump-link");
  assert.equal(first?.getAttribute("href"), "/john-3#v16");
});

test("a tip in the moved filters opens on a click and closes on a click elsewhere", async () => {
  tip.click();
  await settle();
  assert.equal(tip.dataset.tipOpen, "true");
  document.getElementById("elsewhere").click();
  await settle();
  assert.equal(tip.dataset.tipOpen, "false");
});

test("on /search, Enter on words leaves the search to the page: no reload", async () => {
  // The tray navigates by setting window.location.href; catch it here.
  const went = [];
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { search: "", hash: "", pathname: "/search/", get href() { return "http://localhost/search/"; }, set href(v) { went.push(v); } },
  });
  try {
    input.value = "faith";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle(200);
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    input.dispatchEvent(enter);
    assert.equal(enter.defaultPrevented, true, "the browser's own submit is stopped");
    // A reference still goes to its chapter.
    input.value = "John 3:16";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle(200);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  } finally {
    delete window.location;
  }
  assert.deepEqual(went, ["/john-3#v16"]);
});
