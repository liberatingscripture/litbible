# Components

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory.

## The header, the line under it, and the footer

Featherboa's Phase 3, part one (`SITE-FEATHERBOA.md`, "Four places: the
header" and "The phone and the footer"). The phone's two bars and its menu
sheet are part two; until they are built, a window narrower than the full
header keeps today's row (the brand, the magnifier, Aa, the menu button)
over the menu overlay (`global.css`), fed by the same places.

- **One list of places, `src/lib/places.mjs`** (pure; `test/places.test.js`):
  Read, Study, Learn, and About with their rows, and `placeOf(path)`, which
  says which place a page is in, which row it is, its name, and whether it
  gets the line under the header. The header, the line, the footer, and the
  menu overlay all draw from it, so a page's name or a row's address changes
  there and nowhere else. **A new page needs an answer there**: a row in a
  place's menu, a page inside a row (`INSIDE`, as an article is inside
  Articles), or a page in no place (`NO_PLACE`, with its name).
  `test/places.test.js` fails on a page under `src/pages/` with none. Read
  is a link to /read, not a menu (HD-02), until Phase 4's book picker; Study's
  "Help for study tools" sits below a line until Phase 9 moves help.
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
  (`src/scripts/desk/account/CLAUDE.md`, rule 17).
- **The magnifier has three modes**, which `Layout.astro` picks (HD-13):
  `"strip"` opens the search strip under the header (`header-search.js`);
  `"page"`, on a page passing `pageSearch`, takes the reader to the page's
  own box, since `SearchBar` renders once a page; `"none"` on the Read page
  (a chapter, an introduction, Read View), whose search is its toolbar's, and
  in Study's own header. Without JavaScript it is a link to /search.
- **Without JavaScript**, Aa and the menu button go (a `<noscript>` style),
  and below the full header's width a row of two links stands in: Read, and
  Menu, which goes to the footer's links (`#footer-nav`).
- **The line under the header** (`PlaceLine.astro`; HD-14, HD-22) is on
  every page but Home, the Read page, and Study's own pages. It names the
  place and the page ("Learn / Glossary"), or the page alone for a page in
  no place, the place a link up when the page is inside a row ("Learn /
  Articles" over an article). Its right end takes one or two of the page's
  main commands through Layout's `place-line` slot (none does yet); nothing
  else goes at its left. A page keeps its own heading. It never prints, and
  the menu overlay makes it inert while open.
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
  About has no "What's new" row (NX-29). The menu overlay shows no marks
  until part two.
- **The footer** (`SiteFooter.astro`, `footer.css`; HD-36, BS-24): the same
  four places as groups under their names (Study as in the header), then
  Privacy, the Terms of Use, and the brand marks, with the newsletter beside
  them from 1100px and under them below that. All of it works without
  JavaScript. The newsletter's own rules and the license band under the
  footer stay in `global.css`.
- **Home lies on LIT Green until Phase 7**, so `header.css` pins the ink on
  the places and the tools there, not on the row: the menus are floats of
  their own and keep the theme's colors and ring.

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
