# The Sheets

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory. It governs the Sheets wherever they live: the client code here, the /sheets page (`src/pages/sheets.astro`, `src/styles/pages/sheets-page.css`), the sheet rules in `src/lib/desk-sheet*.mjs`, `desk-present.mjs`, and the document and slide writers (`desk-doc-*.mjs`, `desk-slides*.mjs`).
> The Sheets are part of the Study Desk, so **`src/scripts/desk/CLAUDE.md` applies here too**
> (the preview switch, the store, the records, the panes); read it unless it is already loaded.
> Cross-references such as "below" or "rule 15" were written when all of
> this was one file, so they may point into another area file; the root's
> index says which file holds each section. The headings keep the desk file's
> rule numbers, which STUDY-DESK.md and the audits cite.

The code moved here from `src/scripts/desk/` on 2026-11-08 (STUDY-DESK.md,
S12, step 0), so older records name the files without `sheets/`.

## The sheet editor runs on `document.execCommand`

**The sheet editor runs on `document.execCommand`** (12 calls through
`sheet-text.js`'s `exec`; obsolete in the standards but shipped by every
engine). Decision for version 1: accept it. Output is re-sanitized to a
canonical form (`sheetHtmlForShow`) so engine differences don't reach the
record. **A stored sheet is valid only while its canonical form never
changes**, so `test/fixtures/sheet-text-golden.json` (`npm run
build:sheet-golden`) holds the sanitizer's output byte for byte, and
`planSheetChange` edits over `cleanSheetText(current)`, so a drift becomes a
one-time rewrite rather than a refusal (DI3-6). An import and an opened share
likewise sanitize a sheet before checking it (DI6-1). A replacement behind the `createSheetText` interface is a version 2
item; add a cross-browser golden-file test of the eight commands before it.
A menu's `close()` takes the menu out of `openMenu` before removing it:
removing the focused item fires blur, the editor's `focusout` closes menus
too, and in the other order the second `remove()` threw NotFoundError before
`pick()` ran, so Paragraph style, Text alignment and Style applied nothing
(Audit 5, SH5-1). **A part's toolbar shows only while its editor has focus**,
or while one of its menus or its link form is open, or while a mouse press
that moved focus away is still down (`desk-rich-editor--tools`); it is drawn
below the text, so clicking into a part grows the card downward instead of
moving the words under the pointer, and a menu opens upward when the pane has
no room below it (SH5-6).

## Rule 18: the Sheets pane

Part of desk rule 18 (phases 3c to 3g, /desk); the rest of it, the panes
and the layout, is in `src/scripts/desk/CLAUDE.md`.

