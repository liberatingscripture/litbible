# Components

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory.

## The header, the line under it, and the footer

Featherboa's Phases 3 and 4 (`SITE-FEATHERBOA.md`, "Four places: the
header," "The phone and the footer," "The phone," "The menu," and "Finding
a passage"). Narrower than the full header the row is the brand, the
magnifier, Aa, and "Menu," which opens the menu sheet; a chapter or an
introduction on a phone has the phone's two bars instead
(`src/layouts/CLAUDE.md`).

- **One list of places, `src/lib/places.mjs`** (pure; `test/places.test.js`):
  Read, Study, Learn, and About with their rows, and `placeOf(path)`, which
  says which place a page is in, which row it is, its name, and whether it
  gets the line under the header. The header, the line, the footer, and the
  menu sheet all draw from it, so a page's name or a row's address changes
  there and nowhere else. **A new page needs an answer there**: a row in a
  place's menu, a page inside a row (`INSIDE`, as an article is inside
  Articles), or a page in no place (`NO_PLACE`, with its name).
  `test/places.test.js` fails on a page under `src/pages/` with none. Read
  is not a menu (HD-02): it opens the passage picker (below), and is a link
  to /read without JavaScript; Study's "Help for study tools" sits below a
  line until Phase 9 moves help.
- **The header** (`SiteHeader.astro`, `header.css`): "LIT Bible" always
  (HD-10; a visually hidden tail names the translation in full, and every
  `<title>` keeps the full name, HD-11). The places are the kit's tabs; the
  one the page is in carries `aria-current` and the tab's underline in LIT
  Green (`--color-mark`). Learn, Study, and About are `<details>` sharing one
  `name`, so they open, and their links work, without JavaScript;
  `header-menus.js` adds the keys (Arrow Down or Up on a place opens its
  menu at the first or last row, then the arrows, Home, End, and Escape back
  to the place), one menu open at a time, and closing on a press elsewhere
  or Tab out. **Study shows only with `html[data-desk]` from 1100px**
  (ST-16), in the footer too, so a tablet or a narrow window has Read,
  Learn, and About. The full header holds from 700px, from 900px in
  OpenDyslexic (an estimate from the places' widths, not yet measured). Its
  right end is the magnifier, Aa, and the account's entry
  (`src/scripts/desk/account/CLAUDE.md`, rule 17). Narrower, "Menu" (the
  kit's plain button, its icon and its word; the word alone under 400px,
  430px in OpenDyslexic, measured)
  takes the places' room.
- **A phone's reading row** (PH-01, PH-05 to PH-09): a page that passes
  Layout a `picker` (a chapter or an introduction, `ScriptureLayout`) gets
  `site-header--reading`, which under 700px is the emblem alone (named
  "Home"), the chapter's name centered as the picker, and Aa, sticky at the
  window's top below the app banner (`AppInstallBanner.astro`, which scrolls
  away), with `PhoneBar.astro` at the thumb (Previous, Search, Menu, Next).
  Without JavaScript the picker is a link to /read; with it, it opens the
  passage picker's sheet at the chapter (PH-10, below). The row's
  `site-header__find` is where the bar's Search puts the page's search
  field (`phone-bars.js`). The header's own "Menu" isn't drawn there: the
  bar's is.
