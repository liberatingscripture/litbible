# LIT Bible — Claude Project Instructions

> **Maintain this file.** It is the orientation doc for every future Claude Code
> session, so keep it accurate to how the repo *actually* works — not a changelog.
> When you change build steps, directory layout, data formats, conventions, or
> add/remove a major feature, update the relevant section here or in the area
> file in the same change. Describe organizing principles and the "why," not
> one-off edits. If a doc contradicts the code, the code wins — fix the doc.
> Prune anything stale.
>
> **Update `README.md` too when appropriate.** It's the human-facing front door
> (lighter and friendlier; CLAUDE.md is the deep reference). When a change affects
> its overview, setup steps, common commands, or high-level layout, update it in
> the same change, avoiding specifics that drift (version numbers, file counts).

## How these docs are split

**This file holds only what applies anywhere in the repo.** Each area's detail
is in a `CLAUDE.md` beside its code, which Claude Code loads by itself the first
time a session reads a file in that directory. That covers most work, not all
of it: `src/lib/` is one flat directory serving several areas, and a task can
start from a page or a test. So **before working in an area, read its file
below unless it is already loaded.** Rules that keep this from decaying:

- **A new rule goes in its area's file, never here**, unless it applies
  everywhere. A new area file gets a row in the table below.
- **A cross-reference names its file and section** (`src/content/CLAUDE.md`,
  "The glossary feed"), never "below" or a bare rule number, since sections
  move between files.
- **Rules, owner decisions and their reasons go in the docs; the story of how
  something was found or built goes in the record** (`STUDY-DESK-FIXES.md`
  under its E number, the PR, or the commit).
- `test/claude-docs.test.js` fails when this file or the Study Desk's file
  outgrows its size limit, when a file the table names is missing, or when a
  `CLAUDE.md` on disk has no row.

