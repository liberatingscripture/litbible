# The /apps mirror

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory. It also governs `src/styles/pages/apps.css`,
> `src/content/{apps-sections,callouts,examples,seasons}/`, `scripts/apps-studio/`
> and `.claude/skills/apps-studio/`.
> Cross-references such as "below" or "rule 15" were written when all of
> this was one file, so they may point into another area file; the root's
> index says which file holds each section.

- **The /apps mirror: litbible is upstream for the LSC site.**
  `liberatingscripture.org/apps` is the same page, and these files are kept
  **byte-for-byte identical** in both repos at the same paths: everything under
  `src/components/apps/`, `src/styles/pages/apps.css`, the section content
  in `src/content/{apps-sections,callouts,examples,seasons}/`, and the images
  under `public/assets/`. Edit them **here**; LSC copies them across. Two
  things are deliberately NOT mirrored — `src/pages/apps.astro` (two sites
  can't share a canonical URL, so LSC keeps its own Layout props and JSON-LD,
  and since 2026-10 nothing else: both pages render `<AppsPage />`) and LSC's
  `apps-bridge.css` (which exists precisely so `apps.css` can stay a pure
  mirror).
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
  It diffs each push's **whole range** (`before..sha`), so it checks out full
  history. It used to fetch two commits deep and fall back to the last commit
  alone whenever `before` was missing, which is every multi-commit push. For a
  week (2026-09-23 to 09-30) that silently skipped five pushes touching
  `/apps` and `/privacy`, with every run green. Don't reintroduce a shallow
  fetch or a quiet fallback: if the base can't be found the job now fails with
  an error. To backfill a gap, run it by hand with the `since` input set to
  the last commit LSC was notified about; one issue then covers the range.
  That same workflow also watches `/privacy`, which is **not** a mirror: the two
  policies cover two different entities and are written separately (owner
  decision), so the notification says "review", never "copy".
  It lists files deleted here separately (as `git rm` lines), because a
  screenshot swapped out in the Studio leaves an old file LSC should drop, and
  its `curl` lines use `--create-dirs` for folders LSC doesn't have yet.

## The page is data

Every word, picture, link, background and position on /apps lives in content
files; the components only draw them (BDR's call, 2026-10-26, so the
Studio below can change any of it without touching code). Since then the
templates hold no copy at all: **never write a word back into a component.**

| What | Where |
|---|---|
| Each section: its copy, links, store buttons, screenshots, `background`, `order`, `hidden` | `src/content/apps-sections/<id>.json`, collection `appsSections` |
| The reader-feature cards | `src/content/callouts/*.md` |
| The comparison (the entry with `placement: hero` is shown) | `src/content/examples/*.md` |
| The carousel's frames | `src/content/seasons/*.md`; its copy is the `reader` section's `carousel` |
| The page's title and description | `src/pages/apps.astro` (litbible only) |
| The app icons | the files themselves, `public/assets/images/lit-app-icon*` |

- **`collections.ts` defines all four collections**, and `src/content.config.ts`
  spreads `appsCollections` in. It is mirrored, so LSC's config imports the
  same file instead of pasting the schemas (they had to match anyway).
- **`AppsPage.astro` is the page body**: the sections in `order`, `hidden`
  ones skipped, each drawn by its `kind`'s component. Both sites render it, so
  the section list is mirrored and LSC's `apps.astro` never needs editing for
  a reorder.
- **Prose takes one inline format, `render.ts`'s `inline`**: `*italic*`, and a
  line break where the text has one (the big-screens heading). Everything
  else is escaped, so a field can't carry markup. Text from `set:html` gets no
  scoping attribute, which is why the components no longer style `em` inside
  copy; `apps.css`'s `.apps em` does it for the whole page.
- **`band()` turns `background` into classes** (`band--soft`, or
  `band--tint band--<season|green>`), drawn in `apps.css` the way the callout
  cards mix their tint: 8% over the surface in light, 15% over `--bg-soft` in
  dark. The about and humane sections are `soft`; their scoped CSS no longer
  sets a background.
- **Kinds that can be copied** into a second section, and removed again, are
  `about`, `bigscreens` and `humane` (core.mjs's `RULES.duplicable`). The
  others only hide: `hero` and `examples` carry page-wide meaning, `reader`'s
  carousel script finds the first `[data-carousel]`, and `get-app` has
  `id="join"`. **The hero can't be hidden either** (`RULES.alwaysShown`; BVJ,
  2026-10-28): its title is the page's only `<h1>`. The schema check refuses a
  hidden hero, and the board offers no Hide for it.
- **Image `width`/`height` give the shape before the picture loads.** The ones
  the refactor carried over are the original PNGs' sizes (1350×2760 for a file
  that ships at 489×1000), which is the same shape; the Studio writes each new
  picture's real size. The carousel's `frame` (603×1311) is a shade taller
  than its screenshots (489×1000), as it always was; the Studio fixes it the
  first time a request changes a carousel screenshot (`fitCarouselFrame`).
- **The site's global `.container` gives every section 80px of bottom
  padding**, which `apps.css`'s own `.container` leaves in place. That spacing
  is part of the page's look, and the board copies it.
- The refactor rendered pixel-identical to the page before it (1440, 820 and
  390px, light and dark), checked by building both.

