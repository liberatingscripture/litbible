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
| A sheet's serif, a leader's choice for a handout's words ("Sheets") | **Literata** | Crimson Text |

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
  reader's own labels). Dark mode's page moves slightly, under "Night"
  below.
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
- **One exception: a sheet's page in its editor sits on a tinted desk**,
  since it stands for a real sheet of paper ("Sheets").
- **The stage badge stays while the Study Desk is in a stage** (BVJ: “The
  preview badge shouldn't go while it's still a preview. It's not a
  decoration. It's information.”). The proposal counts it as ornament and
  drops it, then keeps it once at the foot of the Study sidebar
  (proposal 9). Today it is the "Preview" badge on the Notebook's heading,
  its word read from `DESK_STAGE` in `src/lib/desk-first-use.mjs`.
  - **Where it goes**: BVJ asked, since the format is changing. Decided
    with proposal 9: once, at the foot of the Study sidebar ("Nothing
    interrupts the reader," below).
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

**These widths are where every page starts, not a limit** (BVJ, “Keep
dragging,” with proposal 13). With the Study Desk on, the reader still drags
the lines between the text, their notes' margin, and the Notebook (BVJ,
2026-10-14; E189), and the text column drags only within 45 to 75
characters a line, the range above. Taking this proposal had quietly fixed
them, which neither the proposal nor Claude said at the time ("Display,"
below).

| Screen | Text | Notes and footnotes | Navigation |
|--------|------|---------------------|------------|
| Phone, under 700 | Full width, 24 at each side | A sheet from the bottom | One row on top, a bar at the thumb |
| Tablet, 700 to 1099 | 660, centered | A panel that slides over the right edge | The full header |
| Computer, 1100 and up | 660 | The 320 margin, beside the line | The full header and the place line |
| Study, 1100 and up | Two panes share what is left | The companion pane | A 236 sidebar that never moves |

Proposals 11 (the margin), 15 (the phone), and 21 (one workspace) draw these
rows in full. Study's row changed with 21: one to three panes of tabs, and
a sidebar that folds ("The Study Desk").

### Targets and figures

- **Anything pressed is 36px tall with a mouse, 44 on touch**, and 32 only
  inside the Study sidebar. The smallest today is 24 (the proposal's count).
- **Old-style figures in running text, lining figures in the interface**
  (counts and dates, which align in columns). The proposal named Literata's;
  whether Source Sans 3's served file carries both is open.

## Controls (decided 2026-11-26)

Design Directions' proposal 5, "One grammar for every control": how a label
is written, how an icon is drawn and when it may stand alone, and how loud a
button may be, each decided once. BVJ took it (“Take it”), with the
workspace's name left for proposal 21.

### Labels

- **Verb, then thing**: “Add note,” “Copy verse,” “Print sheet.”
- **Sentence case.** Capitals only for the names of places (the Notebook,
  Sheets, Collections).
- **An ellipsis only when the command needs more from the reader** before it
  acts: “Add to sheet…,” “Share….”
- **One name per thing, and no “My.”** Inside the Study Desk everything is
  the reader's.
- **No articles**: “Add note,” not “Add a note.”

The renames the proposal draws:

| Today | Featherboa |
|-------|------------|
| Notebook, My Notebook, the Notebook, My Notes | **Notebook** (the place), **Notes** (what is in it) |
| Sheets, My sheets, Sheets page | **Sheets** |
| Add a note, Add bookmark, Add a bookmark that moves | **Add note**, **Add bookmark** |
| Open in Study Desk, Edit in Study Desk, Open the Study Desk | One label, **Study Romans 8**, the verb with its passage ("Study and its places"; the proposal's "Open in Desk" is not taken) |
| “Show” (four different controls) | **View** for what a page displays, **Filter** for lists |
| Display settings, Display, Display options | **Display** |
| Stay here, Stop following | One switch: **Follow reading** |
| Layout…, Make this pane wider | A layout switch in view, and dragging the divider |

- **This reverses “My Notes” and “My Notebook.”** BVJ chose “My Notes” for
  every label and heading about the reader's notes (2026-10-26, BA138 and
  BA139, with Audit 8) and “My Notebook” for the /notebook page (E70,
  2026-11-10); `src/scripts/desk/CLAUDE.md` holds both until Featherboa is
  built. **“Notes” is the reader's, and “footnotes” the translation's**, so
  the two words are never used for each other.
- **The workspace is "Study"** ("Study and its places"), which reversed
  proposal 21's “Study Desk” ("The Study Desk"). The proposal's “Desk”
  (“Open in Desk,” and Desk among the places) is not taken.

### Icons

**One set**, in place of the sixteen scattered today: drawn on a 24-pixel
grid with a 1.5-pixel stroke and round ends, sized to sit beside its label.
**Typed glyphs (× ‹ › ▾) stop standing in for icons.** An icon may stand
alone only if it is one of five everyone knows: **search, close, back,
forward, and more**. Every other icon keeps its word. The set the proposal
draws: Read, Notebook, Sheet, Collection, Highlight, Note, Bookmark, Copy,
Share, Print, Layout, New, Search, Close, Back, More.

### Emphasis: four levels

| Level | For |
|-------|-----|
| **Filled** (deep green) | The one main action. A view may use it once |
| **Tinted** | The usual next step |
| **Plain**: words and an icon, no box until pointed at | Everything else; most commands on a tool surface |
| **Red words** | Deleting. Never filled |

Its reason: when every button is equally raised, the eye has to read all of
them to find the one; a ladder lets a reader find the main thing without
reading.

- **This replaces the Study Desk's four kinds of button** (E126, BVJ
  2026-11-12: primary, ordinary, toggle, and quiet or glyph), whose ordinary
  button is raised with a shadow at rest; "Surfaces" already took the
  shadow off.
- **It relaxes E159 for plain commands, on purpose** (BVJ, 2026-11-18: no
  button the color of what lies behind it). E159 was about a box that can't
  be seen against its background; a plain command has no box to lose, as
  menu items and quiet links (left alone by E159) have none. Their words,
  icon, and hover fill carry them, and the keyboard's focus ring is
  unchanged. A tinted or filled button still never matches its background.

## The kit (decided 2026-11-26)

Design Directions' proposal 6, "The kit: every control, in every state":
the whole set, drawn once, in each state a reader can meet. **If a screen
needs something that is not in the kit, that is a design conversation
before it is a line of code.** Its reason: today the same job (a small plain
command) is drawn at least four ways across the Study Desk, the header, and
the reading page. BVJ took it with unavailable controls kept legible (“Take
it, legible”).

**Ten controls, five states.** The controls: filled, tinted, plain,
destructive, icon alone, field, checkbox, switch, tabs, and list row. The
states: at rest, pointed at, pressed or on, keyboard focus, and unavailable.
They live in one small stylesheet of control classes shared by the header,
the reading page, and the Study Desk, in place of rules repeated in
`global.css`, `restyle.css`, and `desk.css`.

### What the states say

- **Pointed at** is one step stronger, with no movement and no shadow (no
  lift on hover, as the Study Desk's ordinary button has today).
- **On** is a fill or a green underline plus a heavier weight, so it never
  depends on color alone.
- **Focus** is the same 2-pixel green ring everywhere, set 2 pixels off the
  control (`--focus-ring`, as today).
- **Unavailable stays legible** (BVJ, “Take it, legible”), where the
  proposal draws it faded and saying why when pointed at. It keeps today's
  rule (`src/styles/CLAUDE.md`, "The Study Desk's buttons"): its fill stays,
  its words stand at 4.5:1 or more on every surface (a mock's faded 62%
  failed), and it is never faded with `opacity`. Its reason is given where
  a keyboard or a finger reaches it too, as menus give theirs today (beside
  the line, and to screen readers), since nothing points at a control that
  can't be focused.

### Choosing between look-alikes

- **Tabs** change what a pane shows. **A switch** turns one thing on at
  once. **A checkbox** is for a list of things to tick, then act on.
- **Today's green-filled pills** (“John 1 / Everything,” Theme, Text size)
  become tabs or a plain row of choices.
- **This settles E160** (BVJ, 2026-11-18, open until now: whether a chosen
  segment and a lone toggle that is on share one look). They do: on is a
  fill or a green underline with a heavier weight.

### Shapes

**Everything pressed has 6-pixel corners. The only round things are
switches, color dots, and the emblem.** This changes E141 (BVJ, 2026-11-17:
a rounded rectangle is a button, a pill is a chip in a set, a circle is a
mark on the page): chips take the 6-pixel corner too, and a real switch
(“Follow reading,” in place of the Stay here toggle) is the one round
control.

## Motion (decided 2026-11-26)

Design Directions' proposal 7, "Motion: four speeds, one curve." Movement
should explain where something came from and then get out of the way. Its
reason: the stylesheets use about twenty durations today, from 120 to 900
milliseconds, mostly with the browser's default "ease"; none is wrong alone,
but together they give the site no physical character. BVJ took it as drawn
(“Take it”).

| Speed | For | How it moves |
|-------|-----|--------------|
| **Instant**, 0 | Pointing, pressing, selecting, switching tabs, turning a setting on, highlighting a verse | It doesn't. Things done all day never make a reader wait |
| **Quick**, 120 ms | Menus, popovers, tooltips | Fades in and rises 4 pixels toward where it was called from |
| **Settled**, 180 ms | A margin note opening, the Notebook panel, the phone bar hiding as the reader reads | Slides 8 pixels from its edge and fades |
| **Large**, 260 ms | Bottom sheets, dialogs, present mode | Travels its full height; the page dims behind it |

- **One curve**: everything arrives fast and settles gently (a sharp
  ease-out). Leaving takes two thirds as long as arriving. Nothing bounces,
  and nothing loops.
- **Scripture never moves.** It does not animate, shift, or reflow when a
  note or panel opens: the margin is already reserved, so the text stays
  where the eye left it. Today some panels do reflow it, which is what
  `keep-reading-place.js` holds the reader's line through; proposals 10
  and 11 reserve the margin.
- **Reduced motion is unchanged**: a reader whose device asks for less gets
  no movement.
- **Built as** four duration tokens and one easing token, then one pass
  through the stylesheets to point each transition at one of them.

## Night (decided 2026-11-26)

Design Directions' proposal 8, "Night: the same page, with the lamp off."
People read scripture in bed; dark mode becomes a first-class page of its
own, not an inverted copy: the same typesetting, and color used even more
sparingly than by day. BVJ took it (“Take it”).

- **The page is `#111411`**, a black with a little green in it, and **text
  is `#ECEEE8`**, a soft white (15.9:1). Pure white on pure black glares and
  makes letters seem to swell. Today's dark page is `#0E0E0F`, with
  surfaces at `#161617` and text at `#F0F0F0` (`global.css`); one field
  ("Surfaces") leaves one page color.
- **Green lifts, sunshine dims.** LIT Green brightens to `#2DB463` at night,
  so the chapter numeral and the "you are here" mark keep their strength. A
  highlight becomes a low amber wash, with the words on it at 8:1. **Each of
  the four highlighter colors gets such a night wash**, its words at 8:1 or
  more; the proposal draws only the amber.
- **Depth without shadows.** Shadows barely show on a dark page, so what
  floats gets a slightly lighter surface and a hairline edge in place of
  "Surfaces"' one shadow.
- **Built as** the dark values in the token file, under the existing rule
  that every dark style is written for both the device setting and the
  reader's own switch.

### Contrast, measured

The proposal ran every text pairing through the WCAG formula, by day and by
night. All need 4.5:1 save LIT Green, held to 3:1 because it marks and sets
large type and never words.

| Pairing | Used for | Day | Night |
|---------|----------|-----|-------|
| Ink on paper | Scripture, all body text | 15.4 | 15.9 |
| Second ink on paper | Captions, secondary labels | 7.6 | 9.0 |
| Third ink on paper | Counts, dates (and verse numbers in the proposal, which are deep green here: "Color") | 5.1 | 5.9 |
| Third ink on the darkest tint | Counts in a selected sidebar row | 4.8 | 5.4 |
| Deep green on paper | Links, plain green commands | 6.3 | 9.6 |
| Label on the filled button | The one main action | 6.6 | 9.7 |
| Ink on a highlight | Highlighted scripture | 13.3 | 8.1 |
| Red on paper | Deleting, errors | 6.3 | 7.5 |
| LIT Green on paper | The chapter numeral, the "you are here" line | 3.4 | 6.9 |

The third ink was 3.3:1 by day in the proposal's first version and was
darkened to 5.1. LIT Green by day is enough for a large numeral or a marker
line and not for words, which is why green words are always the deep green.

## Nothing interrupts the reader (decided 2026-11-26)

Design Directions' proposal 9. In one sitting behind the preview gate its
author was offered an app banner, a storage notice with a checkbox and "Got
it," a tour card with three choices, the "Preview" badge, and a "Continue
reading" chip to dismiss: each kind, and each the site speaking first. In
the reading room and the workroom, the reader starts the conversation. BVJ
took it with Claude's adjustments (“Mostly take it, adjusted”), then worked
through two points BVJ raised, both of which come down to “people don't go
looking for things they don't know are there”: the tour offer, and
significant announcements.

### The rule

**Nothing appears over scripture unless the reader asked for it. Nothing
asks to be dismissed. If a message matters, it has a permanent place; if it
does not, it is not shown.**

**Pull, and push** (BVJ: “it's the same principle as a company workflow:
Pulls for information vs. pushes for information. Pulls are great when
someone knows the information is there waiting for them. Not so much when
either they don't know when it will be ready or don't even know it's
coming; that's where pushes come in.”). The rule above makes the site a
pull: a message waits in its permanent place. That serves a reader who
knows to look. **What a reader doesn't know exists, or doesn't know is
ready, is pushed**, once and never over scripture: the tour offer and a
launch's announcement below. The test for any new message is which of the
two it is.

**The exceptions**: anything that would lose a reader's writing (a failed
save, a notebook this computer can no longer open) may interrupt, once, in
plain words, with the fix as its button (the proposal's one exception).
BVJ's decisions below add two more, never over scripture: a launch's
announcement window, and the app banner on phones.

| Kind of message | Today | Its home |
|-----------------|-------|----------|
| Status | A notice card atop the Notebook panel; a reminder checkbox; a dot on a tab | One line at the foot of the thing it is about. It changes its words, never its place |
| Teaching | Tour cards over the page, with Take the tour now, Remind me later, and Don't show this again | The empty state: one sentence and one button, shown exactly when there is nothing else to show; Help holds the rest. **The tour offer keeps its prominence by its place** (below) |
| News | An announcement popover in the header; "What's new for you" on the Notebook page | **Where its subject lives** (below; the proposal had a dot beside About), and a "Changed since you marked it" filter in the Notebook. Nothing opens by itself, save a launch's window |
| Asks | The app banner above the header on phones; the newsletter form | The front page and the footer, never above scripture; the phone menu carries one "Get the app" row. **The app banner stays** (below) |
| Your place | "Continue reading" chips to dismiss | "Continue: Romans 8" is the first row of the book picker and of Home |

The proposal's empty state, for a chapter with none of the reader's notes:
"No notes on John 1 yet. Select a verse number or any words, then choose
Note, Highlight, or Bookmark," with "Show me how." The foot line under it
reads "Kept on this computer only" with "Back up…", and in its other states
"In sync," "Offline. Your changes are saved here.," and "Signed out. Your
notebook is still here." with "Sign in" (four of the sync states the site
already defines).

### The adjustments

1. **The backup reminder becomes the foot line's words**, not a bar: when
   it is due (E113: 7 days after the last backup), the line says so
   ("Last backed up 9 days ago") beside "Back up…". Until sync, a browser
   can clear its storage without warning, so this reminder is the reader's
   only protection, and the foot line is the proposal's own place for
   status.
2. **The tour stays, behind "Show me how"** in the empty state, and Help
   lists it. It is the acting tour BVJ decided (2026-10-13 and 14), not
   rewritten as text.
3. **The tour offer stays prominent, by its place rather than a floating
   window** (BVJ: “I had the tour offer itself prominently on purpose.
   Your adjustments help, but it's still not obvious it exists until
   you're already looking for it. People don't go looking for what they
   don't know exists.” Then, of Claude's three ways in: “Yes, to all
   three”). A reader can't ask for what they don't know exists, so the
   offer finds them, each time at a moment they started:
   - **"Start here" heads the Study Desk until the tour is taken.** The
     first time the Notebook or the workspace opens, its first line is
     "Start here: Take the tour," the view's one filled button. It keeps
     its place across visits, so nothing needs "Remind me later," and it
     never asks to be dismissed: taking the tour, or "I know my way
     around," moves it into Help.
   - **A reply at the first use.** The first highlight, note, or bookmark
     a reader makes adds "New here? Take the tour" to the line their
     action already brings ("Highlighted · Undo"), as E74 offers "Open the
     Notebook" in that line today.
   - **The front door**: the Study Desk's way in on Home and the header's
     Study menu offer "Take the tour" to a first-time visitor (drawn with
     the front page).
4. **The app banner stays on phones**, dismissed for 90 days as today. The
   proposal left it to BVJ ("it is how many phone readers find the apps"),
   and the website sends phone readers to the apps for its study tools.
5. **The stage badge is shown once, at the foot of the Study sidebar**
   (proposal 21's), not on every panel ("Surfaces": BVJ keeps it as
   information while there is a stage).

6. **News shows where its subject lives, and a launch adds the window**
   (BVJ: “Yes, both”). The proposal put news behind a dot beside About;
   BVJ: “That's not where I would think to find them as a user. About pages
   are usually pretty static. As a user, I might look at it the first time
   I'm encountering a site or organization, and then never, ever again.”
   And of the popover: “Right now the popover is the only place to see
   them. … people won't even know there's a What's New page, because the
   page itself will be new.”
   - **Ordinary news is marked on the place it is about**: a dot on the
     header menu that holds what changed, and “New” beside the item inside
     it, the dot clearing once the reader opens that menu. A new article or
     episode marks Learn; a Study Desk feature marks Study; text changes
     stay where reading starts, as Release Notes already is (/read's
     "Latest text changes," Home's "Latest change," and the footer).
     Readers come back to the menus they use, so news reaches the readers
     it is for. **Never only under About**: the desk preview's About menu
     drops its "What's new" link, and where Release Notes and the What's
     New page sit in the header is drawn with proposal 19 ("Four places").
   - **A launch** (the apps, the Study Desk's opening, the What's New page
     itself; BVJ names each) adds three things for a set time: the mark
     spelled out on its menu (“Study · New”), the front page's band, and
     **the announcement window**, kept for launches only under today's
     rules (one at a time, never on a session's first page or over
     scripture, once per reader; `src/components/CLAUDE.md`, "The
     announcement popover"). The window announcing the What's New page is
     how readers learn it exists; after that the marks point to it.

Home's "Continue" row is drawn with the front page, last.

## The reading page (decided 2026-11-26)

Design Directions' proposal 10, "The reading page: a printed page that is
not pretending." The chapter page is the site, and should feel like opening
a well-made reader's Bible: a book face, a true measure, quiet numbers, and
margins that do work. No paper texture, no page curl, no card; the craft is
in the typesetting. BVJ took it fitted to what was already decided (“Yes,
take it, fitted”), worked three points through, and added a Justify switch;
the points left over were then put one by one (“Take 1-6,” “Yes”), and the
Study Desk's Reading layout retires with them (“Retire it”). It is built
mostly as styles on today's markup, and every Display setting keeps
working; the margin footnote is the new behavior.

### The page

- **Scripture in Source Sans 3** at its refit size ("Sizes, space, and the
  measure"), about 70 characters a line in the 660 column. The proposal
  drew a book face at 20 pixels.
- **The chapter number is a drop numeral in LIT Green**, as in the apps.
  Proposal 14 retired it on the screen: where chapters read on, each has a
  heading that names it ("A whole book"). Paper keeps it ("Off the
  screen").
- **Verse numbers and footnote letters are deep green, with no underline**
  ("Color"), where the proposal drew small gray figures and small italics.
  **Footnote letters stand upright**: italics read worse for dyslexic
  readers ("Type"), and the green already sets them apart.
- **No sheet**: the text sits on the page ("Surfaces").
- **The way on at the foot is large type in deep green** (“John 2 →,”
  with "Luke 24" back), since it can be pressed; the proposal drew it in
  ink. Site 2.0 had made Next the one green filled button (BVJ); here it is
  green as type. Since proposal 14 chapters read on into each other, so it
  shows at the book's end, and at each chapter's foot without JavaScript
  ("A whole book").

### The margin

Footnotes and the reader's notes share the 320 margin, one place for
everything about a line.

- **A footnote opens in the margin when its letter is pressed, one at a
  time**, as today's popover does over the text (BVJ, asking, and
  confirmed by the proposal: "A footnote opens beside its line instead of
  in a popover over the text"). Another letter swaps it; ×, Escape, or a
  press elsewhere closes it.
- **The opened footnote floats over the reader's notes beside its line**
  (BVJ: “Sitting on top of them? I think so. There needs to be a very
  clear distinction.” Then “Record it,” over pushing the notes down,
  which would move every note below and jump them back on closing). It
  has "Surfaces"' one shadow and 10-pixel corner, which mean exactly this:
  it floats over the page and will go away.
- **It shows the whole note, right there** (BVJ: “Long footnotes should be
  able to be viewed in full right there, not navigating to the bottom of
  the page. Bottom of the page navigation should be an option, but not
  the only way to view it.”). Taller than the window, it stops at the
  window's edge and scrolls inside itself, as menus do (E179). At its foot,
  "In the notes ↓" goes to its entry in the list at the chapter's end, the
  other way to read it. The proposal's "Read the whole note →" is not
  used. Since proposal 14 the list is off the screen where chapters read
  on, and "In the notes ↓" opens the Notebook's Footnotes tab at the note
  ("A whole book").
- **The reader's notes lie flat on the page, on a pale sunshine tint with a
  sunshine bar down the left edge**, headed "Your note · verse 5," with
  their marker's dot when they have a label. In the proposal a note was
  “marked in sunshine” by only a yellow hairline above it, against the
  footnote's green one, in the same face, size, and ink (BVJ: “What does
  ‘marked in sunshine’ actually look like?”). So the two differ by
  floating against flat, printed against tinted, and a letter against
  “Your note,” never by color alone (BVJ took this look with the points
  below: “Take 1-6”). They stack beside their lines as today (five on a
  line, then "N more notes").
- **Playpen Sans goes** (BVJ: “I think we can do away with the Playpen
  Sans”), and the notes' "Plain" setting with it. **The reader's notes
  follow the reader's Display face** at the Margin size, like everything
  else (Source Sans 3 by default, or Atkinson or OpenDyslexic), so a reader
  who picks OpenDyslexic has it in their notes too. The site keeps three
  faces.
- **Without a margin**, the popover is the fallback and shows the whole
  note, with the same "In the notes ↓". On a phone, a footnote opens as a
  sheet from the bottom, whole ("The phone"); the reader's notes are the
  Study Desk's, which a phone doesn't have.

### The page's controls

One line under the header says where the reader is, and each part of it is
a picker: "John" lists the books, "Chapter 1" the chapters. Previous and
next are plain arrows there, and large type at the foot.

**The line's right end loses "Switch to Read View" and keeps "Open in
Study Desk"** (BVJ, “Yes,” and “Read View pages are being retired”). Read
View retires at launch (BVJ, 2026-10-21; `STUDY-DESK-FIXES.md`, E8), so its
pill goes with it; the Study Desk's way in stays in the line, under the
name proposal 21 kept ("The Study Desk"). The proposal's line drew neither, only the arrows
and "Notebook" (proposal 11).

**The phone's bar was left to proposal 15** (“Take 1-6”), which draws the
phone whole ("The phone"): one row at the top (the emblem, the chapter's
name as its picker, and Aa) and a bar at the thumb (Previous, Search, Menu,
and Next), both hiding while the reader scrolls down. It replaces today's
one row at the top (audit F3, owner 2026-09-28), which stands until it is
built.

### A Justify switch

BVJ's addition: “a justified margins toggle, like we did for the Reading
layout in /desk.” Taken with “Take 1-6”:

- **One switch, "Justify," in the Display tray**, directly under Line
  spacing ("Display," below).
- **It brings hyphenation with it**, as /desk's rule does (E106): justified
  text without hyphenation opens wide gaps between words at a 70-character
  line.
- **E106's exceptions stay**: poetry, OpenDyslexic and Atkinson, and a
  column under 22em are never justified.
- **It is off by default.** The British Dyslexia Association's style guide,
  which "Type" leans on, recommends left-aligned text, since justifying
  spreads the gaps between words unevenly. A reader who wants the look of a
  printed Bible turns it on.
- **It reaches the Study Desk's LIT panes too**, like the face and the
  size, since it replaces E106 there (below): it is typography, not one of
  the marks each pane keeps.

### The Reading layout retires

/desk's Reading layout (E8) goes (BVJ, “Retire it”). Claude had first
recommended that Reading follow the Justify switch like every Display
setting; BVJ: “By its very nature, it has its own default settings. If we
don't want that, then there's no point in having it at all,” and asked
whether to give it its own remembered settings or retire it, since one
pane does the same. Claude recommended retiring it:

- **What Reading did, the desk already does.** Its LIT pane scrolls the
  whole New Testament, the reason Read View retires (BVJ, 2026-10-21), so
  one pane reads a whole book. And every LIT pane keeps its own marks
  (E108: "Show ▾" on its bar, saved with the pane in the layout, out of
  Chapter View's reach), so a pane whose marks are set once stays that
  way. Reading's only difference was its starting point, marks off and the
  prose justified, and the Justify switch now gives every reader the
  second.
- **It cost a layer of rules of its own**: the mark that tells it from One
  pane (E107), turning the marks off and restoring only those on leaving
  (BVJ, 2026-11-04; DK3-2, LV3-2), the undo bar naming them, and the
  `&layout=reading` arrival (E114). Remembering its own settings would
  have added a third set, beside the page's and each pane's, and a reader
  would have to know which a switch changes.
- **Featherboa's plain page is quieter than the one Reading was built
  for**: small deep-green numbers and footnotes only on a press (above),
  and proposal 13's one "Your marks" switch, still on the H key.

So the Layout window loses its "Reading" row; E106's justification of
Reading alone becomes the Justify switch everywhere; and the links that
stood for Read View (the search's second jump and the picker's footer,
E114) open the desk at the passage like every other link into it, keeping
the reader's own layout (BVJ, 2026-11-02: a link never forces an
arrangement). Their words are settled with proposals 12 and 16: the
search's second row reads "Open in Study Desk" ("Search"), and the new
picker has no such row ("Finding a passage," no "Read the whole book"
row).

Proposal 14 ("A whole book: a switch, not a second site") argued against
Read View's retirement, with a Chapter / Whole book switch on the reading
page. BVJ decided it another way: every chapter reads on into the next ("A
whole book"), which leaves Reading as redundant as before.

## Beside scripture: the verse menu and the Notebook (decided 2026-11-26)

Design Directions' proposal 11, "Beside scripture: a margin, not a
dashboard." The verse menu and the Notebook panel are where study begins,
and both ask a lot before giving anything: the menu is ten rows of equal
weight, and the panel opens on four tabs, a storage notice with a checkbox,
a pill, and a badge. The proposal leads with the four things people do to a
verse and lets the panel be only about the page the reader is on. BVJ took
it point by point (“1, yes,” then 5, 6, and 7, then 2, 3, and 4 once they
were worked through). Already settled elsewhere: "Notes" without "My" and
icon with word ("Controls"), the four highlighter colors ("Color"), the
storage notice as the panel's foot line and the stage badge leaving the
panel for the foot of the Study sidebar ("Nothing interrupts the reader").

### The verse menu

- **Four actions across the top, icon and word: Highlight, Note, Bookmark,
  Copy.**
- **Each does its usual thing in one press, then shows its choices beneath
  it** (“5, yes”):
  - **Highlight** highlights in the last color used, then shows the four
    colors and Remove, so highlighting stays one press, as today.
  - **Bookmark** adds one to a verse that has none; on a verse that has one,
    it shows the choices of today's "Bookmark ▸" flyout (BVJ, 2026-11-04):
    Remove, Edit, Add another that moves or stays put, and Leave it here.
  - **Copy** copies the text, then offers Copy link and Copy with footnotes,
    so E39's three copies stay together.
  - **Note** opens the editor.
- **Rows below**: Add to sheet…, Add to collection…, Share… (Share text…,
  Share image…, and Print), and **Show in Notebook last**, the one-press
  way to This verse, which stays (below). The proposal dropped Show in
  Notebook along with This verse.
- **The selection panel matches** (“6, yes”), as BVJ's rule has it
  (2026-09-29): the same actions under the same names in both.
- **Where the Study Desk is off (phones)**, Highlight, Note, and Bookmark
  have nothing to work with, so the top row would be Copy alone. Proposal
  15 draws it as a sheet at the thumb with Copy text, Copy link, Share
  text…, Share image…, and Copy with footnotes, and **revisits Share**
  (“7, yes, with revisiting share at 15”): on a phone its two actions stand
  alone, with no Print ("The phone").

This replaces E39's "Copy text" split row and the Share flyout as the
menu's layout, and E112's order of the Notebook's rows.

### The Notebook panel

- **Four tabs, in BVJ's order: Notes, Footnotes, This verse, Greek** (“yes
  but in this order”). Notes, Footnotes, and Greek each list the chapter one
  kind at a time; This verse gathers every kind for one verse. **Greek has
  since left the panel**, so it is Notes, Footnotes, and This verse ("Study
  and its places").
- **The panel takes the margin's column** (“1, yes”): while it is open, the
  reader's notes are its Notes list rather than beside their lines, and
  closing it brings the margin back.
- **A footnote letter opens its footnote floating beside its line whatever
  the panel shows** (“2, yes”), as in "The reading page," now over the
  panel. The Footnotes list doesn't scroll or change, so a reader can read
  one footnote in the list and another floating (BVJ: “a user might want to
  see two footnotes at once”). The floating footnote **drags aside by its
  header**, as the verse menu and the selection panel do (BVJ, 2026-10-14),
  and keeps its Pin button; pinned footnotes are listed in Notes.
- **This verse stays.** The proposal dropped it; BVJ was “most resistant”
  (“there are reasons to have it”), and it is the one place that gathers a
  verse: its words, footnotes (with Pin), and Greek; the reader's notes,
  highlights, and bookmark on it with every action they have elsewhere
  (E148); the reader's notes elsewhere that cite it (N4); the collections
  that hold it; stepping verse by verse without moving the page; and the
  gap view (E157). The last three exist nowhere else, and it passes the
  proposal's own test, being about the page the reader is on. "N more
  notes" opens it, and opening a verse's menu moves it to that verse, as
  today.
- **The Settings tab goes, and nothing in it is lost** (BVJ: “Before
  agreeing, we need a way to replace what is lost,” then yes once the title
  menu was shown):

  | In Settings today | Where it goes |
  |---|---|
  | Show (the switches) | Display, where proposal 13 merges them into "Your marks," still on the H key |
  | Where the notebook is kept | The panel's foot line, "Kept in this browser only. Back up…" |
  | My sheets, My collections | The header's Study menu and the footer's Study group, as today |
  | Print… (with notes, or with room to write) | The panel's title menu |
  | The notebook page | The title menu, and the header's Study menu |
  | Notebook actions | The title menu, and the search tray and /search, as today |
  | Take the tour | The title menu, beside "Start here" |
  | Help, Feedback | The title menu |

  **The panel's title is a menu, "Notebook ▾,"** as /desk's "Study Desk ▾"
  is today (E15; "The Study Desk" retires that one): Print…, the whole notebook, Notebook actions, Take the tour,
  Help, and Feedback. It opens over the reader's notes rather than replacing
  them, as the tab did.

## Finding a passage (decided 2026-11-26)

Design Directions' proposal 12, "Finding a passage: the place line is the
picker." Most visits start with "take me to a passage," and today that is
three tools: the "Go to passage" button (a grid with nowhere to type), the
search box in the reading row (which also jumps to a typed reference), and
/read. The proposal puts all of it in the line that already says where the
reader is. BVJ took points 1 to 3 (“1-3 yes, but without grouping the
books”), then worked through the header's "Read," search, and /read (“Yes
to all of what you just said”).

### The picker

Pressing the book's name in the place line, or G as now, opens one panel:

- **A field at the top** ("book, chapter, or verse"): typing wins over
  picking, so "rom 8" offers "Go to Romans 8" at once and Enter takes the
  reader there. It is forgiving ("jn 3 16," "1 cor 13," "romans") with the
  guesser the 404 page already uses, and "Matthew intro" offers the
  introduction (E123).
- **When what is typed isn't a passage**, the last row is "Search for
  ‘forgiveness’," and Enter runs it, so typing never dead-ends.
- **Continue reading is its first row** ("Nothing interrupts the reader").
- **All 27 books in canonical order, with no groups** (BVJ: “There's no
  reason for that,” of the proposal's "Gospels and Acts," "Letters," and
  "Revelation"), fitting the panel with no scrolling.
- **The chosen book's chapters as a grid**, with its introduction under it.
- **Drafts as today**: a book or chapter still being translated is dimmed
  and still opens (its page shows how far along it is), now with the words
  "in progress" beside it.
- **No "Read the whole book" row**: since proposal 14 every chapter reads
  on into the next ("A whole book").

Keys stay: G opens the picker, / opens Search, and the arrows turn the
chapter. On a phone the picker opens from the chapter's name in the top
row, as a sheet rising nearly to the top ("The phone").

### The ways in, and /read

- **"Read" in the header opens the picker panel** on a computer with
  JavaScript. BVJ called the idea “good overall” and asked how people would
  then reach /read (“We could potentially rename the /read page if that
  would help differentiate”); the answer was to split the page, so the
  panel is all /read is for.
- **/read becomes the picker at full size**, which is also where "Read"
  leads without JavaScript. Home has the picker too (the front page, drawn
  last).
- **The license gets its own page, "License,"** under About and in the
  footer, with the owner's words unchanged. Today it sits folded at the foot
  of /read, which "Read" doesn't name. The old addresses (`/read#license`,
  `#license-terms`, `#sblgnt-disclaimer`) forward to it, because the apps
  and the Study Desk link them; BDR points the apps' link at the new page in
  a later release, and the forwarding covers installed apps meanwhile. The
  repo's own links (`LICENSE`, `CONTRIBUTING.md`, `public/llms.txt`, the
  Terms and About pages) move when it is built.
- **The rest of /read goes where its subject lives** ("Nothing interrupts
  the reader"): Continue reading is the picker's first row, "Latest text
  changes" stays on Home and with Release Notes, "Ways to read" goes to the
  front page, and Read View's card goes with Read View. This replaces BVJ's
  first answer to the proposal's point 2, that the rest of /read stays below
  the picker.

### Search on a reading page

- **The reading row's search box goes**, and **"Search" (magnifier and
  word) joins the place line**, ordered Search · ‹ › · Notebook, with "Open
  in Study Desk" (the name proposal 21 kept). BVJ: “In the same line with the arrows
  and Notebook would only be about a 1/2 inch lower, so people looking at
  the top right would still see it, and it would be clearly tied to the
  text.” Claude had recommended the header, on every page, and agreed.
- **Pressing it, or /, opens the field in place of the line**, as the phone's
  row does today (audit F3), reading "Search the LIT, or go to a passage,"
  with results dropping below, verses first.
- **One way in per page holds** (audit U6): a reading page's is the place
  line's Search, and every other page keeps the header's magnifier.
- BVJ's reason it can't live only in the picker: “having it buried in the
  passage picker feels... well, buried.” What search finds and how its
  results look is proposal 16's ("Search"): the same rows as /search.

## Display (decided 2026-11-26)

Design Directions' proposal 13, "Display: the settings a reader changes, and
a door to the rest." The "Aa" tray is one of the best things on the site,
but with the Study Desk on it has become the place everything goes: 24
controls, "Reset widths" and a lettering choice for notes among them. The
proposal keeps the tray for what changes how the page reads and moves the
rest to a settings page. BVJ took it (“1, yes ... 4, yes”), then settled the
widths (“Keep dragging”).

### The tray

- **Text: Default, Atkinson, OpenDyslexic**, each set in its own face as
  today. The default keeps the name "Default" (“1, yes”): the proposal's
  "Book" named a book face, and the reading face is Source Sans 3.
- **Size: four steps, drawn as a small A, four dots, and a large A** in
  place of S, M, L, and XL, which are letters to decode. To a screen reader
  they are four labeled choices (Small, Medium, Large, Extra large).
- **Line spacing: Normal or Roomy**, then **Justify** directly under it,
  since it is about how the lines sit (“3, yes”; the switch is "The reading
  page"'s, off by default).
- **Theme: Auto, Light, Dark** ("Night").
- **View: Verse numbers, Footnote letters, Key terms, and Your marks.** The
  heading is "View," not "Show," by "Controls"' renames. **"Your marks"**
  merges today's My bookmarks, My highlights, Notes in the margin, and Hide
  my marks into one switch, and H still flips it ("Hide your marks (H)").
  It is "Your," not the proposal's "My" (“2, yes”): it sits beside the
  translation's own marks, so it needs a word for whose, and "Your" is what
  the margin's notes say ("Your note · verse 5"). The finer choices (only
  highlights, say) are in All settings. **"Verse numbers" became "Verse and
  chapter numbers"** with proposal 14, the desk's own name for its pane's
  switch, since it hides the chapters' headings too ("A whole book").
- **"All settings →"** at the tray's foot.
- **"Show the Notebook" is the Notebook button itself**, on the place line,
  and **the notes' lettering is gone** with Playpen Sans ("The reading
  page").

No reader loses a setting.

### All settings

**One page every reader can reach from the tray, showing the Study Desk's
parts only where it is on** (“4, yes”). The proposal put it "in Study," but
it holds the keyboard-shortcuts switch, and shortcuts work for every reader,
desk or not; that switch is required (WCAG 2.1.4, for speech-recognition
users). Its other parts are the finer mark choices, backup, and a link to
the account pages, which it doesn't replace (proposal 25). Proposal 22 adds
the Notebook panel's start setting and, last, Delete in bulk ("The
Notebook").

### Widths: dragging stays, and "Reset widths" goes

BVJ: “'reset widths' needs to be available on the page that's being reset.
In this artifact, is it undoing the ability to change column widths by
dragging, etc.? If so, we should talk more.” It was: "Sizes, space, and the
measure" fixed the three columns, while this proposal still moved "Reset
widths" to All settings. Decided (“Keep dragging”):

- **The reader still drags the reading page's lines** (the text column,
  their notes' margin, the Notebook's edge), each with its menu of steps and
  its own reset (BVJ, 2026-10-14; E189). The 220, 660, and 320 are where
  every page starts.
- **The text column drags only within 45 to 75 characters a line**, the
  range proposal 4 cites, so lines can be shorter or a little longer but
  never too long to read well.
- **"Reset widths" leaves the tray and goes nowhere.** Each line's own menu
  is the local reset BVJ asked for, and the widths are kept only for the
  visit anyway.

## A whole book: continuous chapters (decided 2026-11-26)

Design Directions' proposal 14, "A whole book: a switch, not a second site."
Read View, a whole book on one page, lives at its own address with its own
toolbar; the proposal makes it one switch on the reading page, "Chapter |
Whole book | Focus," with a title page, the chapter numbers as green
numerals in the text, and a thin progress line under the place line. Read
View retires at launch (BVJ, 2026-10-21; `STUDY-DESK-FIXES.md`, E8), which
BVJ reaffirmed at proposal 10, so Claude recommended holding to that and
sending "Read the whole book" to the Study Desk's text pane. BVJ took
another angle: “retire chapter view. The main reason to keep it was to have
all the footnotes in one place. The footnotes tab now does that. The more
recent addition is the ‘Go deeper’ section. The this verse tab handles
that.” Of the two ways to build that, BVJ chose “Continuous chapters,” then
settled the rest point by point.

### Chapters that read on

- **Every chapter keeps its address and opens as itself** (`/luke-3`,
  `/luke-3#v16`). With JavaScript the page doesn't stop at the chapter's
  end: the next chapter loads below as the reader nears it, and the previous
  one above when they scroll up, as the desk's text pane does today
  (`src/lib/desk-corpus.mjs`, `desk/lit-pane.js`). The place line and the
  address follow the chapter in view, and Continue reading keeps following
  the verse at the reading line, which is the proposal's "returning reopens
  where the reader stopped."
- **It needs no Study Desk**, so phones and tablets read straight through
  too. Without JavaScript a page is one chapter, with the way on at its
  foot.
- **The address changes without adding to the browser's history** (“b,
  yes”): Back leaves the book for wherever the reader came from, rather
  than stepping back a chapter at a time.
- **The place line's arrows still step through chapters** (“a, yes,” asked
  as “with the arrow buttons in the places bar still able to skip through
  chapters?”): ‹ › go to the start of the previous or next chapter, loading
  it first if it isn't on the page, and so do ← → and [ ].
