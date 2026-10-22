# The content API, version 2 (draft 2)

**Status: draft 2, 2026-10-22. Built on the website, on branch `api-v2`, as a draft pull request to
BVJ; nothing is served until he merges it.** Draft 1 was written the same day by the iOS app's Claude
instance. Draft 2 folds in the review BDR accepted (`LIT Handoff/API-2-REVIEW-2026-10-22.md`, ten
tunings) and what building it showed. It sits beside `STUDY-DESK-FORMAT.md` on purpose: the two agree
on one text, and that agreement is the whole point.

**Decided by BDR, 2026-10-22:** one file per chapter, not per book; version 1 is kept indefinitely;
the review's tunings are adopted. The order across the three platforms: the website first (this
branch), iOS ingests in its November update, Android in December.

The reference is `scripts/lib/api2-core.mjs` (the rules, pure) and `scripts/build-api-v2.mjs` (the
files). The vectors the apps run are `test/fixtures/api2-vectors.json`.

## ⚠️ The one rule that protects the installed apps

**Nothing about version 2 goes into the version 1 manifest's `files` map, and nothing under
`chapters/` there is ever anything but a version 1 chapter.** An installed Android build recognizes a
chapter by matching `chapters/<book>-<n>.json` *anywhere* in a path and decodes it with every field
defaulted, so a version 2 file listed in `files` would replace the reader's chapter with an empty
one. Version 2's hashes go under a sibling key, `v2`, which both apps' decoders skip (iOS `Codable`,
Android `ignoreUnknownKeys`). `test/api2.test.js` holds the build to this, and the build itself
refuses a `files` map holding any path the shipping apps don't already know.

## Why

Today the apps receive each chapter as a list of HTML paragraphs (`/api/data/chapters/<book>-<n>.json`)
and each app parses that HTML itself to find the words, the verse numbers, the footnote letters, the
block ids and the bracket markers. Three things follow, and version 2 removes all three:

1. **Paragraph positions move.** When a block is merged or split (Matthew 20 on 2026-08-18, Romans 3
   on 2026-09-06), every mark kept in paragraph coordinates points at the wrong words until a
   re-anchor pass guesses. The Study Desk format already fixed the *address* of a mark (verse plus
   quoted words); the apps still have to derive it from HTML they parse themselves.
2. **Three parsers, one rule.** Each app must turn the HTML into the anchor text exactly as the
   website does (`STUDY-DESK-FORMAT.md`, "Anchor text"). Version 2 ships the rule's *output*, so
   there is one parser: the website's, checked against its own reference on every build.
3. **The reader's text box is shaped by the input.** One text box per chapter (iOS DA-B9d) needs the
   chapter's words and every position in one piece. Version 2 is that piece.

What it does **not** change: the website's pages (they keep rendering from the chapter JSON),
version 1 (built beside version 2 from the same source in the same run, unchanged byte for byte),
how BVJ writes, and the Study Desk record format.

## The one rule

**A chapter's `text` is exactly its anchor text** as `STUDY-DESK-FORMAT.md` defines it and
`chapterAnchorText` in `scripts/lib/anchor-text.mjs` computes it (`ANCHOR_SPEC_VERSION` 1): the
verses in number order, joined by one space, each verse's words with its number and footnote letters
dropped, block boundaries as one space, entities decoded, NFC, zero-width characters and soft hyphens
removed, the bracket markers stripped, whitespace collapsed, quotes and dashes as written.

**The build checks it.** For every chapter, `text` and every verse span must equal
`chapterAnchorText`'s, or `npm run build` fails before anything is published. On 2026-10-22: all 260
chapters (210 published, 50 drafts) identical, 6,535 verses, 2,250 blocks, 348 lines, 5,738
footnote letters placed.

**Offsets** are UTF-16 code units, `[start, end)`, as JavaScript, Kotlin and Swift's `utf16` view all
count. The text has nothing outside the Basic Multilingual Plane today, so they also equal code-point
offsets. Every offset is in the final, normalized text.

**The spec bump rule.** An app reads a chapter only when its `api` and `anchorSpec` are ones it
implements. A change to the anchor rule (`ANCHOR_SPEC_VERSION` 2) is a new `api` number and a new
folder (`/api/data/v3/`), never a change to the files under `/api/data/v2/`, so a client can never
place a mark against text built by a rule it doesn't know.

## The files

All static, under `/api/data/v2/`, which both apps already resolve manifest paths against
(`/api/data/`), and which `public/_headers` already serves `no-store` like the rest of `/api/data/`:

