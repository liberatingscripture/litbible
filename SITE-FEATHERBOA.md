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
rows in full.

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
| Open in Study Desk, Edit in Study Desk, Open the Study Desk | One label; the proposal's is "Open in Desk," and the name waits for proposal 21 |
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
- **The workspace's name waits for proposal 21** (“One workspace”). The
  proposal says “Desk” (“Open in Desk,” and Desk among the places);
  until 21 decides, labels keep “Study Desk.”

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
  note, with the same "In the notes ↓". On a phone, footnotes and notes
  open as a sheet from the bottom (proposal 15).

### The page's controls

One line under the header says where the reader is, and each part of it is
a picker: "John" lists the books, "Chapter 1" the chapters. Previous and
next are plain arrows there, and large type at the foot.

**The line's right end loses "Switch to Read View" and keeps "Open in
Study Desk"** (BVJ, “Yes,” and “Read View pages are being retired”). Read
View retires at launch (BVJ, 2026-10-21; `STUDY-DESK-FIXES.md`, E8), so its
pill goes with it; the Study Desk's way in stays in the line until proposal
21 names the workspace. The proposal's line drew neither, only the arrows
and "Notebook" (proposal 11).

**The phone's bar is decided with proposal 15** (The phone), where the
phone is drawn whole (“Take 1-6”). The proposal moves it to the bottom, at
the thumb (Back, Search, Notes, Next), hiding while the reader scrolls
down; today's is one row at the top (audit F3, owner 2026-09-28), and F3
stands until then.

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
arrangement). Their words are settled with proposals 12 and 16.

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
  have nothing to work with, so the top row would be Copy alone. It is
  drawn with proposal 15, and the menu keeps today's Copy and Share there
  until then; **Share itself is revisited at 15** (“7, yes, with revisiting
  share at 15”).

This replaces E39's "Copy text" split row and the Share flyout as the
menu's layout, and E112's order of the Notebook's rows.

### The Notebook panel

- **Four tabs, in BVJ's order: Notes, Footnotes, This verse, Greek** (“yes
  but in this order”). Notes, Footnotes, and Greek each list the chapter one
  kind at a time; This verse gathers every kind for one verse.
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
  is (E15): Print…, the whole notebook, Notebook actions, Take the tour,
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
chapter. The phone's picker is drawn with proposal 15.

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
  in Study Desk" until proposal 21. BVJ: “In the same line with the arrows
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
  results look is proposal 16's.

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
  highlights, say) are in All settings.
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
the account pages, which it doesn't replace (proposal 25).

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

- **Only the next chapter's heading** (“1, yes”). The footnote list and Go
  deeper leave the reading flow on the screen. The list stays in the page
  for printing, and both stay for readers without JavaScript and for the
  desk, which reads them from the chapter's page (`desk/chapter-page.js`).
  Where the Notebook panel runs (a computer with the Study Desk), they are
  its Footnotes tab and This verse's "This chapter," which already shows
  the chapter's Go deeper rows; a margin footnote's "In the notes ↓" opens
  the Footnotes tab at its note. The panel is the desk's, so where they
  live on a phone or tablet is drawn with proposal 15.
- **"Go deeper" on each chapter's heading is open.** BVJ asked for “a ‘go
  deeper’ control somewhere more visible that takes the user to it on the
  tab”; Claude proposed it at the heading's right end, opening This verse at
  "This chapter." BVJ: “maybe. I'd have to see it to decide for sure.” It
  waits for a mock.
- **Footnote letters start again each chapter**, as today, and the
  Footnotes tab lists the chapter in view (“d, yes”).
- **A chapter still being translated loads as the desk's text pane loads
  it** (“c”): a run of drafts in one book is one entry, headed "Luke 23–24"
  (or "Acts" when the whole book is in draft), saying the chapters are still
  being translated. Its line about the Greek stays, pointing to the
  Notebook's Greek tab where the panel runs (BVJ: “the Greek tab is still
  relevant here”), since the desk shows the Greek of draft chapters (BVJ,
  2026-10-13). A draft asked for by name, from the picker or its address,
  still opens its own page ("Finding a passage").

### The progress line

**Kept** (BVJ: “Keep the progress line if possible”): a thin green line
along the place line's bottom edge, in place of its border, so it adds no
height. It fills as the reader moves through the book, measured in verses,
so a long chapter counts for more. The place line names the chapter, so
screen readers skip the line. Where it goes on a phone is proposal 15's,
with the bar.

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

## Open

- **The rest of the two proposals, and every page**, each decided again
  (above), with 2.0's decision beside the proposals'.
- **What becomes of Site 2.0's code** behind `data-restyle`.
- **"Go deeper" on each chapter's heading**, to decide from a mock ("A
  whole book").
- **/read as the full-size picker, and the License page**, each drawn as a
  page ("Finding a passage"), with /read's lede that names the unfinished
  texts.
- **Fraunces's settings** (above).
- **What else names Inter**: the verse image's wordmark and address (the
  margin notes' Plain face goes with Playpen Sans, "The reading page").
- **Whether Source Sans 3 has the SBLGNT's text-critical signs**, and
  whether its served file has old-style figures ("Sizes, space, and the
  measure").
- **The workspace's name**, “Study Desk” or the proposal's “Desk”
  ("Controls," above; proposal 21).
- **How Featherboa is gated and launched.** Site 2.0 rides `data-restyle`
  (`SITE-2.0.md`, "At launch").

When a part is built, its rules go into the area file for its code
(`src/styles/CLAUDE.md` for fonts), and this file keeps the decisions and
their reasons.
