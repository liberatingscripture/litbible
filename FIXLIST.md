# Site Audit Fix List

From the comprehensive audit of 2026-07-07 (developer, QA, SEO, end-user, editor,
marketing, accessibility, HR/governance, and security passes). The seven
**Priority** fixes are done (commit `9e3a875`). A second comprehensive audit ran
**2026-07-16** (same hats plus legal, performance, and disability passes;
findings verified against the live site where relevant) — its additions sit in a
dated subsection at the end of each model's list. Remaining items are grouped by
which model should run them:

- **Sonnet** — mechanical, fully specified edits; run as ONE batch session.
- **Opus** — well-scoped implementation work; run one session per item.
- **Fable** — judgment, security, design, or brand voice; owner in the loop.
- **Owner** — decisions or dashboard access no model has.

Every item below is written to stand alone — a fresh session should be able to
execute from the item text without this conversation. After any code item:
`npm run build` must pass, and changed pages should be spot-checked in
`npm run dev`. This is a living checklist: when an item lands, mark it `[x]`
and add a short DONE note (see the Priority section for the pattern) — don't
delete it.

## Priority

- [x] **P1 — Fix `isOpen` ReferenceError in the Read-page tooltip script.**
  DONE: the window `resize` handler in `src/layouts/ReadLayout.astro` now
  checks `btn.dataset.tipOpen === "true"` instead of the undefined `isOpen`.

- [x] **P2 — Link the privacy policy (and decide `/courses`).**
  DONE (privacy): Privacy link added to the footer "Connect" column
  (`SiteFooter.astro`). The `/courses` decision is tracked under **Owner**.

- [x] **P3 — Bring the privacy policy in line with actual data flows.**
  DONE: `privacy.astro` now discloses the Formspree-processed contact form,
  Cloudflare Turnstile, and the `lit_welcome_v2` cookie + localStorage
  preferences; effective date bumped to 2026-07-07. Owner confirmed neither
  app is live yet, so the scope/lede frame the "(app)" sections as describing
  the in-development iOS/Android apps, effective at launch.

- [x] **P4 — Fix brand-green contrast for text.**
  DONE: added `--green-text: #0F6B33` (≈ 4.9:1 on cream, ≈ 6.7:1 on white;
  dark mode keeps `#3abf6a`) and switched green-as-text usages to it across
  the stylesheets and scripture pages; `--link` now points at `--green-text`;
  16px chapter CTA / back-to-top backgrounds darkened. Follow-on button sweep
  is an **Opus** item below.

- [x] **P5 — Make the scripture-menu tooltip screen-reader accessible.**
  DONE: tooltip content is referenced by the button via `aria-describedby`.

- [x] **P6 — Keyboard access for the verse copy/share menu.**
  DONE (`chapter-tools.js`): verse numbers are keyboard-operable buttons;
  Tab cycles inside panels; keyboard-opened menus restore focus on close.

- [x] **P7 — Add a CI workflow.**
  DONE: `.github/workflows/ci.yml` validates chapters and runs the full build
  on push/PR. Tests and link checking are **Opus** items below.

## Sonnet — one batch session

> Prompt shape: "Work through the Sonnet checklist in FIXLIST.md top to
> bottom. Make exactly the changes described; don't expand scope. Run
> `npm run build` at the end."

- [x] **Fix the /read lede grammar.**
  DONE: `src/pages/read.astro` hero paragraph now reads "ready for you to
  study, scrutinize, celebrate, and use in your faith circles."

- [x] **"FAQ’s" → "FAQs".**
  DONE: the table-of-contents link text in `src/pages/about.astro` now reads
  `FAQs`.

- [x] **Normalize apostrophes/quotes in about.astro.**
  DONE: all straight apostrophes and double quotes in visible prose across
  `src/pages/about.astro` (45+ instances) were converted to curly (’ “ ”).
  HTML attributes, the JSON-LD block, and the inline `<script>` were left
  untouched, as required.

- [x] **`http://` → `https://` on the CC license link.**
  DONE: the license link in `src/pages/read.astro` now uses `https://`,
  query string unchanged.

- [x] **Canonical trailing-slash consistency.**
  DONE: added the trailing slash to `src/pages/privacy.astro`'s `canonical`
  and its JSON-LD `WebPage` `url` field, and to
  `src/pages/translation-commitments.astro`'s `canonical`. Left the JSON-LD
  `isPartOf.url` in privacy.astro alone — it's the site root
  (`https://litbible.net`), not this page's URL, so it doesn't carry a page
  path to normalize.

- [x] **Stop hardcoding og:image dimensions.**
  DONE (with F3, which needed it): `Layout.astro` emits
  `og:image:width`/`height` only when `ogImage` was NOT provided (default
  logo); pages passing their own image omit the dimensions. Layout also
  gained a `twitterCard` prop (default `"summary"`, unchanged for existing
  pages).

- [x] **Remove target="_blank" from internal article links.**
  DONE: across 13 files in `src/content/articles/*.md`, removed
  ` target="_blank" rel="noopener noreferrer"` from every anchor whose
  `href` was root-relative (chapters, `/found-in-translation-podcast`,
  `/articles/...`). Genuinely external links (doi.org, threads.net,
  pbpayne.com, amazon.com, christianpost.com, margmowczko.com, a Google
  search link) were left untouched.

- [x] **Normalize the npm build script.**
  DONE, with one deliberate deviation from the item's literal example
  string: `package.json`'s `build` script now calls the npm aliases
  consistently (`build:verses`, `build:manifest`, `build:api`, `build:og`)
  instead of mixing in direct `node scripts/...` calls. The example string in
  this item omitted `npm run build:og` — that step didn't exist yet when this
  item was written; it landed with F3. Dropping it would have broken the
  per-chapter share-card generation, so it was kept in its documented
  position (after `build:api`, before `astro build`) per CLAUDE.md's Build
  Pipeline section, which this item explicitly points to as the source of
  truth for ordering.

- [x] **Comment the glossary Pagefind subtlety.**
  DONE: added a comment in `src/pages/glossary.astro` directly above the
  `data-pagefind-body` section explaining the Layout/`data-pagefind-ignore`
  interaction. No behavior change.

