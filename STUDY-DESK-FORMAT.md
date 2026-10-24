# The Study Desk record format (draft 1, with draft 2's additions)

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
   - `marker`: `note`, `emphasis`, `question`, `heart`, `ribbon`,
     `lightbulb` or `flame`. N6's question is the `question` marker.
     **`ribbon` was `bookmark` until 2026-10-23** (E10; BDR's decision):
     every client reads `bookmark` as `ribbon` and writes `ribbon`, as iOS
     already reads an old `star` as `emphasis`; nothing stored is rewritten.
     The marker's picture and color do not change;
   - `quote`, optional: a note on a whole verse has none;
   - `verseCopy`, `verseCopyAsOf`.

   Instead of verses, a note's target may be:
   - a **footnote**, given by its verse and the footnote's quoted words, never
     its letter (M11). **The website's proposal, built on its preview
     2026-10-20, for BDR to confirm or change**: the footnote is named
     exactly as a `footnotePin` names it (kind 11), by the verse whose text
     holds its letter, `footnote` (its full text in the same normalized
     form) and `n` when that verse has two or more identical footnotes. Such
     a note has no `quote` and no `verseCopy`: its words are the footnote's,
     so it is found again, and carries the change notice, by kind 11's rule
     (found, moved, changed or lost), never by its verse's wording. Keep
     rewrites `footnote`, the verse and `n`, as for a pin. The apps carry it
     untouched until they show it (principle 6); one that reads it as a note
     on the verse loses nothing, since the fields stay;
   - a **glossary term**, given by `glossaryId` with no verse (N2);
   - **provisionally** (N11; the website's proposal for draft 2, built on its
     preview 2026-10-08): a **glossary entry's own text**, given by
     `glossaryEntry` (the entry's id), or an **article's**, given by
     `article` (its slug, which `src/data/article-slugs.json` keeps from
     changing silently). Either may carry a `quote` of the entry's or
     article's words (see "Anchor text for prose" below) and `targetTitle`,
     a copy of its title for lists. Website only unless BDR changes the
     apps, which carry such a note untouched (principle 6).
3. **`hidden`** (N8): a verse range the reader has hidden until they choose
   to show it, with an optional note to self. While the record exists, every
   client keeps those verses hidden everywhere they appear, screen readers
   included.
4. **`bookmark`** (B2)
   - a verse;
   - an optional `label`;
   - an optional `from`: how the reader got there (a search, an episode, an
     intro).

   ~~**Open:** whether the apps' `bookmark` marker on a note becomes this.~~
   **Settled 2026-10-23:** a bookmark is its own kind, and the note marker,
   now named `ribbon` (kind 2), stays a note's glyph.

   **Coming (BVJ, 2026-10-22; STUDY-DESK.md E9), not yet in the format:**
   bookmarks and named ribbons become one feature, Bookmarks. This kind would
   gain the ribbon's `name` (or reuse `label`) and an optional following flag
   (the ribbon's C25 behavior, "move as I read"), and kind 5's
   `ribbon: true` would retire. **For BDR's Claude:** the apps need not build
   ribbons as a separate kind. Nothing changes here until the website says so
   in STUDY-DESK.md, with new merge vectors.
   **E9: accepted by BDR, 2026-10-23.** The apps build one kind, Bookmarks,
   and no separate ribbon kind.
   **E10, decided by BDR 2026-10-23: the note marker is renamed `ribbon`**
   (kind 2's `marker` list above says so). Its picture and color stay the
   same; the red bookmark glyph is never called a ribbon. Every client reads
   an old `bookmark` as `ribbon` and writes `ribbon`, as iOS reads an old
   `star` as `emphasis`. (The other option, retiring it, was not taken.)
5. **`place`** (B1): `name` (empty for a book's own "Continue reading"
   place), a verse, and `ribbon: true` for a named ribbon. Places are stored
   as verses, never scroll positions (A-F13). **Open:** whether each device's
   reading place syncs at all (BVJ leans slightly against). **On the
   website, "Continue reading" and Read View's per-book places are not
   `place` records**: they stay in their own browser storage, and the
   notebook lists them beside the ribbons. Only a ribbon is a `place`
   record there (`ribbon: true`; at most 6, names up to 40 characters,
   unique ignoring case).

   **Coming (E9, 2026-10-22):** named ribbons merge into kind 4, and the
   notebook's Places list goes: "Continue reading" stays, with no bookmark
   icon, and no other place is listed unless the reader made a bookmark. If
   reading places sync at all, "Continue reading" would be the only `place`.
   See kind 4.
6. ~~**`legend`**~~ (H1): **dropped 2026-10-07** (BVJ with BDR; colours carry
   no named meanings). The number is kept so the kinds after it don't move.
   Draft 1 had: the reader's meaning for each of the four colours, one per
   reader.
7. **`markRule`** (H2): a glossary term, a book and a colour, worked out
   from the published alignment on each load.
8. **`label`** (M8): a name. Records list the labels on them. The website
   calls them **"Labels"** (recommended, for BVJ to confirm), and keeps names
   unique ignoring case and accents: a new label matching an old one reuses
   it.
9. **`sheet`** (S1–S10, M9, D9): one document the reader builds, for a
   study group, a sermon, a class or anything else. **The website's
   proposal of 2026-10-18 (phase 3b), approved by BVJ the same day.** The apps carry it
   untouched (principle 6, C8); only the website reads or writes it. Its
   shape is under "Sheets (kind 9)" below.
10. **`trash`** (M7): the whole deleted record for 30 days. After that the
    content is dropped and only `deletedId` and `deletedAt` stay, kept
    indefinitely, so a stale backup can't bring a deleted note back (A-F10).
    Deleting means removing the live record and writing this one, never
    flipping a flag on the live record (iOS found flag flips unreliable).
    **For draft 2** (BDR, 2026-10-09, rule c): the 30-day trash and the
    marker kept forever stand, and the record also carries the deleted
    record's **kind**; restoring re-creates the record under the same id.
    The website names the field `deletedKind`, beside `deletedId` and
    `deletedAt` (built 2026-10-12; a trash record written before then takes
    the kind of the record it holds).

    **Two trash records for one deletion** (two devices each deleted the
    record before they met) **collapse to one. The website's proposal,
    2026-10-12, for BDR to confirm or change:**
    - **The later deletion is kept**: the survivor is the trash record with
      the later `deletedAt` (on a tie, the lower `id`), so every client
      keeps the same id. That is rule b's "the later action wins": an edit
      made between the two deletions doesn't bring the record back.
    - **The newer content is kept**: the survivor's `record` and
      `deletedKind` come from whichever trash record holds the more
      recently modified copy (rule a), or the only one still holding
      content. Each device saved the copy it had when it deleted, so the
      later deletion can hold the older words.
    - Its `modified` is the later of the two, and its 30 days run from the
      kept `deletedAt`.

    The website's first proposal (2026-10-05) kept the **earliest**
    deletion instead. Rule b, answered since, makes that wrong: an edit made
    after the first deletion and before the second would bring back a
    record the reader deleted after editing it.
11. **`footnotePin`** (draft 2; BDR, 2026-10-09; the tenth kind in use,
    numbered 11 because `legend` keeps its number). A footnote the reader
    pinned to come back to. Readers see "Pin", "Unpin" and "Pinned
    footnotes" on all three.
    - a verse: the verse whose text holds the footnote's letter (a letter
      ahead of a chapter's first verse marker, as in Colossians 4, counts
      as the first verse);
    - `footnote`: the footnote's full text, read like anchor text (steps 3
      to 7: block boundaries become a space, other tags vanish, entities
      decode, then the normalization). **Never its letter**, since letters
      shift whenever a footnote is added earlier in the chapter;
    - `n`, optional: its place among that verse's footnotes whose text is
      identical, written only when there are two or more.

    Found again by verse, then by its words (the website's rule, built
    2026-10-12 in `src/lib/desk-footnotes.mjs`; the apps' own rules may
    differ until they agree one): `found` in its verse, comparing text with
    quotes, dashes and spacing evened out; `moved` to the nearest verse
    holding the same text, with no notice; `changed` when no note reads the
    same but one in its verse keeps at least half of the pinned words, with
    the change notice (Keep rewrites `footnote`, the verse and `n`); and
    otherwise `lost`.

**Reserved:** `encryptedBody`, an envelope for an end-to-end encrypted body,
unused for now (A-F12). Under plan C, BDR's proposal (2026-10-07) makes the
envelope the standard wrapper for draft 2: id, revision, edit time and
deletion time in the clear, everything else encrypted (`STUDY-DESK.md`, "One
notebook, three homes").

## Sheets (kind 9)

**Status: approved by BVJ, 2026-10-18** (phase 3b; the website's
proposal, with the rich-text set BVJ chose). The reference is
`src/lib/desk-sheet-format.mjs` (the checks and `sanitizeSheetHtml`), with
`src/lib/desk-sheets.mjs` for the changes a sheet takes. A sheet is **one
record**, so it is deleted, trashed, restored, merged and undone as a whole,
by the rules every kind follows. Edited on the website only (in /desk's
sheet pane; `/sheets/` only shows, presents and prints one). The apps keep
it as they keep any record they don't show. Being one record means that
when two computers edit the same sheet before they meet, the later save
wins the whole sheet (rule a, under "Clocks"); every module carries its own
`id`, so merging module by module can be added later without changing the
format.

Two rules shape everything here:

1. **Passages come from the live text, and the record never holds
   scripture to show.** A passage is a reference, plus at most a quote
   saying which words of a verse it starts and ends on. Its words are read
   from today's chapter whenever the sheet is shown, printed or presented.
   The one copy it keeps (`verseCopy`) is for comparison only (S2: "this
   passage changed since you added it"), never shown or printed.
2. **The reader's words and the LIT's never mix.** A passage is its own
   module, drawn set apart, and the reader's text is in modules of its own.
   A quotation typed into the reader's text is the reader's words, styled as
   theirs.

### The sheet's own fields

Besides the fields every record carries (it has no `bookKey`, `chapter` or
verses of its own):

| Field | Meaning |
|---|---|
| `sheetFormat` | The version of this section the sheet was written in (1). A client that knows a lower number shows the sheet but won't edit it, so an older tab can't strip what it doesn't understand |
| `title` | Plain text, up to 200 characters ("Freedom and the Life-breath") |
| `subtitle` | Plain text, up to 200 characters, may be empty ("Thursday group · October 2, 2026") |
| `template` | The template it was started from (`bible-study`, `sermon`, `class`, `lectio-divina`, `blank`, …). A record of where it came from, read by nothing that changes how it works: once made, every sheet is the same thing |
| `commercial` | `true` when the reader has ticked "This is for a commercial project" (S7), which turns on the commercial-quotation check. Absent or `false` otherwise |
| `modules` | The sheet's contents, in order |

A sheet is at most **512 KB** as JSON (CloudKit's records stop at 1 MB, and
a sheet should fit any home with room to spare) and **300 modules**. Nothing
else in it has a limit of its own.

### Modules

Every module is an object with:
- `id`: unique within the sheet (a UUID), so a module can be moved, undone
  and, one day, merged on its own;
- `type`: one of the types below;
- `leaderOnly`, optional: `true` prints and presents it on the leader's copy
  only (S4). Any module may carry it, a passage included (background
  reading for the leader).

A module of a type the client doesn't know is **kept where it is and
written back untouched**, and shown as "Made by a newer version of the
LIT" in the editor. Fields a client doesn't know are kept the same way.

**`passage`**: verses of one chapter.

| Field | Meaning |
|---|---|
| `bookKey`, `chapter`, `verse`, `endVerse` | The verses. One chapter per passage; a reading that crosses a chapter is two passages |
| `quote`, optional | When the passage starts or ends inside a verse (added from a selection): the anchor of the words it covers, as for a highlight. Absent for whole verses |
| `verseCopy`, `verseCopyAsOf` | The verses' anchor text when added (comparison only, rule 1), and the content version it was read from (the website writes the version, where a note's `verseCopyAsOf` is a time; a reader takes the day from either). Absent when the passage was added without its chapter to hand (gathered from a search); the website's editor then takes a copy the first time it reads the passage |
| `blanks` | Words left blank on the participant's copy (S10). May be empty |
| `footnotes` | The leader's choices of which footnotes print (C15). May be empty |

The reference printed is always plain verse numbers ("Romans 5:6–10",
never "6a"), as when sharing a selection.

A **blank** is `{ id, verse, exact, prefix, suffix, hint, hintText }`: the
words blanked, found like any quote (`verse` is the verse they start in), and
the hint printed beneath:
- `hint: "none"`: just the blank;
- `hint: "traditional"`: the traditional word for the glossary term the
  blanked words render ("traditionally sin"), looked up from today's term
  lens data when printed, so it never goes stale. Offered only where a term
  is marked;
- `hint: "custom"`: the leader's own `hintText`, plain text up to 100
  characters.

The answer is the blanked words themselves, so it is never stored twice.
Blanks are omissions, never substitutions. A blank whose words can no longer
be found (`verse` or `lost`, under "Finding a mark again") isn't printed,
and the editor tells the leader.

The **footnote choices** are `{ verse, footnote, n, print }` per footnote
the leader has decided on: the footnote named as `footnotePin` names it (its
verse, its full text, `n` among identical ones), never its letter, and
`print` true or false. A footnote with no choice follows the default, which
is worked out live: it prints, **unless it gives a blank away**, in which
case it is flagged and left out until the leader decides. Select all and
Unselect all write a choice for every footnote in the passage. So a
footnote added to the chapter later prints by default, and is still flagged
if it gives a blank away. A choice whose footnote has gone is ignored.

**`text`**: the reader's own words, formatted.

| Field | Meaning |
|---|---|
| `html` | Formatted text, in the sanitized form below |

A blank-canvas sheet is a sheet whose template is `blank` and starts with
one empty `text` module; everything else about it is the same as any sheet.

**`question`**: a question for discussion.

| Field | Meaning |
|---|---|
| `html` | The question, formatted |
| `answer` | Formatted, may be empty. Always the leader's only, whatever `leaderOnly` says |
| `lines` | Ruled lines to write on beneath it, 0 to 20 |

**`space`**: ruled space to write, `lines` 1 to 40, for a reflection or
lectio divina's rest.

**`keyTerms`**: the key terms box (S3). Its terms are worked out live from
the sheet's passages. `omit` lists the glossary ids the leader took out, may
be empty. At most one per sheet.

**`pageBreak`**: a new page when printed. Nothing else.

### Formatted text

`html` in `text` and `question` modules (and a question's `answer`) is HTML
in **one canonical form**, so every client writes the same text for the
same formatting and a merge never sees a change that isn't one. Every
client sanitizes it **when it is saved and again when it is shown**,
keeping exactly the set below and nothing else; anything else is dropped,
its text kept, and `<script>`, `<style>` and the like are dropped with
their contents. The form:
- Only the tags of the set, in lowercase, with these attributes and no
  others: a link's `href` (http, https, mailto, or a path on litbible.net
  starting `/`); `data-align` on a `p`, `h2` or `h3` (`center`, `right`
  or `justify`; left, the default, is no attribute); and on a `span`,
  `data-font`, `data-size`, `data-color` and `data-mark`, written in that
  order, each with one of the named values below. No `style`, no `class`,
  no event handlers, no ids.
- **Styles are names, never values.** A sheet stores `data-color="red"`,
  never a color, so each theme, print and the Word copy decide what red
  looks like (each named color has a light and a dark value checked for
  contrast), and a reader's own Atkinson or OpenDyslexic choice still
  wins on screen, as it does everywhere. A `span` with no valid style is
  unwrapped; a style with a value not in the list is dropped; spans nested
  with nothing between them become one, the inner one's styles winning.
- Nesting: the top level holds `p`, `h2`, `h3`, `blockquote`, `ul`, `ol`
  and `hr`; a `blockquote` holds `p`, `ul` and `ol`; a list holds `li`;
  an `li` holds inline content and then at most one nested `ul` or `ol`,
  three lists deep at most (a deeper list joins the third). Inline
  content is text, `br` and the inline tags, which nest in any order, and
  `a` never holds another `a`.
- Top level holds blocks only; loose text is wrapped in `<p>`. `<div>` is
  read as `<p>`, `<b>` as `<strong>`, `<i>` as `<em>`, `<h1>` as `<h2>`
  (the sheet's title is the page's one `<h1>`), `<h4>` to `<h6>` as
  `<h3>`.
- Characters are written as themselves; only `&amp;`, `&lt;`, `&gt;` and,
  inside `href`, `&quot;` are escaped.
- Empty inline elements are dropped, and two adjacent same-tag inline runs
  are joined (the chapter files' "no seam" rule).
- Scripture references typed in it link and preview **when shown**, as a
  note's do (`noteBodyHtml`), and a link leaving the site opens in a new
  tab when shown; neither is stored.

**The set** (BVJ, 2026-10-18: the proposed set plus text alignment, then
the named styles the same day). The
mock's sheet showed bold, italic, headings, bulleted lists, quotations and
links; the blank canvas wanted more. The same set holds in every text
module (the record can't tell a canvas from a template), and it can grow
later (`sheetFormat` 2) but never shrink.

| Group | Tags |
|---|---|
| Blocks | paragraph `p`, headings `h2` and `h3`, quotation `blockquote`, line `hr` |
| Lists | bulleted `ul`, numbered `ol`, items `li`, nested up to three deep |
| Inline | bold `strong`, italic `em`, underline `u`, strikethrough `s`, superscript `sup`, subscript `sub`, link `a`, line break `br` |
| Alignment | left (the default), center, right and justified, on paragraphs and headings (`data-align`) |
| Font (`data-font`) | the default, `sans` (Inter), `serif` (Crimson Text), `display` (Fraunces), `handwriting` (Playpen Sans) and `atkinson` (Atkinson Hyperlegible) |
| Size (`data-size`) | `small`, normal (the default), `large` and `larger`, scaled from the reader's own text size |
| Text color (`data-color`) | the default, `red`, `blue`, `green`, `purple` and `gray` |
| Background (`data-mark`) | none (the default), `yellow`, `green`, `blue` and `pink`, the notebook's highlight colors |

Left out: any font, size or color by value (themes, print and contrast),
images (no record can hold a file), and tables.

### Sharing a sheet

**Status: built on the website's preview, 2026-10-20** (S8, phase 3k; the
reference is `src/lib/desk-sheet-share.mjs`, with
`test/desk-sheet-share.test.js`). A sheet is shared with no server: the
whole sheet travels in a link's fragment, which a browser never sends, or in
a file. Nothing is stored anywhere else.

**The link** is `https://litbible.net/sheets/#share1.<data>`. `share1.` names
this section's version. `<data>` is the **shared sheet** as UTF-8 JSON,
compressed with raw DEFLATE (RFC 1951, no zlib or gzip wrapper) and written
in base64url without padding. The path is the sheets page's, so an app can
claim `/sheets/` with a fragment beginning `share1.` later without claiming
anything else.

**The shared sheet** is an object:

| Field | Meaning |
|---|---|
| `lit` | `"sheet"` |
| `sheetFormat`, `title`, `subtitle`, `template`, `commercial` | As on the sheet (`commercial` only when true) |
| `scope` | `"leader"` (everything) or `"participant"` (no module marked `leaderOnly`, and every question's `answer` empty) |
| `contentVersion` | The sheet's own, so the receiver knows which text it was made on |
| `modules` | The sheet's modules, each **without its `id`**, and passages without `verseCopy` and `verseCopyAsOf` |

Nothing else of the record travels (its id, client, times, labels). A
receiver gives every module a fresh id and makes the sheet a record of its
own, and refuses the share unless that record passes the sheet's check
(`validateSheet`): formatted text must already be in the canonical form.
Decompressed data over twice the sheet's 512 KB limit is refused before it
is read whole.

**The file** is Markdown for people: the title, the subtitle, a line saying
how to open it, each part in words (a passage by its reference, never its
text), and on its last line the data, as an HTML comment so a Markdown
viewer shows nothing of it: `<!-- lit-sheet share1.<data> -->`, the same
fragment a link carries. Its name ends `.lit-sheet.md`.

**Opening one** on the website keeps the fragment out of every server's
sight: an inline script at the top of the sheets page's body moves it into
the tab's history entry (`history.state.litSharedSheet`) while the page is
still being parsed, before Cloudflare's analytics beacon (a deferred script)
runs, and the page shows the sheet from there. A reload finds it again. It is shown read only until the
reader chooses "Copy into my desk", which saves it as a new sheet of theirs
(new id, new times, their client). A shared link opened on a phone or
tablet says to open it on a computer (decision 4).

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

### Anchor text for prose (provisional)

A glossary entry or an article has no verses (N11). The website's proposal,
for BVJ to confirm: **the body is read as one verse** by steps 3 to 7 above,
from the rendered entry or article body, so a quote, its context and the
search below work unchanged. Text that isn't the body's own is dropped the
way verse numbers are: screen-reader-only text, footnote references, and
controls a page adds. Finding it again: `found` anywhere in the body (there
is no `moved`), then `changed` by the same context rule, and otherwise the
note goes on the whole entry or article, flagged. The reference is
`src/lib/desk-prose-anchor.mjs`.

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

**The website's notice, proposed for draft 2** (built on its preview
2026-10-10 and approved by BVJ the same day; `src/lib/desk-change.mjs`).
The apps still have to agree it. Three refinements of the rule above:
- **A change of typography alone carries no notice.** Where the words a
  `changed` mark is carried to differ from its `exact` only in quotes,
  dashes and spacing (STUDY-DESK.md, N3 and C3; the August 2026 passes
  curled 439 quotes and changed no wording), the mark is shown on the words
  found, with no notice. The marked words decide, not the rest of the
  verse, so records with no `verseCopy` are judged the same way. `verse` and
  `lost` always carry one.
- **A note on whole verses carries one when their wording changes.** It
  has no quote, so it is always `found`; the website compares its
  `verseCopy` with today's verses and shows the notice when the wording
  differs. A quoted mark whose words are still found carries none.
- **Keep from `verse`**: a note loses its quote and becomes a note on its
  whole verses; a highlight takes the whole verses as its quote. Keep moves
  `modified` and `contentVersion`, since the reader acted. A record whose
  `contentVersion` can't be ordered against the client's (two publishes on
  one day) is rewritten only once the client knows it has the newest text
  (the website asks `/api/version.json`).

`changed` is the one step BVJ left to the three Claudes (no preference).
Draft 1 adopts the apps' approach over the plan's whole-verse fallback,
because both apps already ship it and tell the reader.

**For draft 2** (BDR, 2026-10-09, rule e): two guards on `changed`, each
with a test case. A **size limit**: never take a region much longer than the
original (Android's is about twice plus a little). A **context floor**: where
the words repeat ("Amen."), trust a choice only when enough context matches.
Past either, the mark falls to `verse`, with the notice.

### Highlights that meet

**Settled** (A-M5): Android's rule, which BDR ruled for iOS (2026-10-05)
and the website matches (BVJ, 2026-10-07). Restated on anchor text:
- **Same colour:** two highlights whose ranges overlap, or are separated
  only by whitespace, merge into one.
- **Different colour:** a new highlight trims the old one where they
  overlap.
- **Three details** (approved by BDR, 2026-10-09): highlights in different
  paragraphs never merge; a trimmed remainder loses stray spaces at its
  edges; and a highlight carrying an unread change notice is never touched
  by a new one, since its old words are what the notice quotes.

Each client applies the rule when the reader makes a highlight. None applies
it to records arriving from elsewhere, so two devices can't rewrite each
other's marks.

**Which records carry the result** (the website's practice since
2026-10-09, `src/lib/desk-highlights.mjs`; proposed for draft 2): a merge
keeps the **oldest** of the merged records, by `created`, and deletes the
others through the trash, so a highlight's id lasts as long as it does. A
trim edits the old record; where a new colour lands in the middle of an old
one, the old record keeps the first piece and the second becomes a new
record of the old colour, carrying its labels. A record that is rewritten
gets a new quote and `verseCopy` taken from today's text, and today's
`contentVersion`. A record written by a newer schema, or on newer text than
the client has (principle 7), counts as one carrying an unread notice: it is
never touched. Removing a highlight from some words is the same trim with
no new colour.

A highlight across paragraphs is **one** logical record (A-F1). A store
that needs slices (iCloud's existing app records) slices it in its own
mapping.

### Clocks

`modified` comes from the device clock. Where a store has its own revision
(a CloudKit change tag, a Drive file's version, a service's row version),
that decides which write is newer, and `modified` only breaks a tie (A-F7).

**Draft 2 reverses this** (BDR, 2026-10-09, rule a): the newer `modified`
wins on every store and for every kind, notes included, so a write never
wins just because its device synced last. A store's revision is only the
"what changed since last time" cursor and the tiebreaker for an exact tie,
and a `modified` in the future is clamped to the service's clock on arrival.
An edit later than a trash record's `deletedAt` brings the record back
(rule b). The older of two versions of a note is discarded, like any other
kind's (BVJ, going with BDR, 2026-10-09), so a conflicting note leaves no
second copy.

**Three details the website settled while building the merge** (2026-10-12,
`src/lib/desk-merge.mjs` and the shared cases in
`test/fixtures/merge-vectors.json`; for BDR to confirm):
- An edit and a deletion at exactly the same time leave the record
  **deleted**, since a deletion is made of the copy the device had.
- An exact tie between two edits, with no store revision to break it, keeps
  the copy already on the device.
- **A deletion that wins over an edit keeps the edited words in the trash.**
  Edited on one device and deleted later on another that hadn't seen the
  edit, the record stays deleted (rule b), but its trash record takes the
  newer copy, so undoing or restoring brings back what the reader last
  wrote. The same principle as the collapse rule under kind 10.

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
  people (the mocked D1 file). **Built on the website 2026-10-12**
  (`src/lib/desk-export.mjs`; the defaults are the website's, for BVJ to
  confirm) as three files, each for a different reader:
  - **Full backup** (`.json`): `{ "format": "lit-notebook", "version": 1,
    "exported", "contentVersion", "records": [...] }`, every record
    unchanged, kinds this code doesn't know included. The only file that
    carries **trash**, and so the only one that carries a deletion; a
    deleted note's words never reach the other two. It restores a notebook
    completely.
  - **Web Annotation** (`.annotations.json`): an `AnnotationCollection`. Each
    mark on the text is an annotation whose `motivation` is highlighting for
    a highlight, commenting for a note (questioning for the `question`
    marker), bookmarking for a bookmark or pinned footnote (a pin's target
    is a `TextQuoteSelector` of its text), and commenting for `hidden`
    (the vocabulary has nothing for hiding). **Every annotation carries the
    whole record as `lit.record`**, so the file re-imports losslessly. The
    collection's `lit.records` holds what isn't a mark on the text: places,
    labels, sheets, mark rules and kinds the website doesn't know. Files
    other tools made are reported and skipped on import.
  - **Markdown** (`.md`): for people, each entry headed by its reference and
    carrying `<!-- lit:id=… -->`, ending with the license notice and the
    link to the terms. A note edited in the file comes back as an edit (a
    bookmark's label too), and a new entry with a verse reference becomes a
    new note; highlights, bookmarks and pins can't be made from Markdown, and
    places and labels aren't read back. A body line starting `#`, `>` or
    `<!--` is escaped with a backslash on save.
  Opening a copy merges through `desk-merge.mjs`, in one commit, and never
  deletes a record for being absent from the file (audit C17).

## Still open in this file

- ~~Bookmarks vs the `bookmark` marker (kind 4)~~: **settled 2026-10-23** —
  the marker is renamed `ribbon` (E10, BDR); bookmarks stay their own kind,
  with ribbons folded in (E9, accepted by BDR).
- ~~The overlap rule's three details~~: **approved by BDR, 2026-10-09**
  (under "Highlights that meet").
- **How records merge, and the `trash` record's fields: answered by BDR,
  2026-10-09** (`STUDY-DESK.md`, rules a to e). The newer `modified` wins
  (under "Clocks"); an edit after a deletion brings the record back; the
  trash keeps 30 days and then a marker forever, and adds the deleted
  record's kind. The website writes the kind as `deletedKind` (2026-10-12).
  The older of two versions of a note is discarded (BVJ, 2026-10-09), so
  the website's proposed `conflictOf` copy is dropped. **The rule for
  collapsing two trash records of one deletion**, which draft 4d of BDR's
  proposal doesn't mention, is now the website's proposal under kind 10
  (2026-10-12): the later deletion with the newer content. Built that way;
  **confirmed by BDR, 2026-10-23**, with the three details under "Clocks".
- **Notes on glossary entries and articles** (STUDY-DESK.md, N11; BVJ,
  2026-10-06). **Built provisionally on the website's preview
  (2026-10-08)**: the two targets under kind 2, the rule against renaming
  an article silently (`src/data/article-slugs.json`), and "Anchor text for
  prose". All three are the website's proposals for draft 2, for BVJ to
  confirm. **Website only** unless BDR changes the apps. Until then the apps
  carry these records untouched (principle 6), as they would any target
  they don't know.
- ~~**Notes on a footnote** (M11; kind 2)~~: the fields (`footnote` and `n`,
  as kind 11 has them; built on the preview 2026-10-20) **confirmed by BDR,
  2026-10-23**.
- Whether reading places sync (kind 5).
- ~~The sheet's inner shape~~: **approved by BVJ, 2026-10-18**, under
  "Sheets (kind 9)".
- Each store's exact mapping, once plan A or C is chosen.
- **Draft 2's list** (BDR's proposal, 2026-10-07): rules a to e for
  collisions, a placement value meaning "place me from my verses and quoted
  words" for records the website writes, and the envelope above. See
  `STUDY-DESK.md`, "To freeze before Christmas". **Added 2026-10-09**:
  rules a to e as BDR answered them, and **pinned footnotes**, a tenth kind
  (BDR): the book, chapter and verse and the footnote's full text in the
  normalized form, never its letter, plus its order among identical
  footnotes in that verse; found again by verse, then by its words, with the
  change notice when the footnote is rewritten. Both apps store pins today
  as a third value of an existing record type and map them to this kind
  under sync. **Written up as kind 11, `footnotePin`** (2026-10-12), with
  the field names the website proposes (`footnote`, `n`).

**Vectors not yet included:**
- **Adjacent footnote letters:** the corpus has none today.
- **A real word-joiner or decomposed accent:** these are synthetic only,
  since the corpus has none.
