# Client-side reader tools (`src/scripts/`)

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory. The Study Desk's own rules are in `desk/CLAUDE.md`.
> Cross-references such as "below" or "rule 15" were written when all of
> this was one file, so they may point into another area file; the root's
> index says which file holds each section.

## Module map

From the root's project tree.

```
  scripts/           # CLIENT-side vanilla JS (chapter-tools, read-mode,
                     #   search-core + searchbar + search — see Search below;
                     #   lit-panel, the one floating panel every reader tool
                     #   shares; ref-preview, scripture reference previews;
                     #   last-read + continue-reading, "Continue reading";
                     #   term-lens, the Study View term underline and card;
                     #   header-search, the header's search strip;
                     #   keyboard-shortcuts; verse-image, which draws and
                     #   hands on "Make an image"; glossary-entry-links, the
                     #   copy-link buttons on /glossary; glossary-selection,
                     #   its selection panel; panel-pieces, what every
                     #   panel is built from; keep-reading-place,
                     #   which holds the reader's line through a reflow;
                     #   float-window, a window that stays open until
                     #   answered or closed (the desk's tour offer, and
                     #   greek-commands, the Greek search commands window);
                     #   desk-gate + desk/, the Study Desk preview, and
                     #   desk-frame, what every page knows about its panel;
                     #   see "The Study Desk preview" below)
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
resolves in Read View too — `rewriteVerseIdsAndAnchors` rewrites only
`id="vN"` and leaves them alone.

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
actions, two ways in" below), for a half-sentence, a phrase crossing two
verses, or part of a poetry quotation. It runs in **both views**, and in
Read View it is the only such tool: that view's verse numbers stay plain
text, because the verse menu belongs to the chapter's Study View page (owner,
2026-09-28). In Read View a selection is clamped to the first chapter it
touches, since one reference names one chapter, and every link it produces,
Copy link's included, is the Study View verse link (`/john-3#v16`), never a
Read View anchor.
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
   pinned to the bottom edge was tried first and rejected on a real phone**:
   it was easy to miss, and it covered any selection made near the bottom of
   the screen.
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
screen-reader route to the same copy (in Study View; Read View has none).

### One set of actions, two ways in

The verse menu and the selection panel offer **the same actions under the
same names** (owner, 2026-09-29): **Copy text** (the words, the reference and
the verse link), **Copy link**, **Copy with footnotes** (the handout; see
"Printing and handouts"), **Share…** and **Make an image**. Until then the
verse menu said "Copy verse", which can't name half a verse, and the
selection panel said "Copy with reference" and had no Copy link. The labels
are kept short on purpose, so the three copies fit one row on a phone. Only
the verse menu's extras are its own: "Or copy one part" and the range hint,
both about whole verses. Both panels build from the same pieces
(`menuButton`, `shareButton`, `imageStep`, `panelRow`; the shared ones are in
`src/scripts/panel-pieces.js`), so keep them in step.

