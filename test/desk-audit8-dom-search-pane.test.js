// The Search pane (src/scripts/desk/search-pane.js) driven in a browser DOM
// (Audit 8: GF8a-1, GF8a-3, GF8a-4, GF8a-5, GF8a-6, GF8a-9, GF8a-11, GF8a-12,
// SEC8-2). The pane fetches, so `fetch` is stubbed on globalThis: a file under
// public/ (the Greek's data, the topics index) is served from disk, and the
// verse index, the glossary page and Pagefind are the tests' own.
//
// Two of the search code's caches outlive a test (the verse index, the
// glossary page, once loaded), so the tests that need a FAILED load run first.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { settle, window } from "./helpers/browser-env.mjs";

// ---- the network ----

const VERSES = {
  verses: { john: { 3: ["For God so loved the world that he gave his only child."] } },
  vocab: ["god", "loved", "world", "child", "gave"],
};
const GLOSSARY = `<!doctype html><body><main>
  <article class="entry" data-entry="grace">
    <h2 id="grace">Grace</h2>
    <button class="entry-link">Copy link</button>
    <p onclick="window.__clicked = 1" onmouseover="window.__over = 1">Favor, as in <a href="/john-3#v16">John 3:16</a>, and see <a href="#faith">faith</a>
      <a href="javascript:window.__href = 1">trick</a>.</p>
    <img src="x.png" onerror="window.__img = 1">
    <script>window.__script = 1</script>
  </article>
</main></body>`;

const net = { verses: "ok", glossary: "ok" };
const reply = (body, ok = true) => ({
  ok,
  status: ok ? 200 : 404,
  text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  json: async () => {
    if (!ok) throw new Error("404");
    return typeof body === "string" ? JSON.parse(body) : body;
  },
});
globalThis.fetch = async (url) => {
  const path = String(url).split("?")[0];
  if (path === "/search/verses.json") return net.verses === "ok" ? reply(VERSES) : reply("", false);
  if (path === "/glossary/") {
    if (net.glossary === "fail") throw new Error("offline");
    return reply(GLOSSARY);
  }
  const file = new URL(`../public${path}`, import.meta.url);
  if (existsSync(file)) return reply(readFileSync(file, "utf8"));
  return reply("", false);
};

const glossaryHit = {
  url: "/glossary/",
  meta: { title: "Grace" },
  locations: [3],
  anchors: [{ id: "grace", element: "h2", location: 0 }],
};
globalThis.__pagefind = { search: async () => ({ results: [{ data: async () => glossaryHit }] }) };

// ---- the pane ----

const { createSearchPane } = await import("../src/scripts/desk/search-pane.js");
const { VERSES_FAILED } = await import("../src/scripts/search-core.js");

let n = 0;
const moves = [];
function mount({ desk = false, env = {} } = {}) {
  // Only the earlier pane goes: the undo bar is the page's, built once.
  for (const old of document.querySelectorAll(".desk-search")) old.remove();
  document.documentElement.dataset.desk = desk ? "on" : "off";
  moves.length = 0;
  const pane = createSearchPane({
    paneId: `t${++n}`,
    env: {
      store: null,
      ctx: () => ({ client: "web/test", contentVersion: "v1" }),
      showPassage: (passage) => (moves.push(passage), "moved"),
      showIntro: () => ({ outcome: "shown", moved: null }),
      showSheet: () => true,
      openGreekHit: () => {},
      ...env,
    },
    getPlace: () => ({ bookKey: "john" }),
  });
  document.body.append(pane.el);
  const $ = (sel) => pane.el.querySelector(sel);
  return { pane, $, input: $("input[type=search]"), typeSel: $("select[aria-label='Kind of result']") };
}

async function until(fn, tries = 200) {
  for (let i = 0; i < tries; i++) {
    const v = fn();
    if (v) return v;
    await settle(10);
  }
  throw new Error("timed out");
}
const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
function type(input, text) {
  input.value = text;
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
}
const statusOf = ($) => $(".desk-search__status").textContent;
const answered = ($) => until(() => statusOf($) && statusOf($) !== "Searching…" && statusOf($));
function pickKind(typeSel, value) {
  typeSel.value = value;
  typeSel.dispatchEvent(new window.Event("change", { bubbles: true }));
}

