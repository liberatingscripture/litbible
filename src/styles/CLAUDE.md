# Styling, theming and the Display tray

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory. These rules also govern `<style>` blocks in components and layouts.

## Fonts and theming

- **Three faces, one job each** (Featherboa, `SITE-FEATHERBOA.md`, "Type"),
  named by tokens in `tokens.css`: `--font-display` (Fraunces Variable, with
  all four axes: titles, headings, panel and pane titles, at 400 for a page's
  title and 500 for the rest), `--font-text` (Source Sans 3 Variable:
  everything read, its polytonic Greek included), and `--font-control`
  (Atkinson Hyperlegible Next Variable: controls and small labels). **A
  stylesheet names a token, never a family**; `test/featherboa-fonts.test.js`
  allows only the three, `inherit`, a monospace stack, and the Display tray's
  two `!important` stacks. Each stack ends in a fallback face fitted to its
  webfont (`faces.css`), so the swap moves nothing. Fraunces's softness and
  wonk (`--fraunces-heading`) are set once on `body`; the other faces ignore
  the axes. The tray's OpenDyslexic and Atkinson still replace all three.
  Playpen Sans is the Study Desk's margin-note face until Phase 4 (the notes
  then follow the Display face: "The reading page"). Every face is served
  Latin only, save Source Sans 3's Greek, from rules written out with their
  ranges rather than the packages' CSS (see "Greek and Hebrew letters").
  **Inter, Crimson Text, and the static Fraunces** stay declared in
  `legacy-faces.css` for what moves later: printing, the handouts, and the
  verse image (Phase 8), and a sheet's stored faces, paper, slides, and files
  (Phase 11), each listed in the fonts test's `LATER` map, which each phase
  empties; and /apps, whose mirrored files name Inter and Crimson, pinned at
  their old values in `pages/apps-legacy.css`. Delete an import there when
  the last thing that names its face has moved.
