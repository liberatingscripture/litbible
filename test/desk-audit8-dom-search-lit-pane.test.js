// The LIT pane (src/scripts/desk/lit-pane.js) driven in a browser DOM (Audit 8,
// DK8-5): a chapter that finishes loading after the pane jumped elsewhere must
// not clear the "loading below" flag of the newer load, or the next scroll
// starts a second load of the same chapter and it is drawn twice.
//
// Chapter pages are fetched, so `fetch` is stubbed: each request waits until
// the test answers it, in the order the test chooses.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, window } from "./helpers/browser-env.mjs";

const pending = new Map(); // "/john-3" → [resolve, ...]
const requested = [];
globalThis.fetch = (url) => {
  const path = String(url).split("?")[0].replace(/\/$/, "");
  requested.push(path);
  return new Promise((resolve) => {
    const [, book, chapter] = /^\/([0-9a-z]+)-(\d+)$/.exec(path) ?? [];
    const html = `<!doctype html><html data-content-version="v1"><body><article class="chapter"><div class="chapter-paragraphs">
      <p data-verse="1"><sup class="vn" id="v1">1</sup>Words of ${book} ${chapter}.</p></div></article></body></html>`;
    const answer = () => resolve({ ok: true, status: 200, text: async () => html });
    if (!pending.has(path)) pending.set(path, []);
    pending.get(path).push(answer);
  });
};
const answer = (path) => pending.get(path)?.splice(0).forEach((fn) => fn());

class FakeResizeObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}
globalThis.ResizeObserver ??= FakeResizeObserver;
window.ResizeObserver ??= FakeResizeObserver;

const { createLitPane } = await import("../src/scripts/desk/lit-pane.js");

const until = async (fn, tries = 100) => {
  for (let i = 0; i < tries; i++) {
    if (fn()) return true;
    await settle(10);
  }
  throw new Error("timed out: " + fn + " | requested " + requested.join(","));
};

test("DK8-5: a chapter that loads late after a jump doesn't make the next scroll load a chapter twice", async () => {
  const pane = createLitPane({
    paneId: "lit1",
    start: { bookKey: "john", chapter: 3, verse: null },
    drafts: {},
    onPlace: () => {},
  });
  document.body.append(pane.el);
  const sections = (key) => pane.el.querySelectorAll(`.desk-lit__chapter[data-key="${key}"]`).length;

  // The first place draws, and the pane starts loading the chapter below it.
  await until(() => pending.has("/john-3"));
  answer("/john-3");
  await until(() => sections("john 3") === 1);
  await until(() => pending.has("/john-4"));

  // The reader jumps elsewhere while that chapter is still loading.
  pane.goTo({ bookKey: "acts", chapter: 5, verse: null });
  await until(() => pending.has("/acts-5"));
  answer("/acts-5");
  await until(() => sections("acts 5") === 1);
  await until(() => pending.has("/acts-6"), 100); // the new place loads the chapter below it

  // Now the late chapter from before the jump arrives.
  answer("/john-4");
  await settle(30);
  assert.equal(sections("john 4"), 0, "it is dropped, being from before the jump");

  // The reader scrolls: the pane looks again at what is still to load.
  const scroller = pane.el.querySelector(".desk-lit__scroll");
  scroller.dispatchEvent(new window.Event("scroll"));
  await settle(50);

  assert.equal(requested.filter((p) => p === "/acts-6").length, 1, "one request for the chapter below");
  answer("/acts-6");
  await settle(50);
  assert.equal(sections("acts 6"), 1, "the chapter below is drawn once");
  pane.destroy();
});
