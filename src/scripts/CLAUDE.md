# Client-side reader tools (`src/scripts/`)

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory. The Study Desk's own rules are in `desk/CLAUDE.md`,
> and the Sheets' in `desk/sheets/CLAUDE.md`.

## Module map

From the root's project tree.

```
  scripts/           # CLIENT-side vanilla JS (chapter-tools; read-on, a
                     #   chapter's page reading on through its book, and
                     #   read-view-redirect, Read View's old addresses;
                     #   search-core + searchbar + search — see "Search" below;
                     #   lit-panel, the one floating panel every reader tool
                     #   shares; ref-preview, scripture reference previews;
                     #   last-read + continue-reading, "Continue reading";
                     #   term-lens, the reading page's term underline and card;
                     #   header-search, the header's magnifier (its
                     #   search strip, or the page's own box);
                     #   header-menus, the header's Learn, Study, and
                     #   About menus, the menu sheet every "Menu" opens,
                     #   and their news marks; phone-bars, a phone's two
                     #   reading bars (Search in the top row, hiding
                     #   together on a scroll down); link-button, a link
                     #   that answers as a button once a script takes it
                     #   over (the bar's Search and Menu, the place line's
                     #   Search, the picker's ways in); passage-picker,
                     #   the passage picker (the panel, the phone's sheet,
                     #   and /read; `src/components/CLAUDE.md`);
                     #   place-line, the place line's Search, which opens
                     #   the page's one box in place of the line;
                     #   keyboard-shortcuts; print-radios, which sets every
                     #   radio button back after the print dialog (Edge
                     #   clears them all; see "Printing and handouts");
                     #   verse-image, which draws and
                     #   hands on "Share image…"; panel-flyout, the one
                     #   flyout row the panels share; glossary-entry-links, the
                     #   copy-link buttons on /glossary; glossary-selection,
                     #   its selection panel; panel-pieces, what every
                     #   panel is built from; keep-reading-place,
                     #   which holds the reader's line through a reflow;
                     #   tip, the one tooltip for icon-only controls
                     #   (setTip; hover and keyboard focus, never `title`);
                     #   float-window, a window that stays open until
                     #   answered or closed (the desk's tour offer, and
                     #   greek-commands, the Greek search commands window,
                     #   whose top is greek-builder, the menu-based search
                     #   builder);
                     #   desk-gate + desk/, the Study Desk preview (its
                     #   Sheets in desk/sheets/), and
                     #   desk-frame, what every page knows about its panel;
                     #   see `desk/CLAUDE.md`, "The Study Desk preview";
                     #   account-gate, the account pages' only static
                     #   script, which reads their switch and imports
                     #   desk/account/page.js dynamically; see
                     #   `desk/account/CLAUDE.md`)
```

## Copying, sharing and printing scripture

### Sharing part of a verse

Some verses are worth sharing in pieces: a verse that introduces a quotation
and then sets it as poetry (19 published block quotes continue a verse this
way — 1 Peter 2:6, 1 Timothy 3:16, 1 Corinthians 6:18), or a mid-verse speaker
change that opens a new paragraph.

**The anchor is the block's own id, which every authored paragraph and
blockquote already has** (`john-8-p9`, `1peter-2-p2`). Nothing extra is
authored for this. Those ids are already book-namespaced, so the same anchor
resolves on a chapter the page has read on into: `prepareLitBlocks`
(`src/lib/read-on.mjs`) prefixes only `id="vN"` and leaves them alone.

`verseParts()` in `chapter-tools.js` groups a verse's `data-verse` spans by
their **outermost** block, so a poetry quotation is one part rather than one
per line, and narrows each part to that verse's spans, so a blockquote holding
two verses doesn't hand back both. When a verse has more than one part the
verse menu grows an "Or copy one part" group, one button per part, copying the
part's text plus the reference plus `#<block-id>`. Text set as lines — a
blockquote, or a paragraph broken with `<br>` — keeps its line breaks (for
poetry the line structure is part of what is being quoted); prose parts join
with a space. `partHighlight()` makes those anchors highlight on arrival
the way `#v16` does, rather than merely scrolling.

Parts are offered for a single verse only — a range already spans blocks by
nature, and a button per block would bury the whole-range actions.

### Sharing a selection

The general form of the above: select any run of scripture text and a panel
offers the verse menu's actions under the same names (see "One set of
actions, two ways in," below), for a half-sentence, a phrase crossing two
verses, or part of a poetry quotation. It runs on every chapter the page
holds, each a view of its own (`attachChapter`), and in /desk's LIT panes.
A selection crossing two chapters shares one chapter's part of it, since one
reference names one chapter, and every link it produces, Copy link's
included, is that chapter's verse link (`/john-3#v16`).
Four owner decisions (2026-09) shape it:

1. **It sits beside the selection, and the side follows the input**, not the
   screen width (`lastPointerType` decides). A mouse selection gets the panel
   just above the text, never a bottom sheet, even in a narrow window. A touch selection shares that space with the phone's
   own Copy / Share bubble, which a page can't add to or move, so
   `placeBesideTouchSelection` takes the side the bubble isn't on. That is
   normally just below the selection, clearing the drag handle. When a
   selection near the top pushes the bubble down, it goes below the bubble.
   With no room below, it goes above the bubble. The two clearances are
   estimates, because no API reports where the OS draws its menu. **A bar
   pinned to the bottom edge was rejected on a real phone**: it was easy to
   miss, and it covered any selection made near the bottom of the screen.
