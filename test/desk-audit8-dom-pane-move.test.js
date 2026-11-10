// Dragging a /desk pane by its header, driven (Audit 8, LG8-8: cut from
// desk-page.js into desk/pane-move.js). The rules (dropZone, swapPanes,
// splitPane) are tested in desk-layout.test.js; these hold the drag to them:
// the drop box, the label over nothing, Escape, and what a drop commits.

import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDom } from "./helpers/browser-env.mjs";

const { startPaneMove } = await import("../src/scripts/desk/pane-move.js");
const { originalLayout, panes } = await import("../src/lib/desk-layout.mjs");

function page() {
  resetDom();
  let layout = originalLayout("john 3:16");
  const [a, b] = panes(layout.root);
  const panesBox = document.body.appendChild(document.createElement("div"));
  panesBox.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600 });
  const paneEls = new Map();
  for (const [p, left] of [[a, 0], [b, 600]]) {
    const el = panesBox.appendChild(document.createElement("section"));
    el.className = "desk-pane";
    el.dataset.paneId = p.id;
    el.getBoundingClientRect = () => ({ left, top: 0, width: left ? 400 : 600, height: 600, right: left ? 1000 : 600, bottom: 600 });
    const head = el.appendChild(document.createElement("div"));
    head.setPointerCapture = () => {};
    paneEls.set(p.id, { el, head });
  }
  const drop = panesBox.appendChild(document.createElement("div"));
  drop.hidden = true;
  const miss = panesBox.appendChild(document.createElement("div"));
  miss.hidden = true;
  const committed = [];
  const said = [];
  // The pane under the pointer: the first pane whose box holds x.
  let over = null;
  document.elementsFromPoint = () => (over ? [over] : []);
  const opts = {
    getLayout: () => layout,
    panesBox, paneEls, drop, miss,
    commit: (next) => { committed.push(next); layout = next; },
    announce: (t) => said.push(t),
  };
  const press = (id) => {
    const head = paneEls.get(id).head;
    const e = new PointerEvent("pointerdown", { button: 0, clientX: 100, clientY: 100, bubbles: true });
    head.addEventListener("pointerdown", (ev) => startPaneMove(ev, id, opts), { once: true });
    head.dispatchEvent(e);
    return {
      to(x, y, el) {
        over = el;
        head.dispatchEvent(new PointerEvent("pointermove", { clientX: x, clientY: y, bubbles: true }));
      },
      up() { head.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); },
    };
  };
  return { a, b, paneEls, drop, miss, committed, said, press, layout: () => layout };
}

test("dropping a pane on the middle of another swaps them, and says so", () => {
  const { a, b, paneEls, drop, committed, said, press, layout } = page();
  const drag = press(a.id);
  drag.to(800, 300, paneEls.get(b.id).el);
  assert.equal(drop.hidden, false, "the drop box shows");
  assert.match(drop.textContent, /^Swap with /);
  assert.ok(drop.classList.contains("desk-ws__drop--swap"));
  drag.up();
  assert.equal(committed.length, 1);
  assert.deepEqual(panes(layout().root).map((p) => p.id), [b.id, a.id]);
  assert.match(said[0], /swapped with/);
  assert.equal(drop.hidden, true, "the box goes when the drag ends");
});

test("an edge of another pane splits it, the box naming the side", () => {
  const { a, b, paneEls, drop, committed, press } = page();
  const drag = press(a.id);
  drag.to(605, 300, paneEls.get(b.id).el); // just inside the right pane's left edge
  assert.match(drop.textContent, /^Left of /);
  drag.up();
  assert.equal(committed.length, 1);
});

test("over nothing a pane can land on, a label says so and a drop changes nothing", () => {
  const { a, miss, drop, committed, said, press } = page();
  const drag = press(a.id);
  drag.to(300, 300, null);
  assert.equal(miss.hidden, false);
  assert.equal(miss.textContent, "Drop on another pane to move this one");
  assert.equal(drop.hidden, true);
  drag.up();
  assert.equal(committed.length, 0);
  assert.match(said[0], /not moved\.$/);
  assert.equal(miss.hidden, true);
});

test("a press that never moves 5px is not a drag, and Escape drops nothing", () => {
  const { a, b, paneEls, committed, said, press } = page();
  const still = press(a.id);
  still.to(102, 101, paneEls.get(b.id).el);
  still.up();
  assert.equal(committed.length, 0);
  assert.equal(said.length, 0, "nothing to say for a click");
  const drag = press(a.id);
  drag.to(800, 300, paneEls.get(b.id).el);
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  drag.up();
  assert.equal(committed.length, 0);
  assert.equal(document.documentElement.classList.contains("desk-ws--moving"), false);
});
