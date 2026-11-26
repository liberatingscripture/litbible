# Site Design: Featherboa

Featherboa is the site's next design, and it replaces Site 2.0 (BVJ,
2026-11-26). This file is its record: each decision as BVJ makes it, with the
date, the words, and the reason, so the repo stands without the conversations
behind it. Decisions are added as they are made. **Nothing here is built yet.**

## Where it starts

- **Two proposals**, both dated 2026-11-25 and addressed to BDR and BVJ:
  "LIT Design Directions," version 2 ("Three rooms, one house": 26 proposals
  and nine dares; https://claude.ai/artifact/R519kYTzHob1KJ8X3EUoFf), and
  "LIT Front Page Directions" ("Three front doors";
  https://claude.ai/artifact/7GHEQ21QgeS8vxuthn1x2e). They belong to another
  claude.ai organization, so a session in BVJ's account reads them in the
  Browser pane by screenshot; the artifact tools answer "not found." BVJ is
  taking them one question at a time, and each answer gets a section here.
  **The front page comes last** (BVJ, 2026-11-26).
  Design Directions' 26 proposals, by part: **Foundations** (1 Three
  typefaces, 2 Green is ink, 3 One field, 4 Sizes and space, 5 One grammar,
  6 The kit, 7 Motion, 8 Night, 9 Nothing interrupts); **the reading room**
  (10 The reading page, 11 The margin, 12 Finding a passage, 13 Display,
  14 A whole book, 15 The phone, 16 Search, 17 Glossary and articles,
  18 Print and images); **the front door** (19 Four places, 20 The front
  page); **the workroom** (21 One workspace, 22 The Notebook, 23 Sheets,
  24 Greek, 25 Signing in and sync, 26 Small screens). Around them: What I
  saw, House rules, Nine dares, and Landing it.
- **Site 2.0** (`SITE-2.0.md`) was built and merged behind `data-restyle` on
  2026-11-17 and has not launched. Featherboa replaces it. Where the two
  disagree, this file wins.
- **Site 2.0's decisions don't carry over by themselves: each is decided
  again** (BVJ, 2026-11-26, “Decide each again,” asked whether they carry
  over unless changed). A 2.0 decision holds for Featherboa only once a
  section here says so; until then, 2.0's choice for a page is one option
  beside the proposals'. Its code stays on `main` behind `data-restyle` until
  Featherboa decides what becomes of it.

## Type (decided 2026-11-26)

Design Directions' proposal 1, "Three typefaces, one job each," with its
reading face changed.

### The rule

> “A reading face on a site should be sans-serif. Serif fonts are for
> headings and titles, heros, etc. only.” (BVJ, 2026-11-26)

The decisions below apply it to everything read at length: scripture,
footnotes, introductions, articles, the glossary, the reader's notes, and the
Greek, on screen and on paper.

**The reason is readers with dyslexia.** The evidence is thin and mixed.
Reviews find no difference in reading speed between serif and sans for
readers in general. The one eye-tracking study of dyslexic adults (Rello and
Baeza-Yates, 2013, 48 readers) reportedly found sans, monospaced, and upright
faces read better and italics worse (the paper itself was not reached). The
British Dyslexia Association's style guide recommends sans. BVJ offered to
drop the rule if the research showed no difference for dyslexic readers. It
doesn't show that, so the rule stands, and Literata, the proposal's reading
face, is out: it is a serif (BVJ had taken it for a sans).

### The faces

| Use | Featherboa | Today |
|-----|------------|-------|
| Headings, titles, heroes, the chapter numeral | **Fraunces**, the variable font, with its softness (`SOFT`) and wonk (`WONK`) axes | Crimson Text; Fraunces (static 400 and 500) in /apps, the verse image's reference, present mode, the slides, and a sheet's title in the editor |
| Reading text | **Source Sans 3** | Inter |
| Controls (buttons, labels, menus, a panel's own words) | **Atkinson Hyperlegible Next** | Inter; Atkinson Next is a reader's choice in the Display tray |
| Greek in sans text, and the Greek tab's SBLGNT | **Source Sans 3's own polytonic Greek** | Inter's Greek in sans text; the Greek tab in Crimson Text with Cardo's Greek |
| Hebrew in sans text | Noto Sans Hebrew | the same |
| Greek and Hebrew in Fraunces | Cardo | the same |
| Paper (printing a chapter, an introduction, or a Read View book; handouts; a sheet's paper copy; its slides) and the verse image | **The same as the screen**: Fraunces headings, Source Sans 3 text | Crimson Text (the verse image: the verse in Crimson Text, the reference in Fraunces, the address in Inter) |

What each choice carries with it:

- **Source Sans 3 is set larger than Inter.** At the same size its small
  letters are 89% as tall as Inter's, so it matches Inter at 18px when set
  at about 20.2px (measured in the specimen, below). Swapping the family name
  alone would make every page look smaller. `--ch` is per face
  (`src/styles/CLAUDE.md`), so Source Sans 3 needs its own, and the reading
  measure is checked again in it.
- **Fraunces needs its variable font.** The site loads only the static 400
  and 500 (`global.css`), which have neither axis; check which axes the
  `@fontsource-variable` package ships. The settings wait for the first
  heading drawn in it. The specimen used softness 50 with wonk on for
  headings, and softness 100 for the chapter numeral.
- **Controls stay Atkinson Hyperlegible Next**, as the proposal had them.
  Claude suggested Source Sans 3 there too, for one sans family; BVJ chose
  “Keep Atkinson,” so the two families stand side by side.
- **The Greek moves to Source Sans 3's own**, in both places. This replaces
  the part of the C27 plan (`STUDY-DESK.md`, 2026-10-05) that took the Greek
  in sans text from Inter. Atkinson and OpenDyslexic, which have no Greek,
  borrow Source Sans 3's as they borrow Inter's today. Cardo, BVJ's pick that
  day, stays for Greek and Hebrew in Fraunces, and for the SBLGNT's
  text-critical signs (⸀ and its kin), which come from a Cardo patch, unless
  Source Sans 3 turns out to have them.
- **Paper follows the screen.** This knowingly reverses E222 (BVJ,
  2026-11-22: the Sheets' paper “shouldn't use Fraunces at all”), which held
  the paper to Crimson Text and Inter to match Site 2.0. The reason given:
  the rule's dyslexia basis holds on paper too (the BDA's style guide is
  written mostly for print), and the text keeps one look wherever it goes.

### How it was decided (2026-11-26)

1. BVJ took the proposal's whole set (Fraunces for headings, Literata for
   reading, Atkinson Next for controls) and stated the rule above.
2. Literata is a serif, so the reading face was reopened; the research
   didn't support dropping the rule (above).
3. **Source Sans 3**, from a specimen of four sans faces: Atkinson
   Hyperlegible Next, Source Sans 3, Alegreya Sans, and Inter, each setting
   John 1:1–9, two footnotes, and John 1:1 in Greek under Fraunces headings,
   by day and by night, sized to Inter's x-height
   (https://claude.ai/artifact/Afi2c1maveGQb79obvTUUr, private to BVJ).
4. “Keep Atkinson” for controls.
5. “Same as the screen” for paper and the verse image.
6. “Source Sans 3's Greek” for the Greek.

## Color (decided 2026-11-26)

Design Directions' proposal 2, "Green is ink, not paint": every color has
one job, and color comes off everything that has none. Its reason: when
green means "press here," a reader learns it in one page; when it is also
the background, the arrows, the verse numbers, and the footnote letters, it
means nothing. BVJ took it ("take it for everything else"), with verse
numbers and footnote letters kept green, bookmarks kept red, and the cream
left for proposal 3.

| Color | Its one job |
|-------|-------------|
| Paper `#FAFAF8` | The page |
| Ink `#1D231C` | All text. Grays are ink at 78% and 66%, never a separate gray |
| LIT Green `#209D50` | The mark: the emblem, the chapter numeral, "you are here," one band on the front page. Never behind small text |
| Deep green `#0F6B33` | What can be pressed: links, and the one filled button on a view |
| Sunshine `#FFD23F` | The reader's own. No longer a bar over titles. The proposal names highlights, notes, and bookmarks, but bookmarks stay red and the note icons keep their own colors (below) |
| Red `#B3261E` | Deleting and errors, and bookmarks (below) |
| /apps' cobalt, red, and forest | Front-page feature panels only, never in reading or study |

- **Links stay green, in deep green** (BVJ: “Links should stay green,” “the
  dark green of the proposal”).
- **No longer green**: the full green sections on Home, the round arrow
  buttons, and the accents sky and ocean (Site 2.0's), which leave with the
  home page's chat bubbles.
- **Unchanged**: the four highlighter colors and the six note markers (the
  reader's own labels), and dark mode's near-black page.
- **The cream goes**, with proposal 3 ("Surfaces," below). Proposal 2
  retires it as a page color ("Paper: the page, everywhere"); it was left
  for proposal 3's question about the sheet and the cream.
- **Bookmarks stay red, and the note icons keep their own colors** (BVJ:
  “Bookmarks can stay red. The note icons have their own color scheme.”).
  The proposal makes red only for deleting and errors and gives the reader's
  own things to sunshine; BVJ kept both as they are today.
- **Verse numbers and footnote letters are deep green, with no underline**
  (BVJ, “Deep green, no underline”), since both can be pressed (the verse
  menu, the footnote). This departs from the proposal, which draws verse
  numbers as “small gray figures” that “still open the verse menu; they
  stop looking like links” (proposal 10) and takes green off footnote
  letters (proposal 2). Kept green, the rule has no exception: what can be
  pressed is deep green, and nothing else is. Dropping the underline keeps
  most of the quiet the proposal wanted.

## Surfaces (decided 2026-11-26)

Design Directions' proposal 3, "One field, and a shadow only on what
floats." Its reason: the sheet-on-cream look puts every page in a box and
then puts boxes in the box, so it takes the boxes away. BVJ took it
(“Otherwise, take it”), with the stage badge kept (below).

- **The page is the paper** (`#FAFAF8`, from "Color" above). The cream
  (`#E1DFD9`) and the sheet laid on it go. This reverses Site 2.0's cream
  everywhere, scripture "on a sheet," and the page frame with the Marks
  (`SITE-2.0.md`).
- **Things are set apart by space first, a hairline second, and a tint
  third.**
- **Two corner radii**: 6px on what is pressed, 10px on what floats. The
  proposal counts 14 different values today.
- **One shadow, and it means one thing**: this floats over the page and will
  go away. Menus, popovers, and dialogs have it; nothing else does.
- **No ornament**: the sunshine bar over titles (gone already under
  "Color"), the Marks, and the emblem watermark (Site 2.0's 404 and forms).
- **The stage badge stays while the Study Desk is in a stage** (BVJ: “The
  preview badge shouldn't go while it's still a preview. It's not a
  decoration. It's information.”). The proposal counts it as ornament and
  drops it, then keeps it once at the foot of the Study sidebar
  (proposal 9). Today it is the "Preview" badge on the Notebook's heading,
  its word read from `DESK_STAGE` in `src/lib/desk-first-use.mjs`.
  - **Where it goes is open**, since the format is changing (BVJ). It is
    decided with the workspace (proposals 9 and 21); proposal 9's place is
    one option.
  - **Its word**: BVJ, “maybe, since it's moving into beta rather than mere
    preview, it should evolve to a beta label.” That is already the plan in
    `STUDY-DESK.md` ("Launching": an invite-only preview, a public beta, then
    the full launch, the label turning from “preview” to “beta” at the
    public opening). Still open there (2026-11-23): whether a beta stage is
    left if the opening and sync land on the same day.

## Sizes, space, and the measure (decided 2026-11-26)

Design Directions' proposal 4: a short list of sizes, one spacing scale, and
fixed column widths. Its reason: today sizes and gaps are chosen page by
page, and with a scale, two people (or two Claude sessions) building two
pages arrive at the same rhythm without talking. BVJ took it with the
reading sizes refit for Source Sans 3 (“Take it, refit”).

### Ten sizes, each with a job

| Size | Face, weight, size / line height | Its job |
|------|----------------------------------|---------|
| Headline | Fraunces 300 to 800, 56 to 104 / 0.95 | The front door only, one per screen |
| Title | Fraunces 400, 48 to 62 / 1.0 | The name of a book or a page |
| Heading | Fraunces 500, 28 / 1.15 | Sections of an article, a sheet's title |
| Subhead | Fraunces 500, 21 / 1.2 | Panel and pane titles |
| Scripture | Source Sans 3 400, refit (the proposal: 20 / 1.62) | Scripture at the reader's size M; S, L, and XL still scale it |
| Text | Source Sans 3 400, refit (the proposal: 17 / 1.6) | Articles, introductions, footnotes at full length, the reader's notes |
| Margin | Source Sans 3 400, refit (the proposal: 15 / 1.5) | Notes beside a line, list rows in the Study Desk |
| Label | Atkinson Hyperlegible Next 600, 14.5 / 1.4 | Every button, tab, and menu row |
| Small label | Atkinson Hyperlegible Next 600, 12.5 / 1.4 | Counts, dates, captions. Nothing is smaller |
| Verse number | Atkinson Hyperlegible Next 600, 0.56 of the text | Grows and shrinks with the text size |

- **The three reading sizes are refit for Source Sans 3.** The proposal chose
  them for Literata. Source Sans 3's small letters are shorter, so the same
  numbers would look smaller: Text at 17 would look like Inter at about 15,
  smaller than articles are today. Each is set so its small letters stand
  as tall as the proposal drew them, measured when it is built, as "Type"
  found 20.2px; the line heights are checked with them.
- **Verse numbers are Atkinson** at 0.56 of the text, in deep green with no
  underline ("Color").

### One spacing scale

Every gap, padding, and margin is one of nine steps: **4, 8, 12, 16, 24, 32,
48, 64, 96**. Nothing is 10, 14, or 18 pixels “because it looked right that
afternoon.”

### Three columns, always the same widths

On a computer the reading page is a **220** quiet side, a **660** text
column, and a **320** margin. The text column never gets wider; on a bigger
screen only the outer space grows. The proposal's 660 gives about 68
characters in Literata at the default size, inside the 45 to 75 that
typographers and Bible publishers agree on; in Source Sans 3 it is measured
again, through `--ch` ("Type"). Larger text sizes shorten the count, which
is what a reader who chose them wants.

| Screen | Text | Notes and footnotes | Navigation |
|--------|------|---------------------|------------|
| Phone, under 700 | Full width, 24 at each side | A sheet from the bottom | One row on top, a bar at the thumb |
| Tablet, 700 to 1099 | 660, centered | A panel that slides over the right edge | The full header |
| Computer, 1100 and up | 660 | The 320 margin, beside the line | The full header and the place line |
| Study, 1100 and up | Two panes share what is left | The companion pane | A 236 sidebar that never moves |

Proposals 11 (the margin), 15 (the phone), and 21 (one workspace) draw these
rows in full.

### Targets and figures

- **Anything pressed is 36px tall with a mouse, 44 on touch**, and 32 only
  inside the Study sidebar. The smallest today is 24 (the proposal's count).
- **Old-style figures in running text, lining figures in the interface**
  (counts and dates, which align in columns). The proposal named Literata's;
  whether Source Sans 3's served file carries both is open.

## Open

- **The rest of the two proposals, and every page**, each decided again
  (above), with 2.0's decision beside the proposals'.
- **What becomes of Site 2.0's code** behind `data-restyle`.
- **Fraunces's settings** (above).
- **The Display tray's faces.** Its Default is Inter today; the other two
  choices are Atkinson Next and OpenDyslexic.
- **What else names Inter**: the margin notes' Plain face, and the verse
  image's wordmark and address.
- **Whether Source Sans 3 has the SBLGNT's text-critical signs**, and
  whether its served file has old-style figures ("Sizes, space, and the
  measure").
- **Where the Study Desk's stage badge goes** ("Surfaces," above).
- **How Featherboa is gated and launched.** Site 2.0 rides `data-restyle`
  (`SITE-2.0.md`, "At launch").

When a part is built, its rules go into the area file for its code
(`src/styles/CLAUDE.md` for fonts), and this file keeps the decisions and
their reasons.
