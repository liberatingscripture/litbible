// The Notebook panel's Print button, driven (Audit 8, XA8-11): it is a
// disclosure (aria-expanded, aria-controls), not a menu button, and it opens and
// closes the region it controls.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom } from "./helpers/browser-env.mjs";

const ctx = () => ({ client: "web/test", contentVersion: "v1" });

test("XA8-11: Print… is a disclosure that opens and closes the region it names", async () => {
  resetDom();
  document.body.innerHTML = `
    <main><div class="scripture-layout scripture-layout--scripture"><div class="scripture-main">
      <h1 id="chapter-title">John 3</h1>
      <article class="chapter" data-last-read-book="john" data-last-read-chapter="3">
        <div class="chapter-paragraphs"><div class="p"><span data-verse="16" id="v16">16</span> text</div></div>
      </article>
    </div></div></main>`;
  const store = {
    byChapter: async () => [], all: async () => [], get: async () => null, getMeta: async () => null,
    subscribe: () => () => {}, onEntry: () => () => {}, onMeta: () => () => {}, persisted: async () => true, lastEntry: () => null,
  };
  const { createPanel } = await import("../src/scripts/desk/panel.js");
  createPanel({ store, ctx, printRoom: { can: () => true, print: async () => {} } });
  await settle(20);
  const button = document.querySelector(".desk-panel__print-button");
  assert.ok(button, "the panel has a Print… button");
  assert.equal(button.hasAttribute("aria-haspopup"), false, "it is not a menu button");
  assert.equal(button.getAttribute("aria-expanded"), "false");
  const region = document.getElementById(button.getAttribute("aria-controls"));
  assert.ok(region, "aria-controls names a real region");
  assert.equal(region.hidden, true);
  button.click();
  assert.equal(button.getAttribute("aria-expanded"), "true");
  assert.equal(region.hidden, false);
  button.click();
  assert.equal(button.getAttribute("aria-expanded"), "false");
  assert.equal(region.hidden, true);
});
