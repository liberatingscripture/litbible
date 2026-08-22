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

Every decision here is BVJ's. Queue sizes are the **published** verse count
(drafts excluded) and are regenerable; they grow as chapters land.

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

## Do not trust the inventory's footnote counts

Most terms triaged so far came in **below** their inventory `Notes` figure,
several far below — *psuche* is 19 against 57, *phobos* 8 against 34. Three
causes, all of which inflate:

1. **Anchors are counted, not notes.** A shared note reused across nine anchors
   scores nine. The *phaneroo* note is one note appearing six times in 1 John.
2. **Short transliterations nest inside longer ones.** `kopos` matches inside
   *episkopos* and *allotriepiskopos*; `ponos` matches the etymology sentence
   inside every *poneros* note, which belongs to a different entry entirely.
3. **A long shared note matches on a word it merely mentions in passing.**

A fourth error runs the other way, and it is the dangerous one because it
**hides** real notes rather than inventing them: **transliterations carry
macrons**, restored corpus-wide in the August 2026 reconciliation. A search for
`eikon` does not match *eikōn*. Fold diacritics (NFD, strip the combining range)
before matching. This is why two terms came out *above* their inventory figure
rather than below — *eulogeo* at 11 against 9, *baptizo* at 6 against 5.

Queue sizes, by contrast, have matched the inventory exactly every time. Trust
those. Re-derive `Notes` per term before letting it argue for anything.

**A fifth problem is not about counting at all.** An inventory candidate can
group lemmas that render *differently*, and the merged rendering column then
misattributes one lemma's rendering to another. `worship-latreuo` grouped
λατρεύω with προσκυνέω and reported both as "bow down before" — but that is
προσκυνέω's rendering, and λατρεύω is rendered "serve as representative" in all
19 of its published verses. The two co-occur in Matthew 4:10 and Luke 4:8, which
is exactly how the error survives a spot check. Verify a candidate's lemmas
render alike before treating it as one term.

## Not included

| candidate | lemmas | queue | notes (verified / inventory) |
|---|---|---|---|
| toil — *ponos* | `πόνος`, `κόπος`, `κοπιάω` | 35 | 1 / 14 |
| sabbath — *sabbaton* | `σάββατον` | 49 | 3 / 29 |
| myth — *muthos* | `μῦθος` | 5 | 3 / 4 |
| murder — *phoneuo* | `φονεύω`, `φόνος`, `φονεύς` | 17 | 1 / 8 |

All four set aside 2026-08-21, from tier 2 of the inventory except *ponos*,
which came from tier 1.

### toil — *ponos*, *kopos*, *kopiao*

The renderings are legible and consistent — "work to exhaustion", "heavy
labor", "hard work", "labor", "strive" — but they are ordinary English for an
ordinary Greek word. There is no traditional rendering being corrected and no
reader assumption being unsettled.

