// /search's tabs on a Greek query (queue Q77): with the Study preview on, a
// query that can only be Greek (Greek letters, a Strong's number, or a search
// command) is searched in the Greek alone, so every other tab is drawn
// unavailable, with the reason under the row, and pressing one does nothing.
// An English query under the chosen Greek tab is not one: its tabs stay, and
// the reader can leave the Greek. Driven in a browser DOM through the real
// page script, over fake-indexeddb, with a network stub that has nothing to
// find (so the Greek search itself fails; the tabs are drawn first).

import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { settle, window } from "./helpers/browser-env.mjs";
import { SEARCH_PAGE_HTML } from "./helpers/search-page-dom.mjs";

// An open channel keeps node alive; nothing here closes one.
const RealChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = class extends RealChannel {
  constructor(name) {
    super(name);
    this.unref();
  }
};
globalThis.indexedDB = new IDBFactory();

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
console.warn = () => {};
console.error = () => {};

window.happyDOM.setURL("http://localhost/search/");
document.documentElement.dataset.desk = "on";
document.body.innerHTML = SEARCH_PAGE_HTML;

await import("../src/scripts/search.js");

const input = document.getElementById("site-search-input");
const reason = document.getElementById("search-tabs-reason");
const tab = (id) => document.getElementById(`tab-${id}`);
const OTHERS = ["keyword", "subject", "glossary", "article", "intro", "notebook"];
const REASON = "Greek letters, Strong’s numbers, and search commands are searched in the Greek only.";

async function until(fn, tries = 300) {
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

const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
const mode = () => new URL(window.location.href).searchParams.get("mode");
const othersOff = () => OTHERS.every((id) => tab(id)?.getAttribute("aria-disabled") === "true");
const noneOff = () => Boolean(tab("keyword")) && !document.querySelector("#search-tabs [aria-disabled]");

for (const [query, kind] of [
  ["πίστις", "Greek letters"],
  ["G4102", "a Strong’s number"],
  ["*.aor.impv", "a search command"],
]) {
  test(`${kind} draws every tab but the Greek unavailable, with the reason`, async () => {
    type(query);
    await until(othersOff);
    for (const id of OTHERS) {
      assert.equal(tab(id).getAttribute("aria-describedby"), "search-tabs-reason", id);
      assert.equal(tab(id).querySelector(".search-tab__count"), null, id);
    }
    assert.equal(tab("greek").getAttribute("aria-selected"), "true");
    assert.equal(tab("greek").hasAttribute("aria-disabled"), false);
    assert.equal(reason.hidden, false);
    assert.equal(reason.textContent, REASON);
    // Pressing one does nothing: the page stays on the Greek.
    const before = mode();
    click(tab("keyword"));
    await settle(250);
    assert.equal(tab("greek").getAttribute("aria-selected"), "true");
    assert.equal(mode(), before);
  });
}

test("an English query gives every tab back, and the reason goes", async () => {
  type("light");
  await until(noneOff);
  assert.equal(reason.hidden, true);
  assert.equal(reason.textContent, "");
});

test("an English query under the chosen Greek tab keeps the tabs, and the reader can leave it", async () => {
  type("faith");
  await until(noneOff);
  click(tab("greek"));
  await until(() => mode() === "greek" && tab("greek")?.getAttribute("aria-selected") === "true");
  await settle(250);
  assert.equal(noneOff(), true, "no tab unavailable under the Greek tab with an English query");
  assert.equal(reason.hidden, true);
  click(tab("keyword"));
  await until(() => tab("keyword")?.getAttribute("aria-selected") === "true");
  assert.notEqual(mode(), "greek");
});
