// test/desk-e124-no-panel.test.js
//
// E124 (BVJ, 2026-11-12): "the panel doesn't actually interact with those
// pages at all. It shouldn't be displayed there." The Notebook panel was on
// book introductions, articles and the glossary for notes on them (N11), which
// version 1 leaves out, so with the preview on those three pages now get no
// panel, no minimized tab, no "Skip to the Notebook", and none of the desk's
// first stage; the glossary keeps its reading column and takes only its
// headings' fit. This runs the real gate (desk-gate.js) on each page, as the
// page's markup has it, and a chapter beside them, which keeps its Notebook.
// The pre-paint half is in desk-prepaint.test.js, the CSS half in
// desk-frame.test.js.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom } from "./helpers/browser-env.mjs";

const { readingSurface } = await import("../src/scripts/desk-frame.js");

// Each page's reading column as the built page has it, trimmed to what the
// desk reads.
const PAGES = {
  intro: {
    url: "http://localhost/matthew-intro/",
    html: `<main id="main-content"><div class="scripture-layout scripture-layout--intro"><div class="scripture-main">
      <h1 id="chapter-title">Matthew</h1><div class="intro"><p>An introduction.</p></div>
    </div></div><div class="scripture-disclaimer"></div></main>`,
  },
  article: {
    url: "http://localhost/articles/many-and-all/",
    html: `<main id="main-content"><article class="article__card"><h1 class="article__title">Many and all</h1>
      <div class="article__body"><p>An article.</p></div></article></main>`,
  },
  glossary: {
    url: "http://localhost/glossary/",
    html: `<main id="main-content" class="glossary-page"><div class="wrap"><section class="glossary-entries"><div class="entries-panel">
      <div class="wrap entries-wrap"><article class="entry" data-entry="righteousness-justness">
        <h2 class="entry-title" id="righteousness-justness"><span class="entries-strike"><strong>Righteousness</strong></span>
          <span class="entries-underline lit-part">alignment</span><span class="lit-sep"> / </span><span class="entries-underline lit-part">justice</span></h2>
        <div class="entry-body"><p>An entry.</p></div>
      </article></div>
    </div></section></div></main>`,
  },
  chapter: {
    url: "http://localhost/romans-8/",
    html: `<main id="main-content"><div class="scripture-layout scripture-layout--scripture"><div class="scripture-main">
      <h1 id="chapter-title">Romans 8</h1>
      <article class="chapter" data-last-read-book="romans" data-last-read-chapter="8">
        <div class="chapter-paragraphs"><p><sup class="vn" id="v1">1</sup> text</p></div>
      </article>
    </div></div><div class="scripture-disclaimer"></div></main>`,
  },
};

const FOLLOW = "lit-desk-follow";

/** A page of this kind with the preview on and a bookmark following; returns once the gate has run. */
async function openWithDesk(kind, { following = true } = {}) {
  const { url, html } = PAGES[kind];
  resetDom(url);
  localStorage.clear();
  sessionStorage.clear();
  const root = document.documentElement;
  for (const a of [...root.attributes]) if (a.name.startsWith("data-")) root.removeAttribute(a.name);
  // What the pre-paint script leaves on a page without the panel (desk-prepaint.test.js).
  root.setAttribute("data-desk", "on");
  if (following) sessionStorage.setItem(FOLLOW, JSON.stringify({ id: "b1", bookKey: "romans", paused: false }));
  for (const s of document.head.querySelectorAll("style[data-desk-tab]")) s.remove();
  document.body.innerHTML = `<a class="skip-link" href="#main-content">Skip to content</a>${html}`;
  let fitted = 0;
  const onFit = () => { fitted += 1; };
  window.addEventListener("glossary-reordered", onFit);
  try {
    await import(`../src/scripts/desk-gate.js?e124=${kind}`);
    await settle(30);
  } finally {
    window.removeEventListener("glossary-reordered", onFit);
  }
  return { fitted };
}

/** What of the Notebook is on the page. */
function notebookHere() {
  return {
    surface: readingSurface() !== null,
    tab: document.querySelector(".desk-tab") !== null,
    rail: document.querySelector(".desk-rail") !== null,
    skip: document.querySelector("[data-desk-skip]") !== null,
    panel: document.getElementById("deskPanel") !== null,
    stageOne: document.head.querySelector("style[data-desk-tab]") !== null,
    stamped: document.documentElement.hasAttribute("data-desk-panel"),
  };
}

const NOTHING = { surface: false, tab: false, rail: false, skip: false, panel: false, stageOne: false, stamped: false };

for (const kind of ["intro", "article", "glossary"]) {
  test(`with the preview on, ${kind === "intro" ? "a book introduction" : kind === "article" ? "an article" : "the glossary"} has no Notebook and loads none of it (E124)`, async () => {
    const { fitted } = await openWithDesk(kind);
    assert.deepEqual(notebookHere(), NOTHING);
    // No Notebook follows the reader here, so a moving bookmark pauses, as on any page without one.
    assert.equal(JSON.parse(sessionStorage.getItem(FOLLOW)).paused, true);
    // The glossary keeps its reading column, so its headings are still fitted to it.
    assert.equal(fitted > 0, kind === "glossary", "the glossary's headings' fit ran there and only there");
  });
}

// Last, since its first stage stays loaded: a chapter keeps the Notebook's tab.
test("a Chapter View chapter, beside them, still gets the Notebook's first stage and its tab", async () => {
  // No bookmark following, which would load the whole shell at once.
  await openWithDesk("chapter", { following: false });
  const here = notebookHere();
  assert.equal(here.surface, true);
  assert.equal(here.stageOne, true, "the first stage ran");
  assert.equal(here.tab, true, "the minimized tab is drawn");
  assert.equal(here.skip, true, "with its skip link");
});
