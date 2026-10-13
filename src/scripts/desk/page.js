// src/scripts/desk/page.js
//
// What the desk needs to know about the page it runs on.

import { bookKeyToLabel } from "../../data/books.js";
import { pageAnchorText } from "../../lib/desk-anchor-dom.mjs";
import { footnotesFromDom } from "../../lib/desk-footnotes.mjs";

/** The Study View chapter this page shows, or null (an intro, a draft, Read View, any other page). */
export function pageChapter() {
  const article = document.querySelector("article.chapter[data-last-read-book]");
  const bookKey = article?.dataset.lastReadBook;
  const chapter = Number(article?.dataset.lastReadChapter);
  if (!bookKey || !chapter || !document.querySelector(".chapter-paragraphs")) return null;
  return { bookKey, chapter, label: `${bookKeyToLabel(bookKey)} ${chapter}` };
}

/**
 * Study View's scripture blocks. The interleaf's bands (`data-desk-band`,
 * interleaf.js) sit among them but are not scripture, so they are left out:
 * nothing that reads the chapter ever meets one.
 */
export function chapterBlocks() {
  const box = document.querySelector(".chapter-paragraphs");
  return box ? Array.from(box.children).filter((el) => !el.hasAttribute("data-desk-band")) : [];
}

/**
 * This page's chapter as anchor text, read fresh: the map it carries points
 * at today's DOM nodes, so it is never kept across a change to the page
 * (desk-anchor-dom.mjs).
 */
export function chapterText() {
  return pageAnchorText(chapterBlocks());
}

/**
 * This Study View chapter's footnotes as the pinned-footnote rules read them
 * ([{ id, verse, text }], desk-footnotes.mjs), or null when the page isn't a
 * chapter. Read fresh, like chapterText. A note's text is its `.fn-body`
 * without the back-link, so what the reader sees is what a pin keeps.
 */
export function footnoteList() {
  if (!pageChapter()) return null;
  return footnotesFromDom(chapterBlocks(), (id) => {
    const body = document.getElementById(id)?.querySelector(".fn-body");
    if (!body) return null;
    const clone = body.cloneNode(true);
    clone.querySelector(".footnote-backlink")?.remove();
    return clone.innerHTML;
  });
}

/** The book Read View shows on this page, or null anywhere else. */
export function readBook() {
  const root = document.querySelector("[data-rm-root]");
  const book = root?.dataset.rmBook;
  return book && root.querySelector("[data-rm-text]") ? book : null;
}

/** One chapter's blocks in Read View, where a whole book shares the page. */
export function readChapterBlocks(chapter) {
  return document.querySelectorAll(`[data-rm-text] .rm-block[data-chapter="${Number(chapter)}"]`);
}

/**
 * A chapter's anchor text from whichever view this page is: Study View's
 * chapter, or one chapter of the book Read View shows. Null when the page
 * doesn't show that chapter. Read fresh, like chapterText.
 */
export function chapterTextFor(bookKey, chapter) {
  const here = pageChapter();
  if (here) return here.bookKey === bookKey && here.chapter === chapter ? chapterText() : null;
  if (readBook() !== bookKey) return null;
  const blocks = readChapterBlocks(chapter);
  return blocks.length ? pageAnchorText(blocks) : null;
}

const LINE = "p, blockquote, li, h1, h2, h3, h4, h5, h6";

/**
 * Which line of the page a character of `text` (an anchor text read from the
 * page) sits in: the element of its nearest paragraph, poetry line or other
 * block, or null. Two highlights in different ones never merge
 * (STUDY-DESK-FORMAT.md, "Highlights that meet"), since a paragraph break
 * or a line of poetry isn't the space between two words.
 */
export function blockAt(text, pos) {
  const at = text.toDom(pos, "start");
  const el = at?.node?.parentElement;
  return el?.closest(LINE) ?? null;
}