2. **The reference uses plain verse numbers** ("John 3:16", never "16a"),
   covering every verse the selection touches. The quoted words already show
   it's partial.
3. **The link is the ordinary verse link** (`#v16`, `#v16-17`), not a
   `#:~:text=` fragment, which would be long and silently fall back whenever
   the words cross a footnote letter.
4. **Ordinary Copy is left alone.** The reference is only ever added on
   request. Appending it to Ctrl+C was rejected as clipboard hijacking.

**`joinPieces` is the one join rule** behind both panels' Copy text, the
per-part copy, and a verse image, so selecting whole verses
copies exactly what the verse menu does (checked against every verse and
adjacent pair on 15 chapters). Don't give the selection its own joiner. The
image passes `numbers: false`, which drops the verse numbers a range carries
inline and changes no other boundary. Three details are easy to
break:

- A selection boundary inside a verse number or footnote letter is moved out
  past it (`excludeMarkers`). A range lying wholly inside one clones as bare
  digits, with no `<sup>` left for `blockText` to strip.
- Mid-word boundaries snap out to the whole word, within one text node. An
  apostrophe or hyphen counts only between letters, so a closing quote is
  never pulled in.
- The panel's `mousedown` is `preventDefault`ed, or pressing a button clears
  the selection first. On a phone the tap clears it anyway, so the buttons
  act on the share computed when the panel opened, never on the live
  selection, and `acting` keeps a pressed panel open until it finishes.

**A mouse drag that ends off the text ends where the pointer last was over
it** (BA23; `endOffText` in `chapter-tools.js`, rule in
`src/lib/selection-end.mjs`). A browser puts a selection's end at the
element under the pointer in document order, so a drag ending over
something drawn over the page but written at the end of `<body>` (a Study
Desk window, a margin note) or over another /desk pane put the end after
the rest of the chapter, and a note saved on it covered every verse to the
end. The pointer's last caret over a view's text is kept during the drag,
and the page's own selection is moved there, so what is highlighted is
what the panel offers. A drag that goes past the text's end (below it going
down, above it going up) still runs to the end, as before.

A footnote letter, verse number or key term clicked inside a live selection
opens its own panel, and the selection survives the click, so the next
`selectionchange` settle would reopen the selection panel over it. `openedKey`
(the selection the panel last opened for, which a pointerdown doesn't clear)
lets that panel keep the screen while the selection is unchanged.

**It is placed clear of the selection and can be dragged aside** (owner,
2026-10-14), by its header, as the verse menu is. A mouse selection tries
above, below, then to the right and left of the selected words
(`placeClearOfSelection`, `panel-pieces.js`); where none fits whole, which the
Study Desk's extra rows make likely on a short window, the panel is squeezed
into the roomier strip above or below and scrolls there; only a selection
filling the window leaves it covering some of it. A finger keeps
`placeBesideTouchSelection`. It has no ×, since it closes with the selection, on
a tap elsewhere or on Escape. Dragging marks it `acting`, as a button press
does, because a finger on it clears a phone's selection.

The panel never takes focus, so the verse-number menu stays the keyboard and
screen-reader route to the same copy.

### One set of actions, two ways in

The verse menu and the selection panel offer **the same actions under the
same names** (owner, 2026-09-29): **Copy text** (the words, the reference and
the verse link), **Copy link**, **Copy with footnotes** (the handout; see
"Printing and handouts"), **Share text…** and **Share image…**. ("Copy verse" can't name half a verse, hence
"Copy text.") "Share text…" is the share sheet, with the words and the link
(E39, 2026-11-06); "Share image…" has its ellipsis because it opens questions
(E111, 2026-11-12). Only the verse menu's extras are its own: "Or copy one part" and the range hint, both about whole verses. Both
panels build from the same pieces (`menuButton`, `shareButton`, `imageStep`,
`panelRow`, `flyoutRow`; the shared ones are in `src/scripts/panel-pieces.js`
and `panel-flyout.js`, and `actionRows` in `panel-pieces.js` lays the copy
and share rows out for both), so keep them in step.

**A mouse or the keyboard gets two flyout rows; a finger's chips stay flat**
(BVJ, 2026-11-06, E39, for every reader). Featherboa replaces this layout:
Highlight, Note, Bookmark, and Copy across the top, each showing its
choices beneath it once pressed (Copy link and Copy with footnotes under
Copy), and Share… holding Share text…, Share image…, and Print, in both
panels (`SITE-FEATHERBOA.md`, "Beside scripture"). Until it is built, this
holds. **"Copy text"** is a split row:
pressing the row copies the text exactly as before (one press); its chevron,
named "More ways to copy", hover (which never takes focus) or the right arrow
open a flyout of Copy text, Copy link and Copy with footnotes. **"Share"** is
a flyout of "Share text…" (only where the browser has a share sheet) and
"Share image…"; choosing Share image… keeps the flyout open and the image
questions (Ink or Paper, Square or Story) replace that item inside it (BVJ,
2026-11-12, E111). Closing the flyout puts the item back (`flyoutRow`'s
`onClose` calls the step's `reset`), and the flyout stays open while the
pointer rests on it or focus is in it, re-checked when its close timer fires,
so a step swapping its buttons doesn't shut it. Where there is no share sheet
the row is a flat "Share image…" button. The flyout is `flyoutRow` in `panel-flyout.js`, the one
implementation the Study Desk's "Bookmark ▸" and "Print ▸" use too (desk code
imports it; this file never imports desk code): a trigger with
`aria-haspopup="menu"` and `aria-expanded`, a `role="menu"` fixed to the
window (`.lit-flyout*` in `global.css`), hover opens, a click, Enter or → move
focus in, Escape or ← step back. **In every menu, here and on the Study Desk,
the arrow keys, Home and End pass over a disabled item** (`disabled` or
`aria-disabled="true"`; BVJ, 2026-11-07, DK3-7), and opening a menu focuses
its first item that isn't; a disabled line that can't be used shows its
reason beside it for the eye. **That reason is also the menu's description**,
since a reader who arrows never lands on the line: the menu carries
`aria-describedby` to a visually hidden note that says "Add pane is
unavailable: needs a larger window." for each such line (`describeUnavailable`
in `desk/menu-reasons.js`; call `refresh()` whenever a line's state or reason
changes while the menu is open). A line disabled with no reason (a busy
button) adds nothing. **No menu or flyout runs past the window's foot**
(E179; BVJ, 2026-11-19): one whose lines change while it is open (Add pane's
sides, then its kinds) is placed again at each step, and one taller than its
room stops 8px from the window's edge and scrolls inside itself. A menu fixed
to the window closes on any scroll outside it, so a foot off the screen could
never be read; one hanging in a scrolling page could be, but only by
scrolling the page. A new menu follows all three. The selection panel passes
`pointerFocus: false`, so a mouse click never moves focus into it (the panel
never takes focus; a keyboard press does). **A click on a flyout that hover
opened takes it rather than shutting it** (Audit 3, NB3-1): the pointer opens
it on the way to the row, so that click is the one the reader came to make;
only a click on one a click or a key opened closes it. Being fixed to the
window, it can't follow its row, so a scroll or a press anywhere else (the
panel's grip included) closes it (NB3-12), and it never hides with focus
inside: focus goes back to the row first. A row of buttons in it is
`role="none"` and a line of words describes the menu (`aria-describedby`)
rather than sitting in it (NB3-11). **A failed image gives Share text…
back** (NB3-2): when the image step ends in "Too long" or "Couldn't make the
image", the reason takes the step's place in the flyout with Share text…
still above it and a keyboard reader's focus on the reason; in the chip
layout the step drops `lit-image--open`, which gives the Share text… chip
back beside it. No explanatory hint text is added
to either panel. The verse-number menu stays the keyboard and screen-reader
route to all of it.

