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

## Open

- **The rest of the two proposals, and every page**, each decided again
  (above), with 2.0's decision beside the proposals'.
- **What becomes of Site 2.0's code** behind `data-restyle`.
- **Fraunces's settings** (above).
- **The Display tray's faces.** Its Default is Inter today; the other two
  choices are Atkinson Next and OpenDyslexic.
- **What else names Inter**: the margin notes' Plain face, and the verse
  image's wordmark and address.
- **Whether Source Sans 3 has the SBLGNT's text-critical signs.**
- **How Featherboa is gated and launched.** Site 2.0 rides `data-restyle`
  (`SITE-2.0.md`, "At launch").

When a part is built, its rules go into the area file for its code
(`src/styles/CLAUDE.md` for fonts), and this file keeps the decisions and
their reasons.
