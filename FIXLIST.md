# Site Audit Fix List

From the comprehensive audit of 2026-07-07 (developer, QA, SEO, end-user, editor,
marketing, accessibility, HR/governance, and security passes). The seven
**Priority** fixes are done (commit `9e3a875`). Remaining items are grouped by
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

## Opus — one session per item

- [ ] **(O1) Article metadata upgrade.** Articles currently ship
  `og:type=website`, no per-article JSON-LD, and `twitter:card=summary` even
  with hero images. In `src/layouts/Layout.astro`, add optional props
  (e.g. `ogType`, `twitterCard`) defaulting to current behavior; in
  `src/pages/articles/[...slug].astro`, pass `ogType="article"`,
  `twitterCard="summary_large_image"` when `heroImage` exists, emit
  `article:published_time` (from `data.date`), and add a `BlogPosting`
  JSON-LD block (headline, description, datePublished, author from
  frontmatter `author` or "Brandon C. Vélez Johnson", image when heroImage,
  publisher = Liberating Scripture Collective, url). Acceptance: view-source
  of one article shows all new tags; non-article pages are byte-identical in
  the head except untouched; `npm run build` passes.

- [ ] **(O2) Rename the ambiguous `index` prop.** `Layout.astro` uses `index`
  (Pagefind body opt-in) + `noindex` (robots); `ScriptureLayout.astro` uses
  `index` for ROBOTS; `ReadLayout.astro` forwards `index` to Layout's
  Pagefind meaning. Rename to unambiguous names (suggest `pagefindIndex` and
  `robotsNoindex`/`robotsIndex`) across ALL layouts and callers (grep for
  `index=` in src/pages and src/layouts). Behavior must be identical.
  Acceptance checklist after build: draft chapters (e.g. any
  `indexed:false` chapter) still emit `noindex,follow`; `/search`, `/404`,
  `/unsubscribe` still noindex; glossary + articles + intros still appear in
  the Pagefind index (`dist/pagefind/` exists and search works in preview);
  scripture chapter pages still are NOT Pagefind-indexed.

- [ ] **(O3) Rein in the welcome popover.** `src/components/WelcomePopover.astro`
  currently shows on ANY first pageview (cookie `lit_welcome_v2`), including
  shared verse deep links, and counts as an intrusive interstitial for mobile
  search entrances. Change the show condition to: homepage only
  (`location.pathname === "/"`), OR (better) any page on the visitor's
  second+ pageview — track a session pageview count in sessionStorage.
  Never show when `location.hash` matches `#v\d+` (arriving at a shared
  verse). Keep the cookie dismissal logic unchanged. Acceptance: first visit
  to `/john-3#v16` shows no popover; homepage first visit shows it; dismissal
  still persists 30 days.

- [ ] **(O4) Unit tests for search-core.** `src/scripts/search-core.js`
  (~1,100 lines) has zero tests. Use Node's built-in `node:test` runner (no
  new deps). If the module imports browser globals at top level, do the
  minimal refactor to keep pure logic importable in Node (no behavior
  change). Cover at minimum: book-alias + reference parsing ("John 3:16",
  "1 cor 13", "jn 3:16-18", bare book names), verse-index scanning
  (whole-word + phrase + diacritic folding: "lema" matches "lemá"),
  `rankVerseHits` ordering (exact form above related, more occurrences above
  fewer), and `nearestVocabWord` conservatism (corrects "jeribulem"→
  "jerusalem"; does NOT correct short/quoted tokens). Add `"test"` script to
  package.json and a test step to `.github/workflows/ci.yml` before the
  build step.

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

