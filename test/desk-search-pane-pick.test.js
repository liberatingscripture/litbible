// The Search pane's checks and its strip (E117), driven in a browser DOM: Bible
// order on the title line, a box on every verse, the strip's box that checks
// them all, the count line, and the buttons, which add nothing while nothing
// is checked. A file of its own because the verse index is cached once loaded,
// and these tests need several verses (desk-audit8-dom-search-pane.test.js
// has one).

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, window } from "./helpers/browser-env.mjs";

const VERSES = {
  verses: {
    john: {
      3: [
        "There was one who loved the light.",
        "This one loved the truth.",
        "Those who loved the darkness turned away.",
        "For God so loved the world.",
        "Whoever loved the child was glad.",
      ],
    },
  },
  vocab: ["loved", "light", "truth", "darkness", "world", "child", "glad", "turned"],
};
const reply = (body, ok = true) => ({
  ok,
  status: ok ? 200 : 404,
  text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  json: async () => {
    if (!ok) throw new Error("404");
    return body;
  },
});
globalThis.fetch = async (url) => (String(url).split("?")[0] === "/search/verses.json" ? reply(VERSES) : reply("", false));
globalThis.__pagefind = { search: async () => ({ results: [] }) };

const { createSearchPane } = await import("../src/scripts/desk/search-pane.js");
const { createSheet } = await import("../src/lib/desk-sheets.mjs");

// Elements are compared by identity: a failed assert.equal on two DOM nodes
// prints the whole happy-dom object graph.
const same = (a, b, message) => assert.ok(a === b, message ?? "not the same element");

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
function toggle(box, on) {
  box.checked = on;
  box.dispatchEvent(new window.Event("change", { bubbles: true }));
}

/** A store over `sheets`; `writes` gets each plan written. */
function memoryStore(sheets = []) {
  const writes = [];
  return {
    writes,
    change: async (build) => {
      const plan = await build({ get: async (id) => sheets.find((s) => s.id === id) ?? null });
      writes.push(plan);
      return plan;
    },
    lastEntry: () => ({ id: "entry" }),
  };
}

let n = 0;
/** A pane searched for "loved" (five verses), with a Sheets pane's target the test can set. */
async function mount({ store = memoryStore(), showSheet = () => ({ outcome: "open", changed: false }) } = {}) {
  for (const old of document.querySelectorAll(".desk-search")) old.remove();
  document.documentElement.dataset.desk = "off";
  let target = null;
  const hearers = new Set();
  const paneId = `p${++n}`;
  const pane = createSearchPane({
    paneId,
    env: {
      store,
      ctx: () => ({ client: "web/test", contentVersion: "v1" }),
      showPassage: () => "moved",
      showIntro: () => ({ outcome: "shown" }),
      showSheet,
      openGreekHit: () => {},
    },
    getPlace: () => ({ bookKey: "john" }),
    sheets: { addTarget: () => target, onAddTarget: (fn) => (hearers.add(fn), () => hearers.delete(fn)) },
  });
  document.body.append(pane.el);
  const $ = (sel) => pane.el.querySelector(sel);
  const typeSel = $("select[aria-label='Kind of result']");
  typeSel.value = "keyword";
  typeSel.dispatchEvent(new window.Event("change", { bubbles: true }));
  const input = $("input[type=search]");
  const search = async (q, count) => {
    type(input, q);
    await until(() => pane.el.querySelectorAll(".desk-search__row--verse").length === count && $(".desk-search__pick"));
  };
  await search("loved", 5);
  const setTarget = (t) => {
    target = t;
    for (const fn of hearers) fn();
  };
  const box = (v) => [...pane.el.querySelectorAll(".desk-search__check")].find((b) => b.getAttribute("aria-label") === `Include John 3:${v} in the sheet`);
  const heard = () => pane.el.querySelector(":scope > p[role=status]").textContent;
  const line = () => $(".desk-search__pick-line").textContent.replace("Clear checks", "").trim();
  return { pane, paneId, $, store, setTarget, box, heard, line, search };
}

test("E117: Bible order sits on the title line, small and at the right, as a toggle", async () => {
  const { $, box, line } = await mount();
  const head = $("[data-group='keyword'] .desk-search__group-head");
  assert.ok(head, "the title line is a row");
  assert.ok(head.querySelector(".desk-search__group-title"), "holding the group's title");
  const sort = head.querySelector(".desk-search__sort");
  assert.ok(sort, "and the sort, beside it");
  assert.equal(sort.textContent, "Bible order");
  assert.equal(sort.getAttribute("aria-pressed"), "false");
  assert.equal($(".desk-search__pick").contains(sort), false, "not in the strip");

  toggle(box(2), true);
  click(sort);
  const again = $(".desk-search__sort");
  assert.equal(again.getAttribute("aria-pressed"), "true");
  same(document.activeElement, again, "focus stays on the toggle the redraw put back");
  assert.equal(box(2).checked, true, "the checks outlive the redraw");
  assert.equal(line(), "1 of 5 checked.");
});

