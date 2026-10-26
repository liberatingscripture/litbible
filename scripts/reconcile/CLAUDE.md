# The Word masters and the reconcile toolchain

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory.
> Cross-references such as "below" or "rule 15" were written when all of
> this was one file, so they may point into another area file; the root's
> index says which file holds each section.

## The Word masters (`scripts/reconcile/`)

**The chapter JSON is not the origin of the translation.** The author writes in
Word, one `.docx` per book, kept in OneDrive — those are the masters, and where
the two disagree about wording the master wins. The JSON was seeded from them by
a lossy import in 2026-02 which shortened notes, dropped a few entirely, added
punctuation nobody wrote, and stripped macrons off transliterated Greek.
`scripts/reconcile/` is the toolchain that measured and repaired that; August
2026 restored 749 footnotes and 165 verses across 153 files.

The masters are **read-only from this repo, always** — never edited to match the
JSON, in either direction, and never committed (they are the author's working
documents, and 17MB of unpacked XML besides). `MASTER_XML_DIR` points at an
unpacked copy; see that directory's README. **The `.docx` files come from the
local OneDrive sync folder** (`$OneDrive/Documents/Scripture & Spiritual
Teaching/Bible Translation/<Book>/<Book>.docx`) — copy out, unpack the copy.
The OneDrive connector cannot deliver bytes to this machine and is only good
for metadata; the README explains why.

Four things about them that are not guessable and cost real time to rediscover:

1. **A footnote reference is zero-width in Word.** It contributes no characters,
   which is right for comparing wording and wrong for rebuilding HTML: a verse
   rebuilt from master text alone loses every `<sup class="fn-ref">` anchor
   inside it, and the note becomes unreachable. `validate-chapters.mjs` does
   **not** catch this — it checks that every anchor has a footnote, never that
   every footnote has an anchor. `build-ledger.mjs` re-inserts the repo's own
   anchors at the master's positions and refuses the verse when the counts
   disagree.
2. **Verse numbers are usually superscript runs, but not always.** Eight
   chapters type one as ordinary body text and Mark 5:39 is a *subscript*. Any
   tool that trusts `<w:vertAlign>` alone walks past them; the digit-adjacency
   scan finds all of them, and the two are cross-checked per chapter.
3. **Restoring is a byte-level splice, never a reserialize.**
   `build-api-manifest.mjs` hashes chapter files by raw bytes and most files are
   not in canonical format, so a `JSON.parse`→`stringify` round-trip would move
   every hash and force every app install to re-download the whole corpus for no
   content change. `lib/json-splice.mjs` replaces one string value in place
   under seven assertions; `verify-bytes.mjs` proves after the fact that nothing
   but string values moved.
4. **Word mixes straight and curly quotes**, so master text cannot be spliced in
   raw — `curl-quotes.mjs` converts it first, and **refuses** rather than
   guessing when a quotation is unbalanced. A refusal is about the master's
   *punctuation*, not its words, so `lib/quote-compose.mjs` **composes** such a
   restore instead of converting it: a span differing in nothing but quote
   characters takes the repo (whose quotes are already validator-clean), markup
   takes the repo, everything else takes the master. Two gates then compare the
   result against the repo's current text — it must satisfy the validator's
   curly-quote rule, and must not introduce a wrong-direction pair the repo
   didn't already have. Before that existed a refusal left `patch.newValue`
   null, which put the record beyond the review tool as well as the applier.
5. **A verse that is the LAST in its paragraph owns the string to its end**,
   closing tags included, because they sit after its text and nothing else
   claims them. The master has no markup at all, so rebuilding that span drops
   the paragraph's `</p>` — which is how 59 paragraphs shipped unbalanced before
   anyone noticed, a browser closing a dangling `<p>` at the next block element.
   `lib/block-structure.mjs` is the single source for that rule now:
   `build-ledger.mjs` holds the closing run back, `apply.mjs` refuses a write
   that changes any paragraph's balance, and
   `repair-unclosed-paragraphs.mjs` fixed what shipped.
6. **A verse's span also holds the space separating it from the NEXT verse's
   marker**, since the span ends *at* that marker. Same shape as 5 and it
   shipped the same way: the master has no separator to contribute, so 135
   markers ended up welded to the preceding sentence (`sheep.12 The`). Nothing
   caught it — `sup.vn` is `inline-block` and no CSS supplies the gap, so the
   separator has to be in the text; the corpus votes 4,159 to 3.
   `splitTrailingSeparator` in `lib/verse-span.mjs` peels it,
   `findUnseparatedVerseMarkers` backstops `apply.mjs`, and
   `repair-verse-separators.mjs` fixed what shipped — repairing only where the
   pre-restore revision shows a separator, so the author's own unseparated
   markers stay untouched. **Note the interaction with the review tool:** a
   decision made before this landed has the loss baked into its
   `resolvedValue`, which `apply.mjs` writes in preference to the ledger's
   patch, so such a record needs the repair script run after it.
