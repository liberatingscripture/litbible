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
  *Build notes (moved from the desk's CLAUDE.md, 2026-11-07):* The search
  builder was mocked first and then built on Claude's recommendation (BVJ,
  2026-11-02).
  *The builder's details (moved from the desk's CLAUDE.md, rule 17,
  2026-11-10):* each card's menus list its lemma's parsings, and a choice
  also narrows the others; there is a "+ Then another word", and "How close"
  once there are two words. A search it can't show (`=` exact, four or more
  plain words, one that doesn't read, over 300 characters) says so and
  leaves the field alone, with "Start a new search". A word that is also a
  command ("perfect", "and") is written quoted, and among several words it
  is left out, since a quote can't sit inside "a/b". A choice already made
  stays listed even when the word takes none of it, so it can be taken off.
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
    description, not its heading, says how it differs. The card's own
    heading and link already read "Scripture pages" and "View Scripture
    page →" behind the preview (2026-11-11): drop its `--public` spans and
    the two `.view-card__copy` rules in `read.css`.
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
  *Build notes (moved from the desk's CLAUDE.md, 2026-11-07):* Decided
  together with E15: BVJ picked "everything in the title, and Aa moves in
  too" from a mock (2026-11-02).
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
  *Build notes (moved from the desk's CLAUDE.md, 2026-11-07):* The title
  menu was mocked first; BVJ picked "everything in the title, and Aa moves
  in too" (2026-11-02).
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
  *The desk tour's steps, as the desk's CLAUDE.md listed them until
  2026-11-10:* it adds a LIT pane, presses a lock, shows a Sheets pane (a
  column, else the first pane that isn't the LIT turned to Sheets; E59, BVJ
  2026-11-08), points at the command row, runs "New sheet…" as the row does
  (`commands.newSheet`; a `notebook` step, left out when neither a column
  nor a row fits), and opens the Add pane menu and the Layout window.
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
  `duplicate` in `desk/sheets/sheet-pane.js`). The copy is a new sheet with the same
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
  page never writes a record), which BVJ accepted. (Undone by E64, 2026-11-09,
  once S12 had given the page an editor.) The look turned up a bug
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
  8c's list under E8. Status: **decided; done at 8c.** **The /read card went
  ahead of 8c, behind the preview (BVJ, 2026-11-11):** with the preview on,
  its heading reads "Scripture pages" and its link "View Scripture page →";
  without it, still "Chapter View" and "Try Chapter View →" (`read.astro`
  carries both, and `read.css` swaps them on `data-desk="on"`). At 8c the
  "Chapter View" spans and their two rules go. The other "Chapter View"
  mentions still wait for 8c.

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
  read the copy on screen into **one model** (`readCopy`, `desk/sheets/sheet-word.js`;
  the model and Copy's HTML and text writers in `src/lib/desk-sheet-doc.mjs`),
  so they can't disagree; Copy is now that model's HTML writer, held
  byte-identical to the old code by `test/fixtures/sheet-copy-golden.json` (and
  checked so on all 260 chapters before the old walk went). The writers are
  `desk-doc-docx.mjs`, `desk-doc-odt.mjs` and `desk-doc-rtf.mjs` over
  `desk-zip.mjs`, each pure and loaded by a dynamic import only when chosen
  (`desk/sheets/sheet-save.js`, which also draws the menu and the codes as PNGs from
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
  credit line goes on slides. **Claude's proposal for phase B (2026-11-06)**,
  following present mode (a start screen with the codes, then one 16:9 slide per
  passage, text, question and key terms box; .pptx, .odp, and PDF by Print, one
  slide per landscape page): (1) a passage with blanks gets two slides, covered
  then filled in, rather than animations, which programs play differently; (2)
  Leader only parts and each question's answer go in the speaker notes, as they
  go to the presenter view; (3) the footnotes the sheet prints get a slide of
  their own after the passage, so the verses stay large; (4) the full credit
  line on the first slide and a short closing slide, and in the file's
  properties. A long passage is split across slides by length, with the
  programs' shrink-to-fit as well. **BVJ (2026-11-06): leave phase B as an item
  to come back to**; the proposal isn't decided. **Later the same day BVJ
  decided it: "Build the slides files as you recommended"**, all four points as
  proposed.
  **Phase B built 2026-11-06** (`claude/desk-phase5-e28`). Save as ▾ gains a
  **"Slides"** group: PowerPoint (.pptx), OpenDocument slides (.odp), and
  "PDF…", which prints one slide to a 13.333 by 7.5 inch landscape page and says
  to choose "Save as PDF". **The slides are present mode's screens**:
  `desk/sheets/sheet-slides.js` runs `prepareDeck` (`sheet-present.js`) and reads each
  screen off the stage, a passage twice (no blanks revealed, then all through
  it), so a file shows exactly what present mode shows, the hint and the
  traditional word on a covered blank included; they are the room's, so the
  same whichever version is on screen. The rules are `src/lib/desk-slides.mjs`
  (pure): the deck (`deckSlides`), cutting by length (`SLIDE_CHARS`, between
  paragraphs or before a verse number; a covered and a revealed slide cut
  alike; "(continued)" on the rest), the layout (`slideBoxes`) and a text box's
  paragraphs (`slideParagraphs`), shared by both writers
  (`desk-slides-pptx.mjs`, `desk-slides-odp.mjs`) and the print view, so they lay
  a slide out alike. The look is present mode's room screen: dark ground, Crimson
  Text, Fraunces (falling back to Georgia) for headings in its green, Cardo for
  Greek and Hebrew. The speaker notes say which words a covered slide's blanks
  hold. The programs shrink text to fit; the print view fits each box itself.
  Files are named "Romans 8 study (slides).pptx". `test/desk-slides.test.js`
  unzips both and reads every XML part strictly. **Checked by hand:** a 15-slide
  deck from a Romans 8 test sheet opened in PowerPoint (notes in place) and in
  LibreOffice, rendered alike in both; the print view laid out the same slides
  on landscape pages in headless Chrome. **Not checked:** Keynote and Google
  Slides, and a PDF saved through a real print dialog. **BVJ tried Save as ▸
  Slides on the branch preview (2026-11-06): "looks good."** Status: **built
  (phase A and B), checked by BVJ.**
  **BVJ (2026-11-06), in passing:** the sheet page's "Codes to scan" checkbox
  reads **"Show QR codes"**, and present mode's line for a sheet with no
  passages says "no QR codes".

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
  *Build notes (moved from the desk's CLAUDE.md, 2026-11-07):* BVJ proposed
  a Copy flyout on 2026-11-04 and Claude advised against it; BVJ revisited
  it on 2026-11-05 and decided on 2026-11-06 to build it, with the Copy
  row's own press still copying.

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
  (`test/desk-print-part.test.js`). **BVJ tested it in Chrome (2026-11-06): all
  worked** (a verse, a range, a selection, each kind, and the page as it was
  after each dialog). Firefox not checked. Status: **done.**

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
  behavior could be seen there. **BVJ tested it in Chrome (2026-11-06): all
  worked** (on, "Exit full screen", Escape leaving full screen with a menu
  open and the second press closing it, F11 alongside). Status: **done.**

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
  *Build notes (moved from the desk's CLAUDE.md, 2026-11-07):* The
  follower's write gap and settle were 4 and 5 seconds before this entry
  (2026-11-05); the desk's CLAUDE.md keeps the current values and the rule
  that the settle must stay longer than the gap.

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
  *Build notes (moved from the desk's CLAUDE.md, 2026-11-07):* The switch's
  hint, as shipped, no longer explains how a follow starts: "Moves along
  with you as you read its book, once it’s following you. Without this, it
  stays on its verse. Up to six of your bookmarks can move."

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
  **BVJ, after a look (2026-11-06):** side by side, Pin is drawn nearest the
  footnote, and "+ Note" became the plain note marker's glyph (the one the
  note window shows), named "Add a note on footnote a", everywhere it appears. This verse's "+ Note" (tab and pane) took the same glyph pill,
  named "Add a note on this verse".
  /notebook gained "Open the Study Desk" under its title, its way back to the
  desk now the header link is on home only (E50).
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
  *The thresholds as the desk's CLAUDE.md gave them (moved from rule 23,
  2026-11-10):* `row` needs the two pills and the 4px gap plus 14px and an
  8px window edge; `more` needs the wider pill plus the same 14 and 8 (about
  118px and 78px in Inter; OpenDyslexic needs more). Side by side, "Add a
  note" sits outside Pin and the pair is right-aligned 14px from the
  footnote, level with its first line; the "⋯" is `aria-expanded`.

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
  **Built (2026-11-06).** The header's Study Desk link is on the home page
  only (SiteHeader's `deskLink`, which Layout sets for `/`; the `deskPlace`
  prop is gone). Chapters and intros have "Open in the Study Desk" ("Study
  Desk" where the old pill shortened, the icon alone on the compact toolbar)
  in the toolbar's right slot, in the Read View pill's classes, linking to
  `/desk/?place=<book>-<chapter>` (chapter 1 on an intro, as the Read menu's
  footer does). /read has a "Study Desk" pill beside "Go to passage"
  (`.read-menu__desk`, through ReadMenu's new slot), linking to `/desk/`. Both
  show only under `html[data-desk]`. /sheets keeps "Edit on the Study Desk";
  /notebook has no link of its own back to /desk (it opens from the desk's
  title menu in a new tab). Checked in the Browser pane at 1366px on John 3,
  Romans's intro, /read and home. Status: **built.**

- **E51, rough: the Share this sheet dialog needs a close × in its corner, and
  its "Close" button should say "Cancel".** BVJ (2026-11-06), on /sheets.
  Status: **done 2026-11-06**: the shared panels' round × (`lit-panel__close`,
  named "Close") in the dialog's top right corner, and "Cancel" in the button
  row; both close it (`openShareDialog`, `sheet-page.js`).

- **E52, rough: on /sheets the header's buttons overlap the toolbar.** BVJ
  (2026-11-06), with a screenshot. Over 1100px the header's search, Aa and
  Study Desk buttons float below READ NOW, out of the header's flow, and the
  sheets page left them no room. Status: **done 2026-11-06**: `.sheets-page`
  takes 3.5rem of top padding over 1100px (`sheets-page.css`), as the
  notebook page's own padding does.

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
  the Greek and the Footnotes have no verse to follow in an intro). (The entry
  first said an intro has footnotes of its own; none of the 27 has, though their
  scripture references are linked.) **Decided by BVJ (2026-11-06), taking
  Claude's recommendations, with the pane named "Book Intro":**
  1. *A pane kind of its own*, "Book Intro," that follows the book the leading
     LIT pane is in (switching as the LIT crosses into the next book) and keeps
     one book with "Stay here." The LIT pane's place stays a verse, so the other
     followers, a moving bookmark and `?place=` meet no new state, and nothing
     in the record format changes.
  2. *Ways in*: the pane menus (Show in this pane, Add pane); a Search pane's
     intro result (a plain click shows it in a Book Intro pane, opening one
     beside the search where there is room, and moves the LIT to the book's
     chapter 1 unless it is in that book; the small link beside the row opens
     the page in a new tab); and an introduction page's "Open in the Study
     Desk" pill (`?place=romans-1&intro=romans`, a pane opened only where the
     width holds it, as `?sheet=` does). Not the LIT's arrows, and not "Romans
     intro" in the passage field.
  3. *A scripture reference in it moves the LIT pane* on a plain click, and the
     pane keeps its book while the LIT shows the passage it sent (1 Timothy's
     introduction cites Matthew 5:44). Any other click on a link opens a new
     tab. A draft introduction (Luke, Acts, Revelation) says it isn't ready yet.
  Status: **built 2026-11-06** (`claude/desk-e53-book-intro`): `intro-pane.js`,
  `showIntroIn` in `desk-layout.mjs`, `introPath`, `stepBook` and
  `parseIntroParam` in `desk-passage.mjs`, the `intro` result type and
  `introMoveMessage` in `desk-search-pane.mjs`, the pill in
  `ScriptureLayout.astro`, the styles in `desk.css`. No record or format
  change; a layout saved with the kind reads back in an older copy of the page
  as "needs a newer copy." **Awaiting BVJ's look.**

- **E54, bug: Greek copied from the Greek tab pastes into a sheet as only its
  spaces, commas and verse numbers.** BVJ (2026-11-06): selected in the Greek
  pane, Ctrl+C, then Ctrl+V in a sheet; the same clipboard pasted into Word
  whole. Each Greek word (and each text-critical sign) is a `<button>`, so it
  can be clicked for its details, and the sheet's paste cleaner
  (`pastedSheetHtml`) drops a button with what it holds, on purpose, so a
  pasted web page's controls never land as text. Word ignores the tag. Status:
  **fixed 2026-11-06** in the Greek tab, not the cleaner: `tab-greek.js` writes
  the clipboard itself on a copy inside the tab, the buttons turned to spans
  keeping `lang="grc"`, the screen reader's "Verse " left out, and plain text
  with a space after each verse number and a blank line between paragraphs. A
  test in `desk-sheet-paste.test.js` holds that shape through the cleaner.
  **BVJ confirmed it in Chrome (2026-11-06).**

- **E55, bug: a list in a sheet prints as plain lines on /sheets.** BVJ
  (2026-11-06), with a screenshot: a question's bulleted list ("here?",
  "there?") and its answer's numbered list ("one", "two", "three") showed with
  no bullets or numbers. The editor's list buttons (`execCommand`) can build
  the list inside the paragraph the caret was in, which the page serializes as
  `<p><ul>…</ul></p>`. The sanitizer (`sanitizeSheetHtml`) read that as a list
  nested in a paragraph and flattened it into the paragraph's lines
  ("here?<br>there?"), so the list was lost when saved; the editor kept
  showing bullets until the sheet was reloaded. Status: **fixed 2026-11-06**:
  the sanitizer's parse now ends an open `<p>` where a block starts, as an HTML
  parser does (`CLOSES_P`), so the list is saved as a list. No saved record
  changes (the old reading never wrote a list inside a paragraph), and the
  format's output rules are untouched. Lists saved before the fix were already
  flattened and need to be made again. Checked in the browser with the
  toolbar's button in a question, and in `test/desk-sheets.test.js`.

- **E56, rough: a sheet's parts don't say how to use them.** BVJ
  (2026-11-06): the Question part's question and answer fields need ghost text
  saying what each is for; then a pass over every part. Claude's finding: the
  Question part already had ghost text, but it shows only while a field is
  empty, every template fills its questions in, and the two editors look
  identical with no visible name (only an accessible one). Decided (BVJ,
  "Build as proposed"): a visible label "Answer (leader’s version only)" above
  the answer's editor (`aria-hidden`, since the editor's own name says it);
  ghost text "A question for the group, such as “What surprised you here?”"
  and "Optional. An answer or notes for you as leader. It prints only on the
  leader’s version."; Your text's "Write here…" became "A heading,
  instructions, a prayer, or anything else to print."; and a passage's empty
  Blanks note says how to make one with the mouse ("Select words in the
  passage, then choose “Blank the selected words.” …"). Title, subtitle,
  Space to write, Key terms box, Page break and a blank's hint field were
  already clear and are unchanged. Nothing prints differently. Status:
  **built 2026-11-06** (`sheet-pane.js`, `sheet-lit.js`,
  `.desk-sheet__field-label` in `desk.css`); checked on /desk in light and dark.

- **E57, bug: the key terms box loses its box in a saved file.** BVJ
  (2026-11-06), testing Save as (E37): the box around the key terms printed and
  saved as PDF, but .docx, .odt and .rtf showed the terms with no rule around
  them. The document model (`desk-sheet-doc.mjs`) had no way to say "these
  blocks are boxed", so `readCopy` read the box's heading, list and note as
  ordinary blocks, and Copy lost it too. Status: **fixed 2026-11-06**: a `box`
  block (`DOC_BOX`: 0.75pt, the site's ink, 8 by 10pt of padding) holds the
  heading, the list and the note, the "Leader only" tag staying outside it as
  on paper; each writer draws it as a one-cell table ruled all round (Copy's
  HTML, .docx `w:tbl`, .odt `table:table`, .rtf `\trowd` with `\intbl`), the
  width of the text. **Spacing, from BVJ's look in Word (same day):** the box's
  heading kept a heading's space above it, so the top of the box was deeper than
  the bottom, and the box sat right against the line above it. The heading in a
  box is now `flush` (no space above, as `.sheet-copy__terms-title` has none),
  and 10pt of space goes above the box (`DOC_BOX.gap`; an exactly sized empty
  paragraph in .docx and .rtf, since a table takes no space above it, and the
  table's margin in .odt and Copy). The list's indent stays the documents'
  usual half inch, deeper than the page's. Copy's golden fixture changed on purpose for it. Checked
  in `test/desk-sheet-doc.test.js` and by rendering the three files through
  LibreOffice. In the same report BVJ found no template but Blank Canvas would
  add a key terms box: Bible study, Sermon and Class already hold one, and a
  sheet takes one, so the button is disabled with its reason only as hover text
  and for screen readers; Lectio divina has none. Not a bug (BVJ agreed).
- **E58, rough: a shared sheet's link reads as a string of random
  characters.** BVJ (2026-11-08), after sharing a sheet with BDR: the link
  carried a couple of hundred characters after the `#`, which read as a
  unique id taken to absurd lengths. It is the sheet itself (S8): the shared
  sheet as JSON, compressed and written in base64url, so nothing is stored
  anywhere and litbible.net never sees it. Measured the same day: a blank
  sheet makes a link of about 220 characters, a fresh template 530 to 740,
  a nine-part sheet about 560; a sheet heavy with typed text grows past that.
  Tighter encoding would shave a tenth at best, since the JSON is already
  compressed; the only real shortener is a hosted store (M14), which the
  record keeps for signed-in readers, and there is no sign-in yet. Status:
  **done 2026-11-08** (BVJ's choice: explain it): the Share dialog's note
  opens "The link is long because the whole sheet is in it," and the "Link
  copied" status says the same, so the length reads as the price of needing
  no server rather than as a glitch. The link itself is unchanged.
- **E59, gap: the Study Desk tour says nothing about sheets.** BVJ
  (2026-11-08): "the Desk tour should have at least one step about sheets,
  maybe more than one." The seven steps covered panes, following, the lock,
  the title menu, Add pane and Layout; a first-time leader left the tour not
  knowing the desk makes handouts, which Audit 5 (SH5-5) had found of the
  page itself. Status: **done 2026-11-08**: two steps. "Sheets" ends the
  first part, with a Sheets pane shown for the step (a column where there is
  room, else the My Notes pane turned to Sheets), and says what a sheet is
  and what it is for. "New sheet" follows "The title menu" in the second
  part: it runs "New sheet…" as the menu does, so a Sheets pane appears with
  its template chooser open and the card beside the chooser, and names the
  five templates; nothing is chosen, so nothing is made, and undoing the step
  takes the pane away. Both leave nothing behind, like every other step. The
  tour is nine steps; readers who finished the seven are offered the two as
  "something new in the tour." The title menu step now names a new sheet
  among the menu's items, and the offer says the tour shows sheets. Building
  the step found a race in "New sheet…" itself: with no Sheets pane open, the
  menu adds one and sends its event in the same tick, and the pane's own first
  list render, a microtask later, superseded the chooser's, so the templates
  stayed shut. The pane now leaves the screen to a request that came first.
- **E60, rough: a sheet's part drags only by its grip, and the gap's "Add"
  pill stays showing after use.** BVJ (2026-11-08), using the Sheets pane:
  the ⠿ grip in a card's corner was the only handle, and after adding a part
  from the gap between cards the pill stayed on screen until a click on an
  unrelated card. The pill was shown on `:focus-within`, and the passage
  form's × and the menu's Escape hand focus back to it, so a mouse user's
  close left it lit. Status: **done 2026-11-08**: the whole header drags
  (its buttons and the Leader only box keep their own job, and a press that
  doesn't become a drag leaves the card undraggable, so dragging across a
  part's text never carries the card off), the header's cursor says so, and
  the pill shows on hover, while its menu is open, or on `:focus-visible`,
  so keyboard focus still lights it and a mouse's doesn't. The help page
  says "Drag a part by its header." **Also (same report):** of the add bar's
  buttons only "+ For discussion" had a tooltip, and it ran too long to
  show whole. Each button now says in a short line what it adds, as hover
  text and as its description for a screen reader (`ADD_TIPS`), and For
  discussion's is "Gather your question notes on these passages into a
  section."
- **E61, wish: a template's Reading part should already offer the passage
  form.** BVJ (2026-11-08): the part "should already act as if the user has
  clicked the add passage on it." Its prompt sent the leader to the add bar
  or the LIT pane. Status: **done 2026-11-08**: on a sheet with no passage,
  the passage form (the one the gap's "Passage…" opens) is open under the
  reading part when the sheet is drawn, without taking focus or scrolling;
  a passage typed there lands after the part, as BA69 promised, and the
  form stays for the next. × or Escape closes it until the sheet is opened
  again. The prompt now reads "Type the reference in the form below, or add
  the passage from the LIT pane’s verse numbers."
- **E62, design: "+ For discussion" serves too few.** BVJ (2026-11-08), on
  reading its new tooltip: "The percentage of people who will have added
  notes, selected the question mark glyph, and then created a sheet, and
  wanted to use those notes to guide discussion is probably going to be
  really small. The options for sheets need to be more flexible than that,
  more useful to more people." Three ways were put: a chooser over the whole
  notebook, one button gathering every note, or dropping the button. BVJ
  chose the chooser. Status: **done 2026-11-08**: "+ From my notes…" in the
  add bar opens a list of the notebook's notes (any marker), highlights and
  pinned footnotes on the sheet's passages, in passage order (everything,
  newest first and capped at 60, while the sheet has no passage), each with
  a box to tick and the record's words under its reference; "Add N parts"
  brings them on in one change, so one Ctrl+Z takes them all back. A
  question note becomes a Question part, any other note or a pinned
  footnote Your text (the reference in bold, a footnote's words, then the
  note's), a highlight a passage of its verses (its chapter is read first,
  so part of a verse keeps its words). One already on the sheet is listed
  but can't be ticked. `src/lib/desk-sheet-from-notes.mjs` (pure, tested)
  took over `desk-sheet-discussion.mjs`'s overlap, order, escaping and
  limit rules, and that module and its tests are gone; nothing else read
  them. Bookmarks stay the passage form's business ("From my notebook"
  there), since a bookmark is a place, not words.
- **E63, wish: a tour for the Sheets.** BVJ (2026-11-09): "I think a third
  tour for Sheets is warranted, though it will likely be shorter. The other two
  may need updates at this point since things have developed." The desk tour's
  two sheet steps (E59) say what a sheet is and how one starts, and stop there;
  a first-time leader still left not knowing the parts, the passage and its
  blanks, or where printing and presenting are. Status: **done 2026-11-09**:
  eight cards in two parts, on /desk in a Sheets pane (`sheets/sheet-tour.js`;
  the steps are `SHEET_TOUR_STEPS`). "Making a sheet" shows the list, the
  template chooser, the parts, a passage added from the LIT pane's verse menu,
  its blanks and footnotes, and the add bar with "From my notes…"; "Using a
  sheet" shows how a sheet is printed ("Print or share…") and presented
  ("Present…"). **It writes nothing, not even
  its own sheet**: the layout is frozen as in the desk tour, and the sheet is
  the editor's new example mode (`setExample`, `endExample`), whose changes
  live in memory and are dropped when the tour ends, so even "Print or
  share…" and "Present…" save nothing. The passage is the leading LIT pane's
  chapter from the verse it is at. **Four ways in on /desk:** `?sheet-tour`
  (the help page links it), "Take the Sheets tour" at the foot of the Sheets
  pane's list, a link on the desk tour's "Sheets" card, and an offer in a
  window beside the Sheets pane the first time one shows. The seen list is
  `lit-desk-sheet-tour`, named in /privacy. **It runs on /sheets as well**
  (BVJ, 2026-11-09, after the first round on PR #522): since header C's Study
  menu and S12's ways in, a reader can meet the Sheets on the Sheets page
  first, so the tour acts on that page's list, editor and versions view; an
  offer there that sent readers to /desk was weighed and declined. One core
  (`sheets/sheet-tour.js`) takes a host, the desk's (`sheet-tour-desk.js`) or
  the page's (built in `sheet-page.js`, loaded only when the tour starts or is
  offered); the page's ways in are `/sheets/?sheet-tour`, a "Take the Sheets
  tour" button after the list's intro, and the offer. **The seen list is one
  for both pages** (BVJ's ask), so taking, postponing or declining the tour
  on either counts on both and a tour of new steps is offered once. The
  page's versions view can be drawn for an unsaved sheet (`demo` mode in
  `drawSheet`), which is how "Print or share" and "Present" show a sheet that
  was never written. The runner waits for a `finish` that returns a
  promise before it returns focus, since the page's redraw is async (TR7-9's
  second case). **The other two tours were
  adjusted in the same pass** (STUDY-DESK-AUDIT-7.md, TR7-1 to TR7-6, TR7-9): "New
  sheet" no longer counts five templates (there are seven), the title menu's
  card names full screen and the notebook page, the notebook tour's menu card
  names "Add to sheet," each /desk tour refuses to start over a running one,
  and the help page counts three tours.
- **E64, rough: the Sheets page's list has no Duplicate, Save as template or
  Delete.** BVJ (2026-11-09), from /sheets: "I noticed the /sheets page doesn't
  have the duplicate, save as template, and delete buttons. Shouldn't it?" E27
  kept the page read-only on purpose (it never wrote a record, and BVJ accepted
  that), but S12 gave it an editor and "New sheet…", so the reason was gone and
  nothing went back to the list. It didn't list the reader's own templates
  either, so one couldn't be opened or deleted there. Status: **done
  2026-11-09**: each sheet has the three buttons, in columns, and "My
  templates" follows the sheets, both drawn by the Sheets pane's own code
  (`sheetRow`, `ownTemplatesList` in `sheets/my-sheets.js`), so the two lists
  can't drift apart. A row's name stays a link (a sheet's versions; a
  template's editor, since it has no passages to print). Duplicate opens the
  copy in the page's editor with its title focused, as the pane does; Save as
  template redraws the list on the new template; Delete has Undo and Ctrl+Z.
  The page loads the rows by `import()` (`sheets/sheet-page-list.js`), since
  they bring the history, which a page opened to print or present has no use
  for, and `my-sheets.js` keeps its own `button` so drawing the list never
  loads the editor (`test/desk-sheet-page-list.test.js`). The list now
  redraws when a sheet changes elsewhere (another tab, or Undo), keeping focus
  on the row it was on.
- **E65, rough: a blank can't be taken off from the passage.** BVJ
  (2026-11-09), on a passage card in the Sheets: "No way to unselect text for
  blanking out. Undo works if you just blanked it, but what about later? How do
  you remove the “blank”?" The only way was the × beside the blank's row in the
  list under the passage, which a reader looking at the words never found.
  Status: **done 2026-11-09**: "Fill in the selected words" sits beside "Blank
  the selected words" and fills in every blank the selection touches (a blank is
  one unit; `blanksTouching`, `desk-sheet-lit.mjs`), and Enter on words the
  keyboard cursor holds that are already blank fills them in instead of
  refusing. The row's × gained a "Fill in again" tooltip, and the empty note,
  the keyboard hint and the help page say all three ways.
- **E66, wording: "Your text" on every text card.** BVJ (2026-11-09): "The
  “Your text” on every card in Sheets is confusing. It would only make sense if
  it was as opposed to something else, but they all say it." The name was meant
  against the LIT's Passage, but every sheet is the leader's words except its
  passages, so the contrast never showed. Status: **done 2026-11-09**: the part
  is "Text" in the card's header, the add bar, the gap's Add menu, the field's
  accessible name, the announcement and the help page. No record changes (the
  type is `text`).

**The conventions pass of 2026-11-10** (E67 to E78. BDR, after using the
preview, said it "needs to adhere to some established 'humans will be using
this' design conventions. I got lost very easily," with more recommendations
to come; E67 is BDR's example. BVJ then asked Claude to research current
conventions and suggest improvements, sitewide, changing nothing. **Every
entry below was a proposal; BVJ asked for all twelve to be started
(2026-11-10), and each entry's status says what was built.** E67, E68, and
E72 each reverse a call BVJ had made, named in the entry. How it
was done: two research passes, then a walk through Chapter View, the
Notebook, /desk, /sheets, and /notebook on `main` at `9431deb9`, at 1440 by
900 and at phone width. **How far to trust it:** the general conventions come
from pages that were opened and read, listed below. The comparison with other
Bible tools is thin: only Bible Gateway's, Blue Letter Bible's, and STEP's
help pages opened; what is said of Logos, Sefaria, YouVersion, Olive Tree, and
Kindle is from search summaries and general knowledge, and no published
usability study of any of them was found. Material 3's and Apple's own
guideline pages would not load. BDR's further recommendations take the next E
numbers as they arrive.)

Sources, by the short names the entries use:
[APG button](https://www.w3.org/WAI/ARIA/apg/patterns/button/),
[NN/g state switch](https://www.nngroup.com/articles/state-switch-buttons/),
[Android icon buttons](https://developer.android.com/develop/ui/compose/components/icon-button),
[NN/g hidden navigation](https://www.nngroup.com/articles/hamburger-menus/),
[NN/g new tabs](https://www.nngroup.com/articles/new-browser-windows-and-tabs/),
[Microsoft menus](https://learn.microsoft.com/en-us/windows/win32/uxguide/cmd-menus),
[NN/g icons](https://www.nngroup.com/articles/icon-usability/),
[NN/g tooltips](https://www.nngroup.com/articles/tooltip-guidelines/),
[NN/g overlays](https://www.nngroup.com/articles/mobile-instructional-overlay/),
[WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html),
[WCAG 1.4.13](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html).

**Already in line with convention, so nothing is proposed:** the undo bar in
place of "Are you sure?" dialogs, empty states that say what to do next, the
pane menu's one-line description of each kind, the Keyboard switch for
single-key shortcuts, the Move menu beside pane dragging, tabs that mark the
selected one two ways, and the verse numbers' and footnote letters' enlarged
tap areas (`global.css`, never under 24px).

- **E67, rough: the footnote's pin shows what a press will do, which reads as
  its state.** BDR (2026-11-10), relayed by BVJ: "When active it shows a
  slashed pin, and no other change to button. So it is showing 'what will
  happen if you touch this' which simultaneously suggests 'this is not
  pinned.'" BDR's fix: let the button show its state, filled or empty, and
  never a slashed pin. Today's button is what E18 specified (`pins.js`,
  `ICON_PIN` and `ICON_UNPIN`; the name flips between "Pin footnote a" and
  "Unpin footnote a"; no `aria-pressed`), so **taking this reverses E18.**
  What the sources say: APG button allows either a constant label with
  `aria-pressed` or a changing label without it, so today's button is
  accessible and the trouble is for the eye. Android icon buttons shows a
  toggle filled when selected and outlined when not. NN/g state switch accepts
  an unlabeled icon that shows the next state, but names that lone icon as
  the ambiguous case. The pane lock (E21) already shows its state (a closed
  lock, `aria-pressed`, a fixed name), so the desk's two toggles disagree.
  Proposal: one thumbtack, outlined when not pinned and filled and tinted
  when pinned, named "Pin footnote a" with `aria-pressed`, in the popover,
  the Footnotes list, and This verse. My Notes' rows keep the word "Unpin,"
  which is a command on a list of pinned things. The lock takes the same
  pressed tint: an open and a closed lock differ by a few pixels at 14px, and
  its tooltip flips to the action ("Follow the LIT pane") while its name
  stays "Stay here." Status: **done 2026-11-10** (BVJ: “Start E67 to E78”), as
  proposed: one thumbtack, outlined, then filled and tinted green while
  pinned, always named “Pin footnote a” with `aria-pressed`, wherever a Pin is
  drawn; My Notes' rows keep “Unpin.” The lock takes the same tint, and its
  tooltip now says its state (“Stay here (on)”), not the press to come. This
  reverses E18's struck-through glyph.
- **E68, rough: on /desk every command is behind a menu.** Claude's pass
  (2026-11-10). Add pane, Layout, New sheet, Print, Display options, the tour,
  and Help are all under the page title, "Study Desk ▾", and the site's own
  navigation is under the hamburger, so a first look at the page shows panes
  and no commands. NN/g hidden navigation measured this on desktop: hidden
  navigation was used in 27% of cases against 48% to 50% for visible, and
  people were at least 39% slower. Proposal: a slim row of worded buttons
  under the header (Add pane, Layout, New sheet, Print, Help), the title menu
  keeping the rest. **This reverses E15's choice:** BVJ picked "everything in
  the title" from three mocks (2026-11-02), and this is close to the second,
  the menu added with the bar unchanged. Status: **done 2026-11-10**:
  `command-row.js` draws Add pane ▾, Layout…, New sheet…, Print… and Help (new
  tab) under the header, and the title menu keeps Display options, Full
  screen, My Notebook page, Take the tour and feedback. The Layout and Print
  windows hang under their own buttons and give focus back to them. The desk
  tour's “The title menu” card became “The commands” (`since: "e68"`, so it is
  offered again). This reverses E15.
- **E69, rough: a pane's header doesn't say what it is showing.** Claude's
  pass (2026-11-10). The header is the kind ("My Notes ▾"), the lock, and ×.
  That a pane follows the LIT pane is carried by the lock glyph alone, and
  the passage it is on shows only where the pane's body happens to name it;
  an empty My Notes names none. Logos marks linked panels with a link-set
  letter and Sefaria's side panel is opened from, and headed by, the passage
  (search summaries, not opened pages). Proposal: a following pane's header
  carries the passage in muted type ("My Notes · John 3"), and a pane that
  stays put carries its own. Check each follower kind before building, since
  This verse and the Greek already open with the passage. Status: **done
  2026-11-10**, scoped by the check the entry asked for: This verse, Greek and
  Footnotes name their passage in their passage bar, and Book Intro its book
  in its own, so only My Notes lacked one. Its header now names its chapter in
  muted type after its name (“My Notes John 3”), the followed chapter or the
  one it stays on.
- **E70, wording: the notebook page has four names.** Claude's pass
  (2026-11-10). "My Notebook" in the header's Study menu (`SiteHeader.astro`),
  "Notebook" as the page's heading (`notebook.astro`), "My Notebook page" in
  the title menu (`title-menu.js`), and "Open the notebook page" in the
  Settings tab (`panel.js`). The verse menu's group is also headed "My
  Notebook," and the panel is "the Notebook" (the naming rule in the desk's
  CLAUDE.md, BA138 and BA139), so a newcomer meets one word for a panel, a
  page, and a menu group. Proposal: one name for the page, used in all four
  places, chosen by BVJ. Status: **done 2026-11-10**: BVJ chose “My
  Notebook.” The page's title and heading, the title menu, the Settings
  tab's link (“My Notebook · My sheets”), the commands window (“Open My
  Notebook”), the help page, and the tour card all say it; the header's
  Study menu already did. The panel stays “the Notebook” and the tab “My
  Notes.”
- **E71, rough: a link that opens a new tab doesn't look like one.** Claude's
  pass (2026-11-10). In the Sheets pane, "Present…", "Print or share…", and
  "Open on its own page" open new tabs, as do the title menu's "My Notebook
  page" and "Help for the Study Desk." Each says so in its accessible name or
  tooltip, and nothing says so to the eye. NN/g new tabs accepts new tabs
  from a hub the reader will return to, which the desk is, and asks for a
  visible signal first. Microsoft menus keeps the ellipsis for a command that
  needs more information before it acts, so "Present…" reads as "a dialog
  follows." Proposal: the LIT pane's "Open on its page" glyph
  (`OPEN_PAGE_ICON`) after each of these labels, and the ellipsis kept only
  where a window or chooser opens (Layout…, Print…, New sheet…). Status:
  **done 2026-11-10**: the open-page mark (`newTabMark` in `glyphs.js`)
  follows “Print or share,” “Present,” and “Open on its own page” in the
  Sheets pane, “My Notebook page” and the feedback line in the title menu, and
  Help in the command row. “Print or share…” and “Present…” lost their
  ellipsis; Layout…, Print… and New sheet… keep theirs. The Sheets tour and
  the help page follow, and the Sheets tour's page card named “Done,” which is
  “Close” since #534, so that was corrected too.
- **E72, rough: icon-only buttons explain themselves only through `title`.**
  Claude's pass (2026-11-10). The Notebook's lamp (Open the Study Desk), the
  popover's pin and add-note glyphs, the pane lock, a sheet part's arrows,
  and the phone toolbar's Read View glyph have no words. Where one has a
  tooltip it is the browser's own (`title`, set about 80 times in
  `src/scripts/`), which never shows on keyboard focus or on touch and is
  slow on hover; a sheet part's arrows have none. NN/g icons
  finds only a few icons universally read (home, print, the magnifier) and
  recommends a visible label; NN/g tooltips asks that a tooltip show on focus
  as well as hover; WCAG 1.4.13 sets what a custom one must do (dismissible,
  hoverable, persistent). Proposal: one shared tooltip for icon-only
  controls, shown on hover and focus, and words beside the glyph wherever
  there is room (the Footnotes list's pills, a wide pane's header). **Words
  beside the glyph would reverse part of E18, E21, and the 2026-11-06 change
  of "+ Note" to a glyph,** which chose glyphs for quiet; the tooltip alone
  reverses nothing. Status: **done 2026-11-10**: `src/scripts/tip.js`
  (`setTip`) is the shared tooltip: on hover after 350 ms and at once on
  keyboard focus, never on touch, dismissed by Escape, hoverable, and
  `aria-hidden` (the name already says it). It is on the Notebook's lamp and
  Minimize, the popover's Pin and Add a note, This verse's add, the pane lock,
  × and flag, and a sheet part's ↑ ↓ ×. Words beside the glyph: “Pin” and
  “Note” in the Footnotes list, the Footnotes pane and This verse (the list
  still picks row, “⋯”, or inline by measuring, and kept row at 1440 by 900),
  and “Stay here” beside the lock in a pane header wider than 26rem. The
  popover keeps glyphs alone. The phone toolbar's Read View glyph is
  unchanged: a finger gets no tooltip, and F3's one-row toolbar has no room
  for its word. The words reverse part of E18, E21, and the 2026-11-06 glyph
  for “+ Note.”
- **E73, rough: an offer opens over a task.** Claude's pass (2026-11-10). Two
  cases seen. The app announcement opened over /notebook/:
  `announcement-gate.js` keeps it off scripture, /desk, and /sheets
  (`SCRIPTURE_SURFACES`) and off /apps and /privacy (`SUPPRESSED_PATHS`), and
  /notebook/ and /desk/help/ are in neither. And the Study Desk tour's offer,
  at the top right of /desk, covered the My Notes pane's lock and × (three
  columns at 1440 by 900). NN/g overlays, a study of phone apps, found people
  dismiss an instructional overlay quickly and remember little of it.
  Proposal: add `[data-notebook-page]` and
  the help page to the gate; open the tour offer clear of any pane header
  (the bottom right), or lead with the quiet line the title menu already
  has. Status: **done 2026-11-10**: `/notebook` and `/desk/help` are in
  `SUPPRESSED_PATHS` (paths, since `[data-notebook-page]` is on the page for
  everyone); the Study Desk tour's offer opens at the bottom right of the
  panes, and the Sheets tour's on /desk sits level with its pane's foot, clear
  of the next pane's lock and ×.
- **E74, rough: the first pin opens the Notebook and re-wraps the text.**
  Claude's pass (2026-11-10). In the preview's own browser profile, where the
  "kept in this browser" card had never been answered, pressing Pin in a
  footnote's popover expanded the minimized Notebook, and the text re-wrapped
  under the open popover (the column narrows from 52 to 48 while the Notebook
  is expanded). Seen once, and the cause was not
  traced (the first-use card is the likely one). A small press that moves the
  whole page is a surprise; the conventional answer is a quiet confirmation
  where the reader is looking, as the undo bar gives for an unpin. To settle:
  whether the first record should expand the Notebook at all, or the tab
  should carry a mark until the reader opens it. Status: **done 2026-11-10**
  (BVJ took Claude's recommendation): the first record no longer opens the
  Notebook. It puts a green dot on the tab and the header's toggles (named
  “New: where your notebook is kept” to a screen reader) until the Notebook
  is opened, and the undo bar offers “Open the Notebook,” which opens it
  on My Notes, where the card is. When the bar already holds an undo, the
  offer is left out and the dot alone remains. The dot is Highlight in
  forced colors. The
  cause, as traced: it was the first-use card: the first record a visit
  writes while “kept in this browser” is unanswered fires `store.onEntry` in
  `first-use.js`, which calls `reveal()`, and `revealPanel()` in `panel.js`
  opens the Notebook so the card is met (once per page load). Opening it takes
  the column from 52 to 48, so the text re-wraps under the popover. Once the
  card is answered it never happened again, which is why BVJ's own browser
  didn't show it.
- **E75, rough: the Notebook's Settings tab has no order to it.** Claude's
  pass (2026-11-10). In one run it holds three checkboxes and a two-way
  choice (the marks), "Hide my marks," a Print… button with a line of help,
  links styled unlike one another ("Notebook actions" and "Take the tour"
  underlined; "Open the notebook page," "My sheets," and "Help" not), the
  reminder checkbox, where the notebook is kept, the
  feedback link, and "Ask this browser to keep it." Proposal: three small
  headings (Show, Keep and print, Help) and one link style. Status: **done
  2026-11-10**: three headings, Show (the switches), Keep and print (Print…,
  the notebook page and My sheets, the reminder, where it is kept, “Ask this
  browser to keep it”), and Help (Notebook actions, the tour, Help, feedback),
  and one link style (the text green, underlined, regular weight). A page with
  no switches has no Show group.
- **E76, rough: Aa and the search button hang under the header.** Claude's
  pass (2026-11-10). **Sitewide, not the desk's:** above 1100px
  `.site-header__nav-tools` is positioned under "Read Now," outside the
  header's row (`global.css`), so the two utilities float over the top of
  each page. E52 was one symptom (/sheets' toolbar ran under them, fixed by
  padding the page), and /notebook pads itself the same way. The convention
  is utilities in the header's row, after the navigation. If BVJ takes this
  up it belongs in `FIXLIST.md`; it is logged here because this pass found it
  and E52 is its neighbor. Status: **done 2026-11-10**:
  `.site-header__nav-tools` sits in the header's row after Read Now, and
  /sheets' extra top padding (E52's) is gone. The row fits at 1101px and
  1440px with no sideways scroll. Logged in `FIXLIST.md` too.
- **E77, rough: a few controls are under 24px tall.** Claude's pass
  (2026-11-10), measured in the preview: the popover's Pin and "Add a note"
  are 32 by 20, a sheet's "Add a part here" is 55 by 22, and its minutes
  field is 59 by 23. WCAG 2.5.8 asks for 24 by 24, and these pass only by its
  spacing exception. E49 placed the Footnotes list's pills and did not set
  the popover's size. Proposal: a 24px minimum height on all three. Every
  other desk control measured on /desk was 24px or more. Status: **done
  2026-11-10**: every Pin and Add a note pill (the popover's now 32 by 24) and
  the Footnotes list's “⋯” are 24px tall at least, the gap's “+ Add” is 24px,
  and the minutes field 24px at least.
- **E78, rough: the verse menu is eight rows with the desk on.** Claude's pass
  (2026-11-10), **the least certain entry here.** Copy text, Share image,
  then under "My Notebook": Add a note, Add bookmark, Print, Add to sheet,
  Highlight, and Show in Notebook. Opened on John 3:3 it covered the header
  and part of the chapter's title, though it drags and has a ×. Reading apps
  are said to lead with highlight colors and a note and to keep the rest
  behind "more" (search summaries only). Microsoft menus asks for the most
  used commands first and groups of seven or fewer, which the menu meets. To
  settle from BVJ's and BDR's own use, not from this entry: which rows are
  pressed most, and whether Print and Add to sheet belong behind one "More"
  row. Status: **order settled by BVJ, nothing changed** (2026-11-10): “As far
  as the menu order, e-readers start with markup options yes, but I think LIT
  Bible users will be more likely to use the copy buttons.” Copy text and
  Share stay first. Whether Print and Add to sheet go behind one “More” row
  was not taken up and stays open.

**BVJ, 2026-11-10** (after the conventions pass)

- **E79, design: no more notes on a footnote.** BVJ (2026-11-10): “Let's
  actually remove the ability to add notes on footnotes,” and, asked
  whether to keep the ones already made: “I'm the only one using it so
  far. Any notes on footnotes can be deleted.” This reverses M11
  (STUDY-DESK.md). Status: **done 2026-11-10**, in PR #539:
  “Add a note” is gone from beside Pin in all four places (the popover a
  footnote letter opens, Chapter View's Footnotes list, This verse, and
  /desk's Footnotes pane), and with it the Footnotes list's “⋯” fold (E49's
  `more` mode), which existed only to hold two pills where one fitted; Pin
  now sits in the margin or on the note's line. Everything that showed,
  printed, noticed, named or placed a note on a footnote was deleted
  (`desk/footnote-notes.js`, `onFootnote`, `recordWhere`, the pin-style
  notice and Keep for notes, the margin and print placement beside a
  footnote, the “On a footnote” line in My Notes, the sheet and export
  forms). The footnote target is withdrawn from the format (kind 2): a
  note left from before keeps its `footnote` and `n` untouched and reads
  as a note on the verse that holds the letter, where BVJ can delete it.
  A Markdown copy saved before then still has its “Note on a footnote”
  entries refused rather than read as verse notes.
- **E80, bug: the Footnotes list had no Pin buttons until the Notebook was
  opened.** BVJ (2026-11-10): “The pin buttons on footnotes don't appear
  until a user clicks on the notebook tab at least once.” The buttons are
  the shell's (`pins.js`), and since the two-stage load (LG3-2) nothing
  brought the shell for a reader who only scrolled to the notes on a chapter
  with nothing kept. Status: **fixed 2026-11-10**: the first stage loads the
  shell when the chapter's Footnotes list comes within a screen of the
  window (`first-stage.js`, an IntersectionObserver), so the buttons are
  there on arrival by scrolling, “See in footnotes,” or a link to a note.
- **E81, design: Pin stays on the left of its footnote.** BVJ (2026-11-10):
  “I think the pin buttons should never move to the righthand side. They
  can condense by removing the word 'pin' if there's not enough room. The
  lefthand column should not be allowed to get narrow enough that the
  button with just a pin glyph won't fit.” This retires E49's `inline`
  placement. Status: **done 2026-11-10**: the Footnotes list has two modes,
  `row` (the thumbtack and “Pin”) and `glyph` (the thumbtack alone, where
  the margin is too tight for the word), both in the left margin. On a
  chapter the column keeps 38px on its left (`KEEP_LEFT`: the 54px the
  thumbtack needs, less the column's own 16px of padding) whatever the
  Notebook or the reader's dragged widths ask, so at the default font and
  size the expanded Notebook floats below about 935px where it was 897px.
  Where the window itself leaves less than that with nothing moved (a
  narrow window, a large text size), the Footnotes list is indented by
  what is missing, so Pin is still on the left and inside the window
  (Claude's call, since nothing else keeps it left there).
- **E82, design: Pin shows only for the footnote the reader is at.** BVJ
  (2026-11-10): “I don't like how cluttered the page looks with all those
  pins buttons running down the column beside the footnotes… What if the
  pin buttons were invisible until the mouse hovers or focus is on either
  the button or the footnote row? When pinned, the active button could
  persist.” Two mocks were shown: only the row under the pointer, or the
  whole list faintly while the pointer is in it. BVJ chose the first. A
  bare thumbtack above the column as a clue was BVJ's own doubt (“That last
  part may not be a good idea”) and was left out: it would look like a
  control and do nothing. Status: **done 2026-11-10**, in `desk.css` alone:
  in Chapter View's Footnotes list a Pin is drawn only while the pointer is
  over its footnote or the button, while focus is on or in the footnote
  (so Tab still reaches every Pin, and “See in footnotes” shows the one it
  lands on), for a footnote a link landed on, and always once the footnote
  is pinned. The popover's Pin, This verse and /desk's Footnotes pane are
  unchanged, and they, the tour and the help page are how a reader who
  never points at the list learns of pinning.
- **E83, bug: the text-width line covered the right edge of a footnote's
  Pin.** Found by Claude while checking E82 (2026-11-10): with the Notebook
  expanded, the line dragged to set the text's width started 6px outside
  the column and was 18px wide, so it lay over the last 8px of every Pin in
  the Footnotes list, and a click there opened the line's menu instead of
  pinning. BVJ: “make the small fix.” Status: **fixed 2026-11-10**: the
  line is 12px wide and lies wholly inside the column's left padding,
  between Pin and the text (`TEXT_HANDLE` in `desk-margin.mjs`, held to
  both by a test).
- **E84, design: a sheet says what its template is for.** BVJ (2026-11-10):
  “when I'm trying to use them, I have a hard time conceptualizing it as a
  whole because it's spread out and the shape of it is not immediately
  clear,” and, of the place: “in the sheet editor, not the template list.”
  A first mock reused the chooser's one sentence; BVJ: “the description
  needs a bit more. Just a list of its parts is helpful but not as much as
  I'd hoped.” So each built-in template has a second, longer text (`about`
  in `desk-sheet-templates.mjs`): who it is for, how a session with it
  moves, and what lands on the page. The chooser keeps its short line (the
  parts line dropped on 2026-11-08 stays dropped). Status: **built
  2026-11-10**, for review. The editor shows it dimmed between the
  subtitle and the first part, with a × that hides it **on that sheet**
  (BVJ: “per sheet”), remembered in the notebook's own settings in this
  browser (the store's meta value `sheetAboutHidden`), so nothing is added
  to the sheet record, a share, or /privacy's list of keys. It never
  prints, copies, shares or presents. Two things Claude decided in the
  building, for BVJ to confirm: (1) **it shows only while the sheet still
  has the template's parts**, in order, by type and heading
  (`templateAbout`); typing in a part and adding passages keep it, while
  adding, removing, moving or renaming a part takes it away, and Undo
  brings it back. A sheet keeps only its template's id, which a sheet made
  from one of the reader's own templates carries too, so the id alone
  would have shown “three questions” over a sheet with none; (2) the
  trailing “Change, move, or remove any part,” which BVJ was undecided
  about, is left out, the paragraph being long enough. Blank canvas has no
  description. The wording is Claude's; “needs no expert in the room” and
  “suits a new group, or one where few people speak” (Swedish method) are
  characterizations for BVJ to check.
- **E85, bug: a blank's “traditionally …” hint, and the key term card on
  every chapter page, named the entry's word for every word of its family.**
  BVJ (2026-11-10): “the blanks on key terms with hints doesn't really work.
  The hints are just the primary gloss of the traditional rendering of a
  Greek word, but words are rendered differently in different places, and
  it's also not responsive to part of speech.” A glossary entry governs a
  family of Greek words and names one (`traditional: Faith`, `greek:
  pistis`), and that pair was printed under, and on the card of, every
  marked word: “traditionally faith” beneath “trusted,” which renders
  *pisteuo*. **Measured over the 4,405 marked words in the text**: 66% sit
  on the Greek word their entry names; 31% on another word of its family
  (*pisteuo* 196, *aphiemi* 146, *sozo* 94); 3% in a verse holding two
  family words that differ. Of the first group, about 1 in 9 sit where a
  literal traditional translation (the Berean Interlinear) prints another
  English word than the glossary's (holy/“saints” 39, soul/“life” 19,
  Gentiles/“nations” 20). So about 4 hints in 10 misfit. BVJ's own example,
  sarx as “people,” is of that second kind, and shows why no rule settles
  it: at Luke 3:6 and Galatians 2:16 the Berean keeps “flesh,” BVJ's own
  notes say “Traditionally, ‘all flesh’” and “‘flesh,’” and “people” is the
  NIV's. **Decided** (BVJ, 2026-11-11, “Yes, both”): fix the word family
  now, on the sheets and the card together; the per-verse word is set aside
  (below). Status: **built 2026-11-11, for review.**
  - **What it does.** `LEMMA_WORDS` (`scripts/lib/glossary-lemmas.mjs`)
    gives each of the 125 Greek words the 47 entries govern its own
    traditional word and Latin spelling. At build, each mark in a page's
    term data is stamped with the family words its verse holds, read from
    `public/greek/text/`; only the choice among the owner's own words goes
    on the page. `src/lib/term-words.mjs` is the one rule both readers
    share. **The card** reads “Traditionally believe · Greek pisteuo” on
    “trusted.” For every reader, 1,888 of the 4,405 cards (43%) now read
    differently: 1,441 name another word, 186 only lose the glossary's
    “[1]” or “[2]” (“good [1]” on *kalos*), 138 only gain a capital
    (“Gentiles,” “Satan”), and 123 list candidates (next bullet). **A
    sheet's** “traditionally …” hint is the blank's own word; the Blanks
    list has a row for each traditional word a term's blanks render; “My
    own hint…” starts from that word, selected; and the Key terms box
    lists the words its passages actually hold (“trusted, traditionally
    believe, pisteuo”). The give-away checks follow, which also catches
    what they missed: a footnote reading “Traditionally, ‘believed’”
    beside a blank on “trusted” was not flagged while the telltale was
    “faith.”
  - **A verse with several family words that differ** (115 marks, 2.6%,
    differ on the traditional word, and 8 more on the Greek alone; Romans
    3:26 has *dikaiosune*, *dikaios* and *dikaioo*): nothing says which
    the rendering renders until alignment phase 2 links words, and nothing
    guesses. **The card names each**: “Traditionally faith or believe ·
    Greek pistis or pisteuo.” It first kept the entry's own pair there,
    which named a Greek word the verse doesn't hold in 16 of the 123
    (“Greek dikaiosune” on “just” at Galatians 3:11); the review below
    caught it. A sheet prints no hint, a new blank starts with none, and
    its menu offers each word (“traditionally righteous,” “traditionally
    justify”); the one picked is stored as the leader's own hint, so the
    record format takes no new field (STUDY-DESK-FORMAT.md, “blank,” says
    so for the apps), and it is read back as a pick: the menu shows it
    chosen, and present mode covers the blank with the word. A blank that
    already asked for the traditional word says in its row why nothing
    prints. Each such blank keeps its own row, since two in one verse can
    want different words, and the Key terms box lists both words for the
    verse.
  - **Hints that would be the answer.** The LIT keeps the traditional word
    in places (“faithful” 41 times, “unclean,” “demon,” “clean,” “spirit”),
    and there the corrected hint is the blanked word itself: 182 marks
    (172 where the word is the same, 10 where it is one side of a slash),
    where the entry's word was the answer in 101 before. A new blank there
    starts with no hint, and its chip says why; the menu still offers the
    word. The Key terms box on the participant's version follows: a
    traditional word that is itself a rendering left blank there goes with
    it (“______, pistos,” where it printed “______, traditionally
    faithful, pistos”). Only the word itself counts: “faithfulness” under
    “traditionally faith,” “the heavens” under “heaven” and “demons” under
    “demon” are left as they were, the first two being the contrast a hint
    is for. Claude's call, for BVJ to confirm.
  - **The words, for BVJ to confirm: they are Claude's draft.** Lowercase
    dictionary forms, with a capital where Bibles print one (Satan,
    Gentiles, Savior, Almighty, Baptist, Gehenna/hell, hell/Hades). The
    judgment calls: *hilasterion* “mercy seat” (from BVJ's own notes) and
    *hilaskomai* “make atonement/be merciful”; *baptismos*
    “washing/baptism”; *kakia* “malice”; *katharismos* and *katharotes*
    “purification”; *koinonos* “partner/partaker,” *koinoneo* “share,”
    *sunkoinonos* “fellow partaker,” *sunkoinoneo* “have fellowship with”;
    *sarkinos* and *sarkikos* “carnal/fleshly”; *eusebes* “devout”;
    *porne* “prostitute,” *pornos* “sexually immoral”; *nomikos* “lawyer”;
    *eleemosune* “alms”; *latreia* “service”; *psuchikos* “natural”;
    *akatharsia* “impurity”; *makarizo* “call blessed”; *hupokrinomai*
    “pretend.” **A slash offers two words where one would mislead**:
    *aphiemi* “forgive/leave” (a literal translation has it as “leave” 54
    times and “forgive” 46 of 143, and “forgive” alone stood on “leave
    your gift there,” Matthew 5:24), *charizomai* “forgive/grant,”
    *eusebeo* “worship/show godliness,” *anistemi* “rise/raise,”
    *blasphemeo* “blaspheme/slander,” *blasphemos*
    “blasphemous/blasphemer,” *exomologeo* “confess/praise,” *hagiasmos*
    “sanctification/holiness,” *dikaioma* “requirement/righteous act,”
    and *moichalis* “adulterous/adulteress.” Each was held against the
    Berean Interlinear's commonest word for the lemma.
  - **Also decided in the building, for BVJ to confirm.** (1) **The Key
    terms box follows**, though only hints and the card were asked for: a
    sheet hinting “traditionally believe” above a box reading “trusted,
    traditionally faith” would have contradicted itself. (2) **The Greek
    is spelled as the glossary spells it**, no macrons, u for upsilon. (3)
    The card no longer shows the glossary's disambiguator. (4) **The
    entry's own word still gives a blank away** beside the blank's own
    (“faith” in a question, beside a blank that is traditionally
    “believe”), and a phrase gives one away by its telling word, never by
    the verb that carries it (“mercy” for “have mercy”; a note saying
    “makes” flags nothing of “make atonement”). A footnote's flag names
    the word the note uses (“whose key term is traditionally ‘faith’”).
  - **Reviewed** by an Opus agent (2026-11-11), which read the list
    against the Berean's word in every marked verse and the code against
    its tests. Taken: the card's candidates; the entry's own word and the
    phrase rule in the give-away checks (`findLeaks` wanted the telltale
    as an exact run, so “commit adultery” had stopped flagging what
    “adultery” used to); the row's line for a stored traditional hint; the
    picked word in present mode; the capitals; and eleven of the slashes
    above. Declined: its objection to “worship/show godliness” (the ESV
    has it at 1 Timothy 5:4), and keeping both candidates as tells after a
    leader picks one (the pick settles it). Its count of 27 cards naming a
    word the verse lacks is 16 by Claude's.
  - **Found in the browser check, and fixed: renderings made of common
    words** (BVJ, 2026-11-11: “address all those issues”). The give-away
    checks pass over a list of common words, so that a note saying “that”
    flags nothing, and “just,” “very,” and “being” are on it. A blank on
    “just” (66 marked words), “very being” (30), or “being” (5) therefore
    had no word to be matched by: the participant's Key terms box printed
    “just” beside its own blank, and a note reading “Or ‘just’” printed
    unflagged. This is older than E85 (the list is phase 3h's) and showed
    when the test sheet blanked Romans 3:26. “Just” can't come off the
    list: 255 of the 5,768 footnotes say “not just” or “just as.” Two
    rules now, one function (`commonTells`, `desk-sheet-lit.mjs`). **In
    the Key terms box** a rendering is a term's word, never said in
    passing, so one made of common words is left blank beside a blank that
    is it or a form of it (“just” beside “justness,” either way round).
    **In a footnote** a common word counts only where the note sets it in
    quotation marks, which is how a note cites a rendering: “Or ‘is just’”
    gives away a blank on “just” or “justness,” and “it’s not just about”
    does not. A common word that only carries a blank's telling word tells
    nothing (“with” in “cooperate with,” “your” in “transformation of your
    mind”); the first draft flagged those, and a run over every footnote
    caught it. With every marked word of a chapter blanked, 30 notes are
    newly flagged, each citing “just,” “being,” or “very being”; a flagged
    note is left out until the leader decides, as any is. Present mode's
    key terms screen follows the box. Claude's rule, for BVJ to confirm.
  - **Not done, and why: the per-verse word.** “Holy” still stands where
    Bibles print “saints,” and *aphiemi* can only say “forgive/leave.”
    **Measured after the fix**, against the Berean Interlinear's word for
    that Greek word in that verse: 506 of the 4,281 marks with one family
    word (11.8%) still differ, beside the 115 left to a choice. By word:
    *kakos* “bad” 45 of 46 (“evil”), *hagios* “holy” 42 of 157 (“saints”),
    *aphiemi* 40 of 146, *psuche* “soul” 36 of 80 (“life”), *hupotasso*
    “submit” 34 of 38 (“subject”), *ethnos* “Gentiles” 31 of 95
    (“nations”), *charis* 19, *kalos* 17, *paraptoma* “transgression” 17
    of 19 (“trespass”), *pistos* 14, *sozo* 14. The honest fix is a
    “traditional here” word on each alignment
    record, decided in review in groups (“holy → saints, 39 verses”), with
    BVJ's footnotes and the Berean Interlinear as suggestions. Neither can
    supply it unattended: only 15% of marks carry a “Traditionally, ‘…’”
    note, and reading them by rule goes wrong (the note on “norms” at
    1 Corinthians 15:56 yields “sin”); the Berean would put another
    translation's choice on LIT sheets under the word “traditionally.”
    Licensing, checked 2026-11-11 at the publishers' pages: the Berean
    Bible is public domain since 2023-04-30 and reaches us through MACULA
    (CC BY 4.0, already credited on the Greek tab); the World English Bible
    is public domain too, but follows the Byzantine text and prints
    “assembly” and “Good News,” so it is the wrong yardstick. Open until
    BVJ takes it up.
  - **Noticed in the entries, reported and not changed** (they are BVJ's;
    fixing one means changing its line in the list in the same change, or
    `test/term-words.test.js` fails). **Six entries' `greek` names a
    different word than their `traditional` translates, or an inflected
    form.** The list keeps each spelling on that word's own line, so a
    mark on it shows it still, and a mark on another word of the family
    now shows its own: `devil-false-accuser` “diabolon” (the accusative of
    *diabolos*), `defiled-common` “koine” (the feminine of *koinos*),
    `salvation-liberation` “soterios” beside “Salvation” (*soteria*, whose
    marks now read “salvation · soteria”), `baptism-immersion` “baptizo”
    beside “Baptism” (*baptisma*; the verb's marks now read “baptize ·
    baptizo”), `forgiveness-letting-go` “aphiemi” beside “Forgiveness”
    (*aphesis*; the verb's marks read “forgive/leave · aphiemi”), and
    `trespass-shortfall` “paraptoma” beside “Transgression.” **Headwords
    that part from what Bibles print**, which the list follows because an
    entry's word must stand on its line: *kakos* “Bad” (“evil” in 45 of
    its 46 marked verses), *paraptoma* “Transgression” (“trespass” in 17
    of 19; “transgression” is *parabasis*), *hilasmos* “Atonement”
    (“propitiation” in both of its verses), *koinos* “Defiled/Profane”
    (“unclean” or “common” in 5 of 8), *hupotasso* “Submit” (a form of
    “subject” in nearly all of its 38), *ethnos* “Gentiles” (“nation” or
    “nations” in a third),
    *psuche* “Soul” (“life” in 45%), and *katharos* “Clean” (“pure” in 9
    of 17).
  - **Open, for BDR.** Nothing under `/api/` carries the per-word data: it
    is in each chapter page's term data, and the glossary feed has only
    each entry's one `traditional`. An app that printed a sheet's hints
    would need it served first (STUDY-DESK-FORMAT.md, “blank”).
- **E86, design: the template's description looks like a message from the
  app.** BVJ (2026-11-11): “The sheet description message that can be
  dismissed should be styled so that it's clear it's not just part of the
  sheet. Right now it shares the same background as the page. Style it more
  like the picture attached,” the picture being /sheets' “what prints”
  notice. Status: **fixed 2026-11-11**: E84's description (`.desk-sheet__about`
  in `desk.css`) takes that notice's look (`.sheets-page__leaks`): a tint of
  ink at 0.05, a 3px `--green-text` rule down the left edge, rounded right
  corners and padding, the × kept at the top right inside the box. Its words
  keep their size and wording. In forced colors, where a background draws
  nothing, the box takes a `CanvasText` outline with the thicker left rule.
- **E87, design: Leader only before the minutes.** BVJ (2026-11-11): “swap
  the location of the minutes field and the Leader Only checkbox.” Status:
  **fixed 2026-11-11**: each part's header tools now read Leader only, the
  minutes field, then Move up, Move down and Remove (`cardTools` in
  `part-cards.js`), in the tab order too. The Sheets tour's “Leader only…
  and the box beside it plans its minutes” already read that way.
- **E88, design: "Add an answer key" sits in the buttons' row.** BVJ
  (2026-11-11): “the link that pops up sometimes about including an answer
  key should be in the same row as the Edit, Save, print buttons, rather
  than appearing on its own row and shifting everything down.” (It is the
  checkbox on /sheets, shown on the leader's version only.) Status: **fixed
  2026-11-11**: `keyBox` moved from the Version, Paper and QR codes row to
  the end of `.sheets-page__actions` in `sheet-page.js`, after Share… and
  before the status line, so the tab order runs from the buttons to it.
  Hidden on the participant's version it keeps its place
  (`.sheets-page__keybox[hidden]` is `visibility: hidden`, which also takes
  it out of the tab order and from screen readers), so choosing a version
  never rewraps the row or moves the paper. A phone has none of these
  choices and is unchanged. Moved again the same day by E95, under Show QR
  codes.
- **E89, design: the Sheets' fields, cards and controls stand apart from
  the page.** BVJ (2026-11-11), of the list of sheets, the template chooser
  and the editor: “Several areas have fields, cards, and controls with the
  same color as the page background. That's not good styling.” An Opus pass,
  with license to decide (“It can make the changes it thinks are best”),
  limited at first to styling in those areas. Found: in the Sheets pane every
  part, field and form was the pane's own `#FAFAF8` (dark `#1d1d1f`), so a
  part was told from the pane by a 14% hairline alone; on /sheets the fields
  matched their cards; buttons, chips and the key terms box's buttons had a
  25% ink edge (about 1.6:1) or none (the quiet ones); the template choices
  and the list's rows were bare text between rules; the title and subtitle
  were a bottom line on the page's color. Status: **built 2026-11-11**, for
  review. Three layers, each a step apart from what it sits on (`desk.css`,
  “The desk's layers”; the rule is in `src/scripts/desk/sheets/CLAUDE.md`):
  **cards** (a part, each sheet in the list, the chooser, a form) with a
  hairline, `#FAFAF8` on /sheets' cream page and, in the Sheets pane, a step
  darker than the pane, `#ecebe8` (dark `#262628`); **fields** (title,
  subtitle, a part's text, minutes, the reference, a hint) white in light and
  `#161617` in dark, a surface the rich text colors are already checked on,
  each with `--field-border`; **controls** (every sheet button but the
  primary, the key term chips, each template choice) white in light, a
  lighter step in dark, with a `--field-border` edge, since white differs
  from `#FAFAF8` by 1.04:1. Three corrections from BVJ in review: a form
  inside a part was first inset in the page's color (“Having the passage
  card share the page background isn't right”), now the card's own; the
  Sheets pane's body was first the page's cream, so both homes matched (“the
  background of the sheets pane should match the other panes”), now a
  pane's color, with the pane's cards tinted, which BVJ chose from three
  mocks in the Browser pane (tinted cards; outlines only; outlines with
  tinted fields); and BVJ asked for the same control look on a sheet's
  versions view (Present, Print, Copy, Save as, Share…) and on /desk's
  command row (“I found more controls that take the page background
  color”), so a sweep for controls drawn in the color behind them also took
  in the passage field in each pane's bar and its “Stay here” lock. Measured:
  control and field edges 3.0:1 on the cream page, 3.4:1 on a pane's card
  and 3.9:1 on a raised card or pane in light, 5.0:1 or more in dark; text
  12:1 or more on fields and controls, dimmed text 5.2:1 or more on every
  surface. The template's description and the License card keep the “what
  prints” notice's look (BVJ: “should keep their current style”). Layout
  changes made for the new edges: the list's rows are separate cards 8px
  apart; in a narrow pane “Blank the selected words” and “Fill in the
  selected words” wrap whole onto lines of their own; and “+ Key terms box”
  and its “already on the sheet” are one group in the add row (BVJ: it
  “should always be to the right or directly below the control”), the one
  markup change. Left alone on purpose: the glyph buttons (↑ ↓ × ▾ ‹ › and
  the grip), which read by their glyph; the passage's words; the Add pill;
  the paper, present mode, the Share dialog, and the phone's shared sheet
  (`desk-sheet-view.css` is unchanged: the button rule is scoped in
  `desk.css`). Forced colors couldn't be emulated in the Browser pane; every
  card, field and control now has a border, which forced colors keeps.
  One card was missed: the question shown when a sheet is already open in
  another tab (“Continue here?”), drawn only when a second tab asks, had an
  edge and no fill, so it took the page's color (BVJ, 2026-11-11, with a
  screenshot). Status: **fixed 2026-11-11**: `.desk-sheet__ask` takes the card
  layer (`--desk-card`, `--desk-card-edge`), so it is `#FAFAF8` on /sheets'
  page and the pane's card color in the Sheets pane; the layers test holds it.
  A sweep of the Sheets' stylesheets for any other box with an edge and no
  fill found only forced-colors rules and present mode's tags.
- **E90, design: present mode's start screen shows one QR code.** BVJ
  (2026-11-11), on a sheet's start screen with four codes side by side:
  “Having several QR codes right next to each is not practical. Phones
  automatically scan the first one they contact,” and, when Claude
  recommended one code for the first chapter with the others named by their
  addresses: “Yes, address all those issues.” Status: **fixed 2026-11-11**:
  `ROOM_CODES_MAX` is 1, so `roomCodes` gives the first chapter's code and
  the rest in `more`. The screen draws that code larger (8em, it was
  5.2em) under "Scan to follow along," captioned with its chapter, and the
  line of addresses beneath names every chapter, beginning “Every chapter:”
  when the sheet reads more than one (`roomAddresses`). The presenter's note
  says “code” and, for several chapters, which one it opens. The title slide
  (PowerPoint, OpenDocument and the slides' PDF, which share `slideBoxes`)
  places one larger code and sits the title a little higher to make room.
  Paper is unchanged: a printed copy keeps a code beside each chapter's
  passage. No control for showing another chapter's code was added; that
  stays an undecided later step.
- **E91, bug: ← and → don't change chapter on /desk.** BVJ (2026-11-11):
  the Display tray lists the arrows as “Previous or next chapter,” and they
  work on scripture pages, “but it doesn't actually work with the LIT pane on
  /desk.” Cause: `keyboard-shortcuts.js` stepped only by Chapter View's
  Previous/Next links or Read View's `#ch-N` headings, and /desk has
  neither. Status: **fixed 2026-11-11**: on a page with the desk on and no
  Previous/Next of its own, ← → and `[` `]` send `lit:desk-chapter`, as `/`
  sends `lit:desk-search`, so the shared file still imports nothing of the
  desk. `desk-page.js` answers by pressing the passage bar's arrow of the
  pane holding focus (a LIT pane there leads already, since working in it
  makes it lead), else the leading LIT pane's, else the first following
  pane's when no LIT pane is open, and says the new chapter (“John 4”) for a
  screen reader. Past Matthew 1 or Revelation 22 the key is taken and does
  nothing, as the bar's disabled arrow does. The keys still stand down in
  the passage field and the other controls that own them, and with the
  Keyboard switch off. The help page's /desk section names the keys.
- **E92, design and wording: the blanks row.** BVJ (2026-11-11): in the
  sheet editor, “the ‘blank the selected words’ and ‘fill in the selected
  words’ buttons should be left-justified instead of spread out across the
  row,” and the row's label “seems vague and the latter two seem
  cumbersome.” Names were proposed by Fable (asked at BVJ's suggestion) and
  BVJ chose them: “Yes, rename them.” Status: **done 2026-11-11**: the
  buttons sit together right after the label (`.desk-sheet__lit-head`,
  `justify-content: flex-start`; a narrow pane still wraps them whole, E89).
  The label is “Fill in the blank,” naming what the row makes; the buttons
  are “Blank” and “Unblank,” plain opposites with no “selected,” since
  they act on the keyboard's word cursor too and their descriptions say
  “chosen.” Every other place that used “fill in” to mean taking a blank off
  says “unblank” now (the list's ×, a blanked key term's chip, the
  announcements, the keyboard hint), so “fill in” means only what the group
  does. The empty line puts the action first and names the key terms only
  where their row is drawn. The Sheets tour, its blanks step, and the help
  page follow.
- **E93, design: the sheet toolbar's link icon.** BVJ (2026-11-11): “The
  link icon is weird. It needs to be redesigned.” It was two half-drawn
  arcs on the diagonal, which read as a squiggle at 16px. Status: **done
  2026-11-11**: two open links joined by a bar, level like the toolbar's
  list and alignment icons (`ICONS.link` in `sheet-text.js`). Chosen from
  three drawn side by side at 16px and 48px; two whole links interlocked on
  the diagonal read well large but closed into a knot at toolbar size.
- **E94, design: the commercial check asks before a sheet leaves the
  page.** BVJ (2026-11-11): “I know we decided to have the commercial
  checkbox be a warning but not block, but maybe that should change.” S7's
  check showed only in the editor's License card, and the Sheets page,
  where Print, Copy, Save as, Share, and Present are, never mentioned it,
  so a sheet marked commercial could go out past every line of it unseen.
  Claude advised against a block (the box is the reader's own word, so a
  block stops only the honest, who would untick it and lose the guidance;
  the 50% is of the whole work, which one sheet may be a part of; and
  written permission allows more) and proposed a confirmation; BVJ chose
  it (“Yes, add it”). Status: **done 2026-11-11**: on the Sheets page, a
  sheet marked “This is for a commercial project” whose check finds
  anything beyond the terms asks first, in a dialog listing those findings
  in the License card's own words (`commercialFindings` in
  `desk-sheet-lit.mjs`, which the card now reads too), with a link to
  contact the LIT and one to the terms, and “Print anyway” (or Copy, Save,
  Share, Present) beside Cancel, which has focus. A sheet within the terms,
  or not marked commercial, is never asked. Going ahead holds for the page
  view until the counts change, so printing and then copying asks once. A
  failed count goes ahead, and a shared sheet or the Sheets tour's is never
  asked. `&view=present` asks before presenting, and Cancel drops the
  parameter. Ctrl+P on the page still prints without asking (a browser
  can't hold a print it didn't start). Rules: `sheets/commercial-confirm.js`.
- **E95, design and wording: the Sheets page's toolbar and the paper's
  version label.** BVJ (2026-11-11), with a screenshot of the toolbar:
  “"Add an Answer Key" should fall directly below "Show QR codes" with the
  check boxes horizontally aligned. The Edit in Study Desk link can move to
  where "Add an Answer Key" currently sits.” Then: “on the printed sheet
  "Leader copy" reads more naturally than "Leader version". It can stay
  "Leader version" everywhere else,” and “For the printed participant
  versions, they don't need to be labeled. They are considered the default
  version,” counting the copy on the page as the printed sheet, as well as
  what is printed and presented. Status: **done 2026-11-11**: on a
  computer the bar is a two-column grid (`.sheets-page__bar--grid`): the
  choices, then the buttons with “Edit in Study Desk” after Share…, and at
  the right Show QR codes over Add an answer key, their boxes in line. The
  answer key's box still keeps its cell while hidden (E88), so choosing a
  version moves nothing, and Show QR codes keeps to the choices' first line
  if they wrap. The paper's subtitle reads from `PAPER_NAMES`
  (`desk-sheet-copy.mjs`): “Leader copy,” and nothing for the participant's,
  whose subtitle line is left out when nothing else is on it. Copy and the
  saved files read the subtitle off the paper, so they follow; present
  mode and the slides never named the version. The Version choice, the
  page's title, Copy's status and the saved files' properties keep
  `COPY_NAMES`. A phone's shared sheet keeps its layout. After the merge
  BVJ added: “Making it say "Add answer key" instead of "Add an answer
  key" would help with space”; the checkbox and the help page say so now.
  Then, of a narrowed window where the rows wrapped round the checkboxes and
  pulled them apart: “the checkbox options should stay the same position
  relative to each other,” and when the bar is narrower still the pair
  “should become one of the rows of controls,” side by side “unless, of
  course it's so narrow that they won't fit.” The two are one group now
  (`.sheets-page__checks`) beside the rows (`.sheets-page__main`, sized to
  its rows on one line), and the bar wraps it under them when both don't
  fit; then `lineUpChecks` (`sheet-page.js`, a ResizeObserver judging with
  the group beside the rows) moves it between the choices and the buttons
  (BVJ: “it shouldn't go below the buttons”), side by side, wrapping only
  where that is too narrow. “Edit in Study Desk” lost its extra left margin, which
  indented it when it wrapped to a line of its own.
- **E96, bug: checking a footnote's box scrolled the editor up to the
  passage.** BVJ (2026-11-11): “In the sheet editor, I checked a footnote
  box, and it autoscrolled up to the passage. It shouldn't do that.” A
  change to the sheet redraws the passage card, and the footnote list was
  drawn after it, once the sheet's printing blanks were worked out
  (`drawNotes`, asynchronous). So when the card gave focus back, the box
  wasn't there yet, focus fell back to “Blank” above the passage, and
  focusing it scrolled the page up; the list also stood empty for that
  moment. Status: **fixed 2026-11-11**: `render` in `sheet-lit.js` works
  out the blanks with the passage, before replacing anything, and draws the
  list in the same step (`paintNotes`), so the box is there to take focus
  back; and `restoreFocus` gives focus back to the same control with
  `preventScroll`, since it is drawn where it was (a fallback to another
  control still scrolls to it). Checked in the Browser pane: the page and
  the box stay put and keep focus.
- **E97, design: the passage card's footnotes are easy to miss.** BVJ
  (2026-11-11): “it's really easy to miss the footnotes section in the
  passage card in the sheet editor.” It was one line of small text at the
  card's foot with the browser's disclosure triangle, reading as text, not
  a control. Claude mocked it live in the Browser pane; BVJ: “Yes, build
  it.” Status: **done 2026-11-11**: the section sits under a rule, and its
  summary is a button in the control layer (E89: `--desk-control`, edged
  with `--field-border`) reading “Footnotes: 8 of 10 print” with a chevron
  that turns when it opens, as Save as's does (`.desk-sheet__notes` in
  `desk.css`). The give-away flag still shows inside it.
- **E98, design: footnote letters are hard to see.** BVJ (2026-11-11):
  “footnote markers in the text are also hard to see,” then, asked whether
  that meant the editor (which showed none) or the sheet's page: “Both.”
  Status: **done 2026-11-11**: the editor's passage text shows every
  footnote letter in the passage (`passageWords` with `keepNotes` of the
  passage's footnotes), bold in Chapter View's footnote green while the
  footnote prints and muted ink while it doesn't (`paintNotes` sets
  `.desk-sheet__fnref--off` from the same rows as the Footnotes list), as
  plain text, not links. On the sheet's page and paper a printing footnote's
  letter is upright and bold at 0.75em (it was italic at 0.65em), and the
  footnote list's labels are bold to match. Present mode keeps its own.
  Anchor text never counts a footnote letter, so blanks and the word cursor
  are unaffected.
- **E99, bug: a heading could end a page with its text on the next.** BVJ
  (2026-11-11): “it shouldn't be possible for a header to be at the bottom
  of the page with the body text it goes with at the top of the next page;
  if that's going to be the situation, then it should be pushed to the next
  page with its body text.” Two causes. The keep-together rules sat inside
  `@media print`, so the screen's pages (`sheet-pages.js`, which reads them
  from computed styles) never saw them; and nothing kept a heading in a
  part's text, or a text part that is only a heading (a template's
  “Reading”), with what follows. Status: **fixed 2026-11-11**: the rules
  are outside `@media print` (break-* does nothing on a continuous screen),
  joined by `.desk-rich` h2 and h3, and by `.sheet-copy__text--heads`,
  which `renderCopy` puts on a text part ending in a heading (past empty
  lines). `startNextPage` looks for a heading past the edge of the box the
  moving text opens (a passage's first line, a list's first item), carries a
  floated code beside it, and is used too when a block starts in the bottom
  margin. Checked in the Browser pane by sweeping a filler's height through a
  page and a half in 6px steps: no heading ended a page, where with the
  rules switched off 59 did. Paper not checked by PDF; Chrome honors the
  same `break-after: avoid`.
- **E100, design: the answer key always prints as a page of its own.** BVJ
  (2026-11-11): “Whatever it ends up displaying, it should always print as
  its own separate page.” Status: **done 2026-11-11**: `.sheet-copy__key`
  is `break-before: page` (outside `@media print`, so the screen's pages
  start it on a new page too; `placeAll` treats a computed `page` as a page
  break), it comes after the sheet's foot so the credit ends the sheet
  rather than heading the key's page, and Copy and Save as put a page break
  before it. Its rule and space above are gone. BVJ found what it showed
  “less than helpful right now. It just duplicates what is already shown in
  the blanks on the leader version, and the numbers don't correspond to
  anything obvious.” E102 settled that.
- **E101, wish: a text size for the sheet in its editor, apart from the
  Display tray.** BVJ (2026-11-11): “It should be possible to adjust the
  font size in the editor sheetwide; the text size in the page display
  controls don't do anything on the page in the sheet editor. Either they
  should work or they should be removed.” Then: “It should be a separate
  control from the page display settings,” and “The page display settings
  would affect the page text, not the sheet fields.” So two things: the
  Display tray's text size should size the editor page's own words (its
  labels, buttons and notes), which keep fixed sizes today, and a control of
  the editor's own sizes the sheet's fields (title, subtitle, the parts'
  text). Only a passage's words followed the tray. Claude's first pass
  scaled the fields with the tray, which this reversed. BVJ picked a
  mocked control (“Yes, build it”) and said the size prints (“It prints”).
  Status: **done 2026-11-11**:
  - **Text size**, a select under the subtitle (11, 12 standard, 14, 16,
    18 large print), is the sheet's own `textSize` (absent at 12; format
    doc, “The sheet's own fields”), set by `setSheetFields`, kept by
    Duplicate and Save as template, and carried by a share.
  - In the editor it scales the title, subtitle, the parts' text and a
    passage's words (`--sheet-text-scale`). On paper it scales everything
    the copy prints but the page numbers, and Copy and the .docx, .odt and
    .rtf files print at it. Present mode and the slides keep their own
    sizes.
  - The Display tray's text size reaches the rest of the /sheets page
    (`--sheet-ui`): the list, the toolbar, notices, dialogs, the editor's
    labels, buttons, menus and notes, and the presenter view. Never a
    sheet field, the paper or the room's screen. BVJ then saw the
    toolbar's buttons grow while its row of choices didn't (“nothing in
    the row above that”), so the whole page follows it now, not only the
    editor. In /desk's Sheets pane the tray changes neither, as in every
    other pane (until E109, which has every pane follow the tray).
  - Checked in the Browser pane: at the tray's largest the editor's
    controls went from 13 to 16.6px with the fields unchanged, and at 16
    points the paper's text went from 16 to 21.3px across three pages.
    The toolbar's row of choices went from 15.2 to 19.4px and the
    presenter view's title, clock and notes grew with it, while the
    paper and the room's previews stayed the same.
- **E102, design: what the answer key is for.** Following E100, BVJ: “I'm
  not sure about the key. I could see an argument for all three options.
  Ask Fable.” The three were A, answers with their verses on the leader's
  version (one glanceable page for the front of the room or a substitute,
  but still what the leader already has); B, a key for the group on the
  participant's version; and C, removing it. Fable recommended B as “the
  only option that gives someone information they do not already have”:
  someone who missed a week, self-study or homeschool use, classes that
  fill in the blanks first and check afterward, and people who couldn't
  keep up in the room. BVJ: “Yes, build B.” Status: **done 2026-11-11**:
  - “Add answer key” moved to the participant's version of the reader's
    own sheet (never a shared one), off by default and **no longer
    remembered** (`lit-sheet-answer-key` is gone, and from /privacy), so a
    key can't ride along on the next handout by accident. The label stayed
    “Add answer key”; “for the group” wrapped the toolbar at 1100px.
  - Checked, a line under the toolbar says the key prints as the last page
    and to hold it back if the group should fill in the blanks first.
  - The key page: “Answer key,” the sheet's name, then each passage's
    reference with one line per verse (“v. 35 hungry, stranger”, a real
    list; “v. 35: hungry, stranger” in Copy and the files), answers in
    reading order, no blank numbers and no hints, and the credit line at
    its foot. A sheet with no blanks gets no key.
  - Present mode, the slides and share links never carry it, and the “what
    prints” check skips it. The help page says so.
  - Checked in the Browser pane on a three-page sheet: the key drew as page
    4 with the toolbar's note, the leader's version hid the box, and the
    .docx and .odt put a page break before it with the sheet's credit in
    place and the key's last.
- **E103, rough spot: the /sheets toolbar's groups didn't read as groups.**
  BVJ (2026-11-11): “it's not immediately visually clear that Version,
  Leader version, and Participant version go together and that Paper, US
  Letter, and A4 go together… And adding more space between the buttons and
  the Edit in Study Desk link would help too.” Status: **done 2026-11-11**:
  the two groups sit 2.5rem apart and a group's own choices 0.75rem, its
  label 0.5rem from its first choice (the radio's own left margin taken
  off), and “Edit in Study Desk” is 1.25rem further from Share…. At 1100px
  the checkboxes still sit beside the rows.
- **E104, rough spot: a question's lines to write on were easy to miss in
  the editor.** BVJ (2026-11-11): the participant's version prints lines
  under a question, but “there's nothing to indicate its presence in the
  editor.” The “Lines to write on” number was there, a small field under
  the answer box. Status: **done 2026-11-11**: the question card draws the
  ruled lines under that field, as a space's card does (up to six, none at
  0), following the number as it changes.
- **E105, rough spot: the line after importing a shared sheet.** BVJ
  (2026-11-11, testing a share link in Edge): “Copied into your notebook.
  Change it here with Edit, or on the Study Desk” showed an extra space
  before the link and its period alone on a second line, and should say
  “in.” The line reused the shared-sheet banner's class, a flex row, so its
  text, link and period were three flex items. Status: **done 2026-11-11**:
  the line is `.sheets-page__shared--line`, plain text, and reads “or in
  the Study Desk,” in the announcement too.
  **This settles a rule** (BVJ, 2026-11-11: “'in' is the rule”): a reader
  works *in* the Study Desk, so every reader-facing “on the Study Desk” became
  “in”: /sheets' intro and “Open it in the Study Desk,” the sheet-from-search
  line, the Sheets tour's list and passage steps, the wording check's advice,
  the unread-passage notice and the help page's tour link. “On the Study Desk
  page” (the page), “switch on” and the desk tour's “What’s on the desk” stay.
- **E106, wish: Reading sets the text justified, with hyphenation.** BVJ
  (2026-11-11) asked what it would take for the Reading layout to have
  “fully justified text and auto-rendered hyphenation of words at line breaks
  to make the word spacing correct,” then chose all three of Claude's
  recommendations: it comes with Reading (no switch, nothing stored, so
  /privacy is unchanged); Atkinson and OpenDyslexic readers keep the ragged
  edge and whole words; and a column under about 45 characters a line stays
  left-aligned. Poetry keeps its lines.
  How: `desk-page.js`'s `draw()` stamps `data-desk-reading` on `.desk-ws`
  whenever the layout is one LIT pane (`arrangementOf`, so a reader who
  closes down to one LIT pane gets it too, as the Layout window shows Reading
  pressed; E107 narrowed this to the layout chosen as Reading), and one rule
  in `desk.css` does the rest. The floor is a
  container query on the text column, in the column's own em, so the Display
  tray's text size is counted. The browser draws the hyphens; the text is
  untouched. Known limits, told to BVJ: a browser breaks lines one at a time,
  so an occasional loose line remains; which words split is each browser's
  dictionary's call; and Chrome fetches its dictionary on first use.
  Status: **done 2026-11-12** (PR #557). Checked in headless Chrome against the built pages, since **the
  app's Browser pane has no hyphenation dictionary** and draws the justified
  text with no hyphens at all: on Romans 7 and 8, 9% of lines end in a hyphen,
  never more than two in a row, and the word gaps wider than twice a normal
  space fall from 11% (justified, no hyphens) to 5%. 1 Peter 1 and 2, with
  longer words, ran to 19% of lines and three in a row in one paragraph;
  Chrome has no cap on hyphens in a row. The limits `6 3 3` beat
  the browser's default (17% of lines, three in a row) and stricter ones
  (wider gaps for few hyphens saved); `text-wrap: pretty` did not help in
  Chrome. The reader's line holds within 3px going into Reading and out.
  Firefox and Safari are not checked.
- **E107, wish: Reading and One pane are told apart.** BVJ (2026-11-12),
  after E106: “Is there a way to differentiate reading layout and single
  pane layout for this?” Until now they were one thing: any layout of one
  LIT pane was Reading, so “One pane” over the LIT, or closing the other
  panes, also justified the text and showed Reading pressed, and a reader
  had no way to keep one plain LIT pane. Status: **done 2026-11-12**
  (PR #558): a layout carries `reading: true` only when
  the reader chose the Reading row (`readingLayout`, `desk-layout.mjs`).
  `settleActive`, which every change to the panes or their kinds ends in,
  takes the mark off a layout that is no longer one LIT pane, and every
  other Layout row takes it off too, so one LIT pane reached another way
  (One pane, closing the rest, a pane's kind changed and changed back) is
  “One pane”: left-aligned, the marks as the reader has them, and “One
  pane” pressed in the Layout window. Choosing One pane while in Reading
  leaves Reading and turns its marks back on, as any way out does. The mark
  is saved with the layout (`checkLayout` keeps it only as `true` on one LIT
  pane), so the last layout and “My default” open as Reading. The page
  needed no change, since it asks `arrangementOf`. No migration (the
  preview has one user): one LIT pane saved before this opens as One pane,
  with whatever marks Reading had turned off still off until Reading is
  chosen once more or they are switched on in Display options (since E108,
  in the LIT pane's “Show”).
- **E108, rough: the LIT text's switches were a menu inside a menu.** BVJ
  (2026-11-12): “Right now, in /desk, the display controls are in the page
  menu, including things that only affect the LIT pane, such as whether to
  show or hide chapter and verse numbers and footnote marks… I think burying
  a menu inside another menu is a surefire way to have people never use
  those options. I'd like to move the things that are only relevant to the
  LIT pane onto the pane itself.” The Display tray opens from “Study Desk ▾,”
  then “Display options” (E15, kept by E68). Status: **done 2026-11-12**
  (PR #560). What was sorted: of the
  tray's groups on /desk, only “Show” (verse numbers, footnote letters, key
  terms, My highlights) reaches the LIT pane alone; the font and theme set
  every pane, text size and line spacing also set the Greek and Book Intro
  panes, and the keyboard switch is the page's, so those stay in the tray. What was
  built: a worded “Show ▾” button at the end of every LIT pane's bar, after
  “Open on its page” (`lit-show.js`), opening one small menu of four
  checkboxes that stays open as they are pressed (in a bar under 22rem,
  a LIT pane among three or four columns, the button is an eye with the
  shared tooltip, so the passage field keeps its room); the tray on /desk has no
  “Show” group any more (`desk.astro` passes no `scriptureControls`; “My
  highlights” is no longer injected there). The first is labeled “Verse and
  chapter numbers,” Read View's label, since in the LIT pane the chapter
  headings go with the numbers (E29); Claude's choice, open to BVJ. As
  first built, the settings were unchanged: the reader's, shared by every
  LIT pane and by a chapter page's tray. The pane also holds its verse at
  the reading line when numbers or letters come or go, which the tray could
  not do on /desk, since its `keepReadingPlace` scrolls the window and not
  the pane.
  BVJ, on seeing it (2026-11-12): “That should apply to every layout,
  including Reading.” It does, since the button belongs to the LIT pane and
  a layout only says which panes there are: checked in all twelve Layout
  rows in Chrome, and in Reading “Show” opens with the four off and turns
  any of them back on without leaving Reading (a second press of Reading
  takes them off again; leaving turns back on only what Reading turned off
  and is still off). A test holds both. BVJ confirmed that reading of it
  (2026-11-12: “You understood my request about the Reading layout
  correctly. Keep it”): Reading goes on turning its marks off by itself.
  BVJ again, the same day: “Different LIT panes open at the same time
  should be able to have different settings active simultaneously.” **So
  the four switches are each pane's own.** A LIT pane's record in the
  layout lists the marks it hides (`hide`; `src/lib/desk-lit-marks.mjs` is
  the table, `setPaneMark` the change), so they are kept in
  `lit-desk-layout` with the last layout and “My default,” travel with the
  pane through every rearrangement, and go when the pane shows another
  kind; a new LIT pane shows all four. The pane stamps them on its own
  element (`.desk-lit[data-vn="off"]` and the rest; `lit-marks.js`), which
  `desk.css` reads; key terms ask the pane (`attachTermLens`'s `off`), and
  highlights and the verse numbers' names are drawn pane by pane
  (`highlightsShownIn`). Chapter View's switches on `<html>` are the
  chapter pages' alone now: a pane's text carries `data-own-marks`, which
  `global.css`'s four rules leave out, so the desk neither follows them nor
  changes them. Reading works on its own pane: `readingLayout` turns that
  pane's four off and lists the ones it turned off on the pane
  (`readingHid`), and `settleActive` turns those back on when Reading ends,
  whatever ends it. `reading-display.js` is gone, and Undo is the layout as
  it was. “Hide my
  marks” (H) still hides highlights in every pane; while it does, checking
  “My highlights” in a pane's Show brings highlights back, the
  most-recent-action rule of `note-settings.js`. Claude's choices, open to
  BVJ: a new LIT pane starts with everything showing (not copying the
  chapter pages' settings or a neighboring pane's), “Reset to the original
  layout” shows everything again, and the button is named “Show in this
  pane.” A layout saved before this has no `hide`, so its panes show
  everything. One cleanup, since Chapter View's switches are the live
  site's: a Reading left on from before had turned those off and listed
  them under `lit-desk-reading-off`, so the page reads that list once, turns
  them back on for the chapter pages and removes the key (`undoOldReading`;
  /privacy names it as read once), and `checkLayout` opens that saved
  Reading with its pane's four off, as it looked. Checked in Chrome with two
  LIT panes on Romans 8: different marks side by side, a highlight drawn in
  one and not the other, a key term's card in one only, the verse held as a
  switch flips, Reading and back, and a reload. Left
  for BVJ to weigh: four small toggles laid out on the bar itself (no
  click to see them) were considered and not built, since they crowd the
  passage field in a narrow pane and put four more marks above the text.
- **E109, bug: the text size reached some panes and not others.** BVJ
  (2026-11-12): “Changing the font size in the page's display settings on
  /desk affects some panes but not all, and I think the This verse pane it
  only affects some of the sections.” Measured in the Browser pane, Medium
  against Extra large: the LIT's and a Book Intro's text grew, and the
  Greek pane's words and apparatus notes; in This verse only the verse's
  Greek line did, its English, footnotes, and Go deeper staying put; My
  Notes, Footnotes, Search, and Sheets did not change at all, nor any
  pane's bar. The panes' styles set their sizes in rem, and only the
  reading text multiplied by the tray's scale (what E101 and E108 recorded
  as “as in every other pane” was this, not a decision).
  Status: **fixed 2026-11-12** (PR #561): on /desk every pane follows the tray, as
  the whole /sheets page does (E101): each pane's words, its bar and menus,
  the command row, the Layout and Print windows, and the undo bar. Every
  size `desk.css` and `desk-search.css` set in rem multiplies by
  `--desk-ui`, which is the tray's scale on the desk page and unset
  elsewhere, and a test fails on a size that doesn't. In the Sheets pane the
  pane's own words follow and the sheet's fields keep the sheet's Text size,
  a passage's words included. Checked at all four sizes in every pane kind:
  each pane's text steps 16 : 18 : 20 : 23 together, once (the LIT's text is
  not scaled twice), with nothing outside its pane at four columns of 286px
  in Inter and OpenDyslexic at Extra large.
  Claude's choices, open to BVJ: the bars, menus, and command row grow with
  the words, since on /sheets BVJ wanted the toolbar's rows to grow
  together; and the verse menu, the selection panel, and the note editor
  that opens from them keep the site's size, since they are the same panels
  as on a chapter page, where the tray has never sized them.
  Noticed then, and put to BVJ: **line spacing** reached only the LIT's
  and a Book Intro's text (not the Greek, which E108's note and the help
  page's “for every pane” said it did); and **the Notebook panel beside a
  chapter** had the same split (its Greek words followed the tray, the
  rest didn't), which was Audit 2's question 4, never answered. BVJ, the
  same day: “Fix the line spacing and notebook panel.” **Done 2026-11-12**:
  - **Line spacing reaches every pane.** “Roomy” adds its quarter line to
    every block of running text (`--desk-leading`, added to each line
    height of 1.4 or more in `desk.css` and `desk-search.css`): the verse
    and its footnotes in This verse, the Footnotes list, the Greek text,
    its apparatus and a word's entry, My Notes' rows, search results, and
    the Sheets pane's own notes. Titles, one-line labels, and buttons keep
    their line, and a pane's header and passage bar keep their height. A
    sheet's fields keep the sheet's own spacing, as they keep its size.
  - **The Notebook panel follows both**, text size and line spacing, in all
    four of its tabs, wherever the panel shows. It sets the two variables
    on itself, so nothing else on a chapter page changes: the margin notes'
    small buttons, the minimized tab, the undo bar, and the verse menu keep
    their sizes, and so does `/notebook`.
  - **Two things the larger words broke, fixed with it.** The panel is 280
    to 440px wide whatever the text size, and its header could not hold
    “Notebook,” the PREVIEW badge, and its two buttons at Extra large (or,
    in OpenDyslexic, at any size in a 280px panel, where the minimize
    button already sat 39px outside the panel before this change). The
    name and badge now share one clipped row, so the badge drops out
    whole and the buttons stay. And a pill of choices (Handwriting /
    Plain, the lexicon switch, My Notes' scope) stacks its choices where a
    line can't hold them, instead of clipping the last.
  Checked in the Browser pane: Normal against Roomy in every pane kind
  (each block of text 0.25 roomier, the bars' heights unchanged); the
  panel's four tabs in Inter at Medium and Extra large at its own width,
  and at 280px in Inter and Atkinson at Extra large and in OpenDyslexic at
  Medium and Extra large (the two buttons always 13px inside its edge,
  nothing clipped in any tab); and four 286px panes at a time at Extra
  large and Roomy in Inter and OpenDyslexic (every kind but Book Intro).
  Left as it was, for BVJ to weigh: the tray's line spacing does not reach
  the /sheets page (its text size does, E101), and the Notebook's
  minimized tab at the window's edge keeps its size.
- **E110, wish: the tray's size and spacing reach the desk's other pages.**
  BVJ (2026-11-12), after E109, asked which pages and pieces of pages still
  ignored the Display tray's text size and line spacing, “for people's
  personal preferences and for A11y accessibility,” then: “Follow all your
  recommendations. For things on pages that are public now, make the changes
  visible now. For things only visible with the preview gate on, make the
  changes behind the preview gate.” The public half (every page of running
  text, the footnote popover, a gentler scale for a few controls) is
  recorded in `src/styles/CLAUDE.md`, the Display tray's rule 1. The desk's
  half, all behind the gate:
  - **`/notebook` follows both**, as /sheets and the panes do: it sets
    `--desk-ui` and `--desk-leading` on `.notebook-page` under
    `html[data-desk]`, with the size on the column so a line keeps its
    length. This reverses E109's “and so does `/notebook`.”
  - **`/desk/help` follows both** with the preview on (`--help-scale`,
    `--help-leading`); without it the page reads as it did.
  - **The rows the desk adds to /search's results follow** with the
    results, which now follow for everyone (`.search-page` sets the two
    variables in `desk-search.css`); the search tray and the Commands
    window are controls and keep their size.
  - **The rows the desk adds to a shared panel take that panel's scale**
    (`--panel-scale`): the verse menu, the selection panel, and the note
    editor that opens from them take the controls' gentler scale (their own
    size up to Medium, the Large step at Large and Extra large), and a
    footnote's popover takes the reader's size and spacing. This replaces
    E109's “keep the site's size,” now that the site sizes them.
  - **Found and fixed: the glossary's entries took the size twice** with
    the desk on (29px for 23 at Extra large, 14 for 16 at Small), because
    the entries' `.wrap` sits inside the hero's and both matched the rule
    that scales the column. The hero was right, so the page looked right
    at the top.
  Status: **done 2026-11-12**. Checked in the Browser pane at Medium against
  Extra large and Normal against Roomy: every block of text on /notebook and
  /desk/help follows once (1.28, never 1.63), nothing leaves the window at
  1024 and 1280px in Inter, Atkinson and OpenDyslexic, and /desk/help is
  unchanged with the gate off. Left as they were: margin notes' buttons and
  the minimized tab.

**BVJ's pass of 2026-11-12** (E111 to E130; from a Word document of BVJ's
with seven screenshots, logged in its order, plus three items BVJ added in
chat the same day: the search bar's Read View jump, folded into E114, the
help page, E125, and a look for the panes' buttons, E126; E127 came from
a question in chat, and E128 to E130 came in chat during wave 2.
Wave 1 is #563 to #567; wave 2's first group is #569 to #571.
Where the code answers a question, the entry
says so; where BVJ was wondering, nothing is decided.)

- **E111, rough: Share image's questions open where Share was.** BVJ
  (2026-11-12), of the verse menu: “Share > share image” is in a flyout, “but
  when clicked, the next options are where ‘Share’ used to be. Move it to
  where ‘share image’ is, and give ‘share image’ an ellipsis to indicate that
  it’s going to open options.” Today choosing Share image closes the flyout
  and the image questions (Ink or Paper, then Square or Story) take the Share
  row's place (`actionRows` in `chapter-tools.js`), which E39 chose “so the
  panel keeps its height”; this reverses that part of E39. It is every
  reader's verse menu and selection panel, opened by a mouse or the keyboard
  (a finger's chips have no flyout). The one-name rule
  (`src/scripts/CLAUDE.md`, “One set of actions, two ways in”) would put the
  ellipsis on the chips too, so E39's chip widths need measuring again:
  OpenDyslexic had 6px to spare in the selection panel. Keep NB3-2's failure
  path (Share text… comes back with the reason) and focus on a keyboard
  press. Built in wave 1: “Share image…” everywhere, its questions in the
  flyout where it was; in OpenDyslexic it takes a line of its own in a
  narrow selection panel, within the two-button rule (BVJ, 2026-11-12:
  fine). Status: fixed (#565).
- **E112, design: the verse menu's order.** BVJ (2026-11-12): Copy text,
  Share, Highlight, Add a note, Add bookmark, Add to sheet, Print, Show in
  Notebook. Today, under “My Notebook” (`desk/actions.js`): Add a note and
  Add bookmark (one row of halves), the Bookmark box, Print ▸, Add to sheet
  ▸, Highlight, then Show in Notebook. So Highlight moves up to lead the My
  Notebook rows, and Add to sheet moves ahead of Print. This settles E78's
  order for the rows after Copy text and Share; E78's “More” row is still
  not taken up. The same order applies where fewer rows show: Read View
  (Highlight, then Bookmark), /desk's LIT pane (Highlight, Add a note,
  Bookmark), and a finger's chips. The notebook tour's steps and the help
  page name these rows; check them. The notebook tour's sentence lists the
  new order. Status: fixed (#564).
- **E113, wish: a reminder that reminds.** BVJ (2026-11-12), of the
  Notebook's foot (“Remind me to save a copy,” then “It’s been 8 days since
  you saved a copy. Save a copy”): “I wouldn’t call what this does currently
  ‘reminding.’ It’s keeping a running count of the number of days since
  saved.” BVJ's range, most to least insistent: a pop-up or a browser
  notification, a banner, or a dot on the tab saying a message is waiting,
  appearing seven days after the last copy (`REMIND_AFTER_DAYS` is already
  7), “and the design could be a little more urgent.” Today the line in the
  foot is the only sign (`first-use.js`; `reminderDue` and `reminderText` in
  `desk-first-use.mjs`): a reader sees it only by opening the Notebook and
  scrolling to its foot, and never on /desk, which has no panel. What exists
  to build on: E74's dot (`data-desk-nudge` on the Notebook's tab and
  toggles, cleared once the Notebook opens) and the undo bar's offer line. A
  browser notification would need the browser's permission and would add
  nothing while the page is open; not recommended. **BVJ** (2026-11-12):
  “Let's talk design when we come to it. I think the dot, yes. The line in
  the undo bar vs. something on the settings tab is worth mocking up.” So
  the dot is in, and two mocks come before anything is built: a line in the
  undo bar, and something more noticeable on the Notebook's Settings tab,
  whose “Keep and print” group already holds the reminder's checkbox and
  today's line (the old foot, moved there in E75). Also for that talk: where the dot
  goes on /desk, which has no Notebook tab (the title menu's My Notebook is
  one candidate), and whether /notebook needs anything, since saving a copy
  is on that page. Status: open, design talk and mocks first.
- **E114, wish: ways straight into the Reading layout from outside the
  desk.** BVJ (2026-11-12): “I wonder if there’s a reasonable place(s) to
  link directly to the Reading layout from anywhere outside the Study Desk.”
  Then, in chat the same day: the search bar “still offers a jump to read
  view when a scripture reference is entered. For the preview (not public),
  that can direct to the Reading layout on the desk instead.” That jump is
  in two places, both from `makeReadReferenceHref` and `makeReadBookHref` in
  `search-core.js`: the tray's second jump link (“in Read View, whole book”)
  with Shift+Enter (`searchbar.js`), and /search's “Read View, whole book”
  (`search.js`). Other candidates, each a way into Read View today: /read's
  card and the chapter picker's footer link (both already lead to the Study
  Desk with the preview on), and at launch 8c's redirects of old Read View
  addresses. **This needs a decision first**: a link to /desk never forces
  an arrangement, Reading included (E8; BVJ, 2026-11-02; `arrivalLayout`), so
  such a link needs a new parameter (say `/desk/?place=john-3:16&layout=reading`)
  and a rule for what it does to the reader's saved layout. Shared reader
  code may read `deskEnabled()` but never imports desk code, so the search's
  address is written out in `search-core.js`, as `ScriptureLayout.astro`
  writes its pill's. **Decided** (BVJ, 2026-11-12, taking Claude's
  recommendation): “The link to the Reading layout is good. It would open
  the desk with that layout active. Other desk links only navigate to /desk
  or do so while also selecting the appropriate passage to show in the LIT
  pane.” So:
  - **Reading links are the ones that stood for Read View**, with the
    preview on: the tray's second jump link and Shift+Enter, /search's
    “Read View, whole book,” and the chapter picker's footer link
    (`ReadMenu.astro`, “Open X in Study Desk →” today, which opens the
    desk at chapter 1 as it is). Each opens /desk in Reading at its passage
    (a book alone at chapter 1). Without the preview they stay Read View.
  - **Every other link into /desk keeps E8's rule**: plain `/desk/`, or
    `?place=` moving the LIT pane and keeping the reader's arrangement
    (the toolbar's pill, the header's Study group, the Notebook's header
    link, /read's card).
  - **Arriving in Reading is choosing the Reading row**: it becomes the
    last layout, as any change does, with Reading's marks turned off and
    given back on the way out (`readingHid`); “My default” is untouched.
  - **At launch** (“Launching”, item 11), these links are the Read View
    jump's successors where the desk runs; the item gains that line.
  Status: fixed (#570; the tray says “in Study Desk, Reading layout,”
  /search “Study Desk, Reading layout”).
- **E115, wish: the Search pane links to /search before anything is
  typed.** BVJ (2026-11-12): a link like “See results on the search page”
  should show in the Search pane before a search is typed, worded
  differently since there are no results yet. Today it shows only while
  there is a search (`showPageLink`, `search-pane.js`). Proposed: “Open the
  search page” until a search is typed. Status: fixed (#563).
- **E116, rough: /search's checks and its sheet button are too subtle.**
  BVJ (2026-11-12), of Keyword matches with the desk on: “The controls here
  are too subtle. I forgot what the check boxes were for, and it took me a
  while to figure it out (and I’m the developer!).” Only the “4 verses
  checked.” line ties the boxes to “Make a sheet of these verses.” BVJ
  suggests a redesigned button might do it, after the recent pass on such
  controls (E89's control look, which reached /desk's command row). The bar
  and the boxes are `sheets/search-sheet.js`, styled in `desk-search.css`.
  Design, mock first. **Decided** (BVJ, 2026-11-12, from Opus's mocks,
  option A “mostly as recommended”): the bar becomes the list's head row, a
  select-all box in the column of the verses' boxes beside one primary
  button whose label carries the count (“Add 4 verses to a sheet…”); checked
  results and the row share a green rule, and the row stays at the top of
  the window while the group is on screen. **BVJ's one change: nothing
  checked adds nothing.** “With no boxes checked, 0 results should be added
  (and the button can be disabled). If the box next to the head row message
  and button is checked, then it selects all.” So the button is disabled
  (`aria-disabled`, with its reason) until a box is checked, the head row's
  box is the way to take every verse (“Add all 119 verses to a sheet…”),
  and the line beside it says so instead of “leave them unchecked to take
  all 119.” This reverses today's “With none checked, all 119 results go on
  the sheet.” Status: open, decided; built with E126 and E117.
- **E117, wish: search results to a sheet from the Search pane.** BVJ
  (2026-11-12): “I think it should be possible to send search results to a
  sheet from the search pane.” **The pane already offers it**: “Make a sheet
  of these verses” at the head of its verse results (every verse found), and,
  while a Sheets pane shows a sheet, “Add these verses to ‘…’” and a + on each
  verse (`verseGroup` in `search-pane.js`; M5). It is a quiet button in the
  results' bar, so it may be E116's trouble again. **BVJ found it**
  (2026-11-12, with a screenshot of “Bible order” and “Make a sheet of these
  verses” on one line, “Add these verses to ‘Untitled sheet’” on the next):
  “It needs a little design help. Placement mostly. I do wonder about making
  buttons in the pane styled a little differently than this. The solution
  may or may not be to change the color. It could be to add a little
  texturing/shadow/animation, or something to it.” Then: “I had missed it,
  but I think checkboxes are worth adding too.” So the work is three
  things: where the sheet buttons sit in the pane (apart from the sort,
  which is not about sheets); a check on each verse, as on /search, so a
  sheet can take some of the verses found, with whatever E116 settles for
  tying the checks to the button (the pane already has a + per verse while
  a Sheets pane shows a sheet, so the mock shows how the two sit together);
  and a look for the pane's buttons that reads as pressable, color being
  only one way, which BVJ widened to every pane's buttons (E126). Designed
  with E116 and E126, mocks first. **Decided** (BVJ, 2026-11-12, option A,
  “same as E116”): “Bible order” moves to the group's title line; under it a
  strip in the pane's card color holds a select-all box, a count line and the
  buttons, “Add 3 verses to ‘X’” (primary) with “New sheet of 3 verses”
  beside it while a Sheets pane shows a sheet, “New sheet of 3 verses”
  alone otherwise; no button wraps inside, a long sheet name ends in “…”,
  and the strip stays at the top of the results. Every verse gets a box and
  the + stays for one verse. As in E116, **nothing checked adds nothing**:
  the buttons are disabled until a box is checked, and the strip's box
  selects all. “New sheet of N verses” opens a Sheets pane, so it follows
  E127's rule on a full desk. Status: open, decided; built with E126 and
  E116, after E127.
- **E118, design: no “Open all” or “Close all” in My Notes.** BVJ
  (2026-11-12): “I don’t think we need the Close all/open all control. Having
  them collapsed and require manual expansion one at a time is sufficient.”
  It is `allButton` in `tab-mine.js` (the Notebook's tab and the /desk pane),
  with the `listFull` setting, `lit-desk-list`, named in /privacy. A pinned
  footnote has no caret of its own (only “Open all” showed one whole), so it
  needs one, and on /notebook a pin is cut at three lines the same way
  (`record-rows.js`). The key retires with its /privacy line, with no
  migration (the preview has one user). Status: fixed (#566).
- **E119, wish: the My Notes pane chooses this chapter or everything.** BVJ
  (2026-11-12), with a screenshot of the pane on Matthew 2: a toggle “like on
  the My notes tab of the notebook that toggles between displaying the
  current chapter and everything that’s been saved.” The Notebook's tab has
  it on a Chapter View chapter (`scope`, passed by `panel.js`); the pane is
  built without one, so it lists everything and follows the LIT pane (E22).
  In the pane, “this chapter” would be the leading LIT pane's and would
  change as it moves. Built in wave 1 with the tab's “This chapter” and
  “Everything” (BVJ, 2026-11-12: fine). Status: fixed (#566).
- **E120, bug: the Book Intro pane leaves out the Matthew introduction's
  chart.** BVJ (2026-11-12): /matthew-intro shows it, after “The following
  chart shows the mirrored passages and pivotal section.” and before “Visit
  this article to read more about the central passage in Matthew 15:1–28.”;
  the pane goes from one to the other with nothing between. The chart is an
  `<img>` in a `<figure>` (`src/data/intros/matthew-intro.md`, the only
  intro with one), and `makeInert` (`desk-inert.mjs`, SEC3-2) removes every
  `img` from a fetched page, and the figure's inline style with it. Fix:
  keep an `img` whose `src` is the site's own (a path under `/images/`,
  nothing else) with its `alt`, and size it in the pane's CSS as the page
  does; a narrow change to a security rule, with its test. Status: fixed
  (#569).
- **E121, rough: “New sheet” stays while the templates are open.** BVJ
  (2026-11-12), in the Sheets pane: pressing “New sheet” shows the
  templates, but the button keeps its name. It already cancels, so while
  they are open it should say “Cancel” and change from the primary green to
  white (the control look). `my-sheets.js` (`fresh`); check /sheets' “New
  sheet…” for the same. Built in wave 1, /sheets' button included, since it
  shares the chooser (BVJ, 2026-11-12: fine). Status: fixed (#564).
- **E122, wording and design: the Share dialog.** BVJ (2026-11-12), with a
  screenshot: “The copy here is attempting to be clear by being thorough, but
  it’s actually hard to follow. And the ‘What to share’ options are
  misleading. That’s what it displays before importing, but after importing,
  the person has access to all of it. And it was written before Answer Key
  became attached to participant version instead of leader version.” The
  options are “The participant’s version, without answers or Leader only
  parts” and “Everything, for another leader” (`sheet-page.js`). As read
  here: the choice names a version, which is what the link shows before it
  is imported, but once imported the recipient has an editable sheet holding
  everything the link carried. **That is true of the answer key**: the key is
  built from each passage's blanks (`answerKeyGroups`,
  `desk-sheet-leaks.mjs`), and every share, a participant's included, keeps
  the blanks whole with their words (`sharedSheet` in `desk-sheet-share.mjs`
  empties only a question's typed answer). So a participant link shows no
  key (E102: share links never carry it), but once imported the sheet is the
  recipient's own and “Add answer key” prints it. The blanked words are the
  LIT's own text in any case, so nothing can keep them secret; the question
  is what the link offers and what the dialog promises.
  **BVJ's direction** (2026-11-12, inclined, not yet decided): “I'm inclined
  to let the sharer decide whether to include the answer key. It's already
  partly there with the checkbox to ‘Add Answer Key.’ Maybe that's the main
  thing that decides it, and there can be a ‘you're including the answer
  key’ message that pops up and asks if they want to continue.” To work out
  in the design: a link shared with the box checked carries the key and
  shows it to the recipient (reversing E102's “share links never carry it”);
  the box is per page view and never remembered (E102), so the dialog reads
  it at the moment of sharing, and where the box is hidden (Share… pressed on
  the leader's version; the dialog is /sheets' alone) the dialog needs its
  own way to say yes; the
  question comes before the link exists, since the dialog draws its QR code
  at once, and also before a phone's “Share…” forwards a participant link;
  and whether a link shared without the key drops the blanks' words (they
  stay findable in the LIT) or only leaves the key unshown. The format is in
  STUDY-DESK-FORMAT.md, “Sharing a sheet,” which BDR's Claude reads.
  **Decided** (BVJ, 2026-11-12, approving Fable's mocks): the commercial
  check stays first, in its own dialog; the Share dialog offers “The
  participant's version” (the default) with an “Include the answer key” box
  under it, or “The leader's version” (renamed from “Everything, for another
  leader”), and a tinted “Sends: …” line says what goes out. **No opening
  question**: BVJ asked whether it could go, since the box in the dialog
  already makes the choice, so the box always starts unchecked and never
  inherits the page's “Add answer key” (the mocks' “simpler alternative”).
  A participant link with the box checked carries `answerKey: true`, a
  display instruction (the key shows as the shared view's last page and
  prints with it), which reverses E102's “share links never carry it” for
  that case alone; a receiver never stores it. **No lock after importing**:
  the blanks' words are the LIT's own and must stay in the data, so the
  no-key state says once that anyone who imports the sheet can add the key.
  The copy cuts stand (the email line, the phone-or-computer aside, “The
  passages are read from the LIT…”, the long-link reason in “Link copied”).
  BDR gets the field's row in STUDY-DESK-FORMAT.md, with the two stale
  lines there fixed. **Copy link stays the primary button** (BVJ,
  2026-11-12, asked whether the .md file should lead): the default
  recipient often reads on a phone, where a link opens and a file can't,
  and the dialog's QR code is the link; a link over 4,000 characters
  already adds that a file is safer. Status: fixed (#571, built by Fable).
- **E123, bug: “Matthew intro” doesn't reach Matthew's introduction.** BVJ
  (2026-11-12): searching “Matthew Intro” or “Matthew Introduction” doesn't
  take the reader to the introduction; only “Matthew” does. Public search.
  `parseReferenceJump` (`search-core.js`) knows a reference or a book alone;
  only the 404 page's `resolveMistypedPath` reads “intro” and
  “introduction.” The tray, /search and the Search pane share the parser.
  Built in wave 1: the tray and /search offer “Go to Matthew introduction”
  alone, with no Read View link, and the desk's Search pane opens it in a
  Book Intro pane (BVJ, 2026-11-12: fine). Status: fixed (#563).
- **E124, rough: the Notebook panel shows on pages it does nothing for.**
  BVJ (2026-11-12): “We had added the notebook panel to Article pages, book
  intro pages, and /glossary when we thought we were going to allow adding
  notes on those pages, but now the panel doesn’t actually interact with
  those pages at all. It shouldn’t be displayed there.” They are entries in
  `READING_SURFACES` (`desk-frame.js`), and with N11 switched off
  (`PROSE_NOTES`, rule 8) the panel there lists everything and offers
  nothing about the page. Taking them out reaches the pre-paint script's
  stamps and `firstPaint`, the 52 measure on those pages (rule 4), the
  `:has()` rule in `global.css` and `test/desk-frame.test.js`, and the first
  stage (the glossary's heading fit). To decide while building: whether the
  glossary keeps its reading-page look and intros their 52 measure without a
  panel, and how version 2's N11 brings the panel back. The intro's “Study
  Desk” pill stays. Built in wave 1: intros, articles and the glossary wait
  in `ALL_SURFACES` behind `PROSE_NOTES`, so N11 brings all three back
  together; they keep the 52 measure, and the glossary its reading look
  (BVJ, 2026-11-12: fine). Status: fixed (#567).
- **E125, design and wording: the help page needs an overhaul.** BVJ
  (2026-11-12, in chat): /desk/help “needs an overhaul both in the copy
  wording as well as design and useability.” Today it is one long page of
  sixteen sections with no contents (`src/pages/desk/help.astro`,
  `pages/desk-help.css`). The desk links into it by anchor (`HELP_HREF`,
  `WAYS_HREF` and others), so those keep working, and every feature keeps
  its sentence (the Routes table's rule). Best done after E111 to E126 are
  built, so it describes them as they are. **Built for BVJ's review**
  (2026-11-13, branch `claude/e125-help`, not yet approved): eight parts in
  the order a reader meets them (Getting started, Marking what you read, The
  Study Desk page, Sheets, The Greek, Search and commands, Keeping your
  notebook, Send feedback), each a few topics under task-shaped headings; a
  contents list of the parts and topics, beside the text and in view while
  it scrolls on a wide window, above it on a narrow one with “Back to
  contents” after each part; shorter paragraphs and lists; no script and no
  folded text. All sixteen old ids are kept on the headings that hold their
  topics. Copy brought up to date: the verse menu's order (E112), This
  chapter and Everything (E119), the caret (E118), the panel's pages and
  “>tour” (E124), the Reading links (E114), “Matthew intro” (E123), the
  Search pane's link (E115), checked verses (E116, E117), “Cancel” (E121),
  and the rule for a full desk (E127). Status: built, awaiting BVJ.
- **E126, design: a look for every button on the panes.** BVJ (2026-11-12),
  widening E117's question about the Search pane's buttons: “That would apply
  to all buttons on panes. There are some (like ‘New Sheet’) that a different
  color is for sure warranted, but I’m not sure about all of them.” What
  E117's screenshot shows is already E89's control look (white, a 3:1 edge),
  so the question is what more a pane's button needs to read as pressable
  (texture, a shadow, motion, or color) and which few earn the primary color.
  The work: list the buttons in every pane kind (the LIT pane's bar, My
  Notes, This verse, Greek, Footnotes, Book Intro, Sheets, Search), sort them
  into a small hierarchy (primary, ordinary, quiet; E89 left the glyph
  buttons alone, since they read by their glyph), and mock it for BVJ in a
  real pane in light and dark. My Notes, This verse and Greek are the
  Notebook panel's own modules (rule 18), so a change there reaches the panel
  too; say in the mock whether the panel follows. Any motion stops under
  `prefers-reduced-motion`, and a shadow needs its dark-mode pair. E117's
  placement goes into the same pass, and the hierarchy decides the look
  E121's Cancel ends with (E121 ships first with today's classes).
  **Decided** (BVJ, 2026-11-12, “as recommended,” from Opus's mocks): four
  kinds of button, one look each.
  - **Primary**: Deep Green, at most one per pane or view (the Sheets
    pane's New sheet, Add, Continue, the main button of E116's row and
    E117's strip, /search's chooser's New sheet). The command row stays all
    ordinary, its New sheet… included, and Delete stays ordinary.
  - **Ordinary**: E89's fill and 3:1 edge everywhere, replacing the older
    outline that My Notes, This verse, Greek, Book Intro and the Search pane
    still use (1.6 to 2.2:1, under 3:1), in the **Raised** look: a soft
    shadow at rest, a 1px lift on hover, sunk when pressed. A toggle that is
    on and a menu button whose menu is open stay sunk, with a text-green
    edge and words. Under reduced motion the lift goes and the shadows stay.
    E121's Cancel is simply one of these.
  - **Toggle**: Pin, label chips, Show sources, the Greek's word choices,
    Bible order.
  - **Quiet**: links (Labels…, Stop following, Verse N, Show the note, the
    Sheets tour, Clear checks). Glyph buttons are unchanged.
  Raised was chosen over Gradient (nearly gone in dark) and Tonal (green on
  every button, which then no longer means primary or on). The build also
  gives Deep Green a dark-theme edge of the text green at 70%, since the fill
  alone is 2.3 to 2.9:1 on the dark surfaces, and needs a disabled primary
  for E116 and E117. `desk-search.css` takes the same tokens, since /search
  doesn't load `desk.css`. The Notebook panel follows with no work of its
  own (rule 18). Status: open, decided; built with E116 and E117.
- **E127, design: one rule for a pane the desk opens when four are open.**
  BVJ (2026-11-12, in chat), asking what happens when something opens a pane
  by itself and the desk already has four: “It seems like it should be
  consistent: give a link to the appropriate page (/sheets, /matthew-intro,
  /search, etc.) in all of them or change the last non-LIT pane in all of
  them, or open a dialogue giving the user a choice in all of them.” Today
  each does its own thing (`desk-page.js`, `desk-layout.mjs`):
  - **A Sheets pane** (the Search pane's “Make a sheet of these verses,”
    `/desk/?sheet=` from /sheets' “Open it in the Study Desk”) takes over
    the last pane that isn't a LIT pane, never the Search pane it came from
    (`showSheet`, BA60), without a word.
  - **A Book Intro pane** (an intro result, `/desk/?intro=` from an intro's
    pill) opens nothing and says “There's no room for a Book Intro pane.
    Close a pane, or open the introduction on its page.”
    (`showIntroIn`, `introMoveMessage`).
  - **A LIT pane** for a passage result, when none is open, opens nothing,
    moves the panes that follow, and says “There's no room for a LIT pane to
    show …” (`openLitBeside`, `passageMoveMessage`).
  - **A Greek pane** for a Greek result opens nothing and says “Open a Greek
    pane to see the word.” to a screen reader only; the LIT pane still moves
    (`openGreekHit`).
  - **A Search pane** from `/` says “Close a pane to open search.” to a
    screen reader only.
  - **New sheet…** and **Add pane** are commands, not openings: disabled
    with “Four is the most” beside them.
  **Decided** (BVJ, 2026-11-12, taking Claude's recommendation, the second
  of the three, “with one more piece”): every one of them follows the
  sheet's rule.
  - **A pane of that kind already open is used**, as today.
  - **Otherwise the new pane takes the place of the last pane that isn't a
    LIT pane**, never the pane the request came from (the Search pane) and
    never one set to “Stay here.”
  - **The undo bar says what it replaced, with Undo** (“Book Intro shown in
    place of Greek.”), which puts the layout back.
  - **Where no pane can give its place** (the rest are LIT panes, set to
    “Stay here,” or the one asking), the message says why and offers both
    ways on: close a pane and try again, or open it on its page, with the
    link. BVJ: “it should explain why and say the user can close a pane and
    try again OR simply navigate to the page. Not just navigate to the
    page.” Said where everyone sees it, not to a screen reader alone.
  A link back to the page alone was set aside because a link into the desk
  (`?intro=`, `?sheet=`) would send the reader back where they came from;
  a dialog, because it stops the reader at the moment they asked to see
  something. New sheet… and Add pane stay commands, disabled as today. The
  help page gets the rule's sentence (E125). Status: open, decided; built
  after wave 1, which touches `desk-search-pane.mjs`, and before E117's
  strip, whose “New sheet of N verses” opens a Sheets pane.
- **E128, rough: notice bands on /sheets stop partway across their row.**
  BVJ (2026-11-12, in chat): “The notice bands on /sheets (and elsewhere I
  think) that only span part of the row look like a mistake. Have the
  shading extend fully.” Four of the page's tinted bands with the green
  rule are capped at 60 characters (`max-width: calc(60 * var(--ch))` in
  `pages/sheets-page.css`), while the toolbar and the paper they sit
  between run wider: “Checked before printing” (`.sheets-page__check`), the
  “what prints” notice and the answer key's note (`.sheets-page__leaks`,
  `.sheets-page__key-note`), and “Shared with you” (`.sheets-page__shared`).
  The template description in the editor (`.desk-sheet__about`, E86)
  already fills its row. **BVJ's direction**: the tint fills the row.
  Claude's proposal, for the build: the words inside may keep a
  60-character line, set on the text rather than the band. Look for the
  same shape on /desk, /notebook and /search while there (a tinted notice
  narrower than the row it sits in). Status: open.
- **E129, design: a sheet card's instructions look like the sheet's own
  text.** BVJ (2026-11-12, in chat): “The instructions in the sheets editor
  cards should be visually distinguished from the other text. Right now it
  looks the same, without even a line separating them or difference in
  font.” A template's parts carry prompts, never text (SH5-2, SH5-4;
  `sheets/CLAUDE.md`, rule 21), drawn three ways, all in ink at 0.7:
  - an empty part's prompt as its placeholder
    (`.desk-rich[data-empty]::before`), in the field's own face and size;
  - a part holding only its heading, the prompt under the heading
    (`.desk-rich[data-hint]::after`), the same in italic;
  - a question's answer prompt, an input's placeholder (`desk.css`'s
    placeholder rule).
  The 0.7 is the lightest ink that keeps 4.5:1 (XA8-13), so paler is not
  the way. Something else has to set them apart: another face (Inter beside
  the sheet's text), a smaller size, a rule or tint around them, or a small
  label or glyph. A face change alone does nothing for a reader in
  Atkinson or OpenDyslexic, whose face overrides every other
  (`src/styles/CLAUDE.md`, the reader font's rule 2). Mock two or three in
  a real Sheets pane and on /sheets, light and dark, with an accessibility
  font among them. Only the editor shows prompts (nothing prints, copies or
  presents them), and the Sheets tour's example sheet shows the same.
  Status: open, for mocks.
- **E130, wording: “Chapter View” becomes “Scripture page” with the
  preview on.** BVJ (2026-11-12, in chat, after “Continue reading · Chapter
  View” showed in My Notes on /desk): “it still says ‘Chapter View’. That
  should be replaced everywhere with Scripture page(s).” The form is the one
  /read's Study Desk card already uses, capitalized, singular or plural as
  the sentence needs (“Scripture pages,” “View Scripture page”); “(s)” was
  shorthand, never a label. **Then, while it was being built: “This change
  is only for the preview gate.”** So with the preview off every reader
  still sees “Chapter View,” and the public wording changes at launch
  (`src/scripts/desk/CLAUDE.md`, Launching, item 13):
  - **Desk-only strings changed outright**: Continue reading's line
    (`VIEW_NAMES`, `desk-bookmarks.mjs`: “Continue reading · Scripture
    page”), This chapter's link (“Read Romans 8 on its Scripture page”),
    the LIT pane heading's title (“Open the Scripture page”), and six
    sentences of the help page (“On a Scripture page, …”).
  - **Shared strings follow the preview**, the old wording without it: the
    search tray's first hint (“Scripture page, with notes”; a book's
    “book introduction”) and keys line (“Enter: Scripture page”), /search's
    first link (“Scripture page, with notes,” “Book introduction”), the
    chapter picker's footer in Read View (“Open Romans on Scripture
    pages →”), and Read View's switch (“Scripture page,” two spans swapped
    by `read-mode.css`, and its name “Switch to the Scripture page for
    Romans chapter 8,” set by `read-mode.js`). /read's card already
    swapped its wording this way (E33) and is unchanged.
  - **Comments, tests' names and the CLAUDE docs keep “Chapter View”**
    until launch, since it is still the public name; the root's naming rule
    gains one sentence. Code and storage names stay (`view: "study"`,
    `scriptureControls` “study”), and the records keep the old name.
  An introduction is the book's, not a Scripture page, so its link says
  “book introduction.” Read View keeps its name until it retires at launch.
  Status: built (preview only).

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
    E50 is built too (decided from a mock), and so is E37's phase B (slides,
    decided by BVJ the same day), and so is E53 (the Book Intro pane, decided
    by BVJ the same day). BVJ settled E33 (at
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
14. **BVJ's pass of 2026-11-12** (E111 to E127; Claude's grouping,
    2026-11-12, not a decision). Waiting on BVJ: only E113's design talk and
    its two mocks (the dot is in); E114, E116, E117, E122, E126 and E127 are
    decided. Wave 1 (a to d) is #563 to #567. Shared files set the order;
    each group is its own branch.
    a. *Small and separate*: E123 (`search-core.js`, every reader), then
       E115 (`search-pane.js`); E121 (`my-sheets.js`), then E112
       (`desk/actions.js`).
    b. *Share image*: E111 (`chapter-tools.js`, every reader's menus), beside
       a; check the whole verse menu once both land.
    c. *My Notes*: E118, then E119 (`tab-mine.js`, `desk.css`).
    d. *Pages without the panel*: E124 (`desk-frame.js`, `Layout.astro`'s
       pre-paint script, `global.css`, the first stage).
    e. *Sharing a sheet*: E122, what a participant link holds first (with the
       answer key; the format doc), then the dialog's words.
    f. *Buttons, and search to a sheet*: E126 with E116 and E117, mocks
       first (a button hierarchy for every pane kind; /search's checks and
       button; the pane's checks and where its sheet buttons sit). Built
       after a's E115 and
       E121 and after c and g, since it restyles buttons across `desk.css`
       (with `search-sheet.js`, `desk-search.css`, `search-pane.js`).
    g. *The intro pane's chart*: E120 (`desk-inert.mjs`), after c, since
       both touch `desk.css`.
    h. *Reading links and the reminder*: E114 after a's E123
       (`desk-layout.mjs`, `desk-page.js`, `search-core.js`, `searchbar.js`,
       `search.js`, `ReadMenu.astro`); E113 after its talk and two mocks (an
       undo-bar line; the Settings tab), then the build (`first-use.js`, the
       tab's dot in `desk-tab.css`, /desk's title menu).
    i. *A full desk*: E127 (`desk-layout.mjs`, `desk-page.js`,
       `desk-search-pane.mjs`, the undo bar), after wave 1 and before f's
       E117, whose “New sheet of N verses” opens a Sheets pane; after h's
       E114 too, which shares `desk-layout.mjs` and `desk-page.js`.
    j. *Last*: E125, the help page, once the rest is built.

Parked: E1 and E2 wait on the N8 hold (`claude/desk-1d-hidden`).
Suggested order: 1, 2 and 7a together; then 3, 4, 5, 6; then 8a and 8b, and
8c at launch.

**Fixed**

- **E3, bug: My Notes and Places overwrote each other's list** in the
  Notebook. Fixed in 2dbab04 (2026-10-15).

**Build notes without an E entry (moved from the desk's CLAUDE.md, 2026-11-07)**

Narrative that sat in the desk's CLAUDE.md beside a rule and belongs to no
single E number. The rule stays there; the story is here.

- *The build dates of phases 1d, 1f, 1h, 2a, 2b, 2c, 3c to 3g, 3i, 3j, 3k and
  3m* (2026-10-12 to 2026-11-01) are in STUDY-DESK.md, "Order of work". The
  Records table once listed them in its first row.
- *Rule 3, the Notebook's place in the margin:* the first build (BVJ,
  2026-10-06) pushed the whole page left, which is why the panel now fills the
  margin and moves the column only as far as needed.
- *The LIT pane parks far chapters* (DK-15). Measured on /desk with all 211
  chapters: re-layout 520 ms down to 15 ms, scrolling 42 ms a frame down to 7.
  The rule in CLAUDE.md keeps the reason `content-visibility` was not enough.
- *A pane's scroller must be positioned.* The Greek's was fixed in #354, the
  Sheet's on 2026-11-04, and `.desk-pane__body` carries it as a guard.
- *Bookmarks, `followStep`'s "last place this page heard":* the bug was found on
  2026-11-04 testing "Move it here" (a page landing on a far verse reports
  twice before the first judgment).
- *Sharing a sheet (S8):* checked against the real analytics beacon on
  2026-10-20, its `location` came without the fragment. The navigation timing
  entry's `name` still held the original address and the beacon did not send
  it; recheck if the beacon starts sending timing names.
- *E22, My Notes' follow:* before the `followTarget` change the pane stayed
  where it was in a chapter with nothing kept, which read as not following
  (the entry above has the full account).

## Bookmarks: the long account (moved from the desk CLAUDE.md, 2026-11-08, LG6-1)

The rules are condensed in `src/scripts/desk/CLAUDE.md` (rule 13, "Bookmarks, and Continue reading"); this is the text it had before the trim, kept for the stories and the exact wording of the reasons.

     - **Bookmarks, and Continue reading** (`desk-bookmarks.mjs`,
       `desk-bookmark-change.mjs`, `desk/bookmark-follow.js`,
       `desk/bookmark-form.js`, `desk/continue-reading.js`; STUDY-DESK-FIXES.md E9).
       **There is one feature, Bookmarks, and no Places** (BVJ, 2026-10-22; the
       word "ribbon" is for the note marker alone, E10). A `bookmark` record is
       a verse, an optional `label` (its name, up to 40 characters, not
       unique) and an optional `follow: true` ("Move as I read"), **with two
       stamps beside `modified`, `placedAt` for its place and `editedAt` for
       everything else** (`BOOKMARK_PLACE_FIELDS`; `createRecord` and
       `editRecord` keep them, and the merge takes each group from the copy
       whose stamp is newer, DI3-3), so a write of a bookmark goes through
       `editRecord`, never a spread, and the follower writes the place
       group alone. **A bookmark
       stays on its verse unless that switch is on** (BVJ, 2026-11-02). The old
       ribbon, a `place` with `ribbon: true`, is read as a bookmark that
       follows by `migrateRecord` (same id, `name` to `label`), so nothing else
       knows the old shape; the website never writes a `place`. A bookmark is a
       row in the ordinary My Notes list and the notebook page's: its reference,
       its name right under it, then a line "Bookmark · Stays put" / "Moves" /
       "Following" (`bookmarkState`, bookmark-follow.js: following is this tab's
       flag; one short word each so the line never wraps in the narrow list,
       with the fuller sentence as hover text; the words are an Opus agent's,
       who advised against "Smart" and "Static", BVJ 2026-11-04), and **Edit** (`bookmark-form.js`:
       the verse, the name and the switch). **The form moves a bookmark to
       another verse** (E46, 2026-11-05): a Verse field read as the Go to
       passage field reads one (`parseReference`, then `bookmarkPlace`: a range
       keeps its first verse, a chapter alone is verse 1, a verse past the
       chapter's last is refused), sent only when the reader changed it, so a
       move the follower made meanwhile is kept. It is the same one
       `store.change` (`planBookmarkEdit`), an ordinary undoable edit, refused
       with "John 3:5 already has a bookmark that stays put" when the verse
       holds one of its kind (`roomAt`, `kindTakenAt`; the switch locks for the
       typed verse as for its own), and it writes `verse`, `endVerse` and
       `contentVersion` as a new bookmark gets them; other fields (`from`
       included) are kept. Moving the bookmark this tab follows moves where it
       rests (`restedAt`), and the next report is judged from there. **"Start
       following now?"** (E47) shows under the switch while it is checked, and
       only when this tab could start it (not while it follows this one, not
       where the page doesn't follow the reader, not with six others moving);
       otherwise a line says which. Checked at Save, the bookmark is saved and
       then followed (`followBookmark`), even when nothing else changed, so a
       new bookmark from the verse menu starts following with its first Save.
       The verse menu lists "Edit bookmark…" right after
       "Remove bookmark" once the verse has one, and **pressing "Bookmark" opens
       that form at once** (BVJ, 2026-11-04; closing it leaves a plain bookmark).
       **A moving bookmark's margin mark jumps rather than glides**: its writes
       are quiet (QUIET_KINDS), and the margin and Read View's marks (and on
       /desk the My Notes and This verse rows and the verse numbers' names,
       E28) redraw once
       2.5 seconds after the last move (`redrawAfterMove`, move-redraw.js), so it
       catches up when the reading pauses; the follower writes at most every 2
       seconds (`MOVE_EVERY_MS`), and the settle must stay longer than that gap
       or steady scrolling redraws between writes. A move is a record write that syncs
       (E45), so tell BDR if the write gap changes. "Add bookmark" in the verse menu and the
       selection panel stays one press. **At most six bookmarks move at once** (plain ones are not
       counted); the limit and the write are one `store.change`
       (`planBookmarkEdit`, BA102), so a bookmark deleted meanwhile is reported,
       not brought back. **"Continue reading" is the one place that isn't a
       bookmark**: `lit_last_read` (last-read.js), never a record, shown with no
       bookmark mark by `continue-reading.js` above My Notes' list and first on
       the notebook page, and left out of My Notes while it names what is on
       screen (`continueIsHere`; Audit 4, FU4-2). Read View's per-book places and other clients' places
       aren't listed. `last-read.js` dispatches `lit:last-read` on every save
       (nothing hears it unless the desk is on). **The C25 rule**: following a
       moving bookmark's link (from either list) sets
       `sessionStorage['lit-desk-follow']`, and while the reader stays in that
       book in that tab the bookmark follows them (written without an undo
       entry, as `bookmarkMove`); a page outside the book clears it, the shell's
       `initBookmarkFollow` in a book and `desk-gate.js` on every page without
       the shell but /desk (BA101, E28). **A bookmark moves only to where this page says the
       reader is**: `pageLastRead()` and the `lit:last-read` event, never
       `lit_last_read` in storage, which every tab shares and an earlier page
       left (BA99, BA100). Following a link forgets where the reader was, and a
       link to another page stops the page it leaves from moving the bookmark.
       **Following a bookmark that stays put stops the moving one** (BVJ,
       2026-11-04: it kept following and would have moved to the new place):
       a plain click on any bookmark's link in either list either takes over
       (`followBookmark`) or clears the flag (`stopFollowing`), and every row's
       line redraws (`syncBookmarkLines`).
       **A follow pauses rather than ends** (BVJ, 2026-11-04, after an Opus
       design pass). The flag is `{ id, bookKey, tab, paused?, since?, told? }`.
       Each report of where the reader is goes through `followStep`
       (desk-bookmarks.mjs): within a chapter of where the bookmark sits (or of
       the last place this page heard, for Read View's long scroll) it moves; a
       far chapter, or another book (Matthew 28 to Mark 1 included), pauses it
       where it was, and the reader is told once, in the undo bar, with "Move it
       here" (`showPausedBar`; the move is an ordinary undoable edit and may cross
       books); reading on from the bookmark resumes it. **The "last place this page heard"
       that `followStep` allows for Read View's long scroll is the last report
       the follower accepted**, set when a report is judged and never as it
       arrives: a page that lands on a far verse (a link to `/luke-1/#v1`)
       reports twice before the first judgment, and the second would count the
       first as reading and move the bookmark instead of pausing it. Pages outside the book
       (/search, /notebook) pause it too (`desk-gate.js`), and a pause
       ends after 12 hours (`PAUSE_EXPIRES_MS`; a restored tab keeps its session
       storage). Rows say Following, Paused, Moves or Stays put.
       **A following or paused bookmark rests at its verse and does not belong
       to it** (`restingId`): the verse menu leaves it out of Remove and offers
       "Leave it here" and Edit, and a verse holds **one bookmark that stays put
       and one that moves** (`followChoices`, `planBookmark`; Edit and the form
       lock "Move as I read" at the kind the verse lacks). Its mark is the red
       outline; a bookmark that moves and isn't followed is solid red, and one
       that stays put is gold (`bookmark-mark.js`). **The rows carry the same
       colors** (E28; BVJ, 2026-11-06): `drawBookmarkLine` starts each
       bookmark's state line with the glyph in its look (`bookmarkLook`, which
       `markLook` reads too), in My Notes, This verse and the notebook page.
       A follow that ends on a verse
       already holding a bookmark of its kind is tolerated.
       **On /desk the leading LIT pane is the reader** (E28; BVJ, 2026-11-06):
       `desk-page.js` runs the follower with `page: DESK_PAGE` and `place`, and
       after every `commit` reports the leading pane's place (`hear`) or, when
       another pane has become the leading one, `lead`, which pauses the follow
       (`followStep`'s `newLead`). Other LIT panes never move it; the opening
       place, a restore and the tour report nothing, and `lit:last-read` isn't
       heard there. "Move it here" takes the leading pane's place at the press.
       The pause bar is the ordinary undo bar, outside the panes.
       **The verse menu and the selection panel group a verse's bookmarks in a
       "Bookmark ▸" flyout** once it holds any (BVJ, 2026-11-04): Remove and Edit
       (`Remove bookmark “Advent”`, the name cut at 14 characters, the full name the
       accessible name), Add a bookmark that moves or stays put, and for the resting
       one "Leave it here". A verse with none keeps the one-press "Bookmark", and a
       finger's chips stay flat. **The flyout is shared code since E39** (BVJ,
       2026-11-06): `flyoutRow` in `src/scripts/panel-flyout.js`, styled by
       `.lit-flyout*` in `global.css`, also builds every reader's "Copy text ▸" and
       "Share ▸" rows and this file's "Print ▸" (rule 19). Desk code imports it;
       shared code never imports desk code. Its behavior is
       described in `src/scripts/CLAUDE.md`, "One set of actions, two ways in".
       **"Stop following" and "Start following" are one
       quiet link** (BVJ, 2026-11-04 and E44, 2026-11-05; `bookmark-stop.js`,
       `drawFollowLink`) under the state line of every bookmark with "Move as I
       read" on, its label swapping with this tab's flag; not an On/Off switch,
       since a follow is the tab's and the switch is the record's. In the verse
       menu a moving bookmark has "Start following" beside "Edit bookmark…",
       and the resting one's "Leave it here" is the stop. Stopping clears the
       flag only: the bookmark stays where it last was with "Move as I read"
       still on. Starting is `followBookmark` with no link, as opening it from
       the list is apart from the navigation: the next report of where the
       reader is decides (reading on from it moves it, anywhere else pauses it
       with "Move it here"). It is offered only where the page follows the
       reader (`followsHere`), so /notebook shows the stop alone.
       **Every way the flag drops redraws the rows**
       (`dropFlag`: another tab took it, it was deleted or turned off, a
       back-forward restore), turning the switch off in the form stops it at
       once, a Back or reload doesn't write verse 1 over the bookmark before
       the scroll is restored, and a restored page reports its own last place
       (`pageshow`). A row opened in place on a page that doesn't follow the
       reader never starts a follow (`followsHere`); on /desk a moving
       bookmark's row moves the leading LIT pane to it and then starts the
       follow with no link (`tab-mine.js`), so the jump isn't taken as leaving
       the page. **The Show menu splits bookmarks** into "Bookmarks that move" and "Bookmarks
       that stay put" once a list holds both (BVJ, 2026-11-04;
       `BOOKMARK_MOVES`/`BOOKMARK_STAYS`, `kindsPresent` and `filterRecords`, in
       both lists), and **a search's count names the kind when every notebook
       hit is one** ("1 bookmark match"; `matchNouns`, else "notebook match"); the
       group is always headed "My notebook", whatever it holds (E32;
       `NOTEBOOK_GROUP_TITLE`; the tray, /search and the Search pane).
       **A bookmark found in a notebook search opens like its row**
       (`openAsBookmark`, notebook-search.js: follow, or stop what was moving).
       **Known and accepted** (BVJ, 2026-11-04, from an Opus audit):
       /notebook and /search clear the flag, so Back into the book doesn't
       resume it (the row's label shows the state); a move overtakes Undo of an
       earlier edit once the reader has read on (`desk-history.mjs`'s overtaken
       rule), and Delete then Undo resumes following only if they haven't
       scrolled since; and the last move before the tab closes can be lost,
       since Chrome drops a read-then-write made as a page closes (BA72).
       **One tab follows a bookmark at a time** (BVJ's Duplicate tab check,
       2026-10-29): Duplicate tab copies session storage, so the flag carries
       the tab's token, and a page that loads with it asks on
       `FOLLOW_TAB_CHANNEL` whether a live page holds that token; an answer makes
       this tab the copy, which drops the flag. Following a link announces it,
       and any other tab following that bookmark stops (`loseFollow`). The
       follower's move is quiet on purpose: the margin mark isn't redrawn as it
       moves, and takes its new place at the next redraw.
