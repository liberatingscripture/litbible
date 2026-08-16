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

## 5. Held for hand review (126 of bucket A)

Import-era damage that is real but could not be repaired mechanically:

| reason | count | why it stopped |
|---|---|---|
| quote-ambiguous | ~100 | a quotation opens and never closes inside the string, so the converter cannot tell which way a mark should curl without reading the sentence |
| bracketed chapter | 23 | `mark-16`, `john-7`, `john-8`, `john-9`, `john-11`, `romans-16` — the paired `[\|`/`\|]` footnotes are byte-identical by design and must be edited together |
| verse continuation | 9 | the verse runs past its paragraph with no marker of its own, so it is not a single JSON string to replace |
| footnote-reference count differs | 10 | the master and repo disagree on how many notes the verse carries, so restoring would add or drop an anchor |
| hyperlink / multi-paragraph note | 4 | structure the master extractor cannot produce |

The 10 anchor-count cases are worth a look regardless of the restore:
`1corinthians-3:5`, `1corinthians-14:33`, `2corinthians-4:4`, `2peter-1:9`,
`james-2:1`, `james-2:13`, `john-8:40`, `mark-6:50`, `matthew-6:2`,
`matthew-11:8`. Each is a genuine editorial difference about how many notes a
verse should have.

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
