# Build and validation scripts (`scripts/`)

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory.
> Cross-references such as "below" or "rule 15" were written when all of
> this was one file, so they may point into another area file; the root's
> index says which file holds each section.

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
   correction (drafts excluded, deterministic output). It also writes
   `public/search/chapters/<book>-<chapter>.json`, one chapter's verses each,
   which the reference previews fetch (~2 KB instead of the whole index). A
   website asset, NOT part of the app contract — it must never move under
   `public/api/`.
4. `build:glossary` — generates `public/glossary.json`, the glossary feed the
   apps sync, from the `src/content/glossary/*.md` collection (deterministic:
   entries sorted by id, index keys sorted, no timestamps). Must run *before*
   `build:manifest`, which resolves it as the generated source behind its
   `glossary.json` declaration. See The Glossary Feed below — its shape is an
   app contract with several silent failure modes.
5. `build:greek-bridge` — generates `public/search/greek-bridge.json`, the
   glossary bridge for searching the Greek by the LIT's own words: each
   gated rendering of a published glossary term, with the term's lemmas and
   the verses so rendered (`scripts/lib/greek-bridge-core.mjs`). LIT content,
   so never in `public/greek/`; a website asset, never under `public/api/`.
   See "The Study Desk preview", rule 15.
6. `build:manifest` — generates `public/api/manifest.json` + `public/api/version.json`
   and copies content files into `public/api/data/` (chapters, intros, intro
   `images/`, plus `glossary.json`, `topics.json` and
   `translation-commitments.json`) so the native apps can diff hashes and
   download only changed files. **This step owns the content `version`**: it's
   `v<YYYYMMDD>.<8-char hash of all file hashes>`, so it changes on *every*
   content publish (including multiple on the same day) and stays stable when
   nothing changed. The apps gate all syncing on this string — see the app-sync
   note below.
7. `build:api` — generates `public/api/content.json` (full NT in canonical
   order). Runs *after* `build:manifest` and reads the shared `version` from
   `version.json` so all three API artifacts report the same version.
8. `build:api2` — generates `public/api/data/v2/`, the content API version 2
   (`API-2-FORMAT.md`): each chapter as its Study Desk anchor text with its
   verses, blocks, lines, emphasis, footnote letters and ⟦ ⟧ spans as offsets,
   plus `books.json`, `content.json` and its own `version.json`. It then adds
   the `v2` key to `manifest.json`, and **never touches the manifest's `files`
   map** (see "Version 2 of the content API" below). It fails the build if any
   chapter's text or verse spans differ from `chapterAnchorText`. Runs after
   `build:manifest` and `build:api` because it reads their `version`.
9. `build:og` — generates `public/og/<slug>.png`, a 1200×630 social share card
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
10. `astro build` — compiles the site to `dist/`.
11. `pagefind --site dist` — indexes glossary + article + book-intro pages
   into `dist/pagefind/` (scripture chapter pages are deliberately not
   Pagefind-indexed — see Search below).

## Build / Validation Scripts (`scripts/`)