- [x] **Stronger contact-form honeypot.**
  DONE: in both `src/pages/contact.astro` and `src/pages/app-support.astro`,
  the `_gotcha` honeypot is now `type="text"` with `tabindex="-1"`,
  `autocomplete="off"`, `aria-hidden="true"`, and `class="contact-honeypot"`.
  Added one `.contact-honeypot { position:absolute; left:-9999px; }` rule to
  `src/styles/pages/contact.css`, which both pages import. The JS submit
  handlers (which already check the field's value) were not touched.

- [x] **Governance boilerplate.**
  DONE: created `CONTRIBUTING.md`, `SECURITY.md`, and `CODE_OF_CONDUCT.md`
  (Contributor Covenant v2.1) at the repo root as owner-review drafts, in the
  site's warm, direct voice. `LICENSE` was intentionally NOT created — still
  gated on the Owner license decision below.

### Added from the 2026-07-16 audit

- [ ] **Add an `engines` field to package.json.**
  `"engines": { "node": ">=22.12" }` (Astro 6's requirement, already documented
  in README). Makes a too-old Node fail fast at install instead of erroring
  mid-build.

- [ ] **Em-dash sweep in visible page prose.**
  Owner style rule: no em dashes in published page copy — rephrase with
  commas/periods/colons, changing as few words as possible. Locations found:
  `src/pages/about.astro` prose paragraphs (~lines 237–240, 396, 429–430);
  `src/pages/release-notes.astro` lede (~line 33); `src/pages/read.astro`
  license bullets (~193–201 — the "**Attribution** — You must…" separators can
  become colons); and the user-facing form status strings "Thanks — your
  message has been sent." in `contact.astro` (~143) and `app-support.astro`
  (~161), e.g. "Thanks! Your message has been sent." Leave code comments, page
  `title` tags, `alt` text, and JSON-LD alone.

- [ ] **Title-tag separator consistency.**
  `src/pages/unsubscribe.astro` titles itself "Unsubscribe — LIT Bible"; every
  other page uses "| Liberation and Inclusion Translation". Change it to
  "Unsubscribe | Liberation and Inclusion Translation".

- [ ] **Footer Threads link → final URL.**
  `SiteFooter.astro` links `https://threads.net/lit.bible`, which 301-hops
  three times before landing at `https://www.threads.com/@lit.bible` (verified
  live 2026-07-16). Link the final URL directly.

- [x] **Doc drift: document the test suite and link checker.**
  DONE (2026-07-16, landed alongside wiring in `npm run check`): added
  `npm test`, `npm run check:links`, and `npm run check` to CLAUDE.md's
  Common Commands and README's command table; CLAUDE.md's `.github/workflows/`
  project-structure line now says what `ci.yml` actually runs (chapter
  validation, type-check, unit tests, full build, link check) instead of the
  stale "chapter validation + full build" description.

- [ ] **Demote the article pages' sr-only index `<h1>` to a `<div>`.**
  `src/pages/articles/[...slug].astro` renders TWO h1s: the sr-only Pagefind
  index surface (~line 129) and the visible `.article__title` (~line 182) —
  screen-reader users hear the title twice. The result title is safe to change
  under (it comes from the explicit `data-pagefind-meta="title"` span at ~132,
  not the h1); add `data-pagefind-weight="7"` to the replacement div so
  title-keyword ranking weight is preserved. Verify with `npm run build` + a
  search spot-check that article hits still rank and label the same.

- [ ] **Align workflow Node versions.**
  `.github/workflows/release-notes.yml` uses Node 20; `ci.yml` uses 24. Bump
  release-notes.yml to 24.

- [ ] **Add a Dependabot config.**
  `.github/dependabot.yml`: weekly `npm` updates for `/` and
  `/workers/contact-form`, plus `github-actions`. Today advisories only
  surface when someone remembers to run `npm audit` (the 2 known low-sev
  esbuild ones are dev-server-only; see the Owner Astro 7 item).

- [ ] **Dark-scheme `theme-color` meta.**
  `Layout.astro` pins `<meta name="theme-color" content="#209D50">`, so mobile
  browser chrome stays LIT green on dark pages. Add a second meta with
  `media="(prefers-color-scheme: dark)"` and the dark page bg (`#0E0E0F`).
  Note: the Aa-tray forced theme won't update this without JS — acceptable;
  OS-level dark is the common case. Skip if the owner prefers brand green
  everywhere.

- [ ] **Add width/height to the contact-page logo.**
  The `.contact-logo` `<img>` in `contact.astro` has no intrinsic dimension
  attributes (layout-shift risk as it loads). Add `width`/`height` matching
  `public/images/lit-logo.png`'s intrinsic square dimensions (CSS already
  scales it via `width: min(260px, 60vw)`).

- [ ] **Reduced-motion guard for the homepage underline animation.**
  `index.astro`'s `[data-animate="underline"]` IntersectionObserver adds
  `.is-visible` without checking `prefers-reduced-motion` (the chat-bubble
  script right below it DOES check). Confirm `home.css` disables the
  `.callout-underline-path` draw under reduced motion; if not, add the CSS
  guard (preferred — keeps the underline visible, just not animated) or
  mirror the chat script's matchMedia early-return.

- [ ] **Contributor plumbing for the BDR workflow.**
  Add `.github/ISSUE_TEMPLATE/` (two forms: a technical bug report; a
  content/translation-feedback form that points to /contact per
  CONTRIBUTING.md), a PR template (checklist: `npm run validate:chapters` if
  chapters touched, `npm run build` passes, scope stays inside the agreed
  area), and a `CODEOWNERS` file (`* @liberatingscripture`) so every PR
  auto-requests the owner's review.

## Opus — one session per item

