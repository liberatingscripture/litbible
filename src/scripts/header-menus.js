// src/scripts/header-menus.js
//
// The header's Learn, Study, and About menus (SiteHeader.astro;
// SITE-FEATHERBOA.md, "Four places: the header"), and the menu sheet
// (MenuSheet.astro; "The phone," "The menu"). Each header menu is a <details>
// whose summary is the place's name, so a menu opens and its links work
// without JavaScript. This adds the rest:
//
// - one open at a time (the menus share a name, which newer browsers honor
//   themselves), closed by a press elsewhere, by Escape, which returns focus
//   to its place, and by Tab leaving it;
// - Arrow Down or Up on a place opens its menu at its first or last row,
//   and the arrows, Home, and End move among the rows;
// - the menu sheet: every [data-menu-toggle] (the header's "Menu," and the
//   phone bar's on a reading page, a link to the footer's links until this
//   makes it a button) opens it as a modal <dialog>, so the page behind goes
//   inert and dims and focus stays inside. Escape, a tap outside it, its ×,
//   or following one of its links closes it, and focus goes back to the
//   button that opened it. Its Study group shows only where the header
//   shows Study (header.css), so its news counts only there too;
// - the news marks (src/lib/news.mjs; NX-26, HD-31): a dot on each place
//   holding news this browser hasn't seen, "New" beside each such row, and
//   "See what's new →" at the menu's foot, in the header's menus and the
//   sheet's groups alike, and a dot on each menu button while the sheet
//   holds news. Opening a menu, or the sheet, sees its news: the dot on what
//   was pressed goes at once, and the rest when it closes, so the reader
//   sees what is new while it is open. With no news, nothing here reads or
//   writes storage.
//
// It runs once as the page loads; test/header-menus.test.js calls start()
// with its own page, news, day, storage, and width. The account's menu
// beside Aa is desk/account/header-entry.js's.

import { NEWS, SEEN_KEY, dayOf, liveNews, markedPlaces, markedRows, parseSeen, seenAfterOpening } from "../lib/news.mjs";
import { asButton } from "./link-button.js";

/** The width from which the header shows Study, with the Study preview on
 *  (header.css, ST-16); the sheet's Study group follows it. */
const STUDY_QUERY = "(min-width: 1100px)";

function ownStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // storage is blocked: the marks show on each page until it isn't
  }
}

/**
 * Wires the header's menus and the menu sheet, and draws their news marks.
 *
 * @param {{ doc?: Document, news?: readonly object[], today?: string, storage?: Storage | null, wide?: () => boolean }} [env]
 *   `wide` says whether the sheet shows Study's group now.
 * @returns {() => void} takes away the listeners on the page (a test's next page)
 */