| Script | Role |
|--------|------|
| `validate-chapters.mjs` | Validates chapter JSON (with `--fix` to re-serialize). Driven by `chapter_json_invariants.json`, which carries the reasoning for every rule — read it before adding or relaxing one. |
| `lib/chapter-serialize.mjs` | The canonical on-disk form of a chapter file — the serializer behind `--fix`. Unit-tested, because `--fix` rewrites source in place. |
| `chapter_json_invariants.json` | Documents validation rules (e.g. the `indexed` flag). |
| `import-chapter.mjs` | Builds chapter JSON from a Word master `.docx`. **Not** in any build — run by hand when a book is ready. Its guarantee is fidelity, not cleanup: see The Importer below. |
| `lib/import-core.mjs` | Pure transform layer of that importer — the two pre-approved changes, the structural ones, and the fidelity gate. Unit-tested directly (`test/import-core.test.js`), since the guarantee is the whole point. |
| `lib/docx-zip.mjs` | Minimal `.docx` (zip) reader, so an import needs no manual unpack and no dependency. Reads stored + deflate; refuses zip64/encrypted/data-descriptor by name. |
| `build-topics-index.mjs` | Topic indexes (`normalizeTopic` slugifies labels). |
| `build-verse-index.mjs` | fs/CLI shell: walks the chapter files, skips drafts, derives the corpus `vocab`, and writes `public/search/verses.json` — per-verse plain text for client-side scripture keyword search. Delegates the HTML→verse-text extraction to `lib/verse-index-core.mjs`. |
| `build-api-json.mjs` | `public/api/content.json`. |
| `build-api-manifest.mjs` | `public/api/manifest.json` + `public/api/data/` for the native apps. |
| `build-api-v2.mjs` | fs shell for the content API, version 2: writes `public/api/data/v2/` and adds the manifest's `v2` key. Every rule is in `lib/api2-core.mjs`. |
| `lib/api2-core.mjs` | The version 2 chapter: applies the anchor-text rewrites themselves, in order, to characters that remember their block, line and emphasis, so every offset is in the final text by construction; then checks the text and verse spans against `lib/anchor-text.mjs` and throws on a difference. Also `assertV1FilesMap`, the rule that keeps version 2 out of the version 1 `files` map. Unit-tested (`test/api2.test.js`). |
| `build-api2-vectors.mjs` | Writes `test/fixtures/api2-vectors.json`: every chapter's version 2 `hash` beside the hash of the version 1 file it came from, whole files for the edge cases, and hand-written cases. **Not** in the build; regenerate after a deliberate change to `api2-core` or the corpus, and tell the apps. |
| `build-glossary-json.mjs` | fs shell: reads `src/content/glossary/*.md` and writes `public/glossary.json`, the apps' glossary feed. Delegates every rule to `lib/glossary-feed-core.mjs`. |
| `build-greek-bridge.mjs` | fs shell: writes `public/search/greek-bridge.json`, the gated LIT renderings of the published glossary terms with their lemmas and verses, for searching the Greek by the LIT's words. Rules in `lib/greek-bridge-core.mjs` (unit-tested). In the build. |
| `lib/glossary-feed-core.mjs` | Pure `buildGlossaryFeed()` core of that generator — frontmatter parse, Markdown→plain-prose flattening, the `index` maps, and the cross-reference check. Unit-tested directly (`test/build-glossary-feed.test.js`) since its output shape is an app contract. Its header documents the four silent failure modes. |
| `build-og-images.mjs` | `public/og/` — per-chapter/intro share cards (fonts in `scripts/og/fonts/`). |
| `build-favicons.mjs` | Favicon/touch/manifest icons from the emblem SVGs. **Not** in the build — run by hand when the emblem changes. |
| `build-bracket-marker-font.mjs` | `public/fonts/bracket-markers.otf` — subsets the ⟦/⟧ disputed-passage glyphs out of Noto Sans Math, since the site's own webfonts are Latin-only. **Not** in the build — run by hand if the source glyphs ever change. See "Bracketed passages" below. |
| `build-text-critical-font.mjs` | `public/fonts/text-critical-signs.otf` — the six SBLGNT text-critical signs (⸀ ⸁ ⸂ ⸃ ⸄ ⸅, U+2E00–2E05) subset from full Cardo (Google Fonts' TTF, OFL; Fontsource's Cardo subsets lack them), registered under Crimson Text and Inter in `greek-hebrew-fonts.css`. **Not** in the build. |
| `build-greek.mjs` | `public/greek/` — the Study Desk's Greek tab data: one file per chapter (SBL's SBLGNT 1.2 text and paragraphs, MorphGNT's lemmas, parsing and word numbers, the apparatus, two borrowed passages) plus lexicon shards (UBS, STEPBible brief, full LSJ), and `search/`, the Greek search index (a lemma list, then occurrences sharded by lemma, each word with its parsing, and `parse/`, every word by its parsing, for searches with no word in them). Pure rules in `lib/greek-core.mjs` (unit-tested); the search index's folding comes from `src/lib/greek-search.mjs`, so build and query fold alike. **Not** in the build: CI has no copy of the sources, which live outside the repo (`GREEK_SOURCES_DIR`, `MORPHGNT_DIR`). See "The Study Desk preview", rule 14. |
| `build-apps-qr.mjs` | `public/images/apps-qr.svg` — the QR code the app announcement shows on a computer, pointing at `https://litbible.net/apps/` with no tracking parameter. Draws through `src/lib/qr-svg.mjs`, the one QR drawing, which `/sheets/` also loads for its printed codes, so `qrcode-generator` (MIT, no dependencies) is a runtime dependency. **Not** in the build — run by hand if the address ever changes. |
| `build-alignment.mjs` | `src/data/alignment/` — scans published chapters for glossary-term renderings, then checks each against MorphGNT. **Not** in the build; its output is committed and merges with prior human review. See The Alignment Dataset below. |
| `alignment-words/server.mjs` | `npm run review:words` — phase 2's localhost tool (`core.mjs` = pure format and rules, `store.mjs` = fs + corpus, `ui/` = vanilla HTML/CSS/JS, no shared code with the glossary tool's UI). See "Phase 2 tooling" under The Alignment Dataset. |
| `alignment-review/server.mjs` | `npm run review:alignment` — the localhost review UI (`store.mjs` = fs + corpus, `review-core.mjs` = pure logic *also served to the browser*, `ui/` = vanilla HTML/CSS/JS). Node builtins only, no deps. |
| `audit-alignment-words.mjs` | `npm run audit:words` — fs/CLI shell that reports every stale phase 2 record and every link carried across a revision but not yet saved (via `alignment-words/store.mjs`'s `getReport`). Report only; **not** in the build or CI. |
| `audit-alignment.mjs` | fs/CLI shell: re-checks every *decided* alignment record against the current scripture text. **Not** in the build or CI — run by hand after editing chapters. Delegates the check to `lib/alignment-audit-core.mjs`. |
| `lib/morphgnt.mjs` | Reads a gitignored local MorphGNT working copy (lemma-per-verse; `{withTokens}` also keeps every token in verse order, which only the review tool needs). Absent → verification skipped, prior verdicts kept. |
| `lib/glossary-lemmas.mjs` | Editorial map: glossary id → the Greek lemmas that commitment covers. Validated against the corpus at load. |
| `lib/alignment-merge.mjs` | Record identity, merge, and ordering for `src/data/alignment/` — the contract between the scanner and the review tool. Unit-tested. |
| `lib/alignment-forms.mjs` | How a glossary rendering is matched against verse text, and how `english[].n` is counted. Shared so both writers number occurrences identically. |
| `lib/alignment-audit-core.mjs` | Pure staleness check for decided records, no fs of its own. Imports `computeOccurrenceN` from the review tool rather than restating it — agreeing with the writer *is* the check. Unit-tested. |
| `lib/verse-text.mjs` | **The** chapter HTML → per-verse plain-text splitter (`Map<verse, text>`). Shared by `lib/verse-index-core.mjs`, `build-alignment.mjs`, and the review tool, so search and the alignment dataset can never disagree on where a verse starts and ends. (`release-notes-core.mjs` keeps its own, deliberately — see below.) |
| `lib/anchor-text.mjs` | Reference implementation of the Study Desk's anchor text (`STUDY-DESK-FORMAT.md`): how the website and both apps read a chapter as text to place a reader's mark, and how they find it again after the wording moves. Built on `splitChapterVerses`, so a note, a search hit and an alignment record agree on where a verse is. Its pure half (`normalizeAnchorText`, `makeAnchor`, `resolveAnchor`) lives in `src/lib/anchor-core.mjs` and is re-exported here, because the page-side reader `src/lib/desk-anchor-dom.mjs` needs it too. Unit-tested (`test/anchor-text.test.js`), which also checks the committed vectors against it; `test/desk-anchor-dom.test.js` sweeps every published chapter through both views' render pipelines and fails if the page's text and this one ever disagree. |
| `build-anchor-vectors.mjs` | Writes `test/fixtures/anchor-vectors.json` from `lib/anchor-text.mjs`, copying every input into the file so the vectors survive corpus changes. **Not** in the build; needs full git history for its before-and-after cases. After a deliberate change to the rule, regenerate, bump `ANCHOR_SPEC_VERSION`, and tell the apps. |
| `fetch-podcast-feed.mjs` | Refresh podcast XML snapshot (non-fatal on failure). |
| `draft-release-notes.mjs` | CLI/git shell: drafts release-notes entries from git diffs (used by CI). Delegates the diff→changes logic to `lib/release-notes-core.mjs`. |
| `lib/release-notes-core.mjs` | Pure `buildChanges()` core of the drafter — no git/fs/argv of its own (readBase/readNow injected). Unit-tested directly (`test/draft-release-notes.test.js`) since its output shape is an app contract. |
| `lib/verse-index-core.mjs` | Pure `extractVerses()` core of the verse-index builder, no fs of its own: reshapes `lib/verse-text.mjs`'s Map into the dense array `verses.json` ships (index 0 = verse 1, `""` for gaps) — the only part of extraction that is search-specific. Unit-tested directly (`test/build-verse-index.test.js`): `verses.json` isn't an app contract, but it's the whole search surface for scripture, so an extraction regression ships straight to readers. |

## Conventions

- **Version 2 of the content API (`/api/data/v2/`, `API-2-FORMAT.md`) is
  served beside version 1, which is kept indefinitely** (BDR, 2026-10-22).
  Its one hard rule: **nothing of version 2 ever goes into the manifest's
  `files` map, and nothing under `chapters/` there is ever anything but a
  version 1 chapter.** An installed Android build matches
  `chapters/<book>-<n>.json` *anywhere* in a path and decodes it with every
  field defaulted, so a version 2 file listed there would replace a reader's
  chapter with an empty one. Version 2's hashes go under the manifest's own
  `v2` key, which both apps' decoders skip; `assertV1FilesMap`
  (`lib/api2-core.mjs`) fails the build on any `files` path the shipping apps
  don't already know. A version 2 chapter file carries no content version, so
  a publish re-downloads only the chapters that changed; and a new anchor spec
  is a new `api` number and folder, never a change under `/api/data/v2/`. **It
  grows by adding**: a new kind of data gets its own folder under
  `/api/data/v2/` and its own entries in `v2.files`, never fields inside a
  chapter file, and the apps ignore what they don't recognize (that spec's
  "Adding more later"). There is no change list for now (BDR, 2026-10-23): an
  app re-places marks only in chapters whose `hash` moved. A draft that holds
  the translation so far is served with its text like any chapter, still
  `indexed: false`.
