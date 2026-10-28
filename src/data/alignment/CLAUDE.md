# The alignment dataset

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory. It also governs `scripts/alignment-review/`, `scripts/alignment-words/`, `src/data/alignment-words/` and the term lens.
> Cross-references such as "below" or "rule 15" were written when all of
> this was one file, so they may point into another area file; the root's
> index says which file holds each section.

## The Alignment Dataset (`src/data/alignment/`)

A Greek↔English index of the translation: one JSON file per chapter
(`<bookKey>-<chapter>.json`), holding a record for every place a term carrying
a translation commitment appears. It exists because **footnotes answer "what
happened in this verse" and can never answer "what does this translation do
with this word"** — that second question ranges over the whole corpus, and
every footnote (over 5,000 of them) is invisible to both search engines (the verse index strips
`fn-ref`, and chapter pages aren't Pagefind-indexed). These records are that
missing aggregate.

Built in **two phases against one schema** — the format never changes, only
coverage grows. Phase 1 itself has two stages, which the owner and the git
history call **1a** and **1b**:

- **Phase 1 (shipped, and fully reviewed)** — glossary terms only, seeded by
  `build-alignment.mjs` scanning published chapters for each glossary entry's
  `lit` renderings, then reviewed verse by verse against the Greek. `term` is
  populated, `greek` is empty.
  - **1a** is the original 31 terms.
  - **1b** widens the glossary past those 31, one reviewed batch at a time,
    each term getting a glossary entry written from the owner's own published
    footnotes. The batches so far took it to 39 terms (the
    `claude/alignment-phase1b` / `1c` branches, Aug 2026) and then to 47 (#168,
    "Alignment phase 1b: eight new glossary terms", Sept 2026). The owner is
    continuing it with the other terms the footnotes explain and link.
    `GLOSSARY-CANDIDATES.md` is the register of candidates set aside, and
    which terms earn an entry is the owner's editorial call (see the
    `glossary` collection below).
  - **Every lemma-seeded queue verse is decided across all 47 terms**, so all
    47 clear the display gate below. Regenerate the current numbers rather
    than trusting this sentence — new chapters keep arriving, and each one
    reopens its terms, and each 1b batch adds a term to review.
  - Not to be confused with the **Study Desk's** phases 1a/1b/1c
    (`STUDY-DESK.md`), a separate project that reuses the numbering. Say
    "alignment phase 1b" or "desk phase 1b".
- **Phase 2 (in progress, unpublished)** — every SBLGNT token, captured by hand
  as the remaining books are translated, filling `greek` with `{t, form}`
  token positions. Ordinary words (καί, δέ) get `"term": null`. **Not published
  until it's complete across the NT** (owner decision) — partial word-by-word
  coverage would read as a claim the data can't support. Its tool and
  on-disk format are described under "Phase 2 tooling" below.

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
- **A rendering split by another word is ONE record with one `english` piece
  per run of words**: *blasphēmei ton Christon* as "speaks about Christ
  contemptuously", where all but "Christ" renders the verb, is
  `[{text: "speaks about"}, {text: "contemptuously"}]` with `term.form`
  "speaks about … contemptuously". Two records would count two renderings
  where the translation made one. A *second* rendering in the same verse is
  still its own record. In the review tool, Ctrl-click (⌘-click) adds a part to
  the active rendering, and "+ add span" starts another rendering. Each
  piece's `n` is counted against the record's own `term.form`, which is how the
  audit and the term lens recount it, so all three agree. The term lens marks
  each piece, gives the pieces a shared group (`g` in `#term-lens-data`) so
  hovering one lights them all, and heads the card with the whole rendering
  ("speaks about … contemptuously").
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

### Phase 2 tooling (`npm run review:words`)

Phase 2 is **verse-centric**, where the glossary review tool is term-centric:
you walk a chapter verse by verse, click SBLGNT words and LIT words, and press
Link (Enter); every change saves at once. It shares the glossary tool's
discipline (localhost only, exact-path static allowlist, MorphGNT required, no
save step) and none of its UI. **The format is written out in the header of
`scripts/alignment-words/core.mjs`**, which is the authority; the decisions
behind it (reviewed by Opus on 2026-10-12, which added 3, 4, 6 and 8):

1. **A separate directory, `src/data/alignment-words/<book>-<chapter>.json`.**
   Phase 1's files are read by every site page that touches the glossary
   (`/glossary`, the term lens, the audit), and phase 2 is orders of
   magnitude larger (~138,000 SBLGNT words against ~5,000 glossary records).
   Nothing reads the new directory yet, and it is never published until the
   whole NT is done. **Glossary matches are deliberately not in this tool**:
   terms carrying a translation commitment are aligned in the glossary tool,
   and a term is joined in from the lemma at read time.
