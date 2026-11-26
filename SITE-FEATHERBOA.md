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
- **The workspace's name**, “Study Desk” or the proposal's “Desk”
  ("Controls," above; proposal 21).
- **How Featherboa is gated and launched.** Site 2.0 rides `data-restyle`
  (`SITE-2.0.md`, "At launch").

When a part is built, its rules go into the area file for its code
(`src/styles/CLAUDE.md` for fonts), and this file keeps the decisions and
their reasons.
