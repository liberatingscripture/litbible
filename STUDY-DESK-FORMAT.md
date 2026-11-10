# The Study Desk record format (draft 1, with draft 2's additions)

**Status: a draft for the website and both apps to agree, written 2026-10-05.
The website's Study Desk preview writes and reads it** (behind `?desk=on`,
not yet released): its notebook, its export files and opening them, which
merges through `src/lib/desk-merge.mjs`. **The apps don't use it yet.**
Audit FA1-f (2026-10-26) brought this file into line with the website's code;
what that changed for the apps is listed in `STUDY-DESK.md`, "One notebook,
three homes" (its 2026-10-26 note for BDR's Claude). It answers the iOS reply's W1 (the text rule and its
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
| `created` | When the reader made it: ISO 8601 in UTC, ending in `Z` (below) |
| `modified` | When the reader last changed it (principle 4), in the same form |
| `client` | What wrote it last, e.g. `web/2026.10`, `ios/2.1`, `android/1.4` (A-F11) |
| `contentVersion` | The `version` from `/api/version.json` the client had when the record was made, e.g. `v20261004.5d2c847d` |
| `labels` | IDs of the reader's labels (M8); may be empty |

Each is **required** of a live record (a trash record is judged as its kind
section says): `labels` may be `[]` but not absent, and `client` and
`contentVersion` are strings. The website skips a record without them when it
opens a copy.

