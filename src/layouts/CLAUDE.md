# Layouts

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory.

- **On a phone, Chapter View's toolbar is one row** (audit F3, owner
  2026-09-28). At 640px and below the passage picker, a search button and an
  icon-only Read View link share one 44px row; search opens in place of the
  row, and its × or Escape closes it and returns focus to the button. The top
  Previous/Next are round ‹ › buttons beside the title **at every width**
  (owner, 2026-10-14), on the text column's own edges, and keep their names
  ("Previous: Romans 7"); the big buttons at the foot stay. Tablets (641–900px) get one
  row with a short "Read View" label. The one-row layout hangs off
  `data-compact`, which an inline script in `ScriptureLayout.astro` sets
  while the page is still parsing, right after the toolbar, so it is in place
  before first paint. **Keep that script inline**: a bundled module runs after
  first paint, and the whole toolbar would visibly jump. Without JS a phone
  keeps the stacked toolbar, whose search field works on its own.
  The toolbar's right slot holds two pills in `.reading-view-right` wrappers,
  one at a time: "Switch to Read View" (chapters only) and, with the Study Desk
  preview on, "Open in Study Desk" (chapters and introductions; E50, rule 10
  in `src/scripts/desk/CLAUDE.md`). Both use the `.reading-view-pill` look and
  the `rvp-full`/`rvp-short` labels, so every width rule above covers both.
- **Chapter navigation is prefetched, never prerendered.** `ScriptureLayout`
  carries speculation rules that prefetch the Previous/Next buttons' and the
  bottom chapter links' targets at `moderate` eagerness. Don't upgrade it to
  prerender: a prerendered page runs its scripts, so it would count a pageview
  toward the app popover's `lit_pv` gate (`src/components/CLAUDE.md`, "One announcement popover at a time"), could
  open the popover in a page nobody has seen yet, and may log an analytics visit
  for a chapter nobody opened. None of those scripts check
  `document.prerendering`.
- **A page with its own search box can still give the header a search
  button** (Site 2.0; BVJ, 2026-11-17: "The header can have a search button
  so that a non-article-defaulted option is available"). `SearchBar` can be
  on a page once (its ids are fixed), so a `pageSearch` page has no header
  strip. Such a page passes `headerSearchLink` to `Layout`, and `SiteHeader`
  (`searchLink`) draws the same icon as a plain link to `/search`, in the
  nav tools, the phone's actions, and the menu. It carries `data-v2`, so it
  shows only with the restyle's stamp, and no `data-search-toggle`, so
  `header-search.js` leaves it alone. The articles index and the article
  page pass it.
- **Site 2.0 adds to two layouts, and both additions are inert without the
  restyle's stamp** (`SITE-2.0.md`). `ScriptureLayout` imports
  `v2/scripture.css` and a bundled `v2-scripture.js`: the scripture sheet is
  a painted layer (`.scripture-main::before`), so no markup changed, and on
  a phone the toolbar hides on a scroll down and returns on any scroll up
  (BVJ, 2026-11-17), by a `data-v2-bar` attribute the module sets on
  `.scripture-tools`. That module may be bundled where the `data-compact`
  script above may not: it changes nothing before the first scroll.
  `SearchLayout` has a `v2Pane` slot between the toolbar and the results,
  which /search fills with its left pane (`data-v2`).
