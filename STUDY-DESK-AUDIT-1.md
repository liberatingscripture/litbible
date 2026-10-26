# Study Desk Full Audit 1 (10/20/2026)

The first full audit of the built Study Desk preview, and the plan for fixing
what it found. **STUDY-DESK.md is the desk's record; this file is the working
plan for one batch of fixes.** STUDY-DESK.md, "Full Audit 1 (10/20/2026)",
points here. Its decision log holds the BVJ calls made along the way.

- **What was audited**: everything behind `?desk=on` at commit `82af6a6` on
  `main` (2026-10-20): phases 1a to 1d, 1f, 1h, 2a to 2c, and 3b to 3k.
- **How**:
  - The full CI run passed: 260 chapters valid, 2,254 unit tests, type check,
    build, and 40,553 internal links.
  - Eight code reviews, one per area, each checked against CLAUDE.md's desk
    rules and STUDY-DESK.md's decisions, with reproductions in Node.
  - Use of the preview in Chromium at 1440 and 1180 wide, in light and dark.
  - Two findings confirmed in a real browser, and one suspicion disproved.
  - Recorded decisions were treated as intended, not as defects.
- **The audit page** is https://claude.ai/artifact/VtA4S94L9MCjV7GqMrFMgL
  (private to BVJ). It has the findings as written on 2026-10-20. This file is
  the newer record: BA32 has been declined since, and the page isn't updated.
- **Totals**: 87 findings, BA1 to BA87. 4 high, 24 medium, 59 low. BA32 is
  declined (below), so **86 are planned**, in 20 phases, FA1-a to FA1-t.
  Two more phases are **the next audit**: FA1-u reviews the code this audit
  didn't reach, and FA1-v checks the desk on real devices. Their findings
  continue the numbering, BA88 onward.

## IDs

- **BA1 to BA87** are the findings ("build audit"). B, C and E were already
  taken in STUDY-DESK.md (places, the 2026-10-01 audit, the fixes log), so
  they weren't reused. Keep these IDs stable; never renumber.
- **FA1-a to FA1-v** are the phases. FA1-u and FA1-v are the follow-up
  audit, whose findings continue as BA88 onward in this file. A later full
  audit would be FA2, with its own file.
- The audit page also gives each finding its reviewer's ID (A-1, F-1, and so
  on). Those are only for tracing back to that page; cite BA numbers.

## How to work a phase on a Pro account

Each phase is sized for **one session**: one area of the code, three to six
findings, and the tests that prove them. Two windows of usage were used up in
about ten minutes each during the audit, by eight Opus agents reading at
once, so these rules keep a session inside one window:

1. **One phase per session**, in a fresh session. Start on a branch named
   `claude/fa1-<letter>` from the latest `main`, and end with one pull
   request naming the BA IDs it fixes.
2. **Read narrowly.** Read this file's phase, the files it names, and the
   CLAUDE.md desk rules it cites ("The Study Desk preview", rules 1 to 23).
   Don't read STUDY-DESK.md in full: `grep -n` for the IDs and decisions the
   phase names.
3. **Subagents only on Sonnet or Haiku** (BVJ, 2026-10-20). Name the model
   when starting one, and never start an Opus subagent. Good uses are
   finding code (Haiku), and writing a finding's tests or checking a fix
   (Sonnet). The session itself works the findings one after another.
4. **Test as you go.** Run the phase's test files (`node --test
   test/<file>.test.js`). Run `npm test` once before committing, and
   `npm run check` if a `.astro` or `.ts` file changed. Run `npm run build`
   only when the phase lists a browser check.
5. **Browser checks**: after `npm run build`, serve `dist/` (for example
   `python3 -m http.server` from `dist/`), open `/?desk=on` once, then the
   page. Cloud sessions have Playwright and Chromium ready.
6. **Stop cleanly.** If a session runs long, stop at a finding boundary,
   mark the rest open here, and push what is done.
7. **Close the loop.** Mark each finding's status here ("Fixed in #NNN").
   Write any BVJ call into STUDY-DESK.md's decision log. Update CLAUDE.md's
   desk rule if behavior it describes changed.

**Calls for BVJ.** A finding marked *BVJ's call* has a recommendation.
Ask BVJ at the start of that phase's session, before building it.

**Line numbers** are as of `82af6a6`. They drift as phases land; search for
the named function if a line has moved.

## The phases

The order puts security and data loss first, then the high finding on /desk,
then the format the apps will build from. Then comes the follow-up audit of
the code this one didn't reach (FA1-u), so what it finds can join the phases
for those areas before they are worked. Then what readers notice, with polish
last, and finally the checks on real devices (FA1-v), which test the fixed
desk. Phases in one area of code follow each other where one depends on
another: FA1-b before FA1-c, FA1-e before FA1-l and FA1-r, and FA1-b to FA1-d
before FA1-f. The table is in working order. FA1-u's letter is out of
sequence only because it was added after the others were lettered; IDs stay
stable.

| Phase | Area | Findings | Status |
|---|---|---|---|
| FA1-a | Security: the stored script and the sanitizer | BA66, BA67, BA59 | done, #370 |
| FA1-b | Markdown copies | BA1, BA2, BA41, BA9, BA10 | done, #371 |
| FA1-c | Merging and opening a copy | BA3, BA4, BA11, BA12 | done, #PRNUM |
| FA1-d | The store, the note editor, and undo | BA5, BA13, BA6, BA7 | open |
| FA1-e | /desk keeps the reader's place | BA51, BA52, BA53, BA55 | open |
| FA1-f | The record format, for BDR | BA8, BA14 | open |
| FA1-u | The follow-up audit: code this audit didn't reach | new findings, BA88 onward | open |
| FA1-g | Sharing a sheet | BA78, BA80, BA81, BA82, BA87 | open |
| FA1-h | Marks on the page | BA16, BA17, BA19, BA20, BA23 | open |
| FA1-i | Sheet templates and passages | BA69, BA70, BA75, BA76, BA77 | open |
| FA1-j | The sheet editor: pasting and saving | BA68, BA71, BA72, BA73, BA74 | open |
| FA1-k | Greek search commands | BA44, BA45, BA48, BA49, BA50 | open |
| FA1-l | /desk's LIT pane and layout | BA54, BA56, BA57, BA58, BA60, BA61 | open |
| FA1-m | The tour, first use, and printing | BA33, BA34, BA35, BA36, BA37 | open |
| FA1-n | Present mode and the sheet page | BA79, BA83, BA84, BA85, BA86 | open |
| FA1-o | Announcements and focus for marks | BA18, BA21, BA22 | open |
| FA1-p | Panels beside the Notebook | BA24, BA27, BA28 | open |
| FA1-q | The gate and first paint | BA25, BA26, BA29, BA30 | open |
| FA1-r | /desk's smaller fixes | BA31, BA62, BA63, BA64, BA65 | open |
| FA1-s | Greek credits and the notebook search | BA40, BA46, BA47 | open |
| FA1-t | Copy and docs | BA15, BA38, BA39, BA42, BA43 | open |
| FA1-v | The follow-up audit: real devices | new findings | open |

**Declined**

- **BA32: the tour offer opens over the scripture's line ends.** At 1440 ×
  900 the offer window (`src/scripts/desk/tour.js`, `float-window.js`) sits
  over the ends of the first verses' lines until answered. **Won't fix:** BVJ
  doesn't mind it opening over scripture (2026-10-20). Recorded so it isn't
  reported again.

Each finding below gives its severity, what happens, where, the fix, and how
to check it. "Seen in the browser" means confirmed in Chromium during the
audit; "reproduced" means in Node.

---

## FA1-a. Security: the stored script and the sanitizer

Files: `src/scripts/desk/sheet-pane.js`, `src/lib/desk-records.mjs`,
`src/lib/desk-export.mjs`, `src/lib/desk-sheet-format.mjs`,
`src/lib/desk-layout.mjs`. Tests: `desk-sheets`, `desk-records`,
`desk-export`, `desk-layout`. CLAUDE.md desk rules 18 and 19.

- **BA66 (high, security; seen in the browser). A sheet in a newer format
  runs its own script when viewed.**
  - *What happens*:
    1. `validateRecord` (`desk-records.mjs:270`) returns before
       `validateSheet` when `canEdit` is false (a newer `sheetFormat` or
       `schema`), so the sheet's formatted text is never sanitized.
    2. `planImport` writes it to the notebook.
    3. The Sheet pane sets `readOnly = !canEdit(record)`
       (`sheet-pane.js:403`).
    4. `readOnlyRich` (`sheet-pane.js:708–711`, called at 702 and 736) does
       `box.innerHTML = html`.
  - *Reproduced 2026-10-20*: a full backup holding one sheet with
    `sheetFormat: 2` and a text part `<img src=x onerror=…>`, opened with
    "Open a copy" on /notebook/, then viewed at `/desk/?sheet=<id>`. The
    script ran on the site's origin, with IndexedDB in reach; the CSP only
    reports.
  - *Ways in*: a backup file someone sends, and later sync. Shared links are
    safe: `sheetFromShared` refuses newer formats.
  - *Fix*: draw read-only text through `sheetHtmlForShow`, as
    `sheet-copy.js:51` does (rule 19: never `innerHTML` of the stored html).
    Also sanitize every sheet's formatted fields on import, whatever its
    format, since the sanitizer's output is safe for any version.
  - *Check*: a test that a newer-format sheet's text comes out of both the
    import and the read-only drawing with no event attribute.
  - Status: fixed in #370.
- **BA67 (medium, security; reproduced). The sanitizer slows down with the
  square of the input on unclosed tags.**
  - *What happens*: when a tag has no closing `>`, or an attribute quote
    never closes, `readTag` (`desk-sheet-format.mjs:124–164`) scans to the
    end and returns null. `tokenize` (192–197) then moves on one character
    and tries again.
  - *Evidence*: 12 KB of `<a ` took 1.3 s and 48 KB took 20.9 s. A
    234-character share link (60 KB inflated) held `openShare` for 33.6 s
    before refusing it. `validateSheet` also keeps sanitizing after
    reporting a sheet over its 512 KB limit (775).
  - *Fix*: when `readTag` fails at the end of the input, treat the rest as
    text and stop scanning. Return before the module loop when the sheet is
    over the limit.
  - *Check*: a test that 48 KB of `<a ` sanitizes in well under a second.
  - Status: fixed in #370.
- **BA59 (low, hardening). Stored pane ids aren't checked.** `checkLayout`
  (`desk-layout.mjs:537`) accepts any string as an id. Ids go into
  `innerHTML` (`passage-bar.js:35–41`, `id="deskPassage-${id}"`) and into
  selectors (`lit-pane.js:327`; `desk-page.js:403, 418`), so an id with `"`
  makes `goTo` throw. Only the reader's own localStorage can set one.
  - *Fix*: accept only ids of the form `nextId` makes (`/^p\d{1,3}$/`).
  - *Check*: add a hostile stored layout to the `checkLayout` tests.
  - Status: fixed in #370.

