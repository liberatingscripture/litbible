// E114: /search's reference banner (search.js) driven in a browser DOM, with
// the Study Desk preview on and off. With it on, the link that stood for Read
// View opens the desk in its Reading layout at the passage; with it off,
// nothing changes. The network is a stub with an empty verse index and
// nothing else: the banner is drawn before anything is fetched.

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

// search.astro's markup, with SearchBar's field and filters, as much as the page reads.
window.happyDOM.setURL("http://localhost/search/?q=John+3%3A16");
document.body.innerHTML = `
  <div data-searchbar>
    <input id="site-search-input" class="searchbar__input" type="search" />
    <select class="searchbar__book"><option value="">All books</option></select>
    <select class="searchbar__mode"><option value="all">All results</option><option value="keyword">Keyword matches</option></select>
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

const banner = document.querySelector("[data-search-ref]");
const input = document.getElementById("site-search-input");

function preview(on) {
  if (on) document.documentElement.dataset.desk = "on";
  else delete document.documentElement.dataset.desk;
}

/** Search for a query and read the banner's links. */
async function linksFor(q, desk) {
  preview(desk);
  input.value = q;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await settle(260);
  return [...banner.querySelectorAll("a.search-ref__link")].map((a) => ({
    href: a.getAttribute("href"),
    text: a.textContent.trim(),
  }));
}

test("the page's own query draws the banner (preview off)", async () => {
  await settle(260);
  assert.equal(banner.hidden, false);
  const links = [...banner.querySelectorAll("a.search-ref__link")].map((a) => a.getAttribute("href"));
  assert.deepEqual(links, ["/john-3#v16", "/read/john#john-3-v16"]);
});

test("preview on: a reference's second link opens the Study Desk in Reading", async () => {
  const links = await linksFor("John 3:16", true);
  assert.deepEqual(links, [
    { href: "/john-3#v16", text: "Chapter View, with notes" },
    { href: "/desk/?place=john-3:16&layout=reading", text: "Study Desk, Reading layout" },
  ]);
});

test("preview on: a range opens at its first verse, a chapter at the chapter", async () => {
  assert.equal((await linksFor("Romans 8:16-18", true))[1].href, "/desk/?place=romans-8:16&layout=reading");
  assert.equal((await linksFor("Romans 8", true))[1].href, "/desk/?place=romans-8&layout=reading");
});

test("preview on: a book's second link opens the desk in Reading at chapter 1", async () => {
  const links = await linksFor("Romans", true);
  assert.deepEqual(links[1], { href: "/desk/?place=romans-1&layout=reading", text: "Whole book in Study Desk" });
});

test("preview on: a book's introduction still offers only the introduction (E123)", async () => {
  const links = await linksFor("Matthew intro", true);
  assert.deepEqual(links.map((l) => l.href), ["/matthew-intro"]);
});

test("preview off: the second link is Read View, as before", async () => {
  assert.deepEqual((await linksFor("John 3:16", false))[1], { href: "/read/john#john-3-v16", text: "Read View, whole book" });
  assert.deepEqual((await linksFor("Romans", false))[1], { href: "/read/romans", text: "Whole book in Read View" });
});
