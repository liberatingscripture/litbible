# Chapter JSON and the source text

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory.
> Cross-references such as "below" or "rule 15" were written when all of
> this was one file, so they may point into another area file; the root's
> index says which file holds each section.

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
- **Each footnote object is written on ONE line**, as above — that is the
  canonical serialization, produced by `scripts/lib/chapter-serialize.mjs` and
  emitted by `npm run fix:chapters`. It exists so a footnote edit is a one-line
  diff and a mid-chapter insertion reads as a block of shifted lines rather than
  hundreds of re-indented fragments. **Never write a chapter file with
  `JSON.stringify(data, null, 2)`** — it expands every footnote, so a script
  that parses and re-serializes turns a two-word fix into a thousand-line diff.
  For a small text edit, prefer raw-string replacement on the file text over a
  parse/serialize round-trip. The reconciliation toolchain has its own, stricter
  reason for the same rule (`lib/json-splice.mjs`): the API manifest hashes
  chapter files by raw bytes, so a needless round-trip re-downloads the corpus
  on every app install.
- **Verse numbers** are `<sup id="vN" class="vn">N</sup>`, always wrapped as
  `<span class="vglue"><sup…></sup>&nbsp;<first word>…</span>` so the number
  stays glued to the verse's first word. At render time (website only — raw
  JSON is never modified) both views wrap each verse's content in
  `<span data-verse="N">` so verse boundaries are DOM containers; keep every
  vglue at tag-depth 0 inside its block or that wrapping breaks. Read
  View's spans repeat from chapter to chapter, since a whole book shares the
  page, so each of its blocks also carries `data-chapter`.
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
  is never namespaced in Read View, and makes the changelog blame the next
  verse. The validator rejects it. To let a reader share just part of a verse,
  see below.
- **`topics`** are free-text labels (e.g. `"Nicodemus"`), not pre-slugged.
  `build-topics-index.mjs` normalizes them into slugs and groups chapters that
  share a topic. **Choosing them is an editorial judgment with its own rules —
  see "Choosing topics" below.** They are repo-only (not in the masters), so a
  fresh import writes `topics: []` and they are filled in by hand.
- **`footnotes`** are HTML strings; the verse text references them via
  `<sup class="fn-ref">` anchors (Pagefind excludes these — see `pagefind.yml`).
