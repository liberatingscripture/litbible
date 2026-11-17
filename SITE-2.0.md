# Site 2.0: the build plan and its decisions

The rest of litbible.net redrawn in the Study Desk's grammar: the cream page,
content on sheets, the Marks, quiet controls. BVJ decided every page from
mockups on November 15 to 17, 2026 (their words are in "The pages" below), then
asked for this plan and for the build to begin (2026-11-17).

**The mockups are the specification.** They are static pages in
`C:\Users\bcjoh\GitHub\litbible-2.0-mocks` on the owner's machine (outside this
repo): `mock/<page>.html` is each page as decided, `mock/mock.css` is the shared
system, `tools/<page>.tpl.html` carries each decision in a comment, and
`README.md` lists them all. Serve them with
`python -m http.server 4877 --bind localhost -d mock` from that folder. This
file repeats every decision so the repo stands without them.

## Ground rules

1. **Everything waits for `data-restyle`.** That is the stamp the site restyle
   already uses (E132): Layout.astro's pre-paint script sets it on every device
   while the Study Desk preview is on (`?desk=on`), so a reader sees none of
   this until launch. 2.0 adds no second gate. Without the stamp (and without
   JavaScript) the site must look and behave exactly as it does on `main`.
2. **One markup, two looks, wherever CSS can do it.** A sheet, a bar over a
   title, a left-aligned top, a band removed, rows in place of cards: these are
   style rules on today's markup. New markup is added only for content that
   does not exist today (a contents column, the chapter grid on /read, the
   home hero's second voice). Never build a second copy of anything
   interactive (a form, a search box, a player, a menu).
3. **New markup is marked.** An element that exists only for 2.0 carries
   `data-v2`; one that 2.0 replaces carries `data-v1`. Two rules, in
   Layout.astro's critical CSS so nothing flashes, hide `[data-v2]` without the
   stamp and `[data-v1]` with it. A `data-v2` block that repeats words already
   on the page also carries `data-pagefind-ignore`. No `id` appears in both.
4. **2.0's styles live in `src/styles/v2/`**, every rule beginning
   `:root[data-restyle]`: `base.css` (tokens, the sheet, the Marks, the page
   frame, the two display rules; loaded by Layout.astro after `restyle.css`)
   and one file per page or family (`v2/courses.css`), imported by that page
   after its own stylesheet. `test/site2-css.test.js` holds the gate, both
   dark selectors, and the ban on the `ch` unit. Nothing 2.0 goes into
   `restyle.css`, `global.css`, or a page's existing stylesheet, so parallel
   work never shares a file. A page that needs a change in a shared file
   (Layout, the header, the footer, `base.css`, `restyle.css`) asks for it; one
   writer makes those changes, in order.
5. **The words do not change**, except the home page (BVJ: "as long as the
   content is unchanged (other than the home page)") and two labels BVJ
   approved (see "Labels"). The translation, footnotes, intros, and articles
   are never touched. /apps is mirrored with the LSC site and is left as it is.
   /privacy's words are shared with the LSC site; only its layout changes.
6. **The repo's standing rules hold**: `--ch` and never `ch`; `--focus-ring`;
   both dark selectors; sizes that follow `--reading-scale`, `--heading-scale`,
   and `--control-scale` keep following them (a 2.0 rule changes a size only
   where the mockup does, and multiplies as the page's stylesheet already
   does); a link that leaves the site opens a new tab with
   `rel="noopener noreferrer"`; American conventions, the Oxford comma, curly
   quotes, and no em dashes in anything a reader sees; the Study Desk is never
   imported statically.
7. **At launch** the gate comes off with the restyle's (item 14 of "Launching"
   in `src/scripts/desk/CLAUDE.md`): the `data-v1` markup is deleted, the
   `data-v2` attributes go, and the `v2/` rules lose their prefix and fold into
   the files they override. Read View needs no 2.0 work: it gives way to /desk
   at launch (item 11 there).

## The system (`src/styles/v2/base.css`)

| Part | What it is |
|------|------------|
| Page color | The cream, `#E1DFD9`, everywhere, including pages that are white today (/glossary, Translation Commitments). The card stays `#FAFAF8`. |
| Sheet | The card color, a 1px edge at the ink's 0.16, a 10px corner, no shadow, 811px at its widest for reading; edge to edge under 600px. |
| The Marks | A sunshine bar (56 by 6) over a page's title; a hairline with a short text-green marker (44 by 3) at the start of a section of running text; a 2px text-green marker on a contents rail's current item. Running text takes them; lists and cards take quiet labels. |
| Page frame | A contents column on a sheet (15rem) beside the text at `--reading-width`, from 1000px; a card of links under the title below that. |
| Accents | Sky `#A8D8EE` and sunshine `#FFD23F`; ocean only where BVJ has approved it (the home chat's answer bubbles). No bark. |
| Watermark | The emblem's mark alone, the ink at 10%, on a computer only (900px and wider). |
| Buttons, cards, fields | Already the desk's, from `restyle.css` (E132). A card that is a link keeps its light shadow. |

## The pages

Each row is one unit of work with its own files. "Mock" is the file in the
mockups' `mock/` folder.

| Page | Files it owns | Decided (BVJ's words, with what they mean) | Mock |
|------|---------------|--------------------------------------------|------|
| Home | `pages/index.astro`, `styles/pages/home.css` | The "Two voices" hero ("this is the best of the home page mockups. I think it should include a way into the study desk"); "Home card row: 1 row"; "the rest of Home A is good"; the chat is "Sky and ocean, which means ocean is in the accent palette again, but we can be discerning about where to use it." The card's last line links to "Release Notes." | `home-a.html` |
| Scripture chapter | `pages/[slug].astro`, `layouts/ScriptureLayout.astro`, `styles/scripture-tools.css` | "On a sheet." On it: "Everything currently on the page that's not header, footer, or the Notebook/Study Desk elements that are going to be added." The source-text notice: "Yes, off the sheet." Beside the Notebook: "Two cards." "I like the variable width sheet." The bar: "Header and toolbar." On a phone: "have the row with the picker and search hide once the user scrolls down, and reappear anytime they scroll upward." | `chapter.html` |
| Book introduction | `pages/[book]-intro.astro` (with the chapter's layout) | "What if it's a hybrid," then "Rail": the chapter's sheet with the Marks, and the headings as a rail in the margin from 1270px. | `intro.html` |
| /read | `pages/read.astro`, `styles/pages/read.css` | "Let's take even the accordion version off the mobile. Move the grid below the ways to read cards." The grid (every chapter, a computer only): "No heading." The ring on the Continue chapter: "ring is fine." "/read is good." Its block of changes is headed "Latest text changes." | `read.html` |
| Glossary | `pages/glossary.astro`, `styles/pages/glossary.css` | "I like it." Then: "Glossary: one scroll. left pane on sheet." | `glossary.html` |
| Articles index and article | `pages/articles.astro`, `pages/articles/[...slug].astro`, `styles/articles.css`, the four article components | Index: the green band is gone ("your change is good"); "The header can have a search button so that a non-article-defaulted option is available"; the quiet page: "It's good." Article: "Edge to edge for article pictures." "article page is good." | `articles.html`, `article.html` |
| Search | `pages/search.astro`, `layouts/SearchLayout.astro`, `scripts/search.js` | "Yes to two panes, but with some changes": the picker "needs a new home out of the way"; "The Add to Sheet cards are too similar to the results cards"; more room. Of the redraw: "That's better." Page links: "Always showing five, when there are five or more pages of results." | `search.html` |
| Release Notes | `pages/release-notes.astro`, `styles/pages/release-notes.css` | "It's really not the What's New page. It's the Release Notes page." The page: "one sheet. Added only" (the record on one sheet, months as rows; only "Added" keeps its label). | `release-notes.html` |
| Podcast | `pages/found-in-translation-podcast.astro`, its stylesheet, `PodcastEpisodesFlat.astro` | "Rows" (a season's episodes as rows on one sheet, plain links) and "On the cream" ("Latest Episodes" and its players on the page color). The embeds do not change. | `podcast.html` |
| About | `pages/about.astro`, `styles/pages/about.css` | Page frame: "Marks." Its contents column: "TOC on a sheet." | `frame.html` |
| Privacy | `pages/privacy.astro`, `styles/pages/privacy.css` | "Privacy: with contents" (the page frame; the eleven sections listed). | `privacy.html` |
| Contact, App support, and their thank-you pages | the four pages, `styles/pages/contact.css` | "Side by side" (words left, the form on a sheet right; one column under 900px) and "Watermark." | `forms.html` |
| Unsubscribe | `pages/unsubscribe.astro`, its stylesheet | "Fix the unsubscribe": one column at the left (the field under its line, which says "below"), the watermark at the right. | `forms.html?v=4` |
| Support | `pages/support.astro`, `styles/pages/support.css` | "Side by side" (Donate is one sheet as wide as the page; Give Lively's box at the right) and "Four cards" (the ways to get involved keep a card each). | `support.html` |
| The Collective | `pages/liberating-scripture-collective.astro`, its stylesheet | "Moving row" (today's carousel stays) and "Left" (the top runs from the text's left edge). | `collective.html` |
| Courses | `pages/courses.astro`, `styles/pages/courses.css` | "Courses: on a sheet" ("Email Updates" on a sheet under the text, not the green band). | `courses.html` |
| Page not found | `pages/404.astro` | "404: watermark, left." | `notfound.html` |
| Translation Commitments | `pages/translation-commitments.astro`, its stylesheet | "Today's grid" (after trying rows) and "marks, not spine" (the longer text on a sheet with the Marks). | `commitments.html` |

Approved together (BVJ, 2026-11-17): "I approve all the things marked "mine"
that we didn't address directly." Those are the smaller choices listed in each
mockup's notes: titles at the left under the sunshine bar, the desk's buttons,
sentence-case labels, deep shadows and green glows left off, and the like.

**Labels** (BVJ, 2026-11-17, taking Claude's recommendation): /read's block of
recent changes is headed "Latest text changes"; every link to /release-notes
says "Release Notes" (the home card, the footer, the About menu). "What's new"
is kept for the site-updates page coming in Phase 6 of the Study Desk. With
the gate on only, until launch.

Not part of 2.0: /apps (mirrored), the Study Desk's own pages (the guide), Read
View (retiring), and App support's thank-you page beyond what it shares with
Contact's.

**The header and footer in the mockups are stand-ins** (`mock.js` draws a
shortened pair on every page; its footer says so). The build keeps the site's
own header and footer as the restyle draws them (E132) and changes them only
where a decision names them: the two labels, the search button on the articles
index, and the scripture pages' toolbar row. A page is compared with its
mockup from the header's bottom edge to the footer's top. Open for BVJ: the
mockups' header is quieter than the restyle's (sentence-case menus, a green
"Read now" in place of the dark one); whether the real header should take that
look was never asked.

## The order of work, and who does it

Subagents by fit (BVJ, 2026-11-17: up to four Opus, six Sonnet, and four Haiku
at a time, "based on optimal model, not just filling slots"). Opus goes where a
wrong call is hard to see in review: the foundation every page stands on, and
the pages whose scripts and layouts are tangled with the Study Desk. Sonnet
builds the pages that are a decided layout over stable markup. Haiku has no
standing work here: the mechanical checks are better as tests, so it is used
only if a fully specified chore turns up (one rename across many files).

| Wave | Work | Model | At once |
|------|------|-------|---------|
| 0 | **Foundation**: `v2/base.css`, the two display rules, Layout's import, the watermark component, the footer's and About menu's labels, `test/site2-css.test.js`, the rules in `src/styles/CLAUDE.md` | Opus | 1 |
| 1 | **Pages over stable markup**: Courses with 404 and Unsubscribe; the Contact family; About; Privacy; Translation Commitments; Support; the Collective; Release Notes; Podcast; the articles index with the article page; /read | Sonnet | up to 6 |
| 2 | **Pages with their own scripts**: Home; Glossary; Search | Opus | 3 |
| 3 | **Scripture pages**: the chapter, then the book introduction (one layout, so one after the other). May start beside wave 2 if wave 1 forced no change to the foundation | Opus | 1 |
| 4 | **The whole site together**: every page in both themes, the three fonts, the four text sizes, and a phone; forced colors; the docs; the launch list | Claude, with Sonnet for a page that needs rework | as needed |

Rules for a wave: units that share a file run one after another; a subagent
edits only its unit's files and its own `v2/` stylesheet, commits nothing, and
runs no full build (builds share `dist/` and the podcast snapshot); it reports
any change it needs in a shared file instead of making it. Claude reviews each
unit's diff, applies shared changes in order, and commits unit by unit.

## How a unit is checked

1. `npm test` (with `test/site2-css.test.js`) and `npm run check`.
2. **The gate off is unchanged**: the page's built HTML on the branch, with
   `[data-v2]` removed and `data-v1` stripped, matches `main`'s; a capture at
   375px and 1280px without the stamp matches `main`'s.
3. **The gate on matches the mockup** at 320, 375, 700, 1024, and 1280px:
   nothing runs off the screen (scan the text nodes, not only the boxes), in
   light and dark.
4. For a page of running text: OpenDyslexic at Extra large at 320 and 375px
   (the case that breaks, `src/styles/CLAUDE.md`), and "Roomy" line spacing.
5. Keyboard: every control reachable, the ring visible on the page's surfaces;
   headings and landmarks as before.
6. A production build of the branch (`npm run build`, then
   `npm run check:links`), served from its own `dist/`, before a wave is
   called done. Restore `src/data/podcast-feed.xml` afterwards.

## Status

| Wave | State |
|------|-------|
| 0 Foundation | Done 2026-11-17. With the gate off, all 355 built pages match `main`'s (markup, and the 404 and About pages pixel for pixel at 375 and 1280px); with it on, the 404 page matches its mockup in both themes |
| 1 Pages over stable markup | Done 2026-11-17. With the gate off, all 355 built pages match `main`'s markup (what is new and inert is listed under "What the build added or left different"), and the wave's sixteen pages match `main`'s pixel for pixel at 375 and 1280px (the articles index and one article differ only where a lazy picture or an embedded post had not loaded in one of the two captures). With it on, each page was compared with its mockup at 375 and 1280px in both themes. `npm test`, `npm run check`, a build, and `check:links` pass. Left for wave 4: the full width, font, and text-size matrix on every page |
| 2 Pages with their own scripts | Done 2026-11-17: Home, the Glossary, and Search. Checked together with wave 3 (next row) |
| 3 Scripture pages | Done 2026-11-17: the chapter, then the book introduction. With the gate off, all 355 built pages match `main`'s markup once 2.0's additions are taken out (Home's one `span` splits a sentence into two text nodes, with the same words), and Home, the Glossary, /search, three chapters, two introductions, and a Read View book match `main`'s build pixel for pixel at 375 and 1280px, with one exception: on Home at 1280px that `span` moves the two words before it by a sixty-fourth of a pixel (the text is shaped in two runs), which changes 347 pixels of their edges and nothing an eye can see. With it on, each page was compared with its mockup at 375 and 1280px in both themes, and each builder drove its page's controls with the gate on and off. `npm test`, `npm run check`, a build, and `check:links` pass. Left for wave 4: the full matrix, and keyboard focus rings on the new pieces with real key presses |
| 4 The whole site together | Done 2026-11-17, save what waits on BVJ ("At launch," step 1). Twenty-four pages from the branch's build, with the gate on, in the three fonts at Medium and Extra large and at 320, 375, 768, 1024, 1280, and 1440px, beside the same run on `main`'s build: what it found and what was done is under "What wave 4 found." Every new control shows its focus ring after a real Tab press, in both themes. Windows contrast themes (forced colors) were checked by computed style, and three rules were added. `npm test`, `npm run check`, a build, the gate-off comparison, and `check:links` pass after the fixes. Not done: Small and Large text on every page (each builder checked its own), and a look in a real contrast theme on Windows (headless Chrome forces the colors in computed style but not in its pictures) |

Open for BVJ: whether the mockups should be archived in the repo (about 4 MB
without their captures) so other machines and BDR can see them.

## What wave 4 found

Fixed in the 2.0 look (all in `src/styles/v2/`, so none reaches a reader
without the preview):

- **Privacy scrolled sideways on a phone in OpenDyslexic** (2.0's own bug).
  The page's `margin: 0 auto` on its text stopped that grid item stretching,
  so it took the width of its longest word, a web address. The frame places
  the text; the margin is gone.
- **Support and the Collective's page: the Collective's name ran off the
  window in OpenDyslexic** (Support at 375px was 2.0's; the Collective's page
  scrolls on `main` up to 768px, and 2.0's left-aligned top made it worse).
  In that font the name may now wrap between words; its size stays.
- **Buttons whose label is a web address** ("liberatingscripture.org", on
  Support and the Collective's page) are wider than a 320px window in
  OpenDyslexic, on `main` too. In that font the address may break.
- **The footer's two columns of links** were cut off at both edges in
  OpenDyslexic under about 370px (on `main` too; "Release Notes" is longer
  than "What's new" and added 5px a side). A narrower gap up to 400px, and
  one column where even that cannot fit.
- **A web address in a chapter's notes** (Matthew 5) scrolls the page
  sideways on a 320px phone at any text size, and on a 375px one at Extra
  large or in OpenDyslexic. **This is on the live site today**, preview or
  not. The 2.0 look lets it break; `main` needs the
  same one-line fix on its own.
- **Windows contrast themes.** Every border takes one forced color there, a
  transparent one included, so each contents rail drew its marker on every
  link; /read's ring on the Continue chapter is a shadow, which is dropped;
  the sort's radio dot kept the site's green on the theme's page color. The
  rails name `Canvas` and `Highlight` (`base.css`), the ring becomes an
  outline, and the dot takes `Highlight`.

Already on `main`, not changed, for BVJ to know:

- /search at phone widths in the check tool shows the desk's "Add ... to a
  sheet" labels running off the window. A real phone never loads the desk,
  so no reader sees it.
- Support's two "liberatingscripture.org" buttons have
  `rel="external noopener"`, without the `noreferrer` the repo's rule asks
  of a link that leaves the site.
- The check tool reports chapter pages 7px wider than the window at every
  width, on `main` as well. It is the tool's arithmetic around the reserved
  scrollbar gutter: the page cannot be scrolled sideways (tested).

## At launch

Ground rule 7 in full, for whoever flips the switch (it rides with item 14
of "Launching" in `src/scripts/desk/CLAUDE.md`):

1. **Decide first** what is still open with BVJ: the chapter's arrows,
   Previous and Next, and "Back to top" (green today, quiet in the mockup);
   whether the header takes the mockups' quieter look; whether the mockups
   are archived in the repo.
2. **The stamp.** `data-restyle` is set unconditionally or its gate is
   dropped (item 14). Until every rule below is folded in, the stamp can
   simply stay on: nothing here needs it gone.
3. **Markup.** Delete every `data-v1` element; remove the `data-v2`
   attribute from the rest; delete the two display rules in Layout.astro's
   critical CSS. Keep `data-pagefind-ignore` on a block that still repeats
   words found elsewhere on its page (the rails, the Glossary's list,
   /read's grid).
4. **Scripts.** Remove the stamp checks in `v2-frame.js`, `v2-glossary.js`,
   `v2-search.js`, `v2-scripture.js`, `search.js` (`buildPageRange`,
   `renderJumps`), the Glossary's inline ink script (its early return
   becomes the whole of it: delete the ink), Home's inline script, and
   /read's ring script. Two run-time moves can then become plain markup:
   Home's search field can be rendered in the card (and the header's strip
   turned off for Home), and /search's sort, filters, and picker can be
   written in the left pane.
5. **Styles.** Each `v2/<page>.css` loses its `:root[data-restyle]` prefix
   and folds into the page's stylesheet, replacing the rules it overrides;
   `v2/base.css` folds into `global.css` beside `restyle.css`'s. The
   Glossary's own `--cream` goes. `test/site2-css.test.js` holds the gate
   today and is retired or rewritten with it; the `test/v2-*.test.js` files
   test logic and stay.
6. **Labels.** "Release Notes" (header menu, footer, the home card) and
   "Latest text changes" become the only wording (`v2Label` in
   `SiteHeader.astro`, the two spans in `SiteFooter.astro`).
7. **Read View** retires with the flip (item 11 there); its pill is already
   hidden in the 2.0 look.
8. **The desk's glossary title fit** (`desk/glossary-titles.js`) finds
   nothing to do in the 2.0 look and can go.
9. **Then check** as wave 4 did: the gate-off comparison no longer applies,
   so compare each page with its mockup, run the matrix
   (`tools/v2-wave4-matrix.sh` in the mockups' folder), and look at one
   real contrast theme on Windows.

## What the build added or left different

Wave 1, where the real page is not its mockup, or gained something a reader
without the preview also receives (all of it inert there):

- **Contents rails mark where you are.** `src/scripts/v2-frame.js` sets
  `aria-current="location"` on the link of the last heading above the reading
  line, on a page frame's contents column or any nav marked `data-v2-rail`
  (About, Privacy, the podcast's seasons). It does nothing without the stamp.
  About's and the podcast list's page scripts import it, so Astro now ships
  those two as files where it inlined them.
- **About** lists its twelve sub-headings in the rail, as the mockup does, so
  those `h3`s have `id`s now (`about-where-i-came-from` and the rest).
- **The thank-you pages** have one wrapper `div` around the button and the
  privacy line, so the two can sit on the sheet. It has only `v2-` classes.
- **A header search button on a page with its own search field** is a plain
  link to `/search` (`headerSearchLink` on `Layout`, `searchLink` on
  `SiteHeader`; `src/layouts/CLAUDE.md`). The articles index and the article
  page pass it. An article's own search box is hidden in the 2.0 look, as its
  mockup has none, so the header's button is that page's way to search.
- **/read**: the row of tools (the picker, the Study Desk, search) sits under
  the title block, where the mockup draws it inside; `ReadLayout` fixes that
  order for every page that uses it. The picker stays at every width ("no
  book list on a phone" is met by the grid being a computer's addition).
  "Latest text changes" is open, with no button, from 1000px.
- **Podcast**: the title stays centered on the hero picture with no sunshine
  bar, as its mockup draws it.
- **The dev server** (`astro.config.mjs`): a server started inside a worktree
  watched nothing and could not serve its fonts; both are fixed there, and
  neither changes a build.

Waves 2 and 3, the same two kinds of note. Each page's own module
(`src/scripts/v2-<page>.js`) does nothing without the stamp.

- **Glossary.** The left pane's list is new markup (`data-v2`, 47 links built
  at build time); `v2-glossary.js` keeps it in the order of the page's sort
  and marks the entry being read. The sort stays today's switch, restyled and
  stacked, where the mockup draws two radio buttons: one control, one state.
  "Back to top" on a phone appears after a scroll, as today. The page's own
  stylesheet sets a lighter `--cream` on `:root`; 2.0 puts the site's cream
  back (the page color row under "The system"). The hand-drawn ink under each
  title is not drawn in the 2.0 look, and the desk's fit of long titles
  (`glossary-titles.js`) finds nothing to do there.
- **Home.** The header stays on the green band (the mockups' header is a
  stand-in). The card's search field is the header's own, moved into the card
  when the page starts, so Home's header has no search button in the 2.0
  look, and the field keeps its words ("Search the LIT Bible"). The passage
  (Luke 3:4–6), the key term's card ("liberation"), and "Latest change" are
  built from the chapter file, the term lens, and the release notes at build
  time, so none can drift from the text. The term card has no close button
  (it is a picture of the tool, not the tool). The chat and the underline
  under "really" keep their scroll-in animation. One `span` (`v2-home__hl`)
  wraps the hero's highlighted words in both looks.
- **Search.** The left pane is new markup (`data-v2`) in a new slot of
  `SearchLayout` (`v2Pane`); `v2-search.js` moves the page's own sort,
  filters, Greek extras, and passage picker into it when the page starts
  (moved, never copied, so each stays one control), and draws "Result
  groups" from the groups the page already builds. Page links are always
  five numbers (`v2PageRange`). "Sort by:" keeps its colon and the picker
  its book icon, since both are shared with today's page. The desk's "Add …
  to a sheet" row stays sticky, as the desk has it.
- **The scripture chapter.** No markup changed: the sheet is a painted layer
  behind the text (`.scripture-main::before`) that follows the desk's own
  measurements, so it widens with the margin notes and stops at the Notebook
  ("two cards"). `v2-scripture.js` hides the phone's toolbar on a scroll
  down and returns it on any scroll up (640px and under, the site's phone
  breakpoint), by a `data-v2-bar` attribute on the toolbar. The Study Desk
  pill leaves the row at 900px and under, where the desk does not run, and
  Read View's pill is hidden ("Read View gives way to /desk"). The arrows
  keep their 44px touch size. The Notebook's top edge sits 18px above the
  title's box, since the title is smaller than today's.
  **Open for BVJ:** the mockup draws the chapter's arrows, Previous and
  Next, and "Back to top" as quiet controls; the restyle (E132) made them
  green primaries, and the build has left them green until BVJ says.
- **The book introduction.** The rail ("On this page") is new markup
  (`data-v2`) on an intro with two or more headings; a draft has none. Its
  links need targets, so each intro `h2` now has an `id` made from its words
  (`main-themes`, `structure`, `key-passages`,
  `takeaways-on-liberation-and-inclusion`), in both looks. The rail sits in
  the margin "from 1270px" at Small and Medium text; at Large it starts at
  1340px and at Extra large at 1440px, because the sheet grows with the text
  and the rail would otherwise leave the window. Below that it is a row of
  links under the title, as on a phone. The page imports `v2-frame.js` for
  the "you are here" marker.
- **The scripture pages' line is the site's, not the mockups'.** The mockups
  drew a text column about 680px wide; the build keeps the reading measure
  the preview already has (52, BVJ 2026-10-05; 48 beside an open Notebook),
  so the sheet is as wide as that line plus its padding.