- **Previous and Next in large type** ("The reading page") appear at the
  book's end ("John 1 →" after Luke 24) and, without JavaScript, at each
  chapter's foot.
- **Why not one page per book**, the other build. The chapter addresses
  are on every verse link already out there (shares, release notes,
  emails, the Collective's site, and each verse image, which prints
  "litbible.net/john-3"), and the apps' link files open `/<book>-*` in an
  installed app (`public/CLAUDE.md`); a book page would need a forwarding
  script for them and an app release from BDR. Luke with its notes would be
  about 1.1 MB, against about 150 KB for a chapter (the 2026-11-16 build;
  Read View's Luke, with no notes, is 450 KB). Link previews and search
  entries stay one per chapter. The book page's only gain was the
  whole-book browser tools (Ctrl+F, Read Aloud, page translation, printing
  a book), which BVJ let go on 2026-11-02 (E8).
- **What either build costs**: every tool on the page works across
  chapters (the verse menu, footnotes, key terms, and the Study Desk's marks
  and margin notes), as they already do in the desk's text pane.

### Between chapters

- **Only the next chapter's heading** (“1, yes”), **set close, as the desk's
  text pane sets it** (BVJ: “I'd rather not have such a big gap between
  chapters. I was imagining it laid out closer to how the LIT Pane does
  it.”). In the mock it was "James 2" in Fraunces at about 23 pixels, 32
  pixels below the last line and with no rule under it: 88 pixels from one
  chapter's last line to the next one's first, against 141 for the first
  drawing, which had a rule and more space. **The drop numeral goes** (“Yes,
  all three”): the heading names every chapter, so the numeral said the
  same thing twice ("The reading page"). Paper keeps it, since a print is
  one chapter ("Off the screen"). The footnote list and Go
  deeper leave the reading flow on the screen. The list stays in the page
  for printing, and both stay for readers without JavaScript and for the
  desk, which reads them from the chapter's page (`desk/chapter-page.js`).
  Where the Notebook panel runs (a computer with the Study Desk), they are
  its Footnotes tab and This verse's "This chapter," which already shows
  the chapter's Go deeper rows; a margin footnote's "In the notes ↓" opens
  the Footnotes tab at its note. The panel is the desk's; on a phone or
  tablet the heading's Go deeper opens a sheet (a panel on a tablet) with
  "Go deeper" and "Footnotes" tabs ("The phone").
- **"Go deeper" sits at the right end of each chapter's heading**, and
  opens the Notebook on This verse, scrolled to "This chapter" for that
  chapter. BVJ asked for “a ‘go deeper’ control somewhere more visible that
  takes the user to it on the tab,” then wanted to see it first; a mock of
  James 1 running into James 2 drew three places for it: the heading, the
  place line (one button for the chapter in view), and the margin beside
  the chapter's start (with what is there: "1 episode · 16 key terms ·
  Introduction"). BVJ: “the heading definitely looks the best,” and took
  it with the close break (“Yes, all three”). It names its chapter by where
  it sits, adds no height, and works the same at every width, where the
  margin's needs a margin and the place line's was crowding the line.
- **The Verse and chapter numbers switch hides the headings too** (BVJ:
  “Maybe the option to toggle the verse/chapter numbers (which would
  include headings) is enough of a solution there,” then “Yes, all
  three”), as the desk's text pane's switch already does (E108). With it
  off, the chapters run on with an ordinary paragraph's gap, as one long
  passage; the headings stay for screen readers and come back into view
  when a keyboard reaches them, as on the desk. Go deeper hides with its
  heading and stays in This verse, and the place line and the progress
  line still say where the reader is. The switch takes the desk's name
  ("Display," below).
- **Footnote letters start again each chapter**, as today, and the
  Footnotes tab lists the chapter in view (“d, yes”).
- **A chapter still being translated loads as the desk's text pane loads
  it** (“c”): a run of drafts in one book is one entry, headed "Luke 23–24"
  (or "Acts" when the whole book is in draft), saying the chapters are still
  being translated. Its line about the Greek stays, pointing to the
  Notebook's Greek tab where the panel runs (BVJ: “the Greek tab is still
  relevant here”), since the desk shows the Greek of draft chapters (BVJ,
  2026-10-13). A draft asked for by name, from the picker or its address,
  still opens its own page ("Finding a passage"). **The line now links to
  the chapter's Greek in Study**, since the Read page's panel has no Greek
  tab ("Study and its places").