export function start({
  doc = globalThis.document,
  news = NEWS,
  today = dayOf(),
  storage = ownStorage(),
  wide = () => doc.documentElement.hasAttribute("data-desk") && (doc.defaultView?.matchMedia?.(STUDY_QUERY).matches ?? false),
} = {}) {
  const groups = [...doc.querySelectorAll("details[data-nav-group]")];
  const page = new AbortController();
  const { signal } = page;

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

  // The sheet, where the browser has modal dialogs; without them its buttons
  // stay links to the footer's links.
  const found = doc.getElementById("menuSheet");
  const sheet = typeof found?.showModal === "function" ? found : null;
  const inOpenSheet = (el) => Boolean(sheet?.open && sheet.contains(el));
  const sheetPlaces = () => (wide() ? ["study", "learn", "about"] : ["learn", "about"]);

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

  /** The dot on each menu button: whether a place the sheet shows has news
   *  this browser hasn't seen. */
  function drawMenuDots() {
    const places = new Set(markedPlaces(live, seen));
    const any = sheetPlaces().some((place) => places.has(place));
    for (const dot of doc.querySelectorAll("[data-news-menu]")) dot.hidden = !any;
  }

  /** Shows the marks for what this browser hasn't seen; a menu that is open,
   *  or the sheet while it is open, keeps its marks until it closes. */
  function drawNews() {
    if (!live.length) return;
    const places = new Set(markedPlaces(live, seen));
    const rows = new Set(markedRows(live, seen));
    const open = new Set(groups.filter((g) => g.open).map((g) => g.dataset.navGroup));
    for (const dot of doc.querySelectorAll("[data-news-dot]")) {
      if (!inOpenSheet(dot)) dot.hidden = !places.has(dot.dataset.newsDot);
    }
    for (const mark of doc.querySelectorAll("[data-news-row]")) {
      const place = mark.dataset.newsRow.split(":")[0];
      if (!open.has(place) && !inOpenSheet(mark)) mark.hidden = !rows.has(mark.dataset.newsRow);
    }
    for (const more of doc.querySelectorAll("[data-news-more]")) {
      if (!open.has(more.dataset.newsMore) && !inOpenSheet(more)) more.hidden = !places.has(more.dataset.newsMore);
    }
    drawMenuDots();
  }

  /** Marks the news of `places` seen: their dots outside an open sheet go at
   *  once, as do the menu buttons' once nothing in the sheet is left. */
  function seeNews(places) {
    if (!live.length) return;
    const marked = markedPlaces(live, seen);
    const fresh = [places].flat().filter((place) => marked.includes(place));
    if (!fresh.length) return;
    for (const place of fresh) seen = seenAfterOpening(live, seen, place);
    try {
      storage?.setItem(SEEN_KEY, JSON.stringify(seen));
    } catch {
      // Seen for this page only.
    }
    for (const place of fresh) {
      for (const dot of doc.querySelectorAll(`[data-news-dot="${place}"]`)) if (!inOpenSheet(dot)) dot.hidden = true;
    }
    drawMenuDots();
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
    { signal },
  );

  // ---------- The menu sheet ----------

  const openers = sheet ? [...doc.querySelectorAll("[data-menu-toggle]")] : [];
  let opener = null;

  function openSheet(button) {
    if (sheet.open) return;
    opener = button;
    for (const group of groups) close(group);
    sheet.showModal();
    for (const b of openers) b.setAttribute("aria-expanded", "true");
    seeNews(sheetPlaces());
    sheet.querySelector("[data-menu-close]")?.focus();
  }

  /** What closing leaves: the buttons say so, the marks catch up, and focus
   *  goes back to the button that opened it. Runs once a closing, whichever
   *  way it came (this script's, or the browser's own on Escape or Back). */
  function closed({ focus = true } = {}) {
    if (!opener) return;
    const back = opener;
    opener = null;
    for (const b of openers) b.setAttribute("aria-expanded", "false");
    drawNews();
    if (focus) back.focus({ preventScroll: true });
  }

  function closeSheet(options) {
    if (sheet.open) sheet.close();
    closed(options);
  }

  if (sheet) {
    for (const button of openers) {
      if (button.tagName === "A") {
        asButton(button, sheet.id);
        button.setAttribute("aria-haspopup", "dialog");
      }
      button.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          sheet.open ? closeSheet() : openSheet(button);
        },
        { signal },
      );
    }

    sheet.addEventListener("close", () => sheet.open || closed(), { signal });

    sheet.addEventListener(
      "click",
      (event) => {
        // A press on the dimmed page lands on the dialog itself, which the
        // panel fills.
        if (event.target === sheet) {
          closeSheet();
          return;
        }
        if (event.target.closest?.("[data-menu-close]")) {
          closeSheet();
          return;
        }
        // A link closes the sheet a frame later, after the press has drawn
        // (a new page unloads first; the Search row opens the header's strip,
        // header-search.js). A modified click opens a tab and leaves it open.
        if (!event.target.closest?.("a[href]")) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        doc.defaultView.requestAnimationFrame(() => closeSheet());
      },
      { signal },
    );

    sheet.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeSheet();
          return;
        }
        // Tab stays inside: from the last stop to the first, and back.
        if (event.key !== "Tab") return;
        const stops = [...sheet.querySelectorAll("a[href], button:not([disabled])")].filter(
          (el) => el.getClientRects().length > 0,
        );
        if (stops.length < 2) return;
        const first = stops[0];
        const last = stops[stops.length - 1];
        if (event.shiftKey && doc.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && doc.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      },
      { signal },
    );

    // Back to a page kept whole (the back-forward cache) finds it closed.
    doc.defaultView.addEventListener(
      "pageshow",
      (event) => {
        if (event.persisted && sheet.open) closeSheet({ focus: false });
      },
      { signal },
    );

    // Study's group comes and goes with the window's width.
    if (live.length) doc.defaultView.matchMedia?.(STUDY_QUERY)?.addEventListener?.("change", drawNews, { signal });
  }

  drawNews();
  return () => page.abort();
}

start();
