// src/scripts/desk/footnote-links.js
//
// The links in a footnote's body on /desk (Audit 8, DK8-2; BVJ, 2026-11-10),
// one rule for the three places a note is drawn (the Footnotes pane, This
// verse, the LIT pane's footnote popover) and the same one the Book Intro pane
// keeps: a plain click on a scripture reference (`a.sref`) moves the LIT pane
// (`env.showPassage`); a modified click (Ctrl, Cmd, Shift, Alt, middle) keeps
// the browser's own default; any other link leaves the desk, so it opens in a
// new tab (E34).

import { resultTarget } from "../../lib/desk-search-pane.mjs";

const modified = (e) => e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

/**
 * @param {Element} root  a footnote body, or the box holding one
 * @param {((passage: object) => unknown) | null} showPassage  desk-page.js's;
 *   with none, the links are left as they are
 */
export function routeFootnoteLinks(root, showPassage) {
  if (!root || typeof showPassage !== "function") return;
  for (const a of root.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href");
    if (href.startsWith("#")) continue;
    const isPassage = a.classList.contains("sref") && resultTarget(href).type === "passage";
    if (isPassage) continue;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  }
  root.addEventListener("click", (e) => {
    const a = e.target.closest?.("a.sref[href]");
    if (!a || modified(e) || !root.contains(a)) return;
    const target = resultTarget(a.getAttribute("href"));
    if (target.type !== "passage") return;
    e.preventDefault();
    showPassage({ bookKey: target.bookKey, chapter: target.chapter, verse: target.verse });
  });
}
