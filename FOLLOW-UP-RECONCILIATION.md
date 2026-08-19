# Follow-up: reconciling the repo with the Word masters

The August 2026 restore brought `src/data/chapters/` back to the author's Word
masters wherever the difference was import damage and nothing but. This file is
what it deliberately did **not** touch, and why.

Read it as a **back-port list for the Word documents**, not as a diff dump. In
most of what follows the repo is the correct side and Word is the stale one.

The evidence behind every number here is regenerable:

```bash
node scripts/reconcile/build-ledger.mjs --master-dir=<unpacked master XML>
```

That writes `scripts/reconcile/out/` (gitignored): `INDEX.md` for the per-book
counts, `books/<book>.md` for each record with its full before/after text, and
`ledger.json` for the machine-readable form. `scripts/reconcile/README.md`
explains where the master XML comes from — the `.docx` files are the author's
own working documents and are never committed.

## What was applied

| | |
|---|---|
| footnotes restored | 749 |
| verses restored | 165, in 131 paragraphs |
| chapter files changed | 153 of 260 |
| alignment records deleted as stale | 9 |
| terms that left `/glossary` | none — all 31 still clear the display gate |

Applied in seven commits, one per subclass, so any single class can be reverted
on its own. Verse restores are separate from footnote restores because only
verse edits can strand an alignment record.

### The hand review that followed (2026-08-16)

All 99 reviewable records in buckets B, C and D were decided in
`npm run review:reconcile` and applied.

| | |
|---|---|
| records decided | 99 — 65 approved, 34 kept as the repo has them |
| chapter files changed | 36 |
| string values changed | 65 |
| alignment records deleted as stale | 1 (`1Thess.3.6`, "triumphant news") |
| terms that left `/glossary` | none — still 31 |

Two of the 65 needed hand treatment, both flagged `forceHandReview` because
their chapter carries a bracketed passage. `john-11` fn-d turned out to be an
ordinary footnote in a chapter that has brackets elsewhere. `romans-16` fn-o did
not: it is half of the doxology pair, and **its twin fn-r was never queued for
review at all** — the master prints that note once, so fn-r has no master
counterpart, lands in bucket D and carries no patch. Applying fn-o alone split
the pair. `scripts/reconcile/check-bracket-twins.mjs` exists because of that,
and now enforces the rule CLAUDE.md states but nothing checked.

### The closing tags those two PRs cost (repaired 2026-08-16)

Both restores dropped a closing block tag from paragraphs whose LAST verse they
rewrote — 28 from the verse restore and 31 more from the hand review, 59 in all
across 43 files. The corpus had none before them.

The last verse in a paragraph owns the string to its end, closing tags included,
and the Word master carries no markup at all, so rebuilding that span wrote
content where `</p>` used to be. Nothing reported it: a browser closes a
dangling `<p>` at the next block element, so the page looks very nearly right.

Repaired by `scripts/reconcile/repair-unclosed-paragraphs.mjs`, which infers the
missing tags from the string's own unclosed openers and then checks that
inference against the pre-damage revision in git — all 59 reproduce the ending
they had. `build-ledger.mjs` no longer produces it and `apply.mjs` now refuses a
write that changes any paragraph's block-tag balance.

## 0. The dash convention — one decision, corpus-wide

Not a defect, and **not something the restore should decide record by record**,
but worth settling once.

Numeric ranges are written inconsistently across the corpus, and always have
been: before any of this work there were 376 hyphen ranges (`19-31`) against 177
en-dash ranges (`19–31`). The masters use a plain hyphen essentially throughout,
because Word does not autocorrect a number range the way it autocorrects a dash
between words. So every restore pulls the corpus toward the hyphen — it now
stands at 420 against 147.

That is the author's own typing winning, which is the right default for a
restore. But if en dashes are wanted in ranges, that is a **single normalization
pass over the whole corpus**, decided once, not a judgment made 567 times inside
a review queue. The validator has no rule about it either way today.

Regenerate the counts rather than trusting these:

```bash
grep -o '[0-9]-[0-9]' src/data/chapters/*.json | wc -l
grep -o '[0-9]–[0-9]' src/data/chapters/*.json | wc -l
```

## 1. August edits — back-port these to Word (58)

40 footnotes, 18 verses. **The repo is right and Word is stale.** These are
edits made on or after 2026-08-01, which the restore was explicitly told to
preserve.

Nothing here is a defect. It is a list of what to type back into the masters so
the two sides stop diverging. Per-record text is in `out/books/<book>.md` under
"Bucket B".

