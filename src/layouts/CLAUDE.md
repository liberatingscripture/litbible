# Layouts

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory.

- **A chapter or an introduction has the place line, not a toolbar**
  (Featherboa's Phase 4; `SITE-FEATHERBOA.md`, "The reading page" and
  "Finding a passage"; RP-29 to RP-32, FP-27, FP-28). `ScriptureLayout`
  passes Layout a `readingLine` (`{ book, chapter, studyHref }`, chapter
  `"intro"` on an introduction), and Layout draws `PlaceLine.astro`'s
  reading half under the header, drafts included: "John ▾ / Chapter 3 ▾"
  (each part opens the passage picker, the book at the books and the
  chapter at its grid; links to /read without JS), then Search, ‹ ›, the
  Notebook, and "Study John 3". **Search** opens the page's one `SearchBar`
  ("Search the LIT, or go to a passage") in place of the line
  (`place-line.js`; a link to /search without JS), and `/` presses it.
  **‹ ›** are plain icons named for where they go ("Previous: John 2", from
  `navFor`, which steps over drafts), disabled at the ends; the big
  buttons at the foot stay. **The Notebook and "Study John 3"** (a link to
  `/desk/?place=john-3`; "Study John" at chapter 1 on an introduction,
  `deskPlaceHref`) show only from 1100px under `html[data-desk]`
  (`header.css`), the Notebook only beside a reading column (`global.css`),
  so a tablet's line is the picker, Search, and the arrows. The line isn't
  sticky, so the reading line of Continue reading (`last-read.js`) needs
  nothing for it. The toolbar, its "Go to passage" (ReadMenu), "Switch to
  Read View," and the title's round ‹ › are gone, and Read View retired in
  Phase 4.
- **On a chapter's page the line follows the chapter being read**, since the
  page reads on into the chapters around it (`src/scripts/read-on.js`;
  `src/scripts/CLAUDE.md`, "Reading on through a book"). "Chapter 4 ▾,"
  the arrows (from the `nav` map `[slug].astro` writes into
  `#read-on-data`, the one rule's Previous and Next for every chapter of
  the book), "Study John 4," the phone row's name and arrows, and the
  title change with it; the address changes by `replaceState`, so Back
  leaves the book. **The progress line** is the line's bottom edge in
  place of its border, or the phone row's (`header.css`, from
  `--read-progress` on `<html>`, the verses before the reading line over
  the book's: `bookProgress`, `src/lib/read-on.mjs`), a pseudo-element
  scaled along the edge, so it adds no height and nothing a screen reader
  meets (WB-33 to WB-36, PH-08). The row hides with `html[data-bars]`, and the line
  with it.
- **On a phone the two bars do the line's work** (Featherboa's Phase 3;
  `SITE-FEATHERBOA.md`, "The phone"; PH-01 to PH-10, PH-26). Under 700px the
  line isn't drawn: `ScriptureLayout` passes Layout a `picker` ("John 3",
  "John · Intro"), which turns SiteHeader's row into the reading row (the
  emblem, named "Home"; the chapter's name, which opens the passage
  picker's sheet at the chapter; Aa), sticky under the app banner, and
  draws `PhoneBar.astro` at the thumb: Previous, Search, Menu, Next. The
  title is drawn for no one on screen while staying the page's h1
  (`ScriptureHeader.astro`, screen only: a printed page is narrower than
  700px too). The bar's Search moves the line's `SearchBar` into the row
  while it is open, so the page still has one; Menu opens the menu sheet
  (`src/components/CLAUDE.md`). Both bars hide together on a scroll down
  past the row's place and come back on any scroll up
  (`src/lib/phone-bars.mjs` is the rule, `phone-bars.js` writes
  `html[data-bars]`), never while the picker, search, the tray, or the
  menu is open. Without JS the row never leaves, the name goes to /read,
  Search to /search, and Menu to the footer's links. Layout's critical CSS
  holds the row's 52px from the first paint.
- **Chapter navigation is prefetched, never prerendered.** `ScriptureLayout`
  carries speculation rules that prefetch the place line's ‹ ›, the phone
  bar's Previous and Next, and the bottom chapter links' targets
  (`.place-line a[rel]`, `.phone-bar a[rel]`, `.chapter-ctas a.chapter-cta`)
  at `moderate` eagerness. Don't upgrade it to
  prerender: a prerendered page runs its scripts, so it would count a pageview
  toward the app popover's `lit_pv` gate (`src/components/CLAUDE.md`, "One announcement popover at a time"), could
  open the popover in a page nobody has seen yet, and may log an analytics visit
  for a chapter nobody opened. None of those scripts check
  `document.prerendering`. With JavaScript a chapter's page loads the
  chapters around it into itself (read-on.js: `fetch` and `DOMParser`, so
  a loaded chapter runs none of its page's scripts and counts no `lit_pv`),
  fetching the next published chapter's page once at the start, and it
  answers the arrows itself; the rules stay for readers without it and for
  the way on into the next book.