- [x] **(O1) Article metadata upgrade.**
  DONE (2026-07-13): `src/layouts/Layout.astro` gained an `ogType = "website"`
  prop (placed after the existing `twitterCard` prop) and its hardcoded
  `og:type` meta now reads `{ogType}` — so every non-article page still emits
  `og:type=website` and stays byte-identical in the head. `twitterCard` was
  already a Layout prop, so no change there. `src/pages/articles/[...slug].astro`
  now passes `ogType="article"` and `twitterCard={heroImage ?
  "summary_large_image" : "summary"}`, and its head slot emits (after the
  existing BreadcrumbList) an `article:published_time` meta (`data.date`
  ISO) plus a `BlogPosting` JSON-LD block — headline, description
  (`pageDescriptionRaw || undefined`), datePublished, author (`data.author ??
  "Brandon C. Vélez Johnson"`), image (when heroImage), publisher =
  Liberating Scripture Collective, url. `JSON.stringify` drops undefined keys,
  so description/image cleanly vanish when absent (all current articles do have
  a hero, so the no-hero path is code-only today). Verified against built HTML:
  an article page emits `og:type=article`, `summary_large_image`,
  `article:published_time`, and a valid all-fields `BlogPosting` (author
  fallback confirmed on an article with no `author` frontmatter); `/about`
  still shows `og:type=website` + `twitter:card=summary` with zero stray
  article tags; `npm run build` passes (347 pages + Pagefind). Orthogonal to
  F3's generated `/og/` scripture cards — those ride the untouched
  `ogImage`/`twitterCard` props, and scripture pages never set `ogType`.

- [x] **(O2) Rename the ambiguous `index` prop.**
  DONE (2026-07-13): the overloaded `index` prop is gone. `Layout.astro` now
  takes `pagefindIndex` (Pagefind body opt-in) + `robotsNoindex` (robots meta);
  `ReadLayout` + `SearchLayout` forward `pagefindIndex`; `ScriptureLayout` takes
  a positive-polarity `robotsIndex` caller prop (its internal `shouldIndex`
  computation is unchanged, just reads the renamed prop) and forwards
  `robotsNoindex={!shouldIndex}`. All callers updated: Pagefind-meaning
  `index=` → `pagefindIndex=` (`read.astro`, `search.astro`,
  `read/[book].astro`); robots-meaning `index=` → `robotsIndex=`
  (`[slug].astro`); `noindex=` → `robotsNoindex=` (`404`, `unsubscribe`,
  `app-support/thanks`, `contact/thanks`, `read/[book].astro`). The four layouts
  routed the *same* old prop name to opposite concerns (SearchLayout→Pagefind,
  ScriptureLayout→robots), which is exactly the footgun this removes; the new
  names are deliberately asymmetric to make that visible.
  **One intended behavior change (owner-approved 2026-07-13):** `/search` was
  `index,follow` (Pagefind-excluded but never robots-noindexed — an oversight,
  since SearchLayout never routed its prop to robots). It now emits
  `noindex,follow` via `SearchLayout` forwarding `robotsNoindex={isSearchPage}`
  — standard practice for on-site search pages. `/glossary` +
  `/translation-commitments` were checked and left `index,follow` (content
  pages, same as `/about`). NOTE for future: the robots prop is unrelated to
  release-notes — those key off each chapter JSON's `indexed` field
  (false→true), which separately also drives the draft-chapter robots noindex.
  Verified: `npm run build` passes; a before/after SHA manifest of all 349
  `dist/**/*.html` shows exactly ONE changed file (`dist/search/index.html`,
  robots flip) and 348 byte-identical — proof of a clean rename. Spot-checks
  pass: draft `acts-1` → `noindex,follow`, published `john-3` → `index,follow`
  (body Pagefind-ignored), `mark-intro` → `index,follow` (Pagefind-indexed),
  `/search`+`/404`+`/unsubscribe` → `noindex,follow`; `dist/pagefind/` present;
  source grep shows zero bare `index=`/`noindex=` left on any layout element.

- [x] **(O3) Rein in the welcome popover.**
  DONE (2026-07-13): gated the popover show condition in
  `src/components/WelcomePopover.astro` with two new checks, leaving all
  dismissal logic (30-day `lit_welcome_v2` cookie, X/backdrop/Escape/CTA
  handlers, requestIdleCallback deferral) untouched: (1) a session pageview
  counter in `sessionStorage` (`lit_pv`, try/catch-wrapped, falls back to
  "first pageview" when storage is unavailable) so it only shows on the
  visitor's 2nd-or-later pageview; (2) a `/^#v\d+$/` guard on `location.hash`
  so shared-verse deep links never trigger it.
  **Deliberate deviation from the acceptance text above:** the owner overrode
  "homepage first visit shows it." Google's intrusive-interstitial penalty
  targets a modal on the page a user lands on FROM SEARCH, and the homepage is
  a top search-landing page, so a homepage-first-view popover is close to the
  worst case for the very penalty this item exists to avoid. Final rule shows
  it on NO session entrance (homepage included) — only from the 2nd+ pageview,
  which is internal navigation, not a search entrance. Verified via `npm run
  build` (passes) + 5 dev-server browser scenarios: fresh `/` → no popover;
  fresh `/glossary` → no popover; fresh `/john-3#v16` → no popover; `/` then
  `/glossary` (2nd pageview) → shows once; dismiss-then-reload → stays closed
  with `lit_welcome_v2=1` set.

