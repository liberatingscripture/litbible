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

## How these docs are split

**This file holds only what applies anywhere in the repo.** Each area's detail
is in a `CLAUDE.md` beside its code, which Claude Code loads by itself the first
time a session reads a file in that directory. That covers most work, not all
of it: `src/lib/` is one flat directory serving several areas, and a task can
start from a page or a test. So **before working in an area, read its file
below unless it is already loaded.** Two rules keep this from decaying:

- **A new rule goes in its area's file, never here**, unless it applies
  everywhere. A new area file gets a row in the table below.
- `test/claude-docs.test.js` fails when this file outgrows its size limit, when
  a file the table names is missing, or when a `CLAUDE.md` on disk has no row.

| Read | Before working on |
|------|-------------------|
| `src/data/chapters/CLAUDE.md` | Chapter JSON: its format, `indexed` (drafts), curly quotes, en dashes, the validator's rules, poetry blocks (`hbq`), topics, the SBLGNT policy, bracketed passages, verse-number gaps |
| `src/scripts/CLAUDE.md` | Reader tools in `src/scripts/` (the verse menu, the selection panel, sharing, verse images, printing and handouts, search, Continue reading, Read View's landing, keyboard shortcuts) and the module map of `src/scripts/` |
| `src/scripts/desk/CLAUDE.md` | Anything to do with the Study Desk, wherever it lives: `src/lib/desk-*.mjs`, the /desk, /notebook and /sheets pages, `desk.css`, `public/greek/`, Greek search |
| `src/lib/CLAUDE.md` | The module map of `src/lib/`; scripture reference linking (Sefaria, eBible), external links, Go deeper, the release notes page and feed |
| `src/styles/CLAUDE.md` | CSS anywhere, including component `<style>` blocks: theming, the Display tray's settings, `--ch`, Greek and Hebrew fonts, the brand greens, the emblem, the LSC mark, focus rings |
| `src/layouts/CLAUDE.md` | Study View's phone toolbar; chapter prefetching |
| `src/content/CLAUDE.md` | Articles, glossary entries, the /apps collections; the apps' glossary feed |
| `src/data/alignment/CLAUDE.md` | The alignment dataset, both review tools, MorphGNT, /glossary's "Where it appears", the term lens |
| `src/components/CLAUDE.md` | The announcement popover |
| `src/components/apps/CLAUDE.md`, `scripts/apps-studio/CLAUDE.md` | The /apps mirror shared with the LSC site; the page's section data; the Apps Page Studio (Brandon's editing board, its scripts, the `/apps-studio` skill) |
| `src/pages/CLAUDE.md` | The podcast page's embeds |
| `scripts/CLAUDE.md` | The build pipeline step by step, the table of `scripts/`, release-notes automation, raw-byte hashing and line endings, the importer |
| `scripts/reconcile/CLAUDE.md` | The Word masters and the reconcile toolchain |
| `scripts/alignment-review/CLAUDE.md`, `scripts/alignment-words/CLAUDE.md` | Pointers to the alignment file |
| `public/CLAUDE.md` | `_headers`, the CSP, the agent discovery files |
| `workers/CLAUDE.md` | The contact and app-support form Worker |
| `.github/CLAUDE.md` | Dependabot's configuration |

### Rules that apply everywhere

Each is stated in full in its area's file; these are the ones whose breakage is
silent or expensive.

- **Never write a chapter file with `JSON.stringify(data, null, 2)`.** Use
  `npm run fix:chapters`, or raw-string replacement for a small edit. The apps
  hash chapter files by raw bytes, so a needless round-trip re-downloads the
  corpus on every install. Prose takes curly quotes only. Run
  `npm run validate:chapters` after any chapter edit.
- **After any change to scripture wording**, run `npm run audit:alignment` and
  `npm run audit:words`, and re-check the chapter's topics.