## FA1-b. Markdown copies

Files: `src/lib/desk-export.mjs`, `src/scripts/desk/export-import.js`,
`STUDY-DESK-FORMAT.md` ("The export file"). Tests: `desk-export`,
`desk-merge`. CLAUDE.md desk rule 13 (save and open a copy; C17, never
delete for absence).

- **BA1 (high, data loss; reproduced). Opening an older Markdown copy undoes
  note edits made since.**
  - *What happens*: in `parseMarkdown`'s known-id branch
    (`desk-export.mjs:380–389`), an entry whose words differ from today's
    note counts as "edited in the file". It is stamped with the current
    time (`editRecord`), so it beats the newer edit. Save a copy on Monday,
    edit on Tuesday, open Monday's file on Wednesday: Tuesday's words are
    replaced, and the summary says only "1 updated."
  - *Why*: the file carries no per-entry time, and the header's "saved
    YYYY-MM-DD HH:MM" isn't read back.
  - *Fix*: write each entry's `modified` into its `<!-- lit:id=… -->`
    comment, and a full ISO time in the header. Treat a difference as an
    edit only when the local record isn't newer than the file's, and list
    the rest as kept here. Say so in STUDY-DESK-FORMAT.md, "The export
    file."
  - *Check*: a test that saves, edits, then opens the older copy; the newer
    words stay.
  - Status: fixed in #371.
- **BA2 (high, data loss; reproduced). An older Markdown copy brings back
  notes deleted since.**
  - *What happens*: the entry's id now belongs to a trash record, so
    `parseMarkdown` makes a new note with that id, stamped now
    (`createRecord(..., { id })`). Under merge rule b that is an edit after
    the deletion, so the note returns and its trash record is removed. Past
    30 days the tombstone doesn't stop it either. The revived note has lost
    its created time, labels, `verseCopy` and quote context. This breaks
    A-F10: a stale copy must never bring back a deleted note.
  - *Fix*: before making a note from an entry with an id, look for a trash
    record or tombstone with `deletedId === id`. Skip it with a line in the
    summary ("deleted here since this copy was saved"), and never reuse an
    id the notebook holds as trash.
  - *Check*: a test with a trash record and the older file.
  - Status: fixed in #371.
