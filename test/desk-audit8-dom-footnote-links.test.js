// Links in a footnote's body on /desk (Audit 8, DK8-2; BVJ, 2026-11-10): a plain
// click on a scripture reference moves the LIT pane (as the Book Intro pane's
// does), a modified click keeps the browser's default, and every other link
// opens in a new tab.

import { test } from "node:test";
import assert from "node:assert/strict";
import "./helpers/browser-env.mjs";

const { routeFootnoteLinks } = await import("../src/scripts/desk/footnote-links.js");
const { createFootnotesView } = await import("../src/scripts/desk/footnotes-view.js");

function body() {
  const div = document.createElement("div");
  div.innerHTML = `<p>See <a class="sref" href="/romans-2/#v24" id="a">Romans 2:24</a>,
    <a class="sref" href="/romans-3/#v1-4" id="r">Romans 3:1-4</a>,
    <a class="sref" href="/john-1/" id="c">John 1</a>,
    <a href="/glossary/#flesh" id="g">flesh</a> and
    <a class="sref" href="https://www.sefaria.org/Isaiah.53" id="h">Isaiah 53</a>.</p>`;
  document.body.append(div);
  return div;
}

function click(el, init = {}) {
  const e = new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init });
  el.dispatchEvent(e);
  return e;
}

test("a plain click on an sref moves the LIT pane and stops the navigation", () => {
  const calls = [];
  const root = body();
  routeFootnoteLinks(root, (p) => calls.push(p));
  const e = click(root.querySelector("#a"));
  assert.equal(e.defaultPrevented, true);
  assert.deepEqual(calls, [{ bookKey: "romans", chapter: 2, verse: 24 }]);
  click(root.querySelector("#r"));
  assert.deepEqual(calls[1], { bookKey: "romans", chapter: 3, verse: 1 });
  click(root.querySelector("#c"));
  assert.deepEqual(calls[2], { bookKey: "john", chapter: 1, verse: null });
});

test("a modified or middle click on an sref is left to the browser", () => {
  const calls = [];
  const root = body();
  routeFootnoteLinks(root, (p) => calls.push(p));
  for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { button: 1 }]) {
    assert.equal(click(root.querySelector("#a"), init).defaultPrevented, false);
  }
  assert.equal(calls.length, 0);
});

test("other links open in a new tab; passage srefs are not given a target", () => {
  const calls = [];
  const root = body();
  routeFootnoteLinks(root, (p) => calls.push(p));
  for (const id of ["g", "h"]) {
    const a = root.querySelector(`#${id}`);
    assert.equal(a.target, "_blank");
    assert.equal(a.rel, "noopener noreferrer");
    assert.equal(click(a).defaultPrevented, false);
  }
  assert.equal(root.querySelector("#a").target, "");
  assert.equal(calls.length, 0);
});

test("with no showPassage (Chapter View's Notebook) nothing changes", () => {
  const root = body();
  routeFootnoteLinks(root, null);
  assert.equal(root.querySelector("#g").target, "");
  assert.equal(click(root.querySelector("#a")).defaultPrevented, false);
});

test("the Footnotes pane routes its notes' links", () => {
  const calls = [];
  const view = createFootnotesView({ showPassage: (p) => calls.push(p) });
  document.body.append(view.el);
  const fn = document.createElement("div");
  fn.innerHTML = `<p><a class="sref" href="/romans-2/#v24" id="a">Romans 2:24</a> <a href="/glossary/#flesh" id="g">flesh</a></p>`;
  view.show(
    {
      bookKey: "john", chapter: 3, draft: false,
      footnotes: [{ id: "fn-1", label: "a", verse: 1 }],
      footnoteBody: () => fn,
    },
    1,
  );
  const a = view.el.querySelector(".desk-fns__body a.sref");
  const g = view.el.querySelector(".desk-fns__body a:not(.sref)");
  assert.equal(g.target, "_blank");
  assert.equal(g.rel, "noopener noreferrer");
  assert.equal(click(a).defaultPrevented, true);
  assert.deepEqual(calls, [{ bookKey: "romans", chapter: 2, verse: 24 }]);
  assert.equal(click(a, { ctrlKey: true }).defaultPrevented, false);
  assert.equal(calls.length, 1);
});