- **Dark-mode styles need both selectors** (the OS media query guarded by
  `:root:not([data-theme="light"])`, and `:root[data-theme="dark"]`). Size text
  columns with `--ch`, never the `ch` unit; focus rings use `--focus-ring`.
- **A link that leaves the site opens in a new tab** with
  `rel="noopener noreferrer"`; a hand-written anchor in an `.astro` file needs
  both attributes itself.
- **The Study Desk is downloaded only with `data-desk="on"`.** Shared reader
  code never imports it statically: it dispatches events or makes a gated
  dynamic import. Read the desk file before touching a shared panel.
- **`STUDY-DESK.md` (about 470 KB) and `STUDY-DESK-AUDIT-1.md` are too large to
  read whole.** Grep for the ID or heading and read that section.

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
- **Node**: `.node-version` (24, the major CI uses) is what Cloudflare Pages
  builds with; with no pin, Pages falls back to its image's default, and a
  2026-10 Astro minor that raised its floor to 22.22 failed every Pages
  build while GitHub CI stayed green. Keep `engines` in `package.json` (and
  the root `engines` copy in `package-lock.json`) at the higher of Astro's
  minimum and the test suite's, and leave the dashboard's `NODE_VERSION`
  unset so it doesn't override the file.
- **Language**: TypeScript (strict mode, `astro/tsconfigs/strict`)
- **Styling**: Vanilla CSS (no utility framework). Global stylesheet + a
  per-page stylesheet under `src/styles/pages/`
