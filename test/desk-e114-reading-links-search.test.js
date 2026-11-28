// E114: /search's reference banner (search.js) driven in a browser DOM, with
// the Study Desk preview on and off. With it on, the link that stood for Read
// View opens the desk in its Reading layout at the passage; with it off,
// nothing changes. The network is a stub with an empty verse index and
// nothing else: the banner is drawn before anything is fetched.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, window } from "./helpers/browser-env.mjs";
import { SEARCH_PAGE_HTML } from "./helpers/search-page-dom.mjs";

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
document.body.innerHTML = SEARCH_PAGE_HTML;

await import("../src/scripts/search.js");

const banner = document.querySelector("[data-search-ref]");
const input = document.getElementById("site-search-input");

function preview(on) {
  if (on) document.documentElement.dataset.desk = "on";
  else delete document.documentElement.dataset.desk;
}

/** Search for a query and read the answer's links. */
async function linksFor(q, desk) {
  preview(desk);
  input.value = q;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await settle(260);
  return [...banner.querySelectorAll("a.search-answer__link")].map((a) => ({
    href: a.getAttribute("href"),
    text: a.textContent.trim(),
  }));
}

test("the page's own query draws the answer: only Go without the preview", async () => {
  await settle(260);
  assert.equal(banner.hidden, false);
  const links = [...banner.querySelectorAll("a.search-answer__link")].map((a) => a.getAttribute("href"));
  assert.deepEqual(links, ["/john-3#v16"]);
});

test("preview on: Go to the verse, then Study it (no Reading layout)", async () => {
  const links = await linksFor("John 3:16", true);
  assert.deepEqual(links, [
    { href: "/john-3#v16", text: "Go to John 3:16" },
    { href: "/desk/?place=john-3:16", text: "Study John 3:16" },
  ]);
});

test("preview on: a range opens at its first verse, a chapter at the chapter", async () => {
  assert.equal((await linksFor("Romans 8:16-18", true))[1].href, "/desk/?place=romans-8:16");
  assert.equal((await linksFor("Romans 8", true))[1].href, "/desk/?place=romans-8");
});

test("preview on: a book's Study link opens chapter 1", async () => {
  const links = await linksFor("Romans", true);
  assert.equal(links[1].href, "/desk/?place=romans-1");
});

test("preview on: a book's introduction offers only the introduction (E123)", async () => {
  const links = await linksFor("Matthew intro", true);
  assert.deepEqual(links.map((l) => l.href), ["/matthew-intro"]);
});

test("preview off: no Read View link, only Go", async () => {
  assert.deepEqual((await linksFor("John 3:16", false)).map((l) => l.href), ["/john-3#v16"]);
  assert.deepEqual((await linksFor("Romans", false)).map((l) => l.href), ["/romans-intro"]);
});
