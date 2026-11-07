# Study Desk: fixes and experience (Phase 5)

The running log of the Study Desk's bugs and of what using it is like,
starting with BVJ's own use of the preview (IDs **E1** onward). It was the
section "Fixes and experience" of `STUDY-DESK.md` until 2026-11-05, moved here
whole so it can keep growing without swelling that file. The E numbers are
unchanged, so every "E9" or "E28" elsewhere still means the entry below.
Everything else it cites (phases, "Order of work", D-, N-, M- and other IDs,
"Draft 4d") is in `STUDY-DESK.md`; grep it for the ID. Like that file, this one
is too large to read whole: grep for the E number and read that entry.
To find the next number to give, grep for `^- \*\*E[0-9]+` and take the highest
plus one.


Phase 5's log ("Order of work", 5; BVJ, 2026-10-16): bugs in what is built,
and what using it feels like, starting with BVJ's own use of the preview.
Ideas and decisions stay in their sections; this is for things that are
wrong or awkward in what already exists.

**How to add an entry.** Give it the next **E** number (never renumbered or
reused; keep IDs stable like every other ID here). One line says what
happened, then only what helps: where (page, view, tab), what BVJ was doing,
what was expected, the browser if it matters. Note who reported it.
**Status** is one of: *open*; *fixed* (with the commit or PR); *moved* (it
was really a feature, with where it went); *won't fix* (with why, so it
isn't reported again). Don't delete an entry when it's settled. Where a
bug sits in code that a decision here describes, link that decision.