test("E117: every verse has a box, and the strip's box checks them all, clears them, and shows some", async () => {
  const { $, box, heard, line, pane } = await mount();
  const rows = [...pane.el.querySelectorAll(".desk-search__row--verse")];
  assert.equal(rows.length, 5);
  for (const row of rows) assert.ok(row.querySelector("input[type=checkbox].desk-search__check"), "a box on every verse");
  const all = $(".desk-search__check-all");
  assert.equal(all.type, "checkbox");
  assert.equal(all.getAttribute("aria-label"), "Check all 5 verses");
  assert.equal(line(), "Check the verses you want, or check all 5.");
  assert.equal($(".desk-search__pick-clear").hidden, true, "nothing to clear");
  assert.equal($(".desk-search__pick").classList.contains("desk-search__pick--some"), false);

  toggle(box(3), true);
  assert.equal(all.checked, false);
  assert.equal(all.indeterminate, true, "some checked");
  assert.equal(line(), "1 of 5 checked.");
  assert.equal($(".desk-search__pick-count").textContent, "1 of 5", "the count is set apart");
  assert.ok(box(3).closest(".desk-search__row").classList.contains("desk-search__row--picked"), "the checked row is marked");
  assert.equal(box(1).closest(".desk-search__row").classList.contains("desk-search__row--picked"), false);
  assert.ok($(".desk-search__pick").classList.contains("desk-search__pick--some"), "the strip takes the rule");
  assert.equal(await until(() => heard()), "1 of 5 checked.", "said once, politely");

  toggle(all, true);
  assert.equal(all.indeterminate, false);
  assert.equal(all.checked, true);
  assert.equal(line(), "All 5 checked.");
  for (const v of [1, 2, 3, 4, 5]) assert.equal(box(v).checked, true);
  assert.equal(pane.el.querySelectorAll(".desk-search__row--picked").length, 5);

  toggle(all, false);
  for (const v of [1, 2, 3, 4, 5]) assert.equal(box(v).checked, false);
  assert.equal(pane.el.querySelectorAll(".desk-search__row--picked").length, 0);
  assert.equal(line(), "Check the verses you want, or check all 5.");
  assert.equal(await until(() => heard() === "No verses checked." && heard()), "No verses checked.");

  toggle(box(1), true);
  toggle(box(5), true);
  const clear = $(".desk-search__pick-clear");
  assert.equal(clear.hidden, false);
  assert.equal(clear.textContent, "Clear checks");
  click(clear);
  assert.equal(line(), "Check the verses you want, or check all 5.");
  assert.equal(box(1).checked || box(5).checked, false);
  same(document.activeElement, all, "Clear checks hides itself, so focus goes to the box beside it");
});

test("E117: a new search starts with nothing checked, and one verse reads as one", async () => {
  const { $, box, line, search } = await mount();
  toggle(box(2), true);
  await search("truth", 1);
  assert.equal($(".desk-search__check-all").getAttribute("aria-label"), "Check the verse");
  assert.equal(line(), "Check the verse to add it.");
  toggle($(".desk-search__check"), true);
  assert.equal(line(), "The verse is checked.");
  await search("loved", 5);
  assert.equal(box(2).checked, false, "the checks belonged to the other search");
  assert.equal(line(), "Check the verses you want, or check all 5.");
});

test("E117: with nothing checked the buttons add nothing, are described by the line, and a press says why", async () => {
  const { $, box, heard, store } = await mount();
  const add = $(".desk-search__sheet--add");
  const fresh = $(".desk-search__sheet--new");
  assert.equal(add.hidden, true, "no Sheets pane shows a sheet");
  assert.equal(fresh.hidden, false);
  assert.ok(fresh.classList.contains("desk-search__btn--primary"), "New sheet stands alone as the primary");
  assert.equal(fresh.getAttribute("aria-disabled"), "true");
  assert.equal(fresh.disabled, false, "still focusable");
  assert.equal(fresh.getAttribute("aria-describedby"), $(".desk-search__pick-line").id);
  assert.equal(fresh.getAttribute("aria-label"), "New sheet of checked verses", "never “0 verses”");
  assert.equal(fresh.querySelector(".desk-search__label").textContent, "New sheet of checked verses");

  click(fresh);
  await settle(30);
  assert.equal(store.writes.length, 0, "nothing was added");
  assert.equal(await until(() => heard()), "Check the verses you want, or check all 5.", "the press says why");

  toggle(box(1), true);
  toggle(box(2), true);
  assert.equal(fresh.getAttribute("aria-disabled"), null);
  assert.equal(fresh.getAttribute("aria-describedby"), null);
  assert.equal(fresh.getAttribute("aria-label"), "New sheet of 2 verses");
  // The width never moves: the labels it can read at other counts sit under it, unheard.
  const room = [...fresh.querySelectorAll(".desk-search__label-room")];
  assert.deepEqual(room.map((s) => s.textContent), ["New sheet of checked verses", "New sheet of all 5 verses"]);
  for (const s of room) assert.equal(s.getAttribute("aria-hidden"), "true");
});

