# LIT Bible — Claude Project Instructions

> **Maintain this file.** It is the orientation doc for every future Claude Code
> session, so keep it accurate to how the repo *actually* works — not a changelog.
> When you change build steps, directory layout, data formats, conventions, or
> add/remove a major feature, update the relevant section here in the same change.
> Describe organizing principles and the "why," not one-off edits. If a section
> here contradicts the code, the code wins — fix the doc. Prune anything stale.
>
> **Update `README.md` too when appropriate.** It's the human-facing front door
> (lighter and friendlier; CLAUDE.md is the deep reference). When a change affects
> what it documents — the overview, getting-started/setup steps, common commands,
> or the high-level project layout — update `README.md` in the same change.
> Keep it lighter than this file and avoid hardcoded specifics that drift (exact
> version numbers, file counts); prefer "run this command to check."

## Project Overview

**LIT Bible** ([litbible.net](https://litbible.net)) is a static website for the
*Liberation and Inclusion Translation* (LIT) of the New Testament — a
trauma-informed, justice-oriented translation from the original languages,
produced by the Liberating Scripture Collective. The site is built with Astro
and uses a **content-as-data architecture**: scripture lives in 260 JSON chapter
files (one per NT chapter), and supporting content (book intros, glossary,
articles) lives in Markdown. There is no database and no CMS — the repo *is* the
content store, and the build compiles it into a static site plus JSON APIs that
companion iOS/Android apps consume.

## Tech Stack

- **Framework**: Astro 7 (static site generator; `output` is static). Two Astro 7
  defaults are **deliberately pinned back to their Astro 6 behavior** in
  `astro.config.mjs`, each with a comment explaining why — `compressHTML: true`
  (the new `'jsx'` default joins deliberately-spaced adjacent inline text, which
  corrupts accessible names and Pagefind's extracted text) and
  `markdown: { processor: unified() }` (the new Sätteri Markdown pipeline
  changes published copy). Don't drop either without re-running a
  rendered-output diff; adopting Sätteri is a **content** decision for the
  owner, not an upgrade side effect.
- **Language**: TypeScript (strict mode, `astro/tsconfigs/strict`)
- **Styling**: Vanilla CSS (no utility framework). Global stylesheet + a
  per-page stylesheet under `src/styles/pages/`
- **Search**: two engines — scripture keyword search scans a build-generated
  verse index (`public/search/verses.json`, fetched lazily by the client);
  Pagefind (static, build-time index over `dist/`) covers glossary + articles
  + book intros
- **Fonts**: `@fontsource` (Crimson Text, Fraunces, Inter) plus two
  reader-selectable accessibility fonts, OpenDyslexic and Atkinson
  Hyperlegible Next (the latter variable, via `@fontsource-variable`) — see
  the Display tray note below
- **Icons**: simple-icons
- **Client JS**: Hand-written vanilla JS in `src/scripts/` (progressive
  enhancement only — no client framework, no hydration). The site is fully
  functional with JS disabled.

## Common Commands

```bash
npm run dev               # Dev server at localhost:4321
npm run build             # Full production build (see pipeline below)
npm run preview           # Build + astro preview locally
npm run check             # Type-check .astro/.ts files (astro check)
npm run validate:chapters # Validate all chapter JSON (structure + references)
npm run fix:chapters      # Re-serialize chapter JSON to normalize formatting
npm run check:links       # Verify every internal href/#fragment in dist/ resolves
npm test                  # Run the node:test unit suite (test/*.test.js)
npm run build:topics      # Regenerate topics indexes only
npm run build:verses      # Regenerate the verse search index only
npm run build:api         # Regenerate public/api/content.json only
npm run build:manifest    # Regenerate API manifest + /api/data for the mobile apps
npm run build:og          # Regenerate the chapter/intro share cards (public/og/)
npm run build:favicons    # Regenerate the favicon/touch/manifest icons from the emblem SVGs
                          #   (on demand only — outputs are committed, not built)
npm run draft:release-notes -- --since <ref>  # Draft a release-notes entry from git diff
```

### Build Pipeline (`npm run build`, in order)

1. `fetch:podcast` — refreshes `src/data/podcast-feed.xml` from RedCircle. The
   committed XML is a snapshot; a fetch failure reuses it and **never fails the
   build**.
2. `build:topics` — generates `public/topics-index.json` (topic → chapters) and
   `public/search/topics.json` (autocomplete) from chapter `topics` arrays.
   Output is deterministic (sorted, no timestamps) so it doesn't churn the sync
   content hash.
3. `build:verses` — generates `public/search/verses.json`, the verse-level
   plain-text index the client scans for scripture keyword search, plus the
   corpus `vocab` used client-side for related-form matching and typo
   correction (drafts excluded, deterministic output). A website asset, NOT
   part of the app contract — it must never move under `public/api/`.
4. `build:manifest` — generates `public/api/manifest.json` + `public/api/version.json`
   and copies content files into `public/api/data/` (chapters, intros, intro
   `images/`, plus `topics.json` and `translation-commitments.json`) so the
   native apps can diff hashes and download only changed files. **This step owns
   the content `version`**: it's `v<YYYYMMDD>.<8-char hash of all file hashes>`,
   so it changes on *every* content publish (including multiple on the same day)
   and stays stable when nothing changed. The apps gate all syncing on this
   string — see the app-sync note below.
5. `build:api` — generates `public/api/content.json` (full NT in canonical
   order). Runs *after* `build:manifest` and reads the shared `version` from
   `version.json` so all three API artifacts report the same version.
6. `build:og` — generates `public/og/<slug>.png`, a 1200×630 social share card
   for every chapter and book-intro page (owner-approved design: ink field,
   the ringed emblem, Fraunces display-cut reference), plus `apps.png`
   for `/apps` — a sibling composition on the same ink field whose hero visual
   is **both** platform icons (`public/images/lit-app-icon-ios.webp` and
   `lit-app-icon.svg`, the same pair the launch popover shows), stacked
   vertically in rounded tiles, with no site emblem so the two logos don't
   compete. Text is converted to SVG paths with opentype.js using fonts
   committed in `scripts/og/fonts/` (no system-font dependency), then
   rasterized with sharp — deterministic output. **`inter-400.ttf` is
   character-subsetted** (no comma, colon, or dash), so new card copy is
   glyph-checked at build time and throws rather than shipping a tofu box —
   reword, or widen the subset per that directory's README. The pages
   reference the cards via Layout's `ogImage` prop plus
   `twitter:card=summary_large_image`. A website asset, NOT part of the app
   contract — it must never move under
   `public/api/`.
7. `astro build` — compiles the site to `dist/`.
8. `pagefind --site dist` — indexes glossary + article + book-intro pages
   into `dist/pagefind/` (scripture chapter pages are deliberately not
   Pagefind-indexed — see Search below).

## Project Structure

```
src/
  assets/            # Bundled assets (SVGs) processed by Astro
  components/        # Reusable .astro components (SiteHeader, SearchBar, cards, …)
                     #   apps/ holds the /apps promo page sections
  content/
    articles/        # Blog/teaching articles (Markdown, ~13 files)
    glossary/        # Glossary entries (Markdown w/ frontmatter, ~31 files)
    callouts/, examples/, seasons/   # /apps promo section content (Markdown)
  content.config.ts  # Astro content-collection schemas (articles, glossary,
                     #   + apps: callouts/examples/seasons)
  data/
    chapters/        # 260 JSON files — one per NT chapter (e.g. john-3.json)
    intros/          # Book intro Markdown, one per book (e.g. john-intro.md)
    books.js         # NT book constants: BOOKS (chapter counts), BOOK_ORDER,
                     #   bookKeyToLabel(), BOOK_ABBREVIATIONS — the single
                     #   source for book names
    podcast-feed.xml # Committed podcast snapshot (refreshed by fetch:podcast)
    podcastOverrides.json     # Manual episode metadata overrides
    release-notes.json        # "What's new" entries (auto-appended in CI)
    translation-commitments.json
  layouts/           # Layout, ScriptureLayout, ReadLayout, SearchLayout
  lib/               # Server-side build helpers: chapter-html.ts (the shared
                     #   scripture-HTML transform pipeline — prepareStudyParagraph
                     #   / prepareReadParagraph; Study wraps each verse in a
                     #   data-verse span), draft-chapters.mjs (single source
                     #   for indexed:false draft data — used by astro.config.mjs
                     #   and ReadMenu), fetchPodcastEpisodes.ts,
                     #   lsc-mark.mjs (see The LSC brand mark below)
  pages/             # File-based routes (see Routing below)
  scripts/           # CLIENT-side vanilla JS (chapter-tools, read-mode,
                     #   search-core + searchbar + search — see Search below)
  styles/            # global.css, read-mode.css, scripture-tools.css, articles.css,
                     #   pages/<page>.css (per-page stylesheets)
scripts/             # BUILD/validation Node scripts (.mjs) — see below
                     #   (og/fonts/ holds the committed TTFs the share-card
                     #   generator renders with — see its README)
public/              # Static assets + generated output (api/, og/, search/,
                     #   topics-index.json, llms.txt, llms-full.txt, _headers,
                     #   images/, icons). Page-loaded raster images are WebP,
                     #   resized to ~2x display size — no astro:assets pipeline,
                     #   so files are optimized ahead of time and referenced by
                     #   plain URL string (frontmatter/src/JSON).
                     #   assets/screenshots/ holds the /apps phone+tablet shots,
                     #   MIRRORED to the LSC site — lowercase-kebab names, no
                     #   spaces, so the two repos' components stay byte-identical
                     #   (see The /apps mirror below)
_source-images/      # Pre-WebP originals for public/images/articles/ and
                     #   public/assets/screenshots/, archived (not shipped —
                     #   outside public/) for future re-editing; see its README
emails/              # Archive of hand-built HTML campaigns (not part of the site
                     #   build, and NOT a template source). Newsletters are
                     #   authored in Brevo's editor, which supplies the
                     #   unsubscribe link + footer; don't build the next one by
                     #   copying the file here, which predates that and has
                     #   neither
workers/             # Cloudflare Workers, deployed separately via wrangler (NOT
                     #   part of the site build): contact-form/ backs both the
                     #   /contact/submit and /app-support/submit form endpoints
                     #   (two routes, one Worker) — see its README. Has its OWN
                     #   package.json + deps (incl. its vitest suite, `npm test`
                     #   in that dir); root `npm ci`/`npm test` don't reach it
.githooks/           # pre-commit hook (validates staged chapter JSON)
.github/workflows/   # ci.yml — `build` job (chapter validation, type-check, unit
                     #   tests, full build, internal-link check on push/PR) plus a
                     #   separate `worker-tests` job (workers/contact-form has its
                     #   own dep tree, so it needs its own npm ci);
                     #   release-notes.yml (auto-updates release-notes.json on push);
                     #   apps-mirror-notify.yml (tells the LSC repo when a
                     #   mirrored /apps file or /privacy changes — see
                     #   The /apps mirror below)
.github/dependabot.yml  # Three update streams: npm at `/`, npm at
                     #   `/workers/contact-form` (separate dep tree), and
                     #   github-actions. Minor/patch are grouped into one weekly
                     #   PR per stream; majors stay ungrouped so each gets the
                     #   hand-checked treatment (see the Astro 7 pins above).
                     #   Security-advisory PRs are a SEPARATE track this file
                     #   doesn't configure — grouped by the repo's "Grouped
                     #   security updates" setting, and they can carry a major
                     #   (see the file's header comment)
```

> Note: client-side code lives in `src/scripts/` while build-time Node scripts
> live in the top-level `scripts/`. Don't confuse the two.

### Routing (`src/pages/`)

| Route | File | Purpose |
|-------|------|---------|
| `/<book>-<chapter>` | `[slug].astro` | Scripture chapter ("Study View") |
| `/<book>-intro` | `[book]-intro.astro` | Book introduction |
| `/read` | `read.astro` | Reading-mode landing |
| `/read/<book>` | `read/[book].astro` | Continuous reading view of a book |
| `/articles`, `/articles/<slug>` | `articles.astro`, `articles/[...slug].astro` | Articles |
| `/glossary` | `glossary.astro` | Glossary |
| `/search` | `search.astro` | Full search UI (verse index + Pagefind) |
| `/release-notes` | `release-notes.astro` | "What's new" |
| `/apps` | `apps.astro` | Mobile-apps promo page (footer-linked). Body design ported from `BDRhodes/LIT-app-Promo`; section content lives in the `callouts`/`examples`/`seasons` collections; scoped styles in `src/styles/pages/apps.css`; components under `src/components/apps/`. Uses `bg="white"` (near-white surface). |
| `/app-support` | `app-support.astro` | App support contact form (linked from inside the apps, not the site nav; `/app-support/thanks` is the native-POST fallback success page) |
| others | `about`, `contact` (+ `contact/thanks`), `courses`, `support`, `privacy`, `unsubscribe`, `found-in-translation-podcast`, `liberating-scripture-collective`, `translation-commitments`, `404` |

Redirects (`/read-now`→`/read`, `/podcast`→`/found-in-translation-podcast`) and
the sitemap filter live in `astro.config.mjs`.

## Build / Validation Scripts (`scripts/`)

| Script | Role |
|--------|------|
| `validate-chapters.mjs` | Validates chapter JSON (with `--fix` to re-serialize). Driven by `chapter_json_invariants.json`. |
| `chapter_json_invariants.json` | Documents validation rules (e.g. the `indexed` flag). |
| `build-topics-index.mjs` | Topic indexes (`normalizeTopic` slugifies labels). |
| `build-verse-index.mjs` | fs/CLI shell: walks the chapter files, skips drafts, derives the corpus `vocab`, and writes `public/search/verses.json` — per-verse plain text for client-side scripture keyword search. Delegates the HTML→verse-text extraction to `lib/verse-index-core.mjs`. |
| `build-api-json.mjs` | `public/api/content.json`. |
| `build-api-manifest.mjs` | `public/api/manifest.json` + `public/api/data/` for the native apps. |
| `build-og-images.mjs` | `public/og/` — per-chapter/intro share cards (fonts in `scripts/og/fonts/`). |
| `build-favicons.mjs` | Favicon/touch/manifest icons from the emblem SVGs. **Not** in the build — run by hand when the emblem changes. |
| `fetch-podcast-feed.mjs` | Refresh podcast XML snapshot (non-fatal on failure). |
| `draft-release-notes.mjs` | CLI/git shell: drafts release-notes entries from git diffs (used by CI). Delegates the diff→changes logic to `lib/release-notes-core.mjs`. |
| `lib/release-notes-core.mjs` | Pure `buildChanges()` core of the drafter — no git/fs/argv of its own (readBase/readNow injected). Unit-tested directly (`test/draft-release-notes.test.js`) since its output shape is an app contract. |
| `lib/verse-index-core.mjs` | Pure `extractVerses()` core of the verse-index builder — paragraph HTML → per-verse plain text, no fs of its own. Unit-tested directly (`test/build-verse-index.test.js`): `verses.json` isn't an app contract, but it's the whole search surface for scripture, so an extraction regression ships straight to readers. |

## Chapter JSON Format

Each file in `src/data/chapters/` follows this structure:

```json
{
  "bookKey": "john",
  "chapter": 3,
  "type": "scripture",
  "title": "John 3",
  "description": "John 3 in the Liberation and Inclusion Translation (LIT).",
  "topics": ["Nicodemus", "born again", "God so loved the world"],
  "paragraphs": [
    "<p id=\"john-3-p1\"><span class=\"vglue\"><sup id=\"v1\" class=\"vn\">1</sup>&nbsp;There was a Pharisee...</span>..."
  ],
  "footnotes": [
    { "id": "fn-a", "refId": "fnref-a", "label": "a", "html": "Footnote content as HTML..." }
  ]
}
```

- **`type`** is `"scripture"` on every chapter (not a genre label).
- **Verse numbers** are `<sup id="vN" class="vn">N</sup>`, always wrapped as
  `<span class="vglue"><sup…></sup>&nbsp;<first word>…</span>` so the number
  stays glued to the verse's first word. At render time (website only — raw
  JSON is never modified) the Study View wraps each verse's content in
  `<span data-verse="N">` so verse boundaries are DOM containers; keep every
  vglue at tag-depth 0 inside its block or that wrapping breaks.
- **`topics`** are free-text labels (e.g. `"Nicodemus"`), not pre-slugged.
  `build-topics-index.mjs` normalizes them into slugs and groups chapters that
  share a topic.
- **`footnotes`** are HTML strings; the verse text references them via
  `<sup class="fn-ref">` anchors (Pagefind excludes these — see `pagefind.yml`).
- **`indexed`** is an explicit two-state publication flag on EVERY chapter:
  `false` marks an in-progress **draft/stub chapter**, `true` a published one
  — never omit it (the release-notes generator emits "chapter added" on the
  explicit false→true transition, and the validator enforces the rules in
  `chapter_json_invariants.json`). 54 of 260 chapters are currently drafts.
  `indexed: false` has four downstream effects, so handle it carefully:
  1. `build-verse-index.mjs` excludes the chapter from the verse search index
     (kept out of search).
  2. `astro.config.mjs` excludes the slug from the sitemap, and a `/read/<book>`
     page is excluded only when *every* chapter of that book is a draft.
  3. The page is `noindex`'d.
  4. `ReadMenu.astro` (the "Go to passage" picker — a popover with a book
     grid then a chapter grid, server-rendered as a plain link for no-JS)
     dims the chapter with a dot marker in its chapter grid, keeps "(draft)"
     in the cell's accessible name, and dims a book in the book grid when
     *every* chapter of that book is a draft. The picker has two modes: the
     default standalone pill on Study/Search pages, and `mode="read"` — a
     compact trigger embedded in the Reading View toolbar whose label IS the
     live "Book · Chapter N" readout (`read-mode.js` keeps the label and the
     root's `data-current-chapter` updated on scroll, and intercepts
     same-book chapter picks for an in-page scroll; other books navigate to
     `/read/<book>#ch-N`).
  **Flip it to `true`** (do not delete the field) when real content lands.
- Always run `npm run validate:chapters` after editing chapter JSON. The
  pre-commit hook validates staged chapter files automatically.

## Translation Source Text (SBLGNT)

The **SBL Greek New Testament** (Holmes, ed.) is the official source text for
the LIT New Testament. It is *not* interchangeable with NA28/UBS5 — it differs
from them in 540+ variation units, and a few of those change **which verses
exist at all**.

**The governing principle: the source text decides wording, reception decides
inclusion.** SBLGNT settles which Greek is being rendered and how. Whether a
long-received passage appears in the translation *at all* is a canon-boundary
question, which LIT answers by how the church has actually held and used the
text. That is why LIT can follow SBLGNT closely and still print passages
SBLGNT omits, without either choice being ad hoc.

| Passage | SBLGNT | LIT |
|---------|--------|-----|
| Romans 16:24 | present (with TR/Byz; NA28, WH, Tregelles, THGNT omit) | printed, **bracketed** |
| Romans 16:25–27 (doxology) | absent | **retained, bracketed**, divergence footnoted |
| John 7:53–8:11 | absent (John 7 ends at v52, John 8 opens at v12) | **retained, bracketed**, divergence footnoted |
| Mark 16:9–20 | present | printed, **bracketed** |

Mark 16 is in that table specifically to head off a wrong inference: SBLGNT
does *not* drop every famously disputed passage, so "SBL omits it" has to be
checked per passage, never assumed from the passage's reputation.

**The rule for divergences:** where LIT departs from SBLGNT in either
direction, a chapter footnote says so and names SBLGNT as the source text.
Retaining or omitting non-SBLGNT material *silently* is the thing this policy
exists to prevent.

### Bracketed passages

Text whose authenticity or placement is contested is wrapped in literal `[|`
and `|]` markers in the paragraph HTML (not a CSS class — plain characters in
the text). The convention is strict and has two halves:

- `[|` sits at the **start of the paragraph**, immediately followed by a
  footnote marker, then the `vglue` span.
- ` |]` closes the passage at the **end of the passage**, immediately followed
  by a second footnote marker. That is usually the end of a paragraph, but not
  always — where the contested text stops mid-verse the marker does too
  (`john-9.json`: `Jesus said, |]`, closing 9:38–39a).
- **Both markers carry the same footnote text**, so a reader who meets either
  end gets the whole explanation. That is why those footnote pairs are
  byte-identical, and they must be edited together.

Live examples: `mark-16.json` (e/m), `john-7.json` ff → `john-8.json` k
(a pair that spans a chapter boundary), `john-9.json` (q/r),
`john-11.json` (w/z), and `romans-16.json` (m/n for verse 24, o/r for the
doxology).

**The markers are reader-facing in rendered HTML but must never reach a
plain-text extractor.** Being literal characters rather than markup, they
survive tag stripping, and an opening `[|` leads its paragraph *ahead of* that
paragraph's first verse marker — so a naive verse split files it under the
**previous** verse and reports characters for a verse that does not contain
them. Both extraction paths therefore strip them, each with its own
`stripBracketMarkers` applied before the whitespace collapse (the collapse must
run last, or a removed marker ships as a double space):
`scripts/lib/verse-index-core.mjs` (search index) and
`scripts/lib/release-notes-core.mjs` (changelog — that copy deliberately
exempts its paragraph-level fallback; see its docblock). Any future consumer
that flattens paragraphs to text needs the same strip.

### Verse-number gaps

A gap is deliberate: it marks a traditional verse the source text does not
carry. **Never "fix" one by importing text from another edition.**

**Every gap is already explained, and the note lives at the gap boundary**,
because there is no verse of its own to hang it on. It attaches to the first
footnote marker of the *following* verse in most chapters, or to the last
marker of the *preceding* verse (`luke-17.json` fn-cc, at the end of v35).
Each note names the traditional verse number, says why it is left out, and
quotes the traditional rendering. **Before concluding that a gap is
undocumented, check the markers on both adjacent verses** — searching only
the following verse will miss the Luke pattern and make a documented gap look
silent.

Nine published chapters have gaps: Matthew 17:21, 18:11, 23:14; Mark 7:16,
9:44, 9:46, 11:26, 15:28; Luke 17:36; John 5:4. Regenerate that list rather
than trusting this sentence — scan every `indexed !== false` chapter for
missing `id="vN"` markers.

## Content Collections (`src/content.config.ts`)

Five collections, all loaded via Astro's `glob` loader. Two are site-wide:

- **`articles`** — `src/content/articles/*.md`. Schema: `title`, `date`,
  optional `author`/`description`/`heroImage`/`featured`, `tags[]`.
- **`glossary`** — `src/content/glossary/*.md`. Schema pairs a `traditional`
  term with the LIT rendering (`greek`, `lit`, `litMenu`, `srOnly`, optional
  `note`/`menuTraditional`). Files are named `<traditional>-<lit>.md`
  (e.g. `hell-hades.md`).

Three drive the `/apps` promo page only (section content as data, edited without
touching component code — consumed by `src/components/apps/*`):

- **`callouts`** — reader-feature cards (`title`, `order`, `platform`, `mode`,
  `accent`, `imageSide`, `image`).
- **`examples`** — LIT-vs-traditional passage comparisons (`reference`,
  `placement`, `comparison`, `litText`, `traditionalText`, `note`).
- **`seasons`** — church-year carousel frames (`name`, `order`, `colorVar`,
  `image`).

Book intros in `src/data/intros/` are plain Markdown (not a content
collection); they're read directly by the intro pages and the API manifest.

## Key Conventions

- **Book keys**: lowercase, no spaces, no hyphens — `john`, `1corinthians`,
  `revelation`. Source of truth is `src/data/books.js` (`BOOKS`, `BOOK_ORDER`).
- **Chapter file naming**: `{bookKey}-{chapter}.json` (e.g. `1corinthians-1.json`).
- **Generated files are git-ignored** and regenerated at build time:
  `public/api/`, `public/og/`, `public/search/topics.json`,
  `public/search/verses.json`, `public/topics-index.json`, `dist/`, `.astro/`.
  Don't hand-edit them.
- **No client JS framework**, but `src/scripts/` *does* hold vanilla JS for
  progressive enhancement (verse highlighting/menus, footnote popovers, reading
  mode, search). Everything must degrade gracefully without JS.
- **Theming (light/dark) is a dual mechanism.** Dark-mode tokens are declared
  twice — `@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]) … }`
  (follow the OS) and `:root[data-theme="dark"] … }` (explicit override) — in
  `global.css` and mirrored in a few page stylesheets (`apps.css`,
  `found-in-translation-podcast.css`, `translation-commitments.css`) and
  `ReadMenu.astro`. The header "Aa" tray (`SiteHeader.astro`, heading
  **"Display"**) holds the Theme half: a 3-state control
  (**System / Light / Dark**) persisted in `localStorage['lit-theme']`
  (`light`/`dark`; **key absent = System**). `Layout.astro` stamps `data-theme`
  on `<html>` in a pre-paint `is:inline` script (beside the font one) and
  mirrors `documentElement.style.colorScheme`, so there's no flash; its inline
  `criticalCSS` carries the same guarded pair so a forced theme wins the first
  paint. No JS → no attribute → OS pref governs. When adding a dark-mode style
  anywhere, use BOTH selectors or the toggle's "force light/dark" states will
  leak.
- **The reader font is the Display tray's other half, and works the same way.**
  A 3-state radio list (**Default / Atkinson Hyperlegible / OpenDyslexic**,
  each option set in the font it selects so the list previews itself) writes
  `data-font` on `<html>` (`dyslexic` | `atkinson`; **attribute absent =
  default fonts**) and persists to `localStorage['lit-font']`, with a pre-paint
  `is:inline` script in `Layout.astro` to avoid a flash. Two audiences, not one:
  OpenDyslexic anchors letter shapes for dyslexic readers, Atkinson
  Hyperlegible disambiguates confusable characters for low-vision readers.
  Three rules:
  1. The pre-paint script **also reads the retired boolean
     `localStorage['dyslexic-font']`** as a fallback, so readers who enabled
     OpenDyslexic before the three-way control shipped aren't reset. The tray
     deletes that key on any font change. Don't drop the fallback.
  2. Each `html[data-font=…]` rule overrides `font-family` on `*` with
     `!important`, so **the tray's own preview labels carry `!important` too** —
     otherwise the list renders entirely in the active font and previews
     nothing.
  3. The width compensations are scoped to `[data-font="dyslexic"]` **only**.
     OpenDyslexic is far wider than Inter; Atkinson is not, and must not
     inherit them. They live in `home.css` (hero titles, the hero scroll's
     safe interior, the question CTA), `global.css` (mobile nav, the header's
     earlier nav collapse + phone title scale, the footer newsletter field
     above 721px), `ReadMenu.astro` (grid floors), and `SiteHeader.astro` (the
     forced short title). Prefer **buying back space over shrinking type** —
     an accessibility font is the last thing that should be made smaller. The
     header hands the nav to the hamburger below 1400px rather than
     compressing it; the hero scroll's interior is widened before its type is
     eased; only the phone-width header title, where there is genuinely no
     space left, scales down.
     The one shared mechanism is the **callout CTA**: the clamp that keeps it
     inside the viewport applies to every font, and only its `--cta-overhang`
     value is per-font. Don't re-scope it to dyslexic — it overflows in all
     three.
  4. **A word wider than its column can't be centred** — the line box pins to
     the content edge and the word spills right, and text overflow adds to
     `scrollWidth` without widening any element's box. This has bitten three
     places on the home page alone (`.title-large`, the hero quote, the
     overlay's "Commitments"), always as "the text looks pushed right" plus
     unexplained horizontal scroll. When hunting it, **bisect by hiding
     sections** — an element-by-element scan for overflowing boxes finds
     nothing, and `position: fixed` overlays report as false positives.
     Fix by giving the word room, not by breaking it: `overflow-wrap` and
     hyphenation split words, which is the opposite of what dyslexic readers
     need.
- **Two brand greens, by role (all theme-invariant).** `--green` (#209D50 "LIT
  Green") is for large **surfaces** (heroes, questions block, chat bubbles) and
  non-button icon accents — it carries **ink** text (4.6:1) or white *large*
  headings, never small white text (only 3.5:1). `--green-deep` (#0F6B33 "Deep
  Green") is for **solid buttons/CTAs** with **white** labels (6.6:1). Both are
  fixed in dark mode, so a Deep-Green button stays readable in both themes and
  reads as an intentional second shade against LIT-Green surfaces. Do NOT use
  `--green-text` as a *button background* — it's a link/text token that flips to
  a light green in dark mode (white-on-it fails). For a green button, reach for
  `--green-deep`; for green text on a light background, `--green-text`.
- **The site emblem ships as two SVG variants**, `public/images/lit-logo-2026.svg`
  (plain) and `lit-logo-2026-ring.svg` (with a `--green` band). Same glyph, same
  `#FAFAF8` disc — the disc is deliberately the `--surface-raised` token, so on
  the `bg="white"` pages (`/apps`, `/glossary`) the plain variant's disc
  disappears into the page and the mark loses its containment. **That's why every
  on-page use takes the ringed variant**, including the OG cards (which no longer
  draw a ring of their own — `build-og-images.mjs` composites the ringed asset at
  its full outer diameter). The band runs *outside* the disc rather than being
  stroked into it, so both variants keep an identical glyph-to-disc ratio
  (0.84422); if you resize one, preserve that. The plain variant is for contexts
  that supply their own frame or need every pixel at tiny sizes — the band
  degrades to a hairline below ~24px, which is why the **tab favicons use plain
  and the touch/manifest icons use ringed**. `lit-logo-2026-ring.png` (1000×1000)
  is the raster fallback for the default `ogImage` only. Every icon is generated
  from these two SVGs by `npm run build:favicons` — never hand-edit
  `public/favicon.*`, `apple-touch-icon.png`, or `web-app-manifest-*.png`, or the
  set drifts from the source the way the previous emblem's hand-vectorized
  `favicon.svg` drifted from its raster master. The retired emblem and its icon
  set are archived in `_source-images/retired-emblem-2024/`.
- **The LSC brand mark is a different mark, mirrored from
  liberatingscripture.org.** Don't confuse it with the site emblem above: that
  one is LIT's, this one is the *organization's*. The Liberating Scripture
  Collective's dove appears on three pages here —
  `/liberating-scripture-collective` (hero lockup), `/support` (donate band),
  and the home page's fourth question card — via `src/components/LscMark.astro`
  + `src/lib/lsc-mark.mjs`, both copied verbatim from the LSC repo, which owns
  the mark. **When it changes there, re-copy both files.** Nothing is generated
  on this side; LSC's repo carries the build script for its favicon/OG forms,
  and `build:favicons` here has nothing to do with it.
  Both marks sit on a disc, but they solve the light/dark problem in opposite
  ways, so don't cross the wires: the LIT emblem's disc is a *fixed* `#FAFAF8`
  (hence the ringed variant, so it stays contained on near-white pages), while
  the LSC dove's is an *inverted coin* — the disc opposes the surface and the
  dove opposes the disc, driven by `--lsc-mark-disc` / `--lsc-mark-bird` in
  `global.css` (declared in all three blocks, per the dual-mechanism rule
  above). A surface that is a fixed darkness in **both** themes must pin its own
  pair locally or the mark disappears into its own background in one theme —
  `.questions-block` (a fixed `--green` band) does exactly that in `home.css`.
  Inline SVG is load-bearing here: an `<img src>` to an external SVG can't read
  these custom properties at all.
- **Search is two engines behind three client modules** in `src/scripts/`:
  - *Scripture keyword search* scans `public/search/verses.json` (built by
    `build-verse-index.mjs`) in the client — verse-exact results ("John 3:16"
    → `/john-3#v16`), whole-word/phrase matching (hyphens/apostrophes are
    word boundaries, diacritics folded: "lema" matches "lemá"). Default
    ordering is relevance (`rankVerseHits`: exact-form matches above
    related forms, more occurrences above fewer), with Bible order as the
    /search sort toggle. The file also ships the corpus `vocab`, from which
    the client derives two niceties for single unquoted tokens of 5+ chars:
    related-form matching ("liberation" finds "liberate" — the vocabulary
    is stem-grouped at load with `src/lib/word-stem.mjs`) and typo
    correction on zero hits ("jeribulem" → results for "jerusalem", with a
    "showing results for…" note; deliberately conservative — see
    `nearestVocabWord`). Quoted queries, phrases, and short tokens stay
    exact. The file (~275 KB gzipped) is fetched lazily, only when a
    keyword search actually runs. Scripture chapter pages are deliberately
    NOT in the Pagefind index.
  - *Pagefind* covers glossary + articles + book intros; *topics* come from
    `public/topics-index.json`. Intro hits render in a dedicated "Book
    introductions" group (a fifth bucket from `bucketSearchResults`, Bible
    order, titled "Mark — Introduction") so they can't be confused with
    scripture results — an owner decision (2026-07-09). A book filter still
    skips Pagefind entirely (glossary/articles carry no book value; intros
    do, but book-filtered searches stay scripture-only by design).
  - Module split: `search-core.js` holds all logic that must agree between
    the SearchBar tray and the full `/search` page (book aliases, reference
    parsing, the verse-index scanner, Pagefind query building, bucketing,
    topics-index loading); `searchbar.js` is the tray UI (loaded by
    `SearchBar.astro`); `search.js` is the `/search` page UI. Never duplicate
    parsing/bucketing logic into the UI modules — add it to `search-core.js`
    so both surfaces stay in sync.
- **Mobile apps are first-class consumers** of `public/api/` output — changing
  chapter/intro/manifest shape can break them. Treat the API as a contract.
  The **sync contract**: both apps poll `version.json` first and do nothing
  further unless its `version` string differs from what they last stored (a
  cheap ~80-byte check, run at most once/24h on foreground + a ~6h background
  task + on-demand pull-to-refresh). Only on a change do they fetch
  `manifest.json` and download the files whose SHA-256 hashes moved. **So the
  whole system only works if `version` bumps on every content publish** — which
  is why it's content-derived (see build step 4), not date-only. The sync-
  critical files (`version.json`, `manifest.json`, `data/*`) are served
  `no-store` in `public/_headers` so a version bump is never served alongside a
  stale manifest or data file.
- **One announcement popover at a time.** `Layout.astro` renders exactly ONE
  popover component (currently `AppsLaunchPopover.astro`, the iOS/Android
  launch). Retiring an announcement means swapping that import and leaving the
  old component in the repo **unimported**, not deleting it
  (`WelcomePopover.astro` is the retired Collective announcement) — so a past
  one can be brought back by swapping the import back. Two rules for any
  replacement: (1) give it a **fresh cookie name**, or everyone who dismissed
  the previous announcement never sees the new one; (2) carry over the show
  gating — 2nd-or-later pageview via the `lit_pv` sessionStorage counter, plus
  the `/^#v\d+$/` verse-deep-link guard — which exists to avoid Google's
  intrusive-interstitial penalty on search-landing pages (FIXLIST O3, an owner
  decision). The popover also suppresses itself on a small path allowlist
  (`SUPPRESSED_PATHS`): `/apps`, its own CTA destination, and `/privacy`, which
  people open to read terms rather than to be pitched to.
- **The /apps mirror: litbible is upstream for the LSC site.**
  `liberatingscripture.org/apps` is the same page, and these files are kept
  **byte-for-byte identical** in both repos at the same paths: everything under
  `src/components/apps/`, `src/styles/pages/apps.css`, and the section content
  in `src/content/{callouts,examples,seasons}/`. Edit them **here**; LSC copies
  them across. Two things are deliberately NOT mirrored — `src/pages/apps.astro`
  (two sites can't share a canonical URL, so LSC keeps its own Layout props and
  JSON-LD) and LSC's `apps-bridge.css` (which exists precisely so `apps.css` can
  stay a pure mirror).
  The screenshot **bytes** under `public/assets/screenshots/` are a third,
  different case. They were an exception until LSC adopted litbible's
  ~2x-display-size copies (FIXLIST O8); the 12 files both repos ship are now
  byte-identical. But they are **matched by hand, not enforced**:
  `check-apps-mirror.mjs` reads every file as UTF-8 and folds CRLF, which
  mangles binaries, so putting them in `MIRRORED` would need a hash path the
  script doesn't have. Re-copy them if either side re-exports, and note that
  `_source-images/screenshots/` here now holds the only full-resolution
  originals outside LSC's git history.
  This is why **`public/assets/` is the mirrored asset tree** — `assets/screenshots/`
  and the two `assets/images/lit-app-icon.*` files use lowercase-kebab names with
  no spaces so both repos' components can carry identical `src` strings.
  `public/images/` is litbible-only and **cannot move**: it's referenced ~191
  times across ~84 files including chapter JSON, which ships to the native apps
  as an API contract.
  Enforcement runs from both ends. LSC's `apps-mirror.yml` fails a PR that edits
  a mirrored file into a state that doesn't match litbible's `main`, scoped to
  the PR's own changed files so LSC lagging behind never reddens an unrelated PR.
  In this repo, `.github/workflows/apps-mirror-notify.yml` opens (or comments on)
  an issue in the LSC repo when a mirrored file lands on `main`. It's
  **notify-only by design** — LSC being briefly behind is normal, and failing
  litbible's CI over it would put a red X on a contributor who did nothing wrong.
  It needs the `LSC_SYNC_TOKEN` secret and skips with a warning if it's absent.
  That same workflow also watches `/privacy`, which is **not** a mirror: the two
  policies cover two different entities and are written separately (owner
  decision), so the notification says "review", never "copy".
- **Release notes are automated**: pushing changes to chapters, intros, glossary,
  or articles on `main` triggers `.github/workflows/release-notes.yml`, which
  runs `draft-release-notes.mjs` and commits to `release-notes.json`. That file
  is also synced to the apps (`/api/data/release-notes.json`) as their
  "Translation Updates" feed, so its **change-object shape is a contract**: each
  change carries a self-contained `description` plus additive/optional
  enrichment — `detail` (pure before→after), `location` (`bookKey`/`chapter`/
  `verse` for deep-linking scripture changes), and `relabel` (the footnote
  letter-cascade note, split out of `description`). A footnote inserted or
  removed mid-chapter is reported as **added/removed at the label where the
  cascade starts**, not as an edit of the note it displaced — otherwise the
  `detail` pairs two unrelated notes and reads as though the displaced one was
  rewritten. See the docblock in `draft-release-notes.mjs` for the field-by-field
  spec. (A stable per-footnote
  `footnoteId` for exact-footnote deep links is intentionally not emitted yet —
  it needs a matching stable anchor in the chapter JSON first.) The drafter
  reports **reader-facing changes only**: modified chapters diff rendered verse/
  footnote text (attribute- or metadata-only chapter edits collapse to one
  "metadata updated" line), and modified intros/glossary/articles are compared
  with HTML attributes and whitespace normalized away — so a mechanical edit
  (e.g. stripping `target="_blank"` from a link) produces no changelog entry.
- **The contact + app-support forms are self-hosted**: `/contact` posts to
  `/contact/submit` and `/app-support` posts to `/app-support/submit`, both
  served by a single standalone Cloudflare Worker in `workers/contact-form/`
  (deliberately outside `/api/*`, the app-sync namespace) that verifies the
  Turnstile token server-side and delivers mail via Email Routing's
  `send_email` binding. The Worker keys off the request pathname to pick a
  per-form config: each form has its own Turnstile widget (own secret) and its
  own destination inbox, so app-support mail lands in a different inbox than
  contact mail. Each route also takes an optional `*_DISPLAY_TO` secret — a
  branded alias shown in the `To:` header while delivery still targets the real
  (verified) inbox, with a one-time retry if Cloudflare rejects the mismatch
  (mirrors the liberatingscripture.org contact Worker). It deploys separately
  from the site (owner-run `wrangler
  deploy` — see its README, which also carries the one-time dashboard/secret
  setup for the app-support route); native POSTs (the fallback when fetch is
  blocked; Turnstile still needs JS to render, so a genuinely JS-less visitor
  can't pass the check) 303-redirect to the matching `…/thanks/` page.
  **Adding a route means redeploying the Worker before the site deploy that
  publishes the new form**, or the POST hits the Pages 404.
- **Security headers / CSP** live in `public/_headers` (deploy-only — `dev`
  and `astro preview` don't apply them). The CSP is deliberately split (owner
  decision 2026-07-10): an ENFORCED header carries only structural directives
  that can never break an integration (`frame-ancestors`, `object-src`,
  `base-uri`, `form-action`), while the full resource allowlist
  (script/connect/frame/img/etc.) is `Content-Security-Policy-Report-Only` —
  documentation + telemetry, blocks nothing. Two maintenance rules:
  (1) if a form's backend changes (as when the self-hosted contact Worker
  replaced Formspree), update the enforced `form-action` list in the same
  change;
  (2) when adding any new third-party integration, add its origins to the
  report-only allowlist so it stays an accurate inventory. **Revisit enforcing
  the full policy if the site ever gains logins/accounts/sessions** (e.g. a
  members area) — the "static site with no secrets" premise behind the
  report-only decision stops holding at that point.
- **Agent/AI discovery surface** lives in static files, all served as-is from
  `public/`. They only take effect on a deployed Cloudflare Pages site — `dev`
  and `astro preview` do **not** apply `_headers`:
  - `public/.well-known/api-catalog` — RFC 9727/9264 `linkset+json` pointing at
    the public API (`/api/content.json`, `/api/manifest.json`) with `service-doc`
    (→ `llms-full.txt`) and `status` (→ `/api/version.json`) relations. It's
    extensionless, so `_headers` sets its `Content-Type: application/linkset+json`.
  - `public/_headers` adds `Link:` headers (RFC 8288) on `/*` advertising the
    catalog (`rel="api-catalog"`) and docs (`rel="service-doc"`).
  - `public/robots.txt` carries a `Content-Signal` line. Keep it consistent with
    the CC BY-NC-ND license and `llms.txt`: `ai-train=no` (no broad LLM training),
    `search=yes`, `ai-input=yes` (RAG/inference welcome). The site has no auth,
    MCP server, or write API, so OAuth/MCP/WebMCP discovery files are intentionally
    absent — don't add them without a real backing service.

## Git Workflow

- **`main` is protected** — direct pushes are rejected; changes land via PR.
  Session work typically happens in a per-task branch/worktree (e.g.
  `.claude/worktrees/<task>/` on branch `claude/<task>`).
- **After a PR you opened is merged, clean up the branch and worktree** in
  the same session rather than leaving them for later:
  1. `git push origin --delete <branch>` — delete the remote branch (GitHub's
     "delete branch" button does the same thing; do this even if the repo
     doesn't auto-delete on merge).
  2. `git worktree remove <path>` from a **different** worktree (a worktree
     can't remove itself while it's the current directory) — then
     `git branch -d <branch>` to delete the now-unreachable local branch.
  3. If `git worktree remove` reports the directory as busy/permission-denied,
     the *session itself* is still rooted there (its own working directory) —
     git will still unregister it from `git worktree list`, but the leftover
     directory can't be deleted until that session ends. Say so plainly rather
     than retrying; don't touch other worktree directories under
     `.claude/worktrees/` that aren't the one just merged, since those are
     other sessions' in-progress work.
- Skip this cleanup for a branch/worktree still mid-task, or one the user
  says to keep.

## Important Files

| Path | Purpose |
|------|---------|
| `src/data/books.js` | Source of truth for NT book list + chapter counts |
| `src/pages/[slug].astro` | Scripture chapter pages (Study View) |
| `src/pages/read/[book].astro` | Continuous reading view |
| `src/scripts/chapter-tools.js` | Verse highlight/menu + footnote popovers |
| `src/styles/global.css` | Main stylesheet |
| `astro.config.mjs` | Site config, redirects, sitemap/noindex draft logic |
| `content.config.ts` | Content-collection schemas |
| `scripts/validate-chapters.mjs` | Chapter validator (pre-commit + CI safety net) |
| `scripts/build-verse-index.mjs` | Verse search index generator (`public/search/verses.json`) |
| `pagefind.yml` | Pagefind config for glossary/article indexing (excludes footnote refs) |
| `public/_headers` | Security + caching headers; also RFC 8288 `Link` headers for agent discovery (Cloudflare Pages) |
| `public/.well-known/api-catalog` | RFC 9727/9264 `linkset+json` catalog of the public API |
| `public/llms.txt`, `llms-full.txt` | LLM-readable site description + AI-usage policy |
| `DISASTER-RECOVERY.md` | Continuity doc: every dashboard/secret behind the deploy (names only, no values) + the DNS inventory + from-zero redeploy path. Update it when an integration, secret, or DNS record is added/removed. |

> The top-level `README.md` is the lighter human-facing overview; this file is
> the deep reference. Keep both in sync per the note at the top.