| File | What |
|---|---|
| `v2/version.json` | the gate a version 2 app polls: `{ api, anchorSpec, version, contentHash, chapterCount }` |
| `v2/books.json` | the 27 books in canonical order: `{ bookKey, name, chapters, indexed: [bool per chapter] }` |
| `v2/chapters/<book>-<n>.json` | one per chapter, below |
| `v2/content.json` | every chapter in one file, `{ api, anchorSpec, version, contentHash, chapters: [...] }`, for the many-changes path and a first sync |

`version` is the build's content version, the same string `/api/version.json` carries. `contentHash`
is version 2's own (eight hex digits over every version 2 file's hash, as version 1 computes its own):
it moves when any version 2 file moves, which catches the one case `version` can't, a change to the
exporter alone with no new wording. **A version 2 app syncs when either differs from what it stored.**

## The manifest

`/api/manifest.json` keeps every byte it has today and gains one key after `files`:

```jsonc
"v2": {
  "api": 2,
  "anchorSpec": 1,
  "version": "v20261022.f40155c1",       // the same string as the top-level version
  "contentHash": "c427cb08",             // as v2/version.json
  "files": {                              // paths relative to /api/data/v2/
    "books.json": "<sha256 of the file>",
    "chapters/john-3.json": "<sha256 of the file>"
    // … all 260 chapters
  },
  "content": "<sha256 of v2/content.json>"
}
```

A new app diffs `v2.files` with the same hash-and-download code it uses for `files`. **`content.json`
is not in `v2.files`**, for the same reason version 1's `/api/content.json` is not in `files`: it is an
alternative way to get the same chapters, and a generic diff that saw it change would download it on
top of the chapters it holds. Its hash is `v2.content`. (Draft 2 departs from the brief here, which
listed it inside `files`.)

The `v2` key is added by `build-api-v2.mjs`, which runs after `build:manifest`, rewrites the manifest
with the same serialization, and leaves `build-api-manifest.mjs` itself untouched.

## A chapter

```jsonc
{
  "api": 2,
  "anchorSpec": 1,
  "bookKey": "john",
  "chapter": 3,
  "indexed": true,                     // false = a draft; text is ""
  "title": "John 3",
  "description": "John 3 in the Liberation and Inclusion Translation (LIT).",
  "topics": ["Nicodemus", "…"],
  "hash": "…",                         // SHA-256 of text as UTF-8, lowercase hex
  "text": "There was a Pharisee …",

  "verses":    [ { "v": 1, "start": 0, "end": 78 }, … ],
  "blocks":    [ { "id": "john-3-p1", "kind": "p", "start": 0, "end": 812 },
                 { "id": "luke-1-p17", "kind": "hbq", "start": 813, "end": 1104,
                   "lines": [ { "start": 813, "end": 869 }, … ] } ],
  "runs":      [ { "kind": "em", "start": 2191, "end": 2195 } ],
  "footnotes": [ { "id": "fn-a", "refId": "fnref-a", "label": "a", "at": 97,
                   "html": "…as in version 1…", "text": "…the footnote's anchor text…" } ],
  "marks":     [ { "kind": "disputed", "start": 1045, "end": 2584, "opens": true, "closes": true } ],
  "figures":   [ { "after": null, "html": "<figure>…</figure>" } ]
}
```

Field by field:

- **`hash`**: the SHA-256 of `text` encoded as UTF-8, written as 64 lowercase hex digits. It changes
  only when the words change: a block split, a footnote added or a topic retagged leaves it alone. A
  draft's is the hash of `""` (`e3b0c442…b855`). The apps use it to know whether any mark in the
  chapter needs re-placing at all.
- **`verses`**: `assembleChapter`'s spans, in number order. A verse running across a block boundary
  is one span. A verse-number gap (Matthew 17:21) is simply absent.
- **`blocks`**: one per `<p id>` or `<blockquote id>` in `paragraphs`, in order, with **BVJ's block
  id** (`john-3-p1`): the id the Study Desk calls permanent, retired when a block is merged away,
  never reused. `kind` is **`p`** or **`hbq`** (the site's own name for `<blockquote class="hbq">`, a
  quotation set as lines; not `poetry`, since the site's rule is that `hbq` means quotation, not
  poetry as such). A block's span runs from its first non-space character to its last; the one space
  between two blocks belongs to neither. **`lines`**, when present: an `hbq` block's
  `<p class="hbq-line">` children, or a `p` set as lines with `<br>` (2 Corinthians 6:2 is the one
  published case), each line's span in the same sense. The apps break the line where one ends; the
  text holds one space there, as the anchor rule says.
