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
that section predicted.

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

### The 16 approved in review but still held by `apply.mjs`

The review tool shows held records with their hold reason and lets them be
answered; `apply.mjs` will not write one unless it is named. These were approved
on 2026-08-16 and are **not applied**:

| records | hold |
|---|---|
| `john-8-v19`, `-v20`, `-v25`, `-v26` | the versification difference below — approving these adopts the master's verse boundaries, which moves a sentence between two verses |
| `matthew-18-v22`, `matthew-20-v13`, `mark-5-v28`, `john-12-v31`, `romans-3-v4` | cross-verse quotation boundary (§9) |
| `john-11-v19`, `john-11-v21` | would write `[Miriam]` into scripture text |
| `1corinthians-14-fn-z`, `-fn-ee` | hyperlink in the footnote |
| `matthew-28-fn-j` | multi-paragraph footnote in the master (§11) |
| `john-2-fn-w` | truncated in the master; broken on both sides (§12) |
| `john-7-fn-q` | would import `in in Torah` (§12) |

Six of them — the five cross-verse ones and `1corinthians-14-fn-z` — were
**seeded automatically** when the tool started, because every hunk in them
defaulted; they were not necessarily looked at.

### The 51 that stay held

| reason | count | why it stops |
|---|---|---|
| cross-verse quotation boundary | 16 | the two sides differ in nothing but quote characters, and the quotation's other end sits in a different verse — section 9 |
| footnote-reference count differs | 14 | the two sides disagree on how many notes the verse carries, so restoring would add or drop an anchor |
| would introduce a wrong-direction quote pair | 5 | the master's wording is wanted but arrives with `‘lord”`; taking it imports the defect section 10 exists to fix |
| square brackets into scripture | 4 | John 11's master reads `[Miriam]` and `come to […] Miriam` |
| verse-boundary disagreement | 4 | John 8:19–20 and 25–26; see below |
| hyperlink in the footnote | 3 | structure the master extractor cannot produce |
| doubled word / truncated master / mis-wrapped verse / blockquote continuation / multi-paragraph note | 5 | one each |

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

## 9. Cross-verse quotation boundaries — 16 verses, your call

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
| John `w:id=353` (2 blocks) | `john-12` fn-a | join |
| Matthew `w:id=794` (2 blocks) | `matthew-28` fn-j | join |
| 1 Corinthians `w:id=300` (3 blocks) | `1corinthians-11` fn-b | **not a mistake** — this is the chiasm, and its lines are real. Word wants `<w:br/>` line breaks rather than paragraph breaks so it stays one footnote. The repo already renders it as `<div class="chiasm">`, so no repo change either way. |

Replace the paragraph break with a line break (Shift+Enter) in Word.

## 12. Master-side defects found while composing restores

Each is a real error in Word that a restore would otherwise import:

- **`john-7` fn-q** reads `the path laid out in in Torah`.
- **`john-2` fn-w** is cut off at `This is ‘they trusted the sc`. The repo
  carries the import's own placeholder here (`This footnote text appears
  truncated in the source… Verify and complete it before publishing`), so
  **both sides need this one written**.
- **`john-11`** reads `[Miriam]` in verses 20, 21 and 24 and `come to […]
  Miriam` in verse 19 — in-progress editorial marks rather than punctuation.
- **`matthew-11:6`** reads `is has reason for gratitude`.
- **`matthew-2` fn-g** reads `the untrustworthiness of those group`.

## 13. Poetry line breaks flattened by earlier restores — 14 places, needs you

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

**Not repaired here, because it is not mechanical.** Luke 6:24 shows why — the
same restore that flattened its two lines also dropped the opening quotation
mark:

```
before  <p class="hbq-line">…“However,</span> there are dire warnings for those who are wealthy</p>
        <p class="hbq-line">because you have already received your comfort.</p>
after   …However,</span> there are dire warnings for those who are wealthy because you have
        already received your comfort.
```

Re-inserting the breaks means deciding where they fall in wording that has since
changed, and whether the `“` comes back — both editorial. The pre-restore text
is in git at `2cf906a~1` for every one of the 14.

`build-ledger.mjs` still produces this. Guarding it means holding interior block
markup back the way `splitTrailingBlockClose` and `splitTrailingSeparator` hold
back the ends of a span, which is a larger change than either.

## 6. Deferred to a later PR

- **19 footnotes present in the masters and absent from the repo.** Adding one
  means inserting an anchor into the verse HTML *and* cascading every later
  footnote letter in the chapter, so each is hand work. Listed in
  `out/deferred-master-only.json`.
- **9 empty footnotes in the masters.** Fix on the Word side.
- **Verse-boundary shifts and master-has-extra-content verses**, including two
  substantive ones: `3john-1:10` and `1corinthians-15:43`.

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
