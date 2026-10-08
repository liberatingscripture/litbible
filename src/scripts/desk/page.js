// src/scripts/desk/page.js
//
// What the desk needs to know about the page it runs on.

import { bookKeyToLabel } from "../../data/books.js";
import { pageAnchorText } from "../../lib/desk-anchor-dom.mjs";

/** The Study View chapter this page shows, or null (an intro, a draft, Read View, any other page). */
export function pageChapter() {
  const article = document.querySelector("article.chapter[data-last-read-book]");
  const bookKey = article?.dataset.lastReadBook;
  const chapter = Number(article?.dataset.lastReadChapter);
  if (!bookKey || !chapter || !document.querySelector(".chapter-paragraphs")) return null;
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