- [ ] **(O6) White-on-green button contrast sweep.** #209D50 with white text
  is ≈3.5:1 — passes WCAG only as "large text" (≥18.66px bold, or ≥24px any
  weight). For each remaining `--green`-background control — header "Read
  Now" CTA (global.css), chapter Previous/Next buttons
  (`ScriptureHeader.astro` — hardcoded `#209d50` + white text), the
  SearchBar submit button (`SearchBar.astro` `.searchbar__submit`, green bg
  + white arrow icon — NOTE: only rendered at ≤900px viewports, so test at
  narrow widths or it will be missed; icon-only controls need 3:1 for the
  graphic, not the text rule),
  search page buttons (`search.astro`), intro-page CTA
  (`[book]-intro.astro`), home question-card CTAs + callout CTA (home.css /
  global.css), 404 CTAs (`404.astro`), podcast page buttons
  (found-in-translation-podcast.css), courses signup link (courses.css uses
  white bg — skip), articles newsletter Subscribe button + article CTA
  (`articles.css` `.btn`/`.btn--cta` — the Subscribe button measured failing
  at 13.3px white-on-green during F5), contact submit (contact.css),
  unsubscribe submit (unsubscribe.css — already ink text, just verify) —
  measure the computed font-size/weight in dev tools,
  and either (a) leave it if it qualifies as large text, or (b) switch its
  background to `var(--green-text)` like `.chapter-cta`. Record the verdict
  per button in the commit message. The green page hero backgrounds were
  handled by F5 (ink text on green — done); don't re-touch those surfaces.

  **Addition — note the `::selection` green.** The site's text-selection
  highlight (`::selection` in global.css) uses `var(--green)` as the
  background, matched by the ported `/apps` page. Owner likes this and it
  should stay; call out its contrast (selected text color against the green
  highlight) in the audit alongside the other green-background surfaces above,
  since it's a green-bg + text case this item would otherwise miss.

  **Addition — white vs. near-white audit.** The 2026-07-12 brand-surface
  rebrand (see `--surface-raised` in global.css) softened *raised surfaces*
  from pure `#FFFFFF` to near-white `#FAFAF8` (and the dark surfaces to a
  deeper near-black) site-wide, deliberately leaving white-as-TEXT-or-graphic
  (green/dark-mode CTA labels, toggle knobs, hamburger bars, etc.) untouched.
  As part of this item, sweep the codebase for any remaining stark `#FFFFFF`/
  `#fff`/`white` **surface** usages that were missed by that rebrand (search
  `src/styles/**/*.css` and component `<style>` blocks) and soften them to the
  near-white token if contrast still holds at the new value — same rule as
  before: surfaces and body text are fair game, text/graphics-on-color are not.

- [ ] **(O7) data-theme toggle — GATED on the Owner decision below.** If the
  owner wants it: add a light/dark toggle to the "Aa" tray in
  `SiteHeader.astro` (three states: system/light/dark), persist in
  localStorage, apply `data-theme` on `<html>` in a pre-paint inline script
  exactly like the existing `dyslexic-font` snippet in `Layout.astro` (avoid
  a flash), and note that `Layout.astro`'s critical dark-mode CSS uses
  `prefers-color-scheme` — it must respect the override too. If the owner
  declines: delete the `:root[data-theme=...]` rules from global.css,
  translation-commitments.css, and found-in-translation-podcast.css instead.

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

## Owner — decisions & dashboard tasks (no model)

- [ ] **Decide `/courses`:** link it in the nav/footer, or park it
  deliberately until course content exists. (It's currently reachable only
  by URL.)
- [ ] **Decide the twin footer Facebook icons.** The footer shows identical
  Facebook icons for LIT Bible and the Found in Translation podcast,
  distinguishable only by aria-label. Owner is leaning toward: REMOVE the
  podcast Facebook link from `SiteFooter.astro` and ADD it to the podcast
  page (`found-in-translation-podcast.astro`) alongside the Apple
  Podcasts/Spotify/YouTube links, reusing the `.fit-platform` button pattern
  rather than the footer's icon-list styling. This makes the footer purely
  LIT-brand social (no differentiation needed at all). Once confirmed, this
  is a Sonnet-sized change.
- [x] **Pick the code license.**
  DONE (2026-07-11): split license — owner doesn't mind others reusing the
  CODE for its functionality but wants the CONTENT protected. So `LICENSE`
  puts the site code under the permissive MIT License and the LIT translation
  text/footnotes/intros/glossary/articles under CC BY-NC-ND 4.0, with an
  explicit file-area breakdown of which is which. CONTRIBUTING.md's "License
  note" updated to match.
- [ ] **Decide the theme toggle** (gates Opus item O7): ship a light/dark
  toggle, or remove the unused `data-theme` CSS hooks.
- [ ] **Cloudflare dashboard:** verify Web Analytics is actually enabled (the
  privacy policy asserts it); confirm HSTS under SSL/TLS → Edge Certificates
  (feeds F2).
- [ ] **Formspree dashboard:** delete the retired courses form endpoint
  (`mgovgpoo`) so stray submissions can't land anywhere.

## Completed from TBD

- [x] **Consolidate email capture.** The `/courses` Formspree signup (a
  pre-Brevo vestige, per the owner) was removed; the Email Updates section
  now points to the footer's Brevo newsletter form. The contact form stays on
  Formspree until F1 ships.