- **Content files are hashed by RAW BYTES, so line endings are content.**
  `.gitattributes` (`* text=auto eol=lf`) normalizes on commit, so a committed
  blob can never carry CRLF and the *published* `version` is stable. What it
  does not do is rewrite files already sitting in a working tree: a long-lived
  checkout keeps whatever line endings a file had when it was written,
  `git status` stays clean (`text=auto` compares normalized), and nothing
  reports it. Twelve text files had drifted that way by 2026-08: two book
  intros, four `/apps` mirror examples, three `/apps` mirror components, two
  other components, and `pagefind.yml`. The two intros alone were enough to
  move `build-api-manifest.mjs`'s per-file SHA-256s and therefore the
  content-derived `version`, so a local build and CI disagreed on the API
  version string while each was internally consistent. Production is unaffected
  (CI builds from a fresh clone), but **a local `dist/` then does not
  byte-reproduce the deployed one**, which silently invalidates any byte-level
  comparison — a rendered-output diff for an Astro upgrade, or an investigation
  into why `version` moved. **Scan repo-wide and skip binaries.** Match
  `\r\n` in raw bytes over every tracked file, excluding any containing a
  NUL byte: ~94 tracked images and fonts legitimately carry `0x0D`, so a bare
  `Buffer.includes(13)` buries the real hits in false positives; and scoping the
  scan to `src/data`/`src/content` misses the components and `pagefind.yml`
  entirely. Both mistakes were made while finding these. `grep -c $'\r'` over
  `git show` output misreports it in the other direction.
  Fix by forcing a re-checkout (`rm` the files, then `git checkout --` their
  directories); `git add --renormalize` is a no-op, because the blobs were
  already correct.
