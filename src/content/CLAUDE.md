# Content collections and the glossary feed

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory.
> Cross-references such as "below" or "rule 15" were written when all of
> this was one file, so they may point into another area file; the root's
> index says which file holds each section.

## Content Collections (`src/content.config.ts`)

Five collections, all loaded via Astro's `glob` loader. Two are site-wide:

- **`articles`** — `src/content/articles/*.md`. Schema: `title`, `date`,
  optional `author`/`description`/`heroImage`/`featured`, `tags[]`. **An
  article's file name is its slug, and a reader's note names the article by
  it** (the Study Desk, N11), so `src/data/article-slugs.json` lists every
  slug and `test/article-slugs.test.js` fails when one disappears. **Whenever
  an article file is renamed, add the old slug under `renamed` pointing at
  the new one, and add the new slug to `slugs`** (BVJ, 2026-10-13), in the
  same change; without it, every reader's note on that article is cut
  loose. A new article goes in `slugs` too.
- **`glossary`** — `src/content/glossary/*.md`. Schema pairs a `traditional`
  term with the LIT rendering (`greek`, `lit`, `litMenu`, `srOnly`, optional
  `note`/`menuTraditional`/`draft`). Files are named `<traditional>-<lit>.md`
  (e.g. `hell-hades.md`). **The `id` is a stable key, not a slug of `lit`** —
  it is the `/glossary` anchor readers share, the apps' entry key, and
  `term.glossary` in every alignment record (plus the `DISTINCTIVE` set in
  `build-alignment.mjs` and the map in `glossary-lemmas.mjs`). So revising the
  LIT rendering changes `lit`/`litMenu`/`srOnly` and leaves the id and filename
  alone, the way a merged poetry block retires its id rather than renumbering:
  `blasphemy-disrespectfulness` carries `lit: contemptuous speech`, and
  `glory-praiseworthiness` carries `lit: praise / renown`.
  **These files also feed the mobile apps** via `build:glossary` (see The
  Glossary Feed below), so editing one is a publish to both platforms. The two
  surfaces want different things from a body: the site
  renders it as Markdown (`*kalos*` is italic), the apps need plain prose. The
  generator bridges that by flattening emphasis, so keep using it — but richer
  Markdown (links, headings, HTML) **fails the build** rather than reaching a
  phone screen as literal syntax, because neither app can render it.
  **`draft: true` withholds an entry without removing it** — it disappears from
  `/glossary`, the SearchBar term menu, the apps' feed, and (because Pagefind
  indexes the built page) the search index, while the file stays on disk. That
  last part is the whole point: `build-alignment.mjs` seeds its scan from these
  files, so **deleting an entry to unpublish it destroys the review behind it**
  — a term the scan no longer produces loses every `glossary-scan` record it
  has, confirmed ones included, with only a warning from
  `mergeScanWithExisting`. Eight entries were held this way in 2026-08 and 203
  reviewed records rode on it. The scanner is therefore deliberately blind to
  the flag; every reader-facing consumer honors it. Drafts are still parsed and
  flattened, so a body that would break the build breaks it now rather than on
  publication day, and an all-draft collection is an error rather than an empty
  glossary.
  **Which words get an entry at all is an editorial judgment with its own
  register.** Instance count and available information are necessary but not
  sufficient; what decides it is whether the entry changes how a reader holds
  the text. Candidates surveyed and set aside are recorded in
  `GLOSSARY-CANDIDATES.md` with the reasoning, so a term is triaged once rather
  than re-proposed every time a survey re-ranks it.

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

## The glossary feed

- **The glossary feed (`build:glossary` → `/api/data/glossary.json`).** The
  glossary's source of truth is the content collection
  (`src/content/glossary/*.md`), never `src/data/`. `build-glossary-json.mjs`
  compiles it to `public/glossary.json`, which `build:manifest` then picks up as
  the generated fallback source — the same arrangement `topics.json` has with
  `public/topics-index.json`, and the reason the file is gitignored rather than
  committed. The rules the feed's shape must satisfy are documented at length in
  `scripts/lib/glossary-feed-core.mjs`; the five that bite are:
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
     nothing reported it. `/glossary` makes the same phrase a link on the page
     only, at render, through the same `normalizeLabel`.
  5. **`draft: true` withholds an entry rather than removing it.** See the
     `glossary` collection above for why the file has to stay on disk: the
     alignment scanner seeds from it, and an entry deleted to unpublish it
     takes its reviewed records with it.