// Elements are compared by identity: a failed assert.equal on two DOM nodes
// prints the whole happy-dom object graph.
const same = (a, b, message) => assert.ok(a === b, message ?? "not the same element");

// ---- tests ----

test("GF8a-3: a verse index that fails to load is not reported as no results", async () => {
  net.verses = "fail";
  const { $, input, typeSel } = mount();
  pickKind(typeSel, "keyword");
  type(input, "loved");
  const said = await answered($);
  assert.equal(said, VERSES_FAILED);
  assert.notEqual(said, "No results.");
  assert.equal($(".desk-search__note").textContent, VERSES_FAILED, "the note line says it too");
  net.verses = "ok";
});

test("GF8a-3: with the index loaded, a match is counted and a miss still reads No results", async () => {
  const { $, input, typeSel } = mount();
  pickKind(typeSel, "keyword");
  type(input, "loved");
  assert.match(await answered($), /1 keyword match/);
  type(input, "zzzzzzzzzzzzzzzz");
  assert.equal(await until(() => statusOf($) === "No results." && "ok"), "ok");
});

test("GF8a-4: a query too short to search clears what the last one left", async () => {
  const { $, input, typeSel } = mount();
  pickKind(typeSel, "keyword");
  type(input, "loved");
  await answered($);
  assert.ok($("[data-group='keyword']"), "results are showing");
  assert.equal($(".desk-search__page").hidden, false, "and the link to the search page");
  type(input, "lo");
  assert.match(statusOf($), /Type 3 or more letters/);
  assert.equal($(".desk-search__groups").children.length, 0, "the old results are gone");
  assert.equal($(".desk-search__page").hidden, true, "so is the link to a search that is no longer there");
  assert.equal($(".desk-search__note").hidden, true);
  await settle(250);
  assert.equal($(".desk-search__groups").children.length, 0, "and no search was left running");
});

// A failed glossary load comes before any success, since a loaded page is kept.
test("GF8a-5: a glossary entry that fails to load keeps its Back button, and focus on it", async () => {
  net.glossary = "fail";
  const { pane, $, input } = mount();
  type(input, "grace");
  const link = await until(() => $("a[data-target='glossary']"));
  click(link);
  const back = $(".desk-search__back");
  same(document.activeElement, back, "focus starts on Back");
  await until(() => $(".desk-search__failed"));
  assert.ok(back.isConnected, "the same Back button is still in the page");
  same(document.activeElement, back, "and still has focus");
  assert.ok($(".desk-search__failed button"), "Try again is offered");
  net.glossary = "ok";
  click($(".desk-search__failed button"));
  await until(() => $(".desk-search__entry article"));
  const again = $(".desk-search__back");
  same(document.activeElement, again, "the retry's own Back button has focus");
  pane.destroy();
});

async function openGrace(options) {
  const view = mount(options);
  type(view.input, "grace");
  click(await until(() => view.$("a[data-target='glossary']")));
  await until(() => view.$(".desk-search__entry article"));
  return view;
}

test("GF8a-5: a loaded glossary entry keeps the Back button, and focus on it", async () => {
  const { $ } = await openGrace();
  const back = $(".desk-search__back");
  assert.ok(back.isConnected);
  same(document.activeElement, back);
  assert.ok($(".desk-search__entry-bar").contains($(".desk-search__open")), "with Open in the glossary beside it");
});

test("GF8a-6: a passage link in an open entry says where the LIT pane went, on a line that shows", async () => {
  const { pane, $ } = await openGrace();
  assert.equal($(".desk-search__top").hidden, true, "the pane's own note line is hidden while an entry shows");
  click($(".desk-search__entry a[href='/john-3#v16']"));
  assert.deepEqual(moves, [{ bookKey: "john", chapter: 3, verse: 16 }]);
  const line = $(".desk-search__entry .desk-search__note");
  assert.equal(line.hidden, false);
  assert.equal(line.textContent, "The LIT pane moved to John 3:16.");
  const live = $("[role=status]");
  assert.equal(live.closest(".desk-search__top"), null, "the live region is outside the hidden part");
  await until(() => live.textContent === line.textContent);
  // Back to the results: the line goes with the entry.
  click($(".desk-search__back"));
  assert.equal($(".desk-search__entry").hidden, true);
  assert.equal($(".desk-search__top").hidden, false);
  pane.destroy();
});

