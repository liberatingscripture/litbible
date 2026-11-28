# Featherboa: the ledger

The build's checklist: one row for each decision in `SITE-FEATHERBOA.md`, in the record's order. That file is the specification and `SITE-FEATHERBOA-BUILD.md` the plan; a row names a decision, its phase (the plan's "Order of work"; "all (N)" for a rule every phase from N on applies), and how it is checked, so read the record's section before building it. A row's state is open, built (the commit), checked, queued (Qn, the plan's queue), or superseded → ID (the later row that holds); n/a (record only) marks history with nothing to build. A Check that starts "Kept:" confirms today's behavior still works, and "Covered by" points to the row whose check covers it. The run keeps this file current.

## Notes for later phases

### Phase 3: the phone's bars

Saved from Site 2.0's `src/scripts/v2-scripture.js` and `src/styles/v2/scripture.css`
(removed in Phase 0, commit 63d07ac0; `git show 63d07ac0^:src/scripts/v2-scripture.js`
recovers the whole file). Featherboa's two bars hide together on a scroll down and return on
any scroll up ("The phone"), so the same state machine drives both.

The state after each scroll, as a pure function (2.0 tested it in `test/v2-scripture.test.js`):

```js
// y, lastY: scroll position now and before; home: the scroll position at which
// the bar leaves its own place in the page; away: whether it was hidden; held:
// true while its search or picker is open or focus is inside it.
export function barState({ y, lastY, home, away, held }) {
  const afloat = y > home;
  if (!afloat || held) return { afloat, away: false };
  if (y > lastY) return { afloat, away: true };   // scrolling down: hide
  if (y < lastY) return { afloat, away: false };  // any scroll up: return
  return { afloat, away };
}
export function barValue({ afloat, away }) {
  return [away && afloat ? "away" : "", afloat ? "afloat" : ""].filter(Boolean).join(" ");
}
```

Wiring: listen to `scroll` and `resize` (passive), plus `focusin` and `click` on the bar,
so a keyboard's Tab brings it back. Only below the phone width (2.0 used
`(max-width: 640px)`; Featherboa's phone is under 700, "Sizes"). `held()` was
`row.hasAttribute("data-search-open") || row.contains(document.activeElement) ||
row.querySelector('[aria-expanded="true"]')`. The state is written as an attribute
(`data-v2-bar="away afloat"`), and the CSS does the rest:

```css
@media (max-width: 640px) {
  .bar { position: sticky; top: 0; transition: transform 180ms ease; }
  .bar[data-bar~="afloat"] { box-shadow: 0 1px 0 var(--hairline); }
  .bar[data-bar~="away"]:not(:focus-within, [data-search-open]) {
    transform: translateY(-100%); box-shadow: none;
  }
  /* A link's target stops below the floating row, never under it. */
  main [id] { scroll-margin-top: 68px; }
}
@media (max-width: 640px) and (prefers-reduced-motion: reduce) { .bar { transition: none; } }
```

For Featherboa: the bottom bar takes `translateY(100%)` with the same state; the timing is
"Motion"'s Settled (180 ms, the one curve), leaving at two thirds; the progress line rides the
top row's bottom edge and hides with it.

Built in 782271a5 as `src/lib/phone-bars.mjs` and `src/scripts/phone-bars.js`: the
state kept, with an 8px give from the turning point (queue Q36), and `scroll-padding`
on `html` in place of `scroll-margin-top` (Q40). The progress line is Phase 4's.

### What Phase 2 left to each surface's phase

Phase 2 put every control on the kit by its old name (queue Q15) and kept
its size. These are drawn as they were, each for the phase that redraws its
surface:

- **Phase 3 (the header and footer)**: the header's narrow Study link shows
  the notebook icon alone, as it did before; the account button's drawing
  and the menu button's bars are the header's own, not from `icons.mjs`;
  the footer's brand marks stand alone (Q17); the About group's other names
  ("What's new" becomes "Release Notes," "Names" in "Four places"). The
  footer's groups (HD-36, BS-24) were Site 2.0's, behind its preview, and
  went with it in Phase 0: `git show 63d07ac0^:src/components/SiteFooter.astro`
  has its `FOOTER_GROUPS` and `SOCIAL` lists to start from. The menu
  button's bars went in Phase 3's second part (782271a5; queue Q47).
- **Phase 4 (the Read page)**: verse numbers and footnote letters join the
  kit's "inline" (Q16); Read View's toolbar draws its own icons (its
  close, the faders, focus, and the cycle), as did /read's Study pill
  (`ReadLayout.astro`, gone with its layout in 246ab483); the term lens's
  clear chip (`.lit-clear-chip`) is a translucent chip over the text.
- **Phase 5 (beside scripture)**: a floating window's grip
  (`.lit-window__move`) takes no level, since its dots are its background
  and a level's fill would erase them; the minimized Notebook tab
  (`.desk-tab`) is plain, green words in an edge strip with no card; a
  note's "Show all" caret (`.desk-item__more`) is the down icon alone,
  which CT-19 doesn't allow, so it gains a word or becomes "more." Icons
  still drawn by hand (Q20), for Lucide's: the Pin (`pins.js`'s
  `ICON_PIN`, `glyphs.js`'s `THUMBTACK_INNER`), the Notebook panel's fold
  and its Study icon (`panel.js`), the Notebook tab's icon, and the
  margin's kind and note markers (`glyphs.js`).
- **Phase 6 (search)**: a result's "›" is drawn by CSS (`.result-link::after`),
  and the result cards keep their fill and edge.
- **Phase 7 (the other pages)**: four controls (queue Q18): the
  glossary's sort switch (`.toggle-switch`), its "Where it appears" rows
  (`.occ-title`, in capitals at 0.9 opacity, and `.occ-summary`), and its
  back-to-top button (the "up" icon alone), and About's contents toggle
  (the "down" icon alone). Also the articles index's featured card.
- **Phase 9 (Study's frame)**: icons still drawn by hand (Q20): the pane's
  lock, grip, flag, and shape (`desk-page.js`), the Show eye
  (`lit-show.js`), the way back's arrow (`lit-back.js`, an arrow, since
  the bar's chevrons step a chapter: Lucide's `arrow-left`), the "open on
  its page" icon (`glyphs.js`), and the Search pane's sort
  (`search-pane.js`).
- **Phase 10 (the Notebook place)**: the change notice's refresh icon
  (`change-notice.js`) is drawn by hand (Q20).
- **Phase 11 (Sheets)**: the rich editor's text box (`.desk-rich-editor`),
  a field with a toolbar inside, keeps `--desk-field`; a sheet's pick row
  whose checkbox is unavailable (`.desk-sheet__pick:has(input:disabled)`)
  has no level; /sheets' copy link (`.sheets-page__copy-link`) draws its
  own filled button, and present mode its own buttons (`.present-btn`), as
  `sheets-page.css` stays on the kit test's LATER;
  the text tools (`sheet-text.js`) and /sheets' copy icon (`sheet-page.js`)
  are drawn by hand (Q20).
- **Phase 12 (the Greek)**: the Greek's words that open their details take
  no level (queue Q16).
- **Phase 13 (first visit)**: the welcome and launch popovers' feature
  lists draw their own pictures (decorative, beside words, not controls).

### Phase 7: what left /read

Phase 4's first part (246ab483) made /read the picker at full size under its
lede, so these left the page; FP-23 and FP-24 bring them to Home.
`git show 7da9c1b7:src/pages/read.astro` holds them whole.

- **“Ways to read”** (FP-24, FR-13): the lede “Read the LIT however suits
  you: two ways on the web, plus free apps for iPhone and Android,” and
  four cards. Chapter View (“Scripture pages” with the preview), to
  /matthew-5: “One chapter at a time, with its footnotes, key terms, and
  linked references. Nothing to set up, and it works on any device.” Read
  View, to /read/matthew#ch-5: “A whole book on one page, read straight
  through, with no notes and no page turns between chapters.” Study Desk,
  badged “Available now,” to /desk/?place=matthew-5: “The whole New
  Testament in one scroll, with your notes and the Greek alongside when
  you want them.” Apps, badged “Available now,” to /apps: “iPhone and
  Android apps with the whole translation offline, plus notes,
  highlights, and daily and Lectionary readings.” Read View's card
  doesn't come back (FP-25), and Study's takes Featherboa's names.
- **Continue reading's chip**: now the picker's first row (FP-07), and
  Home's first row with Phase 7 (NX-12).
- **“What's new”**: a disclosure of the three latest release notes, each
  linked to /release-notes/#id, then “See all release notes →” (FP-23:
  “Latest text changes” stays on Home and with Release Notes).
- **ReadLayout's search bar and its Study Desk pill**: gone with the
  layout; /read keeps the header's magnifier (queue Q64).

### Where the record is unclear

Found while writing and checking this ledger. Each is settled when its phase
is built: by the record if a closer reading settles it, otherwise by the
run's best reading, entered in the plan's queue with what was done.

- **Phase 2, the kit.** The sixteen named icons lack "forward" (one of the
  five allowed to stand alone), a ▾ chevron, and the Trash icon the folded
  sidebar needs, and "Layout" loses its use once the Layout window goes.
  "Controls" says typed glyphs (× ‹ › ▾) stop standing in for icons, while
  the record writes ‹ › ▾ × → ↓ in labels throughout: which become icons,
  and whether → and ↓ stay typed. How an unavailable control gives its
  reason (a line beside it, or a description it points to), and its words
  beyond the Greek and the Notebook's dimmed commands. Labels that break the
  record's own rules: "From my notes…", "Import into my notebook," and
  "Follows my account" use "my"; "Add to a sheet…", "Add a note on verse
  1," and "Empty the trash now" use articles (the last is also a second name
  for "Empty trash…"); the labels test needs an exceptions list or BVJ's
  words.
- **Phase 3, the bars.** How far a scroll hides the phone's bars: the
  record says they return on any scroll up; the notes above keep 2.0's
  rule. Where a news dot or a "New" mark shows on a phone, whose menu is a
  bottom sheet. Both read by the run in 782271a5: queue Q36 and Q44.
- **Phase 4, the Read page.** The place line's order: "Search · ‹ › ·
  Notebook" ("Finding a passage") against the plan's "‹ ›, Search,
  Notebook." The picker's size beyond showing all 27 books unscrolled
  (FP-08 checks at 1100 by 700). Whether "jn 3 16," with no colon, resolves
  through `resolveMistypedPath`. The reader's notes' pale sunshine tint and
  sunshine bar have no values, and the progress line no thickness. The
  first three read by the run in 246ab483: the record's order (FP-28); a
  50rem panel, 60rem in OpenDyslexic, 492px tall (queue Q58 and Q75); and
  “jn 3 16” through the search box's jump before the guesser (FP-04).
- **Phase 5, beside scripture.** The width of the panel that slides over the
  right edge on a tablet (footnotes, Go deeper).
- **Phase 7, the front door.** The front page's "Three panels" names four
  things (the apps, the podcast, "Ways to read," and Study). /read's
  "Latest text changes" "stays on Home" while the front page keeps one quiet
  "Latest change" line: one element or two. What a phone shows of John
  1:1 to 5 beside the buttons, and whether its margin note shows there.
- **Phase 8, off the screen.** The verse image was built ahead
  (60952c32), its readable floor, which has no number, kept as today's
  code (OS-20); Phase 8 is printing and the handouts.
- **Phase 9, Study's frame.** Study's header menu: "The header" lists
  Scripture, Notebook, Sheets, and Collections, "Names" three of them, and
  Trash is in neither. How "Sheets ▾" in the Study line behaves in the
  Notebook's and a collection's places. Where the "Follow reading" switch
  sits beside "Pin to this passage" in a following tab's More. Whether Search
  opened from the Trash, which has no pane beside it, moves the reader into
  Scripture's place. Whether the sidebar foot's status line (AC-16, needed
  by SD-45) is built here or in Phase 13.
- **Phase 10, the Notebook place.** Where Print… sits once it moves there.
- **Phase 11, Sheets.** The leader's paper label: E95's paper said "Leader
  copy"; the record says the paper "keeps the other half" but quotes
  "Leader's copy."
- **Phase 12, the Greek.** Whether "stays hidden" outside glossary words
  hides the card's whole "In the LIT here" row, footnote letters included,
  or only "rendered here as."
- **Phase 13, accounts.** The account page's end-to-end encryption switch is
  step SK4's work: build it, or only style it once SK4 is on `main`.

## Where it starts (WS)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| WS-01 | Featherboa replaces Site 2.0; where the two disagree, `SITE-FEATHERBOA.md` wins | 0 | `SITE-2.0.md` opens with a line saying Featherboa replaced it | built (63d07ac0) |
| WS-02 | Site 2.0's decisions don't carry over by themselves: a 2.0 choice holds only once a section of the record says so | all (0) | Checkpoint audits find no 2.0 pattern built without a row here | built (63d07ac0); held every phase |
| WS-03 | Site 2.0's code stays on `main` behind `data-restyle` until Featherboa decides what becomes of it | 0 | None; settled by BP-02 | superseded → BP-02 |
| WS-04 | BVJ makes every call; “Landing it”'s split of the calls between BVJ and BDR is not taken | all (0) | Every judgment call the run makes is a queue entry for BVJ | built (cf1cf82d, the queue); held every phase |
| WS-05 | The front page comes last: Design Directions' questions are taken one at a time, each answer gets a section, and the front page is answered and built last (BVJ, 2026-11-26) | 7 | Home is built after every other page's phase, in Phase 7's last step | open |