### The progress line

**Kept** (BVJ: “Keep the progress line if possible”): a thin green line
along the place line's bottom edge, in place of its border, so it adds no
height. It fills as the reader moves through the book, measured in verses,
so a long chapter counts for more. The place line names the chapter, so
screen readers skip the line. On a phone it runs along the top row's
bottom edge and hides with it ("The phone").

### The rest of the proposal

- **Printing stays one chapter with its notes**, the chapter in view (“3,
  yes”).
- **"Read the whole book," the switch, and the title page aren't needed**
  (“4, yes”): any chapter reads on.
- **The introduction keeps its own page** (`/mark-intro`; BVJ: “go with
  your recommendation”), with "Introduction to Mark →" at the top of
  chapter 1 and the picker's row under the chapter grid ("Finding a
  passage"); the introduction ends with "Mark 1 →" into the text. On the
  screen above chapter 1 it would be several screens to scroll past (Mark's
  is about 550 words, Romans' about 1,200); folded open in place it would
  sit between the reader and chapter 1, and on two pages, so the site's
  search and search engines would find it twice. Its own page keeps its
  address, which search's "Book introductions," Go deeper's "Book" row, and
  the apps open.
- **Focus retires** (BVJ: “I'm thinking we can probably retire ‘focus’”;
  Claude agreed): neither Read View's (every paragraph but the one being
  read dimmed) nor the proposal's (the header and place line fading).
  /privacy's line about it goes too.
