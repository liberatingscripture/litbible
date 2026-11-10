// The floating Notebook and keyboard focus (Audit 8, XA8-14; WCAG 2.4.11).
// Where the margin can't hold it, the expanded Notebook floats over the ends
// of the lines, and scrolling can't bring out a link it covers, since it
// covers the page sideways. So focus landing on something the panel hides
// folds the panel to its tab, without remembering the fold. Driven with the
// rail floating (happy-dom has no layout, so the rail floats) and the hit
// test stubbed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom } from "./helpers/browser-env.mjs";

const { createRail, railHides } = await import("../src/scripts/desk/margin.js");
const { MIN_KEY } = await import("../src/lib/desk-start.mjs");

function page() {
  resetDom();
  document.body.innerHTML = `
    <main><div class="scripture-layout scripture-layout--scripture"><div class="scripture-main">
      <h1 id="chapter-title">John 3</h1>
      <article class="chapter"><div class="chapter-paragraphs"><div class="p">text <a href="#f1" id="ref">1</a></div></div></article>
    </div></div></main>
    <div class="lit-panel"><button id="over">On top</button></div>`;
  const panel = document.createElement("section");
  panel.className = "desk-panel";
  panel.innerHTML = `<button id="inside">In the notebook</button>`;
  const tab = document.createElement("button");
  const rail = createRail(panel, tab);
  rail.show({ expand: true });
  const box = (el, left) => (el.getBoundingClientRect = () => ({ left, top: 100, right: left + 10, bottom: 120, width: 10, height: 20 }));
  box(document.getElementById("ref"), 600);
  box(document.getElementById("over"), 600);
  box(panel.querySelector("#inside"), 600);
  return { rail, panel };
}

test("XA8-14: focus on a link the floating Notebook hides folds it to its tab, unremembered", async () => {
  const { rail, panel } = page();
  localStorage.setItem(MIN_KEY, "0");
  assert.deepEqual(rail.state(), { floating: true, collapsed: false });
  // The panel is what lies at the link's middle.
  document.elementFromPoint = () => panel;
  document.getElementById("ref").focus();
  await settle(5);
  assert.equal(rail.state().collapsed, true, "folded");
  assert.equal(document.activeElement.id, "ref", "focus stays on the link");
  assert.equal(localStorage.getItem(MIN_KEY), "0", "the reader's own choice is not overwritten");
  rail.destroy();
});

test("XA8-14: focus on something in front of the Notebook, or inside it, leaves it open", async () => {
  const { rail, panel } = page();
  // A shared panel lies over the notebook: what is at the middle is the button itself.
  document.elementFromPoint = () => document.getElementById("over");
  document.getElementById("over").focus();
  await settle(5);
  assert.equal(rail.state().collapsed, false, "something on top of the notebook isn't hidden by it");
  document.elementFromPoint = () => panel.querySelector("#inside");
  panel.querySelector("#inside").focus();
  await settle(5);
  assert.equal(rail.state().collapsed, false, "the notebook's own controls don't fold it");
  // A link the notebook doesn't reach.
  document.elementFromPoint = () => document.getElementById("ref");
  document.getElementById("ref").focus();
  await settle(5);
  assert.equal(rail.state().collapsed, false);
  rail.destroy();
});

test("XA8-14: railHides reads the topmost thing at the middle of the box", () => {
  const rail = document.createElement("div");
  const inRail = rail.appendChild(document.createElement("div"));
  document.body.append(rail);
  const el = document.body.appendChild(document.createElement("a"));
  el.getBoundingClientRect = () => ({ left: 10, top: 10, width: 20, height: 10 });
  let at = null;
  document.elementFromPoint = (x, y) => {
    at = [x, y];
    return inRail;
  };
  assert.equal(railHides(el, rail), true);
  assert.deepEqual(at, [20, 15], "hit-tested at the middle");
  assert.equal(railHides(inRail, rail), false, "the rail doesn't hide its own");
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 });
  assert.equal(railHides(el, rail), false, "an element with no box is not hidden");
  document.elementFromPoint = () => null;
  el.getBoundingClientRect = () => ({ left: 10, top: 10, width: 20, height: 10 });
  assert.equal(railHides(el, rail), false, "off screen, nothing is hit");
});
