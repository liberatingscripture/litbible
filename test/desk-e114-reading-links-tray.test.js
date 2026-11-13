// E114: the search tray (searchbar.js) driven in a browser DOM, with the Study
// Desk preview on and off. With it on, the jump's second link, the one that
// stood for Read View, opens the desk in its Reading layout at the passage,
// and Shift+Enter follows it; with it off, nothing changes. The network is a
// stub with an empty verse index and nothing else: the jump row is drawn
// before anything is fetched.

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

// SearchBar.astro's markup, as much of it as the tray reads.
document.body.innerHTML = `
  <div class="searchbar" data-searchbar data-open="false" data-default-mode="">
    <form class="searchbar__form" data-searchbar-form role="search">
      <div class="searchbar__input-wrap">
        <input id="site-search-input" class="searchbar__input" type="search" />
        <div class="searchbar__ghost" data-ghost hidden><span data-ghost-typed></span><span data-ghost-rest></span></div>
      </div>
    </form>
    <div class="searchbar__panel">
      <select class="searchbar__book"><option value="">All books</option></select>
      <select class="searchbar__mode"><option value="all">All results</option><option value="keyword">Keyword matches</option></select>
      <div data-active-filters hidden></div>
      <div class="searchbar__status"></div>
      <div data-greek-line hidden></div>
      <div data-greek-offer hidden></div>
      <div class="searchbar__jump" data-jump hidden></div>
      <div data-groups></div>
      <a class="searchbar__full" href="/search">Go to full search</a>
      <button type="button" data-search-commands hidden>Notebook actions</button>
      <button type="button" class="searchbar__close">Close</button>
    </div>
  </div>`;

await import("../src/scripts/searchbar.js");
await settle(20);

const root = document.querySelector("[data-searchbar]");
const input = document.getElementById("site-search-input");

function preview(on) {
  if (on) document.documentElement.dataset.desk = "on";
  else delete document.documentElement.dataset.desk;
}

/** Type a query and read the jump row the tray draws for it. */
async function jumpFor(q, desk) {
  preview(desk);
  input.value = q;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await settle(200);
  const links = [...root.querySelectorAll("a.searchbar__jump-link")];
  return {
    count: links.length,
    first: links[0]?.getAttribute("href") ?? null,
    href: links[1]?.getAttribute("href") ?? null,
    hint: links[1]?.querySelector(".searchbar__jump-hint")?.textContent.trim() ?? null,
    keys: root.querySelector(".searchbar__jump-keys")?.textContent.replace(/\s+/g, " ").trim() ?? null,
  };
}

test("the tray is set up", () => {
  assert.equal(root.dataset.enhanced, "true");
});

test("preview on: a reference's second link opens the Study Desk in Reading", async () => {
  const row = await jumpFor("John 3:16", true);
  assert.equal(row.count, 2);
  assert.equal(row.first, "/john-3#v16", "Chapter View is unchanged");
  assert.equal(row.href, "/desk/?place=john-3:16&layout=reading");
  assert.equal(row.hint, "in Study Desk, Reading layout");
  assert.equal(row.keys, "Enter: Scripture page · Shift+Enter: Study Desk");
});

test("preview on: a range opens at its first verse, a chapter at the chapter", async () => {
  assert.equal((await jumpFor("Romans 8:16-18", true)).href, "/desk/?place=romans-8:16&layout=reading");
  assert.equal((await jumpFor("1 Cor 13", true)).href, "/desk/?place=1corinthians-13&layout=reading");
});

test("preview on: a book's second link opens the desk in Reading at chapter 1", async () => {
  const row = await jumpFor("Romans", true);
  assert.equal(row.href, "/desk/?place=romans-1&layout=reading");
  assert.equal(row.hint, "whole book, in Study Desk");
  assert.equal(row.keys, "Enter: Scripture page · Shift+Enter: Study Desk");
});

test("preview on: a book's introduction still has no second link (E123)", async () => {
  const row = await jumpFor("Matthew intro", true);
  assert.equal(row.count, 1);
  assert.equal(row.keys, "Enter: Scripture page");
});

test("preview off: the second link is Read View, as before", async () => {
  const ref = await jumpFor("John 3:16", false);
  assert.equal(ref.href, "/read/john#john-3-v16");
  assert.equal(ref.hint, "in Read View, whole book");
  assert.equal(ref.keys, "Enter: Chapter View · Shift+Enter: Read View");
  const book = await jumpFor("Romans", false);
  assert.equal(book.href, "/read/romans");
  assert.equal(book.hint, "whole book, in Read View");
});

test("Shift+Enter follows the second link, Enter the first", async () => {
  // The tray navigates by setting window.location.href; catch it here.
  const went = [];
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { search: "", hash: "", pathname: "/", get href() { return "http://localhost/"; }, set href(v) { went.push(v); } },
  });
  try {
    await jumpFor("John 3:16", true);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await jumpFor("John 3:16", false);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true }));
  } finally {
    delete window.location;
  }
  assert.deepEqual(went, ["/desk/?place=john-3:16&layout=reading", "/john-3#v16", "/read/john#john-3-v16"]);
});

test("E130: preview off, the keys line still says Chapter View", async () => {
  const ref = await jumpFor("John 3:16", false);
  assert.equal(ref.keys, "Enter: Chapter View · Shift+Enter: Read View");
  const intro = await jumpFor("Matthew intro", false);
  assert.equal(intro.keys, "Enter: Chapter View");
});