- **The menu sheet** (`MenuSheet.astro`, drawn by SiteHeader after the
  header; `header-menus.js`; PH-11 to PH-15, HD-35): one sheet rising from
  the window's foot for every "Menu" button (the header's, narrower than the
  full header and in Study's own header at every width, and the phone
  bar's), no wider than the text column. A modal `<dialog>` titled "Menu"
  with its ×: the page behind dims and goes inert, focus moves to the × and
  stays inside, and Escape, a tap on the dimmed page, the ×, or one of its
  links closes it and gives focus back to the button that opened it. Its
  groups are the places, Read and Learn down the left and About down the
  right (Study a third column only where the header shows it), the place
  the page is in underlined in LIT Green and the page's row on; then Search
  (under 360px, 380px in OpenDyslexic, on a page whose magnifier opens the
  strip), Account (under
  700px with accounts open; not in Study's header, which has the entry), and
  "Get the app" (NX-11). Continue reading isn't there: it is the passage
  picker's first row (PH-14). Without a modal dialog or JavaScript it never opens,
  and the bar's Menu stays a link to the footer's links.
- **The magnifier has three modes**, which `Layout.astro` picks (HD-13):
  `"strip"` opens the search strip under the header (`header-search.js`);
  `"page"`, on a page passing `pageSearch`, takes the reader to the page's
  own box, since `SearchBar` renders once a page; `"none"` on the Read page
  (a chapter or an introduction, whose search is the place line's Search)
  and in Study's own header. Without
  JavaScript it is a link to /search.
- **Without JavaScript**, Aa and the menu button go (a `<noscript>` style),
  and below the full header's width a row of two links stands in: Read, and
  Menu, which goes to the footer's links (`#footer-nav`). A phone's reading
  row doesn't draw them: its picker and the bar's four links do that work.
- **The line under the header** (`PlaceLine.astro`; HD-14, HD-22) is on
  every page but Home and Study's own pages. On a chapter or an
  introduction it is the place line (`readingLine`; `src/layouts/CLAUDE.md`).
  On /glossary it is `GlossaryLine.astro` ("Learn / Glossary ▾ / trust": a
  native `<details>` list of the entries with the order switch, the entry in
  view, and ‹ ›; `src/scripts/glossary-line.js`), sticky under the header.
  Elsewhere it names the place and the page ("Learn / Glossary"), or the page alone for a page in
  no place, the place a link up when the page is inside a row ("Learn /
  Articles" over an article). Its right end takes one or two of the page's
  main commands through Layout's `place-line` slot (none does yet); nothing
  else goes at its left. A page keeps its own heading. It never prints, and
  the menu sheet, a modal dialog, makes it inert while open.
- **News marks** (`src/lib/news.mjs`; NX-26, NX-27, NX-29, HD-31): a list,
  empty until there is news, of `{ id, place, row, until }`. SiteHeader draws
  a dot on the place, "New" beside the row, and "See what’s new →" at the
  menu's foot, hidden, for each entry; `header-menus.js` shows what this
  browser hasn't seen, and opening the menu sees it (the dot goes at once,
  the rest when the menu closes), kept in `localStorage['lit-news-seen']`.
  **An empty list draws nothing and reads no storage.** Before the first
  entry the What's New page must exist and `/privacy` must name the key:
  `test/news.test.js` fails otherwise, and `test/desk-storage-keys.test.js`
  allows the key until then. Read has no menu, so news never marks it, and
  About has no "What's new" row (NX-29). The menu sheet draws the same
  marks on its groups and rows, and each "Menu" button a dot while a place
  the sheet shows has unseen news; opening the sheet sees what it shows
  (Study only where the header shows it): the buttons' dots go at once, the
  sheet's own marks when it closes.
- **The footer** (`SiteFooter.astro`, `footer.css`; HD-36, BS-24): the same
  four places as groups under their names (Study as in the header), then
  Privacy, the Terms of Use, and the brand marks, with the newsletter beside
  them from 1100px and under them below that. All of it works without
  JavaScript. The newsletter's own rules and the license band under the
  footer stay in `global.css`.
- **Home lies on LIT Green until Phase 7**, so `header.css` pins the ink on
  the places and the tools there, not on the row: the menus are floats of
  their own and keep the theme's colors and ring.

## The passage picker

Featherboa's Phase 4 (`SITE-FEATHERBOA.md`, "Finding a passage"; FP-01 to
FP-16; `test/featherboa-picker.test.js`). **One component,
`PassagePicker.astro`, and one script, `src/scripts/passage-picker.js`, in
three places**: /read, where it is the page (`full`); a panel hanging from
what opened it, from 700px, at Quick speed; and a sheet rising nearly to the
top under 700px, at Large speed (`picker.css`). The panel and the sheet are
one modal `<dialog>` that `Layout.astro` draws, closed, on every page but
/read (`pickerInPage`) and Study's own, so G works anywhere. **Its picker
waits in a `<template>`** that the first opening puts in place, so a page
that never opens it carries none of its thousand-odd elements, only about
58 KB of markup (under 4 KB gzipped); Layout loads the script, since inside
the template it would never run. Its ways in are links marked
`data-picker-open` ("books" or "chapters": where it opens and what takes
focus), which go to /read without JavaScript: the header's Read, the place
line's book and chapter, and the phone row's name. G sends
`lit:picker-open` (`keyboard-shortcuts.js`), which the dialog answers, or on
/read the field.

- **Top to bottom**: the field ("book, chapter, or verse"), where typing
  wins over picking: `readTyping` (`src/lib/passage-picker.mjs`) reads it as
  the search box does (`parseReferenceJump`), then by the 404 page's
  guesser, so "rom 8" offers "Go to Romans 8" at once and Enter goes there,
  and anything else offers "Search for ‘…’." Then Continue reading from
  `lit_last_read` (hidden when it names the page being read), the 27 books
  as tabs, the chosen book's chapters as a grid with its introduction under
  it, and Release Notes last.
- **A draft is dimmed, still opens, and says "in progress"**:
  `kit-tab--draft` and `kit-row--draft` (`kit.css`) take the third ink, never
  `opacity`; the words show beside a book or an introduction, and a
  chapter's number says them to a screen reader, under the book's note.
- **Keys and focus**: focus stays inside while it is open, Escape empties
  the field and then closes, a press outside, its ×, or a chosen link (a
  frame later) closes it, and focus goes back to what opened it. The books
  are tabs (the arrows, Home, End, Space); the chapters are one stop with the
  arrows inside.
- **Without JavaScript** /read's books link to `#picker-<book>` on the page,
  shown by `:target` (Matthew's when the address names none), and the
  field is a search form for /search.

On a chapter's page that has read on, the picker follows the chapter being
read: read-on.js moves the root's `data-chapter` and the grid's
`aria-current` (in the live picker and its template), and Continue reading's
row is left out while it names that chapter (`refreshContinue` reads the
root's chapter as it is now). ReadMenu, Read View's own panel, retired with it.

## The announcement popover

Featherboa keeps it **for launches only** (the apps, the Study Desk's
opening, the What's New page; BVJ names each), under the rules below;
ordinary news is marked on the header menu it belongs to ("News marks,"
above; `SITE-FEATHERBOA.md`, "Nothing interrupts the reader"). Until
Featherboa is built, this section holds as written.

- **One announcement popover at a time.** `Layout.astro` renders exactly ONE
  popover component (currently `AppsLaunchPopover.astro`, the iOS/Android
  launch). Retiring an announcement means swapping that import and leaving the
  old component in the repo **unimported**, not deleting it
  (`WelcomePopover.astro` is the retired Collective announcement) — so a past
  one can be brought back by swapping the import back. Two rules for any
  replacement: (1) give it a **fresh cookie name**, or everyone who dismissed
  the previous announcement never sees the new one; (2) gate it with
  **`shouldAnnounce`** from `src/scripts/announcement-gate.js`, which holds the
  rules every announcement shares, whatever it is about:
  1. never on a session's first pageview (the `lit_pv` sessionStorage
     counter), which with the next rule exists to avoid Google's
     intrusive-interstitial penalty on search-landing pages (FIXLIST O3, an
     owner decision);
  2. never on a link shared into scripture (`#v16`, a range `#v16-17`, a part
     anchor `#john-8-p9`, a Read View verse `#john-3-v16`);
  3. never on `/apps`, its own CTA destination, or `/privacy`, which people
     open to read terms rather than to be pitched to, nor on `/notebook`,
     `/desk/help`, or the account pages (`/account`, `/account/connect`,
     `/delete-account`), opened mid-task (E73; `SUPPRESSED_PATHS`);
  4. **never over scripture**: a Chapter View chapter or intro, or Read View
     (owner, 2026-09-28). A reader who chose a passage came to read it. An
     announcement can opt out with `{ overScripture: true }`.
  What belongs to one announcement stays in its component, passed to the gate
  as `skip` or kept in its own markup, so the slot never learns about apps.
  The app announcement adds one such rule (owner, 2026-09-28). Its dismissal
  (the 365-day `lit_apps_launch_v1` cookie) is separate from the Android
  banner's (`AppInstallBanner.astro`, a 90-day timestamp in
  `lit_app_banner_dismissed`); closing either leaves the other alone. On a
  computer it shows a QR code to `/apps` (`public/images/apps-qr.svg`, from
  `npm run build:apps-qr`), hidden on a phone or tablet by the same device
  check (`isAppPlatform`) and lazy-loaded so a closed dialog never fetches it. It
  does show on phones: the owner declined a "not on phones" rule.