- **`indexed`** is an explicit two-state publication flag on EVERY chapter:
  `false` marks an in-progress **draft/stub chapter**, `true` a published one
  — never omit it (the release-notes generator emits "chapter added" on the
  explicit false→true transition, and the validator enforces the rules in
  `chapter_json_invariants.json`). 52 of 260 chapters were drafts in 2026-09;
  count them rather than trusting that figure.
  `indexed: false` has seven downstream effects, so handle it carefully:
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
     compact trigger embedded in the Read View toolbar whose label IS the
     live "Book N" readout, in the form Study View's picker uses
     (`read-mode.js` keeps the label and the
     root's `data-current-chapter` updated on scroll, and intercepts
     same-book chapter picks for an in-page scroll; other books navigate to
     `/read/<book>#ch-N`).
  5. The `/read` lede names what isn't finished ("all except Acts
     and Revelation"; it also named Luke 24 until that chapter was
     published on 2026-10-04), built from `scanDraftChapters()` at
     build time: whole books first, then partly drafted books with their
     chapter runs (`unfinishedTexts` in `chapter-nav.mjs`). The /about FAQ's
     "What texts are available right now?" prints the same list. Neither
     needs an edit when a draft lands.
  6. Previous/Next step over it (`src/lib/chapter-nav.mjs`, the one rule
     behind the top buttons, the bottom buttons and a draft page's links),
     and the bottom buttons say what was stepped over ("Luke 24 is still
     being translated." until 2026-10-04). The page itself renders `DraftPage.astro` (the
     photo, the limerick, the book's computed progress, ways onward) **on the
     website only**: the placeholder paragraphs stay in the JSON because the
     apps show them, and their last line ("part of Luke") went stale, which
     is why the website stopped printing it.
  7. Read View (`read/[book].astro`) prints a run of drafts as one stub
     ("Chapters 23–24"), keeping an empty `#ch-N` anchor for every chapter so
     ReadMenu's in-page jumps and saved positions still resolve. Stacked
     anchors must not take the sibling margin (`read-mode.css`).
  **Flip it to `true`** (do not delete the field) when real content lands.

  **Book intros have no flag, so a draft intro is recognised by its
  placeholder sentence** (`DRAFT_INTRO_MARKER` in `draft-chapters.mjs`,
  "This page is still in progress"; acts, luke and revelation in 2026-09),
  and a missing intro file counts as a draft. `scanDraftIntros()` feeds
  effects 2, 3, and 6 above plus Pagefind (the page's `robotsIndex` is
  false, which also switches its indexing off). Adding frontmatter to mark
  them was rejected: the intro files sync to the apps, so the mark itself
  would be a publish. When an intro is written, the sentence goes and
  everything follows.
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
- **A numeric range takes an en dash** — `Matthew 5:3–12`, `verses 9–11`, not
  a hyphen. Settled corpus-wide 2026-08-20 (413 conversions). It is a **repo**
  convention only: the Word masters keep hyphens, because Word does not
  autocorrect a number range the way it autocorrects a dash between words, so
  every restore from a master pulls individual ranges back toward the hyphen.
  Re-run the pass rather than fixing them one at a time. Two things it must not
  touch: anything inside a tag (`id="john-3-p1"`), and a **URL printed as
  visible link text**, where an en dash breaks the link. The validator has no
  rule about it either way.
- **Five further rules are enforced, all added 2026-08-20 after the
  reconciliation** — each one exists because a real defect shipped past every
  check that came before it. `scripts/chapter_json_invariants.json` carries the
  full reasoning; in brief:
  1. **Curly double quotes balance inside each footnote.** A footnote is a
     self-contained editorial object. This one cheap rule found every defect of
     the shared-note cleanup — including five copies of the *hupotasso* note
     whose quotation from TDNT never closed, which no master-vs-repo diff could
     have raised, because the note is stored in nine places and *both* sides
     were fragmented. It counts, it does not pair, so a wrong-direction pair
     (`‘lord”`) still passes.
  2. **Footnote anchors run in `footnotes[]` order, each label once.** Labels
     are positional, so the sequence is their whole meaning. The older
     referential check proves each anchor *resolves*, a different claim
     entirely: `2corinthians-5` shipped fn-f and fn-g transposed with every
     link working and the two notes explaining each other's words.
  3. **A verse marker is preceded by whitespace, or opens its block.** One
     exemption, at the call site: a paragraph opening a bracketed passage.
  4. **No adjacent attribute-less same-tag seam** (`</em><em>`). These render
     correctly, which is why 187 of them hid for six months; the damage is that
     the corpus stops being searchable, and a guard written as
     `/ekdemeo/.test(html)` silently fails open.
  5. **Numeric ranges take an en dash**, outside tags and outside URLs printed
     as visible link text.
- **No `<figure>` in a published chapter, or in a draft with verse text**
  (2026-10-22). Every one is a placeholder draft's art. The content API,
  version 2 serves a chapter's words alone, and the anchor-text rule has no
  clause for a caption, so a figure beside verse text would leak its words
  into the text the apps anchor notes to. The validator rejects it and
  `build-api-v2.mjs` refuses it.
- Always run `npm run validate:chapters` after editing chapter JSON. The
  pre-commit hook validates staged chapter files automatically.

### Poetry blocks (`hbq`)

Quoted Hebrew and Semitic poetry is set as `<blockquote id="<block-id>"
class="hbq">` holding one `<p class="hbq-line">` per line. `addHbqAria` adds
`role="group" aria-label="Poetry"` and points `aria-describedby` at
"Formatted as Hebrew and Semitic poetry with indented parallel lines", so the
markup is a **claim about the text**, not a styling choice, and a screen
reader repeats it. Both views run that pass and both carry the
`#hbq-description` target, so keep them in step: it was Study-only and
class-first-only until 2026-09-06, which left 98 of the 108 rendered blocks
silent (44 of 54 source blockquotes are written `id`-first, and Read View
announced none of them). Attribute order must never decide this. Three further
rules:

1. **`hbq` is for quotation.** Lines the author sets apart that are not quoted
   scripture do not get it. 2 Corinthians 6:2 is the case to reason from: the
   chapter's own fn-b ("Quotation of Isaiah 49:8") is anchored to the *prose*
   sentence, and the two "Look! Now is a welcome time!" lines that follow are
   Paul's own application — so they stay a plain paragraph, and the owner ruled
   in 2026-09 that they should. Check where the "Quotation of X" footnote is
   anchored before reaching for a blockquote.
2. **One block, one quotation.** A block that stops mid-quotation splits it in
   the rendering, and a block holding two quotations merges them. Romans
   3:10–18 is the worked example: it is a catena of six OT quotations, and a
   dropped paragraph break had left the Isaiah 59:7–8 half of it across two
   blocks — p7 opened a quote mark and never closed it, p8 closed one it never
   opened. Merging them made every block exactly one quotation. **The chapter
   validator cannot see this**: its balanced-quote rule covers `footnotes[]`
   only, never `paragraphs`, so quote balance per poetry block is checked by
   hand.
3. **A line follows the sense, not the verse.** Line breaks come from the
   master's own lineation, so a verse number can fall mid-line and a line can
   open lowercase: Luke 1:70–75 reads `God declared 71 liberation…` and
   `That oath provides us 74 rescue…` (owner, 2026-10-05). Before that ruling
   the repo had broken both lines at the verse marker, which split each
   sentence across two lines. Don't "tidy" a mid-line marker back onto its own
   line.

A `<br>` inside a `<p>` is the older way of setting lines and survives only
where the lines are not a quotation (2 Corinthians 6:2 is the one published
case). Copy text still shares it as lines: `blockText` in `chapter-tools.js`
turns each `<br>` into a marker that `cleanForShare` makes a newline, because
`textContent` alone drops a `<br>` with no separator and welded the two lines
into one word until 2026-09. The marker is not `\n` itself, so incidental
source whitespace can never turn into a line break. `isSetAsLines` gives such
a paragraph the same newline boundaries as poetry, and is kept apart from
`isPoetry` because only `hbq` claims the lines are quoted.

**Merging or removing a block retires its id rather than renumbering the
blocks after it** (`matthew-20` runs p1 then p8 from an earlier merge). Block
ids are shareable anchors — see "Sharing part of a verse" above — so
renumbering would silently repoint a link that is already out there, while a
gap costs nothing.


### Choosing topics

**TOPICS.md is the authority; read it before adding or revising a `topics`
array.** The rules are not derivable from the data, and the corpus does not
uniformly follow them.

The three things most often got wrong:

1. **Tags are not a concordance.** Verse search already covers every word the
   translation actually prints, so topics exist to cover what full-text search
   *cannot*: traditional vocabulary LIT does not use ("repentance" for
   "reorienting the mind"), names that appear nowhere in the text ("parable",
   "the Good Samaritan"), and load-bearing themes. A concept is tagged only
   where it is load-bearing — the **significance filter** — never on every
   chapter whose text happens to contain the word.
2. **Alternative-translation pairs are all-or-nothing.** If one side is present
   the other must be: "Son of Man" + "Son of Humanity", "kingdom of God" +
   "reign of God", "salvation" + "liberation". Carrying only the LIT label
   leaves the chapter reachable only by readers who already know the
   translation. TOPICS.md holds the full table and its group rules.
3. **Search matches on exact prefix**, so a tag must begin with the word a
   reader types first. Several tags for one concept at different entry points
   ("the Good Samaritan" *and* "Good Samaritan") are deliberate, not duplicates.

A chapter reaching 30+ tags needs re-review against the significance filter.
There is **no validator rule for topics** — `validate-chapters.mjs` does not
look at them — so the checks in TOPICS.md are run by hand.

**A topic can go stale.** Labels are often drawn from LIT's own wording, so
changing a verse's rendering can orphan one — `luke-12` carried
`"compassion work"` after the text it came from was replaced. Re-check a
chapter's topics whenever its wording changes.

**Book intros carry `topics` too**, in their frontmatter, and they are chosen
by a different test (TOPICS.md, "Book intros"). They reach only Pagefind, as
the intro page's `topics` metadata, and never `topics-index.json`, so they
add nothing unless they add a word the intro's own prose doesn't use: a
collection label ("Pastoral Epistles"), a traditional or scholarly name
("parousia"), or the other half of a translation pair. Until 2026-09 every
intro carried the same five placeholders, which made all of them a search hit
for "hospitality".

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
| John 7:53–8:11 | absent from the 2010 edition; added, in double brackets, in SBL's v1.2 data (2023) | **retained, bracketed**, footnoted (the notes say both, since #297) |
| Mark 16:9–20 | present | printed, **bracketed** |

Mark 16 is in that table specifically to head off a wrong inference: SBLGNT
does *not* drop every famously disputed passage, so "SBL omits it" has to be
checked per passage, never assumed from the passage's reputation.

**Two SBLGNT texts are in play, and they differ in one passage.** The 2010
edition is what MorphGNT is built on, so it is the Greek every tool here reads
(the alignment dataset's lemma check, both review tools). SBL's own data
release, v1.2 (2023-07-10, CC BY 4.0, `LogosBible/SBLGNT` on GitHub), adds
John 7:53–8:11 in double brackets. Compared word by word across the NT on
2026-10-12, the two agree everywhere else: same words, same order, so a
MorphGNT word position names the same word in both. The only other
differences are typographic: the elision mark (’ U+2019 in MorphGNT, ʼ U+02BC
in v1.2, about 1,100 verses) and two capitals (Matthew 27:24, Titus 3:13).
MorphGNT has not added the passage; its last change was 2024-01-21.

**The rule for divergences:** where LIT departs from SBLGNT in either
direction, a chapter footnote says so and names SBLGNT as the source text.
Retaining or omitting non-SBLGNT material *silently* is the thing this policy
exists to prevent.

**Every page that prints the translation ends with the source-text notice**,
`src/components/SblgntNotice.astro`, which credits the SBLGNT under its CC BY
4.0 license: Study View chapters and intros (through `ScriptureLayout`) and
Read View. Read View went without it until 2026-09-27, though it prints
whole books; a new surface that prints scripture needs it too. It is one
sentence with the rest of the credit in a "Source text and license"
disclosure (FIXLIST V5), and the wording lives in
`src/components/SblgntCredits.astro`, which /read's license section renders
too. **The requirement is CC BY 4.0's own**, since SBL asks for nothing
beyond the license (owner, 2026-09-28): name the creators, keep the copyright
notice, link the source text and the license, and say the work was adapted.
The sentence (`part="line"`) does all of that by itself, so it must never
lose a clause to the disclosure; print writes out both link addresses after
it, since a link on paper can't be followed.

### Bracketed passages

Text whose authenticity or placement is contested is wrapped in literal `⟦`
(U+27E6) and `⟧` (U+27E7) markers in the paragraph HTML (not a CSS class —
plain characters in the text) — the same double-bracket notation critical
editions (e.g. NA28) use for text of doubtful authenticity. The convention is
strict and has two halves:

- `⟦` opens the passage, usually at the **start of a paragraph** but not
  always — Luke 22's opens mid-paragraph, after the close of 22:42.
- ` ⟧` closes the passage at the **end of the passage**, immediately followed
  by a footnote marker. That is usually the end of a paragraph, but not
  always — where the contested text stops mid-verse the marker does too
  (`john-9.json`: `Jesus said, ⟧`, closing 9:38–39a).
- **One note per reading surface, at the span's last marker on that surface.**
  A span that opens and closes in one chapter is one surface, so the note hangs
  off the closing marker and **the opening bracket carries nothing**. A span
  crossing a chapter boundary occupies two surfaces — a reader on the second
  chapter never sees the opening bracket — so each chapter carries its own
  copy, and those two **must stay byte-identical and be edited together**.

Until 2026-09 every span carried the note at *both* ends. That rule came from
the one case that needs it (John 7:53–8:11, which spans two pages) and was
then applied to four spans that sit on a single surface, where it bought
nothing and cost a duplicate to keep in sync — a hazard
`check-bracket-twins.mjs` exists because it had already bitten. Restating it as
one-per-surface keeps the duplication exactly where it was earning its keep.
The cost is Mark 16, the only span long enough (12 verses) that a reader can
meet `⟦` and reach the note only at the far end.

Live examples: `mark-16.json` (fn-l), `john-9.json` (fn-q), `john-11.json`
(fn-y), `romans-16.json` (fn-m for verse 24, fn-p for the doxology), and
`luke-22.json` (43–44) — each one note at the close. `john-7.json` ff →
`john-8.json` k is the two-surface exception and the corpus's only remaining
byte-identical pair.

**Not every contested passage is bracketed, and that is not an oversight.**
Luke 23:34a ("Father, let go of this for them…") is printed without
brackets on purpose (owner, 2026-10-03), although its note (`luke-23.json`
fn-u) makes the same "follows the SBLGNT, which includes it" point as Luke
22:43–44's bracketed one. Brackets are an editorial choice per passage, made
in the master, so don't add them because a note discusses the textual
question.

**⟦/⟧ is a repo-only convention, and the Word masters still carry the retired
two-character forms `[|` and `|]`** — the same shape as the en-dash rule, and
it has the same consequence: every route back into the corpus is live. An
approved restore through `scripts/reconcile/`, a fresh `npm run import:chapter`
of a bracketed book (the importer's whole guarantee is that it reproduces the
master verbatim), or a hand-copy out of Word will each carry the old form in.
Two things hold the line, and they are deliberately different in kind:

- `stripBracketMarkers` strips **both** forms. That is what keeps master-derived
  text comparable to repo text in the reconciliation pipeline (the master
  extractor runs through this same helper), and it means an old-form marker
  that does slip in stays invisible to every extractor rather than shipping as
  junk. Do not "tidy" the retired half out of that regex.
- The chapter validator's `old_bracket_markers` rule **rejects** the old form
  outright, so the corpus itself stays single-form. Strip = harmless, validator
  = absent.

Converting the masters is a Word-side back-port, not a repo change; until that
happens, expect the old form on the master side of any reconcile diff.

**None of the site's self-hosted webfonts contain these codepoints** — every
text font here (Inter, Crimson Text, Fraunces, OpenDyslexic, Atkinson
Hyperlegible Next) ships as a Latin-only subset (see the font-import comment at
the top of `global.css`), and U+27E6/U+27E7 sit in Miscellaneous Mathematical
Symbols-A, well outside Latin. Rather than ship a whole symbols font (gated by
`unicode-range` or not), `scripts/build-bracket-marker-font.mjs` subsets just
those two glyphs out of Noto Sans Math (SIL OFL, pulled in as a devDependency
used only by that script) into a ~1.7KB `public/fonts/bracket-markers.otf`.
Three small `@font-face` rules in `global.css` — one each for `"Inter"`,
`"OpenDyslexic"`, and `"Atkinson Hyperlegible Next Variable"`, every family
that can actually render scripture body text — patch that file in under a
`unicode-range: U+27E6-27E7` restriction, registered under the SAME
`font-family` name as the real face, and at the same weight and style:
Atkinson's rule declares its variable range, `200 800`. A browser joins faces
of one family only when those descriptors match exactly, and until 2026-10 the
Atkinson patch had none, so Atkinson readers' brackets drew from a system font
(Cambria Math on Windows). The browser only fetches the patch file
on a page that actually contains one of these two characters (six chapter
pages today), and only ever uses it for these two characters; every other
glyph still comes from the real font. Regenerate the source file with
`npm run build:bracket-font` if the chosen source glyphs ever change — it is
deliberately **not** part of `npm run build`, same as `build:favicons`.

**The markers are reader-facing in rendered HTML but must never reach a
plain-text extractor.** Being literal characters rather than markup, they
survive tag stripping, and an opening `⟦` leads its paragraph *ahead of* that
paragraph's first verse marker — so a naive verse split files it under the
**previous** verse and reports characters for a verse that does not contain
them. `stripBracketMarkers` in **`src/lib/bracket-markers.mjs`** is the single
source; it sits in `src/lib/` (not `scripts/lib/`) because both the build and
the client import it, the same arrangement as `src/lib/word-stem.mjs`. Three
consumers today:

| Consumer | What leaked before |
|----------|--------------------|
| `scripts/lib/verse-text.mjs` | search results ending in a bare `⟦`, and the same misfiling in the alignment dataset |
| `scripts/lib/release-notes-core.mjs` | `added "⟦"` in the apps' Translation Updates |
| `src/scripts/chapter-tools.js` | Copy text / Share… handing a reader `…afraid. ⟦` |

The mobile apps consuming raw chapter HTML from `public/api/` (see "Mobile
apps are first-class consumers" under Key Conventions) have no equivalent
strip of their own today, so the same two characters can still reach a shared
card or a screen reader on those platforms. That is a gap in the apps' own
text-extraction, to be closed by porting this same rule on their side — not a
reason to change what ships here, since the website's own search, changelog,
and Copy/Share paths already strip the markers correctly.

**Always strip before collapsing whitespace** — a closing marker is not always
paragraph-final (John 9:39 reads `Jesus said, ⟧ “I came…`), so the gap it
leaves would otherwise ship as a double space. The changelog copy deliberately
exempts its paragraph-level *fallback* comparison so a bracket-only edit still
produces a row; that exception is at the call site, not in the shared helper.
Any future consumer that flattens paragraphs to text needs the same strip.

Beyond `stripBracketMarkers`'s three consumers, five places independently match
these literal characters and must be kept in step with any future change — note
which of them have to accept the master's old form too:

| Site | Matches |
|------|---------|
| `validate-chapters.mjs` — `verse_marker_separator` exemption | ⟦ only (repo shape), keyed on the bracket alone rather than on what follows it, since an opening ⟦ now usually runs straight into the verse; `john-11-p16` is the one paragraph that depends on it |
| `validate-chapters.mjs` — `old_bracket_markers` | `[\|`/`\|]` only (that is the rule) |
| `lib/release-notes-core.mjs` — opening-bracket fall-forward | both; it reads both sides of a git diff |
| `reconcile/build-ledger.mjs` — `BRACKET_MARKER_RE` | both, so a restore that would swap the form reads as "changes the markers" and is held |
| `reconcile/check-bracket-twins.mjs` — `OPEN`/`CLOSE` | ⟦/⟧ only; it scans the repo, which the validator keeps single-form |

`reconcile/gate-report.mjs` strips both forms for the same reason
`build-ledger.mjs` does — its text comes from a master.

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

Ten published chapters have gaps: Matthew 17:21, 18:11, 23:14; Mark 7:16,
9:44, 9:46, 11:26, 15:28; Luke 17:36, 23:17; John 5:4. Regenerate that list rather
than trusting this sentence — scan every `indexed !== false` chapter for
missing `id="vN"` markers.