- **Read View still retires** as E8 planned, its addresses forwarding to
  the chapters (`/read/<book>` to chapter 1, `#ch-N` to chapter N).
- **One reading page replaces the owner's 2026-09-30 rule** that Chapter
  View and Read View decide where a new tool goes (root `CLAUDE.md`, "Key
  Conventions"): a tool about a verse or a word goes on the reading page,
  which now reads straight through. Chapter View's name was already going
  (E33).

## The phone (decided 2026-11-26)

Design Directions' proposal 15, "The phone: one row above, one bar at the
thumb." On a phone today four rows come before the first verse (the app
banner, the header, the picker and search row, and the title with its
arrows), and John's first word sits about 300 pixels down an 812-pixel
screen: “A phone is where most people will meet this translation. Give them
the text.” The proposal draws one row above, a bar of four below, the menu
as a sheet from the bar, and the verse menu and a footnote as sheets at the
thumb. Claude recommended it with ten adjustments, and BVJ took them all
(“Yes, 1–10”). It settles what proposals 10 to 14 left to the phone.

### The two bars

- **One row at the top: the emblem (home), the chapter's name as the picker
  ("John 1 ▾"), and Aa.** The proposal starts verse 1 82 pixels down. The
  name "LIT Bible" leaves the reading page's top row; the emblem is the way
  home.
- **A bar at the bottom: Previous · Search · Menu · Next**, four targets of
  44 pixels with a word under each. **"Previous," not the proposal's
  "Back"**: the button goes to the previous chapter, and "Back" reads as the
  browser's Back, which leaves the book ("A whole book").
- **Both hide together on a scroll down and return on any scroll up**, one
  rule, as Safari does with its own two bars; the proposal hid only the
  bottom one. The timing is "Motion"'s.
- **This replaces** today's one-row toolbar on a phone (audit F3, owner
  2026-09-28), the round ‹ › beside the title “at every width” (owner,
  2026-10-14) there, and the title row itself.
- **The app banner stays above the row** ("Nothing interrupts the reader").
  The proposal's 82 pixels are drawn without it; on Android it adds about
  60 until dismissed for 90 days, and on an iPhone Safari draws its own
  banner above the page.
- **The progress line runs along the top row's bottom edge**, as on a
  computer, and hides with it ("A whole book").
- **Search opens the field in place of the top row**, results below and
  verses first, as the place line's does on a computer ("Finding a
  passage") and the phone's row does today.
- **"John 1 ▾" opens the picker as a sheet rising nearly to the top**: the
  typing field first, then Continue reading, the 27 books, the chapter grid,
  and the introduction ("Finding a passage").

### The menu