test("E117: with a Sheets pane showing a sheet, Add is the primary and New sheet the ordinary", async () => {
  const { $, box, setTarget, pane } = await mount();
  const add = $(".desk-search__sheet--add");
  const fresh = $(".desk-search__sheet--new");
  const pluses = () => [...pane.el.querySelectorAll(".desk-search__add")];
  assert.ok(pluses().every((b) => b.hidden), "no + without a sheet to add to");

  setTarget({ id: "s1", name: "Faith", ready: () => {} });
  assert.equal(add.hidden, false);
  assert.ok(add.classList.contains("desk-search__btn--primary"));
  assert.equal(fresh.classList.contains("desk-search__btn--primary"), false, "one primary in the strip");
  assert.equal(add.getAttribute("aria-label"), "Add checked verses to “Faith”");
  assert.equal(add.getAttribute("aria-disabled"), "true");
  assert.equal(pluses().length, 5);
  assert.ok(pluses().every((b) => !b.hidden), "the + stays on every verse");

  for (const v of [1, 2, 4]) toggle(box(v), true);
  assert.equal(add.getAttribute("aria-label"), "Add 3 verses to “Faith”");
  assert.equal(fresh.getAttribute("aria-label"), "New sheet of 3 verses");
  assert.equal(add.getAttribute("aria-disabled"), null);

  setTarget(null);
  assert.equal(add.hidden, true);
  assert.ok(fresh.classList.contains("desk-search__btn--primary"), "New sheet is the primary again");
  assert.ok(pluses().every((b) => b.hidden));
});

test("E117: a long sheet name is cut only on screen: the whole name is the button's name and its tooltip", async () => {
  const { $, box, setTarget } = await mount();
  const name = "Tuesday evening group: the signs in John, weeks one to six";
  setTarget({ id: "s1", name, ready: () => {} });
  toggle(box(2), true);
  const add = $(".desk-search__sheet--add");
  const whole = `Add 1 verse to “${name}”`;
  assert.equal(add.getAttribute("aria-label"), whole);
  assert.equal(add.getAttribute("data-tip"), whole);
  assert.equal(add.getAttribute("title"), "", "the shared tooltip, not the browser's");
  assert.equal(add.querySelector(".desk-search__label").textContent, whole, "the words are all there; CSS ends them in “…”");
});

test("E117: the + adds its one verse to the sheet a Sheets pane shows", async () => {
  const sheet = createSheet({ title: "Faith", modules: [] }, { now: "2026-11-12T12:00:00.000Z", client: "web/test", contentVersion: "v1" });
  const store = memoryStore([sheet]);
  const { box, setTarget } = await mount({ store });
  setTarget({ id: sheet.id, name: "Faith", ready: () => {} });
  toggle(box(1), true); // a check doesn't change what the + adds
  const plus = box(4).closest(".desk-search__row").querySelector(".desk-search__add");
  assert.equal(plus.getAttribute("aria-label").includes("John 3:4"), true);
  click(plus);
  await until(() => store.writes.length);
  const passages = store.writes[0].sheet.modules.filter((m) => m.type === "passage");
  assert.equal(passages.length, 1);
  assert.equal(passages[0].bookKey, "john");
  assert.equal(passages[0].chapter, 3);
  assert.equal(passages[0].verse, 4);
  assert.equal(passages[0].endVerse, 4);
});

test("E117: New sheet of N makes a sheet of the checked verses and shows it by E127's one rule", async () => {
  const shown = [];
  const store = memoryStore();
  const showSheet = (id, from) => {
    shown.push([id, from]);
    return { outcome: "replaced", replaced: { kind: "greek" }, changed: true, undoLayout: () => {} };
  };
  const { $, box, paneId } = await mount({ store, showSheet });
  toggle(box(1), true);
  toggle(box(2), true);
  toggle(box(4), true);
  click($(".desk-search__sheet--new"));
  await until(() => shown.length);
  const sheet = store.writes[0].sheet;
  assert.deepEqual(shown, [[sheet.id, paneId]], "env.showSheet, with this pane as the one asking");
  const passages = sheet.modules.filter((m) => m.type === "passage");
  assert.deepEqual(passages.map((p) => [p.verse, p.endVerse]), [[1, 2], [4, 4]], "only the checked verses, neighbors joined");
  const said = await until(() => document.querySelector(".desk-undo__text")?.textContent);
  assert.match(said, /in place of Greek\./, "the undo bar says which pane gave its place");
});