- **`runs`**: inline emphasis, one per `<em>` or `<strong>` element (`kind` `em` or `strong`), from its
  first non-space character to its last. An element crossing a verse boundary is one run and covers
  the space between the verses. On 2026-10-22 the published text has 110 `em` and no `strong` (all
  150 `<strong>` are in the drafts' placeholder heading, which is not in `text`). Nothing else inline
  is in use: the whole corpus has `p`, `span.vglue`, `sup.vn`, `sup.fn-ref`, `a` (only inside
  `sup.fn-ref`), `blockquote.hbq`, `p.hbq-line`, `em`, `strong`, `br`, and the drafts' `figure`,
  `img`, `figcaption`, `h2`. Verse-number glue (`span.vglue`) is display logic the apps already own;
  they draw each verse number at its verse's `start`.
- **`footnotes`**: version 1's objects (`id`, `refId`, `label`, `html`) plus **`at`**, where the letter
  stood: it sat before `text[at]`, so a letter after a word is at the end of that word. Plus
  **`text`**, the footnote read by the format's own rule (block boundaries a space, other tags gone,
  entities decoded, then the normalization: `footnoteText` in `src/lib/desk-footnotes.mjs`, the
  string a `footnotePin` stores). Letters and ids are positional and shift when a note is added
  earlier in the chapter; the stable identity is the verse plus `text`, as the format has it. A
  letter ahead of the chapter's first verse marker (Colossians 4) is at `0`, the first verse's start,
  as the format files it.
- **`marks`**: the `⟦ ⟧` spans, which the anchor rule strips from `text`. A mark starts at the first
  word after its `⟦` and ends after the last word before its `⟧`, so a `⟦` standing ahead of a verse
  number starts at that verse. `opens` and `closes` say whether the chapter holds the `⟦` and the
  `⟧`: John 7:53–8:11 opens in John 7 (`closes` false, running to the end of the text) and closes in
  John 8 (`opens` false, starting at 0). The apps draw the brackets from these and keep them out of
  everything that leaves the app.
- **`figures`**: a draft's placeholder art, as HTML, placed `after` a block id (`null` at the top).
  **A `<figure>` appears only in a draft**, which the chapter validator enforces
  (`no_figure_in_published_chapter`) and the exporter refuses to break, so no caption word can reach
  `text`. A draft's other placeholder paragraph (the "still in progress" heading the website stopped
  printing) is not served.

**Not in a chapter file: the content version.** Draft 1 put `contentVersion` in every chapter. With
one file per chapter, that would change all 260 files' hashes on every publish, and every app would
re-download the whole New Testament for a one-verse change. The version is in `v2/version.json`, the
manifest's `v2` key and `content.json`; a record's `contentVersion` comes from there.

## The edges, which the vectors carry

Each is a whole chapter in `test/fixtures/api2-vectors.json`, or a hand-written case where the corpus
has none today:

| Edge | What version 2 does | Vector |
|---|---|---|
| A footnote letter at a verse's first word | `at` = the verse's `start` | `john-5` (fn-c, 5:5, which also explains the 5:4 gap) |
| A letter ahead of the first verse marker | `at` 0 | `colossians-4` (fn-a) |
| A `⟦` ahead of a verse number | the mark's `start` = the verse's `start` | `mark-16` (16:9), `john-7` (7:53) |
| A mid-verse `⟧` | the spaces either side collapse to one; the mark ends before it | `john-9` (9:39) |
| A `⟦` running straight into the verse | as above | `john-11` (john-11-p16) |
| A `⟦` mid-paragraph | as above | `luke-22` (22:43) |
| Two marks in a chapter | two entries | `romans-16` |
| A mark that only closes, or only opens | `opens` / `closes` false, running to the edge | `john-8`, `john-7` |
| A quote inside a `vglue` span | nothing special: the quote is text | `john-11` (11:8) |
| A bare `<br>` in a plain paragraph | a space in `text`; a `p` block with two `lines` | `2corinthians-6` (6:2) |
| A verse crossing a block boundary | one verse span; the space between the blocks belongs to neither | `hebrews-2` (2:8–9), and synthetic |
| `hbq` blocks with lines, verse numbers mid-line | `lines` per `hbq-line` | `luke-1` (1:46–55, 1:68–79) |
| An `<em>` run crossing a verse boundary | one run over both verses and the space between | synthetic (none in the corpus) |
| A letter between two spaces | the spaces collapse to one, the letter sits before it | synthetic |
| A verse-number gap | the verse is absent from `verses` | `matthew-17` |
| A draft | `text` "", no ranges, its `figures` | `acts-1` |

## The vectors, and how the apps use them

`npm run build:api2-vectors` writes `test/fixtures/api2-vectors.json` (committed, on demand, like the
anchor vectors):

- **`hashes`**: for every chapter, `hash` and `source`, the SHA-256 of the version 1 chapter file it
  was built from (the same hash the version 1 manifest lists for `chapters/<slug>.json`). An app
  derives the anchor text from its own copy of version 1 through its own implementation, hashes it,
  and compares, for each chapter whose version 1 hash equals `source`. The site's test does the same
  against `api2-core`, skipping chapters edited since the vectors were written.