## The Apps Page Studio

BDR's way of changing /apps: a board on claude.ai (**BDR's private
artifact**, so only a session signed in to BDR's account can reach it; a
session in BVJ's account can't) that shows the real page. BDR clicks
anything on it to edit it (words, pictures, buttons, backgrounds, order,
callouts) and sends the edits to Claude as numbered requests. Claude
applies a request with the `/apps-studio` skill
(`.claude/skills/apps-studio/SKILL.md`, which carries the board's address and
the step-by-step), opens the PR, and writes the PR and Cloudflare preview
links back onto the board. Chosen over a CMS (2026-10-26): every CMS here
needs a login system the site doesn't have, couldn't reach copy written into
the templates, and would publish without anyone applying this repo's rules.

- **The board's data** is its artifact database: `studio/page` (the seed: the
  page model, the rules and each image's size, written by Claude from
  `npm run studio:apps -- seed`), `studio/draft` (BDR's unsent edits; Claude
  never writes it; the board saves typing when the field is left, and never
  redraws a panel while a text field has focus, since that drops the caret), and `requests/rNNNN` (sent batches, whose `status`,
  `results`, `calls`, `pr`, `preview` and `log` Claude updates). Uploaded
  pictures are in its asset store; a change holds the asset id.
- **`scripts/apps-studio/core.mjs` is the one rule set**: reading the content
  files into the model, applying a change (refused as a conflict when the page
  no longer holds the `before` BDR edited against), the schema check, the
  house-style notes, where an image goes, and writing back only what changed.
  `frontmatter.mjs` reads and writes the Markdown collections' frontmatter,
  keeping untouched fields byte for byte. `store.mjs` is the disk side
  (`sharp`, the `frames` CLI); `cli.mjs` is `npm run studio:apps`.
- **The board imports `core.mjs` itself** (published beside it), so what it
  shows is what the apply step writes. A change to `core.mjs`,
  `frontmatter.mjs` or anything in `scripts/apps-studio/board/` needs the
  board republished (the skill says how).
- **The board draws the page from `board/page.js`**, which writes the same
  markup as the components, and `board/page.css`, generated from the
  components' own styles (`npm run studio:apps -- board-css`: width media
  queries become container queries, `:global` is unwrapped, a `.replica`
  prefix stands in for Astro's scoping). **A change to a component's markup
  needs the same change in `page.js`, and a change to its styles needs
  `board-css` re-run.** `test/apps-studio.test.js` checks both, in two
  different strengths. The generated `page.css` must equal what `board-css`
  makes from today's components, exactly. The markup check is coarse: the
  class names each component's template writes must be the ones `page.js`
  writes, which catches an element added, renamed or dropped on one side but
  not an element moved, a changed attribute or new text. Beyond that the
  markup is kept in step by hand. The tests also hold `page.js`'s
  `inline`/`band` to `render.ts`, and core's enums to `collections.ts`.
- **Pictures** ship as WebP at quality 80, longest edge 1000px (phones,
  foldable, carousel) or 1300px (tablet), per FIXLIST O8, under a
  lowercase-kebab name the mirror accepts; the original is archived in
  `_source-images/screenshots/` under its own name, with `-2`, `-3` added
  when that name is taken (`IMG_1234.PNG` recurs across phones), so an older
  original is never overwritten. A replaced picture's old file is deleted when
  nothing under `src/` names it. A run that fails its checks puts back every
  file it wrote before stopping (`undo.mjs`): a replaced file gets its old
  bytes, a new one is removed, nothing else is touched. A raw iPhone or iPad
  screenshot can be framed by the `frames` CLI (Apple devices only, with
  BDR's saved colors); Android and foldable pictures arrive framed. The app
  icons are replaced in place, so the home page, the Android banner and the
  share card follow.
- **A picture can be added to a section** (BDR, 2026-10-27; first use, an
  iPhone Duo in the hero and the showcase). On the board it's a note anchored
  to the section that carries the upload and BDR's words about where it goes;
  dropping a file onto a section starts one. The apply step converts it
  (`planPicture`: 1000px tall, or 1300px wide when landscape; framed on
  request, the `frames` CLI knowing the iPhone Duo's screens), once per
  upload, and lists it on the note's result. Claude then lays it out by hand
  and makes it a picture field of the section (`{src, alt, width, height}`
  under a descriptive key, in the JSON, `collections.ts`, the component and
  `board/page.js`). Any picture object in a section is then an ordinary
  picture to the Studio: `slotFor` calls it a `picture`, and `sectionImages`
  finds it for `imagePaths` and the schema check, so no other rule changes.
- **The copy is BDR's.** Curly quotes are applied automatically (the
  board does it during typing); a British spelling, a straight quote that
  survives, or a LIT quotation that doesn't match the chapter is asked about
  on the board as a call, never fixed silently.
- **The first PR needs LSC to do three things once**, besides copying the
  files: spread `appsCollections` from `src/components/apps/collections.ts`
  into its `content.config.ts` (replacing its three pasted schemas), render
  `<AppsPage />` in its `apps.astro` in place of the section list, and add the
  new files (`AppsPage.astro`, `collections.ts`, `render.ts`,
  `src/content/apps-sections/*.json`) to `MIRRORED` in its
  `check-apps-mirror.mjs`.
