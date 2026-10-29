# Styling, theming and the Display tray

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory. These rules also govern `<style>` blocks in components and layouts.
> Cross-references such as "below" or "rule 15" were written when all of
> this was one file, so they may point into another area file; the root's
> index says which file holds each section.

- **Theming (light/dark) is a dual mechanism.** Dark-mode tokens are declared
  twice — `@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]) … }`
  (follow the OS) and `:root[data-theme="dark"] … }` (explicit override) — in
  `global.css` and mirrored in a few page stylesheets (`apps.css`,
  `found-in-translation-podcast.css`, `translation-commitments.css`) and
  `ReadMenu.astro`. The header "Aa" tray (`SiteHeader.astro`, heading
  **"Display"**, the one panel for every reader setting; see the next two
  bullets) holds Theme: a 3-state control
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
  reader who forces light on a dark OS the dark values under light-mode colours.
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
     OpenDyslexic is far wider than Inter; Atkinson is not, and must not
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
     need.
- **Text size, line spacing, verse numbers, footnote letters and key terms
  are the rest of the Display tray**, and follow the font's pattern exactly:
  an attribute on `<html>` stamped before first paint by `Layout.astro`,
  absent for the default, mirrored to one `localStorage` key each
  (`data-size` sm | lg | xl in `lit-size`; `data-leading` roomy in
  `lit-leading`; `data-vn` off in `lit-verse-numbers`, or `lit-read-numbers`
  in Read View (rule 6); `data-fn` off in
  `lit-fn-letters`; `data-terms` off in `lit-terms`, the term lens's
  switch, which Study View alone shows; with the desk preview on, the tray's
  Show group also gains the desk's own switches, "My highlights" among them,
  injected by `desk/note-settings.js` and sharing the Notebook panel's stored
  setting). There is **one
  panel**: Read View's toolbar "Aa" opens this same tray (it's a
  `data-font-toggle`, like the header's two), which opens upward when there
  is no room below. Six rules:
  1. **They apply to the reading surfaces only**: Study View's column, book
     intros, Read View, and article bodies. Each surface multiplies its own
     default by `--reading-scale` (16 / 18 / 20 / 23px at the 18px body size)
     and adds `--reading-leading-extra` to its own line-height, so Medium and
     Normal change nothing. The rest of the site is left to browser zoom.
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
  4. **A hidden verse number or footnote letter in Study View is still a
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
     pages don't show the "Show" group at all.
  6. **Verse numbers are one setting per view** (owner, 2026-09-30). Every
     other setting is the reader's everywhere; what a page shows depends on
     what the page is for. They were one switch at first, so hiding
     numbers to read a book straight through also hid them in Study View,
     where (rule 4) a hidden number is a 1px box a finger can't tap, and the
     verse menu vanished from touch screens with nothing on the page saying
     why. That was 2026-09-27 to 09-30. Study View reads `lit-verse-numbers` alone. Read View reads
     `lit-read-numbers`, then `lit_rm_markers`, then Study View's key, so
     it **follows Study View until the reader sets it**, and nobody's Read
     View changed when the switch split. That fallback is why the tray
     stores Read View's value as set, `'on'` included (`keep` in its
     `SETTINGS`): removing it at the default would hand the page back to
     Study View's choice. Layout.astro learns the view from
     `scriptureControls` through `define:vars`.
  Changing any of these reflows the page, so the tray pins the block at the
  reading line and scrolls it back (`keepReadingPlace`, in
  `src/scripts/keep-reading-place.js`, which the Study Desk's panel uses
  too), and lets that one scroll through without closing itself
  (`isHoldingPlace`).
