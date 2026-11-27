# The Greek: the Greek tab, its data, and searching the Greek

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory. It governs the Study Desk's Greek wherever it lives:
> `public/greek/`, `npm run build:greek` (`scripts/build-greek.mjs`,
> `scripts/lib/greek-core.mjs`), `src/lib/greek-*.mjs` and
> `src/lib/desk-greek*.mjs`, and the desk's `tab-greek.js`, `greek-*.js` and
> `search-pane.js`. The Greek is part of the Study Desk, so
> **`src/scripts/desk/CLAUDE.md` applies here too**; read it unless it is
> already loaded. The headings keep the desk file's rule numbers, which
> STUDY-DESK.md and the audits cite.

## Rule 14: the Greek tab

**Phase 1f is the Greek tab** (STUDY-DESK.md,
"Order of work", 1f). **Featherboa takes it off the reading page's
Notebook panel and keeps it in Study** (the desk's new name): This verse's
Greek words and a draft chapter's line lead there (`SITE-FEATHERBOA.md`,
"Study and its places"). It also redraws a word's details as a card of
labeled rows, its four word searches gathered under one "Find this word ▾"
(rule 15's starters), with the text's verse numbers in gray (`SITE-FEATHERBOA.md`,
"The Greek"). Until it is built, this holds. Before touching it:
- **Its data is committed, not built.** `npm run build:greek` reads
  clones kept outside the repo (`GREEK_SOURCES_DIR`, `MORPHGNT_DIR`: the
  SBLGNT with its apparatus, MACULA Greek, the UBS dictionary, STEPBible's
  lexicons) and writes `public/greek/`: `text/` one file per chapter,
  `ubs/`, `step/` and `lsj/` lexicon shards the tab fetches when a word is
  opened, and `LICENSE.txt`. SBL's text is the text of record; MorphGNT's
  lemmas and parsing are checked against it word by word, and its word
  numbers (`t`) are alignment phase 2's. John 7:53–8:11 takes its parsing
  from MACULA's SBLGNT, Romans 16:25–27 its Greek from the SBLGNT
  apparatus and its parsing from MACULA's Nestle 1904. Re-run it when a
  source changes, never by hand.
- **Licenses keep the files apart.** `text/` and `ubs/` are licensed CC BY-SA
  4.0 (`text/` draws on MorphGNT, CC BY-SA 3.0, which converts one way to 4.0; `ubs/` on UBS); `step/` stays CC BY 4.0, as do the
  STEPBible brief glosses in `search/` (BA47), with two exceptions that
  are **CC BY-SA 4.0 because they are Perseus's text, which STEP edited and
  labels CC BY** (BVJ, 2026-11-03, the cautious route until STEP confirms a
  separate agreement with Tufts): all of `lsj/`, and each `step/` entry
  ending "(ML)", Middle Liddell filling a word Abbott-Smith lacks (55
  entries; Abbott-Smith itself is public domain). `LICENSE.txt` says so,
  and `SOURCES` credits Perseus. If STEP confirms in writing, `lsj/` and
  the "(ML)" entries can go back to CC BY 4.0. A `search/` brief gloss that
  equals its lemma's "(ML)" entry gloss takes the same route (BVJ,
  2026-11-07; 25 found). The sources and their credits are
  `src/lib/greek-credits.mjs`: the tab lists `SOURCES`, and every group
  of Greek search results carries `SEARCH_CREDIT` under it (BA46, GK-13),
  so a new place that shows Greek results draws it too. **Nothing from
  the LIT goes into `public/greek/`**: the tab's "rendered here as…" line
  reads the page's own `#term-lens-data`. A website asset, never under
  `public/api/`.
- **One loader serves a chapter's Greek** (`src/scripts/greek-chapters.js`,
  GK-20), the tab's `greek-data.js` and the search's `search-greek.js`
  alike, so a chapter on screen is fetched and parsed once; past 8
  seconds the tab offers Try again, a `fresh` request beside the stalled
  one (E133). **Arrowing
  through words asks for a lexicon only at rest** (150 ms, GK-10).