7. **A restore can flatten markup in the MIDDLE of a span too**, and that one is
   not yet guarded. 13 `<p class="hbq-line">` breaks and one `<br>` were lost
   this way — the Benedictus, Luke's woes, Matthew 13 — turning set poetry into
   running prose. Block balance does not see it, because the opener and its
   closer go together. See `FOLLOW-UP-RECONCILIATION.md` §13.
8. **A continuation paragraph usually opens a LATER verse**, so "the next
   paragraph has no verse marker" never identified one. `hebrews-2-p4`
   continues v8 and then opens v9. That rule found 122 of the corpus's 208
   continuations, and the 86 it missed were read as ordinary single-paragraph
   verses — so a restore wrote the master's *whole* verse into the head block
   while the text it duplicates stayed in the next one. Hebrews 2:8 and 8:8
   shipped printing their continuation sentence twice; nothing caught it,
   because nothing is unbalanced, no wording is lost, and the HTML is valid.
   `opensWithContinuationText` in `lib/verse-span.mjs` asks the right question
   (does the next paragraph *open* with reader-visible text, once the bracket
   markers and footnote anchor that belong to the following verse are taken
   out). Detection is now 208 of 208, and such a record is **held**, not
   patched — distributing a restore across a continuation is still a
   reviewer's call. See `FOLLOW-UP-RECONCILIATION.md` §16.

**Bucket A is evidence, not proof, and the held records are the worst place to
forget that.** "This text settled during the import window" is good reason to
think the repo is the damaged side, but records that a coarse rule held back for
months are unusual by selection, and unusual correlates with the master having
problems of its own — a doubled word, a dropped period, John 8 breaking verse 19
a sentence later than the repo does. The inverse trap exists too: John 11's
`[Martha and]`/`[Martha]` brackets (a supplied name clarifying who acts across
vv19–24 and v39) looked exactly like one of these — an in-progress editorial
mark — until the owner confirmed they publish as written, matching the
`colossians-2-p3`/fn-j convention for a bracketed supplied phrase in body text.
Don't classify a held record from its shape alone.
`lib/restore-guards.mjs` holds the shapes found so far; the general lesson is
that **these go through `npm run review:reconcile -- --buckets=A`, not through
`apply.mjs`**. Applying the 53 clear records in one pass was tried and thrown
away: six of them published a defect straight out of Word (`matthew-11:6` read
"is has reason for gratitude", `matthew-2` fn-g "those group"), and six is a
floor, since the scan that found them missed `mark-11` fn-h's "'divine'and".
For scale, the hand review of buckets B/C/D kept the repo's own text in 34 of
99 records.

`check-master-hygiene.mjs` covers the other blind spot — a diff can never report
what is wrong on *both* sides, and only one of the four multi-paragraph
footnotes in the masters ever surfaced as a difference.

`build-alignment.mjs`'s rule applies here too: **run `npm run audit:alignment`
after any verse restore.** A reviewed alignment record survives a scan whole, so
an edit to the verse under it leaves it silently stale — delete a stale record
rather than rejecting it.

**`npm run review:reconcile` is how the remaining differences get decided**, and
it asks **per hunk, not per record** — because the dating that produced the
buckets is per footnote and per verse, so one note edited in August carries its
remaining import damage into the same bucket as the edit. Spans are classified
`mechanical` (no word differs — take the master), `structural` (markup only —
keep the repo, whose markup is authored and which the Word master has none of),
or `judgment` (the words differ — the only kind a person must answer, and it
runs both ways: the repo has a typo in `1corinthians-10-fn-ee`, the master has
one in `1corinthians-2-fn-q`). **Consecutive spans are classified as a group as
well as singly**, because Word's run boundaries rarely match a word — `soter`
arrives as five per-letter `<em>` pairs — and a cluster that changes no letter
between its two sides is markup, not a question. **A record that is a wholesale
rewrite opens as a whole-version comparison instead of a row of choosers**: five
of them hold nearly half the questions, and per-span is unreadable at 92%
changed. Decisions land in `out/decisions.json` with the
SHA of the text they were made against; `apply.mjs --decision=approved` writes
the composed value and refuses any decision whose ground has since moved. Same
two structural rules as the alignment review tool: exact-path allowlist rather
than `public/`, and the browser imports the real `review-core.mjs`. It defaults
to buckets **B,C,D**; the import-era backlog is `-- --buckets=A`.

`FOLLOW-UP-RECONCILIATION.md` carries what the restore deliberately left alone:
the August edits to back-port *into* Word, the April–July window that needs a
human, and the books with no usable master (Revelation has none; Acts's holds
only 1:1–4; Luke's stops mid-21:38).
