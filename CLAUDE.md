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
npm test                  # Run the node:test unit suite — two roots: test/**/*.js
                          #   and scripts/reconcile/test/**/*.mjs. Both globs are in
                          #   the script; a new test root is invisible to CI until
                          #   it is added there (the reconcile files sat unrun once)
npm run build:topics      # Regenerate topics indexes only
npm run build:verses      # Regenerate the verse search index only
npm run build:api         # Regenerate public/api/content.json only
npm run build:glossary    # Regenerate the apps' glossary feed (public/glossary.json)
npm run build:manifest    # Regenerate API manifest + /api/data for the mobile apps
npm run build:og          # Regenerate the chapter/intro share cards (public/og/)
npm run build:favicons    # Regenerate the favicon/touch/manifest icons from the emblem SVGs
                          #   (on demand only — outputs are committed, not built)
npm run build:alignment   # Rescan the text for glossary-term renderings (src/data/alignment/)
                          #   (on demand only — output is committed and carries review state)
npm run review:alignment  # Localhost review tool for that dataset (see below). Needs the
                          #   MorphGNT clone; writes to src/data/alignment/ as you decide
npm run audit:alignment   # Re-check decided alignment records against the current text
                          #   (--all to list every finding). Run after editing scripture
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
4. `build:glossary` — generates `public/glossary.json`, the glossary feed the
   apps sync, from the `src/content/glossary/*.md` collection (deterministic:
   entries sorted by id, index keys sorted, no timestamps). Must run *before*
   `build:manifest`, which resolves it as the generated source behind its
   `glossary.json` declaration. See The Glossary Feed below — its shape is an
   app contract with several silent failure modes.
5. `build:manifest` — generates `public/api/manifest.json` + `public/api/version.json`
   and copies content files into `public/api/data/` (chapters, intros, intro
   `images/`, plus `glossary.json`, `topics.json` and
   `translation-commitments.json`) so the native apps can diff hashes and
   download only changed files. **This step owns the content `version`**: it's
   `v<YYYYMMDD>.<8-char hash of all file hashes>`, so it changes on *every*
   content publish (including multiple on the same day) and stays stable when
   nothing changed. The apps gate all syncing on this string — see the app-sync
   note below.
6. `build:api` — generates `public/api/content.json` (full NT in canonical
   order). Runs *after* `build:manifest` and reads the shared `version` from
   `version.json` so all three API artifacts report the same version.
