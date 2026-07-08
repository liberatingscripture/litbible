# Site Audit Fix List

From the comprehensive audit of 2026-07-07 (developer, QA, SEO, end-user, editor,
marketing, accessibility, HR/governance, and security passes). Items marked
**Priority** are the seven highest-impact fixes; everything else is **TBD** —
agreed in principle, scheduled later. Delete items as they land (or move them to
release notes); this file is a punch list, not a changelog.

## Priority

- [x] **P1 — Fix `isOpen` ReferenceError in the Read-page tooltip script.**
  DONE: the window `resize` handler in `src/layouts/ReadLayout.astro` now
  checks `btn.dataset.tipOpen === "true"` instead of the undefined `isOpen`.

- [x] **P2 — Link the privacy policy (and decide `/courses`).**
  DONE (privacy): Privacy link added to the footer "Connect" column
  (`SiteFooter.astro`). OPEN (owner decision): `/courses` is still unlinked —
  add it to the nav/footer once there's content, or park it deliberately.

- [x] **P3 — Bring the privacy policy in line with actual data flows.**
  DONE: `privacy.astro` now discloses the Formspree-processed contact form,
  Cloudflare Turnstile, and the `lit_welcome_v2` cookie + localStorage
  preferences; effective date bumped to 2026-07-07. Owner confirmed neither
  app is live yet, so the scope/lede now frame the "(app)" sections as
  describing the in-development iOS/Android apps, effective at launch
  (Android-specific details to be documented at release).

- [x] **P4 — Fix brand-green contrast for text.**
  DONE: added `--green-text: #0F6B33` (≈ 4.9:1 on cream, ≈ 6.7:1 on white;
  dark mode keeps `#3abf6a`) and switched green-as-text usages to it across
  global.css, articles.css, read.css, contact/courses/podcast page CSS, the
  scripture pages (footnote refs, backlinks, verse numbers, panel links), and
  the article back/top links. `--link` now points at `--green-text`.
  Green-on-ink text (homepage curtain CTAs, newsletter/unsubscribe submit
  hovers) already passed and keeps `--green`. The 16px chapter CTAs and
  back-to-top button backgrounds were darkened to `--green-text` (white label
  now ≈ 6.7:1). REMAINING (moved to TBD): sweep the other white-on-`--green`
  buttons (header Read Now, ReadMenu Study/Read, search buttons, intro pages)
  to confirm each qualifies as WCAG large text at 3:1 or darken them too.

- [x] **P5 — Make the scripture-menu tooltip screen-reader accessible.**
  DONE: the tooltip content now has an id and the button references it via
  `aria-describedby`, so the instructions are announced as the button's
  description (while `aria-hidden` keeps them out of its name).