**The glossary has a selection panel too** (owner, 2026-10-09), for every
reader: selecting words in an entry's definition offers **Copy entry text**
(the words, "— Glossary: Flesh (LIT)" and the entry's link) and **Copy entry
link** (`src/scripts/glossary-selection.js`). It is Chapter View's selection
panel in miniature, built from `panel-pieces.js` with the same settling,
placement, word snapping and never-take-focus rules, clamped to one entry's
definition. It sends `lit:panel-actions` (`view: "glossary"`), so the Study
Desk adds its "My Notebook" row to it as it does in scripture. The entry's
copy-link button says what it does twice over: hover text ("Copy link to this
entry") and a copy icon with a chain on its front sheet (owner, 2026-10-09).
A bare chain reads as a link that goes somewhere.

**Opened by a finger, both use the chip layout** (`.lit-panel--chips`): tinted
buttons side by side in rows (`panelRow`), the three copies in one and
Share text… with Share image in the next, flat, with no flyouts (E39). The
owner's rule is that **every row with two buttons is split the same way**, in
either panel: exact halves. Three share their row evenly without going
narrower than a label. A missing Share text… (no share sheet) leaves Share
image the whole row, and once pressed its questions take the row over from
Share text…, so the panel keeps its height. A label never breaks: a button too
wide for its share wraps to a line of its own, which is a one-button line, not
a two-button row split differently. OpenDyslexic's chip buttons carry 4px of
side padding rather than 8px for that reason (it sets only their minimum
width). Measured in 2026-11 from the fonts' advance widths (the 15.2px panel
type, the labels plus padding, kerning ignored): at 360px "Share text…" and
"Share image…" fit one row in the phone sheet (halves of 166px) in all three
fonts, and in the selection panel (154px) in Inter and Atkinson. "Share
image…" needs 119px (Inter), 111px (Atkinson) and 162px (OpenDyslexic), so
in OpenDyslexic's selection panel it takes a line of its own, as the rule
allows (E111; the ellipsis cost 13px). Since Featherboa's Phase 1 the
panels' controls are in Atkinson, the controls' face, which fits.
Featherboa draws the phone's verse sheet as Copy text, Copy link, Share
text…, and Share image… across, with icons, then Copy with footnotes, and
no Print (`SITE-FEATHERBOA.md`, "The phone"); until it is built, this
holds.

**The verse menu follows the input, as the selection panel does** (owner,
2026-09-29), not the screen width, and **the text it covers must always stay
within reach** (owner). So:

| Opened by | Layout | Where |
|---|---|---|
| a finger, ≤640px | chips | a short bottom sheet; the text scrolls out from under it |
| a finger, wider (tablet) | chips | beside the verse number, pinned to the screen so the text scrolls under it, and draggable |
| a mouse or the keyboard | rows | beside the verse number, scrolling with the text until dragged, then pinned where dropped |

Every verse menu closes on its ×, Escape, tapping its lone verse number
again, or a tap or click anywhere else, like every other panel, and none
closes on a scroll. Tapping another verse number extends the range instead.
A finger's menu does not ignore taps elsewhere so the text under it could
be tapped: the owner found that annoying (2026-09-29), and the sheet's
scrolling and the card's drag keep that text within reach anyway.
Every verse menu has a ×, and every one beside its number drags by its
header (the grip), because a menu moved off the text needs its own way to
close. Extending a range reopens the menu where it was put. A mouse never
gets a sheet, even in a narrow window, and neither does a mouse selection.

The phone sheet was picked from four mocked placements (2026-09-29); the
old sheet of full-width rows covered about 40% of the screen and the tapped
verse itself whenever that verse sat low. The selection
panel keeps its own placement (decision 1 above) and closes when the
selection clears.

### Verse images

**"Share image…"** (E39, E111) closes the verse menu and the selection panel, so it
works from both (audit X8, owner 2026-09-28). It draws the passage in the
share-card design, in the reader's browser, and hands it on: the phone's
share sheet on a phone or tablet, a download on a computer, told apart by the
OS (`isAppPlatform`, the app announcement's test), never the screen width. A
tablet whose browser passes for a computer's (iPadOS reports a Mac, an
Android tablet in desktop site mode reports Linux) is told by its touch
screen.
Nothing is stored, and nothing leaves the device until the reader shares it.
The pieces are `src/lib/verse-image.mjs` (the design and the typesetting,
pure and unit-tested with a fake measure) and `src/scripts/verse-image.js`
(drawing, and the button). The owner's decisions, made from an exploration
page drawn by the same code:

1. **One button that becomes the next question** each time it's answered:
   "Share image…", then Ink or Paper, then Square or Story, then the share
   sheet or the download. Each question is one row the height of a button,
   so the panel never moves while it changes.
2. **Two looks**: Ink and Paper, Featherboa's two colors (`#1D231C` and
   `#FAFAF8`), each the other's ground (queue Q22). **Both sizes**: 1080
   square and 1080×1920 story, whose content stays inside the area
   Instagram's own controls leave clear.
