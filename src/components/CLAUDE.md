# Components

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory.
> Cross-references such as "below" or "rule 15" were written when all of
> this was one file, so they may point into another area file; the root's
> index says which file holds each section.

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
     open to read terms rather than to be pitched to (`SUPPRESSED_PATHS`);
  4. **never over scripture**: a Study View chapter or intro, or Read View
     (owner, 2026-09-28). A reader who chose a passage came to read it. An
     announcement can opt out with `{ overScripture: true }`.
  What belongs to one announcement stays in its component, passed to the gate
  as `skip` or kept in its own markup, so the slot never learns about apps.
  The app announcement adds two such rules (owner, 2026-09-28). It shares one
  dismissal with the Android banner (`AppInstallBanner.astro`): each reads the
  other's flag, the cookie one way and `lit_app_banner_dismissed` the other,
  so closing either retires both without storing anything new. And on a
  computer it shows a QR code to `/apps` (`public/images/apps-qr.svg`, from
  `npm run build:apps-qr`), hidden on a phone or tablet by the same OS check
  (`isAppPlatform`) and lazy-loaded so a closed dialog never fetches it. It
  does show on phones: the owner declined a "not on phones" rule.
