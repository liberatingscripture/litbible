# Study Desk Audit 3

Audited 2026-11-06 and 07 at commit `60af379e` (`main`, branch `claude/desk-audit-3`), after
53 commits since Audit 2 (every FA2 work session, #446 to #461, then Phase 5's E5 to E57).

Everything the desk is: the Notebook panel and its tabs, the margin marks and footnote pills,
the Copy, Share and Print flyouts every reader now gets, the Greek tab, Greek search and the
search builder, the `/desk` workspace and its panes (Book Intro included), sheets (editor,
`/sheets/`, present mode, print, share, and saving as .docx, .odt, .rtf, .md, .pptx, .odp and
PDF), `/notebook/` and its help, the data layer and the shared record format, and the launch.
Audits 1 (`STUDY-DESK-AUDIT-1.md`, BA1 to BA153) and 2 (`STUDY-DESK-AUDIT-2.md`) and the E log
(`STUDY-DESK-FIXES.md`) are the baseline: this audit reports what they do not cover, re-checks
their fixes, and spends most of its effort on the code written since.

Nothing in the repo was changed while auditing. IDs carry the auditor's prefix with a 3
(`SEC3`, `DI3`, `NB3`, `DK3`, `GK3`, `LG3`, `LV3`, `CP3`), so they never collide with Audit 2's.

## Bottom line

**The desk is in good shape, and better than at Audit 2.** No Critical finding, and after
verification no High one. All 3,026 tests pass, all 260 chapters validate, `astro check` is
clean, the build succeeds and the link check finds 0 broken of 41,074. The merge converged over
8,000 fuzzed three-replica histories; a full backup round-trips losslessly; the sanitizer held
through 60,000 random runs after E55's parser change; 8,000 hostile Greek queries escaped
cleanly and brute-force search matched an independent matcher. The newest and largest surface,
saving a sheet as five file formats, produced well-formed files on every awkward sheet tried
(Greek, Hebrew, emoji, `&` and `<` in titles, empty sheets) and opened correctly in
LibreOffice; hostile text produced no field, DDE, object or remote resource. Audit 2's fixes
held, with three exceptions (below).

What is left is smaller and more local than Audit 2's list:

1. **Two bugs every reader meets today, desk on or off** (NB3-1, NB3-2). E39 made the desk's
   flyout the Copy and Share rows of every verse menu. A mouse hover opens the flyout and the
   click that follows closes it; and "Share image" on a passage too long for an image hides the
   "Share text…" row and drops keyboard focus. Both confirmed live with the desk off.
2. **A fix that reached one path and not its sibling, three times.** Audit 2's LV-3 (a sheet
   listed as "Sheet / Sheet") was fixed in `record-rows.js`, but My Notes builds its own rows in
   `tab-mine.js` (LV3-3). GK-12's new button reused the class of the credits block, which now
   draws as a pill (GK3-1). SEC-6's size caps skip a record of a newer schema (SEC3-1). Audit 2
   named this pattern as its first theme; it is still the commonest way a bug gets in.
3. **Small losses of what the reader set.** Choosing Reading twice forgets which marks to bring
   back, so verse numbers, footnote letters, key terms and highlights stay off site-wide
   (LV3-2). Escape in "Search my notebook" empties the field but leaves the list filtered, and
   folds the panel (LV3-1).
4. **Sync-readiness, on the shared format.** Under the five minutes of clock skew the format
   allows, a delete, a restore or an Undo made on the slower clock is undone when the copies
   meet (DI3-1; a website-only fix, with a note for BDR). Run over every chapter revision in
   git history, 15 of the 18 marks that "moved" landed on the wrong words, 13 of them verified
   in another verse (DI3-2; a format change, which waits on BDR with spec 3 and merge vectors 4).
5. **The next two years.** `start()` in `desk-page.js` is 1,706 lines (906 at Audit 2), the
   desk's `CLAUDE.md` grew 75% in four days to 136 KB, the launch checklist misses files and
   Read View's retirement, and at launch every desktop chapter page would load about 124 KB
   gzipped of desk script (LG3-1 to LG3-5).

### Counts

Severities are each auditor's own. The verifier's changes are in the priority list and in
"What the verifier changed" below.

| Slice (auditor, model) | Critical | High | Medium | Low | Nit | Total |
|---|---|---|---|---|---|---|
| A. Security, `SEC3` (Opus) | 0 | 0 | 1 | 3 | 1 | 5 |
| B. Data integrity and sync-readiness, `DI3` (Fable) | 0 | 1 | 4 | 1 | 0 | 6 |
| C. Notebook panel, marks, shared panels, first use, `NB3` (Sonnet) | 0 | 0 | 5 | 8 | 1 | 14 |
| D. /desk, sheets, saved files, `DK3` (Sonnet) | 0 | 0 | 1 | 9 | 2 | 12 |
| E. Greek tab, search and builder, `GK3` (Sonnet) | 0 | 0 | 3 | 12 | 2 | 17 |
| F. Longevity and launch readiness, `LG3` (Sonnet) | 0 | 0 | 5 | 7 | 2 | 14 |
| G. Live browser pass, `LV3` (Sonnet) | 0 | 0 | 3 | 3 | 0 | 6 |
| H. Copy rules, `CP3` (Haiku) | 0 | 0 | 0 | 1 | 6 | 7 |
| **Total** | **0** | **1** | **22** | **44** | **14** | **81** |
| After verification | 0 | 0 | 17 | 49 | 14 | 80 |

"After verification" applies the verifier's severities (DI3-1 to Medium; DI3-3, DI3-4, DI3-5,
SEC3-1 and DK3-1 to Low), the live pass's partial verdict on GK3-2 (to Low), and drops CP3-1
(see "Corrections").

## Priority list

### Tier 1: fix next (small, and each one is a reader's own work or every reader's panel)

| # | ID | What | Why it ranks here | Fix, in brief |
|---|---|---|---|---|
| 1 | NB3-1 (Medium) | In every reader's verse menu and selection panel, hovering "Copy text ▸", "Share ▸" or "Print ▸" opens the flyout, and the click that follows closes it. | Live site, desk off: every mouse reader. Confirmed live. `src/scripts/CLAUDE.md` says a click moves focus in, so this is a bug, not a choice. | In `flyoutRow` (`panel-flyout.js`), a click on a trigger whose flyout is open by hover moves focus in rather than closing; close only on a second click once focus is inside, or not at all. |
| 2 | NB3-2 (Medium) | "Share image" on a passage too long for an image hides the "Share text…" row and drops focus to `<body>`. | Live site, desk off, wherever a share sheet exists (phones, Safari, Edge). Confirmed live. | Keep the Share row (or put "Share text…" back) when the image step ends in "Too long"; return focus to the row. |
| 3 | LV3-2 (Medium) | Choosing Reading while its marks are already off writes an empty list over the remembered one; leaving Reading then restores nothing. | Verse numbers, footnote letters, key terms and highlights are site-wide settings: they stay off on every chapter page, with no note why. Confirmed live and in `turnOffMarks` (`reading-display.js`). | Remember only when something was turned off (or union with what is remembered). DK3-2 is the same feature (marks come back only through Layout). |
| 4 | LV3-3 (Medium, REGRESSION LV-3) | Sheets list in My Notes as identical "Sheet / Sheet" rows under "Other items", with "Delete sheet" and "Labels for sheet" naming neither. | Audit 2's fix went into `recordRow`; My Notes' `rowFor` (`tab-mine.js`) has no sheet branch. A reader can delete the wrong sheet. Confirmed live and in code. | ~~Give `rowFor` the sheet branch from `recordRow`.~~ BVJ, 2026-11-07: leave sheets out of My Notes (see Decisions). |
| 5 | LV3-1, NB3-6 (Medium, Low) | Escape in "Search my notebook" empties the field (the browser's way, with no `input` event), the list stays filtered ("Nothing matches"), and the Notebook folds. | A reader clearing a search sees an empty notebook and loses the panel. Confirmed live. | Listen to `search` too; let Escape in a non-empty search field only clear it. |
| 6 | DI3-1 (Medium, High once sync ships) | A delete, a restore, or an Undo of an edit made on the slower of two clocks (inside the five minutes the format allows) is undone when the copies meet. | Reproduced with the real merge by the auditor and again by the verifier, who found the Undo case. Silent; no BDR agreement needed for the website fix. | `trashRecord`, `restoreFromTrash` and `restamped` (`desk-history.mjs`) stamp past what they replace (`laterThan`), as DI-8 did for edits; extend the format's "Room for skew" bullet as a note for BDR; two merge vectors. |
| 7 | NB3-3 (Medium) | In the footnotes' "⋯" mode, saving a note on a footnote hides the "⋯" that holds focus, so focus drops to `<body>`. | Keyboard readers lose their place after the commonest action there. Confirmed live. | After the save, focus the footnote's other pill or its letter when `pillsHome` returns a hidden button. |
| 8 | GK3-1 (Medium, REGRESSION GK-12), GK3-6 (Low) | The Greek tab's "Sources and licenses" block draws as a rounded pill (a class shared with the new "Show sources" button). Typing "constructor" in search shows "“constructor” is also a Greek word (function Object() { [native code] })". | Both visible, both confirmed live, both one-line fixes. GK3-6 reaches every reader once Greek search launches. | Rename the button's class; `Object.hasOwn` (or a null-prototype object) in `greekOfferFor`. |

### Tier 2: before launch

**The shared format, with BDR** (one round, with spec 3 and merge vectors 4, which still await
BDR's confirmation): DI3-2 (a notice on a `moved` that leaves its verse: the verifier showed the
other option misses Matthew 23), DI3-1's format note, DI3-5 (`star` read as `emphasis`, and the
full list of marker names either app has written), DI3-3 (the bookmark follower's writes beat a
rename or "Move as I read" off from another device: a rule to choose, see Decisions).