- **`chapters`**: whole version 2 files for the edges above, each with its version 1 input copied in,
  so they stay valid as the corpus moves on.
- **`synthetic`**: hand-written inputs for edges the corpus doesn't have today.

`test/fixtures/anchor-vectors.json` keeps proving the rule itself; this file proves the served output.

## The change list (not in this step)

Draft 1 proposed `v2.changes`: per chapter changed since the app's previous version, the verses whose
words differ, whether blocks changed, and which footnotes. The review proposed deriving it from the
release-notes pipeline (`scripts/lib/release-notes-core.mjs`) rather than a second diff. **It is left
for a second pull request**, because the release notes don't line up with API versions as they are:

- `release-notes.json` is written per *publish* (a git range on `main`), by a workflow that commits
  after the content lands, and it is itself a synced file, so its own commit moves the content
  `version`. The content publish and its release note therefore arrive in two different versions,
  and nothing records which version an entry belongs to.
- So "changed since `previousVersion`" needs a link the files don't hold today. Three ways to make
  one, for BDR (and BVJ, since the first two touch his pipeline):
  1. **The release-notes workflow records the content version** each entry describes, and the
     exporter folds the entries newer than an app's version into `changes`. No new data, but it
     changes a workflow that is already subtle.
  2. **The build fetches the live `v2/content.json`** (as `fetch:podcast` fetches the feed, never
     failing the build) and diffs verse by verse. Exact, and no committed snapshot, but the build
     depends on the network for this one field.
  3. **No change list.** An app compares each changed chapter's `hash` and re-places only the marks
     in chapters whose hash moved, using `resolveAnchor`'s five answers. This is what the apps do
     until a change list exists, and it may be enough.

Until then an app re-places by chapter hash: a chapter whose `hash` is unchanged needs nothing.

## Serving both

Version 1 is unchanged: `build-api-json.mjs` and `build-api-manifest.mjs` produce `/api/` exactly as
before, and the `v2` key is the only addition to `manifest.json`. Version 2 is `build-api-v2.mjs`,
run by `npm run build` after `build:manifest` and `build:api`, reading the same chapter files. **Version
1 is kept indefinitely** (BDR, 2026-10-22): it is built from the same source in the same run and costs
nothing to serve, and the apps' oldest builds keep their text updates. Revisit only if a change to
version 1's shape is ever wanted, which its freeze forbids anyway.

Both apps bundle a copy of the content in their binaries; their refresh tools gain the version 2
paths when they ingest it.

## What each app then does

**iOS** (DA-B9b, c, d in `LITBible/ROADMAP.md`): ingest version 2 into the same tables, so the reader
doesn't notice at first; the HTML parser becomes a check against `text`; one prepared text per
chapter from `text` plus the ranges; then, measured first on the 13 mini, one text box per chapter.
The records the app already writes (verse, `exact`, `prefix`, `suffix`) place directly against `text`.

**Android**: the address migration first (store verse, `exact`, `prefix`, `suffix` per record, derived
once from the version 1 text on the device, folded into NB7), then a renderer from `text` plus the
ranges. Android needs `verses`, `blocks` with `lines`, `runs`, `footnotes` with `at`, and `marks`; not
`figures`. Version 1 stays needed until both ship. Its anchor text already matches the site's byte
for byte (`AnchorTextTest`, 2026-10-16).

**The website**: nothing. Its pages keep rendering from the chapter JSON; `/desk` already works in
anchor-text coordinates.

## BVJ's part

**Nothing changes in how the text is written.** Version 2 depends only on rules BVJ already follows:
never renumber a verse; retire a merged block's id rather than reuse it; keep figures to drafts (now
checked by the validator). The text is still written in Word, imported to the chapter JSON, and
validated as today.

## Open

1. **BDR, with BVJ:** the change list's source (above), for the second step.
2. **BDR:** the two departures from the brief made while building: no `contentVersion` in chapter
   files, and `content.json` named under `v2.content` rather than in `v2.files`. Both are explained
   above; either can be reversed before the apps ingest.

## Where this came from

The iOS "seams" study of 2026-10-20/21 (`LITBible/ROADMAP.md`, DA-B9): the long-book stutter and the
selection limit were in the reader's text boxes, not the data; what version 2 does is make the
reader change cheap, retire three HTML parsers to one, and give every mark one address on every
platform. Draft 1 by the iOS instance; the review and BDR's decisions in `LIT Handoff/`, 2026-10-22;
draft 2 and the exporter on the website's branch `api-v2`.
