# Layouts

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory.
> Cross-references such as "below" or "rule 15" were written when all of
> this was one file, so they may point into another area file; the root's
> index says which file holds each section.

- **On a phone, Study View's toolbar is one row** (audit F3, owner
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
- **Chapter navigation is prefetched, never prerendered.** `ScriptureLayout`
  carries speculation rules that prefetch the Previous/Next buttons' and the
  bottom chapter links' targets at `moderate` eagerness. Don't upgrade it to
  prerender: a prerendered page runs its scripts, so it would count a pageview
  toward the app popover's `lit_pv` gate (see the popover rule below), could
  open the popover in a page nobody has seen yet, and may log an analytics visit
  for a chapter nobody opened. None of those scripts check
  `document.prerendering`.