- **BA41 (low; seen in the browser). The Markdown copy writes the reader's
  words unescaped.**
  - *What happens*: lines starting `#`, `>`, `\` or `<!--` are already
    escaped, but HTML inside a line is not. A note containing `<b>` and
    `<img src=x …>` went into the `.md` file as typed, so a Markdown viewer
    renders it as HTML (bold, or a fetched image).
  - *Fix*: escape `<` in note text on export, and undo it when reading back.
  - *Check*: keep the round-trip test passing, with a note holding `<b>`.
  - Status: fixed in #371.
- **BA9 (low; reproduced). Some malformed files fail silently.**
  - *What happens*: two cases throw where the change handler has no catch
    (`export-import.js:147–164`), so the reader sees nothing happen:
    - `{"type":"AnnotationCollection","first":{"items":"abc"}}` throws
      `items.forEach is not a function` (`desk-export.mjs:507–511`).
    - A deeply nested field on a record whose id is already local makes
      `planImport` throw a `RangeError` from `canonical`.
  - *Fix*: guard with `Array.isArray`, and catch around reading and planning
    with “That file couldn’t be read.”
  - Status: fixed in #371.
- **BA10 (low, perf; reproduced). Reading a large Markdown file slows down
  with the square of its size.**
  - *What happens*: `lines.slice(i + 1).find(...)` runs for every heading
    (`desk-export.mjs:324`). 8,000 entries took 0.8 s, 32,000 took 11.2 s,
    and 80,000 bare headings took 11.9 s, with the tab frozen.
  - *Fix*: scan forward with an index. Consider a size limit on the chosen
    file.
  - Status: fixed in #371. No size limit was added: reading is linear
    now, and 80,000 headings read in about 60 ms.

## FA1-c. Merging and opening a copy

Files: `src/lib/desk-merge.mjs`, `src/lib/desk-export.mjs`,
`src/scripts/desk/export-import.js`, `test/fixtures/merge-vectors.json`.
Tests: `desk-merge`, `desk-export`. The merge rules (STUDY-DESK.md, "When
notes collide: rules a to e"; STUDY-DESK-FORMAT.md, "Clocks") are shared
with the apps: a change to a rule changes the vectors, and BDR hears of it
in FA1-f.

- **BA3 (medium, data loss). “Open this copy” writes a plan made when the
  file was chosen.**
  - *What happens*: the plan is made from `store.all()` when the file is
    picked, and written whenever the button is pressed
    (`export-import.js:158–163, 226–229`). The result panel stays open
    indefinitely. Anything edited or deleted in between, in this tab,
    another tab or by Keep, is overwritten or brought back.
  - *Fix*: when the button is pressed, re-read the notebook and plan again.
    If the summary changed, show it again before writing.
  - Status: fixed in #PRNUM. `planOpen` reads and plans the file; Open runs
    it again and writes only if `sameOpen` (the summary sentence and the
    clock note) matches what is on screen, else it shows the new outcome
    with a line saying the notebook changed.
- **BA4 (medium, data loss; reproduced). A file from a fast clock wins
  again every time it is opened.**
  - *What happens*: future times are clamped to now at each merge
    (`desk-merge.mjs:21–25, 124–130, 206`), not once. So re-opening the
    same file beats yesterday's edit and brings back today's deletion. That
    breaks the module's own promise that merging twice writes nothing the
    second time.
  - *Fix*: clamp to no later than the file's own `exported` time (itself
    clamped), and don't let a clamped record beat a local copy. Report
    records that came from a clock running ahead.
  - Status: fixed in #PRNUM. A clamped record is dropped when the notebook
    has its id, a deletion of it, or (for a trash record) what it deletes or
    another deletion of it, so it also never deletes a record here. The
    Markdown path had the same fault through the file's time, now read as no
    time when later than now. The merge vectors are version 2: two clamp
    cases lost their local record to new cases, for BDR in FA1-f
    (STUDY-DESK-FORMAT.md, "Clocks").
- **BA11 (low, data loss; reproduced). A record of another kind with the
  same id replaces a live one.**
  - *What happens*: merge rule a matches by id alone
    (`desk-merge.mjs:142–150, 215–218`). An incoming trash record whose own
    id equals a live note's id replaces the note. The summary then counts
    nothing and says "Nothing to open in this file." beside an active "Open
    this copy" (`desk-export.mjs:576–581, 610`).
  - *Fix*: treat a change of kind under one id as malformed, skipped and
    reported. Make the summary count every write the plan makes.
  - Status: fixed in #PRNUM. Kinds clashing within one file are skipped too,
    and a trash record naming itself. The summary counts from the writes,
    with a new "changes in the trash" for trash-only writes.
- **BA12 (low; reproduced). The copy held inside a trash record isn't
  clamped.**
  - *What happens*: a held copy dated 2099 beats the live copy and every
    later deletion's copy (`desk-merge.mjs:124–130, 171–178, 239`), so Undo
    would restore the wrong words.
  - *Fix*: clamp `record.modified` inside trash records too.
  - Status: fixed in #PRNUM, and by BA4's rule a clamped held copy never
    replaces the words a trash record here holds.

## FA1-d. The store, the note editor, and undo

Files: `src/scripts/desk/store.js`, `src/scripts/desk/note-editor.js`,
`src/lib/desk-history.mjs`, `src/lib/desk-store-core.mjs`. Tests:
`desk-store-core`, `desk-history`, `desk-merge`. CLAUDE.md desk rule 11.
Browser check: edit a note in one tab while another tab changes it.

- **BA5 (medium, data loss; likely). A write that fails partway can leave
  half of it saved.**
  - *What happens*: `store.apply` (`store.js:132–140`) queues its gets, puts
    and deletes with no try/catch. Under the IndexedDB spec, a request that
    throws outside a callback doesn't abort the transaction, so earlier
    requests still commit. One trigger is a structured-clone `RangeError`
    on a deeply nested field that passed `validateRecord`. There is then no
    history entry, and the import says "Nothing was changed."
  - *Fix*: `try { … } catch (e) { tx.abort(); throw e; }`. Refuse records
    nested beyond a sane depth in `planImport`.
  - Status: open.
- **BA13 (low; possible). Deleting, undo, and the purge read and write in
  separate transactions.**
  - *What happens*: `remove` (`store.js:213–217`), `undo` (220–228) and the
    purge at open (268) each read in one transaction and write in another.
    An edit from another tab in that gap is deleted, and the trash holds the
    copy from before it. A restore during the purge leaves a tombstone
    beside the live record.
  - *Fix*: read and write in one readwrite transaction.
  - Status: open.
- **BA6 (medium, data loss). The note editor saves over changes made while
  it's open.**
  - *What happens*: the editor saves `editRecord(record, { body, marker })`
    of the copy it opened with (`note-editor.js:47, 116–118, 167–168`).
    Changes made meanwhile are overwritten: labels added on the notebook
    page, Keep's new quote and `verseCopy`, or an import. A note deleted
    meanwhile comes back while its trash record stays. Rule 11's overtaken
    check covers undo only.
  - *Fix*: re-read the note on Save. If it is gone, or anything besides the
    words and the marker changed, say “This note was changed in another
    tab” rather than writing. Otherwise apply the words and the marker to
    the fresh copy.
  - Status: open.
- **BA7 (medium; reproduced). Undo and redo leave states that a later merge
  misreads.**
  - *What happens*: in `restamped`/`planFor` (`desk-history.mjs:125–138`):
    - Redoing a deletion puts back the trash record with its original
      `deletedAt`, so a backup taken between the undo and the redo brings
      the note back.
    - Undoing an add removes the record with no trash record, so a backup
      brings it back as new.

    Phase 4's sync would carry both mistakes to other devices.
  - *Fix*: redo a deletion with a fresh `deletedAt`. Undo an add through
    `planDelete`, so a trash record is written. Compare entries ignoring
    `deletedAt`, as they already ignore `modified` and `client`. Tell BDR in
    FA1-f.
  - Status: open.

## FA1-e. /desk keeps the reader's place

Files: `src/scripts/desk/desk-page.js`, `src/scripts/desk/lit-pane.js`,
`src/lib/desk-layout.mjs`. Tests: `desk-layout`, `desk-passage`. CLAUDE.md
desk rule 18; STUDY-DESK.md, D9 and the 3c to 3g decision log entries.
Browser check required.

- **BA51 (high; seen in the browser). Closing, adding, moving or switching a
  pane loses the reader's place.**
  - *What happens*: `draw()` (`desk-page.js:467–494`) moves every pane
    element into new split boxes and calls
    `panesBox.replaceChildren(tree, drop)`. Each scroller leaves the
    document, its `scrollTop` resets, and nothing restores it.
  - *Seen 2026-10-20*: with the LIT pane at John 3, closing My Notes left
    the picker saying "John 3" while the pane showed John 2 from verse 1.
    The reader's next scroll reports that place (`readerMoved`), and This
    verse, My Notes and Footnotes follow it there. My Notes, Greek, Sheet
    and This verse lose their scroll too.
  - *Fix*: keep pane elements in place on a redraw where possible.
    Otherwise record each scroller's position before `draw()` and restore it
    after; for a LIT pane, `goTo` its own passage with `{ force: true }`.
  - *Check*: in a browser, with the LIT pane partway into a book, close,
    add, move and switch panes.
  - Status: open.
- **BA52 (medium; reproduced). A second LIT pane follows the first until its
  reader scrolls it.**
  - *What happens*: a new LIT pane has no `at`, so `litPlace` falls back to
    `layout.place`, and `follow()` moves it along with the active pane
    (`desk-layout.mjs:304–305, 339–348, 388–392`; `desk-page.js:353,
    380–390`). This survives a reload, since no `at` is saved. It
    contradicts rule 18's “each LIT pane keeps where its reader is.”
  - *Fix*: give a LIT pane `at = litPlace(…)` when it is made (`setKind`,
    `applyArrangement`, `splitPane`), or on mount through `setLitAt`.
  - Status: open.
- **BA53 (medium; BVJ's call). “Make this my default” saves the passage
  too.**
  - *What happens*: the default stores `place`, each LIT pane's `at`,
    `pin.at` and `sheet` (`desk-page.js:205–212, 272–277`;
    `desk-layout.mjs:582–585`). Opening with My default returns to where it
    was made, ignoring the last visit and Continue reading. D9's answer 2
    describes the default as a layout.
  - *Recommended*: open with the default's arrangement and the last visit's
    places, or Continue reading's.
  - Status: open.
- **BA55 (medium; reproduced). “Reset to the original layout” sends every
  pane to Matthew 1:1.**
  - *What happens*: `originalLayout()` has no `place`, so `passageOf` falls
    through to `startingPassage(null)` (`desk-page.js:278–282`;
    `desk-layout.mjs:178–190`).
  - *Fix*: `commit({ ...originalLayout(), place: layout.place })`, carrying
    the active LIT pane's `at` into p1.
  - Status: open.

## FA1-f. The record format, for BDR

Files: `src/lib/anchor-core.mjs`, `scripts/lib/anchor-text.mjs`,
`scripts/build-anchor-vectors.mjs`, `test/fixtures/anchor-vectors.json`,
`STUDY-DESK-FORMAT.md`, `src/lib/desk-merge.mjs` (its header). Tests:
`anchor-text`, `desk-anchor-dom`.

Do this after FA1-b to FA1-d, so the format describes what they changed.
It should land before the format freeze, which Android asked for before
Christmas. After it, add a line to STUDY-DESK.md for BDR.

- **BA8 (medium; reproduced). Rule e's size guard, agreed with BDR, isn't in
  the reference code.**
  - *What happens*: BDR answered "both guards" for rule e (STUDY-DESK.md,
    "When notes collide: rules a to e"). `textBetweenContext`
    (`anchor-core.mjs:202–225`) has the 8-character context floor, but:
    - nothing limits how much text a `changed` mark may take: a 12-character
      quote, “God so loved,” resolved to a 68-character region;
    - there is no context floor when choosing among repeated `found` words.

    The format lists both guards for draft 2 (`STUDY-DESK-FORMAT.md:556–560`)
    without saying the reference lacks them, and the apps build from it.
  - *Fix*: add the size limit (about twice the original, plus a little, as
    Android does) and the repeat-context floor, falling back to `verse`.
    Add vectors for both. `npm run build:anchor-vectors` needs full git
    history, so fetch more first (`git fetch --depth=1000 origin main`).
    Bump `ANCHOR_SPEC_VERSION`. If BVJ would rather wait, mark both guards
    in the format as not yet built instead.
  - Status: open.
- **BA14 (low, docs). The format and the code disagree in seven places.**
  - *What happens*: the format says one thing and the code does another:
    1. Times must end in `Z` (`validateRecord`, `desk-records.mjs:250`), but
       the format says only “ISO 8601, UTC.” An app writing `+00:00` would
       have every record skipped. Say `Z`, and how many fraction digits.
    2. Tombstones (kind 10, about line 150) keep `deletedKind` and the
       common fields, not only `deletedId` and `deletedAt`.
    3. The FragmentSelector is `v3-4`, not `#v3-4` (about line 655). The code
       is right under W3C.
    4. Markdown also escapes `\` (about line 683).
    5. The hidden passage's field for the note to self isn't named. The
       export reads `body ?? note`.
    6. Clamping happens at every merge, not once. State the rule as FA1-c
       leaves it.
    7. The format's status lines (3–4) and `desk-merge.mjs`'s header still
       say nothing uses the merge.
  - *Also*: describe FA1-b's per-entry `modified` and FA1-d's undo and trash
    behavior (BA7).
  - Status: open.

## FA1-g. Sharing a sheet

Files: `src/lib/desk-sheet-share.mjs`, `src/pages/sheets.astro` (its inline
script), `STUDY-DESK-FORMAT.md` ("Sharing a sheet"). Tests:
`desk-sheet-share`. CLAUDE.md desk rule 21.

- **BA78 (medium, privacy; possible). A shared link opened in a tab already
  on /sheets/ may reach the analytics beacon.**
  - *What happens*: the inline script (`sheets.astro:41–56`) moves the
    `#share1.` fragment out of the address on first load and on
    `hashchange`. But a fragment-only navigation fires `popstate` first, and
    the 2026-10-20 beacon check covered only first load.
  - *Fix*: run the same move on `popstate`, registered at the same point.
  - *Check*: on the deployed site, since the beacon is added at deploy:
    paste a share link into a tab already on /sheets/ and watch the
    beacon's request.
  - Status: open.
- **BA80 (low, security; reproduced). A `.lit-sheet.md` file opens the first
  data line in it, and a sheet's own text can plant one.**
  - *What happens*: the data regex isn't anchored to the last line
    (`fragmentInFile`, `desk-sheet-share.mjs:46, 263–265`). `plainText`
    (182–197, 213–216) turns `&lt;!--` back into `<!--`, so a text part
    reading `<!-- lit-sheet share1.… -->` lands ahead of the real data line.
    The file then opens as a different sheet than the one it shows, and
    that passes from leader to leader.
  - *Fix*: take the last match, or require it on the final non-empty line.
    Escape `<!--` in the readable part.
  - Status: open.
- **BA81 (low; reproduced). A participant share keeps parts of unknown types
  whole, answers included.**
  - *What happens*: `plainModule` empties `answer` only on question parts
    (`desk-sheet-share.mjs:134–139, 150–152`). A part of a type this version
    doesn't know, which sheetFormat 1 allows, travels with every field.
  - *Fix*: leave unknown types out of a participant share. Paper copies
    already skip them (`modulesForCopy`). Say so in the format's “Sharing a
    sheet,” for BDR.
  - Status: open.
