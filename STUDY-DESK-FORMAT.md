# The Study Desk record format (draft 1)

**Status: a draft for the website and both apps to agree, written 2026-10-05.
Nothing uses it yet.** It answers the iOS reply's W1 (the text rule and its
test vectors) and W6 (every kind of record the website will ever store), and
the Android reply's A-F1 to A-F13. `STUDY-DESK.md` holds the plan and the
decisions; this file holds only the format.

**It doesn't depend on where notes are kept.** Whether they live in the
reader's iCloud and Google Drive (plan A) or in a LIT service (plan C since
2026-10-07, end-to-end encrypted; formerly plan B) is still open. This file describes the records themselves: what a note *is* and
which fields it has. A short section at the end maps them into each store.
Agreeing this now is safe under either plan.

Three files go together:
- this one, the spec;
- `scripts/lib/anchor-text.mjs`, the reference implementation of the text
  rule and of finding a mark again. Its pure half lives in
  `src/lib/anchor-core.mjs` (since 2026-10-05), because the website's pages
  use it too, and `anchor-text.mjs` re-exports all of it, so this is still
  the one file to read;
- `test/fixtures/anchor-vectors.json`, the test vectors, made by
  `npm run build:anchor-vectors`. Every input is copied into the file, so it
  stays valid as the translation changes. Each app runs it in its own tests.
  This repo's `test/anchor-text.test.js` checks it against the
  implementation.

Questions on the format are marked **Open**. Decisions only BVJ and BDR can
make are listed in `STUDY-DESK.md` ("To be decided").

## Principles

1. **One logical record per mark.** A highlight and a note are separate
   records (both apps already work this way). A note on highlighted words is
   two records sharing a target.
2. **Stores are homes, not formats.** iCloud, Google Drive, a LIT service and
   the export file each hold the same logical records. All merging happens in
   the clients.
3. **Offsets are never shared.** Each client keeps its own offsets on the
   device. A shared record carries verses and quoted words only.
4. **`modified` changes only when the reader changes something.** Re-placing
   a mark after a content update is not an edit, on any client.
5. **Find for display, never write back.** A client that re-finds a mark
   after the text changes shows the result. It writes only when the reader
   acts on it: Keep, Mark the new words, an edit, or Delete.
6. **Keep what you don't understand.** Every client preserves record kinds
   and fields it doesn't know and writes them back untouched.
7. **A client on older text never corrects a record made on newer text**, and
   the reverse. `contentVersion` says which text a record was made against.

## Fields every record carries

| Field | Meaning |
|---|---|
| `id` | A UUID. Both apps' existing UUIDs carry over unchanged |
| `kind` | One of the kinds below |
| `schema` | The format version this record was written in (1) |
| `created` | When the reader made it (ISO 8601, UTC) |
| `modified` | When the reader last changed it (principle 4) |
| `client` | What wrote it last, e.g. `web/2026.10`, `ios/2.1`, `android/1.4` (A-F11) |
| `contentVersion` | The `version` from `/api/version.json` the client had when the record was made, e.g. `v20261004.5d2c847d` |
| `labels` | IDs of the reader's labels (M8); may be empty |

A record about the text also carries **where**:

| Field | Meaning |
|---|---|
| `bookKey` | The site's slug (`romans`, `1corinthians`): the same keys both apps and the release notes feed's `location` use |
| `chapter` | Chapter number |
| `verse`, `endVerse` | The first and last verse it touches |

OSIS (`Rom.8.3`) is derived from these for the W3C export, using a table
generated from `src/data/books.js` (A-F9). It's never stored.

## The kinds

1. **`highlight`**
   - `color`: `yellow`, `green`, `blue` or `pink`;
   - `quote`: the anchor;
   - `verseCopy` and `verseCopyAsOf`: the verses' anchor text when it was
     made (A-F8). A record that existed before this format can't recover its
     original wording, so it says when its copy was taken.
2. **`note`**
   - `body`: plain text, always displayed as text;
   - `marker`: `note`, `emphasis`, `question`, `heart`, `bookmark`,
     `lightbulb` or `flame`. N6's question is the `question` marker;
   - `quote`, optional: a note on a whole verse has none;
   - `verseCopy`, `verseCopyAsOf`.

   Instead of verses, a note's target may be:
   - a **footnote**, given by its verse and the footnote's quoted words, never
     its letter (M11);
   - a **glossary term**, given by `glossaryId` with no verse (N2).
3. **`hidden`** (N8): a verse range the reader has hidden until they choose
   to show it, with an optional note to self. While the record exists, every
   client keeps those verses hidden everywhere they appear, screen readers
   included.
4. **`bookmark`** (B2)
   - a verse;
   - an optional `label`;
   - an optional `from`: how the reader got there (a search, an episode, an
     intro).

   **Open:** whether the apps' `bookmark` marker on a note becomes this.
   Draft 1 keeps them apart: a bookmark is its own kind, and the marker stays
   a note's glyph.