**Launch readiness:** LG3-1 (complete the checklist: eight files and Read View's retirement),
LG3-4 (promote the auditor's import-closure script to a test, so no shared script can pull in
the desk), LG3-2 (decide whether about 124 KB gzipped on every desktop chapter page is
acceptable), NB3-4 (a help page for the Study Desk: panes, sheets, Save as, Print ▸, footnote
pills are undocumented).

**Accessibility:** NB3-5 (My Notes' count is not announced), GK3-3 (builder chips have no
forced-colors state), NB3-8, NB3-10, NB3-11, DK3-7, DK3-8, GK3-8, GK3-10, LV3-4 (two endings drop
focus to `<body>`).

**Records and import:** DI3-4 (keep a deletion as a tombstone when only its held copy is bad),
SEC3-1 (a size ceiling for records of any schema), SEC3-2 (scrub every imported block, not only a
passage's words), SEC3-4.

**Files:** DK3-1 (a long paragraph overflows a .pptx slide unless PowerPoint refits it on open;
open one deck in PowerPoint to settle it), SEC3-3 (the Save as menu says "Participant version"
above the Slides group, whose speaker notes hold the answers by BVJ's E37 decision: move the line
into the document group).

**Maintainability:** LG3-3 (`start()` is 1,706 lines), LG3-5 (a size cap for the desk's
`CLAUDE.md`, and build narrative kept in the E log).

### Tier 3: polish and nits

Everything else in the appendices: NB3-7, NB3-9, NB3-12 to NB3-14; DK3-2 to DK3-6, DK3-9 to
DK3-12; GK3-2, GK3-4, GK3-5, GK3-7, GK3-9, GK3-11 to GK3-17; LG3-6 to LG3-14; LV3-5, LV3-6;
DI3-6; SEC3-5; CP3-2 to CP3-7 (six numbers typed into copy that agree with their constants
today).

## Themes

- **One path fixed, its sibling missed.** LV3-3, GK3-1, SEC3-1, SEC3-2 and DI3-1 are each a fix
  that covered the path the finding named and not a second path to the same thing (a second
  row builder, a reused class, a newer schema, other imported blocks, deletions beside edits).
  When fixing, grep for the other callers of what the finding describes, not just its line.
- **Desk components now ship to every reader.** The flyout, born in the desk, is the Copy and
  Share rows of every verse menu (E39). NB3-1 and NB3-2 are live-site bugs as a result. A change
  to `panel-flyout.js` or `chapter-tools.js` needs a check with the desk off.
- **The shared format waits on one conversation.** Spec 3 and merge vectors 4 are "for BDR to
  confirm"; DI3-1's note, DI3-2, DI3-3 and DI3-5 add to the same two files. Settling them in one
  round costs BDR one review instead of four.
- **The code and its record are growing faster than they are being shaped.** `desk-page.js` is
  89% one function; the desk's `CLAUDE.md` costs about 34,000 tokens at the start of every desk
  session on a Pro plan.
- **Still never tested with a real screen reader**, nor in Safari, Firefox, PowerPoint, Word,
  Keynote or Google Slides (Not covered, below).

## Decisions needed from the owner

Collected from the appendices. The first four block work.

1. **A mark that moves to another verse: say so?** (DI3-2; Audit 2's question 1.) The verifier
   recommends a notice on any `moved` that leaves the mark's verses; the stricter-context option
   would not catch the Matthew 23 case. Spec change, so BDR must agree.
   **Decided (BVJ, 2026-11-07): the recommendation.** A `moved` that lands
   outside the mark's verses while they still exist carries the change notice;
   one inside them stays silent. Spec version 4 with new vectors, built in
   session 5. Recorded in `STUDY-DESK.md` for BDR to review and amend.
2. **Bookmarks across devices** (DI3-3): should "a move never beats an edit" be the rule (the
   follower stops when the record changed under it), should a bookmark's place carry its own time,
   or is whole-record newest-wins accepted with the consequence written down?
   **Decided (BVJ, 2026-11-07): the recommendation**, which is the place's own
   time, since stopping the follower can't help: a reading device writes every
   2 seconds, so any edit from elsewhere arrives older than its last move and
   loses under rule a. A bookmark carries `placedAt` (its book, chapter, verses
   and `contentVersion`) and `editedAt` (everything else); a merge takes each
   group from the copy whose stamp is newer, and `modified` is the later of
   the two. A copy without the stamps (an app not yet updated) merges by rule
   a as now. The follower writes only the place and `placedAt`. Merge vectors
   version 5, built in session 5. Recorded in `STUDY-DESK.md` for BDR to
   review and amend.
3. **About 124 KB gzipped of desk script on every desktop chapter page at launch** (LG3-2):
   acceptable, or should the shell load on the Notebook's first expand? If acceptable, say so in
   "Launching" so the next audit doesn't reopen it.
   **Decided (BVJ, 2026-11-07): load it lazily.** A reader with nothing kept
   and the Notebook minimized (the default) downloads only a small first
   stage: the tab, and a check of the notebook for anything to draw. The rest
   of the shell, and `desk.css`, come when there is something to draw or the
   reader opens the Notebook. Built in session 6, measured on `dist/`.
4. **Read View's retirement (8c): in the same change as the flip, or after?** (LG3 Q2.) The guard
   test makes a half-way state fail CI.
   **Decided (BVJ, 2026-11-07): the same change.** Session 6 adds it to the
   "Launching" checklist (LG3-1), with the guard test deleted in that change.
5. **The help page** (NB3-4): a Study Desk help page of its own, or `/notebook/help/` renamed
   "Study Desk help" and widened?
   **Decided (BVJ, 2026-11-07): one shared page, "Study Desk help", at
   `/desk/help/`** (the location on Claude's recommendation, which BVJ left to
   Claude). The desk is the name over all of it (the Notebook, /desk, sheets,
   the Greek), so its help sits under /desk, beside the page its title menu
   opens it from. `/notebook/help/` redirects there (the privacy page and old
   links use it); `HELP_HREF`, `WAYS_HREF` and `desk-commands.mjs` move with
   it, and the sitemap filter gains `desk/help`. Built in session 6, with
   the sections NB3-4 lists.
6. **Slides in the participant version** (SEC3-3): (a) say the speaker notes hold the answers,
   (b) leave the notes out for that version, or (c) keep E37 as it is and move the menu's
   version line into the document group (the verifier's reading: only the line misleads).
   **Decided (BVJ, 2026-11-07): (b).** Slides saved while the participant
   version is on screen carry no answers and no Leader only parts in their
   speaker notes; the leader's version keeps E37 as it is. Session 3.
7. **A record too large, from a newer schema** (SEC3-1): refuse it on the way in with a reason,
   or keep it and draw only the first 64 KB? BDR's sync will need the same rule.
   **Decided (BVJ, 2026-11-07): Claude's recommendation, refuse it on the way
   in.** `validateRecord`'s common block, which runs for every schema, refuses
   a record whose serialized size passes 1 MB, with a reason in the import's
   report. Drawing only the first 64 KB would still store, back up and sync
   the whole thing; a ceiling far above every real limit costs a newer
   client nothing and keeps SEC Q2 option B (a kept record is never
   rewritten). Session 5; noted in `STUDY-DESK.md` for BDR.
8. **A deletion whose held copy can't be read** (DI3-4): keep it as a tombstone (recommended)?
   **Decided (BVJ, 2026-11-07): keep it as a tombstone**, reported as "its
   words couldn't be read, so it can't be restored." Session 5; noted in
   `STUDY-DESK.md` for BDR.
9. **A size cap on `src/scripts/desk/CLAUDE.md`, and build narrative kept in `STUDY-DESK-FIXES.md`?**
   (LG3-5.)
   **Decided (BVJ, 2026-11-07): yes to both**, as LG3-5's fix proposes: a cap
   test that starts near today's size and comes down as the file is trimmed,
   rules and their reasons kept, the story of how each E number was built
   moved to the E log. Session 6.
10. **Reading's marks** (DK3-2): should leaving Reading by Add pane or a drag also bring them
    back? And `?intro=` with no room (DK3-3): fall back to an open pane, or say so?
    **Decided (BVJ, 2026-11-07): DK3-2, yes, with a message.** Any way out of
    Reading turns the marks back on and says so (the undo bar Layout's way
    out already shows). **DK3-3: tell the reader** ("There's no room for a
    Book Intro pane," as the Search pane already says). Session 3.
11. **Long slides** (DK3-1): cut inside a very long paragraph, or one block per slide?
    **Decided (BVJ, 2026-11-07): cut at sentence boundaries,** across as many
    slides as the paragraph needs, as `chooseCuts` already does for verses.
    Session 3.
12. **Greek** (GK3 Qs): a narrow fallback for command queries that find nothing under the
    lemma-first rule (`ἐξ.prep`); the builder accepting LIT renderings and plain Latin pairs;
    the 300-character cut as an error or a note; and applying the cautious licence to the 25
    search glosses identical to "(ML)" entries.
    **Decided (BVJ, 2026-11-07).** (1) The narrow fallback:
    yes, only when the lemma-first reading finds nothing under the typed
    filters and another lemma with the same spelling finds something.
    (3) An error with a note: past 300 characters the query isn't searched or
    cut, and the field says why and is left as typed. (4) The 25 glosses take
    the cautious CC BY-SA route, as the best information there is; say so in
    `public/greek/LICENSE.txt`. (2) The builder accepts what the search
    field accepts: a LIT rendering (GK3-4, pass the glossary bridge) and two
    or three Latin-letter words read as a construction (GK3-5). Session 4.
13. **Margin pills' tab order** (NB3 Q1): drawn right to left, tabbed left to right. Acceptable?
    **Decided (BVJ, 2026-11-07): the order should match what the eye sees**
    (most likely a leftover of the pills' older order). Reverse the DOM
    rather than drawing `row-reverse`, so Tab moves left to right. Session 2.

**The appendices' smaller questions (BVJ, 2026-11-07):**
- **LV3-3: sheets don't belong in My Notes.** Leave them out of its list
  rather than naming their rows; they stay in the Notebook's sheets list and
  on /sheets. Tier 1 item 4's fix changes to this. Session 2.
- **DK3-7: a disabled item is skipped by the arrow keys in every menu**, the
  title menu included (it was assumed to be deliberate). A rule for all menus,
  so the session that builds it writes it into `src/scripts/CLAUDE.md` and
  the desk's `CLAUDE.md`. Session 3, and a check of the shared menus.
- **DI Q4: no date is set for BDR to settle the format changes.** Every
  decision that touches the apps' work is noted in `STUDY-DESK.md` for BDR to
  review later; the website builds its side meanwhile.

## Work sessions

Proposed by Claude, not a decision: every open finding in exactly one session, cut by the files
they touch so sessions that run side by side don't edit the same code. `desk.css` is touched by
most (different regions; merge in session order).

| Session | Findings | Files | Waits on |
|---|---|---|---|
| 1. Shared panels (every reader) | NB3-1, NB3-2, NB3-11, NB3-12 | `panel-flyout.js`, `chapter-tools.js`, `verse-image.js`, `global.css` | nothing; run first, check with the desk off |
| 2. The Notebook panel | LV3-1, NB3-6, LV3-3, NB3-3, NB3-5, NB3-7 to NB3-10, NB3-13, LV3-4(a), the margin pills' order (decision 13) | `panel.js`, `tab-mine.js`, `note-editor.js`, `footnote-pills.js`, `footnote-notes.js` | nothing |
| 3. /desk and sheets | LV3-2, DK3-2 to DK3-12, DK3-1, SEC3-3, LV3-4(b), LV3-5, LV3-6 | `desk-page.js`, `reading-display.js`, `sheet-*.js`, `desk-doc-*.mjs`, `desk-slides*.mjs` | nothing now (decisions 6, 10, 11 and DK3-7 made) |
| 4. Greek | GK3-1 to GK3-17 | `tab-greek.js`, `greek-builder.js`, `search-core.js` (GK3-6, GK3-14), `search-greek.js` | nothing now (decision 12 made) |
| 5. Records and import | DI3-1, DI3-4, DI3-5, DI3-6, SEC3-1, SEC3-2, SEC3-4, SEC3-5, then DI3-2 and DI3-3 | `desk-records.mjs`, `desk-history.mjs`, `desk-export.mjs`, `anchor-core.mjs`, `STUDY-DESK-FORMAT.md`, vectors | decisions made; BDR reviews the format later |
| 6. Launch readiness and docs | LG3-1 to LG3-14, NB3-4, NB3-14, CP3-2 to CP3-7 | `src/scripts/desk/CLAUDE.md`, `help.astro`, tests | nothing now (decisions 3, 4, 5, 9 made) |

**Status:** session 1 is done (2026-11-07, branch `claude/audit3-session1-shared-panels`):
NB3-1, NB3-2, NB3-11 and NB3-12, checked live with the desk off and on. The
chip layout's half of NB3-2 needs a touch screen and was not seen.

Sessions 1, 2, 4 and 5 touch different files and can run side by side. Session 3 shares
`desk-page.js` with nothing else here. Session 6 edits the desk's `CLAUDE.md`, which every other
session may also touch, so run it last or rebase it.

## What the verifier changed

A second Opus agent tried to disprove the eight findings that rank highest by severity, each
with scripts of its own against the real modules (Appendix J).

- **DI3-1**: confirmed, and wider: an Undo of an ordinary edit is lost the same way, so
  `restamped` needs the step for every record it puts back. Medium today (one user, no sync,
  nothing lost for good), High once sync ships. Website-only; the format text gains a note.
- **DI3-2**: confirmed for 13 of the 15 cases (the script printed 13; 11 are one Matthew 23
  revision). The auditor's fix (b) would not catch Matthew 23, where verse 15 kept the old
  formula word for word; fix (a), a notice, would. Needs BDR.
- **DI3-3, DI3-4, DI3-5**: confirmed, each Low today (two devices, a rare trigger, an unknown
  number of old iOS records). DI3-3 is a design call under rule a, not a code defect.
- **SEC3-1**: confirmed, Low. The `?sheet=` link adds nothing beyond opening the sheet by hand.
  It is a gap SEC-6's fix left (SEC Q2's option B exempted newer records by design), not a
  guard that once worked.
- **SEC3-3**: confirmed, but the slides' content is BVJ's E37 decision; only the menu's version
  line misleads.
- **DK3-1**: the XML is as described; whether PowerPoint refits on open is likely but not
  reproduced (Medium confidence). Low.

## What the orchestrator checked personally

- **LV3-3**: read both row builders. `recordRow` (`record-rows.js:74`) has the LV-3 sheet branch;
  `rowFor` (`tab-mine.js:627`), which My Notes uses since E17 folded the kept pane into it, has
  none.
- **LV3-2**: read `turnOffMarks` (`reading-display.js:77`): with nothing on, it remembers `[]`
  over the earlier list.
- **CP3**: re-ran the em dash check over every added line since Audit 2 (none in reader text).
- **MX**: reverted the one tracked file the build rewrote (`src/data/podcast-feed.xml`), so the
  audit checkout stayed clean.

## Corrections

- **CP3-1 is not a defect.** The selection print's heading "My notes" names the reader's notes
  on those verses, which rule 10's names keep lowercase (as This verse's subhead); "My Notes" is
  the tab and pane only.
- **GK3-2 is Low**, not Medium: the builder does replace its text box on every keystroke, but
  the live pass found focus and caret carried into the new box.
- **MX's raw flags are not defects** (LG3's judgment, checked against the code): the six static
  imports from outside the desk are the sanctioned gate files and constants; the six
  `target="_blank"` links with `noopener` alone stay on the site; the ten focus rules without
  `--focus-ring` are programmatic landing points, rings drawn on a child, or forced-colors
  overrides.
- **GK3's summary counts 15 findings**; its appendix has 17 (GK3-1 to GK3-17). The table above
  counts the appendix.

## What held up

- **Tests and build**: 3,026 tests pass (about 6.5 s), 260 chapters validate, `astro check` has 0
  errors, `npm run build` succeeds (49 s), 41,074 internal links resolve.
- **Merge and store**: 8,000 three-replica fuzzed histories converge and are idempotent; a full
  backup round-trips losslessly into an empty and a populated notebook; the real `store.js` on
  `fake-indexeddb` does undo, redo, restore and import as the format says; every Audit 2 `DI` and
  `RC` fix in the slice is still in the code with its test.
- **Security**: #446's sink guards and the Book Intro pane's `introPath` stop every off-site
  address a hostile backup could build; the sanitizer held 90 hostile cases and 60,000 random
  runs; the five file writers escape every piece of reader text and produce no field, DDE, OLE
  object, template, doctype or remote image; zip entry names are fixed and file names cleaned.
- **Saved files**: well-formed and complete on every awkward sheet; zip CRCs, sizes and ODF's
  stored `mimetype` correct; LibreOffice 26.2 opened all five with text and order matching.
- **Greek**: data clean; 3,000 lemma-and-filter queries, 600 constructions, 2,774 form-button
  flows and 20,000 notebook-search cases matched an independent matcher; 8,000 hostile queries
  produced no exception and no unescaped output; nothing under `greek/` loads without the preview.
- **The live walkthrough**: both tours, the Trash restore, Hide my marks, the Print flyout's
  keyboard, Add pane, Size, swap by dropping, Reading, bookmarks on /desk, the Book Intro pane,
  the Search pane, and on sheets Duplicate, ghost text, blanks by keyboard, Present and all five
  downloads; no console errors anywhere; dark mode readable everywhere looked at.
- **Copy**: no em dash, British spelling, straight quote, outside-the-quote period or missing
  Oxford comma in any reader-facing string added since Audit 2; Delete, Remove and Unpin used by
  the rule.
- **CSS and the gate**: dark-mode blocks carry both selectors; no `ch` unit; no shared script
  imports the desk (checked by a closure walk over every shared entry); one dead class.

## Not covered by this audit

- **No screen reader** (NVDA, JAWS, VoiceOver), so every announcement finding is a code read or
  a DOM check. **Safari, Firefox, touch screens, forced colors, 400% zoom and a real print
  dialog** were not run; the live pass was Chromium in the built-in browser, on a static server
  without `_headers` (so no CSP).
- **Word, PowerPoint, Keynote and Google Slides** never opened a saved file; LibreOffice did.
- The apps' side of the shared format, and phones and tablets (desktop-only by decision).
- Two features named in the brief were walked but not code-audited in depth: `sheet-text.js`
  and `bookmark-follow.js` beyond its writes (DK3's "Not reached").

## Method

Ten agents, read-only in the repo, on a worktree pinned to `60af379e`, each given the brief in
Appendix K. Models were chosen by fit (BVJ, 2026-11-06: "based on optimal fit for model
capabilities, not just defaulting to using slots"): **Fable** for the data and format slice,
whose rules are shared with both apps and where a wrong call is hardest to see; **Opus** for
security (reasoning from attacker input to a sink) and for the adversarial verification of the
highest findings; **Sonnet** for the four broad reading slices and the live browser pass;
**Haiku** for the two fully specified checklists (copy rules; tests, build, coverage and CSS
data). Never more than one Fable, one Opus, three Sonnet and two Haiku ran at once. The live pass ran
last, against a production build of the same commit, to confirm or correct the code readers'
claims. Throwaway scripts (merge and anchor fuzzing against real revisions, the file-writer
probes, the import-closure walk, the Greek brute-force matchers) are in the session scratchpad;
DI3 and LG3 suggest committing `anchor-revisions.mjs` and the closure walk.

The reports follow in full, with heading levels shifted down one so they nest under their
appendix. A line beginning "Verified" or "Live check" was added afterward; everything else is
the auditor's own text.

## Appendix A: Security and trust boundaries (`SEC3`, Opus)

Auditor: security slice, Opus. Checkout `claude/desk-audit-3` at `60af379e`, 2026-11-07.
Read-only; no browser, no dev server. Every script named below is in
`C:\Users\bcjoh\AppData\Local\Temp\claude\C--Users-bcjoh-GitHub-litbible\72b2d486-f2e1-40d1-ac50-64deb3f7a063\scratchpad\a3\sec3\`
and runs from the repo root as `node <script> .`: `writers.mjs`, `import-chain.mjs`,
`schema2-body.mjs`, `inertcopy.mjs`, `biglabel.mjs`, `share-file-size.mjs`,
`sec2-recheck.mjs`, `sanitizer-fuzz.mjs`, and Audit 2's `a2-sanitizer.mjs` and `a2-redos.mjs`
(copied, repointed at this checkout).

### Summary

The trust boundaries Audit 2 drew still hold. #446's sink guards (`chapterPath`, `isChapterAddress`)
stopped every off-site address a hostile backup could build, and the new Book Intro pane has its own
guard (`introPath`) of the same shape. The sanitizer, changed for E55, survived Audit 2's 90 hostile
cases and 60,000 random tag-soup runs. The biggest new surface is E37's seven file writers. Every
piece of reader text is escaped for its format (XML or RTF). Zip entry names are fixed, and the only
external relationships are hyperlinks. Hostile text produced no field, OLE object, DDE, remote image,
attached template, or doctype in any of the five formats. File names are cleaned.

What is open: SEC-6's size cap does not apply to a record "this code can't edit". Adding `"schema": 2`
to a note, or `"sheetFormat": 2` to a sheet, gets past the cap and makes a lasting slowdown (SEC3-1).
FA2-h's "second lock" covers a passage's words only (SEC3-2). Slides put the leader's answers in the
speaker notes under a menu that says "Participant version" (SEC3-3). There are two smaller items as well.

Counts: **Critical 0, High 0, Medium 1, Low 3, Nit 1** (5 findings).

### Findings

#### SEC3-1 · Medium · security · REGRESSION SEC-6

> **Verified (Opus, Appendix J):** confirmed, Low. The `?sheet=` link adds nothing beyond opening the sheet by hand. Not a regression of a guard that once worked: SEC Q2's option B exempted newer records by design, so this is a gap SEC-6's fix left.

**SEC-6's size caps don't apply to a newer-schema note or a newer-format sheet. A file someone sends can still slow the notebook for good.**

- **Where**: `src/lib/desk-records.mjs:338` (`validateRecord` returns after the common fields when `!canEdit(r)`, so the `MAX_NOTE_BODY` check at `:363` and `validateSheet`'s 512 KB limit at `:384` never run); `src/lib/desk-export.mjs` `planImport` (keeps such a record); `src/scripts/desk/note-words.js:28` `fillNoteWords` → `noteBodyHtml` (draws any length); `src/scripts/desk/sheet-copy.js:45` `rich` and `sheet-pane.js:968` (`sheetHtmlForShow` on any length); `src/scripts/desk/desk-page.js:1805` (`?sheet=` saves a Sheet pane into the layout).
- **What happens**: someone sends a backup that holds one note on John 3 with `"schema": 2` and a 40 MB body. "Open a copy" says "1 new." From then on, every draw of that note costs more than 6 seconds before the DOM work: John 3's margin, My Notes, This verse, the notebook page, and a print. The body also holds about 3 million references, which become 3 million links in the page. The same file with `"schema": 1` is refused, as SEC-6's fix intended. A sheet works the same way. With `"sheetFormat": 2` and an 11 MB text part, the sheet is kept, and each `sheetHtmlForShow` takes 2 seconds. Import keeps the attacker's chosen id, so a link to `/desk/?sheet=<id>` writes the pane into `lit-desk-layout`, and then every visit to /desk draws the sheet again. Phase 4 sync will deliver newer-schema records as a matter of course.
- **Evidence**: `schema2-body.mjs` runs the real `parseImport`, `planImport`, `noteBodyHtml` and `sheetHtmlForShow`. Output: "schema 1: file 40.5 MB, kept 0 … schema 2: file 40.5 MB, kept 1, noteBodyHtml of that body: 6279 ms per draw". "sheetFormat 1: 10.8 MB text part, kept 0 … sheetFormat 2: kept 1, sheetHtmlForShow per draw: 2047 ms".
- **Fix**: SEC Q2 option B keeps the stored record untouched. That decision is about not rewriting a record, so put a size limit at the door or at the draw. (a) In `validateRecord`'s common block, which runs for every schema, refuse any record whose serialized size exceeds a generous ceiling (say 1 MB). That ceiling is far above the 64 KB body and 512 KB sheet limits, so it never touches a real record from a newer client. Alternatively (b), have `fillNoteWords` and `rich`/`sheetHtmlForShow` draw only the first `MAX_NOTE_BODY` (or `SHEET_LIMITS.bytes`) characters, plus a line saying the rest is held. Add a `desk-hostile-records.test.js` case for each.
- **Confidence**: High (reproduced with the real modules). The browser cost of the 3 million links was not measured.

#### SEC3-2 · Low · security · NEW (FA2-h's second lock is partial)

**The scrub applied to fetched chapter HTML (`inertCopy`) covers a passage's words only, and it lets a split `javascript:` and several resource-loading elements through.**

- **Where**: `src/scripts/desk/sheet-lit.js:189-200` `inertCopy`. Its scheme test is `/^\s*(javascript|data):/i`. It removes `img, picture, script, style, iframe, object, embed, link, meta, svg, audio, video` and nothing else. It is applied at `:227` only. Nodes from the same fetched or parsed page are imported with no scrub at `src/scripts/desk/sheet-copy.js:153` (paper footnotes) and `:201` (present-mode footnotes), at `src/scripts/desk/lit-pane.js:267` (the LIT pane's blocks), and at `src/scripts/desk/intro-pane.js:89` (the Book Intro pane).
- **What happens**: none of this is reachable today. `chapterPath`/`chapterHref` and `introPath` refuse any address off the site before the fetch, and that guard holds (see the re-checks). The scrub exists for the case where that guard fails, as SEC-1 once did, and in that case it would not hold. An `<a href="java&#9;script:…">` passes it, because a browser drops the tab and reads the scheme as `javascript:`. So do `<input type=image src>`, `<td background>`, `<base href>` and `<form>`. And the footnotes of the very page whose words were scrubbed go in raw, `on*` handlers included.
- **Evidence**: `inertcopy.mjs` runs the scheme test verbatim. `"java\tscript:alert(1)"`, `"java\nscript:…"` and `"\u0001javascript:…"` give "removed: false", and WHATWG `URL` reads each as `javascript:`. Reading the four call sites confirms the missing scrub.
- **Fix**: make `inertCopy` a shared helper in `chapter-page.js` and apply it once in `keepParts`/`read`, when the fetched document is reduced to the parts the panes use. Then every reader (words, footnotes, LIT pane, intro) gets it. Test the scheme the way a browser reads it: strip `[\x00-\x20]` everywhere before the test, or use `new URL(value, location.href).protocol`. Turn the remove list into an allowlist of what the chapter and intro pages actually contain.
- **Confidence**: High for the gaps; the effect needs SEC-1's guard to fail first.

#### SEC3-3 · Low · security (privacy) · NEW

> **Fixed (Audit 3 session 3, 2026-11-07, branch `claude/audit3-session3-desk-sheets`):** per decision 6 (b), slides saved while the participant version is on screen have no speaker notes at all (`deckSlides`' `participant`, from `readSlides`): no answers, no Leader only parts, no list of a slide's blanks; the leader's version keeps E37 as it is.

> **Verified (Opus, Appendix J):** confirmed, but what the slides hold is BVJ's E37 decision; only the menu's version line and accessible name mislead.

**"Save as ▸ Slides" puts every Leader only part and every answer in the speaker notes, even while the menu's first line reads "Participant version".**

- **Where**: `src/scripts/desk/sheet-save.js:119-121, 164-166`. `open()` writes the version on screen ("Participant version") as the menu's first line, and as its accessible name ("Save the participant version as"), above both groups, Slides included. `src/scripts/desk/sheet-slides.js:18` ("the same whichever version is on screen"), `:88-101` `leaderOnly` and `:148-152` (each question's answer goes into `notes`).
- **What happens**: a leader switches the toolbar to Participant version so that what they send leaves the answers out. They open Save as, see "Participant version" at the top, choose PowerPoint (.pptx), and email the deck to the group. Every question's answer, and every part marked Leader only, is in the speaker notes. PowerPoint and Impress show these beside each slide. Making the slides the room's screens is BVJ's decision (E37 phase B), and a shared participant link already strips these parts. The problem is that the menu tells the reader something about the slides that isn't true.
- **Evidence**: read. `readSlides(sheet)` never looks at the version. `leaderOnly` and the question branch put the leader's material into each slide's `notes`, and `desk-slides-pptx.mjs` writes `notes` as `ppt/notesSlides/notesSlideN.xml`.
- **Fix**: move the version line inside the "A document" group, and give Slides its own line ("The room's slides. Speaker notes hold the answers and the Leader only parts"). Or leave the notes out of slides saved while the participant version is on screen. Which of these is BVJ's call (Questions, Q1).
- **Confidence**: High.

#### SEC3-4 · Low · security · NEW

**Two readers have no size limit: a bookmark's or label's name, and the Sheets page's "Import a Study Desk file."**

- **Where**: `src/lib/desk-records.mjs:374-377` (`bookmark.label`: type only; the 40-character limit is the form's `maxlength`, `bookmark-form.js`) and `:382` (`label.name`: non-empty only). `src/scripts/desk/sheet-page.js:242-262` `openFileRow` (`file.text()` of any size, then the fragment goes into `history.replaceState`). Compare `export-import.js:35, 159`: the notebook's own import refuses files over 50 MB, which is SEC-6's other half.
- **What happens**: a backup holding a bookmark with a 5,000,000-character name is kept ("added"). That name goes into the verse menu's accessible name, every list row, and the notebook search text: `filterRecords` costs 87 ms at 5 M characters and 540 ms at 20 M on every keystroke. On /sheets/, a 300 MB `.md` file is read whole and its 300 MB data line is put into `history.state` before `openShare` refuses it as damaged. The cost in the browser (memory, and whether `replaceState` throws) was not measured. Only a nuisance; nothing is read or lost.
- **Evidence**: `import-chain.mjs` ("bookmark with a 5,000,000-character label kept", same for a label's name), `biglabel.mjs`, `share-file-size.mjs` ("300 MB data line: fragmentInFile 209 ms (fragment 300 MB, kept for history.state), openShare 768 ms, refused").
- **Fix**: in `validateRecord`, cap `bookmark.label` at `BOOKMARK_NAME_MAX` and a label's `name` at a few hundred characters. In `openFileRow`, refuse `file.size` over a few MB (a share is at most about 1.4 MB of base64), and check the fragment's length before `replaceState`.
- **Confidence**: High for what is stored and planned; Medium for the browser-side cost.

#### SEC3-5 · Nit · security · KNOWN-OPEN (Audit 2 Appendix A, Improvements: "Look up markers with Object.hasOwn")

**One marker lookup still reads the prototype.**

- **Where**: `src/scripts/desk/print-notes.js:211`, `MARKER_NAMES[record.marker] ?? "Note"`.
- **What happens**: take a newer-schema note whose marker is `"constructor"` and whose body is empty. "Print with my notes" prints `function Object() { [native code] }` as its words. `glyph` was fixed (`glyphs.js:36`); this lookup was not. Harmless text, no markup.
- **Fix**: `Object.hasOwn(MARKER_NAMES, record.marker) ? … : "Note"`, and add it to `desk-hostile-records.test.js`.
- **Confidence**: High (read; the lookup is plain JavaScript).

### Audit 2 fixes re-checked

- **SEC-1** (#446): holds. `chapterHref` (`chapter-page.js:33-36`) and `loadChapterPage` reject before fetching. `recordHref` and `recordReadHref` return null. `chapterCodes` prints no code. `import-chain.mjs`: a `schema: 2` note with `bookKey "/evil.example/john"` gives href null; a `sheetFormat: 2` sheet with `"/attacker.example/x"` gives `chapterCodes` `[]` and `chapterPath` null. `test/desk-chapter-address.test.js` passes (6/6).
- **SEC-1 for E53** (new sink): `introPath`/`introHref` (`intro-pane.js:47-50`) guard the Book Intro fetch with `Object.hasOwn(BOOKS, …)`. `parseIntroParam` and `parsePlaceParam` refuse `//evil.example-1`, `constructor` and `__proto__`.
- **SEC-2** (FA2-a): holds. `QUALIFIER_REACH = 256` (`scripture-refs.mjs:205, 368`). `sec2-recheck.mjs`: 480 KB of "LXX Ps 51:4 " takes 51 ms in `noteBodyHtml` (8.8 s before the fix); runs of no-break spaces take 134 ms.
- **SEC-3** (FA2-b): holds. `isExternalHref` reads with `new URL(href, "https://litbible.net/")`; `test/external-links.test.js` passes 12/12, and `a2-sanitizer.mjs` reports "cases 90 issues 0" (no EXTERNAL-NO-TARGET).
- **SEC-4** (FA2-b): holds. `print-link.js:48`: prints only with the one-time `lit-desk-print-ask` mark, and "notes" stands down under Hide my marks (`:50`). E40's new Print ▸ (`print-part.js`) is reached from the menus only, and stands down the same way.
- **SEC-5** (FA2-b): holds. `sheet-page.js:618` says "litbible.net never sees or stores it."
- **SEC-6** (FA2-n): the 64 KB body cap (`MAX_NOTE_BODY`, `desk-records.mjs:316, 363`) and the 50 MB file check (`export-import.js:35, 159`) are there, but newer-schema records get past them (**SEC3-1**), and the Sheets page's file reader has no check (**SEC3-4**).
- **RC-1 / DI-10** (FA2-n): holds. A trash record's held record is validated on import (`desk-export.mjs` `planImport`, "its held record"). A held id that isn't `deletedId` is refused ("a trash record holding a record with another id", `import-chain.mjs`; `restoreFromTrash` returns null, `desk-records.mjs:241`). Restoring a held `schema: 2` record gives href null. `store.undo`/redo run `planWrite` (`history.js:136`).
- **SEC Q2 option B** (types checked where drawn): `glyph` uses `Object.hasOwn` (`glyphs.js:36`; test passes). `currentMarker` and the bookmark label paths (`actions.js:517 shownName`, `record-rows.js:148`) tolerate non-strings without throwing. The one gap is SEC3-5.
- **FA2-h** (strip `img`/`script`/`on*` before `importNode`): present at `sheet-lit.js:189-200, 227`, but partial (**SEC3-2**).
- **Audit 2 Improvement, glyph lookup**: done. **COOP header** and **stripping `?q=` on /notebook** (`notebook-page.js:422`): still not done (see Improvements).
- **CSP** (`public/_headers`): unchanged since Audit 2 except a new `/greek/*` cache rule (GK-9). The enforced policy is still the structural four (`frame-ancestors`, `object-src`, `base-uri`, `form-action`), and the resource allowlist is still report-only with no `report-to`. Decision 5 ("not yet") stands; not re-argued.

### Sink table

Sinks Audit 2 listed that haven't changed are not repeated; their verdicts hold (Appendix A). Rows here are new since `a57e155d`, or changed.

| Sink | Where | What reaches it | Verdict |
|---|---|---|---|
| .docx XML (text, attributes, `dc:title`, `descr`) | `desk-doc-docx.mjs` `runXml:131`, `codeParagraphs:183`, `docxParts:345` | sheet title, version, every inline run, captions, code labels | Safe: `xmlEscape` (`desk-sheet-doc.mjs:371`) also drops XML-illegal characters and lone surrogates; `writers.mjs` parsed every part strictly with no injected element |
| .docx relationships | `docxParts:333-338` | link `href`s from `readCopy` | Safe: `Type` fixed to `hyperlink` for every External one; `Target` escaped. Images are internal `media/codeN.png`. No `attachedTemplate`, `oleObject` or remote image is possible |
| .odt / .odp XML and `xlink:href` | `desk-doc-odt.mjs:177, 187, 296-300`; `desk-slides-odp.mjs:129, 138, 177, 191` | same | Safe: `xmlEscape`. Images `Pictures/codeN.png`, `xlink:show="embed"`; colors and fonts from the fixed `DOC_*` tables |
| .pptx XML and rels | `desk-slides-pptx.mjs:66-71, 122-137, 244, 293-319` | slide text, speaker notes, link `href`s | Safe: same. Speaker-notes content: SEC3-3 |
| .rtf text, `\info`, `HYPERLINK` field | `desk-doc-rtf.mjs:31-47 rtfEscape`, `:100-101`, `:220` | same | Safe: `\`, `{`, `}` escaped, non-ASCII as `\uN?`, control characters dropped. A field's address has `"`, whitespace, `\`, `{` and `}` percent-encoded, so no field switch, second field, `\object` or DDE can be injected (`writers.mjs`: every `{\field` is a HYPERLINK, braces balanced, output all ASCII) |
| zip entry names | `desk-zip.mjs:69`; names from each writer's `*Parts` | fixed strings plus counters | Safe: no reader text in any entry name; `writers.mjs` found no `..`, absolute or odd name |
| download file name | `desk-sheet-doc.mjs:415 documentFileName`; `sheet-page.js:462, 490` | sheet title | Safe: path and reserved characters, control characters and edge dots removed, 80 characters at most, a fixed " (leader).docx" suffix (so `CON` gives `CON (leader).docx`). Bidi controls are kept (Improvements) |
| blob download | `sheet-save.js:75-83` | writer bytes | Safe: `a.download`, revoked after 10 s |
| code PNG | `sheet-save.js:39-56 codePng` | `qrSvg` output read back from the copy | Safe: a `data:image/svg+xml` image can't run script; drawn on a canvas |
| slides print view | `sheet-slides.js:204-222 runHtml`, `boxEl` | runs | Safe: `make` with text; `href` from `readCopy` (http, https, mailto) with `noopener noreferrer`; CSS values from fixed tables |
| `a.href` in the document model | `sheet-word.js:55-57` | sanitized sheet `href`, footnote and foot links | Safe scheme-wise (http, https, mailto only). The raw attribute is passed on (Improvements) |
| clipboard HTML | `desk-sheet-doc.mjs:140 docHtml` (Copy); `print-part.js:170 handoutHtml`; `tab-greek.js:738-762` (E54) | model; selected scripture; a DOM clone | Safe: `esc`/`attr`; `handoutHtml` escapes `&<>` before its markers; E54 serializes the DOM |
| DOMParser + `importNode`, intro | `intro-pane.js:68, 89` | `/<book>-intro/` | Safe behind `introPath`; no scrub (SEC3-2) |
| DOMParser + `importNode`, chapter | `lit-pane.js:267`, `sheet-lit.js:227`, `sheet-copy.js:153, 201` | `chapterHref(bookKey)` | Safe behind `chapterPath`; scrub partial (SEC3-2) |
| `innerHTML`, new templates | `bookmark-form.js:55`, `bookmark-follow.js:172`, `footnote-notes.js:162, 195, 209`, `footnote-pills.js:62`, `note-settings.js:399`, `sheet-save.js:109`, `desk-page.js:403, 422`, `tour-runner.js:75` | constants, `glyph(…)` and `escapeHtml` | Safe |
| BroadcastChannel, new | `bookmark-follow.js:73, 270, 333-343` (`FOLLOW_TAB_CHANNEL`) | same-origin tabs | Safe: string-typed fields; can only drop this tab's follow flag |
| URL parameters, new | `desk-page.js:331` `?place=`, `:1828` `?intro=` | any link | Safe: `parsePlaceParam`/`parseIntroParam` own-property checks; stripped after reading. A link can move the leading LIT pane or add one Book Intro pane, which is saved in the layout (as `?sheet=` already could) |
| `requestFullscreen` | `desk-page.js:676` (E43) | the reader's click | Safe |
| `window` `message` | none in `src/` | | No cross-origin channel |

### Improvements

- **Have `readCopy` pass the resolved address** (`n.href`, not `getAttribute("href")`, `sheet-word.js:55`). Each file then holds the address a click on the page would follow (`https://evil.example/share`), rather than the forgiving spelling the sanitizer keeps (`https:\\evil.example\share`, SEC-3's form), which Word, LibreOffice and Pages may each read their own way.
- **Add `blob:` to the report-only `img-src`** (`public/_headers`). `printSlides` shows its codes as `blob:` images (`sheet-slides.js:284`), so the console logs a violation on every slides PDF, and an enforced policy, if decision 5 ever changes, would silently drop the codes.
- **Extend the source check in `test/desk-chapter-address.test.js:140`** to `intro-pane.js`, so its fetch address is held to `introPath` as `chapter-page.js`'s is to `chapterPath`.
- **Strip Unicode format characters (`\p{Cf}`: U+202E, U+2066-2069) in `documentFileName`.** A shared sheet's title can make the saved file's name display reversed. Browsers usually clean this themselves; this was not checked.
- **Use `Object.hasOwn(BOOKS, …)` in `validateRecord`** (`desk-records.mjs:347`, `r.bookKey in BOOKS`). `"constructor"` passes the book test today, and only the chapter test that follows refuses it.
- **Still open from Audit 2**: `Cross-Origin-Opener-Policy: same-origin-allow-popups`, and stripping `?q=` from /notebook's address after it is read.

### Questions for the owner

- **Q1 (SEC3-3).** Slides are the room's screens, the same for either version, and that is your E37 decision. When the participant version is on screen, should "Save as ▸ Slides" (a) say plainly that the speaker notes hold the answers and the Leader only parts, (b) leave the notes out, or (c) stay as it is, with the menu's "Participant version" line moved inside the document group?
- **Q2 (SEC3-1).** For a record this code can't edit, which do you prefer: a whole-record size ceiling checked on the way in (refused, with a reason in the summary), or keeping everything and drawing only the first 64 KB? Option B (2026-11-04) answered "carried untouched" for fields, not for size, and BDR's sync will need the same rule.

### What held up

- **The sanitizer after E55's `CLOSES_P` parse change**: Audit 2's 90 hostile cases (`a2-sanitizer.mjs`, "cases 90 issues 0") and 60,000 random tag-soup runs (`sanitizer-fuzz.mjs`, "runs 60000, failing 0") through `sanitizeSheetHtml`, `pastedSheetHtml` and `sheetHtmlForShow`, each output checked to be idempotent, allowlisted when parsed with parse5, and unchanged in structure when re-serialized. Timing (`a2-redos.mjs`) is linear as before; the new scope loop is bounded by `MAX_OPEN`.
- **Every file writer** (`writers.mjs`): hostile titles, versions, runs, captions, labels and `href`s built to break out of XML (`</w:t>…<w:fldSimple w:instr="DDEAUTO …">`, `]]><!DOCTYPE … SYSTEM>`, an injected `<Relationship … attachedTemplate … TargetMode="External">`), out of RTF (`}{\object\objautlink…}{\field{\*\fldinst DDEAUTO …}}`, `{ INCLUDEPICTURE "http://…" \d }`) and out of ODF (`<draw:object xlink:href>`), plus control characters, U+FFFE/FFFF and lone surrogates. Every XML part of the four zips (118 entries in all) parsed strictly. No field, object, DDE, doctype, template or remote image appeared. The only external relationships are `hyperlink`. RTF braces balanced, output all ASCII. The repo's own tests pass: `desk-sheet-doc` 27/27, `desk-slides` 13/13.
- **E37 stays out of a reader's bundle**: each writer is a dynamic import in `sheet-save.js:26-33`, and slides are a dynamic import of `sheet-slides.js`, both reached only through the desk-gated /sheets/ page.
- **Imports**: `import-chain.mjs` ran a hostile backup through the real `parseImport`/`planImport`. A highlight with `bookKey: "constructor"` was refused. A trash record holding another id was refused. Newer-format text was still sanitized on the way in (`<p>hello <img onerror><a href='java\tscript:'>` stored as `<p>hello j</p>`).
- **E36's "Import a Study Desk file"**: refuses newer formats, decompresses with a ceiling, and rebuilds with fresh ids through `validateRecord` (`desk-sheet-share.mjs:305-340`). The data line is always the file's last line (`shareFile`), and `fragmentInFile` takes the last one, so a title can't plant an earlier line that wins.
- **Book Intro pane (E53)**: fetched only through `introPath`, parsed with DOMParser (scripts inert), ids stripped, and every link a new tab with `noopener noreferrer` except a plain click on `a.sref`, which `resultTarget` reads as a passage.
- **Shared reader code touched by E39** (`panel-flyout.js`, `chapter-tools.js`): no new HTML sink, no fetch beyond Read View's existing same-page Chapter View fetch, and no static import of desk code (`panel-pieces.js` and `greek-commands.js` import only `desk-frame.js`, which is shared by design).
- **Same-origin channels**: all three BroadcastChannels type-check what they read. No `window` `message` listener exists. Selectors built from record ids use `CSS.escape` (`notes-margin.js:156, 406`).
- **Release feed and What's new**: unchanged fetch of `/api/data/release-notes.json`. Hrefs are built by `releaseNoteFor` from owner data.
- **Repo tests in this slice all pass**: `desk-chapter-address` 6, `desk-hostile-records` 3, `desk-sheet-share` 18, `desk-export` 65, `desk-records` 41, `desk-store-core` 51, `desk-store` 15, `external-links` 12, `scripture-refs` 44.

### Not reached

- **The files opened in Word, Pages, Google Docs and Keynote** to see how each treats a raw `https:\\host\path` hyperlink or a `mailto:` with `attach=`. Static checks only.
- **Browser-side cost of SEC3-1 and SEC3-4**: 3 million links in the margin, and a 300 MB string in `history.state`. Node timings only.
- **Whether Chrome and Firefox clean bidi controls from a `download` file name.**
- **A live run of any chain**: no browser, by the brief.

## Appendix B: Data integrity and sync-readiness (`DI3`, Fable)

Checkout `C:\Users\bcjoh\GitHub\litbible\.claude\worktrees\desk-audit-3` at `60af379e`. Read-only; every claim below was run in node against the real modules. Scripts are in `C:\Users\bcjoh\AppData\Local\Temp\claude\C--Users-bcjoh-GitHub-litbible\72b2d486-f2e1-40d1-ac50-64deb3f7a063\scratchpad\a3\di3\` (named per finding).

### Summary

The slice is in good shape: the merge converges and is idempotent under 8,000 random three-replica histories, the full backup round-trips losslessly, the store's undo, redo, restore and import paths do what the format says, and every Audit 2 DI/RC fix in this slice is still in the code with its test. Two things stand out. **One High**: the hybrid-clock step added for DI-8 covers edits only, so a deletion or a restore made on the slower of two clocks (inside the five-minute tolerance the spec allows) is silently undone when the copies meet; reproduced with the real merge. **One Medium that is new evidence on a known question**: run against every real chapter revision in git history, the `moved` step lands on the wrong verse 15 times in 18, because a repeated formula that survives elsewhere captures a mark whose own verse was reworded (Matthew 23 at `ff34f594` moves marks from six verses onto verse 15, with no notice). Three more Mediums concern sync-readiness and import: the bookmark follower's two-second writes overwrite concurrent edits under rule a; a trash record whose held copy fails validation is skipped whole, deletion included; and an iOS note still carrying the old `star` marker is refused. Counts: Critical 0, High 1, Medium 4, Low 1, Nit 0.

### Findings

#### DI3-1 · High · data-integrity · NEW

> **Verified (Opus, Appendix J):** confirmed, and wider: an Undo of an ordinary edit is lost the same way, so `restamped` needs the step for every record it puts back. Medium today, High once sync ships. Website-only fix; the format text gains a note for BDR.
**Where**: `src/lib/desk-records.mjs:209-227` (`trashRecord`: `deletedAt: at`, no step past the record's `modified`); `:237-248` (`restoreFromTrash`: `laterThan(trash.record.modified, now)`, never against `trash.deletedAt`); `src/lib/desk-history.mjs:132-138` (`restamped`: an undo of a deletion stamps `now`, an undo of a restore stamps `deletedAt: now`); `src/lib/desk-merge.mjs:325-334` (rule b compares `live.modified` with `deletedAt`, equal or earlier means deleted); `:149` (`CLOCK_TOLERANCE_MS`, five minutes).
**What happens**: two devices whose clocks differ by less than five minutes, which the spec says is normal and tolerated (`STUDY-DESK-FORMAT.md`, "Room for skew").
1. The phone (three minutes fast) edits note X; the desktop receives the edit unclamped. The desktop deletes X a minute later. Its `deletedAt` is two minutes *before* X's `modified`. When the copies meet, rule b says the edit is the later action: **the deletion is silently undone on both devices.**
2. The phone deletes X; the desktop restores it from the Trash (E12) or with Ctrl+Z a minute later. The restored `modified` is earlier than `deletedAt`, so when the copies meet **the restore is silently undone on both devices.**
DI-8 fixed exactly this for edits ("an edit stamps `max(now, the version it replaces + 1 ms)`", `laterThan`), but a deletion is made over a record and a restore over a deletion, and neither takes the step. Today this needs two browsers swapping backup files; with phase 4's sync it is the ordinary case of a phone and a laptop.
**Evidence**: `skew-delete-restore.mjs`, through `trashRecord`, `restoreFromTrash` and `mergeSets`: case 1 prints `deletion SILENTLY UNDONE`, case 2 `restore SILENTLY UNDONE`, on both sides after the second exchange; case 3 (no skew) is fine.
**Fix**: `trashRecord` stamps `deletedAt = laterThan(record.modified, now)` (and `modified` the same); `restoreFromTrash` stamps `modified = laterThan(max(record.modified, trash.deletedAt), now)`; `restamped` in `desk-history.mjs` applies the same two rules (the entry holds the record or trash record it replaces). Extend the "Room for skew" bullet in `STUDY-DESK-FORMAT.md` ("a deletion stamps past the copy it deletes; a restore past the deletion it undoes"), add two merge vectors, and tell BDR, since the apps' `deletedAt` and restore stamps need the same step.
**Confidence**: High.

#### DI3-2 · Medium · data-integrity · KNOWN-OPEN DI-1 (its residual: Audit 2's question 1, "should a mark moved to another verse say so?")

> **Verified (Opus, Appendix J):** confirmed for 13 of the 15 cases (11 are one Matthew 23 revision). Fix (b) would not catch Matthew 23, where verse 15 kept the old formula; fix (a), a notice, would. Either needs BDR.
**Where**: `src/lib/anchor-core.mjs:243-246` (the `moved` step searches the whole chapter), `:170-197` (`bestByContext` with `bothSides`: four characters each side is enough); `src/lib/desk-change.mjs` (`found` and `moved` carry no notice, by the format).
**What happens**: the reader's verse is reworded, and the chapter keeps the same words in another verse with enough shared context around them (a repeated formula, a refrain). The mark leaves its verse for the other one with no notice. On the real revision `ff34f594` (2026-08-16, Matthew 23: "You'd better watch out, fakers, Bible Scholars and Pharisees, because" reworded to "Things won't end well for you pretenders" in every verse but 15), marks on "watch out, fakers," in verses 13, 16, 23, 25, 27 and 29 are all drawn on verse 15 afterwards. Luke 13:2's "more" (26e379a1) lands on verse 4's "debtors more so than"; 2 Corinthians 3:18's "One" (7d478b2d) on verse 17. Spec 3's four-characters-each-side test is met in all of them ("tors " + " so than all").
**Evidence**: `anchor-revisions.mjs` walks all 173 commits that modified chapter files, builds before and after anchor text with the real `chapterAnchorText`, samples 1-6 word marks in every changed verse (9,444 marks over 474 revision pairs), resolves with the real `resolveAnchor` and judges by a word-level LCS: `found` 7,846, `changed` 791, `verse` 789, `moved` 18, **of which 15 landed in another verse than the reader's while the reader's verse still existed**; 39 silent wrong placements in all (the other 24 are one-word marks like "of" and "the" found in a reworded verse, which no rule can tell apart), 18 marks lost needlessly to `verse` where their words survived with both sides of the context rewritten (the spec 3 floor at work, deliberate). Words that legitimately move (a paragraph joined or split) stay in their verse and come back as `found`, so on real revisions `moved` across verses is almost always wrong.
**Fix**: one of two spec changes, both small. (a) A `moved` whose range lies outside the anchor's verses while those verses still exist carries the change notice ("Your words were found in verse 15; they were in verse 27"), which is Audit 2's question 1 answered yes. (b) Keep `moved` silent but require the full stored context on both sides for a move out of the anchor's verses (each side must agree on `min(8, that side's stored length)`), so a repeated formula needs the sentence before and after it to match too. Either is a vector regeneration and a `ANCHOR_SPEC_VERSION` bump to 4, and BDR hasn't yet confirmed spec 3 (`STUDY-DESK.md:2490`), so this can ride with it.
**Confidence**: High on the numbers and the counterexamples; the rate is low in absolute terms (15 of 9,444 marks on changed verses) but each one is a mark silently drawn on another verse, in the spec both apps copy.

#### DI3-3 · Medium · data-integrity · NEW (sync-readiness)

> **Verified (Opus, Appendix J):** confirmed. Low today (it needs two devices), Medium once sync ships; a design call under rule a rather than a code defect.
**Where**: `src/scripts/desk/bookmark-follow.js:382-401` (`flush` writes the whole bookmark with `editRecord` every `MOVE_EVERY_MS`, `src/lib/desk-bookmarks.mjs:53`, 2 s); `src/lib/desk-merge.mjs:185-193` (rule a, whole record, later `modified` wins).
**What happens**: a bookmark with "Move as I read" on is a stream of record writes while the reader reads. Any edit to the same bookmark made on another device in that window loses whole: a rename, a label, and, worst, turning "Move as I read" **off**, which the next move on the reading device turns back on (its copy still says `follow: true` and is newer). With phase 4's sync a phone can't rename or stop a bookmark the laptop is reading with; today it needs a file exchanged between two browsers.
**Evidence**: `lww-follow.mjs`: phone renames to "Advent, week 2" and adds a label at 12:00:00; desktop's follower moves the bookmark at 12:00:02; merged record has `label: "Advent"`, `labels: []`, verse 14. Phone sets `follow: false` at 12:00:00; after the desktop's move the merged record is `follow: true`.
**Fix**: a decision for BVJ and BDR rather than a code fix alone: (a) a move writes only `verse`/`endVerse`/`chapter`/`bookKey` and the merge treats a bookmark's place and its other fields as two things with their own times (a `placedAt` beside `modified`, the only field-level rule in the format); or (b) the follower stops when the record's `modified` has moved under it (it reads in the write's transaction already; compare `client` and `modified` with what it last wrote) and the spec says a move never beats an edit; or (c) accept and document it. The E45 note already says a move is a syncing write; this is the consequence.
**Confidence**: High on the mechanics; Medium on the weight, since it needs two devices.

#### DI3-4 · Medium · data-integrity · NEW

> **Verified (Opus, Appendix J):** confirmed. Low: the trigger is narrow. A tombstone-only trash record is already accepted by `planImport`, so the fix uses a shape the code knows.
**Where**: `src/lib/desk-export.mjs:690-693` (`planImport`: a trash record whose held record fails `validateRecord` is pushed to `skipped` whole); `src/lib/desk-merge.mjs:130-142` (`problemWith` had already accepted the deletion itself).
**What happens**: the deletion is well-formed (`deletedId`, `deletedAt`), only the copy it holds isn't (a marker the website doesn't know, a body over `MAX_NOTE_BODY`, a verse out of range in an app's record). The whole trash record is left out with "The copy it holds in the trash couldn't be read.", so the notebook never learns the record was deleted. An older backup, or a sync from a device that hasn't seen the deletion, then brings the live record in with nothing to stop it; that is the A-F10 case the tombstone exists for.
**Evidence**: read; `planImport` with a trash record holding `{ marker: "star" }` returns it in `skipped` and writes nothing (run in `roundtrip.mjs`'s harness by hand).
**Fix**: when only the held record is bad, write the trash record as its tombstone (drop `record`, keep `deletedId`, `deletedKind`, `deletedAt`) and report "its words couldn't be read, so it can't be restored" instead of skipping. RC-1's intent (an unchecked copy must never reach the live set) is kept.
**Confidence**: High.

#### DI3-5 · Medium · compat · NEW

> **Verified (Opus, Appendix J):** confirmed. Low. Adding `star` to `RENAMED_MARKERS` is harmless on the website; stating it as a rule for every client is a format line for BDR.
**Where**: `src/lib/desk-records.mjs:74` (`RENAMED_MARKERS = { bookmark: "ribbon" }`), `:365` (`validateRecord` refuses a marker outside `MARKERS`); `STUDY-DESK-FORMAT.md:104` ("iOS already reads an old `star` as `emphasis`; nothing stored is rewritten").
**What happens**: an iOS record written before `star` became `emphasis` still carries `marker: "star"` on disk, by the format's own rule that nothing stored is rewritten. In a backup or a sync it reaches the website as `star`, and the website skips it: "It has a marker the notebook doesn't know." The note, and (DI3-4) its deletion, never arrive.
**Evidence**: `validateRecord({ ...note, marker: "star" })` returns `marker "star" is not one of note, emphasis, …`; `migrateRecord` leaves it. The vectors and tests cover `bookmark → ribbon` only.
**Fix**: add `star: "emphasis"` to `RENAMED_MARKERS` (the one place; `currentMarker`, `validateRecord`, `migrateRecord` and the Markdown reader all follow), with a vector; ask BDR for the full list of marker names either app has ever written.
**Confidence**: Medium: it depends on iOS records still carrying `star`, which the format says they may.

#### DI3-6 · Low · longevity · NEW
**Where**: `src/lib/desk-sheet-format.mjs:1051-1055` (`validateSheet` requires `sanitizeSheetHtml(m.html) === m.html` for every module); `src/lib/desk-sheets.mjs:235-245` (`planSheetChange` validates the whole sheet on every edit); `test/desk-sheets.test.js:52-78` (`CANONICAL`, 21 hand-written inputs).
**What happens**: every stored sheet is valid only while the sanitizer's output for its text never changes. E55 (`c4472a41`, 2026-11-06) changed the parser; it happens to be safe, but the only guard is a 21-line list. A future change that altered any canonical form (a serialization detail, an entity, a whitespace rule) would make every sheet holding that form refuse every edit ("not saved (Module 3 (text): html is not in the sheet's formatted-text form)"), including edits to other modules, with no path that re-canonicalizes it.
**Evidence**: `sanitizer-compat.mjs` ran the pre-E55 sanitizer (`git show c4472a41^`) and today's over 30,000 random HTML inputs: 0 pre-E55 canonical outputs changed under the new sanitizer, 0 idempotence failures either side. So no defect today; the risk is the missing guard.
**Fix**: (a) a committed golden corpus of a few hundred sanitizer outputs (the templates' html included) held byte-for-byte by the test, so a canonical-form change is a deliberate `SHEET_FORMAT` bump; (b) in `planSheetChange`, run `cleanSheetText` over the current sheet before validating, so a drift degrades to a one-time rewrite rather than a refusal.
**Confidence**: High on the mechanism; the probability is the maintainer's.

### Audit 2 fixes re-checked

- **DI-1** (floor for a single occurrence; `moved` needs both sides): holds, `anchor-core.mjs:189-195`, vectors spec 3, fuzz test at `test/anchor-text.test.js:148`. Residual in DI3-2.
- **DI-2** (typography folded for matching): holds, `foldTypography` `:60-65`, applied `:231-234`; offsets unchanged (one unit for one).
- **DI-3** (one trash id, two copies merged field-wise): holds, `bothTrash`/`collapseTrash` `desk-merge.mjs:173-227`; `merge-fuzz.mjs` 8,000 three-replica histories (two seeds), two exchange orders each: 0 diverged, 0 non-idempotent; the DI-3 property test at `test/desk-merge.test.js:352`.
- **DI-4** (summary names deletions here and points to the Trash): holds, `desk-export.mjs:744, 818-820`; `store-probe.mjs` prints `deletedHere: 1` for the reopened backup.
- **DI-5** (persistence asked again; a button): holds, `store.js:278-293` (a silent "no" retried after a day), `askToKeep` `:410-420`, store test covers both.
- **DI-7** (joined highlights keep labels; a split piece keeps unknown fields): holds, `desk-highlights.mjs:191-200, 259-267`.
- **DI-8** (five-minute tolerance; an edit stamps past the version it replaces): holds for edits, `CLOCK_TOLERANCE_MS` `desk-merge.mjs:149`, `laterThan` `desk-records.mjs:191-195`. Not for deletions and restores: DI3-1.
- **DI-9** (read and write in one transaction): holds at every site named: highlight `actions.js:458`, labels `labels-ui.js:103, 123`, Delete everything and Empty the trash through `writeOver` `notebook-page.js:385`, Open a copy `export-import.js:257-265`, Keep `change-notice.js:427-432`.
- **DI-10 / RC-1** (held record checked; `store.undo` runs `planWrite`): holds, `restoreFromTrash` `:241`, `planUndo` `desk-store-core.mjs:168`, `planImport` `desk-export.mjs:690`, `problemWith` `desk-merge.mjs:139`. See DI3-4 for the consequence of skipping.
- **DI-11** (version-aware upgrade): holds, `store.js:86-95`, store test "opening a database from version 1".
- **DI-12** (`exported` with an offset): holds, `capOf` `desk-merge.mjs:238-243`, test at `desk-merge.test.js:328`.
- **RC-5** (self-compare test replaced): holds, `test/desk-storage-keys.test.js` reads `/privacy` against every `lit-desk`, `lit-sheet`, `lit-greek` key in `src/`.
- **DI-6** is the note editor's (NB slice); not re-checked here.
- **FA2-m/n/o, merge vectors 4 and spec 3**: code agrees with the vectors (`test/anchor-text.test.js`, `test/desk-merge.test.js`, 706 tests green in this slice) and with the spec text I compared line by line ("Finding a mark again", "Spec version 3", "Clocks"). Both still await BDR's confirmation (`STUDY-DESK.md:2490`; the merge's rule 6 and the skew bullet say "for BDR to confirm").

### Improvements

- **Keep `anchor-revisions.mjs` as a script beside `build-anchor-vectors.mjs`** (not a CI test: it needs full git history), and run it before any `ANCHOR_SPEC_VERSION` bump; it is the only measurement against real revisions, and it is what found DI3-2.
- **State the hybrid-clock rule once in the format** ("every stamp is at least 1 ms past the thing it replaces: an edit past the version, a deletion past the record, a restore past the deletion") instead of per case, so BDR implements one rule.
- **Show the follower's writes to BDR as a sync load**: at `MOVE_EVERY_MS` 2 s a reading session is up to 1,800 record writes an hour per bookmark; whatever phase 4's transport charges per write, this is the heaviest writer in the notebook.
- **Golden corpus for the sanitizer** (DI3-6), and `cleanSheetText` on the edit path.

### Questions for the owner

1. DI3-2: should a `moved` that leaves the mark's verses carry the notice (Audit 2's question 1), or should it need the full context? On real revisions it is wrong 15 times in 18 as it stands.
2. DI3-3: is "a move never beats an edit" the rule you want for bookmarks, or is rule a (whole record, newer wins) accepted for them with the consequence named?
3. DI3-4: when a deletion is readable but the copy it holds isn't, should the website keep the deletion as a tombstone (my recommendation) or keep skipping it?
4. Spec 3 and merge vectors 4 are a month old and still "for BDR to confirm"; DI3-1 adds a third change to the same two files. Is there a date by which the three are settled together?

### What held up

- **Merge**: `merge-fuzz.mjs`, 8,000 random three-replica histories (creates, edits, deletes, restores, a mid-run partial exchange, one clock 90 s fast in a quarter of runs), full pairwise exchange in two orders: identical record sets every time, live and trash; a second pass of every exchange writes nothing; a tombstone blocks a stale live copy and a stale full trash record doesn't refill it. `problemWith`, the kind-collision rule and the clamp's never-beats rule read as the spec says.
- **Anchoring code against spec and vectors**: `bestByContext`'s floor `min(8, stored)` for one occurrence, the both-sides test, `foldTypography`'s one-unit-for-one replacements, `textBetweenContext`'s 8-character floor and the 2×+16 size limit all match the spec text; the vectors test passes. On the 474 real revision pairs, 83% of marks on changed verses are `found` and only 18 are `moved`.
- **Round trip** (`roundtrip.mjs`, every kind: labels, a labeled highlight with an app field, notes on a quote, on whole verses, on a footnote (E49) and with the old `bookmark` marker, bookmarks that move and stay, a pin, a mark rule, a legacy `place` and ribbon, a hidden passage, an unknown kind, a newer-schema note, a sheet with a passage, a list inside a paragraph (E55), a key terms box (E57), a Leader-only question, a space, a page break and an unknown module type, plus three trash records including a tombstone): full backup into an empty notebook is lossless (0 missing, 0 changed); into the same notebook it writes nothing and says "17 already here."; Web Annotation loses only the three trash records (documented); Markdown loses what it says it loses (marks that aren't notes; a note's labels, context and `created`). The share fragment and the `.lit-sheet.md` data line round-trip the sheet apart from `verseCopy`/`verseCopyAsOf` (the documented `DROP`), labels, and unknown top-level sheet fields (consistent with "less what means nothing to anyone else"); lists in paragraphs, the key terms box's `omit`, `leaderOnly`, `commercial` and the unknown module all survive a leader share.
- **Duplicate sheet (E27)**: fresh module ids, "(copy)" title within the limit, labels and unknown fields kept, validates. Its modules' `blanks`/`footnotes` arrays are shared by reference with the source object, which is safe because the source is a fresh read from the store and IndexedDB clones on write.
- **Store and history on the real `store.js`** (`store-probe.mjs`, fake-indexeddb): import of three notes → undo writes three trash records under the entry's allotted ids → redo removes them; delete → E12 restore (`planRestore`) → undo puts the one trash record back (no duplicate, `undoTrash` 0) → redo; the older delete entry is reported overtaken rather than applied; reopening the pre-delete backup after a second undo leaves the deletion standing and says "1 deleted here since this copy was saved". `apply` reads `before` in the write's transaction; `writeNow` commits with no read; a throwing plan aborts whole.
- **Sanitizer**: idempotent over 30,000 random inputs, and E55 changed no pre-E55 canonical output.
- **Layout persistence**: `checkLayout` refuses bad ids, sizes and depths, keeps unknown kinds, migrates `kept → mine`; `readSaved`/`writeSaved` tolerate a damaged key; storage reads and writes are try/catch'd.
- **Trash (E12)**: `planRestore`'s five refusals and `planRestoreAll`'s running `held` are right; a tombstone is never listed; a restore adds no field.

### Not reached

- Nothing in a browser: BroadcastChannel across real tabs, the sheet pane's `pagehide` `writeNow`, persistent-storage prompts (unit tests only).
- The apps' resolvers and their vectors (BDR's side).
- `desk-sheet-doc.mjs` and the slide writers beyond confirming the key terms box travels in the record; their output fidelity is the CP/DK slices'.
- A scan of every `store.save` caller for records written without `planSave` (the planners are tested; the callers were sampled: follower, Keep, labels, trash, import).

## Appendix C: The Notebook panel, marks, shared panels and first use (`NB3`, Sonnet)

Auditor slice C. Checkout `claude/desk-audit-3` at `60af379e`. Read-only; I ran `node --test` on `desk-first-use`, `desk-footnote-pills`, `desk-bookmarks`, `desk-announce`, `desk-print-part` and `desk-copy-constants` (72 pass, 0 fail) and read the code. No browser. Anything marked "browser check" needs the live auditor.

### Summary

The slice is in good shape. Every Audit 2 `NB-*` fix I re-checked is still in the code, and the new shared flyout (E39) is carefully built. The real problems cluster in three places: how the new flyout behaves under a mouse, focus after the new E49 "⋯" footnote pill, and a help page that no longer covers what the Study Desk does.

Counts: 0 Critical, 0 High, 5 Medium, 8 Low, 1 Nit. All are NEW (none is a Critical or High data-loss or WCAG A blocker). The note-never-lost guards held up.

The two findings that reach every reader, desk on or off, are NB3-1 (flyout toggles shut on click after hover) and NB3-2 ("Share image" on a long selection removes "Share text…" and drops keyboard focus).

### Findings

#### NB3-1 · Medium · usability · NEW (the flyout is from E39; the toggle came with the desk's earlier `flyoutRow` and now ships to every reader)

> **Fixed (Audit 3 session 1, 2026-11-07, branch `claude/audit3-session1-shared-panels`):** a click on a flyout that hover opened moves focus in (or, in the selection panel, keeps it open); only a click on one a click or a key opened closes it. Checked live on a built site with the desk off and on.

> **Live check (Appendix G):** confirmed with the desk off, on the Copy and the Share rows.

**Where**: `src/scripts/panel-flyout.js:97-100` (`flyoutRow`, the trigger's click handler) with `:91-94` and `:101` (hover opens).

**What happens**: Hovering the row or its chevron opens the flyout without focus (`pointerenter`, line 101). The trigger's click handler then runs `if (!fly.hidden) return close(true)`. A mouse user who moves to "Share ▸", "Print ▸" or "Copy text"'s chevron and clicks sees the flyout already open, and the click shuts it. The documented behavior is that "a click moves focus in" (`src/scripts/CLAUDE.md`, "A mouse or the keyboard gets two flyout rows"), which does not happen for a hovered row. The flyout only comes back after the pointer leaves and re-enters. This is now in the verse menu and selection panel of every reader.

**Evidence**: Read the handler. There is no record of how the flyout was opened. `pointerFocus` only matters in the closed-to-open branch.

**Fix**: Remember how it opened (`openedBy = "hover" | "click" | "key"`). A click on a flyout that hover opened should move focus in (or keep it open) rather than close it. Only a click on one a click or key opened should toggle it shut.

**Confidence**: High on the logic. Browser check: in a verse menu with a mouse, hover "Share ▸", wait for the flyout, then click the row. Expect the flyout to vanish. Repeat on the Copy text chevron.

#### NB3-2 · Medium · usability · NEW

> **Fixed (Audit 3 session 1, 2026-11-07, branch `claude/audit3-session1-shared-panels`):** `imageStep`'s `onFail` gives the Share row back beside the reason (the chip layout's Share text… chip too), and a keyboard reader's focus goes to Share. Checked live on a built site with the desk off and on.

> **Live check (Appendix G):** confirmed with the desk off (the pane has no share sheet, so `navigator.share` was stubbed).

**Where**: `src/scripts/chapter-tools.js:621-634` (`actionRows`, `imageItem` click); `src/scripts/verse-image.js:270-273` (`begin`, "Too long" branch); `swap` at `:177-195`.

**What happens**: With a share sheet available, "Share image" lives in the Share flyout. Choosing it closes the flyout, hides the whole Share row (`shareRow.hidden = true`, line 630) and starts the image steps. If the text is too long for an image (`fitting.length === 0`, which is likely for a selection of a few verses), the step becomes a one-line note, "Too long for an image. Try fewer verses." The Share row, with "Share text…", is already hidden and nothing brings it back. The reader has to close the panel and reopen it, and a selection panel's selection may be gone by then. Before E39 "Make an image" and "Share…" were independent buttons, so a failed image never cost the reader Share text.

For a keyboard user it is worse. `swap` re-focuses `step.querySelector("button")` when the step had focus (line 182). The note has no button, so focus falls to `<body>` while the panel is a non-modal dialog.

**Evidence**: Read-through. The same hide happens in the chip layout ("its questions take the row over"), but there the failure leaves one flat button row, and it is not a regression there.

**Fix**: When `begin` ends in a note (too long, or "Couldn't make the image"), restore the row. Either give `imageStep` an `onFail` that un-hides `shareRow` and re-hides `image`, or show the note under the Share row instead of in its place. Focus the note (`tabindex=-1`) or the restored trigger.

**Confidence**: High on the logic. Browser check: select about 4 verses with the mouse in a browser that has `navigator.share` (Chrome or Edge on Windows or macOS), then Share ▸, then Share image. Confirm that "Share text…" is gone and where focus is.

#### NB3-3 · Medium · a11y · NEW

> **Fixed (Audit 3 session 2, 2026-11-07, branch `claude/audit3-session2-notebook`):** `notes-margin.js`'s `markFootnotes` now runs inside `keepPillFocus` (`footnote-pills.js`): when the margin mark hides the control focus is on, focus moves to "Add a note" (from the "⋯") or to the "⋯" (from a pill that went behind it), in both directions. Not run in a browser.

> **Live check (Appendix G):** confirmed at 770px: focus on `BODY` after the save.

**Where**: `src/scripts/desk/footnote-pills.js:100-106` (`pillsHome`); `src/scripts/desk/footnote-notes.js:128-132` (`openedFrom`); `src/scripts/desk/notes-margin.js:130-134` (`markFootnotes`); `src/styles/desk.css:2366-2368` and `:2411-2413`.

**What happens**: In "more" mode a keyboard reader opens the "⋯", chooses "Add a note", and saves. The editor's `restoreFocus` is the "⋯" (`pillsHome`, computed when the editor opened). `closePanel` puts focus there. A frame later the margin draws the new note beside that footnote and `markFootnotes` sets `data-desk-fn-margin` on the `li`. That drops the footnote out of "more": `.desk-fn-more` goes back to `display: none` (the only rule that shows it is `:not([data-desk-fn-margin])`). The focused element vanishes and Chrome drops focus to `<body>`. The reader is left at the top of the document's tab order after every first note on a footnote, in a narrow margin. In "row" mode the Add button stays visible and keeps focus, so only the narrow-margin case loses it. Deleting the last note on a footnote has the reverse flaw.

**Evidence**: Read the CSS selector chain at 2393-2420 and the focus sequence. `landFocus` deliberately skips footnote notes (`note-editor.js:365`), so nothing catches this.

**Fix**: After a margin draw that toggles `data-desk-fn-margin`, if focus was on a pill or "⋯" of that `li`, re-point it with `focusPin(li)` or the visible Add button. `notes-margin.js` already re-points focus after a draw (`focusGone`), so that is the place. Alternatively compute `home` when the editor closes rather than when it opens.

**Confidence**: Medium. Browser check: narrow the window so the Footnotes list reads "more" (`data-desk-fn-pills="more"` on `ol.footnotes`), use the keyboard to open "⋯" then Add a note, type, press Ctrl+Enter, then read `document.activeElement`.

#### NB3-4 · Medium · docs · NEW

**Where**: `src/pages/notebook/help.astro` (whole page); the "Help for the Study Desk" item in `src/scripts/desk/desk-page.js:692-693` and the tour's "title" step in `src/lib/desk-first-use.mjs`, both of which link to it.

**What happens**: The page titled "Notebook help" is the only help, and /desk's title menu calls it "Help for the Study Desk". It covers marks, the panel, saving, bookmarks, labels, the Greek tab, search and the tours. It has nothing on:
- the /desk panes, the pane menu (Add pane, Move, Size), the Layout window, Full screen;
- sheets (editing, Present, Share, Print, Save as .docx/.odt/.rtf/.pptx/.odp/PDF);
- the Search pane and the Book Intro pane;
- pinned footnotes (the thumbtack), notes on a footnote, or the left-margin pills and "⋯" (E49);
- Print ▸ in the verse menu and selection panel (E40);
- "Skip to the Notebook";
- the Notebook actions window (E31).

Pinned footnotes are named in the notebook tour and in My Notes but are not explained anywhere. A reader who chooses Help on /desk gets nothing about the page they are on.

**Evidence**: `grep -i "sheet\|pane\|pin\b\|thumbtack\|footnote"` over `help.astro` finds only the Greek tab's footnote letters and the tour's "adds a pane".

**Fix**: Either retitle the page "Study Desk help" and add sections for the desk page and sheets, pinned footnotes, notes on footnotes and Print ▸, or add a second help page linked from the desk's title menu. This is the NB-7/FA2-l follow-through for features added since.

**Confidence**: High.

#### NB3-5 · Medium · a11y · NEW

> **Fixed (Audit 3 session 2, 2026-11-07, branch `claude/audit3-session2-notebook`):** Narrowing the list (search, Show, color, label, scope) speaks the new count through an always-present `role="status"` region, debounced to 600 ms and only for a change the reader made, so opening the tab reads nothing. "Nothing shown in Matthew 9." speaks when it changes after the first drawing.

> **Live check (Appendix G):** confirmed; no live region receives the count.

**Where**: `src/scripts/desk/tab-mine.js:199-203` (`.desk-mine__count`, `.desk-mine__here`) and `:502-509` (`drawCount`).

**What happens**: Typing in "Search my notebook", or changing "Show" or a label or color filter, redraws the list and rewrites "Showing 3 notes (of 12 kept)." or "Nothing matches (of 12 kept)." The line is a plain `<p>` with no live region (no `role="status"` or `aria-live` anywhere in `tab-mine.js`). A screen-reader user filtering hears nothing about how many rows are left or whether any are. WCAG 4.1.3 Status Messages (AA). Audit 2's DK-2 fixed the same gap for the Search pane only. "Nothing shown in Matthew 9." (`.desk-mine__here`) has the same gap when /desk's LIT pane moves.

**Evidence**: `grep -n "aria-live\|role=\"status\"\|announce" tab-mine.js` returns nothing.

**Fix**: Make `.desk-mine__count` a polite status region that is always in the DOM (empty text rather than `hidden`, as the Search pane does), or call `announce` after a filter settles, debounced.

**Confidence**: High.

#### NB3-6 · Low · usability · NEW

> **Fixed (Audit 3 session 2, 2026-11-07, branch `claude/audit3-session2-notebook`):** Escape in a search field holding words clears it (and sends an `input`) and returns; the next Escape folds the Notebook (`panel.js`). Done in the handler rather than left to the browser, which sends no `input` and in some engines doesn't clear.

> **Live check (Appendix G):** confirmed, and worse: see LV3-1.

**Where**: `src/scripts/desk/panel.js:430-437` (panel `keydown`, Escape).

**What happens**: Escape anywhere in the panel with no panel or tray open runs `collapse()`. In `input[type=search]` ("Search my notebook") Escape is also the browser's "clear this field" key, and the handler does not check the target or `defaultPrevented`. A reader who types a filter and presses Escape to clear it gets the text cleared and the Notebook folded to its tab, with focus moved to the tab.

**Fix**: In the handler, if `e.target` is an `input[type=search]` holding text, let the browser clear it and return. Collapse on the next Escape.

**Confidence**: Medium. Browser check: type in "Search my notebook", press Escape once.

#### NB3-7 · Low · bug · NEW

> **Fixed (Audit 3 session 2, 2026-11-07, branch `claude/audit3-session2-notebook`):** The rail's change callback clears `foldedByHide` unless the hide handler is the one folding (`foldingByHide`), so a hand open, fold or window-narrowing in between means un-hiding no longer opens the panel.

> **Live check (Appendix G):** confirmed.

**Where**: `src/scripts/desk/panel.js:598-609` (`foldedByHide`).

**What happens**: `foldedByHide` is set when Hide my marks folds the panel and is cleared only on un-hide. Sequence: hide (folds, flag true); the reader opens the Notebook by hand (flag stays true); the reader minimizes it by hand; un-hide. The branch `else if (foldedByHide)` then expands the panel the reader had just put away. Only hiding folds, and only un-hiding resets, so any manual change in between is ignored.

**Fix**: Clear the flag whenever the panel is expanded or collapsed by anything other than the hide handler (for example in the `createRail` change callback when `e.detail.from !== "hide"`).

**Confidence**: High on the logic; rare in practice.

#### NB3-8 · Low · a11y · NEW (extends NB-16)

> **Fixed (Audit 3 session 2, 2026-11-07, branch `claude/audit3-session2-notebook`):** Restore all and Undo use `busy()` (`aria-disabled`), not `disabled`. A keyboard Undo that puts up Redo keeps focus on the new button, and a bar that closes with focus in it returns focus to where it was when the notice came up, else the page's main region. "Ask this browser to keep it" moves focus to the rebuilt button or, once it is gone, the Settings tab.

**Where**: `src/scripts/desk/trash-list.js:161` (`restoreAll`: `all.disabled = true`); `src/scripts/desk/panel.js:489` (`ask.disabled = true`, then `renderPersistence()` replaces the button); `src/scripts/desk/undo-bar.js:146` (`fresh.disabled = true`, then `hideUndo()` hides the bar the button is in).

**What happens**: NB-16 moved Pin, Unpin and Add-a-note to `busy()`/`aria-disabled` because a focused button that becomes disabled loses focus in some browsers. These three still use `disabled`. Restore all loses focus on its failure and "nothing to restore" paths (the success path calls `focusAt`). "Ask this browser to keep it" always loses focus: `renderPersistence` rebuilds the line, so the button is gone whatever the answer. After a keyboard Undo, focus is on a hidden bar.

**Fix**: Use `busy()` for the first, and for the second and third move focus to a stable target (the persist line with `tabindex=-1`, or the Settings tab, and the page's `<body>` is acceptable after Undo since the bar is last).

**Confidence**: Medium (browser behaviour). Browser check for Restore all: with a record in the trash that restores nothing (for example a bookmark onto a verse that holds one), press the button by keyboard and read `document.activeElement`.

#### NB3-9 · Low · bug · NEW

> **Fixed (Audit 3 session 2, 2026-11-07, branch `claude/audit3-session2-notebook`):** `revealPanel` calls `rail.collapse()` directly, so the first mark in a narrow window no longer moves focus to the Notebook tab.

**Where**: `src/scripts/desk/panel.js:387-391` (`revealPanel`), `:398-401` (`collapse`), `:148-153` (`firstUse.reveal`).

**What happens**: The first time the reader makes any mark with no "where should the notebook live" answer, `reveal()` runs `open(null, { focus: false })`. If the panel floats (a narrow window), `revealPanel` then calls `collapse()`, which calls `tab.focus()`. So in a narrow window the first note, bookmark or highlight moves focus to the Notebook tab right after the editor closes, taking it from the verse number the editor just restored. `open` was deliberately called with `focus: false`, so this contradicts the intent.

**Fix**: In `revealPanel` call `rail.collapse()` directly (no focus), not the local `collapse()`.

**Confidence**: Medium.

#### NB3-10 · Low · a11y · NEW

> **Fixed (Audit 3 session 2, 2026-11-07, branch `claude/audit3-session2-notebook`):** (a) The skip link carries `data-desk-skip`, and `desk.css` hides it while `data-desk-show="off"`. (b) `SiteHeader.astro`'s `bgRegions` is read on each open and close and takes every `.skip-link`, so the link the desk adds later is made inert with the first. (b) not checked in a browser.

**Where**: `src/scripts/desk/panel.js:698-713` (the "Skip to the Notebook" link); `src/components/SiteHeader.astro:424-429` (`bgRegions` names only `document.querySelector(".skip-link")`).

**What happens**: Two small things. (a) The skip link stays in the tab order when the reader has switched the Notebook off ("Show the Notebook" in the Display tray); activating it then opens the panel and writes `lit-desk-panel="open"`, against a setting that is off (`data-desk-show="off"` hides only the toggle buttons, `global.css:3963`). (b) The hamburger menu makes the first `.skip-link` inert while open but not the new one, which comes after it in the DOM. Whether a reader can Shift+Tab onto it is uncertain.

**Fix**: Hide or remove the link while `lit-desk-show` is `off` (listen to `desk:settings`), and give it a data attribute that `bgRegions` includes (or use `querySelectorAll(".skip-link")`).

**Confidence**: High on (a). Low on (b); browser check: open the menu on a chapter page with the desk on, and Shift+Tab from the menu toggle.

#### NB3-11 · Low · a11y · NEW

> **Fixed (Audit 3 session 1, 2026-11-07, branch `claude/audit3-session1-shared-panels`):** rows of buttons are `role="none"`; a line of words is `aria-hidden` and describes the menu through `aria-describedby`. Checked live on a built site with the desk off and on.

**Where**: `src/scripts/panel-flyout.js:63` with `src/scripts/desk/actions.js:179-183, 226-231` (`lineOf`, the resting-bookmark hint `p`).

**What happens**: The flyout is `role="menu"` and `flyoutRow` gives `role="menuitem"` to every `button`, but the Bookmark flyout also holds `div` rows and a hint `<p>` ("“Advent” is resting here while it follows you."). A menu may only contain menuitems or groups, so the hint is not exposed reliably and axe flags `aria-required-children`. The vertical arrow keys also step button to button across the rows, which is fine.

**Fix**: Give the row `div`s `role="none"` (or `group`) and move the hint out of the menu, or give it `role="presentation"` and an `aria-describedby` on the menu.

**Confidence**: Medium.

#### NB3-12 · Low · ui · NEW

> **Fixed (Audit 3 session 1, 2026-11-07, branch `claude/audit3-session1-shared-panels`):** a scroll or a press outside the row closes the flyout; it never hides with focus inside (focus returns to the row first). Checked live on a built site with the desk off and on.

**Where**: `src/scripts/panel-flyout.js:66-79, 128-130` (the menu is `position: fixed`, placed once on open).

**What happens**: A flyout that stays open (focus inside it, or the pointer over it) does not follow its row. A verse menu that scrolls with the text moves when the wheel turns, while the flyout stays at its fixed coordinates, so it detaches from "Copy text". Dragging the panel by its grip leaves it behind in the same way.

**Fix**: Close the flyout on scroll and on the panel's drag start, or recompute the position on `scroll` while it is open.

**Confidence**: Medium (browser check: open a flyout with the pointer resting on it, then wheel-scroll).

#### NB3-13 · Low · data-integrity · NEW

> **Fixed (Audit 3 session 2, 2026-11-07, branch `claude/audit3-session2-notebook`):** `save()` ignores a call while one is in flight (a `saving` flag around `saveNow`), covering a double-click, a held Ctrl+Enter and the edit path.

**Where**: `src/scripts/desk/note-editor.js:171-232` (`save`, `saveEdit`), `:252-257` (Ctrl+Enter).

**What happens**: Nothing guards a second Save while the first is in flight. A double-click on Save, or a held Ctrl+Enter, runs `save()` twice before the first `await store.save(next)` resolves. `createRecord` runs again and writes a second note with a new id on the same words. The window is small (the panel closes when the first write resolves), but IndexedDB in Safari or under load is slow enough to hit it. The edit path saves the same body twice, which is harmless.

**Fix**: A `saving` flag, or `busy()` on the Save button, checked at the top of `save`.

**Confidence**: Low to Medium (timing; browser check: throttle storage or double-click quickly).

#### NB3-14 · Nit · docs · NEW

**Where**: `src/pages/notebook/help.astro:57-59`.

**What happens**: "The “Study Desk” button beside the passage picker opens the Study Desk." After E50, scripture pages have a pill "Open in the Study Desk" in the toolbar's right slot, /read has a "Study Desk" pill beside "Go to passage", and the Notebook has a lamp link. "Beside the passage picker" is true only of /read.

**Fix**: Say "The “Open in the Study Desk” button in the toolbar opens...".

**Confidence**: High.

### Audit 2 fixes re-checked

- **NB-1** (Hide my marks closed the Notebook): holds. `panel.js:598-609` folds on hide and expands only if hiding folded it. See NB3-7 for a flag-reset edge.
- **NB-2 / DI-6** (note words discarded): holds. `holdPanel`/`closePanel` ask once (`lit-panel.js:58-71`), the editor keeps a `sessionStorage` draft and a `beforeunload` guard, and the Save/Delete paths force-close. The "Your unsaved words from earlier are back" line is there.
- **NB-3** (tabs do not fit): holds. `flex-wrap` on `.desk-panel__tabs` plus the `data-font="dyslexic"` padding rule (`desk.css:188-218`).
- **NB-4** (no early keyboard route): holds, "Skip to the Notebook" is built (`panel.js:698-713`; see NB3-10).
- **NB-5** (undo bar unreachable): holds. The spoken notice says "Press Ctrl+Z (or ⌘Z) to undo" (`undo-bar.js:~190`).
- **NB-6 / CP-1** (tour and help teach a removed layout): holds. `grep "foot of the panel"` finds none. Tour steps `panel`, `undo` and `kept` match the live UI (collapse button, `data-desk-hide-check`, `.desk-panel__page a`, `.desk-home`, Settings tab).
- **NB-7** (help missing basics): partly holds. Marks, the panel, Hide my marks and widths are covered. The desk and E39 to E53 are not (NB3-4).
- **NB-15** (a hidden note gives no sign): holds. `hiddenNotice` shows a visible "Show notes" notice.
- **NB-16** (disabled drops focus): partly holds. Pin, Unpin and Add-a-note use `busy()` and the file-wide pattern is in `focus-keep.js`. Three leftovers are in NB3-8.
- **NB-18** (aria-keyshortcuts): holds. It follows the `lit-shortcuts` switch (`note-settings.js`).
- **NB-19** (copy saved line): holds. The wording is now "Started the download of ... Your browser may ask where to keep it." (`export-import.js:135`).
- **LV-1** (focus after the editor's Escape): mostly holds. `onClose` calls `landFocus`, which lands on the verse number. It deliberately skips footnote and prose notes, so Escape in a footnote note's editor opened by mouse from the popover ends on `<body>` (the popover's `restoreFocus` is null); this is a small known gap, not new.

### Improvements

- **Notebook tour**: add one step on notes on a footnote and the left-margin Pin and "Add a note" pills (E49). The "pin" step only shows the popover. The tour and help never mention the "⋯".
- **Desk tour**: it covers panes, My Notes, sync, Stay here, title menu, Add pane and Layout. It does not mention the Search pane, Sheet pane, Present, Print ▸, Save as slides, Full screen, or the pane menu's Move and Size flyouts. The "title" step lists "adding a pane, the layout, printing, and display options" but the menu also holds Full screen, My notebook page and Help.
- **Flyout keys**: add Home and End to `role="menu"` (`panel-flyout.js:112-126` has arrows, Escape and Tab only).
- **Lazy Greek tab**: Arrow keys in the tablist activate (and so download) the Greek tab as the reader passes over it. Consider manual activation for Greek.
- **`aria-current`** on the pill's target is not needed, but the pill's "Open in the Study Desk at Romans introduction" wording on intro pages deserves a read in a screen reader.

### Questions for the owner

1. **Tab order of the margin pills in "row" mode.** The pills are drawn `row-reverse` so Pin is nearest the footnote, but the DOM and Tab order stay Pin then "Add a note", which runs right to left across the screen. Visual and tab order disagree (WCAG 2.4.3 only if the order alters meaning, which it arguably does not here). Is that acceptable, or should the DOM be reversed instead?
2. **Hover versus click on flyouts (NB3-1).** Is hover-open meant to make a click toggle it shut, or should a click always move focus in? The CLAUDE.md text says the latter.
3. **Help scope.** Should the desk have its own help page, or should `/notebook/help/` become "Study Desk help"? The title menu already calls it that.
4. **Share image.** Should a failed image leave "Share text…" reachable (NB3-2), or is closing and reopening the accepted cost?

### What held up

- **panel-flyout.js** (reader-wide): `aria-haspopup`/`aria-expanded`, the `role="menu"` with `aria-label`, Escape and Left stopping propagation and returning focus to `main ?? trigger`, Tab leaving without a trap, and the 220 ms pointer-leave grace with the re-enter cancel. `pointerFocus: false` is honoured on mouse and bypassed by `detail === 0`. The selection panel's `mousedown` `preventDefault` (`chapter-tools.js:1272`) covers the flyout because it is a DOM child, so a mouse selection survives clicking an item. Chips stay flat (`if (touch) return [panelRow(...), panelRow(...)]`). The desk-off reader path imports no desk code (`test/desk-copy-constants.test.js` asserts the flyout is shared and not desk code).
- **E49 pills**: the pure `footnotePillMode` rule, `PILL_*` constants and 72 tests pass. The measure/observe plumbing is sound (`resize`, `load`, fonts, `desk:column-moved`, text-size attributes), and the "⋯" closes on Escape, outside pointerdown, and focus-out (null `relatedTarget` handled). The closed stack is `visibility: hidden`, so it is out of the tab order and the a11y tree. Forced colors has a rule. Print hides the pills.
- **Never-lost guards** in `note-editor.js`: draft key per place, `beforeunload`, the hold-once question, and the Save paths that refuse to overwrite a note changed elsewhere (`planEdit`, `overtaken`).
- **Undo bar**: always-present `role="status"` region, 10 s close that waits on hover and focus, DONE strings, and the Ctrl+Z hint.
- **Trash list**: `describeEntry`, the REFUSED strings, `store.change` in one transaction, and the focus-after-restore helper `focusAt`.
- **Tours**: `snapshot`/`restore` and `remember: false` leave no keys behind; every step id is checked against the live selectors I read; the offer's "later" marker is written when shown.
- **Bookmarks**: `followStep`/`readingOn` (#470): a far chapter or another book pauses rather than moves, and `newLead` pauses on /desk. Covered by `test/desk-bookmarks.test.js`.
- **E50 pill**: `ScriptureLayout.astro` builds the address with `?place=` and `&intro=` for introductions; the label contains the visible text (WCAG 2.5.3); dark-mode custom properties are set for both selectors in `ReadMenu.astro`.
- **Record data in `innerHTML`**: every interpolation I traced in the panel, editor, undo bar and tours goes through `escapeHtml` or a type-checked `glyph`.

### Not reached

- `margin.js` placement math, `notes-margin.js` beyond the footnote-marking and focus code, `highlights.js`, `bookmark-follow.js`, `bookmark-mark.js`, `bookmark-stop.js`, `desk-bookmarks.mjs` beyond `followStep`.
- Contrast ratios were not recomputed from the tokens for the new pills, "⋯", flyout menu or tour card. Quick reading: `.desk-pin` text is `rgba(ink, .74)` on cream and clears 4.5:1; the 1px borders at `.22` are decoration, not the only identifier.
- `tour-runner.js` internals (card placement and focus), `float-window.js` behaviour for the offer windows, `tab-greek.js` and the Greek search (another auditor), and `notebook-page.js` below the Trash and Labels sections.
- Forced-colors rendering of the flyout chevron (borders only) and the "⋯" dots; I read the rules, not a render.
- No live check of Safari or Firefox for `pointerenter`/`pointerleave` on a `display: contents` flyout wrapper (`.lit-panel__row` is `display: contents`); the code relies on it.

## Appendix D: The /desk workspace, sheets and saved files (`DK3`, Sonnet)

Auditor slice D. Checkout `claude/desk-audit-3` at `60af379e`. Read-only; scripts and outputs are in
`C:\Users\bcjoh\AppData\Local\Temp\claude\C--Users-bcjoh-GitHub-litbible\72b2d486-f2e1-40d1-ac50-64deb3f7a063\scratchpad\a3\dk3\`
(`gen.mjs` makes every file, `check.py` checks packages, `san.mjs`, `san2.mjs`, `intro.mjs`, `perf.mjs` are the probes).

### Summary

The slice is in good health. The file writers (.docx, .odt, .rtf, .pptx, .odp, and the hand-written zip) produced
well-formed, structurally complete packages on every awkward sheet I fed them (ampersand and `<` in titles, a 200-character
title, emoji, Greek, Hebrew, curly quotes, control characters, lists nested and restarting, the key terms box, an empty
box, an empty sheet, an empty deck, A4 and Letter). All five opened and rendered correctly in LibreOffice 26.2 (PDF and
text round trips; text and order match the sheet). The newest code (E53 Book Intro pane, E43 Full screen, the pane-menu
flyouts, swap by dropping, Reading and `?place=`) reads cleanly and its pure rules behave under probing.
Findings: 0 Critical, 0 High, 1 Medium, 8 Low, 2 Nit. The Medium is slide text that PowerPoint will not shrink. Every Audit 2
`DK-*` fix I re-checked (DK-1 to DK-12, DK-15) and RC-2 and RC-7 are still in the code; RC-6 belongs to the Greek slice.
Nothing here needed a browser to confirm except where each finding says so.

### Findings

#### DK3-1 · Medium · compat · NEW

> **Fixed (Audit 3 session 3, 2026-11-07, branch `claude/audit3-session3-desk-sheets`):** a paragraph longer than a slide is cut after a sentence (`cutSentences` in `desk-slides.mjs`, a sentence longer than a slide after a word), across as many slides as it needs, and a quotation or box too long is cut between its blocks; a passage with blanks still cuts only at verse numbers, since its two forms' words differ. A long start-slide title is set smaller (`titlePoints`) in the .pptx, the .odp and the PDF. Checked in LibreOffice 26.2; not opened in PowerPoint.

> **Verified (Opus, Appendix J):** the XML is as described. Whether PowerPoint refits on open is likely but not reproduced (Medium confidence). Low.
**Where** `src/lib/desk-slides-pptx.mjs:127` (`textBox`, `<a:normAutofit/>` with no `fontScale`); `src/lib/desk-slides-odp.mjs:106` (`style:shrink-to-fit="true"`); cutting rule `src/lib/desk-slides.mjs:208` (`splitBlocks`, "between blocks only") and `:139`-`:156` (`chooseCuts`: a single verse stays whole).
**What happens** A slide's body is a fixed 11.9 by 5.85 inch box at 28 pt. A text or question part holding one long paragraph (say 1,500 characters of sermon notes) is never cut, because `splitBlocks` cuts only between blocks. PowerPoint does not shrink text on open: `normAutofit` without a `fontScale` means "autofit on, scale 100%", and PowerPoint recomputes only when the text is edited. So the paragraph runs past the bottom of the slide. The same holds for a 200-character sheet title (the title limit is 200, `SHEET_LIMITS.title`) at 48 pt in a 1.35-inch box anchored at the bottom: it grows upward off the slide. LibreOffice does shrink (it honors the autofit), and the print/PDF path shrinks in `fitBoxes`, so only the files opened in PowerPoint (and probably Keynote and Google Slides) are affected. The tests say a file was opened in PowerPoint "by hand (2026-11-06)" but on the normal-length fixtures.
**Evidence** Read the three sites above. `gen.mjs` made a 14-slide deck; its structure and LibreOffice render were correct, and the heuristic leaves about 50 percent slack for normal passages (560 characters at 28 pt is about 4 of 5.85 inches). Overflow needs a single block longer than about 900 characters, or a very long title or heading. Not reproduced in PowerPoint (not available here).
**Fix** Either also cut one long paragraph at sentence boundaries when it exceeds `max` (as `chooseCuts` does for verses), or write the shrink yourself: estimate the fit in `deckSlides` and set `<a:normAutofit fontScale="…" lnSpcReduction="…"/>` on the body box and the title. For titles, cap the start slide's title size by length.
**Confidence** Medium on the behavior of PowerPoint (python-pptx documents that autofit is not applied until edited); to confirm, open `deck.pptx` built from a sheet with a 200-character title and a 1,500-character text part and look at the title and body.

#### DK3-2 · Low · usability · NEW

> **Fixed (Audit 3 session 3, 2026-11-07, branch `claude/audit3-session3-desk-sheets`):** any way out of Reading (a Layout row, Reset, Add pane, a drag, a pane's kind, `?sheet=` or `?intro=`) turns back on the marks Reading turned off, through `leavesReading` (`desk-layout.mjs`) run in `commit`, and says so in the undo bar (“Left Reading: turned on …”), whose Undo puts back both; the remembered list is cleared on the way out, so a plain single LIT pane never brings back an old list. Not run in a browser.

> **Live check (Appendix G):** confirmed; LV3-2 is a worse sequence of the same feature.
**Where** `src/scripts/desk/desk-page.js:434` (the Layout window's shape buttons) and `:470` (Reset); `src/scripts/desk/reading-display.js:76-84`; `src/lib/desk-layout.mjs:153` (`arrangementOf`).
**What happens** Choosing Reading turns off verse numbers, footnote letters, key terms and highlights (site-wide settings in `localStorage`) and remembers which. They come back only when the reader later picks another row or Reset from a layout that `arrangementOf` calls "reading" (one LIT pane). Any other way out of Reading leaves them off with no word: Add pane from the title menu or a pane menu, the `/` Search shortcut, `?sheet=`, `?intro=`, a drag split. The reader then has two panes and no verse numbers or highlights in the LIT pane (so no verse menu), and the next Layout choice does not restore them either, because the layout in between was not "reading". The reverse also holds: a plain single LIT pane that the reader never set to Reading counts as Reading, so choosing "Two columns" can turn marks back on (with the undo bar) from an old remembered list. The doc (`desk/CLAUDE.md` rule on Reading) says "leaving Reading by another row or Reset", so this is the documented scope, but it is easy to trip.
**Evidence** Read the code paths; `arrangementOf` returns "reading" for any root that is one LIT pane.
**Fix** Run the restore from `commit` when the layout moves from a single LIT pane to more than one while `lit-desk-reading-off` is set, or tie it to a flag set by choosing Reading rather than to the pane's shape.
**Confidence** High on the code; the live-browser auditor can confirm: choose Layout > Reading, then title menu > Add pane > The LIT's right side; check Display options (verse numbers stay off).

#### DK3-3 · Low · usability · NEW

> **Fixed (Audit 3 session 3, 2026-11-07, branch `claude/audit3-session3-desk-sheets`):** `?intro=` with no room shows “There’s no room for a Book Intro pane…” (`introMoveMessage`, the Search pane's words) in the notice bar once the panes are drawn. Not run in a browser.

**Where** `src/scripts/desk/desk-page.js:1828-1840` (`?intro=` handler); `src/layouts/ScriptureLayout.astro` (pill `deskPlaceHref`).
**What happens** An introduction page's "Open the Romans introduction in the Study Desk" pill goes to `/desk/?place=romans-1&intro=romans`. With four panes saved, or a window too narrow to fit another column, `showIntroIn` returns outcome `"none"` and the handler drops it without a word. The reader lands on the desk at Romans 1 with no introduction and no message. (The Search pane path does say "There's no room for a Book Intro pane" through `introMoveMessage`.) `?sheet=` falls back to the last non-LIT pane; `?intro=` has no fallback.
**Evidence** `intro.mjs`: `showIntroIn(four-column layout, "romans", 2400, 900).outcome` is `"none"`; at width 500 also `"none"`. Handler reads `.layout` only.
**Fix** Announce `introMoveMessage({outcome:"none"}, …)` from the handler, or reuse a follower pane (as `?sheet=` reuses a non-LIT one).
**Confidence** High (code and probe). Browser check: open `/desk/?intro=romans` with four panes, or at a narrow width, and see nothing change.

#### DK3-4 · Low · ui · NEW

> **Fixed (Audit 3 session 3, 2026-11-07, branch `claude/audit3-session3-desk-sheets`):** a list inside a quotation is moved in by the quotation's indent and keeps its right margin in the .docx (`w:ind` on each item), the .odt (`LBQ`/`LNQ` list styles, written only when used), the .rtf (`\li`, `\ri`) and the slides (italic, as the quote). Checked in LibreOffice's PDFs of all three documents.

**Where** `src/lib/desk-doc-docx.mjs:206` (`listParagraphs`), `desk-doc-odt.mjs:215` (`listXml`), `desk-doc-rtf.mjs:133` (`listRtf`), `desk-slides.mjs:344` (`list` inside `slideParagraphs`).
**What happens** A list inside a blockquote (`quote` block) is written at the plain list indent, not inside the quote's 0.5 inch margins, so it looks detached from the quote above it. The quote's own paragraphs are indented by the `Quote` style; the list is not. In the paper copy the list is inside the quote.
**Evidence** `gen.mjs` "A quote" then a bullet: in the LibreOffice PDFs of all three files "A quote" is indented and "in quote" is at the page's list indent (page 1, below "Restart at 1").
**Fix** Pass `quoted` to the list writers and add the quote's left and right indent to each level.
**Confidence** High.

#### DK3-5 · Low · data-integrity · NEW

> **Fixed (Audit 3 session 3, 2026-11-07, branch `claude/audit3-session3-desk-sheets`):** `inlines` reads a `sup` as a verse number or footnote letter only when it has the copy's class (`.vn`, `.fn-ref`, `.sheet-copy__fnref`); any other is a new `{ t: "sup", kids }` piece, raised in the files and the HTML and plain words (“1st”) in the text.

**Where** `src/scripts/desk/sheet-word.js:43-47` (`inlines`, `tag === "sup"`), `src/lib/desk-sheet-doc.mjs:200` (`docText`, `fn` as `[text]`).
**What happens** A reader's own superscript in a sheet's text (the sanitizer allows `sup`, `desk-sheet-format.mjs:74`, so "1<sup>st</sup>" or "x<sup>2</sup>") is read as a footnote letter. The files raise it correctly, but Copy's plain-text flavor writes "1[st]" and "x[2]". Formatting inside the superscript is flattened to its text. Subscripts are not affected (they read as "x2").
**Evidence** Read the two sites; `san.mjs` shows `sup` survives the sanitizer. Not run through `docText` with a real DOM (it needs one), but the branch is plain.
**Fix** Mark a footnote letter only when it has the copy's footnote class (`.sheet-copy__fnref` or the note letter's class); read any other `sup` as a `style` with a superscript flag, or as plain text.
**Confidence** Medium (confirm by copying a sheet with "1<sup>st</sup>" and pasting into a plain-text field).

#### DK3-6 · Low · usability · NEW

> **Fixed (Audit 3 session 3, 2026-11-07, branch `claude/audit3-session3-desk-sheets`):** `codePng` gives the SVG a width and height (`sizedSvg`) before drawing it; a code that still can't be drawn is counted (`codesMissing`), and the status line adds “A code to scan couldn’t be drawn, so the file leaves it out.” Not run in Firefox.

**Where** `src/scripts/desk/sheet-save.js:62-72` (`drawCodes`), `src/scripts/desk/sheet-slides.js:105-116` (`codesWithPng`).
**What happens** If the browser cannot draw a code to scan to a PNG, the code is left out of the file, with only a `console.error`; the status line still says "Saved … .docx". The paper copy, which the reader checked on screen, had the code. `codePng` draws a data URL of an SVG that has only a `viewBox`, no `width` or `height` (`qr-svg.mjs`); that is the case browsers treat differently (Firefox has historically refused it in `drawImage`).
**Evidence** Read the code. Not run (no browser).
**Fix** Give the SVG `width` and `height` in `codePng` (add them to the string before the data URL), and say "The file has no codes to scan" in the status when one failed.
**Confidence** Low on the Firefox failure; High that a failure is silent. Browser check: Firefox, a sheet with "Show QR codes" on, Save as .docx, and see whether the code is in the file.

#### DK3-7 · Low · a11y · NEW

> **Fixed (Audit 3 session 3, 2026-11-07, branch `claude/audit3-session3-desk-sheets`):** per BVJ's rule (a disabled item is passed over in every menu), the title menu's top level now passes over a disabled Add pane as its flyouts and the pane menu already did; the shared `panel-flyout.js` and the Save as menu pass over `disabled` or `aria-disabled` items too (none of the reader's other menus has a disabled item). The rule is in `src/scripts/CLAUDE.md` and the desk's file.

**Where** `src/scripts/desk/desk-page.js:1371-1396` (pane menu `keydown`: `live = items.filter(aria-disabled !== "true")`), and `menuItem(label, why)` at `:1226`.
**What happens** In the pane menu, a line that cannot be used (Add pane with "Four is the most", or a side of it) is `aria-disabled` and carries its reason in `aria-describedby`, but the arrow keys skip it, and it is a button without `tabindex`, so a keyboard or screen-reader user never reaches it to hear why. Sighted users see the reason. The same pattern is in the title menu (`enabled(...)`), so it may be deliberate.
**Evidence** Read. 
**Fix** Let the arrows land on aria-disabled items (as the Layout window's shape buttons are reachable) and make Enter a no-op.
**Confidence** Medium (a design choice to confirm; see Questions).

#### DK3-8 · Low · a11y · NEW

> **Fixed (Audit 3 session 3, 2026-11-07, branch `claude/audit3-session3-desk-sheets`):** a pane's region is named by `regionNames` (`desk-layout.mjs`): its kind, and “The LIT, 2 of 2” where a kind is open more than once.

**Where** `src/scripts/desk/desk-page.js:978-1010` (the pane `section`, `aria-label` from `mark()` at `:1112-1118`).
**What happens** Each pane is a `<section aria-label="The LIT">`, a region landmark. Two LIT panes, or two Search panes, give two regions with the same name, which screen-reader landmark lists cannot tell apart. DK-7 shortened the label; it did not make it unique.
**Evidence** Read.
**Fix** Add a position or an ordinal when a kind repeats ("The LIT, 2 of 2"), as the flag already does for the leader.
**Confidence** High on the markup.

#### DK3-9 · Low · compat · NEW

> **Fixed (Audit 3 session 3, 2026-11-07, branch `claude/audit3-session3-desk-sheets`):** `docHref` (`desk-sheet-doc.mjs`) writes every link's address as a valid URI (`new URL().href`: a space or a non-ASCII character percent-encoded, an encoded one left alone), so every writer and Copy get it; the Copy golden's mailto link changed with it.

**Where** `src/lib/desk-doc-docx.mjs:336` (hyperlink relationship `Target`), `desk-slides-pptx.mjs:297`, `desk-doc-rtf.mjs:101` (percent-encodes only quote, space, backslash and braces).
**What happens** A link's address is written as typed. The sanitizer keeps `https://x.com/a b` (probe `san.mjs`), so a .docx or .pptx relationship carries a `Target` with a space (and any non-ASCII character as is). Word is usually lenient but Open XML tooling that parses `Target` as a URI throws, and Word may call the link broken. The .rtf path does encode a space.
**Evidence** `san.mjs` output; code read. Not opened in Word.
**Fix** `encodeURI`-style normalization of the `href` in `inlines()` (sheet-word.js:55) so every writer gets a valid URI.
**Confidence** Low.

#### DK3-10 · Low · compat · NEW

> **Fixed (Audit 3 session 3, 2026-11-07, branch `claude/audit3-session3-desk-sheets`):** each line to write on in the .rtf is an exact 32pt paragraph with no space before (`\sl-640\slmult0`), still ruled below and between; LibreOffice now spaces the three evenly. Not opened in Word.

**Where** `src/lib/desk-doc-rtf.mjs:71` (`ruled`: `\brdrbtw` with `\sb360`).
**What happens** In LibreOffice's PDF of the .rtf, three "lines to write on" are spaced 50, then 25 pixels apart, where the .docx and .odt are even. Word may draw it differently. Only observed in LibreOffice.
**Evidence** `pdf/rtf/awkward-letter.pdf` page 2 against `pdf/docx/awkward-letter.pdf`.
**Fix** If Word shows the same, use fixed-height empty paragraphs with a bottom border and no `\brdrbtw`.
**Confidence** Low; open the .rtf in Word to see.

#### DK3-11 · Nit · performance · NEW

> **Fixed (Audit 3 session 3, 2026-11-07, branch `claude/audit3-session3-desk-sheets`):** `docRuns` tidies spaces in one pass forward and one back, keeping the line's last text and whether text follows, so 60,000 runs take milliseconds.

**Where** `src/lib/desk-sheet-doc.mjs:330-338` (`docRuns`: `prevText` uses `runs.indexOf(r)`, the trim pass uses `raw.slice(i + 1).find`).
**What happens** Quadratic in the number of runs in one paragraph: 15,000 runs take 72 ms, 60,000 take 4.5 s (`perf.mjs`). A real sheet (512 KB limit, passage paragraphs of tens of verses) stays far under this; only an absurd single paragraph hits it.
**Fix** Track the previous run's text in the loop.
**Confidence** High; unlikely to matter.

#### DK3-12 · Nit · copy · NEW

> **Fixed (Audit 3 session 3, 2026-11-07, branch `claude/audit3-session3-desk-sheets`):** the share file's words are escaped for Markdown (`markdownLine`: a leading `#`, `-`, `+`, `>` or number-dot, and `*`, `_`, backquote and backslash anywhere, title and subtitle included), paragraphs are a blank line apart, and the file's own list marks and rule are left as Markdown.

**Where** `src/lib/desk-sheet-share.mjs:196-210` (`plainText`) and `shareFile` (`:262-266`).
**What happens** The share file's human half does not escape Markdown: a text part starting "# x" or "- y" becomes a heading or list in the file, a title with `*` or `_` italicizes, and paragraphs are joined by one newline so they run together in a Markdown viewer. The authoritative data is on the last line, so nothing is lost.
**Fix** Escape a line's leading `#`, `-`, `>` and number-dot, and join paragraphs with a blank line.
**Confidence** High.

### Audit 2 fixes re-checked

Held, in the code:
- DK-1 keyboard word choosing: `sheet-lit.js:493-571` (`armWordCursor`; `tabIndex 0`, arrows by word, Shift extends, Enter or Space blanks, Escape collapses; cursor drawn through `CSS.highlights` with system colors, `desk.css:7237`). Without `CSS.highlights` there is no visible cursor (Chrome 105+, Safari 17.2+, Firefox 140+), only the spoken one.
- SEC-1's second lock (imported chapter blocks stripped) is in `sheet-lit.js`; not re-run here.
- DK-2 Search pane live region (`search-pane.js:223`, one always-rendered `role="status"`), DK-3/DK-4 focus (`focus-keep.js` `redraw` used in `sheet-pane.js:425,484`), DK-6 forced colors (`desk.css:6760-6766` for the Search choices, `pin`, quiet buttons): present.
- DK-5 subscriptions filtered (not re-measured); DK-15 parking (`lit-pane.js:78-81, 319-360`): present; goTo unparks its target first (`:512`).
- DK-8 separators: `desk-page.js:1503-1560` (role separator, `tabIndex 0`, arrows, Shift, Home and End, `aria-valuetext`), and the pane menu's Size flyout (`SIZINGS`).
- DK-9 and RC-2: the Layout window names what closed and Reading's marks, with an Undo bar (`desk-page.js:426-447`); fixed.
- DK-10 (search field scrolls), DK-11 (`save()` writes only `last`, `desk-page.js:914-922`), DK-12 (`@media print` rules for `.desk-ws`): present.
- RC-7: the Layout and Print windows still are not modal and have no trap, by decision (focus leaving closes them, `desk-page.js:479-483, 568-577`, Escape also works from the title button). Not a regression.
- RC-6 (greek-builder) is not in this slice.
- DK-13, DK-14, DK-16: the Print case is gone; not re-driven.

### Improvements

- A `(copy)` suffix on Duplicate is cut safely at the title limit (`desk-sheets.mjs:109-123`); consider selecting the title text on open so the reader can rename at once (it already focuses the title).
- Add `w:cs` to Hebrew runs in `docx` rPr when `w:rtl` is set (Word uses the complex-script font from `w:rFonts w:cs`, which is set; this is belt and braces only).
- Give `desk-zip.mjs` an optional `comment` or at least the real file times (it uses `Date.now()` for every entry, fine) and a test with a name that needs bit 11.
- The Save as slides group could offer "with notes page" off; many leaders hand slides to a room.
- `printSlides`: if the reader cancels the print the `afterprint` handler still tidies, good; document that Firefox may not fire it on cancel.

### Questions for the owner

1. Should a pane menu line that is `aria-disabled` stay out of the arrow-key cycle (DK3-7)? It matches the title menu, so it may be on purpose.
2. Should leaving Reading by Add pane (or any non-Layout route) turn the four marks back on (DK3-2)? The doc scopes it to "another row or Reset".
3. Should `?intro=` with no room fall back to a pane that is already open (like `?sheet=`), or tell the reader (DK3-3)?
4. Should slide bodies be cut inside a very long paragraph, or is "one block per slide" intended for sermon notes (DK3-1)?

### What held up

Everything below was run or read.
- **Zip** (`desk-zip.mjs`): Python `zipfile` `testzip` is clean on all 12 files; CRC-32 and both size fields are right in the local and central headers; the end record's counts and offsets match; `mimetype` is first, stored, no extra field, in both ODF files; names are ASCII with no bit 11; entries are in the order given.
- **Packages** (`check.py`): every `.xml` and `.rels` part is well-formed; every content type resolves; every relationship target exists, no duplicate ids; the ODF manifest names every file and the `/` media type equals `mimetype`.
- **LibreOffice 26.2** loaded every file and the PDFs matched the sheet: title, subtitle, "Leader only", the code image and caption, verse numbers raised and bold, the blank (leader: answer bold and underlined with its hint; participant: sixteen underlined no-break spaces), color, highlight and size, links, headings, nested lists, a numbered list that restarts at 1, a bullet list inside a numbered one, a quote, the key terms box ruled all round, rules, footnote, "Answer", ruled lines, page break, foot and credit last, in order. Greek used Cardo with `el`; Hebrew was right to left and ordered correctly.
- **Escaping**: `&`, `<`, `>`, quotes and a control character in titles, subtitles, hints and `descr` came through as text in docx, odt and pptx; XML-illegal characters and lone surrogates are dropped by `xmlEscape`; RTF is 7-bit with `\uN?`, surrogate pairs as two units, emoji correct in LibreOffice.
- **Edge sheets**: an empty sheet and an empty deck produce valid files; Heading levels are only 2 or 3 (sheet-word.js:104), so the RTF `PARA["h"+level]` lookup cannot miss; A4 and Letter both write.
- **Element order**: inside `w:rPr`, `w:pPr`, `w:tblPr`, `w:lvl`, `a:pPr`, `a:rPr`, `p:sldMaster`, `p:presentation` the order follows the schemas (checked by reading; nothing Word or PowerPoint typically refuses).
- **Slides**: the deck cuts at verse numbers both ways alike; a four-code start slide fits (`ROOM_CODES_MAX` is 4); notes, footnote slides, continued headings, credit on first and last, and unique ODP slide names are right; an `.odp` notes page has no `draw:style-name`.
- **Share and sheets**: `sanitizeSheetHtml` ends an open `<p>` where a block starts (E55; `<p>a<ul>…</ul>c</p>` becomes paragraph, list, paragraph), drops `javascript:`, maps h4 to h3 and h1 to h2; `duplicateSheet` gives every part a fresh id, keeps unknown fields, and cuts the title safely.
- **Book Intro pane** (E53): `showIntroIn` across all 27 books (shown, opened, none, no LIT pane, pinned), the `held` logic of `intro-pane.js`, the fetch guard (`introPath`, `Object.hasOwn`), the parsed-not-run intro (DOMParser, `importNode` into a div, ids removed, links to new tabs except plain scripture clicks), and the draft message. `parseIntroParam` rejects path-like input. Search results escape text (`highlightVerseHit`).
- **Other new workspace code**: Full screen (feature-detected, error announced), pane flyouts (hover, arrows, Escape steps back), swap by drop (`splitPane`, `swapPanes`, `dropZone` hold, plan again at release, announce on a refused drop), `fitSizes`, Reading and `arrivalLayout`, the separators, and `save()` writing only `last`.
- **Tests**: `node --test test/desk-sheet-doc.test.js test/desk-slides.test.js` 40 of 40; `desk-layout`, `desk-search-pane`, `desk-passage`, `desk-sheets`, `desk-sheet-copy`, `desk-present` 452 of 452.

What the tests do not cover (so nobody assumes they do): opening anything in Word, PowerPoint, Keynote or Google Slides (the 2026-11-06 hand check used the normal fixtures); overflow of a long block or title on a slide (DK3-1); a list inside a quote; non-ASCII or spaced link targets; whether a code PNG is drawn in each browser; RTF ruled-line spacing; the zip in an archiver other than the repo's own reader (I checked with Python).

### Not reached

- A live browser, Word, PowerPoint, Keynote, Google Slides: none available or allowed. The Word and PowerPoint claims rest on the fixtures BVJ opened and on schema order by reading.
- `search-pane.js` (1,220 lines) beyond the E53 diff, the intro result path and the escaping; `sheet-pane.js`, `sheet-text.js` (the editor), `sheet-copy.js`, `sheet-page.js` beyond Save as, Duplicate and the share dialog's file; `bookmark-follow.js` and E28/E41 beyond reading the header and the commit wiring in `desk-page.js` (`tellFollower`, `leadingPosition`); `print-menu.js`, `print-notes.js`, `print-part.js` (read `print-link.js` only); `widths.js`; the tours (`desk-tour.js`); `desk-layout.mjs`'s `addBeside`, `resize`, `fitSizes` internals beyond what the probes touched.
- The presenter window's rendering and the `sheet-present.js` clock (read the channel handling only: messages are validated by `presentMessage` and `checkState`, same-origin BroadcastChannel).
- Audit 2's DK-13, DK-14 and DK-16 and the print rules were not re-driven.

## Appendix E: The Greek tab, Greek search and the builder (`GK3`, Sonnet)

Auditor: slice E. Checkout `claude/desk-audit-3` @ `60af379e`. Read-only; nothing in the repo was touched. Throwaway scripts are in `C:\Users\bcjoh\AppData\Local\Temp\claude\C--Users-bcjoh-GitHub-litbible\72b2d486-f2e1-40d1-ac50-64deb3f7a063\scratchpad\a3\gk3\` (`h.mjs` is the shared fetch-from-disk harness; `b1`-`b7` builder, `s1`/`c1`/`f1`/`f2` search brute force, `d1`-`d4` data, `n1` notebook search, `e1` escaping, `l1` langRuns, `p1` parsing queries, `r1` truncation, `o1` offers).

### Summary

The slice is in good shape. The data is clean and every brute-force check agreed with an independent matcher: 3,000 lemma-plus-filter queries, 600 two-word constructions, 2,774 form-button flows, and 20,000 notebook-search cases gave zero real mismatches; 8,000 hostile queries through the parser, readback and search gave no exception and no unescaped output. The 318 Greek and search unit tests pass. Nothing under `greek/` loads without the preview.
The new code (the builder, the lazy Greek loading, the E54 copy, the offer, the tab's lazy `greek-find.js`) is mostly sound. The real problems are small and local: one CSS class collision that distorts the "Sources and licenses" block, a builder that rebuilds its focused text box on every keystroke, forced-colors and announcement gaps in the builder, and a handful of edge cases.
Counts: 0 Critical, 0 High, 3 Medium, 10 Low, 2 Nit (15 findings). 1 is a REGRESSION of an Audit 2 fix (GK-12's button collides with the credit block), 1 is a partial KNOWN-OPEN (GK-6 covers the tab only), the rest NEW.
All 20 Audit 2 `GK-*` items and RC-6 were re-checked: all fixes are still in the code; two are incomplete (see GK3-1 and GK3-9).

### Findings

#### GK3-1 · Medium · ui · REGRESSION GK-12

> **Live check (Appendix G):** confirmed: the section computes a 999px radius and a border.

**Where** `src/styles/desk.css:4427-4445` (the "Show sources" button rules) against `desk.css:4061-4068` and `src/scripts/desk/tab-greek.js:503` (`sourcesSection`, `make("section", "desk-greek__sources")`) and `tab-greek.js:137` (`sourcesToggle`, `make("button", "desk-greek__sources", ...)`).

**What happens** GK-12's fix gave the new "Show sources" button the class `desk-greek__sources`, which the tab's "Sources and licenses" `<section>` already uses (`desk.css:4061`: top rule, `margin-top: 14px`, `padding-top: 10px`, 0.8125rem). The later rule (`desk.css:4427`) applies to both: `margin: 2px 0 4px; padding: 1px 8px; border: 1px solid rgba(ink, .58); border-radius: 999px; background: transparent; font: inherit; cursor: pointer`. So the credit block at the foot of the Greek text, which is the tab's licence attribution (CC BY-SA, Perseus credit), loses its 14px gap and its hairline, and is boxed in a full 1px outline with a 999px corner radius (a capsule around a multi-line list), with `font: inherit` resetting its line-height, and a pointer cursor over a non-interactive block. The attribution is still present, but it looks broken and the pill is not what anyone designed there.

**Evidence** Read both rule sets; same specificity, so the later one wins for every property they share (margin, padding, border, font). `grep desk-greek__sources` shows exactly those two users in JS and no scoping selector in CSS. No DOM available here, so not rendered.

**Fix** Rename the button's class (for example `desk-greek__show-sources`) in `tab-greek.js:137` and the three CSS rules at `desk.css:4427-4445`. Add a test that no class name is used for two element types in the tab (cheap grep test), or a unit test that `sourcesSection` and `sourcesToggle` do not share a class.

**Confidence** High on the cascade; Medium on how ugly it renders. **Live browser:** open the Notebook's Greek tab, scroll to the foot of the text, look at "Sources and licenses" (expect a rounded outline box, no top rule); select any word with a STEP or LSJ entry and confirm "Show sources" itself still looks right.

#### GK3-2 · Medium · a11y · NEW

> **Live check (Appendix G):** partly: the input is replaced on each keystroke, but focus and caret carry into the new one. Counted as Low.

**Where** `src/scripts/greek-builder.js:290-299` (`typed`), `:175-181` (`commit`), `:357-403` (`render`), `:279-311` (`drawCard`).

**What happens** Every keystroke in a card's word box runs `typed()`, then `commit()`, which always calls `render()`, which does `root.replaceChildren()` and builds a brand-new `<input>`; focus, value and caret are then copied onto the new element (`:394-402`). So the text box the reader is typing in is a different DOM node after every character. Consequences: (1) a screen reader sees a focus change to a new "Word 1, edit" control after each letter, which in NVDA and JAWS typically re-announces the label and can drop or double the typed-character echo; (2) the native undo stack of the box is destroyed each time, so Ctrl+Z inside the card does nothing (the comment at the top of the file promises Ctrl+Z works for the field, not for the card); (3) a text selection other than the caret is not restored; (4) the page's input method gets a new element mid-word on every `input` (only `compositionstart` is guarded).

**Evidence** Code read. `commit` calls `render()` unconditionally (`:179`); `render` never reuses existing nodes. `info`'s lemma lines and chips are the only things that need to change while typing.

**Fix** When the focused element is the card's own word box, patch in place: update that card's lemma lines, chips and notation text, and leave the `<input>` node alone. Or keep a keyed reconciler: reuse a card's `<input>` across renders.

**Confidence** Medium (needs a screen reader to judge how bad). **Live browser:** open Greek search, open "Search commands", click the card's word box, run `const el = document.querySelector('[data-key="w0"]'); window.__w = el;` then type one letter and check `window.__w.isConnected` (expect `false`); press Ctrl+Z in the box. With NVDA or Narrator on, type "λόγος" slowly and listen.

#### GK3-3 · Medium · a11y · NEW

**Where** `src/styles/global.css:3641-3664` (`.greek-chip`, `.greek-chip[aria-pressed="true"]`); no `forced-colors` rule for them anywhere (`desk.css:6687-6760` covers `.desk-greek__choice`, the segmented controls and the others, but not `.greek-chip`).

**What happens** The builder's chosen state is a Deep Green fill, a matching border and a white label, all colors. In Windows contrast themes background, border color and text color are replaced by system colors, so a pressed chip (genitive, singular, "Next to each other", "Either order") looks identical to an unpressed one. The only other cue is the `aria-pressed` attribute, which sighted contrast-theme users don't have. The file `src/styles/CLAUDE.md` (forced colors paragraph) and BA141/BA142 already require "chosen" to be drawn in a system color for exactly this.

**Fix** Add a `@media (forced-colors: active)` block: `.greek-chip[aria-pressed="true"] { border: 3px solid Highlight; padding: ... }` (mirror `.desk-greek__choice`), and keep `.greek-chip--only` distinct. The Greek-card `×` and the dashed `+ Then another word` button are borderless/background-only too: give them a `ButtonBorder` edge.

**Confidence** Medium (code is conclusive; not rendered). **Live browser:** DevTools > Rendering > Emulate CSS media feature `forced-colors: active`, open the commands window, press a case and a number chip, compare pressed and unpressed.

#### GK3-4 · Low · bug · NEW

**Where** `src/scripts/greek-builder.js:127-153` (`load`), `src/lib/greek-builder.mjs:156-165` (`resolveCard`): `resolveGreekQuery(index, ..., {})` is called without `bridge`; the search (`search-greek.js:179-180, 304-306`) passes it.

**What happens** A LIT rendering typed into a card is "unknown" in the builder while the very same text works in the field. `resolveCard(index, {words:["self-preservation"]})` returns an error, and the card says "No Greek word matches “self-preservation.”", offers no choices; but `searchGreekAuto("/", "self-preservation.gen")` finds σάρξ, σαρκικός and σάρκινος and 38 verses. Only the 47 glossary terms' renderings are affected, but those are exactly the words a LIT reader would try.

**Fix** In `load`, fetch the bridge for Latin words (`loadGreekBridge(base)`, already exported) and pass `{ bridge }` to `resolveGreekQuery`.

**Confidence** High (reproduced with `b4.mjs`/`b5.mjs`).

#### GK3-5 · Low · usability · NEW

**Where** `src/lib/greek-builder.mjs:56` (`readBuilder`: `if (!quoted && !isGreekCommandQuery(text)) return { cannot: "plain" }`), `cannotSay` at `:72-73`.

**What happens** Two or three plain Latin words are a word search of their own to the builder, "nothing to build", but `searchGreekAuto` runs them as a construction when no single word fits (`search-greek.js:398-405`). `pistis Christos` gives the builder's "ordinary word search, so there is nothing to build. Start a new search", while the search runs "Any form of πίστις, followed within 3 words by Χριστός"; `πίστις Χριστός` builds two cards. `logos theos` and `faith hope` likewise. The message is wrong for what is actually happening, and the "Start a new search" button wipes a working search.

**Fix** Let `readBuilder` take the same fallback (a plain two-or-three-word Latin query that parses as a construction) or reword the message ("This is read as ordinary words").

**Confidence** High (`b7.mjs`).

#### GK3-6 · Low · bug · NEW

> **Live check (Appendix G):** confirmed on /search with the desk on.

**Where** `src/scripts/search-core.js:1371-1380` (`greekOfferFor`), `words[key]` on the parsed JSON object from `loadGreekOffers` (`:1355-1362`).

**What happens** `words` is a plain object, so inherited names are "found". `latinKeys("constructor")` is `["constructor"]`, and `words["constructor"]` is `Object`, which is truthy, so a reader who types `constructor` under any type but Greek (desk on) gets the line “constructor” is also a Greek word (function Object() { [native code] }). Search-greek the button then goes to the Greek type. Reproduced in node on the real `greek-offers.json` (`o1.mjs`: `typeof words["constructor"] === "function"`). `toString`, `valueOf`, `hasOwnProperty` fold to other keys and don't hit; `constructor` is the only one found.

**Fix** `Object.hasOwn(words, key)` and a string check, or build the object with a null prototype (`Object.assign(Object.create(null), json.words)`), or use a `Map`.

**Confidence** High.

#### GK3-7 · Low · usability · NEW

**Where** `src/lib/greek-query.mjs` `parseGreekQuery` (`slice(0, MAX_QUERY_LENGTH * 4).trim().slice(0, MAX_QUERY_LENGTH)`), consumers `greek-builder.mjs:49-65` and `search-greek.js:297`.

**What happens** GK-7's fix clamps a query to 300 characters silently. A valid but long query (34 alternative words and `.gen`, 348 characters) is searched without its last words and without its `.gen`, with no error or note: `searchGreekAuto` returns 157 matches with 0 filters (`r1.mjs`). The builder reads the same truncated text (34 words, no filter); the next chip press then rewrites the field with the 299-character version, so the tail is lost for good. Rare (a real query is far shorter), but silent loss of input is the pattern RC-6 asked about.

**Fix** Return `{ error: { kind: "tooLong" } }` past the limit, with a sentence in `errorMessage`, instead of cutting; the builder would then say it can't show it and leave the field alone.

**Confidence** High on behavior; the scenario is contrived.

#### GK3-8 · Low · a11y · NEW (gap in GK-2's fix, and a double state in GK-12's)

**Where** `src/scripts/desk/tab-greek.js:136-152` (`sourcesToggle`).

**What happens** (a) The toggle writes each abbreviation's `title` into `<span class="lex-cite"> [..]</span>` as plain text. 28,920 of the 76,389 titles in `lsj/` and `step/` hold Greek (and one holds Hebrew), for example `Αἰθιοπεύς 3rd c.BC: Callimachus…`; none of it passes through `appendLang`, so it is read in the English voice, undoing GK-2 inside the one place GK-12 added. (b) The button sets `aria-pressed` and also swaps its label ("Show sources" / "Hide sources"), so a screen reader says "Hide sources, toggle button, pressed" (a double negative of state). A single entry can reveal 35 KB (`G3056`, λόγος: 323 abbreviations) as one run of text.

**Fix** Build the cite with `appendLang(c, ` [${title}]`)`; keep a fixed label ("Show sources") with `aria-pressed`, or keep the changing label and drop `aria-pressed`/use `aria-expanded`.

**Confidence** High (`d3.mjs` counts; code read).

#### GK3-9 · Low · bug · KNOWN-OPEN GK-6 (partial)

**Where** `src/scripts/search.js:1007-1020` (`writeGreekStatus`), `src/scripts/desk/search-pane.js:1137-1143` (`paintWord`), `src/scripts/searchbar.js` `renderGreekGroup` (`if (!hits.length) return;`).

**What happens** `searchGreek` now returns `failed: true` when a word's shard doesn't load, and the Greek tab uses it (`greek-find.js:264, 310`). The other surfaces ignore it for a single-word search: /search says "No occurrences of πίστις in the selected book." (no retry, and wrong when no book is selected), the tray silently draws no Greek group, and the Search pane keeps the exact-form guard `&& !greekState.exact`, so an exact-form search with a failed shard says "This exact form doesn’t occur. Clear “Exact form only”…" with no Try again. The only trigger is a flaky connection or a shard 404 after a deploy, so the damage is a wrong message.

**Fix** Branch on `res.failed` in the three places and draw "The verses couldn’t be loaded" with Try again, as the tab does.

**Confidence** High (read in each file); not provoked in a browser.

#### GK3-10 · Low · a11y · NEW

**Where** `src/scripts/greek-builder.js:206-224` (`lemmaLines`), `:175-181`.

**What happens** What a typed word turns out to be ("Looking this word up…", "No Greek word matches…", "πίστις · G4102 · faith") and the new choices appearing in the menus are plain paragraphs and buttons, not announced. Only an explicit press says "Search is now …" through the window's live region; typing says nothing (`commit(false, false)`). A screen-reader user typing a word learns neither that it was unknown nor which lemmas it reached.

**Fix** Wrap `.greek-card__lemmas` in a polite `role="status"` region, or call `announce` with the lemma line once the look-up settles.

**Confidence** Medium.

#### GK3-11 · Low · usability · NEW

**Where** `src/scripts/desk/tab-greek.js:1047-1058` (`showDetails`, `LEXICON_PAUSE`).

**What happens** GK-10's debounce applies to every selection, not only to arrow-key runs: a plain click on a word, or a word whose lexicon shard is already cached, shows "Loading…" for 150 ms before the entry appears. It's a flicker on every click and a fixed 150 ms of latency that buys nothing there.

**Fix** Render at once for a click, or when the shard is in the cache (`greek-data.js` has the promise); debounce only keyboard selection.

**Confidence** High on the code; the flicker needs a look.

#### GK3-12 · Low · bug · NEW

**Where** `src/scripts/desk/tab-greek.js:732-763` (the `copy` handler, E54).

**What happens** The plain-text flavor is built from `box.querySelectorAll("p, h3, h4")` only. A selection that spans a lexicon entry's head (`<p>`) and its body (`div.desk-greek__entry-body` holding text, `<b>`, `<br>`, no `<p>`) gets only the paragraph texts; the body text is dropped from `text/plain` (the HTML flavor is fine). A plain-text paste target (a note, a text field) then gets the headword and nothing else. Also, a `<br>` adds no whitespace, so lines whose source has none run together. The Greek text itself (paragraphs) is right, which is what E54 was about.

**Fix** Use block-level elements generally (`p, h3, h4, div, li`), or make the plain text from `range.toString()` plus the per-paragraph breaks; turn `<br>` into a newline before reading `textContent`.

**Confidence** Medium (no DOM available here to run the handler). **Live browser:** select from a lexicon entry's headword down through its definition, Ctrl+C, paste into a plain-text field.

#### GK3-13 · Low · usability · NEW

**Where** `src/scripts/desk/tab-greek.js:292-307` (`openFind`) and the lack of a style (`grep desk-greek__find-failed src/styles` finds nothing).

**What happens** When the lazy `greek-find.js` import fails (a page left open across a deploy), an unstyled `<p role="status">` is inserted after the parsing line. A `role="status"` node created with its text already in it is often not announced, and the note is removed only by the next `openFind`; selecting another word leaves "The Greek search couldn’t be loaded. Try again." under the new word's details. There's also no progress cue while the chunk loads for the first time (the "Searching…" status only exists after it arrives).

**Fix** Put the note in a permanent empty live region, clear it in `showDetails`, and give it a class.

**Confidence** Medium.

#### GK3-14 · Low · longevity · NEW

**Where** `src/scripts/search-core.js:1353-1362` (`loadGreekOffers`).

**What happens** `greekOffersPromise ??= fetch(...)...catch(() => ({}))` caches the empty object on failure, so one failed fetch (offline, a deploy gap) turns the "also a Greek word" offer off until reload. GK-14a's fix made the sibling loaders forget failures; this one was added later (#463) and does not.

**Fix** Clear the cached promise on a failure, as `loadGreekSearch` does.

**Confidence** High.

#### GK3-15 · Low · usability · NEW

**Where** `src/scripts/greek-builder.js:290-299` (`typed`), `src/lib/greek-builder.mjs:130-133, 96`.

**What happens** A card's text box strips spaces and symbols as they're typed ("holy spirit" becomes `holyspirit`), and among several `/`-joined words it silently drops any that is also a command word (`perfect/aorist` shows `aorist` only, and typing `perfect/` then `a` makes the first word vanish mid-sentence). That's the documented rule ("a quote can't sit inside a/b"), but nothing on screen says so; the reader just sees their text change.

**Fix** Show a one-line note under the box when a word was dropped or a space removed ("Words that are also commands can’t be joined with /").

**Confidence** High.

#### GK3-16 · Nit · docs · NEW

**Where** `src/lib/desk-greek-notes.mjs:12-13`.

**What happens** The header says the "My notes" switch does not govern the desk's Search pane, "which lists no notes for a Greek search". Since #463 the Search pane has the checkbox and lists them (`search-pane.js:247-256, 947`; the desk `CLAUDE.md` rule 15 says so).

**Fix** Correct the comment.

**Confidence** High.

#### GK3-17 · Nit · a11y · NEW

**Where** `src/scripts/greek-builder.js:238-244` (`title: ".${filter.words[0]}"`).

**What happens** Each chip carries `title=".gen"`, which assistive tech may read as an accessible description ("dot g-e-n") after the chip's name and count. The notation is already shown on the card.

**Fix** Drop the `title` (the card shows the notation), or use it only on the "only" chip.

**Confidence** Low.

### Audit 2 fixes re-checked

- GK-1 holds: re-ran every one of the 19,414 (lemma, form) pairs through `matchGreek` (the tab's real query with its edge-punctuation strip), 0 miss (`f1.mjs`); then 2,774 of them through the full `searchGreekAuto` flow (`prefer` picks the lemma) and the exact-form total equals the text's count of that lemma and folded form, 0 mismatch (`f2.mjs`). (The fix is now `offerForms` in `matchGreek`; `exactForm` is a `searchGreek` option, not a `matchGreek` one.)
- GK-2 holds in `sanitizeInto` and the UBS blocks (`langRuns` over all 10,699 STEP and LSJ entries: joined parts equal the text, no English inside a Greek run, 280 ms for the lot, `l1.mjs`); gap in `sourcesToggle` (GK3-8).
- GK-3 holds: `text-critical-signs.otf` is registered under Crimson, Inter, OpenDyslexic and Atkinson (`greek-hebrew-fonts.css`; not browser-checked).
- GK-4 holds (`couldBeGreek` takes two Latin letters, `search-greek.js:86-92`).
- GK-5 holds: 20,000 random NFC/NFD/Hebrew-point/lunate-sigma cases against an independent matcher, 0 mismatch (`n1.mjs`).
- GK-6 holds for the tab, not the other surfaces (GK3-9).
- GK-7 holds: 19 hostile shapes up to 1,000,000 characters through `readBuilder`, `isGreekCommandQuery`, `parseGreekQuery`, `isGreekQuery`, `couldBeGreek`, `foldGreek`, all under 50 ms (`b2.mjs`), and `searchGreekAuto` on 300,000-character inputs in under 60 ms (`b3.mjs`). The truncation is silent (GK3-7).
- GK-8 holds (`insertAtCursor("πίστεως", 7, 7, "=")` gives `=πίστεως`, `i1.mjs`).
- GK-9 holds: `public/_headers:72` has `/greek/*` with a day of `max-age` and `must-revalidate`.
- GK-10 holds (150 ms debounce, timer cleared in `deselect` and `destroy`); UX side effect GK3-11.
- GK-11 holds (`lang="grc"` on each word button, `tab-greek.js:422`).
- GK-12 holds in function, with the class collision GK3-1 (REGRESSION).
- GK-13 holds (the credit is drawn after hits and the article answer, `greek-find.js:326-329, 386`; not after a 0-hit command search, which has no list).
- GK-14 holds: `loadDeskSearch`/`loadDeskSheets`/`loadGreekSearch` forget a failed import; the tab checks `format === 1` (`tab-greek.js:339-343`). The new offers loader repeats the old mistake (GK3-14).
- GK-15 holds (COMPAT map in `foldGreek`).
- GK-16 holds (`aria-busy` is gone from `greek-find.js`).
- GK-17 holds in CSS (`desk.css:6724-6740` opts the selected word out of forcing; the apparatus row has a `Highlight` border).
- GK-18 holds: `NO_WORD` and `help.astro:178-181` name the arrows, Up and Down, Home and End, and the splitter's keys.
- GK-19 holds (`isGreekCommandQuery` / `isDeskCommandQuery`).
- GK-20 holds: one loader, `src/scripts/greek-chapters.js`, used by `greek-data.js` and `search-greek.js`.
- RC-6 holds for the card box (`maxLength = 100`, `greek-builder.js:286`); the field itself has none, so see GK3-7.

### Improvements

- Builder lemma lines and the Greek tab's search could show the Greek verse under each hit (still true from Audit 2); builder hits at least say "n verses".
- `ἐξ.prep`, `ἡ.fem`, `αὐτοῦ.gen`, `εἶ.2nd` read back as forms of ἕξ, ἤ, αὐτοῦ (the adverb), εἰ and return 0 matches (`b6.mjs`). Decision 9 keeps commands lemma-first on purpose, and the readback does name the word, so this is a question (below), but a "0 matches" dead end for the commonest preposition is worth a fallback or a hint.
- Show the builder's `+ Then another word` and `Remove word N` in the live region so a screen-reader user hears the card count change.
- Give the first click on a word's form in the Greek tab a cue while `greek-find.js` and the Greek engine load (first use downloads a chunk; nothing shows until it arrives).
- Mention in the Show sources button's name which entry it belongs to when two entries sit in one lexicon view (STEP + LSJ both have one).
- `.lex-cite` text contains the data's own markdown underscores (`_nominative_`); render them as italics or strip them.
- `search-greek.js` `loadGreekOccurrences` returns `null` for a missing shard, and `searchGreek` then silently drops a LIT-rendered lemma (`l.lit.counted` 0) rather than reporting `failed`; same family as GK3-9.
- A `test/` guard that no CSS class name is created for two different element kinds in `tab-greek.js` would have caught GK3-1.

### Questions for the owner

1. **Dead-end command queries under decision 9.** Commands stay lemma-first so `ὁ, θεός` is the article. A consequence is `ἐξ.prep` (prepositions of ἕξ, six), `ἡ.fem` (feminine forms of ἤ, "or"), `εἶ.2nd` and `αὐτοῦ.gen` all returning "0 matches in 0 verses". Would you accept a narrow fallback only when the lemma-first reading has zero hits under the typed filters and another lemma that shares the spelling has some (or a one-line "Did you mean ἐκ?")? Not changing the rule for queries that find something.
2. **The STEP (ML) glosses in `search/`.** `LICENSE.txt` says the search index's brief glosses are CC BY, apart from which the directory is CC BY-SA. For 25 of the 55 "(ML)" lemmas the search gloss is identical to the (ML) entry's gloss (for example προσοφείλω "to owe besides", ἐκτός "outside/except"; `d2.mjs`), i.e. a gloss taken from the entries you decided to treat as CC BY-SA. They are two or three words each and probably not protectable; if you want the cautious route applied consistently, say so in the licence file.
3. **Builder and Latin words.** Should a card accept the LIT's own renderings (GK3-4) and plain Latin word pairs (GK3-5), the way the field does? Both are one-line fixes if yes; if the builder is meant to be Greek-first, the unknown-word message could say so.
4. **Silent 300-character cut (GK3-7).** Error, or cut with a note?

### What held up

- **Data** (`d1.mjs`, `d4.mjs`): all 260 chapter files exist and match `BOOKS` exactly; 137,794 words, 7,942 verse instances, all NFC, `format: 1`, `book`/`chapter` match the file name, no duplicate (verse, t), verses and `t` in order, every pre/post a string. The one `lemma: -1` word is John 8:5 (the documented gap). 5,465 distinct lemma references all resolve in `lemmas.json`; 5,337 Strong's codes all have STEP and LSJ entries and all 5,363 UBS ids resolve. The search index agrees with the text word for word: for every one of the 5,465 lemmas the occurrence shard has the same occurrences as the chapter files and `count` matches; every form in the text is in its lemma's `forms`. No `<script>`, handler or odd tags in any lexicon HTML; 55 "(ML)" entries as documented.
- **Parsing links** (`p1.mjs`): for all 603 distinct parsing codes in the text, `parsingQuery` produces a query that parses without error and matches the word's own code (one code has no parsing, so no link).
- **Search correctness** (`s1.mjs`, `c1.mjs`): 3,000 random lemma-plus-filters queries (including two-filter combinations) agree with counts taken from the chapter files (the 17 flagged were the intended choice box for two lemmas sharing a spelling); 600 random two-word constructions with filters, gaps 0/1/3/6/anywhere and either-order agree on the number of verses with an independent enumerator.
- **Builder rules** (`b1.mjs`): 20,000 random card sets written with `writeBuilder` read back to the identical text, never "cannot".
- **Escaping** (`e1.mjs`): 8,000 queries made of `<img onerror>`, quotes, RTL controls, combining marks, NUL, astral characters, `&amp;` and command fragments through `parseGreekQuery`, `errorMessage`, `resolveGreekQuery`, `describeGreekQuery` and `searchGreekAuto`: no exception, no unescaped `<`, `>`, `"` or bare `&` in any readback built the way the surfaces build it. The tray, /search, the Search pane and the tab build every readback through `escapeHtml` or `textContent`; credit links carry `target="_blank" rel="noopener noreferrer"`. Notebook-search hits are drawn as text parts only; `recordHref` builds only `/glossary/#…`, `/articles/…` or a validated chapter path.
- **Lazy loading**: the 7 static-import guards in `test/search-greek-lazy.test.js` pass; `greek-detect.mjs` is the only Greek code on every page; nothing under `greek/` is fetched without `data-desk="on"`.
- **Notebook search** (`n1.mjs`): 20,000 cases agree with an independent matcher (NFC/NFD, final sigma, Hebrew points, prefix matching, one-letter token rule). `hidden` and trash records are never results.
- **E54** copy: converts word and sign buttons to `lang` spans, drops `.sr-only`, leaves the clipboard alone for a selection outside the tab; HTML flavor has no live attributes.
- **GK-14b / format check**, **`greek-link.js`** (`?greek=` parsed by a strict regex, stripped from the address), the **`/greek/*` cache rule**, and the **credit** (`SOURCES` and `SEARCH_CREDIT` agree with `LICENSE.txt` on the five sources and the CC BY-SA split for `lsj/` and the (ML) entries).
- **Tests**: `node --test` over `greek-*.test.js`, `desk-greek*.test.js`, `desk-search*.test.js`, `search-greek*.test.js`, `search-core.test.js`: 318 pass, 0 fail.

### Not reached

- Any browser, screen reader or forced-colors session: GK3-1 (render), GK3-2, GK3-3, GK3-10, GK3-12 and GK3-13 are code-reading findings with the checks above for the live-browser auditor.
- `float-window.js` itself (the commands window's drag, focus return and Escape); `desk-panes.js`' Greek pane wiring and `openHit`; the Search pane's layout (another slice), beyond its Greek result logic.
- Timing of notebook search at scale (`readRecords()` does a full `getAll()` per query; Audit 2 measured 1.7 s at 20,000 notes, not re-measured).
- Re-running `npm run build:greek` / `build:greek-bridge` to prove the committed data is reproducible (needs the clones outside the repo); `build:greek-bridge` output was read, not rebuilt.
- Safari and touch; the real rendered glyphs of the text-critical signs under Atkinson and OpenDyslexic.

## Appendix F: Longevity, engineering health and launch readiness (`LG3`, Sonnet)

Checkout `C:\Users\bcjoh\GitHub\litbible\.claude\worktrees\desk-audit-3`, commit `60af379e`. Read-only. Scripts I wrote are in `scratchpad\a3\lg3\` (`closure.mjs`, `fnsize.mjs`, `zipcheck.mjs`, `noassert.mjs`, `syms.py`).

### Summary

The desk is in better shape than at Audit 2 on the things Audit 2 flagged as cheap (the store has a real test against `fake-indexeddb`, `/privacy` is held to every storage key, highlights have a feature check, the Greek search is lazy, the Greek sources are recorded, `help.astro` now carries the widths paragraph). The static imports and the six `noopener`-only links MX flagged are not defects. The new file writers are tested beyond well-formedness, and I confirmed their zips are structurally sound. The risks that remain are about the next two years more than the next release: one 1,706-line closure that doubled since Audit 2, a 136 KB design record that grew 75% in four days, a launch checklist that is incomplete, a desk that costs every desktop reader about 124 KB gzipped on every chapter page once the flip happens, and one rule ("shared code never imports the desk") that no test enforces for most of the shared scripts.

Counts: 0 Critical, 0 High, 5 Medium, 6 Low, 2 Nit (13 findings).

### Findings

#### LG3-1 · Medium · docs · NEW (extends LG-3)

> **Fixed (Audit 3 session 6, 2026-11-07, branch `claude/audit3-session6-checklist`):** "Launching" names the stamp readers the grep found (items 2 to 4, with the Read View pill's CSS in `ScriptureLayout.astro`, which the finding missed, in item 4), adds Read View's retirement (8c) as item 11 for the same change as the flip, with the guard test and its two neighbours, and re-runs the grep after the flip.
**Where** `src/scripts/desk/CLAUDE.md`, "Launching" (lines 41 to 90) against the code.
**What happens** The checklist names the readers of the preview stamp, but the stamp is also read in places it does not name, and one whole launch step (Read View's retirement, work session 8c) is not in it at all. Flipping the pre-paint script will make all of these work (they key on the same `data-desk` attribute), so nothing breaks at the flip. What breaks is the cleanup: the `html:not([data-desk])` branches, "preview" copy and a guard test stay behind, and the Read View cutover is easy to forget because it lives only in rule text (`CLAUDE.md` lines 1139 to 1148).
Not in the checklist (grep of `lit-desk-preview|data-desk|dataset.desk|deskEnabled|desk=on|desk=off`):
- `src/styles/pages/read.css:329-346` (`html[data-desk="on"] .view-card--desk` swaps the Read View card), `src/pages/read.astro:133` (its comment and card).
- `src/components/ReadMenu.astro:240` (reads `dataset.desk === "on"` to offer "Open X in the Study Desk") and `:551` (`html:not([data-desk]) .read-menu__desk`), `src/layouts/ReadLayout.astro:40-51` (the E50 "Study Desk" pill in the picker row).
- `src/components/SearchBar.astro:147` and `src/scripts/searchbar.js:644-645` (the "Notebook actions" button, shown by `deskEnabled()`), `src/pages/search.astro:67,99` and `src/scripts/search.js:324-386` (the Notebook and Greek groups).
- `src/scripts/desk-frame.js:95` (`DESK_ATTRS`, what `standDown` removes) and `desk-gate.js:12,15,49,56,62` (the checklist names the file, but there are five reads).
- Read View's retirement (`src/lib/read-view-retirement.mjs`, `src/scripts/read-view-redirect.js`, E8 "At launch"): wiring the redirects into `astro.config.mjs`, the `/read/[book].astro` rewrite, the `lit_last_read` records written by Read View, and the sitemap. The guard `test/read-view-retirement.test.js:92` ("nothing in the site imports the retirement rules before the launch cutover") fails the moment this is wired in, and its two neighbours at `:111` and `:125` assert the preview-only swap on `read.astro`, `read.css` and `ReadMenu.astro`. They must be deleted or rewritten in the same change, and the checklist does not say so.
**Evidence** The grep above, `Read` of each hit; `desk/CLAUDE.md:1139-1148` ("8c wires them in at launch, removes Read View, and deletes the test that guards the gap"); `test/read-view-retirement.test.js:92-130`.
**Fix** Add to "Launching": (a) the files above under items 3 to 5; (b) a new item "Read View's retirement (8c)" that lists its tests and says the three preview-swap tests are rewritten with it; (c) a one-line instruction to re-run the grep after the change, and to expect zero hits outside `src/scripts/desk/`.
**Confidence** High

#### LG3-2 · Medium · performance · KNOWN-OPEN LG-10 (unchanged, and it matters more at launch)
**Where** `dist/_astro/shell.Dgv48En5.js` and its static closure; `src/scripts/desk-gate.js:45`.
**What happens** After the flip every desktop reader on a chapter page fetches the whole desk, though the Notebook starts minimized. From `dist/` (script `closure.mjs`-style walk, in Python in my session, results below): the desk-only chunks (those not reachable from the scripts a non-desk `john-3` page loads) are `desk.js` 152,482 B (it embeds `desk.css` as a string), `tab-mine` 75,882, `shell` 61,372, `continue-reading` 57,267, `boot` 32,587, `page` 12,283, `desk-footnotes` 8,430, `store` 7,714, `history` 5,562, and four small ones. Total **416,990 B raw, 124,059 B gzipped**. The scripts a non-desk chapter page loads total 112,496 B raw, 43,818 B gzipped. So the flip roughly quadruples the JavaScript on the site's main page for every desktop reader. Audit 2 measured 141 KB gzipped for the same closure; it has not moved, because FA2-z cut other things. The Greek tab is already a separate chunk (`tab-greek`, 24 KB), which is the right pattern. It is a deliberate-looking choice nobody has weighed against the site's "progressive enhancement, almost no JS" stance, so I have put the owner's call in Questions.
**Evidence** `dist/_astro` chunk walk (static `from"./x.js"` edges); `MX.md` section 2 sizes.
**Fix** Before the flip, either accept it in writing in "Launching", or: import `tab-mine`, `tab-verse` and the tour only when their tab is first shown (`panel.js` `TABS` already builds each tab on its own, per `test/desk-frame.test.js:172-176`), and start the shell on `requestIdleCallback` after `load` when the panel starts minimized (the pre-paint script already reserves its space, so no layout shift).
**Confidence** High on the sizes; Medium on how much a lazy split saves (not built).

#### LG3-3 · Medium · longevity · KNOWN-OPEN LG-13 (worse)
> **Fixed in part (Audit 3 session 6, 2026-11-07, branch `claude/audit3-session6-desk-page`):** the pane menu (`openKindMenu`, its Add pane, Move and Size flyouts, placement and closing listeners) is now `src/scripts/desk/kind-menu.js`, `createKindMenu({ getLayout, panesBox, paneEls, commit, announce, sizePane })`; `addWhy`, `whyText`, `sizingFor`, `SIZINGS` and `NEEDS_TEXT` moved into `desk-layout.mjs` with tests; `start()` went from 1,747 lines to 1,414. **Still open:** the title menu with its Add-pane flyout (its keydown, hover and tour wiring share `addStep`, `addFly` and `enabled`), the move-by-drag (`startMove`, 116 lines), the print and Layout windows and the tour wiring, one extraction per sitting.
**Where** `src/scripts/desk/desk-page.js:205` `start()` and the other closure factories (script `fnsize.mjs`, acorn, 3,944 functions).
**What happens** Longest functions now against Audit 2: `start` (desk-page.js) **1,706 lines** (906), `createGreekTab` 1,110 (1,012), `createSheetPane` 1,084 (1,009), `createSearchPane` 1,050 (906), `createSheetText` 937, `createMineTab` 754 (551), `createNotesMargin` 685 (663), `createPanel` 624 (534), `createLitPane` 557 (473), `createPassageBody` 470. 36 functions exceed 150 lines (29), 56 exceed 100 (47). `desk-page.js` is 1,912 lines, so 89% of the file is one function; it grew 1,063 to 1,912 lines in four days (pane menu flyouts, bookmarks on /desk, Full screen, the Book Intro pane, the add-pane flyout all went into `start`). Inside it live five separable subsystems that share state only through `layout`, `commit` and `draw`: the title menu and Add-pane flyout (about lines 476 to 900), the kind menu (1234 to 1500), the move-by-drag (1635 to 1760), the print/layout windows and the tour wiring. The next bug in any of them means reading 1,700 lines of shared locals.
**Evidence** `node scratchpad\a3\lg3\fnsize.mjs`; `git diff --stat a57e155d..HEAD -- src/scripts/desk/desk-page.js` (1,152 lines changed).
**Fix** Extract the three menus and the drag into modules that take `{ getLayout, commit, announce }`, the way `panel-flyout.js` and `intro-pane.js` already take their dependencies. Not a rewrite: one extraction per sitting, starting with the kind menu (`openKindMenu`, 200 lines, the most self-contained). Add the pure parts (`addWhy`, `sizingFor`) to `desk-layout.mjs` where the tests are.
**Confidence** High on the numbers; Medium on the proposed seams.

#### LG3-4 · Medium · longevity · KNOWN-OPEN LG-8(b) (partly)
> **Fixed (Audit 3 session 6, 2026-11-07, branch `claude/audit3-session6-tests`):** `test/desk-gate-imports.test.js` walks the static import closure of every shared file under `src/scripts`, `src/layouts`, `src/components` and `src/pages` and fails on any path into the desk. The Greek engine's edge is allowed from `src/lib/greek-commands-ui.mjs`, the module that imports `desk-greek.mjs`, not from the three scripts the finding named.
**Where** `test/desk-commands-window.test.js:30-36` is the only import-graph test: four search entries (`search-core.js`, `searchbar.js`, `search.js`, `greek-commands.js`). `test/search-greek-lazy.test.js` covers the Greek engine only.
**What happens** The root rule "shared reader code never imports the desk statically" is untested for every other shared script (`chapter-tools.js`, `lit-panel.js`, `panel-pieces.js`, `last-read.js`, `ref-preview.js`, `read-mode.js`, `glossary-selection.js`, the layouts and components). A future edit that adds `import { x } from "./desk/y.js"` to any of them silently ships the desk to every reader; nothing fails, and the cost is invisible except in the bundle. I checked the rule by hand and it holds today.
**Evidence** `scratchpad\a3\lg3\closure.mjs` walks the static closure of every non-desk file under `src/scripts`, `src/layouts`, `src/components`, `src/pages` and reports any path into `src/scripts/desk/` or `src/lib/desk-*`. Output: only `greek-builder.js`, `greek-commands.js` and `search-greek.js` reach `src/lib/desk-greek.mjs`, which is documented as shared with the Greek engine (`src/scripts/CLAUDE.md`, search section). Nothing reaches `src/scripts/desk/`. The MX six: `desk-gate.js` and `desk-frame.js` are the sanctioned gate files (`desk-frame.js` has no imports; `desk-margin.mjs` has none); `Layout.astro:11` pulls constants from `desk-margin.mjs` for the pre-paint script (pure, 363 lines, no imports); `greek-commands.js`, `lit-panel.js`, `panel-pieces.js` import `desk-frame.js` for `panelRoom`/`dockWidth`, which `src/scripts/CLAUDE.md` names as what "every page knows about its panel". So **none of the six is a breach**.
**Fix** Promote `closure.mjs` to `test/desk-gate-imports.test.js` with an allowlist of three files (`desk-gate.js`, `desk-frame.js`, `lib/desk-margin.mjs`) plus the documented `lib/desk-greek.mjs` edge for the three Greek files. About 40 lines; it is the single test I would add first.
**Confidence** High

#### LG3-5 · Medium · longevity · NEW
**Where** `src/scripts/desk/CLAUDE.md` (135,928 bytes, 1,811 lines).
**What happens** It was 77,727 bytes at Audit 2 and is 75% larger four days later (31 of the 40 commits touching the desk's paths edited it, MX section 9). Claude Code loads it whole the first time a session reads any file in `src/scripts/desk/`, so every desk session starts about 34,000 tokens in, on a Pro plan whose limits already pace the work (memory: "Claude plans"). Only the root file has a size test (`test/claude-docs.test.js:18`); this one has none, and the root file's instruction to put area detail here means it will keep growing. Much of the growth is per-entry build narrative ("Built 2026-11-06, awaiting BVJ's look", branch names, which E number asked) that the Phase 5 log (`STUDY-DESK-FIXES.md`, 139 KB) already holds.
**Evidence** `git show a57e155d:src/scripts/desk/CLAUDE.md | wc -c` = 77,727; `wc -c` now = 135,928; `git log --since=2026-11-03 -- src/scripts/desk/CLAUDE.md` count 31.
**Fix** Add a cap test for `src/scripts/desk/CLAUDE.md` (say 140 KB, then lower it as it is trimmed), and move the "how E-nn was decided and built" paragraphs into `STUDY-DESK-FIXES.md` leaving the rule and one pointer. Keep rules, invariants, and "why".
**Confidence** High

#### LG3-6 · Low · docs · NEW
> **Fixed (Audit 3 session 6, 2026-11-07, branch `claude/audit3-session6-cleanups`):** `src/scripts/desk/CLAUDE.md` now says `bookmarkState`, and the sentence on the chapter-carrying link names the toolbar's pill (`ScriptureLayout.astro`), with the header link on the home page only.

**Where** `src/scripts/desk/CLAUDE.md:541` and `:1136`.
**What happens** Of 139 file names, 185 identifiers and 14 CSS classes I extracted from the lines added to the four area docs since Audit 2 (`syms.py`), all but these exist: (1) `bookmarkLine` at line 541 is `bookmarkState` in `bookmark-follow.js:119`. (2) Line 1136 says "The header's 'Study Desk' link carries the chapter on a chapter page (`deskPlace` to `SiteHeader`, `deskPlaceHref` is the same address for code)". E50 (decided (b), 2026-11-06) moved that link: the header link is on the home page only (`SiteHeader.astro:10`, `deskLink`), and the chapter-carrying link is the pill in the scripture toolbar (`ScriptureLayout.astro:122-130,218`, local consts `deskPlaceHref`, `deskPlaceLabel`). No `deskPlace` prop exists. `ReadMenu.astro:242` also cites `desk-passage.mjs`'s `deskPlaceHref`, which does exist (`desk-passage.mjs:73`).
**Fix** Rename the first; rewrite the second sentence to the pill. The other 38 sampled claims, and the four "held by test X" claims I checked (`desk-frame.test.js` for the `:has()` list, `desk-footnotes.test.js`, `desk-chapter-address.test.js`, `desk-anchor-dom.test.js`), are accurate.
**Confidence** High

#### LG3-7 · Low · longevity · NEW
> **Fixed (Audit 3 session 6, 2026-11-07, branch `claude/audit3-session6-tests`):** `test/desk-storage-keys.test.js` now scans every storage call's key (literal or template prefix), every `KEY`, `key:` and `legacy:` value and every `lit_` value in a property map, allowlists the site-wide keys with a reason, and checks both ways against `/privacy`. Decisions for BVJ: `lit_rm_focus` (Read View's focus mode) is not clearly named on `/privacy` and is allowlisted as `TODO(BVJ)`; and `lit_welcome_v2`, a cookie the welcome popover sets, is not named on `/privacy`, which says the site sets one cookie. The privacy page is not edited.
**Where** `test/desk-storage-keys.test.js:25-29`.
**What happens** The test collects keys with `/["'`](lit-(?:desk|sheet|greek)-[a-z-]+)["'`]/g`. It misses any key with a digit, capital, underscore or template hole, and any other prefix. I ran the regex: `"lit-desk-v2"`, `"lit_desk_x"`, `"lit-sheets-x"`, `` `lit-desk-${n}` `` and `"lit-desk-Foo"` all return no match, so a new key like that reaches `localStorage` with no `/privacy` line and no failing test. It also checks only one direction. (I checked the other direction by hand: every key `/privacy` lists still exists in code.) The test would catch a plain new `lit-desk-something` key, which is the likely case.
**Fix** Collect any string literal that is an argument to `getItem`, `setItem` or `removeItem` on `localStorage`/`sessionStorage` (or starts with `lit-`/`lit_`) and subtract an explicit site-wide allowlist (`lit-shortcuts`, `lit_last_read`, the Display tray's). Add the reverse check (every key `/privacy` names appears in code).
**Confidence** High

#### LG3-8 · Low · longevity · NEW
> **Fixed (Audit 3 session 6, 2026-11-07, branch `claude/audit3-session6-tests`):** `test/desk-package-integrity.test.js` builds the .docx, .odt, .pptx and .odp with the repo's writers and checks CRC-32s, relationship targets, `r:id` definitions, duplicate relationship ids, content-type overrides and ODF manifest entries, with no new dependency. Small broken packages are checked too, so the checker is shown to reject them.
**Where** `test/desk-sheet-doc.test.js`, `test/desk-slides.test.js`, `test/helpers/xml-check.js`.
**What happens** The E37 writers are the largest new risky code that is tested well: every XML part is parsed strictly, parts are named in the content types, the credit line, escaping and link filtering are asserted. What no test checks is what Word and PowerPoint repair dialogs are made of: the zip's CRC-32s, every relationship `Target` resolving to a real part, every `r:id` used in a part being defined in its `.rels`, no duplicate relationship ids, and an `Override` that points at no part. I wrote that check (`zipcheck.mjs`) and ran it on the real writers: **`.pptx` (42 parts), `.odp` (6) and `.docx` (9) all pass with no problems**, so nothing is wrong today. The test file's header says opening in PowerPoint and LibreOffice was done by hand on 2026-11-06, which covers the present but not the next edit.
**Fix** Add the roughly 30-line `check()` from `zipcheck.mjs` as one test over the three packages (`docx`, `pptx`, `odp`/`odt` for the manifest equivalent). It runs in milliseconds and needs no new dependency.
**Confidence** High

#### LG3-9 · Low · longevity · NEW
> **Fixed (Audit 3 session 6, 2026-11-07, branch `claude/audit3-session6-more-tests`):** items (c) to (e) are tested: `test/panel-flyout.test.js` (the flyout's hover, click, arrow, Escape and `pointerFocus` rules), `test/desk-intro-text.test.js` (with `introText` and the `held` rule moved to `src/scripts/desk/intro-text.js`), and a `QuotaExceededError` case in `test/desk-store.test.js`. Items (a) and (b) are in another PR.

**Where** Untested new or shared code (MX section 3 and my reading).
**What happens** The new code with the most behavior and no test, ranked by risk:
1. `src/scripts/panel-flyout.js` (82 lines): **shared with every reader** (the verse menu's "Copy text ▸" and "Share ▸", E39) and the desk. It owns the hover timer, `aria-expanded`, Escape/arrow handling and focus return. Only `desk-print-part.test.js` touches it. A regression here hits the public site, not the preview.
2. `src/scripts/desk/sheet-save.js` (211): the menu's keyboard loop and `download()`; the pure writers are tested but the click-to-file path is not.
3. `src/scripts/desk/intro-pane.js` (243): fetch, `DOMParser`, `introText` heading shift, id stripping, link rel, the `held` rule that keeps the pane on its book. All of that is plain logic.
4. `src/scripts/desk/bookmark-form.js` (270), `bookmark-stop.js` (98), `desk-panes.js` (436, mounts every pane kind), `kept-list.js`, `trash-list.js` (only the copy constants are checked).
5. `desk-page.js` as above: only `desk-layout.mjs` and `arrivalLayout` are tested.
**Fix** Tests with most value per line, in order: (a) the import-graph test (LG3-4); (b) the package check (LG3-8); (c) a `panel-flyout.js` test with the `float-window.test.js` stub style: open on pointerenter, Escape closes and refocuses `main`, ArrowRight opens with focus in, Tab leaves, `pointerFocus: false` keeps focus out; (d) export `introText` and the `held` decision as a pure function and test the heading shift and `[id]`/`rel` rules with `mini-dom.js`; (e) one `fake-indexeddb` test that makes a `put` throw `QuotaExceededError` inside `change` and asserts the promise rejects, no history entry is written, and no listener is told (the existing "a change that throws writes nothing" test covers a thrown planner, not a failed transaction).
**Confidence** High

#### LG3-10 · Low · longevity · NEW (extends LG-13/FA2-z)
> **Fixed (Audit 3 session 6, 2026-11-07, branch `claude/audit3-session6-cleanups`):** `commands-window.js` imports `make` from `dom.js`, and the chevron pair in `intro-pane.js`, `passage-bar.js` and `tab-verse.js` comes from `chevronIcons()` in `glyphs.js`. The other copies are left alone.

**Where** `src/scripts/desk/commands-window.js:37`, `desk-tour.js:47`, `first-use.js:82`, `sheet-text.js:69`; `desk-sheet-format.mjs:664-665`, `desk-sheet-discussion.mjs:96`, `desk-sheet-doc.mjs:98`.
**What happens** `dom.js` (FA2-z, 2026-11-04) is imported by 25 modules, and all the new pane code (`intro-pane`, `sheet-save`, `sheet-page`, `trash-list`) uses it. One new copy appeared after it existed: `commands-window.js` (added 2026-11-06, E31) defines its own `make`. Three older copies remain because they differ by `!== undefined` against `!= null`. Plus four HTML escapers and one XML escaper; the document and slide writers all share `xmlEscape`, which is good. The same chevron SVG pair is pasted in `intro-pane.js`, `passage-bar.js` and `tab-verse.js`. None of this causes a bug today.
**Fix** Use `dom.js` in `commands-window.js` now. Move the chevron icons to `glyphs.js` beside `OPEN_PAGE_ICON`. Leave the rest.
**Confidence** High

#### LG3-11 · Low · compat · NEW

> **Fixed (Audit 3 session 6, 2026-11-07, branch `claude/audit3-session6-checklist`):** browser-floor item 9 in "Launching" says `CompressionStream` (Safari 16.4) is inside the floor, so Save as and Share a sheet need no fallback.
**Where** `src/lib/desk-zip.mjs:38`, `desk-sheet-share.mjs:90,96`; `desk-page.js:662`; `sheet-present.js:486-575`.
**What happens** Nothing wrong; this is the browser-floor check. New code uses `CompressionStream("deflate-raw")` (Chrome 103, Safari 16.4, Firefox 113), `requestFullscreen` (all behind `fullscreenEnabled` or `?.`), `getScreenDetails` (gated by `window.screen.isExtended`, falls back to a window), `ClipboardItem` (gated, `sheet-page.js:174`), `:has()` (only inside a selector string in `sheet-present.js:144`, which would throw in an engine without it, but the floor is Chrome 105 / Safari 17.2 / Firefox 140 so it is covered), `showModal`, `structuredClone`, `.at`, `Object.hasOwn`. `desk.css` uses none of `light-dark()`, `@container`, `@layer`, nesting, `dvh`, `text-wrap` or anchor positioning. Every use of the CSS Highlight API is guarded: `highlights.js:41` returns null without `highlightsSupported()`, `notes-margin.js` (`supportsHighlight`), `sheet-lit.js:285`, `read-marks.js:106`. Nothing breaks at the stated floor.
**Fix** None. The one line I would add to "Launching" item 9 is that `CompressionStream` (Safari 16.4) is inside the floor, so Save as and Share a sheet need no fallback.
**Confidence** High

#### LG3-12 · Low · longevity · NEW
**Where** `test/desk-frame.test.js:172-176`, `test/desk-commands-window.test.js:46-54`.
**What happens** A few tests assert on the source text with regexes, for example `/import\("\.\/desk\/shell\.js"\)\.catch\(\(err\) => \{[^}]*standDown\(\);/` against `desk-gate.js`. They protect a real invariant (the gate stands down when the desk fails), but a harmless reformat of that call (a new line, a named function) fails them, and a change that keeps the text but breaks the behavior passes. This is the "mirror of the implementation" shape. The CP-16 constants test (`desk-copy-constants.test.js`) is the good version: it ties a sentence to the enforcing constant. I scanned 1,911 desk and Greek tests for tests with no assertion or a self-comparison: none (the 13 apparent hits assert through the `close`/`near` helpers).
**Fix** Where practical, make the invariant executable: have `desk-gate.js` export a `loadShell(importer, stand)` and test it with a rejecting importer. Otherwise leave it and expect to touch these tests when the gate is edited.
**Confidence** Medium

#### LG3-13 · Nit · longevity · NEW
> **Fixed (Audit 3 session 6, 2026-11-07, branch `claude/audit3-session6-cleanups`):** the three `.desk-np--pane` rules are deleted from `src/styles/desk.css`; a grep of `src/` confirmed no `np--` class is built.

**Where** `src/styles/desk.css:5755-5767`.
**What happens** `.desk-np--pane` (three rules) styles a class nothing builds; it is a leftover of the retired "kept" pane kind. MX confirmed no `np--` string exists in `src/`. The other ten "not found" classes in MX section 5 are all built by template strings (`desk-bookmark-glyph--${look}`, `desk-print-mark--${color}`, `desk-split--${node.split}`, `desk-sheet__module--${type}`) and are live.
**Fix** Delete the three rules.
**Confidence** High

#### LG3-14 · Nit · longevity · NEW
> **Fixed (Audit 3 session 6, 2026-11-07, branch `claude/audit3-session6-tests`):** `store.js` keeps the last request for persistent storage and exports `settled()`, which resolves once it lands; `freshBrowser` in `test/desk-store.test.js` awaits it in place of the 30ms sleep. The app never calls `settled()`.
**Where** `test/desk-store.test.js:33-34` (`freshBrowser`).
**What happens** The helper waits `setTimeout(r, 30)` so "the last test's unawaited request for persistent storage" lands before the next stub is installed. If a slow CI machine lets that request land late, it increments the next test's `calls.persist` and the "asks once" assertions (`:168-176`) fail intermittently. It passes in every run I saw (3,026 pass) and node runs each file in its own process, so it affects only tests inside this file.
**Fix** Have the store expose the in-flight persist promise (or have the test await `store.settled()`), and drop the sleep.
**Confidence** Low (a flake that has not happened)

### Audit 2 fixes re-checked

- **LG-1** (no store test): holds. `test/desk-store.test.js` runs the real `store.js` against `fake-indexeddb` (15 tests, all pass). The Playwright half is deferred by decision 13; not a gate.
- **LG-2** (`/privacy` omissions): holds. `privacy.astro:121-178` lists every key, the persistence request, `lastExport`, the tab messages and `history.state`; I checked in both directions that no listed key is stale.
- **LG-3** (launch checklist): a checklist exists and `deskEnabled()` is search's one read (`search-core.js:1243`), but the list is incomplete, see LG3-1.
- **LG-4** (`execCommand`): holds. The decision (accept for version 1, golden test before any replacement) is in "Launching" after the checklist.
- **LG-5** (highlights offered where unsupported): holds. `highlightsSupported()` (`note-settings.js:168`) gates `actions.js:107` and the settings switch; every `CSS.highlights` call is guarded (LG3-11).
- **LG-6** (Greek in every bundle): holds. `search-greek.js` loads on first Greek search; `test/search-greek-lazy.test.js` holds it.
- **LG-7** (`:has()` shared selector list): holds. `global.css:3967-3970` is its own rule, with the comment.
- **LG-8**: partly. The key test exists (LG3-7 for its gaps); the import-graph and CSS-pair tests do not (LG3-4). I ran the CSS pair check by hand in MX: all three dark-mode blocks have the explicit `[data-theme="dark"]` twin.
- **LG-9** (Greek sources unpinned): holds. `scripts/build-greek.mjs:20-52` gives URLs, the default `../greek-sources`, and the four commits.
- **LG-10** (desk loaded whole): unchanged, see LG3-2. The Greek tab is a separate chunk.
- **LG-11** (doc drift): holds. The "Close the Notebook" example is now accurate ("no `Close the Notebook` command"); the records table says BA153.
- **LG-12** (root `CLAUDE.md` near the limit): 39,520 of 40,960 bytes, 1,440 bytes (3.5%) of room, a little better than Audit 2's 550 but still one rule from a failure. Launch item 10 edits the root's "preview" wording.
- **LG-13** (large functions): worse, LG3-3.
- **LG-14** (wall-clock test): holds. `desk-merge.test.js:175` uses 600,000 ms.
- **LG-15** (dead exports/CSS): `sameLabelName`, `.desk-home-card__row` and `__skip` are gone; one new dead class, LG3-13.
- **RC-3** (widths guidance "in the help page"): holds. `notebook/help.astro:68` has the Widths paragraph.
- **RC-5** (self-compare key test): holds. `desk-greek-notes.test.js` no longer compares the key to a literal; `desk-storage-keys.test.js` covers it.

### Improvements

- Writers could re-check link schemes themselves (defense in depth): today only the DOM reader filters to `https?:` and `mailto:` (`sheet-word.js:57`, tested), and all five writers (`docx`, `odt`, `rtf`, `pptx`, `odp`) trust the model. One shared `safeHref()` in `desk-sheet-doc.mjs` would make that a property of the writers.
- Give `sheet-save.js`'s success line ("Saved name.docx") a caveat-free wording: it is said when the download starts, not when it finishes; a blocked download still reads "Saved".
- The six `_blank` links with `rel="noopener"` only (`print-menu.js:90`, `sheet-lit.js:895,1020,1090`, `sheet-pane.js:634,641`) are same-site, so the root rule (links that leave the site) does not apply. Adding `noreferrer` would make the desk uniform but is not needed; `print-menu.js` should be checked once that its computed `href` is always the site's own `/john-3/` style path.
- Add `npm run test:desk` as Audit 2 suggested; desk tests still sit under three name patterns.
- `README.md` has one line about the desk (`build:greek`). Launch item 10 already says to update it; add a short "The Study Desk" section then.
- Move `STUDY-DESK.md`'s settled phases into an archive file before the launch: at 513 KB it is read only by grep.

### Questions for the owner

1. Is about 124 KB gzipped of desk JavaScript on every desktop chapter page acceptable at launch, given the site's otherwise very light pages (LG3-2)? If yes, say so in "Launching" so the next audit does not re-open it.
2. Should Read View's retirement (8c) ship in the same change as the flip, or after? The checklist currently implies the same change; the guard tests make a half-way state fail CI.
3. Do you want a size cap on `src/scripts/desk/CLAUDE.md` and a rule that build narratives go to `STUDY-DESK-FIXES.md` (LG3-5)?

### What held up

- **Static imports** (MX section 6): all six are sanctioned or pure; no shared script reaches `src/scripts/desk/` (`closure.mjs`). The only dynamic imports of desk code from shared files are `desk-gate.js` (four, each behind the stamp) and `search-core.js:1232,1256` (behind `deskEnabled()`).
- **Writers**: `.docx`, `.odt`, `.rtf`, `.pptx`, `.odp` share one `xmlEscape` that strips characters XML 1.0 refuses and lone surrogates; `desk-zip.mjs` is hand-written but its round-trip is tested against an independent unzip; structural integrity passes (LG3-8). Failure paths in `sheet-page.js:464-473,494-497` tell the reader and leave the sheet unchanged. Object URLs are revoked.
- **Dependencies**: since `a57e155d` exactly one was added, `fake-indexeddb` as a devDependency (lockfile marks it `dev`). No zip, document or slide library entered production.
- **Listeners and observers**: `sheet-present.js` removes its four document/window listeners and closes its channel on `control.close()`; `tour-runner`, `continue-reading`, `sheet-save` and `sheet-slides` add and remove in pairs; `intro-pane.js` adds none outside itself. `initFootnotePills` adds window listeners and a `MutationObserver` that are never removed, but it runs once per page behind `dataset.deskFnPillsInit` and a module-level `started`, so it does not grow. The `BroadcastChannel`s in `store.js` and `bookmark-follow.js` are page-lifetime singletons.
- **Docs**: 38 of 40 sampled symbols and every sampled "held by test X" claim are accurate; `STUDY-DESK-FIXES.md` statuses for E28 to E57 match the code I spot-checked (E43 Full screen, E44/E47 "Start following", E50 pill, E51 close × and "Cancel" at `sheet-page.js:633-636`, E52 `3.5rem`, E53 `intro-pane.js`, E27's Duplicate button at `sheet-pane.js:458`). No entry marked fixed lacks its code, and none open has code.
- **CSS**: no `ch` units; three dark-mode blocks each with the explicit twin; the ten focus rules without `var(--focus-ring)` (MX section 4c) are either programmatic-focus landing points with `tabindex="-1"` (`.desk-panel`, `.desk-tour`, `.desk-home-card__title`) or draw the ring on a child (`::after`, grip), or are forced-colors overrides. None is a keyboard-reachable control without a ring.
- **Tests**: 3,026 pass in 5.8 seconds; I scanned 1,911 desk and Greek tests and found no test without an assertion and no self-comparison; the store, key, constants and writer tests test real behavior.

### Not reached

- Real PowerPoint, Word, Keynote and LibreOffice opening of the files (the test header says it was done by hand on 2026-11-06; I verified structure only).
- Startup timing of the desk on a real page (the sizes above are from `dist/`, not a trace).
- Cyclomatic complexity beyond line counts; `createGreekTab` and `createSheetText` I did not read for seams.
- The rest of `STUDY-DESK.md` (decisions outside the sampled entries) and whether the release-notes and `llms.txt` wording is ready for launch item 10.

## Appendix G: Live browser verification and walkthrough (`LV3`, Sonnet)

Auditor slice G. Browser pane, `dist/` served by Python static server on localhost:4598 (no `_headers`, so no CSP; anything that depends on headers is untested). Viewport emulated at 1400x900 for the margin pills and flyouts, 770px for the footnote "⋯" mode, and the pane's own 1122x630 for /desk. Notebook data was created in this browser's IndexedDB (a note on footnote a, a bookmark on John 3:1, two sheets). Nothing in the repo was touched. Read `read_console_messages` with onlyErrors after each area: **no console errors anywhere** (desk off and on, both tours, /notebook, /desk, /sheets, Present, six downloads).

### Summary

Three new problems found by walking the built site, none Critical or High: 0 Critical, 0 High, 3 Medium, 3 Low. One is a **REGRESSION of an Audit 2 fix marked fixed** (LV-3: sheets still list as "Sheet / Sheet" in My Notes). Of the claims I could test in a browser, every one that was testable was Confirmed except GK3-2, which is Partly (the node is replaced, focus is kept). Both tours run start to finish with no errors and leave nothing behind; the Trash delete/restore round trip, Hide my marks, Print flyout keyboard model, swap by dropping, Size, Reading, bookmarks on /desk, the Book Intro pane, Search pane, sheets, Present and all six file downloads work. Dark mode on the verse menu, Notebook panel, /desk, sheet editor and sheet page showed no unreadable text or invisible borders.

### Claims checked

| ID | Verdict | Evidence |
|----|---------|----------|
| NB3-1 (flyout toggles shut after hover) | **Confirmed**, desk OFF (`?desk=off`) | John 3:3 verse menu. Hovering the "More ways to copy" chevron set `aria-expanded="true"` with the menu visible; a real click on the same chevron then set it to `false` and hid the menu. Same on the "Share" row: first click after hover closed the flyout, a second click opened it. |
| NB3-2 ("Share image" removes "Share text…", focus to body) | **Confirmed**, desk OFF. Needed a stub: this pane has no `navigator.share`, so I defined `navigator.share`/`canShare` before opening the menu | Selected John 3:3–8, Share ▸ Share image. After about 1.5 s the Share row text was only "Too long for an image. Try fewer verses.", the original Share row was `hidden`, and `document.activeElement` was `BODY`. |
| NB3-3 (focus lost after first note via "⋯") | **Confirmed** | At 770px `ol.footnotes` was `data-desk-fn-pills="more"`. Keyboard: Enter on "Actions for footnote a", Tab, Tab to "Add a note on footnote a", Enter, typed, Ctrl+Enter. After 1.5 s `activeElement` was `BODY`; `li#fn-a` had `data-desk-fn-margin` and `.desk-fn-more` was `display: none`. |
| NB3-4 (help page lacks the desk) | Not browser-checked | Code-read claim only; I did not open `/notebook/help/`. |
| NB3-5 (no live region on My Notes count) | **Confirmed** | Typed "audit" in "Search my notebook": `.desk-mine__count` changed to "Showing 1 note (of 1 kept)." as a plain `<p>`; no `[aria-live]`/`[role=status]` region in the panel received it (the only live regions were the Greek announcer and print message). |
| NB3-6 (Escape clears the filter and folds the panel) | **Confirmed, and worse than reported** (see LV3-1) | Typed "zzz", pressed Escape: field value `""`, panel width 0 (folded), focus on the "Notebook" tab. Events on the field: only `change` and `search` fire on Escape, no `input`. |
| NB3-7 (`foldedByHide` re-expands a panel the reader minimized) | **Confirmed** | Panel open, `h` (folded, w=0), Notebook tab click (w=364), collapse button (w=0), `h` again: panel expanded (w=364). |
| NB3-8, NB3-9, NB3-10, NB3-11, NB3-12, NB3-13 | Not checked | Not reached in the time; none needed a verdict here (all Low). NB3-9 needs a narrow window and a first-ever mark. |
| DK3-1 (slide text overflows in PowerPoint) | **Untestable here** | Needs PowerPoint. |
| DK3-2 (Reading marks restored only by Layout rows) | **Confirmed** | Layout ▸ Reading (verse numbers, footnote letters, key terms, highlights off; `lit-desk-reading-off` set). Title menu ▸ Add pane ▸ Add column ▸ My Notes: two panes, all four still off, no message. Layout ▸ Two columns and Layout ▸ Reset: still off. See LV3-2 for a worse sequence. |
| DK3-3 (`?intro=` drops silently with no room) | Not checked | Only the Search pane path was seen: with three panes in a 1122px window, clicking "John — Introduction" announced "There’s no room for a Book Intro pane. Close a pane, or open the introduction on its page." |
| DK3-6 (code PNG fails silently in Firefox) | **Untestable here** | Chromium only. Downloads for all six types did start (below). |
| DK3-7, DK3-8 (menu arrows skip disabled items, duplicate pane region names) | Not checked | |
| GK3-1 (credits block styled as a pill) | **Confirmed** | Notebook ▸ Greek: `section.desk-greek__sources` computes `border: 0.8px solid rgba(29,35,28,.58)`, `border-radius: 999px`, `padding: 1px 8px`, `margin: 2px 0 4px`, 231 by 559 px, so the whole "Sources and licenses" list sits in one outlined rounded box. I could not select a word to see the separate "Show sources" button, so that button's own look is unchecked. |
| GK3-2 (builder word input replaced while typing) | **Partly** | `/search/?q=λόγος` ▸ Search commands. Captured `[data-key="w0"]`, typed one letter: the captured node `isConnected === false` and a new node is in the DOM (**replaced, confirmed**). But `document.activeElement` is the new `[data-key="w0"]` input, its value was `λόγοςx` and the search field matched, so **focus and caret are kept**. The screen-reader effect needs NVDA or Narrator and is untested. |
| GK3-6 (`constructor` gives a Greek offer) | **Confirmed** | `/search/?q=constructor` with the desk on shows: "“constructor” is also a Greek word (function Object() { [native code] }). Search the Greek". |
| SEC3-3 ("Save as ▸ Slides" under the participant version) | **Confirmed from the UI** | On `/sheets/?id=…` with Participant version chosen, the Save as menu is named "Save the participant version as" and its first line reads "Participant version" above both groups. The Slides group (PowerPoint, OpenDocument slides, PDF…) carries no line saying speaker notes hold the Leader only parts and answers. Files were saved (not opened); I did not inspect their notes. |

### Findings

#### LV3-1 · Medium · bug · NEW (extends NB3-6)

> **Fixed (Audit 3 session 2, 2026-11-07, branch `claude/audit3-session2-notebook`):** The My Notes box, the notebook page's box and the Search pane's field now hear `search` (and `change`) as well as `input`; with NB3-6's fix an Escape clears the field and the list together, and a stale filter can no longer show "Nothing matches" over a notebook that holds notes.

**Where** `src/scripts/desk/tab-mine.js:242` (`queryBox.addEventListener("input", …)`), `src/scripts/desk/panel.js:430-437` (Escape handler).

**What happens** In "Search my notebook", Escape clears the field the browser's way. Chrome fires `change` and `search` on that, not `input`, and the list listens to `input` only. So the field is empty but `query` is still the old text, and the panel then folds. Reopened, the field is blank and the list says "Nothing matches (of 1 kept)." with "Nothing matches. Clear the search or a filter to see more." under it, though the notebook holds one note. The reader sees an empty search box over an empty list. The same stale filter makes a real empty state worse: after deleting the only note it read "Nothing matches" instead of "Nothing kept yet."

**Evidence** Live. Typed "zzz", Escape, reopened: `input.value === ""`, `.desk-mine__count` "Nothing matches (of 1 kept).", the one note row hidden. A listener on the field logged `change`, `search`, no `input` after Escape. Ctrl+Z of a delete then showed the note again only because the filter was typed over.

**Fix** Also listen for `search` (and `change`) on the box, or let Escape in a search field clear and redraw, and have the panel's Escape return without folding when the target is a non-empty `input[type=search]` (NB3-6's fix).

**Confidence** High (Chromium in the Browser pane). Not run in Firefox or Safari, which differ on Escape in a search field.

#### LV3-2 · Medium · bug · NEW (extends DK3-2)

> **Fixed (Audit 3 session 3, 2026-11-07, branch `claude/audit3-session3-desk-sheets`):** choosing Reading adds what it turns off to what is remembered instead of replacing it (`turnOffMarks`), so a second press keeps the list; Undo puts back the list as it was.

**Where** `src/scripts/desk/reading-display.js:76-84`, `src/scripts/desk/desk-page.js` Layout window handler.

**What happens** Choosing Reading a second time while its marks are already off overwrites the remembered list with an empty one, so nothing is ever turned back on. Sequence: Layout ▸ Reading (all four off, `lit-desk-reading-off = ["vn","fn","terms","highlights"]`); add any pane; Layout ▸ Two columns; Layout ▸ Reading again. The second press turns off nothing new, and `lit-desk-reading-off` becomes `null`. Layout ▸ Reset or Two columns afterward leaves verse numbers, footnote letters, key terms and highlights off, with no memory of why. The only way back is Display options, one switch at a time. The undo bar even still says "Layout: Reading. Closed My Notes." with no mention of the marks.

**Evidence** Live; I logged `lit-desk-reading-off` and the four `data-vn`/`data-fn`/`data-terms`/`data-desk-highlights` attributes after each step: start none and null; Reading #1 all four off and the list of four; Add pane and Two columns unchanged; Reading #2 all four still off and `null`; Two columns afterward still off.

**Fix** When Reading finds a mark already off, keep it in the stored list only if it was in the list before (union, never replace), or leave the stored list alone when no mark changes.

**Confidence** High.

#### LV3-3 · Medium · bug · REGRESSION LV-3

> **Fixed (Audit 3 session 2, 2026-11-07, branch `claude/audit3-session2-notebook`):** Per BVJ's decision, `tab-mine.js` leaves sheets out (`withoutSheets` in `desk-notebook.mjs`, applied before anything is counted), so the My Notes pane and the Notebook's tab have no sheet rows and every count, "Show" choice, label choice and empty line agrees. The notebook page's "What I've kept" still lists sheets as "Other items" (its rows are right).

**Where** `src/scripts/desk/record-rows.js` (fallback row for a `sheet` record), shown by `tab-mine.js` (the My Notes pane and the Notebook's My Notes tab) as well as `kept-list.js`.

**What happens** Audit 2's LV-3 was marked "Fixed in FA2-i: a sheet's row shows its name, links to `/sheets/?id=`, and names it in Labels and Delete." On the built site it is not. After creating two sheets ("Untitled sheet" and "Untitled sheet (copy)"), the My Notes pane on /desk reads "1 note, 1 bookmark, 2 other items." and lists, under "Other items", two identical rows: `Sheet` / `Sheet` / `Labels…` / `Delete`. Their buttons are `aria-label="Labels for sheet"` and `aria-label="Delete sheet"`, with no title, no link, and nothing to tell the two apart. Sheets also count as "items" in a notebook of notes.

**Evidence** Live on /desk: row HTML is `<span class="desk-item__ref">Sheet</span><span class="desk-item__kind">Sheet</span>` plus the two buttons, exactly as Audit 2 recorded. The copy has title "Untitled sheet (copy)" in the editor, so the title exists on the record.

**Fix** Check why FA2-i's change does not reach this path (the My Notes pane and tab may use a different row builder than `/notebook/`). Then give the sheet row its title, a link to `/sheets/?id=`, and the title in the Labels and Delete names; or leave sheets out of My Notes entirely.

**Confidence** High.

#### LV3-4 · Low · a11y · NEW

> **Fixed (Audit 3 session 2, 2026-11-07, branch `claude/audit3-session2-notebook`):** Part (a) only: the tour runner takes a `returnFallback` (the Notebook tab when folded, the panel when open, else the page's heading) for when the element focused at the start is gone or hidden at the end. Part (b), Full screen, is session 3's.

**Where** the Notebook tour's last step and `desk-page.js` `fullscreen` refusal path.

> **Fixed (Audit 3 session 3, 2026-11-07, branch `claude/audit3-session3-desk-sheets`):** part (b): Full screen closes the title menu with focus on the title button before asking, so a refused request leaves focus there. Part (a), the Notebook tour, is session 2's.

**What happens** Two endings drop focus to `<body>`. (a) The notebook tour on a chapter page: after the last "Done" (and any "Skip the tour"), `document.activeElement` is `BODY`; the tour's own steps restore the page. (b) /desk ▸ title menu ▸ Full screen when the browser refuses (the Browser pane does, as the doc says): the menu closes and the announcement ("This browser didn’t allow full screen. Use the browser’s own command instead (F11).") plays, but focus is on `BODY` rather than the title button. The desk tour, by contrast, ends on the title button, and Layout ▸ Reading returned focus to it.

**Evidence** Live (`__f()` reading after each).

**Fix** Return focus to the title button after a refused Full screen, and to the Notebook tab (or the page's heading) when the notebook tour ends.

**Confidence** Medium (a refusal path is hard to meet in a real browser; the tour ending was reproduced after a run through all ten steps).

#### LV3-5 · Low · usability · NEW

> **Fixed (Audit 3 session 3, 2026-11-07, branch `claude/audit3-session3-desk-sheets`):** the list buttons put the selection back among the same characters after the command (`keepingSelection` in `sheet-text.js`, by text offset), so typing goes where the caret was. Not run in a browser.

**Where** `src/scripts/desk/sheet-text.js` (toolbar button handling for lists).

**What happens** In a sheet's "Your text" editor, the caret was at the end of "Intro line". Moving focus to the "Bulleted list" button and pressing Enter made the list (`<p><ul><li>Intro line</li></ul></p>`, the E55 shape), but typing afterward produced "item oneIntro line": the caret went to the start of the item, not where it had been.

**Evidence** Live; the `innerHTML` before and after. I put focus on the button with a script before pressing Enter, so a Tab from the editor may differ; I did not test a real Tab.

**Fix** Restore the saved selection after a list command exactly as it was; confirm with a real Tab then Enter.

**Confidence** Low.

#### LV3-6 · Low · ui · NEW

> **Fixed (Audit 3 session 3, 2026-11-07, branch `claude/audit3-session3-desk-sheets`):** the part header wraps: in a narrow Sheet pane its controls go to a second row, right-aligned, and no control's label breaks (`desk.css`, `.desk-sheet__module-head`). Not seen in a browser.

**Where** the passage part's header in the Sheet pane (`sheet-pane.js`, `desk.css`).

**What happens** In a Sheet pane about 350px wide (three panes in a 1122px window) the passage header's controls squeeze its label: "John 3:3–8", "Show in the LIT" broken over three lines, "Leader only", then ↑ ↓ ×. It stays usable but the checkbox and the reference look crushed beside the text.

**Evidence** Screenshot at 1122x630 with My Notes, The LIT and Sheet side by side.

**Fix** Let the header wrap its controls to a second row below a pane width, or shorten "Show in the LIT" to the icon with the text as its accessible name.

**Confidence** High on what shows; judged only at that one width.

### Audit 2 fixes re-checked (in the browser)

- **LV-3 (sheet row name)**: **not holding**, see LV3-3.
- **DK-2 (Search pane live region)**: holds. After "liberation" the single status region read "1 glossary match • 48 topic matches • 24 book intro matches • 2 article matches • 119 keyword matches".
- **NB-1 (Hide my marks)**: holds (folds on hide, unfolds on show), apart from NB3-7.
- **DK-1 (keyboard word choosing)**: holds. Focus on the passage words, ArrowRight twice, Shift+ArrowRight, Enter blanked “I’m telling” and announced "1 blank added."; a CSS highlight named `desk-sheet-cursor` showed the cursor.
- **DK-9 / RC-2 (Layout names what closed)**: holds; the undo bar read "Layout: Reading. Closed My Notes and Search. Turned off verse numbers, footnote letters, key terms, and highlights."
- **LV-1-style focus on Escape in the verse menu**: holds. Verse number focused, Enter opened "John 3:3 options", Escape returned focus to "Verse 3".

### Improvements

- The sheet pane's "Print or share…" and "Present…" links carry `rel="noopener"` only; they are same-site so this matches the rule, noted so nobody "fixes" it.
- The status regions on /desk keep stale sentences ("Layout: Reading. Closed My Notes…" stayed in the last `.sr-only` region long after); clear a region when its message has been spoken so a later reader of the DOM (or a screen-reader virtual cursor) does not meet old news.
- In the sheet page's Save as menu the two "PDF…" items have the same accessible name (`aria-label="PDF…"`), told apart only by their group headings and descriptions. Name them "PDF… (document)" and "PDF… (slides)".
- /desk's title menu after the desk tour holds a stale `Add column` kinds step in the hidden DOM, but the flyout is redrawn on open, so users do not see it. (A hidden stale button, once clicked from a script, announced "Added a null showing Search." from `desk-page.js:764`. Not reachable by a user, but `addStep` is read at click time and could be guarded.)
- Add pane from the title menu: the new pane does not take focus; the focus lands on the title button after a keyboard add, which is fine, but a screen-reader reader gets only the announcement.

### Questions for the owner

1. NB3-1: should a click after a hover move focus into the flyout (the CLAUDE.md text) or leave it closed? Confirmed live that today it closes it.
2. LV3-3: should sheets appear in My Notes at all? Audit 2 said to name them; seeing them listed under "Other items" in a pane of notes may itself be unwanted.
3. SEC3-3: the Slides group's notes under the participant version are the owner's call (Q1 of that report).

### What held up

- **Console**: zero errors from every area walked.
- **Flyouts (desk on)**: verse menu "Print ▸": → opens it and focus goes to "This verse"; ↓ moves to "This verse with my notes"; ← returns focus to the "Print" row with the menu closed; Enter reopens it; Escape steps back one level and a second Escape closes the panel with focus back on the verse number. Same for opening from the keyboard on the verse number.
- **Footnote Pin and Add a note**: in "row" mode (1000px and wider) pills sit in the left margin; at 770px the "⋯" opens a stack with Pin and "Add a note"; the stack does not overlap footnote text, only the next footnote's own "⋯".
- **Notebook tour**: 10 steps run (Marking the text 1 to 4, The Notebook 5 to 7, Finding and keeping 8 to 10), the offer window and the tour card stayed in the viewport, steps 2 and 4 opened the note editor and a footnote popover without saving, and nothing was left behind (one note, as before).
- **Desk tour**: 7 steps, each card in the viewport, ends on the title button, layout restored to the original.
- **Trash**: deleting a note on /notebook/ moved focus to "Nothing kept yet."; Restore by keyboard put the note back and focus went to the trash's "The trash is empty." line. Undo (Ctrl+Z) after a panel delete also restored it.
- **/desk**: Add pane from the pane menu by keyboard (Down to "Add pane", Right, "To the right", kinds list); Size ▸ "Make this pane wider" announced "The LIT is now 40 percent of the width here." and returned focus to the pane's kind button; swap by dropping The LIT onto Book Intro announced "The LIT swapped with Book Intro."; bookmark on /desk opened its form with focus in the name field and Escape returned to the verse number named "Verse 1, bookmarked"; Book Intro pane (John introduction) and Search pane (English; Greek not driven on /desk, only on /search) work.
- **Full screen**: refusal message reads correctly (the Browser pane never grants it, as documented), so success was not testable.
- **Sheets**: template "Bible study", ghost text in the Reading part ("Add the passage with + Passage, or from the LIT pane’s verse…"), adding "John 3:3-8", Duplicate ("Untitled sheet (copy)"), the key terms box present from the template, blanking by keyboard, a list in a paragraph, the sheet page's version and paper radios, Present (stage `role="dialog"`, everything behind `inert`, 9 screens, ArrowRight steps, Escape leaves with focus back on "Present").
- **Downloads** (anchor `download` and blob recorded, not opened): `Untitled sheet (participant).docx` (11,545 bytes), `.odt`, `.rtf`, then `Untitled sheet (slides).pptx` and `.odp`; the status line said "Saved Untitled sheet (participant).docx.". PDF… opens Print and was not run.
- **Dark mode** (emulated): verse menu, Notebook panel with the Greek tab, /desk with three panes, the sheet editor and the sheet page: all text legible, borders visible.

### Not reached

- The full Copy ▸ flyout via the keyboard on a selection panel (mouse selection) and the Share ▸ Share text… path with a real share sheet.
- Move left/right/up/down in the pane menu; dragging to an edge to split; "Make this my default"; a four-pane layout and its narrow-window fitting.
- The Greek search pane on /desk (Greek query), the "Show sources" button on a selected Greek word, the Greek tab's lexicon pane, and the search builder beyond GK3-2.
- Print and PDF… from either menu (they open Print), Present's presenter view window and its second-screen placement, Share dialog and the shared-sheet import.
- NB3-8 to NB3-13, DK3-3, DK3-7 and DK3-8; the help page text (NB3-4).
- Anything that depends on `_headers`/CSP (the server sends none).

## Appendix H: Copy rules (`CP3`, Haiku)

Checkout: `C:\Users\bcjoh\GitHub\litbible\.claude\worktrees\desk-audit-3` at commit 60af379e.
Scope: added `+` lines since a57e155d in the listed desk, notebook, sheets, panel and privacy files (13,436 added lines, of which about 1,100 carry string literals or prose), plus all of `src/pages/notebook/help.astro` and the tour text in `src/lib/desk-first-use.mjs`, `src/scripts/desk/desk-tour.js` and `tour-runner.js`. Code comments, console messages and CSS were excluded. Working files are in `scratchpad\a3\cp3\` (`added.txt`, `strings.tsv`, `s_main.tsv`).

### Summary

| Rule | Violations |
|------|-----------|
| 1. No em dash | 0 |
| 2. American spelling | 0 |
| 3. Curly quotes and apostrophes | 0 |
| 4. Punctuation inside closing quotes | 0 |
| 5. Oxford comma | 0 |
| 6. Retired names | 1 |
| 7. Delete versus Remove, Unpin | 0 |
| 8. Numbers from constants | 6 |

Owner wording, report only (not counted): 4 strings, listed after the table.

### Violations

> **Orchestrator:** not a defect. The heading names the reader's notes on those verses, which the desk's names keep lowercase (as This verse's subhead); "My Notes" is the tab and pane only.

#### Rule 6: retired names

| ID | File:line | Exact string | Corrected form | Note |
|----|-----------|--------------|----------------|------|
| CP3-1 | `src/lib/desk-print-part.mjs:76` (used at `src/scripts/desk/print-part.js:193`) | `export const SELECTION_NOTES_TITLE = "My notes";` (printed `<h2>` over the stray notes in a selection print) | `"My Notes"` | The heading names the reader's notes list. Not owner-quoted in STUDY-DESK-FIXES.md; the only "My notes" entries there are the E11 checkbox. |

#### Rule 8: numbers that should come from a constant

Each constant agrees with the number in the text today. The problem is that the copy is hard-coded, so it drifts if the limit changes.

| ID | File:line | Exact string | Corrected form | Note |
|----|-----------|--------------|----------------|------|
| CP3-2 | `src/lib/desk-bookmark-change.mjs:30` | `"Six of your bookmarks already move as you read. Turn that off on one of them first."` | Build the word from `MAX_FOLLOWING` (`src/lib/desk-bookmarks.mjs:42`, currently 6). | Agrees (6). Not owner-quoted. |
| CP3-3 | `src/scripts/desk/bookmark-form.js:160` | `"Six of your bookmarks already move as you read, so this one can’t follow until you turn that off on one of them."` | As CP3-2, from `MAX_FOLLOWING`. | Agrees (6). Not owner-quoted. The E48 blurb at `bookmark-form.js:77` is owner wording (below). |
| CP3-4 | `src/scripts/desk/desk-page.js:739`, `:745`, `:1313`, `:1347` | `"Four is the most"` (four copies; `:745` and `:1347` also compare against the literal) | Build from `MAX_PANES` (`src/lib/desk-layout.mjs:40`, currently 4) and compare against the constant, not the string. | Agrees (4). Not owner-quoted; STUDY-DESK-FIXES.md:670 describes the text rather than asking for it. **Fixed (Audit 3 session 3, 2026-11-07, branch `claude/audit3-session3-desk-sheets`):** `FULL_TEXT` in `desk-layout.mjs` builds “Four is the most” from `MAX_PANES`, and `desk-page.js` compares the reason (`"full"`), never the words. |
| CP3-5 | `src/lib/desk-first-use.mjs:458` | `Four panes fit when the window has room.` (tour step "Add pane") | Interpolate `MAX_PANES` as a spelled-out word. | Agrees (4). |
| CP3-6 | `src/pages/notebook/help.astro:125` and `:128` | `waits for 30 days.` and `After 30 days only a record that it was deleted remains,` | `{TRASH_DAYS}` days, importing `TRASH_DAYS` from `../../lib/desk-records.mjs`. | Agrees (`TRASH_DAYS = 30`, `src/lib/desk-records.mjs:200`). The page already imports `MAX_FOLLOWING` but not this. |
| CP3-7 | `src/scripts/desk/notebook-page.js:137` and `:148` | `What you delete waits here for 30 days.` and `instead of after 30 days.` | `${TRASH_DAYS}`, as CP3-6. | Agrees (30). |

> **Fixed (Audit 3 session 6, 2026-11-07, branch `claude/audit3-session6-cleanups`):** CP3-2, CP3-3, CP3-5 and CP3-7 now build their numbers from `MAX_FOLLOWING`, `MAX_PANES` and `TRASH_DAYS`, with `numberWord` (in `src/lib/desk-wording.mjs`) spelling the small counts. CP3-7 covers all four "30 days" in `notebook-page.js`, not only the two lines the table names. The E48 blurb is built the same way, its wording unchanged. CP3-4 and CP3-6 are left to their own sessions.

### Owner wording, report only

These match wording BVJ asked for or approved in STUDY-DESK-FIXES.md, so they are not counted as violations.

| File:line | Exact string | Rule it touches | Why it stands |
|-----------|--------------|-----------------|---------------|
| `src/scripts/desk/bookmark-form.js:77` | `Up to six of your bookmarks can move.` | 8 | E48, approved 2026-11-06. The spelled "six" is still hard-coded (see CP3-2 for the same fix). |
| `src/scripts/desk/notebook-search.js:124` | `My notes` (checkbox, Greek search) | 6 | E11 owner look. |
| `src/lib/desk-sheets.mjs:112` | `${title} (copy)` / `Untitled sheet (copy)` | 6 ("copies") | The "(copy)" wording is confirmed right (STUDY-DESK-FIXES.md:967-975). |
| `src/lib/desk-search.mjs:239` | `My notebook` (search group heading) | 6 | E32, BVJ 2026-11-05. |

### Checked and clean

- **Rule 1 (em dash):** the only em dash in the added lines is a code comment (`src/scripts/chapter-tools.js:15`). No entity or escape forms in reader text.
- **Rule 2 (spelling):** no `colour`, `favourite`, `behaviour`, `centre`, `grey`, `cancelled`, `organise`, `recognise`, `catalogue`, `dialogue`, `licence`, `towards`, `whilst`, `amongst` or "tick" in reader text. Hits are code comments only (for example `actions.js:103`, `tab-mine.js:248`, `glyphs.js:40`). "Grayed" (`desk-first-use.mjs:468`) and "license" are American.
- **Rule 3 (straight quotes and apostrophes):** none in reader strings. The straight `'` and `\"` hits are console.error messages (for example `desk/actions.js:273`) and code comments, which are out of scope.
- **Rule 4 (punctuation inside closing quotes):** no `”.`, `”,`, `’.` or `’,` in reader text. The only hit is a code comment (`greek-find.js:250`). The periods in `“Highlight.”`, `“Save.”`, `“Take the tour.”` and `“tour.”` are correctly inside.
- **Rule 5 (Oxford comma):** the lists checked include “Add a note,” “Add bookmark,” and “Highlight” (`help.astro:36`, `desk-first-use.mjs:150`), “hide,” “Greek,” and “tour” (`desk-first-use.mjs:248`), and “notes, highlights, bookmarks, and pinned footnotes” (`desk-first-use.mjs:417`). All have the serial comma.
- **Rule 6 (other retired names):** no "Study View", "Reading View", "Reading Mode", "Places", "ribbon", "copies" (as a reader-facing term), "What I’ve kept" or "Make an image". "Share text…" and "Share image" are correct (`chapter-tools.js:569`, `:621`). "notebook" in lowercase (for example `desk-export.mjs:783`) refers to the saved data, as desk/CLAUDE.md states, and "The notebook page" is a page name.
- **Rule 7 (Delete, Remove, Unpin):** `TAKE_OFF` in `src/lib/desk-store-core.mjs:447-452` gives bookmark and highlight "Remove", footnote pin "Unpin", and everything else "Delete". The help page follows this ("delete" a note, "remove" a bookmark or highlight). `pins.js:141` uses "Unpin" for pins.
- **Rule 8 (other numbers):** `help.astro:148` uses `{MAX_FOLLOWING}` correctly. "three kinds of file" (`help.astro:107`) matches the three export formats in `desk-export.mjs`. "three parts" (`help.astro:231`) matches `TOUR_PARTS` (3, `desk-first-use.mjs:113`) and "two parts" (`help.astro:240`) matches `DESK_TOUR_PARTS` (2, `desk-first-use.mjs:389`). "seven days" (Safari, `help.astro:88`) is a Safari fact, not an app limit.

### Out of scope (pre-existing, not in added lines)

These are not counted but are worth a later pass:
- `src/scripts/desk/tab-verse.js:117`: `<h4>My notes</h4>` (the verse's notes subhead, same rule-6 question as CP3-1).
- `src/scripts/desk/tour.js:66`, `src/lib/desk-first-use.mjs:176` and `:178`: "shows three lines". `NOTE_LINES = 3` (`src/lib/desk-notes.mjs:47`) agrees.
- `src/lib/desk-first-use.mjs:150`, `:151`: "My Notebook" row. Owner-decided name.

## Appendix I: Mechanical health data (Haiku)

Checkout: `C:\Users\bcjoh\GitHub\litbible\.claude\worktrees\desk-audit-3`, branch `claude/desk-audit-3`, commit `60af379e`.

Environment notes:
- The worktree has no `node_modules`. Node resolves packages by walking up parent directories, so every command used `C:\Users\bcjoh\GitHub\litbible\node_modules` (the main checkout's copy).
- `npm run build` wrote gitignored output to `dist/`, `public/api/`, `public/og/`, `public/search/`, `.astro/`. Those writes are allowed.
- **One tracked file changed.** `npm run build` ran `fetch:podcast`, which rewrote `src/data/podcast-feed.xml` (see section 2). `git status` now shows ` M src/data/podcast-feed.xml`. I did not revert it, since that would be a state-changing git command. Revert with `git checkout -- src/data/podcast-feed.xml` in this worktree.

---

### 1. Tests and type check

**`npm test`** (`node --test "test/**/*.js" "scripts/reconcile/test/**/*.mjs"`)
- Exit 0. Log: `scratchpad/a3/mx/test.log`.
- Tests 3026, passed 3026, failed 0, skipped 0, todo 0, cancelled 0. Suites 16.
- Node-reported duration 5797.4 ms (wall time 6.5 s).
- Failing tests: none.

**`npm run validate:chapters`**
- Exit 0. Output: `✓ All 260 chapter file(s) valid.`

**`npm run check`** (`astro check`), 491 files
- Exit 0. Log: `scratchpad/a3/mx/check.log`. Duration 17 s.
- Errors: 0. Astro's own summary line reads `0 errors, 0 warnings, 52 hints`.
- The 52 diagnostics are printed as `- warning ts(...)`, so the summary's "0 warnings" contradicts the printed lines. The counts above come from grepping the printed lines (52 warning, 0 error). Cleaned log: `scratchpad/a3/mx/check.clean.log`.
- Warnings in `test/` (9): `desk-layout.test.js:10` (LAYOUT_KEY unused), `desk-panes-shared.test.js:268`, `desk-sheet-doc.test.js:508`, `desk-sheet-lit.test.js:923`, `float-window.test.js:91`, `greek-core.test.js:523` (two), `scripture-refs.test.js:362` (two). All TS6133 "declared but its value is never read."
- Warnings in `src/` and `scripts/` (43) are deprecation or `async` hints (TS6385, TS6387, TS80006), plus TS2568 at `src/lib/desk-store-core.mjs:193` (`kinds`) and `src/lib/greek-search.mjs:251,255` (`glossHead`). Full text is in `check.clean.log`.

---

### 2. Build and links

**`npm run build`**
- Exit 0. Duration 49 s (Pagefind 28.2 s, `astro build` 5.5 s for 352 pages).
- The podcast fetch succeeded: `✅ Podcast feed snapshot updated: src/data/podcast-feed.xml`. The only change is the RedCircle generator line (`git diff --stat`: 1 insertion, 1 deletion). This is the tracked-file change noted above.
- Pagefind warning: `3 pages found without an <html> element` (for example `"/podcast/" has no <html> element`). Pagefind indexed 38 pages and 3053 words.
- Log: `scratchpad/a3/mx/build.log`.

**`npm run check:links`**
- Exit 0. `check-links: OK — scanned 354 pages, checked 41074 internal links, no broken targets or fragments.`
- No broken links.

**Bundle sizes** (`dist/_astro/`, the files that matched each pattern)
- `intro-pane*` and `panel-flyout*` matched no file. `tab-*` matched tab-greek, tab-mine and tab-verse. `desk*` also matched the desk-* chunks, so those are listed too.
- Gzip is `gzip -c FILE | wc -c`.

| File (dist/_astro) | Raw bytes | Gzip bytes (`gzip -c \| wc -c`) |
|---|---:|---:|
| `chapter-tools.f_hcXSAq.js` | 26,586 | 9,929 |
| `desk-doc-docx.BRqHJwiA.js` | 13,309 | 4,543 |
| `desk-doc-odt.1f3-GDoX.js` | 11,823 | 4,022 |
| `desk-doc-rtf.CXSxDYgq.js` | 5,465 | 2,436 |
| `desk-footnotes.CRmMKthN.js` | 8,430 | 3,565 |
| `desk-frame.PxH7Br8A.js` | 1,866 | 781 |
| `desk-page.BJFa8KDn.js` | 147,716 | 47,718 |
| `desk-search.neTHRznC.js` | 3,583 | 1,696 |
| `desk-sheet-doc.BNsEkVp9.js` | 7,937 | 3,149 |
| `desk-sheet-gather.DlznlWuo.js` | 2,495 | 1,146 |
| `desk-sheet-passages.DZn7SxRL.js` | 9,857 | 4,029 |
| `desk-slides-odp.B3l270J2.js` | 11,483 | 3,940 |
| `desk-slides-pptx.HiVECEzw.js` | 17,336 | 5,339 |
| `desk-slides.gtN9VDVA.js` | 5,906 | 2,572 |
| `desk-start.sPnUu8Jl.js` | 551 | 302 |
| `desk-zip.CcznNbEm.js` | 1,969 | 893 |
| `desk.DXWreUKM.js` | 152,482 | 31,568 |
| `panel-flyout.BEVvIN_B.js` | 2,188 | 939 |
| `panel-pieces.CchxsrYN.js` | 3,711 | 1,602 |
| `search-greek.BH05gjY5.js` | 19,611 | 7,745 |
| `sheet-lit.O4qJaEBl.js` | 33,524 | 12,316 |
| `sheet-page.Uh6lUJt4.js` | 81,991 | 27,467 |
| `sheet-slides.ESDeLoGN.js` | 8,398 | 3,302 |
| `sheets.CfLZZBn7.css` | 21,965 | 5,048 |
| `sheets.astro_astro_type_script_index_0_lang.6U3x2waU.js` | 1,419 | 752 |
| `shell.Dgv48En5.js` | 61,372 | 20,058 |
| `tab-greek.DYT_f1tZ.js` | 23,856 | 8,348 |
| `tab-mine.xKzaZ9S-.js` | 75,882 | 25,083 |
| `tab-verse.GOjUTj_E.js` | 10,532 | 3,803 |

CSS files over 10 KB (gzip):

| File | Raw bytes | Gzip bytes |
|---|---:|---:|
| `Layout.CG2g0eDc.css` | 82,875 | 14,129 |
| `apps.CXNraWCv.css` | 18,134 | 3,645 |
| `found-in-translation-podcast.Bv06KtAb.css` | 12,639 | 2,926 |
| `index.a8eQ8bPi.css` | 11,929 | 3,266 |
| `search.Pkwi087h.css` | 12,657 | 2,674 |
| `sheets.CfLZZBn7.css` | 21,965 | 5,048 |

---

### 3. Test coverage map

Files: `src/scripts/desk/*.js` and `src/lib/desk-*.mjs`, 139 files, 43,803 lines, sorted by line count.

Two measures are shown:
- **Tested (whole-name)** is the primary one. A test counts as mentioning a file when the basename appears as a whole token in a file under `test/` or `scripts/reconcile/test/`. A token is not preceded or followed by a letter, digit, `_` or `-`. This is the stricter measure.
- **Substring match** is the plain `grep -l` of the basename, as requested. It over-counts. For example, `src/scripts/desk/sheet-lit.js` matches only because `desk-sheet-lit` appears in the tests, and that name belongs to `src/lib/desk-sheet-lit.mjs`. Similarly, `search-pane.js` is covered by name only through `desk-search-pane`.

A "tested" result here means the name is mentioned by a test. It does not measure behavior covered.

Totals:
- **Whole-name:** 48 files with no test mention, 13,901 lines (of 139 files and 43,803 lines).
- **Substring:** 39 files with no test mention, 9,841 lines.

| File | Lines | Tested (whole-name) | Substring match | Test files (whole-name match) |
|---|---:|:---:|:---:|---|
| `src/scripts/desk/desk-page.js` | 1912 | yes | yes | `test/search-greek-lazy.test.js` |
| `src/scripts/desk/tab-greek.js` | 1292 | yes | yes | `test/desk-sheet-paste.test.js`, `test/greek-credits.test.js` |
| `src/scripts/desk/sheet-pane.js` | 1287 | yes | yes | `test/desk-sheet-copy.test.js` |
| `src/scripts/desk/search-pane.js` | 1220 | **no** | yes | (none) |
| `src/scripts/desk/sheet-lit.js` | 1101 | **no** | yes | (none) |
| `src/scripts/desk/sheet-text.js` | 1093 | **no** | no | (none) |
| `src/lib/desk-sheet-format.mjs` | 1070 | yes | yes | `test/desk-sheet-discussion.test.js`, `test/desk-sheet-gather.test.js`, `test/desk-sheet-paste.test.js`, `test/desk-sheet-templates.test.js`, `test/desk-sheets.test.js` |
| `src/lib/desk-layout.mjs` | 1002 | yes | yes | `test/desk-layout.test.js`, `test/desk-storage-keys.test.js` |
| `src/scripts/desk/tab-mine.js` | 922 | **no** | no | (none) |
| `src/lib/desk-export.mjs` | 852 | yes | yes | `test/desk-chapter-address.test.js`, `test/desk-export.test.js` |
| `src/scripts/desk/sheet-present.js` | 824 | **no** | no | (none) |
| `src/scripts/desk/panel.js` | 810 | yes | yes | `test/desk-commands-window.test.js`, `test/desk-commands.test.js`, `test/desk-first-use.test.js`, `test/desk-frame.test.js`, `test/desk-margin.test.js`, `test/desk-panes-shared.test.js`, `test/desk-prepaint.test.js`, `test/desk-print-part.test.js`, `test/greek-commands.test.js` |
| `src/scripts/desk/notes-margin.js` | 771 | **no** | no | (none) |
| `src/scripts/desk/sheet-page.js` | 730 | yes | yes | `test/desk-sheet-doc.test.js`, `test/desk-slides.test.js`, `test/search-greek-lazy.test.js` |
| `src/scripts/desk/lit-pane.js` | 648 | **no** | yes | (none) |
| `src/lib/desk-change.mjs` | 542 | yes | yes | `test/desk-change.test.js`, `test/desk-whats-new.test.js` |
| `src/scripts/desk/actions.js` | 528 | yes | yes | `test/desk-commands-window.test.js`, `test/desk-first-use.test.js`, `test/desk-print-part.test.js`, `test/fixtures/anchor-vectors.json`, `test/fixtures/api2-vectors.json` |
| `src/scripts/desk/bookmark-follow.js` | 519 | yes | yes | `test/bookmark-follow.test.js` |
| `src/scripts/desk/tab-verse.js` | 502 | **no** | no | (none) |
| `src/scripts/desk/change-notice.js` | 480 | **no** | no | (none) |
| `src/scripts/desk/store.js` | 480 | yes | yes | `test/alignment-words-core.test.js`, `test/apps-studio.test.js`, `test/bookmark-follow.test.js`, `test/desk-bookmark-change.test.js`, `test/desk-export.test.js`, `test/desk-footnotes.test.js`, `test/desk-highlights.test.js`, `test/desk-history.test.js`, `test/desk-labels.test.js`, `test/desk-merge.test.js`, `test/desk-panes-shared.test.js`, `test/desk-prepaint.test.js`, `test/desk-sheet-doc.test.js`, `test/desk-sheets.test.js`, `test/desk-store-core.test.js`, `test/desk-store.test.js`, `test/docx-zip.test.js`, `test/fixtures/anchor-vectors.json`, `test/fixtures/api2-vectors.json`, `test/greek-commands.test.js` |
| `src/lib/desk-first-use.mjs` | 471 | yes | yes | `test/desk-copy-constants.test.js`, `test/desk-first-use.test.js` |
| `src/lib/desk-store-core.mjs` | 463 | yes | yes | `test/desk-chapter-address.test.js`, `test/desk-export.test.js`, `test/desk-highlights.test.js`, `test/desk-history.test.js`, `test/desk-merge.test.js`, `test/desk-notebook.test.js`, `test/desk-sheets.test.js`, `test/desk-store-core.test.js`, `test/desk-store.test.js` |
| `src/lib/desk-sheet-lit.mjs` | 457 | yes | yes | `test/desk-sheet-lit.test.js` |
| `src/scripts/desk/search-sheet.js` | 451 | yes | yes | `test/search-greek-lazy.test.js` |
| `src/lib/desk-records.mjs` | 450 | yes | yes | `test/desk-bookmark-change.test.js`, `test/desk-bookmarks.test.js`, `test/desk-change.test.js`, `test/desk-copy-constants.test.js`, `test/desk-export.test.js`, `test/desk-footnotes.test.js`, `test/desk-highlights.test.js`, `test/desk-history.test.js`, `test/desk-labels.test.js`, `test/desk-merge.test.js`, `test/desk-notebook.test.js`, `test/desk-notes.test.js`, `test/desk-records.test.js`, `test/desk-sheet-check.test.js`, `test/desk-sheet-passages.test.js`, `test/desk-sheet-share.test.js`, `test/desk-sheet-templates.test.js`, `test/desk-sheets.test.js`, `test/desk-store-core.test.js`, `test/desk-store.test.js` |
| `src/scripts/desk/notebook-page.js` | 445 | yes | yes | `test/desk-commands.test.js`, `test/desk-copy-constants.test.js`, `test/desk-first-use.test.js`, `test/search-greek-lazy.test.js` |
| `src/lib/desk-slides.mjs` | 441 | yes | yes | `test/desk-slides.test.js` |
| `src/lib/desk-slides-pptx.mjs` | 439 | yes | yes | `test/desk-slides.test.js` |
| `src/scripts/desk/desk-panes.js` | 436 | **no** | no | (none) |
| `src/scripts/desk/note-settings.js` | 429 | **no** | no | (none) |
| `src/lib/desk-sheet-doc.mjs` | 424 | yes | yes | `test/desk-sheet-doc.test.js`, `test/desk-slides.test.js`, `test/fixtures/sheet-copy-golden.json`, `test/helpers/mini-dom.js`, `test/helpers/xml-check.js` |
| `src/scripts/desk/print-notes.js` | 419 | **no** | yes | (none) |
| `src/scripts/desk/greek-find.js` | 411 | yes | yes | `test/search-greek-lazy.test.js` |
| `src/scripts/desk/tour.js` | 405 | yes | yes | `test/desk-commands.test.js`, `test/desk-first-use.test.js`, `test/desk-frame.test.js` |
| `src/lib/desk-merge.mjs` | 386 | yes | yes | `test/desk-history.test.js`, `test/desk-merge.test.js`, `test/fixtures/merge-vectors.json` |
| `src/scripts/desk/sheet-copy.js` | 379 | yes | yes | `test/fixtures/sheet-copy-golden.json` |
| `src/scripts/desk/pins.js` | 378 | yes | yes | `test/alignment-gate.test.js`, `test/chapter-serialize.test.js`, `test/desk-layout.test.js`, `test/desk-margin.test.js`, `test/desk-notebook.test.js` |
| `src/lib/desk-present.mjs` | 376 | yes | yes | `test/desk-present.test.js` |
| `src/lib/desk-doc-docx.mjs` | 371 | yes | yes | `test/desk-sheet-doc.test.js` |
| `src/lib/desk-notebook.mjs` | 371 | yes | yes | `test/desk-notebook.test.js` |
| `src/scripts/desk/margin.js` | 371 | yes | yes | `test/apps-studio.test.js`, `test/desk-first-use.test.js`, `test/desk-footnote-pills.test.js`, `test/desk-frame.test.js`, `test/desk-margin.test.js`, `test/desk-notes.test.js`, `test/desk-prepaint.test.js`, `test/desk-sheet-copy.test.js`, `test/desk-sheet-paste.test.js`, `test/desk-sheets.test.js`, `test/fixtures/api2-vectors.json`, `test/fixtures/sheet-copy-golden.json`, `test/verse-image.test.js` |
| `src/scripts/desk/note-editor.js` | 368 | **no** | no | (none) |
| `src/lib/desk-margin.mjs` | 363 | yes | yes | `test/desk-margin.test.js`, `test/desk-prepaint.test.js` |
| `src/scripts/desk/sheet-slides.js` | 363 | yes | yes | `test/desk-slides.test.js` |
| `src/scripts/desk/first-use.js` | 361 | yes | yes | `test/desk-copy-constants.test.js` |
| `src/lib/desk-sheet-share.mjs` | 359 | yes | yes | `test/desk-sheet-share.test.js` |
| `src/scripts/desk/notebook-search.js` | 349 | yes | yes | `test/desk-commands-window.test.js`, `test/search-greek-lazy.test.js` |
| `src/lib/desk-anchor-dom.mjs` | 343 | yes | yes | `test/desk-anchor-dom.test.js`, `test/desk-prose-anchor.test.js`, `test/helpers/mini-dom.js` |
| `src/lib/desk-slides-odp.mjs` | 328 | yes | yes | `test/desk-slides.test.js` |
| `src/lib/desk-doc-odt.mjs` | 325 | yes | yes | `test/desk-sheet-doc.test.js` |
| `src/lib/desk-bookmarks.mjs` | 322 | yes | yes | `test/bookmark-follow.test.js`, `test/desk-bookmark-change.test.js`, `test/desk-bookmarks.test.js`, `test/desk-copy-constants.test.js` |
| `src/scripts/desk/footnote-notes.js` | 318 | **no** | no | (none) |
| `src/scripts/desk/widths.js` | 312 | yes | yes | `test/desk-first-use.test.js`, `test/desk-footnote-pills.test.js`, `test/desk-greek-split.test.js`, `test/desk-margin.test.js`, `test/desk-prepaint.test.js` |
| `src/lib/desk-footnotes.mjs` | 294 | yes | yes | `test/desk-footnotes.test.js` |
| `src/scripts/desk/desk-tour.js` | 290 | yes | yes | `test/desk-first-use.test.js` |
| `src/scripts/desk/export-import.js` | 286 | **no** | no | (none) |
| `src/scripts/desk/tour-runner.js` | 283 | **no** | no | (none) |
| `src/lib/desk-highlights.mjs` | 281 | yes | yes | `test/desk-announce.test.js`, `test/desk-highlights.test.js`, `test/desk-history.test.js` |
| `src/scripts/desk/kept-list.js` | 273 | **no** | no | (none) |
| `src/lib/desk-history.mjs` | 270 | yes | yes | `test/desk-history.test.js`, `test/desk-sheets.test.js` |
| `src/scripts/desk/bookmark-form.js` | 270 | **no** | no | (none) |
| `src/lib/desk-greek.mjs` | 268 | yes | yes | `test/desk-greek.test.js` |
| `src/lib/desk-sheets.mjs` | 250 | yes | yes | `test/desk-export.test.js`, `test/desk-sheet-discussion.test.js`, `test/desk-sheet-gather.test.js`, `test/desk-sheet-passages.test.js`, `test/desk-sheet-share.test.js`, `test/desk-sheet-templates.test.js`, `test/desk-sheets.test.js` |
| `src/lib/desk-print-notes.mjs` | 249 | yes | yes | `test/desk-print-notes.test.js` |
| `src/lib/desk-search.mjs` | 245 | yes | yes | `test/desk-search.test.js` |
| `src/scripts/desk/intro-pane.js` | 243 | **no** | no | (none) |
| `src/scripts/desk/history.js` | 238 | yes | yes | `test/bookmark-follow.test.js`, `test/desk-history.test.js`, `test/desk-labels.test.js`, `test/desk-merge.test.js`, `test/desk-prepaint.test.js`, `test/desk-sheets.test.js`, `test/desk-store.test.js`, `test/fixtures/api2-vectors.json` |
| `src/lib/desk-doc-rtf.mjs` | 231 | yes | yes | `test/desk-sheet-doc.test.js` |
| `src/scripts/desk/whats-new.js` | 224 | **no** | yes | (none) |
| `src/scripts/desk/record-rows.js` | 215 | yes | yes | `test/desk-panes-shared.test.js` |
| `src/scripts/desk/print-part.js` | 211 | **no** | yes | (none) |
| `src/scripts/desk/sheet-save.js` | 211 | yes | yes | `test/desk-sheet-doc.test.js`, `test/desk-slides.test.js` |
| `src/scripts/desk/sheet-word.js` | 211 | yes | yes | `test/desk-sheet-doc.test.js`, `test/fixtures/sheet-copy-golden.json` |
| `src/scripts/desk/undo-bar.js` | 204 | **no** | no | (none) |
| `src/lib/desk-notes.mjs` | 201 | yes | yes | `test/desk-notes.test.js` |
| `src/scripts/desk/note-sources.js` | 198 | **no** | no | (none) |
| `src/scripts/desk/page.js` | 198 | yes | yes | `test/alignment-audit-core.test.js`, `test/announcement-gate.test.js`, `test/api2.test.js`, `test/apps-studio.test.js`, `test/bookmark-follow.test.js`, `test/build-verse-index.test.js`, `test/chapter-html.test.js`, `test/chapter-nav.test.js`, `test/desk-anchor-dom.test.js`, `test/desk-announce.test.js`, `test/desk-bookmarks.test.js`, `test/desk-change.test.js`, `test/desk-chapter-address.test.js`, `test/desk-commands.test.js`, `test/desk-first-use.test.js`, `test/desk-footnotes.test.js`, `test/desk-frame.test.js`, `test/desk-greek.test.js`, `test/desk-highlights.test.js`, `test/desk-layout.test.js`, `test/desk-margin.test.js`, `test/desk-notebook.test.js`, `test/desk-panes-shared.test.js`, `test/desk-passage.test.js`, `test/desk-prepaint.test.js`, `test/desk-present.test.js`, `test/desk-print-notes.test.js`, `test/desk-prose-anchor.test.js`, `test/desk-search-pane.test.js`, `test/desk-search.test.js`, `test/desk-sheet-check.test.js`, `test/desk-sheet-copy.test.js`, `test/desk-sheet-doc.test.js`, `test/desk-sheet-paste.test.js`, `test/desk-sheets.test.js`, `test/desk-slides.test.js`, `test/desk-storage-keys.test.js`, `test/desk-store-core.test.js`, `test/desk-verse.test.js`, `test/desk-whats-new-view.test.js`, `test/ebible-refs.test.js`, `test/fixtures/api2-vectors.json`, `test/glossary-crossrefs.test.js`, `test/greek-core.test.js`, `test/greek-search.test.js`, `test/helpers/mini-dom.js`, `test/lit-credit.test.js`, `test/podcast-feed-core.test.js`, `test/read-view-retirement.test.js`, `test/release-feed.test.js`, `test/release-note-links.test.js`, `test/release-notes-view.test.js`, `test/search-core.test.js`, `test/search-greek-lazy.test.js`, `test/validate-chapters.test.js` |
| `src/lib/desk-sheet-check.mjs` | 192 | yes | yes | `test/desk-sheet-check.test.js` |
| `src/scripts/desk/trash-list.js` | 185 | yes | yes | `test/desk-copy-constants.test.js` |
| `src/lib/desk-sheet-copy.mjs` | 182 | yes | yes | `test/desk-chapter-address.test.js`, `test/desk-sheet-copy.test.js` |
| `src/scripts/desk/shell.js` | 182 | yes | yes | `test/alignment-words-core.test.js`, `test/bookmark-follow.test.js`, `test/desk-frame.test.js`, `test/desk-history.test.js`, `test/desk-store-core.test.js`, `test/desk-store.test.js`, `test/go-deeper.test.js`, `test/podcast-feed-core.test.js`, `test/search-greek-lazy.test.js` |
| `src/lib/desk-commands.mjs` | 180 | yes | yes | `test/desk-commands.test.js` |
| `src/scripts/desk/footnote-pills.js` | 177 | **no** | yes | (none) |
| `src/lib/desk-sheet-gather.mjs` | 174 | yes | yes | `test/desk-sheet-gather.test.js` |
| `src/scripts/desk/highlights.js` | 167 | yes | yes | `test/desk-chains.test.js`, `test/desk-first-use.test.js`, `test/desk-highlights.test.js`, `test/desk-history.test.js`, `test/desk-notebook.test.js`, `test/desk-verse.test.js`, `scripts/reconcile/test/review-core.test.mjs` |
| `src/lib/desk-labels.mjs` | 164 | yes | yes | `test/desk-labels.test.js` |
| `src/lib/desk-bookmark-change.mjs` | 163 | yes | yes | `test/desk-bookmark-change.test.js` |
| `src/lib/desk-sheet-passages.mjs` | 163 | yes | yes | `test/desk-sheet-check.test.js`, `test/desk-sheet-gather.test.js`, `test/desk-sheet-passages.test.js` |
| `src/scripts/desk/footnotes-view.js` | 162 | **no** | no | (none) |
| `src/scripts/desk/print-menu.js` | 162 | **no** | no | (none) |
| `src/scripts/desk/prose-actions.js` | 161 | **no** | no | (none) |
| `src/scripts/desk/commands-window.js` | 158 | yes | yes | `test/desk-commands-window.test.js` |
| `src/scripts/desk/chapter-page.js` | 157 | yes | yes | `test/desk-chapter-address.test.js` |
| `src/scripts/desk/labels-ui.js` | 156 | **no** | no | (none) |
| `src/lib/desk-search-pane.mjs` | 153 | yes | yes | `test/desk-search-pane.test.js` |
| `src/lib/desk-sheet-discussion.mjs` | 150 | yes | yes | `test/desk-sheet-discussion.test.js` |
| `src/lib/desk-passage.mjs` | 149 | yes | yes | `test/desk-chapter-address.test.js`, `test/desk-passage.test.js` |
| `src/lib/desk-verse.mjs` | 149 | yes | yes | `test/desk-verse.test.js` |
| `src/lib/desk-chains.mjs` | 142 | yes | yes | `test/desk-chains.test.js`, `test/desk-hostile-records.test.js` |
| `src/lib/desk-whats-new.mjs` | 139 | yes | yes | `test/desk-whats-new-view.test.js`, `test/desk-whats-new.test.js` |
| `src/lib/desk-wording.mjs` | 133 | yes | yes | `test/desk-change.test.js`, `test/desk-wording.test.js` |
| `src/lib/desk-zip.mjs` | 133 | yes | yes | `test/desk-sheet-doc.test.js` |
| `src/scripts/desk/read-marks.js` | 128 | **no** | no | (none) |
| `src/lib/desk-sheet-templates.mjs` | 127 | yes | yes | `test/desk-sheet-passages.test.js`, `test/desk-sheet-templates.test.js` |
| `src/scripts/desk/verse-labels.js` | 127 | **no** | no | (none) |
| `src/lib/desk-whats-new-view.mjs` | 118 | yes | yes | `test/desk-whats-new-view.test.js` |
| `src/scripts/desk/lit-records.js` | 110 | yes | yes | `test/desk-panes-shared.test.js` |
| `src/scripts/desk/passage-bar.js` | 110 | **no** | no | (none) |
| `src/scripts/desk/float-resize.js` | 106 | **no** | no | (none) |
| `src/scripts/desk/continue-reading.js` | 102 | **no** | no | (none) |
| `src/lib/desk-prose-anchor.mjs` | 101 | yes | yes | `test/desk-change.test.js`, `test/desk-prose-anchor.test.js` |
| `src/scripts/desk/bookmark-stop.js` | 98 | **no** | no | (none) |
| `src/lib/desk-lit-text.mjs` | 95 | yes | yes | `test/desk-anchor-dom.test.js`, `test/desk-lit-line.test.js` |
| `src/lib/desk-print-part.mjs` | 85 | yes | yes | `test/desk-print-part.test.js` |
| `src/scripts/desk/reading-display.js` | 85 | **no** | no | (none) |
| `src/scripts/desk/print-look.js` | 72 | yes | yes | `test/desk-print-look.test.js` |
| `src/scripts/desk/greek-data.js` | 71 | **no** | no | (none) |
| `src/scripts/desk/print-link.js` | 71 | **no** | no | (none) |
| `src/scripts/desk/readonly-notebook.js` | 69 | **no** | no | (none) |
| `src/scripts/desk/glossary-titles.js` | 62 | **no** | no | (none) |
| `src/scripts/desk/release-feed.js` | 59 | yes | yes | `test/release-feed.test.js` |
| `src/lib/desk-corpus.mjs` | 56 | yes | yes | `test/desk-corpus.test.js` |
| `src/scripts/desk/focus-keep.js` | 54 | **no** | no | (none) |
| `src/lib/desk-footnote-pills.mjs` | 50 | yes | yes | `test/desk-footnote-pills.test.js` |
| `src/lib/desk-start.mjs` | 45 | yes | yes | `test/desk-prepaint.test.js`, `test/desk-start.test.js` |
| `src/scripts/desk/commands.js` | 43 | yes | yes | `test/desk-commands-window.test.js`, `test/desk-commands.test.js`, `test/desk-first-use.test.js`, `test/desk-frame.test.js`, `test/greek-builder.test.js`, `test/greek-commands-ui.test.js`, `test/greek-commands.test.js`, `test/greek-query.test.js`, `test/search-greek-auto.test.js` |
| `src/scripts/desk/glyphs.js` | 43 | yes | yes | `test/desk-glyphs.test.js`, `test/desk-hostile-records.test.js` |
| `src/scripts/desk/move-redraw.js` | 43 | **no** | no | (none) |
| `src/lib/desk-greek-split.mjs` | 42 | yes | yes | `test/desk-greek-split.test.js` |
| `src/scripts/desk/note-words.js` | 39 | **no** | no | (none) |
| `src/scripts/desk/greek-link.js` | 38 | **no** | no | (none) |
| `src/scripts/desk/diff-view.js` | 36 | **no** | no | (none) |
| `src/scripts/desk/print-room.js` | 33 | **no** | no | (none) |
| `src/scripts/desk/boot.js` | 32 | **no** | yes | (none) |
| `src/scripts/desk/bookmark-mark.js` | 28 | **no** | no | (none) |
| `src/scripts/desk/dom.js` | 28 | **no** | yes | (none) |
| `src/lib/desk-greek-notes.mjs` | 26 | yes | yes | `test/desk-greek-notes.test.js`, `test/desk-storage-keys.test.js` |
| `src/lib/desk-announce.mjs` | 25 | yes | yes | `test/desk-announce.test.js` |

---

### 4. CSS in `src/styles/desk.css` (and `global.css` for `.lit-flyout`)

**a. Dark-mode blocks.** There are three `@media (prefers-color-scheme: dark)` blocks. Each uses `:root:not([data-theme="light"])` and has a matching `:root[data-theme="dark"]` rule. The declarations match in each pair, so no block lacks either.

| Media block | Selector | Explicit override | Declarations |
|---|---|---|---|
| line 1279 | `:root:not([data-theme="light"])` (1280) | `:root[data-theme="dark"]` (1288) | 4 `--desk-hl-*` tints, same values |
| line 6149 | `:root:not([data-theme="light"])` (6150) | `:root[data-theme="dark"]` (6159) | 5 `--desk-rich-*` colors, same values |
| line 7216 | `:root:not([data-theme="light"])` (7217) | `:root[data-theme="dark"]` (7222) | 1 `--desk-sheet-warn`, same value |

**b. `ch` units.** `desk.css` has none. The regex `[0-9.]+ch\b` matched zero lines, checked with both grep and a Python pass over comment-stripped CSS.

**c. Outline on `:focus` or `:focus-visible` that does not use `var(--focus-ring`.** There are 54 rules with an outline on a focus selector. 44 use `var(--focus-ring)`. These 10 do not:

| Line | Selector | Outline value | Note |
|---|---|---|---|
| 113 | `.desk-panel:focus, .desk-panel__body:focus` | `outline: none` | no ring on that rule |
| 1137 | `:is(.desk-note__hit, .desk-verse__go, .desk-item__go):focus-visible` | `outline: none` | ring drawn by `::after` at 1141, which uses `var(--focus-ring)` |
| 1710 | `.desk-gutter:focus-visible` | `outline: 2px solid transparent` | ring on child `.desk-gutter__grip` at 1753 |
| 1807 | `.desk-panel__edge:focus-visible` | `outline: 2px solid transparent` | ring on child grip at 1846 |
| 2777 | `.desk-home-card__title:focus` | `outline: none` | no ring on that rule |
| 3054 | `.desk-tour:focus` | `outline: none` | no ring on that rule |
| 4104 | `.desk-greek__app-item:focus` | `outline: none` | `:focus-visible` at 4108 sets the ring |
| 4178 | `.desk-greek__split:focus-visible` | `outline: 2px solid transparent` | ring on grip at 4217 |
| 6713 | `.desk-seg__input:checked:focus-visible + .desk-seg__text` | `outline-color: HighlightText` | forced-colors block opened at 6687; width and style inherit from 605 |
| 6732 | `.desk-greek__w.is-selected:focus-visible` | `outline-color: HighlightText` | same forced-colors block; base ring from the `:focus-visible` rule near 3941 |

`global.css` `.lit-flyout` focus rule (lines 3214 to 3218): `outline: 2px solid var(--focus-ring)` with `outline-offset: -2px`. No `outline: none` on `.lit-flyout` in `global.css`.

**d. `@media (forced-colors: active)` blocks in `desk.css`:** 7 blocks, at lines 1487, 2022, 2178, 2435, 3341, 6668, 6687. (Line 1708 is a comment that mentions the mode, not a block.)

---

### 5. Dead CSS in `src/styles/desk.css`

The class regex `\.([a-zA-Z][\w-]*)` found 714 unique selectors after comments are removed (723 counting comments). Each was searched as a plain substring across all files under `src/` except `desk.css`.

**Found nowhere in `src/` (11):**

| Class | Where in desk.css | Verdict |
|---|---|---|
| `desk-np--pane` | 5756, with descendant rules at 5760 and 5765 | **Dead.** No `np--` string exists anywhere in `src/`. |
| `desk-bookmark-glyph--moves` | rule in desk.css | Live. `src/scripts/desk/bookmark-follow.js:172` builds `desk-bookmark-glyph--${bookmarkLook(bookmark)}`, and `bookmarkLook` returns `resting`, `moves` or `stays` (bookmark-follow.js:152 to 155). |
| `desk-bookmark-glyph--resting` | rule in desk.css | Live, as above. |
| `desk-bookmark-glyph--stays` | rule in desk.css | Live, as above. |
| `desk-print-mark--yellow` | rule in desk.css | Live. `src/scripts/desk/print-notes.js:140` builds `desk-print-mark--${p.color}` only when the color is in `COLORS`, which is `["yellow", "green", "blue", "pink"]` (`src/lib/desk-records.mjs:52`). |
| `desk-print-mark--green` | rule in desk.css | Live, as above. |
| `desk-print-mark--blue` | rule in desk.css | Live, as above. |
| `desk-print-mark--pink` | rule in desk.css | Live, as above. |
| `desk-sheet__module--question` | rule in desk.css | Live. `src/scripts/desk/sheet-pane.js:810` builds `desk-sheet__module--${known ? m.type : "unknown"}`, and `"question"` is in `MODULE_TYPES` (`src/lib/desk-sheet-format.mjs:41`). |
| `desk-split--columns` | rule in desk.css | Live. `src/scripts/desk/desk-page.js:1059` builds `desk-split desk-split--${node.split}`, and `split` is `"columns"` or `"rows"` (`src/lib/desk-layout.mjs:86` and 87). |
| `desk-split--rows` | rule in desk.css | Live, as above. |

The only class with no construction path found is `desk-np--pane`. The other ten are built by template strings. The hits for `desk-print-mark` at `src/scripts/desk/CLAUDE.md:1537` are documentation, not code. The prefix check was done on the name up to its last `--`, `__` or `-`.

---

### 6. Gate: static imports of desk modules from outside the desk area

These are static `import` statements (dynamic `import(` calls are not listed) from a path containing `/desk/` or `desk-`, in `src/scripts/*.js`, `src/layouts/`, `src/components/`, and `src/pages/` (excluding desk.astro, notebook*, sheets.astro):

| File:line | Line |
|---|---|
| `src/components/SiteHeader.astro:402` | `import "../scripts/desk-gate.js";` (side-effect import, inside a script block) |
| `src/layouts/Layout.astro:11` | `import { EDGE, FIRST_PAINT, GAP, MAX_MEASURE, MIN_MEASURE, MIN_WIDTH } from "../lib/desk-margin.mjs";` |
| `src/scripts/greek-commands.js:34` | `import { dockWidth } from "./desk-frame.js";` |
| `src/scripts/lit-panel.js:15` | `import { inDock, panelRoom, shiftClearOfDock } from "./desk-frame.js";` |
| `src/scripts/panel-pieces.js:16` | `import { panelRoom } from "./desk-frame.js";` |
| `src/scripts/desk-gate.js:10` | `import { readingSurface, standDown } from "./desk-frame.js";` (the gate itself; its `import("./desk/...")` calls at 45, 52, 58 and 64 are dynamic) |

Checked one level further: `src/scripts/desk-frame.js` and `src/lib/desk-margin.mjs` have no static imports, so these static edges reach no desk code past those two files. `src/scripts/search-core.js` uses dynamic imports of desk files only (lines 1232 and 1256).

---

### 7. External-link attributes in desk code and pages

Scope: `src/scripts/desk/`, `src/pages/desk.astro`, `src/pages/notebook.astro`, `src/pages/notebook/`, `src/pages/sheets.astro`. The pages have no `_blank` occurrences. All 24 hits are in `src/scripts/desk/`.

| File:line (target) | `rel` line | noopener + noreferrer | Notes |
|---|---|---|---|
| `desk-page.js:697` | 698 | yes | |
| `greek-find.js:88` | 89 | yes | |
| `intro-pane.js:99` | 100 | yes | |
| `intro-pane.js:138` | 139 | yes | |
| `lit-pane.js:99` | 100 | yes | |
| `lit-pane.js:259` | 260 | yes | |
| `print-menu.js:90` | 91 | **noopener only** | `href` is set at 144 from a computed value; not traced |
| `search-pane.js:130` | 131 | yes | |
| `sheet-lit.js:895` | 896 | **noopener only** | `href` is `${BASE}glossary/#…` (same site) |
| `sheet-lit.js:1020` | 1021 | **noopener only** | `href` is `${BASE}read/#license-terms` (same site) |
| `sheet-lit.js:1090` | 1091 | **noopener only** | `href` is `${BASE}contact/` (same site) |
| `sheet-pane.js:634` | 635 | **noopener only** | `href` is `${BASE}sheets/?id=…` (same site) |
| `sheet-pane.js:641` | 642 | **noopener only** | `href` is `${BASE}sheets/?id=…&view=present` (same site) |
| `sheet-slides.js:209` | 208 (rel is one line above target) | yes | set with `setAttribute` |
| `tab-greek.js:524` | 525 | yes | |
| `tour-runner.js:188` | 189 | yes | |

The `target` lines are `a.target = "_blank"` or `openPage.target` or `item.target`, and `setAttribute("target", "_blank")` at sheet-slides.js:209. Six `rel="noopener"`-only cases remain. Each is a same-site link opened in a new tab. The site rule in `CLAUDE.md` is worded for links that leave the site, so these are noted as a fact, not as a violation.

---

### 8. Size of the docs

| File | Lines | Bytes |
|---|---:|---:|
| `CLAUDE.md` (root) | 529 | 39,520 |
| `src/scripts/desk/CLAUDE.md` | 1,811 | 135,928 |
| `STUDY-DESK.md` | 7,868 | 513,448 |
| `STUDY-DESK-FIXES.md` | 1,971 | 139,124 |
| `STUDY-DESK-FORMAT.md` | 940 | 55,756 |

Root limit: `ROOT_LIMIT = 40 * 1024` (40,960 bytes) at `test/claude-docs.test.js:18`. The root file is 1,440 bytes under the limit.

---

### 9. Churn since 2026-11-03

Command: `git log --since=2026-11-03 --format= --name-only -- src/scripts/desk src/lib src/styles/desk.css | sort | uniq -c | sort -rn | head -25`. Those paths had 40 commits in this window.

```
     31 src/scripts/desk/CLAUDE.md
     17 src/styles/desk.css
      9 src/scripts/desk/desk-page.js
      8 src/scripts/desk/search-pane.js
      7 src/scripts/desk/sheet-page.js
      7 src/scripts/desk/panel.js
      6 src/scripts/desk/sheet-word.js
      6 src/scripts/desk/notebook-page.js
      6 src/scripts/desk/actions.js
      5 src/scripts/desk/tab-mine.js
      5 src/scripts/desk/sheet-pane.js
      5 src/scripts/desk/bookmark-follow.js
      4 src/scripts/desk/trash-list.js
      4 src/scripts/desk/sheet-present.js
      4 src/scripts/desk/lit-pane.js
      4 src/scripts/desk/kept-list.js
      4 src/scripts/desk/footnote-notes.js
      4 src/scripts/desk/desk-panes.js
      4 src/scripts/desk/bookmark-form.js
      4 src/lib/desk-store-core.mjs
      4 src/lib/desk-sheet-doc.mjs
      4 src/lib/desk-first-use.mjs
      4 src/lib/CLAUDE.md
      3 src/scripts/desk/undo-bar.js
      3 src/scripts/desk/tab-greek.js
```

## Appendix J: Adversarial verification of the highest findings (Opus)

Checkout `desk-audit-3` at `60af379e`. Every finding was re-read at the cited
lines and re-run with my own scripts against the real modules, in
`C:\Users\bcjoh\AppData\Local\Temp\claude\C--Users-bcjoh-GitHub-litbible\72b2d486-f2e1-40d1-ac50-64deb3f7a063\scratchpad\a3\verify\`
(`v-di1.mjs`, `v-di2.mjs`, `v-di2b.mjs`, `v-di3.mjs`, `v-di45.mjs`, `v-sec1.mjs`, `v-dk1.mjs`).
I read the auditors' scripts first. They test what they claim, with one gap noted under DI3-2.

| ID | Verdict | Severity (auditor's → mine) |
|---|---|---|
| DI3-1 | Confirmed with correction (a third case) | High → **Medium** (High once sync ships) |
| DI3-2 | Confirmed with correction (fix (b) misses the headline case) | Medium → **Medium** |
| DI3-3 | Confirmed | Medium → **Low** (Medium at sync) |
| DI3-4 | Confirmed (narrow trigger) | Medium → **Low** |
| DI3-5 | Confirmed | Medium → **Low** |
| SEC3-1 | Confirmed with correction (`?sheet=` adds nothing) | Medium → **Low** |
| SEC3-3 | Confirmed with correction (the slides' content is deliberate; only the menu's line misleads) | Low → **Low** |
| DK3-1 | Confirmed in the XML; PowerPoint's behavior is likely but unconfirmed | Medium → **Low** |

---

### DI3-1: a delete or a restore on the slower clock is undone by merge

**Verdict**: Confirmed with correction. **Severity**: Medium today. No sync exists yet, the desk has one user, and nothing is lost for good: an undone restore leaves the note in the Trash, and an undone deletion brings the note back. It becomes High when phase 4's sync makes two devices the ordinary case.

**What I ran** (`v-di1.mjs`, with the phone's clock 2 minutes fast, inside `CLOCK_TOLERANCE_MS`):
- A. The phone edits at 12:02 (phone clock). The desktop merges that edit, then deletes at 12:00:40 (desktop clock). `trashRecord` stamps `deletedAt` 12:00:40 while the held copy's `modified` is 12:02. Merging in either direction leaves `note:N:phone` live, so the deletion is undone. Control A0, with no skew: `trash(N)`, so the deletion stands.
- B. The phone deletes at 12:02. The desktop restores at 12:00:40. `restoreFromTrash` stamps `laterThan(record.modified, now)` = 12:00:40, which is earlier than `deletedAt`, so the merge keeps `trash(N)` and the restore is undone.
- **C (new, not in the report)**: the desktop edits over the phone's fast version (`editRecord` correctly stamps 12:02:00.001), then presses Ctrl+Z at 12:00:50. `inversePlan` → `restamped` stamps the put-back record plain `now` (12:00:50), which is earlier than the edit it undoes. Merging with any copy that holds the edit keeps `note:N:desk`, so **the undo of an ordinary edit is lost too**.

**Corrections**: `restamped` (`src/lib/desk-history.mjs:132-138`) needs `laterThan` for *every* record it puts back, not only for deletions and restores. The entry's `after` holds the record it replaces, so the stamp is `laterThan(after.modified, now)`, and for a trash record also past the live record's `modified`. The fix's other parts stand: `trashRecord` stamps `deletedAt = modified = laterThan(record.modified, now)`, and `restoreFromTrash` stamps past `max(record.modified, trash.deletedAt)`.

**Format question**: the website fix needs no agreement from BDR. The merge rules (a, b, c) and the merge vectors don't change, only the times this client writes. The format already states the principle that these paths break: "whatever their undo writes must outrank, by rules a and b, the change it takes back" (`STUDY-DESK-FORMAT.md:249-251`), and the "Room for skew" bullet (`:784-790`) gives the step for edits only. The format text should extend that bullet to deletions, restores and undos, as a note for BDR, since the apps' own stamps need the same step. That is a format *text* addition. It doesn't break compatibility, so it doesn't block the website fix.

### DI3-2: a mark moves to another verse silently on real revisions

**Verdict**: Confirmed with correction. **Severity**: Medium. A mark is silently drawn on the wrong verse, in the spec that both apps copy. The rate is low, and 11 of the 15 cases come from one commit.

**What I ran**: `v-di2.mjs` builds before and after anchor text from `git show` with the real `chapterAnchorText`, makes anchors with `makeAnchor`, and resolves them with `resolveAnchor`.
- Matthew 23 at `ff34f594`: "watch out, fakers," in verses 13, 23, 25, 27 and 29 each resolves `moved` into verse 15. Each of those verses still exists, now reading "Things won’t end well for you pretenders…". Verse 16's "watch out" (suffix ", blind guid…") correctly falls to `verse`.
- Luke 13:2 "more" → verse 4 (`26e379a1`), and 2 Corinthians 3:18 "One" → verse 17 (`7d478b2d`), both `moved`, reproduced.

**The 15-of-18 count**: it is the script's `wrongBy.moved` 15 against `byStatus.moved` 18, out of 9,444 sampled marks. The script doesn't test "landed in another verse while the reader's verse still exists". The report infers that from the example list, which is capped at 40 entries and shows 13 of the 15 (11 Matthew 23, 1 Luke, 1 2 Corinthians). The 13 visible ones all fit, and the other 2 weren't printed. So the count is right, and the claim is verified for 13 of the 15. Since 11 of them are one revision, it is really three revision events.

**Correction to the Fix**: option (b) ("each side must agree on `min(8, stored length)`") **would not fix the headline example**. `v-di2b.mjs` measured the context agreement at the landing site: for Matthew 23:27 the prefix agrees on 16 of 32 characters and the suffix on 32 of 32, because verse 15 kept the old formula word for word. Only Luke (prefix 5) and 2 Corinthians (prefix 5) would be stopped. Option (b) would have to require nearly the full stored context (24 or more of 32 on the prefix side here), which risks refusing legitimate moves. **Option (a), a notice on a cross-verse `moved`, is the one that covers all the cases.**

**Format question**: both options change the anchor spec (`STUDY-DESK-FORMAT.md:691-695` says "`moved` still carries no notice") and the anchor vectors, so either one **needs BDR's agreement**. It is Audit 2's open question 1 (`STUDY-DESK-AUDIT-2.md:832`), and BDR hasn't confirmed spec 3 yet, so it can go with that confirmation.

### DI3-3: the bookmark follower overwrites concurrent edits from another device

**Verdict**: Confirmed. **Severity**: Low today, because it needs two browsers exchanging files. Medium once sync ships. It is whole-record last-writer-wins (rule a, accepted in the format) amplified by a writer that runs every 2 seconds, so the decision is a design call for BVJ and BDR, not a defect in the code.

**What I ran** (`v-di3.mjs`): the phone sets `follow:false` and a new label at 12:00:00. The desktop does exactly what `flush` does (`editRecord(record, followMoveChanges(record, pos))`) at 12:00:02. `mergeSets` gives `{label:"Advent", follow:true, verse:14}`, so the phone's edit is lost. Control: a phone edit stamped after the desktop's last move wins, but the follower's next flush, reading its own unsynced copy, would beat it again. `flush` stops only when its *local* record says not following (`bookmark-follow.js:383-390`), so turning following off elsewhere has no effect until a merge lands between two flushes. The report's Where and Fix stand.

### DI3-4: a trash record whose held copy fails validation is dropped on import

**Verdict**: Confirmed. **Severity**: Low. For the website to hold the live record while the deleting device's held copy is invalid, that device must have edited it into something the website refuses before deleting it (a body over 64 KB, a marker the website doesn't know), or the website must have tightened a rule since. That is possible, but narrow.

**What I ran** (`v-di45.mjs`, `planImport`): the local notebook holds note N. A file holds N's trash record with a held body of `MAX_NOTE_BODY + 1`. Result: `skipped:1` ("The copy it holds in the trash couldn’t be read."), and `remove: []`, so N stays live. Controls: the same deletion with a valid held copy gives `deleted:1, remove:["N"]`, and a **tombstone-only** trash record (no `record`) also deletes N. So the report's Fix (keep it as a tombstone) uses a shape the code already accepts. Where: `desk-export.mjs` `planImport`, lines 690-693, is correct.

### DI3-5: the `star` marker is refused

**Verdict**: Confirmed. **Severity**: Low. It is a one-entry fix, and whether any stored iOS record still says `star` is unknown.

**What I ran** (`v-di45.mjs`): `validateRecord({...note, marker:"star"})` gives `marker "star" is not one of …`. `migrateRecord` and `currentMarker` leave `star` as it is, while `bookmark` becomes `ribbon`. `planImport` of a `star` note gives `skipped:1`, "It has a marker the notebook doesn’t know." The format (`:102-104`, `:181`) and E10 (`STUDY-DESK-FIXES.md:499-501`) mention iOS's `star` → `emphasis` only as precedent. They never list it among the renames *every* client reads. **Format question**: adding `star` to `RENAMED_MARKERS` is harmless on the website alone, but stating it as a rule for every client (Android too) is a format line for BDR to confirm, together with the full list of marker names either app has ever written.

### SEC3-1: a newer schema or sheet format bypasses the size caps

**Verdict**: Confirmed with correction. **Severity**: Low, the same as SEC-6 was rated. The harm is a nuisance that needs the reader to open a hostile file, and the reader can delete the record.

**What I ran** (`v-sec1.mjs`): a 4.2 MB body. With `schema:1`, `planImport` skips it. With `schema:2`, it adds it (`validateRecord` returns at the `!canEdit` gate, `desk-records.mjs:338`). `noteBodyHtml` takes 606 ms and makes 300,000 links. The cost grows linearly, so the report's 40 MB taking about 6 s is consistent. A sheet with a 2 MB text part: `sheetFormat:1` is refused ("a sheet is at most 512 KB"), and `sheetFormat:2` gives no problems and is kept. `readOnlyRich` → `sheetHtmlForShow` draws it (`sheet-pane.js:964-970`). The 50 MB file cap (`export-import.js:35`) still applies. It is the only bound.

**Correction**: the `?sheet=` part is real (`desk-page.js:1805-1820` calls `showSheet` and then `save()` for any sheet already in the notebook), but it adds nothing. It is the same as the reader opening that sheet by hand, and closing the pane ends it. The phrase "every visit to /desk draws the sheet again" is true only until the pane is closed. The label: not a regression of a guard that once worked. SEC Q2 option B exempted newer records by design, so this is a gap SEC-6's fix left. Fix (a), a ceiling on the serialized size for any schema, is the right one and fits option B.

### SEC3-3: Participant version slides carry the answers in their speaker notes

**Verdict**: Confirmed with correction. **Severity**: Low (usability and copy, more than security).

**What I read**: `sheet-page.js:371` passes `version: () => COPY_NAMES[copy]` to the menu. `open()` (`sheet-save.js:163-166`) writes it as the menu's first line and its `aria-label` ("Save the participant version as"), above both groups. `saveSlides` (`sheet-page.js:480-491`) calls `readSlides(sheet)` with **no version**, and `readSlides` puts `leaderOnly(s.notes)` and each question's answer into `notes` (`sheet-slides.js:88-101`, 148-152), which the .pptx writes as notes slides. So the participant choice never reaches the slides.

**Correction**: the content is BVJ's decision (E37 phase B, `STUDY-DESK-FIXES.md:1328-1337`: "Leader only parts and each question's answer go in the speaker notes", "the same whichever version is on screen"). The only defect is the menu's version line and accessible name implying otherwise for the Slides group. Moving the version line into "A document" fixes it without reopening the decision.

### DK3-1: `normAutofit` without `fontScale` in the .pptx

**Verdict**: Confirmed in the XML. PowerPoint's behavior is likely but not reproduced. **Severity**: Low. It needs a single block over roughly 850 to 900 characters, or a title near the 200-character limit. The result is visible, not silent, and clicking into the box in PowerPoint makes it refit.

**What I ran** (`v-dk1.mjs`): `deckSlides` with a 1,560-character single-paragraph text screen and a 200-character title. The paragraph stays on **one** slide (`text:1`; `splitBlocks` cuts only between blocks). Every slide's `<a:bodyPr>` carries a bare `<a:normAutofit/>` with no `fontScale` or `lnSpcReduction` (`desk-slides-pptx.mjs:127`, and the layout title at `:225`).

**Spec and behavior**: in ECMA-376 Part 1 (§21.1.2.1.3, `normAutofit`), `fontScale` and `lnSpcReduction` are the *stored result* of the fit, defaulting to 100% and 0%. A consumer that draws what is stored draws the text at full size. PowerPoint is widely reported, and python-pptx documents it (which is why it ships `fit_text()`), to recompute the shrink only when the text is edited, not on open. Some PowerPoint 365 builds are reported to refit on render. LibreOffice refits dynamically (the auditor's render agrees). Google Slides and Keynote are unknown. **Confidence: Medium.** To confirm, open the deck in desktop PowerPoint (5 minutes). The report's Fix stands. Computing `fontScale` from the same fit estimate that `fitBoxes` uses for print is the more robust half. Cutting at sentences matters only for blocks too long to shrink legibly.

## Appendix K: The brief every auditor was given

You are one auditor in a multi-agent audit of the **Study Desk** of the LIT Bible
website. Repo checkout to read: `C:\Users\bcjoh\GitHub\litbible\.claude\worktrees\desk-audit-3`
(branch `claude/desk-audit-3`, commit `60af379e`, identical to `main`). Read ONLY this
checkout, never the main checkout or other worktrees (other sessions work there).
Windows; PowerShell and Git Bash both exist; run Python as `python`, never `python3`.

The Study Desk is a pre-release, desktop-only, off-by-default feature (`?desk=on`):
a Notebook panel (notes, bookmarks, highlights, pinned footnotes, a trash), a Greek
tab with Greek search and a search builder, the `/desk` multi-pane workspace (LIT,
notes, Greek, search, sheet, book intro panes), and sheets (study handouts) with
print, present, share, and saving as documents and slides (.docx, .odt, .rtf, .md,
.pptx, .odp, PDF). Vanilla JS in `src/scripts/desk/` (about 84 files), pure logic in
`src/lib/desk-*.mjs` (56 files), CSS in `src/styles/desk.css`, pages
`src/pages/{desk,notebook,sheets}.astro` and `src/pages/notebook/help.astro`. About
52,000 lines. The owner wants a thorough audit covering usability, UI, accessibility,
security, bugs and functionality, longevity and sustainability, and anything else
worth knowing. You own ONE slice (given in your prompt). Stay in it except for brief
cross-slice notes.

### What is new since the last audit (scrutinize first)

Audit 2 ran at commit `a57e155d` (2026-11-03). Since then **53 commits** landed
(about 16,700 lines added): every Audit 2 work session (FA2-a to FA2-z, #446 to #461),
then Phase 5 entries E5 to E57 from the owner's daily use (Duplicate sheet, Reading
layout, bookmarks on /desk, pane-menu flyouts, two tours, the Trash, the Greek search
builder, Copy and Share flyouts shared with every reader, the Print flyout, Full
screen, footnote Pin and + Note in the margin, the Study Desk pill, saving a sheet as
documents and slides, the Book Intro pane, sheet ghost text, lists in paragraphs, the
key terms box). Run `git log --oneline a57e155d..HEAD -- <your paths>` and `git show`
the relevant ones. **New code is the least-audited; spend most of your effort there.**

### Ground rules

**READ-ONLY.** Do not edit, create, delete or commit any file in the repo. No git
commands that change state (no stash, checkout, reset, add, commit, merge, worktree).
The only file you write is your report, at the path your prompt gives, plus throwaway
scripts in your own scratch folder (your prompt gives it; never in the repo). You may
run read-only commands, the repo's unit tests (`node --test test/<file>`), and node
scripts. The `*.mjs` modules import cleanly in node, so exercise the pure logic
directly rather than only reading it.

**Do not start a dev server or open a browser** unless your prompt says you are the
live-browser auditor. Only one agent drives the browser pane.

### Orientation: read before judging

1. `src/scripts/desk/CLAUDE.md` is the design record (about 1,800 lines). Do not read
   it whole. Grep it for the features and rule numbers in your slice and read those
   parts in full. Anything marked "(BVJ, <date>)" or described as an owner decision is
   **deliberate, not a defect**. If you think a deliberate decision is wrong, put it
   under "Questions for the owner", not in Findings.
2. Root `CLAUDE.md`, "Rules that apply everywhere" and "Key Conventions": dark-mode
   styles need both selectors; size text columns with `--ch`, never the `ch` unit; focus
   rings use `--focus-ring`; links that leave the site open in a new tab with
   `rel="noopener noreferrer"`; the desk is downloaded only with `data-desk="on"` and
   shared code never statically imports it; reader-facing copy is American (color,
   periods and commas inside closing quotes), the Oxford comma always, curly quotes,
   and no em dashes in prose Claude wrote (the owner's own text is exempt).
3. **Two prior audits and a bug log exist. Check them before reporting anything.**
   - `STUDY-DESK-AUDIT-1.md` (BA1 to BA153). Too large to read whole: grep it.
   - `STUDY-DESK-AUDIT-2.md` (IDs `SEC`, `DI`, `NB`, `DK`, `GK`, `LG`, `LV`, `CP`, `RC`).
     Too large to read whole: grep it. Its "Status on main", "Work sessions" (each
     session's **Status** paragraph says what was fixed and what was deliberately left)
     and "Not covered" sections are worth reading. Most of its findings were fixed in
     #449 to #461.
   - `STUDY-DESK-FIXES.md` (E1 to E57): the owner's own bug and wish log, with
     decisions. Grep it for the feature before reporting.
   Status tags: `NEW`; `KNOWN-OPEN <ID>` (a prior finding or E entry still open);
   `REGRESSION <ID>` (marked fixed, but broken again or the fix is incomplete, with
   evidence); `DELIBERATE-LEFT <ID>` is not a finding (do not report items a session's
   Status paragraph says were deliberately left, unless the reason no longer holds).
4. **Check that the Audit 2 fixes in your slice still hold.** For each Audit 2 finding in
   your slice's prefix marked fixed, confirm the fix is still in the code (the guard,
   the test). Report breakage as `REGRESSION`. List the ones that hold, in one line
   each, under "Audit 2 fixes re-checked".

### Standards of evidence

Every finding must be verified by reading the code at the cited file and line, and by
running it where practical. No speculation presented as fact. Mark anything you could
not confirm `Confidence: Low` and say what would confirm it. Prefer fewer, real,
well-evidenced findings over padding. Do not report style nits unless they affect
users or maintainability. Things that are good go in "What held up", not in Findings.
Quote line numbers from this checkout, and name the function too (lines drift).

### Report format

Write Markdown to the report path:

- `## Summary`: 5 to 8 lines on the health of your slice, with counts by severity.
- `## Findings`, ordered by severity. One block each:
  `### <PREFIX>-<n> · <Critical|High|Medium|Low|Nit> · <a11y|usability|ui|security|bug|data-integrity|performance|longevity|docs|compat|copy> · <NEW|KNOWN-OPEN x|REGRESSION x>`
  then **Where** (`src/...:123`, function), **What happens** (a concrete scenario a user
  or maintainer would hit), **Evidence** (what you read or ran; name your script),
  **Fix** (concise and specific), **Confidence** (High, Medium or Low).
- `## Audit 2 fixes re-checked`
- `## Improvements`: worthwhile non-defects, one line of rationale each.
- `## Questions for the owner`
- `## What held up`: what you checked and found sound, so nobody re-checks it.
- `## Not reached`

Cap at about 30 findings. Severity guide: **Critical** = data loss or corruption,
script injection, or a feature unusable for a class of users. **High** = likely
user-visible failure, or a WCAG A/AA blocker. **Medium** = real friction, or a bug in
a plausible scenario. **Low** = edge case or polish. **Nit** = trivial.

### Your final message to the orchestrator

Keep it SHORT (200 words at most): counts by severity, your top five findings in one
line each, and the report path. Everything else lives in the file.