- [x] **(O4) Unit tests for search-core.**
  DONE (2026-07-13): added `test/search-core.test.js` — 35 tests using Node's
  built-in `node:test` + `node:assert/strict`, **no new deps**. **No refactor
  was needed**: `search-core.js` imports no browser globals at top level
  (`document` is touched only inside `glossaryTermsFromDom`, guarded by
  `typeof document === "undefined"`; `fetch` only inside the async
  `loadVerseIndex`/`loadTopicsIndex`), and `package.json` is already
  `"type": "module"`, so Node imports the module and its chain
  (`../data/books.js`, `../lib/word-stem.mjs`) directly. The scanner is fully
  injectable — a local `makeIndex(verses, vocab)` helper builds the
  `{ verses, vocab, formsByStem }` object exactly as `loadVerseIndex` does
  (grouping vocab by the REAL `stemWord`), so related-form matching is tested
  against the actual stemmer with no fetch and no disk fixtures. Coverage: all
  four required areas — reference + book-alias parsing (incl. the negatives
  "genesis 1:1"→null, "John"→null, reversed range drops `rangeEnd`); verse
  scanning (whole-word, phrase = consecutive tokens, hyphen/apostrophe
  boundary, diacritic folding "lema"↔"lemá", related-form expansion
  "liberation"→"liberate", `bookKey` scoping); `rankVerseHits` ordering
  (exact-over-related, more-runs-over-fewer, stable ties, returns a new array
  without mutating input); and `nearestVocabWord` conservatism (via
  `searchVerses().correction`: corrects "jeribulem"→"jerusalem", refuses
  quoted tokens, refuses ≤4-char tokens, refuses the distance-3 no-suffix pair
  "forgivness"/"foreigners"). `nearestVocabWord`/`findTokenRuns` aren't
  exported, so they're covered as black boxes through `searchVerses`. Also
  added a handful of adjacent-contract helper tests (`buildPfQuery` quoting
  rules, `formatReferenceLabel`, `makeStudyReferenceHref`, `highlightVerseHit`
  mark-wrapping + HTML escaping). Wired `"test"` into `package.json` and a
  `Run unit tests` step into `.github/workflows/ci.yml` (after Validate
  chapter JSON, before Build site).
  **One deviation from the item's literal example string:** the item said
  `"test": "node --test test/"`, but on Node 24 (this repo's engine) the
  bare-directory positional yields a spurious failure — the runner treats it
  as an entry module, not a search root. Used the correct current-Node syntax
  `"test": "node --test \"test/**/*.js\""` instead (same intent: scan only
  `test/`). Verified: `npm test` → 35/35 pass; the subagent's full
  `npm run build` → green (347 pages + Pagefind). Tests only; zero behavior
  change to `search-core.js`.

- [x] **(O5) Post-build link checker.**
  DONE: new `scripts/check-links.mjs` walks `dist/**/*.html`, extracts every
  internal `href` (root-relative, litbible.net-absolute, and same-page
  fragment-only), resolves each to its dist file using Astro's directory
  format (`/read` → `dist/read/index.html`, exact file for assets like
  `/rss.xml`, trailing slash tolerated), and verifies (a) the target page/file
  exists and (b) any `#fragment` matches an `id`/`name` in the resolved target
  (empty and `#top` treated as always-valid). Skips external/`mailto:`/`tel:`/
  `javascript:`/protocol-relative links; no network requests. Exits 1 with a
  report grouped by source page. Added `check:links` to `package.json` and a
  "Check internal links" step to `.github/workflows/ci.yml` after Build site.
  Verified: clean run over the real site (349 pages, 26,383 links, exit 0) —
  the flagged cross-page anchors `/read#license` and `/read#sblgnt-disclaimer`
  resolve to `dist/read/index.html` and pass; a negative test (bogus page
  target + bogus fragment injected into a built page) exits 1 naming both.

- [x] **(O6) White-on-green button contrast sweep.**
  DONE (2026-07-14, owner picked the direction from live light/dark mockups):
  white on `--green` (#209D50) is only ≈3.5:1 — passes WCAG AA only as large
  text. The item's prescribed fix ("switch background to `var(--green-text)`
  like `.chapter-cta`") **could not be followed literally**: `--green-text` is a
  *text* token that FLIPS to a light `#3abf6a` in dark mode, where white text
  drops to ≈2.4:1. Since the dark toggle (O7) shipped the same day, that made
  `.chapter-cta` (shipped white-on-`--green-text` in P4) a **live dark-mode
  bug**. Owner chose a **two-green convention** instead: a new theme-invariant
  token **`--green-deep: #0F6B33`** ("Deep Green", defined once in `:root`, NOT
  in the dark blocks) for solid buttons/CTAs — white text is 6.6:1 in BOTH
  themes — paired with `--green` (LIT Green) for surfaces. The clean rule:
  **Deep Green = every solid button; LIT Green = surfaces + non-button icon
  accents.**
  - **Fixed → Deep Green + white (6.6:1 both themes):** `.nav-button`
    (ScriptureHeader, was hardcoded `#209d50`, 16px), `.menu-overlay__cta`
    (mobile "Read Now", 17.6px), `.suggest-word`/`.search-ref__link`/`.pager-btn`
    (search.astro, 14–16px), `.not-found__cta` (404, 15.2px), `.chapter-cta`
    (intro page — was `--green`, 16px), `.fit-platform` (podcast, 15.2px),
    `.btn--cta` (articles Subscribe/CTA, ≈13.3px), `.contact-button` (15.2px),
    and — owner follow-up in the same session — `.searchbar__submit`
    (SearchBar.astro; white *icon*, was passing at 3:1 but switched to match the
    Prev/Next buttons for consistency). All keep their existing `--ink`/surface
    hovers.
  - **`.chapter-cta` (scripture, `[slug].astro`) dark bug fixed:** its
    `var(--green-text)` background → `var(--green-deep)`. Byte-identical in light,
    2.4:1 → 6.6:1 in dark.
  - **Curtain CTAs** (`.site-header__cta` desktop "Read Now"; `a.question-cta`
    home): rest state is green-on-ink (4.6:1, PASS both themes) so the base was
    left LIT green; but the hover-reveal color was pinned from
    `--text-strong`/`--text` to **`--ink`** so the label stays ink-on-green in
    dark too (was light-on-green ≈3.3:1 on hover; imperceptible in light where
    `--text-strong` is `#000`).
  - **Hover-only white-on-green pills** (podcast `.fit-ep__links a:hover`,
    `.fit-season-arrow:hover`, `.fit-season-nav a:hover`): hover background →
    `--green-deep`.
  - **`.courses-updates__lead`** (green section, sub-24px) → `--ink` (F5 surface
    pattern; `/courses` is unlinked but the fix is trivially correct).
  - **Left as-is (PASS, verdict recorded):** F5's ink-on-green (`.footer-cta`,
    `.chat-bubble--right`, `.question-card__answer`, `.articles-hero__subtitle`,
    `.footer-newsletter__submit`, `.unsub-form__submit`); green surfaces with
    white *large* headings; graphics on green (toggle knob white circle 3.5:1 ≥
    3:1 non-text; checked seg pill ink-on-green ≈4.6:1).
  - **`::selection` addition:** the item's premise was off — there is **no**
    site-wide `::selection` rule; only `.apps ::selection` (apps.css) paints LIT
    Green with near-white text (≈3.5:1). Owner endorses it and selection state
    isn't held to AA 4.5:1, so it stays — documented here, not changed.
  - **White-vs-near-white surface audit addition:** **clean, no changes.** Every
    surface token is already near-white (`--surface-raised`/`--surface-input:
    #FAFAF8`); the only literal `#fff`/`var(--white)` backgrounds are *graphics*
    (toggle knobs `global.css` + `glossary.css`, hamburger bars `global.css`),
    correctly left pure.
  Verified: `npm run build` passes (347 pages + Pagefind); browser spot-checks in
  both emulated themes (scripture Prev/Next + bottom CTAs, `/search` pager,
  mobile "Read Now" overlay, podcast/articles buttons, searchbar arrow) — every
  fixed control is legible white-on-deep-green in dark, and Deep Green reads as an
  intentional shade against LIT Green. Note added to CLAUDE.md's Theming bullet.

- [x] **(O7) data-theme toggle — SHIPPED.**
  DONE (2026-07-14, owner decided to ship): added a 3-state light/dark control
  to the header "Aa" tray. The `:root[data-theme=…]` CSS was already a full dual
  mechanism (`@media(prefers-color-scheme:dark){:root:not([data-theme="light"])…}`
  + `:root[data-theme="dark"]…`) across `global.css` + `apps.css` +
  `found-in-translation-podcast.css` + `translation-commitments.css` +
  `ReadMenu.astro`; only the UI control and a pre-paint attribute-setter were
  missing. What shipped:
  - `SiteHeader.astro`: the "Aa" tray heading is now **Display** (both trigger
    buttons' `sr-only` labels + the close label relabeled to "Display
    settings"); the dyslexia switch gained a visible "Dyslexia-friendly font"
    label (carrying the OpenDyslexic preview moved off the heading) and a new
    **Theme** `<fieldset>` holds a segmented radio group (System / Light / Dark,
    native arrow-key a11y). Wiring lives in the existing idle-deferred
    `initFontTray`: on change it sets/removes `data-theme` on `<html>`, mirrors
    `style.colorScheme`, and writes/removes `localStorage['lit-theme']`
    (`light`/`dark`; System removes both, so absence = System). `syncTheme()`
    runs at init and on each tray open so the control reflects the live state.
  - `Layout.astro`: a pre-paint `<script is:inline>` (beside the dyslexic-font
    one) stamps `data-theme` + `colorScheme` from storage before first paint;
    the inline `criticalCSS` dark block was brought in line with the dual
    pattern (guarded media rule + explicit `:root[data-theme="dark"] body`) so a
    forced theme doesn't flash the opposite scheme on first paint.
  - `global.css`: segmented-control styles (selected pill is ink-on-green,
    ~4.6:1 and stable in both themes since neither `--ink` nor `--green` flips;
    focus ring uses `--text` so it stays visible on the green pill), all
    token-based so it adapts under `data-theme="dark"`.
  Semantics: System removes the attribute (CSS falls back to
  `prefers-color-scheme`, live-updates on OS change with zero JS); Light forces
  `data-theme="light"`; Dark forces `data-theme="dark"`. No-JS = tray never
  opens, no attribute set, OS pref governs. Verified in dev across both emulated
  OS schemes: all three states; both no-flash directions (forced-dark on a light
  OS paints dark on first load, forced-light on a dark OS paints cream with no
  dark frame); persistence across reload; System live-updating on an OS flip;
  keyboard operation (Tab + arrow keys, visible focus ring); and `npm run build`
  passes. CLAUDE.md gained a "Theming" convention bullet.

### Added from the 2026-07-16 audit

- [ ] **(O8) Image weight overhaul.**
  The single biggest real-world performance problem found in the 2026-07-16
  audit. `public/images/articles/` is 19 MB (`geiser-stars.jpg` 6.4 MB,
  `jesus-and-pilate.jpg` 5.0 MB) and the article page emits
  `<link rel="preload" as="image">` for its hero
  (`articles/[...slug].astro`), so those bytes download at top priority.
  `public/screenshots/` is 13 MB of ~0.7–1.1 MB phone PNGs feeding `/apps`
  (its lazy-loading discipline is already correct — this is purely
  format/size). `lit-logo.png` (148 KB) loads eagerly on EVERY page as a 48px
  header logo; `lsc-logo-square.png` (332 KB) loads eagerly in the welcome
  popover at ~104px; `gdj-frame-7313859.svg` is 924 KB. Fix: resize photos
  and screenshots to ~2× their max display width and convert to WebP (sharp
  is already a dependency via build:og), generate small logo variants for the
  header/popover slots, run SVGO on the big SVG, and update every reference.
  Do NOT touch `public/images/campaigns/` (referenced by already-sent
  emails) or `public/og/` (generated). Acceptance: articles dir ≤ ~3 MB,
  screenshots ≤ ~3 MB, no single page-loaded image over ~250 KB, visual
  spot-check of /apps + two article heroes + header/popover logos in dev, and
  `npm run build` + `npm run check:links` pass.

- [ ] **(O9) Unit tests for chapter-html.ts.**
  `src/lib/chapter-html.ts` (prepareStudyParagraph / prepareReadParagraph) is
  the shared transform that wraps each verse in `<span data-verse>` — every
  Study View page depends on it, and it has zero tests. Follow the O4 pattern
  (node:test + node:assert/strict, no new deps). Cover: vglue handling, verse
  spans opening/closing at tag-depth 0, duplicate-verse-id handling via
  `seenVerseIds`, footnote-ref pass-through, and verse state carrying across
  paragraphs.

- [ ] **(O10) Tests for the contact-form Worker.**
  `workers/contact-form/src/index.js` is untested. Use
  `@cloudflare/vitest-pool-workers` (devDependency inside
  `workers/contact-form/` only — keep the site's root deps clean). Cover:
  non-POST → 405; filled `_gotcha` honeypot → pretend success, nothing sent;
  missing fields → 400; CR/LF collapse in name/email (header injection);
  platform whitelist fallback to "Not sure"; Turnstile failure → 403; the
  JSON (`Accept: application/json`) vs no-JS 303 paths; and the DISPLAY_TO
  header/envelope retry. Mock the siteverify fetch and the send binding.

- [ ] **(O11) Golden tests for draft-release-notes.mjs.**
  Its change-object output is a documented contract with the mobile apps
  (see the script's docblock: `description`, additive `detail`/`location`/
  `relabel`). Add fixture-based tests — either a temp git repo with small
  before/after chapter/intro/glossary edits, or (better) refactor the
  diff-to-changes core into a pure function tests can call directly. Assert
  the field shapes and the "attribute-/metadata-only chapter edits collapse
  to one metadata line" behavior.

- [ ] **(O12) Footer newsletter no-JS fallback.**
  `SiteFooter.astro` ships the Subscribe button `disabled` and only enables
  it when Brevo's `main.js` loads — with JS off the form is dead, the one
  exception to the site's no-JS principle (the /unsubscribe Brevo form works
  no-JS). Evaluate first, then fix: test whether a native POST to the
  sibforms action succeeds without main.js/Turnstile (mirror the unsubscribe
  form's behavior); if Brevo rejects it, add a `<noscript>` note linking
  Brevo's hosted subscribe page instead. Don't guess — verify actual Brevo
  behavior before choosing.

## Fable — one session each, owner in the loop

- [x] **(F1) Self-host the contact form on Cloudflare (drop Formspree).**
  DONE (2026-07-11, live and verified end-to-end: owner deployed the Worker,
  submitted the form, and received the email with a working Reply-To). Two
  bugs surfaced only on live submits and were fixed + redeployed the same
  night: the Turnstile secret had been stored under the wrong secret name
  (diagnosed via the Worker's siteverify error-code logging:
  `invalid-input-secret`), and mimetext threw on a bare-string `Reply-To`
  header — it requires its `Mailbox` type. The email's "Sent ..." footer
  line shows the SENDER's local time (`request.cf.timezone`, UTC fallback)
  since the `Date:` header already localizes to the reader; submissions are
  rate-limited 5/min per IP via a `[[ratelimits]]` binding (429 + friendly
  message, no dashboard rule). What shipped:
  - `workers/contact-form/` — a standalone Worker (not a Pages Function)
    routed at `litbible.net/contact/submit`: verifies the Turnstile token
    server-side (`siteverify`, secret in `TURNSTILE_SECRET`), honors the
    `_gotcha` honeypot server-side (pretends success, sends nothing), then
    sends via the `send_email` binding from `contact@litbible.net` with
    `Reply-To:` = submitter. The destination inbox is the `DEST_EMAIL`
    secret so no personal address is committed. MIME built with `mimetext`
    (Cloudflare's documented path); header-bound fields are
    whitespace-collapsed against header injection.
  - `contact.astro` posts to `/contact/submit`; the fetch path keeps the
    inline status UX (plus a specific message and a Turnstile reset on a
    403 verify failure — tokens are single-use). No-JS native POST
    303-redirects to the new branded `/contact/thanks/` page (noindex,
    sitemap-excluded).
  - `_headers`: `formspree.io` removed from the enforced `form-action`
    ('self' covers the Worker) and from the report-only `connect-src`.
    `privacy.astro` Formspree disclosure replaced (delivery by Cloudflare,
    no separate form processor); effective date bumped to 2026-07-10.
  - One-time setup lives in `workers/contact-form/README.md` (Email Routing
    destination, `TURNSTILE_SECRET` + `DEST_EMAIL` secrets, `npm run
    deploy`). Remaining owner follow-up: delete the Formspree forms
    (`mbdlnpgz`; `mgovgpoo` already unused) in their dashboard.

- [x] **(F2) Content-Security-Policy rollout.**
  DONE (2026-07-10) with a deliberate owner decision that DIFFERS from the
  original item: the full resource allowlist is NOT enforced. What shipped:
  - Owner dashboard half: encryption mode strict, HSTS enabled (6-month
    max-age, no subdomains, no preload), Always Use HTTPS confirmed; the
    dashboard no-sniff toggle left OFF (`_headers` already sends it).
  - `public/_headers` now sends a SPLIT CSP. Enforced: structural directives
    only (`frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`,
    `form-action` allowlist) — these constrain attackers, never integrations.
    Report-Only: the full resource allowlist (script/connect/frame/img/etc.),
    kept as origin documentation + console telemetry.
  - Why not enforce: the site is static with no logins/secrets, so the
    realistic threat (third-party supply-chain compromise) is modest, while
    the enforced allowlist's failure mode — a future integration silently
    broken because `_headers` wasn't updated — is likelier on a solo project.
    Revisit if the site ever gains accounts/sessions (noted in CLAUDE.md).
  - Testing that informed this: Claude-in-Chrome preview run (zero violations;
    newsletter/contact submits couldn't complete there — Turnstile error
    110200, preview hostname not on the site key) + production Report-Only
    run (Turnstile validated, contact form sent, zero violations). The
    GiveLively payment step was walked to the pay button by the owner but
    without a console open, so Stripe/PayPal origins may be absent from the
    report-only list — harmless by design.
  - Discovered en route: the podcast page's Apple/YouTube/Spotify player
    iframes were missing from this item's original inventory; the footer
    newsletter form throws a pre-existing sibforms `main.js` TypeError on
    submit with no visible user feedback (NOT CSP-related — worth its own
    look someday).

- [x] **(F3) Per-chapter OG share images.**
  DONE (2026-07-09, owner approved the design via mockups first): 287 cards
  (260 chapters + 27 intros) generated to `public/og/` (git-ignored, ~4.4 MB)
  by `scripts/build-og-images.mjs`, wired into `npm run build` before
  `astro build`. Approved design: 1200×630 ink field (#1D231C), emblem
  line-art in a brand-green ring, reference in Fraunces display cut (opsz
  144, wt 500), green accent bar, Inter wordmark line, green litbible.net.
  Two compositions, one width-measured switch: short references render on
  one line beside a left-centered emblem; long ones ("2 Thessalonians 3")
  move the emblem to the top-left corner and take the full width. Intro
  cards set "Intro" in green where the chapter number would sit. Rendering
  is opentype.js text→paths (fonts committed in `scripts/og/fonts/` with
  OFL.txt; Inter is charset-subsetted — see that README) + sharp SVG→PNG
  (palette), so output is deterministic with no system-font dependency.
  `[slug].astro` + `[book]-intro.astro` pass `ogImage` (forwarded through
  ScriptureLayout) and `twitter:card=summary_large_image`; this also
  completed the Sonnet og:image-dimensions item above. Emblem is the real
  logo (`public/images/lit-logo.png`), sharp-composited into the ring after
  rasterization (follow-up fix — the first pass shipped the mockup's vector
  redraw by mistake).

- [x] **(F4) Simplify the ReadMenu.**
  DONE (2026-07-08, owner approved mockups first): `ReadMenu.astro` is now a
  "Go to passage" popover — a pill trigger showing the current passage
  (`John 3`, `John · Intro`, draft dot on draft chapters, neutral `Go to
  passage` when none) opens a book grid (SBL abbreviations from
  `BOOK_ABBREVIATIONS` in books.js; James unabbreviated), then a chapter grid
  (Introduction cell, drafts dimmed with a dot + "(draft)" accessible name,
  `Open {Book} in Reading Mode →` footer link). Single commit action (Study
  page); Study/Read buttons, both dropdowns, and ReadLayout's instructional
  tooltip are gone. No-JS fallback: the trigger server-renders as a real link
  to `/read/{book}` (or `/read`); JS upgrades it via the native Popover API
  (feature-gated). A11y: aria-haspopup/expanded, focus trap, Esc + focus
  return, roving-tabindex grids. Grids are auto-fill with measured minimums
  (wider floors under `html.dyslexic-font`), taller cells on touch screens,
  and dark mode pairs the light green with ink text (`--rm-accent-*`).
  Follow-up polish (076f2de): the scripture-tools bar collapsed onto one
  vertically-centered toolbar row (trigger / search / Reading View pill) —
  the stagger offsets and the pill's translateX overflow were fossils of the
  old two-row select stack; the trigger matches the pill's width (227px,
  seats "2 Thessalonians 3") and hairline+soft-shadow treatment; the row
  takes 64px desktop top clearance to pass under the header's floating "Aa"
  toggle instead of colliding with it at ~1200–1380px viewports.
  Further follow-ups: (a86d7bb) toolbar side-column minimums raised to
  227px (they were 200px, so the trigger could overlap the search field
  between ~900–1200px); (0e103c3) symmetric two-row layout for the
  641–900px tablet band (full-width search on top, matched pills below,
  echoing the desktop composition) instead of the old single centered
  stack in that range; (a62079f) SearchBar's visible-submit-button
  breakpoint realigned from 1024px to 900px to match where the tools band
  actually stacks; (d3de9ca) the trigger's second click now closes the
  popover — it's declared as the panel's popover invoker
  (`popovertarget`/`popovertargetaction="toggle"`) rather than driven by a
  plain click listener calling `showPopover()`/`hidePopover()` by hand,
  which was racing with the browser's own light-dismiss (outside-click
  still closes it, unchanged).

- [x] **(F5) Homepage hero + green-page text contrast.**
  DONE (2026-07-09, owner picked "ink text on green" from live mockups). The
  premise was partly wrong: a rendered-page audit showed the hero was never
  failing — its text sits in ink on the cream SVG scroll (~12:1), same for
  the title block. The real failures and their fixes:
  - Homepage green chat bubbles and question-card answer paragraphs: white
    on `#209D50` is 3.5:1 at sub-24px sizes (AA needs 4.5:1) → text switched
    to `--ink` (4.6:1, holds in dark mode since green surfaces and `--ink`
    never flip). Large white headings (card questions, section titles) stay
    white — they always clear the 3:1 large-text bar.
  - Articles hero subtitle (`articles.css`): same white-on-green failure →
    ink at full opacity; the large "Articles" title stays white.
  - `.site-header--green` (articles pages): its white-text treatment failed
    on the small nav links, so the variant now only paints the background
    green + tints the hamburger tile, inheriting the default ink text — the
    exact look of the homepage header over the green body.
  - Dark-mode header on green (was ~2.7:1 cream-on-green): green header
    surfaces keep brand green in dark mode, so `global.css` re-pins
    `--text`/`--text-strong`/`--ink-rgb` to the light-scheme inks on
    `.site-header__inner` (scoped there so the font tray and mobile overlay,
    which live in the same `<header>` with their own dark surfaces, keep the
    flipped tokens).
  Out of scope, punted to O6's button sweep: articles newsletter Subscribe
  button + article `.btn--cta`, podcast/contact/unsubscribe green buttons.

- [x] **(F6) Untangle the two meanings of "draft".**
  DONE (2026-07-09, owner picked the wording from three drafted options): the
  About FAQ answer to "What texts are available right now?" was rewritten so
  the word "draft" is reserved for unpublished stub chapters (the "(draft)"
  markers in the chapter menu), while published books are described as a
  "living first edition: complete and usable now" that the owner plans to
  revise. Two paragraphs: availability first, revision caveat second. The
  /read lede's "solid drafts" phrasing was left as-is (owner flagged, not
  changed — no "(draft)" markers adjacent there to collide with).

### Added from the 2026-07-16 audit

- [ ] **(F7) Continuity / disaster-recovery doc.**
  (Owner in the loop — needs dashboard knowledge only they have.) The repo is
  the content store, which is great, but the deploy config and secrets live
  only in dashboards. Write a short `DISASTER-RECOVERY.md`: which dashboards
  exist (Cloudflare Pages project, Email Routing destinations, the two
  Turnstile widgets, the Worker + rate-limit binding, Brevo, RedCircle,
  GiveLively), which wrangler secrets must be re-set from scratch (the six
  named in `workers/contact-form/wrangler.toml`'s comments), DNS, and the
  from-zero redeploy path (clone → `npm ci` → `npm run build` → Pages;
  `wrangler deploy` for the Worker). Names and locations only — no secret
  VALUES anywhere in the file.

## Owner — decisions & dashboard tasks (no model)

- [x] **Decide `/courses`.**
  DONE (2026-07-16): owner chose to **park it deliberately** until course
  content exists. No nav/footer link; the page stays reachable by URL only.
  Nothing to change in code — this records the decision so a future session
  doesn't "helpfully" link it. Revisit when there are actual courses to sell.
  *2026-07-16 audit note (context, not reopening the decision):* the parked
  page is live (200) and in the sitemap while linked from nowhere, so search
  engines can index an orphan. If that ever bothers, `robotsNoindex` + a
  sitemap exclusion in `astro.config.mjs` is Sonnet-sized.
- [x] **Decide the twin footer Facebook icons.**
  DONE (2026-07-16, owner approved a live mockup in both themes + mobile):
  the podcast Facebook link moved out of `SiteFooter.astro` (its `<li>` in the
  social list is gone; the LIT Facebook icon stays), leaving the footer purely
  LIT-brand social. It landed on the podcast page
  (`found-in-translation-podcast.astro`) as a **text link, not a fourth
  `.fit-platform` pill** — the owner's constraint: the pill row is a
  listen/watch affordance (Apple/Spotify/YouTube are places to consume the
  show), while the Facebook page is informational/community, so it needs its
  own visual tier. What shipped: a centered `.fit-follow` link ("Follow the
  show on Facebook" with a small inline `siFacebook` glyph, `aria-hidden`)
  directly under `.fit-platform-links` inside the `.fit-platforms` grid;
  styled in `found-in-translation-podcast.css` as sentence-case
  `--green-text` (auto-flips in dark mode — no page dark rules needed),
  underline on hover, focus ring matching the pills. Verified in dev at
  desktop + 375px mobile in light and dark: correct colors both themes
  (#0F6B33 / #3abf6a), tier difference reads clearly, accessible name is the
  plain link text, no console errors.
- [x] **Pick the code license.**
  DONE (2026-07-11): split license — owner doesn't mind others reusing the
  CODE for its functionality but wants the CONTENT protected. So `LICENSE`
  puts the site code under the permissive MIT License and the LIT translation
  text/footnotes/intros/glossary/articles under CC BY-NC-ND 4.0, with an
  explicit file-area breakdown of which is which. CONTRIBUTING.md's "License
  note" updated to match.
- [x] **Decide the theme toggle** (gates Opus item O7).
  DONE (2026-07-14): owner chose to **ship** the light/dark toggle. The
  `data-theme` CSS hooks were kept and wired up, not removed. Implemented as
  O7 above.
- [x] **Cloudflare dashboard: Web Analytics + HSTS.**
  DONE (2026-07-16): owner confirmed **Web Analytics is enabled**, so
  `privacy.astro`'s claim that the site uses Cloudflare Web Analytics is
  accurate. **HSTS is on** — already recorded in F2's DONE note (6-month
  max-age, no subdomains, no preload); this line was stale. HSTS was also
  confirmed on the live site by the 2026-07-16 audit (`max-age=15552000`).
- [ ] **Web Analytics follow-up: enabled in the dashboard, but no beacon in
  the served HTML.** The 2026-07-16 audit fetched the live homepage and found
  NO `static.cloudflareinsights.com` / `beacon.min.js` snippet — Web
  Analytics measures nothing without its client-side beacon, so "enabled"
  and "collecting" currently disagree (both can be true: enrolled, but JS
  injection not active for this site). Check Analytics & Logs → Web
  Analytics → the litbible.net site → automatic setup / JS snippet, or add
  the manual snippet to `Layout.astro`. Once the beacon actually loads, add
  `https://static.cloudflareinsights.com` to `script-src` and
  `https://cloudflareinsights.com` to `connect-src` in the report-only CSP
  in `public/_headers`, per that file's own maintenance rule.
- [x] **Formspree dashboard: delete the retired form endpoints.**
  DONE (2026-07-16): owner deleted **both** forms — the retired courses signup
  (`mgovgpoo`) and the contact form (`mbdlnpgz`) that F1's self-hosted
  Cloudflare Worker replaced. (This line originally named only `mgovgpoo`;
  F1's DONE note is what added `mbdlnpgz` to the follow-up.) Formspree is now
  fully out of the stack: no endpoints live, no site code posts to it, and the
  `_headers` CSP + `privacy.astro` disclosures were already de-Formspree'd in
  F1/F2.

### Added from the 2026-07-16 audit

- [ ] **Newsletter email compliance (CAN-SPAM).** The committed campaign
  template `emails/pentecost-2026.html` ends with a copyright line only — no
  unsubscribe link and no physical postal address, both legally required in
  marketing email. Verify in the Brevo dashboard whether Brevo appends its
  own footer to custom-HTML campaigns (if it does, past sends are fine); for
  future templates, bake in an unsubscribe link (the site has `/unsubscribe`,
  but Brevo's `{{ unsubscribe }}` tag is the reliable per-recipient one) and
  the org's mailing address. Two copy nits in that template for next time:
  "poured about the Sacred Life-breath" (likely "poured out") and "in the
  the work LSC is doing" (doubled "the").
- [ ] **Decide Astro 7 timing.** `npm audit` shows 2 low-severity advisories
  (esbuild dev-server file read on Windows, via Astro ≤6) whose only fix is
  the breaking Astro 7 upgrade. Exposure is the LOCAL dev server, not the
  shipped site, so this is not urgent — but decide when to schedule the
  upgrade (an Opus item once decided; 7.1.0 is current as of 2026-07-16).
- [ ] **Confirm the Apple Pay domain file is still needed.**
  `public/.well-known/apple-developer-merchantid-domain-association` —
  presumably GiveLively's Apple Pay verification. Confirm it's intentional
  and current; delete it if the integration that required it is gone.
- [ ] **Decide where `/apps` should surface.** The strongest conversion page
  on the site is footer-only ("Learn" column). If the app beta push matters,
  give it a header nav slot or a homepage question-card; once placement is
  decided, implementation is Sonnet-sized.

## Completed from TBD

- [x] **Consolidate email capture.** The `/courses` Formspree signup (a
  pre-Brevo vestige, per the owner) was removed; the Email Updates section
  now points to the footer's Brevo newsletter form. The contact form stays on
  Formspree until F1 ships.
