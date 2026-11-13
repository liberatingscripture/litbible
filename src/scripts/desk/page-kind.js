// src/scripts/desk/page-kind.js
//
// What kind of page this is, read off the DOM, for the modules the desk's
// first stage carries (note-settings.js; Audit 3, LG3-2): Read View's book,
// and N11's prose page. page.js and note-sources.js re-export them, so the
// rest of the desk imports them from there as before. Its one import is the
// switch, which lives beside the reading surfaces it also turns off (E124).

import { PROSE_NOTES } from "../desk-frame.js";

/** The book Read View shows on this page, or null anywhere else. */
export function readBook() {
  const root = document.querySelector("[data-rm-root]");
  const book = root?.dataset.rmBook;
  return book && root.querySelector("[data-rm-text]") ? book : null;
}

/** Whether the desk offers notes on glossary entries and articles (N11): off in version 1. */
export { PROSE_NOTES };

/**
 * The glossary or an article, as notes see it: its targets, each with the
 * element holding its own text (`root`) and its heading (`head`, where a
 * note on the whole entry or article sits). Null on any other page, and on
 * the glossary unless the desk is on, which gives it a reading column.
 * Null everywhere while PROSE_NOTES is off.
 *
 * @returns {{ kind: "article" | "glossary", box: Element, label: string,
 *   targets: Array<{ type: string, id: string, title: string, root: Element, head: Element }> } | null}
 */
export function prosePage() {
  if (!PROSE_NOTES) return null;
  const card = document.querySelector(".article__card");
  const body = card?.querySelector(".article__body");
  if (card && body) {
    const slug = /^\/articles\/([^/]+)\/?$/.exec(window.location.pathname)?.[1];
    if (!slug) return null;
    const head = card.querySelector(".article__title") ?? body;
    const title = head.textContent.trim() || slug;
    return {
      kind: "article",
      box: card,
      label: "This article",
      targets: [{ type: "article", id: decodeURIComponent(slug), title, root: body, head }],
    };
  }
  const wrap = document.querySelector(".glossary-entries .entries-wrap");
  if (wrap && document.documentElement.hasAttribute("data-desk")) {
    const targets = Array.from(wrap.querySelectorAll("article.entry[data-entry]"))
      .map((el) => ({
        type: "glossaryEntry",
        id: el.dataset.entry,
        title: el.querySelector(".entries-strike strong")?.textContent.trim() || el.dataset.entry,
        root: el.querySelector(".entry-body"),
        // The heading's visible words: it also holds an off-screen label for
        // the site search, whose box would misplace the note.
        head: el.querySelector(".entries-strike") ?? el.querySelector(".entry-title") ?? el,
      }))
      .filter((t) => t.root);
    return { kind: "glossary", box: wrap, label: "The glossary", targets };
  }
  return null;
}
