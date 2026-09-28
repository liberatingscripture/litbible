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

A **feature audit** followed on **2026-09-26** (usability, look and feel,
friction, accessibility, and ideas to explore; private artifact at
https://claude.ai/artifact/4ghJK72rd2thnCX2mdmXkZ, with every number checked against the repo and the live site that day).
Its items keep the artifact's IDs (F friction, U usability, A accessibility,
V look, X ideas, Q quick fixes) and sit in a dated subsection at the end of
each list. Phase 1 of its suggested order shipped the same day and is checked
off. Items the artifact lists under "Set aside" are deliberately absent.

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

- [x] **Update Astro to the latest 6.x release.**
  DONE: `package.json`'s `astro` range was already `^6.4.6`, but
  `package-lock.json` was still resolved to 6.4.6 while 6.4.8 was current on
  npm. Ran `npm install astro@^6`, which bumped both the resolved lockfile
  version and the `package.json` floor to `^6.4.8`. Deliberately stayed on
  the 6.x line (Astro 7 is a separate, undecided upgrade — see the Owner
  "Decide Astro 7 timing" item). Verified: `npm run check` (0 errors),
  `npm test` (35/35), `npm run build` (347 pages + Pagefind), `npm run
  check:links` (26,701 links, 0 broken) all pass; dev server confirms
  `astro v6.4.8` at startup.

- [x] **Add an `engines` field to package.json.**
  DONE: added `"engines": { "node": ">=22.12" }` to `package.json`, right
  after `"type": "module"`.

- [x] **Em-dash sweep in visible page prose.**
  DONE (2026-07-23, owner walked through each dash). Nine standalone em dashes
  in visible prose replaced: `about.astro` "life together — not fear-based" →
  comma; `read.astro` license bullets (Attribution/NonCommercial/No
  Derivatives) → colons; `release-notes.astro` lede → colon;
  `contact.astro` + `app-support.astro` status strings → "Thanks! Your message
  has been sent."; plus two the original audit MISSED and this sweep caught —
  `liberating-scripture-collective.astro` "not gatekeeping — giving people" →
  colon, and `[slug].astro` chapter-pending notice "living translation —
  chapters…" → period. **Owner chose to KEEP** the two *parenthetical* em-dash
  pairs in `about.astro`'s personal-narrative prose (~237–240, 429–430) — the
  paired-aside dashes carry the voice and the alternatives (parens, sentence
  split) read worse. **Left alone by owner decision:** three `<meta
  name="description">` strings with em dashes (`release-notes.astro:26`,
  `contact.astro:8`, `courses.astro:8`) — published copy but not on-page prose,
  outside this item's scope. Also deliberately untouched: the visible
  "Book — Introduction" heading (`ScriptureHeader.astro`), an intentional
  structured label documented in CLAUDE.md as the search-bucket format (owner
  decision 2026-07-09); and all code comments / `alt` / `title` / citation
  meta. Verified with `npm run check` (0 errors, 0 warnings).

- [x] **Title-tag separator consistency.**
  DONE: `src/pages/unsubscribe.astro`'s title now reads "Unsubscribe |
  Liberation and Inclusion Translation", matching every other page.

- [x] **Footer Threads link → final URL.**
  DONE: `SiteFooter.astro` now links `https://www.threads.com/@lit.bible`
  directly, skipping the three-hop redirect chain.

- [x] **Doc drift: document the test suite and link checker.**
  DONE (2026-07-16, landed alongside wiring in `npm run check`): added
  `npm test`, `npm run check:links`, and `npm run check` to CLAUDE.md's
  Common Commands and README's command table; CLAUDE.md's `.github/workflows/`
  project-structure line now says what `ci.yml` actually runs (chapter
  validation, type-check, unit tests, full build, link check) instead of the
  stale "chapter validation + full build" description.

- [x] **Demote the article pages' sr-only index `<h1>` to a `<div>`.**
  DONE: `src/pages/articles/[...slug].astro`'s sr-only Pagefind index surface
  is now `<div data-pagefind-weight="7">{indexTitle}</div>` instead of an
  `<h1>`, so `.article__title` is the page's only h1. Verified in-browser:
  exactly one `<h1>` per article page, and the div still carries the weight
  attribute; `npm run build` + Pagefind indexing (41 pages) unaffected.

- [x] **Align workflow Node versions.**
  DONE: `.github/workflows/release-notes.yml` now uses `node-version: '24'`,
  matching `ci.yml`.