**Plus one that is not in that count.** Luke 19:48 changed on `main` on
2026-08-13, after the masters were captured and after this branch was cut, so
the ledger never saw it: "because all the people hung on his words" became
"because the entire people hung on his words" (PR #117, `5108399`). Back-port it
with the other 58. Anything else that lands on `main` before this PR merges is in
the same position — compare `main` against the capture date rather than assuming
this list is closed.

## 2. April–July work — your call, one at a time (95)

88 footnotes, 7 verses. These differ from the masters and settled between
2026-04 and 2026-07, which puts them in the window where the repo may hold
authored revisions the masters never received.

The *kephale*, *kentron*, *zugos* and *lepton* expansions are in here. A flat
"anything before August is import damage" rule would have reverted all 95
silently; that is exactly why the restore dated each footnote and verse
individually rather than dating the file.

**Doing nothing is safe.** Left alone, the repo keeps its current wording.

1 Corinthians holds 48 of the 95 and Luke holds 36, so two books carry most of
the work.

## 3. Repo-only content — rule on these (10)

9 footnotes, 1 verse that exist in the repo with no counterpart in any master.
Two different things are mixed together here and they want opposite answers:

- **Authorial expansions** the masters never received. Back-port to Word.
- **Import inventions** — words no human wrote on either side, produced when
  the original import elaborated rather than transcribed. These should probably
  go, but deleting published text is your decision, not a cleanup.

Telling them apart needs a reader who knows the intent. Listed under "Bucket D".

**Update, 2026-08-18: 7 of these decided — all back-port to Word.** (The "9
footnotes, 1 verse" above is the same pre-2026-08-16 staleness §2 has — a
fresh ledger rebuild puts the real remaining count at 7, all footnotes, all
in books with a usable master.) None of the seven read as import inventions —
each carries specific, checkable content (a real Dutch Bible-translation
tradition, an exact Greek grammatical-case distinction, correctly-cited
scripture translations) that an elaborating import has no mechanism to
produce. This is the Word back-port list — type each into its footnote at the
matching verse:

- **`1corinthians-3-fn-f`** — "The verse gloss indicates the Lord is the one
  trusted; the assignment is the Lord's, and the servants are the means."
- **`1corinthians-15-fn-t`** — "In English, translations have traditionally
  simply taken the Greek word and put it in English letters: baptizo to
  'baptize.' The historical reason for this was that the first translators of
  the Bible into English practiced infant baptism, and the Greek word
  literally means 'dip' or 'immerse something in a liquid,' it didn't fit
  with their doctrine and practice. Other languages translate it fully, so in
  Dutch, for example, John is known as 'John the Dipper.' In addition to the
  literal action of dipping or immersing in the water, this is clearly a
  reference to ceremonial cleansing, preparing people for a sacred calling."
- **`1corinthians-15-fn-cc`** — "Traditionally, 'Spiritual.' The Greek word
  pneumatikon could be used to refer to something connected with or
  pertaining to 'wind,' 'breath,' or an animating energy within people,
  thought to be perceptible in the breath. Hebrew and Latin also use the same
  word for all these concepts. In scripture, it typically calls back the
  image to Genesis 1 and 2: "the Spirit of God was hovering over the surface
  of the waters" (Genesis 1:2 NASB) and "the Lord God formed the human from
  the topsoil of the fertile land and blew life's breath into [its]
  nostrils. The human came to life." (Genesis 2:7 CEB)."
- **`james-2-fn-a`** — "The Greek would most likely be 'faithfulness of' (or
  possibly 'trust of') here rather than the traditional 'faith in.' The
  construction is different than that places that could possibly be
  translated with the English 'in' which usually include the Greek
  preposition eis or at least the object of trust being in the dative case
  form. This example has neither, instead being in the genitive case form,
  most likely indicating a possession or quality of Christ."
- **`john-2-fn-x`** — "Literally, 'trusted in his name.' The idea is that
  they trusted him enough to commit their allegiance to him." **Settled
  2026-08-19: nothing to back-port.** This one had a different provenance
  from the other six — it was in the master, absent at the 2026-08-16 and
  2026-08-18 captures, and back verbatim at the 2026-08-19 one, which is why
  §15 recorded it as deleted and now corrects that. The two sides agree; the
  record only ever existed because a live working document was caught
  mid-edit.
- **`john-13-fn-z`** — "It is not completely clear whether 'him' refers to
  God or to the Son of Humanity."
- **`matthew-11-fn-n`** — "The Greek word for 'yoke' is zugos, the wooden
  beam that joined a pair of working animals or that a laborer wore across
  the shoulders to carry a load. It may be an allusion to the book of
  Sirach, where Wisdom calls those who lack instruction to draw near to her
  and put their necks under her yoke (Sirach 51:23-27). The same three
  elements that appear here appear together there: an invitation to come, a
  yoke, and the promise of rest (anapausis, the same word translated 'rest'
  in v. 28). Sirach 6:24-30 develops the picture, where the yoke and fetters
  of Wisdom that at first feel like a heavy burden become, in the end, rest,
  a robe of honor, and a golden ornament. In this tradition the yoke stands
  for a way of carrying instruction, not for forced labor."

## 4. Quote-style and whitespace differences (409)

Cases where the two sides say the same words with different punctuation
characters — straight vs curly quotes, spacing. Preserved as-is: the repo's
curly-quote convention is enforced by `validate-chapters.mjs` and the masters
mix both, so matching Word here would fail the build.

**This class regenerates on every future import.** The durable fix belongs in
whatever converts a `.docx` into chapter JSON, not in another cleanup pass.

## 5. Bucket A — reviewed 2026-08-16, 42 applied

**Status: the 68 reviewable records were decided by hand — 58 approved, 10
rejected.** 42 of the approvals applied cleanly. The other 16 carry a
`forceHandReview` hold, which `apply.mjs` will only write when each is named
explicitly with `--ids=`; they are listed at the end of this section.

The 10 rejected records kept the repo's own text: `matthew-2-v5`,
`matthew-2-fn-g`, `matthew-11-v6`, `matthew-15-fn-v`, `mark-11-fn-h`,
`john-7-fn-a`, `john-7-fn-v`, `john-11-v20`, `john-11-v24`, `1peter-2-fn-z` —
several of them the master-side defects in §12, caught in review exactly as
that section predicted. (`john-11-v20`/`-v24`'s rejections were correct
against the master as it read that day — the master has since changed
further and both were revisited and applied; see §15.)

The background below is kept because it explains what the records are.

These are import-era differences that could not be repaired mechanically. Until
2026-08-16 all 126 of them were **held**, and 108 of those could not even be
opened in the review tool: `curlify()` refuses master text whose quotation does
not balance, and a refused record carried no `newValue`, so there was nothing
for the tool to diff.

That is fixed. `lib/quote-compose.mjs` composes a restore instead of converting
one — quote characters and markup stay the repo's, words come from the master —
so **bucket A went from 18 reviewable records to 72**:

```bash
npm run review:reconcile -- --buckets=A
```

**They are decisions, not writes.** Applying the 53 clear ones in a single pass
was tried and thrown away, because six of them imported a defect straight out of
Word:

| record | what it would have published |
|---|---|
| `matthew-11:6` | "Anyone who isn't tripped up by me **is has** reason for gratitude" |
| `matthew-2` fn-g | "the untrustworthiness of those **group**" |
| `john-7` fn-a, `romans-1` fn-bb | each loses a sentence-final period |
| `mark-11` fn-h | "'divine'**and** referred" — and this one was missed by the scan that found the others |

Six is a floor, not a count. The scan is a handful of regexes and several
under-report; the real number is unknown. Which fits the only evidence there is
about how this set behaves under a person: the hand review above decided 99
comparable records and **kept the repo's own text in 34 of them**.

### Records approved in review but held by `apply.mjs` — 7 remain

