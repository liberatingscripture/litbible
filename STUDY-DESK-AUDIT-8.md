# Study Desk Audit 8

Audited 2026-11-09 at commit `15986b6e` (`origin/main`, read from the `claude/desk-audit-8`
worktree), after Audit 6's fixes and decisions (#506 to #519), S12's editing on the Sheets page and
the ways in (#508, #520, #521), the Sheets code's move into `src/scripts/desk/sheets/` and the
editor's split, two tabs on one sheet, a shared sheet on a phone (#511), Audit 7 and the Sheets tour
(#522, #524), and E64.

BVJ's brief: **one final exhaustive audit of every Study Desk file**, planned from the way the
earlier full audits were run and from as many perspectives as possible; done **with fresh eyes, as if
nobody had reviewed it before**, not as a spot check against earlier audits; and only **after** that,
a spot check of the earlier audits' issues to make sure nothing was missed. Up to one Fable, two Opus,
four Sonnet, and two Haiku agents at a time, chosen by fit rather than to fill the slots.

Nothing in the code was changed; every finding is a recommendation. IDs carry an 8 so they never
collide with earlier audits'. The full reports are the appendices, with their heading levels shifted
down one; severities in this summary are the ones after verification (Appendix O).

**Status (2026-11-09, same day):** on BVJ's instruction to start everything that needs no input of
theirs, those findings were fixed on `claude/desk-audit-8-fixes` and each entry is marked **Fixed**,
**Partly fixed**, **No change** or **Open**. Partly fixed, with what remains on the entry: DI8-4 (a
change another tab saved but this tab hasn't heard can still be written over at close; documented),
SH8-8, XA8-14, GF8a-3, GF8a-9, GF8b-9 and GF8c-1 (the format's ceiling on `endVerse` is for BVJ and
BDR). Open for a decision: the eleven below, plus XA8-1 and XA8-12 (each needs a design first) and
PC8B-2 (with BDR). Open for a real browser or screen reader: NB8-12, GF8b-3, LV8-4, and a live check
of XA8-7, GK8-6 and LV8-5. Not started, as larger maintenance: LG8-6 (the editor's import cycle),
LG8-7 (the copied `button` helpers), LG8-8 (KNOWN-OPEN LG-13), LG8-10 and LG8-12.

**Status (2026-11-10):** the second day's work, on `claude/quirky-hopper-vwuk8i`. Fixed with no decision needed: LG8-6, LG8-7 and LG8-12 (shared helpers, the import cycle, one id maker), SH8-8's and GF8b-9's remainders, LV8-4 (the /desk header's grid), and the Search pane's Try again for GF8a-3; checked in Chromium's forced-colors emulation: NB8-12 (no change needed) and XA8-7. LG8-8 is partly fixed (DOM tests for more modules; the editor's split not started). Decided by BVJ and fixed: decisions 1 to 3 (DI8-1, DI8-2, DI8-3 for bookmarks, and labels with one name joined as one; format and merge vectors version 6, for BDR), 4 (DK8-2: a footnote's reference moves the LIT pane), 5 (the participant's version by default), 6 (GK8-1 and GK8-5: Strong's numbers per word, and the requested Greek credits; Greek search index format 3), 7 (My Notes paged at 200, margin stacks folded past five), 8 (Delete all notes and marks, and Delete all sheets), 9 (one name per thing in reader copy), 10 (the phone viewer's Safari 16.4 floor) and 11 (the smaller ones), so no decision is left. XA8-1 is fixed too, by click (BVJ's choice, 2026-11-10). Still open: XA8-12 (a design call), PC8B-2 and GF8c-1's ceiling in the shared format (with BDR), GF8b-3 (a screen reader), GK8-6 (a live IME), and LG8-10 (not started, worth doing only if launch measurements call for it). Partly fixed, with what remains on each entry: DI8-4, GF8a-3, GF8a-9, XA8-14 and LG8-8.

## Bottom line

**No Critical or High finding, in either phase.** After verification, **13 Medium**, 94 Low and 11
Nit findings stand from the fresh-eyes pass, plus CP8's copy tables. The spot check of Audits 1 to 7
and the E log found **no regression the fresh pass had missed**: every fix that came undone was
already among the new findings, and phase 2 adds only seven Lows (four of them stale test citations in
the audit files themselves).

The foundations held under heavier testing than any earlier audit gave them. All 3,377 tests pass,
260 chapters validate, `astro check` is clean, and 47,035 links resolve. Every record kind round-trips
byte for byte; three replicas converge over 6,000 random histories with clock skew; 358,000 anchors
replayed over all 461 chapter revisions in git never land silently in another verse; the sanitizers
held through about 240,000 hostile and random inputs (re-parsed with parse5, idempotent, linear in
time); the share-link decoder refused zip bombs, truncated, and prototype-polluting links; all six file
writers emitted well-formed XML or RTF (2,154 parts parsed) with the content in order; single-word
Greek search agreed with an independent matcher on about 280,000 query variants; and the gate keeps
desk code off all 354 built pages for a reader without the preview.

What is left:

1. **Two tabs, the newest feature, carry the most findings.** The `/sheets` list tears itself down
   and rebuilds on every autosave in any other tab, so it jumps to the top, closes an open "New
   sheet…" chooser, and drops focus (SH8-1, seen live as LV8-1). "Keep mine" writes every field of
   a card, so it reverts the other tab's change to a field the reader never touched, and the
   untouched field stays stale on screen until then (SH8-2). Closing a tab writes the whole sheet
   from that tab's copy over a part another tab saved a moment before (DI8-4). Five Lows round it
   out (DI8-7, DI8-8, SH8-4, SH8-7, NB8-1). The broadcast that tells other tabs about a change also
   wakes every chapter tab's mark drawing on each sheet autosave (NB8-1, NB8-3, GF8b-8).
2. **A clock that was ever wrong.** A record stamped by a device whose clock ran far ahead stays
   "ahead" for ever: its edits, deletions, and undos are dropped in both directions, and the
   hybrid-clock step preserves the bad stamp (DI8-1). This is a rule in the format shared with the
   apps, so it is for BDR too.
3. **Failures that say nothing.** A failed bookmark, highlight, or pin write logs to the console
   (NB8-2); after another tab upgrades the database, the store is closed for the rest of the page's
   life (DI8-5); `/notebook`'s label, "Delete everything", and "Empty the trash now" writes have no
   `catch` (GF8a-2); a verse index that didn't load reads "No results." (GF8a-3); a failed delete in
   the sheets list does nothing visible (SH8-5). Each is Low; together they are the desk's main
   robustness gap.
4. **Accessibility, from a dedicated lens.** This audit gave accessibility its own auditor across the
   whole desk for the first time. The Sheets editor's styles (about 1,800 lines) have no forced-colors
   rules (XA8-7); its fields draw their edges at 22 to 25 percent ink against the site's own
   `--field-border` rule (XA8-2); "Move it here" and "Save as template" have names that omit their
   visible words (XA8-4); four families of drag-only resizing and moving have only a keyboard
   alternative, which WCAG 2.5.7 does not accept (XA8-1); the commercial check re-announces itself in
   full on every autosave (GF8b-1); renaming a label on `/notebook` from the keyboard never closes the
   form (DK8-1).
5. **Three plain bugs.** Clicking the suggested "ὁ, θεός" in /desk's Search pane throws a
   `ReferenceError` (GF8a-1; a bare `ARTICLE_EXAMPLE` this file never imports). A Strong's number
   search returns every word of any lemma that MACULA tagged with that number even once (GK8-1:
   G848 gives all 5,557 αὐτός words). The passage form's refusal tells a leader working in Jude to
   "add Jude 3 and then the next chapter" (GF8c-2). And on /desk a scripture reference inside a
   footnote is a same-tab link that leaves the workspace (DK8-2).
6. **The tests guard less than they look.** Removing the `data-desk="on"` test from four of the
   gate's runtime branches breaks no test (LG8-1); 59 of 102 client modules are named by no test
   (LG8-8, KNOWN-OPEN LG-13); four guards, one of them a rule the shared format states, survive
   deliberate breakage (LG8-5).

### Counts

| | Critical | High | Medium | Low | Nit |
|---|---|---|---|---|---|
| Phase 1, fresh eyes (14 auditors), as reported | 0 | 0 | 29 | 85 | 9 |
| Phase 1, after verification | 0 | 0 | **13** | **94** | **11** |
| Phase 2, the earlier audits re-checked (misses only) | 0 | 0 | 0 | 7 | 0 |

The verifier (Opus) checked 49 items: every Medium, every Low that touches a reader's data or safety,
and CP8's three items rated "High." It confirmed all but one, lowered 18 by a step or more, folded
four duplicates (LV8-1 into SH8-1, LV8-3 into XA8-13, LG8-3 into NB8-1 and NB8-3, a GF8a note into
SEC8-2), found one deliberate (LV8-2: typing over a part another tab changed is BVJ's 2026-11-08 rule,
and its "not announced" half did not reproduce), and moved LV8-7 to Improvements (the phone viewer's
18 modules, about 392 KB raw and 115 to 119 KB compressed, are what the design allows). It raised
none. CP8's copy findings are counted in its own tables (Appendix I): no spelling, quotation,
Oxford-comma, or em-dash violation in the site's prose; five straight-quote lines in the Markdown import
report; seven ellipsis items; and ten names used two ways, for the owner to choose between.

## Priority list

### Tier 1: fix next (small; a reader meets each one)

| ID | What | Size |
|---|---|---|
| GF8a-1 | Search pane: `ARTICLE_EXAMPLE` used bare at `search-pane.js:1175` (`gk.ARTICLE_EXAMPLE` at `:1170`) | one word |
| SH8-1 | The `/sheets` list rebuilds on every sheet save anywhere; redraw only when its rows changed, and keep the open chooser, scroll, and focus | small |
| SH8-2 | "Keep mine" writes only the fields this tab changed; refresh untouched fields from the other tab's save | small to medium |
| DI8-4 | `pagehide`'s `writeNow` writes this tab's changed parts only, over a fresh read | small |
| GF8c-2 | One-chapter books (Philemon, 2 John, 3 John, Jude) get their own refusal sentence | one branch |
| DK8-1 | `/notebook` label rename: Enter closes the form, Escape cancels (blur before the redraw) | small |
| DK8-2 | Footnote scripture links on /desk follow one rule across panes (decision 4) | small |
| XA8-4 | "Move it here" and "Save as template": put the visible words in the accessible name | two lines |
| GF8b-1 | The commercial check's live region announces only a change in verdict, not the whole card on every autosave | small |
| GF8b-4 | The tour's example note editor must not clear the reader's saved draft | one line |
| NB8-2, DI8-5, GF8a-2, SH8-5 | Failed writes say so (one undo-bar sentence), and the store reopens after `versionchange` | small each |

### Tier 2: after a decision, or before the desk is public

| ID | What |
|---|---|
| DI8-1 | Bound how far ahead a stamp may step (decision 1; a format change for BDR) |
| DI8-2, DI8-3 | Restoring a record the website can't edit; which trash copy of a bookmark wins (decisions 2 and 3) |
| GK8-1 | Strong's numbers matched per lemma (decision 6; the build would need MACULA's per-word tags) |
| XA8-1 | Single-pointer alternatives for the width handles, the floating Notebook's edge, the Greek splitter, and floating windows |
| XA8-2, XA8-7 | The Sheets editor's field borders and its forced-colors rules |
| GF8c-1 | A ceiling on `endVerse` (and `verse`) in `validateRecord`, the passage check, and the format |
| LG8-1, LG8-5 | Tests for the gate's runtime branches and the four guards that survive breakage |
| LG8-2, NB8-1, NB8-3, NB8-4, GF8b-8, GF8b-9, LG8-4 | Scale: cap or virtualize My Notes; filter what each view hears; tokenize the leak check once |
| SEC8-1 to SEC8-3 | The Markdown import's two quadratic regexes; `makeInert` on the Search pane's glossary entry; notebook search words out of the request URL |
| PC8B-2 (= DI6-5) | A followed bookmark's move undoes a deletion elsewhere: still with BDR, unchanged |

### Tier 3: polish and nits

Everything else in the appendices: the remaining XA8 Lows (contrast just under 4.5:1, placeholders,
focus obscured by the undo bar, Present's toggles, focus dropped after removing the last part), the
NB8, DK8, GK8, GF8a, GF8b, and GF8c Lows, LG8's maintainability items (the editor's import cycle,
copied helpers, drifted doc claims), LV8's layout items (the title menu past the edge at 1000px, a
narrow Sheets pane scrolling sideways), MH8's Nits, CP8's ellipses and straight quotes, and phase 2's
stale test citations (PC8C-1 to PC8C-4) and "Tick what to bring" (PC8A-1).

## Themes

1. **New seams, not old code, are where the defects are.** Earlier audits found the sibling-path
   pattern three times running (a fix that reached one path and missed its twin). This time the
   pattern is different: the seams between tabs (theme 1 of the bottom line), between the desk and
   the clock (DI8-1), and between a write and a reader who never hears it failed (theme 3). Code that
   has been audited seven times held; code that crosses a boundary nobody has tested did not.
2. **Silence as a failure mode.** The desk is careful to never lose words, and it doesn't: no finding
   loses a note. But a dozen places treat a failed write, a failed load, or a closed database as
   something only the console needs to know. A reader then sees a bookmark that isn't saved, a
   search that says "No results.", or a button that stays disabled.
3. **Scale is untested above a few hundred records.** Pure layers are linear to 10,000 records, but
   My Notes, What's new, the notebook search, the margin, and the leak check redraw or rescan
   everything on every change, and nothing caps a list. A heavy user of the preview (BVJ) will reach
   these before a new reader does.
4. **Accessibility drifted in the Sheets.** The site's own rules (`--field-border`, forced colors,
   names that contain visible text, focus kept across a redraw) are applied in the Notebook and /desk
   and mostly missing from the Sheets editor, the newest and largest surface.

## Decisions needed from the owner

1. **DI8-1: should a stamp ever step more than five minutes past the client's own clock?** Bounding
   it changes the format's "Room for skew" for BDR. Proposed: clamp, and treat a stored stamp far in
   the future as now. **Decided (2026-11-10): clamp; fixed.**
2. **DI8-2: may the website restamp `modified` and `client` when a reader restores, or undoes the
   deletion of, a record it can't edit?** The format says such a record "comes back exactly as it
   was," which means the restore loses to the deletion the next time they meet. (VER8 notes the E log
   says a restore outranks a deletion, which is false for these records.) **Decided (2026-11-10): restamp; fixed.**
3. **DI8-3 and labels with one name on two devices:** fold them at merge, or list both? **Decided (2026-11-10): merge. Bookmarks merge by group; two labels with one name are one label, joined where they are read; fixed.**
4. **DK8-2: a scripture reference in a footnote on /desk:** open a new tab (E34's rule for links that
   leave the desk), or move the LIT pane, as the Book Intro pane does? Either is small; the panes
   should agree. **Decided (2026-11-10): move the LIT pane; fixed.**
5. **The Share dialog starts on "Everything, for another leader"** (SEC8 question 1), though its own
   note says "send the participant's version when you're unsure." And on a phone, Share… forwards a
   leader link as it came, with no participant choice (SH8 question). Should both default to, or
   offer, the participant's version? **Decided (2026-11-10): the participant's version, in the dialog and on a phone; fixed.**
6. **GK8-1 and GK8-5: Strong's numbers and the Greek credits.** Keep the lemma-wide match, or narrow
   the three mis-tag cases (G848, G1519, G3596)? Use the UBS repository's requested credit wording and
   name MorphGNT's editor, or keep the shorter lines? **Decided (2026-11-10): match by each word's own number, and use the requested credits; fixed.**
7. **Scale (LG8-2, GF8b-6):** page My Notes on /desk and `/notebook`, or keep them unpaged? Cap many
   notes on one verse into "N more," or let the margin stack? **Decided (2026-11-10): page at 200 with “Show N more”, and fold a margin stack past five into “N more notes”; fixed.**
8. **"Delete everything" (DK8-7):** is trashing sheets and templates with the notes intended, or
   should sheets have their own button? Either way the sentence should say what it moves. **Decided (2026-11-10): two buttons, “Delete all notes and marks” and “Delete all sheets” (labels on Fable’s advice, no third button); fixed.**
9. **Copy names (CP8 Rule 7, Rule 6):** "My Notes" or "My notes," "My Notebook" or "My notebook,"
   "Your templates" or "My templates," "Space" or "Space to write," and whether "Study Desk preview"
   stays in reader-facing text until release. **Decided (2026-11-10): My Notes, My Notebook, My templates, Space to write, From my notes, Display options; Study Desk preview stays; and the .md files are named for what they hold, decided the same day: a shared sheet's is “a sheet file (.md)” (“Export a sheet file (.md)”, “Import a sheet file”) and the notebook's copy stays “Markdown.” Fixed.**
10. **The phone viewer's floor (LG8-9):** is Safari 16.4 (iOS 16.4) the intended floor? Older iPhones
    fail with a message that blames the connection. **Decided (2026-11-10): yes; the message now says the browser is too old; fixed.**
11. **Smaller ones**, each in its report: Hide my marks pressed twice (NB8-6); whether the minimized
    Notebook should draw My Notes at all (NB8-3); /desk reading never updating "Continue reading"
    (DK8 question 2); "Hide my marks" and the Notebook's Print with my notes (DK8 question 3);
    collapsing two page breaks left by removed leader-only parts (GF8b-12); whether "God" gives away
    a blank on "God's" (GF8c-4); the presenter's toggle signal (XA8-6); a group per verse for Greek
    words read by a screen reader (XA8 question 3); and whether "off" means hidden rather than erased
    (SEC8 question 2). **Decided (2026-11-10): fix NB8-6, NB8-3, GF8b-12, GF8c-4 and XA8-6; /desk reading writes Continue reading; “with my notes” always prints them; the Greek words wait for the screen-reader pass (GF8b-3); the off switch is moot, since the desk will have none at release. Fixed.**

## Phase 2: the earlier audits, re-checked

Three agents re-read the earlier record against today's code after the fresh pass was finished:
PC8A (Sonnet) Audits 1 and 2, about 265 items; PC8B (Sonnet) Audits 3 to 7 and the E log, about 95
items plus a seeded sample of 28 Lows; PC8C (Haiku) every test file that an audit or the E log cites,
115 of them, run in full (2,956 tests, all passing). The full reports are Appendices P to R.

- **No regression that the fresh pass missed.** Every fix found undone was already in phase 1, and
  those findings are regressions rather than new: BA79 (SH8-6, XA8-9), BA141 (XA8-7), BA143 (XA8-3),
  BA144 (XA8-2, XA8-13), BA129 and BA72 (DI8-4, SH8-2), BA128 and BA130 (DI8-8), DI-8 (DI8-1), DI-3
  (DI8-3), DI-10 and RC-1 (DI8-2), SEC3-2 (SEC8-2), NB3-8 (NB8-8), NB3-14 (DK8-6), BA134 (GF8c-8),
  and BA136 (GF8c-10). E64's "the list redraws when a sheet changes elsewhere, keeping focus" is
  SH8-1. The fixes that moved with the Sheets code and the two-stage load all survived the move
  (88 of the 95 items PC8B checked hold; none regressed silently).
- **The misses, all Low:** PC8A-1, "Tick what to bring." is British usage (`add-forms.js:79`, "Check"),
  noted in Audit 2 but never recorded; PC8B-1, #504 replaced "gathering again adds only the new
  questions" with a chooser that disables ticks for notes already on the sheet, a guard the Add
  handler never re-checks and no test covers; PC8B-2, DI6-5 (a followed bookmark's move undoes a
  deletion elsewhere) still awaits BDR and is unchanged in the code; PC8C-1 to PC8C-4, four test files
  cited by Audits 1 and 3 were renamed or replaced (the fixes hold under the new names).
- **Still open by decision, not misses:** the CSP is still report-only (BVJ, 2026-11-03, "not yet"),
  and the launch list has no CSP line, so it is worth a reminder at launch; tombstones kept for ever
  (with BDR); `execCommand` (accepted for version 1); the Safari and VoiceOver checks (with BDR).

## What the orchestrator checked personally

GF8a-1 in the code (`search-pane.js:1170` uses `gk.ARTICLE_EXAMPLE`, `:1175` a bare
`ARTICLE_EXAMPLE` the file never imports). CP8's "missing verb" (`add-forms.js:79`,
`help.astro:137`): "a note or a pinned footnote Your text" leaves out the repeated "becomes" on
purpose (gapping), so a Nit for readability, as VER8 also found. MH8-1's `.desk-tour:focus { outline:
none }` (`desk.css:3010`). The coverage of every file in `src/scripts/desk/`, `sheets/`, and
`src/lib/desk-*.mjs` against the reports, which found about 35 pure modules and a dozen small client
files that no slice owned; GF8a, GF8b, and GF8c were added to read them end to end. The build's
rewrite of `src/data/podcast-feed.xml` in the audit worktree was reverted.

## Method

Phase 1 was fifteen agents (fourteen auditors and a verifier), read-only in the repo, on the worktree pinned to `15986b6e` with its
own `npm ci` and a production build. Every phase 1 auditor got the brief in Appendix S. It asked them
to form their own view from the code and the design record, and to grep the earlier audits only to
tag a finding before writing it up, never to choose where to look. Re-checking earlier fixes was held
back for phase 2. Never more than one Fable, two Opus, four Sonnet, and two Haiku ran at once. Models
by fit:

- **Fable** for data integrity and sync-readiness (`DI8`), the format shared with both apps, where a
  wrong call is hardest to see in review.
- **Opus** for security (`SEC8`, reasoning from attacker input to a sink, and walking `dist/` for the
  gate); for the Sheets code (`SH8`), the newest and most-changed code, where two tabs and the
  editor's split make for subtle state bugs; for the pure logic layer (`GF8c`), exercised by
  property-based and adversarial runs; and for the adversarial verification (`VER8`).
- **Sonnet** for the broad reading slices: reading pages and the Notebook (`NB8`); /desk,
  `/notebook`, the help page, the tours, and printing notes (`DK8`); the Greek (`GK8`); a new
  cross-cutting accessibility lens over the whole desk against WCAG 2.2 AA (`XA8`); longevity,
  performance, and compatibility (`LG8`); two gap passes over files the first slices reached only
  partly (`GF8a`: the Search pane, the floating windows, Greek find, the commands window, `/notebook`;
  `GF8b`: the Sheets' paper and word cursor, the margin's placement, change notices, the tours'
  acts); and the live pass (`LV8`), the only agent in the browser, against the build served on its
  own port. Sonnet also ran phase 2's two reading passes (`PC8A`, `PC8B`).
- **Haiku** for the fully specified checklists: copy rules (`CP8`), mechanical health (`MH8`: the
  commands, CSS-rule greps, sizes, coverage by name), and phase 2's test-citation check (`PC8C`).

Phase 2's brief is Appendix T. Throwaway scripts (merge and anchor fuzzing over git history, the
sanitizer and share fuzzing, the file-writer probes, the contrast resolver, the Greek oracle, the
mutation runs, the verifier's reproductions) are in the session scratchpad.

## Not covered

A real screen reader (GF8b-3 and XA8-6 need NVDA or JAWS), a Windows contrast theme (XA8-7 and NB8-12
were judged from the CSS), Firefox and Safari, phones beyond the shared-sheet viewer, print dialogs and
file saves by hand (their writers were run in node instead), the presenter window on two screens,
pane drags, and four panes live. LV8's origin was not fresh: port 4598 held four records and tour
flags from an earlier session, so its first use was replayed rather than cold. The apps' side of the
format, and `build:greek`'s sources (so GK8-1's per-word tags were judged from the build's output),
were out of reach.

## Appendix A: Data integrity, the record format, and sync-readiness (`DI8`, Fable)

Slice: the store and records (`desk-records.mjs`, `desk-store-core.mjs`, `desk-merge.mjs`, `desk-export.mjs`, `desk-history.mjs`, `desk-notebook.mjs`, `desk-sheets.mjs`, `desk-sheet-format.mjs`, `desk-sheet-tabs.mjs`, `anchor-core.mjs`; `store.js`, `export-import.js`, `history.js`, `change-notice.js`, `sheets/sheet-tabs.js`, the two-tab code in `sheets/sheet-editor.js`, `trash-list.js`), `STUDY-DESK-FORMAT.md` read against the code, and the committed vectors. Model: Fable 5.1. Commit `15986b6e` (branch `claude/desk-audit-8`, read-only). Date: 2026-11-09.

What I ran (scripts in `…\scratchpad\audit8\di8\`, all against the checkout's own modules):
- `roundtrip.mjs`: 26 records of every kind (a trash record, a tombstone, an unknown kind, a newer-schema note, renamed markers `bookmark` and `star`, an old ribbon, a bookmark without stamps, a sheet, an own template, a sheet with an unknown module, prose and footnote notes) through `toBackupJson`, `toWebAnnotation` and `toMarkdown` → `parseImport` → `planImport`, into an empty notebook, the same notebook, and one holding newer copies; a BOM/CRLF file; a file saved by a clock set ahead, opened twice; `escapeBody`/`unescapeBody` inverses.
- `merge-fuzz.mjs`: 3,000 three-replica histories without skew and 3,000 with one clock 90 s off, through the real `createRecord`, `editRecord` (notes, labels, bookmark place and name and follow), `trashRecord`, `restoreFromTrash`, `desk-history`'s `makeEntry`/`inversePlan`, partial exchanges, a 31-day jump; full pairwise exchange in two orders to a fixpoint; idempotence.
- `anchors-history.mjs`: every revision of every chapter in git (`git log` + `git show`, 461 revisions whose anchor text changed), 358,535 anchors of 1, 3 and 8 words resolved against the next revision, with a word-level LCS between the two texts as ground truth.
- `sanitize-fuzz.mjs`: 20,000 random hostile HTML strings through `sanitizeSheetHtml` (idempotence, acceptance by `validateSheet`, `cleanSheetText` stability), 3,000 through `pastedSheetHtml`, and 20 hand-written bad modules.
- `store-race.mjs`: the real `store.js` under `fake-indexeddb`: two stores interleaving 40 edits to two parts of one sheet, `writeNow` over a stale copy racing another tab's write, an uncloneable record in a `commit`, and a `versionchange` from a newer open.
- `stamps.mjs`, `trash-bookmark.mjs`: targeted reproductions for DI8-1, DI8-2, DI8-3 and the format probes in DI8-6.
- `node --test` on the slice's nine test files: 733 pass.

### Summary

The slice is sound where it has been hammered before and still sound under new pressure: every record kind round-trips byte for byte, the live set of three replicas always converges (6,000 histories, skew included), the sanitizer is idempotent on 20,000 hostile inputs, and 358,000 anchors replayed over every chapter revision in git never land silently in another verse. The new findings are at the seams the design has not looked at: the stamp rules that make sync work assume a clock that was never wrong (DI8-1), the "keep what you don't understand" principle leaves a restored foreign record stamped older than its own deletion (DI8-2), and the trash merge picks a held bookmark by `modified` alone where live bookmarks merge by group, so the trash's words diverge between devices (DI8-3). Two tabs on one sheet hold up except at `pagehide` (DI8-4) and in the header of a card being typed in (DI8-7); the store has no life after a `versionchange` (DI8-5). The format reads well for BDR, with three required facts missing (DI8-6).

Counts: Critical 0, High 0, Medium 3, Low 5, Nit 0.

### Findings

#### DI8-1 · Medium · data-integrity · NEW
A record once stamped by a clock set ahead is unsyncable for ever, in both directions, and the hybrid-clock step keeps it so.

**Where** `src/lib/desk-records.mjs:230-234` (`laterThan`), used by `editRecord` (211), `trashRecord` (259), `restoreFromTrash` (293) and `desk-history.mjs:148` (`restamped`); `src/lib/desk-merge.mjs:349-359` (the clamp's never-beats rule) and 379-389 (rule b). `STUDY-DESK-FORMAT.md:910-927` tells BDR to stamp the same way.

**What happens** A reader's laptop clock is wrong for an afternoon (a dead CMOS battery, a VM, a travel misset) and they write one note. The clock is corrected. Every later edit of that note is stamped `laterThan(2030…, now)` = 2030 + 1 ms, as are its deletion and any undo over it, because the step follows the record's own stamp without limit. When that notebook meets another copy (today: a backup opened on another computer; later: sync): the other side writes the record once, at its cap, and after that (a) the origin's later edits arrive "ahead" and are dropped because the receiver holds the id; (b) the origin's deletion arrives "ahead" and is dropped; (c) the other side's edits lose to the 2030 `modified` on the origin under rule a; (d) the other side's deletion loses under rule b (`live.modified > deletedAt`), so the note comes back there. The reader sees one note that never agrees across devices and cannot be deleted from either side, with no notice naming the cause; only deleting and re-creating it heals it, and the import's "carries a date from a clock that was set ahead" line shows on every open of every later file.

**Evidence** `stamps.mjs`, section A: "A edits with a correct clock; stamp becomes 2030-06-01T00:00:00.001Z … A's v3 reaches B? NO … B's edit reaches A? NO … B's deletion reaches A? NO … A's deletion reaches B? NO … A's undo stamps the put-back record: 2030-06-01T00:00:00.003Z." Read: `laterThan` has no upper bound; `clamped` (merge 165-181) treats anything past `cap + tolerance` as ahead; rule b compares `live.modified` with no cap on the local side ("Local records are never clamped: they are the reader's own", merge 47-48).

**Fix** Bound the step: in `laterThan`, when `previous` is more than `CLOCK_TOLERANCE_MS` past `now`, return `now` (the record is already unsyncable; a `now` stamp lets it heal, since the other side holds a clamped copy at an earlier cap). Export `CLOCK_TOLERANCE_MS` from a shared place (it lives in `desk-merge.mjs`, which `desk-records.mjs` must not import; move it to `desk-records.mjs` and re-export). Add a merge vector and a records test. Tell BDR in the format's "Room for skew" bullet: "a stamp never steps more than five minutes past the client's own clock". Related, not the same: BA4 and DI-8 made the receiving side safe; this is the origin side.

**Confidence** High.

**Fixed (2026-11-10)** Decision 1: clamp (BVJ). `laterThan` never steps more than `CLOCK_TOLERANCE_MS` past the device's own clock (now in `desk-records.mjs`, re-exported by `desk-merge.mjs`); over a version further ahead the stamp is `now`, and `laterThanAll` judges each version against the clock. A device whose clock moved back more than five minutes past its own earlier stamp is the same case and now stamps `now` too. For BDR: the rule is in the format's "Room for skew" bullet; rules a to c and the vectors are unchanged. Tests: `test/desk-audit8-j-stamps.test.js` (the healing walked through the merge).

#### DI8-2 · Medium · data-integrity · NEW
Restoring, or undoing the deletion of, a record this client can't edit puts it back stamped older than its own deletion, so the deletion wins the next time the two meet.

**Where** `src/lib/desk-records.mjs:292` (`restoreFromTrash`: `if (!canEdit(trash.record)) return trash.record;`), `src/lib/desk-history.mjs:151` (`restamped`: `if (!canEdit(record)) return snapshot(record);`), judged by `desk-merge.mjs:382-384` (rule b: equal or earlier `modified` loses to `deletedAt`). `STUDY-DESK-FORMAT.md:302` documents the behaviour ("one of a kind or schema it can't edit comes back exactly as it was") but not its consequence.

**What happens** An app writes a record of a kind the website doesn't know (or a note under a later `schema`); the reader deletes it on the website, changes their mind and presses Restore in the Trash (or Ctrl+Z). The record is back. They then open last week's backup, which still holds the deletion: rule b sees `live.modified` (the original stamp) ≤ `deletedAt` and deletes it again, counted as "1 deleted". Under sync the same happens on every other device as soon as the trash record arrives, and the restored record is gone everywhere but briefly. The reader did restore it; the format's own undo rule ("whatever their undo writes must outrank … the change it takes back", format 308-310) is broken for exactly these records.

**Evidence** `stamps.mjs`, section B: an unknown-kind record and a `schema: 2` note, each trashed then restored, then the trash record merged back: "record removed again? YES, the restore is undone", both for `restoreFromTrash` and for `inversePlan` over the deletion ("puts the note back stamped 12:00:00 vs deletedAt 12:01:00").

**Fix** Restamp the common fields only, which every client reads, and leave every other field untouched: `restoreFromTrash` and `restamped` set `modified` (and `client`) for an uneditable record too, through `laterThanAll`. Principle 6 is about fields the client doesn't understand; `modified` is the one field every client does. Put the rule in the format under kind 10's "Undo and redo" for BDR. Alternatively keep the record untouched and refuse to restore what can't be edited, with a sentence saying why; worse for the reader.

**Confidence** High.

**Fixed (2026-11-10)** Decision 2: restamp (BVJ). `restoreFromTrash` and the history's `restamped` give a record this code can't edit a fresh `modified` and `client`, stepped past its deletion, and leave every other field as it was. For BDR: under kind 10's "Undo and redo on the website". Tests: `test/desk-audit8-j-stamps.test.js`, and the earlier "exactly as it was" tests updated.

#### DI8-3 · Medium · data-integrity · NEW
Two trash records of one deletion holding two copies of a stamped bookmark keep whichever copy the merge order favours, so the trash's words differ between devices and a restore brings back different bookmarks.

**Where** `src/lib/desk-merge.mjs:261-281` (`collapseTrash`, the donor at 266-273 ranked by the held copy's `modified` alone), and 385-387 (rule b: "the trash record takes the newer copy", by `modified` alone). Live copies merge by group in `mergeBookmark` (204-224); held copies never do.

**What happens** A bookmark is renamed on the laptop and, meanwhile, moved by "Move as I read" on the phone. Each device's copy has the same `modified` (the later move) once the move has reached the laptop, but the phone never got the rename. The reader deletes the bookmark; the deletion syncs as one trash id. Each device's trash record holds its own copy. When the trash records meet, the tie on the held `modified` goes to the survivor's own copy, which is the local one on each device: the laptop's trash holds "Christmas (renamed)", the phone's holds "Christmas". Restore on each brings back a different bookmark; the rename is lost on one of them. Rule b's "deletion takes the newer copy" has the same hole: a live copy with the rename and the same `modified` as the held copy is not taken, and its rename is lost from the trash.

**Evidence** `trash-bookmark.mjs`: "held label after X<-Y: L+edited … after Y<-X: L … converged? false … restored on X: L+edited | restored on Y: L"; and the live-against-deletion case: "held label now L (the rename is lost from the trash)". `merge-fuzz.mjs` without skew: 19 of 3,000 histories end with a trash record whose held bookmark differs between merge orders (live sets identical in all 3,000). Audit 3's fuzz predates the group stamps (version 5, 2026-11-07), which is why it saw 0.

**Fix** Wherever two held copies of one id are compared (`collapseTrash`'s donor, `pickWithin`'s `bothTrash`, rule b's `instant(live.modified) > instant(survivor.record.modified)`), when both are stamped bookmarks take `mergeBookmark(a, b, tie)` with the collapse's own tie rule (the smaller canonical JSON) instead of one whole copy; rule b likewise merges the live copy into the held one by group when `modified` ties. One new merge vector, version 6, for BDR.

**Confidence** High.

**Fixed (2026-11-10)** Decision 3: merge by group (BVJ). `collapseTrash` merges every held stamped bookmark by group (`mergeBookmarks`), and rule b merges a live stamped copy into the held one when the deletion stands. A group's tie goes to the copy whose fields in that group sort first, so the trash settles alike in any order: a fuzz of 3,000 histories of three copies, with and without a live one, gave the same result in every order (1,313 and 1,262 depended on order before). Merge vectors version 6, two cases, and the format's "A bookmark merges by group" bullet, for BDR. The other half of decision 3, labels made on two devices with one name, was decided the same day: merge. Nothing is rewritten at merge; `desk-labels.mjs` joins them where they are read (the oldest record's id, the name as last written), and rename, delete and taking a label off act on every id of it. The format's kind 8 says so, for BDR.

#### DI8-4 · Low · data-integrity · NEW
Closing a tab writes the whole sheet from that tab's copy, so a part another tab saved moments before is silently overwritten.

**Where** `src/scripts/desk/sheets/sheet-editor.js:979-997` (`onPagehide`: `planSheetChange(next = sheet, asked.op)` over the pane's own copy, then `store.writeNow(plan)`), `src/scripts/desk/store.js:356-375` (`writeNow`: no read, aborts the transactions still reading). The design record (`sheets/CLAUDE.md`, "A closing page keeps its last typing", BA72) says the write is "applied to its own copy" and does not weigh the other tab.

**What happens** The same sheet is open in two tabs (S12, part 4). Tab B types in part 2 and its save lands. Tab A, whose own save is still in flight (so its `refresh()` is waiting on `saving` and its `sheet` still lacks B's words), is closed within that second. A's `pagehide` plans its pending op over its stale copy and `writeNow` puts the whole sheet, part 2 included, as A last knew it. B's words are gone from the store. B hears the change: if B's cursor is still in part 2 it sees "Changed in another tab" with its own words kept; if B has clicked elsewhere, the card is redrawn with the old text and B's typing is lost with no line.

**Evidence** `store-race.mjs`, step 2, two real stores: B's `change` and A's `writeNow` over a copy read before B's write: result `['<p>one 99</p>', '<p>two 19</p>']`, B's `two 99` lost. The window is the gap between B's write landing and A's `refresh()` finishing, which `await saving` (sheet-editor 449) stretches to A's own in-flight save.

**Fix** Narrow what `pagehide` may write: only parts this tab's pending ops touched. Build the plan as a module-level merge: start from `sheet`, apply the pending ops, and put a sheet whose other modules are taken from… there is nothing newer to take them from without a read, so the honest fix is to accept the race and say so in `sheets/CLAUDE.md` ("a part another tab saved in the last second can be lost when this tab closes"), or to make `refresh()` not wait on `saving` for an `other-tab` origin (update `sheet` first, redraw after the save lands), which closes most of the window. A title or subtitle typed in the other tab is overwritten the same way.

**Confidence** High that it happens as described in `fake-indexeddb`; Medium on how often a real browser runs `pagehide` inside the window.

**Partly fixed (2026-11-09)** `pagehide` writes over the newest copy this tab has heard of: its own, or one another tab saved that `refresh` read while this tab's own saves were in flight. A part another tab saved that this tab hasn't yet heard of can still be written over at close; the verifier preferred documenting that race, and the desk file's rule 11 and `onPagehide`'s comment now do. Tests: `test/desk-audit8-a-sheet-tabs.test.js`.

#### DI8-5 · Low · longevity · NEW
After a `versionchange` the store closes its connection and every later call throws for the rest of the page's life, with nothing told to the reader.

**Where** `src/scripts/desk/store.js:148` (`db.onversionchange = () => db.close();`), then `read` (176-179), `apply` (220) and `writeNow` (367) call `db.transaction` on a closed connection. Compare `src/scripts/desk/readonly-notebook.js:41-44, 64-68`, which drops the connection and reopens on the next read.

**What happens** The first time `DB_VERSION` is raised (an index, a second store), a reader with two tabs open reloads one of them. The new page's upgrade asks the old tab to let go; the old tab's store closes, as designed. From then on, in the old tab, every autosave of a sheet fails with "That change wasn't saved. Try it again." on every keystroke (sheet-editor's `failed`), a note's Save says it couldn't be saved, Ctrl+Z says "couldn't be undone", and the panel's lists stop updating. Nothing says "reload". The reader keeps typing into a sheet whose words will all be lost when they finally do.

**Evidence** `store-race.mjs`, step 4: after a second open at version 2 succeeded (no `blocked`), `tabA.all()`, `tabA.save()` and `tabA.writeNow()` each threw `InvalidStateError`. Read: nothing in `store.js` notices the closed state or reopens.

**Fix** In `onversionchange`, close and set a flag; make `read`, `apply` and `writeNow` reject with a named error (`desk-store: the notebook was updated in another tab`), and have the shell (`shell.js`/`panel.js`) show one line with a Reload button when it sees that name, as `standDown()` does for a failed load. Or reopen lazily as `readonly-notebook.js` does, which works only while the new version's upgrade handler can run in this page's code too (it can't, the old page has the old `DB_VERSION`), so the line and the button are the right answer.

**Confidence** High.

**Fixed (2026-11-09)** After a version change the store reopens on the next call; after an upgrade by a newer page, calls reject with `NOTEBOOK_UPGRADED`, `writeNow` throws a named error, and the editor's failure line tells the reader to reload, leaving their words on screen. Tests: `test/desk-audit8-a-store.test.js`.

#### DI8-6 · Low · docs · NEW
Three facts the website enforces are missing from the format, so an app built from the document alone writes records the website refuses.

**Where** `STUDY-DESK-FORMAT.md:108-131` (kind 2), 69-72 and 258-271 (kind 10); `src/lib/desk-records.mjs:446` (a note's `marker` must be one of the list; absent fails), 427-431 (`chapter` and `verse` must be integers, `verse ≥ 1`), `src/lib/desk-export.mjs:725-732` and `desk-merge.mjs:143-155` (a trash record's own common fields are not checked: `labels`, `client`, `contentVersion`, `created` may be absent; only `id`, `kind`, `modified`, `deletedId`, `deletedAt` matter).

**What happens** BDR's Claude reads kind 2's `marker` as a field with named values and no default, writes a note without one for a note the app shows with no icon, and every such note is "left out" on the website with "It has a marker the notebook doesn't know." Kind 10's text says a trash record is "judged as its kind section says", and the section never says; a developer adds `labels: []` and `created` to every tombstone to be safe, or omits `deletedKind` thinking it optional (it is: `migrateRecord` fills it). A `chapter` written as a string (`"3"`) is refused as "out of range".

**Evidence** `stamps.mjs`, section C: `note without marker` → `marker "undefined" is not one of …`; `chapter as string '3'` → `chapter is out of range`; `trash record (validateRecord on it)` → `[]` with nothing checked. Audit 6's DI6-2 settled the required common fields of a *live* record; the marker, the integer rule and the trash record's own fields are not in that fix.

**Fix** Three sentences in the format: under kind 2, "`marker` is required; a client with no icon writes `note`"; under "Fields every record carries", "`chapter`, `verse`, `endVerse` and `n` are integers, `verse ≥ 1`"; under kind 10, "a trash record needs only `id`, `kind`, `modified`, `deletedId` and `deletedAt` to be read, and its `record`, when present, is checked as a live record".

**Confidence** High.

**Fixed (2026-11-09)** The three facts are in `STUDY-DESK-FORMAT.md`: `marker` is required (kind 2), `chapter`, `verse`, `endVerse` and `n` are integers ("Fields every record carries"), and what a trash record must carry to be read (kind 10). For BDR to read.

#### DI8-7 · Low · ui · NEW
A card being typed in keeps a stale header (planned minutes, Leader only) when another tab changes those, for as long as the part's text stays as it is.

**Where** `src/scripts/desk/sheets/sheet-editor.js:847-851` (`draw`: the `hasFocus` branch sets `card.json = now` without redrawing the head or calling `update`), 581 (`headKey`, compared only in the `update` branch at 841).

**What happens** Two tabs; the reader's cursor is in a question's text in tab A while, in tab B, they tick "Leader only" on that part or set its planned minutes. Tab A hears the change, `changedUnderReader` says the text didn't move (true: `TEXT_FIELDS` are `html` and `answer`), and the card's JSON is marked current. The head still shows the box unticked and no minutes; the planned-time line updates, the card doesn't. Since `card.json` now equals the module's JSON, no later `draw()` redraws the card until that module changes again, so the stale head outlives the focus. The next save from this card is planned over the store's copy, so no data is lost; the reader just can't see what the other tab did, and may tick Leader only a second time (a no-op) or wonder why the total says 10 minutes.

**Evidence** Read; not run in a browser. The branch at 847 updates `card.json` and nothing else; `draw()` at 840 skips a card whose `json` matches.

**Fix** In the `hasFocus` branch, when `card.head !== headKey(m)`, redraw the head's controls in place (`part-cards.js`'s header pieces take `cardHost`; a `setHead(m)` on the instance) and update `card.head`; keep the text as the reader has it.

**Confidence** Medium.

**Fixed (2026-11-09)** A focused card's header redraws in place (`setHead`) when another tab changes its minutes or Leader only.

#### DI8-8 · Low · usability · NEW
Two tabs opening the same sheet within 400 ms never ask each other, since a tab counts as editing only once its editor is drawn.

**Where** `src/scripts/desk/sheets/sheet-editor.js:1291` (`addEditor(() => (sheet && !draft ? sheet.id : null))`; `sheet` is set in `showSheet`, 676, which runs after the wait at 601-614), `src/lib/desk-sheet-tabs.mjs:23` (`ASK_WAIT_MS = 400`), `src/scripts/desk/sheets/sheet-tabs.js:54-68`.

**What happens** The reader middle-clicks a sheet's name twice from the Sheets list, or presses Edit in one tab and the pane's "Open on its own page" in another in quick succession (the second of those skips the question by design, so the first case is the real one). Both tabs send `who` while neither is showing the sheet; neither answers; both open the editor without the question BVJ decided on (2026-11-08). The design says "nothing is remembered between questions", which covers a crashed tab; this is two live tabs that miss each other.

**Evidence** Read. A tab's `showing()` is null until `setSheet(id); showSheet(record)` at 615-616, both after `await editedElsewhere(id)` at 601.

**Fix** Count a tab as "about to show" the sheet while it is asking: `addEditor`'s function returns `asking ?? sheet.id`, or `editingReply` answers a `who` for a sheet in `waiting` too (with the lower `tab` id yielding, so exactly one of the two asks). A test in `desk-sheet-tabs.test.js` for two simultaneous askers.

**Confidence** Medium.

**Fixed (2026-11-09)** A tab still asking answers a `who` about the same sheet with a `here` marked `asking`; of two tabs that heard each other, only the one with the larger id counts the answer, so exactly one shows the question. Tests: `test/desk-audit8-a-sheet-tabs.test.js`.

### Improvements

- `anchor-core.mjs`: 58 of 354,720 unchanged anchors (0.016%) raised a false notice (`changed` or `verse` though the words stand unmoved), nearly all one-word quotes whose eight characters of context were reworded; a note in the format that a false notice is the chosen side of the trade would save BDR asking.
- `desk-merge.mjs`: labels are unique by name per client (`findLabel`) but not across a merge; two devices that each made "Sermon prep" end with two labels of that name, listed twice. Worth a line in the format (fold by name? keep both?) before sync.
- `sheet-editor.js` title and subtitle: a rename in another tab while this tab's cursor is in the field is overwritten on blur with no "Changed in another tab" line (the conflict line covers parts only). Say so in `sheets/CLAUDE.md` or give the two inputs the same line.
- `export-import.js`: the import summary says "N kept as they are here (yours are newer)" for records dropped as "ahead" (DI8-1's case); "kept" is true but the reason given is not. `describeAhead`'s sentence appears beneath, so a reader can work it out; one wording ("yours are newer, or the file's are dated ahead") would be plainer.
- `store.js`: `writeNow` aborts every transaction still waiting on its read in this tab (`reading`), including a bookmark follower's or a second Sheets pane's; fine on `pagehide`, surprising if a second caller ever uses it. A comment naming that limit would do.

### Questions for the owner

1. DI8-2: may the website restamp `modified` and `client` on a record it otherwise can't edit when the reader restores or undoes its deletion? The format says such a record "comes back exactly as it was"; keeping that sentence means the restore cannot survive meeting the deletion again.
2. DI8-1: should a stamp ever step more than five minutes past the client's own clock? Bounding it changes the format's "Room for skew" bullet for BDR.
3. Labels made on two devices with one name: fold them at merge, or list both? **Decided (2026-11-10): merge (one label, joined where read).**

### What held up

- **Round trip**: all 26 records (every kind, trash, tombstone, unknown kind, newer schema, both renamed markers, an old ribbon, a stampless bookmark, a sheet with an unknown module) return canonically identical after `toBackupJson` → import into an empty notebook, allowing only `migrateRecord` and `cleanSheetText`; re-opening the same file writes nothing (22 "already here"); opening it over newer local copies keeps every local edit (8 "kept as they are here"); the Web Annotation file re-imports all 22 live records losslessly; Markdown edits come back as edits with the file's stamp, a new entry becomes a note, places and labels are not read back; `escapeBody`/`unescapeBody` are exact inverses on hashes, quotes, backslashes, CRLF and typed HTML; a BOM and CRLF are fine; a file saved by a clock set ahead is written at the cap and writes nothing when opened again.
- **Merge**: 3,000 histories without skew and 3,000 with 90 s skew: the live sets of three replicas converge in every run, in both exchange orders; a second exchange writes nothing; bookmarks always carry both stamps after a merge. Only the held copy of a bookmark in the trash can differ (DI8-3).
- **Anchors**: 461 changed revisions, 358,535 anchors: 0 `lost`, 0 silent `moved`, all 33 cross-verse moves carry the spec-4 notice, 0 changed words drawn silently in another verse. The 19 "unchanged words drawn elsewhere silently" are repeats inside one verse ("the house of" twice in Hebrews 8:8) where the LCS picked the other occurrence, and 4 single common words ("the", "from", "God", "our") the LCS matched to a far verse while the resolver kept them in their own: the resolver is right in all 23.
- **Sanitizer**: idempotent on 20,000 hostile inputs (script, svg, `javascript:` hrefs, unclosed tags, bad entities, surrogates); every output is accepted by `validateSheet` and left alone by `cleanSheetText`; `pastedSheetHtml` is already canonical on 3,000 inputs; 20 hand-written bad modules each refused with the right sentence; an unknown module's `html` is neither sanitized nor drawn anywhere (`modulesForCopy` keeps `MODULE_TYPES` only).
- **Store**: 20 interleaved edits from two stores to two parts of one sheet all keep (both parts end at 19); a plan with one uncloneable record aborts whole (0 notes stored); the trash-collapse, restore, undo and import plans all go through `planWrite`; `readonly-notebook.js` and `peekNotebook` never create the database (upgrade aborted).
- **Format against code**: common fields and the ISO rule (fraction optional, `+00:00` refused as written), kind 4's 40-character label and two stamps, `BOOKMARK_PLACE_FIELDS`, kind 9's limits and `isTemplate` (never shared), the participant share's drop list, kind 10's tombstone and collapse rule, the 1 MB ceiling, DI3-4's tombstone-on-bad-held-copy, the stamping rule as written, `merge-vectors.json` version 5, `anchor-vectors.json` spec 4, `sheet-text-golden.json` format 1. 733 unit tests pass.

### Not reached

- A real browser: quota exceeded, Safari's seven-day eviction, `pagehide` timing, BroadcastChannel delivery, the Duplicate-tab race.
- `undo-bar.js`, `notebook-search.js`, `desk-labels.mjs` beyond its name rule, `desk-anchor-dom.mjs` beyond its existing sweep, `api2-vectors.json` beyond its test, the share link's phone viewer, Web Annotation files made by other tools.

## Appendix B: Security, privacy, and trust boundaries (`SEC8`, Opus)

Slice: security, privacy, trust boundaries · Model: Claude Opus 5.5 · Commit `15986b6e` (branch `claude/desk-audit-8`) · 2026-11-09 · Ran: node fuzzers for the sheet sanitizer, the paste reader, `sheetHtmlForShow`, `noteBodyHtml`, the share decoder, the backup and Markdown import reader, and the six document writers (scripts in `scratchpad\audit8\sec8\`); a module-graph walk of all 354 pages in `dist/`; selected unit tests (`desk-sheet-phone`, `desk-gate-imports`, `desk-sheet-share`, `desk-inert`, `desk-chapter-address`: 40 pass). No browser, no dev server.

### Summary

The trust boundaries hold. I found no script injection. The sheet sanitizer builds its output from an allowlist and has its own serializer. It came through about 180,000 random and 65 hand-made hostile inputs, run through each of its three entry points: no tag, attribute, URL or comment came out that a spec HTML parser (parse5) reads as anything beyond the allowlist. Its output is idempotent through a browser round trip, and it stays linear on input up to 2.5 MB. The share decoder refused every truncated, oversized, malformed, zip-bomb and prototype-pollution share cleanly, in under 15 ms. The writers escape XML and RTF correctly, and their zip paths are fixed names. The gate holds across all 354 built pages: every desk import is dynamic and behind `data-desk="on"`, save the phone's import of the sheet viewer, which the design allows. What I did find is small:

- **Critical 0 · High 0 · Medium 0 · Low 3 · Nit 0**, plus improvements and owner questions.
- SEC8-1: two regexes in the notebook's Markdown import are quadratic, so a crafted "notebook copy" freezes the tab for minutes.
- SEC8-2: the Search pane brings a glossary entry from the fetched /glossary/ page into the page without `makeInert`, the one fetched-page import SEC3-2 missed.
- SEC8-3: "N more in your notebook" carries the reader's notebook search words to the server in `/notebook/?q=`.

### Findings

#### SEC8-1 · Low · security · NEW
**Opening a crafted Markdown "notebook copy" freezes the tab for minutes: two quadratic regexes in the import reader.**

- **Where**: `src/lib/desk-export.mjs:354` (`readEntries`, the heading pattern `/^##\s+(.*\S)\s*$/`) and `:414` (`savedAt`, `/<!--\s*lit-notebook\b([^\n]*?)-->/`). Both are reached from `parseImport` → `parseMarkdown`, which `export-import.js` runs when "Open a copy…" is chosen. The only size gate is `MAX_FILE_BYTES` = 50 MB.
- **What happens**: someone sends a reader a `.md` file that looks like a notebook copy. It holds `<!-- lit-notebook -->` and then either a heading line of `##` followed by a long run of spaces with nothing after it (the `\s+` and `.*\S` trade characters back and forth), or the opener `<!-- lit-notebook` repeated on one line with no `-->` (the lazy `[^\n]*?` scans to the end of the line from every opener). The reader chooses Open a copy, and the page hangs before it can show its summary. Nothing is written, since the plan never finishes. The reader loses the tab, and any unsaved typing in it if the hang outlasts their patience.
- **Evidence**: `sec8\fuzz-import2.mjs`, `fuzz-import3.mjs` and `fuzz-import4.mjs`. A heading of spaces took 9 ms at 5,000, 130 ms at 20,000, 527 ms at 40,000, 2,137 ms at 80,000 and 11,304 ms at 160,000. The regex alone took 10,344 ms at 160,000 spaces. The repeated opener took 1,306 ms at 20,000 (340 KB) and 7,202 ms at 40,000 (680 KB). Both curves are quadratic, so a file of a few MB runs for minutes, well inside the 50 MB gate. The `.lit-sheet.md` reader (`fragmentInFile`) and the ID comment pattern are linear: 4 ms and 1 ms on the same shapes.
- **Fix**: for the heading, match `/^##[ \t]+(.*)$/` and trim in code, rejecting an empty title. For `savedAt`, read only the first line holding the opener: find it with `indexOf("<!--")` and a bounded slice, or use `/<!--[ \t]*lit-notebook\b([^\n]{0,500}?)-->/`. Add both shapes to the import tests with a time bound, as BA87's test does for the share file.
- **Confidence**: High (reproduced in node; V8's regex engine is the browser's in Chrome).

**Fixed (2026-11-09)** The heading pattern is linear (`/^##\s+(.*)$/`, trimmed in code), `savedAt`'s opener is bounded to 500 characters, and `parseReference`, also quadratic on a run of spaces, collapses whitespace first. Tests: 100 KB hostile lines, each under a second, in `test/desk-audit8-e-verse.test.js`.

#### SEC8-2 · Low · security · REGRESSION SEC3-2 (incomplete)
**The Search pane brings a glossary entry into the page without `makeInert`, the one fetched-page import the SEC3-2 scrub doesn't cover.**

- **Where**: `src/scripts/desk/search-pane.js:144-151` (`loadGlossary`: fetch `/glossary/`, then `DOMParser`) and `:915` (`openEntry`: `document.importNode(source, true)` into `entryBox`). It removes only `.entry-link`, `.sr-only[aria-hidden]` and ids.
- **What happens**: today nothing, because the glossary is the owner's own built content. Its 47 entries hold only `a, article, details, div, em, g, h2, h3, header, li, p, path, rect, span, strong, summary, svg, ul`, with no `on*` attributes (checked in `dist/glossary/index.html`). But the desk's rule (`src/scripts/desk/CLAUDE.md`, rule 18: "a new fetch of a site page goes through it before anything is imported") exists so that no pane depends on what a built page happens to hold. Suppose a glossary entry later gains an image, an embed, or Markdown with raw HTML. Its copy on /desk would then load and run it in the desk's document, beside the reader's notebook, while the chapter and intro panes would scrub the same thing.
- **Evidence**: `grep -n makeInert src/scripts/desk/*.js` finds it only in `chapter-page.js:52` and `intro-pane.js:70`. Every other `DOMParser` and `importNode` path goes through one of those two. Audit 2's sink table rated this path "Safe" before the rule existed, and the SEC3-2 fix didn't add it.
- **Fix**: `const clone = makeInert(document.importNode(source, true));` (or scrub each entry once in `loadGlossary`), plus a line in `test/desk-inert.test.js` or `desk-search-pane.test.js` holding that every `DOMParser` user in `src/scripts/desk/` imports `makeInert`.
- **Confidence**: High (code read; no exploit today, so Low).

**Fixed (2026-11-09)** The Search pane's glossary entry goes through `makeInert`, and a malformed `#%` link decodes safely. Test: `test/desk-audit8-c-search-and-pages.test.js`.

#### SEC8-3 · Low · privacy · NEW
**"N more in your notebook" sends the reader's notebook search words to the server in the address.**

- **Where**: `src/lib/desk-search.mjs:242-245` (`notebookSearchHref`: `/notebook/?q=<words>`), used by the search tray's notebook group (`src/scripts/desk/notebook-search.js:292`). `notebook-page.js:426-431` strips `q` after load (SEC4-1).
- **What happens**: a reader searches their notebook from the header's search tray for words they would rather keep private, say a name in a prayer note, and chooses "12 more in your notebook." The browser requests `https://litbible.net/notebook/?q=<those words>`, so the words reach Cloudflare's request logs, along with anything else that records full request URLs, before the page strips them. SEC4-1's record says "Nothing leaves the device, so this is tidiness, not exposure." The history entry is fixed, but the request still carries the words. Audit 2 listed "the deployed beacon's payload on /notebook/?q=" as not reached, Q3.
- **Evidence**: code read. This is how a GET with a query string works. It matches what `/search/?q=` already does for ordinary site search, which is why this is Low. But the desk's own promise (`/privacy`: "nothing about them is sent to the LIT Bible team or anywhere else") is about the notebook, and these are searches of it.
- **Fix**: carry the words in the fragment (`/notebook/#q=…`; `notebook-page.js` reads `location.hash` and strips it the same way) or in `sessionStorage`, so they never form part of a request. Keep `?q=` readable for one release for old links.
- **Confidence**: High for the request; Medium for what Cloudflare keeps (not checked against the dashboard).

**Fixed (2026-11-09)** `notebookSearchHref` returns `/notebook/#q=…`, so the words ride in the fragment; `/notebook` reads the fragment (and still an old `?q=`), strips both, and listens for `hashchange`. Tests: `test/desk-search.test.js`.

### Sink table

Each sink, what reaches it, and why it is safe. Static or constant-only `innerHTML` (icons, glyphs from `PATHS` via `Object.hasOwn`, fixed form markup with numeric ids) is grouped in one row.

| Sink | Where | Input | Verdict |
|---|---|---|---|
| `innerHTML` of a sheet's text | `part-cards.js:208`, `sheet-copy.js:47` | stored, imported or shared `html` | Safe: `sheetHtmlForShow` = sanitize → note-mode linker → `openExternalLinks`; fuzzed (no foreign tag or attribute, every external link gets `target`/`rel`) |
| editor load | `sheet-text.js:273` | `canon(html)` = `sanitizeSheetHtml` | Safe |
| `execCommand("insertHTML")`, paste and drop | `sheet-text.js:1148` | clipboard or drag `text/html`, else `text/plain` | Safe: `pastedSheetHtml` or `plainToHtml` → sanitizer; files refused; a drag from the sheet's own editor is native, but its source is already canonical |
| `execCommand("insertHTML")` and `createLink`, link form | `sheet-text.js:682-688` | typed address | Safe: `normalizeAddress` allows only http(s), mailto, a bare email, a host name and `/path`; `escAttr`/`escText`; stored form re-sanitized (`cleanHref`) |
| note body | `note-words.js:28` | note `body` (imported, synced) | Safe: `noteBodyHtml` escapes `& < > "`, then links; 100,000 fuzz cases gave only `a` with site, Sefaria or eBible URLs |
| Greek readback | `greek-find.js:274`, `search-pane.js:1071` (also `searchbar.js`, `search.js`) | typed query, index data | Safe: every user or data string goes through `text: escapeHtml` or `greek()`; phrase words come from fixed tables |
| verse hits | `search-pane.js:743` | `verses.json` | Safe: `highlightVerseHit` escapes |
| lexicon entry | `tab-greek.js:97` | `public/greek/` HTML | Safe: parsed in an inert `<template>`, rebuilt from b, i, br, `span.lex-ref` and `abbr[title]` |
| print excerpt | `print-part.js:170` | selection's marked text | Safe: `handoutHtml` escapes `& < >` and then swaps private-use markers |
| QR | `sheet-copy.js:354`, `sheet-page.js:963` | chapter code URL, share link | Safe: `qrSvg` escapes its title; URLs from `chapterCodes` (validated book keys) |
| credits | `greek-find.js:86`, `search-pane.js:1017` | constants | Safe |
| `importNode` of fetched pages | `chapter-page.js`, `intro-pane.js` → `lit-pane.js:267`, `sheet-lit.js:224`, `sheet-copy.js:204,253`, `intro-text.js:21` | same-origin built pages, addresses from `chapterPath`/`introPath` | Safe: `makeInert` |
| `importNode`, glossary | `search-pane.js:915` | `/glossary/` | **SEC8-2** (no scrub) |
| constant markup | `bookmark-form`, `export-import`, `kept-list`, `labels-ui`, `note-editor` (record text escaped), `notebook-page`, `panel`, `passage-bar`, `tab-*`, `tour-runner`, `undo-bar`, `desk-page`, `note-settings`, `notes-margin` (`whereOf`/`ref` escaped, `flagText` constant), `footnote-notes`, `change-notice` | constants, numbers, escaped references | Safe |
| `href` setters | 60 sites (`grep "\.href = "`) | record ids through `encodeURIComponent`; chapters through `chapterPath`; glossary ids from the page's data | Safe |
| `window.open` | `sheet-present.js:634` | `sheetUrl(id, "presenter")`, same origin | Safe |
| BroadcastChannel (5 channels) | `store.js`, `bookmark-follow.js`, `first-stage.js`, `sheet-tabs.js`, `sheet-present.js` | same-origin tabs only | Safe: present messages are checked by `presentMessage`/`checkState`; none reaches markup |
| writers | `desk-doc-docx/odt/rtf`, `desk-slides-pptx/odp`, `desk-zip` | sheet text and links | Safe: `xmlEscape` (drops XML-illegal characters and lone surrogates), `rtfEscape`, `docHref` (http(s) and mailto only, normalized); fixed zip names; fuzzed for well-formedness |
| clipboard | Copy for Word (`docHtml`), share link, Greek copy | sheet model | Safe: `docHtml` escapes; plain text may carry a NUL from hostile text (harmless) |
| `.md` exports | `escapeBody`, `markdownLine` | reader's words | Safe for HTML; Markdown link syntax `[x](url)` is not escaped (see Improvements) |

### Improvements

- **Add `blob:` to the report-only `img-src`** (`public/_headers:34`). KNOWN-OPEN since Audit 3 (Improvements) and Audit 6. `printSlides` still draws its codes as `blob:` images (`sheet-slides.js:297`), so every slides PDF logs a report, and an enforced policy would drop them. Everything else the desk does fits the policy as written: `<style>` from `?inline` is covered by `'unsafe-inline'`, `data:` is in `img-src`, downloads navigate to `blob:` (outside `img-src`), it uses no workers, and its only `window.open` is same-origin.
- **A crafted link can rewrite the saved desk layout.** `/desk/?place=`, `?intro=` and `?sheet=` move panes and `save()` (`desk-page.js:1193-1250`), so a link in a shared sheet or a chat changes what the reader's /desk opens with next time. It is a nuisance only, and by design for the site's own links. Consider leaving the saved layout alone for an arrival whose `document.referrer` isn't this origin.
- **The phone viewer is about 113 KB gzipped** (`sheet-page.js` and its 17 static dependencies, 391 KB raw, including `store.js`, `boot.js`, `notebook-tab.js` and the 161 KB shared `desk` lib chunk). The design allows this, and nothing runs at import (checked: no top-level side effects in the closure, and `openStore` is called only in `start()`). A separate viewer entry would let a phone skip the store and the editor helpers.
- **Escape `[` and `]` in `markdownLine` and `escapeBody`.** A sheet or note holding `[text](https://…)` becomes a live link in a Markdown viewer (GitHub, Obsidian, VS Code). The author typed it, so this is fidelity rather than safety. But a share imported from a stranger and then re-shared as a file carries the stranger's link in the readable half.
- **The 404 page could drop a `#share1.` fragment the way `/sheets/` does.** A share link whose path an email client mangles (`/Sheets/`, `/sheets/%23share1…`) lands on 404 with the sheet still in the address while the analytics beacon runs. Confidence Low: I didn't check what the beacon reads, and in the `%23` case the data is in the path and reaches the server anyway.

### Questions for the owner

1. **The Share dialog starts on "Everything, for another leader"** (`sheet-page.js:905`, `let scope = "leader"`), while its own note says "send the participant’s version when you’re unsure." A leader who opens Share… and presses Copy link sends the answers, Leader only parts, planned minutes and prompts to whoever gets the link (STUDY-DESK.md, "Share… asks what to share", records the two choices but not the default). Should the default be the participant's version, so that the unsure case is the default case?
2. **`?desk=off` leaves the notebook and its settings in place**: it removes only `lit-desk-preview` and `lit-desk-panel` (`Layout.astro:129`), and the IndexedDB `lit-desk` database and about 30 `lit-desk-*` keys stay. That matches "a preview switch" and `/privacy` says how to remove everything. Confirming that off means hidden, not erased, so the help page can say so if it doesn't already.

### What held up

- **Sheet sanitizer** (`desk-sheet-format.mjs`). It is built from an allowlist, with its own escaping (text `& < >`, attributes add `"`); `href` is http, https, mailto or a single-slash path, judged after removing `\x00-\x20` and `\x7f`. I ran 60,000 random token strings × 3 entry points plus hostile cases: mXSS shapes (svg/math/noscript/style/template/select/textarea/title), comments (`--!>`, unclosed), CDATA, processing instructions, entity-encoded and control-split `javascript:`, `//` and `/\` and `/\t/` hosts, `https:\\`, userinfo tricks, attribute-quote breakouts, nested `a`, 5,000-deep spans, 500-deep `em`. Zero problems: no foreign tag, attribute or comment once parse5 re-parses the output; every href safe; idempotent; stable through a parse5 serialize round trip; every external link from `sheetHtmlForShow` carries `target`. Time stays linear (2.5 MB of entities in 113 ms; 1 MB of nested `div` in 94 ms). `fuzz-sanitizer.mjs`.
- **Share decoder** (`desk-sheet-share.mjs`). Results for truncated (`damaged`), bad base64, percent-encoded, empty, 3 MB fragment (12 ms), 50 MB-of-zeros zip bomb (`too-large` in 5 ms), padding bomb, invalid UTF-8, deep JSON (100k), deep value inside a module (1 MB cap), `sheetFormat` 2, 1.5 and "1", `__proto__` at top level and in a module (no pollution), `constructor` and `/evil.example/x` book keys, 301 modules, title of 10k characters, 600 KB html (512 KB cap), and hostile `prompt`, `leaderOnly`, `minutes` and `omit`: all refused with the right code. `fragmentInFile` and `markdownLine`/`plainText` are linear on the crafted shapes. `fuzz-share.mjs`.
- **Fragment privacy**: the inline script in `sheets.astro` runs before any module script and before the beacon, also on `popstate` and `hashchange`. The pre-paint `?desk=on` strip keeps the hash for it. The gate's "turn the preview on" link and Copy link rebuild the URL from `history.state`. The share link is never in a `Referer`. `/sheets/`, `/desk/` and `/notebook/` load no third-party resources (checked in `dist/`).
- **The gate**: I walked the static import graph and the dynamic edges of all 354 `dist/**/index.html`. Every reading page's static closure holds only `desk-frame.js` of the desk. The dynamic edges to `first-stage`, `notebook-page`, `desk-page`, `sheet-page`, `notebook-search` and `search-sheet` all sit behind `dataset.desk === "on"`; `search-greek`, `greek-search` and `greek-commands` sit behind the Greek gate or a press. No desk CSS is in any page stylesheet (`desk-pane`, `desk-sheet`, `desk-rich` and `sheet-copy` appear only in `sheets.css`, the /sheets page's own). On a phone, `sheet-share-gate.js` makes the one dynamic import, and `sheet-page.js` starts the desk only with the stamp. `graph.mjs`, `graph2.mjs`.
- **Writers**: hostile title, subtitle, text, links (`"><evil/>`, `{}`, `\`), NUL, U+FFFE and U+FFFF, lone surrogates, `]]>`, `<!--`, RTF control words. Every XML part of .docx, .odt, .pptx and .odp is well-formed with the hostile text escaped (16 to 36 escaped occurrences each). RTF braces balance and the output is ASCII. Hyperlink targets are `docHref`-normalized and percent-encoded in RTF fields. No author or device metadata goes into the files. `fuzz-writers.mjs`.
- **Backup import**: the JSON path (100,000 records in 71 ms; deep JSON refused), the 50 MB size gate before `text()`, and the share file's 4 MB gate before `text()`. A Markdown `lit:id=__proto__` or `constructor` id gets fresh UUIDs. `escapeBody` stops a note line from forging a heading, an ID comment or the end marker.
- **Fetched data**: the release feed, `version.json`, Greek text, lexicon, bridge, offers and verse index are all same-origin, and each reaches the page through text nodes or an escaping helper (see the sink table).
- **Links leaving the desk**: every external anchor in the built `/desk/`, `/desk/help/`, `/notebook/` and `/sheets/` has `target="_blank"` and `rel="noopener noreferrer"`, and so does every runtime-built one (`awayTab`, `externalLink`, `intro-text.js`, the credits). The global `Referrer-Policy` is `strict-origin-when-cross-origin`.
- **URL parameters**: `place`, `sheet`, `intro`, `greek`, `print` (one-time mark, SEC-4), `desk-tour`, `sheet-tour`, `new` and `q` are each stripped after use; `id`, `view` and `from` need an unguessable UUID to reach anything of the reader's.
- **Present mode**: same-origin windows only, messages validated, nothing from a message reaches markup; the screen-details permission is asked only on a press.

### Not reached

- What Cloudflare Web Analytics actually sends for `/notebook/?q=` and for a 404 carrying a `#share1.` fragment (needs the live beacon; Audit 2 Q3 is still open).
- A browser check that Chrome and Firefox treat `insertHTML` of the canonical form as the model does (the parse5 round trip stands in for it).
- Timing `planImport` and the merge on a hostile 50 MB backup of many small records that collide with local ids (only parsing was timed).
- `sheet-tabs.js` and `bookmark-follow.js` channel messages, read for sinks only, not fuzzed for logic.

## Appendix C: The Sheets code (`SH8`, Opus)

Slice: `src/scripts/desk/sheets/` (all 22 modules), `src/lib/desk-sheet*.mjs`, `desk-sheets.mjs`, `desk-present.mjs`, the writers (`desk-doc-*.mjs`, `desk-slides*.mjs`, `desk-zip.mjs`), `sheet-share-gate.js`, `src/pages/sheets.astro`, the sheet parts of `desk.css`, and `src/scripts/desk/sheets/CLAUDE.md` (read whole). Model: Claude Opus 5.5. Commit `15986b6e` (checkout `.claude/worktrees/desk-audit-8`). Date 2026-11-09.
Ran: `node --test` on every Sheets test (`desk-sheet*`, `desk-slides`, `desk-present`, `docx-zip`: 692 pass, 0 fail); `sh8/fuzz-writers.mjs` (all six writers on empty, awkward and 25x-repeated sheets, every zip unzipped and every XML part parsed by Python's expat via `sh8/checkxml.py`); `sh8/fuzz-sanitize.mjs` (40,000 random HTML trees through `sanitizeSheetHtml` and `pastedSheetHtml`: idempotence and safety); `sh8/fuzz-share.mjs` (share link and `.md` round trips by scope, 300 parts, 12 crafted hostile shares, a 50 MB deflate bomb, malformed fragments, ReDoS timing); `sh8/slides-long.mjs` (slide cutting on very long text). Scripts are in `...\scratchpad\audit8\sh8\`.

### Summary

The Sheets are in good shape where they are pure: every file writer produced well-formed output on hostile input (2,154 XML parts, 0 bad; RTF balanced and 7-bit), the sanitizer held idempotent and safe over 40,000 random trees, and share links refuse every crafted or oversized payload I tried while keeping answers, Leader only parts, prompts and minutes out of a participant share. The weak spots are in the newest client code, where state is shared between views and tabs: the /sheets list (E64) rebuilds itself from scratch on every sheet save made anywhere, and the two-tab "Keep mine" writes back fields the reader never typed in. Two older patterns have drifted: adding passages from search writes around the editor's placement and canonical-form rules, and a card that saves its own change keeps its build-time state. No Critical or High findings.

Counts: Critical 0 · High 0 · Medium 2 · Low 5 · Nit 1.

### Findings

#### SH8-1 · Medium · usability · NEW
**The /sheets list is torn down and rebuilt on every sheet save anywhere, so it jumps to the top, closes "New sheet…", and drops focus.**

**Where** `src/scripts/desk/sheets/sheet-page.js:349–358` (`showList`, its `store.subscribe(..., { kinds: ["sheet"] })`), and `:263` (`root.replaceChildren(h1)` before `await store.all()` and `await import("./sheet-page-list.js")`).

**What happens** A leader has /sheets open in one tab and edits a sheet on /desk (or in /sheets' editor) in another. Every autosave there (400 ms after each pause in typing, `SAVE_DELAY` in `sheet-text.js:43`) notifies the list tab, which calls `redraw` → `showList`. That first empties the page to its `<h1>`, waits on IndexedDB and a dynamic import, then rebuilds. In the gap the page is one line tall, so a scrolled list jumps to the top. The "New sheet…" chooser the reader had open is gone, as is any "Import a Study Desk file" status message. Focus is kept only when it was on a row (`data-focus-key`): on "Import a Study Desk file", "Take the Sheets tour", a template in the open chooser, or the intro's desk link, `keyed` is null, the focused element is removed, and focus falls to `<body>`. The list also re-reads every record and re-imports the rows module on each save, though nothing the list shows changes when a part's text does (only the title, subtitle, passage count, or the day in "changed …" can).

**Evidence** Read `showList` and the subscription; `store.js:166–172` notifies "other-tab" changes to filtered listeners; E64's entry (STUDY-DESK-FIXES.md, "The list now redraws when a sheet changes elsewhere … keeping focus on the row it was on") intends the redraw, not these side effects.

**Fix** Build the new list off-page and swap it in only when what the rows show differs (the sorted ids, names, subtitles, passage counts, and day words), keeping the chooser and the status rows in place. Failing that, at least don't empty `root` before the awaits, and keep focus on any control that survives by a key of its own (give the import button, the tour button and the chooser's items `data-focus-key`).

**Confidence** High for focus, chooser and status loss (read directly); Medium for the scroll jump (it depends on the browser painting between the empty state and the rebuild, which an IndexedDB round trip makes likely).

**Fixed (2026-11-09)** The /sheets list rebuilds its rows alone, off the page, and swaps them in only when they changed; the chooser, status lines, scroll and focus outside the rows stay, and each row button has its own focus key (focus goes to the h1 if its row is gone). Also LV8-1. Tests: `test/desk-audit8-a-sheets-list.test.js`.

#### SH8-2 · Medium · data-integrity · NEW
**"Keep mine" on a two-tab conflict writes every field of the card, reverting the other tab's change to a field the reader never touched.**

**Where** `src/scripts/desk/sheets/sheet-editor.js:944–949` (`showConflict`, the Keep handler: `fields().map(([f, ed]) => [f, ed.take()])`), with `changedUnderReader` and `TEXT_FIELDS = ["html", "answer"]` in `src/lib/desk-sheet-tabs.mjs:269–281`.

**What happens** Tab A is typing in Question 2's question. Tab B edits only Question 2's answer. A's card keeps focus, so `draw()` doesn't redraw it, and the line "Changed in another tab." appears (the answer differs). If A presses "Keep mine", the write puts A's text for both fields: the question as typed, and the answer as A's answer editor still shows it, which is the old answer from before B's edit. B's answer is silently reverted. Ignoring the line is safer than pressing "Keep mine", because A's own typing saves only the field typed in (`textField`'s `onChange`, `part-cards.js:172`). Separately, the answer editor in A goes on showing the stale answer after focus leaves the card: the card's own save sets `card.json` to the stored module (`sheet-editor.js:379–383`), so the next `draw()` sees no difference and never reloads that editor. A later edit to the answer in A then also overwrites B's.

**Evidence** Traced: `textField` saves only `{ [field]: html }`. `take()` returns `canon(editable.innerHTML)` for an untouched editor too (`sheet-text.js:1234–1240`), and Keep writes all of `card.inst.fields`. Overlaps DI8's two-tab slice; reported here because the cause is in the editor's conflict line.

**Fix** Keep mine should write only the fields this card changed since it was drawn (compare each editor's `take()` with the field's value in `card.json` as drawn), and load the other fields with the stored version (`setHtml`, which is safe while that editor lacks focus). Better still, compare per field in `changedUnderReader` and put the line only on the field that moved.

**Confidence** High.

**Fixed (2026-11-09)** Fields are handled one by one (`movedUnderReader`): a moved field the reader isn't in loads the other tab's text at once, and only the field being typed in gets the line; "Keep mine" writes only the fields that differ (`keptFields`). Tests: `test/desk-audit8-a-sheet-tabs.test.js`.

#### SH8-3 · Low · bug · NEW
**Passages gathered from /search (and /desk's Search pane) into an existing sheet are appended after its last part, around the editor's placement rule and its canonical-form rewrite.**

**Where** `src/scripts/desk/sheets/search-sheet.js:391–395` (`gather`: `addModule(sheet, …, undefined, …)` on the record read in the transaction, then `planSave`), and its twin at `src/scripts/desk/search-pane.js:807` (DK8's file). Compare `src/lib/desk-sheet-add.mjs:41–46` (`planAddToSheet`: `planSheetChange` and `passageInsertIndex`).

**What happens** A leader makes a sheet from the "Bible study" template, then on /search chooses "add them to one of your sheets". The passages land after "Closing" rather than under "Reading" (or after the sheet's last passage), which is what BA69/SH5-3 fixed for the editor and what "Add to sheet ▸" on a chapter page does. Because the write skips `planSheetChange`, it also skips `cleanSheetText` (DI3-6): if a future sanitizer change ever leaves a stored sheet's text out of today's canonical form, `planSave`'s check refuses the whole gather ("The sheet couldn’t be saved"), where every other way of changing a sheet would rewrite it once. Three places now add passages to a stored sheet, and only one follows the rules.

**Evidence** Read all three writes.

**Fix** Give `desk-sheet-add.mjs` (or `desk-sheets.mjs`) one `planAddPassages(current, passages, ctx)` that runs through `planSheetChange` and places the run at `passageInsertIndex`, and call it from `sheet-add.js`, `search-sheet.js` and `search-pane.js`. (For the Search pane, the target editor's "part last worked in" is another option; the owner may prefer the same rule as a chapter page.)

**Confidence** High that placement and the rewrite differ; the size of the usability cost depends on how often leaders gather into a template sheet.

**Fixed (2026-11-09)** Both gathers add through `planAddPassages` (`desk-sheet-add.mjs`): over the sheet's canonical form, each passage where `passageInsertIndex` puts it. Tests: `test/desk-sheet-add.test.js`.

#### SH8-4 · Low · bug · NEW
**A card that saves its own change keeps its build-time state: a stale minutes value, a stale lines preview, and a stale header key that later rebuilds the card and drops focus.**

**Where** `src/scripts/desk/sheets/sheet-editor.js:379–384` (in `change`, a `source` save updates `card.json` only) with `:841` (`card.head === headKey(m)`); `src/scripts/desk/sheets/part-cards.js:53–60` (`cardTools`, minutes: the revert uses the closure's `m.minutes`); `part-cards.js:249–255` (`spaceCard`: `--lines` set once from `m.lines`).

**What happens**
- Minutes: set a part's minutes from 5 to 10 (saved; the card isn't rebuilt because it is the source). Then type 0 or 999: the field reverts to 5, though 10 is stored and the planned-time total says so.
- Space to write: change Lines from 4 to 2. The ruled preview under it still draws 4 lines (and stays so until the sheet is reopened), since `--lines` is set only at build.
- Header key: after a passage's minutes or Leader only change, `card.head` still holds the old key. The next change to that passage from anywhere (making a blank with the word cursor or the button, a footnote choice) fails `card.head === headKey(m)`, so `draw()` destroys and rebuilds the card instead of updating it in place. That drops focus to the page (the word cursor and the "Blank the selected words" button are not `input[type=text]`, so `hasFocus` is false) and closes the footnotes list. A keyboard user blanking words loses their place once.

**Evidence** Read the code paths above. `typing()` is `sheet-lit.js:825`.

**Fix** In `change`, where a `source` save sets `card.json`, also set `card.head = headKey(m)`; read the current module (`host.sheet()`) in `cardTools`' revert rather than the closure's `m`; update `--lines` in `linesField`'s change handler (or give the space card an `update`).

**Confidence** High.

**Fixed (2026-11-09)** `card.head` follows the card's own saves, the minutes field reverts to the stored value, and the lines preview follows the field.

#### SH8-5 · Low · bug · NEW
**Delete in a sheets list has no error handling: a failed delete is an unhandled rejection and the click appears to do nothing.**

**Where** `src/scripts/desk/sheets/my-sheets.js:247–255` (`removeRow`: `await host.store.remove(record.id)` with no `try`), reached from both the Sheets pane's list and /sheets' (E64).

**What happens** Where the store refuses the write (storage blocked mid-visit, a quota error, the database closed by a version change in another tab), the promise rejects out of the click handler: nothing is said, the list isn't redrawn, and the reader may press Delete again. Duplicate and Save as template beside it both catch and report through `listProblem`.

**Evidence** Read `removeRow` against `duplicate` and `saveAsTemplate` in the same file.

**Fix** Wrap the remove like its siblings: `listProblem(host, "The sheet couldn’t be deleted in this browser. Try again in a moment.")`, and disable the button while it runs, so a double press can't send two deletes.

**Confidence** High.

**Fixed (2026-11-09)** A failed delete shows the list's problem line, and Delete is busy while it runs.

#### SH8-6 · Low · a11y · NEW
**The presenter view disables its focused button at the ends, dropping focus to the page (BA79's guard exists only on the stage).**

**Where** `src/scripts/desk/sheets/sheet-present.js:882–887` (`showPresenterView`'s `draw`: `prev.disabled`, `next.disabled`, `reveal.disabled`, `hide.disabled`, `reveal.hidden`, `notes.hidden`). Compare `:471–477` in `openPresentation`, which moves focus to the stage first.

**What happens** In the presenter view, pressing "Next ›" onto the last screen, or "Reveal" onto the last blank, disables the button under focus. Focus falls to `<body>`. The keys still work (they are heard on `document`), but a screen-reader or keyboard user's place is lost and the next Tab starts from the top of the window.

**Evidence** Read both draws.

**Fix** As on the stage: before disabling or hiding a control that has focus, move focus to a control that stays (the controls toolbar's first enabled button, or a focusable `where` heading).

**Confidence** High.

**Fixed (2026-11-09)** With XA8-9: the presenter view's `draw` moves focus to Blank before it disables or hides the focused control, as the stage's BA79 guard does. Test: `test/desk-audit8-b-writers.test.js`.

#### SH8-7 · Low · data-integrity · NEW
**A title or subtitle renamed in another tab while this tab's field has focus stays stale after blur, and this tab's next keystroke there puts the old title back.**

**Where** `src/scripts/desk/sheets/sheet-editor.js:828–829` (`draw` skips the focused input) and `:764–780` (the inputs' save).

**What happens** The field is skipped while focused, which is right, but nothing redraws it on blur. Unlike a text part (SH8-2's line), there is no "Changed in another tab." here. One more letter typed later saves the stale title plus that letter over the other tab's rename. This overlaps DI8; it is noted because the fix is in the editor.

**Fix** On the inputs' `blur` with no pending timer, set `input.value = sheet[field]`; or show the same conflict line for the title.

**Confidence** High.

**Fixed (2026-11-09)** On blur, the title and subtitle show the stored value once saves land.

#### SH8-8 · Nit · longevity · NEW
**Three small loose ends.**
- `sheet-editor.js:197–200`: the editor's `say` writes its live region in `requestAnimationFrame`, which never fires in a hidden tab. `undo-bar.js:118` uses a timeout for exactly this reason.
- `sheets-page--editing` is added and removed (`sheet-page-edit.js:63, 70`; `sheet-page.js:1247, 1257, 1299`), but no stylesheet or test reads it.
- `sheet-tabs.js:192–205`: two editors in one tab asking about the same sheet at once (a /desk layout restoring two Sheets panes on one sheet) overwrite each other's `waiting` entry. Only the second hears an answer, so one pane asks and the other opens unasked.

**Confidence** High (each read directly).

**Fixed (2026-11-09, 2026-11-10)** `say` waits 50 ms with a timeout instead of a frame, and two editors in one tab asking about one sheet share one question. `sheets-page--editing`, which nothing read, is gone from `sheet-page-edit.js` and `sheet-page.js` (2026-11-10).

### Improvements

- Mark right-to-left runs other than Hebrew (Arabic, Syriac, which a leader may type in their own text) as RTL in the .docx/.odt/.rtf/.pptx writers; `scriptSegments` knows only Hebrew and Greek (`desk-sheet-doc.mjs:273–296`).
- A single unbreakable token longer than a slide (a pasted URL of 2,000 characters) stays one overflowing slide (`slides-long.mjs`: a 2,020-character slide against `SLIDE_CHARS` 560). A hard cut at `max` for a sentence-less run would bound it.
- When `planSheetChange` returns `gone` because another tab upgraded the sheet to a newer format, the editor goes to the list with no sentence (`sheet-editor.js:358–361`), and words still being typed are dropped. A line saying why would help.
- The /sheets list's subscription could ask only for changes to the fields it draws (see SH8-1), saving a full `store.all()` per keystroke-pause in another tab.

### Questions for the owner

- **Share… on a phone forwards the link as it came** (`sharePhone`, `sheet-page.js:826–842`; CLAUDE.md rule 21, NB6-8). A leader who opens their own leader link on a phone and shares it to the group sends every answer and Leader only part, with no choice of the participant version. The data to make a participant link is in hand (`shareFragment(sheet, { scope: "participant" })` runs on a phone). Should the phone ask which version to send when the link is a leader one?
- **Slides saved from the participant version still reveal every blank on the next slide** (BVJ, 2026-11-07; the slides are the room's). That is recorded as deliberate. I flag it only in case leaders hand out the participant .pptx as a study copy, not just project it.

### What held up

- **File writers**: .docx, .odt, .rtf, .pptx, .odp and the .md file, run on an empty sheet, one with every block type, and 25x repetitions holding markup characters (`<`, `&`, `]]>`, quotes), C0 controls, U+FFFE/U+FFFF, lone surrogates, pointed Hebrew with cantillation, polytonic Greek, an RLO override, ZWJ emoji, U+2028/2029/0085, `{\rtf1}`, entity look-alikes and a 5,000-character word. Every zip unzipped, all 2,154 XML parts parsed under expat, and the RTF was balanced and pure 7-bit with no control characters. The 682-slide .pptx was written in about 1.2 s.
- **Sanitizer**: `sanitizeSheetHtml` and `pastedSheetHtml` were idempotent and emitted nothing unsafe (no script, style, img, svg, iframe, event handlers, `javascript:` or `//` links) over 40,000 random trees; `sheetHtmlForShow` never threw. Every client `innerHTML` sink in the folder goes through `sheetHtmlForShow`, constant SVG, or `qrSvg` (which escapes its title).
- **Sharing**: participant shares and their `.md` file carry no answers, Leader only parts, prompts, minutes or `verseCopy`, and a leader share carries all but `verseCopy`. A crafted `__proto__`/`toString` module type, script and `javascript:` HTML, a hostile `bookKey`, a 100,000-character title, a newer `sheetFormat`, duplicate module ids, an HTML prompt, malformed base64, and a 50 MB deflate bomb (refused in 5 ms) were all handled. `fragmentInFile` and `plainText` stayed linear (8 ms on 400–800 KB adversarial input). A 300-part sheet round-trips, and the 301st is refused by `addModule`, `planAddToSheet` and `addMenuSheets`.
- **Leader only and ghost prompts**: nothing in copy, files, slides, the room's screen, the `.md` file or a participant share reads `prompt`/`answerPrompt` or the editor's `data-hint`; `modulesForCopy`, `presentScreens`, `roomCodes` and the slides' notes all drop Leader only parts from the room and the participant version.
- **Present**: `checkState`/`presentMessage` reject or clamp foreign messages; the stage removes every listener in `finish` and closes its channel on `pagehide`; Escape yields to full screen; a step while blank only un-blanks.
- **Lifetimes**: `createSheetEditor.destroy` removes its store subscription, the tab-editing counter, and its `visibilitychange`, `pageshow` and `pagehide` listeners, and destroys every card. `createSheetText.destroy` removes its `selectionchange` and `mousedown` listeners. The insert menu and Save as menu remove their document listeners on close. `sheet-pane.js` removes `desk:sheet-new`. `route()` destroys the page editor before drawing another view.
- **Phone viewer**: `sheet-share-gate.js` reaches desk code only by the one dynamic import in the phone branch. `sheet-page.js` starts the page only with `data-desk="on"`. `showShared(…, null, …)` opens no store and subscribes to nothing. `deskCtx`/`webClient` are pure, and on a phone nothing writes storage.
- **History**: `createHistory` and `initUndo` are idempotent, so the page's repeated calls (each list draw, each Edit) add no second Ctrl+Z handler.
- **CSS**: the sheet tokens in `desk.css` define dark mode under both selectors. No `ch` unit is used, and the conflict and question boxes are styled.

### Not reached

- `sheet-lit.js`'s word cursor and blank picker and `sheet-copy.js`'s paper rendering, beyond the paths above (heavily covered by SH5 and SH6).
- `sheet-tour.js` and `sheet-tour-desk.js`, beyond a listener scan (Audit 7 covered them a day ago).
- Any behavior that needs a real browser: execCommand output per engine, paste from Word and Docs, print and PDF output, the presenter window on two screens, and actual scroll measurement for SH8-1.

## Appendix D: Reading pages with the desk on: the Notebook panel and marks (`NB8`, Sonnet)

Slice: `desk-gate.js` (behavior), `desk/first-stage.js`, `desk/shell.js`, `desk/boot.js`, `desk-frame.js`, `desk/panel.js`, `margin.js`, `tab-mine.js`, `tab-verse.js`, the marks (`notes-margin.js`, `highlights.js`, `read-marks.js`, `verse-labels.js`, `pins.js`, `footnote-notes.js`, `footnote-pills.js`, `change-notice.js`, `diff-view.js`, `move-redraw.js`, `bookmark-*.js`), editing (`note-editor.js`, `note-words.js`, `note-sources.js`, `labels-ui.js`, `record-rows.js`, `kept-list.js`, `trash-list.js`, `lit-records.js`), the reader-facing extras (`note-settings.js`, `reading-display.js`, `continue-reading.js`, `release-feed.js`, `whats-new.js` in part, `chapter-page.js`, `page.js`, `actions.js`, `glossary-titles.js`) and the shared-code seams (`lit-panel.js`, the `lit:*` events in `chapter-tools.js`).
Model: Sonnet 5.5. Commit: `15986b6e` (worktree `desk-audit-8`). Date: 2026-11-09.
Ran: read the files above in full or in the parts that matter; `node --test` on `desk-first-stage`, `desk-frame`, `desk-gate-imports` and `desk-notebook-panel` (42 pass); five scratch scripts in `...\scratchpad\audit8\nb8\` (`bench-place.mjs`, `bench-body.mjs`, `bench-findpin.mjs`, `hostile-place.mjs`, `hide-all.mjs`). No browser, so nothing about real drawing or timing in a browser is claimed as measured.

### Summary

The two-stage load is sound: every event the shell answers is held and replayed, stage one's tab, skip link and stub panel match what the panel draws, the hand-over removes everything stage one added in the same task, and a failure at any point ends in `standDown()` with the page restored. The note editor, the anchor placement of marks and the read side of every list are well hardened (hostile quotes, hostile markers, 65 KB bodies, 1,500 marks all place or render without throwing, and fast). What I found are mostly performance gaps on reading pages that the "two stages" design was meant to avoid, and a handful of silent or misleading failures.
Counts: 0 Critical, 0 High, 2 Medium, 10 Low, 2 Nit (14 findings). Nothing loses a reader's words. The two Medium findings: a sheet being typed in another tab wakes every mark-drawing view on every reading page (NB8-1), and a failed bookmark, highlight or pin write says nothing (NB8-2).

### Findings

#### NB8-1 · Medium · performance · NEW

Every mark-drawing view on a reading page redraws on each sheet autosave heard from another tab

**Where** `src/scripts/desk/panel.js:642` (`store?.subscribe(() => render())`, no filter), `notes-margin.js:752`, `highlights.js:87`, `verse-labels.js:80`, `pins.js:376`, `footnote-notes.js:315`, `read-marks.js:113` (each `{ except: QUIET_KINDS }` only); the rule is `hearsChange` in `src/lib/desk-store-core.mjs:277`, the kinds are `store.js:262` (`changeKinds`), and `NO_CHAPTER_KINDS` (`desk-store-core.mjs:234`) is used only by `desk-panes.js:412` and `lit-records.js:104` (/desk).
**What happens** A reader has a chapter open in one tab (the Notebook minimized, the default) and /desk or /sheets in another, typing in a sheet. Each autosave (every few hundred milliseconds, per `NO_CHAPTER_KINDS`' own comment) is broadcast with kinds `["sheet"]`. `hearsChange({except:["place","bookmarkMove"]}, ["sheet"])` is true, so in the chapter tab: the panel's My Notes `render()` runs (`store.all()` clones every record including every sheet, up to 512 KB each, then rebuilds the whole list), the margin re-reads and redraws every note, the highlights repaint, the verse labels relabel, pins and footnote notes re-read, and in Read View `read-marks.js` calls `store.all()`. The tab does this even in the background (the IndexedDB reads do not wait for a frame). Audit 2's DK-5 added `NO_CHAPTER_KINDS` for /desk's views but the reading-page views that Audit 2's own comment calls "a view of marks" were left on `QUIET_KINDS`.
**Evidence** Read each subscribe site and `hearsChange`; `store.js:262` shows a sheet write notifies with kind `sheet`. The ordering `STUDY-DESK-AUDIT-2.md` line 219 says "My Notes still subscribe[s] to every write" and line 371 says it was fixed for the /desk pane only.
**Fix** Subscribe those six views with `{ except: NO_CHAPTER_KINDS }` (the panel needs `["place","sheet"]` too, since My Notes lists neither; keep `bookmarkMove` heard there, see NB8-3). One line each.
**Confidence** High (code), Medium (size of the cost; not timed).

**Fixed (2026-11-09)** The reading page's margin, highlights, verse labels, pins, footnote notes and read marks subscribe with `{ except: [...NO_CHAPTER_KINDS, MOVE_KIND] }`, the panel with `{ except: NO_CHAPTER_KINDS }`, so a sheet's autosave redraws none of them (LG8-3's sheet half). Tests: `test/desk-audit8-d-reading-pages.test.js`.

#### NB8-2 · Medium · usability · NEW

A bookmark, highlight or pin that fails to save says nothing

**Where** `src/scripts/desk/actions.js:142-154` (`guarded`, used by Add bookmark, Remove bookmark and the two "Add a bookmark that…" buttons) and `:503-506` (`highlight()`, then `finally { closePanel() }`); `src/scripts/desk/pins.js:182-185` (the Pin button's click). Related: `store.js:148` (`db.onversionchange = () => db.close()`).
**What happens** When the write throws (storage full or evicted, the transaction aborts, or the database was closed by `onversionchange` after a deploy that bumps `DB_VERSION`, after which every later write throws `InvalidStateError` until a reload), these three paths only `console.error`. For Highlight the menu closes and nothing is drawn, for Add bookmark the button simply re-enables, for Pin the button repaints unchanged. The note editor, labels, trash restore, change-notice Keep and bookmark form all show a sentence in this case (for example `note-editor.js:141-145`); these do not, so the reader presses again, or concludes the feature is broken, and has no hint their browser cannot keep a notebook.
**Evidence** Read; there is no `announce`, `showUndo` or inline error in the catch blocks. Audit 2 line 874 records that quota-exceeded was never driven.
**Fix** In each catch, `announce`/`showUndo` one sentence in the editor's wording ("couldn’t be saved in this browser, so nothing changed"), and keep the menu open for bookmarks; for `onversionchange`, either set a flag the writers check ("This page is out of date. Reload it to keep notes.") or reopen the database.
**Confidence** High (code); Medium on how often it happens.

**Fixed (2026-11-09)** A failed bookmark, highlight or pin write says it couldn't be saved in this browser (`showNotice`), and the bookmark menu stays open. Test: `test/desk-audit8-d-reading-pages.test.js`.

#### NB8-3 · Low · performance · NEW

My Notes redraws in full while the Notebook is minimized, which is the default

**Where** `src/scripts/desk/panel.js:120` (`visible = () => !panel.hidden`), `:485-488` (`render`), `:195` (`visible: () => visible() && activeTab === "mine"`), `:642`; the collapse is only CSS, `src/styles/desk-tab.css:24` (`.desk-rail--collapsed .desk-panel { display: none }`); `tab-mine.js:381` (`await store.all()`) and `:437-442`.
**What happens** A minimized Notebook still has `panel.hidden === false`, so `render()` treats it as visible: at load (any page with a record, since that is what loads the shell) and on every store notice the panel reads every record and rebuilds every row in a panel nobody can see. The panel's subscription has no filter, so each bookmark move written by "Move as I read" (every 2 seconds while the reader scrolls; `bookmark-follow.js` `MOVE_EVERY_MS`) does it again. With a small notebook this is nothing; with the 5,000-note case in the brief it is a full-list rebuild every two seconds of reading. No other view redraws on `MOVE_KIND` except to catch up after a 2.5-second pause (`move-redraw.js`).
**Evidence** Read. `shown()` (`panel.js:324`, open and not collapsed) already exists and is what `firstUse` uses.
**Fix** Draw My Notes and This verse only when `shown()`; when the Notebook expands, call `render()` once (the rail's `onChange` already runs on expand). Keep `MOVE_KIND` heard only while expanded.
**Confidence** High (code), Low (impact; not timed with a large notebook).

**Fixed (2026-11-10)** A minimized Notebook no longer draws My Notes or This verse: `render` in `panel.js` returns unless the panel is expanded, both tabs' `visible` follow `shown()`, and the rail's change callback renders once when it expands, so bookmark moves cost nothing while it is folded.

#### NB8-4 · Low · performance · NEW

A long My Notes or "What I’ve kept" list is rebuilt, with a forced reflow per long note, on every change and every keystroke

**Where** `src/scripts/desk/tab-mine.js:931-947` (`markCut`), `:285` (`input`, `search`, `change` each call `render()`), `:381`; `src/scripts/desk/kept-list.js:277` and `:82`.
**What happens** `markCut` reads `words.scrollHeight` for each row and then writes `caret.hidden` for it, so each row whose caret changes forces a layout of the panel before the next row's read: N long notes cost N reflows of an N-row list. Separately both lists draw every record with no windowing or paging and no debounce on the search box, so typing "faith" re-reads all records and rebuilds all rows five times. The pure side scales (Audit 2's `scale.mjs`: `filterRecords` 33 ms for 25,000 records); the DOM side was never driven at that size.
**Evidence** Read; `fillNoteWords` itself is fast (`bench-body.mjs`: 5,000 bodies in 34 ms).
**Fix** In `markCut`, do all the reads first and the writes in a second loop. Debounce the search `render()` by about 150 ms. Past some count (a few hundred rows) show the first batch with "Show more".
**Confidence** Medium (code), Low (felt impact; needs a browser with 1,000+ notes).

**Fixed (2026-11-09)** `markCut` reads every row before writing, and the search box is debounced (150 ms). Paging is decision 7.

#### NB8-5 · Low · bug · NEW

A margin circle pressed while the note editor holds unsaved words leaves the circle "expanded" and its words lit

**Where** `src/scripts/desk/notes-margin.js:640-700` (`openPopover`, especially `:676` and `:697`), `:623`, `:544-564` (`syncLit`), `:409-422` (`keepPopover`); `src/scripts/lit-panel.js` `showPanel` (`if (!closePanel()) return el;`).
**What happens** In a narrow margin (circles), the reader types in the note editor, then clicks another note’s circle. `showPanel` asks the editor to hold (it says "Your words aren’t saved yet…") and returns the popover unattached, with no `onClose` registered. `openPopover` does not check that, so it sets `popId = record.id`, `aria-expanded="true"` on the circle and calls `syncLit()`. `popId` is only cleared by that popover’s `onClose`, which never runs. The note’s words stay highlighted and a screen reader hears "expanded" on a circle that opened nothing until some later popover opens and closes. A second click on the same circle then goes down the `popId === id` branch (`:623`) and closes the editor without opening the note. `reveal()` (`:712`, "Show in Notebook" and the notices) calls `openPopover` the same way.
**Evidence** Read. `keepPopover` returns early when no `desk-note` panel is open, so a redraw does not repair it.
**Fix** In `openPopover`, `if (!pop.isConnected) return;` right after `showPanel`, before setting `popId`.
**Confidence** High (code); confirm in a browser with a narrow window.

**Fixed (2026-11-09)** `openPopover` returns when the popover is no longer in the page.

#### NB8-6 · Low · usability · NEW

Pressing "Hide my marks" a second time forgets what the first press remembered

**Where** `src/scripts/desk/note-settings.js:106-110` (`setHideAll`), `:239` and `:166` (H).
**What happens** Hide (everything off, remembers notes, bookmarks and highlights on). The reader turns "Notes in the margin" back on to show one note, then hides again (the box is unchecked, so H or the checkbox hides). The second hide saves the current states (notes on, the rest off), overwriting the first record. Showing again brings back only the notes, and bookmarks and highlights stay off until the reader finds the two other switches. `hide-all.mjs` run output: `start notes=on bookmarks=on highlights=on` → hide → notes back on → hide again → show again: `notes=on bookmarks=off highlights=off`. The header comment says "the most recent action wins" for turning a switch back on; it does not say a second hide should lose the first set.
**Evidence** `hide-all.mjs` (copied output above), run against the real `note-settings.js` with a stub `document`.
**Fix** When saving for hide, keep an existing saved "on" for any switch that is currently off, or refuse to overwrite while `HIDE_KEY` exists.
**Confidence** High.

**Fixed (2026-11-10)** `setHideAll` now keeps the first hide's record: a hide that finds one keeps a saved "on" for any switch it had, so Show restores everything the first hide saw on.

#### NB8-7 · Low · usability · NEW

The note editor has no length limit and a body over 65,536 characters fails with a message that tells the reader to retry

**Where** `src/scripts/desk/note-editor.js:115` (the `<textarea>` has no `maxlength`) and `:141-145` (`failed`); the rule is `MAX_NOTE_BODY` and `validateRecord` (`src/lib/desk-records.mjs:369`, `:444`), refused by `planSave` (`desk-store-core.mjs:43`).
**What happens** A reader pastes a long document into a note and presses Save. `planSave` throws "body is too long to keep", and `failed()` shows "The note couldn’t be saved in this browser. Your words are still here: copy them, then try again." The browser is fine and trying again will always fail. Nothing is lost (the words stay).
**Evidence** Read; `validateRecord` lines above. Other fields carry `maxlength` (`bookmark-form.js:68`, `labels-ui.js:52`).
**Fix** `textarea.maxLength = MAX_NOTE_BODY`, or in `failed()` say "That note is too long (over 65,536 characters). Shorten it, or split it into two notes." when the error mentions the body.
**Confidence** High.

**Fixed (2026-11-09)** The note field has `maxLength = MAX_NOTE_BODY`, and a note too long to keep gets its own sentence.

#### NB8-8 · Low · a11y · NEW (leftover of NB3-8)

Two more focused buttons become `disabled` and can lose focus

**Where** `src/scripts/desk/change-notice.js:397-405` (`busy(on)` disables Keep, Show in the text and Delete; `fail()` re-enables them), `src/scripts/desk/bookmark-form.js:192` and `:218-224` (`saveButton.disabled`).
**What happens** NB3-8 moved Restore all, Undo and "Ask this browser to keep it" to `aria-disabled` because a focused button that becomes disabled loses focus in some browsers. The change-notice card and the bookmark form still disable the button the keyboard reader just pressed; when the version check fails or the verse does not read ("This page is older than your mark…"), the line is announced but focus is on the page, not the card.
**Evidence** Read; `focus-keep.js` `busy`/`isBusy`.
**Fix** Use `busy()`/`isBusy()` as `trash-list.js` does.
**Confidence** Medium (browser behavior; check by pressing Keep with the keyboard while offline and reading `document.activeElement`).

**Fixed (2026-11-09)** Keep and Delete on the change notice, and the bookmark form's Save, are `aria-disabled` while busy, so focus stays; `desk.css` gives them the busy look.

#### NB8-9 · Low · bug · NEW

A Greek search result for the chapter on screen is swallowed if the shell fails to load

**Where** `src/scripts/desk/first-stage.js:256-271` (`hold`, `take: true` for `lit:greek-word`), `:178-186` (`if (!api) return` before `replay`); the sender is `src/scripts/search-core.js:1472-1476` (`showGreekHere`).
**What happens** Stage one calls `preventDefault()` on `lit:greek-word` at once (so the search box does not follow its link) and holds the event for the shell. If the shell then fails (offline, or an old page after a deploy), `stand` runs and the held event is dropped, never replayed and never given back: the reader clicked a result, and nothing happens, not even the verse link. The next click navigates normally, since `data-desk` is gone.
**Evidence** Read.
**Fix** On stand-down, if a `lit:greek-word` was taken, navigate to its link (`greekHref`) or at least show the search's own link behavior; or take the event only once the shell is up.
**Confidence** High (code); narrow trigger.

**Fixed (2026-11-09)** When the shell stands down, a held Greek result opens `?greek=…#vN`.

#### NB8-10 · Low · robustness · NEW

One failing initializer after the Notebook is up silently skips every one after it

**Where** `src/scripts/desk/shell.js:165-182` (`createPrintPart`, `initActions`, `initBookmarkFollow`, `initCommands`, `initGreekLink`, `initProseActions`, `createTour`, `createVerseLabels`, `createHighlights`, `initPrintLink`, in sequence) and `:197-204` (`startShell`'s catch).
**What happens** `createPanel` builds each tab in its own `try` (BA29), but the ten initializers after it are one straight line. If one throws (a stale cached chunk, an API a browser lacks), the later ones never run: no verse-menu rows, no follower, no commands, no Greek link, no verse labels, no highlights. `startShell` then logs, and because `panelUp` is true it does not stand down and returns `api`, so stage one replays its held events into a half-started desk. The design record says "a failure after the Notebook is up is only logged"; it does not say a log should disable the rest.
**Evidence** Read.
**Fix** Run each initializer through a small `tryStart(name, fn)` that catches and logs, as `createPanel` does for tabs.
**Confidence** Medium (no one-line trigger found, so a robustness gap rather than a seen bug).

**Fixed (2026-11-09)** Each of the shell's start-up steps runs through `tryStart`, so one that throws doesn't stop the rest.

#### NB8-11 · Low · performance · NEW

`placed()` rebuilds the whole footnote list once per note on a footnote

**Where** `src/scripts/desk/note-sources.js:80-89` (`studySource().placed`), `footnote-notes.js:115-122` (`footnoteElementFor` → `footnoteList()`), `page.js:53-62` (`footnoteList`, which clones every `.fn-body`), `src/lib/desk-footnotes.mjs:155-178` and `:254-280` (`findPin`).
**What happens** For each note on a footnote, `placed()` walks the chapter’s blocks and clones every footnote body again, then `findPin` re-normalizes every footnote’s text. `placed()` is called from `draw()` and from `syncLit()`, so also on each hover or focus of any margin note. A chapter with 30 notes on 40 footnotes does that 30 times per hover. The pure `findPin` part is small (`bench-findpin.mjs`: 4 ms for 60 records against 60 footnotes); the DOM walk and clones are the larger share and were not timed.
**Fix** Read `footnoteList()` once at the top of `placed()` (as `text` already is) and pass it down.
**Confidence** High (code), Low (size).

**Fixed (2026-11-09)** `footnoteList()` is read once per `placed()`.

#### NB8-12 · Low · a11y · KNOWN-OPEN (Audit 1, list "needing a real browser", `STUDY-DESK-AUDIT-1.md` line 2760)

Marker glyphs and bookmark marks may lose their colors, and with them the differences between them, in a Windows contrast theme

**Where** `src/scripts/desk/glyphs.js:15-27` (the seven markers use explicit `fill`/`stroke` colors and a white "!" or "?" on a colored disc), `src/styles/desk.css:992-1030` (bookmark mark red, gold with a stroke, or outline); the forced-colors blocks in `desk.css` (`:1260`, `:1441`, `:1977`, `:2133`) cover highlights, swatches, the changed dot and the diff, but not `.desk-glyph`, `.desk-bookmark-mark__glyph` or `.desk-bookmark-glyph--*`.
**What happens** If the browser forces SVG `fill` and `stroke` in forced-colors mode (I believe Chromium and Gecko do for non-`currentColor` paints, but have not seen it), the seven markers all become the same solid shape in the text color, and red, gold and outlined bookmarks look alike. The names and the state line say the difference in words, so it is not a loss of information, but the visible cue is gone.
**Evidence** Read; not run.
**Fix** Confirm in Edge with a contrast theme; if it collapses, give the glyphs `forced-color-adjust: none` inside a `forced-colors` block, or add a shape cue.
**Confidence** Low.

**No change (2026-11-10)** Checked with Chromium's forced-colors emulation (the engine Edge uses for a Windows contrast theme), light and dark: Chromium doesn't force SVG `fill` and `stroke`, so the seven markers and the three bookmark looks keep their own colors and stay distinct. Firefox's contrast mode was not checked.

#### NB8-13 · Nit · bug · NEW

Trash rows carry the live row’s bookmark link behavior

**Where** `src/scripts/desk/record-rows.js:101-114` (the `followBookmark` / `stopFollowing` click handler and `followLinkButton` are added before the `trash` branch at `:178`).
**What happens** On /notebook, clicking the reference of a deleted bookmark in the Trash starts a follow for a bookmark that is not in the notebook (the page it opens drops it) or, for a stays-put one, stops whatever this tab was following. A trashed moving bookmark that this tab was following also shows "Stop following".
**Fix** Skip both when `trash` is set.
**Confidence** High (code); trivial effect.

**Fixed (2026-11-09)** A Trash row starts and stops no follow.

#### NB8-14 · Nit · usability · NEW

Enter during IME composition saves the bookmark form

**Where** `src/scripts/desk/bookmark-form.js:257` (`keydown` Enter on the verse and name fields).
**What happens** A reader typing a name with an input method presses Enter to confirm the composition; the form saves with the half-typed name. `note-editor.js` uses Ctrl+Enter and is not affected.
**Fix** `if (e.key === "Enter" && !e.isComposing)`.
**Confidence** Medium (not run with an IME).

**Fixed (2026-11-09)** Enter during an IME composition doesn't save the form.

### Improvements

- `first-stage.js` `peekNotebook` counts every record in a Read View book, but Read View draws only bookmarks (and highlights when its switch is on), so a book with notes only loads the 138 KB shell for nothing. A `kind`-aware count, or a cursor that stops at the first bookmark or highlight, would keep the "nothing kept" path for Read View.
- `first-stage.js:306-311` opens IndexedDB and counts on every BroadcastChannel message while the shell is not loaded, including every sheet autosave and bookmark move from another tab; coalesce to one `look()` per second.
- `tab-verse.js:190` reads `store.all()` (every sheet cloned) on each This verse render to find notes citing the verse; `store.byKind("note")` gives the same.
- `tab-mine.js:381` also reads `store.all()` for labels and the What’s new line; `byKind("label")` would avoid cloning sheets there.
- `desk/glossary-titles.js` `fit()` alternates writes and layout reads per heading (up to two forced layouts each, about 95 for the glossary) on every resize frame.
- `panel.js` `lazyTab.render()` starts a new import on every store change after a failed load and flickers "Loading…" before the broken line; remember the failure for the visit.
- `note-editor.js` `onClose` clears the one draft key even for an editor that held no draft; harmless today, fragile if a second editor can ever open.

### Questions for the owner

1. Should the minimized Notebook skip drawing My Notes entirely (NB8-3), with the list drawn on expand? It changes nothing a reader sees, but the first expand would draw rather than reveal.
2. When Hide my marks is pressed a second time while some marks are already back on (NB8-6), should "show again" restore the first set or the latest one? The header comment settles it only for turning a switch back on.
3. Should a failed bookmark, highlight or pin write (NB8-2) say so in the undo bar (a sentence, as an editor does), or only in the menu?

### What held up

- **The two-stage load**: stage one’s tab, skip link, stub `#deskPanel` and rail match the panel’s; `handOver` removes all three in the same task and `rail.destroy()` puts the column back before `createRail` places it again, so nothing paints between. Each held event (`lit:panel-actions`, `lit:footnote-actions`, `lit:desk-command`, `lit:greek-word`) has a matching shell listener registered in the same synchronous run after `handOver`, so none can fall in a gap. Double `standDown`/`rail.destroy`/`skip.remove` is harmless. `aria-busy` is cleared on every path.
- **`peekNotebook`**: aborts the creating transaction so no empty database is left; the Read View range `[book]`…`[book, []]` cannot catch another book; every error path answers `null` and the shell loads.
- **`startState`, the pre-paint repeat, "Show the Notebook" off** (stage one and panel agree, and the reader’s keys are never written).
- **The follow flag across two stages**: a paused or live flag loads the shell on every reading surface (`loadAtOnce`), the gate pauses it everywhere else, and `initBookmarkFollow` asks for the current place on start.
- **Note editor**: single in-flight save, `planEdit` against the record as stored, draft kept per place in `sessionStorage`, `beforeunload` while changed, hold-once on Escape, Cancel and ×, no HTML from the body (`noteBodyHtml`, a 65,536-character body of citation-shaped text in 14 ms: no backtracking).
- **Anchor placement of marks**: `placeRecord` placed 1,500 quoted records on the longest chapter (Luke 1, 8,756 characters) in 33 ms, and does not throw for quotes with numbers, objects, strings, a missing prefix, a huge or reversed verse (`hostile-place.mjs`); a note whose words are lost is left out, a highlight’s placement has its own try/catch; hostile markers fall to the plain note’s glyph.
- **IndexedDB unavailable**: `store` null gives the panel’s sentence, no editor entry points, no marks, `data-desk-no-notebook`; a database that never answers is given up on after 8 seconds; stage one stamps the attribute itself when there is no `indexedDB`.
- **Chapter View versus Read View** split follows the root rule: margin, pins, verse labels, footnote notes, This verse and Greek are chapter-only; Read View gets bookmarks, highlights (own switch), print and the selection panel’s Bookmark and Highlight only.
- `desk.css`’s three dark-mode blocks each have both selectors, and `desk-tab.css` uses theme tokens only. `npm run test:desk`’s four files for this slice pass.

### Not reached

- Anything in a browser: real margin drawing, circle/full switch under resize and zoom, forced colors, focus return after a redraw, a screen reader, timing of lists over 1,000 notes.
- `widths.js`, `float-resize.js` and `desk-margin.mjs`’s placement arithmetic (margin.js only as it relates to stage one), `first-use.js`, `undo-bar.js`, `history.js`, the tours, `print-*.js`, `whats-new.js`’s draw half, `prose-actions.js` (N11 is off), `kept-list.js` below line 120 except the draw and delete paths, `notebook-page.js`.
- Another tab’s `onversionchange` close in practice (NB8-2 rests on the code).

## Appendix E: /desk, /notebook, the help page, the tours, and printing notes (`DK8`, Sonnet)

Slice: `src/scripts/desk/` (desk-page, desk-panes, lit-pane, intro-pane, intro-text, footnotes-view, search-pane, passage-bar, widths, float-resize, kind-menu, title-menu, page-kind, focus-keep, menu-reasons, dom, glyphs, undo-bar, commands, tour, tour-runner, desk-tour, first-use, notebook-page, readonly-notebook, notebook-search, notebook-tab, print-*) plus the runner side of `sheets/sheet-tour*.js`, `src/pages/{desk,notebook}.astro`, `src/pages/desk/help.astro` (+ `src/styles/pages/desk-help.css`).
Auditor: DK8, model Sonnet 5.5, commit `15986b6e` (branch `claude/desk-audit-8`), 2026-11-09.
Ran (read-only; scripts in `...\scratchpad\audit8\dk8\`): `fuzz.mjs` (12,000 random layout operation sequences with invariant and JSON round-trip checks against `src/lib/desk-layout.mjs`), `hostile.mjs` (13 hostile `lit-desk-layout` payloads through `readSaved`), `params.mjs` (hostile `?place=`/`?intro=` values), `fit.mjs`, `sync.mjs` (window widths against `addPaneNeeds`), `race.mjs` (a copy of lit-pane's fill/goTo flag logic). No browser, so nothing visual was seen; every UI claim below is from reading the code.

### Summary

The slice is in good shape. The layout engine held up under fuzzing (no invariant broken in 12,000 runs of up to 25 operations, hostile saved layouts all fall back safely), the tours' undo plumbing is careful (every `later()` that matters is registered before the first await), and the help page's concrete claims checked out against the code almost everywhere (about 90 labels, shortcuts, counts and behaviors compared). What I found is small: one keyboard bug on /notebook, one place where /desk's own "links that leave the desk open apart" rule is not applied, one tour card that is wrong in a half-width window, one race in the LIT pane, and a handful of copy/help inaccuracies.

Counts: Critical 0, High 0, Medium 2, Low 6, Nit 1. All NEW except DK8-6 (a fix of Audit 3's NB3-14 that is itself imprecise).

### Findings

#### DK8-1 · Medium · a11y · NEW
Renaming a label with the keyboard never closes the rename form (Enter saves but leaves the form up; Escape does not cancel).

**Where**: `src/scripts/desk/notebook-page.js:222-230` (`drawLabels`, the guard at 228) with `:245-279` (`labelRow`'s rename: the Escape handler at 265-270, `back()` at 260-263, the submit handler at 271-278).

**What happens**: On /notebook, a keyboard user presses Rename on a label, types a new name and presses Enter. `writeOver` saves it (the notebook is updated), then `back()` calls `render()`, and so does the store subscription (`:441`). Both reach `drawLabels`, which returns early when `labelList.contains(document.activeElement) && document.activeElement.matches("input")` (the guard meant to protect a row "being renamed"). Focus is still in the rename input, so the list is never redrawn: the row keeps showing the form (input, Save, Cancel) and the only signal is the screen-reader announcement. `back()`'s own focus step (`.desk-item__edit`) then finds nothing, since the row's children were replaced by the form. Escape runs the same `back()`, so Escape does not cancel the rename either (the code comment and the keydown handler promise it does). The mouse paths work only because pressing Save or Cancel moves focus to that button first, which defeats the guard. Pressing Save again after an Enter-save renames to the same name and can show "You already have a label with that name."

**Evidence**: Read-through of the three functions; the guard and the form's focus are the whole mechanism. Not run (no DOM in the audit); the trace has no branch that blurs the input before `render()`.

**Fix**: Have `back()` blur or remove the form before rendering, e.g. in `back` call `input.blur()` (or `li.replaceChildren(...)` back to the row) before `await render()`, or give `drawLabels` a `renaming` id to skip only while a rename is in progress and clear it in `back()`. Keep focus on the row's Rename button afterwards (the existing intent).

**Confidence**: High (mechanism), Medium (exact browser behavior of `activeElement` after Enter, unrun).

---

**Fixed (2026-11-09)** `back()` blurs the field before the redraw, so Enter closes the form and Escape cancels.

#### DK8-2 · Medium · usability · NEW
A scripture reference inside a footnote, on /desk, is a plain same-tab link, so one click leaves the workspace; the rule "a link that leaves the desk opens apart so the layout stays" (E34) is applied everywhere else.

**Where**: `src/scripts/desk/footnotes-view.js:86-93` (the Footnotes pane clones `source.footnoteBody(id)` with its links as they are); same bodies in `src/scripts/desk/tab-verse.js:289-291` (the This verse pane) and `src/scripts/desk/lit-pane.js:600-603` (the LIT pane's footnote popover, `footnotePanel({ body: source.footnoteBody(...) })`). Contrast `intro-text.js:247-250` (every link `_blank`), `lit-pane.js:259` (headings), `search-pane.js` (`awayTab`), `ref-preview.js:111-116` (the preview's "Open" link on /desk).

**What happens**: A footnote's cross-references (`<a class="sref" href="/romans-2/#v24">`, built at `src/lib/scripture-refs.mjs:346` with no target) are common. On /desk, clicking one in the Footnotes pane, the This verse pane or the LIT footnote popover navigates the tab to Chapter View. In-memory pane state is lost on the way (Search pane results, a chosen Greek word, My Notes filters, a half-typed passage field); only the layout is restored by the saved key. Hovering the same link gives a preview whose "Open" link does open a new tab, so the two behaviors disagree. The Book Intro pane handles the same `a.sref` links by moving the LIT pane (a plain click) or opening a tab (modified click), so the desk already has two good answers.

**Evidence**: grep of `src/scripts/desk` for `_blank`/`target` shows no handling for footnote bodies; `src/lib/desk-inert.mjs` strips attributes but adds none; the built `dist/john-3/index.html` `.sref` anchors carry no target. `desk-panes.js:76-78` says of Go deeper rows that their links "leave /desk as they would from Chapter View", but says nothing of footnote references.

**Fix**: In `footnotes-view.js`, `tab-verse.js` and the LIT footnote popover, either set `target="_blank" rel="noopener noreferrer"` on every `a[href]` in the cloned body (as `intro-text.js` does), or route a plain click on `a.sref` to `env.showPassage` as the Book Intro pane does (`intro-pane.js:205-213`). Ask the owner which (see Questions).

**Confidence**: Medium-High (code read; not run in a browser).

---

**Fixed (2026-11-10)** Decision 4 (BVJ, 2026-11-10): a footnote's scripture reference on /desk behaves as the Book Intro pane's does. A plain click moves the LIT pane through `env.showPassage`; a modified click keeps the browser's default; any other link in a footnote opens in a new tab. One helper, `desk/footnote-links.js` (`routeFootnoteLinks`), serves the Footnotes pane, This verse as a /desk pane (the Notebook's tab on Chapter View is unchanged) and the LIT pane's footnote popover. Test: `test/desk-audit8-dom-footnote-links.test.js`.

#### DK8-3 · Low · copy · NEW
The Study Desk tour's "Reading in sync" card says there are two LIT panes "as here for the tour" in a window too narrow to add one, and the step is not dropped as "Add pane" is.

**Where**: `src/scripts/desk/desk-tour.js:102-117` (`STEPS.sync`), `:208-216` (`available` removes `add` and `newsheet` for lack of room but never `sync`); card text in `src/lib/desk-first-use.mjs` (`DESK_TOUR_STEPS`, id `sync`: "With two LIT panes open, as here for the tour, the one you selected most recently is marked with a flag.").

**What happens**: The tour starts from the original layout (the LIT beside My Notes) and `sync` calls `addPane(layout, "column", "lit", ...)`. When the column does not fit, `addPane` returns the same layout, nothing is added, no flag shows (`rec.lead.hidden`), and the card is placed on the pane's name. The card still says two LIT panes are open "as here". A half-snapped window on a 1366 px laptop (about 650 px of panes) is enough.

**Evidence**: `sync.mjs`: with the original layout, `addPaneNeeds(.., "column", w, h)` is "wider" for w = 846, 800, 683, 560 and `addPane` returns the same layout (2 panes), while a row would still fit at 846 to 683. The same window also drops the `add` step (so the card text is not consistent between steps either).

**Fix**: Either delete the `sync` step in `available()` when `addPaneNeeds(base, "column", ...)` is non-null, or fall back to a row (`addPane(layout, "row", "lit", ...)`) as `sheets` falls back to turning a pane into Sheets, or give the card a variant body for "no room" that says what the flag does without claiming it is shown.

**Confidence**: High (computed), High for the card text.

---

**Fixed (2026-11-09)** The "Reading in sync" step is dropped when there is no room to add a pane, as "Add pane" is.

#### DK8-4 · Low · a11y · NEW
Choosing "My notebook page" or "Help for the Study Desk" in /desk's title menu from the keyboard drops focus to the page body, so on coming back from the new tab a keyboard user starts again from the top of the page.

**Where**: `src/scripts/desk/title-menu.js:364` (`for (const link of links) link.addEventListener("click", () => closeTitleMenu({ focus: false }))`).

**What happens**: The two links open in a new tab (`target="_blank"`). The click handler hides the menu with `focus: false`, so the focused link becomes hidden and focus falls to `<body>`. Every other item either hands focus to what it opens (Layout, Print, tour, new sheet) or returns it to the title button (Full screen, a kind chosen).

**Evidence**: `closeTitleMenu` (`:313-319`) is the only place focus returns; `focus:false` skips it. The "focus never drops to the page" principle is stated in `tour-runner.js` (LV3-4) and `title-menu.js:146-148`.

**Fix**: Call `closeTitleMenu()` (default `focus: true`) for these two links; the title button takes focus before the new tab opens and is still there on return.

**Confidence**: Medium-High (browser blur behavior on a hidden focused element is standard; not run).

---

**Fixed (2026-11-09)**

#### DK8-5 · Low · bug · NEW
A late chapter load in the LIT pane can reset the "loading" flag of a newer load, after which a scroll starts a duplicate load and the chapter is added to the pane twice (same data-key, duplicate ids).

**Where**: `src/scripts/desk/lit-pane.js:433-441` (`fill`, `loadingDown = false` before the `n !== seq` check), `:453-461` (the same for `loadingUp`), `:519` (`goTo` resets `loadingUp = loadingDown = stalled = stalledUp = false`).

**What happens**: `fill()` starts loading chapter 11 (slow). The reader jumps with the picker; `goTo` resets the flags, loads 50, and its `fill()` starts loading 51 (`loadingDown = true`). The old load for 11 now settles: it sets `loadingDown = false` (the flag belongs to a load of the old generation) and returns on `n !== seq`. The next scroll or ResizeObserver tick calls `fill()`, finds `loadingDown` false and `hi` still 50, and starts a second `render(51)`. Both resolve and both `text.append(section)`: the chapter appears twice, with duplicate element ids, and `sections` keeps only the second. Needs a slow old fetch overtaking a fast new one, so it is rare, but a jump during a load at an edge is exactly when it happens.

**Evidence**: `race.mjs` copies the flag logic of `fill()`/`goTo()` with hand-resolved promises: after the sequence above it prints `pending renders: [ 51, 51 ]` and `appended order: 50,51,51`.

**Fix**: Reset the flag only for the current generation: `if (n === seq) loadingDown = false;` before the check (same for `loadingUp`), and after `await render(i)` also check `i === hi + 1` (or `lo - 1`) before appending.

**Confidence**: Medium (logic reproduced on a copy of the flag handling; not run in the real pane).

---

**Fixed (2026-11-09)** A late load no longer resets a newer load's flag.

#### DK8-6 · Low · docs · REGRESSION NB3-14
The help page says the "Study Desk" button beside "Go to passage" is in Read View. It is on the /read landing page; Read View (`/read/<book>`) has no such button.

**Where**: `src/pages/desk/help.astro:44-47` ("... or the “Study Desk” button beside “Go to passage” in Read View."). The button is `.read-menu__desk` in `src/layouts/ReadLayout.astro:40-52`, used only by `src/pages/read.astro` (grep `ReadLayout` in `src/pages`). E50 (STUDY-DESK-FIXES.md ~1701) put it on /read.

**What happens**: A reader told to look in Read View for the button won't find it. Audit 3's NB3-14 marked the sentence fixed ("Read View's “Study Desk” button is named in that section"), but the project's own names are Chapter View, Read View (a whole book at `/read/<book>`) and "the /read landing" (root `CLAUDE.md`, routing table).

**Evidence**: `grep -rn "ReadLayout" src/pages` returns only `read.astro`; `ReadMenu.astro` offers the desk only as a "Open … in Study Desk →" link in the book's footer foot (line ~244), not a button.

**Fix**: "... or the “Study Desk” button beside “Go to passage” on the Read page (litbible.net/read)." (Avoid "Read View".)

**Confidence**: High.

---

**Fixed (2026-11-09)** The help page says "on the Read page", with a link to /read.

#### DK8-7 · Low · copy · NEW
"Delete everything" says it moves "every note, highlight, bookmark, and label" to the trash, but it trashes every record, including sheets, the reader's templates and other kinds; the confirmation counts them as "items".

**Where**: `src/scripts/desk/notebook-page.js:144` (description), `:316` (confirmation, `plural(n, "item", "items")` over `live = records.filter(r => r.kind !== "trash")` at `:309`), `src/lib/desk-notebook.mjs:246-255` (`planDeleteEverything` loops all records). The help page repeats it: `src/pages/desk/help.astro` "Deleting everything" ("To remove the whole notebook from this browser, use “Delete everything”").

**What happens**: A ministry leader with 40 sheets and a few notes who presses Delete everything to clear their notes also trashes every sheet and template. It is undoable (Undo, Ctrl+Z, and Trash with Restore for 30 days), but the text does not warn, and the sheets are the thing a leader would mind losing. (Audit 2's CP-3 once listed "and place"; the current text dropped that and never named sheets.)

**Evidence**: `planDeleteEverything` source; `desk-notebook.mjs:87-92` shows sheets are kept out of My Notes, so a reader may not think of them as part of "the notebook's notes".

**Fix**: "Moves everything in this browser to the trash: every note, highlight, bookmark, label, and sheet, and your own templates." and mention sheets in the help paragraph.

**Confidence**: High.

---

**Fixed (2026-11-10)** Decision 8: two buttons (BVJ). /notebook's "Delete everything" is now "Delete in bulk" with "Delete all marks…" (every record but sheets: notes, highlights, bookmarks, pinned footnotes, labels, and kinds this code doesn't know) and "Delete all sheets…" (sheets and the reader's templates), each saying what it leaves and each one undoable step (`planDeleteMarks`, `planDeleteSheets`, `bulkCounts` in `desk-notebook.mjs`); "Empty the trash now" stays beside them. The help page's section says the same. BVJ was unsure of the two labels; they are a one-line change in `notebook-page.js`. Tests: `test/desk-notebook.test.js`, `test/desk-audit8-dom-search-notebook.test.js`.

#### DK8-8 · Low · docs · NEW
The help page's Print paragraph implies the chapter on the page prints in place on /desk; on /desk every choice opens a new tab.

**Where**: `src/pages/desk/help.astro` (The Study Desk page, "Print."): "A chapter other than the one on the page opens in a new tab and prints there." vs `desk-page.js:528-534` (`createPrintMenu` with no `here` and no `inPlace`) and `print-menu.js:76-82` ("Each opens the chapter in a new tab, ready to print.").

**What happens**: On /desk no chapter is "the one on the page" (the menu has no `here`), so even the chapter in the leading LIT pane opens a new tab. The sentence is true of the Notebook's Settings tab on a chapter page, which is the other host of the same menu.

**Fix**: "“Print…” asks for a chapter, then offers to print it plainly, with your notes, or with room to write. Each choice opens the chapter in a new tab and prints there."

**Confidence**: High.

---

**Fixed (2026-11-09)** The help page's Print paragraph says every choice on /desk opens a new tab.

#### DK8-9 · Nit · longevity · NEW
`tour-runner.js` step tokens are per run, so a step still opening from an ended tour can be mistaken for a step of a tour started right after.

**Where**: `src/scripts/desk/tour-runner.js:88` (`token: 0` inside `run`), `:214` (`const token = ++run.token`), `:247` and `:251` (`token !== run.token`).

**What happens**: `end()` bumps the old run's token and sets `run = null`; a new `start()` makes a fresh `run` whose token counts again from 0. An old `go()` still awaiting an act (up to 2 s in the Study Desk tour's `newsheet` step, 3 s in the Sheets tour's `blanks` step) compares its captured token with the new run's: they can be equal (for example, old step 1 against the new run's step 1), so it goes on to mark and place the new card for the old step. Needs ending a long step and retaking the tour within seconds, then pressing Next at the matching count; no harm beyond a stray outline or a misplaced card.

**Fix**: Use a module-level counter shared by all runs (`let tokens = 0; const token = ++tokens; run.token = token`).

**Confidence**: Medium (read, not run).

**Fixed (2026-11-09)** Step tokens come from a counter shared across runs.

### Improvements

- After × closes a pane, focus goes to the first pane's name button (`desk-page.js:756`), which can be far from the closed pane; the neighbor that took its room would be a better landing for a keyboard user.
- `readonly-notebook.js:54` (`connection ||= await openExisting()`): two concurrent first calls each open the database and the first handle is never closed; share the promise (`opening ??= openExisting()`).
- The Sheets section of the help page opens with one paragraph of about 600 words (`help.astro` "Sheets"); bold run-in headings like "Blanks." and "Print, Present, and Share." already exist later in the section, so the first paragraph could carry them too ("Making a sheet.", "Adding parts.", "Two tabs.", "Templates.") and the section could get sub-anchors the tours can link to.
- `desk-layout.mjs resize()` returns `sizes: [null, null]` for a NaN delta (`fit.mjs`); unreachable from the current callers (pointer deltas are finite) but a cheap `Number.isFinite` guard would make `layout` unable to hold nulls.
- `desk-page.js:462-481` (`refreshMenu`) shows "My default" disabled from this tab's `saved` copy; a default made in another tab shows only after a reload (the write itself re-reads fresh, so no data is lost).
- The help page says "share everything, for another leader, or the participant’s version"; the dialog's options are "Everything, for another leader" and the participant copy (two, not three). A colon would remove the ambiguity.
- `undo-bar.js:161` gives its same-site "Open the sheet" link `rel="noopener"`; every other new-tab link in the desk uses `noopener noreferrer`. Harmless for same-origin, but consistent is easier to grep.

### Questions for the owner

1. **Footnote references on /desk** (DK8-2): should a plain click on a scripture reference in a footnote open a new tab (the E34 rule) or move the LIT pane, as it does in the Book Intro pane? Either is a small change; the two behaviors should not differ between panes.
2. **Continue reading**: reading in the LIT pane on /desk never writes `lit_last_read` (only the layout key moves), so the notebook page's "Continue reading" and My Notes' "Continue reading" line, in a Study Desk pane or elsewhere, stay at the last chapter-page read even while the reader works on /desk. Intended? (Nothing in `src/scripts/desk/CLAUDE.md` or the E log said either way that I found.) **Decided (2026-11-10): reading on /desk updates Continue reading, as Chapter View does (the leading LIT pane, throttled, never a draft); fixed.**
3. **"Hide my marks" and printing**: the verse menu's and the selection panel's "with my notes" stand down while it is on (`print-part.js:79-86`), and so does a print asked for by address (`print-link.js:50`); the whole-chapter "Print with my notes" from the Notebook's Settings tab, and the `>print` command, print the notes anyway (`print-notes.js` header: the screen switches "do not apply"). Both read as decisions; is the difference meant? **Decided (2026-11-10): anything that says "with my notes" prints them; Hide my marks is about the screen only; fixed.**
4. **"Delete everything" and sheets** (DK8-7): is trashing the sheets and templates with the notes intended, or should sheets be a separate button?

### What held up

- **Layout engine** (`src/lib/desk-layout.mjs`): `fuzz.mjs`, 12,000 runs (seeds 7, 11, 99, 2024) of up to 25 random operations (addPane, addBeside, closePane, splitPane, swapPanes, setKind, setPin, setActive, setLitAt, applyArrangement, resize, evenOut, showSheet, openKind, setPlace, showIntroIn, readingLayout) at seven window widths and four heights: pane count 1 to 4, unique ids, sizes positive and summing to 1, no same-direction nesting, the active pane always a LIT pane when one exists, pins only on followers, `sheet` only on Sheets panes, and every layout survives a JSON round trip through `checkLayout`. `hostile.mjs`: `__proto__`/`constructor` kinds, 40-deep nesting, duplicate ids, a 100,000-child array, 1e308 and negative sizes, objects where strings belong, null, [] and "": none threw, all fell back or kept sensible panes.
- **URL parameters** (`?place=`, `?intro=`, `?sheet=`, `?desk-tour`, `?sheet-tour`, `?q=` on /notebook, `?print=`): parsed by pure functions that reject unknown values; each is stripped from the address; `?print=` needs the one-time mark (`PRINT_ASK_KEY`, 60 s) and honors "Hide my marks".
- **Pane lifecycle**: every kind's `destroy` cancels its timers, observers, store subscriptions and pending loads (`seq++`), including the LIT pane (`ResizeObserver`, rAF, `tools.destroy()`, `offDesk()`, closing a panel opened from it), the Search pane (timer, `offTarget`, commands window) and Verse/Greek/My Notes. The kind menu and its flyouts remove their sr-only descriptions with them (`describeUnavailable().destroy`).
- **Tours**: every act that opens something registers its `later()` before its first await (`newsheet`, `layout`, `add`, `title`, the notebook tour's `selectWords`), so Escape or Skip mid-step is undone; `freeze(true)` keeps the layout off disk (reload mid-tour leaves the key as it was); each /desk tour refuses to start while `data-desk-tour` is set; the Sheets tour's example mode flushes the reader's pending sheet edits before it starts (`sheet-editor.js` `setExample`).
- **Keyboard**: pane kind menu, title menu and flyouts (arrows, Home/End, Escape one step back, Tab closes); the resize lines are `role=separator` with value text and arrow/Shift/Home/End; Move/Size menu items are the keyboard path for drag; shared single-key shortcuts stand down in menus, dialogs and `[data-desk-dock]`.
- **Help page claims** (compared against code): MAX_PANES (4), TRASH_DAYS (30), MAX_FOLLOWING (6), the title menu's items and order, the pane menu's Add pane/Move/Size, "Stay here", the Layout window's items and "Reading" (the four switches `reading-display.js` turns off), the Print menu's three choices, "Print ▸" labels ("This verse"/"These verses"/"This selection…"), the "Pinned footnotes" group, the Greek tab's keys (arrows, Home/End, the splitter's Up/Down/Shift/Enter), Study menu entries, the Settings tab's "My sheets" link, "Restore all", the three file kinds on /notebook, the present-mode keys (B, period, arrows, Space), the three tours' parts and steps, the "Take the Sheets tour" entry points, and every Sheets button label I grepped (`+ Passage`, `+ From my notes…`, `Continue here?`, `Changed in another tab`, `Show that version`, `Keep mine`, `Save as template`, `This is for a commercial project`, `Add an answer key`, `Presenter view`, `Import into my notebook`). Internal links resolve (`/desk/?desk-tour`, `/sheets/?sheet-tour`, `/notebook/#backup`, `/read/#license-terms`, `#desk-page`).
- **Printing**: `markPieces`/`wrapMarks` join split text nodes back whole; `printLook` always takes the attribute away (afterprint, or the next focus/pointer/key); two prints at once are refused; `printPart` and `printNotes` undo in reverse order and clean up on a failed build; Ctrl+P on /desk prints only the "use the title menu" line; notes print only the notes and highlights on the printed verses, bookmarks never print.
- **Forced colors, dark mode, focus rings** in the pane chrome: the Layout window's pressed shape and the pane lock have forced-colors rules (`desk.css:6760`, `:6774`); no `ch` unit in the desk CSS files; handle focus uses `--focus-ring`.

### Not reached

- No browser: nothing was seen rendered (tour card placement at narrow widths, the drop indicator, the menus' positions near window edges, 200% zoom, a Windows contrast theme beyond reading the rules).
- `search-pane.js` lines ~700-1215 (the verse rows' sheet gathering, the glossary entry view, the Greek result drawing and its commands window) were skimmed, not traced; the part up to the results grouping and `destroy` was read in full.
- `tour.js`'s acts (verse menu, selection, note editor preview, footnote popover, search tray, panel tabs) were read but not exercised; `sheet-tour.js` was read for its runner side only (the sheet content steps belong to the Sheets slice).
- `desk.css` was searched for the rules my slice touches, not read; `float-window.js` (the offers' window) was read once.
- Greek tab internals and the commands window (GK8's), the Sheets editor and its panes (the Sheets auditors'), `src/lib/desk-*.mjs` other than `desk-layout`, `desk-print-notes`, `desk-print-part`, `desk-first-use` (partly) and `desk-inert`.

## Appendix F: The Greek (`GK8`, Sonnet)

Auditor: GK8 (Sonnet 5.5). Checkout: `.claude/worktrees/desk-audit-8`, commit `15986b6e`, 2026-11-09. Read-only; scripts in `...\scratchpad\audit8\gk8\`.
Ran: a text-vs-search-index cross-check of all 137,794 words; a brute-force single-word matcher (about 280,000 query variants); a brute-force construction (chain) matcher against `searchGreekCommands` on 500 random queries; builder round-trip on 1,273 queries; token-soup fuzz (1,500) and huge/hostile inputs on `searchGreekAuto`; a simulated mixed-build (stale `lemmas.json`) recovery; timing and heap with all files loaded; lexicon-shard resolution for every lemma; LIT-vs-Greek verse-set comparison for all 260 chapters; bridge and offers file integrity. Fetched the MorphGNT and UBS README pages for credit wording (summarized by the fetch tool, so Medium confidence).

### Summary

The slice is in good health. The Greek data is internally consistent (text/ and search/ agree word for word, every lemma resolves in the UBS, STEP and LSJ shards, parse groups all reconcile), single-word search matches an independent brute-force oracle across accents, breathings, final sigma, lunate sigma, NFD/NFC, tonos/oxia, iota subscript and adscript, capitals and elision, and the construction matcher equals a brute-force chain enumerator. Hostile and huge input never throws and never takes more than 66 ms. The GK6-9 mixed-build recovery works as designed. No Critical or High findings. What I found is one real precision problem in Strong's-number search, a few keyboard/IME/language-marking gaps, and credit wording that falls short of what two sources ask for.

Counts: Critical 0, High 0, Medium 1, Low 5, Nit 1.

### Findings

#### GK8-1 · Medium · bug · NEW
Searching a Strong's number returns every word of any lemma that MACULA ever gave that number to once

**Where**: `scripts/lib/greek-core.mjs:907` (`also = strongs.get(lemma)...`, the lemma-level tally from `strongsByLemma`, line 796), read by `src/lib/greek-search.mjs:prepareIndex` (`byStrong`, the loop over `[strong, ...also]`) and so by `matchGreek` (kind "strong"), `resolveGreekQuery` (Strong's words in commands) and the Greek tab's Strong's button.

**What happens**: `also` records that a lemma had *at least one* word tagged with another number, but the index and the occurrence lists carry no per-word number, so a search for the other number returns *all* of the lemma's words. Examples run against the committed data (`also.mjs`):
- `G848` lists αὐτός (5,557 words) and ἑαυτοῦ (333); `G848.gen` gives 1,840 verses of "his/her/their" genitives.
- `G1519` (εἰς) also offers ἐν (2,737 words).
- `G3596` (ὁδοιπορέω, one word) offers πᾶς (1,246 words) first, being commonest.
- `G3778`-style cases are fine (οὗτος has real numbers), but 71 lemmas carry `also`; the big ones are αὐτός, σύ, ἐν, ἐγώ, εἰμί, λέγω, οὗτος, πᾶς, Ἰησοῦς, ἔρχομαι.
For εἰμί/σύ/ἐγώ/οὗτος the extra numbers are real forms of the lemma (G1510 finds εἰμί is the documented intent), so the behavior is right there. For ἐν→G1519, πᾶς→G3596, αὐτός→G848 the number belongs to a handful of mis-tagged or reflexive words, and a reader checking "where is G3596 used" is shown the whole of πᾶς. In a command (`G1519.prep, ...`) the lemmas are merged with no chooser, so the results silently include every ἐν.

**Evidence**: `also.mjs`; `lemmas.json` entries `["ἐν","G1722",...,["G1519"]]` (the `also` field). No per-word number exists in `text/` (word arrays hold only `lemma` index, `pos`, `parse`, `sense`), so the build is the only place this can be fixed.

**Fix**: either (a) carry the per-word number where it differs from the lemma's primary (a small side list per lemma in the shard, built from `pairs` in `build:greek`) and match `byStrong` hits by word, or (b) for lemmas whose extra number is carried by under about 5% of their words, do not add it to `byStrong` at all and accept the loss. At minimum, when a Strong's search reaches a lemma only through `also`, say so on its line ("tagged G848 on some words").

**Confidence**: High on behavior; Medium on how many readers it affects (needs MACULA to count per-word tags; sources are not in this checkout).

**Fixed (2026-11-10)** Option (a): `build:greek` now writes each word's own Strong's number where MACULA's tag differs from its lemma's (a tenth field in `text/`, and per lemma a side list of word places in its `occ/` shard, counted in `lemmas.json`'s `also`; search index format 3), and a Strong's search, a Strong's word in a command, the builder's menus and the Greek tab's Strong's button (now the word's own number) keep only the words carrying that number. Words found against the committed data, before and after: G3596 1,247 → 2 (ὁδοιπορέω's one and πᾶς's one), G1519 4,499 → 1,765 (εἰς and 3 words of ἐν), G848 5,890 → 397 (394 of αὐτός, 3 of ἑαυτοῦ), G1510 2,458 → 105; a lemma's own number keeps every word not tagged otherwise (G846 finds 5,163 of αὐτός's 5,557), and a line or readback reached through another number says "tagged G848."

#### GK8-2 · Low · compat · NEW
Enter, Tab and ArrowRight in the search tray and /search field ignore IME and dead-key composition

**Where**: `src/scripts/searchbar.js:1513` (`if (e.key !== "Enter") return; ... submitSearch()`) and the Tab/ArrowRight ghost-completion branch just above it (about 1485); `src/scripts/search.js:1867` (`keydown` Enter calls `updateFromControls`).

**What happens**: Neither handler checks `e.isComposing` (or `keyCode === 229`). Firefox sends `keydown` with `key: "Enter"` and `isComposing: true` for the Enter that commits a composition, so a reader using an IME, or macOS polytonic/accent dead-key input (which composes in all three engines), submits the search at the moment they only meant to commit the character, and a Tab or ArrowRight at the caret end accepts the ghost completion over a pending composition. Greek search is where dead-key accent typing is most likely to be used. The builder's word box (`greek-builder.js:325-334`), `float-window.js:127`, `keyboard-shortcuts.js:126` and `desk/history.js:211` all do guard it, so the main fields are the inconsistent ones.

**Evidence**: grep for `isComposing|compositionstart` across `src/scripts` finds the four guarded places and none in `searchbar.js`/`search.js`/`desk/search-pane.js`. Not reproduced in a browser (no browser in this phase).

**Fix**: first line of each `keydown` handler: `if (e.isComposing || e.keyCode === 229) return;`.

**Confidence**: Medium (code is certain; behavior per browser needs a live check with a Japanese IME and macOS Greek Polytonic).

**Fixed (2026-11-09)** In the search tray and on /search (`isComposing`, or keyCode 229). The Search pane's field has no such handler.

#### GK8-3 · Low · a11y · NEW
Each apparatus note in the Greek tab is marked `lang="grc"` as a whole, though it is mostly Latin sigla

**Where**: `src/scripts/desk/tab-greek.js:499` (`n.lang = "grc"` in `apparatusSection`).

**What happens**: A note reads "3:2 δύναται ταῦτα τὰ σημεῖα WH Treg NA28 ] ταῦτα τὰ σημεῖα δύναται RP". The sigla (WH, Treg, NA28, RP), "+" and "–" are tagged Greek, so a screen reader with a Greek voice speaks or spells them wrongly (WCAG 3.1.2). Every other place that mixes the two (lexicon text, the Show sources titles) goes through `appendLang`/`langRuns` for exactly this reason (GK-2).

**Fix**: build each note with `appendLang(n, text)` instead of setting `n.lang`.

**Confidence**: High (code); the audible effect depends on the voice.

**Fixed (2026-11-09)** Only the Greek runs of an apparatus note are marked `lang="grc"` (`appendLang`).

#### GK8-4 · Low · a11y · NEW
Shift+Arrow on a Greek word is taken, so the Greek cannot be selected by keyboard to copy

**Where**: `src/scripts/desk/tab-greek.js:811-817` (`keydown`; the guard at line 813 excludes Ctrl, Meta and Alt but not Shift).

**What happens**: The tab has a deliberate copy path (E54, the `copy` handler) but Shift+Left/Right/Up/Down, the standard way to extend a selection, are intercepted (`preventDefault`, then `select(to, ...)`), moving word selection instead. A keyboard-only reader can read the Greek and its entries but cannot select a passage to copy it; only a mouse can.

**Fix**: `if (... || e.shiftKey) return;` for the arrow keys, optionally offering "Copy this verse" as a button in the details for keyboard users.

**Confidence**: High (code).

**Fixed (2026-11-09)** Shift with an arrow (or Home and End) passes through, so the Greek can be selected by keyboard.

#### GK8-5 · Low · docs · NEW
Credit wording shown to readers is thinner than two sources ask for

**Where**: `src/lib/greek-credits.mjs:SOURCES` (lines 26-33) and `SEARCH_CREDIT`; `public/greek/LICENSE.txt`.

**What happens**:
- UBS: the `ubsicap/ubs-open-license` page asks that the dictionary be credited as "UBS Dictionary of New Testament Greek, © United Bible Societies, 2023" and noted as adapted from the Semantic Dictionary of Biblical Greek, which derives from Louw and Nida (1988, 1989). The tab says "UBS Dictionary of the Greek New Testament, United Bible Societies, CC BY-SA 4.0": no © year, a different title, no adaptation note. (`LICENSE.txt` does say "based on Louw and Nida".)
- MorphGNT: its page names J. K. Tauber as editor and gives a citation; neither the tab nor `LICENSE.txt` names him. CC BY-SA 3.0 asks for the original author's name where one is supplied.
- `SEARCH_CREDIT` credits UBS and STEP for glosses but not Perseus, though `LICENSE.txt` treats 25 brief glosses as Perseus-derived (cautious route, BVJ 2026-11-07).
- MorphGNT's README still says the SBLGNT text is under the "SBLGNT EULA", while `LICENSE.txt` says CC BY 4.0. Worth confirming once against sblgnt.com/license.

**Fix**: adopt the UBS credit line verbatim in `SOURCES` (and in `LICENSE.txt`), add "ed. J. K. Tauber" to the MorphGNT line, and decide whether the one-line search credit needs Perseus.

**Confidence**: Medium (wording read through a summarizing fetch of the READMEs; confirm in the repos).

**Fixed (2026-11-10)** Decision 6 (BVJ): the Greek tab and `LICENSE.txt` carry UBS's requested credit line verbatim (read from the ubs-open-license README) and name MorphGNT as "MorphGNT: SBLGNT Edition, ed. J. K. Tauber", as its README's citation does; the one-line search credit names Perseus beside UBS and STEP Bible. The SBLGNT's license is CC BY 4.0 (LogosBible/SBLGNT's README, v1.1 of 2022-12-19); MorphGNT's README still says EULA because it predates that.

#### GK8-6 · Low · bug · NEW (Low confidence)
Builder's `composing` flag can stay true and freeze the builder

**Where**: `src/scripts/greek-builder.js:92, 325-334, 437` (`composing` set on `compositionstart`, cleared only on `compositionend`; `render()` and the `input` handler return while it is true).

**What happens**: If a card's word box is removed (the × button is `pressable`, so a mouse press keeps focus and the composition alive) while an IME composition or dead key is pending, and the browser does not fire `compositionend` on the detached input, `composing` stays true: later typing in other boxes is ignored by the `input` handler and `render()` returns early until the window is closed.

**Fix**: clear `composing` in `commit`/`render` entry points other than the `input` handler (or on `blur`/`focusout` of the box, and whenever a card is removed).

**Confidence**: Low (not reproduced; needs a live IME test). Would confirm by starting a composition in Word 2 and pressing Remove word 2 with the mouse.

**Fixed (2026-11-09)** The `input` handler clears a stale `composing` unless the event is composing, and blur clears it. Not yet checked with a live IME.

#### GK8-7 · Nit · longevity · NEW
`greek-data.js` hard-codes the base `"/"` while `greek-find.js` uses `import.meta.env.BASE_URL`

**Where**: `src/scripts/desk/greek-data.js:35,43,50,57` (`load("/greek/...")`, `fetchGreekChapter("/", ...)`) vs `src/scripts/desk/greek-find.js:25`.

**What happens**: Nothing today (site at the root). If the site were ever served under a sub-path, the Greek tab's lexicon loads would 404 while the Greek search still worked. Also `greek-credits.mjs` `GREEK_LICENSE_HREF` is absolute.

**Fix**: take one base constant for all three.

**Confidence**: High; no present effect.

**Fixed (2026-11-09)** `greek-data.js` builds its addresses from `import.meta.env.BASE_URL`.

### Improvements

- Worst-case commands cost: `*.sg, *.sg, *.sg, *.sg ~v &` takes about 0.6 s on the main thread in node (the four-term cap keeps it bounded, `*.noun x4` 87 ms). It is run per keystroke path in the tray; a short debounce or `requestIdleCallback` yield before `matchConstruction` for four any-word terms would avoid a visible stall.
- Memory: with all parse groups and shards loaded (as `*.sg` does) node's heap grew about 150 MB, mostly decoded word objects kept in `greekParseGroups` for the page's life. Keeping the flat arrays and decoding per hit would cut this to a few MB. Desktop only, so not urgent.
- `parseStrong` accepts unlimited leading zeros (`G` + 100,000 zeros + `1` is G1); a `{0,5}` cap would be tidier. Harmless.
- `greek-builder.js:follow()` has a mis-indented `if (readField()) render(); return;` block (cosmetic).
- `readBuilder("*")` yields no cards, and `writeBuilder` writes "", so a field holding only `*` reads as empty in the builder; consistent with the pending-command rule, just worth a test line.

### Questions for the owner

1. Is a lemma-wide Strong's match (GK8-1) the intended trade for the 71 lemmas with `also`, or should the three mis-tag cases (G848, G1519, G3596) be narrowed? If per-word numbers are wanted, the build needs MACULA's per-word tags kept.
2. Should the UBS credit follow the repo's requested wording (GK8-5), or is the shorter "United Bible Societies, CC BY-SA 4.0" accepted?

### What held up

- **Data integrity**: for all 5,465 lemmas, the occurrence shard equals the chapter files exactly (position, form, code, count, folded forms list); 137,793 parsed words reconcile to the 57 parse groups; there are no duplicate lemmas; every lemma's UBS entry (except the 76 that lack a MainId, shown as "no entry") and every Strong's-bearing lemma's STEP and LSJ entry resolve in their shards; no word sense index is out of range (`xcheck.mjs`, `lex.mjs`). The one word with no lemma (John 8:5 Μωσῆς) is a recorded decision (STUDY-DESK.md around line 4398).
- **Normalization**: matching equals an independent oracle for: accents typed or not, breathings, NFD/NFC, tonos vs oxia, ς/σ/ϲ, capitals and final capital sigma, iota subscript, the adscript rule (GK6-3) incl. capitals, elision marks (ʼ ’ '), the Greek question mark and ano teleia (folded away), the micro sign and compat letter variants (`fuzz1.mjs`). Lone Latin letters inside a Greek word return no match, as GK6-4 intends.
- **Transliteration**: every lemma's displayed transliteration, and the same with marks stripped, finds the lemma; Strong's spellings (`g4102`, `G04102`, `strong:4102`, `Strong's 4102`, `G 4102`) all resolve.
- **Commands**: 500 random construction queries (lemma, form, `=`, Strong's, `*`, filters incl. `a/b`, `~n`, `~0`, `~v`, `&`) matched a brute-force chain enumerator verse for verse; the only differences were the two documented behaviors (form fallback, GK8-1's `also`). Builder read/write round-trips on 1,273 queries with identical results.
- **Robustness**: empty, whitespace, 100,000-character commas, dots, stars, quotes, tildes, "and", slashes, combining marks, lone surrogates, `__proto__`/`constructor`, NUL and control characters: no exception, all under 70 ms; over-300-character queries return `tooLong`. `fuzz2.mjs`, `fuzz3.mjs`.
- **Failure paths**: a stale `lemmas.json` with fresh shards triggers one re-fetch with `no-cache`, then the right answer; later searches and command searches stay on revalidating fetches; a failed shard or parse file reports failure rather than "no match" (`stale.mjs`).
- **Display against the LIT**: for every published chapter the Greek and LIT verse numbers are the same set (only the 49 draft chapters differ, having no LIT text); the verse index is dense by verse number, so /search's LIT excerpt beside a Greek hit lines up. Bridge lemmas all exist in the index; its verses all have Greek (one verse, John 8:7 "deviation", lacks the term's lemma and is simply not counted).
- **Parsing text**: all 602 distinct code combinations produce a description and a `parsingQuery` that fits the code itself.
- **Escaping**: result rows, readbacks, lemma lines and credits use `escapeHtml`/`textContent`; error text goes through `textContent` or `escapeHtml`; the lexicon HTML is re-sanitized client-side; credit links to other sites use `target="_blank" rel="noopener noreferrer"`.
- **Fonts**: the tab's serif stack gets Cardo Greek and the text-critical-signs patch at the weights Crimson Text loads; forced-colors rules exist for selected and kin words.

### Not reached

- No browser, so nothing about real IME or dead-key input, focus order, the live-region announcements, the drag handle, or the visual layout was observed; GK8-2, GK8-6 need that.
- `build:greek` and its sources (SBLGNT, MorphGNT, MACULA, UBS, STEP) are not here, so per-word MACULA tags (GK8-1) and the build's own parsing and borrowed-passage logic were audited only through their output.
- `src/scripts/desk/search-pane.js` (/desk's Search pane) and `desk-panes.js` were read only at the Greek seams (error and credit rendering), not end to end.
- Dark-mode selector parity for the Greek and commands CSS was not checked beyond confirming the rules use the ink-token variables rather than hard-coded colors.
- Licensing was judged from README text fetched through a summarizing tool, not from the repositories' LICENSE files; no legal reading.

## Appendix G: Accessibility across the whole desk (`XA8`, Sonnet)

Slice: accessibility and interaction design, all desk files (a lens). Model: Sonnet 5.5. Commit: `15986b6e` (checkout `.claude/worktrees/desk-audit-8`). Date: 2026-11-09.
Ran: code and CSS reading; `xa8/contrast.mjs` (CSS custom-property resolver and WCAG contrast over `global.css`, `desk.css`, `desk-tab.css`, `pages/{desk-page,notebook,sheets-page,desk-help}.css`, `read-mode.css`, `scripture-tools.css`, light and both dark selectors); `xa8/alpha.mjs` (ink-alpha text on each surface); `xa8/combos.mjs` (sheet text colors over highlight tints); `xa8/motion.mjs` (every transition, animation and smooth scroll against `prefers-reduced-motion`); ad hoc CSS scans for focus indicators, forced-colors coverage, target sizes. No browser. Scratch folder: `...\scratchpad\audit8\xa8\`.

### Summary

The desk's accessibility is well above the norm: the menu, tab, dialog, toolbar and splitter patterns follow the APG closely, every focus ring comes from `--focus-ring` or the global `:focus-visible`, all 5 desk smooth scrolls and all 10 desk transitions (opacity, transform, shadow) respect `prefers-reduced-motion`, and the two dark-mode selectors carry identical custom properties. What is left is concentrated in two places: the newest Sheets code (written after the forced-colors work and the BA144 field-border rule) and a handful of Level A/AA details that earlier audits judged by spot check.
Counts: 0 Critical, 0 High, 7 Medium, 8 Low, 0 Nit (15 findings). Top themes: drag-only resizing for pointer users (2.5.7); Sheets editor skips the site's own field-border and forced-colors rules; three accessible names that drop the visible label (2.5.3); the Present mode Blank toggle flips its label while also being `aria-pressed`; a few small-text contrast misses on the cream page background.
Nothing found that makes a feature unusable for a class of users with a keyboard or screen reader. Items are tagged against `STUDY-DESK-AUDIT-1..7.md` and the E log.

### ARIA pattern table (item 1)

| Pattern | Where | Roles and states | Keyboard and focus | Verdict |
|---|---|---|---|---|
| Notebook tabs | `panel.js:255-275, 455-482` | `tablist`/`tab`/`tabpanel`, `aria-selected`, `aria-controls`, `aria-labelledby`, roving `tabindex` (set at `:654`) | Left/Right/Home/End wrap, automatic activation, panel `tabindex=-1` | Pass |
| Pane name menu and its Add pane, Move, Size flyouts | `kind-menu.js:177-330` | `menu`, `group`, `menuitemradio` + `aria-checked`, `menuitem`, trigger `aria-haspopup`/`aria-expanded`; flyout is a sibling `menu` named by the trigger | Opens on the checked radio, arrows/Home/End, Right opens, Left/Escape one step back, Tab closes (focus stays natural), focus back to the button | Pass. By design disabled lines are skipped by arrows and described on the menu (`menu-reasons.js`, DK3-7) |
| Title menu with Add pane flyout | `title-menu.js` | `menu`, `menuitem` on buttons and links, `aria-haspopup=menu/dialog`, `aria-expanded` | As above; Escape one step back; focus-out closes | Pass |
| Layout and Print windows | `desk-page.js:380-540` | `dialog` + `aria-label`, non-modal, toggles use `aria-pressed` | Focus into first control, Escape and Tab-out close, focus to title button | Pass |
| Notebook "Print…" disclosure | `panel.js:561-600` | `aria-haspopup="true"` (means menu) on a button that opens a form-like region | Fine | Fail, see XA8-11 |
| Gap "+ Add" pill and its menu | `sheet-editor.js:1054-1090`, `insert-menu.js` | pill `aria-haspopup=menu`, `aria-expanded`, `aria-controls` only while open; `menu`/`menuitem` | One Tab stop for all pills, Up/Down/Home/End between pills, Escape returns, Tab and outside click close | Pass |
| Save as menu | `sheet-save.js:111-258` | `menu`, `group` named by a `presentation` head, `menuitem` | Arrows, Home/End, Escape, focus-out closes | Pass |
| Rich-text toolbar and its three menus | `sheet-text.js:195-205, 785-905, 1038-1060` | `toolbar` (roving), `aria-pressed`, `menuitemradio` + `aria-checked`, `aria-haspopup` | Arrows/Home/End on the toolbar; menus open on the checked item; Escape/Tab return focus to the button | Pass except the Paragraph style name, XA8-5 |
| Present stage | `sheet-present.js:384-470, 540-600` | `dialog` + `aria-modal`, siblings made `inert`, `toolbar`, live region | Stage takes focus; focus rescued before a control is disabled | Pass; Blank toggle, XA8-6 |
| Presenter view | `sheet-present.js:760-915` | `toolbar`, `timer` (implicitly not live), `status` | Buttons disable under focus with no rescue | Low, XA8-9 |
| Share dialog | `sheet-page.js:918-1010` | native `<dialog>` + `showModal()`, `aria-labelledby` | Opens on first radio, returns focus to the opener on close | Pass |
| Tour card | `tour-runner.js:90-110, 230-250` | `dialog`, `aria-modal=false`, labelled and described | Takes focus every step (so the new step is announced), Escape ends and returns focus | Pass |
| Splitters: pane lines, Chapter View width edges, floating-panel edge, Greek split | `desk-page.js:915-975`, `widths.js:183-300`, `float-resize.js`, `tab-greek.js:205,925` | `separator` + `aria-orientation`, `aria-valuenow/min/max/text` | Arrows, Shift = 10, Home/End on panes | Semantics pass; 2.5.7 gap on three of the four, XA8-1 |
| Note editor, bookmark form, labels, change notice, note popover | `note-editor.js:83`, `bookmark-form.js:50`, `labels-ui.js:38`, `change-notice.js:301`, `notes-margin.js:645` | `dialog` + `aria-labelledby`/`aria-label` | Focus in, Escape, focus back to the circle or verse number | Pass |
| Footnote "⋯" pills | `footnote-pills.js:51-90` | `aria-expanded`, `aria-controls`, `aria-label` with the letter | Escape/focus-out closes; focus kept on "⋯" after a pick | Pass |
| Greek words | `tab-greek.js:430-452, 680-700` | `button` + `aria-pressed`, `lang="grc"`, roving `tabindex` | Arrow keys, single Tab stop | Pass; verbosity, XA8-15 |
| Segmented radios, color and label filters | `note-settings.js:250-276`, `tab-mine.js:182-207` | native radios in `radiogroup`/`fieldset`; `aria-pressed` chips | Native | Pass |
| Sheet parts list | `sheet-editor.js:786-792, 1000-1090` | `list`/`listitem`; ↑ ↓ × have labels | Drag has click alternatives (↑/↓), focus kept and announced | Pass (2.5.7 met here); last-part removal, XA8-10 |
| Undo bar | `undo-bar.js` | permanent `status`, `aria-describedby` on Undo | Held while hovered or focused; Ctrl+Z is the standing alternative (2.2.1 handled) | Pass |

No `combobox`, `listbox` or `grid` exists anywhere in the desk (grep of every `role`), so none were reviewed.

### Findings

#### XA8-1 · Medium · a11y · NEW
**Title: Four families of drag-only resizing and moving have only a keyboard alternative, which WCAG 2.5.7 does not accept**
**Where** `src/scripts/desk/widths.js:183-300` (`handle`, the text-edge and notebook-edge separators on Chapter View); `src/scripts/desk/float-resize.js:33-103` (floating notebook's left edge); `src/scripts/desk/tab-greek.js:205, 925-983` (Greek/entry splitter); `src/scripts/float-window.js:93-120` (every floating window's header drag, used by the Commands window).
**What happens** A reader who uses a trackball, head pointer, eye tracker or voice pointer (and no keyboard) can drag these but cannot set the sizes or positions any other way. 2.5.7 requires a single-pointer alternative to a drag; a keyboard alternative is not one. The Greek splitter's only pointer extra is double-click, which only resets. A floating window that covers text cannot be moved at all by keyboard (2.1.1) or by click, only closed. Audit 2 recorded this very gap for the pane lines (DK-8), fixed it with Make wider/narrower in the pane menu, yet its "Dragging" line (`STUDY-DESK-AUDIT-2.md:1388-1390`) accepted the other handles as "2.5.7 has an alternative" on the strength of arrow keys, which contradicts DK-8.
**Evidence** Read each handler: `pointerdown` plus `keydown` plus (Greek) `dblclick`; no buttons, no menu items. `grep "pointerdown"` over `src/scripts` shows no other path.
**Fix** Reuse DK-8's answer: add "Narrower / Wider" (and "Narrower notes / Wider text") buttons beside "Reset widths" in the Notebook's Settings tab and on the handle's focus, "Larger text / Larger entry" in the Greek tab's header or entry menu, and give floating windows a "Move to the other side" action. Because the text widths are the only ones that are Chapter View-specific, the Settings tab is the cheapest home.
**Confidence** High on the facts, Medium on whether the owner wants to treat floating-window position as "functionality".

**Fixed (2026-11-10)** BVJ chose "click the line" from a sketch of two directions (the other was Narrower and Wider buttons in the Notebook's Settings tab). Each draggable line (the two margin lines, the floating Notebook's edge, the Greek tab's line) opens a small menu when pressed and released without moving, or on Enter or Space: "Wider text" and "Narrower text," "Wider Notebook" and "Narrower Notebook," "Larger entry" and "Smaller entry," and the line's reset. The steps keep the menu open and are disabled, with the reason, at the line's ends. Nothing new shows at rest. A press now writes a width only once it moves, where a click used to store the widths as they stood. The Greek line's double click and Enter reset are now the menu's "Let the entry size itself." A floating window's grip is a button, "Move to the other side," with arrow keys too, which also answers the 2.1.1 half. The help page's Widths paragraph says how. Code: `src/scripts/desk/line-menu.js`, `widths.js`, `float-resize.js`, `tab-greek.js`, `src/scripts/float-window.js`. Tests: `test/desk-xa8-1-line-menu.test.js`, `test/float-window.test.js`.

#### XA8-2 · Medium · a11y · NEW
**Title: The sheet editor's text fields draw their edge at 22 to 25 percent ink, breaking the site's own BA144 rule and WCAG 1.4.11**
**Where** `src/styles/desk.css:6331-6339` (`.desk-rich-editor` border `rgba(var(--ink-rgb), 0.22)`), `:7123-7131` (`.desk-sheet__minutes input` 0.25), `:7612-7623` (`select.desk-sheet__hint, .desk-sheet__hint-text` 0.25), `:7019-7040` (`.desk-sheet__title` and `__subtitle`: border transparent until hover or focus).
**What happens** The rich-text part editor (the main thing a leader types in), the minutes box, the hint field and the Title and Subtitle fields have a boundary of about 1.5:1 on the raised surface (or none until hover), and a fill equal to the surface, so the field is findable only by its placeholder or by hovering. `src/styles/CLAUDE.md:334-343` says a text field's border is `--field-border` (0.58 ink: 3.1:1 on cream, 4.0:1 raised) because "a field whose fill matches its surface has no other edge". Ten other desk fields do use `--field-border` (`desk.css:1559, 2651, 3193, 3369, 3521, 5592, 6489, 7309, 7360, 8377`); these four were written after.
**Evidence** `alpha.mjs`: ink 0.22 on #FAFAF8 about 1.5:1, 0.25 about 1.6:1, 0.58 = 3.98:1. Computed from the tokens in `global.css:115-160`.
**Fix** `border: 1px solid var(--field-border)` on the three; for Title and Subtitle keep the quiet look but show `--field-border` as a bottom border (not transparent) so the field reads as a field. Remember the `/sheets` page pins `--ink-rgb` on paper (`styles/CLAUDE.md:339-342`): write `rgba(var(--ink-rgb), 0.58)` where a field sits on a pinned surface.
**Confidence** High.

**Fixed (2026-11-09)** The rich editor, minutes, hint select and hint text take `--field-border`; the title and subtitle get a `--field-border` bottom edge, full on hover and focus. Test: `test/desk-audit8-f-css.test.js`.

#### XA8-3 · Medium · a11y · NEW
**Title: Small secondary text falls below 4.5:1 on the cream page background and, in one case, everywhere**
**Where** `src/styles/desk.css:2978-2981` (`.desk-cmds__hint`, 12px, ink 0.6); `:206-210` (`.desk-item__kind`, 13px, 0.65); `:7002-7005` (`.desk-sheet__saved`, 12px, 0.65); `add-forms.js:96,218` (`.desk-sheet__from-kind`, 12px, 0.65, in `desk.css`).
**What happens** `.desk-cmds__hint` (the Commands window: the small line under each command name) is 4.23:1 on the window's own raised surface, so it fails in the light theme wherever it appears. The other three pass on the raised surface of the Notebook panel and panes (4.95:1) but are 4.46:1 on the cream page background that the `/notebook` page rows (`.desk-item__kind`, "Note", "Bookmark · Moves" lines) and the `/sheets` page editor ("Saved", the passage chooser's kind line) sit directly on (`notebook.astro` and `sheets.astro` pass no `bg`, so Layout's default cream applies; `.desk-item` and `.desk-sheet` have no background). All four are under 14px, so 4.5:1 applies. Dark mode passes everywhere (4.0 to 8.2).
**Evidence** `contrast.mjs` (80 pair evaluations under 4.5; triaged to these four after removing disabled controls, scoped paper and projector surfaces) and `alpha.mjs`: 0.60 gives 4.23 raised, 3.87 cream; 0.65 gives 4.95 raised, 4.46 cream; 0.62 gives 4.50 raised (so the ghost prompts, `.desk-title__hint--about` and the editor placeholder pass by 0.001).
**Fix** Use 0.7 (5.16 on cream, 5.82 raised) for these four, the value 40 other rules already use; consider raising the three at 0.62 to 0.7 too, since they have no margin.
**Confidence** High.

**Fixed (2026-11-09)** The four lines are ink at 0.7 (5.16:1 on cream, 5.82:1 raised, 7.8:1 or more in dark), and so are `.desk-title__hint` and the editor's ghost prompt.

#### XA8-4 · Medium · a11y · NEW
**Title: "Move it here" and "Save as template" have accessible names that do not contain their visible words (2.5.3)**
**Where** `src/scripts/desk/bookmark-stop.js:40-47` (`moveItHereButton`: text "Move it here", `aria-label` "Move the bookmark on John 3:16 to where I am reading"); `src/scripts/desk/sheets/my-sheets.js:195-197` (`sheetRow`: text "Save as template", `aria-label` "Save John 3 as a template").
**What happens** A voice-control user who says "click Move it here" or "click Save as template" gets no match (the name lacks the contiguous visible string). Both rows repeat per record, so the aria-label is there to tell the rows apart, which is the right goal. Audit 2 recorded "about 60 aria-labels read, no Label in Name failure" (`STUDY-DESK-AUDIT-2.md:2882`); these two slipped through (the second is newer code).
**Evidence** Read the two lines. The other 20-odd text-plus-aria-label buttons contain their text ("Duplicate X", "Delete X", "Edit note on X", "Unpin footnote X").
**Fix** Put the visible words first: `Move it here, the bookmark on John 3:16` and `Save as template, John 3` (or give the button visible text and an `sr-only` suffix, as `notes-margin.js:650` does for Edit).
**Confidence** High.

**Fixed (2026-11-09)** The names are "Move it here, the bookmark on …" and "Save as template, …".

#### XA8-5 · Medium · a11y · NEW
**Title: The Paragraph style button's visible text changes but its accessible name does not (2.5.3, 4.1.2)**
**Where** `src/scripts/desk/sheets/sheet-text.js:793` (`menuButton`, `aria-label = name`, here "Paragraph style"), `:944` (`blockLabel` starts "Paragraph"), `:1094` (`refresh`: `blockLabel.textContent = currentBlockName()` gives "Heading", "Subheading" or "Quotation").
**What happens** In a heading the button reads "Heading" but is named "Paragraph style" (no "Heading" in the name), so "click Heading" fails by voice and a screen-reader user is never told the current style from the button (it is only on the menu's checked radio). The same builder gives the Style and Text alignment buttons stable names with stable visible text, so only this one mismatches.
**Evidence** Read `menuButton` and the three uses; `aria-label` is set once at build.
**Fix** In `refresh`, set `aria-label` to `Paragraph style: ${currentBlockName()}` (visible word first would be `${name}` then the value; visible text "Heading" is then contained).
**Confidence** High.

**Fixed (2026-11-09)** The button's name becomes "Paragraph style: <current>" on each refresh.

#### XA8-6 · Medium · a11y · NEW
**Title: Present mode's Blank buttons change their label and set `aria-pressed`, so a screen reader says "Show screen, toggle button, pressed"**
**Where** `src/scripts/desk/sheets/sheet-present.js:489-490` (stage: "Blank" becomes "Show screen") and `:872-873` (presenter view: "Blank the room's screen" becomes "Show the room's screen"), each with `aria-pressed` on the line above.
**What happens** The pressed state and the flipped label say opposite things: when the room is dark, the leader hears "Show screen, pressed" and has to work out that pressed means blank. The Greek tab hit the same pattern and fixed it (`tab-greek.js:140-143`, GK3-8: "a label that also flips ... read as 'Hide sources, pressed'"), but Present was not given the same treatment. Visible text "Show screen" is also what a sighted user would say; the rule (APG toggle button) is a fixed label plus a changing state.
**Evidence** Read both draw functions; `grep aria-pressed` shows these two are the only buttons that both flip text and set the state.
**Fix** Keep the label fixed ("Blank the screen" / "Blank the room's screen") and let `aria-pressed` carry the state; or drop `aria-pressed` and keep the changing label (then it is not a toggle). The first matches the project's own precedent.
**Confidence** High.

**Fixed (2026-11-10)** Decision 11 (BVJ): both Blank buttons keep their label (“Blank”, “Blank the room’s screen”) and `aria-pressed` alone says the room is dark, as the Greek tab's toggle does (GK3-8); the pressed style was already drawn. A step in `test/desk-audit8-dom-sheets-output.test.js`.

#### XA8-7 · Medium · a11y · NEW
**Title: The Sheets editor's styles (about 1,800 lines of `desk.css`) have no forced-colors rules, so several states disappear in Windows contrast themes**
**Where** `src/styles/desk.css:6804-8600` (the Sheets editor, written after the forced-colors blocks at `:6670` and `:6689-6830`, which stop at the Greek, layout and search controls); specifically `.desk-sheet__chip[aria-pressed="true"]` (`:7574-7583`), `.desk-sheet__drop` (`:7058-7062`), `.desk-rich-editor:focus-within` (`:6342-6344`), `.desk-sheet__btn--primary` (`:6868-6872`), `.desk-sheet__after-btn` (`:7193-7208`).
**What happens** In forced colors, backgrounds, `border-color` and `box-shadow` are replaced by system colors: (a) the key-term chips' pressed state (a blanked term) is a green tint, a green border and weight 600, so it becomes weight 600 alone, and the "Blank a key term" chip row is the one place a leader sees which terms are blanked; (b) the drag-and-drop insertion line is a 3px `background`, which draws nothing, so a mouse drag of a part shows no drop position; (c) the rich-text editor's focus signal is a `border-color` change plus `outline: 0` on the text, which forced colors overrides (the toolbar appearing and the caret remain, so this is a weak but real 2.4.7 gap); (d) primary and secondary buttons differ only by fill and border color, so "Done", "New sheet" and "Print" look like their neighbors; (e) the gap pill (`border: 0`, green fill, `opacity: 0` until hover or focus) becomes bare text on hover. The Greek, layout and search chips already have a rule (`desk.css:6755-6790`, BA141, GK3-3), and `styles/CLAUDE.md:344-352` documents the pattern; the Sheets styles never got their turn.
**Evidence** Selector scan: no rule in any `@media (forced-colors: active)` block names a `.desk-sheet__*` selector (`grep` shows the blocks at `desk.css:1260,1441,1977,2133,2388,3297,6670,6689`, `sheets-page.css:1492` only).
**Fix** One block after the Sheets styles: pressed chip `border: 2px solid Highlight` (as `desk-greek__show-sources` at `:6755`); `.desk-sheet__drop` `border-top: 3px solid Highlight` instead of background; `.desk-rich-editor:focus-within { outline: 2px solid Highlight }`; `.desk-sheet__btn--primary { border: 2px solid ButtonText }`.
**Confidence** Medium (reasoned from the forced-colors spec and the project's own rules; not rendered, so a Chrome forced-colors emulation pass should confirm).

**Fixed (2026-11-09)** A forced-colors block after the Sheets rules covers the pressed chip, the drop line, the editor's focus, the primary button, the gap pill and the check meter. Checked 2026-11-10 with Chromium's forced-colors emulation, light and dark: the editor's fields and focus ring, the pressed chip against a plain one, primary against quiet, the meter's fill and over-limit fill, and the drop line all show.

#### XA8-8 · Low · a11y · NEW
**Title: After importing a shared sheet, a screen-reader user hears only "the Study Desk, link", never "Copied into your notebook"**
**Where** `src/scripts/desk/sheets/sheet-page.js:884-893` (`sharedBanner`, the take handler).
**What happens** The handler builds a `<p role="status">` already containing the sentence, prepends it, and immediately calls `open.focus()` on the link inside it (SH5-10, to stop focus falling to the page top). A live region that is inserted with its text is usually not announced (the desk's own `undo-bar.js:23-25` says so), and the focus move supersedes it, so the confirmation is missed. A sighted user sees it.
**Evidence** Read the handler; no other `say`/`announce` is called on this path.
**Fix** Announce through an existing permanent region (`announce` from `undo-bar.js`, as `sheet-page-list.js` already imports) with the same words, in addition to the visible line.
**Confidence** Medium.

**Fixed (2026-11-09)** The import announces through `announce`, and the line lost its `role=status` so it isn't read twice.

#### XA8-9 · Low · a11y · NEW
**Title: In the presenter view, pressing Next, Previous, Reveal or Cover again can drop keyboard focus when it disables the button**
**Where** `src/scripts/desk/sheets/sheet-present.js:882-886` (`showPresenterView`, `draw`).
**What happens** `prev.disabled`, `next.disabled`, `reveal.disabled` and `hide.disabled` are set from the new state with no focus rescue. A keyboard or screen-reader leader who presses Enter on Reveal for the last blank, or Next to reach the last screen, loses focus (Chrome and Firefox return focus to `body` when a focused control becomes disabled). The keys still work from the document, but Tab restarts at the top and a screen reader loses its place. The stage view handles exactly this (`:468-477`, BA79); the presenter view, written alongside it, does not. The project uses `aria-disabled` plus `busy()` elsewhere for the same reason (NB3-8).
**Evidence** Read both `draw` functions side by side.
**Fix** Before disabling, if `document.activeElement` is the button going off, move focus to the `controls` container (`tabindex=-1`) or the next enabled button, as the stage does.
**Confidence** Medium (browser-dependent behavior; read, not run).

**Fixed (2026-11-09)** With SH8-6.

#### XA8-10 · Low · a11y · NEW
**Title: Removing the last part of a sheet leaves keyboard focus nowhere**
**Where** `src/scripts/desk/sheets/sheet-editor.js:1111-1122` (`removeCard`, `after`).
**What happens** With one part left, pressing its × removes the card, `next` is undefined, and the fallback is `moduleList.focus?.()`. `moduleList` (`:786`) is a plain `div role=list` without `tabindex`, so `focus()` does nothing and focus falls to the page (the `showUndo` announcement still speaks). With two or more parts it works.
**Evidence** Read `removeCard`; grep shows `moduleList` never gets a `tabIndex`.
**Fix** Focus the "Nothing on this sheet yet" paragraph (give it `tabindex=-1`) or the add bar's first button; `desk-sheet__none` is created at `:909`.
**Confidence** High.

**Fixed (2026-11-09)** Removing the last part moves focus to the empty-sheet line (`tabindex=-1`).

#### XA8-11 · Low · a11y · NEW
**Title: The Notebook's "Print…" button advertises a menu but opens a form**
**Where** `src/scripts/desk/panel.js:567` (`aria-haspopup="true"`), `print-menu.js` (the region: a passage field, three links or buttons, a status line).
**What happens** `aria-haspopup="true"` means `menu`, so a screen reader says "Print, menu button" and the reader expects arrow-key menu behavior; the content is a text field plus links, so arrow keys do nothing. The `/desk` header opens the same content as a `role=dialog`. A disclosure needs only `aria-expanded` and `aria-controls`, both already set.
**Evidence** Read the two files; `grep aria-haspopup` shows every other use names its real type (`menu` or `dialog`).
**Fix** Remove `aria-haspopup`, or set `"dialog"` and give the region `role="dialog"` with a label as the `/desk` copy has.
**Confidence** High.

**Fixed (2026-11-09)** The Print button no longer has `aria-haspopup`; `aria-expanded` and `aria-controls` stay.

#### XA8-12 · Low · ui · NEW
**Title: In dark mode, a leader's own color-plus-highlight combinations can fall below 4.5:1**
**Where** `src/styles/desk.css:6124-6160` (`--desk-rich-*` colors), `:1209-1230` (`--desk-hl-*` tints, used as the sheet's `data-mark`).
**What happens** A part's text can carry both a color and a highlight. In dark mode on the raised surface: red text on a yellow mark is 3.96:1, gray on yellow 4.01, blue on yellow 4.35; on the surface (#161617) red on yellow is 4.30 and gray on yellow 4.35. Light mode is fine (lowest 3.98 only on cream, which is not where the editor sits). These are two deliberate choices a reader combines; the printed and `/sheets` paper versions use their own pinned light values and pass.
**Evidence** `combos.mjs` (every 5 colors by 4 marks, both themes, both surfaces).
**Fix** Lower the dark-mode yellow tint from 0.24 to about 0.16 or lighten the red, gray and blue by a step; or accept it as a user combination and note it in the help page.
**Confidence** High on the numbers, Low on the impact.

**Open (2026-11-09)** A leader's color choices: a design call.

#### XA8-13 · Low · a11y · NEW
**Title: The desk's inputs use the browser's default placeholder color, which is under 4.5:1 on the raised surface and in dark mode**
**Where** every desk `placeholder` (`note-editor.js:115`, `labels-ui.js:52`, `kept-list.js:48`, `tab-mine.js:196`, `bookmark-form.js:64,69`, `print-menu.js:67`, `sheet-editor.js:754,759`) and no `::placeholder` rule in `desk.css` or `global.css` (only `.footer-newsletter__input::placeholder`).
**What happens** Chrome's default placeholder is mid-gray (about #757575, 4.4:1 on #FAFAF8 and about 3.6:1 on the dark #1d1d1f), Safari's lighter. Placeholders count as text under 1.4.3; the Sheet Title field uses "Title" as its only visible cue.
**Evidence** None computed in a browser (no browser rules this slice); the default value is from Chromium's UA stylesheet from memory.
**Fix** `::placeholder { color: rgba(var(--ink-rgb), 0.7); opacity: 1 }` once in `global.css` for `.desk-*` fields.
**Confidence** Low (confirm: DevTools computed `::placeholder` color in both themes).

**Fixed (2026-11-09)** A `::placeholder` rule for the desk's fields: ink at 0.7 with `opacity: 1` (5.16:1 on cream, 7.8:1 or more in dark). Also LV8-3.

#### XA8-14 · Low · a11y · NEW
**Title: A floating Notebook and the fixed undo bar can cover the element that has keyboard focus (2.4.11)**
**Where** `src/styles/desk.css:44` (`.desk-rail--floating .desk-panel`), `:294-312` (`.desk-undo__bar`, `position: fixed; bottom: 20px`, z-index 950); no `scroll-padding` outside menus (`desk.css:5867`).
**What happens** At a narrow window the Notebook floats over the right of the text; tabbing through links and footnote references can land under it, and the browser scrolls the focused element to the nearest edge with no allowance for fixed overlays, so the last focusable element in the viewport can sit under the undo bar for its 10 seconds. The bar has no Escape; it times out. The tour card is non-modal and fixed too. Each covers part of a focus, rarely all of it.
**Evidence** Read the CSS and `undo-bar.js`; not reproduced.
**Fix** `html[data-desk-panel] { scroll-padding-bottom: 72px }` while a notice shows, and an Escape handler on the bar.
**Confidence** Low (needs a browser at 640 CSS px).

**Partly fixed (2026-11-09)** `scroll-padding-bottom` while the undo bar shows. The floating Notebook covers the page sideways, which scroll padding can't help.

#### XA8-15 · Low · usability · NEW
**Title: Disabled row buttons explain themselves only in a `title`, which a keyboard or touch user never sees**
**Where** `src/scripts/desk/sheets/my-sheets.js:190-205` (Duplicate and Save as template `disabled` with `title` reasons: "Made with a newer version...", "This sheet has only passages...").
**What happens** A disabled button is not focusable and shows its tooltip only on mouse hover, so a keyboard or screen-reader leader sees a dead "Save as template" with no reason. The desk's menus solve this with a visible reason plus `aria-describedby` on the menu (`menu-reasons.js`).
**Evidence** Read; `grep "title = " my-sheets.js`.
**Fix** Use `aria-disabled="true"` plus an `sr-only` description (and the existing `busy` pattern) so the control is focusable and described, or print the reason under the row.
**Confidence** High.

**Fixed (2026-11-09)** Unavailable row buttons are `aria-disabled`, with the reason in visually hidden text and a click guard.

### Improvements

- Three announcers wait a frame before writing (`desk-page.js:586`, `sheet-editor.js:197-200`, `search-pane.js:312-314`) while `undo-bar.js:113-118` uses a 50ms timeout with a comment that a frame never comes in a tab that isn't showing; two calls in one frame also lose the first. Use the timeout version everywhere; low impact, but one shared `announce` would stop the copies drifting (the CLAUDE.md says they differ on purpose).
- `chapter-tools.js:990` (`note.scrollIntoView({ behavior: "smooth" ...})`) is the one smooth scroll in the reader scripts without a reduced-motion check (outside the desk, reader-tools slice).
- The bookmark margin marks tell "moves" from "stays" by red versus gold and by name (`bookmark-mark.js`); the name is only a tooltip for a sighted color-blind reader. A second shape cue (a notch or a different glyph) would make it work without color.
- `.present-stage__strip` fades opacity in 0.2s with no `prefers-reduced-motion` guard (`sheets-page.css`); fades are low risk but it is the only open one in `motion.mjs`.
- The rich-text toolbar appears only on focus-within (`desk.css:6363`), so a screen-reader user browsing a sheet never meets it; a one-line `aria-describedby` on the text ("Formatting toolbar: Tab") would help discovery.
- The 6 `outline: none` rules (`desk.css:53,1075,2731,3011,4078`, `sheets-page.css:983`) were each checked; every has a replacement or a documented reason.

### Questions for the owner

1. Should floating windows (the Commands window, the Greek builder) be movable without dragging? Today they can only be closed or dragged (XA8-1). A "Move to other side" menu item is the cheapest answer.
2. In Present mode, is the changing label ("Show screen") or the toggle state the preferred signal? The Greek tab chose the toggle (XA8-6).
3. Greek words are `button`s with `aria-pressed`, so a screen reader hears "button, not pressed" after each word of a verse (about 400 words per chapter). It matches the click-a-word design, but a screen-reader reader gets a verse as a string of controls. Is a group per verse with the word buttons inside, or a "Read this verse as text" line, wanted? (I did not file it as a defect: it is the interaction the tab exists to offer.)

### What held up

- **Contrast tokens**: dark mode custom properties match between the media query and `[data-theme="dark"]` for every property set in the five desk stylesheets (zero mismatches, `contrast.mjs`). Text at ink alpha 0.7 and above, all `--green-text` and `--green-deep` pairs, the undo bar, the tour card, and the Present stage (`#f2eee4` 15.9:1, quiet `#a7ada3` 8.0:1, accent 9.4:1) pass. Sheet text colors on the white paper and on the raised surface in light mode all pass (6.3 to 7.1:1). Focus rings: 47 uses of `outline: 2px solid var(--focus-ring)` plus the global `:focus-visible`; 3:1 holds on every surface.
- **Reduced motion**: all 5 desk smooth scrolls check `matchMedia` (`notes-margin.js:718`, `pins.js:223`, `read-marks.js:96`, `shell.js:60`, `tour-runner.js:256`), and of the 10 rules with a `transition` in the desk stylesheets, 9 are covered by a `reduce` rule or a `no-preference` wrapper (the tour card's fade is inside `no-preference`); the tenth, `.present-stage__strip`, is in Improvements.
- **Target size (2.5.8)**: no desk control is under 24 CSS px in both dimensions except the highlight flag (18px with a 24px `::after`, `desk.css:1950`), the gap pill (22px high but alone in its row, spacing exception) and the footnote "⋯" (36 by 22, alone in the margin, spacing exception). ↑ ↓ × are 26px, toolbar buttons 28px, circles 28px, splitter handles have 20px hit areas.
- **Dragging (2.5.7)** for panes (Move left/right/up/down, Size menu, Show in this pane) and for sheet parts (↑ ↓ buttons, announced) is satisfied; the only misses are in XA8-1.
- **Visible label in name** across the other ~20 text-plus-aria-label buttons (Duplicate, Delete, Edit, Unpin, Remove, Copy, Start following).
- **Announcements**: the undo bar's permanent `status` region plus the "press Ctrl+Z" sentence, one region per surface (no double announcements found in `showUndo`/`announce`/`DONE`), mark making, layout changes and sheet edits all speak; delete-and-undo and Escape paths return focus.
- **Focus on removal or redraw**: `focus-keep.js`, `focusGone`, `keepPopover`, `landFocus`, the insert-menu close guard (SH5-1), the print and layout windows, and the conflict line's Show/Keep (focus restored to the editor) all handled. The one miss is XA8-10.
- **Reading experience with a screen reader**: marks, notes and bookmark flags sit in one `<aside>` at the end of `<body>`; highlights are CSS Custom Highlight (no text nodes); the reader's marks are folded into each verse number's accessible name (`verse-labels.js`), so the verse text is unchanged and the reading order is not reordered. Footnote pills add two named buttons after each footnote, which is noise for someone reading footnotes aloud but never inside the verse text. Greek words are the exception (question 3).
- **200% zoom (640 CSS px)**: the desk is gated on device (`Layout.astro:129`, user agent and touch), not on width, so it stays on; there is no width media query in `desk.css`, the Notebook floats folded to its tab, margin notes fall to circles or none (`marginMode`), and `/desk` layouts that need more room are disabled with a visible reason. Read, not rendered.
- **Text spacing (1.4.12)**: no fixed-height container around running text beyond the cut notes, which expand on hover and focus (`.desk-note--cut`); the pill (22px) has headroom for 1.5 line height.
- **Zero `combobox`, `listbox`, `grid`, `tree`**: nothing to review; the passage and search fields are plain inputs with groups and status regions.

### Not reached

- No browser: nothing rendered. All forced-colors, 200% zoom, 2.4.11 and placeholder-color claims are from CSS and the specs; XA8-7, XA8-13 and XA8-14 each need a short Chrome pass (forced-colors emulation, computed placeholder color, 640 CSS px).
- Screen-reader speech was not run; verdicts on announcements are from the live-region code paths.
- Read closely: `panel.js`, `kind-menu.js`, `title-menu.js`, `undo-bar.js`, `insert-menu.js`, `add-bar.js`, `my-sheets.js`, `sheet-save.js`, `sheet-text.js` (toolbar, menus, link form), `tour-runner.js`, `sheet-present.js`, `sheet-page.js` (share dialog, banner), `widths.js`, `float-window.js`, parts of `desk-page.js`, `notes-margin.js`, `tab-greek.js`, `verse-labels.js`. Skimmed or not read: `search-pane.js` (1,242 lines), `tab-mine.js` and `lit-pane.js` beyond their roles, `greek-find.js`, `commands-window.js` beyond the hint, `sheet-lit.js` beyond the chips and meter, `change-notice.js`, `bookmark-follow.js`, the print scripts, `/desk/help` page markup, and the 63 `src/lib/desk-*.mjs` (no DOM). Pagefind, the apps, and keyboard-shortcuts (2.1.4) were out of slice.

## Appendix H: Longevity, maintainability, performance, and compatibility (`LG8`, Sonnet)

Slice: LG8. Model: Sonnet 5.5 (claude-sonnet-5-5). Commit 15986b6e on claude/desk-audit-8. Date 2026-11-09. Ran (all read-only; scripts and a mutation mirror live in `...\scratchpad\audit8\lg8\`): an import-graph script over `src/scripts` and `src/lib` (`graph.mjs`: cycles, layering, DOM in lib); an unused-export scan (`deadexports.mjs`); two CSS dead-selector scans (`deadcss.mjs`, `deadcss2.mjs`, `deadattr.mjs`); a docs checker that extracts every backticked path and identifier from the two desk CLAUDE.md files and looks each up (`docclaims.mjs`); a chunk-closure measurer over `dist/_astro` (`closure.mjs`, `stages.mjs`, `s2.mjs`); scale timings on the pure layers (`scale.mjs`, `leaks.mjs`); and a mutation harness (`mutate.mjs`, 44 deliberate breakages of 9 guard modules, each run against the relevant tests in a copy of `src/`, `test/` and `scripts/` under `lg8\mirror\`, never in the checkout). `git status` was not touched; nothing in the checkout was edited.

### Summary

- The code base is in better shape than its size suggests. The lib layer has no DOM or storage use, no file is orphaned, there are no dead CSS classes (916 selectors' classes all have a producer), and 483 backticked paths and 491 identifiers in the two desk docs resolve to real files and symbols apart from one history mention. Compatibility with the Chrome 105 / Safari 17.2 / Firefox 140 floor is clean.
- The tests are strong where they exist: 34 of 44 deliberate breakages of the sanitizer, the import, the merge, the anchor placement, the pre-paint gate, `makeInert`, the share link and the record limits were caught. Of the 10 survivors, 5 are the gate's runtime branches (LG8-1), 4 are listed in LG8-5, and 1 is an equivalent mutant.
- The weakest spot is the layer that is not unit tested at all: 59 of 102 client modules (745 KB of 1.39 MB) are named by no test, including the runtime half of the gate (LG8-1, LG8-8).
- Performance of the pure layers is linear up to 10,000 records and 300-part sheets (no O(n²) found there). The unmeasured risk is the DOM: My Notes draws every record with no cap and redraws on LIT chapter changes (LG8-2), and the Notebook panel redraws on every notice (LG8-3). One residual quadratic remains in the print check (LG8-4).
- Counts by severity: Critical 0, High 0, Medium 3 (LG8-1, LG8-2, LG8-8), Low 8, Nit 1.

### Findings

#### LG8-1 · Medium · longevity · NEW

The gate's runtime conditions are untested: removing the `data-desk="on"` test from four of its branches breaks no test.

**Where** `src/scripts/desk-gate.js:12` (`const shellHere = document.documentElement.dataset.desk === "on" && readingSurface()`), `:67`, `:74`, `:80` (the `else if ... dataset.desk === "on" && document.querySelector("[data-notebook-page]" | "[data-desk-page]" | "[data-sheet-page]")` branches); `src/scripts/sheet-share-gate.js:23` (`dataset.desk !== "on"`).

**What happens** The root rule is that the desk is downloaded only with `data-desk="on"` (save a shared sheet's viewer on a phone). Two tests hold it: `test/desk-gate-imports.test.js` (no static import reaches the desk) and `test/desk-prepaint.test.js` (the pre-paint script stamps the attribute only where it should). Neither runs `desk-gate.js` itself. Someone who drops `=== "on"` from `shellHere`, or from one of the three page branches, ships the desk's first stage (14.8 KB gzip) to every reading page, or the notebook, desk or sheet page's code (up to 215 KB gzip on `/desk`) to every visitor of those pages, and every test still passes.

**Evidence** Mutation harness (`mutate.mjs`, `muts.json`, `muts2.json`). The same test set that caught the three mutations of the pre-paint script (G2, G3, G4) and the static-import one (G1) let these survive: G5 (`shellHere` without the stamp), G6, G7, G8 (each page branch without the stamp, run against `desk-gate-imports`, `desk-frame`, `bookmark-follow`, `desk-first-stage`), and G9 (`sheet-share-gate.js` loading on a desktop with the desk on, run against `desk-frame`, `desk-sheet-share`, `desk-gate-imports`). `test/desk-frame.test.js:184` and `test/bookmark-follow.test.js:184` do import the gate, but only to test `loadShell` and the pause flag.

**Fix** One test that imports `desk-gate.js` with a stub `document` for each combination (stamp on or off, each of the four marker elements, `readingSurface()` true or false) and asserts which `import()` ran (stub the dynamic imports through a counter, as the bookmark test already stubs the page). Eight cases cover it.

**Confidence** High (the survivors are measured).

**Fixed (2026-11-09)** `test/desk-audit8-h-gate.test.js` runs the gate with the stamp unset, off, empty or another value and fails if any branch loads the desk; `deskPageHere` is covered too. Each test was shown to fail under its mutation.

#### LG8-2 · Medium · performance · NEW

My Notes on `/desk` and the notebook page draw one row per record with no limit, and the /desk pane redraws every row whenever a LIT pane gains or drops a chapter.

**Where** `src/scripts/desk/tab-mine.js:381` (`await store.all()` on every render), `:386` (scope "everything" is the default whenever the host gives no `pageScope`, `:303`), `:430-437` (`list.replaceChildren(...nodes)` over every matched record, built by `rowFor` at `:688`); `src/scripts/desk/desk-panes.js:173`, `:412`, `:417` (`onDeskChapters(() => tab.render())`); `src/scripts/desk/page.js:102-140` (`deskChaptersMoved`, `onDeskChapters`); `src/scripts/desk/kept-list.js:82` (the same shape on `/notebook`).

**What happens** A reader with 5,000 notes opens `/desk` (My Notes beside the LIT is the original layout). The pane reads all 5,000 records, filters and groups them, and builds about 5,000 `li` rows, each a link, a kind line and several buttons (rough order of 50,000 to 75,000 elements). That happens on every note save, delete or label change, and again each time the LIT pane next to it loads or parks a chapter (`lit-pane.js:448, 469, 528, 537` call `deskChaptersMoved`), which is every few screens of reading in the New Testament. The scale scripts in Audit 2 ("nothing quadratic", 5,000 notes) timed only the pure planners.

**Evidence** Code read at the cited lines; there is no slice, page size or `content-visibility` on the rows. Pure layers at the same sizes (`scale.mjs`): `liveRecords` 1.6 ms at 4,000 and 3.4 ms at 8,000; `filterRecords` 5.7 and 9.7 ms; `searchNotebook` 21 and 38 ms; `groupRecords` 0.4 and 1.2 ms. So the cost is not in the data layer; what remains is the DOM build, style and layout of thousands of rows, which I could not time (no browser in this slice).

**Fix** Draw the first 200 rows with a "Show N more" button (keep the count line and filters on the full list), or give the list `content-visibility: auto` with `contain-intrinsic-size` per row; skip the redraw in `onDeskChapters` when the chapter set that moved holds no record of the pane's list.

**Confidence** Medium. The code path is certain; the cost needs one timing: seed 5,000 notes, open `/desk`, and time `tab.render()` and a LIT scroll across a chapter boundary in the Performance panel.

**Fixed (2026-11-10)** Decision 7. My Notes (`tab-mine.js`) and the notebook page list (`kept-list.js`) draw 200 rows and then a "Show N more" button (`LIST_PAGE_SIZE`, `pageRows`, `pagedEntries` in `desk-notebook.mjs`); My Notes appends the next batch without rebuilding the rows drawn, a filter or query resets to a page, and a store redraw keeps what was revealed. The /desk My Notes pane skips the `onDeskChapters` redraw when the chapters that came or went hold none of its records (`touchesChapters`).

#### LG8-3 · Low · performance · NEW

The Notebook panel subscribes to every store notice with no filter, so a following bookmark's writes (every 2 seconds) and another tab's sheet autosaves re-read the notebook.

**Where** `src/scripts/desk/panel.js:642` (`store?.subscribe(() => render())`), `:485-488` (`render` draws the active tab unless the panel is hidden), `src/scripts/desk/tab-mine.js:381` (`store.all()` once per render).

**What happens** On a reading page with "Move as I read" on, the follower writes the bookmark every `MOVE_EVERY_MS` (2,000 ms, `desk-bookmarks.mjs:53`). The /desk pane and the margin skip those writes (`{ except: QUIET_KINDS }` or `redrawAfterMove`, rule 11 of the desk file, BA107), but the panel's subscription has no filter, so each write reads every record (clones every sheet, 1.6 MB for 300 sheets of 20 parts, 9 MB for 600 sheets in `structuredClone` at 5 to 25 ms) and rebuilds the My Notes list. A sheet autosaved in another tab (about 400 ms after typing stops) does the same, which is what DK-5's fix removed on /desk and left here.

**Evidence** Read the subscribers (`grep -rn "subscribe(" src/scripts/desk`): every other long-lived list passes a filter (`desk-panes.js:173`, `:412`, `highlights.js:87`, `read-marks.js:113`, `notebook-page.js:441`, `pins.js:376`, `footnote-notes.js:315`); only `panel.js:642` and `labels-ui.js:140` (open only while its popover is) do not. `STUDY-DESK-AUDIT-2.md:219` records DK-5's caveat "My Notes still subscribe[s] to every write" for the /desk pane, which was fixed; the panel was not named. Clone times from `scale.mjs`. Unmeasured in a browser, and whether `visible()` is false while the Notebook is minimized to its tab was not traced.

**Fix** `store?.subscribe(() => render(), { except: [...NO_CHAPTER_KINDS, MOVE_KIND] })` plus `redrawAfterMove(store, render)`, as `desk-panes.js:412-413` does for the same tab.

**Confidence** Medium on the code path; Low on the felt cost.

Its sheet half is fixed with NB8-1 (2026-11-09).

#### LG8-4 · Low · performance · NEW (a residual of DK6-3)

The print check is still O(surfaces × blanks × tokens): a 300-passage sheet with 10 blanks each freezes the page for about 4 seconds when the participant version is drawn.

**Where** `src/lib/desk-sheet-leaks.mjs:74-106` (`findLeaks`; the inner `hasRun` at `:46-51` scans every token of every surface for every blank), called from `src/scripts/desk/sheets/sheet-copy.js:489-533` (`copyLeaks`) on each draw of the participant version (`sheet-page.js:639`).

**What happens** Audit 6's DK6-3 (marked fixed 2026-11-08) tokenized each surface once, which removed the large constant. The loop over blanks inside each surface is unchanged, so time grows with blanks × surfaces. The 512 KB, 300-module limits admit 300 passages with 10 blanks each.

**Evidence** `leaks.mjs` (no phrase actually leaks, so only scanning is timed; 250-token passages, 120-token text parts, 40-token footnotes): 50 blanks × 30 surfaces 8 ms; 500 × 150 97 ms; 1,000 × 300 370 ms; 3,000 × 900 4.2 s; 7,500 × 900 11.6 s. It is synchronous, so the tab is frozen for that long. Real sheets sit at the small end (DK6-3's own figure for 200 blanks × 300 surfaces is now about 0.1 s).

**Fix** Build one `Set` of tokens per surface (already tokenized) and test a blank's first token against it before `hasRun`, as DK6-3's "optional prefilter" said; with it the scan is about S × B set lookups (about 2.7 million for the 4-second case, tens of milliseconds).

**Confidence** High (measured); Low that any real sheet gets there.

**Fixed (2026-11-09)** `findLeaks` tokenizes each surface once and checks a first-word set before scanning. An equivalence test is in `test/desk-audit8-b-writers.test.js`.

#### LG8-5 · Low · longevity · NEW

Four guards survive deliberate breakage, one of them a rule the shared format states.

**Where and what** (mutation id, file, what was changed, tests run):

- **A5** `src/lib/anchor-core.mjs:184` (`if (score > bestScore)` changed to `>=`, which picks the last of equally good occurrences instead of the first): `anchor-text`, `desk-anchor-dom`, `desk-change` all pass. `STUDY-DESK-FORMAT.md:714` says "on a tie, the first", and the apps run the same vectors, so a client that ties differently passes the shared vectors too. Reproduced: "He said Amen. And we said Amen." with no usable context resolves to `verse`, and with `prefix "said "` to the first Amen; no vector has two occurrences scoring equal at 8 or more.
- **M2** `src/lib/desk-merge.mjs:308` (`cap === at ? CLOCK_TOLERANCE_MS : 0` changed to always allow 5 minutes): a record in a file dated up to 5 minutes after the file's own `exported` should be clamped exactly (BA4); with the change it is not, and no test or vector notices.
- **I4** `src/lib/desk-export.mjs:580` (`if (!Array.isArray(data.records))` disabled): a backup with no `records` array stops reporting "This backup file has no entries in it."
- **N4** `src/lib/desk-inert.mjs:36` (`"style"` removed from `DROP`): `makeInert`'s test passes, so no test asserts that an inline `style` attribute is stripped from a fetched page's parts.

**Evidence** `mutate.out` and `mutate2.out` in the scratch folder. The tenth survivor was judged an equivalent mutant: removing the control-character strip before `new URL` in `plainAddress` (N5; the URL parser drops tabs and newlines itself, and other control characters make the scheme invalid, which falls to the safe relative case).

**Fix** Add to `anchor-vectors.json` a case with two occurrences of equal score and assert the first (the apps pick it up from the fixture); one `desk-merge` test with a record 4 minutes past `exported` in a file; one `desk-export` test for a backup with no `records`; one `desk-inert` test with `style="background:url(x)"`.

**Confidence** High.

**Fixed (2026-11-09)** `test/desk-audit8-h-guards.test.js` covers A5, M2, I4 and N4, each shown to fail under its mutation; `test/desk-inert.test.js` now checks the `div` rather than the parser's wrapper.

#### LG8-6 · Low · longevity · NEW

The Sheets editor and the three modules split out of it import each other (a static cycle), and the helpers that tie them together live in the 1,377-line editor.

**Where** `src/scripts/desk/sheets/part-cards.js:25`, `add-bar.js:20`, `add-forms.js:33` (each `import { button, describe } from "./sheet-editor.js"`) against `sheet-editor.js` importing all three; `sheet-editor.js:125` (`button`) and `:155` (`describe`); `sheet-pane.js:27` imports `button` from the editor too.

**What happens** The cycle works today because `button` and `describe` are hoisted function declarations and nothing uses them at module top level, as the comments in the three files say (`part-cards.js:22-24`). It is held up by those comments alone: a later `const X = button(...)` at the top of `add-bar.js`, or a `const` instead of a function declaration in the editor, would fail at load with a TDZ error that depends on which file loads first, and no test imports `add-bar.js`, `add-forms.js` or `part-cards.js` first (none is named by any test). Tarjan over the static graph (`graph.mjs`) finds this one cycle in all of `src/scripts` and `src/lib`.

**Fix** Move `button` and `describe` to `src/scripts/desk/dom.js`, which already holds the shared helpers (Audit 2, LG-13), and import them from there in all four modules; the cycle disappears.

**Confidence** High.

**Fixed (2026-11-10)** `button` (as `buttons(cls)`, each module naming its usual class once) and `describe` are in `dom.js`; `part-cards.js`, `add-bar.js`, `add-forms.js` and `sheet-pane.js` import nothing from the editor for a helper, so the cycle is gone. `test/desk-audit8-i-maintenance.test.js` runs Tarjan over `src/scripts` and `src/lib` and fails on any static cycle (shown to fail with one put back).

#### LG8-7 · Low · longevity · NEW

Helpers that Audit 2 centralised in `dom.js` have been copied again, byte for byte so far.

**Where** `button(label, cls)`: ten copies (`actions.js:529`, `search-pane.js:119`, `sheets/my-sheets.js:37`, `sheets/search-sheet.js:49`, `sheets/sheet-add.js:146`, `sheets/sheet-editor.js:125`, `sheets/sheet-lit.js:55`, `sheets/sheet-page.js:134`, `sheets/sheet-present.js:64`, and `record-rows.js:48` in another shape); `describe` three (`sheet-editor.js:155`, `sheet-lit.js:68`, `sheet-page.js:175`, differing only in the id prefix); `dateWords` two (`my-sheets.js:43`, `sheet-page.js:182`); `colorOf`, `nameOf`, `highlightedWords` two each (`tab-mine.js:121-150` and `record-rows.js:30-45`); `plural` four (`notebook-page.js:44`, `search-pane.js:125`, `sheets/search-sheet.js:55`, `trash-list.js:31`, and a fifth, different, in `sheets/sheet-lit.js:86`).

**What happens** Nothing wrong today: the copies agree. The pane-and-page split added `my-sheets.js` with its own `button` on purpose ("imports nothing of the editor's", sheets/CLAUDE.md), and `dateWords` was copied into it. The risk is the one LG-13 named: a fix (a date format, a swatch's markup) lands in one copy. `tab-mine.js:133` already carries a comment ("which desk.css gives the colour's tint and underline") that the highlight rule contradicts (desk file rule 7: a tint only, BVJ 2026-10-09; `desk.css:1236-1254` sets `background-color` alone), so one copy's comment has drifted.

**Evidence** `grep` for top-level function and arrow names defined in more than one desk file; diffs of the pairs above.

**Fix** `dom.js` gets `button`; a small `desk-text.js` gets `dateWords` and `plural`; `tab-mine.js` imports `colorOf`, `nameOf` and `highlightedWords` from `record-rows.js` (export them). The /sheets page's light-loading reason for `my-sheets.js`'s own `button` goes away once `button` is in `dom.js`, which is already in the page's graph.

**Confidence** High.

**Fixed (2026-11-10)** The ten `button` copies use `dom.js`'s `buttons` (`record-rows.js`'s, another shape, stays); the three `describe` copies are `dom.js`'s, with one counter; `plural` and `dateWords` are `desk-text.js`'s (`plural` now writes 1,204 with a comma everywhere, as `sheet-lit.js`'s did); `colorOf`, `nameOf` and `highlightedWords` are `record-words.js`'s, whose comment says a tint only. Tests: `test/desk-audit8-i-maintenance.test.js`.

#### LG8-8 · Medium · longevity · KNOWN-OPEN LG-13

Most of the client wiring has no unit test: 59 of 102 modules in `src/scripts/desk/**` (745,287 of 1,393,588 bytes) are named by no test file.

**Where** The largest: `sheets/sheet-lit.js` (49 KB), `search-pane.js` (48 KB), `sheets/sheet-text.js` (46 KB), `tab-mine.js` (45 KB), `sheets/sheet-present.js` (37 KB), `notes-margin.js` (34 KB), `lit-pane.js` (26 KB), `sheets/sheet-copy.js` (24 KB), `tab-verse.js` (22 KB), `change-notice.js` (21 KB), `tour.js`, `sheets/search-sheet.js`, `title-menu.js`, `print-notes.js`, `margin.js`.

**What happens** The pure rules are well tested (63 `src/lib/desk-*.mjs` modules, all named by tests, 1,880 desk tests, no test without an assertion, no skipped test). Focus handling, `inert`, redraw ordering, listeners and teardown live in the client modules, and they are guarded only by hand and by live audits. That is the layer that regressed most in earlier audits (focus loss on redraw BA21, the menu `remove()` re-entry, the cycle in LG8-6). A maintainer two years out has no net under `sheet-editor.js` (1,188 lines in one closure, `createSheetEditor`).

**Evidence** For each client module, a search of `test/` for its path (`desk/<name>`). No jsdom or similar is in `package.json`, and `test/desk-anchor-dom.test.js` is the only DOM-shaped suite. Audit 2's LG-13 (`STUDY-DESK-AUDIT-2.md:371`) counted 55 of 72 desk files imported by no test and left "splitting the large functions" undone; the number of untested files has since grown with the new code.

**Fix** Not a rewrite: a small DOM stub (the gate and `bookmark-follow` tests already have one) and a handful of smoke tests for the modules that own teardown and focus (`sheet-editor.js` destroy and example mode, `panel.js`, `margin.js`), plus the next split of `createSheetEditor`: the other-tab group (`openSheet`'s ask, `askContinue`, `showConflict`, `onVisible`, about 200 lines) beside `sheet-tabs.js`, and `buildSheet`/`buildCard`/`draw` as a `sheet-cards.js` taking `cardHost`; in `desk-page.js` `start()`, the leading-pane follower (`tellFollower`, `startMove`, about 120 lines each) are the next cuts.

**Confidence** High on the count; Medium on which split is safest (a closure's shared state was not traced).

**Partly fixed (2026-11-10)** `test/helpers/browser-env.mjs` is the DOM stub, and the Audit 8 DOM suites since the audit leave 32 of 104 client modules named by no test (59 of 102 at the audit). Five more suites drive `undo-bar.js`, `passage-bar.js`, `labels-ui.js`, `continue-reading.js` and `sheets/add-bar.js` (imported first, so the LG8-6 cycle can't hide). The split of `createSheetEditor` and of `desk-page.js`'s `start()` is not started.

#### LG8-9 · Low · compat · NEW

A shared sheet opened on an iPhone older than iOS 16.4 fails with a message that blames the connection.

**Where** `src/lib/desk-sheet-doc.mjs:398` (a regex literal with `(?<![\uD800-\uDBFF])`, a lookbehind) and `src/lib/scripture-refs.mjs:129` (also a lookbehind, built into `boot.js`); both are in the viewer's static graph (`sheet-page` closure in `dist/_astro`: `desk-sheet-doc.BeGuGP0z.js`, `boot.BayifV12.js`); `src/lib/desk-sheet-share.mjs:107, 113` (`CompressionStream`, `DecompressionStream`); `src/scripts/sheet-share-gate.js:34-40` (the catch).

**What happens** A lookbehind in a regex literal is a syntax error in Safari before 16.4, so the module graph fails to parse, and `CompressionStream` arrives in the same release. The desk's floor (Safari 17.2) is set for desktops, but the phone viewer is the one shared-code exception, and its floor is never stated. On an iPhone on iOS 15 to 16.3 the sheet link shows "The sheet couldn't load. Check your connection and reload the page, or copy the link to open it later," which is wrong: reloading cannot help. Nothing else breaks (the rest of the site does not load this chunk).

**Evidence** `grep -rlE "\(\?<[=!]" dist/_astro/*.js` lists `boot.*`, `desk-sheet-doc.*` and `search-greek.*`; the `sheet-page` closure (`closure.mjs`) includes the first two. Could not run an old Safari.

**Fix** Either state the viewer's floor as Safari 16.4 in the desk file's "Browser floor" paragraph, or make `couldNotLoad` say "This browser may be too old to open a shared sheet. Update it, or open the link on a computer," and swap the one lookbehind in `desk-sheet-doc.mjs:398` for a callback replace so the check is a clear `CompressionStream` test instead of a parse error.

**Confidence** Medium (reasoned from the specifications; not run on iOS 16.3).

**Fixed (2026-11-10)** Decision 10 (BVJ): Safari 16.4 is the phone viewer's floor, stated in the desk file's browser floor. `sheet-share-gate.js` asks `viewerSupported()` (`src/lib/sheet-viewer-floor.mjs`: `DecompressionStream` and a lookbehind) before it imports the viewer, and below the floor says “This browser is too old to open a shared sheet,” with the link to copy. `xmlEscape` drops lone surrogates with a callback instead of a lookbehind.

#### LG8-10 · Low · performance · NEW

Typing in the search box, with the desk on, downloads the whole of `desk.css` (as a JavaScript string) just to style a few result rows, and so does the phone's shared-sheet viewer.

**Where** `src/scripts/desk/notebook-search.js:18, 48` (`import deskCss from "../../styles/desk.css?inline"` then `style.textContent = deskCss`); `src/scripts/desk/sheets/search-sheet.js:27`; `src/scripts/desk/boot.js:11`, which `sheets/sheet-page.js:92` imports for the viewer.

**What happens** The closure of `notebook-search` is 13 files, 206.5 KB raw, 53.2 KB gzip, 46.7 KB brotli; 161.5 KB raw (34.2 gzip, 29.7 brotli) of it is `desk.dPu_2Kcr.js`, the 200 KB stylesheet whose classes these results mostly do not use (`desk-tab.css` alone styles stage one). It loads on the first focus of the search box on any page where the desk is on, including the home page, and the whole sheet is parsed into the page. The viewer on a phone (`sheet-page` plus its static graph, 376 KB raw, 98.7 KB brotli, plus the 17.7 KB `sheets-page.css`) loads it too although a phone shows a read-only sheet.

**Evidence** `s2.mjs` (static closure sizes of `notebook-search`, `search-sheet`, `greek-commands`, `tab-greek`) and `stages.mjs`; the chunk list from `dist/_astro`.

**Fix** Cut the CSS the search rows need into `desk-search.css` (or reuse `desk-tab.css`'s approach), keep the full sheet for the shell and `/desk`. Worth doing only if the launch measurements (a re-measure of stage one is on the desk file's own launch list) show the first search matters.

**Confidence** High on the sizes; Low on whether it matters (one-time and cached).

#### LG8-11 · Low · docs · NEW

A few claims in the desk docs and comments have drifted, and one deliberate exception is recorded only in a test header.

**Where and what**

- `src/scripts/desk/sheets/CLAUDE.md:219`: `desk-layout.mjs` is "86 KB of source"; it is 48,745 bytes (`src/lib/desk-layout.mjs`, 1,109 lines).
- `src/scripts/desk/sheets/CLAUDE.md:28`: "a cross-browser golden-file test of the eight commands"; `sheet-text.js` calls ten distinct commands (`createLink`, `defaultParagraphSeparator`, `formatBlock`, `indent`, `insertHTML`, `insertText`, `outdent`, `removeFormat`, `styleWithCSS`, `unlink`) through 12 `exec(` calls, and the toolbar passes more through a variable.
- `src/scripts/desk/CLAUDE.md` (stage one): `note-settings.js` "imports only light modules, `undo-bar.js` and `page-kind.js`"; it also imports `widths.js` (`note-settings.js:41`), which pulls `keep-reading-place.js` and `desk-greek-split.mjs`. Light, but the sentence is the test's guard (`test/desk-first-stage.test.js`), so it should list it.
- The measured stage-one and shell sizes in the desk file ("14.6 KB", "about 138 KB") are 14.8 KB and 133.2 KB gzip today (`stages.mjs`); the desk file says to re-measure at launch, so this is only to confirm they are in range.
- `tab-mine.js:133` says a highlight swatch has "tint and underline"; the rule is a tint only (see LG8-7).
- MH8-2 (`src/lib/greek-commands-ui.mjs:12` imports `desk-greek.mjs` statically) **is a recorded exception**: `test/desk-gate-imports.test.js` (header and `GREEK_EDGE_*` constants) names it and a test fails if it goes stale. What is missing is a line in `src/lib/CLAUDE.md` or the desk file, where a maintainer looks first.

**Evidence** `docclaims.mjs`: of 1,185 backticked spans in the desk file and 429 in the sheets file, 483 looked like paths and 491 like camelCase or CONSTANT identifiers, and every one was found except runtime or generated paths (`/api/version.json`, `public/search/greek-offers.json`, `parse.json`, `lemmas.json`, `/read/[book].astro`) and `desk-sheet-discussion.mjs`, which the sheets file mentions as a removed module ("2026-10-20 to 2026-11-08"). About 40 further claims (constants, counts, call sites) were checked by hand: `MAX_PANES` 4, `MAX_FOLLOWING` 6, `TRASH_DAYS` 30, `HISTORY_LIMIT` 50, `CLOSE_AFTER_MS` 10,000, `PAUSE_EXPIRES_MS` 12 hours, `MOVE_EVERY_MS` 2,000, `MOVE_SETTLE_MS` 2,500, `MAX_TERMS` 4, `MAX_QUERY_LENGTH` 300, `PROSE_NOTES` false, "five reads" of the stamp in `desk-gate.js`, `READING_SURFACES`, the `DESK_LIMIT` of 130 KB, `sheet-tour.js` importing none of `lit-panel.js`, `sheet-pane.js`, `desk-layout.mjs`, and `sheet-page.js` reaching `sheet-tour.js`, `sheet-page-edit.js` and `sheet-page-list.js` only by `import()`. No path was left stale by the move into `sheets/`.

**Fix** Correct the two numbers, add `widths.js` to the stage-one sentence, add the Greek edge to the desk file's rule 15 or `src/lib/CLAUDE.md`'s module map.

**Confidence** High.

**Fixed (2026-11-09)** The two numbers are corrected, the stage-one sentence names `widths.js`, and `src/lib/CLAUDE.md` records the Greek edge.

#### LG8-12 · Nit · bug · NEW

`crypto.randomUUID()` is called bare in four places and with a fallback in six.

**Where** Bare: `src/lib/desk-records.mjs:146`, `src/lib/desk-sheets.mjs:44`, `src/lib/desk-history.mjs:103`, `src/scripts/desk/sheets/sheet-lit.js:462`, `src/lib/desk-sheet-share.mjs:391, 425`. With a fallback: `bookmark-follow.js:80`, `sheet-tabs.js:15`, `sheet-present.js:238`, `store.js:199`.

**What happens** `randomUUID` exists only in secure contexts (HTTPS or localhost). On the live site this never matters. On a phone or second computer opening a dev server over plain `http://192.168.x.x` (the owner's own way of testing the phone viewer), a new note or sheet throws, while the bookmark tab id does not. The inconsistency, not the live risk, is the point.

**Evidence** `grep` for `randomUUID`.

**Fix** One `newId()` in `desk-records.mjs` (it already has one at `:146`) used by all; the fallback `crypto.getRandomValues` form.

**Confidence** High.

**Fixed (2026-11-10)** `newId` (`desk-records.mjs`, exported) makes every new record, module, blank and history id, with a `getRandomValues` version 4 UUID where `randomUUID` is missing; `desk-sheets.mjs`, `desk-history.mjs`, `desk-sheet-share.mjs` and `sheet-lit.js` use it. The tab and window tokens already had fallbacks and are left. Test: `test/desk-audit8-i-maintenance.test.js`.

### Improvements

- **Un-export what only its own file uses.** 64 exports have no importer anywhere, including tests (`deadexports.out`), such as `desk-export.mjs` `ORIGIN`, `BACKUP_FORMAT`, `BACKUP_VERSION`, `desk-slides.mjs` `blockLength`, `splitBlocks`, `LIST_STEP`; 130 more are used only by tests (internal functions exported for testing, which is fine). Two are dead outright: `src/lib/greek-builder.mjs:37` re-exports `QUERY_AXES as BUILDER_AXES` (nothing reads it) and `src/scripts/desk/history.js:238` exports `redoEntry` (nothing imports it). Unexporting makes "is this API?" answerable.
- **`codeFigure` has no try/catch around `qrSvg`** (`src/scripts/desk/sheets/sheet-copy.js:354`), unlike the slides (`sheet-slides.js:116`) and the file writers (`CODES_MISSING`). `qrSvg` throws for a text over about 2,331 bytes (measured: 2,300 characters ok, 2,400 throws); the codes the print copy draws are short site addresses, so it holds, but a long `code.url` would break the copy's draw.
- **`html:has(.desk-gutter--dragging, ...)`** (`desk.css:1718`, `:4199`) puts a `:has()` on the root, which engines re-evaluate on every subtree change while the desk is on; harmless today, worth a class on `<html>` set by the drag code if a profile ever shows style recalculation.
- **`src/scripts/desk/sheets/CLAUDE.md` has no size cap** (38,885 bytes) while the desk file has one; MH8 noted it too. A line in `test/claude-docs.test.js` would do.
- **Bundle layout is sound**: the 161 KB `desk.css` string is one shared chunk, not copied into the four modules that import it; only `first-stage.js` (stage one) stays lean. If the launch measurement wants the shell smaller, the desk file's own candidate (`desk.css` as a string, 34 KB gzip) is the single biggest piece.

### Questions for the owner

1. Is Safari 16.4 (iOS 16.4) the intended floor for the phone shared-sheet viewer, given `CompressionStream` and the lookbehind regexes (LG8-9)? The desk file states a floor only for the desktop desk.
2. Is the launch plan to keep `/desk` My Notes unpaged (LG8-2)? A cap changes how "Show" and the count line read, so it is a design call, not only a fix.
3. Should the Greek search's static import of `desk-greek.mjs` (the `GREEK_EDGE_*` exception in `test/desk-gate-imports.test.js`) be recorded in `src/lib/CLAUDE.md`, or removed by moving `SIGNS` and `W` to a shared file (MH8-2's fix)? The test header says it is deliberate; the docs do not.

### What held up

**Architecture and layering**
- `src/lib/desk-*.mjs`, `greek-*.mjs` and `anchor-core.mjs` touch no DOM, storage, `fetch` or `navigator` (`graph.mjs`, plus a grep that ignored XML strings and comments). No `src/lib` file imports from `src/scripts`. Only `desk-anchor-dom.mjs` takes DOM nodes, as arguments.
- One static cycle in all of `src/scripts` and `src/lib` (LG8-6). No orphan files: every desk file has an importer except the gate, which `SiteHeader.astro`, `Layout.astro` and the three pages reference.
- The pane and page hosts of the editor share one editor (`sheet-pane.js` 164 lines, `sheet-page-edit.js` 87 lines, both thin) and the list rows (`sheetRow`, `ownTemplatesList`, `templateChooser`) come from `my-sheets.js`; I found no logic copied between the two hosts, only the small helpers in LG8-7. The split has not drifted.
- `sheet-tour.js` imports none of `lit-panel.js`, `sheet-pane.js`, `desk-layout.mjs` as documented, and `desk-gate-imports.test.js` holds the static-import rule (a break of it was caught).

**Dead code**
- All 916 class names in `desk.css`, `desk-tab.css`, `desk-help.css`, `desk-page.css`, `notebook.css` and `sheets-page.css` have a producer in JS or Astro (literally, or by a template prefix: ten classes built as `desk-bookmark-glyph--${...}`, `desk-split--${...}`, `desk-sheet__module--${type}`, `desk-print-mark--${color}`, each confirmed at its building line). The `data-*` attributes and `--desk-*` custom properties in the CSS are all set or used; the one id selector (`#deskTabpanel-greek`) matches the id `panel.js:269` builds. The only dead rule found is MH8's `.desk-home-card__title:focus`.

**Test quality** (mutation results, `mutate.out`, `mutate2.out`; all against copies)
- Caught (34): sanitizer (`javascript:` href, protocol-relative href, control-character strip, unescaped quote in `href`, `<script>` not raw-text, depth cap); import (nesting guard, sheet text not sanitized, trash-held sheet not sanitized); records (size ceiling, `bookKey` check); share link (decompression cap, participant prompts, `verseCopy` leaving); sheet (module cap, byte cap); merge (later-wins reversed, future clamp, malformed skip, trash donor, bookmark place group); anchor (context floor, growth cap, both-sides rule, `outsideVerses`, typography fold, single-occurrence floor); `makeInert` (`javascript:`, `on*` handlers, `iframe`); pre-paint (flag ignored, `userAgentData.mobile`, iPad-as-Mac exclusion); static-import guard (a desk import added to `lit-panel.js`).
- The ten files whose names I held against their bodies (`desk-sheets`, `desk-sheet-paste`, `desk-export`, `desk-hostile-records`, `desk-records`, `desk-merge`, `anchor-text`, `desk-anchor-dom`, `desk-prepaint`, `desk-inert`, plus `desk-sheet-share`, `desk-gate-imports`) assert what they say; failing-test names from each broken guard read as the guard's own description. No desk test lacks an assertion, none is skipped, and none merely greps source except a handful that read a source file on purpose (15 files, each for one structural claim).

**Performance** (pure layers, `scale.mjs`; nothing is quadratic)
- 8,000 notes: `liveRecords` 3.4 ms, listing 3.7 ms, filter 9.7 ms, group 1.2 ms, `searchNotebook` 38 ms, sort 5 ms. `validateRecord` ×10,000 24 ms; `parseImport` 13 ms; `planImport` of 10,000 against 10,000 152 ms, into an empty notebook 33 ms; `toMarkdown` 17 ms; `toBackupJson` 10 ms.
- `placeHighlights` for 2,000 highlights in one chapter 55 ms (4 ms for 50); `overlappingHighlights` under 0.1 ms.
- A 300-module sheet (76 KB): `cleanSheetText` 1.6 ms, `validateSheet` 2.0 ms, an edit's `planSheetChange` 3.9 ms; 300 sheets of 20 parts 1.6 MB, `structuredClone` 5 ms; 600 sheets (9.3 MB) 25 ms.
- Download (gzip / brotli, JS only, `closure.mjs`): a reading page with the desk off, 24 JS files, 116.6 KB raw, 45.4 / 40.4 KB, plus 3 CSS files 97.5 KB raw, 17.5 / 15.4 KB. Desk on adds stage one: 6 files, 39.0 KB raw, 14.8 / 13.1 KB; then the shell: 13 files, 439.5 KB raw, 133.2 / 117.8 KB (of which `desk.css` as a string is 161.5 KB raw, 34.2 / 29.7 KB). `/desk`: 11 files of its own page (24.1 KB raw) plus 28 files (670.4 KB raw, 215.1 / 190.9 KB), CSS 86.4 KB raw (14.7 / 13.0 KB); the sheet editor, panes, Greek tab and verse tab are in that static closure, only `greek-commands` is dynamic. `/sheets`: 15 files (72.5 KB raw) plus the sheet page's 9 files (376.3 KB raw, 111.9 / 98.7 KB), CSS 110.8 KB raw (20.1 / 17.7 KB); the editor (`sheet-page-edit`, `sheet-editor`), tour, slides and every document writer (docx, odt, rtf, pptx, odp) load by `import()` only on use. `/notebook` and `/desk/help`: 14 files, 70.1 KB raw, plus their own page chunk. The desk's `?desk=on` JS stays out of every initial HTML (MH8 confirmed; I re-derived the closures from the chunk files).

**Browser compatibility** (against Chrome 105, Safari 17.2, Firefox 140)
- Not used anywhere in the desk, its lib files, the gate or the Greek search: `Promise.withResolvers`, `toSorted`, `toReversed`, `toSpliced`, `findLast`, `Object.groupBy`, the `Set` methods, `Array.fromAsync`, `Intl.Segmenter`, `requestIdleCallback`, `showSaveFilePicker`, `scrollend`, `navigator.locks`, `RegExp.escape`, `Promise.try`, `Uint8Array.toBase64`, iterator helpers, `AbortSignal.timeout`, the `popover` attribute, `startViewTransition`, `@starting-style`, `@container`, `@layer`, `@scope`, `@property`, `field-sizing`, anchor positioning, `dvh`, `light-dark()`, `oklch`, `text-wrap`, CSS nesting.
- Used, all inside the floor or with a fallback: `CSS.highlights` and `Highlight` (feature-tested by `highlightsSupported`, `note-settings.js:175`, so Highlight is not offered below the floor); `structuredClone` (Chrome 98; `desk-history.mjs:58` falls back to JSON); `CompressionStream` and `DecompressionStream` with `deflate-raw` (Chrome 103, Safari 16.4, Firefox 113; the viewer caveat is LG8-9); `navigator.clipboard.write` with `ClipboardItem` HTML (guarded at `sheet-page.js:227`, falls to `writeText`); `navigator.share` (guarded, falls to copy); `navigator.storage.persist` (guarded, `store.js:291, 425`); `BroadcastChannel` (Safari 15.4); `inert` (Chrome 102, Safari 15.5, Firefox 112); `:has()` (Firefox 121; 18 uses); `Intl.ListFormat`, `Intl.Locale.maximize`, `Intl.DateTimeFormat.formatToParts`; `Object.hasOwn`, `Array.prototype.at`; `document.caretPositionFromPoint` with `caretRangeFromPoint` as the fallback (`sheet-text.js:144-150`, which covers Firefox and Chrome both); `@supports (grid-template-columns: subgrid)` with a flex fallback (`desk.css:6966`); `scrollbar-width` (progressive); `-webkit-mask-image` beside `mask-image`; `-webkit-print-color-adjust` beside `print-color-adjust`; `color-mix()` (Chrome 111; `desk.css:4002, 4011` for the selected Greek word's tint, whose underline box-shadow is the non-colour cue, so Chrome 105 to 110 loses only the tint).
- `document.execCommand` is the one deprecated API on the critical path (`sheet-text.js:162, 170`), accepted for version 1 and documented in `sheets/CLAUDE.md`; the golden-file guard is the safety net.

**Dependencies** (`package.json`)
- One runtime dependency the desk uses: `qrcode-generator` 2.0.4 (MIT, last published 2025-08-07, a small library with no dependencies, used only by `src/lib/qr-svg.mjs` for the print copies' scan codes, the slides, the share dialog and `build:apps-qr`). If it broke or vanished: the codes would be missing (slides and file writers already count and report `CODES_MISSING`; the print copy's `codeFigure` would throw, see Improvements). Nothing else in the desk depends on a package at run time: the zip writer is `src/lib/desk-zip.mjs` over `CompressionStream` with its own `crc32`; .docx, .odt, .rtf, .pptx and .odp are hand-written (`desk-doc-*.mjs`, `desk-slides-*.mjs`) and checked by the strict XML reader in `test/helpers/xml-check.js`; the QR, the Greek data and the fonts are the only outside material. `fake-indexeddb` (dev) runs the real `store.js` in tests; `opentype.js` (dev) builds the two committed fonts. Both are build-time only.

### Not reached

- No browser: nothing was timed in a real browser (LG8-2 and LG8-3's cost, style recalculation of `html:has()`, `desk.css` parse), and no engine other than Node was run, so Safari and Firefox behaviour is from the specifications and the code's feature tests.
- The mutation sample is 44 breakages in nine modules; the store (`store.js` transactions, `desk-store-core`), `desk-history`, `desk-sheet-tabs` and the Greek search were not mutated.
- The per-function length table is MH8's; I did not trace the shared state in `createSheetEditor` or `start()` to prove a split safe (LG8-8 names candidates).
- `findLeaks` was timed with synthetic text; `desk-slides`, `desk-present` and the document writers were not scaled to 300-part sheets.
- Dependabot, `npm audit` and the supply chain of the desk's dev dependencies were not checked.

## Appendix I: Copy rules (`CP8`, Haiku)

Slice: every reader-facing string in the Study Desk (src/scripts/desk/**/*.js, src/lib/desk-*.mjs, src/pages/desk.astro, notebook.astro, sheets.astro, desk/help.astro). Model: Haiku 5.5. Commit: 15986b6e (claude/desk-audit-8, equal to origin/main). Date: 2026-11-09. Read-only: nothing in the checkout was changed.

What I ran:
- A TypeScript-scanner extraction (regex-aware) of the 169 in-scope files: 17,048 string tokens with file and line (scratch: `...\scratchpad\audit8\cp8\extract2.cjs`, `strings2.jsonl`).
- Mechanical checks on those values and on the four pages (`cp8\rules.cjs`, `cp8\names.cjs`, `cp8\nocomment.sh`): British spellings, quote and punctuation placement, serial lists, em dashes, old names, ellipses, spacing, doubled words, and name variants.
- Every hit read in context. I read src/pages/desk/help.astro in full. Each quoted label in the help was checked against the code.
- Reader-visible paths traced for the few hits that might be developer-only (console messages, thrown errors, validator text, import reports).

### Summary

- Rule 1 (American spelling): 0 hits.
- Rule 2 (periods and commas inside closing quotes): 0 hits.
- Rule 3 (Oxford comma): 0 hits; 42 candidate serial phrases read.
- Rule 4 (straight quotes and apostrophes in reader text): 5 lines reader-reachable, all in one Markdown-import report (desk-records.mjs), plus 1 quoting inconsistency (sheet-page.js:928). Everything else with a straight apostrophe is a console message or a thrown developer error.
- Rule 5 (em dashes): 0 in reader text. Two em dashes are in HTML entity decode tables (code).
- Rule 6 (old names): 0 of "Study View", "Reading View", "Reading Mode". "Study Desk preview" appears in 4 reader-facing places (owner's call).
- Rule 7 (one name per thing): 10 families with variants, listed below for the owner to pick.
- Rule 8 (ellipsis): 7 items. Two are clear fixes in the code or help, one is a help sentence that contradicts itself, four need the owner's call.
- Rule 9 (double spaces, stray spaces, doubled words): 0 hits.
- Other copy defect (outside the nine rules): one sentence missing its verb, in two places.

Counts: 0 clear rule violations in the prose of the site's copy, apart from the items below, which are small. The copy is consistent on spelling, quotation, lists and dashes. The real work is the naming and the ellipses.

---

### Rule 1: American spelling

None found. Searched all extracted string values and the four pages for about 70 British forms: colour(s), favourite, behaviour, centre, grey/greyed, cancelled/cancelling, labelled/labelling, modelled, travelled, programme, honour, neighbour(ing), analyse, judgement, licence, catalogue, dialogue, whilst, amongst, learnt, spelt, -ise and -ize verbs (organise, recognise, customise, summarise and others), -our, -re, -ogue, -yse, -ence and -lled forms.

The only matches were code identifiers (`labelled` at src/lib/desk-change.mjs:498 and 502; `aria-labelledby` attributes), or comments (for example src/scripts/desk/kind-menu.js:25 and 201, src/scripts/desk/glyphs.js:9). The help page already says "grayed out" and "minimizes".

### Rule 2: periods and commas inside closing quotation marks

None found. Searched for `”.`, `”,`, `’.`, `’,`, `".`, `",` in all string values and in the four pages. Every quoted phrase in the help and in the tour copy closes correctly (for example src/lib/desk-first-use.mjs:181-183, 195, 207; src/pages/desk/help.astro:64-65, 133, 147, 149, 159-160).

Two hits are comments, not reader text: src/lib/desk-first-use.mjs:167 and src/scripts/desk/greek-find.js:250.

Question marks: each `?”` is correct (the question is the quoted text, e.g. src/lib/desk-sheet-templates.mjs:98-171, src/pages/desk/help.astro:147). No `”?` placement found.

### Rule 3: the Oxford comma

None found. I read 42 candidate serial phrases (", X and" / ", X or"). All conform. Examples: src/lib/desk-first-use.mjs:268 "notes, highlights, and bookmarks"; src/lib/desk-first-use.mjs:482 "Print it, present it to a room, or share it"; src/scripts/desk/sheets/sheet-page.js:286 "copied, or saved as a document"; src/scripts/desk/sheets/sheet-tour.js:402 "printed, presented, and shared"; src/pages/desk/help.astro:419-420 "its dictionary form, its parsing in words, its Strong’s number, and an entry from a lexicon"; src/scripts/desk/kept-list.js:156 and src/scripts/desk/tab-mine.js:453 "“Add bookmark,” or “Highlight”" (the comma sits inside the quote, as it should).

Not a serial "and/or" list: src/lib/desk-sheet-templates.mjs:145 "A, B, then sharing" (a sequence, not a conjunction list).

### Rule 4: straight quotes and apostrophes in reader-facing text

Reader-reachable:

| Where | String (shortened) | Rule | Suggested fix |
|---|---|---|---|
| src/lib/desk-records.mjs:425 | `"the note's target is empty"` | Straight apostrophe | `the note’s target is empty`, or reword in plain words (see note below) |
| src/lib/desk-records.mjs:428 | ``bookKey "${r.bookKey}" is not a book`` | Straight double quotes; developer field name | Curly quotes, or a plain-words message such as “Romans” is not a book |
| src/lib/desk-records.mjs:439 | ``color "${r.color}" is not one of …`` | Straight double quotes; developer field name | Curly quotes and a plain-words message |
| src/lib/desk-records.mjs:446 | ``marker "${r.marker}" is not one of …`` | Same | Same |
| src/lib/desk-records.mjs:470 | ``color "${r.color}" is not one of …`` (markRule) | Same | Same |
| src/scripts/desk/sheets/sheet-page.js:928 | the share dialog note: "use Save as. For a PDF, choose Print, then “Save as PDF”" | Quotation inconsistency: "Save as" and "Print" are unquoted, while the next label is quoted | Quote them: “Save as,” and “Print,” |

Note on reachability (Confidence: Medium on the path, Low on how often it happens): these validator messages reach the reader only through the Markdown import report. desk-export.mjs:511 builds `“<heading>” couldn’t be added: <validator messages>.` from validateRecord(), and export-import.js:208 shows it as "Left out, so you can look them over: Line N: …". The messages are also developer-worded (`bookKey`, `color`, `marker`), so the fix is plain words as well as curly quotes. To confirm, import a Markdown file with a note the validator rejects.

Not reader-facing (checked, excluded):
- Thrown developer errors whose text never reaches the page: desk-sheet-format.mjs:1067, 1071, 1072 ("html is not in the sheet's formatted-text form"; the sheet path shows only ShareError's fixed text, and the detail goes to console); desk-sheet-format.mjs:991; desk-sheets.mjs:176, 189, 256, 259, 272; desk-records.mjs:206, 209, 258; desk-history.mjs:230; store.js:120, 144; desk-first-stage.mjs:156.
- Console messages: about 80 `console.error`/`console.warn` lines with the "Study Desk:" prefix. 56 use straight apostrophes and 25 curly, so the maintainer's messages mix the two styles. Not reader text, so not listed.
- Attribute and template fragments are checked by the same scan; none carries a straight apostrophe in visible text.

### Rule 5: em dashes

None in reader-facing text. Two em dashes occur, both in HTML entity decode tables (code, not prose; "check whose" does not apply):
- src/lib/desk-footnotes.mjs:56 (`mdash: "—"`)
- src/lib/desk-sheet-format.mjs:111 (same table)

En dashes are used correctly for ranges and names (src/lib/desk-sheet-ref-refusal.mjs:42 "Romans 5:6–10"; src/pages/desk/help.astro:430 "Robinson–Pierpont").

### Rule 6: old names

- "Study View", "Study view", "Reading View", "Reading view", "Reading Mode", "reading mode": none found, in strings or pages.
- "Study Desk preview" in reader-facing text (4 places; the owner decides whether this is still the pre-release name):

| Where | Text (shortened) | Note |
|---|---|---|
| src/pages/notebook.astro:32 | "The notebook is part of the Study Desk preview, which isn’t switched on in this browser…" | Shown to every reader while the preview is off |
| src/pages/sheets.astro:73 | "Sheets are part of the Study Desk preview, which isn’t switched on in this browser…" | Same |
| src/pages/desk/help.astro:18 | `<meta description>`: "Help for the Study Desk preview: …" | Page metadata; search engines and link previews show it |
| src/pages/desk/help.astro:478 | "It needs the Study Desk preview to be on for you." | In the tours section |

Comments containing the phrase (not reader text): src/pages/desk.astro:11, notebook.astro:9, sheets.astro:12, desk/help.astro:2.

### Rule 7: one name per thing

Variants found (counts are case-sensitive hits across strings and pages; locations are the first few):

| # | Thing | Forms and counts | Locations | Suggestion |
|---|---|---|---|---|
| 1 | The notes tab | "My Notes" 19; "My notes" as a label 3 (plus 3 "My notes’ lettering" in the Display tray); "my notes" in prose 16 | "My Notes": src/scripts/desk/panel.js, src/lib/desk-first-use.mjs:445, 459, help.astro:54, 76, 232, 241, 279, 282. "My notes": src/scripts/desk/tab-verse.js:113 (This verse subhead), src/scripts/desk/notebook-search.js:124 (Greek search checkbox), src/lib/desk-print-part.mjs:76 (printed section title) | Pick "My Notes" for every label and heading; prose stays "your notes" |
| 2 | The notebook group in menus and search | "My Notebook" 8 (capital); "My notebook" 3 (title case or group title); "my notebook" 9 (prose) | "My Notebook": src/scripts/desk/actions.js:82, src/scripts/desk/prose-actions.js:58, 127, src/lib/desk-first-use.mjs:181-183, help.astro:224, 296. "My notebook": src/lib/desk-search.mjs:239 (search group title), src/scripts/desk/title-menu.js:160 ("My notebook page"), help.astro:84; prose: src/lib/desk-commands.mjs:95, src/scripts/desk/note-settings.js:398-402, src/scripts/desk/sheets/sheet-page.js:865 ("Import into my notebook") | Pick one casing for the group heading (capital, as the verse menu has it) |
| 3 | The templates list headings | "Your templates" and "My templates", both on the same list | src/scripts/desk/sheets/my-sheets.js:75 ("Your templates") and :221 ("My templates"); help.astro:159-160 says both | Pick one heading |
| 4 | The Space part | "Space" (add-bar button) vs "Space to write" (insert menu, and the name announced) | src/scripts/desk/sheets/add-bar.js:105 `add("space", "Space")`; src/scripts/desk/sheets/insert-menu.js:45; src/scripts/desk/sheets/sheet-editor.js:117 (TYPE_NAMES) | Same part, two names on one editor. Pick one (help.astro:134 says "+ Space") |
| 5 | Adding from the notebook | "From my notes" 6 (add-bar.js:74, 81; add-forms.js:57, 66; help.astro:135) vs "From my notebook" (add-forms.js:199, a heading) | src/scripts/desk/sheets/add-forms.js:199 | Use "From my notes" |
| 6 | The key terms box | "Key terms box" 6 (capital: add-bar.js:107, insert-menu.js:47, part-cards.js:147, sheet-editor.js:118, help.astro:134) vs "key terms box" 8 (prose: help.astro:154, 166; src/lib/desk-first-use.mjs:628; sheet-present.js:734; sheet-lit.js:922; sheet-slides.js:98; sheet-editor.js:370) | as listed | Owner's call: capital for the part name, lowercase in running prose is defensible. Pick one rule |
| 7 | The display settings | "Display options" (title menu label, title-menu.js:126; help.astro:83; lowercase in desk-first-use.mjs:495) vs "Display tray" (src/lib/desk-first-use.mjs:182) | as listed | Use one name for the same control |
| 8 | Presenter view | "Presenter view" as a label (sheet-present.js:408; help.astro:206) vs "presenter view" in prose 11 (sheet-editor.js:714-715, part-cards.js:67, desk-first-use.mjs:652, 654) | as listed | Fine if the lowercase is prose; confirm |
| 9 | Bookmark that follows | "Move as I read" (option: desk-first-use.mjs:448; bookmark-form.js:72; help.astro:379) vs "Moves as I read" (status title, bookmark-follow.js:122; lowercase at :125) | as listed | Keep "Moves" only if it is the deliberate status word |
| 10 | The .md file | "Study Desk file (.md)" (sheet share: sheet-page.js:129, 131, 928; desk-sheet-share.mjs:327-328) vs "A Markdown file" (notebook export: help.astro:344; export-import.js:40 label "Markdown") | as listed | Same extension named two ways; owner's call |

Checked and consistent (no action): "Sheets pane" (15, all capital); "Study Desk" (163); "Chapter View" and "Read View"; "LIT pane" (18); "Leader only" (16, no "leader-only"); "Notebook" as the panel name; "Save a copy" in headings and prose; "Take the … tour" labels; "Answer key"; "Your text", "Question", "Page break", "Passage".

### Rule 8: ellipsis after a menu item or button that opens a further step

The character used is the single "…" everywhere; no three-dot ellipsis appears in reader text. Labels that act at once have no ellipsis (for example "Print" at src/scripts/desk/sheets/sheet-page.js:576, which calls window.print(); "Present" at :574, which starts presenting; the flyout items "Add pane ▸", "Move", "Size", "Print ▸" are chevrons, which is the convention).

| # | Where | Problem | Suggested fix | Confidence |
|---|---|---|---|---|
| 8-1 | src/scripts/desk/sheets/my-sheets.js:131 | Button "New sheet" (no ellipsis) toggles the template chooser (`fresh.setAttribute("aria-expanded"…)`, `fresh.addEventListener("click", () => chooser.toggle())` at :136). The other three "New sheet…" buttons (title-menu.js:110, sheet-page.js:372, kept-list.js:204) carry the ellipsis. | "New sheet…" | High |
| 8-2 | src/pages/desk/help.astro:300 | Help says "This selection…" (ellipsis). The menu item is "This selection" (src/lib/desk-print-part.mjs:23; src/scripts/desk/actions.js:305), a flyout choice that prints at once. The help's own "This verse" and "These verses" have no ellipsis. | Remove the ellipsis in the help | High |
| 8-3 | src/pages/desk/help.astro:64-65 | "“New sheet…” in the title menu starts a sheet at once: it opens a Sheets pane … and asks which template to begin from." The sentence says "at once" and then describes a step first. The item does open the template chooser (src/scripts/desk/title-menu.js:348-353), so the ellipsis is right. | Reword: "opens the template chooser, then starts a sheet" | Medium |
| 8-4 | src/scripts/desk/sheets/add-bar.js:67 (button "+ Passage", via add() at :47) | "+ Passage" expands the passage form (aria-expanded and aria-controls, :60-63) but has no ellipsis. The same action is "Passage…" in src/scripts/desk/sheets/insert-menu.js:42, and "+ From my notes…" in the same bar does have one. help.astro:124 quotes "+ Passage". | "+ Passage…" in the bar, and in the help | Medium |
| 8-5 | src/scripts/desk/title-menu.js:126 "Display options" | Opens the Display tray (aria-haspopup="dialog", set at :123). "Layout…" and "Print…" open dialogs and do have the ellipsis. | Owner's call: "Display options…" if the tray counts as a further step; otherwise leave | Low |
| 8-6 | src/scripts/desk/actions.js:212, 259 "Edit bookmark…" vs src/scripts/desk/record-rows.js:193 "Edit", src/scripts/desk/tab-mine.js:795 and 836 "Edit" | The same bookmark and note editor opens from a menu with an ellipsis and from a row without one | Pick one, owner's call | Low |
| 8-7 | src/pages/desk/help.astro:353 "Open a copy", :367 "Delete everything", :368 "Empty the trash now" | Quoted without the ellipsis the buttons carry (src/scripts/desk/export-import.js:80 "Open a copy…"; src/scripts/desk/notebook-page.js:314 "Delete everything…"; :323 "Empty the trash now…") | Add the ellipsis in the help text | Low |

### Rule 9: double spaces, stray spaces, doubled words

None found. Checked every string value: no run of two or more spaces between words; no space before . , ; : ! ? or ); no doubled word ("the the" and the like); no "..", ",," or " .". Leading and trailing spaces occur on 16 concatenation fragments (for example src/scripts/desk/sheets/sheet-page.js:543 " Show QR codes" appended after a text node); each is joined to a text node that carries no trailing space, so no double space renders.

---

### Other copy defect (outside the nine rules)

Missing verb, in two places:
- src/scripts/desk/sheets/add-forms.js:79: "A question becomes a Question part, a note or a pinned footnote Your text, and a highlight a passage."
- src/pages/desk/help.astro:137: "…a question becomes a Question, a note or a footnote Your text, a highlight a passage."

Both need "becomes" twice, for example: "A question becomes a Question part, a note or a pinned footnote becomes Your text, and a highlight becomes a passage." Confidence: High. This sentence explains the "+ From my notes…" chooser, so readers see it at the point of use.

Import report wording (related to rule 4): the Markdown import's "Left out" list can show validator text with field names (`bookKey`, `color`, `marker`, "ISO 8601 UTC"). Plain words would serve readers better. Confidence: Low (reachability).

---

### Improvements

- Put the names from Rule 7 into one list (one place per name) so future copy has one source. Each family above is a single string in the code, so this is a small change.
- The help's "Study Desk preview" phrase could move to one constant, so the release wording changes in one place.

### Questions for the owner

1. Is "Study Desk preview" still the name readers should see (notebook.astro:32, sheets.astro:73, help.astro:18 and :478), or should it drop once the desk is released?
2. Rule 7 picks: which casing and name for the notes tab ("My Notes" vs "My notes"), the notebook group ("My Notebook" vs "My notebook"), the templates headings ("Your templates" vs "My templates"), the part called "Space" or "Space to write", "From my notes" vs "From my notebook", "Display options" vs "Display tray", and the .md file name?
3. Does "Display options" count as a further step needing an ellipsis (8-5)? Does "Edit" in the Notebook rows open a further step (8-6)?
4. Does "+ Passage" in the sheet bar expand a further step that needs "…" (8-4)?

### What held up

- Spelling: American throughout (colors, minimized, grayed, license). No British spelling in reader text.
- Quotes: every quoted label in the help and the tours closes correctly, with periods and commas inside.
- Lists: the Oxford comma is used wherever the rule applies.
- Dashes: no em dashes in reader text; en dashes are correct for ranges and names.
- Ellipsis: "Layout…", "Print…", "Share…", "Labels…", "Delete everything…", "Empty the trash now…", "New sheet…" (three of four), "Print or share…" and "Present…" in the editor (both open a new tab), "+ From my notes…", "Passage…" in the gap menu all mark a further step, and "Print" and "Present" on the sheet page act at once with none.
- Doubled words, double spaces, and spacing before punctuation: none.
- "Study View", "Reading View", "Reading Mode": none.
- "Study Desk", "Sheets pane", "Chapter View", "Read View", "LIT pane", "Leader only": consistent.
- Console messages are not reader text, and I excluded them.

### Not reached

- No browser run: I read the source, not the rendered page. Text joined at run time (concatenated fragments, `aria-label` built from variables, sr-only text) was checked only as source.
- Sheet template prompts (src/lib/desk-sheet-templates.mjs, about 67 prose strings) and the commands list (src/lib/desk-commands.mjs) were checked with the mechanical rules and by reading flagged lines, not line by line for style.
- src/lib/desk-first-use.mjs (tour copy) was checked the same way: mechanical rules plus the lines the rules flagged. I did not read it end to end.
- src/layouts/Layout.astro (pre-paint script) and src/scripts/desk-gate.js are outside this slice.

## Appendix J: Mechanical health (`MH8`, Haiku)

Slice: MH8, mechanical health data (the seven-part checklist). Model: Haiku 5.5 (claude-haiku-5-5). Commit 15986b6e on claude/desk-audit-8. Date 2026-11-09. Ran: npm test; npm run check; npm run validate:chapters; npm run check:links; node --test test/claude-docs.test.js; read build.log; greps over the desk CSS, JS and pages; two scratch scripts in `...\scratchpad\audit8\mh8\` (css-focus.mjs, longest-fns.mjs). `git status --short` was empty before and after; no file in the checkout was changed. npm run build was not run.

### Summary

- Every command passed: npm test 3,377 of 3,377; npm run check 0 errors and 49 hints (no warnings in the summary line); validate:chapters 260 of 260 valid; check:links 355 pages and 47,035 internal links, no breaks; claude-docs.test.js 4 of 4. build.log contains no warning lines.
- Dark mode is sound: the three `prefers-color-scheme: dark` blocks in desk.css are all guarded by `:root:not([data-theme="light"])` and each has a `:root[data-theme="dark"]` twin with identical values. No unpaired block. The four desk pages have no `<style>` blocks.
- No `ch` unit anywhere in the desk CSS or the desk's JS.
- Focus: one real gap. `.desk-tour:focus { outline: none }` (desk.css:3010) removes the ring from the tour card, which takes focus on every step.
- Links and debug output are clean: every external-leaving `target="_blank"` has both rel values; the eight noopener-only anchors point at the site itself. No console.log, debugger, TODO, FIXME, XXX or HACK in the desk code.
- Shared-code imports: three static desk-module imports from shared files are deliberate per the design record. One is not: src/lib/greek-commands-ui.mjs:12 imports desk-greek.mjs statically, and the shared Greek search reaches it.
- CLAUDE.md caps: the root file is at 40,683 of 40,960 bytes (99.3%), inside the 5% band. The desk file is at 92.8% of its cap.
- Counts by severity: Critical 0, High 0, Medium 0, Low 3, Nit 0. Out of slice, seen in passing: src/pages/CLAUDE.md is published as a public page at /CLAUDE/ and listed in the sitemap (see Not reached).

### Findings

#### MH8-1 · Low · a11y · NEW

Tour card has no visible focus ring on the step it takes focus.

**Where:** `src/styles/desk.css:3010` (`.desk-tour:focus { outline: none; }`); the focusing call is `src/scripts/desk/tour-runner.js:264` (`card.focus({ preventScroll: true })`) inside `async function go(i)` (line 211). The card is set up in the same file with `role="dialog"` (line 94), `tabIndex = -1` (line 97) and `aria-labelledby` (line 113).

**What happens:** A keyboard user is on the tour card and presses Enter on Next. The tour moves to the next step and focus is moved onto the dialog itself. The rule suppresses the outline on `:focus`, so no ring shows where focus is; the next Tab goes to the first control in the card. Someone who relies on the visible ring (low vision, or keyboard-only users following focus by eye) cannot see that focus moved. A screen reader does announce the dialog, so the harm is visual, which is why this is Low.

**Evidence:** A brace-matching scan of every `:focus` and `:focus-visible` rule in the six desk CSS files (`mh8/css-focus.mjs`). Of 86 focus-family rules, 61 set outline or box-shadow; the 15 flagged by the literal test were checked one by one. Most are not gaps: 888, 5919 and 954/975 are `:focus-within` or `:hover` shadows with the global `:focus-visible` outline still applying (src/styles/global.css:401-404); 1074, 1664, 1761 and 4151 move the ring to a child (`::after` or grip) that carries `var(--focus-ring)`; 51 is documented as a region with no ring (the comment above it); 4077 keeps its ring in the `:focus-visible` rule at 4081; 6715 and 6734 are forced-colors overrides. Line 2730 (`.desk-home-card__title:focus`) is dead code: the h3 built at src/scripts/desk/first-use.js:133 has no tabindex. Line 3010 is the one gap. Its specificity (0,2,0) beats the global `:focus-visible` rule (0,1,0), so no ring is drawn. STUDY-DESK-AUDIT-3.md:2183 lists the selector in an inventory table ("no ring on that rule") but never raised it as a finding, and the FIXES log has no entry for it.

**Fix:** Give the tour card a ring for its focus, for example `.desk-tour:focus { outline: 2px solid var(--focus-ring); outline-offset: -2px; }`, or move focus to the card's heading (which carries a ring) instead. Either way the rule must use `var(--focus-ring)`, not `none`.

**Confidence:** High that the rule suppresses the ring and that the card is focused on each step. Medium on the user impact, since the card is a dialog and screen-reader focus is unaffected.

**Fixed (2026-11-09)** `.desk-tour:focus:not(:focus-visible) { outline: none }`, so the ring shows after a keyboard move.

#### MH8-2 · Low · longevity · NEW

Shared Greek search code imports a desk module statically.

**Where:** `src/lib/greek-commands-ui.mjs:12` (`import { SIGNS, W } from "./desk-greek.mjs";`). The module's header calls `desk-greek.mjs` "the pure half of the Notebook's Greek tab". Shared consumers: `src/scripts/greek-commands.js:32` (imports greek-commands-ui.mjs statically), reached through dynamic imports at `src/scripts/searchbar.js:63` and `src/scripts/search.js:59`; `src/scripts/search-greek.js:48` re-exports from it; `src/lib/greek-builder.mjs:34` imports from it.

**What happens:** The Greek search is not desk-gated. Its loader's own comment says a reader downloads it "desk on or off" once a query is Greek (`src/scripts/search-core.js:1284-1291`). That path therefore carries desk code, and a maintainer changing the desk's Greek tab edits a file that the public search also depends on. The bundled effect is small: the `SIGNS` literal appears in `dist/_astro/greek-chapters.B1DnP2Bl.js` (3,204 bytes). The problem is the layering: the root CLAUDE.md rule is that shared reader code never imports the desk statically, and this is a static import of a desk module from shared code. Neither src/lib/CLAUDE.md (line 94, which lists greek-commands-ui as "its pure UI helpers") nor the desk CLAUDE.md records it as deliberate.

**Evidence:** Import grep over src/scripts/*.js, src/components, src/layouts, src/pages and src/lib (mh8 notes); the dist grep for the SIGNS literal; the header of src/lib/desk-greek.mjs.

**Fix:** Move `SIGNS` and `W` into a shared module (greek-commands-ui.mjs itself, or a small `greek-words.mjs`), have greek-commands-ui.mjs import them from there, and have desk-greek.mjs import them from the shared module. The dependency then runs from the desk to shared code, which is the allowed direction. Add a line to src/lib/CLAUDE.md.

**Confidence:** High on the facts (import, consumers, dist chunk). Medium on severity, since the size cost is about 3 KB.

**No change (2026-11-09)** A recorded exception (LG8-11), now named in `src/lib/CLAUDE.md`.

#### MH8-3 · Low · docs · NEW

Root CLAUDE.md is 277 bytes under its size cap.

**Where:** `CLAUDE.md` (40,683 bytes). The cap is `ROOT_LIMIT = 40 * 1024` (40,960 bytes) at `test/claude-docs.test.js:18`.

**What happens:** The test passes today, but any further edit to the root file that adds more than 277 bytes (a new index row, a new rule, a short paragraph) fails `claude-docs.test.js`, and the test then asks for detail to move to an area file. A future session that edits the root file has no room to do so.

**Evidence:** `wc -c CLAUDE.md` (40,683) against the limit in claude-docs.test.js; `node --test test/claude-docs.test.js` 4 of 4 pass. The desk file is at 123,553 of 133,120 bytes (92.8%, 9,567 bytes of headroom), outside the 5% band.

**Fix:** Move a block of the root file's detail into the area file that owns it (the longest root tables, "Routing" and "Important Files", are the first candidates to check against the area files), so the root file has room again. Do not raise the cap, which the test's own comment forbids.

**Confidence:** High.

**Fixed (2026-11-09)** The /404 row's detail moved to `src/pages/CLAUDE.md`.

### Improvements

- `src/scripts/desk/sheets/CLAUDE.md` is 38,885 bytes and has no size cap. The claude-docs test guards only the root and desk files, so this file can grow unchecked. Add a cap or a note that it is deliberately uncapped.
- `src/scripts/desk/sheets/sheet-text.js:150`, `:162` and `:170` call `document.caretRangeFromPoint`, `document.execCommand` and `document.queryCommandState`, each reported deprecated by tsc (ts 6387). The Sheets rich-text editing rests on `execCommand`. Record the dependency and the plan, so a maintainer knows the risk before a browser drops it.
- `src/styles/desk.css:2730` (`.desk-home-card__title:focus`) is dead: the h3 built at `src/scripts/desk/first-use.js:133` is not focusable, and first-use.js:281 focuses the card or the panel body instead. Delete the rule.
- `src/scripts/desk/greek-find.js:241` is the only `console.warn` in the desk that does not use the "Study Desk:" prefix (`"[greek tab] search failed"`). A trivial consistency fix. Nit.
- Test coverage by name (see the coverage table): 34 desk modules are not mentioned by any test file, and 57 are not named by filename. The largest unnamed modules include `sheets/sheet-present.js` (37,154 bytes), `tab-verse.js` (22,231 bytes) and `change-notice.js` (20,521 bytes). Coverage through lib modules may exist, so this is a question, not a finding.

### Questions for the owner

- Is the tour card's missing ring (MH8-1) intentional? The card is a dialog, and the owner may have chosen to rely on the announcement alone. If so, the decision should be written in src/scripts/desk/CLAUDE.md, next to the tour's focus rules.
- Is the Greek search's dependency on desk-greek.mjs (MH8-2) a decision, or a shortcut that happened when the Greek tab was built? The record does not say.

### What held up

- `npm test`: 3,377 tests, 16 suites, 0 failures, 7.8 s (wall 8.6 s).
- `npm run check`: 0 errors, 541 files. Desk-related diagnostics are all hints: src/scripts/desk/desk-panes.js:192 (unused `env`); margin.js:58-59 (unused `TAB_EDGE`, `TAB_WIDTH`); tab-mine.js:394 (unused `allPins`); whats-new.js:166 (ts 80006, may be an async function); sheets/sheet-text.js:150, 162, 170 (deprecated DOM APIs, see Improvements). Five more hints fall in desk test files (desk-copy-constants, desk-layout, desk-panes-shared, desk-sheet-doc, desk-sheet-lit).
- `npm run validate:chapters`: 260 of 260 chapter files valid, 1.2 s.
- `npm run check:links`: 355 pages, 47,035 internal links, no broken target or fragment, 5.7 s.
- `node --test test/claude-docs.test.js`: 4 of 4 pass, 0.14 s.
- Dark mode (desk.css): three blocks at lines 1216/1225, 6136/6146 and 7496/7502, each with a `:root:not([data-theme="light"])` media guard and a matching `:root[data-theme="dark"]` block with identical values (4, 5 and 1 tokens). No unpaired block; no `data-theme="dark"` rule anywhere else in the six CSS files or the four pages.
- `ch` unit: no use in desk.css, desk-tab.css, the desk pages' CSS, or the desk's JS (matches of `ch` in widths.js:210-212 and desk-anchor-dom.mjs are object keys, not units).
- External links: 18 `target="_blank"` anchors in the desk code (greek-find.js:88; intro-pane.js:112; intro-text.js:31; lit-pane.js:99, 259; print-menu.js:90; search-pane.js:130; sheets/sheet-editor.js:705, 712, 721; sheets/sheet-lit.js:934, 1059, 1129; sheets/sheet-slides.js:221-222; tab-greek.js:537; title-menu.js:171; tour-runner.js:229; undo-bar.js:160). Ten carry `noopener noreferrer`. The other eight carry `noopener` only (print-menu.js:91; sheets/sheet-editor.js:706, 713, 722; sheets/sheet-lit.js:935, 1060, 1130; undo-bar.js:161), and all point at the site: `${BASE}` addresses, the page's own print addresses passed in as `choices` (print-menu.js:144), and the undo link from sheets/sheet-add.js:141. print-menu.js contains no absolute URL. No external target lacks a rel value.
- `window.open`: one call, sheets/sheet-present.js:634, opens `sheetUrl()` (same origin, line 70) with features that lack `noopener`. Same-origin, so the presenter window keeps `window.opener`; no external target. Data only.
- Debug output: 0 `console.log`, 0 `debugger`, 0 TODO/FIXME/XXX/HACK in src/scripts/desk, src/lib/desk-*.mjs and the four pages. 86 `console.error` calls, all in the "Study Desk:" style, and 2 `console.warn` (see Improvements).
- Shared-code imports of desk modules (all found by the import grep):
  - `src/scripts/desk-gate.js:10` imports `./desk-frame.js` statically. Deliberate: desk CLAUDE.md:84 and the header of desk-frame.js ("lit-panel.js and the desk's gate import it on every page").
  - `src/scripts/desk-gate.js:66, 70, 76, 82` dynamic imports of the shell, notebook, desk and sheet pages. Line 66 sits under `shellHere` (line 12, which requires `data-desk="on"`); lines 67-82 test `data-desk="on"` in their own `else if` conditions. Gated.
  - `src/components/SiteHeader.astro:487` imports `../scripts/desk-gate.js` statically. Deliberate: the gate is the entry point, and the header chunk carries its small body.
  - `src/layouts/Layout.astro:11` imports constants (`EDGE`, `FIRST_PAINT`, `GAP`, `MAX_MEASURE`, `MIN_MEASURE`, `MIN_WIDTH`) from `src/lib/desk-margin.mjs` for the pre-paint script. Deliberate: desk CLAUDE.md:275 ("the script repeats `firstPaint` (`desk-margin.mjs`)").
  - `src/scripts/lit-panel.js:15`, `src/scripts/panel-pieces.js:16`, `src/scripts/greek-commands.js:34` import `./desk-frame.js` statically. Deliberate, as above.
  - `src/scripts/search-core.js:1232` and `:1256` dynamic imports of `./desk/notebook-search.js` and `./desk/sheets/search-sheet.js`, each in a loader that returns null unless `deskEnabled()` (lines 1230 and 1255). Gated.
  - `src/scripts/sheet-share-gate.js:34` dynamic import of `./desk/sheets/sheet-page.js`, only when `dataset.desk !== "on"` and the device is a phone or tablet (line 23, 31). The documented exception.
  - `src/scripts/search-core.js:1291` dynamic import of `./search-greek.js` (shared, not desk).
  - `src/pages/[slug].astro:231`, `src/pages/privacy.astro:126-136`, `src/scripts/chapter-tools.js` and `src/scripts/last-read.js`: comments or text only, no import.
  - `src/lib/greek-commands-ui.mjs:12`: static import of a desk module. This is the one finding (MH8-2).
- Initial HTML of reader pages: `dist/john-3/index.html`, `dist/read/john/index.html`, `dist/glossary/index.html` and `dist/desk/index.html` reference only the shared SiteHeader chunks, Layout CSS, ReadMenu, SearchBar and page chunks. No desk-named chunk is loaded at page start. The SiteHeader chunk statically imports only the 2 KB `desk-frame` chunk, the 48-byte continue-reading stub and a preload helper; the desk shell and pages arrive through the gate's dynamic imports.
- CLAUDE.md caps: root 40,683 of 40,960 (see MH8-3); desk file 123,553 of 133,120 (92.8%).
- Build log (`scratchpad\build.log`, 456 lines): no warning, deprecation or error lines. Pagefind's note "4 pages found without an <html> element" accounts for dist/CLAUDE/index.html and three noindex redirect pages (dist/notebook/help, dist/podcast, dist/read-now).

### Tables

#### 1. Command results

| Command | Result | Pass/fail | Duration |
|---|---|---|---|
| `npm test` | 3,377 tests, 16 suites, 0 failures, 0 skipped | pass | 7.8 s (wall 8.6 s) |
| `npm run check` | 541 files, 0 errors, 0 warnings, 49 hints | pass | 21.6 s |
| `npm run validate:chapters` | 260 of 260 valid | pass | 1.2 s |
| `npm run check:links` | 355 pages, 47,035 internal links, no broken targets | pass | 5.7 s |
| `node --test test/claude-docs.test.js` | 4 of 4 pass | pass | 0.14 s |

Warnings: none in build.log. Every hint in the desk source is listed under "What held up".

#### 2a. Dark-mode blocks (desk CSS and pages)

| File:line | Selector (media) | Guard | Twin `:root[data-theme="dark"]` | Tokens | Paired |
|---|---|---|---|---|---|
| desk.css:1216 | `:root:not([data-theme="light"])` | yes | desk.css:1225 | 4 (`--desk-hl-yellow/green/blue/pink`) | yes, same values |
| desk.css:6136 | `:root:not([data-theme="light"])` | yes | desk.css:6146 | 5 (`--desk-rich-red/blue/green/purple/gray`) | yes, same values |
| desk.css:7496 | `:root:not([data-theme="light"])` | yes | desk.css:7502 | 1 (`--desk-sheet-warn`) | yes, same value |

Unpaired: none. desk-tab.css, desk-help.css (pages), desk-page.css, notebook.css, sheets-page.css and the four pages' `<style>` blocks (none) contain no dark rules.

#### 2b. `ch` unit

None in the six desk CSS files or in the desk JS. Zero findings.

#### 2c. Focus rules

| File:line | Selector | Declaration | Verdict |
|---|---|---|---|
| desk.css:51 | `.desk-panel:focus, .desk-panel__body:focus` | `outline: none` | deliberate (documented region, no ring) |
| desk.css:554 | `.desk-seg__input:focus-visible + .desk-seg__text` | ring present; inset box-shadow | ring present, no gap |
| desk.css:954, 975 | `.desk-circle:focus-visible` | box-shadow (lift); none in reduced motion | global ring applies (no outline override) |
| desk.css:1074 | `:is(.desk-note__hit, …):focus-visible` | `outline: none` | ring on `::after` (1078), `var(--focus-ring)` |
| desk.css:1664, 1761, 4151 | `.desk-gutter`, `.desk-panel__edge`, `.desk-greek__split` `:focus-visible` | transparent outline | ring on grip child, `var(--focus-ring)` |
| desk.css:2730 | `.desk-home-card__title:focus` | `outline: none` | dead rule (not focusable) |
| desk.css:3010 | `.desk-tour:focus` | `outline: none` | **GAP, MH8-1** |
| desk.css:4077 | `.desk-greek__app-item:focus` | `outline: none` | ring in `:focus-visible` at 4081 |
| desk.css:5919 | `…:focus-within` | box-shadow | not a focus rule (`:focus-within`) |
| desk.css:6715, 6734 | `:focus-visible` in forced colors | `outline-color: HighlightText` | forced-colors only; ring from earlier rules |
| desk.css:888 | `:hover, :focus-within` | box-shadow | not a focus rule |

Totals: 86 focus-family rules; 61 set outline or box-shadow; 15 flagged by the literal test; 1 real gap.

#### 3. Links and debug output

| Check | Count | Notes |
|---|---|---|
| `target="_blank"` anchors | 18 | 10 with `noopener noreferrer`; 8 `noopener` only, all same-site |
| `window.open(` | 1 | sheet-present.js:634, same-origin, no `noopener` in features |
| `console.log` | 0 | |
| `debugger` | 0 | |
| TODO / FIXME / XXX / HACK | 0 | |
| `console.error` | 86 | "Study Desk:" prefix |
| `console.warn` | 2 | greek-find.js:241 (different prefix); sheet-page.js:458 |

#### 4. Static and dynamic desk imports from non-desk code

| Importer | Line | Imports | Static or dynamic | Verdict |
|---|---|---|---|---|
| src/scripts/desk-gate.js | 10 | `./desk-frame.js` | static | deliberate (desk CLAUDE.md:84) |
| src/scripts/desk-gate.js | 66, 70, 76, 82 | desk shell and pages | dynamic | gated on `data-desk="on"` |
| src/components/SiteHeader.astro | 487 | `../scripts/desk-gate.js` | static | deliberate (the gate) |
| src/layouts/Layout.astro | 11 | `src/lib/desk-margin.mjs` constants | static | deliberate (desk CLAUDE.md:275) |
| src/scripts/lit-panel.js | 15 | `./desk-frame.js` | static | deliberate ("on every page") |
| src/scripts/panel-pieces.js | 16 | `./desk-frame.js` | static | deliberate |
| src/scripts/greek-commands.js | 34 | `./desk-frame.js` | static | deliberate |
| src/scripts/search-core.js | 1232 | `./desk/notebook-search.js` | dynamic | gated by `deskEnabled()` |
| src/scripts/search-core.js | 1256 | `./desk/sheets/search-sheet.js` | dynamic | gated by `deskEnabled()` |
| src/scripts/sheet-share-gate.js | 34 | `./desk/sheets/sheet-page.js` | dynamic | phone or tablet, desk off (the exception) |
| src/lib/greek-commands-ui.mjs | 12 | `src/lib/desk-greek.mjs` (SIGNS, W) | static | **FINDING MH8-2** |

#### 5. Sizes

Top 30 of the 167 files in src/scripts/desk/, src/scripts/desk/sheets/, src/lib/desk-*.mjs and src/styles/desk*.css, sorted by bytes:

| Bytes | Lines | File |
|---:|---:|---|
| 199,565 | 8,782 | src/styles/desk.css |
| 60,313 | 1,360 | src/scripts/desk/desk-page.js |
| 59,727 | 1,377 | src/scripts/desk/sheets/sheet-editor.js |
| 59,491 | 1,382 | src/scripts/desk/sheets/sheet-page.js |
| 51,864 | 1,312 | src/scripts/desk/tab-greek.js |
| 49,404 | 1,140 | src/scripts/desk/sheets/sheet-lit.js |
| 48,745 | 1,109 | src/lib/desk-layout.mjs |
| 47,921 | 1,242 | src/scripts/desk/search-pane.js |
| 46,386 | 1,251 | src/scripts/desk/sheets/sheet-text.js |
| 44,920 | 983 | src/scripts/desk/tab-mine.js |
| 43,064 | 1,089 | src/lib/desk-sheet-format.mjs |
| 42,083 | 894 | src/lib/desk-export.mjs |
| 37,154 | 915 | src/scripts/desk/sheets/sheet-present.js |
| 35,843 | 840 | src/scripts/desk/panel.js |
| 33,791 | 777 | src/scripts/desk/notes-margin.js |
| 29,060 | 657 | src/lib/desk-first-use.mjs |
| 27,887 | 571 | src/lib/desk-change.mjs |
| 27,333 | 439 | src/lib/desk-slides-pptx.mjs |
| 26,376 | 648 | src/scripts/desk/lit-pane.js |
| 24,796 | 535 | src/scripts/desk/actions.js |
| 24,749 | 537 | src/lib/desk-records.mjs |
| 24,371 | 566 | src/lib/desk-sheet-lit.mjs |
| 24,056 | 534 | src/scripts/desk/sheets/sheet-copy.js |
| 22,231 | 498 | src/scripts/desk/tab-verse.js |
| 22,124 | 440 | src/lib/desk-merge.mjs |
| 22,008 | 378 | src/lib/desk-doc-docx.mjs |
| 21,634 | 521 | src/scripts/desk/bookmark-follow.js |
| 21,622 | 546 | src/lib/desk-slides.mjs |
| 20,624 | 425 | src/scripts/desk/sheets/sheet-tour.js |
| 20,521 | 480 | src/scripts/desk/change-notice.js |

Group totals: src/scripts/desk/ 80 files, 962,046 bytes, 22,812 lines; src/scripts/desk/sheets/ 22 files, 431,542 bytes, 10,180 lines; src/lib/desk-*.mjs 63 files, 790,838 bytes, 17,545 lines; src/styles/desk*.css 2 files, 203,193 bytes, 8,902 lines. Outside the glob: src/styles/pages/desk-help.css (1,628 bytes; the brief's path `src/styles/desk-help.css` does not exist), desk-page.css (1,229), notebook.css (2,369), sheets-page.css (37,319).

Longest functions (approximate: a brace matcher over comment- and string-masked source, `mh8/longest-fns.mjs`; the outer `create…`/`start` closures include every nested helper, so these lengths overstate the single function):

| Lines | Function | Location |
|---:|---|---|
| 1,188 | createSheetEditor | src/scripts/desk/sheets/sheet-editor.js:190 |
| 1,168 | start | src/scripts/desk/desk-page.js:191 |
| 1,123 | createGreekTab | src/scripts/desk/tab-greek.js:190 |
| 1,072 | createSearchPane | src/scripts/desk/search-pane.js:171 |
| 1,065 | createSheetText | src/scripts/desk/sheets/sheet-text.js:187 |
| 812 | createMineTab | src/scripts/desk/tab-mine.js:163 |
| 690 | createNotesMargin | src/scripts/desk/notes-margin.js:87 |
| 557 | createLitPane | src/scripts/desk/lit-pane.js:92 |
| 505 | createPassageBody | src/scripts/desk/sheets/sheet-lit.js:351 |
| 448 | initActions | src/scripts/desk/actions.js:63 |
| 417 | createVerseTab | src/scripts/desk/tab-verse.js:82 |
| 383 | start | src/scripts/desk/notebook-page.js:70 |
| 359 | createGreekFind | src/scripts/desk/greek-find.js:53 |
| 359 | createTitleMenu | src/scripts/desk/title-menu.js:44 |
| 352 | openStore | src/scripts/desk/store.js:143 |
| 344 | createKindMenu | src/scripts/desk/kind-menu.js:60 |
| 343 | createTour | src/scripts/desk/tour.js:87 |
| 301 | createSheetTour | src/scripts/desk/sheets/sheet-tour.js:125 |
| 298 | createRail | src/scripts/desk/margin.js:87 |
| 273 | createDeskTour | src/scripts/desk/desk-tour.js:76 |

CLAUDE.md sizes against limits:

| File | Bytes | Cap | Used | Note |
|---|---:|---:|---:|---|
| CLAUDE.md (root) | 40,683 | 40,960 (ROOT_LIMIT) | 99.3% | **within 5%, MH8-3** |
| src/scripts/desk/CLAUDE.md | 123,553 | 133,120 (DESK_LIMIT) | 92.8% | outside 5% |
| src/scripts/desk/sheets/CLAUDE.md | 38,885 | none | n/a | no size test |

#### 6. Test coverage by name

Modules in src/scripts/desk/**, src/scripts/desk/sheets/ and src/lib/desk-*.mjs: 165. All 63 lib modules are named by some test file. Named by bare word (not necessarily by file): 131 of 165. Named by filename: 108 of 165.

No test file mentions these 34 desk modules by name:

bookmark-mark, bookmark-stop, change-notice, continue-reading, desk-panes, diff-view, export-import, float-resize, focus-keep, footnote-notes, footnotes-view, glossary-titles, greek-data, greek-link, intro-pane, kind-menu, labels-ui, move-redraw, note-words, notebook-tab, passage-bar, print-link, print-menu, print-room, prose-actions, read-marks, reading-display, readonly-notebook, tab-verse, title-menu, verse-labels (src/scripts/desk/), add-bar, add-forms, sheet-present (src/scripts/desk/sheets/).

Lower-confidence note: the bare-word check matches substrings, so a module may be covered through a name that the check cannot see. Treat the list as a prompt to look, not as a verdict. Coverage by behaviour was not measured.

#### 7. dist/_astro chunks that are desk code or contain "lit-desk"

Matched on content (`lit-desk`) or on a name that begins with a desk module's name. 48 files, 1,012,670 bytes, of 159 files and 3,800,911 bytes in dist/_astro.

| Bytes | File | Why |
|---:|---|---|
| 161,531 | desk.dPu_2Kcr.js | desk.css embedded as a JS string (boot.js `?inline`); contains lit-desk |
| 98,082 | desk-page.D-ZgKK0X.js | desk module; contains lit-desk |
| 97,869 | sheet-page.JFKNqrNa.js | desk module |
| 69,733 | tab-mine.BRxGR4Xq.js | desk module; contains lit-desk |
| 63,496 | sheet-editor.ycuYeGnT.js | desk module |
| 54,913 | shell.CKc_wCp7.js | desk module; contains lit-desk |
| 52,057 | notebook-page.DiKpTgZY.js | desk module |
| 41,189 | sheet-lit.D-cv4aiV.js | desk module |
| 31,233 | boot.BayifV12.js | desk module; contains lit-desk |
| 30,541 | desk-first-use.DyEbKrOS.js | desk module; contains lit-desk |
| 30,534 | continue-reading.Bw3qcaJP.js | name shared with src/scripts/continue-reading.js; contains lit-desk; not in any reader page's HTML |
| 24,208 | tab-greek.rGwAL0Fy.js | desk module; contains lit-desk |
| 22,362 | store.DOzhOGdC.js | desk module; contains lit-desk |
| 17,342 | desk-slides-pptx.ByjC_bk4.js | desk module |
| 16,375 | note-settings.B8a6pBKb.js | desk module; contains lit-desk |
| 15,149 | first-stage.DcCY7I3e.js | desk module; contains lit-desk |
| 13,465 | desk-doc-docx.Q4yZvowf.js | desk module |
| 12,006 | desk-doc-odt.BCQy-h0J.js | desk module |
| 11,740 | tour-runner.pp8qQT8v.js | desk module; contains lit-desk |
| 11,487 | desk-slides-odp.CZ5U0uGz.js | desk module |
| 10,139 | tab-verse.DCIm9tiS.js | desk module |
| 10,087 | notebook-search.C7BzUeFX.js | desk module; contains lit-desk |
| 9,713 | page.BZYdxj33.js | desk module (src/scripts/desk/page.js) |
| 8,900 | search-sheet.oV7SJwzc.js | desk module |
| 8,651 | desk-footnotes.DFcWIdlh.js | desk module |
| 8,549 | sheet-slides.-6v480C_.js | desk module |
| 8,298 | SiteHeader.astro_astro_type_script_index_0_lang.DiC40DTY.js | shared; contains lit-desk via desk-gate.js (the gate) |
| 8,020 | desk-sheet-doc.BeGuGP0z.js | desk module |
| 7,209 | desk-slides.BtKjLXAv.js | desk module |
| 7,107 | greek-find.D4xKeqCu.js | desk module |
| 6,744 | my-sheets.pxwLMw19.js | desk module |
| 6,171 | sheet-tour.C1IdPLCC.js | desk module |
| 5,842 | whats-new.D-Bc_Rdj.js | desk module |
| 5,760 | desk-doc-rtf.BIWVYNnb.js | desk module |
| 4,726 | undo-bar.C9v6mh7l.js | desk module |
| 3,583 | desk-search.BDEUZrSr.js | desk module |
| 3,395 | diff-view.BL73npUz.js | desk module |
| 2,710 | history.DLYOwrIO.js | desk module |
| 2,481 | desk-sheet-gather.D8SVfcqQ.js | desk module |
| 2,060 | notebook-tab.Cmg6druu.js | desk module |
| 2,042 | desk-frame.v4DoT94M.js | shared, statically imported by the SiteHeader chunk |
| 1,969 | desk-zip.CcznNbEm.js | desk module |
| 1,005 | sheet-page-edit.DwIJ08Mu.js | desk module |
| 832 | greek-data.D1Lfn2TP.js | desk module; contains lit-desk |
| 593 | sheet-page-list.B0upP1L0.js | desk module |
| 551 | desk-start.sPnUu8Jl.js | desk module; contains lit-desk |
| 173 | page-kind.ChUnRZEa.js | desk module |
| 48 | continue-reading.BFwzZPdk.js | shared re-export stub (src/scripts/continue-reading.js) |

The 16 files containing `lit-desk` total 586,169 bytes. Reader pages load none of them at start (see What held up). Name matches for `page`, `store`, `history` and `shell` are desk files (src/scripts/desk/*.js), not shared ones.

### Not reached

- No dev server, no browser, no runtime check of focus, contrast, forced colors or reduced motion. The focus and dark-mode results are from reading the CSS and a brace-matching scan, not from rendering.
- The five commands were run once each, concurrently with other reads. Durations are wall times and are approximate.
- The longest-function table is approximate (see its note). The coverage check is by name only.
- The brief's path `src/styles/desk-help.css` does not exist; the file is `src/styles/pages/desk-help.css`, which was scanned.
- Out of slice, seen in passing: `src/pages/CLAUDE.md` is an Astro page, so it builds to `dist/CLAUDE/index.html` (3,600 bytes, bare HTML with no `<html>`, `<head>`, title or noindex) and is listed in `dist/sitemap-0.xml` as `litbible.net/CLAUDE/`. The root CLAUDE.md's own note says this directory holds Claude docs. Worth a look by whoever owns the site's routes: either move the file out of src/pages or exclude it from the build and the sitemap.
- Not checked: the desk CSS's colour contrast, the other pages' focus rules that apply to desk elements through global.css, and the Pagefind index contents.

## Appendix K: Gap pass: the Search pane, floating windows, Greek find, the commands window, /notebook (`GF8a`, Sonnet)

Slice: `src/scripts/desk/search-pane.js` (all 1,242 lines), `src/scripts/float-window.js`, `src/scripts/desk/greek-find.js`, `src/scripts/desk/commands-window.js`, `src/scripts/desk/notebook-page.js` (label rename form skipped, DK8-1). Model: Sonnet 5.5. Commit `15986b6e`. Date 2026-11-09.
Ran: read every function of the five files plus the callees they lean on (`store.js` `apply`/`change`, `search-core.js` loaders, `desk-commands.mjs`, `notebook-search.js` `openCommands`, `glossary.astro` entry markup); `tsc --ignoreConfig --checkJs` over all of `src/scripts/*.js`, `desk/*.js` and `desk/sheets/*.js` for undefined names (scratch folder `...\audit8\gf8a\`); `gf8a\fuzz.mjs` (hostile hrefs into `resultTarget`, 5,000 verse refs into `passagesFromVerses`, `nextPage`, `longEnoughQuery`). No browser, so browser-dependent claims carry a confidence note.

### Summary

The five files are mostly sound: every search is ordered by a sequence number checked after every await, paging keeps a 5,000-hit result cheap (20 rows at a time), and `float-window.js` and `commands-window.js` balance every global listener they add. The defects are at the edges: one real ReferenceError in the Search pane's Greek article suggestion, silent failure paths (the /notebook page's writes, a failed verse index), and several places where a redraw drops keyboard focus or feedback goes to a hidden region.
Counts: 0 Critical, 0 High, 3 Medium, 7 Low, 0 Nit (plus Improvements).
Two of the brief's special concerns came out clean: stale-result ordering (see "What held up") and `destroy()` completeness (table under "What held up").

### Findings

#### GF8a-1 · Medium · bug · NEW
Clicking the suggested "ὁ, θεός" in the Search pane throws a ReferenceError and does nothing.

**Where**: `src/scripts/desk/search-pane.js:1175`, `paintWord` (the article branch, lines 1166-1181). The button's label is read as `gk.ARTICLE_EXAMPLE` (line 1170), but the click handler writes `input.value = ARTICLE_EXAMPLE;` with a bare name. The file imports no `ARTICLE_EXAMPLE` (the import lists at lines 41-105 have none; `greek-find.js:26` imports it correctly).

**What happens**: With the Greek search on, a reader types `ὁ` (or picks Greek and types "the") in a Search pane. Instead of a list the pane says the article is in nearly every verse and offers a button, "ὁ, θεός". The button is the only way forward from that line. Clicking it resets `greekState`, then throws `ReferenceError: ARTICLE_EXAMPLE is not defined` in the handler. The field and results do not change, the reader sees nothing, and the console has the error.

**Evidence**: `tsc --ignoreConfig --noEmit --allowJs --checkJs` over `src/scripts/*.js`, `desk/*.js` and `desk/sheets/*.js` reports exactly one TS2304 ("Cannot find name 'ARTICLE_EXAMPLE'", `search-pane.js(1175,23)`); the other error line is an unrelated `navigator.userAgentData` typing. `grep -n ARTICLE_EXAMPLE` confirms `search-greek.js:46` re-exports it and only `desk/search-pane.js:1175` uses it unqualified. Not found in Audits 1-7 or the E log.

**Fix**: use `gk.ARTICLE_EXAMPLE` on line 1175 (`gk` is set by then, as the comment at line 109 says). A cheap guard against the class: run the `tsc` scan above (or an eslint `no-undef`) in CI over `src/scripts/`; it is clean apart from this one name today.

**Confidence**: High.

**Fixed (2026-11-09)** `gk.ARTICLE_EXAMPLE`. Test: `test/desk-audit8-c-search-and-pages.test.js`.

#### GF8a-2 · Medium · usability · NEW
On /notebook, a failed write in Labels, "Delete everything" or "Empty the trash now" says nothing, and the last button stays disabled.

**Where**: `src/scripts/desk/notebook-page.js:384-396` (`writeOver`) and its callers: the new-label submit (`:212-220`), rename submit (`:271-278`), label delete (`:281-295`), `deleteEverything` (`:398-410`), `emptyTrash` (`:412-420`), and the confirm button's handler (`:367-371`).

**What happens**: `store.change` rejects when the transaction fails (`store.js:218-254`, `apply`: "Anything that throws before then aborts the whole transaction and rejects"). Quota errors, a refused write, or a database closed by another tab's upgrade (`store.js:148`, `db.onversionchange = () => db.close()`, after which every later `db.transaction` throws) all land here. None of the five callers has a `try`/`catch`, so the rejection is an unhandled promise rejection. The reader sees: label Add and Rename, nothing (the typed name stays, no message); "Delete everything" and "Empty the trash now", the confirm button went `disabled` at `:368` and stays that way with no sentence. "Empty the trash now" is described on the page as the shared-computer wipe (`:149`); if it fails the reader gets no "The trash is empty" line but also no "this failed", so on a shared computer they can reasonably assume the words are gone. The sibling UIs handle it: `labels-ui.js:111-114,133-135` ("That couldn’t be saved in this browser, so nothing changed"), `export-import.js:268-271`, `search-pane.js:811-816`.

**Evidence**: read `writeOver`, `store.change` (`store.js:387-398`) and `apply`; grep of `notebook-page.js` shows no `catch` at all. Not run (no IndexedDB failure injected).

**Fix**: wrap `writeOver` calls (or `writeOver` itself) so a rejection returns `{ ok: false, reason: "failed" }`; add `failed: "That couldn’t be saved in this browser, so nothing changed. Try again."` to `labelMessages`; for the two danger buttons re-enable the confirm button and announce the same sentence (for the trash, "Nothing was wiped").

**Confidence**: High (mechanism); the exact failure triggers are plausible but untested.

**Fixed (2026-11-09)** `writeOver` catches a failed write: Labels say it couldn't be saved, and the two buttons come back with a line saying so.

#### GF8a-3 · Medium · usability · NEW
A verse index that fails to load makes a keyword search say "No results." (Search pane; the tray and /search share the pattern).

**Where**: `src/scripts/desk/search-pane.js:547-554` and `:706`; `src/scripts/search-core.js:627-657` (`loadVerseIndex` catches every failure and resolves `null`, forgetting the promise so the next search retries).

**What happens**: Offline, or on a flaky connection, the ~275 KB `search/verses.json` fetch fails. `run` reads `verseIndex = null`, sets `verseHits = []`, and `drawResults` ends with `say("No results.")` (or lists only glossary and article hits with no hint that scripture was not searched). With a book chosen in the book menu the search is scripture-only (`wantPagefind` false, line 530), so the pane says "No results." for every query. A Pagefind failure, by contrast, is told: line 536 ("The glossary, articles, and introductions couldn’t be searched just now"). The reader cannot tell "nothing matches" from "the verses were not searched", and the retry that the loader allows is never offered.

**Evidence**: read the three sites above; `searchbar.js:1127-1136` and `search.js:1763-1773` have the same `verseIndex ? searchVerses(...) : { hits: [] }` shape, so the gap is not specific to the pane. Not run offline.

**Fix**: when `wantKeyword && !verseIndex`, `tell("The verses couldn’t be searched just now. Search again in a moment.")` and, if nothing else was found, say that instead of "No results."; give the pane a "Try again" button like the Greek paths have (`retryButton`). Apply the same to the tray and /search.

**Confidence**: High (code); Medium on how often readers hit it.

**Partly fixed (2026-11-09, 2026-11-10)** `VERSES_FAILED` (`search-core.js`) replaces "No results." in the Search pane, the tray and /search; the next search retries by itself. The Search pane also shows "The verses couldn’t be loaded." and Try again where the verses would be, as its Greek failures do (2026-11-10; test in `test/desk-audit8-dom-search-pane.test.js`). The tray and /search, which are every reader's search, have no Try again button.

#### GF8a-4 · Low · ui · NEW
Backspacing a query below three letters leaves the Greek offer, the "See results on the search page" link and the "My notes" box from the old query on screen.

**Where**: `src/scripts/desk/search-pane.js:398-404` (`tooShort`), compared with `:384-396` (`empty`), the `input` handler (`:406-415`), `syncOffer` (`:266-278`) and `showPageLink` (`:258-264`).

**What happens**: Type "pistis": the offer line ("“pistis” is also a Greek word…") and the link row appear. Backspace to "pi": the pane says "Type 3 or more letters to search." but `tooShort` resets only `seq`, `last`, `jumpBox` and `groupsEl`. `offerBox`, `pageLine` (its `href` still carries `q=pistis`), `notesSlot` and the `note` line (for instance "Moved the LIT pane to John 3") stay. Worse, `offerSeq` is not bumped, so an offer fetch still in flight when the query shortens arrives (`syncOffer` checks only `offerSeq`) and shows the offer for a query that is no longer there. `empty()` does all of these resets, so the two paths disagree. Clicking the stale link goes to /search for the old word.

**Evidence**: read the two functions side by side; no branch of `tooShort` touches the four elements. Not run in a browser.

**Fix**: have `tooShort` do what `empty` does for the offer, link row, notes switch and note (`offerSeq++`, hide `offerBox` and `pageLine`, `syncNotes(false)`, `tell("")`); factor the shared resets into one helper.

**Confidence**: High.

**Fixed (2026-11-09)** `tooShort` and `empty` share `clearSearch()`.

#### GF8a-5 · Low · a11y · NEW
Opening a glossary entry in the Search pane throws away keyboard focus when the entry arrives.

**Where**: `src/scripts/desk/search-pane.js:895-896` (focus on "Back to results"), then `:906`, `:912` and `:940` (`entryBox.replaceChildren(bar, …)`).

**What happens**: `openEntry` puts `bar` (holding Back to results) in `entryBox` and focuses Back. When the entry loads (or fails, or is not found) `entryBox.replaceChildren(bar, clone)` removes every child, including the already-attached `bar`, then re-inserts it. Removing a focused element from the document blurs it (focus fixup), so focus lands on `<body>` even though the same node is back; a keyboard or screen-reader user who pressed Enter on a glossary result has to Tab from the top of the page to reach Back again. The same on the "Try again" failure path (`:906`), where focus is on Try again.

**Evidence**: read the four lines. Browser behavior (a re-inserted ancestor of the focused element loses focus) is standard but was not reproduced here.

**Fix**: do not replace `bar`; keep it and swap only what follows it (`bar.nextSibling?.replaceWith(clone)` or a `body` container under `bar`), or re-focus Back after the replace. Audit 2's improvement note asks for focus on the arriving entry's heading; this is the same area.

**Confidence**: Medium (browser behavior unrun).

**Fixed (2026-11-09)** The entry's bar stays; only what follows it is replaced.

#### GF8a-6 · Low · a11y · NEW
A passage link clicked inside an open glossary entry moves the LIT pane but its confirmation goes to a hidden live region.

**Where**: `src/scripts/desk/search-pane.js:926-939` (the clone's click handler calls `showHere`), `:459-462` (`showHere` calls `tell`), `:285-287` and `:887` (`top.hidden = true`, and `note` and `live` are inside `top`).

**What happens**: While an entry is open, `top` (field, filters, `live`, `status`, `note`) is hidden. A click on an "Appears in John 3:16" style link in the entry runs `env.showPassage`; the LIT pane moves, but `tell(passageMoveMessage(...))` writes into the hidden note and live region, so a sighted reader gets no "Moved the LIT pane to John 3:16" line and a screen reader gets nothing (a `display: none` live region is not announced). If there is no LIT pane the pane opens one beside this pane, again silently. The result list's own links show the note because `top` is visible there.

**Evidence**: read the lines above. Not run.

**Fix**: give the entry view its own polite region and note line (or move `live` out of `top`), and route `tell` there while `entryBox` is showing.

**Confidence**: High (mechanism).

**Fixed (2026-11-09)** The live region is outside the hidden part, and the entry has its own note line.

#### GF8a-7 · Low · bug · NEW
The Notebook actions window lists what was true when it opened, and it stays open.

**Where**: `src/scripts/desk/commands-window.js:109-142` (`openCommandsWindow` draws `list` once), `src/scripts/desk/notebook-search.js:128-151,165-175` (`commandContext`, `commandList` computed at call time); `src/lib/desk-commands.mjs:63-65` (`hide-notes` reads "Show my marks" or "Hide my marks" from `ctx.hidden`).

**What happens**: The window is deliberately non-modal and survives clicks elsewhere (`float-window.js`). With it open, a reader presses `h` or checks "Hide my marks" in the Notebook: the marks hide, but the row still says "Hide my marks". Pressing it runs the same toggle (`commands.js`: `lit:desk-hide`), so the marks come back, the opposite of the label. The same holds for "Open the Notebook" (`panelOpen`) and any row whose `show` or `name` depends on the context. Only a second open of the window refreshes the list.

**Evidence**: read `draw`, `commandContext`, `listCommands`. Not run.

**Fix**: redraw the rows when `desk:settings` or the Notebook's open state changes while the window is open (the window can subscribe once and unsubscribe in `onClose`), or label the toggle neutrally ("Hide or show my marks").

**Confidence**: High.

**Fixed (2026-11-09)** The window redraws on `desk:settings` and on the panel's changes.

#### GF8a-8 · Low · a11y · NEW
Choosing a row in the Notebook actions window can leave keyboard focus on `<body>`.

**Where**: `src/scripts/desk/commands-window.js:44-48` (the row's click closes with reason `"command"`), `:131-136` (`onClose` returns focus to the opener only for `reason === "close"`).

**What happens**: A keyboard user opens the window from the Notebook's Settings tab or /search, Tabs to a row such as "Hide my marks" or "Print with room to write" and presses Enter. `run(command)` fires the command, then `closeCommandsWindow("command")` removes the window with focus inside it. Unless the command itself moves focus (Open the Notebook does), focus drops to `<body>` and the reader loses their place; the "×" and Escape paths do return it to the opener. The search tray's `onRun` closes the tray, which is a different, handled route.

**Evidence**: read the two sites. Browser focus fixup on removal assumed.

**Fix**: on `"command"` also focus `opener` when it is still connected and focus is on `<body>` after the command ran (`queueMicrotask`/`requestAnimationFrame`), or always for the Settings-tab and /search openers.

**Confidence**: Medium.

**Fixed (2026-11-09)** After a command, focus goes back to the opener if it fell to the page.

#### GF8a-9 · Low · a11y · NEW
In the Greek search, the suggestion buttons ("Did you mean", the article example) and a chosen verse drop keyboard focus on the redraw.

**Where**: `src/scripts/desk/search-pane.js:1048-1053` (`fix`), `:1170-1177` (`next`), neither with a `data-focus-key`, unlike the choices, "Exact form only" and Try again (`runKeeping`, `settleFocus`, lines 326-341); `src/scripts/desk/greek-find.js:321-325` (`next` then `runQuery`), `:395-408` (a result row: `close({ focus: false })` then `openHit(hit)` or `await selectWord(...)`, whose boolean result is ignored).

**What happens**: Pressing Enter on a suggested correction replaces the input's value and fires `input`; 120 ms later `run` clears `groupsEl` and the button is gone, and nothing gives focus to the new results or the field (the example list under `drawHelp` does refocus the field, line 1030; these two do not). In the Greek tab's find view, picking a result button hides the results list with focus inside; if `selectWord` resolves false, or `openHit` moves a different pane, focus stays on `<body>`.

**Evidence**: read the sites; `runKeeping`'s comment (DK-4) names the same trap as the reason for focus keys.

**Fix**: give `fix` and `next` a focus key (`runKeeping`-style) or focus the input after the dispatch; in `greek-find.js` focus `focusText()` when `selectWord` returns false and the pane that `openHit` opened otherwise.

**Confidence**: Medium (focus fixup is browser behavior).

**Partly fixed (2026-11-09)** The suggestion buttons put focus back in the field, and Greek find's suggestion and a refused word keep it; after a chosen verse it is restored only if it fell to the page.

#### GF8a-10 · Low · a11y · NEW
Escape in the label rename field cancels the rename while an IME or dead-key composition is open.

**Where**: `src/scripts/desk/notebook-page.js:265-270` (the rename form's `keydown`).

**What happens**: A reader composing text with an IME or a dead key in the rename box presses Escape to cancel the composition; the handler runs `back()` and abandons the whole rename. `float-window.js:127` (GK6-8), `keyboard-shortcuts.js`, `history.js` and the builder guard `e.isComposing`; this handler and the rest of the page's fields do not. (This is the same class as GK8-2; it is a different site and DK8-1's rename bug is separate.)

**Evidence**: grep for `isComposing` finds four guarded files and none under `notebook-page.js`.

**Fix**: first line `if (e.key === "Escape" && !e.isComposing)`.

**Confidence**: High (code), Medium (browser event details).

**Fixed (2026-11-09)**

#### GF8a-11 · Low · bug · NEW
Closing the Search pane while "Make a sheet of these verses" is writing leaves the sheet created with no message and no Undo; a throw in `target.ready()` jams the buttons.

**Where**: `src/scripts/desk/search-pane.js:818-819` (`busy = false; if (destroyed) return;` after the write), `:788-790` (`target.ready?.()` runs outside the `try`).

**What happens**: The reader presses "Make a sheet of these verses" and closes the pane (or the layout changes) before `store.change` resolves. The sheet is written, but the "Made “Search: …”" line and its Undo bar are skipped by the early return, so a sheet appears in My sheets with nothing saying where it came from. Separately, if `target.ready?.()` (a Sheets pane's lazy first save) throws, `busy` stays `true` (set at 784) and every add button stays disabled for the life of the pane.

**Evidence**: read the function; no test path run.

**Fix**: show the notice through `showUndo` even when destroyed (the undo bar is page-level, not the pane's); move `target.ready?.()` inside the `try`.

**Confidence**: High (code).

**Fixed (2026-11-09)** A pane closed during a gather still shows the undo bar, and `ready()` runs inside the `try`.

#### GF8a-12 · Low · bug · NEW
The commands window can open for a pane that closed while it was loading.

**Where**: `src/scripts/desk/search-pane.js:115` and `:950-954` (`withCommands` then `openGreekCommands({ field: input })`), versus `destroy` at `:1239` (which closes the window only when `commands` is already set and open for this input).

**What happens**: A click on "Search commands" starts the `import()` of `greek-commands.js`; if the pane is closed before it resolves, `destroy` finds `commands` null and does nothing, and then the import opens a window bound to a detached input. The window's own check for a missing field (BA114) should close it on the next click, but until then a floating window for a pane that does not exist is on screen.

**Evidence**: read-through only; the window is a rare race on a first-ever open.

**Fix**: in `openCommands`'s `.then`, return if `destroyed`.

**Confidence**: Low (not exercised; BA114's behavior on a detached field not traced).

**Fixed (2026-11-09)**

### Improvements

- `notebook-page.js:189-197`: every change re-reads the whole notebook twice (`store.all()` here and again inside `kept.render()`) and redraws all sections; with 5,000 records that is two full reads per keystroke-sized write. Pass the records into `kept.render` or read once.
- `search-pane.js:706`, `:1182`: counts print without a thousands separator ("5000 keyword matches", "5000 times in the New Testament"); `toLocaleString("en-US")` as the glossary page does for its counts.
- `search-pane.js:914-925`: the cloned glossary entry is not run through `makeInert` as chapters and intros are (SEC3-2), and `decodeURIComponent` at `:921` throws on a malformed `#%` link and aborts the entry's draw. Both are first-party content today; a one-line `makeInert` and a `try` make the pane robust to a bad entry.
- `greek-find.js:212`: while a second search runs (Exact form only, a different word), the old status and list stay on screen with no "Searching…" (the line is set only when the status is empty), so a slow shard looks like a stale result that did not respond.
- `float-window.js`: a window can be moved only with a pointer; a keyboard user who opens the Notebook actions or Greek commands window over content they need can only close it. An arrow-key nudge on the focused title would answer that.
- `float-window.js:140`: the `scroll` listener runs `place` and `getBoundingClientRect` on every scroll event while a window is open; throttle with `requestAnimationFrame` if a long page ever shows jank.
- `search-pane.js`: no AbortController is used anywhere; in-flight fetches are ignored by sequence numbers only. Fine for this payload, but a superseded Pagefind `data()` fan-out (one fetch per result) is not cancelled.

### Questions for the owner

- The Search pane's glossary entry view has no Escape key; Escape in a field is otherwise "back one level" across the desk. Should Escape in the entry go back to results, as the Back button does?
- Should a failed verse index and a failed Pagefind search be told the same way on all three search surfaces (GF8a-3), including a "Try again" button?

### What held up

- **Stale-result ordering, Search pane.** `run` takes `my = ++seq` and re-checks `my !== seq` after every await (`:516`, `:538`, `:543`, `:548`, `:550`), `runGreek` after each `ask()` and the notebook await (`:965`, `:970`, `:973`, `:995`), the Greek chain mutates `greekState` only after its check, and `empty`, `tooShort` and `destroy` bump `seq`. `openEntry` has its own `entrySeq`, `syncOffer` its own `offerSeq`. A newer search finishing before an older one cannot be overwritten by the older. (GF8a-4 and -11 are about the neighbours of this machinery, not the ordering.)
- **Stale results, greek-find.** `run` and `close` bump `seq`; every continuation after an await checks it; row click handlers index `hits` that are reset with the list.
- **`settleFocus` / `runKeeping`** only restore focus from `<body>` or from inside the groups, so a reader who moved on keeps the field. The "My notes" checkbox (`syncNotes`) is hidden and re-shown within the same task, so no focus is lost there.
- **Large result sets.** Rows are drawn 20 at a time (`PAGE`, `nextPage`); "Show more" moves focus to the first new row; `rankVerseHits` runs only on draw. `passagesFromVerses` with 5,000 hostile refs: 21 passages, 0 left out, 2 ms (`fuzz.mjs`). Greek rows load a chapter's Greek only for the rows drawn, guarded by `isConnected`. Greek hits in `greek-find.js` page 10 at a time.
- **`resultTarget` with hostile hrefs** (`//evil.com/…`, `javascript:`, empty, null, `__proto__-3`, `/john-0`, `/john-99`): none is classed as a passage; all are `tab` (opened with `awayTab`, `target=_blank`, `rel=noopener noreferrer`). A glossary link `#%E0` returns the raw id, not an error, from `resultTarget`. Search result HTML is built with `escapeHtml` or text nodes; `highlightVerseHit` is the one `innerHTML` for scripture and was audited before.
- **Undefined names**: the `tsc` scan over `src/scripts/*.js`, `desk/*.js` and `desk/sheets/*.js` finds one (GF8a-1) and nothing else.
- **`float-window.js`**: the Escape handler guards `isComposing`; close during a drag ends the drag without a report; `show` after `close` re-adds the same listener references, which the browser dedups; `resize` and `scroll` are removed in `close`; the window is a non-modal dialog with a named heading that takes focus.

#### `destroy()` and lifetime, listed

| Piece | What it adds | Undone? |
|---|---|---|
| `search-pane.js` | listeners on its own elements (input, form, selects, results, entry, notes box, row buttons) | garbage with the pane (none on `window`/`document`) |
| | `onAddTarget(syncAdd)` | yes, `offTarget()` |
| | debounce `setTimeout` | yes, `clearTimeout(timer)` |
| | `requestAnimationFrame` in `hear` | guarded by `destroyed` |
| | `loadDeskSearch().then`, verse-index, Pagefind, topics, Greek, glossary fetches | not aborted; guarded by `seq`/`entrySeq`/`destroyed`; the caches are module-level on purpose |
| | `syncOffer` fetch | guarded by `destroyed` and `offerSeq` |
| | Greek commands window | closed if already open for this input; a load still in flight is not (GF8a-12) |
| | observers, AbortControllers | none |
| `float-window.js` | `resize`, `scroll` on `window`; `pointermove/up/cancel` during a drag | yes, in `close` (drag via `endDrag`) |
| `commands-window.js` | `pagehide` on `window`; module singleton `current` | yes, in `onClose` |
| `greek-find.js` | listeners on its own tab elements only; no timers, no global listeners, no `destroy` | n/a; in-flight searches paint into detached DOM harmlessly |
| `notebook-page.js` | `store.subscribe` x2, one-shot `setTimeout` in `announce` | never torn down; the page is the whole app (fine) |

### Not reached

- No browser or screen reader, so every focus-fixup and live-region claim (GF8a-5, -6, -8, -9) is from the code and standard browser behavior, not observed.
- `greek-commands.js`, `greek-builder.js` and `tab-greek.js` (the callers of `greek-find.js` and the window `search-pane.js` opens) belong to other slices.
- `kept-list.js`, `trash-list.js`, `export-import.js`, `whats-new.js` and `continue-reading.js` (mounted by `notebook-page.js`) were read only for their error handling, not audited.
- The /search and tray surfaces were checked only to confirm that GF8a-3's pattern is shared.

## Appendix L: Gap pass: the Sheets' paper and word cursor, the margin, change notices, the tours' acts (`GF8b`, Sonnet)

Model: Sonnet 5.5. Commit `15986b6e` (branch `claude/desk-audit-8`), 2026-11-09. Read-only. Read end to end: `sheets/sheet-lit.js`, `sheets/sheet-copy.js`, `lib/desk-margin.mjs`, `widths.js`, `float-resize.js`, `change-notice.js`, `bookmark-follow.js`, `tour.js` (and `tour-runner.js`), `first-use.js`, `whats-new.js`, `kept-list.js`; also read the parts of `desk-sheet-lit.mjs`, `desk-sheet-copy.mjs`, `desk-sheet-leaks.mjs`, `desk-notes.mjs`, `notes-margin.js`, `note-editor.js`, `release-feed.js` those lean on. Ran (scratch `...\scratchpad\audit8\gf8b\`): `margin-fuzz.mjs` (300k random inputs through every `desk-margin.mjs` function, plus a placement-stability loop), `notes-fuzz.mjs` (`layoutFull`/`layoutCircles`/`popoverPlace` with 40 notes on one line, a NaN top, zero widths), `copy-fuzz.mjs` (odd sheets through `modulesForCopy`/`printsOnPaper`, `findLeaks` on 300 parts and 150 blanks, `commercialShare`), `notes-perf.mjs` (5,000 note bodies through `noteBodyHtml`), `zw.mjs` (the sanitizer on an invisible character). No browser: DOM behavior below is from code, and anything that needs a browser or a screen reader is marked Low confidence.

### Summary

This slice is in good shape. The margin arithmetic held up under 300,000 random placements: no non-finite value, no negative width, no panel past the window edge, and a second placement from a first one's own shift never moves (0 unstable of 100,000). `bookmark-follow.js`, `change-notice.js`'s write paths (Keep re-reads and re-checks inside one transaction), the paper copy's leader/participant split, and the kept list's focus handling are all sound. The findings are mostly in the seams: one live region that talks too much, a race in the commercial check, the tour's cleanup when the reader acts mid-step, and a draft that the tour's example editor can delete.

Counts: 0 Critical, 0 High, 2 Medium, 8 Low, 3 Nit (13 findings). Most are small; none loses a record. The one that can lose something the reader typed is GF8b-4 (a pre-reload note draft wiped by taking the tour).

### Findings

#### GF8b-1 · Medium · a11y · NEW

The license card's commercial check re-announces itself in full on every autosave while typing.

**Where** `src/scripts/desk/sheets/sheet-lit.js:1069-1070` (`check` has `aria-live="polite"`), `1077-1133` (`createLicenseCard`'s `render`), called from `sheet-editor.js:904` (`license?.sheetChanged()` inside every `draw`).

**What happens** A leader ticks "This is for a commercial project", then types in a text or question part. Each autosave changes `sheet.modules`, so the `key` at line 1086 differs, the check is recounted, and at line 1093 `check.replaceChildren()` followed by a freshly built list and footer replaces everything in the live region. A polite live region announces the added nodes, so a screen reader reads "LIT material: 1,234 of 2,000 words (61%). The commercial terms allow at most 50%..." plus every other line and the footer paragraph again, after each pause in typing. The numbers rarely change while the leader is writing a question. Only readers who tick the box meet it, but they are the ones the check is for.

**Evidence** Read. The region is never given `aria-atomic`, and nothing compares the new result to the old one before replacing it.

**Fix** Compare the new items to what is drawn (text of each item, or the count tuple) and replace nodes only when the result differs; or announce only a change through the editor's `say` ("Now 52%, over the limit") and make the list a plain, non-live region.

**Confidence** Medium (code read; not heard in a screen reader).

**Fixed (2026-11-09)** The live region is rewritten only when the counts change. Test: `test/desk-audit8-b-writers.test.js`.

#### GF8b-2 · Low · bug · NEW

Unticking the commercial box while a count is still running puts the check back under the unticked box.

**Where** `sheet-lit.js:1077-1093` (`render`). The unchecked branch (1081-1085) clears `check` and sets `lastKey = ""` but never advances `seq`.

**What happens** With a long sheet or a whole book on it, `commercialCounts` awaits up to 28 chapter loads. If the leader unticks during that wait, `render` clears the box, but the running call finishes with `n === seq` (line 1092) and draws the full check, with the "contact the LIT" footer, under an unchecked box. The next `sheetChanged` clears it again, so it looks like a stale panel until the next edit.

**Evidence** Read; `seq` is only incremented at line 1089.

**Fix** `++seq` in the unchecked branch.

**Confidence** High.

**Fixed (2026-11-09)**

#### GF8b-3 · Medium · a11y · NEW (follow-up to DK-1, which added the word cursor, "not yet browser-checked")

The keyboard word cursor is a focusable `role="group"` whose label promises arrow-key behavior; a screen reader in browse mode will not pass it those keys.

**Where** `sheet-lit.js:525-567` (`armWordCursor`), `528-530` (`tabIndex = 0`, `role="group"`, the `aria-label` "Use the arrow keys to move by word…").

**What happens** NVDA and JAWS keep the virtual cursor on a focusable element that is not a widget role (group, region), so ArrowRight and Enter move the virtual cursor or do nothing, and the `keydown` handler at line 538 never sees them unless the user knows to switch to focus mode. The label says arrows will work. Sighted keyboard users are fine (the hint paragraph at line 396 is visible, and the cursor highlight and `say` announcements work). The result is that the one keyboard route to blanking arbitrary words may not work for the readers it was built for.

**Evidence** Read; DK-1's own note says it was not browser-checked and no audit mentions browse or focus mode (grep of the audits and the E log).

**Fix** Give the words a role that makes assistive tech pass keys through (`role="application"` is heavy-handed; a `role="textbox" aria-readonly="true" aria-multiline="true"` with `aria-activedescendant` style announcements, or a "Choose words" button that opens a listbox of words, are the usual patterns), and confirm with NVDA and JAWS. If browse-mode selection followed by "Blank the selected words" already works, say so in the label instead of promising arrows.

**Confidence** Low (needs a screen-reader pass to confirm either way).

**Open (2026-11-09)** Needs a screen reader.

#### GF8b-4 · Low · data-integrity · NEW

The tour's example note editor deletes the reader's saved note draft when it closes.

**Where** `src/scripts/desk/note-editor.js:316-322` (the `onClose` passed to `showPanel` calls `clearDraft()` unconditionally); the example editor is opened by `tour.js:238-251` (`STEPS.note`, `setEditorPreview`).

**What happens** The editor keeps one unsaved draft in `sessionStorage['lit-desk-note-draft']` and offers it back "when the editor opens on this place" (DI-6). A reader who typed a note, reloaded and confirmed the prompt, then takes the tour in the same tab before returning to that verse, runs the tour's note step. That editor is in example mode (`draftKey` is `null`, so it neither reads nor writes a draft), but its `onClose` still runs `clearDraft()`, removing `DRAFT_KEY` regardless of whose it was. The tour promises to leave nothing behind and `start()` refuses to run over a *held* editor, but this draft belongs to no open editor. The reader's words are gone.

**Evidence** Read (`const draftKey = example ? null : ...` at line 276, `onClose` at 318-322).

**Fix** In `onClose`, clear only when `draftKey` is set (`if (draftKey) clearDraft()`), or only when the stored draft's key equals this editor's.

**Confidence** High on the code path; the scenario is narrow.

**Fixed (2026-11-09)** Only a real editor clears the saved draft.

#### GF8b-5 · Low · bug · NEW

If the reader skips or presses Escape while a tour step is still opening, that step's effects outlive the tour.

**Where** `src/scripts/desk/tour-runner.js:139-141` (`later(fn)` is `run?.undo.push(fn)`, a no-op once `run` is null) and `go()` (act is awaited, only its result is discarded when `token` is stale); acts that act after an await: `tour.js:140-147` (`openVerseMenu` clicks the verse number after `await bringIntoView`), `264-278` (`pin` clicks the footnote letter after `bringIntoView`/`frame`), `307-334` (`search` types ">" after `await frame()`).

**What happens** `end()` runs `undoStep()`, clears `run`, and returns. A step still awaiting its first frame then continues: it opens the verse menu or the footnote popover, or types ">" into the search box and opens the tray, over the page the tour has just handed back. Its `later(...)` call is dropped because `run` is null, so nothing ever undoes it. The window is one to a few frames (longest when the target is off screen and has to be scrolled to), so it takes a quick Escape right after Next, but a reader who taps Next and Escape together can leave a verse menu or ">" in the search box. The same applies to a fast double Next: the stale step's `later` closers land in the next step's undo list.

**Evidence** Read; not timed.

**Fix** Give `act` a `live()` check (token and run still current) and have each act test it after every await before it opens anything; or have `later` capture the run that issued it and run the function immediately if that run has ended.

**Confidence** Medium.

**Fixed (2026-11-09)** `later()` after a run ends runs the closer at once, and each act gets `{ live }` and stops after an await once its run has ended (`tour.js`).

#### GF8b-6 · Low · ui · NEW

Many notes on one verse stack without limit, past the end of the chapter, and widen the page.

**Where** `src/lib/desk-notes.mjs:99-115` (`layoutFull`) as drawn by `notes-margin.js:280-334`; `src/styles/desk.css:798-803` (the aside is a 0 by 0 absolute box with visible overflow).

**What happens** `layoutFull` pushes each note below the previous one's first line, so 40 notes on one line give `y` from 1004 to 2096 (1,092 px, run in `notes-fuzz.mjs`), each cut to one line. Nothing clamps `y` to the text's bottom or to the rail's end. On the last verse of a chapter the stack runs below the license band and footer, and absolutely positioned descendants of the aside count toward the document's scrollable overflow, so the page grows blank scroll space. Mid-chapter, the stack spreads far from the verses its notes belong to, with only the circle/line cue to say which is which. A reader with 40 notes on one verse is rare; 10 on the last verse of Romans 8 is plausible.

**Evidence** `notes-fuzz.mjs` for the arithmetic; the overflow is from the CSS (not seen in a browser).

**Fix** Past a cap (say five notes within one line's reach, or when the stack would pass the text's bottom), show the rest as one "N more notes" control that opens the panel's This verse tab; or clamp `y` to the column's bottom and fall back to the circles' packing.

**Confidence** Medium on the stacking (run); Low on the page growth (needs a browser).

**Fixed (2026-11-10)** Decision 7. `layoutCapped` (`desk-notes.mjs`) draws at most five notes per stack (and none starting below the text's foot) and stands one "N more notes" button in for the rest, which opens This verse at that verse through the panel's `showVerse` (`notes-margin.js`, `.desk-note__more` in `desk.css`); with no This verse tab every note is drawn as before.

#### GF8b-7 · Low · usability · NEW

The "what prints" check looks for a blank's answer in a footnote only against the same passage's blanks; the editor checks the whole sheet.

**Where** `sheet-copy.js:522-531` (the `footnote` surfaces carry `passageId`), `desk-sheet-leaks.mjs:79-83` (`mine = blanks.filter(b => b.passageId === s.passageId)`), versus `sheet-lit.js:737-752` (`sheetBlanks`: "a footnote anywhere could give one away") and `sheet-copy.js:180` (`allBlanks` on paper).

**What happens** A leader has blanked "deviation" in Romans 3 and a footnote to Romans 5, which they chose to print, names it. The editor says "Mentions a blank (deviation)" on that footnote; the participant version's notice (`copyLeaks`) says nothing, so the leader who relies on the notice before printing is told less than the editor told them.

**Evidence** Read. The editor's flag is informational after a decision, as the check is.

**Fix** Hold footnote surfaces against every blank (`blanks` rather than `mine`), keeping the "where" text naming the footnote's own passage.

**Confidence** Medium.

**Fixed (2026-11-09)** A footnote surface is checked against every blank, as `sheetBlanks` already assumes; `test/desk-sheet-leaks.test.js` follows.

#### GF8b-8 · Low · performance · NEW

A large notebook redraws in full on every keystroke of "Search my notebook", and What's new redraws on every write by another tab.

**Where** `kept-list.js:272-277` (`takeQuery` calls `render` on `input`, `search` and `change`, no debounce), `80-100` and `147-229` (each render calls `store.all()` and rebuilds every row with its note words, Labels and Delete buttons); `whats-new.js:222` (`store.subscribe?.(() => draw())` with no `{ kinds }` or `{ except }`).

**What happens** With 5,000 notes, each character typed rebuilds thousands of `li`s (about 8 elements each) after a full IndexedDB read, and filter or group work (the scripture-linking of note bodies measured 60 ms for 5,000 bodies, so the DOM work dominates). On /notebook, a moving bookmark in another tab writes every 2 seconds and every sheet autosave writes; each reaches this page's What's new, which re-reads the whole store, though a sheet or a quiet move cannot change what it draws. The list rules in the desk file say a listener asks only for the kinds it draws (BA107).

**Evidence** Read; row cost not measured in a browser.

**Fix** Debounce the query (150 ms) and keep the last `store.all()` for filter-only changes; subscribe What's new with `{ except: NO_CHAPTER_KINDS }` (and `QUIET_KINDS` if a bookmark move should not redraw it).

**Confidence** Low (no browser; sizes are estimates).

**Fixed (2026-11-09)** The kept list is debounced and reuses its last read for filter changes; What's new ignores sheets and places and redraws once reading pauses.

#### GF8b-9 · Low · performance · NEW

On a large sheet every redraw of the editor repeats work proportional to the square of the passages with blanks.

**Where** `sheet-lit.js:370-372` (`notesInputs` stringifies every passage module with blanks, for each passage card), `754-767` (`drawNotes` runs `sheetBlanks`, which awaits `readPassage` for every other passage with blanks), `sheet-editor.js:873` (`sheetChanged` on every card on every draw).

**What happens** With 100 passages with blanks on a 300-part sheet, each draw stringifies about 100 passage modules 100 times; any blank change alters every card's `notesInputs`, so every card then re-reads every other passage (about 10,000 `readPassage` calls, each with `passageCheck`). It is cached by chapter, so likely a second or two of main-thread work per blank change at that size rather than a hang; at ordinary sizes it is not noticeable. `drawNotes` has no sequence guard of its own (it reads `seq` once at 755), so two overlapping calls can finish out of order and leave the older footnote flags drawn until the next change.

**Evidence** Read; not run (needs a DOM and the chapter pages). `findLeaks` itself is fine (100 leaks over 300 surfaces and 150 blanks in 184 ms).

**Fix** Compute the sheet's printing blanks once per `sheetChanged` in the editor and hand it to every card; guard `drawNotes` with its own counter.

**Confidence** Low.

**Fixed (2026-11-09, 2026-11-10)** `drawNotes` has its own sequence guard, and the sheet's printing blanks are worked out once per change of its passages with blanks (`sheetPrintingBlanks` in `sheet-lit.js`, keyed by those passages and shared by every card; a list that met a passage it couldn't read is not kept), so a blank change reads each passage once, not once per card. Test: `test/desk-audit8-dom-sheets-blanks.test.js`.

#### GF8b-10 · Low · bug · NEW

Keep and Delete on a change notice close whatever panel is open when they finish, and a failure after the card was closed is invisible.

**Where** `change-notice.js:407-446` (`doKeep`), `448-463` (`doDelete`), `259-264` (`keepAllowed`, `liveVersion` fetch with no timeout).

**What happens** Both await the store (and, for an unordered content version, a `fetch` of `/api/version.json`) and then call `closePanel()`. A reader who presses Keep and then opens a verse menu while it runs has that menu closed when it lands (a note editor holding words is protected by its `changed()`). If the card was closed and the write then fails, `fail()` writes into a detached panel and the reader is never told the mark was not kept. Buttons stay disabled for as long as the fetch hangs.

**Evidence** Read.

**Fix** Close only if `currentPanel()?.el === panel`; on a failure with the card gone, use the undo bar's notice channel; give `liveVersion` an `AbortSignal.timeout`.

**Confidence** High on the code path; the scenario needs a slow network or store.

**Fixed (2026-11-09)** Keep and Delete close only their own card and ignore presses while working, a later failure goes to `showNotice`, and the version fetch times out after 8 seconds.

#### GF8b-11 · Low · usability · NEW

An empty text part holding only a zero-width space still prints, with its Leader only tag.

**Where** `src/lib/desk-sheet-copy.mjs:66-69` (`hasWords`, which relies on `trim()` and `htmlToText`), `src/lib/desk-sheet-format.mjs` (the sanitizer keeps U+200B).

**What happens** Pasted text from a web page or Word can leave `<p>U+200B</p>` in a part the leader believes is empty. `zw.mjs` shows the sanitizer keeps it and `printsOnPaper` returns true, so the "an empty part prints nothing" rule (SH6-3) fails: a blank block, and for a Leader only part a lone "Leader only" tag, goes on paper and into the saved files and slides.

**Evidence** `zw.mjs` (`printsOnPaper` returned true for the sanitized `<p>​</p>`).

**Fix** In `hasWords`, strip `[​-‍⁠﻿]` before the trim (and in `htmlToText`, which the commercial count and the leak check also use).

**Confidence** High.

**Fixed (2026-11-09)** `hasWords` and `htmlToText` drop zero-width characters.

#### GF8b-12 · Low · compat · NEW (Low confidence)

Leader-only parts between two page breaks leave two adjacent breaks on the participant version.

**Where** `sheet-copy.js:407-412` (every `pageBreak` prints), `src/styles/pages/sheets-page.css:908-912` (`break-after: page` on each); `modulesForCopy` drops the leader-only part between them (`copy-fuzz.mjs`: participant copy keeps parts 1 and 3, both breaks).

**What happens** A leader's sheet reads text, break, Leader only notes, break, text. The leader's copy is fine; the participant copy has two breaks in a row. Whether Chrome, Safari and Firefox turn that into a blank page is not something I could check (the specification collapses adjacent forced breaks, and implementations vary). A leading break is the same case.

**Evidence** `copy-fuzz.mjs`.

**Fix** In `renderCopy`, skip a `pageBreak` when the previous printed block was a break or there is nothing before it, and a trailing one.

**Confidence** Low (needs a print preview in each browser).

**Fixed (2026-11-10)** Decision 11 (BVJ): `renderCopy` skips a page break that would follow another or open the copy, and drops one that would end it, so the paper copy and the documents made from it keep one. Present and slides skip breaks already. `test/desk-audit8-dom-sheet-copy-breaks.test.js`.

#### GF8b-13 · Nit · copy · NEW

A share of 50.4% shows as "50%" yet is marked over the limit.

**Where** `sheet-lit.js:1102-1107` (`pct = Math.round(share * 100)`), `desk-sheet-lit.mjs:516-520` (`over` is `share > 0.5`).

**What happens** 504 LIT words of 1,000 reads "LIT material: 504 of 1,000 words (50%). The commercial terms allow at most 50%." with the red styling. Run in `copy-fuzz.mjs` (`share 0.504`, `over: true`).

**Fix** Show one decimal when the rounded value is 50 and `over` differs, or round up when over.

**Confidence** High.

**Fixed (2026-11-09)** Over the limit, a share that rounds to 50 shows a tenth (50.1%).

### Improvements

- `first-use.js:350`: `window.addEventListener("focus", () => refresh())` reads the whole store (`store.all()`, line 330) on every window focus to learn whether the notebook holds anything. A count or an `onEntry` flag would do.
- `sheet-lit.js:707-714`: choosing "My own hint…" with no text leaves the select reading "My own hint…" while nothing is saved and the participant copy gets no hint; there is no render to reset it until the next change. Revert the select on blur when the box is still empty.
- `bookmark-follow.js:382-407`: a store error while following (storage full) is only logged every flush; the row keeps saying "Following". One quiet notice, once, would tell the reader the bookmark has stopped moving.
- `widths.js:262-267`, `float-resize.js:87-92`: the two splitter handles report the value of the pane that shrinks when Right Arrow is pressed (`aria-valuenow` goes down), the opposite of the window-splitter pattern; fine for a sighted user, odd for a screen reader. `valuetext` already says what the number is.
- `tour.js:97-100`, `STEPS.margin`: where the reader has a real note in view it is outlined and described as the example. Worth one sentence on the card ("this is one of yours").
- `sheet-lit.js:289-296` (`wholeWords`): selecting only a space between two words blanks both words, and selecting only a comma blanks the word before it. Matches "snap to whole words" but is surprising; a selection with no letter in it could be refused with the existing message.
- `kept-list.js:149-153`: the count line is `aria-live` and changes on every keystroke; a 300 ms announce delay would stop the stream of "Showing 3 notes (of 40 kept)".

### Questions for the owner

- Should a participant copy collapse a page break that has nothing between it and the last one, when leader-only parts were removed from between them (GF8b-12)? It is a layout call: some leaders may want a deliberate blank page.
- The word cursor (DK-1) is the only keyboard route to blanking a free choice of words. Is a screen-reader pass on it planned before the Study Desk's release (GF8b-3)?
- Many notes on one verse: cap and fold into "N more" (GF8b-6), or let the margin stack as it does?

### What held up

- `desk-margin.mjs`: 300,000 random inputs through `placeInMargin`, `placeFloating`, `panelHeight`, `placeWithWidths`, `dragNotebookEdge`, `dragTextEdge` and `firstPaint`: finite results throughout, no negative widths, no panel past the right edge, no negative shift; a placement fed its own shift is stable. The only non-finite result needs `ch = 0`, which `widths.js:147` guards (`|| 10`). Only a viewport narrower than 32px, where `left` goes slightly negative, misbehaves.
- `widths.js` and `float-resize.js`: a sessionStorage value of NaN or Infinity is refused, out-of-range values are clamped by the rules, keys and pointer drags share one path, handles are focusable and keyboard-operable, a failed pointer capture is tolerated.
- `bookmark-follow.js`: one transaction per move with a re-check that the record still follows and is editable; a pause rather than an end; a duplicated tab asks before following; `leaving` and `settling` guards; `moveItHere` that refuses on a deleted record. No unfiltered write path.
- `change-notice.js`: Keep re-reads the record and its notice, refuses on an older page, and writes only over the version the reader was shown (`modified` compared in the transaction); everything a reader wrote is set as text; one unreadable record cannot take the others' notices down.
- `sheet-copy.js`: the participant copy leaves out leader-only parts, answers, the answer key and (through `keyTermsForCopy`) terms that would give a blank away; `printsOnPaper` handles empty parts, a lone Leader only tag, an answer-only question and a heading-only part; unknown module types and null modules print on neither copy (run); a missing passage prints its message on paper and does not stop the rest; a bad book key gets no QR code.
- `sheet-lit.js`: `restoreFocus` after every redraw, the hint fields that are never redrawn under the reader (`typing`), a render sequence guard on the passage and key terms cards, blank ranges released on `destroy`, no raw HTML anywhere (passages come from the inert kept parts; the reader's words go in as text).
- `kept-list.js` (below line 120): focus after Delete lands on the next Delete button (indexes align: every `.desk-item` has one), the open panel is re-pointed at the replacement button after a redraw, the colors group keeps focus, ids come through `CSS.escape`.
- `whats-new.js` draw half: unchanged redraws keep focus (`drawn` signature), "New" holds for the visit, a failed feed offers Try again and lands focus, the one write is the "last looked" meta and it is wrapped.
- `first-use.js`: no card, offer or reminder without a store; the offer is marked "later" as it is shown, so leaving never re-offers; the three tours' keys and answers stay separate.

### Not reached

- Anything needing a browser: the paper copy's actual pagination, the 300-part sheet's draw time, the margin stack's effect on page height, tour step timing, screen-reader behavior of the word cursor and the live region.
- `margin.js` (the caller of the placement arithmetic) and `notes-margin.js` beyond lines 150-380; `sheet-editor.js` beyond the call sites cited; `tour-runner.js`'s card styling.
- The format writers fed by `readCopy` (`sheet-word.js`, `desk-doc-*.mjs`) and `sheet-present.js`; they read the copy this file draws, but are outside this slice.

## Appendix M: Gap pass: the pure logic layer (`GF8c`, Opus)

Slice: the 41 `src/lib/desk-*.mjs` modules listed in the prompt, plus 12 small client files. Model: Claude Opus 5.5. Commit `15986b6e` (branch `claude/desk-audit-8`). Date 2026-11-09. What I ran: every module imported in Node and exercised. That covered fuzzing `planHighlight` (1,720 sequential random marks on 60 random chapters, holding no-overlap and coverage invariants), the passage round trip (`passageFromOffsets` to `locatePassage`, 6,330 random selections over every published chapter), `wordingDiff` (20,000 random pairs with Greek, Hebrew, combining marks, quotes and dashes), `splitPassage` text preservation (2,000 random paragraphs), all three document writers plus `docHtml` and `docText` on a model holding every block type and hostile text, and `citedRefs` against 24 reference shapes. I also ran adversarial probes of verse ranges, labels, bookmark names, the leak check and the refusal sentences. Existing unit tests for the main modules were run too (224 pass). Scripts are in `scratchpad/audit8/gf8c/`.

### Summary

The pure layer is in good health where it matters most. A highlight plan never leaves overlapping marks or uncovered text. A passage made from any selection on any published chapter is found again exactly. The wording diff always rebuilds the new text. The writers keep every block in order, Greek and Hebrew included. The weak spot is input bounds. Nothing caps a record's or a sheet passage's `endVerse`, and four callers loop once per verse in the range. A backup, a Markdown notebook copy or a sync carrying "John 3:16–20000000" therefore freezes or breaks a chapter's verse labels, "Print with my notes" and the commercial check (GF8c-1). The rest are content-fidelity and copy gaps:

- the SH6-4 refusal sentence gives wrong advice for the four one-chapter books;
- Copy and Save as flatten the 1 Corinthians 11 chiasm footnote and drop bold in footnotes;
- the leak check misses a blanked possessive;
- the Edit bookmark form accepts the 11 verse numbers the LIT omits;
- the slides don't cut a long list;
- plain-text Copy numbers every list item "1.";
- the verse number's accessible name lacks the Oxford comma;
- labels that read as nothing are accepted.

Counts: Critical 0, High 0, Medium 2, Low 7, Nit 1.

### Findings

#### GF8c-1 · Medium · data-integrity · NEW
**A record or sheet passage whose `endVerse` runs far past its chapter is valid, and four callers loop once per verse in it: the page freezes for seconds on every notebook change, or the verse labels stop with "Map maximum size exceeded".**

**Where**
- `src/lib/desk-records.mjs:431` (`validateRecord`) and `src/lib/desk-sheet-format.mjs:966` (passage module check) require only `endVerse >= verse`. There is no upper bound.
- The loops:
  - `src/lib/desk-verse.mjs:69`, `:88`, `:110` (`noteCounts`, `highlightColors`, `bookmarkedVerses`), called by `src/scripts/desk/verse-labels.js:114-116` on every store notice;
  - `src/scripts/desk/verse-labels.js:107` (`noticeCounts`);
  - `src/lib/desk-print-notes.mjs:97` (`blockForVerse`, from `print-notes.js:307`);
  - `src/lib/desk-sheet-lit.mjs:559` (`completeBooks`, the commercial check).
- One way in: `src/lib/desk-export.mjs:327` (`parseReference` in the Markdown import) passes the typed end verse straight through.

**What happens** A Markdown notebook copy edited to read `## John 3:16–20000000` imports cleanly. So does a backup or a synced record from an app bug with that range. From then on, every visit to John 3 with the desk on runs `noteCounts` over 20 million verses. At 10 million (`span` keeps under the Map limit) it takes about 2 s per refresh. `verse-labels.js` refreshes on every store change that isn't quiet, so typing a note or adding a highlight stalls the page each time. Above about 16.7 million the Map throws "Map maximum size exceeded" inside the async `refresh`, and the verse numbers' accessible names (BA22) stop updating. "Print with my notes" on a page lacking the note's first verse loops `endVerse` times through `findIndex`. A shared or imported sheet with the commercial box on and a passage such as "Jude 1:1–10000000" spends about 2 s in `completeBooks`. The record is valid, so nothing says why. Removing it from the Notebook is the only cure, and that list is drawn on the frozen page.

**Evidence**
- `gf8c/verse-span.mjs`: `validateRecord` returns `[]` for `verse: 1, endVerse: 30000000`, and `noteCounts` throws "Map maximum size exceeded" after 3.5 s.
- `gf8c/md-import.mjs`: `toMarkdown`, then the heading edited, then `parseImport` gives `kind: "markdown"`, no problems and a record with `endVerse 20000000`, and `noteCounts` on it throws.
- `gf8c/verse-span2.mjs` timings: `noteCounts` at 1e7 takes 2,060 ms, `bookmarkedVerses` at 1e7 takes 1,608 ms, `blockForVerse` at 2e6 over 30 blocks takes 272 ms, and `completeBooks` on Jude at 1e7 takes 2,234 ms.

**Fix** Bound it at both ends.
- Clamp a span to the chapter where it is used: `to = Math.min(to, verseCount(bookKey, chapter))` from `src/data/verse-counts.js` in `span()`, `noticeCounts`, `blockForVerse` and `completeBooks`.
- Add a ceiling to `validateRecord` and the passage check, such as `endVerse <= verse + 200` (the longest NT chapter is 80 verses), or `<= verseCount + some slack` if the format must allow newer text.
- Have the Markdown importer refuse an `endVerse` past the chapter's last verse, as `bookmarkPlace` does.
- Tell BDR, since the apps validate by the same format.

**Confidence** High.

**Partly fixed (2026-11-09)** Every loop clamps to the chapter's last verse (`span()` in `desk-verse.mjs`, `lastCounted` in `verse-labels.js`, `blockForVerse`, `completeBooks`), and the Markdown import refuses a verse past its chapter. A ceiling in `validateRecord` and the sheet format is a change to the shared format: for BVJ and BDR. Tests: `test/desk-audit8-e-verse.test.js`.

#### GF8c-2 · Medium · usability · NEW
**For Philemon, 2 John, 3 John and Jude, the passage form's refusal (SH6-4) tells the leader to "add Jude 3 and then the next chapter… such as Jude 3:3–12".**

**Where** `src/lib/desk-sheet-ref-refusal.mjs:46-51` (`describeRefusal`), called from `src/scripts/desk/sheets/add-forms.js:177-180`.

**What happens** "Jude 3-5" and "Philemon 4-7" are the ordinary way to cite a one-chapter book. `parseReference` (search-core.js) returns null for them: it reads "Jude 3" as chapter 3, and "Jude 3-5" as a range of chapters. `describeRefusal` treats the input as a cross-chapter range and builds its advice from `parse("Jude 3")`, which is chapter 3. The result is "A passage is one chapter at a time. Add Jude 3 and then the next chapter, or give verses within one chapter, such as Jude 3:3–12." Jude has no chapter 3 and no next chapter, and following the example fails again with "Jude has only one chapter." The same happens with "2 John 1-3", "3 John 2-4" and "Jude 1:3-2:1".

**Evidence** `gf8c/refusal2.mjs` and `refusal3.mjs` call the real `parseReference` and `describeRefusal`. The sentences quoted above are their output.

**Fix** In `describeRefusal`, when `BOOKS[first.bookKey] === 1`, say something like "Jude has one chapter, so give its verses as Jude 1:3–5." Better, have `parseReference` read "Jude 3-5" and "Jude 3" as verses of chapter 1 for one-chapter books. That is search-core's rule, so it is the search box's and Go to passage's call too.

**Confidence** High.

**Fixed (2026-11-09)** One-chapter books get "Jude has one chapter, so give its verses as Jude 1:3–5." Test: `test/desk-sheet-ref-refusal.test.js`.

#### GF8c-3 · Low · data-integrity · NEW
**Copy and Save as (.docx, .odt, .rtf) run the 1 Corinthians 11 chiasm footnote together as one line and drop the bold the LIT's footnotes use.**

**Where** `src/scripts/desk/sheets/sheet-word.js:20` (`INLINE` lacks `b` and `i`) and `:78` (any other element, `div` included, is flattened into its parent's inline run). Footnotes go through `inlines(body.childNodes)` at `:166`.

**What happens** A sheet with a passage including 1 Corinthians 11:2 and footnote b printing shows the chiasm on paper as an outline, A to A′, a line each. The `div.chiasm-line`s and their `<b>` keys come from the chapter page through `sheet-copy.js:201-206`. Copy and every saved document produce "…as follows:A:Verse 2 – The Corinthians’ willingness to hold onto prescribed teachingsB:Verse 3 – Metaphorical heads…": no line breaks, no spaces, and the bold letters plain. Separately, 33 `<b>` runs in footnotes across the corpus lose their bold in every file. Examples are John 3's "things that demonstrate they are trustworthy…" and 1 Corinthians 13's bolded quotation marks. The leak check reads the same footnote by `textContent` (`sheet-copy.js:527`), so it sees fused tokens such as "teachingsB".

**Evidence** Corpus scan: `fn-b` of 1 Corinthians 11 is the only footnote with block markup, and `<b>` occurs 33 times. `gf8c/chiasm.mjs` runs the footnote's HTML through `inlines()`'s rules and `docText`, which prints the run-together line above. The paper path keeps the divs (read at `sheet-copy.js:201-206`).

**Fix** In `inlines()`, map `b` to `strong` and `i` to `em`. For a block element inside a footnote body, either emit `{ t: "br" }` between blocks or read the note with `block()` into its own blocks. The handout's rule ("a note's own blocks each take a line", `src/scripts/CLAUDE.md`) is the precedent.

**Confidence** High (code read plus model run; not opened in Word).

**Fixed (2026-11-09)** `inlines()` keeps `b` and `i` as bold and italic and breaks between `div` and `p` blocks, so every writer gets the chiasm's lines.

#### GF8c-4 · Low · bug · NEW
**The "what prints" check misses a blank on a possessive or contraction when the base word prints elsewhere: a blank on "God’s" is not reported against a question asking "What does God want?".**

**Where** `src/lib/desk-sheet-leaks.mjs:33-44` (`tokens`, `wantOf`) and `:97` (`hasRun`).

**What happens** Blanks snap to whole words with an apostrophe joining letters (`wordSpans`, `desk-sheet-lit.mjs:182`), so a blank's words are often "God’s", "Christ’s" or "Messiah’s". `tokens` splits these into ["god", "s"], and `hasRun` needs both tokens in a row, so a title, question or text part that names "God" or "Christ" is not flagged. The reverse (blank "God", text "God’s") is flagged. The participant still reads the answer off the page.

**Evidence** `gf8c/leaks.mjs`:
- `containsPhrase("Who is God?", "God’s")` is false;
- `containsPhrase("Jesus Christ", "Christ’s")` is false;
- `containsPhrase("God’s love", "God")` is true;
- `findLeaks([{ exact: "God’s" … }], [{ kind: "question", text: "What does God want?" }])` returns `[]`.

**Fix** In `wantOf`, drop one-letter tokens (a trailing "s", "t", "d", "m") once something else is left, so a blank's `want` is its content words.

**Confidence** High.

**Fixed (2026-11-10)** Decision 11 (BVJ): `containsPhrase` and `findLeaks` also try a blank's words without their possessive “’s”, so a blank on “God’s” is flagged against “What does God want?”. Footnotes were already flagged both ways (`blanksGivenAway` compares stems).

#### GF8c-5 · Low · data-integrity · NEW
**Edit bookmark accepts any of the 11 verse numbers the LIT doesn't have (Matthew 17:21 and others), so a bookmark is stored on a verse that isn't on the page.**

**Where** `src/lib/desk-bookmark-change.mjs:76-77` (`bookmarkPlace` checks only `verse <= verseCount`).

**What happens** In the Edit bookmark form (E46), typing "Matthew 17:21" saves. The bookmark's mark has no verse to sit beside. Its link `#v21` lands on no verse, and the verse labels name nothing. The sheet's passage form refuses the same input with "Matthew 17:21 isn’t in the LIT." (`passageForReference`), so the two forms disagree.

**Evidence** `gf8c/bmplace.mjs`: `bookmarkPlace({ matthew, 17, 21 })` returns a place, `verseCount` is 27, and the chapter's anchor text has no verse 21. The corpus has 11 such gaps: John 5:4, Luke 17:36, Luke 23:17, Mark 7:16, 9:44, 9:46, 11:26 and 15:28, and Matthew 17:21, 18:11 and 23:14.

**Fix** Keep a committed list of the gaps beside `VERSE_COUNTS`, which the browser can read without chapter files, and have `bookmarkPlace` refuse them as `passageForReference` does, or move to the verse before.

**Confidence** High.

**Fixed (2026-11-09)** `src/data/verse-gaps.js` lists the 11 gaps (checked against the chapter files by `test/desk-audit8-e-verse.test.js`), and `bookmarkPlace` refuses them.

#### GF8c-6 · Low · bug · NEW
**A long list in a text or question part is never cut across slides, so a sermon outline overflows its .pptx and .odp slide. DK3-1's cutting covers paragraphs and quotations, not lists.**

**Where** `src/lib/desk-slides.mjs:256-266` (`splitPassage`: only `b.inlines` blocks are cut by sentence, and `b.blocks` by block; a `list` block has `items` and goes through whole).

**What happens** A text part holding a 40-item numbered outline (the Sermon template's Outline part is a list) comes out as one slide of about 2,400 characters at 28 pt. The cutting rule is about 560. PowerPoint doesn't refit a box on open (the reason for DK3-1), so the list runs off the slide. Present mode itself fits by size, so only the file is wrong.

**Evidence** `gf8c/slides.mjs`: `deckSlides` of one text screen holding that list returns `[["text", 2371], ["end", 0]]`. The same length as a quotation or a paragraph is cut into slides of 598 or fewer.

**Fix** In `splitPassage`, when there is no covered form, split a list block between items (and nested lists between their items) into several list blocks with continued numbering (`start`), as `splitBlocks` does for a quotation's blocks.

**Confidence** High on the deck; Medium on how each app renders the overflow.

**Fixed (2026-11-09)** `splitList` cuts a long list between its top-level items, numbering carried on. A single item with a long nested list is still not cut.

#### GF8c-7 · Low · copy · NEW
**Copy's plain-text flavor numbers every item of a numbered list "1." and loses nesting.**

**Where** `src/lib/desk-sheet-doc.mjs:246` (`docText`, `b.ordered ? "1." : "•"`).

**What happens** The plain text that reaches a plain-text email, a text message or Notepad reads "1. Opening / 1. The text / 1. The turn / 1. Sending" for the Sermon template's outline. Nested items sit at the left edge with no indent. The HTML flavor and the three files number correctly (checked by Audit 3). This is older than E37 (`sheet-word.js` had it), and `test/fixtures/sheet-copy-golden.json` holds it, so the fixture changes with the fix.

**Evidence** `gf8c/writers.mjs` output: "1. L20 / • L21 / 1. L22" for an ordered list of three items with a nested bullet.

**Fix** Count the items (`${i + 1}.`), indent nested lists by two spaces per level, and regenerate the golden.

**Confidence** High.

**Fixed (2026-11-09)** `docText` numbers an ordered list and indents a nested one.

#### GF8c-8 · Low · copy · NEW
**A Chapter View verse number's accessible name lists three or more highlight colors without the Oxford comma ("highlighted yellow, green and pink").**

**Where** `src/lib/desk-verse.mjs:116` (`joinWords`), used by `verseLabel` at `:139`. `test/desk-verse.test.js:151-152` asserts the comma's absence.

**What happens** The site's rule is "The Oxford comma, always" (BVJ, 2026-10-14) for reader-facing text, aria-labels included. This label predates the rule (2026-10-08 and 2026-10-09). BA134's sweep fixed fourteen lists but missed it, since the comment calls the missing comma intended.

**Evidence** `gf8c/verse-span.mjs` prints "Verse 3, bookmarked, highlighted yellow, green and pink, 1 note of mine, 2 changed since I marked them".

**Fix** Use `joinList` from `desk-whats-new-view.mjs` (or the same rule) and update the two test lines and the docstring.

**Confidence** High.

**Fixed (2026-11-09)**

#### GF8c-9 · Low · usability · NEW
**A label whose name reads as nothing (a lone combining mark, a zero-width space, a word joiner, a soft hyphen) is created, and the duplicate check skips it, so several invisible labels can exist. A bookmark name is cut inside an emoji sequence.**

**Where**
- `src/lib/desk-labels.mjs:27-37` (`normalizeLabelName` keeps format characters, and `labelKey` strips the marks, leaving `""`) and `:49` (`if (!key) return null`, so an empty key never finds a duplicate).
- `src/lib/desk-bookmarks.mjs:67-68` (`cleanBookmarkName` cuts by code point).

**What happens** Pasting a stray "́" or "​" into New label makes a label with no visible name. A second paste of the same mark makes a second one. A ZWSP label is refused as a duplicate, but a lone mark is not. A bookmark name of 38 characters followed by a family emoji keeps "👨" plus a trailing ZWJ, and a flag at the limit keeps half a regional pair. The comment says "an emoji at the limit is never split in two", which holds only for single-code-point emoji.

**Evidence** `gf8c/labels.mjs`:
- `planCreateLabel` with "́" twice gives `ok: true` both times;
- "⁠" and "­" give `ok: true`;
- the cut name ends `[1f468, 200d]` and `[1f1fa]`.

**Fix** Treat a name whose `labelKey`, with `\p{Cf}` also removed, is empty as `"empty"`. Cut bookmark names (and labels, if they gain a cut) by grapheme with `Intl.Segmenter`. A grapheme cut never exceeds `validateRecord`'s code-point count.

**Confidence** High.

**Fixed (2026-11-09)** A name that reads as nothing (with `\p{Cf}` and spaces removed) is empty, and bookmark names are cut by grapheme. Tests: `test/desk-audit8-e-labels.test.js`.

#### GF8c-10 · Nit · copy · NEW
**`noteOpening` adds its comma after a quote that ends in a closing quotation mark or a dash: "My note on ‘said, “Come and see.”,’ John 1:39:" and "‘Is it I, Lord?”,’".**

**Where** `src/lib/desk-notes.mjs:187-189`.

**Evidence** `node -e` probe (in the session log): the four outputs above, plus "‘a voice—,’".

**Fix** Strip the trailing comma rule when the quote ends in `”`, `’` or a dash, and treat `?”` and `!”` like `?` and `!`. This is heard by screen readers only, which mostly skip punctuation, hence Nit.

**Confidence** High.

**Fixed (2026-11-09)**

### Improvements

- `desk-sheet-ref-refusal.mjs`'s `TAIL` regex is unanchored and quadratic on a long run of digits (8,000 digits take 157 ms). It is typed input, so this is harmless, but anchoring the book part (`^(.*?)(tail)$`) would make it linear.
- `documentFileName` (`desk-sheet-doc.mjs`) uses `.slice(0, 80)` by UTF-16 unit, which can leave a lone surrogate at the cut. `Array.from(name).slice(0, 80)` avoids it.
- `startingPassage` (`desk-passage.mjs:142`) throws away a valid book and chapter when `lit_last_read.verse` is malformed. Fall back to the chapter rather than Matthew 1.
- `checkPassage` (and so `parsePassage`, `passage-bar.js` and `?place=`) doesn't bound the verse by the chapter's count ("john 3:999" is a valid place). `VERSE_COUNTS` could bound it, as GF8c-1 suggests for records.

### Questions for the owner

- GF8c-1: should the format itself say the ceiling on `endVerse` (and `verse`), so the apps refuse such records too? It is a contract change for BDR.
- GF8c-4: is a blank on "God’s" given away by "God" on the page? The fix assumes yes, as the code already says for "God" against "God’s".

### What held up

- **Highlights** (`desk-highlights.mjs`): over 1,720 random marks, erases and color changes across 60 chapters, applied in sequence, it never left two overlapping highlights. Every new mark's range was covered by exactly its color, an erase left nothing, and every survivor was re-found with status "found" (`gf8c/hl-fuzz.mjs`).
- **Passages** (`desk-sheet-passages.mjs`): 6,330 random selections over every published chapter round-trip exactly through `passageFromOffsets` and `locatePassage`. A whole-verse selection gets no quote, and a part-verse one is found at the same offsets (`gf8c/passage-fuzz.mjs`).
- **Wording** (`desk-wording.mjs`): 20,000 random pairs. The "same" and "ins" runs always rebuild the new text, and no diff reports a change when `wordingChanged` says there is none. 600×600 tokens take 2 ms, and `wordingKey` on 400 KB takes 26 ms (`gf8c/wording.mjs`).
- **Chains** (`desk-chains.mjs`): cross-chapter ranges split per chapter, single-chapter books, the note mode's "bare number is prose" rule, the Sefaria and eBible exclusion and escaping all behave (`gf8c/chains.mjs`).
- **Writers** (`desk-sheet-doc`, `desk-doc-docx`, `-odt`, `-rtf`): a model with every block type, a blank answer and a participant blank, a hint, a footnote, a nested list, a box, a quote, a rule, lines, a break, a link with a space, colors, sizes, Greek, pointed Hebrew, a ZWJ emoji, a combining mark, RTL overrides, `&`, `<` and curly quotes came out with every token, in order, in .docx, .odt, `docHtml` and `docText`. The RTF carries Greek with `\lang1032`, Hebrew in an `\rtlch` run and the emoji as surrogate `\u` pairs. The credit foot is replaced by `DOC_CREDIT` in all three, as designed (`gf8c/writers.mjs`).
- **Slides** (`desk-slides.mjs`): `splitPassage` never drops or duplicates text across 2,000 random paragraphs, and a long quotation is cut into slides of 598 characters or fewer.
- **Leak check** handles pointed Hebrew against unpointed, Greek accents, hyphen against space, and the telltale word (`gf8c/leaks.mjs`). The key terms box blanks give-away renderings itself (`keyTermsForCopy`), so its absence from the surfaces is correct. Same-passage repeats are an owner decision (Audit 5, #8).
- **Print** (`desk-print-notes.mjs`): `planNotes` sorts NaN and Infinity offsets safely, `markPieces` clips and never double-wraps, and `printWasAsked` rejects a malformed or old mark. `print-look.js` and `print-link.js` take the mark once and always take the look away.
- **`desk-inert.mjs`**: the remove list, the dropped attributes and `plainAddress` (control characters stripped before the scheme is read) cover every loading, running or submitting construct I could name. The site defines no custom elements that an import could upgrade.
- **`desk-first-stage.mjs`**: the peek aborts creation (no empty database left), the key range covers a whole book, and every path ends in `finish` or the timeout.
- **`desk-whats-new*`**, **`desk-sheet-check`**, **`desk-sheet-gather`**, **`desk-sheet-from-notes`** (the byte limit is enforced by the editor's save), **`desk-search-pane`**, **`desk-corpus`**, **`desk-start`**, **`desk-announce`**, **`desk-footnote-pills`**, **`desk-greek-*`**, **`desk-lit-text`**, **`desk-prose-anchor`** (off in v1), **`desk-zip`** (mimetype stored first) and **`desk-present`** (`checkState` bounds everything from the other window): read, probed, nothing wrong.
- **Client files** `dom.js`, `greek-link.js`, `page-kind.js`, `passage-bar.js`, `print-look.js`, `print-room.js`, `bookmark-mark.js`, `bookmark-stop.js`, `diff-view.js`, `release-feed.js`, `print-link.js` and `sheets/sheet-word.js`: no obvious bug beyond GF8c-3.
- The corpus has no combining marks in its English text, so `wordSpans`' `[\p{L}\p{N}]` word rule loses nothing there.

### Not reached

- Opening the .docx, .odt, .pptx or .odp in Word, LibreOffice or PowerPoint to see GF8c-3's and GF8c-6's output as an app renders it (no apps here).
- A live check of GF8c-1 in the browser (the stall on refresh is inferred from the measured `noteCounts` time and `verse-labels.js`'s subscribe).
- `desk-slides-pptx.mjs` and `desk-slides-odp.mjs`, beyond confirming that they draw `slideParagraphs`.
- `sheet-word.js`'s `readCopy` was read, not run against a drawn copy, because there was no DOM.

## Appendix N: The live pass (`LV8`, Sonnet)

Slice: the live auditor, whole desk driven in the browser pane. Model: Sonnet 5.5. Commit `15986b6e` (production build served by `audit8-dist` on port 4598). Date 2026-11-09. Ran: Browser pane at 1000x700 (and 800x560, 375x812 mobile), light and dark, two extra tabs; JS reads of IndexedDB, computed styles and the network list; real key presses for typing, Tab, Ctrl+Z and Present. Not run: print dialogs, file saves, forced colors, a second machine.

**Origin state at start (the brief expected a fresh origin).** Port 4598 was NOT fresh. It held `lit-desk` IndexedDB with 4 records (2 sheets from 2026-11-07/08, one bookmark on John 3:1, one note "Audit test note on footnote a"), localStorage keys `lit-desk-home`, `lit-desk-preview=on`, `lit-greek-commands=seen`, `lit-desk-page-tour`, `lit-desk-tour` (both with `later:` markers), `lit-desk-layout` (My Notes / LIT / a Sheets pane), `lit-desk-panel`, `lit-desk-tab=greek`, `lit-desk-min`, `lit_last_read`, `lit_pv` in sessionStorage, and cookie `lit_apps_launch_v1`. A previous live session evidently used it. To get a first-use tour I removed `lit-desk-tour`, `lit-desk-page-tour` and `lit-greek-commands` with JS (storage cannot be cleared). So "first use" below is a replay of the tours with the preview already on, not a true cold arrival: no "How we keep your notebook" card, no home question, no pre-desk first page was seen.

**Screenshot trap worth knowing.** At dpr 1.25 a screenshot of an 800-wide viewport shows only the left 640 CSS px; and a screenshot often lags one action behind (after Save, the shot still showed the open dialog). Use `computer zoom` with region `[0,0,W,H]` for the full view, and check state with JS.

### Summary

The desk held up well under live use: notes, bookmark, highlight, pin, label, delete, Ctrl+Z, and restore from the trash all worked first time; all three tours run to the end; every pane kind draws and switches; sheets build from a template and from the Add menu, the print check fires on changed wording, Present works with real keys, share link, import, Copy link, Save as template and the list's Duplicate/Delete (with undo) all work; the shared sheet reads, presents and switches version on a phone; Greek tab, tray search, /search, builder and commands window all work. Both code-auditor claims about the Sheets list are **confirmed**. Findings: 0 Critical, 0 High, 2 Medium, 6 Low, 1 Nit.

### Findings

#### LV8-1 · Medium · usability · NEW
The /sheets list rebuilds on every autosave made in another tab: it closes an open chooser and loses focus.
**Where**: `src/scripts/desk/sheets/sheet-page-list.js` (list redraw on a store notice), `sheet-page.js` `showList`.
**What happens**: Leave `/sheets/` open in one tab, edit a sheet in another. I attached a MutationObserver to `<main>` in the list tab. Each save elsewhere (a typed line, a title change, a typed character in the title) produced one full rebuild (`childList` additions of 1 then 3 nodes) within a second: three rebuilds for three saves. With "New sheet…" open (the template chooser showing Bible study, Sermon preparation, Class session…) a title keystroke in the other tab replaced the chooser with the plain list, and `document.activeElement` was `<body>`. With focus on a row's "Duplicate" button, the button was removed and focus went to the same row's title link (`data-focus-key="open-<id>"`): not the button the user was on, and an earlier tab stop. A keyboard or screen-reader user with the list open in a second window loses their place on every autosave; someone choosing a template is bumped out mid-choice.
**Evidence**: live, tabs `seed` and `tab-1`; `__mut` log: `…:1:childList+1, …:3:childList+3,childList+1,childList+1` per save; `chooserStill:false`, `act: BODY`.
**Fix**: redraw only when the set of sheets, a title or a modified time actually changes (compare a signature before rebuilding), skip the redraw while a chooser is open or focus is inside the list, and restore focus by button key (`duplicate-<id>`) rather than the row link.
**Confidence**: High.

**Fixed (2026-11-09)** With SH8-1.

#### LV8-2 · Medium · data-integrity · NEW
Typing in a tab that shows "Changed in another tab." silently overwrites the other tab's words, and the notice is not announced.
**Where**: `src/scripts/desk/sheets/sheet-pane.js` / `part-cards.js` `showConflict` (documented in `sheets/CLAUDE.md` ~line 80 as accepted: "this tab's typing may already have saved over it").
**What happens**: Two tabs on one sheet (the second asked "This sheet is already open in another tab. Continue here?" and I pressed Continue). I put the caret at the end of the Opening part in tab A, typed " X2" in tab B, then typed " S1" in A. A showed the line "Changed in another tab. | Show that version | Keep mine" but kept my caret and my typing. The saved record afterwards was `…TAB2 S1`: B's " X2" was gone from the store, while B still showed `…TAB2 X2` on screen plus its own notice. Continuing to type is an unannounced "Keep mine". The notice is `role="group"` with no `aria-live`; the page's status regions stayed empty, so a screen-reader user typing in the part hears nothing.
**Evidence**: IndexedDB read after each step; `getAttribute('role')`="group", `aria-live`=null; `status: []`.
**Fix**: make the notice `role="status"` (polite) or announce it through the page's announcer; consider holding the other tab's text out of the next save until the reader picks Keep mine or Show that version (or saving a merge), not overwrite on the first keystroke.
**Confidence**: High on behavior; whether the overwrite is acceptable is an owner call (it is described in the design record).

**No change (2026-11-09)** BVJ's rule (2026-11-08), as the verifier found. SH8-2's fix narrows it: only the field being typed in now keeps this tab's words.

#### LV8-3 · Low · a11y · NEW
Placeholder text in the sheet editor is the browser default gray and misses 4.5:1 in both themes.
**Where**: sheet title and subtitle inputs (`aria-label="Sheet title"`, `"Sheet subtitle"`), minutes boxes, on `/sheets/?view=edit` and the Sheets pane; no `::placeholder` rule in `src/styles/desk.css` or `pages/sheets-page.css`.
**What happens**: computed `::placeholder` color is `rgb(117,117,117)`. Over the page cream `rgb(225,223,217)` (title and subtitle on the page) that is 3.46:1; in dark mode over `rgb(14,14,15)` it is 4.19:1; the "–" in the minutes box is 4.41:1 on the card. WCAG 1.4.3 applies to placeholder text. The ghost prompts (`.desk-rich::after`, alpha .62) are fine: about 6:1 in dark (checked) and a dark-on-cream equivalent in light.
**Evidence**: JS computed style and a contrast function, light and dark emulation.
**Fix**: set `::placeholder { color: var(--...) }` using the ghost prompt's token with both dark selectors.
**Confidence**: High.

**Fixed (2026-11-09)** With XA8-13.

#### LV8-4 · Low · ui · NEW
The /desk title menu runs 38px past the right edge at 1000px, clipping its text and adding a horizontal page scrollbar.
**Where**: `.desk-ws__menu.desk-title__menu` (`title-menu.js`, `desk.css`).
**What happens**: At a 1000px window with the page scrollbar (clientWidth 985), the open menu's right edge is at 1023 and the "Add pane", "Layout…" and other items are cut off at the window edge; `scrollWidth` 1022 gives a horizontal scrollbar while it is open.
**Evidence**: rect scan of `body *` against `clientWidth`; screenshot showed items clipped at the right.
**Fix**: right-align the menu to its button or clamp its left to `innerWidth - width - gutter`.
**Confidence**: Medium (seen only at this window size).

**Fixed (2026-11-10)** Measured in Chromium at 1000px: the title sat at the right edge, not centered, because the 1100px header fold and the desk's own 760–1100px header rule replaced the desk header's three-column grid (`global.css`), and the menu, centered under the title, ran 23px past the window. The desk header's rule now outranks both, so the title is centered at every width, as its comment says, and the menu fits (checked at 700, 900, 1000, 1100, 1280 and 1400px, and in Atkinson and OpenDyslexic).

#### LV8-5 · Low · ui · NEW
In a narrow Sheets pane (306px) the "My sheets" rows are wider than the pane and the pane scrolls sideways.
**Where**: `li.desk-sheet__sheet` with the Duplicate / Save as template / Delete buttons (`my-sheets.js`, `desk.css`).
**What happens**: at three panes in a 1000px window the rows measure 336px in a 289px scroller (`desk-sheet` scrollWidth 352 vs clientWidth 289), so a horizontal scrollbar appears and the right-hand buttons sit past the edge.
**Evidence**: rect and scrollWidth reads; screenshot showed a horizontal scrollbar.
**Fix**: let the button row wrap (`flex-wrap`).
**Confidence**: Medium.

**Fixed (2026-11-09)** Under 24rem the row's buttons wrap under its name (a container query).

#### LV8-6 · Low · ui · NEW
The Notebook tour leaves a Greek word open.
**Where**: the notebook tour's Greek step (`desk/tour.js`, rule 13 says a tour "ends by undoing all of it").
**What happens**: before the tour the Greek tab read "Select a word to see its dictionary entry." After finishing it, the tab showed Ἦν highlighted with its entry (parsing, "εἰμί · to be", UBS/STEPBible tabs) open.
**Evidence**: screenshots before and after (first-tour replay); no other state was changed by me in between.
**Fix**: close the word entry in the tour's `later`/restore for the Greek step.
**Confidence**: Medium (I did not retry on a clean profile).

**Fixed (2026-11-09)** The Greek step registers a closer that shuts the Greek tab.

#### LV8-7 · Low · performance · NEW
A shared sheet on a phone downloads the desk's store and boot code with the viewer, about 380 KB raw in 18 modules.
**Where**: `src/scripts/desk/sheets/sheet-page.js` static imports (`../boot.js`, `../store.js`, `desk-sheet-doc`, `diff-view`) pulling `desk.*.js` (158 KB), `boot` (30 KB), `store` (22 KB), `notebook-tab`, `lit-panel`, `ref-preview`, `desk-frame`.
**What happens**: at 375x812 the page opens as the "Shared with you" viewer (read, switch version, Present, Print, Share all work; `data-desk` is not stamped, no desk UI appears) but `read_network_requests` and `modulepreload` links list those chunks. The brief's wording, "nothing else of the desk loads", is not literally true. I could not tell whether `store.js` opens the database on that page.
**Fix**: if a viewer-only phone bundle is wanted, split what the viewer needs (copy, present, save) from `boot.js` and `store.js`, or import them dynamically on the computer branch.
**Confidence**: Medium.

#### LV8-8 · Low · ui · NEW
The print check's diff can show more "Added" text than "Removed".
**Where**: `sheets-page__check`, `desk/diff-view.js`.
**What happens**: I changed one word of a stored passage's `verseCopy` ("loved" to "adored"). The check read "Removed: adored | Added: loved the whole world: God gave the …": the added side carries a long trailing run that did not change.
**Evidence**: page text after reload; the setup was a direct IndexedDB edit, so the stored copy was artificial.
**Fix**: trim unchanged context from both sides, or label the extra words as context.
**Confidence**: Low (needs a real wording revision to confirm).

**No change (2026-11-09)** Not a bug: the diff is right for a real revision; the case seen came from a hand-edited stored copy.

#### LV8-9 · Nit · usability · NEW
"Save as template" on the sheets list acts at once with no confirmation, moves focus to the sheet's own link, and the template reports "12 parts" for a 13-part sheet.
**Where**: `sheet-page-list.js`. The status line ("Saved LV8 Thursday group as a template. New sheet now offers it.") is announced, and Delete has Ctrl+Z, so this is only a note. The 12 vs 13 difference may be a part a template drops (a page break, or the passage); I did not confirm which.
**Confidence**: Low.

**No change (2026-11-09)** Not a miscount: a template drops passages, so a 13-part sheet with one passage makes 12 parts.

### Confirmed or refuted

- **"The /sheets list rebuilds on every autosave elsewhere": CONFIRMED** (LV8-1). One rebuild per save, each within a second.
- **"It jumps, loses focus, or closes an open chooser": CONFIRMED for the last two.** The open template chooser was replaced by the list and focus fell to `<body>`; focus on a row button moved to the row's link. The list did not visibly jump in position in the cases I measured (scroll was at the top; I did not test a scrolled list).
- **"Nothing else of the desk loads on a phone" (brief's phrase for #511): PARTLY REFUTED** (LV8-7): the desk UI does not load or stamp, but the viewer's own closure includes the store, boot and desk chunks.
- **Two tabs on one sheet**: the open question works ("This sheet is already open in another tab. Continue here?"); a line changed elsewhere shows live in the other tab when the caret is not in that part, and shows "Changed in another tab. | Show that version | Keep mine" when it is (LV8-2).

### Improvements

- Tab order: the gap's "+ Add" is `tabindex=-1`; the page says up and down arrows reach it, and Tab goes editor, toolbar, next part's header, which is consistent. A visible hint at the first part would make the arrow route discoverable.
- After "Take the tour now" on /desk, the Sheets tour offer appears on switching a pane to Sheets and can sit over the LIT pane's passage field; it took my first click and typing there. A short delay or placement away from the passage bar would help.
- `lit-desk-page-tour` and `lit-desk-tour` keep a `later:<date>` marker even after the tour is finished (the offer writes it when shown); harmless, but a maintainer reading the key may think the tour was deferred.
- Present's title screen shows "Scan to follow along" with a QR code even on the phone that opened the shared link.
- Presenter-view prev/next buttons on a phone are 26x40 px (just over the 24px minimum).

### Questions for the owner

1. Is silently overwriting the other tab's words once the reader types (LV8-2) the intended "Keep mine"?
2. Should a template drop some of a sheet's parts (12 vs 13)? What is the rule?
3. Should the phone share viewer be its own small bundle (LV8-7)?

### What held up

- Notebook: add note (saved, appears in margin and My Notes), Add bookmark, highlight (blue, whole verse), pin footnote c (appears under Pinned footnotes), label created and applied by Enter, delete is immediate with "Press Ctrl+Z to undo", Ctrl+Z restored it, delete then trash page Restore (undoable, status announced), Delete label from the page. No console errors across the session.
- All three tours ran to their end (10, 9 and 8 steps); /desk's layout came back after its tour; every pane kind (This verse, Footnotes, Book Intro, Greek, LIT, Sheets, Search) drew and switched without errors; layout survived reload.
- Sheets: Bible study template; text, question, space, page break and passage (typed `John 3:16-18`) added; key-term blank ("trust" blanked 4 times); minutes (5); Leader only; "Planned time" line; leader and participant versions (participant hides "Leader only"); print check appears when a passage's wording changed; Present with real keys (Right moves screens, `r` reveals); share dialog (Everything / participant's version), Copy link (1,425 chars), opening it shows "Shared with you", import copies it; Duplicate and Delete with undo; two-tab handshake.
- Focus rings: 1.6px solid `rgb(15,107,51)` at 1.6px offset on title, subtitle, minutes, checkboxes, editor and toolbar buttons (real Tab); dark mode on the Notebook panel, /desk and the editor looks consistent.
- Greek: /search `λόγος` (330 occurrences), builder choice "genitive" writes `λόγος.gen` into the field and announces "Search is now λόγος.gen."; the tray searches `πίστις` (243 matches, "My notes" checkbox); the commands window opens with the builder.
- Phone (375x812): shared link reads, Present opens, version radios work, no desk stamp or desk UI.

### Not reached

- Forced colors (not emulable here); print dialogs, file saves (.docx, .odt, .pptx, PDF), Copy to clipboard into Word.
- Presenter view window (opens same-tab here) and the clock/notes inside it.
- Scrolling a LIT pane and reload to confirm the place is kept: the scroll event needs RAF, which does not fire while the app window is behind another; saved `at` stayed `john 3`. Unverified.
- Resizing panes by drag, four-pane layouts, keyboard shortcuts on /desk (H, /), Hide my marks, the commands window "Notebook actions", `/desk/help/`, backup export/import, margin note change notices, "From my notes…", passages from the LIT pane's verse menu, "Show in Notebook", a 5,000-note notebook.
- A true cold first-use (see the origin note), and a second tab on the Sheets pane in /desk.
- The hover-only controls (the gap's Add pill) were driven with `.click()` in JS because hover does not match here; the menu lists Passage…, Your text, Question, Space to write, Page break and Key terms box (disabled when already on the sheet).

### Log

1. Started `audit8-dist` (port 4598), set 1000x700, loaded `/john-3/`; read localStorage, IndexedDB (4 old records), found the origin not fresh.
2. Removed the three tour/command flags; reloaded; took the Notebook tour (10 steps) from the offer.
3. Added a note on John 3:16 (verse menu, Save), a bookmark on 3:17, a blue highlight on 3:18, pinned footnote c, made label "LV8 label" and applied it to the 3:1 bookmark; deleted the note, Ctrl+Z, deleted again, restored from `/notebook/#trash`.
4. `/desk/`: took the Study Desk tour (9 steps); cycled pane kind menu through every kind; Sheets tour offered and taken (8 steps); opened title menu (clipped, LV8-4); New sheet… chooser; made a Bible study sheet in the pane.
5. `/sheets/?id=…&view=edit` at 800x560: typed title, Opening text, minutes, blanks, parts via the gap menu, a typed passage; Tab order and focus rings.
6. Tab 1: `/sheets/` list; Save as template, Delete + Ctrl+Z, open chooser while saving elsewhere (LV8-1). Tab 2: same sheet edit, the "already open" prompt, same-part edits (LV8-2). Closed both extra tabs.
7. Sheet view page: Print (print stubbed), print check after a one-word edit to `verseCopy`, Present with real keys, Share dialog, Copy link, opened it (shared view), Import.
8. Mobile preset: shared link, read, version switch, Present, network list (LV8-7).
9. Dark and light measurements (placeholders, ghosts, outlines); dark /desk screenshot.
10. Greek: `/search` λόγος, commands window and builder, tray search πίστις.
11. Cleanup: deleted both LV8 sheets and my template from the Sheets list, the LV8 note, bookmark, highlight and pin from /notebook (all in the trash), and the label. Pre-existing records left alone ("Untitled sheet", "Untitled sheet (copy)" whose modified time moved when a delete was undone, the 3:1 bookmark, the "Audit test note on footnote a"). Viewport and color scheme reset to desktop and light. Server left running on port 4598.

## Appendix O: Adversarial verification (`VER8`, Opus)

Verifier: VER8 (Claude Opus 5.5). Checkout `.claude/worktrees/desk-audit-8` at `15986b6e`, read-only. 2026-11-09.
Ran (scripts in `...\scratchpad\audit8\ver8\` and the auditors' own folders): DI8's `stamps.mjs`, `trash-bookmark.mjs`, `store-race.mjs` (fake-indexeddb, real `store.js`); GF8c's `refusal2.mjs`; `ver8/span.mjs` (`validateRecord` and `noteCounts` on `endVerse` 2,000,000; `containsPhrase` on possessives); `ver8/contrast.mjs` (ink alphas and #757575 placeholder on cream, raised and dark); the two Markdown-import regexes timed in node; a static-import walk of `dist/_astro/sheet-page.*.js` with raw and gzip sizes. Read every cited function. Grepped `src/scripts/desk/CLAUDE.md`, `sheets/CLAUDE.md`, `styles/CLAUDE.md`, `STUDY-DESK-FORMAT.md`, `STUDY-DESK-FIXES.md` and Audits 1 to 7 for decisions.

### Summary

| ID | Auditor | Verdict | After verification |
|---|---|---|---|
| DI8-1 | Medium | CONFIRMED | Medium |
| DI8-2 | Medium | CONFIRMED, severity changed | Low |
| DI8-3 | Medium | CONFIRMED in part, severity changed | Low |
| DI8-4 | Low | CONFIRMED | Low |
| DI8-5 | Low | CONFIRMED | Low |
| DK8-1 | Medium | CONFIRMED | Medium |
| DK8-2 | Medium | CONFIRMED | Medium |
| DK8-5 | Low | CONFIRMED | Low |
| GF8a-1 | Medium | CONFIRMED | Medium |
| GF8a-2 | Medium | CONFIRMED, severity changed | Low |
| GF8a-3 | Medium | CONFIRMED, severity changed (not a duplicate of GK8) | Low |
| GF8b-1 | Medium | CONFIRMED (code) | Medium |
| GF8b-3 | Medium | Plausible, not verifiable without a screen reader | Low (pending an NVDA/JAWS pass) |
| GF8b-4 | Low | CONFIRMED | Low |
| GF8c-1 | Medium | CONFIRMED, severity changed | Low |
| GF8c-2 | Medium | CONFIRMED | Medium |
| GF8c-3 | Low | CONFIRMED | Low |
| GF8c-4 | Low | CONFIRMED | Low |
| GK8-1 | Medium | CONFIRMED (not re-run; data claims trusted) | Medium |
| LG8-1 | Medium | CONFIRMED, severity changed | Low |
| LG8-2 | Medium | CONFIRMED (code), cost untimed | Low |
| LG8-3 | Low | DUPLICATE of NB8-1 + NB8-3 | — |
| LG8-4 | Low | CONFIRMED, not a duplicate of GF8c-4 | Low |
| LG8-5 | Low | CONFIRMED (mutation output not re-run) | Low |
| LG8-8 | Medium | CONFIRMED, KNOWN-OPEN LG-13 (rated Low there) | Low |
| MH8-2 | Low | CONFIRMED, severity changed | Nit |
| MH8-3 | Low | CONFIRMED, severity changed | Nit |
| NB8-1 | Medium | CONFIRMED, severity changed | Low |
| NB8-2 | Medium | CONFIRMED, severity changed; partial overlap with DI8-5 | Low |
| SEC8-1 | Low | CONFIRMED (re-timed) | Low |
| SEC8-2 | Low | CONFIRMED | Low |
| SEC8-3 | Low | CONFIRMED | Low |
| SH8-1 | Medium | CONFIRMED (and live, LV8-1) | Medium |
| SH8-2 | Medium | CONFIRMED | Medium |
| XA8-1 | Medium | CONFIRMED; Audit 2's line is not a decision | Medium |
| XA8-2 | Medium | CONFIRMED (ratios reproduced) | Medium |
| XA8-3 | Medium | CONFIRMED, severity changed | Low |
| XA8-4 | Medium | CONFIRMED | Medium |
| XA8-5 | Medium | CONFIRMED, severity changed | Low |
| XA8-6 | Medium | CONFIRMED, severity changed | Low |
| XA8-7 | Medium | CONFIRMED (by selector scan; not rendered) | Medium |
| CP8 "becomes" (add-forms.js:79, help.astro:137) | High | Grammatical gapping, not an error | Nit (readability only) |
| CP8 8-2 help "This selection…" | High | CONFIRMED | Nit |
| CP8 8-1 my-sheets.js:131 "New sheet" | High | CONFIRMED | Nit |
| LV8-1 | Medium | DUPLICATE of SH8-1 (live confirmation) | — |
| LV8-2 | Medium | DELIBERATE (overwrite); "not announced" NOT REPRODUCED | — |
| LV8-3 | Low | DUPLICATE of XA8-13 (live confirmation) | Low |
| LV8-4 | Low | Plausible from CSS; not re-measured | Low |
| LV8-7 | Low | Bytes CONFIRMED; DELIBERATE per design | Improvement |

**Duplicates**: LV8-1 = SH8-1 (SH8-1 carries). LV8-3 = XA8-13 (XA8-13 carries; LV8 supplies the measurement). LG8-3 = NB8-1 (sheet autosaves) + NB8-3 (follower writes). SEC8-2 = GF8a's note at `GF8a.md:174` (SEC8-2 carries). NB8-2 and DI8-5 overlap only in one trigger: DI8-5 carries the closed connection, NB8-2 the silent catch blocks. NB8-2 and GF8a-2 are siblings (the same class, different files); fix them together. **Not duplicates**: SH8-2 / DI8-4 / LV8-2 (three mechanisms: Keep mine over an untouched field; pagehide's stale whole-sheet write; ordinary typing over the same field, which is deliberate). GF8a-3 / GK8 (GK8 found the Greek paths do report failure; GF8a-3 is the English verse index). LG8-4 / GF8c-4 (speed versus a missed possessive in the same `findLeaks`; one change to `wantOf`/`hasRun` can serve both).
**Inflated**: DI8-2, DI8-3, GF8a-2, GF8a-3, GF8c-1, LG8-1, LG8-2, LG8-8, NB8-1, NB8-2, XA8-3, XA8-5, XA8-6, and CP8's three "High" items (Nit). MH8-2 and MH8-3 are Nits. **Deflated**: none.

### Verdicts

**DI8-1 · CONFIRMED · Medium.** `laterThan` (`desk-records.mjs:230`) has no upper bound. Its comment says the step is one rule for every stamp (DI3-1), and the merge never clamps local records (`desk-merge.mjs` header, rule a). `stamps.mjs` section A reproduces it: after the clock is fixed, A's edits, A's deletion and A's undo are all stamped 2030 + n ms, and none crosses in either direction. Audit 6's verifier accepted, as "the deliberate price of BA4, BA12 and DI-8", that a clock which *stays* fast delays its own edits. This finding is different: after the clock is corrected, every later stamp still steps from the bad one until that date arrives. It is latent today (only backups move between devices), but it is a format rule BDR would copy, and a phone set ahead (people do this for games) is common. Medium stands as a format item to settle before the apps build sync. The fix as given is sound. Add a test that an edit over a far-future local record, merged against the other side's clamped copy, then wins.

**DI8-2 · CONFIRMED · Low.** `restoreFromTrash` returns `trash.record` unchanged when `!canEdit` (`desk-records.mjs:292`). `stamps.mjs` B shows that an older backup opened after the restore deletes the record again. The behavior is documented ("comes back exactly as it was", format :302; FIXES :620). But FIXES :620-623 also claims "the restored record outranks the deletion by rule b", which is false for exactly these records, so the format and FIXES contradict each other. The trigger needs a record of a kind or schema the website can't edit (only an app writes those), then a restore, then an older copy meeting it. Low. Fix as given (restamp `modified` and `client` only), plus correcting the FIXES sentence.

**DI8-3 · CONFIRMED in part · Low.** The divergence (`X<-Y` versus `Y<-X`) in `trash-bookmark.mjs` comes from two trash records forced to share an id and a `deletedAt`, and then `pickAcross` with no tiebreak keeps the local copy (`desk-merge.mjs:237-240`). That is rule a's documented tie behavior ("a tie, `tiebreak`, else local"; a sync service passes its revision), not a trash defect. `collapseTrash` itself picks its survivor by a total order, so it converges. The real residual: when rule b keeps a deletion and the live copy's `modified` *equals* the held copy's (which happens after a group merge), the held copy isn't replaced, so the rename is lost from the trash. That case converges and only loses words on a later restore, and only under sync. Low. Fix: rule b alone, `mergeBookmark` on a `modified` tie.

**DI8-4 · CONFIRMED · Low.** `onPagehide` (`sheet-editor.js:979-997`) plans over the pane's own `sheet` and `writeNow`s the whole record. `store-race.mjs` step 2 loses B's `two 99`. The window is under a second at tab close. BA72's design accepts writing without a read, but never weighed the other tab. Low. Of the auditor's fixes, prefer documenting the race; refreshing `sheet` before the save lands narrows the window but doesn't close it. Distinct from SH8-2 and LV8-2.

**DI8-5 · CONFIRMED · Low.** `store.js:148` closes the connection, and nothing re-opens it or tells the reader. `store-race.mjs` step 4: `all`, `save` and `writeNow` throw `InvalidStateError`. `DB_VERSION` is 1 (`store.js:57`) and has never been raised, so it is latent until the first schema bump. Low. This ID carries the `versionchange` cause also named in NB8-2 and GF8a-2.

**DK8-1 · CONFIRMED · Medium.** `drawLabels` (`notebook-page.js:228`) returns early while focus is on an `input` in the list. The submit and Escape paths call `back()` → `render()` with focus still in the rename input, so the form stays. The guard is the whole mechanism, and the code has been there since 1d (`247ae0e9`); no audit names it. The same failure probably hits a mouse Cancel in Safari, where a clicked button doesn't take focus (Low confidence). The fix is right: blur first, or track a `renaming` id.

**DK8-2 · CONFIRMED · Medium.** `footnotes-view.js:86-93` clones the body and sets no target or click route. No `a.sref` handling exists in desk code outside `intro-pane.js:206`. E34 and E53 (`desk/CLAUDE.md:1196-1198, 1465-1476`) set the pattern: an `sref` moves the LIT pane, and every other link opens a new tab. Footnote bodies were never decided. Medium. Route a plain click through `env.showPassage`, as the Book Intro pane does; the owner's call.

**DK8-5 · CONFIRMED · Low.** `lit-pane.js` `fill()` sets `loadingDown = false` before `if (n !== seq) return`, and `goTo` resets the flags and bumps `seq`. Read, and it matches the auditor's model. The fix is right.

**GF8a-1 · CONFIRMED · Medium.** `search-pane.js:1175` uses a bare `ARTICLE_EXAMPLE` (label at :1170 uses `gk.`). The only way forward from "ὁ" throws. It is a broken control in a plausible search, behind the Greek preview. Medium stands. Adding a `tsc --checkJs` undefined-name check to CI is worth taking.

**GF8a-2 · CONFIRMED · Low.** `writeOver` and its five callers (`notebook-page.js:212-420`) have no `catch`, and the confirm button stays `disabled` (:368). The triggers (quota, an aborted transaction, `versionchange`) are rare, and nothing is lost: the reader sees nothing happen, not a false success. The "Empty the trash now" case deserves its sentence. Low, a sibling of NB8-2.

**GF8a-3 · CONFIRMED · Low.** `loadVerseIndex` resolves `null` on failure (`search-core.js:651-655`), and the pane treats that as no hits (`search-pane.js:547-554`). The same shape is in the site tray and /search, so it is mostly a site-wide pattern, and it needs a failed fetch of a static file on a page that already loaded. Low. Not a duplicate of GK8: GK8's "What held up" (`GK8.md:124`) found that a failed Greek shard reports failure, which is exactly the behavior this asks for on the English side.

**GF8b-1 · CONFIRMED (code) · Medium.** `createLicenseCard`'s `render` keys on the whole `modules` JSON (`sheet-lit.js:1086`) and `replaceChildren` inside an `aria-live="polite"` div (:1069-1070, :1093). Any text edit re-announces the whole check. Only a leader with the box ticked hears it, and it is not heard in a screen reader. Medium. Fix: key on the counts, not the modules.

**GF8b-3 · Plausible, unverified · Low.** `armWordCursor` (`sheet-lit.js:525-530`) is a focusable `role="group"` that promises arrow keys. NVDA in browse mode doesn't switch to focus mode for a group, so the claim is likely. But other routes exist: the key-term chips (buttons) and "Blank the selected words" (:576) over a DOM selection. It needs one NVDA pass before it is rated higher.

**GF8b-4 · CONFIRMED · Low.** `note-editor.js` `onClose` calls `clearDraft()` unconditionally, while `draftKey` is null for the example editor (:276, :318-322). The fix (`if (draftKey) clearDraft()`) is right. The same unconditional clear also discards a pending draft when *any* editor on another place closes; that broader case is the one-draft design, but the example editor has no claim to it.

**GF8c-1 · CONFIRMED · Low.** `ver8/span.mjs`: `validateRecord` accepts `endVerse: 2000000` (`[]`), and `noteCounts` builds 1,999,985 entries in 234 ms, so the auditor's 2 s at 1e7 is consistent. Reaching it needs a hand-edited Markdown copy, a crafted backup, or an app bug, and it heals by deleting the record. Low for the website. Still, bound it in `validateRecord` and the format before BDR ships, since the apps validate by the same rules.

**GF8c-2 · CONFIRMED · Medium.** Re-ran `refusal2.mjs`: "Jude 3-5" gives "…such as Jude 3:3–12", and so do Philemon, 2 John and 3 John. Following the advice fails again. "Philemon 4-7" is the ordinary citation, so this is real friction. Fixing it in `parseReference` touches the site's search box too; the owner should know that.

**GF8c-3 · CONFIRMED · Low.** `sheet-word.js:20` `INLINE` lacks `b` and `i`, and other elements flatten into the run (:78). Fix as given.

**GF8c-4 · CONFIRMED · Low.** `containsPhrase("Who is God?", "God’s")` returns false, and `containsPhrase("God’s love", "God")` returns true (`ver8/span.mjs`). Fix as given. Do it in the same change as LG8-4's prefilter.

**GK8-1 · CONFIRMED (not re-run) · Medium.** It is the build's lemma-level `also` tally (`greek-core.mjs:907`). The data claims were taken from `also.mjs`, not re-run.

**LG8-1 · CONFIRMED · Low.** No test runs `desk-gate.js` with a stub document. The three tests that import it test `loadShell` or the pause flag. The mutation survivors are plausible from the code; they were not re-run. This is a test gap, not a defect, and the gate file is small and rarely touched. Low, but cheap and worth doing given the root rule.

**LG8-2 · CONFIRMED (code) · Low.** There is no row limit, and `onDeskChapters` redraws. The DOM cost is untimed, and 5,000 notes on a one-user preview is the far edge. Low until timed. The `onDeskChapters` skip is the cheapest win.

**LG8-3 · DUPLICATE of NB8-1 and NB8-3.** `panel.js:642` subscribes with no filter. NB8-1 covers the sheet-autosave part and NB8-3 the follower's 2-second writes.

**LG8-4 · CONFIRMED · Low.** It is the auditor's measured curve, consistent with `findLeaks` reading. Not a duplicate of GF8c-4.

**LG8-5 · CONFIRMED · Low.** The four survivors are plausible from the code (for example `anchor-core.mjs`'s `score > bestScore` and the format's "on a tie, the first"). The vector for the tie is the valuable one, since the apps read the fixture.

**LG8-8 · CONFIRMED · Low.** It is KNOWN-OPEN LG-13 (`STUDY-DESK-AUDIT-2.md:2174`, rated Low; measured at :371). Audit 3 left it "partly open by design (one extraction per sitting)". There is no defect, so Medium is inflated.

**MH8-2 · CONFIRMED · Nit.** `greek-commands-ui.mjs:12` imports `SIGNS` and `W` from `desk-greek.mjs`, a pure `src/lib` module. The root rule and `desk-gate-imports.test.js` concern the desk's client modules. Shared code importing pure `desk-*.mjs` is established elsewhere (`Layout.astro:11` imports `desk-margin.mjs`). That costs 3 KB and some layering tidiness.

**MH8-3 · CONFIRMED · Nit.** `CLAUDE.md` is 40,683 bytes against `ROOT_LIMIT` 40,960 (`test/claude-docs.test.js:18`). It is a heads-up, not a defect.

**NB8-1 · CONFIRMED · Low.** The six reading-page views subscribe `{ except: QUIET_KINDS }`, which hears `sheet`. A minimized Notebook is not `panel.hidden` (it is collapsed by CSS only; `panel.js:118, 342-373`), so `render()` runs. The margin, highlights and labels re-read per chapter; the costly part is the panel's `store.all()`. It needs two tabs with one typing a sheet, and the cost is unmeasured. Low. This ID carries LG8-3's sheet half.

**NB8-2 · CONFIRMED · Low.** `guarded` (`actions.js:142-154`), `highlight()`'s catch and the pin click (`pins.js:182-185`) only `console.error`. The failure is visible as "nothing happened", and nothing is lost. Low. Its `versionchange` trigger is DI8-5's.

**SEC8-1 · CONFIRMED · Low.** Re-timed: the heading regex takes 2,141 ms at 80,000 spaces, and the repeated opener 1,220 ms at 20,000 openers. It needs a crafted file the reader chooses to open, and nothing is written.

**SEC8-2 · CONFIRMED · Low.** `openEntry` imports the parsed `/glossary/` article without `makeInert` (`search-pane.js:914-925`). That breaks `desk/CLAUDE.md:1276-1278` ("a new fetch of a site page goes through it before anything is imported"). There is no exploit today (it is the owner's built content).

**SEC8-3 · CONFIRMED · Low.** `/notebook/?q=` is a GET with the words in it. It matches the site's `/search?q=`. The fragment fix is cheap.

**SH8-1 · CONFIRMED · Medium.** `showList` empties `root` before two awaits (`sheet-page.js:263-281`). Its subscription (:348-357) refocuses only `data-focus-key` elements. Live-confirmed by LV8-1 (the chooser closed, focus went to `<body>`). E64 intended the redraw, not these side effects. Medium.

**SH8-2 · CONFIRMED · Medium.** Keep mine writes every field via `take()` (`sheet-editor.js:944-948`). The design record (`sheets/CLAUDE.md:83-84`) says just that, but doesn't weigh an untouched field that the other tab changed. Worse, and not dependent on pressing anything: in `draw`'s `hasFocus` branch (:847-851), `card.json = now` is set while the editors keep their old text. After focus leaves, no later draw sees a difference, so the stale field stays on screen, and a later edit to it in this tab overwrites the other tab's words. Medium: a supported S12 feature and a silent route to lost words.

**XA8-1 · CONFIRMED · Medium.** `STUDY-DESK-AUDIT-2.md:1388-1390` ("Dragging: … arrow-key steps … so 2.5.7 has an alternative") is an auditor's "what held up" line, not an owner decision. It is also contradicted by the same audit's DK-8 (:1523), which says a keyboard alternative doesn't meet 2.5.7. No FIXES entry or design rule makes it deliberate. Medium. Moving a floating window is arguably not "functionality"; the widths are.

**XA8-2 · CONFIRMED · Medium.** `desk.css:6335` has 0.22 ink, and `--surface-input` equals `--surface-raised` (`global.css:150-151`). `ver8/contrast.mjs`: 1.57:1 raised, 1.53:1 cream, against BA144's `--field-border` (`styles/CLAUDE.md:334-343`). The title and subtitle borders are transparent until hover.

**XA8-3 · CONFIRMED · Low.** Reproduced: 0.6 is 4.23:1 raised, and 0.65 is 4.46:1 on cream. These are small secondary lines just under 4.5:1 (by 0.04 in three of the four cases). It is a real AA miss, but a near one. Low. Raise to 0.7, as given.

**XA8-4 · CONFIRMED · Medium.** `bookmark-stop.js:43-44` and `my-sheets.js:195-196`: neither name contains its visible words (2.5.3, Level A). The fix is right.

**XA8-5 · CONFIRMED · Low.** `menuButton` sets `aria-label` once (`sheet-text.js:793`), while `refresh` changes the visible text (:1094). It is one button, and its tooltip shows "Paragraph style". The current style is on the menu's checked radio. Low.

**XA8-6 · CONFIRMED · Low.** `sheet-present.js:489-490, 872-873` flip the text and set `aria-pressed`. The result is confusing ("Show screen, pressed") but works. The GK3-8 precedent says fix it the same way. Low.

**XA8-7 · CONFIRMED (by scan) · Medium.** No `@media (forced-colors: active)` block names a `.desk-sheet__*` selector (`desk.css` blocks at 1260 … 6689, `sheets-page.css:1492` covers only `.present-btn`). `.desk-sheet__drop` is a background-only line (:7058-7062). It needs Chrome's forced-colors emulation to settle the details.

**CP8, the three "High" items · Nit each.** (1) "a note or a pinned footnote Your text, and a highlight a passage" is verb gapping, grammatical English. "Becomes" twice would read more easily: Nit, and not the orchestrator's "ellipsis" error either. (2) `help.astro:300` quotes "This selection…", while the item is "This selection" (`desk-print-part.mjs:22`) and prints at once: Nit. (3) `my-sheets.js:131` "New sheet" opens the chooser, while the other three entry points say "New sheet…": Nit. None is a failure, so "High" was a category error.

**LV8-1 · DUPLICATE of SH8-1.** It is the live confirmation; SH8-1 carries.

**LV8-2 · DELIBERATE / NOT REPRODUCED.** Typing in a part whose text another tab changed keeps this tab's words, and its save wins. That is the S12 design (`sheets/CLAUDE.md:78-84`, BVJ 2026-11-08): "A part the reader is typing in is never redrawn", and "Show that version" "writes it again, since this tab's typing may already have saved over it". The "not announced" part is not reproduced in code: `showConflict` ends with `say(...)` (`sheet-editor.js:956`) into the editor's `aria-live="polite"` paragraph (:192-200). LV8 looked at `role=status` regions, and `say` defers by `requestAnimationFrame`, which a hidden Browser pane doesn't run. It should be heard in a visible tab. No ID needs to carry it. If the owner wants the overwrite reconsidered, it is a question, not a defect. SH8-2 carries the editor-conflict defect and DI8-4 the close race.

**LV8-3 · DUPLICATE of XA8-13 · Low.** XA8-13 is the placeholder item (`XA8.md:136-142`, Low confidence). LV8's computed `rgb(117,117,117)` and my ratios confirm it: 3.46:1 on cream (the /sheets title and subtitle, transparent until hover), 4.19:1 on #0E0E0F, and 3.65:1 on #1d1d1f. That lifts XA8-13 to High confidence, still Low.

**LV8-4 · Low, plausible.** `.desk-title .desk-ws__menu` is centered under the title with `translateX(-50%)` (`desk.css:4832-4837`). The 270px title menu plus its flyout can pass the right edge when the title sits right of center. Not re-measured.

**LV8-7 · Both auditors are right · Improvement.** `sheet-page.js`'s static closure in `dist/_astro` is 18 files: 391,782 bytes raw and about 118.6 KB gzip at level 9. LV8's "about 380 KB" is raw; SEC8's "about 113 KB" is compressed (it depends on the gzip or brotli level). The modules (`desk.*`, `boot`, `store`, `notebook-tab`, `lit-panel`, `ref-preview`, `desk-frame`) are allowed. `sheets/CLAUDE.md:533-542` and `sheet-share-gate.js` make the dynamic import of `sheet-page.js` "the one way desk code reaches a phone", and what it statically imports comes with it. `showSharedOnPhone` doesn't call `openStore`, and SEC8 found no top-level side effects. The brief's "nothing else of the desk loads" overstates the design. A phone-only viewer entry would save about 100 KB compressed.

### Missed by the auditors

- **The card's header goes stale under a focused card** (`sheet-editor.js:841-851`). The `hasFocus` branch never compares `headKey(m)`, the minutes, Leader only, or the type. When another tab changes the minutes or Leader only while the reader types in that part, the header keeps the old value and `card.json` is updated, so it stays stale until the next change. Low. It belongs with SH8-2's fix: redraw the header, or compare per field.
- **FIXES contradicts the format** on restoring an uneditable record (`STUDY-DESK-FIXES.md:620-623`, "the restored record outranks the deletion by rule b"). Fix it alongside DI8-2.
- GF8a noted, under What held up (`GF8a.md:174`), that `decodeURIComponent` at `search-pane.js:921` throws on a malformed `#%` link in a glossary entry. It is harmless with today's content. Fold it into SEC8-2's change.

### Not reached

- Re-running LG8's mutation harness (LG8-1, LG8-5), DI8's 3,000-history fuzz count for DI8-3, GK8's `also.mjs`, or GF8c's timing scripts beyond the 2,000,000 probe.
- Anything needing a browser or a screen reader: DK8-1 in Safari, GF8b-1 and GF8b-3 heard, XA8-7 in forced-colors emulation, LV8-4's overflow, LG8-2's DOM timing.
- LV8-5, LV8-6, LV8-8 and LV8-9 (not asked beyond a glance), and the remaining Lows and Nits of every report not named in the brief.

## Appendix P: Phase 2: Audits 1 and 2 re-checked (`PC8A`, Sonnet)

**Scope**: `STUDY-DESK-AUDIT-1.md` (BA1 to BA153 less the declined BA32; phases FA1-a to FA1-v; the follow-up audit's areas 1 to 6; FA1-v's Windows and real-device results; "Not covered") and `STUDY-DESK-AUDIT-2.md` (SEC, DI, NB, DK, GK, LG, LV, CP, RC; "Status on main", "Priority list", "Decisions", "Work sessions").
**Commit** `15986b6e`, 2026-11-09. Read-only; scripts in `...\audit8\pc8a\`.

**How I checked**
1. Ran `npm run test:desk` (2,498 tests, 0 fail) plus `claude-docs`, `desk-storage-keys`, `desk-hostile-records`, `desk-store` (33 pass). Most fixed pure-logic items have a named test, so a pass means the guard is live.
2. Every High and Medium: found the guard in the code (by function or guard text, not line number) and, where pure, ran a node check (below).
3. Every item recorded open, partly fixed, deferred, decided or put to BDR: read its status and looked for it in `INDEX.md` and the fresh reports.
4. Moved code (sheets split, two-stage load, `start()` split, Read View retirement): searched for the named helper in its new home.
5. Sampling of Lows and Nits: seeded random draw (`random.seed(8)`) of 14 from each audit's fixed Lows and Nits, plus mechanical sweeps for the copy rules (Oxford comma, British spelling, em dashes, retired names).

Node checks run: 48 KB of `<a ` sanitizes in 6 ms (BA67); a hostile pane id returns null from `checkLayout` (BA59); an `img onerror` and a `script` are stripped (BA66); 40,000 spaces and a 200 KB qualifier note link in 1 to 3 ms (BA95, SEC-2); `foldGreek` folds the six compatibility letters (GK-15).

**Counts**: about 265 items in scope (152 BA, 111 Audit 2 findings, 7 RC). 1 miss reported (Low, copy). No regression of a fixed item beyond what the fresh pass already reported. About 23 earlier items overlap fresh findings (below). About 90 items inspected individually in code; the rest rest on named tests passing.

### Misses

#### PC8A-1 · Low · copy · KNOWN-OPEN (Audit 2, "What held up", Copy)
**Where** `src/scripts/desk/sheets/add-forms.js:79`: "Tick what to bring. A question becomes a Question part, a note or a pinned footnote Your text, and a highlight a passage." (the "From my notebook" add form).
**What happens** "Tick" is British; the site's reader-facing rule is American ("Check what to bring"). Audit 2's "What held up" noted "no British spelling except 'tick'" but it never became a finding, so no phase fixed it. CP8 swept about 70 British spelling forms and did not list this idiom. The sibling string in `search-sheet.js:174` already says "checked".
**Evidence** A search of `src` for quoted strings containing tick, ticked or ticking finds only this one reader-visible string (the other hits are variable names).
**Fix** "Check what to bring."
**Confidence** High.

No other still-open item that is real and absent from the fresh pass was found. See "Still open by decision" for items that are open on purpose.

**Fixed (2026-11-09)** "Check what to bring."

### Caught by both (earlier item → Audit 8)

| Earlier | Audit 8 | Note |
|---|---|---|
| BA79 (stage-only focus guard) | SH8-6, XA8-9 | regression in the presenter view |
| BA144 (`--field-border`) | XA8-2 | sheet editor's fields skip the token |
| BA143 (contrast) | XA8-3 | more small text below 4.5:1 |
| BA141 (forced colors) | XA8-7 | BA141 covered the leading pane; the editor's styles have none |
| BA129, BA72 (sheet writes) | DI8-4, SH8-2, LV8-2, DI8-7 | pagehide and "Keep mine" write the tab's whole copy |
| BA128, BA130 | DI8-8 | two tabs opening the same sheet |
| DI-8 (clock clamp) | DI8-1 | a skewed record stays unsyncable |
| DI-3 (trash words diverge) | DI8-3 | residual: stamped bookmark copies |
| DI-10, RC-1 | DI8-2 | restore of an uneditable record |
| LV-1, DK-3, DK-4, NB-16 (focus after redraw) | SH8-1, LV8-1, GF8a-5, GF8a-8, GF8a-9, XA8-10, DK8-4 | the class survives at new sites |
| LV-3, BA144 (placeholder) | LV8-3, XA8-13 | |
| BA136 (noteOpening comma) | GF8c-10 | quote ending in a closing mark or dash |
| BA134 (Oxford comma) | GF8c-8 | verse-label highlight list |
| SEC3-2 (inert imports) | SEC8-2 | Search pane's glossary import lacks `makeInert` |
| SEC-2, BA95 (quadratic regex) | SEC8-1 | same family, in the import reader |
| NB-12 (Audit 1 real-browser list) | NB8-12 | known-open, as listed |
| LG-13 (complexity map) | LG8-8 | known-open |
| DK-15 (parked chapters) | LG8-4 | residual |
| DK-1 (word cursor) | GF8b-3 | follow-up |
| BA127 (passage limits) | GF8c-1 | related: stored `endVerse` far past the chapter |
| BA39 / E12 (trash copy) | DK8-7 | "Delete everything" wording |
| NB-7 (help basics) | DK8-6, DK8-8 | help-page claims that drifted |

### Checked and holding

Verdicts: holds (guard found, test passes), moot (code gone), decided (cited), open-by-nature (needs a device).

| ID | What | How checked | Verdict |
|---|---|---|---|
| BA66 | newer-format sheet drawn through sanitizer | `sheetHtmlForShow` in `part-cards.js:208`, `sheet-copy.js:47`; import sanitizes (`desk-export.mjs:658`); node check | holds |
| BA67 | sanitizer quadratic on unclosed tags | node: 48 KB `<a ` in 6 ms | holds |
| BA59 | stored pane id check | node: hostile id gives null | holds |
| BA1, BA2, BA41, BA9, BA10 | Markdown copy | guards in `desk-export.mjs`; named tests pass | holds |
| BA3, BA4, BA11, BA12 | merge and open a copy | `planOpen`, clamp in `desk-merge.mjs`; vectors pass | holds |
| BA5, BA13, BA6, BA7 | store, editor, undo | `store.js` header, `planEdit`, `history.js`; `desk-store` test runs the real store | holds |
| BA51 | pane scroll kept on redraw | `keepScroll` in `desk-page.js:806-832` | holds |
| BA52, BA53, BA55, BA58, BA60, BA61 | layout and `?place=` | `desk-layout.mjs` (`placeLitPanes`, `originalLayout`); DK8's 12,000-run fuzz | holds |
| BA54, BA56, BA57, BA64, BA65 | LIT pane | `STUB_SETTLE`, `keepParts`, `--desk-lit-below` present | holds |
| BA8, BA14 | anchor floor, format | `build-anchor-vectors.mjs` vectors | holds |
| BA78, BA80, BA81, BA82, BA87 | sharing | `fragmentInFile`, popstate in the sheets inline script; SEC8 re-verified | holds |
| BA16, BA17, BA19, BA20, BA23 | marks | `planBookmark`, `.lit-panel .desk-fnn` rule, `endOffText` | holds |
| BA68 to BA77 | templates, passages, paste | `passageForReference`, `blanksGivenAway`, `pastedSheetHtml`, `caretAt` (now `sheet-text.js:143`), `owningUndo` (`history.js:48`) | holds (moved code survived) |
| BA72 | closing page keeps typing | `pagehide` in `sheet-editor.js:1300` | holds (but DI8-4) |
| BA44, BA45, BA48, BA49, BA50, BA116 | Greek commands | `MAX_TERMS`, `tooMany`, `wholeGloss`; tests | holds; BA49 accepted by BVJ |
| BA33 to BA37 | tour and first use | `remember: false` in `panel.js` and `margin.js`, `editorHolds`, `printLook` | holds |
| BA83, BA84, BA85, BA86 | present mode | `--focus-ring` pin at `sheets-page.css:208`, `hbq-description`; BA85 passed on two screens (BVJ 2026-10-29) | holds |
| BA79 | presenter focus | stage only | regressed on the presenter view: SH8-6 |
| BA18, BA21, BA22 | announcements | `desk-announce.mjs`, `focusGone` | holds |
| BA24, BA27, BA28 | panels beside Notebook | `placeBesideTouchSelection`; touchscreen passed (BVJ) | holds |
| BA25, BA26, BA29, BA30 | gate, first paint | `isAppPlatform`, `standDown` each in 8 files | holds |
| BA31, BA62, BA63, BA114, BA115 | destroy and cleanup | `destroy` in `tab-mine`, `tab-verse`, `tab-greek`; listener pairs | holds |
| BA40, BA46, BA47 | Greek credits, notebook search | `greek-credits.mjs`; tests | holds |
| BA88 to BA98 | What's new, note links | `seenValue`, `byPlace`, `SP_BEHIND`, `metaMessage`; node: 40,000 spaces in 1 ms | holds |
| BA99 to BA108 | ribbons | `followRibbon`, `planRibbonRename`, `RIBBON_FLAG_KEY` gone; successors in `bookmark-follow.js` and `desk-bookmarks.mjs` (`pageLastRead`, `Object.hasOwn(BOOKS, …)`, code-point cut, `dropFlag`) | moot; successors hold |
| BA109 to BA113, BA117 to BA120 | Greek tab | `nearestVerse`, `noteVerseFor`, `longEnoughForGreek`, `forgetsSplit`; tests | holds |
| BA121 to BA126 | /desk panes | `deskChaptersMoved`, `onDeskChapters`, `placeKindMenu`, `goToRecord`; Chrome re-check in FA1-v | holds |
| BA127 to BA133 | sheets in two tabs | `planSheetChange` (5 files), `stillCurrent`, `gatherMessage` | holds; residuals DI8-4, SH8-2 |
| BA134 to BA139 | copy pass | sweeps: no missing Oxford comma, no British spelling, no em dash in reader strings, no retired names | holds (one new word, PC8A-1) |
| BA140 to BA145 | stylesheet | `--field-border` (8 files), undo-bar print rule `desk.css:318-324`, forced-colors blocks | holds; BA141, BA143, BA144 incomplete: XA8-7, XA8-3, XA8-2 |
| BA146 to BA153 | Windows findings | flow-root print rule `desk.css:7925+`, `scroll-padding-block`; tests | holds |
| BA32 | tour offer over text | declined (BVJ, 2026-10-20) | decided |
| SEC-1 | off-site address from a stored bookKey | `chapterPath`, `isChapterAddress`; `chapter-page.js:38`; `desk-chapter-address` test | holds |
| SEC-2 | quadratic lookbehind | node: 200 KB note in 2 ms | holds |
| SEC-3, SEC-4, SEC-5, SEC-6 | external links, print gesture, Share wording, size limits | `external-links.mjs`, `print-link.js`, `MAX_NOTE_BODY`, file gate; SEC8 re-read | holds |
| DI-1, DI-2 | anchor floor, typography | spec v3 and v4 vectors | holds |
| DI-3 to DI-12 | merge, backup, store | tokens in `desk-merge.mjs`, `desk-export.mjs`, `store.js` (`oldVersion` steps, persist button); tests pass | holds; DI-3 and DI-8 residuals are DI8-3, DI8-1 |
| NB-1 | Hide folds the Notebook | `panel.js:625-639` (`foldedByHide`) | holds |
| NB-2 | unsaved note words | draft and `beforeunload` in `note-editor.js` | holds |
| NB-3 to NB-19 | panel follow-through | "Skip to the Notebook" (5 files); `aria-keyshortcuts` only while the switch is on (`note-settings.js:242`); NB-12's 8 s open timeout (NB8 confirmed) | holds; NB-12 is known-open as NB8-12 |
| DK-1 | keyboard blanking | word cursor exists | holds; GF8b-3 follow-up |
| DK-2 to DK-16 | /desk and sheets | `focus-keep.js`, `NO_CHAPTER_KINDS`, parking (`park`, `balance`), print rule | holds; focus class recurs (Caught by both) |
| GK-1 to GK-20 | Greek | `foldGreek` node check; `greek-chapters.js`; `/greek/*` cache rule `_headers:74`; abbreviation "show sources" button (`tab-greek.js:132`); `res.failed` in `greek-find.js:264` | holds |
| LG-1, LG-8, LG-14, RC-5 | real store test, self-compare tests | `desk-store.test.js` 15 pass; `desk-storage-keys` pass | holds |
| LG-2 to LG-7, LG-9, LG-11, LG-12, LG-15 | launch readiness | "Launching" in `desk/CLAUDE.md`, `highlightsSupported`, lazy `search-greek.js`, `claude-docs` test pass, `sameLabelName` gone | holds |
| LG-10 | bundle split | `lazyTab` in `panel.js` | holds |
| LG-13 | complexity map | left by decision ("nothing measured") | still open: LG8-8 |
| LV-1 to LV-5 | live pass | focus, placeholder, dead classes | LV-1 and LV-3 residuals in fresh pass; LV-4 holds; LV-5 moot |
| CP-1 to CP-18 | copy | sweeps for retired phrases ("the foot of the panel", "notebook preview", "my desk") clean; `desk-copy-constants` test; CP-18's `———` gone from `sheet-word.js` | holds |
| RC-1 to RC-7 | re-check items | RC-1, RC-4 tokens present; RC-3 text gone; RC-7 decided in Session 7 | holds |

#### Still open by decision (not misses)
- **CSP enforcement (FA2-c, SEC Q1)**: still `Content-Security-Policy-Report-Only` for scripts and connections; BVJ said "not yet" (2026-11-03). The fresh pass does not mention it, and "Launching" has no CSP line, so it is worth a reminder at launch.
- **Tombstones kept forever (decision 8)**: with BDR; no code waits.
- **LG-4** (`execCommand`): accepted for version 1.
- **DK-15 caveat**: browser find skips parked chapters (decided cost).
- **FA1-v real-device items**: Safari (C18 line, Custom Highlight, Copy, BroadcastChannel), VoiceOver, Safari print are with BDR and open by nature. Chrome, Firefox, two screens, touch, print to PDF, contrast theme, scanned code and A4 passed (BVJ). Audit 2's "Not covered" (screen reader, 400% zoom, a real print dialog on /desk) are open by nature.

### Not reached
- Item-by-item re-verification of every Low and Nit; those rest on the named tests passing and the sweeps (about 25 deep-checked).
- No browser: BA121, BA122, BA146 to BA153 CSS and print results, forced colors and parking were not re-driven; they stand on the earlier audits' browser checks and the fresh pass.
- Full `npm test` (only the desk subset and four other files ran).
- STUDY-DESK-FIXES.md E-items and Audits 3 to 7 (other auditors').

## Appendix Q: Phase 2: Audits 3 to 7 and the E log re-checked (`PC8B`, Sonnet)

Scope: STUDY-DESK-AUDIT-3 (SEC3, DI3, NB3, DK3, GK3, LG3, LV3, CP3), -4 (SEC4, FU4, TR4, CP4), -5 (SH5), -6 (SH6, SEC6, DI6, NB6, DK6, GK6, LG6), -7 (TR7, the Sheets tour) and STUDY-DESK-FIXES.md (E1 to E64, E50 onward weighted).
Commit `15986b6e`, 2026-11-09. Read-only. Scratch: `...\scratchpad\audit8\pc8b\` (test logs, `sec62.mjs`).

Method: read each audit's top matter, decisions and priority list; took every Critical/High/Medium and every item recorded open, partly fixed, deferred, declined, by design or put to BDR; looked each fix up by guard text (not line number) at its new home (`sheets/insert-menu.js`, `sheet-editor.js`, `add-forms.js`, `add-bar.js`, `my-sheets.js`, `first-stage.js`); ran `npm run test:desk` (2,498 pass, 0 fail) and `npm test` (3,377 pass, 0 fail); ran a timing probe for SEC6-2 (200,000 spaces: 3 ms). Random sample of Lows/Nits: `random.seed(8)`, 28 of the 105 Low/Nit headings in Audits 3, 5 and 6 (marked "sample"). Not run: `astro check`, build, browser (forbidden).

Counts: about 95 items checked. Holds 88; regressed 0; still open 2 (below; neither is in the fresh pass as a finding); moot 2 (E1, E2); decided or by design 5. Misses: 2 (both Low).

### Misses

#### PC8B-1 · Low · data-integrity · REGRESSION (weakened rule) of Audit 3's "gathering again adds only the new questions"
**Where**: `src/scripts/desk/sheets/add-forms.js` (the "From my notes" chooser: `tick.disabled = it.onSheet`, and the Add handler), `src/lib/desk-sheet-from-notes.mjs` (`notebookItems` sets `onSheet`; `partsFor` and `fitModules` do not filter).
**What happens**: #504 (713d5640) deleted `desk-sheet-discussion.mjs` and `test/desk-sheet-discussion.test.js` (E62: "+ For discussion" became "+ From my notes…"). The old pure builder skipped a question already on the sheet when it built the parts, against the sheet as saved, and had two tests for it ("gathering again adds only the new questions, without a second heading"; "a heading left behind with no questions is not a reason to skip a new one"). The new rule is deliberate (E62: a note already on the sheet "is listed but can't be ticked") and the ordinary case works. But it now lives only in the chooser's UI: the list is computed once when the form opens, `tick.disabled` is the only guard, and the Add handler's `host.change` re-fits only the part limit ("Fitted again on the sheet as saved") and never re-checks `onSheet`. If another tab, or an undo, puts the same note on the sheet while this chooser is open, ticking it and pressing Add adds a second copy. The "heading" half of the old rule is moot (no heading is made now). So the behavior was changed by #504, not dropped, but the guard is weaker and untested.
**Evidence**: code read. `test/desk-sheet-from-notes.test.js` tests the flag ("…is marked onSheet", line 148) and the part builders, but nothing exercises Add against a sheet that changed after the list was drawn, and `partsFor` has no duplicate case. No fresh-pass finding mentions `onSheet` (grep of every `*8.md`). Not run in a browser.
**Fix**: in the Add handler's `host.change`, drop chosen items now on the sheet `s` (recompute `onSheet` with `notebookItems(s, records)`), or move the filter into `partsFor`/`fitModules` so it is testable; add a test beside line 148.
**Confidence**: Medium (a narrow two-tab race; the weaker guard and the missing test are certain).

**Fixed (2026-11-09)** The Add handler re-checks over the saved sheet (`notAlreadyOn`). Test: `test/desk-sheet-from-notes.test.js`.

#### PC8B-2 · Low · data-integrity · KNOWN-OPEN DI6-5
**Where**: `src/lib/desk-merge.mjs:382` (rule b: `instant(live.modified) > instant(survivor.deletedAt)` removes the deletion); `src/scripts/desk/bookmark-follow.js` (a follower's move writes `modified`).
**What happens**: a bookmark that follows the reader writes `modified` every few seconds, so a deletion made on one device is undone when it meets a laptop still reading: the bookmark returns at the laptop's place. Audit 6 asked BDR (STUDY-DESK.md, "2026-11-08: two questions for BDR", line 2709) and recommended that, for a stamped bookmark, rule b compare `deletedAt` with `editedAt`. No answer is recorded; STUDY-DESK.md line 5073 still lists it among "BDR's open answers that touch the record format". The rule is unchanged in the code. Question 2 of the same entry (should a sheet merge part by part) is also unanswered.
**Evidence**: the comparison as quoted; no `editedAt` branch in `desk-merge.mjs`. Audit 6's `edge-probes.mjs` result (`delete(t5) vs follower move(t6) → ["bookmark"]`) was not re-run, but the code path is the same.
**Fix**: BDR's answer, then one merge-vector case and one sentence in the format's rule b. Nothing to build before then.
**Confidence**: High that it stands. It is an open question for BDR, so treat it as a decision to chase, not a defect to patch. DI8-1 (a clock set ahead) is the sibling Audit 6 asked in the same breath, and the fresh pass has it.

**Open (2026-11-09)** Still with BDR.

### Caught by both

| Earlier item | Audit 8 ID |
|---|---|
| SEC3-2 (inert scrub; the glossary entry in the Search pane is the one import it misses) | SEC8-2 |
| NB3-14 (help page names where the Study Desk button is) | DK8-6 |
| NB3-8 (aria-disabled so focus survives; leftover) | NB8-8 |
| LG-13 / LG3-3 / LG6-2 (the large closures: `createSheetEditor` about 1,190 lines) | LG8-8 |
| DK6-3 (leak-check cost, residual) | LG8-4 |
| Audit 6 DI question 2 (a clock set ahead never converges) | DI8-1 |
| DK-1 (word cursor on a Greek word, "not yet browser-checked") | GF8b-3 |
| Audit 1's list "needing a real browser" | NB8-12 |
| SH6-4 (OT or multi-chapter refusal; its sentence is wrong for one-chapter books) | GF8c-2 |
| SH5-3 / BA69 (where passages land) | SH8-3 (the /search gather path only) |
| E64's "list redraws when a sheet changes elsewhere, keeping focus" does not work in practice | SH8-1, LV8-1 |
| SH6-11 (drag announces nothing) | XA8-1 (drag-only) |
| Audit 5's heading and presenter-button focus fixes (SH5-10) in the presenter view | SH8-6, XA8-9 |

### Checked and holding

| ID | What | How checked | Verdict |
|---|---|---|---|
| SEC3-1 | 1 MB ceiling for any schema | `MAX_RECORD_BYTES` in `desk-records.mjs`, `desk-export.mjs`; tests | holds |
| SEC3-2 | `makeInert` on fetched chapter and intro pages | `chapter-page.js:52`, `intro-pane.js:70` | holds (glossary is SEC8-2) |
| SEC3-3 | participant slides carry no answers (decision 6b) | not rerun on a .pptx; share and copy tests pass | holds by tests |
| SEC3-4 (sample) | name caps, file and fragment limits | `BOOKMARK_NAME_MAX`, `LABEL_NAME_MAX`, `MAX_SHARE_FILE_BYTES`, `MAX_FRAGMENT_LENGTH`, `MAX_JSON_BYTES` present | holds |
| SEC3-5 (sample) | `Object.hasOwn` for marker lookups | `markerName`, `desk-notes.mjs:208` | holds |
| SEC4-1, SEC4-2 | `?q` dropped from the address; malformed fragment | `notebook-page.js`; tests | holds |
| SEC6-1 | Markdown share file escapes `<` | `escapeBody`/`unescapeBody`, `desk-export.mjs:218` | holds |
| SEC6-2 | quadratic regexes in `plainText`/`markdownLine` | timing probe, 200,000 spaces 3 ms | holds |
| SEC6-3, DK6-6, LG6-9 | prompts and minutes not in participant shares | `PARTICIPANT_DROP`, `desk-sheet-share.mjs:80` | holds |
| DI3-1 | stamps step past what they replace | `laterThan`/`laterThanAll`, `restamped` | holds (DI8-2 finds a hole for records this client can't edit) |
| DI3-2 | a `moved` outside its verses carries a notice (spec 4) | `anchor-core.mjs:261`, `desk-change.mjs:148` | holds |
| DI3-3 | bookmark place and edit groups | `placedAt`/`editedAt` in `desk-merge.mjs` | holds |
| DI3-4 | unreadable held copy keeps a tombstone | `desk-export.mjs:712-716` | holds |
| DI3-5 | `star` read as `emphasis` | `RENAMED_MARKERS` | holds |
| DI3-6, DI6-1 | sanitize before validate, edit and import | `cleanIncoming(migrateRecord(r))` `desk-export.mjs:706`; `cleanSheetText` in `sheetFromShared` | holds |
| DI6-2 | required common fields stated | `STUDY-DESK-FORMAT.md:70` | holds (documented, not lenient) |
| DI6-3, DK6-8 | no "Save as template" on a passages-only sheet | `hasTemplateParts` at `my-sheets.js:203`; `isTemplate` stripped in `duplicateSheet` | holds |
| DI6-4 | `search` template id in the format | `STUDY-DESK-FORMAT.md:383` | holds |
| Store fix #497 | `committed` rejects with `tx.error` | `store.js:78-82` | holds |
| NB3-1 | hover-opened flyout isn't closed by the click | `panel-flyout.js:131-152` | holds |
| NB3-2 | Share image "Too long" keeps the row | `verse-image.js:295` | holds |
| NB3-3 | footnote "⋯" focus after save | `pillsHome`, `footnote-notes.js:130` | holds |
| NB3-4 | Study Desk help page | `/desk/help/`; redirect `astro.config.mjs:50` | holds |
| NB3-5, NB3-6, LV3-1 | count announced; Escape clears; `search` event | `tab-mine.js:314`, `panel.js:442`, `kept-list.js:270-277`, `search-pane.js:419` | holds |
| NB3-11, NB3-12 (sample) | flyout rows `role="none"`; scroll closes | `panel-flyout.js:77`, watcher at 88 | holds |
| NB3-10, NB6-1 | skip link hidden when the Notebook is off | `data-desk-skip` in `first-stage.js:125`; rule `desk-tab.css:77` | holds |
| NB6-2 | stand-down after a failed shell load | `first-stage.js:165-175` removes rail and link, focus to main, `standDown` removes tray rows; the tab still vanishes without a message | decided (BA29's design; only the residue was marked fixed) |
| NB6-3 (sample) | margin marks name the notice kind | `flagText(notice)`, `notes-margin.js:476` | holds |
| NB6-4 (sample) | tray hint and reset styled in the first stage | `desk-tab.css:84-110` | holds |
| NB6-5 (sample) | highlights underline in forced colors | `desk.css:21-34` | holds |
| NB6-6 | image failure through a live region | `verse-image.js:232-245` | holds |
| NB6-7, NB6-9, NB6-10 | help wording, dead CSS, aria-disabled look | grep; 0 `desk-home-card__option`; `desk.css:1840` | holds |
| NB6-8 | wording left; shared sheets open on a phone | BVJ decision in Audit 6 | decided |
| DK3-1, DK3-4, DK3-5, DK3-12 (samples) | slide cuts; quoted lists; `sup`; Markdown escapes | `cutSentences`/`chooseCuts`; `quoted` in docx; `"sup"` in `sheet-word.js`; `markdownLine` | holds |
| DK3-2, DK3-3 | leaving Reading restores marks; "no room for a Book Intro pane" | `leavesReading`, `desk-page.js:626`; `desk-search-pane.mjs:148` | holds |
| DK3-7, DK6-11 | arrows skip disabled items, gap menu too | `insert-menu.js:104-137` (`describeUnavailable`) | holds, survived the move |
| DK6-1 | roving gap pills | `syncGapStop`, `sheet-editor.js:811` | holds |
| DK6-2 | gap menu closes on scroll, resize, destroy | `insert-menu.js:75-145`; `closeInsertMenu`, `sheet-editor.js:234` | holds |
| DK6-3, DK6-4, DK6-5 | leak-check cost, Hebrew points, telltale | `desk-sheet-leaks.mjs` | holds |
| DK6-7 (sample) | one-key-terms message | `sheet-editor.js:369` | holds |
| DK6-10 | `desk:sheet-new` ordering | still synchronous, `sheet-pane.js:151`; latent | holds |
| GK3-1 | `Object.hasOwn` in the Greek offer | `search-core.js:1380` | holds |
| GK3-2, GK3-5, GK3-8, GK3-10, GK3-13 (samples) | builder box kept; Latin pairs; sources button; announcements | `greek-builder.mjs:71`, `tab-greek.js:140-144`, `:307` | holds |
| GK3-3 | forced-colors state for builder chips | nine `forced-colors` blocks in `desk.css` | holds (the Sheets editor is XA8-7) |
| GK6-1 | failed Greek load offers Try again | `searchbar.js:680`, `search.js:1017` | holds |
| GK6-2 | LICENSE third class | `LICENSE` lines 34-81 | holds |
| GK6-4, GK6-8, GK6-9 | µ folded; Escape during composition; build stamps | `greek-search.mjs:66`; `float-window.js:127`; `search-greek.js:116` | holds |
| LG3-1, LG3-4 | launch checklist; import-closure test | "Launching"; `test/desk-gate-imports.test.js` | holds |
| LG3-3, LG6-2 | splitting the big closures | still large | open by design (LG8-8) |
| LG3-5, LG6-1 | desk CLAUDE.md under its cap | 123,553 bytes against 153,600; docs tests pass | holds |
| LG3-14, LG6-3, LG6-4, LG6-5, LG6-7 (samples) | `settled()`; tests; docs; dead code | `store.js:109`; the four dead exports have 0 hits | holds |
| LV3-2 | Reading with marks already off | `turnOffMarks` unions with what is remembered | holds |
| LV3-3 | sheets out of My Notes | no sheet branch in `tab-mine.js` | holds |
| LV3-4, LV3-5 (samples) | tour and Full screen focus; list keeps selection | `returnFallback`; `keepingSelection`, `sheet-text.js:359` | holds |
| TR4-1 to TR4-6, FU4-1 to FU4-3, CP4 | Audit 4's fixes | Audit 7 section B rechecked them; tests pass | holds |
| SH5-1 (High) | Paragraph style, alignment and Style menus apply | `close()` empties `openMenu` first, `sheet-text.js:806-815`; same `closed` guard in `insert-menu.js:79`, `sheet-present.js:329` | holds |
| SH5-3 | passages land under the reading part | `passageInsertIndex`, `desk-sheet-add.mjs:44` | holds |
| SH5-8, SH6-10 | a lone heading is a Present screen | `presentScreens` unchanged | by design (open observation) |
| SH5-11, SH5-17 (samples) | passage field takes focus; "filled in again"; Blanks help | `add-forms.js:195`; `sheet-lit.js:614,718`; help.astro | holds |
| SH6-1 | new part focuses its text, not minutes | `focusNewPart`, `sheet-editor.js:1159` | holds, survived the split |
| SH6-2 | no leak notice on a shared link | `sheet-page.js:636-640` | holds |
| SH6-3 | what an untouched part prints | `hasWords` rules, `desk-sheet-copy.mjs:49-66`; (d) declined | holds |
| SH6-4 | OT or multi-chapter refusal | `desk-sheet-ref-refusal.mjs` | holds (one-chapter wording is GF8c-2) |
| SH6-5, SH6-7 | gap pill announces the heading; new sheet is a draft | `addPart(type, m.id, name)`; `persistDraft` | holds |
| E1, E2 | flash on load; hidden verse's menu | live only on the unmerged `claude/desk-1d-hidden` (N8 held) | moot in this tree |
| E50 to E52 | Study Desk pill, share dialog ×, /sheets padding | `read-menu__desk`; `lit-panel__close`; `padding-top: 3.5rem` | holds |
| E54, E55, E57, E58 | Greek copy; list in a paragraph; boxed key terms; link note | `tab-greek.js:754-773`; `CLOSES_P`; `DOC_BOX`; `sheet-page.js:918` | holds |
| E60, E61, E62, E64 | header drag and tips; Reading form; From my notes; list buttons | `ADD_TIPS`; `READING_PROMPT`; `add-forms.js`; `my-sheets.js`, `sheet-page-list.js` | holds, except E64's redraw focus (SH8-1) and E62's re-gather rule (PC8B-1) |
| TR7-1 to TR7-9, E63 | tour fixes and the Sheets tour | Audit 7 text; `test:desk` passes | holds |

### Not reached

- About 75 of the 105 Low and Nit headings in Audits 3, 5 and 6 (the 28-item sample covered the rest); Audit 5 section B's template text and the landscape recommendations beyond BVJ's calls; Audit 4's copy pass beyond the strings named; Audits 1 and 2 were out of scope.
- Fixes whose proof needs a browser, a screen reader, a Windows contrast theme, an IME, Safari or Firefox: NB6-5, NB6-6, GK6-8, SH5-1 across engines, DK3-1 and DK3-4 as rendered in Word or PowerPoint.
- `astro check`, the build and the link check were not run.

## Appendix R: Phase 2: the tests earlier fixes cite (`PC8C`, Haiku)

**Scope**: every test-file citation in `STUDY-DESK-AUDIT-1.md` to `STUDY-DESK-AUDIT-7.md`, `STUDY-DESK-FIXES.md` and `STUDY-DESK.md`.
**Commit**: `15986b6e` (branch `claude/desk-audit-8`), checkout `.claude/worktrees/desk-audit-8`.
**Date**: 2026-11-09.
**Method**: a node script (`pc8c/extract.js`) pulled every `test/…test.js|mjs` and `….test.js|mjs` reference with its file and line (494 raw citations, 115 distinct file names). `git ls-files` checked each name, with `git log --all --diff-filter=D`, `--follow`, `-S` and `git show --stat` tracing the missing ones. A second script (`pc8c/titles.js`) pulled quoted strings near each citation and grepped them in the cited file. Each cited existing file was then run with `node --test`.
**Tree**: clean before and after. A stray `grep.exe.stackdump` from a crashed grep in the worktree root was removed.

### Counts

| Item | Count |
|---|---|
| Raw citations | 494 |
| Distinct test files cited | 115 |
| Existing (in `test/` or `scripts/reconcile/test/`) | 111 |
| Missing | 4 |
| Missing, with a successor under a new name | 4 (all four) |
| Path form wrong, file exists elsewhere | 1 (`test/review-core.test.mjs`, really `scripts/reconcile/test/`) |
| Explicit quoted test titles checked | 6 (5 found, 1 reworded) |
| Deleted-file titles with no verbatim match now | 49 of 67 (see Table B) |
| Cited test files run | 111 |
| Tests run / pass / fail | 2956 / 2956 / 0 |

### Table A: missing test files

| Missing file | Cited by | Status in git | Successor |
|---|---|---|---|
| `test/ribbon-follow.test.js` | AUDIT-1:1651, 1654, 1673, 1690, 1712 (BA99 to BA102); AUDIT-2:2194 (a suggested `test:desk` command) | Created in `c5da3803` (#405). Renamed to `test/bookmark-follow.test.js` in `6243ea05` (#434, 2026-11-02, "Bookmarks become one feature"), a git rename shown in that commit's stat. | `test/bookmark-follow.test.js` (the BA99 to BA102 titles are kept, five of them verbatim) |
| `test/desk-places.test.js` | AUDIT-1:1725 (BA103), 1758 (BA106) | Created in `04d286fc`. Deleted in `6243ea05` (#434). | Its tests moved into `test/desk-bookmarks.test.js` (added in #434). Two titles kept verbatim: "an inherited property name is not a book" and the tidy-and-cut title. The emoji one is reworded: "a bookmark name is cut by character, never through an emoji". |
| `test/desk-ribbon-change.test.js` | AUDIT-1:1712 (BA102) | Created in `c5da3803` (#405). Deleted in `6243ea05` (#434). Its module `src/lib/desk-ribbon-change.mjs` no longer exists. | `src/lib/desk-bookmark-change.mjs` and `test/desk-bookmark-change.test.js` (added in #434). The same rules are there under bookmark wording. |
| `test/desk-sheet-discussion.test.js` | AUDIT-3:2026, 2083, 2116 (the file-to-test coverage table) | Created in `82af6a60` (#346). Deleted in `713d5640` (#504, 2026-11-07). Its module `src/lib/desk-sheet-discussion.mjs` was deleted in the same commit. The stat shows the two as separate delete and add, not a rename. | `src/lib/desk-sheet-from-notes.mjs` and `test/desk-sheet-from-notes.test.js` (added in #504). |

The path form `test/review-core.test.mjs` (AUDIT-3:2105) is wrong, not missing: the file is `scripts/reconcile/test/review-core.test.mjs`, which the test run covered.

`npm run test:desk` (package.json) now matches `desk-*`, `greek-*`, `search-greek-*` and `anchor-text`. It does not match `bookmark-follow.test.js`, `float-window.test.js` or `release-feed.test.js`, which AUDIT-2:2194 suggested adding. The full `npm test` glob does include them. This is a fast-loop gap, not a failure.

### Table B: cited test titles not found

**Quoted titles checked against the cited file (explicit titles only)**

| Cited at | Cited title | Result |
|---|---|---|
| AUDIT-1:1712 (BA102) | "That ribbon has been deleted." | Not found. The string is now `BOOKMARK_GONE` = "That bookmark has been deleted." (`src/lib/desk-bookmark-change.mjs:28`), tested in `test/desk-bookmark-change.test.js`. |
| AUDIT-3:1512 | "nothing in the site imports the retirement rules before the launch cutover" (`read-view-retirement.test.js:92`) | Found, verbatim. |
| AUDIT-6:1473 | "a step while blank only brings the screen back" (`desk-present.test.js`) | Reworded. This is a rule quote from `src/lib/desk-present.mjs`. The test title "stepState: a step key while blank brings the screen back without moving" covers it. |
| AUDIT-2:2091 | "apply a plan the way store.js does" (`desk-history.test.js:50`) | Found, but only in a comment, not as a test title. |
| AUDIT-3:480 | "It is too large to keep (over 1 MB)." (`desk-hostile-records.test.js`) | Found as an assertion's expected reason string (lines 49 and 54), not as a title. |
| AUDIT-3:708 | "Finding a mark again", "Spec version 3", "Clocks" | Not test titles. These are section headings from the sheet and merge spec, quoted as the spec's text. Not checked against `STUDY-DESK.md`. |

Every other quoted string near a citation was prose, a code name, a path, a command or a placeholder ("held by test X"). None was a test title.

**Titles in the four deleted files with no verbatim match now**

Each deleted file's `test("…")` titles were compared with the test titles in the current tree. A title counts as kept when it appears word for word somewhere in `test/` or `scripts/reconcile/test/`.

| Deleted file | Titles | Kept verbatim | Not verbatim | Successor and note |
|---|---|---|---|---|
| `desk-places.test.js` | 18 | 6 | 12 | Reworded into `desk-bookmarks.test.js` and `desk-bookmark-change.test.js` ("a ribbon name is cut by character…" becomes "a bookmark name is cut by character…"). "a few ribbons per reader" and "nothing to show gives an empty list" are not matched; not checked further. |
| `desk-ribbon-change.test.js` | 13 | 0 | 13 | Renamed to bookmark wording in `desk-bookmark-change.test.js`. Example: "a ribbon deleted before the rename is written is not brought back" becomes "a bookmark deleted before the change is written is not brought back". |
| `ribbon-follow.test.js` | 13 | 5 | 8 | Renamed as `bookmark-follow.test.js`. Five kept verbatim (the BA99 page-link, BA100, BA101 back-forward, BA102 move, and "a flag stored before tokens"). The BA101 "flag is dropped outside the book even when the notebook didn't open" test was reworked, see the note below. |
| `desk-sheet-discussion.test.js` | 17 | 6 | 11 | Moved into `desk-sheet-from-notes.test.js`. Example: "questionHtml is always canonical" becomes "noteHtml is always canonical". "gathering again adds only the new questions, without a second heading" has no current counterpart (not verified whether the behavior is covered). |

**Decided change, not a loss**: AUDIT-1:1690 (BA101) says the follow is "dropped" on a page outside the book when the notebook does not open. That was reversed on 2026-11-04 ("Paused rather than ended (BVJ, 2026-11-04)", `src/scripts/desk-gate.js:31-34`), and the current test says a page outside the book "leaves the follow in place". Two places still say "dropped": a comment at `src/scripts/desk/bookmark-follow.js:325` and `STUDY-DESK.md:162`. Both are stale wording, not a regression.

### Table C: test results

Command: `node --test` with the 111 existing cited files (the list is in `pc8c/existing.txt`). Output: `pc8c/test-run.txt`.

| Measure | Result |
|---|---|
| Files run | 111 |
| Tests | 2956 |
| Pass | 2956 |
| Fail | 0 |
| Cancelled / skipped / todo | 0 / 0 / 0 |
| Exit code | 0 |
| Duration | about 6.0 s |

No failing test, so no failure is quoted.

### Findings

#### PC8C-1 · Low · stale test citation · BA99, BA100, BA101, BA102 (STUDY-DESK-AUDIT-1.md:1651–1712)

**Where**: the fix status lines for BA99 to BA102 in `STUDY-DESK-AUDIT-1.md`, which say "Tested in `test/ribbon-follow.test.js`". Also AUDIT-2:2194, which suggests `test/ribbon-follow.test.js` in a `test:desk` command.
**What happens**: a reader who looks up the cited file finds nothing. The tests now live in `test/bookmark-follow.test.js` (renamed in `6243ea05`, #434). The behavior is still tested, so the fix holds. The citations are stale.
**Evidence**: `git show --stat 6243ea05` shows `…bbon-follow.test.js => bookmark-follow.test.js`. `test/bookmark-follow.test.js` has the BA99, BA100, BA101 and BA102 titles, five of them verbatim.
**Fix**: point the citations at `test/bookmark-follow.test.js`.
**Confidence**: High.

**Fixed (2026-11-09)** The citations in Audits 1 and 2 name the new file.

#### PC8C-2 · Low · stale test citation · BA103, BA106 (STUDY-DESK-AUDIT-1.md:1725, 1758)

**Where**: the status lines for BA103 and BA106 in `STUDY-DESK-AUDIT-1.md`, which say "Tested in `test/desk-places.test.js`".
**What happens**: the file was deleted in `6243ea05` (#434). Its tests moved into `test/desk-bookmarks.test.js`. The BA103 title "an inherited property name is not a book" appears there verbatim. The BA106 emoji case is now "a bookmark name is cut by character, never through an emoji". I did not verify that the 40-code-point length itself is asserted.
**Evidence**: `git log --all --diff-filter=D -- test/desk-places.test.js` gives `6243ea05`. Titles grepped in the current tree.
**Fix**: point the citations at `test/desk-bookmarks.test.js`.
**Confidence**: High for the file move. Medium for the 40-point assertion.

**Fixed (2026-11-09)**

#### PC8C-3 · Low · stale test citation · BA102 (STUDY-DESK-AUDIT-1.md:1712)

**Where**: the BA102 status line in `STUDY-DESK-AUDIT-1.md`. It cites `test/desk-ribbon-change.test.js` and quotes the message "That ribbon has been deleted."
**What happens**: the file and its module `src/lib/desk-ribbon-change.mjs` were removed in `6243ea05` (#434). The message is now "That bookmark has been deleted." (`src/lib/desk-bookmark-change.mjs:28`), tested in `test/desk-bookmark-change.test.js`. The "not brought back" rule still holds under the new title.
**Evidence**: `ls src/lib/desk-ribbon-change.mjs` fails. The old message appears nowhere in `src/` or `test/`.
**Fix**: point the citation at `test/desk-bookmark-change.test.js` and quote the bookmark wording.
**Confidence**: High.

**Fixed (2026-11-09)**

#### PC8C-4 · Low · stale test citation · file-to-test coverage table (STUDY-DESK-AUDIT-3.md:2026, 2083, 2116)

**Where**: three rows of the Audit 3 coverage table, which cite `test/desk-sheet-discussion.test.js` for `src/lib/desk-sheet-discussion.mjs`.
**What happens**: the test and the module were both deleted in `713d5640` (#504, 2026-11-07). The replacements are `src/lib/desk-sheet-from-notes.mjs` and `test/desk-sheet-from-notes.test.js`. The rows describe a module that no longer exists. Eleven of the 17 deleted titles have no verbatim match. "gathering again adds only the new questions, without a second heading" has no visible counterpart, and I did not verify whether that behavior is still covered.
**Evidence**: `git show --stat 713d5640` lists `desk-sheet-discussion.test.js` and `desk-sheet-discussion.mjs` as deleted, and `desk-sheet-from-notes` as added.
**Fix**: update the three rows to `desk-sheet-from-notes`. Check the re-gather behavior separately.
**Confidence**: High for the stale rows. Low for whether the re-gather behavior is covered.

**Fixed (2026-11-09)** Audit 3's row for the removed module names its successor.

### Not reached

- Each cited claim was checked for the file's existence and, for titles, its wording. I did not re-verify the claims the citations support, beyond what is listed above.
- The 1,696 quoted strings were filtered to title-like phrases (33 in cited files). The filter is heuristic. A title in a non-quoted form, or in a single quote with unusual punctuation, could be missed.
- The 40-code-point assertion (PC8C-2) and the re-gather coverage (PC8C-4) were not traced to a line.
- `STUDY-DESK.md` and `STUDY-DESK-FIXES.md` were not read beyond the cited lines.

## Appendix S: The brief every phase 1 auditor was given

You are one auditor in a multi-agent audit of the **Study Desk** of the LIT Bible website
(litbible.net). The owner, BVJ (pronouns unstated; use they/them), asked for **one final
exhaustive audit of every Study Desk file, from as many perspectives as possible, with fresh
eyes, as if nobody had reviewed it before.** Seven audits came before this one. This phase is
the fresh-eyes pass; a later phase, run by someone else, re-checks the earlier audits' findings.

Repo checkout to read: `C:\Users\bcjoh\GitHub\litbible\.claude\worktrees\desk-audit-8`
(branch `claude/desk-audit-8`, commit `15986b6e`, identical to `origin/main` on 2026-11-09).
Read ONLY this checkout, never the main checkout or other worktrees (other sessions work
there). It has its own `node_modules` and a finished production build in `dist/` (the build
log is `...\scratchpad\build.log`, beside this brief's folder). Windows; PowerShell and Git
Bash both exist; run Python as `python`, never `python3`.

### What the Study Desk is

A pre-release, desktop-only, off-by-default feature (`?desk=on` turns it on in one browser):

- **The Notebook panel** on reading pages: notes, bookmarks (followed or still), highlights,
  pinned footnotes, labels, a trash; marks drawn on the page (highlights, margin notes, change
  notices when the wording under a mark moves); loaded lazily in two stages (`first-stage.js`,
  then the shell).
- **The Greek tab**, Greek search, the search builder, the commands window; data in
  `public/greek/`.
- **`/desk`**: a one-to-four-pane workspace (LIT, My Notes, This verse, Footnotes, Book Intro,
  Greek, search, Sheets panes), with two tours. **`/notebook`** and the help page **`/desk/help/`**.
- **The Sheets** (study handouts): templates (built-in and the reader's own) with ghost prompts,
  parts (text, question, blanks, key terms box, space, page break, passages, minutes, leader
  only), the gap's Add menu, the editor in the pane and on the `/sheets` page (S12), two tabs on
  one sheet, print and the print check, present and presenter view, share links (also opened on a
  phone), and saving as .docx, .odt, .rtf, .md, .pptx, .odp and PDF. The Sheets tour.
- **Saved data**: IndexedDB (`lit-desk`) plus localStorage keys; export and import of a backup;
  a record format shared with the iOS/Android apps (`STUDY-DESK-FORMAT.md`, for BDR, the apps'
  developer).

Code: `src/scripts/desk/` (about 82 files) and `src/scripts/desk/sheets/` (about 22),
pure logic in `src/lib/desk-*.mjs` (63 files), CSS in `src/styles/desk.css` (and
`desk-tab.css`, `desk-help.css`), pages `src/pages/{desk,notebook,sheets}.astro` and
`src/pages/desk/help.astro`, the gate `desk-gate.js` and the pre-paint script in
`src/layouts/Layout.astro`, tests in `test/` (`npm run test:desk` lists the desk's).

### Fresh eyes: how this phase works

- **Form your own view from the code and the design record.** Do not read the earlier audits to
  decide where to look, and do not re-check their fixes one by one (a later phase does that).
  Assume nothing has been reviewed. Code that has been audited seven times can still be wrong;
  so can code nobody has looked at since it was moved.
- **The design record decides what is deliberate.** `src/scripts/desk/CLAUDE.md` and
  `src/scripts/desk/sheets/CLAUDE.md` are the design record (the first is about 124 KB; grep it
  for your slice's features and read those parts in full, never the whole file).
  `STUDY-DESK-FORMAT.md` is the format contract. Anything marked "(BVJ, <date>)" or described as
  an owner decision is **deliberate, not a defect**; if you think one is wrong, put it under
  "Questions for the owner".
- **Only once you have a finding, before you write it up,** grep the earlier audits
  (`STUDY-DESK-AUDIT-1.md` to `-7.md`) and the owner's log (`STUDY-DESK-FIXES.md`, the E log) for
  it, to tag it and to drop it if it was a recorded decision. These files are large; grep, never
  read whole. `STUDY-DESK.md` (about 540 KB) likewise. Tags: `NEW`; `KNOWN-OPEN <ID>` (an earlier
  finding or E entry still open); `REGRESSION <ID>` (marked fixed, but broken again or
  incomplete, with evidence).
- **Spend extra effort on the newest code** (least audited), without skipping the old. Since
  Audit 6 (`5c9a31a6`, 2026-11-08), 25 commits landed, among them: the Sheets client code moved
  to `src/scripts/desk/sheets/` and given its own CLAUDE.md; the sheet editor separated from the
  Sheets pane, then split into `add-forms.js`, `part-cards.js`, `add-bar.js`, `insert-menu.js`,
  `my-sheets.js`; editing a sheet on the `/sheets` page (S12, `sheet-page-edit.js`,
  `sheet-page-list.js`); two tabs on one sheet (a line on a part changed elsewhere, a question
  before editing); a shared sheet opening on a phone or tablet (#511); Greek search files carrying
  their build (GK6-9); the Sheets tour (E63) and both tours brought up to date; the Sheets page
  list's Duplicate, Save as template and Delete (E64); header C and the ways into the Sheets.
  `git log --oneline 5c9a31a6..HEAD -- <your paths>` and `git show` the relevant ones.

### Root rules that apply (from the root `CLAUDE.md`)

Dark-mode styles need both selectors (the OS media query guarded by
`:root:not([data-theme="light"])`, and `:root[data-theme="dark"]`); size text columns with
`--ch`, never the `ch` unit; focus rings use `--focus-ring`; a link that leaves the site opens in
a new tab with `rel="noopener noreferrer"`; the desk is downloaded only with `data-desk="on"` and
shared reader code never statically imports it (save a shared sheet's link opened on a phone,
its viewer alone); reader-facing copy is American (color, periods and commas inside closing
quotes), the Oxford comma always, curly quotes, and no em dashes in prose Claude wrote (the
owner's own text is exempt). The website's study tools are desktop-only (phones and tablets use
the apps), except a shared sheet's viewer.

### Ground rules

**READ-ONLY in the repo.** Do not edit, create, delete or commit any file in the checkout. No
git commands that change state (no stash, checkout, reset, add, commit, merge, worktree). Write
only your report, at the path your prompt gives, plus throwaway scripts in your own scratch
folder (your prompt gives it; never in the repo). You may run read-only commands, unit tests
(`node --test test/<file>`), and node scripts. The `*.mjs` modules import cleanly in node, so
**exercise the pure logic directly** (fuzz it, feed it hostile, huge, empty and awkward input)
rather than only reading it. Client modules in `src/scripts/desk/` can often be loaded in node
with a small DOM stub, or their pure parts copied into a script, when that settles a question.

**No dev server and no browser** unless your prompt says you are the live auditor. One agent
drives the browser pane, later.

### Perspectives

Your prompt gives your slice. Within it, look from every angle that applies: a first-time
reader; a weekly ministry leader; a keyboard-only user; a screen-reader user; a user in a
Windows contrast theme, dark mode, 200% zoom, reduced motion; someone with 5,000 notes or a
300-part sheet; someone offline, or whose storage is full or blocked, or with two tabs open;
someone restoring a backup on another computer; an attacker who controls a share link, a backup
file or a pasted clipboard; BDR building the apps against the format; a maintainer arriving in
two years; the owner reading the help page. Correctness first, then robustness, then design.

### Standards of evidence

Every finding must be verified by reading the code at the cited file and line, and by running
it where practical. No speculation presented as fact. Mark anything you could not confirm
`Confidence: Low` and say what would confirm it. Prefer fewer, real, well-evidenced findings over
padding. No style nits unless they affect users or maintainability. Quote line numbers from this
checkout, and name the function too.

### Report format

Markdown, at your report path:

- A header line: slice, model, commit, date, what you ran.
- `## Summary`: 5 to 8 lines on the health of your slice, with counts by severity.
- `## Findings`, ordered by severity. One block each:
  `### <PREFIX>-<n> · <Critical|High|Medium|Low|Nit> · <a11y|usability|ui|security|privacy|bug|data-integrity|performance|longevity|docs|compat|copy> · <NEW|KNOWN-OPEN x|REGRESSION x>`
  with a one-line title, then **Where** (`src/...:123`, function), **What happens** (a concrete
  scenario a user or maintainer would hit), **Evidence** (what you read or ran; name your
  script), **Fix** (concise and specific), **Confidence** (High, Medium or Low).
- `## Improvements`: worthwhile non-defects, one line of rationale each.
- `## Questions for the owner`
- `## What held up`: what you checked and found sound, so nobody re-checks it.
- `## Not reached`

Cap at about 30 findings. Severity: **Critical** = data loss or corruption, script injection, or
a feature unusable for a class of users. **High** = likely user-visible failure, or a WCAG A/AA
blocker. **Medium** = real friction, or a bug in a plausible scenario. **Low** = edge case or
polish. **Nit** = trivial.

### Your final message to the orchestrator

At most 200 words: counts by severity, your top five findings in one line each, and the report
path. Everything else lives in the file.

## Appendix T: The brief phase 2 was given

The fresh-eyes phase of Audit 8 is finished: 13 auditors read the Study Desk at commit `15986b6e`
without leaning on the earlier audits. Its findings are indexed in
`C:\Users\bcjoh\AppData\Local\Temp\claude\C--Users-bcjoh-GitHub-litbible\60e3a28a-1257-46db-85a6-d7898818e9fc\scratchpad\audit8\INDEX.md`
(each finding's header and first line; the full reports are the `*.md` files beside it).

BVJ (the owner; pronouns unstated, use they/them) asked that, **after** the fresh audit, the issues
from the previous audits be spot-checked **to double-check nothing was missed**. That is your job:
did any earlier finding marked fixed come undone (a regression the fresh pass did not catch), and
does anything recorded as open still stand (and is it in the fresh pass)?

Checkout: `C:\Users\bcjoh\GitHub\litbible\.claude\worktrees\desk-audit-8` (commit `15986b6e`).
READ-ONLY: no edits, no git state changes, no dev server, no browser. Scripts only in your scratch
folder. Run Python as `python`, never `python3`. The audit files are large: grep for an ID and read
that section, never whole (except Audits 4, 5 and 7, which are small).

Where things moved since a finding was written: the Sheets client code moved to
`src/scripts/desk/sheets/` (2026-11-08); the sheet editor was split into `sheet-editor.js`,
`add-forms.js`, `part-cards.js`, `add-bar.js`, `insert-menu.js`, `my-sheets.js`; the desk loads in
two stages on reading pages (`first-stage.js`, then the shell); `start()` and `createSheetPane` were
split up. A fix whose code moved is the most likely to have been lost: use the function or the
guard's text, not the old line number. `git log -S'<guard text>'` finds where something went.

### How to choose what to check

You can't re-verify hundreds of items in depth. Choose:

1. **Every Critical and High**, and every Medium, in your audits: confirm the fix is still in the
   code (the guard, the test) and still works (run the test, or a quick node check).
2. **Every item whose recorded status is open, partly fixed, deferred, left by design, or put to
   BDR**: what is its state today? If still open, is it in the fresh pass (`INDEX.md`)? An open item
   that is real and absent from the fresh pass is a **miss** worth reporting.
3. **Every fix in code that has moved** (above): confirm it survived the move.
4. **A random sample of the rest** (about 25 fixed Lows and Nits): say how you sampled.

For each item checked: holds, regressed (with evidence), still open (in the fresh pass as <ID>, or
not), moot (the code is gone), or decided (cite the decision).

### Report

Markdown at your report path:

- Header: scope, commit, date, how you sampled, counts.
- `## Misses`: regressions and still-open items that the fresh pass did **not** report, each as
  `### PC8x-n · <Critical|High|Medium|Low|Nit> · <category> · REGRESSION <ID>|KNOWN-OPEN <ID>`
  with **Where**, **What happens**, **Evidence**, **Fix**, **Confidence** (the fresh pass's format).
- `## Caught by both`: earlier items the fresh pass found again (earlier ID → Audit 8 ID).
- `## Checked and holding`: a table, one row per item (ID | what | how checked | verdict).
- `## Not reached`.

Final message to the orchestrator: at most 200 words (counts, the misses in a line each, the path).