- **A sheet rising from the bar**, not today's panel from the top corner.
- **Its rows wait for proposal 19** ("Four places," where the proposal's
  Read, Study, Learn, and About come from), then "Get the app" ("Nothing
  interrupts the reader").
- **Today's "Continue" button leaves it**: Continue reading is the picker's
  first row ("Finding a passage").
- **A page without the bar keeps the header's menu button**, which opens the
  same sheet from the bottom, so the menu looks the same everywhere.

### Beside the text

- **The verse sheet holds the five actions**, since a phone has no Study
  Desk (so the proposal's "where Study is on" never happens there): **Copy
  text, Copy link, Share text…, and Share image…** across, with icons, then
  **Copy with footnotes**. The names are the computer's, by BVJ's rule that
  an action has one name everywhere (2026-09-29; E39, E111); the proposal's
  were Copy, Link, Share, and Image. In OpenDyslexic a label may take two
  lines. The selection panel matches, as today.
- **Share, revisited** (as BVJ asked with proposal 11): on a phone, Share
  text… and Share image… stand on their own, with no "Share…" group and no
  Print, since the phone's own share sheet offers printing. The computer
  keeps Share… with Share text…, Share image…, and Print ("Beside
  scripture").
- **A footnote opens as a sheet**, the phone's margin, as tall as its note
  needs up to about half the screen; it drags up to full height and scrolls
  inside, and the word it belongs to stays marked. **No "Read the whole
  note →"**: BVJ required the whole note right there, never a trip to the
  page's foot ("The reading page").
- **All of a chapter's footnotes, and its Go deeper**, which "A whole book"
  left to this proposal: the chapter heading's "Go deeper" opens a sheet for
  that chapter with two tabs, **"Go deeper"** (Listen, Read, Key terms, and
  Book) and **"Footnotes"** (the chapter's whole list, each note whole), and
  a footnote's sheet links to that list. Tablets, which have no Notebook
  either, get the same, drawn as the panel over the right edge that "Sizes,
  space, and the measure" gives them.

### Without JavaScript

The bar is plain links and doesn't hide (the site's rule that every page
works without JavaScript): Previous and Next go to the chapters, Search to
/search, and Menu to the footer's links, and "John 1 ▾" goes to /read, the
full-size picker ("Finding a passage").

## Search (decided 2026-11-26)

Design Directions' proposal 16, "Search: one field, answers first."
Search works well and looks like a form: on /search today (Site 2.0's two
panes, with the preview on) a sort control, two filters with help buttons,
a list of result groups, a passage picker, a title, an instruction, and
checkboxes for sheets all come before the first matching verse. The
proposal makes the field the page, puts results directly under it, and lets
tabs do the filtering. Claude recommended it with ten adjustments, and BVJ
took them all (“Yes, 1–10”). Site 2.0's /search (“Yes to two panes,” in
its quieter redraw) was the other option and is not taken.

### The page

- **The field is the page**, with the count at its right end ("75
  results"). The visible title and the instruction go; **a "Search"
  heading stays for screen readers**.
- **One row of tabs under it does the filtering**: **Scripture**,
  **Chapters about it**, **Glossary**, **Articles**, **Introductions**, and,
  with the Study Desk on, **My Notebook** and **Greek** (below). They
  replace the type filter, its help button, and the list of result groups.
  **Every tab shows its count**; a tab with none reads 0 and is dimmed. The
  page opens on Scripture, or on the first tab with results when Scripture
  has none.
- **"All books ▾" and the sort sit at the row's right end.** **Relevance
  stays the default**, as today (exact forms above related ones, so
  "liberation" lists its own verses before "liberate"'s); the menu's other
  choice is **"Bible order,"** today's "Book order." **Book headings appear
  only in Bible order**; under Relevance each verse stands with its
  reference.
- **Results are reading**: each match is the verse in the book face with
  its reference, the matched word bold with a green underline. **No
  sunshine on a match**: yellow means "yours" ("Green is ink").
- **"Chapters about it"** is today's "Topic matches," the proposal's name
  kept. It avoids the word "topic," so it holds if topics become tags.
- **On a phone** the tabs scroll sideways in one row, with the book and
  sort menus on a row under them.

### Answers first

- **A reference goes there**: typing "john 3:16" makes the first row "Go
  to John 3:16," and Enter takes the reader there, as the picker's field
  does ("Finding a passage"), so /search carries no passage picker of its
  own. With the Study Desk on, **the second row stays "Open in Study
  Desk"** at the passage, under the name proposal 21 kept ("The Study
  Desk").
- **Over the verses, one line for the chapters**: "John 1 is one of 6
  chapters about light," with "See all 6 →" opening that tab.
- **The glossary still answers first.** Today its matches sit at the top,
  and a tab would hide an entry behind a click, so when a glossary term
  matches what was typed ("trust," "logos"), one line sits above the
  verses as the chapters line does: "Trust is in the glossary →".

### Kept from today

- **Book introductions keep a group of their own**, now the
  "Introductions" tab, so an introduction is never mistaken for scripture
  (owner, 2026-07-09). The drawing had left them out.
- **With the Study Desk on, the notebook stays in search**: the "My
  Notebook" tab (matches in the reader's own notes), the "Notebook
  actions" link in the field's row, and ">" in the field offering commands.
  The drawing had left out all three.
- **The Greek tab shows only where the Greek search runs**, with the Study
  Desk on, as today; a Greek word or a Strong's number typed there opens
  it.
- **Underneath, nothing changes**: the verse index, Pagefind, and the Greek
  search. The page links stay, and so do the "Showing results for
  ‘jerusalem’" note, related forms, and the topics a chapter matched.

### Sheets

**"Select" sits at the right end of the tab row, with the Study Desk on
only.** The proposal said "the page's menu," which /search doesn't have.
It puts a box on each row of Scripture and Chapters about it, and a bar at
the foot reads "3 chosen · Add to a sheet… · Cancel." A reader who is only
looking sees no boxes. One verse still goes to a sheet from its own verse
menu.

### The same rows everywhere

**The results under a reading page's Search and the header's magnifier use
the same rows** as /search: the verse in the book face, the word bold and
underlined, with book headings in Bible order. Their "See all results →"
opens /search on the same tab.

## The glossary and articles (decided 2026-11-26)

Design Directions' proposal 17, "The glossary and articles: show the
choice being made." The glossary is the heart of the project's argument:
for each of its words, what tradition says, what the Greek says, and what
the LIT says instead. Every entry already has that shape in its data
(`traditional`, `greek`, `lit`), and the page should have it too. Articles
and book introductions take the reading page's column, margin, and faces.
Claude recommended it with ten adjustments, and BVJ took them all (“Yes,
1–10”). Site 2.0's choices (the glossary's list of entries in a left
column, an article's picture edge to edge, an introduction's headings
beside the text) were the other option and are not taken.

### The glossary page

- **One page, read on, with the chapters' line.** /glossary stays one page,
  each entry at its anchor. The line at the top reads "Learn / Glossary ▾
  / trust," naming the entry in view; "Glossary ▾" lists the entries (in
  place of today's jump list), and ‹ › step from entry to entry. The
  drawing could be read as a page per entry; one page keeps every
  `/glossary#faith-trust` link working (the term lens, Go deeper, the
  Notebook's Greek tab, the release notes, the home page), and a reader can
  still read straight through, as the page's opening invites.
- **BVJ's opening words stay at the top.** Their third paragraph describes
  today's styling ("in bold… In italics… Underlined…"), so Claude drafts a
  replacement for BVJ to approve or rewrite (Open, below).
- **Both orders stay**, by the LIT word or by the traditional word, as a
  switch at the top of the "Glossary ▾" list; the page follows it.
- **The copy-link button stays** beside each entry's pair, as today.

### An entry

- **The pair is the headline**: "Traditionally" and the traditional word,
  lighter and gray, beside "In the LIT" and the LIT's word in full weight.
  **No arrow, no strike-through** (today's ink scribble through the
  traditional word goes): two words side by side make the argument
  without editorializing. The gray still meets 4.5:1, like every word on
  the site.
- **The LIT side is as the entry has it**: "trust / faithfulness" keeps
  its slash (the drawing had a comma), each word on its own line on a
  phone as today, and a note such as "(prepared for sacred purposes)" sits
  under the word. Where the LIT keeps the traditional word (Demon / demon),
  the pair still shows: keeping it is a choice too.
- **The Greek spelling beside its transliteration** ("πίστις pistis")
  comes from the alignment's lemma map (`scripts/lib/glossary-lemmas.mjs`),
  which already has every entry's Greek, checked against the text. No entry
  gains a field, and the apps' glossary feed doesn't change.
- **"Where it appears" moves to the margin**, where footnotes sit on a
  chapter page, so a reader learns once that the right-hand column is
  "more about this line." It carries today's numbers, the total ("N
  occurrences") and each rendering with its count, rather than the
  drawing's first three verses; "Every place →" opens the full list under
  the entry, as today's folded list does, without JavaScript too. With no
  margin (a phone, a narrow window), the list sits under the entry as
  today.

### Articles and book introductions

- **The reading page's type and column**: a Fraunces title, Source Sans 3
  at the reading size (proposals 1 and 4, not the drawing's Literata at
  17px), and the reading measure. Footnotes go in the margin where a piece
  has them; none does today.
- **The author and date share one small line under the title.**
- **Every article keeps its picture**, under the title and byline at the
  column's width, not edge to edge. All 13 have one, each credited in
  `IMAGE-CREDITS.md`, and it is the picture a shared link shows. The
  proposal had dropped them unless the article was about one.
- **Tags move to the article's foot.**

## Off the screen: print and the verse image (decided 2026-11-26)

Design Directions' proposal 18, "Off the screen: the printed page and the
shared verse." The translation leaves the site constantly (printed for a
study group, pasted into a bulletin, posted as an image), and those are the
copies most people will ever see, so they should be recognizably the same
hand. Claude recommended it with nine adjustments; BVJ took eight and
changed the second (“The drop letters can be kept for print. The reasons
to drop it on screen don't apply.”).

### The printed page

- **The faces are the screen's** ("Type," “Same as the screen”): Source
  Sans 3 for the text and Fraunces for headings, not the drawing's
  Literata. The size stays 12pt times the reader's text size, refit to
  Source Sans 3's letter height as on the screen, and a reader's
  accessibility face prints as chosen, as today.
- **Paper keeps the drop numeral**: the chapter's number as a drop capital
  in Fraunces, beside its first lines. The screen retired it because the
  heading of each chapter that reads on already names it ("A whole book");
  a print is one chapter with nothing reading on, so that reason doesn't
  hold there.
- **A running head and a footer**, drawn with page-margin boxes, as the
  Sheets' page numbers already are. The head reads the passage ("John 1")
  and "Liberation and Inclusion Translation." The footer carries the
  address ("litbible.net/john-1") and the license's credit line
  (`LIT_CREDIT_LINE`, unchanged). A browser that can't draw page margins
  prints neither, so the credit line and address still print once at the
  end, as today, since the license asks for the notice; the SBLGNT notice
  still prints after the text.
- **Page numbers follow the Sheets' rule** (BVJ, 2026-11-10): page 1's
  centered at the foot, then at the top right. The drawing put it at the
  bottom right; this way a chapter and a handout look alike, the proposal's
  own aim.
- **Footnotes print after the chapter, whole, in two columns.** The
  proposal set them at the foot of the page they belong to, as in a study
  Bible, but no browser can: CSS's footnote placement works only in print
  engines like Prince, not in Chrome, Edge, Firefox, or Safari. A script
  that rebuilds the page into sheets before every print (Paged.js) would
  be a new dependency, slow on a long chapter, and a change to how every
  print works, so it isn't taken.
- **No note is cut.** No "Continues at…": BVJ requires the whole note
  ("The reading page"), and paper has no link to follow. With the notes
  after the text, a long note can't push scripture off a page anyway.

### The verse image

- **The verse in Source Sans 3**, as "Same as the screen" decided for the
  verse image; the drawing's Fraunces Light would have reversed it. The
  reference stays in Fraunces, as a heading.
- **One small line under the verse**, with **the address kept**: the
  emblem and "John 1:5" (Fraunces) on the left, and "Liberation &
  Inclusion Translation" over "litbible.net/john-1" (Source Sans 3) on the
  right. The drawing's line dropped the address, which BVJ counts as the
  link back the license's social-media exception asks for. **The green bar
  goes; the emblem is the green.** Inter leaves the image.
- **The rest stays**: Ink and Paper, Square and Story (Story the same
  layout, taller), the one button that asks each question in turn, the
  text set as large as fits down to a readable floor, and nothing stored.

### Handouts

A sheet printed from the Study Desk uses this same page: the same head,
faces, and footer. Leader and participant copies differ in content, never
in look. The rest of a sheet's paper copy is in "Sheets."

## The Study Desk (decided 2026-11-26)

Design Directions' proposal 21, "Study: one workspace in place of four
pages." Today the Notebook, Sheets, Collections, and the Study Desk are four
pages with four layouts, joined by links that each use a different name. The
proposal makes them one workspace: the site's header, a sidebar of the
reader's things, and scripture beside the work. Its drawing has two panes,
scripture always on the left and everything else in tabs on the right.

Claude recommended it with ten adjustments. BVJ liked much of it and asked
what was lost (“It feels like there are real costs though”). Fixed sides
lose real function: “I want to be able to see search, Greek, and LIT at
once. Or maybe Notes, Sheet, and Search.” BVJ asked for a sidebar that
folds, one, two, or three panes, Search as a real pane, panes that
switch, and widths that still drag. Then BVJ found the way to put it
together, tabs in every pane: “That way it's not really replacing
something, it's just switching tabs.” Claude drew that as a working mock
(Luke 3 with its Greek and footnotes, and a real search for "wilderness"),
and BVJ took it as drawn (“Record it”).

**"Study and its places" changes this section**: the page is "Study," the
Notebook, sheets, collections, and the Trash open as places of their own,
and what follows holds for the panes, which are now the Scripture place.

### The name and the frame

- **The workspace keeps the name "Study Desk,"** settling what "Controls"
  left open. "Desk" alone reads as furniture. Its ways in keep "Open in
  Study Desk." The header's word for the place is proposal 19's.
- **The site's ordinary header replaces the desk's own.** This reverses
  BVJ's 2026-10-21 decision that the desk has its own header at every
  width. It costs no height (today is a header plus the command row; this
  is a header plus the title row), and one header everywhere can mark where
  the reader is.
- **The title row**: "Fold sidebar" (icon and word), the page's heading
  "Study Desk," and at the right "Panes 1 2 3" and "Full screen" (the
  browser's own, E43).
- **The command row and the title menu go** (E68's row, and "Study Desk ▾").
  Each command has a home: Add pane and Layout… become the pane count;
  New sheet… and New collection… go to "New…" in the sidebar; Print… goes
  on what it prints (a sheet's Share…, the Notes tab's More menu); Display
  options is the header's Aa, as on every page; My Notebook is the
  sidebar's Notebook; Help, the tour, and feedback go to the sidebar's
  foot.

### Panes of tabs

- **One, two, or three panes**, chosen with "Panes 1 2 3" on the title
  row: always in view and in words, E68's reason for worded buttons. A
  pane is at least 280px wide. A count the window can't hold is dimmed,
  its reason ("Needs a wider window") reachable without a pointer ("The
  kit").
- **Every pane is one row of tabs**, and a tab is one thing: the LIT at a
  place (labeled with the place, "Luke 3"), Greek, Footnotes, This verse,
  Notes, a sheet or a collection (by its name), or Search. **Any kind can be
  in any pane, any number of times**: two LIT tabs compare passages, two
  sheets let a reader copy from one to the other, and two searches keep two
  questions open.
- **The row is the pane's only bar.** It holds the tabs and, at its right
  end, the open tab's one or two key actions (the LIT's ‹ ›; a sheet's
  Share… and a filled Present; in a list, the commands for what is chosen,
  "The Notebook"), then More (⋯).
- **Tabs are plain words.** The open tab in each pane is underlined in
  ink. In the pane the reader is working in, the underline is green,
  proposal 2's "you are here," and it also shows where something new will
  open.
- **× shows on hover or focus only.** Everything else a tab can do is in
  More: "Open in this pane ▸," "Move this tab to" Left, Middle, or Right
  (the keyboard's way to move it), "Pin to this passage" on a tab that
  follows, and Close. More is one of the five icons that may stand alone
  ("Controls").
- **Tabs that don't fit fold into "2 more ▾,"** and the open tab always
  shows.
- **What a pane can show is one grouped list**: Scripture (The LIT,
  Greek, Footnotes, This verse), Yours (Notes, Sheets, Collections), and
  Search on its own line. More's "Open in this pane ▸" holds it, and an
  empty pane shows it whole.

### Opening, moving, and following

- **Nothing is ever replaced, so nothing needs an undo.** Opening something
  brings its tab forward if it is open in any pane; otherwise it adds a
  tab to the pane marked green. To choose the pane, drag the item from
  the sidebar onto it.
- **Tabs move between panes** by dragging, or with "Move this tab to."
  That is how panes switch places.
- **Changing the count keeps everything.** Going down a pane moves its
  tabs into the last pane still open; a new pane opens empty, showing
  the list.
- **Following stays**: Notes (on "This chapter"), This verse, Footnotes, and
  Greek follow the LIT tab the reader last moved in, unless pinned.
- **Widths still drag** (BVJ: “keep the adjustable column widths”). Each
  line between panes has its menu of steps and its own reset, as on the
  reading page (E189), and each pane count remembers its own widths, so
  going from three panes to two and back returns the three-pane sizes.
- **A new reader starts with two panes**: the LIT, and beside it Notes,
  Footnotes, This verse, and Greek, the reading page's own panel ("Beside
  scripture"), so the desk reads as the page they know with more room.
  After that, the page reopens as the reader left it.
- **The LIT tab is the reading page's text**: chapters read on ("A whole
  book"), footnotes float in the margin ("The reading page"), and Display
  reaches it.
- **Search is a tab.** On the Study Desk the header's magnifier, or "/",
  brings the Search tab forward or opens one in the pane marked green. The
  sidebar has no field of its own, so the page keeps one way in (audit U6).
  The tab shows /search's tabs and rows ("Search").
- **A Sheets or Collections tab opens the last one the reader had there**,
  or the list when there is none yet. **Its name is a menu**: another sheet,
  a new one, or all of them.

### The sidebar

- **Top to bottom**: Notebook (its count, and a dot while there is news),
  Sheets (its count, the three most recent, and All sheets), Collections
  (the same), and Trash. At the foot: "New…," Help with "Start here" (the
  tour) and Feedback, the stage badge ("Nothing interrupts the reader,"
  item 5), and the line "Kept in this browser only. Back up…."
- **It folds to a strip of icons, each with its word** ("Controls"), and
  the page remembers whether it is folded. Three panes want a wide window
  or a folded sidebar: in the mock, at 1,163px, each pane was about 300px
  wide with the sidebar open and 360 with it folded.

### The Notebook page's tools

Each of /notebook's tools goes where its subject lives, not to the account
page: most readers won't have an account at first, and backing up matters
most for them, since their notebook lives only in their browser. With these
homes, one kind, "Notes," with "This chapter / Everything" at its top,
serves both the passage and the whole list (BVJ said yes, as long as the
tools have a home).

| Today on /notebook | In the Study Desk |
|--------------------|-------------------|
| The list and its filters (words, kind, color, label) | Notes on "Everything"; the sidebar's Notebook opens it there |
| Labels: make, rename, delete | "Manage labels…" beside the filters |
| Delete all notes, all sheets, all collections, and Empty the trash now | Choosing rows, then Delete…, for what is chosen; the four bulk deletes, which reach labels and templates too, are All settings' last section ("The Notebook," which corrects this row) |
| Back up, and Merge a backup | The sidebar foot's "Back up…," one window holding both |
| Trash (30 days) | Trash in the sidebar, opening as a tab (not drawn yet) |
| What's new for you | The top of Notes' Everything, with the dot on Notebook (news where its subject lives, "Nothing interrupts the reader"); renamed "Changed since you marked it" ("The Notebook") |
| The Notebook panel's start setting | All settings ("The Notebook"; missing from this table at first) |
| Print… | The Notes tab's More menu |

### What goes from today's desk

BVJ accepted less to customize (“Maybe not as customizable as what we
already built”):

- **8 of the 11 arrangements**: the seven with rows, and four panes. The
  fourth pane goes with them, which reverses BVJ's 2026-10-18 set of
  arrangements and the four-pane limit (`MAX_PANES`).
- **The Layout window, and Add pane with its four directions.** The pane
  count replaces both.
- **Dragging a pane onto another's edge to split it.** Dropping a tab on a
  pane moves it there.
- **"My default."** The page reopens as the reader left it.

No saved data needs moving, since the preview has one user (BVJ). A saved
layout with rows reopens as panes.

### Kept

- **Every address and link**: /notebook, /sheets, /collections, /desk, a
  sheet's `?id=`, present mode, and shared sheets' links, each opening the
  workspace on what it names.
- **Tablets and phones are proposal 26's.** The website's study tools are
  for computers.
- **When it is built is decided with the beta's launch date**, so beta
  readers learn the desk only once.

## The Notebook (decided 2026-11-26)

Design Directions' proposal 22, "The Notebook: a list beside its passage."
Today's /notebook is one long page of eight sections reached by eight jump
links, and the reader's notes are the third of them. The proposal makes the
Notebook only the reader's notes, in Bible order, each opening its passage
beside it. It was drawn before proposal 21 was reworked, so its frame (a
sidebar of its own, a search field there, and a passage pane inside the
list) differed from the Study Desk BVJ had just decided. Claude recommended
its ideas fitted into that desk, with nine adjustments, and BVJ took them
all (“Yes, 1–9”).

**"Study and its places" changes this section**: the Notebook is a place
of its own on the Study page, its passage in the pane beside it, rather
than the Notes tab on "Everything."

### The list

- **The Notebook is the Notes tab on "Everything"** ("The Study Desk").
  Kinds, colors, and labels stay a filter row in the tab (Kind ▾, Color ▾,
  Label ▾), each choice with its count ("Notes 41"). They are not sidebar
  rows, as drawn: the desk allows two Notes tabs, and a sidebar row couldn't
  say which one it filters. There is no "Search your notebook" field: the
  tab filters by words, and the header's magnifier opens Search.
- **"128 kept, in Bible order"** heads it, and Bible order stays the only
  order, as today.
- **A row carries only the reader's words**, with a small line under them:
  the kind, the date, and a bookmark's label chips.

### Select, then act

- Today every row carries Edit, Labels…, Collections…, and Delete. **Now
  clicking a row chooses it; Ctrl- or Shift-click adds more, and Space does
  the same from the keyboard.** While anything is chosen, four commands sit
  at the end of the pane's row: **Edit, Label…, Add to collection…, and
  Delete…**. Edit acts on one row, and Label… only on bookmarks (below); a
  command that can't act is dimmed with its reason ("The kit").
- **The sheets' and collections' lists work the same way.** This replaces
  the "Select" button drawn for "The Study Desk."

### The passage beside it

- **Choosing a note takes the LIT tab the reader last read in to its
  verse, with the note in the margin**: one click from “what did I write?”
  to “what does it say?” (the proposal's words). It is not a pane inside
  the list.
- **If that LIT tab shares the list's pane, the passage opens in the
  pane beside instead.** With one pane, the LIT tab comes forward and
  the list is one tab away. The drawing's toggle button isn't needed.

### Changed since you marked it

- **What's new for you is renamed "Changed since you marked it,"** the
  drawing's name. It is the filter the notice at the top of Everything
  opens ("The Study Desk"), and the dot stays on Notebook in the sidebar.
- **A changed row says "Text changed Nov 1," as a link to that release
  note**, so its green is a link's ("Green is ink"). The proposal's reason:
  a translation still being revised should tell readers when their verse
  moved, and that is one of the site's best ideas.

### Names

- **"Notebook" is the place; "Notes," "Highlights," and "Bookmarks" are
  what it holds**, and "kept" counts them together ("128 kept"). "My Notes"
  already went ("Controls").
- **"Marks" stops naming the things kept**: "Delete all notes and marks"
  becomes "Delete all notes, highlights, and bookmarks."
- **Two names stay.** The tab is still "Notes" (BVJ's choice in "Beside
  scripture" and "The Study Desk"), holding all three kinds as it does on
  the reading page. The Display tray's "Your marks" ("Display") stays too,
  since it names what is drawn on the text, not the things kept.

### Labels stay on bookmarks

The drawing puts "Advent" and "Sermon ideas" on notes. That would reverse
**E149** (BVJ, 2026-11-17: “Labels are for bookmarks”), so it isn't taken:
Label… acts on bookmarks, the Label filter's counts count bookmarks, and
renaming and deleting stay in "Manage labels…" ("The Study Desk"). The
format and the apps' sync are untouched, as the proposal says.

### All settings holds the rest

The drawing's Settings is proposal 13's All settings ("Display"), not a new
sidebar row. Two things on /notebook had no home in "The Study Desk"'s
table; Claude had missed both:

- **The Notebook panel's start setting** ("When a page opens, the Notebook
  panel is" Open, Minimized, or As I left it).
- **The bulk deletes that choosing rows can't reach**: labels, the reader's
  own templates, and "Empty the trash now."

They go to All settings, which "Display" already gave backup and the finer
choices about marks. **Delete in bulk is its last section, in red words**,
with today's four choices and what each takes: all notes, highlights, and
bookmarks (with pinned footnotes and labels); all sheets (with the reader's
templates); all collections; and Empty the trash now. Choosing rows still
deletes whatever is chosen. All settings is reached from the Aa tray, as on
every page.

### Links into it

**Every /notebook link keeps working, its anchors too**: `#backup` opens the
Back up window, `#whats-new` opens "Changed since you marked it," `#q=`
(search's link into the notebook) opens Everything filtered by its words,
`#labels` opens Manage labels…, and any other anchor opens Everything. The
help page, the first-use line, the Notes tab, and search link to them
today.

### Kept

- **Printing the list**, from the Notes tab's More menu ("The Study Desk").
- **Continue reading**, already the picker's first row and Home's
  ("Nothing interrupts the reader," "Finding a passage").
- **The Trash's 30 days**, in the sidebar.
- **The foot line says "browser,"** not the drawing's "computer," since a
  notebook is kept in one browser.

## Sheets (decided 2026-11-26)

Design Directions' proposal 23, "Sheets: the page you are making is the
page you see." A sheet is a handout, printed in a leader's copy and a
participant's copy, and the proposal calls it the most original tool in the
Study Desk. Today its editor carries a word processor's toolbar under each
part and a page toolbar of ten commands. The proposal shows the page at its
real proportions, in the site's own faces, with three commands in view.
Claude recommended it with ten adjustments. BVJ took nine, the second with a
serif kept (below), and answered the sixth, where a sheet sits in the Study
Desk, with an idea of their own, which is open ("Where a sheet sits," below).

### The page

- **The editor is the page.** A sheet is edited on the page as it prints, at
  the paper's proportions (Letter or A4), with its parts set as they print
  rather than as cards.
- **The page sits on a tinted desk, the one exception to "Surfaces."** The
  proposal's reason: here the page stands for a real sheet of paper with
  real edges. The page stays white paper in either theme, as today.
- **Where the pane holds the paper's width, the page shows as pages**,
  broken where print will break it (today's print layout, BVJ 2026-11-10).
  In a narrower pane the page fits the pane with its words at their true
  size and no page breaks drawn, rather than shrinking the type.
- **Edit and Preview (E209) retire**: the page being edited is the preview.
  The drawing's two view icons aren't taken, since an icon stands alone only
  for search, close, back, forward, and more ("Controls"), and the copy tabs
  already choose what is shown.
- **A chosen part has a green bar at its left** and shows its own controls
  in a small line at its top, as the drawn "Leader only · 10 minutes" does:
  Leader only, minutes, Move, Remove, and a passage's blanks and footnotes.
  None of it prints.
- **A leader-only part has a dashed rule and a plain label**, and is gone
  from the participant's copy.

### Formatting

- **A small bar holds Bold, Italic, Link, Paragraph ▾, and List ▾**:
  Paragraph, Heading, Subheading, and Quotation; bulleted and numbered lists,
  with indent and outdent. **"More formatting ▾" holds the rest**:
  Underline, Strikethrough, Superscript, Subscript, Alignment, Style (font,
  size, text color, and background), Horizontal line, and Clear formatting.
  BVJ's set (2026-10-18) stays whole; only the first look is quieter. The
  proposal would have made font, size, color, and alignment the site's to
  set, with "More formatting" as its fallback if BVJ kept them.
- **The bar shows whenever a part has the cursor**, not only over a
  selection, since Paragraph and List act where the cursor is. Tab from the
  text reaches it, and it never covers the words being chosen. It replaces
  today's toolbar under the part (SH5-6).
- **Style's fonts are Source Sans 3 (the default), Literata, Fraunces, and
  Atkinson Next.** BVJ kept a serif for a sheet's words: “keep either
  Crimson Text or Literata as a serif option for readers. (Fraunces isn't
  good for body text).” Claude picked Literata of the two: it was made for
  reading at length on screens, its small letters stand nearer Source Sans
  3's, it has the Greek with its accents (Crimson Text has none, so a Greek
  word falls back to another face), and one variable file serves every
  size. A leader chooses it for their own handout; the site's own reading
  face stays sans ("Type").
- **"Sans" (Inter) and "Handwriting" (Playpen Sans) leave the format's
  set**, since those faces leave the site and nothing outside it reads them
  (BVJ: “The apps haven't built anything with sheets yet, so no need to keep
  anything for the apps' sake”). A stored one, which only the preview's
  sheets can hold, shows in the default face. "Serif" is drawn in Literata.
  This changes the set in `STUDY-DESK-FORMAT.md` ("can grow later … but
  never shrink") when it is built.

### Names

- **"Leader's copy" and "Participant's copy," everywhere on screen**: the
  copy tabs over the page, the page's title, Copy's status, a saved file's
  properties, and the Share dialog's choice. This undoes half of E95, where
  the screen says "Leader version" and the paper "Leader copy." The paper
  keeps the other half: the leader's says "Leader's copy," and the
  participant's says nothing.
- **"Key terms box" becomes "Key terms"** in the Add row.

### Commands

- **Three stay in view: Print…, Share…, and a filled Present**, at the
  right end of the sheet's row ("Study and its places").
- **More (⋯) holds the rest**: Copy, Save as ▸ (the documents and the
  slides), Show QR codes, Import, Save as template, and the paper (Letter or
  A4), as drawn, and also the sheet's text size (E101) and Add answer key
  (on the participant's copy only, and never remembered, E102), which the
  drawing left out.
- **The Add row at the page's end**: Passage…, Text, Question, From my
  notes…, Space to write, Page break, and Key terms. The drawing drops Page
  break; it stays. Adding between parts stays too.

### Starting one

**New sheet… lists the seven templates, each with one line on who it is
for**, as today's chooser does. The template's longer description stays a
notice in the editor (E84).

### Present

- **The room's screen stays dark in either theme**, with today's strip:
  ‹ ›, Reveal, Footnotes, Blank, the screen count, Presenter view, and
  Close. The presenter view and its minutes are kept.
- **Its words are Source Sans 3 and its titles Fraunces**, as on paper. The
  drawing set the verses in Literata.
- **A blank stays covered until it is revealed.** The drawing shows the
  words not yet revealed in gray, which would let the room read a blank's
  answer before Reveal.

### Kept

- The License card and the commercial check (E94), the "what prints"
  notice, sharing and its dialog (with "Include the answer key"), "Import
  into my notebook" as a shared sheet's one filled button, the warning when
  another tab has the sheet open, and undo.
- **The Sheets tour (E63) is rewritten** for the new page.

### Where a sheet sits

Claude's sixth adjustment fitted the drawing's frame into "The Study Desk":
the sheet a tab in any pane, Print…, Share…, and Present at its row's
right end (where that section allows one or two actions and puts Print in
Share…), and the template's name and "saved" beside the copy tabs. BVJ
answered “Maybe”: a full page at real proportions won't fit in three
panes. BVJ's idea: “clicking sheets in the sidebar should give the page
its own layout, with one tab that's flexible, and the size of one column in
the three column layout, and one tab that's the sheet editor, and the size
of two columns in the three column layout.” **It grew into places: a sheet
opens as a place of its own on the Study page** ("Study and its places").

## Study and its places (decided 2026-11-26)

This settles where a sheet sits ("Sheets"), and with it how the Notebook,
collections, and the Trash open. BVJ's idea was a layout of a sheet's own,
since a page at the paper's proportions won't fit beside two more panes.
Then, from the proposal's drawing, where the sheet is the only pane, BVJ
asked whether a sheet should always be shown that way, whether the Notebook
should too (“I know we decided to have that button just bring up the Notes
column, but we can revisit it”), and where collections fit (“Let's
explore”). Claude drew the "places" model as a working mock. BVJ liked it
“as drawn for the most part,” renamed the page, gave a sheet its
collections, and said “Take everything else.”

A *place* here is one of the things the sidebar opens. The word is the
record's, not a label a reader sees, and proposal 19's "Four places" are
the header's.

### The names

- **The page is "Study."** BVJ: “I don't think the page needs to be called
  Study Desk or even Desk anymore. It can just be the study page.” The
  header's "Study" (proposal 19's word) leads to it. **This reverses "The
  workspace keeps the name 'Study Desk'"** ("Controls," "The Study
  Desk"). Only what a reader sees
  changes: the help page (about fifty mentions), the tours, the account
  pages, Privacy (four), and the Terms of Use (one). Code and records keep
  the old name (`desk-*`, `data-desk`, `STUDY-DESK.md`).
- **The title row has no heading** (BVJ: “I don't think it needs the word
  ‘study’ at the top as a title. It's already visually tied to the word
  ‘study’ by the underlined ‘Study’ in the header nav.”). The row holds
  "Fold sidebar" at its left and the pane count and "Full screen" at its
  right. A place's name is its pane's title ("Advent 2 handout ▾"), and
  the sidebar marks the place. The page keeps "Study" as a heading for
  screen readers, out of sight, since every page has one.
- **The word is "pane," not "column"** (BVJ: “Panes”). BVJ asked: “Is
  ‘Columns’ the right word to use? ‘Panes’ or ‘Sections’ could also work.
  A column could be two columns of the same text, like on a document.”
  Claude agreed and recommended "Panes": a pane divides the window, not
  the text (a mail program's reading pane), so "Panes 1 2" over a sheet
  can't read as setting the page in two columns, and the preview and its
  help page already say "pane." "Sections" suggests parts of a document,
  and "panel" is the Read page's Notebook panel. So the title row reads
  "Panes 1 2 3" ("Panes 1 2" in a place), More says "Open in this pane ▸,"
  and an empty one says "This pane is empty." The reading page keeps
  "column" for its text column, a layout. Study's sections here say "pane"
  since; BVJ's quoted words keep theirs.
- **The reading page is "the Read page."** BVJ: “The first tab in the
  header nav, with the scripture pages, can be referred to as the Read
  page.” **This replaces E130's "Scripture page(s),"** the name planned for
  launch (BVJ, 2026-11-12). Each label is worded case by case (BVJ), and a
  verb often serves better than the name: "Read Romans 8," not "Read Romans
  8 on its Read page."
- **The address is /study, and /desk does not forward to it** (BVJ: “it's
  not public yet. I and two others, including BDR are the only ones who
  have had a chance to see any of this, and we can all three adapt to using
  the right address”). The help page moves with it. /notebook, /sheets
  (with a sheet's `?id=`, present mode, and shared links), and /collections
  open their places on the Study page.
- **The link that opens a passage in Study is the verb and the passage:
  "Study Romans 8"** (BVJ: “1, yes”), as the Read page's is "Read Romans
  8." BVJ had asked about “Open study”; Claude's reasons against it: it
  can read as a kind of gathering (an open Bible study), more so as "Open
  Study" with the place's capital ("Controls"), and it doesn't say what
  opens. With places, a sheet and a collection open at their own
  addresses, so this link only ever opens a passage. Where no passage is
  named, the header's "Study" is the way in.

### The places

- **The sidebar, top to bottom**: Scripture, Notebook, Sheets (the three
  most recent, and All sheets), Collections (the same), and Trash, with the
  foot "The Study Desk" drew. Each row opens its place in the page's
  panes. The sidebar marks the place that is open with a tint and a green
  bar; folded, it marks the group's icon.
- **Scripture is "The Study Desk"'s panes of tabs**: Panes 1 2 3, any of
  its kinds in any pane, following, and the widths, all as decided there.
  BVJ weighed "Desk" and "Workspace" for its name too, “since it's more
  than scripture happening there, but you're right that it's the primary
  focus.” It is also the word the place's own lists use: the first group of
  what a pane can show, and Search's first tab. **The row shows the
  passage it holds at its right**, where the Notebook shows its count
  ("Scripture … Luke 3"; BVJ: “Yes”).
- **The Notebook, a sheet, and a collection are places of their own**: the
  place's own pane, and beside it a pane of tabs. Their title row shows
  "Panes 1 2," never 3. **A sheet starts with one pane, or two when it
  is in a collection** (below); **the Notebook and a collection start with
  two**, the list and the passage beside it.
  Each place keeps its own count and what is beside it, and Scripture keeps
  its panes while the reader is elsewhere.
- **Beside a sheet, the pane keeps its own width** (320px at first) and
  the page takes the rest; the Notebook and a collection start half and
  half. Every line drags, with its menu and its reset (E189). The pane
  beside is on the right, as drawn.
- **The Trash is one pane**, with no Panes control: each row with
  Restore, and "Empty trash…" at the row's end, which asks first.
- **The header's magnifier and "/" open Search beside the place's own
  pane**, making the second pane if there was one pane. In the Trash
  they open Search in Scripture; in Scripture they work as "The Study Desk"
  says.

### What each place shows beside it

Each place does one job, so the pane beside it offers what that job
needs:

| Place | Its job | Tabs beside it | Opens with |
|-------|---------|----------------|------------|
| Scripture | Study a passage | The LIT, Greek, Footnotes, This verse, Notes, Search | As "The Study Desk" says |
| Notebook | Reread and tend what is kept | The LIT, This verse, Greek, Search | The LIT, This verse |
| A collection | Gather around a theme | The LIT, Search, Notes | The LIT, Search |
| A sheet | Build a handout | The LIT, Search, Notes, a collection, another sheet | Its collection, the LIT, Search, Notes |
| Trash | Restore or empty | Nothing | |

- **A collection beside a sheet is BVJ's addition**: “I think it's
  important to have an easy way to access collections while making a
  sheet. That's where all the information related to a specific topic,
  series, or event would be kept together.” Its passages and notes go onto
  the page as Search's and Notes' do. Another sheet is there to copy from.
- **A sheet in a collection opens with that collection beside it** (BVJ:
  “What you described sounds good,” after a mock): from the collection's
  place, always; from the sidebar or All sheets, at first, and after that
  as the reader left it. A sheet in more than one collection opens with
  the one the reader came from, else the one it was added to last. A sheet
  in none starts with one pane.
- **The tab beside is for using the collection; its place is for tending
  it.** The tab's first line names it ("The collection this sheet is in")
  and links to its place ("Open Wilderness"). Under it are the
  collection's groups and items, each cut to three lines, with this sheet
  shown but not offered. Choosing rows (Ctrl or Shift adds) brings a bar
  to the pane's foot, "2 chosen · Clear · Add to sheet," which adds them
  after the part chosen on the page; or a row drags onto the page, where a
  green line shows where it lands. A note goes on as a text part headed
  "From my notes · Luke 3:8." Ordering, removing, and renaming stay in the
  place. The bar is at the foot because in the tab row, at 320px, it cut
  off the open tab's name.
- **Why two places and not one**: a collection holds more than sheets
  (passages, notes, headings), and a sheet can be in several collections
  or in none, so a sheet kept inside its collection would be tied to one.
- **No Notes beside the Notebook**, which is the notes. **No Footnotes
  outside Scripture**: the LIT floats a verse's footnotes in its margin,
  This verse lists them, and a sheet's passage chooses its own with
  "Footnotes…."
- **Search is in every set**, so the magnifier never takes the reader away
  from their work.
- **The empty pane and "Open in this pane ▸" list only the place's
  set**, and the LIT tab's More offers **"Open in Scripture"** at the same
  passage, for anything a place doesn't hold.
- **No Greek beside a sheet.** Claude was least sure of this one (a leader
  writing a word study), and BVJ didn't add it.

### A sheet's page

- **Alone, the page shows at true size** wherever the pane holds the
  paper and its margin (a Letter page needs about 880px).
- **With a pane beside it, the page scales down to 80% at most, then
  reflows** at true type size with no page breaks drawn, as "Sheets" said
  of a narrow pane. With the pane beside at 320px, true size needs a
  window about 1,450px wide with the sidebar open, or 1,275px with it
  folded; 80% needs about 1,280px or 1,110px. In the mock's 1,163px window
  the page reflowed with the sidebar open and showed at 86% with it folded.
- **The sheet's commands are at the right end of its row**: Print…,
  Share…, a filled Present, and More. Under the row, a bar holds the copy
  tabs, with the template's name and "saved" at its right ("Bible study ·
  saved").
- **The formatting bar sits over the part holding the cursor**, at the
  part's left edge and above its own controls, so it never covers the
  words being written.

### The Greek is Study's

- **The Read page's Notebook panel loses its Greek tab**, BVJ's idea: “I
  think we can remove the Greek tab from the (newly labeled) read page. The
  this verse tab will still have it verse by verse, but for in depth study,
  they should come to the Study page.” The panel is Notes, Footnotes, and
  This verse. This reverses the Greek tab in BVJ's four of "Beside
  scripture."
- **This verse's Greek words open Study** at that verse, with the Greek tab
  at the word, where today they open the panel's Greek tab (BVJ: “Fine
  with both of those”).
- **A draft chapter's line links to that chapter's Greek in Study** ("A
  whole book"), since a chapter still being translated has no English yet.
- **Study keeps the Greek**: Scripture's panes start with it beside the
  LIT, and it is beside the Notebook ("What each place shows beside it").

### What changes in the sections before

**"The Study Desk"** holds for Scripture's panes, with these changes:

- **Sheets and collections leave the panes**, since they open as places.
  What a pane can show is Scripture (The LIT, Greek, Footnotes, This
  verse), Yours (Notes), and Search. "A Sheets or Collections tab opens the
  last one" becomes the place's title, whose name is still a menu (another,
  a new one, or all). Two sheets side by side are now a sheet with another
  beside it, and dragging an item from the sidebar onto a pane goes.
- **The Notes tab lists the chapter** ("This chapter"), with a link to the
  Notebook ("All 128 in the Notebook"). "Everything" is the Notebook place,
  so in the table of /notebook's tools the list and its filters, Manage
  labels…, Print…, and "Changed since you marked it" go there, and the
  Trash is the place above rather than a tab.
- **Every address keeps working but /desk**, now /study (above).
- **The title row has no heading** ("The names").

**"The Notebook"** holds for the Notebook place, with these changes:

- **The Notebook is a place, not the Notes tab on "Everything."** Choosing
  a note takes the LIT tab beside it to the note's verse, and with one
  pane it opens the second. The rule for a LIT tab sharing the list's
  pane goes.
- **When the commands for what is chosen don't fit the pane**, the count
  goes first, then "Add to collection…" and "Label…" move into More.

## The Greek (decided 2026-11-26)

Design Directions' proposal 24, "Greek beside the English": the tool that
proves the translation. The Greek tab should make one thing effortless:
point at a word in either language and see its partner, what it is, and
what the LIT did with it. Its drawing has the LIT and the Greek side by
side, a chosen word lit in both, and under the Greek a card of labeled
rows. Most of it is today's tab rearranged: the Greek set as text, the
parsing in words, both dictionaries, "A lexicon and the LIT can differ," a
"rendered here as" line for the glossary's words, the verse's footnote
letters, and a note from the Greek (step 4k). Claude recommended it with
eight adjustments, and BVJ took them, with a change to the first two and a
question about the fifth.

The drawing's frame (a "John 1 with the Greek" heading and layout icons)
is the one "Study and its places" replaced.

### What waits

- **A word's partner in the other language doesn't light up yet, not even
  for the glossary's terms** (BVJ: “not even for glossary terms yet. The
  tagging wasn't quite that precise. This will come some day.”). Claude
  had suggested the glossary's terms now and every word once the word
  links are published (the alignment file, "Phase 2"). Neither lights
  until those links are ready, and this is where they will show.

### The text

- **The Greek is Source Sans 3's own polytonic Greek** ("Type"), set as
  today's tab sets it: paragraphs with their verse numbers, not a table of
  words. The proposal named Literata's Greek.
- **Its verse numbers are ink at 66%, not deep green** (BVJ: “the verse
  numbers don't need to be Green because they aren't links here”).
  Nothing happens when one is pressed, and "Color" keeps deep green for
  what can be pressed.
- **A word's other forms are marked as today, in two tints** (BVJ: “Gray
  for hover, green for something that has been selected”): pointing at a
  word tints its forms in the chapter gray, and choosing one tints it
  green with a rule under it and its other forms a lighter green (the
  text green at 22% and 12%), so both sets can show at once. **The
  proposal's faint underline is not taken** (BVJ: “I think the faint
  underline is a mistake,” and, told the chosen word's forms are a lighter
  green, “Yes, agree”). It reads the Greek's own dictionary forms,
  not the tagging the partner lighting waits for.

### A word's card

Choosing a word opens its card under the text, in the house's plain rows:

- **The word, its dictionary form, and that form's transliteration**
  ("λόγος logos"), as the glossary shows "πίστις pistis" ("The glossary
  and articles"). One rule makes them when the site is built, matching the
  glossary's.
- **Form**: the parsing in words, with MorphGNT's code beside it, as today.
- **In the LIT here**: today's two lines, "rendered here as “Conversation”"
  with its glossary link (for the glossary's words), and "LIT notes on
  verse 1: a," each letter opening This verse. It never names one footnote
  as a word's explanation, since the site doesn't know which note is about
  which word (the alignment file: nobody guesses), so the proposal's
  "footnote a explains the choice" goes. Outside the glossary's words the
  row stays hidden.
- **Dictionary**: "UBS dictionary · STEPBible" as a plain row of choices
  at its top ("The kit"), not a menu that hides the second. STEPBible
  keeps the full LSJ entry under its brief one (BVJ, 2026-10-13), and UBS
  its "At this word" and "Other senses." The line "A lexicon and the LIT
  can differ" moves into this row, where the difference would show.
- **Elsewhere**: "4 in this chapter · Every place it appears →," the
  chapter's count as today, its link the search for every form. The
  proposal counted the verse, which is 1 for most words.
- **"Find this word ▾"**: one press, then today's four searches as its
  choices: this form, every form of λόγος, Strong's G3056, and words parsed
  the same. BVJ asked for each (2026-10-13 and 14), and the proposal's one
  button would keep one.
- **Its results open in a Search tab in the Greek's own pane**, BVJ's
  suggestion (“would it make sense for it to show in the Search tab of
  that pane, with it easy to click back to the Greek tab?”), then “Yes to
  all three”: right after the Greek tab, a later search reusing it, so the
  Greek keeps its place and its chosen word one click away. Choosing a
  result moves the LIT tab to its verse, and the Greek follows to the
  word. **This reverses E219's results in place of the text** (with "←
  John 1" and "See results on the search page"), by "The Study Desk"'s
  rule that nothing is replaced and a new tab opens in the pane being
  worked in.
- **A note from the Greek stays** (step 4k, PR #693): from a chosen word,
  or from a selection of the Greek ("Add a note on verse 1"). **The card's
  button says "Add note,"** beside "Find this word ▾," as drawn (BVJ: “Yes
  to all three”), in place of the note icon alone (BVJ, 2026-11-23). BVJ
  asked for notes from the Greek in the plan after not finding them on
  /desk, on Acts 2. They work on a published chapter, but a chapter still
  being translated takes none: a note is kept on the LIT's words, and the
  record format never anchors a mark on a draft (`STUDY-DESK-FORMAT.md`,
  "Not covered: draft chapters"), which leaves Acts 2–28 and Revelation
  without them.
- **Where a chapter can't take a note, the Greek says why** (BVJ: “no
  explanation why it's missing. If it behaves that way for others, they
  will be just as confused”). Today's tab leaves the button and the
  selection's menu out on a draft, without a word. BVJ: “the button and
  selection menu should still be visible but disabled with a message.”
  "Add note" stays on the card there, unavailable and legible, with its
  reason ("This chapter
  is still being translated, so it can't take notes yet."), as "The kit"
  asks of every unavailable control, and a selection of the Greek opens
  its menu with that line unavailable and the same reason beside it.

### Kept from today

What the drawing leaves out stays (BVJ: “yes”): the text-critical signs,
"Show the note," and the Apparatus view; Sources and licenses, which the
licenses require; the draggable line between the text and the card (BVJ,
2026-10-17); following the LIT tab, with "Go to verse N"; the arrow keys
through the words; the line saying where John 7:53–8:11 and Romans
16:25–27 take their Greek; and a copy that pastes as plain Greek. The
Greek search commands and their builder stay (`public/greek/CLAUDE.md`,
rule 17). The proposal tucks them behind a "Build a search" in Search;
that, and anything else about them, is open (below).

## First visit, signing in, and sync (decided 2026-11-27)

Design Directions' proposal 25 draws three screens, each with one job and
one main button, and gives every sync state one short line. Its drawing is
older than the account pages (built in step 4h, behind `?account=preview`)
and than BVJ's choice of a spare key by default (BDR's level 2,
2026-11-26: `STUDY-DESK.md`, "Decisions," recorded in PR #731; BDR's
page "Synced notes: three privacy levels"), so some of what it says is no
longer true. Claude proposed eight adjustments, and BVJ took them all
(“Yes to all 8”), asking whether they take level 2 and PR #731 into
account. Three of them come from level 2, and its plan adds the
refinements at the end of this section.

### The three screens

- **The first visit is Study's empty state**: "Your notebook is empty,
  and it is yours," with three ways to begin, "Open a chapter and mark a
  verse," "Start a sheet from a template," and **"Take the tour"** in
  place of the drawing's "See how Study works," as the screen's one filled
  button. That is the acting tour, with "Start here" at Study's head
  ("Nothing interrupts the reader"); the help page stays under Help. It
  says "this browser," never "this computer" (the account pages' rule 22,
  and "The Notebook"'s foot line). **Its foot offers both setting up an
  account and signing in**, where the drawing had only "Already have a
  notebook? Sign in," so keeping the notebook in this browser stays a
  plain choice, as step 4j's card has it. It shows only while the
  notebook is empty, and replaces today's first-use card.
- **Signing in puts Apple and Google first, and "Sign in with a passkey" as
  a quieter third** (BVJ, 2026-11-26), not three equal buttons. Apple's and
  Google's buttons follow each provider's own rules for them, so neither is
  one of the house's filled buttons and the screen still has no filled
  button among the three.
- **The drawing's sentence about locking is not true by default** ("Your
  notebook is locked before it leaves this computer; the service stores it
  without being able to read it"): the service keeps a spare key and hands
  it to the reader's signed-in devices. The screen says what is true at
  the default, with the one quiet line about the option that every setup
  shows, in the option's name and description as BVJ chose them. Claude's
  draft, from BDR's wording for level 2: “No passwords, and no codes by
  email. Your notes are encrypted on our service, and we never read, sell,
  or share them. Turn on End-to-end encryption and only you can open your
  notes, not even LIT.” "As planned, the LIT Bible apps" loses "as
  planned." The final words are step SK5's (below).
- **"Save your recovery code" shows only to a reader who turns on
  End-to-end encryption**: the default makes no recovery code, and the
  option requires one (BVJ, 2026-11-26). **The two groups are still typed
  back**, in place of the drawing's "I have saved it" box (BVJ, 2026-11-24:
  “they shouldn't skip adding the two number groups,” which now holds
  inside the option), and Done waits until both match. Print and Copy
  stay.

### Status

- **The drawing's lines, in the house's words**: "Kept in this browser
  only" with "Back up…" (and the backup reminder's "Last backed up 9 days
  ago"), "Syncing…," "In sync," "Offline. Your changes are saved here.,"
  "Signed out. Your notebook is still here." with "Sign in," and, for a
  stop only the reader can settle, "This browser can't open your notebook."
  with **"Reconnect"** in place of the drawing's "Fix…" (BVJ kept the word,
  2026-11-24; it opens the account page, which names the real step).
  The states the drawing leaves out get a line in the same short form,
  and the full account's words stay BVJ's (2026-11-26).
- **One set of words, shown at the foot of what it is about**: the Study
  sidebar's foot, the Read page's Notebook panel ("Nothing interrupts the
  reader"), and the header's account menu, where the line lives today on
  every page without a panel (BVJ, 2026-11-24). The drawing gave it one
  home, the sidebar, which a reader on About or the glossary never sees.
- **A stop moves to the foot line and a dot, with no bar**: nothing is lost
  while a browser is signed out or removed, since the notebook stays in it.
  This reverses part of BVJ's 2026-11-24 call, a notice with "Reconnect"
  on whatever page the reader is on.
- **Two notices keep their bar on the page being read** (BVJ,
  2026-11-25): a request that waits (to delete the account, or to replace
  its notebook), since the seven days protect a reader only if their
  devices say so, and a device that joined, since it can read the whole
  notebook at once and hearing of it soon is the only defense. These are
  the one exception to "nothing floats over the page."

### The account page

- **It stays a page of its own** (`/account`), as built: setup, devices,
  the recovery code, signing out, and deleting, now with step SK4's
  "End-to-end encryption," on and off, holding "Follows my account" and
  "This device only." The proposal's three screens are its first steps,
  drawn in Featherboa's look. All settings links to it ("Display"), and the
  header's "Sign in" stays.

### What level 2 and PR #731 add

- **The words wait for step SK5**, which rewrites `/privacy`, `/terms/`,
  the help page, the first-time card, the tour, and the Settings tab after
  Fable's research on the lawyer questions, whose recommendations are
  followed (BVJ, 2026-11-26). So the drafts here ("we never read, sell, or
  share them" among them) are Claude's, to be checked there.
- **The joined device's notice carries more weight under the default.** A
  stolen Apple or Google sign-in can now get the spare key, and the
  notice every device gives is the only protection kept on 2026-11-26;
  step SK1 is to put a wait or a yes from another device to BVJ. So the
  bar stays, whatever "Nothing interrupts the reader" asks elsewhere.
- **Nothing here changes the sync, the encryption, or the record format**,
  as the proposal says; the spare key's own changes are steps SK1 to SK5.

## Open

- **The rest of the two proposals, and every page**, each decided again
  (above), with 2.0's decision beside the proposals'.
- **What becomes of Site 2.0's code** behind `data-restyle`.
- **/read as the full-size picker, and the License page**, each drawn as a
  page ("Finding a passage"), with /read's lede that names the unfinished
  texts.
- **Fraunces's settings** (above).
- **What else names Inter**, beyond the two settled: the verse image's
  name and address take Source Sans 3 ("Off the screen"), and the margin
  notes' Plain face goes with Playpen Sans ("The reading page"). A search
  of the code when it is built answers it.
- **Whether Source Sans 3 has the SBLGNT's text-critical signs**, and
  whether its served file has old-style figures ("Sizes, space, and the
  measure").
- **The phone menu's rows**, which wait for proposal 19's four places
  ("The phone").
- **The glossary's third opening paragraph** ("The glossary and
  articles"). Claude's draft, for BVJ to approve or rewrite: “As you look
  through the entries below, you’ll find the traditional word on the left
  and, on the right, what the LIT Bible uses in its place most often (it
  can change based on context). Under them is the Greek behind it.”
- **How Featherboa is gated and launched.** Site 2.0 rides `data-restyle`
  (`SITE-2.0.md`, "At launch").
- **The Greek search commands and the search builder** ("The Greek").
  Only two things are decided: the Greek tab of search stays where the
  Greek search runs ("Search"), and the commands and builder stay. Their
  window, its name ("Search commands" today, the proposal's "Build a
  search"), its ways in (the tray, /search, and the Search pane today),
  and how it meets "Find this word ▾" were never put to BVJ (BVJ: “I don't
  remember addressing Greek search in detail”).

When a part is built, its rules go into the area file for its code
(`src/styles/CLAUDE.md` for fonts), and this file keeps the decisions and
their reasons.
