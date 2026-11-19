// /search's own Enter (search.js), with no tray set up: in the 2.0 look the
// tray (searchbar.js) can lose a race with the page and never set itself up
// (test/search-tray-moved-filters.test.js). The field sits in the tray's form,
// which has no address, and has no name, so a submit left to the browser loads
// /search/ with no query and empties the search. The page stops it itself.
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
// Pagefind's assets are checked before it loads; with none, /search goes on
// without it, and says so in the console.
console.warn = () => {};

// search.astro's markup, with SearchBar's form, field and filters, as much as the page reads.
window.happyDOM.setURL("http://localhost/search/");
document.body.innerHTML = `
  <div data-searchbar>
    <form class="searchbar__form" data-searchbar-form role="search">
      <input id="site-search-input" class="searchbar__input" type="search" />
      <button class="searchbar__submit" type="submit">Search</button>
    </form>
    <select class="searchbar__book"><option value="">All books</option></select>
    <select class="searchbar__mode"><option value="all">All results</option></select>
  </div>
  <section class="search-page">
    <div class="sort-wrap">
      <button type="button" data-sort="relevance" aria-pressed="true">Relevance</button>
      <button type="button" data-sort="order" aria-pressed="false">Book order</button>
    </div>
    <div id="search-status"></div>
    <nav id="search-jumps" hidden></nav>
    <div id="search-active-filters" hidden></div>
    <div class="search-ref" id="search-ref" data-search-ref hidden></div>
    ${["notebook", "glossary", "subject", "intros", "articles", "keyword"]
      .map((g) => `<div class="group" id="group-${g}" hidden><div class="group-title"></div><ol id="results-${g}"></ol></div>`)
      .join("")}
    <div class="group" id="group-greek" hidden>
      <div class="group-title">Greek</div>
      <div id="greek-lemmas" hidden></div>
      <label id="greek-exact" hidden><input type="checkbox" id="greek-exact-input" /></label>
      <ol id="results-greek"></ol>
      <div id="greek-help" hidden></div>
    </div>
    <nav id="pager" hidden></nav>
  </section>`;

await import("../src/scripts/search.js");
await settle(20);

const input = document.getElementById("site-search-input");
const form = input.closest("form");

async function type(q) {
  input.value = q;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await settle(260);
}

test("Enter is the page's: the browser's submit is stopped, and the words stay", async () => {
  await type("faith");
  const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
  input.dispatchEvent(enter);
  await settle(50);
  assert.equal(enter.defaultPrevented, true);
  assert.equal(input.value, "faith");
  assert.equal(new URL(window.location.href).searchParams.get("q"), "faith");
});

test("the form's submit button is the same Enter", async () => {
  await type("hope");
  const submit = new window.SubmitEvent("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(submit);
  await settle(50);
  assert.equal(submit.defaultPrevented, true);
  assert.equal(input.value, "hope");
  assert.equal(new URL(window.location.href).searchParams.get("q"), "hope");
});

test("the Enter that ends a composition is left alone (GK8-2)", async () => {
  await type("love");
  const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, isComposing: true });
  input.dispatchEvent(enter);
  assert.equal(enter.defaultPrevented, false);
});