**Times** (`created`, `modified`, a trash record's `deletedAt`) are written
in UTC **with `Z`**, never an offset: `2026-10-26T14:03:09.512Z`. Fractions of
a second are optional and may have any number of digits; the website writes
three (JavaScript's `toISOString()`). When it opens a copy, the website skips,
and reports, any record but a trash record whose `created` or `modified`
isn't in this form, so such a record written with `+00:00` would never reach
it. Trash records are only required to carry times that parse, but write
them with `Z` too. Clients compare times as instants, not as strings, so
`…09.5Z` and `…09.500Z` are the same time.

**A record is at most 1 MB as JSON, whatever its kind or schema** (audit 3
SEC3-1; BVJ's decision 7, 2026-11-07; **for BDR to confirm**). The limits a
kind carries (a note's 64 KB body, a sheet's 512 KB) apply only to records a
client can edit, so a note from a newer schema with a 40 MB body was kept,
drawn, backed up, and would have synced. The website's `validateRecord`
refuses any record whose serialized size passes 1 MB, with a reason in the
import's report, and the same ceiling should stand at the apps' import and
at sync. It is far above every real limit, so a newer client's records are
never touched by it, and a kept record is still never rewritten (SEC Q2,
option B).

A record about the text also carries **where**:

| Field | Meaning |
|---|---|
| `bookKey` | The site's slug (`romans`, `1corinthians`): the same keys both apps and the release notes feed's `location` use |
| `chapter` | Chapter number |
| `verse`, `endVerse` | The first and last verse it touches |

`chapter`, `verse`, `endVerse` and a footnote's `n` are JSON integers, never
strings (`3`, not `"3"`), with `verse` 1 or more and `endVerse`, when present,
no less than `verse`. The website refuses a record that breaks this as out of
range (audit 8 DI8-6).

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
     The marker's picture and color do not change. **Every client reads
     every old name** (audit 3 DI3-5, 2026-11-07): since nothing stored is
     rewritten, an iOS note from before the rename still carries `star` on
     disk and reaches the website in a backup or a sync, where it was
     refused. The website's `RENAMED_MARKERS` now holds both `bookmark →
     ribbon` and `star → emphasis` (merge vector
     `migrate-an-old-star-marker-reads-as-emphasis`). **BDR, please list
     every marker name either app has ever written**, so the website reads
     them all. **`marker` is required** (audit 8 DI8-6): a note without one
     is refused, so a client that shows a note with no icon writes `note`;
   - `quote`, optional: a note on a whole verse has none;
   - `verseCopy`, `verseCopyAsOf`.

   Instead of verses, a note's target may be:
   - a **footnote**, given by its verse and the footnote's quoted words, never
     its letter (M11). **The website's proposal, built on its preview
     2026-10-20, confirmed by BDR 2026-10-23**: the footnote is named
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
   included. **The note to self is `body`**, as a note's words are (the
   website's proposal, 2026-10-26, for BDR to confirm). The website's hidden
   passage is built but held off `main`, so nothing writes this kind yet; its
   export reads `body` and, failing that, `note`, so a record written either
   way is kept.
4. **`bookmark`** (B2; E9)
   - a verse;
   - an optional `label`: the bookmark's name, up to 40 characters. Names
     need not differ, and a bookmark needs none. Plain text, always shown as
     text;
   - an optional `follow`: `true` when the bookmark moves as the reader reads
     ("Move as I read"; absent otherwise). A bookmark without it stays on its
     verse. When the reader opens a bookmark that follows and reads on, the
     client moves it to the verse they are reading, only while they stay in
     that book and only in the tab they opened it in (the website writes a move
     at most every 2 seconds, 4 until 2026-11-05 (E45), and `modified` moves
     with it). It is the
     reader's reading, so it makes no undo step. Other clients may choose
     their own rule for when to move it, but must not move a bookmark whose
     `follow` is absent;
   - an optional `from`: how the reader got there (a search, an episode, an
     intro);
   - **`placedAt` and `editedAt`** (audit 3 DI3-3; **BVJ's decision 2,
     2026-11-07, on Claude's recommendation; merge vectors version 5; for
     BDR to review and amend**): two more stamps beside `modified`, in the
     same form. `placedAt` is when the bookmark's **place** last changed
     (`bookKey`, `chapter`, `verse`, `endVerse` and `contentVersion`, the
     text it was read on); `editedAt` when anything else did (`label`,
     `labels`, `follow`, `from`, and any field a client adds). A write
     moves the stamp of each group it touches to the new `modified`; a
     move as the reader reads writes the place and `placedAt` only. Under
     "Clocks": two copies that both carry the stamps merge **by group**, the
     place from the copy whose `placedAt` is later and the rest from the
     copy whose `editedAt` is later, with `modified` and `client` from the
     copy whose `modified` is later; a copy without both stamps merges
     whole by rule a as before, so an app that hasn't adopted them still
     syncs, and gains them on its next write by a client that has. The
     only field-level rule in the format, and confined to this kind. Why: a
     bookmark that moves as the reader reads is written every two seconds,
     so by the whole record a rename, a label, or "Move as I read" turned
     off on another device always lost to the reading device's next move,
     which also turned the switch back on. (Stopping the follower when the
     record changed under it was weighed and would not help: a reading
     device's every write arrives newer than the edit from elsewhere.)

   **At most six bookmarks with `follow: true` on the website** (plain
   bookmarks are unlimited); a client that offers the switch picks its own
   limit. An unknown field is kept (principle 6), so a client that doesn't
   build the switch carries `follow` untouched.

   **A ribbon is a bookmark** (E9, BVJ 2026-10-22; **accepted by BDR,
   2026-10-23; built on the website 2026-11-02**). The feature the website's
   preview first called a ribbon, a `place` with `ribbon: true` and a `name`,
   has been folded into this kind. Any client that meets one reads it as a
   bookmark: the same `id`, `name` becoming `label`, `follow: true` added,
   `ribbon` and `name` dropped, every other field as it was, `modified`
   unchanged (reading isn't an edit). A trash record that holds one is read
   the same way, and its `deletedKind` becomes `bookmark`. Writing a bookmark
   writes the new shape. Only the website's preview ever wrote a ribbon, so
   an app holds none; the merge vectors' `migrate` cases (version 3) cover it
   for a client that wants to. The apps build one kind, Bookmarks, and no
   separate ribbon kind.

   ~~**Open:** whether the apps' `bookmark` marker on a note becomes this.~~
   **Settled 2026-10-23:** a bookmark is its own kind, and the note marker,
   now named `ribbon` (kind 2), stays a note's glyph. **E10, decided by BDR
   2026-10-23:** the note marker is renamed `ribbon` (kind 2's `marker` list
   above says so). Its picture and color stay the same; the red bookmark
   glyph is never called a ribbon. Every client reads an old `bookmark` as
   `ribbon` and writes `ribbon`, as iOS reads an old `star` as `emphasis`.
   (The other option, retiring it, was not taken.)
5. **`place`** (B1): `name` (empty for a book's own "Continue reading"
   place), and a verse. Places are stored as verses, never scroll positions
   (A-F13). **Reading places don't sync in version 1** (BVJ, 2026-10-29;
   maybe in version 2): each device keeps its own. **On the website,
   "Continue reading" and Read View's per-book places are not `place`
   records**: they stay in their own browser storage, and nothing but
   "Continue reading" is listed. **`ribbon: true` retired on 2026-11-02**
   (E9; see kind 4): the website no longer writes a `place` at all, and reads
   an old ribbon as a bookmark. A `place` another client wrote is carried as
   it arrives and isn't listed. If reading places sync in version 2,
   "Continue reading" would be the only `place`, one per book, and no named
   place exists.
6. ~~**`legend`**~~ (H1): **dropped 2026-10-07** (BVJ with BDR; colours carry
   no named meanings). The number is kept so the kinds after it don't move.
   Draft 1 had: the reader's meaning for each of the four colours, one per
   reader.
7. **`markRule`** (H2): a glossary term, a book and a colour, worked out
   from the published alignment on each load.
8. **`label`** (M8): a name, up to 200 characters (the website's
   `LABEL_NAME_MAX`, audit 3 SEC3-4; its form stops at 60). Records list
   the labels on them. The website
   calls them **"Labels"** (recommended, for BVJ to confirm), and keeps names
   unique ignoring case and accents: a new label matching an old one reuses
   it.
9. **`sheet`** (S1–S10, M9, D9): one document the reader builds, for a
   study group, a sermon, a class or anything else. **The website's
   proposal of 2026-10-18 (phase 3b), approved by BVJ the same day.** The apps carry it
   untouched (principle 6, C8); only the website reads or writes it. Its
   shape is under "Sheets (kind 9)" below.
10. **`trash`** (M7): the whole deleted record for 30 days. After that the
    deleted record (`record`) is dropped and the rest is kept indefinitely,
    as a **tombstone**, so a stale backup can't bring a deleted note back
    (A-F10). A tombstone keeps the fields every record carries, `deletedId`,
    `deletedKind` and `deletedAt`; only `record` goes, and dropping it
    leaves `modified` as it was, since the reader changed nothing.
    Deleting means removing the live record and writing this one, never
    flipping a flag on the live record (iOS found flag flips unreliable).
    **For draft 2** (BDR, 2026-10-09, rule c): the 30-day trash and the
    marker kept forever stand, and the record also carries the deleted
    record's **kind**; restoring re-creates the record under the same id.
    The website names the field `deletedKind`, beside `deletedId` and
    `deletedAt` (built 2026-10-12; a trash record written before then takes
    the kind of the record it holds).

    **What a trash record must carry to be read** (audit 8 DI8-6): only
    `id`, `kind`, `modified`, `deletedId` and `deletedAt`. The other common
    fields (`labels`, `client`, `contentVersion`, `created`) are written as
    for any record but not required of a trash record, and `deletedKind` may
    be absent (the kind of the record it holds is taken, as above). Its
    `record`, when present, is checked as a live record of its kind, as the
    next paragraph says.

    **A deletion whose held copy can't be read is kept as its tombstone**
    (audit 3 DI3-4; BVJ's decision 8, 2026-11-07; **for BDR to confirm**).
    When a trash record arrives well formed (`deletedId`, `deletedAt`) but
    the copy it holds fails the receiving client's checks (a marker it
    doesn't know, a body over its limit, a verse out of range), the client
    writes the trash record without `record`, keeping `deletedId`,
    `deletedKind` and `deletedAt`, and tells the reader its words couldn't
    be read, so it can't be restored. Skipping the whole trash record, as the
    website did until then, lost the deletion itself: an older backup, or a
    device that hadn't seen it, brought the record back.

    **Two trash records for one deletion** (two devices each deleted the
    record before they met) **collapse to one. The website's proposal,
    2026-10-12, confirmed by BDR 2026-10-23:**
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

    **Undo and redo on the website** (audit FA1-d, BA7, 2026-10-26; for BDR,
    since a sync would carry what they write). Undoing is the reader acting,
    so every record an undo or redo puts back gets a fresh `modified`, and a
    trash record put back also gets a fresh `deletedAt`: it is the deletion
    made again, and a copy of the notebook saved in between holds the record
    the undo brought back, which an old `deletedAt` would lose to (rule b).
    **A record of a kind or schema the client can't edit is restamped too**
    (Audit 8 DI8-2, BVJ 2026-11-10; **the apps need the same**), on an undo
    or redo and on a restore from the trash: only `modified` and `client`,
    the fields every client reads, and every other field as it was
    (principle 6 is about the fields a client doesn't understand). Left
    unstamped, it was older than its own deletion, so rule b took it away
    again wherever the two copies met.
    **Undoing an add deletes through the trash** rather than removing the
    record outright, so a copy saved before the undo can't bring it back as
    new; a redo removes that trash record again. The apps need only the
    principle: whatever their undo writes must outrank, by rules a and b, the
    change it takes back.

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
| `template` | The template it was started from (`bible-study`, `sermon`, `class`, `lectio-divina`, `swedish`, `contextual`, `blank`, `search` (a sheet of passages made from a search), …). A record of where it came from, read by nothing that changes how it works: once made, every sheet is the same thing |
| `commercial` | `true` when the reader has ticked "This is for a commercial project" (S7), which turns on the commercial-quotation check. Absent or `false` otherwise |
| `isTemplate` | `true` when the record is one of the reader's own templates, not a sheet (added 2026-11-08, Audit 5, section D, #1): "Save as template" made it from a sheet, without the sheet's passages. Absent or `false` otherwise. A client that lists sheets leaves a template out of that list, or lists it apart as a template; a sheet made from it is an ordinary sheet whose `template` is the template's own `template`. A share never carries it |
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
- `minutes`, optional: the leader's planned minutes for the part, a whole
  number from 1 to 240 (added 2026-11-08, Audit 5, section D, #2). The
  leader's alone: the website's presenter view counts it down and the
  leader's version shows the sheet's total; it never prints on the
  participant's copy, never reaches the room's screen, and a participant
  share leaves it out. A client that only shows sheets may ignore it.

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
case it is flagged and left out until the leader decides. A footnote gives a
blank away when it uses the blank's words, or (since 2026-11-08, audit 5's
SH5-16) when it names the traditional word of the term the blank's words
render and the blank's hint does not already show that word: a `hint` of
`"none"`, or a `"custom"` hint without the word. Select all and
Unselect all write a choice for every footnote in the passage. So a
footnote added to the chapter later prints by default, and is still flagged
if it gives a blank away. A choice whose footnote has gone is ignored.

**`text`**: the reader's own words, formatted.

| Field | Meaning |
|---|---|
| `html` | Formatted text, in the sanitized form below |
| `prompt`, optional | Plain text, up to 200 characters, no `<` (added 2026-11-07, SH5-2): what the editor shows dimmed in the part while `html` is empty, or under the part's lone heading while it holds nothing else, until the leader types there |

**A prompt is never part of the sheet's text** (`prompt` here, `prompt` and
`answerPrompt` on a question; added 2026-11-07, Audit 5, SH5-2). It is
plain text, never HTML, and the editor's alone: it is never printed,
copied, saved into a document, presented, or counted (a part holding only
a prompt is empty). A template's parts carry them, so no template holds
text that would print: a template's text part is its heading alone, or
nothing, and its question is empty, each with a prompt saying what goes
there. Since a prompt never prints, it may name the editor's tools ("Add
the passage with + Passage"), which a part's own text never does. A
client that doesn't show prompts keeps the fields whole, as it keeps any
field it doesn't know (principle 6); it needn't write one. A leader share
carries them; a participant share leaves them out (SEC6-3).

A blank-canvas sheet is a sheet whose template is `blank` and starts with
one empty `text` module; everything else about it is the same as any sheet.

**`question`**: a question for discussion.

| Field | Meaning |
|---|---|
| `html` | The question, formatted |
| `answer` | Formatted, may be empty. Always the leader's only, whatever `leaderOnly` says |
| `lines` | Ruled lines to write on beneath it, 0 to 20 |
| `prompt`, `answerPrompt`, optional | Plain text, up to 200 characters each, no `<` (added 2026-11-07): what the editor shows dimmed in the empty question and the empty answer, as a text part's `prompt` |

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
**whatever the sheet's `sheetFormat`**: a sheet in a newer format is shown
read only, but its text is still drawn through the sanitizer, and the
website sanitizes these fields on every sheet it imports (FA1, BA66).
**It sanitizes before it checks** (2026-11-08, DI6-1), on a backup it
opens (a trash record's held sheet too) and on a shared sheet, so text
saved in an older canonical form is rewritten, as editing rewrites it, never
refused; the check that follows still refuses what sanitizing can't mend. The
sanitizer keeps exactly the set below and nothing else; anything else is dropped,
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
| `scope` | `"leader"` (everything) or `"participant"` (no module marked `leaderOnly`, no module of a type the sender doesn't know, every question's `answer` empty, and no module's `minutes`, `prompt` or `answerPrompt`) |
| `contentVersion` | The sheet's own, so the receiver knows which text it was made on |
| `modules` | The sheet's modules, each **without its `id`**, and passages without `verseCopy` and `verseCopyAsOf` |

A participant share leaves out a module of a type the sender doesn't know
(2026-10-27, BA81), as the participant's paper copy does, since the sender
can't tell which of its fields are for the leader. A leader share keeps it
whole, as the editor does. Nothing else of the record travels (its id,
client, times, labels). A
receiver gives every module a fresh id, **drops `verseCopy` and
`verseCopyAsOf` from every module whatever the share holds** (a shared sheet
is never flagged as changed; BA82), and makes the sheet a record of its
own, sanitizes its formatted text, and refuses the share unless that record
then passes the sheet's check (`validateSheet`; DI6-1).
Decompressed data over twice the sheet's 512 KB limit is refused before it
is read whole.

**The file** is Markdown for people: the title, the subtitle, a line saying
how to open it, each part in words (a passage by its reference, never its
text), and on its last line the data, as an HTML comment so a Markdown
viewer shows nothing of it: `<!-- lit-sheet share1.<data> -->`, the same
fragment a link carries. Its name ends `.lit-sheet.md`. A reader takes the
**last** such comment in the file and removes any whitespace inside the data,
since an email client may fold the long line; a comment begun
(`<!-- lit-sheet`) but unreadable is reported as damaged, not as a file with
no sheet. The readable part writes any `<!--` in a sheet's own text as
`&lt;!--`, so a sheet's text can't plant a data line (2026-10-27, BA80,
BA87).

**Opening one** on the website keeps the fragment out of every server's
sight: an inline script at the top of the sheets page's body moves it into
the tab's history entry (`history.state.litSharedSheet`) while the page is
still being parsed, before Cloudflare's analytics beacon (a deferred script)
runs, and the page shows the sheet from there. A link opened in a tab
already on the sheets page is moved the same way on `popstate` and
`hashchange`, by listeners added before the beacon's. A reload finds it again. It is shown read only until the
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

### Anchor text, served

The content API, version 2 (`API-2-FORMAT.md`, under `/api/data/v2/`)
serves each chapter's anchor text ready-made, as `text`, with the verse
spans above and the positions of its blocks, lines, emphasis, footnote
letters and ⟦ ⟧ spans laid over it. Its build checks every chapter's `text`
and verse spans against `chapterAnchorText` and fails on any difference, so
an app that reads version 2 places marks against exactly the characters this
section defines, without parsing the HTML itself. A change to how this
section makes the words means a new API version and folder, never a change
under `/api/data/v2/`. A change only to finding a mark again (as spec 2 was)
touches nothing it serves: its chapter files don't carry this section's
version number, which is information in its `version.json` alone.

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
| `found` | `exact` occurs in the record's verses. If it occurs more than once, take the occurrence whose surroundings agree longest with `prefix` (read backwards) plus `suffix` (read forwards); on a tie, the first. **Only if at least 8 characters agree** (the context floor, below) | The mark, as made |
| `moved` | `exact` occurs elsewhere in the chapter (chosen the same way, with the same floor). **Spec version 4**: the result also says whether the verse the words now begin in lies outside the record's verses while those verses still exist (`outsideVerses`) | The mark, at its new place; **with the change notice when it left the record's verses** (spec version 4, below), silent when it begins inside them or when those verses are gone |
| `changed` | The words are gone, but enough of the context survives inside the record's verses. Take the longest tail of `prefix` and head of `suffix` that still occur in order, at least 8 characters between them, and use the text between. **Only if that text is at most twice `exact`'s length plus 16 characters** (the size limit, below) | The mark on the new words, flagged, with the old words kept: the apps' existing behaviour |
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
  differs. A quoted mark whose words are still found carries none, and
  neither does one whose words moved within its verses (a `moved` that
  left them does, since spec version 4).
- **Keep from `verse`**: a note loses its quote and becomes a note on its
  whole verses; a highlight takes the whole verses as its quote. Keep moves
  `modified` and `contentVersion`, since the reader acted. A record whose
  `contentVersion` can't be ordered against the client's (two publishes on
  one day) is rewritten only once the client knows it has the newest text
  (the website asks `/api/version.json`).

`changed` is the one step BVJ left to the three Claudes (no preference).
Draft 1 adopts the apps' approach over the plan's whole-verse fallback,
because both apps already ship it and tell the reader.

**Rule e's two guards** (BDR, 2026-10-09: "both guards"; built in the
reference 2026-10-26, audit FA1-f, BA8; spec version 2 of the vectors). A
step whose guard fails doesn't succeed, and the next step is tried, so in
the end such a mark falls to `verse`, with the notice:
- **The context floor**: where `exact` occurs more than once in the text
  searched ("Amen."), an occurrence is taken only when at least **8**
  characters of context agree, `prefix` and `suffix` together
  (`MIN_CONTEXT`, the same 8 as `changed`'s floor). A word that occurs once
  needs no context, so an old quote with none is still `found`.
- **The size limit**: a `changed` region may be at most **2 × the length of
  `exact` + 16** characters (`CHANGED_GROWTH`), counted in normalized
  UTF-16 code units. Without it a 12-character quote, “God so loved,”
  resolved to a 68-character region in the audit's reproduction (BA8); the
  vectors' case is 65. Android's own limit is "about twice plus a
  little"; these are the website's numbers, for BDR to match or change.

The vectors carry both numbers (`minContext`, `changedGrowth`) and five cases
for them.

**Spec version 3** (audit 2, FA2-f and FA2-g, DI-1 and DI-2; **proposed by
Claude 2026-11-03, for BVJ's decision 4 and BDR's agreement**). Three
changes to finding a mark again, all in `anchor-core.mjs`:
- **The floor holds for one occurrence too.** A single occurrence of `exact`
  is taken only when `min(8, prefix + suffix length)` characters of context
  agree, so a quote stored with 8 or more characters of context is never
  taken blind (an old quote with less is exempt, as before). Where `exact`
  occurs more than once the floor is still 8.
- **`moved` needs both sides.** Each of `prefix` and `suffix` stored with 4
  or more characters must still agree on at least 4 (`MIN_CONTEXT / 2`),
  on top of the floor. Otherwise a repeated formula elsewhere in the chapter
  satisfied the floor on one side alone. `moved` still carries no notice;
  a move that fails the test falls on to `changed` or `verse`, which do.
- **Typography is folded for matching.** Before comparing, curly and low
  quotes become straight and every hyphen, dash and minus (U+2010 to U+2015,
  U+2212) becomes "-", in the chapter text, `exact`, `prefix` and `suffix`.
  Each is one UTF-16 unit for one, so offsets are unchanged and the range
  returned is in the real text. Nothing stored or drawn is folded.
  A mark made on straight quotes now finds its words in today's curly text
  (22% of marks touching one fell to `verse` before).
Measured by the audit's reword fuzz (one word inside the mark changed): the
share drawn on other words with no notice was 38% for a one-word mark, 15%
for two. `test/anchor-text.test.js` holds a small version of that fuzz.

**Spec version 4** (audit 3, DI3-2; **BVJ's decision 1, 2026-11-07, on
Claude's recommendation; for BDR to review and amend**, together with spec
3). One change, which answers audit 2's open question "should a mark moved
to another verse say so?" with yes:
- **A `moved` that leaves the record's verses carries the change notice.**
  The resolver's `moved` result says whether the verse the words now begin
  in lies outside the record's `verse`..`endVerse` while those verses still
  exist in the chapter (`outsideVerses`, in the vectors' `expected` for
  every `moved` case). When it does, the mark is drawn at the new place and
  the reader is told ("The words you marked are now in verse 15. You marked
  them in verse 27, which still stands with other words"); Keep moves the
  record to the verses its words are in now, with a fresh quote and
  `verseCopy` there. A move that begins inside the record's verses (a verse
  boundary moved across the words), or one whose verses are gone, stays
  silent, as every `moved` did under spec 3.
- Why: run over all 173 chapter revisions in the website's history, `moved`
  landed outside the reader's verses while they still existed 15 times in
  18, each one a repeated formula elsewhere in the chapter capturing a mark
  whose own verse was reworded (Matthew 23 at `ff34f594`: "watch out,
  fakers," reworded in every verse but 15, so marks on it in verses 13, 16,
  23, 25, 27 and 29 were all drawn on verse 15 with no notice). Words that
  legitimately move (a paragraph joined or split) stay in their verse and
  come back as `found`. The stricter alternative (the full stored context
  on both sides for a move out of the verses) would not have caught
  Matthew 23, where verse 15 kept the old formula with its context.
- The vectors' two Matthew 23 cases are resolved against that chapter as
  revision `ff34f594` left it (chapter `matthew-23@ff34f594`), since later
  revisions reworded verse 15 too; the third, with the record's verses
  gone, shows the silent case.

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
record of the old colour, carrying its labels and every field the client
doesn't know (principle 6; audit 2 DI-7). The record that survives a merge
takes the labels of every one it absorbed, so joining highlights never loses
a label. A record that is rewritten
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
and a `modified` in the future is clamped on **every** arrival, not once,
and never beats what the receiving side holds (under "A clock running ahead"
below).
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

**A clock running ahead never beats what a device holds** (audit FA1-c,
2026-10-26; version 2 of the merge vectors; for BDR to confirm). Clamping a
future time to "now" on arrival isn't enough on its own, because "now" moves:
the same export file opened again a day later would beat the edit or the
deletion made in between, every time (BA4). So:
- **The cap** is the receiving side's "now", or, for an export file, the
  file's own `exported` time when that is earlier, since nothing in a file can
  be newer than the file. A sync service's cap is its own clock. The cap is
  written as UTC with a `Z`, whatever form the file's time had (DI-12).
- **Room for skew** (audit 2 DI-8; merge vectors version 4; for BDR to
  confirm): against "now", a time up to **five minutes** ahead still counts as
  now, so an edit from a phone whose clock is seconds fast isn't dropped as
  "from the future". A file's own `exported` time stays exact. A sync that
  drops a record as ahead must not advance its cursor past it. And an edit
  stamps `max(now, the version it replaces + 1 ms)`, so it always outranks
  that version, even on a clock running behind.
  **Every stamp steps past what it replaces, not edits alone** (audit 3
  DI3-1, 2026-11-07; the website's stamps do this now, and **the apps' need
  the same step**, since rules a to c and the vectors don't change): a
  deletion stamps `deletedAt` (and its `modified`) past the record it
  deletes; a restore from the trash stamps `modified` past the deletion it
  undoes as well as past the record's own; and an undo or a redo stamps the
  record it puts back past everything it goes back over (the other version,
  a deletion's `deletedAt`, the copy a deletion holds). Within the five
  minutes of skew this bullet allows, a deletion or a restore made on the
  slower of two clocks was otherwise reversed when the copies met: the
  phone's edit, three minutes ahead, outranked the desktop's later deletion
  under rule b, and the phone's deletion outranked the desktop's later
  restore. Merge vectors
  `b-a-deletion-stamped-past-the-record-it-deletes-stands` and
  `b-a-restore-stamped-past-the-deletion-it-undoes-stands` (each with an
  `-other-way` twin) show the stamps that result.
  **A stamp never steps more than five minutes past the client's own clock**
  (Audit 8 DI8-1, BVJ 2026-11-10; **the apps need the same bound**): when the
  version a stamp would step past is further ahead of the clock than the
  five minutes above, the stamp is plain `now`. Such a version was made by a
  clock that ran ahead (a dead battery, a virtual machine, a misset travel
  clock), and every other copy holds it clamped to when it arrived, so
  stepping past it kept the record "ahead" for ever: its edits, deletion and
  undo were dropped in both directions, and the other side's deletion lost
  to it under rule b. Stamped `now`, the next change outranks the clamped
  copies and the record heals. Rules a to c and the vectors don't change.
- **One trash id, two copies** (DI-3): merged field-wise, as the collapse
  rule does across ids: the later `deletedAt`, the later `modified`, and the
  held record with the later `modified`. A trash record whose held record has
  another id than `deletedId` is skipped and reported.
- **What is clamped**: `modified`, a trash record's `deletedAt`, the
  `modified` of the copy a trash record holds (BA12; a held copy from the
  future would outrank every later one, and an undo would bring back its
  words), and a bookmark's `placedAt` and `editedAt` (version 5).
- **A bookmark merges by group** (audit 3 DI3-3; merge vectors version 5,
  2026-11-07; for BDR to review): where both copies carry `placedAt` and
  `editedAt` (kind 4), the place comes from the later `placedAt`, the rest
  from the later `editedAt`, and `modified` and `client` from the later
  `modified`, each tie settled as rule a settles one (the local copy, or
  the store's tiebreak). Rules b and c read the bookmark's `modified` as
  before. The five `a-bookmark-` and `clamp-a-bookmark-` cases show it,
  including an app's copy without the stamps merging whole.
  **A bookmark held by a deletion merges by group too** (Audit 8 DI8-3;
  merge vectors version 6, 2026-11-10; BVJ's decision, for BDR to review):
  two trash records for one deletion that both hold stamped copies, and a
  live stamped copy meeting a deletion that holds one (rule b, when the
  deletion stands), give the held copy each group's later version, as above.
  Before, the trash kept one whole copy by `modified` alone, so a rename on
  one device and a move on another left the two trashes holding different
  bookmarks, and a restore brought back a different one on each. A tie in
  a group's stamp goes to the copy whose fields in that group sort first as
  canonical JSON (the place: `placedAt` and the place fields; the edit:
  every other field but `modified` and `client`; the whole: `modified` and
  `client`), never to whichever copy arrived, so the trash settles alike in
  any order. Cases `collapse-two-held-copies-of-a-bookmark-merge-by-group`
  and `b-a-deletion-keeps-the-live-bookmark-s-newer-group`.
- **A record that had to be clamped never beats anything the receiving side
  holds**: it is dropped when that side has a record with its id or a
  deletion of it, or, for a trash record, the record it deletes or another
  deletion of it. Only when the receiving side has nothing for it is it
  written, at the cap. Opening the same file again then writes nothing.
- **One id is one record** (BA11): an arriving record whose `kind` differs
  from another copy of its id, on the receiving side or in the same input,
  is skipped and reported, so a trash record can never replace the note it
  shares an id with. So is a trash record whose `deletedId` is its own `id`.

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
  `v3-4` (the fragment without its `#`, as W3C's selector has it, with
  `conformsTo` RFC 3986), `motivation` comes from `kind`, and the LIT fields
  go under `lit`. Sheets and places use this format's own JSON. Markdown is kept for
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
    carrying `<!-- lit:id=… modified=… -->` (its record's `modified`), the
    header `<!-- lit-notebook 1 · saved YYYY-MM-DD HH:MM · <ISO time> -->`,
    ending with the license notice and the link to the terms. A note edited
    in the file comes back as an edit (a bookmark's label too), and a new
    entry with a verse reference becomes a new note; highlights, bookmarks
    and pins can't be made from Markdown, and places and labels aren't read
    back. **Words that differ count as an edit only when the record here is
    no newer than the file's copy of it** (the entry's `modified`, else the
    header's time; a file saved before 2026-10-26 has only the header's
    minute, read as UTC and rounded down, and a file with no time at all is
    taken as the older). Otherwise the words changed here after the copy was
    saved, and they stay, counted as kept here (audit BA1). **An entry whose
    id the notebook holds as trash, or as a tombstone, is left out** and
    reported, never made into a new note, so a stale copy can't bring back a
    note deleted since (BA2, A-F10). On save, a body line starting `#`, `>`
    or `\` takes a backslash, and every `<` becomes `\<` so a Markdown viewer
    shows typed HTML as text (BA41); reading back undoes both.
  Opening a copy merges through `desk-merge.mjs`, in one commit, and never
  deletes a record for being absent from the file (audit C17). The two JSON
  files' `exported` time is the merge's cap (under "Clocks"); a Markdown
  entry whose time is later than now counts as having no time, so the file
  is taken as the older. The website plans the merge again when the reader
  confirms, against the notebook as it is then, and shows the new outcome
  instead of writing if it differs (BA3).

## Still open in this file

- ~~Bookmarks vs the `bookmark` marker (kind 4)~~: **settled 2026-10-23** —
  the marker is renamed `ribbon` (E10, BDR); bookmarks stay their own kind,
  with ribbons folded in (E9, accepted by BDR). **E9 is built on the website
  (2026-11-02)**: kind 4 gained `label` and `follow`, kind 5 lost
  `ribbon: true`, and the merge vectors are version 3.
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
  2026-10-06). **Not in version 1** (BVJ, 2026-10-29; maybe in version
  2). Built provisionally on the website's preview (2026-10-08): the two
  targets under kind 2, the rule against renaming an article silently
  (`src/data/article-slugs.json`), and "Anchor text for prose". They stay
  described here for version 2, and draft 2 doesn't need them. **Website only** unless BDR changes the apps. Until then the apps
  carry these records untouched (principle 6), as they would any target
  they don't know.
- ~~**Notes on a footnote** (M11; kind 2)~~: the fields (`footnote` and `n`,
  as kind 11 has them; built on the preview 2026-10-20) **confirmed by BDR,
  2026-10-23**.
- ~~Whether reading places sync (kind 5)~~: **not in version 1** (BVJ,
  2026-10-29; maybe in version 2). See kind 5.
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
