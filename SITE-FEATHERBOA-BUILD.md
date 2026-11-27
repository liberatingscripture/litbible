# Building Featherboa

How Featherboa gets built. `SITE-FEATHERBOA.md` (the record) says **what**
to build, with BVJ's words and reasons. This file says **how**: the order of
work, the rules that keep the build faithful to the record, how it is
checked, and how the questions reach BVJ. BVJ makes every call (2026-11-27:
“I make all the calls”).

**Status: approved by BVJ on 2026-11-27**, with the answers in "Questions
answered before the run." An Opus session at maximum effort builds it, with
subagents, running as far as it can without asking. The sections
"Progress" and "The queue" are the run's own to edit; every other section
changes only with BVJ's say.

## The run in one paragraph

One branch, `claude/featherboa-build`, cut from `main` in a fresh worktree,
with a draft pull request opened at once so CI runs on every push and
Cloudflare Pages keeps a preview of the branch at
`claude-featherboa-build.litbible.pages.dev`. Fifteen phases (0 to 14),
foundations first, then the public site, then Study, then the switch that
opens Study to every computer, since **Featherboa and Study's public beta
launch together, by one merge** (BVJ, 2026-11-27). Each phase starts by
merging `main` in, ends with every check green and the preview updated, and
marks its rows in the ledger. Where the record doesn't settle something,
the run takes the most reversible choice that follows the record's own
rules, writes it in "The queue," and keeps going; the queue goes to BVJ at
the two checkpoints. Nothing goes to `main` until BVJ merges the pull
request.

## Rules for the run

### Fidelity

1. **The record is the specification.** Before building a part, read its
   section of `SITE-FEATHERBOA.md` whole, and the sections it points to.
   Build what it says, in its words. A label, a name, or a sentence in
   reader-facing text comes from the record when the record gives it.
2. **Where two sections disagree, the later decision wins**, and the record
   says so in the later one. The pairs are listed under "Where the record
   reverses itself" below, so none is built from the superseded half.
3. **Nothing outside the record without a note.** "The kit" says it: if a
   screen needs something the record doesn't draw, that is a design
   conversation before it is code. The run takes the nearest pattern the
   record does decide, builds it, and writes it in the queue with what it
   chose, why, and what it would cost to change. It never invents a new
   control, color, size, or word for a reader when a decided one serves.
4. **Site 2.0's decisions don't carry over** (BVJ, 2026-11-26). A 2.0 page
   is not a precedent; only the record is.
5. **The ledger is the checklist.** Phase 0 turns every decision in the
   record into a row (below). A phase isn't done until each of its rows is
   built and checked, or queued with a reason.

### What the run never changes

Any of these is a **hard stop**: the run leaves it alone, writes the
question in the queue as blocking, and works on something else.

- **The apps' contract**: `public/api/` and everything that generates it
  (`src/data/` but the release-notes skip file, `src/content/glossary/`,
  `src/data/intros/`, and the `scripts/build-*` steps that write
  `public/api/`, `public/glossary.json`, the manifest, and the release-notes
  feed). `git diff origin/main...HEAD` over those paths stays empty. The
  glossary's Greek spelling is read at build time from
  `scripts/lib/glossary-lemmas.mjs`, never added to an entry.
- **Scripture and the owner's words**: chapter JSON, footnotes, intros,
  articles, glossary entries, the letter on Home, the license terms, About,
  and every page BVJ wrote. The record moves some of them (the license to
  its own page, the letter whole on Home) with the words unchanged.
- **The record format** (`STUDY-DESK-FORMAT.md`) except the one change the
  record makes (Sheets' Style fonts: "Sans" and "Handwriting" leave the
  set), and the encryption spec, the sync, and the notebook service, which
  Featherboa doesn't touch ("First visit, signing in, and sync").
- **The mirrored /apps files** (`src/components/apps/CLAUDE.md`): byte for
  byte the LSC site's too.
- **Merging, pushing to `main`, deploying a Worker, or anything in a
  dashboard.** The run pushes only its own branch.

### Words

