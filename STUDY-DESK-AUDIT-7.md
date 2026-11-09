# Study Desk Audit 7 (scoped): the tours

Audited 2026-11-09 at commit `81937298` (`main`, PR #521), on BVJ's brief: an exhaustive pass on the
tours, "a third tour for Sheets is warranted, though it will likely be shorter," and "the other two may
need updates at this point since things have developed." Nothing outside the tours was changed except
what a card names or links (the help page, the privacy page's key list).

Method: both existing tours' code and copy (`desk-first-use.mjs`, `tour.js`, `desk-tour.js`,
`tour-runner.js`, `first-use.js`) read in full against today's UI code; the PRs merged since Audit 4
read for what they changed under the tours' feet (section A); then a live run of all three tours in the
browser pane after the build, with the site's storage cleared first (the last section).

IDs carry a 7 (`TR7`), so they never collide with Audit 4's `TR4`. Fixed items say so; the two
observations changed nothing.

## Bottom line

**The two tours: keep both, six small fixes, and one to the runner they share (TR7-9).** Audit 4's call stands. Their structure and behavior are as it
left them: after #504 no tour file changed, and what moved is the UI under them. Three
cards had gone stale or silent (TR7-1 to TR7-3: five templates are now seven, the title menu has Full
screen and a notebook page, the verse menu has "Add to sheet"), the help page still counted two tours
(TR7-4), the desk tour's "Sheets" step led nowhere further (TR7-5), and with two tours on /desk either
could be started over the other (TR7-6).

**A third tour, for the Sheets (E63).** BVJ's call, and a short one: eight cards in two parts, run on
/desk in a Sheets pane and on the Sheets page (/sheets), acting on each real page. It writes nothing, not
even the sheet it makes (section D).

## A. What changed under the tours

Audit 4 read `4a5b7c3c`. Besides its own two PRs (#500, #501), the tours' files changed once since
(#504, E59's two sheet steps). Every PR below that is not "nothing" moved the UI a card describes.

| PR | Merged | Title | For the tours |
|----|--------|-------|---------------|
| #482 to #498 | 2026-11-07 | Audit 3's work sessions and cleanups | Nothing new: all in the code Audit 4 read (its commit, `4a5b7c3c`, is #498's merge) |
| #499 | 2026-11-07 | npm run test:desk: the Study Desk's tests alone | Nothing; the tours' tests run in it |
| #500 | 2026-11-07 | Study Desk audit 4 (scoped) | The baseline: TR4-1's fix to the search step, and the findings this pass re-checks |
| #501 | 2026-11-07 | Study Desk Audit 4: the open items | TR4-4's step title ("Undo, and Hide my marks"), and the first-use card (FU4-1, FU4-2) |
| #502 | 2026-11-08 | Audit 5: the Sheets, as a first-time ministry leader | The Sheets pane and its ghost prompts, the dimmed words card 3 of the Sheets tour names |
| #503 | 2026-11-08 | Study Desk pills: match widths on /read | Nothing for the tours |
| #504 | 2026-11-08 | Audit 5 follow-ups: BVJ's decisions, adding a part from the gap | The desk tour's "Sheets" and "New sheet" steps (E59); the gap's "Add" pill and "+ From my notes…" (E60, E62), which the Sheets tour's last cards name |
| #505 | 2026-11-08 | Audit 5, section D: own templates, minutes, the print check, the key terms box | Seven templates (Swedish method and Contextual Bible Study added), so "New sheet"'s five went stale (TR7-1); own templates, minutes and the key terms box are on Sheets tour cards 2, 3 and 6 |
| #506 | 2026-11-08 | Audit 6: the Sheets as a new user again | Nothing for the tours (findings only) |
| #507 | 2026-11-08 | Audit 6: fix every finding that needs no decision | Nothing for the tours (no tour file touched) |
| #508 | 2026-11-08 | Plan S12: editing on the Sheets page, and the ways in | A plan; nothing |
| #509 | 2026-11-08 | Audit 6: BVJ's decisions | SH6-7: a new sheet is a draft written on its first change, which is what lets the Sheets tour show a sheet without writing |
| #510 | 2026-11-08 | Subset fonts carry their copyright; image credits | Nothing |
| #511 | 2026-11-08 | A shared sheet opens on a phone or tablet | Nothing (the desk does not run there) |
| #512 | 2026-11-08 | Move the Sheets client code into `sheets/` | The Sheets tour's code lives there; older records name the files without `sheets/` |
| #513 | 2026-11-08 | S12 step 1: separate the sheet editor from the Sheets pane | `createSheetEditor`, the object the Sheets tour drives, and where its example mode is added |
| #514 | 2026-11-08 | Edit a sheet on the Sheets page (S12, step 2) | Nothing; the tour stays on /desk |
| #515 | 2026-11-08 | Two tabs on one sheet | Nothing |
| #516 | 2026-11-08 | Greek search files carry their build | Nothing |
| #517 | 2026-11-09 | Audit 6: the Sheets list leaves the editor | `my-sheets.js`, the list view card 1 marks and where the tour's link goes |
| #518 | 2026-11-09 | LG6-2: finish splitting the sheet editor | The part cards, add forms and add bar that cards 3 to 6 mark |
| #519 | 2026-11-09 | Lectio's prompts invite the leader's words | Nothing for the tours |
| #520 | 2026-11-09 | S12 step 4: the ways into the Sheets | "Add to sheet ▸" on chapter pages (TR7-3); "My sheets" beside the notebook page (TR7-7); a pane's "Open on its own page" (card 7) |
| #521 | 2026-11-09 | S12 step 5: header C | Nothing for the tours |

## B. Audit 4's tour findings, re-checked

TR4-1 to TR4-6 hold in the code: the search step's ">" card, "Pin a footnote" in the Notebook part,
"Undo, and Hide my marks," one clause in "Your panes," the "as here for the tour" flag sentence, and
"Move as I read" out of "Open the menu." TR4-7's outline rule is unchanged (`tour-runner.js` did not move).

## C. The tours (`TR7`)

#### TR7-1 · Low · wording · desk tour · FIXED

**"New sheet" names five templates; there are seven.** Since #505 (`TEMPLATES` in
`src/lib/desk-sheet-templates.mjs`): Bible study, Sermon preparation, Class session, Lectio divina,
Swedish method, Contextual Bible Study, Blank canvas. The body no longer counts them, so it cannot go
stale again and the tour does not import the template module: "“New sheet…” in the title menu starts one.
Choose a template, from a Bible study to lectio divina, or a blank canvas, and the sheet opens with its
parts ready to fill. The chooser is open here only for the tour; nothing is made." Adding passages
moved to the Sheets tour (card 4).

#### TR7-2 · Low · wording · desk tour · FIXED

**"The title menu" omits Full screen (E43) and My notebook page.** Now: "“Study Desk” is a menu for the
page itself: adding a pane, the layout, a new sheet, printing, display options, and full screen. Your
notebook page, this tour, and help for the Study Desk are here too."

#### TR7-3 · Low · wording · notebook tour · FIXED

**"Open the menu" says nothing of "Add to sheet ▸,"** which #520 added to Chapter View's verse menu and
selection panel after Print. The `study` wording gains one clause (the card stays six lines): "“Add to
sheet” puts the verse on one of your sheets." The `read` and `prose` wordings do not change, since Read
View has no Add to sheet.

#### TR7-4 · Low · copy · help page · FIXED

**"The tours" says "There are two," and the Study Desk paragraph says only "adds a pane and tries a
layout."** Since E59 it also shows a Sheets pane and the template chooser. The section now counts three,
describes the Study Desk tour as it runs, and adds the Sheets tour with a link to each page it runs on; the
Sheets section's first paragraph points to it.

#### TR7-5 · Low · design · desk tour · FIXED

**The "Sheets" step is a dead end.** "My Notes" links the notebook tour; "Sheets" now links the Sheets tour
the same way (`more: "See one made, printed, and presented: the Sheets tour"`, opened in a new tab).

#### TR7-6 · Low · robustness · both /desk tours · FIXED

**"Take the tour" in the title menu could start the Study Desk tour over a running Sheets tour, and the
reverse from the Sheets pane's link:** each runner knows only its own run. Both `start()`s now return while
`html[data-desk-tour]` is set (the runner sets it for any run and clears it 900 ms after the end).

#### TR7-7 · Nit · observation

The notebook tour's "The notebook page, and where it’s kept" marks `.desk-panel__page a`. #520 put "My
sheets" beside "Open the notebook page" in that paragraph; `querySelector` still returns the first link, the
notebook page's, which the card names. Left as it is; the Sheets tour covers sheets.

#### TR7-9 · Nit · robustness · all tours · FIXED

**A tour started with nothing focused ended with focus on `body`.** `tour-runner.js` took
`document.activeElement` as the place to return to when the tour named none; started by its address
(`?desk-tour` on a chapter, `?sheet-tour` on /desk) that is `body`, which "is showing", so the fallback
(the Notebook's tab or panel, the Sheets pane's name) was never used. Found in the live run of the Sheets
tour; the runner now treats `body` as no place to return to. The Study Desk tour was never affected, since
it names its title button. **A second case on /sheets**: the page's `finish` redraws what the address names
asynchronously, and the runner returned focus a frame after calling it, so the fallback found a control of
the view about to be replaced and focus dropped to `body` once it was. The runner now waits for a `finish`
that returns a promise before it returns focus; the other two tours' return nothing, so nothing changes for
them.

#### TR7-8 · observation

Claims re-read against the code and found current: `sync` names the five following kinds exactly as the
lead flag's label does (`desk-page.js`); `mine` names no sheets (My Notes lists none); `pin`'s "Pinned
footnotes" heading (`tab-mine.js`); `undo`'s Ctrl+Y (#468); `panel`'s » (`ICON_COLLAPSE`, two chevrons);
`layout`'s "Make this my default" (`desk-page.js`); `search`'s ">" commands (TR4-1). Re-run live in the
last section.

## D. The Sheets tour (E63)

**Where:** on /desk, in a Sheets pane, run by the shared `desk/tour-runner.js` like the Study Desk tour,
and on /sheets, acting on that page's list, editor and versions view. The first version ran on /desk only
(the LIT pane's "Add to" row and "Open on its own page" are only there, and the desk tour's "New sheet…"
sends people there). BVJ (2026-11-09) then asked for the page too: since header C's Study menu and S12's
ways in ("My sheets" in the menu and on /notebook, "Open the sheet" from "Add to sheet ▸" and /search), the
Sheets page is a reader's first meeting with the Sheets, so the tour must be there and act there. An offer on
/sheets that sent readers to `/desk/?sheet-tour` was weighed and declined. The tour is one core
(`sheets/sheet-tour.js`) with two hosts: the desk's (`sheets/sheet-tour-desk.js`) and the page's, built in
`sheets/sheet-page.js`.

**What:** eight cards in two parts, "Making a sheet" and "Using a sheet" (`SHEET_TOUR_STEPS`,
`SHEET_TOUR_PARTS` in `src/lib/desk-first-use.mjs`; `sheets/sheet-tour.js`). Every step is `notebook: true`,
since a sheet is a notebook record, so with no store the tour never starts.

| # | id | Part | Card | Shows on /desk | Shows on /sheets |
|---|----|------|------|----------------|------------------|
| 1 | `list` | 1 | My sheets | the Sheets pane's list; marks "New sheet" | the page's own list; marks its "New sheet…" button |
| 2 | `templates` | 1 | Start from a template | the chooser, open; marks it | the list's chooser, open; picking a template starts the tour's sheet in its editor, not a route |
| 3 | `parts` | 1 | The parts | a tour-only sheet from the Bible study template; marks the first card's minutes and Leader only | the same, in the page's editor view |
| 4 | `passage` | 1 | Add a passage | the LIT pane's verse menu on a verse; marks its "Add to “…”" row (falls back to the Reading part's passage form) | no verse menu: the Reading part's passage form, `page` wording |
| 5 | `blanks` | 1 | Blanks and footnotes | a passage added in memory; marks "Blank the selected words" and the notes summary | the same |
| 6 | `words` | 1 | Your own words, and more | the add bar | the same |
| 7 | `print` | 2 | Print or share | the header's "Print or share…" link | the versions view drawn for the tour's sheet; marks the Version choice and the actions |
| 8 | `present` | 2 | Present | the header's "Present…" link | the same view; marks the bar's Present button |

Five cards carry a second wording for the page (`stepBody(step, "page")`): `list`, `templates`, `passage`,
`print`, `present`. The others read the same on both.

**Rules, as for the desk tour:**
- **It writes nothing, not even its sheet.** At the start it closes the title and Layout menus, freezes the
  layout (`layoutFrozen`), and shows the original layout with a Sheets pane added (a column, else the first
  pane that is not the LIT turned to Sheets, as the desk tour's "Sheets" step does); at the end it drops
  the tour's sheet, puts the reader's layout back, and unfreezes. The sheet is the editor's **example mode**
  (`setExample`, `endExample` in `sheet-editor.js`): changes apply in memory, `persistDraft` returns at once,
  so even "Print or share…" and "Present…" write nothing. On /sheets the tour never changes the address or
  history: it draws its own views into the page and ends by redrawing what the address names; one editor
  instance stays alive across those views and is destroyed only at the end. The versions view can be drawn
  for the unsaved sheet because `drawSheet` has a `demo` mode (no shared banner, no links row that would leave
  the tour, "Edit" back to the tour's editor). One edge is accepted: Present's presenter window cannot find
  an unsaved sheet.
- **Steps are self-sufficient**, so Back, "Skip this part" and a start at any card work: a step starts the
  tour's sheet and its passage if they are missing. A step's `later` undoes only what it opened.
- **The passage is the leading LIT pane's chapter** from the verse it is at, two verses, read as the pane
  reads it. Offline, the card goes beside the sheet.
- **Seen list:** `lit-desk-sheet-tour`, the same shape as the other two; every step is marked seen as the run
  starts. A reader done with both other tours is a first-time reader of this one. **One list serves both
  pages** (BVJ's ask): taking the tour, "Remind me later" or "Don't show this again" on either page counts on
  both, and a tour of new steps is offered once.

**Ways in, on /desk:** `?sheet-tour` (the help page links it); "Take the Sheets tour" at the foot of the
Sheets pane's list; the offer, a window beside the Sheets pane the first time one is on screen with no tour
running and the Study Desk tour's offer not up; and the desk tour's "Sheets" card (TR7-5). Not the title
menu (that "Take the tour" is the Study Desk's) and not a search command. **On /sheets:** `/sheets/?sheet-tour`
(stripped from the address); a "Take the Sheets tour" button after the list's intro paragraph; and the offer,
beside the page's content 1.6 s after the list or a sheet's versions is drawn (never in the editor, on a
shared sheet, in present mode, or on a phone). The page loads none of the tour's code, nor the rules that
decide the offer (`desk-first-use.mjs`, which brings `desk-layout.mjs` with it), until one of these asks or
the 1.6 s passes, so a page opened to print or present is as light as before: its static imports are
exactly what they were before this audit.

**Privacy:** `lit-desk-sheet-tour` is named in /privacy's list after `lit-desk-page-tour`.

## Live run

Browser pane, dev server on the branch, 2026-11-09, on this browser's own desk (a saved three-pane
layout, the LIT beside a Sheets pane beside My Notes, and fifteen sheets in the notebook), the
layout key and the sheet store read before and after each run:

- **The Sheets tour, from its offer**: the offer came up beside the Sheets pane 1.6 s after the
  page drew (the Study Desk tour's did not, its steps all seen); "Take the tour now" switched the
  desk to the original layout with a Sheets column (the LIT, My Notes, Sheets), and the eight
  cards ran in order, each beside its target with the marks named in section D: the list with
  "New sheet", the chooser, the Bible study sheet's first card with its minutes and Leader only,
  the LIT pane's menu on John 3:15 with "Add to “Untitled sheet”", John 3:16–17 added under
  Reading with "Blank the selected words" and "Footnotes: 3 of 3 print", the add bar, "Print or
  share…", "Present…". Done put the three-pane layout back, the Sheets pane showed the list, and
  the layout key and the store were byte for byte as before. The tour's pane got the id `p3`,
  the same as the reader's own Sheets pane, so the "same id, same kind" case ran: the editor
  survived the redraw and `endExample` showed what the layout says.
- **Escape at card 3, from the list's link** (the link focused and Enter pressed): the layout
  and the store unchanged, the list back, focus on the Sheets pane's name (the link had gone with
  the list).
- **`/desk/?sheet-tour`**: the address stripped, card 1 up after the panes settled; Escape left
  everything as it was. The first time, focus ended on `body` (TR7-9, since fixed: now the
  pane's name).
- **The Study Desk tour, `/desk/?desk-tour`**: nine cards; card 5 carries "See one made,
  printed, and presented: the Sheets tour" linking `/desk/?sheet-tour` in a new tab; cards 6
  and 7 read as TR7-1 and TR7-2 say; the layout key and the store unchanged at the end, focus on
  the title.
- **The notebook tour, `/john-3/?desk-tour`**: ten cards; card 1 ends "“Add to sheet” puts the
  verse on one of your sheets."; card 9's box held ">" with ten commands listed; at the end the
  box was empty, the tray shut, the Notebook's three keys unchanged, and focus on the Notebook
  (the fallback, not `body`).
- The help page renders four tour links (`/john-3/?desk-tour`, `/desk/?desk-tour`, `/desk/?sheet-tour`,
  and, since the second round, `/sheets/?sheet-tour` twice); `npm test` passed 3,368 tests after the
  first round (9 new).

**The second round, on /sheets** (the same browser, 2026-11-09, a 1234 px window; the layout key and the
sheet store read before and after each run):

- **From the offer, on the list**: the offer came up 1.6 s after the list drew, over the content's top
  right corner (the column runs from 98 to 1120 px, so neither side has the 360 px a window beside it
  needs: the rule's third placement), and showing it wrote `later` to `lit-desk-sheet-tour`. "Take the
  tour now" ran the eight cards on the page's own views, with the address `/sheets/` untouched throughout:
  the list with "New sheet…" marked; the chooser open beside its card; the Bible study sheet in the page's
  editor (the title "Edit a sheet"), its first part's minutes and Leader only marked; the passage form under
  Reading; John 3:1–2 (Continue reading's chapter, from verse 1) added in memory, with "Blank the selected
  words" marked; the add bar; the versions view of the unsaved sheet, drawn with the Version choice, the
  paper, the codes, the answer key, Edit, Present, Print, Copy, Save as and Share, and without the links
  row or a banner (`demo`); then the Present button. Done drew the list, left the address alone, put focus
  on the "My sheets" heading, scrolled back to the top, and the store held fifteen sheets and the layout key
  341 bytes, as before.
- **`/sheets/?sheet-tour`**: the parameter stripped, no offer, card 1 up 600 ms after the list. Lectio
  divina picked in card 2 became the tour's sheet (its "Before you lead", "Read", "Reflect"), and card 3 kept
  it; Back from card 7 re-attached the same editor with its passage; Escape at card 6 drew the list, focus
  on the heading, the store unchanged.
- **The intro's "Take the Sheets tour"** started the tour; it wears the pane's quiet link (13 px, 4 by 6 px
  padding, inline after the paragraph).
- **The offer on a sheet's versions view** came up the same way over the content's corner; "Remind me later"
  wrote `later`. With the key cleared again, `view=edit` and `view=present` got no offer.
- **The other two tours after the runner change**: `/desk/?desk-tour` and `/john-3/?desk-tour`, skipped
  from card 1, each took the card down, cleared `data-desk-tour` and returned focus (the title; the
  Notebook). On /desk the Sheets tour's first-time offer then came up beside the Sheets pane, as a desk with
  a Sheets pane and an unseen tour gets it.
- **The Sheets tour on /desk, `/desk/?sheet-tour`**, re-run on the core through its desk host: the tour
  layout (the LIT, My Notes, Sheets), the list, the chooser, the Bible study sheet, the LIT pane's menu on
  John 3:16 with "Add to “Untitled sheet”", John 3:16–17 with its blanks, the add bar, "Print or share…",
  "Present…"; Done put the three-pane layout back with the Sheets pane on its list, the layout key and the
  store unchanged, focus on the Sheets pane's name.
- **Found in this round and fixed before it shipped**: the end-of-tour focus on /sheets (TR7-9's second
  case), and the page's static import of the offer's rules, which brought `desk-first-use.mjs` and
  `desk-layout.mjs` (86 KB of source) into the chunk a phone's shared-sheet viewer and a print page load;
  both now come by `import()` in the 1.6 s timer, and the page's static graph is the 53 modules it was.
- **Seen and accepted**: on the page the card lies over the editor's column on cards 3 to 6 whenever the
  window is under about 1680 px (the column is 958 px wide and centered, so a side needs 360 px), and on
  card 3 it can cover part of the first part's header; the marks still show, a wide screen has the room,
  and on /desk the card sits beside the pane. The runner's placement is the three tours', so this is left
  as it is.
- `npm test` passes 3,373 tests (5 new in this round); `npm run check` finds no errors; the build passes.

One trap for the next auditor: a ref click in the pane scrolls its target to the viewport's center
first, and in the Sheets pane's scroller that opened a sheet instead of pressing the link
(the browser-pane pitfalls note); focus the control and press Enter instead.

## Not covered

No screen reader, Firefox or Safari pass; the desk and its tours do not run on phones or tablets.