- **Release notes are automated**: pushing changes to chapters, intros, glossary,
  or articles on `main` triggers `.github/workflows/release-notes.yml`, which
  runs `draft-release-notes.mjs` and commits to `release-notes.json`.
  **To keep a publish OUT of the changelog**, touch `src/data/release-notes-skip.md`
  in the same commit as the content change and log why there: the workflow
  derives its base ref from the last commit touching *either* file, so the
  drafter’s range comes back empty and nothing is written. Use it for mechanical
  passes whose per-verse detail is noise, never for a wording change — the feed
  below is what readers open to see those. That file
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
  reports **reader-facing changes only**, and the test of "reader-facing" is
  **extracted text, never markup** (owner, 2026-09-06). Modified chapters diff
  rendered verse/footnote text; a chapter edit that moves no visible character
  — an attribute retag, a passage re-set as an `hbq` blockquote, two paragraphs
  merged — is a **formatting** edit and emits *nothing at all*. A **metadata**
  edit (paragraphs and footnotes byte-identical, `title`/`description`/`topics`
  moved) emits nothing too (owner, 2026-09-27): it used to collapse to a
  "metadata updated" row, but a topics retag tells a reader nothing about the
  translation. The feed's two older rows of that type were removed the same
  day, so none remain; the apps and the release notes page still know the
  type, which costs nothing and keeps them safe if one ever reappears.
  Modified intros/glossary/articles are likewise compared with HTML
  attributes and whitespace normalized away, so a mechanical edit (e.g.
  stripping `target="_blank"` from a link) produces no changelog entry.
  An intro is compared on its **body alone**: its frontmatter is
  `description` and `topics`, so an edit confined to it is metadata and
  writes nothing (owner, 2026-09-27). Articles and glossary entries still
  compare the whole file, because their frontmatter is what the reader sees.
  **Two things this must not swallow, both load-bearing:** a bracket-only edit
  (`⟦`/`⟧` are visible characters, so they survive the text comparison on
  purpose) and anything the per-verse split cannot see, which is what the
  paragraph-level fallback in `buildChanges` is for. And note the asymmetry in
  `stripHtml` that all of this rests on: a **block** tag becomes a space, an
  **inline** tag vanishes — Word splits styled phrases mid-word, so
  `<em>ekd</em><em>emeo</em>` has to rejoin, while deleting a `<p>` boundary
  outright welded "ZionA valuable" into the apps' feed for months.