- **Search**: two engines — scripture keyword search scans a build-generated
  verse index (`public/search/verses.json`, fetched lazily by the client);
  Pagefind (static, build-time index over `dist/`) covers glossary + articles
  + book intros. A third, the Greek (`public/greek/search/`), runs only with
  the Study Desk preview on until the desk is released ("The Study Desk
  preview", rule 15)
- **Fonts**: `@fontsource` (Crimson Text, Fraunces, Inter) plus two
  reader-selectable accessibility fonts, OpenDyslexic and Atkinson
  Hyperlegible Next (the latter variable, via `@fontsource-variable`) — see
  the Display tray note below. Playpen Sans (variable) is the Study Desk's
  margin-note face, loaded only by the desk (see "The Study Desk preview"). All of them load Latin only; Greek and Hebrew
  letters come from Inter's own Greek, Noto Sans Hebrew and Cardo, registered
  by character range (see "Greek and Hebrew letters" under Key Conventions)
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
npm run import:chapter -- --docx=<path> --book=<key> --chapter=<n> --report
                          # Build chapter JSON from a Word master (on demand only).
                          #   --report inspects and writes nothing; that is the normal
                          #   first run. See The Importer below for what it refuses to
                          #   touch, and why that is the point
npm run check:links       # Verify every internal href/#fragment in dist/ resolves
                          #   (a verse range #v16-18 resolves when both ends exist)
npm test                  # Run the node:test unit suite — two roots: test/**/*.js
                          #   and scripts/reconcile/test/**/*.mjs. Both globs are in
                          #   the script; a new test root is invisible to CI until
                          #   it is added there (the reconcile files sat unrun once)
npm run build:topics      # Regenerate topics indexes only
npm run build:verses      # Regenerate the verse search index only
npm run build:api         # Regenerate public/api/content.json only
npm run build:glossary    # Regenerate the apps' glossary feed (public/glossary.json)
npm run build:greek-bridge # Regenerate the Greek search's glossary bridge (public/search/greek-bridge.json)
npm run build:manifest    # Regenerate API manifest + /api/data for the mobile apps
npm run build:api2        # Regenerate /api/data/v2, the content API version 2
npm run build:og          # Regenerate the chapter/intro share cards (public/og/)
npm run build:favicons    # Regenerate the favicon/touch/manifest icons from the emblem SVGs
                          #   (on demand only — outputs are committed, not built)
npm run build:bracket-font # Regenerate public/fonts/bracket-markers.otf (the ⟦/⟧ glyph patch)
                          #   (on demand only — output is committed, not built)
npm run build:text-critical-font # Regenerate public/fonts/text-critical-signs.otf (the
                          #   SBLGNT's ⸀–⸅ signs, from full Cardo; on demand only, committed)
npm run build:greek       # Regenerate public/greek/, the Study Desk's Greek tab data, from
                          #   SBLGNT, MorphGNT, MACULA, UBS and STEPBible clones outside the
                          #   repo (GREEK_SOURCES_DIR, MORPHGNT_DIR). On demand only, committed
npm run build:apps-qr     # Regenerate public/images/apps-qr.svg, the app announcement's QR code
                          #   (on demand only — output is committed, not built)
npm run build:alignment   # Rescan the text for glossary-term renderings (src/data/alignment/)
                          #   (on demand only — output is committed and carries review state)
npm run review:alignment  # Localhost review tool for that dataset (see below). Needs the
                          #   MorphGNT clone; writes to src/data/alignment/ as you decide
npm run review:words      # Localhost tool for alignment PHASE 2: link every SBLGNT word to
                          #   the LIT words that render it, verse by verse (port 4501).
                          #   Needs the MorphGNT clone; writes src/data/alignment-words/
                          #   (see "Phase 2 tooling" below). --chapters-dir=<dir> aligns
                          #   English not yet in the corpus
npm run audit:words       # Re-check every stored phase 2 record against today's English and
                          #   Greek (stale = no longer fits; carried = moved by a revision,
                          #   not yet saved). Run after revising scripture; repair happens
                          #   in review:words
npm run build:anchor-vectors # Regenerate test/fixtures/anchor-vectors.json, the Study Desk
                          #   anchor-text vectors the apps run (on demand only — committed,
                          #   and its "before" texts come from git history)
npm run build:api2-vectors # Regenerate test/fixtures/api2-vectors.json (on demand; committed)
npm run audit:alignment   # Re-check decided alignment records against the current text
                          #   (--all to list every finding). Run after editing scripture
npm run draft:release-notes -- --since <ref>  # Draft a release-notes entry from git diff
npm run studio:apps -- <seed|apply|check|board-css|board-files>  # The Apps Page Studio's
                          #   scripts; the /apps-studio skill runs them (src/components/apps/CLAUDE.md)
```

### Build Pipeline, in brief

`fetch:podcast` → `build:topics` → `build:verses` → `build:glossary` →
`build:greek-bridge` → `build:manifest` → `build:api` → `build:og` →
`astro build` → `pagefind --site dist`. The order is load-bearing:
`build:glossary` must run before `build:manifest`, which owns the content
`version`, and `build:api` reads that version afterwards. A podcast fetch
failure never fails the build. What each step writes, and why, is in
`scripts/CLAUDE.md`.

## Project Structure

```
src/
  assets/            # Bundled assets (SVGs) processed by Astro
  components/        # Reusable .astro components (SiteHeader, SearchBar, cards, …)
                     #   apps/ holds the /apps promo page sections
  content/
    articles/        # Blog/teaching articles (Markdown, ~13 files)
    glossary/        # Glossary entries (Markdown w/ frontmatter, ~47 files)
    apps-sections/   # /apps: each section's copy, pictures, background, order (JSON)
    callouts/, examples/, seasons/   # /apps promo section content (Markdown)
  content.config.ts  # Astro content-collection schemas (articles, glossary,
                     #   + the four /apps ones from components/apps/collections.ts)
  data/
    chapters/        # 260 JSON files — one per NT chapter (e.g. john-3.json)
    alignment/       # Greek↔English alignment records, one file per chapter
                     #   (see The Alignment Dataset below). COMMITTED, not
                     #   generated at build time — carries human review state
    intros/          # Book intro Markdown, one per book (e.g. john-intro.md)
    books.js         # NT book constants: BOOKS (chapter counts), BOOK_ORDER,
                     #   bookKeyToLabel(), BOOK_ABBREVIATIONS — the single
                     #   source for book names
    podcast-feed.xml # Committed podcast snapshot (refreshed by fetch:podcast)
    podcastOverrides.json     # Manual episode metadata overrides
    release-notes.json        # "What's new" entries (auto-appended in CI)
    release-notes-skip.md     # log of publishes deliberately kept out of that feed;
                     #   touching it moves the workflow’s base ref (see below)
    translation-commitments.json
  layouts/           # Layout, ScriptureLayout, ReadLayout, SearchLayout
  lib/               # Server-side build helpers, mostly pure and unit-tested;
                     #   module map in src/lib/CLAUDE.md
  pages/             # File-based routes (see Routing below)
  scripts/           # CLIENT-side vanilla JS: the reader tools, and desk/, the
                     #   Study Desk preview; module map in src/scripts/CLAUDE.md
  styles/            # global.css, read-mode.css, scripture-tools.css, articles.css,
                     #   greek-hebrew-fonts.css (imported by global.css),
                     #   pages/<page>.css (per-page stylesheets), desk.css
                     #   (the desk's own; the shell adds it, never a page)
scripts/             # BUILD/validation Node scripts (.mjs) — see below
                     #   (og/fonts/ holds the committed TTFs the share-card
                     #   generator renders with — see its README)
  alignment-review/  # Localhost-only review tool for src/data/alignment/.
                     #   NOT part of any build and never shipped: its ui/ is
                     #   served from the Node process by exact-path allowlist,
                     #   deliberately NOT from public/ (Astro copies public/
                     #   into dist/ as a filesystem op — .gitignore there
                     #   prevents committing, not deploying)
  alignment-words/   # Phase 2's tool (word-to-word alignment), kept apart from the
                     #   glossary tool above: core.mjs (pure, unit-tested), store.mjs
                     #   (fs + MorphGNT), server.mjs, ui/. Writes
                     #   src/data/alignment-words/, never src/data/alignment/
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
                     #   in that dir); root `npm ci`/`npm test` don't reach it.
                     #   Its tests run in workerd via @cloudflare/vitest-plugin,
                     #   which pins wrangler EXACTLY: our wrangler range must
                     #   only admit that pin, or the tree splits into a second,
                     #   nested wrangler/miniflare/workerd (README, "wrangler's
                     #   version is set by…")
.githooks/           # pre-commit hook (validates staged chapter JSON)
.github/workflows/   # ci.yml — `build` job (chapter validation, type-check, unit
                     #   tests, full build, internal-link check on push/PR) plus a
                     #   separate `worker-tests` job (workers/contact-form has its
                     #   own dep tree, so it needs its own npm ci);
                     #   release-notes.yml (auto-updates release-notes.json on push);
                     #   apps-mirror-notify.yml (tells the LSC repo when a
                     #   mirrored /apps file or /privacy changes — see
                     #   The /apps mirror below)
.github/dependabot.yml  # Three update streams (npm at `/`, npm at
                     #   `/workers/contact-form`, github-actions); see
                     #   .github/CLAUDE.md before changing it
```

> Note: client-side code lives in `src/scripts/` while build-time Node scripts
> live in the top-level `scripts/`. Don't confuse the two.

### Routing (`src/pages/`)

| Route | File | Purpose |
|-------|------|---------|
| `/<book>-<chapter>` | `[slug].astro` | Scripture chapter ("Study View") |
| `/<book>-intro` | `[book]-intro.astro` | Book introduction |
| `/read` | `read.astro` | The /read landing (Study View, Read View, the apps) |
| `/read/<book>` | `read/[book].astro` | Read View: a whole book on one page |
| `/articles`, `/articles/<slug>` | `articles.astro`, `articles/[...slug].astro` | Articles |
| `/glossary` | `glossary.astro` | Glossary |
| `/search` | `search.astro` | Full search UI (verse index + Pagefind) |
| `/notebook`, `/notebook/help` | `notebook.astro`, `notebook/help.astro` | The Study Desk preview's notebook page and help page. noindex, out of the sitemap and Pagefind; empty for anyone without the preview (`?desk=on`). See "The Study Desk preview" |
| `/desk` | `desk.astro` | The Study Desk as a page of its own (D9): one to four panes. Same treatment as `/notebook`: noindex, out of the sitemap and Pagefind, and a short note without the preview. See "The Study Desk preview", rule 18 |
| `/sheets` | `sheets.astro` | A sheet's own address (3i): `/sheets/` lists the reader's sheets, `/sheets/?id=<id>` shows one as a leader or participant copy, to print or copy for Word, or presents it to a room (3j; `&view=present`, and `&view=presenter` for the presenter view's window). `/sheets/#share1.<data>` is a sheet someone shared (3k). Never edits. Same treatment as `/desk`. See "The Study Desk preview", rules 19 and 21 |
| `/release-notes` | `release-notes.astro` | "What's new": the release notes by month, filterable by book and kind of change. `/translation-updates.xml` (`translation-updates.xml.js`) is the same record as RSS. See "Release notes are automated" below |
| `/apps` | `apps.astro` | Mobile-apps promo page (footer-linked). Body design ported from `BDRhodes/LIT-app-Promo`; every section's content is data (`apps-sections`, `callouts`, `examples`, `seasons`), laid out in order by `components/apps/AppsPage.astro` and edited through the Apps Page Studio; scoped styles in `src/styles/pages/apps.css`. Uses `bg="white"` (near-white surface). |
| `/app-support` | `app-support.astro` | App support contact form (linked from inside the apps, not the site nav; `/app-support/thanks` is the native-POST fallback success page) |
| `/found-in-translation-podcast` | `found-in-translation-podcast.astro` | Podcast page (`/podcast` redirects here). Its embeds are three deliberately different shapes, and only the Apple one is derived at build: read `src/pages/CLAUDE.md` before touching them |
| `/404` | `404.astro` | Not found. Its script reads the address with `resolveMistypedPath` (in `search-core.js`, the same parser as the search box), so a guessable scripture address lands on its page: `/John-3`, `/jn-3`, `/john-3-16`, `/john/3`, `/1-corinthians-13`, `/read/1-corinthians`. A known book with a chapter it doesn't have (`/john-30`) gets "Did you mean John?" instead of a redirect; anything else, and no JS, leaves the page as it was. |
| others | `about`, `contact` (+ `contact/thanks`), `courses`, `support`, `privacy`, `unsubscribe`, `liberating-scripture-collective`, `translation-commitments` |

Redirects (`/read-now`→`/read`, `/podcast`→`/found-in-translation-podcast`) and
the sitemap filter live in `astro.config.mjs`.

## Build / Validation Scripts

The table of every script in `scripts/` and its role is in `scripts/CLAUDE.md`.

## Key Conventions

- **Reader-facing copy follows American conventions** (BVJ, 2026-10-13):
  page text, button labels, aria-labels, panel and tour copy, error
  messages, anything a reader sees or hears.
  - **Spelling**: color, favorite, behavior, center, gray, canceled.
  - **Punctuation with quotation marks**: periods and commas go inside the
    closing quote (write `choose “Save.”`, never `choose “Save”.`),
    semicolons and colons go outside, and a question mark or exclamation
    point goes inside only when it belongs to what is quoted.
  - **The Oxford comma, always** (BVJ, 2026-10-14): “notes, highlights,
    bookmarks, and the Greek.”
  - Quotes are curly (“ ” and ‘ ’), as the chapter JSON rule below requires
    for scripture.
  This governs text Claude writes. **The translation, footnotes, intros and
  articles are the owner's** and come from the Word masters, so a British
  form found there is reported to BVJ, never silently changed. A 2026-10-13
  audit found four: `1corinthians-14` (“all things are lawful…”, before a
  citation), `hebrews-8` (“After those days:”), `james-intro`
  (“…big things”,) and the `many-and-all` article (“…many!”,), plus the
  shared *hupotasso* note's nested ‘…burden’.” and similar single-quote
  closes. Code comments and internal docs aren't held to it, though new
  ones should follow it.
- **Book keys**: lowercase, no spaces, no hyphens — `john`, `1corinthians`,
  `revelation`. Source of truth is `src/data/books.js` (`BOOKS`, `BOOK_ORDER`).
- **Chapter file naming**: `{bookKey}-{chapter}.json` (e.g. `1corinthians-1.json`).
- **Generated files are git-ignored** and regenerated at build time:
  `public/api/`, `public/og/`, `public/search/topics.json`,
  `public/search/verses.json`, `public/search/chapters/`,
  `public/search/greek-bridge.json`, `public/topics-index.json`,
  `public/glossary.json`, `dist/`, `.astro/`.
  Don't hand-edit them. Eight generators are deliberately **outside** this rule
  because their output is committed and hand-maintained — `build:favicons`
  (icons), `build:alignment` (review state), `build:bracket-font`
  (`public/fonts/bracket-markers.otf`), `build:text-critical-font`
  (`public/fonts/text-critical-signs.otf`), `build:apps-qr`
  (`public/images/apps-qr.svg`), `build:anchor-vectors`
  (`test/fixtures/anchor-vectors.json`, which the apps fetch),
  `build:api2-vectors` (`test/fixtures/api2-vectors.json`, likewise), and
  `build:greek` (`public/greek/`, built from sources CI doesn't have); none
  of the eight runs in `npm run build`.
- **No client JS framework**, but `src/scripts/` *does* hold vanilla JS for
  progressive enhancement (verse highlighting/menus, footnote popovers, reading
  mode, search). Everything must degrade gracefully without JS.
- **Study View and Read View differ in what a page holds, and that decides
  where a new tool goes** (owner, 2026-09-30). Study View is one chapter
  with everything the site has for it: footnotes, the verse menu, the term
  lens, reference previews, Go deeper. Read View is a whole book on one page,
  read straight through, with no notes and no page turn between chapters.
  Since the shared Display tray and the shared copy actions, the two look
  alike, so the rule is written down rather than re-argued per feature:
  **Read View gets what serves reading a book straight through** (display
  settings, the selection panel and its handouts, keeping and restoring a
  place, print, focus mode), and **a tool about a verse or a word goes in
  Study View only** unless the owner decides otherwise. The 2026-09-28 calls
  on the term lens and the verse menu were this rule before it had a name.
  Call them "Study View" and "Read View" in anything a reader sees. Until
  2026-09-30 the site also said "Reading View" and "Reading Mode", as
  FIXLIST.md and older commits still do; the `rm-` classes and `read-mode.js`
  keep the old initials.
  **Don't measure Read View with Cloudflare's Visits view.** A visit is a
  page view whose referrer isn't the site, and Read View is reached almost
  only from inside it (Study View's toolbar, the /read card, the search
  links), so it barely appears there. Use page views, and remember one Read
  View page view can hold a whole book where Study View logs one per chapter.
- **Mobile apps are first-class consumers** of `public/api/` output — changing
  chapter/intro/manifest shape can break them. Treat the API as a contract.
  The **sync contract**: both apps poll `version.json` first and do nothing
  further unless its `version` string differs from what they last stored (a
  cheap ~80-byte check, run at most once/24h on foreground + a ~6h background
  task + on-demand pull-to-refresh). Only on a change do they fetch
  `manifest.json` and download the files whose SHA-256 hashes moved. **So the
  whole system only works if `version` bumps on every content publish** — which
  is why it's content-derived (see build step 6), not date-only. The sync-
  critical files (`version.json`, `manifest.json`, `data/*`) are served
  `no-store` in `public/_headers` so a version bump is never served alongside a
  stale manifest or data file.
  **An optional top-level file that never resolves is skipped silently.**
  `topLevelFiles` in `build-api-manifest.mjs` throws only for `required: true`
  entries; anything else missing takes the `// optional + missing → skip
  silently` branch. `glossary.json` sat there as *optional* from 2026-03 to
  2026-08 with a source, `src/data/glossary.json`, that never existed — so the
  API carried no glossary data for five months and nothing reported it, while
  both apps read a copy bundled into the binary and drifted apart from each
  other. It is `required: true` now, and generated: see The Glossary Feed below.
  **Treat any new optional entry with suspicion** — silence is its failure mode.
- **Release notes are automated** from pushes to `main`. To keep a publish
  out of the changelog (a typo fix, a mechanical pass), touch
  `src/data/release-notes-skip.md` in the same commit and log why there. The
  rules, and the feed's contract with the apps, are in `scripts/CLAUDE.md`.

## Git Workflow

- **`main` is protected** — direct pushes are rejected; changes land via PR.
  Session work typically happens in a per-task branch/worktree (e.g.
  `.claude/worktrees/<task>/` on branch `claude/<task>`).
- **A dev server started from a worktree may still serve `main`.** The preview
  tooling resolves `.claude/launch.json` from the **main checkout**, not from
  the worktree, so `npm run dev` runs with the repo root as its Astro root and
  renders `main`'s files. Nothing errors; the page just quietly shows the wrong
  branch — and a file that exists only on the branch (`src/data/alignment/`,
  say) renders as absent rather than as a failure. **Confirm which tree is
  being served before trusting a preview**: request a path that exists only on
  the branch (`/src/<some-branch-only-file>` — Vite serves `src/` in dev) and
  check for a 200. To review a branch's pages, build it and serve its own
  `dist/`, which is the production render anyway.
- **Squash, merge-commit, and rebase are all enabled — pick one per PR, state
  it, and proceed.** The choice is yours to make, not one to hand back: the
  owner performs the merge (see the protection note above) and will say so if
  they have a preference, but asking which method to use spends their attention
  on a decision the branch itself answers. What's actually wanted is the
  reasoning, so reason from *this* branch's shape rather than from habit — don't
  infer the answer from recent history either, since `main` used merge commits
  for most of its life and switched to squash only around PR #101, so the last
  few commits read as a rule when they're really a transition. Note the
  degenerate case: on a **single-commit** branch squash and rebase produce
  identical history, so the only real question is linear vs. a merge node — say
  that instead of dressing it up as a three-way call.
  - *Squash* — one logical change, or a branch whose commits are WIP noise
    ("fix typo", "address review"). Nearly every content PR. It also keeps one
    commit per publish, which suits `draft-release-notes.mjs --since <ref>` and
    the content-derived API `version`.
  - *Rebase* — commits that are individually meaningful and each independently
    valid (extract a helper, then change behavior using it). Squashing those
    destroys the reviewable sequence.
  - *Merge commit* — when "these commits landed together as #NNN" is the useful
    unit, or the branch topology is worth keeping for a later bisect.
- **After a PR you opened is merged, clean up the branch and worktree** in
  the same session rather than leaving them for later:
  1. `git push origin --delete <branch>` — delete the remote branch (GitHub's
     "delete branch" button does the same thing; the repo does **not**
     auto-delete on merge, so this step is never optional). Note that
     `gh pr merge --delete-branch` is unreliable from a worktree: after merging
     it tries to switch the local checkout to `main`, which fails when `main` is
     checked out in the primary worktree, and it can abort before deleting the
     remote branch. The merge itself still succeeds — verify with
     `git ls-remote --heads origin <branch>` rather than trusting its exit.
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
| `src/pages/read/[book].astro` | Read View (a whole book on one page) |
| `src/scripts/chapter-tools.js` | Verse highlight/menu, footnote popovers, and selection sharing (Study View); the selection bar alone in Read View |
| `src/lib/scripture-refs.mjs` | The render-time reference linker; read its header before widening what it links |
| `src/lib/sefaria-refs.mjs` | The Hebrew Bible books the linker sends to Sefaria and the English→Hebrew verse map; change the map only after checking it against Sefaria's text |
| `src/lib/ebible-refs.mjs` | The apocryphal books the linker sends to the World English Bible on eBible.org, with eBible's verse counts |
| `src/lib/chapter-nav.mjs` | The one Previous/Next rule (steps over drafts); every chapter and intro nav reads it |
| `src/styles/global.css` | Main stylesheet |
| `astro.config.mjs` | Site config, redirects, sitemap/noindex draft logic |
| `content.config.ts` | Content-collection schemas |
| `src/lib/alignment-gate.mjs` | The one display gate for the alignment dataset, read by /glossary and the term lens |
| `scripts/validate-chapters.mjs` | Chapter validator (pre-commit + CI safety net) |
| `scripts/build-verse-index.mjs` | Verse search index generator (`public/search/verses.json`) |
| `scripts/lib/glossary-feed-core.mjs` | The apps' glossary feed contract — read its header before changing anything about `/api/data/glossary.json` |
| `scripts/build-alignment.mjs` | Alignment-record generator (`src/data/alignment/`, committed output) |
| `scripts/lib/alignment-merge.mjs` | Merge contract between the alignment scanner and the review tool |
| `scripts/alignment-review/` | Localhost review tool for the alignment dataset (`npm run review:alignment`) |
| `scripts/audit-alignment.mjs` | Staleness check for decided alignment records (`npm run audit:alignment`) — run after editing scripture |
| `scripts/reconcile/lib/block-structure.mjs` | The one block-tag rule the restore pipeline shares — read it before touching how a paragraph's closing markup is handled |
| `scripts/reconcile/lib/quote-compose.mjs` | Composes a restore when `curlify()` refuses the master's quotes, under two gates |
| `scripts/reconcile/lib/restore-guards.mjs` | The shapes a machine must not settle (verse-boundary moves, editorial brackets, doubled words, a truncated master) |
| `scripts/reconcile/lib/verse-span.mjs` | Where a verse begins and ends in `paragraphs[]`, what a restore must hold back from either end of that span, and how a continuation paragraph is recognized |
| `scripts/reconcile/check-master-hygiene.mjs` | Read-only master scan for defects a diff cannot see |
| `scripts/reconcile/repair-verse-separators.mjs` | One-off repair for verse markers an earlier restore welded to the preceding sentence |
| `pagefind.yml` | Pagefind config for glossary/article indexing (excludes footnote refs) |
| `public/_headers` | Security + caching headers; also RFC 8288 `Link` headers for agent discovery (Cloudflare Pages) |
| `public/.well-known/api-catalog` | RFC 9727/9264 `linkset+json` catalog of the public API |
| `public/llms.txt`, `llms-full.txt` | LLM-readable site description + AI-usage policy |
| `GLOSSARY-CANDIDATES.md` | Register of glossary candidates deliberately not included or deferred, and the payload criterion behind those calls. Read it before proposing a "next term." |
| `TOPICS.md` | **The authority on chapter and book-intro `topics`** — the significance filter, the alternative-translation pair table, the prefix-search rule, casing, and the hand-run checks. Read it before adding or revising any topics array. |
| `STUDY-DESK.md`, `STUDY-DESK-FORMAT.md`, `STUDY-DESK-AUDIT-1.md` | The Study Desk's planning record, its record format (shared with the apps) and its audit; see `src/scripts/desk/CLAUDE.md`. Large: grep for an ID, never read whole |
| `API-2-FORMAT.md` | The content API, version 2 (`/api/data/v2/`), beside version 1; opens with the manifest rule that protects installed apps |
| `DISASTER-RECOVERY.md` | Continuity doc: every dashboard/secret behind the deploy (names only, no values) + the DNS inventory + from-zero redeploy path. Update it when an integration, secret, or DNS record is added/removed. |

> The top-level `README.md` is the lighter human-facing overview; this file is
> the deep reference. Keep both in sync per the note at the top.
