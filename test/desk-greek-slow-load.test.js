// The Greek tab when its chapter's request stalls (STUDY-DESK-FIXES.md, E133):
// after a while the status offers Try again, which asks afresh, and whichever
// request brings the chapter first draws it. Driven, not read.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { settle, resetDom } from "./helpers/browser-env.mjs";

const john3 = readFileSync(new URL("../public/greek/text/john-3.json", import.meta.url), "utf8");
const answer = () => ({ ok: true, status: 200, json: async () => JSON.parse(john3) });

// Each fetch of a chapter waits on a hand-held promise, so a test decides when
// (and whether) each request answers.
let requests = [];
globalThis.fetch = (url) =>
  new Promise((resolve, reject) => {
    requests.push({ url: String(url), resolve, reject });
  });

const { createGreekTab } = await import("../src/scripts/desk/tab-greek.js");

let chapter = 3;
function tab() {
  resetDom();
  requests = [];
  document.body.innerHTML = `<div class="chapter-paragraphs"></div>`;
  // A chapter of its own per test: the loader keeps a chapter for the page.
  const here = { bookKey: "john", chapter: chapter++, label: "John" };
  const t = createGreekTab({ here, visible: () => true, openVerse: () => {}, slowAfter: 20 });
  document.body.append(t.el);
  return t;
}

const status = (t) => t.el.querySelector(".desk-greek__status")?.textContent ?? "";
const retry = (t) => t.el.querySelector(".desk-greek__retry");
const drawn = (t) => t.el.querySelectorAll(".desk-greek__w").length > 0;

test("a stalled request offers Try again, and a fresh request draws the chapter", async () => {
  const t = tab();
  const rendered = t.render();
  await settle(5);
  assert.match(status(t), /Loading the Greek/);
  assert.equal(retry(t), null, "no Try again at first");
  await settle(40);
  assert.match(status(t), /Still loading the Greek/);
  assert.ok(retry(t), "Try again is offered");
  retry(t).click();
  await settle(5);
  assert.equal(requests.length, 2, "Try again asks afresh, though the first is still pending");
  requests[1].resolve(answer());
  await rendered; // the first caller hears the second request's answer
  await settle(5);
  assert.ok(drawn(t), "the Greek is drawn");
  // The stalled request answering late changes nothing.
  requests[0].reject(new Error("gave up"));
  await settle(30);
  assert.ok(drawn(t), "still drawn after the stalled request fails");
  assert.equal(status(t), "");
});

test("the stalled request answering first draws the chapter, and the newer one is ignored", async () => {
  const t = tab();
  t.render();
  await settle(40);
  retry(t).click();
  await settle(5);
  requests[0].resolve(answer());
  await settle(10);
  assert.ok(drawn(t));
  const words = t.el.querySelectorAll(".desk-greek__w").length;
  requests[1].resolve(answer());
  await settle(30);
  assert.equal(t.el.querySelectorAll(".desk-greek__w").length, words, "not drawn twice");
});

test("a failure still says so, and only the newest request may report one", async () => {
  const t = tab();
  t.render();
  await settle(40);
  retry(t).click();
  await settle(5);
  requests[0].reject(new Error("stalled one failed"));
  await settle(10);
  assert.doesNotMatch(status(t), /couldn’t be loaded/, "the older request's failure isn't reported");
  requests[1].resolve({ ok: false, status: 503, json: async () => ({}) });
  await settle(10);
  assert.match(status(t), /couldn’t be loaded/);
  assert.ok(retry(t));
});

test("a quick answer never shows the slow message", async () => {
  const t = tab();
  t.render();
  await settle(2);
  requests[0].resolve(answer());
  await settle(60);
  assert.ok(drawn(t));
  assert.equal(status(t), "");
});