3. **The verse in Source Sans 3** (the screen's 400), **the reference in
   Fraunces** (500, as a heading), and **one small line under the verse**
   (Featherboa, `SITE-FEATHERBOA.md`, "Off the screen"): the emblem and the
   reference at the left, "Liberation & Inclusion Translation" over the
   address (Source Sans 3, 500, in the quiet ink) right-aligned at the right.
   There is no green bar and no lockup at the top; the emblem is the only
   green, and Inter is gone from the image. The text is Copy text's
   (`joinPieces`, footnote letters and bracket markers gone, poetry kept as
   lines) without the inline verse numbers, since the reference names the
   verses. The sizes are proportions of the 1080px width, one rule for both
   (`FOOT` in `verse-image.mjs`): margin 96, emblem 72, reference 40, small
   line 28, so Story is the same layout, taller (its box sits inside the
   apps' clear area). The reference steps down a pixel at a time, to 28, when
   it would run into the name (`fitRef`). **The canvas names the faces as CSS
   does** (`"Source Sans 3 Variable"`, `"Fraunces Variable"`), and the script
   loads them with `document.fonts.load(font, sample)` **for the text it is
   about to draw**, since `faces.css` splits the files by character range and
   a canvas fetches none itself. A canvas can't set Fraunces's softness and
   wonk, so its reference is drawn with the font's defaults. Each look's text
   colors hold 4.5:1 on its background (`test/verse-image.test.js`).
4. **The chapter's own address** on the image ("litbible.net/john-3"), always
   the site's name whatever host drew it. The owner counts it as the link back
   the license's social-media exception asks for. The share sheet also gets
   the same text Share text… sends, link included.
5. **Length is measured, not counted.** The text is set at the largest size
   that fits, lines balanced, down to a floor that stays readable where the
   image is seen (40px on a square, about 13px in a phone's feed; 44px on a
   story), and a size whose floor can't hold it isn't offered. The box is
   the whole space above the foot line, so more fits than the 100 and 135
   words of prose measured in the first design; poetry fits less. When
   neither fits, the button says so instead of offering colors.

**Safari only opens the share sheet from a fresh tap**, the same rule that
shaped `copyLater`. So both images for the chosen look are drawn while the
size question is showing, and the last tap shares one already made. If a slow
phone isn't done in time, the button asks for one more tap ("Share image")
rather than failing. The fonts are the site's own `@fontsource` faces, loaded
into the canvas with `document.fonts.load` before anything is measured, since
a canvas can't wait for a web font by itself.

### Printing and handouts

The license lets a study guide or bulletin quote the text **and its notes**,
provided the notes stay with the verses they explain and the work carries a
fixed attribution notice (/read, "Noncommercial use" and "Quoting the LIT in a commercial work"). Two features serve
that, and both print the notice from **one constant, `LIT_CREDIT_LINE` in
`src/lib/lit-credit.mjs`**, which /read's own terms also render. Change the
notice there or nowhere. (Featherboa moves the terms from /read to a
License page of their own, forwarding /read's old anchors:
`SITE-FEATHERBOA.md`, "Finding a passage"; until it is built, they are on
/read.)

- **`src/styles/print.css`** (imported by `Layout.astro`, all `@media print`)
  prints a chapter or an intro as text and notes only: black on white in
  any theme, Crimson Text (a reader's accessibility font prints as chosen),
  12pt times the Display tray's text size, with the header, tools bar,
  Previous/Next, and panels gone. The footnotes stay the endnote list they
  are on screen, and the SBLGNT notice still prints after the text on both.
  **A page that has read on into other chapters prints one chapter with its
  notes, the chapter in view** (WB-37): read-on.js marks it at
  `beforeprint` (`html[data-read-on-print]`, its parts
  `[data-read-on-printing]`), `reading-page.css` hides the rest, and the
  credit's address follows it; the page's own chapter prints when Study's
  print is under way or the chapter in view is a draft's entry. (Featherboa prints in Source Sans 3 with Fraunces
  headings and the drop numeral, notes after the chapter in two columns,
  never cut, and a running head, footer, and page numbers in page-margin
  boxes, the end notice kept for browsers without them:
  `SITE-FEATHERBOA.md`, "Off the screen"; until it is built, this holds.)
  `PrintCredit.astro` adds the
  notice and the page's address ("litbible.net/john-3") at the end; it is a
  `hidden` element the stylesheet reveals, so no screen or screen reader ever
  meets it. Most rules are `!important` because page and component styles
  bundle after it. Check a change by printing real PDFs (headless Chrome's
  `--print-to-pdf` against a built `dist/`): the Browser pane cannot emulate
  print media, and four of the fixes here (Read View's phone-width
  gutter, superscripts opening up their lines, a long note held whole leaving
  a third of a sheet blank, and a poem held whole doing the same, E178)
  showed only on paper. **Nothing long is held whole**: a poem breaks
  between lines, a verse's first line kept with the next and neither end
  left with one line, and only a figure, an image or an article's quotation
  keeps `break-inside: avoid`. To see a break, push the text down with a
  spacer until the passage crosses a page, and print before and after. Two
  traps in that check:
  1. **Set print media and wait for the fonts before printing** (over the
     DevTools protocol, `Emulation.setEmulatedMedia` `{media: "print"}`, then
     `document.fonts.ready`, then `Page.printToPDF`). Crimson Text is used
     only in print, so a page laid out for the screen hasn't loaded it, and
     the PDF comes out in Georgia.
  2. **`pdftotext` can't see glyph changes.** Chrome's PDF maps a ligature
     glyph back to its letters, so a label drawn as "ﬀ" + "f" still
     extracts as "fff". Read the drawn glyphs from the content stream
     instead. That is how the footnote letters were checked when they got
     `font-variant-ligatures: none` (`global.css`, screen and print alike):
     Crimson Text and OpenDyslexic both join f+f, so "fff" read as a
     different label.
- **Edge clears every native radio after the print dialog closes** (E216),
  about 100 ms after `afterprint`, with no event and no script behind it, so
  a Print or Ctrl+P left the Sheets toolbar's Version and Paper choices and
  the Display tray's settings with no dot showing. `print-radios.js`
  (imported by `SiteHeader.astro`, so on every page) holds the radios checked
  at `beforeprint` and sets them back for three seconds after `afterprint`,
  only where nothing in their group is checked. **A new radio group needs
  nothing**, but a view must not depend on a radio's `checked` surviving a
  print: draw from its own variable, as `choices()` does. A check of print
  code that touches the page has to run in headed Edge (headless printing
  and dispatched print events never showed it).
- **"Copy with footnotes"** in the verse menu (`getHandoutText` in
  `chapter-tools.js`) copies the verses with each footnote letter kept as
  "[a]", the reference, each cited note in order, then the notice and the
  verse link. The verses join per `joinPieces`, so they match Copy text
  exactly apart from the letters; `blockText` keeps the letters only when
  handed a `notes` array. **The clipboard gets two flavors** (plain text and
  HTML), so italics and bold (the transliterated Greek in the notes, an
  emphasized word in a verse) survive a paste into Word, Docs or Mail. Copy text, a part's
  copy, the selection panel's Copy text and the glossary's Copy entry text do
  the same. Each verse piece
  carries `text` (plain) and `marked` (each `<em>`/`<i>` and `<strong>`/`<b>` run
  bracketed with private-use markers by `markEmphasis` in `handout-rich.mjs`), and `joinPieces(…, { rich: true })`
  joins the marked form. `src/lib/handout-rich.mjs` reads marked text as plain
  (markers removed, byte-identical to the old text) or as HTML (`<em>`,
  `<strong>`, `<sup>`). **Verse numbers and footnote letters are superscript in the
  HTML flavor** (BVJ, 2026-10-15): `joinPieces(…, { rich: true })` wraps each
  inline verse number in `VN_ON`/`VN_OFF`, and `blockText` and `assembleHandout`
  wrap a handout's footnote letters (in the text and before each note) in
  `FN_ON`/`FN_OFF`. Plain text reads as it always did ("17 God…", "[a]"), so the
  handout's letters are now marked, not literal brackets. Copy text carries no
  footnote letters, and a range's first verse number is left out of it, as in
  plain. Links and other markup stay plain on purpose; Copy link, Share text… and a verse image stay plain. A note's own blocks each take a line, which is what
  keeps the 1 Corinthians 11 chiasm outline legible. Notes skip the
  bracket-marker strip (`tidyLines`, not `cleanForShare`), since a note is
  quoted as it stands. Both layouts go through `assembleHandout`.
- **The selection bar copies a handout too** (`selectionHandout`), wherever
  it opens, so a handout can start mid-verse. In a LIT pane on /desk the
  handout reads the notes from the chapter's page, fetched when the bar
  opens (the view's `scope`, `chapter-tools.js`). Three things make that
  work:
  1. **A selection's ends are recorded as counts, not DOM positions**: how
     many characters of the verse come before each end, with verse numbers,
     footnote letters and all whitespace left out (`countable`). Both views
     render the same source, so those characters match on both pages even
     where their whitespace differs. A verse whose text doesn't match is taken
     whole rather than guessed at.
  2. **The end moves past a footnote letter on its last word**, with any
     punctuation between (`extendOverNotes`), so selecting a word brings the
     note that hangs off it. Any letter, digit or space stops that.
  3. **The clipboard write starts during the tap**, with the text as a
     promise (`copyLater`), because Safari refuses a write that begins after
     the fetch. Where a browser won't take that form, it waits for the text and
     writes it then.

## Search

- **Search is two engines behind three client modules** in `src/scripts/`:
  - *Scripture keyword search* scans `public/search/verses.json` (built by
    `build-verse-index.mjs`) in the client — verse-exact results ("John 3:16"
    → `/john-3#v16`), whole-word/phrase matching (hyphens/apostrophes are
    word boundaries, diacritics folded: "lema" matches "lemá"). Default
    ordering is relevance (`rankVerseHits`: exact-form matches above
    related forms, more occurrences above fewer), with Bible order as the
    /search sort toggle. The file also ships the corpus `vocab`, from which
    the client derives two niceties for single unquoted tokens of 5+ chars:
    related-form matching ("liberation" finds "liberate" — the vocabulary
    is stem-grouped at load with `src/lib/word-stem.mjs`) and typo
    correction on zero hits ("jeribulem" → results for "jerusalem", with a
    "showing results for…" note; deliberately conservative — see
    `nearestVocabWord`). Quoted queries, phrases, and short tokens stay
    exact. The file (~275 KB gzipped) is fetched lazily, only when a
    keyword search actually runs. Scripture chapter pages are deliberately
    NOT in the Pagefind index.
  - *Pagefind* covers glossary + articles + book intros; *topics* come from
    `public/topics-index.json`. Intro hits render in a dedicated "Book
    introductions" group (a fifth bucket from `bucketSearchResults`, Bible
    order, titled "Mark — Introduction") so they can't be confused with
    scripture results — an owner decision (2026-07-09). A book filter still
    skips Pagefind entirely (glossary/articles carry no book value; intros
    do, but book-filtered searches stay scripture-only by design).
  - Module split: `search-core.js` holds all logic that must agree between
    the SearchBar tray and the full `/search` page (book aliases, reference
    parsing, the verse-index scanner, Pagefind query building, bucketing,
    topics-index loading); `searchbar.js` is the tray UI (loaded by
    `SearchBar.astro`); `search.js` is the `/search` page UI. Never duplicate
    parsing/bucketing logic into the UI modules — add it to `search-core.js`
    so both surfaces stay in sync. A `type="search"` box must listen to
    `search` as well as `input`, since Escape and the clear button fire only
    `search` (the /search page and the Notebook's box do). The 404 page's
    `resolveMistypedPath` lives there for the same reason. The Greek's engine and loaders (`searchGreek`)
    are `search-greek.js`, loaded through `loadGreekSearch()` so no page carries
    them until a Greek search starts, desk on or off; never import that file
    statically from anything a page loads at the start (the rules are in
    `src/lib/greek-search.mjs`, which the Notebook's Greek tab shares). The
    Study Desk's Search pane (`desk/search-pane.js`) is a third UI over the
    same modules.
  - *A jump is one parse* (`parseReferenceJump`): a reference, a book, or a
    book's introduction ("Matthew intro", "Introduction to Matthew"; E123,
    BVJ 2026-11-12) as `{ kind: "book", bookKey, intro: true }`. The tray and
    /search then offer only the introduction (no second link), and the
    desk's Search pane opens its page in a new tab (E173).
    Otherwise /search's answer is "Go to John 3:16," and with the Study
    preview on a second row, "Study John 3:16," opens /desk at the passage
    (`/desk/?place=john-3:16`, a book at chapter 1, no `&layout=reading`); the
    tray's Enter goes and Shift+Enter studies (`studyHrefFor` in
    `search-rows.mjs`).
    The passage picker's field reads the same parse first (`readTyping`,
    `src/lib/passage-picker.mjs`), then the 404 page's guesser, and offers
    no Read View.
  - *Reference parsing* accepts a period as the chapter:verse separator
    ("John 3.16", the OSIS "John.3.16", "Rom. 8.3"): `cleanReferenceInput` turns
    a period **between two digits** into a colon before it strips the
    abbreviation periods. A comma between digits does the same ("John 3,16")
    only while no colon is present, because after one a comma lists verses
    ("Rom 8:28, 30").
  - *Index-only text is `aria-hidden`, never just `sr-only`.* The
    `pf-meta` spans in `ScriptureLayout`/`SearchLayout` and the glossary's
    `srOnly` keyword span and index block exist only to feed Pagefind.
    `sr-only` means the opposite (shown to screen readers alone), which is
    how readers heard "Glossary glossary Translation glossary…" and each
    heading's keywords read aloud. Pagefind reads the HTML, not the
    accessibility tree, so hiding them costs the index nothing.
  - *Pagefind searches metadata, not just body text.* A word in any
    `data-pagefind-meta` value makes that page a hit even though the span is
    `data-pagefind-ignore`, so **only put a meta on a page when something
    reads it, and never boilerplate shared by a whole page type.** That is how
    every intro matched "inclusion", "translation" and "lit" (a description
    meta naming the translation, now dropped). Three rules follow from it:
    1. **`image` is blanked site-wide** by `data-pagefind-meta="image:"` on
       the footer emblem (`SiteFooter.astro`). Pagefind takes the first
       `<img>` after the h1 anywhere on the page, which for intros was that
       emblem ("lit", "logo", "ring" on all of them) and for articles is a
       file name. No result shows an image. Only the static empty form
       overrides the capture; `data-pagefind-ignore` on the image and an
       empty meta element were both tried and don't.
    2. **Pagefind keeps one value per meta key**, so a list is one
       comma-separated span (`parseMetaList` splits it). One span per topic
       kept only the last.
    3. Text that belongs on the page but repeats across a page type gets
       `data-pagefind-ignore` at render: the "Takeaways on Liberation and
       Inclusion" heading ending most intros is stamped in `[book]-intro.astro`,
       and the intro files keep it plain.
  - */search is a field, one row of tabs, and the rows* (Featherboa, Phase 6;
    `SITE-FEATHERBOA.md`, "Search"). The field is the page (an sr-only "Search"
    heading), its count at its right end, and with the preview Notebook
    actions beside it; the field and everything under it share one column
    (`SearchLayout.astro`), whose size `.scripture-main` alone scales. Under
    it one row of kit tabs with
    counts (Scripture, Chapters about it, Glossary, Articles, Introductions;
    with the preview Notebook and Greek), a tab with none dimmed but still
    opening, the page opening on Scripture or the first tab with results; at
    the row's right end the book menu, the sort (Relevance, Bible order; book
    headings only in Bible order), and with the preview Select, on a line of
    their own when the tabs leave no room (queue Q76: seven tabs don't fit
    one row of the column). On a phone the tabs scroll sideways and the
    menus take the row under them. **The URL's `mode` is the tab**; the hidden `#searchbar-mode`
    select stays the state holder, so `search-core.js` is unchanged, and
    every kind is searched so every tab has a count. The Notebook tab is
    client-only state, not an address. **The rows are one module,
    `src/lib/search-rows.mjs`**, shared with the tray (tested once in
    `test/search-rows.test.js`): reading rows with the matched word bold and
    underlined in green, the reference answer first ("Go to John 3:16," then
    with the preview "Study John 3:16" at `/desk/?place=john-3:16`), then
    over the verses the glossary line and the chapters line. **The glossary
    line is only for an entry whose own word was typed** (its traditional
    word, a LIT word, or its transliteration: “Trust is in the glossary →”),
    and it is found in the term map SearchBar embeds in every page
    (`glossaryLineEntries`), never in Pagefind's results: Pagefind indexes
    /glossary as one page at `/glossary/` and names its entries only as
    sub-results, so a result's own address never says which entry it is
    (`test/search-page-lines.test.js`). When nothing else matched it
    follows “No results for …”. The tray shows the same
    rows and "See all results →" opens /search on the same tab. A new search
    surface takes its rows from that module. **"Build a search…"** is one
    quiet link in the field's row on the Greek tab only; it opens the
    `greek-commands.js` window, "Build a search," builder on top and
    "Examples and all commands" under it. Select (the Study preview) puts
    boxes on Scripture, Chapters, and Greek rows only while on, and a foot bar
    reads "3 chosen · Add to sheet… · Cancel" (`desk/sheets/search-sheet.js`).
    A topic card names the topics that matched it when they differ from the
    query (`topicMatches`, which the desk's Search pane calls too, E166).
  - *Every page has exactly one way in* (audit U6, owner 2026-09-28).
    `SearchBar` renders once per page (its ids, `site-search-input` among
    them, are fixed), so a page that carries its own box passes `pageSearch`
    to `Layout`: chapters, intros and drafts (through `ScriptureLayout`),
    `/search`, and the articles pages. The header's magnifier
    beside "Aa" is on every page but the Read page (HD-13) and /desk, whose
    search is a pane. **A chapter's or an introduction's way in is "Search"
    on the place line** (FP-27 to FP-31), which opens the box in place of
    the line (`place-line.js`), and `/` presses it. On a phone the line isn't drawn, and the bar's Search moves
    that same box into the top row while it is open (`phone-bars.js`), so
    the page still has one.
    Without JS the magnifier is a link to `/search`. With JS
    (`header-search.js`), on a page with its own box it takes the reader to
    that box; on any other it opens a strip under the header holding the
    ordinary `SearchBar`, so its results tray is the one chapter pages use,
    and Escape closes the tray and then the strip. Under 360px there is no
    room for a third header button (the short title ran 20–36px into them at
    320px, in every font), nor under 380px in OpenDyslexic beside its wider
    "Menu" (measured), so the icon moves into the menu sheet as its Search
    row, or leaves the page's own box as the way in. **A new page with its own `SearchBar` must pass
    `pageSearch`**, or it renders two. The passage picker's field is not a
    `SearchBar`: it goes to passages and offers a search of /search.
## Continue reading, reading on through a book, and keyboard shortcuts

- **"Continue reading" is one record, `localStorage['lit_last_read']`**
  (`{ v: 1, book, chapter, verse | null, view: "study" | "read", t }`), kept by
  `src/scripts/last-read.js`. A chapter's page writes it on arrival (at a `#vN`
  verse) and as the reader scrolls, taking the last verse number above the
  reading line, 10% of the way down the window (BVJ, 2026-10-29; it was 30%)
  but never above where a link to a verse puts its number (`readingLine`),
  which counts the scroll padding a phone's top row adds.
  On a page that has read on, the verse is the one at that line in
  whichever chapter holds it (read-on.js's `placeNow`). Read View wrote
  `view: "read"` records until it retired; they still lead to the
  chapter's page (`continueHref`, `lastReadHref`). Draft chapters are
  never recorded. **The passage picker offers it
  back as its first row** ("Continue: Romans 8"; FP-07, NX-12), with nothing
  to dismiss, unless it names the page being read; the menu sheet doesn't
  (PH-14). `ContinueReading.astro`, on Home until Phase 7 makes it Home's
  first row too (`SITE-FEATHERBOA.md`, "Nothing interrupts the reader"),
  is hidden until a record exists, so no JS or no storage means nothing
  renders, and its × forgets it everywhere. The record is unchanged. The Study Desk's LIT pane on /desk writes it too
  (`desk/desk-last-read.js`, through `saveLastRead`: the leading pane's place,
  `view: "study"`, after 500 ms, never a draft; BVJ, 2026-11-10). Each save also dispatches a `lit:last-read` window
  event, which only the Study Desk (places, when the preview is on) hears. The privacy page's storage paragraph names it: keep
  it there if the record ever changes shape or purpose.
- **A chapter's page reads on through its book** (`src/scripts/read-on.js`,
  its rules in `src/lib/read-on.mjs`; `SITE-FEATHERBOA.md`, "A whole book";
  WB-01 to WB-12, WB-29). With JavaScript the next chapter loads below once
  the last one's end is within 2.5 windows, and the one before loads above
  only on a scroll up near the page's top (a wheel or a drag up, ↑, Page Up,
  Home, Shift+Space), so a link to a verse never sets the page moving. Each
  chapter is fetched from its own built page and parsed, never run: its
  text, Go deeper and footnotes, every id prefixed (`john-4-v16`), in an
  `article.read-on__chapter`. **`article.chapter` is the page's own
  chapter alone**, so `article.chapter > .chapter-paragraphs` is always the
  page's text (`pageTextBox` in `desk/page.js`); a bare
  `.chapter-paragraphs` may be a chapter loaded above. A run of drafts is
  one entry, and a chapter that fails to load is one with "Try again."
  **The reader's line holds** when a chapter comes in above: the page
  scrolls by what was added (scroll anchoring is off, `reading-page.css`,
  **on body as well as the root**: off on the root alone, Chrome kept a
  reader at the page's very end at the new end as each chapter arrived,
  so every one called for the next).
  **The address follows the chapter at the reading line by
  `replaceState`**, only when the chapter changes (Safari limits how often
  it may be called), so Back leaves the book; from then on
  `history.scrollRestoration` is manual and `pagehide` keeps the verse in
  `history.state.readOn`, which a reload or Back lands on. The line, the
  phone's row, the title, the picker, and the progress line follow it
  (`src/layouts/CLAUDE.md`), and Continue reading asks `placeNow`. **The
  arrows are answered in the page**: they load the chapter if need be and
  land on its heading, instantly, with focus on it; into another book they
  are links as ever. A loaded chapter gets the page's tools
  (`attachChapter`, `attachTermLens`), and `lit:read-on` (`{ type:
  "loaded", book, chapter, box }`, then `"place"` as the reader moves)
  tells the Study Desk, which takes the reading column as one of its texts
  (`desk/page.js`), so marks and margin notes draw on every chapter;
  nothing here imports the desk. Go deeper in a chapter's heading scrolls to
  its section, or where the Notebook panel runs (the section is out of the
  flow there, `reading-page.css`) sends `lit:desk-command`
  `show-this-chapter`, which opens This verse at "This chapter." Without
  JavaScript a page is one chapter with the way on at its foot.
