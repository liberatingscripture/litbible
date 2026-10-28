# The LIT Study Desk

The complete record of the Study Desk as planned so far: what it is, every idea
with its status, every decision BVJ has made and why, the audit and how each
finding was settled, the account and sync work planned with BDR, and the
related projects that came out of it. **Nothing is released to readers**;
phases 1a to 1d, 1f, 1h, 2a, 2b and 3b to 3k are built behind a preview switch ("Where things stand").
This file exists so a future session can pick the work up without the
conversations that produced it.

**Read this before proposing, designing or building any part of the desk.**
Many ideas here were weighed and decided, some were declined, and the reasons
are recorded so they aren't re-argued.

## Where things stand (as of 2026-10-20)

- **Full Audit 1 (10/20/2026)** audited everything built, at commit
  `82af6a6`, and found 87 problems (BA1 to BA87): 4 high, 24 medium and 59
  low. BA32 is declined by BVJ, and the other 86 are planned in 20 phases,
  FA1-a to FA1-t, each sized for one session on a Pro account. Two more
  phases are the next audit: FA1-u (the code this one didn't reach) and
  FA1-v (real devices). The plan,
  and every finding with its fix, is `STUDY-DESK-AUDIT-1.md`. In short, see
  "Full Audit 1 (10/20/2026)" below. FA1-a to FA1-f are done (#370,
  #371, #372, #373, #374, #375); FA1-c changed the merge's clamp
  rule and the merge vectors (version 2), and FA1-d how undo and redo write
  trash records (BA7). FA1-e made "My default" a layout without a passage
  (BVJ, BA53; "Decisions", 2026-10-26). FA1-f built rule e's two guards
  (anchor vectors version 2) and brought the format into line with the
  code; what the apps should pick up is in the 2026-10-26 note for BDR's
  Claude under "One notebook, three homes". FA1-u, the follow-up audit,
  is done (2026-10-26): 58 findings, BA88 to BA145 (14 medium, 44 low).
  Areas 1 to 3 are in FA1-w to FA1-z and in FA1-k, FA1-r and FA1-t; areas
  4 to 6 in FA1-aa to FA1-ad and FA1-i. FA1-ab, which BVJ moved ahead of
  FA1-g, is done (#378): a sheet's change is now planned over the record
  read in the same transaction as the write, so two tabs on one sheet keep
  each other's edits (BA129), and a save that fails puts the part back and
  says why (BA128). FA1-g is done (#379): a shared link opened in a tab
  already on /sheets/ is moved out of the address on `popstate` too
  (BA78), a shared file opens its last data line, folded or not, and
  says when one is damaged (BA80, BA87), a participant share leaves out
  parts of unknown types (BA81), and opening a share drops its
  comparison copies (BA82). What the apps should pick up is in the
  format's "Sharing a sheet." FA1-h is done (#380): Bookmark saves one per
  verse and Remove bookmark takes every one there (BA16), "Hide my notes"
  hides notes in a footnote's popover (BA17), going to a note with the
  notes hidden marks its words (BA19), a note on a footnote is named as
  one and listed when it cites its own verse (BA20), and a drag ending
  over a desk window no longer selects the rest of the chapter (BA23; two
  calls for BVJ in "Decisions", 2026-10-27). FA1-i is done (#381): a template's
  first passage lands under its reading heading and the instruction to
  add one is ghost text that never prints (BA69, BA70; BVJ's calls in
  "Decisions", 2026-10-27), adding a passage again says so where it was
  added (BA75), a footnote that uses a short blanked word such as "God" is
  flagged (BA76), the Class session template reads "the leader's copy"
  (BA77), and "+ Passage" checks its verses (BA127). FA1-j is done (#382): a paste
  or a drop from Google Docs, Word or a web page keeps its headings, lists,
  bold and italic, and Word's lists come back as lists (BA68, BA71, BA73),
  typing just before a tab closes is kept (BA72), and Ctrl+Z on the
  formatting toolbar undoes the typing rather than the saved text (BA74).
  FA1-k is done (#383): a broad construction search no longer freezes the
  tab, and a search joins at most four words (BA44); an English gloss
  holding a command word ("present time", "in order to") finds its word
  (BA45; BVJ's calls in "Decisions", 2026-10-27); ".gen" alone is any
  genitive (BA48); the readback gives each word's distance and says "then"
  only when the order is fixed (BA50); and the commands window closed
  mid-drag keeps its place (BA116). BA49 is accepted as it is.
  FA1-l is done (#387): the LIT pane keeps the verse at its reading line when the
  window or a split line changes its size (BA54), a chapter above that
  fails to load says so with Try again (BA56), the end of the New Testament
  reaches the reading line in a tall pane (BA57), a stored layout whose
  sizes overflow falls back to even sizes (BA58), `/desk/?sheet=` opens the
  sheet in a pane that isn't a LIT pane when there is no room for another
  column (BA60; with only LIT panes open, the last one gives way, as with
  four panes, which BVJ confirmed, 2026-10-27), and a narrow window squeezes the panes only while it is
  narrow, the reader's sizes kept and saved (BA61).
  FA1-m is done (#388): a tour cut short by a reload or a link leaves the
  Notebook as the reader had it, since the tour opens it without saving
  that (BA33); where the browser keeps no notebook, the panel no longer says
  where it is kept or asks where it should live, the tour leaves out the
  steps that need one, and "Print with my notes" isn't offered (BA34); a
  desk print whose dialog never opens is cleaned up at the reader's next
  move, and the two prints run one at a time (BA35); a tour restarted
  within a second keeps its guard (BA36); and the tour won't start over a
  note being written (BA37).
  FA1-n is done (#390): present mode's keys keep working when the button that had
  focus is disabled or hidden, the stage taking focus first (BA79); a link
  on the white paper preview gets a ring that shows in dark theme (BA83);
  the presenter view stops saying no presentation is open once one opens,
  first or again (BA84); where the browser had to ask about the screens and
  then blocked the presenter view's window, it says to choose Presenter
  view again rather than blaming pop-ups (BA85; FA1-v checks it on two
  screens); and poetry on a sheet keeps its description (BA86).
  FA1-o is done (#391): making a note, a bookmark or a highlight is announced
  (“Note saved on Romans 8:3.”, “Bookmarked Romans 8:28.”, “Highlighted
  yellow: Romans 8:4–5.”), through the undo bar's live region (BA18); focus no
  longer drops to the page after a note is deleted from the margin, after a
  redraw replaces an open circle's popover trigger, or after saving a note made
  from a selection (BA21); and a bookmarked verse's number is named “Verse 28,
  bookmarked” (BA22; BVJ chose that wording over placing it last or “has a
  bookmark”, 2026-10-27).
  FA1-p is done (#392): Escape in the Notebook works while the tour offer
  or the Greek commands window is open (BA24); beside a floating Notebook
  dragged wide, a panel that would get under 300px lies over the Notebook
  instead (BA27); and a touch selection's panel keeps clear of the Notebook,
  as does a panel already open when the Notebook expands, which moves aside
  rather than closing (BA28).
  FA1-q is done (#396): an Android tablet in desktop site mode no longer
  gets the desk (BA26); a chapter opening with the notebook expanded in a
  window too narrow for it no longer reflows from 48 to 52 (BA25), and widths
  dragged in a wider window open given way to what fits rather than off
  center (BA30), since the pre-paint script now works out what the first
  placement will decide; and where the desk fails to load or start, the page
  goes back to the reader's, with one failing Notebook tab no longer taking
  the others down (BA29).
  FA1-r is done (#398): two My Notes panes keep their own color and label
  filters, and a closed pane, or one moved to another chapter, takes its
  listeners with it (BA31, BA115); "Leading" names My Notes among the panes
  that follow (BA62); the Layout menu closes when focus leaves it (BA63);
  scrolling past the Acts stub tells the other panes a chapter only once the
  reader stops on it (BA64); a fetched chapter keeps only its text, footnotes
  and Go deeper (BA65); and the Greek commands window on /desk sits beside
  its pane and closes with it (BA114).
  FA1-s is done (#PR): each group of Greek search results credits its
  sources in a line under it, with the Greek tab's names and links (BA46);
  the Greek's license note says the search index carries STEPBible's brief
  glosses for most lemmas (BA47); and a Greek search lists the reader's
  matching notes, where a final σ now matches ς (BA40, BVJ's call).
  Next: FA1-t (Copy and docs).

- **Phase 2c is built on the preview** (2026-10-20): notes on a footnote
  and questions for discussion. **A note can be on a footnote** (M11):
  "Add a note" beside Pin in a footnote's popover, in Study View's
  Footnotes list, in the Notebook's "This verse" tab and in /desk's
  Footnotes pane. The note names its footnote as a pin does (its verse and
  its words, never its letter), sits in the margin beside the footnote at
  the foot of the page, is listed under the footnote wherever the footnote
  is shown, and carries the change notice when the footnote is rewritten.
  **A sheet gathers your questions** (N6): "+ For discussion" in the Sheet
  pane adds a "For discussion" heading and one question per note marked
  with the question marker on the sheet's passages, in passage order, as
  ordinary parts to edit, move or delete. Smaller calls for BVJ to judge
  are in the decision log, "Phase 2c". Phase 2 is done. 3l, popping the
  notebook out, has since moved to version 2 (BVJ, 2026-10-21), so phase 3
  is done too.

- **Phase 2b is built on the preview** (2026-10-20): a sheet's text checked
  before printing, and printing with room to write. **A passage whose
  wording changed since it was added says so** (S2): in the Sheet pane, with
  the words that moved struck through and underlined, the release note when
  one names the verses, and **Keep the new wording**; and above the paper on
  the sheet's own page, before it is printed (screen only, since the copy
  prints today's wording either way). **Each copy's foot names the day its
  text is from** ("Text as of October 20, 2026"). **Print with room to
  write** (N9) is a second button under "Print with my notes", and a
  command: the chapter or the book in a narrower column beside a ruled
  margin, like a journaling Bible, needing no notebook. Smaller calls for
  BVJ to judge are in the decision log, "Phase 2b". Next: 3l, popping the
  notebook out, then 2c.

- **Phase 3k is built on the preview** (2026-10-20): getting started and
  sharing. **New sheet offers templates** (M9): Bible study, Sermon
  preparation, Class session, Lectio divina (read, reflect, pray, rest) and
  the Blank canvas, which has had the full formatting set since 3f; a new
  part now goes after the part last worked in, so a passage lands where the
  reader is. **A sheet from a search or a topic** (M5): on /search, "Make a
  sheet of these verses" (every result, or the ones ticked) and "Make a
  sheet of these chapters" for a topic, as a new sheet or added to one, in
  Bible order with neighboring verses joined; "Open it on the Study Desk"
  goes to `/desk/?sheet=<id>`. **Sharing** (S8): **Share…** on a sheet's
  page makes a link, `/sheets/#share1.<data>`, holding the whole sheet (or
  only what the participant copy prints), with a code to scan when the link
  is short, or saves a `.lit-sheet.md` file; "Open a shared file" on
  /sheets/ opens one. The page moves the `#` part out of the address before
  Cloudflare's analytics beacon runs, which the network log confirms. A
  shared sheet shows read only with **Copy into my desk**; a phone or tablet
  is told to open the link on a computer. Smaller calls for BVJ to judge are
  in the decision log, "Phase 3k". Next: 3l, popping the notebook out.

- **Phase 3j is built on the preview** (2026-10-20): present mode. A sheet's
  page has **Present**, and the Sheet pane has "Present…". The room sees the
  sheet full screen, dark in either theme, one part at a time: a first
  screen with the sheet's name and **a code per chapter to follow along**
  (M3), then each passage, question, text and the key terms box, the type
  as large as the screen allows. **The reveal** (S6) uses the sheet's
  blanks: a key term blanked with its traditional word shows that word
  until R reveals the LIT's rendering, and F puts the passage's footnotes
  up, a footnote that gives a blank away waiting until it is revealed.
  **The presenter view** (M2) is a second window with what the room sees,
  what comes next, the answers and the parts marked Leader only, and a
  clock; in Chrome and Edge with a second screen attached, the presentation
  moves to that screen by itself. Smaller calls for BVJ to judge are in the
  decision log, "Phase 3j". Next: 3k, getting started and sharing.

- **Phase 3i is built on the preview** (2026-10-20): a sheet on paper. A
  sheet's own address, `/sheets/?id=…` (opened from the Sheet pane's "Print
  or copy…", with `/sheets/` listing them all), shows it as a **leader copy**
  (every part, the blanks' answers and the questions' answers) or a
  **participant copy** (no Leader only parts, a line with its hint for each
  blank, lines to write on), on **US Letter or A4**, with **a code per
  chapter** that opens the passage in the app or on the site, and the LIT's
  notice and the chapters' addresses at the foot. **Print** prints it, and
  **Copy for Word** copies it with its formatting. **Printing a chapter or a
  whole book with your notes and highlights** (M6) is a button in the
  Notebook panel. Smaller calls for BVJ to judge are in the decision log,
  "Phase 3i". Next: 3j, present mode.

- **Phase 3h is built on the preview** (2026-10-19): a sheet now knows
  about the LIT. Each passage on a sheet has its blanks (select words and
  "Blank the selected words", or one click on a key term, with "traditionally
  sin" as the hint) and a footnote picker ("Footnotes: 3 of 4 print", Select
  all and Unselect all) that flags any footnote giving a blank away and
  leaves it out until the leader decides. The key terms box fills itself in
  from the sheet's passages, and every sheet ends with its license card, whose
  "This is for a commercial project" box turns on the commercial check.
  Smaller calls for BVJ to judge are in the decision log, "Phase 3h". Next:
  3i, paper and copies.

- **Phase 3g is built on the preview** (2026-10-19): in the LIT pane on
  `/desk/` the reader can highlight from the verse menu and a selection, and
  their highlights are drawn there (in every pane showing the chapter), with
  each verse number named for them as on Study View; footnotes can be pinned
  from the LIT pane's popover, This verse and the Footnotes pane. **Notes
  don't sit beside the pane's text** (BVJ, from the "LIT Pane Notes" mock):
  the My Notes pane keeps its list and follows the LIT pane, scrolling so the
  records on the passage being read are in view. Smaller calls for BVJ to
  judge are in the decision log, "Phase 3g". Next: 3h, what a sheet knows
  about the LIT.

- **Phase 3f is built on the preview** (2026-10-19): the LIT pane on
  `/desk/` has Study View's verse menu and selection panel, with their copy
  actions and the "My Notebook" row, and the Sheet pane is the sheet
  editor: a list of sheets, a title and subtitle, passages added from the
  verse menu, a selection, a typed reference or the notebook, your own
  formatted text, questions, space to write and page breaks between them,
  dragged into order, saved as you go. Smaller calls for BVJ to judge are
  in the decision log, "Phase 3f". Next: 3g, the reader's marks on /desk.

- **Phase 3e is built on the preview** (2026-10-19): the LIT pane scrolls
  the whole New Testament on `/desk/`, a chapter at a time, with drafts as
  one stub per run, footnote letters that open their own chapter's note,
  and key terms underlined; a Footnotes pane lists the chapter's notes with
  the reader's verse marked. This verse, Greek and Footnotes now follow the
  LIT pane last worked in. Smaller calls for BVJ to judge are in the
  decision log, "Phase 3e". Next: 3f, the sheet editor, which starts with
  the verse menu and selection panel in the LIT pane; the reader's marks
  and pinned footnotes on /desk are a new part, 3g (BVJ, 2026-10-19).

- **Phase 3d is built on the preview** (2026-10-19): This verse (with
  "This chapter", the chapter's Go deeper, at its foot), Greek, and What
  I've kept are panes on `/desk/`, mounted from the Notebook's own modules.
  Until the LIT pane comes (3e), the panes that aren't pinned share one
  passage, chosen with a picker at their top (BVJ, option A). Smaller calls
  for BVJ to judge are in the decision log, "Phase 3d". Next: 3e, then 3f.

- **Phase 3c is built on the preview** (2026-10-19): `/desk/` with the
  Layout menu, dragging to split, movable lines, several panes of a kind,
  Stay here, and a remembered layout with a default and a reset. My Notes
  is the one pane that draws; the rest come with 3d to 3f. Smaller calls
  for BVJ to judge are in the decision log, "Phase 3c". Next, as
  suggested: 3f and 3d.

- **Phase 3a is decided** (BVJ, 2026-10-18, from the mockups): /desk's
  layouts come from a Layout menu, with dragging a pane to split another
  included too; every arrangement mocked except four rows. Shared links,
  present mode and printing keep `/sheets/`. Go deeper is a "This chapter"
  section at the foot of This verse. A formatted document is part of
  sheets: templates built from modules, plus a blank-canvas template with
  full rich-text formatting. The LIT pane scrolls the whole corpus, with no
  setting. Several panes of one kind may be open, and This verse, Greek
  and Footnotes follow the LIT pane last worked in, unless pinned. Only
  the exact rich-text set was left for 3b, the sheet format, **approved
  2026-10-18** with the rich-text set plus text alignment and named styles (decision log,
  "Phase 3b").

- **Phase 5 is fixes and experience** (BVJ, 2026-10-16): a running log of
  bugs and of what using the desk is like, BVJ's own use first, under
  "Fixes and experience" (IDs E1 onward). It never waits for phases 3 and 4.
  Open from BVJ's use so far: Places (E4), and the Greek search commands,
  where putting a search together isn't intuitive (E5; BVJ wants to try a
  menu-based builder) and a word family can't be searched (E6), and
  whether the Notebook's Greek tab should search at all (E7). **Decided
  2026-10-21** (E8): there is no way into /desk, and **Read View is
  removed at the desk's launch**, its button on a computer becoming the
  way into the desk. **Decided 2026-10-22** (E9, which takes up E4):
  **bookmarks and ribbons become one feature, Bookmarks**, and the Places
  section goes. It changes the record format, so **BDR's Claude should
  read E9 and "2026-10-22 (Bookmarks and ribbons become one)" before
  syncing places or bookmarks**.

- **Phase 3 is now sheets and the desk together** (BVJ, 2026-10-15): D9,
  the desk as a page of its own (`/desk/`), with the LIT text as one pane
  among up to four. Sheets are edited only there; a sheet's own address
  serves shared links, present mode and printing. **Phases 2b and 2c
  follow phase 3**, and phase 3's scope isn't cut to make a date. BVJ's
  answers are under D9 ("Across the desk"); the details are for when the
  work starts, with mockups then. **Split into parts 3a to 3l**
  (proposed 2026-10-18, "Order of work", 3), to be worked one at a time.
  3l (D4) moved to version 2 on 2026-10-21. **3m, a search pane, was
  added the same day** (BVJ), since /desk's own header has no search box.

- **The tour is offered in a window beside the Notebook** (BVJ,
  2026-10-14), the first time it is expanded, with "Take the tour now,"
  "Remind me later," and "Don't show this again" (decision log, 2026-10-14,
  "The tour offer"). Built on the preview the same day.

- **Phase 2a is built on the preview, and M10 is shelved** (2026-10-15).
  What's new for you (B3) and your own chains (N4) are in the tree; your
  notebook where you already look (M10) was built the same day and then
  shelved by BVJ, its code kept on `claude/desk-2a-m10`. **Construction
  search and searching by parsing**, 2a's larger part, are built on
  `claude/desk-2a-construction`: Greek search commands on /search, the
  tray and the Greek tab, with a "Search commands" window that lists them
  (syntax settled by BVJ on a mockup, 2026-10-14; decision log, "Greek
  search commands"). Defaults for BVJ to judge are under "Still open"
  ("Phase 2a's defaults"); "Order of work", 2a, has what was built.

- **Phase 2 is 2a, 2b and 2c** (split BVJ, 2026-10-14;
  N2, H2 with C23, M4 and M10 shelved for version 2, BVJ, 2026-10-15).
  2a is B3, N4, construction search and searching by parsing, the
  read-only pieces; 2b is S2, which needs sheets, and N9; 2c is M11, notes on a
  footnote, and N6 ("Order of work", 2; "Decisions").

- **Sync now has three plans, and BDR's proposal is the newest record of
  it** ("One notebook, three homes" below; first read 2026-10-07 at draft 2,
  read again 2026-10-09 at draft 4d). Plan B splits into B
  (full accounts with passwords) and **C (a thin LIT service, end-to-end
  encrypted, signed into with Apple, Google or a passkey)**. The proposal
  recommends C; BDR is torn between A and C and would lean A if it can be
  shown to work. **The spikes that would test plan A are paused** (BDR,
  2026-10-09), so the Zoom between BVJ and BDR now decides whether A is
  tested at all; the October 31 date holds only if they resume. The Zoom's
  list has grown to seventeen items. **BVJ clearly prefers launching C** (2026-10-07, firmer after
  the sizing; a preference, not an insistence or a decision), with "don't
  sign in" as the keep-it-in-your-own-cloud option (iCloud on Apple devices,
  as today) and full A added later only if readers ask; the website's side
  of each plan is sized in that section. Nothing is decided.

- **Status: phases 1a to 1d and 1f built, behind a preview switch; nothing
  reader-facing yet.** Readers see and download none of it.
  `litbible.net/?desk=on` turns the desk on in one browser on a computer, and
  `?desk=off` turns it off. The only desk pages are `/notebook/` and
  `/notebook/help/` (noindex, and empty for anyone without the preview);
  no service exists. 1c's parts that
  wait on nobody are built (notes, bookmarks, the margin, the panel's tabs and
  "This verse", M1, the draggable widths, and N11 provisionally), and so
  are highlights (2026-10-09), as soon as BDR's answers to rules a to e
  settled the overlap rule, the change notice (2026-10-10), and pinned
  footnotes and the merge engine (2026-10-12), which finished 1c and 1a.
  **1d was built on 2026-10-12** (the notebook page, labels, save and open a
  copy, places and ribbons, search and commands, the
  first-time choice, the tour and the help page), except **N8, the hidden
  passage, which BVJ held until after the Zoom** (2026-10-12; "Decisions"),
  and **N7, the interleaf, which BVJ set aside** (2026-10-13; "Decisions").
  **1f, the Greek tab, was built on 2026-10-13** ("Order of work", 1f).
  Phase 1's built steps are done apart from N8's hold. **1h belongs
  to phase 1** (BVJ, 2026-10-13). 1g (an interleaf for the Greek) was
  explored the same day and is **shelved for the future**, so it is
  version 2; and **1h (searching the Greek) was built on 2026-10-13**, behind the preview
  ("Order of work", 1h, "Built"). **The desk is not released until phase 1 is
  completely done, and perhaps not until phases 1 to 3 are** (BVJ,
  2026-10-13). Other versions (API.bible and the Versions tab) are out of
  version 1 (BVJ, 2026-10-11). What exists:
  - draft 1 of the record format (`STUDY-DESK-FORMAT.md`), with its
    reference implementation (`scripts/lib/anchor-text.mjs`) and test vectors
    (PR #268);
  - phase 1a's foundations: the record kinds
    (`src/lib/desk-records.mjs`), the browser half of the anchor text
    (`src/lib/desk-anchor-dom.mjs`), the wording comparison
    (`src/lib/desk-wording.mjs`), the highlight overlap rule
    (`src/lib/desk-highlights.mjs`) and the merge engine
    (`src/lib/desk-merge.mjs`, with shared cases for the apps in
    `test/fixtures/merge-vectors.json`). See "Order of work", 1a;
  - phase 1b's shell: the gate, the notebook in IndexedDB kept in step across
    tabs, deletion with an undo bar (the trash record as BDR answered it,
    with `deletedKind` since 2026-10-12), and the Notebook panel in the right margin, floating where a
    window is too narrow for it. See "Order of
    work", 1b;
  - phase 1c: see "Order of work", 1c;
  - phase 1d: the notebook page and its help page, export and import,
    labels, places and ribbons, notebook search and commands,
    the first-time choice and the tour (all under "Order of work", 1d). The
    defaults chosen there are recommendations for BVJ to judge on the
    preview ("Still open").

  **The development phases were planned on 2026-10-05** ("Order of work"
  below). The format is frozen before anything syncs (BVJ, 2026-10-05).
  Until then phase 0 read "agree the record format before any code".
- **BDR answered the merge rules on 2026-10-09** (rules a to e, talk-through
  item 20). BVJ had held phase 1a's merge engine and the highlight overlap
  rule for BDR (2026-10-05), since both are format decisions all three
  clients must share. Four answers are as the website proposed (b2, c3, d1
  with its three details, e2 for both). **Rule a differs**: the newer writing
  wins for notes too, judged by the reader's own edit time on every store,
  where the website had kept both versions of a conflicting note. **BVJ
  went with BDR the same day**: the older version is discarded. So the merge
  rules are settled, and highlights, the change notice and the merge engine
  can all be built. See "BDR's answers and requests (2026-10-09)" and the
  website's answers above it, under "One notebook, three homes".
- **BDR asked the website for two new things** (2026-10-09): **pinned
  footnotes**, a tenth kind of record, which BVJ accepted for **phase 1c, by
  November**; and, under plan C, a **"Connect your phone"** code in the
  Notebook panel after sign-in, which belongs to the sync work.
- **BDR's scope in this repo is widened** (BVJ, 2026-10-09): his Claude
  drafts the encryption spec and its vectors here, and works on /apps,
  /privacy, encryption and app syncing freely, asking "are you sure?"
  anywhere else (`BDR-ONBOARDING.md`).
- **Both apps replied to the brief on 2026-10-04** (see "The apps' replies"
  below). BDR proposes that each reader's notebook stay in their own iCloud
  or Google account, with the website reaching it from the browser and **no
  LIT accounts or sync service**. That would replace most of "Accounts and
  sync". It's the first thing to decide (talk-through item 1), and three
  proofs come before it. BDR's goal is sync in both apps by **Ash Wednesday,
  February 10, 2027**.
- **BVJ answered on 2026-10-05** ("BVJ's answers" below):
  - Both plans stay open. A reader who wants neither Apple nor Google must
    keep a way in, and nobody may face silent sign-outs or lose work.
  - The apps' License screen wording is approved.
  - The website builds in its own order.
- **Sent back (2026-10-05):** one reply to both apps
  (`STUDY-DESK-REPLY-TO-APPS.md`) and draft 1 of the record format
  (`STUDY-DESK-FORMAT.md`). The format comes with a reference implementation
  (`scripts/lib/anchor-text.mjs`) and test vectors
  (`test/fixtures/anchor-vectors.json`).
- **Phase 0's two picks are made** (BVJ, 2026-10-05): the reading column
  narrows to **52**, and **Cardo** is the serif for Greek and Hebrew. See
  "Decisions", 2026-10-05 (phase 0 picks). **On Study View chapters it
  narrows further, to 48, while the notebook is open** (BVJ, 2026-10-08),
  to leave the panel room for the Greek tab ("Decisions", 2026-10-08).
- **The Notebook panel gets tabs** (2026-10-08): "My Notes", "This verse",
  and the SBLGNT beside the LIT (with parsing, two lexicons and its
  apparatus, ahead of the word-by-word alignment). The tabs are My Notes,
  This verse and Greek, and readers can drag the widths of their notes, the
  LIT and the notebook. Folded into phase 1: the tabs and "This verse" in
  1c, the Greek as 1f. **Other versions (the KJV, OEB, WEB, CSB, NASB 2020
  and NIV, with a Versions tab) were planned for the first release and are
  deferred indefinitely** (BVJ, 2026-10-11). See "Decisions", 2026-10-08 (the
  Greek tab) and 2026-10-11 (other versions deferred), and "Order of work".
- **Three companion pages on claude.ai**, made while planning:
  - **The plan**, https://claude.ai/artifact/8Eyhmzd1xGTUPrjkwwSUqp (version 12,
    2026-10-02; shared with anyone who has the link). It has mockups this file
    can only describe. This file carries all of its content and decisions.
  - **The audit**, https://claude.ai/artifact/81jSLsvnsfq9gptpp7wJmX (version
    2, 2026-10-01; private to BVJ). Its findings and BVJ's answers are all in
    "The audit" below.
  - **Phase 0's comparison**, https://claude.ai/artifact/1PrmCppcMCdnF6wnvD1UvM
    (version 1, 2026-10-05; private to BVJ). Real screenshots of Romans 8 at
    each candidate measure, and the Greek and Hebrew faces side by side. The
    measurements it rests on are under "Decisions", 2026-10-05 (phase 0
    picks).
  If either page and this file disagree, **this file is the newer record**,
  unless a page's version is later than the date above. Keep this file current
  rather than the pages (see "Keeping this file current" at the end).
- **A brief for BDR's Claude** is `STUDY-DESK-BRIEF-FOR-BDR.md`, written
  2026-10-01 (revised 2026-10-02) for BVJ to send to BDR. It is summarized
  under "The brief for BDR" below, including the draft record format it
  proposes.
- **Repo work already done because of the planning:**
  - The license on /read was loosened (PR #248, 2026-10-01); see "License".
  - /read now opens its license disclosure when a link names it (PR #250).
  - Nine footnote quote-mark typos found while planning were fixed
    (`bf27a4a`).
  - Three related projects went into FIXLIST (PR #253): LIT previews on other
    websites, reading plans, and footnotes sorted by kind.
  - BVJ had asked (2026-10-01) that no pull request open until they confirmed
    the new license wording. That hold ended when BVJ deployed it (#248).

## Names and IDs

- The feature is the **LIT Study Desk**. Inside it, readers see three names
  (BVJ, 2026-09-30): **Notebook** (everything a reader keeps), **Places**
  (where they are reading) and **Sheets** (passages gathered for other
  people).
- On computers, where readers now have notes of their own, the verse menu's
  and selection panel's **"Copy with notes" becomes "Copy with footnotes"**,
  in both panels (decision 3, audit C26). **Shipped 2026-10-14 for every
  reader, phones included** (BVJ): the label is the same everywhere, and
  CLAUDE.md's "One set of actions, two ways in" and "Printing and handouts"
  say so.
- **Idea IDs**: N notes, B places and bookmarks, H highlights, S sheets, D the
  desk as a whole. Ideas the audit added keep their **M** numbers. Audit
  findings are **C1 to C27**. Entries in the fixes-and-experience log are
  **E1** onward. Full Audit 1's findings are **BA1 to BA87**, worked in
  phases **FA1-a to FA1-v** (`STUDY-DESK-AUDIT-1.md`); its follow-up audit
  (FA1-u, FA1-v) numbers what it finds BA88 onward. BVJ cites these IDs,
  so keep them stable; never renumber.
- **People**: BVJ is the owner (Brandon). BDR is the developer of the iOS and
  Android apps and collaborates on accounts and sync. BDR's own documents
  call BDR "Brandon"; this file always says BDR or BVJ.

## Origin

On 2026-09-30 BVJ asked whether an idea first pitched for the apps could work
on the website: "Source sheets without accounts. Sefaria's best idea, adapted:
let a user assemble passages plus their own notes into a sheet and export it as
PDF or Markdown, entirely on device. Bible study leaders, the spiritual
directors in your LSC directory, and seminary instructors would use this
weekly, and it gives you a community feature without you having to run a
social network or hold anyone's data."

That grew into reader notes, then a whole desk: notes, bookmarks, highlights
and sheets, explored creatively against how other sites do it, including
whether the existing menus are enough, whether a new menu is needed, or
something else entirely.

## Ground rules (owner decisions)

1. **Desktop only** (BVJ, 2026-09-30). Phones and tablets use the free apps.
   "The apps are free btw, so there's no such thing as 'giving it away for
   free' by having it on the website." Overlap with the apps is therefore not
   a cost; the only question is what's useful at a desk.
   - The gate is `isAppPlatform()` in `src/scripts/announcement-gate.js`, the
     OS test behind "Make an image" and the app QR code. It treats an iPad
     reporting itself as a Mac as an app platform. The notebook's code loads
     through a dynamic import on computers only, so phones and tablets
     download none of it.
   - **Exception (audit C1): account pages work on every device.** Sign-in,
     verification, password reset, account settings and deletion must work
     on phones (Google Play requires a web deletion page, and people open
     reset emails on phones). Gate the notebook, not the account.
2. **No account is the default, forever.** Everything works without one. An
   optional account adds sync (see "Accounts and sync").
3. **Your words never look like the translation.** On screen, on paper and in
   every export, the reader's text is set apart from LIT text. The reader's
   words use an indigo color (the plan's `--mine`), never the site's green.
   This also keeps sheets inside the license, which asks that the text be
   quoted as written.
4. **Blanks, never substitutions.** A handout may leave the LIT's words blank
   for participants to fill in, as long as the answer is the LIT's own word.
   It never prints other words in their place.
5. **The apps' contract doesn't change** through phase 3: no change to chapter
   JSON, `/api/`, the glossary feed or anything else the apps read. Accounts
   add a separate service outside `/api/`.
6. **Study View vs Read View** (CLAUDE.md's rule): Read View gets what serves
   reading a book straight through; tools about a verse or a word go in Study
   View. The desk follows it: notes are a Study View tool, and Read View gets
   a smaller set (decision 2, audit C2).
7. **Quiet controls** and the site's other existing rules apply: keyboard
   shortcuts never use Ctrl, Alt or Cmd; every page keeps exactly one way in
   to search; announcements never appear over scripture.

## What desktop-only changes

Several limits that came from phones fall away at a desk:
- **The phone row rule stops applying.** A mouse or the keyboard opens the
  verse menu as rows, never chips, so new actions don't have to share a row
  on a phone screen.
- **Hover is available.** The term lens already opens on hover; the margin
  can offer a quiet "+" the same way.
- **The margins are empty.** The reading column is about 681px at the default
  text size, so a 1,280px window leaves about 300px a side. X11 would have put
  footnotes in the right margin and was declined, so both margins are free
  today, and narrowing the column at launch leaves more.
- **Files, printers and projectors are here.** Chrome and Edge can save
  straight into a file the reader picks.
- **The gate already exists** (`isAppPlatform()`).
- **The apps are free, so overlap costs nothing.**

## Where to start (the plan's recommendation)

The plan's first ordering, kept as written. "Order of work" below is the
detailed version (2026-10-05).

1. The notebook itself, in the menus, the margin, the panel and the search
   box: all four placements with N1. Everything else builds on it.
2. Keep it safe in the reader's own file: D1. Browser storage alone can
   vanish.
3. Notes that notice the translation moved, and "What's new for you": N3 and
   B3. The LIT changes weekly, and the data is already in the release notes.
4. What only the LIT can offer: N2 and H2, from the reviewed alignment
   (both shelved for version 2, BVJ, 2026-10-15).
5. Sheets built on the translation's own data: S1, S3, S4 and S10.
6. One quick win needing no storage: N9.

## The shape: one notebook, four verbs

Each verb happens on the reading page, and everything a reader makes lands in
one notebook, leaving it only by the reader's choice.

- **Keep a place** (Places). Where you are reading. One exists already
  ("Continue reading", `lit_last_read`), and Read View keeps another for every
  book (`lit_rm_resume_<book>`).
- **Mark words** (Highlights). Words you mark, in colors whose meaning you
  name.
- **Write a note** (Notes). Your words, attached to a verse or a range and
  sometimes a phrase, always dated.
- **Gather passages** (Sheets). Passages in an order you choose, with your own
  text between them, made for other people.
- Bookmarks: verses to come back to, each with an optional label.

The notebook is kept in this browser, in the reader's own file if they choose
one (D1), and in their account if they sign in. It is searchable from the
site's search (D2).

**Out, only when asked**: print a leader or participant copy, present on a
projector, Markdown or a copy for Word, a link or a file, and a printed code
that opens the app on a phone. Nothing leaves the computer unless the reader
prints, exports, shares or signs in to sync.

## Where it lives: four placements, all decided in

BVJ asked whether the current menus suffice, whether a new menu is needed, or
something else. The plan mocked four placements on Romans 8 at 1,200px.
**Decided 2026-10-01: all four.** The menus are for doing, the margin for
seeing, the panel for finding, and commands in search for people who prepare
every week.

1. **The current menus.** "Add a note", four highlight colors, "Bookmark" and
   "Add to a sheet…" join the verse menu under a "Yours" heading (named "My
   Notebook" when built: BVJ, 2026-10-09) (shortcuts N
   and B were mocked), and the selection panel gets the same four in Study
   View. A verse with a note gets a small dot on its number, and the menu
   shows the note at the top. **In Read View the selection panel offers only
   "Bookmark" and "Add to a sheet", plus "Highlight" only when Read View's
   highlights are switched on** (audit C2; Add a note is left out). Gains:
   nothing new to find, and the keyboard and screen-reader route already
   exists. Costs: notes stay hidden until a menu opens, and the menu grows
   from four actions to eight.
2. **Your margin.** What you've written appears in the left margin beside its
   verse, like pencil in a printed Bible. Hovering a line shows a "+" to start
   a note (no tab stop, like the term lens). The right margin stays empty.
   It needs about **230px of free space** beside the column, decided by the
   space left, not the window width; otherwise it falls back to dots and the
   panel (audit C9). The apps already mark notes in the left margin.
   - **The reader chooses whether the margin shows notes** (BVJ,
     2026-10-07): a switch, **shown or hidden**, shown by default. Dots are
     not a setting: they are what "shown" becomes where there isn't room.
     The margin and the Notebook panel do different jobs and can both show
     at once: the margin puts each note beside its words, and the panel
     lists them. **A note in the panel takes the reader to its place on the
     page.** This replaced the 2026-10-06 recommendation to empty the margin
     while the panel is open. How the margin looks and behaves is under
     "Decisions", 2026-10-07 (the margin switch).
   - **About X11**: the feature audit's X11 (footnotes in the margin on wide
     screens) was declined on 2026-09-28. BVJ confirmed (2026-10-01) that the
     reason for declining it doesn't rule out the reader's own notes in the
     margin. The reason itself was never recorded, and BVJ doesn't recall it,
     so don't cite it.
3. **A notebook panel.** A Notebook button beside "Aa" opens a panel on the
   right that stays open while you read: this chapter's notes, places,
   sheets, everything, search, and (N10) "This verse". **It fills the right
   margin beside the text, and the text stays put** (BVJ, 2026-10-06; the
   plan first had the text move left to make room, and the first build moved
   the whole page). It is part of the page frame, not one of the shared floating
   panels: floating panels (verse menu, footnote popovers, term lens,
   selection panel) keep clear of it, and clicks inside it don't close them
   (audit C12). Mock: tabs "Romans 8 / Places / Sheets / Everything / Search",
   with "Kept in this browser · Keep it in a file…" at its foot.
4. **Commands in search.** The search box "/" already opens also takes
   commands: "note 8:28", "mark pistis", "add to Thursday", listed above the
   results in "Do" and "Go to" groups. It reuses the existing reference
   parser, so "jn 3.16" works. **No Ctrl K** (audit C11): the site never
   overrides a browser shortcut (Ctrl K is Chrome's and Firefox's web
   search), and every page keeps one way in to search.

**Three answers that aren't a menu**, all in the plan too:
- **A page of its own**: a notebook page with filters by book, kind and
  label, search, and export. The panel's "Everything" tab opens it.
- **A file the reader owns** (D1): the notebook as a Markdown file they can
  open in Word, Obsidian or any text editor.
- **Paper** (N9): print any chapter with a ruled margin.

## The ideas (49)

"New" means no Bible site or tool was found doing it; "Borrowed" names the
source. Sizes run extra small to large. Status is BVJ's decision where one was
made; "proposed" means it's in the plan without a separate decision (the
plan as a whole was accepted; nothing was declined except where stated).

### Notes

- **N1. Notes in your margin.** Placement 2 above. Each note sits level with
  the first word it was made on, led by its marker glyph; without ~230px of
  free space (C9) it falls back to the glyph alone in a small circle, which
  opens the note like a footnote. Notes sit outside the scripture's reading
  order, linked from the verse (C24). Borrowed (Edwards's Blank Bible, the
  LIT apps). Medium. **Decided: the margin is in**, and it shows while the
  Notebook panel is open (2026-10-07; see "Decisions", 2026-10-07 (the
  margin switch)).
- **N2. Notes that follow a word.** Write a note on a glossary term once and
  it appears in the term lens card wherever that term is marked, about 4,300
  places across published chapters. A note on *sarx* shows under
  "self-preservation" in Romans 8 and under "family" in Mark 10:8. No Bible
  site attaches a reader's note to a translation's concept across all its
  renderings, because none has the reviewed alignment. New. Small to medium.
  **Shelved (BVJ, 2026-10-15): version 2.** Mock: the term lens card for "self-preservation" ("Traditionally
  flesh · Greek sarx", also rendered body 65, family 10, self-serving impulses
  8, flesh 7) with "Your note on sarx" and a "Mark sarx through Romans · 28"
  button.
- **N3. Notes that notice the translation moved.** Each note and highlight
  keeps a **copy of its verse as it read when made**. When a later publish
  changes the wording, the note says so and shows exactly what changed,
  compared against that copy with quotes, dashes and spaces evened out, so
  punctuation passes don't count (audit C3). The release notes supply the date
  and reason when they have an entry. A highlight whose words are gone falls
  back to the whole verse and offers to mark the new words. New. Medium.
  Proposed. Mock: a note on Romans 4:7 from Aug 14 ("'Gratified,' not
  'blessed'") flagged "Changed Sep 3, after you wrote this", with "Mark the
  new words" and "Release note".
  - Why the copy (C3): publishes logged in `release-notes-skip.md` produce no
    entry, entries truncate long passages with "…", and the August passes
    (439 straight quotes curled, 413 en dashes) changed no wording but would
    trip a plain fingerprint.
  - **Built on the preview 2026-10-10** as phase 1c's change notice, for
    notes and highlights in Study View ("Order of work", 1c), and its
    defaults approved by BVJ the same day. "Mark the new
    words" isn't built yet: a mark that fell back to its whole verse offers
    Keep there, or Delete.
- **N4. Your own chains.** A reference typed in a note becomes a link with a
  preview through the same linker the footnotes use (`linkScriptureRefs` is
  pure and can run in the browser), and the cited verse shows "Mentioned in
  your note on Romans 8:3–4." Borrowed (Thompson Chain-Reference, Obsidian).
  Medium. Proposed. **Built on the preview 2026-10-15** (phase 2a; "Order of
  work", 2a).
- **N5. A history with a passage.** Dated notes shown in order on a passage
  you keep returning to: "You first wrote here in March 2025." Suits spiritual
  direction. New. Small. Proposed.
- **N6. Questions as their own kind.** Mark a note as a question; a sheet
  gathers them into a "For discussion" section in passage order. Borrowed
  (Logos Sermon Builder). Extra small. Proposed. **Built on the preview
  2026-10-20** ("Order of work", 2c).
- **N7. The interleaf.** A Display tray switch that opens a ruled band after
  each paragraph holding your notes for it, like Edwards's blank leaves.
  Works in windows too narrow for the margin. **Bands open only when the
  reader asks**, so the page never jumps on load (audit C13; layout shift
  was the site's worst Core Web Vital until the `--ch` fix). New. Small.
  Proposed. **Built 2026-10-12, then set aside by BVJ (2026-10-13)**: "I
  think I'm not sold on the interleaf feature. It seems redundant to the
  notes in the notebook and in the left margin and breaks up the scripture
  text." Not in this release; see "Order of work", 1d, for where the code
  is and how to revive it. One observation, not a recommendation: the one
  argument for it that the margin doesn't cover was windows too narrow for
  the margin, where the notebook floats.
- **N8. A note to yourself before a hard passage.** A private note before a
  passage, with the passage **blurred** under it and one click (or Enter) to
  show it. **Decided 2026-10-01: blur, one click to show** (BVJ's idea,
  replacing "folded behind it": blurring keeps the passage's place and length
  visible, and nothing moves when shown). Two details proposed with it: screen
  readers get the same protection (the blurred verses are hidden from them
  too, announced as "Passage hidden by your note" with a Show button), and it
  works in both views, since Read View is where a reader meets a passage
  without warning. Different from the feature audit's X10 (declined), which
  would have been the translation speaking to everyone; here only the reader
  speaks, to themselves. New. Medium. Sensitive. The mock deliberately names
  no passage. **Built, then held by BVJ (2026-10-12) until after the Zoom
  (item 17); kept off this release on two branches**,
  `claude/desk-1d-hidden` and `claude/desk-1d-search`, with what's known
  for later under "Order of work", 1d. **Reviving it means rebasing
  `claude/desk-1d-hidden` (0c95d7d) onto main without the interleaf commit
  1f27b2e**, because 0c95d7d sits on top of that commit and edits
  `interleaf.js`; or reviving N7 too.
- **N9. Print with room to write.** A print option setting the text in a
  narrower column beside a wide ruled margin, like a journaling Bible. Stores
  nothing; a variant of `print.css`. Borrowed (journaling Bibles). Extra
  small. Can ship any time, independent of everything else.
  **Built on the preview 2026-10-20**: "Print with room to write," a button
  after "Print with my notes" in the My Notes foot and a command of the same
  name, on Study View chapters and in Read View; `desk/print-room.js`, the
  look at the end of `desk.css`. It needs no notebook, so it shows even where
  the browser keeps none.
- **N10. One verse, everything about it.** Borrowed from netbible.org, whose
  side panel follows the passage with the translation's notes and the
  reader's. **Decided 2026-10-02: one verse at a time.** A "This verse" tab in
  the Notebook panel shows the verse you picked (by its number or from the
  verse menu) with its footnotes and your notes on it, and stays put while you
  read on. It is also where other translations of that verse appear (D7). The
  footnote letters, popovers and end list stay as they are. Small. Phase 1.
  **BVJ, 2026-10-08: kept, and it gains the verse's Greek.** Since it now
  draws on every other tab, it would sit beside them as a tab of its own
  (recommended, not decided). See "Decisions", 2026-10-08 (the Greek tab).
  **Built on the preview 2026-10-08** as a tab of its own, with Previous and
  Next (BVJ) and without the versions for now ("Order of work", 1c).
- **N11. Notes on glossary entries and articles.** **BVJ, 2026-10-06:**
  readers should be able to attach notes to glossary entries and articles
  as well as to the scripture text. That covers both a note on an entry or
  article as a whole and a note on a passage within it, quoted the way a
  scripture note quotes its words. This is different from N2: N2's note
  belongs to a term and follows it through the translation, while this one
  belongs to the entry's or article's own text.
  - **Website only, at least for now.** The apps have no articles, and
    their glossary screens have nowhere to show a note, so neither app can
    show these unless BDR changes the apps to match. Until then the apps
    carry such records untouched (the format's principle 6), so a note
    written on the website survives a trip through either app's store.
  - **What it needs in the format:** two new targets for a `note`, beside
    its verses, a footnote (M11) and a glossary term (N2). A glossary entry
    is named by its id, which is already a stable key (CLAUDE.md, the
    `glossary` collection). An article is named by its slug, which is its
    file name, so renaming an article file would orphan its notes; that
    needs a rule (keep slugs fixed, or carry a redirect) before this
    ships. Quoting needs an anchor-text rule for text that has no verses.
    See `STUDY-DESK-FORMAT.md`, "Still open".
  - **The groundwork is in place.** Since 2026-10-06 the glossary has a
    reading column with the desk on, and both pages show the Notebook panel
    in the margin. Not yet placed in a phase: it needs 1c's marks first.
    New. Medium. **Decided: yes.** **Built provisionally on the preview
    2026-10-08** (BVJ: now rather than with format draft 2); see "Order of
    work", 1c.
- **M6. Print my annotated chapter or book.** A chapter, or a whole book from
  Read View, printed with your notes in the margin and highlights shown. N9
  is the blank version. New. Small. **Decided: yes.** **Built on the preview 2026-10-20** ("Order of work", 3i).
- **M11. Notes on a footnote.** A note attaches to a footnote by quoting its
  words, not its letter, so it survives relabeling; N3's notice applies when
  the footnote is rewritten. New. Medium. **Decided: yes.** **Built on the
  preview 2026-10-20** ("Order of work", 2c).

### Places and bookmarks

- **B1. Places, plural.** "Continue reading" and Read View's per-book places
  shown together, plus a few named ribbons ("Thursday group", "Morning
  reading"). **A ribbon moves while you read from it**: open a book through
  "Thursday group" and that ribbon follows you until you leave the book;
  otherwise only "Continue reading" moves (audit C25). Partly new. Small.
  Proposed. **Built on the preview 2026-10-12**: ribbons are `place`
  records with `ribbon: true`; "Continue reading" and Read View's places are
  shown beside them but stay in their own storage, not notebook records;
  the C25 rule is built ("Order of work", 1d).
- **B2. Bookmarks that remember why.** An optional label and how you got there
  (the search for "debt", the podcast episode, the Romans intro), so the list
  reads like a trail. New. Small. Proposed.
- **B3. What's new for you.** The release notes filtered to verses in your
  notebook ("Three changes since your last visit touch your verses"), using
  N3's comparison. New. Small. Proposed. The mock used three real changes:
  Romans 4:6–9 (Sep 3, "Gratified" → "How greatly fortunate"), Galatians 3:27
  (Aug 21, "submersed" → "immersed"), Romans 8:28 (Aug 3, "intention." →
  "intention, for what's beneficial."). **Built on the preview 2026-10-15**
  (phase 2a; "Order of work", 2a); run against the real feed, it finds those
  same three changes.
- **B4. Your marks beside the scrollbar.** In Read View, small ticks beside
  the scrollbar show your places, and your highlights when Read View's
  highlights are on. **No ticks for notes**, since Read View doesn't show them
  (audit C14, decided). Borrowed (code editors, Chrome's find bar). Small.

### Highlights and marks

- **H1. Your own legend.** **The legend is dropped (BVJ, 2026-10-07, with
  BDR): highlights are four colours with no names.** What stays from H1: the
  colours, kept away from the site's green; Read View's switch; the words
  for screen readers (the colour's name, "highlighted yellow"); and colours
  stored by the apps' names. (The second cue went too, 2026-10-09: a tint
  only.) As first planned: four
  colors, the same number as the apps, each with
  a meaning the reader names (promise, question, harm, liberation, anything).
  Lists and exports group by meaning. Colors stay well away from the site's
  selected-verse green. **Read View: highlights hidden by default**, with a
  new Display tray switch stored per view the way verse numbers are
  (decision 2); only then does Read View's selection panel offer Highlight
  (C2). Every highlight is announced in words ("Verse 3, highlighted as
  promise"), each color gets a second cue such as its own underline (C4,
  WCAG 1.4.1), and **colors are stored by the apps' own color names** so they
  match on every device (C8). Borrowed (inductive marking, Logos palettes).
  Small. **Decided: off in Read View by default.**
- **H2. Mark a concept through a book.** From the term lens card, mark every
  place a term appears in a book across all its renderings. *Pistis* in
  Galatians: 26 places (faithfulness 23, trust 2, allegiance 1); *sarx* in
  Romans: 28 (self-preservation 18, body 6, lineage 3, family 1). Reads only
  the records /glossary publishes (the alignment gate). **Saved as a rule**
  ("mark pistis in Galatians"), worked out from the gated data on each load,
  so marks follow newly reviewed records and new chapters (audit C23). New.
  Medium. **Shelved (BVJ, 2026-10-15): version 2.** Becomes exact once
  phase 2 of the alignment publishes.

### Sheets

- **S1. Sheets get their own page.** Add passages from the verse menu, a
  selection or the notebook; drag into order; write your own text between
  them. Saves on this computer as you type, like Sefaria's, with no account.
  Passages always come from the live text. Borrowed (Sefaria). Large.
  Proposed. Mock (`litbible.net/sheets/`): "Freedom and the Life-breath",
  Thursday group, toolbar "Present / Print ▾ / Copy for Word / Save as
  Markdown / Share…", per-passage controls "Blanks: deviation ▾" and
  "Footnotes: 5 of 5 ▾", "+ Passage / + Your text / + Question", and side
  cards for Key terms, License and Copies.
- **S2. Text as of a date, checked before printing.** A sheet shows the
  current text and the day it was checked, and flags a passage that changed
  after you added it, using N3's comparison. New. Small. Proposed.
  **Built on the preview 2026-10-20** ("Order of work", 2b).
- **S3. A key terms box, filled in for you.** Every glossary term in the
  sheet's passages with its traditional word and the Greek ("self-
  preservation, traditionally flesh, sarx"), printed as a box at the end.
  Only the LIT has the data. New. Small. Proposed.
- **S4. Leader and participant copies.** The leader's copy has every note,
  including private ones, and the answers to blanks. The participant's copy
  has the passages with their blanks, text marked to share, the questions,
  ruled space to write, the key terms box and a code per chapter. Printed
  sheets fit **US Letter or A4** (audit C27). The mocked participant copy
  ("Thursday group · October 2, 2026 · Participant copy") prints the leader's
  shared note, a QR code per chapter ("Scan to read Romans 8 in the LIT app";
  the mock's codes were real, for `litbible.net/romans-8/#v1-4` and
  `/galatians-5/#v13`), the key terms box with a line noting one term is left
  blank and its answer is on the leader's copy, a "For discussion" list, and
  at the foot `LIT_CREDIT_LINE` word for word plus each chapter's address
  ("litbible.net/romans-8 · litbible.net/galatians-5"). Borrowed (classroom
  handouts, Logos Sermon Builder). Medium. **Decided: blanks are in.** **Built on the preview 2026-10-20** ("Order of work", 3i).
- **S5. Printed codes that open the app.** Each chapter on a printed sheet
  carries a QR code: the app if installed, the website otherwise. The site's
  `apple-app-site-association` already claims every book's chapter addresses
  (`/<book>-*`) and `/glossary`; `assetlinks.json` uses `handle_all_urls`, and
  the Android app keeps its own path list, which is worth checking. The
  `qrcode-generator` library would move from a build-only devDependency to
  something the page loads (C21). New. Small. Proposed. **Built on the preview 2026-10-20** ("Order of work", 3i).
- **S6. Present mode, with a reveal.** Full screen, one passage at a time,
  large type, arrow keys, for a projector or a video call; a projector screen
  stays dark in either theme. An optional reveal (R) shows a key term's
  traditional word first, then the LIT's rendering and its footnote (F).
  The license lets a class, study group or sermon display any amount. New.
  Medium. **Decided: the reveal is in** (decision 6). **Built on the preview 2026-10-20** ("Order of work", 3j).
- **S7. A license check for commercial work.** An ordinary sheet shows no
  limits at all: it adds the credit line, keeps footnotes beside their verses
  and **links to the license terms**, and that's all. A checkbox, "This is for
  a commercial project", turns on the commercial-quotation check: how much of
  the work is LIT text against the 50% the terms allow, and whether the
  quotations amount to a complete book. BVJ's original instruction: "The
  meter should be absent or subtle and maybe only toggled on when someone
  checks a box for 'working on a project for commercial use?' or something
  like that." New. Small. **Decided: hidden unless commercial.**
- **S8. Share without a server.** A file (the Markdown export carries the
  sheet's data) or a link (the whole sheet after the #, which browsers never
  send to a server). Test first: a developer traced Cloudflare's analytics
  beacon reading the full address at start
  (https://github.com/jwh3times/magic-agenda/issues/295), so the sheet page
  clears the # part before the beacon runs; confirm in the network log. A
  references-only sheet fits a QR code. A shared link opened on a phone or
  tablet says to open it on a computer, and the address is chosen so the apps
  could claim it later. Signed-in readers get short links (M14). Borrowed
  technique. Medium. **Decided: computers only for now** (decision 4). **Built on the preview 2026-10-20** ("Order of work", 3k).
- **S9. Copy for Word and Google Docs.** A rich copy keeping headings,
  italics and the credit line, since most bulletins are built in Word.
  Sefaria's export needs a Google account; this needs nothing. Borrowed
  (Sefaria). Small. Proposed. **Built on the preview 2026-10-20** ("Order of work", 3i).
- **S10. Blanks where the key terms go.** A participant copy can leave any
  words blank, with answers on the leader's copy. The LIT-only kind: blank the
  translation's key terms and print the traditional word beneath as the hint
  ("traditionally sin" under a blank, then the LIT's "deviation"), the paper
  version of S6's reveal. Blanks are omissions, never substitutions; the
  license allows them for teaching. **The leader chooses which footnotes
  print**, passage by passage, with Select all and Unselect all, and the sheet
  **flags any footnote that would give a blank away**, leaving it unticked for
  the leader to decide (audit C15). The mock used Romans 5:6–10 with
  "deviating" blanked: footnote c ("Or 'people characterized by deviation' or
  'deviant ones.' Traditionally, 'sinners,'…") is flagged "Gives away the
  blank". New. Small. **Decided: blanks are in.**
- **S11. Footnotes sorted by kind.** Borrowed from NET Bible, which labels
  each note tn (translator's), sn (study) or tc (text-critical). LIT
  footnotes could carry a kind (wording, background, source text, quotation;
  categories BVJ's to choose) so the footnote picker prints one kind in a
  click, Study View filters, and the apps could too. Editorial work across
  5,000+ notes, and an optional field in chapter JSON the apps read. **Decided
  2026-10-02: maybe a later project, not part of the first launch; in FIXLIST
  to consider.** The desk doesn't depend on it. Large. Content, not code.
- **M2. A presenter view on two screens.** The passage on the projector, and a
  second window on the laptop with the leader's notes, questions and what
  comes next. Chrome and Edge can place a window on a second screen (Window
  Management API); elsewhere the leader drags it. The two windows stay in
  step like two tabs (BroadcastChannel). Borrowed (presentation software).
  Medium. **Decided: yes.** **Built on the preview 2026-10-20** ("Order of work", 3j).
- **M3. A code on the screen so the room can follow along.** Present mode's
  first screen shows S5's QR code. New. Extra small. **Decided: yes.** **Built on the preview 2026-10-20** ("Order of work", 3j).
- **M4. A word study in one click.** From the term lens or a /glossary entry,
  "Make a word study of sarx in Romans" builds a sheet of every gated place,
  grouped by rendering, with the key terms box and starter questions. Could
  take a Strong's number too once the Greek alignment publishes. New. Small to
  medium. **Decided yes, then shelved (BVJ, 2026-10-15): version 2.**
- **M5. A sheet from a search or a topic.** On /search, "Add these verses to a
  sheet" gathers the results (or ticked ones); a topic does the same with its
  chapters. Small. **Decided: yes.** **Built on the preview 2026-10-20** ("Order of work", 3k).
- **M9. Templates, including a contemplative one.** Bible study, sermon
  preparation, a class session, or lectio divina's four movements (read,
  reflect, pray, rest). Speaks to the spiritual directors named in the origin.
  Small. **Decided: yes.** **Built on the preview 2026-10-20** ("Order of work", 3k).
- **M14. Share links for signed-in readers.** A short read-only link that can
  be switched off and needs no account to open; replaces S8's long links for
  signed-in readers. Under end-to-end encryption the key travels after the #
  (C19). Medium. Phase 4. **Decided: yes.**

### Across the desk

- **D1. Bring your own sync.** In Chrome and Edge (File System Access API;
  Chrome 122+ offers "Allow on every visit"), the reader picks a file once,
  perhaps in OneDrive, Dropbox or iCloud Drive, and the notebook saves into it
  on every change; their cloud carries it to other computers with no account
  and no LIT server. Firefox and Safari can't write to a chosen file, so they
  get "Save a copy" and "Open a copy". The file is plain Markdown, and edits
  made elsewhere come back in as long as the headings stay as written. Rules:
  one source of truth at a time (C5, below); **a note missing from the file is
  unreadable, never deleted**, deleting happens in the notebook or through an
  explicit marker, and anything unparseable goes to a review list (C17). New.
  Medium. Proposed. **Built 2026-10-12: "Save a copy" and "Open a copy"
  only** (Markdown, Web Annotation and a full backup; "Order of work", 1d);
  saving live into a chosen file still waits on T3. The mocked file format:

  ```markdown
  # My LIT notebook
  <!-- lit-notebook 1 · saved 2026-09-30 12:04 -->

  ## Romans 8:3–4
  https://litbible.net/romans-8/#v3-4
  Note · 2026-09-12

  > rendered a verdict against deviation in
  > self-preservation

  Self-preservation as the drive to protect
  my standing. Compare Galatians 5:13.

  ## Romans 4:7
  https://litbible.net/romans-4/#v7
  Note · 2026-08-14 · verse changed 2026-09-03

  "Gratified," not "blessed": the relief of
  being let off, with nothing earned.

  ## Places
  - Thursday group: Luke 15:11
  - Morning reading: Mark 4
  ```

- **D2. Search your notebook from the site's search.** The search tray and
  /search add a "Your notebook" group, searched in the browser; nothing about
  the query leaves the computer. Borrowed (ESV.org, Logos). Small. Proposed.
  **Built on the preview 2026-10-12**, in the tray and on /search, reaching
  the desk only through `loadDeskSearch()`.
- **D3. Commands in the search box.** Placement 4. Borrowed (desktop
  software). Medium. **Decided: in the search box, no Ctrl K.** **Built on
  the preview 2026-10-12**: nine commands, `>` lists them.
- **D4. Pop the notebook out.** Document Picture-in-Picture (Chrome, Edge, and
  Firefox since 151) opens a small always-on-top window holding the notebook,
  beside the text or a video call. Safari can't, so it's an extra, never the
  only way. New, experimental. Small. Proposed. **Deferred to version 2**
  (BVJ, 2026-10-21; it was phase 3l), to be revisited then.
- **D5. Lock the notebook on a shared computer.** An optional passphrase
  encrypts the notebook in the browser, for church offices and family
  computers; a forgotten passphrase loses the notes for good, so it's opt-in
  and says so. The same kind of reader-held key is how synced notes could
  stay unreadable to the LIT, so **D5 is designed with the account's
  encryption and built in phase 4**; a locked notebook writes an encrypted
  file or pauses the file with a notice (audit C6). Borrowed technique.
  Medium. **Decided: an option** (BVJ: "D5 is good for an option").
- **D6. A first-time choice, and a page that explains it.** From BVJ's answer
  to C5. The first time someone uses the notebook it asks "Where should your
  notebook live?": keep it on this computer (no account; optionally also save
  to a file) or create an account, each saying plainly what it means,
  including what's lost if the browser is cleared. A page, **"Ways to keep
  your notebook"**, linked from the choice and from sign-up, explains every
  option and every way to sign in, and how to opt out or leave an account
  later while keeping everything on the computer. Before accounts exist, the
  choice offers the computer and the file and says accounts are coming.
  Safari readers hear that Safari can clear a notebook after a week without a
  visit (C18). In Firefox and Safari the file line becomes "Remind me to save
  a copy". Small. **Decided.** **Built on the preview 2026-10-12**, worded
  without accounts (the choice is "Keep it in this browser", with or
  without a reminder to save a copy), with the "Ways to keep your notebook"
  page at `/notebook/help/#ways-to-keep`.
- **D7. Compare a verse with other translations.** **DEFERRED
  INDEFINITELY (BVJ, 2026-10-11): API.bible and the whole idea of a tab
  showing other versions are out of version 1, including "This verse".** The
  notes below are kept as the record, not the plan. Borrowed from NET's
  "Parallel". Other translations appear side by side in N10's "This verse"
  tab. **BVJ, 2026-10-08: they also get a Versions tab of their own,
  and both are in the desk's first release, with the KJV, OEB, WEB, CSB,
  NASB 2020 and NIV**: a whole chapter, one version at a time, in its own
  paragraphs and scrolling on its own (BVJ, later the same day: it needn't
  line up with the LIT); "This verse" keeps them for one verse. Status, 2026-10-02:
  - **Decided: the KJV, stored on the site.** Public-domain text taken from
    eBible.org or library.bible and kept on litbible.net like the LIT's own,
    so it needs no key, no request and no tracking, and works even if API.bible
    is ruled out. It gives readers the traditional wording they know. (In the
    UK the KJV is still nominally under a Crown patent, which in practice
    doesn't stop websites showing it.) Maybe others later: the American
    Standard Version, the World English Bible or the Berean Standard Bible,
    all public domain.
  - **To consider: API.bible** (the American Bible Society's Scripture API)
    for licensed translations. **BVJ's picks: NASB 2020, CSB, NIV.** BVJ's
    API.bible dashboard offers the NIV 2011 (Biblica) and the CSB (Lifeway)
    at $0 a month, and lists the NASB 2020 (pick 2020, not 1995). Its terms as
    read 2026-10-02:
    - The free Starter plan: public-domain and Creative Commons Bibles plus up
      to three licensed ones, noncommercial only, 5,000 requests a month, and
      "no ads, fees, freemium models or upsells"; worth confirming the site's
      donation page doesn't count. More than three licensed translations
      would mean a paid plan (Pro from $29 a month; commercial licenses from
      $10 a month per translation; API.bible bars NIV commercial use).
      Whether a paid plan allows more licensed translations for
      noncommercial use is unconfirmed; ask.
    - **A tracking script (FUMS, its Fair Use Management System)** must load
      on pages showing licensed text: it reports views with a random device ID
      and session ID, plus a hashed user ID when signed in, and sets no cookies
      by its own account. The site deliberately doesn't measure who reads what
      (M12), so it would load only when a reader opens the comparison, and the
      privacy page would name it. Ask whether openly licensed Bibles need it.
      **Read on 2026-10-08** (`pkg.api.bible/fumsV3.min.js`): it keeps the
      device ID in localStorage (`fums.dId`, no expiry) and the session ID in
      sessionStorage (`fums.sId`, gone when the tab closes), sets no cookies,
      loads nothing else, and reports to `fums.api.bible/f3` with the
      passages' tokens and those two IDs (the browser adds its usual headers,
      address included). A user ID is sent only if the site supplies one,
      and this one has no accounts. Each token says which version and
      passage was shown, and may be reused for text served from a cache.
      Defaulting the tab to the KJV means it loads only when a reader picks a
      licensed version. BVJ, 2026-10-08: "probably" acceptable.
    - **API.bible's own terms, read 2026-10-08** (the Terms and Conditions
      and the Strictly Non-commercial Use Agreement, from BVJ's account).
      The non-commercial agreement fits the site: the Collective is a
      registered 501(c)(3), and donations are links in the nav and footer
      plus the /support page, which its "minor, non-intrusive links"
      exemption covers (revocable at API.bible's discretion). Kept that way,
      the site must never show a donation popover, banner or interstitial,
      and paid courses on litbible.net would end the free plan. The Terms
      raise more:
      - **§5.4**: no "potentially controversial use" of the content, naming
        "critical race theory" and "critical queer theory" as examples. A
        liberation and inclusion translation shown beside the licensed text
        may be read as exactly that, and §3.5 lets API.bible revoke access
        at any time for any reason. This is a values question for BVJ before
        it is a technical one.
      - **§12**: licensed text must not be "freely copied", with DRM that
        limits printing to 100 verses. So no copy or print of licensed text,
        unlike everything else on the site.
      - **§4.1**: no changes to "the structure or content". No longer a
        concern: BVJ dropped lining the versions up with the LIT the same
        day, so each keeps its own paragraphs.
      - **§9.5(e)**: no mirroring the API for others. Our Worker would have
        to answer only litbible.net's pages.
      - **§7**: a copyright page linked from every page that shows licensed
        text, citing and linking API.bible and each publisher.
      - **§26**: disputes go to Christian conciliation and binding
        arbitration in Philadelphia, not to court.
      - §9.2 bars AI training on the text, §11 requires refreshing stored
        text within 30 days, and §10 requires removal within 72 hours on
        request; the plan already meets these.
      **On the talk-through list as item 21**, to discuss with BDR.
      **Three ways forward** (2026-10-08, not decided): accept the terms
      after asking API.bible about §5.4 and §4.1 in writing; ask the
      publishers (Biblica, Holman, Lockman) for licenses directly; or ship the
      first release with the SBLGNT, KJV, OEB and WEB in the panel and the
      CSB, NASB and NIV as links out to each verse elsewhere (D7's fallback),
      settling the licensed three for a later version.
    - Keep the API key out of the page: a small Worker fetches and caches the
      text; cached text must be refreshed at least every 30 days. That is the
      desk's first server code before accounts, so it may wait for phase 4 or
      get a Worker of its own. Add its origin to the CSP report-only list.
    - Display rules: each version's copyright notice, no alteration, at most
      500 consecutive verses at once, no text-to-speech or AI use of licensed
      text, no AI training.
  - **NRSVue and CEB are not on API.bible** (BVJ checked). Both cap free
    quotation at 500 verses (and under 25% of a work, not a whole book), and
    the NRSVue's terms count "all verses that can be accessed from the
    website", so a tab that can show any verse needs a license for each. The
    original 1989 NRSV is no longer licensed (except the Catholic edition), so
    ask for the NRSVue. NRSVue: Petradi Rights Management for the National
    Council of Churches (NCCrights@petradirights.com). CEB: Abingdon Press's
    permission request form (about 15 business days). Either may charge a fee;
    the site would host the text itself, like the KJV, with each publisher's
    notice. Required notices: NRSVue "Scripture quotations are taken from the
    New Revised Standard Version Updated Edition. Copyright © 2021 National
    Council of Churches of Christ in the United States of America. Used by
    permission."; CEB "Scripture quotations from the COMMON ENGLISH BIBLE. ©
    Copyright 2011 COMMON ENGLISH BIBLE. All rights reserved. Used by
    permission. (www.CommonEnglishBible.com)." I offered to draft both
    requests; BVJ hasn't asked yet.
  - **Verse numbering differs in places.** The LIT's 2 Corinthians 13 has 13
    verses and its 3 John 15, where the KJV has 14 in each, so every
    translation in the tab needs a small map, checked against its text the
    way the Sefaria map was (counts alone prove nothing). The API.bible ones
    need the same check.
  - **In the LIT's verse gaps** (Matthew 17:21 and the rest), the KJV has the
    traditional verse, so the tab can show it beside the LIT's note on why it
    isn't there.
  - **Fallback**, with no key, server or tracking: a plain link out to the
    verse on STEP Bible (free, nonprofit, no ads) or Bible Gateway, the way
    Hebrew Bible references link out to Sefaria. Bible Gateway also covers
    the NRSVue and CEB until any license comes through.
  - Still open: whether API.bible's tracking is acceptable, which other
    free-to-share translations join the KJV, and whether to request the
    NRSVue and CEB licenses. Borrowed (NET Bible). Medium with API.bible.
- **D8. A tutorial on first use, which can be replayed.** BVJ, 2026-10-05:
  "I hope to include a tutorial sequence for the Study Desk that runs on a
  user's first encounter and can be replayed later if the user wishes." A
  short guided sequence through the desk on the page in front of the reader:
  the "My Notebook" actions in the verse menu, the margin, the Notebook panel,
  commands in search, and where the notebook is kept. It can be replayed from
  the help page (M12) and the Notebook panel. Borrowed (onboarding tours in
  desktop and phone apps). Small to medium. Phase 1d. **BVJ's hope; the
  details are open.** Proposed, for when it's designed:
  - **What counts as the first encounter.** The first time the reader opens
    the Notebook panel or uses one of the desk's actions, so the reader has
    already chosen the desk, with a quiet one-time offer ("Take a short tour
    of the Study Desk?") rather than a tour that starts by itself. Starting it
    on a first visit to a chapter would put it over scripture on arrival,
    which the announcement rules forbid (CLAUDE.md, "One announcement popover
    at a time": never on a session's first pageview, never over scripture).
  - **How it meets D6.** The first-time choice also runs on first use, so
    the two need one order: the choice as a step of the tour, or the tour
    after the choice.
  - **Skippable at every step**, closed by Escape, never offered twice
    unasked. Keyboard and screen readers can follow it: focus moves to each
    step and returns to where the reader was. It respects reduced motion.
  - **The tour makes nothing real.** A step that shows a note or a highlight
    uses a sample that disappears when the tour ends, never a record in the
    reader's notebook.
  - **"Seen" is kept in this browser**, as a per-viewer convenience like the
    Display settings, and doesn't sync (display settings don't: R7). A
    cleared browser shows the offer again, which is harmless. The privacy
    paragraph names the key.
  - **It grows with the phases.** Each phase that adds something worth
    showing adds a step. A reader who has already seen the tour gets a short
    offer of just the new steps, not the whole tour again.
  - Desktop only, like the rest of the notebook (ground rule 1).
  - **Built on the preview 2026-10-12**, on these recommendations: offered
    once, right after the D6 choice (the tour follows the choice); five
    steps, only those whose target is on the page; marked seen when it
    starts; replayed from the panel's foot, the `tour` command and the help
    page; no records written. "Order of work", 1d.
- **D9. The desk as a page of its own.** BVJ, 2026-10-15: "After phases 1
  to 3 are built, creating a whole page (or subdomain?) dedicated to study
  desk, with the LIT text still available but as one thing that CAN be
  displayed rather than the primary thing." Everything built so far sits
  *around* the text: the chapter is the page, and the desk lives in its
  margin. D9 turns that over for the reader who comes to prepare rather than
  to read: a workspace whose panes are the reader's notebook, a sheet being
  written, the Greek, search, and the LIT text as one pane among them,
  shown, hidden or moved like the rest. Study View and the margin desk stay
  as they are; this is a second way in, not a replacement. Borrowed (Logos
  and Accordance workspaces; Sefaria's sheet editor with the library in a
  side panel, the survey's "sheets as a workspace of their own"). Large.
  **BVJ's idea; decided 2026-10-15 to be part of phase 3, with sheets**
  ("Decisions", 2026-10-15). The details below are BVJ's answers and
  proposals for when it's designed:
  - **A page, not a subdomain** (`litbible.net/desk/`, clear of book slugs
    per W7). Browser storage belongs to one origin, so `desk.litbible.net`
    would open with an empty notebook: the reader's notes, highlights,
    places and Display settings all live in litbible.net's IndexedDB and
    `localStorage`, and a chosen file (D1) is granted to one origin too.
    Until sync exists (phase 4), a subdomain would need its own way to move
    a notebook across, and every fetch of `/greek/`, `/search/` and the
    chapter data would cross origins. The sync service's own subdomain is a
    different thing: it holds no browser state. A page gets the separate
    feel from its name and layout.
  - **The LIT pane is the Study View text, not a third rendering.** The
    page's text has to match Study View's character for character, or
    marks can't be placed (`test/desk-anchor-dom.test.js` holds the two
    views to that). The handout already fetches a chapter's Study View page
    to read its notes from Read View, so the pane can do the same: fetch
    the built page and take its paragraphs, footnotes and term-lens data.
    If a third render path is ever added, it joins that test's sweep.
  - **BVJ's answers (2026-10-15).** Not decisions to build from yet: D9
    is fed into the plan now, and mockups wait until the work starts.
    1. **Panes: one to four at a time, rearranged freely.** All columns
       with adjustable widths, all rows with adjustable heights, or a
       combination, 1×2, 2×1 or 2×2, with adjustable sizes (BVJ's terms;
       how each is drawn is for the mockups).
    2. **The page remembers the layout.** The reader chooses between
       "remember the last layout" and "start with my default", can set
       their own default, and can go back to the original one.
    3. **The panes**: the LIT text; the equivalents of the Notebook's three
       tabs (My Notes, This verse, Greek); Go deeper, either in My Notes or
       This verse or as a pane of its own (open); sheets; and possibly a
       document pane with rich text, for handouts, manuscripts and the like
       (open whether that is part of the sheet pane or a pane of its own).
    4. **The LIT pane may hold a chapter or a whole book**, perhaps the
       reader's choice (open). "A whole book" means **the reader keeps
       scrolling from chapter to chapter without navigating**, not that
       the book is loaded at once: chapters can load as the reader nears
       them. In a whole book, footnotes are reached through their popovers,
       the This verse pane and the footnotes pane, with no list at the end
       of each chapter. **Since a chapter loads at a time anyway, the pane
       might scroll through the whole corpus**, Matthew to Revelation
       (BVJ, 2026-10-15, a thought). Drafts would need Read View's answer:
       a run of drafts shown as one stub, keeping each chapter's anchor.
    5. **Whether /desk replaces `/sheets/` or comes in addition to it is
       open.** Mockups when the work starts.
    6. **The Notebook on the reading pages stays as full as it is now.**
       /desk is a second way in.
    7. **/desk may be the place for some deferred or shelved ideas**,
       though some were set aside for reasons it doesn't change (below,
       with BVJ's answers).
    8. **Phase 2's later pieces might live better here** (BVJ wondered,
       2026-10-15), such as tracing notes across a word wherever it
       occurs. Weighed below ("Phase 2c and D9"); the word pane is now version 2
       material, shelved with N2, H2 and M4.
    9. **Phase 3 is sheets and the desk together** (BVJ, 2026-10-15),
       and **phases 2b and 2c follow it**: 2b needs sheets, and 2c's one
       piece left, M11, is the only part of it still in play.
    10. **Sheets are edited in /desk only**, as the sheet pane: one
       editor. A sheet's own address exists only for what isn't editing
       (opening a shared link, present mode, printing), which S8 and S6
       need anyway, since a shared sheet opens for people who never built
       it (BVJ accepted the proposal, 2026-10-15).
    11. **Phase 3 is not cut down to make a date** (BVJ, 2026-10-15: "no
       need to compress the scope to make it go faster. We'll be fine").
       The proposal to open /desk with two panes for Lent and add the
       free layouts later was declined; the whole of it is phase 3.
  - **Phase 3a's answers** (BVJ, 2026-10-18, from the mockups; decision
    log, "Phase 3a"). These settle answers 1 and 3 to 5 above:
    1. **Layouts: a menu, and dragging to split.** A Layout menu offers
       every arrangement, and dragging a pane to an edge of another to
       split it is included as well. The arrangements are one pane; two
       columns or two rows; three columns, three rows, one beside two
       stacked (either side), and one above or below two side by side; and
       four columns or 2×2. **Four rows is left out** (BVJ: the others
       "work well", four rows "doesn't need to be included").
    2. **`/sheets/` stays, beside `/desk/`.** It is the sheet's own address:
       a plain page for opening a shared link, presenting and printing,
       with Present, Print and "Copy into my desk". Editing is in /desk
       only, as answer 10 says.
    3. **Go deeper is a "This chapter" section at the foot of This verse**
       in /desk. That pane already follows the reader's place, the section
       changes only with the chapter, and it doesn't take one of four panes.
       Whether the margin Notebook's This verse tab gets it too wasn't asked.
    4. **A formatted document is part of sheets.** A sheet is built from
       modules the reader can add, remove, rearrange and customize, and
       comes from **several templates** (M9's among them), **plus one
       template that is a blank canvas with the full rich-text formatting
       options**, for a wholly original document. No Document pane and no
       new kind of record. Ground rule 3 holds on the canvas too: a passage
       placed there comes from the live text and stays set apart from the
       reader's words, and formatted text is sanitized on the way in and
       out.
    5. **The LIT pane scrolls the whole corpus**, Matthew to Revelation,
       loading each chapter as the reader nears it, **with no setting** for
       a chapter or a book. A run of drafts shows as one stub (Acts and
       Revelation today). Measured for the mockups: a chapter's built page
       is about 31 KB compressed (median, 45 KB at most), about 7 KB of it
       the text, footnotes and key-term data the pane uses.
    6. **Several panes of a kind may be open, and the panes that follow
       follow the LIT pane you last worked in** (option B of three; "Still
       open", "Phase 3a's smaller calls", has the other two). The LIT text
       leads; This verse, Greek and Footnotes follow; the Greek also leads
       back (the 1g answer); My Notes, sheets and the notebook's lists
       follow nothing. The **active** LIT pane is the one last scrolled,
       clicked or typed in, and its header marks it. Each following pane
       has a **Stay here** pin that stops it following and gives it its
       own passage picker. The saved layout remembers pins. Also settled:
       panes need at least 280px by 160px, the original layout is the LIT
       text beside My Notes (60/40), and the layout is kept in this
       browser.
  - **What the answers mean for the build** (notes for then, not
    decisions):
    - **Most panes exist already as modules**: the Greek tab, This verse,
      My Notes and the notebook page's lists. The sheet editor doesn't yet,
      so **phase 3 should build S1's editor to work inside another page**,
      whichever way the `/sheets/` question goes, or D9 means building
      sheets twice. That is the one thing D9 asks of the phases before it.
    - **Go deeper is worked out at build** (`go-deeper-data.ts`) and lives
      in the chapter's Study View page, so its pane can come from the same
      fetched page as the text.
    - **A whole book with footnote popovers is not Read View's text**:
      Read View prints no footnote letters. It would be each chapter's
      Study View text in turn, fetched as the reader scrolls toward it,
      and since footnote labels restart every chapter, a popover has to
      know its chapter (as Read View's verse ids already do,
      `data-chapter`). A chapter added above the reader must not move the
      text they are reading (`keepReadingPlace` holds a line through a
      reflow today).
    - **The layout is a per-browser setting** like the Display tray's (a
      `localStorage` key, named in /privacy's paragraph), unless BVJ wants
      it to sync once sync exists. The draggable widths on Study View are
      kept only for the visit (`sessionStorage`); /desk keeps its layout
      for good.
    - **A document pane with rich text raises the format question**: is a
      document a kind of sheet (a sheet whose text blocks take formatting)
      or a new kind of record? A new kind is one the apps must carry
      without showing (C8) and can't be taken back once readers hold it,
      so it is settled in STUDY-DESK-FORMAT.md before anything is stored.
      Ground rule 3 holds inside it: the LIT's words quoted in a document
      stay set apart from the reader's, and come from the live text as a
      sheet's passages do. Formatted text is stored HTML, so it is
      sanitized on the way in and out; a note's body today is plain text,
      escaped (`noteBodyHtml`).
  - **Deferred and shelved ideas, against D9** (BVJ's answers,
    2026-10-15):
    - **The Greek interleaf (1g)**: **yes, as the Greek pane**, which is
      already planned: the Greek beside the LIT pane, kept in step as
      either scrolls.
    - **Footnotes in the margin (X11)**: **yes, as a footnotes pane**
      following the LIT pane.
    - **Other versions (D7)**: **not for now.**
    - **The interleaf (N7)**: **no**; the My Notes pane already does its
      job.
    - **M10**: stays shelved; its parts live on other pages, so /desk
      changes little.
    - **Pop the notebook out (D4)**: placed in phase 3, last; panes cover most of it. Moved to version 2 on 2026-10-21.
    - **Unchanged by D9**: everything under "Considered and set aside"
      (right-click, a public gallery, AI summaries, live co-editing, Ctrl
      K, commentaries, the email when verses change, anchoring to footnote
      letters). Their reasons don't depend on where the desk lives.
  - **Phase 2c and D9** (proposed 2026-10-15, for BVJ to weigh; **shelved
    with N2, H2 and M4 on 2026-10-15**, so the word pane below is version 2
    material, and only the footnotes pane for M11 is still in play). 2c holds
    N2 (a note on a term that follows it everywhere), H2 with C23 (marking
    a concept through a book, saved as a rule), M4 (a word study) and M11
    (notes on a footnote). Each has two halves: **where it is made and
    studied**, and **where the reader meets it**.
    - **The making and studying fit /desk well, as a word pane**: choose a
      glossary term or a Greek lemma and see every gated place it occurs,
      grouped by rendering with counts, the Greek, the reader's own notes
      on those verses, and their note on the term itself. From there,
      write the term note (N2), set the concept mark (H2), or turn the
      list into a sheet (M4). M11 belongs in the footnotes pane the same
      way.
    - **The meeting stays wherever the text is**: N2's note in the term
      lens card and H2's marks on the words, on Study View and in the LIT
      pane alike. That is the point of both: the reader comes across them
      while reading.
    - **A read-only word pane needs no new kind of record**, like the
      Greek search: tracing a term and showing the notes already on those
      verses. It could come with /desk itself, and would also show how
      readers use such tracing before N2 and H2 add kinds of record to
      their notebooks, the very trial 2c was waiting for ("Order of
      work", 2c). N2, H2 and M11 still add kinds of record wherever they
      are made, so that caution doesn't change.
- **M1. Hide my notes, in one keystroke.** A switch with a shortcut that hides
  every note, highlight and mark at once, for sharing a screen or teaching
  from Study View. N8 makes it matter. Present mode already leaves notes out.
  Small. Privacy. **Decided: yes.** **Built on the preview 2026-10-08**, key
  H ("Order of work", 1c).
- **M7. A trash with undo.** Deleted notes and sheets wait 30 days; matters
  more with sync, since a deletion reaches every device. Small. **Decided:
  yes.**
- **M8. Your own tags across everything.** One set of personal tags across
  notes, highlights, bookmarks and sheets, filtered in the panel and on the
  notebook page; covers named notebooks (Blue Letter Bible's takeaway).
  **Decided: yes, name open**: if the site's topics are renamed tags (see
  "Topics and tags"), the reader's own could be called labels. Small.
  **Built on the preview 2026-10-12 under the name "Labels"
  (recommended, for BVJ to confirm)**, applied from the notebook page.
- **M10. Your notebook where you already look.** A "Verses in my notebook"
  filter on /release-notes; your note on a term on its /glossary entry; a
  "Your notes here" row in Go deeper. New. Extra small. **Decided: yes.**
  **Built 2026-10-15, then shelved by BVJ the same day** ("Decisions",
  2026-10-15). All three parts are on branch `claude/desk-2a-m10` (commit
  324f936), not in the tree; "Order of work", 2a, says how they worked.
- **M12. A help page, a quiet launch, and a way to say what's missing.** The
  help page is D6's "Ways to keep your notebook", plus how to back up, how to
  delete everything, and **a link to the license terms** for anything a
  reader shares. A line in the release notes and the newsletter at launch
  (the announcement slot never appears over scripture). A "Tell us what's
  missing" link in the panel opening the contact form, because the site
  deliberately doesn't measure who uses what. Small. **Decided: yes.**
  **Built on the preview 2026-10-12** as `/notebook/help/`, with the license
  terms link, a "Tell us what's missing" link to /contact/ in the panel's
  foot, and one paragraph in /privacy (effective date moved to 2026-10-13, BVJ).

## How it would be built

Through phase 3 everything runs in the reader's browser; accounts add a
server. Most hard parts exist in the repo already.

- **The gate**: `isAppPlatform()`, dynamic import on computers only; account
  pages excepted (C1), if plan C gives the site any.
- **Storage**: IndexedDB, one database, with BroadcastChannel keeping two open
  tabs in step. Ask for persistent storage (`navigator.storage.persist()`):
  Chrome grants by engagement, Firefox asks, Safari grants mainly to Home
  Screen web apps. Safari's tracking prevention clears script-written storage
  after seven days of Safari use without a visit, so the file (D1), an account
  or an export is the real backup, and the notebook says when it was last
  backed up. **Sync-ready from the first record**: a permanent ID, the time it
  last changed, a deletion marker (tombstone), a copy of the verse as it read
  (C3), and a version number on the format (C22). Format draft 1 (2026-10-05)
  makes a deletion its own `trash` record rather than a flag on the live
  record, since iOS found flag flips unreliable in sync.
- **Anchors**: verse numbers carry `data-osis` ("Rom.8.3"), which keys a note
  to its verse. A phrase note also quotes its words with a little text before
  and after (the W3C Web Annotation TextQuoteSelector, the method Hypothesis
  uses), found again each visit, falling back to the verse with N3's notice
  when gone. **Footnote letters are never anchors**: the 2026-09-03 change to
  Romans 4 relabeled notes m–v as o–x. **Phrase anchors read the text the way
  Copy does**, through `countable` and `stripBracketMarkers` in
  `chapter-tools.js`, so a quote taken in one view finds its words in the
  other (C16). The notebook becomes another consumer that must strip ⟦ ⟧ (see
  CLAUDE.md, "Bracketed passages"). Leave room for anchors on a Greek word
  (book, chapter, verse, SBLGNT word position) for the later Greek project.
  **Format draft 1 (2026-10-05) supersedes two parts of this.** A record
  names its verses by `bookKey`, `chapter`, `verse` and `endVerse`, the site's
  slugs, with OSIS derived only for the W3C export. Quotes are taken from the
  format's anchor text (`scripts/lib/anchor-text.mjs`), not from `countable`
  or Copy's text, which differ from each other (review finding 3). Phase 1a
  builds the browser half: turning a selection on the page into anchor-text
  positions and back, checked against the same vectors.
- **Drawing**: highlights use the CSS Custom Highlight API (Chrome 105, Safari
  17.2, Firefox 140), which the site already uses for a selected verse; it
  paints without changing the DOM, so Copy text, handouts, the term lens and
  search read exactly what they read today. It is invisible to screen
  readers, hence C4. Margin notes are placed from the existing `data-verse`
  spans and re-placed when the Display tray reflows the text.
- **Accessibility**: a verse number with a note or highlight says so in words
  ("Verse 3, has a note, highlighted as promise") and the panel lists
  everything (C4). Notes sit outside the scripture's reading order, linked
  with `aria-details` (C24). The verse menu stays the keyboard and screen-
  reader route. Notes stay reachable from the margin and panel with verse
  numbers or key terms switched off; say so in those settings' help text
  (C10). The margin "+" adds no tab stop. Single-key shortcuts (N, B) obey the
  existing Keyboard switch (WCAG 2.1.4).
- **Formats**: Markdown for people, every heading linking to its verse. JSON
  in the W3C Web Annotation shape for everything attached to the text (its
  motivations cover bookmarking, commenting, highlighting, questioning,
  tagging and linking), and a small versioned LIT format for sheets and
  places, which Web Annotation can't express (C22). Printing through the
  existing `print.css`, plus a rich copy for Word. Draft 1 (2026-10-05)
  refined this: the logical records in `STUDY-DESK-FORMAT.md` are the shared
  form, each store maps them in its own way, and the W3C shape is the export
  file for marks on the text.
- **Reuse**: `joinPieces` and `assembleHandout` for copying; `print.css`,
  `PrintCredit` and `LIT_CREDIT_LINE` for paper; the shared panel
  (`lit-panel.js`); `linkScriptureRefs`; the term lens data and the alignment
  gate; `parseDetail` from the release notes page for N3's before and after.
- **The contract**: no change to chapter JSON, `/api/`, the glossary feed or
  anything the apps read. The privacy page gains one paragraph.
- **Plumbing (C21)**: notebook, sheet and account pages are noindex and stay
  out of the sitemap and Pagefind. Sign-in forms update the enforced CSP
  `form-action` list. The account Worker gets its own CI job and Dependabot
  stream (as `workers/contact-form/` has) and its secrets and DNS in
  DISASTER-RECOVERY.md. The QR library ships to the page. `read-mode.js` can't
  import modules (it's loaded via `?url`), so Read View talks to the notebook
  through events, the way it reports reading positions (`rm:position`).
- **Greek and Hebrew fonts (C27)**: self-hosted, loaded only on pages
  containing those letters via `unicode-range`, the way
  `public/fonts/bracket-markers.otf` loads. Check printed sheets and present
  mode with both, and make sheets fit Letter and A4.
- **The reading column**: currently `--reading-measure` 60 × `--ch` (about
  681px at the default size, about 870px at the largest). **BVJ wants it
  narrower when the desk launches** (C9), picked side by side like the
  2026-09-27 choice of 60. Change `--reading-measure`, never `--ch`. **Picked
  2026-10-05: 52** (590px at the default size, 755px at the largest, in
  Inter). **48 on Study View chapters while the notebook is open, from
  2026-10-08** (545px and 696px).

## Accounts and sync

Added 2026-10-01 after BVJ talked with BDR. This reverses the feature audit's
"set aside: accounts and cloud sync on the web".

**Correction (BVJ, 2026-10-05).** The list below says "Decided by BVJ", but
BVJ remembers the first plan BVJ took to BDR as having no LIT account. On
2026-10-01 it was BDR's pushback, that a universal account across all devices
was better, that moved the plan toward one. Asking BDR what has shifted
since is in the 2026-10-05 reply.

**Contested since 2026-10-04.** BDR's replies propose no LIT accounts at all:
each reader's notebook stays in their own iCloud or Google account, and the
website reaches it from the browser (plan A in "The apps' replies" below).
Until BVJ and BDR decide (talk-through item 1), read this section as plan B,
the fallback. Supabase and Firebase are out under both plans.

**Superseded in part (2026-10-07).** BDR's proposal splits this plan in two:
plan B, accounts with passwords as below, and plan C, a thin service with no
passwords and end-to-end encryption. BDR's privacy wording rule rules out
plan B. See "One notebook, three homes".

**Decided by BVJ:**
- **No-login stays.** Everything works without an account.
- **An account adds full sync** of the notebook between the desktop website
  and the iOS and Android apps.
- **Sign-in methods**: email and password with two-step verification,
  passkeys, Google, and Apple (BVJ said "iCloud account").
- **First use asks** (D6), and a page explains every option including opting
  out (BVJ's addition to C5: "maybe on the register page").
- **BVJ leans toward end-to-end encryption** (C19), to settle with BDR.
- **Account pages work on every device** (C1).
- BDR is considering a **Mac app** (C18).

**"Log in with iCloud" means Sign in with Apple** as an identity method. The
notes then live in the LIT's sync service, not the reader's iCloud. Today's
iPhone app syncs through the reader's own iCloud and never touches a LIT
server. CloudKit JS could reach a signed-in person's private iCloud data from
the website, but Android readers can't use it, so cross-platform sync needs a
LIT service. Recommendation: Sign in with Apple as a way to log in, one LIT
sync service for everyone with an account, today's iCloud and Android backup
left as is for readers who never sign in, and their notes copied into the
account when they do. How the apps handle that move is BDR's call.

**What an account system takes:**
- **A server**: a Worker at its own address (for example account.litbible.net)
  with D1, in the existing Cloudflare account, outside `/api/`.
- **Store rules**: Google sign-in in an iOS app requires an equivalent private
  option, which Sign in with Apple satisfies (Apple guideline 4.8). Both
  stores require in-app account deletion (Apple 5.1.1(v)); Google Play also
  wants a web page for deletion requests. Deleting an account that used Sign
  in with Apple must revoke Apple's tokens (`appleid.apple.com/auth/revoke`).
  Both stores' privacy forms change.
- **Email to any address** for verification and resets, which the contact
  Worker's Email Routing can't send: Cloudflare Email Service (public beta
  since April 2026, needs the paid Workers plan) or Brevo's transactional email
  (Brevo already runs the newsletter). Mail to Apple's Hide My Email arrives
  only once the sending domain is registered with Apple.
- **One passkey everywhere**: add `webcredentials` to
  `public/.well-known/apple-app-site-association` and `get_login_creds` to
  `assetlinks.json`, plus the apps' own setup.
- **Linking sign-in methods**: Google on Android and Apple on iPhone make two
  accounts unless linked, and Hide My Email addresses won't match. "Add
  another way to sign in" from the first version.
- **2FA** for password accounts: an authenticator app plus recovery codes. No
  SMS (cost, and numbers can be hijacked).
- **Enforce the full CSP**: CLAUDE.md says to revisit enforcing it if the site
  gains logins; this is that moment. Sign-up needs rate limits and bot
  protection (Turnstile already guards the forms).
- **New promises**: the privacy page says personal information is collected
  only when someone chooses to send it, and that the LIT team can't see the
  apps' backups; both need rewriting (the privacy page is shared work with
  BDR). The site needs terms of service with a minimum age.
- **Account basics (C20)**: signed-in devices with "sign out everywhere", a
  full export from any device, changing an email address, and recovery codes
  kept off the device if notes are end-to-end encrypted.
- **Cost**: the paid Workers plan (about $5 a month) plus whatever sign-in
  costs. Check prices when choosing.

**Who handles sign-in** (BDR's view should decide; my lean is Supabase or
Better Auth, not Firebase):

| Option | Sign-in | For the apps | Where notes live | Trade-off |
|---|---|---|---|---|
| Better Auth on Cloudflare | All requested, via plugins | No official Swift/Kotlin SDK; apps call its HTTP endpoints | BVJ's Cloudflare (D1) | No new vendor, open source; the LIT runs it |
| Supabase | All requested; passkeys in beta (mid-2026) | Official Swift and Kotlin SDKs for auth and data | Supabase's database | Least app work; a second vendor, open source |
| Clerk, Auth0 and similar | All requested | Varies | With them | Specialists own security; price and lock-in vary |
| Firebase | No built-in passkeys (mid-2026) | Mature | Google's servers | Leave it out |

**How accounts change the plan:**
- The local notebook stays the foundation; sync sits on top.
- **One source of truth at a time (C5)**: signed out, the browser holds the
  notebook and the file (D1) is its sync partner; signed in, the account is
  the truth and the file becomes a one-way backup the site writes but no
  longer reads; locked (D5), everything at rest is encrypted with the
  reader's key, the file included (C6).
- **Conflicts keep both versions** of a note edited on two devices before
  syncing, and the reader chooses. Highlights, bookmarks and places take the
  latest change. Deletions wait in the trash 30 days on every device (M7).
  **Superseded 2026-10-09**: the newer writing wins for notes too and the
  older version is discarded (BDR's rule a, which BVJ went with; see rules a
  to e).
- Sheets stay a computer feature for now (decision 4); synced sheets would
  let the apps show them later.

### BDR's list (11 items)

Answered 2026-10-04. The answers, and what's still open, are under "The
apps' replies" below. The list is kept as it was asked.

1. **Who handles sign-in** (the table above).
2. **Whether the LIT can read synced notes.** Standard encryption vs end-to-
   end, where only the reader's devices can read them (suits a trauma-informed
   translation, N8 especially). The cost is a recovery key the reader must
   keep. Much easier to decide before launch. BVJ leans end-to-end, which also
   settles how share links work (C19).
3. **What happens to today's iCloud and Android backup** when someone signs
   in (and signs out, or deletes the account).
4. **What syncs.** Notes, highlights, bookmarks and places certainly; sheets,
   Display settings and reading positions?
5. **Who looks after the service**: security updates and incident response.
6. **One key for the lock, the file and the account (C6).** BVJ: probably yes.
7. **The blur in the apps (C7).** Until the apps honor N8, its "hide this
   passage" setting stays on the computer, and the notebook says so when a
   signed-in reader sets it.
8. **The apps keep what they can't show (C8).** Every client preserves record
   kinds and fields it doesn't understand, and highlight colors are stored by
   the apps' own color names.
9. **Website accounts first? (M13)** Accounts could launch for computers
   before the apps join, provided the record format is agreed first. BVJ:
   probably.
10. **A Mac app.** BDR is considering one: a home outside Safari's storage
    limits (C18) that syncs like the other apps. Sheets, print and present
    mode stay on the website unless it takes them on.
11. **Link the license terms from both apps**, for example from About or
    Settings, to `https://litbible.net/read#license-terms`, opening in a
    browser. Waits on nothing; can go in the apps' next update.

### The brief for BDR

`STUDY-DESK-BRIEF-FOR-BDR.md`, written for BDR's Claude (2026-10-01, revised
2026-10-02 to say /read now opens the terms on arrival). It explains the
project, what the website will build, the decided account points, the store
obligations, and asks BDR's Claude to read the app code before answering,
correct our assumptions, and say what we missed. BVJ sent it, and both apps
replied on 2026-10-04 (recorded under "The apps' replies" below). **Revise
the brief if it is sent again.**
It deliberately leaves out the 2026-10-02 netbible.org round (N10 and D7 are
website-only; S11 and reading plans come later). Its requests, in order: (1) link the license
terms from both apps; (2) agree the record format before any code; (3) choose
the sign-in provider; (4) end-to-end encryption or not, and its cost to the
apps (Keychain/Keystore, recovery, new devices); (5) today's iCloud and
Android backups on sign-in, sign-out and deletion; (6) what syncs; (7) who
maintains the service; (8) one key (C6); (9) the blur in the apps (C7);
(10) keep unknown records and give the four color names (C8); (11) website
accounts first (M13); (12) the Mac app.

Assumptions it asked BDR's Claude to correct: notes and highlights are
anchored to verse text somehow; the apps have exactly four highlight colors
with internal names; iOS syncs notes through iCloud and Android relies on
Auto Backup with no LIT server; iOS claims `/<book>-*` and `/glossary`, and
Android's claimed paths live in its manifest; the apps extract text from raw
chapter HTML without stripping ⟦ ⟧ (CLAUDE.md notes this gap); neither app
has accounts or a server today.

Prompts it raised: anchoring across a moving text (is TextQuoteSelector plus
a verse copy workable on mobile; one shared normalization spec with test
vectors from the corpus, since website and apps must strip verse numbers,
footnote letters and ⟦ ⟧ and collapse whitespace identically, or a quote made
on one platform won't be found on the other); migrating existing app notes
(no IDs, verse copies or tombstones) without duplicates when two devices
carry the same backed-up notes; mobile background sync limits, offline
edits, clock skew under last-write-wins; whether records should carry the
content `version` they were made against and whether the apps should show
N3's notice too (the release notes feed already carries `location`); device
key storage, biometric unlock, lost phones, new devices, and passkeys vs an
E2EE key; store-review risks; deep links for printed codes and later sheet
addresses, and nothing capturing /read or account pages by mistake;
accessibility parity (highlights announced in words, a second cue besides
color); anything the apps do that the website should copy; effort and order.

The reply format it asked for: corrections; answers to requests 1 to 12 with
a recommendation, reason and app-side cost (S, M, L); a review of the record
format with the four color names; what we missed, most important first;
questions only BVJ can decide.

**The draft record format it proposed** (to react to, not adopt; phase 0 is
agreeing the real one):

```json
{
  "@context": "http://www.w3.org/ns/anno.jsonld",
  "id": "urn:uuid:7f3c1e0a-...",
  "type": "Annotation",
  "motivation": ["highlighting", "commenting"],
  "created": "2026-09-12T16:04:00Z",
  "modified": "2026-09-12T16:10:00Z",
  "body": { "type": "TextualBody", "format": "text/plain",
            "value": "Self-preservation as the drive to protect my standing." },
  "target": {
    "source": "https://litbible.net/romans-8/",
    "selector": [
      { "type": "FragmentSelector", "value": "v3-4" },
      { "type": "TextQuoteSelector",
        "exact": "rendered a verdict against deviation in self-preservation",
        "prefix": "under deviation and ", "suffix": " so that the Torah" }
    ]
  },
  "lit": {
    "schema": 1,
    "osis": ["Rom.8.3", "Rom.8.4"],
    "verseCopy": { "Rom.8.3": "…verse text as it read on 2026-09-12…" },
    "contentVersion": "v20260912.ab12cd34",
    "color": "<the apps' own color name>",
    "deleted": false
  }
}
```

Two rules for every client (C8): keep what you don't understand, untouched,
and write it back; store highlight colors by the apps' own names.

## The apps' replies (2026-10-04)

Both replies came back on 2026-10-04. BDR's Claude wrote each one from that
app's code, adding BDR's answers where the call was BDR's: "the iOS app's
reply" (iOS repo at `3b9e136`, branch `next`, 2.0 in TestFlight) and "the
Android reply". BVJ holds both documents. They aren't committed here because
they quote the apps' private code. This section records what they say and
what the review of them found (2026-10-05). Their IDs are kept so answers can
be sent back against them:
- **iOS reply**: **R1–R11** (BDR's rulings), **T1–T10** (for BVJ and BDR to
  talk through), **P1–P3** (proofs), **W1–W7** (questions for this repo).
- **Android reply**: **A-R1–A-R12** (answers to the brief's requests),
  **A-F1–A-F13** (format changes), **A-M1–A-M13** (what we missed),
  **A-Q1–A-Q14** (questions).

Android asks that each question sent back be marked "for BDR" or "for the
Android instance". Its Claude won't answer for BDR.

### BDR's proposal: each platform's own cloud, and no LIT accounts

Both replies lead with this proposal, which reverses most of "Accounts and
sync" above, the section the brief described as decided. BDR, quoted in the
Android reply: "Leaning hard toward a solution that's built entirely on each
platform's own invisible data sync at a device-level login, extended with a
'Sign in with Apple' and 'Sign in with Google' option for the website. It
doesn't solve for cross-platform users (rare!) or users who don't want to use
either login type (also rare) but maybe we can brainstorm options."

- **Plan A (BDR's).** An iPhone reader's notebook stays in their own iCloud:
  the app's CloudKit private database, container `iCloud.com.litbible.app`.
  An Android reader's notebook moves into the hidden app-data folder of their
  own Google Drive (scope `drive.appdata`). The website reaches either one
  from the browser. **LIT holds nobody's notes**, so there are no LIT
  accounts, passwords, two-step codes, reset emails, account pages, account
  deletion or email service. "Sign in" means "connect the cloud your phone
  already uses". On Apple's side that is CloudKit's web sign-in with the
  reader's Apple Account, which opens this app's iCloud data to the page and
  gives the website no email address. It is **not** the "Sign in with Apple"
  identity product the Android reply quotes BDR naming; the iOS reply has
  this right. BVJ's own words on 2026-10-01, "iCloud account", were closer to
  plan A than this file's reading of them as Sign in with Apple.
- **Plan B (the fallback).** If a proof fails, a LIT service on Cloudflare:
  Workers and D1, Better Auth, called over plain HTTPS.
- **Supabase and Firebase are out** under every plan (R1, A-R3). The iOS
  repo has had this as a standing rule since a Supabase sync prototype was
  built and deleted in spring 2026.
- **Under plan A, BDR would also drop the notebook file (D1) as a way to
  sync** (T3). It works only in Chromium browsers, and connecting iCloud or
  Google does the same job from any browser, including for a reader with no
  phone.
- **Plan A leaves two readers uncovered.** One is a reader with both an
  Apple and an Android device, whose two notebooks would never meet (T4).
  BDR: "probably a known gap, but maybe the website bridges". The other is a
  reader who wants neither sign-in. BDR: keep it open. The Android reply
  lists four options for the first reader: the website merges both stores
  while open; export and import; one app also speaks the other store; a
  small LIT relay later.

Before anyone commits to plan A, three things need proving:
- **P1. The iOS app accepts a note the website writes into iCloud.** The test
  has to pass on the current release and on 1.27. It covers edits, deletes,
  long notes, an app edit keeping a field the app doesn't model, and listing
  changes without new search indexes. Apple documents the record layout
  for reading ("Reading CloudKit Records for Core Data": `CD_` record types
  and fields, record names `CD_<Entity>_<UUID>`, the
  `com.apple.coredata.cloudkit.zone` zone) and says CloudKit JS can reach
  those records. Nothing documented says Core Data will import a record
  another client wrote. BDR creates the CloudKit web token in BDR's developer
  account.
- **P2. Android's notes can be reached from the website. The Android reply
  answered no.** Today they sit in Android Auto Backup: one file,
  `backup/annotations.json`, uploaded about once a day and restored only
  on a new install, which nothing else can read. Plan A means Android
  builds Drive app-folder sync from nothing (M to L), and adds back a Google
  library the app removed before 1.0. Still to prove: that the Android app
  and the website, as two clients of one Google Cloud project, see the same
  app-data folder, and what happens when a reader's Google storage is full.
- **P3. Three unverified points.** Whether a reader with Advanced Data
  Protection can use the website's iCloud sign-in. What each store's privacy
  answers become under plan A. The shared Drive folder from P2.

### BDR's rulings on the app side

| Topic | iOS | Android |
|---|---|---|
| License link | In 2.0's public archive if the details are ready in time; otherwise 2.0.1 or November's 2.1 (R9) | In 1.3, this October. Needs two sentences of approved wording by mid-October (A-R1, A-Q10) |
| Today's sync | iCloud stays for Apple readers whatever else is built (R2) | Turning sync off leaves the notes on the phone (A-R5); Auto Backup keeps running underneath |
| Encryption | End-to-end only if recovery is safe; under plan A LIT never holds the notes, which BDR counts as meeting that (R3) | "Probably ordinary encryption to start, and E2E later" (A-R4) |
| Bookmarks | Full bookmarks **and named ribbons** in the first synced release (R4) | Bookmarks sync. Android has none today, only the `bookmark` note marker, and doesn't mention ribbons |
| Reading place | Open (T5) | Syncs (A-R6) |
| Sheets | Kept in the reader's cloud, not shown in the app (R7) | Synced and carried untouched (A-R6) |
| Display settings | Don't sync (R7) | Don't sync (A-R6) |
| 30-day trash | The app matches it (R5) | Needs its own trash: Drive app-folder files can't be put in Drive's trash |
| The blur (N8) | Honoured in the first synced release, VoiceOver included, on every route into a passage (R6) | Honoured in the launch build; a solid veil before Android 12 (A-R9) |
| Colour names | `yellow` `green` `blue` `pink` (R8) | The same (A-R10) |
| Note markers | Asks the website to carry all seven by name (R8) | Proposes `lit.noteType` (A-F3) |
| How sync is offered | Under plan A the app has no sign-in screen at all | A Settings row and one dismissible mention in My Notes, never a prompt at launch (A-R3) |
| Date | Ready by Ash Wednesday, **February 10, 2027**; app work may start after the November build (R10) | Full sync in the app on February 10; nothing public before December; building from about Christmas (A-R11) |
| Mac app | Planned and may move to spring. Shares the phones' iCloud with no extra sync work; printing is among its first features; some notebook features may reach it before the phones (R11) | — |
| Who looks after it | Nobody needed under plan A; open for plan B (T8) | Shared between BVJ and BDR, names to come (A-R7) |

### What the apps already do

The brief's assumptions underrated both apps. Built separately, they already
do much of what N3 plans:

| | iOS | Android | The website's plan |
|---|---|---|---|
| IDs | A UUID since the first release, the same on every Apple device | A UUID from creation, kept through backups | A permanent ID |
| Highlight and note | Two records (`type`) | Two records (`type`) | One record, two motivations (the draft) |
| Anchor | `paragraphId` (the paragraph's position in the chapter, from 0: `romans-ch8-p2`), UTF-16 offsets in the words-only text, `selectedText`, 20 characters of context each side (words only), `verse` and `endVerse` | Offsets in the text as displayed (verse numbers and footnote letters included, so never synced), the selected words, 20 characters each side **from the displayed text**, first verse only | Verse (`data-osis`) plus a TextQuoteSelector, reading the text the way Copy does (C16) |
| When the words change | Same offset, then a unique match, then context to choose, then context alone (marked `shifted`, old words kept), then `orphaned`. A notice offers Re-read in Context, Keep, Delete (since 1.1) | Same place, unique match, context to choose, **adopt the words now between the context**, give up. A notice in two registers ("carried along", "couldn't find your words"); the reader's first wording is kept until they've seen it | Compare against the verse copy, then fall back to the whole verse with N3's notice |
| Verse copy | None (`previousSelectedText` after a guess) | None | Yes (C3) |
| Content version on a record | No; `changedInUpdate` names the update that moved it | No, though the app knows it | Yes |
| Deletes | Removed outright. `isDeleted` exists but is unused, because flag flips on synced records propagated unreliably in testing | `isDeleted` plus a bumped `updatedAt`, never purged | A tombstone |
| ⟦ ⟧ | Kept, and counted in offsets; removing them has waited in its roadmap since September | Kept; the strip isn't built yet | Stripped |
| A highlight across paragraphs | One record per paragraph, sharing a `groupId` | Slices sharing a group ID, "internal; should not leak" | — |
| Overlapping highlights | A same-colour highlight that overlaps or touches merges | Same colour touching merges (a space counts as touching, a line break doesn't); a new colour trims an old one | — |
| Re-anchoring changes `modified` | Yes | Yes | — |
| Reading place | One per book, in iCloud (book, chapter, paragraph, date) | One for the whole app, a scroll position in pixels, not backed up | `lit_last_read` (book, chapter, verse) plus Read View's place in each book |
| Claimed links | 27 `/<book>-*` patterns and `/glossary`, from this repo's `apple-app-site-association` | `/{book}-{chapter}` per book in the manifest, `#v3` and `#v3-5` honoured; `/glossary` not claimed | — |
| Accessibility | A highlight is colour only and VoiceOver doesn't announce it; notes have a marker glyph and a dotted underline. An accessibility push is planned around Christmas | A highlight is colour only and TalkBack doesn't announce it; My Notes shows an unlabelled colour dot; notes have a labelled margin mark | C4 |
| Worth copying | Notes kept out of the phone's system search (BDR, September: a note is often grief, doubt or confession); whole-word selections that take closing punctuation | Deleting never asks and is always undoable from one bar | — |

Both apps have **seven note markers**: `note`, `emphasis`, `question`,
`heart`, `bookmark`, `lightbulb`, `flame` (iOS reads an old `star` as
`emphasis`). The iOS app's book keys are the site's slugs, as the Android
app's are, and neither app has an OSIS table.

### Where the two replies disagree

Same BDR, two apps. Each of these is a format decision, not a detail:
1. **Reading place**: settled as syncing on Android (A-R6), open on iOS
   (T5).
2. **Deletes and the trash.** iOS wants the trash as a record kind of its
   own (delete the live record, create a trash record), because flipping a
   flag on synced records was unreliable. Android wants a tombstone kept
   after the 30 days, with the content dropped, so that a phone restored
   from an old backup can't bring a deleted note back (A-M3, A-F10). The
   two fit together: a trash record holds the whole item for 30 days, then
   only its ID and deletion time, indefinitely.
3. **A highlight across paragraphs.** iOS asks the website to write one
   record per paragraph with a group ID (W5). Android says the slicing is
   internal and mustn't reach the shared format (A-F1).
4. **Overlapping highlights**: two different merge rules. Unless they become
   one, the clients will rewrite each other's marks back and forth (A-M5).
5. **Context length**: both apps store 20 characters but measure them
   differently. Android proposes 32 in normalized characters (A-F6).
6. **When the words are gone.** Both apps place the mark on whatever now
   sits between the old context, and flag it. The website's plan falls back
   to the whole verse. Android raises this as BDR's call (A-F5, A-Q6). iOS
   doesn't raise it.
7. **Bookmarks.** iOS will build bookmarks and ribbons; Android promises
   neither ribbons nor a way to show bookmarks yet. Both apps' `bookmark`
   note marker is a different thing from the website's bookmarks (B2)
   (A-Q13).
8. **Encryption**: the two are worded differently but agree in effect.
   Nothing is end-to-end at launch under either app's answer.
9. **Start of app work**: after the November build (iOS), or about
   Christmas (Android).
10. **Links**: `/glossary` opens the iOS app but stays in the browser on
    Android.

### What the review found (checked against this repo, 2026-10-05)

1. **The iOS paragraph ID isn't permanent.** `paragraphId` is a position in
   `paragraphs[]`, and positions move. This repo keeps a block's own ID
   permanent by retiring the IDs of merged blocks rather than renumbering,
   and the position of everything after a merge still shifts. Twice so far
   on published chapters:
   - Matthew 20, 2026-08-18: 21 blocks became 15 when 20:1–16 was set as
     one paragraph, moving the 14 blocks that hold 20:17–34.
   - Romans 3, 2026-09-06: 12 blocks became 11 when the 3:10–18 catena was
     set as poetry, moving the 4 that hold 3:18–31.

   **Question for the iOS instance:** does re-anchoring look beyond the
   stored paragraph? If not, notes made in those passages before those
   dates were misplaced or orphaned. For the shared format: anchor on verse
   and quote. If a paragraph is ever needed, use the block's own ID
   (`romans-3-p9`), which never moves.
2. **Ten bracketed paragraphs, not nine.** The iOS reply's list leaves out
   `luke-22-p18` (Luke 22:43–44, published 2026-09-17).
3. **The website has two text models today, and neither is the spec.**
   `countable` places a selection and finds it again on the other view's
   page. It drops verse numbers, footnote letters and all whitespace, but
   **keeps ⟦ ⟧**. Copy text (`cleanForShare`) strips ⟦ ⟧, collapses
   whitespace and keeps line breaks. So "read the text the way Copy does"
   (C16) still has to be made precise.
4. **Corpus facts for the spec** (all 210 published chapters):
   - No word joiners, zero-width characters, soft hyphens, decomposed
     accents or characters outside the Basic Multilingual Plane.
   - `&nbsp;` appears only as an entity (6,540 times), never as a literal
     character.
   - The only published `<br>` is 2 Corinthians 6:2.
   - Inline images appear only in draft placeholders (Acts and Revelation).

   So the rules for Unicode composition, word joiners and images (iOS
   §3.5, A-F4) are defensive, and their test vectors have to be made up.
   UTF-16 offsets equal code-point offsets in today's text, and JavaScript,
   Swift's `utf16` view and Kotlin all count UTF-16 natively.
5. **The bracket strip is the apps catching up.** Both apps already have it
   queued, and this repo strips ⟦ ⟧ in every extractor. Deciding T7 settles
   the order, not the direction.
6. **Under plan A the website is the only client that speaks both stores**,
   and the only place a bridge could ever live. Neither reply sizes the
   website's side; Android only asks (A-Q7). Two adapters, the iCloud schema
   review and the spec are website work the plan's phase 4 never had.
7. **iOS writes re-anchored offsets into the synced record.** Each Apple
   device re-places its notes after a content update and saves the ones
   that moved. The rule both replies want the website to keep (W2: resolve
   for display, never write back) doesn't hold while the apps do this. Both
   apps already plan to stop re-anchoring from changing `modified` (iOS
   §3.9, A-M4). Under plan A the offsets also live in the iCloud record, so
   each content update still sends a write from every Apple device. Ask
   whether iOS can keep its offsets on the device instead.
8. **Browser sessions without a server are short.** Google's browser-only
   flow issues hour-long access tokens with no refresh token, and renewing
   one opens a popup the reader has to start. CloudKit JS keeps its session
   in browser storage, which Safari clears after seven days without a visit.
   "Connect once" may become "connect most visits", so P1 and P2 should
   both test a reader returning a week later. A small Worker that only
   exchanges Google tokens would fix Google's half while holding no notes,
   but it would hold a credential to readers' Drive folders.
9. **Advanced Data Protection.** Apple's security guide says ADP end-to-end
   encrypts CloudKit fields a developer marks as encrypted, **and all
   CloudKit assets**. Core Data moves a value that won't fit in a 1MB
   record into an asset field. So for an ADP reader, the website could
   probably read ordinary fields but not an oversized note. That is an
   inference, to check in P3.
10. **The iCloud schema is permanent** (iOS §4.3). Website-only kinds
    (sheets, labels, concept-mark rules, the colour legend) don't need
    columns of their own. Put them in a zone the app never opens, under one
    generic record type (kind, a JSON payload, a modified time), deployed
    once. A later kind then needs no deploy, and the app can't damage what
    it doesn't read. On Drive, one JSON file per record (A-F2) is already
    generic.
11. **Under either plan, the page will hold credentials to readers' notes.**
    Under plan A that is a live token for their iCloud or Drive data, so a
    script injected into litbible.net would become a notes leak. CLAUDE.md
    says to revisit enforcing the full CSP "if the site ever gains
    logins/accounts/sessions". This is that moment, and the CloudKit and
    Google origins join the allowlist.
12. **Ash Wednesday is Lent's first day**, when study leaders would want
    sheets (phase 3). The current order puts sheets before sync. Under plan
    A the apps' sync doesn't depend on the website: iOS syncs today, and
    Android's Drive sync stands alone. The website can join after February
    10 without holding the apps back. Under plan B everything waits on the
    service. That is a schedule argument for plan A.

### Proposed answers to W1–W7 (for BVJ to confirm)

- **W1. The spec and its test vectors: yes, written here.** This repo has
  the corpus, `stripBracketMarkers` and the extractors. Proposed rule:
  - NFC.
  - Drop verse numbers and footnote letters.
  - Strip both bracket forms **before** collapsing whitespace (pending T7).
  - `&nbsp;` becomes a space; zero-width characters are removed.
  - A poetry line break or `<br>` becomes `\n`; other whitespace runs
    collapse to one space. **Draft 1 changed this** (2026-10-05): every block
    boundary, a poetry line or `<br>` included, becomes one space, so the
    three implementations can't drift over line breaks. Poetry keeps its
    lines on screen and in Copy text; only anchoring flattens them
    (`STUDY-DESK-FORMAT.md`, "Why one space and not a newline").
  - Quotes and dashes stay as written in anchors. They're evened out only
    for N3's change comparison.
  - Context is 32 characters each side, in this normalized text.
  - Offsets, if any are ever shared, count UTF-16 code units.
  - The spec also states the matching rule (A-F5), not only the
    normalization.

  Vectors:
  - All ten bracketed paragraphs, including John 9:39's mid-verse `⟧`,
    which is the double-space trap.
  - A poetry block, plus Luke 1:70–75's verse numbers in mid-line.
  - 2 Corinthians 6:2's `<br>`.
  - A continuation paragraph (`hebrews-2-p4`).
  - Adjacent footnote letters.
  - Matthew 20 and Romans 3 before and after their merges.
- **W2. Resolve for display, never write back: yes.** Only the reader's own
  actions write: an edit, Keep, Mark the new words. It needs the apps to do
  the same (finding 7).
- **W3. The seven markers: yes, carried by name.** N6's question flag *is*
  the `question` marker.
- **W4. The website writes the quote, the verse and an empty `offsetSpace`,
  and the app places the note on arrival** (the iOS reply's own
  preference). This uses the path that already upgrades pre-1.1 records. P1
  has to show that 1.27 and 2.0 draw nothing wrong in the meantime.
  Computing the app's paragraph position would couple the website to a
  number that moves (finding 1).
- **W5. Yes, in the iCloud adapter only.** The website writes one record
  per paragraph with a shared `groupId`, because that's iOS's physical
  shape. The logical record and the export keep one highlight (Android's
  A-F1). The spec says how a quote is cut at a paragraph boundary.
- **W6. The complete list (draft).** Every record carries `id` (existing app
  UUIDs carry over), `kind`, `schema`, `created`, `modified` (reader edits
  only), `client` (A-F11) and `contentVersion`. Anything on the text also
  carries `bookKey`, `chapter`, `verse` and `endVerse`, in the site's slugs
  as the release notes feed's `location` already uses them; OSIS is derived
  for the W3C export (A-F9). The kinds:
  1. **highlight**: colour, quote, verse copy with its date (A-F8).
  2. **note**: plain-text body, marker, an optional quote, verse copy.
     Instead of verses, its target may be a footnote's quoted words (M11)
     or a glossary term's ID (N2).
  3. **hidden passage** (N8): a verse range and an optional note to self.
  4. **bookmark** (B2): a verse, a label, and how the reader got there.
  5. **place** (B1): the place in each book, and named ribbons.
  6. **colour legend** (H1): the reader's meaning for each of the four
     colours. **Dropped 2026-10-07**; the number is kept so the others
     don't move.
  7. **concept-mark rule** (H2): a term, a book, a colour.
  8. **label** (M8): a name; records list their labels.
  9. **sheet** (S1 to S10): one structured document.
  10. **trash entry** (M7): the whole item for 30 days, then only its ID and
      deletion time.

  Plus, optionally, a reserved envelope for an encrypted body (A-F12).
  Under plan A, kinds 6 to 9 go in the generic zone (finding 10).
- **W7. Keep new addresses clear of book slugs: yes.** `/sheets/`,
  `/notebook/` and any account page are all clear. The rule: no path on the
  site may start with `<bookKey>-` unless it is a chapter or intro. The
  iOS app's claims live in this repo (`apple-app-site-association`), so
  claiming sheet links later is a change here plus an app release.

### The talk-through list

In order. The first item blocks the rest. "Lean" is the review's
recommendation, not a decision.

| # | Question | IDs | Who decides | Where it stands |
|---|---|---|---|---|
| 1 | Plan A or plan B (now **A or C**; see "One notebook, three homes") | T1, A-Q1 | BVJ with BDR | **2026-10-09:** BDR paused the spikes; the Zoom decides whether plan A is tested at all, and October 31 holds only if they resume. **2026-10-07:** BDR is torn between A and C; **BVJ clearly prefers C** (firmer after the website's sizing; not an insistence, not decided); the proposal recommends C and tests A with spikes, deciding by October 31. Before that: BDR leaned hard to A, and this review's 2026-10-05 lean, now superseded, was **A, if P1–P3 pass by the end of October.** It keeps the privacy page's promise that the site collects personal information only when someone chooses to send it, needs nobody on call, and lets the apps launch without the website. It moves work to the website (finding 6) |
| 2 | Does "LIT never holds the notes" answer the end-to-end lean (C19)? | T2, A-Q2 | BVJ | Under plan A, Apple or Google could read the notes, as they can anything else in the account. LIT never could, and there is no recovery key to lose |
| 3 | Brackets in anchors | T7 | BVJ; the apps follow | **Lean: strip** (finding 5) |
| 4 | Reading positions: shared, or separate with ribbons crossing over | T5 (A-R6 says shared) | BVJ | **Lean: share one place per book**, stored as a verse (A-F13), so stopping on the phone moves the desk's Continue reading |
| 5 | The notebook file | T3 | BVJ | **Lean, under A: keep the Markdown export and import** (item 6 needs it) and drop live save-in-place from phase 1 |
| 6 | The reader with both Apple and Android devices; the reader who wants neither sign-in | T4 | BVJ, BDR | **Lean: a known gap at launch**, with export and import; the website bridge later. The reader who wants neither keeps the notebook in the browser |
| 7 | When a mark's words are gone | A-Q6, A-F5 | BVJ, BDR | **Lean: one rule on all three.** Use the apps' rule, with the notice: place the mark on the words between the old context, keep the old words, and write nothing until the reader chooses Keep |
| 8 | What must be live on February 10, and the fallback if one platform isn't ready | A-Q3 | BVJ, BDR | Under plan A, the website can join later |
| 9 | Can the website build two storage adapters by February 10, alongside the desk? | A-Q7 | BVJ | **Sized 2026-10-07:** 16–18 sessions at launch, more to keep up ("Sizing the website's side") |
| 10 | Who owns the Google Cloud project, the CloudKit container and the spec | A-Q4, T8 | BVJ, BDR | The container is in BDR's developer account. **Lean: the spec and its vectors live in this repo** |
| 11 | The stores' privacy answers ("No data collected" on Play) | A-Q5, P3 | BVJ, BDR | Unverified under plan A |
| 12 | The apps' License screen wording | T9, A-Q10 | BVJ | **Needed by mid-October.** Draft: "The LIT Bible is licensed under CC BY-NC-ND 4.0, with added permissions: you may print, display and share any amount for noncommercial uses such as Bible studies, classes, sermons and bulletins, and you may quote it in commercial works within set limits. The full terms, including the credit line to use, are at litbible.net/read#license-terms." Android's existing "You may not distribute modified versions" stays accurate |
| 13 | Do shared sheet links need something hosted? | T10, A-M8 | BVJ | S8's links carry the sheet after the #, so they need nothing hosted. Only M14's short links need a small store, holding sheets only |
| 14 | The N8 record, and whether hiding reaches daily readings and widgets | A-Q9 | BVJ | Shape proposed in W6; both apps list every route a hidden passage must stay hidden on. **2026-10-09:** BDR wants a longer conversation with BVJ before anything beyond the reach is settled (the Zoom's item 17) |
| 15 | Colour meanings in the apps | T6 | BVJ, BDR | **Settled 2026-10-07: dropped everywhere** (BVJ agreed with BDR's lean) |
| 16 | The alignment data in the apps: N2 and H2 shown, or only carried | A-Q8 | BVJ | **Lean: carried only, at launch** |
| 17 | The QR address | A-Q11 | BVJ | Both apps agree on `https://litbible.net/romans-8/#v3-4` |
| 18 | Bookmarks vs the `bookmark` marker; whether a quote may cross a verse or paragraph boundary | A-Q13 | the three Claudes propose | **Lean: bookmarks are their own kind**, and the marker stays a note's glyph |
| 19 | Tombstones after the trash empties | A-Q14 | the Claudes | **Yes**: BDR chose rule c's option 3 (2026-10-09), a 30-day trash and then a marker kept forever |
| 20 | **The merge and overlap rules** | A-M5, A-F7, A-F10, A-Q14 | BDR, then the Claudes | **Settled 2026-10-09**: answered by BDR, and BVJ went with BDR on a note's older version (discarded; the Zoom's item 15). See "Questions for the apps" below and rules a to e. BVJ had held the website's merge engine and overlap rule for BDR's input (2026-10-05) |
| 21 | **API.bible's terms**: can the LIT accept them for the CSB, NASB and NIV? | D7, 1e | BVJ with BDR | **Closed 2026-10-11: BVJ deferred API.bible and other versions indefinitely, so nothing to accept for version 1.** Added 2026-10-08. §5.4 bars any "potentially controversial use" of the text, naming critical race theory and critical queer theory, and §3.5 lets API.bible revoke access at any time; §12 requires that licensed text not be freely copied, with a 100-verse print limit; §4.1 bars changes to the text's structure (no longer a concern, since the versions keep their own paragraphs); §26 sends disputes to Christian conciliation and binding arbitration. For BDR: whether either app uses API.bible or plans to, since the Collective would be agreeing to these terms for the apps too, and what BDR makes of §5.4. The three ways forward (accept after asking API.bible, license directly, or link out for the first release) are under D7, "API.bible's own terms". **Still unanswered**: BDR's proposal at draft 4d (2026-10-09) doesn't mention it |

Questions for the apps, to send back:
- **For the iOS instance:** finding 1 (re-anchoring and paragraph positions);
  finding 7 (offsets kept on the device); whether a different colour trims
  an existing highlight; whether restoring an old device backup can bring a
  deleted record back; whether a blockquote counts as one paragraph.
- **For the Android instance:** whether the app's text model can drop
  verse digits and footnote letters from its context strings without a
  migration.
- **For BDR:** items 1, 4, 6, 7, 8, 10, 11, 15 and 21.
- **For BDR, to know (added 2026-10-06):** BVJ wants readers able to attach
  notes to glossary entries and articles on the website (N11). Neither app
  shows those today. The ask is only that both apps carry such records
  untouched (the format's principle 6), and to say whether either app might
  show them later, especially glossary notes, since the apps already have
  the glossary.
- **For BDR (item 20): the merge and overlap rules. Answered by BDR,
  2026-10-09** (rules a to e in BDR's proposal; see "When notes collide"
  below). The website needed these before phase 1c, so it wouldn't build
  rules the apps would then undo. Each question with BDR's answer:
  1. **Which write wins.** With no store revision to go by (importing a
     file, say), the newer `modified` wins, accepting that a device whose
     clock is wrong can make an older edit win. Where a store has a revision
     (a CloudKit change tag, a Drive file version), the revision decides, as
     the format already says (A-F7).
     **BDR: the newer `modified` wins everywhere**, store revision or not
     (rule a's option 1a, "never by which device synced last"). A service's
     revision is only the "what changed since last time" cursor and the
     tiebreaker for an exact tie, and an edit time in the future is clamped
     to the service's clock on arrival. That replaces A-F7's "the revision
     decides" in draft 2.
  2. **Edits and deletions.** A record whose `modified` is later than a
     trash record's `deletedAt` comes back, and the trash record is dropped.
     That makes undo work across devices and lets an edit made offline
     survive a deletion made elsewhere. It also relies on the clock, so a
     slow clock could bring back a note someone deleted. Is that the
     behaviour both apps want?
     **BDR: yes** (rule b, option 2), "later" meaning the reader's own action
     time; the service clamps claims of the future.
  3. **A note changed on two devices.** Both versions are kept: the newer
     keeps the ID, the other becomes a second note marked `conflictOf: <id>`.
     The second note's ID is worked out from the original's ID, `modified`
     and body, so importing the same file twice doesn't add it twice. That
     would be a UUID version 8. Would either app reject a version-8 UUID?
     **BDR: no, the newer writing wins** for notes as for everything else.
     The older version (the Zoom's item 15) could have been overwritten
     (BDR's lean), kept in the trash for 30 days as "an earlier version of
     this note" (the proposal's middle way), or kept visible beside it (this
     proposal). **BVJ went with BDR (2026-10-09): it is discarded.** So
     there is no `conflictOf` copy, and the version-8 question falls away.
  4. **The trash record's fields**: `deletedId`, `deletedAt`, and `record`
     for the whole deleted record (dropped after 30 days, leaving the
     tombstone). When two devices delete the same record, the two trash
     records collapse to one: the one still holding its content, then the
     earliest, then the lowest ID.
     **BDR: a 30-day trash, then a marker kept forever** (rule c, option 3).
     The proposal's contract adds a field, the deleted record's **kind**, and
     says restoring re-creates the record under the same id. The collapse
     rule for two trash records isn't mentioned yet.
     **The website's revised proposal, built 2026-10-12 for BDR to confirm
     or change: the later deletion, with the newer content.** The survivor
     is the trash record with the later `deletedAt` (ties: the lower id), and
     it keeps whichever held copy was modified most recently. The first
     proposal above kept the earliest deletion, which rule b, answered
     since, makes wrong: an edit between the two deletions would bring back
     a record the reader deleted after editing it. Details in
     `STUDY-DESK-FORMAT.md`, kind 10.
  5. **Overlapping highlights** (A-M5). Is it Android's rule (same colour
     merges, a different colour trims the old one) or iOS's? And are marks
     that were re-found as `changed`, `verse` or `lost` left alone, so making
     a highlight never silently rewrites a mark the reader hasn't looked at?
     **BDR: Android's rule with its three details** (rule d, option 1),
     including that a highlight carrying an unread change notice is never
     touched by a new one. Settled for all three.

### Dates (superseded 2026-10-05)

The review proposed a schedule working back from February 10, 2027. **BVJ
replaced it:** the website orders its work by what makes sense for the
website, and finishes when it finishes. February 10 is BDR's goal for the
apps.
- Under plan A the apps don't wait on the website.
- Under plan B the apps' sync needs the service first, which would put it
  ahead of the website's own phases.

The format still comes first, before Christmas as Android asked.

### BVJ's answers (2026-10-05)

- **Plan A or plan B (talk-through item 1): both stay open.**
  - BVJ wants to know more about the website work each one means before
    deciding. It is laid out in `STUDY-DESK-REPLY-TO-APPS.md`, section 4.
  - BVJ asks BDR what shifted (see the correction under "Accounts and sync").
- **Two requirements under either plan:**
  - **A reader who wants neither Apple nor Google must still have a way to
    keep their notebook.**
  - **No repeated sign-in that isn't obvious, and no lost work.** BVJ named
    two reliability worries: Google Drive sync, and Safari clearing a
    CloudKit session.
- **Timing:** see "Dates" above.
- **License wording (item 12): approved as drafted.**
- **Brackets in anchors (T7): strip them.**
- **Reading positions (item 4): undecided, leaning slightly against
  sharing them.** Open to more conversation.
- **When a mark's words are gone (item 7): no preference.** Left to the
  three Claudes. Draft 1 of the format adopts the apps' approach.
- **The notebook file (item 5, T3): undecided.** BVJ wants both app Claudes'
  pros and cons first.
- **The reply goes as one document to both apps**, with platform-specific
  parts marked. That is `STUDY-DESK-REPLY-TO-APPS.md`.
- **The paragraph-position question goes to the apps now**, ahead of the
  reply. It is section 1 of that document.
- **The format drafts (W1, W6):**
  - `STUDY-DESK-FORMAT.md` holds draft 1 of the record format.
  - `scripts/lib/anchor-text.mjs` is the reference implementation.
  - `test/fixtures/anchor-vectors.json` holds the test vectors, made by
    `npm run build:anchor-vectors`.

### To be decided

BVJ asked (2026-10-05) for the less urgent questions to be listed here as
needing a decision. None blocks the format.

- **Plan A or plan C** (T1, A-Q1), with the two requirements above. Plan B
  is out under BDR's privacy wording rule (2026-10-07). The Zoom items in
  "One notebook, three homes" add: the recovery model for end-to-end
  encryption, passkeys at launch, who builds and owns the service, February
  10's scope and fallback, where shared sheet links live, and who rewrites
  the privacy page and terms.
- **Reading positions:** shared between phone and desk, or not (T5, A-R6).
- **The notebook file (D1):** a sync method, or export and import only (T3).
- **The reader with both an Apple and an Android device** (T4).
- **End-to-end encryption under the chosen plan** (T2, A-Q2).
- ~~How the reader's colour meanings appear in the apps~~ (T6): **settled
  2026-10-07, colour meanings are dropped everywhere.**
- **Ownership** of the Google Cloud project, the CloudKit container setup
  and the format spec (A-Q4, T8). Lean: the spec stays in this repo.
- **The stores' privacy answers**, including Play's "No data collected"
  (A-Q5, P3).
- **How far a hidden passage reaches** (A-Q9): daily readings, widgets,
  search, share cards.
- **Whether shared sheet links need anything hosted** (T10, A-M8).
- **Whether the apps show N2 and H2, or only carry them** (A-Q8).
- **Who looks after a service**, if plan C (T8, A-R7; Zoom item 4).
- **In the format:** bookmarks vs the `bookmark` marker
  (`STUDY-DESK-FORMAT.md`, "Still open"). The overlap rule is settled
  (rule d).
- ~~The merge rules, the trash record's fields and the overlap rule~~
  (talk-through item 20): **settled 2026-10-09**, by BDR's answers and BVJ
  going with BDR on a note's older version (the Zoom's item 15).
- **Four questions the proposal added on 2026-10-09** (the Zoom's items 14
  to 17). Three were answered by BVJ the same day: BDR's Claude drafts the
  encryption spec here (14), a note's older version is discarded (15), and
  the names stay as they are (16). **The hidden passage, at length (17),
  is still open**, for the Zoom. See the website's answers under "One
  notebook, three homes" below.

## One notebook, three homes (BDR's proposal, 2026-10-07)

**The newest record of the sync question.** Where it and the sections above
differ, this one wins. BDR's Claude wrote it with all three repos open:
"One Notebook, Three Homes", draft 2, 2026-10-07,
https://claude.ai/artifact/G4jgizQ8MTcggi4rJqez8r (anyone with the link). Its
Markdown twin, `PROPOSAL-ONE-NOTEBOOK-THREE-HOMES-2026-10-06.md`, with an
update log and checkboxes, is in BDR's LIT Handoff folder, outside every
repo. **It calls BDR "Brandon"**; this file keeps BDR and BVJ. BVJ brought it
in on 2026-10-07. It changes no code anywhere, and it replaces the
three-instance back-and-forth: on BDR's side the proposal is now the record.
**This file last read it on 2026-10-09, at draft 4d** (its header; the
footer still says 4b). Drafts 3 to 4d are summarized under "BDR's answers
and requests (2026-10-09)" below, and the sections after it are updated to
match.

**How the website answers (BVJ, 2026-10-07): through this file.** BDR's
Claude reads this repo directly, so nothing is sent by hand and no new reply
document is written; `STUDY-DESK-REPLY-TO-APPS.md` was the last. What the
website has to say goes here, on `main`, with its date.

**The website's answers to the proposal, so far (2026-10-07):**
- **BVJ clearly prefers plan C**, launched with "don't sign in" as the
  keep-it-in-your-own-cloud option and full plan A added later only if
  readers ask. A preference, not an insistence or a decision. See "BVJ's
  clear preference" below.
- **The website's side is sized**, as the proposal asked: plan C 12–15
  sessions if BDR's side builds the service, plan A 16–18 at launch plus the
  upkeep, both as a reader's choice 26–31. See "Sizing the website's side".
- **M14's short share links stay for signed-in readers** (a
  recommendation, not decided); unsigned readers keep S8's long links and
  printed codes. See "BVJ's clear preference".
- **The encryption spec and its test vectors would be written here**, in
  November, if plan C goes ahead (the sizing's first row).
- **Capacity differs**: BVJ is on Claude Pro, BDR on the lower Max plan. So
  it favours BDR's side building the plan C service (Zoom item 4's
  recommendation), and the website's own pieces on the apps' path staying few
  and small. See "Capacity" under the
  sizing.
- **Colour meanings are dropped everywhere** (Zoom item 6; BVJ, 2026-10-07,
  agreeing with BDR's lean). The format loses the `legend` kind.
- **The website's margin is the reader's choice** (notes shown or hidden;
  dots where there isn't room), beside the Notebook panel's list. Website
  only; nothing changes for the apps.
- **2026-10-09: drafts 3 to 4d read**, and BVJ answered what they raised
  (BDR's answers and requests are in the next section):
  - **A note's older version (Zoom item 15): as BDR leans.** The newer
    writing wins and the older version is discarded, so rule a is settled
    for every kind. The website drops its "keep both" plan, its `conflictOf`
    copy and the version-8 UUID question.
  - **Pinned footnotes: agreed, by November, as part of phase 1c.**
  - **The encryption spec (Zoom item 14): agreed.** BDR's Claude drafts the
    spec and its test vectors as a pull request here. **BDR's scope in this
    repo is widened** beyond /apps and /privacy (BVJ: nothing BDR does can
    merge without review and approval). His Claude works freely on /apps,
    /privacy, encryption and app syncing, and anywhere else asks BDR "are
    you sure?" before going ahead, rather than refusing.
    `BDR-ONBOARDING.md` says so.
  - **Whether plan A is tested at all (the paused spikes): on the Zoom's
    agenda.**
  - **The apps' launch sheet: agreed.** Sync is announced once in What's
    New and kept out of the onboarding tour.
  - **Naming (Zoom item 16): the names stay, and they differ on purpose.**
    The **Notebook** is the website's panel and holds more than the reader's
    notes. Its **My Notes** tab is the apps' My Notes; its other tabs (This
    verse, Greek) are things the apps don't do. **"Study Desk"**
    is the project's name, never shown to readers, and covers more than the
    Notebook: the margin notes, the menus' actions, sync and encryption.
    One consequence, noted here rather than ruled: the proposal's draft
    What's New sheet says "the LIT Study Desk on your computer", a name
    readers never see, so that line needs other words.
- **2026-10-22: for BDR's Claude to notice. Bookmarks and ribbons are
  becoming one feature, "Bookmarks"** (BVJ; E9 under "Fixes and
  experience"). Bookmarks (B2) and named ribbons (B1) were two ideas to
  readers, and the website is merging them, with the ribbon's behavior and
  the existing red bookmark glyph as the one mark; the notebook's Places section goes,
  leaving "Continue reading" and the reader's own bookmarks. **It matters
  for syncing:** the format's `bookmark` and `place` kinds change (a
  bookmark gains a name and an optional following flag; a `place` with
  `ribbon: true` retires), so **the apps need not build ribbons as a
  separate kind** (R4 asked for "bookmarks and named ribbons"), and
  whether reading places sync (kind 5) is still open. Nothing is built or
  changed in the format yet; the website will say so here when it is, with
  new merge vectors. **Also**: BVJ strongly recommends that the
  `bookmark` note marker be renamed `ribbon` (E10; retiring it is the other
  option); either touches both apps' seven markers. **BDR, 2026-10-23: E9
  accepted, and the marker is renamed `ribbon`** (the format says so; the
  apps file the read-old-write-new change as NB12 on each roadmap).
- **2026-10-26: for BDR's Claude. The record format now matches the
  website's code, and rule e's guards are built** (Full Audit 1, phases
  FA1-c, FA1-d and FA1-f; `STUDY-DESK-AUDIT-1.md`). What the apps should
  pick up from `STUDY-DESK-FORMAT.md` before the format freezes:
  - **Rule e's two guards** ("Finding a mark again"; BA8). Where the quoted
    words occur more than once, an occurrence counts only when 8 characters
    of context agree; a `changed` region is at most twice the quote plus 16
    characters. Past either, that step fails and the mark ends on its
    verses with the notice. The numbers are the website's, for BDR to match
    or change (Android's own limit is "about twice plus a little").
    **`test/fixtures/anchor-vectors.json` is spec version 2**, with five new
    cases and the two numbers in its header, and the chapter vectors for
    Luke 1 and Luke 22 refreshed from today's text.
  - **The merge vectors are version 2** ("Clocks", "A clock running ahead";
    BA4, BA11, BA12): a future time is clamped on every arrival, against a
    cap that is an export file's own `exported` time when that is earlier,
    and a record that had to be clamped never beats anything the receiving
    side holds. One id is one record: a different `kind` under a known id is
    skipped.
  - **Undo and redo** (kind 10; BA7): what an undo or redo puts back is
    stamped fresh, a trash record's `deletedAt` included, and undoing an
    add deletes through the trash.
  - **Corrections, no change of rule** (BA14): times end in `Z` (an offset
    is refused); a tombstone keeps every field but `record`; the Web
    Annotation `FragmentSelector` is `v3-4`, without `#`; a `hidden`
    record's note to self is proposed as `body`.
- Everything else in the proposal (the remaining Zoom items, the sequence)
  waits on the Zoom.

### BDR's answers and requests (2026-10-09)

The proposal's drafts 3 to 4d, newest last. Each item says whose it is to
settle.

- **Draft 3 (2026-10-08):** BDR's Claude read this file (PRs #282 to #288)
  and now takes the website's answers from it. Its newest log entry (dated
  2026-10-10) reads the 1c commits of October 8 and 9 as build progress,
  not answers.
- **Draft 4: rules a to e answered** (talk-through item 20): "a1 by writing
  time (for notes too), b2, c3, d1 with the three details, e2 and e2." Four
  are as the website proposed. Rule a is not: the newer writing wins for
  notes too, by the reader's own edit time, where the website had kept both
  versions. Details under "When notes collide" below.
- **Draft 4: two definitions BDR asked for**, "the notebook" (all the kinds,
  wherever stored) and **"Two roads, one notebook"**, how the apps sync under
  plan C without syncing twice. iCloud keeps carrying records between a
  reader's Apple devices as today; signing in adds the service as a second
  road on that device; a record arriving by either road goes through the
  same merge rule; a device sends only what is newer than the service last
  confirmed, so nothing loops; the first sign-in uploads the whole notebook
  once, encrypted; signing out removes the road and deletes nothing. The
  alternative, moving the notebook off iCloud at sign-in, isn't recommended.
  On Android, signing in adds the only road (Auto Backup is a safety net,
  not a road). iOS's Claude picks the implementation. A recommendation for
  the apps; nothing changes for the website.
- **Draft 4b: the plan A spikes are paused** at BDR's word. The kit stays
  ready; the credentials and the Android probe wait on BDR's word. The Zoom
  decides whether A is tested at all, and October 31 holds only if the
  spikes resume.
- **Draft 4c: offering sync in the apps, both ways approved by BDR:**
  1. **A What's New sheet** on the first launch after the release that
     brings sync. BDR's lean, which **BVJ agreed to (2026-10-09)**: announce
     sync once there, and keep it out of the onboarding tour every new
     reader sees.
  2. **"Connect your phone" on the website**, under plan C, in the same
     release if the schedule allows, otherwise the next. After a reader signs
     in, the Notebook panel shows a link and a QR code; the service mints a
     single-use code that lives about ten minutes; the app opens with it,
     asks "Connect this iPhone to your notebook?", and on yes is signed in.
     It needs a small endpoint on the service, the panel here, and each app
     claiming one new address under `/account/`. BDR drafted the panel's
     words: "Sync with the app. Scan this code with your phone's camera, or
     open this link on it, to turn on sync in the LIT Bible app. The code
     works for ten minutes." Say "sync" and "connect", never "pair". The
     final wording had waited on item 16, which BVJ answered the same day
     (the names stay as they are).
- **Draft 4c: four new Zoom items**, so the list is now seventeen (under "The
  Zoom" below):
  - **14. BDR's Claude drafting the encryption spec.** BDR: yes, the spec
    and its test cases, as a pull request to this repo that BVJ reviews,
    once BVJ agrees. It widens BDR's scope here beyond /apps and /privacy.
    **BVJ agreed (2026-10-09)** and widened that scope (the website's
    answers, above; `BDR-ONBOARDING.md`).
  - **15. A note's older version under rule a**: overwritten (BDR's lean),
    kept in the trash for 30 days as "an earlier version of this note" (the
    proposal's middle way; BDR finds it "a bit much"), or kept visible
    beside the newer one (this file's plan). **BVJ went with BDR
    (2026-10-09): overwritten.**
  - **16. What readers call the synced marks, and whether "Study Desk"
    stays.** BDR: the "Notebook" framing came from the Markdown-file idea,
    now down to export and import; underneath, it is "feature parity and user
    content sync between the site and the apps". Options: (A) plain words,
    "My Notes" everywhere and "sync" for the feature; (B) "Notebook"
    everywhere, the apps renaming My Notes; (C) a new metaphor (Margins,
    Commonplace book, Journal). BDR leans A, possibly B, and wants a frank
    conversation about dropping "Study Desk". The proposal notes the website
    already says "My Notes" for the panel's tab and "My Notebook" for the
    menus' row, and that readers meet Notebook, Places and Sheets, not
    "Study Desk". **BVJ's answer (2026-10-09): the names stay, and differ on
    purpose.** The Notebook is the website's panel, holding more than the
    reader's notes; its My Notes tab is the apps' My Notes; "Study Desk" is
    the project's name, never shown to readers (the website's answers,
    above).
  - **17. The hidden passage, at length.** BDR wants a longer conversation
    before anything beyond its reach is settled: whether a reader can hide a
    passage from the apps themselves or only from the desk; the reach
    (agreed in principle: everywhere scripture appears, including daily
    readings, search, share cards and Siri); where the controls live in the
    apps; what the veil looks like and says; what a screen reader hears;
    whether the reader's private note shows on the veil or only on a tap;
    and whether hiding should ever expire.
- **Draft 4d: pinned footnotes, a tenth kind** (BDR). A translator's note
  the reader wants to come back to, kept by a Pin button on the footnote.
  Android ships them in 1.3 (October) and iOS in November. **The website is
  asked to match by November**: a Pin button wherever a footnote is read (the
  popover and the end list), a "Pinned footnotes" list in the panel, and the
  change notice when a pinned footnote is rewritten. The record carries the
  book, chapter and verse and the footnote's full text in the shared
  normalized form, **never its letter** (letters shift whenever a footnote is
  added earlier in the chapter), plus its order among that verse's footnotes
  where several read the same. It is found again by verse, then by its
  words. Readers see "Pin", "Unpin" and "Pinned footnotes" on all three.
  **BVJ agreed (2026-10-09): by November, as part of phase 1c.** The kind
  joins format draft 2.
- **Not answered in draft 4d**: API.bible's terms (talk-through item 21);
  the rule for collapsing two trash records of one deletion (item 20,
  question 4; the website went ahead with its own proposal on 2026-10-12,
  the later deletion with the newer content, for BDR to confirm or change);
  Android running the shared test cases ("Approved as a unit
  test; not yet run"); the license link, still planned for Android 1.3 and
  iOS 2.0, 2.0.1 or 2.1.

### Three plans, not two

The old plan B splits in two:
- **Plan A, each reader's own cloud.** As in "BDR's proposal" above: the
  app's iCloud private database or a Drive app-data folder, with the website
  reaching in. The privacy page could say "LIT never holds your notes".
- **Plan B, full LIT accounts**: passwords, two-step codes and reset emails,
  plus Apple and Google. This is "Accounts and sync" as first written. At
  best the privacy page could say "LIT holds your notes encrypted and
  doesn't read them".
- **Plan C, a thin LIT sync service, end-to-end encrypted.** A Worker with D1
  at its own subdomain, outside `/api/`. Sign in with Apple, Sign in with
  Google, or a passkey; no passwords, two-step codes or reset emails. Each
  row holds the reader, the record's id, a revision, the edit time and the
  deletion time in the clear, and everything else as ciphertext only the
  reader's devices can open. Thirty days after a deletion it drops the blob
  and keeps the row as the marker. iCloud keeps syncing a reader's Apple
  devices as today, and no-login stays the default. The privacy page could
  say "LIT holds your notes encrypted and can't read them". About $5 a
  month.

Older text in this file that says "plan B" means a LIT service in general,
which is now B or C.

**BDR's positions (2026-10-07):**
- **Conflicted between A and C.** BDR would lean A if it can be shown to
  work, because "no login needed in the apps" is the most it-just-works flow
  the apps can offer. BDR's first reaction had leaned C.
- **A wording rule for the privacy page:** if it changes, it must be able to
  say LIT *can't* read the notes, not merely doesn't. That rules out plan B,
  and plan C without end-to-end encryption. So under C, end-to-end ships
  with the first synced release, and sync without it is not a fallback.
- **Passkeys over passwords** with two-step codes for any LIT-run sign-in.
  Under A there is no LIT sign-in to design.
- **Leans against colour meanings** (H1) on any platform.
- BDR confirmed that "Sign in with Apple" meant the familiar sign-in
  buttons, which is plan C, not CloudKit's web sign-in.

**BVJ's clear preference (2026-10-07), not an insistence and not a decision:
launch plan C, with "don't sign
in" as the keep-it-in-your-own-cloud option, and add full plan A later only
if readers ask for it.** C already contains a version of A: an iPhone reader
who never signs in keeps today's iCloud sync, and LIT holds nothing. What
full A would add later is the website reaching into iCloud and Drive, and
Android syncing through Drive. The format keeps the records the same in any
store, so a second home stays an addition, not a redesign; the format freeze
should keep it that way.

What "don't sign in" means on each surface at launch:
- **iPhone, iPad and the Mac app:** iCloud sync between the reader's Apple
  devices, as today.
- **Android:** the notes stay on the device, with Auto Backup restoring them
  on a reinstall. No sync between Android devices without signing in.
- **The website:** the notebook in the browser, with export and import.

It began as a lean and became a clear preference once the sizing below
showed C's website side as the smaller one at launch and far the smaller to
keep up.

Every feature that doesn't truly need cross-device sync works without
signing in at all. The desk is already built that way (phases 1 to 3 run in the browser, and
no-login stays, 2026-10-01), so this costs nothing extra. What then needs a
sign-in: the notebook syncing between devices, and what rides on it ("What's
new for you" and Continue reading following the reader, the devices page).
One decided feature needs a sign-in without being sync: **M14's short share
links**. Recommendation (not decided): keep them for signed-in readers. A
service that hosts encrypted content it can't read, for anyone without an
account, is a home for abuse nobody can moderate. Everyone still has S8's
long links and printed codes, which need nothing hosted.

**BDR's decisions for the apps** (BDR's to make):
- **Android shows bookmarks** in its first synced release, as a Bookmarks
  list in My Notes; ribbons if the schedule allows (2026-10-07).
- **A hidden passage (N8) stays hidden everywhere scripture appears** in the
  apps, with a solid veil on Android before Android 12.
- **2026-10-05:** brackets are stripped from the apps' anchoring text (T7),
  and **Android's highlight-overlap rule is adopted on iOS**, which answers
  the apps' half of item 20's question 5.

**The proposal recommends plan C** (a recommendation; nothing is decided).
Its reasons:
- It is the only plan that meets both of BVJ's requirements: a reader who
  wants neither Apple nor Google has a way in (a passkey), and nobody is
  signed out without noticing.
- Plan A isn't serverless in practice. Silent Google reconnection from a
  browser needs a server holding refresh tokens, a credential to readers'
  Drive folders. A server holding records LIT can't read is the smaller
  trust surface.
- Plan A moves the hardest work to the website, which hasn't sized it
  (finding 6).
- Plan B's cost is mostly the passwords.
- The service is the shape of the contact-form Worker this repo already runs.

What would flip it to A: the spikes below pass, BVJ sizes the website's side
and accepts it, and both accept the two readers A leaves out at launch. Then
"LIT never holds your notes", with no recovery code for anyone to keep, is the
stronger promise.

Where each plan "just works":

| | Plan A | Plan C |
|---|---|---|
| iPhone and iPad | Zero taps; sync is already on | One tap per device, only if the reader turns sync on |
| Android | One Google consent; a sync engine built from nothing | One Google tap; a sync engine built from nothing |
| The website | iCloud web sign-in (Apple ID, password, two-step code); Google's popup hourly unless a token server is added; Safari forgets a reader who stays away a week | One tap, and the reader stays signed in |
| Recovery | Nothing new; the reader's Apple or Google recovery covers it | A recovery code to keep |
| Left out at launch | A reader with an iPhone and an Android device; a reader who wants neither account | Nobody |
| On call | Nobody, unless the token server is built | Someone, for a small service |

Under A the iPhone app still needs a release, for the new kinds and the
one-time permanent iCloud schema. "Works today" is true only of the website
reading existing iPhone notes.

### Proving plan A: the spikes

**Paused (BDR, 2026-10-09).** The kit stays ready and nothing below is
withdrawn. If the Zoom wants plan A tested, the spikes resume on BDR's word
and the decision date moves with them; otherwise the Zoom decides on the
evidence already here.

P1 and P2, turned into tests with pass marks agreed before anyone runs them,
so the result settles the question. They are throwaway pages outside all
three repos. The kit is written (BDR's LIT Handoff `spikes/` folder: both probe
pages, a README, a results sheet with the pass marks, a config template);
the Android probe app for spike 2 isn't.

- **BDR creates the credentials** (about an hour): a CloudKit web token for
  the development environment, a throwaway Google Cloud project (Drive API,
  an Android and a web client, the consent screen in testing), and two test
  Apple IDs, one with Advanced Data Protection.
- **Spike 1, iCloud from a web page** (two to three days, plus an eight-day
  wait). The sign-in steps in Chrome and Safari; reading every field; **a
  note the web writes in the app's own shape, appearing correctly in 1.27
  and 2.0 (the make-or-break test)**; editing an app note from the web; an
  app edit keeping a field only the website wrote; deleting; a note several
  thousand characters long, and where Apple moves text into an attachment;
  coming back after eight days away in Safari; the Advanced Data Protection
  account; fetching only what changed.
- **Spike 2, the Drive app folder from a phone and a web page** (about two
  days). Both see the same folder; what a web reader sees when the hour-long
  token runs out (this decides the token server); the phone a day later;
  several Google accounts on one phone; disconnecting LIT in Google's
  settings; changes since a saved cursor; a full quota (from the docs, not
  simulated).
- **Desk research:** the stores' privacy answers under A, and **BVJ's sizing
  of the website's two adapters, the bridge for mixed readers, and a token
  server** if spike 2 needs one.

**A wins** if the write, edit, extra-field and delete tests pass on both app
versions; the eight-day and Advanced Data Protection results are known and BVJ
accepts their cost to readers; Google's hourly behaviour is acceptable or a
token server is accepted; BVJ accepts the sizing; and both accept the two
uncovered readers at launch, with export and import as their way. **C wins**
if the write test fails on the version readers have, or the web's costs to
readers are judged too high. Proposed: **decide by October 31**, which now
holds only if the spikes resume (paused 2026-10-09). The format
work, and the app work marked "whatever the plan", don't change either way.

### When notes collide: rules a to e

Item 20's five questions, restated with their alternatives for BDR to
approve. The recommendation was "a2 for notes and a1 for the rest; b2; c3;
d1 with the three details; e2 and e2". **Answered by BDR, 2026-10-09: "a1
by writing time (for notes too), b2, c3, d1 with the three details, e2 and
e2."** BVJ went with BDR on the one point left to them, a note's older
version (the Zoom's item 15, 2026-10-09), so all five are settled.

- **a. A note edited on two devices before they sync:** recommended: keep
  both, and the reader picks. Highlights, bookmarks and places: the later
  write wins. (Question 3.)
  **BDR's answer: the newer writing wins, for notes as for everything else**,
  judged by the reader's own edit time, "never by which device synced last".
  The service's revision is only the "what changed since last time" cursor
  and the tiebreaker for an exact tie, and a device whose clock claims the
  future is clamped. That corrects the format's draft 1, which let a store's
  revision decide (A-F7). **The older version is discarded** (BVJ, going
  with BDR, 2026-10-09; the Zoom's item 15).
- **b. Deleted on one device, edited on another:** the later action wins; the
  service's revision decides where there is one, so clocks matter only
  without it. (Question 2.)
  **BDR's answer: yes**, with "later" meaning the reader's own action time,
  as in rule a. The trade-off is a device with a badly wrong clock, which is
  rare; the service clamps claims of the future.
- **c. The trash:** 30 days, then a marker of a few bytes kept forever, so a
  stale backup can't revive the note. (Question 4.)
  **BDR's answer: yes.** (It would also have held rule a's earlier
  versions, had item 15 gone that way; it didn't.)
- **d. Overlapping highlights:** Android's rule, which BDR ruled for iOS.
  **The rule itself is settled for all three**: the website matches BDR's
  decision (BVJ, 2026-10-07, who would have preferred letting highlights
  overlap but defers to the apps' reconciled rule). Its three details,
  **approved by BDR on 2026-10-09**: highlights in different paragraphs never merge; a
  trimmed remainder loses stray spaces at its edges; and a highlight carrying
  an unread change notice is never touched by a new one, since its old words
  are what the notice quotes. (Question 5.)
- **e. Finding a mark after the wording changes**, two guards on draft 1's
  `changed` step. A **size limit**: never guess a region much longer than
  the original (Android's is about twice plus a little). A **context
  floor**: with repeated words ("Amen."), trust a choice only when enough
  context matches. Past either, the mark goes on the whole verse, with the
  notice.
  **BDR's answer: both guards** (option 2 for each). In every uncertain case
  the reader sees the notice the apps already show, with its actions (Keep,
  Re-read in context, Delete).

### To freeze before Christmas (format draft 2)

Rules a to e as BDR answered them (2026-10-09), each with a test case, and:
- **Which write wins**: the newer `modified` on every store and for every
  kind (rule a); a store's revision is the change cursor and the tiebreaker
  only, and a future `modified` is clamped on arrival. The older of two
  versions of a note is discarded (BVJ, going with BDR, 2026-10-09).
- **The trash record** carries the deleted id, the deletion time, the
  deleted record (dropped after 30 days) **and its kind**; restoring
  re-creates the record under the same id (the proposal's contract,
  2026-10-09). The website's provisional record has no kind yet.
- **Pinned footnotes, a tenth kind** (BDR, 2026-10-09; see "BDR's answers
  and requests"): the verse, the footnote's full normalized text, never its
  letter, and its order among identical footnotes in one verse.
- **Records the website writes carry a value telling the apps "place me
  from my verses and quoted words".** This corrects W4: on shipped iOS a
  blank placement field means "legacy", so a note written with an empty
  `offsetSpace` would never reach the page. iOS proposed the new value.
- Context is 32 characters each side of a quote, in the normalized text
  (both apps agree).
- Bookmarks are their own kind; the `bookmark` marker stays a note's glyph
  (agreed). **Two changes proposed 2026-10-22 (BVJ), to settle before this
  freezes**: named ribbons fold into bookmarks (E9), and the marker is
  renamed `ribbon` (E10). **Both settled by BDR, 2026-10-23: E9 accepted,
  E10 taken as the rename.** The first retires kind 5's `ribbon: true`; the
  second touches both apps' seven markers (each reads `bookmark` as
  `ribbon` and writes `ribbon`).
- A reading place is a verse, one per book, whether or not places sync.
  (With E9, "Continue reading" is the only place the reader doesn't make.)
- Notes on glossary entries and articles (N11) name the entry by its id and
  the article by its slug, with a rule against renaming article files.
- **Under plan C the encrypted envelope is the standard wrapper**, not a
  reserved field: id, revision, edit time and deletion time in the clear,
  the rest encrypted. All merging happens on the reader's devices, which the
  format already assumed.

### Who builds what

Under plan C with end-to-end encryption:
- **Website (BVJ):** phases 1c, 1d, 2 and 3 in the website's own order.
  Asked of it on 2026-10-09: pinned footnotes, in phase 1c by November
  (BVJ agreed), and under C, "Connect your phone" with the sync work.
  Phase 4: one connector to the service, connection status and "Reconnect",
  edits queued offline, the conflict screen (with rule a settled as "the
  newer writing wins", two versions of a note no longer reach it), export
  and import. The
  encryption layer in the browser (the notebook key, the recovery-code
  screen, approving a new device). Sign-in pages that work on every device.
  Enforcing the full CSP. The privacy page and terms (shared with BDR) and a
  "Ways to keep your notebook" page. Sheet links on the service, with the
  sheet's key in the part of the link browsers never send.
  **Under A instead:** two adapters, the bridge, the token server, and
  following the iCloud schema as it grows.
- **iOS (BDR), whatever the plan:** the license link; the bracket strip;
  placing marks by each paragraph's permanent id and searching the whole
  chapter when needed (finding 1: marks made before 08-18 in Matthew
  20:17–34 and before 09-06 in Romans 3:18–31 may sit on the wrong sentence
  today); keeping offsets on the device, so a content update writes nothing
  to iCloud (finding 7); a Recently Deleted trash; bookmarks and ribbons; the
  hidden passage everywhere; the new record fields; different-colour
  trimming; two small parser fixes; export and import with a registered file
  type; VoiceOver announcing highlights. **Under C:** Sign in with Apple or a
  passkey (never required), a sync client, in-app account deletion, the
  privacy label, the notebook key in the Keychain with the recovery code,
  and two sync engines side by side (iCloud between a reader's Apple
  devices, the service as the hub), unless iOS's Claude picks a separate
  store while signed in. **Under A:** deploy the permanent iCloud schema,
  and prove the app takes records the website wrote.
- **Android (BDR), whatever the plan:** the license link (1.3); searching the
  whole chapter when a paragraph is retired; the bracket strip and shared
  normalization; one migration for the new fields and a raw copy of each
  record, since Android's backup reader drops fields it doesn't know today;
  a per-book reading place as a verse; the Bookmarks list; the hidden
  passage; TalkBack announcing highlights; export and import through the
  system picker; the shared test cases as a unit test. **Under C:** Google or
  a passkey through Credential Manager, a sync client, account deletion, the
  key in the Keystore with the recovery code, the Data safety form. **Under
  A:** Drive app-data sync from nothing, and a named owner for the Google
  Cloud project (deleting or re-issuing it strands every reader's synced
  notes).

The shared test cases: iOS matched 556 of 558 verses (the two misses are
small parser bugs, filed); Android has approved them as a unit test, not yet
run.

**Hidden-passage controls in the apps** (BDR asked: the Format menu or
Settings?). The proposal recommends no Format-menu entry: the veil carries
each passage's controls, My Notes lists hidden passages, and a quiet
"Hidden passages" Settings page holds the "show all for now" override and
the explanation. It also asks whether the apps should let a reader hide a
passage from the selection menu. BDR's to decide, and part of the longer
conversation BDR asked for (the Zoom's item 17, 2026-10-09).

### The Zoom: BVJ with BDR

Seventeen items since draft 4c (2026-10-09; thirteen in draft 2), each with
its options in the proposal. Not yet held. **The proposal's
recommendations, none decided:**
1. **Where notes live:** C on the evidence so far. With the spikes paused
   (2026-10-09), the call decides whether plan A is tested at all (on the
   agenda, BVJ, 2026-10-09); if it is, the spikes take about three weeks and
   the decision date moves with them.
2. **End-to-end encryption and recovery:** K1 at launch. The first device
   makes a key kept in its secure storage; a new device gets it by approval
   from one that has it (a short code) or by the recovery code shown once at
   setup. Lose every device and the code, and the notes are gone. K2 (the
   passkey carries the key) to investigate later; K3 (encryption at rest
   only) is ruled out by BDR's wording. Agree now the sentence the setup
   screen says about a lost code. End-to-end rules out searching notes on the
   server, computing "What's new for you" there, and staff ever recovering a
   note, all of which the plan already does on the device.
3. **Passkeys** at launch if the schedule holds once end-to-end is sized,
   otherwise first after launch; the reader who wants neither account keeps
   the browser notebook with export and import meanwhile.
4. **Who builds and owns the service:** a separate small repo, built by BDR's
   side, deployed to BVJ's Cloudflare, following this repo's conventions with
   BVJ reviewing. Shared ownership with a one-page runbook. Name who owns the
   Cloudflare account, the Apple developer account and the Google Cloud
   project. **Capacity supports this** (see "Capacity" under the sizing): BVJ
   is on Claude Pro and BDR on Max, so the service would cost the website's
   side the most if it were built here.
5. **Continue reading across devices:** one place per book if BVJ can live
   with it, separate places if not (BVJ leaned slightly against,
   2026-10-05).
6. **Colour meanings (H1): decided 2026-10-07, dropped everywhere.** BVJ
   agreed with BDR's lean, so it comes off the Zoom's list. Each colour kept
   a second visual cue (C4) until BVJ dropped it on 2026-10-09 (a tint only).
7. **The notebook file (D1):** export and import only.
8. **The stores' declarations:** accept that "No data collected" ends (for
   certain under C, probably on Android under A). The privacy policy changes
   before the apps do.
9. **Shared sheet links** live on the service, encrypted, with the key in
   the link's fragment. (Item 13's lean had needed nothing hosted.)
10. **February 10:** aim for full sync with end-to-end in both apps, and
    declare the fallback now: the apps ship bookmarks and ribbons, the trash,
    the hidden passage, the paragraph fix and export and import, and sync
    follows in the next release, with iOS on iCloud throughout.
11. **Glossary and article notes (N11):** carried unseen in the apps at
    launch; whether the apps show glossary notes later.
12. **The privacy page and terms:** the website's Claude drafts once the plan
    is chosen, BDR reviews the app parts, and terms with a minimum age are
    new.
13. **A reader with an iPhone and an Android tablet:** C covers them; under A,
    agree whether it's an accepted gap.
14. **BDR's Claude drafting the encryption spec and its test cases** as a
    pull request here: **decided 2026-10-09**, BVJ agreeing with BDR, and
    BDR's scope here widened. Off the Zoom's list.
15. **A note's older version under rule a:** **decided 2026-10-09**,
    overwritten (BVJ went with BDR). Off the Zoom's list.
16. **What readers call the synced marks, and whether "Study Desk" stays:**
    **decided 2026-10-09** by BVJ: the names stay, and differ on purpose.
    Off the Zoom's list.
17. **The hidden passage**, at length (BDR, 2026-10-09). Still for the Zoom.
Items 14 to 17 are described under "BDR's answers and requests (2026-10-09)",
and BVJ's answers under "The website's answers to the proposal".

### Proposed sequence to Ash Wednesday

- **By mid-October:** BDR approves rules a to e (they unblock phase 1c,
  so as soon as possible, mid-October at the latest; BVJ, 2026-10-07). **Done 2026-10-09**,
  item 15 included. The spike credentials wait, since the spikes are paused.
  The Zoom decides whether plan A is tested and, for C, settles
  end-to-end, passkeys and ownership; Android runs the shared test cases.
- **October:** the spikes (about three weeks, mostly the eight-day wait),
  only if the Zoom wants them.
  Android 1.3 with the license link; iOS 2.0 (about October 15), with the
  link or in 2.0.1 or 2.1. **A or C at the Zoom, or by October 31 if the
  spikes resume.**
- **November:** format draft 2 becomes the freeze candidate. Under C, the
  envelope, the service scaffolded in development, and the key flow agreed
  across all three; under A, the permanent iCloud schema designed whole and
  Android's Drive sync designed. iOS 2.1 ships, and app sync work starts.
- **By December 24:** the format frozen; the service on a staging address;
  website phases 1c and 1d done or close.
- **January:** both apps build sync with encryption; account deletion; store
  forms; the privacy page and terms live before anything public.
- **February 10, 2027:** both apps live with sync. The website's connector
  lands whenever BVJ reaches it; sheets may come first for Lent.

**The website still builds in its own order** (BVJ, 2026-10-05). The
schedule's biggest risk, by the proposal's own account, is end-to-end
encryption: a medium-sized piece on each of the three sides.

### Sizing the website's side (2026-10-07)

The proposal asked BVJ to size the website's work (finding 6, A-Q7). These
are estimates, good to about half again either way. The unit is a
**session**: one focused build ending in one reviewed PR, the size of phase
1b (#277, about 1,900 lines). Each also costs BVJ a review, and the sync work
costs BVJ hand testing on real accounts and devices besides. Work every plan
needs (the merge engine, the local notebook, export and import, the format
freeze) isn't counted.

**Plan C, with the service built by BDR's side (Zoom item 4's
recommendation):**

| Piece | Sessions |
|---|---|
| The encryption spec and its test vectors, shared with both apps: the envelope, wrapping the notebook key with the recovery code, approving a new device. Written here, like the anchor text. **Due in November; the only website piece the apps' February 10 waits on** | 2 |
| The encryption layer in the browser: the notebook key, the recovery-code screens, approving a new device. It also builds most of D5's lock, since the two share one key (C6) | 3 |
| The connector: the sync loop, edits queued offline, status and "Reconnect", the conflict screen, merging the browser's notebook into the account at first sign-in (C5) | 3–4 |
| Sign-in and account pages on every device (C1): Apple, Google, passkey; adding a way in; devices and "sign out everywhere"; deleting the account | 2 |
| Passkey link files (`webcredentials`, `get_login_creds`) and enforcing the full CSP, after a week of the report-only data | 1–2 |
| The privacy page, terms with a minimum age, "Ways to keep your notebook", D6's wording | 1–2, plus BVJ's own writing |
| **Total** | **12–15**, plus reviewing three to five service PRs from BDR's side |

If the website builds the service too, add 7–8: sign-in (Apple, Google,
passkeys, linking, sessions) 3; the records API with its revision check,
change cursor and the 30-day sweep 2; deletion, Apple token revocation, the
web deletion page and rate limits 1–2; tests, runbook and
`DISASTER-RECOVERY.md` 1. That is 19–23 in all.

**Plan A, launch scope:**

| Piece | Sessions |
|---|---|
| The iCloud adapter: CloudKit JS sign-in; the app's own records, sliced per paragraph, with the new placement value; the separate zone for website-only kinds; change tokens and change-tag conflicts; long notes as attachments; what an Advanced Data Protection reader sees. Needs BDR for the web token and every production schema deploy | 5–6 |
| The Drive adapter: Google's browser sign-in, one file per record, the change cursor, version conflicts, a full quota, the reconnect | 3 |
| The token server, if spike 2 shows hourly popups (likely to fail BVJ's "no sign-in that isn't obvious"). It holds a credential to every connected reader's Drive folder, and someone is on call for it | 2–3 |
| The connector over two stores, and choosing which cloud | 4 |
| CSP, the privacy page (simpler: "never holds"), D6's wording | 2 |
| **Total** | **16–18**; 19–23 with the bridge for mixed readers (3–5), which can come later |

Plan A also costs more after launch: **every change to the iOS app's iCloud
model is a website change**, tested against real Apple accounts, for as long
as both exist. Under C the website and the apps change only the shared
format, together. Google's review of the Drive permission is unchecked.

**Both, a choice per reader:** about **26–31**. C's 12–15, plus A's two
adapters and token server (10–12), plus a choice screen, a pointer that tells
a new device where the notebook lives, and moving a notebook between homes
(3). Roughly double either plan, with both plans' risks on the schedule.

**Where that leaves it.** C's website side is about the size of phase 3
(sheets), and only its first two sessions sit on the apps' path to February
10. A's is somewhat larger at launch, much larger to keep up, and none of it
is on the apps' path; website readers wait for it instead. The two biggest
unknowns are the device-approval step under C, the newest of these pieces
to all three teams, and whether Core Data accepts website-written records
under A (spike 1).

**Capacity: the two sides don't have the same amount of Claude** (BVJ,
2026-10-07). BVJ works on the **Claude Pro** plan; BDR has the **lower of the
two Max plans**, about five times Pro's usage. Every session above runs in
BVJ's Claude, so Pro's usage limits set the website's pace, and a
website session takes more calendar time than the same work on BDR's side.
What follows:
- **Work that could live on either side goes better on BDR's.** Above all the
  plan C service (Zoom item 4): building it here would add 7–8 sessions to
  the side with the least room.
- **It counts against plan A**, which puts its largest pieces, both
  connectors and the token server, on the website.
- **The website's pieces on the apps' path should stay few and small**: the
  encryption spec and its vectors (November), reviewing the service's PRs,
  and the privacy page and terms.
- **BDR's Claude could draft website-side pieces** where that saves BVJ's
  usage, as pull requests BVJ reviews. The encryption spec is the obvious
  candidate, with its test vectors kept in this repo. **Decided 2026-10-09:**
  BDR's Claude drafts the spec and its vectors, and BDR's scope here is
  widened to /apps, /privacy, encryption and app syncing, with an "are you
  sure?" anywhere else rather than a bar (`BDR-ONBOARDING.md`). That takes
  the spec's two sessions off the website's side.
- Phases 1c to 3 keep their own order and pace (BVJ, 2026-10-05).

### Corrections it makes

- **W4** (above): a blank placement field is "legacy" on shipped iOS; a new
  value replaces it.
- **Finding 1 is confirmed**: iOS keys a mark to a paragraph's position and
  never looks outside it. Android keys by permanent id but orphans a retired
  paragraph. Both fixes are the same: search the chapter.
- **Android has Auto Backup only**; the iOS repo's doc saying it syncs
  through a Drive folder was wrong. Plan A costs Android a sync engine built
  from nothing.
- **"Keep what you don't understand" isn't true on Android yet** (its backup
  reader drops unknown fields); one migration fixes it.
- **Reading places are open on both apps**; Android's "syncs" (A-R6) no
  longer stands.

## Ready for the Greek text

A later project than the desk (BVJ, 2026-10-01): align every word of the
Greek New Testament to the LIT, and eventually the Hebrew Bible; show the
Greek beside the LIT; clicking a word in either lights its partner in the
other and opens a bubble with morphology, Strong's number, root and perhaps
lexical information. The desk shouldn't need rebuilding for it.

**The Greek text itself comes sooner** (2026-10-08): a Greek tab in the
Notebook panel, with parsing, lexicons and the apparatus, needs none of the
alignment, since that data already exists for every SBLGNT word. Only the
word-to-word link waits for phase 2. See "Decisions", 2026-10-08 (the Greek
tab).

- **Fonts now** (C27): self-hosted Greek and Hebrew fonts via `unicode-range`,
  serving Greek and Hebrew typed into notes from the start. Candidates (all
  SIL Open Font License), to compare beside Crimson Text: Gentium Plus or
  Cardo for polytonic Greek; Ezra SIL, Cardo or Noto Serif Hebrew for pointed
  Hebrew. **Picked 2026-10-05: Cardo** for both, in serif text and print, with
  Inter's own Greek and Noto Sans Hebrew inside the site's sans-serif text
  (see "Decisions", 2026-10-05, phase 0 picks). A Greek text panel will
  also need the SBLGNT's text-critical signs (Romans 8:2 carries ⸀), so check
  Cardo's coverage of them when that project starts. (Checked with 1f: full
  Cardo has them and is patched in for them.)
- **Anchors that can point at a Greek word** (book, chapter, verse, SBLGNT
  word position) beside the English quotes. Nothing uses it until the
  alignment publishes.
  **The word position is MorphGNT's** (`t`, 1-based within the verse),
  because that is what alignment phase 2 stores
  (`scripts/alignment-words/core.mjs`; CLAUDE.md, "Phase 2 tooling"). The
  Greek tab must number words the same way or the word bubble can't follow a
  link. The passages it takes from other sources (John 7:53–8:11, Romans
  16:25–27) have no MorphGNT words and will need a source label.
- **One bubble**: the shared floating panel the term lens uses, so the term
  lens grows into the word bubble and N2's notes carry over.
- **The data is shaped for it**: the alignment dataset's phase 2 records Greek
  word positions and stays unpublished until it covers the whole New
  Testament (owner decision). H2 becomes exact then.
- **netbible.org already does this** (checked 2026-10-02): clicking a Greek
  word lights its English partner, and English phrases are linked as units
  (clicking "plainly evident" in John 3:21 selects both words). Its box shows
  parsing code, Strong's number, transliteration, root and a short definition
  (BVJ's list), at the foot of the Greek panel rather than over the text. Its
  search takes Strong's numbers ("strong:25"), which M4 could too. A 2016
  review faulted its Hebrew for lacking vowel points and its Greek and Hebrew
  for not scaling with text size: here both follow the Display tray, and the
  Hebrew is pointed.
- **Licenses to settle before publishing**: SBLGNT text CC BY 4.0 (credited
  already). MorphGNT's parsing and lemmas are CC BY-SA 3.0, so a published
  layer built on them must be share-alike, which lets others reuse that layer
  commercially: BVJ's decision. Hebrew: the Westminster Leningrad Codex is
  public domain; the Open Scriptures Hebrew Bible morphology is CC BY 4.0.
  Public-domain lexicons: Strong's (1890), Abbott-Smith (1922), Thayer, Dodson,
  Brown-Driver-Briggs. BDAG and HALOT are copyrighted.

## License

**Changed 2026-10-01 and live** (PR #248). The wording is in
`src/pages/read.astro`, in `<details id="license-terms">`; the canonical link
is `https://litbible.net/read#license-terms`, which /read now opens on arrival
(PR #250). The base license stays CC BY-NC-ND 4.0; only the added permissions
changed. BVJ's intent:

- **Noncommercial use has no amount limits**, whole books included, for
  classes, studies, sermons, bulletins, study guides, retreats and personal
  use, **including paid programs** (courses, tuition, retreat fees) as long as
  the LIT text isn't what's sold. Quote as written, keep footnotes with their
  verses, include `LIT_CREDIT_LINE`.
- **Blanks yes, substitutions no**: fill-in-the-blank handouts are fine when
  the answers are the LIT's own words; replacing the LIT's words with other
  wording is not.
- **Footnotes follow the same rules** as the text.
- **Commercial quotation is allowed without asking** within limits: quoted as
  written with footnotes kept, not a complete book, LIT material at most 50%
  of the new work, and the credit line. Selling the LIT itself, in print or
  digitally, needs BVJ's written permission.
- **Online sharing**: any amount on noncommercial accounts, with a direct link
  to litbible.net; "please link to a chapter or book rather than reposting
  whole books" is a request, not a rule.
- The grant is to "anyone who reads this notice or uses the LIT Bible website
  or apps", covering LIT text and notes as written by the Collective, not
  third-party material the footnotes quote, nor the SBLGNT's own terms.

**What it means for the desk**: S7's commercial check is hidden unless a
sheet is marked commercial; S10's blanks are allowed; S6 can display any
amount. **Link the terms from the desk** (BVJ, 2026-10-01): from the help page
(M12) from the start, and from every sheet's license card (S7) once sheets
arrive. **The apps link to them too** (BDR's list, item 11). Everything the
desk produces carries `LIT_CREDIT_LINE` from `src/lib/lit-credit.mjs`.

**Borrowing ideas from other products** (BVJ asked whether, for example,
borrowing Logos's handout idea risks liability): ideas, methods and features
aren't protected by copyright (17 U.S.C. §102(b)); copying code, text,
artwork, distinctive design or names is what to avoid, plus trademarks
(don't use another product's names for features) and, rarely, patents. Every
idea here is borrowed as an idea; nothing copies another product's code,
text, design or name. Sefaria's code is GPL-3.0, so don't copy it either.

## Privacy

- Notes are plain text, always displayed as text, so nothing pasted into one
  can run on the page.
- Nothing leaves the computer unless the reader prints, exports, shares or
  signs in to sync. A shared link carries its data after the #, cleared from
  the address before analytics runs (S8).
- Shared computers: a "Clear my notebook" control, a line saying the
  notebook lives in this browser, and the optional lock (D5).
- The privacy page gets one paragraph (what's stored, where, how to delete
  it, and that it never reaches the LIT team unless the reader signs in);
  accounts need a fuller rewrite. (API.bible's FUMS script would have needed
  naming; deferred 2026-10-11.)

## Considered and set aside

So they don't come back as fresh suggestions:

- **Taking over right-click**: it hides the browser's own menu (spelling,
  translate, look up).
- **A public gallery of sheets**: needs moderation and makes the LIT answer
  for what strangers publish, even with accounts.
- **AI summaries of a reader's notes**: same reason the feature audit set
  aside "Ask an AI about this verse".
- **Editing a sheet together, live**: heavy to build, harder under end-to-end
  encryption; a shared file or link covers most of it.
- **An email when your verses change (M15)**: declined 2026-10-01.
- **Ctrl K for commands**: declined (C11); commands live in the search box.
- **netbible.org's commentaries**: the LIT's footnotes already do that work,
  in the translation's own voice. **Reopened and set aside again
  2026-10-08**: BVJ looked for a scholarly, noncommercially licensed
  commentary on the whole NT from a liberationist perspective, and none
  exists under an open license. See "Decisions", 2026-10-08 (the Greek tab).
- **Anchoring notes to footnote letters**: letters shift whenever a note is
  added or removed.

## Order of work

Planned in detail on 2026-10-05, after both apps replied, and approved by BVJ
the same day. Each phase is usable on its own, and **phases 1 to 3 need
nothing from the apps**. The website builds in the order that suits it
(BVJ's answers, 2026-10-05); February 10, 2027 is BDR's goal for the apps.

**The format rule: freeze it before anything syncs** (BVJ, 2026-10-05). This
replaced phase 0's "agree the record format before any code". Draft 1
(`STUDY-DESK-FORMAT.md`) is written to be safe under plans A, B and C, and
the local notebook is needed under both. Until sync arrives in phase 4,
nothing leaves the browser except exports that the website reads back
itself, and every record carries `schema`, so a change from the apps' review
becomes a migration inside one module. Android asked for the freeze before
Christmas, which is likely to come before phase 1 is ready to release anyway.

0. **The choices that come first.** None holds up phase 1a or 1b.
   - Pick the narrower reading column side by side (C9), to ship with the
     desk. The margin in 1c waits on it. **Picked: 52** (2026-10-05).
   - Pick the Greek and Hebrew faces (C27). The Greek face is worth shipping
     as soon as it's picked: four articles and two chapters already contain
     Greek letters (138 and 21 characters, counted 2026-10-05), which show in
     fallback fonts today. **Picked: Cardo** (2026-10-05), and shipped ahead
     of the desk in PR #270.
   - The apps' review of draft 1, then the freeze.
1. **The notebook**, in steps 1a to 1d, 1f and 1h. Medium to large.
   **1h is part of this phase** (BVJ, 2026-10-13): phases 2 and 3 don't
   begin until it is built, and it was built on 2026-10-13. 1e and 1g are
   not version 1: 1e is deferred indefinitely and 1g is shelved (see
   "Version 2" under "Order of work").
   - **1a. Foundations.** Pure, unit-tested modules, with no page yet.
     Three are built and two are held for BDR (BVJ, 2026-10-05):
     - **Built: draft 1's record kinds** (`src/lib/desk-records.mjs`), with
       `schema`, a migration hook, and keeping any field or kind the website
       doesn't know (the format's principle 6). `modified` moves only through
       `editRecord` (principle 4). `mayRewriteAnchor` keeps a client on older
       text from rewriting a record made on newer text (principle 7). Trash
       records were held back here, since their fields are among BDR's
       questions; phase 1b added them provisionally (below).
     - **Built: the browser half of the anchor text**
       (`src/lib/desk-anchor-dom.mjs`). It reads a chapter's anchor text off
       the rendered page, with a map from each character back to the DOM, and
       turns a selection into anchor-text positions and back. The page's own
       text models (Copy's and `countable`'s) are not the anchor text (review
       finding 3), so it doesn't borrow either.
       - `test/desk-anchor-dom.test.js` sweeps every published chapter
         through both views' real render pipelines on each `npm test`. In
         2026-10 all 210 matched `scripts/lib/anchor-text.mjs` verse by verse,
         and every word mapped to the page and back.
       - The same sweep was run once in a real browser against the built
         site. All 210 chapters matched in both views, as did the live Romans
         8 page with the term lens's 58 spans in place.
       - Its header names the contract: no client script may add visible
         text inside a verse span.
       - The pure half of the reference (`normalizeAnchorText`, `makeAnchor`,
         `resolveAnchor`) moved to `src/lib/anchor-core.mjs`, re-exported from
         the old path, so the vectors and the apps' pointer are unchanged.
     - **Built: the "did the wording change?" comparison** (N3, C3,
       `src/lib/desk-wording.mjs`). It evens out quotes, dashes and spacing
       (so August's passes don't count) but not case. A word-by-word diff
       gives N3's "exactly what changed".
     - **Built 2026-10-12: one merge engine** (`src/lib/desk-merge.mjs`), by
       `id`, `modified` and tombstones. It will import a file in 1d and
       become the sync engine in phase 4, since stores are homes, not
       formats (the format's principle 2); nothing calls it yet. Its rules
       are BDR's answers of 2026-10-09 (rules a to c): the newer `modified`
       wins on every store and for every kind, **the older version of a
       note is discarded** (BVJ, going with BDR), an edit later than a
       deletion brings the record back, and a tombstone blocks a stale
       backup forever. A future `modified` arriving from elsewhere is
       clamped to the merging device's clock. Two trash records of one
       deletion collapse by **the website's proposal, for BDR to confirm**:
       the later deletion, with the newer content (`STUDY-DESK-FORMAT.md`,
       kind 10; "Still open" below). It never re-runs the highlight overlap
       rule, and it carries kinds and fields it doesn't know untouched.
       - `test/fixtures/merge-vectors.json` holds 39 shared cases (rules a,
         b and c, clamping, the collapse, unknown kinds, malformed records),
         each a whole notebook before and after, for the apps to run as
         they run the anchor vectors. The unit tests also check that the
         result doesn't depend on input order, that merging twice writes
         nothing the second time, and that A into B equals B into A.
       - Three details it settled, also for BDR to confirm: an edit and a
         deletion at the same instant leave the record deleted; an exact
         tie between edits keeps the device's own copy; and a deletion that
         wins over a newer edit keeps the edited words in the trash, so an
         undo brings back what the reader last wrote.
       - The trash record gained `deletedKind` the same day (BDR's
         contract), and `migrateRecord` fills it in on older ones.
     - **Built 2026-10-09: the highlight overlap rule** (A-M5, item 20;
       `src/lib/desk-highlights.mjs`, under 1c). **Settled 2026-10-07**:
       Android's rule, as BDR ruled for iOS; its three details (rule d)
       approved by BDR on 2026-10-09.
   - **1b. The shell, behind a preview switch.** The gate and dynamic import,
     so readers download nothing until the desk is switched on for them; a
     preview switch, so BVJ can try it on the live site first; IndexedDB with
     BroadcastChannel and persistent storage; deletion as a `trash` record,
     undone from a bar rather than confirmed in a dialog (Android's practice,
     A-M12); the docked panel frame (C12); the plumbing (C21).
     **Built** (BVJ's choices under "Decisions", 2026-10-05, phase 1b):
     - **The switch and the gate.** `?desk=on` and `?desk=off` set or clear
       `lit-desk-preview` in that browser; Layout.astro's pre-paint script
       turns the desk on (`<html data-desk="on">`) only there and only on a
       computer (`isAppPlatform`, moved to `src/lib/app-platform.mjs`;
       `test/desk-prepaint.test.js` runs the inline script itself so the two
       copies can't drift). `src/scripts/desk-gate.js` then imports the shell.
       Readers download only the gate and a 300-byte helper. The shell adds
       its stylesheet itself, because a CSS import would be gathered into
       every page's stylesheet.
     - **The notebook in IndexedDB** (`src/scripts/desk/store.js`, database
       `lit-desk`), over a pure core (`src/lib/desk-store-core.mjs`) that
       turns each change into a write plan. Tabs tell each other which
       records moved over a BroadcastChannel. Persistent storage is asked for
       on the first write, never on load. Trash past 30 days keeps only its
       tombstone, emptied on open.
     - **Deleting, provisionally.** `trashRecord`, `restoreFromTrash` and
       `emptyTrashRecord` in `desk-records.mjs` use the website's proposed
       fields (`deletedId`, `deletedAt`, `record`; item 20, question 4).
       Undoing moves `modified`, which question 2 relies on. If BDR answers
       differently, the change goes in `migrateRecord`. **BDR's answer
       (2026-10-09)** keeps these and adds the deleted record's kind, so the
       migration is one field.
     - **The undo bar** (`src/scripts/desk/undo-bar.js`) had no timeout:
       until the trash list (M7) exists it was the only way back, and a timed
       one would fail WCAG 2.2.1. **Since 2026-10-09 it closes by itself after
       ten seconds** (BVJ), never while hovered or focused, because Ctrl+Z
       now keeps the same undo for the rest of the visit (1c).
     - **The panel** (`src/scripts/desk/panel.js`): a Notebook button
       (glyph and word) beside "Aa" in the header, and the glyph alone in
       Read View's toolbar, both hidden by CSS unless the desk is on. It
       opens the panel: "This chapter" (Study View chapters) and
       "Everything" tabs, each record with Delete, "Kept in this browser"
       and whether the browser may clear it. A preview-only "Add a sample
       note" button lets delete, undo and the tabs' keeping in step be tried
       before 1c; **1c removes it.** Whether the panel is open is
       remembered for the next page.
     - **The panel sits in the margin (C12; BVJ, 2026-10-06).** As first
       built it docked on the right and the whole page, header included,
       moved left to make room; BVJ asked for it to fill the margin instead.
       It is a card in the right margin beside the reading column
       (`src/lib/desk-margin.mjs` holds the rule, `src/scripts/desk/margin.js`
       places it): level with the text, below the header and Study View's
       tool row, pinned to the top of the window while reading (CSS
       `sticky`), and gone before the footer. **Where the margin is wide
       enough, nothing on the page moves.** The panel is at least 280px
       wide. A 220px minimum was tried, which kept the text still in more
       windows but made the panel noticeably narrow; BVJ chose the 280px
       panel with the text moving where it must (2026-10-06). Measured on
       Romans 8 and the glossary, which now have identical columns:
       - at the default text size nothing moves in any window from about
         1205px (a 1280px window has 321px of margin);
       - below that, or at larger text sizes, the text moves left only as
         far as the panel needs (58px in a 1162px window; at 1280px, 31px at
         Large and 80px at Extra large);
       - only the column moves (a translate on its own elements). The
         header, the tool row and full-width bands such as the license band
         stay put at full width. (An earlier version padded the page instead,
         which cut the license band short and showed cream beside it.);
       - in a window too narrow for even that (under about 960px at the
         default text size), the notebook **floats** (BVJ, 2026-10-07; built
         2026-10-07): a window the reader can expand and collapse. Expanded,
         it is the same 280px card at the window's edge, with a firmer
         shadow, lying over the ends of the lines. Collapsed, it is a 40px
         tab at the window's edge, the notebook glyph with "Notebook" running
         down it, level with the page's heading and pinned 16px from the top
         as the reader scrolls. The tab never covers the text: the column
         moves left only as far as the tab needs (nothing at the default
         size; 7px at Extra large in a 900px window), and moves the same
         whether the notebook is expanded or collapsed, so the text never
         jumps when it is toggled. The panel's head gains a collapse button
         (») beside its ×. It **collapses by itself** whenever it starts
         floating without the reader asking: a page opening with the
         notebook remembered open, or a window narrowed under it. Pressing
         Notebook opens it expanded; pressing Notebook again or the tab
         expands a collapsed one; Escape collapses it rather than closing
         it; × still closes it. The choices behind those details are
         recommendations for BVJ to confirm (see "Still open").
         `placeFloating` and `nextCollapsed` in `src/lib/desk-margin.mjs`
         hold the rules.
       Read View, article pages and the glossary work the same way. Pages
       with no reading column (the home page, the articles list, /search)
       get no panel and no Notebook button at all (`READING_SURFACES` in
       `src/scripts/desk-frame.js`, matched by a `:has()` rule in
       global.css). The panel's "Notebook" heading lines up with the page's
       heading by the tops of their capitals, and the panel reaches down to
       16px above the bottom of the window. At the end of a page it stops
       16px above the seam with the footer's colour, the license band
       counting as footer (on an article, at the bottom of the card). Floating panels keep 12px clear
       of it and a click inside it closes none of them; the single-key
       shortcuts stand down inside it.
     - **The 52 measure is on while the preview is on** (48 on Study
       View chapters while the notebook is open, from 2026-10-08), and
       Read View's
       toolbar takes a floor of 725px (895px in OpenDyslexic) so it doesn't
       change width as its labels change, as OpenDyslexic's already did.
     - **Plumbing (C21)**: nothing new in 1b. There's no new page (so no
       noindex, sitemap or Pagefind work), the shell is same-origin script
       the report-only CSP already allows, and IndexedDB needs no CSP entry.
       **The privacy paragraph waits for 1d**, as planned: only someone
       holding the preview link stores anything.
   - **1c. Marks in Study View.** The "My Notebook" actions in the verse menu and
     selection panel; notes with the apps' seven markers; highlights in the
     four colours, with no named meanings (H1's legend was dropped 2026-10-07;
     1c also takes `legend` out of `KINDS` in `src/lib/desk-records.mjs`), with no second cue
     besides colour (C4's cue was dropped 2026-10-09; built as a tint only); bookmarks; the margin, each note level with its first word
     and led by its marker glyph, in Playpen Sans or Inter by the reader's
     choice, falling back to the glyph in a circle (C9),
     with the reader's switch for notes shown or hidden in both the Display
     tray and the Notebook panel, and the panel's notes taking the reader to
     their place (BVJ, 2026-10-07; "Decisions", 2026-10-07 (the margin
     switch)); the change notice, driven by the format's found, moved, changed,
     verse and lost, in the apps' words (iOS: Re-read in Context, Keep,
     Delete; Android: "carried along" and "couldn't find your words"); the
     "This verse" tab (N10); Read View's smaller set, through events (C2);
     hide my notes (M1); accessibility (C4, C10, C24).
     **Built first (2026-10-07), the parts rules a to e don't touch**, behind
     the preview switch:
     - **"My Notebook" in the menus** (headed "Yours" until BVJ renamed it,
       2026-10-09). The verse menu and the selection panel gain
       Add a note and Bookmark (Remove bookmark when the verse has one);
       Read View's selection panel gains Bookmark only. chapter-tools.js
       offers each panel through a `lit:panel-actions` event before placing
       it, and `src/scripts/desk/actions.js` adds the row, so with the desk
       off nothing changes.
     - **The note editor** opens in the shared floating panel in place of
       the menu: the words and reference, the seven markers, the reader's
       words, Save and Cancel (Ctrl+Enter saves); editing adds Delete with
       the undo bar. It ignores outside clicks (lit-panel's `stay`), so a
       stray click can't lose what was typed. A note from the verse menu
       covers its verses with no quote; one from a selection quotes it.
     - **The margin** (`src/lib/desk-notes.mjs`, the rules, unit-tested;
       `src/scripts/desk/notes-margin.js`, the drawing) does what
       "Decisions", 2026-10-07 lists. It adds nothing to the scripture: the
       notes live in one `<aside>` at the end of `<body>`, and the lit words
       use the CSS Custom Highlight API. One detail of the fade was settled
       while building: a cut note that shows a single line fades toward the
       line's end rather than downward, since a downward fade over one line
       left nothing legible.
     - **The settings** ("My notes", Handwriting / Plain, and the list's
       "Show notes in full") live in `src/scripts/desk/note-settings.js`:
       one attribute on `<html>` and one localStorage key each, with the
       controls in the Display tray's Show group and the panel's foot kept
       in step.
     - **The panel's list** leads notes with their glyphs at two lines, has
       Edit, and both a note's reference and the note itself take the reader
       to it (BVJ, 2026-10-07: clicking the note had opened it, with nothing
       to say so). In Read View they go to the verse in Read View, scrolled
       to in place within the book being read, never to Study View (BVJ,
       2026-10-08). A caret beside a note whose words run past two lines
       opens it for the visit. The preview's "Add a sample note" is gone, and
       `legend` is out of `KINDS`.
     - **Trials for BVJ to judge on the preview** (2026-10-07, not decided):
       - **A bookmark shows on the page** as the bookmark glyph in red, not
         in a circle, level with its verse and right-aligned in the notes'
         column, the side nearest the text (BVJ's suggestion). Notes in full
         take all the margin they can and never move; only a note a mark is in
         the way of contracts at its text-side edge to clear it (BVJ,
         2026-10-08: they shouldn't shift for bookmarks; before that,
         narrowing every note had squished them). They grow no wider than
         three quarters of the text column (BVJ, 2026-10-08), so the cap
         follows the reading width and text size. Where notes are circles
         a mark takes a place in their rows. **Bookmarks have their own switch,
         "My bookmarks"** (BVJ, 2026-10-08), beside "My notes" in the Display
         tray and the panel. **Bookmarks are the one piece of marginalia Read
         View shows** (BVJ, 2026-10-08): the same mark beside its verse, with
         "My bookmarks" in Read View's tray and panel; still no notes there.
       - **Playpen Sans at weight 500** rather than its regular 400 (BVJ
         asked for thicker: 500 or 550). Inter on "Plain", and a reader's
         own font, keep their normal weight.
     - **A default chosen where nothing was decided**: the editor's form.
     **Built second (2026-10-08), the rest that waits on nobody**, behind the
     preview switch:
     - **The panel's tabs**: **My Notes · This verse** on Study View chapters,
       My Notes alone (with no tab row) everywhere else. Greek
       joins the same table later (Versions is deferred). My Notes keeps the list as it was, with a
       small "Romans 8 / Everything" choice at its top, and the panel's foot
       (the switches, "Kept in this browser") shows with My Notes only. Each
       tab is its own module (`src/scripts/desk/tab-mine.js`,
       `tab-verse.js`) and keeps its place while another shows.
     - **"This verse" (N10)**, without the versions for now (below): the
       verse's reference and text, its footnotes copied from the page's own
       list (links included), the reader's notes and bookmark on it, with
       Edit, and Add a note. **Previous and Next** (‹ ›, BVJ, 2026-10-08)
       step to the neighbouring verse within the chapter, over the LIT's gaps
       (Matthew 17 runs 20, 22), and leave the page where it is. Opening a
       verse's menu while the notebook is open moves the tab to that verse,
       and **"Show in notebook"** in the verse menu and the selection panel
       opens the notebook on it; the selection panel keeps that route when
       verse numbers are hidden (C10). The pure rules are in
       `src/lib/desk-verse.mjs`.
     - **The verse number names its notes**, as recommended under "Still
       open": "Verse 18, 1 note of mine" (`src/scripts/desk/verse-labels.js`),
       back to "Verse 18" while the reader's notes are hidden. Only the
       attribute changes; nothing is added to the scripture.
     - **M1, "Hide my notes"**, in the Display tray's Show group and the
       panel's foot, and the key **H** (listed in the tray's keys). It
       remembers "My notes" and "My bookmarks", turns both off, closes the
       panel, and puts them back when turned off. It is no setting of its
       own, so decision 8's "most recent action wins" falls out: turning "My
       notes" back on brings the notes only, and H then hides them again. Its
       box is checked exactly when everything is hidden.
     - **C10**: a line under the tray's Show group on Study View chapters,
       "With verse numbers off, select any words for the same actions."
     - **Widths the reader can drag** (decision item 13), built on the
       recommended details: on a Study View chapter with the notebook open in
       the margin, a handle in each gap (notes' margin and LIT; LIT and
       notebook), invisible at rest, with the resize cursor and a small grip
       beside the pointer in the gap and a hairline while dragging; a
       focusable separator the arrow keys move a character at a time (ten
       with Shift). Kept as the LIT's measure (36 to 72) and the notebook's
       width (at least 280px) in `sessionStorage` for the visit; the
       notebook then sits at the window's edge and the notes' margin takes
       what's left. The first drag in a very wide window, where the panel
       stops at 440px beside the text, widens the panel to the window's edge
       rather than moving the text. Stamped before first paint (Layout.astro;
       global.css sets the column from it), so a page never jumps; a window
       too narrow for the kept widths gives way as recommended (notes'
       margin, then the notebook to 280, then the LIT to 36, then the
       floating notebook) without forgetting them. "Reset widths" in the
       panel's foot and the Display tray. The rules are in
       `src/lib/desk-margin.mjs` (`placeWithWidths` and the two drags),
       the handles in `src/scripts/desk/widths.js`.
     - **The floating notebook's width** (BVJ, 2026-10-14): where the
       window is too narrow for the margin and the expanded panel lies over
       the text, on any reading surface, the reader drags its left edge to
       change its width (the right edge stays 16px from the window's). It
       is 280px until dragged, up to the window less 16px a side, kept for
       the visit (`lit-desk-float-width`) and forgotten by "Reset widths".
       Nothing shows at rest; arrow keys move the handle too. Rules:
       `floatWidth` and `dragFloatEdge` in `src/lib/desk-margin.mjs`;
       handle: `src/scripts/desk/float-resize.js`.
     - **Defaults chosen where nothing was decided**, for BVJ to judge on the
       preview: the "Show in notebook" label and its own row in the menu;
       This verse opening at the address's verse, else the verse being read;
       Previous and Next staying inside the chapter; H as M1's key, and M1
       closing the panel (unless done from the panel itself); the foot on My
       Notes only; the tab last chosen remembered across pages
       (`lit-desk-tab`); the C10 wording; the arrow keys' step on the width
       handles (a character, ten with Shift).
     - **Notes on glossary entries and articles (N11), provisionally**
       (BVJ chose to build it now, 2026-10-08, rather than wait for format
       draft 2):
       - **The record**: a `note` whose target is `glossaryEntry` (the
         entry's id) or `article` (its slug) instead of verses, with an
         optional `quote` and `targetTitle`, a copy of the title for lists.
         Kept apart from N2's `glossaryId`, which follows a term through the
         translation. Marked provisional in `STUDY-DESK-FORMAT.md` and
         `src/lib/desk-records.mjs`, like the trash record's fields.
       - **Quoting text with no verses** (`src/lib/desk-prose-anchor.mjs`):
         the whole body is read as one verse, by the format's steps 3 to 7,
         so the quote, its 32 characters of context and the search when the
         wording moves are the scripture's own. A quote is `found` anywhere
         in the body or `changed` by the context rule; with nothing usable
         left, the note goes on the whole entry or article. Text that isn't
         the body's own is skipped (screen-reader-only text, footnote
         references, buttons).
       - **The slug rule**: `src/data/article-slugs.json` lists every
         article's slug, and `test/article-slugs.test.js` fails if one
         disappears without a `renamed` entry pointing at its new slug;
         notes follow the map.
       - **On the page**: the same margin and switch as Study View
         (decision 9; `src/scripts/desk/note-sources.js` says what notes sit
         beside on each page). Selecting words in an article's text offers
         "Add a note"; on the glossary, the selection panel every reader
         now gets (Copy entry text, Copy entry link; BVJ, 2026-10-09) gains
         a "My Notebook" row with "Add a note" and "Note on this entry". An article
         has "Add a note on this article" in My Notes. A whole-entry or
         whole-article note sits level with its heading. My Notes starts on
         "The glossary" or "This article", and the tray gets a Show group of
         its own on those pages. (A note icon beside each entry's link was
         tried first and taken out the same day: it took room from the
         heading and split more headings across lines.)
       - ~~**For BVJ to confirm**~~: **all four confirmed as built** (BVJ,
         2026-10-13): the slug rule, the rule for quoting prose, the field
         names and the ways in. CLAUDE.md tells every session to add the
         `renamed` entry whenever an article file is renamed.
     - **Minimize** (BVJ, 2026-10-09): » minimizes the notebook in the
       margin too, to the same tab at the window's edge the floating
       notebook uses; minimized is remembered for the next page; Notebook or
       the tab restores it. **Only the expanded notebook makes room** (BVJ,
       2026-10-14, reversing the first version's "the text stays exactly
       where it was"): minimized, floating-and-folded or closed, the column
       keeps its 52 measure, the kept widths wait and the column moves only as
       far as the tab needs to stay clear of the text (never over it);
       expanding or minimizing reflows the text, and the reader's line is
       held. `<html data-desk-expanded>` is the switch (margin.js owns it).
     - **The glossary's headings with several options** (BVJ, 2026-10-09:
       they were splitting across lines). With the desk on, every such
       heading had taken the phone layout, each option on a line of its own.
       Now each takes only the break it needs, measured on the page: its
       options on the heading's line, or together on a line of their own, or
       (only the longest, mercy's, at the default size) each on its own line.
     **Built third (2026-10-09), highlights**, behind the preview switch, as
     soon as BDR's answer to rule d settled the overlap rule:
     - **The record and the rule.** A highlight is one record however many
       paragraphs it crosses, with its quote and `verseCopy`.
       `src/lib/desk-highlights.mjs` (pure, unit-tested) applies "Highlights
       that meet" (STUDY-DESK-FORMAT.md) whenever the reader makes one: the
       same colour merges where it overlaps or is separated only by spaces,
       never across a paragraph or a line of poetry; a new colour trims an
       old one, splitting it in two where it lands in the middle; a trimmed
       piece loses stray spaces at its edges; and a highlight whose words
       have moved on (anything but `found` or `moved`) is never touched,
       nor is one written by a newer schema or on newer text. A merge keeps
       the oldest record and deletes the rest through the trash; a split's
       second piece is a new record carrying the first's labels. Every
       rewritten record gets a fresh quote, `verseCopy` and
       `contentVersion`. The store commits each change in one transaction.
     - **On the page**: a tint and nothing else, drawn with the CSS Custom
       Highlight API (`src/scripts/desk/highlights.js`), one highlight per
       colour, so nothing is added to the scripture. The four colours keep
       away from the selected-verse green ("green" is a lime) and sit under
       the selected verse and a note's lit words. **No second cue** (BVJ,
       2026-10-09; "Decisions", 2026-10-09 (highlights)). Highlights don't
       print.
     - **In the menus**: a Highlight row in "My Notebook", four colour
       buttons (each a small sample of text in its tint, named in words for
       screen readers), and "Remove highlight" when the verses or selection
       hold one, which takes the highlight off just those words. Study View
       offers it in the verse menu and the selection panel; Read View in the
       selection panel only while its highlights are shown (C2).
     - **The switches**: "My highlights" in the Display tray and the panel's
       foot, on by default in Study View and **off by default in Read View**,
       stored separately (H1, decision 2). "Hide my notes" (M1, H) hides
       them with everything else.
     - **In words**: a verse number names its colours ("Verse 3,
       highlighted yellow and pink, 1 note of mine") while highlights are
       shown. My Notes names each ("Yellow highlight") with its words in the
       tint, and groups by colour through a filter above the list (All, then
       each colour present). This verse lists the verse's highlights with
       Remove.
     - **Defaults chosen where nothing was decided**, for BVJ to judge on the
       preview: the row's place (after Add a note and Bookmark) and its
       samples; Remove highlight erasing within the words rather than whole
       records; highlighting while "My highlights" is off in Study View
       turning it back on; the panel closing at once (the highlight is the
       feedback); the undo bar only after a removal or when a new colour cut
       into another ("Romans 8:3 highlighted green."), never after a plain new
       highlight; the colour filter in My Notes; a highlight across verses
       tinting the verse numbers and footnote letters inside it; and, in Study
       View, a highlight in My Notes going to its verse by the ordinary `#v3`
       link rather than the in-place visit a note gets.
     **Built fourth (2026-10-09), undo on the keyboard** (BVJ asked whether
     Ctrl+Z undid adding, editing or removing notes, bookmarks and
     highlights; it didn't):
     - **Ctrl+Z (⌘Z) undoes this tab's last change to the notebook**, and
       Ctrl+Shift+Z (⌘⇧Z) or Ctrl+Y redoes it: adding, editing or deleting a
       note, a bookmark or a highlight, a merge or colour change included.
       One history per page visit, 50 deep; a change made in another tab is
       never in it. In a text field, or with the note editor open, the keys
       are the browser's own undo.
     - **The bar says what happened** ("Undone: note on Romans 8:3 added."
       with Redo), and its Undo button is the same history, so the button
       and the key never disagree. A change overtaken since (edited in
       another tab, say) is not undone; the bar says so.
     - **An undo is the reader acting**: it restamps `modified`, so under
       the newer-writing-wins rule (rule a) it outranks what it undid on the
       reader's other devices.
     - **The bar closes by itself after ten seconds** (BVJ, 2026-10-09),
       never while hovered or focused; the same undo stays on the key.
     - The rules are `src/lib/desk-history.mjs` (pure, unit-tested); the
       stacks and keys are `src/scripts/desk/history.js`, and the store
       records each change it writes. The Display tray lists the key.
     - **Defaults chosen where nothing was decided**: 50 steps; the history
       starting fresh on each page; ten seconds; Ctrl+Y redoing on Windows
       only, since ⌘Y is the browser's History on a Mac.
     **Built fifth (2026-10-10), the change notice** (N3, C3; rule e's
     "the notice the apps already show, with its actions"), behind the
     preview switch:
     - **When a mark carries one.** A note or highlight is found again on
       every load (`placeRecord`), and the format's statuses decide:
       `changed` (the words are gone; the mark is carried along to the words
       now between its context), `verse` (it couldn't be placed, and sits on
       its whole verse or passage) and `lost` (its verses are gone) each
       carry a notice; `found` and `moved` don't. Two refinements of the
       format, both proposed for draft 2:
       - **A change of typography alone is no change** (N3, C3: "punctuation
         passes don't count"). When the words a `changed` mark is carried to
         differ from the words it quoted only in quotes, dashes and spacing
         (`wordingKey`), it is shown there quietly, with no notice; the
         marked words decide, so a change elsewhere in the verse doesn't
         count either. That needs no `verseCopy`, so the apps' records are
         judged the same way. Such a highlight can be merged and trimmed
         again (rule d's exception is for a highlight carrying an unread
         notice, and this one carries none).
       - **A note on whole verses notices too** (N3's mock: a note on
         Romans 4:7 flagged when "Gratified" became "How greatly
         fortunate"). It has no quote, so it is always `found`; it carries a
         notice (`reworded`) when its `verseCopy` and today's verses differ
         in wording. A quoted note whose words are still found doesn't,
         whatever changed around them, nor does a highlight.
       A record made on newer text than the page has (principle 7) carries
       none: the page is behind, not the record. Notes on glossary entries
       and articles (N11) carry one when their quote is carried along to
       different words or falls back to the whole entry or article.
     - **What it says**, in the apps' two registers: "Your note has been
       carried along to the words that now stand in place of the ones you
       marked", or "We couldn't find the words you marked, so your note is
       on the whole verse for now." Then the date, "Changed October 4,
       2026 · Release note", from the newest release note that changed one
       of the mark's verses since the record's text was taken (fetched only
       when a notice opens); otherwise "Changed after you made this". Then
       exactly what changed: the verses as they read when the mark was made
       against today's, old words struck through and new ones underlined,
       with long unchanged stretches shortened, and the words the reader
       marked.
     - **Keep, Delete, Show in the text** (iOS's Keep, Delete and Re-read in
       Context). Keep is the only thing that writes (principle 5): the mark
       takes the words it was carried to, or, from the whole-verse
       fallback, a note becomes a note on its whole verses and a highlight
       covers them; either way with a fresh `verseCopy` and today's
       `contentVersion`, and `modified` moves. A record whose text can't be
       ordered against the page's (two publishes on one day) is kept only
       once `/api/version.json` confirms the page has the newest text.
       Keep and Delete are undone from the bar or with Ctrl+Z. A `lost`
       mark offers Delete alone.
     - **Where it shows**: a note in the margin carries a "Wording changed"
       flag under its words, beside Edit; a note shown as a circle carries
       a dot, its name says so, and its note gains "Wording changed ·
       Review"; and a highlight gets a small flag of its own in the margin
       level with its first line (where bookmarks' marks sit, one lane
       further out when one is there), while highlights are shown and the
       margin has room. Each opens the notice in the shared floating panel.
       My Notes and This verse flag each row ("Wording changed · Review", or
       "Not in the text · Review"), My Notes under a one-line count ("The
       wording has changed under 2 of these."); and a verse number names it
       ("Verse 3, highlighted yellow, 1 changed since I marked it"). Notices are
       judged only where the chapter's text is on the page, so the
       Everything list flags none from other chapters; each is judged when
       its chapter is read. Read View flags its book's rows in My Notes and
       puts nothing in its margin.
     - The rules are `src/lib/desk-change.mjs` (pure, unit-tested); the
       panel and the flags are `src/scripts/desk/change-notice.js` with the
       margin, the two tabs and the verse labels.
     - **Defaults chosen where nothing was decided, approved by BVJ
       (2026-10-10)**: the wording above; showing typography-only changes
       quietly; the `reworded` notice for whole-verse notes; the margin flag for
       highlights, and its glyph (two curved arrows, which may read as
       "reload"); Keep leading the card on a line of its own, with Show in
       the text and Delete under it; Show in the text taking a highlight to
       its verse by the ordinary `#v3` address; Keep from the whole-verse
       fallback dropping a note's quote rather than asking for new words
       (N3's "Mark the new words" is left for later: today the reader can
       delete and mark again); Keep not merging a kept highlight with its
       neighbours (the overlap rule applies when a highlight is made);
       notices only for chapters on the page.
     **1c is finished** with pinned footnotes (2026-10-12). The versions
     that were planned for it are deferred (below).
     **Added to 1c on 2026-10-09: pinned footnotes, by November** (BVJ,
     agreeing to BDR's request; see "BDR's answers and requests"). A Pin
     button wherever a footnote is read (the popover and the end list), a
     "Pinned footnotes" list in the panel, and the change notice when a
     pinned footnote is rewritten, which reuses the change notice above. The
     record is format draft 2's tenth kind: the verse and the footnote's full
     normalized text, never its letter.
     **Built 2026-10-12**, behind the preview switch, Study View chapters
     only (Read View prints no footnotes):
     - **The record**: `footnotePin` in `desk-records.mjs`, with `bookKey`,
       `chapter`, `verse` (the verse holding the footnote's letter),
       `footnote` (the note's full text, read by the anchor text's steps 3
       to 7) and `n`, its place among that verse's notes that read
       identically, written only when there are two or more.
       `src/lib/desk-footnotes.mjs` reads the text from the chapter JSON
       and from the page, and its tests hold the two equal for every
       footnote in the published corpus, through the reference linker the
       page applies, so a pin made here matches one an app made.
     - **Finding it again** (`findPin`): **found** where the pin's verse
       holds a note reading the same (quotes, dashes and spacing ignored, as
       for marks); **moved** where another verse does, which it follows
       without a notice; **changed** where a note in its verse keeps at
       least half the pinned words, which raises the change notice; and
       otherwise **lost**. A note past 500 words is compared by the words
       it keeps, since the word diff gives up on long texts.
     - **The buttons**: "Pin" and "Unpin" (named "Pin footnote a" for screen
       readers) in the popover, on the line it already has for "See in
       footnotes", so the popover is no taller; on each note in the end
       list; and on each note in "This verse". The popover tells the desk
       through a `lit:footnote-actions` event, like `lit:panel-actions`, so
       `chapter-tools.js` still doesn't know the desk exists
       (`src/scripts/desk/pins.js` listens).
     - **"Pinned footnotes"** in My Notes, following its "This chapter" and
       "Everything" switch: the reference, the note's text cut to three
       lines, Unpin, and on its own chapter a jump to the note. Unpinning
       goes through the trash, with the undo bar and Ctrl+Z.
     - **The change notice** for a rewritten note: the "Wording changed"
       flag on the note in the end list and on its row, opening the
       notice with the words that changed, **Keep on the new wording**
       (which rewrites the pin's text, verse and `contentVersion`, under
       principle 7 as for marks) and **Unpin**. Nothing is rewritten until
       the reader acts.
     **Added to 1c on 2026-10-08**, from the Greek tab's planning ("Decisions",
     2026-10-08). None of it waits on BDR, so it can fill the time while
     highlights and the change notice do:
     - **The narrower column with the notebook open. Built 2026-10-08**: 48
       on Study View chapters while the notebook is open, 52 otherwise and
       always on Read View, intros, articles and the glossary; stamped
       before first paint, and opening or closing keeps the reader's line.
     - **The panel's tabs. Built 2026-10-08** (above). **"My Notes"** (BVJ,
       2026-10-08; it holds bookmarks and highlights too) holds today's
       chapter and "Everything" lists; beside it "This verse" and "Greek"
       (arriving with 1f). A "Versions" tab was planned (BVJ, 2026-10-08) and
       is deferred indefinitely (2026-10-11). The panel starts
       with the margin it gets. Small.
     - **Widths the reader can drag** (BVJ, 2026-10-08): their notes, the
       LIT and the notebook, with nothing showing between the columns until
       the pointer is in the gap. Details under "Decisions", 2026-10-08 (the
       Greek tab), items 12 and 13. Small to medium. **Built 2026-10-08**
       (above).
     - **"This verse" (N10)** with the verse's footnotes and the reader's notes
       on it; the Greek joins in 1f. Small. **Built 2026-10-08.** It shows
       **no other versions**, and won't in version 1 (BVJ, 2026-10-11).
     - **Deferred indefinitely (BVJ, 2026-10-11; held since 2026-10-08):
       the next two items, and the versions in "This verse".** Kept as the
       record; nothing is built.
     - **The KJV, the Open English Bible and the World English Bible, stored
       on the site** (public domain, from eBible.org; the OEB and WEB were
       picked by BVJ on 2026-10-08): a build step writing one file per
       chapter and version, a website asset like the search's chapter files
       and never under `/api/`. Each version's verse-numbering map (the KJV's
       2 Corinthians 13 and 3 John each have one more verse) is checked verse
       by verse against its text, the way the Sefaria map was. In the LIT's
       verse gaps (Matthew 17:21 and the rest) the KJV and WEB print the
       traditional verse (the WEB follows the Majority Text), which shows
       beside the LIT's note on why it isn't there. Small to medium.
     - **The Versions tab with the public-domain versions**, each in its own
       paragraphs and scrolling on its own; nothing lines it up with the LIT
       (BVJ, 2026-10-08). Recommended: it opens at the verse being read when
       the tab or the version changes, and a "Go to verse 18" button brings
       it back to wherever the reader has got to. The Greek tab was to reuse
       the same view; with the Versions tab deferred, 1f builds that view
       itself. Study View only. Small to medium.
   - **1d. The notebook around them.** The notebook page; your notebook in
     search, and commands in the search box (D2, D3); export and import in
     Markdown and the W3C shape, which every plan needs; the first-time
     choice (D6), worded without accounts until plan A or C is chosen; the
     Safari warning (C18); places and ribbons, kept in this browser (B1,
     C25); labels (M8, name open); ~~the interleaf (N7, C13)~~ (built, then set
     aside, BVJ 2026-10-13); the hidden passage (N8); the tutorial (D8); the help page (M12); the privacy
     paragraph (which 1e adds to); the link to the license terms. Saving live
     into a chosen file (D1) waits on its decision (T3); export and import
     don't.
     **Built 2026-10-12**, behind the preview switch, except N8 (**held by
     BVJ until after the Zoom**, below). Nothing waited on BDR. Every
     default below was chosen where nothing was decided, and is a
     recommendation for BVJ to judge on the preview, not a decision:
     - **The notebook page, labels, and save and open a copy** (M8, the
       D1 export). `/notebook/` (`src/pages/notebook.astro`) is noindex,
       out of the sitemap and out of Pagefind, and says the preview isn't
       on when the desk is off; `desk-gate.js` loads
       `desk/notebook-page.js` when the page is there, so it has no panel
       (it isn't a reading surface), and the panel's foot links to it. It
       has filters (words, kind, colour, label) with counts in words,
       records by book and chapter, then glossary notes, article notes,
       pinned footnotes and "Other items"; a Places section; Labels; "Save
       a copy"; "Delete everything" (one undo step, with an inline
       confirm); and "Empty the trash now" (not undoable; it drops the
       trash's contents and keeps the tombstones). The pure parts are
       `desk-labels.mjs`, `desk-notebook.mjs` and `desk-export.mjs`; the
       store gained `getMeta`/`setMeta`, and the META key `lastExport` is
       written after each download.
       - **Three files**: Markdown for people (each entry carries
         `<!-- lit:id=… -->`; it ends with the license notice and the link
         to the terms), the W3C Web Annotation shape for other tools, and a
         full backup (`{ format: "lit-notebook", version: 1, … }`) that
         restores everything. "Open a copy…" shows a summary and the
         problems first, then commits once (one undo step) through the
         merge engine. Details in `STUDY-DESK-FORMAT.md`, "The export
         file".
       - **Defaults**: the reader-facing name **"Labels"** (M8's open name),
         unique ignoring case and accents, a new label matching an old one
         reusing it, and deleting a label stripping it from every record in
         one undoable step; labels applied from the notebook page only (the
         panel has a label filter but no chips); the W3C motivations
         (highlight is highlighting, a note is commenting or, for the
         `question` marker, questioning, a bookmark or pinned footnote is
         bookmarking); trash only in the full backup, so a deleted note's
         words never reach other tools; Markdown reads back as edits to a
         note's body or a bookmark's label, and a new entry with a verse
         reference (or a glossary or article link) becomes a new note, while
         highlights, bookmarks and pins can't be made from Markdown (the
         import says so) and places and labels aren't read back; nothing is
         deleted for being absent from a file (C17); a line starting `#`,
         `>` or `<!--` in a note is escaped with a backslash on save and
         unescaped on import; Web Annotation files LIT didn't make are
         reported and skipped, and malformed records skipped and listed.
       - **Rough**: Ctrl+Z after "Empty the trash now" is guarded only by
         the history's overtaken check; the real file picker and real
         downloads weren't exercised (a synthetic file and an intercepted
         download stood in).
     - **Places and ribbons** (B1, C25). `desk-places.mjs` (pure),
       `desk/places.js` (a Places section in My Notes and on the notebook
       page), `ribbon-follow.js` and `ribbon-form.js` ("Ribbon here…" in the
       My Notebook row of the verse menu and the selection panel, both
       views). `last-read.js` now also dispatches a `lit:last-read` event
       on each save, which nothing hears unless the desk is on. **"Continue
       reading" and Read View's per-book places are not notebook records**;
       they are read from their own storage (whether places sync is open,
       and BVJ leans against). Ribbons are `place` records with
       `ribbon: true`.
       - **The C25 rule**: following a ribbon's link sets
         `sessionStorage['lit-desk-ribbon']`; while the reader stays in that
         book in that tab the ribbon moves (written without an undo entry),
         and any page outside the book clears the flag.
       - **Defaults**: at most 6 ribbons; names up to 40 characters, unique
         ignoring case; a move at most every 4 seconds and only when the
         verse changed; a chapter opened at its top moves the ribbon to
         verse 1; the book's intro keeps the flag without moving it; a
         ribbon links to the view the reader is in; Read View's place is a
         chapter only ("Romans 5 · Read View"); the list runs this book's
         places, Continue reading, ribbons by name, other clients' places,
         then Read View's; creating a ribbon doesn't start it following
         (only following its link does, not with Ctrl, Cmd or Shift);
         moving one by hand and renaming are undoable, automatic following
         isn't. Not done: a margin mark for ribbons (B4's scrollbar ticks
         aren't in 1d).
     - **The interleaf (N7, C13): built 2026-10-12, then set aside by BVJ
       (2026-10-13).** BVJ: "I think I'm not sold on the interleaf
       feature. It seems redundant to the notes in the notebook and in the
       left margin and breaks up the scripture text." It was a band
       (`data-desk-band`) after each paragraph that has notes, closed on
       every load, opened from the panel's foot or the menus. The code is
       on `claude/desk-1d-hidden`, commit 1f27b2e; commit aacdc92 takes it
       out of this branch. **To revive it, revert aacdc92 rather than
       merging that branch again**, since git counts 1f27b2e as merged
       already. The help page's section on it went with it.
     - **Search and commands** (D2, D3). `desk-search.mjs` and
       `desk-commands.mjs` (pure), `desk/notebook-search.js` (reads
       IndexedDB read-only and never creates it) and `desk/commands.js`
       (the one `lit:desk-command` listener). `loadDeskSearch()` in
       `search-core.js` is the only way either search surface reaches the
       desk. It matches note bodies, highlight quotes, bookmark labels,
       place and ribbon names, pinned-footnote text, label names and
       glossary and article note titles, by word beginnings, case and
       accents ignored. Nine commands: Open or Close the notebook, Show My
       Notes, Show This verse, Hide or Show my notes, Open the notebook
       page, Save a copy, Ways to keep your notebook, Take the tour; `>`
       lists them. **Defaults**: the tray shows 4 notebook matches then "N
       more in your notebook" (`/notebook/?q=…`), /search shows 10 then
       "Show N more"; in the tray the commands come first, then the
       notebook, then the rest; on /search the notebook group is at the top
       with its jump link after "verses"; both show only under "All
       results"; M1 empties the group; event commands only on reading
       surfaces and This verse only on Study View chapters; Enter on a `>`
       query runs the first command while a plain query keeps Enter as
       search; no new shortcut. Not done: /search's own tray has no
       commands or notebook group (hidden there by CSS), and the header's
       search strip wasn't tested separately.
     - **First use, the tour and the help page** (D6, C18, D8, M12, the
       privacy paragraph). `desk-first-use.mjs` (pure), `desk/first-use.js`,
       `desk/tour.js`, `src/pages/notebook/help.astro`, and one paragraph in
       `src/pages/privacy.astro`. The card in My Notes asks "Where should
       your notebook live?" and offers "Keep it in this browser" or the same
       "and remind me to save a copy", each saying what is lost if the
       site's data is cleared, with no account mentioned
       (`lit-desk-home`). The panel's foot has the reminder checkbox, a line
       like "Kept in this browser. Last saved a copy 3 days ago.", the
       reminder with "Save a copy", **desktop Safari's line** (Safari clears
       a site's data after seven days of use without a visit), and Take the
       tour, Help and "Tell us what's missing" (/contact/). **The tour**
       (`lit-desk-tour`) is offered in a window beside the Notebook the
       first time the reader expands it with the choice made, and
       replays from the foot, the `tour` command and the help page; it
       writes no records. **The offer became that window on 2026-10-14**
       (BVJ; it was a card in My Notes, offered once): "Take the tour
       now," "Remind me later" (also the ×, Escape, closing or minimizing
       the Notebook, and leaving the page; it comes back on a later day),
       and "Don't show this again" (which also ends the offers of new
       steps). `src/scripts/float-window.js` is the window: it stays open
       through clicks elsewhere and doesn't take the shared panels' slot,
       the layer 2a's search commands window is meant to reuse.
       **Rebuilt 2026-10-13 as a walk-through whose steps
       act** (BVJ: "more thorough in walking through how to use the
       features"; steps that act, and "the changes it makes should not
       persist after the tour is done"). Fifteen steps in three parts, each
       with "Skip this part": *marking the text* (open the menu, write a
       note, the margin, highlight, bookmark, a ribbon, pin a footnote), *the
       Notebook* (the panel, "This verse", "Greek", the widths) and *finding
       and keeping* (undo and "Hide my notes", search and commands, the
       notebook page, where it's kept). Read View gets eight of them and an
       article or the glossary seven or eight (`views` on each step in
       `desk-first-use.mjs`). What each does: opens the verse menu (or, in
       Read View and on prose, selects a few words to open the selection
       panel); opens the real note editor in an example mode that can't
       save (`setEditorPreview` in `note-editor.js`); draws an example note
       in the margin when the reader has none in view; previews a highlight
       with a Custom Highlight of the tour's own (`desk-tour-hl`); opens a
       footnote's popover at its Pin; opens the panel's tabs (the Greek at
       the verse's first word); types "notebook" into the search box. When
       it ends, by Done, Skip or Escape, all of it is undone: menus closed,
       the selection cleared, the example and preview removed, the search
       box's words restored and its tray closed, the Notebook put back as
       it was with `lit-desk-panel`, `lit-desk-min` and `lit-desk-tab`
       rewritten as they were (`snapshot` and `restore` in `panel.js`), and
       the page scrolled back. While it runs, `data-desk-tour` on `<html>`
       stops `saveLastRead` (`last-read.js`), so neither "Continue reading"
       nor a following ribbon records the places it scrolls through.
       Checked in the browser on Romans 8 (panel open, minimized and
       closed), Read View, an article and the glossary: every `lit*` key,
       the record count and the scroll position came back unchanged. What
       the reader does during the tour (a highlight they choose) is theirs
       and stays. The help
       page covers ways to keep the notebook, saving and opening a copy,
       deleting everything, places and ribbons, labels,
       search and commands, the tour, sharing what you write (with the
       license-terms link) and the contact link. **Defaults**: the reminder
       is due at 7 days or more, or when no copy exists and the notebook has
       records; ticking the foot's checkbox counts as answering the card;
       the reader's first write with no answer yet opens the panel once per
       visit; the tour is marked seen when it starts; the margin step needs
       the notes' margin and the search step a visible search box; the
       replay goes to John 3. The privacy paragraph names the notebook's
       IndexedDB storage, that nothing reaches the LIT team, that copies
       are the reader's own files, how to delete, and the storage keys.
       Its effective date and `dateModified` moved to 2026-10-13 (BVJ), and
       a /privacy change notifies the LSC repo for review by the existing
       workflow.
     - **N8, the hidden passage: built, then held** (BVJ, 2026-10-12;
       "Decisions"). It is on two branches and not in this change:
       `claude/desk-1d-hidden` (commit 0c95d7d, on top of the interleaf
       commit 1f27b2e, so **reviving it means rebasing it onto main without
       1f27b2e**, or reviving the interleaf too, since it edits
       `interleaf.js`: blur 0.4em, the passage inert and `aria-hidden`, a veil layer
       outside the scripture's DOM, a screen-reader control, previews
       honouring it through `window.litPreviewGate`, the verse menu
       replaced by "This passage is hidden by your note…", margin notes
       hidden) and `claude/desk-1d-search` (commit a933c55: search results
       cover a hidden verse). Known for later: a hidden passage can flash
       for a moment on load (it needs a pre-paint addition to Layout.astro),
       and a hidden verse's own menu is unreachable while hidden. The help
       page and the privacy paragraph don't mention it, and a `hidden`
       record arriving from an import shows as a plain "Other items" row on
       the notebook page.
     - **Plumbing**: new localStorage keys `lit-desk-home` and
       `lit-desk-tour`, sessionStorage `lit-desk-ribbon`, META `lastExport`;
       new events `lit:last-read` and `lit:desk-command`; `OSIS_BOOKS`
       moved to `src/lib/osis.mjs` (`chapter-html.ts` imports it);
       `panel.js`'s `showTab(id, { focus, remember })` serves both the
       commands and the tour. Saving live into a chosen file (D1) still
       waits on T3.
   - **1e. The licensed translations. DEFERRED INDEFINITELY (BVJ,
     2026-10-11); not in version 1, and not built.** What follows is the
     record of the plan. (D7; BVJ, 2026-10-08: the other
     translations are in the first release, four or more). The CSB, NASB 2020
     and NIV join the public-domain versions in the Versions tab and in
     "This verse":
     - **A small Worker of its own** (beside `workers/contact-form/`, deployed
       the same way) holds the API.bible key as a secret, answers only
       litbible.net, and caches each chapter for at most the 30 days API.bible
       allows. Cached that way, refreshing all 260 chapters of three
       translations is under 800 requests a month, inside the Starter plan's
       5,000. Its address stays out of crawlers (robots.txt), since API.bible
       bars any AI use of licensed text. DISASTER-RECOVERY.md gets the Worker
       and its secret.
     - **API.bible's tracking script (FUMS)** loads only when licensed text is
       on screen, never on page load, and the privacy page names it (a
       /privacy change notifies LSC for review, by the existing workflow).
       Its origins join the report-only CSP list.
     - **Each version's copyright notice** under the tab, the text unaltered,
       and **Study View only**: API.bible allows at most 500 consecutive
       verses on screen, and a whole book in Read View runs past that (Luke
       has 1,151).
     - **A verse-numbering map for each**, checked against its text like the
       KJV's, since counts alone prove nothing.
     - **"Or more"**: public-domain translations (the Open English Bible,
       the World English Bible, the Berean Standard Bible, the American
       Standard Version) are stored on the site like the KJV, need nothing
       from API.bible, and could even join in 1c; which ones is open. A
       fourth licensed one would need a paid API.bible plan (whether it allows
       that for noncommercial use is unconfirmed). **The NRSVue and CEB are
       shelved for a possible second version** (BVJ, 2026-10-08); they need
       permission from their publishers, and D7 has the contacts.
     - **Waits on BVJ**: first, whether to accept API.bible's terms at all
       (D7, "API.bible's own terms": §5.4 on "controversial use", §12's
       copy and print limits), or to license the three directly, or to link
       out to them in the first release; then the tracking script and
       API.bible's answers on the NASB 2020 and open Bibles (see "Still
       open"). If they link out, 1e shrinks to the links and a copyright
       line. Medium.
   - **1f. The Greek tab** ("Decisions", 2026-10-08 (the Greek tab); in the
     first release, BVJ, 2026-10-08). It reuses 1c's tabs, and builds the
     own-scroll chapter view itself, since the Versions tab that was to
     provide it is deferred (2026-10-11):
     - **The data, built at build time** into one file per chapter, a
       website asset never under `/api/`: SBL's own files
       (`github.com/LogosBible/SBLGNT`, CC BY 4.0) as the text of record,
       MorphGNT's lemmas and parsing checked word for word against it, and
       the two borrowed passages (John 7:53–8:11's parsing from MACULA Greek;
       Romans 16:25–27's Greek from the SBLGNT apparatus with parsing from
       MACULA's Nestle 1904). Files built from share-alike sources go out
       under CC BY-SA 4.0 and stay apart from everything else; nothing from
       the LIT goes into them. The parsing codes are spelled out in words by
       a small pure module.
     - **The tab**: the Greek in the SBLGNT's own paragraphs (SBL's data
       marks them), scrolling on its own, each word a
       control; the word's details docked at the tab's foot, with the
       UBS / STEPBible switch (UBS opening on the sense it assigns at that
       word; STEPBible's brief entry with "Full LSJ entry" always showing;
       since 2026-10-13 a heading with the entry under it, BVJ);
       the verse's footnote letters beside them, since the LIT's notes give
       the reasoning where a lexicon and the LIT differ. For the 31 glossary
       terms, the term lens's card: "rendered here as…", at the level of the
       verse, since the word-to-word link waits for phase 2.
     - **The apparatus** at the end of the tab, below the text, and each
       text-critical sign opening its note. Check that
       Cardo has every sign the SBLGNT uses (⸀ ⸂ ⸃ and the rest) first
       (checked 2026-10-13: full Cardo has all six, Fontsource's subsets
       none; see "Built").
     - **"This verse"** gains the verse's Greek.
     - **"Sources and licenses"** at the tab's foot: SBL, MorphGNT, MACULA,
       UBS and STEPBible, each with its license, the way the SBLGNT notice
       credits the text.
     - **Before it ships**: ~~BVJ's wording for the John 7:53–8:11 footnotes
       (john-7 fn-ff, john-8 fn-k), which said the SBLGNT lacks the passage
       that the tab will show as SBLGNT text~~ (done 2026-10-11, see
       "Decisions"); ~~and CLAUDE.md's MorphGNT paragraph loses the old
       SBLGNT EULA line~~ (done 2026-10-13). Large.
     - **Built 2026-10-13**, behind the preview, all of the above:
       - **The data is committed, not built with the site**, unlike the
         plan's wording: CI has no copy of the sources, so `npm run
         build:greek` reads clones kept outside the repo
         (`GREEK_SOURCES_DIR`, `MORPHGNT_DIR`) and writes `public/greek/`,
         like `build:alignment`. `text/` holds 260 files (9.5 MB), with the
         lexicons sharded so a word fetches one small file: `ubs/` (64,
         3.3 MB), `step/` (64, 3.3 MB) and `lsj/` (128, 17.3 MB), plus
         `LICENSE.txt`. Pure rules in `scripts/lib/greek-core.mjs`, tested.
       - **Checks it made**: SBL's text and MorphGNT agree word for word in
         every verse they share (elision mark and capitals aside), which
         confirms the 2026-10-12 comparison. John 7:53–8:11 has 186 words
         parsed from MACULA; one, Μωσῆς (8:5, MACULA spells it Μωϋσῆς), has
         none. Romans 16:25–27 has 53 words parsed from MACULA's Nestle
         1904. Strong's numbers come from MACULA per lemma, then UBS; three
         lemmas have none. 76 lemmas, mostly names MorphGNT capitalizes
         (Διάβολος, Πόλις), have no UBS entry: matching ignoring case would
         link "Καλοὶ Λιμένες" to καλός, so it isn't done. UBS gives the
         sense at 90% of words (matched by lemma and occurrence, since UBS
         numbers words in its own text); where its citations in a verse
         don't fit the words, none is claimed. Romans 16:24 has none: UBS
         cites nothing there.
       - **The tab** (`desk/tab-greek.js`, `greek-data.js`,
         `src/lib/desk-greek.mjs`): the Greek in Cardo at the Display
         tray's size; one tab stop for the words, the arrow keys moving
         through them (Up and Down by verse), the page never scrolled;
         "Go to verse N" names the verse at the reading line; a sign in the
         text takes the reader to its apparatus note, which has "Back to
         the text". The details show the word, its parsing in words
         (`src/lib/greek-parse.mjs`, moved out of the phase 2 tool), lemma,
         gloss and Strong's number, the lexicon (UBS's sense at this word
         first; STEPBible's brief entry, then the full LSJ entry under its
         own heading, always shown, BVJ 2026-10-13), "LIT notes on verse N"
         (opening This verse), and "In the LIT: rendered here as…" with the
         glossary link for the 47 glossary terms, read from the page's
         term-lens data, whose terms now carry their Greek lemmas.
         **This verse** shows the verse's Greek; a word opens the Greek tab
         on it.
       - **The signs**: Fontsource's Cardo has none of ⸀ ⸁ ⸂ ⸃ ⸄ ⸅, so
         `npm run build:text-critical-font` takes them from full Cardo into
         `public/fonts/text-critical-signs.otf` (2 KB, with its OFL text),
         patched in under Crimson Text and Inter as the ⟦ ⟧ brackets are.
       - **What 1d needed**: a "Show the Greek" command; the tour's panel
         step names the Greek tab; a section on the help page;
         `lit-desk-lexicon` in the privacy paragraph's keys. Nothing else
         in 1d changes: the tab writes no records, so export, import, search
         and undo are untouched.
       - **Defaults for BVJ to judge** are under "Still open" ("Phase 1f's
         defaults"). Not done: a minimum width for the tab (it works at
         280px, cramped), and checking a failed fetch on a real network.
   - **1f doesn't depend on 1d**, and can go before it, after it or
     between its parts; it needs only 1c's tabs. **Then decide
     whether to release the desk to readers**, with 1f, since the
     first release includes the Greek (BVJ, 2026-10-08) but no other
     versions (BVJ, 2026-10-11).
   - **1g. An interleaf for the Greek: explored, then shelved for the
     future** (BVJ, 2026-10-13; version 2 now). BVJ's idea: use the interleaf (N7, set
     aside as redundant the same day) for something like an **interlinear
     Greek** under the LIT, and let readers **write their own notes on the
     Greek**. Nothing is decided. What the exploring found, kept for
     whenever it is picked up:
     - **Two kinds of interlinear, and only one is possible before alignment
       phase 2.** In *Greek order*, the Greek runs as written, with a gloss
       and parsing stacked under each word, in a band under the LIT; all of
       it is 1f's data (half the glosses are 4 characters or fewer). In
       *English order* (a "reverse interlinear"), the Greek sits under each
       LIT word; that needs phase 2, which is unpublished until it covers the
       whole NT.
     - **The gloss is the real design question.** Lexicon glosses are
       traditional (σάρξ "flesh", μετάνοια "repentance"), and right under the
       LIT they read as a correction of it. Options: (a) the lexicon's gloss,
       labelled as the lexicon's; (b) the same, plus the LIT's own rendering
       in that verse for the 47 glossary terms, from the term-lens data
       (reviewed and gated, and carrying each term's lemmas), with the lexicon
       gloss where a lemma occurs twice in a verse, since phase 1 records a
       rendering per verse, not per word; (c) no gloss, parsing only. The
       recommendation was (b).
     - **Where it sits**: (i) a band after each paragraph (N7's code), (ii) a
       band after each verse, or (iii) an "interlinear" layout inside the
       Greek tab, which leaves the page alone. The recommendation was to mock
       (i) beside (iii): Study View only, off by default behind one switch,
       `keepReadingPlace` holding the line as the bands open, and the Greek
       tab's keyboard model (one roving tab stop; a screen reader hears each
       word with its gloss).
     - **Notes on the Greek** would anchor to {book, chapter, verse, word
       number, form}, phase 2's own shape, and allow a span (πίστις
       Χριστοῦ). The SBLGNT doesn't change, so these anchors never drift and
       never need a change notice. It is a change to STUDY-DESK-FORMAT.md, so
       BDR reviews it first; the apps keep kinds they don't know (principle
       6). John 7:53–8:11 and Romans 16:25–27 need the source label "Ready
       for the Greek text" mentions. A note on every use of a lemma belongs
       to N2 (phase 2).
     - The interleaf's code is on `claude/desk-1d-hidden` (commit 1f27b2e;
       revert aacdc92 to bring it back).
   - **1h. Searching the Greek: explored and planned, to build** (BVJ,
     2026-10-13). Kept apart from 1f rather than added to it.
     **Decided** (BVJ, 2026-10-13):
     - **What a reader can type**: Greek script, with or without accents,
       finding any form of the word; a Strong's number (G4102); a
       transliteration, where **agreuō and agreuo return the same
       results**; and an English lexicon gloss, as a bridge from the
       traditional word to the Greek ("faith" → πίστις), the way topics
       bridge traditional vocabulary.
     - **The main search bar searches the Greek, for every reader**: the
       header's tray and /search. **Clicking a result opens the notebook to
       the Greek tab, at that word.**
     - **None of it shows before the public launch** (BVJ, 2026-10-13):
       until the Notebook is released, a reader without the preview sees no
       Greek group, no Greek count and no Greek jump link, and downloads none
       of the index. "Every reader" starts at launch.
     - **A second search field in the Greek tab** is fine if there is room
       for it visually.
     - Results show the Greek with the LIT verse under it. Word families and
       construction search come later (below).

     **The plan.** What 1f already gives makes the matching cheap: every
     word's lemma (so "any form" is a lemma lookup), MorphGNT's word number
     (`t`), and per lemma a Strong's number (5,462 of 5,465 lemmas have one)
     and a short gloss; STEPBible's brief lexicon adds a transliteration per
     lemma (`agreuō`).
     1. **The index**, written by `npm run build:greek` beside 1f's files and
        committed with them, under `public/greek/search/` (CC BY-SA, since it
        is MorphGNT's lemmas; a line in `public/greek/LICENSE.txt`; never
        under `public/api/`). Two parts, because one file holding every
        occurrence measured 600 KB gzipped (137,793 words), more than twice
        `verses.json`:
        - **`lemmas.json`, loaded on the first query that could be Greek**:
          each lemma with its Strong's number, gloss, transliteration key and
          count, and every accent-folded form pointing at its lemma (18,620
          forms). Measured at about 230 KB gzipped as a first cut, before
          folding forms together; aim lower.
        - **Occurrences, sharded by lemma** (as `step/` and `lsj/` are by
          Strong's number) and fetched only once a lemma is chosen: for each
          occurrence the verse, `t` and the form, so "exact form only" is a
          filter, not another fetch.
        The pure rules go in `scripts/lib/greek-core.mjs` with its tests.
     2. **One pure matching module**, `src/lib/greek-search.mjs`,
        unit-tested, shared by the search bar, /search and the Greek tab, the
        way `search-core.js` keeps the two search UIs agreeing. It sorts a
        query into its kind: anything with a Greek letter is Greek; `G` plus
        digits (also `g4102`, `strong:4102`, `G04102`) is a Strong's number;
        other Latin text is tried as a transliteration *and* as a gloss.
        - **Greek** folds as verse search folds (accents, breathings, iota
          subscript, final sigma, case), finds the form's lemma, and returns
          every form of it. A lemma typed directly works the same way.
        - **Transliteration** compares one key built from the Greek at build
          and from the query as typed: lowercase, every mark stripped (so ō =
          o, ē = e, and agreuō = agreuo), then the spellings that mean one
          letter collapsed: kh/ch (χ), ph/f (φ), y/u (υ), x/ks (ξ), ng/gg
          (γγ), and a breathing's h dropped from the front of both.
          Test cases to write first: agreuō = agreuo, pistis, Christos =
          Khristos = xristos, hamartia = amartia, ēgapēsen = egapesen,
          psychē = psuche. Near misses rank after exact keys, using the
          `levenshtein` already in `search-core.js`, and only at 5+ letters,
          as verse search's typo correction does.
        - **Gloss** matches whole words in the lemma's gloss ("faith" finds
          πίστις, not "faithful" unless asked), ranked by how often the lemma
          occurs.
     3. **The main search bar** (`search-core.js`, then `searchbar.js` and
        `search.js`; ordinary site search, since every reader will see it, so
        none of it waits for the Notebook's code to load). **Until launch it
        runs only with the preview on**: one test in `search-core.js`, the
        same `data-desk="on"` check `loadDeskSearch()` makes, decides whether
        the Greek is searched at all, so launch is a one-line change and a
        reader without the preview gets exactly today's search:
        - **The tray** gets a "Greek" group. For a query that names one lemma
          (Greek script, a Strong's number, an exact transliteration), up to
          six verse rows ("John 3:16 · πιστεύων") and "All 243 on the search
          page". For a query that reaches several lemmas, one row per lemma
          ("πίστις · pistis · G4102 · faith · 243 times"), which narrows the
          search to it. **Decided** (BVJ, 2026-10-13): so that
          every English search doesn't grow a Greek group ("love" reaches
          ἀγάπη, ἀγαπάω, φιλέω…), a Latin query shows the group in the tray
          only on an exact transliteration key or a gloss that *is* the query
          word, at most three lemmas, below the scripture groups; /search
          shows it always.
        - **/search** gets a Greek group with its own jump link, a choice of
          lemma when several match, "exact form only", and verse rows
          showing the reference, the verse's Greek with the matched word
          marked, the parsing in words (`src/lib/greek-parse.mjs`), and the
          LIT verse beneath (from `verses.json`, which the page loads
          anyway). The Greek for each row comes from 1f's chapter file
          (about 10 KB gzipped each), fetched for the rows on screen only:
          ten at a time, with "Show more" fetching the next ten.
        - A book filter narrows the Greek like everything else. Without JS,
          nothing changes: /search already needs it.
     4. **Clicking a result opens the notebook to the Greek tab.** The link
        is the ordinary verse link with one parameter, `/john-3/?greek=16.7#v16`
        (verse, then `t`). On load, the Notebook's code reads it, opens the
        Notebook panel (restoring it if minimized, and **opening it even if
        the reader closed it**, BVJ 2026-10-13, since they asked for the
        Greek; the panel's state is remembered as usual afterwards), shows the Greek tab, and calls
        `selectWord(16, 7)`, the call This verse's Greek words already use
        (`openGreekWord` in `desk/panel.js`); then it removes the parameter
        with `history.replaceState`, so the address the reader keeps or
        shares is the plain verse link. Where the website has no Notebook (a
        phone or a tablet, whose readers have the apps), the parameter is
        ignored and the reader lands on the verse, as any verse
        link does. A parameter rather than a sessionStorage flag (C25's
        way), because it survives a result opened in a new tab. A result
        for the chapter already on screen skips the reload and calls the
        panel directly.
     5. **The Greek tab's own field**, only if it fits: a search button in
        the tab's header row, which opens the field in place, so the tab
        loses no height until it's used. Results replace the text in the
        tab's scroller, with "Back to the text" (as the apparatus note has),
        and a result moves the tab to that word, loading the chapter first
        when it's another one. Mock it at the 280px minimum before building.
     6. **Keeping the docs true**: CLAUDE.md's `build:greek` row and its
        Search bullet (a third engine), the README's command list if it
        changes, and this file. Nothing is stored about a search, so the
        privacy paragraph is unchanged unless a remembered "exact form"
        choice is added.

     **Not in 1h**:
     - **Word families** (πιστεύω, πίστις, πιστός). No source 1f uses groups
       lemmas into families. The Abbott-Smith entries in STEPBible's data
       carry etymologies in parentheses ("ἀγρεύω (ἄγρα)"), and Strong's has
       "from G…", either of which could seed families mechanically, with
       editorial review after.
     - **Construction search** (πίστις with Ἰησοῦ Χριστοῦ in the genitive),
       which matters for the LIT's *pistis* renderings, and **filters by
       parsing** (every aorist imperative of a verb). Both need a query
       language of their own.

     **Its open details were settled** (BVJ, 2026-10-13): a result opens
     the Notebook even when the reader closed it; the tray rule for Latin
     queries above stands; and 1h is built before phases 2 and 3 begin.

     - **Built 2026-10-13**, behind the preview, steps 1 to 6:
       - **The index** is `public/greek/search/`: `lemmas.json` (5,465
         lemmas, 222 KB gzipped) and `occ/00.json` to `63.json` (137,793
         words, 671 KB gzipped in all; ὁ makes the largest, 74 KB). Written by
         `build:greek` from the chapter files it builds, so its words, lemmas
         and Strong's numbers are 1f's exactly. CC BY-SA, a section in
         `LICENSE.txt`.
       - **Two departures from the plan, found while building.** The
         transliteration shown is worked out from the Greek in the SBL
         Handbook's style (psychē, huios, houtos), not taken from STEPBible,
         whose data writes a breathing inside a diphthong ("ohutos",
         "uhios"); both spellings still match, since the key ignores the h.
         And the gloss a lemma is found by is not only its 1f gloss: that is
         UBS's most-used sense, which for πίστις is "to believe in", so
         "faith" found nothing. The index also carries STEPBible's brief gloss
         ("faith", which the lemma's line now shows) and every other UBS
         sense gloss, matched only as a whole gloss, so "faith" doesn't reach
         πατήρ through "father of the faith".
       - **A lemma's other Strong's numbers count too.** MACULA numbers
         words of one lemma differently (extended Strong's), and 1f keeps
         the commonest, so εἰμί is G2076 there; G1510 and 15 others now find
         it as well. 71 lemmas have more than one.
       - **Matching** (`src/lib/greek-search.mjs`, tested, with the plan's
         test cases and more): one Greek word at a time (a phrase is
         construction search, below); a typed lemma finds that lemma alone,
         any other form finds every lemma it can be (ἦν is εἰμί or ὅς);
         order is exact keys, a gloss that is the query, near misses (5+
         letters, /search only), other glosses, then sense glosses, more
         frequent first within each. A nasal γ is "n" (angelos, enchriō) and
         κσ is "x", so egchriō and ekstasis match too.
       - **Revised the same day** (decision log, "English and Greek
         apart"): a query gets English or Greek results, never both, and
         "Greek" is a type in the menu. As revised, **the tray** shows only
         a Greek group for a Greek query: six verses ("1 Corinthians 8:7 ·
         γνῶσις") and "All 29 on the search page", or a row per lemma that
         narrows to it. **/search** shows only the Greek: it names the lemma
         found ("γνῶσις · gnōsis · G1108 · knowledge · 29 times"), offers a
         choice when several match and "Exact form only" for a form, and
         pages the verses ten at a time with the English pager: the Greek
         with the word marked, its parsing in words, and the LIT verse. A
         reference query ("John 3:16") skips the Greek. The glossary bridge
         was added then too.
       - **The landing** (`desk/greek-link.js`) and **the tab's own search**
         (`desk/greek-find.js`) are as planned. **In a word's details, the
         form, the lemma and the Strong's number each start a search** in
         the tab (BVJ, 2026-10-13, after trying the tab): the form with
         "Exact form only", the lemma for all its forms, the number by
         number. Plain clicks, no right-click menu, which keyboard and
         screen-reader users can't reach.
       - **Checked in the browser**: Greek, transliterated, Strong's and
         English queries in the tray and on /search; a result opening the
         closed Notebook at the word and leaving a plain verse link; the
         tab's search and its starters, at about 254px; with the preview
         off, no Greek group and no request under `/greek/`.
       - **Defaults for BVJ to judge** are under "Still open" ("Phase 1h's
         defaults").
2. **What only the LIT can do**, split three ways (BVJ, 2026-10-14;
   "Decisions"). **The order is 2a, then phase 3**; S2 needs a sheet, so 2b
   can't come before phase 3 either. The core of
   N3, finding a mark again and saying when its words changed, moved into
   phase 1, since every mark is re-found on every load.
   - **2a, the read-only pieces**: what's new for you (B3), on 1a's
     comparison; your own chains (N4), through the linker the footnotes
     already use; and
     **construction search** (BVJ, 2026-10-13: *pistis* with *Iēsou
     Christou* in the genitive, the case that motivates it; a small query
     language over 1f's parsing, no new data, and a page for its results;
     "Order of work", 1h, under what it leaves out), with **searching by
     parsing** (BVJ, 2026-10-13: every aorist imperative, every genitive of
     *pistis*; the query language's simplest use), both moved here from 2c
     (BVJ, 2026-10-14). Each only reads what the notebook and the site
     already hold and writes no new kind of record, so it can be taken out
     again cleanly. B3 and N4 are small; the query language and its
     page are the larger part.
     - **Footnotes that cite this verse** (proposed 2026-10-16, decided by
       BVJ in the same conversation). The This verse tab lists every footnote
       that cites the verse, the way N4 lists notes that cite it. It is read
       only: a build step writes a reverse index from cited verse to citing
       footnote, using the site's own render-time linker, and the desk reads
       it when the tab opens. Decided: each citing footnote is its own entry,
       with its chapter, label, text and a link to where it sits, so three
       footnotes that point at one verse are three entries, even with the same
       wording, and a footnote stored in two chapters is listed under each;
       same-chapter citations are included, with no special label; a relative
       reference such as "vv. 9–11" is written out in full in the text rather
       than resolved in code (the 1 Corinthians 12 and 14 note, §34 of
       `FOLLOW-UP-RECONCILIATION.md`); Sefaria and eBible links, and
       translation-tagged references, are left out. Not yet counted: bare
       parenthetical forms such as "(1:20–25)". Counted 2026-10-16 with the
       site's linker: 485 of 5,738 footnotes cite a verse, in 702 links to 439
       distinct verses. Read-only, so it adds no record kind and no format
       question.
     - **Built on the preview 2026-10-15: B3 and N4. M10 was built and
       shelved** (BVJ, 2026-10-15); it is version 2 now, see below.
       Construction search and searching by parsing came after (below).
       Neither piece writes a record; the only thing stored is a notebook meta value,
       `whatsNewSeen`, and a session cache of the feed.
       - **B3, what's new for you.** `src/lib/desk-whats-new.mjs` (pure)
         narrows release-notes.json to the reader's marked verses, using
         the change notice's own verse parsing (`changeVerses`), so the two
         can't disagree. Marks counted: notes on verses, highlights,
         bookmarks, pinned footnotes and ribbons. Changes counted: wording
         (`text_updated`) and footnotes (`footnote_added`,
         `footnote_updated`). A change counts for a mark only when it was
         published on or after the day the mark's text was taken. Shown as
         a "What's new for you" section on `/notebook/#whats-new`
         (`desk/whats-new.js`; ten publishes, then "Show more"; "New" on
         publishes after the day last looked) and as one line in My Notes
         ("Two changes since your last visit touch your verses") linking
         there. "Last looked" is the newest feed date seen
         (`whatsNewSeen` in the notebook's meta), not the clock. The feed is
         fetched once per tab (`desk/release-feed.js`,
         `sessionStorage['lit-desk-release-feed']`, keyed by content
         version), and the change notice now shares it.
       - **N4, your own chains.** `src/lib/desk-chains.mjs` (pure): a note's
         body is escaped, then passed through `linkScriptureRefs`, so a
         typed reference links and previews exactly as a footnote's does
         (Hebrew Bible to Sefaria, apocrypha to eBible.org, neither counted
         as a chain). Every place the desk draws a note's body uses it
         (`desk/note-words.js`). Since a link can't sit inside a button, a
         note's own control is now its marker's button or link, stretched
         over the row, with the words' links lifted above it. The This verse
         tab gains "Notes that cite this verse": "Mentioned in your note on
         Romans 8:3–4." `boot.js` imports `ref-preview.js`, so previews work
         on /notebook/ and Read View too.
     - **Construction search and searching by parsing: built on the
       preview** (2026-10-15, branch `claude/desk-2a-construction`), as
       Greek search commands. The syntax and the window were settled by BVJ
       on a switchable mockup (decision log, 2026-10-14, "Greek search
       commands"). Read only, like the rest of 2a: nothing is stored but
       two small browser keys about the window.
       - **The data** (`npm run build:greek`, format 2 of
         `public/greek/search/`): each word in a lemma's shard carries its
         parsing (MorphGNT's part of speech and code, from a per-lemma
         table), so "genitives of πίστις" reads the shard it already
         fetches; and `search/parse/<group>.json`, every word by its
         parsing (verbs by tense and mood, words with case by part of
         speech and case, the rest by part of speech; 57 groups, 601 KB
         gzipped, named by `parseGroup`), answers a search with no word in
         it. `occ/` grew 16.7%.
       - **The query language** is `src/lib/greek-query.mjs` (pure,
         tested): words joined by "," or "and"; "/" or "or" for either
         word; "*" or "any" for any word; "=" or "exact" for one form;
         filters joined to a word with dots (πίστις.gen, *.aor.impv) or
         typed after it as words (pistis genitive); two filters of one kind
         joined by "/" or "or" for either (πίστις.gen/dat, "pistis genitive
         or dative": genitives or datives, 152 matches; BVJ, 2026-10-15),
         while "gen.dat" is an error that says to use the slash; and how close, once for
         the whole query: ~3 or "within 3" (the default), ~0 or "next to",
         ~v or "anywhere", & or "any order". One bare word is always a
         word ("any", "perfect" and "genitive" alone search as glosses),
         quotes always mean the word itself, and a command at the end waits
         for what follows. A match is one occurrence of the first word
         with a word of each later term within reach.
       - **What the reader sees.** On /search, a "Search commands" button
         beside the box while the Greek is searched, the placeholder "Try
         πίστις.gen or *.aor.impv", the search said back above the verses
         ("Genitives of πίστις, followed within 3 words by a genitive of
         Ἰησοῦς or Χριστός · 6 matches in 5 verses"), every matched word
         marked and its parsing named, examples where the results would be
         when there are none, and errors that suggest the word meant
         ("“genetive” isn’t a command. Did you mean genitive?"). The tray
         and the Greek tab draw the same; in a word's details in the Greek
         tab, its parsing line starts a search for that parsing.
       - **The commands window** (`src/scripts/greek-commands.js`, on
         `float-window.js`) is the one place for instructions and examples
         (BVJ, 2026-10-14: in place of buttons, hints and examples on the
         pages): a builder, the examples, and every command with its word,
         from `COMMANDS` and `EXAMPLES`. A click puts a command at the
         cursor without taking focus from the field. It stays open through
         clicks elsewhere and can be dragged; it closes on its × or Escape,
         on leaving the page and, opened from the Greek tab, when the
         Notebook is closed or minimized or the tab changes. It opens by
         itself once, the first time "Greek" is picked on /search.
       - **Checked in the browser**: the examples and typed queries on
         /search, in the tray (where `*` and `.gen` count as Greek, there
         being no type menu) and in the Greek tab; inserting at the cursor;
         the window's closing rules; the parsing starter; and, with the
         preview off, no button, no Greek type and nothing under `/greek/`
         fetched. Counts against the data: πίστις in the genitive followed
         by Ἰησοῦς or Χριστός in the genitive, 6 matches in 5 verses (Romans
         3:22, 3:26; Galatians 2:16 twice, 3:22; Philippians 3:9); 762
         aorist imperatives; 94 genitives of πίστις.
   - **2b, text checked before printing** (S2), on the same comparison.
     Small. N9, print with room to write, is in 2b too: a print option that
     sets the text in a narrower column beside a wide ruled margin. It stores
     nothing and is a variant of `print.css`. Extra small.
     **Built on the preview 2026-10-20**, after phase 3k (decision log,
     "Phase 2b"). S2's rules are `src/lib/desk-sheet-check.mjs` (pure,
     tested): the comparison is N3's `wordingChanged`, a quoted passage is
     judged on its own words only, and `freshCopy` is what Keep writes. The
     Sheet pane's notice is `wordingNotice` in `desk/sheet-lit.js`; the
     sheet page's is `drawCheck` in `desk/sheet-page.js`, with the checks
     from `copyChecks` in `desk/sheet-copy.js`, which also prints the "Text
     as of" line. The word diff both notices draw moved out of
     `change-notice.js` into `desk/diff-view.js`. N9 is
     `desk/print-room.js`, with its look beside M6's in `desk.css`. No key
     is added.
   - **2c, notes on a footnote** (M11, decided yes): a note attaches to a
     footnote by quoting its words, so it survives relabeling. It adds a
     kind of record to readers' notebooks, which can't be taken back once
     readers hold it, so it is weighed against what a trial with readers
     shows. Medium. N2, H2 with C23 and M4, which were 2c's other pieces,
     are **shelved for version 2** (BVJ, 2026-10-15).
     **Built on the preview 2026-10-20** (decision log, "Phase 2c"). It is
     a new target for a note rather than a new kind, named by kind 11's
     fields (`footnote`, `n`; STUDY-DESK-FORMAT.md, kind 2), so the rules
     are the pin's: `onFootnote` in `src/lib/desk-records.mjs`, `findPin`
     and `pinFields` in `desk-footnotes.mjs`, and `pinNotice` and
     `planKeep` in `desk-change.mjs`, which now take either. The page's
     pieces are `desk/footnote-notes.js` (the buttons and the lists under a
     footnote), with the margin placing such a note beside its footnote
     (`note-sources.js`). Still only on the preview, so the caution above
     stands until a trial with readers.
   - **N6, questions as their own kind** (BVJ, 2026-10-15): mark a note as a
     question, which the apps' `question` marker already carries. Its
     "For discussion" section, gathered by a sheet in passage order, needs
     sheets, so that part follows phase 3. Extra small.
     **Built on the preview 2026-10-20** (decision log, "Phase 2c"): the
     marker was already there; the gather is
     `src/lib/desk-sheet-discussion.mjs` (pure, tested) and the Sheet
     pane's "+ For discussion". It adds ordinary `text` and `question`
     parts, so the sheet format is unchanged.
3. **Sheets.** None of it waits on the apps: a sheet's inner shape is the
   website's own, and under plan A sheets go in the iCloud zone the app never
   opens. **Phase 3 comes after 2a** (BVJ, 2026-10-14), ahead of 2b;
   sheets for Lent were the case for moving it up (review finding 12; Ash
   Wednesday is February 10, 2027). The sheet page (S1) with
   key terms (S3), leader and participant copies (S4), blanks with the
   footnote picker (S10, C15), both paper sizes (C27), the license card with
   its link and the commercial check (S7), and the Word copy (S9); then
   printed codes (S5), present mode with the presenter view and room code (S6,
   M2, M3), sheets from searches and templates (M5, M9), annotated printing
   (M6) and shared links (S8). Large.
   **D4, pop the notebook out**, is the last and smallest piece (BVJ,
   2026-10-15). D9 says the panes cover most of it, so it is decided once
   /desk exists. **Deferred to version 2** (BVJ, 2026-10-21). **Build S1's editor so it can sit
   inside another page** (proposed 2026-10-15), so D9, the desk as a page
   of its own, doesn't mean building sheets twice. **Phase 3 is now sheets
   and the desk together** (BVJ, 2026-10-15; D9, answers 9 to 11): sheets
   are edited only in /desk's sheet pane, a sheet's own address serves
   shared links, present mode and printing, and 2b and 2c follow phase 3.
   Its scope isn't cut to make a date.
   **Phase 3's parts** (proposed 2026-10-18, for BVJ to confirm; one at a
   time, each a PR or two, and the lettering is a working label like 1a to
   1h):
   - **3a. Mockups and open decisions.** **Done 2026-10-18**: mocked as a
     private claude.ai page ("Study Desk Mockups", five questions, built
     by Sonnet from a spec, checked by Haiku) and answered by BVJ the same
     day (D9, "Phase 3a's answers"). No code.
   - **3b. The sheet format and store.** Specify the sheet's inner shape
     in STUDY-DESK-FORMAT.md (kind 9: modules, per-passage blanks and
     printed footnotes, leader-only notes, the commercial flag), then the
     record kind, store writes, trash, merge and undo, with tests and
     vectors. No UI. First among the code, because a stored kind can't be
     taken back. **Since 3a**, the reader's own text is formatted
     (sanitized HTML with the full rich-text set, so the blank-canvas
     template can hold a whole document), and the module list is the
     format's to define, since templates are arrangements of modules.
     **Format approved 2026-10-18** (STUDY-DESK-FORMAT.md, "Sheets (kind
     9)"). **The store built the same day**: `src/lib/desk-sheet-format.mjs`
     (the checks and the sanitizer, built from the allowlist and
     idempotent) and `src/lib/desk-sheets.mjs` (making a sheet and its
     modules, adding, moving, removing and changing them); saving,
     trash, merge and undo are the notebook's own, unchanged, with three
     sheet cases in `test/fixtures/merge-vectors.json`.
   - **3c. The /desk shell and layout.** The route and gate, a pane
     registry, one to four panes in the arrangements 3a settled (every one
     mocked but four rows), chosen from a Layout menu or by dragging a
     pane to an edge of another, with adjustable sizes; several panes of a
     kind, the active LIT pane and the Stay here pin (D9, "Phase 3a's
     answers", 6); the remembered
     layout with "my default" and a reset (a `localStorage` key, named in
     /privacy). Proves itself by mounting one existing pane.
     **Built on the preview 2026-10-19** (decision log, "Phase 3c"):
     `/desk/`, with the rules in `src/lib/desk-layout.mjs` (pure, 87
     tests), the page in `src/scripts/desk/desk-page.js` and the panes in
     `desk/desk-panes.js`. My Notes is the pane it mounts, from the
     Notebook's own `tab-mine.js`; the other kinds say they're still to
     come. The key is `lit-desk-layout`.
   - **3d. The existing panes on /desk.** My Notes, This verse, Greek and
     the notebook's lists, ported from their modules; the Greek pane kept
     in step with the LIT pane as either scrolls (the 1g answer); This
     verse gains a "This chapter" section at its foot holding Go deeper,
     taken from the same fetched page as the text.
     **Built on the preview 2026-10-19** (decision log, "Phase 3d"): the
     panes mount `tab-verse.js`, `tab-greek.js` and the notebook page's
     list (now `desk/kept-list.js`, a new kind, "What I've kept"); both
     tabs read the chapter's fetched Study View page
     (`desk/chapter-page.js`). The passage rules are
     `src/lib/desk-passage.mjs`, the picker `desk/passage-bar.js`. The
     Greek reports the verse at its top as the reader scrolls it and can be
     moved to a verse, which is all 3e needs to keep it in step with the
     LIT pane.
   - **3e. The LIT pane and the footnotes pane (X11).** Study View's text
     fetched a chapter at a time, so anchors stay character-identical
     (`test/desk-anchor-dom.test.js` sweeps it); scrolling through the
     whole corpus with no setting (3a); popovers that know their chapter;
     `keepReadingPlace` when a chapter loads above; drafts as a stub.
     The riskiest part.
     **Built on the preview 2026-10-19** (decision log, "Phase 3e"): the
     pane is `desk/lit-pane.js`, with the corpus in
     `src/lib/desk-corpus.mjs` and the chapter text's ids made its own in
     `src/lib/desk-lit-text.mjs` (swept with Study View and Read View);
     Footnotes is `desk/footnotes-view.js`. Each LIT pane keeps its reader's
     place in the layout, and the active one's is the passage the
     following panes show.
   - **3f. The sheet editor (S1).** First, **the verse menu and the
     selection panel in the LIT pane** (BVJ, 2026-10-19), Study View's own
     from `chapter-tools.js`, with their copy actions and the Notebook's "My
     Notebook" row, since 3e left the pane's verse numbers plain text. Then
     the editor: add passages from the verse menu, a
     selection or the notebook; drag into order; your own text between,
     with formatting; autosave; passages from live text. Built to run
     inside another page, and shown as /desk's sheet pane.
     **Built on the preview 2026-10-19** (decision log, "Phase 3f"): the
     verse tools take the pane as one more view (`attachVerseTools` in
     `chapter-tools.js`); the editor is `desk/sheet-pane.js`, its formatted
     text `desk/sheet-text.js`, and the passage rules
     `src/lib/desk-sheet-passages.mjs`. Which sheet a Sheet pane shows is
     kept in the layout (`sheet`, in `lit-desk-layout`).
   - **3g. The reader's marks on /desk** (BVJ, 2026-10-19). Highlights,
     notes and bookmarks in the LIT pane, as on Study View, with the
     change notice when the words under a mark have moved; and **pinning
     footnotes** there, from the popover, This verse and the Footnotes
     pane. Where a note sits beside a pane's text (the margin is the
     page's, not a pane's) is mocked first.
     **Built on the preview 2026-10-19** (decision log, "Phase 3g"):
     highlights and the verse numbers' names in the LIT pane, and pins in all
     three places. Notes stay out of the pane's text (BVJ): My Notes follows
     the LIT pane by scrolling its list (`tab-mine.js`'s `follow`).
   - **3h. What a sheet knows about the LIT.** The key terms box (S3),
     blanks (S10) with the footnote picker and spoiler flags (C15), and
     the license card with the commercial check (S7).
     **Built on the preview 2026-10-19** (decision log, "Phase 3h"): the
     rules are `src/lib/desk-sheet-lit.mjs` (pure, tested), and the cards
     `desk/sheet-lit.js`, which the Sheet pane mounts for each passage, the
     key terms box and the license card. Nothing new is stored beyond what
     the format already had (`blanks`, `footnotes`, `omit`, `commercial`).
   - **3i. Paper and copies.** The sheet's own address, `/sheets/` (3a); leader and
     participant copies (S4); Letter and A4 with Greek and Hebrew fonts
     (C27); printed codes (S5), which moves `qrcode-generator` from a
     build-only dependency to something the page loads (C21) and checks
     the app link files; the Word copy (S9); annotated printing (M6),
     which needs no sheet and can move earlier or later.
     **Built on the preview 2026-10-20** (decision log, "Phase 3i"):
     `/sheets/` is `src/pages/sheets.astro` and `desk/sheet-page.js`; the
     copies are drawn by `desk/sheet-copy.js` from the rules in
     `src/lib/desk-sheet-copy.mjs`, the codes by `src/lib/qr-svg.mjs`
     (shared with the app announcement's code), and the Word copy by
     `desk/sheet-word.js`. The paper is kept in `lit-sheet-paper`, named in
     /privacy. M6 is `desk/print-notes.js` with its rules in
     `src/lib/desk-print-notes.mjs`.
   - **3j. Present mode.** S6 with the reveal, M3's code on its first
     screen, then M2's presenter view on two screens.
     **Built on the preview 2026-10-20** (decision log, "Phase 3j"): the
     rules are `src/lib/desk-present.mjs` (pure, tested), the screens and
     the presenter view `desk/sheet-present.js`, drawn from the copies' own
     reading of each chapter (`presentPassage` in `desk/sheet-copy.js`).
     Nothing is stored and no key is added.
   - **3k. Getting started and sharing.** Sheets from a search or topic
     (M5), templates including the contemplative one (M9) and the blank
     canvas with full rich-text formatting (3a), and sharing by
     file and by `#` link (S8: the address cleared before the analytics
     beacon runs, confirmed in the network log; a phone or tablet is told
     to open it on a computer).
     **Built on the preview 2026-10-20** (decision log, "Phase 3k"): the
     templates are `src/lib/desk-sheet-templates.mjs`; a search's or
     topic's passages `src/lib/desk-sheet-gather.mjs` with
     `desk/search-sheet.js`, reached from /search only through the
     `lit:search-results` event and `loadDeskSheets()`; sharing
     `src/lib/desk-sheet-share.mjs` (format in STUDY-DESK-FORMAT.md,
     "Sharing a sheet"), with the shared view and the Share dialog in
     `desk/sheet-page.js` and the phone's message in
     `src/scripts/sheet-share-gate.js`. No key is added.
   - **3l. Pop the notebook out (D4).** Last, decided once /desk exists.
     **Deferred to version 2** (BVJ, 2026-10-21; the version 2 list below).
     Phase 3 is done without it.
   - **3m. A search pane** (BVJ, 2026-10-21). /desk's own header has no
     search box (decision log, "/desk's own header"), so search becomes a
     pane kind like the rest: the site's search (verses, topics, the
     glossary, articles and intros, the Greek behind its gate, and the
     notebook through `loadDeskSearch()`) in a pane, with results that
     move the active LIT pane instead of leaving the page, a Greek result
     opening its word in a Greek pane, and the usual hover previews. Its UI
     is a third module beside `searchbar.js` and `search.js`, reading
     `search-core.js` and never copying its parsing or bucketing. To
     design, with a mockup: whether it follows the passage (a "this book"
     filter, say) or stands alone; where a glossary, article or intro
     result opens; whether `/` focuses it; and whether its results can go
     onto an open Sheet pane, as /search's "make a sheet" does (M5).
     Medium. To build; not started.

   Suggested order: 3a, 3b, 3c, then 3f and 3d (both need only 3b and
   3c), then 3e, 3g, 3h, 3i, 3j, 3k, and 3l. (3g was added on 2026-10-19,
   after 3e was built, so earlier entries' 3g to 3k are now 3h to 3l.) The
   path to printable leader and participant sheets for Lent is 3b to 3i,
   with 3g; present mode and sharing can
   follow. **Not in phase 3**: S2 and N9 (2b), M11 and N6's "For
   discussion" section (after phase 3), S11, and short share links (M14,
   phase 4).
4. **Sync, with BDR.** Starts once plan A or C is chosen and, if the Zoom
   wants plan A tested, the proofs (P1 to P3, now the spikes, paused
   2026-10-09) are in. Under both plans: a sync loop on 1a's merge engine, one source
   of truth at a time (C5), connection status and "Reconnect", edits queued
   while disconnected, the conflict screen, and enforcing the full content
   security policy, since the page will hold a credential to readers' notes
   (review finding 11). Plan A adds two connectors, iCloud (CloudKit JS) and
   Google Drive, each with its own sign-in, limits and testing against real
   accounts, and perhaps a token-only Worker for Google. Plan C (or B) adds the
   service on Cloudflare, account pages on every device (C1) and account
   basics (C20). Either way: one key and then the lock (C6, D5), the
   encryption choice (C19), and short share links (M14). Sized on 2026-10-07
   ("Sizing the website's side"): 12–15 sessions under C if BDR's side
   builds the service, 16–18 under A. Large.
5. **Fixes and experience** (BVJ, 2026-10-16). The desk's bugs, and what
   using it teaches: BVJ's own experience on the preview first, later the
   trusted readers given `?desk=on` and then released readers. Its home is
   "Fixes and experience" below (IDs **E1** onward). It is numbered last
   because it is the phase that never finishes, not because it waits: a bug
   is fixed when it is found, in whichever phase's code it lives, and
   feedback that is really a feature goes to the phase it belongs to (or to
   version 2) and leaves the log with a pointer. What the phase itself
   holds is the pass over what has piled up: group the entries, find the
   patterns, and decide what a release needs fixed first. Size varies.
   **Taken into it on 2026-10-22: E9, bookmarks and ribbons become one
   feature** (BVJ). Built, it replaces B1's ribbons and B2's plain
   bookmarks with one thing, Bookmarks, and removes the Places section; it
   changes the `bookmark` and `place` record kinds, so it **touches the
   apps' sync** and BDR's Claude is told (see E9 and the 2026-10-22
   decision). Medium.

**Any time, independent of all of it**: both apps link to the license terms
(BDR's item 11: Android in 1.3, iOS in 2.0, 2.0.1 or 2.1). (/read opening
the terms when a link names them was on this list and shipped in PR #250.)
D7 is deferred indefinitely
(2026-10-11), so its public-domain part is no longer placed in phase 1c.

**Version 2: deferred and shelved** (BVJ, 2026-10-15). Nothing here is in
a phase of version 1's development. Each keeps its entry above, so it can
be revisited for version 2.

- **N2, notes that follow a word**: shelved 2026-10-15. The word pane
  proposed for 2c under D9 goes with it. Its record kind, `glossaryId`,
  is still in the format draft (see the open questions below).
- **H2 with C23, concept marks saved as a rule**: shelved 2026-10-15. Its
  record kind, `markRule`, is in the format draft too.
- **M4, a word study in one click**: shelved 2026-10-15.
- **N5, a history with a passage**: placed in version 2 (BVJ, 2026-10-15).
- **B2, bookmarks that remember why**: shelved 2026-10-15 (BVJ: "sounds like
  a note"; "maybe shelve it"). Plain bookmarks, with their optional label,
  stay as built in 1c. The `bookmark` kind's `from` field is in the format
  draft, to be decided with the other reserved kinds.
- **M10, where you already look.** Shelved 2026-10-15 (BVJ) and not in the tree. As
  built on `claude/desk-2a-m10`:
    - `/release-notes`: a "Verses in my notebook" checkbox, only with
      the preview on and only for a reader with a mark on a verse
      (`desk/release-notes-filter.js`, loaded by `desk-gate.js` on
      `[data-release-notes]`). `release-notes.js` knows nothing of the
      notebook: any `input[data-rn-flag="x"]` in its form filters on a
      row's `data-rn-x`. The notebook is read read-only
      (`desk/readonly-notebook.js`, shared with the notebook search),
      so the page never creates the database.
    - `/glossary`: "My notes on this term" under an entry, for notes on
      verses whose quoted words contain the rendering printed in a
      verse the entry lists (`src/lib/desk-term-notes.mjs`,
      `desk/term-notes.js`). Whole-verse notes don't count. The words
      come from the page's own "Where it appears" links, which carry
      `data-words` where the printed words differ from the rendering's
      label (about 1,450 attributes, for every reader).
    - Go deeper: a "Your notes here" row (`src/lib/desk-go-deeper.mjs`,
      `desk/go-deeper-notes.js`) with the reader's notes on the
      glossary entries and articles the section lists, and notes
      elsewhere citing this chapter (N4). Its look restates
      GoDeeper.astro's scoped styles in desk.css.
    - Both follow "My notes" and "Hide my notes". The reader's words
      there use a new indigo token, `--desk-mine` (desk.css), the
      first use of principle 3's colour.
    - To bring it back: cherry-pick b1c461a from the branch and
      restore the filter's
      hunks of 75795bd (`release-notes-filter.js`, `desk-gate.js`,
      `release-notes.js`, `release-notes.astro`, and
      `notebookChangeKeys` in `desk-whats-new-view.mjs`).
- **1g, an interleaf for the Greek**: shelved 2026-10-13. Its Greek pane is
  version 1 instead, in /desk's phase 3 (D9, BVJ 2026-10-15). An
  interlinear-style interleaf, with the Greek under the LIT and readers'
  own notes on it, is version 2.
- **1e, the licensed translations, D7, and the Versions tab**: deferred
  indefinitely 2026-10-11.
- **Word families**: deferred indefinitely 2026-10-13.
- **N7, the interleaf**: set aside 2026-10-13.
- **D4, pop the notebook out** (was phase 3l): deferred 2026-10-21 (BVJ),
  to be revisited for version 2. /desk's panes already cover most of its
  job.
- **The desk on large tablets and foldables**: for version 2 (BVJ,
  2026-10-28, while FA1-q fixed BA26). Version 1 stays on computers only
  (ground rule 1), with tablets kept out even in desktop site mode. BVJ
  “wouldn't be sad” if a tablet or an unfolded foldable could opt in, since
  the problem is a phone's small screen, not a portable device. The likely
  shape: gate the desk on the screen's size and the reader's choice, apart
  from `isAppPlatform`, which should keep treating tablets as tablets for
  the app QR code and the share sheet. It would need touch work and
  real-device checks, since the desk was built for a mouse.

**Still open, for BVJ:**
- **N8, the hidden passage**: undecided until the Zoom (BVJ, 2026-10-15). It
  stays in 1d until then.
- **Whether `glossaryId` (N2) and `markRule` (H2) stay in the format as
  reserved kinds**: can be decided later, when version 2 is planned. The
  format keeps kinds it doesn't know either way, so the freeze doesn't
  depend on it.

**What changed from the first order of work** (2026-10-01, PR #262):
- Phase 0's "before any code" became "freeze the format before anything
  syncs".
- Phase 1 was split into 1a to 1d, and the Greek and Hebrew fonts moved to
  phase 0's choices.
- N8 (the hidden passage) wasn't placed in any phase; it is now in 1d. D8,
  the tutorial, was added there too.
- The notebook file (D1) was split: export and import in 1d, live saving
  after T3 is decided.
- The core of N3 moved from phase 2 into phase 1.
- Phase 4 was rewritten for plans A and B. Its "keep the blur off the apps
  until they honor it" (C7) is probably moot, since both apps committed to
  honor N8 in their first synced release (R6, A-R9).

## Decisions

### The seven (asked 2026-09-30, answered 2026-10-01)

1. **Where it lives: all four options** (menus, margin, panel, commands in
   search). X11's reason doesn't rule out reader notes in the margin.
2. **Read View: highlights hidden by default**, with a Display tray switch
   stored per view like verse numbers. Study View always shows them. Places
   and scrollbar marks fit Read View; highlight ticks follow the switch.
3. **Names: Notebook, Places, Sheets.** "Specifying footnotes instead of just
   notes seems important when there are more than one kind." "Copy with
   footnotes" on computers; phones keep "Copy with notes".
4. **Phones: computers only, for now.** BVJ: "There's not a way to do this in
   the apps right now. Computer for now. App integration might come later and
   it would be good to leave it possible." Sheet addresses and the export
   format are chosen so the apps can take them on later.
5. **N8: blurred, one click to reveal**, instead of folded (BVJ: "What if
   instead of 'folded behind it' it's blurred out with an easy (single click)
   way to reveal it?").
6. **Present mode keeps the reveal; handouts can have blanks; the commercial
   check is hidden unless a sheet is marked commercial.**
7. **Plan for the apps.** "We should plan for app integration later." Since
   2026-10-01 that's the optional account (above). The W3C Web Annotation
   shape is what the website, apps and server share for marks on the text.

Also: D5 (the lock) is in as an option; accounts with no-login default.

### The audit (2026-10-01)

An audit re-read the plan end to end against itself, CLAUDE.md, BVJ's
decisions and browser behavior. It found 27 conflicts and gaps (C) and 15
missed ideas (M), and fixed 9 stale sentences in the plan. What it confirmed
works: one notebook with sync on top; "your words never look like the
translation" holds everywhere and keeps blanks inside the license; the reuse
is real; the LIT-only ideas (N2, H2, S3, S6, S10) feed each other; the
phases stand alone; existing rules are followed except where a finding says.
BVJ answered every item on 2026-10-01.

**Settle before building**
- **C1. Account pages have to work on phones.** Fix: gate the notebook, not
  the account. **Yes.**
- **C2. Read View's selection panel vs the Read View decisions.** Highlights
  would vanish as made; notes are a Study View tool. **Decided: leave out
  Highlight and Add a note by default; offer Highlight only when Read View's
  highlights are visible.** (Bookmark and Add to a sheet stay.)
- **C3. Notes can't rely on the release notes.** Fix: keep a verse copy and
  compare with quotes, dashes and spaces evened out; the release notes give
  only date and reason. **Yes.**
- **C4. Highlights are invisible to screen readers, meaning by color alone.**
  Fix: announce them, name the meaning on hover and in lists and exports, a
  second cue per color. **Yes.** (The second cue was dropped 2026-10-09:
  highlights are a tint only, named in words; "Decisions", 2026-10-09
  (highlights).)
- **C5. Two ways to sync can fight.** Fix: one source of truth at a time.
  **Yes, plus a section explaining the login options including opting out,
  and a first-time prompt to choose** (became D6).
- **C6. The lock, the file and the account need one key.** Fix: design D5's
  key once as the account's E2EE key; locked notebooks write an encrypted
  file or pause it; build D5 after the encryption decision. **Probably yes,
  pending BDR.**
- **C7. The blur doesn't exist in the apps.** Fix: keep N8's setting on the
  computer until the apps honor it. **On BDR's list.**
- **C8. The apps have to carry what they can't show.** Fix: keep unknown
  fields and kinds; colors by the apps' names. **Yes, and on BDR's list.**

**Settle along the way**
- **C9. The margin runs out of room more often.** At the largest text the
  column is ~870px, leaving ~200px a side at 1,280px; with the panel open,
  no room. Fix: decide by free space (~230px), fall back to dots and panel;
  low-vision readers lose only the placement. **Yes; and narrow the reading
  column further at launch** (BVJ: "We also recently narrowed the reading
  column but not as much as we could have.").
- **C10. Two Display settings switch off the ways in** (verse numbers hidden
  hides note dots; key terms off hides N2 and H2). Fix: routes independent of
  both, said in the settings' help text. **Yes.**
- **C11. Ctrl K bends two rules.** Fix: fold commands into the "/" search
  box. **Yes, no Ctrl K.**
- **C12. The docked panel and floating panels share the screen.** Fix: the
  dock is part of the frame. **Yes.**
- **C13. The interleaf can make the page jump.** Fix: open bands on request
  (or reserve space pre-paint); check Cloudflare's numbers after release.
  **Yes.** Built 2026-10-12 (bands open only on request, every page loads
  them closed), then the interleaf was set aside (BVJ, 2026-10-13), so the
  question is moot unless it returns.
- **C14. Read View's scrollbar marks point at notes it doesn't show.**
  **Decided: ticks for places, and highlights when switched on; none for
  notes.**
- **C15. A footnote can give away a blank.** **Decided: flag it for the
  leader, and give the leader checkboxes for which footnotes print, with
  Select all and Unselect all, still flagging spoilers.**
- **C16. Anchors must read the text the way Copy does.** **Yes.**
- **C17. Editing the file elsewhere must never erase notes.** **Yes.**
- **C18. Safari readers without an account are the most exposed.** Fix: say
  so plainly, remind them to save a copy, offer an account once it exists.
  **Yes; BDR is also considering a Mac app.** Built on the preview
  2026-10-12 as a plain line in the panel's foot for desktop Safari, with
  the reminder to save a copy; the offer of an account waits for accounts.
- **C19. End-to-end encryption rules out some server features** (M15's
  personal emails, M14 without a key). Both can still work: the key after
  the # for share links. **TBD with BDR, leaning end-to-end.**
- **C20. Account basics the plan didn't list.** **Yes.**
- **C21. New pages and services need the usual plumbing.** **Yes.**
- **C22. Web Annotation fits marks on the text, not sheets or places.** Fix:
  Web Annotation for marks, a small versioned LIT format for sheets and
  places. **Yes.**
- **C23. Concept marks should be saved as a rule.** **Yes.**
- **C24. Notes must stay out of the scripture's reading order.** **Yes.**

**Small**
- **C25. Ribbons need a rule for when they move.** **Yes** (see B1). Built
  2026-10-12 (a flag set by following the ribbon's link; "Order of work",
  1d).
- **C26. Rename the footnote copy in both panels.** **Yes**; update CLAUDE.md
  when it ships.
- **C27. Greek, Hebrew and A4 paper.** **Yes, plus download Greek and Hebrew
  fonts to the site** (and get the site ready for the Greek-text project).

**Missed ideas**: M1 to M12 and M14 accepted (all listed under "The ideas"
with their M numbers). **M13 (website accounts first)**: "Probably. TBD with
BDR." **M15 (an email when your verses change)**: declined. Note on M4 and
M8: BVJ is considering renaming the site's "topics" to "tags" (see below),
which affects M8's name.

### 2026-10-02 (netbible.org round)

BVJ pointed out netbible.org was missing from the survey. Decisions:
- **N10**: good for a single verse at a time.
- **S11**: maybe a later project, not part of the initial launch; in FIXLIST.
- **D7**: consider API.bible for side by side inside the desk; picks NASB
  2020, CSB, NIV; the KJV yes, maybe others; NRSVue and CEB aren't on
  API.bible (licensing them directly is open).
- **LIT previews on other websites** (netbible.org's "Bible Drawer", which
  needs a different name): a separate project, in FIXLIST.
- **Reading plans**: anticipated, on both the website and the apps (the apps
  are more natural for it); a separate project, in FIXLIST.
- Commentaries: set aside.

### 2026-10-05 (development phases)

BVJ asked whether work could start before the apps' second round, and for the
development phases to be planned. Approved the same day:
- **Freeze the format before anything syncs**, in place of "agree the record
  format before any code". Building starts now.
- **The phases in "Order of work"**, with phase 1 in four steps (1a to 1d)
  and N8 placed in 1d.
- **D8, a tutorial on first use that can be replayed**, added as BVJ's hope.
  Its details are open (see D8).

### 2026-10-05 (phase 0 picks)

BVJ picked both from the phase 0 comparison page (see "Where things stand").

**The reading column: `--reading-measure` 52**, down from 60, set when the
desk launches (C9). Measured on the real Romans 8 page in headless Chrome,
counting the middle full line, with verse numbers and footnote letters left
out:

| Measure | Inter | Atkinson | OpenDyslexic | Column at Medium (Inter) |
|---|---|---|---|---|
| 60 (before) | 78 | 86 | 39 | 681px |
| 56 | 72 | 79 | 36 | 636px |
| 54 | 69 | 78 | 35 | 613px |
| **52** | **67** | **74** | **34** | **590px** |
| 50 | 64 | 71 | 32 | 568px |
| 48 | 61 | 68 | 31 | 545px |

- 52 puts Inter and Atkinson inside the 45–75 characters a line that
  typographers aim for; 60 ran past it in both.
- **The margin fits better than C9 assumed.** With the Notebook panel
  closed, a note's 230px fits beside the text at 52 in every window from
  1280px up, Extra large text included (255px free at 1280 and Extra large,
  where 60 left 197px).
- **The open panel is the tight case.** Assuming a 340px panel (its width
  isn't designed), at 52 the margin works from windows of about 1400px at
  Medium; 48 would be needed to keep it in 1366px laptops. Otherwise notes
  fall back to dots and the panel's list, as C9 already planned.
- **OpenDyslexic narrows too**, from 39 characters to 34. It was offered to
  stay at 60 through one CSS rule; BVJ picked 52 without that exception.

**Greek and Hebrew: Cardo**, for serif text and print and the later Greek
text. The rest of the plan from the same page goes with it:
- **Inside the site's sans-serif text, Greek comes from Inter itself.**
  `@fontsource/inter`, already installed, ships Greek and polytonic Greek
  subsets; the site loaded only its Latin. Atkinson and OpenDyslexic, which
  have no Greek, take Inter's.
- **Hebrew inside sans-serif text comes from Noto Sans Hebrew**, since no
  site font has Hebrew.
- **Crimson Text and Fraunces take Cardo's Greek and Hebrew.** Crimson Text
  is the print face and has neither.
- Each loads only on a page containing those letters: registered under the
  existing family names with `unicode-range`, the way the ⟦ ⟧ patch is.
  Shipped ahead of the desk in PR #270 (`src/styles/greek-hebrew-fonts.css`),
  which also fixed the ⟦ ⟧ patch for Atkinson readers.
- Gentium Plus with a Hebrew face was the alternative. Ezra SIL wasn't
  compared, as Google Fonts doesn't carry it.

### 2026-10-05 (phase 1a scope)

BVJ asked to start phase 1a, then asked what the risks were. The largest was
building format decisions ahead of the apps' review of draft 1: the merge
rules, the trash record's fields, how a conflicting note is kept, and the
overlap rule (still open as A-M5, and iOS's rule differs). **BVJ's call: build
the record kinds, the browser half of the anchor text, and the wording
comparison now; hold the merge engine and the overlap rule for BDR to weigh
in on soon.** The questions are talk-through item 20.

### 2026-10-05 (phase 1b)

BVJ asked for phase 1b and made three choices before it was built:
- **Deleting: build it now, on the website's proposed trash fields, marked
  provisional**, rather than wait for BDR. Nothing leaves the browser yet and
  only the preview writes records, so a different answer from BDR costs one
  migration.
- **The preview switch is a link** (`?desk=on`, `?desk=off`), stored in that
  browser. Readers see nothing.
- **The 52 measure applies only while the preview is on.** Readers keep 60
  until the desk is released.

And one while it was being checked:
- **The header button carries its name, "Notebook", beside the glyph**, to
  make the new tool easier to find. "Study Desk" was weighed and left as the
  project's name: the button opens the Notebook panel, and Notebook is the
  name decided on 2026-10-01 (decision 3). Read View's toolbar keeps the
  glyph alone, like its Display button, since that bar is already at its
  widest.

### 2026-10-06 (the panel's place)

BVJ, after trying the merged preview: "The notebook should fill the margin,
not just push everything aside." The panel had docked on the right with the
whole page, header included, moving left to make room. It now sits in the
right margin beside the text, and nothing moves where the margin is wide
enough. Where it isn't, the text moves only as far as it must and the header
never moves; a page with no reading column makes room for it (see "Order of
work", 1b, for the measurements). That also retired the 1360px docking floor
and the pre-paint reservation the first build needed.

The rest of the same day's review:
- **The panel appears only on pages with a reading column**: Study View
  chapters and intros, Read View, articles, and the glossary. Elsewhere
  (the home page, the articles list, /search) there is no Notebook button
  either.
- **The panel reaches down to 16px above the bottom of the window**, the
  same gap it keeps from the right edge, and pins 16px from the top.
- **At the end of the page it stops 16px above the seam where the page's
  background meets the footer's colour.** A license band right above the
  footer counts as footer, so on Study View, intros and Read View the seam
  is the top of the source-text notice. On the glossary it is the end of the
  cream band. On an article it stops exactly at the bottom of the card.
  (The first version stopped at the footer element, below the license band.)
- **Its "Notebook" heading lines up with the page's own heading**, by the
  tops of their capitals: the chapter title ("Romans 8"), Read View's book
  title, and on the glossary the first entry's heading.
- **On an article, the panel's top edge lines up with the card's top
  edge** instead. Matched to the title, which sits below the article's
  picture, the panel started below the fold, so opening it moved the card
  with no panel in sight. Top to top, the two cards sit side by side. Where
  the margin is too narrow, only the card moves; the search bar above it
  stays put.
- **The glossary gets a reading column with the desk on**, at the reading
  width and with the scripture pages' type sizes: the title as Study View's
  chapter title, each entry's heading as Read View's chapter headings, the
  text at 18px with a 1.75 line height, all moving with the Display tray's
  text size. Like the 52 measure, readers keep the old layout until the desk
  is released.
- **Notes on glossary entries and articles**, website only unless BDR
  changes the apps: idea N11.
- **Where the margin is too narrow for the 280px panel, the text column
  moves; the panel doesn't shrink** (a 220px minimum was tried and BVJ
  chose the 280px panel). Only the column moves: never the header, the tool
  row, the license band or the glossary's cream band. **On the glossary only
  the entries move; the hero stays centred**, since the panel starts level
  with the first entry. The glossary's column box matches Study View's
  exactly (the 52 measure plus 16px a side), so the two pages behave alike.
- **Raised, not decided: margin notes while the Notebook panel is open.**
  Decided 2026-10-07 (below).

### 2026-10-07 (the margin, and colour meanings)

- **A narrow window gets a floating notebook** (a change to 1b, built the
  same day). Where the panel would start covering the text, it becomes a
  floating window the reader can expand and collapse, instead of lying over
  the ends of the lines. See "Order of work", 1b, for how it was built, and
  "Still open" for the details that are recommendations.
- **The margin is the reader's choice.** A switch with three settings:
  notes shown, notes as dots, notes hidden (the wording can change). The
  left margin shows a note beside its verse; the Notebook panel on the right
  lists them; both can show at once. **Each note in the panel takes the
  reader to its place on the page.** Placement 2 and phase 1c follow this.
  The same day BVJ cut the switch to two settings and settled its details
  (next section).
- **Colour meanings (H1's legend) are dropped**, everywhere. BVJ agreed with
  BDR's lean (Zoom item 6), so this is settled for all three. Highlights
  keep their four colours, stored by the apps' names (C8), each with a
  second visual cue (C4; dropped 2026-10-09, a tint only). Screen readers announce the colour ("highlighted
  yellow"). Lists and exports group by colour. Read View's highlights stay
  off by default. The format drops the `legend` kind.

### 2026-10-07 (the margin switch)

BVJ went through the five recommendations for the switch and settled them,
changing three, then settled the details that followed (1, 6, 8, 11 to
15):
1. **Two settings, not three: notes shown or hidden**, as a box labelled
   **"My notes"** in the "Show" group. The label has to tell the reader's
   notes apart from the translation's footnotes, which sit beside it as
   "Footnote letters"; it matches M1's "Hide my notes". Dots stop being a
   setting and become what "shown" turns into where there isn't room.
2. **The switch is in two places, both full toggles**: the Display tray's
   "Show" group (beside verse numbers, footnote letters and key terms), and
   the Notebook panel itself, not a link from one to the other. They are
   one setting, so changing either moves both. It shows wherever notes can
   (Study View, articles, the glossary), and not in Read View (10).
3. **Shown by default.** Where there isn't the ~230px a note needs (C9),
   whatever the setting, each note becomes its marker glyph in a small
   circle (below).
4. **A note sits level with the first word it was made on**, not the start
   of its verse. A note in the apps can hang off a single word chosen by
   selection, so a verse can carry several, each in its own place.
5. **The marker glyph leads every note.** The apps' seven markers (note,
   emphasis, question, heart, bookmark, lightbulb, flame; W3), chosen by the
   reader for each note as in the apps, stand like a bullet point in front
   of a note shown in full, and alone in a circle where there isn't room.
   Notes are many per verse and each keeps its own marker, as in the apps,
   which syncing with them needs anyway.
6. **A circle lifts slightly on hover**, the usual small raise, and **a
   click opens the note the way a footnote opens** (the shared panel). A
   reader whose system asks for reduced motion gets a colour change instead
   of the movement.
7. **Going to a note from the panel: as recommended.** The page scrolls the
   note's place into view and briefly marks it in the margin; a circle
   opens its note; with notes hidden the words are marked instead; focus
   lands on the note. BVJ notes it matters less than it sounds, since a
   reader who picked the note in the panel can already read it there.
8. **M1 stays separate, and the most recent action wins.** M1 hides every
   note, highlight and mark at once; turning notes on while M1 is on brings
   the notes back, and only the notes (highlights and marks stay hidden);
   turning M1 on after that hides them again.
9. **Notes on articles and glossary entries (N11) use the same margin and
   the same switch.**
10. **Read View shows no notes.** It is for reading straight through, so
    the switch doesn't appear there and nothing a reader has written shows
    in its margin.
11. **Notes that would collide sit in a row, or stack.** Each circle sits
    level with its note's first word. Only where two circles would overlap
    does the later one go beside the earlier, while the margin has room,
    and past that it stacks below (revised the same day; it first grouped
    circles on neighbouring lines whether or not they overlapped).
    A note shown in full may run longer than the text it is attached to,
    and nothing changes for that alone. Only when it would run into the
    note below is it collapsed, by default, cut off where the next note
    begins; hovering or clicking expands it over the note below.
    **Revised 2026-10-13 (BVJ): a note in full shows three lines at most**
    until it is hovered, focused or clicked, even with nothing below it,
    and is cut sooner where the next note begins (`NOTE_LINES` in
    `src/lib/desk-notes.mjs`).
12. **The Notebook panel's list leads each note with its glyph too**, so a
    note looks the same in both places, and **each note is collapsed to two
    lines by default**, expanding on hover or click as in the margin. A
    toggle in the notebook lets the reader change that default to notes
    shown in full.
13. **Expanding or collapsing a note lasts for the visit to that page**,
    note by note, so several can be open at once (or several closed, for a
    reader whose default is notes in full). It applies in the margin and in
    the panel, and isn't remembered once the reader leaves the page.
14. **A cut-off note fades out** at its last line, so it never reads as a
    complete note.
15. **The keyboard matches the mouse.** Focus on a collapsed note expands
    it while it has focus, as hover does; Enter or Space toggles it and it
    stays that way, as a click does.

### 2026-10-07 (the margin notes' look)

Picked from a comparison page (Margin Note Fonts,
https://claude.ai/artifact/67HABptGCssM8NcMDBuws9, private), which also
tried out the behaviour above:
1. **Margin notes are set in Playpen Sans by default**, a handwriting face
   designed for legibility (TypeTogether, SIL OFL), and **the reader can
   switch them to Inter.** Shantell Sans was the runner-up; Patrick Hand and
   Kalam were set aside. Playpen Sans has Greek letters of its own, which
   word-study notes need; Hebrew falls through to the site's existing rule
   (Noto Sans Hebrew under Inter), so its stack ends in Inter.
2. **It applies only in the margin and only under the Default font.** A
   reader who chose Atkinson Hyperlegible or OpenDyslexic sees notes in
   that font. **The Notebook panel keeps its own font**, the same as
   everything else in it (BVJ: a note in the panel matches the panel, not
   the margin).
3. **Every note lifts on hover, focus or click**, onto the raised surface
   with a shadow, whether or not it was cut off.
4. **The words a note hangs on are lit while the note is hovered, focused,
   kept open, or open from its circle**, in a neutral tint that can't be
   mistaken for one of the four highlight colours. Several open notes light
   several passages.
5. **A note opened from its circle opens above or below** according to its
   place on the screen, and never over the words it hangs on.
6. **The font file loads only when it is used**: the desk on, the page
   holding notes, and the reader on the handwriting setting.
7. **The Playpen Sans / Inter choice sits beside the "My notes" switch**,
   in both the Display tray and the Notebook panel, worded "Handwriting /
   Plain" (BVJ, 2026-10-07, taking the recommendation).
8. **No dotted underline under noted words on the website** (BVJ,
   2026-10-07). The apps underline them because their glyphs are subtle and
   notes open only on a tap; here the note sits beside its line and lights
   its words, and a second dotted underline would collide with the term
   lens's. The noted words still need a route a screen reader hears (C24),
   which 9 provides.
9. **A note begins with the words it hangs on, for screen readers only**
   (BVJ, 2026-10-07): "My note on ‘nothing is now a verdict’, Romans 8:1",
   then the note, with the quoted words hidden from view. A long selection
   is shortened to its first ten words or so and "…". The words come from
   the record's own quote, so nothing new is stored. Nothing hidden goes
   inside the scripture itself: Copy text, the handout and the desk's
   anchor reader all read the verse's text off the page.

### 2026-10-08 (the Greek tab)

BVJ asked whether the desk could show the SBLGNT beside the LIT, with
parsing and lexical information from openly licensed sources. None of it
needs the alignment's phase 2 (see "Ready for the Greek text"): parsing and
lemmas already exist for every SBLGNT word. Only the word-to-word link waits.

**Decided (BVJ):**
1. **Tabs in the Notebook panel**: "My Notes" (BVJ, later the same day;
   it holds bookmarks and highlights too), "This verse" (N10), then Greek
   and Versions (item 12). No Commentary tab
   (item 10). BVJ's idea, preferred over a Greek column of its own
   beside the LIT, which would have put three columns side by side.
2. **The Greek tab lines up with the LIT paragraph by paragraph and follows
   the page as it scrolls, and the reader can also scroll it on its own.**
   **Revised later the same day (BVJ):** the versions, the Greek included,
   needn't line up with the LIT. Each is shown in its own paragraphs and
   scrolls on its own, without following the LIT.
3. **Computer only**, like the rest of the desk. Tablets and foldables were
   considered and left out.
4. **MorphGNT supplies the lemmas and parsing** (CC BY-SA 3.0) wherever it
   has the text. What the LIT prints and MorphGNT lacks is borrowed and
   credited separately. In published chapters that is two passages
   (checked 2026-10-08; check again when Acts and Revelation publish):
   - **John 7:53–8:11.** SBL added it to the SBLGNT text in its version 1.2
     data (2023-07-10), in double brackets, so the Greek is the SBLGNT's own;
     MorphGNT is older. The parsing comes from MACULA Greek (CC BY 4.0),
     whose SBLGNT edition is built on that release.
   - **Romans 16:25–27.** Still not in the SBLGNT text, but its apparatus
     note at 16:24 prints the Greek, as the reading of Westcott–Hort,
     Tregelles and NA28. The parsing comes from MACULA's Nestle 1904
     edition, matched word by word; a word that doesn't match gets none.
5. **Two lexicons, one shown at a time, the reader's choice**: the UBS
   Dictionary of the Greek New Testament (a revised Louw–Nida; CC BY-SA 4.0)
   and STEPBible's brief lexicon (TBESG, mostly a corrected Abbott-Smith;
   CC BY 4.0). Under STEPBible, the full Liddell–Scott–Jones entry (TFLSJ,
   CC BY 4.0) is a button that is always visible, so it is plain that LSJ is
   there. (**Since 2026-10-13 a heading with the entry always shown**, BVJ;
   see that date.)
6. **Differences between a lexicon and the LIT are expected**, and the
   LIT's footnotes give the reasoning.
7. **The SBLGNT's apparatus is shown, or its text-critical signs are
   hidden.** Shown: at the end of the Greek tab, below the text, and each
   sign in the text opens its note. (It was to arrive beside the LIT's
   footnotes while the tab followed the page, which item 2's revision
   dropped.) SBL publishes it with the text, under the
   same CC BY 4.0, comparing Westcott–Hort, Tregelles, NA28 and
   Robinson–Pierpont.
8. **N10 "This verse" stays**, and gains the verse's Greek beside its
   footnotes, the reader's notes and other translations of it.
9. **The other versions are in the desk's first release** (**reversed 2026-10-11: deferred indefinitely**; BVJ, later the
   same day), one at a time: the KJV, the Open English Bible and the World
   English Bible stored on the site, and the CSB, NASB 2020 and NIV through
   API.bible as D7 describes. The NRSVue and CEB are shelved for a possible
   second version.
10. **Commentaries**: the public-domain ones aren't worth including, and the
    Tyndale Open Study Notes (CC BY-SA 4.0) were looked at and skipped: they
    are keyed to the NLT's wording, and on Romans 1:26–27 and 1 Timothy 2
    they argue against the LIT's own notes. The one kind wanted, a
    scholarly, noncommercially licensed commentary on the whole New
    Testament from a liberationist perspective, doesn't exist under an open
    license (the search is below), so **there is no Commentary tab**.
11. **The reading column is 48 on Study View chapters while the notebook is
    open, and 52 when it is closed.** The glossary and articles stay at 52
    always, and so do intros and Read View (BVJ confirmed both the same day:
    neither gets the Greek or the versions). Measured on
    Romans 8 at the default size, with nothing moving: the open panel gets
    384px in a 1440px window, 347px at 1366 and 304px at 1280. Moving the
    column left stays acceptable where it's needed, but is to be avoided
    where reasonably possible. Opening or closing the notebook reflows the
    text there, so both keep the line being read in place; a page that
    opens with the notebook open is set at 48 before it first paints.

12. **The tabs are My Notes · This verse · Greek · Versions** (**Versions deferred indefinitely, BVJ, 2026-10-11**; BVJ, later
    the same day), the second of three arrangements tried on the comparison
    page "Notebook tab widths"
    (https://claude.ai/artifact/Rf3qCLH6Rr25NAtgadxKs4, private). The
    Versions picker lists the English versions; the Greek has its own tab.
    **No Parallel tab or setting**: "This verse" already shows the verse in
    every version.
13. **The panel starts with the margin it gets, and the reader can drag the
    widths of the three columns**: their notes, the LIT and the notebook
    (BVJ, later the same day). The fixed 380px minimum (A), which moved the
    column in windows under about 1440px, was set aside. **Nothing shows
    between the columns at rest** (BVJ: a line there distracts): the pointer
    in the gap gets the resize cursor and a small grip beside it, and a faint
    hairline appears only while dragging. **The widths last for the visit**
    (BVJ, the same day): kept in `sessionStorage`, so every page and reload
    in that tab keeps them, and closing the tab returns the next visit to
    the defaults. A link opened in a new tab starts with the defaults; a
    browser restoring its tabs after a restart usually restores them too.
    The site already counts a visit this way (`lit_pv`).

**Recommended, not decided:**
- **The draggable widths' details** (item 13), as built on the comparison
  page, and **built that way on the preview 2026-10-08** ("Order of work",
  1c) for BVJ to judge:
  - **Two handles**, each trading width between its two neighbours: one
    between the notes margin and the LIT, one between the LIT and the
    notebook. Each is a focusable separator the arrow keys move too (the
    ARIA window-splitter pattern), so it isn't mouse-only.
  - **Kept as the LIT's measure and the notebook's width**, for the visit
    (item 13), with the notes margin taking what's left. The measure stays in
    the site's character unit, so a text-size or font change keeps the
    line's length. The LIT stays between 36 and 72 (about 46 to 92 letters a
    line in Inter), and the notebook at least 280px.
  - **A narrower window keeps them as far as it can**: the notes margin gives
    way first (notes become circles under about 230px), then the notebook
    down to 280px, then the LIT down to 36, then the floating notebook.
  - **Stamped before first paint**, like the 48 today (the pre-paint script
    reads `sessionStorage` as readily as `localStorage`), so a page never
    jumps on load; dragging keeps the line being read in place.
  - **"Reset widths"** in the panel's settings and the Display tray, and the
    first-use tutorial (D8) shows where the handles are, since nothing shows
    them at rest.
  - **Study View only, with the notebook open.** Closed, the page goes back
    to the centred 52. Read View, intros, articles and the glossary keep
    their fixed widths.
- **SBL's own files are the text of record.** MorphGNT and MACULA supply
  only parsing, and the build checks that their words match SBL's.
- **Pairing and following** (each LIT paragraph paired with the Greek
  verses that start in it, the tab moving with the page): **superseded the
  same day** by item 2's revision. Instead: each version in its own
  paragraphs, opening at the verse being read, with a "Go to verse 18"
  button to catch up.
- **Word details dock at the foot of the tab**, with the lexicon switch,
  instead of opening in the floating panel the term lens uses (which "Ready
  for the Greek text" had assumed). UBS's references give word positions, so
  its entry can open on the sense UBS assigns at that word; the build matches
  them by lemma and occurrence, since UBS numbers words in its own text.
- **The Greek tab wants about 380px.** One minimum for every tab means
  switching tabs never moves the text, like the floating notebook's rule
  (2026-10-07); a minimum per tab moves the text less often overall. Leaning
  to one.
- **"This verse" as a tab of its own**, since it draws on all the others.
- **Licenses**: files built from MorphGNT or UBS go out under CC BY-SA 4.0
  (MorphGNT's 3.0 allows a later version); STEPBible's stay CC BY. Nothing
  from the LIT goes into a share-alike file: the glossary link and "rendered
  here as…" stay in the page's own data, as the term lens's does.

**Found along the way:**
- **SBLGNT 1.2 prints John 7:53–8:11**, so the LIT's footnotes there
  (john-7 fn-ff and john-8 fn-k: "does not include this section") and
  CLAUDE.md's SBLGNT table described the 2010 edition. SBL's apparatus at 7:52
  still lists the passage as a Robinson–Pierpont addition. The Greek tab
  would have shown it as SBLGNT text beside a note saying the SBLGNT lacks
  it. **The footnotes were reworded 2026-10-11** (see "Decisions"). CLAUDE.md's
  SBLGNT table had already been updated to name both editions (checked
  2026-10-13).
- **MorphGNT's README still says the SBLGNT text is under its old EULA**, and
  CLAUDE.md's MorphGNT paragraph repeated it (corrected 2026-10-13, with 1f). SBL's own release has been
  CC BY 4.0 since version 1.1 (2022-12-19).
- **MACULA's SBLGNT edition is carried over from its Nestle 1904 edition**,
  with some glosses and semantic domains still missing, and its domain fields
  are "used with permission" only. That is why it supplies only the two
  borrowed passages.
- **The commentary search** (2026-10-08) found no whole-NT liberationist
  commentary under any open license. Nearest: single studies under
  CC BY-NC-ND (Brill's open-access default; Globethics theses such as
  Sintado's ecojustice readings of Mark, Romans and Revelation). RIBLA is
  free to read in places but not licensed for reuse; SBL Press's
  International Voices in Biblical Studies is open access with its license
  unstated; freentcommentaries.org is Reformed evangelical and AI-drafted.
  *HTS Teologiese Studies* publishes contextual readings under CC BY 4.0, one
  article at a time. Other routes: links per chapter (no license needed),
  asking a publisher or author for permission, or the Collective's own
  writing.

### 2026-10-09 (BDR's proposal, drafts 3 to 4d)

BVJ read what BDR's proposal had added since draft 2 (summarized under "BDR's
answers and requests (2026-10-09)") and answered six questions:
1. **A note edited on two devices: go with BDR.** The newer writing wins and
   the older version is discarded (the Zoom's item 15). With BDR's answers
   to rules a to e the same day, the merge rules are settled; the website's
   "keep both" plan and its `conflictOf` copy are dropped.
2. **Pinned footnotes: agreed, by November, as part of phase 1c.**
3. **The encryption spec: agreed.** BDR's Claude drafts it and its test
   vectors as a pull request here (the Zoom's item 14). **BDR's scope in the
   repo is widened.** In BVJ's words, there is no danger in anything BDR does
   in the repo, since nothing can merge without review and approval. So his
   Claude works freely on /apps, /privacy, encryption and app syncing, and
   elsewhere asks BDR "are you sure?" before going ahead, without barring
   him. `BDR-ONBOARDING.md` carries the rule.
4. **Whether plan A is tested at all** (the paused spikes): **on the Zoom's
   agenda.**
5. **The apps' launch sheet: agreed.** Sync is announced once in What's New
   and kept out of the onboarding tour.
6. **Naming: the names differ on purpose and stay** (the Zoom's item 16).
   The Notebook holds more than the reader's notes: its **My Notes** tab is
   the apps' My Notes, and its other tabs (This verse, Greek) are
   things the apps don't do. **"Study Desk" is the project's name**, never
   shown to readers, and is larger than the Notebook: it also covers the
   margin notes, the menus' actions, sync and encryption.

### 2026-10-09 (highlights)

- **Highlights are a tint and nothing else** (BVJ, after seeing three
  mocks on Romans 8: "I appreciate trying to be sensitive to color
  blindness. I think it's just too much."). This drops C4's second visual
  cue, which until then had been "yes". The first build gave each colour its
  own underline (solid, double, dashed, wavy); BVJ pointed out that any
  underline meets the term lens's dotted one under a key term. The two other
  ways tried were an overline, which crowded the line above, and a patterned
  bar in the margin beside the highlighted lines. What stays from C4: every
  highlight is named in words wherever a reader can ask (the verse number,
  This verse, My Notes), and the colour buttons are named for screen
  readers. The apps' highlights are colour only too.

### 2026-10-10 (the change notice)

- **The change notice's defaults are approved** (BVJ, the day it was built
  on the preview; "Order of work", 1c, "Built fifth"): its wording in the
  apps' two registers; a change of typography alone raising no notice, with
  the marked words deciding rather than the rest of the verse; a note on
  whole verses noticing when their wording changes; a flag in the margin for
  a highlight, with its two-arrow glyph; the card's layout, Keep leading;
  Show in the text taking a highlight to its `#v3` address; Keep from the
  whole-verse fallback dropping a note's quote, with "Mark the new words"
  left for later; Keep not merging a kept highlight with its neighbours;
  and notices judged only for chapters on the page.
- The format's side of it (no notice for typography alone, the notice on
  whole-verse notes, what Keep writes) stays a **proposal for draft 2**:
  the apps still have to agree it (`STUDY-DESK-FORMAT.md`, "Finding a mark
  again").

### 2026-10-11 (other versions deferred)

- **API.bible, and the whole idea of a tab showing other versions, are put
  off indefinitely** (BVJ). **None of it is in version 1 of the Study Desk.**
  This replaces 2026-10-08's decisions that the other translations are in the
  first release (items 9 and 12 of "the Greek tab", and D7).
- **What goes out of version 1:** the Versions tab; the versions in "This
  verse"; 1e (the Worker, the key, the tracking script, the copyright
  notices); and the stored KJV, OEB and WEB with their numbering maps, which
  only fed that tab (recorded as out with it, since the decision was about
  the tab and the idea behind it; BVJ to say if the stored public-domain
  versions should come back on their own).
- **The tabs are My Notes · This verse · Greek.** Greek (1f) stays in the
  first release. The 48-wide column with the notebook open stays as decided,
  since the Greek tab still needs the room.
- **What stays on file, unbuilt:** D7's survey and API.bible's terms as read
  on 2026-10-02 and 2026-10-08, so the work isn't repeated if the idea
  returns. Nothing was built for it, so no code is removed.
- **Closed by this:** talk-through item 21 (API.bible's terms) and the
  "Still open" D7 items. The privacy page needs no FUMS paragraph, and
  DISASTER-RECOVERY.md gets no new Worker. The question of linking out to a
  verse elsewhere (D7's fallback) is also left aside for version 1.

### 2026-10-11 (the John 7:53–8:11 footnotes)

- **The footnotes now say the SBLGNT added the passage** (BVJ's wording;
  john-7 fn-ff and john-8 fn-k, kept byte-identical). The sentence that said
  the SBL Greek New Testament "does not include this section" now reads: "The
  SBL Greek New Testament, the source text for this translation, originally
  did not include this section, but it was later included in the 2023
  edition." Nothing else in either note changed. This clears the "before it
  ships" item for the Greek tab (1d, 1f): the tab can show the passage as
  SBLGNT text beside a note that no longer says it lacks it.
- **Still to do outside this change:** the same edit in the Word master,
  where the wording is authored (the repo is not the origin of the
  translation; `FOLLOW-UP-RECONCILIATION.md`'s back-port list), or the next
  restore from the master will bring the old sentence back. (CLAUDE.md's
  SBLGNT table, listed here too, already named both editions; checked
  2026-10-13.)
- The footnotes are in the text of published chapters, so this reaches the
  apps' "Translation Updates" feed and moves the API content version like
  any wording change. A reader's mark on those notes' words, if the desk
  ever pins footnotes, would see it as a change.

### 2026-10-12 (phases 1a and 1c finished)

BVJ asked for 1a and 1c to be finished, with a recommendation on the one
question BDR's answers left open, gone ahead with and noted here in case BDR
wants it changed.
- **Two trash records of one deletion: the later deletion, with the newer
  content.** The website's first proposal (2026-10-05) kept the earliest
  deletion; rule b, answered since, made that wrong, since an edit between
  the two deletions would bring back a record the reader deleted after
  editing it. Built in `src/lib/desk-merge.mjs`; **for BDR to confirm or
  change** ("Still open").
- **The merge engine** (1a) and **pinned footnotes** (1c) are built; see
  "Order of work". That leaves 1d and 1f in phase 1.

### 2026-10-12 (phase 1d)

Phase 1d was built the same day ("Order of work", 1d). One decision from BVJ:
- **N8, the hidden passage, is held until after the Zoom** (item 17 on the
  Zoom's list). BVJ: "I'm not 100% sure about the hidden passage feature",
  then "Hold it, revisit after the Zoom." It was built and kept out of the
  1d change, on `claude/desk-1d-hidden` (commit 0c95d7d) and
  `claude/desk-1d-search` (commit a933c55). Nothing about it ships, and the
  help page and privacy paragraph don't mention it. The 2026-10-01 decision
  (blur, one click to show) stands as the design if it goes ahead.
- Saving live into a chosen file (D1) still waits on T3, as planned.
- Everything else 1d chose where nothing was decided is a recommendation,
  listed under "Order of work", 1d, and "Still open".

### 2026-10-13 (the interleaf set aside)

BVJ, after trying the preview: "I think I'm not sold on the interleaf
feature. It seems redundant to the notes in the notebook and in the left
margin and breaks up the scripture text."
- **N7, the interleaf, is out of this release.** It was built the day
  before (C13's "open on request" rule included). Commit aacdc92 reverts the
  merge of its code and drops the help page's section on it; the code stays
  on `claude/desk-1d-hidden` (commit 1f27b2e). To bring it back, revert
  aacdc92; merging the branch again would do nothing.
- Its one argument the margin doesn't cover was windows too narrow for the
  margin, where the notebook floats. That is an observation, not a
  recommendation.
- **N8's branch is affected.** `claude/desk-1d-hidden` (0c95d7d) sits on top
  of the interleaf commit and edits `interleaf.js`, so reviving N8 means
  rebasing it onto main without 1f27b2e, or reviving N7 too.

### 2026-10-13 (the Greek tab built; 1g and 1h)

- **1f was built** ("Order of work", 1f, "Built"), so phase 1 is done
  apart from N8's hold, and the release question is open.
- **The full LSJ entry is a heading that always shows, not a button**
  (BVJ, after trying the preview): under STEPBible, the brief entry, then
  "Full LSJ entry" as a heading with the entry under it. This refines item
  5 of 2026-10-08, which had it as an always-visible button.
- **1g, an interleaf for the Greek**, and **1h, searching the Greek**, were
  added as ideas to explore (BVJ). BVJ asked that 1g not be brainstormed
  yet. 1h was kept apart from 1f rather than added to it, because it needs
  a corpus-wide index and a place in search of its own.

### 2026-10-13 (1h: English and Greek apart; the glossary bridge)

- **One query never gets both English and Greek results** (BVJ, after
  trying /search, where the Greek sat under the English pager and vanished
  on page 2). Greek letters or a Strong's number give the Greek alone; any
  other query gives exactly the search as it was before 1h; and the type
  menu gains "Greek" (option b of three), so a transliteration or an
  English gloss is searched in the Greek when the reader asks. The Greek
  takes the same numbered pager as the English verses. This replaces the
  tray rule for Latin queries (2026-10-13, "1h's open details"): the tray
  no longer shows Greek for an English query unless "Greek" is picked.
  Greek queries also lost the three-letter minimum, for ὁ and ἐν.
- **The glossary bridge** (BVJ: build it, and widen it once alignment
  phase 2 covers the NT): under "Greek", the LIT's own renderings of the 47
  glossary terms reach their Greek first ("justness" → δικαιοσύνη,
  "self-preservation" → σάρξ), showing only the verses the LIT renders that
  way. Gated as /glossary is, kept out of `public/greek/` (it is LIT
  content), built with the site (`build:greek-bridge`). Verse-level for
  now: a verse counts if the LIT renders the term there.

### 2026-10-13 (1h built)

- **1h was built** ("Order of work", 1h, "Built").
- **A word's form, lemma and Strong's number start a search** (BVJ, while
  1h was being built: "on right-click or by clicking"). Built as plain
  clicks, since a right-click menu is out of reach for keyboard and
  screen-reader users.

### 2026-10-13 (1g shelved; 1h planned)

After exploring both (the findings are under "Order of work", 1g and 1h):

- **1g, the interleaf for the Greek, is shelved for the future.** What the
  exploring found is kept with it.
- **1h follows the recommendations**: search by Greek script with or
  without accents (any form of the word), by Strong's number, by
  transliteration, and by an English lexicon gloss. **agreuō and agreuo
  return the same results**: macrons and other marks are ignored.
- **The main search bar searches the Greek, and the Greek results show for
  every reader.** **Clicking one opens the Notebook to the Greek tab** at
  that word.
- **None of it is visible before the public launch**: until the Notebook is
  released, readers without the preview see no sign of the Greek search.
- **A second search field in the Greek tab is fine** if there is room for
  it visually.
- Nothing was built: the plan is written for when it's time.
- **Its three open details, settled the same day** (BVJ): a Greek result
  opens the Notebook even when the reader closed it; a Latin query (a
  transliteration or an English word) shows a Greek group in the search
  tray only on an exact transliteration key or a gloss that is the query
  word, at most three words, below the scripture groups, while /search
  always shows it; and **1h is built before phases 2 and 3 begin**.

### 2026-10-13 (BVJ's answers on the preview)

The first five confirm what the preview already does.

- **Playpen Sans at weight 500** for margin notes. Its size is still to
  tune (tuned later the same day: 16px; see below).
- **Bookmarks show on the page**, as the red mark.
- **The verse number names a verse's notes** for screen readers ("Verse 1,
  1 note of mine").
- **The tour is offered once and replays on demand** (D8).
- **Read View's notebook holds the reader's own things.**
- **The floating notebook's five behaviours are confirmed**, with one
  change: **the notebook starts open and minimized** on every page, rather
  than closed. Closing it and restoring it are remembered, so the next page
  opens as the reader left it, and **the reader can change the default**,
  on the notebook page: "When a page opens, the Notebook panel is" As I
  left it (the default), Minimized, Open or Closed (`lit-desk-start`; the
  rule is `src/lib/desk-start.mjs`). A chosen start wins over what the
  reader did last, and a floating notebook still collapses by itself. Built
  the same day; (Superseded 2026-10-14: only an expanded notebook narrows
  the column to 48, so a Study View chapter opens at 52 by default, minimized.)
- **"Show notes in full in this list" was awkward** as a checkbox at the
  panel's foot. It became **"Open all" / "Close all"** at the right above
  My Notes' list, with each note's caret kept (BVJ chose both). It is the
  same remembered setting (`lit-desk-list`), so it opens pinned footnotes
  too; "Close all" also closes notes opened by their carets. It shows only
  when a note is cut off or a footnote is pinned.
- **No message to STEPBible** about the project.
- **1d's and 1f's other defaults are accepted**, including hosting the
  full LSJ on the site.
- **1g and 1h are part of phase 1**: phases 2 and 3 wait until both have
  been explored.
- **No release before phase 1 is completely done**, and perhaps not until
  phases 1 to 3 are.
- **STEPBible's data is pointed to its source**: `public/greek/LICENSE.txt`
  no longer calls the `step/` and `lsj/` directories licensed for reuse, and
  sends anyone wanting the lexicons to github.com/STEPBible.

### 2026-10-13 (BVJ's answers on the defaults)

- **N11's four provisional choices are confirmed as built**: the slug
  rule, the rule for quoting prose, the field names, and the ways in.
- **1h's defaults are accepted**, all of them.
- **1c's other defaults are confirmed**: the second slice's ("This
  verse", M1 on H, the remembered tab, the width handles' steps), the
  highlights' (Remove highlight erasing only within the words, among
  them) and undo's.
- **Margin notes are slightly larger**: 16px at the default text size,
  up from 15. Built the same day.
- **A note in the margin shows three lines at most** until it is
  hovered, focused or clicked, even when nothing is below it; one that
  would run into the next note is cut sooner, as before. Built the same
  day.
- **The tour puts the names of things in quotation marks** ("My Notes",
  "This verse", "Greek", the "My Notebook" row and its buttons), as the
  help page does. Built the same day. BVJ also found the tour too thin:
  it now walks through how to use the features, with **steps that act and
  leave nothing behind** (built the same day; "Order of work", 1d).
- **Construction search and searching by parsing go in phase 2**, **word
  families are deferred indefinitely** (probably not a version 1
  feature), and **the transliteration pass goes on FIXLIST.md** (all
  2026-10-13).
- **Leaning toward releasing after phase 3**, not decided (under "Still
  open").
- **The tour tells a bookmark from a ribbon** (BVJ asked, 2026-10-13):
  the bookmark step says a bookmark stays on its verse, and a step of its
  own, "A ribbon for a reading", says a ribbon is a named place that moves
  with the reader once opened from "Places". Built the same day.

### 2026-10-13 (the Greek on draft chapters)

- **BVJ decided the Greek tab is offered on draft chapters too.** The Greek
  data already covers all 260 chapters, so a draft (Acts, Revelation) can show
  the SBLGNT beside the dictionary even with no LIT text yet.
- **How:** a draft page names its chapter in `data-draft-book` and
  `data-draft-chapter`, which `greekChapter()` (`desk/page.js`) reads; the
  panel's Greek tab and the “Show the Greek” command use it.
- **A draft has no “This verse” tab, no “Go to verse” button and no footnote
  letters**, since it has no LIT verses, notes or text to go with the Greek.
- **Drafts still never set the last-read attributes**, so they do not count
  for “Continue reading”.
- **It closes a gap:** a Greek search result in a draft chapter used to land
  on the draft page with nothing to show; it now opens the Greek at the word
  (`greek-link.js` already works wherever the panel offers Greek).

### 2026-10-14 (Greek search commands)

Settled by BVJ on a switchable mockup of /search, the tray and the Greek
tab, while planning the rest of 2a ("Order of work", 2a):

- **One "Search commands" window holds the instructions** (BVJ: a list of
  commands, opened from a link, dragged like the verse menu, and staying
  open through clicks elsewhere so it can sit beside the box while the
  reader types). It takes the place of most of the buttons, instructions
  and examples the features would otherwise add to the pages; BVJ judged
  the first trim too bare, so these stay on the page because they use space
  that is empty anyway or say back what was typed: the search said back
  above the results, examples where an empty search's results would be,
  the placeholder, words for every symbol, and a fuller link label
  ("Search commands"). A step in the tour introduces it.
- **It closes** on its × or Escape, on going to another page, and, opened
  from the Greek tab, when the Notebook is closed or minimized. BVJ agreed
  to three further recommendations: opened from /search or the tray, the
  Notebook doesn't affect it; switching away from the Greek tab closes it;
  and the Notebook collapsing by itself closes it.
- **The syntax**: dots join filters to a word (πίστις.gen; BVJ chose
  dots over brackets); **a comma joins the words of a construction** (BVJ:
  separating with spaces isn't obviously additive); **a slash means
  "or"**; and **every command has a full word too** ("and", "or", "any",
  "exact", "within 3", "next to", "anywhere", "any order").
- **A command word can be meant as a word** (BVJ: "any" could be an
  intended search, and "exact"). So quotes always mean the word itself, and
  a command word alone is searched as a word. Built as: one bare word is
  always a word, parsing words included ("perfect", "genitive").
- **The window opens by itself once** (the first time "Greek" is picked),
  **and has a builder** (a word and pickers that write the command); both
  were tried as switches on the mockup and kept.
- **Either of two filters** (BVJ, 2026-10-15, asking for genitive or
  dative): built with the slash and "or" that already joined two words,
  so πίστις.gen/dat and "pistis genitive or dative" find either case.
- Not settled, built as recommended: two words with only a space between
  them (a phrase pasted from a verse) are read as a construction too, while
  the window and the examples teach the comma.

### 2026-10-16 (footnotes that cite this verse, in 2a)

- **The This verse tab lists footnotes that cite the verse**, as a read-only
  2a piece beside N4's "Notes that cite this verse" (BVJ, 2026-10-16). Each
  citing footnote is its own entry, shared footnotes are not deduped, and
  same-chapter citations are included with no special label. Relative
  references are written out in the text, not resolved in code. Sefaria,
  eBible and translation-tagged references are left out. Recorded in 2a
  above; built on this branch only after BVJ's go-ahead.

### 2026-10-15 (placing N9, N6, N5, B2 and D4)

- **N9 is in 2b, N6 is in 2c** (BVJ, 2026-10-15). N6's "For discussion"
  section needs sheets, so that part follows phase 3.
- **N5 is version 2** (BVJ, 2026-10-15).
- **B2 is shelved** (BVJ: "sounds like a note"; "maybe shelve it"). Its
  label already exists on plain bookmarks, so only the "how you got there"
  trail is shelved. Read "maybe" as shelved; it is easy to reverse.
- **D4 is in phase 3, last** (BVJ, 2026-10-15). The panes on /desk cover
  most of its job, so it is decided once /desk exists.
- **The "Any time" items** are now just the apps' license-terms link.

### 2026-10-15 (N2, H2 and M4 shelved: version 2)

- **N2, H2 with C23 and M4 are shelved** (BVJ, 2026-10-15), and so is the
  word pane proposed for 2c under D9. They are version 2 material and
  leave phase 2c.
- **The rule (BVJ, 2026-10-15): anything deferred or shelved is not in a
  phase of version 1's development.** It keeps its entry, for version 2,
  under "Version 2" in "Order of work". What is in a phase is version 1.
- **Applied the same day**: M10 is out of phase 2a; 1g is out of phase 1
  and 1e is out of phase 1's list; word families are out of phase 2's
  text; D7's public-domain part is out of phase 1c; N7 is listed under
  version 2.
- **Stays in version 1** (BVJ, 2026-10-15): M11, the one piece left in
  2c; and the Greek pane in /desk (D9). An interlinear-style interleaf is
  version 2. **N8, the hidden passage**, is held until after the Zoom and
  stays in 1d until then.
- **Knock-on**: the record kinds `glossaryId` (N2) and `markRule` (H2) stay
  in `STUDY-DESK-FORMAT.md` for now. Whether they stay as reserved kinds
  can be decided later (under "Version 2").

### 2026-10-15 (M10 shelved)

- **M10, "your notebook where you already look", is shelved** (BVJ,
  2026-10-15), after it was built on the preview the same day: the
  "Verses in my notebook" filter on /release-notes, "My notes on this
  term" under a /glossary entry, and "Your notes here" in Go deeper. The
  code is kept on branch `claude/desk-2a-m10` and taken out of the tree,
  so /glossary no longer carries the `data-words` attributes it needed.
  B3 and N4 stay. No reason was recorded.

### 2026-10-14 (the tour offer)

- **The tour is offered in a window, not a card** (BVJ, after a mock on
  Romans 8). It opens the first time the reader expands the Notebook, once
  "Where should your notebook live?" is answered, **beside the Notebook**
  (over it only where there is no room), with its top level with the
  Notebook's. It drags by its header. Three answers:
  - **Take the tour now**;
  - **Remind me later**: offered again on a later visit, never again on
    this one. The ×, Escape, closing or minimizing the Notebook, and leaving
    the page all count as this, since an offer shown is written as "later"
    until it's answered;
  - **Don't show this again**: no offers of the tour at all, including
    "There's something new in the tour." The tour stays in the panel's
    foot, the help page, and the `tour` command.
  After the home question rather than before it (BVJ). **A later visit is
  built as a later day** (a recommendation, for BVJ to judge on the
  preview): a day is the same in every tab, where a visit can't be told
  apart from a second tab opened a minute later. Stored as markers in `lit-desk-tour`
  (`later:<date>`, `never`); /privacy's paragraph now says that key keeps
  the reader's answer too.
- **The window is a reusable layer**, `src/scripts/float-window.js`: a
  click outside doesn't close it, and it doesn't take the shared panels'
  one slot. 2a's search commands window is planned on it.

### 2026-10-15 (D9: the desk as a page of its own)

- **D9 joins phase 3: phase 3 is sheets and the desk** (BVJ). The desk
  gets a page of its own, `/desk/`, with one to four panes (the LIT text,
  My Notes, This verse, Greek, footnotes, sheets, and Go deeper's place
  open), in columns, rows, 1×2, 2×1 or 2×2, resizable, and a layout the
  page remembers.
- **Sheets are edited only in /desk.** A sheet's own address is for
  shared links, present mode and printing.
- **Phases 2b and 2c come after phase 3.**
- **The scope isn't cut to make a date**: "no need to compress the scope
  to make it go faster. We'll be fine."
- **Not for now**: other versions (D7). **No**: the interleaf (N7), which
  My Notes covers. **Yes**: the Greek interleaf (1g) and footnotes in the
  margin (X11), as the Greek and footnotes panes.
- Still open, under D9: chapter, book or whole-corpus scrolling in the
  text pane; where Go deeper goes; whether a rich-text document is part of
  sheets or its own pane (and its record format); the word pane for 2c.

### 2026-10-18 (Phase 3a: the /desk mockups)

Five questions mocked as one private claude.ai page, "Study Desk Mockups"
(John 3, John 4 and Romans 8, with made-up notes and a made-up sheet).
BVJ's answers, the same day (details under D9, "Phase 3a's answers"):

- **Layouts**: the Layout menu, **with dragging a pane to split another
  included too** ("A but B is included"). Every arrangement mocked works
  except **four rows, which is left out**.
- **The sheet's own address is `/sheets/`**, beside `/desk/`, as
  recommended.
- **Go deeper is a "This chapter" section at the foot of This verse**, as
  recommended.
- **A formatted document is part of sheets**, as recommended, and more:
  **several templates and customizable modules, plus a "template" that is
  a blank canvas with the full rich-text formatting options**, for a fully
  original document.
- **The LIT pane scrolls the whole corpus, with no additional options**, as
  recommended.

The mockup's four smaller calls, the same day: **agreed** that a pane needs
at least 280px by 160px, that the original layout is the LIT text beside
My Notes, and that the layout is kept in this browser. **One of each
pane, recommended, was not taken**: BVJ could see reasons for two LIT,
Greek or sheet panes, asked for more detail on how following would work,
and chose **option B**: several of a kind, the following panes following
the LIT pane last worked in, with a Stay here pin (D9, "Phase 3a's
answers", 6; the three options under "Still open"). The 3a to 3k
split itself is still a proposal BVJ worked within but hasn't confirmed.

### 2026-10-18 (Phase 3b: the sheet format)

- **The sheet's inner shape is approved** (BVJ), as the website proposed
  it in STUDY-DESK-FORMAT.md, "Sheets (kind 9)": one record per sheet, so
  two computers editing one sheet before they meet keep the later save
  (every module has its own id, so module-by-module merging can come
  later); six modules (passage, text, question, space, key terms box, page
  break), any of them leader-only; passages as references read from the
  live text, with a copy of their wording kept for S2's comparison only;
  blanks with no hint, the traditional word or the leader's own; footnote
  choices named by their text, with the spoiler default worked out live.
- **The rich-text set** (BVJ): paragraphs, two heading levels, quotations,
  a horizontal line, bulleted and numbered lists nested three deep, bold,
  italic, underline, strikethrough, superscript, subscript, links and line
  breaks, **plus text alignment** (center, right, justified). **Then, the
  same day, named styles** (BVJ): fonts (Sans, Serif, Display,
  Handwriting and Atkinson Hyperlegible), sizes (Small, Large, Larger),
  five text colors (red, blue, green, purple, gray) and the four highlight
  colors as backgrounds, each beside the default. Stored as names, never
  values, so themes, print and contrast decide how they look, and a
  reader's accessibility font still wins on screen. Left out: images and
  tables. The set can grow later but never shrink.

### 2026-10-28 (FA1-s: Greek credits and the notebook search; BVJ's call)

FA1-s fixed BA40, BA46 and BA47 (`STUDY-DESK-AUDIT-1.md`). BVJ decided the
call the audit left open:

- **BA40, a Greek search lists the reader's matching notes** (BVJ chose
  this over keeping the Greek alone). The 2026-10-13 rule that one query
  never gets both English and Greek results was about the English verses,
  not the reader's own words, so it stands: a query with Greek letters or a
  Strong's number still gets no English group. Under all types, the
  notebook's matches are listed too, ahead of the Greek as on every other
  search (in the tray, and on /search's first page). The notebook's
  matching also reads a final ς as σ, so "πιστισ" finds a note on πίστις.

Also: **every Greek group credits its sources** in one line under it
("Greek: SBLGNT; parsing: MorphGNT and MACULA Greek; glosses: UBS and STEP
Bible (licenses)."), with the Greek tab's names and links, from
`src/lib/greek-credits.mjs` (BA46; MACULA added to the audit's wording,
since it gives the index its Strong's numbers and two passages' parsing).
And `public/greek/LICENSE.txt` says the search index carries STEPBible's
brief glosses for most lemmas, pointing to github.com/STEPBible as the
`step/` and `lsj/` sections do, with everything else in `search/` still
CC BY-SA 4.0 (BA47).

### 2026-10-27 (E10 built: the website reads and writes `ribbon`)

**For BDR's Claude.** The website now follows E10 (BDR, 2026-10-23) on its
preview, ahead of E9 and independent of it:

- **The note markers are `note`, `emphasis`, `question`, `heart`, `ribbon`,
  `lightbulb` and `flame`**, `ribbon` where `bookmark` stood. The note
  editor offers "Ribbon" with the same green picture; nothing else a
  reader sees changes. The `bookmark` kind (kind 4) is untouched.
- **Read old, write new.** A note marked `bookmark` arriving from anywhere
  (the notebook's own storage, a backup or Web Annotation file, a Markdown
  copy's "Note (bookmark)", the merge, a note held in the trash) reads as
  `ribbon` (`RENAMED_MARKERS` and `migrateRecord` in
  `src/lib/desk-records.mjs`). Nothing stored is rewritten for being read,
  and renaming isn't an edit, so `modified` doesn't move; the note is
  written as `ribbon` the next time anything writes it. A record still
  holding `bookmark` stays valid, since every client reads it as `ribbon`.
  A note from a newer schema is carried as it arrived (principle 6).
- **The merge and anchor vectors are unchanged.** Their notes are all
  marked `note`, and how a client reads an old marker name (on arrival, as
  the website does, or when it draws the note) is each client's own, so no
  case was added.
- Until this, the website refused a note marked `ribbon`: an app writing the
  new name would have had those notes skipped on import here.

### 2026-10-27 (FA1-k: Greek search commands; BVJ's two calls)

FA1-k fixed BA44, BA45, BA48, BA50 and BA116 (`STUDY-DESK-AUDIT-1.md`).
BVJ decided the two calls the audit left open:

- **BA45, plain English words holding a command word: a whole gloss wins,
  then the command, then the gloss again** (BVJ chose this over falling
  back to the gloss only when the command fails, which left "present time"
  returning 40 unrelated verses). Two or three plain words with no symbols
  or quotes that are, whole, a word's gloss, one of its senses or the LIT's
  rendering of it ("present time", "in order to", "forever and ever") search
  as that gloss. Anything else is read as a command, and if the command
  can't be read or finds nothing, the gloss search's answer is shown
  instead. A reader who means the command writes it with a dot or a comma
  (`*.pres, time`). This settles the case the 2026-10-14 entry left open
  for command words; two plain words with only a space between them are
  still a construction when they aren't a gloss.
- **BA49, `*.sg` loading nearly the whole parse index: accepted** (BVJ
  chose this over requiring a part of speech or case with number, gender or
  person). It loads 54 of the 57 files, about 600 KB compressed, once a
  visit; a note in `groupsForFilters` says so.

Also: **a search joins at most four words** (BA44's cap, an error sentence,
and a line in the commands window), which is what lets the matcher stay
fast; and **a filter with no word before it is any word** (".gen" is
"*.gen", BA48).

### 2026-10-27 (FA1-i: sheet templates and passages; BVJ's two calls)

FA1-i fixed BA69, BA70, BA75, BA76, BA77 and BA127
(`STUDY-DESK-AUDIT-1.md`). BVJ decided the two calls the audit left open:

- **BA69, where a passage lands in a template: by the reading heading,
  for as long as the sheet has no passage** (BVJ chose this over setting
  the reading part as "last worked in" only when the sheet is made, which
  a reopened sheet would lose). A passage added before any part is worked
  in goes after the part headed "Reading," "Read" or "The text." Once there
  is a passage, the next goes after the last one, so passages added one
  after another stay in order (Claude's addition, since otherwise the second
  landed after "Closing"). A part the reader has clicked or typed in still
  wins. A sheet doesn't record which part is the reading, so a renamed
  heading isn't found and the passage goes at the end.
- **BA70, the instructions that printed: ghost text** (BVJ asked for it
  over removing the sentence when the first passage is added, if it could
  be done). The templates no longer hold "Add the passage with + Passage,
  or from the LIT pane's verse numbers." The editor shows it, dimmed and in
  italics, inside the reading part's box until the sheet has a passage.
  The sheet never holds it, so it can't print or go up on a room's screen.
  Sheets made before this change still hold the old sentence, to delete
  by hand.

### 2026-10-27 (FA1-h: marks on the page; two calls for BVJ to judge)

FA1-h (#380) fixed BA16, BA17, BA19, BA20 and BA23 (`STUDY-DESK-AUDIT-1.md`). Two
of them needed a call the audit left to the session. Both are
recommendations, for BVJ to confirm or change:

- **BA23, a drag that ends over a desk window: the selection ends where
  the pointer last was over the text.** The audit offered three fixes:
  end it there, offer no panel, or ask before a note on more than a few
  verses. The first was taken, since it keeps the gesture working and asks
  nothing. The page's own selection is moved to match, so what is
  highlighted is what the panel offers. A drag that really goes past the
  last verse (below the text going down, above it going up) still runs to
  the end, as before. It is shared reader code (`chapter-tools.js`, rule in
  `src/lib/selection-end.mjs`), so it serves every reader, though only the
  desk's windows and /desk's panes set it off today.
- **BA19, going to a note while the notes are hidden: focus goes to where
  its words are.** The 2026-10-07 decision (the margin switch, item 7)
  says focus lands on the note, but with the notes hidden the margin holds
  none. Focus goes to the verse number its marked words start in, or for a
  note on a footnote to that footnote's first link, so a keyboard reader
  arrives where the marking is.

### 2026-10-26 (FA1-u, areas 4 to 6: 25 findings; FA1-u done)

- **FA1-u's second session** audited /desk's use of the shared modules
  (area 4), sheets beyond one tab (area 5), and a copy pass and the
  stylesheet (area 6). **25 findings, BA121 to BA145: 7 medium and 18
  low**, by area 6, 7 and 12. They are written up in
  `STUDY-DESK-AUDIT-1.md` under FA1-u and planned in four new phases
  (FA1-aa /desk's panes and the shared modules, FA1-ab Sheets in two tabs
  and large sheets, FA1-ac The copy pass, FA1-ad The stylesheet), with
  BA127 in FA1-i. That ends FA1-u: 58 findings over its two sessions.
- **Two are data loss, in sheets** (BA128, BA129): a failed save leaves
  every later edit unsaved, and a tab that hasn't heard another tab's save
  writes its older copy over the whole sheet. **BVJ moved FA1-ab up to
  follow FA1-u** (2026-10-26), by the plan's own rule, data loss first, so
  it is the next phase.
- **BVJ took Claude's recommendation on all four calls** (2026-10-26):
  - **BA125**: a verse menu or selection panel opened with the mouse in a
    /desk pane is pinned to the screen, as a dragged one is, rather than
    closed when the pane scrolls.
  - **BA138**: “Notebook” is capitalized where it names the panel (“Close
    the Notebook”); “my notebook” stays lowercase where it means what the
    reader has kept (“Save a copy of my notebook”).
  - **BA139**: “My Notes” names the tab and the pane only; the margin is
    “Notes in the margin,” in its switch, its region's name and its
    command.
  - **BA144**: text fields' borders rise to about 3:1 site-wide, not only
    on the desk, as its own commit in FA1-ad.

### 2026-10-26 (FA1-u, areas 1 to 3: 33 findings; a stricter linker for notes)

- **FA1-u's first session** audited What's new for you and your own chains
  (area 1), places and ribbons (area 2), and the Greek tab's reading view
  and the commands window (area 3). **33 findings, BA88 to BA120: 7 medium
  and 26 low**, by area 11, 11 and 11. They are written up in
  `STUDY-DESK-AUDIT-1.md` under FA1-u and planned in four new phases
  (FA1-w What's new for you, FA1-x A note's references, FA1-y Ribbons and
  Continue reading, FA1-z The Greek tab), with BA116 in FA1-k, BA114 and
  BA115 in FA1-r, and BA91, BA109 and BA118 in FA1-t. Areas 4 to 6 are
  next.
- **A note's references get a stricter linker** (BVJ, 2026-10-26; BA89).
  In a reader's note, a bare number after a comma or “and” no longer
  continues a list of verses, so “Romans 8:28, 3 reasons” stays plain and
  doesn't chain a note to Romans 8:3. A continuation links only when it is
  itself a reference with a colon (“8:28, 9:1”), so “8:28, 30” in a note
  links 8:28 alone. Footnotes, intros and articles keep today's rule.
  Recommended with it, not a separate decision: a table of verse counts so
  a verse past a chapter's end never links.
- **The Greek tab searches a one-letter Greek word** (BVJ, 2026-10-26;
  BA110): its two-character floor is lifted for Greek and Strong's
  numbers, as the tray and /search already do, so ὦ (“O”) and ἤ are
  searchable by their forms. The floor never kept results small (καί
  passes it). A bare search for the article is no use, since ὁ is in
  6,966 of 7,942 verses; recommended, not decided: answer it with a line
  pointing to a search beside a word (“ὁ, θεός”) instead of the list.
- **FA1-y meets E9.** The ribbon findings describe today's code, which E9
  (2026-10-22) will rebuild as Bookmarks; each says what E9 would make
  moot, and if E9 is built first, FA1-y folds into it.

### 2026-10-26 (FA1-e: "My default" is a layout, not a passage)

- **"My default" saves an arrangement, not a place** (BVJ, 2026-10-26;
  BA53, option 1 of three). Opening the desk with My default gives its
  panes, kinds, sizes, "Stay here" pins and each Sheet pane's sheet, at the
  place the reader was last on /desk, or Continue reading's when the desk
  has none. Until then it reopened at the passage where the default was
  made, ignoring both, which D9's answer 2 (the default as a *layout*)
  didn't mean. A pinned pane in the default keeps its Stay here but starts
  at the reader's place. Weighed and not chosen: keeping the default as a
  saved desk, passage and all (a bookmark by another name, and a reset of
  the reader's place on every visit with nothing on the page saying why),
  and a "Remember the passage too" box beside "Make this my default" (one
  more control in the Layout menu). The default still stores its places, so
  a later choice can use them; the page ignores them on the way in.

### 2026-10-23 (BDR's answers: E9 accepted, the marker renamed `ribbon`, two confirmations)

- **E9, bookmarks and ribbons one feature: accepted by BDR** (2026-10-23).
  The apps build one kind, Bookmarks, with a name and an optional "move as
  I read"; no separate ribbon kind.
- **E10: the `bookmark` note marker is renamed `ribbon`** (BDR, 2026-10-23;
  BVJ's first suggestion). The format's marker list says so
  (`STUDY-DESK-FORMAT.md`, kind 2): every client reads `bookmark` as
  `ribbon` and writes `ribbon`; the picture and color stay.
- **Confirmed by BDR the same day:** a note on a footnote named as a pin is
  (kind 2, the 2026-10-20 proposal), and the collapse of two trash records
  of one deletion with its three merge details (2026-10-12). Both come off
  the format's "Still open" list.
- Recorded by BDR's Claude on the proposal ("One Notebook, Three Homes",
  its 2026-10-23 entries) and brought here as a docs pull request, under
  the scope BVJ widened on 2026-10-09.

### 2026-10-22 (Bookmarks and ribbons become one)

- **Bookmarks and ribbons are one feature, Bookmarks** (BVJ, 2026-10-22):
  "the difference between Bookmarks and Ribbons is confusing and
  redundant." The red bookmark glyph is the cue, the name is Bookmarks, and
  the functionality is the ribbons' (named, can follow the reader). Logged
  as E9 in phase 5, which takes up E4; **the details are in E9**.
- **The Places section goes, and nothing is listed by default** (BVJ): the
  list holds "Continue reading", with no bookmark icon, then only the
  bookmarks the reader adds. Read View's per-book places aren't carried
  over (E8's open question, answered).
- **Claude's recommendation, not decided: a bookmark stays put unless the
  reader turns on "Move as I read."** See E9.
- **BDR's Claude is to be told** (BVJ): the consolidation changes the
  record kinds the apps sync. It is recorded where BDR's Claude reads: E9's
  "For BDR's Claude" paragraph, a 2026-10-22 bullet in "The website's
  answers to the proposal" in "One notebook, three homes," and the open notes under
  kinds 4 and 5 in `STUDY-DESK-FORMAT.md`. Nothing is built yet, so no
  record changes until the website says so here.
- **A strong recommendation, not a change** (BVJ): rename the `bookmark`
  note marker to `ribbon`, or retire it, so it no longer clashes with the
  feature. Left as it is for now (E10); the picture stays the same.
  **Decided by BDR, 2026-10-23: renamed `ribbon`** (see the 2026-10-23 entry).

### 2026-10-21 (/desk's own header; a search pane, 3m)

- **/desk gets a header of its own, at every width** (BVJ, 2026-10-21), so
  the panes cover more of the window: the emblem and "LIT Bible" as the
  home link, as on a phone; "Study Desk" centered as the page's title; then
  Layout, the Display tray and the menu button, never the full nav. No
  search box. The SBLGNT notice goes below the panes, so the page scrolls:
  the panes grow as the header scrolls away until they fill the window,
  then move up to show the notice. The LIT's display switches stay in the
  Display tray, which /desk now shows with Study View's "Show" group
  (Claude's recommendation; the tray already reached the LIT pane's text,
  and per-pane switches wait until two differently set LIT panes are
  wanted). The page scrolls from the header, the gutters, the keyboard and
  the scrollbar, since every pane keeps its own scrolling
  (`overscroll-behavior: contain`); a control to scroll the header away was
  considered and dropped. **Built on the preview 2026-10-21.**
- **A search pane is phase 3m** ("Order of work", 3), to build later.
  Claude recommended phase 3 over 5: phase 5 is the log of fixes to what
  exists, and a new pane kind is /desk's own work, beside the other panes.
- **"My highlights" is in the Display tray on Study View too** (BVJ,
  2026-10-21), one setting with the Notebook panel's box. Study View's tray
  already had it; /desk's tray gets it as well (Study View's setting, the
  only desk switch there, since /desk draws no margin notes or bookmarks).

### 2026-10-21 (Read View retires at launch; D4 to version 2)

- **Read View is removed when the desk launches** (BVJ, 2026-10-21), and
  on a computer Study View's "Read View" button becomes the way into
  /desk. Logged as E8 ("Fixes and experience"), with what to build before
  launch and what changes at it. Claude first recommended keeping Read
  View as the page for phones, readers without JS and old links; BVJ's
  answers: phone readers use the apps, old links redirect to Study View,
  and there is no need for a trial period after launch. Two questions stay
  open in E8: the whole-book browser tools, and the button's label.
- **D4, pop the notebook out (phase 3l), is deferred to version 2** (BVJ,
  2026-10-21), so phase 3 is done.

### 2026-10-20 (Full Audit 1)

- **An audit of everything built** (commit `82af6a6`): 87 findings, BA1 to
  BA87. Four are high: a sheet in a newer format runs its own script when
  viewed (BA66); an older Markdown copy undoes note edits made since (BA1)
  and brings back notes deleted since (BA2); and closing a pane on /desk
  loses the reader's place (BA51). The audit page is
  https://claude.ai/artifact/VtA4S94L9MCjV7GqMrFMgL (private to BVJ).
- **BA32 declined** (BVJ): the tour offer opening over the scripture's line
  ends is fine. Won't fix.
- **The plan is its own file** (BVJ): `STUDY-DESK-AUDIT-1.md`, with the 86
  remaining findings in 20 phases, FA1-a to FA1-t, ordered security and
  data loss first, each sized for one session on a Pro account. Findings
  marked "BVJ's call" there have recommendations, and are asked at the
  start of their phase.
- **Subagents in these sessions only on Sonnet or Haiku** (BVJ), never
  Opus: eight Opus agents used up two usage windows during the audit.
- **The next audit is part of the plan** (BVJ): FA1-u reviews the code
  this audit didn't reach, after FA1-f, so what it finds can join the
  phases for those areas; FA1-v checks the desk on real devices (Safari,
  Firefox, a screen reader, two screens, a touchscreen, paper) as the last
  phase. Their findings continue as BA88 onward.

### 2026-10-20 (Phase 2c: notes on a footnote, and questions for discussion)

- **Built** as 2c set out: M11 (a note on a footnote) and the rest of N6
  (a sheet gathering the reader's questions), after 2b and ahead of 3l at
  BVJ's request. No storage key is added, so /privacy is unchanged.
- **Smaller calls made in building it, for BVJ to judge on the preview**
  (recommendations, not decisions):
  - **A note on a footnote is a note, not a new kind.** It names its
    footnote with a pin's fields (the verse holding the letter, the
    footnote's full text, and `n` among identical footnotes in that verse),
    so it is found again by the pin's rule, and an app that doesn't know
    the target still reads it as a note on the verse, losing nothing. It
    quotes the whole footnote, never part of it. The format change is the
    website's proposal, for BDR to confirm (STUDY-DESK-FORMAT.md, kind 2).
  - **Where it is made**: "Add a note" beside Pin, in the four places Pin
    already is: the footnote's popover, Study View's Footnotes list, This
    verse and /desk's Footnotes pane.
  - **Where it shows.** On Study View, in the margin **beside the footnote
    at the foot of the page**, not beside the verse; hovering or opening
    it marks the footnote. Under the footnote wherever the footnote is
    shown: in full in This verse and the Footnotes pane, and the first two,
    shortened, in the popover ("and 2 more in My Notes"). In My Notes and on
    the notebook page, as a note with "On a footnote:" and the footnote's
    opening words. /desk's LIT pane shows no notes beside its text, as
    for other notes (3g).
  - **It is about the footnote, not the verse**, so it isn't counted in the
    verse number's name ("Verse 3, 1 note of mine") or listed under This
    verse's "My notes" for the verse.
  - **The change notice is the pin's**: "The footnote your note is on has
    been rewritten," with **Keep on the new wording**, or "not in the text
    any more" when no footnote in its verse is close enough. A change to
    the verse's own wording raises nothing.
  - **Print with my notes** prints it beside its footnote in the endnotes.
  - **Markdown** names it "Note on a footnote" and quotes the footnote. A
    new one can't be made from a Markdown file, as a pin can't: a heading
    names the verse, not which of its footnotes. The full backup carries it
    whole.
  - **"+ For discussion"** sits after "+ Question" in the Sheet pane. It
    adds a "For discussion" heading and one question for each note marked
    with the question marker whose verses fall in one of the sheet's
    passages (a note on a footnote counts by its verse), in the sheet's
    passage order, then verse order. Each question reads "**Romans 8:3**"
    and then the note's words, with three lines to write on and no answer.
    They go after the part last worked in, as a new part does (3k), and one
    Ctrl+Z takes them all back.
  - **It is a one-time gather**, not a live section: the parts are
    ordinary ones, and nothing ties them to the notes, so editing either
    never changes the other. Pressing it again adds only questions that
    aren't on the sheet yet, under the heading already there; a question
    reworded on the sheet no longer matches its note, so it comes back.
  - **When nothing is found** it says so, and how: "None of your notes
    marked as questions are on this sheet’s passages. Mark a note as a
    question with the question marker."
- **Fixed along the way**: the Sheet pane's "From my notebook" list showed
  no words for a note (it read the wrong field), and now names a question
  as a question.
- **Known limits**: checked in Chrome on Romans 8 (making one, the margin,
  the popover and This verse, My Notes, the notice, the gather and its
  undo). Not yet checked on paper, or in /desk's Footnotes pane in a
  browser.

### 2026-10-20 (Phase 2b: text checked before printing, and room to write)

- **Built** as 2b set out: S2 (a sheet's passages checked against today's
  text, and the day the text is from) and N9 (print with room to write),
  after phase 3k, since S2 needed sheets. Neither stores anything new, so
  /privacy is unchanged.
- **Smaller calls made in building it, for BVJ to judge on the preview**
  (recommendations, not decisions):
  - **Where a change shows.** In the Sheet pane, under the passage's words:
    "The wording of these verses has changed since you added this passage",
    the diff, the release note's date and link when one names the verses,
    "The sheet prints today’s wording. Check your blanks, questions, and
    notes against it," and **Keep the new wording**. On the sheet's page,
    above the paper: one line naming the passages ("The wording of Romans
    8:1–2 has changed since you added it."), each diff, and a link to the
    sheet on the Study Desk. **Print stays one press**; the notice is the
    check, not a dialog in the way. The page never writes, so Keep is on
    /desk only.
  - **Keep is one undoable change**, like any edit to the sheet. It takes a
    fresh copy of the verses (and, for a passage that starts or ends inside
    a verse, its words taken again from where they stand now).
  - **A passage that starts or ends inside a verse** is judged on its own
    words, not the whole verse's, the way a quoted note is: a change
    elsewhere in the verse doesn't print, so it raises nothing.
  - **Typography alone raises nothing**, as for notes (quotes, dashes,
    spacing).
  - **A passage with no comparison copy** (one gathered from a search, M5,
    whose chapters aren't fetched there) takes one quietly the first time
    the Sheet pane reads it, with no undo step, so a change from then on is
    caught. "Open it on the Study Desk" is the usual next step, so in
    practice that is the day it was made. Taking copies on /search instead
    would mean fetching every chapter's page there.
  - **"Text as of"** is the date in the content version the passages were
    read from (the newest, if the chapters' pages differ), at the foot of
    both copies, after the chapters' addresses, and so in Copy for Word too.
    A dev build has no date and prints none. Present mode doesn't show it.
  - **A shared sheet is never flagged**: sharing leaves the comparison
    copies out (3k), so the reader who opens one has nothing to compare.
  - **N9's margin** is the right 35% of the page, ruled every 20pt (more
    when the Display tray's text size is larger), with the text in the left
    62%; footnotes and the notices print full width after the text, as in
    plain printing. Offered wherever "Print with my notes" is (Study View
    chapters and Read View), and also where the browser keeps no notebook,
    since it reads none.
  - **Known limits**: checked in Chrome only (N9 by printing PDFs).

### 2026-10-20 (Phase 3k: getting started and sharing)

- **Built** as 3k set out: templates including the contemplative one (M9)
  beside the blank canvas, a sheet from a search or a topic (M5), and
  sharing by `#` link and by file (S8). Sharing stores nothing (the link or
  the file is the sheet), so /privacy is unchanged.
- **The analytics check** (S8): tested against Cloudflare's real beacon
  script added to a built copy of the page, as Cloudflare adds it. The
  beacon's report named the page without the `#` part. The browser's own
  record of the page load still holds the full address, and the beacon
  didn't send it; that is worth checking again if the beacon changes.
- **Smaller calls made in building it, for BVJ to judge on the preview**
  (recommendations, not decisions):
  - **Templates** (M9): New sheet lists **Bible study** (an opening, the
    reading, three questions, the key terms box, a closing), **Sermon
    preparation** (the text, first reading, the key terms, context, the good
    news here, an outline, a word for the congregation), **Class session**
    (goals, the reading, background marked Leader only, two questions with
    answers, the key terms, next time), **Lectio divina** (read, reflect,
    pray and rest, each with its short instruction and space to write) and
    the **Blank canvas**. The wording of each is a first draft, and every
    one is the reader's to change. A template's sheet keeps its template's
    name in `template`, as the format says, and nothing reads it.
  - **New parts go after the part last worked in**, not at the end, for
    every way of adding one (the "+" buttons, "+ Passage", and "Add to
    sheet" from the LIT pane); with none, at the end, as before.
  - **A sheet from a search** (M5): on /search only (not the header's
    tray), "Make a sheet of these verses" above the verse results, with a
    box to tick on each verse; with none ticked, every result goes, not just
    the page showing. A topic's chapters have their own button and no ticks.
    The passages are in **Bible order**, not the search's order, with
    neighboring verses joined into one passage. They go into a **new sheet**
    titled with the search ("Search: “liberation”", or the topic's name) or
    into one of the reader's sheets, and the message offers Undo and "Open it
    on the Study Desk".
  - **The link** is `/sheets/#share1.<data>`, holding the sheet itself, not
    a copy on any server (format in STUDY-DESK-FORMAT.md, "Sharing a
    sheet"). A sheet of a few passages and questions makes a link of about
    400 characters, and a link of up to 1,000 gets a code to scan beside it.
  - **Share… asks what to share**: "Everything, for another leader" or "The
    participant copy, without answers or Leader only parts". A participant
    share leaves the Leader only parts and the answers out of the link
    itself, not only out of the view. Blanks stay, since the participant
    copy prints them (their answer is the LIT's own wording either way).
  - **The file** is Markdown a person can read (the title, each part, the
    passages named but not quoted) with the sheet's data on its last line,
    named `<title>.lit-sheet.md`. It is opened with "Open a shared file" on
    /sheets/, not with the notebook page's "Open a copy".
  - **Share… is on the sheet's page**, and the Sheet pane's "Print or
    copy…" is renamed **"Print or share…"** to lead there.
  - **A shared sheet is shown read only**, with "Shared with you" above it
    and **Copy into my desk**, which saves it as a new sheet of the reader's
    and turns the page into that sheet. Present waits for the copy, since
    the presenter view's window finds the sheet in the notebook. A
    participant share offers only the participant copy.
  - **Without the desk**: on a phone or tablet the page says to open the
    link on a computer, with **Copy the link** (the address bar no longer
    shows it). On a computer without the preview it offers a link that
    switches the preview on and opens the sheet.
  - **Known limits**: tested in Chrome only. A link longer than about 4,000
    characters gets a line suggesting a file, since some email programs cut
    long links; where that happens, the page says the link is damaged.

### 2026-10-20 (Phase 3j: present mode)

- **Built** as 3j set out: present mode with the reveal (S6), a code on its
  first screen (M3), and the presenter view on two screens (M2). Nothing is
  stored, so /privacy is unchanged; the browser's own permission to place
  windows on screens is asked for only when the leader opens the presenter
  view with a second screen attached.
- **Smaller calls made in building it, for BVJ to judge on the preview**
  (recommendations, not decisions):
  - **Where it starts**: "Present" in the toolbar of a sheet's page, which
    goes full screen at once, and "Present…" in the Sheet pane on /desk,
    beside "Print or copy…", which opens the presentation in a new tab
    (`/sheets/?id=<id>&view=present`). A browser allows full screen only
    from a click in that tab, so there the leader chooses Full screen (or
    double-clicks the screen).
  - **The screens**: a first screen, then one screen per part the room sees,
    in the sheet's order: each passage, text, question (without its lines or
    answer), and the key terms box. Spaces to write and page breaks are
    paper's, so they have none. **A part marked Leader only never reaches
    the room**: it goes to the presenter view, with the screen before it.
  - **The look**: a near-black ground with cream words in either theme, the
    passage in the site's sans-serif (a reader's Atkinson or OpenDyslexic
    choice still wins), the reference in green above it, and verse numbers
    kept small. Each screen is set at the largest type that fits, about 3.4%
    to 6.8% of the screen's height; a passage too long even at the smallest
    scrolls, with the Up and Down keys.
  - **The reveal uses the sheet's blanks**, with no separate setting: the
    leader marks what to reveal the way they mark a blank for paper (one
    click on a key term). A blank whose hint is the traditional word shows
    that word, dashed beneath, until R reveals the LIT's rendering in its
    place; any other blank is a line with the leader's hint. R reveals the
    next in reading order and Shift+R covers it again; going back to a
    screen finds it as it was left. A sheet with no blanks presents its text
    whole.
  - **Nothing moves when a word is revealed**: the word and what covered it
    share one space. The cost is that the space is as wide as the longer of
    the two, which leaves a gap around a short answer ("a just person" with
    room around "just") and could hint at a long one's length.
  - **Footnotes come up with F**, on passage screens: the ones the leader
    prints, and any held back only because it gives a blank away, once that
    blank is revealed (S6's "then the LIT's rendering and its footnote").
    They lie in a box over the lower part of the screen at a size of their
    own, so the verses don't shrink, and go down again with F. Footnote
    letters show in the verses only while the footnotes are up.
  - **The key terms screen** keeps a rendering blank until its blank has
    been revealed on any screen, and says so: "One term is left blank until
    it is revealed." (Paper's line sends the room to the leader copy.)
  - **The room's code** (M3): the first screen shows the sheet's name and
    subtitle, "Scan to follow along," and S5's code for each chapter (at
    most four, any more named in words), large enough to scan across a
    room, with the chapters' addresses beneath. It isn't repeated on later
    screens.
  - **The controls on the room's screen** are a strip along the bottom that
    shows when the pointer moves or a control has focus, and hides with the
    pointer after two and a half seconds: Previous, Next, Reveal (with "1 of
    2"), Footnotes, the screen's number, Presenter view, Full screen, and
    Close. Escape leaves present mode (in full screen the first Escape is
    the browser's, leaving full screen).
  - **The keys**, in either window: →, Page Down or Space for the next
    screen; ←, Page Up or Shift+Space for the one before (what a
    presentation clicker sends); Home and End; R, Shift+R, and F. They
    aren't tied to the Display tray's Keyboard switch, since they work only
    inside present mode.
  - **The presenter view** (M2) is the sheet's page in its own window
    (`&view=presenter`), in the reader's own theme: what the room sees now,
    what comes next with its name, "For the leader" (the blanks with their
    answers and what covers them, whether the footnotes are up and how many
    wait on the reveal, a question's answer, and the parts marked Leader
    only), a clock with Restart, and the keys. It holds the sheet's own
    leader parts only, not the reader's notebook notes.
  - **Two screens**: where the browser can place windows (Chrome and Edge)
    and a second screen is attached, "Presenter view" asks the browser's
    permission once, sends the presentation full screen to the other screen,
    and opens the presenter view filling this one. Elsewhere, or when the
    permission is refused, the presenter view opens as a window and the
    leader drags the presentation to the projector. Either window moves
    both, and a presenter view opened after the presentation picks up its
    place.
  - **Known limits**: tested in Chrome at one window size, with the two
    windows as two tabs. Moving the presentation to a second screen, and
    real full screen, need a second display and a person's click, so they
    are still to try; so are Firefox and Safari.

### 2026-10-20 (Phase 3i: paper and copies)

- **Built** as 3i set out: the sheet's own address with leader and
  participant copies (S4), US Letter or A4 with the Greek and Hebrew faces
  already registered by range (C27), a printed code per chapter (S5), Copy
  for Word (S9), and printing a chapter or book with the reader's notes
  (M6). Present (3j) and "Copy into my desk" for a shared sheet (3k) are
  still to come, so the page has neither yet.
- **The app link files, checked** (S5): the iOS file claims `/<book>-*` for
  all 27 books, so a code's address (`litbible.net/romans-8/#v1-4`) opens
  the iOS app where it is installed; Android's `assetlinks.json` delegates
  every address (`handle_all_urls`), and which paths the Android app itself
  accepts is in its own manifest, for BDR to confirm.
- **Smaller calls made in building it, for BVJ to judge on the preview**
  (recommendations, not decisions):
  - **The address**: `/sheets/?id=<id>` for one sheet, `/sheets/` for the
    list. The id is random and means nothing outside the reader's own
    notebook. Shared sheets (3k) will use the part after the `#`, so the two
    never clash. The Sheet pane opens it with "Print or copy…" in a new tab.
  - **The copies are called "Leader copy" and "Participant copy"**, as the
    mock's header had it, and the copy's name ends the subtitle line
    ("Thursday group · October 2, 2026 · Participant copy").
  - **A blank on the participant copy is a line of one width**, whatever
    the answer's length (a longer line for a longer word would give it
    away), with its hint in small italics beneath. The leader copy shows
    the answer in bold on the line, with the same hint. A verse number or
    footnote letter inside blanked words is kept, after the line. A paragraph holding a blank with a hint opens to double spacing, so the hint has room, which makes it read looser than the passages around it.
  - **The key terms box on the participant copy** prints a rendering as a
    blank when it shares a word stem with a blank on that copy (the
    footnote picker's rule), and says beneath: "One term is left blank here.
    Its answer is on the leader copy."
  - **Footnotes print after their passage**, with the chapter's own letters
    kept in the words, so each stays with the verse it explains.
  - **A code per chapter, beside the first passage from it**, opening that
    passage's verses ("Scan to read Romans 8"). On both copies, on by
    default, with a "Codes to scan" box that isn't remembered. The foot
    lists every chapter's address in words.
  - **Parts marked Leader only carry a small "Leader only" tag** on the
    leader copy. Questions aren't numbered; an answer prints in a box under
    its question on the leader copy only.
  - **The paper is guessed from the reader's languages** (Letter in the
    United States, Canada, Mexico, the Philippines and the Latin American
    countries that use it; A4 elsewhere) and remembered once chosen. The
    page draws the copy as a white sheet at that paper's width, in either
    theme.
  - **The reader's own named styles print**: their fonts, colors and
    backgrounds, which the site's print stylesheet otherwise turns to black
    serif. The passages print as Study View's do.
  - **Copy for Word copies the copy on screen**: headings, italics, the
    reader's colors, blanks as an underlined space with the hint after it
    in brackets (a word processor can't stack it beneath), footnotes after
    each passage, and the notice with the addresses. The codes are left out.
  - **A sheet's own page counts as scripture for the announcement slot**,
    as /desk does, so the app announcement never opens over a sheet.
  - **Printing with my notes (M6) is a button**, "Print with my notes," in
    the Notebook panel's My Notes foot, with a command of the same name, on
    Study View chapters and in Read View (the whole book). Ordinary printing
    (Ctrl+P) is unchanged: text and footnotes only.
  - **It prints what was asked for, whatever the screen shows**: notes and
    highlights print even when "My notes" is off or hidden (M1), and in Read
    View even though its own highlights are off by default. Bookmarks are
    left out.
  - **On paper, a note sits beside the paragraph or poetry block holding its
    first word**, in a column to the right of the text, headed by its
    reference and the first eight words it hangs on, in the reader's note
    font. A note whose words changed prints beside its verse, saying "The
    wording has changed since I wrote this." A note with no verse on the
    page (a draft in Read View, say) goes in a closing list, "Notes that are
    not on these pages." Highlights print as their tints.
  - **Known limits**: a block with notes much taller than itself leaves a
    gap below it; only Chrome was tested, so whether Firefox and Safari
    print the highlight tints, and whether Safari allows printing after the
    notes are gathered, is still to check.

### 2026-10-19 (Phase 3h: what a sheet knows about the LIT)

- **Built** as 3h set out, with nothing added to the format: blanks (S10),
  the footnote picker with its spoiler flags (C15), the key terms box (S3)
  and the license card with the commercial check (S7), all worked out live
  from each chapter's Study View page. The mock's own case behaves as mocked:
  Romans 5:6–10 with "deviating" blanked flags note c ("Or ‘people
  characterized by deviation’…") as giving the blank away.
- **Smaller calls made in building it, for BVJ to judge on the preview**
  (recommendations, not decisions):
  - **Making a blank**: select words in the passage on the sheet and choose
    "Blank the selected words" (a part-word selection grows to the whole
    word), or press a key term's button under the passage, which blanks every
    use of that term in the passage with "traditionally sin" beneath; pressed
    again, it fills them in. A blank over a key term starts with the
    traditional hint, any other with none. Two blanks can't overlap.
  - **Each blank is listed under its passage**, in reading order, with its
    verse, a hint menu (No hint, "traditionally sin" where a term is marked,
    My own hint…) and ×. Blanked words are tinted and underlined in the
    sheet's copy of the passage, the leader's view, so the answer stays
    visible while editing.
  - **A footnote gives a blank away** when it shares a word with the blank,
    compared by stem (so "deviation" gives away "deviating"), ignoring words
    under four letters and common ones. It errs toward flagging, since a flag
    only asks the leader to decide, and it checks every blank on the sheet,
    not only its own passage's.
  - **Which footnotes belong to a passage**: those whose letter falls inside
    the passage's words, so a passage starting mid-verse leaves out a note
    on the words before it. The picker is a collapsed line under each
    passage, "Footnotes: 3 of 4 print · 1 would give a blank away", with
    each note's letter, verse and full text.
  - **The key terms box lists every passage's terms**, in the order the sheet
    first uses them, each as "deviating, traditionally sin, *hamartia*" with
    a Glossary link; unticking leaves a term out (`omit`). The glossary's own
    disambiguator is dropped ("Good [2]" prints as "good"). A blanked term
    stays listed; how the participant's copy shows it is 3i's.
  - **The license card sits at the foot of every sheet**, not beside it (a
    pane has no room for side cards): the credit line, "Read the license
    terms", and the commercial box. Its links open in a new tab, so the desk
    stays put.
  - **The commercial check counts the copy everyone gets**: the LIT's words
    (passages less their blanks, the footnotes that print, the key terms box)
    against the reader's own (title, subtitle, text and questions), leaving
    out Leader only parts and answers, with a thin bar marking 50%. It also
    says when the passages quote a whole book, when footnotes are set not to
    print, and when the sheet has blanks, quoting the terms' own wording for
    each ("quoted as written, with footnotes kept with the verses they
    reference"). It warns; it never stops the leader.
  - **A passage on a sheet now keeps its first verse number** when it starts
    on a verse; 3f's copy of the text dropped it.

### 2026-10-19 (Phase 3g: the reader's marks on /desk)

- **Built**: the parts of 3g that don't depend on where a note sits. The
  LIT pane's "My Notebook" row now offers Highlight, as Study View's does;
  the reader's highlights are drawn on the pane (in every LIT pane showing
  the chapter, so two panes on John 3 both show them) and each verse number's
  name says what it carries ("Verse 16, highlighted yellow, 1 note of
  mine"). Pin and Unpin are on the LIT pane's footnote popover, in This
  verse, and under each note in the Footnotes pane, where a pinned note that
  was rewritten gets the same flag as in Study View's Footnotes list.
- **Mocked for BVJ**: where a note sits beside a pane's text, as "LIT Pane
  Notes" (https://claude.ai/artifact/R4RKSvzQi2vaHPMKPjvGEs, private), John
  3 with made-up notes, a bookmark, two highlights and a changed-wording
  flag, and a slider for the pane's width:
  - **A. A margin inside the pane**: Study View's margin and its rules,
    applied to the pane's width (notes in full, then circles, then none);
  - **B. Circles in a slim gutter**: the text keeps nearly the whole width,
    and each note opens in a popover;
  - **C. The notes pane is the margin**: no notes in the LIT pane; a My
    Notes pane beside it lines its cards up with their words as the text
    scrolls.
  The website recommended A. **BVJ chose none of the three as mocked**: "Desk
  doesn't need to replicate the margin notes. C is the closest, but there's
  no reason to have them spaced to be perfectly beside the text. It should
  just be how the My Notes pane already worked, just making sure that it
  follows in the sense that my notes that are on the section I'm looking at
  in the text are visible, but it doesn't have to align perfectly with the
  verse."
- **Built from that**: My Notes is now a pane that follows the LIT pane (with
  Stay here, like the other following panes). Its list is unchanged; as the
  reader moves through the text it scrolls, only when needed, so the first
  record on the passage being read (or the chapter's last, when none come
  after) is in view. A record's reference or words move the LIT pane being
  read to it, rather than leaving /desk for Study View.
- **Smaller calls made in building it, for BVJ to judge on the preview**
  (recommendations, not decisions):
  - **Highlights on /desk follow Study View's "My highlights" setting**,
    since the pane is Study View's text; Read View keeps its own.
  - **A highlight made in one LIT pane is drawn in every pane showing that
    chapter**, and a selection is read from the pane it was made in.
  - **"Show in notebook" stays off the LIT pane's menus**: This verse is the
    pane that shows a verse.
  - **Nothing of the reader's sits beside the LIT pane's text**, bookmarks'
    red marks and a changed highlight's flag included, since BVJ's answer
    puts notes in My Notes and those marks are margin marks on Study View.
    A bookmark is in My Notes' list; a changed highlight carries its flag
    there, and the verse number's name counts it ("1 changed since I marked
    it").
  - **My Notes follows by the verse at the LIT pane's reading line**, the
    passage the other following panes use, and leaves the list alone while
    the reader is in a chapter with nothing kept.

### 2026-10-19 (Phase 3f: the verse menu in the LIT pane, and the sheet editor)

- **Built** as 3f set out: Study View's verse menu and selection panel in
  the LIT pane, then the sheet editor as the Sheet pane, with passages from
  the live text (format rule 1), the reader's own text between, dragging
  into order, and saving as the reader goes.
- **Smaller calls made in building it, for BVJ to judge on the preview**
  (recommendations, not decisions):
  - **The LIT pane's verse numbers look and work as Study View's do**, and
    each menu names its own chapter ("Matthew 1:1–3"); a verse number in
    another chapter starts a new menu rather than extending the range. Copy
    link and the copies' links go to the verse in Study View, as Read View's
    do, and "Copy with footnotes" reads the notes from the chapter's page.
  - **The "My Notebook" row in the pane offers Add a note, Bookmark and
    Ribbon here…, but not Highlight or Show in notebook**: a highlight made
    there couldn't be seen until 3g draws the marks, and This verse is the
    pane that shows a verse. A note or bookmark made there shows in My
    Notes and This verse.
  - **"Add to sheet" is its own row, "Sheet", in the LIT pane's menus**,
    shown only while a Sheet pane has a sheet open, and naming that sheet
    ("Add to “Freedom and the Life-breath”"). With two Sheet panes open it
    adds to the one last worked in. A selection that covers whole verses is
    added as those verses, with no quote; one that starts or ends inside a
    verse keeps the quote, as the format says.
  - **A Sheet pane opens on a list, "My sheets"**, with New sheet, each
    sheet's subtitle, its number of passages and when it last changed, and
    Delete (undoable). The pane remembers which sheet it shows. A new sheet
    is the blank template, one empty text block, and its title field takes
    the cursor; templates are 3k's.
  - **Each part of a sheet is a card** headed with what it is (a passage's
    reference), a grip to drag it, Leader only, Move up, Move down and
    Remove (undoable). New parts go at the end: "+ Passage", "+ Your text",
    "+ Question", "+ Space" and "+ Page break". The key terms box is not
    offered yet (3h), and a sheet holding one shows a line saying so.
  - **"+ Passage" opens a small form**: a reference typed as the search box
    reads one (a whole chapter when no verse is given), and "From my
    notebook", the latest 40 notes, highlights and bookmarks, each added as
    its passage. Adding a passage already on the sheet adds it again and
    says so, rather than refusing.
  - **A passage shows its words from today's text**, set apart by a green
    rule with plain verse numbers and no footnote letters (which footnotes
    print is 3h's), and "Show in the LIT" moves the LIT pane being read
    there. When the words a quote started or ended on have changed, it shows
    the closest match and says so; when the verses are gone, it says that.
  - **The formatting toolbar** has a block menu (Paragraph, Heading,
    Subheading, Quotation), bold, italic, underline, strikethrough,
    superscript, subscript, link, bulleted and numbered lists with indent and
    outdent, alignment, a Style menu for the named fonts, sizes, colors and
    backgrounds (each previewed in its own style), a line, and Clear
    formatting. A style needs words selected. Pasted text is sanitized to the
    sheet's set.
  - **Saving**: every change is saved at once, typing and the title a
    moment after they pause, with "Saving…" and "Saved" at the top. Ctrl+Z
    inside a text is the browser's own; outside, it undoes the sheet's last
    saved change, as for every record. The colors, alignment and line are
    made outside the browser's editing commands, so its Ctrl+Z steps over
    them.

### 2026-10-19 (Phase 3e: the LIT and Footnotes panes on /desk)

- **Built** as 3a settled it: the LIT pane scrolls Matthew 1 to
  Revelation 22 with no setting, each chapter Study View's own text,
  fetched as the reader nears it; a run of drafts in one book is one stub
  (Acts and Revelation today); a chapter loading above doesn't move the
  line being read. Footnote letters open their own chapter's note, key
  terms are underlined as in Study View, and a reference in a note
  previews. The Footnotes pane follows the LIT pane. With a LIT pane open,
  This verse, Greek and Footnotes follow the one last worked in (D9,
  "Phase 3a's answers", 6), and each LIT pane keeps its own place in the
  layout, so two show two passages.
- **Smaller calls made in building it, for BVJ to judge on the preview**
  (recommendations, not decisions):
  - **The LIT pane has the passage picker at its top**, the same as the
    following panes', which also shows where the reader is as they scroll.
    Each chapter's heading links to it in Study View.
  - **Where the reader is** is the last verse number above a line a
    quarter of the way down the pane. A passage the reader asks for is put
    just above that line, and a chapter at the top.
  - **The following panes keep their picker while they follow, and it
    leads back**: changing it, This verse's Previous and Next, a footnote's
    "Verse 16" button, or scrolling the Greek move the leading LIT pane,
    which moves every pane following it. Pinned, the picker moves only its
    pane, as in 3d. D9 says Stay here "gives it its own passage picker",
    which could mean following panes have none; keeping it seemed the
    smaller change, and the Greek already leads back.
  - **The footnote popover is headed "John 3:16, footnote a"**, since
    letters start again every chapter and several chapters share the pane.
    It has no "See in footnotes" link; the Footnotes pane is that list.
  - **The Footnotes pane lists the whole chapter's notes**, each with its
    letter and a "Verse 16" button, and marks the notes on the reader's
    verse and brings them to the top of the pane (or the next notes after
    it, when that verse has none).
  - **A draft stub says the Greek is ready in a Greek pane**, as This
    verse does for a draft.
  - **Not in the LIT pane yet**: the verse menu, the selection panel, and
    the reader's highlights, notes and bookmarks, so its verse numbers are
    plain text rather than buttons. 3f's "add passages from the verse menu
    or a selection" needs the first two there. **No Pin on footnotes on
    /desk yet** either, in This verse or Footnotes. **Placed by BVJ the
    same day**: the verse menu and selection panel open 3f, and the marks
    and pinned footnotes are a new part, 3g, before what a sheet knows
    about the LIT (so 3g to 3k became 3h to 3l).
  - **Chapters stay loaded for the visit** once scrolled to; going to a
    passage outside the loaded run starts the pane again there.

### 2026-10-19 (Phase 3d: the existing panes on /desk)

- **How a following pane picks its passage until 3e** (BVJ chose option
  A): the panes that aren't pinned share one passage, kept in the layout as
  `place` (in `lit-desk-layout`, so no new key; /privacy's paragraph now
  says the key holds it). It is changed from any of them: the picker at
  their top (a typed reference, read as the search box reads one, or the
  previous or next chapter across the books), This verse's Previous and
  Next, or scrolling the Greek. "Stay here" keeps the passage the pane
  shows as its own (`pin.at`), which only it then moves; letting go
  rejoins the shared one. It starts at the reader's Continue reading
  place, or Matthew 1. Option B was every pane on its own until 3e. BVJ
  plans 3e very soon.
- **Built**: This verse, Greek, and What I've kept as panes, mounted from the
  Notebook's own modules; "This chapter" at the foot of This verse.
- **Smaller calls made in building it, for BVJ to judge on the preview**
  (recommendations, not decisions):
  - **"The notebook's lists" is one pane, "What I've kept"**: the notebook
    page's filtered list of everything kept, moved into a module both
    share. Places, labels, What's new, and the rest stay on `/notebook/`.
    It is a new kind at the end of the Show menu's list.
  - **"This chapter" holds the Go deeper rows and a link to the chapter in
    Study View.** Its links are Study View's, so a link to another page of
    the site leaves /desk in the same tab (the layout is kept, so coming
    back restores it). A chapter with no Go deeper shows only the link.
  - **No Pin buttons on This verse's footnotes on /desk yet.** Pinning
    reads the page's own footnote list; the footnotes pane (3e) is the
    natural home.
  - **Only the reader's own scrolling of the Greek moves the passage.**
    Opening at a verse, being moved to one, or a verse near the chapter's
    end that can't reach the top don't, so the panes never chase each
    other and picking John 3:36 stays John 3:36.
  - **A draft chapter's This verse says it is still being translated**,
    and points to the Greek, which works on drafts as in the Notebook.
  - **A word in This verse's Greek opens in a Greek pane on that chapter**;
    with none open, it says so rather than opening one.
  - **A Greek search result in another chapter moves the Greek pane
    there**, selecting the word, instead of leaving /desk for Study View.

### 2026-10-19 (Phase 3c: /desk's frame)

- **Built on the preview** as 3a settled it: the Layout menu with every
  arrangement but four rows, each grayed out with its reason ("Needs a
  wider window") when a pane couldn't have 280 by 160; dragging a pane by
  its header to an edge of another; lines between panes that move by
  pointer or arrow keys (double-click shares the room evenly); several
  panes of a kind; the active LIT pane; Stay here; "My last layout" or "My
  default", "Make this my default" and "Reset to the original layout",
  kept in `localStorage['lit-desk-layout']`. My Notes is the one pane
  that draws.
- **Smaller calls made in building it, for BVJ to judge on the preview**
  (recommendations, not decisions):
  - **Dragging can make a shape the menu doesn't list**, four rows among
    them, as long as every pane keeps its minimum. The menu leaves four
    rows out; refusing it on a drop as well seemed stricter than BVJ meant.
  - **Two by two fills down each column**: the LIT and My Notes on the
    left, This verse and Greek on the right.
  - **A new slot gets the first kind not yet open**, in the order the LIT,
    My Notes, This verse, Greek, Footnotes, and Sheet; each pane's name is a
    menu for showing another kind, which is also the keyboard's way to
    put anything anywhere.
  - **"Leading" shows on the active LIT pane only while two or more are
    open**, since with one there is nothing to tell apart.
  - **Stay here has no passage picker yet.** Following has nothing to
    carry until This verse, Greek, and the LIT pane are real (3d, 3e); the
    pin is kept in the layout already.
  - **The page fills the window and hides the footer**, so each pane
    scrolls on its own, and **the app announcement never opens on it**,
    since its panes hold the text.

### 2026-10-18 (Phase 3 split into parts)

- **Phase 3 is split into 3a to 3k** ("Order of work", 3), to be worked one
  at a time: mockups and open decisions, the sheet format, the /desk shell,
  the existing panes, the LIT and footnotes panes, the sheet editor, what a
  sheet knows about the LIT, paper and copies, present mode, getting
  started and sharing, and D4. **A proposal, not a decision**: the split
  and the order are for BVJ to confirm. It changes no scope; every item in
  phase 3 is still in phase 3.
- **Recommended first part: 3a**, since its four open questions decide 3c
  to 3e.

### 2026-10-16 (Phase 5: fixes and experience)

BVJ asked for a section for bug fixes and user-experience input, including
their own use of the desk, then suggested making it Phase 5. **Done:** it is
phase 5 in "Order of work", with its log under "Fixes and experience" (IDs
E1 onward). Phase 4 is sync, so 5 is the next free number. The number is
about the log's place in the plan, not its timing: fixes are made when
found, so nothing waits for phases 3 and 4. Recommended reading, for BVJ to
confirm: if the intent was that fixes should wait until after sync, say so
and this changes.

### 2026-10-14 (phase 2 split into 2a, 2b and 2c)

- **Phase 2 is split three ways** ("Order of work", 2). **2a** is the
  read-only pieces: B3 (what's new for you), N4 (your own chains), M10
  (your notebook where you already look), construction search and
  searching by parsing. **2b** is S2 (text checked before printing).
  **2c** is the rest: N2, H2 with C23, M4 and M11. Construction search
  and searching by parsing were first put in 2c, then moved to 2a the same
  day (BVJ).
- **Phase 3 (sheets) comes right after 2a.** S2 needs a sheet, so 2b
  follows phase 3. Where 2c goes is not decided.
- **Why the split:** 2a reads only what the notebook and site already hold
  and writes no new kind of record, so a piece readers ignore costs little
  to keep or remove. 2c's N2, H2 and M11 add kinds of record to readers'
  notebooks (H2's `markRule` is already in the format), and a kind readers
  hold can't be withdrawn without migrating their data. 2c also has the
  pieces whose worth depends most on how readers use the desk, which a small
  group of trusted readers given `?desk=on` could show ("Still open",
  "When to release the desk to readers").

## Full Audit 1 (10/20/2026)

The first full audit of the built preview, and its plan, are in
**`STUDY-DESK-AUDIT-1.md`**: every finding (BA1 to BA87) with its fix, how
to work a phase on a Pro account, what held up and what wasn't covered.
That file keeps each finding's status; this one keeps the decisions
("Decisions", 2026-10-20, "Full Audit 1"). **BA32 is declined** (BVJ:
the tour offer may open over scripture). FA1-u and FA1-v are the next
audit, finding rather than fixing; what they find continues as BA88 onward.
The phases, in working order:

| Phase | Area | Findings |
|---|---|---|
| FA1-a | Security: the stored script and the sanitizer | BA66, BA67, BA59 |
| FA1-b | Markdown copies | BA1, BA2, BA41, BA9, BA10 |
| FA1-c | Merging and opening a copy | BA3, BA4, BA11, BA12 |
| FA1-d | The store, the note editor, and undo | BA5, BA13, BA6, BA7 |
| FA1-e | /desk keeps the reader's place | BA51, BA52, BA53, BA55 |
| FA1-f | The record format, for BDR | BA8, BA14 |
| FA1-u | The follow-up audit: code this audit didn't reach | done: BA88 to BA145 |
| FA1-ab | Sheets in two tabs, and large sheets | BA128 to BA133 |
| FA1-g | Sharing a sheet | done, #379: BA78, BA80, BA81, BA82, BA87 |
| FA1-h | Marks on the page | done, #380: BA16, BA17, BA19, BA20, BA23 |
| FA1-i | Sheet templates and passages | done, #381: BA69, BA70, BA75, BA76, BA77, BA127 |
| FA1-j | The sheet editor: pasting and saving | done, #382: BA68, BA71, BA72, BA73, BA74 |
| FA1-k | Greek search commands | done, #383: BA44, BA45, BA48, BA49, BA50, BA116 |
| FA1-l | /desk's LIT pane and layout | done, #387: BA54, BA56, BA57, BA58, BA60, BA61 |
| FA1-m | The tour, first use, and printing | done, #388: BA33, BA34, BA35, BA36, BA37 |
| FA1-n | Present mode and the sheet page | done, #390: BA79, BA83, BA84, BA85, BA86 |
| FA1-o | Announcements and focus for marks | done, #391: BA18, BA21, BA22 |
| FA1-p | Panels beside the Notebook | done, #392: BA24, BA27, BA28 |
| FA1-q | The gate and first paint | done, #396: BA25, BA26, BA29, BA30 |
| FA1-r | /desk's smaller fixes | done, #398: BA31, BA62, BA63, BA64, BA65, BA114, BA115 |
| FA1-s | Greek credits and the notebook search | done, #PR: BA40, BA46, BA47 |
| FA1-t | Copy and docs | BA15, BA38, BA39, BA42, BA43, BA91, BA109, BA118 |
| FA1-w | What's new for you | BA88, BA90, BA92, BA96, BA97, BA98 |
| FA1-x | A note's references | BA89, BA93, BA94, BA95 |
| FA1-y | Ribbons and Continue reading | BA99 to BA108 |
| FA1-z | The Greek tab | BA110, BA111, BA112, BA113, BA117, BA119, BA120 |
| FA1-aa | /desk's panes and the shared modules | BA121 to BA126 |
| FA1-ac | The copy pass | BA134 to BA139 |
| FA1-ad | The stylesheet: focus, forced colors, contrast, and print | BA140 to BA145 |
| FA1-v | The follow-up audit: real devices | new |

FA1-f should land before the record format is frozen for the apps, and
FA1-s before Greek search launches. FA1-v needs BVJ's own computers (or a
session working on one), since a cloud session has only Chromium.

## Fixes and experience

Phase 5's log ("Order of work", 5; BVJ, 2026-10-16): bugs in what is built,
and what using it feels like, starting with BVJ's own use of the preview.
Ideas and decisions stay in their sections; this is for things that are
wrong or awkward in what already exists.

**How to add an entry.** Give it the next **E** number (never renumbered or
reused; keep IDs stable like every other ID here). One line says what
happened, then only what helps: where (page, view, tab), what BVJ was doing,
what was expected, the browser if it matters. Note who reported it.
**Status** is one of: *open*; *fixed* (with the commit or PR); *moved* (it
was really a feature, with where it went); *won't fix* (with why, so it
isn't reported again). Don't delete an entry when it's settled. Where a
bug sits in code that a decision here describes, link that decision.

**Kinds.** *Bug* (does the wrong thing), *rough* (works but is awkward,
confusing or slow), *wording* (copy, labels, help), *wish* (the first
sign of a feature: log it, and move it when it's clear where it belongs).

**Open**

- **E1, bug: a possible flash on load from N8's pre-paint addition to
  Layout.astro.** Known when N8 was built and held (2026-10-12; "Still
  open"). Lives on `claude/desk-1d-hidden`, not in this tree. Open, and
  waits on N8's hold.
- **E2, bug: a hidden verse's own menu is unreachable.** Same source and
  hold as E1. Open.

**BVJ's use of the preview** (add as they come)

- **E4, rough: revisit Places.** BVJ (2026-10-16), from using the preview:
  "underwhelmed. It needs work." Open, and the first item the phase takes up.
  The specifics aren't recorded yet; add them here as BVJ names them. What
  exists to rework (B1, built in 1d; "Order of work", 1d, Places and
  ribbons): a Places section in My Notes and on the notebook page, listing
  this book's places, "Continue reading", ribbons (at most 6, following
  while you read from one, C25), other clients' places, then Read View's.
  "Continue reading" and Read View's places are not notebook records.
  B4's scrollbar ticks and a margin mark for ribbons were not built.
  BVJ is not taking it up yet (2026-10-16); it is here so it stays in the
  plan. **Taken up on 2026-10-22 as E9** (BVJ named the trouble: two
  features for one idea, and a Places section that lists places the reader
  never made). E9 holds the answer; the questions below stay as the
  record of what was weighed. **Questions to ask when it is picked up**,
  as prompts and not findings:
  - Is the trouble **finding and seeing** places: where the list sits, how
    it is ordered, or that nothing marks a place on the page itself (the
    unbuilt ribbon mark and B4's ticks)?
  - Is it **what a ribbon does by itself**: following while you read from
    it, the 4-second move, or that creating one doesn't start it following?
  - Is it **how little it does** beyond "Continue reading"?
  - Is it **two kinds of place** (ribbons as notebook records, "Continue
    reading" and Read View's in their own storage) showing as one list?
  - Is it **making one**: "Ribbon here…" being in the verse menu and
    selection panel, the 6-ribbon limit, the naming?
  - The answer may send part of it to B4, or to sync's open question on
    whether places sync (BVJ leans against).
- **E5, rough: the Greek search commands window isn't intuitive.** BVJ
  (2026-10-16): it "mostly works but it doesn't feel intuitive." Open.
  **What's wrong** (BVJ, the same day): not the commands themselves, but
  **putting a search together**, and **understanding how the window
  interacts with the search bar**. **What to try** (BVJ): a menu-based
  builder, to see whether it is better, when the work is taken up. A
  direction to try with a mock, not a decision. What exists (2a, Greek
  search commands; CLAUDE.md, the desk's rule 17): the commands window
  (`src/scripts/greek-commands.js`) is the one place for instructions and
  examples, opened by "Search commands"; it lists `COMMANDS` and
  `EXAMPLES` from `src/lib/greek-query.mjs`, and clicking one inserts it
  into the search field. The page itself shows only the readback and, for
  an empty search, examples. **Questions for the mock**, as prompts and
  not findings:
  - **Where the builder lives.** Inside the commands window keeps the
    one-window rule and adds nothing to the search pages ("quiet
    controls"); on the search page beside the field would be easier to
    find but is the kind of control those rules weigh against.
  - **How it relates to the field.** Does the builder write the typed
    command as you choose (so you learn the notation by watching it), or
    keep its own state with the field showing only the result? Either
    way, the field and the builder should never disagree about what is
    being searched, which is the interaction that is unclear today.
  - **What the menus offer.** A word (with its lemma shown), then part
    of speech, case, tense and so on, each listing only what that word
    actually has (which also answers E6's "a noun has no verb forms"),
    and a way to add a second word for a construction.
  - **The same builder in all three places**: the tray, /search and the
    Greek tab, since `searchGreekAuto` is already one search behind them.
- **E6, wish: search a word family, not just one lemma.** BVJ
  (2026-10-16): `hamartia.noun/verb` finds no verbs, `hamartano.noun/verb`
  no nouns, and `hamartia.adj` no ἁμαρτωλός. Checked against the committed
  index the same day: **working as built, but not as a reader expects.**
  Each word in a query resolves to one lemma (hamartia → ἁμαρτία, hamartano
  → ἁμαρτάνω; `resolveGreekQuery`), and a part-of-speech filter only
  narrows that lemma's own forms, so `.verb` on a noun lemma can never
  match. Nothing in the search knows that ἁμαρτία, ἁμαρτάνω, ἁμάρτημα and
  ἁμαρτωλός are one family, and a Greek stem (ἁμαρτ) comes back "unknown."
  Open. Two things to settle when it is taken up:
  - **Where the families come from.** Stems or prefix matching would be
    wrong often (ἁμαρτ- is clean; many roots aren't, and compounds hide
    them). A source that groups lemmas by root is better, if one of the
    sources `build:greek` already reads carries it, or another with a
    license that fits `public/greek/` (rule 14). Not yet checked.
  - **How a reader asks for it.** A family command (something like
    `hamartia.family` or a "related words" choice), versus making a
    part-of-speech filter widen to the family by itself, which would
    change what `hamartia.noun` means today. Meanwhile, a filter that
    rules out every form of the lemma could say so ("ἁμαρτία is a noun;
    it has no verb forms") instead of returning nothing; whether it does
    today wasn't checked.
- **E7, rough: is searching too much for the Notebook's Greek tab?** BVJ
  (2026-10-16), thinking aloud and not a decision: the site's search bar
  could keep doing what it does with the Greek, and focused Greek
  searching could be designed for /desk's Greek pane (D9), which happens
  either way. **The Phase 5 question is only whether to take searching out
  of the Notebook's Greek tab.** Open. What is there today (1h, "The Greek
  tab searches too"; `desk/greek-find.js`): a search button in the tab's
  header opens a field in place, results replace the text until "Back to
  the text," and in a word's details the form, the lemma and the Strong's
  number each start a search. The field also opens the commands window.
  The choices, as prompts:
  - **Keep it as it is.**
  - **Take out the typed search, keep the word links**: a word's form,
    lemma or Strong's number still shows where else it occurs, which
    starts from what the reader is looking at and needs no typing or
    builder. Where those results show (in the tab, or on /search) is part
    of the choice.
  - **Take out both**, leaving the tab for reading the Greek, and send
    every Greek search to the search bar.
  - Either removal also touches the tour's `greek-commands` step (it
    demonstrates the commands in the tab's field), the help page's
    paragraph on searching the Greek, the tab's half of the commands
    window's open-and-close rule, and the desk's rule 15 in CLAUDE.md.
    E5's builder would then live in the search bar's commands window
    until /desk.
- **E8, rough: there is no way into /desk, and Read View retires at
  launch.** BVJ (2026-10-21): no button or link reaches /desk, and
  switching between Study View and Read View was always clunky. **Decided**
  (BVJ, 2026-10-21; decision log, "Read View retires at launch"): **Read
  View is removed when the desk launches**, with no trial period after, and
  on a computer Study View's "Read View" button becomes the way into the
  desk, whose LIT pane already scrolls the whole New Testament. Phones
  aren't a reason to keep it: BVJ expects people who read on a phone to
  install the apps, which already scroll. Open: decided, to build.
  **Before launch:**
  - **A Reading arrangement** in /desk's Layout menu: one LIT pane at the
    reading width, honoring the Display tray's verse numbers, footnote
    letters, key terms and highlights switches (`data-vn`, `data-fn`,
    `data-terms`). /desk isn't a reading surface today, so check which of
    them it honors.
  - **A way in that carries the passage** (for example
    `/desk/?place=romans-8`), which moves the active LIT pane there and
    never overwrites the reader's saved layout (`lit-desk-layout`); a first
    visit opens the Reading arrangement. A reader who wants to read must
    not land in a four-pane workspace, the first-use card and the tour
    offer.
  - **Other ways in**, to mock: the Notebook panel's foot, the notebook
    page, a header item on a computer.
  **At launch:**
  - **Redirects**: `/read/<book>` to `/<book>-1/`, with a small script
    sending `#ch-N` to `/<book>-N/` and `#<book>-N-vV` to `/<book>-N/#vV`;
    the pages leave the sitemap. Search results that link Read View
    anchors link Study View instead.
  - **Saved places**: "Continue reading" records with `view: "read"` are
    read as Study View places, not dropped; Read View's per-book places
    are carried into Places or let go (to decide).
  - **Copy**: the `/read` landing page (which offers Study View, Read View
    and the apps), the /about FAQ, `/apps` if it names Read View,
    /privacy's storage paragraph (`lit_rm_*`, `lit-read-numbers`), the
    notebook help page and the tour.
  - **Code that goes**: `read/[book].astro`, `read-mode.js` and
    `landOnHash`, `read-mode.css`, Read View's half of `chapter-tools.js`,
    ReadMenu's `mode="read"`, the Display tray's Read View verse-numbers
    setting and its fallbacks, the desk's Read View pieces (bookmarks via
    `read-marks.js`, its "My highlights", printing with notes or room to
    write there), and the whole-book print layout.
  - **Docs**: CLAUDE.md (routing, Key Conventions, print, the Study View
    and Read View rule, the desk's rules) and README.
  - **Tag the last commit with Read View** before removing it, as the way
    back.
  **Open, for BVJ:**
  - **The whole-book browser tools.** Ctrl+F across a book, Edge's Read
    Aloud, page translation and printing a whole book need the book on one
    page, and the LIT pane loads chapters as the reader nears them. Offer a
    "load the whole book" choice in the Reading arrangement, or let them go.
  - **The button's label.** "Study Desk" says study; the button now also
    serves the reader who wants to read straight through.
- **E9, rough: Bookmarks and Ribbons are confusing and redundant, and
  Places adds a third layer.** BVJ (2026-10-22), from using the preview.
  **Decided** (BVJ, 2026-10-22; decision log, "Bookmarks and ribbons become
  one"); open to build. It takes up E4. **What exists**: a *bookmark* (B2,
  built in 1c; a `bookmark` record, a verse and an optional label, drawn as
  a red bookmark glyph in the notes' margin) and a *ribbon* (B1, built in
  1d; a `place` record with `ribbon: true`: named, at most 6, moves while
  the reader reads from it, C25), plus a **Places** section in My Notes and
  on the notebook page that lists this book's places, "Continue reading",
  the ribbons, other clients' places and Read View's per-book places. The
  reader meets three words for one idea, and a list that opens with
  entries nobody made.
  **The decision, in BVJ's words, tidied:**
  - **One feature, called Bookmarks**, with **the functionality of
    Ribbons**. The red bookmark glyph, already the mark on the page, is the
    one visual cue, and it is never called a "ribbon". The word "ribbon" is retired from everything a
    reader sees (the verse menu's "Ribbon here…", the Places list, the
    tour's "A ribbon for a reading" step, the help page, the commands).
  - **No Places section, and no default locations.** The notebook's list
    (My Notes, the notebook page) holds **"Continue reading"** first, the
    one place that is always there, and **it gets no red bookmark glyph**
    (it is where the reader stopped, not something they marked), and then
    **only the bookmarks the reader has added**, appearing as they are
    added. Nothing else is listed to begin with: not the book's other
    places, not other clients' places, and not Read View's per-book places
    (which answers E8's open "carried into Places or let go": let go,
    since Read View goes at launch and the reader never made them).
  **What building it involves**, as prompts for the mock and not yet
  findings:
  - **Making one.** The verse menu and selection panel keep one action,
    "Bookmark", where today there are "Bookmark" and "Ribbon here…". It
    can be named at once or later. The 6-ribbon limit and the 40-character
    names stay unless BVJ says otherwise; bookmark labels are optional and
    not unique today while ribbon names are unique ignoring case, so one
    rule has to be chosen.
  - **Following.** The ribbon's behavior (C25: following its link makes it
    follow the reader through the book, moved at most every 4 seconds)
    becomes a bookmark's. **Claude's recommendation, for BVJ to confirm**:
    a bookmark stays on its verse unless the reader turns on "Move as I
    read" for it, so that someone who marks John 3:16 to find it again
    isn't surprised, while a "Thursday group" bookmark does what a ribbon
    did. Read as "the functionality of Ribbons" with no switch, every
    bookmark would move once opened, and a plain mark-this-verse bookmark
    would no longer exist.
  - **The mark on the page.** The margin mark B1 never got is the same
    red bookmark glyph; B4's scrollbar ticks (Read View, retiring) are moot.
  - **The record.** One kind where there are two: `bookmark` gains the
    ribbon's name and following flag, and `place` with `ribbon: true`
    retires (`STUDY-DESK-FORMAT.md`, kinds 4 and 5). Preview notebooks that
    hold ribbons are converted on open, and the export file's places
    section, the merge rules and `merge-vectors.json` change with it.
  - **Copy and code.** `desk-places.mjs`, `desk/places.js`,
    `ribbon-follow.js` and `ribbon-form.js` become bookmark code; the
    `lit-desk-ribbon` session key is renamed; the tour, the help page, the
    commands, /privacy's paragraph and CLAUDE.md (the desk's rules 7 and
    13) change.
  **For BDR's Claude: please notice.** This changes what syncs. The apps
  are building "full bookmarks and named ribbons" (R4, in the first synced
  release); that would now be one feature, bookmarks, and ribbons need not
  be built as a separate kind. Whether a reading place syncs at all stays
  open (kind 5's open question); if it does, "Continue reading" is the
  only place, one per book, and no named place exists. The website will
  update the format draft and the merge vectors when it builds this and
  will say so here. ~~Raise any objection here before the apps build ribbons.~~
  **Accepted by BDR, 2026-10-23**: the apps build one kind, Bookmarks.
- **E10: the `bookmark` note marker clashes with Bookmarks, so rename it
  or retire it. Decided by BDR, 2026-10-23: renamed `ribbon`.** BVJ (2026-10-22): leave it
  for now, and **strongly recommend** one of the two. One of the seven
  note markers (`note`, `emphasis`, `question`, `heart`, `bookmark`,
  `lightbulb`, `flame`) is named `bookmark` and drawn with a bookmark
  glyph, and with E9 that word and picture now belong to the feature, so a
  reader choosing a marker for a note could think it creates a bookmark.
  Not changed: the marker is in both apps and in the shared format
  (`STUDY-DESK-FORMAT.md`, kind 1's `marker`), so either way is a format
  change for BDR's Claude to agree. Precedent for both: iOS already reads
  an old `star` as `emphasis`, so the apps can read an old value and write
  a new one.
  - **Rename it `ribbon`** (BVJ's first suggestion, and BVJ's answer on
    2026-10-22 once the picture was raised). Keeps seven markers and every
    existing note's marker, and **the picture stays the same**: the
    marker's color already differs from the red bookmark glyph, and
    "ribbon" describes what the marker looks like. The red glyph is never
    called a "ribbon" (BVJ, 2026-10-22), so the word belongs to the marker
    alone. Cost: both apps read an old `bookmark` marker as `ribbon` and
    write the new name.
  - **Retire it** (BVJ's other option, 2026-10-22). Six markers remain,
    and nothing shaped like a bookmark is left on a note. Cost: notes
    already marked `bookmark` need somewhere to go, most simply the plain
    `note` marker (the way `star` becomes `emphasis`), which loses a
    reader's choice of picture on those notes, and both apps must stop
    offering it.
  **Claude's recommendation, for BVJ and BDR to decide: rename it.** It
  was to retire it, on the worry that a ribbon-shaped marker would look
  like the bookmark glyph; BVJ's point that the color differs, and that
  the name fits the picture, settles that, and renaming keeps every
  existing note's choice. **BDR, 2026-10-23: rename it.** The format's
  marker list now says `ribbon` (`STUDY-DESK-FORMAT.md`, kind 2); each app
  reads an old `bookmark` as `ribbon` and writes `ribbon` (iOS NB12,
  Android NB12, both small). **The website followed on 2026-10-27, ahead
  of E9** (PR #385): its marker picker says "Ribbon", and it reads an old
  `bookmark` as `ribbon` and writes `ribbon` (see the 2026-10-27 entry
  under "Decisions").

**Fixed**

- **E3, bug: My Notes and Places overwrote each other's list** in the
  Notebook. Fixed in 2dbab04 (2026-10-15).

## Still open

- ~~**Phase 3a's smaller calls**~~: **all four decided** (BVJ, 2026-10-18;
  recommended in the mockups the same day; they shape 3c). **Three are
  agreed as recommended**: a pane needs at
  least 280px across and 160px high, so an arrangement that can't fit the
  window is grayed out in the Layout menu ("Needs a wider window",
  "taller" or "larger"); the original layout is the LIT text beside My
  Notes, 60/40, which "Reset to the original layout" returns to; and the
  layout is kept in this browser (a `localStorage` key, named in
  /privacy), as the Display settings are, rather than synced.
  **The fourth is decided too: B** (BVJ, 2026-10-18, after asking for
  more detail; D9, "Phase 3a's answers", 6). The mockup's recommendation
  was one of each. BVJ wasn't sure: there's reason to want
  more than one LIT text, Greek or sheet pane, but it gets tricky when
  panes respond to each other (This verse following the LIT text, the
  Greek and the LIT tracking each other). The options weighed:
  - **A. One of each.** Simplest; nothing is ever ambiguous about what
    follows what.
  - **B. Several of a kind, and the following panes follow the LIT pane
    you last worked in** (scrolled, clicked or typed in), marked in its
    header, with a "Stay here" pin on each following pane (This verse,
    Greek, Footnotes) that stops it following. Two sheets follow nothing,
    so they need no rule.
  - **C. Link groups**, as Logos and Accordance do: each pane carries a
    link color, panes of one color follow each other, and an unlinked pane
    stays put. The most flexible, and the most to learn.
  **Chosen: B.** It allows comparing two passages or keeping two sheets
  open, with one rule a reader can see, and C could still be added later
  if B proves too blunt (B is C with the group picked for the reader).
- ~~**What "the full rich-text formatting options" include**~~: **decided**
  (BVJ, 2026-10-18; decision log, "Phase 3b"): the proposed set plus text
  alignment and named fonts, sizes and colors. Was (3b and 3f): the
  mockup's sheet offered bold, italic, headings, lists, quotations and
  links. A blank canvas for a wholly original document probably wants
  more (underline, numbered lists, indentation, perhaps tables); the set
  is settled with the format in 3b, since the sanitizer allows exactly
  what is stored.

- ~~**Phase 1d's defaults**~~: **accepted** (BVJ, 2026-10-13). (Built
  2026-10-12 on recommendations; listed per piece under "Order of work", 1d): the
  name "Labels" and applying labels from the notebook page only; the export
  file's motivations, what Markdown can and can't read back, and trash
  only in the full backup; the ribbons' limits (6, 40 characters, a move at
  most every 4 seconds) and the C25 rule's details; the search tray's counts (4 and 10), the nine
  commands and Enter's behaviour; the D6 card's wording and the reminder
  at 7 days; the tour's five steps and its being offered once.
- **N8, the hidden passage, is held** (BVJ, 2026-10-12) until after the
  Zoom. The built branches wait on that, and on two known issues: a
  possible flash on load (a pre-paint addition to Layout.astro) and a hidden
  verse's own menu being unreachable.

- ~~**The floating notebook's details**~~: **all five confirmed** (BVJ,
  2026-10-13), the third with a change to the default: the notebook now
  starts open and minimized ("Decisions", 2026-10-13, BVJ's answers). The
  five as built (decided in outline 2026-10-07; see "Order of work", 1b):
  1. **Collapsed, it is a tab at the window's right edge**: 40px wide, the
     notebook glyph with the word "Notebook" running down it, level with the
     page's heading and pinned near the top while reading. A dot or count of
     this chapter's notes could join it in 1c. Since 2026-10-09 the same
     tab is what minimizing gives in the margin (BVJ; "Order of work", 1c).
  2. **It can't be moved.** Collapsing is the way to get it off the text,
     and dragging would mean remembering a place per window size. The verse
     menu's drag (a grip in its head) could be reused if BVJ wants it.
  3. **It collapses by itself when it starts floating** (a page opening with
     it remembered open, or the window narrowed under it), so it never lands
     on the text unasked. Opened by the reader, it opens expanded.
  4. **Escape collapses it** while it floats, rather than closing it; × closes
     it.
  5. **The text moves only for the tab**, the same expanded or collapsed, so
     toggling never moves what's under it. The cost: expanded, it covers more
     of the line ends than the old card did (that moved the column as far
     left as it could).
- **The margin's remaining details** (see "Decisions", 2026-10-07 (the
  margin switch) and (the margin notes' look)). To settle in 1c:
  - ~~**The notebook's two-line toggle**~~: **"Open all" / "Close all"
    above the list, beside each note's own caret** (BVJ, 2026-10-13),
    replacing the checkbox at the panel's foot. Built.
  - ~~**Where the reader sets the notebook's default**~~: **on the notebook
    page** (BVJ, 2026-10-13). Built.
  - ~~**Playpen Sans's weight**~~: **500** (BVJ, 2026-10-13), as built.
    **Its size: 16px** at the default text size, up from 15 (BVJ,
    2026-10-13: "slightly larger").
  - ~~**Whether a bookmark shows on the page**~~: **yes**, as the red mark
    now on the preview (BVJ, 2026-10-13).
  - ~~**How a screen reader learns a verse has notes**~~: **as built**
    (BVJ, 2026-10-13). The verse number, already a button and the
    keyboard's way into each verse, names the count ("Verse 1, 1 note of
    mine"), and the verse menu reaches the notes through "Show in
    notebook".
  - ~~**The second slice's defaults** (2026-10-08)~~: **confirmed**
    (BVJ, 2026-10-13), with N11's provisional choices, the highlights'
    defaults and undo's (all listed under "Order of work", 1c).
- **The merge rules** (talk-through item 20; rules a to e): **settled
  2026-10-09**, by BDR's answers and BVJ going with BDR on a note's older
  version (discarded). What remains:
  - ~~**The trash record's kind**~~: built 2026-10-12 as `deletedKind`.
  - **For BDR to confirm:** the rule for collapsing two trash records of one
    deletion (question 4). The website built its own proposal on
    2026-10-12: the later deletion, with the newer content
    (`STUDY-DESK-FORMAT.md`, kind 10). If BDR prefers another rule, it
    changes in `src/lib/desk-merge.mjs` and the shared merge vectors. Also
    for BDR: three details of the merge (an edit and a deletion at the same
    instant leave it deleted; an exact tie between edits keeps the device's
    own copy; a deletion that wins over an edit keeps the edited words in
    the trash), under "Clocks" in the format, and the shared cases in
    `test/fixtures/merge-vectors.json`.
- **The hidden passage, at length** (the Zoom's item 17; BDR, 2026-10-09).
  BDR's other questions of that day are answered (the website's answers
  under "One notebook, three homes").
- **"To be decided"** under "The apps' replies", starting with plan A or
  plan C ("One notebook, three homes"; at the Zoom, or by October 31 if the
  paused spikes resume). The record format is drafted (`STUDY-DESK-FORMAT.md`) and waits on
  both apps' review.
- **D7, deferred indefinitely (BVJ, 2026-10-11)**; the questions below are kept in case the idea returns: whether API.bible's tracking script is acceptable (BVJ,
  2026-10-08: "probably"; what it does is under D7); which other
  free-to-share translations join the KJV; whether the donation page fits
  API.bible's free plan. Since BVJ put the translations in the first release
  (2026-10-08), these gate 1e, and **BVJ held the public-domain versions with
  them** (2026-10-08): the stored KJV, OEB and WEB, the Versions tab and the
  versions in "This verse" wait until these are decided. Also to ask API.bible: whether the NASB 2020
  can be switched on in the dashboard, and whether openly licensed Bibles
  need the tracking script. The NRSVue and CEB are shelved for a possible
  second version (BVJ, 2026-10-08).
- **The tabs and the Greek** (2026-10-08; "Decisions", 2026-10-08 (the Greek
  tab)):
  - ~~**The John 7:53–8:11 footnotes' wording** (john-7 fn-ff, john-8 fn-k),
    before 1f ships: SBLGNT 1.2 prints the passage.~~ Done 2026-10-11, in the
    repo; the Word master still has to be changed to match ("Decisions").
  - ~~**The Notebook in Read View: none at all, or only the reader's own
    things**~~: **the reader's own things** (BVJ, 2026-10-13), as built.
    The rest of this item is the reasoning it was recommended on.
    (BVJ, 2026-10-08, one of the two; the version tabs are Study
    View only either way). Recommended: the reader's own things, which is
    what Read View's panel holds today, since Read View now shows bookmarks
    and the panel's list takes the reader to them within the book.
  - Decided the same day: the Greek is in the first release (1f); intros
    and Read View stay at 52 with the notebook open; the OEB and WEB join
    the KJV (the BSB and ASV were set aside as duplicating the CSB and NIV,
    and the KJV and NASB); the NRSVue and CEB are shelved for a possible
    second version; the reader's tab is "My Notes"; the tabs are My Notes,
    This verse, Greek and Versions (Versions deferred 2026-10-11), with no Parallel; the panel starts with
    the margin it gets and readers can drag the columns' widths, with
    nothing showing between them at rest (decision items 12 and 13).
- **Topics and tags.** BVJ is considering renaming today's topics to "tags"
  and curating a smaller set of thematic study topics. If so: the chapter
  JSON's `topics` field and `/api/data/topics.json` keep their names, because
  the apps read them (rename on screen only, unless BDR changes the apps);
  M8's personal tags need another name, such as labels; and a curated topic
  could be published as a LIT-made sheet readers copy into their notebooks,
  reviving the feature audit's X6 (browsable topic pages, deferred
  2026-09-28) on the sheet machinery. Today's topics follow TOPICS.md and are
  functionally tags for search reach.
- **D8, the tutorial**: ~~what counts as the first encounter, and how it meets
  D6's first-time choice.~~ Answered by the built recommendation (2026-10-12):
  offered once, right after the D6 choice, never by itself over scripture.
  **Confirmed** (BVJ, 2026-10-13): offered once, and replayable on demand,
  which the preview already does from the panel's foot, the `tour`
  command and the help page. **Revised** (BVJ, 2026-10-14): the offer is a
  window beside the Notebook on its first expansion, with "Take the tour
  now," "Remind me later," and "Don't show this again" (decision log,
  2026-10-14, "The tour offer").
- **When to release the desk to readers.** Not before phase 1 is
  completely done (N8 and the exploring of 1g and 1h included), and
  perhaps not until phases 1 to 3 are (BVJ, 2026-10-13). Which of the two
  is still open; **BVJ is leaning toward after phase 3** (2026-10-13,
  not decided), since phase 1 took about two weeks to build. A small
  group of trusted readers given `?desk=on` would not be a release, and
  is a separate question.
- ~~**A fuller tour**~~: **built** (BVJ, 2026-10-13: steps that act, and
  nothing they do persists). Fifteen steps in three parts; see "Order of
  work", 1d, "First use, the tour and the help page".
- ~~**Construction search**~~: **in phase 2** (BVJ, 2026-10-13), now
  2a (BVJ, 2026-10-14).
- ~~**Searching by parsing**~~: **in phase 2** (2a since 2026-10-14), with construction search
  (BVJ, 2026-10-13).
- **Word families: deferred indefinitely** (BVJ, 2026-10-13; probably not
  a version 1 feature). Kept for if it returns: none of 1f's sources groups
  lemmas into families; STEPBible's Abbott-Smith etymologies ("ἀγρεύω
  (ἄγρα)") and Strong's "from G…" could seed a list, and the editorial
  review across 5,465 lemmas is the real cost.
- **One transliteration style across the corpus** (raised 2026-10-13;
  **on FIXLIST.md since 2026-10-13**, BVJ, under the Fable list, "Added
  2026-10-13", where the decisions below wait).
  Search shows the SBL Handbook's academic style (psychē, kyrios); the
  corpus mostly doesn't. A survey that day of italic Latin words that
  spell an SBLGNT form found about 3,600, 1,950 already in that style and
  about 1,600 not (in some 240 files, mostly footnotes): about 1,250 a
  missing macron (eulogeo, poneros), about 480 *u* for upsilon (kurios
  199 times, psuche, hupotasso). Open: whether to do it at all, macrons
  only or the *y* too (the Handbook also has a general-purpose style
  without macrons), and the Word masters, which a repo-only pass would
  part from as the en dash did. The first release includes the Greek and no other
  translations; 1e is deferred.
- ~~**1g and 1h, to explore before phases 2 and 3**~~: **explored**
  (BVJ, 2026-10-13). 1g is shelved for the future; 1h is planned, to
  build. See "Order of work", 1g and 1h.
- **Phase 2a's defaults** (built 2026-10-15 on recommendations; "Order of
  work", 2a). For BVJ to judge on the preview:
  1. **B3**: before the reader first opens `/notebook/`, nothing is marked
     New and the panel's line leaves out "since your last visit". "Last
     looked" is the newest release note's date seen, not the clock.
  2. **N4's links are in the text green, underlined**; the margin's note
     text stays `--text`. Principle 3's indigo has no token in the tree
     (the shelved M10 had added `--desk-mine`).
  3. **N4's section title** is "Notes that cite this verse", and the change
     notice's card links references too.
  4. **Construction search's reach** is one setting for the whole query
     (~3 by default), not one per pair of words, and a match is counted
     once per occurrence of the first word (Galatians 2:16 counts twice).
  5. **Two words with a space and no comma** are a construction too
     (`πίστεως Ἰησοῦ`, "pistis Christos"), while plain English words stay
     a gloss search ("son of man") unless they find nothing.
  6. **The tray treats `*` and a dot followed by a parsing word as Greek**
     (it has no type menu); a wildcard inside a word ("lov*") is not one.
     Plain parsing words ("aorist imperative") still need the "Greek"
     type, as decided on 2026-10-13.
  7. **The window's place**: beside the box if it fits, else below it
     against the right edge, shorter (scrolling inside) rather than over
     the box; left of the Notebook from the Greek tab. A dragged place is
     kept for the visit.
  8. **The parsing starter** in the Greek tab searches the word's whole
     parsing (`*.aor.act.ind.3rd.pl`), which the reader can trim.
  9. **Either of two filters takes the slash**, the same "or" as between
     words (`.gen/dat`, `.aor/pres`), and only within one kind: `.gen/pl`
     is an error, and so is `.gen.dat`, whose message points to the slash.
  (M10's own defaults went with it to `claude/desk-2a-m10`.)
- ~~**Phase 1h's defaults**~~: **accepted** (BVJ, 2026-10-13). (Built 2026-10-13 on recommendations; "Order of
  work", 1h, "Built"): the lemma line's gloss taken from STEPBible's brief
  lexicon; English matching whole glosses of other UBS senses; the
  transliteration shown in the SBL Handbook's style; one Greek word per
  search; ten verses at a time on /search and in the tab; the tray's six
  verses; a reference query skipping the Greek; the bridge's LIT renderings
  ranked before the lexicons' English; the tab's
  search replacing its text, and its height in a short window (the results
  and the details share it).
- ~~**1h's open details**~~: **settled** (BVJ, 2026-10-13): a Greek
  result opens the Notebook even when the reader closed it; a Latin query
  shows a Greek group in the search tray only on an exact transliteration
  or gloss match, at most three words; and **1h is built before phases 2
  and 3 begin**. See "Order of work", 1h.
- ~~**Phase 1f's defaults**~~: **accepted** (BVJ, 2026-10-13), including
  hosting the full LSJ on the site. (Built 2026-10-13 on recommendations;
  listed under "Order of work", 1f, "Built"): the
  details docked at the tab's foot, up to 45% of its height; UBS as the
  lexicon until the reader picks; each lemma's short gloss taken from UBS's
  most-used sense for it; the full LSJ hosted on the site rather than linked
  out, given STEPBible's request (below); the apparatus key's wording; the
  tab having no minimum width of its own (the 380px question, 2026-10-08).
- **STEPBible's request not to redistribute** (checked against the files'
  header, 2026-10-13). The license is CC BY 4.0, and the header lists what
  it allows, the first two being "Include any part of this data in software
  or publications without requesting permission" and "Download the data and
  reformat it for your application". The request comes later, under
  pointing others to the data: "Refer others to github.com/STEPBible as the
  source of the data. Please do not redistribute it yourself", because
  corrections are easier from one source. Changes must be noted for those
  who use the result. So the request is about passing the dataset on as a
  dataset, not about an application showing its entries; it isn't a
  license term (CC BY 4.0 allows none), and 1f is within both the license
  and the request. One thing goes against the request's spirit:
  `public/greek/LICENSE.txt` says the `step/` and `lsj/` directories are
  "licensed CC BY 4.0", which reads as an invitation to take the data from
  here. Proposed, for BVJ: say instead that the files are formatted for the
  tab and that anyone wanting the data should get it from
  github.com/STEPBible, keeping the note of changes. **Done** (BVJ,
  2026-10-13). Hosting the full LSJ was settled with 1f's defaults (kept on
  the site). ~~Writing to STEPBible about the project~~: **BVJ won't reach
  out** (2026-10-13), having read the background below.
  The header says "We'd love to hear about your project when you make it
  available" (to STEPBibleATGmail.com, which is STEPBible@gmail.com), and
  asks that proposed corrections go to the same address; the README says
  telling them is welcome but not required. "When you make it available"
  points to writing at the desk's release. BVJ asked first what STEPBible's
  theology is (2026-10-13): STEP is a project of Tyndale House, Cambridge,
  whose doctrinal basis (UCCF's) holds Scripture "inspired and infallible"
  and whose ethos statement names "a male and a female" as the context for
  all sexual activity; staff must support that ethos. Its directors are
  Peter J. Williams (Tyndale's warden, on the ESV's translation committee),
  David Instone-Brewer (who began STEP; known for Jewish-background
  scholarship and readings of divorce and Jesus' treatment of women that
  drew conservative criticism) and Dale Brueggemann. Their CC BY 4.0
  grant can't be withdrawn; the license forbids implying their
  endorsement, and lets them ask that their name be removed from the
  credit. The Greek tab credits them as the README asks ("STEP Bible",
  linked to www.STEPBible.org, since 2026-10-13).
- **The Digital Bible Library** (library.bible, the American Bible Society's
  library that API.bible draws from, and where YouVersion and Global.Bible get
  texts): I raised **submitting the LIT to it** as a way to reach the Bible
  App and API.bible developers. Requirements found: an organization account,
  proof of ownership, a recommendation from UBS, Biblica or Wycliffe or
  following the Forum of Bible Agencies International translation standards,
  approval by a committee that admits "reputable organizations" that "follow
  the historic tenets of Christianity", a license agreement with the United
  Bible Societies, and text in USX (needs a converter from chapter JSON).
  Frictions: weekly revisions to re-upload; a New Testament with drafts. BVJ
  hasn't answered; it would be a distribution decision, separate from the
  desk.

## Related projects (in FIXLIST, separate from the desk)

All three are in FIXLIST's "Added 2026-10-02 from the Study Desk planning"
subsection (Fable list), with their considerations:
- **LIT previews on other websites** (name to be chosen; "LIT Previews" is a
  working name). Either a reader-side bookmarklet or extension that opens the
  LIT (and later the notebook) beside any page, or a site-owner script tag
  that turns references into LIT previews using `ref-preview.js` and
  `scripture-refs.mjs`. Serving `public/search/chapters/` to other sites makes
  them a public interface and needs CORS.
- **Reading plans**, on the website and in the apps: which plans given the
  drafts, where progress lives with and without an account, a shared plan
  format agreed with BDR, which view a day opens.
- **Footnotes sorted by kind** (S11).

And outside FIXLIST: the **Greek-text alignment display** ("Ready for the
Greek text" above), after the desk.

## The survey (twelve sites and tools)

| Site or tool | Account | Notes, highlights, bookmarks | Sheets and output | What to take |
|---|---|---|---|---|
| Sefaria | For notes and sheets | Private notes, saved texts, reading history | A sheet editor (now "Voices on Sefaria"); "Add to Sheet" in the library's side panel; saves as you type; private or public; collections; export to Google Docs or print | Sheets as a workspace of their own, fed from the reader |
| YouVersion (bible.com) | Yes | On the web, highlights only; notes, labels, bookmarks, verse images and custom colors are app-only | Plans and verse images, in the app | The biggest platform keeps study tools in its app |
| Bible Gateway | Free account | Highlights, notes, emoji reactions, synced | None | Light-touch reactions a desk doesn't need |
| ESV.org | Free account | Select text for a note or highlight; formatted notes; a profile page lists and searches everything | None | One searchable list of everything |
| Blue Letter Bible | Optional | Notebooks, unlimited colors, bookmarks, tags, cloud backup | None | Tags and named notebooks |
| Logos | Paid | Notes in notebooks; highlight palettes; Visual Filters mark every use of a Greek lemma | Sermon Builder: manuscript, slides, handouts and questions together, handout blanks shown or hidden | Leader and participant copies; marking by Greek word |
| NET Bible (netbible.org) | Free, for your own notes | Text plus a side panel following the passage: the translation's ~58,500 notes typed tn/sn/tc, commentaries, your notes, other Bibles, the Greek or Hebrew, a library; clicking a Greek word lights its English with parsing, Strong's, transliteration, root, definition; clicking English offers Highlight, Add Note, Parallel, search, share, bookmark; syncs with its iPhone app | None | The nearest thing to the LIT: notes beside the text, sorted by kind, and the planned Greek link |
| STEP Bible | None | Bookmarks in cookies; settings in the address, which STEP tells you to save | None | No account, honest that browser storage is fragile |
| Kindle and Readwise | Amazon | A notebook page to copy or print; Readwise sends to Notion, Obsidian and others | Exports | Send notes to tools people already keep |
| Hypothesis | Yes | Anchors by quoting words with text before and after (W3C TextQuoteSelector) | None | How to anchor a note to a phrase |
| Obsidian Bible plugins | None (local files) | Verse links inside Markdown notes; one surfaces everything written about a verse | The files | Plain files people own; links back from a verse |
| The LIT apps | None | Four highlight colors, an inline note tool that quotes the words, a note mark in the left margin; iCloud or Android backup | None | Match their look and wording |

**Four older ideas**: Jonathan Edwards's "Blank Bible" (a King James Bible
interleaved with blank leaves, a red rule splitting each into two columns,
5,000+ entries over three decades; Yale's Beinecke Library); the Thompson
Chain-Reference Bible (first edition 1908; today 8,000+ topics, 100,000
links); inductive marking (Precept: a color or symbol per key word, used the
same way throughout); journaling Bibles (a wide ruled margin).

**What the survey shows**: everyone with notes asks for an account, and the
one site that doesn't (STEP) keeps bookmarks in cookies, so nobody has made
account-free notes safe (D1 is the answer). There are two shapes: YouVersion
keeps study tools in the app; Sefaria built its sheet editor for the desktop
web, and the LIT can take Sefaria's shape. Preparation tools are paid or tied
to an account, so a free, account-free set built on the translation's own
data has no direct competitor. Every other text holds still; the LIT's
release notes logged 491 changes from 2026-03-29 to 2026-09-30, 211 to
wording, 342 naming the verse, which is the main risk and the source of N3,
B3 and S2.

## Facts to re-check before building

Counts here were checked on 2026-09-30 to 2026-10-02 and drift:
- Reading column 681px at the default size, ~870px at the largest;
  `--reading-measure` 60. At the chosen 52: 590px and 755px. At 48 (Study
  View chapters with the notebook open, from 2026-10-08): 545px and 696px.
- About 4,300 term-lens marks; pistis in Galatians 26, sarx in Romans 28.
- Release-note counts (491 / 211 / 342 as of 2026-09-30).
- Browser support: Custom Highlight API (Chrome 105, Safari 17.2, Firefox
  140); Document Picture-in-Picture (Chrome, Edge, Firefox 151); File System
  Access (Chrome and Edge only).
- API.bible plans and terms, NRSVue and CEB permission terms, Cloudflare
  Email Service status, Supabase passkey status, Firebase passkeys.

## Sources

Sefaria: [export, print or share a sheet](https://help.sefaria.org/hc/en-us/articles/20532656851228-How-to-Export-Print-or-Share-a-Sheet),
[Voices on Sefaria](https://voices.sefaria.org/sheets/674324),
[accessing notes](https://help.sefaria.org/hc/en-us/articles/18612854451484-How-to-Access-Your-Notes).
[YouVersion: Bible.com Bible tab](https://help.youversion.com/l/en/article/qi1gf7u75f-bible-com-bible).
[Bible Gateway app](https://apps.apple.com/us/app/bible-gateway/id506512797).
Crossway: [ESV.org notes](https://www.crossway.org/articles/esvorghow-to-create-notes/),
[12 things about ESV.org](https://www.crossway.org/articles/12-things-you-might-not-know-about-esv-org/).
[Blue Letter Bible review](https://learnofchrist.com/resources/blue-letter-bible).
Logos: [Sermon Builder](https://support.logos.com/hc/en-us/articles/360016747391-Sermon-Builder),
[notes](https://support.logos.com/hc/en-us/articles/360017978372-Record-Your-Insights-Using-Notes),
[Visual Filters](https://community.logos.com/wiki/logos-user-wiki/to-sort/table-of-contents/visual-filter/).
[STEP Bible personal setup](https://stepbibleguide.blogspot.com/p/personal.html).
[Readwise Bookcision](https://readwise.io/bookcision).
[W3C Web Annotation Data Model](https://www.w3.org/TR/annotation-model/).
[Obsidian Scripture Thread](https://github.com/gitwesleyt/obsidian-scripture-thread).
Edwards: [Sweeney (PDF)](https://henrycenter.tiu.edu/wp-content/uploads/2013/12/2013-Sept_Doug_Sweeney_Chapter-1.pdf),
[Beinecke](https://beinecke.library.yale.edu/jonathanedwardshighlights2019).
[DHQ on Thompson](https://digitalhumanities.org/dhq/vol/6/2/000137/000137.html).
[Precept method](https://www.precept.org/study/precept-bible-study-method/).
Browsers: [File System Access](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access),
[persistent file permissions](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api),
[WebKit tracking prevention](https://webkit.org/tracking-prevention/),
[WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/),
[Custom Highlight API](https://frontendmasters.com/blog/using-the-custom-highlight-api/),
[its accessibility (MDN issue)](https://github.com/mdn/content/issues/43408),
[highlight annotations](https://jpcasabianca.com/journal/custom-highlight-api-annotations/),
[Document Picture-in-Picture](https://developer.chrome.com/docs/web-platform/document-picture-in-picture),
[the Cloudflare beacon and the address](https://github.com/jwh3times/magic-agenda/issues/295).
Accounts: [Apple 4.8](https://9to5mac.com/2024/01/27/sign-in-with-apple-rules-app-store/),
[Apple account deletion](https://developer.apple.com/news/?id=12m75xbj),
[Google Play deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en),
[passkey relying party ID](https://web.dev/articles/webauthn-rp-id),
[passkeys across apps](https://www.corbado.com/blog/webauthn-relying-party-id-rpid-passkeys),
[Apple private relay](https://docs.customer.io/messaging/channels/email/deliverability/authenticating-for-apple-private-email-relay/),
[Cloudflare Email Service](https://blog.cloudflare.com/email-for-agents/),
[CloudKit JS](https://cdn.apple-cloudkit.com/cloudkit-catalog/),
[Better Auth](https://better-auth.com/),
[Supabase passkeys](https://supabase.com/docs/guides/auth/passkeys),
[Firebase passkeys](https://www.corbado.com/passkeys/firebase).
NET Bible: [John 3](https://netbible.org/bible/John+3),
[note abbreviations](https://bible.org/list-abbreviations-net-bible-footnotes),
[Lumina review](https://bitesizedexegesis.com/2016/09/28/review-lumina/),
[App Store](https://apps.apple.com/us/app/net-bible-formerly-lumina/id687558432).
API.bible: [plans](https://api.bible/), [docs](https://docs.api.bible/),
[Fair Use (FUMS)](https://docs.api.bible/guides/fair-use/),
[terms](https://api.bible/terms-and-conditions),
[licensing](https://care.api.bible/article/369-understanding-api-bible-licensing).
Licensing: [NRSVue (Friendship Press)](https://www.friendshippress.org/pages/nrsvue-quick-faq),
[CEB permissions](https://www.commonenglishbible.com/permissions).
Digital Bible Library: [library.bible](https://library.bible/),
[FAQ](https://care.library.bible/article/252-frequently-asked-questions),
[review process](https://care.library.bible/article/138-our-review-process).
Greek sources: [MorphGNT SBLGNT](https://github.com/morphgnt/sblgnt),
[Open Scriptures Hebrew Bible](https://github.com/openscriptures/morphhb),
[Abbott-Smith](https://github.com/translatable-exegetical-tools/Abbott-Smith),
[Dodson](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=Dodson).

## Keeping this file current

- **This file is the repo's record of the desk.** When BVJ decides something,
  BDR answers an item on the list, or a phase ships, update it in the same
  change: move items from "Still open" to the decision log with the date, and
  mark ideas built. Don't delete declined or superseded items; record the
  outcome, the way FIXLIST does.
- Keep idea and audit IDs stable.
- Once the desk ships, CLAUDE.md gets the deep reference for how the built
  feature works (as it has for the term lens and the selection panel); this
  file stays the planning and decision history.
- The claude.ai plan page may lag this file. Only update it if BVJ asks.