**The glossary has a selection panel too** (owner, 2026-10-09), for every
reader: selecting words in an entry's definition offers **Copy entry text**
(the words, "— Glossary: Flesh (LIT)" and the entry's link) and **Copy entry
link** (`src/scripts/glossary-selection.js`). It is Study View's selection
panel in miniature, built from `panel-pieces.js` with the same settling,
placement, word snapping and never-take-focus rules, clamped to one entry's
definition. It sends `lit:panel-actions` (`view: "glossary"`), so the Study
Desk adds its "My Notebook" row to it as it does in scripture. The entry's
copy-link button says what it does twice over: hover text ("Copy link to this
entry") and a copy icon with a chain on its front sheet (owner, 2026-10-09).
It was a bare chain until then, which reads as a link that goes somewhere.

**Opened by a finger, both use the chip layout** (`.lit-panel--chips`): tinted
buttons side by side in rows (`panelRow`), the three copies in one and
Share… with Make an image in the next. The owner's rule is that **every
row with two buttons is split the same way**, in either panel: exact halves.
Three share their row evenly without going narrower than a label. A missing
Share… (no share sheet) leaves Make an image the whole row, and once pressed
its questions take the row over from Share…, so the panel keeps its height.
A label never breaks: a button too wide for its share wraps to a line of its
own, which is a one-button line, not a two-button row split differently.
OpenDyslexic's chip buttons carry 4px of side padding rather than 8px for
that reason (it sets only their minimum width). Measured in 2026-09, Share…
and Make an image still take a line each in the phone sheet below 375px
(360px Androids) and in the selection panel below about 400px.

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
For a day a finger's menu ignored taps elsewhere, so the text under it could
be tapped; the owner found that annoying in practice (2026-09-29), and the
sheet's scrolling and the card's drag keep that text within reach anyway.
Every verse menu has a ×, and every one beside its number drags by its
header (the grip), because a menu moved off the text needs its own way to
close. Extending a range reopens the menu where it was put. A mouse never
gets a sheet, even in a narrow window, and neither does a mouse selection.

The phone sheet was picked from four mocked placements (2026-09-29): the old
sheet of full-width rows, which covered about 40% of the screen and the
tapped verse itself whenever that verse sat low; this compact sheet; and two
that floated beside the verse number, pinned and draggable. The selection
panel keeps its own placement (decision 1 above) and closes when the
selection clears.

### Verse images

**"Make an image"** closes the verse menu and the selection panel, so it
works in both views (audit X8, owner 2026-09-28). It draws the passage in the
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
   "Make an image", then Ink or Paper, then Square or Story, then the share
   sheet or the download. Each question is one row the height of a button,
   so the panel never moves while it changes.
2. **Two looks**: Ink, the share cards' own palette, and Paper, its light
   sibling. **Both sizes**: 1080 square and 1080×1920 story, whose content
   stays inside the area Instagram's own controls leave clear.
3. **The verse in Crimson Text**, the reference in Fraunces, the wordmark and
   address in Inter. The text is Copy text's (`joinPieces`, footnote letters
   and bracket markers gone, poetry kept as lines) without the inline verse
   numbers, since the reference names the verses.
4. **The chapter's own address** on the image ("litbible.net/john-3"), always
   the site's name whatever host drew it. The owner counts it as the link back
   the license's social-media exception asks for. The share sheet also gets
   the same text Share… sends, link included.
5. **Length is measured, not counted.** The text is set at the largest size
   that fits, lines balanced, down to a floor that stays readable where the
   image is seen (40px on a square, about 13px in a phone's feed; 44px on a
   story), and a size whose floor can't hold it isn't offered. About 100
   words of prose fit a square and 135 a story; poetry fits less. When
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
notice there or nowhere.

- **`src/styles/print.css`** (imported by `Layout.astro`, all `@media print`)
  prints a chapter, an intro or a whole Read View book as text and notes
  only: black on white in any theme, Crimson Text (a reader's accessibility
  font prints as chosen), 12pt times the Display tray's text size, with the
  header, tools bar, Previous/Next, panels and Read View's toolbar gone.
  The footnotes stay the endnote list they are on screen, and the SBLGNT
  notice still prints after the text on all three. `PrintCredit.astro` adds the
  notice and the page's address ("litbible.net/john-3") at the end; it is a
  `hidden` element the stylesheet reveals, so no screen or screen reader ever
  meets it. Most rules are `!important` because page and component styles
  bundle after it. Check a change by printing real PDFs (headless Chrome's
  `--print-to-pdf` against a built `dist/`): the Browser pane cannot emulate
  print media, and three of the fixes here (Read View's phone-width
  gutter, superscripts opening up their lines, a long note held whole leaving
  a third of a sheet blank) showed only on paper. Two traps in that check:
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
  plain. Links and other markup stay plain on purpose; Copy link, Share… and a verse image stay plain. A note's own blocks each take a line, which is what
  keeps the 1 Corinthians 11 chiasm outline legible. Notes skip the
  bracket-marker strip (`tidyLines`, not `cleanForShare`), since a note is
  quoted as it stands. Both layouts go through `assembleHandout`.
- **The selection bar copies a handout too** (`selectionHandout`), in both
  views, so a handout can start mid-verse. Read View prints no footnote
  letters and has no notes on the page, so there the handout reads them from
  the chapter's Study View page, fetched when the bar opens (`readingView` in
  `chapter-tools.js`). Three things make that work:
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

