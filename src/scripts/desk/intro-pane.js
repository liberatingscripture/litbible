// src/scripts/desk/intro-pane.js
//
// The Book Intro pane on /desk (STUDY-DESK-FIXES.md, E53; BVJ, 2026-11-06): a
// book's introduction beside the LIT, so a reader at the desk no longer leaves
// it to read Romans's introduction beside Romans 1.
//
// BVJ's answers (2026-11-06, from Claude's recommendations):
// - **A pane of its own, not part of the LIT pane.** The LIT pane's place stays
//   a verse, so This verse, Greek, Footnotes, My Notes and a bookmark that
//   moves never meet "the reader is in an introduction."
// - **It follows the book the LIT pane is in** (a follower in desk-layout.mjs's
//   KINDS: its place is a passage like the others', and only the book is
//   read), switching as the LIT pane crosses into the next book; "Stay here"
//   keeps it on one book.
// - **A scripture reference in it moves the LIT pane** (a plain click, as a
//   Search pane's verse result does), and the pane keeps its book while the LIT
//   shows the passage it sent, so reading "Galatians 2:11" from Romans's
//   introduction doesn't swap the introduction for Galatians's. Any other click
//   on a link opens a new tab, as every link that leaves the desk does.
// - Its bar names the book, with the previous and next book, and "Open on its
//   page" (E35's link). Choosing a book moves the LIT pane to its chapter 1, as
//   a following pane's picker moves it; a pane that stays put moves alone.
//
// The introduction is read from its built page (`/romans-intro/`), fetched once
// a visit and parsed with DOMParser, so nothing in it runs or loads, and what
// shows is the page's own text with its linked references. A draft
// introduction (Acts, in 2026-11) shows a line saying so.

import { BOOK_ORDER, bookKeyToLabel } from "../../data/books.js";
import { makeInert } from "../../lib/desk-inert.mjs";
import { introPath, stepBook } from "../../lib/desk-passage.mjs";
import { resultTarget } from "../../lib/desk-search-pane.mjs";
import { heldAfterReference, introText, keepsBook } from "./intro-text.js";
import { make } from "./dom.js";
import { chevronIcons, OPEN_PAGE_ICON } from "./glyphs.js";

const BASE = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

const { prev: ICON_PREV, next: ICON_NEXT } = chevronIcons();

const cache = new Map(); // book key → Promise<{ draft, body }>

/** The introduction's address, or null for a book the LIT hasn't got (the fetch's guard). */
const introHref = (bookKey) => {
  const path = introPath(bookKey);
  return path ? `${BASE}${path.slice(1)}` : null;
};

/**
 * The introduction's text, read off its page: `{ draft, body }`, where `body`
 * is the `section.intro` moved into a document of its own (null for a draft).
 * Rejects when the page can't be had; a failed fetch is forgotten.
 */