7. `build:og` — generates `public/og/<slug>.png`, a 1200×630 social share card
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
8. `astro build` — compiles the site to `dist/`.
9. `pagefind --site dist` — indexes glossary + article + book-intro pages
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
  alignment-review/  # Localhost-only review tool for src/data/alignment/.
                     #   NOT part of any build and never shipped: its ui/ is
                     #   served from the Node process by exact-path allowlist,
                     #   deliberately NOT from public/ (Astro copies public/
                     #   into dist/ as a filesystem op — .gitignore there
                     #   prevents committing, not deploying)
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
                     #   hand-checked treatment (see the Astro 7 pins above) —
                     #   but that only classifies the DIRECT dep, so a 0.x
                     #   "minor" can still carry transitive majors into a
                     #   grouped PR (see the file's header comment).
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
| `build-glossary-json.mjs` | fs shell: reads `src/content/glossary/*.md` and writes `public/glossary.json`, the apps' glossary feed. Delegates every rule to `lib/glossary-feed-core.mjs`. |
| `lib/glossary-feed-core.mjs` | Pure `buildGlossaryFeed()` core of that generator — frontmatter parse, Markdown→plain-prose flattening, the `index` maps, and the cross-reference check. Unit-tested directly (`test/build-glossary-feed.test.js`) since its output shape is an app contract. Its header documents the four silent failure modes. |
| `build-og-images.mjs` | `public/og/` — per-chapter/intro share cards (fonts in `scripts/og/fonts/`). |
| `build-favicons.mjs` | Favicon/touch/manifest icons from the emblem SVGs. **Not** in the build — run by hand when the emblem changes. |
| `build-alignment.mjs` | `src/data/alignment/` — scans published chapters for glossary-term renderings, then checks each against MorphGNT. **Not** in the build; its output is committed and merges with prior human review. See The Alignment Dataset below. |
| `alignment-review/server.mjs` | `npm run review:alignment` — the localhost review UI (`store.mjs` = fs + corpus, `review-core.mjs` = pure logic *also served to the browser*, `ui/` = vanilla HTML/CSS/JS). Node builtins only, no deps. |
| `audit-alignment.mjs` | fs/CLI shell: re-checks every *decided* alignment record against the current scripture text. **Not** in the build or CI — run by hand after editing chapters. Delegates the check to `lib/alignment-audit-core.mjs`. |
| `lib/morphgnt.mjs` | Reads a gitignored local MorphGNT working copy (lemma-per-verse; `{withTokens}` also keeps every token in verse order, which only the review tool needs). Absent → verification skipped, prior verdicts kept. |
| `lib/glossary-lemmas.mjs` | Editorial map: glossary id → the Greek lemmas that commitment covers. Validated against the corpus at load. |
| `lib/alignment-merge.mjs` | Record identity, merge, and ordering for `src/data/alignment/` — the contract between the scanner and the review tool. Unit-tested. |
| `lib/alignment-forms.mjs` | How a glossary rendering is matched against verse text, and how `english[].n` is counted. Shared so both writers number occurrences identically. |
| `lib/alignment-audit-core.mjs` | Pure staleness check for decided records, no fs of its own. Imports `computeOccurrenceN` from the review tool rather than restating it — agreeing with the writer *is* the check. Unit-tested. |
| `lib/verse-text.mjs` | **The** chapter HTML → per-verse plain-text splitter (`Map<verse, text>`). Shared by `lib/verse-index-core.mjs`, `build-alignment.mjs`, and the review tool, so search and the alignment dataset can never disagree on where a verse starts and ends. (`release-notes-core.mjs` keeps its own, deliberately — see below.) |
| `fetch-podcast-feed.mjs` | Refresh podcast XML snapshot (non-fatal on failure). |
| `draft-release-notes.mjs` | CLI/git shell: drafts release-notes entries from git diffs (used by CI). Delegates the diff→changes logic to `lib/release-notes-core.mjs`. |
| `lib/release-notes-core.mjs` | Pure `buildChanges()` core of the drafter — no git/fs/argv of its own (readBase/readNow injected). Unit-tested directly (`test/draft-release-notes.test.js`) since its output shape is an app contract. |
| `lib/verse-index-core.mjs` | Pure `extractVerses()` core of the verse-index builder, no fs of its own: reshapes `lib/verse-text.mjs`'s Map into the dense array `verses.json` ships (index 0 = verse 1, `""` for gaps) — the only part of extraction that is search-specific. Unit-tested directly (`test/build-verse-index.test.js`): `verses.json` isn't an app contract, but it's the whole search surface for scripture, so an extraction regression ships straight to readers. |

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
- **A verse that spans a paragraph break carries its marker only ONCE**, at its
  start; the continuation paragraph opens with plain text and no marker. That
  is the corpus convention (187 continuation paragraphs across 76 published
  chapters) and it is what a mid-verse speaker change or a quotation set as
  poetry looks like. `state.currentVerse` in `wrapVerseSegments` threads the
  open verse across blocks, so the continuation still renders inside the right
  `data-verse` span. **Never re-show the number with a suffixed id**
  (`id="v41b"`): every consumer matches `id="v(\d+)"`, so a suffixed marker is
  invisible to the verse split (its digits leak into the extracted text as a
  stray number, and into the search vocabulary as a word), gets no `data-osis`,
  is never namespaced in Reading Mode, and makes the changelog blame the next
  verse. The validator rejects it. To let a reader share just part of a verse,
  see below.
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
- **Prose uses curly quotes only** — `“ ”` for quotations, `‘ ’` nested, `’`
  for apostrophes and possessives. Straight ASCII quotes are a **validation
  error** in both `paragraphs` and `footnotes[].html` (attributes are exempt,
  since the check strips tags first). **Entity forms are rejected too**
  (`&quot;`, `&#39;`, …) — they slip past any literal-character scan while
  still decoding to a straight quote in the page and in `verses.json`, which
  is how 19 of them survived the first pass of that cleanup. Prime notation
  is not a quote: the chiasm labels in `1corinthians-11` fn-b use U+2032
  (`A B C D D′ C′ B′ A′`). It's an error rather than a warning
  because the predecessor rule was a footnote-only *warning* about straight
  doubles, and 439 straight quotes accumulated under it across 96 chapters
  before the 2026-08 cleanup. Watch the related defect the validator can't
  see: a curly opener paired with a *wrong-direction* curly closer
  (`‘lord”`), which is well-formed to the checker but reads as a mismatched
  pair. That cleanup fixed 12 of those.
- Always run `npm run validate:chapters` after editing chapter JSON. The
  pre-commit hook validates staged chapter files automatically.

### Sharing part of a verse

Some verses are worth sharing in pieces: a verse that introduces a quotation
and then sets it as poetry (19 published block quotes continue a verse this
way — 1 Peter 2:6, 1 Timothy 3:16, 1 Corinthians 6:18), or a mid-verse speaker
change that opens a new paragraph.

**The anchor is the block's own id, which every authored paragraph and
blockquote already has** (`john-8-p9`, `1peter-2-p2`). Nothing extra is
authored for this. Those ids are already book-namespaced, so the same anchor
resolves in Reading Mode too — `rewriteVerseIdsAndAnchors` rewrites only
`id="vN"` and leaves them alone.

