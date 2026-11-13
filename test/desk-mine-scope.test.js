// My Notes driven in a browser DOM: E118 (no "Open all" / "Close all"; a pinned
// footnote has the caret a note has) and E119 (the /desk pane's "This chapter /
// Everything" choice, which follows the leading LIT pane's chapter).

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, window } from "./helpers/browser-env.mjs";
import { createRecord } from "../src/lib/desk-records.mjs";
import { setPaneScope, paneScope, checkLayout, originalLayout } from "../src/lib/desk-layout.mjs";

const { createMineTab } = await import("../src/scripts/desk/tab-mine.js");

const ctx = () => ({ now: "2026-11-09T12:00:00.000Z", client: "web/test", contentVersion: "v1" });
const note = (bookKey, chapter, body) =>
  createRecord("note", { bookKey, chapter, verse: 1, endVerse: 1, body, marker: "note" }, ctx());
const pin = (bookKey, chapter, footnote) =>
  createRecord("footnotePin", { bookKey, chapter, verse: 2, footnote }, ctx());

function fakeStore(records) {
  return {
    all: async () => records,
    byChapter: async (bookKey, chapter) => records.filter((r) => r.bookKey === bookKey && r.chapter === chapter),
    subscribe: () => () => {},
    lastEntry: () => null,
  };
}

const bodies = (tab) => [...tab.el.querySelectorAll(".desk-list:not(.desk-mine__pin-list) .desk-item")].map((r) => r.textContent);

test("My Notes has no Open all or Close all, and a stored lit-desk-list is ignored", async () => {
  window.localStorage.setItem("lit-desk-list", "full");
  const tab = createMineTab({ store: fakeStore([note("john", 3, "light")]), storeError: null, inReadView: false, visible: () => true });
  document.body.append(tab.el);
  await tab.render();
  assert.equal(tab.el.querySelector(".desk-mine__all"), null);
  assert.ok(!/Open all|Close all/.test(tab.el.textContent));
  assert.equal(document.documentElement.getAttribute("data-desk-list"), null);
  tab.destroy();
  tab.el.remove();
});

test("a pinned footnote that is cut shows a caret that opens that one for the visit", async () => {
  const proto = window.HTMLElement.prototype;
  const cut = (node) => node.classList?.contains("desk-item__pin-text");
  Object.defineProperty(proto, "scrollHeight", { configurable: true, get() { return cut(this) ? 100 : 0; } });
  Object.defineProperty(proto, "clientHeight", { configurable: true, get() { return cut(this) ? 40 : 0; } });
  try {
    const tab = createMineTab({
      store: fakeStore([pin("john", 3, "A long pinned footnote."), pin("john", 4, "Another.")]),
      storeError: null,
      inReadView: false,
      visible: () => true,
    });
    document.body.append(tab.el);
    await tab.render();
    await settle(30);
    const rows = [...tab.el.querySelectorAll(".desk-item__pin-row")];
    assert.equal(rows.length, 2);
    const caret = rows[0].querySelector(".desk-item__more");
    assert.equal(caret.hidden, false, "shown because the text is cut");
    assert.equal(caret.getAttribute("aria-expanded"), "false");
    caret.click();
    assert.equal(caret.getAttribute("aria-expanded"), "true");
    assert.ok(rows[0].classList.contains("desk-item__pin-row--open"));
    assert.ok(!rows[1].classList.contains("desk-item__pin-row--open"), "only that one opens");
    tab.destroy();
    tab.el.remove();
  } finally {
    delete proto.scrollHeight;
    delete proto.clientHeight;
  }
});

test("a pin that is not cut has no caret", async () => {
  const tab = createMineTab({ store: fakeStore([pin("john", 3, "Short.")]), storeError: null, inReadView: false, visible: () => true });
  document.body.append(tab.el);
  await tab.render();
  await settle(30);
  assert.equal(tab.el.querySelector(".desk-item__pin-row .desk-item__more").hidden, true);
  tab.destroy();
  tab.el.remove();
});

function paneScopeOptions(chosen) {
  return {
    label: "This chapter",
    dynamic: true,
    start: "everything",
    onChoose: (s) => chosen.push(s),
    empty: (p) => `Nothing kept in ${p ? `${p.bookKey} ${p.chapter}` : "?"}.`,
    load: async (st, p) => (p ? st.byChapter(p.bookKey, p.chapter) : []),
  };
}