## The Importer (`npm run import:chapter`)

How a Word master becomes chapter JSON. The 2026-02 import was done by hand
and lossy — it shortened notes, dropped a few entirely, added punctuation
nobody wrote, stripped macrons off transliterated Greek, welded verse markers
to the preceding sentence, and fragmented every styled phrase at Word's run
boundaries. Repairing that took six months and the whole of
`scripts/reconcile/`. This exists so the next book does not need any of it.

```bash
npm run import:chapter -- --docx="<path>" --book=philemon --chapter=1 --report
```

`--docx` reads the `.docx` directly (via `lib/docx-zip.mjs`, no unpack step);
`--xml-dir` takes an already-unpacked copy instead. `--all` does every chapter
in the document. **`--report` inspects and writes nothing** — that is the
normal first run. Copy the master out of OneDrive first and point at the copy;
the masters are read-only from this repo, always.

### The guarantee, which is the point

**Not one visible character of the master reaches the JSON altered**, with
exactly two pre-approved exceptions:

1. straight quotes → curly quotes (the corpus convention)
2. digit-hyphen-digit → en dash (repo-only — the masters keep hyphens)

Everything else it notices is **reported and refused, never repaired**: a
typo, a doubled word, a quotation that never closes. That is an owner
decision, and it is not a limitation to route around. The masters are the
origin of the translation, so a defect found during an import gets fixed in
Word and re-imported; an importer that quietly corrected what it found would
recreate the 2026-02 damage in the opposite direction, this time with no
evidence anything had changed. A run with findings writes nothing unless
`--approve` is passed.

