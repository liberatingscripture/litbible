# Components

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory.
> Cross-references such as "below" or "rule 15" were written when all of
> this was one file, so they may point into another area file; the root's
> index says which file holds each section.

- **The header's title is chosen before first paint; keep its script
  inline** (E138; BVJ, 2026-11-17). `SiteHeader.astro` shows "The Liberation &
  Inclusion Translation" where it fits and "LIT Bible" where it doesn't (never
  an ellipsis on a computer; always the short one in OpenDyslexic). The
  choice needs a measurement, made by an `is:inline` script right after
  `.site-header__inner`, so the first paint already has the right title.
  It was a bundled script that waited for idle time, to keep its forced
  layout off the load, and every page whose window was too narrow painted
  the long title and then swapped it: every phone, a computer from about
  1100 to 1440px, every OpenDyslexic window. **Don't move it back to a
  bundled or deferred script.** It depends on three things staying true:
  stylesheets in `<head>`, `data-font` and `data-desk` stamped there, and
  `scrollbar-gutter: stable` on `<html>` (the row has its final width
  before the page can scroll).
  **When it measures matters as much as where it sits: never while the
  page is parsing.** A font is fetched when a layout first needs it, cached
  or not, and can be drawn a few milliseconds later; until then the row is
  in its fallbacks, which are wider (the long title by 56px, the nav by up
  to 31px). A measurement made at once therefore picks the short title
  across some 90px of widths above each threshold, and the layout it
  forces makes Chrome paint sooner (about 56 ms in, where the page
  otherwise paints at about 110), into just that gap: a version that
  measured at once and again as each font settled painted the wrong title
  for some 50 ms in about one new-tab load in eleven there. So the script
  asks for every font the row is drawn in (`document.fonts.load`) and
  measures when all have settled, which for cached fonts is before first
  paint. The first animation frame measures if they haven't by then, so a
  font still on the network gets the fallback's own answer, and the title
  changes when the letters do. Don't add a measurement at parse time,
  don't wait on `fonts.ready` (settled already while a page parses with
  nothing loading), and don't skip a face `fonts.check()` calls loaded (a
  cached face reads so as soon as a layout has asked for it, before it can
  be drawn).
  `test/header-title.test.js` holds the script's place and runs its text.
  Check a change in headless Chrome by which title's text was painted
  (Element Timing on `.title-prefix` and `.title-alt`), in new tabs and
  same-tab navigations both, sweeping the widths across each threshold: the
  Browser pane can't show a first paint, frames run before it that are
  never shown, a sampler reading in an animation-frame callback runs ahead
  of the script's own and sees a title that frame never paints, and a
  handful of fixed widths misses the bands where the fallback and the font
  disagree. Read View's whole book is the heaviest page to try.
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
     open to read terms rather than to be pitched to, nor on `/notebook` or
     `/desk/help`, opened mid-task (E73; `SUPPRESSED_PATHS`);
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
