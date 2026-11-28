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
  `legacy-faces.css` for what moves later: printing and the handouts
  (Phase 8), and a sheet's stored faces, paper, slides, and files
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
    A card or a docked panel takes a hairline, and no button casts a
    shadow.
  - **Motion is four speeds on one curve** (`--ease`): Quick
    (`--dur-quick`) for menus, popovers, and tooltips; Settled for notes,
    panels, and bars; Large for sheets, dialogs, and present mode; leaving
    takes two thirds as long (`--dur-*-out`). **Pointing, pressing,
    selecting, toggles, and chevrons are Instant: no transition at all.**
    Nothing loops, and reduced motion zeroes every duration in
    `global.css`, where **only what declares a transition takes one**:
    `transition-property` starts as `all`, so the short duration alone made
    every change of size or space land a frame late, after the scripts that
    hold the reader's place had measured it. A transition therefore always
    names its properties, never `all`. A script that animates uses the
    same numbers and says which token in a comment (`verse-image.js`).
    `test/featherboa-motion.test.js` holds stylesheets and scripts to this.
  - **LIT Green marks and is never behind words; deep green is only for
    what can be pressed; the cream (`#E1DFD9`) is gone** and the page is
    the paper everywhere. Home's green sections wait for Phase 7.
- **Theming (light/dark) is a dual mechanism.** Dark-mode tokens are declared
  twice — `@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]) … }`
  (follow the OS) and `:root[data-theme="dark"] … }` (explicit override) — in
  `tokens.css` and `global.css` and mirrored in a few page stylesheets and
  components; `test/featherboa-css-rules.test.js` fails on a rule written
  only once, on one whose two halves differ, and on a bare media query. The header "Aa" tray (`SiteHeader.astro`, heading
  **"Display"**, the one panel for how the page reads; see "The Display
  tray," below) holds Theme: a 3-state control
  (**Auto / Light / Dark**, Auto being the old System) persisted in `localStorage['lit-theme']`
  (`light`/`dark`; **key absent = Auto**). `Layout.astro` stamps `data-theme`
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
  The tray's Text group, three list rows (**Default / Atkinson /
  OpenDyslexic**, each a `role="radio"` and named in the font it selects so
  the list previews itself), writes
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
     `!important`, so **the tray's own preview labels carry `!important` too**,
     and a `.font-tray__faces` prefix, since the override's (0,1,1) beats a
     lone class even then; otherwise the list renders entirely in the active
     font and previews nothing.
  3. The width compensations are scoped to `[data-font="dyslexic"]` **only**.
     OpenDyslexic is far wider than Source Sans 3; Atkinson is not, and must not
     inherit them. They live in `home.css` (hero titles, the hero scroll's
     safe interior, the question CTA), `global.css` (the reader panels'
     chip buttons' side padding, and the Display tray, 360px rather than
     300px), `header.css` (the full header from 900px
     rather than 700px, the phone title's scale, the magnifier moving into
     the menu sheet under 380px and "Menu"'s icon leaving under 430px, and
     the phone bar's edges and gaps given up under 375px, its Previous,
     Search, and Next showing their icons alone under 360px),
     `picker.css` (the passage picker's book cells, and its panel at 60rem
     rather than 50rem), and `pages/glossary.css` (an entry's title follows
     the window's width, since "acknowledgement" outgrew a 320px phone's
     column). Prefer
     **buying back space over shrinking type** — an accessibility font is the
     last thing that should be made smaller. The header keeps the menu button
     until 900px rather than compressing the places; the hero scroll's
     interior is widened before its type is eased; only the phone-width
     header title, where there is genuinely no space left, scales down. (The
     footer's email field gives up its own width in every font, so it needs
     no rule of OpenDyslexic's.)
     The one shared mechanism is the **callout CTA**: the clamp that keeps it
     inside the viewport applies to every font, and only its `--cta-overhang`
     value is per-font. Don't re-scope it to dyslexic — it overflows in all
     three.
  4. **A word wider than its column can't be centred** — the line box pins to
     the content edge and the word spills right, and text overflow adds to
     `scrollWidth` without widening any element's box. This has bitten three
     places on the home page alone (`.title-large`, the hero quote, the
     retired menu overlay's "Commitments"), always as "the text looks
     pushed right" plus unexplained horizontal scroll. When hunting it, **bisect by hiding
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
- **The menu is one sheet rising from the window's foot** (Featherboa,
  "The phone" and "The menu"; `header.css`, "The menu sheet"), whatever
  the width or the input, so it looks the same everywhere: a modal
  `<dialog>` no wider than the text column (`--col-text`), a float (its own
  surface, edge, top corners, and the one shadow) over the page dimmed to
  40% black, rising at the Large speed and leaving at two thirds of it
  (`@starting-style` and `allow-discrete`, so a browser without them simply
  shows and hides it). Its groups are the places (`src/lib/places.mjs`),
  in two columns, a third for Study only with `html[data-desk]` from 1100px.
  It replaced the menu overlay (a side tray on a computer from BVJ's call
  of 2026-11-04, full screen on a touch screen).
- **Text size, line spacing, Justify, the theme, verse numbers, footnote
  letters and key terms are the rest of the Display tray**, and follow the
  font's pattern exactly: an attribute on `<html>` stamped before first paint
  by `Layout.astro`, absent for the default, mirrored to one `localStorage`
  key each (`data-size` sm | lg | xl in `lit-size`; `data-leading` roomy in
  `lit-leading`; `data-justify` on in `lit-justify`; `data-vn` off in
  `lit-verse-numbers`, Read View's keys its fallbacks (rule 6); `data-fn`
  off in `lit-fn-letters`; `data-terms` off in `lit-terms`, the term lens's
  switch). `TRAY_SETTINGS` in `src/lib/display-tray.mjs`, which draws the
  tray (`src/scripts/display-tray.js` runs it), lists each with the older
  keys a change removes. **What it holds** (Featherboa's Phase 4;
  `SITE-FEATHERBOA.md`, "Display"): Text, Size (four steps, dots between a
  small and a large A), Line spacing, Justify, Theme ("Auto," "Light,"
  "Dark"), and on a chapter's page View ("Verse and chapter numbers,"
  "Footnote letters," "Key terms," and with the Study preview "Your
  marks," which `desk/note-settings.js` adds), then "All settings →" at
  its foot (`/settings`, every reader's: the Keyboard switch, Your marks'
  finer choices, the Notebook's start and Delete in bulk). Every control is
  the kit's: a face a `kit-row`, a row of choices a `kit-choices` of
  `kit-tab`s (`role="radio"` in a `role="radiogroup"`, one Tab stop, the
  arrows, Home and End inside), a switch a `kit-switch`. "Show the
  Notebook" and "Reset widths" are gone; each draggable line's menu keeps
  its own reset (`src/scripts/desk/CLAUDE.md`, rule 4). **Justify shows
  where the LIT text is** (a chapter, /desk) and justifies and hyphenates
  the prose (`reading-page.css`, and /desk's LIT panes in `desk.css`),
  leaving poetry alone, the two accessibility faces ragged, and a line
  under about 45 characters (22em) ragged. There is **one panel**: every
  "Aa" (a `data-font-toggle`, the header's two) opens this same tray, which
  opens upward when there is no room below. Six rules:
  1. **They reach every page of running text, and what a thing is decides
     how far** (BVJ, 2026-11-12, for preference and for accessibility; before
     then only the scripture pages and article bodies followed). Three scales, each a custom property on
     `<html>` in `global.css`. Every rule multiplies its own default by one
     of them, or adds the line-spacing extra, so Medium and Normal change
     nothing anywhere:
     - **`--reading-scale`** (16 / 18 / 20 / 23px at the 18px body size) and
       **`--reading-leading-extra`** (what "Roomy" adds) are for words a
       reader reads: the chapters (every one a page reads on into), book intros, article pages,
       the glossary, /search's results, the release notes, About, Privacy,
       Translation Commitments, the Collective's page, /license, the
       colophon, What's New, the account pages, the source-text notice,
       and the three panels of text (a footnote's popover, a key term's
       card, a reference preview). The extra goes on every block
       that can wrap; a title, a one-line label and a button keep their line.
     - **`--heading-scale`** is the same scale for a page's title, except on
       a phone (640px and under), where a title never grows past its own
       size. It is the largest type on its page and can't break a word, so
       "Thessalonians" or "Commitments" a step larger is wider than the
       screen. A heading of short fixed words ("Footnotes", "Chapter 3")
       takes `--reading-scale`.
     - **`--control-scale`** is the gentler one for controls whose words sit
       on one line in a fixed width: the verse menu and the selection
       panel. It
       never shrinks a control (Small leaves it alone) and stops at the Large
       step, since the full Extra large step pushes a label out of its tile.
       **On a phone (640px and under) it stays 1**: the sheets' two-button
       rows and the picker's grid are fitted to the screen there, and the
       larger label cost each a row when measured. What holds such a label
       grows by the same factor (the picker's panel and tile floors, the
       toolbar's width floors, a panel's width).

     **Left to browser zoom, on purpose**: the header and its menus, the
     footer, the Display tray, tooltips, buttons and form fields, the place
     line, and the passage picker, whose controls are the kit's at the
     kit's sizes (`src/components/CLAUDE.md`). So are the designed pages of short display type:
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
     `--desk-leading` to its line height. The public glossary and an article take the reading
     size on one column (`pages/glossary.css`, `pages/article.css`), as the
     Read page does.
  2. **Size goes on the same element as the column's width**, so the width
     (in `--ch`, an em fraction) grows with the text and a line keeps its
     length in characters. Putting the size on the paragraphs instead would
     shorten the line at every step up. An article's
     column (`.article__card`, `pages/article.css`) has the width and
     the body inside it the size, so the column's `--reading-width` is the
     text face's own at that size.
  3. **Read View used to keep its own three settings** (`lit_rm_fontSize`,
     `lit_rm_lineHeight`, `lit_rm_markers`). The pre-paint script still reads
     them as fallbacks and the tray deletes each on change, the same
     arrangement as `dyslexic-font`. Don't drop the fallbacks.
     `lit_rm_markers`, after `lit-read-numbers`, is now the chapter page's
     numbers fallback (rule 6), deleted when its switch is set. Focus mode
     retired with Read View, and `lit_rm_focus` with it (WB-42).
  4. **A hidden verse number or footnote letter on a chapter's page is still a
     control and a scroll target** (the verse menu's button, `#v16`, a
     footnote's backlink), so it is clipped rather than removed, stays in the
     tab order, and reappears while it has keyboard focus. The no-break space
     after a number is wrapped in `.vn-gap` at render (`markVerseGap` in
     `chapter-html.ts`) so it can hide too; left alone it doubles the gap
     before every verse. Turning numbers off hides the chapters' headings
     the same way (rule 6).
  5. **Scripture pages pass `scriptureControls`** down through the layouts:
     `"study"` from a chapter page with text. Other
     pages don't show the "View" group at all, /desk included: each LIT
     pane there has its own four switches on its bar (`desk/lit-show.js`,
     E108), which mark up that pane alone. **These three attributes on
     `<html>` are the chapter page's and never reach a LIT pane**: the rules
     keyed on them in `global.css` leave out a text that carries
     `data-own-marks`, as each chapter in a LIT pane does, and `desk.css`
     hides the same things by the pane's own attributes
     (`.desk-lit[data-vn="off"]`). A new rule keyed on the page's switch
     needs the same `:not([data-own-marks])`.
  6. **Verse numbers were one setting per view** (owner, 2026-09-30) until
     Read View retired into the chapter's page (Featherboa's Phase 4). As one
     switch, hiding numbers to read a book straight through had also hidden
     them in Chapter View, where (rule 4) a hidden number is a 1px box a
     finger can't tap, and the verse menu vanished from touch screens with
     nothing on the page saying why. Now one page reads `lit-verse-numbers`
     (stored only when off), then Read View's `lit-read-numbers`, then
     `lit_rm_markers`, so a reader who hid them for a whole book keeps that
     until the switch is next set, which deletes both (no reader setting is
     lost: `SITE-FEATHERBOA-BUILD.md`, Phase 4). Such a reader meets the
     old cost on a touch screen until they turn numbers back on.
     **Chapter headings follow the numbers wherever chapters run together**
     (BVJ, 2026-11-05; STUDY-DESK-FIXES.md E29; WB-24 to WB-26): the
     reading page and /desk's LIT pane, where numbers off means one unbroken
     text. Both hide a heading the way rule 4 hides a number
     (`reading-page.css`, `desk.css`): out of the flow, adding no height,
     still a heading and a focus stop (the page's Go deeper, the pane's
     link), shown over its chapter's first line while focused. Go deeper
     hides with its heading.
  Changing any of these reflows the page, so the tray pins the block at the
  reading line and scrolls it back (`keepReadingPlace`, in
  `src/scripts/keep-reading-place.js`, which the Study Desk's panel uses
  too), and lets that one scroll through without closing itself
  (`isHoldingPlace`), nor the one that holds the line when a chapter comes
  in above (`read-on.js`, announced first by `lit:read-on`): a smaller size
  near a chapter's top brings one, since the hold's scroll up reads as the
  reader nearing the top. A change of face reflows twice, with the attribute and
  again as the face's files arrive, so its hold puts the line back each time
  until the fonts have loaded (the `fonts` option), unless the reader
  scrolls or presses a key meanwhile.

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
  `CH` and `CHAR` in `src/lib/desk-margin.mjs` restate the three faces' `--ch`
  and `--char` values (`FIRST_PAINT.ch` is `CH`), and `test/desk-margin.test.js`
  holds them together. Two shared widths:
  **`--reading-width`** for long-form reading (Chapter View, intros, Read
  View, article bodies), the text column itself, so a surface with side
  padding adds it on top. Featherboa's column ("Sizes, space, and the
  measure") is 660px (`--col-text`) held between 45 and 75 `--char` a line,
  so a larger size or a wider face shortens the count and the bounds hold
  it. **With the Study Desk on, it is still `--reading-measure` (60) × `--ch`**
  (`html[data-desk]` in `global.css`), because the desk's measures, its drag,
  and its pre-paint placement count in `--ch`, until the reading page takes
  the desk's margin (Phases 4 and 5). The drag is held to 45 to 75 of the
  face's characters all the same (`measureRange`, `desk-margin.mjs`; SZ-17):
  37.8 to 62.8 `--ch` in Source Sans 3, 30.8 to 51.3 in Atkinson, and 48 to
  110.4 in OpenDyslexic, whose characters are so wide that the 48 a chapter
  opens with is about 33 of them, so its narrowest stays 48 (queue). The article card is sized from it as
  well (`--article-width` on the article page), so the card's edges follow
  the text. The other width is **`--content-width`** (72 × `--ch`) for the
  pages around it (/search, About, courses, commitments; /read is the
  passage picker's 60rem). Both are
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
  (#0F6B33, Deep Green) is no button's fill since the kit: the filled
  button is `--color-press` under `--color-on-press` words, deep green
  under white by day (6.6:1) and the night's press green under dark words.
  What still takes `--green-deep`, fixed in both themes, is a mark that
  isn't a control (Study's "New" badge, a sheet's meter) and /sheets' own
  buttons until Phase 11.
  `--green-text` and `--link` are `--color-press`: deep green by day and
  #4DD383 by night, for text and links, never a fill under white words,
  which fail on it at night.
  **Keyboard focus rings are `--focus-ring`**, never a green written
  directly: `--color-press`, 2px (`--focus-width`), 2px off the control
  (`--focus-offset`). A focus indicator needs 3:1 against its surface: the
  ring is 6.3:1 on the page by day and 9.7:1 at night, where LIT Green
  manages 3.35:1 and translucent rings 1.4 to 2.0:1, so none is written by
  hand. **One rule draws it** (KT-07): global.css's `:focus-visible`, from
  the three tokens. A control never draws its own ring; the one exception
  is a row that fills a scrolling list or menu edge to edge, whose ring is
  drawn 2px inside it (`outline-offset: -2px`) because an outside one is
  clipped. `test/featherboa-kit.test.js` ("focus is the one ring") holds
  every `:focus` rule to this, and its `OWN_RINGS` names any ring drawn in
  another color on purpose: none since the Display tray's controls became
  the kit's (Featherboa's Phase 4). Don't kill a ring
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
  That's why the green header pins on `.site-header__inner` (the font tray
  shares its `<header>` with a surface of its own, the header's menus,
  floats of their own, take the theme's ring back in `header.css`, and the
  menu sheet is drawn after the header, outside the pin). Measured with the
  WCAG 2 formula:

  | Surface | Pinned where | Ring | Contrast |
  |---|---|---|---|
  | LIT Green header bar (`body.bg-green`, home, until Phase 7) | `global.css`, on `.site-header__inner` | `--ink` | 4.58:1 |
  | Skip link, which paints over that header from `<body>` | `global.css` | `--ink` | 4.58:1 |
  | `.questions-block` (home, until Phase 7) | `home.css` | `--ink` | 4.58:1 |
  | `.sheet-copy`, the white paper preview on `/sheets` (BA83) | `sheets-page.css` | `#0f6b33` (Deep Green) | 6.6:1 |

  The default ring fails on LIT Green, which is why ink is the pin there. No
  ink or Deep Green surface holds a control today: every such fill in `src/`
  is a button or CTA itself, whose ring lands on its parent. If one is
  added, use LSC's measured values: on ink, `--green` (4.58:1); on
  `--green-deep`, the paper (6.3:1; plain green there is 1.89:1).
  Fixed-green surfaces checked and left unpinned, because nothing focusable
  sits on them directly: home `.hero` and the chat bubbles. **Phase 1 moved the other
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
  fields (`contact.css`, `.field`) take it too (BVJ, 2026-10-29). Every
  field's placeholder is the third ink (the kit field's `::placeholder`;
  5.1:1 by day, 5.7:1 or more by night; Audit 8 XA8-13 and XA8-3), as is
  the desk's small secondary text, since the browser's default gray fails
  4.5:1.

## The kit

- **Every control is drawn once, in `kit.css`** (Featherboa, "Controls"
  and "The kit"), loaded after `global.css` on every page: filled (the one
  main action; a view uses it once), tinted (the usual next step, and a
  chip in a set), plain (everything else, and an icon alone), red words
  (deleting, never filled), the list row, tabs and a row of choices, a
  field, a checkbox (`:root`'s accent-color), a switch, and two the record
  doesn't list: a press inside a line of text ("inline") and a color dot
  (queue Q16). Five states: at rest, pointed at (one step stronger, never
  a movement or a shadow), pressed or on (a fill, or a green underline,
  and 700), focus (`global.css`'s ring), and unavailable (legible, never
  `opacity`). Corners are 6px on what is pressed and 10px on what floats;
  only a switch, a color dot, and the emblem are round. **A screen that
  needs something the kit lacks is a design conversation before it is a
  line of code**: a queue entry, not a new rule.
- **Words on a button are deep green; a tab's and a row's are the ink**,
  green only when on (queue Q14).
- **The kit's other names** (queue Q15): until a surface's phase redraws
  its markup with the kit's classes (`kit-btn kit-btn--plain`,
  `kit-row`, …), its controls take the kit's looks by name. Each level is
  one list, `:is(<kit class>, :where(<names>))`, so a name has the kit
  class's weight and no more, and the same list opens every rule of the
  level. **Add or remove a name only with `node scripts/kit-names.mjs`**,
  which keeps the lists alike. Outside `kit.css`, a control's rule says
  only where it sits and how big it is: never its fill, edge, corners,
  words' color, face, weight, capitals, shadow, or opacity. A control
  keeps its size until its surface is redrawn; an element inside a
  control that holds reading text (a note's excerpt in a row) sets its own
  face on itself.
- **Icons** are Lucide's (`src/lib/icons.mjs`, generated by
  `npm run build:icons`; `<Icon name="…" />` in `.astro` files, `icon()` or
  `iconNode()` in scripts). An icon stands alone only if it is search,
  close, back, forward, or more, with a name for screen readers; every
  other icon keeps its word. Typed glyphs (× ‹ › ▾ ▸) never stand in for
  one.
- **The tests**: `test/featherboa-kit.test.js` (each control and state,
  the lists alike, no look outside `kit.css`, no `accent-color` outside it
  either (it colors only a form's controls, whatever the selector is
  called), nothing moving or casting a shadow when pointed at or pressed,
  nothing faded when unavailable, the contrast of every state by day and
  by night), `featherboa-shapes` (the
  two radii and the one shadow), `featherboa-icons`, and
  `featherboa-spacing` (the spacing scale in the new stylesheets, `kit.css`
  first). The static test can't see a control styled by class alone until
  its name is in a list, so **check a surface in the browser**
  (`scripts/kit-audit.js`): every visible control should take exactly one
  level, with every menu, tray,
  and popover opened, and no link or label drawn as a button (a fill or an
  edge at rest) outside the kit.

## Study's buttons

- **Study's buttons are the kit's** (Featherboa Phase 2, in place of
  E126's four kinds): each desk control takes one level by name in
  `kit.css`, desk CSS says only its place and size, and
  `test/desk-buttons-css.test.js` holds it (the inventory by level is in
  `src/scripts/desk/sheets/CLAUDE.md`, "How the Sheets look").
  **No tinted or filled button is the color of what lies behind it**
  (E159; BVJ, 2026-11-18), in either theme; Featherboa relaxes that for
  plain commands only (CT-26). **Measure it with a notebook that holds
  records, and with every menu, window, and tab opened**
  (`scripts/kit-audit.js`): E159's sweep of empty pages missed the
  collections page's buttons and the Highlight swatches (E169).

## Site 2.0 is gone

- **Site 2.0 and the restyle (E132) were removed** in Featherboa's Phase 0
  (`SITE-FEATHERBOA-BUILD.md`): `restyle.css`, `src/styles/v2/`, the
  `data-restyle` stamp, and the `data-v1`/`data-v2` markup. `SITE-2.0.md`
  stays as the record; none of its decisions carries over unless
  `SITE-FEATHERBOA.md` says so. Don't bring back a `:root[data-restyle]`
  rule or a `v2-` class.

## Forced colors

- **In forced colors (Windows contrast themes) a background draws nothing.**
  An icon made of backgrounds (the old header's Menu bars were one) vanishes, and a
  button with no border vanishes with it (BA149). Under
  `@media (forced-colors: active)`, give such a mark
  `forced-color-adjust: none` and a system color (`ButtonText`), and the
  button a `ButtonBorder` edge. A label that sets the
  `Highlight`/`HighlightText` pair itself needs `forced-color-adjust: none`
  too, or Chrome paints its Canvas backplate behind the text (BA148).
  Check with Chrome's forced-colors emulation in both themes.
