// src/scripts/desk/sheets/sheet-pages.js
//
// The copy on /sheets drawn as pages (BVJ, 2026-11-10): sheets of the chosen
// paper, one under another with a gap between, the way a word processor's
// print layout shows a document, rather than one long white block. Only the
// screen changes: print.css and the paper's @page rule still lay the printed
// copy out, and the spacers this adds are display: none on paper.
//
// The copy stays one element, so its links, its focus order and what a screen
// reader hears are untouched. A page is made by pushing what would cross the
// foot of one page's text area down to the top of the next, with an empty
// spacer: before a block that should start the next page, or, inside a
// paragraph, before the first word of the line that would cross. The print
// rules are followed as sheets-page.css states them for print: a sheet's own
// page break starts a new page, a part marked break-inside: avoid moves whole
// when it fits on a page, and a heading marked break-after: avoid goes with
// what follows it. The sheets behind the text are the copy's background
// (sheets-page.css, `.sheet-copy[data-paged]`), so nothing else is drawn.
//
// Copy and Save as read the copy on screen: `unpaged` hands them a copy with
// the spacers taken out (sheet-word.js), so a file never carries a gap.

const GAP = 24; // px between two sheets on screen
const SPACER = "sheet-page-gap";
// A page's number, as the paper's @page rule prints it (pageRule in
// desk-sheet-copy.mjs): page 1's centered in the bottom margin, the rest's at
// the top right. Drawn over the page, so it moves nothing.
const NUMBER = "sheet-page-number";
const ADDED = `.${SPACER}, .${NUMBER}`;
const EPS = 0.5;

/** A CSS length in inches or millimeters, in CSS pixels. */
export function lengthPx(value) {
  const m = /^([\d.]+)(in|mm)$/.exec(String(value).trim());
  if (!m) return NaN;
  return Number(m[1]) * (m[2] === "in" ? 96 : 96 / 25.4);
}

/** The article with the spacers taken out, for anything that reads the copy. */
export function unpaged(article) {
  if (!article.querySelector(ADDED)) return article;
  const clone = article.cloneNode(true);
  for (const s of clone.querySelectorAll(ADDED)) s.remove();
  clone.normalize();
  return clone;
}

/** Take the pages away: the copy as one block again. */
export function unpaginate(article) {
  for (const s of article.querySelectorAll(ADDED)) s.remove();
  article.normalize();
  delete article.dataset.paged;
  for (const p of ["--sheet-page-height", "--sheet-page-gap", "height"]) article.style.removeProperty(p);
}

const display = (el) => getComputedStyle(el).display;
const isBlock = (el) => /^(block|list-item|flow-root|table|flex|grid)$/.test(display(el));
const atomicInline = (el) => el.nodeType === Node.ELEMENT_NODE && /^inline-(block|grid|flex|table)$/.test(display(el));
// Flex and grid boxes, figures and the like move whole; only plain block flow is entered.
const enterable = (el) => /^(block|list-item|flow-root)$/.test(display(el));

/**
 * Lay the copy out as pages of `paper` ({ height, margin } as CSS lengths).
 * Safe to call again: it starts from the copy as one block each time.
 *
 * @param {HTMLElement} article a copy from renderCopy, on the page
 * @param {{ height: string, margin: string }} paper
 * @returns {number} how many pages (0 when it couldn't lay them out)
 */
