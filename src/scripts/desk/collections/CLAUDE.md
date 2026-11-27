# Collections

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory. It governs Collections (STUDY-DESK.md, D13) wherever they
> live: the record's check in `src/lib/desk-collection-format.mjs`, the model
> in `src/lib/desk-collections.mjs`, and, from step 2 of D13's order of work,
> the client code here and the collection page.
> Collections are part of the Study Desk, so **`src/scripts/desk/CLAUDE.md`
> applies here too** (the preview switch, the store, the records, the panes);
> read it unless it is already loaded. The record format is
> `STUDY-DESK-FORMAT.md`, "Collections (kind 12)", shared with the apps: change
> it and the code together.

## What a collection is

A named grouping the reader makes for a purpose ("Advent series"): their own
notes, highlights, bookmarks, pinned footnotes and sheets by id (`item`
members), whole verses (`passage`), every bookmark with a label (`rule`), and
headings that divide their own order (`heading`). It is **one record of kind
`collection`**, so it is deleted, trashed, restored, merged and undone whole,
and adding or removing something writes only the collection, never the record
it holds. Computer only; the apps carry it untouched.

**Featherboa opens a collection as a place of its own on the Study page**
(the desk's new name; `SITE-FEATHERBOA.md`, "Study and its places"), not a
tab in a desk pane: its list, with The LIT, Search, or Notes in the pane
beside it, and it can open beside a sheet. Until it is built, the rules
here hold.

## Where the code is

- **Step 1, the record and its model (no UI):**
  `src/lib/desk-collection-format.mjs` (limits, member types, orders,
  `validateCollection`, reached through `validateRecord`) and
  `src/lib/desk-collections.mjs` (making one, every change, the planner, the
  three orders, rule bookmarks, moving in My order, the ways in, the highlight
  carry, the Markdown outline). Elsewhere: `desk-records.mjs` (the kind,
  `canEdit`'s format gate), `desk-store-core.mjs` (`NO_CHAPTER_KINDS`, its
  name), `desk-history.mjs` (its sentence), `desk-notebook.mjs` (never a row;
  `planDeleteCollections`), `desk-export.mjs` (the Markdown section),
  `desk-highlights.mjs` with `actions.js` (the carry). Tests:
  `test/desk-collection-format.test.js`, `test/desk-collections.test.js`, and
  the carry in `test/desk-highlights.test.js`.
- **Step 2, the page (`/collections/`, `src/pages/collections.astro`):**
  `collection-page.js` (the entry: `?id=` routing, the address, the
  document's title and history, keeping the view drawn as the store changes;
  `mountCollectionsPage` takes `chapterText`, `passageText` and `parse` so a
  test needs no network), `collection-list.js` (the list and the empty page),
  `collection-view.js` (one collection: actions, order switch, the members
  as sheets, Add ▾ and its passage form, headings, moving), `name-window.js` (the one
  name/description window, and `nameForm`, its form without the window),
  `new-collection.js` (`newCollectionForm`, the list's form in place, E190,
  and `openNewCollection`, the window, which step 3's "New collection…"
  reuses with `firstMember` and `lead`; one write serves both),
  `add-passage.js` (`addPassageToCollection`: the one way a passage goes
  in from outside the page, the verse menu's and This verse's, so both say
  "John 3:16 added to Advent series." with Open the collection, or that it
  is there already; `alsoInside` adds "It’s also inside Luke 1:46–55.",
  E194). Styles: the rows' rules (the actions row, the order
  bar, headings, a passage's cut at three lines) are `desk.css`'s
  "Collections (D13)" section, where the pane reads them too;
  `styles/pages/collections.css` keeps the page's frame (Site 2.0's
  `v2/collections.css` frame went with 2.0), the note without the desk and the
  page's text size: /sheets' rule (`--sheet-ui`, and `--desk-ui` for the
  notebook's rows, from `--reading-scale`), its root's `.desk-np` 1rem and
  1.55 set back to inherit, so the page's words are /sheets' at every tray
  size (E188). Gated like /sheets: `desk-gate.js` `[data-collections-page]`,
  noindex, out of the sitemap, `SUPPRESSED_PATHS`, the two gate tests'
  markers. The notebook page has "Delete all collections" in Delete in bulk.
  Tests: `test/desk-collections-page*.test.js`.
- **Step 3, Add to collection ▸** (verse menu and selection panel):
  `collection-add.js` (`createCollectionAdd`), wired into `actions.js` right
  after Add to sheet's row, and built as `sheets/sheet-add.js` is: the five
  changed last, "New collection…" (`openNewCollection` with the passage as
  `firstMember`), and "All collections…" past five (E154's pick window). It
  shows in Chapter View and /desk's LIT pane (whose panel gives `textFor`),
  never Read View or the glossary. A selection's offsets only find its first
  and last verse; the passage is rebuilt whole with `passageFromVerses`, so
  no `quote` (decision 20). Every pick goes through `addPassageToCollection`.
  A finger's chips are flat, as Add to sheet's. Test:
  `test/desk-collections-add-menu.test.js`.
- **Step 4, Collections… on rows, and This verse's line:**
  `collections-popover.js` (`openCollectionsPopover`, Labels…'s twin: a
  checkbox per collection, by name so a ticked box never moves, and an
  inline New collection; each tick is one `store.change` through
  `planAddItems` or `removeItem`, writing the collection only), and
  `collectionsTag`, the quiet button My Notes and This verse use. Its words
  say where the item is (E202, `keepCollectionsWords`, which the lists and
  `my-sheets.js` call too): **every such button shares one listener and one
  read per store**, dropped once off the page, so a list of hundreds costs one
  read per change to a collection; keep it so.
  `record-rows.js` takes `onCollections`, which `kept-list.js` passes and
  the collection page doesn't, so its rows keep no buttons;
  `sheets/my-sheets.js`' `sheetRow` (the Sheets pane and /sheets/) loads
  the popover when pressed. This verse's Collections section
  (`tab-verse.js`) names the collections holding the verse
  (`collectionsHolding`) as links, with "Add to collection…": E154's pick
  window, whose optional `action` row ("New collection…") no filter hides,
  every pick going through `addPassageToCollection`. A collection's write
  wakes no view of marks, so This verse subscribes to
  `{ kinds: ["collection"] }` itself. Tests:
  `test/desk-collections-rows.test.js`, `test/desk-collections-verse.test.js`.
- **Step 5, Labels and the live rule:** `add-records.js` is the one way
  records and a label's bookmarks go in from a list:
  `openAddRecords` ("Add these N to a collection…", `kept-list.js` and,
  since E176, `tab-mine.js`, each shown
  while a search or the label filter is on, counting what the list shows of
  `ITEM_KINDS`) and `openAddLabel` (a label's "Add all bookmarks labeled
  Advent…" in the Labels section of `notebook-page.js`, shown only for a label
  in use). Both are E154's pick window with its optional `action` ("New
  collection…", through `openNewCollection`'s `members`); the label's adds
  decision 23's two choices through the pick window's optional `choices` (a
  radio group in `desk-setting` classes; the choice is `onPick`'s second
  argument and `action.onPress`'s argument), "These N, and any you label
  Advent from now on" chosen to start, as the mock drew it. A pick is one
  `store.change` (`planAddItems`, or `addRule` through `planCollectionChange`,
  the bookmarks read in that transaction), and the bar says "12 added to
  Advent series." with Open the collection. **A collection's "Add ▾" adds two
  more windows** (E177): `openAddSheet` (Sheet…: the reader's sheets but
  templates, the last changed first, one held saying "In Readings already")
  and `openAddLabels` (A label's bookmarks…: the labels in use, with the
  same two choices). Both read `store.all()` as they open, since the view
  hands them the collection as last drawn. My Notebook's list
  (`kept-list.js`) draws a Collections section after Sheets (name link, count, New collection…, All my
  collections; only while nothing narrows the list; never rows). The page's
  rule line (`ruleLine` in `collection-view.js`, one per rule) reads "Every
  bookmark labeled Advent · 12" with `desk-item__stop` links Stop adding new
  ones (`ruleToItems`), Remove (`removeRule`), and one "Bring back …" per
  bookmark left out (`bringBack`, which puts it back where it was: E201,
  `leaveOut` keeps the item's place in the rule's `exceptAt` and
  `bringBack` reads it and forgets it, so it outlives a reload; a bookmark
  only the rule brought in has no place and comes back at the end); a rule
  whose label is gone says so and can
  only be removed. A bookmark a rule brings in says "· from Advent" in its
  kind line and has "Leave it out of this collection" (`leaveOut`) in place
  of Remove. Deleting a label a rule uses asks first on its row (the bulk
  deletes' `desk-np__ask` group: Yes, keep them; No, just delete the label;
  Cancel); Yes adds `planLabelRulesToItems` to the deletion's own write, so one
  undo restores both. Tests: `test/desk-collections-rule-page.test.js`,
  `test/desk-collections-notebook.test.js`.
- **Step 6, search and the header:** the notebook search (`kept-list.js`)
  offers collections whose name holds its words (`collectionsNamed`) as a
  "Collections" group of rows linking to their pages, never rows of the record
  list or in its count, drawn even when no record matches (then first, over
  "Nothing else matches."). `/collections/` is "Collections" in header C's
  Study group and "My collections" in the Notebook's Settings tab, beside
  "My sheets." **Not /desk's title menu** (BVJ, 2026-11-19, E180:
  "Or if it does, sheets should too"): a Collections pane's header opens
  `/collections/` in a new tab, as a Sheets pane's opens `/sheets/` (`page`
  on the kind in `KINDS`, read by `kindPage`).
  **There is no collection filter** (BVJ, 2026-11-19, E175): step 6 built one
  in My Notes (the panel and /desk's pane) and My Notebook's list, and BVJ
  took it out as clutter, since a collection's page and the Collections pane
  show what it holds, passages and headings included, which a filter of
  records couldn't. Don't add one back to either list. Test:
  `test/desk-collections-filters.test.js`, which holds that it is gone.
- **Step 7, a collection onto a sheet:** the converter is
  `src/lib/desk-collection-sheet.mjs` (pure; read its header):
  `collectionChapters` lists the chapters to read first, and
  `collectionSheetParts(collection, records, sheet, { chapters })` returns
  `{ parts, added, alreadyOn, leftOut, skippedSheets, limit }` in the page's
  order, run again inside the writing change over the sheet as saved.
  `collection-sheet.js` is the wiring: the view's "Add to sheet…" (after "Add
  ▾"), E154's pick window over `addableSheets`. A pick appends the block at `passageInsertIndex`; its
  action row "New sheet" (`makeSheetFromCollection`) hands the parts to
  `createSheet` as its `modules`. Each is one `store.change` reading the
  notebook there, with the undo bar's "Open the sheet" and
  `skippedSheetsNote`. **There is no "Make a sheet" button** (decision 36;
  BVJ, 2026-11-19: "the /collections page can just use add to sheet also"):
  it made what "New sheet" makes, and the help page's "Onto a sheet" starts
  from Add to sheet…. A collection with nothing that makes a part
  says so and writes nothing. `add-forms.js`' "+ From my notes…" has a
  section, "Or add a whole collection" (E181; `src/scripts/desk/sheets/CLAUDE.md`,
  rule 23; a line under it says choosing one adds everything at once), a
  button per collection, or one line and a link to `/collections/`, adding the block through the editor's own change at its
  `insertIndex`. The converter puts a word joiner (U+2060) after a collection
  heading whose words are a template's reading-part words, so `readingPart`
  never takes it for the reading part; leave it, it is the owner's to decide.
  Tests: `test/desk-collection-sheet.test.js`,
  `test/desk-collections-sheet-wiring.test.js`.
- **A Collections pane on /desk** (BVJ, 2026-11-19): STUDY-DESK.md, D13,
  "A Collections pane on /desk" (decisions 26 to 36, and its order of
  work). The Book Intro pane went to make room (STUDY-DESK-FIXES.md E173).
  Built (all five steps); see "The views' host" and "The Collections
  pane" below. The help page names it in "The kinds of pane," the
  commands, "When the desk is full," "Going back," and "How collections
  work" (its "On the Study Desk" paragraph, and "Finding things"); a
  change to what the pane
  does changes those words too.

## The views' host (the pane's step 2)

`collection-view.js` (one collection) and `collection-list.js` (the list)
know nothing of addresses or panes. Each home hands them one **host**, whose
shared part `viewHost` makes (the readers, each passage's words read once,
each collection's `viewState`, and `openWords`, the passages shown whole for
the visit); the header of `collection-view.js` lists every field. What to
keep:

- **`open(id)` and `toList()`, never an address.** The page turns them into its address and a history entry, and the pane
  into its layout field. A host that gives `listHref` and
  `href(id)` (the page) gets links for "‹ My collections" and the list's
  rows, a plain click running `open` or `toList` in place (`follow`); one
  that doesn't gets buttons.
- **Everything a view looks for is inside `host.root`** (`keyed`): the button
  a window gives focus back to, and the focus keys `refresh` hands focus to.
  Never `document.querySelector`, or a second Collections pane answers for
  the first.
- **A host's `idSuffix` goes on its ids, its order switch's radio name
  (`collection-order-<id>`) and its focus keys (`focusKey`: `add--<id>`)**,
  so two hosts never share a radio group (the mock showed My order chosen in
  one pane taken from the other). The page has none, so its keys are the
  plain words its tests look for.
- **The page keeps its address, `document.title` and history**; a view's
  `title` is the document title, which a pane ignores. Test:
  `test/desk-collections-host.test.js` (two hosts at once).
- **The two homes differ only by host fields** (decisions 26, 27, 29, 32 and
  36): the page gives `deskHref` ("Open in Study Desk," last, in this
  tab, as /sheets' "Edit in Study Desk" is drawn: a green link set apart
  from the buttons, E210); the pane gives `ownPageHref` ("Open on its own page," a new tab, in
  Print's place) and `goHere` (a plain click on a reference runs it), and `listHead` (E186:
  the list's title and "New collection" in one row, no ellipsis, as a Sheets
  pane's "My sheets" and "New sheet"; the page's "New collection…" sits under
  its title, as /sheets' "New sheet…" does), while the page gives
  `listIntro` (E187: a short description of the feature under the list's
  title, always, as /sheets has; the pane's empty list says what a
  collection is instead). "Add ▾"'s last line
  is one more (E177): the page gives `notebookHref` ("From My Notebook," a
  link in this tab), the pane `openNotes` ("From My Notes"). A new
  difference is a new host field, never a test of which home is drawing.
- **A member's sheet opens with a sheet part's head** (E211; BVJ,
  2026-11-20, "matching it to sheets"): `.desk-sheet__module-head` holds the
  grip, the kind (`.desk-item__kind`, as `.desk-sheet__module-name`) and the
  buttons (`.desk-np-row__buttons`, as `.desk-sheet__module-tools`: ↑, ↓,
  Remove or Leave it out), with the reference and the words under it in one
  column. The whole head drags, as a part's does. A keyboard takes the
  buttons before the reference, as on a sheet; in a narrow pane they wrap
  whole to the head's second line (LV3-6), so the members need no rules of
  their own there (decision 35's three lines are the head, the reference and
  the words).

## The Collections pane (the pane's step 4)

`collection-pane.js` is the pane: `createCollectionPane`, mounted by
`desk-panes.js` with the layout field handed in (`getCollection`,
`setCollection`, over `setPaneCollection` in `desk-layout.mjs`, which
`checkLayout` keeps on a Collections pane only). It is the views' host with
the pane's id as `idSuffix`, and keeps what only a pane has:

- **References are jumps** (decision 29): a passage or a record goes to
  `env.showPassage(…, { beside, asker: "collection" })`, so the LIT pane's bar
  offers the way back (E168), and a notice with no room names "this
  collection." A sheet goes to `env.showSheet(id, paneId)` by E127's rule, the
  pane saying what it took the place of (Undo is the layout's, `keyless`).
- **"Open the collection" acts in place only on /desk**: `collectionLink(id)`
  in `add-passage.js` is the one way the undo bar's link is made, and
  `desk-page.js` hands it `setCollectionOpener(showCollectionPane)`, which
  shows the collection by `showCollection` (E127: the pane showing it, the
  first Collections pane, a new one, another's place, or the notice with the
  page). Elsewhere there is no opener and the link opens the page in a new
  tab. A new place that offers "Open the collection" uses `collectionLink`.
- **"From My Notes"** (E177; BVJ: "On /desk, it should open the My Notes
  pane") is `env.showMine(paneId)`, `showMine` in `desk-page.js`: the My
  Notes pane open, else one by E127's rule (never in the asker's place, the
  notice's link My Notebook), focus on its search field (the mount's
  `focusField`) or else its name.
- **`/desk/?collection=<id>`** shows it the same way at load, saying so in
  the arrival bar beside `?sheet=`'s; the parameter is stripped.
- **"New collection…" in the command row** (decision 28) is `newCollection`
  in `command-row.js`: `collectionPaneFor` (an open one, else a column, else
  a row), then `desk:collection-new` with `{ paneId }`, which the pane
  answers by showing its list with the New collection form open and focus
  in Name (E190), as `desk:sheet-new` opens a Sheets pane's templates;
  Create shows the new one there. The pane registers its listener as it is
  built, as the Sheets pane does (DK6-10).
- **The list's "New collection" opens its form in place** (E190; BVJ,
  2026-11-19, "like the sheets pane does"), in both homes: a card under the
  button's row (the chooser's `desk-sheet__passage-form`), holding the name
  window's form (`nameForm`). The opener reads "Cancel" in the ordinary
  look while it is open (E121), so Create is the one primary. The list is
  drawn again at every change, so the form's words live in the host's
  `listState` (`viewHost`) and a redraw keeps it open with them; Cancel,
  Escape or the opener forget them. **The name window stays** where there is
  no list: "Add to collection ▸ New collection…", the pick window's, My
  Notebook's, and Rename….
- **Every change to the notebook draws it again** but a reading place's
  (`QUIET_KINDS`), so a passage added from the LIT pane appears at once.
- **Its cards take the Sheets pane's card color** (E185; BVJ, 2026-11-19):
  `--desk-pane-card`, set by the one rule that sets it for the Sheets pane
  (`.desk-pane :is(.desk-sheet, .desk-collections)`), so a list drawn from
  the same classes looks the same in both panes. The page keeps `#FAFAF8`.
- **The narrow rows** (decision 35) are a container query on
  `.desk-collections` (`deskCollection`, 26em of the pane's own type, so a
  larger text size turns them narrow sooner). Since E211 it holds only a
  heading's rule (its buttons under its name); a member's head wraps as a
  sheet part's does. The page never matches it. Check a change at 280px in
  OpenDyslexic at Extra large.

Test: `test/desk-collections-pane.test.js`; the layout rules are in
`test/desk-layout.test.js`, the command row's in
`test/desk-audit8-dom-search-menus.test.js`.

## Rules this step settled, and why

- **Every change goes through `planCollectionChange`** over the notebook read
  in the write's own transaction (as a sheet's do, BA129). An op returns the
  very same object when it changes nothing, so nothing is written and
  `modified` stays put. Every write drops `item` members whose record is gone
  for good (a tombstone alone); one in the trash or not synced yet is kept, so
  a restore puts it back. Pruning alone is never a write.
- **Limits: 1,000 members, 512 KB** (a sheet's), refused with words
  `collectionTooBig` knows. The proposal's 256 KB was too small for a thousand
  passages carrying their verses' words.
- **A passage is whole verses**: no `quote` is written; one that arrives with
  one keeps it and is shown as whole verses. Two passages on the same verses
  are never added (`planAddPassage` reports `again`).
- **Three orders**: Bible order (sheets first under "Sheets," then verses, a
  passage before a record on one verse, then what has no verse), By type, and
  My order. Moving or adding a heading switches to My order; the other two
  never rewrite `members`. An unknown order is kept and shown as Bible order.
- **A row moves in every order** (E212; BVJ, 2026-11-20), by `moveShown`,
  which counts places in `shownRows` (the rows as drawn: Bible order's nested
  rows right after their passage, no group labels). Until the reader has
  arranged My order (`isArranged`: the record's `arranged`, which the first
  move or heading sets, or a heading), My order becomes the order on screen
  with the move made. Once arranged, the move is made in My order: up, just
  above the row it now sits above; down, just below the row it passed; the
  rest, headings included, stays. The flag is needed because `members` keeps
  the order things were added in, which looks just like an arrangement. A
  move from another order says so in the undo bar ("… moved. My order now
  starts from Bible order." or "… moved in My order."), since the view
  changes under it.
- **A move from another order keeps the row where it was on screen** (E213;
  BVJ, 2026-11-20: the jump to the top and the scroll back were
  "disorienting"). The whole list is drawn again in My order, so `moveTo`
  notes the row's top before the write (a drop: the marker's), and the
  host's `refresh` runs `drawn` the moment the new rows are in, before
  anything is awaited (the pane reads the store after drawing, and a frame
  would paint between). `keepAt` then scrolls the view's scroller (the pane's
  body, or the page) at once, never smoothly, so the row's top is where it
  was, and holds it there while the passages' words arrive and the store's
  own redraw lands (a `ResizeObserver` on `host.root`, for 1.5 s or until a
  wheel, touch, press or key). Only a row the page can't scroll to is brought
  just into view. A move within My order keeps E200's reveal.
- **Rule bookmarks** show among everything in Bible order, under Bookmarks by
  type, and at the end of My order until moved. Moving one (or moving a row
  past it) makes it an `item` there, since only a member keeps a place; it is
  still shown once and still tagged with its rule. Deleting a label a rule
  uses is to ask first (with the page); `rulesUsing` finds the rules, and
  `planLabelRulesToItems`, planned while the label still matches, turns them
  into items for the deletion's own write.
- **Names needn't differ**, so restoring from the trash never refuses.
- **"The five used most recently"** are the five changed last, by `modified`,
  as Add to sheet's are: adding writes the collection, so no key is kept.
- **The highlight carry**: when a highlight is absorbed, covered or split,
  `planHighlight` (given the notebook) rewrites the collections holding it in
  the same plan, so one undo reverts both. **A new color over part of a
  collected highlight joins it there** (E182; BVJ, 2026-11-19): the new mark
  goes in beside what is left (`joined`), after it, before it when only its
  right part is left, and between a split's two pieces, so no recolored word
  drops out. Erasing one outright is a plain deletion and leaves its
  collections alone, and an erase that trims one keeps what is left. The apps
  don't do this.
- **Bulk deletes stay apart**: "Delete all notes and marks" and "Delete all
  sheets" take no collection; `planDeleteCollections` does.
- **Never a row** of My Notes or My Notebook, nor counted there; a
  collection's change wakes no view of marks (`NO_CHAPTER_KINDS`).
- **Markdown lists collections for people and never reads them back**, like
  Places and Labels.
- **No tour of its own; two cards in the Study Desk tour** (decision 22;
  BVJ, 2026-11-19: "don't build a separate tour for now," then, with the
  pane built, "Add to the desk tour"). "Collections" shows a Collections
  pane for the step (`showKind` in `desk-tour.js`, the Sheets card's way)
  and links the help page's "How collections work"; "Adding to a
  collection" opens the LIT pane's verse menu with its row marked, never
  pressed. Elsewhere the tours name collections where they meet them: the
  notebook tour's "Open the menu," "This verse," and "My Notebook, and
  where it’s kept," the Study Desk tour's command card ("New
  collection"), and the Sheets tour's "Your own words, and more" (a whole
  collection from "From my notes…"). Text in `desk-first-use.mjs`; a
  changed card keeps its id, so it is not offered again as new, while a
  new card is. Orders, headings, and the live rule are the help page's.
  Test: `test/desk-tour-collections.test.js`.

## Every look is one the site already has (decision 25)

BVJ, 2026-11-18, on the first mocks: no new color, toggle, menu, bar,
window, or button style. Each piece of the UI takes an existing class, and
a new button takes one of the kit's levels by name (`kit.css`, through
`scripts/kit-names.mjs`; `src/scripts/desk/sheets/CLAUDE.md`, "How the
Sheets look") rather than getting a rule of its own. Before writing a style for collections, find the
pattern it copies; if none fits, ask BVJ rather than drawing one. What the
second draft of the mocks takes from where:

- **The page**: My sheets' title, "New…" button and rows (`desk-sheet__*`);
  "‹ My collections" is `sheets-page__back`. **Each view has one filled
  button** (E126's primary, now the kit's filled; BVJ, 2026-11-19, E169): "New collection…" on the list,
  as "New sheet…" is on My sheets, and "Add ▾" on one collection,
  whose passage form's Add stays plain. Its menu is the desk's button
  menu (`desk/button-menu.js`, the sheet gap pill's, `desk-pane__menu`),
  its caret drawn as /sheets' "Save as ▾" (E177). The members are the
  desk's own rows (`record-rows.js`), each on a sheet (below), and group
  names are My Notebook's `.desk-np__h3` (E195).
- **A passage's words, and a bookmark's verse** (E171; BVJ, 2026-11-19) are
  set as a scripture page sets them: `passageWords` (`sheets/sheet-lit.js`)
  hands over the chapter's own blocks, so paragraphs, poetry lines, italics
  and verse numbers stay and footnote letters go, drawn in a sheet passage's
  look (`.desk-sheet__words`). The page carries `#hbq-description` for the
  poetry, as /sheets does. A test's `passageText` may return plain text,
  drawn as one paragraph. Past three lines they are cut, with a pinned
  footnote's row and caret (`.desk-item__pin-row`, `.desk-item__more`, E118;
  open for the visit, by row key); a line clamp can't reach into
  paragraphs, so the cut is a height of `3lh` in `desk.css`, the last line
  faded while cut (`--cut`). A pinned footnote is cut the same way (`cutRow`,
  E199). Print always shows them whole. Test:
  `test/desk-collections-passage-words.test.js`.
- **Three new looks BVJ approved** (2026-11-20, from a new reader's
  walkthrough; STUDY-DESK-FIXES.md E192 to E207). Nothing else is new.
  1. **One sheet per record** (E192): each member is a
     `.collection-page__member`, which shares the sheet editor's module rule
     (`.desk-sheet__module, .collection-page__member`), so a collection's
     members look like a sheet's parts. Members of one kind in a row are one
     `ul.collection-page__run` and touch (their edges overlap 1px); the
     column's 10px gap, a sheet's own, falls between runs, labels and
     headings. Page and pane alike, in all three orders; the pane's cards
     take `--desk-pane-card` by E185's rule.
  2. **The sheet glyph** (E197): a page with a folded corner before
     "Sheet" in a kind line, as the Pin's thumbtack goes before "Pinned
     footnote" (`addKindGlyph` in `glyphs.js`), `aria-hidden`.
  3. **The membership wording** (E202): a row's "Collections…" reads "In
     Advent small group," "In 2 collections," or "Collections…"
     (`keepCollectionsWords`).
- **Bible order nests** (E193; `nestRows`, `src/lib/desk-collection-nest.mjs`,
  whose header states the rule): a record wholly inside a collected passage
  lies on that passage's sheet, under its words; a smaller passage nests with
  its records beside it, one level deep; a partial overlap stands alone; of
  two passages that partly overlap, a record inside both goes under the first
  in Bible order. A nested bookmark or passage draws no words. By type and
  My order never nest.
- **My order's "+ Heading"** is the sheet editor's gap pill
  (`.desk-sheet__after`, E196): above the first row and under each, one Tab
  stop, the arrows moving among them, as DK6-1 made the editor's.
- **One collection's page has the sheet editor's column** (E207; BVJ: "match
  the column width while editing a sheet on the /sheets page"), keyed on the
  title's `data-collection-shown`, which also tells `collectionLink` to leave
  "Open the collection" off the undo bar (E205). The list keeps My sheets'.
- **The order switch** is `.desk-seg` (My Notes' segmented choice). Sky
  never marks a toggle (E160).
- **Moving a row**, in any order (E212), is the sheet editor's head to drag
  (`desk-sheet__module-head`, its grip `desk-sheet__grip`) and its ↑ and ↓
  (`desk-sheet__icon`), not a menu. A heading of My order drags by its whole
  line, its buttons and a rename's field aside (E214).
- **A heading's line is one center line** (E214): its name (an `h3`) keeps
  none of a heading's margin, since the row centers each box with its
  margins, and its buttons are centered as a part's tools are. A heading
  that sat 8px above its grip and buttons is what that margin did.
- **The rule's line** is a plain line with `.desk-item__stop` links; the
  label's two choices are `desk-setting` radios in the pick window.
- **The undo bar** is `showUndo`'s, with its `link`.
- **"Add to collection ▸"** is a `flyoutRow`, so `panel-flyout.js` places it
  (6px right of its trigger, level with the trigger's top).
- **New collection, All collections, and the label's shortcut** are E154's
  pick window (`openPickWindow`, `desk-pick`), with `desk-editor__actions`
  (Cancel plain, the save button filled). The list's New collection
  form (E190) is the Sheets chooser's card with the name window's fields
  inside, which take the size of the words around them on the field's fill.
  **Every field on the page is the kit's field**, the paper with a 3:1
  edge (E191 made them white, `--desk-field`, before the kit).
- **A row's "Collections…"** is the Labels popover's twin (`desk-labels`,
  `showPanel`).

The name window (`name-window.js`) is a sibling of the pick window, not a
use of it (the pick window is a list picker): it shares `placePick` and
`claimPickSlot` from `pick-window.js` so only one of the two is ever open.
Every write on the page goes through `store.change` with `planCollectionChange`
or `createCollection`, never straight to a record.

A button that matches its background is a sitewide problem (E159), fixed in
the classes, never with a collections-only rule.
