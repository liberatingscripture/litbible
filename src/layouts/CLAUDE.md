# Layouts

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory.

- **On a phone, a chapter or an introduction has two bars, not the
  toolbar** (Featherboa's Phase 3; `SITE-FEATHERBOA.md`, "The phone"; PH-01 to
  PH-09, PH-26). Under 700px, drafts included: `ScriptureLayout` passes
  Layout a `picker` ("John 3", "John · Intro"), which turns SiteHeader's row
  into the reading row (the emblem, named "Home"; the chapter's name as the
  picker, which opens the toolbar's passage picker; Aa), sticky under the
  app banner, and draws `PhoneBar.astro` at the thumb: Previous, Search,
  Menu, Next. The toolbar (`scripture-tools.css`) and the title's round
  ‹ › go, and the title is drawn for no one on screen while staying the
  page's h1 (`ScriptureHeader.astro`, screen only: a printed page is
  narrower than 700px too). The bar's Search moves the toolbar's
  `SearchBar` into the row while it is open, so the page still has one;
  Menu opens the menu sheet (`src/components/CLAUDE.md`). Both bars hide
  together on a scroll down past the row's place and come back on any
  scroll up (`src/lib/phone-bars.mjs` is the rule, `phone-bars.js` writes
  `html[data-bars]`). Without JS the row never leaves, Search goes to
  /search and Menu to the footer's links. Layout's critical CSS holds the
  row's 52px from the first paint. Read View and /search keep their
  toolbars at every width. The toolbar's "Switch to Read View" goes with it
  on a phone, so Read View is reached from /read there until Phase 4 makes
  the two views one reading page ("A whole book").
  From 700px the toolbar holds as before. Featherboa replaces it with the
  place line (`SITE-FEATHERBOA.md`, "The reading page" and "Finding a
  passage"); until it is built, this holds. The top Previous/Next are round
  ‹ › buttons beside the title (owner, 2026-10-14), on the text column's
  own edges, and keep their names ("Previous: Romans 7"); the big buttons
  at the foot stay at every width. From 700 to 900px the toolbar is one row
  with a short "Read View" label.
  The toolbar's right slot holds two pills in `.reading-view-right` wrappers,
  one at a time: "Switch to Read View" (chapters only) and, with the Study Desk
  preview on, "Open in Study Desk" (chapters and introductions; E50, rule 10
  in `src/scripts/desk/CLAUDE.md`). Both use the `.reading-view-pill` look and
  the `rvp-full`/`rvp-short` labels, so every width rule above covers both.
- **Chapter navigation is prefetched, never prerendered.** `ScriptureLayout`
  carries speculation rules that prefetch the Previous/Next buttons' (the
  title's and the phone bar's) and the bottom chapter links' targets at
  `moderate` eagerness. Don't upgrade it to
  prerender: a prerendered page runs its scripts, so it would count a pageview
  toward the app popover's `lit_pv` gate (`src/components/CLAUDE.md`, "One announcement popover at a time"), could
  open the popover in a page nobody has seen yet, and may log an analytics visit
  for a chapter nobody opened. None of those scripts check
  `document.prerendering`. Featherboa loads the next and previous chapters
  into the page itself as the reader nears them (`SITE-FEATHERBOA.md`, "A
  whole book"); until it is built, this holds.
