# The Study Desk preview

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory. It governs the desk's code wherever it lives, including `src/lib/desk-*.mjs`, the /desk, /notebook and /sheets pages, `desk.css` and `public/greek/`; read it before touching any of them.
> Cross-references such as "below" or "rule 15" were written when all of
> this was one file, so they may point into another area file; the root's
> index says which file holds each section.

**`STUDY-DESK.md` (about 470 KB) and `STUDY-DESK-AUDIT-1.md` are too large to
read whole.** Grep them for the ID or heading you need (BA42, 3j, N9) and read
that section.

## The records

| Path | Purpose |
|------|---------|
| `STUDY-DESK.md` | **The planning and decision record for the Study Desk** (notes, places, highlights and sheets on desktop, with optional account sync shared with the apps). Phases 1a to 1d, 1f and 1h are built (the merge engine; notes, bookmarks, highlights, pinned footnotes, the margin and the panel's tabs; the notebook page, export and import, labels, ribbons, search and commands, first use and the tour; the Greek tab; searching the Greek), and so is phase 2a (2026-10-15: B3, N4, and construction search and searching by parsing as Greek search commands; M10 was built and shelved; N2, H2 and M4 are shelved for version 2, 2026-10-15), phase 3's sheets and /desk (3b to 3k, 2026-10-18 to 10-20), phase 2b (2026-10-20: S2, a sheet checked before printing, and N9, print with room to write), and phase 2c (2026-10-20: M11, notes on a footnote, and N6's questions gathered onto a sheet), the shell behind a preview switch (`?desk=on`); nothing reader-facing is released. N8 (the hidden passage) is held on branches until after the Zoom; it is not released before phase 1 is completely done, and perhaps not until phases 1 to 3 are (BVJ, 2026-10-13). 1g (an interleaf for the Greek) and 1h (searching the Greek) belong to phase 1: 1g is shelved for the future, and 1h was built on 2026-10-13. Every idea, audit finding, owner decision, open question and BDR item is there with its ID, as are the two apps' replies (2026-10-04) and the talk-through list built from them. Read it before proposing or building any part of the desk, and update it when a decision changes. `STUDY-DESK-BRIEF-FOR-BDR.md` is the brief written for BDR's Claude about the apps' side; `STUDY-DESK-REPLY-TO-APPS.md` is the website's answer to both apps' replies (2026-10-05), and the last such document: since 2026-10-07 BDR's Claude reads this repo directly, so the website answers by updating `STUDY-DESK.md` on `main` (its section "One notebook, three homes" holds BDR's sync proposal and the website's answers). |
| `STUDY-DESK-FORMAT.md` | **Draft record format for the Study Desk**, shared with both apps: the kinds of record, the anchor text, and how a mark is found again after the wording moves. Its executable form is `scripts/lib/anchor-text.mjs` (pure half in `src/lib/anchor-core.mjs`) with `test/fixtures/anchor-vectors.json`; its merge rules are `src/lib/desk-merge.mjs` with `test/fixtures/merge-vectors.json`, hand-written cases the apps run too. Change each pair together. |
| `STUDY-DESK-AUDIT-1.md` | **Full Audit 1 of the built Study Desk** (2026-10-20, commit `82af6a6`): findings BA1 to BA87, each with what happens, where and the fix, and the plan to fix them in phases FA1-a to FA1-t, each one session's work, plus the follow-up audit (FA1-u for the code it didn't reach, FA1-v on real devices), whose findings continue as BA88 onward and are planned in phases FA1-w onward. Read its "How to work a phase on a Pro account" before starting one, and mark each finding's status there as it ships. STUDY-DESK.md keeps the decisions. |

## The rules

- **The Study Desk preview** (STUDY-DESK.md, phases 1a to 1d, 1f and 1h,
  2a to 2c, and phase 3's 3b to 3k) is in production but
  switched off for everyone: `?desk=on` turns it on in one browser on a
  computer, `?desk=off` turns it off. STUDY-DESK.md is the record; what a
  change elsewhere in the site has to respect:
  1. **Layout.astro's pre-paint script decides it**, beside the theme and
     font ones: `lit-desk-preview` plus `isAppPlatform` sets
     `<html data-desk="on">`. The script repeats
     `src/lib/app-platform.mjs`'s test, since it
     can't import; `test/desk-prepaint.test.js` runs it against the same
     devices, so change the two together.
  2. **Readers download none of it.** `desk-gate.js` imports
     `src/scripts/desk/shell.js` only with `data-desk="on"`. The shell adds
     `desk.css` itself as a `<style>` (`?inline`): **a plain CSS import is
     gathered into every page's stylesheet by Astro even from a dynamic
     import**, which is how the first build shipped it to everyone. The
     Notebook buttons are in every page's markup, hidden by one rule in
     global.css unless the desk is on and the page has a reading column.
  3. **The Notebook panel sits in the right margin, beside the reading
     column, and moves nothing where the margin is wide enough** (BVJ,
     2026-10-06: "fill the margin, not just push everything aside"; the
     first build pushed the whole page left). `src/lib/desk-margin.mjs` is
     the rule and `src/scripts/desk/margin.js` places it: a card in an
     absolutely positioned rail down the margin to the end of `<main>`,
     sticky inside it, reaching 16px above the bottom of the window, with its
     "Notebook" heading level with the page's heading by the tops of their
     capitals. Where the margin is too narrow for its 280px minimum, the
     column moves left only as far as needed, by a `translate` on the page's
     `move` elements (desk-frame.js). Never pad `<main>` or move a wrapper
     holding a full-width band: that cut the license band short and showed
     cream beside it. Nested move elements are kept to the outermost, or the
     inner one moves twice.
     **Where even moving the column leaves no room, the notebook floats**
     (BVJ, 2026-10-07): expanded, it lies over the line ends; collapsed, it
     is a tab at the window's edge (`placeFloating`, `nextCollapsed`), and
     it collapses by itself whenever it starts floating unasked.
     **While it floats expanded the reader can drag its left edge to change
     its width** (BVJ, 2026-10-14; `desk/float-resize.js`, rules in
     `desk-margin.mjs`'s `floatWidth`): the right edge stays put, the width
     is kept for the visit (`lit-desk-float-width`, named in /privacy) and
     "Reset widths" forgets it. It moves nothing else.
     **In the margin the reader can minimize it to the same tab** (»;
     BVJ, 2026-10-09); minimized
     is remembered (`lit-desk-min`), and Notebook or the tab restores it.
     **It starts open and minimized** (BVJ, 2026-10-13): `lit-desk-panel`
     is "closed" only once the reader closes it, and `lit-desk-min` is "0"
     only once they restore it, so an absent key means the default. The
     notebook page lets the reader fix the start instead ("As I left it",
     Minimized, Open, Closed; `lit-desk-start`), and `src/lib/desk-start.mjs`
     is the one rule, which Layout.astro's pre-paint script repeats.
     **Only the expanded notebook makes room** (BVJ, 2026-10-14): narrowing
     the column (rule 4), the dragged widths and the column's move left all
     happen only while it is expanded, so minimized, folded-because-floating
     or closed, the column keeps 52 and moves only as far as the tab needs
     to stay clear of the text (`placeFloating`), usually not at all. `<html data-desk-expanded>` is
     the switch, owned by `desk/margin.js` (`setExpanded`, inside
     `keepReadingPlace`) and stamped before paint when it starts expanded;
     `data-desk-panel` still means open-or-minimized, for the dock and the
     commands.
     **It appears only on the pages `READING_SURFACES`
     (`src/scripts/desk-frame.js`) lists**: Study View chapters and intros,
     Read View, articles and the glossary, each with its column, its heading
     (or, on an article, `start`: the card, whose top edge the panel's top
     edge matches) and its `end`: the seam where the page meets the footer's colour, which
     on the scripture pages is the top of the license band (SblgntNotice),
     since a band right above the footer counts as footer.
     Everywhere else there is no panel, no button (a `:has()` rule in
     global.css, held to the list by `test/desk-frame.test.js`), and the
     desk's code isn't loaded. **A new reading surface needs an entry in
     both.**
     Floating panels subtract `dockWidth()` (`src/scripts/desk-frame.js`)
     from the window's width, and anything marked `[data-desk-dock]` counts
     as inside it (no outside-click close, shortcuts stand down).
  4. **While the preview is on, the reading measure is 52**, the width BVJ
     picked for the desk's release, **and 48 on Study View chapters while the
     notebook is expanded** (BVJ, 2026-10-08; 2026-10-14), to leave the panel room for the
     Greek tab without moving the column. Read View, intros,
     articles and the glossary stay at 52, since none gets that tab. The switch is
     `html[data-desk-expanded]`, which Layout.astro's pre-paint script stamps
     so a page opening with the notebook expanded never reflows, and which
     margin.js sets and clears inside `keepReadingPlace`.
     Read View's toolbar takes a fixed
     floor (725px; 895px in OpenDyslexic) because it outgrows the column.
     **On Study View the reader can drag the widths** of their notes'
     margin, the LIT and the notebook (`desk/widths.js`, rules in
     `desk-margin.mjs`): kept in `sessionStorage` for the visit, stamped
     before first paint as `data-desk-widths` with `--desk-measure` and
     `--desk-width`, and global.css sets the column's measure and right
     margin from them.
     **The glossary also becomes a reading page** then (the end of
     `pages/glossary.css`): one column at the reading width, with the
     scripture pages' type sizes, all scaling with the Display tray's text
     size. Readers keep the wide glossary until the desk is released.
     A heading with several options takes only the break it needs
     (`desk/glossary-titles.js`, measured): its options on the heading's
     line, or together on a line of their own, and each on its own line
     only when that can't hold them.
  5. **Records name the text they were made on** through
     `<html data-content-version>`, which Layout.astro reads at build from
     `public/api/version.json` (`src/lib/content-version.mjs`; "unversioned"
     in dev before a build).
     **Every record read comes through `migrateRecord`** (`desk-records.mjs`):
     the store's reads (`current` in `desk/store.js`, the history's "before"
     included), `desk/readonly-notebook.js`, an import (`planImport`) and the
     merge. It renames an old note marker in memory (`bookmark` reads as
     `ribbon`, STUDY-DESK.md E10; `RENAMED_MARKERS`) and never writes back
     for a read, so the next write of the note carries the new name. A new
     way of reading records needs it too, or an old note shows its old name
     and a write over it compares unlike records.
  6. **Phase 1c's notes reach the reader code through one event.**
     `chapter-tools.js` dispatches `lit:panel-actions` from the verse menu
     and the selection panel before placing them, with the panel, its verses
     and (for a selection) the selected `range`. Only
     `src/scripts/desk/actions.js` listens, adding "My Notebook" (Add a note,
     Bookmark and "Show in notebook"; Bookmark only in Read View), so a
     reader's menus are unchanged. The Notebook's "This verse" tab
     (`desk/tab-verse.js`) listens too: a verse menu opened while the
     notebook is open moves the tab to that verse. Keep the event before `showPanel`, or the panel is measured
     without the row. A panel opened with `extra: { stay: true }` (the note
     editor) ignores outside clicks in `lit-panel.js`.
  7. **Margin notes never add text to the scripture.** They sit in one
     `<aside class="desk-notes">` at the end of `<body>`, placed beside
     their first word (`src/lib/desk-notes.mjs` holds the rules,
     `notes-margin.js` draws), and the words a note hangs on are lit with
     the CSS Custom Highlight API. Copy text, the handout and the desk's
     anchor reader all read the verses off the page. Their face is Playpen
     Sans (`@fontsource-variable/playpen-sans`, registered in `desk.css`
     with its Latin, Latin-ext and Greek ranges, so it loads only with the
     desk and only when a note uses it), or Inter on "Plain"; a reader's
     Atkinson or OpenDyslexic choice wins through `html[data-font]` as
     everywhere. Bookmarks show in the same `<aside>` as a red mark, a trial
     STUDY-DESK.md records, with their own switch (`data-desk-bookmarks`).
     **Bookmarks are the one piece of marginalia Read View shows**
     (`desk/read-marks.js`; BVJ, 2026-10-08): notes stay a Study View tool. The notes' settings (`data-desk-notes`,
     `data-desk-note-font`, `data-desk-list` on `<html>`) have no pre-paint
     script, since nothing of the desk paints before it loads. "Hide my
     notes" (M1, key H) is no setting of its own: it saves and turns off
     "My notes", "My bookmarks" and both views' "My highlights", and puts
     them back (`note-settings.js`). With "My notes" off, a footnote's
     popover lists none of the reader's notes either (`desk.css`, BA17),
     while the Notebook's tabs and /desk's panes still do. Going to a note
     from the panel marks its words even then, and puts focus on the verse
     number they start in, since the margin holds no note to focus (BA19).
     **A verse holds one bookmark**: Bookmark and Remove bookmark plan
     over the notebook in the write's own transaction (`planBookmark`,
     `planUnbookmark` in `desk-store-core.mjs`), so a second press adds
     nothing and removing takes every bookmark a copy may have brought
     (BA16).
     While the desk is on, each Study View verse number's accessible name
     names the reader's highlights and counts their notes on it ("Verse 18,
     highlighted yellow, 1 note of mine"; `desk/verse-labels.js`), the one
     place a screen reader meets them in reading order, since an attribute
     adds nothing to the scripture.
     **Highlights are a tint only** (BVJ, 2026-10-09: no underline or
     other second cue, which met the term lens's underline), one CSS
     Custom Highlight per colour (`desk/highlights.js`; colours in
     `desk.css`). The overlap rule is `src/lib/desk-highlights.mjs`
     (pure, unit-tested), applied only when this reader makes or removes a
     highlight, never to records from elsewhere, and committed in one
     transaction (`store.commit`). Read View shows them only when its own
     "My highlights" is on (off by default), and only then offers Highlight.
     The switch is one setting with two controls, the Notebook panel's and a
     "My highlights" box in the Display tray's Show group (injected by
     `note-settings.js` only with the desk on; BVJ, 2026-10-21), on Study
     View chapters, in Read View (its own setting) and on /desk, where it is
     the only desk switch the tray gets and is Study View's setting.
  8. **Notes on a glossary entry or an article** (N11, provisional) use
     the same margin: `desk/note-sources.js` says what a page's notes sit
     beside and how each is found (a chapter's verses, or an entry's or
     article's own text through `src/lib/desk-prose-anchor.mjs`), and
     `desk/prose-actions.js` offers "Add a note" on a selection there (on
     the glossary, as the "My Notebook" row of every reader's selection panel,
     with "Note on this entry" for the whole entry).
  9. **Pinned footnotes** (`desk/pins.js`, rules in
     `src/lib/desk-footnotes.mjs`) reach the footnote popover the same way
     as rule 6: `chapter-tools.js` dispatches `lit:footnote-actions` with
     the popover before placing it, and only the desk listens. A pin names
     its footnote by verse and full text, never its letter, and
     `test/desk-footnotes.test.js` holds the page's text of every published
     footnote equal to the JSON's, so a new render-time transform of
     footnote HTML that adds visible text will fail there.
  10. **The Notebook panel has tabs, one module each**: "My Notes"
     (`desk/tab-mine.js`) everywhere, and "This verse" (`desk/tab-verse.js`)
     and "Greek" (`desk/tab-greek.js`, rule 14) on Study View chapters, and
     Greek on draft chapters too (BVJ, 2026-10-13; `greekChapter()` in
     `desk/page.js`, which reads `data-draft-book`/`data-draft-chapter`, never
     the last-read attributes), from the `TABS` table in `desk/panel.js`. (A Versions tab, and API.bible with it, is
     deferred indefinitely: not in version 1, BVJ 2026-10-11.) A page with one tab shows no tab
     row, and the panel's foot belongs to My Notes.
  11. **Ctrl+Z (⌘Z) and redo undo this tab's changes to the notebook**, one
     history per page visit, 50 deep. The store records an entry for every
     write the reader makes (`apply` in `desk/store.js`, which reads the
     touched records inside the same transaction before writing; `record:
     false` is for the purge at open and for the history's own writes, and a
     change from another tab is never an entry). `src/lib/desk-history.mjs`
     (pure, unit-tested) builds the entries, writes the inverse and decides
     whether a change was overtaken; `desk/history.js` holds the stacks and
     the keys, and the undo bar's Undo button is the same thing (`undoEntry`),
     so callers capture `store.lastEntry()` right after their write and pass
     `() => undoEntry(entry)` to `showUndo`. Rules that are easy to break:
     an undo restamps `modified` and `client` (the undone state must outrank
     the change under the newer-wins sync rule), and a trash record it puts
     back gets a fresh `deletedAt` too, so entries are compared **without**
     those fields, or nothing could be undone twice in a row; undoing an add
     deletes through a trash record (its id allotted in the entry,
     `undoTrash`, which a redo removes), never a bare removal, which a backup
     would bring back as new (BA7); a change that depends on what the
     notebook holds (deleting, restoring, the purge, a history step, the note
     editor's save, every change to a sheet) reads and writes in **one**
     transaction through `store.change`, and any write that throws aborts the
     whole transaction (BA5, BA13). **A sheet is changed over the record as
     read there** (`planSheetChange` in `desk-sheets.mjs`), never over a copy a
     pane or /search holds, which another tab may have saved past (BA129,
     BA130); the Sheet pane's `sheet` moves only once a save lands, so a
     failed one leaves it on the saved copy (BA128), though each save's
     transaction opens when the change is asked for, so saves land in order.
     **A closing page keeps its last typing** (BA72): on `pagehide` the pane
     writes what hasn't landed, applied to its own copy, through
     `store.writeNow`, which writes before it returns, reads nothing,
     commits at once and first aborts any transaction still waiting on its
     read. Chrome keeps no other kind of write made while a page closes;
     a read-then-write save, or one queued behind it, is lost (tested
     2026-10-27). Hidden only starts the ordinary saves; the note editor saves onto the note as it is at Save
     (`planEdit`), and refuses if anything but its words and marker changed
     meanwhile (BA6); and the keys stand down in text fields, selects, anywhere in a sheet's
     text editor (its toolbar too, where Ctrl+Z undoes the typing, BA74) and
     while a note editor is open, leaving the browser's own undo alone. Not tied to the Keyboard
     switch (it isn't a single-key shortcut, WCAG 2.1.4). The undo bar closes by itself after ten seconds (BVJ,
     2026-10-09), never while hovered or focused; that is safe only because
     the same undo stays on Ctrl+Z, so don't remove one without the other.
  12. **A mark whose words moved says so** (the change notice, N3).
     `src/lib/desk-change.mjs` (pure, unit-tested) decides which marks carry
     a notice, from the format's statuses, comparing the marked words (or a
     whole-verse note's `verseCopy`) with typography evened out
     (`desk-wording.mjs`), so a change of quotes or dashes alone never
     raises one; `desk/change-notice.js` shows it and is the only
     place a notice writes (Keep), since a mark is never rewritten until
     the reader acts. A notice is judged only where the chapter's text is
     on the page. It reads two app-contract files: `/api/version.json`,
     before keeping a record whose text can't be ordered against the
     page's, and `/api/data/release-notes.json`, for the date
     (`releaseNoteFor` reads a `text_updated` change's verses from its
     `description`), fetched only when a notice opens. A highlight carrying
     a notice is never merged or trimmed (`placeHighlights`).
  13. **Phase 1d is the notebook around the marks** (built 2026-10-12).
     - **The notebook page**, `/notebook/` (`pages/notebook.astro`), and its
       help, `/notebook/help/`: noindex, out of the sitemap (one `notebook/`
       prefix rule in `astro.config.mjs`) and out of Pagefind (Layout's
       default). `desk-gate.js` loads `desk/notebook-page.js` when
       `[data-notebook-page]` is present; the page isn't a reading surface,
       so it has no panel, and without the preview it shows only a short
       note. Shared pieces: `desk/boot.js` (the stylesheet and context the
       shell and the page both need), `record-rows.js`, `labels-ui.js`.
     - **Save and open a copy** (`src/lib/desk-export.mjs`, pure; format in
       STUDY-DESK-FORMAT.md, "The export file"): Markdown, Web Annotation
       and a full backup, the last the only one carrying trash. Opening
       merges through `desk-merge.mjs` in one commit and never deletes for
       absence (C17). **A Markdown copy carries times, so an older one can't
       undo or revive**: each entry's id comment holds its `modified`, and
       words that differ are an edit only when the note here is no newer
       (BA1); an entry whose id is held as trash or a tombstone is left out
       (BA2). Keep both when changing how a Markdown entry is read.
       **Open plans again when pressed** (BA3): `planOpen` reads and plans
       the file against `store.all()` at that moment, and if the outcome
       (`sameOpen`) differs from the summary on screen, the new one is shown
       and nothing is written. **A record dated by a clock running ahead
       never beats what the notebook holds** (BA4, BA12; `desk-merge.mjs`'s
       clamp, capped at a JSON file's `exported`), so opening one file twice
       writes nothing the second time, on any day. The summary counts every
       write the plan makes (BA11), so "Nothing to open" never sits beside
       an active Open.
       `META.lastExport` (`store.getMeta/setMeta`) is what the
       "last saved a copy" line and the reminder read.
     - **Labels** (`desk-labels.mjs`): the reader-facing name for M8's tags,
       applied from the notebook page, names unique ignoring case and
       accents.
     - **Places and ribbons** (`desk-places.mjs`, `desk/places.js`,
       `ribbon-follow.js`, `ribbon-form.js`). "Continue reading" and Read
       View's per-book places are **not records**: they stay in their own
       storage and are only listed beside the ribbons. A ribbon is a `place`
       record with `ribbon: true`. `last-read.js` dispatches `lit:last-read`
       on every save (nothing hears it unless the desk is on). **The C25
       rule**: following a ribbon's link sets `sessionStorage['lit-desk-ribbon']`,
       and while the reader stays in that book in that tab the ribbon
       follows them (written without an undo entry); a page outside the
       book clears it.
     - **The interleaf (N7) was built and set aside** (BVJ, 2026-10-13: it
       repeats the margin and the panel, and breaks up the scripture). Its
       code is on `claude/desk-1d-hidden` (commit 1f27b2e); revert aacdc92
       to bring it back. `chapterBlocks()` in `page.js` is now just
       `.chapter-paragraphs`' children, with no bands to skip.
     - **Search and commands**: the notebook reaches the search surfaces only
       through `loadDeskSearch()` in `search-core.js`, which imports
       `desk/notebook-search.js` (read-only IndexedDB) only with
       `data-desk="on"`; commands (`desk-commands.mjs`, `desk/commands.js`)
       travel as one `lit:desk-command` event with a single listener. Keep
       desk code out of the two search UIs themselves.
     - **First use** (`desk-first-use.mjs`, `desk/first-use.js`,
       `desk/tour.js`): the "Where should your notebook live?" card
       (`localStorage['lit-desk-home']`), the foot's reminder and Safari
       line, and the tour (`lit-desk-tour`, which also holds the offer's
       markers: `later:<date>` and `never`). **The tour is offered in a
       window beside the Notebook** (BVJ, 2026-10-14), the first time it is
       expanded with the home question answered: Take the tour now, Remind
       me later (also the ×, Escape, closing or minimizing the Notebook,
       and leaving the page; back on a later day), or Don't show this again.
       The window is `src/scripts/float-window.js`, which stays open through
       clicks elsewhere and never takes `lit-panel.js`'s one slot.
       The privacy page has a paragraph naming these keys and the notebook's
       storage: keep it in step if a key or what is stored changes.
       `/privacy`'s effective date was not bumped for it.
       **The tour's steps act, and leave nothing behind** (BVJ,
       2026-10-13): they open real menus, the note editor (in an example
       mode that can't save), the panel's tabs and the search tray, and end
       by undoing all of it, putting the Notebook back with `panel.js`'s
       `snapshot`/`restore` and the scroll where it was. While it runs,
       `data-desk-tour` on `<html>` makes `saveLastRead` record nothing. A
       new step that changes anything must undo it the same way (`later` in
       `tour.js`), and must never write a record.
     - **N8, the hidden passage, is built but held** (BVJ, 2026-10-12, until
       after the Zoom) on branches `claude/desk-1d-hidden` and
       `claude/desk-1d-search`; it is not in this tree, so nothing here
       should assume a `hidden` record is honoured (an imported one shows as
       "Other items").
  14. **Phase 1f is the Greek tab** (built 2026-10-13; STUDY-DESK.md,
     "Order of work", 1f). Three things to know before touching it:
     - **Its data is committed, not built.** `npm run build:greek` reads
       clones kept outside the repo (`GREEK_SOURCES_DIR`: SBL's SBLGNT 1.2
       with its apparatus, MACULA Greek, the UBS dictionary, STEPBible's
       lexicons; `MORPHGNT_DIR`) and writes `public/greek/`: `text/` one
       file per chapter, `ubs/`, `step/` and `lsj/` lexicon shards the tab
       fetches when a word is opened, and `LICENSE.txt`. SBL's text is the
       text of record; MorphGNT's lemmas and parsing are checked against it
       word by word, and its word numbers (`t`) are alignment phase 2's.
       John 7:53–8:11 takes its parsing from MACULA's SBLGNT, Romans
       16:25–27 its Greek from the SBLGNT apparatus and its parsing from
       MACULA's Nestle 1904. Re-run it when a source changes, never by hand.
     - **Licenses keep the files apart.** `text/` and `ubs/` are CC BY-SA
       4.0 (MorphGNT, UBS); `step/` and `lsj/` stay CC BY 4.0. **Nothing
       from the LIT goes into `public/greek/`**: the tab's "rendered here
       as…" line reads the page's own `#term-lens-data`, whose terms carry
       their Greek `lemmas` (`term-lens-data.mjs`, from
       `scripts/lib/glossary-lemmas.mjs`). A website asset, never under
       `public/api/`.
     - **The tab never moves the page.** Its text scrolls on its own and
       opens at the verse being read, with "Go to verse N" to catch up; its
       words are one roving tab stop, moved with the arrow keys. The
       reader's lexicon choice is `localStorage['lit-desk-lexicon']`, named
       in the privacy paragraph. **The line between the Greek and a word's
       entry is draggable** (BVJ, 2026-10-17), the entry taking a quarter to
       three quarters of their room (`src/lib/desk-greek-split.mjs`, pure and
       tested; the handle is in `tab-greek.js`, sized by CSS flex ratios on
       `--desk-greek-split`). Shown only while a word is open; kept in
       `sessionStorage['lit-desk-greek-split']` for the visit, forgotten by
       "Reset widths", and named in /privacy's paragraph. The parsing is put in words by
       `src/lib/greek-parse.mjs` (shared with the phase 2 tool), and the
       SBLGNT's ⸀–⸅ signs draw from `public/fonts/text-critical-signs.otf`.
  15. **Phase 1h is searching the Greek** (built 2026-10-13; STUDY-DESK.md,
     "Order of work", 1h). Five things to know:
     - **It is ordinary site search, gated until launch.** Only while
       `greekSearchEnabled()` in `search-core.js` is true, which today is
       the preview's `data-desk="on"`; without it nothing under `greek/`
       is fetched and search is exactly as before. **Launch is that one
       function returning true.**
     - **One query never gets both English and Greek results** (BVJ,
       2026-10-13). A query with Greek letters or a Strong's number
       (`isGreekQuery`) gets the Greek alone, at any length (ὁ, ἐν); every
       other query gets exactly the pre-1h search, unless the reader picks
       the type menu's "Greek" (injected by script, only with the gate on),
       which searches Latin text as a transliteration or a gloss. /search
       pages the Greek with the English verses' pager, in Bible order with
       no sort control; the tray shows its own Greek group alone.
     - **One rule set**, `src/lib/greek-search.mjs` (pure, tested): Greek in
       any form and accent (folded by `foldGreek`, which `build:greek` also
       uses for the index), a Strong's number (a lemma's other MACULA numbers
       too, so G1510 finds εἰμί), a transliteration compared by key
       (`greekKey`/`latinKeys`: agreuō = agreuo, Christos = xristos), or an
       English gloss. Glosses are the lemma's own, STEPBible's brief one
       (πίστις is "to believe in" in UBS's commonest sense, "faith" there)
       and, as whole glosses only, every other UBS sense. First of all
       come **the LIT's own renderings**, through the glossary bridge
       (`build:greek-bridge`): "self-preservation" reaches σάρξ, but only in
       the verses the LIT renders it so, and a lemma that never occurs in
       those verses is dropped. Verse-level until alignment phase 2 covers
       every word, when the bridge widens.
     - **A result is the verse link plus `?greek=<verse>.<t>`**
       (`greekHref`). `desk/greek-link.js` opens the Notebook at that word,
       even if the reader had closed it, and strips the parameter; a result
       for the chapter on screen sends `lit:greek-word` instead of loading.
     - **The Greek tab searches too** (`desk/greek-find.js`): a button in
       its header opens a field in place, results replace the text until
       "Back to the text", and in a word's details the form, the lemma and
       the Strong's number each start a search (BVJ, 2026-10-13). Its result
       rows preview their verse on hover like any reference
       (`ref-preview.js`: a row for another chapter is a link with a
       `?greek=` parameter, which the preview ignores; one for the chapter
       on screen is a button naming its verse in `data-preview-href`, and
       a tap on it jumps rather than previews).
  16. **Phase 2a's small pieces read, never write** (built 2026-10-15;
     STUDY-DESK.md, "Order of work", 2a): B3 and N4 add no kind of record,
     so each can be taken out cleanly (M10 was, the same day: BVJ shelved
     it, and its code is on `claude/desk-2a-m10`). Two things to know:
     - **A note's body is drawn through `noteBodyHtml`**
       (`src/lib/desk-chains.mjs`, via `desk/note-words.js`), which escapes
       the reader's text and only then runs `linkScriptureRefs`, so a typed
       reference links and previews as a footnote's does and nothing typed
       becomes markup. A new place that shows a note's body uses it too
       (search snippets, fields and accessible names stay plain text). A
       link can't sit inside a button, so a note row's own control is
       stretched over the row behind its words.
     - **What's new for you** (`src/lib/desk-whats-new.mjs`) reads the
       release notes through the change notice's `changeVerses`, so the
       description wording rule 12 relies on is load-bearing here as well.
       The feed is fetched once per tab (`desk/release-feed.js`,
       `sessionStorage['lit-desk-release-feed']`), "last looked" is the
       notebook meta value `whatsNewSeen`; both are in /privacy's paragraph.
  17. **Phase 2a's Greek search commands** (built 2026-10-15; STUDY-DESK.md,
     "Order of work", 2a): searching by parsing (`*.aor.impv`, "genitives
     of πίστις") and by construction (`πίστις.gen, Ἰησοῦς/Χριστός.gen`),
     behind rule 15's gate. Four things to know:
     - **`src/lib/greek-query.mjs` is the language**, pure and tested:
       reading a query, looking its words up (through `matchGreek`),
       `matchConstruction`, the readback (`describeGreekQuery`), the error
       sentences, and `COMMANDS` and `EXAMPLES`, which the commands window
       lists. A test holds every listed command to the parser and every
       example to the committed data, so a new command goes in `FILTERS` or
       `COMMANDS` there and nowhere else. **One bare word is always a
       word** ("any", "perfect" and "genitive" alone search as glosses) and
       **quotes always mean the word itself** (BVJ, 2026-10-14). Two filters
       of one kind joined by "/" mean either (`.gen/dat`, BVJ 2026-10-15), so
       a term's `filters` can hold several of one axis; `codeFits` and
       `groupsForFilters` read that as "any of them". A filter with no word
       before it is any word (".gen" is "*.gen", BA48). **A search joins at
       most four words** (`MAX_TERMS`, BA44): `matchConstruction` builds each
       match round its middle word, exact but cubic only because of that
       cap, so raising it needs a new matcher, not a bigger number.
     - **`searchGreekAuto` in `search-core.js` is the one Greek search**
       the tray, /search and the Greek tab call: a command query goes to
       `searchGreekCommands`, anything else to 1h's `searchGreek`, with
       two or three plain Latin words that find nothing tried as a
       construction. **Plain words holding a command word are a gloss when
       they are one whole** ("present time", "in order to"; `wholeGloss`),
       and otherwise a command that falls back to the gloss when it fails
       or finds nothing (BA45, BVJ 2026-10-27). `isGreekQuery` also counts `*` standing for a word and
       a dot followed by a parsing word, so the tray, which has no type
       menu, reads them as Greek.
     - **The commands window is the one place for instructions and
       examples** (BVJ, 2026-10-14): a page gains only a "Search commands"
       button, a placeholder under the "Greek" type, the readback, and
       examples where an empty search's results would be. Before adding a
       hint or a control to a search page, put it in the window
       (`src/scripts/greek-commands.js`). It is a `float-window.js` window,
       outside `lit-panel.js`'s one slot, so a footnote or preview opening
       never closes it; from the Greek tab it closes with the Notebook,
       which announces itself with `lit:notebook-state` (`desk/panel.js`).
       Its two keys, `localStorage['lit-greek-commands']` (opened once) and
       `sessionStorage['lit-greek-commands-pos']` (a dragged place), are in
       /privacy's paragraph.
     - **The data is format 2 of `public/greek/search/`**: each lemma's
       shard entry is `[forms, flat, parses]` with six numbers a word, and
       `parse.json` with `parse/<group>.json` holds every word by its
       parsing, named by `parseGroup` (`greek-search.mjs`, shared by build
       and client). Rebuild with `npm run build:greek`, never by hand.
  18. **Phases 3c to 3g are /desk** (built 2026-10-19; STUDY-DESK.md, D9
     and "Order of work", 3c to 3g): `src/pages/desk.astro`, which `desk-gate.js`
     fills with `src/scripts/desk/desk-page.js` when `[data-desk-page]` is
     present. It isn't a reading surface (no Notebook panel; not in
     `READING_SURFACES`), and the announcement gate treats it as scripture.
     Six things to know:
     - **`src/lib/desk-layout.mjs` is the one set of rules** (pure, tested):
       a layout is a tree of panes and normalized splits; the Layout menu's
       arrangements (`ARRANGEMENTS`; four rows left out, BVJ 2026-10-18);
       dragging a pane to an edge of another (`splitPane`); the 280 by 160
       minimum (`needs`, `fitSizes`, `resize`); and which panes follow the
       active LIT pane unless pinned (`KINDS`, `leaderFor`). A new
       arrangement or kind goes there, never in the page.
     - **A pane's body comes from `desk/desk-panes.js`**, which mounts the
       Notebook's own modules rather than copies, so a pane and its tab
       can't drift apart: My Notes is `tab-mine.js`, This verse
       `tab-verse.js` (with "This chapter", the chapter's Go deeper, at its
       foot), Greek `tab-greek.js`, and What I've kept `kept-list.js`, which
       the notebook page draws too. Those tabs take a `source` and an
       `idSuffix` for this; a change to one must keep both callers working.
       The LIT pane is `desk/lit-pane.js`, Footnotes
       `desk/footnotes-view.js` (3e), and Sheet `desk/sheet-pane.js` (3f),
       the sheet editor, with its formatted text in `desk/sheet-text.js`
       (a paste or a drop from elsewhere is read by `pastedSheetHtml`,
       which keeps what Google Docs, Word and web pages mean: headings and
       lists inside a wrapper, Docs' bold and italic, Word's lists; BA68,
       BA71, BA73. How a client reads a paste isn't in the format)
       and what it knows about the LIT (3h: blanks, the footnote picker,
       the key terms box and the license card) in `desk/sheet-lit.js`,
       whose rules are `src/lib/desk-sheet-lit.mjs`.
     - **Every pane reads a chapter from its built Study View page**,
       fetched and parsed once a visit (`desk/chapter-page.js`), so what it
       shows is character-identical to Study View. Each LIT pane keeps
       where its reader is (`at` on the pane), and the active one's is the
       shared passage, `layout.place` ("john 3:16",
       `src/lib/desk-passage.mjs`), which the panes that aren't pinned
       follow. **Every LIT pane has an `at` once there is a shared place**
       (`placeLitPanes` in `desk-layout.mjs`, BA52): a new one, or one saved
       without, starts at the shared place and keeps it, so it never
       follows the active pane. "Reset to the original layout" keeps the
       place (`originalLayout(place)`, BA55). **A redraw keeps every pane's
       scrolling** (BA51): `draw()` takes each pane off the page, which
       resets it, so `keepScroll` notes it first and puts it back, with the
       pane's own `keep()` where its scrolling tells where its reader is
       (the LIT pane by its verse at the reading line, the Greek by not
       reporting the restored scroll). A new pane kind that reports its
       place on scroll needs a `keep` too. They lead back: their picker (`desk/passage-bar.js`), This
       verse's Previous and Next, a footnote's verse, or scrolling the Greek
       move the active LIT pane. With no LIT pane open they share the place
       among themselves (BVJ, 2026-10-19, option A); a pinned pane keeps
       its own in `pin.at`.
     - **The LIT pane scrolls the whole New Testament**, a chapter fetched
       as the reader nears it (`src/lib/desk-corpus.mjs`: a run of drafts in
       one book is one stub, from the draft list `desk.astro` writes at
       build). Its text is the page's own with every id prefixed by pane and
       chapter (`src/lib/desk-lit-text.mjs`), which
       `test/desk-anchor-dom.test.js` sweeps as a third view; **a new
       render-time change to the chapter text must pass that sweep too.** A
       chapter loading above is held in place by measuring the reading line
       (the browser's scroll anchoring is off there, or both would correct),
       and only the reader's own scrolling reports a new place, so panes
       never chase each other. Footnote letters open their own chapter's
       note (`footnotePanel`, shared with Study View in `panel-pieces.js`);
       key terms are attached per chapter (`attachTermLens` in
       `term-lens.js`). **The verse menu and the selection panel are Study
       View's own** (3f): `attachVerseTools` in `chapter-tools.js` takes the
       pane as a view whose text holds many chapters (each names its own
       reference, link and notes), and one set of selection listeners serves
       every view, so two panes never answer one selection. A change to
       either panel must keep Study View, Read View and the pane working. No
       reader's notes or bookmarks beside the pane's text, by BVJ's choice
       (3g): My Notes is a following pane that scrolls its list so the
       records on the passage being read are in view (`follow` in
       `tab-mine.js`), and a record's reference moves the LIT pane there.
     - **The reader's marks reach the LIT pane through `page.js`** (3g): each
       pane registers its text (`addDeskText`), `deskChapterBoxes()` lists
       every chapter the panes show (twice when two panes show it), and
       `chapterTextFor` reads the first; `desk/lit-records.js` keeps each
       chapter's records for whatever draws on them (`highlights.js` and
       `verse-labels.js` have a /desk mode on it). Pins work per chapter
       (`pinButton(id, label, where)` in `pins.js`), reading a fetched
       chapter's footnotes through `loadedChapterPage` (`chapter-page.js`),
       which is also how a pin's change notice is judged on /desk.
     - **A sheet's passages come from the live text** (format rule 1):
       `src/lib/desk-sheet-passages.mjs` makes one from a verse menu, a
       selection or a notebook record, and finds its words in today's
       chapter; the pane draws them from the chapter's fetched page. A
       passage's blanks, footnote choices and key terms are worked out the
       same way, in that chapter's anchor text, with the term lens's marks
       turned into offsets (`termMarkOffsets`), so nothing about the text
       is stored but the words a blank covers. "Add to
       sheet" reaches the LIT pane's menus through `lit:panel-actions`, as
       the "My Notebook" row does, which reads `book`, `chapter` and
       `textFor` from the detail. Which sheet a Sheet pane shows is `sheet`
       on its pane in the layout (`setPaneSheet`).
     - **The layout is `localStorage['lit-desk-layout']`**: the last
       layout, the reader's default and which opens the page, written on
       every change (the shared passage, each LIT pane's place and each
       Sheet pane's sheet included) and checked on the way
       back in (`checkLayout`). **"My default" is an arrangement, not a
       passage** (BVJ, 2026-10-26; BA53): it opens at the last place on the
       desk, or Continue reading's (`openingLayout`, `atPlace`), keeping its
       pins and sheets; a
       layout that fails the check falls back to the original, the LIT
       beside My Notes, 60/40. Named in /privacy's paragraph.
     - **The desk has its own header** (BVJ, 2026-10-21; `deskTitle` on
       Layout and SiteHeader), at every width: the emblem and "LIT Bible"
       as the home link, "Study Desk" centered as the page's h1, then the
       Layout menu (desk-page.js fills `[data-desk-header-tools]`), Aa and
       the menu button. No nav row and no search; the Display tray carries
       Study View's "Show" switches (`scriptureControls="study"`), which
       reach the LIT pane's text. A search pane is phase 3m.
     - **The panes, then the source-text notice** (`SblgntNotice`, with the
       LIT's license line; the rest of the footer is hidden by
       `html[data-desk-workspace]` in `desk.css`). Each pane scrolls on its
       own, so the page scrolls from the header, the gutters, the keyboard
       or the scrollbar: `fitHeight` grows the panes as the header scrolls
       away, their foot a gutter above the window's bottom edge, until they
       fill the window less that gutter above and below (the page's side
       gutter, 16px; BVJ, 2026-10-22), and then they move up to show the
       notice. Scroll anchoring is
       off there, or the browser answers the growth with a scroll of its
       own.
  19. **Phase 3i is a sheet on paper** (built 2026-10-20; STUDY-DESK.md, S4,
     S5, S9, C27 and "Order of work", 3i): `src/pages/sheets.astro`, which
     `desk-gate.js` fills with `src/scripts/desk/sheet-page.js` when
     `[data-sheet-page]` is present. It shows, prints and copies a sheet and
     **never writes a record** (sheets are edited on /desk only; the Sheet
     pane's "Print or share…" opens it in a new tab). Six things to know:
     - **`src/lib/desk-sheet-copy.mjs` is the rules** (pure, tested): which
       modules each copy prints (`modulesForCopy`: the participant's leaves
       out Leader only), one code per chapter (`chapterCodes`, the address
       form of STUDY-DESK-FORMAT.md, "Addresses"), the key terms box where
       its words are blanked, the paper (`defaultPaper`, `pageRule`), and
       `sheetHtmlForShow`, which sanitizes a sheet's formatted words again
       and links their references. **A new place that shows a sheet's
       formatted words uses it**, never `innerHTML` of the stored html.
     - **`desk/sheet-copy.js` draws a copy from the Sheet pane's own reading**:
       `readPassage`, `passageWords` and `locateBlanks` are exported from
       `sheet-lit.js` for it, so the editor and the paper can't disagree
       about which words a passage, a blank or a footnote covers.
       `passageWords`' `keepNotes` keeps the printing footnotes' letters as
       plain superscripts.
     - **The printed codes are `src/lib/qr-svg.mjs`**, shared with
       `build-apps-qr.mjs`; `qrcode-generator` is a runtime dependency for
       that reason, loaded only by the sheet page's chunk.
     - **Copy for Word** (`desk/sheet-word.js`) reads the copy on screen and
       writes HTML with inline styles plus plain text, so what is pasted is
       what would print, codes aside.
     - **The paper is `localStorage['lit-sheet-paper']`** (Letter or A4,
       guessed from the reader's languages until chosen), named in /privacy's
       paragraph. Its `@page` rule is added as the page's last style, after
       print.css. On screen the copy is a white sheet of that width in either
       theme, and `sheets-page.css` lets the reader's named fonts, colors and
       backgrounds print, which print.css otherwise turns to black serif.
     - **Printing with my notes (M6) needs no sheet**: "Print with my notes"
       in the My Notes foot and the command list, on Study View chapters and
       Read View (`desk/print-notes.js`, rules in
       `src/lib/desk-print-notes.mjs`). For that one print it sets
       `html[data-desk-print="notes"]`, inserts a print-only
       `aside.desk-print-notes` after each block holding a note's first word
       (`display: none` on screen, `aria-hidden`, no `[data-verse]` text, so
       no reader of the page sees it), paints the highlights as their own
       Custom Highlights (`desk-print-hl-*`, which Chrome prints), and undoes
       all of it on `afterprint`. The grid that sets the notes beside the
       text is in `desk.css`'s last section. Plain Ctrl+P never has the
       attribute and prints as before.
     - **Printing with room to write (N9) is M6's blank sibling**: the
       button right after it in the My Notes foot, and the command
       `print-with-room`. `desk/print-room.js` only stamps
       `html[data-desk-print="room"]`, waits for the print fonts (reusing
       `print-notes.js`'s bounded `printFonts`), prints, and removes the
       attribute on `afterprint`. It reads no notebook, so unlike M6 it is
       offered even where the browser keeps none. The look is a background on
       the scripture container (ruled lines and a left rule on the right 35%,
       text held in by padding), in `desk.css` beside M6's section, so the
       rules run unbroken across page breaks; footnotes and the notice stay
       full width after it.
  20. **Phase 3j is present mode** (built 2026-10-20; STUDY-DESK.md, S6, M2,
     M3 and "Order of work", 3j), on the sheet's own page:
     `src/scripts/desk/sheet-present.js`, opened by sheet-page.js's
     "Present", or at once for `&view=present` (the Sheet pane's
     "Present…") and `&view=presenter` (the presenter view's window). Like
     the rest of the page it **never writes a record, and stores nothing**:
     where the room is lives in the open windows. Five things to know:
     - **`src/lib/desk-present.mjs` is the rules** (pure, tested): the
       screens (`presentScreens`: a start screen, then each passage, text,
       question and key terms box the room sees; a Leader only part goes to
       the presenter view with the screen before it), the room's codes on the
       start screen (`roomCodes`, S5's codes, at most four), a blank's cover
       (`blankCover`), the state and its steps (`checkState`, `stepState`),
       the footnotes the reveal lets out (`screenFootnotes`), the keys
       (`presentKey`), `fitSize`, and the messages between windows.
     - **The reveal is the sheet's own blanks**, never a field of its own:
       a passage screen is drawn once by `presentPassage` in
       `desk/sheet-copy.js`, from the same reading as the paper copies, with
       each blank holding its words and their cover in one inline grid cell
       (`.sheet-blank--present`), so a reveal flips `data-revealed` and
       moves nothing. A change to how a copy reads a passage must keep both
       working.
     - **The room's screen is dark in either theme**: its colors and its
       focus ring are pinned on `.present-stage` in `sheets-page.css`, which
       the presenter view's previews share (`.present-preview__surface`). Each
       screen is set at the largest type that fits (`fitScreen`); footnotes
       come up in a box of their own over the screen and are fitted
       separately, so they never shrink the verses.
     - **The two windows stay in step through a BroadcastChannel**
       (`channelName`, one per sheet), with a `hello` from a window that
       opens and a `bye` from one that closes; every message is checked
       (`presentMessage`, `checkState`) before it is used. The presenter view
       places the presentation on a second screen through the Window
       Management API where it can (`openPresenterWindow`); without it, the
       leader drags the window.
     - **While it is open, everything behind it is `inert`**, and the stage
       is a `role="dialog"`, which is what keeps the site's single-key
       shortcuts (keyboard-shortcuts.js) out of its way.
  21. **Phase 3k is getting started and sharing** (built 2026-10-20;
     STUDY-DESK.md, M5, M9, S8 and "Order of work", 3k). Four things to know:
     - **Templates** (M9) are `src/lib/desk-sheet-templates.mjs` (pure,
       tested; every template's formatted text must already be in the
       sanitizer's canonical form). New sheet in the Sheet pane lists them,
       and a new part goes after the part last worked in (`insertIndex` in
       `sheet-pane.js`). A passage with none worked in goes after the last
       passage, or on a sheet with none, after the template's reading part
       (`passageInsertIndex`, `readingPart`), so it lands inside a template,
       not after it, on a sheet made days ago too (BA69, BVJ 2026-10-27).
       **A sheet never marks which part is the reading**: it is found by its
       heading ("Reading", "Read", "The text"), and a renamed one isn't, which
       only sends the passage to the end. **Template text never mentions the
       editor's tools**, since every part prints and goes up in present mode
       (BA70; the test checks): "Add the passage with + Passage…" is
       `READING_HINT`, ghost text the editor draws in the reading part (a
       `data-hint` `::after`, with `aria-description`) until there is a
       passage. Sheets made before 2026-10-27 still hold the old sentence.
     - **A sheet from a search or a topic** (M5) keeps desk code out of
       search.js: /search announces every hit (not just the page on screen)
       with a `lit:search-results` event on `document` and calls
       `loadDeskSheets()` in `search-core.js`, which imports
       `desk/search-sheet.js` only with `data-desk="on"`. The passages
       (Bible order, neighbors joined, capped at the sheet's limit) are
       `src/lib/desk-sheet-gather.mjs`. "Open it on the Study Desk" is
       `/desk/?sheet=<id>`, which desk-page.js shows in a Sheet pane
       (`showSheet` in `desk-layout.mjs`) and strips from the address.
     - **Sharing** (S8) is `src/lib/desk-sheet-share.mjs` (pure, tested;
       format in STUDY-DESK-FORMAT.md, "Sharing a sheet"): the sheet, less
       its ids and comparison copies (and, for a participant share, its
       Leader only parts, answers and parts of unknown types), as
       deflate-raw JSON in base64url after `#share1.`, or the same data on
       the last line of a `.lit-sheet.md` file (`fragmentInFile` takes the
       last data line, ignores whitespace folded into it, and throws
       "damaged" for one it can't read). Opening one decompresses with a
       ceiling, rebuilds the record with fresh ids, drops the comparison
       copies again and refuses it unless `validateRecord` passes. **The
       fragment must never reach a server or the analytics beacon**: an
       inline script in `sheets.astro`'s body moves it into
       `history.state.litSharedSheet` while the page parses, and again on
       `popstate` and `hashchange` (then reloads), since a link opened in a
       tab already on /sheets/ changes only the fragment, and a fragment
       navigation fires `popstate` first (BA78). Checked against the
       real beacon on 2026-10-20: its `location` came without the fragment.
       The navigation timing entry's `name` still holds the original
       address, and the beacon didn't send it then; recheck if the beacon
       starts sending timing names. Keep `SHARE_PREFIX` and the inline
       script in step.
     - **Where the desk doesn't run**, `src/scripts/sheet-share-gate.js`
       (loaded by /sheets/ for everyone, small) says what to do with a
       shared link: on a phone or tablet, copy the link to send to a
       computer; on a computer without the preview, a link that switches it
       on (`?desk=on#share1.…`, a new page, so the fragment is taken again).
       A shared sheet shows read only until "Copy into my desk", which saves
       it as a new sheet (`copyOfShared`) and turns the page into that
       sheet's own address. No storage key is added.
  22. **Phase 2b is a sheet checked before printing** (built 2026-10-20;
     STUDY-DESK.md, S2, N9 and "Order of work", 2b). N9 is the bullet under
     rule 19. S2, in three things:
     - **`src/lib/desk-sheet-check.mjs` is the rules** (pure, tested):
       `passageCheck` compares a passage's `verseCopy` with today's verses
       through N3's `wordingChanged` (typography folded), judging a quoted
       passage on its own words only; `freshCopy` is what "Keep the new
       wording" writes; `textAsOfLine` is the copy's "Text as of" line from a
       content version. `readPassage` (`desk/sheet-lit.js`) carries the
       check as `check`, and the source's `contentVersion` (read off the
       fetched page's `<html>` by `chapter-page.js`).
     - **The Sheet pane writes one thing the reader didn't ask for**: a
       passage with no `verseCopy` (gathered on /search) takes one the first
       time the pane reads it, through `change(…, { quiet: true })`, which
       commits with `record: false` so Ctrl+Z never undoes it into a loop.
       Keep is an ordinary, undoable change.
     - **The sheet page only reports**: `drawCheck` above the paper
       (`.sheets-page__check`, hidden in print), and Keep is on /desk. Both
       notices draw the diff with `desk/diff-view.js`, shared with the
       change notice; change one and both move.
  23. **Phase 2c is notes on a footnote and questions for discussion**
     (built 2026-10-20; STUDY-DESK.md, M11, N6 and "Order of work", 2c).
     Three things to know:
     - **A note on a footnote is a `note` with a pin's fields**
       (`footnote`, `n` and the letter's verse; no `quote`, no
       `verseCopy`), told apart by `onFootnote` in `desk-records.mjs`. It is
       found and noticed by the pin's rules (`findPin`, `pinNotice`,
       `planKeep`), never by its verse's wording, so **any code that reads
       a note's verse must ask `onFootnote` first**: `isVerseMark`,
       `noteCounts`, This verse's verse list and the verse labels all leave
       such notes out, and `recordWhere` (`desk-store-core.mjs`) names it
       ("a footnote in Romans 8:3") where `recordReference` names the verse,
     and is what This verse's "Mentioned in your note on…" uses. Such a
     note citing its own verse is a chain like any other, so `notesCiting`
     (`desk-chains.mjs`) lists it rather than treating it as sitting on
     that verse (BA20).
     - **`desk/footnote-notes.js` is its page side**: "Add a note" beside
       every Pin (`addNoteButton`, which `pins.js` and the tabs and pane
       call) and the reader's notes under a footnote (`footnoteNotes`). Both
       sit beside `.fn-body`, never in it, so a footnote's text, the
       handout and `footnoteList()` read only the footnote. The margin
       places such a note beside its footnote's `li` (`note-sources.js`)
       and marks the `li` instead of lighting verse words.
     - **N6 writes ordinary sheet parts**: `src/lib/desk-sheet-discussion.mjs`
       (pure, tested) turns the notes marked `question` on a sheet's
       passages into a heading and `question` modules, once; nothing links
       them back to the notes. The Sheet pane's "+ For discussion" adds them
       in one change.