- **BA82 (low; reproduced). A crafted share can raise a false “wording
  changed” notice after Copy into my desk.**
  - *What happens*: `sheetFromShared` drops only `id` (298–302), and
    `copyOfShared` spreads every module field (323–331). So `verseCopy` and
    `verseCopyAsOf` survive, though STUDY-DESK.md says a shared sheet is
    never flagged.
  - *Fix*: strip the `DROP` fields in `sheetFromShared`, as `plainModule`
    does.
  - Status: open.
- **BA87 (low, copy; reproduced). A file whose data line was wrapped by
  email says it doesn't hold a shared sheet.**
  - *What happens*: a folded line gives null, so the “no-data” message
    (`desk-sheet-share.mjs:46, 120`).
  - *Fix*: allow whitespace inside the data and remove it, or report
    “damaged… Ask for it again” when a `<!-- lit-sheet` opener is there but
    can't be read.
  - Status: open.

## FA1-h. Marks on the page

Files: `src/scripts/desk/actions.js`, `footnote-notes.js`, `pins.js`,
`notes-margin.js`, `tab-verse.js`, `src/lib/desk-chains.mjs`,
`src/scripts/chapter-tools.js` (`selectionShare`), `src/styles/desk.css`.
Tests: `desk-chains`, `desk-notes`. CLAUDE.md desk rules 6, 7 and 23.
Browser check: Romans 8.

- **BA16 (medium). A quick second press of Bookmark saves two bookmarks.**
  - *What happens*: the button shows “Bookmarked ✓” for 700 ms and stays
    live, and `existing` isn't set after the save (`actions.js:107–137`;
    `store.js:190–194` doesn't deduplicate). A click before
    `store.byChapter` has filled `existing` does the same. “Remove
    bookmark” then removes one record and says “Removed ✓,” but the red
    mark stays.
  - *Fix*: disable the button on the first press and set `existing` to the
    saved record. Remove every bookmark on that verse.
  - Status: open.
- **BA17 (medium, privacy). Hide my notes doesn't hide notes on a
  footnote.**
  - *What happens*: with H pressed to share a screen, opening a footnote
    still lists the reader's notes on it in the popover.
    `footnoteNotes` (`footnote-notes.js:261–274`, called from `pins.js:348`)
    checks no setting, and no CSS hides it. M1 promises to hide every note,
    highlight and mark.
  - *Fix*: `html[data-desk-notes="off"] .desk-fnn { display: none }`, or
    check the setting and redraw on `SETTINGS_EVENT`.
  - Status: open.
- **BA19 (low). With My notes off, going to a note marks nothing.**
  - *What happens*: the 2026-10-07 decision (the margin switch, item 7) says
    that with notes hidden the words are marked and focus lands on the note.
    Instead `syncLit` lights words only while notes are on
    (`notes-margin.js:450`), so `reveal` (603–629) scrolls, lights nothing,
    and leaves focus in the panel.
  - *Fix*: let ids in `flash` light their words whatever the setting.
  - Status: open.
- **BA20 (low; reproduced). Two places treat a note on a footnote as a note
  on its verse.**
  - *What happens*: rule 23 asks every reader of a note's verse to check
    `onFootnote` first. Two don't:
    - This verse says “Mentioned in your note on Romans 8:3”
      (`tab-verse.js:207`, `recordReference`) where it should name the
      footnote (`recordWhere`).
    - `notesCiting` (`desk-chains.mjs:69–74, 102`) drops a footnote note
      that cites its own verse (`sitsOn`), so it is never listed.
  - *Fix*: use `recordWhere` in This verse, and skip the `sitsOn` exclusion
    when `onFootnote(record)`.
  - Status: open.
- **BA23 (low; seen in the browser). A drag that ends over a desk window
  saves the note on the rest of the chapter.**
  - *What happens*: a selection dragged onto the tour offer or the Notebook
    runs to the end of the page, so “Add a note” saved Romans 8:2–39. The
    editor's quote is cut off with “…”, so only the small reference line
    shows it.
  - *Fix*: when the selection's end lies outside the text, end it at the
    last verse the pointer crossed, or don't offer the panel. Otherwise ask
    before making a note on more than a few verses. Settle which in the
    session.
  - Status: open.

## FA1-i. Sheet templates and passages

Files: `src/scripts/desk/sheet-pane.js`, `src/lib/desk-sheet-templates.mjs`,
`src/lib/desk-sheet-lit.mjs`. Tests: `desk-sheet-templates`,
`desk-sheet-lit`, `desk-sheets`. CLAUDE.md desk rule 21. Browser check: a
new Bible study sheet, then a passage from the LIT pane's verse menu, then
the participant copy and present mode.