- American conventions, the Oxford comma, curly quotes, and no em dashes in
  any reader-facing text the run writes (root `CLAUDE.md`, "Key
  Conventions").
- Labels follow "Controls": verb then thing, sentence case, an ellipsis
  only when more is asked, no "My," no articles.
- **"Study," never "Study Desk,"** in anything a reader sees; code and
  records keep `desk-*`, `data-desk`, and `STUDY-DESK.md`. The reading page
  is "the Read page" in docs; reader labels are worded case by case ("Read
  Romans 8").
- Drafts of words that wait for someone else are marked in the queue: the
  account and privacy words wait for step SK5 ("First visit, signing in,
  and sync").

### Code

- The repo's rules stand: every dark style in both selectors, text columns
  sized in `--ch`, focus rings from `--focus-ring`, every page working
  without JavaScript, reduced motion honored, a link off the site in a new
  tab with `rel="noopener noreferrer"`, the Study code downloaded only with
  `data-desk="on"`, and the chapter-file and alignment rules (root
  `CLAUDE.md`, "Rules that apply everywhere").
- **Docs move with the code.** Each area `CLAUDE.md` holds notes of the
  form "Featherboa … (`SITE-FEATHERBOA.md`, "…"); until it is built, this
  holds" (58 of them in 13 files on 2026-11-27). When the part is built, the
  note becomes the rule, in the same commit, and the old rule goes. The
  docs test's size limits hold; move detail rather than raise them.
- **Tests follow the new behavior.** A test that checks old markup or
  wording is rewritten to check the new; a test that guards a contract (the
  API, chapter files, the print credit, the license anchors, storage keys,
  the CSP) is never weakened. New rules get tests (below).
- **Subagents** follow the root `CLAUDE.md` rule: at most two Sonnet, two
  Haiku, and one Opus at a time. Haiku for fully specified mechanical
  passes (pointing every transition at a duration token, a rename across
  files); Sonnet for a scoped component or a test rewrite; Opus for the
  ledger, Study's architecture, and the audits. Two tasks that touch the
  same files run one after the other. Subagents work in the run's own
  worktree.

## Where the record reverses itself

Build the right-hand side.

| Earlier | Later, and built |
|---|---|
| "Study Desk," "Open in Study Desk," and "Study Desk ▾" ("Controls," "The reading page," "Finding a passage," "Search," "The Study Desk") | The page is **Study** at **/study**, and the link is the verb and the passage, **"Study Romans 8"**, in the place line and in Search's second row ("Study and its places," "The names") |
| Study's title row with the heading "Study Desk" ("The Study Desk"), then no heading ("Study and its places") | The row carries the line under the header: "Fold sidebar," "Study / Sheets ▾ / Advent 2 handout," then the pane count and Full screen ("Four places: the header") |
| Sheets and collections as tabs in any pane; two sheets side by side; dragging from the sidebar onto a pane ("The Study Desk") | Places of their own on the Study page, with a pane beside ("Study and its places") |
| The Notebook as the Notes tab on "Everything" ("The Study Desk," "The Notebook") | The Notebook is a place; the Notes tab lists "This chapter," with "All 128 in the Notebook" |
| The Trash as a tab | A place of one pane |
| The Read page's Notebook panel with four tabs, Greek among them ("Beside scripture") | Three tabs: Notes, Footnotes, This verse; This verse's Greek words open Study ("The Greek is Study's") |
| Study's row in the widths table, "A 236 sidebar that never moves" | A sidebar that folds to icons ("The sidebar") |
| The drop numeral on the screen ("The reading page") | Gone on the screen, kept on paper ("A whole book," "Off the screen") |
| The way on at every chapter's foot ("The reading page") | At the book's end, and at each chapter's foot without JavaScript ("A whole book") |
| "In the notes ↓" going to the list at the chapter's end ("The reading page") | The Notebook's Footnotes tab at the note where the panel runs, the Footnotes sheet or panel elsewhere ("A whole book," "The phone") |
| Display's "Verse numbers" | "Verse and chapter numbers," hiding the chapters' headings too ("A whole book") |
| /read's rest staying under the picker | Split: /read is the picker at full size, the license its own page ("Finding a passage") |
| A "Select" button for the desk's lists | Choosing rows, then acting ("The Notebook," "Select, then act") |
| The bulk deletes on choosing rows | All settings' last section, "Delete in bulk" ("The Notebook") |
| News behind a dot beside About | Marked where its subject lives; Release Notes and the What's New page placed in "Four places: the header" |
| "My Notes," "My Notebook," "Scripture page(s)" (E70, BA138, E130) | "Notes," "Notebook," "the Read page" ("Controls," "Study and its places") |

Two pairs the record had left unsettled are settled in its last decided
section, "Decided with the build plan": Search's tab is "Notebook," and
License is among About's rows. That section holds wherever it differs from
an earlier one.

## Branch, preview, and launch

- **The branch** is `claude/featherboa-build`, cut from `main` in a new
  worktree. It is pushed after every phase, and more often when a phase is
  long. `main` is merged in (never rebased: the branch is pushed and has a
  pull request) at the start of each phase and whenever a pull request
  touching the same files lands. A conflict keeps `main`'s behavior and
  reapplies Featherboa's look and structure to it; the merge commit says
  what was resolved.
- **The pull request** is opened as a draft in Phase 0, titled "Featherboa:
  the site's new design," with Auto-fix on (never auto-merge). Its
  description carries the phase list and links this file; each phase adds a
  line. It says that `/privacy` changes (Phase 9 renames Study there), so
  the LSC notice will fire at merge (`src/pages/CLAUDE.md`, rule 1).
- **The preview** is Cloudflare Pages' build of the branch. Pages marks
  preview builds noindex; check the header once. The Study parts need
  `?desk=on` once on that address, as on the live site.
- **Checkpoint A** comes after Phase 8, when the public site is done: an
  audit and the queue to BVJ. The run keeps going into Phase 9 while BVJ
  answers.
- **Checkpoint B** comes after Phase 14: the final audit, the queue, and
  the launch list.
- **The launch is BVJ's merge, and it launches both** (BVJ, 2026-11-27:
  the public site and Study "launch together"). Until Phase 14, the branch
  keeps Study behind the preview switch, as `main` does, so the preview
  shows Study with `?desk=on`; Phase 14 makes it every computer's, so that
  merging is Study's public beta too (`STUDY-DESK.md`, "Launching"). There
  is no state in which a computer has the new site without Study, so none
  is designed. The merge method is a merge commit, so each phase stays a
  unit for a later bisect. The merge commit touches
  `src/data/release-notes-skip.md` (a design isn't a text change) and logs
  why there. BVJ times the merge.
- **Study work on `main` continues meanwhile** (the sync, the service, and
  BDR's work), and Phases 9 to 13 collide with any of it that changes
  Study's interface. The run merges `main` at the start of each phase and
  resolves the conflicts, keeping `main`'s behavior.

## The ledger

Phase 0 writes `FEATHERBOA-LEDGER.md` at the root, with a row in the root
`CLAUDE.md`'s Important Files table.

- **One row per decision**, in the record's order: every bullet, every row
  of a decision table, and every "goes," "stays," and "kept." An ID by
  section (TY Type, CO Color, SU Surfaces, SZ Sizes, CT Controls, KT the
  kit, MO Motion, NI Night, NX Nothing interrupts, RP the reading page, BS
  Beside scripture, FP Finding a passage, DI Display, WB A whole book, PH
  the phone, SE Search, GL the glossary and articles, OS Off the screen, HD
  Four places, FR the front page, SD the Study Desk, NB the Notebook, SH
  Sheets, ST Study and its places, GK the Greek, AC First visit and sync,
  SM Small screens, DA the dares), then a number: `RP-07`.
- **Columns**: ID, the decision in one line (the record's words where they
  fit), the phase, how it is checked (a test's name, a measurement, or what
  to look at in the preview), and its state: open, built (the commit),
  checked, or queued (the queue's number). A row superseded by a later one
  ("Where the record reverses itself") is marked so and points at it.
- **Made by an Opus subagent and checked by a Sonnet one** that reads the
  record without the ledger and lists any decision it can't find a row for.
  The run adds the missing rows before Phase 1.

## Order of work

Each phase names the record's sections it builds, the code it mainly
touches, and what has to be true before it is done. File names are from a
survey on 2026-11-27; grep when one has moved.

### Phase 0: Set up, clear Site 2.0, write the ledger

- The worktree, the branch, `npm install` in the worktree (it then has its
  own `node_modules`), the draft pull request, and Auto-fix.
- **Site 2.0's code goes** (if BVJ says so, question 2): `src/styles/v2/`
  (24 files), `restyle.css`, the four `v2-*.js` scripts, the `data-v2`
  elements (80 in 32 files; their `data-v1` twins stay, unwrapped), every
  `data-restyle` rule left in the other stylesheets, the stamp and the
  critical CSS in `Layout.astro`, and the tests that hold them
  (`restyle-css`, `site2-css`, `v2-*`). First save, in the ledger's notes,
  what Phase 3 reuses: `v2-scripture.js`'s hiding of the phone's bar on a
  scroll down and its return on a scroll up. `SITE-2.0.md` stays as the
  record, with a first line saying Featherboa replaced it.
- The ledger, made and checked.
- **Baselines**, written into this file's "Progress": the font bytes and the
  gzipped page weight of `dist/john-3/` and the home page, from a build of
  `main`, and the current contrast pairs.

Done when: the build, tests, and links pass with 2.0 gone and the site
looking as it does on `main` without the preview; the ledger is complete.

### Phase 1: Foundations

"Type," "Color," "Surfaces," "Sizes, space, and the measure," "Motion,"
and "Night."

- **Fonts**: add `@fontsource-variable/fraunces` (check that its files
  carry the `SOFT` and `WONK` axes, and serve only the axes and weights
  used) and `@fontsource-variable/source-sans-3` (Latin and polytonic
  Greek). Literata waits for Phase 11, where only a sheet uses it.
  Atkinson Hyperlegible Next, OpenDyslexic, Cardo, Noto Sans Hebrew, and
  the two built fonts in `public/fonts/` stay. **Inter and Crimson Text
  leave every page but /apps** (question 9 keeps /apps' faces); the verse
  image keeps them until Phase 8, and a sheet's stored "Sans" until Phase
  11. `Layout.astro`'s preloads follow.
- **One token file**, `src/styles/tokens.css`, imported first: the colors
  by day and by night (paper, ink and its 78% and 66%, LIT Green, deep
  green, sunshine, red, the four highlighter washes by night), the ten
  sizes, the nine spacing steps, the two radii, the one shadow, the four
  durations and the curve, the focus ring, and `--ch` per face. The
  existing custom properties in `global.css` point at the tokens or go.
- **The three reading sizes refit**: measure Source Sans 3's x-height
  against the proposal's drawing, as "Type" found 20.2px for Inter's 18,
  and check the line heights. The measure stays 45 to 75 characters in
  every face, at every size, through `--ch`.
- **Fraunces's settings**: the specimen's to start (question 12).
- **Surfaces**: the cream and the sheet go; space, then a hairline, then a
  tint; the one shadow only on what floats. **Motion**: one pass pointing
  every transition and animation at a token (a Haiku task). **Night**: the
  dark page `#111411`, text `#ECEEE8`, green lifted to `#2DB463`, depth by a
  lighter surface and a hairline.
- **New tests**: the token values; the contrast table, computed from the
  tokens with the WCAG formula, by day and by night, at the record's
  thresholds; no transition outside the four durations; no font family
  outside the decided faces (but /apps).

Done when: every page is in the new faces, colors, and spacing, on the old
layouts. John 1 on the preview is the proposal's specimen page, ready for
BVJ's look and the five-reader test (question 11).

### Phase 2: The kit and its words

"Controls" and "The kit."

- `src/styles/kit.css`: the ten controls in five states, used by the
  header, the reading page, and the desk, in place of the button rules in
  `global.css`, `desk.css` (E126's four kinds), and the page stylesheets.
  Unavailable stays legible (4.5:1, never `opacity`), its reason reachable
  without a pointer. Six-pixel corners on what is pressed; switches, color
  dots, and the emblem the only round things.
- **The icon set**: the sixteen icons the record names, on a 24-pixel grid,
  1.5-pixel stroke, round ends (question 10 on their source), in one module
  that both `.astro` files and client scripts read
  (`src/lib/icons.mjs`), since the desk builds its interface in script.
  Typed glyphs (× ‹ › ▾) stop standing in for icons.
- **The labels' grammar and renames** ("Controls"' table), done here for
  the shared pieces and with each surface's own phase for the rest.
- Today's green-filled pills become tabs or a row of choices; "on" is a
  fill or a green underline with a heavier weight (E160 settled).

Done when: no button rule outside `kit.css`; every control on every page
draws from the kit; the icon module serves both sides.

### Phase 3: The header, the line under it, the footer, and the phone's bars

"Four places: the header," and "The phone"'s two bars and menu.

- `SiteHeader.astro` and `header-menus.js`: Read, Study, Learn, and About,
  the current one underlined in green; menus with ▾ for Learn, Study, and
  About, with the record's names; "LIT Bible" always, so **the title swap
  retires** (its inline script, and `test/header-title.test.js`); Aa and
  the account at the right; the magnifier on every page but the Read page.
  **Study shows on a computer only**, never on a phone or tablet; until
  Phase 14 that means with the preview on.
- **The line under the header**, one component, on every page but Home,
  naming the page, with the page's one or two main commands at its right;
  pages in no menu mark no place.
- **News marks**: the dot on a header menu, "New" beside its item, cleared
  when that menu opens, read from one small data file, empty until there is
  news; a menu with a mark ends with "See what's new →," to the What's New
  page Phase 7 builds.
- **The footer**: the four groups and their names, then Privacy, the Terms
  of Use, the newsletter, and the links to the What's New page and the
  colophon (Phase 7 makes both).
- **The phone**: one row at the top (the emblem, the chapter's name as the
  picker, Aa), the bar at the thumb (Previous, Search, Menu, Next), both
  hiding together on a scroll down and returning on any scroll up (reuse
  2.0's logic), the progress line on the top row's edge, the menu as a
  sheet from the bar with Read, Learn, and About and "Get the app." The app
  banner stays above the row. Without JavaScript the bar is plain links.

Done when: the header, its line, and the footer are the same on every page,
at every width, by day and night, in all three faces, with and without the
Study preview.

### Phase 4: The Read page

"The reading page" (the page and its controls, the Justify switch, the
Reading layout's retirement), "Finding a passage," "Display," and "A whole
book."

- **The place line**: "John ▾ / Chapter 1 ▾," ‹ ›, Search, Notebook (with
  the Study preview), and "Study Romans 8" (linking `/desk` until Phase 9
  moves it to `/study`). The reading row's search box and Chapter View's
  toolbar go.
- **The picker**: one panel, from the book's name, G, or the header's Read;
  the typing field first (the 404 page's `resolveMistypedPath`, "Matthew
  intro," and "Search for ‘…’" when it isn't a passage), Continue reading,
  the 27 books in order with no groups, the chapter grid, the
  introduction, drafts marked "in progress," and Release Notes at its foot.
  `ReadMenu.astro` and its grid are the start.
- **/read becomes the picker at full size** under its lede; **the license
  moves to /license** with the owner's words unchanged, and `/read#license`,
  `#license-terms`, and `#sblgnt-disclaimer` forward to it (a script on
  /read, since a server redirect can't see an anchor), with the repo's own
  links (`LICENSE`, `CONTRIBUTING.md`, `public/llms.txt`, Terms, About)
  moved. "Ways to read" goes to the front page (Phase 7).
- **Continuous chapters**: each chapter keeps its address and opens as
  itself; with JavaScript the next loads below and the previous above, as
  the desk's text pane does (`desk-corpus.mjs`, `desk/lit-pane.js`), but
  without the desk; the address follows with `history.replaceState`; the
  arrows and keys go to a chapter's start, loading it first; each chapter
  after the first gets the close heading ("James 2," about 23px Fraunces,
  32px above, no rule) with **Go deeper at its right**; drafts as the desk
  loads them, as one entry per run, its line linking the Greek in Study;
  the footnote list and Go deeper stay in the page for printing, for
  readers without JavaScript, and for the desk's reader, and leave the
  reading flow on the screen. Continue reading follows the verse at the
  reading line. **The progress line** on the place line's edge, by verses.
- **Read View retires** (E8): `/read/<book>` forwards to chapter 1 and
  `#ch-N` to chapter N (`read-view-retirement.mjs` and
  `read-view-redirect.js` were prepared for this), and its page, layout,
  script, and styles go. **Focus retires**, and /privacy's line about it.
  The Reading layout's retirement (the Layout window's row, its rules, and
  `&layout=reading`) is Study's, in Phase 9.
- **The Display tray**: Text, Size (a small A, four dots, a large A), Line
  spacing, Justify (off by default, with hyphenation and E106's
  exceptions), Theme, View (Verse and chapter numbers, Footnote letters,
  Key terms, and Your marks with the preview), and "All settings →."
  **All settings** is a page every reader reaches (question 18 on its
  address), holding the keyboard switch, and with the preview the finer
  mark choices, backup, the account link, the panel's start setting, and
  last, Delete in bulk in red words. "Reset widths" goes; each drag line
  keeps its menu and reset, and the text column drags only within 45 to 75
  characters.

Done when: every chapter reads on into the next and back, at every width;
every old address and anchor lands; no reader setting is lost (each
`localStorage` key the tray wrote is still read, or migrated, and /privacy
names what is written).

### Phase 5: Beside scripture

"The reading page"'s margin, "Beside scripture," "Nothing interrupts the
reader," and "The phone"'s sheets.

- **The margin**: a footnote opens in the 320 margin, whole, floating with
  the one shadow over the reader's notes beside its line, scrolling inside
  itself when taller than the window, with "In the notes ↓"; another letter
  swaps it; it drags aside by its header and keeps Pin. Without a margin,
  the popover, whole. **The reader's notes** lie flat on a pale sunshine
  tint with a bar at the left, headed "Your note · verse 5," in the
  reader's Display face at the Margin size; **Playpen Sans and the "Plain"
  setting go**. The margin is reserved, so scripture never moves.
- **The verse menu**: Highlight, Note, Bookmark, and Copy across the top,
  each acting at once and then showing its choices beneath; then Add to
  sheet…, Add to collection…, Share… (Share text…, Share image…, Print),
  and Show in Notebook last. **The selection panel matches.** On a phone or
  tablet, where Study never runs, the phone's actions below.
- **The phone**: the verse sheet (Copy text, Copy link, Share text…, Share
  image…, then Copy with footnotes, no Print); a footnote as a sheet up to
  about half the screen, dragging to full height; the chapter heading's Go
  deeper opening a sheet with "Go deeper" and "Footnotes" tabs; on a tablet
  the same as a panel over the right edge.
- **The Notebook panel** (with the preview): Notes, Footnotes, This verse;
  it takes the margin's column while open; its title is the menu "Notebook
  ▾" (Print…, the whole notebook, Notebook actions, Take the tour, Help,
  Feedback); the Settings tab goes, each thing to the home "Beside
  scripture"'s table gives it; the foot line carries status and "Back up…"
  with the backup reminder's words.
- **Nothing interrupts**: the first-use card, the reminder bar, the tour's
  floating offer, and "Continue reading" chips go; "New here? Take the
  tour" joins the line after a reader's first highlight, note, or bookmark;
  the announcement popover is gated to launches only; the app banner stays
  on phones.

Done when: nothing opens over scripture unasked; every action of today's
menus and panel has its home; the phone's sheets work with a finger and the
computer's menus with a keyboard.

### Phase 6: Search

"Search," and "Searching the Greek."

- /search: the field is the page, the count at its end, a "Search" heading
  for screen readers; one row of tabs with counts (Scripture, Chapters
  about it, Glossary, Articles, Introductions, and with the preview
  Notebook and Greek, question 5); "All books ▾" and the sort at the row's
  end (Relevance, Bible order); results as reading, the word bold with a
  green underline, no sunshine; the reference answer first ("Go to John
  3:16," then "Study John 3:16" with the preview); the chapters line and
  the glossary line over the verses; Select at the row's end (with the
  preview) and the foot bar.
- **The same rows** under the place line's Search and the header's
  magnifier, with "See all results →."
- **"Build a search…"**: one quiet link in the field's row on the Greek tab
  only, wherever that row is, opening the window under that name (the
  builder, then the commands under their own heading); the window keeps its
  place and is restyled. Typed commands and the placeholder stay.
- `search-core.js`'s logic doesn't change.

### Phase 7: Learn, the front door, and every other page

"The glossary and articles," "The front page," "The dares," and the pages
no decision draws (question 8).

- **The glossary**: one page, the line "Learn / Glossary ▾ / trust" naming
  the entry in view, ‹ › between entries, the list's order switch; each
  entry's pair as its headline ("Traditionally" beside "In the LIT"), no
  arrow and no strike-through; "πίστις pistis" from the lemma map; "Where
  it appears" in the margin, under the entry with no margin. The opening's
  third paragraph is BVJ's words, so it stays as it is until BVJ answers at
  the review (the queue's first entry).
- **Articles and introductions**: the reading column and type, a Fraunces
  title, author and date on one line, the picture at the column's width,
  tags at the foot; "Introduction to Mark →" above chapter 1 and "Mark 1 →"
  at the intro's end.
- **The front page**, top to bottom as the record has it, with John 1:1–5
  drawn by the Read page's own components and its "Conversation" note open
  in the margin; the three panels in /apps' colors (Advent's blue
  `#1A4FA0`, Christmas red `#C62D25`, and Ordinary Time's green `#186420`,
  their night values with them), the Study panel only with the preview; the
  four questions as a list; on a phone the same order (question 17). The
  conversation and its Luke 3 go.
- **The italic lines** (question 14) and **/colophon**, "How this site is
  made," linked from the footer, with Claude's draft of its sentence about
  AI in place and marked in the queue for BVJ's answer at the review
  (question 15).
- **The What's New page** at `/whats-new` (question 7): news that isn't a
  change to the text, written by hand in one data file, with no feed (the
  apps don't read it, and nothing writes it automatically). It follows the
  Display tray's size and spacing, with its column in `--ch`. Its entries:
  the apps, dated to the day they were released (find the date in the
  repo's record; queue it if unsure); the new site, never calling it
  "Featherboa," which isn't a public name; and, made near the end of the
  run once Study is built, the Study page and its features as a mock-up for
  BVJ's review. The entries' words are drafts in the queue.
- **Every other page** takes the foundations, the header and its line, and
  the footer (question 8). /apps takes only the header and footer (question
  9).

### Phase 8: Off the screen

"Off the screen: print and the verse image."

- `print.css`: Source Sans 3 and Fraunces, 12pt times the reader's size
  refit, the drop numeral, a running head and footer in page-margin boxes
  (the passage and "Liberation and Inclusion Translation"; the address and
  `LIT_CREDIT_LINE`), page numbers by the Sheets' rule, the footnotes after
  the chapter in two columns with no note cut, and the end notice kept for
  browsers without margin boxes. A print is one chapter, the one in view.
- **The verse image**: the verse in Source Sans 3, one small line (the
  emblem and the reference in Fraunces at the left; the name over the
  address at the right), the green bar gone, Inter gone. Ink, Paper,
  Square, Story, and the one button stay.
- **Handouts**: a sheet's paper copy takes the same head, faces, and footer
  (Phase 11 finishes the sheet's side).
- Checked by real PDFs from headless Chrome against a built `dist/`, in
  print media with the fonts loaded first (`src/scripts/CLAUDE.md`,
  "Printing and handouts"), and the drawn glyphs read from the content
  stream where a ligature matters.

### Checkpoint A: the public site

- **The audit**: an Opus subagent, given the record and the preview's
  address but not the ledger or the run's notes, checks every public
  section against the built site and lists what differs. The run fixes
  what is a miss, and queues what is a judgment.
- The ledger's public rows all checked or queued; the docs and tests
  current.
- **The queue goes to BVJ**, and the run goes on to Phase 9.

### Phase 9: Study's frame

"The Study Desk," "Study and its places," and the Reading layout's
retirement. The largest phase; `src/scripts/desk/` is some 47,000 lines and
`src/lib/desk-*.mjs` 27,000.

- **The Study page at /study**, `/desk` not forwarding; /notebook, /sheets
  (with `?id=`, present mode, and shared links), and /collections opening
  their places; the help page at `/study/help`.
- **The site's header** with Study underlined, and **the title row as the
  line**: "Fold sidebar," "Study / Sheets ▾ / Advent 2 handout," then
  "Panes 1 2 3" and Full screen. The desk's own header mode
  (`SiteHeader`'s `deskTitle`), the command row (`command-row.js`), and the
  title menu (`title-menu.js`) go, each command to its home.
- **The sidebar**: Scripture (with its passage at the right), Notebook,
  Sheets (the three most recent and All sheets), Collections (the same),
  Trash; at its foot New…, Help with Start here and Feedback, the stage
  badge (`DESK_STAGE`), and the status line. It folds to icons with words
  and remembers.
- **Scripture's panes of tabs**: one to three panes, each a row of tabs
  (the LIT, Greek, Footnotes, This verse, Notes, Search), More with "Open
  in this pane ▸," "Move this tab to," "Pin to this passage," and Close; ×
  on hover or focus; "2 more ▾"; the green underline marking the working
  pane; nothing replaced; tabs dragged between panes; widths per count;
  following; a new reader's two panes. **Gone**: the eleven arrangements
  but the three, the fourth pane (`MAX_PANES`), the Layout window, Add pane,
  splitting by an edge, "My default," and the Reading layout. A saved
  layout with rows reopens as panes.
- **The places**: the Notebook, a sheet, and a collection as places with a
  pane beside (Panes 1 2), each with the tabs "What each place shows beside
  it" gives it and its opening state; the Trash as one pane; the magnifier
  and "/" opening Search beside the place.
- **The renames in reader text**: "Study Desk" to "Study" (93 times in
  `src/pages/`, 23 in `src/components/`, 273 in `src/scripts/` on
  2026-11-27), the help page rewritten for the new frame, and "Chapter
  View" and "Read View" out of every label. Privacy's four and the Terms'
  one included.

### Phase 10: The Notebook place

"The Notebook."

- The list ("128 kept, in Bible order"), Kind ▾, Color ▾, and Label ▾ with
  counts, filtering by words; rows carrying only the reader's words and a
  small line; choosing rows, then Edit, Label…, Add to collection…, and
  Delete… at the pane row's end, folding into More when they don't fit;
  choosing a note moving the LIT tab beside to its verse with the note in
  the margin; "Changed since you marked it," its rows saying "Text changed
  Nov 1" as a link; Manage labels…, labels on bookmarks only (E149); "Back
  up…" holding Merge; every /notebook anchor kept (`#backup`,
  `#whats-new`, `#q=`, `#labels`).

### Phase 11: Sheets, collections, and shared sheets

"Sheets," "Shared sheets," "A sheet's page," and the collection place.

- The editor is the page at the paper's proportions on a tinted desk;
  pages where the pane holds them, 80% at most beside a pane, then
  reflowed at true size; Edit and Preview retire; a chosen part's green bar
  and its small line of controls; leader-only parts dashed.
- The formatting bar over the part with the cursor (Bold, Italic, Link,
  Paragraph ▾, List ▾, More formatting ▾ with the rest of BVJ's set);
  Style's fonts Source Sans 3, Literata (loaded only here), Fraunces, and
  Atkinson Next, with "Sans" and "Handwriting" leaving the format's set
  (`STUDY-DESK-FORMAT.md` changed with a note for BDR).
- "Leader's copy" and "Participant's copy" on the screen; Print…, Share…,
  and a filled Present, then More; the Add row with Page break; New sheet…
  listing the seven templates; present mode in Source Sans 3 and Fraunces,
  dark, blanks covered until revealed; the Sheets tour rewritten.
- A collection beside a sheet, as the record draws it, and the collection's
  own place.
- **The phone's shared-sheet viewer** takes all of it in
  `desk-sheet-view.css` alone, within Safari 16.4, and its test holds that.

### Phase 12: The Greek in Study

"The Greek."

- Source Sans 3's Greek set as text, verse numbers in ink at 66%, a word's
  forms gray on hover and green when chosen (22% and 12%), no underline;
  the card's rows (the word and "λόγος logos," Form, In the LIT here,
  Dictionary as a row of choices with "A lexicon and the LIT can differ,"
  Elsewhere, "Find this word ▾," and "Add note"); results in a Search tab
  beside the Greek (E219 reversed); on a draft, "Add note" unavailable with
  its reason, and the selection's menu the same; everything "Kept from
  today" kept. The partner word doesn't light (it waits for the word links).

### Phase 13: First visit, signing in, status, small screens, and the tours

"First visit, signing in, and sync," and "Small screens."

- Study's empty state, with "Take the tour" filled and both setup and
  sign-in at its foot, replacing the first-use card; the sign-in screen
  with Apple and Google first, a passkey third; the recovery code shown only
  with End-to-end encryption, typed back; the status lines, one set of
  words at the sidebar's foot, the panel's foot, and the account menu; a
  stop as the foot line and a dot; the two notices that keep their bar;
  the account pages in Featherboa's look. The words are Claude's drafts
  until step SK5.
- On a phone or tablet, /study says so in one sentence with the two store
  links (question 16), and the account page uses it.
- **The tours** rewritten for the new frame: "Start here" heading Study
  until taken, the Study tour, and the Sheets tour (E63).
- The What's New page's Study entry, as a mock-up (Phase 7).

### Phase 14: The launch switch

Study's public beta, so that the one merge launches both. The list is the
desk's own, `src/scripts/desk/CLAUDE.md`, "Launching," items 1 to 12, then
its grep, read with the record. Featherboa changes two of its items: "Show
the Notebook" is now the Notebook button on the place line ("Display"), and
Read View has already retired in Phase 4.

- The pre-paint stamp stops requiring the preview on a computer; phones and
  tablets stay without Study; `?desk=on`, `?desk=off`, and
  `lit-desk-preview` retire, and `/privacy` drops the key.
- Every reader of the stamp (`search-core.js`'s gates, `desk-gate.js`,
  `desk-frame.js`, the keyboard's `h`, the shared sheet's gate, the
  layouts, the header) works for every computer; the pages' preview copy
  goes.
- `DESK_STAGE` reads "beta" (the badge at the sidebar's foot). Whether a
  beta stage is left if the opening and sync land on the same day is open
  in `STUDY-DESK.md`, so it goes in the queue.
- Indexing for /study and its help (a decision in that list), `llms.txt`,
  the README, and every "preview" in the docs.
- **The launch's announcement window** (launches only, under
  `src/components/CLAUDE.md`'s rules): Study's opening and the What's New
  page, one window, its words a draft in the queue; "Study · New" on the
  header's menu and the front page's band for a set time that BVJ names.
- `STUDY-DESK.md`'s "Before launch" list is checked: what is done, and what
  is BVJ's or BDR's (the trusted readers, the real-device audit, BDR's
  review of the format) goes in the launch list.

### Checkpoint B: the whole build

- The audit again, for Study's sections, unanchored as before; then one
  last pass over the whole ledger.
- The docs: each area file's Featherboa notes turned into rules; the root
  `CLAUDE.md`'s "Chapter View and Read View" convention replaced by the
  Read page's; the README; `SITE-FEATHERBOA.md` saying "Built" under each
  section with the commit; the memory updated.
- The weight measured against Phase 0's baselines, and the fonts trimmed to
  what is used.
- **The launch list** for BVJ: the merge (the site and Study's public beta
  at once), the release-notes skip, the LSC notice for `/privacy`, BDR's
  note about `/license` and the Sheets' font set, what is left of
  `STUDY-DESK.md`'s "Before launch," and Cloudflare's 404s and
  `/read/<book>` traffic to watch in the first weeks.
- **The queue to BVJ.**

## Checks

### Every phase

- `npm test`, `npm run check`, `npm run validate:chapters`, `npm run
  build`, and `npm run check:links`, all green; `npm ci` once whenever
  `package-lock.json` changed (an install can leave an old version in
  place).
- **The contract guard**: `git diff --stat origin/main...HEAD` over the
  paths in "What the run never changes" is empty. A build rewrites
  `src/data/podcast-feed.xml`; restore it after each build and never commit
  it.
- **The rendered check**: build the branch and serve its own `dist/`
  (never trust a dev server started from a worktree: it may serve `main`),
  then look in the Browser pane at 1440, 1100, 820, and 390 pixels, by day
  and by night, in the three faces, at the smallest and largest sizes, with
  and without `?desk=on`. Read the accessibility tree (`read_page`) for
  names, headings, and landmarks; walk the new controls with the keyboard.
  Check one page with JavaScript off (headless Chrome or the built HTML).
  The memory's notes on the Browser pane apply: no hyphenation there, no
  animation frames while it is hidden, a narrow width emulates a phone.
- The phase's ledger rows marked, "Progress" updated, committed, and
  pushed.

### New tests the build adds

- The token values, and **the contrast table computed from them**, by day
  and by night (4.5:1 for words, 3:1 for LIT Green's marks).
- No transition or animation outside the four durations; no `font-family`
  outside the decided faces (and /apps'); no radius but 6, 10, and a
  switch's round; one shadow token; no spacing value off the scale in the
  new stylesheets.
- No `opacity` on an unavailable control; every dark rule in both
  selectors; `--ch`, never `ch`.
- The old addresses: `/read/<book>`, `#ch-N`, `/read#license`,
  `#license-terms`, `#sblgnt-disclaimer`, and the /notebook anchors.
- Continuous chapters: the address follows without adding history; the
  arrows load and land; drafts as one entry; printing is one chapter.
- No reader-facing "Study Desk," "Chapter View," "Read View," or "My " in
  labels (with the record's exceptions).

### What the build can't check, for BVJ at the end

From "Landing it"'s "What I have not checked," and the desk's real-device
audit:

- **The five-reader test** on the specimen (question 11).
- **Real phones**: an iPhone in Safari and an Android phone in Chrome, on
  the preview (the bars hiding, the sheets dragging, the picker).
- **A Mac with Safari and VoiceOver**, and a screen reader pass on the
  place line, the picker, and the margin notes.
- **Paper**: a printed chapter and a printed sheet, on a real printer.
- **The words** marked as drafts in the queue.

## The queue

How a question waits. The run adds to it; BVJ answers at a checkpoint.

- **One entry per question**: a number (Q1, Q2…), the ledger rows or the
  place in the code it concerns, the question in one sentence, what the
  run did meanwhile, the other choices, and what changing it would cost.
- **Blocking** questions (a hard stop above) are marked so and listed
  first; the run works around them.
- **Asked at Checkpoints A and B**, all at once, in plain words with a
  recommendation for each, as BVJ prefers; answers recorded here and in
  the record when they are decisions, and built.

Entered before the run, from BVJ's answers:

- **Q1. The glossary's third opening paragraph** (BVJ: “ask me at the
  review”). It describes today's styling ("in bold… In italics…
  Underlined…"), so it stops matching in Phase 7, but it is BVJ's, so it
  stays until answered. Claude's draft: “As you look through the entries
  below, you’ll find the traditional word on the left and, on the right,
  what the LIT Bible uses in its place most often (it can change based on
  context). Under them is the Greek behind it.”
- **Q2. The colophon's sentence about AI** (BVJ: “ask me at the review.
  You can draft it, but we'll see what is decided”). The run drafts it and
  puts it in place, marked here; BVJ words it, keeps it, or drops it. If it
  stays, the page says as plainly who translates the text. Claude's first
  draft: “People make every decision about this site, and much of its code
  is written with Claude, an AI model made by Anthropic. The translation is
  not: Brandon translates every word of the LIT.”
- **Q3. The What's New page's words**: the apps' entry and its date, the
  new site's entry, and the Study entry as a mock-up (Phase 7 and Phase
  13).
- **Q4. The launch's words**: the announcement window, and the band's and
  the mark's set time (Phase 14).
- **Q5. Study's stage at launch**: "beta," unless the opening and sync land
  on the same day (Phase 14; `STUDY-DESK.md`, "Launching").

Entered by the run:

- **Q6. The new-tab mark** (Phase 0; `SITE-FEATHERBOA.md` has no row for
  it). Site 2.0's `restyle.css` drew E71's open-page mark after every link
  that opens a new tab, prose included (D7 of E132, BVJ 2026-11-13), and
  it went with `restyle.css`; the Study Desk's own marks (`newTabMark`,
  E71) stay. The record draws no mark. Meanwhile: none on prose links.
  Other choices: a mark in the kit (Phase 2) from the icon set, after the
  link's last word, kept off pictures, icons, and /apps' body as D7 was.
  Cost: one rule and one icon; the period-after-a-link case 2.0 handled
  (BVJ, 2026-11-17) comes back with it.

## Questions answered before the run

Eighteen questions put to BVJ on 2026-11-27, each with Claude's
recommendation, and BVJ's answers. The run follows them.

1. **The launch's shape.** One branch and its preview, launched by one
   merge (Claude's recommendation, over a switch on the live site as Site
   2.0 had, which keeps two versions of every page in the code). BVJ: **the
   site and Study "launch together,"** so Checkpoint A offers no early
   launch, and Phase 14 makes the one merge Study's public beta too.
2. **Site 2.0's code is removed** at the start, its phone bar's scroll
   logic kept for the new bars, and `SITE-2.0.md` kept as the record. BVJ:
   yes.
3. **A computer without Study.** Claude proposed a design for computer
   readers before Study's public beta. BVJ: **they launch together**, so
   there is no such reader and nothing is designed for one. Phones and
   tablets, which never get Study, are drawn by "The phone."
4. **Study's rebuild comes in this run.** BVJ: “It can be fully built
   because they launch together.” Claude's suggestion that other Study
   interface work on `main` pause meanwhile wasn't taken up; the run merges
   `main` and resolves ("Branch, preview, and launch").
5. **Search's tab for the reader's notes is "Notebook,"** not "My
   Notebook" as "Search" recorded it, by "Controls"' rule of no "My." BVJ:
   yes.
6. **License in About's menu**, which "Four places"' list had left out.
   The rows: The LIT, Commitments, License, The Collective, Apps, Release
   Notes, Support, Contact. BVJ: yes.
7. **The What's New page.** Claude proposed leaving it out of the run for
   its own design and a feed. BVJ: “There isn't a feed. It's not automatic
   like the release notes. You can build it with an announcement about the
   apps, dated to when the apps were released, and an announcement about
   the new site (Featherboa, but that's not a public facing name), and the
   Study page and its features as a mock-up near the end.” Built in Phase
   7, its Study entry in Phase 13.
8. **The pages no decision draws** (About, Commitments, the Collective,
   Contact, App support, Support, Courses, Podcast, Privacy, Terms,
   Unsubscribe, the 404 page, Release Notes, the delete-account page, and
   the account pages) take the foundations, the header and its line, and
   the footer, with their words and order as today and no new layouts. /read
   is the picker at full size under its lede, and /license the owner's words
   in the reading column. BVJ looks at them on the preview, and any BVJ
   wants redrawn becomes its own decision. BVJ: yes.
9. **/apps keeps its own look and faces**, inside the new header and
   footer, since its stylesheet is a byte-for-byte mirror of the LSC site's
   and names Inter and Crimson Text; moving it is a change on both sites,
   for BDR and BVJ later. BVJ: yes.
10. **The icons come from Lucide** (an open set under the ISC license, drawn
    on a 24-pixel grid with round ends), set to the 1.5-pixel stroke and
    credited in the colophon, rather than drawn from scratch. BVJ: yes.
11. **The specimen and the five-reader test**: John 1 is on the preview at
    the end of Phase 1, and the run doesn't wait for the test; BVJ runs it
    when BVJ likes and stops the run if it shows a problem. BVJ: yes.
12. **Fraunces's settings** start as the specimen's (softness 50 and wonk on
    for headings, softness 100 for the paper's numeral), for BVJ to adjust
    on the preview. BVJ: yes.
13. **The glossary's third paragraph.** BVJ: “ask me at the review.” The
    queue's Q1.
14. **The italic lines** are each page's own words: on Home the letter's
    first line, “No, I don't want my kids near most Bibles, either.”, set as
    the letter's opening rather than repeated; on About its heading, “So…
    who am I?”; on the 404 page its heading, “Page not found.” BVJ: yes.
15. **The colophon's sentence about AI.** BVJ: “ask me at the review. You
    can draft it, but we'll see what is decided.” The queue's Q2.
16. **Study on a phone or tablet** says: “Study is made for a computer. On
    a phone or tablet, the free LIT Bible app keeps your notes, highlights,
    and bookmarks.” BVJ: yes. Once the apps sync it adds “and, once you
    sign in, the notebook you keep here” ("Small screens").
17. **The front page on a phone** keeps the computer's order, with the
    buttons right under the claim and the name, and John 1 after them. BVJ:
    yes.
18. **New addresses**: `/license`, `/colophon` (decided), `/settings` for
    All settings, and `/study/help` for the help page. BVJ: yes.
    (`/whats-new`, for the page question 7 added, follows the same pattern.)

## Progress

The run's own record, kept current with every phase. Mark a phase `[x]`
with its last commit when done; never delete a line.

- [x] Phase 0: Set up, clear Site 2.0, write the ledger (cf1cf82d; Site 2.0
  removed in 63d07ac0)
- [ ] Phase 1: Foundations
- [ ] Phase 2: The kit and its words
- [ ] Phase 3: The header, the line under it, the footer, and the phone's bars
- [ ] Phase 4: The Read page
- [ ] Phase 5: Beside scripture
- [ ] Phase 6: Search
- [ ] Phase 7: Learn, the front door, and every other page
- [ ] Phase 8: Off the screen
- [ ] Checkpoint A: the public site
- [ ] Phase 9: Study's frame
- [ ] Phase 10: The Notebook place
- [ ] Phase 11: Sheets, collections, and shared sheets
- [ ] Phase 12: The Greek in Study
- [ ] Phase 13: First visit, signing in, status, small screens, and the tours
- [ ] Phase 14: The launch switch
- [ ] Checkpoint B: the whole build

**Baselines** (Phase 0), from a build of `main` at `18166ff7`, gzip at
level 9, a page counting its HTML, its stylesheets, and the scripts it loads
at once (`import`s followed, not dynamic ones):

- **Fonts**: 43 files, 1,560,020 bytes in `dist/_astro/`. Playpen Sans
  576,192; OpenDyslexic 463,988; Atkinson Hyperlegible Next 110,864; Crimson
  Text 102,788; Inter's Latin 96,744 and its Greek 81,480; Cardo 79,732;
  Fraunces (static 400 and 500) 35,968; Noto Sans Hebrew 12,264. Preloaded:
  67,676 on Home, 49,676 on John 3.
- **Home**: 83,148 bytes (HTML 27,421; CSS 27,108 in 3 files; scripts
  28,619 in 15 modules). After Phase 0's removal of 2.0: 68,001.
- **John 3** (`dist/john-3/`): 108,982 bytes (HTML 34,591; CSS 25,436 in 4
  files; scripts 48,955 in 24 modules). After Phase 0: 101,778.
- **Contrast** (WCAG 2), by day: ink `#1D231C` on the cream `#E1DFD9`
  12.03, on the card `#FAFAF8` 15.35; ink at 78% on the cream 6.57, on the
  card 7.63; at 60% 3.89 and 4.24; deep green `#0F6B33` on the cream 4.97,
  on the card 6.34; white on deep green 6.62; LIT Green `#209D50` on the
  cream 2.63, on the card 3.35; ink on LIT Green 4.58. By night: text
  `#F0F0F0` on the page `#0E0E0F` 16.93, on the surface `#161617` 15.87, on
  a raised surface `#1D1D1F` 14.77; the night green `#3ABF6A` on the page
  8.12, on a raised surface 7.08.

## The brief for the session that builds it

Pasted to start the run, once BVJ approves this file and PR #732 has
merged:

> Build Featherboa, the site's new design. BVJ has approved the plan in
> `SITE-FEATHERBOA-BUILD.md`; read it whole first, then
> `SITE-FEATHERBOA.md` whole (about 155 KB; it is the specification, so
> read it all, in parts). Work in a new worktree on
> `claude/featherboa-build`. Start at the first unchecked line of
> "Progress," and follow the plan's rules: build what the record says, put
> every open question in "The queue" with what you did meanwhile, and keep
> going; stop only at a hard stop, and at the two checkpoints, where you put
> the queue to BVJ in plain words with a recommendation for each. Use
> subagents within the repo's rule (two Sonnet, two Haiku, one Opus at a
> time). Commit and push after each step that stands on its own, and keep
> "Progress" and the ledger current, so a later session can resume from the
> repo alone. Never merge the pull request.