test("the pane starts on Everything, switches to This chapter, and redraws when the leading pane changes chapter", async () => {
  const records = [note("john", 3, "in john three"), note("john", 4, "in john four"), pin("john", 3, "pin in three")];
  const chosen = [];
  const tab = createMineTab({
    store: fakeStore(records),
    storeError: null,
    inReadView: false,
    visible: () => true,
    scope: paneScopeOptions(chosen),
  });
  document.body.append(tab.el);
  tab.follow({ bookKey: "john", chapter: 3, verse: 1 });
  await tab.render();
  await settle();
  const radios = [...tab.el.querySelectorAll(".desk-mine__scope input")];
  assert.equal(radios.length, 2);
  assert.equal(radios[1].checked, true, "Everything is chosen");
  assert.equal(bodies(tab).length, 2);

  radios[0].checked = true;
  radios[0].dispatchEvent(new window.Event("change", { bubbles: true }));
  await settle(10);
  assert.deepEqual(chosen, ["chapter"]);
  assert.equal(bodies(tab).length, 1);
  assert.ok(bodies(tab)[0].includes("in john three"));
  assert.equal(tab.el.querySelector(".desk-mine__pins").hidden, false, "the pin of this chapter follows the scope");

  tab.follow({ bookKey: "john", chapter: 4, verse: 1 });
  await settle(10);
  assert.ok(bodies(tab)[0].includes("in john four"), "redrawn for the new chapter");
  assert.equal(tab.el.querySelector(".desk-mine__pins").hidden, true, "no pin in chapter 4");

  // A move inside the same chapter redraws nothing new.
  const before = tab.el.querySelector(".desk-list:not(.desk-mine__pin-list)").firstElementChild;
  tab.follow({ bookKey: "john", chapter: 4, verse: 9 });
  await settle(10);
  assert.ok(tab.el.querySelector(".desk-list:not(.desk-mine__pin-list)").firstElementChild === before);

  tab.follow({ bookKey: "john", chapter: 5, verse: 1 });
  await settle(10);
  assert.equal(bodies(tab).length, 0);
  assert.equal(tab.el.querySelector(".desk-panel__empty").textContent, "Nothing kept in john 5.");
  tab.destroy();
  tab.el.remove();
});

test("a pane starting on This chapter, and the panel's own scope, still work", async () => {
  const records = [note("john", 3, "three"), note("john", 4, "four")];
  const tab = createMineTab({
    store: fakeStore(records),
    storeError: null,
    inReadView: false,
    visible: () => true,
    scope: { ...paneScopeOptions([]), start: "chapter" },
  });
  document.body.append(tab.el);
  tab.follow({ bookKey: "john", chapter: 4 });
  await tab.render();
  assert.equal(bodies(tab).length, 1);
  assert.ok(tab.el.querySelector('.desk-mine__scope input[value="chapter"]').checked);
  tab.destroy();
  tab.el.remove();

  // The panel: no `dynamic`, so a followed passage never redraws it.
  const panel = createMineTab({
    store: fakeStore(records),
    storeError: null,
    inReadView: false,
    visible: () => true,
    scope: { label: "John 3", empty: "none", load: async (st) => st.byChapter("john", 3) },
  });
  document.body.append(panel.el);
  await panel.render();
  assert.equal(bodies(panel).length, 1);
  panel.follow({ bookKey: "john", chapter: 4 });
  await settle(10);
  assert.ok(bodies(panel)[0].includes("three"));
  panel.destroy();
  panel.el.remove();
});

test("the pane's choice is kept in the layout, and only for a My Notes pane", () => {
  const layout = originalLayout();
  const mine = JSON.parse(JSON.stringify(layout));
  const find = (node) => (node.pane ? (node.pane.kind === "mine" ? node.pane : null) : node.children.map(find).find(Boolean));
  const pane = find(mine.root);
  assert.ok(pane, "the original layout has a My Notes pane");
  assert.equal(paneScope(layout, pane.id), "everything");
  const chosen = setPaneScope(layout, pane.id, "chapter");
  assert.equal(paneScope(chosen, pane.id), "chapter");
  assert.equal(paneScope(checkLayout(JSON.parse(JSON.stringify(chosen))), pane.id), "chapter", "survives the check on the way back in");
  assert.equal(paneScope(setPaneScope(chosen, pane.id, "everything"), pane.id), "everything");
  assert.ok(setPaneScope(layout, "nope", "chapter") === layout);
});