The two exceptions are safe to automate **precisely because they are
reversible by rule**. `foldAllowed` folds both back out, so the fidelity gate
can compare the master's own text against what was generated from it and see
straight through them. Everything else shows up. **A third exception can only
be added by extending that fold in the same change** — otherwise it would be
reported as a fidelity failure on every import.

A FIDELITY finding always refuses, and `--approve` does not override it: a
divergence there is a bug in the *importer*, never in the master, because the
master is the origin and anything the importer cannot reproduce from it is
something the importer got wrong.

### What it handles that a hand import did not

- **A footnote reference is zero-width in Word.** It contributes no characters,
  so a verse rebuilt from master text alone loses every `<sup class="fn-ref">`
  anchor inside it and the note becomes unreachable. The importer places
  anchors from the master's own reference positions.
- **Verse numbers are usually superscript runs, but not always** — eight
  chapters type one as body text and Mark 5:39 is a *subscript*. The
  superscript pass and a blind digit-adjacency scan are cross-checked per
  chapter, and a disagreement stops the run rather than picking a side.
  **The refusal is scoped to the chapters being built** (2026-09-21). A book
  is normally part-drafted, and an unformatted chapter says nothing about a
  finished one: Luke 23 sat mid-sentence with its verse numbers still body
  text, and a document-wide gate let that refuse Luke 22, which was finished,
  formatted, and the chapter actually asked for. `--all` still checks every
  chapter, because then every chapter is a target — narrowing changes which
  chapters are examined, never how strictly one is.
- **The verse-marker separator** has to be in the text (`sup.vn` is
  inline-block and no CSS supplies the gap), and the master has none to
  contribute, since the verse span ends *at* the next marker.
- **Word's run boundaries rarely fall on a word**, so styled phrases arrive
  fragmented (`<em>ekd</em><em>e</em><em>me</em><em>o</em>`). Collapsing them
  changes no visible character and is what keeps the corpus searchable.

### Verifying it

The strongest available check is that it **reproduces an existing chapter
exactly** — run it against a finished book before trusting it on a new one.
Titus 2 is the useful negative: it refuses, catching the one master-side defect
§23's back-port table already lists.

**Philemon is that check.** It stands at **7/8 paragraphs and 16/16
footnotes** as of 2026-09. The one remaining delta is a known **master-vs-repo
wording** difference queued for back-port — p2 renders *ekklesia* as "the
community" in the repo and "the assembly" in the master (the corpus says
community; see `FOLLOW-UP-RECONCILIATION.md`) — so a clean run today is 7/8,
not 8/8.

**Luke 22 is the larger check, added 2026-09-21**: 37 paragraphs and 51
footnotes against Philemon's 8 and 16, and a narrative chapter rather than a
letter. It stands at **36/37 paragraphs and 50/51 footnotes**, and both deltas
are known and open rather than importer faults — p34 carries v69, where the
repo's "at the right hand of the Power of God" stands over the master by owner
ruling and is queued for back-port, and fn-bb is a note whose quotes `curlify`
refuses, so the importer leaves the master's characters alone (correctly) while
the repo carries a hand-curled version. Neither will close until Word changes.

That distinction is the thing to hold onto: **a Philemon delta is a
master-vs-repo report, not automatically an importer bug**, and the two are
told apart by asking which side is right rather than by the count moving. It
briefly read 6/8 and 12/16, and *that* was the importer — a chapter-number
heading leaking into paragraph 1 and a verse-initial token split across Word
runs, both since fixed. The four footnote deltas were repo-only normalizations
the importer now performs (edge-whitespace trimming, comma-lifting out of
styled runs). Re-baseline these numbers when either side is deliberately
changed, rather than treating an older figure as the target.

The pure layer is `lib/import-core.mjs` and is unit-tested directly
(`test/import-core.test.js`), following the same shell/core split as
`build-verse-index.mjs` and `build-glossary-json.mjs`. The shell holds fs,
argv, and the scan; nothing else.