- **The sheet editor is `sheet-editor.js`, and the Sheets pane is
  `sheet-pane.js`, the editor in a pane** (3f; the pane is "Sheets", BVJ
  2026-11-08, "Sheet" until then; split for S12, part 1, step 1, so another
  page can hold the editor). **The editor knows nothing of panes**: its host
  hands in which sheet it shows (`getSheet`, `setSheet`; the pane's are the
  layout's `setPaneSheet`), an `idSuffix` for its element ids (the pane's id),
  `showPassage`, and `onSheetChange`, and it returns `sheet`, `persist`,
  `addPassage` and `newSheet` for the host to call. **What only a pane has
  stays in `sheet-pane.js`**: the list of open panes behind `addTarget` and
  `onAddTarget` ("Add to sheet" in the LIT pane's menus and the Search pane's
  add buttons), and the title menu's `desk:sheet-new`, which names a pane and
  calls its editor's `newSheet`. A new feature of the editor goes in
  `sheet-editor.js`, never in a host. The editor's formatted text is in `desk/sheets/sheet-text.js`
  (a paste or a drop is read by `pastedSheetHtml`, which keeps what
  Google Docs, Word and web pages mean; BA68, BA71, BA73; how a client
  reads a paste isn't in the format)
  and what it knows about the LIT (3h: blanks, the footnote picker,
  the key terms box and the license card) in `desk/sheets/sheet-lit.js`,
  whose rules are `src/lib/desk-sheet-lit.mjs`. A passage's Blanks list
  has one row per glossary term (all its blanks, one hint select, one ×)
  and one row per other blank, in order of first occurrence; a blank that
  no longer prints or whose words changed keeps its own row with its
  notice (`groupBlanks`, SH5-9). When a redraw
  removes the control that had focus, focus goes to one that is always
  drawn ("Blank the selected words", the footnotes summary, the key
  terms note), never to the page (`restoreFocus`, SH5-10). A footnote
  gives a blank away by using its words or by naming a traditional
  word the blank's hint doesn't show (`blankWords`' `telltale`; SH5-16,
  BVJ 2026-11-08), and the flag's sentence names that word. A page
  break's card has no Leader only box (SH5-17): a break is on both
  versions, though the format still allows the field. **A part is added
  between parts from the gap between them** (BVJ, 2026-11-08): pointing
  at the space under a card (or the keyboard: the pills are one Tab stop,
  up and down arrows, Home and End move between them; DK6-1) shows a line across it with
  an "Add" pill, lying over the cards so it takes no room
  (`.desk-sheet__after`, hung from the card above; shown on hover, while
  its menu is open, or on `:focus-visible`, never plain `:focus-within`,
  since the form's × and the menu's Escape hand focus back to the pill
  and a mouse user saw it stay until the next click), and the pill's menu
  adds the chosen part right after that card (`addPart(type, after)`), so
  a long sheet needn't be scrolled to its end. The pill's menu is
  `desk/sheets/insert-menu.js` (Audit 6, LG6-2; `openInsertMenu`, with
  `insertItems` and `insertMenuPlace` pure and tested), which takes the
  pill, the card's name, whether the sheet has a key terms box, and
  `onPick`/`onClose`; what a pick does stays in `sheet-editor.js`. (A "+" in
  the card's header read as acting on that card, not the gap.) "Passage…" opens the passage form under the card
  (`openInlinePassage`), never the bar's at the sheet's end, which looked
  like a glitch; each passage it adds goes after the card and then after
  the one just added (`addPassage`'s `target`), and the form is put back
  on its card after a redraw (`insertForm`). The bar's own buttons add
  after the part last worked in, else at the end. **My sheets lists
  Duplicate beside Delete** (BVJ, 2026-11-04; `duplicateSheet` in
  `desk-sheets.mjs`): the same parts under fresh ids, "<title> (copy)"
  (cut to the title limit), everything else kept (a passage's
  `verseCopy` carries, so the copy is still checked against the wording
  it was made on). It reads the sheet from the store at the click and
  refuses a sheet of a newer format (the button is disabled). **"Save as
  template" beside it** (Audit 5, D #1; `templateFromSheet`) writes a sheet
  record with `isTemplate: true` and no passages: listed apart as "My
  templates", offered in New sheet, and kept off every other list of
  sheets (`isOwnTemplate`); a new list of sheets must filter it too.
- **A sheet's passages come from the live text** (format rule 1):
  `src/lib/desk-sheet-passages.mjs` makes one from a verse menu, a
  selection or a notebook record, and finds its words in today's
  chapter; the pane draws them from the chapter's fetched page. A
  passage's blanks, footnote choices and key terms are worked out the
  same way, in that chapter's anchor text, with the term lens's marks
  turned into offsets (`termMarkOffsets`), so nothing about the text
  is stored but the words a blank covers. "Add to
  sheet" reaches the LIT pane's menus through `lit:panel-actions`, as
  the "My Notebook" row does, which reads `book`, `chapter` and
  `textFor` from the detail. Which sheet a Sheets pane shows is `sheet`
  on its pane in the layout (`setPaneSheet`).

## Rule 19: a sheet on paper

**Phase 3i is a sheet on paper** (STUDY-DESK.md, S4,
S5, S9, C27 and "Order of work", 3i): `src/pages/sheets.astro`, which
`desk-gate.js` fills with `src/scripts/desk/sheets/sheet-page.js` when
`[data-sheet-page]` is present. It shows, prints and copies a sheet and
**never writes a record** (sheets are edited on /desk only; the Sheet
pane's "Print or share…" opens it in a new tab). Six things to know:
- **`src/lib/desk-sheet-copy.mjs` is the rules** (pure, tested): which
  modules each copy prints (`modulesForCopy`: the participant's leaves
  out Leader only), one code per chapter (`chapterCodes`, the address
  form of STUDY-DESK-FORMAT.md, "Addresses"), the key terms box where
  its words are blanked, the paper (`defaultPaper`, `pageRule`), and
  `sheetHtmlForShow`, which sanitizes a sheet's formatted words again
  and links their references. **A new place that shows a sheet's
  formatted words uses it**, never `innerHTML` of the stored html.
- **`desk/sheets/sheet-copy.js` draws a copy from the Sheets pane's own reading**:
  `readPassage`, `passageWords` and `locateBlanks` are exported from
  `sheet-lit.js` for it, so the editor and the paper can't disagree
  about which words a passage, a blank or a footnote covers.
  `passageWords`' `keepNotes` keeps the printing footnotes' letters as
  plain superscripts.
- **A passage made from a selection says it is part of its verse**
  (Audit 5, SH5-14): the card names it with `passageLabel` ("Romans 8:6
  (part)", `desk-sheet-passages.mjs`), and the paper copy and present
  screens put a "…" before the words when they open inside their verse
  and after them when they close inside one (`partialEnds` reads that
  from the located range against the verse's own span, never from the
  words; `markOpenEnds` in `sheet-copy.js` draws them as `aria-hidden`
  spans after the blanks, so they stay out of the anchor text blanks
  locate by, and Copy, the saved files and the slides carry them);
  `passageReference` stays plain for announcements, screen titles and
  the copy's heading.
- **The printed codes are `src/lib/qr-svg.mjs`**, shared with
  `build-apps-qr.mjs`; `qrcode-generator` is a runtime dependency for
  that reason, loaded only by the sheet page's chunk.
- **Copy** (`desk/sheets/sheet-word.js`; "Copy for Word" until E36) reads the copy on screen and
  writes HTML with inline styles plus plain text, so what is pasted is
  what would print, codes aside. Its button carries the copy glyph (two
  sheets, drawn in `sheet-page.js`'s `copyGlyph`, as the glossary's copy-link icon) and
  the accessible name "Copy this version to the clipboard".
- **Save as ▾** (E37; BVJ, 2026-11-06) sits after Copy and saves the
  version on screen as a document: .docx, .odt, .rtf, or "PDF…", which
  runs Print and says to choose "Save as PDF". **Copy and the files read
  one model**: `readCopy` (`sheet-word.js`) walks the copy on screen into
  blocks and inline pieces (`src/lib/desk-sheet-doc.mjs` documents them),
  and Copy is that model's HTML and text writer (`docHtml`, `docText`),
  held to its old output by `test/fixtures/sheet-copy-golden.json`. A new
  part of the paper copy is read there once, and every writer then
  follows. The key terms box is a `box` block (E57), which each writer
  draws as a one-cell table ruled all round; a new writer must too, or
  the box comes out bare. The writers (`desk-doc-docx.mjs`, `desk-doc-odt.mjs`,
  `desk-doc-rtf.mjs`, over the hand-written `desk-zip.mjs`) are pure and
  reached only by `sheet-save.js`'s dynamic imports, never statically
  (`test/desk-sheet-doc.test.js` holds it). The menu's groups are
  `SAVE_GROUPS`. Every file ends
  with `LIT_CREDIT_LINE` and carries it in its properties; fonts are named,
  not embedded.
  **The "Slides" group (phase B) is present mode's screens, not the paper
  copy**: `desk/sheets/sheet-slides.js` (a dynamic import from `sheet-page.js`)
  runs `prepareDeck` and reads each screen off the stage, a passage covered
  and then revealed, so a slide can't disagree with what the room sees; a
  change to a screen's markup must keep `readSlides` reading it. The rules
  (the deck, cutting by length, the layout, a text box's paragraphs) are
  `src/lib/desk-slides.mjs`, shared by `desk-slides-pptx.mjs`,
  `desk-slides-odp.mjs` and the print view, so all three lay a slide out
  alike. A paragraph too long for a slide is cut after a sentence
  (DK3-1), since PowerPoint doesn't shrink a box's words on opening; a
  passage with blanks is cut only at verse numbers, its two forms' words
  differing. **Saved from the participant version the slides have no
  speaker notes** (SEC3-3; BVJ, 2026-11-07): no answers, no Leader only
  parts, no list of blanks. The credit line is on the first and last slides and in the
  properties. "PDF…" there is `printSlides`: a print-only copy of the
  slides, the page's `@page` rule swapped for the slide's size, every
  inline style `!important` (print.css turns everything black serif
  otherwise), all put back on `afterprint`. **In an .odp, never give
  `presentation:notes` (or the master's notes) a `draw:style-name`**:
  Impress paints the slides with it, which turned the dark ground white.
- **The paper is `localStorage['lit-sheet-paper']`** (Letter or A4,
  guessed from the reader's languages until chosen), named in /privacy's
  paragraph. Its `@page` rule is added as the page's last style, after
  print.css. On screen the copy is a white sheet of that width in either
  theme, and `sheets-page.css` lets the reader's named fonts, colors and
  backgrounds print, which print.css otherwise turns to black serif.
- **Printing without a sheet** (M6 with my notes, Print ▸ in the verse menu,
  the one Print menu, N9 with room to write) stays in `src/scripts/desk/CLAUDE.md`,
  rule 19, since its code is `desk/print-*.js`.

## Rule 20: present mode

**Phase 3j is present mode** (STUDY-DESK.md, S6, M2,
M3 and "Order of work", 3j), on the sheet's own page:
`src/scripts/desk/sheets/sheet-present.js`, opened by sheet-page.js's
"Present", or at once for `&view=present` (the Sheets pane's
"Present…") and `&view=presenter` (the presenter view's window). Like
the rest of the page it **never writes a record, and stores nothing**:
where the room is lives in the open windows. An empty text or question
part (no words and no rule) has no screen, and an empty Leader only part
gives no note; a part with only a heading or a rule still shows
(`presentScreens`, SH5-8). Five things to know:
- **`src/lib/desk-present.mjs` is the rules** (pure, tested): the
  screens (`presentScreens`: a start screen, then each passage, text,
  question and key terms box the room sees; a Leader only part goes to
  the presenter view with the screen before it), the room's codes on the
  start screen (`roomCodes`, S5's codes, at most four), a blank's cover
  (`blankCover`), the state and its steps (`checkState`, `stepState`),
  the footnotes the reveal lets out (`screenFootnotes`), the keys
  (`presentKey`), `fitSize`, and the messages between windows.
- **Blank (B or ".") and planned minutes** (Audit 5 D #12 and #2): `blank`
  is part of the shared state (so both windows agree; true or absent),
  and a step key while blank only un-blanks, it does not step.
  A part's optional `minutes` (integer 1 to 240, read by
  `moduleMinutes`) drives the presenter view's countdown per screen
  (`screenMinutes`, counted from first arrival) and "Planned N min · M:SS in";
  never the room's screen.
- **The reveal is the sheet's own blanks**, never a field of its own:
  a passage screen is drawn once by `presentPassage` in
  `desk/sheets/sheet-copy.js`, from the same reading as the paper copies, with
  each blank holding its words and their cover in one inline grid cell
  (`.sheet-blank--present`), so a reveal flips `data-revealed` and
  moves nothing. A change to how a copy reads a passage must keep both
  working.
- **The room's screen is dark in either theme**: its colors and its
  focus ring are pinned on `.present-stage` in `sheets-page.css`, which
  the presenter view's previews share (`.present-preview__surface`). Each
  screen is set at the largest type that fits (`fitScreen`); footnotes
  come up in a box of their own over the screen and are fitted
  separately, so they never shrink the verses.
- **The two windows stay in step through a BroadcastChannel**
  (`channelName`, one per sheet), with a `hello` from a window that
  opens and a `bye` from one that closes; every message is checked
  (`presentMessage`, `checkState`) before it is used. Every message
  carries the sender's `role`, and **a `hello` counts as hearing that
  window**, since the state then flows the other way and the newcomer
  sends none (BA84). The presenter view
  places the presentation on a second screen through the Window
  Management API where it can (`openPresenterWindow`); without it, the
  leader drags the window. Asking for the screens can use up the click
  a window needs, so where the permission had to be asked and the
  window is blocked, it says to choose Presenter view again (BA85).
- **While it is open, everything behind it is `inert`**, and the stage
  is a `role="dialog"`, which is what keeps the site's single-key
  shortcuts (keyboard-shortcuts.js) out of its way. Its keys are heard
  on the document in the capture phase, and a strip button about to be
  disabled or hidden hands focus to the stage first, so focus never
  falls out of the keys' reach (BA79).

## Rule 21: getting started and sharing

**Phase 3k is getting started and sharing** (STUDY-DESK.md,
M5, M9, S8 and "Order of work", 3k). Four things to know:
- **Templates** (M9) are `src/lib/desk-sheet-templates.mjs` (pure,
  tested; every template's formatted text must already be in the
  sanitizer's canonical form). New sheet in the Sheets pane lists them,
  each as its name and one line on what it is for (no second line listing
  its parts, BVJ 2026-11-08), and the title menu's
  "New sheet…" opens the same list (a `desk:sheet-new` event naming the
  pane). **A template's parts hold no text, only structure and a
  prompt** (Audit 5, SH5-2; BVJ's brief): a text part is its heading
  alone, a question is empty, and each carries `prompt` (a question's
  answer `answerPrompt`), plain text the format keeps in its own field
  (STUDY-DESK-FORMAT.md, "Modules"), which nothing prints, copies,
  presents or counts. **On paper an empty text or question part, an
  empty key terms box and a lone Leader only tag print nothing**, while a
  heading alone prints, a template's own included, as a cue
  (`printsOnPaper`; BVJ, 2026-11-08, SH6-3). **A new sheet is written
  with its first change**, not when its template is picked (SH6-7;
  `draft`, `persistDraft` in `sheet-editor.js`); Print, Present and an add
  from another pane or /search (`addTarget().ready`) write it first.
  The editor shows an empty part's prompt as its
  placeholder, and a part holding only its heading shows it under the
  heading (a `data-hint` `::after`, with `aria-description`) until the
  leader types there or a passage follows it; it never depends on whether
  the sheet has a passage (SH5-4). **Template text never mentions the
  editor's tools** (BA70; the test checks), so "Type the reference in
  the form below…" is the reading part's prompt, never its text. **The
  reading part's passage form is open from the start** (BVJ, 2026-11-08:
  the part "should already act as if the user has clicked the add
  passage on it"): `draw()` opens `openInlinePassage` under
  `readingPart(sheet)` while the sheet has no passage and no other form
  is open, without focus or scrolling; × or Escape closes it until the
  sheet is opened again (`readingDismissed`). A new part
  goes after the part last worked in (`insertIndex` in `sheet-editor.js`),
  but **a passage goes where the sheet says, not where the leader last
  clicked** (SH5-3): after the part last worked in only when that part
  is itself a passage, else after the sheet's last passage, else after
  the template's reading part (`passageInsertIndex`), else at the end
  (BA69). **A sheet never marks
  which part is the reading**: it is found by its heading ("Reading",
  "Read", "The text"; `readingPart`); a renamed one isn't, which only
  sends a passage to the end.
- **A sheet from a search or a topic** (M5) keeps desk code out of
  search.js: /search announces every hit (not just the page on screen)
  with a `lit:search-results` event on `document` and calls
  `loadDeskSheets()` in `search-core.js`, which imports
  `desk/sheets/search-sheet.js` only with `data-desk="on"`. The passages
  (Bible order, neighbors joined, capped at the sheet's limit) are
  `src/lib/desk-sheet-gather.mjs`. "Open it on the Study Desk" is
  `/desk/?sheet=<id>`, which desk-page.js shows in a Sheets pane
  (`showSheet` in `desk-layout.mjs`) and strips from the address.
- **Sharing** (S8) is `src/lib/desk-sheet-share.mjs` (pure, tested;
  format in STUDY-DESK-FORMAT.md, "Sharing a sheet"): the sheet, less
  its ids and comparison copies (and, for a participant share, its
  Leader only parts, answers, planned minutes, prompts, and parts of
  unknown types), as
  deflate-raw JSON in base64url after `#share1.`, or the same data on
  the last line of a `.lit-sheet.md` file (`fragmentInFile`). The dialog's note and the "Link
  copied" status both say the link is long because the sheet is in it
  (E58). A short link would need a hosted store, M14, deferred to
  signed-in readers. The Share dialog's button for that
  file is "Export a Study Desk file (.md)" and the Sheets page's is
  "Import a Study Desk file" (`EXPORT_LABEL`, `IMPORT_LABEL` in
  `sheet-page.js`; BVJ, 2026-11-06), so "Save as" names only a document;
  the reader-facing name of a `.lit-sheet.md` file is "a Study Desk file
  (.md)" wherever it is mentioned. Opening one decompresses with a
  ceiling, rebuilds the record with fresh ids, drops the comparison
  copies again and refuses it unless `validateRecord` passes. **The
  fragment must never reach a server or the analytics beacon**: an
  inline script in `sheets.astro`'s body moves it into
  `history.state.litSharedSheet` while the page parses, and again on
  `popstate` and `hashchange` (then reloads), since a link opened in a
  tab already on /sheets/ changes only the fragment, and a fragment
  navigation fires `popstate` first (BA78). The navigation timing
  entry's `name` still holds the original address, and the beacon didn't
  send it when checked (2026-10-20); recheck if the beacon starts sending
  timing names. Keep `SHARE_PREFIX` and the inline
  script in step.
- **Where the desk doesn't run**, `src/scripts/sheet-share-gate.js`
  (loaded by /sheets/ for everyone, small) handles a shared link. **On a
  phone or tablet it shows the sheet** (NB6-8): a dynamic import of
  `sheet-page.js`'s `showSharedOnPhone`, the one way desk code reaches a
  phone, with no notebook opened and nothing that saves (Present with
  taps and no presenter view, Print, Share…); a test holds the gate. On a
  computer without the preview, a link turns it on (`?desk=on#share1.…`).
  A shared sheet shows read only until "Import into my notebook", which saves
  it as a new sheet (`copyOfShared`) and turns the page into that
  sheet's own address. No storage key is added.

## Rule 22: a sheet checked before printing

**Phase 2b is a sheet checked before printing** (STUDY-DESK.md,
S2, N9 and "Order of work", 2b). N9 is the bullet under
rule 19. S2, in three things:
- **`src/lib/desk-sheet-check.mjs` is the rules** (pure, tested):
  `passageCheck` compares a passage's `verseCopy` with today's verses
  through N3's `wordingChanged` (typography folded), judging a quoted
  passage on its own words only; `freshCopy` is what "Keep the new
  wording" writes; `textAsOfLine` is the copy's "Text as of" line from a
  content version and its build time (`textDay`: the reader's day,
  not the build's UTC day). `readPassage` (`desk/sheets/sheet-lit.js`) carries the
  check as `check`, and the source's `contentVersion` (read off the
  fetched page's `<html>` by `chapter-page.js`).
- **The Sheets pane writes one thing the reader didn't ask for**: a
  passage with no `verseCopy` (gathered on /search) takes one the first
  time the pane reads it, through `change(…, { quiet: true })`, which
  commits with `record: false` so Ctrl+Z never undoes it into a loop.
  Keep is an ordinary, undoable change.
- **The sheet page only reports**: `drawCheck` above the paper
  (`.sheets-page__check`, hidden in print), and Keep is on /desk. Both
  notices draw the diff with `desk/diff-view.js`, shared with the
  change notice; change one and both move.

## Rule 23: a sheet takes notes from the notebook

Part of desk rule 23 (phase 2c); the rest of it, notes on a footnote, is in
`src/scripts/desk/CLAUDE.md`.

- **A sheet takes notes, highlights and pinned footnotes from the
  notebook as ordinary parts**: `src/lib/desk-sheet-from-notes.mjs`
  (pure, tested) lists the records on a sheet's passages (everything,
  newest first, on a sheet with none) and turns the chosen ones into
  parts (a question note a `question`, any other note or a pinned
  footnote a `text`, a highlight a `passage`); nothing links a part
  back to its record. The Sheets pane's "+ From my notes…" is the
  chooser (`openFromNotes`), adding the ticked ones in one change
  (E62; BVJ, 2026-11-08). It replaced N6's "+ For discussion"
  (`desk-sheet-discussion.mjs`, 2026-10-20 to 2026-11-08), which
  gathered only the notes marked `question` under a heading: "The
  options for sheets need to be more flexible than that, more useful to
  more people."

