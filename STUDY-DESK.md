# The LIT Study Desk

The complete record of the Study Desk as planned so far: what it is, every idea
with its status, every decision BVJ has made and why, the audit and how each
finding was settled, the account and sync work planned with BDR, and the
related projects that came out of it. **Nothing is built.** This file exists
so a future session can pick the work up without the conversations that
produced it.

**Read this before proposing, designing or building any part of the desk.**
Many ideas here were weighed and decided, some were declined, and the reasons
are recorded so they aren't re-argued.

## Where things stand (as of 2026-10-05)

- **Status: phase 1b built, behind a preview switch; nothing reader-facing
  yet.** Readers see and download none of it. `litbible.net/?desk=on` turns
  the desk on in one browser on a computer, and `?desk=off` turns it off.
  No desk page or service exists, and there is no way yet to make a mark.
  What exists:
  - draft 1 of the record format (`STUDY-DESK-FORMAT.md`), with its
    reference implementation (`scripts/lib/anchor-text.mjs`) and test vectors
    (PR #268);
  - three of phase 1a's foundations: the record kinds
    (`src/lib/desk-records.mjs`), the browser half of the anchor text
    (`src/lib/desk-anchor-dom.mjs`), and the wording comparison
    (`src/lib/desk-wording.mjs`). See "Order of work", 1a;
  - phase 1b's shell: the gate, the notebook in IndexedDB kept in step across
    tabs, deletion with an undo bar (on the trash record's **provisional**
    fields), and the Notebook panel in the right margin. See "Order of
    work", 1b.

  **The development phases were planned on 2026-10-05** ("Order of work"
  below). The format is frozen before anything syncs (BVJ, 2026-10-05).
  Until then phase 0 read "agree the record format before any code".
- **BDR's input is needed soon, on the merge and overlap rules.** BVJ held
  phase 1a's merge engine and the highlight overlap rule for BDR to weigh in
  on (2026-10-05), since both are format decisions all three clients must
  share. **They are needed before phase 1c** (highlights in Study View) **and
  1d** (importing a notebook file). The five questions are under "Questions
  for the apps" (talk-through item 20).
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
  "Decisions", 2026-10-05 (phase 0 picks).
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
  in both panels (decision 3, audit C26). Phones keep "Copy with notes",
  since they have one kind of note. Update CLAUDE.md's "One set of actions,
  two ways in" and "Printing and handouts" when this ships.
- **Idea IDs**: N notes, B places and bookmarks, H highlights, S sheets, D the
  desk as a whole. Ideas the audit added keep their **M** numbers. Audit
  findings are **C1 to C27**. BVJ cites these IDs, so keep them stable; never
  renumber.
- **People**: BVJ is the owner (Brandon). BDR is the developer of the iOS and
  Android apps and collaborates on accounts and sync.

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
4. What only the LIT can offer: N2 and H2, from the reviewed alignment.
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
   "Add to a sheet…" join the verse menu under a "Yours" heading (shortcuts N
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
   - **Open: margin notes while the Notebook panel is open** (raised
     2026-10-06). Since the panel moved into the right margin beside the
     text, an open panel and the margin would show a chapter's notes twice.
     **Recommendation (not decided): show margin notes only while the panel
     is closed.** While it's open, its "This chapter" list would do the
     margin's job, following the reading position and picking out the notes
     for the verses on screen, and the left margin would show nothing. That
     would also free the left side when room is tightest: an open panel can
     move the text left (articles most), and the margin's 230px is then often
     gone anyway. The other options are under "Still open".
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

## The ideas (48)

"New" means no Bible site or tool was found doing it; "Borrowed" names the
source. Sizes run extra small to large. Status is BVJ's decision where one was
made; "proposed" means it's in the plan without a separate decision (the
plan as a whole was accepted; nothing was declined except where stated).

### Notes

- **N1. Notes in your margin.** Placement 2 above. Falls back to a dot on the
  verse number and the panel without ~230px of free space (C9). Notes sit
  outside the scripture's reading order, linked from the verse (C24).
  Borrowed (Edwards's Blank Bible, the LIT apps). Medium. **Decided: the
  margin is in.** Open since 2026-10-06: whether it shows while the
  Notebook panel is open (placement 2; recommended: no, the open panel's
  chapter list follows the reading position instead).
- **N2. Notes that follow a word.** Write a note on a glossary term once and
  it appears in the term lens card wherever that term is marked, about 4,300
  places across published chapters. A note on *sarx* shows under
  "self-preservation" in Romans 8 and under "family" in Mark 10:8. No Bible
  site attaches a reader's note to a translation's concept across all its
  renderings, because none has the reviewed alignment. New. Small to medium.
  Proposed. Mock: the term lens card for "self-preservation" ("Traditionally
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
- **N4. Your own chains.** A reference typed in a note becomes a link with a
  preview through the same linker the footnotes use (`linkScriptureRefs` is
  pure and can run in the browser), and the cited verse shows "Mentioned in
  your note on Romans 8:3–4." Borrowed (Thompson Chain-Reference, Obsidian).
  Medium. Proposed.
- **N5. A history with a passage.** Dated notes shown in order on a passage
  you keep returning to: "You first wrote here in March 2025." Suits spiritual
  direction. New. Small. Proposed.
- **N6. Questions as their own kind.** Mark a note as a question; a sheet
  gathers them into a "For discussion" section in passage order. Borrowed
  (Logos Sermon Builder). Extra small. Proposed.
- **N7. The interleaf.** A Display tray switch that opens a ruled band after
  each paragraph holding your notes for it, like Edwards's blank leaves.
  Works in windows too narrow for the margin. **Bands open only when the
  reader asks**, so the page never jumps on load (audit C13; layout shift
  was the site's worst Core Web Vital until the `--ch` fix). New. Small.
  Proposed.
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
  no passage.
- **N9. Print with room to write.** A print option setting the text in a
  narrower column beside a wide ruled margin, like a journaling Bible. Stores
  nothing; a variant of `print.css`. Borrowed (journaling Bibles). Extra
  small. Can ship any time, independent of everything else.
- **N10. One verse, everything about it.** Borrowed from netbible.org, whose
  side panel follows the passage with the translation's notes and the
  reader's. **Decided 2026-10-02: one verse at a time.** A "This verse" tab in
  the Notebook panel shows the verse you picked (by its number or from the
  verse menu) with its footnotes and your notes on it, and stays put while you
  read on. It is also where other translations of that verse appear (D7). The
  footnote letters, popovers and end list stay as they are. Small. Phase 1.
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
    New. Medium. **Decided: yes.**
- **M6. Print my annotated chapter or book.** A chapter, or a whole book from
  Read View, printed with your notes in the margin and highlights shown. N9
  is the blank version. New. Small. **Decided: yes.**
- **M11. Notes on a footnote.** A note attaches to a footnote by quoting its
  words, not its letter, so it survives relabeling; N3's notice applies when
  the footnote is rewritten. New. Medium. **Decided: yes.**

### Places and bookmarks

- **B1. Places, plural.** "Continue reading" and Read View's per-book places
  shown together, plus a few named ribbons ("Thursday group", "Morning
  reading"). **A ribbon moves while you read from it**: open a book through
  "Thursday group" and that ribbon follows you until you leave the book;
  otherwise only "Continue reading" moves (audit C25). Partly new. Small.
  Proposed.
- **B2. Bookmarks that remember why.** An optional label and how you got there
  (the search for "debt", the podcast episode, the Romans intro), so the list
  reads like a trail. New. Small. Proposed.
- **B3. What's new for you.** The release notes filtered to verses in your
  notebook ("Three changes since your last visit touch your verses"), using
  N3's comparison. New. Small. Proposed. The mock used three real changes:
  Romans 4:6–9 (Sep 3, "Gratified" → "How greatly fortunate"), Galatians 3:27
  (Aug 21, "submersed" → "immersed"), Romans 8:28 (Aug 3, "intention." →
  "intention, for what's beneficial.").
- **B4. Your marks beside the scrollbar.** In Read View, small ticks beside
  the scrollbar show your places, and your highlights when Read View's
  highlights are on. **No ticks for notes**, since Read View doesn't show them
  (audit C14, decided). Borrowed (code editors, Chrome's find bar). Small.

### Highlights and marks

- **H1. Your own legend.** Four colors, the same number as the apps, each with
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
  Medium. Proposed. Becomes exact once phase 2 of the alignment publishes.

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
  handouts, Logos Sermon Builder). Medium. **Decided: blanks are in.**
- **S5. Printed codes that open the app.** Each chapter on a printed sheet
  carries a QR code: the app if installed, the website otherwise. The site's
  `apple-app-site-association` already claims every book's chapter addresses
  (`/<book>-*`) and `/glossary`; `assetlinks.json` uses `handle_all_urls`, and
  the Android app keeps its own path list, which is worth checking. The
  `qrcode-generator` library would move from a build-only devDependency to
  something the page loads (C21). New. Small. Proposed.
- **S6. Present mode, with a reveal.** Full screen, one passage at a time,
  large type, arrow keys, for a projector or a video call; a projector screen
  stays dark in either theme. An optional reveal (R) shows a key term's
  traditional word first, then the LIT's rendering and its footnote (F).
  The license lets a class, study group or sermon display any amount. New.
  Medium. **Decided: the reveal is in** (decision 6).
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
  technique. Medium. **Decided: computers only for now** (decision 4).
- **S9. Copy for Word and Google Docs.** A rich copy keeping headings,
  italics and the credit line, since most bulletins are built in Word.
  Sefaria's export needs a Google account; this needs nothing. Borrowed
  (Sefaria). Small. Proposed.
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
  Medium. **Decided: yes.**
- **M3. A code on the screen so the room can follow along.** Present mode's
  first screen shows S5's QR code. New. Extra small. **Decided: yes.**
- **M4. A word study in one click.** From the term lens or a /glossary entry,
  "Make a word study of sarx in Romans" builds a sheet of every gated place,
  grouped by rendering, with the key terms box and starter questions. Could
  take a Strong's number too once the Greek alignment publishes. New. Small to
  medium. **Decided: yes.**
- **M5. A sheet from a search or a topic.** On /search, "Add these verses to a
  sheet" gathers the results (or ticked ones); a topic does the same with its
  chapters. Small. **Decided: yes.**
- **M9. Templates, including a contemplative one.** Bible study, sermon
  preparation, a class session, or lectio divina's four movements (read,
  reflect, pray, rest). Speaks to the spiritual directors named in the origin.
  Small. **Decided: yes.**
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
  Medium. Proposed. The mocked file format:

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
- **D3. Commands in the search box.** Placement 4. Borrowed (desktop
  software). Medium. **Decided: in the search box, no Ctrl K.**
- **D4. Pop the notebook out.** Document Picture-in-Picture (Chrome, Edge, and
  Firefox since 151) opens a small always-on-top window holding the notebook,
  beside the text or a video call. Safari can't, so it's an extra, never the
  only way. New, experimental. Small. Proposed.
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
  a copy". Small. **Decided.**
- **D7. Compare a verse with other translations.** Borrowed from NET's
  "Parallel". Other translations appear side by side in N10's "This verse"
  tab. Status, 2026-10-02:
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
  the "Yours" actions in the verse menu, the margin, the Notebook panel,
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
- **M1. Hide my notes, in one keystroke.** A switch with a shortcut that hides
  every note, highlight and mark at once, for sharing a screen or teaching
  from Study View. N8 makes it matter. Present mode already leaves notes out.
  Small. Privacy. **Decided: yes.**
- **M7. A trash with undo.** Deleted notes and sheets wait 30 days; matters
  more with sync, since a deletion reaches every device. Small. **Decided:
  yes.**
- **M8. Your own tags across everything.** One set of personal tags across
  notes, highlights, bookmarks and sheets, filtered in the panel and on the
  notebook page; covers named notebooks (Blue Letter Bible's takeaway).
  **Decided: yes, name open**: if the site's topics are renamed tags (see
  "Topics and tags"), the reader's own could be called labels. Small.
- **M10. Your notebook where you already look.** A "Verses in my notebook"
  filter on /release-notes; your note on a term on its /glossary entry; a
  "Your notes here" row in Go deeper. New. Extra small. **Decided: yes.**
- **M12. A help page, a quiet launch, and a way to say what's missing.** The
  help page is D6's "Ways to keep your notebook", plus how to back up, how to
  delete everything, and **a link to the license terms** for anything a
  reader shares. A line in the release notes and the newsletter at launch
  (the announcement slot never appears over scripture). A "Tell us what's
  missing" link in the panel opening the contact form, because the site
  deliberately doesn't measure who uses what. Small. **Decided: yes.**

## How it would be built

Through phase 3 everything runs in the reader's browser; accounts add a
server. Most hard parts exist in the repo already.

- **The gate**: `isAppPlatform()`, dynamic import on computers only; account
  pages excepted (C1), if plan B gives the site any.
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
  Inter).

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
     colours.
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
| 1 | Plan A or plan B | T1, A-Q1 | BVJ with BDR | BDR leans hard to A. **Lean: A, if P1–P3 pass by the end of October.** It keeps the privacy page's promise that the site collects personal information only when someone chooses to send it, needs nobody on call, and lets the apps launch without the website. It moves work to the website (finding 6) |
| 2 | Does "LIT never holds the notes" answer the end-to-end lean (C19)? | T2, A-Q2 | BVJ | Under plan A, Apple or Google could read the notes, as they can anything else in the account. LIT never could, and there is no recovery key to lose |
| 3 | Brackets in anchors | T7 | BVJ; the apps follow | **Lean: strip** (finding 5) |
| 4 | Reading positions: shared, or separate with ribbons crossing over | T5 (A-R6 says shared) | BVJ | **Lean: share one place per book**, stored as a verse (A-F13), so stopping on the phone moves the desk's Continue reading |
| 5 | The notebook file | T3 | BVJ | **Lean, under A: keep the Markdown export and import** (item 6 needs it) and drop live save-in-place from phase 1 |
| 6 | The reader with both Apple and Android devices; the reader who wants neither sign-in | T4 | BVJ, BDR | **Lean: a known gap at launch**, with export and import; the website bridge later. The reader who wants neither keeps the notebook in the browser |
| 7 | When a mark's words are gone | A-Q6, A-F5 | BVJ, BDR | **Lean: one rule on all three.** Use the apps' rule, with the notice: place the mark on the words between the old context, keep the old words, and write nothing until the reader chooses Keep |
| 8 | What must be live on February 10, and the fallback if one platform isn't ready | A-Q3 | BVJ, BDR | Under plan A, the website can join later |
| 9 | Can the website build two storage adapters by February 10, alongside the desk? | A-Q7 | BVJ | Unsized (finding 6) |
| 10 | Who owns the Google Cloud project, the CloudKit container and the spec | A-Q4, T8 | BVJ, BDR | The container is in BDR's developer account. **Lean: the spec and its vectors live in this repo** |
| 11 | The stores' privacy answers ("No data collected" on Play) | A-Q5, P3 | BVJ, BDR | Unverified under plan A |
| 12 | The apps' License screen wording | T9, A-Q10 | BVJ | **Needed by mid-October.** Draft: "The LIT Bible is licensed under CC BY-NC-ND 4.0, with added permissions: you may print, display and share any amount for noncommercial uses such as Bible studies, classes, sermons and bulletins, and you may quote it in commercial works within set limits. The full terms, including the credit line to use, are at litbible.net/read#license-terms." Android's existing "You may not distribute modified versions" stays accurate |
| 13 | Do shared sheet links need something hosted? | T10, A-M8 | BVJ | S8's links carry the sheet after the #, so they need nothing hosted. Only M14's short links need a small store, holding sheets only |
| 14 | The N8 record, and whether hiding reaches daily readings and widgets | A-Q9 | BVJ | Shape proposed in W6; both apps list every route a hidden passage must stay hidden on |
| 15 | Colour meanings in the apps | T6 | BVJ, BDR | BDR wants to talk it through |
| 16 | The alignment data in the apps: N2 and H2 shown, or only carried | A-Q8 | BVJ | **Lean: carried only, at launch** |
| 17 | The QR address | A-Q11 | BVJ | Both apps agree on `https://litbible.net/romans-8/#v3-4` |
| 18 | Bookmarks vs the `bookmark` marker; whether a quote may cross a verse or paragraph boundary | A-Q13 | the three Claudes propose | **Lean: bookmarks are their own kind**, and the marker stays a note's glyph |
| 19 | Tombstones after the trash empties | A-Q14 | the Claudes | **Lean: yes** (disagreement 2) |
| 20 | **The merge and overlap rules. Needed soon, before phase 1c** | A-M5, A-F7, A-F10, A-Q14 | BDR, then the Claudes | BVJ held the website's merge engine and overlap rule for BDR's input (2026-10-05). Five questions, under "Questions for the apps" below |

Questions for the apps, to send back:
- **For the iOS instance:** finding 1 (re-anchoring and paragraph positions);
  finding 7 (offsets kept on the device); whether a different colour trims
  an existing highlight; whether restoring an old device backup can bring a
  deleted record back; whether a blockquote counts as one paragraph.
- **For the Android instance:** whether the app's text model can drop
  verse digits and footnote letters from its context strings without a
  migration.
- **For BDR:** items 1, 4, 6, 7, 8, 10, 11 and 15.
- **For BDR, to know (added 2026-10-06):** BVJ wants readers able to attach
  notes to glossary entries and articles on the website (N11). Neither app
  shows those today. The ask is only that both apps carry such records
  untouched (the format's principle 6), and to say whether either app might
  show them later, especially glossary notes, since the apps already have
  the glossary.
- **For BDR, soon (item 20): the merge and overlap rules.** The website
  needs these before phase 1c, so it doesn't build rules the apps would then
  undo. Each is a proposal to answer yes, no or "do it this way":
  1. **Which write wins.** With no store revision to go by (importing a
     file, say), the newer `modified` wins, accepting that a device whose
     clock is wrong can make an older edit win. Where a store has a revision
     (a CloudKit change tag, a Drive file version), the revision decides, as
     the format already says (A-F7).
  2. **Edits and deletions.** A record whose `modified` is later than a
     trash record's `deletedAt` comes back, and the trash record is dropped.
     That makes undo work across devices and lets an edit made offline
     survive a deletion made elsewhere. It also relies on the clock, so a
     slow clock could bring back a note someone deleted. Is that the
     behaviour both apps want?
  3. **A note changed on two devices.** Both versions are kept: the newer
     keeps the ID, the other becomes a second note marked `conflictOf: <id>`.
     The second note's ID is worked out from the original's ID, `modified`
     and body, so importing the same file twice doesn't add it twice. That
     would be a UUID version 8. Would either app reject a version-8 UUID?
  4. **The trash record's fields**: `deletedId`, `deletedAt`, and `record`
     for the whole deleted record (dropped after 30 days, leaving the
     tombstone). When two devices delete the same record, the two trash
     records collapse to one: the one still holding its content, then the
     earliest, then the lowest ID.
  5. **Overlapping highlights** (A-M5). Is it Android's rule (same colour
     merges, a different colour trims the old one) or iOS's? And are marks
     that were re-found as `changed`, `verse` or `lost` left alone, so making
     a highlight never silently rewrites a mark the reader hasn't looked at?

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

- **Plan A or plan B** (T1, A-Q1), with the two requirements above.
- **Reading positions:** shared between phone and desk, or not (T5, A-R6).
- **The notebook file (D1):** a sync method, or export and import only (T3).
- **The reader with both an Apple and an Android device** (T4).
- **End-to-end encryption under the chosen plan** (T2, A-Q2).
- **How the reader's colour meanings appear in the apps** (T6), BVJ with
  BDR.
- **Ownership** of the Google Cloud project, the CloudKit container setup
  and the format spec (A-Q4, T8). Lean: the spec stays in this repo.
- **The stores' privacy answers**, including Play's "No data collected"
  (A-Q5, P3).
- **How far a hidden passage reaches** (A-Q9): daily readings, widgets,
  search, share cards.
- **Whether shared sheet links need anything hosted** (T10, A-M8).
- **Whether the apps show N2 and H2, or only carry them** (A-Q8).
- **Who looks after a service**, if plan B (T8, A-R7).
- **In the format:** bookmarks vs the `bookmark` marker, and the overlap
  rule for highlights (`STUDY-DESK-FORMAT.md`, "Still open").
- **The merge rules, the trash record's fields and the overlap rule**
  (talk-through item 20). **More urgent than the rest of this list**: phase
  1c waits on them.

## Ready for the Greek text

A later project than the desk (BVJ, 2026-10-01): align every word of the
Greek New Testament to the LIT, and eventually the Hebrew Bible; show the
Greek beside the LIT; clicking a word in either lights its partner in the
other and opens a bubble with morphology, Strong's number, root and perhaps
lexical information. The desk shouldn't need rebuilding for it.

- **Fonts now** (C27): self-hosted Greek and Hebrew fonts via `unicode-range`,
  serving Greek and Hebrew typed into notes from the start. Candidates (all
  SIL Open Font License), to compare beside Crimson Text: Gentium Plus or
  Cardo for polytonic Greek; Ezra SIL, Cardo or Noto Serif Hebrew for pointed
  Hebrew. **Picked 2026-10-05: Cardo** for both, in serif text and print, with
  Inter's own Greek and Noto Sans Hebrew inside the site's sans-serif text
  (see "Decisions", 2026-10-05, phase 0 picks). A Greek text panel will
  also need the SBLGNT's text-critical signs (Romans 8:2 carries ⸀), so check
  Cardo's coverage of them when that project starts.
- **Anchors that can point at a Greek word** (book, chapter, verse, SBLGNT
  word position) beside the English quotes. Nothing uses it until the
  alignment publishes.
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
  accounts need a fuller rewrite, and API.bible's FUMS script would need
  naming if adopted.

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
  in the translation's own voice.
- **Anchoring notes to footnote letters**: letters shift whenever a note is
  added or removed.

## Order of work

Planned in detail on 2026-10-05, after both apps replied, and approved by BVJ
the same day. Each phase is usable on its own, and **phases 1 to 3 need
nothing from the apps**. The website builds in the order that suits it
(BVJ's answers, 2026-10-05); February 10, 2027 is BDR's goal for the apps.

**The format rule: freeze it before anything syncs** (BVJ, 2026-10-05). This
replaced phase 0's "agree the record format before any code". Draft 1
(`STUDY-DESK-FORMAT.md`) is written to be safe under plan A and plan B, and
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
1. **The notebook**, in four steps. Medium to large.
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
     - **Held for BDR: one merge engine**, by `id`, `modified` and
       tombstones, keeping both versions of a conflicting note. It would
       import a file in phase 1 and become the sync engine in phase 4, since
       stores are homes, not formats (the format's principle 2). Its rules
       are format decisions (talk-through item 20).
     - **Held for BDR: the highlight overlap rule** (A-M5, item 20).
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
       differently, the change goes in `migrateRecord`.
     - **The undo bar** (`src/scripts/desk/undo-bar.js`) has no timeout:
       until the trash list (M7) exists it is the only way back, and a timed
       one would fail WCAG 2.2.1.
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
       - in a window too narrow for even that (about 900px), the panel lies
         over the ends of the lines.
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
     - **The 52 measure is on while the preview is on**, and Read View's
       toolbar takes a floor of 725px (895px in OpenDyslexic) so it doesn't
       change width as its labels change, as OpenDyslexic's already did.
     - **Plumbing (C21)**: nothing new in 1b. There's no new page (so no
       noindex, sitemap or Pagefind work), the shell is same-origin script
       the report-only CSP already allows, and IndexedDB needs no CSP entry.
       **The privacy paragraph waits for 1d**, as planned: only someone
       holding the preview link stores anything.
   - **1c. Marks in Study View.** The "Yours" actions in the verse menu and
     selection panel; notes with the apps' seven markers; highlights in the
     four colours with the reader's own meanings (H1) and a second cue
     besides colour (C4), modelled on the apps' marker glyph and dotted
     underline; bookmarks; the margin, falling back to dots and the panel
     (C9), and what it does while the panel is open, to be decided first
     (placement 2; recommended: nothing, with the panel's "This chapter"
     list following the reading position instead); the change notice, driven by the format's found, moved, changed,
     verse and lost, in the apps' words (iOS: Re-read in Context, Keep,
     Delete; Android: "carried along" and "couldn't find your words"); the
     "This verse" tab (N10); Read View's smaller set, through events (C2);
     hide my notes (M1); accessibility (C4, C10, C24).
   - **1d. The notebook around them.** The notebook page; your notebook in
     search, and commands in the search box (D2, D3); export and import in
     Markdown and the W3C shape, which every plan needs; the first-time
     choice (D6), worded without accounts until plan A or B is chosen; the
     Safari warning (C18); places and ribbons, kept in this browser (B1,
     C25); labels (M8, name open); the interleaf (N7, C13); the hidden
     passage (N8); the tutorial (D8); the help page (M12); the privacy
     paragraph; the link to the license terms. **Then decide whether to
     release it to readers.** Saving live into a chosen file (D1) waits on
     its decision (T3); export and import don't.
2. **What only the LIT can do.** What's new for you and text checked before
   printing (B3, S2), on 1a's comparison; notes that follow a word and
   concept marks saved as rules (N2, H2, C23); your own chains (N4); the word
   study (M4, once sheets exist); your notebook where you already look (M10);
   notes on a footnote (M11). The core of N3, finding a mark again and saying
   when its words changed, moved into phase 1, since every mark is re-found on
   every load. Medium.
3. **Sheets.** None of it waits on the apps: a sheet's inner shape is the
   website's own, and under plan A sheets go in the iCloud zone the app never
   opens. Phase 3 could move ahead of phase 2 if sheets for Lent matter (review
   finding 12; Ash Wednesday is February 10, 2027). The sheet page (S1) with
   key terms (S3), leader and participant copies (S4), blanks with the
   footnote picker (S10, C15), both paper sizes (C27), the license card with
   its link and the commercial check (S7), and the Word copy (S9); then
   printed codes (S5), present mode with the presenter view and room code (S6,
   M2, M3), sheets from searches and templates (M5, M9), annotated printing
   (M6) and shared links (S8). Large.
4. **Sync, with BDR.** Starts once plan A or B is chosen and the proofs (P1 to
   P3) are in. Under both plans: a sync loop on 1a's merge engine, one source
   of truth at a time (C5), connection status and "Reconnect", edits queued
   while disconnected, the conflict screen, and enforcing the full content
   security policy, since the page will hold a credential to readers' notes
   (review finding 11). Plan A adds two connectors, iCloud (CloudKit JS) and
   Google Drive, each with its own sign-in, limits and testing against real
   accounts, and perhaps a token-only Worker for Google. Plan B adds the
   service on Cloudflare, account pages on every device (C1) and account
   basics (C20). Either way: one key and then the lock (C6, D5), the
   encryption choice (C19), and short share links (M14). The website's side
   of plan A hasn't been sized (A-Q7). Large.

**Any time, independent of all of it**: both apps link to the license terms
(BDR's item 11: Android in 1.3, iOS in 2.0, 2.0.1 or 2.1); N9, print with
room to write. (/read opening the terms when a link names them was on this
list and shipped in PR #250.) N5, N6, B2 and D4 aren't placed in a phase;
they're small and fit wherever convenient. D7 waits on its open questions;
the KJV part could join N10 in phase 1c.

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
  second cue per color. **Yes.**
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
  **Yes.**
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
  **Yes; BDR is also considering a Mac app.**
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
- **C25. Ribbons need a rule for when they move.** **Yes** (see B1).
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
  See "Still open".

## Still open

- **Margin notes while the Notebook panel is open** (raised 2026-10-06;
  BVJ to decide before phase 1c builds the margin). With the panel now in
  the right margin beside the text, the left margin's notes (placement 2,
  N1) and the panel's "This chapter" list would show a chapter's notes
  twice. An open panel also takes room on the left, since the text moves
  left when the margin can't hold it (on an article at 1162px, about 140px
  is left, against the margin's 230px). The options:
  1. **Keep both.** The two do different jobs (notes in place, an index),
     so the doubling is tolerable.
  2. **The open panel stands in for the margin.** Its "This chapter" list
     follows the reading position, picking out the notes for the verses on
     screen, and the left margin shows nothing until the panel closes.
  3. **The margin shows only dots while the panel is open**, each linking to
     its note in the panel.

  **Recommendation: option 2.** It removes the doubling, frees the left
  side exactly when room is tightest, and the panel's list is already in
  verse order. Related: whether notes on articles (N11) use the margin at
  all.
- **The merge and overlap rules** (talk-through item 20), needed from BDR
  before phase 1c. The trash record's fields (question 4) are built
  provisionally in 1b, so BDR's answer may mean a migration.
- **"To be decided"** under "The apps' replies", starting with plan A or
  plan B. The record format is drafted (`STUDY-DESK-FORMAT.md`) and waits on
  both apps' review.
- **D7**: whether API.bible's tracking script is acceptable; which other
  free-to-share translations join the KJV; whether to request NRSVue and CEB
  licenses (and whether to have them drafted); whether the donation page
  fits API.bible's free plan.
- **Topics and tags.** BVJ is considering renaming today's topics to "tags"
  and curating a smaller set of thematic study topics. If so: the chapter
  JSON's `topics` field and `/api/data/topics.json` keep their names, because
  the apps read them (rename on screen only, unless BDR changes the apps);
  M8's personal tags need another name, such as labels; and a curated topic
  could be published as a LIT-made sheet readers copy into their notebooks,
  reviving the feature audit's X6 (browsable topic pages, deferred
  2026-09-28) on the sheet machinery. Today's topics follow TOPICS.md and are
  functionally tags for search reach.
- **D8, the tutorial**: what counts as the first encounter, and how it meets
  D6's first-time choice.
- **Whether to release the notebook after phase 1d**, decided when 1d is
  done.
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
  `--reading-measure` 60. At the chosen 52: 590px and 755px.
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
