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
 * The chapter whose Greek the Notebook can show: a Study View chapter's, or a
 * draft chapter's (which has no LIT text yet), or null.
 */
export function greekChapter() {
  const here = pageChapter();
  if (here) return here;
  const article = document.querySelector("article.chapter[data-draft-book]");
  const bookKey = article?.dataset.draftBook;
  const chapter = Number(article?.dataset.draftChapter);
  if (!bookKey || !chapter) return null;
  return { bookKey, chapter, label: `${bookKeyToLabel(bookKey)} ${chapter}` };
}

/** Study View's scripture blocks. */
export function chapterBlocks() {
  return document.querySelector(".chapter-paragraphs")?.children ?? [];
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

/* ── /desk's LIT panes ───────────────────────────────────────────── */

// Each LIT pane on /desk (lit-pane.js) puts its text here, so the reader's
// marks can be drawn on it and read from it as they are on Study View
// (3g). A pane's text holds many chapters, and two panes may show the same
// one, so a chapter on /desk is a box, not the page.
const deskTexts = new Set();

/**
 * Fired on document when a LIT pane's text comes or goes, and when a chapter
 * comes into a pane's text or the pane clears it to go elsewhere
 * (`deskChaptersMoved`).
 */
export const DESK_TEXTS_EVENT = "lit:desk-texts";

const told = () => document.dispatchEvent(new CustomEvent(DESK_TEXTS_EVENT));

/**
 * Put a LIT pane's text (the element holding its chapters' sections) on the
 * desk's list. Returns what takes it off again.
 */
export function addDeskText(container) {
  deskTexts.add(container);
  told();
  return () => {
    if (deskTexts.delete(container)) told();
  };
}

/** A LIT pane tells the desk its text gained a chapter or was cleared. */
export function deskChaptersMoved() {
  told();
}

/** The LIT panes' texts on the page now. */
export function deskTextsNow() {
  return Array.from(deskTexts).filter((c) => c.isConnected);
}

/**
 * Every LIT pane's text on the desk's list, on the page or not: a pane is
 * built off the page, and every pane leaves it for a moment while the panes
 * are redrawn, so what watches their texts goes by the list.
 */
export function deskTextsListed() {
  return Array.from(deskTexts);
}

/**
 * Call `fn` when the set of chapters the LIT panes show has changed, at most
 * once a frame: for a view that judges records against the text only where a
 * pane shows their chapter (chapterTextFor), and draws nothing else from the
 * panes (BA121). Returns what stops it.
 */
export function onDeskChapters(fn) {
  const shown = () => [...new Set(deskChapterBoxes().map((c) => `${c.bookKey} ${c.chapter}`))].sort().join("|");
  let last = shown();
  let frame = 0;
  const check = () => {
    frame = 0;
    const now = shown();
    if (now === last) return;
    last = now;
    fn();
  };
  const heard = () => {
    if (!frame) frame = requestAnimationFrame(check);
  };
  document.addEventListener(DESK_TEXTS_EVENT, heard);
  return () => {
    document.removeEventListener(DESK_TEXTS_EVENT, heard);
    if (frame) cancelAnimationFrame(frame);
  };
}

/**
 * Every chapter the LIT panes show now, as { box, bookKey, chapter }, where
 * box is that chapter's `.chapter-paragraphs`. A chapter two panes show is
 * there twice. Read fresh: a pane adds and drops chapters as it scrolls.
 */
export function deskChapterBoxes() {
  const out = [];
  for (const container of deskTextsNow()) {
    for (const section of container.querySelectorAll(".desk-lit__chapter[data-key]")) {
      const box = section.querySelector(".chapter-paragraphs");
      const chapter = Number(section.dataset.chapter);
      if (box && section.dataset.book && chapter) out.push({ box, bookKey: section.dataset.book, chapter });
    }
  }
  return out;
}

/**
 * A chapter's anchor text from whichever view this page is: Study View's
 * chapter, one chapter of the book Read View shows, or, on /desk, the first
 * LIT pane showing it. Null when the page doesn't show that chapter. Read
 * fresh, like chapterText.
 */
export function chapterTextFor(bookKey, chapter) {
  const here = pageChapter();
  if (here) return here.bookKey === bookKey && here.chapter === chapter ? chapterText() : null;
  if (deskTexts.size) {
    const at = deskChapterBoxes().find((c) => c.bookKey === bookKey && c.chapter === chapter);
    return at ? pageAnchorText(at.box.children) : null;
  }
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