## Type (TY)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| TY-01 | The rule: “A reading face on a site should be sans-serif. Serif fonts are for headings and titles, heros, etc. only.” | all (1) | `test/featherboa-fonts.test.js`: no serif family on any reading-text rule | built (c1bb5383); held by the fonts test |
| TY-02 | The rule covers everything read at length: scripture, footnotes, introductions, articles, the glossary, the reader's notes, and the Greek, on screen and on paper | 1, 8 | Computed font-family of each kind at 1440, and the fonts in a printed PDF | built on screen (c1bb5383); paper in Phase 8 |
| TY-03 | Literata is out as the reading face, since it is a serif | 1 | `test/featherboa-fonts.test.js`: Literata only in a sheet's Style set and the viewer (SH-16) | built (c1bb5383) |
| TY-04 | Headings, titles, heroes, and the chapter numeral: Fraunces, the variable font, with its softness (`SOFT`) and wonk (`WONK`) axes | 1 | The served Fraunces files list `SOFT` and `WONK`; h1 to h3 compute to Fraunces | built (c1bb5383); its file's size is Q8 |
| TY-05 | Reading text: Source Sans 3, in place of Inter | 1 | Scripture, articles, and footnotes compute to Source Sans 3 at 1440 and 390 | built (c1bb5383); Latin Extended too (Q9) |
| TY-06 | Controls (buttons, labels, menus, a panel's own words): Atkinson Hyperlegible Next, in place of Inter | 1, 2 | Buttons, tabs, and menu rows compute to Atkinson Hyperlegible Next | built (c1bb5383, 7216b1ef) |
| TY-07 | Greek in sans text, and the Greek tab's SBLGNT: Source Sans 3's own polytonic Greek | 1, 12 | John 1:1's Greek in a footnote and in the Greek tab draws in Source Sans 3 | built (c1bb5383); the Greek tab checked in Phase 12 |
| TY-08 | Hebrew in sans text: Noto Sans Hebrew, as today | 1 | Kept: a footnote with Hebrew still draws it in Noto Sans Hebrew | built (c1bb5383, kept) |
| TY-09 | Greek and Hebrew in Fraunces: Cardo, as today | 1 | Kept: Greek inside a Fraunces heading draws in Cardo | built (c1bb5383, kept) |
| TY-10 | Paper (a printed chapter or introduction, handouts, a sheet's paper copy, its slides) and the verse image: the same as the screen, Fraunces headings and Source Sans 3 text (a Read View book's print goes with Read View, WB-44) | 8, 11 | PDFs of a chapter, an intro, and a sheet; the slides; the verse image's fonts | open |
| TY-11 | A sheet's serif, a leader's choice for a handout's words: Literata, in place of Crimson Text | 11 | Style's serif draws Literata in the editor, the PDF, and the phone's viewer | open |
| TY-12 | Source Sans 3 is set larger than Inter (about 20.2px matches Inter's 18px), so the change is never the family name alone | 1 | Measure x-heights of the refit sizes against Inter's at the old sizes | built (c1bb5383); Q11 |
| TY-13 | `--ch` is per face, so Source Sans 3 gets its own, and the reading measure is checked again in it | 1 | `test/featherboa-css-rules.test.js` (`--ch`, never `ch`); count characters a line per face and size | built (c1bb5383) |
| TY-14 | Fraunces loads as its variable font (`@fontsource-variable`), in place of the static 400 and 500 | 1 | `global.css` loads the variable files only; the package's axes checked | built (c1bb5383); Q8 |
| TY-15 | Fraunces's settings wait for the first heading drawn in it; the specimen used softness 50 with wonk on for headings, softness 100 for the numeral (the start settled by BP-13) | 1 | Computed `font-variation-settings` on a heading and on the paper's numeral | built (c1bb5383) at BP-13's start; OP-01 |
| TY-16 | Fraunces's italic gets one large line on a front-door page, never more, and never in reading or Study (DA-01) | 7 | Italic Fraunces appears only on Home, About, and the 404 page, once each | About and the 404 built (bae1d1cb); Home with Phase 7 |
| TY-17 | “Keep Atkinson”: controls stay Atkinson Hyperlegible Next, so two sans families stand side by side | 2 | No control computes to Source Sans 3 | built (7216b1ef, f47df065) |
| TY-18 | The Greek moves to Source Sans 3's own in both places, replacing the C27 plan's Greek from Inter | 1, 12 | No Greek glyph draws in Inter or Crimson Text | built (c1bb5383) |
| TY-19 | Atkinson and OpenDyslexic, which have no Greek, borrow Source Sans 3's | 1 | Greek in a footnote with Atkinson and with OpenDyslexic chosen draws in Source Sans 3 | built (c1bb5383) |
| TY-20 | Cardo stays for the SBLGNT's text-critical signs (⸀ and its kin), from its patch, unless Source Sans 3 has them (OP-03) | 12 | A verse with ⸀ in the Greek tab draws the sign, no missing glyph | open |
| TY-21 | Paper follows the screen, knowingly reversing E222 (the Sheets' paper “shouldn't use Fraunces at all”) | 8, 11 | A sheet's PDF titles in Fraunces; the E222 rule in `src/scripts/desk/sheets/CLAUDE.md` rewritten | open |

## Color (CO)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| CO-01 | Green is ink, not paint: every color has one job, and color comes off everything that has none | all (1) | Checkpoint audits: no color outside the rows below | built (c1bb5383); held at the checkpoints |
| CO-02 | Paper `#FAFAF8`: the page | 1 | `test/featherboa-tokens.test.js` | built (c1bb5383) |
| CO-03 | Ink `#1D231C`: all text; grays are ink at 78% and 66%, never a separate gray | 1 | `test/featherboa-tokens.test.js`; grep the stylesheets for gray hex values | built (c1bb5383) |
| CO-04 | LIT Green `#209D50`: the mark (the emblem, the chapter numeral, “you are here,” one band on the front page); never behind small text | 1 | `test/featherboa-tokens.test.js`; no LIT Green behind words in the preview | built (c1bb5383), but Home's green sections (CO-10, Phase 7) |
| CO-05 | Deep green `#0F6B33`: what can be pressed (links, and the one filled button on a view) | 1, 2 | `test/featherboa-tokens.test.js`; links compute to deep green | built (c1bb5383, 7216b1ef) |
| CO-06 | Sunshine `#FFD23F`: the reader's own; no longer a bar over titles | 1 | `test/featherboa-tokens.test.js` | built (c1bb5383) |
| CO-07 | Red `#B3261E`: deleting and errors, and bookmarks | 1 | `test/featherboa-tokens.test.js` | built (c1bb5383) |
| CO-08 | /apps' cobalt, red, and forest: the front page's feature panels only, never in reading or study | 7 | Grep: the three colors only in the home panels' rules and /apps | open |
| CO-09 | Links stay green, in the deep green (“the dark green of the proposal”) | 1 | Links on an article and a glossary entry compute to deep green, day and night | built (c1bb5383) |
| CO-10 | No longer green: the full green sections on Home | 7 | Home at 1440 and 390 has no green section | open |
| CO-11 | No longer green: the round arrow buttons | 2, 4 | No round green arrow button on any page | built (f47df065, 246ab483): the round arrows are gone, the line's ‹ › plain icons; no `nav-button` left in `src` (tested) |
| CO-12 | No longer green: the accents sky and ocean (Site 2.0's), which leave with the home page's chat bubbles | 0, 7 | Grep: no sky or ocean value left | built (63d07ac0): no sky or ocean left |
| CO-13 | Unchanged: the four highlighter colors | 1 | Kept: the four highlights draw by day as on `main` | built (c1bb5383, kept) |
| CO-14 | Unchanged: the six note markers (the reader's own labels) | 1 | Kept: the six markers' colors match `main` | built (c1bb5383, kept) |
| CO-15 | The cream goes as a page color, with “Surfaces” | 1 | Grep: no `#E1DFD9` left | built (c1bb5383); the verse image's cream went with 60952c32 (Q22); the link-preview cards, which no decision names, keep theirs |
| CO-16 | Bookmarks stay red | 1 | Kept: a bookmark draws in red | built (c1bb5383, kept) |
| CO-17 | The note icons keep their own colors | 1 | Kept: note icons' colors match `main` | built (c1bb5383, kept) |
| CO-18 | Verse numbers and footnote letters are deep green, with no underline | 1, 4 | John 3 at 1440: both compute to deep green with `text-decoration: none` | built (c1bb5383) |
| CO-19 | What can be pressed is deep green, and nothing else is; the rule has no exception | all (1) | Checkpoint audits: no deep green on anything that can't be pressed | built (c1bb5383); green button fills wait for the kit (Phase 2); held at the checkpoints |

## Surfaces (SU)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| SU-01 | The page is the paper (`#FAFAF8`); the cream (`#E1DFD9`) and the sheet laid on it go | 1 | John 3 and Home at 1440: no sheet, no cream | built (c1bb5383) |
| SU-02 | Site 2.0's cream everywhere, scripture “on a sheet,” and the page frame with the Marks go | 0, 1 | Grep: no `data-restyle` rule and no page frame left | built (63d07ac0, c1bb5383) |
| SU-03 | Things are set apart by space first, a hairline second, and a tint third | all (1) | Checkpoint audits: no box where space or a hairline serves | built (c1bb5383): the green bands outside Home now the page or a tint; held at the checkpoints |
| SU-04 | Two corner radii: 6px on what is pressed, 10px on what floats | 1, 2 | `test/featherboa-shapes.test.js`: no radius but 6, 10, and a switch's round | built (c1bb5383, 7216b1ef); the shapes test holds it |
| SU-05 | One shadow, and it means “this floats over the page and will go away”: menus, popovers, and dialogs have it, nothing else | 1 | `test/featherboa-shapes.test.js`: one shadow token, used only by floating things | built (c1bb5383): `test/featherboa-shapes.test.js`; the desk's button kinds wait for Phase 2, the Sheets for Phase 11 |
| SU-06 | No ornament: the sunshine bar over titles goes | 1 | No title carries a bar | built (63d07ac0, c1bb5383): no title carries a bar |
| SU-07 | No ornament: the Marks go | 0, 1 | Grep: no Marks markup or rule | built (63d07ac0) |
| SU-08 | No ornament: the emblem watermark (Site 2.0's 404 and forms) goes | 0, 7 | The 404, Contact, and App support pages show no watermark | built (63d07ac0) |
| SU-09 | One exception: a sheet's page in its editor sits on a tinted desk | 11 | A sheet at 1440: a white page on a tinted desk | open |
| SU-10 | The stage badge stays while Study is in a stage (“It's not a decoration. It's information.”) | 9 | The badge shows while `DESK_STAGE` is set | open |
| SU-11 | The badge's place: once, at the foot of the Study sidebar (NX-24) | 9 | The badge appears only at the sidebar's foot | open |
| SU-12 | The badge's word turns from “preview” to “beta” at the public opening (`STUDY-DESK.md`, "Launching") | 14 | `DESK_STAGE` reads “beta” at Phase 14 | open |
| SU-13 | Whether a beta stage is left if the opening and sync land on the same day (open in `STUDY-DESK.md`) | 14 | BVJ's answer at Checkpoint B | queued (Q5) |

## Sizes, space, and the measure (SZ)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| SZ-01 | Headline: Fraunces 300 to 800, 56 to 104 / 0.95; the front door only, one per screen | 1, 7 | `test/featherboa-tokens.test.js`; Home's first screen at 1440 and 390 | tokens built (c1bb5383); Home in Phase 7 |
| SZ-02 | Title: Fraunces 400, 48 to 62 / 1.0; the name of a book or a page | 1 | `test/featherboa-tokens.test.js`; an intro and /about at 1440 | tokens built (c1bb5383); each page takes them when its phase draws it |
| SZ-03 | Heading: Fraunces 500, 28 / 1.15; sections of an article, a sheet's title | 1 | `test/featherboa-tokens.test.js` | tokens built (c1bb5383); each page takes them when its phase draws it |
| SZ-04 | Subhead: Fraunces 500, 21 / 1.2; panel and pane titles | 1 | `test/featherboa-tokens.test.js` | tokens built (c1bb5383); panel and pane titles in Fraunces 500 now, the size with Phases 2 and 9 |
| SZ-05 | Scripture: Source Sans 3 400, refit from the proposal's 20 / 1.62; the reader's size M, with S, L, and XL still scaling it | 1 | x-height measured against the proposal; `test/display-scale.test.js` kept green | built (c1bb5383); Q11 |
| SZ-06 | Text: Source Sans 3 400, refit from the proposal's 17 / 1.6; articles, introductions, footnotes at full length, the reader's notes | 1 | x-height measured on an article at 1440 | built (c1bb5383); Q11 |
| SZ-07 | Margin: Source Sans 3 400, refit from the proposal's 15 / 1.5; notes beside a line, list rows in Study | 1 | x-height measured on a margin note | token built (c1bb5383); margin notes take it in Phase 5; Q11 |
| SZ-08 | Label: Atkinson Hyperlegible Next 600, 14.5 / 1.4; every button, tab, and menu row | 1, 2 | `test/featherboa-tokens.test.js` | token built (c1bb5383); the kit's classes apply it (7216b1ef); the old names take it with their surface's redraw (Q15) |
| SZ-09 | Small label: Atkinson Hyperlegible Next 600, 12.5 / 1.4; counts, dates, captions; nothing is smaller | 1 | `test/featherboa-tokens.test.js`; no computed size under 12.5px | token built (c1bb5383); the kit applies it (Phase 2) |
| SZ-10 | Verse number: Atkinson Hyperlegible Next 600 at 0.56 of the text, growing and shrinking with it, in deep green with no underline | 1, 4 | The ratio measured at S and XL | built (c1bb5383) |
| SZ-11 | The three reading sizes are refit so Source Sans 3's small letters stand as tall as the proposal drew them, measured when built; their line heights are checked with them | 1 | The measured values written beside the tokens; John 1, the specimen, on the preview | built (c1bb5383): the values beside the tokens; Q11 |
| SZ-12 | One spacing scale: every gap, padding, and margin is 4, 8, 12, 16, 24, 32, 48, 64, or 96 | all (1) | `test/featherboa-spacing.test.js` over the new stylesheets | tokens built (c1bb5383); the spacing test starts with the kit's stylesheet (Phase 2) |
| SZ-13 | On a computer the reading page is a 220 quiet side, a 660 text column, and a 320 margin | 4 | Measure at 1440: 220, 660, 320 | open |
| SZ-14 | The text column never gets wider; on a bigger screen only the outer space grows | 4 | The column measured at 1440 and 1920 | open |
| SZ-15 | The measure stays inside 45 to 75 characters (the 660 column's count measured again in Source Sans 3 through `--ch`); larger sizes shorten it | 1, 4 | Count characters a line on John 3 at each size and face | built (c1bb5383): `--reading-width` holds 45 to 75 `--char`; counted again in Phase 4 |
| SZ-16 | These widths are where every page starts, not a limit (“Keep dragging”): with Study on, the reader still drags the lines between the text, their notes' margin, and the Notebook (E189) | 4, 5 | Kept: `test/desk-e189-lines.test.js` green; drag each line at 1440 | open |
| SZ-17 | The text column drags only within 45 to 75 characters a line | 4 | Drag to each end and count characters | open |
| SZ-18 | Phone, under 700: text full width with 24 at each side; notes and footnotes a sheet from the bottom; one row on top and a bar at the thumb | 3, 5 | The preview at 390 | open |
| SZ-19 | Tablet, 700 to 1099: text 660, centered; notes and footnotes a panel that slides over the right edge; the full header | 3, 5 | The preview at 820 | open |
| SZ-20 | Computer, 1100 and up: text 660; the 320 margin, beside the line; the full header and the place line | 4, 5 | The preview at 1100 and 1440 | open |
| SZ-21 | Study, 1100 and up: two panes share what is left; the companion pane; “A 236 sidebar that never moves” | 9 | None; see SD-46 | superseded → SD-46 |
| SZ-22 | Study's row as changed with proposal 21: one to three panes of tabs, and a sidebar that folds | 9 | Covered by SD-15 and SD-46 | open |
| SZ-23 | Anything pressed is 36px tall with a mouse, 44 on touch, and 32 only inside the Study sidebar | 2, 9 | Measure controls at 1440 and 390, sidebar rows at 1440 | the kit's classes built (7216b1ef); the old names keep their size until their surface's redraw (Q15); the sidebar's 32px in Phase 9 |
| SZ-24 | Old-style figures in running text, lining figures in the interface (counts and dates) | 1 | `font-variant-numeric` on text and on labels, once OP-04 is answered | queued (Q7) |

## Controls (CT)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| CT-01 | Labels: verb, then thing (“Add note,” “Copy verse,” “Print sheet”) | all (2) | Checkpoint audits of every label | held from Phase 2 (f47df065) for the shared pieces; checked at each checkpoint |
| CT-02 | Sentence case; capitals only for the names of places (the Notebook, Sheets, Collections) | all (2) | Checkpoint audits of every label | held from Phase 2 (f47df065) for the shared pieces; checked at each checkpoint |
| CT-03 | An ellipsis only when the command needs more from the reader before it acts (“Add to sheet…,” “Share…”) | all (2) | Checkpoint audits: every label with “…” asks for more | held from Phase 2 (f47df065) for the shared pieces; checked at each checkpoint |
| CT-04 | One name per thing, and no “My”; inside Study everything is the reader's | all (2) | `test/featherboa-labels.test.js`: no reader-facing “My ” but the record's own exceptions | built for the shared pieces (7216b1ef, f47df065); each surface's phase takes its files off the test's LATER |
| CT-05 | No articles: “Add note,” not “Add a note” | all (2) | `test/featherboa-labels.test.js` | built for the shared pieces (7216b1ef, f47df065); each surface's phase takes its files off the test's LATER |
| CT-06 | Rename: Notebook, My Notebook, the Notebook, and My Notes become Notebook (the place) and Notes (what is in it) | 2, 5, 9, 10 | `test/featherboa-labels.test.js` | the header's part built (f47df065); the Notebook's names with Phases 5, 9, and 10 |
| CT-07 | Rename: Sheets, My sheets, and Sheets page become Sheets | 9, 11 | `test/featherboa-labels.test.js` | open |
| CT-08 | Rename: Add a note, Add bookmark, and Add a bookmark that moves become Add note and Add bookmark | 5 | The verse menu's and the selection panel's labels | open |
| CT-09 | Rename: Open in Study Desk, Edit in Study Desk, and Open the Study Desk become one label, the verb with its passage, “Study Romans 8”; the proposal's “Open in Desk” is not taken | 4, 9 | `test/featherboa-labels.test.js`: no “Study Desk” a reader sees | the place line's built (246ab483), and Search's second row (f1a6b2af); Study's own labels with Phase 9 |
| CT-10 | Rename: “Show” (four different controls) becomes View for what a page displays and Filter for lists | 4, 10 | No reader-facing “Show” heading in the tray or a list | open |
| CT-11 | Rename: Display settings, Display, and Display options become Display | 4 | The tray and its button say “Display” | open |
| CT-12 | Rename: Stay here and Stop following become one switch, Follow reading | 9 | A following tab offers the switch; no “Stay here” or “Stop following” | open |
| CT-13 | Rename: Layout… and Make this pane wider become a layout switch in view (the pane count) and dragging the divider | 9 | No “Layout…” or “Make this pane wider” in Study | open |
| CT-14 | This reverses “My Notes” (BA138, BA139) and “My Notebook” (E70), which `src/scripts/desk/CLAUDE.md` holds until Featherboa is built | 9, 10 | The desk file's rules rewritten in the same commit | open |
| CT-15 | “Notes” is the reader's and “footnotes” the translation's; the two words are never used for each other | all (2) | Checkpoint audits of labels and the help page | held from Phase 2 (f47df065); checked at each checkpoint |
| CT-16 | The workspace is “Study”; the proposal's “Desk” (“Open in Desk,” and Desk among the places) is not taken | 9 | `test/featherboa-labels.test.js` | open |
| CT-17 | One icon set, in place of the sixteen scattered today: a 24-pixel grid, a 1.5-pixel stroke, round ends, sized to sit beside its label (Lucide's, BP-12) | 2 | `test/featherboa-icons.test.js`: every icon comes from `src/lib/icons.mjs` | the set built (7216b1ef); every shared piece draws from it (f47df065); Study's icons still drawn by hand go with their phases (Q20, the notes above) |
| CT-18 | Typed glyphs (× ‹ › ▾) stop standing in for icons | 2 | Grep the markup and scripts for typed ×, ‹, ›, and ▾ drawn as controls | built (f47df065) |
| CT-19 | An icon stands alone only if it is one of five everyone knows (search, close, back, forward, and more); every other icon keeps its word | 2 | `test/featherboa-icons.test.js`: an icon-only control is one of the five and has an accessible name | built (7216b1ef, f47df065); a note's “Show all” caret in the Notebook panel waits for Phase 5 (the notes above) |
| CT-20 | The set the proposal draws: Read, Notebook, Sheet, Collection, Highlight, Note, Bookmark, Copy, Share, Print, Layout, New, Search, Close, Back, More | 2 | `src/lib/icons.mjs` exports each by name, for `.astro` files and client scripts | built (7216b1ef) |
| CT-21 | Emphasis, filled (deep green): the one main action; a view may use it once | 2 | `test/featherboa-kit.test.js`; count filled buttons per view in the preview | built (7216b1ef, f47df065) |
| CT-22 | Emphasis, tinted: the usual next step | 2 | `test/featherboa-kit.test.js` | built (7216b1ef, f47df065) |
| CT-23 | Emphasis, plain (words and an icon, no box until pointed at): everything else, most commands on a tool surface | 2 | `test/featherboa-kit.test.js` | built (7216b1ef, f47df065) |
| CT-24 | Emphasis, red words: deleting; never filled | 2 | `test/featherboa-kit.test.js`: no red fill on a button | built (7216b1ef, f47df065) |
| CT-25 | The ladder replaces Study's four kinds of button (E126: primary, ordinary, toggle, and quiet or glyph) | 2 | `test/desk-buttons-css.test.js` rewritten to the kit | built (f47df065) |
| CT-26 | It relaxes E159 for plain commands only; a tinted or filled button still never matches its background | 2 | Tinted and filled buttons on every surface, by day and night | built (f47df065) |

## The kit (KT)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| KT-01 | If a screen needs something not in the kit, that is a design conversation before it is a line of code | all (2) | Every addition the run makes is a queue entry | held (7216b1ef); every addition the run makes is a queue entry |
| KT-02 | Ten controls: filled, tinted, plain, destructive, icon alone, field, checkbox, switch, tabs, and list row | 2 | `src/styles/kit.css` defines each; `test/featherboa-kit.test.js` | built (7216b1ef, f47df065) |
| KT-03 | Five states: at rest, pointed at, pressed or on, keyboard focus, and unavailable | 2 | `test/featherboa-kit.test.js`: each control has each state | built (7216b1ef, f47df065) |
| KT-04 | One small stylesheet of control classes, shared by the header, the reading page, and Study, in place of rules in `global.css`, `restyle.css`, and `desk.css` | 2 | `test/featherboa-kit.test.js`: no button rule outside `kit.css` | built (7216b1ef); the old names take its looks by name (Q15) |
| KT-05 | Pointed at is one step stronger, with no movement and no shadow (no lift on hover) | 2 | `test/featherboa-kit.test.js`: no transform or shadow on hover | built (7216b1ef, f47df065) |
| KT-06 | On is a fill or a green underline plus a heavier weight, so it never depends on color alone | 2 | Tabs, choices, and switches at 1440 by day and night, and in grayscale | built (7216b1ef, f47df065) |
| KT-07 | Focus is the same 2-pixel green ring everywhere, 2 pixels off the control (`--focus-ring`, as today) | 2 | Kept: walk each new control with the keyboard | built (f47df065): one rule, global.css's :focus-visible; the kit test's "focus is the one ring" |
| KT-08 | Unavailable stays legible: its fill stays, its words stand at 4.5:1 or more on every surface, and it is never faded with `opacity` | 2 | `test/featherboa-kit.test.js`: no `opacity` on an unavailable control; contrast measured | built (7216b1ef, f47df065) |
| KT-09 | An unavailable control's reason is given where a keyboard or a finger reaches it too (beside the line, and to screen readers) | 2 | Tab to an unavailable control; read its description with `read_page` | kept as today (f47df065): the Study's menus give each unavailable row its reason beside it and to screen readers (menu-reasons.js); each Study phase rechecks its own |
| KT-10 | Tabs change what a pane shows; a switch turns one thing on at once; a checkbox is for a list of things to tick, then act on | 2 | Checkpoint audits: each control used for its own job | built (7216b1ef, f47df065) |
| KT-11 | Today's green-filled pills (“John 1 / Everything,” Theme, Text size) become tabs or a plain row of choices | 2, 4 | No green-filled pill left in the tray or the panel | built (f47df065) for the Display tray's Theme and Text size and the panel's “John 1 / Everything”; Phase 4 rechecks the tray |
| KT-12 | This settles E160: a chosen segment and a lone toggle that is on share one look (a fill or a green underline with a heavier weight) | 2 | A chosen segment beside an on switch at 1440 | built (7216b1ef, f47df065) |
| KT-13 | Everything pressed has 6-pixel corners | 2 | `test/featherboa-shapes.test.js` | built (7216b1ef, f47df065); the shapes test holds it |
| KT-14 | The only round things are switches, color dots, and the emblem | 2 | `test/featherboa-shapes.test.js`: a full round only on those three | built (7216b1ef, f47df065); the shapes test holds it |
| KT-15 | This changes E141: chips take the 6-pixel corner too, and a real switch (“Follow reading,” in place of the Stay here toggle) is the one round control | 2, 9 | Chips at 6px; the Follow reading switch round | chips built (f47df065); the Follow reading switch in Phase 9 |

## Motion (MO)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| MO-01 | Instant, 0: pointing, pressing, selecting, switching tabs, turning a setting on, highlighting a verse; nothing moves | 1 | `test/featherboa-motion.test.js` | built (c1bb5383) |
| MO-02 | Quick, 120 ms: menus, popovers, tooltips; fades in and rises 4 pixels toward where it was called from | 1 | `test/featherboa-motion.test.js` | built (c1bb5383): the speed; each menu's 4px rise with the kit (Phase 2) |
| MO-03 | Settled, 180 ms: a margin note opening, the Notebook panel, the phone bar hiding; slides 8 pixels from its edge and fades | 1, 3, 5 | `test/featherboa-motion.test.js` | built (c1bb5383): the speed; the slides with Phases 3 and 5 |
| MO-04 | Large, 260 ms: bottom sheets, dialogs, present mode; travels its full height while the page dims behind it | 1, 5 | `test/featherboa-motion.test.js` | built (c1bb5383): the speed; the dimming with Phase 5 |
| MO-05 | One curve: everything arrives fast and settles gently (a sharp ease-out) | 1 | `test/featherboa-motion.test.js`: one easing token, no bare `ease` | built (c1bb5383) |
| MO-06 | Leaving takes two thirds as long as arriving | 1 | `test/featherboa-motion.test.js` | built (c1bb5383) |
| MO-07 | Nothing bounces, and nothing loops | 1 | Grep: no `infinite` animation and no overshooting curve | built (c1bb5383) |
| MO-08 | Scripture never moves: it does not animate, shift, or reflow when a note or panel opens, since the margin is already reserved | 4, 5 | Open a footnote and the panel at 1440; the first verse keeps its position | open |
| MO-09 | Reduced motion is unchanged: a reader whose device asks for less gets no movement | 1 | Kept: emulate `prefers-reduced-motion`; open a menu, a sheet, and the panel | built (c1bb5383, kept) |
| MO-10 | Built as four duration tokens and one easing token, then one pass pointing every transition at one of them | 1 | `test/featherboa-motion.test.js`: no transition or animation outside the four durations | built (c1bb5383); Q12 |

## Night (NI)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| NI-01 | The page is `#111411`, and text `#ECEEE8` (15.9:1) | 1 | `test/featherboa-tokens.test.js` | built (c1bb5383) |
| NI-02 | One page color by night: today's `#0E0E0F` page and `#161617` surfaces go | 1 | Grep: neither value left | built (c1bb5383) |
| NI-03 | LIT Green brightens to `#2DB463` at night | 1 | `test/featherboa-tokens.test.js` | built (c1bb5383) |
| NI-04 | A highlight becomes a low amber wash at night, the words on it at 8:1 | 1 | `test/featherboa-contrast.test.js` | built (c1bb5383) |
| NI-05 | Each of the four highlighter colors gets such a night wash, its words at 8:1 or more | 1 | `test/featherboa-contrast.test.js` for all four | built (c1bb5383) |
| NI-06 | Depth without shadows: what floats at night gets a slightly lighter surface and a hairline edge in place of the one shadow | 1 | A menu and a dialog at night, 1440 | built (c1bb5383) |
| NI-07 | Built as the dark values in the token file, every dark style written for both the device setting and the reader's own switch | 1 | `test/featherboa-css-rules.test.js`: every dark rule in both selectors | built (c1bb5383) |
| NI-08 | Every text pairing needs 4.5:1, save LIT Green, held to 3:1 because it marks and sets large type and never words | 1 | `test/featherboa-contrast.test.js` | built (c1bb5383) |
| NI-09 | Contrast: ink on paper (scripture, all body text), 15.4 by day and 15.9 by night | 1 | `test/featherboa-contrast.test.js` | built (c1bb5383) |
| NI-10 | Contrast: second ink on paper (captions, secondary labels), 7.6 and 9.0 | 1 | `test/featherboa-contrast.test.js` | built (c1bb5383) |
| NI-11 | Contrast: third ink on paper (counts, dates), 5.1 and 5.9 | 1 | `test/featherboa-contrast.test.js` | built (c1bb5383) |
| NI-12 | Contrast: third ink on the darkest tint (counts in a selected sidebar row), 4.8 and 5.4 | 1 | `test/featherboa-contrast.test.js` | built (c1bb5383) |
| NI-13 | Contrast: deep green on paper (links, plain green commands), 6.3 and 9.6 | 1 | `test/featherboa-contrast.test.js`; the night deep green chosen to reach 9.6 | built (c1bb5383); Q10 |
| NI-14 | Contrast: the label on the filled button (the one main action), 6.6 and 9.7 | 1 | `test/featherboa-contrast.test.js` | built (c1bb5383) |
| NI-15 | Contrast: ink on a highlight (highlighted scripture), 13.3 and 8.1 | 1 | `test/featherboa-contrast.test.js` | built (c1bb5383): 13.4 by day; Q10 |
| NI-16 | Contrast: red on paper (deleting, errors), 6.3 and 7.5 | 1 | `test/featherboa-contrast.test.js`; the night red chosen to reach 7.5 | built (c1bb5383); Q10 |
| NI-17 | Contrast: LIT Green on paper (the chapter numeral, the “you are here” line), 3.4 and 6.9 | 1 | `test/featherboa-contrast.test.js` | built (c1bb5383) |
| NI-18 | Green words are always the deep green; LIT Green serves a large numeral or a marker line, not words | 1 | Grep: LIT Green never sets the color of words | built (c1bb5383) for words; the menu sheet's group headings (782271a5: ink, the current one underlined in LIT Green); the green on ink buttons' hover (Phase 2) and Home (Phase 7) wait |

## Nothing interrupts the reader (NX)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| NX-01 | Nothing appears over scripture unless the reader asked for it | all (5) | Load John 3 fresh at 1440 and 390: nothing opens over the text unasked | open |
| NX-02 | Nothing asks to be dismissed | all (5) | Checkpoint audits: no “Got it,” “Remind me later,” or “Don't show this again” | open |
| NX-03 | If a message matters, it has a permanent place; if it does not, it is not shown | all (5) | Checkpoint audits | open |
| NX-04 | Pull, and push: a message waits in its place; what a reader doesn't know exists, or doesn't know is ready, is pushed, once and never over scripture; any new message is tested by which of the two it is | all (5) | Each new message's queue entry says which it is | open |
| NX-05 | Anything that would lose a reader's writing (a failed save, a notebook this computer can no longer open) may interrupt, once, in plain words, with the fix as its button | 5, 13 | Kept: force a failed save; one notice, its fix the button | open |
| NX-06 | Two more exceptions, never over scripture: a launch's announcement window, and the app banner on phones | 5, 14 | `test/announcement-gate.test.js` kept green; the banner at 390 | open |
| NX-07 | Status: one line at the foot of the thing it is about, changing its words, never its place (in place of the notice card atop the Notebook panel, the reminder checkbox, and a dot on a tab) | 5, 13 | The panel's foot line in each state; no notice card | open |
| NX-08 | Teaching: the empty state, one sentence and one button, shown exactly when there is nothing else to show; Help holds the rest (tour cards over the page, with Take the tour now, Remind me later, and Don't show this again, go) | 5, 13 | A fresh profile with the preview: no tour card; the empty state shows | open |
| NX-09 | News: where its subject lives, and a “Changed since you marked it” filter in the Notebook; nothing opens by itself, save a launch's window | 3, 10 | The header's popover never opens outside a launch | the header's part built (ec3378b6); the Notebook's filter with Phase 10 |
| NX-10 | News behind a dot beside About (the proposal's) | 3 | None; see NX-26 | superseded → NX-26 |
| NX-11 | Asks: the front page and the footer, never above scripture; the phone menu carries one “Get the app” row | 3, 7 | The newsletter in the footer; no ask above scripture at 390 and 1440 | the footer's newsletter kept (ec3378b6); the menu sheet's row built (782271a5); Home with Phase 7 |
| NX-12 | Your place: “Continue: Romans 8” is the first row of the book picker and of Home, in place of “Continue reading” chips to dismiss | 4, 7 | Read Romans 8, then open the picker and Home | the picker's row built (246ab483); Home's with Phase 7 |
| NX-13 | The empty state for a chapter with none of the reader's notes: “No notes on John 1 yet. Select a verse number or any words, then choose Note, Highlight, or Bookmark,” with “Show me how” | 5 | The panel's Notes tab on an unmarked chapter | open |
| NX-14 | The foot line's first state, “Kept on this computer only” with “Back up…” | 5 | None; see NB-34 | superseded → NB-34 |
| NX-15 | The foot line's other states: “In sync,” “Offline. Your changes are saved here.,” and “Signed out. Your notebook is still here.” with “Sign in” | 5, 13 | `test/desk-sync-status-line.test.js` rewritten to these words | open |
| NX-16 | The backup reminder becomes the foot line's words, not a bar: when due (E113: 7 days after the last backup) the line says so (“Last backed up 9 days ago”) beside “Back up…” | 5 | `test/desk-reminder-bar.test.js` rewritten; set the last backup 9 days back | open |
| NX-17 | The tour stays, behind “Show me how” in the empty state, and Help lists it; it is the acting tour, not rewritten as text | 5, 13 | Press “Show me how”; the tour acts | open |
| NX-18 | The tour offer stays prominent by its place rather than a floating window | 5, 13 | No floating tour offer on any page | open |
| NX-19 | “Start here” heads Study until the tour is taken: the first time the Notebook or the workspace opens, its first line is “Start here: Take the tour,” the view's one filled button | 13 | A fresh profile: open Study, then the Notebook | open |
| NX-20 | It keeps its place across visits and never asks to be dismissed; taking the tour, or “I know my way around,” moves it into Help | 13 | Take the tour and reload: the line has moved into Help | open |
| NX-21 | A reply at the first use: the first highlight, note, or bookmark adds “New here? Take the tour” to the line the action brings (“Highlighted · Undo”) | 5 | A fresh profile with the preview: highlight a verse | open |
| NX-22 | The front door: Study's way in on Home (its panel) and the header's Study menu offer “Take the tour” to a first-time visitor | 3, 7 | A fresh profile with the preview: Home's Study panel and the Study menu | queued (Q26) |
| NX-23 | The app banner stays on phones, dismissed for 90 days as today | 3 | Kept: the banner at 390 with an Android user agent; dismiss and reload | built (ec3378b6, kept) |
| NX-24 | The stage badge is shown once, at the foot of the Study sidebar, not on every panel | 9 | The Notebook panel and Study's panes show no badge | open |
| NX-25 | News shows where its subject lives, and a launch adds the window (“Yes, both”) | 3, 14 | Covered by the rows below | built (ec3378b6), by the rows below; the launch's window with Phase 14 |
| NX-26 | Ordinary news is marked on the place it is about: a dot on the header menu that holds what changed and “New” beside the item inside it, the dot clearing once the reader opens that menu | 3 | Put an entry in the news data file; open the menu; reload | built (ec3378b6), tested; the menu sheet's marks and the Menu buttons' dots (782271a5), tested with entries; when “New” goes queued (Q31) |
| NX-27 | A new article or episode marks Learn; a Study feature marks Study | 3 | The same, with a Learn entry and a Study entry | built (ec3378b6), tested with Learn and Study entries |
| NX-28 | Text changes stay where reading starts, as Release Notes already is (/read's “Latest text changes,” Home's “Latest change,” and the footer; /read's moves by FP-23) | 3, 4, 7 | Release Notes reachable from the picker, Home, and the footer | the footer built (ec3378b6), and the picker (246ab483); Home with Phase 7 |
| NX-29 | Never only under About: the preview's About menu drops its “What's new” link | 3 | The About menu with the preview has no “What's new” row | built (ec3378b6) |
| NX-30 | A launch (the apps, Study's opening, the What's New page itself; BVJ names each) spells its mark out on its menu (“Study · New”) for a set time | 14 | The Study menu with the launch's entry set | open |
| NX-31 | A launch adds the front page's band for its set time | 7, 14 | Home with the launch's entry set | open |
| NX-32 | A launch adds the announcement window, kept for launches only under today's rules (one at a time, never on a session's first page or over scripture, once per reader) | 5, 14 | `test/announcement-gate.test.js` kept green | open |
| NX-33 | The window announcing the What's New page is how readers learn it exists; after that the marks point to it | 14 | The launch window links /whats-new | open |
| NX-34 | Home's “Continue” sits on the front page's first screen | 7 | Covered by FR-07 | open |

## The reading page (RP)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| RP-01 | The chapter page feels like a well-made reader's Bible: a book face, a true measure, quiet numbers, and margins that do work; no paper texture, no page curl, no card | 4 | John 3 at 1440 against the proposal's drawing | open |
| RP-02 | Built mostly as styles on today's markup; every Display setting keeps working; the margin footnote is the new behavior | 4 | Each tray setting on the new page | open |
| RP-03 | Scripture in Source Sans 3 at its refit size, about 70 characters a line in the 660 column | 1, 4 | Count characters a line on John 3 at size M | built (c1bb5383): the size; counted in Phase 4 |
| RP-04 | The chapter number is a drop numeral in LIT Green, as in the apps | 4 | None; see WB-16 | superseded → WB-16 |
| RP-05 | Verse numbers and footnote letters are deep green with no underline, not the proposal's small gray figures and small italics (CO-18) | 4 | Covered by CO-18 | open |
| RP-06 | Footnote letters stand upright, never italic | 4 | Computed `font-style: normal` on footnote letters | open |
| RP-07 | No sheet: the text sits on the page | 1, 4 | John 3 at 1440: no card behind the text | built (63d07ac0, c1bb5383) |
| RP-08 | The way on at the foot is large type in deep green (“John 2 →,” with “Luke 24” back), not a filled button | 4 | The foot of John 21, and John 3 without JavaScript | open |
| RP-09 | The way on at every chapter's foot | 4 | None; see WB-10 | superseded → WB-10 |
| RP-10 | Footnotes and the reader's notes share the 320 margin, one place for everything about a line | 5 | John 3 at 1440 with notes and a footnote open | open |
| RP-11 | A footnote opens in the margin when its letter is pressed, one at a time | 5 | Press a letter at 1440 | open |
| RP-12 | Another letter swaps it; ×, Escape, or a press elsewhere closes it | 5 | Each way, by pointer and keyboard | open |
| RP-13 | The opened footnote floats over the reader's notes beside its line, never pushing them down | 5 | The notes below don't move when a footnote opens | open |
| RP-14 | It has the one shadow and the 10-pixel corner | 5 | Computed shadow and radius | open |
| RP-15 | It shows the whole note right there; taller than the window, it stops at the window's edge and scrolls inside itself, as menus do (E179) | 5 | The longest footnote in a 1100 by 700 window | open |
| RP-16 | At its foot, “In the notes ↓”, the other way to read it | 5 | The link shows on every margin footnote | open |
| RP-17 | “In the notes ↓” goes to the note's entry in the list at the chapter's end | 5 | None; see WB-21 | superseded → WB-21 |
| RP-18 | The proposal's “Read the whole note →” is not used | 5 | Grep: no such label | open |
| RP-19 | The reader's notes lie flat on the page, on a pale sunshine tint with a sunshine bar down the left edge | 5 | A note at 1440, by day and night | open |
| RP-20 | A note is headed “Your note · verse 5,” with its marker's dot when it has a label | 5 | A labeled and an unlabeled note | open |
| RP-21 | Notes and footnotes differ by floating against flat, printed against tinted, and a letter against “Your note,” never by color alone | 5 | A grayscale screenshot at 1440 still tells them apart | open |
| RP-22 | Notes stack beside their lines as today (five on a line, then “N more notes”) | 5 | Kept: six notes on one verse | open |
| RP-23 | Playpen Sans goes, and the notes' “Plain” setting with it | 5 | Grep: no Playpen Sans file or rule, no “Plain” setting | open |
| RP-24 | The reader's notes follow the reader's Display face at the Margin size (Source Sans 3 by default, or Atkinson or OpenDyslexic) | 5 | Switch faces; a note follows | open |
| RP-25 | The site keeps three reading faces | 4 | The tray's Text row has three choices | open |
| RP-26 | Without a margin, the popover is the fallback and shows the whole note, with the same “In the notes ↓” | 5 | Press a letter at 820 | open |
| RP-27 | On a phone, a footnote opens as a sheet from the bottom, whole | 5 | Covered by PH-21 | open |
| RP-28 | The reader's notes are Study's, which a phone doesn't have | 5 | At 390 with `?desk=on`: no margin notes | open |
| RP-29 | One line under the header says where the reader is, and each part is a picker: “John” lists the books, “Chapter 1” the chapters | 4 | Press each part at 1440 | built (246ab483): “John ▾ / Chapter 3 ▾” at 1440; John opens the panel at the books with focus in the field, Chapter 3 with focus on 3 |
| RP-30 | Previous and next are plain arrows in the line, and large type at the foot | 4 | The line's arrows at 1440 | built (246ab483): plain icons named “Previous: John 2” and “Next: John 4,” unavailable at the ends and stepping over drafts as Previous and Next do; the foot's large buttons kept |
| RP-31 | The line's right end loses “Switch to Read View” | 4 | Grep: no such label | built (246ab483): no “Switch to Read View” on a chapter (grep) |
| RP-32 | The line keeps Study's way in at its right end | 4, 9 | The line at 1440 with the preview | built (246ab483): from 1100px with the preview, Notebook and “Study John 3” end the line; a tablet has neither (Q53); Study's own side with Phase 9 |
| RP-33 | That way in labeled “Open in Study Desk” | 4 | None; see ST-15 | superseded → ST-15 |
| RP-34 | Read View retires at launch (E8), and its pill goes with it | 4 | Covered by WB-44 | open |
| RP-35 | The phone's bars are proposal 15's (one row at the top, a bar at the thumb, both hiding on a scroll down), replacing today's one row (audit F3) | 3 | Covered by PH-01 to PH-06 | built (782271a5), by PH-01 to PH-06 |
| RP-36 | One switch, “Justify,” in the Display tray, directly under Line spacing | 4 | The tray at 1440 | open |
| RP-37 | Justify brings hyphenation with it, as E106 does | 4 | `hyphens: auto` with Justify on, seen in headless Chrome (the Browser pane draws no hyphens) | open |
| RP-38 | E106's exceptions stay: poetry, OpenDyslexic and Atkinson, and a column under 22em are never justified | 4 | Kept: `test/desk-reading-justify.test.js` rewritten for the switch | open |
| RP-39 | Justify is off by default | 4 | A fresh profile: text is left-aligned | open |
| RP-40 | Justify reaches Study's LIT panes too, like the face and the size; it replaces E106 there and is typography, not one of the marks each pane keeps | 9 | Turn it on; a LIT tab in Study follows | open |
| RP-41 | /desk's Reading layout (E8) goes (“Retire it”) | 9 | Grep: no Reading layout code or label | open |
| RP-42 | The Layout window loses its “Reading” row | 9 | Covered by SD-60 | open |
| RP-43 | Reading's own rules go: the mark that tells it from One pane (E107), turning the marks off and restoring only those, the undo bar naming them, and the `&layout=reading` arrival (E114) | 9 | Grep: no `layout=reading` handling; an old link opens Study at its passage | open |
| RP-44 | E106's justification of Reading alone becomes the Justify switch everywhere | 4, 9 | Covered by RP-36 and RP-40 | open |
| RP-45 | The links that stood for Read View (the search's second jump and the picker's footer, E114) open Study at the passage like every other link into it, keeping the reader's own layout | 6, 9 | `test/desk-e114-reading-links-search.test.js` and `-tray` rewritten | Search's built (f1a6b2af): “Study John 3:16” opens `/desk/?place=john-3:16` with no `&layout=reading` (both E114 tests rewritten); ReadMenu's footer leaves with Read View (Q70) |
| RP-46 | The search's second row reads “Open in Study Desk” | 6 | None; see ST-15 | superseded → ST-15 |
| RP-47 | The new picker has no “Read the whole book” row | 4 | Covered by FP-11 | built (246ab483), by FP-11 |
| RP-48 | Proposal 14's switch on the reading page (Chapter \| Whole book) is not taken; every chapter reads on into the next | 4 | No such switch on any page | open |

## Beside scripture (BS)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| BS-01 | The verse menu: four actions across the top, icon and word: Highlight, Note, Bookmark, Copy | 5 | A verse's menu at 1440 with the preview | open |
| BS-02 | Each does its usual thing in one press, then shows its choices beneath it | 5 | Press each; its choices show | open |
| BS-03 | Highlight highlights in the last color used, then shows the four colors and Remove | 5 | Highlight two verses; the second takes the last color | open |
| BS-04 | Bookmark adds one to a verse that has none; on a verse that has one, it shows today's “Bookmark ▸” choices: Remove, Edit, Add another that moves or stays put, and Leave it here | 5 | Kept choices: `test/bookmark-follow.test.js` and `test/desk-bookmarks.test.js` green | open |
| BS-05 | Copy copies the text, then offers Copy link and Copy with footnotes, so E39's three copies stay together | 5 | Press Copy; read the clipboard | open |
| BS-06 | Note opens the editor | 5 | Press Note | open |
| BS-07 | Rows below: Add to sheet…, Add to collection…, and Share… (Share text…, Share image…, and Print) | 5 | The menu at 1440 with the preview | open |
| BS-08 | Show in Notebook last, the one-press way to This verse, which stays | 5 | Press it; This verse opens at the verse | open |
| BS-09 | The selection panel matches: the same actions under the same names in both | 5 | Select words; compare with the verse menu | open |
| BS-10 | Where Study is off (phones), a sheet at the thumb with Copy text, Copy link, Share text…, Share image…, and Copy with footnotes; Share's two stand alone, with no Print | 5 | Covered by PH-16 and PH-20 | open |
| BS-11 | This replaces E39's “Copy text” split row and the Share flyout as the menu's layout, and E112's order of the Notebook's rows | 5 | `test/desk-verse-menu-order.test.js` and `test/share-image-flyout.test.js` rewritten | open |
| BS-12 | The Notebook panel's four tabs in BVJ's order: Notes, Footnotes, This verse, Greek | 5 | None; see ST-61 | superseded → ST-61 |
| BS-13 | Greek has left the panel: it is Notes, Footnotes, and This verse | 5 | Covered by ST-61 | open |
| BS-14 | Notes and Footnotes each list the chapter one kind at a time; This verse gathers every kind for one verse | 5 | Each tab on John 3 | open |
| BS-15 | The panel takes the margin's column: while it is open, the reader's notes are its Notes list rather than beside their lines; closing it brings the margin back | 5 | Open and close the panel at 1440; the text doesn't move | open |
| BS-16 | A footnote letter opens its footnote floating beside its line whatever the panel shows, over the panel; the Footnotes list doesn't scroll or change | 5 | With the Footnotes tab open, press another letter | open |
| BS-17 | The floating footnote drags aside by its header, as the verse menu and the selection panel do | 5 | Drag it by its header | open |
| BS-18 | It keeps its Pin button; pinned footnotes are listed in Notes | 5 | Pin one; Notes lists it | open |
| BS-19 | This verse stays: its words, footnotes (with Pin), and Greek; the reader's notes, highlights, and bookmark with every action (E148); notes elsewhere that cite it (N4); the collections that hold it; stepping verse by verse; the gap view (E157) | 5 | Kept: `test/desk-verse.test.js` and `test/desk-verse-gap.test.js` green | open |
| BS-20 | “N more notes” opens This verse, and opening a verse's menu moves it to that verse, as today | 5 | Kept: press “N more notes,” then open another verse's menu | open |
| BS-21 | The panel's Settings tab goes, and nothing in it is lost | 5 | Each of the next eight rows reachable | open |
| BS-22 | Settings' Show (the switches) goes to Display, merged into “Your marks,” still on the H key | 4, 5 | Covered by DI-11 | open |
| BS-23 | Where the notebook is kept goes to the panel's foot line, “Kept in this browser only. Back up…” | 5 | The panel's foot line | open |
| BS-24 | My sheets and My collections go to the header's Study menu and the footer's Study group, as today | 3 | The Study menu and the footer with the preview | built (ec3378b6) |
| BS-25 | Print… (with notes, or with room to write) goes to the panel's title menu | 5 | Open “Notebook ▾” | open |
| BS-26 | The notebook page goes to the title menu and the header's Study menu | 3, 5 | Both menus | Study ▾ built (ec3378b6); the title menu with Phase 5 |
| BS-27 | Notebook actions go to the title menu, and stay in the search tray and /search | 5, 6 | All three places | the tray's and /search's built (f1a6b2af): “Notebook actions” in the field's row; the title menu's with Phase 5 |
| BS-28 | Take the tour goes to the title menu, beside “Start here” | 5 | The title menu | open |
| BS-29 | Help and Feedback go to the title menu | 5 | The title menu | open |
| BS-30 | The panel's title is a menu, “Notebook ▾”: Print…, the whole notebook, Notebook actions, Take the tour, Help, and Feedback | 5 | Open it by keyboard and pointer | open |
| BS-31 | The title menu opens over the reader's notes rather than replacing them | 5 | The notes stay beneath the open menu | open |

## Finding a passage (FP)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| FP-01 | The place line is the picker: the “Go to passage” button, the reading row's search box, and /read's job all come into the line that says where the reader is | 4 | No “Go to passage” button left | built (246ab483) for every page but Read View, whose own “Go to passage” goes with it in Phase 4 (Q73) |
| FP-02 | Pressing the book's name in the place line, or G as now, opens one panel | 4 | Press “John” and G at 1440 | built (246ab483), seen at 1440: John and G open one panel; G with the line scrolled away opens it centered at the window's top (Q58) |
| FP-03 | A field at the top (“book, chapter, or verse”): typing wins over picking, so “rom 8” offers “Go to Romans 8” at once and Enter goes there | 4 | `test/featherboa-picker.test.js` | built (246ab483), tested |
| FP-04 | It is forgiving (“jn 3 16,” “1 cor 13,” “romans”) with the guesser the 404 page uses | 4 | `test/featherboa-picker.test.js` through `resolveMistypedPath` | built (246ab483), tested: `readTyping` reads the search box's jump first, then the 404 page's guesser |
| FP-05 | “Matthew intro” offers the introduction (E123) | 4 | `test/featherboa-picker.test.js` | built (246ab483), tested; its words queued (Q56) |
| FP-06 | When what is typed isn't a passage, the last row is “Search for ‘forgiveness’,” and Enter runs it | 4 | Type “forgiveness”; Enter lands on /search | built (246ab483), tested |
| FP-07 | Continue reading is its first row | 4 | After reading Romans 8, open the picker | built (246ab483): “Continue: Romans 8” first, to the verse recorded, and hidden on the page it names (Q59) |
| FP-08 | All 27 books in canonical order, with no groups, fitting the panel with no scrolling | 4 | The panel at 1100 by 700 shows all 27 without scrolling | built (246ab483): 27 books in order, three to a row in a panel 640px or wider; at 1100 by 700 all 27 show without scrolling (the panel 492px tall), in the text face and OpenDyslexic (Q75) |
| FP-09 | The chosen book's chapters as a grid, with its introduction under it | 4 | Choose Mark | built (246ab483): Mark's 16 chapters with “Introduction” under them, the book's name heading the grid (Q66) |
| FP-10 | Drafts as today: a book or chapter still being translated is dimmed and still opens, now with “in progress” beside it | 4 | Acts in the grid; its dimmed words still 4.5:1 | built (246ab483), with a draft state in the kit (Q49): Acts 2–28, Revelation, and three introductions dimmed, still opening, “in progress” beside them; the dimmed ink 5.11:1 by day and 5.68:1 on the night panel (measured); a whole draft's tab queued (Q54) |
| FP-11 | No “Read the whole book” row | 4 | Grep: no such label | built (246ab483): no such row (grep) |
| FP-12 | Release Notes at its foot | 4 | The picker's last row | built (246ab483): Release Notes is the picker's last row |
| FP-13 | Keys stay: G opens the picker, / opens Search, and the arrows turn the chapter | 4 | Kept: `test/desk-keyboard-chapter.test.js` green; press each | built (246ab483): G, /, ← →, and [ ] pressed on John 3; `test/desk-keyboard-chapter.test.js` green; Escape empties the field first (Q57), and G in Read View keeps its own picker (Q69) |
| FP-14 | On a phone the picker opens from the chapter's name in the top row, as a sheet rising nearly to the top | 4 | Covered by PH-10 | built (246ab483), by PH-10 |
| FP-15 | “Read” in the header opens the picker panel on a computer with JavaScript | 3, 4 | Press Read at 1440 | built (246ab483): Read hangs the panel under it from 700px |
| FP-16 | /read becomes the picker at full size, which is also where “Read” leads without JavaScript | 4 | /read at 1440, and Read with JavaScript off | built (246ab483): /read is the emblem, the title, the owner's lede unchanged, and the picker at full size, with no dialog; without JavaScript each book shows its chapters by `:target` (Q62); its frame queued (Q61) |
| FP-17 | Home has the picker too, as “Choose a passage ▾” on its first screen | 7 | Covered by FR-06 | open |
| FP-18 | The license gets its own page, “License,” under About and in the footer, with the owner's words unchanged | 4 | Diff /license's words against /read's license section on `main` | built (de0085a8): its words match /read's on `main` word for word (466) |
| FP-19 | `/read#license`, `#license-terms`, and `#sblgnt-disclaimer` forward to it, because the apps and Study link them | 4 | `test/featherboa-old-addresses.test.js` | built (de0085a8): `test/featherboa-old-addresses.test.js`, and a real load of /read#license-terms on dist lands on /license with the terms open |
| FP-20 | BDR points the apps' link at the new page in a later release; the forwarding covers installed apps meanwhile | 14 | BDR's note in the launch list at Checkpoint B | open |
| FP-21 | The repo's own links to the license move: `LICENSE`, `CONTRIBUTING.md`, `public/llms.txt`, the Terms, and About | 4 | Grep: no `/read#license` left in the repo | built (de0085a8), held by the same test; the records keep the old address as history, and it forwards |
| FP-22 | The rest of /read goes where its subject lives: Continue reading is the picker's first row | 4 | Covered by FP-07 | built (246ab483), by FP-07 |
| FP-23 | “Latest text changes” stays on Home and with Release Notes | 7 | Home's line and /release-notes | open |
| FP-24 | “Ways to read” goes to the front page | 7 | Covered by FR-13 | open |
| FP-25 | Read View's card goes with Read View | 4 | /read shows no Read View card | built (246ab483): /read has no cards; “Ways to read” waits for Home (FP-24), and the notes for Phase 7 hold it |
| FP-26 | BVJ's first answer: the rest of /read stays below the picker | 4 | None; see FP-16 | superseded → FP-16 |
| FP-27 | The reading row's search box goes | 4 | No search field in John 3's row | built (246ab483): no search field in John 3's line |
| FP-28 | “Search” (magnifier and word) joins the place line, ordered Search · ‹ › · Notebook, with Study's way in | 4 | The line at 1440 in that order | built (246ab483): John ▾ / Chapter 3 ▾, Search, ‹ ›, Notebook, “Study John 3,” at 1440 with the preview |
| FP-29 | The place line's way in to Study named “Open in Study Desk” | 4 | None; see ST-15 | superseded → ST-15 |
| FP-30 | Pressing Search, or /, opens the field in place of the line, reading “Search the LIT, or go to a passage,” with results dropping below, verses first | 4, 6 | Press / on John 3 at 1440 | built (246ab483, f1a6b2af): Search or / opens “Search the LIT, or go to a passage” in place of the line, the field at the line's height (Q67), results below with verses first |
| FP-31 | One way in per page holds (audit U6): a reading page's is the place line's Search, and every other page keeps the header's magnifier | 3, 4 | John 3 has no magnifier in the header; /about has one | built: the magnifier (ec3378b6), and the place line's Search (246ab483); John 3's header has no magnifier, and /about's opens the strip |
| FP-32 | What search finds and how its results look is “Search”'s: the same rows as /search | 6 | Covered by SE-31 | built (f1a6b2af), by SE-31 |

## Display (DI)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| DI-01 | The tray keeps what changes how the page reads; the rest moves to All settings | 4 | The tray at 1440 with the preview holds only the rows below | open |
| DI-02 | Text: Default, Atkinson, OpenDyslexic, each set in its own face; the default keeps the name “Default” | 4 | The tray's Text row | open |
| DI-03 | Size: four steps, drawn as a small A, four dots, and a large A, in place of S, M, L, and XL | 4 | The tray's Size row | open |
| DI-04 | To a screen reader the sizes are four labeled choices: Small, Medium, Large, Extra large | 4 | `read_page` on the Size row | open |
| DI-05 | Line spacing: Normal or Roomy | 4 | Kept: both choices work | open |
| DI-06 | Justify directly under Line spacing, off by default | 4 | Covered by RP-36 and RP-39 | open |
| DI-07 | Theme: Auto, Light, Dark | 4 | Kept: each choice works | open |
| DI-08 | The heading is “View,” not “Show” | 4 | The tray's heading | open |
| DI-09 | View's switches: Footnote letters, Key terms, and Your marks, after the numbers switch (DI-14) | 4 | Each switch works | open |
| DI-10 | View's first switch named “Verse numbers” | 4 | None; see DI-14 | superseded → DI-14 |
| DI-11 | “Your marks” merges My bookmarks, My highlights, Notes in the margin, and Hide my marks into one switch, and H still flips it (“Hide your marks (H)”) | 4, 5 | Old keys read or migrated (`test/desk-storage-keys.test.js`); press H | open |
| DI-12 | It is “Your,” not the proposal's “My,” as the margin's “Your note · verse 5” says | 4 | The switch's label | open |
| DI-13 | The finer mark choices (only highlights, say) are in All settings | 4 | /settings with the preview | open |
| DI-14 | “Verse numbers” became “Verse and chapter numbers,” the desk's own name for its pane's switch, since it hides the chapters' headings too | 4 | Turn it off with John 3 and 4 loaded | open |
| DI-15 | “All settings →” at the tray's foot | 4 | The tray's last row | open |
| DI-16 | “Show the Notebook” is the Notebook button itself, on the place line | 4 | No “Show the Notebook” switch in the tray | partly built (246ab483): the Notebook is a button on the line; the tray's switch stays until the Display tray is built (Q51) |
| DI-17 | The notes' lettering choice is gone with Playpen Sans | 5 | No lettering row anywhere | open |
| DI-18 | No reader loses a setting | 4 | Each `localStorage` key the tray wrote is still read or migrated; /privacy names what is written | open |
| DI-19 | All settings: one page every reader can reach from the tray, showing Study's parts only where Study is on (at /settings, BP-19) | 4 | /settings with and without the preview | open |
| DI-20 | All settings holds the keyboard-shortcuts switch, required for every reader (WCAG 2.1.4) | 4 | Turn shortcuts off; G does nothing | open |
| DI-21 | Its other parts: the finer mark choices, backup, and a link to the account pages, which it doesn't replace | 4 | /settings with the preview | open |
| DI-22 | The Notebook adds the panel's start setting and, last, Delete in bulk | 4 | Covered by NB-25 and NB-27 | open |
| DI-23 | The reader still drags the reading page's lines (the text column, the notes' margin, the Notebook's edge), each with its menu of steps and its own reset (E189) | 4, 5 | Kept: `test/desk-e189-lines.test.js` green | open |
| DI-24 | The text column drags only within 45 to 75 characters a line | 4 | Covered by SZ-17 | open |
| DI-25 | “Reset widths” leaves the tray and goes nowhere: each line's own menu is the local reset, and the widths are kept only for the visit | 4 | Grep: no “Reset widths” | open |

## A whole book (WB)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| WB-01 | Chapter View retires into one reading page by “Continuous chapters”; the proposal's switch (Chapter \| Whole book \| Focus), title page, and green numerals in the text are not built | 4 | Covered by the rows below | open |
| WB-02 | Every chapter keeps its address and opens as itself (`/luke-3`, `/luke-3#v16`) | 4 | `test/featherboa-continuous.test.js`; open `/luke-3#v16` | open |
| WB-03 | With JavaScript, the next chapter loads below as the reader nears it, and the previous one above on a scroll up, as Study's text pane does (`desk-corpus.mjs`, `desk/lit-pane.js`) | 4 | `test/featherboa-continuous.test.js`; scroll John 3 into John 4 and back | open |
| WB-04 | The place line and the address follow the chapter in view | 4 | Scroll into John 4: the line and the address say John 4 | open |
| WB-05 | Continue reading keeps following the verse at the reading line | 4 | Stop at John 4:10, leave, open the picker | open |
| WB-06 | It needs no Study, so phones and tablets read straight through too | 4 | At 390 and 820 without the preview, chapters read on | open |
| WB-07 | Without JavaScript a page is one chapter, with the way on at its foot | 4 | John 3 with JavaScript off | open |
| WB-08 | The address changes without adding to the browser's history, so Back leaves the book | 4 | `test/featherboa-continuous.test.js`: `history.length` unchanged | open |
| WB-09 | The place line's ‹ › go to the start of the previous or next chapter, loading it first if it isn't on the page, and so do ← → and [ ] | 4 | `test/featherboa-continuous.test.js`; press each | open |
| WB-10 | Previous and Next in large type appear at the book's end (“John 1 →” after Luke 24) and, without JavaScript, at each chapter's foot | 4 | The end of Luke 24; John 3 with JavaScript off | open |
| WB-11 | Not one page per book: the chapter addresses stay, for the links already out there and the apps' link files | 4 | `test/link-files.test.js` kept green; no book page built | open |
| WB-12 | Link previews and search entries stay one per chapter | 4 | Each chapter's preview tags and Pagefind entry name it | open |
| WB-13 | The whole-book browser tools (Ctrl+F, Read Aloud, page translation, printing a book) were let go on 2026-11-02 (E8) | 4 | None | n/a (record only) |
| WB-14 | Every tool on the page works across chapters: the verse menu, footnotes, key terms, and Study's marks and margin notes | 4, 5 | Use each on a second, loaded chapter | open |
| WB-15 | Between chapters, only the next chapter's heading, set close as Study's text pane sets it (“James 2” in Fraunces at about 23px, 32px below the last line, no rule) | 4 | Measure 88px from James 1's last line to James 2's first | open |
| WB-16 | The drop numeral goes on the screen | 4 | No drop numeral on any chapter at any width | open |
| WB-17 | Paper keeps the drop numeral, since a print is one chapter | 8 | Covered by OS-04 | open |
| WB-18 | The footnote list and Go deeper leave the reading flow on the screen | 4 | John 3 at 1440: neither sits between chapters | open |
| WB-19 | The list stays in the page for printing, and both stay for readers without JavaScript and for Study, which reads them from the chapter's page (`desk/chapter-page.js`) | 4, 8 | JavaScript off shows both; a print shows the list; Study still loads them | open |
| WB-20 | Where the Notebook panel runs, they are its Footnotes tab and This verse's “This chapter,” which shows the chapter's Go deeper rows | 5 | The panel with the preview | open |
| WB-21 | A margin footnote's “In the notes ↓” opens the Footnotes tab at its note where the panel runs; elsewhere, the Footnotes sheet or panel (PH-23) | 5 | Press it with and without the preview, at 1440 and 820 | open |
| WB-22 | On a phone or tablet the heading's Go deeper opens a sheet (a panel on a tablet) with “Go deeper” and “Footnotes” tabs | 5 | Covered by PH-23 and PH-25 | open |
| WB-23 | “Go deeper” sits at the right end of each chapter's heading (not the place line, not the margin) and opens the Notebook on This verse, scrolled to “This chapter” for that chapter | 4, 5 | Press it on James 2's heading | open |
| WB-24 | The Verse and chapter numbers switch hides the headings too; with it off, the chapters run on with an ordinary paragraph's gap, as one long passage | 4 | Turn it off with John 3 and 4 loaded | open |
| WB-25 | With it off, the headings stay for screen readers and come back into view when a keyboard reaches them | 4 | `read_page` lists them; Tab to one | open |
| WB-26 | Go deeper hides with its heading and stays in This verse; the place line and the progress line still say where the reader is | 4 | The same, at 1440 | open |
| WB-27 | Footnote letters start again each chapter, as today | 4 | Kept: John 4's first letter is “a” | open |
| WB-28 | The Footnotes tab lists the chapter in view | 5 | Scroll into John 4; the tab lists John 4's | open |
| WB-29 | A chapter still being translated loads as Study's text pane loads it: a run of drafts in one book is one entry, headed “Luke 23–24” (or “Acts” when the whole book is in draft), saying they are still being translated | 4 | `test/featherboa-continuous.test.js`: drafts as one entry | open |
| WB-30 | The draft entry's line about the Greek points to the Notebook's Greek tab | 4 | None; see WB-32 | superseded → WB-32 |
| WB-31 | A draft asked for by name, from the picker or its address, still opens its own page | 4 | Open `/acts-5`, and pick Acts 5 | open |
| WB-32 | The draft entry's line links to the chapter's Greek in Study, since the Read page's panel has no Greek tab | 4 | Press the line with the preview | open |
| WB-33 | The progress line is kept: a thin green line along the place line's bottom edge, in place of its border, adding no height | 4 | The line's height with and without it | open |
| WB-34 | It fills as the reader moves through the book, measured in verses, so a long chapter counts for more | 4 | Half of Luke's verses read: half full | open |
| WB-35 | Screen readers skip it, since the place line names the chapter | 4 | `read_page` shows no progress node | open |
| WB-36 | On a phone it runs along the top row's bottom edge and hides with it | 3, 4 | At 390, scroll down and up | open: Phase 4 (the phone's row is built, 782271a5; its hairline holds the line's place, Q37) |
| WB-37 | Printing stays one chapter with its notes, the chapter in view | 8 | `test/featherboa-continuous.test.js`: a print is one chapter; a PDF of John 4 reached from John 3 | open |
| WB-38 | “Read the whole book,” the switch, and the title page aren't needed, since any chapter reads on | 4 | None of the three built | open |
| WB-39 | The introduction keeps its own page (`/mark-intro`) | 7 | Kept: `/mark-intro` at its address | open |
| WB-40 | “Introduction to Mark →” at the top of chapter 1, and the picker's row under the chapter grid | 4, 7 | Mark 1 at 1440; the picker on Mark | open |
| WB-41 | The introduction ends with “Mark 1 →” into the text | 7 | The foot of `/mark-intro` | open |
| WB-42 | Focus retires: neither Read View's (every paragraph dimmed but one) nor the proposal's (the header and place line fading) | 4 | Grep: no Focus code or label | open |
| WB-43 | /privacy's line about Focus goes too | 4 | /privacy's text | open |
| WB-44 | Read View still retires as E8 planned: `/read/<book>` forwards to chapter 1, and `#ch-N` to chapter N | 4 | `test/featherboa-old-addresses.test.js`; `test/read-view-retirement.test.js` green | open |
| WB-45 | One reading page replaces the 2026-09-30 rule that Chapter View and Read View decide where a new tool goes: a tool about a verse or a word goes on the reading page | 14 | The root `CLAUDE.md`'s "Key Conventions" rewritten at Checkpoint B | open |
| WB-46 | Go deeper names its chapter by where it sits in the heading, adds no height, and works the same at every width (the margin's and the place line's placements were rejected) | 4 | A chapter heading at 1440, 820, and 390: Go deeper is in the heading row, the row is no taller with it, and nothing of it sits in the margin or the place line | open |

## The phone (PH)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| PH-01 | One row at the top: the emblem (home), the chapter's name as the picker (“John 1 ▾”), and Aa | 3 | At 390, John 1's first verse about 82px down (banner dismissed) | built (782271a5); at 320, 375, and 390, in the text face and OpenDyslexic, the first line 65px down and its verse number 70px; the row's measures queued (Q37), the picker until Phase 4 (Q35) |
| PH-02 | The name “LIT Bible” leaves the reading page's top row; the emblem is the way home | 3 | John 1 at 390 | built (782271a5) |
| PH-03 | A bar at the bottom: Previous · Search · Menu · Next, four 44px targets with a word under each | 3 | The targets measured at 390 | built (782271a5); 44px measured at 320, 360, and 390 in all three faces; its drawing queued (Q38), OpenDyslexic under 360px (Q39) |
| PH-04 | “Previous,” not the proposal's “Back,” which reads as the browser's Back | 3 | The bar's first label | built (782271a5) |
| PH-05 | Both bars hide together on a scroll down and return on any scroll up, one rule, at “Motion”'s timing | 3 | At 390, scroll down and up (this file's Phase 3 notes) | built (782271a5), with an 8px give (Q36) and `scroll-padding` for a link's target (Q40); the feel on a real phone for BVJ |
| PH-06 | This replaces today's one-row toolbar on a phone (audit F3), the round ‹ › beside the title there, and the title row itself | 3 | None of the three at 390 | built (782271a5): none of the three from 320 to 699px, all back at 700; Read View on a phone until Phase 4 queued (Q48) |
| PH-07 | The app banner stays above the row | 3 | Kept: the banner at 390 with an Android user agent | built (782271a5, kept): the banner on top at 360 and 412 with an Android user agent, the row sticking at 0 once it scrolls away |
| PH-08 | The progress line runs along the top row's bottom edge, as on a computer, and hides with it | 3, 4 | Covered by WB-36 | open: Phase 4, with WB-36 (the row's hairline holds its place, Q37) |
| PH-09 | Search opens the field in place of the top row, results below and verses first | 3, 6 | Press Search at 390 | built (782271a5, f1a6b2af): at 390 the bar's Search opens the field in place of the top row, and “light” lists John 12:36 first; the page stays 390 wide |
| PH-10 | “John 1 ▾” opens the picker as a sheet rising nearly to the top: the typing field first, then Continue reading, the 27 books, the chapter grid, and the introduction | 4 | At 390 | built (246ab483): at 390, “John 3 ▾” raises the sheet nearly to the top at the Large speed, focus on 3 (Q52), and Escape gives focus back to the row |
| PH-11 | The menu is a sheet rising from the bar, not today's panel from the top corner | 3 | Press Menu at 390 | built (782271a5): 526px tall at 390 by 844, the page dimmed (Q46), focus on its × (Q43), Escape back to Menu; one sheet at every width (Q42) |
| PH-12 | Its rows are Read, Learn, and About, each with its own, the current place marked; Study stays off a phone | 3 | At 390 with and without `?desk=on` | built (782271a5), no Study at 390 with or without `?desk=on`; its groups and marks queued (Q44) |
| PH-13 | Then “Get the app” | 3 | The menu's last row | built (782271a5); the sheet's foot queued (Q45) |
| PH-14 | Today's “Continue” button leaves the menu, since Continue reading is the picker's first row | 3 | No Continue in the menu | built (782271a5); Continue reading comes with Phase 4's picker |
| PH-15 | A page without the bar keeps the header's menu button, which opens the same sheet from the bottom | 3 | /about at 390 | built (782271a5), on /glossary and an article at 390; the header's Menu queued (Q47) |
| PH-16 | The verse sheet holds five actions: Copy text, Copy link, Share text…, and Share image… across, with icons, then Copy with footnotes | 5 | Press a verse number at 390 | open |
| PH-17 | The names are the computer's, one name per action everywhere (E39, E111), not the proposal's Copy, Link, Share, and Image | 5 | The labels match the computer's menu | open |
| PH-18 | In OpenDyslexic a label may take two lines | 5 | The sheet at 390 in OpenDyslexic | open |
| PH-19 | The selection panel matches, as today | 5 | Select words at 390 | open |
| PH-20 | Share, revisited: on a phone Share text… and Share image… stand on their own, with no “Share…” group and no Print; the computer keeps Share… with Share text…, Share image…, and Print | 5 | At 390 and at 1440 | open |
| PH-21 | A footnote opens as a sheet, as tall as its note needs up to about half the screen; it drags up to full height and scrolls inside, and its word stays marked | 5 | The longest footnote at 390 | open |
| PH-22 | No “Read the whole note →” | 5 | Grep: no such label | open |
| PH-23 | The chapter heading's “Go deeper” opens a sheet for that chapter with two tabs: “Go deeper” (Listen, Read, Key terms, and Book) and “Footnotes” (the chapter's whole list, each note whole) | 5 | John 3 at 390 | open |
| PH-24 | A footnote's sheet links to that list | 5 | At 390 | open |
| PH-25 | Tablets get the same, drawn as the panel over the right edge | 5 | At 820 | open |
| PH-26 | Without JavaScript the bar is plain links and doesn't hide: Previous and Next go to the chapters, Search to /search, Menu to the footer's links, and “John 1 ▾” to /read | 3 | At 390 with JavaScript off | built (782271a5), checked at 390 with JavaScript off |

## Search (SE)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| SE-01 | Site 2.0's /search (“Yes to two panes,” in its quieter redraw) is not taken | 0, 6 | /search has no two-pane layout | built (63d07ac0, f1a6b2af): /search is one column, with no two panes |
| SE-02 | The field is the page, with the count at its right end (“75 results”) | 6 | /search for “light” at 1440 | built (f1a6b2af): the field is the page, its count at its right end (seen for “light” at 1440; `resultsCount` tested) |
| SE-03 | The visible title and the instruction go; a “Search” heading stays for screen readers | 6 | `read_page` finds the heading; nothing visible above the field | built (f1a6b2af): an sr-only “Search” heading, nothing visible above the field |
| SE-04 | One row of tabs does the filtering: Scripture, Chapters about it, Glossary, Articles, Introductions, and with Study on, the notebook's tab (BP-03) and Greek | 6 | /search at 1440, with and without the preview | built (f1a6b2af): Scripture, Chapters about it, Glossary, Articles, Introductions, and with the preview Notebook and Greek (`visibleTabs`, tested; seen at 1440 both ways); the tabs wrap, and the menus take a line of their own (Q76) |
| SE-05 | The notebook's tab named “My Notebook” | 6 | None; overridden by BP-03 | superseded → BP-03 |
| SE-06 | The tabs replace the type filter, its help button, and the list of result groups | 6 | None of the three left | built (f1a6b2af): no type menu, help button, or list of groups; the hidden `#searchbar-mode` select holds the tab |
| SE-07 | Every tab shows its count; a tab with none reads 0 and is dimmed (still 4.5:1, KT-08) | 6 | Search a word with no glossary entry | built (f1a6b2af, d30c03c5): each tab's count; a tab with none takes the kit's `.kit-tab--none` (the draft state's third ink), still opens, and is named “no results” (tested); a Greek search gives the English tabs no number (Q77) |
| SE-08 | The page opens on Scripture, or on the first tab with results when Scripture has none | 6 | Search “light,” then a word found only in an article | built (f1a6b2af): `openingTab` (tested), Scripture or the first tab with results |
| SE-09 | “All books ▾” and the sort sit at the row's right end | 6 | /search at 1440 | built (f1a6b2af): “All books ▾” and the sort at the right end, on a line of their own under the tabs at 1440 with the preview or without, since the five tabs take 618 of the column's 647px (Q76) |
| SE-10 | Relevance stays the default (exact forms above related ones) | 6 | Kept: `test/search-core.test.js` green; “liberation” lists its own verses first | built (f1a6b2af): Relevance the default; `search-core.js` and `test/search-core.test.js` unchanged and green |
| SE-11 | The sort's other choice is “Bible order,” today's “Book order” | 6 | The sort menu | built (f1a6b2af): Relevance and Bible order |
| SE-12 | Book headings appear only in Bible order; under Relevance each verse stands with its reference | 6 | Switch the sort | built (f1a6b2af): book headings only in Bible order (`verseRowsHtml`, tested, and seen) |
| SE-13 | Results are reading: each match is the verse in the book face with its reference, the matched word bold with a green underline | 6 | A result row's computed styles | built (f1a6b2af, 563f837b): the verse in the text face with its reference, the match bold with an underline in LIT Green; the Greek tab's hits are rows too, not cards (Q83) |
| SE-14 | No sunshine on a match, since yellow means “yours” | 6 | Grep the search styles for sunshine | built (f1a6b2af): no sunshine in search.css, SearchLayout.astro, or search-rows.mjs (grep) |
| SE-15 | “Chapters about it” is today's “Topic matches,” avoiding the word “topic” | 6 | The tab's label | built (f1a6b2af, 24408884): the tab is “Chapters about it,” and the tray's status line names them the same way, never “topic” |
| SE-16 | On a phone the tabs scroll sideways in one row, with the book and sort menus on a row under them | 6 | /search at 390 | built (f1a6b2af): at 390 the tabs scroll sideways in one row with the page staying 390 wide, and the menus take the row under them |
| SE-17 | A reference goes there: “john 3:16” makes the first row “Go to John 3:16,” and Enter goes there | 6 | `test/search-page-enter.test.js` kept or rewritten | built (f1a6b2af): “john 3:16” answers “Go to John 3:16” first, and Enter goes there (`test/search-page-enter.test.js` rewritten, green) |
| SE-18 | /search carries no passage picker of its own | 6 | /search at 1440 | built (f1a6b2af): no picker of its own on /search |
| SE-19 | With Study on, the second row stays “Open in Study Desk” at the passage | 6 | None; see ST-15 | superseded → ST-15 |
| SE-20 | Over the verses, one line for the chapters: “John 1 is one of 6 chapters about light,” with “See all 6 →” opening that tab | 6 | Search “light” | built (f1a6b2af): “John 1 is one of 6 chapters about light,” and “See all 6 →” opens the tab (`chaptersLineHtml`, tested, and seen) |
| SE-21 | The glossary still answers first: when a term matches, one line above the verses, as “Trust is in the glossary →” | 6 | Search “trust” and “logos” | built (24408884): first, and only when what was typed is one of an entry's own words (its traditional word, a LIT word, or its transliteration), named as the entry writes it: “Trust is in the glossary →” (`glossaryLineTerm`, tested; Q81) |
| SE-22 | Book introductions keep a group of their own, now the “Introductions” tab, so an introduction is never mistaken for scripture | 6 | Search a word found in an intro | built (f1a6b2af): the Introductions tab |
| SE-23 | With Study on, the notebook stays in search: its tab (matches in the reader's own notes), the “Notebook actions” link in the field's row, and “>” in the field offering commands | 6 | /search with the preview; type “>” | built (f1a6b2af, 24408884): with the preview, the Notebook tab (page state, not an address: Q82), “Notebook actions” in the field's row, and “>” listing the notebook's commands where the results go, Enter running the first (`test/search-page-commands.test.js`) |
| SE-24 | The Greek tab shows only where the Greek search runs, with Study on, as today; a Greek word or a Strong's number typed there opens it | 6 | Kept: `test/search-greek-auto.test.js` green | built (f1a6b2af): kept; `test/search-greek-auto.test.js` unchanged and green |
| SE-25 | Underneath, nothing changes: the verse index, Pagefind, and the Greek search (`search-core.js`'s logic) | 6 | Kept: `test/search-core.test.js` unchanged and green | built (f1a6b2af): `search-core.js` unchanged (git diff); the verse index, Pagefind, and the Greek search as they were |
| SE-26 | The page links stay, and so do the “Showing results for ‘jerusalem’” note, related forms, and the topics a chapter matched | 6 | Kept: a misspelled search, and “liberation” | built (f1a6b2af): the page links (Q80), “Showing results for “jerusalem.”” on a misspelling, related forms for “liberation,” and the topics a chapter matched, seen |
| SE-27 | “Select” sits at the right end of the tab row, with Study on only | 6 | /search with and without the preview | built (f1a6b2af): Select ends the menus' line, with the preview only (Q76) |
| SE-28 | Select puts a box on each row of Scripture and Chapters about it, and a bar at the foot reads “3 chosen · Add to a sheet… · Cancel” | 6 | Choose three rows | built (f1a6b2af): boxes on Scripture, Chapters about it, and Greek rows (Q79) while Select is on, and the foot bar “3 chosen · Add to sheet… · Cancel” (no article, as the verse menu's Add to sheet…) |
| SE-29 | A reader who is only looking sees no boxes | 6 | /search before Select | built (f1a6b2af): no boxes before Select |
| SE-30 | One verse still goes to a sheet from its own verse menu | 5 | Kept: Add to sheet… in the verse menu | open |
| SE-31 | The results under a reading page's Search and the header's magnifier use the same rows as /search: the verse in the book face, the word bold and underlined, book headings in Bible order | 6 | A row in each of the three places | built (f1a6b2af): the tray under a reading page's Search and the header's magnifier draw /search's rows from `search-rows.mjs` (seen on John 3 and /about) |
| SE-32 | Their “See all results →” opens /search on the same tab | 6 | Press it from the Glossary tab | built (f1a6b2af): “See all results →” keeps the tab and the book (`seeAllHref`, tested) |

## The glossary and articles (GL)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| GL-01 | Articles and book introductions take the reading page's column, margin, and faces | 7 | An article and an intro at 1440 | open |
| GL-02 | Site 2.0's choices (the glossary's list in a left column, an article's picture edge to edge, an introduction's headings beside the text) are not taken | 0, 7 | None of the three on the branch | built (63d07ac0); Phase 7 draws the pages |
| GL-03 | /glossary stays one page, read on, each entry at its anchor, so every `/glossary#faith-trust` link keeps working | 7 | `test/featherboa-old-addresses.test.js`: every entry's anchor present | open |
| GL-04 | The line at the top reads “Learn / Glossary ▾ / trust,” naming the entry in view | 7 | Scroll the glossary at 1440 | open |
| GL-05 | “Glossary ▾” lists the entries, in place of today's jump list | 7 | Open it; no jump list on the page | open |
| GL-06 | ‹ › step from entry to entry | 7 | Press › on the “trust” entry | open |
| GL-07 | BVJ's opening words stay at the top | 7 | Kept: the opening diffed against `main` | open |
| GL-08 | The opening's third paragraph describes today's styling, so Claude drafts a replacement for BVJ to approve or rewrite; it stays as written until answered | 7 | BVJ's answer at Checkpoint A | queued (Q1) |
| GL-09 | Both orders stay (by the LIT word or by the traditional word), as a switch at the top of the “Glossary ▾” list; the page follows it | 7 | Kept: `test/glossary-sort.test.js` green; flip the switch | open |
| GL-10 | The copy-link button stays beside each entry's pair | 7 | Kept: press it on an entry | open |
| GL-11 | The pair is the headline: “Traditionally” and the traditional word, lighter and gray, beside “In the LIT” and the LIT's word in full weight | 7 | An entry at 1440 and 390 | open |
| GL-12 | No arrow and no strike-through; today's ink scribble through the traditional word goes | 7 | Grep the glossary's styles | open |
| GL-13 | The gray still meets 4.5:1, like every word on the site | 7 | Covered by NI-10 | open |
| GL-14 | The LIT side is as the entry has it: “trust / faithfulness” keeps its slash | 7 | The faith-trust entry | open |
| GL-15 | Each word on its own line on a phone, as today | 7 | Kept: an entry at 390 | open |
| GL-16 | A note such as “(prepared for sacred purposes)” sits under the word | 7 | That entry at 1440 | open |
| GL-17 | Where the LIT keeps the traditional word (Demon / demon), the pair still shows | 7 | That entry | open |
| GL-18 | The Greek spelling beside its transliteration (“πίστις pistis”) comes from the alignment's lemma map, `scripts/lib/glossary-lemmas.mjs` | 7 | Every entry shows its Greek, read at build time | open |
| GL-19 | No entry gains a field, and the apps' glossary feed doesn't change | 7 | The contract guard over `src/content/glossary/`; `test/build-glossary-feed.test.js` green | open |
| GL-20 | “Where it appears” moves to the margin, where footnotes sit on a chapter page | 7 | An entry at 1440 | open |
| GL-21 | It carries today's numbers: the total (“N occurrences”) and each rendering with its count, not the drawing's first three verses | 7 | The numbers compared with `main` | open |
| GL-22 | “Every place →” opens the full list under the entry, as today's folded list does, without JavaScript too | 7 | With JavaScript off | open |
| GL-23 | With no margin (a phone, a narrow window), the list sits under the entry, as today | 7 | At 820 and 390 | open |
| GL-24 | Articles and introductions: a Fraunces title, Source Sans 3 at the reading size, and the reading measure | 7 | An article at 1440: faces and measure | open |
| GL-25 | Footnotes go in the margin where a piece has them (none does today) | 7 | Nothing to check until a piece has one | open |
| GL-26 | The author and date share one small line under the title | 7 | An article at 1440 | open |
| GL-27 | Every article keeps its picture, under the title and byline at the column's width, not edge to edge | 7 | All 13 articles at 1440 | open |
| GL-28 | Tags move to the article's foot | 7 | An article's foot | open |

## Off the screen (OS)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| OS-01 | Print's faces are the screen's: Source Sans 3 for the text and Fraunces for headings | 8 | A PDF of John 1 from headless Chrome; the fonts it embeds | open |
| OS-02 | The size stays 12pt times the reader's text size, refit to Source Sans 3's letter height | 8 | PDFs at the smallest and largest sizes | open |
| OS-03 | A reader's accessibility face prints as chosen, as today | 8 | Kept: a PDF with OpenDyslexic chosen | open |
| OS-04 | Paper keeps the drop numeral: the chapter's number as a drop capital in Fraunces, beside its first lines | 8 | A PDF of John 3 | open |
| OS-05 | A running head and a footer, drawn with page-margin boxes, as the Sheets' page numbers are | 8 | A PDF's first and second pages | open |
| OS-06 | The head reads the passage (“John 1”) and “Liberation and Inclusion Translation” | 8 | The PDF's text | open |
| OS-07 | The footer carries the address (“litbible.net/john-1”) and the license's credit line (`LIT_CREDIT_LINE`, unchanged) | 8 | `test/lit-credit.test.js` green; the PDF's text | open |
| OS-08 | A browser that can't draw page margins prints neither, so the credit line and address still print once at the end, as today | 8 | Kept: the end notice in the printed HTML | open |
| OS-09 | The SBLGNT notice still prints after the text | 8 | Kept: a PDF of John 1 | open |
| OS-10 | Page numbers follow the Sheets' rule: page 1's centered at the foot, then at the top right | 8 | A PDF of three pages | open |
| OS-11 | Footnotes print after the chapter, whole, in two columns | 8 | A PDF of John 1 | open |
| OS-12 | No script that rebuilds the page into sheets before printing (Paged.js) | 8 | `package.json` has no such dependency | open |
| OS-13 | No note is cut, and no “Continues at…” | 8 | A PDF of the chapter with the longest note | open |
| OS-14 | The verse image: the verse in Source Sans 3 | 8 | `test/verse-image.test.js` rewritten; an image of John 1:5 | built (60952c32) |
| OS-15 | The image's reference stays in Fraunces, as a heading | 8 | The same image | built (60952c32); a canvas can't set Fraunces's softness and wonk, so the reference draws at the font's defaults |
| OS-16 | One small line under the verse: the emblem and “John 1:5” (Fraunces) at the left; “Liberation & Inclusion Translation” over “litbible.net/john-1” (Source Sans 3) at the right | 8 | The same image, Square and Story | built (60952c32) |
| OS-17 | The address is kept, the link back the license's social-media exception asks for | 8 | The same image | built (60952c32) |
| OS-18 | The green bar goes; the emblem is the green | 8 | The same image | built (60952c32) |
| OS-19 | Inter leaves the image | 8 | `test/featherboa-fonts.test.js` covers `verse-image.js` | built (60952c32): the fonts test's `LATER` map no longer lists it |
| OS-20 | The rest stays: Ink and Paper, Square and Story (Story the same layout, taller), the one button that asks each question in turn, the text as large as fits down to a readable floor, and nothing stored | 8 | Kept: each choice makes an image | built (60952c32): Ink and Paper take Featherboa's two colors (Q22); the readable floor kept |
| OS-21 | A sheet printed from Study uses this same page: the same head, faces, and footer | 8, 11 | PDFs of a sheet's two copies | open |
| OS-22 | Leader and participant copies differ in content, never in look | 11 | The same two PDFs | open |

## Four places: the header (HD)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| HD-01 | Read, Study, Learn, and About, the current one underlined in green (the mark's green) | 3 | The header at 1440 on a page in each place | built (ec3378b6); widths measured in three fonts: 700px, 900 in OpenDyslexic, 1100 with Study |
| HD-02 | The black “Read” button goes: Read is a place like the others | 3 | No filled button in the header | built (ec3378b6) |
| HD-03 | Read opens the passage picker, as “Finding a passage” decided | 3, 4 | Covered by FP-15 | built (246ab483), by FP-15; a link to /read without JavaScript and under 700px (Q24) |
| HD-04 | The proposal's “Read View becomes a whole-book switch” falls away, since every chapter reads on into the next | 4 | No such switch built | open |
| HD-05 | Learn, Study, and About open menus, and keep their ▾ | 3 | `test/header-menus.test.js` rewritten; each menu at 1440 | built (ec3378b6) |
| HD-06 | No address changes, so no page gathers Learn's or About's pages for the word to lead to | 3 | No /learn page; `npm run check:links` passes | built (ec3378b6) |
| HD-07 | Study's rows are the Study sidebar's places: Scripture, Notebook, Sheets, and Collections | 3, 9 | Study ▾ at 1440 with `?desk=on` | built (ec3378b6) |
| HD-08 | So the decisions that assumed a Study menu hold: “New” beside a Study feature, “Take the tour” for a first-time visitor, and sheets within reach from any page | 3 | Covered by NX-27 and NX-22 | NX-27 built (ec3378b6); NX-22 queued (Q26) |
| HD-09 | “Help for study tools” leaves the menu for the foot of Study's sidebar | 3, 9 | Study ▾ has no Help row; covered by SD-45 | queued (Q25): the row stays until Phase 9 |
| HD-10 | The name in the header is always “LIT Bible,” reversing E138 (the full name where it fits); the script that chooses between the two retires | 3 | `test/header-title.test.js` retires with the script; the header at 1440 and 1024 | built (ec3378b6) |
| HD-11 | The full name stays in every page's tab title | 3 | Kept: each page's `<title>` | built (ec3378b6, kept) |
| HD-12 | The right end always holds Aa and the account (“Sign in” until a reader signs in) | 3 | The header at 1440, signed out and in | built (ec3378b6); the entry from 700px (Q29) |
| HD-13 | The magnifier is there on every page but the Read page, whose Search is on its place line (one way in per page) | 3 | /about and John 3 at 1440 | built (ec3378b6); on a page with its own box it goes to that box (Q30) |
| HD-14 | Every page but Home has one line under the header that names the page, its one or two main commands at the right (“Learn / Glossary ▾ / trust,” “About / Contact”) | 3 | Each page at 1440; none on Home | built (ec3378b6); each page's commands with its phase |
| HD-15 | The Read page's place line is this line | 4 | Covered by RP-29 | built (246ab483), by RP-29 |
| HD-16 | A part with ▾ is a menu of what sits beside the page: “Glossary ▾” lists the entries | 3, 7 | Covered by GL-05 | open |
| HD-17 | On Study, the title row is the line: “Fold sidebar” at its left, then “Study / Sheets ▾ / Advent 2 handout,” then the pane count and Full screen at its right | 9 | Study at 1440 with a sheet open | open |
| HD-18 | “Sheets ▾” lists the reader's sheets and “Collections ▾” their collections, so a reader switches without the sidebar | 9, 11 | Fold the sidebar; switch sheets from the line | open |
| HD-19 | Scripture, Notebook, and Trash list nothing, so their line reads plainly (“Study / Notebook”) | 9 | Each place's line at 1440 | open |
| HD-20 | Study's line adds no height, since the row is there already | 9 | The title row's height against `main`'s | open |
| HD-21 | A sheet's own row (its name, “saved,” Print…, Share…, and Present) stays with its pane; alone, the sheet's name shows in both | 11 | A sheet alone and beside another at 1440 | open |
| HD-22 | A page in no menu marks no place: Privacy, the Terms of Use, the account pages, and the 404 page | 3 | Each at 1440: nothing underlined | built (ec3378b6); the pages the record doesn't place queued (Q27) |
| HD-23 | A menu's names match the pages they open; Study's: Notebook, Sheets, and Collections, without “My” | 3 | `test/featherboa-labels.test.js`; each menu's rows | built (ec3378b6) |
| HD-24 | About's rows: The LIT, Commitments, The Collective, Apps, Release Notes, Support, and Contact | 3 | None; overridden by BP-04 | superseded → BP-04 |
| HD-25 | /about stays as it is, at its address, and its row is “The LIT” (not “About the LIT” or the proposal's “The translation”) | 3 | Kept: /about's words unchanged; About ▾'s first row | built (ec3378b6, kept) |
| HD-26 | A page's own heading stays as written (“So… who am I?”, “Contact me”); the line under the header carries the matching name | 3, 7 | /about and /contact at 1440 | built (ec3378b6) |
| HD-27 | Courses joins Learn when a course opens; until then /courses is in no menu | 3 | No menu links /courses | built (ec3378b6) |
| HD-28 | Release Notes is every text change, and the What's New page everything else (site and app updates, feature releases, launches) | 7 | /release-notes and /whats-new's entries | built (1253bf85) |
| HD-29 | Release Notes sits at the foot of Read's picker as well as under About | 3, 4 | The picker's foot and About ▾ | built: About ▾ and the footer (ec3378b6), and the picker's foot (246ab483) |
| HD-30 | The What's New page has no row of its own | 3 | No menu has a What's New row | built (ec3378b6) |
| HD-31 | A menu carrying a “New” mark ends with “See what's new →” | 3 | Mark a menu with a news entry, at 1440 | built (ec3378b6), tested with entries; the list is empty |
| HD-32 | An app update marks About's Apps row | 3, 7 | An app-update entry marks Apps | built (ec3378b6), tested with an Apps entry |
| HD-33 | The footer links the What's New page | 3 | The footer at 1440 | built (1253bf85) |
| HD-34 | The launch window introduces the What's New page when it opens | 14 | Covered by NX-33 | open |
| HD-35 | On a phone the menu sheet lists Read, Learn, and About, each with its rows, the current place marked, then “Get the app”; Study stays off it | 3 | Covered by PH-12 and PH-13 | built (782271a5), by PH-12 and PH-13 |
| HD-36 | The footer takes the same four groups and names, plus Privacy, the Terms of Use, and the newsletter | 3 | The footer at 1440 and 390 | built (ec3378b6); seen at 1440, 820, and 390 (Q33) |

## The front page (FR)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| FR-01 | A fourth direction built from today's decisions, in place of “Three front doors”' A, B, and C: A's words in B's layout | 7 | Covered by the rows below | open |
| FR-02 | The first screen opens with BVJ's claim and question (“The Bible is a library of sacred literature from oppressed & marginalized communities. So why do we translate it to justify more trauma, authoritarianism, and exclusion?”) in large, light Fraunces | 7 | Home at 1440 and 390 | open |
| FR-03 | Under it the full name (“Introducing the Liberation & Inclusion Translation of the Christian Scriptures”), since the header always says “LIT Bible” | 7 | Home at 1440 | open |
| FR-04 | After that, “A Bible that's FOR everyone” (BVJ's addition, in BVJ's capitals) | 7 | The words and capitals as written | open |
| FR-05 | “Read John 1,” the page's one filled button | 7 | One filled button on Home | open |
| FR-06 | “Choose a passage ▾” opens the picker | 7 | Press it at 1440 and 390 | open |
| FR-07 | “Continue: Romans 8” for a returning reader | 7 | Read Romans 8, then open Home | open |
| FR-08 | A quiet “Latest change” line under the buttons, as today | 7 | Kept: the line links the latest release note | open |
| FR-09 | Beside them, John 1:1–5 drawn by the Read page itself, with the “Conversation” note in the margin | 7 | Home at 1440: the passage comes from the Read page's own code | open |
| FR-10 | The letter, whole (“Hi there. I'm Brandon.”), as today, ending “One Greek word at a time,” which leads into the pairs | 7 | Kept: the letter's words diffed against `main` | open |
| FR-11 | “One Greek word at a time”: three pairs, faith, salvation, and righteousness, each drawn as the glossary draws an entry's head, worded as its entry (`faith-trust`, `salvation-liberation`, `righteousness-justness`), and opening it | 7 | Each pair's words match its entry, and each opens it | open |
| FR-12 | B's first pair, Word → Conversation, isn't taken: it has no entry, and John 1 shows it on the first screen | 7 | Three pairs only | open |
| FR-13 | Three panels in /apps' colors: the apps (cobalt) and the podcast (red), the “Ways to read” /read hands to the front page, and, on a computer, Study (forest), offering “Take the tour” to a first-time visitor | 7 | Home at 1440 with and without the preview, and at 390 | open |
| FR-14 | The questions as a list, their pictures gone: four of today's six (the values, who is translating, who keeps it going, and the work shown) | 7 | Home's questions | open |
| FR-15 | No green band, save a launch's, under the first screen for its set time | 7, 14 | Home with and without the launch's band | open |
| FR-16 | Left out: the conversation, and the Luke 3:4–6 after it | 7 | Neither on Home | open |
| FR-17 | Left out: C's book list, since “Choose a passage” opens the same picker and /read is the picker at full size | 7 | No book list on Home | open |
| FR-18 | Left out: “This Sunday,” until the site has the lectionary data the apps already have | 7 | None on Home | open |
| FR-19 | Left out: B's /apps headline, and A's green band holding the name | 7 | Neither on Home | open |

## The Study Desk (SD)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| SD-01 | The Notebook, Sheets, Collections, and the Study Desk become one workspace: the site's header, a sidebar of the reader's things, and scripture beside the work, in panes of tabs | 9 | Covered by the rows below | open |
| SD-02 | “Study and its places” changes this section: the page is “Study,” the Notebook, sheets, collections, and the Trash open as places, and what follows holds for Scripture's panes | 9 | Read with ST-20 | open |
| SD-03 | The workspace keeps the name “Study Desk,” settling what “Controls” left open, and its ways in keep “Open in Study Desk” | 9 | None; see ST-02 and ST-15 | superseded → ST-02 |
| SD-04 | The site's ordinary header replaces the desk's own, reversing BVJ's 2026-10-21 decision; one header everywhere marks where the reader is | 9 | Study at 1440 shows the site's header; `SiteHeader`'s `deskTitle` gone | open |
| SD-05 | The title row starts with “Fold sidebar” (icon and word) | 9 | Study at 1440 | open |
| SD-06 | The title row's heading, “Study Desk” | 9 | None; see HD-17 | superseded → HD-17 |
| SD-07 | At the title row's right, “Panes 1 2 3” and “Full screen” (the browser's own, E43) | 9 | Press Full screen; Esc leaves it | open |
| SD-08 | The command row and the title menu go (E68's row, and “Study Desk ▾”), each command to a home | 9 | `command-row.js` and `title-menu.js` gone | open |
| SD-09 | Add pane and Layout… become the pane count | 9 | Covered by SD-15 | open |
| SD-10 | New sheet… and New collection… go to “New…” in the sidebar | 9 | Press New… at 1440 | open |
| SD-11 | Print… goes on what it prints (drawn first as a sheet's Share… and the Notes tab's More menu; now SH-24 and ST-70) | 10, 11 | Print a sheet and the Notebook's list | open |
| SD-12 | Display options is the header's Aa, as on every page | 9 | Aa on Study at 1440 | open |
| SD-13 | My Notebook is the sidebar's Notebook | 9 | The sidebar's Notebook row | open |
| SD-14 | Help, the tour, and feedback go to the sidebar's foot | 9 | Covered by SD-45 | open |
| SD-15 | One, two, or three panes, chosen with “Panes 1 2 3” on the title row, always in view and in words (E68's reason) | 9 | Press each count at 1440 | open |
| SD-16 | A pane is at least 280px wide | 9 | Narrow the window: no pane under 280px | open |
| SD-17 | A count the window can't hold is dimmed, its reason (“Needs a wider window”) reachable without a pointer | 9 | Narrow the window until “3” dims; Tab to it | open |
| SD-18 | Every pane is one row of tabs, and a tab is one thing: the LIT at a place (“Luke 3”), Greek, Footnotes, This verse, Notes, or Search | 9 | Open each kind | open |
| SD-19 | A sheet or a collection (by its name) as a tab in any pane | 9 | None; see ST-23 | superseded → ST-23 |
| SD-20 | Any kind can be in any pane, any number of times: two LIT tabs compare passages, and two searches keep two questions open | 9 | Open two LIT tabs and two Search tabs | open |
| SD-21 | Two sheets in panes, so a reader can copy from one to the other | 11 | None; see ST-67 | superseded → ST-67 |
| SD-22 | The row is the pane's only bar: the tabs, then at its right end the open tab's one or two key actions (the LIT's ‹ ›; in a list, the commands for what is chosen; a sheet's, SH-24), then More (⋯) | 9 | Each kind's row at 1440 | open |
| SD-23 | Tabs are plain words; the open tab in each pane is underlined in ink | 9 | Two panes at 1440 | open |
| SD-24 | In the pane the reader is working in, the underline is green, and it also shows where something new will open | 9 | Click into each pane, then open a verse's Greek | open |
| SD-25 | × shows on hover or focus only | 9 | Hover a tab, and Tab to one | open |
| SD-26 | Everything else a tab can do is in More: “Open in this pane ▸,” “Move this tab to” Left, Middle, or Right, “Pin to this passage” on a tab that follows, and Close | 9 | Open More on a following tab | open |
| SD-27 | Tabs that don't fit fold into “2 more ▾,” and the open tab always shows | 9 | Open eight tabs in a 280px pane | open |
| SD-28 | What a pane can show is one grouped list: Scripture (The LIT, Greek, Footnotes, This verse), Yours (Notes, Sheets, Collections), and Search | 9 | None; see ST-65 | superseded → ST-65 |
| SD-29 | More's “Open in this pane ▸” holds the list, and an empty pane shows it whole | 9 | An empty pane at 1440 | open |
| SD-30 | Nothing is ever replaced, so nothing needs an undo: opening something brings its tab forward if it is open in any pane, else adds a tab to the pane marked green | 9 | Open the same chapter twice | open |
| SD-31 | To choose the pane, drag the item from the sidebar onto it | 9 | None; see ST-68 | superseded → ST-68 |
| SD-32 | Tabs move between panes by dragging, or with “Move this tab to,” which is how panes switch places | 9 | Drag a tab; then move one from the keyboard | open |
| SD-33 | Changing the count keeps everything: going down a pane moves its tabs into the last pane still open, and a new pane opens empty, showing the list | 9 | Three panes to two and back | open |
| SD-34 | Following stays: Notes (on “This chapter”), This verse, Footnotes, and Greek follow the LIT tab the reader last moved in, unless pinned | 9 | Kept: move in a LIT tab, each follows; pin one | open |
| SD-35 | Widths still drag: each line between panes has its menu of steps and its own reset, as on the reading page (E189) | 9 | Kept: `test/desk-e189-lines.test.js` green | open |
| SD-36 | Each pane count remembers its own widths, so three panes to two and back returns the three-pane sizes | 9 | Drag, change the count, and return | open |
| SD-37 | A new reader starts with two panes: the LIT, and beside it Notes, Footnotes, This verse, and Greek, the reading page's own panel | 9 | A fresh profile at 1440 | open |
| SD-38 | After that, the page reopens as the reader left it | 9 | Reload | open |
| SD-39 | The LIT tab is the reading page's text: chapters read on, footnotes float in the margin, and Display reaches it | 9 | Scroll a LIT tab past a chapter's end; change the text size | open |
| SD-40 | Search is a tab: the header's magnifier, or “/”, brings it forward or opens one in the pane marked green | 9 | Press “/” on Study | open |
| SD-41 | The sidebar has no field of its own, so the page keeps one way in (audit U6) | 9 | No field in the sidebar | open |
| SD-42 | The Search tab shows /search's tabs and rows | 6, 9 | Covered by SE-31 | open: Study's Search tab keeps its own rows until Phase 9 (Q78) |
| SD-43 | A Sheets or Collections tab opens the last one the reader had there, or the list, and its name is a menu (another sheet, a new one, or all of them) | 11 | None; see ST-66 | superseded → ST-66 |
| SD-44 | The sidebar, top to bottom: Notebook (its count, and a dot while there is news), Sheets (its count, the three most recent, and All sheets), Collections (the same), and Trash, with Scripture added first (ST-17) | 9 | The sidebar at 1440 | open |
| SD-45 | At the sidebar's foot: “New…,” Help with “Start here” (the tour) and Feedback, the stage badge, and the line “Kept in this browser only. Back up….” | 9 | The foot at 1440 | open |
| SD-46 | The sidebar folds to a strip of icons, each with its word, and the page remembers whether it is folded | 9 | Fold and reload; at 1163, three panes are about 300px each open and 360 folded | open |
| SD-47 | Each of /notebook's tools goes where its subject lives, not to the account page | 10 | Covered by the table's rows below | open |
| SD-48 | One kind, “Notes,” with “This chapter / Everything” at its top, serves the passage and the whole list | 10 | None; see ST-69 | superseded → ST-69 |
| SD-49 | The list and its filters (words, kind, color, label) become Notes on “Everything,” opened by the sidebar's Notebook | 10 | None; see ST-70 | superseded → ST-70 |
| SD-50 | Labels (make, rename, delete) become “Manage labels…” beside the filters | 10 | Make, rename, and delete a label | open |
| SD-51 | Deleting becomes choosing rows, then Delete…, for what is chosen | 10 | Choose three rows, then Delete… | open |
| SD-52 | The bulk deletes reached by choosing rows (the table's first answer) | 4 | None; see NB-27 | superseded → NB-27 |
| SD-53 | Back up, and Merge a backup, become the sidebar foot's “Back up…,” one window holding both | 9, 10 | Press Back up…; merge a backup file | open |
| SD-54 | The Trash (30 days) in the sidebar, opening as a tab | 9 | None; see ST-30 | superseded → ST-30 |
| SD-55 | What's new for you moves to the top of the list, with the dot on Notebook, renamed “Changed since you marked it” | 10 | Covered by NB-16 and ST-70 | open |
| SD-56 | The Notebook panel's start setting goes to All settings | 4 | Covered by NB-25 | open |
| SD-57 | Print… on the Notes tab's More menu | 10 | None; see ST-70 | superseded → ST-70 |
| SD-58 | 8 of the 11 arrangements go: the seven with rows, and four panes | 9 | `test/desk-layout.test.js` rewritten | open |
| SD-59 | The fourth pane goes, reversing BVJ's 2026-10-18 arrangements and the four-pane limit (`MAX_PANES`) | 9 | `MAX_PANES` is 3 | open |
| SD-60 | The Layout window, and Add pane with its four directions, go; the pane count replaces both | 9 | Grep: no Layout window or Add pane | open |
| SD-61 | Dragging a pane onto another's edge to split it goes; dropping a tab on a pane moves it there | 9 | Drop a tab on a pane's edge | open |
| SD-62 | “My default” goes; the page reopens as the reader left it | 9 | Grep: no “My default” | open |
| SD-63 | No saved data needs moving (the preview has one user); a saved layout with rows reopens as panes | 9 | Load a saved layout with rows | open |
| SD-64 | Every address and link (/notebook, /sheets, /collections, a sheet's `?id=`, present mode, and shared sheets' links) opens the workspace on what it names; /desk is the exception (ST-12) | 9 | Kept: open each with the preview | open |
| SD-65 | Tablets and phones are proposal 26's (“Small screens”): the website's study tools are for computers | 13 | Covered by SM-01 | open |
| SD-66 | When it is built is decided with the beta's launch date, so beta readers learn the desk only once | 14 | None; settled by BP-01 | superseded → BP-01 |
| SD-67 | More (⋯) is one of the five icons that may stand alone ("Controls"), so a pane's row carries it as an icon with no word | 9 | More on a tab at 1440 is an icon alone; no other pane control is | open |
| SD-68 | The site's ordinary header replaces the desk's own at no cost in height: today a header plus the command row, now a header plus the title row | 9 | Study's header and title row at 1440 measured against `main`'s header and command row: no taller | open |

## The Notebook (NB)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| NB-01 | The Notebook is only the reader's notes, in Bible order, each opening its passage beside it | 10 | Covered by the rows below | open |
| NB-02 | The Notebook is the Notes tab on “Everything” | 10 | None; see ST-74 | superseded → ST-74 |
| NB-03 | Kinds, colors, and labels stay a filter row (Kind ▾, Color ▾, Label ▾), each choice with its count (“Notes 41”) | 10 | The Notebook at 1440 | open |
| NB-04 | The filters are not sidebar rows, as drawn | 10 | The sidebar has no filter rows | open |
| NB-05 | No “Search your notebook” field: the list filters by words, and the header's magnifier opens Search | 10 | Filter by a word; press the magnifier | open |
| NB-06 | “128 kept, in Bible order” heads the list, and Bible order stays the only order, as today | 10 | The count matches the rows | open |
| NB-07 | A row carries only the reader's words, with a small line under them: the kind, the date, and a bookmark's label chips | 10 | A note, a highlight, and a labeled bookmark | open |
| NB-08 | Clicking a row chooses it, in place of each row's Edit, Labels…, Collections…, and Delete; Ctrl- or Shift-click adds more, and Space does the same from the keyboard | 10 | Choose rows by mouse and by keyboard | open |
| NB-09 | While anything is chosen, four commands sit at the end of the pane's row: Edit, Label…, Add to collection…, and Delete… | 10 | Choose one row, then two | open |
| NB-10 | Edit acts on one row, and Label… only on bookmarks; a command that can't act is dimmed with its reason | 10 | Choose two notes: Edit and Label… dimmed, with reasons | open |
| NB-11 | The sheets' and collections' lists work the same way | 11 | All sheets, and a collection's list | open |
| NB-12 | This replaces the “Select” button drawn for “The Study Desk” | 10 | No Select button in Study | open |
| NB-13 | Choosing a note takes the LIT tab the reader last read in to its verse, with the note in the margin; it is not a pane inside the list | 10 | Choose a note on Luke 3:8 | open |
| NB-14 | If that LIT tab shares the list's pane, the passage opens in the pane beside instead; with one pane, the LIT tab comes forward | 10 | None; see ST-75 | superseded → ST-75 |
| NB-15 | The drawing's toggle button isn't needed | 10 | No toggle in the Notebook | open |
| NB-16 | What's new for you is renamed “Changed since you marked it,” the filter the notice at the top of the list opens; the dot stays on Notebook in the sidebar | 10 | `test/desk-whats-new.test.js` rewritten | open |
| NB-17 | A changed row says “Text changed Nov 1,” as a link to that release note, so its green is a link's | 10 | A row on a changed verse | open |
| NB-18 | “Notebook” is the place; “Notes,” “Highlights,” and “Bookmarks” are what it holds, and “kept” counts them together (“128 kept”) | 10 | `test/featherboa-labels.test.js` | open |
| NB-19 | “Marks” stops naming the things kept: “Delete all notes and marks” becomes “Delete all notes, highlights, and bookmarks” | 4, 10 | Grep labels: “marks” only in “Your marks” | open |
| NB-20 | The tab is still “Notes,” holding all three kinds as it does on the reading page | 5, 9 | The panel's tab and Study's | open |
| NB-21 | The Display tray's “Your marks” stays, since it names what is drawn on the text | 4 | Covered by DI-11 | open |
| NB-22 | Labels stay on bookmarks (E149), so the drawing's labels on notes aren't taken: Label… acts on bookmarks, the Label filter counts bookmarks, and renaming and deleting stay in “Manage labels…” | 10 | Kept: `test/desk-labels.test.js` green | open |
| NB-23 | The format and the apps' sync are untouched | 10 | No change to `STUDY-DESK-FORMAT.md` or the sync code | open |
| NB-24 | The drawing's Settings is All settings, not a new sidebar row | 4, 9 | No Settings row in the sidebar | open |
| NB-25 | The Notebook panel's start setting (“When a page opens, the Notebook panel is” Open, Minimized, or As I left it) goes to All settings | 4 | Set each, then open a chapter | open |
| NB-26 | The bulk deletes choosing rows can't reach (labels, the reader's own templates, and “Empty the trash now”) go to All settings | 4 | Covered by NB-27 | open |
| NB-27 | Delete in bulk is All settings' last section, in red words, with today's four choices: all notes, highlights, and bookmarks (with pinned footnotes and labels), all sheets (with templates), all collections, and Empty the trash now | 4 | /settings with the preview: the four choices, in red | open |
| NB-28 | Choosing rows still deletes whatever is chosen | 10 | Covered by SD-51 | open |
| NB-29 | All settings is reached from the Aa tray, as on every page | 4 | Covered by DI-15 | open |
| NB-30 | Every /notebook link keeps working, its anchors too: `#backup` opens Back up, `#whats-new` “Changed since you marked it,” `#q=` the list filtered by its words, `#labels` Manage labels…, and any other the list | 10 | `test/featherboa-old-addresses.test.js`; open each | open |
| NB-31 | Printing the list, drawn first from the Notes tab's More menu (now the Notebook place, ST-70) | 10 | Kept: print the Notebook's list | open |
| NB-32 | Continue reading, already the picker's first row and Home's | 4, 7 | Kept: covered by NX-12 | the picker's row built (246ab483); Home's with Phase 7 |
| NB-33 | The Trash's 30 days, in the sidebar | 9 | Kept: an item older than 30 days is gone from the Trash | open |
| NB-34 | The foot line says “browser,” not the drawing's “computer,” since a notebook is kept in one browser | 5, 9 | Grep labels: no “this computer” | open |

## Sheets (SH)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| SH-01 | The editor is the page: a sheet is edited as it prints, at the paper's proportions (Letter or A4), its parts set as they print rather than as cards | 11 | A sheet alone at 1920, in Letter and in A4 | open |
| SH-02 | The page sits on a tinted desk, the one exception to “Surfaces” | 11 | Covered by SU-09 | open |
| SH-03 | The page stays white paper in either theme, as today | 11 | Kept: a sheet in Night | open |
| SH-04 | Where the pane holds the paper's width, the page shows as pages, broken where print will break it (today's print layout, BVJ 2026-11-10) | 11 | A three-page sheet: the breaks match its PDF | open |
| SH-05 | In a narrower pane the page fits the pane with its words at their true size and no page breaks drawn, rather than shrinking the type | 11 | With ST-57: a sheet beside a pane at 1163 | open |
| SH-06 | Edit and Preview (E209) retire: the page being edited is the preview | 11 | No Edit or Preview switch | open |
| SH-07 | The drawing's two view icons aren't taken, since the copy tabs already choose what is shown | 11 | No view icons on the sheet's row | open |
| SH-08 | A chosen part has a green bar at its left and its own controls in a small line at its top (Leader only, minutes, Move, Remove, a passage's blanks and footnotes); none of it prints | 11 | Choose a part, then print | open |
| SH-09 | A leader-only part has a dashed rule and a plain label, and is gone from the participant's copy | 11 | Both copies of a sheet with one | open |
| SH-10 | A small bar holds Bold, Italic, Link, Paragraph ▾ (Paragraph, Heading, Subheading, Quotation), and List ▾ (bulleted and numbered lists, with indent and outdent) | 11 | The bar on a text part | open |
| SH-11 | “More formatting ▾” holds the rest: Underline, Strikethrough, Superscript, Subscript, Alignment, Style (font, size, text color, background), Horizontal line, and Clear formatting | 11 | Open the menu | open |
| SH-12 | BVJ's set (2026-10-18) stays whole, only quieter at first; the proposal's site-set font, size, color, and alignment aren't taken | 11 | Kept: `test/handout-rich.test.js` green | open |
| SH-13 | The bar shows whenever a part has the cursor, not only over a selection | 11 | Click into a part without selecting | open |
| SH-14 | Tab from the text reaches the bar, and it never covers the words being chosen | 11 | Tab from a part's text; select its first line | open |
| SH-15 | The bar replaces today's toolbar under the part (SH5-6) | 11 | No toolbar under a part | open |
| SH-16 | Style's fonts are Source Sans 3 (the default), Literata, Fraunces, and Atkinson Next; Literata is the serif BVJ kept for a sheet's words, the site's reading face staying sans | 11 | Style's font menu; Literata loads only on a sheet | open |
| SH-17 | “Sans” (Inter) and “Handwriting” (Playpen Sans) leave the format's set | 11 | Style's menu lists neither | open |
| SH-18 | A stored one, which only the preview's sheets can hold, shows in the default face | 11 | A sheet with stored “Sans” text | open |
| SH-19 | A stored “Serif” is drawn in Literata | 11 | A sheet with stored “Serif” text | open |
| SH-20 | This changes the set in `STUDY-DESK-FORMAT.md` (“can grow later … but never shrink”) when it is built | 11 | `STUDY-DESK-FORMAT.md` changed in the same commit, with a note for BDR | open |
| SH-21 | “Leader's copy” and “Participant's copy,” everywhere on screen: the copy tabs, the page's title, Copy's status, a saved file's properties, and the Share dialog's choice (undoing half of E95) | 11 | `test/featherboa-labels.test.js`; each place | open |
| SH-22 | The paper keeps the other half: the leader's says “Leader's copy,” and the participant's says nothing | 11 | PDFs of both copies | open |
| SH-23 | “Key terms box” becomes “Key terms” in the Add row | 11 | The Add row | open |
| SH-24 | Three commands stay in view: Print…, Share…, and a filled Present, at the right end of the sheet's row | 11 | A sheet at 1440 | open |
| SH-25 | More (⋯) holds the rest: Copy, Save as ▸ (the documents and the slides), Show QR codes, Import, Save as template, the paper (Letter or A4), the sheet's text size (E101), and Add answer key (on the participant's copy only, never remembered, E102) | 11 | Open More on each copy | open |
| SH-26 | The Add row at the page's end: Passage…, Text, Question, From my notes…, Space to write, Page break, and Key terms; Page break stays, though the drawing drops it | 11 | The Add row | open |
| SH-27 | Adding between parts stays | 11 | Kept: add a part between two | open |
| SH-28 | New sheet… lists the seven templates, each with one line on who it is for, as today's chooser does | 11 | `test/desk-sheet-templates.test.js` green; press New sheet… | open |
| SH-29 | The template's longer description stays a notice in the editor (E84) | 11 | Kept: a new sheet from a template | open |
| SH-30 | The room's screen stays dark in either theme, with today's strip: ‹ ›, Reveal, Footnotes, Blank, the screen count, Presenter view, and Close | 11 | Kept: `test/desk-present.test.js` green | open |
| SH-31 | The presenter view and its minutes are kept | 11 | Kept: open Presenter view | open |
| SH-32 | Present's words are Source Sans 3 and its titles Fraunces, as on paper (the drawing set the verses in Literata) | 11 | Present a sheet: the computed faces | open |
| SH-33 | A blank stays covered until it is revealed (the drawing's gray would let the room read it) | 11 | Present a sheet with a blank | open |
| SH-34 | The License card and the commercial check (E94) | 11 | Kept: `test/desk-sheet-commercial-confirm.test.js` green | open |
| SH-35 | The “what prints” notice | 11 | Kept: the notice on a sheet | open |
| SH-36 | Sharing and its dialog, with “Include the answer key” | 11 | Kept: `test/desk-sheet-share.test.js` green | open |
| SH-37 | “Import into my notebook” as a shared sheet's one filled button | 11 | Kept: open a shared link | open |
| SH-38 | The warning when another tab has the sheet open | 11 | Kept: `test/desk-audit8-dom-sheet-conflict.test.js` green | open |
| SH-39 | Undo | 11 | Kept: Ctrl+Z after an edit | open |
| SH-40 | The Sheets tour (E63) is rewritten for the new page | 11, 13 | `test/desk-sheet-tour.test.js` rewritten; run the tour | open |
| SH-41 | A shared sheet takes every Featherboa decision the rest of the site does | 11 | Covered by the rows below | open |
| SH-42 | On a computer a shared link opens a place on the Study page, read only until “Import into my notebook” | 11 | Open a shared link at 1440 | open |
| SH-43 | On a phone or tablet it opens the viewer that reads, presents with taps, prints, and shares, with nothing saved | 11 | Kept: `test/desk-sheet-phone.test.js` green; a shared link at 390 | open |
| SH-44 | Each shows the sheet as this section draws it (on a phone, at the screen's width with words at true size), with “Leader's copy” or “Participant's copy,” the stored fonts as Style's set shows them, and present mode's dark screen in Source Sans 3 and Fraunces | 11 | A shared link at 1440 and 390 | open |
| SH-45 | Its own buttons, its messages (a link that can't be read, a browser too old for the viewer), and its page around the sheet follow “Type,” “Color,” “Controls,” “The kit,” and “Night” | 11 | A broken link at 390, in both themes | open |
| SH-46 | The phone's viewer loads only `desk-sheet-view.css`, never `desk.css`, so every Featherboa rule it needs, and its faces (Literata among them), go there too | 11 | `test/desk-sheet-view-styles.test.js` extended to hold them | open |
| SH-47 | The viewer must work at its floor, Safari 16.4, so a newer CSS feature needs a fallback there | 11 | `test/desk-audit8-j-viewer-floor.test.js` green | open |
| SH-48 | Claude's sixth adjustment: the sheet a tab in any pane, with Print…, Share…, and Present at its row's right end, and the template's name and “saved” beside the copy tabs | 11 | None; see SH-49 | superseded → SH-49 |
| SH-49 | A sheet opens as a place of its own on the Study page (BVJ's idea of a sheet's own layout, grown into places) | 11 | Covered by ST-23 | open |

## Study and its places (ST)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| ST-01 | A “place” is one of the things the sidebar opens; the word is the record's, not a label a reader sees | 9 | No label calls one a “place” | open |
| ST-02 | The page is “Study,” and the header's “Study” leads to it, reversing “The workspace keeps the name ‘Study Desk’” | 9 | `test/featherboa-labels.test.js`: no “Study Desk” a reader sees | open |
| ST-03 | Only what a reader sees changes: the help page (about fifty mentions), the tours, the account pages, Privacy (four), and the Terms of Use (one) | 9 | Grep reader text in `src/pages/`, `src/components/`, and `src/scripts/` for “Study Desk” | open |
| ST-04 | Code and records keep the old name (`desk-*`, `data-desk`, `STUDY-DESK.md`) | 9 | No file, attribute, or key renamed | open |
| ST-05 | The title row has no heading: “Fold sidebar” at its left, the pane count and “Full screen” at its right | 9 | None; see HD-17 | superseded → HD-17 |
| ST-06 | A place's name is its pane's title (“Advent 2 handout ▾”), and the sidebar marks the place | 9 | A sheet's place at 1440 | open |
| ST-07 | The page keeps “Study” as a heading for screen readers, out of sight | 9 | `read_page` finds the heading | open |
| ST-08 | The word is “pane,” not “column”: “Panes 1 2 3” (“Panes 1 2” in a place), “Open in this pane ▸,” and “This pane is empty.” | 9 | `test/featherboa-labels.test.js`: no “column” in Study's labels | open |
| ST-09 | The reading page keeps “column” for its text column, a layout | 4 | Display's column labels | open |
| ST-10 | The reading page is “the Read page,” replacing E130's “Scripture page(s)” | 4, 9 | `test/featherboa-labels.test.js`: no “Scripture page” | open |
| ST-11 | Each label is worded case by case, a verb often serving better than the name (“Read Romans 8,” not “Read Romans 8 on its Read page”) | all (4) | The checkpoints' label audits | open |
| ST-12 | The address is /study, and /desk does not forward to it | 9 | `test/featherboa-old-addresses.test.js`: /study builds, /desk is the 404 page | open |
| ST-13 | The help page moves with it (BP-20) | 9 | `test/desk-help-page.test.js` rewritten for /study/help | open |
| ST-14 | /notebook, /sheets (with a sheet's `?id=`, present mode, and shared links), and /collections open their places on the Study page | 9 | Open each with the preview | open |
| ST-15 | The link that opens a passage in Study is the verb and the passage, “Study Romans 8,” as the Read page's is “Read Romans 8” (not “Open study”); it only ever opens a passage | 4, 6, 9 | The place line and Search's second row, with the preview | the place line's built (246ab483): “Study John 3,” and “Study John” on an introduction, to its chapter 1 (Q65); Search's second row (f1a6b2af), “Study John 3:16”; Study's own with Phase 9 |
| ST-16 | Where no passage is named, the header's “Study” is the way in | 3 | Covered by HD-01 | built (ec3378b6) |
| ST-17 | The sidebar, top to bottom: Scripture, Notebook, Sheets (the three most recent, and All sheets), Collections (the same), and Trash, with the foot “The Study Desk” drew | 9 | The sidebar at 1440 | open |
| ST-18 | Each sidebar row opens its place in the page's panes | 9 | Press each row | open |
| ST-19 | The sidebar marks the open place with a tint and a green bar; folded, it marks the group's icon | 9 | Open a sheet, with the sidebar open and folded | open |
| ST-20 | Scripture is “The Study Desk”'s panes of tabs: Panes 1 2 3, any of its kinds in any pane, following, and the widths | 9 | Covered by SD-15 and the rows after it | open |
| ST-21 | “Scripture” is also the word the place's own lists use: the first group of what a pane can show, and Search's first tab | 6, 9 | An empty pane's list; Search's tabs | Search's built (f1a6b2af): “Scripture” is its first tab; an empty pane's list with Phase 9 |
| ST-22 | Scripture's row shows the passage it holds at its right (“Scripture … Luke 3”) | 9 | The sidebar with Luke 3 open | open |
| ST-23 | The Notebook, a sheet, and a collection are places of their own: the place's own pane, and beside it a pane of tabs | 9 | Open each at 1440 | open |
| ST-24 | A place's title row shows “Panes 1 2,” never 3 | 9 | The title row in each place | open |
| ST-25 | A sheet starts with one pane, or two when it is in a collection; the Notebook and a collection start with two, the list and the passage beside it | 10, 11 | A fresh profile: open each | open |
| ST-26 | Each place keeps its own count and what is beside it, and Scripture keeps its panes while the reader is elsewhere | 9 | Change Scripture's panes, open a sheet, and come back | open |
| ST-27 | Beside a sheet, the pane keeps its own width (320px at first) and the page takes the rest; the Notebook and a collection start half and half | 10, 11 | Measure each at 1440 | open |
| ST-28 | Every line drags, with its menu and its reset (E189) | 9 | Kept: `test/desk-e189-lines.test.js` green; drag one in a place | open |
| ST-29 | The pane beside is on the right, as drawn | 9 | Each place at 1440 | open |
| ST-30 | The Trash is one pane, with no Panes control: each row with Restore, and “Empty trash…” at the row's end, which asks first | 9 | Open the Trash; restore one; empty it | open |
| ST-31 | The header's magnifier and “/” open Search beside the place's own pane, making the second pane if there was one | 9 | Press “/” on a sheet alone | open |
| ST-32 | In the Trash they open Search in Scripture; in Scripture they work as “The Study Desk” says | 9 | Press “/” in the Trash | open |
| ST-33 | Scripture (study a passage): beside it the LIT, Greek, Footnotes, This verse, Notes, and Search; it opens as “The Study Desk” says | 9 | Its pane list | open |
| ST-34 | Notebook (reread and tend what is kept): beside it the LIT, This verse, Greek, and Search; it opens with the LIT and This verse | 10 | The pane list; a fresh profile | open |
| ST-35 | A collection (gather around a theme): beside it the LIT, Search, and Notes; it opens with the LIT and Search | 11 | The pane list; a new collection | open |
| ST-36 | A sheet (build a handout): beside it the LIT, Search, Notes, a collection, and another sheet; it opens with its collection, the LIT, Search, and Notes | 11 | The pane list; a sheet in a collection | open |
| ST-37 | Trash (restore or empty): nothing beside it | 9 | Covered by ST-30 | open |
| ST-38 | A collection beside a sheet (BVJ's addition): its passages and notes go onto the page as Search's and Notes' do | 11 | Add a collection's passage to a sheet | open |
| ST-39 | Another sheet beside a sheet is there to copy from | 11 | Copy a part from one sheet into another | open |
| ST-40 | A sheet in a collection opens with that collection beside it: from the collection's place always, from the sidebar or All sheets at first, and after that as the reader left it | 11 | Open one from each way in | open |
| ST-41 | A sheet in more than one collection opens with the one the reader came from, else the one it was added to last; a sheet in none starts with one pane | 11 | A sheet in two collections, and one in none | open |
| ST-42 | The tab beside is for using the collection; its place is for tending it | 11 | Covered by the rows below | open |
| ST-43 | The tab's first line names it (“The collection this sheet is in”) and links to its place (“Open Wilderness”) | 11 | The tab beside a sheet | open |
| ST-44 | Under it, the collection's groups and items, each cut to three lines, with this sheet shown but not offered | 11 | The same tab | open |
| ST-45 | Choosing rows (Ctrl or Shift adds) brings a bar to the pane's foot, “2 chosen · Clear · Add to sheet,” which adds them after the part chosen on the page | 11 | Choose two, then add them | open |
| ST-46 | Or a row drags onto the page, where a green line shows where it lands | 11 | Drag a row onto the page | open |
| ST-47 | A note goes on as a text part headed “From my notes · Luke 3:8” | 11 | Add a note from the tab | open |
| ST-48 | Ordering, removing, and renaming stay in the collection's place | 11 | The tab offers none of them | open |
| ST-49 | A sheet and a collection stay two places, since a collection holds more than sheets and a sheet can be in several collections or none | 11 | A sheet in two collections opens from each | open |
| ST-50 | No Notes beside the Notebook, which is the notes | 10 | The Notebook's pane list | open |
| ST-51 | No Footnotes outside Scripture: the LIT floats a verse's footnotes in its margin, This verse lists them, and a sheet's passage chooses its own with “Footnotes…” | 9, 11 | Each place's pane list | open |
| ST-52 | Search is in every set, so the magnifier never takes the reader away from their work | 9 | Press the magnifier in each place | open |
| ST-53 | The empty pane and “Open in this pane ▸” list only the place's set | 9 | An empty pane in each place | open |
| ST-54 | The LIT tab's More offers “Open in Scripture” at the same passage, for anything a place doesn't hold | 9 | More on a LIT tab beside a sheet | open |
| ST-55 | No Greek beside a sheet | 11 | A sheet's pane list | open |
| ST-56 | Alone, a sheet's page shows at true size wherever the pane holds the paper and its margin (a Letter page needs about 880px) | 11 | A Letter sheet alone at 1440 | open |
| ST-57 | With a pane beside it, the page scales down to 80% at most, then reflows at true type size with no page breaks drawn | 11 | At 1163: reflowed with the sidebar open, about 86% with it folded | open |
| ST-58 | The sheet's commands are at the right end of its row: Print…, Share…, a filled Present, and More | 11 | Covered by SH-24 | open |
| ST-59 | Under the row, a bar holds the copy tabs, with the template's name and “saved” at its right (“Bible study · saved”) | 11 | A sheet at 1440 | open |
| ST-60 | The formatting bar sits over the part holding the cursor, at the part's left edge and above its own controls | 11 | Type in a part: the bar sits above it | open |
| ST-61 | The Read page's Notebook panel loses its Greek tab, leaving Notes, Footnotes, and This verse (reversing BVJ's four in “Beside scripture”) | 5 | The panel with the preview | open |
| ST-62 | This verse's Greek words open Study at that verse, with the Greek tab at the word | 5, 9 | Press a Greek word in This verse | open |
| ST-63 | A draft chapter's line links to that chapter's Greek in Study | 4 | Covered by WB-32 | open |
| ST-64 | Study keeps the Greek: Scripture's panes start with it beside the LIT, and it is beside the Notebook | 9, 10 | A fresh profile; the Notebook's pane list | open |
| ST-65 | Sheets and collections leave the panes: a pane can show Scripture (The LIT, Greek, Footnotes, This verse), Yours (Notes), and Search | 9 | An empty pane in Scripture | open |
| ST-66 | “A Sheets or Collections tab opens the last one” becomes the place's title, whose name is still a menu (another, a new one, or all) | 11 | Press a sheet's title | open |
| ST-67 | Two sheets side by side are now a sheet with another beside it | 11 | Covered by ST-39 | open |
| ST-68 | Dragging an item from the sidebar onto a pane goes | 9 | Drag a sidebar row: nothing opens | open |
| ST-69 | The Notes tab lists the chapter (“This chapter”), with a link to the Notebook (“All 128 in the Notebook”) | 5, 9 | The panel's and Study's Notes tab on John 3 | open |
| ST-70 | “Everything” is the Notebook place: the list and its filters, Manage labels…, Print…, and “Changed since you marked it” go there | 10 | Each in the Notebook place | open |
| ST-71 | The Trash is a place rather than a tab | 9 | Covered by ST-30 | open |
| ST-72 | Every address keeps working but /desk, now /study | 9 | Covered by ST-12 | open |
| ST-73 | The title row has no heading (restated in the changes to “The Study Desk”) | 9 | None; see HD-17 | superseded → HD-17 |
| ST-74 | The Notebook is a place, not the Notes tab on “Everything”: choosing a note takes the LIT tab beside it to the note's verse, and with one pane it opens the second | 10 | Choose a note with one pane and with two | open |
| ST-75 | The rule for a LIT tab sharing the list's pane goes | 10 | Covered by ST-74 | open |
| ST-76 | When the commands for what is chosen don't fit the pane, the count goes first, then “Add to collection…” and “Label…” move into More | 10 | Narrow the Notebook's pane with rows chosen | open |
| ST-77 | A sheet's page at true size with a pane beside it (320px) needs a window about 1,450px wide with the sidebar open or 1,275px folded; at 80%, about 1,280px or 1,110px | 11 | Measure at 1,450 and 1,275 (true size) and 1,280 and 1,110 (80%), the sidebar open and folded | open |

## The Greek (GK)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| GK-01 | The drawing's frame (a “John 1 with the Greek” heading and layout icons) isn't taken; “Study and its places” replaced it | 12 | No such heading or icons | open |
| GK-02 | A word's partner in the other language doesn't light up yet, not even for the glossary's terms; it waits for the word links, and will show here | 12 | Choose λόγος: nothing lights in the LIT | open |
| GK-03 | The Greek is Source Sans 3's own polytonic Greek, set as today: paragraphs with their verse numbers, not a table of words (not the proposal's Literata) | 12 | The Greek tab's computed face on John 1 | open |
| GK-04 | Its verse numbers are ink at 66%, not deep green, since nothing happens when one is pressed | 12 | The computed color, still 4.5:1 | open |
| GK-05 | A word's other forms are marked in two tints: pointing tints its forms in the chapter gray; choosing tints it green with a rule under it and its other forms a lighter green (the text green at 22% and 12%) | 12 | Point at one word while another is chosen | open |
| GK-06 | The proposal's faint underline is not taken | 12 | No underline on pointing | open |
| GK-07 | The marking reads the Greek's own dictionary forms, not the tagging the partner lighting waits for | 12 | Kept: the same forms marked as on `main` | open |
| GK-08 | Choosing a word opens its card under the text, in the house's plain rows | 12 | Choose a word at 1440 | open |
| GK-09 | The card's first row: the word, its dictionary form, and that form's transliteration (“λόγος logos”), made by one rule at build time, matching the glossary's | 12 | The card for λόγος; the rule shared with GL-18 | open |
| GK-10 | Form: the parsing in words, with MorphGNT's code beside it, as today | 12 | Kept: the card's Form row | open |
| GK-11 | In the LIT here: “rendered here as ‘Conversation’” with its glossary link (for the glossary's words), and “LIT notes on verse 1: a,” each letter opening This verse | 12 | The card for λόγος in John 1:1 | open |
| GK-12 | It never names one footnote as a word's explanation, so the proposal's “footnote a explains the choice” goes | 12 | No such line on any card | open |
| GK-13 | Outside the glossary's words the row stays hidden | 12 | The card for a word not in the glossary | open |
| GK-14 | Dictionary: “UBS dictionary · STEPBible” as a plain row of choices at its top, not a menu that hides the second | 12 | The card's Dictionary row | open |
| GK-15 | STEPBible keeps the full LSJ entry under its brief one (BVJ, 2026-10-13), and UBS its “At this word” and “Other senses” | 12 | Kept: both dictionaries for λόγος | open |
| GK-16 | The line “A lexicon and the LIT can differ” moves into the Dictionary row | 12 | The row at 1440 | open |
| GK-17 | Elsewhere: “4 in this chapter · Every place it appears →,” the chapter's count as today, its link the search for every form (not the proposal's verse count) | 12 | The count matches `main`'s; press the link | open |
| GK-18 | “Find this word ▾”: one press, then today's four searches as its choices: this form, every form of λόγος, Strong's G3056, and words parsed the same | 12 | Run each | open |
| GK-19 | Its results open in a Search tab in the Greek's own pane, right after the Greek tab, a later search reusing it | 12 | Run two searches: one Search tab | open |
| GK-20 | Choosing a result moves the LIT tab to its verse, and the Greek follows to the word | 12 | Choose a result | open |
| GK-21 | This reverses E219's results in place of the text (with “← John 1” and “See results on the search page”) | 12 | The Greek's text stays in place after a search | open |
| GK-22 | A note from the Greek stays (step 4k, PR #693): from a chosen word, or from a selection of the Greek (“Add a note on verse 1”) | 12 | Kept: `test/desk-note-from-greek.test.js` green | open |
| GK-23 | The card's button says “Add note,” beside “Find this word ▾,” in place of the note icon alone | 12 | The card at 1440 | open |
| GK-24 | A chapter still being translated takes no note, since the record format never anchors a mark on a draft | 12 | Kept: no note can be saved on Acts 2 | open |
| GK-25 | Where a chapter can't take a note, “Add note” stays on the card, unavailable and legible, with its reason (“This chapter is still being translated, so it can't take notes yet.”) | 12 | The card on Acts 2 | open |
| GK-26 | A selection of the Greek on such a chapter opens its menu with that line unavailable and the same reason beside it | 12 | Select Greek on Acts 2 | open |
| GK-27 | The text-critical signs, “Show the note,” and the Apparatus view stay | 12 | Kept: a verse with ⸀ in each view | open |
| GK-28 | Sources and licenses stay, which the licenses require | 12 | Kept: `test/greek-credits.test.js` green | open |
| GK-29 | The draggable line between the text and the card stays (BVJ, 2026-10-17) | 12 | Kept: drag it | open |
| GK-30 | Following the LIT tab, with “Go to verse N,” stays | 12 | Kept: move in the LIT tab | open |
| GK-31 | The arrow keys through the words stay | 12 | Kept: arrow through John 1:1 | open |
| GK-32 | The line saying where John 7:53–8:11 and Romans 16:25–27 take their Greek stays | 12 | Kept: John 8 and Romans 16 | open |
| GK-33 | A copy that pastes as plain Greek stays | 12 | Kept: copy and paste a verse | open |
| GK-34 | The Greek search commands and their builder stay (`public/greek/CLAUDE.md`, rule 17), in a window of their own | 6 | Kept: `test/greek-builder.test.js` green | built (f1a6b2af): the window kept; `test/greek-builder.test.js` green |
| GK-35 | The window stays a window opened on request, dragged aside and keeping its place, in Featherboa's look | 6 | Open it, drag it, close it, and reopen it | built (f1a6b2af): the same float window, opened on request; its drag and saved place are unchanged code, not dragged again in this review |
| GK-36 | What it holds stays: the builder on top, “Examples and all commands” under it, and nothing about the notebook | 6 | Kept: the window's contents | built (f1a6b2af): the builder on top, “Examples and all commands” under it, nothing about the notebook (seen) |
| GK-37 | Its one way in is a quiet link in the field's row, shown only while the Greek tab is chosen, wherever that row is: /search, the tray, and Study's Search tab | 6 | Each of the three, with the Greek tab chosen and not | /search's and the tray's built (f1a6b2af): “Build a search…” in the field's row, on the Greek tab only; Study's Search tab with Phase 9 (Q78) |
| GK-38 | The link replaces today's three “Search commands” buttons | 6 | No “Search commands” button left | /search's and the tray's built (f1a6b2af); Study's Search pane keeps its “Search commands” button until Phase 9 (Q78) |
| GK-39 | A Greek tab with nothing searched yet shows a few examples where results would be, as today | 6 | Kept: the Greek tab, empty | built (f1a6b2af): kept, the empty Greek tab's examples |
| GK-40 | It meets “Find this word ▾” through the field: each of the card's four searches puts its search in the Search tab's field, and the builder reads it, starting with that word as its first card | 12 | Run a card's search, then open the builder | open |
| GK-41 | “Find this word ▾” takes no fifth item | 12 | The menu has four | open |
| GK-42 | Typed commands keep working in every field that searches the Greek | 6 | Kept: `test/greek-commands.test.js` green | built (f1a6b2af): `test/greek-commands.test.js` green |
| GK-43 | The field's placeholder keeps its example (“Try πίστις.gen or *.aor.impv”) | 6 | Kept: the placeholder | built (f1a6b2af): the placeholder kept |
| GK-44 | It is called “Build a search” (not “Search commands” or “Advanced search”): the link reads “Build a search…,” the window carries the name as its title, and the commands sit under a heading of their own inside it | 6 | `test/greek-commands-ui.test.js` rewritten | /search's and the tray's built (f1a6b2af): the link reads “Build a search…,” the window's title is “Build a search,” the commands sit under “Examples and all commands” (`test/desk-commands-window.test.js` holds the link's name; `greek-commands-ui.test.js` covers the window's pure pieces, unchanged); Study's pane with Phase 9 (Q78) |

## First visit, signing in, and sync (AC)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| AC-01 | The first visit is Study's empty state: “Your notebook is empty, and it is yours,” with three ways to begin, “Open a chapter and mark a verse,” “Start a sheet from a template,” and “Take the tour” (not “See how Study works”), the one filled button | 13 | A fresh profile at 1440 | open |
| AC-02 | “Take the tour” is the acting tour, with “Start here” at Study's head; the help page stays under Help | 13 | Covered by NX-19 | open |
| AC-03 | It says “this browser,” never “this computer” | 13 | Covered by NB-34 | open |
| AC-04 | Its foot offers both setting up an account and signing in, so keeping the notebook in this browser stays a plain choice | 13 | The empty state's foot | open |
| AC-05 | It shows only while the notebook is empty, and replaces today's first-use card | 13 | `test/desk-first-use.test.js` rewritten; add a note and reload | open |
| AC-06 | Signing in puts Apple and Google first, and “Sign in with a passkey” as a quieter third, not three equal buttons | 13 | The sign-in screen at 1440 | open |
| AC-07 | Apple's and Google's buttons follow each provider's own rules, so neither is one of the house's filled buttons and the screen has no filled button among the three | 13 | `test/desk-account-providers.test.js` green | open |
| AC-08 | The drawing's sentence about locking isn't used, since it isn't true by default; the screen says what is true at the default, with the one quiet line about the option every setup shows | 13 | The screen's words | open |
| AC-09 | Claude's draft: “No passwords, and no codes by email. Your notes are encrypted on our service, and we never read, sell, or share them. Turn on End-to-end encryption and only you can open your notes, not even LIT.” | 13 | The words as drafted, until AC-24 | open |
| AC-10 | “As planned, the LIT Bible apps” loses “as planned” | 13 | No “As planned” left | open |
| AC-11 | “Save your recovery code” shows only to a reader who turns on End-to-end encryption | 13 | Set up with and without the option | open |
| AC-12 | The two groups are still typed back, in place of the drawing's “I have saved it” box, and Done waits until both match; Print and Copy stay | 13 | Type one group wrong: Done waits | open |
| AC-13 | The drawing's lines, in the house's words: “Kept in this browser only” with “Back up…” (and “Last backed up 9 days ago”), “Syncing…,” “In sync,” “Offline. Your changes are saved here.,” and “Signed out. Your notebook is still here.” with “Sign in” | 13 | `test/desk-sync-status-line.test.js` extended | open |
| AC-14 | For a stop only the reader can settle, “This browser can't open your notebook.” with “Reconnect” (not “Fix…”), which opens the account page | 13 | `test/desk-sync-stop.test.js` green | open |
| AC-15 | The states the drawing leaves out get a line in the same short form, and the full account's words stay BVJ's | 13 | Each state's line | open |
| AC-16 | One set of words, shown at the foot of what it is about: the Study sidebar's foot, the Read page's Notebook panel, and the header's account menu | 13 | The same state in all three | open |
| AC-17 | A stop moves to the foot line and a dot, with no bar, reversing part of BVJ's 2026-11-24 call | 13 | A stop on /about: no bar | open |
| AC-18 | Two notices keep their bar on the page being read: a request that waits (to delete the account, or to replace its notebook), and a device that joined; the one exception to “nothing floats over the page” | 13 | `test/desk-sync-account-notice.test.js` green | open |
| AC-19 | The account page stays a page of its own (`/account`), as built: setup, devices, the recovery code, signing out, and deleting | 13 | Kept: `test/desk-account-page.test.js` green | open |
| AC-20 | It gains step SK4's “End-to-end encryption,” on and off, holding “Follows my account” and “This device only” | 13 | Drawn once SK4 is on `main` | open |
| AC-21 | The proposal's three screens are its first steps, drawn in Featherboa's look | 13 | /account's setup at 1440 | open |
| AC-22 | All settings links to the account page | 4 | Covered by DI-21 | open |
| AC-23 | The header's “Sign in” stays | 3 | Kept: covered by HD-12 | built (ec3378b6, kept) |
| AC-24 | The words wait for step SK5, which rewrites /privacy, /terms/, the help page, the first-time card, the tour, and the Settings tab; the drafts here are Claude's, to be checked there | 13 | Each draft listed for SK5 | open |
| AC-25 | The joined device's notice carries more weight under the default, so its bar stays | 13 | Covered by AC-18 | open |
| AC-26 | Nothing here changes the sync, the encryption, or the record format; the spare key's changes are steps SK1 to SK5 | 13 | No change to `src/lib/desk-sync*.mjs` or `STUDY-DESK-FORMAT.md` | open |

## Small screens (SM)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| SM-01 | Study stays on computers: phones and tablets use the free apps, and neither of the proposal's versions is built | 13 | /study at 390 and 820 | open |
| SM-02 | On a phone or tablet, Study says so in one sentence with the two store links, in place of today's “The Study Desk is a preview that isn't switched on in this browser.” | 13 | /study at 390 and 820 | open |
| SM-03 | The sentence, Claude's draft (approved in BP-15): “Study is made for a computer. On a phone or tablet, the free LIT Bible app keeps your notes, highlights, and bookmarks.” | 13 | The words at 390 | open |
| SM-04 | Once the apps sync, it adds “and, once you sign in, the notebook you keep here.” | 13 | Once the apps sync | open |
| SM-05 | The sentence's words are BVJ's to approve | 13 | None; settled by BP-15 | superseded → BP-15 |
| SM-06 | Tablets use the apps too, with no tablet version planned, dropping the version 2 idea of 2026-10-28 | 13 | /study at 820 says so | open |
| SM-07 | A shared sheet's link opens its viewer on a phone or tablet, as built | 11 | Covered by SH-43 | open |
| SM-08 | The account page gives a phone the basics (signing in, a request that waits, deleting, and signing out), as built | 13 | Kept: /account at 390 | open |
| SM-09 | Where that page says where the notebook can be opened, it uses the sentence above | 13 | /account at 390 | open |

## The dares (DA)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| DA-01 | Taken, viii: one line of Fraunces's italic, large, on Home, About, and the 404 page, never two on a page and never in reading or Study | 7 | Covered by TY-16 | About and the 404 built (bae1d1cb); Home with Phase 7 |
| DA-02 | It stays one large line, never a sentence of reading text | 7 | Each line at 1440 and 390 | About and the 404 built (bae1d1cb); Home with Phase 7 |
| DA-03 | Each line BVJ's to choose (on Home the letter's first, “No, I don't want my kids near most Bibles, either.”, or “A Bible that's FOR everyone”) | 7 | None; settled by BP-14 | superseded → BP-14 |
| DA-04 | Taken, ix: a colophon at /colophon, “How this site is made,” linked from the footer | 7 | The footer's link; the page builds | built (b8fcd43b, 1253bf85) |
| DA-05 | In plain words it gives the faces and why, what each color means, and the site's promises about contrast, motion, and reading without JavaScript, so it is also the accessibility statement | 7 | The page at 1440 | open |
| DA-06 | The dare's sentence that people direct the site and an AI writes much of its code is BVJ's to word or leave out | 7 | BVJ's answer at Checkpoint A | queued (Q2) |
| DA-07 | If it is in, the page says as plainly who translates the text | 7 | BVJ's answer at Checkpoint A | queued (Q2) |
| DA-08 | Declined, i: the front page is John 1 (“The front page” took John 1 open on the first screen) | 7 | Covered by FR-09 | open |
| DA-09 | Declined, ii: a reader's edition by default (Display's “Verse and chapter numbers” and “Footnote letters” put it one switch away) | 4 | Both switches on by default | open |
| DA-10 | Declined for now, iii: show the argument (a “Compare” switch), revisited with the word links | 4 | No Compare switch | open |
| DA-11 | Declined where it is left, iv: “Notebook” doesn't become “Notes” | 9, 10 | Covered by NB-18 | open |
| DA-12 | Declined, v: one highlighter (“Color” kept the four highlighter colors and the six note markers) | 1 | Covered by CO-13 | built (c1bb5383, kept) |
| DA-13 | Declined, vi: pages, not a scroll | 4 | Covered by WB-01 | open |
| DA-14 | Declined, vii: retire the header while you read | 3 | The header stays on John 3 at 1440 | built (ec3378b6, kept) |

## Decided with the build plan (BP)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| BP-01 | Featherboa and Study launch together, in one merge that is also Study's public beta, so no computer ever has the new site without Study (settles SD-66) | 14 | Phase 14's launch list | open |
| BP-02 | Site 2.0's code is removed, and `SITE-2.0.md` stays as the record (settles WS-03) | 0 | No `data-restyle`, `restyle.css`, or `v2/` left; `SITE-2.0.md` kept | built (63d07ac0) |
| BP-03 | Search's tab for the reader's notes is “Notebook,” not “My Notebook,” by “Controls”' rule of no “My” (overrides SE-05) | 6 | /search with the preview | built (f1a6b2af): the tab is “Notebook” |
| BP-04 | About's rows include License: The LIT, Commitments, License, The Collective, Apps, Release Notes, Support, Contact (overrides HD-24; FP-18 put it under About) | 3 | About ▾ at 1440; `test/featherboa-labels.test.js` | built (ec3378b6) |
| BP-05 | The What's New page is built with the rest, its entries written by hand, with no feed, at `/whats-new` | 7 | /whats-new builds, with no feed | built (1253bf85) |
| BP-06 | Its entries: the apps, dated to their release; the new site (“Featherboa” isn't a public name); and the Study page and its features as a mock-up near the end (words in OP-07) | 7, 13 | The three entries on /whats-new | two of three drafted (1253bf85); Study's with Phase 13; the words queued (Q3) |
| BP-07 | The pages no section draws (About, Commitments, the Collective, Contact, App support, Support, Courses, Podcast, Privacy, Terms, Unsubscribe, the 404 page, Release Notes, the delete-account page, and the account pages) take the foundations, the header and its line, and the footer, with their words and order as today | 7 | Each page at 1440 and 390; words diffed against `main` | built (bae1d1cb; the account pages, cf6f21c8); words unchanged |
| BP-08 | /read is the picker at full size under its lede | 4 | /read at 1440 | built (246ab483), by FP-16 |
| BP-09 | /license is the owner's words in the reading column | 4 | /license at 1440 | built (de0085a8; its terms at the reading size in 94a0069e): seen at 1440 on dist |
| BP-10 | BVJ reviews those pages built, and any redrawn becomes its own decision | 7 | At Checkpoint A | open |
| BP-11 | /apps keeps its own look and faces inside the new header and footer, since its stylesheet is the LSC site's too | 7 | /apps at 1440: only the header and footer change | open |
| BP-12 | The icons are Lucide's (ISC license) at a 1.5-pixel stroke, credited in the colophon (the set for CT-17) | 2, 7 | `test/featherboa-icons.test.js`; the colophon's credit | the icons built (7216b1ef); credited in the colophon (b8fcd43b) |
| BP-13 | Fraunces starts at the specimen's settings: softness 50 and wonk on for headings, softness 100 for the paper's numeral, for BVJ to adjust on the preview (settles TY-15's start) | 1, 8 | Computed `font-variation-settings` on a heading and the numeral | built (c1bb5383) |
| BP-14 | The italic lines are each page's own words: on Home the letter's first line, set as its opening; on About “So… who am I?”; on the 404 page “Page not found.” (settles DA-03) | 7 | Each page at 1440 | About and the 404 built (bae1d1cb); Home with Phase 7 |
| BP-15 | Study on a phone or tablet says “Study is made for a computer. On a phone or tablet, the free LIT Bible app keeps your notes, highlights, and bookmarks.” (approved; settles SM-05) | 13 | /study at 390 | open |
| BP-16 | The front page on a phone keeps the computer's order: the buttons right under the claim and the name, John 1 after them | 7 | Home at 390 | open |
| BP-17 | New address: `/license` (for FP-18) | 4 | The page builds; `npm run check:links` passes | built (de0085a8): the page builds, and `check:links` passes (362 pages) |
| BP-18 | New address: `/colophon` (for DA-04) | 7 | The page builds; `npm run check:links` passes | built (b8fcd43b): the page builds, and `check:links` passes (362 pages) |
| BP-19 | New address: `/settings` for All settings (DI-19) | 4 | The page builds; `npm run check:links` passes | open |
| BP-20 | New address: `/study/help` for the help page (ST-13) | 9 | The page builds; `npm run check:links` passes | open |
| BP-21 | New address: `/whats-new` (BP-05) | 7 | The page builds; `npm run check:links` passes | built (1253bf85) |

## Open (OP)

| ID | Decision | Phase | Check | State |
|---|---|---|---|---|
| OP-01 | Fraunces's settings, adjusted on the preview from the starting values (BP-13) | 1 | BVJ on the preview | open |
| OP-02 | What else names Inter, beyond the two settled: the verse image's name and address (OS-19) and the margin notes' Plain face (RP-23); /apps keeps it | 1 | A search of the code when it is built | answered (c1bb5383): print and the verse image (Phase 8), a sheet's faces (Phase 11), and /apps; the fonts test's `LATER` map lists them |
| OP-03 | Whether Source Sans 3 has the SBLGNT's text-critical signs | 12 | ⸀ and its kin drawn in Source Sans 3, or Cardo kept (TY-20) | open |
| OP-04 | Whether Source Sans 3's served file has old-style figures | 1 | The served file's `onum` feature, for SZ-24 | answered: no; queued (Q7) |
| OP-05 | The glossary's third opening paragraph: Claude's draft (“As you look through the entries below…”) for BVJ to approve or rewrite at the build's review | 7 | BVJ's answer at Checkpoint A | queued (Q1) |
| OP-06 | The colophon's sentence about how the site is made: Claude drafts it, and it is decided at the build's review | 7 | BVJ's answer at Checkpoint A | queued (Q2); in place on /colophon, “Who makes it” (b8fcd43b) |
| OP-07 | The What's New page's words: its three entries, drafted in the build | 7, 13 | BVJ's answer at Checkpoint A | queued (Q3) |
| OP-08 | The launch's announcement, drafted in the build | 14 | BVJ's answer at Checkpoint B | queued (Q4) |
| OP-09 | When a part is built, its rules go into the area file for its code (`src/styles/CLAUDE.md` for fonts), and the record keeps the decisions and their reasons | all (1) | Each phase's commit updates its area file | open |