The review tool shows held records with their hold reason and lets them be
answered; `apply.mjs` will not write one unless it is named. 16 were approved
on 2026-08-16; **9 have since been applied** (2026-08-18): the four John 8
versification records — which also needed a hand-authored follow-up, see §14 —
both 1 Corinthians 14 hyperlink footnotes, Matthew 28's multi-paragraph
footnote, and `john-11-v19`/`v21`. The John 11 pair was not applied from the
approvals on file — those had gone stale twice over (§15) — but hand-composed
fresh against the master's current reading, brackets retained per the owner's
explicit instruction that they publish. **7 remain, not applied:**

| records | hold |
|---|---|
| `matthew-18-v22`, `matthew-20-v13`, `mark-5-v28`, `john-12-v31`, `romans-3-v4` | cross-verse quotation boundary (§9) |
| ~~`john-2-fn-w`~~ | was: truncated in the master, broken on both sides. **Settled 2026-08-19** — the owner deleted the note from the master, so the repo's placeholder was deleted too and the record no longer exists (§17) |
| `john-7-fn-q` | would have imported `in in Torah` — **that typo is now fixed in the master, see §12 and §15** |

Five of the original 16 — the five cross-verse ones — were **seeded
automatically** when the tool started, because every hunk in them defaulted;
they were not necessarily looked at.

### The 43 that stay held

| reason | count | why it stops |
|---|---|---|
| cross-verse quotation boundary | 16 | the two sides differ in nothing but quote characters, and the quotation's other end sits in a different verse — section 9 |
| footnote-reference count differs | 14 | the two sides disagree on how many notes the verse carries, so restoring would add or drop an anchor |
| would introduce a wrong-direction quote pair | 5 | the master's wording is wanted but arrives with `‘lord”`; taking it imports the defect section 10 exists to fix |
| hyperlink in the footnote | 3 | structure the master extractor cannot produce |
| doubled word / truncated master / mis-wrapped verse / blockquote continuation / multi-paragraph note | 5 | one each |

(Two more reasons held this pool higher as of 2026-08-16 and are gone now:
"verse-boundary disagreement" — John 8:19–20 and 25–26, 4 records, applied
2026-08-18, see below — and "square brackets into scripture" — John 11's
`[Martha and]`/`[Martha]`, 4 records, applied 2026-08-18, see §15. 51 → 47 →
43.)

The 14 anchor-count cases are worth a look regardless of the restore:
`1corinthians-3:5`, `2corinthians-4:4`, `2peter-1:1`, `2peter-1:9`,
`hebrews-10:5`, `james-2:1`, `james-2:13`, `john-8:39`, `john-8:40`, `luke-3:4`,
`luke-7:22`, `mark-6:50`, `matthew-6:2`, `matthew-8:9`, `matthew-11:8`.

### John 8:19–20 and 25–26 — a versification difference

The master ends verse 19 one sentence later than the repo does, and the same at
25. Both sides carry the same words and disagree about where the verse breaks.
Restoring would have moved a sentence between two verses and silently
invalidated every `#v19` deep link, alignment record and search result for the
pair.

This is the one finding in the whole reconciliation where the two sides disagree
about the **shape** of the text rather than its wording, and it is unsurprising
where it turned up: John 8 is where LIT keeps the pericope adulterae that SBLGNT
omits, so the two sides are numbering around a passage they disagree about
carrying at all.

**Update, 2026-08-18: applied.** All four records were approved and applied —
see §5. The restore itself went cleanly, but composing each verse's new span
from master text (which carries no paragraph markup of its own) also relocated
the paragraph break inside it. See §14 for what that broke and how it was
fixed.

## 9. Cross-verse quotation boundaries — 16 verses, all settled 2026-08-19

**Resolved.** All sixteen were ruled on by the owner; see the disposition table
below. The section is kept for the reasoning, which recurs.

These differ from the master in **nothing but quote characters**, and the
quotation's other end sits in a different verse. They run both ways, so no rule
settles them:

- **John 12:31–32** — Word quotes the speech; the repo does not mark it at all.
- **Matthew 9:22** — the repo closes the quotation at `restored you.”`; Word
  leaves it open.
- **Luke 1:55, 68, 79** — the Magnificat and Benedictus, where Word closes a
  song the repo leaves running.

Each needs one decision about where the quotation opens and closes. The full
list with both texts is written to `out/cross-verse-quote-boundaries.md`.

**16 is confirmed against a fresh ledger (2026-08-18).** It briefly read 18:
`hebrews-2-v8` and `hebrews-8-v8` were landing here, but they were not
quotation-boundary questions at all — they were the duplicated-continuation
defect, now repaired (§16). Unlike the counts elsewhere in this file, this one
was never stale.

### The convention that decided most of them

LIT uses the **running multi-paragraph quotation**: inside a continuing speech
every paragraph re-opens with `“` and only the last one closes. Matthew 5 shows
it cleanly — ten consecutive paragraphs (vv11, 13, 14, 17, 21, 27, 31, 33, 38,
43) each open and none closes. So a *closer* belongs only where the speech
actually ends, and a paragraph-initial *opener* is required wherever one
continues. That plus "does narration resume here" settles every record.

### Disposition (owner, 2026-08-19)

Nine needed no repo change — the master was edited to match what the repo
already had — and each is confirmed identical against masters re-downloaded
2026-08-19.