- [x] **P6 — Keyboard access for the verse copy/share menu.**
  DONE (`chapter-tools.js`): verse numbers get `role="button"`, `tabindex=0`,
  `aria-label`, and `aria-haspopup` at init; Enter/Space activates the menu;
  keyboard-opened menus restore focus to the verse number on close (pointer
  taps deliberately don't, to avoid scroll jumps); Tab now cycles inside the
  verse/footnote panels instead of escaping into the page.

- [x] **P7 — Add a CI workflow.**
  DONE: `.github/workflows/ci.yml` runs `npm ci`, `validate:chapters`, and the
  full production build on pushes to main and all PRs. Follow-on (tracked in
  TBD): tests for `search-core.js` parsing and a post-build link check.

## TBD

### Developer / code health

- [ ] **Disambiguate the `index` prop across layouts.** `Layout.astro` uses
  `index` for Pagefind and `noindex` for robots; `ScriptureLayout.astro` uses
  `index` for robots. Rename to `pagefindIndex` / `robotsIndex` (or similar).
- [ ] **Comment the glossary Pagefind subtlety.** `glossary.astro` relies on an
  inner `data-pagefind-body` overriding the `data-pagefind-ignore` Layout puts
  on `<body>`; document why this works so nobody "fixes" it.
- [ ] **Normalize the npm `build` script** — it mixes `npm run build:topics`
  with direct `node scripts/...` calls for sibling steps.
- [ ] **Resolve the `data-theme` dead end.** CSS supports an explicit
  light/dark override (`:root[data-theme=...]`) but no UI ever sets it. Either
  ship a theme toggle (natural neighbor for the "Aa" tray) or remove the hooks.
- [ ] **Unit tests for `search-core.js`** (reference parsing, ranking, typo
  correction) — highest-value test target of the ~4,500 untested client-JS lines.
- [ ] **Post-build link checker over `dist/`** to catch broken internal anchors
  (e.g. `/read#license`-style cross-page anchors) and dead hrefs.

### SEO / social

- [ ] **Upgrade article metadata:** `og:type=article`, `article:published_time`,
  `Article`/`BlogPosting` JSON-LD, and `twitter:card=summary_large_image` when a
  hero image exists (`articles/[...slug].astro`, `Layout.astro`).
- [ ] **Stop hardcoding `og:image` dimensions.** `Layout.astro` always emits
  1000×1000 even when `ogImage` is overridden with a non-square article hero.
- [ ] **Canonical trailing-slash consistency:** `/privacy` and
  `/translation-commitments` omit the trailing slash; every other page includes
  it. Standardize on with-slash (matches the directory build format).
- [ ] **Per-chapter/verse OG share images.** Build-time text-on-brand-green
  cards would materially improve link previews for the most-shared content.

### Accessibility follow-ons

- [ ] **Audit remaining white-on-`--green` buttons** (header Read Now CTA,
  ReadMenu Study/Read, search page buttons, intro-page CTAs, home question
  cards, 404 CTAs): confirm each label qualifies as WCAG "large text" (≥18.66px
  bold or ≥24px, where 3:1 suffices — #209D50/white is ≈3.5:1) or switch its
  background to `--green-text` like the chapter CTAs.
- [ ] **Homepage hero text contrast:** cream/white text on the green hero
  (`bg="green"`) is ≈2.6–3.5:1 — verify the display-size text passes the 3:1
  large-text bar and adjust weights/sizes if not.

### End-user experience

- [ ] **Rein in the welcome popover.** It fires on any first pageview —
  including shared verse deep links, where it competes with the verse
  highlight — and qualifies as an intrusive interstitial for mobile search
  entrances (SEO risk too). Show it on the homepage only, or after the second
  pageview.
- [ ] **Differentiate the two Facebook icons** in the footer (LIT vs podcast) —
  currently identical for sighted users, distinguished only by aria-label.
- [ ] **Stop opening internal links in new tabs** in article bodies (e.g. the
  2 Corinthians article's scripture link).
- [ ] **Longer-term: simplify the ReadMenu** (book/chapter dropdowns + two
  submit buttons need an instructional tooltip — a sign the control carries too
  much). A single "Go to passage" affordance could remove the need entirely.

### Editorial

- [ ] **Grammar in the /read lede** (`read.astro`): "ready for your study,
  scrutinize, celebrate, and use" → "study, scrutiny, celebration, and use" (or
  "for you to study, scrutinize…").
- [ ] **Untangle the two meanings of "draft"** in the About FAQ ("All books are
  currently drafts… Most books are complete") vs. the site's `(draft)` markers
  for `indexed:false` stubs. Reword the FAQ answer.
- [ ] **"FAQ's" → "FAQs"** (`about.astro`).
- [ ] **Normalize curly vs. straight apostrophes** across `about.astro` (mixed
  section by section).

### Marketing

- [x] **Consolidate email capture.** DONE: the `/courses` Formspree signup
  (a pre-Brevo vestige, per the owner) was removed; the Email Updates section
  now points to the footer's Brevo newsletter form. The contact form stays on
  Formspree by design.
- [ ] **Verify Cloudflare Web Analytics is actually enabled** — the privacy
  policy asserts it, and it's the only visibility into traffic.

### Security

- [ ] **Self-host the contact form on Cloudflare (drop Formspree).**
  Replace the Formspree backend with a small Cloudflare Worker + Email Routing
  (`send_email` binding — free tier), keeping the existing form markup and
  Turnstile widget:
  - Worker routed at e.g. `litbible.net/contact/submit` (NOT under `/api/*`,
    which is the app-sync contract namespace). Must be a real Worker — Pages
    Functions don't support the email binding.
  - Worker verifies the Turnstile token server-side (`siteverify` + secret
    stored as a Worker secret) — an upgrade over today, where nothing verifies
    the token on our side.
  - Sends from `contact@litbible.net` with `Reply-To:` set to the submitter,
    to a verified Email Routing destination address (the owner's inbox).
  - No-JS fallback: native POST works; Worker redirects to a branded thanks
    page.
  - One-time dashboard steps: enable/verify Email Routing destination, add
    Turnstile secret, attach the route; deploy via `wrangler` from a small
    project in the repo (e.g. `workers/contact-form/`).
  - Follow-ups when it ships: update `privacy.astro` (remove the Formspree
    disclosure), retire the Formspree forms (`mbdlnpgz` contact, and the
    already-removed `mgovgpoo` courses endpoint) in the Formspree dashboard,
    and consider a Cloudflare rate-limiting rule on the endpoint.
  - Avoid stale guidance: the free MailChannels-from-Workers path died in
    Aug 2024; Cloudflare Email Service (arbitrary recipients) is beta/paid and
    not needed here.

- [ ] **Add a Content-Security-Policy** (start report-only, given Brevo /
  Turnstile / GiveLively third-party scripts) and confirm HSTS is applied at
  the Cloudflare layer (`public/_headers` currently has neither).
- [ ] **`http://` → `https://`** on the CC license link in `read.astro`.
- [ ] **Stronger honeypots:** the Formspree `_gotcha` fields are
  `type="hidden"`; a CSS-hidden text input catches more bots.

### Governance (HR hat)

- [ ] **Add a LICENSE file.** The code currently has no license at all
  (all-rights-reserved by default) — state a code license (e.g. MIT) with the
  content carve-out (CC BY-NC-ND for the translation and LIT content).
- [ ] **Add CONTRIBUTING.md and a code of conduct** — the site invites
  collaboration; the repo doesn't say how.
- [ ] **Add SECURITY.md** (vulnerability-report contact).
