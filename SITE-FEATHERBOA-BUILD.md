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
  In place: /colophon's “Who makes it” (b8fcd43b).
- **Q3. The What's New page's words**: the apps' entry and its date, the
  new site's entry, and the Study entry as a mock-up (Phase 7 and Phase
  13).
  In place: /whats-new, its entries in `src/lib/whats-new.mjs`. The apps'
  entry is dated July 20, 2026, the day the site announced them (PR #27);
  the stores' own date is BVJ's or BDR's to give. The new site's entry is
  dated February 10, 2027, the launch date Phase 14 sets, and its
  paragraph on Display and the phone's bar is checked then against what
  Phases 3 and 4 built. Both entries' words are drafts: BVJ keeps,
  rewords, or drops each.
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
- **Q7. Old-style figures** (SZ-24, OP-04). "Sizes" asks for old-style
  figures in running text and lining figures in counts and dates, but the
  Source Sans 3 files Fontsource serves have none (no `onum` feature);
  Adobe's own release has them. Meanwhile: lining figures everywhere. Other
  choices: cut a Source Sans 3 file that keeps them, with a script run by
  hand into `public/fonts/` (as the bracket and text-critical fonts are),
  and set `oldstyle-nums` on reading text; or drop old-style figures. Cost:
  the script needs fonttools (Python), which isn't installed here and is
  BVJ's go-ahead to install; one session. Recommendation: cut it with
  Q8's file, since both need the same tool.
- **Q8. Fraunces's file size** (TY-04, TY-14, OP-01). Only Fontsource's
  "full" files carry softness and wonk; the Latin one is 121 KB, with all
  four axes at every weight, and it is preloaded. The plan says to serve
  only the axes and weights used. Meanwhile: the full file. Other choice:
  once BVJ settles Fraunces's settings on the preview (OP-01), cut a file
  with fonttools' instancer: weights 300 to 800, softness held to the range
  used, wonk fixed on, into `public/fonts/` by a script run by hand. Cost:
  fonttools (BVJ's go-ahead), one script, and a new cut if the settings
  change later. Recommendation: cut it after OP-01, together with Q7.
- **Q9. Source Sans 3's Latin Extended** (TY-05). The plan names Latin and
  polytonic Greek; 29 chapters' footnotes have transliterations with ē, ō,
  and their kin, which drew those letters from a system face in the middle
  of a word (as Inter did). Meanwhile: served (`faces.css`), with ranges
  that leave out the Latin file's, so a page fetches it (60 KB) only for
  such a letter. Other choice: drop its two rules. Cost: none either way.
  Recommendation: keep it.
- **Q10. Values the record gives only as ratios or ranges** (CO and NI
  rows, SZ-01, SZ-02). The run chose them and the tests hold them: the
  night press green `#4DD383` (9.7:1 on the night page; the table says 9.6
  for links and 9.7 for the filled button's label, which is one pair), the
  night red `#EA8A85` (7.5:1), the night sunshine `#E2AD00`, the night float
  `#181C18`, the hairline at 14% of the text by day and 16% by night, the
  tints at 4% and 7.5%, the night grays at 74% and 57.8% (9.0 and 5.9:1),
  the four night highlighter washes (words on each 8:1 or more), the
  float's shadow, and the headline (56 to 104px) and title (48 to 62px)
  growing with the window from about 380 to 1450 wide. The day highlight
  is 13.4:1, where the table says 13.3: "Color" keeps today's four
  highlighter colors, and today's yellow gives 13.4. Meanwhile: built as
  listed (`tokens.css`). Recommendation: accept; any of them changes in
  `tokens.css` alone.
- **Q11. The reading sizes** (SZ-05 to SZ-07, SZ-11, TY-12; question 11).
  Refit so Source Sans 3's small letters stand as tall as the proposal drew
  them in Literata, each keeping the proposal's line in pixels: Scripture
  1.33rem (21.3px) on 1.52, Text 1.13rem (18.1px) on 1.5, Margin 1rem on
  1.4. John 1 on the preview is the specimen, ready for BVJ's look and the
  five-reader test. Meanwhile: built. Recommendation: accept, and adjust by
  eye if a size reads large.
- **Q12. The motion pass's calls** (MO rows). Each moving thing took the
  nearest of the four speeds. Large: the launch and welcome dialogs, the
  menu's overlay and side tray, Read View's phone tools sheet, and present
  mode's blanking and strip. Settled: the home chat's bubbles and Read
  View's floating button. Quick: menus, popovers, tooltips (the search
  tooltip's delay too), the footnote pill, the grips, the desk tour, and
  What's New. Motion on hover, press, color, and chevrons became Instant:
  the glossary's and Home's drawn underlines now appear whole, focus mode's
  dimming switches at once, and the menu's links no longer arrive one after
  another. E147's flash on the notes runs once at Large (260 ms; it was
  1.6 s). Meanwhile: built. Other choices: per item. Cost: one token each.
  Recommendation: accept, but look at the notes' flash, which may now be
  too short to notice.
- **Q13. A doc under a hard stop** (`src/data/chapters/CLAUDE.md`,
  "Bracketed passages"). It says the ⟦ ⟧ patch is registered in
  `global.css` under Inter; Phase 1 moved it to `faces.css` under Source
  Sans 3. The hard stop covers all of `src/data/` but
  `release-notes-skip.md`, so the run left it, and `faces.css` and
  `src/styles/CLAUDE.md` say where the patch is. Other choice: let the run
  edit the `CLAUDE.md` files under `src/data/`, which nothing that builds
  the apps' content reads (the manifest takes `chapters/*.json` only).
  Cost: none to the apps. Recommendation: allow it, for docs only.
- **Q14. Tabs and list rows keep the ink** (KT-06; "Color"). "Color"
  makes deep green the color of what can be pressed, and the kit draws the
  words of filled, tinted, plain, and red buttons in it. A tab's and a
  list row's words are names (a pane's, a menu item's), so the kit keeps
  them in the ink (a tab at the second strength) and gives green only to
  "on," the underline. Meanwhile: built so. Other choice: every pressable
  word in deep green, tabs and rows too. Cost: two declarations in
  `kit.css`. Recommendation: keep the ink, since a menu of green words
  reads as a page of links.
- **Q15. The kit's other names** (KT-04; Phase 2's "Done when").
  Rewriting every control's markup with the kit's classes now would touch
  some 300 places that the phases after this one redraw anyway.
  Meanwhile: today's names take the kit's looks by name, listed level by
  level in `kit.css` (`scripts/kit-names.mjs` keeps the lists alike), and
  each surface's phase moves its markup to the kit's classes and takes its
  names out. A control keeps its size (height, padding, text size) until
  then, so nothing jumps between phases; the label size and the 36px
  target arrive with each redraw. Other choice: rewrite the markup now.
  Cost: about two sessions more now, and the same markup redrawn again by
  its phase. Recommendation: accept.
- **Q16. Two controls the record doesn't list** (KT-01, KT-02). The ten
  have no place for a press inside a line of text (a footnote letter, a
  key term, a reference, a "More" at a paragraph's end) or for a color dot
  (Highlight's swatches, a label's color), which "Shapes" names among the
  round things. Meanwhile: the kit draws both, "inline" (the text's own
  face and weight in deep green, underlined when pointed at, a tint while
  its panel is open) and "dot" (a 24px circle with a 3:1 edge and a green
  ring when chosen). Verse numbers and footnote letters join "inline" with
  the Read page (Phase 4), which draws them without an underline
  ("Color"). The Greek's words that open their details (the Greek tab's
  words and signs, This verse's Greek words) are presses inside a line
  too: they take no level until Phase 12 redraws the Greek, This verse's
  keeping its own hover tint, since "inline" would color every Greek word
  deep green. Other choices: inline presses as plain buttons (a box in the
  line), and dots as tinted chips. Cost: none now; each is one set of
  rules in `kit.css`. Recommendation: accept both.
- **Q17. The footer's brand marks stand alone** (CT-19). Facebook,
  Threads, Bluesky, and Instagram are four links in the footer, each a
  brand's mark with no word beside it. "Icons" lets an icon stand alone
  only if it is one of five, but a brand's mark is its name rather than an
  icon from the set, and every site draws these links this way. Meanwhile:
  the marks stay alone, each named for screen readers ("Liberation and
  Inclusion Translation on Facebook," as today), drawn by the kit's plain
  level (no box until pointed at) in place of the outlined square they
  had. Other choice: a word beside each mark ("Facebook"). Cost: four
  short words in the footer, which Phase 3 redraws anyway.
  Recommendation: keep the marks alone.
- **Q18. Four controls wait for Phase 7** (CT-19, KT-02; Phase 2's "Done
  when"). On the glossary, the sort switch (a green track whose two
  labels fade to 0.7), the "Where it appears" rows (in capitals, at 0.9),
  and the back-to-top button (an arrow alone); on About, the contents
  toggle (an arrow alone, beside the words "On this page"). Phase 7
  redraws each as the record says: the sort becomes a switch in the
  "Glossary ▾" list, "Where it appears" moves to the margin, the jump list
  becomes that menu, and About's contents go on a sheet. Meanwhile: left
  as they were, and listed in the ledger's notes for Phase 7. Other
  choice: an interim fix for each now. Cost: an hour, thrown away by
  Phase 7. Recommendation: wait for Phase 7.
- **Q19. The LIT pane's way back is tinted at every width** (CT-22,
  CT-23, E168). On 2026-11-19 BVJ found the way back's arrow alone, drawn
  quietly, “subtle and easy to miss,” and had it read as a button whenever
  it shows only its arrow, and as a quiet link while it names its place.
  The kit draws an icon alone plain (no box until pointed at), and a
  level can't change with a pane's width. Meanwhile: tinted at every width
  (a box at rest, its place's name included), and its arrow stays an
  arrow, not the set's back chevron, since the bar's chevrons step a
  chapter. Other choice: plain at every width, as every other icon alone.
  Cost: one line in `kit.css`. Recommendation: tinted, for BVJ's reason.
- **Q20. Icons the record doesn't name** (CT-17, CT-20, KT-01). The
  record's sixteen lack some the screens need: forward (one of the five
  that may stand alone), the ▾ that marks a menu and its twin pointing up,
  Trash (the folded sidebar's), a check, and the phone's menu. Meanwhile:
  each is Lucide's, at the set's stroke, in `src/lib/icons.mjs` (forward,
  down, up, trash, check, menu), so the set stays one set. Study still
  draws some icons of its own (the Pin, the Notebook panel's fold, the
  pane's lock, grip, and flag, the Show eye, the way back's arrow, the
  sort, the refresh, the Sheets editor's text tools): each surface's phase
  takes Lucide's for them as it redraws the surface (the ledger's notes
  list them). Other choice: only the sixteen, with words where an icon is
  missing. Cost: none now. Recommendation: accept.
- **Q21. About names the Read page for the license** (FP-21). About says
  licensing details are “on the Read page,” twice (the LIT's license, and
  the SBLGNT text's credits), in BVJ's words. The record moves About's
  links to /license. Meanwhile: both links go to /license, with the words
  unchanged, so each says “Read” and opens the License page. (The License
  rows in About ▾ and the footer open /license too, by `LICENSE_HREF` in
  `src/lib/places.mjs`. Study's own links, its export's license line, the
  Sheets' terms links, and its help page moved too, as the repo's own;
  `llms-full.txt` with `llms.txt`.)
  Other choice: leave About's links on /read's old anchors, which forward
  to /license (the words still name a page that no longer holds it).
  Cost: two words. Recommendation: “on the License page” in both.
- **Q22. The verse image's Paper and Ink take Featherboa's two colors**
  (OS-20, "Color"). "The rest stays: Ink and Paper" could keep today's
  colors, the share cards' bright cream `#F2F0E9`; "Color" gives Paper
  `#FAFAF8` the page and Ink `#1D231C` all text, with grays as ink at 78%.
  Meanwhile: Paper is `#FAFAF8` with ink text, Ink is `#1D231C` with paper
  text, and the name and address are the text at 78%. The link-preview
  cards (`build-og-images.mjs`), which no decision names, keep the cream.
  Other choice: today's `#F2F0E9`. Cost: two values. Recommendation: the
  record's two colors, so an image matches the page it came from.
- **Q23. The pages no decision draws, as drawn** (BP-07; question 8).
  They take the foundations with today's words and order, and five calls
  came with it. A page's name is at the Title size, 48 to 62px ("Type":
  "The name of a book or a page"), larger than today's on every one, and
  /license, /colophon, and /whats-new match. Small capitals are gone
  (eyebrows, dates, badges, the podcast's season heading), by "Labels"'
  sentence case. A lede is at the Text size, where today's were a step
  larger. A box that neither floats nor is pressed (the FAQ's questions,
  the podcast's episodes) takes the 10px corner. The podcast page's photo
  and its cover still overlap by negative margins, off the spacing scale,
  which has no step for an overlap. Other choices: today's title sizes,
  the capitals, ledes at the Subhead size, 6px corners. Cost: a line
  each. Recommendation: as built; BVJ looks at each page on the preview
  and names any to redraw, which becomes its own decision.
- **Q24. Read is a link until the picker** (HD-02, FP-15, HD-29). The
  record makes Read open the passage picker in place, which Phase 4
  builds. Meanwhile: Read is a link to /read, the footer's Read group
  lists “Books” (/read) and “Release Notes,” and /read's line reads
  “Read / Books” (its heading stays “Read the LIT Online”). Other
  choices: a small Read menu now, or “Read the LIT Online” as the row's
  name. Cost: none, since Phase 4 replaces the link. Recommendation: the
  link, and “Books” until Phase 4. Phase 4's first part (246ab483): with
  JavaScript from 700px Read opens the picker's panel, and otherwise it
  stays the link to /read, which is now the picker at full size, so
  “Books” still names it.
- **Q25. Study's menu keeps “Help for study tools” until Phase 9**
  (HD-09). The record puts help at the foot of Study's sidebar, which
  Phase 9 builds. Meanwhile: it is the menu's last row, below a line, and
  it is in the footer's Study group. Other choice: drop it now, which
  leaves help reachable only from /desk's title menu. Cost: a row and a
  test line in Phase 9. Recommendation: keep it until then.
- **Q26. “Take the tour” waits for Home's Study panel** (NX-22). Knowing
  who is visiting for the first time means reading Study's tour state on
  every page, and Study's code loads only behind its gate. Meanwhile:
  Study's menu has no tour row. Other choice: an inline check of the
  tour's stored key in the header, without Study's code. Cost: NX-22 stays
  open until Phase 7. Recommendation: build it with Home's Study panel in
  Phase 7.
- **Q27. Pages the record doesn't place** (HD-22). Meanwhile, each of
  these is in no place, and its line gives its name alone: /search,
  /app-support and its thank-you page, /unsubscribe, /courses,
  /colophon, /whats-new, /delete-account, /account, /account/connect, and
  the 404. Contact's thank-you page sits under About and Contact. Other
  choices: /app-support under About and Apps, since it is the apps'
  support page, and /search under Read. Cost: a line each.
  Recommendation: /app-support under About and Apps; the rest as built.
- **Q28. The account button's tooltip repeats “Account”** (CT-19). A
  tooltip that repeats the button's own word adds nothing. Meanwhile:
  kept, because removing it changes sync's `test/desk-sync-gate.test.js`,
  and sync is off limits to this run. Other choice: drop it now. Cost: an
  import and a test line. Recommendation: drop it in sync's next change.
- **Q29. The account entry shows from 700px** (HD-12). It showed from
  760px; the full header now starts at 700px, and the entry comes with it.
  In OpenDyslexic, from 700 to 899px, it sits in the phone's row.
  Other choice: keep it in the menu there. Cost: none now, since Phase 3's
  second part redraws the phone. Recommendation: keep.
- **Q30. The magnifier on a page with its own box** (HD-13; the feature
  audit's U6). /read, /search, /articles, and an article had no
  magnifier, since each has its own search box. Meanwhile: the magnifier
  takes the reader to the page's box, and without JavaScript it is a link
  to /search. Other choice: no magnifier there, as before. Cost: none.
  Recommendation: keep it, so the header is the same on every page.
- **Q31. When “New” goes** (NX-26). Meanwhile: a place's dot goes as soon
  as its menu opens; a row's “New” stays while that menu is open, and an
  entry's `until` date ends it everywhere. The phone's menu shows no marks
  until Phase 3's second part. Other choice: clear “New” with the dot.
  Cost: none. Recommendation: keep.
- **Q32. /privacy names `lit-news-seen` before the first news entry**
  (NX-25 to NX-27). Opening a menu that holds news keeps what was seen
  under that key, on the reader's device, and /privacy lists every key
  the site keeps; `test/news.test.js` fails if an entry goes in before
  /privacy names it. /privacy is BVJ's page and words, so the run adds
  nothing there, and the news list is empty, so nothing is kept yet.
  Recommendation: BVJ words the line when the first entry goes in.
- **Q33. The footer's layout** (HD-36). From 1100px the four groups sit
  in a row with the newsletter beside them; below that the groups come
  first and the newsletter under them, and a phone sets the groups two by
  two. Release Notes is in both the Read and About groups (HD-29).
  Other choice: the newsletter first on a phone. Cost: a line.
  Recommendation: as built (seen at 390, 820, and 1440).
- **Q34. A disclosure's question is at the Text size** (SZ-08; About's
  and /license's questions). “Sizes” puts every button, tab, and menu row
  at the Label size, 14.5px, and a disclosure's summary takes the kit's
  plain look. A question there is a full sentence, read before its
  answer, so it is drawn at the Text size in the controls' face, and it
  follows the Display tray as its answer does. Other choice: the Label
  size, which sets a long question smaller than the answer under it.
  Cost: a line each. Recommendation: the Text size. A summary that is a
  command, not a question, stays at the Label size as a plain control:
  the account page's “Enter a code from the other device instead” and
  “I can’t do any of these” (cf6f21c8).
- **Q35. The passage picker before Phase 4** (PH-01, PH-10, PH-26). “John
  3 ▾” in a phone's top row must open something until Phase 4's picker
  sheet. Meanwhile: with JavaScript, ReadMenu makes the row's link a
  second button for today's picker panel, which hangs from that button,
  and its × gives focus back there; without JavaScript it is a link to
  /read. Its name is “Go to passage. Current: John 3” (an introduction's,
  “John · Intro”), with no draft mark. Other choice: a link to /read even
  with JavaScript. Cost: ReadMenu serves two buttons for one panel until
  Phase 4 removes it. Recommendation: keep until Phase 4. Done in 246ab483:
  the row's “John 3 ▾” opens the picker's sheet, ReadMenu's second button
  (`data-rm-also`) is gone, and ReadMenu serves Read View alone.
- **Q36. How far a scroll moves the bars** (PH-05; the ledger's “Where the
  record is unclear”). The record says any scroll up brings them back;
  Site 2.0 answered every pixel. Meanwhile: the ledger's `barState`, plus
  an 8px give measured from the turning point (the lowest point while they
  are away, the highest while they show), so a resting thumb, an image
  settling, or Safari's own bars never flicker them, and a slow scroll
  still adds up. Nothing hides before the reader's first wheel, touch,
  pointer, or key, so a link to /john-3/#v16 arrives with both bars
  showing and the verse below the row. They hold while search, the picker,
  Aa's tray, or the menu is open, or while keyboard focus is in either
  bar. Other choices: 2.0's every pixel, or a 16 to 24px give.
  Recommendation: keep 8, and feel it on a real iPhone and Android phone.
- **Q37. The top row's measures** (PH-01, PH-02, PH-06). The record names
  the row's contents, not its measures. Meanwhile: sticky through CSS, so
  it holds without JavaScript; 52px and a hairline, on the page's surface;
  the emblem 40px inside a 44px link; the chapter's name centered, cut
  short with an ellipsis only at 320px in OpenDyslexic (“2 Thessalonians
  3” loses 31px); the page's h1 visually hidden under 700px. Other choice:
  no hairline. Recommendation: keep; Phase 4's progress line takes the
  hairline's place.
- **Q38. The bar's drawing** (PH-03, PH-04). Meanwhile: the kit's plain
  buttons, the icon over the word at the Label size, in four columns on
  the page's surface under a hairline; a missing Previous or Next keeps
  its place in the kit's unavailable look; the page's foot gains 64px so
  the footer clears the bar; no safe-area inset, since the page's viewport
  has no `viewport-fit=cover`. Other choice: hide a missing button, which
  moves the others. Recommendation: keep, and check the band above an
  iPhone's home indicator.
- **Q39. OpenDyslexic on the narrowest phones** (PH-03, PH-15). The bar's
  four words need 360px in OpenDyslexic with its edges and gaps, so Next
  overran 320 by 12px, and the header's “Menu” cut 8px off “LIT Bible” at
  360. Meanwhile, the room is bought back and the type is never shrunk:
  under 375px the bar drops its edges and gaps; under 360px Previous,
  Search, and Next show their icons alone (three of the five icons the
  record lets stand alone, their words kept as their names) and Menu keeps
  its word; under 380px the magnifier moves into the menu sheet as its
  Search row; Menu's icon shows from 430px (400px in the other faces).
  Re-measured, nothing is cut or overruns from 320 to 430px. Other
  choices: smaller OpenDyslexic type, which the styles' rules make the
  last resort, or the overrun. Recommendation: keep; it breaks “a word
  under each” only in OpenDyslexic under 360px.
- **Q40. Where a link's target stops** (PH-05). The plan said
  `scroll-margin-top`. Meanwhile: `scroll-padding-top` and
  `scroll-padding-bottom` of 53px on `html` on a phone's reading pages,
  one rule for every anchor and focus scroll, which `readingLine` counts.
  Other choice: `scroll-margin-top` on `main [id]`, as Site 2.0 had.
  Recommendation: keep. The place line isn't sticky (246ab483), so Continue
  reading's line needs nothing more on a computer.
- **Q41. Search in place of the top row** (PH-09, HD-13). A page's
  SearchBar renders once, with fixed ids, and its toolbar is hidden on a
  phone. Meanwhile: the bar's Search moves that one SearchBar into the row
  and back, its × beside the field's 44px submit button, and the row grows
  from 53 to 60px (68 in OpenDyslexic) while it is open, since the field
  is that tall. Other choice: a second SearchBar, which repeats ids.
  Recommendation: keep; Phase 6's field takes the row's height.
- **Q42. One sheet wherever a “Menu” shows** (PH-11, PH-15). The record
  says the same sheet rises “from the bottom, so the menu looks the same
  everywhere.” The header's Menu also shows in Study's own header at every
  width, from 700 to 899px in OpenDyslexic, and in a narrow computer
  window (where BVJ's side tray of 2026-11-04 was). Meanwhile: one bottom
  sheet everywhere, at most 660px wide and centered, so on /desk at 1440px
  it rises from the window's foot. Other choice: with a mouse or trackpad,
  hang it from its button like the header's menus. Cost: at 1440px it
  opens far from its button. Recommendation: keep until Phase 9 redraws
  Study's header.
- **Q43. The sheet's head and focus** (PH-11). Meanwhile: the title “Menu”
  and a ×; opening moves focus to the ×, Tab stays inside, and closing
  gives focus back to the button that opened it. Other choice: focus the
  first row. Recommendation: keep.
- **Q44. The sheet's groups and marks** (PH-12, HD-35, NI-18, NX-26; the
  ledger's “Where the record is unclear”). Meanwhile: two columns, Read
  and Learn on the left and About on the right, with Study a third only
  where the header shows Study (its own header from 1100px with the
  preview on); the page's place underlined in LIT Green; news as in the
  header's menus (a dot on a group's name, “New” beside a row, “See what’s
  new →” at the group's foot), with a dot on both Menu buttons, and
  opening the sheet sees what it shows. Other choice: one column, 20 rows
  long. Recommendation: keep.
- **Q45. The sheet's foot** (PH-13, NX-11). Meanwhile: Search under 360px
  (380px in OpenDyslexic) on a page whose magnifier opens the strip;
  Account under 700px with accounts open (a phone never has the preview,
  so in practice a narrow computer window), left out of Study's own
  header, which shows the entry itself; and “Get the app” at every width.
  Other choice: “Get the app” under 700px only. Recommendation: at every
  width.
- **Q46. The dim behind the sheet** (PH-11). tokens.css has no scrim
  color. Meanwhile: 40% black by day and night, fading at the Large speed.
  Other choice: a `--color-scrim` token now. Recommendation: add the token
  when Phase 5's phone sheets need a dim too.
- **Q47. The header's “Menu”** (PH-15). The old button was three bars
  drawn with backgrounds, its word hidden, which the record's icon rule
  forbids. Meanwhile: the kit's plain button with the `menu` icon and the
  word “Menu,” the word alone under 400px (430px in OpenDyslexic), where
  the icon stops fitting. Other choice: the word alone at every phone
  width. Recommendation: keep.
- **Q48. Read View on a phone until Phase 4** (PH-06). Today's phone
  toolbar had an icon-only “Switch to Read View,” and that toolbar is gone
  on a phone. Meanwhile: Read View is reached from /read. Other choice: a
  “Read View” row in the sheet on chapter pages. Cost: one more step on a
  phone, until Phase 4 makes the two views one. Recommendation: keep.
  Since 246ab483 /read has no Read View card, so Read View is reached only
  from search's second link and from old links until it retires.
- **Q49. The kit's draft state** (FP-10). The record wants drafts dimmed
  and saying “in progress,” and the kit had no draft state. Meanwhile:
  `.kit-tab--draft` and `.kit-row--draft`, whose words take the third ink
  (never opacity), still opening and still marking the current page;
  5.11:1 by day and 5.68:1 on the night panel. Other choice: no new state,
  “in progress” at full ink. Cost: drafts read as finished at a glance in
  the grid. Recommendation: keep, as a kit state.
- **Q50. The picker's markup on every page** (FP-02, FP-15). G and Read
  open it anywhere, and the whole picker is 59 KB raw (3.7 KB gzipped) and
  1,018 elements. Meanwhile: it waits in a `<template>` that its first
  opening puts in place, so a page carries none of those elements live
  (John 3: 1,060 live of 2,078), and without JavaScript no dialog opens
  anyway. Other choice: fetch /read's picker on the first opening. Cost: a
  wait and a loading state on the first G, and a failure path.
  Recommendation: keep.
- **Q51. “Show the Notebook” stays in the tray for now** (DI-16).
  Meanwhile: the Notebook button is on the line, the tray's switch stays,
  and turning it off hides the line's Notebook with the tab. Other choice:
  remove the switch in this part. Cost: the tray and the first stage's tab
  rules reworked here rather than with the Display tray. Recommendation:
  the Display tray's part of Phase 4 removes it.
- **Q52. The phone's “John 3 ▾” focuses chapter 3** (PH-10, FP-14). The
  sheet's order is as written, the field first, but focus starts on the
  chapter, as “Chapter 3” does on a computer, so at 390 the sheet opens
  scrolled to John's grid, with the field and Continue above it, out of
  view. Other choices: focus the field, which raises the keyboard over the
  grid at once; or focus the sheet's ×, as the menu sheet does, which
  shows the field and Continue but puts the chapters a scroll away.
  Recommendation: keep.
- **Q53. A tablet's line has no Notebook or Study** (RP-32, ST-15). From
  700 to 1099px the line is the picker, Search, and the arrows, matching
  ST-16; Read opens the panel from 700px. Other choice: show both from
  700px. Cost: Study is made for a computer, and a tablet never gets the
  preview's stamp. Recommendation: keep.
- **Q54. A whole draft's tab** (FP-10). Revelation's tab reads “Revelation
  in progress.” Measured: one line at 1440 and 820 in the text face and at
  1440 in OpenDyslexic; at 768 in OpenDyslexic it wraps inside its tab,
  which is 3px taller than its neighbors. Other choice: dim the tab and
  keep the words for screen readers and the note under the grid. Cost: a
  test change. Recommendation: keep; the wrap stays inside the tab and
  moves nothing else.
- **Q55. A book alone offers chapter 1 first** (FP-04, FP-05). “romans”
  offers Romans 1, then its introduction. Other choice: the introduction
  first. Cost: the search box's jump goes to chapter 1, so the two would
  disagree. Recommendation: keep.
- **Q56. “Go to Matthew introduction”** (FP-05). Labels take no articles,
  and the line's arrows already say “Previous: Matthew introduction.”
  Other choice: “Go to Matthew’s introduction.” Cost: a word, and the
  arrows would differ. Recommendation: keep, unless BVJ prefers the
  possessive.
- **Q57. Escape empties the field first, then closes** (FP-13), as the
  search box closes its results first. Other choice: Escape always closes.
  Cost: none to build. Recommendation: keep.
- **Q58. Where the panel hangs** (FP-02, FP-15). Meanwhile: 8px under what
  opened it and kept 16px inside the window; G hangs it under the line's
  book, else the header's Read, and where both are scrolled away, centered
  at the window's top. Other choice: a centered dialog every time. Cost:
  the panel loses its tie to what opened it. Recommendation: keep.
- **Q59. Continue hides when it names this page** (FP-07, NX-12). Other
  choice: always show it. Cost: a row that goes nowhere. Recommendation:
  keep.
- **Q60. The dialog's names** (FP-02). The dialog is “Choose passage,” its
  × “Close picker,” and the field “Book, chapter, or verse.” Other choice:
  “Find a passage” and “Close.” Cost: a word change. Recommendation: keep
  (a verb, then a thing).
- **Q61. /read's frame, and the picker's size** (FP-16, BP-08). Meanwhile:
  /read keeps its emblem and title over the lede, at 60rem rather than the
  content width, and like the other display pages is left to browser zoom;
  the picker is drawn at the kit's sizes everywhere, not with the
  `--control-scale` ReadMenu followed. Other choice: scale the picker with
  `--control-scale`. Cost: picker.css would size the kit's controls, which
  the kit's rules forbid. Recommendation: keep, and measure Extra large in
  the accessibility pass.
- **Q62. /read without JavaScript** (FP-16). Each book links to
  `#picker-<book>` and is shown by `:target` (Matthew's first), and the
  field is a form to /search. Other choice: all 27 books' chapters at
  once. Cost: a long page of 260 numbers. Recommendation: keep.
- **Q63. /read with JavaScript opens at the reader's book** (FP-07,
  FP-16): the address's `#picker-luke`, else Continue's book, else
  Matthew. Other choice: always Matthew. Cost: a returning reader picks
  their book again. Recommendation: keep.
- **Q64. /read keeps the header's magnifier** (FP-31), the strip, as on
  every page that isn't a reading page. Other choice: none on /read, since
  its field searches too. Cost: none to build, but /read would break
  FP-31's rule. Recommendation: keep.
- **Q65. “Study John” on an introduction opens chapter 1** (ST-15, CT-09),
  since no pane shows an introduction (E173). Other choice: no Study link
  on an introduction. Cost: no way into Study from one. Recommendation:
  keep.
- **Q66. The book's name heads its grid** (FP-09): an h2 in Fraunces at
  the subhead size, which also names the grid to a screen reader. Other
  choice: no visible heading. Cost: the grid loses its name.
  Recommendation: keep.
- **Q67. The line's Search keeps today's box** (FP-30). Meanwhile: the
  SearchBar's height and its submit button under 900px, so at 1440 the
  line grows from 37 to 59px while Search is open and the page below moves
  down 22px. Other choice: redraw the box in this part. Cost: Phase 6's
  redraw lands early. Recommendation: leave it to Phase 6, whose field
  takes the line's height. Done in f1a6b2af: the field takes the line's
  height (`--target`), so at 1440 the line stays 37px with Search open.
- **Q68. /search loses “Go to passage” until Phase 6** (FP-01). Its field
  still jumps to a reference, G and Read open the picker, and its toolbar
  stays. Other choice: keep ReadMenu on /search. Cost: ReadMenu's Chapter
  View mode stays alive. Recommendation: keep it removed.
- **Q69. G in Read View presses Read View's own picker** (FP-13). The
  dialog is on that page too, but G uses ReadMenu's trigger there. Other
  choice: the passage picker. Cost: two pickers that disagree on one page.
  Recommendation: keep until Read View retires, later in Phase 4.
- **Q70. ReadMenu's Chapter View mode is dead code** (FP-01, FP-11). Its
  Chapter View footer, with the preview's “Open Romans in Study Desk →”
  and `&layout=reading` (E114), is never drawn now; E114's link lives only
  in search's second jump. Other choice: strip it now. Cost: a riskier
  diff in a file Read View still uses. Recommendation: remove it with Read
  View.
- **Q71. Study help's sentences** (RP-32, ST-15). `desk/help.astro` named
  the toolbar's “Open in Study Desk” and /read's “Study Desk” button.
  Meanwhile: four sentences name the line's “Notebook” and “Study John 3”
  (named for the chapter being read) at the end of the line under a
  Scripture page's header, and the chapter picker's “Open Romans in Study
  Desk →” is gone. Other choice: leave them until Phase 9. Cost: help
  describes buttons that are gone. Recommendation: keep; BVJ skims the
  four sentences.
- **Q72. The tour's search step presses the line's Search** (FP-30): it
  shows “>” in the field, and on skip or end puts back the reader's words
  and closes the line. Other choice: skip the step on chapters. Cost: the
  tour loses its search step there. Recommendation: keep.
- **Q73. FP-01's grep still finds “Go to passage,”** in ReadMenu.astro
  alone (Read View's trigger). Other choice: leave FP-01 open until Read
  View retires. Cost: the row stays open for a page that is leaving.
  Recommendation: mark it built for every page but Read View.
- **Q74. The picker's two ×** (FP-02). Its field is `type="search"`, so
  Chrome draws its own clear × inside the field, beside the picker's
  “Close picker” ×: two × a few pixels apart, one clearing and one closing
  (seen at 1440). Meanwhile: both stay. Other choice: hide the browser's
  clear button in a field that sits beside a close (the picker's, and the
  line's Search box, which is the SearchBar's), since Escape empties the
  field (Q57). Cost: a mouse loses its one-press clear. Recommendation:
  hide it, decided with Phase 6's field, which redraws the SearchBar too.
  Done: the line's field leaves it out (f1a6b2af), and the picker's
  (e896463b) in the panel, the dialog, and the phone's sheet; /read's
  picker has no close, and keeps it.
- **Q75. OpenDyslexic's picker** (FP-08, FP-09). At 50rem its three
  columns of book names took about 630px, leaving the chapters two to a
  row, so a long book's panel scrolled, and at 768 a chapter cell was
  about 40px. Meanwhile: in OpenDyslexic the panel is 60rem from 700px, as
  the window allows, and in a picker under 880px its books and chapters
  stack: at 1440 the chapters stand five to a row, at 768 fourteen, and at
  1100 by 700 the panel shows all 27 books without scrolling. Other
  choice: smaller book names in OpenDyslexic. Cost: the styles' rules make
  shrinking that font's type the last resort. Recommendation: keep.

- **Q76. One row of tabs, and the menus** (SE-04, SE-09, SE-27). The
  record puts the tabs, then “All books ▾,” the sort, and with Study on
  Select, at the row's right end. In the 647px column at 1440 the five
  tabs take 618px, so the menus (292px, 360 with Select) never fit beside
  them, and the preview's seven tabs take two lines. Meanwhile: the tabs
  wrap, and the menus take a line of their own under them, at the right
  end. Other choices: the tabs scroll sideways on a computer as on a
  phone, the menus at the row's end; a top wider than the column; or the
  menus moved down into the results they sort and filter. Cost: a scroll
  hides tabs on a computer; a wider top parts the field from the results'
  edge, which this review joined; menus in the results move as the tab
  changes. Recommendation: keep.
- **Q77. A Greek search and the other tabs** (SE-07). A query in Greek
  letters or a Strong's number is searched in the Greek alone, as before
  (BA40), with the reader's notes holding it listed above. Meanwhile: the
  other tabs show their names with no number, and choosing one shows the
  Greek again, since the query is still Greek. Other choices: draw the
  other tabs unavailable on a Greek query, with the reason in words; or
  search the English too, for every tab's count. Cost: the first, a reason
  under the row; the second, an English search that finds little, run
  every time. Recommendation: the first, with the Checkpoint A fixes.
- **Q78. Study's Search pane waits for Phase 9** (SD-42, GK-37, GK-38,
  GK-44). The record gives Study's Search tab /search's tabs and rows and
  the one “Build a search…” link; that pane is part of Study's frame,
  which Phase 9 redraws. Meanwhile: the pane (`desk/search-pane.js`) keeps
  its type menu, its rows, and its “Search commands” button, which opens
  the same window, now titled “Build a search.” Other choice: redraw the
  pane now. Cost: Phase 9's frame work done twice. Recommendation: keep
  until Phase 9.
- **Q79. Select also boxes Greek rows** (SE-28 names Scripture and
  Chapters about it). Before Phase 6 the Greek results could already be
  gathered for a sheet (`test/desk-search-sheet-greek.test.js`), so Select
  keeps them. Other choice: Scripture and Chapters about it only. Cost:
  the Greek loses its way to a sheet. Recommendation: keep.
- **Q80. The page links** (SE-26). Meanwhile: Previous, the numbers, and
  Next are plain kit buttons, the current page tinted and named as current
  (`aria-current`), since the kit has no “on” for a button. Other choice:
  the numbers as a kit tab row. Cost: a tab row says “one of these views,”
  not “a page of a list.” Recommendation: keep.
- **Q81. When the glossary line shows** (SE-21: “when a term matches”).
  Meanwhile (24408884): only when what was typed is one of an entry's own
  words (its traditional word, a LIT word, or its transliteration), named
  as the entry writes it (“Trust is in the glossary →”), first over the
  verses. Other choice: whenever the Glossary tab has a hit. Cost: an
  entry that only uses the word in its prose is named, as Phase 6 first
  built it (“Faith → trust / faithfulness is in the glossary →” for
  “trusting”). Recommendation: keep.
- **Q82. The Notebook tab is not an address** (SE-23, BP-03). The URL's
  `mode` names the other tabs; the Notebook's is page state, since
  `search-core.js` and its hidden `#searchbar-mode` select have no
  notebook mode, and a link to it would open an empty tab for anyone
  without the preview. Other choice: `?mode=notebook`. Cost: a new mode in
  `search-core.js`, which Phase 6 left unchanged. Recommendation: keep.
- **Q83. The Greek tab's hits are rows** (SE-13). Phase 6 had left them
  bordered cards, under the class name of the builder's word cards.
  Meanwhile (563f837b): a row like the others: its reference drawn as a
  verse row's but taller, since it is the row's only link (27px), then the
  Greek with the match marked, the parsing, and the LIT's verse, with a
  step more space between hits than between verse rows, since a hit is
  four lines. Other choice: the cards. Cost: the one place results looked
  unlike the rest. Recommendation: keep.

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
- [x] Phase 1: Foundations (c1bb5383)
- [x] Phase 2: The kit and its words (f47df065; the kit and its icons in
  7216b1ef). What each surface's phase redraws is in the ledger's "What
  Phase 2 left to each surface's phase"
- [x] Phase 3: The header, the line under it, the footer, and the phone's bars
  (782271a5; the computer's header, the line, the news marks, and the footer in
  ec3378b6)
- [ ] Phase 4: The Read page (/license built ahead, de0085a8; the place
  line, the passage picker, and /read, 246ab483)
- [ ] Phase 5: Beside scripture
- [x] Phase 6: Search (f1a6b2af; review fixes 24408884, d30c03c5,
  563f837b, e896463b)
- [ ] Phase 7: Learn, the front door, and every other page (built ahead:
  the colophon, b8fcd43b; What's New, 1253bf85; the pages no decision
  draws, bae1d1cb, and the account pages, cf6f21c8)
- [ ] Phase 8: Off the screen (the verse image built ahead, 60952c32)
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
