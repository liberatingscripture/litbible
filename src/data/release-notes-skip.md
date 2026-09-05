# Release-notes skip marker

`.github/workflows/release-notes.yml` computes its base ref as **the last commit
that touched either `release-notes.json` or this file**. Everything before that
commit is treated as already reported.

So **touching this file in the same commit as a content change keeps that change
out of the changelog** — the drafter's range comes back empty, it exits without
writing, and the workflow's "commit if changed" step finds nothing to push.

Use it sparingly. `release-notes.json` is also the mobile apps' "Translation
Updates" feed, so anything skipped here is invisible to app users as well as to
the website. It is for mechanical passes whose per-verse detail would be noise —
never for a change to the translation's wording, which is exactly what readers
open that feed to see.

To skip a round: add an entry below, in the same commit as the content change.

---

## 2026-08-21 — the eight new glossary entries

Skipped 48 auto-drafted rows and hand-wrote a replacement entry in
`release-notes.json` covering the eight glossary additions only.

One of the 48 was the reason: *"Metadata updated (68 chapters)"*. That is the
footnote-format normalization, which re-serialized 68 files without changing a
rendered character. The drafter handled it correctly — it compared rendered text,
found nothing, and collapsed 68 rows into one — but the row still announces a
change no reader can see, and the skip marker suppresses a whole range rather
than a single row, so there is no way to drop just that one automatically.

The other 47 were the eight glossary additions plus 39 wording rows, and every
one of the 39 is a verse-by-verse application of a renaming one of those eight
entries exists to explain: 32 rows carry ekklesia to "Called Community /
community", 6 carry ethnos to "people groups", and 4 carry hupokrites to
"pretender / pretense". (The counts sum past 39 because three rows carry two of
them at once — Romans 16:4 reads "communities of the other people groups".)
Nothing in the 39 falls outside those three.

Owner decision: the eight entries ARE that story, and each explains its renaming
better than 39 rows of `"assembly" -> "community"` can. The verse-level detail
stays in git and on the pages themselves.

**To surface the wording rows later,** `npm run draft:release-notes -- --since
4119e17` reproduces all 48 exactly; drop the metadata row and merge the rest
into the 2026-08-21 entry.

## 2026-08-20 — reconciliation round: footnote punctuation and quotation repair

Skipped 56 auto-drafted rows (41 footnote updates, 15 text updates) covering the
shared-note normalization, the unbalanced-quotation repairs, the two Romans
quotations, and the corpus-wide en-dash conversion.

Owner decision: the per-verse detail is too convoluted to help a reader. The
substance is recorded in `FOLLOW-UP-RECONCILIATION.md` §23–§25 instead.

**Note for the record:** 15 of the 56 were genuine wording restores rather than
punctuation — Matthew 8:9, 1 Corinthians 3:5, 2 Peter 1:1 and 1:9, Luke 7:22,
Mark 6:50, Romans 3:13, Hebrews 10:5, Ephesians 1:1, James 2:1 and 2:13, John
8:39–40, Galatians 4:27, Matthew 17:25, and three "Triumphant Message"
decapitalizations. They were skipped along with the rest at the owner's
direction; if they should surface later, they can be hand-written into
`release-notes.json` as a single short entry.

## 2026-08-20 — the footnote-sequence audit

Skipped 2 auto-drafted rows. Both would have been actively misleading rather
than merely noisy:

- *"2 Corinthians 5 — footnotes relabeled / footnotes formerly f relabeled g"* —
  nothing was relabeled in any sense a reader would recognize. Two notes swapped
  places so their letters run in document order, and each note still explains the
  same word it always did.
- *"Matthew 12:3–8 — text updated"*, with no detail — reads as though six verses
  of the translation changed. Two spaces were restored.

Neither changes a word of the translation.

## 2026-08-21 — the TDNT title italics

Skipped 1 auto-drafted row: *"Metadata updated (3 chapters)"*, for Philippians
3, 1 John 4, and Ephesians 4. Nothing about those chapters' metadata changed —
the drafter reports it that way because it strips markup before comparing, and
markup is all that moved. Three footnotes printed *Theological Dictionary of
the New Testament* as plain text while the other nine citing it already set the
title in italics. No wording changed in any of them.

## 2026-09-05 — the disputed-passage bracket notation

Skipped 6 auto-drafted rows, one per bracketed passage (Mark 16:9, Mark 16:20,
John 7:53, John 8:11, John 9:38, John 9:39, John 11:28, John 11:32, Romans
16:24, Romans 16:25–27). Each would have read *"… — text updated"* with no
detail at all, because there is no wording to show: the markers that wrap a
contested passage changed from the two-character `[|` / `|]` to the real
double brackets `⟦` / `⟧` (U+27E6/U+27E7), the notation critical editions use
for text of doubtful authenticity.

The drafter produces those rows deliberately — its paragraph-level fallback
comparison does NOT strip bracket markers, precisely so a bracket-only edit
still surfaces rather than vanishing. That is the right default; here it is
noise. A bare "text updated" on Mark 16:9 and John 7:53 tells a reader that
two of the most contested passages in the New Testament changed, when what
changed is the shape of the punctuation around them.

Not a word of the translation moved: the six passages are byte-identical apart
from those twelve characters.
