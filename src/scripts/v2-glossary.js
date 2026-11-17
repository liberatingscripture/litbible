// Site 2.0's glossary (SITE-2.0.md, "Glossary": "one scroll. left pane on
// sheet."). On a computer the left pane (.v2-glossary__rail, data-v2 in
// glossary.astro) lists every entry by name. This keeps that list in the
// page's sort, under the sort's own labels, and marks the entry you are
// reading with aria-current, as v2-frame.js marks a contents rail.
//
// Its own marker rather than v2-frame.js's: that one pairs a rail's links
// with their targets once and expects them in page order, and the sort moves
// the entries. This one reads the targets' order on every pass.
//
// Nothing happens without the restyle's stamp (data-restyle on <html>), and
// nothing while the pane is not drawn (under 1000px).

import { currentIndex } from "./v2-frame.js";

/** The sort key the page is in: the switch's state, as glossary.astro's
 *  script sets it ("traditional" when checked, else "lit"). */
export function sortKeyOf(checked) {
  return checked === "true" ? "traditional" : "lit";
}

/** The rail's items in the order the page sorts its entries: by the label
 *  for `key`, compared as glossary.astro compares the entries' data-sort-*.
 *  `items` are { lit, traditional } (or anything carrying them); a copy is
 *  returned. */
export function orderRail(items, key) {
  return [...items].sort((a, b) => String(a[key]).localeCompare(String(b[key])));
}

/** The scrollTop that brings an item fully into a scrolled list, or the
 *  current one when it is in view already. Positions are relative to the
 *  list's content; `pad` keeps a little room above and below. */
export function scrollToShow(scrollTop, viewHeight, itemTop, itemHeight, pad = 8) {
  if (itemTop - pad < scrollTop) return Math.max(0, itemTop - pad);
  if (itemTop + itemHeight + pad > scrollTop + viewHeight) {
    return itemTop + itemHeight + pad - viewHeight;
  }
  return scrollTop;
}

function init() {
  const root = document.documentElement;
  if (!root.hasAttribute("data-restyle")) return;
  const rail = document.querySelector(".v2-glossary__rail");
  const list = rail?.querySelector(".v2-glossary__list");
  if (!list) return;
  const toggle = document.getElementById("category-toggle");

  const items = Array.from(list.children).map((li) => {
    const link = li.querySelector('a[href^="#"]');
    let target = null;
    try {
      target = link && document.getElementById(decodeURIComponent(link.hash.slice(1)));
    } catch {
      // A malformed fragment names nothing.
    }
    return { li, link, target, lit: li.dataset.lit, traditional: li.dataset.traditional };
  });
  const pairs = items.filter((it) => it.link && it.target);

  let key = "lit";
  const applySort = () => {
    const next = sortKeyOf(toggle?.getAttribute("aria-checked"));
    if (next === key) return;
    key = next;
    for (const it of orderRail(items, key)) {
      if (it.link) it.link.textContent = it[key];
      list.append(it.li);
    }
  };

  let current = null;
  const mark = () => {
    if (!list.getClientRects().length) return; // the pane is not drawn
    const pad = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
    const atEnd = window.innerHeight + window.scrollY >= root.scrollHeight - 2;
    const placed = pairs
      .map((it) => ({ it, top: it.target.getBoundingClientRect().top }))
      .sort((a, b) => a.top - b.top);
    const index = currentIndex(
      placed.map((p) => p.top),
      pad + 96,
      atEnd,
    );
    const link = placed[index]?.it.link ?? null;
    if (link === current) return;
    current?.removeAttribute("aria-current");
    link?.setAttribute("aria-current", "location");
    current = link;
    if (link) {
      const li = link.closest("li");
      const top = li.offsetTop - list.offsetTop;
      list.scrollTop = scrollToShow(list.scrollTop, list.clientHeight, top, li.offsetHeight);
    }
  };

  let queued = false;
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      mark();
    });
  };

  // The page's sort announces each reorder (and the desk's heading fit
  // sends the same event); the list follows, then the marker is read again.
  addEventListener("glossary-reordered", () => {
    applySort();
    current?.removeAttribute("aria-current");
    current = null;
    queue();
  });
  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", queue, { passive: true });
  applySort();
  mark();
}

if (typeof document !== "undefined") init();