- **Featherboa's tokens are in `tokens.css`**, imported before `global.css`:
  the colors by role (`--color-page`, `--color-text`, `--color-mark`,
  `--color-press`, `--color-own`, `--color-danger`, the hairline, two tints,
  the float), the ten sizes, the spacing steps, the columns, two radii, one
  shadow, and the speeds. `global.css`'s older names (`--text`, `--page-bg`,
  `--green-text`, `--ink-rgb`, `--surface-raised` and the rest) point at
  them; new code uses the tokens. `test/featherboa-tokens.test.js` holds the
  values to the record, and `test/featherboa-contrast.test.js` works out the
  record's contrast table from them, by day and by night.
  - **A gray is the text at a strength**, never a gray of its own: the
    second ink `rgba(var(--ink-rgb), var(--text-2-alpha))` (secondary
    words), the third `var(--text-3-alpha)` (counts, dates, notes, disabled
    words, placeholders), or full ink. Night sets its own strengths. Tokens
    built on others resolve on `:root`, so **a surface that pins `--ink-rgb`
    for a fixed theme pins the two alphas too** (`.sheet-copy` at the day's,
    `.present-stage` at the night's, in `sheets-page.css`).
  - **Space sets things apart first, a hairline second
    (`--color-hairline`), a tint third** (`--color-tint`); no ornament.
    **One shadow, `--shadow-float`, and only on what floats and goes away**
    (menus, popovers, the Display tray, dialogs), with `--color-float` and
    the `--color-float-edge` hairline; night drops it for a lighter float.
    A card or a docked panel takes a hairline. The Study Desk's button
    kinds keep their shadows until the kit (Phase 2).
  - **Motion is four speeds on one curve** (`--ease`): Quick
    (`--dur-quick`) for menus, popovers, and tooltips; Settled for notes,
    panels, and bars; Large for sheets, dialogs, and present mode; leaving
    takes two thirds as long (`--dur-*-out`). **Pointing, pressing,
    selecting, toggles, and chevrons are Instant: no transition at all.**
    Nothing loops, and reduced motion zeroes every duration in
    `global.css`. A script that animates uses the same numbers and says
    which token in a comment (`verse-image.js`). `test/featherboa-motion.test.js`
    holds stylesheets and scripts to this.
  - **LIT Green marks and is never behind words; deep green is only for
    what can be pressed; the cream (`#E1DFD9`) is gone** and the page is
    the paper everywhere. Home's green sections wait for Phase 7.
- **Theming (light/dark) is a dual mechanism.** Dark-mode tokens are declared
  twice — `@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]) … }`
  (follow the OS) and `:root[data-theme="dark"] … }` (explicit override) — in
  `tokens.css` and `global.css` and mirrored in a few page stylesheets and
  components; `test/featherboa-css-rules.test.js` fails on a rule written
  only once, on one whose two halves differ, and on a bare media query. The header "Aa" tray (`SiteHeader.astro`, heading
  **"Display"**, the one panel for every reader setting; see "The Display
  tray," below) holds Theme: a 3-state control
  (**System / Light / Dark**) persisted in `localStorage['lit-theme']`
  (`light`/`dark`; **key absent = System**). `Layout.astro` stamps `data-theme`
  on `<html>` in a pre-paint `is:inline` script (beside the font one) and
  mirrors `documentElement.style.colorScheme`, so there's no flash; its inline
  `criticalCSS` carries the same guarded pair so a forced theme wins the first
  paint. No JS → no attribute → OS pref governs. When adding a dark-mode style
  anywhere, use BOTH selectors or the toggle's "force light/dark" states will
  leak. In an Astro-scoped `<style>`, write the root half as
  `:global(:root:not([data-theme="light"])) .x` (as `ScriptureLayout.astro` and
  the `/apps` components do), so the scoper leaves `:root` alone. The bare
  media query is the common slip: three components shipped with it, which gave a
  reader who forces light on a dark OS the dark values under light-mode colors.

## The Display tray

- **The reader font is a Display tray setting too, and works the same way.**
  A 3-state radio list (**Default / Atkinson Hyperlegible / OpenDyslexic**,
  each option set in the font it selects so the list previews itself) writes
  `data-font` on `<html>` (`dyslexic` | `atkinson`; **attribute absent =
  default fonts**) and persists to `localStorage['lit-font']`, with a pre-paint
  `is:inline` script in `Layout.astro` to avoid a flash. Two audiences, not one:
  OpenDyslexic anchors letter shapes for dyslexic readers, Atkinson
  Hyperlegible disambiguates confusable characters for low-vision readers.
  Three rules:
  1. The pre-paint script **also reads the retired boolean
     `localStorage['dyslexic-font']`** as a fallback, so readers who enabled
     OpenDyslexic before the three-way control shipped aren't reset. The tray
     deletes that key on any font change. Don't drop the fallback.
  2. Each `html[data-font=…]` rule overrides `font-family` on `*` with
     `!important`, so **the tray's own preview labels carry `!important` too** —
     otherwise the list renders entirely in the active font and previews
     nothing.
  3. The width compensations are scoped to `[data-font="dyslexic"]` **only**.
     OpenDyslexic is far wider than Source Sans 3; Atkinson is not, and must not
     inherit them. They live in `home.css` (hero titles, the hero scroll's
     safe interior, the question CTA), `global.css` (mobile nav, the header's
     earlier nav collapse + phone title scale, the footer newsletter field
     above 721px, the reader panels' chip buttons' side padding),
     `ReadMenu.astro` (grid floors), `read-mode.css` (Read View's toolbar
     floor and its sheet buttons' side padding), and `SiteHeader.astro` (the
     forced short title). Prefer **buying back space over shrinking type** —
     an accessibility font is the last thing that should be made smaller. The
     header hands the nav to the hamburger below 1400px rather than
     compressing it; the hero scroll's interior is widened before its type is
     eased; only the phone-width header title, where there is genuinely no
     space left, scales down.
     The one shared mechanism is the **callout CTA**: the clamp that keeps it
     inside the viewport applies to every font, and only its `--cta-overhang`
     value is per-font. Don't re-scope it to dyslexic — it overflows in all
     three.
  4. **A word wider than its column can't be centred** — the line box pins to
     the content edge and the word spills right, and text overflow adds to
     `scrollWidth` without widening any element's box. This has bitten three
     places on the home page alone (`.title-large`, the hero quote, the
     overlay's "Commitments"), always as "the text looks pushed right" plus
     unexplained horizontal scroll. When hunting it, **bisect by hiding
     sections** — an element-by-element scan for overflowing boxes finds
     nothing, and `position: fixed` overlays report as false positives.
     Fix by giving the word room, not by breaking it: `overflow-wrap` and
     hyphenation split words, which is the opposite of what dyslexic readers
     need. **The one exception is a run that is not a word**: a raw web
     address in a footnote has no break point and no room to give, and it
     scrolled Chapter View sideways on a phone (Matthew 5, 1 Corinthians 14,
     John 11, Romans 1). `.footnotes .fn-body` (`[slug].astro`) and
     `.lit-panel__body` (`global.css`) carry `overflow-wrap: anywhere`, which
     breaks a run only after every hyphen and space has been used and only
     when it cannot fit a line by itself. Never `word-break: break-all` or
     hyphenation, and don't carry the rule to a page's body text.
- **The hamburger menu is a side tray on a computer** (BVJ, 2026-11-04):
  under `@media (hover: hover) and (pointer: fine)` the `.menu-overlay` panel
  slides in from the right over a lighter scrim, a narrow desktop window
  included. Touch screens keep the full-screen menu (Featherboa makes the
  phone's a sheet rising from its bottom bar, `SITE-FEATHERBOA.md`, "The
  phone"; until it is built, this holds). The header stays above
  the scrim, so the toggle is the close button. Either way the menu lists
  header C's groups under headings (`.menu-overlay__group`, S12 step 5), its
  Study group only with `html[data-desk]`.
- **Text size, line spacing, verse numbers, footnote letters and key terms
  are the rest of the Display tray**, and follow the font's pattern exactly:
  an attribute on `<html>` stamped before first paint by `Layout.astro`,
  absent for the default, mirrored to one `localStorage` key each
  (`data-size` sm | lg | xl in `lit-size`; `data-leading` roomy in
  `lit-leading`; `data-vn` off in `lit-verse-numbers`, or `lit-read-numbers`
  in Read View (rule 6); `data-fn` off in
  `lit-fn-letters`; `data-terms` off in `lit-terms`, the term lens's
  switch, which Chapter View alone shows; with the desk preview on, the tray's
  Show group also gains the desk's own switches, "My highlights" among them,
  injected by `desk/note-settings.js` and sharing the Notebook panel's stored
  setting). (Featherboa keeps text, size as four steps, line spacing with
  Justify under it, theme, and a "View" group whose desk switches merge into
  one "Your marks," and moves the rest, the Keyboard switch and "Reset
  widths" among them, out of the tray: `SITE-FEATHERBOA.md`, "Display";
  its verse-numbers switch becomes "Verse and chapter numbers" and hides
  the chapters' headings too, as a desk pane's does: "A whole book"; until
  it is built, this holds.) There is **one
  panel**: Read View's toolbar "Aa" opens this same tray (it's a
  `data-font-toggle`, like the header's two), which opens upward when there
  is no room below. Six rules:
  1. **They reach every page of running text, and what a thing is decides
     how far** (BVJ, 2026-11-12, for preference and for accessibility; before
     then only the scripture pages and article bodies followed). Three scales, each a custom property on
     `<html>` in `global.css`. Every rule multiplies its own default by one
     of them, or adds the line-spacing extra, so Medium and Normal change
     nothing anywhere:
     - **`--reading-scale`** (16 / 18 / 20 / 23px at the 18px body size) and
       **`--reading-leading-extra`** (what "Roomy" adds) are for words a
       reader reads: Chapter View, book intros, Read View, article pages,
       the glossary, /search's results, the release notes, About, Privacy,
       Translation Commitments and the Collective's page, the source-text
       notice, and the three panels of text (a footnote's popover, a key
       term's card, a reference preview). The extra goes on every block
       that can wrap; a title, a one-line label and a button keep their line.
     - **`--heading-scale`** is the same scale for a page's title, except on
       a phone (640px and under), where a title never grows past its own
       size. It is the largest type on its page and can't break a word, so
       "Thessalonians" or "Commitments" a step larger is wider than the
       screen. A heading of short fixed words ("Footnotes", "Chapter 3")
       takes `--reading-scale`.
     - **`--control-scale`** is the gentler one for controls whose words sit
       on one line in a fixed width: the verse menu and the selection panel,
       the passage picker's list, Read View's toolbar and resume chip. It
       never shrinks a control (Small leaves it alone) and stops at the Large
       step, since the full Extra large step pushes a label out of its tile.
       **On a phone (640px and under) it stays 1**: the sheets' two-button
       rows and the picker's grid are fitted to the screen there, and the
       larger label cost each a row when measured. What holds such a label
       grows by the same factor (the picker's panel and tile floors, the
       toolbar's width floors, a panel's width).

     **Left to browser zoom, on purpose**: the header and its menus, the
     footer, the Display tray, tooltips, buttons and form fields, and
     Chapter View's tools row (its labels are 16px already, it sits above the
     text, and its one-row phone layout and 245px pills are what a larger
     label breaks first). So are the designed pages of short display type:
     home, /read, /courses, /support, the contact forms, the podcast page,
     the articles index, and /apps, which is mirrored with the LSC site.

     **A floating panel takes the size from `--panel-scale`**, not by
     inheritance, because it hangs off `<body>` outside every column:
     `.lit-panel` sets it to 1, `.lit-panel--menu` to `--control-scale`, and
     `.lit-panel--footnote` (the three panels of text) to `--reading-scale`.
     Every size in a panel multiplies by it, and `lit-panel.js` reads the
     panel's width back from its `max-width` (`panelMaxWidth`) instead of
     keeping its own 380.

     **Making a page follow**: give its outermost content element
     `font-size: calc(1em * var(--reading-scale, 1))`, wrap each rem, px or
     `clamp()` size (`calc(1.3rem * var(--reading-scale, 1))`), and leave
     each em size alone, since it now inherits the scale. **Once, never
     twice**: the glossary's entries once sat in a `.wrap` inside another
     `.wrap`, both scaled, and took the size twice (29px for 23). A button inside a scaled element undoes it
     (`calc(1em / var(--reading-scale, 1))`), and a mark keeps its size (the
     Collective's lockup). **Then check OpenDyslexic at Extra large at 320
     and 375px**, the case that breaks: a long word leaves the screen, and
     no element's box shows it (rule 4 of the font's list, above), so scan
     the text itself (a `Range` over each text node, its rects against the
     window's width).

     **The Study Desk follows the size whole**, its own words and controls
     included, through a variable set from `--reading-scale` only where it
     applies: the /sheets page (`--sheet-ui`, E101) and the /collections
     page, which sets it the same way (E188), and /desk's panes, the
     Notebook panel beside a chapter, the /notebook page and the rows the
     desk adds to /search's results (`--desk-ui`, E109 and E110, with
     `--desk-leading` for line spacing, which /sheets does not follow). The
     rules are in `src/scripts/desk/sheets/CLAUDE.md` and
     `src/scripts/desk/CLAUDE.md`; a size added to `desk.css` in rem
     multiplies by one of them, and a block of text there adds
     `--desk-leading` to its line height. The public glossary scales its own
     large type; the desk's look of it restates the type in em of one scaled
     column (the end of `pages/glossary.css`).
  2. **Size goes on the same element as the column's width**, so the width
     (in `--ch`, an em fraction) grows with the text and a line keeps its
     length in characters. Putting the size on the paragraphs instead would
     shorten the line at every step up. The article page is the one
     exception: its width is on the card and its size on the body inside, so
     `--article-width` multiplies by `--reading-scale` itself.
  3. **Read View used to keep its own three settings** (`lit_rm_fontSize`,
     `lit_rm_lineHeight`, `lit_rm_markers`). The pre-paint script still reads
     them as fallbacks and the tray deletes each on change, the same
     arrangement as `dyslexic-font`. Don't drop the fallbacks.
     `lit_rm_markers` is a fallback for Read View's numbers only (rule 6),
     so only a change made in Read View deletes it. Focus mode
     stayed in Read View's toolbar (`lit_rm_focus`).
  4. **A hidden verse number or footnote letter in Chapter View is still a
     control and a scroll target** (the verse menu's button, `#v16`, a
     footnote's backlink), so it is clipped rather than removed, stays in the
     tab order, and reappears while it has keyboard focus. The no-break space
     after a number is wrapped in `.vn-gap` at render (`markVerseGap` in
     `chapter-html.ts`) so it can hide too; left alone it doubles the gap
     before every verse. Read View is different: its numbers are not
     controls, and turning them off also hides the chapter headings, as its
     own button always did (hence "Verse and chapter numbers" there).
  5. **Scripture pages pass `scriptureControls`** down through the layouts:
     `"study"` from a chapter page with text, `"read"` from `/read/<book>`
     (numbers only, since Read View prints no footnote letters). Other
     pages don't show the "Show" group at all, /desk included: each LIT
     pane there has its own four switches on its bar (`desk/lit-show.js`,
     E108), which mark up that pane alone. **These three attributes on
     `<html>` are Chapter View's and never reach a LIT pane**: the rules
     keyed on them in `global.css` leave out a text that carries
     `data-own-marks`, as each chapter in a LIT pane does, and `desk.css`
     hides the same things by the pane's own attributes
     (`.desk-lit[data-vn="off"]`). A new rule keyed on the page's switch
     needs the same `:not([data-own-marks])`.
  6. **Verse numbers are one setting per view** (owner, 2026-09-30). Every
     other setting is the reader's everywhere; what a page shows depends on
     what the page is for. As one switch, hiding numbers to read a book
     straight through also hid them in Chapter View, where (rule 4) a hidden
     number is a 1px box a finger can't tap, and the verse menu vanished from
     touch screens with nothing on the page saying why. Chapter View reads `lit-verse-numbers` alone. Read View reads
     `lit-read-numbers`, then `lit_rm_markers`, then Chapter View's key, so
     it **follows Chapter View until the reader sets it**, and nobody's Read
     View changed when the switch split. That fallback is why the tray
     stores Read View's value as set, `'on'` included (`keep` in its
     `SETTINGS`): removing it at the default would hand the page back to
     Chapter View's choice. Layout.astro learns the view from
     `scriptureControls` through `define:vars`.
     **Chapter headings follow the numbers only where chapters run
     together** (BVJ, 2026-11-05; STUDY-DESK-FIXES.md E29): Read View and
     /desk's LIT pane, where numbers off means one unbroken text. Read View
     removes its headings (`display: none`, `read-mode.css`); the LIT pane
     hides its `.desk-lit__heading` the way rule 4 hides a number (`desk.css`):
     out of the flow, adding no height, still a heading, a link and a focus
     stop, shown over its chapter's first line while focused. E29's rule is
     that a heading may stay wherever it makes no visual break, so Read View's
     `display: none` could move to the same treatment. A Chapter View page is
     one chapter already, so its heading and `h1` stay whatever the setting.
  Changing any of these reflows the page, so the tray pins the block at the
  reading line and scrolls it back (`keepReadingPlace`, in
  `src/scripts/keep-reading-place.js`, which the Study Desk's panel uses
  too), and lets that one scroll through without closing itself
  (`isHoldingPlace`).

## Text columns and `--ch`

- **Text columns are sized with `--ch`, never the `ch` unit.** `ch` is the "0"
  advance of *whichever font is currently painting*, so every column here was one
  width under the metric-matched fallback face and another once the webfont
  arrived: the box resized and, being `margin: 0 auto`, re-centred, sliding the
  whole text block sideways mid-load (**0.256 CLS on scripture pages**, the
  site's worst Core Web Vital). `--ch` in `tokens.css` is an em fraction of the
  text face's "0" (Source Sans 3's is 0.497em), re-declared under
  `html[data-font="dyslexic"]` and `[data-font="atkinson"]`;
  because `Layout.astro` stamps `data-font` **before first paint**, the width is
  settled from the first frame and no font swap can move it. Write
  `calc(72 * var(--ch))` (still reads as "72 characters"). Beside it,
  **`--char`** is the face's average character, spaces included (measured
  over John 1), the unit a line's length in characters is counted in.
  `FIRST_PAINT` in `src/lib/desk-margin.mjs` restates the three `--ch` values,
  and `test/desk-margin.test.js` holds them together. Two shared widths:
  **`--reading-width`** for long-form reading (Chapter View, intros, Read
  View, article bodies), the text column itself, so a surface with side
  padding adds it on top. Featherboa's column ("Sizes, space, and the
  measure") is 660px (`--col-text`) held between 45 and 75 `--char` a line,
  so a larger size or a wider face shortens the count and the bounds hold
  it. **With the Study Desk on, it is still `--reading-measure` (60) × `--ch`**
  (`html[data-desk]` in `global.css`), because the desk's measures, its drag,
  and its pre-paint placement count in `--ch`, until the reading page takes
  the desk's margin (Phases 4 and 5). The article card is sized from it as
  well (`--article-width` on the article page), so the card's edges follow
  the text. The other width is **`--content-width`** (72 × `--ch`) for the
  pages around it (/read, /search, About, courses, commitments). Both are
  declared on `:root` and resolve their em against the element that uses
  them, so size a column where its text size is set (see the Display tray
  rules above). Two things to know before touching `--ch`:
  1. The values are **text-face figures**. A column set in Fraunces needs
     its own number, not this token.
  2. `--ch` is per-font rather than one constant because the accessibility fonts
     have **no metric-matched fallback** (both stacks end at plain `sans-serif`),
     which gave them the site's largest swings — ~10% for OpenDyslexic, ~16% for
     Atkinson. Pinning per font also preserves each reader's existing measure,
     notably OpenDyslexic's markedly shorter line: switching those readers to one
     shared width would have lengthened their line by ~26%, the opposite of the
     "buy back space" rule above.

## Greek and Hebrew letters

- **Greek and Hebrew letters come from faces registered by character
  range** (`src/styles/greek-hebrew-fonts.css`, Study Desk C27; the owner
  picked the faces 2026-10-05). Every site font loads Latin only, save Source
  Sans 3's own polytonic Greek (`faces.css`), so each rule there puts a Greek
  or Hebrew file under an existing family name, the way the ⟦ ⟧ patch does,
  and no font stack anywhere changes. In the text face Greek is Source Sans
  3's own (Atkinson and OpenDyslexic, which have none, take it too), and
  Hebrew is Noto Sans Hebrew. In Fraunces both come from Cardo. The retired
  faces keep theirs (Inter's Greek, Cardo under Crimson Text) in
  `legacy-faces.css` until they go. A file loads only on a page with its
  letters; `test/featherboa-fonts.test.js` checks that every face that sets
  text reaches both scripts at weights its Latin has. The file's header
  carries four rules, each learned by breaking it; the two that bite:
  1. **Copy the descriptors of a face the family already has.** A browser
     joins faces of one family by range only when weight and style match
     exactly, so a rule at a weight the family doesn't declare is never
     reached, or worse, catches text at that weight and drops its Latin. (A
     Hebrew rule at `100 900` under Inter, whose faces are 400 to 700, was
     never used, and Crimson's 600 skipped Cardo's 700.)
  2. **Write the ranges out; never import Fontsource's per-subset CSS** for
     this. Those files carry no `unicode-range`, so they claim every
     character and load on every page. Their Hebrew range also claims a
     hyphen and some combining marks Latin text shares, which are left out.
  Check a change with `CSS.getPlatformFontsForNode` over the DevTools
  protocol, on a built `dist/`: it names the file that drew each character.
  Printing needs `Emulation.setEmulatedMedia` set to print and the fonts left
  to load before `Page.printToPDF`. Otherwise headless Chrome prints fonts
  used only in print in their stand-ins, which looks like a failure.

## Brand colors, the emblem, and the LSC mark

- **The greens, by role.** `--green` (#209D50, LIT Green, `--color-mark`)
  is a mark: the emblem, the chapter numeral, "you are here," a launch's band
  on the front page, and non-button icon accents. It is never behind words
  (`SITE-FEATHERBOA.md`, "Color"). Phase 1 took it off every band but Home's
  (`.hero`, `.questions-block`, the chat, the callout, `body.bg-green`),
  which go in Phase 7; while they last they carry **ink** text (4.6:1) or
  white *large* headings, never small white text (3.5:1). `--green-deep`
  (#0F6B33, Deep Green) is the solid button's fill under **white** labels
  (6.6:1), fixed in both themes until the kit's filled button (Phase 2)
  takes the night's press green with dark words (`--color-on-press`).
  `--green-text` and `--link` are `--color-press`: deep green by day and
  #4DD383 by night, for text and links, never a fill under white words,
  which fail on it at night.
  **Keyboard focus rings are `--focus-ring`**, never a green written
  directly: `--color-press`, 2px (`--focus-width`), 2px off the control
  (`--focus-offset`). A focus indicator needs 3:1 against its surface: the
  ring is 6.3:1 on the page by day and 9.7:1 at night, where LIT Green
  manages 3.35:1 and translucent rings 1.4 to 2.0:1, so none is written by
  hand. The rings that use `--text` on purpose (the Display tray's options,
  whose selected segments are green) stay as they are. Don't kill a ring
  with `outline: none` on `:focus-visible` either: `/support`,
  `/liberating-scripture-collective`, the about TOC, and the launch
  popover's close button all did, which left keyboard users a 1px lift or
  nothing at all.
- **The site emblem ships as two SVG variants**, `public/images/lit-logo-2026.svg`
  (plain) and `lit-logo-2026-ring.svg` (with a `--green` band). Same glyph, same
  `#FAFAF8` disc — the disc is deliberately the `--surface-raised` token, so on
  the `bg="white"` pages (`/apps`, `/glossary`) the plain variant's disc
  disappears into the page and the mark loses its containment. **That's why every
  on-page use takes the ringed variant**, including the OG cards (which no longer
  draw a ring of their own — `build-og-images.mjs` composites the ringed asset at
  its full outer diameter). The band runs *outside* the disc rather than being
  stroked into it, so both variants keep an identical glyph-to-disc ratio
  (0.84422); if you resize one, preserve that. The plain variant is for contexts
  that supply their own frame or need every pixel at tiny sizes — the band
  degrades to a hairline below ~24px, which is why the **tab favicons use plain
  and the touch/manifest icons use ringed**. `lit-logo-2026-ring.png` (1000×1000)
  is the raster fallback for the default `ogImage` only. Every icon is generated
  from these two SVGs by `npm run build:favicons` — never hand-edit
  `public/favicon.*`, `apple-touch-icon.png`, or `web-app-manifest-*.png`, or the
  set drifts from the source. The retired emblem and its icon
  set are archived in `_source-images/retired-emblem-2024/`.
  The manifest itself, `public/site.webmanifest`, is hand-maintained (the
  script writes its icons, not the file), and it says **`"display":
  "browser"` on purpose** (owner, 2026-09-28): a home-screen icon opens the
  site in the browser, and no browser offers to install the website as an app
  beside the real iOS and Android apps (`standalone` is what made it
  installable). Don't set it back.
- **The LSC brand mark is a different mark, mirrored from
  liberatingscripture.org.** Don't confuse it with the site emblem above: that
  one is LIT's, this one is the *organization's*. The Liberating Scripture
  Collective's dove appears on three pages here —
  `/liberating-scripture-collective` (hero lockup), `/support` (donate band),
  and the home page's fourth question card — via `src/components/LscMark.astro`
  + `src/lib/lsc-mark.mjs`, both copied verbatim from the LSC repo, which owns
  the mark. **When it changes there, re-copy both files.** Nothing is generated
  on this side; LSC's repo carries the build script for its favicon/OG forms,
  and `build:favicons` here has nothing to do with it.
  Both marks sit on a disc, but they solve the light/dark problem in opposite
  ways, so don't cross the wires: the LIT emblem's disc is a *fixed* `#FAFAF8`
  (hence the ringed variant, so it stays contained on near-white pages), while
  the LSC dove's is an *inverted coin* — the disc opposes the surface and the
  dove opposes the disc, driven by `--lsc-mark-disc` / `--lsc-mark-bird` in
  `global.css` (declared in all three blocks, per the dual-mechanism rule
  above). A surface that is a fixed darkness in **both** themes must pin its own
  pair locally or the mark disappears into its own background in one theme —
  `.questions-block` (a fixed `--green` band) does exactly that in `home.css`.
  Inline SVG is load-bearing here: an `<img src>` to an external SVG can't read
  these custom properties at all.

## Focus rings and field borders

- **The focus ring pins on fixed surfaces the same way the dove does.** An
  outline is drawn *outside* its element, on the parent's surface, so what
  decides its contrast is whatever the control sits on, never the control's own
  fill. `--focus-ring` follows the theme, which is right on every themed
  surface; a surface that is a **fixed colour in both themes** has to pin its
  own value, in the same rule that sets its background where it can. The rule
  is **pin where focusable controls sit directly on the fixed surface**, and
  nowhere broader: a pin inherits, so pinning `body.bg-green` would push ink
  into the home page's themed sections and footer, where it fails in dark mode.
  That's why the green header pins on `.site-header__inner` (the font tray and
  menu overlay share its `<header>` with surfaces of their own). Measured with
  the WCAG 2 formula:

  | Surface | Pinned where | Ring | Contrast |
  |---|---|---|---|
  | LIT Green header bar (`body.bg-green`, home, until Phase 7) | `global.css`, on `.site-header__inner` | `--ink` | 4.58:1 |
  | Skip link, which paints over that header from `<body>` | `global.css` | `--ink` | 4.58:1 |
  | `.questions-block` (home, until Phase 7) | `home.css` | `--ink` | 4.58:1 |
  | `.menu-overlay` (90% black in both themes) | `global.css` | `--green` | 5.02–5.95:1 by page |
  | Menu toggle while open (it sits above the overlay) | `global.css`, `html.menu-open` | `--green` | same |
  | `.sheet-copy`, the white paper preview on `/sheets` (BA83) | `sheets-page.css` | `#0f6b33` (Deep Green) | 6.6:1 |

  The default ring fails on LIT Green, which is why ink is the pin there. No
  ink or Deep Green surface holds a control today: every such fill in `src/`
  is a button or CTA itself, whose ring lands on its parent. If one is
  added, use LSC's measured values: on ink, `--green` (4.58:1); on
  `--green-deep`, the paper (6.3:1; plain green there is 1.89:1).
  Fixed-green surfaces checked and left unpinned, because nothing focusable
  sits on them directly: home `.hero`, the chat bubbles, and the glossary
  `.toggle-switch` (a control, not a surface). **Phase 1 moved the other
  green bands to the page or a tint** (the articles header and hero,
  `/courses`' updates, `/read`'s license band, the podcast page's section)
  and took their pins away with them: a pin left on a themed surface fails
  at night. LSC defines the same token (its PR #79). The mirrored `/apps`
  files never name the ring; they get it from each site's global
  `:focus-visible`, so a mirror copy needs no pin of its own.
- **A text field's border is `--field-border`** (BA144, BVJ 2026-10-26):
  `rgba(var(--ink-rgb), 0.58)`, chosen as the lowest alpha that cleared
  WCAG's 3:1 for a control's boundary on the old cream; it is 4.0:1 on the
  page by day and 5.9:1 by night. A field whose fill matches its surface has
  no other edge, so softer borders failed site-wide. Buttons, cards and
  dividers keep their own. **It resolves on `:root`**, so a local
  `--ink-rgb` pin (the green header's `__inner`, `/sheets`' paper and
  presenter) does not reach it: a field on a pinned surface writes
  `rgba(var(--ink-rgb), 0.58)` itself. The `/contact` and `/app-support`
  fields (`contact.css`, `.field`) take it too (BVJ, 2026-10-29). The
  desk's placeholders and small secondary text are the third ink
  (`::placeholder` in `desk.css`; 5.1:1 by day, 5.7:1 or more by night;
  Audit 8 XA8-13 and XA8-3), since the browser's default gray fails 4.5:1.

## The Study Desk's buttons

- **The Study Desk's buttons are four kinds** (E126; BVJ, 2026-11-12):
  primary (Deep Green, white words, at most one per pane or view, edged in
  dark themes with the text green at 70%), ordinary (`--desk-control` with a
  `--field-border` edge, a shadow at rest, a 1px lift on hover, sunk when
  pressed), toggle, and the quiet and glyph buttons, which keep their own
  looks. One rule per kind ends `desk.css`. Its tokens, every shadow with a
  dark pair in both dark selectors, are in the comment "The desk's layers" in
  `desk.css` and repeated in `desk-search.css`, which /search loads alone.
  Pressing is Instant (Featherboa, "Motion"), so no kind has a transition;
  under `prefers-reduced-motion` the lift is zeroed by token and the shadows
  stay. A disabled button keeps its edge and its fill and says so in its
  words (the third ink, or the text green on a disabled primary, 4.5:1 or
  more on every surface), never by fading it with `opacity`.
  **No button is the color of what lies behind it** (E159; BVJ,
  2026-11-18), in either theme: a button with an edge and no fill, or a
  segmented pill whose unchosen choices show the surface, joins a kind
  instead (`.desk-seg` takes the pills' fill and edge, and every Pin, the
  reading pages' too, is a flat toggle). The light fill stays
  white (BVJ chose it over a gray step, sky, and sunshine), 1.05:1 on a
  near-white sheet, and the 3:1 edge and the shadow are what carry it there.
  **Measure it with a notebook that holds records, and with every menu,
  window, and tab opened**: E159's sweep of empty pages missed the
  collections page's buttons and the Highlight swatches (E169). The inventory is in
  `src/scripts/desk/sheets/CLAUDE.md`, "How the Sheets look".
- **Featherboa replaces the four kinds** (`SITE-FEATHERBOA.md`, "Controls"
  and "Surfaces"; Phase 2 builds it): filled, tinted, plain (words and an
  icon, no box until pointed at, which E159 allows on purpose), and red
  words, with no shadow on a button at rest. Until it is built, the rules
  above hold.

## Site 2.0 is gone

- **Site 2.0 and the restyle (E132) were removed** in Featherboa's Phase 0
  (`SITE-FEATHERBOA-BUILD.md`): `restyle.css`, `src/styles/v2/`, the
  `data-restyle` stamp, and the `data-v1`/`data-v2` markup. `SITE-2.0.md`
  stays as the record; none of its decisions carries over unless
  `SITE-FEATHERBOA.md` says so. Don't bring back a `:root[data-restyle]`
  rule or a `v2-` class.

## Forced colors

- **In forced colors (Windows contrast themes) a background draws nothing.**
  An icon made of backgrounds, like the header's Menu bars, vanishes, and a
  button with no border vanishes with it (BA149). Under
  `@media (forced-colors: active)`, give such a mark
  `forced-color-adjust: none` and a system color (`ButtonText`), and the
  button a `ButtonBorder` edge. A label that sets the
  `Highlight`/`HighlightText` pair itself needs `forced-color-adjust: none`
  too, or Chrome paints its Canvas backplate behind the text (BA148).
  Check with Chrome's forced-colors emulation in both themes.