- **A copy from the tab writes its own clipboard** (E54): its words and
  signs are buttons (`role="button"` spans, never `<button>`, which is a
  box of its own and broke a selection's highlight at every word; 4k),
  which a sheet's paste drops with their text, so `tab-greek.js` turns
  them into plain `lang="grc"` spans and leaves out the "Verse " labels.
  A new clickable element among the words needs the same.
- **The tab never moves the page.** Its text scrolls on its own and
  opens at the verse being read, with "Go to verse N" to catch up; its
  words are one roving tab stop. The lexicon choice is
  `localStorage['lit-desk-lexicon']` (in /privacy). **The line between the Greek and a word's
  entry is draggable** (BVJ, 2026-10-17), the entry taking a quarter to
  three quarters of their room (`src/lib/desk-greek-split.mjs`; the handle is
  in `tab-greek.js`, on `--desk-greek-split`). A click or Enter on it opens
  its menu (XA8-1), whose "Let the entry size itself" resets it. Shown only
  while a word is open; kept in `sessionStorage['lit-desk-greek-split']`
  for the visit, forgotten by "Reset widths" (only its `kept: false` event,
  `forgetsSplit`, so the line still moves where storage is blocked, BA113),
  and named in /privacy's paragraph. The parsing is put in words by
  `src/lib/greek-parse.mjs`, and the
  SBLGNT's ⸀–⸅ signs draw from `public/fonts/text-critical-signs.otf`.
  SBL keeps a note on a span of verses under its first verse, so a sign
  finds its note at the nearest verse at or before its own
  (`noteVerseFor`, BA111), and a passage naming a verse the Greek lacks
  (Matthew 17:21) opens at the nearest before it (`nearestVerse`, BA120)
  and says so on /desk; This verse shows a gap (`gapNote`, E157).
- **A note starts from a chosen word or a selection of the Greek** (4k):
  its button (and, for a selection, a small menu inside the scroller,
  never a tab stop) opens the ordinary editor on the LIT's whole
  verses, the Greek quoted as `startBody` (`desk-note-from-greek.mjs`).
  Kind 2, no new field; offered only with LIT text and a notebook
  (`onAddNote`).

## Rule 15: searching the Greek

**Phase 1h is searching the Greek** (STUDY-DESK.md,
"Order of work", 1h).
- **It is ordinary site search, gated until launch.** Only while
  `greekSearchEnabled()` in `search-core.js` is true, which today is
  the preview's `data-desk="on"`; without it nothing under `greek/`
  is fetched and search is exactly as before. **Launch is that one
  function returning true.**
- **The engine is its own download, desk on or off** (`search-greek.js`;
  LG-6, BVJ 2026-11-04: it loads only when actually needed). The tray,
  /search and /desk's Search pane reach it through `loadGreekSearch()`
  when a query is Greek, and the Greek tab's `greek-find.js`, which
  imports it, loads when a word's search is started. Never import either
  statically from desk code. What has to run first is in the small
  `greek-detect.mjs`: `isGreekQuery`'s parts, and the tab's
  `parsingQuery`. `test/search-greek-lazy.test.js` holds the split.
- **One query never gets both English and Greek results** (BVJ,
  2026-10-13). A query with Greek letters or a Strong's number
  (`isGreekQuery`) gets the Greek alone, at any length (ὁ, ἐν), save the
  reader's own notes: under all types, the notebook's matches come ahead
  of it (BA40, BVJ 2026-10-28) unless the reader unchecks "My notes"
  (E11: a checkbox shown only with the desk loaded and the type "All
  types", in the tray, /search and the Search pane). It is remembered as
  `localStorage['lit-desk-greek-notes']` = "off", absent = on, named in
  /privacy; the rule is `src/lib/desk-greek-notes.mjs`, the reads are in
  `notebook-search.js`; English searches are not governed by it. Every
  other query gets exactly the pre-1h search, unless the reader picks the
  type menu's "Greek" (injected by script, only with the gate on), which
  searches Latin text as a transliteration or a gloss. A **single Latin
  word that is also a glossary term's Greek lemma** ("pistis") gets one
  line under the status, "“pistis” is also a Greek word (πίστις). Search
  the Greek", whose link sets the type to Greek (BVJ, 2026-11-04); the
  offer lists no Greek itself. `greekOfferFor` (search-core.js) reads
  `public/search/greek-offers.json` (fetched only with the gate on) and
  loads `greek-search.mjs` by a dynamic import, never at the top; the
  tray, /search and the Search pane each draw the line.
- **A typed Greek word that could be more than one is a question, never
  a guess** (BVJ, 2026-11-03, decision 9). 58 folded spellings are both a
  headword and a form of another word (ἡ). A one-word search (`matchGreek`
  with `offerForms`) offers each such lemma, the commonest first, and the
  surface shows its choice box. **Marks never decide it** (a breathing
  rule would leave ὃ/ὁ and εἶ/εἰ colliding and be invisible to readers who
  type none), and a command query keeps lemma-first (`ὁ, θεός` must stay
  the article, not ὅς), with one narrow fallback (BVJ, 2026-11-07): a
  single Greek word with filters whose lemma-first reading finds nothing
  in the whole text (`ἐξ.prep`) tries the other lemmas of that spelling
  (`formFallbackTerm`). The Greek tab's form button names its lemma
  (`prefer`), so it never asks. A test holds the 58.
- **One rule set**, `src/lib/greek-search.mjs` (pure, tested): Greek in
  any form and accent (folded by `foldGreek`, which `build:greek` also
  uses for the index), a Strong's number (**the words tagged with it,
  never whole lemmas**: a word carries its lemma's number unless MACULA
  tags it otherwise, so G1510 finds 105 words of εἰμί and G3596 one of
  πᾶς; GK8-1, BVJ 2026-11-10), a transliteration compared by key
  (`greekKey`/`latinKeys`: agreuō = agreuo, Christos = xristos), or an
  English gloss. Glosses are the lemma's own, STEPBible's brief one
  (πίστις is "to believe in" in UBS's commonest sense, "faith" there)
  and, as whole glosses only, every other UBS sense. First of all
  come **the LIT's own renderings**, through the glossary bridge
  (`build:greek-bridge`): "self-preservation" reaches σάρξ, but only in
  the verses the LIT renders it so, and a lemma that never occurs in
  those verses is dropped. Verse-level until alignment phase 2 covers
  every word, when the bridge widens.
- **A result is the verse link plus `?greek=<verse>.<t>`**
  (`greekHref`). `desk/greek-link.js` opens the Notebook at that word,
  even if the reader had closed it, and strips the parameter; a result
  for the chapter on screen sends `lit:greek-word` instead of loading.
- **The Greek tab has word searches but no typed search**
  (`desk/greek-find.js`): in a word's details the form, the lemma, the
  Strong's number and the parsing each start a search (BVJ, 2026-10-13),
  and the results replace the text until "← Acts 2" (the chapter's name). The
  header's search button and its field were taken out (BVJ,
  2026-11-02, E7): a typed Greek search is the search bar's, /search's
  and /desk's Search pane's, and the tab has no way into the commands
  window. The word choices and "Exact form only" stay, and "See results
  on the search page" (a new tab) sits beside "← Acts 2" (BVJ,
  2026-11-04). **While results show, those two take the heading's
  place in the tab's head row**, which doesn't scroll, and the heading
  moves to the top of the results as "ἄνομος in the New Testament" (what is searched: the form with
  Exact form only on, "Strong’s G435" for a number) over
  "Appears 9 times" (BVJ, 2026-11-21, E219). Featherboa opens the results
  in a Search tab beside the Greek in its pane instead, the text staying
  (`SITE-FEATHERBOA.md`, "The Greek"); until it is built, this holds. Its result rows preview their verse on hover like any
  reference (`ref-preview.js`; a row for the chapter on screen is a
  button naming its verse in `data-preview-href`, and a tap on it jumps).
  **A Greek word searches at any length there too** (ὦ, ἤ; BVJ,
  2026-10-26, BA110): `longEnoughForGreek` in `greek-search.mjs` decides it
  wherever the tab starts a search. A search that settles on the article
  (ὁ, not an exact form) answers with a line and a search beside a word
  (“ὁ, θεός”) instead of its list (BVJ, 2026-11-03).

## Rule 17: the Greek search commands

**Phase 2a's Greek search commands** (STUDY-DESK.md,
"Order of work", 2a): searching by parsing (`*.aor.impv`, "genitives
of πίστις") and by construction (`πίστις.gen > Ἰησοῦς/Χριστός.gen`),
behind rule 15's gate (above). **"," is any order, ">" in order** (E164).
Four things to know:
- **`src/lib/greek-query.mjs` is the language**, pure and tested:
  reading a query, looking its words up, `matchConstruction`, the readback,
  the error sentences, and `COMMANDS` and `EXAMPLES`. A test holds every
  listed command to the parser and every example to the committed data,
  so a new command goes in `FILTERS` or `COMMANDS` there and nowhere else. **One bare word is always a
  word** ("any", "perfect" and "genitive" alone search as glosses) and
  **quotes always mean the word itself** (BVJ, 2026-10-14). Two filters
  of one kind joined by "/" mean either (`.gen/dat`, BVJ 2026-10-15), so
  a term's `filters` can hold several of one axis; `codeFits` and
  `groupsForFilters` read that as "any of them". A filter with no word
  before it is any word (".gen" is "*.gen", BA48). **A search joins at
  most four words** (`MAX_TERMS`, BA44): `matchConstruction` builds each
  match round its middle word, exact but cubic only because of that
  cap, so raising it needs a new matcher, not a bigger number. **A query
  over 300 characters is an error** (`tooLong`, BVJ 2026-11-07), never
  cut and searched: the surfaces say why and leave the field as typed.
- **`searchGreekAuto` in `search-greek.js` is the one Greek search**
  the tray, /search, /desk's Search pane and the Greek tab's word links call: a command query goes to
  `searchGreekCommands`, anything else to 1h's `searchGreek`, with
  two or three plain Latin words that find nothing tried as a
  construction. **Plain words holding a command word are a gloss when
  they are one whole** ("present time", "in order to"; `wholeGloss`),
  and otherwise a command that falls back to the gloss when it fails
  or finds nothing (BA45, BVJ 2026-10-27). `isGreekQuery` also counts `*`
  and a dot followed by a parsing word, for the tray (no type menu).
- **The commands window is the one place for instructions and
  examples** (BVJ, 2026-10-14): a page gains only a "Search commands"
  button, a placeholder under the "Greek" type, the readback, and
  examples where an empty search's results would be. Before adding a
  hint or a control to a search page, put it in the window
  (`src/scripts/greek-commands.js`).
  **Its top is the search builder** (E5, BVJ 2026-11-02): a card for each
  word (up to four), whose menus list only what that word takes
  (`codeCounts`, from the shard the search uses, so nothing is fetched
  until a word is typed). **The search field is the only record of the
  search**: the builder reads it with `parseGreekQuery` on every change
  and writes it with `putSearch` (typed when the field has focus, so undo
  works after a mouse press); a card waiting for its word is the one
  thing it holds that the field doesn't. **It accepts what the field
  accepts** (BVJ, 2026-11-07): a card's word looks up the LIT's
  renderings through the glossary bridge, and two or three plain Latin
  words are read as the construction the field falls back to (`plain`).
  **A card's word box is made once and never
  replaced** while typed in (`boxes`/`shown`), or a screen reader hears a
  new control per letter and Ctrl+Z is lost. **It reads as the field
  does** (E162, `readCardBox`). A search it can't show says
  so and leaves the field alone, and a press that finds the field changed
  behind its back reads the field and does nothing else. The rules are
  `src/lib/greek-builder.mjs` (pure, tested); the drawing is
  `src/scripts/greek-builder.js`. The old list and examples sit under
  "Examples and all commands". A builder search is a Greek one, so writing
  one puts the page's type menu on "Greek". It is a `float-window.js`
  window, outside `lit-panel.js`'s one slot, so a footnote or preview
  opening never closes it; it opens from the tray, /search and /desk's
  Search pane, and closes when its field is gone (BA114). Featherboa
  opens it from one quiet link in the field's row, shown only while the
  Greek tab is chosen, and the word card's "Find this word ▾" searches
  reach it through the field; its name is open (`SITE-FEATHERBOA.md`,
  "Searching the Greek"); until it is built, this holds. What it announces is meant to be heard: a command by its meaning (“Added: Within 3
  words.”), the builder's by the query it made (BA117).
  **What it puts in a field is typed, not set** (BA147): `typeInto`
  replaces only the changed span with `execCommand("insertText")`, so
  Ctrl+Z works; setting `value`, which empties undo, is the fallback.
  Its two keys, `localStorage['lit-greek-commands']` (opened once) and
  `sessionStorage['lit-greek-commands-pos']` (a dragged place), are in
  /privacy's paragraph.
- **The data is format 3 of `public/greek/search/`** (each lemma's shard
  entry `[forms, flat, parses, others?]`, plus `parse.json` and
  `parse/<group>.json`, named by `parseGroup` in `greek-search.mjs`;
  `lemmas.json`'s `also` counts the words tagged with another Strong's
  number). Rebuild with `npm run build:greek`, never by hand.
  **Every search file carries `build`**, a hash of that output (GK6-9),
  since a lemma's id is its place in `lemmas.json` and the files are
  cached a day: `search-greek.js` never reads a shard or parse group
  from another build with the index, but drops what it holds, checks
  every file with the server and runs the search once more
  (`freshGreek`). A new loader of these files checks it too (`sameBuild`).
