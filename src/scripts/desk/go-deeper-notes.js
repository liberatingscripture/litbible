// src/scripts/desk/go-deeper-notes.js
//
// The "Your notes here" row of Go deeper (STUDY-DESK.md M10), under a Study
// View chapter: the reader's notes on the glossary entries and articles Go
// deeper lists, and notes elsewhere that cite this chapter. Which notes belong
// is src/lib/desk-go-deeper.mjs; this reads what the page's Go deeper lists,
// asks the notebook, and draws the row.
//
// Go deeper is built into the page for everyone, and its styles are scoped to
// the elements Astro rendered, so a row made here wears the same look through
// desk.css instead (".go-deeper__row--notes"), which only the desk loads. A
// chapter whose Go deeper has no rows at all isn't on the page, so the
// section is made here too, in the place it would sit, when notes cite the
// chapter. It is hidden again, and removed, as soon as nothing is left to
// show, and it shows only while "My notes" is on, like the margin.
//
// Everything of the reader's goes in as text.

import { notesHere } from "../../lib/desk-go-deeper.mjs";
import { RENAMED_ARTICLES } from "./note-sources.js";
import { SETTINGS_EVENT, getSetting } from "./note-settings.js";
import { pageChapter } from "./page.js";

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

/** The glossary entries and articles the page's Go deeper lists. */
function listed(section) {
  const terms = [];
  for (const a of section?.querySelectorAll(".go-deeper__row--terms a[href]") ?? []) {
    const id = decodeURIComponent((a.getAttribute("href") ?? "").split("#")[1] ?? "");
    if (id) terms.push({ id, label: a.textContent.trim(), href: a.getAttribute("href") });
  }
  const articles = [];
  for (const a of section?.querySelectorAll(".go-deeper__row--read a[href]") ?? []) {
    const slug = /^\/articles\/([^/]+)\/?$/.exec(a.getAttribute("href") ?? "")?.[1];
    if (slug) articles.push({ slug: decodeURIComponent(slug), title: a.textContent.trim(), href: a.getAttribute("href") });
  }
  return { terms, articles };
}

/** Where Go deeper sits when the page has none: just before the footnotes. */
function madeSection() {
  const before = document.querySelector("article.chapter > .footnotes-wrap, article.chapter > .back-to-top");
  if (!before) return null;
  const section = el("section", "go-deeper go-deeper--made");
  section.setAttribute("aria-labelledby", "go-deeper-title");
  section.setAttribute("data-pagefind-ignore", "");
  const heading = el("h2", "", "Go deeper");
  heading.id = "go-deeper-title";
  section.append(heading, el("dl", "go-deeper__rows"));
  before.before(section);
  return section;
}

function noteRow(items) {
  const row = el("div", "go-deeper__row go-deeper__row--notes");
  row.append(el("dt", "", "Your notes here"));
  const list = el("ul", "go-deeper__list");
  for (const item of items) {
    const li = el("li");
    const link = el("a", "", item.subject);
    link.href = item.href;
    li.append(link);
    if (item.excerpt) li.append(el("span", "go-deeper__excerpt", item.excerpt));
    list.append(li);
  }
  const dd = el("dd");
  dd.append(list);
  row.append(dd);
  return row;
}

/**
 * @param {{ store: object }} options
 * @returns {{ refresh(): Promise<void> } | null} Null off a Study View chapter.
 */
export function createGoDeeperNotes({ store }) {
  const here = pageChapter();
  if (!store || !here) return null;

  async function refresh() {
    const section = document.querySelector("article.chapter .go-deeper");
    const made = Boolean(section?.classList.contains("go-deeper--made"));
    section?.querySelector(".go-deeper__row--notes")?.remove();

    const shown = getSetting("notes") === "on";
    const records = shown ? await store.all() : [];
    const { terms, articles } = listed(section);
    const items = shown ? notesHere(records, { ...here, terms, articles, renamed: RENAMED_ARTICLES }) : [];

    // The section may have changed while the notebook was read.
    const now = document.querySelector("article.chapter .go-deeper");
    now?.querySelector(".go-deeper__row--notes")?.remove();
    if (!items.length) {
      if (made) now?.remove();
      return;
    }
    const target = now ?? madeSection();
    target?.querySelector(".go-deeper__rows")?.append(noteRow(items));
  }

  store.subscribe(refresh);
  document.addEventListener(SETTINGS_EVENT, refresh);
  refresh();
  return { refresh };
}
