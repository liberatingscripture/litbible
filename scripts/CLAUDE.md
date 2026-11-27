# Build and validation scripts (`scripts/`)

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory.

## The toolchain's pins

- **Node**: `.node-version` (24, the major CI uses) is what Cloudflare Pages
  builds with; with no pin, Pages falls back to its image's default, and a
  2026-10 Astro minor that raised its floor to 22.22 failed every Pages
  build while GitHub CI stayed green. Keep `engines` in `package.json` (and
  the root `engines` copy in `package-lock.json`) at the higher of Astro's
  minimum and the test suite's, and leave the dashboard's `NODE_VERSION`
  unset so it doesn't override the file.
- **Two Astro 7 defaults are pinned back to their Astro 6 behavior** in
  `astro.config.mjs`, each with a comment explaining why: `compressHTML:
  true` (the new `'jsx'` default joins deliberately spaced adjacent inline
  text, which corrupts accessible names and Pagefind's extracted text) and
  `markdown: { processor: unified() }` (the new Sätteri Markdown pipeline
  changes published copy). Don't drop either without re-running a
  rendered-output diff; adopting Sätteri is a **content** decision for the
  owner, not an upgrade side effect.

## Commands run by hand

None of these runs in `npm run build`, and each one's output is committed
(the "Build / Validation Scripts" table below has each script's rules):

```bash
npm run build:favicons     # favicon/touch/manifest icons from the emblem SVGs
npm run build:bracket-font # public/fonts/bracket-markers.otf (the ⟦/⟧ glyph patch)
npm run build:text-critical-font # public/fonts/text-critical-signs.otf (the SBLGNT's ⸀–⸅ signs)
npm run build:greek        # public/greek/, from clones outside the repo (GREEK_SOURCES_DIR,
                           #   MORPHGNT_DIR); see public/greek/CLAUDE.md
npm run build:apps-qr      # public/images/apps-qr.svg, the app announcement's QR code
npm run build:alignment    # rescan for glossary-term renderings (src/data/alignment/; carries review state)
npm run review:alignment   # localhost review tool for that dataset (needs the MorphGNT clone)
npm run review:words       # alignment phase 2: link SBLGNT words to LIT words (port 4501;
                           #   --chapters-dir=<dir> aligns English not yet in the corpus)
npm run build:anchor-vectors        # test/fixtures/anchor-vectors.json (the apps fetch it)
npm run build:api2-vectors          # test/fixtures/api2-vectors.json (likewise)
npm run build:sheet-golden          # test/fixtures/sheet-text-golden.json (bump SHEET_FORMAT if one moved)
npm run build:notebook-crypto-vectors # test/fixtures/notebook-crypto-vectors.json (the apps fetch it)
npm run draft:release-notes -- --since <ref>  # draft a release-notes entry from git diff
npm run studio:apps -- <seed|apply|check|board-css|board-files>  # src/components/apps/CLAUDE.md
```

Each build step also runs alone (`build:topics`, `build:verses`,
`build:glossary`, `build:greek-bridge`, `build:manifest`, `build:api`,
`build:api2`, `build:og`); their outputs are git-ignored.

## The apps' sync contract

**Mobile apps are first-class consumers** of `public/api/`, so changing a
chapter, intro or manifest shape can break them; treat the API as a
contract. Both apps poll `version.json` first and do nothing further unless
its `version` string differs from what they last stored (a cheap ~80-byte
check, run at most once every 24 hours on foreground, by a ~6-hour
background task, and on pull-to-refresh). Only on a change do they fetch
`manifest.json` and download the files whose SHA-256 hashes moved. **So the
whole system works only if `version` moves on every content publish**, which
is why it's content-derived (build step 6), not date-only. The sync-critical
files (`version.json`, `manifest.json`, `data/*`) are served `no-store` in
`public/_headers`, so a version bump is never served beside a stale manifest
or data file.

**An optional top-level file that never resolves is skipped silently.**
`topLevelFiles` in `build-api-manifest.mjs` throws only for `required: true`
entries; anything else missing takes the `// optional + missing → skip
silently` branch. `glossary.json` sat there as optional from 2026-03 to
2026-08 with a source that never existed, so the API carried no glossary for
five months, nothing reported it, and the two apps' bundled copies drifted
apart. It is `required: true` now, and generated (`src/content/CLAUDE.md`,
"The glossary feed"). **Treat any new optional entry with suspicion**:
silence is its failure mode.

## Build Pipeline (`npm run build`, in order)

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
   `glossary.json` declaration. Its shape is an app contract with several
   silent failure modes (`src/content/CLAUDE.md`, "The glossary feed").
5. `build:greek-bridge` — generates `public/search/greek-bridge.json`, the
   glossary bridge for searching the Greek by the LIT's own words: each
   gated rendering of a published glossary term, with the term's lemmas and
   the verses so rendered (`scripts/lib/greek-bridge-core.mjs`). LIT content,
   so never in `public/greek/`; a website asset, never under `public/api/`
   (`public/greek/CLAUDE.md`, rule 15).
6. `build:manifest` — generates `public/api/manifest.json` + `public/api/version.json`
   and copies content files into `public/api/data/` (chapters, intros, intro
   `images/`, plus `glossary.json`, `topics.json` and
   `translation-commitments.json`) so the native apps can diff hashes and
   download only changed files. **This step owns the content `version`**: it's
   `v<YYYYMMDD>.<8-char hash of all file hashes>`, so it changes on *every*
   content publish (including multiple on the same day) and stays stable when
   nothing changed. The apps gate all syncing on this string ("The apps'
   sync contract" above).
7. `build:api` — generates `public/api/content.json` (full NT in canonical
   order). Runs *after* `build:manifest` and reads the shared `version` from
   `version.json` so all three API artifacts report the same version.
8. `build:api2` — generates `public/api/data/v2/`, the content API version 2
   (`API-2-FORMAT.md`): each chapter as its Study Desk anchor text with its
   verses, blocks, lines, emphasis, footnote letters and ⟦ ⟧ spans as offsets,
   plus `books.json`, `content.json` and its own `version.json`. It then adds
   the `v2` key to `manifest.json`, and **never touches the manifest's `files`
   map** (see "Conventions" below, the version 2 rule). It fails the build if any
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
   contract: it must never move under `public/api/`.
10. `astro build` — compiles the site to `dist/`. **No `CLAUDE.md` ships.**
    Astro would publish one under `src/pages/` (it makes a page of every
    `.md` there) or under `public/` (it copies that folder as it is). Claude
    Code loads an area doc only by that name, beside its code, so none can be
    renamed or moved, and Astro skips a page file by name only for a leading
    `_` or `.`. So when the build ends, `claudeDocsGuard()` (in
    `astro.config.mjs`) deletes every `CLAUDE.md`, and any page made from
    one, from `dist/`, and the sitemap filter drops its address.
    `check:links` fails a built site that still has either. The one rule is
    `src/lib/claude-docs-guard.mjs`, held by
    `test/claude-docs-guard.test.js`. The dev server is left alone, since
    nothing it serves is published.
11. `pagefind --site dist` — indexes glossary + article + book-intro pages
   into `dist/pagefind/` (scripture chapter pages are deliberately not
   Pagefind-indexed; see `src/scripts/CLAUDE.md`, "Search").

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
| `build-api2-vectors.mjs` | Writes `test/fixtures/api2-vectors.json`: every chapter's version 2 `hash` and `words` fingerprint beside the hash of the version 1 file it came from, whole files for the edge cases, and hand-written cases. **Refuses to write** when an unedited chapter's or a copied input's words change under the same `api` (`wordsChanges`; `--allow-words-change` overrides, only before any app reads version 2). **Not** in the build; regenerate after a deliberate change to `api2-core` or the corpus, and tell the apps. |
| `build-glossary-json.mjs` | fs shell: reads `src/content/glossary/*.md` and writes `public/glossary.json`, the apps' glossary feed. Delegates every rule to `lib/glossary-feed-core.mjs`. |
| `build-greek-bridge.mjs` | fs shell: writes `public/search/greek-offers.json` (the small word list behind the search's "also a Greek word" offer, from the same glossary lemmas) and `public/search/greek-bridge.json`, the gated LIT renderings of the published glossary terms with their lemmas and verses, for searching the Greek by the LIT's words. Rules in `lib/greek-bridge-core.mjs` (unit-tested). In the build. |
| `lib/glossary-feed-core.mjs` | Pure `buildGlossaryFeed()` core of that generator — frontmatter parse, Markdown→plain-prose flattening, the `index` maps, and the cross-reference check. Unit-tested directly (`test/build-glossary-feed.test.js`) since its output shape is an app contract. Its header documents the four silent failure modes. |
| `build-og-images.mjs` | `public/og/` — per-chapter/intro share cards (fonts in `scripts/og/fonts/`). |
| `build-favicons.mjs` | Favicon/touch/manifest icons from the emblem SVGs. **Not** in the build — run by hand when the emblem changes. |
| `build-bracket-marker-font.mjs` | `public/fonts/bracket-markers.otf` — subsets the ⟦/⟧ disputed-passage glyphs out of Noto Sans Math, since the site's own webfonts are Latin-only. **Not** in the build — run by hand if the source glyphs ever change. See `src/data/chapters/CLAUDE.md`, "Bracketed passages." |
| `build-text-critical-font.mjs` | `public/fonts/text-critical-signs.otf` — the six SBLGNT text-critical signs (⸀ ⸁ ⸂ ⸃ ⸄ ⸅, U+2E00–2E05) subset from full Cardo (Google Fonts' TTF, OFL; Fontsource's Cardo subsets lack them), registered under Crimson Text and Inter in `greek-hebrew-fonts.css`. **Not** in the build. |
| `build-greek.mjs` | `public/greek/` — the Study Desk's Greek tab data: one file per chapter (SBL's SBLGNT 1.2 text and paragraphs, MorphGNT's lemmas, parsing and word numbers, the apparatus, two borrowed passages) plus lexicon shards (UBS, STEPBible brief, full LSJ), and `search/`, the Greek search index (a lemma list, then occurrences sharded by lemma, each word with its parsing and, where MACULA tags it with another Strong's number than its lemma's, that number (GK8-1), and `parse/`, every word by its parsing, for searches with no word in them). Pure rules in `lib/greek-core.mjs` (unit-tested); the search index's folding comes from `src/lib/greek-search.mjs`, so build and query fold alike. **Not** in the build: CI has no copy of the sources, which live outside the repo (`GREEK_SOURCES_DIR`, `MORPHGNT_DIR`). See `public/greek/CLAUDE.md`, rule 14. |
| `build-apps-qr.mjs` | `public/images/apps-qr.svg` — the QR code the app announcement shows on a computer, pointing at `https://litbible.net/apps/` with no tracking parameter. Draws through `src/lib/qr-svg.mjs`, the one QR drawing, which `/sheets/` also loads for its printed codes, so `qrcode-generator` (MIT, no dependencies) is a runtime dependency. **Not** in the build — run by hand if the address ever changes. |
| `build-alignment.mjs` | `src/data/alignment/` — scans published chapters for glossary-term renderings, then checks each against MorphGNT. **Not** in the build; its output is committed and merges with prior human review (`src/data/alignment/CLAUDE.md`). |
| `alignment-words/server.mjs` | `npm run review:words` — phase 2's localhost tool (`core.mjs` = pure format and rules, `store.mjs` = fs + corpus, `ui/` = vanilla HTML/CSS/JS, no shared code with the glossary tool's UI). Rules: `src/data/alignment/CLAUDE.md`, "Phase 2 tooling." |
| `apps-studio/cli.mjs` | `npm run studio:apps` — the Apps Page Studio's scripts: `seed` (the /apps page as the board's model), `apply` (a request from the board, written back to the content files, pictures converted), `check`, `board-css`, `board-files`. Rules in `core.mjs` (pure, unit-tested, and imported by the board itself); see `src/components/apps/CLAUDE.md`. **Not** in the build. |
| `alignment-review/server.mjs` | `npm run review:alignment` — the localhost review UI (`store.mjs` = fs + corpus, `review-core.mjs` = pure logic *also served to the browser*, `ui/` = vanilla HTML/CSS/JS). Node builtins only, no deps. |
| `audit-alignment-words.mjs` | `npm run audit:words` — fs/CLI shell that reports every stale phase 2 record and every link carried across a revision but not yet saved (via `alignment-words/store.mjs`'s `getReport`). Report only; **not** in the build or CI. |
| `audit-alignment.mjs` | fs/CLI shell: re-checks every *decided* alignment record against the current scripture text. **Not** in the build or CI — run by hand after editing chapters. Delegates the check to `lib/alignment-audit-core.mjs`. |
| `lib/morphgnt.mjs` | Reads a gitignored local MorphGNT working copy (lemma-per-verse; `{withTokens}` also keeps every token in verse order, which only the review tool needs). Absent → verification skipped, prior verdicts kept. |
| `lib/glossary-lemmas.mjs` | Editorial map: glossary id → the Greek lemmas that commitment covers. Validated against the corpus at load. Also `LEMMA_WORDS`: each of those lemmas' own traditional word and Latin spelling, which the term lens's card and a sheet's hints print (E85; `src/data/alignment/CLAUDE.md`, the term lens's rule 7). Each entry's own `traditional` and `greek` must stand on one of its lines (the traditional word compared without case: the list is lowercase but for the names Bibles capitalize); `test/term-words.test.js` holds it, and the list's own rules are in its header. |
| `lib/alignment-merge.mjs` | Record identity, merge, and ordering for `src/data/alignment/` — the contract between the scanner and the review tool. Unit-tested. |
| `lib/alignment-forms.mjs` | How a glossary rendering is matched against verse text, and how `english[].n` is counted. Shared so both writers number occurrences identically. |
| `lib/alignment-audit-core.mjs` | Pure staleness check for decided records, no fs of its own. Imports `computeOccurrenceN` from the review tool rather than restating it — agreeing with the writer *is* the check. Unit-tested. |
| `lib/verse-text.mjs` | **The** chapter HTML → per-verse plain-text splitter (`Map<verse, text>`). Shared by `lib/verse-index-core.mjs`, `build-alignment.mjs`, and the review tool, so search and the alignment dataset can never disagree on where a verse starts and ends. (`release-notes-core.mjs` keeps its own, deliberately; see "Release notes are automated" below.) |
| `lib/anchor-text.mjs` | Reference implementation of the Study Desk's anchor text (`STUDY-DESK-FORMAT.md`): how the website and both apps read a chapter as text to place a reader's mark, and how they find it again after the wording moves. Built on `splitChapterVerses`, so a note, a search hit and an alignment record agree on where a verse is. Its pure half (`normalizeAnchorText`, `makeAnchor`, `resolveAnchor`) lives in `src/lib/anchor-core.mjs` and is re-exported here, because the page-side reader `src/lib/desk-anchor-dom.mjs` needs it too. Unit-tested (`test/anchor-text.test.js`), which also checks the committed vectors against it; `test/desk-anchor-dom.test.js` sweeps every published chapter through both views' render pipelines and fails if the page's text and this one ever disagree. |
| `build-anchor-vectors.mjs` | Writes `test/fixtures/anchor-vectors.json` from `lib/anchor-text.mjs`, copying every input into the file so the vectors survive corpus changes. **Not** in the build; needs full git history for its before-and-after cases. After a deliberate change to the rule, regenerate, bump `ANCHOR_SPEC_VERSION`, and tell the apps. |
| `build-notebook-crypto-vectors.mjs` | Writes `test/fixtures/notebook-crypto-vectors.json`, the test vectors for the synced notebook's encryption (`STUDY-DESK-ENCRYPTION.md`), from the reference the website ships, `src/lib/desk-crypto.mjs`. Both apps run the file. Every "random" input is SHA-256 of a label, so two runs give the same bytes, and each value is cross-checked against `node:crypto` as it is made (HKDF, AES-256-GCM, the key agreement, key pairs, signatures). `test/desk-crypto.test.js` fails when the committed file isn't what this builds, and runs the reference against published vectors (`test/fixtures/published-crypto-vectors.json`, each source named) before LIT's own. **Not** in the build. After a deliberate change to a rule: change the spec with it, regenerate, bump `CRYPTO_VECTORS_VERSION`, and tell the apps. |
| `lib/p256-fixed.mjs` | P-256 in plain BigInt, **for those vectors and their test only**: a public key from a private scalar, and an ECDSA signature with a chosen number, the two things WebCrypto can't do with fixed inputs. Not constant time; nothing the site ships imports it. |
| `build-sheet-text-golden.mjs` | Writes `test/fixtures/sheet-text-golden.json`: the sheet templates' formatted text and a seeded set of random HTML, each with the sheet sanitizer's output, held byte for byte by `test/desk-sheets.test.js`. A stored sheet is valid only while its canonical form never changes, so a sanitizer change that moves one fails there and is made deliberately: regenerate, and bump `SHEET_FORMAT` if a stored sheet could hold the old form. **Not** in the build. |
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
  a publish re-downloads only the chapters that changed. **Apps check `api`
  alone**: a change to the rules that make the words (text, verse spans,
  footnote text) is a new `api` number and folder, never a change under
  `/api/data/v2/`, and `build:api2-vectors` refuses one under the same `api`.
  The Study Desk's `anchorSpec` stays out of chapter files and `books.json`
  (BVJ, 2026-10-27), since it also moves for changes that alter no word. **It
  grows by adding**: a new kind of data gets its own folder under
  `/api/data/v2/` and its own entries in `v2.files`, never fields inside a
  chapter file, and the apps ignore what they don't recognize (that spec's
  "Adding more later"). There is no change list for now (BDR, 2026-10-23): an
  app re-places marks only in chapters whose `hash` moved, and footnote pins
  where a footnote's `text` changed. A draft that holds
  the translation so far is served with its text like any chapter, still
  `indexed: false`.
- **Content files are hashed by RAW BYTES, so line endings are content.**
  `.gitattributes` (`* text=auto eol=lf`) normalizes on commit, so a committed
  blob can never carry CRLF and the *published* `version` is stable. What it
  does not do is rewrite files already sitting in a working tree: a long-lived
  checkout keeps whatever line endings a file had when it was written,
  `git status` stays clean (`text=auto` compares normalized), and nothing
  reports it. Twelve text files had drifted that way by 2026-08 (book intros, `/apps`
  mirror files, other components, `pagefind.yml`), and two intros alone moved
  `build-api-manifest.mjs`'s per-file SHA-256s and therefore the
  content-derived `version`, so a local build and CI disagreed on the API
  version string. Production is unaffected (CI builds from a fresh clone), but
  **a local `dist/` then does not byte-reproduce the deployed one**, which
  silently invalidates any byte-level comparison (a rendered-output diff for
  an Astro upgrade, or an investigation into why `version` moved). **Scan
  repo-wide and skip binaries.** Match `\r\n` in raw bytes over every tracked
  file, excluding any containing a NUL byte: ~94 tracked images and fonts
  legitimately carry `0x0D`, so a bare `Buffer.includes(13)` buries the real
  hits, and scoping the scan to `src/data`/`src/content` misses the components
  and `pagefind.yml`. `grep -c $'\r'` over `git show` output misreports it in
  the other direction.
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
  passes whose per-verse detail is noise, never for a wording change — the
  release notes page is what readers open to see those. That file
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
  moved) emits nothing too (owner, 2026-09-27), since a topics retag tells a
  reader nothing about the translation. The apps and the release notes page
  still know the "metadata updated" row type, which keeps them safe if one
  ever reappears.
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
and lossy (it shortened or dropped notes, added punctuation nobody wrote,
stripped macrons, welded verse markers to the preceding sentence, and
fragmented every styled phrase at Word's run boundaries), and repairing that
took six months and the whole of `scripts/reconcile/`. This exists so the next
book does not need any of it.

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
  finished one (Luke 23's unformatted verse numbers once refused Luke 22).
  `--all` still checks every
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
`FOLLOW-UP-RECONCILIATION.md` §23's back-port table already lists.

**Philemon is that check.** It stands at **7/8 paragraphs and 16/16
footnotes** (2026-09). The one remaining delta is a known **master-vs-repo
wording** difference queued for back-port: p2 renders *ekklesia* as "the
community" in the repo and "the assembly" in the master (the corpus says
community; see `FOLLOW-UP-RECONCILIATION.md`), so a clean run today is 7/8,
not 8/8.

**Luke 22 is the larger check** (2026-09-21; a narrative chapter, 37
paragraphs and 51 footnotes). It stands at **36/37 paragraphs and 50/51
footnotes**, and both deltas are known and open rather than importer faults:
p34 carries v69, where the repo's "at the right hand of the Power of God"
stands over the master by owner ruling and is queued for back-port, and fn-bb
is a note whose quotes `curlify` refuses, so the importer leaves the master's
characters alone (correctly) while the repo carries a hand-curled version.
Neither will close until Word changes.

That distinction is the thing to hold onto: **a Philemon delta is a
master-vs-repo report, not automatically an importer bug**, and the two are
told apart by asking which side is right rather than by the count moving.
Re-baseline these numbers when either side is deliberately changed, rather
than treating an older figure as the target.

The pure layer is `lib/import-core.mjs` and is unit-tested directly
(`test/import-core.test.js`), following the same shell/core split as
`build-verse-index.mjs` and `build-glossary-json.mjs`. The shell holds fs,
argv, and the scan; nothing else.