`verseParts()` in `chapter-tools.js` groups a verse's `data-verse` spans by
their **outermost** block, so a poetry quotation is one part rather than one
per line, and narrows each part to that verse's spans, so a blockquote holding
two verses doesn't hand back both. When a verse has more than one part the
verse menu grows an "Or copy one part" group, one button per part, copying the
part's text plus the reference plus `#<block-id>`. A blockquote part keeps its
line breaks (the line structure is part of what is being quoted); prose parts
join with a space. `partHighlight()` makes those anchors highlight on arrival
the way `#v16` does, rather than merely scrolling.

Parts are offered for a single verse only — a range already spans blocks by
nature, and a button per block would bury the whole-range actions.

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
them. `stripBracketMarkers` in **`src/lib/bracket-markers.mjs`** is the single
source; it sits in `src/lib/` (not `scripts/lib/`) because both the build and
the client import it, the same arrangement as `src/lib/word-stem.mjs`. Three
consumers today:

| Consumer | What leaked before |
|----------|--------------------|
| `scripts/lib/verse-text.mjs` | search results ending in a bare `[\|`, and the same misfiling in the alignment dataset |
| `scripts/lib/release-notes-core.mjs` | `added "[\|"` in the apps' Translation Updates |
| `src/scripts/chapter-tools.js` | Copy verse / Share… handing a reader `…afraid. [\|` |

**Always strip before collapsing whitespace** — a closing marker is not always
paragraph-final (John 9:39 reads `Jesus said, |] “I came…`), so the gap it
leaves would otherwise ship as a double space. The changelog copy deliberately
exempts its paragraph-level *fallback* comparison so a bracket-only edit still
produces a row; that exception is at the call site, not in the shared helper.
Any future consumer that flattens paragraphs to text needs the same strip.

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

## The Alignment Dataset (`src/data/alignment/`)

