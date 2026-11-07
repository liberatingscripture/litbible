# The Study Desk preview

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory. It governs the desk's code wherever it lives, including `src/lib/desk-*.mjs`, the /desk, /notebook and /sheets pages, `desk.css` and `public/greek/`; read it before touching any of them.
> Cross-references such as "below" or "rule 15" were written when all of
> this was one file, so they may point into another area file; the root's
> index says which file holds each section.

**`STUDY-DESK.md` (about 500 KB), `STUDY-DESK-FIXES.md` and the
`STUDY-DESK-AUDIT-*.md` files are too large to read whole.** Grep them for the ID or
heading you need (BA42, 3j, N9, SEC-1) and read that section.

## The records

| Path | Purpose |
|------|---------|
| `STUDY-DESK.md` | **The planning and decision record for the Study Desk** (notes, places, highlights and sheets on desktop, with optional account sync shared with the apps). Phases 1a to 1d, 1f and 1h are built (the merge engine; notes, bookmarks, highlights, pinned footnotes, the margin and the panel's tabs; the notebook page, export and import, labels, ribbons, search and commands, first use and the tour; the Greek tab; searching the Greek), and so is phase 2a (2026-10-15: B3, N4, and construction search and searching by parsing as Greek search commands; M10 was built and shelved; N2, H2 and M4 are shelved for version 2, 2026-10-15), phase 3's sheets and /desk (3b to 3k, 2026-10-18 to 10-20; 3m, the search pane, 2026-11-01), phase 2b (2026-10-20: S2, a sheet checked before printing, and N9, print with room to write), and phase 2c (2026-10-20: M11, notes on a footnote, and N6's questions gathered onto a sheet), the shell behind a preview switch (`?desk=on`); nothing reader-facing is released. N8 (the hidden passage) is held on branches until after the Zoom; it is not released before phase 1 is completely done, and perhaps not until phases 1 to 3 are (BVJ, 2026-10-13). 1g (an interleaf for the Greek) and 1h (searching the Greek) belong to phase 1: 1g is shelved for the future, and 1h was built on 2026-10-13. Every idea, audit finding, owner decision, open question and BDR item is there with its ID, as are the two apps' replies (2026-10-04) and the talk-through list built from them. Read it before proposing or building any part of the desk, and update it when a decision changes. `STUDY-DESK-BRIEF-FOR-BDR.md` is the brief written for BDR's Claude about the apps' side; `STUDY-DESK-REPLY-TO-APPS.md` is the website's answer to both apps' replies (2026-10-05), and the last such document: since 2026-10-07 BDR's Claude reads this repo directly, so the website answers by updating `STUDY-DESK.md` on `main` (its section "One notebook, three homes" holds BDR's sync proposal and the website's answers). |
| `STUDY-DESK-FIXES.md` | **The Phase 5 log: the desk's bugs, rough spots, wording and wishes** (IDs **E1** onward), kept by BVJ's use of the preview, with the rules for adding an entry and the work-session grouping. It was a section of `STUDY-DESK.md` until 2026-11-05 and moved whole, so every "E9" or "E28" in this repo means an entry there. **A new bug or preference BVJ reports goes here as the next E number**, never into `STUDY-DESK.md`; where an entry settles a decision, say so in the entry. |
| `STUDY-DESK-FORMAT.md` | **Draft record format for the Study Desk**, shared with both apps: the kinds of record, the anchor text, and how a mark is found again after the wording moves. Its executable form is `scripts/lib/anchor-text.mjs` (pure half in `src/lib/anchor-core.mjs`) with `test/fixtures/anchor-vectors.json`; its merge rules are `src/lib/desk-merge.mjs` with `test/fixtures/merge-vectors.json`, hand-written cases the apps run too. Change each pair together. |
| `STUDY-DESK-AUDIT-1.md` | **Full Audit 1 of the built Study Desk** (2026-10-20, commit `82af6a6`): findings BA1 to BA87, each with what happens, where and the fix, and the plan to fix them in phases FA1-a to FA1-t, each one session's work, plus the follow-up audit (FA1-u for the code it didn't reach, FA1-v on real devices), whose findings continue as BA88 onward (to BA153) and were planned in phases FA1-w onward (done through FA1-ae). Read its "How to work a phase on a Pro account" before starting one, and mark each finding's status there as it ships. STUDY-DESK.md keeps the decisions. |
| `STUDY-DESK-AUDIT-2.md` | **Audit 2 of the Study Desk** (2026-11-03, commit `a57e155d`): 111 findings from eight read-only auditors, with IDs `SEC`, `DI`, `NB`, `DK`, `GK`, `LG`, `LV` and `CP` (not renumbered into the BA series). The top matter holds the priority list, the decisions awaiting the owner and a "Status on main" table (the re-check of 2026-11-03: 96 still valid, 2 fixed, 2 moot, 10 changed) and the work sessions, tasks FA2-a to FA2-z in 11 sessions; each auditor's full report is an appendix (A to H), and Appendix I is the brief they were given, so the audit can be repeated. Mark a finding fixed in its appendix entry as it ships, as Audit 1 does. |
| `STUDY-DESK-AUDIT-3.md` | **Audit 3 of the Study Desk** (2026-11-06, commit `60af379e`): 81 findings from eight auditors (IDs `SEC3`, `DI3`, `NB3`, `DK3`, `GK3`, `LG3`, `LV3`, `CP3`), 80 after an Opus agent tried to disprove the highest (none Critical; none High after verification). The top matter holds the priority list in three tiers, the decisions awaiting the owner, and six proposed work sessions; each report is an appendix (A to J), and Appendix K is the brief, so the audit can be repeated. Mark a finding fixed in its appendix entry as it ships. |

**Each future full audit of the Study Desk is its own file**, `STUDY-DESK-AUDIT-3.md`
and on, as the first two are (BVJ, 2026-11-05): findings with their own IDs and
statuses, never added to `STUDY-DESK.md` or `STUDY-DESK-FIXES.md`. A fix
BVJ asks for from an audit is marked in the audit file; a bug or preference BVJ
raises in daily use goes in `STUDY-DESK-FIXES.md`. Give the new file a row in the
table above and a mention in the root `CLAUDE.md`'s Important Files row.

## Routes

From the root's routing table.

| Route | File | Purpose |
|-------|------|---------|
| `/notebook`, `/notebook/help` | `notebook.astro`, `notebook/help.astro` | The Study Desk preview's notebook page and help page. noindex, out of the sitemap and Pagefind; empty for anyone without the preview (`?desk=on`). See "The Study Desk preview" |
| `/desk` | `desk.astro` | The Study Desk as a page of its own (D9): one to four panes. Same treatment as `/notebook`: noindex, out of the sitemap and Pagefind, and a short note without the preview. See "The Study Desk preview", rule 18 |
| `/sheets` | `sheets.astro` | A sheet's own address (3i): `/sheets/` lists the reader's sheets, `/sheets/?id=<id>` shows one as a leader’s or participant’s version, to print or copy, or presents it to a room (3j; `&view=present`, and `&view=presenter` for the presenter view's window). `/sheets/#share1.<data>` is a sheet someone shared (3k). Never edits. Same treatment as `/desk`. See "The Study Desk preview", rules 19 and 21 |

## Launching

(Audit 2, LG-3 and LG-4; BVJ, 2026-11-04.) The pre-paint script stamps the
preview in one place, but about a dozen others read it. Flipping the default
means each of these, in one change:

1. `src/layouts/Layout.astro` pre-paint script: stop requiring
   `lit-desk-preview==='on'` (keep the `isAppPlatform` and touch exclusions;
   `test/desk-prepaint.test.js` runs the same devices) and rewrite the comment
   block above it. **There is no opt-out of the desk itself at launch** (BVJ, 2026-11-04: it
   isn't removable; a reader who doesn't use it loses only a tab in the
   corner), so `?desk=on` and `?desk=off` and the stored `lit-desk-preview`
   retire with the flip, and the `/privacy` paragraph drops the key. **The
   compromise (BVJ, 2026-11-04) is "Show the Notebook" in the Display tray**
   on pages that have the panel (`lit-desk-show` = "off"; absent = shown): off
   closes the panel and hides its tab and the Read View Notebook button, and
   writes none of the reader's panel keys, so turning it on restores the
   Notebook as they left it (`startState` returns closed first; Layout.astro's
   pre-paint script repeats that and stamps `data-desk-show="off"`; the panel
   follows `desk:settings`). It hides the panel only: the header's Study Desk
   link, /desk, and an explicit "Show in Notebook" still work.
2. `search-core.js`: `deskEnabled()` (the one read of the stamp for search),
   `greekSearchEnabled()`, `loadDeskSearch`, `loadDeskSheets`. Their callers
   gate on them too: `search.js` (every `greekSearchEnabled()`, and the
   Notebook and Greek groups at 324 to 386), `searchbar.js:644` (the "Notebook
   actions" button), `SearchBar.astro:147`, `search.astro:67,99`.
3. Direct readers of the stamp: `desk-gate.js` (five reads, at 12, 15, 49, 56
   and 62), `desk-frame.js:95` (`DESK_ATTRS`, what `standDown` removes),
   `keyboard-shortcuts.js` (`h`), `sheet-share-gate.js` (delete its "turn the
   desk on" link and the computer branch), `ScriptureLayout.astro`,
   `read/[book].astro`, `SiteHeader.astro`, and `ReadMenu.astro` (`dataset.desk`
   at 240, and the `html:not([data-desk])` rule at 551 that hides the E50 pill
   in `ReadLayout.astro:40-51` when the preview is off).
4. CSS written for "the preview is on": `global.css` (the hide rule, the 52/48
   measure and widths), `glossary.css` ("Readers keep the wide glossary until
   the desk is released"), `read-mode.css`, and the Read View card and pill
   swaps: `pages/read.css:329-346` with the two cards in `read.astro:133`, and
   `ScriptureLayout.astro:424-435`.
5. The pages' preview copy and loading/off pairs: `desk.astro`, `notebook.astro`,
   `sheets.astro`, `notebook/help.astro`, and the matching rules in
   `desk-page.css`, `notebook.css`, `sheets-page.css`. The "off" note must still
   say something true for no-JS and phones.
6. `/privacy`'s notebook paragraph ("Readers who switch on the notebook, a
   preview…") and whether to bump its effective date.
7. Indexing: `/notebook` and `/sheets` stay noindex; `/desk` and the help page
   are a decision (`robotsNoindex`, the sitemap filter in `astro.config.mjs`).
8. `PROSE_NOTES` in `desk/note-sources.js` stays false for version 1.
9. Browser floor (BVJ, 2026-11-04): highlights need the CSS Custom Highlight
   API (Chrome 105, Safari 17.2, Firefox 140). Below that the desk offers no
   Highlight and its switch says so (`highlightsSupported`). Mac Safari and
   Firefox passes are still open from Audit 1's FA1-v. `CompressionStream`
   (Safari 16.4) is inside that floor, so Save as and Share a sheet need no
   fallback.
10. Release notes (automated), `llms.txt`, README and the CLAUDE.md "preview"
    wording.
11. **Read View's retirement (8c)** ships in the same change as the flip
    (BVJ, 2026-11-07). Wire `src/lib/read-view-retirement.mjs` and
    `src/scripts/read-view-redirect.js` in: the redirects in
    `astro.config.mjs`, the `/read/[book].astro` rewrite, the sitemap filter,
    and the `lit_last_read` records Read View writes. Read View itself goes,
    as "The rules" says. Delete `test/read-view-retirement.test.js`'s guard,
    "nothing in the site imports the retirement rules before the launch
    cutover" (line 92), and rewrite its two neighbours, "with the preview on,
    /read swaps the Read View card" (line 111) and "with the preview on, the
    chapter picker's footer link opens the Study Desk" (line 125), to what
    launch shows.

After the change, re-run `grep -rnE "lit-desk-preview|data-desk|dataset.desk|deskEnabled|desk=on|desk=off" src test scripts astro.config.mjs`.
`lit-desk-preview`, `desk=on` and `desk=off` should be gone everywhere. The
stamp itself stays (item 1 still sets it, minus the preview, for the
devices that get the desk), so expect `data-desk` and `deskEnabled` hits
outside `src/scripts/desk/` only in its writer (`Layout.astro`), the gate
(`desk-gate.js`, `desk-frame.js`, `search-core.js`'s `deskEnabled()`) and
their tests, plus the `data-desk-*` attributes; any other hit is a reader
this list missed.

**The sheet editor runs on `document.execCommand`** (12 calls through
`sheet-text.js`'s `exec`; obsolete in the standards but shipped by every
engine). Decision for version 1: accept it. Output is re-sanitized to a
canonical form (`sheetHtmlForShow`) so engine differences don't reach the
record. A replacement behind the `createSheetText` interface is a version 2
item; add a cross-browser golden-file test of the eight commands before it.

**Tests**: `test/desk-store.test.js` runs the real `store.js` against
`fake-indexeddb`; `test/desk-storage-keys.test.js` holds `/privacy` to every
storage key. Playwright is not a launch gate (BVJ, 2026-11-04); a smoke test
against `dist/` is a later item.

## The rules

- **The Study Desk preview** (STUDY-DESK.md, phases 1a to 1d, 1f and 1h,
  2a to 2c, and phase 3's 3b to 3k and 3m) is in production but
  switched off for everyone: `?desk=on` turns it on in one browser on a
  computer, `?desk=off` turns it off. STUDY-DESK.md is the record; what a
  change elsewhere in the site has to respect:
  1. **Layout.astro's pre-paint script decides it**, beside the theme and
     font ones: `lit-desk-preview` plus `isAppPlatform` sets
     `<html data-desk="on">`. The script repeats
     `src/lib/app-platform.mjs`'s test, since it
     can't import; `test/desk-prepaint.test.js` runs it against the same
     devices, so change the two together. A tablet whose browser passes for
     a computer's (iPadOS reports a Mac; Chrome and Firefox on an Android
     tablet in desktop site mode report Linux) is told by its touch screen,
     and a Chromebook stays a computer (BA26).
     **If the desk doesn't come up, the page stands down** (BA29): where the
     shell fails to load (offline, an old page after a deploy) or fails
     before the Notebook is built, `standDown()` (`desk-frame.js`, called by
     the gate and the shell) takes the pre-paint stamps off, so the column
     and the hidden Notebook buttons are the reader's again. A failure after
     the Notebook is up is only logged. `createPanel` builds each tab on its
     own, so one that throws shows a line saying so and the rest work.
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
     (`src/scripts/desk-frame.js`) lists**: Chapter View chapters and intros,
     Read View, articles and the glossary, each with its column, its heading
     (or, on an article, `start`: the card, whose top edge the panel's top
     edge matches) and its `end`: the seam where the page meets the footer's colour, which
     on the scripture pages is the top of the license band (SblgntNotice),
     since a band right above the footer counts as footer.
     Everywhere else there is no panel, no Notebook button (a `:has()` rule in
     global.css, held to the list by `test/desk-frame.test.js`), and the
     desk's code isn't loaded. **A new reading surface needs an entry in
     both.**
     Floating panels keep to `panelRoom()` (`src/scripts/desk-frame.js`):
     the window's width less `dockWidth()`, or the whole window where that
     leaves under 300px, so beside a floating notebook dragged wide a panel
     lies over it rather than shrinking to a sliver (BA27). A shared panel
     already open when the notebook grows under it is moved left, never
     closed, since it may be a note editor (`keepClearOfDock`, called from
     `margin.js`'s `place()`; BA28). Anything marked `[data-desk-dock]`
     counts as inside it (no outside-click close, shortcuts stand down).
     The notebook's own Escape stands down only for the shared panel's slot
     (`currentPanel()`), not for a floating window (`float-window.js`),
     which wears the panels' class but takes Escape only from inside itself
     (BA24). In a search field holding words it only clears the field (the
     next press folds), and a list filtered by such a field listens to
     `search` and `change` as well as `input`, since the browser's own clear
     sends no `input` (LV3-1, NB3-6).
  4. **While the preview is on, the reading measure is 52**, the width BVJ
     picked for the desk's release, **and 48 on Chapter View chapters while the
     notebook is expanded** (BVJ, 2026-10-08; 2026-10-14), to leave the panel room for the
     Greek tab without moving the column. Read View, intros,
     articles and the glossary stay at 52, since none gets that tab. The switch is
     `html[data-desk-expanded]`, which Layout.astro's pre-paint script stamps
     so a page opening with the notebook expanded never reflows, and which
     margin.js sets and clears inside `keepReadingPlace`. **It stamps it, and
     the dragged widths below, only where the window holds them** (BA25,
     BA30): the script repeats `firstPaint` (`desk-margin.mjs`), which works
     out the column's width from the reader's font and text size
     (`FIRST_PAINT`, held to global.css and ScriptureLayout.astro by
     `test/desk-margin.test.js`) and the window less its scrollbar, which the
     script measures, since the page's reserved gutter isn't there yet. Too
     narrow, the notebook floats and folds, and a stamp would have reflowed
     every chapter from 48 to 52; widths kept in a wider window are given way
     as `placeWithWidths` gives them, or left off. A change to the column's
     CSS, or to the placement rules, needs `firstPaint` to follow.
     Read View's toolbar takes a fixed
     floor (725px; 895px in OpenDyslexic) because it outgrows the column.
     **On Chapter View the reader can drag the widths** of their notes'
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
     in dev before a build). The same file's `updatedAt` goes on
     `<html data-content-updated>`: the version's day is the build's UTC
     day, so a sheet's "Text as of" line names the build time's day in the
     reader's time zone instead (`textDay`, `desk-sheet-check.mjs`).
     Records never read it.
     **Every record read comes through `migrateRecord`** (`desk-records.mjs`):
     the store's reads (`current` in `desk/store.js`, the history's "before"
     included), `desk/readonly-notebook.js`, an import (`planImport`) and the
     merge. It renames an old note marker in memory (`bookmark` reads as
     `ribbon`, STUDY-DESK-FIXES.md E10; `RENAMED_MARKERS`) and reads an old ribbon (a
     `place` with `ribbon: true`) as a bookmark that follows (E9), and never
     writes back for a read, so the next write of the record carries the new
     name or kind. A new
     way of reading records needs it too, or an old note shows its old name
     and a write over it compares unlike records.
  6. **Phase 1c's notes reach the reader code through one event.**
     `chapter-tools.js` dispatches `lit:panel-actions` from the verse menu
     and the selection panel before placing them, with the panel, its verses
     and (for a selection) the selected `range`. Only
     `src/scripts/desk/actions.js` listens, adding "My Notebook" (Add a note,
     Bookmark and "Show in Notebook"; Bookmark only in Read View), so a
     reader's menus are unchanged. The Notebook's "This verse" tab
     (`desk/tab-verse.js`) listens too: a verse menu opened while the
     notebook is open moves the tab to that verse. Keep the event before `showPanel`, or the panel is measured
     without the row. A panel opened with `extra: { stay: true }` (the note
     editor) ignores outside clicks in `lit-panel.js`, and while its
     `changed()` is true `closePanel`/`showPanel` and a verse number or footnote
     letter (`holdPanel`) say so once instead of closing it; the next ask, with
     nothing typed between, discards (NB-2). The editor also keeps a
     `sessionStorage['lit-desk-note-draft']` and asks the browser before leaving.
     Save and delete close with `{ force: true }`.
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
     everywhere. Bookmarks show in the same `<aside>` as a red mark (gold if they stay put; see "Bookmarks, and Continue reading"), a trial
     STUDY-DESK.md records, with their own switch (`data-desk-bookmarks`).
     **Bookmarks are the one piece of marginalia Read View shows**
     (`desk/read-marks.js`; BVJ, 2026-10-08): notes stay a Chapter View tool. The notes' settings (`data-desk-notes`,
     `data-desk-note-font`, `data-desk-list` on `<html>`) have no pre-paint
     script, since nothing of the desk paints before it loads. "Hide my
     marks" (M1, key H; "Hide my notes" until 2026-10-29) is no setting of its own: it saves and turns off
     "Notes in the margin", "My bookmarks" and both views' "My highlights", and puts
     them back (`note-settings.js`). With "Notes in the margin" off, a footnote's
     popover lists none of the reader's notes either (`desk.css`, BA17),
     while the Notebook's tabs and /desk's panes still do. Going to a note
     from the panel marks its words even then, and puts focus on the verse
     number they start in, since the margin holds no note to focus (BA19).
     **A verse holds one bookmark**: Bookmark and Remove bookmark plan
     over the notebook in the write's own transaction (`planBookmark`,
     `planUnbookmark` in `desk-store-core.mjs`), so a second press adds
     nothing and removing takes every bookmark a copy may have brought
     (BA16).
     While the desk is on, each Chapter View verse number's accessible name
     names the reader's bookmark and highlights and counts their notes on it
     ("Verse 18, bookmarked, highlighted yellow, 1 note of mine";
     `desk/verse-labels.js`, each kind only while its switch is on), the one
     place a screen reader meets them in reading order, since an attribute
     adds nothing to the scripture.
     **Making a mark is announced** (BA18; `src/lib/desk-announce.mjs`):
     a note saved, a bookmark added and a highlight that touches no other
     color speak through `announce` in `undo-bar.js`, as deleting and undoing
     speak through its notices. A new way of making a mark needs its sentence
     there. **Focus never drops to the page after a margin redraw** (BA21):
     `notes-margin.js` replaces every control on each draw, so it re-points an
     open circle popover at the new circle (`keepPopover`) and, when focus was
     on a control the drawing lacks, moves it to the verse number the note sat
     on, else the next note (`focusGone`); and the note editor, which the
     margin's hidden Edit button can't take focus back, lands it on the verse
     number itself (`landFocus`).
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
     the only desk switch the tray gets and is Chapter View's setting.
  8. **Notes on a glossary entry or an article** (N11) are **out of
     version 1** (BVJ, 2026-10-29; maybe version 2), and **switched off,
     not removed**: `PROSE_NOTES` in `desk/note-sources.js` is `false`, so
     `prosePage()` returns null everywhere, and with it go the margin on
     those pages (`proseSource`), the "My Notebook" row and "Add a note on
     this article" (`desk/prose-actions.js`, `panel.js`), the tray's Show
     group there (`note-settings.js`) and their change notices. The tour's
     first three steps leave out the "prose" view (`desk-first-use.mjs`).
     On /glossary and an article the Notebook panel stays, and My Notes
     lists everything, as on any page that isn't a chapter or Read View.
     **The records are kept whole**: `proseTarget`, the export, the merge
     and the format's principle 6 still carry a reader's existing notes,
     My Notes and /notebook list them, and the editor still opens them.
     Version 2 turns the switch back on, restores the three steps' "prose"
     view (their wording is still there) and the test of it in
     `desk-first-use.test.js`. Built, it worked so: the same margin as
     Chapter View, `note-sources.js` saying what a page's notes sit beside
     and how each is found (a chapter's verses, or an entry's or article's
     own text through `src/lib/desk-prose-anchor.mjs`), and
     `prose-actions.js` offering "Add a note" on a selection there (on the
     glossary, as the "My Notebook" row of every reader's selection panel,
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
     and "Greek" (`desk/tab-greek.js`, rule 14) on Chapter View chapters, and
     Greek on draft chapters too (BVJ, 2026-10-13; `greekChapter()` in
     `desk/page.js`, which reads `data-draft-book`/`data-draft-chapter`, never
     the last-read attributes), from the `TABS` table in `desk/panel.js`. **This verse and Greek load on first draw** (`lazyTab` in `panel.js`, LG-10): a new tab on a heavy module goes the same way, and a call made to it before it arrives (a verse, a word) is held, not lost. (A Versions tab, and API.bible with it, is
     deferred indefinitely: not in version 1, BVJ 2026-10-11.) **Settings is the last tab, on every page**
     (BVJ, 2026-10-29): the switches, print buttons, "Open the notebook page",
     the tour and help links and where the notebook is kept, which were My
     Notes' foot. **The Notebook has no Close** (BVJ, 2026-10-29): no ×, no
     "Close the Notebook" command, Escape and the Read View toolbar's Notebook
     button minimize it. (`close()` stays for the tour's restore and a reader's saved "Closed"
     start; "Hide my marks" and H fold it to its tab and un-hiding opens it
     again, NB-1; BVJ, 2026-11-03.) **Where the Study Desk button is** (BVJ, 2026-10-30,
     changed 2026-11-06, E50): a link to /desk, never a toggle (the panel
     wires `button[data-desk-toggle]` only). **The home page keeps the
     header's** "Study Desk" link (`SiteHeader`'s `deskLink`, which `Layout`
     sets for `/` alone; still `data-desk-toggle`, so global.css shows it with
     the desk on). **Scripture pages, chapters and book introductions, put a
     pill in the toolbar's right slot**, the old "Switch to Read View" pill's
     design and classes (`ScriptureLayout.astro`, `.reading-view-right--desk`
     beside the Read View wrapper, which stays hidden while the preview is on):
     "Open in the Study Desk," "Study Desk" where that pill shortened, an icon
     alone on the phone-width compact toolbar. Its `?place=` is the chapter
     being read (`romans-8`), and on an introduction chapter 1 with
     `&intro=romans`, which opens a Book Intro pane beside it (E53), written
     out in the layout because shared reader code never imports
     `desk-passage.mjs`. **/read has a "Study Desk"
     pill matching "Go to passage"** (`.read-menu__desk`, passed into
     `ReadMenu`'s slot by `ReadLayout`, the two centered on one row), linking
     to plain `/desk/`. Both pills are in the markup for everyone and shown
     only under `html[data-desk]` by their own rules. **No other page has a
     Study Desk button in the header**: articles, the glossary, Read View,
     /notebook and /sheets reach the desk by other routes (the Notebook panel's
     lamp link, /sheets' "Edit on the Study Desk", /notebook's "Open the
     Study Desk" under its title, `notebook-page.js`). The desk's own header hides it, being there already. The Chapter View "Switch to Read View"
     pill is hidden while the preview is on.
     **Its names** (BVJ, 2026-10-26; BA138, BA139): the panel is "the
     Notebook," capitalized wherever a control or a sentence names the panel
     ("Minimize the Notebook," "Show in Notebook"); lowercase "notebook" means
     what the reader has kept ("Save a copy of my notebook," "Search my
     notebook") or the feature as a whole. "My Notes" is the tab and the
     /desk pane kind only; the margin's switch and its region are "Notes in
     the margin," and This verse's subhead stays "My notes," naming the
     reader's notes on that verse.
     **Words used here** (Audit 2, CP-11): "Study Desk" is the feature (never
     "the notebook preview"); "Delete" is for what the reader typed or named
     (notes, labels, sheets) and "Remove" for marks on the text (bookmarks,
     highlights), both from `takeOff(kind)` in `desk-store-core.mjs`; in a
     button "copy" means a saved file, so a sheet's leader and participant
     copies are "versions"; "Dictionary forms" for lemmas. "Marker" is
     only a note's icon ("Marker: Question," "the Question marker"); a
     trashed item's leftover is "a record that it was deleted," never a
     marker or a note. "Marks" is the umbrella for notes, highlights, and
     bookmarks, defined on the "Hide my marks" switch (its title and
     `aria-description`) and in the help page's paragraph of that name, so a
     bookmark "shows in red," not "is a red mark."
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
     **A listener may ask for only the kinds it draws** (BA107):
     `store.subscribe(fn, { kinds })` or `{ except }`, so a bookmark that moves
     as the reader reads (written every few seconds with `{ kinds: [MOVE_KIND] }`,
     which tells listeners `bookmarkMove` instead of `bookmark`) redraws nothing
     that listens with `{ except: QUIET_KINDS }` (`place` and `bookmarkMove`). A notice carries the kinds it touched, including what
     a record was before and a trash record's held kind (`changeKinds`,
     `hearsChange`, `listenerSet` in `desk-store-core.mjs`), and the
     BroadcastChannel message carries them too; one without them (an older tab)
     is heard by all. A view that draws where a bookmark is, or anything not yet checked,
     subscribes with no filter. **A view of marks leaves out sheets**
     (`{ except: NO_CHAPTER_KINDS }`, DK-5): a sheet's autosave fires every
     few hundred milliseconds while typing and would re-read every chapter a
     LIT pane holds.
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
     `description`, and one naming no verse as the whole chapter, BA98),
     fetched only when a notice opens. A highlight carrying
     a notice is never merged or trimmed (`placeHighlights`).
  13. **Phase 1d is the notebook around the marks** (built 2026-10-12).
     - **The notebook page**, `/notebook/` (`pages/notebook.astro`), and its
       help, `/notebook/help/`: noindex, out of the sitemap (one `notebook/`
       prefix rule in `astro.config.mjs`) and out of Pagefind (Layout's
       default). `desk-gate.js` loads `desk/notebook-page.js` when
       `[data-notebook-page]` is present; the page isn't a reading surface,
       so it has no panel, and without the preview it shows only a short
       note. **/notebook/, /desk/ and /sheets/ hide that note under
       `html[data-desk="on"]`** and show “Loading the Study Desk…” until
       the desk's code replaces both (BA153); if that code fails to load,
       the gate's `standDown()` takes the stamp off and the note is back.
       /notebook/ prints as the list of what is kept (BVJ, 2026-10-29;
       BA152): `notebook.css` hides its controls and every section but What
       I've kept and Continue reading. Shared pieces: `desk/boot.js` (the stylesheet and context the
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
     - **The trash can be restored from** (E12; BVJ, 2026-11-02): a Trash section
       on the notebook page (`desk/trash-list.js`; `trashItems`, `daysLeft`,
       `planRestore` and `planRestoreAll` in `desk-notebook.mjs`), each row the
       ordinary `recordRow` with `trash:` set (when it was deleted, days left,
       Restore only). **A restore is an ordinary, undoable change** (`store.change`
       over the record and its trash record, so the history remembers it): it
       writes what `restoreFromTrash` says and adds no field or kind, so the
       format and `merge-vectors.json` are untouched. It is **refused, and left
       in the trash**, for a bookmark onto a verse that already has one of its
       kind (BA16; a verse takes one that stays put and one that moves, so
       the other kind comes back) and a label whose name is kept; a bookmark that moved comes back plain when
       six already move. A dead label id on a restored note is left (not drawn).
       **`makeEntry` allots no `undoTrash` for a record the change took out of the
       trash**, or undoing a restore would leave two trash records for one
       deletion. "Empty the trash now" stays under Delete everything and isn't
       undoable.
     - **Labels** (`desk-labels.mjs`): the reader-facing name for M8's tags,
       applied from the notebook page, names unique ignoring case and
       accents.
     - **Bookmarks, and Continue reading** (`desk-bookmarks.mjs`,
       `desk-bookmark-change.mjs`, `desk/bookmark-follow.js`,
       `desk/bookmark-form.js`, `desk/continue-reading.js`; STUDY-DESK-FIXES.md E9).
       **There is one feature, Bookmarks, and no Places** (BVJ, 2026-10-22; the
       word "ribbon" is for the note marker alone, E10). A `bookmark` record is
       a verse, an optional `label` (its name, up to 40 characters, not
       unique) and an optional `follow: true` ("Move as I read"). **A bookmark
       stays on its verse unless that switch is on** (BVJ, 2026-11-02). The old
       ribbon, a `place` with `ribbon: true`, is read as a bookmark that
       follows by `migrateRecord` (same id, `name` to `label`), so nothing else
       knows the old shape; the website never writes a `place`. A bookmark is a
       row in the ordinary My Notes list and the notebook page's: its reference,
       its name right under it, then a line "Bookmark · Stays put" / "Moves" /
       "Following" (`bookmarkState`, bookmark-follow.js: following is this tab's
       flag; one short word each so the line never wraps in the narrow list,
       with the fuller sentence as hover text; the words are an Opus agent's,
       who advised against "Smart" and "Static", BVJ 2026-11-04), and **Edit** (`bookmark-form.js`:
       the verse, the name and the switch). **The form moves a bookmark to
       another verse** (E46, 2026-11-05): a Verse field read as the Go to
       passage field reads one (`parseReference`, then `bookmarkPlace`: a range
       keeps its first verse, a chapter alone is verse 1, a verse past the
       chapter's last is refused), sent only when the reader changed it, so a
       move the follower made meanwhile is kept. It is the same one
       `store.change` (`planBookmarkEdit`), an ordinary undoable edit, refused
       with "John 3:5 already has a bookmark that stays put" when the verse
       holds one of its kind (`roomAt`, `kindTakenAt`; the switch locks for the
       typed verse as for its own), and it writes `verse`, `endVerse` and
       `contentVersion` as a new bookmark gets them; other fields (`from`
       included) are kept. Moving the bookmark this tab follows moves where it
       rests (`restedAt`), and the next report is judged from there. **"Start
       following now?"** (E47) shows under the switch while it is checked, and
       only when this tab could start it (not while it follows this one, not
       where the page doesn't follow the reader, not with six others moving);
       otherwise a line says which. Checked at Save, the bookmark is saved and
       then followed (`followBookmark`), even when nothing else changed, so a
       new bookmark from the verse menu starts following with its first Save.
       The switch's hint (E48) no longer explains how a follow starts: "Moves
       along with you as you read its book, once it’s following you. Without
       this, it stays on its verse. Up to six of your bookmarks can move." The verse menu lists "Edit bookmark…" right after
       "Remove bookmark" once the verse has one, and **pressing "Bookmark" opens
       that form at once** (BVJ, 2026-11-04; closing it leaves a plain bookmark).
       **A moving bookmark's margin mark jumps rather than glides**: its writes
       are quiet (QUIET_KINDS), and the margin and Read View's marks (and on
       /desk the My Notes and This verse rows and the verse numbers' names,
       E28) redraw once
       2.5 seconds after the last move (`redrawAfterMove`, move-redraw.js), so it
       catches up when the reading pauses; the follower writes at most every 2
       seconds (`MOVE_EVERY_MS`), and the settle must stay longer than that gap
       or steady scrolling redraws between writes. They were 4 and 5 seconds until E45
       (2026-11-05); a move is a record write that syncs, so tell BDR if the
       write gap changes. "Add bookmark" in the verse menu and the
       selection panel stays one press. **At most six bookmarks move at once** (plain ones are not
       counted); the limit and the write are one `store.change`
       (`planBookmarkEdit`, BA102), so a bookmark deleted meanwhile is reported,
       not brought back. **"Continue reading" is the one place that isn't a
       bookmark**: `lit_last_read` (last-read.js), never a record, shown with no
       bookmark mark by `continue-reading.js` above My Notes' list and first on
       the notebook page. Read View's per-book places and other clients' places
       aren't listed. `last-read.js` dispatches `lit:last-read` on every save
       (nothing hears it unless the desk is on). **The C25 rule**: following a
       moving bookmark's link (from either list) sets
       `sessionStorage['lit-desk-follow']`, and while the reader stays in that
       book in that tab the bookmark follows them (written without an undo
       entry, as `bookmarkMove`); a page outside the book clears it, the shell's
       `initBookmarkFollow` in a book and `desk-gate.js` on every page without
       the shell but /desk (BA101, E28). **A bookmark moves only to where this page says the
       reader is**: `pageLastRead()` and the `lit:last-read` event, never
       `lit_last_read` in storage, which every tab shares and an earlier page
       left (BA99, BA100). Following a link forgets where the reader was, and a
       link to another page stops the page it leaves from moving the bookmark.
       **Following a bookmark that stays put stops the moving one** (BVJ,
       2026-11-04: it kept following and would have moved to the new place):
       a plain click on any bookmark's link in either list either takes over
       (`followBookmark`) or clears the flag (`stopFollowing`), and every row's
       line redraws (`syncBookmarkLines`).
       **A follow pauses rather than ends** (BVJ, 2026-11-04, after an Opus
       design pass). The flag is `{ id, bookKey, tab, paused?, since?, told? }`.
       Each report of where the reader is goes through `followStep`
       (desk-bookmarks.mjs): within a chapter of where the bookmark sits (or of
       the last place this page heard, for Read View's long scroll) it moves; a
       far chapter, or another book (Matthew 28 to Mark 1 included), pauses it
       where it was, and the reader is told once, in the undo bar, with "Move it
       here" (`showPausedBar`; the move is an ordinary undoable edit and may cross
       books); reading on from the bookmark resumes it. **The "last place this page heard"
       that `followStep` allows for Read View's long scroll is the last report
       the follower accepted**, set when a report is judged and never as it
       arrives: a page that lands on a far verse (a link to `/luke-1/#v1`)
       reports twice before the first judgment, and the second would count the
       first as reading and move the bookmark instead of pausing it (found
       2026-11-04 testing "Move it here"). Pages outside the book
       (/search, /notebook) pause it too (`desk-gate.js`), and a pause
       ends after 12 hours (`PAUSE_EXPIRES_MS`; a restored tab keeps its session
       storage). Rows say Following, Paused, Moves or Stays put.
       **A following or paused bookmark rests at its verse and does not belong
       to it** (`restingId`): the verse menu leaves it out of Remove and offers
       "Leave it here" and Edit, and a verse holds **one bookmark that stays put
       and one that moves** (`followChoices`, `planBookmark`; Edit and the form
       lock "Move as I read" at the kind the verse lacks). Its mark is the red
       outline; a bookmark that moves and isn't followed is solid red, and one
       that stays put is gold (`bookmark-mark.js`). **The rows carry the same
       colors** (E28; BVJ, 2026-11-06): `drawBookmarkLine` starts each
       bookmark's state line with the glyph in its look (`bookmarkLook`, which
       `markLook` reads too), in My Notes, This verse and the notebook page.
       A follow that ends on a verse
       already holding a bookmark of its kind is tolerated.
       **On /desk the leading LIT pane is the reader** (E28; BVJ, 2026-11-06):
       `desk-page.js` runs the follower with `page: DESK_PAGE` and `place`, and
       after every `commit` reports the leading pane's place (`hear`) or, when
       another pane has become the leading one, `lead`, which pauses the follow
       (`followStep`'s `newLead`). Other LIT panes never move it; the opening
       place, a restore and the tour report nothing, and `lit:last-read` isn't
       heard there. "Move it here" takes the leading pane's place at the press.
       The pause bar is the ordinary undo bar, outside the panes.
       **The verse menu and the selection panel group a verse's bookmarks in a
       "Bookmark ▸" flyout** once it holds any (BVJ, 2026-11-04): Remove and Edit
       (`Remove bookmark “Advent”`, the name cut at 14 characters, the full name the
       accessible name), Add a bookmark that moves or stays put, and for the resting
       one "Leave it here". A verse with none keeps the one-press "Bookmark", and a
       finger's chips stay flat. **The flyout is shared code since E39** (BVJ,
       2026-11-06): `flyoutRow` in `src/scripts/panel-flyout.js`, styled by
       `.lit-flyout*` in `global.css`, also builds every reader's "Copy text ▸" and
       "Share ▸" rows and this file's "Print ▸" (rule 19). Desk code imports it;
       shared code never imports desk code. Hover opens it without taking focus; a
       click, Enter or the right arrow moves focus in (the selection panel passes
       `pointerFocus: false`, so a mouse click never moves focus into it); Escape or
       the left arrow steps back; it is fixed to the window and `role="menu"`.
       (BVJ proposed a Copy flyout on 2026-11-04 and Claude advised against it; BVJ
       revisited it on 2026-11-05 and decided on 2026-11-06 to build it, with the Copy
       row's own press still copying.) **"Stop following" and "Start following" are one
       quiet link** (BVJ, 2026-11-04 and E44, 2026-11-05; `bookmark-stop.js`,
       `drawFollowLink`) under the state line of every bookmark with "Move as I
       read" on, its label swapping with this tab's flag; not an On/Off switch,
       since a follow is the tab's and the switch is the record's. In the verse
       menu a moving bookmark has "Start following" beside "Edit bookmark…",
       and the resting one's "Leave it here" is the stop. Stopping clears the
       flag only: the bookmark stays where it last was with "Move as I read"
       still on. Starting is `followBookmark` with no link, as opening it from
       the list is apart from the navigation: the next report of where the
       reader is decides (reading on from it moves it, anywhere else pauses it
       with "Move it here"). It is offered only where the page follows the
       reader (`followsHere`), so /notebook shows the stop alone.
       **Every way the flag drops redraws the rows**
       (`dropFlag`: another tab took it, it was deleted or turned off, a
       back-forward restore), turning the switch off in the form stops it at
       once, a Back or reload doesn't write verse 1 over the bookmark before
       the scroll is restored, and a restored page reports its own last place
       (`pageshow`). A row opened in place on a page that doesn't follow the
       reader never starts a follow (`followsHere`); on /desk a moving
       bookmark's row moves the leading LIT pane to it and then starts the
       follow with no link (`tab-mine.js`), so the jump isn't taken as leaving
       the page. **The Show menu splits bookmarks** into "Bookmarks that move" and "Bookmarks
       that stay put" once a list holds both (BVJ, 2026-11-04;
       `BOOKMARK_MOVES`/`BOOKMARK_STAYS`, `kindsPresent` and `filterRecords`, in
       both lists), and **a search's count names the kind when every notebook
       hit is one** ("1 bookmark match"; `matchNouns`, else "notebook match"); the
       group is always headed "My notebook", whatever it holds (E32;
       `NOTEBOOK_GROUP_TITLE`; the tray, /search and the Search pane).
       **A bookmark found in a notebook search opens like its row**
       (`openAsBookmark`, notebook-search.js: follow, or stop what was moving).
       **Known and accepted** (BVJ, 2026-11-04, from an Opus audit):
       /notebook and /search clear the flag, so Back into the book doesn't
       resume it (the row's label shows the state); a move overtakes Undo of an
       earlier edit once the reader has read on (`desk-history.mjs`'s overtaken
       rule), and Delete then Undo resumes following only if they haven't
       scrolled since; and the last move before the tab closes can be lost,
       since Chrome drops a read-then-write made as a page closes (BA72).
       **One tab follows a bookmark at a time** (BVJ's Duplicate tab check,
       2026-10-29): Duplicate tab copies session storage, so the flag carries
       the tab's token, and a page that loads with it asks on
       `FOLLOW_TAB_CHANNEL` whether a live page holds that token; an answer makes
       this tab the copy, which drops the flag. Following a link announces it,
       and any other tab following that bookmark stops (`loseFollow`). The
       follower's move is quiet on purpose: the margin mark isn't redrawn as it
       moves, and takes its new place at the next redraw.
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
       **The Notebook actions window** (E31, reworked 2026-11-06) lists those
       commands (`listCommands` in `desk-commands.mjs`: what a ">" in the box
       offers on this page, and a line saying more appear on a chapter page).
       It is desk code (`desk/commands-window.js`), a `float-window.js`
       window like the Greek's and the tour offer, styled in `desk.css`, and
       **it is kept apart from the Greek "Search commands" window by BVJ's
       choice**: the two were one window for a day and BVJ did not want them
       combined, so don't put desk commands in `greek-commands.js` or Greek
       ones here. A row runs its command and closes the window, as the box
       does; link commands are plain links. It has three ways in, each a
       quiet "Notebook actions" link (named apart from the Greek's "Search commands", since the two sit side by side on /search, and not "prompts", which reads as AI or as reflection questions; BVJ 2026-11-06): the tray's footer row (`SearchBar.astro`), a
       link in /search's field row with the desk on (the "Search commands"
       button beside it is the Greek's, shown only for a Greek search), and
       the Notebook's Settings tab (`panel.js`, which sits the window left of
       the Notebook). The tray and /search call `openCommands` on
       `notebook-search.js` through `loadDeskSearch()`, never importing desk
       code (`test/desk-commands-window.test.js` holds it).
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
       `snapshot`/`restore` and the scroll where it was. **It opens and
       expands the Notebook with `remember: false`** (`open`, `showTab`, the
       rail's `show` and `expand`), which writes none of its keys, since a
       tour cut short by a reload or a link never reaches `restore` (BA33).
       While it runs,
       `data-desk-tour` on `<html>` makes `saveLastRead` record nothing. A
       new step that changes anything must undo it the same way (`later` in
       `tour.js`), and must never write a record. It won't start over a note
       editor holding unsaved words (`editorHolds`, BA37).
       **Where the browser keeps no notebook** (`store` null), first use
       shows no card, makes no offer and keeps only the foot's links, the
       tour leaves out the `notebook` steps of `TOUR_STEPS` (`canKeep`), and
       the shell stamps `html[data-desk-no-notebook]`, which the search box's
       command context reads as `keeps` (BA34).
     - **Two tours** (E24; BVJ, 2026-11-02): the notebook tour (`tour.js`) stays
       on the chapter pages, and the **Study Desk tour** (`desk/desk-tour.js`)
       runs on /desk. Each has **its own steps, seen list and offer**:
       `TOUR_STEPS`/`lit-desk-tour` and `DESK_TOUR_STEPS`/`lit-desk-page-tour`
       (`desk-first-use.mjs`; the helpers `parseTourState`, `tourOffer` and
       `planTour` take the step list, defaulting to the notebook's), so
       finishing one says nothing about the other and one "Don't show this
       again" never silences both. Ids may not collide (a test holds it). **The
       card, the way through the steps, placement and the ending are
       `desk/tour-runner.js`**, shared; a tour brings `act(step)`, `finish` and
       its `more` link. Keep the two in step when the card changes.
       **The notebook tour is 10 steps** (BVJ, 2026-11-02: "14 steps feels
       like a lot"; it was 14): Highlight and Bookmark are named in "Open the
       menu", "Set the widths" is in the help page, and the notebook page and
       where it's kept are one step (`kept`). The retired ids stay in a
       reader's stored list and are ignored, so nobody is offered a new tour
       for steps that went (tested).
       - **The desk tour acts fully and writes nothing** (BVJ: "make sure
         everything is in the default layout, then begin the demonstration. At
         the end of the tour, it should put everything back the way it found
         it"). It switches the desk to `originalLayout` for the run, adds a LIT
         pane (the flag that marks the leading one), presses a lock, opens the title menu, the
         Add pane flyout (adding a Footnotes column behind it) and the Layout
         window (applying an arrangement that fits), undoing each step before
         the next, and at the end commits the reader's own layout back. **What
         keeps that off disk is `layoutFrozen` in desk-page.js**: `save()`,
         `writeKey`, the "When this page opens" radios and "Make this my
         default" all do nothing while it is on, so a reload or closed tab
         mid-tour leaves `lit-desk-layout` as it was (the BA33 trap; tested by
         reloading mid-tour). A new step that changes anything goes through the
         page's `commit` and is undone with `later`, never a direct write.
         The menus' "click elsewhere" and `focusout` closers ignore the tour's
         card (`inTour`), or taking focus to the card would close what a step
         opened.
       - **Offer**: a floating window (`float-window.js`, as the notebook's)
         the first time /desk opens, 1.2 seconds after the panes draw: Take
         the tour now, Remind me later (also ×, Escape, leaving), Don't show
         this again. **Remind me later leaves a quiet line at the top of the
         title menu** ("New to the Study Desk? Take the tour", and "Not now",
         which is "never"), shown until the tour is taken or declined
         (`lineWanted`, `declineLine`). The menu's own "Take the tour" item is
         always there. `?desk-tour` on /desk starts it after load (the help page
         links to it) and is stripped from the address.
       - **Privacy**: `lit-desk-page-tour` is named in /privacy's paragraph
         beside `lit-desk-tour`.
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
     - **Licenses keep the files apart.** `text/` and `ubs/` are licensed CC BY-SA
       4.0 (`text/` draws on MorphGNT, CC BY-SA 3.0, which converts one way to 4.0; `ubs/` on UBS); `step/` stays CC BY 4.0, as do the
       STEPBible brief glosses in `search/` (BA47), with two exceptions that
       are **CC BY-SA 4.0 because they are Perseus's text, which STEP edited and
       labels CC BY** (BVJ, 2026-11-03, the cautious route until STEP confirms a
       separate agreement with Tufts): all of `lsj/`, and each `step/` entry
       ending "(ML)", Middle Liddell filling a word Abbott-Smith lacks (55
       entries; Abbott-Smith itself is public domain). `LICENSE.txt` says so,
       and `SOURCES` credits Perseus. If STEP confirms in writing, `lsj/` and
       the "(ML)" entries can go back to CC BY 4.0. The sources and their
       credits are `src/lib/greek-credits.mjs`: the tab lists `SOURCES`, and
       every group of Greek search results carries `SEARCH_CREDIT` under it
       (BA46; the Greek tab's result list too, GK-13), so a new place that
       shows Greek results draws it too. **Nothing
       from the LIT goes into `public/greek/`**: the tab's "rendered here
       as…" line reads the page's own `#term-lens-data`, whose terms carry
       their Greek `lemmas` (`term-lens-data.mjs`, from
       `scripts/lib/glossary-lemmas.mjs`). A website asset, never under
       `public/api/`.
     - **One loader serves a chapter's Greek** (`src/scripts/greek-chapters.js`,
       GK-20), the tab's `greek-data.js` and the search's `search-greek.js`
       alike, so a chapter on screen is fetched and parsed once. **Arrowing
       through words asks for a lexicon only at rest** (150 ms, GK-10).
     - **A copy from the tab writes its own clipboard** (E54): its words and
       signs are buttons, which a sheet's paste drops with their text, so
       `tab-greek.js` turns them into `lang="grc"` spans and leaves out the
       "Verse " labels. A new clickable element among the words needs the same.
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
       "Reset widths" (only its `kept: false` event, `forgetsSplit`, so the
       line still moves where storage is blocked, BA113), and named in
       /privacy's paragraph. The parsing is put in words by
       `src/lib/greek-parse.mjs` (shared with the phase 2 tool), and the
       SBLGNT's ⸀–⸅ signs draw from `public/fonts/text-critical-signs.otf`.
       SBL keeps a note on a span of verses under its first verse, so a sign
       finds its note at the nearest verse at or before its own
       (`noteVerseFor`, BA111), and a passage naming a verse the Greek lacks
       (Matthew 17:21) opens at the nearest before it (`nearestVerse`, BA120).
  15. **Phase 1h is searching the Greek** (built 2026-10-13; STUDY-DESK.md,
     "Order of work", 1h). Six things to know:
     - **It is ordinary site search, gated until launch.** Only while
       `greekSearchEnabled()` in `search-core.js` is true, which today is
       the preview's `data-desk="on"`; without it nothing under `greek/`
       is fetched and search is exactly as before. **Launch is that one
       function returning true.**
     - **The engine is its own download, desk on or off** (`search-greek.js`;
       LG-6, BVJ 2026-11-04: it loads only when actually needed). The tray,
       /search and /desk's Search pane reach it through `loadGreekSearch()`
       when a query is Greek, and the Greek tab's `greek-find.js`, which
       imports it, loads when a word's search is started. Never import either
       statically from desk code. What has to run first is in the small
       `greek-detect.mjs`: `isGreekQuery`'s parts, and the tab's
       `parsingQuery`. `test/search-greek-lazy.test.js` holds the split.
     - **One query never gets both English and Greek results** (BVJ,
       2026-10-13). A query with Greek letters or a Strong's number
       (`isGreekQuery`) gets the Greek alone, at any length (ὁ, ἐν), save
       the reader's own notes: under all types, the notebook's matches
       come ahead of it (BA40, BVJ 2026-10-28) unless the reader unchecks
       "My notes" (E11; a native checkbox, on a line of its own under the tray's
       status for every Greek search, whether or not the Greek found
       anything, and on /search in one box with "Search commands", inline in
       the field's row and, under 960px, on a line under the field; shown
       only with the desk loaded and the type "All types"; remembered as
       `localStorage['lit-desk-greek-notes']` = "off", absent = on, named
       in /privacy; the key and rule are `src/lib/desk-greek-notes.mjs`,
       the storage reads in `notebook-search.js`, which the surfaces
       already load lazily; English searches are not governed by it, and the
       desk's Search pane has the same checkbox on its link row, right of
       "See results on the search page", for a Greek search under all
       types, BVJ 2026-11-04); every
       other query gets exactly the pre-1h search, unless the reader picks
       the type menu's "Greek" (injected by script, only with the gate on,
       set apart by a rule, with its own line in the "i" tooltip),
       which searches Latin text as a transliteration or a gloss. "All
       results" keeps its name, and a **single Latin word that is also a
       glossary term's Greek lemma** ("pistis") gets one line under the status,
       "“pistis” is also a Greek word (πίστις). Search the Greek", whose link
       sets the type to Greek (BVJ, 2026-11-04, after a mock of three options:
       a relabel, this, and a separate English | Greek switch). The offer
       lists no Greek itself, so a query still never gets English and Greek
       together (2026-10-13). `greekOfferFor` (search-core.js) reads the
       build's `public/search/greek-offers.json` (125 lemma keys, fetched only
       with the gate on) and loads `greek-search.mjs` by a dynamic import for
       `latinKeys`, never at the top; the tray, /search and the Search pane
       each draw the line. /search
       pages the Greek with the English verses' pager, in Bible order with
       no sort control; the tray shows its own Greek group alone.
     - **A typed Greek word that could be more than one is a question, never
       a guess** (BVJ, 2026-11-03, decision 9). 58 folded spellings are both a
       headword and a form of another word (ἡ: the article's form, εἰμί's, ὅς's
       and the headword ἤ). A one-word search (`matchGreek` with `offerForms`,
       which `searchGreek` and the tray pass) offers each such lemma, the
       commonest first, and the surface shows its choice box. **Marks never
       decide it** (a breathing rule would leave ὃ/ὁ and εἶ/εἰ colliding and
       would be invisible to readers who type none), and a command query keeps
       lemma-first (no one to ask; `ὁ, θεός` must stay the article, not ὅς). The
       Greek tab's form button names its lemma (`prefer`), so it never asks. A test
       holds the 58.
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
     - **The Greek tab has word searches but no typed search**
       (`desk/greek-find.js`): in a word's details the form, the lemma, the
       Strong's number and the parsing each start a search (BVJ, 2026-10-13),
       and the results replace the text until "Back to the text". The
       header's search button and its field were taken out (BVJ,
       2026-11-02, E7): a typed Greek search is the search bar's, /search's
       and /desk's Search pane's, and the tab has no way into the commands
       window. The word choices and "Exact form only" stay, and "See results
       on the search page" sits at the top beside "Back to the text" (BVJ,
       2026-11-04). Its result
       rows preview their verse on hover like any reference
       (`ref-preview.js`: a row for another chapter is a link with a
       `?greek=` parameter, which the preview ignores; one for the chapter
       on screen is a button naming its verse in `data-preview-href`, and
       a tap on it jumps rather than previews). **A Greek word searches at
       any length there too** (ὦ, ἤ; BVJ, 2026-10-26, BA110): one test,
       `longEnoughForGreek` in `greek-search.mjs`, decides it everywhere the
       tab starts a search. A search that settles on the article (ὁ, not an
       exact form) answers with a line and a search beside a word (“ὁ, θεός”)
       instead of its list (confirmed, BVJ, 2026-11-03).
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
       **The note is linked in the linker's note mode** (stricter lists, any
       case and short names, `data-end` spans, and verse counts from
       `src/data/verse-counts.js`; BA89, BA94; `src/lib/CLAUDE.md`, “Scripture
       references link at render”), and “Mentioned in your note on…” lists the
       citing notes in `byPlace` order, Bible order then when made (BA93).
     - **What's new for you** (`src/lib/desk-whats-new.mjs`) reads the
       release notes through the change notice's `changeVerses`, so the
       description wording rule 12 relies on is load-bearing here as well.
       The feed is fetched once per tab (`desk/release-feed.js`,
       `sessionStorage['lit-desk-release-feed']`; a failed fetch is
       forgotten, so the page's Try again fetches afresh, BA88), "last
       looked" is the notebook meta value `whatsNewSeen`; both are in
       /privacy's paragraph. **"Last looked" is a day and a count**
       (`"2026-10-26+3"`, `seenValue`/`seenMark`), since the drafter folds a
       second publish on one day into that day's entry, and the changes past
       the count are new (BA92). **The feed's days are Pacific**, so
       `textDay` (`desk-change.mjs`) reads a mark's timestamp as its Pacific
       day and a content version's UTC day as the day before. A pinned
       footnote or a note on a footnote hears only the footnote changes
       (rule 23; BA90). Setting a meta value tells the other tabs with a
       message of its own (`metaMessage`, heard through `store.onMeta`), so
       My Notes' line moves on with the notebook page without every tab
       redrawing its marks (BA96).
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
     - **`searchGreekAuto` in `search-greek.js` is the one Greek search**
       the tray, /search, /desk's Search pane and the Greek tab's word links call: a command query goes to
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
       (`src/scripts/greek-commands.js`).
       **Its top is the search builder** (E5, BVJ 2026-11-02; mocked first,
       then built on Claude's recommendation): a card for each word (up to
       four), each with menus that list only what that word takes, a "+ Then
       another word", and "How close" once there are two. **The search field
       is the only record of the search**: the builder reads it with
       `parseGreekQuery` on every change and writes it with `putSearch` (typed
       when the field has focus, so undo works after a mouse press), and a card waiting for its word is the one thing it
       holds that the field doesn't. A search it can't show (`=` exact,
       plain words, one that doesn't read) says so and leaves the
       field alone, with "Start a new search". The rules are
       `src/lib/greek-builder.mjs` (pure, tested); the drawing is
       `src/scripts/greek-builder.js`. A word's choices are the parsings its
       lemma's words take, read from the same shard the search uses
       (`codeCounts`), so nothing new is built or fetched until a word is
       typed, and a choice also narrows the others (θεός, once "genitive"
       is chosen, offers only singular and masculine: its plural and feminine
       forms aren't genitive). A word that is also a command ("perfect", "and") is
       written quoted, and among several words it is left out, since a quote
       can't sit inside "a/b". A press that finds the field changed behind its
       back (Back, a "Did you mean") reads the field and does nothing else.
       A choice already made
       stays listed even when the word takes none of it, so it can be taken
       off. The old list and examples sit under "Examples and all commands",
       which an error pointing at a command opens. A builder search is a
       Greek one, so writing one puts the page's type menu on "Greek" when
       the text isn't plainly Greek already. Room is left for E6 (a "related
       words" choice on a card); nothing is added for it. It is a `float-window.js` window,
       outside `lit-panel.js`'s one slot, so a footnote or preview opening
       never closes it. It opens from the tray, /search and /desk's Search
       pane. (It once opened from the Greek tab's field too, until E7,
       2026-11-02; its `source: "notebook"` placement and
       `greek-commands.js`'s listener for `lit:notebook-state` are left over
       from that, tested and unused, and `panel.js` no longer sends the
       event.) A click finding its field gone closes it
       too (BA114). What it announces is
       meant to be heard: a command by its meaning (“Added: Within 3
       words.”), the builder's by the query it made (BA117).
       **What it puts in a field is typed, not set** (BA147): `typeInto`
       replaces only the changed span with `execCommand("insertText")`, so
       Ctrl+Z still works; setting `value` empties the field's undo, and is
       only the fallback (a command pressed by keyboard inside the window,
       where the field hasn't focus).
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
       dragging a pane over another, where `dropZone` says an edge band
       splits it (`splitPane`) and the middle swaps the two (`swapPanes`;
       E25, BVJ 2026-11-02, the drop box names which; over nothing a pane can
       land on, a label by the pointer says so and a drop announces "not
       moved," 2026-11-04), and `neighborIn`
       for the pane menu's Move left, right, up, and down (the keyboard's
       swap; only a pane touching this one counts). **The pane menu is the
       kinds plus three flyout lines, Add pane, Move and Size** (BVJ,
       2026-11-04; `openKindMenu`, `openFly` in desk-page.js): hover opens one
       without taking focus, a click or the right arrow moves in, left or
       Escape steps back. A flyout is a sibling of the menu, never a child,
       since the menu scrolls and would clip it. **Add pane there is
       `addBeside`/`addBesideNeeds`** (desk-layout.mjs): left, right, above or
       below the pane, joining the nearest row or column running that way (or
       turning what is there into a two-part stack), with the room shared
       evenly, so nothing is split off the chosen pane alone. `dropZone` takes the
       zone the pointer was in and holds it 8px past its edge, so the line
       between zones doesn't flicker; a drop is planned again at release;
       the 280 by 160
       minimum (`needs`, `fitSizes`, `resize`); and which panes follow the
       active LIT pane unless pinned (`KINDS`, `leaderFor`). A new
       arrangement or kind goes there, never in the page.
     - **Reading and `?place=`** (E8, 8a; BVJ, 2026-11-02): "Reading" is the
       first row of the Layout window, one LIT pane (`readingLayout`); it is
       One pane's shape, so `arrangementOf` tells them apart by the pane's
       kind. **Choosing it also turns off verse numbers, footnote letters, key
       terms, and highlights** (BVJ, 2026-11-04; `reading-display.js`), and
       **leaving Reading by any way** (a row, Reset, Add pane, a drag, a
       pane's kind, a link's `?sheet=` or `?intro=`; `leavesReading`, run in
       `commit`; BVJ, 2026-11-07, DK3-2) turns back on only the ones Reading
       turned off (remembered under `lit-desk-reading-off`) and that are
       still off. A second press of Reading adds to that list, never
       replaces it (LV3-2). The undo bar names them either way and Undo reverses them. The LIT pane's reading
       line and the shared `keepReadingPlace` line are both 10% down, as
       Continue reading's (`LINE` in `lit-pane.js`). `/desk/?place=romans-8` (`parsePlaceParam`; also `romans-8:16`,
       `romans-8-v16`) is what a link to the desk carries: whatever the page
       would have opened (last, default, or the original for a first visit)
       keeps its panes and sizes, and only the active LIT pane and the
       shared place move (`arrivalLayout`, pure and tested; BVJ, 2026-11-02:
       a link never forces an arrangement, Reading included). desk-page.js saves the move
       and strips the parameter. On a chapter or intro page the toolbar's
       "Study Desk" pill carries the chapter (`ScriptureLayout.astro`, its
       `deskPlaceHref`); the header's link is on the home page only. A new link
       into /desk that means to open at a passage uses this, never the layout key.
     - **Read View's retirement is prepared, not live** (E8, 8b; BVJ,
       2026-11-02). With the preview on, `/read`'s Read View card and the
       chapter picker's "Open X in Read View" link become the Study Desk
       (`.view-card--desk` in `read.css`; ReadMenu reads `data-desk`), and
       the rest stays. `src/lib/read-view-retirement.mjs` (redirects, the
       `#ch-N` and verse-anchor mapping, "Continue reading" records from
       Read View read as Chapter View places) and
       `src/scripts/read-view-redirect.js` are built and tested but imported
       by nothing: work session 8c wires them in at launch, removes Read
       View, and deletes the test that guards the gap.
     - **A pane's body comes from `desk/desk-panes.js`**, which mounts the
       Notebook's own modules rather than copies, so a pane and its tab
       can't drift apart: My Notes is `tab-mine.js`, This verse
       `tab-verse.js` (with "This chapter", the chapter's Go deeper, at its
       foot), and Greek `tab-greek.js`. Those tabs take a `source` and an
       `idSuffix` for this; a change to one must keep both callers working.
       **Book Intro is `intro-pane.js`** (E53; BVJ, 2026-11-06): a follower
       whose place is a passage like the others' but which reads only its
       book, so the LIT pane's place stays a verse and no other follower
       meets an introduction. It reads the built `/romans-intro/` page
       (`introPath` is the fetch's guard, as `chapterPath` is a chapter's),
       its headings moved two levels down under the pane's. A plain click on
       an `a.sref` in it moves the LIT pane (`env.showPassage`), and the pane
       **holds its book while the LIT shows the passage it sent**, until the
       LIT moves to any other book; every other link opens a new tab.
       `showIntroIn` (`desk-layout.mjs`) is the one rule for showing a book's
       introduction from outside the pane: a following Book Intro pane first,
       else any, else a new one beside, moving the LIT to the book's chapter 1
       only when it is in another book (a pane that stays put moves alone).
       A Search pane's intro result and `/desk/?intro=romans` both use it.
       **There is one notes pane, My Notes** (E17, BVJ, 2026-11-02; the
       "What I've kept" pane was folded into it): `tab-mine.js` has the
       search ("Search my notebook"), "Show" by kind, a count in words, the
       list in Bible order under a heading for each chapter once it spans
       more than one, a "Labels…" button and chips on a row, and, on /desk,
       follows the LIT pane. `kept-list.js` remains, but only the notebook
       page draws it. **My Notes lists no sheets** (`withoutSheets`, BVJ,
       2026-11-07): they have /sheets and the Sheet pane, and the notebook
       page's list still shows them as "Other items". A layout saved with the retired kind `kept` reads back
       as `mine` (`RETIRED_KINDS`, applied in `checkLayout`, so the last
       layout and "My default" are both migrated); one that held both panes
       keeps two My Notes panes. A new feature of the notebook's list goes in
       both `tab-mine.js` and, if the page needs it, `kept-list.js`.
       **My Notes' follow** (E22): the row it follows to is `followTarget`
       (`desk-notebook.mjs`): the first record at or after the LIT pane's
       reading line, by the end of its verses, across books, or the last
       before it. It scrolls there only when that row is out of view, marks
       it `aria-current="location"` when it is in the chapter being read, and
       says "Nothing kept in Matthew 9." when the chapter holds nothing, while
       still bringing the nearest records up. Before this it stayed where it
       was in a chapter with nothing kept, which read as not following. A
       heading is a row of the list (`li.desk-mine__heading`), so a row is
       found by `.desk-item` and its record id, never by its position.
       A record's reference in My Notes moves the LIT
       pane there (`goToRecord`, passed as `goHere`; BA124), never leaving
       /desk; the notebook page's list keeps plain links. The "Show in this
       pane" menu is placed on the screen (`placeKindMenu`, `position:
       fixed`), above its button where it doesn't fit below, since the
       panes box scrolls and cut it off (BA122); any scroll or resize
       closes it.
       **The three tabs each return a `destroy`** that takes off what they
       add to the window or the document, which the pane calls when it
       closes and when it builds a new tab for another chapter (BA31,
       BA115); a listener a tab adds outside its own element goes in it.
       **A pane's scroller must be positioned** (`position: relative`; the
       Greek's in #354, the Sheet's 2026-11-04, and `.desk-pane__body` as a
       guard): `.sr-only` is absolute, so a hidden label or hint below the fold
       otherwise takes the pane as its containing block, escapes the scroller's
       clipping, and stretches the panes box, which grows a scrollbar of its own
       and shows empty space under the panes. Check a new pane kind with
       `.desk-ws__panes`' `scrollHeight` against its `clientHeight`.
       **A LIT pane stops drawing chapters far from its window** (DK-15):
       past 40 on the page, one more than 3 pane heights away gets
       `display: none` on its text and keeps its height (`park`, `balance` in
       `lit-pane.js`), and is drawn again within 2. The text stays in the
       DOM, so marks, labels and anchors read it as before; browser find does
       not search it. Measured on /desk with all 211 chapters: re-layout
       520 ms to 15 ms, scrolling 42 ms a frame to 7. `content-visibility`
       was tried and fixed the layout only. A new reader of a pane's text that
       needs it drawn (a rect, a selection) must handle a parked chapter.
       **`desk/dom.js` holds `make`/`el` and `escapeHtml`** (LG-13): import them,
       don't write another copy. `announce` and `say` are not shared on purpose
       (the copies differ), and `first-use.js`, `desk-tour.js` and
       `sheet-text.js` keep their own `el`/`make`, which differ in how they
       treat a null text.
       The LIT pane is `desk/lit-pane.js`, Footnotes
       `desk/footnotes-view.js` (3e), and Sheet `desk/sheet-pane.js` (3f),
       the sheet editor, with its formatted text in `desk/sheet-text.js`
       (a paste or a drop from elsewhere is read by `pastedSheetHtml`,
       which keeps what Google Docs, Word and web pages mean: headings and
       lists inside a wrapper, Docs' bold and italic, Word's lists; BA68,
       BA71, BA73. How a client reads a paste isn't in the format)
       and what it knows about the LIT (3h: blanks, the footnote picker,
       the key terms box and the license card) in `desk/sheet-lit.js`,
       whose rules are `src/lib/desk-sheet-lit.mjs`. **My sheets lists
       Duplicate beside Delete** (BVJ, 2026-11-04; `duplicateSheet` in
       `desk-sheets.mjs`): the same parts under fresh ids, "<title> (copy)"
       (cut to the title limit), and everything else kept, so labels and a
       passage's `verseCopy` carry and the copy is still checked against the
       wording it was made on. It reads the sheet from the store at the click,
       refuses a sheet of a newer format (the button is disabled), and opens
       the copy. It adds no field or kind and changes no format.
     - **A chapter's address is built from a stored book key only through
       `chapterPath` / `isChapterAddress` (`desk-passage.mjs`)**, which refuse a
       book the LIT hasn't got or a chapter outside it. A record from a newer
       schema, or a sheet in a newer format, is carried untouched without its
       fields being checked (`validateRecord` stops at `canEdit`; principle 6), so
       `bookKey` can hold anything a backup file or a sync brought, and
       `/${bookKey}-1/` with "/attacker.example/x" is an address on another site
       that a sheet's passage would fetch and import into the page (SEC-1 of the
       2026-11-03 audit). So `loadChapterPage` rejects before it fetches
       (`chapterHref` returns null), `recordHref` and `recordReadHref` return
       null, and `chapterCodes` prints no code. A new place that turns a
       record's book key into a link or a fetch uses the same helper;
       `test/desk-chapter-address.test.js` holds each sink.
     - **Every pane reads a chapter from its built Chapter View page**,
       fetched and parsed once a visit (`desk/chapter-page.js`), so what it
       shows is character-identical to Chapter View. Only the parts the panes
       read are kept, moved into a document of their own (`keepParts`: the
       text, the footnotes and Go deeper; BA65), so a new reader of `doc`
       finds nothing else there. Each LIT pane keeps
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
       and so is a new size: the pane notes the verse at the line whenever it
       settles, and its ResizeObserver puts it back when the width or height
       changes (BA54). The room below the text is the part of the pane below
       the line (`--desk-lit-below`, BA57), so the last verses reach it.
       **The verse at the line is read from the verses' `[data-verse]`
       spans, never their numbers** (`placeNow`, `keep`, `indexAtLine` in
       `desk-lit-text.mjs`; E29), since the Display tray may hide the
       numbers. **The scroller is positioned** for the same reason: a hidden
       number, letter or heading is a 1px absolute box (global.css), and with
       the pane's body as its containing block it stayed where the text was
       first drawn, so with numbers off the location field read verse 1 and
       a jump to a verse landed wrong. With numbers off the chapter headings
       are hidden that way too (styles/CLAUDE.md, the Display tray's rule 6).
       **Its bar has "Open on its page"** (E35): a link after the
       next-chapter arrow (`extra` in `passage-bar.js`, `OPEN_PAGE_ICON` in
       `glyphs.js`) to the chapter's page at the verse the field names
       (`showPlace`, which every move of the field goes through), in a new
       tab, as the chapter headings' links also open.
       Only the reader's own scrolling reports a new place, so panes
       never chase each other. Footnote letters open their own chapter's
       note (`footnotePanel`, shared with Chapter View in `panel-pieces.js`);
       key terms are attached per chapter (`attachTermLens` in
       `term-lens.js`). **The verse menu and the selection panel are Study
       View's own** (3f): `attachVerseTools` in `chapter-tools.js` takes the
       pane as a view whose text holds many chapters (each names its own
       reference, link and notes), and one set of selection listeners serves
       every view, so two panes never answer one selection. A change to
       either panel must keep Chapter View, Read View and the pane working.
       **A panel opened from a pane's text is pinned to the screen** where it
       opens (BVJ, 2026-10-26; BA125): the pane's scroller carries
       `data-panels-pin`, and `showPanel` (`lit-panel.js`) pins a panel whose
       trigger is inside it, or one opened with `pinned` (the selection
       panel, whose trigger is a rectangle), since a place in the document
       wouldn't move with text scrolling in its own box. Its footnote letters
       are `aria-haspopup="dialog"`, as Chapter View's, and a middle-click on
       one is cancelled, so it never opens another /desk (BA126). No
       reader's notes or bookmarks beside the pane's text, by BVJ's choice
       (3g, kept in E28, though the leading pane now moves a following
       bookmark and the rows carry its colors): My Notes is a following pane that scrolls its list so the
       records on the passage being read are in view (`follow` in
       `tab-mine.js`), and a record's reference moves the LIT pane there.
     - **The reader's marks reach the LIT pane through `page.js`** (3g): each
       pane registers its text (`addDeskText`), `deskChapterBoxes()` lists
       every chapter the panes show (twice when two panes show it), and
       `chapterTextFor` reads the first. A pane says when it gains a chapter
       or clears its text (`deskChaptersMoved`, the same `DESK_TEXTS_EVENT`),
       and **a view that judges records against the text redraws when the
       chapters shown change** (`onDeskChapters`; the My Notes and This verse
       panes, BA121), since a record is judged only where a pane shows its
       chapter; a new such view needs it too. `desk/lit-records.js`, which
       watches every listed text, on the page or not (a pane is built off
       the page), and lets go of one taken off the list (BA123), keeps each
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
       beside My Notes, 60/40 (sizes whose sum overflows are made even,
       BA58). Named in /privacy's paragraph. **The layout keeps the
       reader's sizes; only the drawing is fitted** (BA61): `drawn` in
       desk-page.js is `fitSizes` of the layout for the room there is, so a
       narrow window squeezes the panes without the squeeze being saved, and
       a line the reader moves starts from its drawn sizes. `/desk/?sheet=`
       splits off a Sheet pane only where the width holds another column
       (`showSheet`'s `width`, BA60).
     - **The desk has its own header** (BVJ, 2026-10-21; `deskTitle` on
       Layout and SiteHeader), at every width: the emblem and "LIT Bible"
       as the home link, "Study Desk" centered as the page's h1, then the
       menu button (Aa is gone from the bar: see "The title menu" below).
       No nav row and no search; the Display tray carries
       Chapter View's "Show" switches (`scriptureControls="study"`), which
       reach the LIT pane's text. Search is a pane (below).
     - **The title menu** (E15 and E14; BVJ, 2026-11-02; mocked first, he
       picked "everything in the title, and Aa moves in too"). The h1's text
       is a button, `Study Desk ▾` (`.desk-title`, built by desk-page.js, which
       swaps the heading for a wrapper holding the h1 and the menus so the
       windows take the header's type, not the heading's). Its menu holds Add
       pane, Layout…, Print…, Display options, Full screen, then My notebook
       page, Take the tour and Help (one divider before the three). **Full
       screen** (E43; BVJ, 2026-11-06: the browser's own full screen only, no
       mode hiding the site header) presses the Fullscreen API on the whole
       page, reads "Full screen (F11)" ("⌃⌘F" on a Mac) and "Exit full screen"
       only for a full screen it entered, since F11's is invisible to the page
       (`fullscreenElement` stays null); no line where the API is missing, and
       a refusal is announced with the key to use instead. Escape is the
       browser's way out, and in full screen the page never hears that press,
       so with a menu open the first press leaves full screen and the second
       closes the menu (accepted, not worked around). Each visit needs a
       click: browsers refuse full screen on load, so it can't be a saved
       preference. The Browser pane never answers the request, so check it in
       a real browser. My notebook page and Help open
       in a new tab, since they leave the desk; **Take the tour starts the
       Study Desk tour in place** (a button, E24; see "Two tours" under rule 13). **There is no Settings window and no
       "Where my notebook is kept" item** (BVJ, 2026-11-02): the Notebook's other
       settings are margin switches that mean nothing here, or already live in
       Display options and Layout, and "where it is kept" would only link to a
       section of the notebook page. **Layout and Print left
       the bar**: their windows are the same ones, hung centered under the
       title. **Display options is the header's own Aa button moved into the
       menu whole**, so the shared tray's listeners stay on it;
       `data-tray-anchor=".desk-title__button"` (SiteHeader's `anchorOf`) hangs
       the tray from the title and returns focus there, because the menu
       closes as the tray opens. **Add pane** is a flyout to the right that
       asks "Add column" or "Add row", then (the kinds replace those two in
       the same flyout, with a "‹ Add column" row to go back) which kind of
       pane to show. A column is a full-height pane at the right edge of the
       page and a row a full-width pane along the bottom (`addPane`, pure in
       desk-layout.mjs; the others keep their proportions and the newcomer
       takes an even share); the new LIT pane starts at the shared place.
       `addPaneNeeds` says why one can't be added: `FULL_TEXT`, "Four is the
       most" built from `MAX_PANES` (D9; compare the reason, never the words)
       or "Needs a wider/taller/larger window" (the 280 by 160 floor). The
       item is disabled, not hidden, with the reason beside it, and a
       direction that doesn't fit is disabled inside the flyout. The menu is
       `role="menu"` (arrows, Home and End, which pass over a disabled
       line in every desk menu, as `src/scripts/CLAUDE.md` says; Right opens the flyout, Left or
       Escape steps back); Escape from the Layout or Print window returns
       focus to the title button. `/notebook` and `/sheets` have no title menu.
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
     - **The Search pane is phase 3m** (built 2026-11-01):
       `desk/search-pane.js`, a third UI beside `searchbar.js` and
       `search.js`, reached only from `desk-panes.js`. It calls
       `search-core.js` and never copies its parsing or bucketing; a new
       rule both UIs need goes there. Its pure rules are
       `src/lib/desk-search-pane.mjs`. Its filters are in /search's order (book,
       then type), and a "See results on the search page" link under them
       carries the same search (q, book, mode) to /search, which shows more
       than the pane does (BVJ, 2026-11-04). **It keeps nothing about a search**
       (no key, no layout field), so /privacy doesn't name it and a reload
       empties it. **It stands alone**: not a follower, and “The book I’m
       reading” fixes the book when picked. **A passage result offers both
       ways to read it** (E34; BVJ, 2026-11-05): a plain click on a verse or
       topic moves the leading LIT pane through `env.showPassage`, or opens
       one beside the pane when there is none, and the note line says which
       (`showPassage` returns "moved", "opened" or "placed";
       `passageMoveMessage`); a small link beside the row (`awayLink`,
       `.desk-search__away`) opens its page in a new tab. Rows stay
       real links, so a modified click opens a tab and `ref-preview.js`
       previews them (`.desk-search__link`); on /desk the preview's
       "Open John 3 →" opens in a new tab too. A glossary entry is cloned from
       the fetched /glossary/ page into the pane; an article opens in a
       new tab, and an intro shows in a Book Intro pane (E53; `env.showIntro`,
       `introMoveMessage`), with the small link beside it for its page. A Greek result goes through `env.openGreekHit`, and
       every Greek group carries `creditHtml` (rule 14). Adding to a sheet
       reads the target from `addTarget` and `onAddTarget` (`sheet-pane.js`),
       the same rule as “Add to sheet,” and writes in one `store.change`.
       `showSheet`'s `keep` stops the pane giving its own place to the sheet
       it just made. `/` reaches it as a `lit:desk-search` event from
       `keyboard-shortcuts.js`, which imports nothing of the desk.
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
     - **Copy** (`desk/sheet-word.js`; "Copy for Word" until E36) reads the copy on screen and
       writes HTML with inline styles plus plain text, so what is pasted is
       what would print, codes aside. Its button carries the copy glyph (two
       sheets, drawn in `sheet-page.js`'s `copyGlyph`, as the glossary's copy-link icon) and
       the accessible name "Copy this version to the clipboard".
     - **Save as ▾** (E37; BVJ, 2026-11-06) sits after Copy and saves the
       version on screen as a document: .docx, .odt, .rtf, or "PDF…", which
       runs Print and says to choose "Save as PDF". **Copy and the files read
       one model**: `readCopy` (`sheet-word.js`) walks the copy on screen into
       blocks and inline pieces (`src/lib/desk-sheet-doc.mjs` documents them),
       and Copy is that model's HTML and text writer (`docHtml`, `docText`),
       held to its old output by `test/fixtures/sheet-copy-golden.json`. A new
       part of the paper copy is read there once, and every writer then
       follows. The key terms box is a `box` block (E57), which each writer
       draws as a one-cell table ruled all round; a new writer must too, or
       the box comes out bare. The writers (`desk-doc-docx.mjs`, `desk-doc-odt.mjs`,
       `desk-doc-rtf.mjs`, over the hand-written `desk-zip.mjs`) are pure and
       reached only by `sheet-save.js`'s dynamic imports, never statically
       (`test/desk-sheet-doc.test.js` holds it). The menu's groups are
       `SAVE_GROUPS`. Every file ends
       with `LIT_CREDIT_LINE` and carries it in its properties; fonts are named,
       not embedded.
       **The "Slides" group (phase B) is present mode's screens, not the paper
       copy**: `desk/sheet-slides.js` (a dynamic import from `sheet-page.js`)
       runs `prepareDeck` and reads each screen off the stage, a passage covered
       and then revealed, so a slide can't disagree with what the room sees; a
       change to a screen's markup must keep `readSlides` reading it. The rules
       (the deck, cutting by length, the layout, a text box's paragraphs) are
       `src/lib/desk-slides.mjs`, shared by `desk-slides-pptx.mjs`,
       `desk-slides-odp.mjs` and the print view, so all three lay a slide out
       alike. A paragraph too long for a slide is cut after a sentence
       (DK3-1), since PowerPoint doesn't shrink a box's words on opening; a
       passage with blanks is cut only at verse numbers, its two forms' words
       differing. **Saved from the participant version the slides have no
       speaker notes** (SEC3-3; BVJ, 2026-11-07): no answers, no Leader only
       parts, no list of blanks. The credit line is on the first and last slides and in the
       properties. "PDF…" there is `printSlides`: a print-only copy of the
       slides, the page's `@page` rule swapped for the slide's size, every
       inline style `!important` (print.css turns everything black serif
       otherwise), all put back on `afterprint`. **In an .odp, never give
       `presentation:notes` (or the master's notes) a `draw:style-name`**:
       Impress paints the slides with it, which turned the dark ground white.
     - **The paper is `localStorage['lit-sheet-paper']`** (Letter or A4,
       guessed from the reader's languages until chosen), named in /privacy's
       paragraph. Its `@page` rule is added as the page's last style, after
       print.css. On screen the copy is a white sheet of that width in either
       theme, and `sheets-page.css` lets the reader's named fonts, colors and
       backgrounds print, which print.css otherwise turns to black serif.
     - **Printing with my notes (M6) needs no sheet**: "Print with my notes"
       in the Print menu (below) and the command list, on Chapter View chapters and
       Read View (`desk/print-notes.js`, rules in
       `src/lib/desk-print-notes.mjs`). For that one print it sets
       `html[data-desk-print="notes"]`, inserts a print-only
       `aside.desk-print-notes` just before each block holding a note's first
       word (`display: none` on screen, `aria-hidden`, no `[data-verse]` text,
       so no reader of the page sees it), wraps each highlighted run in a
       print-only `mark.desk-print-mark--<colour>`, and undoes all of it on
       `afterprint`, joining every split text node back into the original
       node. **A superscript the highlight holds whole (a footnote letter, a
       verse number) is moved into a mark of its own, never marked inside**
       (BVJ, 2026-10-29): a mark inside the raised letter is tinted only as
       tall as the letter, which notched the band at every letter. **Not Custom Highlights**: Firefox prints a copy of the page that
       leaves them behind (BA146). **Not a grid**: `desk.css` floats each
       aside right beside its block, because Firefox moves a whole grid row
       to the next page (BA151). Plain Ctrl+P never has the attribute and
       prints as before.
     - **Print ▸ in the verse menu and the selection panel** (E40; BVJ, 2026-11-06):
       a flyout after Bookmark in the "My Notebook" rows (`printRow` in
       `desk/actions.js`; a finger's chips get the three items flat under a "Print"
       subheading). Verse menu: "This verse" ("These verses" for a range), each
       "…with my notes" and "…with room to write"; selection panel: "This
       selection…", the same three. Chapter View's verse menu and either view's
       selection panel only: not /desk's LIT pane (a print there would need a
       new-tab route like the Print menu's), and not the glossary. The labels come
       from `partChoices` (`src/lib/desk-print-part.mjs`, pure and tested, with
       `onVerses`, `planVerses`, `citedFootnoteIds`, `notesForPart`); the page side
       is `desk/print-part.js`, through `printLook` so the one-at-a-time rule and
       the take-away on `afterprint` hold. **Verses are hidden, not copied**: the
       blocks, verse spans and footnotes a print leaves out get
       `data-desk-print-skip` and `html[data-desk-part="verses"]` is stamped, and
       desk.css hides them on paper only; what stays is the real text, so verse
       numbers, footnote letters, the cited footnotes (only those) and print.css's
       credit and notice print as for a chapter. "With my notes" hands M6's `build`
       a verse range (`print-notes.js` `build(s, only)`, notes and highlights on
       those verses) and "with room to write" is N9's ruled margin on the
       container, unchanged. A note spanning verses outside the range may leave its
       aside beside a hidden block; accepted. **A selection** prints the same text
       as Copy text (`richText`, through `handoutHtml`: italics and verse numbers
       kept, no footnote letters) as a print-only excerpt appended to the text's
       container (`div.desk-print-excerpt`, `data-desk-print-extra`), everything else
       skipped, `html[data-desk-part="selection"]`; "with my notes" appends the notes
       on the selection's verses (not on footnotes) after it under "My notes".
       Highlights are not tinted in a selection print. Both put a "John 3:16–18
       (LIT)" heading first (the page's own title is hidden under
       `html[data-desk-part]`). **"With my notes" stands down while "Hide my marks"
       is on**, with the same notice print-link.js gives. It is offered only where
       the browser keeps a notebook, which is where the My Notebook rows exist at
       all, so there the whole Print ▸ row is absent.
     - **One Print menu, on /desk and in the Notebook** (E16; BVJ,
       2026-10-29, and 2026-11-02): `desk/print-menu.js` is the menu, and what
       each choice does for the chapter picked is `printMenuState`
       (`desk-print-notes.mjs`, pure, tested), so the two homes can't drift
       apart. It is a **chapter picker**, the passage field the panes use
       (`passage-bar.js`: "John 3", "Rom 8", the arrows across the books), then
       three choices: the chapter plainly, with my notes, with room to write
       (`PRINT_KINDS`). The picker starts at a chapter given by the host each
       time the menu opens (on /desk the leading LIT pane's, else the shared
       place; in the Notebook this page's) and changes only what is printed,
       never a pane or the page; a draft chapter (the list is /desk's alone)
       or no chapter leaves the choices off, with a line saying why, and "With
       my notes" is left out where the browser keeps no notebook. **A chapter
       other than this page's opens `/<book>-<chapter>/?print=<kind>` in a new
       tab** (`printHref`), where the shell's `desk/print-link.js` strips the
       parameter and starts that print once the page has loaded (a draft page,
       which has no text, prints nothing). **Only the menu's press prints**
       (SEC-4): it leaves a one-time mark for that address
       (`localStorage['lit-desk-print-ask']`, `printWasAsked`, good for a
       minute), so a link from a chat or a shared sheet only opens the chapter,
       and with notes it stands down, saying so, while "Hide my marks" is on. A
       new way to ask for such a print must leave the mark. **This page's own chapter prints in
       place**, with no new tab, as the Notebook's buttons always did. /desk's
       is "Print…" in the page-title menu (E15, below); the
       Notebook's is one "Print…" button at the foot of the Settings tab
       (`panel.js`'s `printBox`, Chapter View chapters and Read View), opening the
       menu in place under it. **In Read View the menu has no picker** and
       prints the book on the page in place (the plain choice reads "The
       book"): a book is what Read View prints, and picking a chapter is Study
       View's and /desk's. The host owns the button, Escape and focus; the
       menu's `onChoose` closes it. The page-title menu opens this same menu.
     - **Printing with room to write (N9) is M6's blank sibling**: the
       choice right after it in the Print menu, and the command
       `print-with-room`. `desk/print-room.js` only stamps
       `html[data-desk-print="room"]`, waits for the print fonts (reusing
       `print-notes.js`'s bounded `printFonts`), prints, and removes the
       attribute on `afterprint`. **Both prints go through `printLook`**
       (`desk/print-look.js`): one at a time, and where no dialog opened
       (so no `afterprint`), the reader's next focus, pointer or key event
       takes the look away, so plain Ctrl+P never inherits it (BA35). It reads no notebook, so unlike M6 it is
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
       (`presentMessage`, `checkState`) before it is used. Every message
       carries the sender's `role`, and **a `hello` counts as hearing that
       window**, since the state then flows the other way and the newcomer
       sends none (BA84). The presenter view
       places the presentation on a second screen through the Window
       Management API where it can (`openPresenterWindow`); without it, the
       leader drags the window. Asking for the screens can use up the click
       a window needs, so where the permission had to be asked and the
       window is blocked, it says to choose Presenter view again (BA85).
     - **While it is open, everything behind it is `inert`**, and the stage
       is a `role="dialog"`, which is what keeps the site's single-key
       shortcuts (keyboard-shortcuts.js) out of its way. Its keys are heard
       on the document in the capture phase, and a strip button about to be
       disabled or hidden hands focus to the stage first, so focus never
       falls out of the keys' reach (BA79).
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
       "damaged" for one it can't read). The Share dialog's button for that
       file is "Export a Study Desk file (.md)" and the Sheets page's is
       "Import a Study Desk file" (`EXPORT_LABEL`, `IMPORT_LABEL` in
       `sheet-page.js`; BVJ, 2026-11-06), so "Save as" names only a document;
       the reader-facing name of a `.lit-sheet.md` file is "a Study Desk file
       (.md)" wherever it is mentioned. The dialog's note also says a PDF comes
       from Print ("Save as PDF"). Opening one decompresses with a
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
       A shared sheet shows read only until "Import into my notebook", which saves
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
       content version and its build time (`textDay`: the reader's day,
       not the build's UTC day). `readPassage` (`desk/sheet-lit.js`) carries the
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
     - **`desk/footnote-notes.js` is its page side**: an "Add a note" button,
       the plain note marker's glyph (BVJ, 2026-11-06; it read "+ Note" until
       then), named "Add a note on footnote 3", beside every Pin (`addNoteButton`,
       which `pins.js` and the tabs and pane call). This verse's own add button (`tab-verse.js`,
       "Add a note on this verse") is the same glyph pill. **Pin is a glyph, not
       words** (E18): a thumbtack to pin, struck through to unpin, and the
       thumbtack means that and nothing else; a pane's "Stay here" on /desk
       is a lock (E21). The same file draws the reader's notes under a
       footnote (`footnoteNotes`). Both sit beside `.fn-body`, never in it, so a footnote's text, the
       handout and `footnoteList()` read only the footnote. The margin
       places such a note beside its footnote's `li` (`note-sources.js`)
       and marks the `li` instead of lighting verse words.
     - **In the Footnotes list, Pin and "Add a note" sit in the left margin**
       (BVJ, 2026-11-06, E49; `desk/footnote-pills.js`, the rule in
       `src/lib/desk-footnote-pills.mjs`, pure and tested). `initPins` puts
       both in one `.desk-fn-pills` after each footnote's `.fn-body`, in the
       order "Add a note", then Pin, so reading and tab order are the drawn
       order everywhere (left to right, top to bottom in the "⋯" stack): never
       `row-reverse` (BVJ, 2026-11-07). The list measures its own left edge (on load, resize,
       `desk:column-moved`, the Display tray's size, face and text width, and
       fonts loading) and sets `data-desk-fn-pills`: **`row`** (both pills side
       by side, Pin nearest the footnote and "Add a note" outside it (BVJ,
       2026-11-06), right-aligned
       14px from the footnote, level with its first
       line, nothing grows), **`more`** (one "⋯" disclosure button there,
       `aria-expanded`, that opens Pin and "Add a note" stacked under it; Escape, a
       click elsewhere or focus leaving closes it, and choosing either returns
       focus to the "⋯"), or **`inline`** (the pre-E49 placement on the note's
       line). The thresholds use the pills' measured widths: `row` needs the
       two pills and the 4px gap plus 14px and an 8px window edge; `more`
       needs the wider pill plus the same 14 and 8 (about 118px and 78px in
       Inter; OpenDyslexic needs more). **A footnote with one of the reader's
       margin notes beside it takes `inline`** whatever the list's mode:
       `notes-margin.js` sets `data-desk-fn-margin` on it, because the margin
       notes (full or circles) are in the same left margin, level with the
       footnote. Print hides the pills as before. Code that restores focus to
       a pill must use `pillsHome(button)`, since a pill behind a closed "⋯" is
       hidden, and a change that moves a footnote between "⋯" and inline (the
       margin note's mark) runs inside `keepPillFocus`; the popover's own Pin and "Add a note" row, and /desk's panes, are
       unchanged. Read View has no footnotes, so it has none of this.
     - **N6 writes ordinary sheet parts**: `src/lib/desk-sheet-discussion.mjs`
       (pure, tested) turns the notes marked `question` on a sheet's
       passages into a heading and `question` modules, once; nothing links
       them back to the notes. The Sheet pane's "+ For discussion" adds them
       in one change.