function loadIntro(bookKey) {
  const href = introHref(bookKey);
  if (!href) return Promise.reject(new Error("Not a book"));
  let p = cache.get(bookKey);
  if (!p) {
    p = fetch(href, { credentials: "same-origin" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((html) => {
        const page = new DOMParser().parseFromString(html, "text/html");
        const section = page.querySelector("article.chapter section.intro");
        if (!section) return { draft: true, body: null };
        // Made inert before the pane imports a node of it (SEC3-2), as a chapter's parts are.
        const kept = document.implementation.createHTMLDocument("");
        kept.body.append(makeInert(section));
        return { draft: false, body: section };
      });
    p.catch(() => cache.delete(bookKey));
    cache.set(bookKey, p);
  }
  return p;
}

const modified = (e) => e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

/**
 * @param {{ paneId: string, start: object, set: (passage: object) => void,
 *   showPassage: (passage: object) => unknown }} options
 *   `start` is the passage the pane follows (`pane.get()`), `set` asks for a new
 *   one (`pane.set`), and `showPassage` is desk-page.js's, which moves the
 *   leading LIT pane.
 * @returns {{ el: HTMLElement, setPassage: (passage: object) => void, destroy: () => void }}
 */
export function createIntroPane({ paneId, start, set, showPassage }) {
  const el = make("div", "desk-intro");

  const bar = make("div", "desk-passage desk-intro__bar");
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "Book");
  const prev = make("button", "desk-passage__step");
  prev.type = "button";
  prev.innerHTML = ICON_PREV;
  const label = make("label", "sr-only", "Book");
  label.htmlFor = `deskIntroBook-${paneId}`;
  const select = make("select", "desk-passage__field desk-intro__book");
  select.id = `deskIntroBook-${paneId}`;
  for (const key of BOOK_ORDER) {
    const option = make("option", null, bookKeyToLabel(key));
    option.value = key;
    select.append(option);
  }
  const next = make("button", "desk-passage__step");
  next.type = "button";
  next.innerHTML = ICON_NEXT;
  // The introduction on its own page (E35's link): a new tab, so the layout stays.
  const openPage = make("a", "desk-passage__step desk-lit__open");
  openPage.target = "_blank";
  openPage.rel = "noopener noreferrer";
  openPage.title = "Open on its page";
  openPage.innerHTML = OPEN_PAGE_ICON;
  bar.append(prev, label, select, next, openPage);

  const content = make("div", "desk-dp__content desk-intro__content");
  content.tabIndex = 0;
  content.setAttribute("role", "region");
  el.append(bar, content);

  let book = null; // the book shown
  let held = null; // the book a reference sent the LIT to, while the pane keeps its own
  let seq = 0;

  const status = (text, retry) => {
    const box = make("div", "desk-dp__status");
    box.setAttribute("role", "status");
    box.append(make("p", null, text));
    if (retry) {
      const b = make("button", "desk-dp__retry", "Try again");
      b.type = "button";
      b.addEventListener("click", retry);
      box.append(b);
    }
    return box;
  };

  function drawBar() {
    select.value = book;
    for (const [b, dir, name] of [[prev, -1, "Previous book"], [next, 1, "Next book"]]) {
      const to = stepBook(book, dir);
      b.setAttribute("aria-disabled", String(!to));
      b.setAttribute("aria-label", to ? `${name}, ${bookKeyToLabel(to)}` : name);
      b.title = to ? bookKeyToLabel(to) : "";
    }
    const href = introHref(book);
    if (href) openPage.href = href;
    openPage.setAttribute("aria-label", `Open the ${bookKeyToLabel(book)} introduction on its page, in a new tab`);
    content.setAttribute("aria-label", `${bookKeyToLabel(book)} introduction`);
  }

  async function show(bookKey) {
    if (!introPath(bookKey) || bookKey === book) return;
    book = bookKey;
    drawBar();
    const n = ++seq;
    content.replaceChildren(status("Loading the introduction…"));
    let intro;
    try {
      intro = await loadIntro(bookKey);
    } catch (_) {
      if (n === seq) content.replaceChildren(status("The introduction couldn’t be loaded.", () => { book = null; show(bookKey); }));
      return;
    }
    if (n !== seq) return;
    const name = bookKeyToLabel(bookKey);
    if (intro.draft) {
      content.replaceChildren(status(`The ${name} introduction isn’t ready yet.`));
      return;
    }
    const article = make("article", "desk-intro__article");
    const title = make("h3", "desk-intro__title", `Introduction to ${name}`);
    article.append(title, introText(intro.body));
    content.replaceChildren(article);
    content.scrollTop = 0;
  }

  /** The passage the pane follows moved: show its book, unless it is the one a reference sent the LIT to. */
  function setPassage(p) {
    if (!p?.bookKey) return;
    if (keepsBook(held, p.bookKey)) return;
    held = null;
    show(p.bookKey);
  }

  /** Choosing a book: the LIT moves to its chapter 1 (or this pane alone, when it stays put). */
  function choose(bookKey) {
    if (!introPath(bookKey) || bookKey === book) return;
    held = null;
    set({ bookKey, chapter: 1, verse: null });
  }

  select.addEventListener("change", () => choose(select.value));
  for (const [b, dir] of [[prev, -1], [next, 1]]) {
    b.addEventListener("click", () => {
      if (b.getAttribute("aria-disabled") === "true") return;
      choose(stepBook(book, dir));
    });
  }

  // A reference to the LIT, plainly clicked, moves the LIT pane; the pane keeps
  // this book while the LIT shows the other one.
  content.addEventListener("click", (e) => {
    const a = e.target.closest?.("a.sref[href]");
    if (!a || modified(e) || !content.contains(a)) return;
    const target = resultTarget(a.getAttribute("href"));
    if (target.type !== "passage") return;
    e.preventDefault();
    held = heldAfterReference(book, target.bookKey);
    showPassage({ bookKey: target.bookKey, chapter: target.chapter, verse: target.verse });
  });

  setPassage(start);
  return { el, setPassage, destroy: () => { seq++; } };
}