- [x] **Dark-scheme `theme-color` meta.**
  DONE: added a second `<meta name="theme-color">` to `Layout.astro`, scoped
  to `media="(prefers-color-scheme: dark)"`. **Deviation from the item's
  suggested value:** uses `#0F6B33` (`--green-deep`, owner's decision) rather
  than the dark page background — a theme-invariant brand green instead of
  near-black chrome. Verified in-browser: both metas present with correct
  `content`/`media`.

- [x] **Add width/height to the contact-page logo.**
  DONE: `.contact-logo` in `contact.astro` now has `width="1000"
  height="1000"`, matching `lit-logo.png`'s confirmed 1000×1000 intrinsic
  size (verified via the PNG's IHDR chunk and in-browser `naturalWidth`/
  `naturalHeight`). CSS display scaling (`width: min(260px, 60vw)`)
  unaffected.

- [x] **Reduced-motion guard for the homepage underline animation.**
  DONE: confirmed `.callout-underline-path`'s draw transition had no
  reduced-motion guard (only the desktop CTA curtain-wipe did). Added
  `transition: none` for `.callout-underline-path` inside the existing
  `@media (prefers-reduced-motion: reduce)` block in `home.css` — CSS-only
  fix, keeps the underline visible via the unaffected `.is-visible` toggle,
  just skips the animated draw. Verified the compiled rule lands correctly
  in the built CSS.

- [x] **Contributor plumbing for the BDR workflow.**
  DONE: added `.github/ISSUE_TEMPLATE/bug_report.yml` (technical bug report
  form) and `.github/ISSUE_TEMPLATE/translation_feedback.yml` (points to
  `/contact` per CONTRIBUTING.md's existing "Translation feedback" section),
  `.github/PULL_REQUEST_TEMPLATE.md` (checklist: `validate:chapters` if
  chapters touched, `npm run build` passes, scope stays in the agreed area),
  and root `CODEOWNERS` (`* @liberatingscripture`).

### Added from the 2026-09-26 feature audit

- [x] **Accept a period as the chapter:verse separator (F8).**
  DONE (2026-09-26, PR #214): `cleanReferenceInput` in `src/scripts/search-core.js` turns a
  period between two digits into a colon before it strips abbreviation
  periods, so "John 3.16", "John.3.16" and "Rom. 8.3" jump like their colon
  twins. A comma between digits does the same ("John 3,16") only while no
  colon is present. Cases are in `test/search-core.test.js`.

- [x] **Report /search results as a count (Q1).**
  DONE (2026-09-26, PR #214): `renderFromCache` in `src/scripts/search.js` reads "194 results
  for “liberation” (1 glossary, 47 topic, …)", listing only the kinds that
  matched. Fixed on the way: a search with no results left "Searching for
  "q"..." on screen for good.

- [x] **Drop zero counts under a reference jump in the header tray (Q2).**
  DONE (2026-09-26, PR #214): with a jump row showing, `src/scripts/searchbar.js` lists only
  non-zero counts and skips the no-results suggestions.

- [x] **Name the unfinished chapters on /read (Q3, first half).**
  DONE (2026-09-26, PR #214): the lede is built from `scanDraftChapters()` and reads "all except
  Acts, Revelation, and Luke 23–24". The other half of Q3 is under Owner.

- [x] **Reading View side margins on phones (V2).**
  DONE (2026-09-26, PR #214): `.rm-page` at ≤900px in `src/styles/read-mode.css` leaves 20px
  a side (it was about 7px).

- [x] **Control names (A3).**
  DONE (2026-09-26, PR #214): the top Previous/Next buttons name their destination ("Previous:
  John 2"), the Reading View pill uses the book's display name, and the
  glossary's contact link covers "contact me here".

- [x] **CLAUDE.md drift (Q7).**
  DONE (2026-09-26, PR #214): draft count corrected to 52, and the footnote total is no longer
  hard-coded.

- [x] **Web app manifest background and start URL (Q5).**
  `public/site.webmanifest` has `"background_color": "#ffffff"` while the
  site's page colour is cream (`--cream: #E1DFD9` in `global.css`), so an
  installed app flashes white on launch, and it has no `start_url`. Set
  `background_color` to `#E1DFD9` and add `"start_url": "/"`. The file is
  hand-maintained: `build:favicons` writes the icons, not the manifest.
  DONE (2026-09-28): the background is cream, and the owner chose to stop the
  site offering itself as an app instead of adding `start_url`: `display` is
  now `browser`, so a home-screen icon opens in the browser and no browser
  offers to install the website beside the real apps. A `start_url` would
  have changed where a saved icon opens and may have made Android Chrome
  offer the website as an install. See CLAUDE.md, the emblem bullet.

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
  UPDATE (2026-07-20): `WelcomePopover.astro` is now retired (kept unimported);
  the active popover is `AppsLaunchPopover.astro`, which carries this same
  gating forward. The rules below still govern any replacement popover.
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

- [x] **(O8) Image weight overhaul.**
  DONE (2026-07-23): converted every `public/images/articles/*` (13 files) and
  `public/screenshots/**/*` (15 files, incl. `carousel/`) from JPEG/PNG to
  WebP via a throwaway `sharp` script — longest edge 1600px/q74 for article
  heroes (also the OG/Twitter/JSON-LD image; accepted as WebP, no separate
  JPEG), 1000–1300px/q80 for screenshots (crisp UI text). `public/images/
  articles/` went 19 MB → 872 KB; `public/screenshots/` went 12.6 MB → 960 KB.
  All 13 `heroImage:` frontmatter values + the 5 `seasons/` and 3 `callouts/`
  `image:` values + `Hero.astro`/`BigScreens.astro` `src`/consts updated to
  `.webp`. Added `public/images/lit-logo-96.webp` (96×96, ~4 KB) for the 48px
  header logo slot in `SiteHeader.astro` (`lit-logo.png` stays, still needed
  by the OG fallback and `build:og` source); the footer logo actually renders
  up to 220px (not 48px as originally scoped), so it — plus `404.astro`,
  `contact.astro`, `app-support.astro`, and both `thanks.astro` pages — was
  repointed to the **existing** `lit-logo.webp` (1000px, 36 KB) instead of
  the new tiny variant. SVGO (path-precision 0, safe since these render
  ≤336px with CSS
  grayscale/blend filters) took `gdj-frame-7313859.svg` 924 KB → 180 KB,
  plus the two other commitment icons on the same page for free
  (`schmidsi-holy-spirit-1412527.svg` 313 KB → 33 KB, `gdj-tree-7989436.svg`
  99 KB → 39 KB). `lsc-logo-square.png` (332 KB) turned out to be dead
  weight — only the retired, unimported `WelcomePopover.astro` references it,
  not the active `AppsLaunchPopover`; left as-is, no load impact. Originals
  moved (not deleted) to a new top-level, non-shipped `_source-images/`
  (owner chose to archive, not delete). `public/images/campaigns/` and
  `public/og/` untouched. `npm run build` + `check:links` + `check` pass;
  visual spot-check in dev.

- [x] **(O9) Unit tests for chapter-html.ts.**
  DONE (2026-07-16): added `test/chapter-html.test.js` — 25 tests using Node's
  built-in `node:test` + `node:assert/strict`, **no new deps**, following the O4
  pattern exactly. `chapter-html.ts` is TypeScript but is entirely erasable
  syntax (type aliases, parameter annotations, one `as`), so it imports directly
  with an explicit `.ts` extension via Node's automatic type stripping —
  confirmed empirically on Node 24.16.0, no loader and no transpiler dep. Tests
  exercise `prepareStudyParagraph`/`prepareReadParagraph` as black boxes only;
  the nine internal passes stay unexported, the same discipline as O4's
  `nearestVocabWord`/`findTokenRuns`-via-`searchVerses` coverage. Coverage: all
  five named areas — vglue whitespace normalization (a literal `&nbsp;` entity
  and a real U+00A0 char both normalize; Reading Mode moves the id off the
  `<sup>` onto `.rm-verse-anchor`); `wrapVerseSegments` splitting at tag-depth 0
  (single- and multi-verse paragraphs, leading unmarked text left unwrapped,
  marker-less continuation paragraphs, empty/whitespace-only `<p>` passthrough);
  duplicate verse ids via `seenVerseIds` (the Mark 14:62 paragraph-spanning case
  — visible number kept, duplicate id dropped, a fresh Set restores it; Reading
  Mode's dedupe-BEFORE-namespace order verified directly, since the duplicate
  ends up with no `rm-verse-anchor` at all); footnote-ref pass-through (`<sup
  class="fn-ref">` untouched with no id/`data-osis` in Study, fully stripped in
  Reading Mode); and verse-state carrying (one `verseState` threaded across
  three `prepareStudyParagraph` calls carries into unmarked continuation blocks;
  a fresh state doesn't). Also pinned `addOsisIds` (known book, unknown book →
  no attribute, already-present not doubled), `rewriteVerseIdsAndAnchors`,
  `addHbqAria`, and `normalizeHbqVerseGlue` (including idempotence).
  **Deliberate deviation:** bumped `package.json` `engines.node` from `>=22.12`
  to `>=22.18` — type stripping (which the direct `.ts` import needs) is only
  on-by-default from 22.18, so the stated floor was claiming a Node range where
  `npm test` would actually fail. CI and local dev both run Node 24, so nothing
  changes in practice; the manifest now just tells the truth. (The Sonnet item
  above deliberately set `>=22.12`, so this shouldn't pass unnoticed.)
  Verified (tests as first landed): `npm test` → 60/60 pass (35 existing
  search-core + 25 new); `npm run check` → 0 errors (33 pre-existing unrelated
  `is:inline` hints); `git diff src/lib/chapter-html.ts` → empty at that point.
  **Mutation-tested** to prove the assertions bite: five deliberate bugs
  (data-verse attribute renamed, dedupe disabled, footnote stripping disabled,
  OSIS injection disabled, verse state not carrying) each failed exactly the
  expected tests.
  **Bug found while writing the tests, then fixed as a follow-up (2026-07-17):**
  the vglue separator alternation (`&nbsp;` or a literal U+00A0) in all three glue passes
  (`normalizeStudyVerseGlue`, `normalizeReadVerseGlue`, `normalizeHbqVerseGlue`)
  only matched a literal `&nbsp;` entity or a real U+00A0 between the verse
  `<sup>` and its first word — a plain ASCII space failed to match, so the span
  passed through unnormalized (and in Reading Mode the verse id never moved onto
  `.rm-verse-anchor`, so a `#book-ch-vN` deep link would target a `<sup>` that is
  hidden when verse numbers are toggled off). Dormant, not live: a scan of all
  260 chapters found every one of 6319 vglue spans uses `&nbsp;` — but **nothing
  validates that** (the chapter validator only enforces `indexed` + verse-id
  uniqueness; the `wrapVerseSegments` docstring's "validated corpus invariants
  (see validate-chapters)" phrasing overstated it), so a hand-edited plain space
  would silently render unglued. Fix: widened the alternation to `(?:&nbsp;|\s)` in all three passes
  (`\s` subsumes U+00A0, so existing handling is preserved) and rewrote the three
  O9 tests that had pinned the old behavior into ones that assert normalization
  (plain space → `&nbsp;`, a run of spaces collapses, Reading Mode still moves
  the id), plus a guard that only one separator is consumed (a doubled `&nbsp;`
  keeps its second as text). Proven safe on real content: rendering all 260
  chapters through both pipelines before vs after is **byte-identical** (same
  SHA-256), since no chapter uses a plain space today — the change only adds a
  self-healing path. Re-verified: `npm test` → 63/63 pass; `npm run check` → 0
  errors; and the three new tests each fail against the pristine pre-fix file
  (swapped it in to confirm they bite). Also corrected the `wrapVerseSegments`
  docstring, which had claimed the vglue tag-depth-0 convention was
  validator-enforced; it isn't.

- [x] **(O10) Tests for the contact-form Worker.**
  DONE (2026-07-16): added `workers/contact-form/test/index.test.js` — 39 tests
  via `@cloudflare/vitest-pool-workers`, with the pool + `vitest` as
  devDependencies **inside `workers/contact-form/` only**, so the site's root
  deps stay clean and root `npm test`'s `test/**/*.js` glob never picks them up.
  Tests run inside workerd, so `cloudflare:email` / `EmailMessage` are the real
  thing rather than mocks. The Worker's entry is `fetch(request, env)` with
  `env` as a plain parameter, so each test calls it directly with a hand-built
  env — `CONTACT_EMAIL.send` and `RATE_LIMITER.limit` are plain spies and no
  real send_email or ratelimit binding is ever provisioned (that being the
  fragile part of a pool setup). Turnstile's siteverify, the only outbound
  fetch, is stubbed per test.
  **Two deviations from the item text, both forced by the current library:**
  (1) `defineWorkersConfig` from `@cloudflare/vitest-pool-workers/config` no
  longer exists — 0.18.x removed that subpath entirely and replaced it with a
  Vite plugin, so `vitest.config.js` uses `cloudflareTest({ wrangler: {
  configPath } })` from the package root. (2) The pool pins `vitest@^4.1.0` via
  peerDeps, so it's two devDeps, not one.
  **Two discoveries worth recording, both of which would have produced silently
  vacuous tests:** an outbound `EmailMessage`'s MIME is NOT readable via `.raw`
  (it's undefined) — workerd stores it under the namespaced own property
  `"EmailMessage::raw"`. The suite reads it through a guarded `rawOf()` helper
  that throws a named error if that property ever disappears, so a workerd
  rename fails loudly instead of quietly making every body assertion vacuous.
  And while the body is `7bit` plain text (directly assertable), the **Subject
  is RFC 2047 base64-encoded** (`=?utf-8?B?…?=`) because the subject template
  contains an em dash — so the suite decodes encoded-words before comparing.
  Coverage: all eight named areas — non-POST → 405 + `Allow: POST`; honeypot
  (pretends success, sends nothing, and doesn't even spend a siteverify call; an
  empty `_gotcha` still sends normally); missing/malformed fields → 400
  `missing-fields` (six cases); CR/LF collapse (a `\r\nBcc:` name collapses to
  one line and no `Bcc:` header appears; a CR/LF email fails validation → 400)
  plus `LIMITS` truncation (name 200, message 10000); platform whitelist
  (iOS/Android/Not sure pass through, a tampered value collapses to "Not sure",
  missing → "Not sure", and the contact route emits no App line at all);
  Turnstile → 403 (rejected verdict; a missing token short-circuits WITHOUT a
  siteverify call; a throwing siteverify fails closed); JSON vs no-JS paths
  (`{ok:true}` vs a 303 to the route's thanks page, and the branded noindex
  error page with the right status and `backPath`); and the DISPLAY_TO alias +
  retry (alias shown in `To:` while the envelope targets the real inbox; a
  rejected alias retries once with the header matching the envelope, envelope
  unchanged on both attempts; no alias → no retry → 500 `send-failed`;
  retry-also-fails → 500).
  Two additions beyond the item's list: **route selection**
  (`/app-support/submit` uses its own inbox, secret, subject and thanks path; an
  unknown path falls back to the contact config) and the **rate limiter** (429
  `rate-limited` keyed by `CF-Connecting-IP`; a throwing limiter **fails open**,
  which is the documented intent).
  Also wired a separate `worker-tests` job into `.github/workflows/ci.yml` (its
  own `npm ci`, `working-directory: workers/contact-form`) — the root `npm ci`
  never installs this package, so without its own job the suite would never run
  in CI and would rot. Worker README gained a matching note.
  Verified: `npm ci` + `npm test` from clean → 39/39 pass; `npm run check`
  (`wrangler deploy --dry-run`) still bundles with identical bindings; `git diff
  workers/contact-form/src/index.js` → empty. **Mutation-tested** to prove the
  assertions bite: five deliberate bugs (honeypot disabled, whitespace collapse
  removed, retry removed, platform whitelist bypassed, envelope switched to the
  alias) each failed exactly the expected tests. Tests only; zero behavior
  change to the Worker.

- [x] **(O11) Golden tests for draft-release-notes.mjs.**
  DONE (2026-07-17). Took the "(better)" route: extracted the diff→changes
  core into a pure `buildChanges({ addedFiles, modifiedFiles, readBase,
  readNow })` in `scripts/lib/release-notes-core.mjs` (git/fs injected via two
  reader callbacks; no argv/process/git of its own), leaving
  `draft-release-notes.mjs` a thin CLI/git shell. Added
  `test/draft-release-notes.test.js` — 17 fixture cases (in-memory base/now
  file maps, no git, no disk) asserting the full change-object shapes:
  chapter_added (incl. whole-book "Philemon added" and placeholder false→true),
  text_updated (single + multi-verse en-dash range with `v. N:` detail prefixes
  and min-verse anchor), footnote_added vs footnote_updated, both relabel-cascade
  directions (insert +1 / remove -1 → `relabel` field populated, clause kept out
  of `description`, type stays footnote_updated), metadata-only collapse (single
  line + `Metadata updated (N chapters)` flood-guard), intros/glossary/articles
  (incl. quoted+unquoted `traditional:` frontmatter and attribute-only edits
  emitting nothing).
  **One traced bug fixed along the way (owner-approved).** The docblock, CLAUDE.md,
  and this item all claimed attribute-*or*-metadata-only chapter edits collapse
  to a metadata line, but only metadata-only did: an attribute-only edit inside
  paragraph HTML (a `class`/`id` retag) slipped past the verse-text diff, then
  the paragraph fallback compared *raw* HTML and emitted a bogus `text_updated`
  row — a repo-wide id/class pass would have flooded the changelog. Fix: the
  fallback now compares `normalizeMarkup(stripFootnoteRefs(p))` (same normalizer
  already used for intros/glossary/articles), so attribute-only paragraph edits
  collapse to `metadata_updated` as documented; verse extraction still reads the
  raw paragraph for `id="vN"`.
  Verified: **byte-for-byte identical** output vs the pre-refactor script on a
  real 92-change range (`--since HEAD~200`; the range has zero attribute-only
  chapter edits, so fix 1b is inert there → truly identical); `npm test` →
  63→**80** pass; `npm run check` clean. **Mutation-tested**: reverting fix 1b,
  un-collapsing metadata-only, and dropping the `relabel` split each failed
  exactly the guarding test(s).

- [x] **(O12) Footer newsletter no-JS fallback.**
  DONE (2026-07-21). The item's premise was already stale: `SiteFooter.astro`
  had been refactored (commits `c28bf1c`/`6722f64`, same-day) to drop Brevo's
  `main.js` and POST via its own `fetch`, so the Subscribe button is no longer
  shipped `disabled`. What remained open was whether Brevo's server accepts a
  no-JS submission, which sends no `cf-turnstile-response` token (the
  `.cf-turnstile` widget only renders once JS injects `api.js` on interaction).
  **Verified, not guessed (and the first read was wrong, then corrected):** a
  controlled token-less POST to the sibforms `action` URL returned **HTTP 200
  `{"success":true}`** — which looks like acceptance but is a **decoy**. sibforms
  returns success to the *client* regardless, then enforces Turnstile
  server-side silently, so a bot can't tell accept from reject. Two independent
  checks proved nothing was actually subscribed: (1) the owner checked the Brevo
  subscriber list and the test contact was **not there**; (2) a Gmail search
  (inbox + spam + trash, Brevo/Sendinblue senders + the plus-address) found
  **no** double-opt-in confirmation email. A single-opt-in accept would have
  added the contact directly; a double-opt-in accept would have sent a confirm
  email; both falsified ⇒ **Brevo silently drops the token-less POST.**
  **So the no-JS footer form is a silent no-op** — it appears to submit but
  subscribes nobody, and the browser lands on a raw `{"success":true}` page.
  **No fallback can make no-JS subscription actually work:** the blocker is
  Turnstile, which needs JS, and Brevo's embed, Brevo's hosted `/serve/` page,
  and the `/contact` form all gate on the *same* Turnstile-enforcing path.
  Owner decision: don't pretend otherwise. Fix only the real harm — the false
  success. **Fix shipped:** a `<noscript>` block in `SiteFooter.astro` that hides
  the form (`<style is:inline>.footer-newsletter__form{display:none}</style>`;
  the status panels are already `display:none` until JS) and shows one honest
  line, "Subscribing requires JavaScript." No link (every subscribe/contact route
  needs JS too, so a link would imply a path that doesn't exist). Inert when JS is
  on (>99% of visitors), so the working form is untouched.
  **Test side effect, disclosed:** the verification POST created one
  pending/unconfirmed Brevo contact for a plus-address of the owner's own inbox
  (`bcjohnson7+litnojstest@gmail.com`); owner can delete it from the Brevo
  dashboard. **Related latent issue (out of scope):** `SubscribeStrip.astro` on
  the parked/unlinked `/courses` has a JS fallback that submits with an empty
  token when Turnstile is unavailable — by this finding that path silently fails
  while showing success; worth a follow-up if `/courses` is ever revived.

### Ported from the liberatingscripture.github.io FIXLIST (2026-07-23)

The sibling `liberatingscripture.github.io` (LSC) repo's audit was built mostly
by porting *from* litbible, but its 2026-07-18 audit surfaced a few original
findings that turned out to apply here too. Source: LSC's `FIXLIST.md`, items
S9, O9, and O8.

- [x] **(O13) Stop overstating the no-JS contact path (= LSC's S9).**
  DONE 2026-07-23: Cloudflare Turnstile can't render without JS, so a
  genuinely JS-less visitor can never obtain a token and a true no-JS POST
  always fails the Worker's server-side check with a 403 — the native-POST
  path's real value is resilience when JS is on but `fetch` fails or is
  blocked. Reworded the misleading "a native no-JS POST works too" claim (and
  its variants) in `src/pages/contact.astro`, `src/pages/app-support.astro`,
  the docblock in `workers/contact-form/src/index.js`, the errorPage
  Turnstile-branch string (`workers/contact-form/src/index.js` ~line 271, now
  "…complete it again if it is shown, and resend. (The check requires
  JavaScript.)"), both `contact/thanks.astro` / `app-support/thanks.astro`
  header comments, the smoke-test step in `workers/contact-form/README.md`,
  and the contact-form bullet in `CLAUDE.md`. Copy/comments only, no behavior
  change; the live errorPage string updates only after the next
  `wrangler deploy`.
- [x] **(O14) No-JS navigation fallback in the header (= LSC's O9).**
  DONE 2026-07-23: under litbible's 1100px breakpoint the desktop `.site-nav`
  is `display:none` and the hamburger menu is JS-only, so a phone visitor with
  JS off had no working header navigation (the footer nav still worked, so
  they weren't fully stranded, but this broke CLAUDE.md's "everything must
  degrade gracefully without JS" invariant). Added a `<noscript>` block to
  `src/components/SiteHeader.astro` (mirroring the existing SiteFooter
  no-JS pattern: global selectors in a `<style is:inline>`, since the
  header's real elements are Astro-scoped) that hides both JS-only toggles at
  every width and shows a plain nav row under 1101px with the same links as
  the desktop nav plus Read Now.
- [x] **(O15) Contain focus/AT in the mobile menu dialog (~ LSC's O8, adapted).**
  DONE 2026-07-23: the mobile dialog already had `aria-modal="true"` and a
  manual Tab focus-trap, but nothing removed the background content from the
  accessibility tree, so a screen reader's virtual cursor could still wander
  into it. Did NOT copy LSC's approach verbatim — LSC inerts its entire
  header inner because its mobile panel has its own in-panel close button;
  litbible's panel has none (the hamburger↔✕ toggle inside
  `.site-header__inner` is the only close control), so inerting the inner
  would have broken it. Instead, `setOpenState` in `SiteHeader.astro` now
  toggles native `inert` on the true background regions only — `.skip-link`,
  `#main-content`, `.site-footer`, `.footer-license-band` — while keeping
  `.site-header__inner` live and keeping the existing manual Tab-trap to
  contain keyboard focus within the still-live header. The `AppsLaunchPopover`
  `<dialog>` and the font tray need no handling; both are already out of the
  tab order/a11y tree when closed.

### Added 2026-07-28

- [x] **(O16) Astro 6 → 7 upgrade.**
  DONE (2026-07-28). Landed in two commits so the risky half is reviewable on
  its own. **Result: `npm audit` 8 vulnerabilities → 0, and the rendered site is
  content-neutral.**
  - **Commit 1 (lockfile only):** `npm audit fix` cleared the five advisories
    that never needed Astro 7 — `@astrojs/rss` 4.0.18→4.0.19 (XML injection;
    the only one that *ships*, via `src/pages/rss.xml.js`), plus build-time
    `fast-uri`, `js-yaml`, `postcss`, `svgo`. All 349 dist HTML files stayed
    byte-identical.
  - **Commit 2:** `astro@^7.1.4`, plus **`sharp` promoted to an explicit
    devDependency**. `scripts/build-og-images.mjs` and `build-favicons.mjs`
    both `import sharp` but it was never in `package.json` — it had been riding
    Astro 6's transitive `dependencies.sharp`. Astro 7 demotes sharp to an
    *optionalDependency* whose range (`^0.34.0 || ^0.35.0`) still admits the
    CVE-affected 0.34.x, so declaring it directly both fixes the libvips
    advisory and stops `build:og` being one `--no-optional` away from failing.
  - **Two Astro 7 defaults were deliberately pinned back**, each commented in
    `astro.config.mjs`. This was not caution for its own sake — both were caught
    changing real output:
    1. **`compressHTML: true`** (Astro 7 defaults to `'jsx'`). JSX whitespace
       rules join adjacent inline text that the markup deliberately spaced:
       "LIT Bible" + "Free. No account, no ads." → `LIT BibleFree. No account,
       no ads.`, the "Aa" trigger's sr-only label → `AaDisplay settings`, and
       the nav → `AboutCommitmentsGlossaryPodcastArticles`. Prose bodies were
       fine; **accessible names and Pagefind's extracted text were not** —
       Pagefind's word count moved 2952 → 2996 under the new default and
       returned to exactly 2952 once pinned.
    2. **`markdown: { processor: unified() }`** (Astro 7 defaults to its native
       Sätteri pipeline; requires `@astrojs/markdown-remark` as a devDep).
       Sätteri changed **published copy** in three ways: a closing curly quote
       flipped to an opening one in `matthew-15-canaanite-woman`, `...` rendered
       as `. . .` in the glossary, and the `2peter-intro.md` list bug below
       stopped being auto-corrected. Note installing `@astrojs/markdown-remark`
       alone does NOT switch the engine back — the `markdown.processor` option
       is what does it.
    **Adopting either new default is a content decision for the owner, not an
    upgrade side effect.** Both are cheap to revisit later behind the same diff.
  - **Verification** (the O2 byte-manifest precedent, extended): built Astro 6
    and Astro 7 trees side by side and compared them three ways — raw hashes,
    markup with build-tool cosmetics normalized away, and *rendered text* with
    block tags treated as visual breaks and inline tags as nothing (so a lost
    inter-inline space shows up as joined words). Final result vs Astro 6: **346
    pages differ only in benign whitespace, 2 are byte-identical, and exactly 1
    page differs in rendered text** — `/found-in-translation-podcast`, where
    Astro 7 *adds* a space between an episode title and its date that Astro 6
    was swallowing. An improvement, not a regression.
    Also passing: `npm run check` (0 errors, 0 warnings), `npm test` (80/80),
    `npm run check:links` (349 pages, 28,785 links, 0 broken), `npm run build`
    (347 pages + Pagefind + 288 OG cards, so sharp works — libvips 8.18.3), and
    a dev-server smoke test under Vite 8 (chapter + intro pages 200).
  - **Not a concern, confirmed rather than assumed:** the app-sync `version`
    string is derived from *source* content hashes, so it did not move across
    the upgrade (`contentHash` stayed `ee851670`). Installed apps will not see a
    spurious sync. Build got faster too (astro build 19.6s → 12.4s; Vite 8 ships
    Rolldown, which is also what removes the esbuild advisory).
  - Nothing in the repo tripped the other Astro 7 breaking changes: no
    `src/fetch.ts`, no `@astrojs/db`, no view transitions, no container
    renderers, no remark/rehype plugins, and the stricter Rust compiler found
    no invalid HTML in any `.astro` file. `@astrojs/sitemap` and `@astrojs/rss`
    declare no peer deps; `@astrojs/check` accepts the repo's TypeScript 6.

- [x] **(O17) Unclosed `<li>`/`<ul>` in `src/data/intros/2peter-intro.md`.**
  DONE (2026-07-28, owner approved once the intent was shown to be
  unambiguous). Found while diffing the O16 upgrade; **pre-existing, not caused
  by it, and live on the site until this fix.** Line 61 opened an `<li>` that
  was never closed, and the `<ul>` opened at line 51 never closed — so the
  entire "Takeaways on Liberation and Inclusion" section (the `<h2>` and its
  three paragraphs) rendered nested inside a bullet of the "Key Passages" list.
  Astro 6's remark pipeline silently auto-closed both tags at EOF, which is why
  it looked like a stray bullet rather than broken markup; Sätteri does not,
  which is how it surfaced.
  **The fix was a single token**: line 61's `<li>` should have been `</ul>`.
  That one substitution closes both unbalanced tags at once — the `<li>` stops
  being opened and the `<ul>` gets its closer. Corroborated three ways, so this
  was mechanical rather than a judgment call (an earlier draft of this item
  wrongly assumed the intent was ambiguous and deferred it to the owner):
  (1) 24 intros carry the `<h2>Takeaways on Liberation and Inclusion</h2>`
  heading and **23 of 24** precede it with `</ul>` + a blank line — 2 Peter was
  the lone exception, preceded by `</li>` + `<li>`; (2) this same file already
  closes its two earlier lists exactly that way (`</ul>` before
  `<h2>Structure</h2>`, `</ol>` before `<h2>Key Passages</h2>`); (3) no `<h2>`
  is nested inside a list item anywhere in the corpus, and the other three Key
  Passages bullets are single quoted verses, not multi-paragraph essays.
  Verified: the unbalanced-HTML scan over all of `src/data/intros/` and
  `src/content/` now reports **0 files** (it found this one file only, so the
  problem was never systemic); the rendered heading moved out of the `<li>` to
  top level; and a dist diff against the pre-fix build shows **exactly 1 page
  changed** (`2peter-intro`) with **0 pages changed in rendered text** — the
  words are identical, only their nesting moved. `npm run build`,
  `npm run check` (0 errors), `npm test` (80/80), `npm run check:links`
  (28,785 links), `npm run validate:chapters` (260 valid) all pass.
  **Expected app-sync effect:** this is a real content publish, so the manifest
  `contentHash` moved `ee851670` → `30bddf67` and the apps will sync the intro.
  That is correct behavior, and it is the only content change in the Astro 7
  branch — the upgrade itself moved nothing.

### Added from the 2026-09-26 feature audit

Details for each item are in the artifact (https://claude.ai/artifact/4ghJK72rd2thnCX2mdmXkZ); the IDs match.

- [x] **Tap targets for footnote letters (A1).**
  DONE (2026-09-26, PR #214): `sup.fn-ref a` gets a centred overlay of at least 24×24px, stacked
  above the verse number's (which keeps its 6px margins with the same 24px
  floor). Verified at 375px on John 3: every footnote letter catches a tap
  11px out on each side, including notes r and t.

- [x] **Hide index-only search text from screen readers (A2).**
  DONE (2026-09-26, PR #214): the `pf-meta` spans in `ScriptureLayout`/`SearchLayout` and the
  glossary's `srOnly` span and index block are `aria-hidden`. Rebuilt
  Pagefind index checked: glossary keywords and intro metadata still index.

- [x] **Prefetch the previous and next chapter (U3).**
  DONE (2026-09-26, PR #214): speculation rules in `ScriptureLayout.astro`, **prefetch** at
  `moderate` eagerness. Deliberately not prerender, which would run page
  scripts (the `lit_pv` popover counter, the popover, analytics) for a page
  nobody opened. See CLAUDE.md.

- [x] **Guessable scripture addresses on the 404 page (F6).**
  DONE (2026-09-26, PR #214): `resolveMistypedPath` in `search-core.js` plus a script in
  `404.astro`. "/John-3", "/jn-3", "/john-3-16", "/john/3",
  "/1-corinthians-13" and "/read/1-corinthians" redirect; "/john-30" offers
  "Did you mean John?".

- [x] **Never truncate the site name (V3).**
  DONE (2026-09-26, PR #214): `SiteHeader.astro` swaps to "LIT Bible" as soon as "Translation"
  would clip, and re-measures after the webfont loads.

- [x] **Link scripture references outside the verse text (F1).**
  DONE (2026-09-27, PR #216): `src/lib/scripture-refs.mjs` links references in footnotes,
  intros, article and glossary bodies, and release-note rows when the page
  renders; none of the data changes. It has its own book table rather than
  `parseReference`, whose aliases (`re`, `ro`, `mt`) are too loose for prose
  and which can't find a reference inside running text. Explicit references and
  their list continuations only; a reference tagged with another translation
  ("NRSVue", "ESV") stays plain, as BVJ ruled at plan review.
  - Glossary "the entry for “X”" jumps on the page only, and release-note rows
    naming an intro, glossary entry or article link by their fixed wording
    (491 of 492 rows link).
  - `check:links` now resolves verse ranges, so it checks every generated link.
  - One content fix: `faithfulness-as-resistance` labelled Hebrews 11:39–40 as
    "Hebrews 10:39-40" (its link already went to Hebrews 11).
  - Follow-up, still open below: relative references.

- [ ] **Relative scripture references (F1 follow-up).**
  "vv. 9–11", "verse 10" and a bare "(1:20–25)" still print as plain text. The
  linker can't assume the host chapter: `1corinthians-12` fn-hh and
  `1corinthians-14` fn-c are the same note, and its "vv." means 1 Cor 14 in
  both. A safe version would bind only to the last explicit reference in the
  same note, and needs a pass over the 246 "verse(s) N" cases first.
  Owner, 2026-09-28: not yet. A count that day found 288 of them in the
  footnotes: 203 with no reference before them (197 in notes stored in one
  chapter, 6 in shared notes), 30 after a New Testament reference, and 55
  after a Hebrew Bible one ("Deuteronomy 6:1–5, particularly verse 2"). Those
  55 must never bind to the host chapter; with X14 they could go to Sefaria.

- [x] **"Continue reading" for returning readers (F2).**
  Keep one last-read record in `localStorage` (book, chapter, verse, view,
  time), written by Study View and Reading View, and offer "Continue: Romans
  8" in the home hero, at the top of /read, and in the phone menu, with a way
  to clear it. Add it to the privacy page's storage paragraph.
  DONE (2026-09-27, PR #218): `src/scripts/last-read.js` keeps `lit_last_read`.
  Study View writes it on arrival (at the `#v` verse) and as the reader
  scrolls; Reading View writes it beside its own resume save, through an
  `rm:position` event, because `read-mode.js` is served unbundled and can't
  import. Drafts are never recorded. `ContinueReading.astro` sits under the
  home title block and /read's heading, and the phone menu has a quieter
  button above Read Now; the × forgets it everywhere at once. Privacy page
  clause added and re-dated.

- [x] **Reading straight through runs into drafts (F4).**
  Let Previous/Next skip to the nearest published page and say why ("Luke
  23–24 are in progress · Next: John introduction"), and render draft pages
  from a template whenever `indexed` is false. **Before retiring the
  placeholder paragraph in the draft chapter JSON, check how both apps show a
  draft**, since that text ships to them. Pairs with X15.
  DONE (2026-09-27, PR #218): `src/lib/chapter-nav.mjs` is now the one rule behind
  the top buttons, the bottom buttons and a draft page's links, replacing
  three hand-rolled copies. It steps over drafts, and a line under the bottom
  buttons names what it stepped over ("Luke 23–24 are still being
  translated."). Draft chapters and the placeholder intros (Acts, Luke,
  Revelation, found by their placeholder sentence) render `DraftPage.astro`
  on the website only: the photo and limerick, computed progress ("22 of the
  24 chapters of Luke are published so far."), and ways onward. The JSON and
  intro files keep their placeholder, so the apps are unchanged and the
  "check the apps first" caution never came into play. Draft intros are also
  noindexed and left out of the sitemap and Pagefind. Reading View shows a run
  of drafts as one stub ("Chapters 23–24") and keeps every `#ch-N` anchor.
  Follow-up below: the limerick's missing line break, since fixed.

- [x] **Three draft placeholders miss a line break in the limerick.**
  `acts-7`, `revelation-2` and `revelation-12` have no `<br>` after "This
  page is on hold," so two lines of it run together. The website no longer
  shows that text (it renders the draft page instead), but the apps still do,
  from the chapter JSON. A one-character fix in each file, and a publish to
  both apps, so it's your call whether it's worth a release.
  DONE (2026-09-27, PR #224): the owner wanted it fixed. Each file gained the
  `<br>` by raw text edit, and all three placeholders now match the others.
  The drafter skips edits to draft chapters, so it writes no release-notes row.

- [x] **Search puts the usual answers last (F7).**
  Open /search with a one-line summary that doubles as jump links ("117
  verses · 47 chapters by topic · 27 introductions · 2 articles · 1 glossary
  entry"), show the matched topic on topic cards and Pagefind's excerpt on
  intro cards. Every intro currently matches "inclusion"; find out which
  indexed text causes it (the pf-meta spans are `data-pagefind-ignore`, so
  confirm rather than assume) and keep the translation's own name out of
  the index. Q1 already changed the status wording.
  DONE (2026-09-27, PR #220): the count now reads "191 results for “liberation”", and
  under it a list of jump links names each group that has results, verses
  first. A topic card names the topics it matched when they aren't the query
  itself ("Matthew 18 · lost sheep, parable of the lost sheep"), and intro
  cards show Pagefind's excerpt. The cause was metadata, which Pagefind
  searches even though the spans are ignored as body text. Four sources, all
  fixed: every intro's description meta named "the Liberation and Inclusion
  Translation (LIT)" (dropped, since nothing shows it); the "Takeaways on
  Liberation and Inclusion" heading ending 24 intros (now
  `data-pagefind-ignore`); the footer emblem, which Pagefind took as every
  intro's `image` meta, so "lit", "logo" and "ring" matched them all
  (`data-pagefind-meta="image:"` on it blanks the key site-wide); and the
  intros' topics, the same five placeholders in every file, one span per
  topic so that only "hospitality" survived (joined into one span, and not
  passed for intros until they're real). Intros matching, before → after:
  "translation" 27 → 7, "lit" 27 → 3, "inclusion" 27 → 19, "hospitality"
  24 → 4, "ring" 26 → 0. What remains is the intros' own prose. The intros
  got real topics on 2026-09-27 and pass them again; see TOPICS.md, "Book
  intros".

- [x] **Make the release notes usable (U2).**
  Link every change (needs F1), show edits as struck old text beside new,
  filter by book and kind of change, collapse older months, and publish a
  feed. `release-notes.json`'s shape is an app contract and does not
  change.
  DONE (2026-09-27, PR #222): every change links (PR #216). Each detail now shows the
  old text struck through beside the new, one line per verse or footnote
  (409 of 410 details parse; the other shows as written). Months fold, newest
  open. Each entry has a permalink id, which /read's "What's new" dates use.
  Book and kind filters keep their choice in the query string. The record is
  also an RSS feed, `/translation-updates.xml`, advertised in every page's
  head. `release-notes.json` is unchanged.

- [x] **Printing and handouts (U5).**
  A print stylesheet (no site chrome, serif text, footnotes as endnotes,
  credit line and address at the end) and a "Copy for a handout" verse-menu
  action. The owner decides whether ordinary Copy verse should also carry
  the verse link.
  DONE (2026-09-27, PR #223): `src/styles/print.css` prints a chapter, an intro or a
  whole Reading View book black on white in Crimson Text (or the reader's
  accessibility font), at 12pt times the Display tray's text size, with the
  site chrome, Previous/Next and the panels gone and the footnotes kept as the
  endnote list. `PrintCredit.astro` ends each printout with the license's
  attribution notice and the page's address ("litbible.net/john-3"), and the
  SBLGNT notice still prints under a chapter or intro. John 3 prints on five
  sheets. "Copy for a handout" in the verse menu copies the verses with their
  footnote letters kept as "[a]", the reference, each cited note, the notice
  and the verse link. The notice now lives once, in `src/lib/lit-credit.mjs`,
  which /read's license terms read as well. The owner's question needed no
  decision: Copy verse already carried the verse link, which is what the
  license's social-media clause asks for.
  Follow-up below: Reading View's SBLGNT notice, since added.

- [x] **Reading View carries no SBLGNT source notice.**
  Chapter and intro pages end with the notice crediting the SBLGNT, whose CC
  BY 4.0 license asks for attribution. `/read/<book>` has none, on screen or
  on paper, though it prints a whole book at once. The notice is written
  inline in `ScriptureLayout.astro`, which Reading View doesn't use, so the
  fix is a component both render. It adds visible text under Reading View's
  last chapter, so it is a design call as well as a license one. Found while
  adding the print credit (U5).
  DONE (2026-09-27, PR #223): the owner wants it on screen. The notice moved,
  word for word and with its styles, into `src/components/SblgntNotice.astro`,
  which ScriptureLayout and Reading View both render. It closes Reading View
  as a full-width band under the last chapter, as it does in Study View, and
  prints there too. V5 (the notice's form) stays open, and a change to it now
  reaches every page through the one component.

- [x] **No way to make a handout from Reading View, or from a selection.**
  Found by the owner after U5 shipped: "Copy for a handout" lived only in
  Study View's verse menu. Reading View has no verse menu (its numbers aren't
  controls) and no selection bar, so it offered no way to copy anything, and
  the selection bar in Study View had no handout option.
  DONE (2026-09-28, PR #228): the selection bar now runs in Reading View as well, and
  offers Copy with reference, Copy for a handout and Share… in both views.
  Reading View's verse numbers stay plain, by the owner's call: a verse menu's
  links belong to the Study View page, so the bar is Reading View's one tool,
  and every link it writes is the Study View verse link. Reading View gained
  the same per-verse spans as Study View (`data-verse`, plus `data-chapter`
  on each block) so the bar can read verses there. A handout from Reading View
  fetches the chapter's Study View page for its footnote letters and notes,
  and a partial selection keeps the letters that fall inside it plus a note on
  its last word. See CLAUDE.md, "Printing and handouts".

- [x] **Keyboard shortcuts (U4).**
  Arrow keys (or `[` and `]`) for previous and next chapter, `/` to
  focus search, `g` for Go to passage. Ignore them while typing or with a
  modifier held, and list them in the Display tray.
  DONE (2026-09-28): `src/scripts/keyboard-shortcuts.js`, on by default with a
  Keyboard switch in the Display tray (`lit-shortcuts`), which single-key
  shortcuts need under WCAG 2.1.4. The arrows work in Study View (the top
  Previous/Next, now `rel="prev"`/`rel="next"`) and Reading View (the next
  `#ch-N`), and stand down when the page scrolls sideways. The privacy page's
  storage paragraph names the switch. See CLAUDE.md, "Keyboard shortcuts".

- [x] **Missing doors in the menus (U6).**
  A search icon beside "Aa" that opens the existing search tray on every
  page (V3's title swap now leaves room for it; recheck at 1240–1440px), and
  Glossary, Articles and "What's new" in the footer, Support in the phone
  menu.
  DONE (2026-09-28): pages without a search box of their own get the icon; it
  opens a strip under the header holding the ordinary SearchBar (a link to
  /search without JS). On desktop it sits beside Aa below Read Now, so the nav
  loses no width. Under 360px it moves into the phone menu as "Search", since
  the short title ran into three buttons at 320px. The footer's Learn column
  gained Glossary, Articles, Read and What's new, and the phone menu Support;
  the menu now tightens its gaps on short screens and scrolls rather than
  cutting off its ends. See CLAUDE.md, "Every page has exactly one way in".

- [x] **Leftover shapes on /search and /articles (V6).**
  Filters in one left-aligned row under the query, Go to passage above the
  box at every width, the decorative bar reduced to a hairline or removed,
  and the newsletter card moved below the featured article.
  DONE (2026-09-28), in part, as the owner decided. The filters sit at the
  left of every search tray now (a leftover `margin-left: auto` pushed both
  menus right), and the /articles bar is a hairline. Go to passage stays
  beside the box: it is there on purpose, and the tablet problem the audit
  saw no longer happens (checked from 375 to 1280px). The newsletter strip
  stays where it is.

- [x] **Search the footnotes (X4).**
  A notes index built with the site and loaded on demand (the verse index's
  shape), shown as its own group, so "kingdom" finds the notes explaining
  "reign"; plus a page of the notes that begin "Traditionally", grouped by
  the traditional word. The owner confirms it's wanted first.
  DECIDED (2026-09-28): not now, for either half. The search half isn't ruled
  out for good; the "Traditionally" page is declined. For whoever reopens the
  search half: the notes come to about 385 KB compressed, more than the whole
  verse index, so Pagefind custom records (chunked, loaded per query) fit
  better than one file, and a note stored in several chapters should show
  once.

- [x] **Revision history on each chapter (X7).**
  "Revised September 21, 2026 · see changes" under the title, opening that
  chapter's entries from `release-notes.json` (most carry a `location`).
  DECIDED (2026-09-28): no. The record already lives on the release notes
  page, which /read links. Don't re-propose it without new reasons.

- [ ] **Verse images for sharing (X8).**
  "Make an image" in the verse and selection menus, drawn in the browser in
  the share-card design (square and story sizes, carrying litbible.net).

- [x] **Copy link beside each glossary entry (Q4).**
  The anchors exist (`/glossary#<id>`) but nothing shows how to share one.
  DONE (2026-09-28): a link icon beside each entry heading, outside the h2 so
  the heading's name and the Pagefind index are unchanged. Without JS it is an
  ordinary link to the entry; with JS a click copies the full address, shows a
  check for two seconds and says so to a screen reader
  (`src/scripts/glossary-entry-links.js`). Hidden in print.

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

- [x] **(F7) Continuity / disaster-recovery doc.**
  DONE (2026-07-18, owner supplied the dashboard facts live): wrote
  `DISASTER-RECOVERY.md` at the repo root, SPLIT for privacy since the repo
  is public (owner decision): the committed doc holds everything structural
  (dashboards, secret names, DNS inventory, redeploy path) while specific
  login addresses, the password-vault location, and recovery contacts live
  in a private "LIT Bible — Accounts & Recovery" doc in the Collective's
  Google Drive, which the repo doc points to. Beyond the item's original
  list it captured: a seventh secret the item missed (`RELEASE_NOTES_PAT`, the GitHub
  Actions fine-grained PAT that lets release-notes.yml push to main); Google
  Workspace as the actual mail host (MX → Google — Cloudflare Email Routing
  is send-side only, powering the Worker's send_email binding); the registrar
  (Porkbun, under the owner's personal identity, NOT the litbible one);
  a "dependency chain" section documenting that the primary admin identity
  is the master login/vault for Cloudflare+GitHub+Brevo while its own mail
  depends on the Porkbun registration + Cloudflare zone + Workspace
  subscription (mitigations confirmed in place); the full 22-record DNS
  inventory captured verbatim from live DNS (public data, safe to commit),
  which surfaced integrations the repo knew nothing about — a Resend/SES
  sending domain on send.litbible.net (purpose TODO, owner to fill), a
  Bluesky handle verification, an A2A agent-discovery SVCB record, and an
  OpenAI domain verification; and the fact that the Brevo subscriber list is
  the one dataset with no second copy (no export kept, noted plainly).
  Follow-up same day: the two TODOs resolved — the Bluesky handle
  (@litbible.net) belongs to the primary admin identity, and the Resend
  sending domain is BDR's (mobile-app development side), recorded like
  RedCircle as BDR-managed.
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

### Added from the 2026-09-26 feature audit

Details for each item are in the artifact (https://claude.ai/artifact/4ghJK72rd2thnCX2mdmXkZ); the IDs match. These
need a mockup or a side-by-side the owner looks at before code.

- [x] **Scripture starts low on a phone (F3).**
  Fold the phone toolbar into one row (passage picker, a search icon that
  expands in place, a Reading View icon), make the top Previous/Next quiet
  chevrons beside the title, and aim for the first verse inside the top 40%
  of the screen. Mock it up first.
  DONE (2026-09-28, PR #230): the owner picked the recommended variants at the Phase 3
  checkpoint: an icon-only Reading View button, ‹ › beside the title, and one
  row on tablets too. Romans 8's first verse now starts 35% of the way down an
  Android phone with the app banner (was 66%), 27% on an iPhone (was 58%) and
  33% at 768px (was 38%). Desktop is unchanged, and without JS a phone keeps
  the old stack. The dead `[data-search-root]` script went with it.

- [x] **Line length and one Display panel (V1 with U1).**
  Bring Study View's column to about 58–62 × `--ch` and give Reading View
  the same measure and at least 18px type; then one Display panel on every
  page (font, text size with an XL step, line spacing, theme, and verse
  number and footnote marker toggles on scripture pages), applied before
  first paint. Change only the multiplier, never the per-font `--ch`.
  `--content-width` also sets /read, /search, About and the commitments
  page, so review those together. Compare side by side before shipping.
  DONE (2026-09-27, PR #219): a new `--reading-width` token (`--reading-measure` × `--ch`)
  sets Study View, intros, Reading View and article bodies. The owner picked 60
  from side-by-side screenshots at 72, 62, 60, 58, 56 and 54: about 77
  characters a line in Inter and 85 in Atkinson, down from 92 and 102. The
  article card now narrows with its text. `--content-width` stays at 72 for
  /read, /search, About, courses and the commitments page, which aren't
  long-form reading. The header's Display tray gained text size (S, M, L, XL),
  line spacing (Normal, Roomy), and on scripture pages a "Show" group for verse
  numbers and footnote letters, all stamped on `<html>` before first paint.
  Reading View's own Aa panel and Numbers button are gone; its toolbar Aa opens
  the same tray, and its old settings carry over. Reading View's default type
  is now 18px, the same as Study View. Hidden verse numbers and footnote letters
  stay focusable, so `#v16` and the keyboard verse menu still work, and the
  tray holds the reader's line in place when a setting reflows the page.

- [x] **Term lens (X1).**
  A quiet underline under glossary renderings in Study View opening a card
  (traditional word, Greek, other renderings, glossary link), built from the
  reviewed alignment data behind the same publishing gate as /glossary. Owner
  decides density and whether it's on by default.
  DONE (2026-09-28, PR #232): at the Phase 3 checkpoint the owner picked every use
  over the first of each term, the card as mocked up, on by default with a
  Key terms box in the Display tray, Study View only, and no tab stops. The
  /glossary display gate moved into `src/lib/alignment-gate.mjs` so both read
  one rule; the built /glossary page is byte-identical. 4,326 of 4,328 marks
  land on the right words across the 208 published chapters, and the other
  two were record errors fixed in the data.

- [x] **Reference previews (X2).**
  DONE (2026-09-27, PR #216): `src/scripts/ref-preview.js`. Hover with a mouse, or tap on
  a touch screen, to see up to six verses and "Open John 3 →"; a mouse click and
  the keyboard still follow the link. Text comes from per-chapter files that
  `build:verses` now writes (`public/search/chapters/`, ~2 KB each), not the
  280 KB index. The Study View panel code moved to `src/scripts/lit-panel.js`
  so the preview and the verse menu share one panel.

- [x] **"Go deeper" after each chapter (X3).**
  A short panel: the podcast episode on the chapter, articles that discuss
  it, glossary terms in it, and the book intro. Mock up first.
  DONE (2026-09-28, PR #233): `GoDeeper.astro` under every published chapter, after
  Previous/Next and above the notes (the owner's pick of the two
  placements), with Listen, Read, Key terms and Book rows. Every chapter has
  Key terms, 186 the intro, 81 an episode and 33 an article. Past two
  episodes or three articles the rest sit behind an "N more" disclosure
  rather than being cut, as the owner asked.

- [x] **Make /read a library (X12).**
  A visible table of contents: books grouped, each with a line from its
  intro, its status, and chapter links. Mock up first.
  DONE (2026-09-28, PR #233): the owner decided against it at the Phase 3 checkpoint,
  after seeing it built (cards on desktop, a row per book on phones, three
  groups). Nothing shipped. Don't re-propose it without new reasons.

- [ ] **Side notes on wide screens (X11).**
  At 1280px and up, each footnote's first line in the margin beside its
  verse. A design exploration.

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
- [x] **Web Analytics follow-up: enabled in the dashboard, but no beacon in
  the served HTML.**
  CLOSED (2026-07-27) — **the premise was a measurement artifact; Web Analytics
  works and always did.** The owner produced a dashboard screenshot showing Web
  Analytics for litbible.net with 34 visits / 44 page views in 24h and
  **populated Core Web Vitals (LCP/INP/CLS)**. CWV is decisive: it can ONLY come
  from the RUM beacon, since edge/Traffic analytics cannot measure it.
  **Root cause of the false finding:** Cloudflare **edge-injects** the beacon
  (so it is in no source file in this repo) and **skips injection for
  non-browser user agents**. A plain `curl` therefore gets a beacon-free page.
  Proven by controlled fetch: same URL, curl UA → 48,366 bytes, no beacon;
  browser UA → 48,725 bytes, and the 359-byte delta is exactly the
  `static.cloudflareinsights.com/beacon.min.js` tag with its `data-cf-beacon`
  token. Both the 2026-07-16 audit and a 2026-07-27 recheck fell into this.
  **Lesson worth keeping:** never conclude an edge-injected script is missing
  from a non-browser fetch. `public/_headers` now carries a comment saying so.
  **The CSP half WAS real and is fixed in the same change:** the beacon has been
  loading in production while absent from the report-only allowlist, so it was
  logging violations on every page view and the allowlist under-claimed. Added
  `https://static.cloudflareinsights.com` to `script-src` and
  `https://cloudflareinsights.com` to `connect-src`.
  Also note `privacy.astro`'s Cloudflare Web Analytics disclosure is accurate as
  written; no change needed there.
  Original item text below.
  The 2026-07-16 audit fetched the live homepage and found
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

- [x] **Enable native Dependabot security alerts (no version-update PRs).**
  DONE (2026-07-27): owner enabled Dependabot alerts in the repo settings.
  Repo Settings → Security → Dependabot alerts. Surfaces known
  vulnerabilities (email/GitHub notification) with zero recurring owner
  effort — no `dependabot.yml`, no weekly version-bump PRs to review/merge.
  Chosen over a full `dependabot.yml` (routine PRs every week) or a scheduled
  `npm audit` CI workflow (still needs someone to notice failures) because it
  directly closes the "advisories only surface when someone remembers to run
  `npm audit`" gap with the least ongoing owner overhead. One-time toggle,
  no code change.
  FOLLOW-UP (2026-07-28): owner also enabled **Grouped security updates**
  (Settings → Code security), so advisory-driven PRs arrive as one PR per
  ecosystem per directory instead of one per advisory. Also a settings-only
  toggle — `dependabot.yml`'s groups are `applies-to: version-updates` and
  don't touch that track. Caveat recorded in the config header: a grouped
  security PR can include a major bump, since security updates ignore the
  `update-types` filters.

- [x] **Newsletter email compliance (CAN-SPAM).**
  CLOSED (2026-07-27, owner decision): that campaign was the FIRST newsletter,
  sent while the process was still being worked out, and the owner is not
  concerned about it retroactively. The Brevo-footer question below was
  therefore not chased. Future campaigns are expected to carry the required
  footer.
  **Why this can't recur (owner, same day):** subsequent newsletters are
  authored **in Brevo's editor, not in this repo**. Brevo's editor supplies the
  unsubscribe link and the campaign footer itself, so the compliance gap was
  specific to that one hand-built HTML campaign. `emails/pentecost-2026.html` is
  therefore an **archive of a one-off**, not a template anyone should copy — it
  is the only file in `emails/` and it does end in raw markup with no
  unsubscribe link and no postal address (verified 2026-07-27), which is exactly
  why it shouldn't be treated as a starting point. CLAUDE.md's `emails/` line
  was corrected to say so. The two copy nits below are recorded for the record
  only; they don't apply to Brevo-authored sends.
  Original item text below.
  The committed campaign
  template `emails/pentecost-2026.html` ends with a copyright line only — no
  unsubscribe link and no physical postal address, both legally required in
  marketing email. Verify in the Brevo dashboard whether Brevo appends its
  own footer to custom-HTML campaigns (if it does, past sends are fine); for
  future templates, bake in an unsubscribe link (the site has `/unsubscribe`,
  but Brevo's `{{ unsubscribe }}` tag is the reliable per-recipient one) and
  the org's mailing address. Two copy nits in that template for next time:
  "poured about the Sacred Life-breath" (likely "poured out") and "in the
  the work LSC is doing" (doubled "the").
- [x] **Decide Astro 7 timing.**
  DONE (2026-07-28): decided **now**, and executed — see **(O16)** under Opus.
  The item's premise had gone stale: by 2026-07-28 `npm audit` reported **8
  vulnerabilities (1 low, 1 moderate, 6 high)**, not the 2 low-severity ones
  recorded here, and three of the highs were in Astro itself (view-transition
  and `renderHTMLElement` XSS, fixed in ≥7.0.10). Real exposure for *this* site
  was still ~nil — no view transitions, no hydrated islands, no framework
  renderers, fully prerendered, no user input reaching the renderer — so this
  was never an emergency. But "only the local dev server is exposed" had
  stopped being an accurate description, which is what the deferral rested on.
  Original item text below.
  `npm audit` shows 2 low-severity advisories
  (esbuild dev-server file read on Windows, via Astro ≤6) whose only fix is
  the breaking Astro 7 upgrade. Exposure is the LOCAL dev server, not the
  shipped site, so this is not urgent — but decide when to schedule the
  upgrade (an Opus item once decided; 7.1.0 is current as of 2026-07-16).
- [x] **Confirm the Apple Pay domain file is still needed.**
  KEEP (2026-07-27). The item said to delete it "if the integration that
  required it is gone" — it is not gone, so the file stays. Evidence:
  (1) `src/pages/support.astro:21` still loads the GiveLively donation widget
  from `secure.givelively.org`, and `:121` still renders its mount div;
  (2) the commit that added the file, `c741a05`, is titled "add Apple Pay
  domain association file for GiveLively"; (3) the file decodes (hex → JSON) to
  a valid Apple Pay merchant domain association — `pspId`, `version: 1`,
  `createdOn` 2024-05-08, and a 4418-char PKCS#7 signature. Note the format
  carries **no expiry field**, so it cannot go stale in the repo on its own;
  validity lives in Apple's certificate and the PSP-side registration. Deleting
  it would break Apple Pay in the donate flow and re-verification needs
  dashboard access, so the asymmetry favors keeping an inert public token.
  Residual (owner-only, not blocking): nobody has confirmed Apple Pay still
  *appears* in the GiveLively checkout. Open /support in Safari on an Apple
  device and look. That is the same unexercised payment step F2 flagged for its
  report-only CSP origins, so both could be checked in one pass.
  `public/.well-known/apple-developer-merchantid-domain-association` —
  presumably GiveLively's Apple Pay verification. Confirm it's intentional
  and current; delete it if the integration that required it is gone.
- [x] **Decide where `/apps` should surface.** The strongest conversion page
  on the site is footer-only ("Learn" column). If the app beta push matters,
  give it a header nav slot or a homepage question-card; once placement is
  decided, implementation is Sonnet-sized.
  DONE (2026-07-23, owner-decided): the "footer-only" premise was already out
  of date. `/apps` surfaces in three places: the footer "Learn" column, the
  sitewide `AppsLaunchPopover` (auto-shows on the 2nd+ pageview, "Get the app"
  CTA), and a contextual view-card on `/read`. So rather than rescue a
  neglected page, we added one durable, on-voice, high-traffic surface: a
  **homepage question-card**. Because a 4th card orphans a row in the existing
  3-column `.questions-grid`, the owner chose to round the block out to **six**
  cards, also adding cards for the **Liberating Scripture Collective** and
  **Articles** — six auto-flow into a clean 3×2 with zero grid rework. New
  Apps/LSC media are icon/logo tiles (`lit-app-icon-ios.webp`; a new
  `lsc-logo-square.webp`, resized from the heavy 2200px PNG per the WebP
  convention). **Rejected:** a header nav slot (crowds the content-focused nav,
  worsens title truncation, must be triplicated across desktop/no-JS/mobile,
  and is redundant with the sitewide popover) and a secondary CTA beside the
  "really good stuff" callout (dilutes a deliberately single-CTA moment).
- [x] **Decide whether a verse number may visibly repeat on a continuation
  paragraph** (raised 2026-08-08 while fixing the bracket-marker leak in the
  search index; PR did *not* touch chapter JSON, by design). Two published
  chapters do it via a suffixed id: `john-7.json` p18 `id="v41b"` and
  `john-8.json` p8 `id="v11b"`, each re-showing the number when a verse spans a
  paragraph break. They are the only two corpus-wide.
  **Why it needs you:** whether the number repeats is typographic/editorial, not
  technical. Three shapes exist and only one is documented — `unique_verse_ids`
  in `scripts/chapter_json_invariants.json` says a continuation paragraph
  carries *no* marker; `dropDuplicateVerseIds()` in `src/lib/chapter-html.ts`
  handles a *repeated* one (but there are zero duplicate ids in the corpus, and
  its cited example, Mark 14:62, no longer spans a break, so it has no live
  input); the `b` suffix is a third shape that slips past the validator, whose
  scan (`/<sup id="v(\d+)" class="vn"/`) can't see it at all.
  **What it currently costs** (all reproduced, none fixed by that PR):
  1. A stray digit ships in the search index — John 8:11 reads
     `…she said. 11 So Jesus said,…`. Attribution is otherwise right.
  2. `addOsisIds()` requires `id="v(\d+)"`, so that one `<sup>` gets no
     `data-osis` while every sibling verse number has one.
  3. Reading Mode doesn't namespace it: `/read/john` emits
     `<span class="rm-verse-anchor" id="v41b">` beside `id="john-7-v42"`. No
     collision today; nothing links to it.
  4. **Worst one — the changelog reaches the apps.**
     `extractVerseTexts` drops the continuation chunk entirely, so a real
     one-word edit to John 7:41's continuation emitted
     `"John 7:42 — text updated"` with no detail: a wrong verse reference in the
     apps' Translation Updates feed.
  Study View is unaffected (`wrapVerseSegments` reads the sup's visible digits,
  so `data-verse="41"` is correct).
  **Roughly, the options.** (a) Keep the repeat and make it a supported shape:
  pick one canonical form, teach the four regexes and the validator about it,
  document it in the invariants file. (b) Drop the repeat: remove the two
  `<sup>`s so the continuation carries no marker, matching the documented rule
  and every other chapter. (c) Leave as-is and accept the four costs. Once you
  choose, the code side is Sonnet- or Opus-sized depending on which.
  DONE (2026-08-09, owner chose (b) *plus* a real solution for what the suffix
  was reaching for). The owner's recollection was that it existed to make part
  of a verse separately shareable — a quotation set apart from its
  introduction. Two findings settled it. (1) **The suffix never delivered
  that:** verified on the live page, tapping *either* "11" opened the same
  menu, copied the whole of verse 11, and linked `#v11`, because
  `wrapVerseSegments` wraps both paragraphs as `data-verse="11"`. (2) **The
  shape it was aiming at is a block quote continuing a verse** — 19 published
  cases (1 Peter 2:6, 1 Timothy 3:16, 1 Corinthians 6:18 …), none using a
  suffix, and every one already carrying a stable, book-namespaced anchor on
  the blockquote itself. The anchor infrastructure existed and sat unused; only
  the affordance was missing.
  Shipped: both `<sup>`s removed, so those paragraphs now match the 187 silent
  continuations (John 8:11's continuation now matches John 8:12's, two
  paragraphs below it on the same screen); a `no_suffixed_verse_ids` validator
  rule so it can't return unnoticed; and an **"Or copy one part"** group in the
  verse menu — one button per block, copying that part's text + reference +
  `#<block-id>`, with those anchors now highlighting on arrival the way `#v16`
  does. A block-quote part keeps its line breaks. Fixed in passing: bracket
  markers were leaking into Copy verse / Share… (Mark 16:8 shared as
  `…afraid. [|`), a third consumer the earlier index fix missed, now behind the
  shared `src/lib/bracket-markers.mjs`. Two stray "words" — literally `11` and
  `41` — fell out of the search vocabulary as a result.

- [x] **Decide whether "Copy verse" should keep poetry line breaks too.**
  DONE 2026-09-06 (owner: yes, align them). "Copy verse" and "Copy verses"
  now keep a poetry quotation’s line breaks, matching the per-part copy that
  shipped 2026-08-09. 1 Peter 2:6 copies as its lede then four lines instead
  of the run-on `…in scripture: Look, I placed a stone in Zion A valuable,
  choice…`. The rule lives in one place now — `joinSpanText` in
  `src/scripts/chapter-tools.js`, which `verseParts` also uses, so the whole
  verse and its parts can no longer disagree: a newline falls at every
  boundary touching a poetry block (between its lines, and between it and the
  prose leading in or out), everything else joins with a space. Prose
  paragraph breaks are deliberately untouched (1 Corinthians 3:9 still copies
  as one line). Ranges got the same treatment for coherence: a verse ending
  inside poetry keeps the break before the next verse number, so 6–7 no
  longer welds `shamed. 7 Therefore` onto a poetry line.

- [x] **Fix `<br>` poetry lines, which today copy with NO separator at all.**
  DONE 2026-09-25. `blockText` in `src/scripts/chapter-tools.js` now swaps each
  `<br>` for a U+2028 marker, and `cleanForShare` collapses whitespace per line
  and joins the lines with `\n`. It uses a marker rather than keeping `\n` as
  proposed below, so incidental source whitespace can never become a line
  break. A span containing a `<br>` also counts as set in lines for joining
  (`isSetAsLines`, kept separate from `isPoetry`, because only `hbq` claims a
  quotation), so it gets poetry's newline on both sides. 2 Corinthians 6:2 now
  copies as the prose lead-in, then its two lines, each on its own line. The
  part button's label flattens the break to a space. Verified in the browser on
  Copy verse, the part copy, and the 2–3 range, with 1 Peter 2:6, 1
  Corinthians 3:9 and John 3:16–17 unchanged.
  (Found 2026-09-06 while doing the item above; narrowed the same day.) Not all
  poetry is set as an `hbq` blockquote: some lines are broken with a bare `<br>`
  inside one paragraph. `blockText` reads `textContent`, which drops a `<br>`
  entirely, so 2 Corinthians 6:2 copies as `…a welcome time!Look! Now is the
  Day…` — two sentences welded into one word. **Scope is now one published
  verse.** Romans 3 and Romans 9 were the other two, and both were quoted
  scripture, so they became `hbq` blockquotes instead (see "Poetry blocks" in
  CLAUDE.md) and copy correctly. 2 Corinthians 6:2 stays a plain paragraph
  deliberately — its two lines are Paul's own application, not the Isaiah
  quotation — so it is the one case the code has to handle. The fix is not
  local to `blockText`: `cleanForShare` collapses `\s+` to a space, so it must
  learn to preserve a newline (`[^\S\n]+` then `/ *\n\s*/`), which also touches
  the shipped per-part copy and the `plain` button labels (flatten those
  separately). Sonnet-sized; verify by copying 2 Corinthians 6:2.

- [x] **The changelog's text extractor welds words across every block boundary.**
  DONE 2026-09-06 (found and fixed the same day, while converting the Romans
  poetry blocks). `stripHtml` in `scripts/lib/release-notes-core.mjs` removed
  every tag with `.replace(/<[^>]+>/g, "")` — substituting nothing — so text ran
  together across any block boundary, while `scripts/lib/verse-text.mjs` maps
  `p|blockquote|br` to a space and did not. The two extractors are separate by
  design and had disagreed on this for as long as `hbq` has existed: 1 Peter 2:6
  extracted as `ZionA valuable, choice` and the 1 Corinthians 11 fn-b chiasm as
  `teachingsB:Verse 3`. Both sides of a diff weld identically, which is why it
  hid — it surfaced only when a change moved text ACROSS such a boundary, as
  `"people and"` → `"peopleand"` on an edit that changed no word. That mattered
  because `release-notes.json` is the apps' Translation Updates feed. Fixed by
  substituting a space for `p`/`blockquote`/`div`/`br` before the general strip;
  **inline tags must keep vanishing**, since Word splits styled phrases mid-word
  (`<em>ekd</em><em>emeo</em>` has to rejoin), so the asymmetry is the fix and
  four golden tests in `test/draft-release-notes.test.js` pin both halves.
  **Scope note:** this fixed the garbled `detail` only. A markup-only structural
  edit still emits a bare `text_updated` row, from the separate paragraph-level
  fallback in `buildChanges` — that is deliberate, and is why the 2026-09-06
  entry in `release-notes-skip.md` was still needed. See the next item.

- [x] **Decide whether a block-structure change should read as "metadata
  updated" rather than "text updated".** DONE 2026-09-06 — owner ruled
  **neither**: "formatting only changes shouldn't make it to the release notes."
  The paragraph-level fallback in `buildChanges` compared `normalizeMarkup`,
  which strips *attributes* but keeps *tags*, so a change of tags read as a text
  edit — the apps would have shown "Romans 3:11–31 — text updated" for a publish
  in which no word changed, and the range was wrong too, because the comparison
  ran per index and merging two paragraphs shifted every paragraph after it. It
  now compares **extracted text**, joined so a paragraph-count change does not
  cascade. A chapter edit that moves no visible character emits *nothing*, and
  that deliberately includes the attribute-only case that used to produce a
  "metadata updated" row: one such row has ever shipped, against a batch of 15
  the owner suppressed by hand, so this is that suppression made automatic. A
  genuine metadata edit (paragraphs and footnotes byte-identical,
  `title`/`description`/`topics` moved) keeps its row. **Two things the change
  deliberately does not swallow**, both with tests: a bracket-only edit, since
  `⟦`/`⟧` are visible characters and `stripBracketMarkers` is not applied to
  this comparison; and anything the per-verse split cannot see, which is the
  whole reason the fallback exists.

- [x] **Consider sharing any selected text, not just whole blocks.**
  DONE 2026-09-25. Selecting scripture text on a chapter page now offers Copy
  with reference and Share…. Owner picks, from an options write-up: the panel
  floats just above a mouse selection and beside a touch selection, on the
  side the phone's own bubble isn't using. A bottom-edge bar for touch was
  tried first and dropped after the owner tested it on a phone: it was easy to
  miss and covered selections near the bottom. The reference uses plain verse
  numbers covering every verse touched, never "16a"; the link is the ordinary
  verse link, not a text fragment; ordinary Copy is left alone. The selection
  joins through the same `joinPieces` rule as the verse menu, which that rule
  was extracted into for this. A capture of every Copy verse, adjacent-pair
  range, and part copy across 15 chapters (1,172 outputs) matched byte for byte
  before and after. Selecting whole verses copies exactly what Copy verses
  does. Mid-word edges snap to whole words, and verse numbers and footnote
  letters never leak into the text. See "Sharing a selection" in CLAUDE.md.
  The touch clearances for the drag handle and the OS bubble are estimates,
  since no API reports where the OS draws its menu. Check them on a phone if
  the panel ever meets the bubble.
  (Raised 2026-08-09 alongside the part-sharing work; the owner picked the
  block-level approach for now and asked to keep this on the list.) Today a
  reader can share a whole verse, a verse range, or one block of a verse. The
  general form is: select any run of text, get "Copy with reference" — which
  handles a half-sentence, a phrase spanning two verses, or part of a poetry
  quotation, none of which the block-level menu reaches. Substantially bigger
  than what shipped: it needs selection tracking, working out which verses a
  selection spans (the `data-verse` spans make this tractable), building the
  reference string for a partial range, and a mobile story that doesn't fight
  the OS text-selection UI. Opus-sized, with design input on where the
  affordance appears.

### Added from the 2026-09-26 feature audit

Details for each item are in the artifact (https://claude.ai/artifact/4ghJK72rd2thnCX2mdmXkZ); the IDs match.

- [x] **App promotion rules (F5, the rest).**
  The privacy paragraph shipped in Phase 1 (2026-09-26). Still to decide: no launch modal on phones, where a banner already makes the pitch;
  no modal on chapter or Reading View pages; a QR code beside the desktop
  button; and one shared dismissal for the modal and the Android banner.
  (Phase 1 also widened the O3 verse-link guard to ranges, part links and
  Reading View verses, which enforces the existing rule.)
  DONE (2026-09-28, PR #231), as the owner decided at the Phase 3 checkpoint. "Not
  over scripture" became a rule for every announcement, and the rules every
  announcement shares moved into `src/scripts/announcement-gate.js`
  (`shouldAnnounce`), which the retired WelcomePopover now calls too. The
  phone rule was declined, so the app announcement still opens on phones, and
  in its place the modal and the Android banner share one dismissal: each reads
  the other's flag, so nothing new is stored and the privacy page stands. On a
  computer the modal shows a QR code to /apps (`npm run build:apps-qr`).

- [x] **/read copy once F1 ships (Q3, second half).**
  DONE (2026-09-27, PR #216): no rewording needed. With F1, the references in Study
  View's footnotes link and preview, so "footnotes and cross-references" is
  true as written.

- [ ] **Footnote letters outshine verse numbers (V4).**
  Regular weight and slightly smaller? A look decision.

- [ ] **The source notice after every chapter (V5).**
  One attribution line plus a "Source text and license" disclosure, as /read
  does. Check the SBLGNT license's attribution wording first.

- [ ] **Straight and curly quotes in page prose (V7).**
  A one-time pass over page prose, two intros and the search help text; it's
  your prose, so say go. Any render-time smart-quote step must skip the
  glossary feed, which keeps straight quotes for iOS.

- [ ] **Article page title suffix (Q6).**
  Articles end "| Articles | The Liberation & Inclusion Translation" while
  other pages end "| Liberation and Inclusion Translation". Keep it if
  deliberate.

- [ ] **Decide which ideas to build (X5, X6, X9, X10, X13, X14, X15).**
  X5 "This Sunday" lectionary page (shares lectionary data with the apps);
  X6 browsable topic pages; X9 Listen in the device's voice; X10 opt-in notes
  at passages with a history of harm (editorial, in your words); X13
  bookmarks kept on the device (web versus apps); X14 linking Hebrew Bible
  references to an outside text (after F1; your choice of source); X15
  "tell me when Acts is published" (Brevo setup, pairs with F4). Each becomes
  an Opus or Fable item once decided.
  X14 decided 2026-09-28: yes, linking to Sefaria with a map from English to
  Hebrew verse numbers; built in its own PR. The rest are still open.

## Completed from TBD

- [x] **Consolidate email capture.** The `/courses` Formspree signup (a
  pre-Brevo vestige, per the owner) was removed; the Email Updates section
  now points to the footer's Brevo newsletter form. The contact form stays on
  Formspree until F1 ships.