**Kinds.** *Bug* (does the wrong thing), *rough* (works but is awkward,
confusing or slow), *wording* (copy, labels, help), *wish* (the first
sign of a feature: log it, and move it when it's clear where it belongs).

**Open**

- **E1, bug: a possible flash on load from N8's pre-paint addition to
  Layout.astro.** Known when N8 was built and held (2026-10-12; "Still
  open"). Lives on `claude/desk-1d-hidden`, not in this tree. Open, and
  waits on N8's hold.
- **E2, bug: a hidden verse's own menu is unreachable.** Same source and
  hold as E1. Open.

**BVJ's use of the preview** (add as they come)

- **E4, rough: revisit Places.** BVJ (2026-10-16), from using the preview:
  "underwhelmed. It needs work." Open, and the first item the phase takes up.
  The specifics aren't recorded yet; add them here as BVJ names them. What
  exists to rework (B1, built in 1d; "Order of work", 1d, Places and
  ribbons): a Places section in My Notes and on the notebook page, listing
  this book's places, "Continue reading", ribbons (at most 6, following
  while you read from one, C25), other clients' places, then Read View's.
  "Continue reading" and Read View's places are not notebook records.
  B4's scrollbar ticks and a margin mark for ribbons were not built.
  BVJ is not taking it up yet (2026-10-16); it is here so it stays in the
  plan. **Taken up on 2026-10-22 as E9** (BVJ named the trouble: two
  features for one idea, and a Places section that lists places the reader
  never made). E9 holds the answer; the questions below stay as the
  record of what was weighed. **Closed by E9, built 2026-11-02.**
  **Questions to ask when it is picked up**,
  as prompts and not findings:
  - Is the trouble **finding and seeing** places: where the list sits, how
    it is ordered, or that nothing marks a place on the page itself (the
    unbuilt ribbon mark and B4's ticks)?
  - Is it **what a ribbon does by itself**: following while you read from
    it, the 4-second move, or that creating one doesn't start it following?
  - Is it **how little it does** beyond "Continue reading"?
  - Is it **two kinds of place** (ribbons as notebook records, "Continue
    reading" and Read View's in their own storage) showing as one list?
  - Is it **making one**: "Ribbon here…" being in the verse menu and
    selection panel, the 6-ribbon limit, the naming?
  - The answer may send part of it to B4, or to sync's open question on
    whether places sync (BVJ leans against).
- **E5, rough: the Greek search commands window isn't intuitive.** BVJ
  (2026-10-16): it "mostly works but it doesn't feel intuitive." Open.
  **What's wrong** (BVJ, the same day): not the commands themselves, but
  **putting a search together**, and **understanding how the window
  interacts with the search bar**. **What to try** (BVJ): a menu-based
  builder, to see whether it is better, when the work is taken up. A
  direction to try with a mock, not a decision. What exists (2a, Greek
  search commands; CLAUDE.md, the desk's rule 17): the commands window
  (`src/scripts/greek-commands.js`) is the one place for instructions and
  examples, opened by "Search commands"; it lists `COMMANDS` and
  `EXAMPLES` from `src/lib/greek-query.mjs`, and clicking one inserts it
  into the search field. The page itself shows only the readback and, for
  an empty search, examples. **Questions for the mock**, as prompts and
  not findings:
  - **Where the builder lives.** Inside the commands window keeps the
    one-window rule and adds nothing to the search pages ("quiet
    controls"); on the search page beside the field would be easier to
    find but is the kind of control those rules weigh against.
  - **How it relates to the field.** Does the builder write the typed
    command as you choose (so you learn the notation by watching it), or
    keep its own state with the field showing only the result? Either
    way, the field and the builder should never disagree about what is
    being searched, which is the interaction that is unclear today.
  - **What the menus offer.** A word (with its lemma shown), then part
    of speech, case, tense and so on, each listing only what that word
    actually has (which also answers E6's "a noun has no verb forms"),
    and a way to add a second word for a construction.
  - **The same builder in all three places**: the tray, /search and the
    Greek tab, since `searchGreekAuto` is already one search behind them.
  **Decided and built 2026-11-02 (work session 7b).** BVJ looked at a mock
  and took every one of Claude's recommendations:
  - **Where it lives**: the top of the commands window, which already opens
    from the tray, /search and /desk's Search pane (the Greek tab no longer
    opens it, E7). The search pages gain nothing.
  - **How it relates to the field**: the field is the only record of the
    search. The builder reads it with the language's own parser on every
    change and writes it as the reader chooses (typed, so Ctrl+Z works), so
    the two cannot disagree; each card shows the notation it makes
    (`πίστις.gen`) so the reader learns it by watching. A search it can't
    show (`=` exact, plain words, one that doesn't read) is
    said so and left alone, with "Start a new search". Rejected: a locked
    field with "Edit as text" (two modes, the same unclear interaction), and a
    builder on the page beside the field (a new control on every search
    page, and a second place to keep up).
  - **What the menus offer**: a card per word (up to four), a word box that
    shows its lemma, Strong's number, gloss and count, then only the kinds of
    choice the word takes (a noun offers no tense), each choice with how many
    of the word's occurrences it leaves, and each choice narrowing the others
    (θεός, once "genitive" is chosen, offers only singular and masculine, since
    its plural and feminine forms aren't genitive).
    Several of one kind mean either (`.gen/dat`). "+ Then another word" and,
    from two words, "How close" (within 3, next to each other, anywhere in the
    verse, either order). The old list and examples sit under "Examples and all
    commands". Writing a builder search puts the page's type menu on "Greek"
    when the text isn't plainly Greek.
  - E6 (word families) is not started; a card could later gain a "related
    words" choice, and nothing is added for it.
  Rules: `src/lib/greek-builder.mjs`, `src/scripts/greek-builder.js`
  (src/scripts/desk/CLAUDE.md, rule 17).
  **BVJ looked, 2026-11-04** (a pass of the preview items, steps one at a
  time). The builder "feels more intuitive than the old commands window" and
  makes clearer how the choices interact; the steps checked out. One change:
  the window sat at the top of where the Notebook sits, not the top of the
  browser window, so the search bar was hard to see without scrolling. **Built
  (PR #463):** where there is room beside the field the window now opens at the
  window's top edge, below the field only where that would cover it (not for
  the Notebook's placement). The same pass moved a Greek search's type menu:
  "All results" keeps its name and a Latin word that is also a Greek one
  offers the Greek search (rule 15; see the 2026-11-04 note under E11).
  Status: **looked at; the change built.**
- **E6, wish: search a word family, not just one lemma.** BVJ
  (2026-10-16): `hamartia.noun/verb` finds no verbs, `hamartano.noun/verb`
  no nouns, and `hamartia.adj` no ἁμαρτωλός. Checked against the committed
  index the same day: **working as built, but not as a reader expects.**
  Each word in a query resolves to one lemma (hamartia → ἁμαρτία, hamartano
  → ἁμαρτάνω; `resolveGreekQuery`), and a part-of-speech filter only
  narrows that lemma's own forms, so `.verb` on a noun lemma can never
  match. Nothing in the search knows that ἁμαρτία, ἁμαρτάνω, ἁμάρτημα and
  ἁμαρτωλός are one family, and a Greek stem (ἁμαρτ) comes back "unknown."
  **Version 2 (BVJ, 2026-11-03):** out of every phase of version 1; see
  "Version 2: deferred and shelved". Two things to settle when it is
  taken up:
  - **Where the families come from.** Stems or prefix matching would be
    wrong often (ἁμαρτ- is clean; many roots aren't, and compounds hide
    them). A source that groups lemmas by root is better, if one of the
    sources `build:greek` already reads carries it, or another with a
    license that fits `public/greek/` (rule 14). Not yet checked.
  - **How a reader asks for it.** A family command (something like
    `hamartia.family` or a "related words" choice), versus making a
    part-of-speech filter widen to the family by itself, which would
    change what `hamartia.noun` means today. Meanwhile, a filter that
    rules out every form of the lemma could say so ("ἁμαρτία is a noun;
    it has no verb forms") instead of returning nothing; whether it does
    today wasn't checked.
- **E7, rough: is searching too much for the Notebook's Greek tab?** BVJ
  (2026-10-16), thinking aloud and not a decision: the site's search bar
  could keep doing what it does with the Greek, and focused Greek
  searching could be designed for /desk's Greek pane (D9), which happens
  either way. **The Phase 5 question is only whether to take searching out
  of the Notebook's Greek tab.** **Decided** (BVJ, 2026-11-02): **take out
  the typed search, keep the word links.** The search button and field
  leave the tab; a word's form, lemma and Strong's number still start a
  search from the details. Typed Greek searching lives in the search bar,
  /search and /desk's Search pane (3m). Open: decided, to build (the
  removals listed below, and where the word links' results show). What is there today (1h, "The Greek
  tab searches too"; `desk/greek-find.js`): a search button in the tab's
  header opens a field in place, results replace the text until "Back to
  the text," and in a word's details the form, the lemma and the Strong's
  number each start a search. The field also opens the commands window.
  The choices, as prompts:
  - **Keep it as it is.**
  - **Take out the typed search, keep the word links**: a word's form,
    lemma or Strong's number still shows where else it occurs, which
    starts from what the reader is looking at and needs no typing or
    builder. Where those results show (in the tab, or on /search) is part
    of the choice.
  - **Take out both**, leaving the tab for reading the Greek, and send
    every Greek search to the search bar.
  - Either removal also touches the tour's `greek-commands` step (it
    demonstrates the commands in the tab's field), the help page's
    paragraph on searching the Greek, the tab's half of the commands
    window's open-and-close rule, and the desk's rule 15 in CLAUDE.md.
    E5's builder would then live in the search bar's commands window
    until /desk.
  **Built** (2026-11-02, for BVJ to judge on the preview): the tab's search
  button, field and commands link are gone; the form, lemma, Strong's
  number and parsing links in a word's details still search, with results
  in the tab and "Back to the text" (their place is unchanged). The tour's
  `greek-commands` step is removed (14 steps in Study View; a stored old id
  is ignored), the `greek` step and the help page's paragraph are reworded,
  and rules 15 and 17 follow.
  **BVJ looked, 2026-11-04:** all of it works as described, with three
  changes, built in PR #463: **"See results on the search page"** (was "See
  these on the search page") sits at the top of the Greek tab's results beside
  "Back to the text", not at the bottom; **the Search pane's filters are in
  /search's order** (book, then type); and **the Search pane has the same
  "See results on the search page" link**, since it shows less than the page
  does (it carries the query, book and mode). Status: **looked at; changes
  built.**
  **Carried into work session 7b, BVJ took Claude's recommendations
  (2026-11-02):** the focus move to "Back to the text", the header while
  results show and the reworded tour step stay as built unless BVJ's look on
  the preview finds a problem; the parsing link **stays** in a word's details
  (it starts from the word being read, which is the case this item kept); and
  the word links' results **stay in the tab** (the reader keeps their place,
  and "See these on the search page" is the way out; the link's words and
  place changed 2026-11-04, above). Nothing was changed for them. Status:
  looked at 2026-11-04.
- **E8, rough: there is no way into /desk, and Read View retires at
  launch.** BVJ (2026-10-21): no button or link reaches /desk, and
  switching between Study View and Read View was always clunky. **Decided**
  (BVJ, 2026-10-21; decision log, "Read View retires at launch"): **Read
  View is removed when the desk launches**, with no trial period after, and
  on a computer Study View's "Read View" button becomes the way into the
  desk, whose LIT pane already scrolls the whole New Testament. Phones
  aren't a reason to keep it: BVJ expects people who read on a phone to
  install the apps, which already scroll. Open: decided, to build.
  **Before launch:**
  - **A Reading arrangement** in /desk's Layout menu: one LIT pane at the
    reading width, honoring the Display tray's verse numbers, footnote
    letters, key terms and highlights switches (`data-vn`, `data-fn`,
    `data-terms`). /desk isn't a reading surface today, so check which of
    them it honors.
  - **A way in that carries the passage** (for example
    `/desk/?place=romans-8`), which moves the active LIT pane there and
    never overwrites the reader's saved layout (`lit-desk-layout`); a first
    visit opens the Reading arrangement. A reader who wants to read must
    not land in a four-pane workspace, the first-use card and the tour
    offer.
  - **Other ways in**, to mock: the Notebook panel's foot, the notebook
    page, a header item on a computer.
  **At launch:**
  - **Redirects**: `/read/<book>` to `/<book>-1/`, with a small script
    sending `#ch-N` to `/<book>-N/` and `#<book>-N-vV` to `/<book>-N/#vV`;
    the pages leave the sitemap. Search results that link Read View
    anchors link Study View instead.
  - **Saved places**: "Continue reading" records with `view: "read"` are
    read as Study View places, not dropped; Read View's per-book places
    are carried into Places or let go (to decide).
  - **Copy**: the `/read` landing page (which offers Study View, Read View
    and the apps), the /about FAQ, `/apps` if it names Read View,
    /privacy's storage paragraph (`lit_rm_*`, `lit-read-numbers`), the
    notebook help page and the tour.
  - **Code that goes**: `read/[book].astro`, `read-mode.js` and
    `landOnHash`, `read-mode.css`, Read View's half of `chapter-tools.js`,
    ReadMenu's `mode="read"`, the Display tray's Read View verse-numbers
    setting and its fallbacks, the desk's Read View pieces (bookmarks via
    `read-marks.js`, its "My highlights", printing with notes or room to
    write there), and the whole-book print layout.
  - **Docs**: CLAUDE.md (routing, Key Conventions, print, the Study View
    and Read View rule, the desk's rules) and README.
  - **Chapter View's name goes** (E33, BVJ 2026-11-06): what is left of it
    becomes descriptive ("on its scripture page"), and the /read card's
    description, not its heading, says how it differs.
  - **Tag the last commit with Read View** before removing it, as the way
    back.
  **Open, for BVJ:**
  - ~~**The whole-book browser tools.**~~ Ctrl+F across a book, Edge's Read
    Aloud, page translation and printing a whole book need the book on one
    page, and the LIT pane loads chapters as the reader nears them. **Let
    go** (BVJ, 2026-11-02): book-scoped search covers finding a word.
  - **The button's label.** "Study Desk" says study; the button now also
    serves the reader who wants to read straight through. **Decided (BVJ,
    2026-11-04): keep "Study Desk."** Read View is going, the card and the
    picker link use the same name, and the Reading layout is the way to a
    plain page of text.
  **8a built 2026-11-02 (work session 8a).** BVJ's answers: build "Reading"
  and see how it feels (the menu's word is a try, not a decision); the
  recommended `?place=` rules; the whole-book question below (let go).
  - *Reading* is the first row of the Layout window: one LIT pane (the
    active one, else the first, else a new one at the shared place), the
    other panes closed. It is the same shape as "One pane", told apart by
    the pane's kind (`arrangementOf`): One pane over My Notes is still One
    pane. Nothing new was needed to honor the Display tray: `.desk-lit__text`
    already sits at the reading width, centered, in Study View's own markup,
    so verse numbers, footnote letters, key terms and highlights reach it.
  - *`/desk/?place=romans-8`* (also `romans-8:16`, `romans-8-v16`): the
    layout the page would have opened (last, "My default", or for a first
    visit the original LIT beside My Notes) stays, and only the active LIT
    pane and the shared place move (`arrivalLayout`, `parsePlaceParam`).
    **BVJ, 2026-11-02: a link never forces an arrangement**, so E8's "a
    first visit opens the Reading arrangement" is dropped; Reading is a
    Layout choice only. The move is saved as any move on the desk is, and
    the parameter is stripped from the address.
    A value that names no passage is ignored. /desk has no Notebook panel,
    so the tour offer and first-use card never show there.
  - *The way in that carries the passage* is the header's "Study Desk"
    link (BVJ added it, 2026-10-29, and hid the "Switch to Read View" pill
    while the preview is on): on a chapter page it now points at
    `/desk/?place=<book>-<chapter>` (`deskPlace` through Layout to
    SiteHeader). The Notebook panel's foot and the notebook page were
    **not** given links of their own: the header link is on every page and a
    second one would only add a control.
  - *Decided (BVJ, 2026-11-02): the whole-book choice is let go.* Not built. BVJ asked whether
    Ctrl+F across a book is needed when book-scoped search (the bar, /search
    and the Search pane) finds a word anywhere in a book. Search covers
    finding, with stem matching. What it does not cover is a browser tool
    working on the page as read: Edge's Read Aloud past the loaded
    chapters, printing a whole book (the Print menu prints one chapter at a
    time), and Ctrl+F's in-context highlighting. These go with Read View;
    8c says so in the help copy.
  - *BVJ looked, 2026-11-04.* `?place=` and the Layout row behaved as
    described, with two changes. **Reading is told apart from One pane by what
    it takes off the text**: choosing it also turns off verse numbers, footnote
    letters, key terms, and highlights (the undo bar names them and Undo puts
    them back); choosing another layout (or Reset) turns back on only the ones
    Reading turned off.
    And **every reading line is 10% down** (the LIT pane's was 25%, and
    `keepReadingPlace`'s 30%), so a `?place=` verse lands near the top. Left
    at their own lines on purpose: Read View's chapter line and focus line,
    which Read View's retirement (8c) removes, and the Greek pane's "Go to
    verse" tolerance. Status: **8a looked at; both changes built.**
  **8b built 2026-11-02 (work session 8b).** BVJ's answers: swap the /read
  card in place (option A), the picker link too, and the card's wording
  chosen by an Opus subagent; the "Available now" badge moves to the desk
  card.
  - *Behind the preview* (`html[data-desk="on"]`; everyone else keeps Read
    View unchanged): the /read "Ways to read the LIT" grid shows a **Study
    Desk** card in the Read View card's slot (both are in the page and
    `read.css` shows one, so nothing shifts), "On a computer: the whole New
    Testament in one scroll, with your notes and the Greek alongside when
    you want them." with "Try the Study Desk →" to `/desk/?place=matthew-5`;
    the "Available now" badge leaves the apps card for it. The chapter
    picker's footer link reads "Open Matthew in the Study Desk →" and goes
    to `/desk/?place=matthew-1` (ReadMenu.astro reads `data-desk` when it
    builds the footer). Study View's own "Read View" button was already gone
    (8a: the header's Study Desk link, carrying the chapter, replaced it).
    The picker on Read View itself still offers Study View.
  - *BVJ, 2026-11-04:* the desk card drops "On a computer:" (`data-desk="on"`
    is stamped only on a computer, so a phone or tablet never shows it), and
    the Chapter View card's "Made for close reading and study" became "Nothing
    to set up, and it works on any device," since the desk now owns study. The
    name stays "Chapter View" for now (an Opus agent advised keeping it:
    "Classic" reads as "the old one" while Read View is being retired, and the
    name was changed two days ago). **Decided (BVJ, 2026-11-04): keep "Chapter
    View"** ("Classic View" was floated and let go). The same pass made the
    hamburger menu a side tray on a computer (below).
  - *Dormant prep, not switched on:* `src/lib/read-view-retirement.mjs`
    holds the rules named under "At launch": `readViewRedirects()` (the
    Astro redirect entries, `/read/<book>` to `/<book>-1/`),
    `studyAddress(pathname, hash)` (`#ch-N` to `/<book>-N/`,
    `#<book>-N-vV` to `/<book>-N/#vV`, a block id keeps its id, an unknown
    chapter falls back to the book's start), `studyRecord` and
    `studyContinueHref` (a `view: "read"` "Continue reading" record is read
    as a Study View place; Read View's `lit_rm_*` per-book places are let go,
    E9). `src/scripts/read-view-redirect.js` is the page script that applies
    `studyAddress`. Astro's static redirect page is a meta refresh and drops
    the `#fragment`, so at 8c `/read/[book].astro` becomes a noindex page
    that loads that script and carries the meta refresh as the no-script
    fallback. `test/read-view-retirement.test.js` covers all of it, plus a
    test that fails if anything imports these files, so they cannot go live
    by accident; **8c wires them in and deletes that test.** Search
    results' Read View anchors (`search-core.js`) are 8c's too.
  - *Also from BVJ's look, 2026-11-04, built in PR #464:* **the hamburger
    menu is a right-hand side tray on a computer** (mouse and fine pointer,
    including /desk and a narrowed window), 380px at most, over a dimmed
    page, instead of the full-screen overlay; a touch device keeps the full
    screen. The Study Desk card and the header link stay computer-only, also
    after the preview flag is removed (a phone or tablet is sent to the apps),
    which is a requirement for 8c's flip.
  Status: **8b looked at 2026-11-04 and merged (#464); 8c at launch.**
- **E9, rough: Bookmarks and Ribbons are confusing and redundant, and
  Places adds a third layer.** BVJ (2026-10-22), from using the preview.
  **Decided** (BVJ, 2026-10-22; decision log, "Bookmarks and ribbons become
  one"); open to build. It takes up E4. **What exists**: a *bookmark* (B2,
  built in 1c; a `bookmark` record, a verse and an optional label, drawn as
  a red bookmark glyph in the notes' margin) and a *ribbon* (B1, built in
  1d; a `place` record with `ribbon: true`: named, at most 6, moves while
  the reader reads from it, C25), plus a **Places** section in My Notes and
  on the notebook page that lists this book's places, "Continue reading",
  the ribbons, other clients' places and Read View's per-book places. The
  reader meets three words for one idea, and a list that opens with
  entries nobody made.
  **The decision, in BVJ's words, tidied:**
  - **One feature, called Bookmarks**, with **the functionality of
    Ribbons**. The red bookmark glyph, already the mark on the page, is the
    one visual cue, and it is never called a "ribbon". The word "ribbon" is retired from everything a
    reader sees (the verse menu's "Ribbon here…", the Places list, the
    tour's "A ribbon for a reading" step, the help page, the commands).
  - **No Places section, and no default locations.** The notebook's list
    (My Notes, the notebook page) holds **"Continue reading"** first, the
    one place that is always there, and **it gets no red bookmark glyph**
    (it is where the reader stopped, not something they marked), and then
    **only the bookmarks the reader has added**, appearing as they are
    added. Nothing else is listed to begin with: not the book's other
    places, not other clients' places, and not Read View's per-book places
    (which answers E8's open "carried into Places or let go": let go,
    since Read View goes at launch and the reader never made them).
  **What building it involves**, as prompts for the mock and not yet
  findings:
  - **Making one.** The verse menu and selection panel keep one action,
    "Bookmark", where today there are "Bookmark" and "Ribbon here…". It
    can be named at once or later. The 6-ribbon limit and the 40-character
    names stay unless BVJ says otherwise; bookmark labels are optional and
    not unique today while ribbon names are unique ignoring case, so one
    rule has to be chosen.
  - **Following.** The ribbon's behavior (C25: following its link makes it
    follow the reader through the book, moved at most every 4 seconds)
    becomes a bookmark's. **Claude's recommendation, confirmed by BVJ on 2026-11-02**:
    a bookmark stays on its verse unless the reader turns on "Move as I
    read" for it, so that someone who marks John 3:16 to find it again
    isn't surprised, while a "Thursday group" bookmark does what a ribbon
    did. Read as "the functionality of Ribbons" with no switch, every
    bookmark would move once opened, and a plain mark-this-verse bookmark
    would no longer exist.
  - **The mark on the page.** The margin mark B1 never got is the same
    red bookmark glyph; B4's scrollbar ticks (Read View, retiring) are moot.
  - **The record.** One kind where there are two: `bookmark` gains the
    ribbon's name and following flag, and `place` with `ribbon: true`
    retires (`STUDY-DESK-FORMAT.md`, kinds 4 and 5). Preview notebooks that
    hold ribbons are converted on open, and the export file's places
    section, the merge rules and `merge-vectors.json` change with it.
  - **Copy and code.** `desk-places.mjs`, `desk/places.js`,
    `ribbon-follow.js` and `ribbon-form.js` become bookmark code; the
    `lit-desk-ribbon` session key is renamed; the tour, the help page, the
    commands, /privacy's paragraph and CLAUDE.md (the desk's rules 7 and
    13) change.
  **For BDR's Claude: please notice.** This changes what syncs. The apps
  are building "full bookmarks and named ribbons" (R4, in the first synced
  release); that would now be one feature, bookmarks, and ribbons need not
  be built as a separate kind. A reading place doesn't sync in version 1
  (kind 5; BVJ, 2026-10-29); if one does in version 2, "Continue reading"
  is the only place, one per book, and no named place exists. The website will
  update the format draft and the merge vectors when it builds this and
  will say so here. ~~Raise any objection here before the apps build ribbons.~~
  **Accepted by BDR, 2026-10-23**: the apps build one kind, Bookmarks.
  **Built 2026-11-02 (work session 3), with BVJ's answer to the one open
  question: a bookmark stays put unless "Move as I read" is on.** The record
  is `bookmark` with `label` and `follow`; a ribbon reads as one. What was
  built, the judgment calls, and the note to BDR's Claude are in the
  2026-11-02 entry under "Decisions". **BVJ looked, 2026-11-04:** "Bookmarks" is
  fine, and a plain bookmark stays put while a moving one follows. Changes, built
  the same day: the verse menu's "Edit bookmark…" sits right after "Remove
  bookmark"; pressing "Bookmark" opens that form at once; a row shows the name
  under the reference and a line "Bookmark · Stays put" / "Moves" /
  "Following" (the first wording, "Moves as I read" and "Following me now,"
  wrapped to a second line in the Notebook's narrow list, so each is one short
  word with the longer sentence as hover text; BVJ proposed "Smart," "Static" and "Following"; an Opus
  agent advised against the first two, as an AI-sounding gimmick and developer
  vocabulary, so the plain words stand unless BVJ prefers his); and the margin
  mark of a moving bookmark jumps 5 seconds after the reading pauses instead of
  sliding as the reader scrolls. The form's hint gained "Off, it stays put on
  its verse." Also built 2026-11-04: **opening a bookmark that stays put stops
  the one that was moving**, and a **"Stop following"** link (the row of the
  bookmark being followed) and button (the verse menu) end it by hand, leaving
  the bookmark on its verse with the switch still on. **Decided the same day
  (BVJ, after two Opus design passes): a follow pauses instead of ending.**
  Jumping (a far chapter, another book, a page outside the book) pauses it where
  you left off, with a bar and a row link "Move it here"; reading on (the next
  chapter) carries it; a pause ends after 12 hours. A bookmark being followed only
  *rests* at its verse (an outline in the margin, no Remove in the verse menu,
  "Leave it here" instead) and belongs to it only when the follow ends. A verse
  holds one bookmark that stays put and one that moves, the second made with
  "Move as I read" fixed at the kind the verse lacks. **Moves are red, stays put
  are gold.** An Opus audit of "when
  should it stop" followed (2026-11-04); fixed: every way the flag drops redraws
  the rows, turning the switch off stops it at once, a reload or Back no longer
  writes verse 1, a link opened in place on /desk starts no follow, and a
  bookmark found in search follows or stops like its row. **Accepted (BVJ):**
  /desk, /notebook and /search pause the flag instead of clearing it; a move overtakes Undo of an
  earlier edit after the reader reads on; the last move before a tab closes can
  be lost. **Settled (BVJ, 2026-11-06): both stay as built.** Other rows
  (notes, highlights, pins, Continue reading) that go to another chapter
  don't stop a follow: they are jumps like any other, so a far one pauses it
  and the next chapter carries it. And the verse a followed bookmark rests on
  doesn't count as bookmarked in its verse menu: "Bookmark" is still offered,
  with the resting line, "Leave it here" and Edit below it. **Checked in the browser the same day (2026-11-04):** the pause
  bar on a far jump (Luke 1 to Luke 5), "Move it here" (the bookmark goes to the
  new place, follows from there, and the next far jump pauses it again), a gold
  mark in dark mode, the Bookmark flyout in the selection panel (as in the verse
  menu), and a gold mark with a resting outline on one verse (stacked, both
  visible). **That check found a bug, fixed in #470:** a far jump that lands on a
  verse (a link to `/luke-1/#v1`) reports twice before the follower's first
  check, and the second counted the first as reading, so the bookmark moved
  instead of pausing. The place a page "last heard" is now set only when a
  report is accepted (`bookmark-follow.js`, with a test). Merged: #465 (the
  /desk panes box no longer shows an extra scrollbar with a Sheet pane open) and
  #467 (all of the above). Status: **looked at; changes built** (the apps need nothing but to carry `follow`).
- **E10: the `bookmark` note marker clashes with Bookmarks, so rename it
  or retire it. Decided by BDR, 2026-10-23: renamed `ribbon`.** BVJ (2026-10-22): leave it
  for now, and **strongly recommend** one of the two. One of the seven
  note markers (`note`, `emphasis`, `question`, `heart`, `bookmark`,
  `lightbulb`, `flame`) is named `bookmark` and drawn with a bookmark
  glyph, and with E9 that word and picture now belong to the feature, so a
  reader choosing a marker for a note could think it creates a bookmark.
  Not changed: the marker is in both apps and in the shared format
  (`STUDY-DESK-FORMAT.md`, kind 1's `marker`), so either way is a format
  change for BDR's Claude to agree. Precedent for both: iOS already reads
  an old `star` as `emphasis`, so the apps can read an old value and write
  a new one.
  - **Rename it `ribbon`** (BVJ's first suggestion, and BVJ's answer on
    2026-10-22 once the picture was raised). Keeps seven markers and every
    existing note's marker, and **the picture stays the same**: the
    marker's color already differs from the red bookmark glyph, and
    "ribbon" describes what the marker looks like. The red glyph is never
    called a "ribbon" (BVJ, 2026-10-22), so the word belongs to the marker
    alone. Cost: both apps read an old `bookmark` marker as `ribbon` and
    write the new name.
  - **Retire it** (BVJ's other option, 2026-10-22). Six markers remain,
    and nothing shaped like a bookmark is left on a note. Cost: notes
    already marked `bookmark` need somewhere to go, most simply the plain
    `note` marker (the way `star` becomes `emphasis`), which loses a
    reader's choice of picture on those notes, and both apps must stop
    offering it.
  **Claude's recommendation, for BVJ and BDR to decide: rename it.** It
  was to retire it, on the worry that a ribbon-shaped marker would look
  like the bookmark glyph; BVJ's point that the color differs, and that
  the name fits the picture, settles that, and renaming keeps every
  existing note's choice. **BDR, 2026-10-23: rename it.** The format's
  marker list now says `ribbon` (`STUDY-DESK-FORMAT.md`, kind 2); each app
  reads an old `bookmark` as `ribbon` and writes `ribbon` (iOS NB12,
  Android NB12, both small). **The website followed on 2026-10-27, ahead
  of E9** (PR #385): its marker picker says "Ribbon", and it reads an old
  `bookmark` as `ribbon` and writes `ribbon` (see the 2026-10-27 entry
  under "Decisions").
- **E11, wish: a Greek search should let the reader turn their notes on or
  off in its results.** BVJ (2026-10-28), right after BA40's call (FA1-s,
  #399), which made a Greek search under all types list the reader's
  matching notes ahead of the Greek, in the search tray and on /search's
  first page. Today the only way to leave them out is to pick the "Greek"
  type, which also changes how Latin letters are read (as a
  transliteration or a gloss), so it isn't a real off switch. Open: where
  the switch lives (the Greek group's foot beside "Search commands", the
  "Your notebook" group's own title, or /search's filters), whether it
  is remembered (a new storage key goes in /privacy's paragraph), and
  whether it should also govern notes on English searches. **Built**
  (2026-11-02, on Claude's recommendations, for BVJ to judge on the
  preview): a "My notes" checkbox, on by default, in the tray's Greek group
  foot and beside "Search commands" on /search; shown only with the desk on
  and the type "All types"; remembered in `lit-desk-greek-notes` (named in
  /privacy; the LSC site stores none of the desk's keys, so needs no sentence); English
  searches are not governed by it. (Corrected 2026-11-04: /desk's Search pane
  has the same switch and lists notes for a Greek search when it is on, PR
  #463.) The tray shows it only when a Greek group renders.
  Status: looked at 2026-11-04 (below).
  **Placement settled 2026-11-02 (work session 7b, on Claude's
  recommendations):** on /search the link and "My notes" are one box, inline in
  the field's row where there is room and, under 960px, on a line under the
  field with the link at the left and the checkbox at the right, so a narrow
  window no longer squeezes the field (at 768px it was 177px wide); the tray
  re-searches when the box changes, as before; and the tray's switch is now
  **one line under the status for every Greek search under "All types"**, so a
  Greek search with no Greek hits still has it (it had lived in the Greek
  group's foot, which such a search doesn't draw). **The LSC site's
  `/privacy` needs no sentence for it** (BVJ looks after that page; an Opus
  agent reviewed LSC's issue #120 on 2026-11-04: LSC has no Study Desk and
  sets only `lsc_apps_launch_v1`, `lsc_pv` and `lsc-theme`, and its Scope
  section sends readers to litbible's policy for this site's storage). This
  site's sentence, in the storage paragraph: "`lit-desk-greek-notes` (whether Greek
  searches list your notes, once you turn that off)"). **A second one, from
  PR #464 (2026-11-04):** the sentence for `lit-desk-reading-off` ("which
  display settings the Reading layout turned off, so choosing another layout
  can turn them back on"), in the same list on this site's /privacy, just
  before `lit-desk-layout`. Nothing else in
  /privacy changed; the builder keeps nothing.
  **BVJ looked, 2026-11-04, and found three things, all built in PR #463.**
  (1) The "My notes" checkbox didn't show in /desk's Search pane, which had no
  switch; it now has the same one on its link row, beside "See results on the
  search page", for a Greek search under all types. (2) The capital O's in the
  pane's headings looked odd at that size: the other panes' headings are Inter,
  so the Search pane's match them (one style, in the same case, across pane
  kinds). (3) The look raised two things not in E11: **Greek terms in topics**
  (a topic "pistis" made a plain search show results as if it were a Greek one,
  which would confuse), so **BVJ decided to remove transliterated Greek from
  topics corpus-wide** (about 80 tags from 53 chapters and 3 intros;
  TOPICS.md rule 5 rewritten and CLAUDE.md follows); and **the type menu's
  "All except Greek"** was awkward, so an Opus agent was asked for options (a
  relabel, a line offering the Greek search, or a separate English | Greek
  switch) and BVJ took **B, the offer**: "All results" keeps its name, the
  Greek type stays set apart in the menu, and **a single Latin word that is
  also a glossary term's Greek lemma ("pistis") gets one line under the
  status**, "“pistis” is also a Greek word
  (πίστις). Search the Greek," whose link sets the type to Greek (a build step
  writes `public/search/greek-offers.json`, 125 lemma keys; rule 15). The
  offer lists no Greek itself, so a query still never gets English and Greek
  together. Status: **looked at; changes built.**
- **E12, wish: a trash the reader can restore from.** BVJ (2026-10-28),
  with BA39's call (FA1-t, #400). The help page used to say a deleted item
  waits in the trash for 30 days, which suggested it could be brought back;
  on the website only Undo can, until the page is left, and nothing lists
  the trash. The apps' next version lets the reader restore from it, so
  the website should too, and then the help page can say so again. The
  records already allow it: a trash record holds the whole item for 30 days
  (`restoreFromTrash` in `desk-records.mjs`; M7, “A trash with undo”).
  Open: where the list lives (the notebook page, beside “Empty the trash
  now,” is the likely place), and whether restoring is an undoable change
  like any other. **Decided and built 2026-11-02 (work session 11), on
  Claude's recommendations, which BVJ accepted whole:**
  - **Where**: a **Trash** section on the notebook page, above Delete
    everything (a jump link, `#trash`; hidden in print). “Empty the trash
    now” stays under Delete everything, the opposite act. Not in the
    Notebook panel (too narrow for the words) or /desk (not needed for
    version 1).
  - **A row** is the ordinary record row with “Deleted Nov 2, 2026, 21 days
    left” and **Restore** as its only button, latest deletion first; a
    tombstone isn't listed; labels and sheets are listed too. **Restore all**
    sits above the rows; it needs no confirmation, being undoable.
  - **Restoring is an ordinary undoable change**: Ctrl+Z, the undo bar
    (“Note on Romans 8:3 restored.”), redo. Undoing puts the same trash record
    back with a fresh `deletedAt`, as the format already says for any undo
    (rule 10); `makeEntry` no longer allots a second trash record for a
    record a change brought back from the trash, which would have left two
    for one deletion.
  - **A restore writes what the format already says** (the record under its
    own id, `modified` and `client` restamped, the trash record removed; one
    this code can't edit comes back exactly as it was), **so the format, the
    merge and `merge-vectors.json` are unchanged** and the apps need nothing:
    the restored record outranks the deletion by rule b, and the vectors for
    an edit later than a deletion already cover it. For BDR to confirm that
    the apps' restore does the same (same id, trash record removed, no
    tombstone left behind).
  - **What a restore leaves alone**: a label id on a note that names no label
    stays and isn't drawn; restoring a label brings the label back, not its
    use on items (deleting it stripped those, in a step of its own).
    **Refused, and left in the trash, with a sentence**: a bookmark onto a
    verse that already has one of its kind (BA16; since 2026-11-04 a verse
    takes one that stays put and one that moves, so the other kind is
    restored), and a label whose name is already
    kept (names are unique). **A bookmark that moved as the reader reads comes
    back plain when six already move** (and the sentence says so). A mark
    whose words moved since gets the usual change notice (N3), nothing special.
  - **The help page** says so again: Undo puts it back right away; after
    that, Restore in the Trash on the notebook page, for 30 days.
  Code: `trashItems`, `daysLeft`, `planRestore` and `planRestoreAll` in
  `desk-notebook.mjs` (pure, tested), `desk/trash-list.js`, a `trash` option
  on `recordRow`. **BVJ looked at it on the preview (2026-11-04) and said it
  all looks good**: the Trash section, Restore and Restore all, the undo bar
  and redo. The look turned up one change, made the same day: with a verse
  now holding a bookmark that stays put and one that moves (E9), a restore is
  refused only when the verse already holds one of the bookmark's own kind.
  Status: done.
- **E13, bug: the logo and word mark's home link reaches across the
  header's empty space to the page title.** BVJ (2026-10-30), from using
  the preview. The link should cover only the emblem and the "LIT Bible"
  word mark, not the gap between them and the page title (clicking the
  gap goes home, which nobody means). Likely cause, not yet checked: the
  brand anchor (`.site-header__brand`, `SiteHeader.astro`) is a flex item
  that grows to fill the row on the desk's pages. Expected: the hit area
  is the glyph and word mark only, on every page, with the focus ring
  hugging the same box. **Fixed 2026-11-02 (#430):** the brand anchor is a
  grid item in the header's first column, and grid items stretch by default;
  `justify-self: start` sizes the link to its content, with `max-width:
  100%` so a long title still stops it at the column's edge. Status: done.
- **E14, wish: a quick way to add a pane on /desk.** BVJ (2026-10-30). One
  control adds the next pane: with one column open it adds a second, and
  so on. With four panes open (the most /desk holds, D9) it is disabled,
  not hidden, so the limit reads as a limit. Open: what the new pane
  shows (an empty pane that asks what to open, as the layout control does
  today, is the likely answer), and whether it also lives beside the
  Layout choices. **Decided and built 2026-11-02 (work session 6), in E15's
  menu.** BVJ chose **Add pane** to open a flyout to the right with **Add
  column** and **Add row**, and, once one is chosen, the kinds of pane
  replacing those two in the same flyout (a "‹ Add column" row goes back).
  Claude had expected an empty pane that asks what to open, "as the layout
  control does today"; it does not (the Layout choices fill a new slot with the
  first kind not yet open), and the flyout makes the question unnecessary. A
  column is a full-height pane at the page's right edge, a row a full-width pane
  along the bottom (`addPane`, `desk-layout.mjs`); the existing panes keep their
  proportions. With four panes open the item is disabled with "Four is the
  most", and a direction the window can't hold is disabled with "Needs a
  wider/taller window". Add pane is not repeated beside the Layout choices.
  Status: done.
- **E15, wish: the page title becomes a menu.** BVJ (2026-10-30), thinking
  aloud and not a decision. On /desk the page title would open a drop-down
  that gathers the page-level actions now spread along the bar: **Layout**,
  **Display options**, **Add new pane** (E14), the **Print chapter**
  dialog (E16), and "anything else we decide should be added." Open:
  what else belongs (Settings, the tour, the help page are candidates;
  nothing is chosen), whether the Layout and Print buttons on the bar
  stay as well or give way to the menu, whether the title on `/notebook`
  and `/sheets` becomes a menu too or only `/desk` does, and how it
  announces itself as a button (a caret, as the Layout and Print buttons
  have, and `aria-haspopup`/`aria-expanded`). Needs a mock before it is
  built ("quiet controls"). **Decided and built 2026-11-02 (work session 6).**
  Claude mocked three options (everything in the title; the menu added with
  the bar unchanged; Layout kept on the bar with a "+ Pane" button) and BVJ
  chose the first, **with Aa moved into the menu too**. The title is now
  `Study Desk ▾` (caret, `aria-haspopup="menu"`, `aria-expanded`); its menu
  holds **Add pane** (E14), **Layout…**, **Print…** (the shared Print menu,
  E16), **Display options** (the header's own Aa button moved in whole; the tray
  hangs from the title), then **My notebook page**, **Take the tour** and **Help
  for the Study Desk** (the three links open in a new tab, since they leave the
  desk). BVJ (2026-11-02) asked for a Settings item holding only what applies
  to /desk; Claude found nothing left to put in one (the margin switches mean
  nothing here, highlights are in Display options, the start layout in Layout),
  and BVJ answered that no "Hide my marks" button is needed and the notebook
  items belong in the menu itself; a "Where my notebook is kept" link was
  tried and dropped, since it only went to a section of the notebook page. Layout and Print left
  the bar, which now holds only the menu button; their windows are the same,
  hung under the title. Only `/desk` has the menu; `/notebook` and `/sheets`
  are unchanged. **For BVJ to check:** the tour link goes to John 3 (the tour
  runs on a chapter page, not on /desk), so it opens in a new tab. Status: done.
- **E16, rough: printing a chapter needs its own chapter choice, and the
  Notebook lacks the plain-chapter print.** BVJ (2026-10-30), two parts.
  (1) The Print menu on /desk (`desk-page.js`, "the Print menu") prints
  "the leading LIT pane's chapter, else the shared place," so with no LIT
  pane open it has nothing to print. It should carry a **chapter picker**
  (book and chapter) so it is fully usable with no LIT pane open; the
  open pane's chapter stays the default when there is one. (2) /desk
  offers three choices ("The chapter," "With my notes," "With room to
  write"), but the **Notebook offers only the ones with notes**. The
  chapter without notes or room to write should be there too. The menu
  and the picker should be one piece of code that /desk and the Notebook
  both use, so they can't drift again; E15 would open it from the title
  menu. Open: the picker's shape (two selects, or a reference field that
  reads "John 3" the way the search box does) and where the Notebook's
  copy of the menu sits. **Decided and built 2026-11-02 (work
  session 5).** BVJ approved Claude's recommendation on all three open
  points ("Go ahead"). (1) The picker is the **reference field the panes
  use**, with its Previous and Next arrows, not two selects. (2) It starts at
  the leading LIT pane's chapter (else the shared place; in the Notebook,
  the page's own) each time the menu opens, changes only what is printed,
  and with no chapter (or a draft) leaves the choices off with a line
  saying why. (3) The Notebook's two print buttons became one **"Print…"**
  button in the Settings tab that opens the same menu in place, with all
  three choices; this page's own chapter prints in place, another chapter
  opens a new tab, as /desk's does. In Read View the menu has no picker and
  prints the book on the page (the plain choice says "The book"). One
  module, `desk/print-menu.js`, with its rule in `printMenuState`. Not
  tried: a real print of the new tab's output on paper (the print paths
  themselves are unchanged). The Notebook can't tell a draft chapter, since
  only /desk carries the draft list, so a draft picked there opens a tab
  that prints nothing. Status: done.

- **E17, rough: the My Notes pane and the Things I've Kept pane overlap
  too much to be two panes.** BVJ (2026-10-30). Some small differences
  show, but their use is largely the same. They should be consolidated
  into one. **Frontrunner name: "My Notebook"** (BVJ, 2026-10-30), not
  yet decided. Open: which pane's behavior survives, what
  happens to the layouts and saved panes that name either one, and what
  the Notebook's tabs and the tour and help copy say afterward. Needs a
  look at what each pane holds that the other doesn't before it is built.
  **Decided and built 2026-11-02 (work session 4).** BVJ named the one pane
  **"My Notes"** (the Notebook's tab and the pane kind keep their name; not
  "My Notebook," which would collide with "the Notebook" panel and the verse
  menu's "My Notebook" row). My Notes was the base, since it follows the LIT
  pane, shows Continue reading and the change flags, and opens notes in full;
  it took from What I've kept the search ("Search my notebook"), "Show" by
  kind, the count in words, headings by chapter (once the list spans more
  than one), and the "Labels…" button with label chips. That design was
  Claude's recommendation; BVJ confirmed the name first and then the
  design ("Looks good," 2026-11-02, on PR #435). The pane kind `kept`
  is retired: a saved layout that names it reads back as `mine`
  (`RETIRED_KINDS`), "My default" included; a layout that held both keeps
  two My Notes panes. `kept-list.js` stays for /notebook. E19 needed no
  rework (the /desk My Notes pane had no "+ Note" button). A label record is
  no longer listed in My Notes (`listable`). Status: done.
- **E18, wording: pin and unpin on footnotes should be a glyph, not
  words.** BVJ (2026-10-30). Pin becomes a thumbtack; unpin becomes the
  same thumbtack with a diagonal line through it. Each keeps an
  accessible name ("Pin footnote 3," "Unpin footnote 3"), `aria-pressed`
  or the label saying which it is, and a tooltip. Applies to the pin
  buttons in `pins.js` and wherever Study View's Footnotes list shows
  them. **Built 2026-11-02 (#431):** a stroke-only thumbtack to pin and the
  same thumbtack struck through to unpin, in the text's own color so it
  follows the theme and forced colors, named "Pin footnote 3" and "Unpin
  footnote 3" with a tooltip (`pins.js`). The thumbtack now means pinning a
  footnote and nothing else on the desk. Status: done.
- **E19, wording: "Add a note" becomes "+ Note."** BVJ (2026-10-30). On
  the buttons by footnotes (`footnote-notes.js`), in the My Notes pane
  and in the This verse pane. The accessible name stays long ("Add a note
  on footnote 3"), as it is today. The verse menu's and selection panel's
  "Add a note" rows are not named, so they stay unless BVJ says
  otherwise. **Built 2026-11-02 (#431) as "+ Note"** (with the space) on the
  footnote buttons (`footnote-notes.js`) and in This verse (`tab-verse.js`),
  each keeping its long accessible name. The My Notes pane has no such
  button (see E17). Status: done.
- **E20, wish: rename Study View, and put the Study Desk in Ways to Read.**
  BVJ (2026-10-30). On /read, the three cards in the Ways to Read section
  change: the **Read View** card is replaced by the **Study Desk**. And
  **"Study View" is renamed sitewide**, to something not yet chosen
  ("Chapter pages" is a candidate). Open: the name; that this follows E8,
  where Read View retires at launch and its button becomes the way into
  the desk; and the reach of a rename: reader-facing copy, the tour,
  help, the apps' mentions, release notes already written, and the
  "Study View"/"Read View" paragraph in CLAUDE.md. Nothing is renamed
  until BVJ picks the name. **The card part is built behind the preview**
  (work session 8b, 2026-11-02; see E8): with the preview on, the Study Desk
  card takes the Read View card's slot, and it goes to everyone at 8c. The
  rename of "Study View" is still open. BVJ (2026-11-02) floated "Chapter
  View" and "Page View" and asked an Opus subagent to weigh in. **Its
  recommendation, not a decision: "Chapter View."** Keeping "Study View"
  would leave "Study View" and "Study Desk" as the site's two web
  surfaces once Read View is gone; "Page View" is vague and collides with
  "page views" the metric; "Chapter pages" is a plural noun that reads
  badly on a card or button; "Study page" and "Chapter Study" bring the
  collision back. "Chapter View" names the unit, is a one-word swap
  ("Try Chapter View →"), and fits the apps' vocabulary. Cost: about 20
  reader-facing strings in about 14 files (`read.astro`, `ReadMenu.astro`,
  `read/[book].astro`, `Layout.astro`, `SiteHeader.astro`,
  `SblgntNotice.astro`, `notebook/help.astro`, `desk.astro`,
  `searchbar.js`, `search.js`, `read-mode.js`, `desk-first-use.mjs`,
  `desk-bookmarks.mjs` labels only, `desk/lit-pane.js`,
  `desk/desk-panes.js`, `desk/tour.js`), about 10 test files, and the
  CLAUDE docs. **Decided and built (BVJ, 2026-11-02): "Study View" is now
  "Chapter View."** The apps have only the one view, so nothing there
  changes. Every reader-facing string, code comment, test and CLAUDE doc
  in `src/`, `test/`, the root `CLAUDE.md` and `BDR-ONBOARDING.md` was
  swapped in PR #440 (identifiers such as `view: "study"`,
  `scriptureControls: "study"` and `trackStudyView` are storage and code
  names and stay). This file, FIXLIST.md and the audits are records and
  still say "Study View." Status: done (the rename); the Study Desk card
  part ships to everyone at 8c. **At 8c the card and the chapter picker's
  Study Desk link still show only on a computer** (BVJ, 2026-11-04): they are
  hidden on a phone or tablet today only because `data-desk="on"` is stamped
  under the app-platform test (Layout.astro's pre-paint script,
  `src/lib/app-platform.mjs`). When the preview flag goes, keep that test in
  the stamp, or give the card and the link their own device guard, so a
  phone never sees a link to a page it can't use.
- **E21, wording: the panes' "Stay here" buttons become a lock glyph.**
  BVJ (2026-10-30). The thumbtack with "Stay here" becomes a lock when a
  pane stays and an unlocked lock when it follows, with no words
  (`desk-page.js`, the pane header). It keeps an accessible name and
  tooltip ("Stay here," "Follow the LIT pane"), and `aria-pressed`.
  This also frees the thumbtack to mean pinning a footnote only (E18).
  **Built 2026-11-02 (#431):** a lock when a pane stays, an unlocked lock
  when it follows, no words, with the name and tooltip kept and
  `aria-pressed`; the thumbtack is free for pinning a footnote (E18).
  Status: done.

- **E22, bug: the My Notes pane doesn't follow the LIT pane.** BVJ
  (2026-10-30), from using the preview on /desk. By design it should:
  the pane lists notes on the verse at the LIT pane's reading line and
  scrolls to match ("Order of work", 3; the pane's lead title says "My
  Notes, This verse, Greek, and Footnotes follow this pane"), unless its
  lock is on. Not yet reproduced: check whether its own "Stay here" is on,
  whether it follows a scroll but not a picker move (or the reverse), and
  whether it happens only with the LIT pane scrolled by the reader. Fold
  the fix into E17, since the consolidated pane must follow. **Reproduced
  and fixed 2026-11-02.** Tried on /desk with 23 notes in Matthew 1 to 7:
  the pane followed the picker, wheel scrolling and a scrollbar drag, held
  with Stay here on, and caught up when it was turned off. What read as not
  following was the design of `follow`: it stayed put in a chapter with
  nothing kept and whenever the row it wanted was already in view, and
  never marked which row that was. Now `followTarget` (`desk-notebook.mjs`)
  finds the first record at or after the reading line across books, so a
  chapter with nothing kept brings up the nearest records; the row in the
  chapter being read is marked (`aria-current="location"`, a bar at its left
  edge); and a line says "Nothing kept in Matthew 9." Not tried: two LIT
  panes, and a scrollbar drag in Firefox or Safari. The LIT pane's own
  picker keeps the old reference while it has focus and the reader scrolls;
  not changed. Status: fixed.
- **E23, bug: a Septuagint reference opens a translation of the Hebrew.**
  Found 2026-10-30 while planning D10, by running `linkScriptureRefs` on
  footnote wording. "LXX Ps 51:4" stays plain, as intended:
  `QUALIFIER_BEHIND` in `src/lib/scripture-refs.mjs` keeps a reference
  qualified by "LXX" or "Septuagint" from linking, since Sefaria would
  open the Hebrew. But the test looks only at the word right before the
  reference, so "the Septuagint version of Psalm 40:6", "the Septuagint
  version of Proverbs 11:31" and "the Septuagint (Isaiah 24:20)" all link
  to Sefaria's JPS English. Those footnotes usually cite the Septuagint
  where it differs from the Hebrew (Hebrews 10's footnote c quotes the
  Septuagint's Psalm 40:6 and sets it against the Hebrew's "You have
  hollowed out ears for me"), so the link shows the reader the wording
  the footnote contrasts. Affects every
  reader, not only the desk. Expected: a reference the footnote ties to
  the Septuagint doesn't open Sefaria; it stays plain until D10's link
  exists, then opens the Septuagint in English. Open: how wide the test
  reaches (a phrase ending in "of", a parenthesis after "the
  Septuagint"), checked against all 113 mentions so a Hebrew reference
  near the word isn't caught. **Fixed 2026-11-02 (#429):** `QUALIFIER_BEHIND`
  also reads a singular "version, rendering, reading, text or translation
  of" after the Septuagint (with an optional parenthesis), "version
  (Septuagint) of", a parenthesis opening right after it, and a reference
  followed by "(in the Septuagint"; a plural "versions of" or a bare "of"
  can name the Hebrew, so those still link. Across the corpus it unlinks 11
  Sefaria links in 9 footnotes and changes nothing else. D10's link to the
  Septuagint in English is still unplaced. Status: done.
- **E24, wish: split the tour in two, a notebook tour and a Study Desk
  tour.** BVJ (2026-11-02), while the title menu (E15) was being built. The
  one tour (`desk/tour.js`) walks through the notebook on a chapter page, so
  /desk's "Take the tour" link has to send the reader to John 3. The ask: a
  **notebook tour** that stays on the chapter pages, and a **Study Desk
  tour** that runs on /desk (panes, the title menu, the Layout choices, Add
  pane, the shared place and "Stay here", My Notes). Then /desk's menu
  starts the desk tour in place, and the notebook's help and ">tour"
  command keep starting the notebook one. Open (to settle when the session
  starts): the desk tour's steps, whether the two share the seen-steps list
  (`lit-desk-tour`) and the first-use offer, and whether the desk tour is
  offered the first time /desk opens. **Status: done 2026-11-02 (work session
  9), the open choices settled with BVJ the same day.** (1) The desk tour acts
  fully, with the desk in its original layout first and the reader's own put
  back at the end (BVJ: "make sure everything is in the default layout, then
  begin the demonstration. At the end of the tour, it should put everything
  back the way it found it"). Seven steps in two parts: Your panes, My Notes,
  Reading in sync (BVJ's wording and title), Stay here, then the title menu,
  Add pane and Layout. Claude had recommended pointing rather than acting,
  since every layout change saves; the answer was to act and keep any of it
  from being saved while the tour runs (`layoutFrozen`), tested by reloading
  mid-tour. (2) The two tours keep separate lists and offers
  (`lit-desk-tour`, `lit-desk-page-tour`). (3) /desk offers the tour in a
  floating window the first time it opens, as the notebook does (BVJ thought
  the notebook's offer was a window beside the Notebook; it is), and "Remind
  me later" leaves a quiet line at the top of the title menu. The menu's
  "Take the tour" starts it in place; the notebook's help and `>tour` command
  still start the notebook tour. BVJ also found the notebook tour's 14 steps
  too many, and it is now 10 (option 1 of three: Highlight and Bookmark are
  named in "Open the menu", "Set the widths" went to the help page, the
  notebook page and where it's kept merged). Left out of the desk tour, as the notebook tour
  covers or the menu names them: Print, Display options, the Search and Sheet
  panes, the start radios. See `src/scripts/desk/CLAUDE.md`, rule 13, "Two
  tours".
- **E25, rough: how panes behave when dragged.** BVJ (2026-11-02). The drag
  behavior of panes (today: a pane's header is the handle, dropping on an
  edge of another splits it, shown before the drop, a drop that leaves a pane
  too small is refused, Escape cancels) needs a look. **Nothing is specified:
  when the session starts, ask BVJ what to change before doing anything.**
  Status: **built 2026-11-02; BVJ tried it and kept all of it.** BVJ's answer was the swap (candidate 1) and the
  steadier zones (2), then clearer drop feedback (3) and a keyboard route
  (6). Built: **dropping on the middle of a pane swaps the two** (the
  slots keep their sizes, each pane its kind, pin, place and sheet;
  `swapPanes`), **dropping in a band along an edge splits as before**; the
  bands are a fixed depth (120px across, 80px high, never over 30% of a
  small pane) so a wide pane's middle stays and a pointer near a corner goes
  to the nearer edge in band depths (`dropZone`). **The drop box names what
  the drop does** on a chip ("Swap with My Notes," "Left of My Notes," and so
  on; a swap covers the whole pane with a solid border, a split half of it
  dashed); a refused split says why ("No room here (needs a taller
  window)"), and a swap is never refused, since each pane lands in a slot
  that already fit. **The pane's name menu has Move left, right, up, and
  down** under a hairline, offered only where a pane is beside this one, each
  a swap with that pane (`neighborIn`); the menu's label is now "This pane."
  The screen reader hears "<Kind> swapped with <Kind>." or "<Kind> moved."
  After an Opus review (same day): a zone **holds 8px past its own edge**
  while the pointer stays over the same pane (`dropZone`'s `previous`), so a
  pointer on the line doesn't flip between swap and split; the menu is
  "Pane options" with two groups ("Show in this pane," "Move this pane"), the
  name button says "…show something else here, or move it," and the Layout
  window's note names the Move items; Move picks only a pane touching this
  one; a drop is planned again from the layout at release.
  The five ideas left open were settled **2026-11-04 (BVJ)**: **9 built**, a
  label beside the pointer ("Drop on another pane to move this one") while a
  dragged pane is over a line, the gutter, or itself, and "<Kind> not moved."
  for a screen reader when a drop lands nowhere or has no room; **7 built in
  its cheap form**, a hover tooltip on the header ("Drag to move this pane",
  with two or more panes; the grip icon and grab cursor were already there);
  **8 left as it is** (a swap keeps each slot's size, a split halves the
  target); **4 and 5 skipped** (a live preview would rebuild the panes at
  every pointer move, which resets their scrolling, and the Layout menu's 12
  arrangements cover the shapes a desk-edge drop would make).

- **E26, glyph: the leading LIT pane's "Leading" pill becomes a flag.** BVJ
  (2026-11-02), as the lock replaced "Stay here" in E21. Status: **done**, in
  E25's change (the same pane header). The flag shows on the active LIT pane
  while two or more are open, as the pill did; its name for a screen reader
  and its hover text are unchanged ("Leading" and "Leading: My Notes, This
  verse, Greek, and Footnotes follow this pane"), and the desk tour's
  step now says the pane is "marked with a flag." (`desk-first-use.mjs`).

- **E27, wish: Duplicate sheet.** Raised by Audit 2 (DK Qs, owner decision
  12: "is Duplicate sheet planned?"); **BVJ wants it built** (2026-11-04). A
  sheet to reuse as the base of the next one, such as last Lent's study, was
  a copy-by-hand job. **Built 2026-11-04:** "Duplicate" beside "Delete" on each
  row of My sheets (`duplicateSheet`, `desk-sheets.mjs`, pure and tested;
  `duplicate` in `desk/sheet-pane.js`). The copy is a new sheet with the same
  parts under fresh ids and the title "<title> (copy)" ("Untitled sheet
  (copy)" for an untitled one; cut to the 200-character limit, still ending in
  "(copy)"); labels, a passage's `verseCopy` and any field or part this code
  doesn't know are kept, so the copy is still checked against the wording it
  was made on. It is read from the store at the click, not from the list, and
  the new sheet opens with its title focused. A sheet of a newer sheet format
  gets a disabled button, as it can't be changed here either. No field, kind
  or format change, so nothing for the apps. **BVJ looked, 2026-11-04:** the
  button's place beside Delete and the "(copy)" wording are right, and an
  untitled sheet copies. The button is in the Sheet pane's My sheets list
  only: **/sheets stays read-only** (its list has no Delete either, and the
  page never writes a record), which BVJ accepted. The look turned up a bug
  that wasn't Duplicate's: with a Sheet pane open /desk's panes box grew a
  scrollbar of its own showing empty space under the panes, because the
  sheet's hidden hints (`.sr-only`, absolute) escaped its scroller (the Greek
  pane's trap, #354); fixed in PR #465, with every pane's body positioned as
  a guard. Status: **looked at; done.**

- **E28, wish: bookmarks on /desk.** BVJ (2026-11-04), raised while deciding
  how a follow pauses (E9). Today /desk follows nothing: its panes don't report
  the reader's place, its LIT pane draws no bookmark marks (BVJ's choice, 3g), and
  /desk counts as a page outside the book, so a follow pauses there. To settle, as
  its own session in Phase 5: should reading in a LIT pane move a following
  bookmark and show its resting outline; should the LIT pane draw bookmarks at
  all (red, gold, outline); how a bookmark's "Move it here" works with several
  LIT panes (the active one?); and what Paused means while a desk is open.
  **BVJ added (2026-11-05, E41):** the bookmarks' colors didn't carry over to
  the desk, and they should; and the moving bookmark should work there too. It
  could still be updated from My Notes, which is where it is reached, even if
  the LIT pane doesn't show it, and it would change This verse as well.
  **BVJ's decisions (2026-11-06):** (1) the colors carry over to the bookmark
  rows of My Notes and This verse, red for one that moves and gold for one that
  stays put, as Chapter View draws them, and the LIT pane still draws no marks
  beside its text (3g stands); (2) reading in the leading LIT pane moves a
  following bookmark by a chapter page's rules, and other LIT panes never do;
  (3) "Move it here" on /desk means the leading LIT pane's place; (4) /desk no
  longer counts as outside the book: reading on moves the bookmark, a far jump
  or another book (scrolled into, as Matthew 28 to Mark 1, or reached by a link,
  the picker, a search result or a My Notes row) pauses it with "Move it here",
  and the 12-hour rule and the tab's end are unchanged; (5) a change of which
  LIT pane is leading pauses the follow too; (6) the pause message sits outside
  the panes, one bar for the desk.
  Status: **built 2026-11-06** (branch `claude/desk-phase5-e28`, awaiting
  BVJ's look). What was built:
  1. **Row colors**: a bookmark row's state line starts with the bookmark glyph
     in the margin's colors (`bookmarkLook` in `bookmark-follow.js`, which
     `bookmark-mark.js`'s `markLook` now reads too; `.desk-bookmark-glyph--moves`,
     `--stays`, `--resting` in `desk.css`, the same in both themes). It is
     `drawBookmarkLine`, so My Notes (Notebook and pane), the notebook page and
     This verse (`tab-verse.js`, whose fixed red glyph and "Bookmarked" it
     replaces) all show it. My Notes, This verse and `lit-records.js` (the verse
     numbers' names) leave `bookmarkMove` writes out and catch up once the
     reading pauses (`redrawAfterMove`; `desk-panes.js`, `lit-records.js`).
  2. **The follower on /desk**: `desk-page.js` runs `initBookmarkFollow` with
     `page: DESK_PAGE` and `place` (the leading LIT pane's place now), and
     after every `commit` tells it what changed: the leading pane's place
     (`hear`) or a new leading pane (`lead`). So scrolling, the picker,
     `showPassage` and `goToRecord` all report, and a far jump pauses at once.
     Nothing is reported at load (the panes' opening place isn't reading, and
     a chapter alone would mean verse 1) or while the tour runs
     (`layoutFrozen`). `lit:last-read` isn't heard there, nor a restore.
     `positionOnPage` takes any book on `DESK_PAGE`, and `followStep`'s
     `newLead` pauses (`desk-bookmarks.mjs`). `desk-gate.js` no longer pauses
     the flag on /desk. `followsHere()` is now true there, so "Start
     following" shows on /desk's rows.
  3. **The bar** is the ordinary undo bar (`showPausedBar`): fixed at the
     bottom of the window, outside the panes, announced, never taking focus,
     closing after ten seconds, in the theme's tokens. It is shown once per
     pause, so a second change of leading pane while still paused shows no new
     bar; the row's "Move it here" still moves it to the new leading pane.
  4. **A moving bookmark's row clicked in My Notes on /desk**: the row's link
     moves the leading LIT pane to the bookmark first (`goTo`), then the follow
     starts with no link (`followBookmark(r, null)` when the row is handled in
     place, `tab-mine.js`), which forgets that jump's report; reading on from
     the bookmark then moves it. With the link's address the follower would
     have taken /desk as left and heard nothing more.
  No record-format change. Tests: `desk-bookmarks.test.js` (the desk page's
  positions, `newLead`), `bookmark-follow.test.js` (two /desk cases),
  `desk-panes-shared.test.js` (`lit-records.js`' filters). **Not checked in a
  browser**: the row glyphs' size and colors in both themes, a follow moving
  and pausing on /desk and where the bar sits, switching the leading pane,
  clicking a moving bookmark's row in My Notes, Matthew 28 to Mark 1 in the
  pane, This verse after a move, and a duplicated /desk tab.

- **E29, bug and rough: with verse numbers off, /desk's LIT pane keeps its
  chapter headings, and its location field says verse 1 the whole time.** BVJ
  (2026-11-05), from /desk in the Reading arrangement (which turns verse
  numbers off, `reading-display.js`, E8). Two parts, probably one cause: the
  pane may be treating a hidden verse number as if the verse weren't there.
  1. **Chapter headings off whenever the numbers are off, on the surfaces
     that run chapters together.** The point (BVJ, 2026-11-05) is a reading
     experience without the separations between verses and chapters, which
     are arbitrary later additions. So on /desk's LIT pane (in Reading, and
     any time its verse numbers are off, `html[data-vn="off"]`, the Display
     tray's verse-numbers switch) the chapter headings go too. Read View
     already does this (`read-mode.css`, "NUMBERS OFF": `.rm-chapter` is
     `display: none` beside `sup.vn`), so the precedent is there. The LIT
     pane's headings are `.desk-lit__heading` (`desk.css`, drawn by
     `lit-pane.js`). **It does not apply to Chapter View's own pages** (BVJ,
     2026-11-05): a chapter page is already separated from the next by being
     its own page, so removing its heading buys no continuity and would only
     confuse; its heading and `h1` stay whatever the numbers setting.
     **Navigation stays** (BVJ, 2026-11-05): the headings are how a reader
     moves between chapters, so what goes is the visual separation, not the
     heading. The rule is that a chapter heading may remain, for navigation's
     sake, wherever it makes no visual break: no visible text, no gap, no
     rule, and the text flows on as one. The default is the visually hidden
     treatment `global.css` gives `sup.vn` (still a heading for a screen
     reader's heading navigation, still a link and a focus stop for the
     keyboard, brought into view only on focus), not `display: none`, which
     removes it (Read View's choice; revisit it by the same rule). Still to
     settle in the session: what, if anything, a sighted mouse reader gets to
     jump by in the LIT pane (the Go to field and the title may already be
     enough), and that the hidden heading adds no height to the flow.
  2. **The location field must still name the verse being read.** It shows
     the book, chapter and verse 1 and never moves while the reader scrolls.
     Wanted: the verse at the reading line (10%, BVJ 2026-11-04), as it is
     with the numbers showing, **even though the markers are not visible**.
     Where to look first: `placeNow()` and `keep()` in `lit-pane.js` find the
     verse by walking the section's `sup.vn` elements and comparing
     `getBoundingClientRect().top` with the reading line. With
     `html[data-vn="off"]` those numbers are 1px absolutely positioned boxes
     (`global.css`, Chapter View's rule) that may all sit at the paragraph's
     top, or have no box where another rule hides them, so none compares as
     "below the line" and the walk ends on the last number, or none counts and
     it falls back to the first (`verse == null` takes the first `sup.vn`).
     **This is a reading of the code, not yet reproduced**; the session starts
     by confirming it. A fix must not rely on a number being painted: take
     each verse's position from its own `[data-verse]` spans, which stay laid
     out. The same walk drives a following bookmark and "Move it here" on
     /desk, and `keep()` holds the reader's place through a redraw (BA51,
     BA54), so check all three with the numbers off.
  Status: **built 2026-11-06** (branch `claude/desk-phase5-e29-e48`, awaiting
  BVJ's look). **The cause, confirmed in a browser:** the hidden `sup.vn`
  boxes took `.desk-pane__body` as their containing block, outside the
  scroller, so they stayed where the text was first drawn and the walk always
  stopped near verse 1 (and `goTo()` landed wrong too, since it measures the
  `sup`). Now `placeNow()` and `keep()` take each verse's position from its
  `[data-verse]` spans (`indexAtLine`, `desk-lit-text.mjs`, tested), and
  `.desk-lit__scroll` is positioned, so hidden markers scroll with the text.
  With the numbers off, the pane's chapter headings are visually hidden as
  `sup.vn` is (still a heading, a link and a focus stop; on focus one shows over
  its chapter's first line, adding no height). Chapter View's pages and Read
  View's `display: none` are untouched; the Display tray's rule 6 says Read View
  could follow the same rule. **The guess above was partly wrong**: a following
  bookmark and "Move it here" don't use this walk on /desk (`followsHere()` is
  false there), so only `placeNow` and `keep` read it. Not checked in a
  browser: the ResizeObserver path (BA54), real wheel scrolling, dark mode.

**BVJ's pass of 2026-11-05** (E30 to E50; one list from BVJ's own use of the
preview, logged together and in the order BVJ gave them. None is started.
Where BVJ asked a question, the answer from the code is in the entry. Where
BVJ was only wondering, the entry says so and nothing here is decided.)

- **E30, rough: the dashed outline around what a tour step points at (the
  highlights step) is unnecessary.** BVJ (2026-11-05). `desk.css` draws it for
  every step ("A dashed outline, so it isn't mistaken for focus", about line
  2954). To settle: whether it goes from the highlights step only or from every
  step, and if every step, what (if anything) still tells a reader which thing
  the card means, since the dashed line was chosen so a pointed-at control
  wouldn't look focused. **BVJ's correction (2026-11-06):** "the highlights
  step" was the logging Claude's phrase, not BVJ's. The trouble was that the
  step wasn't about highlights, yet the highlight buttons had a dashed outline.
  That is **"Open the menu"**: its outline went round the menu's whole My
  Notebook row, the highlight color buttons included. Status: **built
  2026-11-06**: that step now outlines nothing (`marks: []`), and neither do
  the two fallbacks that land on scripture (a verse number, a footnote letter).
  Every other step keeps the outline on its control.

- **E31, wish: a way to find the commands that work in the search bar.**
  BVJ (2026-11-05). Today a reader has to know they exist. Wanted: a link on
  the search bar's tray that opens a popup of them, and/or a line on the
  Notebook's Settings tab, "maybe both"; and the same on the search page
  (/search). The commands are the Study Desk's own (`desk-commands.mjs`) and
  the Greek search commands, which already have a commands window with the menu
  builder (E5, `greek-commands.js`). To settle: whether one window lists both
  kinds, with the Greek ones as a section, or two; and the link's wording. It
  must work without the Greek search on, since the desk commands don't need
  it. The desk's code stays out of the two search UIs (a link there dispatches
  the existing window's event, as the commands already travel). Status:
  **built 2026-11-06, two windows** (BVJ's look the same day). The first build
  put both kinds in one window, the Greek commands window with a "Notebook and
  page commands" section above its builder, and BVJ didn't like them combined.
  So the Greek search commands window is back as it was, Greek only, and the
  notebook and page commands have **a window of their own, "Notebook actions"** (desk
  code, a `float-window.js` window): what `>` in the search box would offer on
  this page (`listCommands` in `desk-commands.mjs`); a row runs its command and
  closes the window, with "More appear when you are reading a chapter." where
  some are hidden. Its three ways in are each a quiet "Notebook actions" link: in the
  tray's footer row, on /search (where the Greek's "Search commands" button is
  again shown only for a Greek search), and on the Notebook's Settings tab. The
  search UIs reach it by a gated dynamic import, never a static one. It was "Commands" for an hour, until BVJ found it too like "Search commands" beside it on /search, then "Notebook commands"; BVJ picked "Notebook actions" over "Notebook prompts", which reads as AI or as reflection questions.

- **E32, wording: the notebook's group in search results should always be
  headed "My notebook".** BVJ (2026-11-05). BVJ had the heading changed from
  "Your notebook" to "Bookmarks" because they thought bookmarks were all it
  held. **What a notebook search finds** (`desk-search.mjs`): a **note** by its
  words, the title of the glossary entry or article it is on, and the footnote
  it hangs on; a **highlight** by the words highlighted; a **bookmark** by its
  name; a **place** by its name (one another client kept); a **pinned
  footnote** by its text; and **any of those by the names of the labels on
  it** (the snippet then reads "Label: …"). Hidden and trashed records never
  show. So the group is more than bookmarks, and it should be headed the same
  whatever it holds, bookmarks included. Today `matchTitle` returns "Bookmark
  labels" when every hit is a bookmark and "Your notebook" otherwise (the
  tray, /search and the Search pane read it; also `search.astro` and the
  strings in `search.js`, `notebook-search.js` and `search-pane.js`). Wanted:
  one heading. BVJ wrote it "MY NOTEBOOK" (the groups' titles are drawn in
  capitals), so the string is "My notebook", lowercase as the names rule
  (desk/CLAUDE.md, rule 10) has it for what the reader has kept. The count
  line can keep naming the kind ("1 bookmark match", `matchNouns`) or follow
  the heading; one call for the session. Remove `matchTitle` with the
  rule's sentence in desk/CLAUDE.md ("The Show menu splits bookmarks…").
  Status: **built 2026-11-06**: `matchTitle` is gone, one
  `NOTEBOOK_GROUP_TITLE` ("My notebook") heads the group in the tray, /search
  and the Search pane, and the count line still names the kind.

- **E33, decision: does Chapter View need a name?** BVJ (2026-11-05), only
  wondering: "I still don't really like 'Chapter View.' Maybe it doesn't need a
  name. It's just the standard way to read on the site." Where confusion needs
  a word, "the scripture pages" or "chapter pages". The /read card still needs a
  heading (the card that points at the chapter-by-chapter way to read), and BVJ
  suggests **"Scripture Pages"** for it. **Not decided; the name was settled
  only three days ago** (E20, BVJ 2026-11-02, "Study View" to "Chapter View"),
  so this wants BVJ's yes before any copy moves. If yes, the work is a copy
  pass: reader-facing text (the /read card and landing, Read View's toolbar
  pill, the tour and help, the Display tray, release-note wording, the verse
  menu's "…in Chapter View" strings, `lit-pane.js`'s "Open in Chapter View"
  hover text), the root CLAUDE.md's "Call them 'Chapter View' and 'Read View'"
  rule, and the docs that use the term. It must also decide what the
  Read View side is called once the other has no name (Read View is removed at
  launch, E8, so the question may mostly disappear then). **Decided (BVJ,
  2026-11-06): drop the name at launch (8c), not before.** While Read View
  lives, "Chapter View" stays, since nearly every mention tells the two apart.
  At 8c the mentions that are left become descriptive: where the desk tells a
  reader where else they could read, plain words and an informal, lowercase
  "scripture page" ("Open John 3 on its scripture page"), not a name. The /read
  card's description carries the difference, so its heading needn't ("Scripture
  Pages" was BVJ's suggestion; the words are settled at 8c). The root CLAUDE.md's
  "Call them 'Chapter View' and 'Read View'" rule goes with Read View. Added to
  8c's list under E8. Status: **decided; done at 8c.**

- **E34, rough: a Search pane result's link to the passage goes to the
  scripture page, not the LIT pane.** BVJ (2026-11-05), from the Search pane on
  /desk. The result offers a link to read the passage, which leaves the desk.
  Wanted: a clear choice of **see it in the LIT pane** or **on a scripture
  page**. To settle: the LIT pane choice moves the leading LIT pane (the flag,
  E26) or opens one when there is none, and says which; two small links or one
  button with a menu; and which is the default for a plain click, since the
  scripture page is what a click does now. Related: E35. Status: **built
  2026-11-06**, awaiting BVJ's look. **A plain click stays on the desk**: it
  moves the leading LIT pane, or opens one, through `showPassage`, and the
  pane's note line says which ("The LIT pane moved to John 7:38.", "A LIT pane
  opened at John 4:10.", or, with no room, a line saying to close a pane or open
  it on its page; `passageMoveMessage`, tested). **A small link beside each
  passage result** (an icon, `awayLink`) opens its page in a new tab. The likely
  culprit was the reference preview's "Open John 3 →", which left the desk in
  the same tab: on /desk it now opens in a new tab (`ref-preview.js`, shared
  code that imports nothing of the desk).

- **E35, wish: a button on the LIT pane that opens the passage on its
  scripture page, at the verse shown.** BVJ (2026-11-05). The chapter headings
  in the LIT pane already do this (their hover text is "Open in Chapter View",
  `lit-pane.js`), "but it's not obvious". Wanted: an explicit button in the
  pane, opening the page at **whatever verse the location field shows**
  (`#vN`), with the headings staying links. The location field names the verse
  at the reading line (see E29 for the numbers-off bug). Mind the new-tab rule
  (a link that leaves the desk opens apart so the layout isn't lost) and the
  name in E33. Touches `lit-pane.js`, so run beside no other `lit-pane.js` work
  (E28, E29). Status: **built 2026-11-06**, awaiting BVJ's look: an icon link
  after the passage bar's next-chapter arrow (`OPEN_PAGE_ICON`, a box with an
  arrow leaving it), "Open on its page" as hover text and "Open John 3:26 on
  its page, in a new tab" as its name, following the location field as the
  pane scrolls. The chapter headings, which opened in the same tab against the
  desk's rule, now open in a new tab too; their hover text is unchanged.

- **E36, wording: "Copy for Word" becomes "Copy".** BVJ (2026-11-05): "Copy to
  Word" is "unnecessarily specific". Candidates: "Copy to clipboard", or "Copy"
  with the copy glyph. (S9: the button copies the copy on screen as formatted
  text and plain text, which pastes into Word, Docs or Mail alike.) Lives in
  `sheet-page.js` (the button and its failure line, "Choose Copy for Word
  again."), `sheet-word.js`'s header and desk/CLAUDE.md, which also names it; grep
  "Copy for Word" for any help or tour wording. The file name `sheet-word.js`
  can stay. The names rule (desk/CLAUDE.md,
  rule 10) says "copy" in a button means a saved file, which is why a sheet's
  two forms are "versions"; "Copy" for the clipboard is that rule's own other
  half, but check that the word doesn't now collide with "Save as a file"
  beside it. Status: **built 2026-11-06**: "Copy" with the copy glyph (the
  glossary's two sheets), named "Copy this version to the clipboard", and the
  failure line "Choose Copy again." "Save as a file" doesn't collide. **One
  for BVJ:** a shared sheet's banner button "Copy into my notebook" now sits
  near the clipboard "Copy" with "copy" meaning a saved record. **BVJ
  (2026-11-06): "Import into my notebook"**, so the clipboard "Copy" is the only
  copy on the page; the banner's line and its failure and no-storage lines say
  "import" to match (`sharedBanner`, `sheet-page.js`). Status: **done 2026-11-06.**

- **E37, wish: more file types under a sheet's "Save as a file".** BVJ
  (2026-11-05): the share menu's save-as-file should offer a document as
  **PDF, ODT, DOCX or RTF**, and a presentation as **PPTX, ODP or PDF**. Today
  "Save as a file" (`sheet-page.js`) writes the sheet's own shareable file,
  which another Study Desk opens ("Open a shared file"); it is not a document.
  So the menu would hold two different things, **a copy to share with another
  desk** (what it does now) and **a document to open elsewhere**, and the words
  must keep them apart. Notes for the session: the site has no server, so
  every format is made in the browser, loaded only with the desk (a dynamic
  import behind `data-desk="on"`, like the rest of the desk, and nothing in a
  reader's bundle). ODT, DOCX and PPTX/ODP are zip files of XML; RTF is text;
  PDF can be the browser's own print to PDF (already there) or drawn. The
  presentation forms are present mode's slides (`desk-present.mjs`), the
  document forms the leader's or participant's copy (`desk-sheet-copy.mjs`).
  Fonts, the QR code, the sheet's tables and the license notice
  (`LIT_CREDIT_LINE` must travel into every file, as it does into print) are the
  hard parts, and size and any new dependency need BVJ's eye (a library is
  weight and a license to carry). Design first (Opus), and a mock of the menu.
  **BVJ's decisions (2026-11-06), from the design:** (1) a **"Save as ▾"** menu
  on the sheet page's toolbar, after Copy and before Share…, following the
  Version choice; phase A holds its "A document" group only (Word document
  (.docx), OpenDocument text (.odt), Rich text (.rtf), PDF…), and **phase B** adds
  "A presentation" (slides) to the same menu. (2) The Share dialog's "Save as a
  file" becomes **"Export a Study Desk file"**, with the hint "To open the sheet
  in Word or another program, use Save as."; its behavior is unchanged. (3) PDF
  is the browser's own Print of the version on screen, telling the reader to
  choose "Save as PDF"; no PDF library. (4) Fonts are named, not embedded
  (Crimson Text, falling back to Georgia; Greek and Hebrew in Cardo). No new
  dependency: the zip is hand-written (CompressionStream "deflate-raw" and a
  CRC-32). With it, **"Open a shared file" became "Import a shared file"**
  (BVJ, 2026-11-06), pairing with Export and the banner's "Import into my
  notebook". **BVJ, later the same day, from a look at it:** the button is
  **"Import a Study Desk file"**; the share file is called **"a Study Desk
  file (.md)"** wherever it is mentioned (the Export button reads "Export a
  Study Desk file (.md)"); and the Share dialog's note adds "For a PDF, choose
  Print, then “Save as PDF” in the print window", beside Save as's own "PDF…"
  line, so a reader who wants a PDF now finds it from either place.
  **Phase A built 2026-11-06** (`claude/desk-phase5-e28`). Copy and the files
  read the copy on screen into **one model** (`readCopy`, `desk/sheet-word.js`;
  the model and Copy's HTML and text writers in `src/lib/desk-sheet-doc.mjs`),
  so they can't disagree; Copy is now that model's HTML writer, held
  byte-identical to the old code by `test/fixtures/sheet-copy-golden.json` (and
  checked so on all 260 chapters before the old walk went). The writers are
  `desk-doc-docx.mjs`, `desk-doc-odt.mjs` and `desk-doc-rtf.mjs` over
  `desk-zip.mjs`, each pure and loaded by a dynamic import only when chosen
  (`desk/sheet-save.js`, which also draws the menu and the codes as PNGs from
  `qrSvg`, left out when codes are off). Every file ends with
  `LIT_CREDIT_LINE` as its last paragraph and carries it in its properties.
  Files are named "Romans 8 study (leader).docx". `test/desk-sheet-doc.test.js`
  unzips each file independently and reads every XML part strictly. LibreOffice
  (headless, 2026-11-06) turned a .docx, an .odt and an .rtf of the test sheet
  into PDFs that matched the paper copy: headings, lists restarting, raised
  verse numbers, the footnote, blanks, Greek, Hebrew right to left, ruled
  lines, links, the code and the credit line last. **Departures from the
  design:** the credit goes in the description and a custom "Rights" property,
  since neither format's core properties has `dc:rights`; a blank is
  underlined no-break spaces, as Copy writes it, not a tab; a code is an
  inline picture on its own right-aligned line with its caption, not floated.
  **Not checked:** the menu in a browser, and the files opened in Word, Google
  Docs and Pages. **Open for phase B:** blanks on slides (covered, or shown),
  speaker notes (the Leader only parts?), footnotes on slides, and where the
  credit line goes on slides. Status: **phase A built, awaiting BVJ's look;
  phase B open.**

- **E38, question, answered: can a reader search their labels, and is having
  labels going to get cumbersome? How hard would syncing them to the app be?**
  BVJ (2026-11-05). **Searching: yes, already.** A notebook search matches the
  names of the labels on a record as well as its words (`desk-search.mjs`), and
  says so in the snippet ("Label: Advent"); the label itself is not a result,
  and there is no "show only this label" in the tray. The notebook page sorts
  by label. **Cumbersome:** not measured; the cost is the reader's upkeep (a
  label is something to apply, name and prune), and nothing makes a reader
  use them. Ideas if it is felt: a "show only this label" choice in the
  tray's results (the Show menu already filters by kind), and offering to apply
  a label as a note is saved. **Syncing:** the records carry a `labels` field
  of label ids (STUDY-DESK-FORMAT.md), which the apps keep untouched. The
  **label records themselves** (id and name) are a website-only kind, in the
  separate zone the apps never open (the format's sync section), so the apps
  would carry the ids and show no names. For the website this is no work. For
  the apps it would take BDR choosing to read the `label` kind (a name per id,
  unique ignoring case and accents, as the website keeps them) and to apply
  and show them; that is app work and a format decision (the zone is meant to
  stay generic), not a website change. Raise it with BDR if BVJ wants labels in
  the apps. **BVJ (2026-11-06): ask, and leave it entirely to BDR** whether the
  apps use them. Asked the same day in a note for BDR's Claude at the top of
  "Accounts and sync" in `STUDY-DESK.md`. Status: **answered; asked BDR.**

- **E39, wording and design: the verse menu and selection panel's "Share…" and
  "Make an image".** BVJ (2026-11-05), asking for thoughts. Proposed: "Share…"
  becomes **"Share link"** and "Make an image" becomes **"Share image"**; and
  BVJ wonders about flyouts: **Copy ▸ text / link / with footnotes** and
  **Share ▸ link / image.** Thoughts, for the session: (1) "Share…" is the
  phone's share sheet, and what it sends is the words and the link, so "Share
  link" understates it; "Share" with the ellipsis, or "Share text and link",
  may be truer, which is why this isn't just a rename. "Share image" is right
  (it hands the image on, to the share sheet or a download). (2) These are
  shared reader code for everyone (`panel-pieces.js`, `chapter-tools.js`), with
  names fixed by the 2026-09-29 decision that both panels offer the same
  actions under the same names and kept short so the three copies fit a phone
  row; "Share link" is longer, so check the chips at 360px. (3) **A Copy flyout
  was BVJ's own idea on 2026-11-04, and Claude recommended against it for now,
  with the door left open to revisit it if more reason came** (Copy is the most
  used item and shared code every reader uses, so it stayed flat; only the
  desk's Bookmark flyout was built, `flyoutRow` in `actions.js`, which is
  desk-only). **BVJ (2026-11-05): today's other ideas for this menu (Share
  link and Share image, and E40's Print) make it more compelling, so it is
  being revisited.** What stays true: a flyout here means moving that
  component into shared code and adds a step to the most used actions on a
  computer; on a phone the chips rows are not flyouts at all and stay as they
  are. What changed: with Share and Print also grouped, and Bookmark already a
  flyout, a flat Copy would be the odd one out of the grouped menu. Claude's
  lean now: do it, and soften the extra step by making the row itself the
  default (pressing "Copy" copies the text, as the top item does now) with the
  flyout, opened by hover, the right arrow or a chevron, holding the others,
  so the common press stays one step. Mock first (the phone rig), for the
  menu and the selection panel both. **BVJ (2026-11-06), from the mock: build
  it**, for every reader: "Share text…" (it sends the words, the link an
  addendum, as "Copy text" copies them) and "Share image"; the mock's pale
  explanatory lines were notes for BVJ, not site copy. **Built (2026-11-06).**
  Shared reader code (`panel-pieces.js` family, `chapter-tools.js`): on a
  mouse or the keyboard, the three copy buttons are one split row "Copy text"
  (a press copies the text; the chevron "More ways to copy", hover or → open a
  flyout of Copy text, Copy link, Copy with footnotes), and "Share…" with "Make
  an image" are one row "Share" (a flyout of "Share text…", where there is a
  share sheet, and "Share image"; choosing the image closes the flyout and the
  questions take the row's place; no share sheet leaves a flat "Share image").
  The new names hold everywhere, chips included. A finger's chips stay flat.
  No hint text added. `flyoutRow` moved from `desk/actions.js` to
  `src/scripts/panel-flyout.js`, its CSS from `desk.css` (`.desk-bookmark-fly*`)
  to `global.css` (`.lit-flyout*`). Measured from the fonts' advance widths: at
  360px "Share text…" and "Share image" fit one chip row in Inter, Atkinson and
  OpenDyslexic (`src/scripts/CLAUDE.md` has the numbers). Status: **built.**

- **E40, wish: a Print line in the verse menu and selection panel, with a
  flyout: Selection / With my notes / With room to write.** BVJ (2026-11-05),
  asking whether the print commands on the Notebook's Settings tab can be
  reused. They can: the Print menu is one piece of code for /desk and the
  Notebook (`desk/print-menu.js`, E16), with the notes version
  (`print-notes.js`) and room to write (`print-room.js`, N9), so the row would
  call them for the verse or selection instead of a chapter. "Selection" (the
  plain text of just those verses) is new: the site prints a whole page today.
  It is a desk row ("My Notebook" rows, `actions.js`), so readers without the
  desk see no change, and it is the desk's flyout (`flyoutRow`). Share the
  menu's settings with E39 so the two flyouts are made once. **BVJ
  (2026-11-06): build it**, labeled "This verse" ("These verses" for a range)
  or "This selection", each plain, with my notes, and with room to write; a
  selection prints only the selection. **Built (2026-11-06).** "Print ▸" after
  Bookmark in the My Notebook rows, as in rule 19 of desk/CLAUDE.md. It prints
  only those verses (numbers, cited footnotes, credit and notice) or the
  selected words as a passage. Not offered in /desk's LIT pane or the
  glossary. "With my notes" stands down with "Hide my marks". Print preview
  can't be emulated in the Browser pane; the pure parts are tested
  (`test/desk-print-part.test.js`). Status: **built; needs a real print preview
  in Chrome (and Firefox) for a verse, a range across a poetry block, a
  selection, each of the three kinds.**

- **E41, bug and wish: bookmark colors, and moving bookmarks, on the desk.**
  BVJ (2026-11-05): "It doesn't look like the colors of the bookmarks
  transferred to the desk. They should." and the moving bookmark should work
  there, updating from My Notes (where it is reached) even if the LIT pane
  doesn't show it, which would also change This verse. **Folded into E28**,
  which is the same question (the LIT pane draws no bookmark marks, BVJ's 3g
  choice, so there is nothing to color), now with BVJ's answer to its first
  question leaning to yes. Status: **moved to E28**, built with it 2026-11-06.

- **E42, glyph: the note marker called "ribbon" should look like a ribbon.**
  BVJ (2026-11-05), thinking of 🎗️ (the awareness ribbon, a loop with two
  tails). Today the marker's drawing (`glyphs.js`, `ribbon`) is a flag-shaped
  bookmark, the same as the bookmark glyph (`PATHS.bookmark = PATHS.ribbon`,
  which is why the two are confusable). Only the drawing changes: the marker's
  stored name stays `ribbon` and its display name "Ribbon", so no record and
  no format. If the bookmark keeps today's shape the ribbon stops sharing
  `PATHS`. Check it at the marker's smallest size in the margin and on the
  menu's chips, and in dark mode. Status: **built 2026-11-06**, awaiting BVJ's
  look: one stroked path (a loop with two crossed tails, the brand green, 3.6
  wide, round caps) in the same 24 box; the bookmark keeps its flag as its own
  path (`test/desk-glyphs.test.js` holds them apart). A stroke, where the other
  markers are fills, since a filled loop needs two subpaths. Rendered at 14, 18
  and 24px: a ribbon from 18px up; at 14px, the margin's smallest, the loop's
  hole is about a pixel. Not checked in dark mode in a browser.

- **E43, wish: a full-screen button on the desk.** BVJ (2026-11-05): F11 does
  it, but a button would be more reachable. Places weighed: the Display
  settings (obvious, not accessible enough), **a line in the Study Desk title
  menu** (BVJ's lean: "one of the lines in the dropdown"), or both. Notes: the
  button calls the Fullscreen API on the desk's root (`requestFullscreen`; the
  page needs a user gesture, and Escape leaves it). **F11 is not the same
  thing**: it is the browser's own full screen, `document.fullscreenElement`
  stays null under it, so the button can't show "on" for an F11 reader and
  mustn't try to leave a mode it didn't enter; the line can be "Full screen
  (F11)" while off and "Exit full screen" only when the API entered it. The
  desk is a computer tool (website study tools are desktop-only), so a
  browser without the API just gets no line. **Precedent:** present mode for
  sheets already has a full-screen toggle (`sheet-present.js`: the same API,
  a `fullscreenchange` listener, and a line telling the reader to use the
  browser's own command when it refuses), so the desk's wording and handling
  can share it. **To settle** (explored with BVJ, 2026-11-05):
  1. *The goal.* Full screen only reclaims the browser's tabs and address
     bar. If BVJ also wants more room for the panes, a focus mode that hides
     the site header too is a second option, in the same menu line or the same
     button.
  2. *Escape.* The desk uses Escape to close menus, the Notebook and floating
     windows, and in API full screen the browser also treats Escape as "leave
     full screen". **Not tested**: whether one press closes a menu and also
     exits full screen. Test this first, in Chrome, Firefox and Safari; if it
     misbehaves, the desk's Escape handlers or the button's design change.
  3. *No remembered choice.* Browsers refuse to start full screen on page
     load, so "open the desk in full screen" can't be a saved preference; each
     visit needs a click.
  4. *Cheapest version.* One title-menu line, "Full screen (F11)", that
     presses the real API; for a reader already in F11 it is harmless.
  5. *A shortcut* (a single key such as `f`) would sit under the Keyboard
     switch with the others and stand down in text fields. Optional.
  Claude's lean: the title-menu line, with a Display-settings mention that
  points to it rather than duplicating it; settle 2 before building.
  **Decided (BVJ, 2026-11-06): browser full screen only** (1), the cheapest
  version (4): no focus mode hiding the site header. On Escape (2): in full
  screen the browser keeps the first press for itself and the page never sees
  it, so with a menu open the first press leaves full screen and the second
  closes the menu. Nothing is lost or skipped, so it is accepted as is, not
  worked around (Chrome's keyboard lock would make Escape hold-to-exit, which
  is worse); confirm it in a browser once built. **Built (2026-11-06)**: a
  "Full screen (F11)" line ("⌃⌘F" on a Mac) after Display options in the
  title menu (`desk-page.js`), "Exit full screen" while the API's full screen
  is on, absent without the API, a refusal announced. The Browser pane holds
  the request without answering, so neither full screen nor the Escape
  behavior could be seen there. Status: **built; needs a look in Chrome
  (and Firefox): full screen on and off, and Escape with a menu open.**

- **E44, wish: "Start following" where "Stop following" appears.** BVJ
  (2026-11-05): when a moving bookmark isn't following, the same spot (the
  quiet link under the row's state line, and the verse menu's button beside
  "Edit bookmark…", `bookmark-stop.js`) should offer "Start following". Or
  a toggle, **Following: On / Off.** Today starting a follow means opening the
  bookmark from the list, which BVJ finds hidden. Claude's lean: **the link
  that swaps its own label** ("Stop following" / "Start following"), shown only
  for a bookmark with "Move as I read" on. A "Following: On/Off" toggle reads
  as a setting that stays, but a follow is this tab's, ends when the book is
  left or a tab closes, and is a different thing from the "Move as I read"
  switch, which is the record's; two on/off controls on one row would be
  confused. Starting follows the same rule as opening from the list
  (`followBookmark`: the six-bookmark limit, one tab at a time, the flag in
  `sessionStorage`). The desk copy that describes it needs E48. Status:
  **built 2026-11-06** on Claude's lean, awaiting BVJ's look: the row's quiet
  link reads "Stop following" or "Start following" for any bookmark with "Move
  as I read" on, and the verse menu offers "Start following" beside "Edit
  bookmark…" for a moving bookmark this tab isn't following. Start shows only
  where the page can follow (not /desk or /notebook), and neither moves the
  bookmark nor navigates: the next report decides, reading on from it moves it
  and reading elsewhere pauses it with "Move it here". Starting forgets what the
  last follow heard, or a far bookmark started in place would jump to the
  reader (tested). The resting bookmark's "Leave it here" (BVJ's word,
  2026-11-04) stays as it is.

- **E45, rough: a moving bookmark takes too long to move.** BVJ (2026-11-05).
  Two waits stack: the follower writes at most once every
  `MOVE_EVERY_MS` (4 seconds, `desk-bookmarks.mjs`) and the margin's mark then
  waits for the reading to pause for `MOVE_SETTLE_MS` (5 seconds,
  `move-redraw.js`), so the mark can lag nine seconds behind the reader. The
  settle was chosen so a mark doesn't jump while someone is scrolling, and the
  write gap so the notebook isn't written, and synced, on every scroll. To
  settle: shorter numbers for each (candidates to try: 2 s and 2 s), whether
  the mark redraws on its own clock while the page is still, and the sync side:
  a move is a record write, so a shorter gap raises writes, and BDR's side
  should be told if the gap changes.
  Status: **built 2026-11-06**, awaiting BVJ's feel of it: the write gap is 2
  seconds and the settle 2.5 (not 2: a settle no longer than the gap would let
  steady scrolling redraw between writes, and the mark would glide again), so
  the mark lags at most about 4.5 seconds. No redraw clock of its own. **For
  BDR:** a follow can now write a move every 2 seconds instead of 4;
  STUDY-DESK-FORMAT.md states the new rate.

- **E46, wish: change which verse a bookmark belongs to, in its dialog.**
  BVJ (2026-11-05). Today the form (`bookmark-form.js`) edits the name and
  the "Move as I read" switch only; moving a bookmark means making a new one.
  Wanted: a verse choice (book, chapter, verse, as the Go to passage field
  takes them). Rules it must keep: **a verse holds one bookmark that stays put
  and one that moves** (`planBookmark`), so a target that already holds one of
  its kind is refused with a line saying which; the write is one
  `store.change` (`planBookmarkEdit`, BA102) and an ordinary undoable edit; a
  following or paused bookmark's resting place changes with it; and the
  record's anchor (its verse and the text it was made on) is rebuilt for the
  new verse, as a new bookmark's would be. Status: **built 2026-11-06**,
  awaiting BVJ's look: a Verse field read by the passage field's
  `parseReference` (a range keeps its first verse; a chapter alone is verse 1;
  "Romans 8 has 39 verses." past the end), sent only if the reader changed it,
  so a move the follower made meanwhile stands. One `planBookmarkEdit` change,
  undoable; refused with "John 3:5 already has a bookmark that stays put." and
  the like; `verse`, `endVerse` and `contentVersion` written as for a new
  bookmark, everything else kept; a followed bookmark's resting place moves
  with it. `planBookmarkEdit` now leaves the bookmark this tab follows out of
  the verse check, as the dialog's lock already did. No format change.

- **E47, wish: "Start following now?" in the dialog.** BVJ (2026-11-05): when
  "Move as I read" is checked in the Bookmark dialog, a second option appears,
  "Start following now?". It is the dialog's version of E44 and starts the same
  follow (and shows at all only if this tab isn't already following it and the
  six-bookmark limit isn't reached; otherwise a line says why). Checked on a
  new bookmark made from the verse menu, it makes the first Bookmark press
  start following at once. Status: **built 2026-11-06**, awaiting BVJ's look:
  shown while "Move as I read" is checked; where the tab can't start it, a line
  says why (already following this one, a page that can't follow, six others
  already moving). Checked at Save, the bookmark is saved and then followed,
  even with nothing else changed.

- **E48, wording: the Move as I read blurb.** BVJ (2026-11-05): the copy
  "needs work": "Open this bookmark from your list, and it follows you through
  the book. Off, it stays put on its verse. Up to 6 bookmarks can move."
  (In `bookmark-form.js`.) The trouble is that it explains how a follow starts
  by opening the bookmark from the list, which E44 and E47 give another way
  to do, and "Off," is a fragment. **Write it after E44 and E47 are decided.**
  A starting draft, for BVJ to react to: "Moves along with you as you read this
  book. Off, it stays on its verse. Up to six can move at once." Status:
  **done 2026-11-06**, BVJ approved: "Moves along with you as you read
  its book, once it’s following you. Without this, it stays on its verse. Up to
  six of your bookmarks can move." The "Moves" row's hover text is now "Moves as
  I read, once it’s following me." /privacy's line for `lit-desk-follow` said
  "which bookmark you followed from your list", which E44 and E47 made
  incomplete; it now names every way a follow starts, and that it ends when
  stopped, when the tab closes, or after 12 hours away from the book (BVJ: "however
  is most appropriate"). The key and what it holds are unchanged, so the
  effective date stays.

- **E49, rough: the footnote's pin and add-note pills.** BVJ (2026-11-05): on
  the scripture pages the two pills (Pin, from `pins.js`, and Add a note, M11,
  `footnote-notes.js`) are **not vertically aligned** with each other and **sit
  awkwardly** with the footnote. Wanted: move them into the **margin, stacked,
  probably the left one** (the right holds the Notebook panel and the margin
  notes); and where the window is too narrow for a margin to hold them, **one
  stacked triple-dot menu that expands**. Notes: the controls must stay
  keyboard and screen-reader reachable in reading order (a menu button per
  footnote is one more tab stop; check it against the footnote popover's own
  Pin button, which stays), still follow the "Notes in the margin" switch,
  and never add text to the scripture page. The left margin is empty at most
  widths but not all, so the narrow rule needs a measure, as the notes' margin
  (`desk-margin.mjs`) has. Mock first, at the real widths. **Mocked
  (2026-11-06, John 3's footnote list at 1366 and 820px):** stacked, the
  two-pill column (about 45px) is taller than a one-line footnote, so note a's
  "+ Note" ran into note b's Pin unless each footnote grew to the stack's
  height (about half a line more under every one-line note); side by side, the
  two pills in one row left of the letter, level with the first line, nothing
  overlaps, no footnote grows, and the pills share a baseline (the
  misalignment that started this); about 90px of margin, which John 3 has from
  about an 820px window up. Where the margin can't hold them, one "⋯" pill per
  footnote opens the two stacked under it (one tab stop per footnote, as
  today). **Decided (BVJ, 2026-11-06): side by side in the left margin**, with
  the "⋯" fallback where it doesn't fit; the popover's own Pin and "+ Note"
  row stays as it is.
  Status: **built 2026-11-06.** `src/lib/desk-footnote-pills.mjs`
  (`footnotePillMode({ free, row, stack })`,
  `test/desk-footnote-pills.test.js`) picks `row`, `more` or `inline` from the
  list's left margin; `desk/footnote-pills.js` builds each footnote's
  `.desk-fn-pills` (a "⋯" button named "Actions for footnote a", and the group
  holding Pin and "+ Note"), measures on load and resize, and sets
  `data-desk-fn-pills` on the list; `desk.css` draws the three. Side by side,
  the pills are 14px left of the footnote, centered on its first line (22px
  pills in a 1.6 line, plus the Display tray's extra leading), so they share a
  center line and no footnote grows. Thresholds in Inter: `row` from about
  118px of free margin, `more` from about 78px, `inline` below (measured from
  the real pill widths, so a wider face asks for more). One departure from the
  rough note: the notes' margin is also on the LEFT (not the right, which holds
  only the Notebook panel), level with the footnote, so a footnote with a
  margin note drawn beside it keeps the in-line placement
  (`data-desk-fn-margin`, set by `notes-margin.js`). Checked in the Browser
  pane on John 3: side by side at 1366px, the "⋯" at 760px (it opens the two
  stacked, Tab reaches Pin, Escape closes it and returns focus), in-line at
  600px.

- **E50, rough: the Study Desk button, where it is and where it shows.**
  BVJ (2026-11-05), "not totally satisfied with the current version." The
  idea: the button only on the pages that are ways into the desk, **scripture
  pages (chapters and chapter intros), home and /read.** On those, either (a)
  everything stays as now (the header link), (b) home stays as now, scripture
  pages put it **where the old "Switch to Read View" pill sat**, and on /read it
  takes that design and sits **beside the verse picker, the two centered
  together on one row**, or (c) a better third. This would change rule 10's
  "the header's Notebook buttons are links to /desk on every page" (BVJ,
  2026-10-30), so that rule and the header's `data-desk-toggle` wiring move
  with it. It also meets 8b (the Read View button and the /read card become
  ways into /desk, and E33's card heading) and the chapter-carrying link
  (8a). To do it: mock the three at the real widths (the toolbar has a fixed
  floor, and the desk is a computer tool, so the phone toolbar rules don't
  apply), then decide. **Mocked (2026-11-06)**, (b) at 1366px on John 3 and
  /read: on a chapter, "Open in the Study Desk" ("Study Desk" where the
  toolbar is tight, as the old pill shortened) fills the toolbar's right end,
  empty since the preview hid "Switch to Read View", and links to /desk at that
  chapter; on /read a "Study Desk" pill matching "Go to passage ▾" sits beside
  it, the two centered on one row; the header's floating link goes from both.
  (c) was offered too: "Study Desk" in the header's own nav row on every page.
  **Decided (BVJ, 2026-11-06): (b).** Home keeps the header link; scripture
  pages (chapters and intros; an intro has no right-hand toolbar slot today, so
  it gets one) and /read take the toolbar pill; every other page has no Study
  Desk button. Rule 10's "links to /desk on every page" changes with it.
  Status: **decided, to build.**

- **E51, rough: the Share this sheet dialog needs a close × in its corner, and
  its "Close" button should say "Cancel".** BVJ (2026-11-06), on /sheets.
  Status: **done 2026-11-06**: the shared panels' round × (`lit-panel__close`,
  named "Close") in the dialog's top right corner, and "Cancel" in the button
  row; both close it (`openShareDialog`, `sheet-page.js`).

- **E53, gap: no way to read a book's introduction on /desk.** BVJ
  (2026-11-06), noticed while weighing E50. The LIT pane shows chapters only:
  its passage field takes "John 3", its arrows step chapter to chapter, and an
  intro found in the Search pane opens in a new tab (rule 13). So a reader at
  the desk who wants Romans's introduction beside Romans 1 has to leave the
  desk for it. **To think through with BVJ** (this conversation): where an
  intro shows (the LIT pane itself, as the site's Previous/Next treats it as
  the page before chapter 1, or a pane kind of its own), how a reader asks for
  one (the passage field taking "Romans intro", the arrows stepping back from
  chapter 1, a line in the pane's menu, Search's intro results opening in a
  pane), and what the panes beside it do while it shows (This verse, My Notes,
  the Greek and the Footnotes have no verse to follow in an intro, though an
  intro has footnotes of its own). Status: **open, to discuss.**

- **E52, rough: on /sheets the header's buttons overlap the toolbar.** BVJ
  (2026-11-06), with a screenshot. Over 1100px the header's search, Aa and
  Study Desk buttons float below READ NOW, out of the header's flow, and the
  sheets page left them no room. Status: **done 2026-11-06**: `.sheets-page`
  takes 3.5rem of top padding over 1100px (`sheets-page.css`), as the
  notebook page's own padding does.

**Work sessions** (proposed by Claude, 2026-11-02; a grouping of the open
items above, not a decision. E4 is folded into E9, E10 is done on the
website, E3 is fixed.) `desk-page.js` is touched by E14, E15, E16, E17, E21
and E22, so those sessions run one after another; the Greek search work and
the two small bug fixes touch other files and can run alongside. Phase 3
finished on 2026-11-01, so what a release needs first is E8 and E20 (the
launch work), E9 (it changes what syncs), and the bugs E13, E22 and E23;
the rest is polish.

1. **Two independent bug fixes**: E13 (`SiteHeader.astro`) and E23
   (`scripture-refs.mjs`, reaches every reader). Small.
2. **Glyph and wording pass**: E18, E19, E21. Small. E19's My Notes button
   may be reworked by session 4.
3. **Bookmarks become one feature**: E9 (closing E4 and E10). **Done
   2026-11-02**, in one change: the record and its conversion (format doc,
   merge vectors version 3, a note to BDR's Claude), then the UI and copy.
   BVJ confirmed that a bookmark stays put unless "Move as I read" is on.
   Places is gone from My Notes, so session 4 starts from a My Notes with
   Continue reading above its list and no Places group. Awaiting BVJ's look
   on the judgment calls (2026-11-02 entry).
4. **One notes pane**: E17 with E22. **Done 2026-11-02**: one pane, "My
   Notes" (BVJ's name), with What I've kept's search, kind choice, count,
   chapter headings and labels folded in; the follow fix; saved layouts
   naming `kept` migrate to `mine`. BVJ approved the design on PR #435.
5. **The shared Print menu with a chapter picker**: E16. One piece of code
   for /desk and the Notebook; goes before 6, which opens it. **Done
   2026-11-02**: `desk/print-menu.js`, with the Notebook's two buttons
   folded into one "Print…" that opens it; BVJ approved the design.
6. **The page-title menu and the quick add-pane control**: E15 with E14.
   **Done 2026-11-02**: the title is the menu (Add pane, Layout, Print,
   Display options, the tour, Help), Aa moved into it, and Layout and Print left
   the bar; BVJ picked the design from a mock.
7. **Greek search**: 7a, decide E7 and build E11's small switch (**done
   2026-11-02**: E7 decided and built, #428; E11 built, #427); 7b, the
   E5 builder (mock first), **which also carries what is left open of E7
   and E11** (below) (**done 2026-11-02**: BVJ picked from a mock and took
   every recommendation; the builder, E11's two placements and E7's three
   calls are in one PR, awaiting BVJ's merge); 7c, E6, **moved to version
   2** (BVJ, 2026-11-03), so it is not a Phase 5 session. Independent of
   the panes; can run in parallel.
   **Carried into 7b** (both are in the search bar's commands window and
   its Greek surfaces, where the builder goes):
   - *E7 (looked at 2026-11-04; changes built, #463):* BVJ's look at the Greek tab on the preview (the focus move to
     "Back to the text", the header while results show, the reworded tour
     step); whether the parsing link stays in a word's details; where the
     word links' results show (kept in the tab for now; /search is the
     alternative); and E5's builder now living in the commands window
     alone, since the tab no longer opens it.
   - *E11 (looked at 2026-11-04; changes built, #463):* BVJ's look at the "My notes" checkbox on the preview (its look
     on /search's narrow row, the tray re-searching on a change); the tray
     shows it only when a Greek group renders, so a Greek search with no
     Greek hits has no switch there (placement to settle with the builder's
     layout); and (settled 2026-11-04) the LSC site's `/privacy` needs no
     sentence for `lit-desk-greek-notes`, since it stores no desk keys.
8. **Launch work**: 8a, E8's Reading arrangement and a way in that carries
   the passage (buildable now; **done 2026-11-02**, merged: Reading, `?place=` (moves the LIT pane only), the header link carrying the chapter; the
   whole-book option let go, BVJ); 8b (**done 2026-11-02**, looked at and
   merged 2026-11-04, #464), after 8a, the parts of E8 and E20 that
   stay behind the desk preview (BVJ, 2026-11-02): with the preview on,
   Study View's "Read View" button and the /read card become ways into /desk,
   while everyone else keeps Read View; and the dormant prep for launch (the
   `/read/<book>` redirect rules and the `#ch-N` and verse-anchor mapping, the
   saved-places change so a Read View "Continue reading" record reads as a
   Study View place, and tests for both), built but not switched on; 8c, at
   launch, the cutover itself: the redirects go live, Read View's code, copy
   and docs go, the last Read View commit is tagged (E20's rename to Chapter
   View was done in 8b's PR, BVJ 2026-11-02; 8c is blocked on the launch date). The Read View removal can't sit
   behind the preview, since `/read/<book>` is what every reader has today.
   E12 (the trash restore) is its own small session after 4: see work
   session 11.
9. **Two tours**: E24. **Done 2026-11-02.** Touched `tour.js` (the shared card
   moved to `tour-runner.js`), `first-use.js` and `desk-page.js`'s title menu,
   and added `desk-tour.js`.
10. **Pane drag behavior**: E25. **Built 2026-11-02** after BVJ chose from
    a list: swap on a drop in a pane's middle, steadier edge bands, a named
    drop box, and Move left, right, up, and down in a pane's menu. Touched
    `desk-page.js`, `desk-layout.mjs` and `desk.css`. BVJ kept all of it.
11. **The trash restore**: E12. **Built 2026-11-02.** A Trash section on the
    notebook page with Restore and Restore all, undoable like any change;
    the help page says so again. Touched `desk-notebook.mjs`,
    `desk-history.mjs`, `notebook-page.js`, `record-rows.js`, `desk.css`,
    the help page, and added `trash-list.js`. No record-format change.
12. **Verse numbers off** (BVJ, 2026-11-05): E29. Chapter headings go with the
    numbers where chapters run together (the LIT pane, as Read View does), not on
    Chapter View's own pages, and the LIT pane's location field follows the verse at the
    reading line though the markers are hidden. **Built 2026-11-06** (see 13). Shared
    `lit-pane.js` with E28, so run it before or after that session, not beside it.
13. **BVJ's pass of 2026-11-05** (E30 to E50; Claude's grouping, not a decision).
    Sessions that touch the same files run one after another. **Built
    2026-11-06, one branch (`claude/desk-phase5-e29-e48`), awaiting BVJ's
    look**: session 12 (E29), a (E30, E32, E42), b's E44 to E48, c (E34, E35),
    d's E36 and e (E31). E28 with E41 is built on its own branch
    (`claude/desk-phase5-e28`, 2026-11-06), awaiting BVJ's look, and so is
    E37's phase A (Save as a document, on the same branch), and f (E39, E40,
    after BVJ's look at a mock), and g's E43 and E49 (decided from a mock).
    **Still open**: E37's phase B (slides), and E50 (mocked 2026-11-06,
    waiting on BVJ). BVJ settled E33 (at
    8c), E36's banner wording, E38 (asked BDR) and E9's two leftovers on
    2026-11-06.
    a. *Small wording and glyph fixes*: E30 (`desk.css`), E32 (the notebook
       group's heading), E42 (`glyphs.js`). E36 joins session d.
    b. *Bookmark dialog and following*: E44, E45, E46, E47, then E48 (the copy,
       once E44 and E47 are settled). `bookmark-form.js`, `bookmark-stop.js`,
       `desk-bookmarks.mjs`, `move-redraw.js`. Then **E28** (with E41), which
       shares `lit-pane.js` with E29 and E35.
    c. *LIT pane and Search pane links*: E34, E35. `lit-pane.js` and
       `search-pane.js`; run with or after E29 and E28, not beside them.
    d. *Sheet copy and files*: E36, E37 (design first). `sheet-page.js`,
       `sheet-word.js`, `desk-sheet-copy.mjs`, `desk-present.mjs`.
    e. *Finding the commands*: E31. The search bar's tray, /search and the
       Settings tab; touches `searchbar.js`/`search.js` only to dispatch an
       event, per the rule that desk code stays out of them.
    f. *The verse menu and selection panel*: E39 and E40 together (shared code
       and a shared flyout), after a mock. `panel-pieces.js`,
       `chapter-tools.js`, `desk/actions.js`.
    g. *Layout and chrome*: E49 and E50, mock first, at the real widths; E43
       (a title-menu line in `desk-page.js`, so after anything else in that
       file).

Parked: E1 and E2 wait on the N8 hold (`claude/desk-1d-hidden`).
Suggested order: 1, 2 and 7a together; then 3, 4, 5, 6; then 8a and 8b, and
8c at launch.

**Fixed**

- **E3, bug: My Notes and Places overwrote each other's list** in the
  Notebook. Fixed in 2dbab04 (2026-10-15).

