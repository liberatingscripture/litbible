// /search's ">" (SE-23; SITE-FEATHERBOA.md, "Search," "Kept from today"): with
// the Study preview on, a query that starts with ">" lists the notebook's
// commands where the results go, as the tray does, and searches nothing; Enter
// runs the first. Driven in a browser DOM through the real, gated desk module,
// over fake-indexeddb, with a network stub that has nothing to find.

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

window.happyDOM.setURL("http://localhost/search/");
document.documentElement.dataset.desk = "on";
document.body.innerHTML = SEARCH_PAGE_HTML;

await import("../src/scripts/search.js");

const input = document.getElementById("site-search-input");
const status = document.getElementById("search-status");

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

const commands = () => document.querySelector(".search-commands");

test('">" lists the notebook\'s commands, and says how many', async () => {
  type(">");
  const list = await until(() => {
    const el = commands();
    return el && !el.hidden && el.querySelector("[data-desk-command]") ? el : null;
  });
  const n = list.querySelectorAll("[data-desk-command]").length;
  assert.ok(n >= 1);
  assert.equal(status.textContent, `${n} ${n === 1 ? "command" : "commands"}`);
  // Nothing else is searched or shown.
  assert.equal(document.getElementById("group-keyword").hidden, true);
});

test('a ">" query no command begins says so, and lists nothing', async () => {
  type(">zzzz");
  await until(() => status.textContent === "No command begins that way.");
  assert.equal(commands().hidden, true);
});

test("an ordinary query puts the commands away", async () => {
  type(">");
  await until(() => commands() && !commands().hidden);
  type("light");
  await until(() => commands().hidden);
  assert.equal(commands().children.length, 0);
});

test("without the preview, \">\" is an ordinary (too short) query", async () => {
  delete document.documentElement.dataset.desk;
  type(">");
  await until(() => /or more letters/.test(status.textContent));
  assert.equal(commands().hidden, true);
  document.documentElement.dataset.desk = "on";
});