Two measurement notes, because the inventory rates this term highly and will
keep doing so. **Its footnote score is an artifact**: most of the 14 mentions
are the etymology sentence inside the *poneros* notes ("Rooted in *ponos*,
which conveys toil, suffering, and hardship"), which belongs to `evil-hardship`
and is already published; two more are substring matches on *episkopos*
(`philippians-1` fn-a) and *allotriepiskopos* (`1peter-4` fn-q). Exactly one
genuine note exists in the published corpus: `colossians-4` fn-h, "More
literally, 'holds large toil.'" And **the candidate is misnamed** — *ponos*
itself has one published verse (Col 4:13); its other three are in Revelation,
which has no Word master. In the published text this candidate is *kopos* and
*kopiao*.

There is also a sense split an entry would have had to carry: the idiom
*kopon parecho* is rendered "bothering" / "harassing" (Matt 26:10, Mark 14:6,
Luke 11:7, Luke 18:5), a different claim about the Greek than "labor".

### sabbath — *sabbaton*

**The rendering is already invariant and already self-evident.** LIT renders
`σάββατον` as "Shabbat" in all 45 published occurrences, with no variation at
all — the only single-rendering term surveyed so far. A reader meeting
"Shabbat" in the text can see that a transliteration decision has been made
without an entry telling them so, and `mark-1` fn-u and `luke-13` fn-d already
explain it where it first matters.

The inventory's 29 notes are almost entirely notes that *use* the word while
explaining something else — the day of preparation before Shabbat
(`john-19` fn-r and fn-ff, `matthew-27` fn-nn), a Sabbath-desecration charge
(`matthew-12` fn-d). Three argue the rendering: `mark-1` fn-u, `luke-13` fn-d,
and `luke-6` fn-c on the bare genitive in *tou sabbatou*.

### myth — *muthos*

Five published verses, the smallest queue in the whole inventory outside the
one-verse terms. The three notes are genuine and make the same point each time
(the English "myth" implies untrue; *muthos* did not), which is a footnote's
job rather than an entry's — an entry keyed to five verses would restate a note
the reader has already met.

### murder — *phoneuo*, *phonos*, *phoneus*

**One** genuine note in the published corpus, `luke-18` fn-y, against the
inventory's 8. The rendering does not depart from the traditional one in a way
that needs defending.

## Deferred

Deferred means the survey work is done and the answer could change — not that
it is queued.

| candidate | lemmas | queue | notes (verified / inventory) |
|---|---|---|---|
| manifest — *phaneroo* | `φανερόω`, `φανερός`, `φανερῶς`, `φανέρωσις` | 57 | 7 / 20 |
| reveal — *apokalupto* | `ἀποκαλύπτω`, `ἀποκάλυψις` | 42 | 2 / 4 |
| authority — *exousia* | `ἐξουσία` | 65 | 5 / 11 |
| utterance — *rhema* | `ῥῆμα` | 48 | 7 / 9 |
| wisdom — *sophia* | `σοφία`, `σοφός` | 54 | 3 / 9 |
| discipline — *paideia* | `παιδεία`, `παιδεύω` | 13 | 4 / 4 |
| nature — *phusis* | `φύσις`, `φυσικός` | 13 | 3 / 5 |
| image — *eikon* | `εἰκών` | 12 | 2 / 4 |
| paradise — *paradeisos* | `παράδεισος` | 1 | 1 / 4 |

All deferred 2026-08-21. *phaneroo* came from tier 1, the rest from tier 2.
*phaneroo* and *apokalupto* are a **pair** — each of the two notes that defines
one does so against the other — so they were deferred together and should be
promoted together or not at all.

### manifest — *phaneroo*

**Instances and information are both sufficient. The payload is weak.** That is
the whole reason, and it is the case the criterion above was written for.

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
- One open editorial question if it is promoted: the 1 John note prefers
  "brought to light" for the illumination echo in the root, but the running text
  uses that phrase once (John 2:11) and reaches for "made visible" ten times
  more often. That gap also sets the entry filename, since the note frames the
  traditional side as 'revealed' while the inventory candidate key says
  'manifest'. `reveal-apokalupto` is deferred alongside it for the same reason
  — see below.

### reveal — *apokalupto*, *apokalupsis*

**LIT keeps the traditional rendering here.** 38 of the 42 published verses read
"reveal", "revealing" or "revelation". The four that do not are Luke 12:2
("exposed"), 1 Corinthians 2:10 ("unveiled"), Ephesians 1:17 ("curious"), and
Romans 2:5, where the sense is carried diffusely rather than by a word. A
glossary entry documents a departure from the traditional rendering, and at this
rate there is barely one to document.

The inventory's 4 notes are 2, and **one of those is the *phaneroo* note**,
which mentions *apokalupto* only in its closing sentence to say that 'revealed'
"is often how apokalupto is translated, which has to do with uncovering or
unveiling." So exactly one note argues an *apokalupto* rendering of its own:
`ephesians-1` fn-r, on rendering *apokalupsis* as "curious" in Eph 1:17 — a
single contextual choice ("a people characterized by a posture of discovery"),
explicitly not a corpus-wide commitment, and it concedes in its first line that
'revelation' is the correct translation.

That is also what makes this the other half of the *phaneroo* pair: the
distinction the 1 John note draws — illuminating versus uncovering — is the only
place either word's commitment is actually stated, and it is stated once, about
both.

### authority — *exousia*

The five genuine notes concentrate in one passage rather than spreading across
the corpus: `1corinthians-11` fn-t and fn-v carry the argument (the woman's
*exousia* over her own head, and that *exousia* consistently means the agency
or right of the person being discussed), with `2corinthians-13` fn-i on the
root sense of freedom-to-act. `mark-10` fn-gg and `matthew-20` fn-r are about
the *compounds* — *katexousiazo*, *exousiazo* — and the top-down force the
`kata-` prefix adds, which is a related but distinct claim an entry would have
to decide whether to absorb.

### utterance — *rhema*

The best-evidenced of the deferred six: seven genuine notes, four opening
"Traditionally," and all making one consistent argument — this is *rhema*, not
*logos*; it is audible speech, a saying, what comes from the mouth, and 'word'
blurs the two. `hebrews-1` fn-d, `hebrews-11` fn-d, `john-3` fn-cc, `john-5`
fn-gg, `john-6` fn-pp, `luke-3` fn-e, `matthew-4` fn-f.

Note the entanglement: the argument is stated *against* `word-logos`, which
sits in tier 3 at 229 verses and is itself undecided. Promoting *rhema* alone
would publish half of a contrast.

### wisdom — *sophia*

Three genuine notes, all in 1 Corinthians 1–4, and the inventory's 9 is
inflated by the *logos* notes matching in passing. `1corinthians-1` fn-aa is
the substantial one and is explicitly about *this passage's* several uses of
*sophia* rather than about the word generally; `1corinthians-3` fn-h and
`1corinthians-4` fn-n distinguish *sophos* from *phronimos*. Passage-local
argument, not a corpus-wide commitment.

### discipline — *paideia*, *paideuo*

The one term whose verified count matches the inventory exactly (4 of 4), and
the argument is clean and repeated: *paideia* is a noun from the word for
'child', "very literally the practice of 'childing'", covering everything
parents do to help children grow, against the punitive freight English
'discipline' carries. `hebrews-12` fn-h and fn-j, `ephesians-6` fn-g,
`1timothy-1` fn-nn.

Small queue (13 verses), so the cost of promoting it later is low.

### nature — *phusis*, *phusikos*

Three genuine notes, none opening "Traditionally," and they do not converge:
`1corinthians-11` fn-bb renders *phusis* as "cultural convention" for
contextual reasons, `galatians-2` fn-x says there is no good literal rendering
at all, `galatians-4` fn-i ties it to 'by birth'. An entry would have to claim
a consistency the notes themselves decline to claim.

### image — *eikon*

Two notes, both connecting *eikōn* to the creation narrative — `1corinthians-11`
fn-o (Genesis 1:26–27 and 5:1–3, and Hebrew *tselem*) and `colossians-1` fn-r,
which argues word order to preserve the Genesis 1 link. `romans-1` fn-rr is a
bare alternative-rendering note ("Or 'image' or 'icon'").

This is the term whose count the macron miss hid: `eikōn` does not match a
search for `eikon`.

### paradise — *paradeisos*

Deferred **on queue size, not on payload** — the only entry here set aside for
that reason, and the reason it may not stay set aside for long.

LIT renders it "the Garden", which departs from "paradise" completely, and the
single note opens "Traditionally,". But only **one** verse is published
(2 Cor 12:4, "was carried off to the Garden"). The other two are Luke 23:43 and
Revelation 2:7 — Luke's chapter is still a draft and Revelation has no Word
master at all, so neither can be reviewed yet.

A one-verse entry states a commitment the corpus cannot yet show. **Revisit when
Luke 23 publishes**, which takes it to two of three and makes the thief on the
cross available, where the word does most of its pastoral work.

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
