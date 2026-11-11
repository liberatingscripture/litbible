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

// E80: the Footnotes list's Pin buttons are the shell's, so the shell comes
// when the list nears the window, not only when the reader opens the Notebook.
test("E80: the shell loads when the Footnotes list comes near the window", async () => {
  page();
  document.querySelector("article.chapter").insertAdjacentHTML(
    "beforeend",
    '<div class="footnotes-wrap"><ol class="footnotes"><li id="fn-a">A note.</li></ol></div>',
  );
  const made = [];
  const real = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = class {
    constructor(fn, options) { this.fn = fn; this.options = options; this.off = false; made.push(this); }
    observe(el) { this.el = el; }
    disconnect() { this.off = true; }
  };
  let loads = 0;
  let handed = null;
  try {
    await start({
      importShell: async () => {
        loads += 1;
        return { startShell: async ({ handOver }) => { handed = handOver; handOver(); return { panel: { open() {} } }; } };
      },
    });
    assert.equal(made.length, 1, "one observer");
    assert.equal(made[0].el, document.querySelector("ol.footnotes"));
    assert.equal(loads, 0, "nothing loads while the list is far off");
    made[0].fn([{ isIntersecting: false }]);
    await settle(20);
    assert.equal(loads, 0);
    made[0].fn([{ isIntersecting: true }]);
    await settle(20);
    assert.equal(loads, 1, "the shell was asked for");
    assert.equal(typeof handed, "function");
    assert.equal(made[0].off, true, "the observer stops once the shell takes over");
  } finally {
    globalThis.IntersectionObserver = real;
  }
});
