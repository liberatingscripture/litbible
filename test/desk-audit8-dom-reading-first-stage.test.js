// The first stage when the shell stands down (Audit 8, NB8-9): a Greek result
// the search box handed over, held for a shell that never comes, is followed as
// the box's own link would have been.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom } from "./helpers/browser-env.mjs";

const { start } = await import("../src/scripts/desk/first-stage.js");

function page() {
  resetDom("http://localhost/john-3/");
  localStorage.clear();
  sessionStorage.clear();
  document.body.innerHTML = `
    <a class="skip-link" href="#main-content">Skip</a>
    <main id="main-content"><div class="scripture-layout scripture-layout--scripture"><div class="scripture-main">
      <h1 id="chapter-title">John 3</h1>
      <article class="chapter" data-last-read-book="john" data-last-read-chapter="3">
        <div class="chapter-paragraphs"><p><sup class="vn" id="v16">16</sup> text</p></div>
      </article>
    </div></div></main>`;
}

/** Records where the page was sent. */
function spyOnNavigation() {
  const sent = [];
  Object.defineProperty(window.location, "assign", { value: (url) => sent.push(url), configurable: true, writable: true });
  return sent;
}

const greekWord = (detail) => {
  const e = new CustomEvent("lit:greek-word", { detail, cancelable: true });
  document.dispatchEvent(e);
  return e;
};

test("NB8-9: a Greek result held for a shell that stands down is followed as a link to the verse", async () => {
  page();
  const sent = spyOnNavigation();
  await start({ importShell: async () => ({ startShell: async () => null }) });
  const e = greekWord({ verse: 16, t: 7 });
  assert.equal(e.defaultPrevented, true, "the first stage took the result");
  await settle(50);
  assert.deepEqual(sent, ["/john-3/?greek=16.7#v16"]);
});

test("NB8-9: any other held event is not turned into a navigation", async () => {
  page();
  const sent = spyOnNavigation();
  await start({ importShell: async () => ({ startShell: async () => null }) });
  document.dispatchEvent(new CustomEvent("lit:desk-command", { detail: { id: "tour" } }));
  await settle(50);
  assert.deepEqual(sent, []);
});
