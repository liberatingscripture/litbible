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

- **Framework**: Astro 6 (static site generator; `output` is static)
- **Language**: TypeScript (strict mode, `astro/tsconfigs/strict`)
- **Styling**: Vanilla CSS (no utility framework). Global stylesheet + a
  per-page stylesheet under `src/styles/pages/`
- **Search**: two engines — scripture keyword search scans a build-generated
  verse index (`public/search/verses.json`, fetched lazily by the client);
  Pagefind (static, build-time index over `dist/`) covers glossary + articles
  + book intros
- **Fonts**: `@fontsource` (Crimson Text, Fraunces, Inter, OpenDyslexic)
- **Icons**: simple-icons
- **Client JS**: Hand-written vanilla JS in `src/scripts/` (progressive
  enhancement only — no client framework, no hydration). The site is fully
  functional with JS disabled.

## Common Commands

```bash
npm run dev               # Dev server at localhost:4321
npm run build             # Full production build (see pipeline below)
npm run preview           # Build + astro preview locally
npm run validate:chapters # Validate all chapter JSON (structure + references)
npm run fix:chapters      # Re-serialize chapter JSON to normalize formatting
npm run build:topics      # Regenerate topics indexes only
npm run build:verses      # Regenerate the verse search index only
npm run build:api         # Regenerate public/api/content.json only
npm run build:manifest    # Regenerate API manifest + /api/data for the mobile apps
npm run build:og          # Regenerate the chapter/intro share cards (public/og/)
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
   emblem in a green ring, Fraunces display-cut reference). Text is converted
   to SVG paths with opentype.js using fonts committed in `scripts/og/fonts/`
   (no system-font dependency), then rasterized with sharp — deterministic
   output. The pages reference the cards via Layout's `ogImage` prop plus
   `twitter:card=summary_large_image`. A website asset, NOT part of the app
   contract — it must never move under `public/api/`.
7. `astro build` — compiles the site to `dist/`.
8. `pagefind --site dist` — indexes glossary + article + book-intro pages
   into `dist/pagefind/` (scripture chapter pages are deliberately not
   Pagefind-indexed — see Search below).

## Project Structure

```
src/
  assets/            # Bundled assets (SVGs) processed by Astro
  components/        # Reusable .astro components (SiteHeader, SearchBar, cards, …)
  content/
    articles/        # Blog/teaching articles (Markdown, ~13 files)
    glossary/        # Glossary entries (Markdown w/ frontmatter, ~31 files)
  content.config.ts  # Astro content-collection schemas (articles + glossary)
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
                     #   and ReadMenu), fetchPodcastEpisodes.ts
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
                     #   images/, icons)
emails/              # Standalone HTML email templates (not part of the site build)
.githooks/           # pre-commit hook (validates staged chapter JSON)
.github/workflows/   # ci.yml (chapter validation + full build on push/PR),
                     #   release-notes.yml (auto-updates release-notes.json on push)
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
| others | `about`, `contact`, `courses`, `support`, `privacy`, `unsubscribe`, `found-in-translation-podcast`, `liberating-scripture-collective`, `translation-commitments`, `404` |

Redirects (`/read-now`→`/read`, `/podcast`→`/found-in-translation-podcast`) and
the sitemap filter live in `astro.config.mjs`.

## Build / Validation Scripts (`scripts/`)

| Script | Role |
|--------|------|
| `validate-chapters.mjs` | Validates chapter JSON (with `--fix` to re-serialize). Driven by `chapter_json_invariants.json`. |
| `chapter_json_invariants.json` | Documents validation rules (e.g. the `indexed` flag). |
| `build-topics-index.mjs` | Topic indexes (`normalizeTopic` slugifies labels). |
| `build-verse-index.mjs` | `public/search/verses.json` — per-verse plain text for client-side scripture keyword search. |
| `build-api-json.mjs` | `public/api/content.json`. |
| `build-api-manifest.mjs` | `public/api/manifest.json` + `public/api/data/` for the native apps. |
| `build-og-images.mjs` | `public/og/` — per-chapter/intro share cards (fonts in `scripts/og/fonts/`). |
| `fetch-podcast-feed.mjs` | Refresh podcast XML snapshot (non-fatal on failure). |
| `draft-release-notes.mjs` | Drafts release-notes entries from git diffs (used by CI). |

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
     *every* chapter of that book is a draft.
  **Flip it to `true`** (do not delete the field) when real content lands.
- Always run `npm run validate:chapters` after editing chapter JSON. The
  pre-commit hook validates staged chapter files automatically.

## Content Collections (`src/content.config.ts`)

Two collections, both loaded via Astro's `glob` loader:

- **`articles`** — `src/content/articles/*.md`. Schema: `title`, `date`,
  optional `author`/`description`/`heroImage`/`featured`, `tags[]`.
- **`glossary`** — `src/content/glossary/*.md`. Schema pairs a `traditional`
  term with the LIT rendering (`greek`, `lit`, `litMenu`, `srOnly`, optional
  `note`/`menuTraditional`). Files are named `<traditional>-<lit>.md`
  (e.g. `hell-hades.md`).

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
- **Release notes are automated**: pushing changes to chapters, intros, glossary,
  or articles on `main` triggers `.github/workflows/release-notes.yml`, which
  runs `draft-release-notes.mjs` and commits to `release-notes.json`. That file
  is also synced to the apps (`/api/data/release-notes.json`) as their
  "Translation Updates" feed, so its **change-object shape is a contract**: each
  change carries a self-contained `description` plus additive/optional
  enrichment — `detail` (pure before→after), `location` (`bookKey`/`chapter`/
  `verse` for deep-linking scripture changes), and `relabel` (the footnote
  letter-cascade note, split out of `description`). See the docblock in
  `draft-release-notes.mjs` for the field-by-field spec. (A stable per-footnote
  `footnoteId` for exact-footnote deep links is intentionally not emitted yet —
  it needs a matching stable anchor in the chapter JSON first.)
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

> The top-level `README.md` is the lighter human-facing overview; this file is
> the deep reference. Keep both in sync per the note at the top.