- **Keyboard shortcuts** (`src/scripts/keyboard-shortcuts.js`, audit U4, owner
  2026-09-28): `/` search (the place line's Search on a chapter or an
  introduction, the bar's on a phone, a Search pane on /desk), `g` the
  passage picker (a `lit:picker-open` event that `passage-picker.js`
  answers), and
  ← → or `[` `]` for the
  previous and next chapter (the place line's ‹ ›, found by
  `.place-line a[rel="prev"]` / `[rel="next"]`, or on
  /desk a `lit:desk-chapter` event that `desk-page.js` answers by pressing the
  passage bar's arrow of the pane holding focus, else the leading LIT pane).
  On a chapter's page they go to the start of the neighboring chapter,
  loading it first (read-on.js answers the line's arrows).
  `h` is the Study Desk's "Hide my marks" and does nothing unless
  `html[data-desk]` is set; it only sends `lit:desk-hide`, so the desk's code
  stays out of this file.
  They are on by default, with a Keyboard switch in the Display tray
  (`localStorage['lit-shortcuts'] = 'off'`; no attribute on `<html>`, since
  nothing renders differently; Featherboa moves it to an All settings page
  every reader can reach from the tray, `SITE-FEATHERBOA.md`, "Display,"
  and until it is built it stays in the tray). **The switch is required, not a nicety**:
  single-key shortcuts fire when a speech-recognition user dictates a word
  (WCAG 2.1.4). They stand down while the reader is typing or working a control
  that owns those keys (a radio group, a menu, a grid, a dialog, the passage
  picker), whenever Ctrl, Alt or Cmd is held, and the arrows also stand down
  whenever the page scrolls sideways, which is how someone zoomed in reads
  along a line.