export function paginate(article, paper) {
  unpaginate(article);
  const H = lengthPx(paper.height);
  const M = lengthPx(paper.margin);
  if (!(H > 0) || !(M >= 0) || !article.isConnected || !article.offsetHeight) return 0;
  const step = H + GAP;
  const textHeight = H - 2 * M;
  article.dataset.paged = "";
  article.style.setProperty("--sheet-page-height", `${H}px`);
  article.style.setProperty("--sheet-page-gap", `${GAP}px`);

  const y = (v) => v - article.getBoundingClientRect().top;
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { top: y(r.top), bottom: y(r.bottom), height: r.height };
  };
  const pageOf = (top) => Math.floor(top / step);
  const textTop = (page) => page * step + M;
  const textBottom = (page) => page * step + H - M;

  /** A spacer before `node` whose foot lands on `target`: a block's, or one inside a paragraph. */
  function pushTo(node, target, inline) {
    const s = document.createElement(inline ? "span" : "div");
    s.className = SPACER;
    s.setAttribute("aria-hidden", "true");
    s.style.display = "block";
    s.style.height = "1px";
    // A block's own space above is dropped at the top of a page, as on paper.
    if (!inline) s.style.marginBottom = `-${getComputedStyle(node).marginTop}`;
    node.parentNode.insertBefore(s, node);
    s.style.height = `${Math.max(0, target - box(s).top)}px`;
  }

  /**
   * Move `el` to the top of the next page, taking what must stay with it: a
   * heading before it (break-after: avoid), found past the edge of a box `el`
   * opens (a part's text that begins with a list, a passage's first line), and
   * a floated figure beside it (a passage's code). E99.
   */
  function startNextPage(el, page) {
    let first = el;
    for (let i = 0; i < 4; i++) {
      let lead = first;
      let prev = lead.previousElementSibling;
      while (!prev && lead.parentNode && lead.parentNode !== article) {
        lead = lead.parentNode;
        prev = lead.previousElementSibling;
      }
      if (!prev || prev.classList.contains(SPACER) || pageOf(box(prev).top) !== page) break;
      const style = getComputedStyle(prev);
      if (style.float === "none" && style.breakAfter !== "avoid") break;
      first = prev;
    }
    // A heading already first on its page can't take what follows with it.
    if (first !== el && box(first).top <= textTop(page) + 1) first = el;
    pushTo(first, textTop(page + 1), false);
  }

  /**
   * Where to break a paragraph crossing the foot of `page`'s text: the node to
   * put a spacer before, `"first"` when the crossing line is its first, or
   * null when no line crosses.
   */
  function lineCrossing(el, page) {
    const limit = textBottom(page);
    const next = textTop(page + 1);
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let node = walk.nextNode(); node; node = walk.nextNode()) {
      const text = node.nodeValue;
      for (let i = 0; i < text.length; i++) {
        if (/\s/.test(text[i])) continue;
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const r = range.getBoundingClientRect();
        if (!r.height) continue;
        const top = y(r.top);
        const bottom = y(r.bottom);
        if (bottom <= limit + EPS) continue;
        if (top >= next - EPS) return null; // already on the next page
        // Before the outermost inline that starts with this character (a verse
        // number, an italic run), or before the atomic inline holding it (a
        // blank), never inside either.
        let at = i > 0 ? node.splitText(i) : node;
        for (let p = at.parentNode; p && p !== el; p = p.parentNode) if (atomicInline(p)) at = p;
        while (at.parentNode !== el && !at.previousSibling && !atomicInline(at.parentNode)) at = at.parentNode;
        if (at.parentNode === el && !hasContentBefore(at)) return "first";
        return at;
      }
    }
    return null;
  }
  const hasContentBefore = (node) => {
    for (let p = node.previousSibling; p; p = p.previousSibling) {
      if (p.nodeType === Node.TEXT_NODE ? p.nodeValue.trim() : p.nodeType === Node.ELEMENT_NODE) return true;
    }
    return false;
  };

  /** Break a paragraph at each page foot it crosses. */
  function breakLines(el) {
    let page = pageOf(box(el).top);
    for (let guard = 0; guard < 200; guard++) {
      const b = box(el);
      if (b.bottom <= textBottom(page) + EPS) return;
      const at = lineCrossing(el, page);
      if (at === "first") {
        if (b.top > textTop(page) + 1) startNextPage(el, page);
        page++;
        continue;
      }
      if (at) pushTo(at, textTop(page + 1), true);
      page++;
    }
  }

  /** Place one block. `forced`: a page break comes right before it. */
  function place(el, forced) {
    let b = box(el);
    if (!b.height) return false; // nothing to move; a forced break waits for the next block
    let page = pageOf(b.top);
    if (forced && b.top > textTop(page) + 1) pushTo(el, textTop(page + 1), false);
    else if (b.top >= textBottom(page) - EPS) startNextPage(el, page);
    if (b.top !== box(el).top) {
      b = box(el);
      page = pageOf(b.top);
    }
    if (b.bottom <= textBottom(page) + EPS) return true;
    const avoid = /^avoid/.test(getComputedStyle(el).breakInside);
    if (avoid && b.height <= textHeight && b.top > textTop(page) + 1) {
      startNextPage(el, page);
      return true;
    }
    if (!enterable(el)) {
      // A box that moves whole: to the next page if it fits there.
      if (b.height <= textHeight && b.top > textTop(page) + 1) startNextPage(el, page);
      return true;
    }
    const kids = [...el.children].filter((k) => !k.classList.contains(SPACER) && isBlock(k));
    if (kids.length) placeAll(kids);
    else breakLines(el);
    return true;
  }

  function placeAll(blocks) {
    let brk = false;
    for (const el of blocks) {
      if (el.classList.contains(SPACER)) continue;
      if (el.classList.contains("sheet-copy__break")) {
        brk = true;
        continue;
      }
      // A block that always starts a page (the answer key, E100).
      if (getComputedStyle(el).breakBefore === "page") brk = true;
      if (place(el, brk)) brk = false;
    }
  }

  placeAll([...article.children]);

  // Fill the last page out to its foot.
  const end = box(article).bottom - (parseFloat(getComputedStyle(article).paddingBottom) || 0);
  const pages = Math.max(1, pageOf(Math.max(0, end - EPS)) + 1);
  article.style.height = `${pages * step - GAP}px`;
  for (let page = 0; page < pages; page++) {
    const n = document.createElement("span");
    n.className = page ? NUMBER : `${NUMBER} ${NUMBER}--first`;
    n.setAttribute("aria-hidden", "true");
    n.textContent = String(page + 1);
    n.style.top = `${page ? page * step + M / 2 : H - M / 2}px`;
    article.append(n);
  }
  return pages;
}