## Conventions

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
    so both surfaces stay in sync. The 404 page's `resolveMistypedPath` lives
    there for the same reason, and so do the Greek's loaders (`searchGreek`;
    the rules are in `src/lib/greek-search.mjs`, which the Notebook's Greek
    tab shares).
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
  - */search opens with jump links* under the count ("117 verses · 47
    chapters by topic · 24 introductions · …"), verses first because their
    group sits last. They scroll and focus the group in script rather than
    following the hash, since a fragment navigation fires `popstate`, which
    re-renders the results. A topic card names the topics that matched it
    when they differ from the query (a loose one-word match).
  - *Every page has exactly one way in* (audit U6, owner 2026-09-28).
    `SearchBar` renders once per page (its ids, `site-search-input` among
    them, are fixed), so a page that carries its own box passes `pageSearch`
    to `Layout`: chapters, intros and drafts (through `ScriptureLayout`),
    `/read`, Read View, `/search`, and the articles pages. Every other page
    gets a search icon beside the header's "Aa". Without JS it's a link to
    `/search`; with JS (`header-search.js`) it opens a strip under the header
    holding the ordinary `SearchBar`, so its results tray is the one chapter
    pages use, and Escape closes the tray and then the strip. Under 360px there
    is no room for a third header button (the short title ran 20–36px into
    them at 320px, in every font), so the icon moves into the phone menu as
    "Search". **A new page with its own `SearchBar` must pass `pageSearch`**,
    or it renders two.
- **"Continue reading" is one record, `localStorage['lit_last_read']`**
  (`{ v: 1, book, chapter, verse | null, view: "study" | "read", t }`), kept by
  `src/scripts/last-read.js`. Study View writes it on arrival (at a `#vN`
  verse) and as the reader scrolls, taking the last verse number above 30% of
  the viewport; Read View writes it whenever it saves its own per-book
  resume position. `read-mode.js` is loaded through `?url`, so Vite serves it
  unbundled and it **cannot import**: it announces each save with an
  `rm:position` event, and a bundled script in `read/[book].astro` records
  it. Draft chapters are never recorded. `ContinueReading.astro` (home title
  block, top of /read) and a button in the phone menu offer it back, hidden
  until a record exists, so no JS or no storage means nothing renders; the ×
  forgets it everywhere. Each save also dispatches a `lit:last-read` window
  event, which only the Study Desk (places, when the preview is on) hears. The privacy page's storage paragraph names it: keep
  it there if the record ever changes shape or purpose.
- **Read View lands on a link instantly, then holds it.** `/read/<book>` is
  the whole book on one page, tens of thousands of pixels tall, so arriving at
  `#ch-10` (Study View's "Switch to Read View") or `#luke-10-v25` (search)
  is fragile: any height change above the target after the jump (a web font
  finishing, the Android banner) slides the text under a fixed scroll offset,
  and Safari has no scroll anchoring to undo it. (The reader's text size is
  not one of them: the Display tray applies it before first paint.)
  `landOnHash` in `read-mode.js` therefore jumps without animation (the
  stylesheet's `scroll-behavior: smooth` is overridden for that one call, since
  an animated scroll fixes its destination when it starts) and re-lands on
  every resize of the text until the reader scrolls, touches, clicks or types.
  Don't make that first landing smooth again: this replaced it after the owner
  saw the switch land "at random places within the book" (2026-09-27).
- **Keyboard shortcuts** (`src/scripts/keyboard-shortcuts.js`, audit U4, owner
  2026-09-28): `/` search, `g` Go to passage, and ← → or `[` `]` for the
  previous and next chapter (Study View's top Previous/Next, found by their
  `rel="prev"` / `rel="next"`, or the neighbouring `#ch-N` in Read View).
  `h` is the Study Desk's "Hide my notes" and does nothing unless
  `html[data-desk]` is set; it only sends `lit:desk-hide`, so the desk's code
  stays out of this file.
  They are on by default, with a Keyboard switch in the Display tray
  (`localStorage['lit-shortcuts'] = 'off'`; no attribute on `<html>`, since
  nothing renders differently). **The switch is required, not a nicety**:
  single-key shortcuts fire when a speech-recognition user dictates a word
  (WCAG 2.1.4). They stand down while the reader is typing or working a control
  that owns those keys (a radio group, a menu, a grid, a dialog, the picker's
  popover), whenever Ctrl, Alt or Cmd is held, and the arrows also stand down
  whenever the page scrolls sideways, which is how someone zoomed in reads
  along a line.