- **Text columns are sized with `--ch`, never the `ch` unit.** `ch` is the "0"
  advance of *whichever font is currently painting*, so every column here was one
  width under the metric-matched fallback face and another once the webfont
  arrived: the box resized and, being `margin: 0 auto`, re-centred, sliding the
  whole text block sideways mid-load. That was **0.256 CLS on scripture pages**
  (Cloudflare RUM, attributed to `div.scripture-main`), the site's worst Core Web
  Vital, and nothing in the repo pointed at it — `--content-width` was referenced
  at 14 call sites and *defined at none*, so the `, 72ch` fallback silently ran
  the site. `--ch` in `global.css` is an em fraction of the body font's "0",
  re-declared under `html[data-font="dyslexic"]` and `[data-font="atkinson"]`;
  because `Layout.astro` stamps `data-font` **before first paint**, the width is
  settled from the first frame and no font swap can move it. Write
  `calc(72 * var(--ch))` (still reads as "72 characters"). Two shared widths
  are built from it: **`--reading-width`** (`--reading-measure` × `--ch`) for
  long-form reading (Study View, intros, Read View, article bodies), which
  is the text column itself, so a surface with side padding adds it on top
  (otherwise the same setting gives each view a different line). The measure
  is **60** (owner, 2026-09-27), picked from side-by-side screenshots: about 77
  characters a line in Inter and 85 in Atkinson, where the old 72 gave 92 and
  102. The article card is sized from it as well (`--article-width` on the
  article page), so the card's edges follow the text instead of leaving an
  empty band beside it. The other width is
  **`--content-width`** (72 × `--ch`) for the pages around it (/read, /search,
  About, courses, commitments), which are not long-form reading and kept their
  width when the reading measure narrowed. **Change `--reading-measure`, never
  `--ch`, to move the reading line.** Both tokens are declared on `:root` and
  resolve their em against the element that uses them, so size a column where
  its text size is set (see the Display tray rules above). Two things to know
  before touching `--ch`:
  1. The values are **body/sans figures**. Inter's "0" is 0.631em, Crimson's
     0.504em, so a column set in the serif needs its own number, not this token.
  2. `--ch` is per-font rather than one constant because the accessibility fonts
     have **no metric-matched fallback** (both stacks end at plain `sans-serif`),
     which gave them the site's largest swings — ~10% for OpenDyslexic, ~16% for
     Atkinson. Pinning per font also preserves each reader's existing measure,
     notably OpenDyslexic's markedly shorter line: switching those readers to one
     shared width would have lengthened their line by ~26%, the opposite of the
     "buy back space" rule above.
- **Greek and Hebrew letters come from faces registered by character
  range** (`src/styles/greek-hebrew-fonts.css`, Study Desk C27; the owner
  picked the faces 2026-10-05). Every site font loads Latin only, so each rule
  there puts a Greek or Hebrew file under an existing family name, the way the
  ⟦ ⟧ patch does, and no font stack anywhere changes. In sans-serif text,
  Greek is Inter's own (the `@fontsource/inter` package always had it;
  Atkinson and OpenDyslexic, which have none, take Inter's too), and Hebrew is
  Noto Sans Hebrew. In serif text (Crimson Text, which print uses, and
  Fraunces) both come from Cardo. A file loads only on a page with its letters:
  four articles and two chapters' footnotes had Greek in 2026-10, and nothing
  had Hebrew. The file's header carries four rules, each learned by breaking
  it; the two that bite:
  1. **Copy the descriptors of a face the family already has.** A browser
     joins faces of one family by range only when weight and style match
     exactly, so a rule at a weight the family doesn't declare is never
     reached, or worse, catches text at that weight and drops its Latin. The
     first draft's Hebrew rule (`100 900` under Inter, whose faces are 400 to
     700) was never used, and Crimson's 600 skipped Cardo's 700.
  2. **Write the ranges out; never import Fontsource's per-subset CSS** for
     this. Those files carry no `unicode-range`, so they claim every
     character and load on every page. Their Hebrew range also claims a
     hyphen and some combining marks Latin text shares, which are left out.
  Check a change with `CSS.getPlatformFontsForNode` over the DevTools
  protocol, on a built `dist/`: it names the file that drew each character.
  Printing needs `Emulation.setEmulatedMedia` set to print and the fonts left
  to load before `Page.printToPDF`. Otherwise headless Chrome prints fonts
  used only in print in their stand-ins, which looks like a failure.