A Greek↔English index of the translation: one JSON file per chapter
(`<bookKey>-<chapter>.json`), holding a record for every place a term carrying
a translation commitment appears. It exists because **footnotes answer "what
happened in this verse" and can never answer "what does this translation do
with this word"** — that second question ranges over the whole corpus, and all
5,484 footnotes are invisible to both search engines (the verse index strips
`fn-ref`, and chapter pages aren't Pagefind-indexed). These records are that
missing aggregate.

Built in **two phases against one schema** — the format never changes, only
coverage grows:

- **Phase 1 (shipped, and fully reviewed)** — glossary terms only, seeded by
  `build-alignment.mjs` scanning published chapters for each glossary entry's
  `lit` renderings, then reviewed verse by verse against the Greek. `term` is
  populated, `greek` is empty. **Every one of the ~3,250 lemma-seeded queue
  verses is decided across all 31 terms**, so all 31 clear the display gate
  below. Regenerate the current numbers rather than trusting this sentence —
  new chapters keep arriving, and each one reopens its terms.
- **Phase 2 (in progress, unpublished)** — every SBLGNT token, captured by hand
  as the remaining books are translated, filling `greek` with `{t, form}`
  token positions. Ordinary words (καί, δέ) get `"term": null`. **Not published
  until it's complete across the NT** (owner decision) — partial word-by-word
  coverage would read as a claim the data can't support.

```json
{
  "ref": "Rom.8.3",
  "english": [{ "text": "self-preservation", "n": 1 }],
  "greek": [],
  "term": { "greek": "sarx", "traditional": "Flesh",
            "glossary": "flesh-body", "form": "self-preservation" },
  "confidence": "distinctive",
  "source": "glossary-scan",
  "status": "auto"
}
```

- `english` + `greek` is the **alignment link**; `term` is the **editorial
  annotation**. Both are arrays because phase 2 is many-to-many.
- `n` is the nth case-insensitive match of that form *within the verse*, while
  `text` preserves the casing as written. Load-bearing: Romans 8:2 renders
  `nomos` as "Torah" and "torah" in the same verse, deliberately.
- `term.form` is which glossary rendering this is, so "Life-breath",
  "life-breath", and "life-breaths" group as one rendering without losing the
  written variant. Group by `form`, never by `english[0].text`.
- `confidence` is `distinctive` (a coinage, phrase, or proper noun — a string
  match is effectively certain) or `common` (ordinary English that may or may
  not be rendering the Greek: "trust", "clean"). The `DISTINCTIVE` set in the
  script is an editorial judgment, not a derivable rule.
- `lemma` is the **Greek-side check** — `present`, `absent`, or `unchecked` —
  and is deliberately a separate axis from `confidence`. See below.
- `status` is `auto` until a human reviews it, then `confirmed`,
  `no-rendering`, or `rejected`. A reviewed record carries `confidence: null`
  — `confidence` answers "is this English string unambiguous *out* of context",
  which is a scanner heuristic a human verdict supersedes rather than restates.
- `source` is `glossary-scan` or `review`. A rejected scan record keeps
  `source: "glossary-scan"` and flips only its `status`, so the next rescan
  matches it by key and can't resurrect it.
- `english: []` with `term.form: null` is the **`no-rendering`** record: the
  Greek is here and the translation has no distinct rendering for it. A
  first-class answer, not a skip — it's how a term reaches fully-reviewed
  without inventing renderings for verses that have none.

### Greek verification (MorphGNT)

`build-alignment.mjs` checks each record against a local MorphGNT/SBLGNT
working copy: does the lemma this record claims actually occur in this verse?
**MorphGNT is a tool here, not a dependency and not redistributed** — its
lemmatization is CC BY-SA 3.0 and the SBLGNT text carries its own EULA, so the
corpus is gitignored and nothing from it is copied into `src/` or `public/`.
Clone it by hand when you need to re-verify:

```bash
git clone --depth 1 https://github.com/morphgnt/sblgnt.git .morphgnt
```

Without it the run still succeeds, verdicts on disk are preserved rather than
blanked, and it says so. (The review tool is the opposite — it refuses to
start; see below.)

**Keep the clone OUTSIDE the repo and point `MORPHGNT_DIR` at it.** The default
location resolves per-checkout, so a clone made inside a worktree is lost the
moment that worktree is removed, and every other worktree re-downloads its own
copy. One clone somewhere permanent plus `MORPHGNT_DIR` in the user environment
serves every checkout, and both `build-alignment.mjs` and the review tool read
the same variable. The in-repo `.gitignore` entry stays as a safety net for a
clone made the default way.

`scripts/lib/glossary-lemmas.mjs` bridges the glossary's transliterated
headword (`sarx`) to real lemmas (`σάρξ`), and is an **editorial** config: the
question is which Greek words a commitment covers, not what the dictionary form
is. Every lemma is validated against the corpus at load, so a bad accent fails
loudly. Erring inclusive is safer — a missing lemma makes good records read
`absent` and hides them. **A term whose contradiction rate is far above its
neighbours usually means a lemma missing from that map, not translator
inconsistency.**

Anything the check can't speak to is `unchecked`, never `absent` — versification
gaps must not look like errors (the pericope adulterae and the Romans doxology
are exactly this, and are the reason the guard exists).

The inverse of the scan — verses where the lemma occurs but no rendering matched
— is written to `alignment-coverage.json`, the actual work list. That file *is* a
lemma concordance, so it's gitignored rather than committed.

**What this check established, and it governs the roadmap:** the glossary's
`lit` field is a **headline, not a rendering inventory**. It states the
interpretive commitment; the running text realizes it several ways. `metanoia`
is glossed "reorienting the mind" but appears as "transformation of the mind",
"the reorienting of minds", "reorienting your mind"; `blasphemia` is glossed
"disrespectfulness" but appears as "contemptuous speech", "slanderous
accusation", "speaking disrespectfully" — and never as the glossed word, which
is why both terms score 0% coverage. So an English-first scan can only ever find
what it was told to look for. **Seed future work from the lemma side, where the
verse list is complete by construction, and classify; don't seed from the
English side and discover.**

Completing the review bore that out at scale: *pistis* came out as faithfulness
and trust in comparable numbers plus commitment and allegiance; *doxa* as
praise, praiseworthiness, renown, honor, reputation, radiance; *koinos* as
unconsecrated, shared, and worthless — never the glossed word. The scan alone
would have found a fraction of these.

### Re-auditing decided records (`npm run audit:alignment`)

**Run it whenever the scripture text changes, before committing decisions.**
`mergeScanWithExisting` keeps a non-`auto` record *whole*, which is right for
preserving human judgment and means an upstream edit to a verse leaves its
reviewed record silently stale — `build:alignment` reports dropped *scan*
records and never reviewed ones, so nothing else in the pipeline notices and
`/glossary` goes on linking readers to a rendering the verse no longer carries.

Deliberately **not** in CI, the pre-commit hook, or `npm run build` (owner
decision): a finding needs an editorial judgment, so it's a prompt rather than a
gate. It exits 1 when anything is stale, purely so it can be chained.

The check asks whether there is *any* position in today's verse that
`computeOccurrenceN` would number the way the record is numbered, which is what
lets it cover that function's **substring fallback** as well as its form
pattern. Re-deriving `n` by whole-word matching instead reports false positives
at scale — Mark 15:31 legitimately numbers "restore" as occurrence 2 by counting
the one inside "restored", and its confirmed form ("restoration") doesn't occur
in the verse at all. That is why the check imports the real function rather than
restating the rule: a second copy is the one way it could quietly stop being
true.

When a record is stale, **delete it rather than marking it `rejected`** —
`isDecided` treats any non-`auto` record as settling the verse, so rejecting
buries it from the queue permanently, while deleting returns it to be decided.
Repair in place only when the wording is unchanged and just the characters moved
(a straight apostrophe turning curly).

`rejected` and `no-rendering` records are skipped: both assert the *absence* of
a rendering, so re-checking a rejected record would just re-report the false
positive its reviewer already dismissed. The corollary is that a `no-rendering`
verse which has since *gained* a rendering is invisible here — that one surfaces
in the review queue, not the audit.

### The review tool (`npm run review:alignment`)

The tool that does that seeding. It serves a localhost-only UI on port 4500
(`--port` to change) and writes decisions straight into `src/data/alignment/`
as you make them — no save step, so a crash costs at most one decision.
**Unlike `build-alignment.mjs` it cannot degrade without the MorphGNT clone
and refuses to start**: the queue *is* the lemma's verse list, so there is no
tool without it.

One term per page, every verse where its Greek occurs, in Bible order — an
owner decision, because **consistency across verses is the judgment being
made** and a running "renderings so far" tally is the thing you review
against. Verses the scan already matched arrive with a proposal; the rest
arrive blank, which is the whole point. A separate **Absent** tab clears
`lemma: "absent"` false positives in bulk, grouped by (term, rendering) —
`flesh-body` matching the vocative *adelphoi* was 185 records in one group, and
grouping that way turned most of the tab into a single decision. Bulk-accepting
the records where the scan and the lemma check already agree is **opt-in per
term**, never automatic (also an owner decision).

**Two classes of record the tool cannot reach**, both worth knowing before
concluding a term is finished:

1. **Verses outside SBLGNT.** The queue *is* the lemma's verse list, so a verse
   MorphGNT has no tokens for is never queued — the pericope adulterae and the
   Romans doxology. Their records sit at `lemma: "unchecked"`, invisible to the
   tool and unclearable by the gate, and each one withheld an otherwise
   finished term. They were settled by editing the JSON directly.
2. **A blocking record on an already-decided verse.** `isDecided` is per
   (verse, term), so an `auto` + `common` record sitting beside a confirmed one
   never resurfaces in the queue while still withholding the term. Five
   `flesh-body` "Family" records hid this way.

So **"0 remaining in the queue" is not the same as "the term publishes."**
Check the gate directly.

Two structural rules it exists inside:

1. **`scripts/lib/alignment-merge.mjs` is the contract** between the two
   writers, and the rules are asymmetric on purpose. A review record usually
   has *no* counterpart in a rescan — capturing renderings the glossary
   doesn't list is the point — so a non-`glossary-scan` record with no key
   match is carried forward unconditionally. Read that file's header before
   touching how records are keyed or ordered. Ordering is deliberately
   independent of `source`/`status`, or a review session churns the diff.
   `recordKey` must tolerate `english: []` and `term: null`.
2. **The UI lives in `scripts/alignment-review/ui/`, not `public/`.** Astro
   copies `public/` into `dist/` as a filesystem operation, so `.gitignore`
   there stops a commit but not a deploy. The server hands out each file by
   **exact-path allowlist** — `STATIC_FILES` in `server.mjs`, never a
   path-join from the request. Three of its entries sit outside `ui/`
   (`review-core.mjs` and the two pure libs it imports) because the browser
   imports the *real* grouping module rather than keeping a second copy of a
   rule that has to agree with the server's; their URLs are chosen so
   review-core's own relative specifiers resolve unchanged, so moving any of
   those files means moving its URL too.

`applyReviewDecision` treats `(ref, glossary)` as a fully owned slot, so **a
verse rendering the term twice must submit both spans in one call** — two
sequential single-span writes would have the second erase the first.

### Rendering consolidation

`term.form` is free text and the UI defaults it to the words the reviewer
clicked, so one rendering fragments across its inflections: `katharos` came out
of review as clean / cleanse / cleansed / cleansing / cleanses / sincere, and
`metanoia` as 22 forms over 31 verses. `/glossary` publishes one `<details>`
per form, so **fragmentation is reader-visible, not untidiness**.

`formSignature` in `review-core.mjs` is the grouping key — case-folded,
de-accented, stopword-stripped, Porter2-stemmed via `src/lib/word-stem.mjs`
(the *same* stemmer the search index uses for related-form matching; one
notion of "related form" in the repo, not two), **word order preserved**
because these are phrases. From it: `suggestForm` defaults a newly selected
span to an established rendering, and `planFormMerges` proposes groups the
`Consolidate` control applies via `renameFormInRecords`.

**All of it suggests; none of it decides.** Stem equality is a good filter and
a bad judge — it groups "reorient their mind" with "reorienting of minds" but
leaves "transformation of the mind" separate, and would fold "The Adversary"
into "Adversary" where the capital is a title. Which forms are *one rendering*
is an editorial question about the translation, so a human picks the canonical
label. Renaming touches **`confirmed` records only**: a hand-edited form on an
`auto` record would be silently reverted by the next scan, since
`mergeScanWithExisting` keeps a prior record whole only when it is non-`auto`.
Identity is unaffected either way — `recordKey` is (ref, glossary,
`english[0].text`, `n`), and none of those is a form.

**The output is committed, not gitignored** — unlike every other generated
artifact here, it carries review state. Re-running merges: a reviewed record is
kept *whole* (hand-edits to `term.form` and phase-2 `greek` survive, not just
its status), review-only records are carried, and scan records whose English no
longer matches are reported before being dropped. That's also why
`build:alignment` is **not** in `npm run build` — a build must never rewrite
source (same precedent as `build:favicons`). A website asset, NOT part of the
app contract; it must never move under `public/api/`.

**Rendering** is the "Where it appears" block on `/glossary` (see
`glossary.astro` + the OCCURRENCES section of `pages/glossary.css`): an outer
`<details>` holding the whole list, then one `<details>` per rendering. It is
`data-pagefind-ignore`d so verse lists don't swamp the glossary's index.

Four rules there, all forced by the size of the finished dataset (~3,600
verses across ~210 renderings on one page):

- **One link per verse, not per occurrence.** Records are per-occurrence, so
  Romans 2:12 — which renders *nomos* as "Torah" four times — produced four
  identical links in a row, which reads as a bug rather than as the frequency
  claim it is. Links are deduped; the counts still carry the frequency, and
  the summary says "N times across V verses" *only* when the two differ.
- **The heading states the term's occurrence total**, summed from the same
  per-rendering counts the rows print, so it cannot drift from them.
- **Long lists reveal in batches** — 50 links above 900px, 25 below, chosen in
  the client since the page is static. Both sizes and the breakpoint are data
  attributes on the list, because the server-side threshold must equal the
  *narrow* step (a 30-ref list needs batching on a phone but not on a desktop)
  and duplicating that number invites drift.
- **Everything degrades without JS.** Every link is server-rendered and the
  "show more" button is script-injected, so a no-JS page carries the full list
  and never shows a control that cannot work. Verify by checking the *served*
  HTML for hidden items and buttons — there should be none of either.

The display rule there is a **publishing** decision, not a technical one: a
partial count reads as a reviewed total, so a term appears only when every
record it would show is one we can vouch for, and a single record we can
neither vouch for nor rule out withholds the whole term. Per record:

| | |
|---|---|
| **ignored** | `rejected` / `no-rendering`, and anything with `lemma: "absent"` — a known false positive says nothing either way about the rest of the term |
| **shown** | `status: "confirmed"`, or an `auto` + `distinctive` record the Greek doesn't contradict |
| **withholds the term** | `auto` + `common` and not contradicted — an unreviewed match on ordinary English ("trust", "clean") |

That last row is what review exists to clear. `flesh-body` was the worst case:
it renders as the ordinary word "family", which the scan can't tell from a
vocative "Family," (cf. Rom 8:12, *adelphoi*) — and "family" is *also* a
genuine *sarx* rendering in Mark 10:8 ("the two will become one family"). The
same English word is right in one verse and wrong in five others, which is
exactly the judgment no machine makes. All 31 terms now clear the gate; a term
dropping back out means new `auto` + `common` records arrived with a new
chapter.

The rule is also why the review tool and this gate had to ship together — a
bulk-rejected record keeps `confidence: "common"` forever, so under the old
"every record is `distinctive`" rule no amount of review could ever release a
term.

## Content Collections (`src/content.config.ts`)

Five collections, all loaded via Astro's `glob` loader. Two are site-wide:

- **`articles`** — `src/content/articles/*.md`. Schema: `title`, `date`,
  optional `author`/`description`/`heroImage`/`featured`, `tags[]`.
- **`glossary`** — `src/content/glossary/*.md`. Schema pairs a `traditional`
  term with the LIT rendering (`greek`, `lit`, `litMenu`, `srOnly`, optional
  `note`/`menuTraditional`). Files are named `<traditional>-<lit>.md`
  (e.g. `hell-hades.md`). **These files also feed the mobile apps** via
  `build:glossary` (see The Glossary Feed below), so editing one is a publish to
  both platforms. The two surfaces want different things from a body: the site
  renders it as Markdown (`*kalos*` is italic), the apps need plain prose. The
  generator bridges that by flattening emphasis, so keep using it — but richer
  Markdown (links, headings, HTML) **fails the build** rather than reaching a
  phone screen as literal syntax, because neither app can render it.

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
  `public/search/verses.json`, `public/topics-index.json`,
  `public/glossary.json`, `dist/`, `.astro/`.
  Don't hand-edit them. Two generators are deliberately **outside** this rule
  because their output is committed and hand-maintained — `build:favicons`
  (icons) and `build:alignment` (review state); neither runs in `npm run build`.
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
  is why it's content-derived (see build step 5), not date-only. The sync-
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
- **The glossary feed (`build:glossary` → `/api/data/glossary.json`).** The
  glossary's source of truth is the content collection
  (`src/content/glossary/*.md`), never `src/data/`. `build-glossary-json.mjs`
  compiles it to `public/glossary.json`, which `build:manifest` then picks up as
  the generated fallback source — the same arrangement `topics.json` has with
  `public/topics-index.json`, and the reason the file is gitignored rather than
  committed. The rules the feed's shape must satisfy are documented at length in
  `scripts/lib/glossary-feed-core.mjs`; the four that bite are:
  1. **The top-level `index` object is required.** iOS's decoder throws without
     it, then logs, *skips the hash update*, and continues — so the file
     re-downloads on every sync forever, the glossary never updates, and no
     error is ever user-visible. Android ignores the field entirely. Both
     parsers tolerate *extra* keys, so shipping the whole entry schema is free;
     it is a *missing* key that is fatal.
  2. **`index.traditional` keys on `traditional`, `index.lit` on `litMenu`** —
     not `menuTraditional`, not `lit`. Both are displayed text on both
     platforms, and iOS's cross-reference lookup keys on them.
  3. **Bodies are plain prose.** Neither app parses Markdown near the glossary
     (Android draws plain text, iOS runs an inline *HTML* parser), so emphasis
     markers and backslash escapes reach the screen literally. The generator
     flattens them and throws on anything it can't flatten. Note the `.md`
     intros are **not** Markdown either — their bodies are HTML with YAML
     frontmatter, so "match the intros feed" is not the argument it looks like.
  4. **`the entry for "X"` ships verbatim.** iOS turns that literal phrase into
     in-app navigation by matching X against the index labels. Rewriting it as a
     link loses the navigation silently, and an `https://` anchor in a body
     renders on iOS as a tappable link that does nothing. Straight quotes are
     load-bearing — the curly-quote convention is a *chapter JSON* rule and must
     not be applied here. The generator fails the build on a cross-reference
     that would land nowhere, because two of them were dead for months and
     nothing reported it.
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

## The Word masters (`scripts/reconcile/`)

**The chapter JSON is not the origin of the translation.** The author writes in
Word, one `.docx` per book, kept in OneDrive — those are the masters, and where
the two disagree about wording the master wins. The JSON was seeded from them by
a lossy import in 2026-02 which shortened notes, dropped a few entirely, added
punctuation nobody wrote, and stripped macrons off transliterated Greek.
`scripts/reconcile/` is the toolchain that measured and repaired that; August
2026 restored 749 footnotes and 165 verses across 153 files.

The masters are **read-only from this repo, always** — never edited to match the
JSON, in either direction, and never committed (they are the author's working
documents, and 17MB of unpacked XML besides). `MASTER_XML_DIR` points at an
unpacked copy; see that directory's README.

Four things about them that are not guessable and cost real time to rediscover:

1. **A footnote reference is zero-width in Word.** It contributes no characters,
   which is right for comparing wording and wrong for rebuilding HTML: a verse
   rebuilt from master text alone loses every `<sup class="fn-ref">` anchor
   inside it, and the note becomes unreachable. `validate-chapters.mjs` does
   **not** catch this — it checks that every anchor has a footnote, never that
   every footnote has an anchor. `build-ledger.mjs` re-inserts the repo's own
   anchors at the master's positions and refuses the verse when the counts
   disagree.
2. **Verse numbers are usually superscript runs, but not always.** Eight
   chapters type one as ordinary body text and Mark 5:39 is a *subscript*. Any
   tool that trusts `<w:vertAlign>` alone walks past them; the digit-adjacency
   scan finds all of them, and the two are cross-checked per chapter.
3. **Restoring is a byte-level splice, never a reserialize.**
   `build-api-manifest.mjs` hashes chapter files by raw bytes and most files are
   not in canonical format, so a `JSON.parse`→`stringify` round-trip would move
   every hash and force every app install to re-download the whole corpus for no
   content change. `lib/json-splice.mjs` replaces one string value in place
   under seven assertions; `verify-bytes.mjs` proves after the fact that nothing
   but string values moved.
4. **Word mixes straight and curly quotes**, so master text cannot be spliced in
   raw — `curl-quotes.mjs` converts it first, and **refuses** rather than
   guessing when a quotation is unbalanced. A refusal is about the master's
   *punctuation*, not its words, so `lib/quote-compose.mjs` **composes** such a
   restore instead of converting it: a span differing in nothing but quote
   characters takes the repo (whose quotes are already validator-clean), markup
   takes the repo, everything else takes the master. Two gates then compare the
   result against the repo's current text — it must satisfy the validator's
   curly-quote rule, and must not introduce a wrong-direction pair the repo
   didn't already have. Before that existed a refusal left `patch.newValue`
   null, which put the record beyond the review tool as well as the applier.
5. **A verse that is the LAST in its paragraph owns the string to its end**,
   closing tags included, because they sit after its text and nothing else
   claims them. The master has no markup at all, so rebuilding that span drops
   the paragraph's `</p>` — which is how 59 paragraphs shipped unbalanced before
   anyone noticed, a browser closing a dangling `<p>` at the next block element.
   `lib/block-structure.mjs` is the single source for that rule now:
   `build-ledger.mjs` holds the closing run back, `apply.mjs` refuses a write
   that changes any paragraph's balance, and
   `repair-unclosed-paragraphs.mjs` fixed what shipped.

**Bucket A is evidence, not proof, and the held records are the worst place to
forget that.** "This text settled during the import window" is good reason to
think the repo is the damaged side, but records that a coarse rule held back for
months are unusual by selection, and unusual correlates with the master having
problems of its own — a doubled word, a dropped period, `[Miriam]` left in as an
editorial mark, John 8 breaking verse 19 a sentence later than the repo does.
`lib/restore-guards.mjs` holds the shapes found so far; the general lesson is
that **these go through `npm run review:reconcile -- --buckets=A`, not through
`apply.mjs`**. Applying the 53 clear records in one pass was tried and thrown
away: six of them published a defect straight out of Word (`matthew-11:6` read
"is has reason for gratitude", `matthew-2` fn-g "those group"), and six is a
floor, since the scan that found them missed `mark-11` fn-h's "'divine'and".
For scale, the hand review of buckets B/C/D kept the repo's own text in 34 of
99 records.

`check-master-hygiene.mjs` covers the other blind spot — a diff can never report
what is wrong on *both* sides, and only one of the four multi-paragraph
footnotes in the masters ever surfaced as a difference.

`build-alignment.mjs`'s rule applies here too: **run `npm run audit:alignment`
after any verse restore.** A reviewed alignment record survives a scan whole, so
an edit to the verse under it leaves it silently stale — delete a stale record
rather than rejecting it.

**`npm run review:reconcile` is how the remaining differences get decided**, and
it asks **per hunk, not per record** — because the dating that produced the
buckets is per footnote and per verse, so one note edited in August carries its
remaining import damage into the same bucket as the edit. Spans are classified
`mechanical` (no word differs — take the master), `structural` (markup only —
keep the repo, whose markup is authored and which the Word master has none of),
or `judgment` (the words differ — the only kind a person must answer, and it
runs both ways: the repo has a typo in `1corinthians-10-fn-ee`, the master has
one in `1corinthians-2-fn-q`). **Consecutive spans are classified as a group as
well as singly**, because Word's run boundaries rarely match a word — `soter`
arrives as five per-letter `<em>` pairs — and a cluster that changes no letter
between its two sides is markup, not a question. **A record that is a wholesale
rewrite opens as a whole-version comparison instead of a row of choosers**: five
of them hold nearly half the questions, and per-span is unreadable at 92%
changed. Decisions land in `out/decisions.json` with the
SHA of the text they were made against; `apply.mjs --decision=approved` writes
the composed value and refuses any decision whose ground has since moved. Same
two structural rules as the alignment review tool: exact-path allowlist rather
than `public/`, and the browser imports the real `review-core.mjs`. It defaults
to buckets **B,C,D**; the import-era backlog is `-- --buckets=A`.

`FOLLOW-UP-RECONCILIATION.md` carries what the restore deliberately left alone:
the August edits to back-port *into* Word, the April–July window that needs a
human, and the books with no usable master (Revelation has none; Acts's holds
only 1:1–4; Luke's stops mid-21:38).

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
| `src/pages/read/[book].astro` | Continuous reading view |
| `src/scripts/chapter-tools.js` | Verse highlight/menu + footnote popovers |
| `src/styles/global.css` | Main stylesheet |
| `astro.config.mjs` | Site config, redirects, sitemap/noindex draft logic |
| `content.config.ts` | Content-collection schemas |
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
| `scripts/reconcile/check-master-hygiene.mjs` | Read-only master scan for defects a diff cannot see |
| `pagefind.yml` | Pagefind config for glossary/article indexing (excludes footnote refs) |
| `public/_headers` | Security + caching headers; also RFC 8288 `Link` headers for agent discovery (Cloudflare Pages) |
| `public/.well-known/api-catalog` | RFC 9727/9264 `linkset+json` catalog of the public API |
| `public/llms.txt`, `llms-full.txt` | LLM-readable site description + AI-usage policy |
| `DISASTER-RECOVERY.md` | Continuity doc: every dashboard/secret behind the deploy (names only, no values) + the DNS inventory + from-zero redeploy path. Update it when an integration, secret, or DNS record is added/removed. |

> The top-level `README.md` is the lighter human-facing overview; this file is
> the deep reference. Keep both in sync per the note at the top.