5. **`place`** (B1): `name` (empty for a book's own "Continue reading"
   place), a verse, and `ribbon: true` for a named ribbon. Places are stored
   as verses, never scroll positions (A-F13). **Open:** whether each device's
   reading place syncs at all (BVJ leans slightly against).
6. ~~**`legend`**~~ (H1): **dropped 2026-10-07** (BVJ with BDR; colours carry
   no named meanings). The number is kept so the kinds after it don't move.
   Draft 1 had: the reader's meaning for each of the four colours, one per
   reader.
7. **`markRule`** (H2): a glossary term, a book and a colour, worked out
   from the published alignment on each load.
8. **`label`** (M8): a name. Records list the labels on them.
9. **`sheet`** (S1–S10): one structured document:
   - title and template;
   - ordered items (passage, the reader's text, question);
   - per passage, its blanks and which footnotes print;
   - leader-only notes;
   - the commercial flag.

   Its inner shape will be specified with the sheets work (phase 3). The apps
   carry it untouched.
10. **`trash`** (M7): the whole deleted record for 30 days. After that the
    content is dropped and only `deletedId` and `deletedAt` stay, kept
    indefinitely, so a stale backup can't bring a deleted note back (A-F10).
    Deleting means removing the live record and writing this one, never
    flipping a flag on the live record (iOS found flag flips unreliable).

**Reserved:** `encryptedBody`, an envelope for an end-to-end encrypted body,
unused for now (A-F12). Under plan C, BDR's proposal (2026-10-07) makes the
envelope the standard wrapper for draft 2: id, revision, edit time and
deletion time in the clear, everything else encrypted (`STUDY-DESK.md`, "One
notebook, three homes").

## The quote (an anchor)

```json
"quote": {
  "exact": "rendered a verdict against deviation in self-preservation",
  "prefix": "under deviation and ",
  "suffix": " so that the Torah"
}
```

`exact` is the quoted words. `prefix` and `suffix` are **up to 32
characters** of the text either side (A-F6). All three are taken from the
anchor text below. Context may run across a verse boundary but never past
the chapter. A quote may cross verse and paragraph boundaries.

### Anchor text

A chapter's anchor text is built from its `paragraphs` as served at
`/api/data/chapters/`:

1. Split the chapter into verses at each verse marker
   (`<sup id="vN" class="vn">`). A verse runs to the next marker, across
   paragraph breaks; a continuation paragraph belongs to the verse it
   continues.
2. Drop each verse number and each footnote letter
   (`<sup class="fn-ref">…</sup>`) with its contents.
3. Every block boundary (`<p>`, `<blockquote>`, `<br>`, poetry lines)
   becomes a space. Every other tag is removed with nothing in its place.
4. Decode entities (the corpus uses only `&nbsp;` and `&mdash;`).
5. Normalize to NFC; remove zero-width characters (U+200B–U+200D, U+2060,
   U+FEFF) and soft hyphens (U+00AD).
6. **Remove the bracket markers `⟦ ⟧` and the retired `[| |]`**, *before*
   step 7 (BVJ, 2026-10-05; T7). Both apps already have this queued.
7. Collapse every run of whitespace, the no-break space included, to one
   space, then trim.
8. Keep quotes and dashes exactly as written. (N3's "did the wording change?"
   comparison evens them out; anchors don't.)

The chapter's anchor text is its verses in order, joined by one space.
Offsets used in tests count **UTF-16 code units**, as JavaScript, Kotlin and
Swift's `utf16` view all do. Today's text has nothing outside the Basic
Multilingual Plane, so these equal code-point offsets.

Every client also normalizes a **stored** quote with steps 5–7 before
matching. That lets existing app quotes containing ⟦ or a line break still
match.

**Why one space and not a newline at a poetry line.** A quote's line breaks
belong to how it was displayed, which differs by client and by Display
setting. One space everywhere makes the three implementations easy to keep
identical, and the text is still the reader's words. Poetry keeps its lines
on screen and in Copy text; only anchoring flattens them.

Not covered: draft chapters (`indexed: false`). Their placeholder text
isn't scripture, so a mark is never anchored there.

### Finding a mark again

Run these steps in order. The first that succeeds gives the status:

| Status | When | What the reader sees |
|---|---|---|
| `found` | `exact` occurs in the record's verses. If it occurs more than once, take the occurrence whose surroundings agree longest with `prefix` (read backwards) plus `suffix` (read forwards); on a tie, the first | The mark, as made |
| `moved` | `exact` occurs elsewhere in the chapter (chosen the same way) | The mark, at its new place |
| `changed` | The words are gone, but enough of the context survives inside the record's verses. Take the longest tail of `prefix` and head of `suffix` that still occur in order, at least 8 characters between them, and use the text between | The mark on the new words, flagged, with the old words kept: the apps' existing behaviour |
| `verse` | Nothing usable | The mark on its whole verse range, flagged |
| `lost` | The record's verses no longer exist | Listed, never drawn |

Nothing found this way is written back (principle 5). A `changed`, `verse`
or `lost` mark shows a notice. The two apps' wording for it is worth keeping:
- iOS's actions: Re-read in Context, Keep, Delete;
- Android's two registers: "carried along" and "couldn't find your words".

**Keep** writes the found position as the new quote, with a fresh
`verseCopy`.

`changed` is the one step BVJ left to the three Claudes (no preference).
Draft 1 adopts the apps' approach over the plan's whole-verse fallback,
because both apps already ship it and tell the reader.

### Highlights that meet

**Open** (A-M5; the apps' rules differ). Draft 1 proposes Android's rule,
restated on anchor text:
- **Same colour:** two highlights whose ranges overlap, or are separated
  only by whitespace, merge into one.
- **Different colour:** a new highlight trims the old one where they
  overlap.

Each client applies the rule when the reader makes a highlight. None applies
it to records arriving from elsewhere, so two devices can't rewrite each
other's marks.

A highlight across paragraphs is **one** logical record (A-F1). A store
that needs slices (iCloud's existing app records) slices it in its own
mapping.

### Clocks

`modified` comes from the device clock. Where a store has its own revision
(a CloudKit change tag, a Drive file's version, a service's row version),
that decides which write is newer, and `modified` only breaks a tie (A-F7).

## Addresses

A record's address form is `https://litbible.net/<bookKey>-<chapter>/#v<verse>`,
or `#v3-5` for a range: the apex host with the trailing slash. Printed QR
codes use the same form. No new website path may start with `<bookKey>-`
unless it is a chapter or an intro, since both apps claim those (W7). Sheets
and accounts would live under `/sheets/`, `/notebook/`, `/account/`.

## How each store holds the records (sketch)

- **iCloud (plan A).**
  - The kinds the iOS app shows (highlight, note, bookmark, place, trash,
    hidden) map onto the app's own Core Data records (`CD_` types in the
    app's zone). Fields are added once, by BDR, and are permanent.
  - Highlights are sliced per paragraph with a shared `groupId`, the app's
    current shape.
  - A note the website writes carries the quote, the verses and an empty
    `offsetSpace`. The app places it on arrival (W4).
  - The app's existing offset fields stay its own private fields. The website
    ignores them (principle 3).
  - Kinds only the website uses (mark rules, labels, sheets) go in a
    **separate zone the app never opens**, under one generic record type
    (`kind`, a JSON payload, `modified`). That type is deployed once and
    never needs another field.
- **Google Drive app folder (plan A).** One JSON file per record, named by
  `id` (A-F2), holding the logical record as written here.
- **A LIT service (plan C).** One row per record: the reader, `id`, a
  revision, `modified` and the deletion time in the clear, and the record's
  JSON encrypted.
- **The export file.** For marks on the text: JSON in the W3C Web Annotation
  shape, where `TextQuoteSelector` is `quote`, `FragmentSelector` is
  `#v3-4`, `motivation` comes from `kind`, and the LIT fields go under
  `lit`. Sheets and places use this format's own JSON. Markdown is kept for
  people (the mocked D1 file).

## Still open in this file

- Bookmarks vs the `bookmark` marker (kind 4).
- **The overlap rule. Needed before the website's phase 1c.**
- **How records merge, and the `trash` record's fields. Needed before the
  website's phase 1c.** The format names `deletedId` and `deletedAt` but not
  the field holding the deleted record, and says nothing yet about which
  write wins without a store revision, an edit made after a deletion, or a
  note changed on two devices. The website's proposals are in
  `STUDY-DESK.md`, "Questions for the apps" (talk-through item 20). One of
  them adds a field, `conflictOf`, on the second copy of a conflicting note.
  The website's phase 1b builds the proposed trash fields (`deletedId`,
  `deletedAt`, and `record` for the whole deleted record) **provisionally**,
  in `src/lib/desk-records.mjs`. Only its preview writes them, and nothing
  leaves the browser, so a different answer means a migration there.
- **Notes on glossary entries and articles** (STUDY-DESK.md, N11; BVJ,
  2026-10-06). The website will let a reader attach a note to a glossary
  entry or an article, as a whole or at quoted words, so `note` needs two
  more targets: a glossary entry by its id (already a stable key), and an
  article by its slug (which needs a rule against renaming). Quoting text
  that has no verses needs an anchor-text rule of its own. **Website only**
  unless BDR changes the apps. Until then the apps carry these records
  untouched (principle 6), as they would any target they don't know.
- Whether reading places sync (kind 5).
- The sheet's inner shape.
- Each store's exact mapping, once plan A or C is chosen.
- **Draft 2's list** (BDR's proposal, 2026-10-07): rules a to e for
  collisions, a placement value meaning "place me from my verses and quoted
  words" for records the website writes, and the envelope above. See
  `STUDY-DESK.md`, "To freeze before Christmas".

**Vectors not yet included:**
- **Adjacent footnote letters:** the corpus has none today.
- **A real word-joiner or decomposed accent:** these are synthetic only,
  since the corpus has none.
