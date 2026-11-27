# Layouts

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory.

- **On a phone, Chapter View's toolbar is one row** (audit F3, owner
  2026-09-28). Featherboa replaces the computer's toolbar with the place
  line (`SITE-FEATHERBOA.md`, "The reading page" and "Finding a passage")
  and the phone's with one row at the top and a bar of four at the thumb,
  the round ‹ › there included ("The phone"); until it is built, this
  holds. At 640px and below the passage picker, a search button and an
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
  `document.prerendering`. Featherboa loads the next and previous chapters
  into the page itself as the reader nears them (`SITE-FEATHERBOA.md`, "A
  whole book"); until it is built, this holds.
