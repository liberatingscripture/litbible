// /search's lines over the verses (SE-21), driven through the real page script:
// the glossary line names an entry whose own word is what was typed, read from
// the term map SearchBar embeds in every page, and comes first. It can't come
// from Pagefind's results: Pagefind indexes /glossary as one page at
// "/glossary/", naming its entries only as sub-results, so a result's own
// address never says which entry it is. Here Pagefind's assets are missing, as
// on a dev server, and the line still shows.

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
const VERSES = {
  verses: {
    john: { 14: ["Don’t let your hearts be troubled. Trust God, and trust me too."] },
  },
  vocab: [],
};
globalThis.fetch = async (url) => reply(String(url).split("?")[0] === "/search/verses.json" ? VERSES : null);
globalThis.__pagefind = { search: async () => ({ results: [] }) };
console.warn = () => {};

const TERMS = {
  "faith-trust": { traditional: "Faith", lit: "trust / faithfulness", greek: "pistis" },
  "hope-trust": { traditional: "Hope", lit: "expectant trust", greek: "elpis" },
};

window.happyDOM.setURL("http://localhost/search/");
document.body.innerHTML =
  SEARCH_PAGE_HTML +
  `<script type="application/json" data-glossary-terms>${JSON.stringify(TERMS)}</script>`;

await import("../src/scripts/search.js");

const input = document.getElementById("site-search-input");
const lines = document.getElementById("search-lines");

async function until(fn, tries = 200) {
  for (let i = 0; i < tries; i++) {
    const v = fn();
    if (v) return v;
    await settle(10);
  }
  throw new Error("timed out waiting for the page");
}

function type(text) {
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

test("an entry's own word gives the glossary line, linking to the entry", async () => {
  type("trust");
  const link = await until(() => lines.querySelector("a.search-line__go"));
  assert.equal(link.textContent, "Trust is in the glossary →");
  assert.equal(link.getAttribute("href"), "/glossary/#faith-trust");
  // It is the first line over the verses.
  assert.equal(lines.firstElementChild.contains(link), true);
});

test("its transliteration, which finds nothing else, gives the line after the status", async () => {
  type("Pistis");
  const status = document.getElementById("search-status");
  await until(() => /glossary/.test(status.textContent));
  assert.equal(status.textContent, "No results for “Pistis.” Pistis is in the glossary →");
  assert.equal(status.querySelector("a").getAttribute("href"), "/glossary/#faith-trust");
});

test("a word an entry only uses gives no line", async () => {
  type("troubled");
  await until(() => document.getElementById("search-status").textContent || lines.textContent === "");
  await settle(300);
  assert.equal(lines.textContent.includes("glossary"), false);
});
