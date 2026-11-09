// The shell's start-up (Audit 8, NB8-10): one start-up step that throws is
// logged and the steps after it still run, so the Notebook comes up and the
// tour, verse labels and the rest work. startShell runs once per process, so
// this file holds the one test.

import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom } from "./helpers/browser-env.mjs";

test("NB8-10: steps that throw are logged, and the steps after them still start", async () => {
  resetDom("http://localhost/john-3/?greek=16.7&print=room");
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.dataset.desk = "on";
  document.body.innerHTML = `
    <main id="main-content"><div class="scripture-layout scripture-layout--scripture"><div class="scripture-main">
      <h1 id="chapter-title">John 3</h1>
      <article class="chapter" data-last-read-book="john" data-last-read-chapter="3">
        <div class="chapter-paragraphs"><p><sup class="vn" id="v16">16</sup> text</p></div>
      </article>
    </div></div></main>`;

  // initGreekLink and initPrintLink both rewrite the address, and both throw here.
  const realReplace = window.history.replaceState;
  window.history.replaceState = () => {
    throw new Error("history is closed");
  };
  const logged = [];
  const realError = console.error;
  console.error = (...args) => logged.push(args.map(String).join(" "));
  let api;
  try {
    const { startShell } = await import("../src/scripts/desk/shell.js");
    api = await startShell({ handOver: null });
  } finally {
    console.error = realError;
    window.history.replaceState = realReplace;
  }
  assert.ok(api?.panel, "the Notebook came up");
  assert.ok(logged.some((l) => /the Greek link didn't start/.test(l)), logged.join("\n"));
  assert.ok(logged.some((l) => /print from a link didn't start/.test(l)));

  // The steps after the first failure did start: the tour answers its command.
  document.dispatchEvent(new CustomEvent("lit:desk-command", { detail: { id: "tour" } }));
  await settle(50);
  assert.ok(document.querySelector(".desk-tour"), "the tour started (it comes after the Greek link in the shell)");
});
