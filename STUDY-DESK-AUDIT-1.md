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
- **FA1-u, areas 1 to 3** (2026-10-26) found 33 more, BA88 to BA120: 7
  medium and 26 low. They are in four new phases, FA1-w to FA1-z, and in
  FA1-k, FA1-r and FA1-t.
- **FA1-u, areas 4 to 6** (2026-10-26) found 25 more, BA121 to BA145: 7
  medium and 18 low. They are in four more new phases, FA1-aa to FA1-ad,
  and BA127 is in FA1-i. That ends FA1-u: **145 findings in all, 144
  planned.**

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
7. **Close the loop.** Mark each finding's status here ("Fixed in #402").
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
stable. FA1-w to FA1-z, and FA1-aa to FA1-ad, came from FA1-u and were
placed last among the fixes; their place in the order is BVJ's to change.
The one exception is FA1-ab, which holds two data-loss findings (BA128,
BA129): BVJ moved it up to follow FA1-u (2026-10-26), by the order's own
rule, data loss first. FA1-aa works the same files as FA1-l and FA1-r, so
it goes after both, and FA1-ac after FA1-t.

| Phase | Area | Findings | Status |
|---|---|---|---|
| FA1-a | Security: the stored script and the sanitizer | BA66, BA67, BA59 | done, #370 |
| FA1-b | Markdown copies | BA1, BA2, BA41, BA9, BA10 | done, #371 |
| FA1-c | Merging and opening a copy | BA3, BA4, BA11, BA12 | done, #372 |
| FA1-d | The store, the note editor, and undo | BA5, BA13, BA6, BA7 | done, #373 |
| FA1-e | /desk keeps the reader's place | BA51, BA52, BA53, BA55 | done, #374 |
| FA1-f | The record format, for BDR | BA8, BA14 | done, #375 |
| FA1-u | The follow-up audit: code this audit didn't reach | new findings, BA88 onward | done: areas 1 to 3 (BA88 to BA120), #376; areas 4 to 6 (BA121 to BA145) |
| FA1-ab | Sheets in two tabs, and large sheets | BA128 to BA133 | done, #378 |
| FA1-g | Sharing a sheet | BA78, BA80, BA81, BA82, BA87 | done, #379 |
| FA1-h | Marks on the page | BA16, BA17, BA19, BA20, BA23 | done, #380 |
| FA1-i | Sheet templates and passages | BA69, BA70, BA75, BA76, BA77, BA127 | done, #381 |
| FA1-j | The sheet editor: pasting and saving | BA68, BA71, BA72, BA73, BA74 | done, #382 |
| FA1-k | Greek search commands | BA44, BA45, BA48, BA49, BA50, BA116 | done, #383 |
| FA1-l | /desk's LIT pane and layout | BA54, BA56, BA57, BA58, BA60, BA61 | done, #387 |
| FA1-m | The tour, first use, and printing | BA33, BA34, BA35, BA36, BA37 | done, #388 |
| FA1-n | Present mode and the sheet page | BA79, BA83, BA84, BA85, BA86 | done, #390 |
| FA1-o | Announcements and focus for marks | BA18, BA21, BA22 | done, #391 |
| FA1-p | Panels beside the Notebook | BA24, BA27, BA28 | done, #392 |
| FA1-q | The gate and first paint | BA25, BA26, BA29, BA30 | done, #396 |
| FA1-r | /desk's smaller fixes | BA31, BA62, BA63, BA64, BA65, BA114, BA115 | done, #398 |
| FA1-s | Greek credits and the notebook search | BA40, BA46, BA47 | done, #399 |
| FA1-t | Copy and docs | BA15, BA38, BA39, BA42, BA43, BA91, BA109, BA118 | done, #400 |
| FA1-w | What's new for you | BA88, BA90, BA92, BA96, BA97, BA98 | done, #401 |
| FA1-x | A note's references | BA89, BA93, BA94, BA95 | done, #402 |
| FA1-y | Ribbons and Continue reading | BA99 to BA108 | done, #PRNUM |
| FA1-z | The Greek tab | BA110, BA111, BA112, BA113, BA117, BA119, BA120 | open |
| FA1-aa | /desk's panes and the shared modules | BA121 to BA126 | open |
| FA1-ac | The copy pass | BA134 to BA139 | open |
| FA1-ad | The stylesheet: focus, forced colors, contrast, and print | BA140 to BA145 | open |
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
  - Status: fixed in #372. `planOpen` reads and plans the file; Open runs
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
  - Status: fixed in #372. A clamped record is dropped when the notebook
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
  - Status: fixed in #372. Kinds clashing within one file are skipped too,
    and a trash record naming itself. The summary counts from the writes,
    with a new "changes in the trash" for trash-only writes.
- **BA12 (low; reproduced). The copy held inside a trash record isn't
  clamped.**
  - *What happens*: a held copy dated 2099 beats the live copy and every
    later deletion's copy (`desk-merge.mjs:124–130, 171–178, 239`), so Undo
    would restore the wrong words.
  - *Fix*: clamp `record.modified` inside trash records too.
  - Status: fixed in #372, and by BA4's rule a clamped held copy never
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
  - Status: fixed in #373. Every write in `store.js` goes through one
    `apply`, which aborts the transaction when anything throws and rejects
    with that error, so none of a failed write is kept. `planImport` skips a
    record nested deeper than `MAX_NESTING` (64).
- **BA13 (low; possible). Deleting, undo, and the purge read and write in
  separate transactions.**
  - *What happens*: `remove` (`store.js:213–217`), `undo` (220–228) and the
    purge at open (268) each read in one transaction and write in another.
    An edit from another tab in that gap is deleted, and the trash holds the
    copy from before it. A restore during the purge leaves a tombstone
    beside the live record.
  - *Fix*: read and write in one readwrite transaction.
  - Status: fixed in #373. `store.change` reads and writes in one
    readwrite transaction; `remove`, `undo`, the purge and the history's own
    steps (whose overtaken check had the same gap) all use it.
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
  - Status: fixed in #373, as described, through `planEdit`
    (`desk-store-core.mjs`) inside `store.change`. The editor stays open with
    the reader's words when it refuses.
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
  - Status: fixed in #373, as described. The trash record an undone add
    writes takes an id the entry allots (`undoTrash`), so a redo removes it.
    Any trash record an undo or redo puts back gets a fresh `deletedAt`, not
    only a redone deletion's.

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
  - Status: fixed in #374. `draw()` notes each pane's scrolling before it
    moves the panes and puts it back after (`keepScroll`). The LIT pane's
    own `keep` puts the verse at its reading line back where it was, so a
    new width can't move it; it and the Greek clear their "the reader
    scrolled" flag, so the restored scroll isn't reported. Checked in a
    production build: closing, the 2×2 grid, switching a kind, a move and
    a reset all left both LIT panes on their verses.
- **BA52 (medium; reproduced). A second LIT pane follows the first until its
  reader scrolls it.**
  - *What happens*: a new LIT pane has no `at`, so `litPlace` falls back to
    `layout.place`, and `follow()` moves it along with the active pane
    (`desk-layout.mjs:304–305, 339–348, 388–392`; `desk-page.js:353,
    380–390`). This survives a reload, since no `at` is saved. It
    contradicts rule 18's “each LIT pane keeps where its reader is.”
  - *Fix*: give a LIT pane `at = litPlace(…)` when it is made (`setKind`,
    `applyArrangement`, `splitPane`), or on mount through `setLitAt`.
  - Status: fixed in #374, in the layout rules rather than on mount:
    `placeLitPanes` gives every LIT pane without an `at` the shared place,
    from `settleActive` (so every path that makes or loads a pane),
    `setPlace` and `setLitAt` (the old place, before it moves).
    `checkLayout` drops a saved place that isn't a passage, so it isn't
    passed on.