| verse | outcome |
|---|---|
| Matthew 9:22 | master fixed; repo already right (narration resumes inside the verse) |
| Mark 5:28 | master fixed; repo already right (v29 resumes narration) |
| John 9:41 | master fixed; repo already right (chapter ends, and John 10:1 opens its own quote) |
| Romans 3:4 | master fixed; repo already right (v5 resumes Paul's argument) |
| Luke 1:55, 68, 79 | marks removed in the master; repo already unmarked |
| Luke 3:4, 3:6 | outer citation marks removed in the master |
| Matthew 5:13 | repo dropped its closer — the only one in a run of ten paragraphs that all open and never close |
| Matthew 18:22 | repo dropped its closer — v23 is in the *same paragraph* and continues the speech |
| Mark 7:8 | repo gained the closer — v9 opens a fresh speech |
| Luke 1:46 | repo took the master's comma→colon and dropped the opener |
| Luke 3:4, 3:6 (inner) | the inner quote is promoted to primary now the outer level is gone, and closed at v6 |
| John 12:31, 12:32 | repo gained the pair — v30's quote had already closed, v33 is the narrator's aside |
| Matthew 20:1–16 | reformatted to one paragraph, mirroring the master — see below |

**Matthew 20 was a formatting decision, not a punctuation one.** The owner
reformatted the parable into a single paragraph in Word and updated its marks
to suit, so the marks only cohere in that form: no intermediate re-openers, one
`“` at v1 and one `”` at v16. Mirroring it here collapsed seven blocks into
one, which merges v7's two speech turns into running prose and retires
`matthew-20-p2` … `-p7` as share anchors. The later blocks deliberately keep
their ids, so the file runs `p1`, `p8`, `p9` — a cosmetic numbering gap is far
cheaper than renumbering and breaking every remaining anchor in the chapter.

That merge is the one edit here `verify-bytes` cannot check. It shrinks the
`paragraphs` array, so `spliceValue` cannot express it and the tool's
"paragraph count identical" fingerprint fails by design — that assertion is
right for a *restore*, and a deliberate structural edit is outside its remit.
Its third finding, "formatting changed outside string values", is an artifact
of span alignment failing across an array shrink, not a reserialize: the file
is byte-identical outside a single 1646→1432 byte region (2299 bytes of common
prefix, 12061 of common suffix, same indentation, same trailing newline). The
merge script asserts instead that all 34 verse-marker tags and all 24 footnote
anchors survive in order, that footnotes and every other top-level key are
untouched, that every later paragraph is byte-identical, and that the result
opens and closes exactly one `<p>`.

## 10. Word back-port: footnotes whose quotation does not balance (22)

A footnote is a self-contained string, so its quotation has to balance inside
it. In 22 of them the master's does not and the repo's does — usually a
wrong-direction pair (`“triumphant message’` for `“triumphant message”` in
`1corinthians-9` fn-i, `1corinthians-15` fn-b, `mark-13` fn-i and `mark-16`
fn-h, all four the same shared note), sometimes a missing closer
(`‘right hand of the Majesty)` in `hebrews-1` fn-e). One is not a quote at all:
`matthew-2` fn-d reads `its saying` in Word where the repo has `it’s saying`.

**Nothing to restore here** — the repo is already right, and the composer
settles these without a patch. The full list is written to
`out/word-backport-quotes.md`.

## 11. Word back-port: multi-paragraph footnotes (4)

Found by `node scripts/reconcile/check-master-hygiene.mjs`, which scans the
masters for defects a diff cannot see. Only one of these ever surfaced as a
difference; the other three sit in notes whose text matches the repo, so nothing
would have mentioned them.

| master | repo footnote | fix |
|---|---|---|
| 1 Corinthians `w:id=295` (2 blocks) | `1corinthians-10` fn-gg | join — the repo carries it as one run of prose |
| John `w:id=352` (2 blocks; was `353` at the 2026-08-16 capture — see §15) | `john-12` fn-a | join |
| Matthew `w:id=794` (2 blocks) | `matthew-28` fn-j | join |
| 1 Corinthians `w:id=300` (3 blocks) | `1corinthians-11` fn-b | **not a mistake** — this is the chiasm, and its lines are real. Word wants `<w:br/>` line breaks rather than paragraph breaks so it stays one footnote. The repo already renders it as `<div class="chiasm">`, so no repo change either way. |

Replace the paragraph break with a line break (Shift+Enter) in Word.

## 12. Master-side defects found while composing restores

Each is a real error in Word that a restore would otherwise import:

- **`john-7` fn-q** read `the path laid out in in Torah`. **Fixed in the
  master 2026-08-18** — now reads `laid out in Torah`; the record is still
  bucket A, but only a `Dikaios`/`dikaios` capitalization difference remains
  (see §15).
- **`john-2` fn-w** was cut off at `This is ‘they trusted the sc`, and the
  repo carried the import's own placeholder in its place (`This footnote text
  appears truncated in the source… Verify and complete it before publishing`)
  — a note addressed to the author, published on the site since February.
  **Resolved 2026-08-19: the owner deleted the note from the master**, so it
  is deleted here too. See §17.
- **A defect present on BOTH sides is invisible to every diff in this
  toolchain.** That is the blind spot `check-master-hygiene.mjs` exists for,
  and two footnotes had been sitting in it: `john-2` fn-m (`The Greek word
  ekcheo,`) and `matthew-5` fn-ff (`…it held authority over community
  matters,`) are truncated identically in Word and in the repo, so they
  matched perfectly, never surfaced as a difference, and never entered a
  bucket. Neither was found by comparing the two sides — they came out of
  scanning the repo's *own* published footnotes for a note that ends
  mid-sentence. That scan covered every `indexed` chapter and found no
  others; the ~20 other candidates it surfaced are legitimate short glosses
  ("Future tense", "From Colossae"), which is why the shape to look for is a
  trailing comma or colon rather than merely a missing period. The owner
  deleted the first and trimmed the second in Word on 2026-08-19; both are
  applied here (§17).
- **`john-11`** — not a defect. The master brackets `[Martha and]` (v19) and
  `[Martha]` (vv20, 21, 24, 39) through the passage where Martha and Miriam
  meet Jesus outside Bethany, correcting a genuine attribution error the repo
  had carried since the import: vv19–24 named Miriam throughout, but v28
  already had her "call her sister Miriam" (a self-reference, unreachable
  unless the v19–27 speaker is someone else) and v30 already presupposed "the
  place where **Martha** met with him" — both readings only make sense once
  Martha, not Miriam, is the one who goes out to meet Jesus first. **The
  owner confirmed 2026-08-18 that this revision is complete and that the
  brackets are meant to publish**, not stripped — matching the corpus's
  existing `colossians-2-p3`/fn-j convention for a supplied clarifying phrase
  set directly in body text. Applied; see §15.
- **`matthew-11:6`** read `is has reason for gratitude`. **Fixed in the
  master 2026-08-18** — the record has fully settled.
- **`matthew-2` fn-g** read `the untrustworthiness of those group`. **Fixed in
  the master 2026-08-18** — now reads `those groups`; a quote-style difference
  remains (see §15).

## 13. Poetry line breaks flattened by earlier restores — 14 places, all repaired

**Resolved — this section's "needs you" is stale.** All 14 are back on `main`:
Luke 1's 4 (the Benedictus), Luke 6's 3 (the woes) and Romans 9's one `<br>` in
`9c26ade` ("Re-break the poetry three restores flattened"), and Matthew 13's 6
in `30c558a`. Verified by counting `<p class="hbq-line">` in all four files
against `2cf906a~1`, the last pre-restore revision: every count matches, and
Matthew 13's traces cleanly 9 → 3 at `4a3cdca` → 9 again at `30c558a`.

The section is kept because the failure mode recurs and the repair is not
mechanical — `9c26ade`'s own message records the judgment calls it needed
(Luke 6's woes deliberately did *not* get their quotation marks back, and Luke
1's line-initial capitals did). What is no longer true is that anything here is
waiting on a decision.

A restore rebuilds a verse's span from master text, and the master has no
markup. Where the repo set a verse as poetry, the `<p class="hbq-line">` breaks
inside that span were rebuilt away and the lines ran together as prose. Nothing
caught it: block balance is unchanged, because the opener and its closer were
removed as a pair.

Counted against the last revision before the restores (`2cf906a~1`):

| file | lost |
|---|---|
| `matthew-13` | 6 line breaks |
| `luke-1` | 4 (the Benedictus) |
| `luke-6` | 3 (the woes) |
| `romans-9` | 1 `<br>` |

**Not mechanical**, which is why it took its own pass rather than riding along
with a restore. Luke 6:24 shows why — the same restore that flattened its two
lines also dropped the opening quotation mark:

```
before  <p class="hbq-line">…“However,</span> there are dire warnings for those who are wealthy</p>
        <p class="hbq-line">because you have already received your comfort.</p>
after   …However,</span> there are dire warnings for those who are wealthy because you have
        already received your comfort.
```

Re-inserting the breaks meant deciding where they fall in wording that had since
changed, and whether the `“` comes back — both editorial. The pre-restore text
is in git at `2cf906a~1` for every one of the 14, which is where the repair took
its break positions from while leaving today's wording alone.

`build-ledger.mjs` still produces this. Guarding it means holding interior block
markup back the way `splitTrailingBlockClose` and `splitTrailingSeparator` hold
back the ends of a span, which is a larger change than either.

## 6. Master-only footnotes — reviewed 2026-08-19, 6 still open

`build-ledger.mjs` writes this list to `out/deferred-master-only.json` on
every run; rebuild it rather than trusting the counts below. The 19 records
were reviewed on 2026-08-19 and are **not one kind of thing**, which is the
reason they sat undifferentiated for so long: "present in the master, absent
from the repo" describes a Word placeholder, a deliberate repetition, and a
genuine gap identically.

The list stands at **18** after this round (Romans 8:15 was applied, §17) and
will read **17** once Luke's master is re-captured — the owner deleted the
Luke 2:13 repetition in Word on 2026-08-19, later than the Luke copy the
current snapshot holds.

- **11 are empty in the master** — a footnote reference plus a single space,
  two runs, no drawing, field or hyperlink (checked against the raw
  `footnotes.xml`, not just through the extractor, since an extractor
  returning nothing is exactly what a dropped hyperlink would also look
  like). The owner confirmed these are **placeholders for footnotes not yet
  written**, so there is nothing to import and no repo action: 1 Cor 6:17,
  2 Peter 1:1 (×2), 2 Peter 1:9 (×2), Galatians 3:20, Luke 7:22,
  Matthew 3:3, Matthew 4:6 (×2), Matthew 8:9.
- **2 were a standing note repeated at a second anchor in the same chapter.**
  The repo carries such notes once per chapter; the master had two.
  **Luke 2:13** (the *angelos* note — the master had it at 1:11, 2:9, 2:13,
  12:8 and 20:36, the repo at every one of those but the second in Luke 2)
  was **deleted in the master 2026-08-19**, so nothing moves here.
  **Romans 8:15 is the deliberate exception and was added** (§17): the
  owner's ruling is that it and the v14 note gloss two *different English
  words* — "heirs" and "children" — rendering the same Greek, so the
  repetition is the point. Note the two are not the same text: the repo's
  v14 note carries a closing sentence the v15 one does not.
- **6 are genuinely absent content, and are the ones still open.** Four are
  footnote-only adds, where the repo's verse already carries the anchor word:

  | record | note | anchor | cost |
  |---|---|---|---|
  | 1 Cor 1:2 | `Traditionally, ‘the holy ones’ or ‘the saints’` | "dedicated for sacred purposes" | new fn-f, 47 later labels shift |
  | Galatians 1:15 | `Not ‘birth’ as some others translate it.` | "from my mother's womb" | new fn-n, 12 shift |
  | Luke 11:32 | the *metanoia* note | "they reoriented their minds" | new fn-y, 11 shift |
  | Mark 13:2 | `Compare this to Jeremiah 26:1-9.` | end of v2 | new fn-b, 26 shift |

  Luke 11:32 is the cleanest of the four and the clearest gap: the master
  carries that note at 3:3, 5:32, 10:13, 11:32, 13:3, 15:7, 16:30 and 17:3,
  and the repo has every one of those chapters except Luke 11 — the only one
  with no copy at all, so it is a real loss rather than a repetition. Its
  text needs no writing either: `luke-13` fn-b is the identical note already
  in the repo's curly-quote convention, so it is a verbatim copy rather than
  an import of the master's mixed-quote version.

  The other two are **not** footnote adds and must not be handled as such —
  each glosses a word the repo's verse does not contain, because the verse
  itself is an unresolved bucket A record:

  | record | master verse | repo verse |
  |---|---|---|
  | `matthew-6-v2` | "when you give your compassionate donations," | "when you do your compassion work," |
  | `matthew-11-v8` | "Someone dressed in soft clothing?" | "Someone finely dressed?" |

  Adding either note on its own would anchor it to text that isn't there.
  They belong in the bucket A queue
  (`npm run review:reconcile -- --buckets=A`), with the verse.
- **Verse-boundary shifts and master-has-extra-content verses**, including two
  substantive ones: `3john-1:10` and `1corinthians-15:43`. Still open.

## 7. Books with no usable master

- **Revelation** has no master document at all.
- **Acts**'s master holds only 1:1–4.
- **Luke**'s master stops mid-21:38.

Every affected chapter is currently `indexed: false`, so nothing published
depends on them — but a master must exist before any of those chapters can be
reconciled or published.

## 8. Corrections to the original audit

Recorded so nobody re-derives them from scratch:

- **`REPORT.md` truncates at 500 characters**, 573 times. It cannot be used as
  a restoration source. `results.json` holds untruncated text but strips all
  markup, so it cannot either — every `<em>` would be lost.
- **Severity was truncated to 600 characters** before scoring, which reported
  `0.000` for 470 real findings.
- **"Repo has extra content" was a mislabel.** The audit classified by substring
  containment, so `Or 'man'.` read as "extra content" against `Or 'man'`. 227 of
  the 232 were the added trailing period — the defect, not an addition.
- **`<w:noBreakHyphen/>` was dropped silently** by the original extractor, which
  is why master text read `GrecoRoman` and `14:3435`. The repo's own import lost
  the same hyphens (`self protection`, `24:14 15`), so fixing the master side
  did not remove those findings — it corrected them.
- **Verse numbers in the masters are superscript runs**, not bare digits — but
  not always. Eight chapters type one as ordinary body text and Mark 5:39 is a
  *subscript*. Any tooling that trusts `<w:vertAlign>` alone will walk past them.
- **A footnote reference is zero-width in the master.** Rebuilding a verse from
  master text without re-inserting the repo's anchors deletes them, and
  `validate-chapters.mjs` does not catch it: it checks that every anchor has a
  footnote, never that every footnote has an anchor. That check is worth adding
  to the validator on its own merits.

## 14. John 8:19–20 and 25–27 — paragraph structure lost by the versification restore (repaired 2026-08-18)

Applying the four approved John 8 versification records (§5) moved a sentence
across the verse boundary as intended, but composing each verse's new span
from master text — which carries no paragraph markup of its own — also
relocated the paragraph break inside it, landing the break at the new verse
boundary instead of where it belonged:

- **19–20**: Jesus's reply (`You don't recognize either me or my Father…`)
  was pulled into the same paragraph as `they said to him, "Where is your
  father?"`; the break belongs immediately before that reply, not at the
  v19/v20 boundary.
- **25–27**: same shape — `"Who are you?" they said` stayed alone in its own
  paragraph, and the break needed to move back to before Jesus's answer.

Caught by reading the rendered page after PR #130/#131 shipped, not by any
automated check. Fixed by a direct byte-level splice (not through
`apply.mjs` — this wasn't a `decisions.json` record) that moves the same text
`apply.mjs` had already relocated, just to the other side of the paragraph
tag, verified against the flattened (tag-stripped) text before and after to
confirm no wording moved. Shipped in PR #133.

Same root cause as §13 — a restore rebuilds a span from master text that
carries no internal markup — but a different casualty (dialogue-paragraph
attribution, not poetry lines), and mechanical enough to repair on sight
rather than needing an editorial call. `build-ledger.mjs` does not guard
against this class of defect any more than it does §13's; both need a human
reading the rendered page after a paragraph-crossing restore, not just the
validator.

## 15. 2026-08-18 master re-check

Re-copied the live masters for the books whose mtime had moved since the last
capture — Matthew, John, Luke, Mark (1 Corinthians was already re-verified
during the `1corinthians-14-fn-ee` work above) — and rebuilt the ledger
against the combined snapshot. A `.docx` carries no "last checked" marker on
this side, so the only reliable way to find what moved is comparing each live
file's mtime against the snapshot's own copy time, then re-extracting and
re-diffing both the footnote sequence (aligned by content, since a mid-document
footnote insertion or deletion renumbers every later `w:id` and makes a
raw-id diff report a false cascade of "changes") and the verse text (anchored
by the verse's own visible number, which a footnote renumbering doesn't
touch). The numbers in every section above already reflect this recheck.

**Confirmed fixed in the master since 2026-08-16:**

| record | was | now |
|---|---|---|
| `matthew-2-fn-g` | "those group" (§12) | "those groups" — wording fixed; a quote-style difference remains (master `["the ash heap"]`, repo `['the ash heap']`) |
| `matthew-11-v6` | "is has reason for gratitude" (§12) | "has reason for gratitude" — fully settled |
| `mark-11-fn-h` | "'divine'and referred" | "'divine' and referred" — fully settled |
| `john-7-fn-a` | lost its sentence-final period | period restored — fully settled |
| `john-7-fn-q` | "laid out in in Torah" (§12) | "laid out in Torah" — wording fixed; one capitalization difference remains (`Dikaios`/`dikaios`) |
| `john-7-fn-v` | rejected in review (kept the repo's text) | now matches the repo exactly — fully settled |
| `matthew-13-v15` | missing "And hearing is difficult for their ears," | clause present — fully settled |
| `john-5-fn-o` | wording difference | fully settled |

Several incidental copy-edits also landed and already agree with the repo, so
nothing to back-port: a comma after "saying" in Matthew 1:20, a comma after
"Judea" in Matthew 2:5, and "Christ" lowercased to "christ" in John 1:41 (the
repo already had the lowercase form).

**New since 2026-08-16, not yet in any list above:**

- **John 11:19–24 was under active revision as of the capture above — resolved
  later the same day.** The master brackets `[Martha and]` / `[Martha]`
  through this passage (was `[Miriam]` / plain `Miriam` at the 2026-08-16
  capture; §12's `john-11` bullet has the current text). The two `approved`
  decisions on file for `john-11-v19` and `john-11-v21` (§5) were composed
  against the earlier master reading and were stale twice over — the
  bracketed name had changed again since, and both recorded `resolvedValue`s
  were separately missing the verse-separator space the corpus later
  standardized on (CLAUDE.md, Word masters §6) — so neither was applied as
  filed. `john-11-v20` and `-v24` had been correctly rejected against the
  pre-bracket reading (kept the repo's plain text), which made *them* stale
  in the other direction once the master gained real content there.
  `john-11-v39` was a new hold picked up by the same edit: the master now
  brackets an already-unambiguous `Martha` there too (`Martha, the sister of
  the deceased` → `[Martha], the sister of the deceased`).

  **Update, 2026-08-18: applied.** The owner confirmed the same day that the
  revision is complete and that the brackets are meant to publish — not
  stripped, which was the working assumption in progress at that point,
  reading too much into CLAUDE.md's "editorial mark" framing of the
  pre-revision bracket (fixed there too, before it misled anyone else). The
  internal evidence agrees: v28's "she...
  called her sister Miriam" only parses if the v19–27 speaker is Martha, and
  v30's "the place where Martha met with him" already assumed it. The
  precedent for publishing a bracketed supplied phrase directly in verse text
  already exists (`colossians-2-p3`, "You `[the Body of Christ]`", paired
  with fn-j) — no CSS class, just literal characters. All five records
  (`v19`, `v20`, `v21`, `v24`, `v39`) were hand-composed against the current
  master text — brackets retained, verse-separator spacing intact — rather
  than trusting any of the four stale decisions on file, and applied
  directly via `spliceValue`, the same mechanism §14 used.
  `validate-chapters`, `verify-bytes`, `audit:alignment`, and the full test
  suite all pass against the result.
- **`john-2-fn-x` was briefly repo-only, and is not any more — corrected
  2026-08-19.** At the 2026-08-18 capture the master's "Literally, 'trusted
  in his name.'…" footnote (John 2:23) was absent and this bullet recorded it
  as deleted. At the 2026-08-19 capture it is back, verbatim: John's master
  went from 612 footnotes to 613. **No repo action was ever required.**
  The bullet is corrected rather than removed because both halves of it are
  worth keeping. First, a Word footnote's raw `w:id` is not a stable
  identifier across edits made elsewhere in the document — this one note
  going and returning renumbered every later id in John twice, including the
  §11 multi-paragraph note's. The repo footnote label (`john-12-fn-a`) is
  what stays put; re-derive the current `w:id` with
  `check-master-hygiene.mjs` rather than trusting a recorded number. Second,
  a single capture showing an absence is not evidence of a deletion. The
  masters are live working documents, so "gone" and "gone for good" look
  identical in one snapshot, and only a repo-side change made on that basis
  would be hard to walk back.
- **`matthew-15-fn-v` gained a new sentence** (a link to the site's own
  Matthew 15 Canaanite-woman article) since 2026-08-16. Only a trailing
  period now differs from the repo's copy of that footnote, but it stays
  held for the same structural reason as `1corinthians-14-fn-z` — a
  hyperlink beyond the standard footnote-ref anchor.
- **`matthew-23-v13` picked up a new comma** (`for you, pretenders,—`).
  **Superseded 2026-08-19:** raising it surfaced that v13 would have been the
  only woe line in the chapter carrying the comma, so the owner extended it
  to all of them in Word. Applied — see §17.
- Luke's master picked up one trivial capitalization fix (`the Theological
  Dictionary` → `The Theological Dictionary`) and remains truncated at 21:38
  as before (§7) — nothing else changed. Mark's only other change is the
  `mark-11-fn-h` fix above.

Nothing in the 58 August edits (§1), the 95 April–July records (§2), the 22
malformed quote pairs (§10), or the 10 repo-only records (§3) changed for
these five books as far as this recheck could tell — the specific examples
named in each section were checked directly against the fresh text, though
none of those sections were re-verified record-by-record the way bucket A
was.

**Update, 2026-08-18: §2 rebuilt fresh, and worked record-by-record.** The 95
count above was already stale by the time it was written — most of those 88
footnotes had been resolved in the 2026-08-16 hand review without the section
prose being updated to match. Rebuilding the ledger from a live re-copy of
every master put the real remaining count at **7** (matching §3's real count
of 7, not 10 — same staleness, same cause). All 7 were reviewed and decided
this session:

| record | decision | outcome |
|---|---|---|
| `1corinthians-16-fn-j` | repo drop the "(Greek: …)" gloss it added; master has none | **applied** |
| `luke-13-v16` | match the master: spell out "eighteen" | **applied** |
| `luke-18-fn-o` | match the master: em dash → comma before "removing" | **applied** |
| `luke-9-fn-b` | match a same-day master edit: "evidence"/"testimony" → single curly quotes | **applied** |
| `mark-15-fn-d` | owner fixed a mismatched quote pair (`"The people'` → `"The people"`) in Word same-day | **already matches — no repo change** |
| `1corinthians-14-v33` | owner updated Word to match the repo's existing "contention"/"peace" wording | **confirmed match — no repo change** |
| `luke-16-v14` | owner edit in Word only reached one of two malformed dashes in the sentence | **held — see below** |

`luke-9-fn-b`'s single-quote form isn't a one-off: the repo's own `luke-18-fn-o`
already uses single curly quotes the same way, for the same kind of thing —
glossing a short English equivalent of a Greek/Aramaic term inline in a
footnote, as distinct from an actual quotation. The fresh master text matches
an existing corpus pattern, not just this one instruction.

**`luke-16-v14` needs one more pass in Word, not a repo edit.** The verse
reads "the Pharisees[dash]since they were attached to money[dash]heard these
things" with two dashes that should presumably match. Before this round both
were a doubled en dash (`––`, not a real em dash) where the repo has always
had a single em dash (`—`) at both spots. The 2026-08-18 Word edit fixed only
the second one — "money—heard" now matches the repo exactly, but
"Pharisees––since" still reads as `––`. Per the standing rule for edits still
in progress, this is reported rather than silently finished to match: the
likely fix (drop the extra en dash to match the sentence's own other dash, and
the repo) is not applied here.

All four applied edits passed `validate-chapters`, `verify-bytes --base=main`,
`audit:alignment` (0 stale), and the full test suite (354/354) before commit.

## 16. Duplicated continuation text in Hebrews 2:8 and 8:8 (repaired 2026-08-18)

Two published verses printed their continuation sentence **twice**. Found while
investigating §9's list, which the fresh ledger reported as 18 rather than the
16 recorded there — the two extra entries were not quotation-boundary questions
at all, and §9's original count was right.

| | repo shipped | should read |
|---|---|---|
| `hebrews-2` v8 | the commentary sentence in *both* the poetry blockquote (`arrangement`) and the prose paragraph after it (`coordination`) | once, in the prose paragraph, in the master's `arrangement` wording |
| `hebrews-8` v8 | the quotation's first three lines flattened into the prose paragraph *and* set as poetry in the blockquote below | once, as poetry; the prose paragraph ends at `flawed by saying,` |

Both entered at `ff34f59` (the bucket-A apply) and both are the same mechanism.
Verse 8 spans two blocks in each chapter. The applier wrote the master's
**whole** verse into the *first* block, while the text it duplicates stayed
where it was in the second — so nothing was deleted and nothing looked wrong to
any structural check. Block balance is unchanged, the validator passes, and the
page renders as valid HTML that simply says the same thing twice.

The masters settle both: Hebrews's `document.xml` sets the commentary as its own
prose paragraph after the poetry line, and ends `by saying,` right before the
quotation's lines. The repo's block structure already matched; only the
distribution of text across it was wrong. The owner's approved wording is
unchanged by the repair — `coordination`/`uncoordinated`/`coordinated` in
`hebrews-2-p4` moved to `arrangement`/`unarranged`/`arranged`, which is what the
approved record said and what the applier had written into the blockquote alone.
Both verses now match their master token for token.

Repaired by byte-level splice (`json-splice.mjs`), not through `apply.mjs` —
like §14 these were not `decisions.json` records. `verify-bytes --base=main`
PASS, `validate:chapters` 260/260, `audit:alignment` 0 stale, tests 357/357.

### The detection bug behind it, now fixed

`locateVerseSpanInParagraphs` decided a verse continued into the next paragraph
by asking whether that paragraph **had no verse marker at all**. Almost no
continuation paragraph satisfies that: it carries the continued text first and
then opens a *later* verse in the same string. `hebrews-2-p4` continues v8 and
then opens v9; `hebrews-8-p3` continues v8 as poetry and then opens v9.

The rule found **122 of the corpus's 208 continuations**. The other 86, across
54 files, were not merely unhandled — they were silently *mis*-handled, read as
ordinary single-paragraph verses whose span runs to the end of the string. Any
restore touching one writes the master's whole verse into the head block. Only
two were ever actually applied, which is why only two shipped damaged.

The test is now "does the next paragraph **open** with reader-visible text",
which is what a continuation actually is (`opensWithContinuationText`). The
bracket markers and footnote anchor that lead a bracketed passage come out
first, since they belong to the verse whose marker follows them — `john-11-p16`
opens `[|<sup class="fn-ref">…w…</sup>` and then verse 28, and is not a
continuation of verse 27. Detection now covers 208 of 208.

**This changes nothing in today's ledger** — none of the 86 currently differs
from its master, so no record moved bucket, changed patch, or changed hold
reason (verified by building the ledger with and without the change: identical).
It is a guard against the next restore, not a re-run of the last one.

Verified by perturbing `hebrews-2` v8 so it differed from the master and
building the ledger both ways:

| | `patch.newValue` |
|---|---|
| before the fix | rewrites the blockquote to end with the duplicated commentary — the shipped defect, reproduced |
| after the fix | `null` — the record is held, and nothing is written |

That held disposition is the correct one: `splitComposedAtParagraphSeam` refuses
a tail paragraph carrying its own verse markers, so these route to hand-review
rather than to a guess. Distributing a restore across a continuation whose tail
opens a later verse is still not automated, and shouldn't be without a reviewer.

**What this class needs from a human.** Block balance cannot see it, because
nothing is unbalanced; `verify-bytes` cannot, because only string values moved;
the validator cannot, because the HTML is well-formed. It is caught by reading
the rendered verse, or by the scan below. Same lesson as §13 and §14: a restore
that crosses a paragraph break needs eyes on the output.

A corpus-wide scan for a verse repeating a 6-word run of its own text across
blocks now reports **0** findings (it reported these 2 before the repair), and
no other multi-block verse has drifted from its pre-restore revision except
John 8:19/25, which is §14's intended repair.

## 17. 2026-08-19 master round — 4 chapters applied

A second same-day capture of Matthew, John and Romans, after the owner acted
on the three items §6, §12 and §15 had left hanging. Every edit below is a
byte-level splice; nothing but the named string values moves.

| record | change | why |
|---|---|---|
| `matthew-23` vv13, 23, 25, 27, 29 | add the comma in "for you, pretenders" | master edit, 2026-08-19 |
| `matthew-5` fn-ff | drop the truncated trailing clause | master edit; the note was cut off on both sides |
| `john-2` fn-m, fn-w | delete both, cascade the remaining 24 notes to a–x | deleted from the master |
| `romans-8` v15 | add the second `Traditionally, ‘sons.’` note as fn-l, cascade l–v to m–w | owner ruling, §6 |

**Matthew 23:15 is deliberately untouched.** The owner's edit put the comma
on all six woe lines in Word, but only five of them are a comma edit here:
the repo's v15 still carries the import-era wording (`“You’d better watch
out, fakers, Bible Scholars and Pharisees…` against the master's `“Things
won’t end well for you, pretenders—O Bible Scholars and Pharisees…`), so it
is a bucket A verse record and has to be restored as a whole verse or not at
all. Adding a comma to a sentence the master does not have would have made
the two sides look closer while leaving the real difference in place — worth
watching for generally, since a formula repeated across a chapter invites
exactly that kind of partial match.

**Two footnote deletions and one insertion, which the byte-level tooling
does not directly support.** `spliceValue` replaces one JSON string value, so
it cannot express an array that changes length. The approach used here, and
worth reusing: do every *relabelling* first with `spliceValue` at the
elements' current indices, then remove or insert whole elements by raw line
range, highest index first so the earlier spans stay valid. `verify-bytes`
then reports a false positive on those two files — "formatting changed
outside string values… the reserialize signature" — because it aligns string
spans positionally and an array-length change desynchronises that alignment.
It is the same blind spot the Matthew 20 merge hit (§9). The real claim was
checked directly instead: with every string literal in the raw file blanked,
the before and after skeletons differ **only** by whole footnote-object
blocks, with no indentation, BOM, newline or punctuation drift.

`validate-chapters`, `audit:alignment` (0 stale of 3,586), `astro check`,
`check:links`, the full build and 354/354 tests pass.