| Read | Before working on |
|------|-------------------|
| `src/data/chapters/CLAUDE.md` | Chapter JSON: its format, `indexed` (drafts), curly quotes, en dashes, the validator's rules, poetry blocks (`hbq`), topics, the SBLGNT policy, bracketed passages, verse-number gaps |
| `src/scripts/CLAUDE.md` | Reader tools in `src/scripts/` (the verse menu, the selection panel, sharing, verse images, printing and handouts, search, Continue reading, Read View's landing, keyboard shortcuts) and the module map of `src/scripts/` |
| `src/scripts/desk/CLAUDE.md` | Anything to do with the Study Desk, wherever it lives: `src/lib/desk-*.mjs`, the /desk and /notebook pages, `desk.css`, printing with notes |
| `public/greek/CLAUDE.md` | The Study Desk's Greek (read the desk file too): the Greek tab, `public/greek/` and `build:greek`, searching the Greek and its commands, `src/lib/greek-*.mjs` |
| `src/scripts/desk/sheets/CLAUDE.md` | The Sheets (read the desk file too): the Sheets pane and its editor, the /sheets page, paper copies, Copy and Save as, present mode, templates, sharing, the print check, `src/lib/desk-sheet*.mjs` |
| `src/scripts/desk/collections/CLAUDE.md` | Collections (D13): the record, its model, its page and ways in |
| `src/scripts/desk/sync/CLAUDE.md` | Syncing the notebook (4g); `src/lib/desk-sync*.mjs` |
| `src/scripts/desk/account/CLAUDE.md` | The account pages (4h): /account, sign-in, passkeys, setup, joining, devices, the header's "Sign in," Apple and Google (off); `src/lib/desk-account*.mjs`, `desk-passkey.mjs` |
| `src/lib/CLAUDE.md` | The module map of `src/lib/`; scripture reference linking (Sefaria, eBible), external links, Go deeper, the release notes page and feed |
| `src/styles/CLAUDE.md` | CSS anywhere, including component `<style>` blocks: theming, the Display tray's settings, `--ch`, Greek and Hebrew fonts, the brand greens, the emblem, the LSC mark, focus rings |
| `src/layouts/CLAUDE.md` | Chapter View's phone toolbar; chapter prefetching |
| `src/content/CLAUDE.md` | Articles, glossary entries, the /apps collections; the apps' glossary feed |
| `src/data/alignment/CLAUDE.md` | The alignment dataset, both review tools, MorphGNT, /glossary's "Where it appears", the term lens |
| `src/components/CLAUDE.md` | The header's title swap (an inline script); the announcement popover |
| `src/components/apps/CLAUDE.md`, `scripts/apps-studio/CLAUDE.md` | The /apps mirror shared with the LSC site; the page's section data; the Apps Page Studio (BDR's editing board, its scripts, the `/apps-studio` skill) |
| `src/pages/CLAUDE.md` | The privacy page and the Terms of Use; the podcast page's embeds; the 404 page's address guessing; measuring Read View |
| `scripts/CLAUDE.md` | The toolchain's pins (Node, Astro), commands run by hand, **the apps' sync contract**, the build pipeline step by step, the table of `scripts/`, release-notes automation, raw-byte hashing and line endings, the importer |
| `scripts/reconcile/CLAUDE.md` | The Word masters and the reconcile toolchain |
| `scripts/alignment-review/CLAUDE.md`, `scripts/alignment-words/CLAUDE.md` | Pointers to the alignment file |
| `public/CLAUDE.md` | `_headers`, the CSP and where it reports, the agent discovery files, the apps' link files, image optimization |
| `workers/CLAUDE.md` | The contact and app-support form Worker; the Worker that counts the CSP's reports; the notebook service (the Study Desk's sync Worker with D1), its preview and its tests; the wrangler pin all three share |
| `.github/CLAUDE.md` | Dependabot's configuration; the workflows that touch Cloudflare |
| `emails/CLAUDE.md` | The campaign archive (not a template source) |

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
- **`public/api/` is a contract with the iOS and Android apps**, and the
  content `version` must move on every publish (`scripts/CLAUDE.md`, "The
  apps' sync contract"). Never add an optional manifest entry casually: a
  missing optional file is skipped silently.
- **Dark-mode styles need both selectors** (the OS media query guarded by
  `:root:not([data-theme="light"])`, and `:root[data-theme="dark"]`). Size text
  columns with `--ch`, never the `ch` unit; focus rings use `--focus-ring`.
- **A link that leaves the site opens in a new tab** with
  `rel="noopener noreferrer"`; a hand-written anchor in an `.astro` file needs
  both attributes itself.
- **The Study Desk is downloaded only with `data-desk="on"`**, save a shared
  sheet's link opened on a phone (its viewer alone). Shared reader
  code never imports it statically: it dispatches events or makes a gated
  dynamic import. Read the desk file before touching a shared panel.
- **`STUDY-DESK.md` (about 500 KB), `STUDY-DESK-FIXES.md` and the
  `STUDY-DESK-AUDIT-*.md` files are too large to read whole.** Grep for the ID or
  heading and read that section.
- **Subagents are at Claude's discretion: up to two Sonnet, two Haiku, and
  one Opus at a time** (BVJ, 2026-11-02). Pick each by the balance of
  performance and token conservation: Haiku for mechanical, fully specified
  work; Sonnet for well-scoped work that needs some reasoning; Opus only
  where a wrong call is hard to see in review (design, a data or record
  format, a subtle fix). Don't skimp so far that quality suffers, and don't
  default to Opus because it is free. Tasks that touch the same files run
  one after another, not in parallel.
- **On the owner's Windows machine, run Python as `python` or `py`, never
  `python3`.** `python3` is a Microsoft Store stub that prints "Python was not
  found" and exits 49, though Python is installed. Don't read that as "no
  Python here" and switch tools.

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

- **Astro 7**, static output, with two Astro 7 defaults deliberately pinned
  back in `astro.config.mjs`; **Node** pinned by `.node-version` for
  Cloudflare Pages. Read `scripts/CLAUDE.md`, "The toolchain's pins," before
  changing either.
- **TypeScript** (strict, `astro/tsconfigs/strict`); **vanilla CSS** (no
  utility framework): `global.css` plus a per-page stylesheet under
  `src/styles/pages/`.
- **No client framework, no hydration.** Hand-written vanilla JS in
  `src/scripts/` is progressive enhancement only; the site is fully
  functional with JS disabled.
- **Search**: scripture keyword search scans a build-generated verse index
  (`public/search/verses.json`, fetched lazily); Pagefind (build-time index
  over `dist/`) covers glossary, articles and book intros. A third, the Greek
  (`public/greek/search/`), runs only with the Study Desk preview on
  (`public/greek/CLAUDE.md`, rule 15).
- **Fonts**: `@fontsource` faces, Latin only (`src/styles/CLAUDE.md`).
  **Icons**: simple-icons.

## Common Commands

```bash
npm run dev               # Dev server at localhost:4321
npm run build             # Full production build (pipeline below)
npm run preview           # Build + astro preview locally
npm run check             # Type-check .astro/.ts files (astro check)
npm run validate:chapters # Validate all chapter JSON (structure + references)
npm run fix:chapters      # Re-serialize chapter JSON to normalize formatting
npm run check:links       # Verify every internal href/#fragment in dist/ resolves
npm test                  # The node:test suite. Two roots: test/**/*.js and
                          #   scripts/reconcile/test/**/*.mjs; a new test root is
                          #   invisible to CI until its glob is added to the script
npm run test:desk         # The Study Desk's tests alone: a faster loop, not a
                          #   substitute for npm test before a PR
npm run audit:alignment   # Re-check decided alignment records (after editing scripture)
npm run audit:words       # Re-check phase 2 word links (after editing scripture)
npm run import:chapter -- --docx=<path> --book=<key> --chapter=<n> --report
                          # Chapter JSON from a Word master; --report writes nothing
                          #   and is the normal first run (scripts/CLAUDE.md, "The Importer")
```

Every other script (each build step alone, and the generators whose output is
committed: fonts, icons, the Greek data, test vectors, the alignment tools) is
listed in `scripts/CLAUDE.md`, "Commands run by hand."

**The build pipeline**: `fetch:podcast` → `build:topics` → `build:verses` →
`build:glossary` → `build:greek-bridge` → `build:manifest` → `build:api` →
`build:api2` → `build:og` → `astro build` → `pagefind --site dist`. The order
is load-bearing: `build:glossary` must run before `build:manifest`, which owns
the content `version`, and `build:api` reads that version afterwards. A
podcast fetch failure never fails the build. Each step is in `scripts/CLAUDE.md`.

## Project Structure

```
src/
  assets/            # Bundled SVGs processed by Astro
  components/        # Reusable .astro components; apps/ holds the /apps sections
  content/           # Markdown collections: articles/, glossary/, and the /apps
                     #   ones (apps-sections/, callouts/, examples/, seasons/)
  content.config.ts  # Content-collection schemas
  data/
    chapters/        # 260 JSON files, one per NT chapter (john-3.json)
    alignment/       # Greek↔English alignment records; COMMITTED (review state)
    alignment-words/ # Phase 2 word-to-word links; committed
    intros/          # Book intro Markdown, one per book (john-intro.md)
    books.js         # BOOKS, BOOK_ORDER, bookKeyToLabel(), BOOK_ABBREVIATIONS:
                     #   the single source for book names and chapter counts
    verse-counts.js  # Last verse of every chapter, for browser code
    verse-gaps.js    # Verse numbers the LIT leaves out (Matthew 17:21)
    release-notes.json, release-notes-skip.md   # see Key Conventions
    podcast-feed.xml, podcastOverrides.json, translation-commitments.json
  layouts/           # Layout, ScriptureLayout, ReadLayout, SearchLayout
  lib/               # Build-time helpers, mostly pure and unit-tested
  pages/             # File-based routes (below)
  scripts/           # CLIENT-side vanilla JS; desk/ is the Study Desk preview
  styles/            # global.css, read-mode.css, pages/<page>.css, desk.css,
                     #   restyle.css and v2/ (Site 2.0, behind data-restyle)
scripts/             # BUILD/validation Node scripts (.mjs); reconcile/,
                     #   alignment-review/, alignment-words/, apps-studio/
test/                # node:test suite; fixtures/ holds committed vectors the apps run
public/              # Static assets + generated output (api/, og/, search/, ...)
_source-images/      # Pre-WebP originals, archived, never shipped (its README)
emails/              # Campaign archive; not a template source
workers/             # Cloudflare Workers, deployed separately, each with its own
                     #   package.json and vitest suite (root npm ci/test reach neither)
.githooks/           # pre-commit: validates staged chapter JSON
.github/             # workflows (ci.yml, release-notes.yml, deploys, apps-mirror-notify)
                     #   and dependabot.yml
```

> Client-side code lives in `src/scripts/`; build-time Node scripts live in
> the top-level `scripts/`. Don't confuse the two.

### Routing (`src/pages/`)

| Route | File | Purpose |
|-------|------|---------|
| `/<book>-<chapter>` | `[slug].astro` | Scripture chapter ("Chapter View") |
| `/<book>-intro` | `[book]-intro.astro` | Book introduction |
| `/read` | `read.astro` | The /read landing (Chapter View, Read View, the apps) |
| `/read/<book>` | `read/[book].astro` | Read View: a whole book on one page |
| `/articles`, `/articles/<slug>` | `articles.astro`, `articles/[...slug].astro` | Articles |
| `/glossary` | `glossary.astro` | Glossary |
| `/search` | `search.astro` | Full search UI (verse index + Pagefind) |
| `/notebook`, `/desk`, `/sheets`, `/collections` | `notebook.astro`, `desk.astro`, `sheets.astro`, `collections.astro` | The Study Desk preview's pages (noindex, out of the sitemap and Pagefind, empty without `?desk=on`; `src/scripts/desk/CLAUDE.md`, "Routes") |
| `/account`, `/account/connect` | `account.astro`, `account/connect.astro` | The account pages (noindex, out of the sitemap and Pagefind, one line without `?account=preview`; `src/scripts/desk/account/CLAUDE.md`, "Routes") |
| `/release-notes` | `release-notes.astro` | The release notes by month, filterable; `/translation-updates.xml` is the same record as RSS |
| `/apps` | `apps.astro` | Mobile-apps promo page; every section is data (`src/components/apps/CLAUDE.md`) |
| `/app-support` | `app-support.astro` | App support form (linked from the apps; `/app-support/thanks` is the no-JS success page) |
| `/found-in-translation-podcast` | `found-in-translation-podcast.astro` | Podcast page (`/podcast` redirects here); read `src/pages/CLAUDE.md` before touching its embeds |
| `/404` | `404.astro` | Not found; a guessable scripture address lands on its page |
| others | `delete-account` (noindex; `workers/CLAUDE.md`, and its box, the account file's "Routes"), `about`, `contact` (+ `contact/thanks`), `courses`, `support`, `privacy` and `terms` (`src/pages/CLAUDE.md`), `unsubscribe`, `liberating-scripture-collective`, `translation-commitments` |

Redirects (`/read-now`→`/read`, `/podcast`→`/found-in-translation-podcast`) and
the sitemap filter live in `astro.config.mjs`.

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
  - Quotes are curly (“ ” and ‘ ’), as the chapter JSON rule requires
    for scripture.
  - **No em dashes in prose Claude writes for the site** (BVJ, 2026-10-28),
    alt text included: use a comma, colon or parentheses. Ones already in
    the owner's text stay.
  This governs text Claude writes. **The translation, footnotes, intros and
  articles are the owner's** and come from the Word masters, so a British
  form found there is reported to BVJ, never silently changed (the ones a
  2026-10-13 audit found are in `src/data/chapters/CLAUDE.md`). Code
  comments and internal docs aren't held to it, though new ones should
  follow it.
- **Book keys**: lowercase, no spaces, no hyphens — `john`, `1corinthians`,
  `revelation` (`src/data/books.js`). **Chapter files**:
  `{bookKey}-{chapter}.json` (`1corinthians-1.json`).
- **Generated files are git-ignored** and rebuilt by `npm run build`:
  `public/api/`, `public/og/`, `public/search/` (`topics.json`,
  `verses.json`, `chapters/`, `greek-bridge.json`, `greek-offers.json`),
  `public/topics-index.json`, `public/glossary.json`, `dist/`, `.astro/`.
  Don't hand-edit them. The generators whose output is **committed** (fonts,
  icons, `public/greek/`, the alignment data, the test vectors the apps
  fetch) never run in the build; they are listed in `scripts/CLAUDE.md`,
  "Commands run by hand."
- **Chapter View and Read View differ in what a page holds, and that decides
  where a new tool goes** (owner, 2026-09-30). Chapter View is one chapter
  with everything the site has for it: footnotes, the verse menu, the term
  lens, reference previews, Go deeper. Read View is a whole book on one page,
  read straight through, with no notes and no page turn between chapters.
  **Read View gets what serves reading a book straight through** (display
  settings, the selection panel and its handouts, keeping and restoring a
  place, print, focus mode), and **a tool about a verse or a word goes in
  Chapter View only** unless the owner decides otherwise.
  Call them "Chapter View" and "Read View" in anything a reader sees; with
  the Study Desk preview on, labels say "Scripture page(s)" instead (E130),
  the public name from launch. Older records use older names: "Study View"
  (until 2026-11-02, still in STUDY-DESK.md and FIXLIST.md), "Reading View"
  and "Reading Mode" (until 2026-09-30); the `rm-` classes and
  `read-mode.js` keep the old initials.
- **Release notes are automated** from pushes to `main`. To keep a publish
  out of the changelog (a typo fix, a mechanical pass), touch
  `src/data/release-notes-skip.md` in the same commit and log why there. The
  rules, and the feed's contract with the apps, are in `scripts/CLAUDE.md`.

## Git Workflow

- **`main` is protected**: direct pushes are rejected; changes land via PR.
  Session work happens in a per-task branch and worktree (e.g.
  `.claude/worktrees/<task>/` on branch `claude/<task>`).
- **A dev server started from a worktree may still serve `main`.** The preview
  tooling resolves `.claude/launch.json` from the main checkout, so `npm run
  dev` renders `main`'s files, and a file that exists only on the branch
  renders as absent rather than failing. **Confirm which tree is served before
  trusting a preview**: request a branch-only path (`/src/<file>`; Vite serves
  `src/` in dev) and check for a 200. To review a branch's pages, build it and
  serve its own `dist/`, which is the production render anyway.
- **Pick the merge method per PR yourself, state it, and proceed**; the owner
  performs the merge and will say if they prefer otherwise. Reason from the
  branch's shape, not from recent history (`main` used merge commits for most
  of its life and switched to squash only around PR #101). On a
  **single-commit** branch squash and rebase give identical history, so the
  only question is linear vs. a merge node: say that.
  - *Squash*: one logical change, or commits that are WIP noise. Nearly every
    content PR; it keeps one commit per publish, which suits
    `draft-release-notes.mjs --since <ref>` and the content-derived `version`.
  - *Rebase*: commits that are individually meaningful and each valid on its
    own (extract a helper, then change behavior with it).
  - *Merge commit*: when "these landed together as #NNN" is the useful unit,
    or the topology is worth keeping for a later bisect.
- **After a PR you opened is merged, clean up in the same session** (skip a
  branch still mid-task or one the user says to keep):
  1. `git push origin --delete <branch>`. The repo does **not** auto-delete on
     merge. `gh pr merge --delete-branch` is unreliable from a worktree (it
     tries to switch the checkout to `main`, fails, and can abort before the
     remote delete); verify with `git ls-remote --heads origin <branch>`.
  2. From a **different** worktree: `git worktree remove <path>`, then
     `git branch -d <branch>`.
  3. If the directory is busy, the session itself is still rooted there: git
     still unregisters it, but the folder stays until that session ends. Say
     so rather than retrying, and never touch other worktrees under
     `.claude/worktrees/`; they are other sessions' work.

## Important Files

Area files list their own key modules; these are the cross-cutting ones.

| Path | Purpose |
|------|---------|
| `src/data/books.js` | Source of truth for NT book list + chapter counts |
| `src/pages/[slug].astro`, `src/pages/read/[book].astro` | Chapter View and Read View |
| `src/scripts/chapter-tools.js` | Verse highlight/menu, footnote popovers, and selection sharing (Chapter View); the selection bar alone in Read View |
| `src/styles/global.css` | Main stylesheet |
| `astro.config.mjs` | Site config, redirects, sitemap/noindex draft logic, the pinned Astro defaults |
| `src/content.config.ts` | Content-collection schemas |
| `scripts/validate-chapters.mjs` | Chapter validator (pre-commit + CI safety net) |
| `pagefind.yml` | Pagefind config (excludes footnote refs) |
| `public/_headers` | Security + caching headers, agent-discovery `Link` headers |
| `TOPICS.md` | **The authority on chapter and book-intro `topics`.** Read it before adding or revising any topics array |
| `GLOSSARY-CANDIDATES.md` | Glossary candidates deliberately not included or deferred, and why. Read it before proposing a "next term" |
| `STUDY-DESK.md`, `STUDY-DESK-FIXES.md`, `STUDY-DESK-FORMAT.md`, `STUDY-DESK-ENCRYPTION.md`, `STUDY-DESK-AUDIT-*.md` | The Study Desk's planning record, its Phase 5 log (E1 onward; new ones go here), its record format and encryption spec (shared with the apps) and its audits. Grep, never read whole |
| `API-2-FORMAT.md` | The content API, version 2, beside version 1; opens with the manifest rule that protects installed apps |
| `SITE-2.0.md` | Site 2.0: the plan, its ground rules, every page's decision, the launch steps |
| `IMAGE-CREDITS.md` | Source, creator and terms of every image by others; a new stock image gets a row |
| `DISASTER-RECOVERY.md` | Every dashboard and secret behind the deploy (names only), the DNS inventory, the from-zero redeploy. Update it when an integration, secret, or DNS record changes |