- **BA53 (medium; BVJ's call). “Make this my default” saves the passage
  too.**
  - *What happens*: the default stores `place`, each LIT pane's `at`,
    `pin.at` and `sheet` (`desk-page.js:205–212, 272–277`;
    `desk-layout.mjs:582–585`). Opening with My default returns to where it
    was made, ignoring the last visit and Continue reading. D9's answer 2
    describes the default as a layout.
  - *Recommended*: open with the default's arrangement and the last visit's
    places, or Continue reading's.
  - Status: fixed in #374 as recommended (BVJ, 2026-10-26: option 1).
    `openingLayout(saved, reading)` gives the default's arrangement
    (`atPlace`) the last place on the desk, else Continue reading's;
    pins and a Sheet pane's sheet are kept, a pin at the reader's place.
- **BA55 (medium; reproduced). “Reset to the original layout” sends every
  pane to Matthew 1:1.**
  - *What happens*: `originalLayout()` has no `place`, so `passageOf` falls
    through to `startingPassage(null)` (`desk-page.js:278–282`;
    `desk-layout.mjs:178–190`).
  - *Fix*: `commit({ ...originalLayout(), place: layout.place })`, carrying
    the active LIT pane's `at` into p1.
  - Status: fixed in #374: `originalLayout(place)`, called with the
    shared place (the active LIT pane's).

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
  - Status: fixed in #375. `bestByContext` returns no occurrence when
    there are several and fewer than `MIN_CONTEXT` (8) characters of context
    agree, and `resolveAnchor` takes a `changed` region only when it is at
    most `2 × exact + CHANGED_GROWTH` (16). A step whose guard fails doesn't
    succeed and the next is tried, so such a mark ends on its verses.
    `ANCHOR_SPEC_VERSION` is 2; the vectors gained five cases (John 3:16's
    65-character region for a 12-character quote, a 25-character one that
    fits, and John 9:39's "see" with no context, 7 and 8 characters), and
    the header carries both numbers. No git fetch was needed: the checkout
    had full history. Regenerating also refreshed the Luke 1 and Luke 22
    chapter vectors from today's text.
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
  - Status: fixed in #375. 1: a "Times" paragraph under the common fields
    (`Z`, any number of fraction digits, three written, compared as
    instants). 2: kind 10 names the tombstone's fields (everything but
    `record`), and `emptyTrashRecord`'s comment says the same. 3: `v3-4`. 4:
    already done by FA1-b (#371), which described the escaping in full. 5:
    `body`, proposed, with `note` still read. 6: "Clocks" now says every
    arrival and points to FA1-c's rule. 7: the format's status lines and
    `desk-merge.mjs`'s header. FA1-b's per-entry `modified` was already
    described; FA1-d's undo and redo are now under kind 10. A note for BDR's
    Claude is in STUDY-DESK.md, "One notebook, three homes".

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
  - Status: fixed in #379. The move now runs on `popstate` as well as
    `hashchange`. Checked locally (2026-10-27): listeners added after
    load, where the beacon's would be, saw `/sheets/` with no fragment on
    both events, and the page reloaded once with the sheet in
    `history.state`. The check against the real beacon on the deployed
    site is still FA1-v's, item 7.
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
  - Status: fixed in #379. `fragmentInFile` takes the last data line,
    and `plainText` writes `<!--` as `&lt;!--`.
- **BA81 (low; reproduced). A participant share keeps parts of unknown types
  whole, answers included.**
  - *What happens*: `plainModule` empties `answer` only on question parts
    (`desk-sheet-share.mjs:134–139, 150–152`). A part of a type this version
    doesn't know, which sheetFormat 1 allows, travels with every field.
  - *Fix*: leave unknown types out of a participant share. Paper copies
    already skip them (`modulesForCopy`). Say so in the format's “Sharing a
    sheet,” for BDR.
  - Status: fixed in #379. Said in the format's “Sharing a sheet” for BDR.
- **BA82 (low; reproduced). A crafted share can raise a false “wording
  changed” notice after Copy into my desk.**
  - *What happens*: `sheetFromShared` drops only `id` (298–302), and
    `copyOfShared` spreads every module field (323–331). So `verseCopy` and
    `verseCopyAsOf` survive, though STUDY-DESK.md says a shared sheet is
    never flagged.
  - *Fix*: strip the `DROP` fields in `sheetFromShared`, as `plainModule`
    does.
  - Status: fixed in #379.
- **BA87 (low, copy; reproduced). A file whose data line was wrapped by
  email says it doesn't hold a shared sheet.**
  - *What happens*: a folded line gives null, so the “no-data” message
    (`desk-sheet-share.mjs:46, 120`).
  - *Fix*: allow whitespace inside the data and remove it, or report
    “damaged… Ask for it again” when a `<!-- lit-sheet` opener is there but
    can't be read.
  - Status: fixed in #379. Both: whitespace inside the data is removed,
    and an opener that can't be read is reported as damaged.

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
  - Status: fixed in #380. The press stands down until the panel closes,
    and both changes are planned over the notebook in the write's own
    transaction (`planBookmark`, `planUnbookmark` in `desk-store-core.mjs`):
    a verse that already holds a bookmark gets no second, and removing
    takes every bookmark on the verse, in one undo.
- **BA17 (medium, privacy). Hide my notes doesn't hide notes on a
  footnote.**
  - *What happens*: with H pressed to share a screen, opening a footnote
    still lists the reader's notes on it in the popover.
    `footnoteNotes` (`footnote-notes.js:261–274`, called from `pins.js:348`)
    checks no setting, and no CSS hides it. M1 promises to hide every note,
    highlight and mark.
  - *Fix*: `html[data-desk-notes="off"] .desk-fnn { display: none }`, or
    check the setting and redraw on `SETTINGS_EVENT`.
  - Status: fixed in #380, by the CSS rule, scoped to a popover
    (`.lit-panel .desk-fnn`): the Notebook's tabs and /desk's Footnotes
    pane still list the notes, as they list every other note while the
    notes are hidden.
- **BA19 (low). With My notes off, going to a note marks nothing.**
  - *What happens*: the 2026-10-07 decision (the margin switch, item 7) says
    that with notes hidden the words are marked and focus lands on the note.
    Instead `syncLit` lights words only while notes are on
    (`notes-margin.js:450`), so `reveal` (603–629) scrolls, lights nothing,
    and leaves focus in the panel.
  - *Fix*: let ids in `flash` light their words whatever the setting.
  - Status: fixed in #380. Focus, which the margin can't take while it
    holds no notes, goes to the verse number the words start in (or the
    footnote's first link); a call for BVJ, "Decisions", 2026-10-27.
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
  - Status: fixed in #380, as proposed.
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
  - Status: fixed in #380: the selection ends where the pointer last was
    over the text, and the page's selection moves to match, unless the drag
    went past the text's end (`src/lib/selection-end.mjs`, used by
    `chapter-tools.js`). A call for BVJ, "Decisions", 2026-10-27.

## FA1-i. Sheet templates and passages

Files: `src/scripts/desk/sheet-pane.js`, `src/lib/desk-sheet-templates.mjs`,
`src/lib/desk-sheet-lit.mjs`. Tests: `desk-sheet-templates`,
`desk-sheet-lit`, `desk-sheets`. CLAUDE.md desk rule 21. Browser check: a
new Bible study sheet, then a passage from the LIT pane's verse menu, then
the participant copy and present mode.

**From FA1-u**: BA127 (“+ Passage” checks no verses), written up under
FA1-u, area 5. It is in `sheet-pane.js`'s passage form; add a test that
needs no browser by moving the form's verse rule into
`desk-sheet-passages.mjs`.

- **BA69 (medium; seen in the browser; BVJ's call). The first passage added
  to a new template lands after “Closing.”**
  - *What happens*: `insertIndex` (`sheet-pane.js:181`) puts a new part
    after the part last worked in, else at the end, and a freshly applied
    template has none. Seen: Bible study, then “Add to ‘Untitled sheet’”
    from the LIT pane, put Romans 8:28 last. Rule 21's intent is that a
    passage “lands inside a template, not after it.”
  - *Recommended*: when a template is applied, treat its Reading (or Read)
    part as the part last worked in.
  - Status: fixed in #381, by BVJ's choice of a fuller rule (2026-10-27):
    a passage with no part worked in goes after the last passage, or on a
    sheet with none, after the part headed “Reading,” “Read” or “The text”
    (`passageInsertIndex`, `readingPart`), so a reopened sheet gets it too.
- **BA70 (low; seen in the browser; BVJ's call). Template instructions print
  and go up on the room's screen.**
  - *What happens*: “Add the passage with + Passage, or from the LIT pane’s
    verse numbers.” and its siblings (`desk-sheet-templates.mjs:49, 67, 75`)
    are ordinary sheet text. One printed on the participant copy and showed
    as a screen in present mode.
  - *Recommended*: remove the instruction when the first passage is added
    under it, which needs no format change. The other choice is a hint that
    only the editor shows.
  - Status: fixed in #381, as ghost text (BVJ, 2026-10-27): the templates
    no longer hold the sentence; the editor draws it in the reading part
    (`READING_HINT`) until the sheet has a passage, and the sheet never
    holds it.
- **BA75 (low, a11y). “Already on the sheet” is never seen, and is
  overwritten for screen readers.**
  - *What happens*: the notice goes only to the live region
    (`sheet-pane.js:191–197`), and the “X added.” that follows replaces it.
    STUDY-DESK.md (3f) says adding one again “says so.”
  - *Fix*: one visible message, such as “John 3:16 added again; it was
    already on the sheet.”
  - Status: fixed in #381: “John 3:16 added again; it was already on the
    sheet.” is announced once and shown where it was added (under the
    “+ Passage” box, or in the LIT pane's panel, which stays up longer).
- **BA76 (low; reproduced). C15's check ignores blanks of words under four
  letters.**
  - *What happens*: `telltaleStems` skips words under `MIN_LETTERS = 4`
    (`desk-sheet-lit.mjs:211–226`). A blank on “God,” “joy,” “law,” “sin”
    or “Son” isn't flagged when the footnote uses the word, so the note
    prints and gives the answer away. Key-term blanks are unaffected.
  - *Fix*: compare a short blank whole against the note's words, with case
    and accents folded.
  - Status: fixed in #381: a blank's short words, less a list of
    grammatical ones, are held whole against the note's.
- **BA77 (low, copy). The Class session template says “the leader copy.”**
  It should read “An answer for the leader’s copy.”
  (`desk-sheet-templates.mjs:69`). Templates must stay in the sanitizer's
  canonical form; the test checks.
  - Status: fixed in #381.

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
  - Status: Fixed in #382: a paste or a drop is read by `pastedSheetHtml` (`desk-sheet-format.mjs`), which unwraps Docs' normal-weight `b`, treats a `div` holding blocks as a wrapper, and reads Docs' span styles (weight, italic, underline outside a link, line-through, super and sub) as their tags. Paste-only, so the stored format is unchanged. Tests: `desk-sheet-paste`.
- **BA71 (low). Word lists paste as paragraphs starting with “·” and
  spaces.** Word marks list items as `MsoListParagraph` paragraphs, with
  the bullet in `mso-list:Ignore` spans.
  - *Fix*: drop those spans, and rebuild runs of `MsoListParagraph*`
    paragraphs as `ul` or `ol`.
  - Status: Fixed in #382: in `pastedSheetHtml`, a paragraph whose style names a Word list level (or that holds a marker span) is a list item; runs of them become `ul` or `ol` by the marker (a number or letter with “.” or “)” is numbered), nested by level, with the marker spans gone. A “List Paragraph” with neither stays a paragraph.
- **BA72 (low, data loss). The last half-second of typing is lost when the
  tab closes.**
  - *What happens*: text saves 400 ms after the last keystroke, and the
    title and subtitle after 500 ms (`sheet-text.js:199–204, 1003–1007`;
    `sheet-pane.js:455–466`). Nothing saves on `pagehide`.
  - *Fix*: call `flushAll` on `pagehide` and on `visibilitychange` to hidden,
    starting the store write synchronously.
  - Status: Fixed in #382, and the fix needed more than the audit said. Chrome keeps no IndexedDB write made while a page closes unless it reads nothing, is committed at once, and isn't queued behind a transaction still waiting on its read (tested by reloading mid-typing). So every sheet save now opens its transaction when it is asked for, hidden starts the waiting saves, and on `pagehide` the pane applies what hasn't landed to its own copy and writes it through `store.writeNow`, which aborts the stuck reads first. Checked in the browser: text and a title typed just before a reload survive.
- **BA73 (low; likely). Dropping rich text skips the sanitizer until
  saved.**
  - *What happens*: the drop handler (`sheet-text.js:995–1001`) cancels file
    drops only. Dragged HTML shows its colors, fonts and images, which then
    disappear on reload.
  - *Fix*: on drop, take `text/html` or `text/plain` through the paste path.
  - Status: Fixed in #382: text dropped from elsewhere goes in at the drop point through the paste path (`caretAt`); words dragged from a sheet's own editor are still moved by the browser.
- **BA74 (low). Ctrl+Z on the formatting toolbar undoes the saved text but
  not the screen.**
  - *What happens*: `owningUndo` (`history.js:46–61`) covers fields and
    contenteditable only, so with focus on a toolbar button the desk's undo
    reverts the stored text. `draw()` (`sheet-pane.js:506–507`) skips a card
    that has focus, so the editor still shows the newer words. The next
    keystroke silently cancels the undo, and a reload shows different text.
  - *Fix*: treat the whole `.desk-rich-editor` as owning undo, or redraw the
    editor when an undo targets it.
  - Status: Fixed in #382: `owningUndo` (`history.js`) covers the whole `.desk-rich-editor`, and Ctrl+Z (Ctrl+Y, Ctrl+Shift+Z) on its toolbar undoes the typing in the text. Checked in the browser.

## FA1-k. Greek search commands

Files: `src/lib/greek-query.mjs`, `src/scripts/search-core.js` (the Greek
functions). Tests: `greek-query`, `greek-search`. CLAUDE.md desk rules 15 and
17; STUDY-DESK.md, “Greek search commands” and E5. Run queries against the
committed `public/greek/search/`, which a small harness can read from disk.
**From FA1-u**: BA116 (`float-window.js`), written up under FA1-u, area 3.

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
  - Status: **Fixed in #383.** `marksFrom` builds each match round its middle word, exact and cubic in a verse's words, and a search joins at most four words (`MAX_TERMS`, error `tooMany`, and a line in the commands window). Five terms is now the error; `*.sg` ×4 with `~v &` is timed in the tests.
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
  - Status: **Fixed in #383.** BVJ chose a stronger rule (2026-10-27): two or three plain words that are a whole gloss, sense or LIT rendering search as the gloss first; otherwise the command, falling back to the gloss as recommended (`searchGreekAuto`).
- **BA48 (low; reproduced). A filter with no word before it is silently
  dropped.**
  - *What happens*: `.gen`, `.gen/dat` and `.gen.dat` give no terms and no
    error (`greek-query.mjs:290–315`). The tray shows nothing, /search says
    “Type a search.”, and the tab says “Type a search, like πίστις.gen…”
  - *Fix*: read a leading filter as `*.` plus the filter, or say “‘.gen’
    needs a word before it, like πίστις.gen or *.gen.”
  - Status: **Fixed in #383.** A leading filter is read as `*.` plus the filter.
- **BA49 (low, perf; reproduced). `*.sg` downloads nearly the whole parse
  index.**
  - *What happens*: parse groups are split by part of speech and case, or
    tense and mood, which number, gender and person can't narrow
    (`groupsForFilters`, `greek-query.mjs:383–407`). So `*.sg` fetches 54 of
    57 files.
  - *Fix*: accept this and note it, or require a part of speech or case
    with those filters (an error sentence like `bareAny`'s).
  - Status: **Accepted** (BVJ, 2026-10-27), with a note in `groupsForFilters`; #383.
- **BA50 (low, copy; reproduced). The readback's “then” drops the distance
  and implies an order.**
  - *What happens*: `*.art, *.art, *.art ~v &` reads “Articles, with an
    article anywhere in the verse, in either order, then an article”
    (`describeGreekQuery`, `greek-query.mjs:486–491`).
  - *Fix*: repeat the distance for each later term, and drop “then” when the
    order is free.
  - Status: **Fixed in #383.** In any order: “Articles, with an article anywhere in the verse and an article anywhere in the verse, in any order.”

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
  - Status: **Fixed.** The pane notes the verse at the reading line whenever it settles (a scroll, a load above, a jump), with the size it was noted at, and its ResizeObserver puts that verse back when the size changes. A scroll before the observer runs doesn't replace the note. Checked in the browser four chapters deep in Romans: Romans 8:32 stayed 9px above the line at widths 450 to 801 and through a window resize.
- **BA56 (low). A chapter above that fails to load gives no message and no
  Try again.**
  - *What happens*: `lit-pane.js:308–318` gives up silently. At `scrollTop` 0
    nothing retries, because no scroll event fires. Chapters below already
    show both (295–300).
  - *Fix*: mirror the case below.
  - Status: **Fixed.** A chapter above that fails shows the same message and Try again at the top, added and removed without moving the text, and nothing above loads until it is pressed. Checked with Romans 3's fetch failing at the top of the pane.
- **BA57 (low; likely). The end of the New Testament can't reach the
  reading line in a tall pane.**
  - *What happens*: the 40vh of space below the text (`desk.css:5087–5088`)
    is less than the 75% of the scroller a full-height pane needs (`LINE =
    0.25`, `lit-pane.js:61`). So the Revelation stub never becomes the place
    by scrolling, and Revelation 22's last lines won't reach the line once
    it is published.
  - *Fix*: size the space below from the scroller, `clientHeight × (1 −
    LINE)`.
  - Status: **Fixed.** lit-pane.js sets `--desk-lit-below` to `clientHeight × (1 − LINE)` whenever the pane's size changes; 40vh stays the fallback. Checked: scrolled to the end, the Revelation stub becomes the place (“revelation 22”).
- **BA58 (low; reproduced). A stored layout whose sizes overflow fills 40%
  of the page.**
  - *What happens*: `checkLayout` accepts `[1e308, 1e308]`
    (`desk-layout.mjs:550–553`). `normalize` makes that `[0, 0]`, `fitSizes`
    raises it to a sum of 0.40 (161–162), and the line can't be dragged.
    Only a corrupted or hand-edited key does this.
  - *Fix*: reject a sum that isn't finite and above zero, and fall back to
    even sizes.
  - Status: **Fixed.** `checkLayout` also requires the sizes' sum to be finite, else even sizes; tested.
- **BA60 (low; reproduced). `/desk/?sheet=` can make a layout too wide for
  the window.**
  - *What happens*: `showSheet` (`desk-layout.mjs:373–385`;
    `desk-page.js:776–789`) adds a column without checking `needs`. Three
    columns need 852px, so a narrower window scrolls sideways.
  - *Fix*: check `needs`, and if the layout won't fit, show the sheet in an
    existing pane that isn't a LIT pane.
  - Status: **Fixed.** `showSheet(layout, id, width)` splits only when the new layout's minimum width fits the panes' width; otherwise the sheet takes the last pane that isn't a LIT pane, or, when every pane is one, the last pane, as with four panes open. desk-page.js passes the panes' width. Tested.
- **BA61 (low). Narrowing the window rewrites the reader's pane sizes for
  good.**
  - *What happens*: the sizes squeezed to fit the narrow window replace the
    reader's and are saved on the next change (`desk-page.js:643–646,
    763–768`). `fitSizes`'s own comment says the layout's sizes are left
    alone (`desk-layout.mjs:477–484`).
  - *Fix*: keep the reader's sizes in the layout, and fit only what is
    drawn.
  - Status: **Fixed.** desk-page.js keeps the reader's sizes in the layout and fits a drawn copy (`drawn`) to the room; a line the reader moves starts from its drawn sizes, and what they make of that split becomes theirs. Checked: at 700px the panes drew 57/43, a save kept 70/30, and widening drew 70/30 again.

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
  - Status: **Fixed.** The tour opens and expands the Notebook on the page alone: `open`, `showTab` and the rail's `show` and `expand` take `remember: false`, which writes neither `lit-desk-panel` nor `lit-desk-min` (the tab already wasn't written), so a tour cut short by a reload, Back or a link leaves the next page as the reader had it. `end()` still puts the panel back on this page.
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
  - Status: **Fixed.** Where `store` is null, first use shows no card and makes no offer, and the foot keeps only its links (Take the tour, Help, Tell us what’s missing), so My Notes’ own line (apostrophes curled) stands alone. The tour takes `canKeep` and leaves out the steps marked `notebook` in `TOUR_STEPS` (all of “Marking the text,” and undo, the notebook page and where it’s kept). The shell stamps `data-desk-no-notebook` on <html>, the command context reads it as `keeps`, and “Print with my notes” isn’t offered then. Tested.
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
  - Status: **Fixed.** Both prints go through `printLook` (`desk/print-look.js`): one desk print at a time, the attribute and the build taken away on `afterprint`, or, once `print()` has returned without one, on the reader’s next focus, pointer or key event (Ctrl+P’s own keydown among them). Tested with a fake window.
- **BA36 (low). Restarting the tour within a second lets the old timer
  remove its guard.** The 900 ms timer that removes `data-desk-tour`
  (`tour.js:575`) isn't kept or cleared by `start()` (471). Continue reading
  and a following ribbon then record the places the tour scrolls through.
  - *Fix*: keep the handle, and clear it in `start()`.
  - Status: **Fixed.** The timer removes `data-desk-tour` only when no tour is running, so one restarted within the second keeps its guard (the timer is set inside a frame, so a kept handle could be set after the restart).
- **BA37 (low, data loss; likely). Starting the tour throws away a note
  being written.** “Take the tour” runs `closePanel()` first
  (`tour.js:465`), which removes the open note editor and its unsaved
  words.
  - *Fix*: don't start while an editor holds changed text, or ask first.
  - Status: **Fixed.** The note editor says whether it holds unsaved words or a marker (`changed` on its panel; `editorHolds` in note-editor.js). The tour doesn’t start then: the editor says “Save or cancel this note first, then take the tour.” and takes focus.

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
  - Status: **Fixed.** Before a control is disabled or hidden while it has focus, the stage takes focus, and the keys are heard on the document (capture phase, removed in `finish`) while the stage or the body has focus, so they also work if focus ever falls to the page.
- **BA83 (low, a11y). The focus ring on the white paper preview is 2.4:1 in
  dark theme.**
  - *What happens*: `.sheet-copy` redefines `--green-text` but not
    `--focus-ring` (`sheets-page.css:124–154`), so a link on the white paper
    gets the dark theme's #3abf6a ring.
  - *Fix*: pin `--focus-ring: #0f6b33` on `.sheet-copy`, per CLAUDE.md's rule
    for fixed surfaces.
  - Status: **Fixed.** `.sheet-copy` pins `--focus-ring: #0f6b33` beside its `--green-text`, and the paper is in `src/styles/CLAUDE.md`'s table of pinned surfaces.
- **BA84 (low). The presenter view keeps saying no presentation is open.**
  - *What happens*: after Close and Present again, it keeps “The
    presentation was closed…”. Opened first, it says “No presentation is
    open for this sheet yet…” after 2.5 s. Its status clears only on a
    `state` message, and the stage answers a `hello` without sending one
    (`sheet-present.js:282, 712–723, 762–766`). `hello` also drops `role`
    (`desk-present.mjs:343`).
  - *Fix*: keep `role` in `hello` and treat a stage's `hello` as heard, or
    have the stage reply with its state.
  - Status: **Fixed.** `hello` keeps its `role` (`presentMessage`, tested), and a window hearing a `hello` draws it as heard, so the presenter view clears its status when the presentation opens, first or again.
- **BA85 (low; possible). The two-screen presenter view may blame the
  pop-up blocker for a slow permission prompt.**
  - *What happens*: `getScreenDetails()` can prompt, then
    `requestFullscreen({ screen })` uses the click, and `window.open` runs
    last and is blocked (`sheet-present.js:526–546`).
  - *Fix*: if permission had to be asked, say “Choose Presenter view
    again”, or open the window first. Needs two screens to check.
  - Status: **Fixed, not checked on two screens.** Before `getScreenDetails()`, the presenter view asks whether it will prompt (the `window-management` permission, once `window-placement`); if it did and the window is then blocked, it says “The browser asked about your screens first, so the presenter view didn’t open. Choose Presenter view again.” rather than blaming pop-ups. A second press doesn’t ask. FA1-v's two-screen check covers it.
- **BA86 (low, a11y). Poetry on a sheet loses its description.**
  - *What happens*: `passageWords` strips `aria-describedby`
    (`sheet-lit.js:221–224`). The page carries `#hbq-description` for it
    (`sheets.astro:24–25, 59`), but nothing points at it.
  - *Fix*: keep `aria-describedby="hbq-description"` on `.hbq` blocks.
  - Status: **Fixed.** `passageWords` keeps `aria-describedby="hbq-description"` and drops every other reference (/desk and /sheets both carry `#hbq-description`).

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
  - Status: **Fixed in #391.** `src/lib/desk-announce.mjs` holds the three
    sentences; `note-editor.js` (new or edited note) and `actions.js`
    (bookmark; a highlight that touches no other colour, since one that does
    already speaks through its undo notice) call `announce` after the write
    lands. The verse number's new name follows through BA22's label.
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
  - Status: **Fixed in #391.** `notes-margin.js`: `draw` notes the next note
    before it clears the aside, and when focus was on a control the drawing no
    longer has, `focusGone` puts it on the verse number the note sat on, else
    the next note (a note on a glossary entry or an article has no verse
    number). That runs on `draw`'s early exit too, which is the one deleting
    the last note takes. `keepPopover` re-points an open circle popover (its
    trigger and its `restoreFocus`) at the new circle after every redraw, or
    closes it onto the note's words when the note is no longer a circle. A
    selection's note editor gets the verse number its selection starts in as
    `restoreFocus` (`verseNumberOf`, `actions.js`). `note-editor.js`'s
    `landFocus` covers what the margin can't see: the margin's Edit button is
    `display: none` unless its note is hovered or focused, so the editor
    closing found no button to return to on Save, Delete, Cancel and ×, and
    focus now goes to the verse number when it would have fallen to the page.
    Checked in the browser on Romans 8 with the page's focus and live region
    read directly, not with a screen reader.
- **BA22 (low, a11y; seen in the browser; BVJ's call on wording). A verse's
  name doesn't say it is bookmarked.**
  - *What happens*: bookmarked Romans 8:28 is named just “Verse 28”
    (`verseLabel`). Rule 7 names highlights and counts notes; bookmarks, the
    one mark Read View also shows, are left out.
  - *Recommended*: “Verse 28, bookmarked”.
  - Status: **Fixed in #391** with the recommended wording (BVJ, 2026-10-27).
    `verseLabel` takes `bookmarked` and puts it right after the number, before
    the highlights (“Verse 3, bookmarked, highlighted yellow, 1 note of
    mine”); `bookmarkedVerses` reads it from the chapter's records, and it
    counts only while “My bookmarks” is on, like the other kinds.

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
  - Status: **Fixed in #392.** The Notebook's Escape stands down for
    `currentPanel()` only. A floating window takes its own Escape when focus
    is inside it and stops it there, so with focus in the Notebook, Escape
    now closes or collapses the Notebook and leaves the window open.
- **BA27 (low). Panels shrink to slivers beside a wide floating Notebook.**
  - *What happens*: `floatWidth` allows the window's width less 32px
    (`desk-margin.mjs:150–159`). Panels fit into what's left
    (`lit-panel.js:92–97`; `panel-pieces.js:192–198`). In a 900px window with
    the Notebook at 800px, a verse menu gets 60px.
  - *Fix*: when the room left is under about 300px, let the panel lie over
    the Notebook (its z-index is already above the rail's), or cap the
    floating width to leave a usable strip.
  - Status: **Fixed in #392**, by the first fix, since capping the width
    would undo BVJ's 2026-10-14 range ("no wider than the window less an
    EDGE each side"). `panelRoom()` in `desk-frame.js` is the one rule: the
    window less `dockWidth()`, or the whole window where that leaves under
    `MIN_PANEL_ROOM` (300px). `showPanel` and `placeClearOfSelection` use
    it. The Greek commands window (`greek-commands.js`) and the undo bar
    (`desk.css`) still measure against the dock alone; neither was in the
    finding.
- **BA28 (low). Some panels end up over the expanded Notebook.**
  - *What happens*: two cases:
    - `placeBesideTouchSelection` (`panel-pieces.js:161–180`) ignores
      `dockWidth()`, on touchscreen computers.
    - A panel already open when the Notebook expands stays where it was
      (`panel.js:345–358`).
  - *Fix*: subtract `dockWidth()`, and close or re-place the open panel when
    the dock grows (in `margin.js`'s `place()`).
  - Status: **Fixed in #392.** `placeBesideTouchSelection` keeps to
    `panelRoom()` (a phone has no dock, so it is unchanged there). `place()`
    remembers the room it kept, and when that grows it calls
    `keepClearOfDock()` (`lit-panel.js`), which moves the open panel left by
    `shiftClearOfDock` until it ends 12px short of the Notebook, never past
    12px from the window's left. Moved rather than closed, since the open
    panel may be a note editor holding unsaved words. A bottom sheet stays.

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
  - Status: **Fixed in #396.** `isAppPlatform` and the pre-paint copy also
    count `userAgentData.mobile`, and a Linux user agent with a touch screen
    unless it is a Chromebook (“CrOS”). The user agents are in
    `test/desk-prepaint.test.js` and `test/announcement-gate.test.js`.
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
  - Status: **Fixed in #396**, by the first fix, made exact rather than
    rough: the pre-paint script repeats `firstPaint` (`desk-margin.mjs`),
    which works out the 48 column's width from the reader's font and text
    size and stamps `data-desk-expanded` only where `placeInMargin` will keep
    the notebook in the margin. The window it reads is the width less the
    scrollbar, measured on a throwaway element: before the critical CSS's
    scrollbar gutter is laid out, `clientWidth` still includes it, which left
    a 16px band. Checked in a browser: the stamp now flips at a 898px layout
    width, where the notebook stops floating.
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
  - Status: **Fixed in #396.** `standDown()` (`desk-frame.js`) removes
    `data-desk` too, so the Notebook buttons hide and the column goes back to
    the reader's, along with the panel, expanded and widths stamps and their
    properties, any rail and width handles, and the column's move. The gate
    calls it when the shell fails to load, and the shell when `start()`
    fails before the panel is built; after that a failure is only logged.
    Each tab is built in its own try/catch, and one that throws shows “This
    tab couldn’t load.”
- **BA30 (low). Widths dragged in a wide window make a narrower one open
  off-center, then jump.**
  - *What happens*: the pre-paint script checks only `x >= 280`
    (`Layout.astro:104`; `global.css:3484–3486`). A stored 600px width in a
    small window gives the column a 640px right margin until `margin.js`
    runs after the store opens.
  - *Fix*: skip stamping a width above about half the window.
  - Status: **Fixed in #396**, more fully than the suggested threshold: the
    script gives the kept widths way exactly as `placeWithWidths` does (the
    notebook first, then the LIT) and stamps what fits, or nothing where they
    don't fit at all. Checked in a browser at 1440, 1100 and 800px.

## FA1-r. /desk's smaller fixes

Files: `src/scripts/desk/tab-mine.js`, `tab-verse.js`, `desk-panes.js`,
`desk-page.js`, `lit-pane.js`, `chapter-page.js`. Tests: `desk-layout`.
After FA1-e and FA1-l. **From FA1-u**: BA114 and BA115 (the Greek pane and
the commands window on /desk), written up under FA1-u, area 3.

- **BA31 (low). Two My Notes panes share their filters, and closed panes
  leave listeners behind.**
  - *What happens*: `colorFilter` and `labelFilter` are module-level
    (`tab-mine.js:88–90, 672`). The `SETTINGS_EVENT` and `lit:panel-actions`
    listeners (`tab-mine.js`; `tab-verse.js:479–483`) outlive a pane, since
    `destroy()` only unsubscribes the store (`desk-panes.js:333–359`).
  - *Fix*: move the filters into `createMineTab`'s closure, and return the
    listener removals for `destroy()`.
  - Status: **Fixed in #398** (FA1-r). The filters are each tab's own; My Notes, This verse and Greek each return a `destroy` that the pane calls when it closes or builds a tab for another chapter, and My Notes' Places section (`places.js`), which held a store subscription and two window listeners per pane, takes them down too.
- **BA62 (low, copy). The “Leading” hover text leaves out My Notes.** It
  should read “My Notes, This verse, Greek, and Footnotes follow this pane.”
  (`desk-page.js:409`; also the header comment at 23–24).
  - Status: **Fixed in #398** (FA1-r), in the hover text and the header comment.
- **BA63 (low, a11y). The Layout menu stays open when keyboard focus leaves
  it.**
  - *Fix*: close it on `focusout` to anywhere outside the menu and its
    button (`desk-page.js:305–322, 572–577`).
  - Status: **Fixed in #398** (FA1-r). Focus moving to anything outside the menu and its button closes it; focus going nowhere (another window) leaves it to the click elsewhere, as before.
- **BA64 (low, perf; likely). Scrolling past the Acts stub cycles the
  shared place through up to 28 chapters.**
  - *What happens*: `placeNow` (`lit-pane.js:265–270`) maps the line's
    position in the stub to Acts 1 to 28. Each change sets This verse,
    Footnotes and Greek fetching that chapter, about one request per frame.
  - *Fix*: report a stub's first chapter only, or debounce `follow()` while
    the LIT pane scrolls.
  - Status: **Fixed in #398** (FA1-r). A place in a stub is told once the reading line has rested there 300ms (`STUB_SETTLE` in `lit-pane.js`), so a reader who stops in Acts still has the Greek follow to that chapter; a place outside a stub is told at once, as before.
- **BA65 (low, perf). Every fetched chapter's whole page is kept for the
  visit.**
  - *What happens*: `chapter-page.js:22–23, 55–87` keeps the whole parsed
    page, header and footer included. Over the corpus that is 28.9 MB of
    HTML, where the pane needs much less. Keeping chapters for the visit is
    BVJ's 3e decision.
  - *Fix*: keep only the text, footnotes, term data, Go deeper, and the
    content-version fields.
  - Status: **Fixed in #398** (FA1-r). `keepParts` in `chapter-page.js` moves the text, the footnote lists and Go deeper into a small document of their own (still `source.doc`, which the handout and the sheets read); the key-term data and the content version are read as values first.

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
  - Status: **Fixed in #399** (FA1-s). `src/lib/greek-credits.mjs` holds the Greek tab's sources and the line, which the tray (`searchbar.js`) and /search (`search.astro`, at build) draw under every Greek group: “Greek: SBLGNT; parsing: MorphGNT and MACULA Greek; glosses: UBS and STEP Bible (licenses).” MACULA is added, since it gives the index its Strong's numbers and two passages' parsing. Tested in `test/greek-credits.test.js`.
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
  - Status: **Fixed in #399** (FA1-s). The section names TBESG's brief glosses (CC BY 4.0) for most lemmas, points to github.com/STEPBible as `step/` and `lsj/` do, and keeps the rest of `search/` CC BY-SA 4.0, which MorphGNT's ShareAlike requires. `test/greek-credits.test.js` holds the file to `LICENSE_TEXT`.
- **BA40 (low; BVJ's call). A Greek search never looks in the notebook, and
  the notebook's matching misses a final sigma typed as σ.**
  - *What happens*: a Greek query returns before the “Your notebook” group
    is built (`searchbar.js:883–917`). Rule 15's “Greek alone” was about
    English verse results, not the reader's own notes. Separately,
    `desk-search.mjs:30` doesn't fold ς: “πιστισ” finds nothing where
    “πιστις” finds the note.
  - *Recommended*: fold ς to σ either way. BVJ to say whether a Greek query
    lists the reader's matching notes.
  - Status: **Fixed in #399** (FA1-s). BVJ chose to list them (2026-10-28): under all types, the notebook's matches come ahead of the Greek in the tray and on /search's first page, still with no English group. `desk-search.mjs`'s `fold` reads ς as σ. Tested in `test/desk-search.test.js`.

## FA1-t. Copy and docs

Files: `src/lib/desk-change.mjs`, `src/scripts/desk/change-notice.js`,
`src/pages/notebook/help.astro`, `src/scripts/desk/notebook-page.js`,
`src/pages/privacy.astro`, the four desk pages' titles. CLAUDE.md, “Key
Conventions” (American copy, curly quotes). Small enough to finish with a
read-through of the desk's other reader-facing strings. **From FA1-u**:
BA91 (area 1), BA109 (area 2) and BA118 (area 3), written up there.

- **BA15 (low, copy). The change notice uses straight apostrophes and mixed
  quote marks.**
  - *What happens*: “couldn't,” “isn't” and “can't” are straight here and
    curly everywhere else. “You pinned: ‘…’” sits beside “Your note was on:
    “…”.” The code comment saying straight is the desk's style is out of
    date.
  - *Where*: `desk-change.mjs:345–420`; `change-notice.js:371–376, 426–458`.
  - Status: **Fixed in #400** (FA1-t). Every quotation in the notice uses double curly quotes, and the apostrophes are curly; `test/desk-change.test.js` checks every notice kind for a straight one.
- **BA38 (low, copy). The help page's “Type ‘tour’” doesn't work where it is
  read.**
  - *What happens*: the help page isn't a reading surface, so typing “tour”
    there lists no command. On a chapter, Enter on “tour” goes to /search;
    only clicking the row, or typing “>tour,” starts it
    (`help.astro:156–157`; `desk-commands.mjs:112–118`;
    `searchbar.js:1179–1222`).
  - *Fix*: reword the line, or let Enter run a lone matching command.
  - Status: **Fixed in #400** (FA1-t), by rewording: “On a page of scripture, for example, type “>tour” and press Enter.” Enter running a lone match was not taken, since it would take over a search for the word.
- **BA39 (low, copy; BVJ's call). “Moves it to the trash for 30 days”
  suggests it can be fished back out.**
  - *What happens*: Undo works only until the page is left, and nothing
    lists or restores the trash (`help.astro:81–83`;
    `notebook-page.js:132`).
  - *Recommended*: “Undo brings it back until you leave the page; after
    that, only a saved copy does.” Or drop “for 30 days.”
  - Status: **Fixed in #400** (FA1-t). BVJ chose the recommended wording (2026-10-28), and asked for a Phase 5 task to make a restorable trash true on the website (STUDY-DESK.md, E12).
- **BA42 (low, docs). /privacy doesn't name `sessionStorage['lit-desk-ribbon']`.**
  This is the C25 key that lets a ribbon follow the reader within a book
  (`ribbon-follow.js`; `desk-places.mjs`). Every other desk key is named.
  Rule 13 says to keep the privacy paragraph in step.
  - Status: **Fixed in #400** (FA1-t).
- **BA43 (low, copy; BVJ's call). The desk's pages are titled differently
  from the rest of the site.**
  - *What happens*: “Notebook | LIT Bible,” “Your notebook | LIT Bible” (the
    help page), “Study Desk | LIT Bible” and “My sheets | LIT Bible” sit
    beside “Romans 8 | Liberation and Inclusion Translation.”
  - *Recommended*: the site's own suffix, and “Notebook help” for the help
    page.
  - Status: **Fixed in #400** (FA1-t). BVJ chose the site's suffix (2026-10-28), for /privacy too: “Notebook help,” and “My sheets” before and after the script runs.

## FA1-u. The follow-up audit: code this audit didn't reach

**Progress**: done. Areas 1 to 3 on 2026-10-26 (BA88 to BA120, #376) and
areas 4 to 6 the same day (BA121 to BA145), all written up below the six
areas.

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

## The follow-up audit's findings

From FA1-u. BA88 onward, by area.

### Area 1: What's new for you and your own chains (done 2026-10-26)

BA89, BA93, BA94 and BA95 are in phase FA1-x, BA91 is in FA1-t, and
the rest are in FA1-w. **Every row of the real feed was run**:
`src/data/release-notes.json` held 70 publishes and 556 rows, 477 of them
the three kinds B3 reads. 466 of those yield verses, and all 466 agree with
an independent parser: ranges, lists (“Luke 11:2, 20, 43–44, 47”), “Romans
16:24 and 25–27,” long footnote lists and relabel suffixes. The other 11
are early `footnote_updated` rows that name no verse (“John 8 — footnote k
updated”), so nothing can be read from them. The 79 other rows (new
chapters, intros, glossary, articles) rightly yield none.

- **BA88 (medium; reproduced). A feed that fails to load once stays failed
  until the page is reloaded.**
  - *What happens*: `loadReleaseNotes` keeps its promise in `pending`,
    a `null` result included. After one network error, every later call on
    the page returns that `null` without fetching. The notebook page says
    “The release notes couldn’t be loaded just now. Try again in a moment.”,
    but nothing it can do tries again. The change notice's date line
    (`change-notice.js:350`) and `sheet-lit.js:278` read the same promise.
  - *Where*: `release-feed.js:33–49`; the message is `whats-new.js:150`.
  - *Fix*: forget `pending` when the result is `null`, and give the message
    a Try again button.
  - *Check*: a test with a `fetch` that fails once and then succeeds: the
    second `loadReleaseNotes()` fetches again.
  - Status: **Fixed in #401** (FA1-w). `loadReleaseNotes` forgets a failed fetch, so the next call fetches again; the notebook page's message has a Try again button. Tested in `test/release-feed.test.js` (a fetch that fails once, then succeeds).
- **BA89 (medium; reproduced; BVJ chose the stricter mode, 2026-10-26). A bare
  number after a reference in a note links as a verse.**
  - *What happens*: notes use the shared linker as footnotes do, and its
    list rule (`src/lib/CLAUDE.md`, rule 1: “10:23, 33,” “11 and 14”) reads
    a number after a comma or “and” as another verse. Readers write that
    way in prose: “See Romans 8:28, 3 reasons why” links “3” to Romans 8:3,
    “John 3:16 and 2 others” links John 3:2, and “Luke 2:1, 100 years”
    links Luke 2:100. Each is a chain too, so This verse lists the note
    under a verse it never meant (“Mentioned in your note…”). The browser
    has no verse counts, so `hasVerse` is always true (`desk-chains.mjs`'s
    header records this for gaps like Matthew 17:21, but not for verses past
    a chapter's end).
  - *Where*: `desk-chains.mjs:43–45, 54–66`; `scripture-refs.mjs:117–121,
    150–190`.
  - *Fix* (BVJ, 2026-10-26: “go with the stricter mode for notes”): give
    notes a stricter mode of the linker. In it, a bare number continues a
    list only when it is itself a reference with a colon (“8:28, 30” no
    longer links “30”; “8:28; 9:1” and “8:28, 9:1” still do), so
    “8:28, 3 reasons” stays plain. Footnotes, intros and articles keep
    today's rule. Also pass a `hasVerse` from a small committed table of
    verse counts per chapter, checked by a test against the chapter files,
    so a verse past a chapter's end never links.
  - *Check*: `noteBodyHtml("John 3:16 and 2 others")` leaves “2” plain;
    `citedRefs("Luke 2:1, 100 years")` cites only 2:1.
  - Status: **Fixed in #402** (FA1-x). A note is linked in a note mode of the linker (`linkScriptureRefs(html, { mode: "note", hasVerse })`, called from `desk-chains.mjs`). A list continues only with a chapter:verse, so “Romans 8:28, 3 reasons,” “John 3:16 and 2 others,” and “8:28, 30” link the first reference alone, while “8:28, 9:1” and “8:28; 9:1” link both. The committed table `src/data/verse-counts.js` (the last verse number of every chapter, from the SBLGNT and the LIT) is passed as `hasVerse`, so “Luke 2:100” links nothing, and a gap inside a chapter (Matthew 17:21) still lands on its chapter. Footnotes, intros and articles keep their rule. Tested in `test/scripture-refs.test.js` and `test/desk-chains.test.js`; `test/verse-counts.test.js` checks the table against the SBLGNT and the chapter files.
- **BA90 (low; reproduced). What's new for you treats a note on a footnote as
  a note on its verse.**
  - *What happens*: `markVerses` takes any note or pin with a verse and
    never asks `onFootnote`, which rule 23 requires of code that reads a
    note's verse. So a change to a verse's wording “touches” a note on one
    of its footnotes, and the line says “Touches your note on Luke 24:4.”
    (`markLinks` names it by `recordReference`, so it also merges with a
    real note on that verse.) A footnote pin is matched by wording changes
    the same way.
  - *Where*: `desk-whats-new.mjs:26–46`; `desk-whats-new-view.mjs:50–60`.
  - *Fix*: let footnote notes and pins match only `footnote_added` and
    `footnote_updated`, and name them with `recordWhere` (“your note on a
    footnote in Luke 24:4”), kept apart from the verse's own note.
  - *Check*: `marksTouched(textChange, [noteOnFootnote])` is empty.
  - Status: **Fixed in #401** (FA1-w). `marksTouched` lets a pinned footnote or a note on a footnote match only `footnote_added` and `footnote_updated` (`onAFootnote`), and `markLinks` names a footnote note with `recordWhere` (“your note on a footnote in Luke 24:4”), apart from a note on the verse. Tested in `test/desk-whats-new.test.js` and `test/desk-whats-new-view.test.js`.
- **BA91 (low, copy; reproduced). “Touches …” has no Oxford comma and names
  the verse each time.**
  - *What happens*: “Touches your note on Luke 24:4, your highlight on Luke
    24:4 and your bookmark on Luke 24:4.”
  - *Where*: `whats-new.js:75`; `desk-whats-new-view.mjs:55`.
  - *Fix*: group by place: “Touches your note, highlight, and bookmark on
    Luke 24:4.”, with the comma before “and” from three on.
  - Status: **Fixed in #400** (FA1-t). `markLinks` groups by place; `listSeparator` and `joinList` hold the Oxford comma. Tested in `test/desk-whats-new-view.test.js`.
- **BA92 (low; reproduced). “Last looked” misses a second publish on the same
  day, and a publish on the evening a mark was made.**
  - *What happens*:
    1. The drafter folds a second publish on one day into that day's entry
       (`draft-release-notes.mjs:160–175`). After a look, `seen` is that
       date, so the added changes are never New. The view's header records
       this as the one case it can't tell apart; the folding makes it the
       ordinary case on any day with two publishes (2026-04-20 had one).
    2. `textDay` takes a mark's day from its build's content version or
       `created`, both UTC, while entries are dated in Pacific time. A mark
       made on a page built on a Pacific evening carries the next day, so a
       publish that evening is left out.
  - *Where*: `desk-whats-new-view.mjs:76–79`; `desk-whats-new.mjs:66–69`;
    `desk-change.mjs:475–482`.
  - *Fix*: keep the newest entry's change count beside the date and treat
    more changes on that date as New; compare the mark's Pacific day.
  - *Check*: tests with a folded same-day entry and a `v20261026.*` mark
    against an entry dated 2026-10-25.
  - Status: **Fixed in #401** (FA1-w). “Last looked” is saved as the day and its publish's change count (`"2026-10-26+3"`, `seenValue`); `isNewChange` treats changes past the count on that day as New, and an old bare day reads as before. `textDay` reads a timestamp as its Pacific day and a content version's UTC day as the day before. Tested with a folded same-day entry and a `v20261026.*` mark against an entry dated 2026-10-25.
- **BA93 (low; traced). “Mentioned in your note on…” lists notes in no
  order.**
  - *What happens*: `notesCiting` keeps `store.all()`'s order, which is
    IndexedDB's by id, and ids are random UUIDs.
  - *Where*: `desk-chains.mjs:92–106`; `tab-verse.js:193`.
  - *Fix*: sort by book, chapter, verse and `created`, as `liveRecords`
    does.
  - Status: **Fixed in #402** (FA1-x). `notesCiting` sorts its result with `byPlace`, the comparator `liveRecords` now shares (exported from `desk-store-core.mjs`): Bible order, then when the note was made. Tested in `test/desk-chains.test.js` and `test/desk-store-core.test.js`.
- **BA94 (low; reproduced; partly BVJ's call). A note's reference is read only
  as the shared linker reads it.**
  - *What happens*: a range into another chapter (“John 3:16–4:2”) links
    and chains only its first verse; a chapter range (“Hebrews 6–9”) only
    its first chapter. Lowercase and informal forms (“john 3:16,” “rom
    8:28,” “Jn 3:16,” “Mt 5:3,” “1Cor 13:4”) don't link or chain at all.
    “Gal 3.28” chains the whole chapter. Footnotes are typed carefully;
    readers' notes aren't.
  - *Where*: `scripture-refs.mjs:66–80, 150–190`; `desk-chains.mjs:47`.
  - *Fix*: the reader mode of BA89, accepting any case and common short
    names, and a cross-chapter span in `citedRefs`.
  - Status: **Fixed in #402** (FA1-x), in note mode, except that the set of short names awaits BVJ's confirmation (STUDY-DESK.md, Decisions, 2026-10-28). New Testament names match in any case and in common short forms (“john 3:16,” “rom 8:28,” “Jn 3:16,” “Mt 5:3,” “1Cor 13:4,” “Revelations”), and a period may separate chapter and verse (“Gal 3.28”). A name not written as the site writes it links only with a verse, so “mark 3 places” stays plain. Hebrew Bible and apocrypha names stay exact-case, so a lowercase “is 3:15” is not Isaiah. A range into a later chapter carries its end on the link as `data-end` (“John 3:16–4:2,” “Hebrews 6–9”), and `citedRefs` lists it chapter by chapter. Tested in `test/scripture-refs.test.js` and `test/desk-chains.test.js`.
- **BA95 (low, performance; reproduced). A long run of spaces in a note stalls
  the page.**
  - *What happens*: the linker's lookbehind rescans a whole whitespace run
    at every position, so a note with 40,000 spaces takes 3.5 s to draw and
    200,000 over a minute. Notes have no length cap and redraw often.
    Ordinary notes are fast.
  - *Where*: `scripture-refs.mjs:58, 108`.
  - *Fix*: bound the lookbehind's whitespace (`{1,4}`), or collapse long
    runs before linking.
  - *Check*: `noteBodyHtml("John" + " ".repeat(40000))` under 50 ms.
  - Status: **Fixed in #402** (FA1-x). The linker's lookbehind bounds its whitespace run (`SP_BEHIND`, at most four), so a note of 40,000 spaces draws in about 2 ms, not 3.5 s. It applies to footnotes, intros and articles too, with no change in what they link. Tested in `test/scripture-refs.test.js`.
- **BA96 (low; traced). The My Notes line about news stays after the notebook
  page has been looked at.**
  - *What happens*: `setMeta` tells no one, so a chapter's My Notes tab in
    another tab keeps “Two changes since your last visit…” until the next
    record change or reload, linking to a page where nothing is New.
  - *Where*: `store.js:122–126`; `tab-mine.js:370–385`.
  - *Fix*: post a channel message when `whatsNewSeen` is set.
  - Status: **Fixed in #401** (FA1-w). `setMeta` posts a meta message of its own (`metaMessage`, which `readChangeMessage` ignores) and `store.onMeta` hears it, so the Notebook panel and /desk's My Notes pane redraw the line without every tab redrawing its marks. Tested in `test/desk-store-core.test.js`; the two-tab redraw itself is not.
- **BA97 (low; traced). The What's new section redraws whole on every change
  and has no error path.**
  - *What happens*: any notebook change, in any tab, rebuilds the list, so
    focus in it is lost. A failed `store.all()` leaves the section empty
    and an unhandled rejection (`notebook-page.js:156`).
  - *Where*: `whats-new.js:134–181`.
  - *Fix*: skip a redraw when what it finds is unchanged; catch and say so.
  - Status: **Fixed in #401** (FA1-w). The list is rebuilt only when what it shows changed (a signature of the drawn publishes), and a failed read says “Your notebook couldn’t be read just now.” with Try again instead of an unhandled rejection. Not unit-tested (DOM).
- **BA98 (low, tests; traced). A `text_updated` row without verses says
  nothing, and no test reads the whole feed.**
  - *What happens*: the drafter can write “John 7 — updated” and “John 7 —
    text updated” with no verse (`release-notes-core.mjs:310, 336`). None
    exist yet; `changeVerses` returns `null` for them, so a mark in that
    chapter hears nothing. The real-feed test checks three descriptions, so
    a change that broke the description reading would pass while all 466
    rows went quiet.
  - *Where*: `desk-change.mjs:425–472`; `test/desk-whats-new.test.js:213–227`.
  - *Fix*: read such a row as the whole chapter; add a test that every
    `text_updated` row in the real feed yields verses.
  - Status: **Fixed in #401** (FA1-w). `changeVerses` reads a `text_updated` row that names no verse as the whole chapter, its chapter taken from “John 7 — updated” when there is no `location`. A test checks that every `text_updated` row in the real feed (238 today) yields verses.

### Area 2: places and ribbons (done 2026-10-26)

All but BA109 are in phase FA1-y; BA109 is in FA1-t. E9 (2026-10-22) will turn ribbons into
Bookmarks, but nothing is built yet, so these describe today's code. Each
one says whether E9 would make it moot. The reproductions are Node scripts
that drive the real `ribbon-follow.js`, `last-read.js` and
`desk-places.mjs` with stubbed storage and events.

- **BA99 (medium; reproduced). Following a ribbon's link on the page it
  points into writes the reader's old place to the ribbon.**
  - *What happens*: `followRibbon` sets the flag and calls `env.restart()`,
    which is `hear(loadLastRead())`: where the reader *was*, not where the
    link goes. No move has been written yet, so `throttleDelay` gives 0 ms,
    and the ribbon is saved at the old place before the link's jump is
    recorded. In Study View a ribbon at Romans 8:30, clicked from 8:2,
    becomes 8:2. In Read View every ribbon in the book is on the same page,
    so a ribbon at 12:1, clicked from 3:1, becomes 3:1. The next scroll save
    moves it on about four seconds later, but a reader who opens a ribbon to
    check it and leaves at once loses the place. No undo entry is made
    (`record: false`). A link into another chapter heals on arrival, since
    that page starts fresh.
  - *Where*: `ribbon-follow.js:64–67, 106–122`; the click is
    `places.js:157–159`.
  - *Fix*: on `followRibbon`, set the flag only and wait for the next
    `lit:last-read` after the jump. Or ignore a position whose `t` is older
    than the click.
  - *Check*: a `test/ribbon-follow.test.js` with stubbed storage: after
    `followRibbon` and 50 ms, the ribbon is still at its own verse.
  - *E9*: not moot while a bookmark can follow the reader this way.
  - Status: **Fixed in #PRNUM** (FA1-y). `followRibbon(ribbon, href)` sets the flag and forgets where the reader was; it doesn't read the stored record. A link within the page moves the ribbon at the page's next report of where the reader is, after the jump, and a link to another page stops this page listening, so its pagehide save isn't written either. The follower starts from `pageLastRead()` (last-read.js): what this page saved, never what storage holds. Tested in `test/ribbon-follow.test.js` (stubbed storage, events and store), and in the browser: a ribbon at Romans 8:30 opened from 8:2 stayed at 8:30 until the page reported the jump.
- **BA100 (medium; reproduced). Arriving in Read View moves a following ribbon
  to another tab's place in that book.**
  - *What happens*: `positionOnPage` accepts any Read View record for the
    book, whatever its chapter (Study View also requires the chapter).
    `lit_last_read` is shared by every tab, and Read View saves its own
    place only after the landing settles. So when tab A opens
    `/read/romans/#romans-8-v3` through a ribbon while tab B reads Romans 12
    in Read View, the ribbon moves 8:3 → 12:1 before tab A has scrolled. An
    older Read View visit in the same tab does the same. It heals on the
    next save, as in BA99.
  - *Where*: `desk-places.mjs:135–141` (`:138`), from
    `ribbon-follow.js:120–122`.
  - *Fix*: at arrival, wait for this page's own first `lit:last-read`
    rather than reading the stored record; or accept a Read View record
    only for the chapter the page landed on.
  - *Check*: a `positionOnPage` test with a Read View record for another
    chapter, plus the follower test above.
  - *E9*: as BA99.
  - Status: **Fixed in #PRNUM** (FA1-y), with BA99: arriving, the follower reads `pageLastRead()`, this page's own save, so another tab's Read View place in the book, or an older visit's, is never taken. `positionOnPage` is unchanged. Tested in `test/ribbon-follow.test.js`.
- **BA101 (medium; reproduced). A ribbon keeps following after the reader has
  left its book for a page without the Notebook.**
  - *What happens*: only `initRibbonFollow` clears the flag, and it runs in
    the shell, which loads only on reading surfaces (`desk-gate.js:11–14`).
    The home page, /search, /read, /notebook, /desk, /about and the rest
    never clear it. Follow a ribbon in Romans, go home, search, and open
    Romans 11 from the results later in that tab: the ribbon moves to 11:1,
    with no undo. Rule 13 and the comments (`desk-places.mjs:20–23`,
    `ribbon-follow.js:9`) say "a page outside the book clears it."
  - *Fix*: clear the flag from code every page runs with the preview on,
    such as `desk-gate.js` (a page outside the flagged book drops it), or
    stamp the flag with the page it was set on and honor it only on the
    next page of an unbroken run in the book.
  - *Check*: a test that loads the flag, a page without the shell, then a
    page in the book, and expects no write.
  - *E9*: moot only if the per-tab flag goes.
  - Status: **Fixed in #PRNUM** (FA1-y). `desk-gate.js`, which every page runs, drops `lit-desk-ribbon` on any page where the shell won't load (the key is RIBBON_FLAG_KEY, written out so the gate stays small). `initRibbonFollow` drops it outside the book even when the notebook didn't open, and a page restored from the back-forward cache reads the flag again (`pageshow`), since the tab may have left the book meanwhile. Tested in `test/ribbon-follow.test.js`, and in the browser (the home page cleared it).
- **BA102 (low; reproduced). Renaming, moving and following read a ribbon in
  one step and write it in another.**
  - *What happens*:
    1. Rename (`places.js:252–254`) and Move here (`ribbon-form.js:129–133`)
       save `(await store.get(id)) ?? ribbon`. If another tab, or a /desk
       pane, deleted the ribbon meanwhile, the stale copy is saved and the
       deleted ribbon comes back beside its own trash record.
    2. The follower's `store.get` then `store.commit`
       (`ribbon-follow.js:89–100`) can save over a rename made in another
       tab in between. The window is a few milliseconds.
    3. The ribbon form reads the ribbons once when it opens (`:34–39`), so
       its name check and six-ribbon limit can be stale, and Save isn't
       disabled while saving, so a double press can make two ribbons of one
       name (trace only).
  - *Fix*: make all three one `store.change` that reads the record inside
    the transaction, writes nothing when it is gone or no longer a ribbon,
    and re-checks the name and the limit against `all()`. Disable Save
    while saving. Rule 11 and BA13 already ask for `store.change` here.
  - *Check*: tests with a fake store whose `get` waits, as in the
    reproduction.
  - *E9*: not moot; the same code becomes the bookmarks'.
  - Status: **Fixed in #PRNUM** (FA1-y). All three are one `store.change` now. Rename, Move here and a new ribbon go through `src/lib/desk-ribbon-change.mjs` (`planRibbonRename`, `planRibbonMove`, `planRibbonCreate`, pure), which reads the ribbon in the transaction, writes nothing when it is gone, in the trash or no longer a ribbon (“That ribbon has been deleted.”), and checks the name and the six-ribbon limit against `all()`. Save is disabled while saving. The follower reads and writes its move in one `store.change` with `record: false`. Tested in `test/desk-ribbon-change.test.js` (a fake store whose reads wait) and `test/ribbon-follow.test.js` (a rename and a deletion landing between the follower's read and write), and in the browser (renaming a ribbon deleted meanwhile said so and brought nothing back).
- **BA103 (low; reproduced). Stored book names like `constructor` pass as
  books.**
  - *What happens*: `loadLastRead` checks `BOOKS[r.book]`
    (`last-read.js:27–29`) and `desk-places.mjs` uses `in BOOKS`
    (`:88, :90, :92, :103, :174`), so `constructor`, `toString` and
    `__proto__` pass. Continue reading then offers “Constructor 1” at
    `/constructor-1/`, a 404, and a verse of −5 gives `#v-5`. Only a
    hand-edited or damaged store reaches it.
  - *Fix*: `Object.hasOwn(BOOKS, key)` in all of them, and require
    `verse >= 1`.
  - *Check*: `loadLastRead` and `parseRibbonFlag` tests with those names.
  - *E9*: not moot.
  - Status: **Fixed in #PRNUM** (FA1-y). `Object.hasOwn(BOOKS, …)` in `loadLastRead` and throughout `desk-places.mjs`, and `loadLastRead` requires a verse of 1 or more. Tested in `test/desk-places.test.js` (`constructor`, `toString` and `__proto__`).
- **BA104 (low; traced). A verse in the address that isn't on the page is
  recorded as the reader's.**
  - *What happens*: `trackStudyView` saves `hashVerse()` without checking
    the page has that verse (`last-read.js:106–112`). `/matthew-17#v21`
    (a verse the LIT doesn't have) or `#v999` becomes Continue reading's
    verse, whose link then lands at the top, and a following ribbon moves
    there.
  - *Fix*: use the hash's verse only when a `v<N>` marker exists;
    otherwise `verseAtReadingLine`.
  - *Check*: a test with a marker list lacking the verse.
  - *E9*: not moot.
  - Status: **Fixed in #PRNUM** (FA1-y). `verseInHash` (last-read.js) takes the address's `#vN` only when the page has a `vN` marker (`v41b` counts as 41); otherwise arrival records no verse, as a chapter opened at its top does.
- **BA105 (low, accessibility; traced). Two rename forms can be open at once,
  with one id.**
  - *What happens*: `startRename` doesn't check `editing`, and every form in
    a group uses `deskPlacesName${n}`, so a second Rename gives a second
    input with the same id, and its label names the first one. Saving or
    cancelling either redraws the group and throws away the other's typing.
  - *Where*: `places.js:187–219`.
  - *Fix*: while a rename is open, Rename on another row closes it first
    (or does nothing).
  - *Check*: a DOM test pressing Rename on two rows.
  - *E9*: moot if the list drops inline rename.
  - Status: **Fixed in #PRNUM** (FA1-y). Rename on another row closes the open form first, as its Cancel would, putting that row back as it was without a redraw, so there is one form and one id. A late Cancel or save from the closed form does nothing. Checked in the browser: Rename on two rows left one form, focused.
- **BA106 (low; reproduced). A ribbon's name can be cut through an emoji.**
  - *What happens*: `cleanRibbonName` cuts at 40 UTF-16 units
    (`desk-places.mjs:44–50`), so an emoji at the end leaves half of it. The
    name isn't well-formed: `encodeURIComponent` throws on it, and the
    record syncs to the apps that way.
  - *Fix*: cut by code point (`Array.from(s).slice(0, 40).join("")`).
  - *Check*: `cleanRibbonName("x".repeat(39) + "😀").isWellFormed()`.
  - *E9*: not moot while names are capped.
  - Status: **Fixed in #PRNUM** (FA1-y). `cleanRibbonName` cuts at 40 code points (`Array.from`). Tested in `test/desk-places.test.js`.
- **BA107 (low, performance; traced). A following ribbon redraws the notebook
  everywhere, and the Places group never unsubscribes.**
  - *What happens*: each move is a commit, which every view and every other
    tab hears, and the notebook page, /desk's panes and the My Notes tab
    redraw whole (`notebook-page.js:393`, `desk-panes.js:317, 365`,
    `kept-list.js:80`), even though `kept-list` doesn't show places. So
    about every four seconds while a ribbon follows the reader, a /notebook
    or /desk tab elsewhere can lose focus or an open menu. Separately,
    `placesSection` adds a store subscription, a `storage` listener and a
    `lit:last-read` listener (`places.js:293–306`) that a closed /desk pane
    never removes (`desk-panes.js:366`); `visible()` stops the redraws, so
    it costs only memory.
  - *Fix*: let a view skip a notice whose records it doesn't draw (pass the
    kinds through `subscribe`); give `placesSection` a `destroy`.
  - *Check*: trace, or count redraws in a stubbed store.
  - *E9*: the redraws are not moot; the leak is if the Places group goes.
  - Status: **Fixed in #PRNUM** (FA1-y). The leak was already closed by BA31 in #398
    (`placesSection`'s `destroy`, called by My Notes' `destroy`). The redraws:
    `store.subscribe(fn, filter)` takes `{ kinds }` or `{ except }`, and each
    notice carries the kinds it touched (`changeKinds`, with what a record was
    before and a trash record's held kind, and in the BroadcastChannel
    message). The notebook page, /desk's kept and This verse panes and the
    margin, highlight, bookmark, pin, footnote-note and verse-label views
    subscribe `{ except: ["place"] }`; My Notes, which draws places, doesn't.
- **BA108 (low; traced). A failed delete says nothing.**
  - *What happens*: `places.js:271` and `kept-list.js:225` await
    `store.remove` with no catch, so a storage error leaves the button
    doing nothing and an unhandled rejection. Rename reports its error
    (`places.js:256–260`).
  - *Fix*: catch it and show a sentence, as rename does.
  - Status: **Fixed in #PRNUM** (FA1-y). Both deletes catch the error, log it, and say “The ribbon couldn’t be deleted in this browser.” (the Places group) or “That item couldn’t be deleted in this browser.” (My Notes) in a `role="alert"` line, cleared on the next draw.
- **BA109 (low, copy). The Places group's empty line reads as an instruction.**
  - *What happens*: “No places yet. Continue reading and your ribbons
    appear here.” (`notebook-page.js:161`) reads as “keep reading.” And the
    ribbon form says “You have 6 ribbons.” (`ribbon-form.js:80`) even when a
    synced notebook holds more.
  - *Fix*: “No places yet. “Continue reading” and your ribbons appear
    here.”; use the real count.
  - *E9*: moot (the Places group goes, and “ribbon” is retired).
  - Status: **Fixed in #400** (FA1-t), as written.

### Area 3: the Greek tab's reading view and the commands window (done 2026-10-26)

Most of these are in phase FA1-z; BA114 and BA115 are in FA1-r, BA116 in FA1-k
and BA118 in FA1-t. No jsdom is installed, so the window's behavior was run
in Node against the real `float-window.js` and `greek-commands.js` with a
small stub DOM, and the rest traced or run over the committed
`public/greek/` data.

- **BA110 (medium; traced and counted; BVJ chose to lift the floor,
  2026-10-26). A one-letter Greek word offered as a search does nothing and
  says nothing.**
  - *What happens*: the tab's search runs only from two characters, so
    clicking the lemma “ὁ” or a form like “ἡ” or “ἢ” in a word's details
    fills the field and does nothing: no results and no hint. Typing one
    and Enter is the same. The tray and /search accept them (rule 15: a
    Greek query “at any length”). What is lost is small but real: ὦ, the
    vocative “O” (17 times: Galatians 3:1, Romans 11:33), is reachable
    only by its Strong's number, and ἤ (“or,” “than,” 346) not by its
    form. The floor doesn't keep results small anyway: καί (8,985) and
    αὐτός (5,557) pass it. A bare search for the article itself is no
    use: ὁ is in 6,966 of the NT's 7,942 verses. The article is studied
    beside a word (“ὁ, θεός”), which the floor never blocked.
  - *Where*: `greek-find.js:164, 213, 271`; the starters are
    `tab-greek.js:793, 820`.
  - *Fix* (BVJ, 2026-10-26: “lift the floor for Greek”): one pure test,
    Greek or a Strong's number at any length and anything else from two
    characters, used at all three places, with the hint shown for a lone
    Latin letter. Recommended with it: a search for the article alone
    answers with a line rather than the list, such as “ὁ is in 6,966 of
    7,942 verses. To study it, search it beside a word: ὁ, θεός.”
  - *Check*: a unit test of that helper; in the browser, click ὦ's lemma
    in Galatians 3:1 and expect its 17.
  - Status: open.
- **BA111 (low; run over the data). A closing apparatus sign leads nowhere in
  eight verses.**
  - *What happens*: SBL keeps a note on a span of verses once, under its
    first verse (“22–23 …”). A sign closing that span in a later verse finds
    no note for its own verse, so the sign's button and “Show the note” do
    nothing. Jude 1:23, Luke 22:20 and 22:44, Mark 7:22, Matthew 1:8, 16:3
    and 26:61, and Philippians 1:17.
  - *Where*: `tab-greek.js:648–657` (`if (!item) return;`).
  - *Fix*: take the nearest note at or before the verse (a pure helper in
    `desk-greek.mjs`).
  - *Check*: a test over all 260 files that every verse with a sign
    reaches a note; it fails today for those eight.
  - Status: open.
- **BA112 (low, accessibility; traced). The split handle has no value until
  moved, and an old one after a reset.**
  - *What happens*: the handle is a focusable separator, which needs
    `aria-valuenow`, but it gets one only after a move. A reset (Enter or a
    double click) removes `aria-valuenow` and leaves the last
    `aria-valuetext`, so a screen reader keeps hearing “Entry 45 percent.”
  - *Where*: `tab-greek.js:678–707`.
  - *Fix*: remove `aria-valuetext` with the value, and set both from the
    measured share on focus and after a reset.
  - Status: open.
- **BA113 (low; run). With storage blocked, the split snaps back as soon as
  it moves.**
  - *What happens*: `setShare` keeps the share (the error swallowed) and
    sends the widths event; the tab's own listener then finds nothing kept
    and resets the share. A reader whose browser blocks site storage can't
    move the line at all.
  - *Where*: `tab-greek.js:691–696, 709–711`.
  - *Fix*: reset only when the event says `kept: false`.
  - *Check*: a test with a storage stub that throws.
  - Status: open.
- **BA114 (low; run in a stub DOM). On /desk, the commands window outlives
  its search field.**
  - *What happens*: from a Greek pane's search, nothing closes the window
    when the pane closes or follows to a new chapter (the pane's `destroy`
    only counts). The window still says “Click a command to add it where
    your cursor is”, a click does nothing, and its × leaves focus on the
    page's body. On /desk it also sits at the window's right edge, since
    `place()` measures `#deskPanel`, which /desk doesn't have. Rule 17's
    “closes with the Notebook” has no counterpart there.
  - *Where*: `greek-commands.js:124, 267, 271, 288–291, 335`;
    `desk-panes.js:240, 244`.
  - *Fix*: the Greek tab's `destroy` (BA115) closes its search, which closes
    the window; `insert()` closes the window when its field is gone; place
    it beside the pane on /desk. Add /desk to rule 17.
  - *Check*: a test that removes the field and expects the window closed.
  - Status: **Fixed in #398** (FA1-r). The Greek tab's `destroy` closes its search, which closes the window; `insert()` closes it when its field is gone; on /desk it sits beside the pane (left where there is room, else right). Rule 17 names /desk. Tested in `test/greek-commands.test.js`.
- **BA115 (low, performance; traced). Each Greek tab built on /desk leaves
  its listeners behind.**
  - *What happens*: `build()` adds a window scroll listener, a
    ResizeObserver and a document listener that nothing removes, and the
    tab has no `destroy`. A Greek pane following the LIT pane builds a new
    tab every chapter, so each chapter read keeps the old one alive.
  - *Where*: `tab-greek.js:365–376, 709, 1046`; `desk-panes.js:208–240`.
  - *Fix*: return a `destroy` that removes them, disconnects the observer,
    closes the search and clears the timers; call it from the pane.
  - Status: **Fixed in #398** (FA1-r). `createGreekTab` returns a `destroy` (the window scroll listener, the widths listener, the ResizeObserver, the apparatus and split timers, and its search); the pane calls it on a new chapter and on closing.
- **BA116 (low; run in a stub DOM). Closing the commands window mid-drag
  saves its place as the top left corner.**
  - *What happens*: Escape, the Notebook closing or leaving the page while
    the pointer is down closes the window; the drag's end then reads the
    removed window's position, (0, 0), and saves it, so it reopens in the
    corner for the rest of the visit.
  - *Where*: `float-window.js:104–113, 138–145`.
  - *Fix*: report a move only while the window is open, and end the drag
    in `close()`.
  - *Check*: the stub-DOM case as a test.
  - Status: **Fixed in #383** (FA1-k), tested in `test/float-window.test.js`.
- **BA117 (low, accessibility; traced). What the tab and the window announce
  isn't meant to be heard.**
  - *What happens*: choosing a word announces the parsing and then
    MorphGNT's raw code (“… V- 3API-S--”). Adding a command announces
    “Added , to the search.” or “Added ~3 to the search.”, though
    `COMMANDS` holds their meanings (“Then another word,” “Within 3
    words”).
  - *Where*: `tab-greek.js:803–811`; `greek-commands.js:132, 219`.
  - *Fix*: announce the parsing in words only; “Added: Within 3 words.”;
    for the builder, the query it made.
  - Status: open.
- **BA118 (low, copy). “Rendered here as …” has no Oxford comma.**
  - *What happens*: `joinAnd` writes “a, b and c”, and a test holds it so.
    No verse has three renderings of one term yet.
  - *Where*: `desk-greek.mjs:189–192`; `test/desk-greek.test.js:117`.
  - *Fix*: “a, b, and c” from three on; update the test.
  - Status: **Fixed in #400** (FA1-t).
- **BA119 (low, polish). The search's empty choices box keeps its margin
  when hidden.**
  - *What happens*: `.desk-greek__choices` sets `display: flex`, which
    beats `hidden`, so the empty box still takes 8px.
  - *Where*: `desk.css:4130–4135`.
  - *Fix*: `.desk-greek__choices[hidden] { display: none; }`, as its
    neighbors have.
  - Status: open.
- **BA120 (low; traced). A passage naming a verse the Greek lacks opens at
  verse 1, or doesn't move.**
  - *What happens*: on /desk a passage like Matthew 17:21 (a verse neither
    text has) opens the Greek at verse 1, and `goToVerse` returns without
    moving, while the passage bar says 17:21.
  - *Where*: `tab-greek.js:484–487, 576`; `desk-passage.mjs:18–28`.
  - *Fix*: go to the nearest verse before it, else after it (a pure
    helper).
  - Status: open.

### Area 4: /desk's use of the shared modules (done 2026-10-26)

All six are in phase FA1-aa. The modules were traced with a pane as the
view, and the memory finding was run in Node. **Two LIT panes on one
chapter hold up**: about 30 id sites checked, and every id in a pane's
blocks is prefixed or suffixed with the pane's, so no lookup reaches the
other pane (see "What held up").

- **BA121 (medium; traced). On /desk, My Notes and This verse don't flag a
  changed wording until the notebook next changes.**
  - *What happens*: a note or highlight is judged (“Wording changed,” “Not
    in the text”) only while a LIT pane shows its chapter, since
    `chapterTextFor` returns null otherwise. A My Notes pane draws when it
    mounts and when the store changes, never when a LIT pane loads a
    chapter or scrolls into one. So a row whose wording changed shows no
    flag, while the verse number beside the same text says “1 changed since
    I marked it” (it redraws through `lit-records.js`). The list and the
    verse numbers disagree until the reader edits something. Pins and notes
    on footnotes have the same gap.
  - *Where*: `change-notice.js:80–96` (`textReader`); `tab-mine.js:236–280`;
    `desk-panes.js:302–308` (the only redraw is `store.subscribe`);
    `tab-verse.js:188`. Only `lit-records.js:85` listens for
    `DESK_TEXTS_EVENT` (`page.js:84–94`).
  - *Fix*: redraw My Notes and This verse panes on `DESK_TEXTS_EVENT`, at
    most once a frame.
  - *Check*: a note whose quote no longer matches Romans 8; open /desk at
    John 3 and scroll the LIT pane into Romans 8: the row's flag appears
    without touching the notebook.
  - Status: open.
- **BA122 (medium; likely). A bottom-row pane's “Show in this pane” menu is
  cut off in a short window.**
  - *What happens*: the menu of seven kinds (about 250px) hangs from the
    pane's header (`top: calc(100% - 2px)`), inside `.desk-ws__panes`,
    which has `overflow: auto`. In a bottom-row pane shorter than about
    295px, the last kinds (“Sheet,” “What I’ve kept”) are clipped, or reached
    only by scrolling the whole panes box; arrowing onto one scrolls every
    pane up. Three rows clip in a window under about 1,000px tall, two rows
    under about 700px. Panes above are fine: their menu overlaps the panes
    below.
  - *Where*: `desk.css:4603–4608` (`.desk-ws__panes`), `4790–4803`
    (`.desk-pane__menu`); `desk-page.js:566–569`.
  - *Fix*: open it upward when it doesn't fit below, or place it on
    `document.body` as the Layout menu is.
  - *Check*: in the browser, “Three rows” at about 900px tall: the bottom
    pane's menu shows all seven kinds with no scrollbar on the panes box.
  - Status: open.
- **BA123 (low, memory; reproduced). A closed or switched LIT pane's text
  stays in memory for the visit.**
  - *What happens*: `watchLitRecords` adds each LIT pane's container to its
    `watched` set and never removes it. Highlights and verse labels each
    keep a watcher, so every closed pane is held twice, with every chapter
    it loaded. In Node with five panes opened and closed, all five texts
    were still alive after garbage collection.
  - *Where*: `lit-records.js:68–79`.
  - *Fix*: on `DESK_TEXTS_EVENT`, drop any container no longer in
    `deskTextsNow()`.
  - Status: open.
- **BA124 (low; traced). A row's reference in a “What I’ve kept” pane leaves
  /desk.**
  - *What happens*: `recordRow` makes each reference a plain link to Study
    View, and the pane passes no way to move the LIT pane, so a click
    navigates the tab away. My Notes moves the LIT pane instead (3g), as a
    Greek result moves the Greek pane.
  - *Where*: `record-rows.js:62–75`; `kept-list.js:44`;
    `desk-panes.js:308–312` (`mountKept`), against `desk-panes.js:352–355`.
  - *Fix*: give `createKeptList` the optional `goHere` that `tab-mine.js`
    takes, and pass `env.showPassage` from `mountKept`. The /notebook page
    keeps its plain links.
  - Status: open.
- **BA125 (low; traced; BVJ chose pinning, 2026-10-26). A verse menu opened with the mouse in a
  pane stays put while the pane scrolls.**
  - *What happens*: in Study View a mouse-opened menu scrolls with the text
    until dragged, because the document scrolls. A LIT pane scrolls inside
    itself, while the menu and the selection panel are placed on `<body>`
    in document coordinates, so they stay on screen while their verse
    moves away. Nothing closes them on scroll, by rule.
  - *Where*: `lit-panel.js:55–92`; `global.css:2837`; `desk.css:5087`.
  - *Fix* (BVJ, 2026-10-26: Claude's recommendation): pin a panel opened
    from a pane to the screen (`pinToScreen`), as a dragged one is.
    Weighed and not chosen: closing it when the pane scrolls.
  - *Check*: open a verse menu with the mouse in a LIT pane and wheel the
    pane: the menu stays where it opened, as a dragged one does.
  - Status: open.
- **BA126 (low, accessibility; traced). A pane's footnote letters aren't
  announced as opening a dialog, and a middle-click opens another /desk.**
  - *What happens*: Study View marks each `.fn-ref a` with
    `aria-haspopup="dialog"`; the LIT pane doesn't, so a screen reader hears
    a plain link. The pane handles `click` only, so a middle-click follows
    the letter's fragment into a new tab of /desk.
  - *Where*: `lit-pane.js:162–168` (`render`), `428–440`; against
    `chapter-tools.js:884–885`.
  - *Fix*: set the attribute in `render`, and cancel `auxclick` on a letter.
  - Status: open.

**BA31 is wider than written** (found here, left in FA1-r): a This verse
pane builds a new `createVerseTab` on every chapter it follows
(`desk-panes.js:140`), and each adds a `lit:panel-actions` listener on
`document` (`tab-verse.js:479`) that is never removed. So the listeners
pile up per chapter followed, not only per closed pane. FA1-r's fix (return
the removals for `destroy()`) should cover the rebuild too.

### Area 5: sheets beyond one tab (done 2026-10-26)

BA127 is in FA1-i, and the rest are in phase FA1-ab. The two-tab race was
run in Node over a store shaped like the real one; the BroadcastChannel
timing itself needs a real browser.

- **BA127 (medium; reproduced). “+ Passage” with “Romans 8” adds only verse
  1, and accepts verses the chapter doesn't have.**
  - *What happens*: the form means `last` to be the chapter's last verse,
    but `anchorText()` returns `verses` as a `Map`, which has no `length`,
    so `last` is always null and no check runs:
    - “Romans 8” adds Romans 8:1, not the chapter (the code's own
      `last ?? 1` shows the whole chapter was meant);
    - “Romans 8:99” is accepted instead of “that chapter ends at verse 39”;
    - “Romans 8:28-99” is stored as 28–99 and prints that reference;
    - “Matthew 17:21,” a verse the LIT doesn't have, becomes a passage
      saying its verses can no longer be found.
  - *Where*: `sheet-pane.js:871`; `anchor-core.mjs:53–65`
    (`assembleChapter`).
  - *Fix*: `chapter.verses.size` and `Math.max(...chapter.verses.keys())`,
    and refuse a verse that `chapter.verses.has()` doesn't, which catches
    gaps a “past the end” test misses.
  - *Check*: tests for “Romans 8” (1–39), “Romans 8:99,” “Romans 8:28-99”
    (to 39) and “Matthew 17:21” (refused).
  - Status: fixed in #381, as proposed, in `passageForReference`
    (`desk-sheet-passages.mjs`). A range that ends in a gap ends at the
    verse before it, and nothing is added when the chapter can't be read.
- **BA128 (medium, data loss; reproduced). After one failed save, every
  later edit to the sheet fails too, and the reason is never shown.**
  - *What happens*: `change()` sets `sheet = next` before saving, and on a
    failure only says “Not saved” and “The sheet couldn’t be saved.” It
    doesn't put the saved copy back. Paste about 550 KB into a part, past
    the 512 KB limit, and that save fails; a small edit to another part
    then fails as well, because the oversized text is still in `sheet`.
    The screen shows every edit, the store has none of them, and a reload
    loses them all. About 2,900 blanks reach the same limit.
  - *Where*: `sheet-pane.js:223–259` (`sheet = next` at 234; the catch at
    242–247); the limit is `desk-sheet-format.mjs:49, 818–819`.
  - *Fix*: on a failed save, put back the last saved copy, redraw, and say
    why: for the size limit, “This sheet is too big to save (512 KB).
    Remove some text or blanks.”
  - *Check*: paste 600 KB into a part: the status says why, the part goes
    back to its saved text, and the next small edit saves.
  - Status: fixed in #378. `sheet` changes only once a save lands (`change()`
    in `sheet-pane.js`), so a failed save leaves the pane on the last saved
    copy; `failed()` rebuilds the part that made it from that copy and the
    status says why (“Not saved: this sheet is too big to save (512 KB).
    Remove some text or blanks.”). Tests in `desk-sheets` (`sheetTooBig`, and
    a small edit saving after an oversized one).
- **BA129 (medium, data loss; reproduced in Node). With one sheet open in two
  tabs, a tab that hasn't heard the other's save writes its older copy
  over the whole sheet.**
  - *What happens*: `change()` builds the next sheet from the tab's own
    copy and saves the whole record, with no fresh read. The other tab
    learns of a save through `subscribe`, which re-reads it. An edit made
    before that read lands is built on the old copy and undoes the other
    tab's edits to every other part. If the message never arrives (a frozen
    background tab, or no `BroadcastChannel`, `store.js:100`), the tab
    stays stale, and nothing re-reads a sheet on focus or
    `visibilitychange`. Rule 22's “the next save wins” is about one part;
    this loses the other parts.
  - *Where*: `sheet-pane.js:223–259, 978–1000`; `store.js:100–106, 227–231`.
  - *Fix*: save a sheet's change through `store.change`, applying the edit
    to the record as read inside it, as BA13 did for deletes; and re-read
    the sheet when the tab becomes visible.
  - *Check*: two tabs on one sheet; tab B edits part X, then tab A, before
    hearing of it, edits part Y: both edits are kept.
  - Status: fixed in #378. `change()` plans each edit with `planSheetChange`
    (`desk-sheets.mjs`) over the record read inside `store.change`, and the
    pane re-reads its sheet on `visibilitychange` and `pageshow`. Tests in
    `desk-sheets`: two tabs over a stubbed store keep both edits. Found in
    passing and fixed with it: “+ For discussion” worked out its questions
    against the pane’s copy, so it now works them out again inside the change.
    The real-browser race (a frozen tab) stays with FA1-v.
- **BA130 (low, data loss; traced). “Make a sheet” from search, into an
  existing sheet, saves a copy read before a network wait.**
  - *What happens*: `gather()` reads the target sheet, then for a topic
    fetches each chapter's last verse, then saves the copy it read plus the
    new passages. An edit made to that sheet meanwhile, in /desk, is lost
    as in BA129. After the wait it also reads the current results for the
    title, so a query changed during the fetch can title the sheet with the
    wrong one, and the “Made…” message lands in the new query's bar.
  - *Where*: `search-sheet.js:301–344`.
  - *Fix*: fetch first, then read and add inside one `store.change`, with
    the query captured before the wait.
  - Status: fixed in #378. What was pressed for, and the title, are taken
    before any wait; the chapters are fetched first; then the sheet is read
    and added to in one `store.change`.
- **BA131 (low, copy; reproduced). A topic sheet that couldn't read some
  chapters blames the 300-part limit.**
  - *What happens*: chapters whose last verse couldn't be fetched are added
    to the “left out” count, and the message says “1 more passage didn’t
    fit, since a sheet holds at most 300 parts” with nowhere near 300.
  - *Where*: `search-sheet.js:376, 404`; `desk-sheet-gather.mjs:113–122`.
  - *Fix*: count them apart: “2 chapters couldn’t be read just now.”
  - Status: fixed in #378. `gatherMessage` takes `unread` apart from
    `leftOut`: “2 chapters couldn’t be read just now, so they weren’t added.”
    Tests in `desk-sheet-gather`.
- **BA132 (low; traced). Ticked verses stay counted after the book filter
  hides them, and the button then does nothing.**
  - *What happens*: ticks are cleared only when the query changes, and the
    book filter changes the results, not the query. Tick three verses in
    John, switch the filter to Matthew, and the bar still says “3 verses
    ticked” and offers “Clear ticks,” while making a sheet finds none.
  - *Where*: `search-sheet.js:228–245, 170–174, 289–291`.
  - *Fix*: drop ticks that aren't in the shown results when they change.
  - Status: fixed in #378. `update()` drops a tick on a verse the results no
    longer hold, and closes an open chooser whose count it changed.
- **BA133 (low, performance; reproduced). Every redraw of a sheet works out
  every footnote against every blank, once per passage.**
  - *What happens*: each passage card redraws its footnotes on every save,
    and each footnote recomputes the stems of every blank on the sheet. On
    Romans 8 (23 footnotes) with three passages and about 2,900 blanks, the
    logic alone took 470 ms per save; with 300 blanks, 20 ms. Nothing
    froze, but typing in a big sheet stutters.
  - *Where*: `sheet-lit.js` (`drawNotes`, about line 573);
    `desk-sheet-lit.mjs` (`blanksGivenAway`, about line 282).
  - *Fix*: work out each blank's stems once per redraw, and redraw the
    notes only when the blanks or footnote choices changed.
  - Status: fixed in #378. `blanksGivenAway` stems each text once (a private,
    bounded cache in `desk-sheet-lit.mjs`), and a passage redraws its
    footnotes on a save only when its choices or the sheet’s passages with
    blanks changed (`notesInputs` in `sheet-lit.js`). Tests in
    `desk-sheet-lit`.

### Area 6: a copy pass and the stylesheet (done 2026-10-26)

BA134 to BA139 are in phase FA1-ac and BA140 to BA145 in FA1-ad. The copy
pass extracted 8,839 string literals from the desk's scripts, `desk-*.mjs`,
the four desk pages and the templates, then read every hit in context. The
stylesheet pass computed contrast for every resolvable color in `desk.css`
and `sheets-page.css` in both themes.

- **BA134 (low, copy). Fourteen lists have no Oxford comma.**
  - *Where*: `notebook/help.astro:68` (“to read, print or move”), `:118–119`
    (“…its Strong’s number and an entry”), `:128–129` (“…Tregelles, NA28
    and Robinson–Pierpont”), `:139` (“…its dictionary form and its
    Strong’s number”); `notebook-page.js:111` (“a note, highlight or
    bookmark”), `:132` (“…label and place,” the same line as BA39);
    `notebook.astro:18`, the meta description; `sheet-page.js:263`, an
    aria-label (“Copy, paper and printing”); `desk-export.mjs:781`
    (“replaces, deletes or brings back”); `desk-first-use.mjs:135`
    (“…“Bookmark” and “Highlight.””), `:230`, `:241`, `:263`, `:285`.
  - *Fix*: the comma before “and” or “or” in each.
  - Status: open.
- **BA135 (low, copy). Two strings still have straight apostrophes.**
  - *Where*: `tab-mine.js:247` (“This browser isn't letting the site keep a
    notebook. Private windows sometimes don't.”), which is curly in the
    five other places it appears; `desk-merge.mjs:135` (“…doesn't say
    which record it deleted”), shown when a copy is opened
    (`export-import.js:199`). Not BA15's strings.
  - Status: open.
- **BA136 (low, copy). A note's opening puts a comma outside the closing
  quote.** “My note on ‘…’, Romans 8:3:” should be “‘…,’ Romans 8:3:”
  (`desk-notes.mjs:185`, `noteOpening`). Check `noteOpening`'s tests, which
  will need the new form.
  - Status: open.
- **BA137 (low, copy). The commands window's line about quotes can't be
  read.** It says “Quotes search for any, exact, and or or as a word”: the
  four commands aren't marked, so it reads as a garbled list
  (`greek-query.mjs:154`). *Fix*: “Quotes search for “any,” “exact,”
  “and,” or “or” as a word.”
  - Status: open.
- **BA138 (low, copy; BVJ chose, 2026-10-26). The panel is “Notebook” in its heading and
  “the notebook” in its controls.**
  - *What happens*: the heading, the tab and the tour say “Notebook,” but
    its own buttons say “Minimize the notebook” and “Close the notebook”
    (`panel.js:208`), as do the commands (`desk-commands.mjs:35, 43`), the
    resize handles (`float-resize.js:35`, `widths.js:179`) and one sentence
    of the help page's tour section, which uses both. Related: the menu
    group is “My Notebook” (`actions.js:68`, `tour.js:134`), while “Search
    my notebook” (`kept-list.js:46, 49`), “Undo a change to my notebook”
    (`note-settings.js:321`), “Save a copy of my notebook”
    (`desk-commands.mjs:100`) and “From my notebook” (`sheet-pane.js:885`)
    are lowercase.
  - *Fix* (BVJ, 2026-10-26: Claude's recommendation): capitalize where
    the panel is named (“Close the Notebook”), and keep lowercase where
    the words mean what the reader has kept (“Save a copy of my
    notebook”), so the “my notebook” strings stay.
  - Status: open.
- **BA139 (low, copy; BVJ chose, 2026-10-26). “My Notes” and “My notes” name the same
  thing.**
  - *What happens*: the tab and the pane kind say “My Notes”
    (`panel.js:148`, `desk-layout.mjs:51`), while the margin's switch, its
    region name and This verse's subhead say “My notes”
    (`note-settings.js:150`, `notes-margin.js:86`, `tab-verse.js:116`). The
    commands list has “Show My Notes” beside “Show my notes”
    (`desk-commands.mjs:51, 72, 79`), which are different things. The tour's
    two versions of one sentence say “My Notes” and “the Notebook” lists
    every bookmark (`desk-first-use.mjs:183–184`).
  - *Fix* (BVJ, 2026-10-26: Claude's recommendation): “My Notes” for the
    tab and pane only, and “Notes in the margin” for the margin (its
    switch, its region's name and its command), so the two commands can't
    be confused. This verse's subhead names the reader's notes on the
    verse, so it can stay in sentence case; make the tour's two sentences
    (`desk-first-use.mjs:183–184`) name the same place.
  - Status: open.
- **BA140 (medium, accessibility; computed). A segmented control's focus ring
  can't be seen on the chosen option.**
  - *What happens*: the chosen option of a `.desk-seg` (the Greek lexicon
    choice, My Notes' scope, the notes settings) is filled with
    `--green-text`, and its focus ring is drawn inside it in `--focus-ring`,
    the same color: 1.00:1 in both themes. Tab lands on the chosen option
    and the arrows choose as they move, so the keyboard reader nearly
    always sees no focus at all.
  - *Where*: `desk.css:528–548`; `tab-greek.js:185`; `note-settings.js:343`.
  - *Fix*: draw the ring outside the option (a positive offset), or add an
    inner ring in `--surface-raised` inside the outline.
  - *Check*: Tab into each, in both themes; a ring shows.
  - Status: open.
- **BA141 (medium, accessibility; traced). With forced colors (Windows
  contrast themes), the chosen state disappears from seven kinds of
  control.**
  - *What happens*: these mark “chosen” only by background, color or
    `box-shadow`, which forced colors replaces or drops. Unchosen panel
    tabs carry a transparent 2px border that forced colors draws, so all
    the tabs look the same. The Greek word's comment says it “doesn't rest
    on colour alone,” but its second cue is a `box-shadow`.
  - *Where*: `desk.css:196` (panel tabs), `:540` (segmented option),
    `:1478` (the editor's marker), `:3647` (a chosen Greek word), `:4154`
    (the Greek search's choices), `:4521, 4541` (Layout's arrangements),
    `:5191` (the current footnote row), `:4684` (the leading pane);
    `sheets-page.css:1086, 1196` (present mode's buttons). The swatches,
    label buttons, rich-text tools and the changed-dot already have a
    `forced-colors` rule.
  - *Fix*: one `@media (forced-colors: active)` block giving each a cue that
    survives: an outline in `Highlight`, a thicker border, or weight.
  - *Check*: emulate forced colors in DevTools; each state is visible.
  - Status: open.
- **BA142 (low, accessibility; traced). With forced colors, the four
  highlight swatches look alike.** Each is an “ab” sample tinted by
  background, and its color is named only in its aria-label, so a sighted
  reader in a contrast theme can't tell yellow from pink. *Where*:
  `desk.css:1199–1240`; `actions.js:226`, `tab-mine.js:116, 332`,
  `kept-list.js:134`, `record-rows.js:37`. *Fix*: `forced-color-adjust:
  none` on the sample, or show the color's name.
  - Status: open.
- **BA143 (low, accessibility; computed). Two dimmed texts fall below
  4.5:1 in the light theme.** An omitted term on a sheet is 3.64:1
  (`desk.css:6455`, opacity 0.55), and a revealed blank in the presenter's
  notes 4.23:1 (`sheets-page.css:1224`). Dark passes. The Layout menu's
  “needs a wider window” line is 3.15:1 but sits in a disabled control,
  which WCAG exempts; it is the only reason given, so lift it too. *Fix*:
  `rgba(var(--ink-rgb), 0.7)` or more.
  - Status: open.
- **BA144 (low, accessibility; computed; BVJ chose, 2026-10-26). Text fields' borders
  are 1.6 to 1.9:1 against the panel.** In light mode a field's fill
  matches the panel, so its 1px border is its only edge, below the 3:1
  WCAG asks of a control's boundary (dark: 1.95 to 2.53:1). Eight fields:
  `desk.css:3063, 3199, 4077, 4868, 5468, 5611, 6059, 6109`. The rest of the
  site's fields are as soft, so this is a site-wide choice more than a desk
  bug. *Fix* (BVJ, 2026-10-26: Claude's recommendation): about
  `rgba(var(--ink-rgb), 0.55)` for field borders, site-wide, as its own
  commit in FA1-ad, checked against 3:1 in both themes.
  - Status: open.
- **BA145 (low; possible). Nothing hides the Notebook rail or the undo bar
  in print.**
  - *What happens*: the desk's print rules hide `.desk-notes`, the gutters,
    flags, pins and the tour, and `print.css` hides `.lit-panel`, but no
    rule names `.desk-rail` (the Notebook and its collapsed tab, appended
    to `<body>`, `margin.js:105–109`) or `.desk-undo__bar`, which is
    `position: fixed` and stays up for ten seconds after a delete. The
    first audit's clean print was at 1440 wide, where the rail may fall
    beyond the page; a narrower window, with the panel floating over the
    text, may print it.
  - *Where*: `desk.css:20–30, 308–330, 1153`; `print.css:42–63`.
  - *Fix*: hide both under `@media print`.
  - *Check*: print a chapter in a 900px window with the Notebook floating
    open, and again just after deleting a note.
  - Status: open.

### The phases FA1-u started

Each lists its findings, which are written up above, by area. Read that
area's entry for the files.

- **FA1-w. What's new for you.** BA88, BA90, BA92, BA96, BA97, BA98.
  Files: `release-feed.js`, `whats-new.js`, `desk-whats-new.mjs`,
  `desk-whats-new-view.mjs`, `desk-change.mjs`, `store.js` (`setMeta`).
  Tests: `desk-whats-new`, `desk-change`. CLAUDE.md desk rules 12, 16 and
  23.
- **FA1-x. A note's references.** BA89 (BVJ chose the stricter mode), BA93,
  BA94, BA95. Files: `desk-chains.mjs`, `scripture-refs.mjs` (a mode for
  notes; footnotes, intros and articles keep theirs), `tab-verse.js`.
  Tests: `desk-chains`, `scripture-refs`. `src/lib/CLAUDE.md`'s linking
  rules; desk rule 16.
- **FA1-y. Ribbons and Continue reading.** BA99 to BA108. Ten, but BA103 to
  BA108 are small. Files: `ribbon-follow.js`, `places.js`,
  `ribbon-form.js`, `kept-list.js`, `desk-places.mjs`, `last-read.js`,
  `desk-gate.js` (BA101). Tests: `desk-places`, and a new
  `ribbon-follow` test with stubbed storage. Desk rule 13. **E9** (bookmarks
  and ribbons become one, 2026-10-22) will rebuild this code: if E9 is built
  first, fold this phase into it. Each finding says what E9 would make moot.
- **FA1-z. The Greek tab.** BA110, BA111, BA112, BA113, BA117, BA119, BA120.
  Files: `tab-greek.js`, `greek-find.js`, `greek-commands.js` (BA117),
  `desk-greek.mjs`, `desk.css`. Tests: `desk-greek`. Desk rules 14, 15
  and 17.
- **FA1-aa. /desk's panes and the shared modules.** BA121 to BA126 (BA125's
  fix is BVJ's choice: pin the menu). Files: `desk-panes.js`, `desk-page.js`,
  `lit-records.js`, `lit-pane.js`, `lit-panel.js`, `kept-list.js`,
  `record-rows.js`, `tab-mine.js`, `change-notice.js`, `desk.css`.
  After FA1-l and FA1-r, which work the same files. Browser check: “Three
  rows” in a short window. Desk rule 18.
- **FA1-ab. Sheets in two tabs, and large sheets.** BA128 to BA133, BA128
  and BA129 data loss, so BVJ moved this phase up to follow FA1-u. Files: `sheet-pane.js`, `store.js` (`change`),
  `search-sheet.js`, `desk-sheet-gather.mjs`, `sheet-lit.js`,
  `desk-sheet-lit.mjs`. Tests: `desk-sheets`, `desk-sheet-gather`,
  `desk-sheet-lit`, and a two-tab test over a stubbed store. Desk rules 21
  to 23.
- **FA1-ac. The copy pass.** BA134 to BA139 (BA138 and BA139 follow
  BVJ's choice of names). Files: those each finding names; `notebook/help.astro`
  and `desk-first-use.mjs` hold most of BA134. After FA1-t, which touches
  some of the same strings. Tests: `desk-notes` (BA136), and any test
  asserting a changed string.
- **FA1-ad. The stylesheet.** BA140 to BA145 (BA144 is site-wide, by
  BVJ's choice). Files: `desk.css`, `sheets-page.css`, `print.css`, and
  for BA144 the site's own field styles (`global.css` and the page
  stylesheets). Browser
  check: DevTools' forced-colors emulation in both themes, Tab through the
  segmented controls, and a print at 900px wide.

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
7. **The deployed site**: the shared-link beacon check (BA78). FA1-g
   checked it locally, with listeners standing in for the beacon's; the
   real beacon is added only at deploy.

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

From FA1-u (2026-10-26):

- **The release notes as B3 reads them.** All 556 rows of the real feed
  were run: the 466 that name verses agree with an independent parser, and
  no other row yields any. A first visit marks nothing New and writes
  “last looked” once; an empty notebook writes nothing.
- **A note's links are safe.** `noteBodyHtml` escaped every hostile body
  tried, and every `a.sref` it makes lands on a rendered `id="vN"`. A note
  citing its own verse isn't a chain, and trash isn't read.
- **Places land.** In all 211 published chapters, Study View's `id="vN"`
  and Read View's `id="<book>-<ch>-vN"` are the same set, so every place
  and Continue reading link resolves (built with the real
  `prepareStudyParagraph` and `prepareReadParagraph`). Ribbon names reach
  the page only as text.
- **Drafts** record no Continue reading, offer no ribbon form, and leave
  the follow flag alone.
- **The Greek tab never moves the page.** Every `focus()` in it passes
  `preventScroll`, and Go to verse scrolls only the tab. The LIT's verse
  numbers equal the Greek's verses in all 211 published chapters, so Go to
  verse never names a verse the Greek lacks.
- **The Greek data.** All 260 chapters have a file, drafts included; the
  borrowed passages (John 7:53–8:11, Romans 16:25–27) carry their notes and
  sources; word numbers are unique within each verse. All 10,699 STEP and
  LSJ entries pass the lexicon sanitizer with nothing legitimate dropped.
- **Two LIT panes on one chapter** (area 4): every id in a pane's blocks
  is prefixed with the pane's (`prepareLitBlocks`, aria references
  rewritten), and every other id under `desk/` carries the pane's id; about
  30 id sites checked. The selection, the term lens, footnote popovers and
  highlights are scoped to the pane that opened them. Highlights and pins
  draw and update in both panes, and closing the last LIT pane clears the
  highlights. `footnotePanel` clones the note, so the cached page stays
  whole.
- **Sheets** (area 5): a passage's blanks survive “Keep the new wording”
  (`freshCopy` changes only the passage's own fields, run over a reworded
  chapter). Verse-number gaps keep their empty slots, so a topic sheet's
  last verse is right in all ten gap chapters, and a selection across a gap
  never joins its verses. Undo across tabs is guarded by `stillCurrent`.
  On Romans 8, finding 981 blanks took 21 ms and checking a five-passage
  sheet 11 ms; the 512 KB limit stops a sheet near 2,900 blanks.
- **Copy** (area 6): of 8,839 string literals, no British spelling in
  reader text; curly quotes everywhere but BA135; one quote-and-comma slip
  (BA136); no em dashes in prose; “Study View,” “Read View,” “Study Desk,”
  “Continue reading” and “Bookmark” consistent; the sheet templates'
  lists all have the Oxford comma.
- **The stylesheet** (area 6): the 28 focus rules without the literal
  `--focus-ring` all have a documented substitute; reduced motion is
  covered site-wide (`global.css:435–445`) and all six desk smooth scrolls
  are guarded; no bare `ch` unit; all 47 custom properties `desk.css`
  uses are defined; every resolvable text color passes in both themes
  except BA143's.
- **The commands window**: a labelled, non-modal dialog, Escape kept to
  itself, insertion at the cursor replacing a selection and firing
  `input`, and a saved place clamped back on screen. Its two modules import
  nothing under `desk/`.

## Not covered

FA1-u has read all six of its areas; what it couldn't reach without a real
browser is below, for FA1-v:

- **From FA1-u's areas 4 to 6, needing a real browser**: the clipped menu's
  real heights (BA122); whether My Notes draws before the LIT pane's
  chapter arrives on first load (BA121); the two-tab BroadcastChannel race
  in a frozen or restored tab (BA129); the drawing cost of about 3,000
  blank rows; the reader's `::highlight()` colors and the SVG marker
  glyphs in forced colors; focus rings clipped by a pane's overflow; and
  printing /notebook's settings controls.
- **From FA1-u's areas 1 to 3, needing a real browser**: two tabs with a
  ribbon following, whether Duplicate tab copies the follow flag, whether
  setting a field's `value` clears its undo (the commands window), and a
  screen reader on the Greek tab.
- **Other browsers.** All browser use was Chromium. Nothing ran in Safari or
  Firefox, with a real screen reader, on two screens, or on a touchscreen
  computer.
