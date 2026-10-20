// src/scripts/desk/chapter-page.js
//
// A chapter's Study View page, fetched and read for /desk's panes
// (STUDY-DESK.md, D9; "Order of work", 3d). On a reading page the Notebook's
// tabs read the chapter off the page itself; /desk shows no chapter of its
// own, so This verse and Greek read the same built page instead: its text
// (for the verse's words and footnote letters), its footnotes, its key-term
// data, and its Go deeper section ("This chapter", D9, "Phase 3a's
// answers", 3). Reading the built page rather than the chapter JSON keeps
// what a pane shows character-identical to Study View, which is what a
// mark's anchor is measured against (desk-anchor-dom.mjs).
//
// One fetch per chapter per visit, shared by every pane (the browser's
// cache does the rest). The page is parsed with DOMParser, so nothing in it
// runs or loads.

import { pageAnchorText } from "../../lib/desk-anchor-dom.mjs";
import { footnotesFromDom } from "../../lib/desk-footnotes.mjs";

const BASE = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

const cache = new Map(); // "john 3" → Promise<source>
const loaded = new Map(); // "john 3" → source, once its page has been read

/** The chapter's Study View address. */
export const chapterHref = (bookKey, chapter) => `${BASE}${bookKey}-${chapter}/`;

function read(doc, bookKey, chapter) {
  let pinnable; // the footnotes as pins read them, worked out once
  const article = doc.querySelector("article.chapter");
  const textBox = doc.querySelector(".chapter-paragraphs");
  // A draft chapter has no LIT text yet (indexed: false), only its Greek.
  const draft = !textBox || article?.dataset.draftBook === bookKey;
  let termData = null;
  try {
    termData = JSON.parse(doc.getElementById("term-lens-data")?.textContent || "null");
  } catch (_) {}
  const verses = Array.from(textBox?.querySelectorAll('sup.vn[id^="v"]') ?? [])
    .map((m) => Number(m.id.slice(1)))
    .filter(Number.isFinite);
  // The page's footnotes in its order, each with the verse its anchor sits in
  // (the Footnotes pane lists them by verse).
  const footnotes = draft
    ? []
    : Array.from(doc.querySelectorAll("ol.footnotes > li")).map((li) => {
        const id = li.id;
        const anchor = textBox.querySelector(`a[href="#${id}"]`);
        const verse = Number(anchor?.closest("[data-verse]")?.getAttribute("data-verse"));
        return {
          id,
          label: li.querySelector(".footnote-backlink")?.textContent.trim() ?? "",
          verse: Number.isFinite(verse) && verse > 0 ? verse : null,
        };
      });
  return {
    bookKey,
    chapter,
    draft,
    textBox: draft ? null : textBox,
    verses,
    termData,
    footnotes,
    goDeeper: doc.querySelector(".go-deeper"),
    // The content version the page was built from (<html data-content-version>),
    // which a sheet's "Text as of" line and its comparison copies name.
    contentVersion: doc.documentElement?.dataset.contentVersion || null,
    // The page itself, where a handout copied in the LIT pane reads its notes.
    doc,
    footnoteBody: (id) => doc.getElementById(id)?.querySelector(".fn-body") ?? null,
    // Read fresh each time, like page.js's chapterText.
    anchorText: () => pageAnchorText(textBox?.children ?? []),
    // The footnotes as the pinned-footnote rules read them, [{ id, verse,
    // text }] (desk-footnotes.mjs), the same list page.js's footnoteList()
    // gives Study View; null for a draft. The fetched page never changes, so
    // it is read once.
    footnoteList: () => {
      if (draft) return null;
      pinnable ??= footnotesFromDom(textBox.children, (id) => {
        const body = doc.getElementById(id)?.querySelector(".fn-body");
        if (!body) return null;
        const clone = body.cloneNode(true);
        clone.querySelector(".footnote-backlink")?.remove();
        return clone.innerHTML;
      });
      return pinnable;
    },
  };
}

/**
 * The chapter's page, read: { bookKey, chapter, draft, textBox, verses,
 * termData, footnotes, goDeeper, contentVersion, doc, footnoteBody(id), anchorText(),
 * footnoteList() }, where
 * footnotes is the page's list in order, [{ id, label, verse | null }] (empty
 * for a draft). Rejects when the page
 * can't be had; a failed fetch is forgotten, so the next ask tries again.
 */
export function loadChapterPage(bookKey, chapter) {
  const key = `${bookKey} ${chapter}`;
  let p = cache.get(key);
  if (!p) {
    p = fetch(chapterHref(bookKey, chapter), { credentials: "same-origin" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((html) => {
        const source = read(new DOMParser().parseFromString(html, "text/html"), bookKey, chapter);
        loaded.set(key, source);
        return source;
      });
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

/**
 * The chapter's page if it has already been read, else null: for the code that
 * must answer at once (a change notice is judged on what is on screen now) and
 * can't wait for a fetch. Whoever shows the chapter has loaded it.
 */
export function loadedChapterPage(bookKey, chapter) {
  return loaded.get(`${bookKey} ${chapter}`) ?? null;
}