- **BA69 (medium; seen in the browser; BVJ's call). The first passage added
  to a new template lands after “Closing.”**
  - *What happens*: `insertIndex` (`sheet-pane.js:181`) puts a new part
    after the part last worked in, else at the end, and a freshly applied
    template has none. Seen: Bible study, then “Add to ‘Untitled sheet’”
    from the LIT pane, put Romans 8:28 last. Rule 21's intent is that a
    passage “lands inside a template, not after it.”
  - *Recommended*: when a template is applied, treat its Reading (or Read)
    part as the part last worked in.
  - Status: open.
- **BA70 (low; seen in the browser; BVJ's call). Template instructions print
  and go up on the room's screen.**
  - *What happens*: “Add the passage with + Passage, or from the LIT pane’s
    verse numbers.” and its siblings (`desk-sheet-templates.mjs:49, 67, 75`)
    are ordinary sheet text. One printed on the participant copy and showed
    as a screen in present mode.
  - *Recommended*: remove the instruction when the first passage is added
    under it, which needs no format change. The other choice is a hint that
    only the editor shows.
  - Status: open.
- **BA75 (low, a11y). “Already on the sheet” is never seen, and is
  overwritten for screen readers.**
  - *What happens*: the notice goes only to the live region
    (`sheet-pane.js:191–197`), and the “X added.” that follows replaces it.
    STUDY-DESK.md (3f) says adding one again “says so.”
  - *Fix*: one visible message, such as “John 3:16 added again; it was
    already on the sheet.”
  - Status: open.
- **BA76 (low; reproduced). C15's check ignores blanks of words under four
  letters.**
  - *What happens*: `telltaleStems` skips words under `MIN_LETTERS = 4`
    (`desk-sheet-lit.mjs:211–226`). A blank on “God,” “joy,” “law,” “sin”
    or “Son” isn't flagged when the footnote uses the word, so the note
    prints and gives the answer away. Key-term blanks are unaffected.
  - *Fix*: compare a short blank whole against the note's words, with case
    and accents folded.
  - Status: open.
- **BA77 (low, copy). The Class session template says “the leader copy.”**
  It should read “An answer for the leader’s copy.”
  (`desk-sheet-templates.mjs:69`). Templates must stay in the sanitizer's
  canonical form; the test checks.
  - Status: open.

## FA1-j. The sheet editor: pasting and saving

Files: `src/lib/desk-sheet-format.mjs`, `src/scripts/desk/sheet-text.js`,
`sheet-pane.js`, `history.js`. Tests: `desk-sheets` (the sanitizer tests).
Browser check: paste from Google Docs, a web page and Word if one is at
hand.

- **BA68 (medium; reproduced). Pasting from Google Docs makes everything
  bold and one paragraph.**
  - *What happens*: Docs wraps a copy in
    `<b style="font-weight:normal" id="docs-internal-guid-…">`. `RENAMED`
    (`desk-sheet-format.mjs:75`) turns it into `<strong>`, `toInline`
    (365–395) flattens every heading and list inside it into `<br>` lines,
    and `singleParagraphInner` (`sheet-text.js:984–993`) inserts the result
    inline. A paste wrapped in a `<div>` (web pages, webmail, Word's
    `WordSection1`) loses its headings and lists the same way.
  - *Fix*: unwrap a `b` whose style sets the weight to normal or 400. Treat
    a `div` holding blocks as transparent, instead of renaming it `p`.
  - *Check*: tests with real-shaped clipboard HTML.
  - Status: open.
- **BA71 (low). Word lists paste as paragraphs starting with “·” and
  spaces.** Word marks list items as `MsoListParagraph` paragraphs, with
  the bullet in `mso-list:Ignore` spans.
  - *Fix*: drop those spans, and rebuild runs of `MsoListParagraph*`
    paragraphs as `ul` or `ol`.
  - Status: open.
- **BA72 (low, data loss). The last half-second of typing is lost when the
  tab closes.**
  - *What happens*: text saves 400 ms after the last keystroke, and the
    title and subtitle after 500 ms (`sheet-text.js:199–204, 1003–1007`;
    `sheet-pane.js:455–466`). Nothing saves on `pagehide`.
  - *Fix*: call `flushAll` on `pagehide` and on `visibilitychange` to hidden,
    starting the store write synchronously.
  - Status: open.
- **BA73 (low; likely). Dropping rich text skips the sanitizer until
  saved.**
  - *What happens*: the drop handler (`sheet-text.js:995–1001`) cancels file
    drops only. Dragged HTML shows its colors, fonts and images, which then
    disappear on reload.
  - *Fix*: on drop, take `text/html` or `text/plain` through the paste path.
  - Status: open.
- **BA74 (low). Ctrl+Z on the formatting toolbar undoes the saved text but
  not the screen.**
  - *What happens*: `owningUndo` (`history.js:46–61`) covers fields and
    contenteditable only, so with focus on a toolbar button the desk's undo
    reverts the stored text. `draw()` (`sheet-pane.js:506–507`) skips a card
    that has focus, so the editor still shows the newer words. The next
    keystroke silently cancels the undo, and a reload shows different text.
  - *Fix*: treat the whole `.desk-rich-editor` as owning undo, or redraw the
    editor when an undo targets it.
  - Status: open.

## FA1-k. Greek search commands

Files: `src/lib/greek-query.mjs`, `src/scripts/search-core.js` (the Greek
functions). Tests: `greek-query`, `greek-search`. CLAUDE.md desk rules 15 and
17; STUDY-DESK.md, “Greek search commands” and E5. Run queries against the
committed `public/greek/search/`, which a small harness can read from disk.

- **BA44 (medium, perf; reproduced). A broad construction search can freeze
  the tab.**
  - *What happens*: `matchConstruction`'s `walk`
    (`greek-query.mjs:421–463`) explores every combination of later-term
    words on the main thread (`search-core.js:1674`). With `~v` and `&` it
    grows exponentially:

    | Query | Time |
    |---|---|
    | `*.art` ×5 with `~v &` | 0.7 s |
    | `*.art` ×6 with `~v &` | 3.0 s |
    | `*.art` ×7 with `~v &` | 16.5 s |
    | `*.sg` ×4 with `~v &` | 11.4 s |
    | `*.sg` ×5 with `~v &` | over 120 s |
    | `*.sg` ×5 with `~v` (ordered) | 4.1 s |

    The tray searches 120 ms after typing stops.
  - *Fix*: mark reachable words with a forward and a backward pass, or
    memoize by term and word, instead of walking every path. Cap the terms
    at four, with an error sentence.
  - *Check*: `*.sg` ×5 with `~v &` finishes in under a second.
  - Status: open.
- **BA45 (medium; reproduced; BVJ's call). English glosses containing a
  command word are read as commands.**
  - *What happens*: `isCommandQuery` (`greek-query.mjs:204–211`) takes these
    as commands, and `searchGreekAuto` (`search-core.js:1713–1728`) never
    falls back. So 111 of 4,829 multi-word glosses can't be found:
    - “in the middle” (μέσος) errors;
    - “present time” returns 40 wrong verses;
    - “perfect love” finds perfect-tense words near “love”;
    - “next day” names “next” as an unknown Greek word;
    - “the present age,” “righteous act,” “pass through,” “in order to” and
      “forever and ever” fail too.

    The decision log lists this case as not settled.
  - *Recommended*: when a command of two or three plain words errors or
    finds nothing, try the gloss search and show it if it finds a lemma.
  - Status: open.
- **BA48 (low; reproduced). A filter with no word before it is silently
  dropped.**
  - *What happens*: `.gen`, `.gen/dat` and `.gen.dat` give no terms and no
    error (`greek-query.mjs:290–315`). The tray shows nothing, /search says
    “Type a search.”, and the tab says “Type a search, like πίστις.gen…”
  - *Fix*: read a leading filter as `*.` plus the filter, or say “‘.gen’
    needs a word before it, like πίστις.gen or *.gen.”
  - Status: open.
- **BA49 (low, perf; reproduced). `*.sg` downloads nearly the whole parse
  index.**
  - *What happens*: parse groups are split by part of speech and case, or
    tense and mood, which number, gender and person can't narrow
    (`groupsForFilters`, `greek-query.mjs:383–407`). So `*.sg` fetches 54 of
    57 files.
  - *Fix*: accept this and note it, or require a part of speech or case
    with those filters (an error sentence like `bareAny`'s).
  - Status: open.
- **BA50 (low, copy; reproduced). The readback's “then” drops the distance
  and implies an order.**
  - *What happens*: `*.art, *.art, *.art ~v &` reads “Articles, with an
    article anywhere in the verse, in either order, then an article”
    (`describeGreekQuery`, `greek-query.mjs:486–491`).
  - *Fix*: repeat the distance for each later term, and drop “then” when the
    order is free.
  - Status: open.

## FA1-l. /desk's LIT pane and layout

Files: `src/scripts/desk/lit-pane.js`, `desk-page.js`, `src/lib/desk-layout.mjs`,
`src/styles/desk.css` (the LIT pane section). Tests: `desk-layout`. CLAUDE.md
desk rule 18. Browser check: resize the window and drag a split with the LIT
pane deep in a book. After FA1-e.

- **BA54 (medium; likely). Resizing the window or a split line drifts the
  reading line, possibly by chapters.**
  - *What happens*: scroll anchoring is off in the pane
    (`overflow-anchor: none`, `desk.css:5074`). The pane holds its line only
    when a chapter loads above (`hold`). The ResizeObserver
    (`lit-pane.js:439–440`) only calls `fill()`. A width change reflows
    every loaded chapter above the reader while `scrollTop` stays the same.
  - *Fix*: around a reflow, measure the verse at the reading line and
    restore it, as `hold()` does.
  - Status: open.
- **BA56 (low). A chapter above that fails to load gives no message and no
  Try again.**
  - *What happens*: `lit-pane.js:308–318` gives up silently. At `scrollTop` 0
    nothing retries, because no scroll event fires. Chapters below already
    show both (295–300).
  - *Fix*: mirror the case below.
  - Status: open.
- **BA57 (low; likely). The end of the New Testament can't reach the
  reading line in a tall pane.**
  - *What happens*: the 40vh of space below the text (`desk.css:5087–5088`)
    is less than the 75% of the scroller a full-height pane needs (`LINE =
    0.25`, `lit-pane.js:61`). So the Revelation stub never becomes the place
    by scrolling, and Revelation 22's last lines won't reach the line once
    it is published.
  - *Fix*: size the space below from the scroller, `clientHeight × (1 −
    LINE)`.
  - Status: open.
- **BA58 (low; reproduced). A stored layout whose sizes overflow fills 40%
  of the page.**
  - *What happens*: `checkLayout` accepts `[1e308, 1e308]`
    (`desk-layout.mjs:550–553`). `normalize` makes that `[0, 0]`, `fitSizes`
    raises it to a sum of 0.40 (161–162), and the line can't be dragged.
    Only a corrupted or hand-edited key does this.
  - *Fix*: reject a sum that isn't finite and above zero, and fall back to
    even sizes.
  - Status: open.
- **BA60 (low; reproduced). `/desk/?sheet=` can make a layout too wide for
  the window.**
  - *What happens*: `showSheet` (`desk-layout.mjs:373–385`;
    `desk-page.js:776–789`) adds a column without checking `needs`. Three
    columns need 852px, so a narrower window scrolls sideways.
  - *Fix*: check `needs`, and if the layout won't fit, show the sheet in an
    existing pane that isn't a LIT pane.
  - Status: open.
- **BA61 (low). Narrowing the window rewrites the reader's pane sizes for
  good.**
  - *What happens*: the sizes squeezed to fit the narrow window replace the
    reader's and are saved on the next change (`desk-page.js:643–646,
    763–768`). `fitSizes`'s own comment says the layout's sizes are left
    alone (`desk-layout.mjs:477–484`).
  - *Fix*: keep the reader's sizes in the layout, and fit only what is
    drawn.
  - Status: open.

## FA1-m. The tour, first use, and printing

Files: `src/scripts/desk/tour.js`, `panel.js`, `margin.js`, `first-use.js`,
`tab-mine.js`, `commands.js`, `print-notes.js`, `print-room.js`. Tests:
`desk-first-use`, `desk-print-notes`. CLAUDE.md desk rules 13 and 19.
Browser check: interrupt the tour by reloading partway through.

- **BA33 (medium). An interrupted tour leaves the Notebook expanded, or
  reopens it.**
  - *What happens*: the Notebook steps call `panel.showTab`
    (`tour.js:325–431`). From a minimized Notebook that writes
    `lit-desk-min = "0"` (`margin.js:127–130, 208, 344–347`); from a closed
    one it writes `lit-desk-panel = "open"` (`panel.js:302–311`). The saved
    state comes back only in `end()` (`tour.js:556–577`; `snapshot` and
    `restore` at `panel.js:549–574`). Closing the tab, reloading, going Back,
    following any link, or the last card's own “Ways to keep your notebook”
    link all leave the writes. Every later chapter then opens expanded at
    48, and a closed Notebook reopens. Rule 13 says the tour leaves nothing
    behind.
  - *Fix*: restore the three keys on `pagehide`, or call `end()` then. Let
    the tour open and expand the panel without saving it.
  - Status: open.
- **BA34 (medium). Where the browser won't keep a notebook, the panel still
  says “Kept in this browser.”**
  - *What happens*: with `store: null` (IndexedDB refused or missing), My
    Notes shows three contradictory things one after another:
    - the “Where should your notebook live?” card;
    - “This browser isn’t letting the site keep a notebook”;
    - a foot reading “Kept in this browser. No copy saved yet.” with a
      remind box.

    Answering the card offers the tour. Its marking steps describe a “My
    Notebook” row the menus don't have, since `initActions` returns without
    a store. “Print with my notes” is offered and does nothing.
  - *Where*: `panel.js:136–141, 245–246`; `first-use.js:177–192, 248–250,
    292–318`; `tab-mine.js:239–249`; `tour.js:445–459`; `commands.js:31–33`.
  - *Fix*: give first use, the tour (drop the marking steps) and the
    command context a `canKeep` flag. Also curl the straight apostrophes in
    `tab-mine.js:247`.
  - Status: open.
- **BA35 (low; possible). Printing with notes or room cleans up only on
  `afterprint`.**
  - *What happens*: if no dialog opens (printing blocked by policy, or a
    print refused after the 2.5 s font wait), `html[data-desk-print]`
    stays. The next plain Ctrl+P then prints the notes or the ruled margin,
    against rule 19, and both buttons stay dead until a reload. The two
    features share one attribute, so pressing both quickly prints the first
    job with the wrong look.
  - *Where*: `print-notes.js:295–320`, `print-room.js:29–50`.
  - *Fix*: add a fallback cleanup after `print()` returns (a
    `matchMedia("print")` change, or the next focus or pointer event), and
    one shared in-progress guard.
  - Status: open.
- **BA36 (low). Restarting the tour within a second lets the old timer
  remove its guard.** The 900 ms timer that removes `data-desk-tour`
  (`tour.js:575`) isn't kept or cleared by `start()` (471). Continue reading
  and a following ribbon then record the places the tour scrolls through.
  - *Fix*: keep the handle, and clear it in `start()`.
  - Status: open.
- **BA37 (low, data loss; likely). Starting the tour throws away a note
  being written.** “Take the tour” runs `closePanel()` first
  (`tour.js:465`), which removes the open note editor and its unsaved
  words.
  - *Fix*: don't start while an editor holds changed text, or ask first.
  - Status: open.

## FA1-n. Present mode and the sheet page

Files: `src/scripts/desk/sheet-present.js`, `sheet-lit.js`,
`src/lib/desk-present.mjs`, `src/styles/pages/sheets-page.css`,
`src/pages/sheets.astro`. Tests: `desk-present`. CLAUDE.md desk rule 20.
Browser check: present a sheet and use only the keyboard.

- **BA79 (medium, a11y; likely). Present mode's keys stop working when the
  focused button is hidden or disabled.**
  - *What happens*: the strip disables Previous and Next at the ends and
    hides Reveal and Footnotes where a screen has none
    (`sheet-present.js:426–431`), but the keys are heard only on the stage
    (493). Two cases:
    - Clicking Next to the last screen disables Next while it has focus.
    - Pressing → with focus on Reveal or Footnotes, when the next screen has
      neither, hides that button.

    Either way focus falls to the page, and the arrows, a clicker's Page Up
    and Page Down, R, F and Escape all do nothing until the leader tabs back
    in.
  - *Fix*: listen on `document` while presenting, removed in `finish`. Or
    move focus to the stage before hiding or disabling a focused control.
  - Status: open.
- **BA83 (low, a11y). The focus ring on the white paper preview is 2.4:1 in
  dark theme.**
  - *What happens*: `.sheet-copy` redefines `--green-text` but not
    `--focus-ring` (`sheets-page.css:124–154`), so a link on the white paper
    gets the dark theme's #3abf6a ring.
  - *Fix*: pin `--focus-ring: #0f6b33` on `.sheet-copy`, per CLAUDE.md's rule
    for fixed surfaces.
  - Status: open.
- **BA84 (low). The presenter view keeps saying no presentation is open.**
  - *What happens*: after Close and Present again, it keeps “The
    presentation was closed…”. Opened first, it says “No presentation is
    open for this sheet yet…” after 2.5 s. Its status clears only on a
    `state` message, and the stage answers a `hello` without sending one
    (`sheet-present.js:282, 712–723, 762–766`). `hello` also drops `role`
    (`desk-present.mjs:343`).
  - *Fix*: keep `role` in `hello` and treat a stage's `hello` as heard, or
    have the stage reply with its state.
  - Status: open.
- **BA85 (low; possible). The two-screen presenter view may blame the
  pop-up blocker for a slow permission prompt.**
  - *What happens*: `getScreenDetails()` can prompt, then
    `requestFullscreen({ screen })` uses the click, and `window.open` runs
    last and is blocked (`sheet-present.js:526–546`).
  - *Fix*: if permission had to be asked, say “Choose Presenter view
    again”, or open the window first. Needs two screens to check.
  - Status: open.
- **BA86 (low, a11y). Poetry on a sheet loses its description.**
  - *What happens*: `passageWords` strips `aria-describedby`
    (`sheet-lit.js:221–224`). The page carries `#hbq-description` for it
    (`sheets.astro:24–25, 59`), but nothing points at it.
  - *Fix*: keep `aria-describedby="hbq-description"` on `.hbq` blocks.
  - Status: open.

## FA1-o. Announcements and focus for marks

Files: `src/scripts/desk/note-editor.js`, `actions.js`, `undo-bar.js`,
`notes-margin.js`, `verse-labels.js`. CLAUDE.md desk rule 7. Check with a
screen reader if one is at hand, or the accessibility tree.

- **BA18 (medium, a11y). Saving a note, bookmarking, and highlighting aren't
  announced.**
  - *What happens*: deleting, undoing and pinning are announced, but making
    something is silent (`note-editor.js:167–170`; `actions.js:131–136,
    285–296`). The verse number's new name (“Verse 3, 1 note of mine”) is set
    after focus has returned (`verse-labels.js`), so a screen reader hears
    the old name. A new highlight that touches no other color is silent too.
    WCAG 4.1.3.
  - *Fix*: announce after each successful write, through `undo-bar.js`:
    “Note saved on Romans 8:3.”, “Bookmarked Romans 8:28.”, “Highlighted
    yellow: Romans 8:4–5.”
  - Status: open.
- **BA21 (low, a11y; likely). Focus is lost after deleting a note from the
  margin.**
  - *What happens*: three cases:
    - After Delete, focus returns to a button the redraw removes, so it
      drops to the page.
    - A redraw replaces an open circle popover's trigger, so focus can't
      return to it.
    - Saving a note started from a selection has no `restoreFocus`.
  - *Where*: `notes-margin.js:128, 317–320, 397, 541–599`;
    `note-editor.js:180–188`.
  - *Fix*: after a delete, focus the verse number or the next note. On a
    redraw, re-bind the popover to the new circle or close it.
  - Status: open.
- **BA22 (low, a11y; seen in the browser; BVJ's call on wording). A verse's
  name doesn't say it is bookmarked.**
  - *What happens*: bookmarked Romans 8:28 is named just “Verse 28”
    (`verseLabel`). Rule 7 names highlights and counts notes; bookmarks, the
    one mark Read View also shows, are left out.
  - *Recommended*: “Verse 28, bookmarked”.
  - Status: open.

## FA1-p. Panels beside the Notebook

Files: `src/scripts/desk/panel.js`, `src/scripts/lit-panel.js`,
`src/scripts/panel-pieces.js`, `src/scripts/float-window.js`,
`src/lib/desk-margin.mjs`. Tests: `desk-margin`. CLAUDE.md desk rule 3.

- **BA24 (low, a11y). Escape in the Notebook does nothing while the tour
  offer or the Greek commands window is open.**
  - *What happens*: the panel steps aside whenever any `.lit-panel` exists
    (`panel.js:368–376`), and `float-window.js:41` gives every window that
    class.
  - *Fix*: check lit-panel's shared slot (`currentPanel()`), or
    `.lit-panel:not(.lit-window)`.
  - Status: open.
- **BA27 (low). Panels shrink to slivers beside a wide floating Notebook.**
  - *What happens*: `floatWidth` allows the window's width less 32px
    (`desk-margin.mjs:150–159`). Panels fit into what's left
    (`lit-panel.js:92–97`; `panel-pieces.js:192–198`). In a 900px window with
    the Notebook at 800px, a verse menu gets 60px.
  - *Fix*: when the room left is under about 300px, let the panel lie over
    the Notebook (its z-index is already above the rail's), or cap the
    floating width to leave a usable strip.
  - Status: open.
- **BA28 (low). Some panels end up over the expanded Notebook.**
  - *What happens*: two cases:
    - `placeBesideTouchSelection` (`panel-pieces.js:161–180`) ignores
      `dockWidth()`, on touchscreen computers.
    - A panel already open when the Notebook expands stays where it was
      (`panel.js:345–358`).
  - *Fix*: subtract `dockWidth()`, and close or re-place the open panel when
    the dock grows (in `margin.js`'s `place()`).
  - Status: open.

## FA1-q. The gate and first paint

Files: `src/lib/app-platform.mjs` and its copy in `src/layouts/Layout.astro`'s
pre-paint script, `src/scripts/desk-gate.js`, `src/scripts/desk/shell.js`,
`panel.js`, `margin.js`, `src/styles/global.css` (desk widths). Tests:
`desk-prepaint`, `desk-margin`. CLAUDE.md desk rules 1 to 4. Browser check:
a half-screen window (about 960px).

- **BA26 (low; reproduced; matters at release). Android tablets in desktop
  site mode pass the computer test.**
  - *What happens*: Chrome and Firefox on Android tablets in desktop mode
    send a Linux user agent with no “Android,” so `?desk=on` turns the desk
    on for a touch tablet, against ground rule 1.
  - *Fix*: also treat `navigator.userAgentData?.mobile`, or Linux with
    `maxTouchPoints > 1` and not ChromeOS, as an app platform. Change both
    copies, and add the user agents to `test/desk-prepaint.test.js`. The same
    test also decides the app announcement's QR code and “Make an image”'s
    share-or-download, which is right for tablets.
  - Status: open.
- **BA25 (low). In a half-screen window every chapter opens at 48 and
  reflows to 52.**
  - *What happens*: once `lit-desk-min` is “0” or the start is Open, the
    pre-paint script stamps `data-desk-expanded`. The first placement
    floats, and `nextCollapsed` collapses it because `wasFloating` starts
    false (`desk-margin.mjs:182–187`). `setExpanded(false)` then reflows on
    every load, against rule 4's “never reflows.”
  - *Where*: `Layout.astro:104`; `margin.js:222, 240`.
  - *Fix*: don't stamp below a rough window-width threshold, or treat the
    first placement after a pre-paint stamp as already expanded.
  - Status: open.
- **BA29 (low). If the desk fails to start, the column stays narrowed and
  the buttons do nothing.**
  - *What happens*: the pre-paint stamps stay when the shell's code fails to
    load (offline, or an old page after a deploy) or `start()` throws
    (`desk-gate.js:13–15`; `shell.js:57–158`). `createPanel` builds every
    tab before the rail, so one tab that throws takes the whole panel down
    (`panel.js:253–256`).
  - *Fix*: remove `data-desk-panel`, `data-desk-expanded` and
    `data-desk-widths` in the gate's catch and around `start()`. Build each
    tab in its own try/catch.
  - Status: open.
- **BA30 (low). Widths dragged in a wide window make a narrower one open
  off-center, then jump.**
  - *What happens*: the pre-paint script checks only `x >= 280`
    (`Layout.astro:104`; `global.css:3484–3486`). A stored 600px width in a
    small window gives the column a 640px right margin until `margin.js`
    runs after the store opens.
  - *Fix*: skip stamping a width above about half the window.
  - Status: open.

## FA1-r. /desk's smaller fixes

Files: `src/scripts/desk/tab-mine.js`, `tab-verse.js`, `desk-panes.js`,
`desk-page.js`, `lit-pane.js`, `chapter-page.js`. Tests: `desk-layout`.
After FA1-e and FA1-l.

- **BA31 (low). Two My Notes panes share their filters, and closed panes
  leave listeners behind.**
  - *What happens*: `colorFilter` and `labelFilter` are module-level
    (`tab-mine.js:88–90, 672`). The `SETTINGS_EVENT` and `lit:panel-actions`
    listeners (`tab-mine.js`; `tab-verse.js:479–483`) outlive a pane, since
    `destroy()` only unsubscribes the store (`desk-panes.js:333–359`).
  - *Fix*: move the filters into `createMineTab`'s closure, and return the
    listener removals for `destroy()`.
  - Status: open.
- **BA62 (low, copy). The “Leading” hover text leaves out My Notes.** It
  should read “My Notes, This verse, Greek, and Footnotes follow this pane.”
  (`desk-page.js:409`; also the header comment at 23–24).
  - Status: open.
- **BA63 (low, a11y). The Layout menu stays open when keyboard focus leaves
  it.**
  - *Fix*: close it on `focusout` to anywhere outside the menu and its
    button (`desk-page.js:305–322, 572–577`).
  - Status: open.
- **BA64 (low, perf; likely). Scrolling past the Acts stub cycles the
  shared place through up to 28 chapters.**
  - *What happens*: `placeNow` (`lit-pane.js:265–270`) maps the line's
    position in the stub to Acts 1 to 28. Each change sets This verse,
    Footnotes and Greek fetching that chapter, about one request per frame.
  - *Fix*: report a stub's first chapter only, or debounce `follow()` while
    the LIT pane scrolls.
  - Status: open.
- **BA65 (low, perf). Every fetched chapter's whole page is kept for the
  visit.**
  - *What happens*: `chapter-page.js:22–23, 55–87` keeps the whole parsed
    page, header and footer included. Over the corpus that is 28.9 MB of
    HTML, where the pane needs much less. Keeping chapters for the visit is
    BVJ's 3e decision.
  - *Fix*: keep only the text, footnotes, term data, Go deeper, and the
    content-version fields.
  - Status: open.

## FA1-s. Greek credits and the notebook search

Files: `src/scripts/search.js`, `searchbar.js`, `src/scripts/desk/tab-greek.js`
(its credits), `scripts/build-greek.mjs` (`LICENSE_TEXT`),
`public/greek/LICENSE.txt`, `src/lib/desk-search.mjs`. Tests: `desk-search`.
CLAUDE.md desk rules 14 and 15. **Do this before Greek search launches**
(`greekSearchEnabled()` returning true).

- **BA46 (medium, licensing). Greek results on /search and in the tray
  credit no one.**
  - *What happens*: they show SBLGNT text (CC BY 4.0), MorphGNT's parsing
    (CC BY-SA), UBS glosses (CC BY-SA 4.0) and STEP Bible's brief glosses
    (CC BY 4.0). Where: `search.js:863–935, 1110–1133`;
    `searchbar.js:712–722`. Rule 14's credits appear only in the Greek tab
    (`tab-greek.js:65–70`).
  - *Fix*: a one-line credit under each Greek group, with links, sharing the
    tab's strings: “Greek: SBLGNT; parsing: MorphGNT; glosses: UBS and STEP
    Bible.”
  - Status: open.
- **BA47 (low, licensing). LICENSE.txt understates STEP Bible's share of the
  search index.**
  - *What happens*: the `search/` section says its glosses come “from the
    UBS dictionary above (or the brief lexicon where UBS has none).” Only 3
    lemmas lack a UBS gloss, yet 3,343 of 5,465 carry STEP Bible's brief
    gloss. The section also ends “This directory is licensed CC BY-SA 4.0,”
    the invitation the 2026-10-13 decision reworded away for `step/` and
    `lsj/`.
  - *Fix*: say the index carries STEP Bible's brief glosses (CC BY 4.0) for
    most lemmas, with the “get the lexicons from github.com/STEPBible” note.
    The file is written from `LICENSE_TEXT` in `scripts/build-greek.mjs`
    (about line 422) and committed, and CI can't run `build:greek`. Edit
    both identically.
  - Status: open.
- **BA40 (low; BVJ's call). A Greek search never looks in the notebook, and
  the notebook's matching misses a final sigma typed as σ.**
  - *What happens*: a Greek query returns before the “Your notebook” group
    is built (`searchbar.js:883–917`). Rule 15's “Greek alone” was about
    English verse results, not the reader's own notes. Separately,
    `desk-search.mjs:30` doesn't fold ς: “πιστισ” finds nothing where
    “πιστις” finds the note.
  - *Recommended*: fold ς to σ either way. BVJ to say whether a Greek query
    lists the reader's matching notes.
  - Status: open.

## FA1-t. Copy and docs

Files: `src/lib/desk-change.mjs`, `src/scripts/desk/change-notice.js`,
`src/pages/notebook/help.astro`, `src/scripts/desk/notebook-page.js`,
`src/pages/privacy.astro`, the four desk pages' titles. CLAUDE.md, “Key
Conventions” (American copy, curly quotes). Small enough to finish with a
read-through of the desk's other reader-facing strings.

- **BA15 (low, copy). The change notice uses straight apostrophes and mixed
  quote marks.**
  - *What happens*: “couldn't,” “isn't” and “can't” are straight here and
    curly everywhere else. “You pinned: ‘…’” sits beside “Your note was on:
    “…”.” The code comment saying straight is the desk's style is out of
    date.
  - *Where*: `desk-change.mjs:345–420`; `change-notice.js:371–376, 426–458`.
  - Status: open.
- **BA38 (low, copy). The help page's “Type ‘tour’” doesn't work where it is
  read.**
  - *What happens*: the help page isn't a reading surface, so typing “tour”
    there lists no command. On a chapter, Enter on “tour” goes to /search;
    only clicking the row, or typing “>tour,” starts it
    (`help.astro:156–157`; `desk-commands.mjs:112–118`;
    `searchbar.js:1179–1222`).
  - *Fix*: reword the line, or let Enter run a lone matching command.
  - Status: open.
- **BA39 (low, copy; BVJ's call). “Moves it to the trash for 30 days”
  suggests it can be fished back out.**
  - *What happens*: Undo works only until the page is left, and nothing
    lists or restores the trash (`help.astro:81–83`;
    `notebook-page.js:132`).
  - *Recommended*: “Undo brings it back until you leave the page; after
    that, only a saved copy does.” Or drop “for 30 days.”
  - Status: open.
- **BA42 (low, docs). /privacy doesn't name `sessionStorage['lit-desk-ribbon']`.**
  This is the C25 key that lets a ribbon follow the reader within a book
  (`ribbon-follow.js`; `desk-places.mjs`). Every other desk key is named.
  Rule 13 says to keep the privacy paragraph in step.
  - Status: open.
- **BA43 (low, copy; BVJ's call). The desk's pages are titled differently
  from the rest of the site.**
  - *What happens*: “Notebook | LIT Bible,” “Your notebook | LIT Bible” (the
    help page), “Study Desk | LIT Bible” and “My sheets | LIT Bible” sit
    beside “Romans 8 | Liberation and Inclusion Translation.”
  - *Recommended*: the site's own suffix, and “Notebook help” for the help
    page.
  - Status: open.

## FA1-u. The follow-up audit: code this audit didn't reach

**This phase finds problems rather than fixing them.** It is the next audit,
aimed at what "Not covered" lists below. Run it after FA1-f and before FA1-g,
so that what it finds in an area can join the open phase for that area.

**How to run it**:
- **About two sessions**: areas 1 to 3, then 4 to 6. Stop between areas,
  and mark the ones done here.
- **Subagents** are fine on Sonnet, one per area, with at most two running
  at once. Haiku is fine for finding code. Never Opus.
- **The method** is the first audit's:
  - read every file named in full;
  - check it against CLAUDE.md's desk rules and STUDY-DESK.md's decisions,
    treating recorded decisions as intended;
  - prove each finding with a Node reproduction or an exact trace, or in
    Chromium after `npm run build`;
  - drop what can't be shown.
- **Writing up**: add each finding below its area here as **BA88 onward**,
  in this file's entry format: severity, what happens, where, the fix, how
  to check it, and status. Then name it in the open phase for its area,
  adding it to that phase's table row. Where no open phase fits, start a new
  one, FA1-w onward, and add it to both tables. Add what checked out to
  "What held up", and what is still unreached to "Not covered".
- **Ending**: write a decision-log line in STUDY-DESK.md with the counts.

**The six areas**:

1. **What's new for you (B3) and your own chains (N4).**
   - *Files*: `src/lib/desk-whats-new.mjs`, `desk-whats-new-view.mjs`,
     `desk-chains.mjs`, and the release-note reading in `desk-change.mjs`
     (`changeVerses`, `releaseNoteFor`); `src/scripts/desk/whats-new.js`,
     `release-feed.js`, `note-words.js`. CLAUDE.md desk rules 12 and 16.
   - *Questions*: does every row of the real `release-notes.json` yield the
     right verses? Try them all, including ranges, lists, intros, footnote
     rows and new chapters. Is “last looked” (`whatsNewSeen`) right before a
     first visit and across tabs? Does a chain link land where it says?
2. **Places and ribbons.**
   - *Files*: `src/lib/desk-places.mjs`; `src/scripts/desk/places.js`,
     `ribbon-follow.js`, `ribbon-form.js`, `kept-list.js`;
     `src/scripts/last-read.js`. CLAUDE.md desk rule 13; STUDY-DESK.md B1,
     C25 and E4.
   - *Questions*: ribbons in two tabs at once, a ribbon on a draft chapter,
     the C25 follow rule across books and tabs, and Continue reading next to
     Read View's places. This is correctness only. E4's redesign stays BVJ's.
3. **The Greek tab's reading view and the commands window.**
   - *Files*: `src/scripts/desk/tab-greek.js` (all of it),
     `greek-find.js`, `greek-data.js`, `greek-link.js`;
     `src/scripts/greek-commands.js`, `float-window.js`;
     `src/lib/desk-greek.mjs`, `desk-greek-split.mjs`,
     `greek-commands-ui.mjs`, `greek-parse.mjs`. CLAUDE.md desk rules 14,
     15 and 17.
   - *Questions*:
     - Does “Go to verse N” work, and does the lexicon choice persist?
     - Do draft chapters, John 7:53–8:11 and Romans 16:25–27 show, and what
       happens on a chapter with no Greek data?
     - The commands window: its focus handling and dialog semantics, where it
       inserts text in the field, its dragged position, and when it closes.
     - The split handle by keyboard.
4. **/desk's use of the shared modules.**
   - *Files*: the /desk modes of `highlights.js` and `verse-labels.js`;
     per-chapter pins in `pins.js`; `page.js` (`addDeskText`,
     `deskChapterBoxes`, `chapterTextFor`); `attachVerseTools` in
     `chapter-tools.js` with a pane as the view; `attachTermLens`;
     `footnotePanel` in `panel-pieces.js`; `footnotes-view.js`,
     `lit-records.js`; `follow` in `tab-mine.js`; `kept-list.js` and
     `sheet-pane.js` mounted as panes. CLAUDE.md desk rule 18.
   - *Questions*: two LIT panes showing one chapter, highlights and pins
     there, a verse menu in one pane while the other scrolls, and whether
     the bottom-row pane's kind menu is clipped by the panes box's
     `overflow: auto`.
5. **Sheets beyond one tab.**
   - *Files*: `src/lib/desk-sheets.mjs`, `desk-sheet-passages.mjs`,
     `desk-sheet-check.mjs` (`freshCopy`), `desk-sheet-discussion.mjs`,
     `desk-sheet-gather.mjs`; `src/scripts/desk/search-sheet.js`;
     `lit:search-results` in `search.js` and `loadDeskSheets` in
     `search-core.js`. CLAUDE.md desk rules 21 to 23.
   - *Questions*:
     - Two tabs editing one sheet: can a queued change save an older copy
       over the other tab's?
     - Do a passage's blanks survive “Keep the new wording”?
     - Are the verses right when a passage comes from a selection, the verse
       menu, the notebook or a search?
     - How long does a sheet with thousands of blanks take to draw?
6. **A copy pass and the stylesheet.**
   - *Copy*: every reader-facing string in `src/scripts/desk/`, the four
     desk pages, the templates, the tour, the commands and the error
     messages. Check them against CLAUDE.md's “Key Conventions”: American
     spelling, the Oxford comma, curly quotes and punctuation with quotes.
     Check that features are named consistently (Notebook, My Notes,
     Sheets, the buttons). FA1-t's five items are already known; don't
     report them again.
   - *Stylesheet*: `src/styles/desk.css` beyond dark-mode pairing. Focus
     rings through `--focus-ring`, contrast of the desk's own colors in both
     themes, `prefers-reduced-motion`, forced colors, and print rules.

## FA1-v. The follow-up audit: real devices

**Also finding rather than fixing**, and the very last phase, so it checks
the desk after the fixes. A cloud session has only Chromium, so this phase
is for BVJ's own computers, or for a session working on one through the
desktop app.

- *Write up* what goes wrong the same way, as the next BA numbers, in a
  closing phase of fixes (FA1-w or later).
- *On each*, run the same short pass: turn on `?desk=on`, make a note, a
  highlight, a bookmark and a pin on Romans 8, reload, then open
  /notebook/, /desk/ and a sheet.

Then, in particular:

1. **Safari on a Mac**:
   - the Safari line about storage that is cleared after seven days (C18);
   - highlights, which need the CSS Custom Highlight API;
   - Copy text, Copy for Word, and saving a copy as a file;
   - two tabs kept in step (BroadcastChannel).
2. **Firefox**: the same pass. Note whether highlights and the margin's lit
   words draw.
3. **A screen reader** (VoiceOver on a Mac):
   - the verse numbers' names;
   - the note editor as a dialog;
   - the Notebook's tabs;
   - the announcements FA1-o added;
   - the Layout menu and pane menus on /desk;
   - presenting by keyboard (after FA1-n).
4. **Two screens**: the presenter view placing the room's window on the
   second screen, and the pop-up and permission path (BA85).
5. **A touchscreen computer**: a finger selection beside the expanded
   Notebook (BA28), and the verse menu by touch.
6. **Printing to paper or PDF**, in Chrome and Safari:
   - a chapter with my notes (M6) and with room to write (N9);
   - a sheet's leader and participant copies on Letter and on A4.

   Check that page breaks, the codes and the credit line print.
7. **The deployed site**: the shared-link beacon check (BA78), if FA1-g
   didn't already do it.

---

## What held up

Checked during the audit and found sound, so a later audit can start
elsewhere:

- **The preview gate.** No desk script or stylesheet reaches a reader
  without the preview, or a phone, checked in the built chunks. The
  pre-paint script agrees with `app-platform.mjs` and `desk-start.mjs`, junk
  stored values included.
- **Anchoring.** It maps exactly in both views across John 8, Mark 16,
  Romans 16, Luke 1, John 9, 1 Peter 2, 2 Corinthians 6, Luke 22 and
  Hebrews 2: brackets, poetry lines, continuing verses, and footnote letters
  at the edges.
- **The reader's words never become markup** in the margin, panel, notebook
  page, record rows or undo bar. `noteBodyHtml` stayed safe against hostile
  input, and typed references link.
- **The sheet sanitizer.** It held up against 123 hostile cases and about
  230,000 random tag soups. It is idempotent, and parse5 agrees with its
  output.
- **The share decoder.** It refused truncated and malformed data, prototype
  tricks, more than 100,000 modules, and deflate bombs up to 512 MiB,
  stopped while streaming.
- **Participant copies** leak no Leader only part, answer or held footnote
  through print, Copy for Word, the room's screen or the codes.
- **Merging.** Missing, unparsable or offset times, duplicate ids, unknown
  kinds and fields, and every merge vector behave as the rules say.
- **In the browser**:
  - 26 page loads with no console errors.
  - A note, a highlight, a bookmark, a pin and a note on a footnote all came
    back after a reload.
  - All three export formats saved, and reopening the backup reported “5
    already here.”
  - Hide my notes (H) restored exactly.
  - A chapter printed with the Notebook open came out clean: no panel, and
    no shifted column.
- **Greek search** finds Greek with or without accents, final sigma,
  Strong's numbers, transliterations, and glosses. With the preview off,
  nothing under `greek/` is fetched.
- **`checkLayout`** survives hostile stored layouts, apart from BA58 and
  BA59.
- **Dark mode** pairs both selectors in all three desk stylesheets.

## Not covered

FA1-u and FA1-v take these up:

- **Other browsers.** All browser use was Chromium. Nothing ran in Safari or
  Firefox, with a real screen reader, on two screens, or on a touchscreen
  computer.
- **Phase 2a's small pieces.** What's new for you (B3), your own chains
  (N4) and the release-note parser weren't read in depth, and places and
  ribbons only in part.
- **The Greek tab's reading view**: Go to verse, the lexicon choice, drafts,
  the two borrowed passages, and the commands window's focus handling and
  where it inserts text.
- **The /desk modes of shared modules**: highlights, verse labels and pins
  in the LIT pane, `footnotes-view.js`, and the Sheet pane as a following
  pane.
- **Sheets in two tabs**: two tabs editing one sheet, and whether a
  passage's blanks survive “Keep the new wording.”
- **A full copy pass** of the desk's reader-facing strings. Most of
  `desk.css` was checked only for dark-mode pairing.
