// Site 2.0's /search (SITE-2.0.md, "Search"; the mock is mock/search.html).
// Decided (BVJ, 2026-11-16/17): "Yes to two panes, but with some changes";
// of the redraw, "That's better"; and of the page links, "Always showing five,
// when there are five or more pages of results."
//
// search.js calls in here; nothing here runs on its own. Every function that
// touches the page returns at once without the restyle's stamp, so a reader
// without the preview gets main's page exactly. The one pure function,
// v2PageRange, is used only when search.js has checked the stamp.
//
// With the stamp, startV2Search MOVES (never copies) today's controls into
// the pane search.astro hands SearchLayout ([data-v2-search-pane]): the sort,
// the two filters, and, on a computer, the passage picker at the pane's foot.
// Moved nodes keep their listeners, ids and labels. "Notebook actions" (and
// the Greek's "Search commands" and "My notes", which travel with it) moves to
// the end of the count's line. drawV2Groups lists the result groups in the
// pane, in the page's order, and a marker follows the group being read.

import { currentIndex } from "./v2-frame.js";

const stamped = () =>
  typeof document !== "undefined" && document.documentElement.hasAttribute("data-restyle");

/** True when the 2.0 look is on (the restyle's stamp). */
export function v2Search() {
  return stamped();
}

/**
 * The page links 2.0 shows: every page up to four, and from five pages on
 * always five numbers, with "…" where pages are left out. At the start
 * (pages 1 and 2) the first three and the last two; at the end the first two
 * and the last three; between, the first, the current page with one either
 * side, and the last. 12 pages on page 1: 1, 2, 3, …, 11, 12.
 */
export function v2PageRange(current, total) {
  const n = Math.max(0, Math.floor(total));
  if (n <= 4) return Array.from({ length: n }, (_, i) => i + 1);
  const c = Math.min(Math.max(1, Math.floor(current)), n);
  let nums;
  if (c <= 2) nums = [1, 2, 3, n - 1, n];
  else if (c >= n - 1) nums = [1, 2, n - 2, n - 1, n];
  else nums = [1, c - 1, c, c + 1, n];
  const out = [];
  nums.forEach((p, i) => {
    if (i > 0 && p - nums[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

const WIDE = "(min-width: 1000px)";
let pane = null;
let groupsNav = null;
let pairs = [];
let current = null;

/** Moves today's controls into the 2.0 pane. Once, from search.js, after its own setup. */
export function startV2Search() {
  if (!stamped()) return;
  pane = document.querySelector("[data-v2-search-pane]");
  if (!pane) return;
  groupsNav = pane.querySelector("[data-v2-search-groups]");

  const sort = document.querySelector(".search-page .sort-wrap");
  if (sort) pane.querySelector("[data-v2-search-sort]")?.append(sort);

  const filters = document.querySelector(".scripture-layout--search .searchbar__filters");
  if (filters) pane.querySelector("[data-v2-search-filters]")?.append(filters);

  // The Study Desk's "Notebook actions" row (search.js builds it beside the
  // field with the desk on): at the end of the count's line.
  const extras = document.querySelector(".scripture-layout--search .greek-field-extras");
  const status = document.getElementById("search-status");
  if (extras && status) status.after(extras);

  // The passage picker: the foot of the pane on a computer, the end of the
  // title's row below that (where the layout already has it). A comment marks
  // its place so it goes back exactly there.
  const picker = document.querySelector(".scripture-layout--search .scripture-tools__left");
  const foot = pane.querySelector("[data-v2-search-go]");
  if (picker && foot) {
    const home = document.createComment(" v2: the passage picker's place ");
    picker.before(home);
    const wide = window.matchMedia(WIDE);
    const place = () => {
      if (wide.matches) {
        if (picker.parentNode !== foot) foot.append(picker);
      } else if (home.nextSibling !== picker) home.after(picker);
    };
    wide.addEventListener("change", place);
    place();
  }

  let queued = false;
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      mark();
    });
  };
  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", queue, { passive: true });
}

/**
 * The pane's list of result groups, from the groups search.js's jump links
 * are made from ({ count, target }): in the page's order, each named by its
 * group's own label, with its count. Shown, like the jump links, when two or
 * more groups have results.
 */
export function drawV2Groups(groups) {
  if (!stamped() || !groupsNav) return;
  const shown = groups
    .filter((g) => g.count > 0 && g.target)
    .sort((a, b) =>
      a.target.compareDocumentPosition(b.target) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
  // search.js names a group (the notebook's) just after it lists them, so
  // the labels are read once it has.
  queueMicrotask(() => {
    const list = groupsNav.querySelector("ul");
    list.replaceChildren();
    pairs = [];
    current = null;
    groupsNav.hidden = shown.length < 2;
    if (groupsNav.hidden) return;
    for (const g of shown) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = `#${g.target.id}`;
      const name = document.createElement("span");
      name.textContent = g.target.querySelector(".group-title")?.textContent.trim() || "";
      const n = document.createElement("span");
      n.className = "v2-search__n";
      n.textContent = String(g.count);
      a.append(name, n);
      // As the jump links do: scroll and focus rather than follow the hash,
      // since a fragment navigation fires popstate, which re-renders.
      a.addEventListener("click", (e) => {
        e.preventDefault();
        g.target.scrollIntoView({ block: "start" });
        g.target.focus({ preventScroll: true });
      });
      li.append(a);
      list.append(li);
      pairs.push([a, g.target]);
    }
    mark();
  });
}

/** The marker: the group whose label has passed a line near the window's top. */
function mark() {
  if (!groupsNav || groupsNav.hidden || !pairs.length) return;
  if (!groupsNav.getClientRects().length) return;
  const root = document.documentElement;
  const atEnd = window.innerHeight + window.scrollY >= root.scrollHeight - 2;
  const live = pairs.filter(([, target]) => !target.hidden);
  const index = currentIndex(
    live.map(([, target]) => target.getBoundingClientRect().top),
    120,
    atEnd,
  );
  const link = live[index]?.[0] ?? null;
  if (link === current) return;
  current?.removeAttribute("aria-current");
  link?.setAttribute("aria-current", "location");
  current = link;
}
