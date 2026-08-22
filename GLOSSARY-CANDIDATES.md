# Glossary candidates set aside

The glossary publishes a translation commitment: a word whose traditional
English rendering carries something the Greek does not, or hides something it
does. **Not every word that could be documented that way earns an entry.** This
file is the register of the ones that could have been and were not, and why.

It exists so a candidate is triaged **once**. The candidate inventory ranks
terms by editorial signal against review cost, so a term set aside here will go
on scoring well there and go on looking like the obvious next pick. Without a
written reason, the next session re-derives the survey, reaches the same
question, and asks it again.

Every decision here is BVJ's. Queue sizes are regenerable and are the
**published** verse count (drafts excluded); they grow as chapters land.

## The criterion

Instance count and available information are **necessary but not sufficient**.
A term can have a large queue, a validated lemma family, and a fully written
footnote already in the corpus, and still not be worth an entry.

What decides it is **theological and pastoral payload**: does knowing this
change how a reader holds the text? An entry that only reports a lexical fact
spends a reader's attention without repaying it, and spends the review pass
that produced it.

This is deliberately not the axis the inventory sorts on. Footnotes-per-queue-
verse measures how much has already been said about a word, which is a decent
proxy for *cost* and a poor one for *payload*.

## Not included

### toil — *ponos*, *kopos*, *kopiao*

`πόνος`, `κόπος`, `κοπιάω` · 35 published verses (42 in SBLGNT) · set aside
2026-08-21, from tier 1 of the inventory.

The renderings are legible and consistent — "work to exhaustion", "heavy
labor", "hard work", "labor", "strive" — but they are ordinary English for an
ordinary Greek word. There is no traditional rendering being corrected and no
reader assumption being unsettled.

Two measurement notes, because the inventory rates this term highly and will
keep doing so:

1. **Its footnote score is an artifact.** The 14 mentions that ranked it are
   not about this word family. Most are the etymology sentence inside the
   *poneros* notes ("Rooted in *ponos*, which conveys toil, suffering, and
   hardship"), which belongs to `evil-hardship` and is already published. Two
   more are substring matches: `kopos` nests inside *episkopos*
   (`philippians-1` fn-a) and *allotriepiskopos* (`1peter-4` fn-q). Widening
   the search past the transliterations to any footnote using toil or labor
   language turns up exactly **one** genuine note in the published corpus:
   `colossians-4` fn-h, "More literally, 'holds large toil.'"
2. **The candidate is misnamed.** *ponos* itself has one published verse
   (Col 4:13); its other three are in Revelation, which has no Word master. In
   the published text this candidate is *kopos* and *kopiao*.

There is also a sense split the entry would have had to carry: the idiom
*kopon parecho* is rendered "bothering" / "harassing" (Matt 26:10, Mark 14:6,
Luke 11:7, Luke 18:5), which is a different claim about the Greek than "labor"
and would need its own handling.

## Deferred

Deferred means the survey work is done and the answer could change — not that
it is queued.

### manifest — *phaneroo*

`φανερόω`, `φανερός`, `φανερῶς`, `φανέρωσις` · 57 published verses (62 in
SBLGNT) · deferred 2026-08-21, from tier 1 of the inventory.

**Instances and information are both sufficient. The payload is weak.** That
is the whole reason, and it is the case the criterion above was written for.

What is already in hand, so a later session does not re-derive it:

- The commitment is written. A note repeated six times across 1 John 2–3 says
  it: traditionally 'revealed'; *phaneroo* means 'to make visible', kin to
  *phaneros* 'clearly visible' and *phane* 'torch'; something shadowed has been
  illuminated; 'made clear', 'made visible' and 'exposed' would all serve; and
  'revealed' is more properly *apokalupto*, which is uncovering rather than
  illuminating. `john-7` fn-g covers the adverb.
- The lemma family should be all four forms. The adverb and the noun render
  inside the same family ("openly", "publicly", "demonstration", "makes the
  truth clearly visible"), and erring inclusive is the safer bias.
- The renderings fragment the way *katharos* did, so shipping it would need a
  `Consolidate` pass. Across the 53 verses of `φανερόω`/`φανερός`: made visible
  (11), shown (7), made clearly visible (6), clearly shown / evident /
  perceptible (5), made clear (4), revealed (3, all Colossians), displayed (3),
  apparent (2), distinguished (2), conspicuous / expose (2), brought to light
  (1).
- One open editorial question if it is ever promoted: the 1 John note prefers
  "brought to light" for the illumination echo in the root, but the running
  text uses that phrase once (John 2:11) and reaches for "made visible" ten
  times more often. That gap also sets the entry filename, since the note
  frames the traditional side as 'revealed' while the inventory candidate key
  says 'manifest'.

## Moving an entry

Promoting one out of this file is the same recipe as any other term (glossary
entry with `draft: true`, a line in `scripts/lib/glossary-lemmas.mjs`,
`npm run build:alignment`, `npm run review:alignment`, `npm run audit:alignment`,
then lift the flag). Delete the section here in the same change, so the register
never contradicts `src/content/glossary/`.

Demoting a **published** entry is a different operation and is not what this
file is for: set `draft: true` rather than deleting the entry, or the alignment
scanner stops producing the term and its reviewed records are lost, confirmed
ones included. See the `glossary` collection bullet in `CLAUDE.md`.
