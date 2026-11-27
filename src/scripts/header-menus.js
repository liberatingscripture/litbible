// src/scripts/header-menus.js
//
// The header's Learn, Study, and About menus (SiteHeader.astro;
// SITE-FEATHERBOA.md, "Four places: the header"). Each is a <details> whose
// summary is the place's name, so a menu opens and its links work without
// JavaScript. This adds the rest:
//
// - one open at a time (the menus share a name, which newer browsers honor
//   themselves), closed by a press elsewhere, by Escape, which returns focus
//   to its place, and by Tab leaving it;
// - Arrow Down or Up on a place opens its menu at its first or last row,
//   and the arrows, Home, and End move among the rows;
// - the news marks (src/lib/news.mjs; NX-26, HD-31): a dot on each place
//   holding news this browser hasn't seen, "New" beside each such row, and
//   "See what's new →" at the menu's foot. Opening the menu sees them: the dot
//   goes at once, and the rest when the menu closes, so the reader sees what
//   is new while it is open. With no news, nothing here reads or writes
//   storage.
//
// It runs once as the page loads; test/header-menus.test.js calls start()
// with its own page, news, day, and storage. The account's menu beside Aa is
// desk/account/header-entry.js's.

import { NEWS, SEEN_KEY, dayOf, liveNews, markedPlaces, markedRows, parseSeen, seenAfterOpening } from "../lib/news.mjs";

function ownStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // storage is blocked: the marks show on each page until it isn't
  }
}

/**
 * Wires the header's menus and draws its news marks.
 *
 * @param {{ doc?: Document, news?: readonly object[], today?: string, storage?: Storage | null }} [env]
 * @returns {() => void} takes away the listener on the page (a test's next page)
 */
export function start({ doc = globalThis.document, news = NEWS, today = dayOf(), storage = ownStorage() } = {}) {
  const groups = [...doc.querySelectorAll("details[data-nav-group]")];
  const page = new AbortController();

  const summaryOf = (group) => group.querySelector(":scope > summary");
  const rowsOf = (group) =>
    [...group.querySelectorAll(".site-nav__menu a")].filter((a) => a.closest("[hidden]") == null);

  function close(group, { focus = false } = {}) {
    if (group.open) group.open = false;
    if (focus) summaryOf(group)?.focus();
  }

  function closeOthers(group) {
    for (const other of groups) if (other !== group) close(other);
  }

  function openAt(group, which) {
    closeOthers(group);
    group.open = true;
    const rows = rowsOf(group);
    (which === "last" ? rows[rows.length - 1] : rows[0])?.focus();
  }

  // ---------- News ----------

  const live = liveNews(news, today);
  let seen = [];
  if (live.length) {
    try {
      seen = parseSeen(storage?.getItem(SEEN_KEY));
    } catch {
      // Storage is blocked: the marks show on each page until it isn't.
    }
  }

  /** Shows the marks for what this browser hasn't seen; a menu that is open
   *  keeps its "New" until it closes. */
  function drawNews() {
    if (!live.length) return;
    const places = new Set(markedPlaces(live, seen));
    const rows = new Set(markedRows(live, seen));
    const open = new Set(groups.filter((g) => g.open).map((g) => g.dataset.navGroup));
    for (const dot of doc.querySelectorAll("[data-news-dot]")) dot.hidden = !places.has(dot.dataset.newsDot);
    for (const mark of doc.querySelectorAll("[data-news-row]")) {
      const place = mark.dataset.newsRow.split(":")[0];
      if (!open.has(place)) mark.hidden = !rows.has(mark.dataset.newsRow);
    }
    for (const more of doc.querySelectorAll("[data-news-more]")) {
      if (!open.has(more.dataset.newsMore)) more.hidden = !places.has(more.dataset.newsMore);
    }
  }

  function seeNews(place) {
    if (!live.length || !markedPlaces(live, seen).includes(place)) return;
    seen = seenAfterOpening(live, seen, place);
    try {
      storage?.setItem(SEEN_KEY, JSON.stringify(seen));
    } catch {
      // Seen for this page only.
    }
    for (const dot of doc.querySelectorAll(`[data-news-dot="${place}"]`)) dot.hidden = true;
  }

  // ---------- The menus ----------

  for (const group of groups) {
    const summary = summaryOf(group);

    group.addEventListener("toggle", () => {
      if (group.open) {
        closeOthers(group);
        seeNews(group.dataset.navGroup);
      } else {
        drawNews();
      }
    });

    summary?.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        openAt(group, event.key === "ArrowUp" ? "last" : "first");
      } else if (event.key === "Escape" && group.open) {
        event.preventDefault();
        close(group, { focus: true });
      }
    });

    group.querySelector(".site-nav__menu")?.addEventListener("keydown", (event) => {
      const rows = rowsOf(group);
      const at = rows.indexOf(doc.activeElement);
      let next = null;
      if (event.key === "ArrowDown") next = rows[(at + 1) % rows.length];
      else if (event.key === "ArrowUp") next = rows[(at - 1 + rows.length) % rows.length];
      else if (event.key === "Home") next = rows[0];
      else if (event.key === "End") next = rows[rows.length - 1];
      else if (event.key === "Escape") {
        event.preventDefault();
        close(group, { focus: true });
        return;
      }
      if (next) {
        event.preventDefault();
        next.focus();
      }
    });

    // Tab out of the menu, or anywhere else focus goes, closes it.
    group.addEventListener("focusout", (event) => {
      if (group.open && event.relatedTarget && !group.contains(event.relatedTarget)) close(group);
    });
  }

  doc.addEventListener(
    "click",
    (event) => {
      for (const group of groups) if (group.open && !group.contains(event.target)) close(group);
    },
    { signal: page.signal },
  );

  drawNews();
  return () => page.abort();
}

start();
