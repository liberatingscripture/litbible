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