test("SEC8-2: the glossary entry in the pane has no scripts, handlers, images or script addresses", async () => {
  const { $ } = await openGrace();
  const entry = $(".desk-search__entry article");
  assert.equal(entry.querySelector("script, img, button"), null);
  for (const node of [entry, ...entry.querySelectorAll("*")]) {
    for (const name of node.getAttributeNames()) assert.ok(!/^on/i.test(name), `${node.localName} carries ${name}`);
  }
  for (const a of entry.querySelectorAll("a[href]")) assert.ok(!/^\s*javascript:/i.test(a.getAttribute("href")), "no javascript: address");
  assert.match(entry.textContent, /Favor, as in John 3:16/, "the text is all still there");
});

test("GF8a-1 and GF8a-9: choosing ὁ, θεός fills the field, searches it, and leaves focus in the field", async () => {
  const { $, input } = mount({ desk: true });
  type(input, "ὁ");
  const suggestion = await until(() => [...document.querySelectorAll(".greek-cmd-link")].find((b) => b.textContent === "ὁ, θεός"));
  click(suggestion);
  assert.equal(input.value, "ὁ, θεός");
  same(document.activeElement, input, "the suggestion is about to be redrawn away");
  // The new query runs.
  await until(() => $(".desk-search__readback")?.textContent.includes("θεός") && statusOf($) !== "Searching…");
});

async function gatherView() {
  const held = [];
  const store = {
    change: (build) =>
      new Promise((resolve) => held.push(async () => resolve(await build({ get: async () => null })))),
    lastEntry: () => ({ id: "entry" }),
  };
  const shown = [];
  const view = mount({ env: { store, showSheet: (id) => (shown.push(id), true) } });
  const { $, input, typeSel } = view;
  pickKind(typeSel, "keyword");
  type(input, "loved");
  await answered($);
  return { ...view, held, shown };
}

test("GF8a-11: a pane closed during a gather still says what it did, with Undo", async () => {
  const { pane, $, held, shown } = await gatherView();
  click($(".desk-search__sheet"));
  await until(() => held.length);
  pane.destroy();
  await held[0]();
  const text = await until(() => document.querySelector(".desk-undo__text")?.textContent);
  assert.match(text, /verse|passage/i);
  assert.ok(document.querySelector(".desk-undo__undo"), "Undo is offered");
  assert.deepEqual(shown, [], "no sheet is opened beside a pane that is gone");
});

test("GF8a-11: a pane that stays open shows the sheet and offers the same Undo", async () => {
  const { $, held, shown } = await gatherView();
  click($(".desk-search__sheet"));
  await until(() => held.length);
  await held[0]();
  await until(() => shown.length === 1);
  assert.ok(await until(() => document.querySelector(".desk-undo__text")?.textContent));
});

test("GF8a-12: a commands window that finished loading after the pane closed does not open", async () => {
  const { pane, input } = mount({ desk: true });
  type(input, "ὁ");
  const open = await until(() => [...document.querySelectorAll("button")].find((b) => b.textContent === "Search commands"));
  click(open);
  pane.destroy(); // before the window's module has loaded
  await settle(100);
  assert.equal(document.querySelector("[data-greek-commands]"), null, "no window opened over a pane that is gone");
});

test("GF8a-12: the same click, with the pane still open, does open the commands window", async () => {
  const { pane, input } = mount({ desk: true });
  type(input, "ὁ");
  const open = await until(() => [...document.querySelectorAll("button")].find((b) => b.textContent === "Search commands"));
  click(open);
  await until(() => document.querySelector("[data-greek-commands]"));
  pane.destroy(); // closes it with the pane
  await settle(20);
  assert.equal(document.querySelector("[data-greek-commands]"), null);
});