2. **The same link shape, fewer fields, and a `format` number.** A record is
   `{ref, greek: [{t, form}], english: [{text, n}]}`. `status`, `source`,
   `confidence`, `lemma` and `term` are not written (constant, or
   joined). `form` is the SBLGNT word without punctuation or apparatus
   signs, stored NFC, and doubles as a checksum. The check ignores the
   elision mark and capitals, which differ between MorphGNT and SBL's v1.2
   data without being different words (see "Translation Source Text").
3. **Each file keeps its verses' English as aligned (`basis`).** `n` alone
   cannot survive a revision: insert a second "the" early in a verse and every
   later "the" record resolves to the word before its own, with nothing
   reported (reproduced before the fix; now a regression test). With the
   basis, a changed verse is compared with its old wording word by word: a
   record whose words all survived is **carried** to their new place
   (outlined dotted, written there on the next save, "Accept carried-over
   links"), and only a record touching a changed word goes **stale**. Text is
   normalized as the Study Desk's anchors are (`normalizeAnchorText`).
4. **A link may cross a verse boundary** (owner, 2026-10-12): a Greek word or
   English piece in another verse of the same chapter carries `v`. The
   record belongs to the verse of its first Greek word. "Show the verses
   before and after" puts the neighbours on screen, and the selection
   survives moving between verses. Because of this **the chapter is the unit
   of saving**, not the verse.
5. **Complete is derived, never a flag**: every Greek and English word in the
   verse belongs to a live record and no stale record touches it. A verse with
   **no SBLGNT words** (John 7:53–8:11 in MorphGNT's 2010 text) is outside the
   source and is never complete, since marking its English "no Greek" would
   claim the LIT invented it. Each English word belongs to exactly one link.
6. **Revision is expected, so a stale record is repaired, never silently
   lost.** It is written back marked `"stale": "<reason>"` (english,
   greek, clash, empty, verse) and covers nothing until the reviewer resolves
   it: **Re-link** puts its still-good Greek back in the selection, or
   **Discard**. `npm run audit:words` reports stale records and carried
   links across every chapter; report only, not in CI or the build, same call
   as `audit:alignment`.
7. **It aligns draft chapters too**, since the point is to work as a book is
   translated; the glossary tool skips `indexed: false`.
8. **A save carries the revision it was made against** (a hash of the file),
   and one against a file that moved since is refused with 409, so a second
   tab holding an older copy can't overwrite the first.
9. **The lemma and parsing are shown, never stored.** MorphGNT's codes are
   put in words for display (`describeParse`: "verb, aorist middle
   indicative, 3rd person singular"), the raw code kept beside it.

**`t` is MorphGNT's word numbering, and the word bubble depends on it.**
The Greek tab (STUDY-DESK.md, "Decisions", 2026-10-08) must number words
exactly as MorphGNT does for a link to be followed. The passages it plans to
take from other sources (John 7:53–8:11 from SBL's 2023 data, Romans 16:25–27
from Nestle 1904) have no MorphGNT words, so this tool can't align them yet;
they will need a source label when that work starts.

### Greek verification (MorphGNT)

`build-alignment.mjs` checks each record against a local MorphGNT/SBLGNT
working copy: does the lemma this record claims actually occur in this verse?
**MorphGNT is a tool here, not a dependency**: its lemmatization is CC BY-SA
3.0, so the corpus is gitignored and nothing from it is copied into `src/`.
(The SBLGNT text itself is CC BY 4.0 in SBL's own release since v1.1,
2022-12-19; MorphGNT's README still names the old EULA.) The one place its
data is published is `public/greek/text/`, the Study Desk's Greek tab, which
`npm run build:greek` writes under CC BY-SA 4.0 and keeps apart from
everything else (see "The Study Desk preview", rule 14). Clone it by hand
when you need to re-verify:

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
"the reorienting of minds", "reorienting your mind"; `blasphemia` was glossed
"disrespectfulness" but appears as "speaking with contempt", "speak
disrespectfully", "contemptuous speech", "slander" — and neither term rendered
as its glossed word, which is why both scored 0% coverage. (Blasphemia's
headline was changed to "contemptuous speech" in 2026-09; metanoia's gap
stands.) So an English-first scan can only ever find what it was told to look
for. **Seed future work from the lemma side, where the verse list is complete
by construction, and classify; don't seed from the English side and discover.**

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

It reports **two kinds**, because they want opposite remedies. `Stale` means the
record no longer describes its verse: **delete it rather than marking it
`rejected`** — `isDecided` treats any non-`auto` record as settling the verse,
so rejecting buries it from the queue permanently, while deleting returns it to
be decided. `Casing drift` means it still numbers the right span and only the
casing it preserved has moved: **repair `english[].text` in place**, since
deleting would throw away a human verdict over a capital letter. Same call for a
straight apostrophe that turned curly.

That second kind exists because `computeOccurrenceN` is deliberately
case-**insensitive** while `english[].text` separately preserves the casing as
written, so a drifted record goes on numbering correctly and the staleness check
alone passes it in silence. Decapitalizing three "Triumphant Message" verses in
2026-08 drifted three confirmed records that way and exposed a fourth
(`2Cor.2.12`) that had been drifted for months with nothing reporting it. The
check is one matching position, not all of them — Romans 8:2 renders *nomos* as
"Torah" and "torah" in the same verse on purpose, and demanding every candidate
position match would report that pair as drift.

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

(A term also disappears from `/glossary` when its entry carries `draft: true`,
which is a separate axis — the records are fine, the entry is unpublished. Its
alignment data keeps building either way; see the `glossary` collection below.)

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
exactly the judgment no machine makes. All 47 terms now clear the gate; a term
dropping back out means new `auto` + `common` records arrived with a new
chapter, and a newly added 1b term stays off the page until its queue is
reviewed.

The rule is also why the review tool and this gate had to ship together — a
bulk-rejected record keeps `confidence: "common"` forever, so under the old
"every record is `distinctive`" rule no amount of review could ever release a
term.

**The gate is stated once, in `src/lib/alignment-gate.mjs`** (pure,
unit-tested): `verdict()` per record and `gatedOccurrences()` for the
corpus-wide fold. It has two readers, /glossary's list and the term lens
below, so neither can publish a claim the other doesn't. Any new surface that
shows where a term appears reads it too, rather than restating the table above.

### The term lens (Study View)

Every use of a glossary term in a Study View chapter carries a quiet dotted
underline, and hovering one with a mouse (350 ms) or tapping it opens a card
in the shared panel: the word as printed, "Traditionally *flesh* · Greek
*sarx*", up to four other renderings with their corpus counts, and a link to
the glossary entry. Four owner decisions (2026-09-28): **every use**, not just
the first of each term; **on by default**, with a **Key terms** box in the
Display tray to turn it off; **Study View only**, never Read View, which is
for immersion; and **no tab stops** (below). The pieces are
`src/lib/term-lens.mjs` (pure, unit-tested), `term-lens-data.mjs` (its fs
shell) and `src/scripts/term-lens.js`. Five rules:

1. **It marks only what /glossary would show**: the gated records, minus any
   term whose glossary entry is a draft. A lens that marked more would make a
   claim the glossary page doesn't.
2. **No chapter HTML and no data file changes.** The page carries a small JSON
   block (`#term-lens-data`) giving each mark as "the kth case-insensitive
   occurrence of this text in verse v", and the client finds it by walking the
   verse's text with verse numbers and footnote letters skipped. `k` is worked
   out at build by `locateSpan` from `computeOccurrenceN`, the same count both
   alignment writers use, so the lens and the dataset can't disagree on which
   occurrence a record means. Where the count's substring fallback numbers two
   positions alike (Romans 3:5's "justness", once inside "unjustness"), the one
   standing as a whole word wins. A mark whose text isn't where the build said
   is skipped, never guessed.
3. **Two records claiming the same words keep the first** in reading order;
   the other is skipped rather than nested. A sweep of every published chapter
   in 2026-09 placed 4,326 of 4,328 marks, and both misses were errors in the
   records (1 Corinthians 5:8 and Mark 12:23), fixed in the data rather than
   worked around here. Re-run that kind of sweep after a large review session.
4. **Terms are not controls**: plain spans, with no role and no tab stop. A tab
   stop per term would interrupt scripture mid-sentence, up to 60 times a
   chapter (Romans 7). /glossary carries the same information for keyboard and
   screen-reader readers.
5. **Copy, handouts and the selection bar are unaffected**, since they read
   the text, not the markup; the underline never prints (`print.css`). Plain
   Ctrl+C is the exception that needs help: Chrome and Safari inline each
   element's computed style into the copied HTML, so the underline pasted as
   real formatting. A `copy` listener adds `.is-copying` to the chapter for
   that one task, which drops the underline while the browser serializes;
   the copy itself stays the browser's (decision 4 under "Sharing a
   selection").