- **Two brand greens, by role (all theme-invariant).** `--green` (#209D50 "LIT
  Green") is for large **surfaces** (heroes, questions block, chat bubbles) and
  non-button icon accents — it carries **ink** text (4.6:1) or white *large*
  headings, never small white text (only 3.5:1). `--green-deep` (#0F6B33 "Deep
  Green") is for **solid buttons/CTAs** with **white** labels (6.6:1). Both are
  fixed in dark mode, so a Deep-Green button stays readable in both themes and
  reads as an intentional second shade against LIT-Green surfaces. Do NOT use
  `--green-text` as a *button background* — it's a link/text token that flips to
  a light green in dark mode (white-on-it fails). For a green button, reach for
  `--green-deep`; for green text on a light background, `--green-text`.
  **Keyboard focus rings are a third role: `--focus-ring`**, never a green
  written directly. It defaults to `var(--green-text)` in `:root` and both dark
  blocks, because a focus indicator needs 3:1 against the surface and LIT Green
  manages only 2.63:1 on cream (3.35:1 on `#FAFAF8`), while the text green is
  4.97:1 on cream, 6.34:1 on `#FAFAF8`, and ~7–8:1 in dark (`#3abf6a`).
  Translucent rings (`rgba(32, 157, 80, 0.35)`) fail worse still, 1.4–2.0:1;
  fourteen of them were routed through the token in 2026-09. The rings that use `--text` on
  purpose (the Display tray's options, whose selected segments are green) stay as they are. Don't
  kill a ring with `outline: none` on `:focus-visible` either: `/support`,
  `/liberating-scripture-collective`, the about TOC, and the launch popover's
  close button all did, which left keyboard users a 1px lift or nothing at all.
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
  set drifts from the source the way the previous emblem's hand-vectorized
  `favicon.svg` drifted from its raster master. The retired emblem and its icon
  set are archived in `_source-images/retired-emblem-2024/`.
  The manifest itself, `public/site.webmanifest`, is hand-maintained (the
  script writes its icons, not the file), and it says **`"display":
  "browser"` on purpose** (owner, 2026-09-28): a home-screen icon opens the
  site in the browser, and no browser offers to install the website as an app
  beside the real iOS and Android apps. It said `standalone` until then, which
  is what made the site installable. Don't set it back.
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
  menu overlay share its `<header>` with surfaces of their own), and the
  articles hero pins on its search form rather than on itself (its results
  panel is themed). Measured with the WCAG 2 formula:

  | Surface | Pinned where | Ring | Contrast |
  |---|---|---|---|
  | LIT Green header bar (`body.bg-green` home, `.site-header--green` articles) | `global.css`, on `.site-header__inner` | `--ink` | 4.58:1 |
  | Skip link, which paints over those headers from `<body>` | `global.css` | `--ink` | 4.58:1 |
  | `.questions-block` (home) | `home.css` | `--ink` | 4.58:1 |
  | `.courses-updates` (`/courses`) | `courses.css` | `--ink` | 4.58:1 |
  | `.articles-hero` search form | `articles.css`, on `.searchbar__form` | `--ink` | 4.58:1 |
  | `.menu-overlay` (90% black in both themes) | `global.css` | `--green` | 5.02–5.95:1 by page |
  | Menu toggle while open (it sits above the overlay) | `global.css`, `html.menu-open` | `--green` | same |
  | `.sheet-copy`, the white paper preview on `/sheets` (BA83) | `sheets-page.css` | `#0f6b33` (Deep Green) | 6.6:1 |

  The default ring fails on LIT Green (1.89:1 light, 1.47:1 dark) and so does
  cream (2.63:1), which is why ink is the pin there. No ink or Deep Green
  surface holds a control today: every such fill in `src/` is a button or CTA
  itself, whose ring lands on its parent. If one is added, use LSC's measured
  values: on ink, `--green` (4.58:1); on `--green-deep`, `--cream` (4.97:1;
  plain green there is 1.89:1). Fixed-green surfaces checked and left unpinned,
  because nothing focusable sits on them directly: home `.hero`, the
  `/read` `.license-band` (its controls sit on a themed card, so a pin would
  leak into the card), the chat bubbles, and the glossary `.toggle-switch`
  (a control, not a surface). LSC defines the same token (its PR #79). The
  mirrored `/apps` files never name the ring; they get it from each site's
  global `:focus-visible`, so a mirror copy needs no pin of its own.
- **A text field's border is `--field-border`** (BA144, BVJ 2026-10-26):
  `rgba(var(--ink-rgb), 0.58)`, the lowest alpha that clears WCAG's 3:1 for a
  control's boundary on cream (3.1:1; 4.0:1 on the raised surface, 5.8:1 or
  more in dark). A field whose fill matches its surface has no other edge, so
  softer borders failed site-wide. Buttons, cards and dividers keep their own.
  **It resolves on `:root`**, so a local `--ink-rgb` pin (the green header's
  `__inner`, `/sheets`' paper and presenter) does not reach it: a field on a
  pinned surface writes `rgba(var(--ink-rgb), 0.58)` itself. Still open: the
  `/contact` and `/app-support` fields (`contact.css`, `.field`) have no border
  at all, only a shadow, and their fill is 1.28:1 on cream; adding one is a
  visible design change, left for BVJ.
- **In forced colors (Windows contrast themes) a background draws nothing.**
  An icon made of backgrounds, like the header's Menu bars, vanishes, and a
  button with no border vanishes with it (BA149). Under
  `@media (forced-colors: active)`, give such a mark
  `forced-color-adjust: none` and a system color (`ButtonText`), and the
  button a `ButtonBorder` edge. A label that sets the
  `Highlight`/`HighlightText` pair itself needs `forced-color-adjust: none`
  too, or Chrome paints its Canvas backplate behind the text (BA148).
  Check with Chrome's forced-colors emulation in both themes.
