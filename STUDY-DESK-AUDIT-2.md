# Study Desk Audit 2

Audited 2026-11-03 at commit `a57e155d` (branch `claude/phase5-work-sessions`).
**Read this first: the audit ran on a snapshot 20 PRs behind `main` (#426 to #445 had not landed).** Those PRs
touched trash restore, tours, Bookmarks, the Print menu and the header, so some findings in those areas may be
changed or already fixed. Re-check a finding against `main` before acting on it. SEC-1 was confirmed on `main`
and fixed in PR #446.

Everything the desk is: the Notebook panel and its tabs, the margin marks, the Greek tab and
Greek search, the `/desk` workspace, sheets (editor, `/sheets/`, present mode, print, share),
`/notebook/` and its help, the data layer under all of it, and the launch gate. Audit 1
(`STUDY-DESK-AUDIT-1.md`, BA1 to BA153, ending 2026-10-28) is the baseline: this audit only
reports what it does not cover, plus the code written since.

Nothing was changed in the repo while auditing. Every finding below is `NEW` unless it says
otherwise. IDs carry their auditor's prefix (`SEC`, `DI`, `NB`, `DK`, `GK`, `LG`, `LV`, `CP`)
and are not renumbered into the BA series, so a phase can cite them as they are.

## Bottom line

The foundations are strong. The pure logic is thoroughly tested (2,708 tests pass, none skipped).
The sheet sanitizer and the note renderer survived 105 hostile inputs with no markup getting
through. The store aborts partial writes. The Greek data is clean (260 chapters, 137,794 words,
all NFC, every lemma resolves). A reader without the preview downloads none of the desk's data
or scripts. Audit 1's fixes that were re-checked all held, and none was reopened.

The risks are concentrated in five places:

1. **One security hole to close before anyone else gets the desk (closed by #446).** A backup file, written in a
   newer format, can make the desk fetch an attacker's page and import its HTML into the live
   page (SEC-1). It is the same class as Audit 1's BA66, through a field BA66 did not cover.
2. **The reader's own work can be lost or misplaced silently.** A note being typed is thrown
   away by Escape, Cancel, or clicking a verse number (NB-2, DI-6). A reworded mark can
   re-attach to other words with no notice (DI-1). A backup cannot bring back what was deleted
   since, and says "yours are newer" (DI-4). Joining highlights drops labels (DI-7).
3. **Phase 5 (2026-10-29) was not carried through.** The H key closes the Notebook with no
   visible way back (NB-1). Four tabs no longer fit the panel (NB-3). Keyboard readers lost
   their early route to the Notebook (NB-4). The tour and help still teach a layout that is
   gone (NB-6, CP-1).
4. **The browser half is almost untested, and launch is not one switch.** 96% of the 23,266
   lines in `src/scripts/desk/*.js` are never run by a test (LG-1). About a dozen places read
   the preview stamp, and `?desk=off` cannot survive the flip (LG-3).
5. **No screen reader has ever been used on the desk.** The code-level accessibility work is
   good (real tablist, separator, dialog and menu semantics), but several live regions
   probably never announce (DK-2, GK-16), and the Greek and Hebrew quoted inside lexicon
   entries carries no `lang` at all (GK-2).

### Counts

| Slice (auditor, model) | Critical | High | Medium | Low | Nit | Total |
|---|---|---|---|---|---|---|
| A. Security, `SEC` (Opus) | 1 | 0 | 1 | 4 | 0 | 6 |
| B. Data integrity and sync-readiness, `DI` (Opus) | 0 | 1 | 7 | 4 | 0 | 12 |
| C. Notebook panel, marks, first use, `NB` (Sonnet) | 0 | 3 | 4 | 10 | 2 | 19 |
| D. /desk and sheets, `DK` (Sonnet) | 0 | 1 | 5 | 9 | 1 | 16 |
| E. Greek tab and search, `GK` (Sonnet) | 0 | 0 | 3 | 15 | 2 | 20 |
| F. Longevity and launch readiness, `LG` (Sonnet) | 0 | 0 | 5 | 8 | 2 | 15 |
| G. Live browser pass, `LV` (Sonnet) | 0 | 0 | 0 | 4 | 1 | 5 |
| H. Copy and terminology, `CP` (Sonnet) | 0 | 0 | 5 | 9 | 4 | 18 |
| **Total** | **1** | **5** | **30** | **63** | **12** | **111** |

Severities are each auditor's own. The priority list below is the orchestrator's ranking.

## Priority list

### Tier 1: fix before the desk is shown to anyone else

| # | ID | What | Why it ranks here | Fix, in brief |
|---|---|---|---|---|
| 1 | SEC-1 (Critical) | A `sheetFormat: 2` or `schema: 2` record skips `validateRecord`; a sheet passage's `bookKey` (`"/attacker.example/x"`) goes straight into `chapterHref`, the desk fetches that page and imports its blocks into the live document. | Script injection with every note in reach, repeated on each visit (`?sheet=` saves the pane into the layout). The enforced CSP does not restrict scripts or connections. Today's exposure is any file or sheet link someone sends the owner or BDR. Verified: the chain is in the code, and the stored record reproduces; the handler running in a browser was not tried. | Refuse a `bookKey`/`chapter` that is not a real book and in-range chapter in `chapterHref`, `recordHref`, `readHref`; check location fields in `validateRecord` even for records it cannot edit; strip `img`/`script`/`on*` from imported blocks; enforce `connect-src` on `/desk/*`, `/sheets/*`, `/notebook/*`. |
| 2 | NB-2, DI-6 (High, Medium) | The note editor discards unsaved words on Escape, Cancel, ×, or a click on a verse number or footnote letter, and on reload or leaving the page. `changed()` exists and only the tour uses it. | Silent loss of the reader's own writing. Confirmed live. | Guard `closePanel`/`showPanel` while a `stay` panel `changed()`; ask once; keep a `sessionStorage` draft; `beforeunload` while it holds words. |
| 3 | NB-1 (High) | The H key (Hide my marks) closes the Notebook and nothing on the page reopens it; "closed" persists. | A dead end created by two separate decisions (no Close, header link to /desk). Confirmed live, for the H key only. | Make Hide minimize instead of close, or reopen on un-hide; keep one visible reopen control. |
| 4 | DI-1 (High) | When a mark's own words are reworded, the `moved` step takes a single other copy of those words anywhere in the chapter with no context check, so the mark lands on other words with no notice. | Wrong place is worse than not found. The fuzz re-run by the orchestrator matched the report: 38.1% of one-word marks, 15.1% of two-word, 6.7% of three-word (each conditional on a later revision that rewords inside the mark). It is the shared spec the apps copy. | Require the context floor for a single occurrence too; for `moved` across verses require both sides or raise a notice; bump `ANCHOR_SPEC_VERSION` to 3 with new vectors, and tell BDR. |
| 5 | NB-3 (High) | Settings made four tabs; they do not fit the 280 to 350px panel. | Settings is the only home of the switches, print buttons and help links. Live: the row wraps to two lines at 1280px (panel 304px); with OpenDyslexic 54 to 81px of Settings is cut off. (At the 280px minimum with Inter the labels wrap and nothing clips.) | `flex-wrap`, tighter padding or shorter labels, or a gear button; add the `data-font` allowance. |
| 6 | DK-1 (High) | A keyboard-only reader cannot blank an arbitrary word on a sheet; only the key-term chips and a mouse selection work. | WCAG 2.1.1 (A) for the function. Confirmed live. | A word cursor on the passage text, or a "choose words" mode with per-word buttons. |

### Tier 2: fix before the desk is public

**Shared record rules, with BDR (spec change, new vectors, apps need to know):**
DI-2 (typography beside a mark drops 22% of nearby marks to the whole verse), DI-3 (merge can
leave two notebooks disagreeing forever about a trash record's words; reproduced by the
orchestrator, 133 of 20,000 simulated histories end diverged), DI-7 (joining highlights drops
labels; a split piece drops unknown fields), DI-8 (the clock clamp drops ordinary edits under
seconds of skew once sync exists), DI-10 (a trash record's held record is not checked, and
`store.undo` skips `planWrite`), DI-12 (an `exported` time with an offset makes Open fail).

**Data safety in the notebook:** DI-4 (backup cannot bring back later deletions; says "yours are
newer"), DI-5 (persistent storage is asked for once, ever), DI-9 (read-then-write in separate
transactions at BA13's unfixed sites), DI-11 (the IndexedDB upgrade handler is not
version-aware: the first `DB_VERSION` bump breaks every existing notebook).

**Security hardening:** SEC-2 (a 1,510-character share link freezes a tab for about 11 s through a
quadratic lookbehind in the scripture linker), SEC-4 (any site can open a print preview of all
the reader's notes with `?print=notes`, even with Hide my marks on), SEC-3, SEC-5, SEC-6, and
the CSP question (SEC Q1).

**Accessibility that needs real work:**
- Focus dropped to the page after a redraw: DK-3, DK-4, LV-1, NB-16, DK-13. One shared
  "restore focus after replaceChildren" helper fixes the class.
- Live regions that likely never announce: DK-2 (Search pane), GK-16, DK-14 (sheet autosave is
  chatty); landmark inflation DK-7.
- Language of parts: GK-2 (about 1.9 million Greek and 32,000 Hebrew characters in lexicon
  entries with no `lang`), GK-11.
- Forced colors: DK-6, GK-17 (both low confidence until emulated).
- Fonts: GK-3 (the text-critical signs have no patch under Atkinson or OpenDyslexic).
- NB-4 (no early keyboard route to the Notebook), NB-5 (undo bar after the footer; the
  announcement never mentions Ctrl+Z), NB-10, LV-2.

**Launch readiness:** LG-3 (the launch checklist, with file:line, is Appendix D inside Appendix
F), LG-1 (test the real `store.js` against `fake-indexeddb`; add a Playwright smoke test),
LG-2 (the privacy page omits `navigator.storage.persist()`, two meta values, the
BroadcastChannels and `history.state`), LG-4 (the sheet editor runs on 12 `document.execCommand`
calls with no replacement plan), LG-5 (where the Custom Highlight API is missing, Highlight is
still offered and never drawn), LG-7, LG-6 and LG-10 (bundle cost).

**Greek correctness:** GK-1 (the form button in a word's details searches a different word for
88 form/lemma pairs, 3,850 words; reproduced by the orchestrator), GK-9 (`/greek/*` has no cache
rule, so every shard revalidates), GK-4, GK-5, GK-6, GK-7, GK-15.

**Words that are now wrong:** CP-1 (and NB-6), CP-2, CP-3 (trash copy promises 30-day recovery
nobody can use), CP-4 (validator text shown in "Open a copy"), CP-5 (empty states never say how
to start), NB-7 (the help page never explains the basics).

### Tier 3: polish and nits

Everything else in the appendices: NB-8, NB-9, NB-11 to NB-19; DK-5 (autosave re-reads every
loaded chapter; filter the subscriptions), DK-8 to DK-12, DK-15, DK-16; GK-10 to GK-14, GK-18 to
GK-20; LG-6, LG-8, LG-9, LG-11 to LG-15; LV-3 to LV-5; CP-6 to CP-18; SEC "Improvements".

## Themes

- **A decision was made in one place and not carried to the others.** Phase 5 removed Close and
  moved the foot into Settings, but the tour, help, the notebook page's note and the Hide
  command still assume the old panel (NB-1, NB-6, CP-1). The Search pane copied the Greek
  choice buttons after Audit 1's forced-colors fix and did not copy the fix (DK-6). A prose
  rule ("held by test X") is usually true; the three that are not are in LG-8.
- **Redraw by replacing the DOM drops focus** (DK-3, DK-4, LV-1, NB-16, DK-13), the same bug
  class as Audit 1's BA21, in surfaces written since.
- **Rules that live in two places drift.** The record spec is implemented by the website and
  both apps; DI-1, DI-2, DI-3 and DI-8 all need a spec change and a version bump. Numbers in
  copy agree with their constants today (CP-16) but are typed twice.
- **The untested layer is exactly where Audit 1's data bugs were** (LG-1: `store.js`,
  transactions, `writeNow`, BroadcastChannel). The pure half is well covered.
- **"Never tested with a real assistive technology"** is the largest unknown (Not covered, below).

## Decisions needed from the owner

Collected from the appendices, de-duplicated. The first six block work.

1. **Hide my marks: close or minimize?** (NB-1, Appendix C Q2.) Minimizing still shows no notes. **Decided (BVJ, 2026-11-03): minimize.**
2. **Unsaved note words: warn, keep a draft, or both?** (NB-2, DI-6.) **Decided (BVJ, 2026-11-03): both.**
3. **Is it intended that the header's "Study Desk" no longer opens the panel on Study View?**
   (NB-4.) It decides whether a skip link, a toggle, or a key is the fix.
4. **Anchoring spec change** (DI-1, DI-2): should a mark that moves to another verse carry a
   notice? Should a single remaining occurrence need context? BDR must agree.
   **Decided (BVJ, 2026-11-03): the proposal as built in spec version 3 (#450); BDR to confirm in STUDY-DESK.md.**
5. **Enforce part of the CSP on the desk's pages before release?** (SEC Q1.) A path-scoped
   `connect-src 'self' ...; img-src 'self' data:` blocks SEC-1's fetch on its own. And should a
   record the website cannot edit still have the fields it draws checked? (SEC Q2.)
   **Enforcing the CSP: not yet (BVJ, 2026-11-03), so FA2-c isn't built.** Weighed then: it blocks
   `fetch` and image beacons on those three paths only, while chapter pages reach the same notebook,
   scripts still run and can navigate away, and a later outside connection (sync) would fail on
   deploy alone. SEC-1 itself is fixed. **SEC Q2 is still open.**
6. **Launch opt-out and browser floor.** Will a Settings switch ("Turn the Study Desk off") ship?
   Which browsers are in scope (Safari before 17.2 and Firefox before 140 draw no highlights)?
   (LG-3, LG-5, LG-7.)
7. Should a backup be able to bring back what was deleted since, on an explicit request? Or is
   the answer a trash view (E12)? Either way CP-3's copy must stop promising it. (DI-4, CP-3.)
8. Tombstones are kept forever, so a backup grows without bound. Intended? (DI Q4.)
9. Typed `ἡ`, `ἐξ`, `αὐτοῦ` give "or", "six" and a four-hit adverb. Should a typed form that
   is also another word's headword offer both? Is the article answer confirmed? Is a day of
   `max-age` acceptable for `/greek/*`? Has STEP confirmed no ShareAlike behind its shards?
   (GK Qs 1 to 5.) **Decided (BVJ, 2026-11-03):** a typed form that could be several words asks
   which (no breathing-mark rule, which couldn't be made consistent); a day of `max-age`. The article
   answer is confirmed too. STEP's provenance: the cautious route was taken (see Questions, 4); an email to STEP is still open.
10. Highlight tints are 1.05 to 1.23:1 against the cream page in light mode. Is that strength
    intended? (NB Q1.)
11. Terminology (CP-11, CP-7, CP-8): one name for the feature ("Study Desk"), Delete versus
    Remove, "my desk" versus "my notebook", the note icon named "Ribbon", "My Notes" in title
    case. Should the Greek search engine ride in every page's search bundle until launch?
    (LG-6, LV-4.)
12. Is "Duplicate sheet" planned? Should Search be easier to find (an "Add pane" menu)?
    Should a smaller layout offer undo before closing panes? (DK Qs, DK-9.)
13. Should real-browser tests (Playwright) be a launch gate? (LG Q4.)

## Status on main

Re-checked on 2026-11-03 against `main` at `9cc05f24`, because the audit ran on a snapshot 20 PRs
behind (#426 to #445 landed since; #446 and #447 after). Six agents read every finding against
the diff of those commits. Result: **96 still valid, 2 fixed, 2 moot, 10 changed, 1 unverified.**
A finding not named below is still valid as written (line numbers may have moved; use the symbol).

| ID | Status | What happened |
|---|---|---|
| SEC-1 | Fixed | #446: `chapterPath` and `isChapterAddress` guard every address built from a stored `bookKey`. No other path to an off-site address was found. The hardening items beside it are open (tasks c, h, n). |
| CP-2 | Fixed | #434 (Bookmarks): the ribbon paragraph and the Places and ribbons help section are gone. |
| CP-12 | Moot | #434 deleted `places.js` and `desk-places.mjs`. |
| LV-5 | Moot | #437 rebuilt the /desk header; `desk-ws__layout` is gone. |
| NB-6, CP-1 | Changed | #441 removed the "×" wording and the "Reset widths" step. "The foot of the panel" is still wrong at `desk-first-use.mjs:260`, `help.astro:53`, `notebook-page.js:130`. |
| NB-7 | Changed | The help page has a Bookmarks section and Ctrl+Z now. Still nothing on making notes or highlights, the tabs and Settings, or Hide my marks. |
| DI-4, CP-3 | Changed | #443 added a Trash you can restore from. The import summary still says "yours are newer" and does not point to it (`desk-export.mjs:795`); the trash copy still says "only a marker" and has no undo note. |
| DI-10 | Changed | Restore refuses a live id and runs `planWrite`, which blocks the audit's scenario. Open: the `deletedId` mismatch check, trash validation on import, `store.undo` skipping `planWrite`. |
| DK-13 | Changed | The Print case is gone (#436). The Layout window case remains. |
| LV-1 | Changed | The tour-end focus loss is fixed (#441). The Escape-in-note-editor loss remains. |
| CP-16 | Changed | The ribbon limit is gone; "six bookmarks" is still typed at `help.astro:101` (the limit is `MAX_FOLLOWING = 6`, `desk-bookmarks.mjs:42`). |
| LG-15 | Partly wrong | `TOUR_LINK` is used now. `sameLabelName` and two CSS classes (`desk.css:2604,2631`) are still dead. The four search exports were never dead: `searchbar.js` and `search.js` call them through `desk.x`, which the audit's graph script missed. |
| NB-14 | Unverified | Contrast ratios were not recomputed; nothing suggests the tints or numerals changed. |
| SEC-2 | Worse | #429 (E23) lengthened `QUALIFIER_BEHIND`: a 200 KB note now takes about 8.8 s, up from 2.0 s. A fix must cover the longest E23 phrase. |
| LG-12 | Worse | Root `CLAUDE.md` is 40,410 bytes against the 40,960 limit, so about 550 bytes of room. |
| LG-2 | Narrowed | `privacy.astro` now lists `lit-desk-follow`, `lit-desk-page-tour` and `lit-desk-greek-notes`; it still omits persist, `lastExport`, BroadcastChannel and `history.state`. |
| DK-5, DK-6 | Caveats | DK-5: the notes pane and the highlight and verse-label watchers now filter `place` and `bookmarkMove`, but `lit-records.js` and My Notes still subscribe to every write. DK-6: Stay here has a lock glyph (#431), so it is no longer color-only; the Search pane's chosen states still have no forced-colors rule. |

**New problems seen in the changed code** (found in passing, not hunted for; IDs `RC` for
"re-check"). Each is placed in a task below.

| ID | Where | What |
|---|---|---|
| RC-1 | `desk-records.mjs:228` | E12's Restore returns a newer-schema held record untouched, and `planWrite` does not check it (`validateRecord` stops at `canEdit`), so a record from an imported backup reaches the live set unchecked. #446's sink guards keep it from steering a fetch. |
| RC-2 | `desk-layout.mjs:281` | The new Reading arrangement closes every other pane with only "Layout: Reading." (DK-9's silent close, in a new place). |
| RC-3 | `desk-first-use.mjs:135` | The comment says the widths guidance is "in the help page"; `help.astro` has none, so it has no home. |
| RC-4 | `actions.js:322, 324` | A third wording for removing a highlight ("Highlight removed from X."), and the bar ("X highlighted yellow.") differs from the announcement (`desk-announce.mjs:24`, "Highlighted yellow: X.") for one event. CP-14 cites `desk-announce.mjs:186`, which does not exist; use the function name. |
| RC-5 | `test/desk-greek-notes.test.js:7` | Repeats LG-8's self-compare test, so `lit-desk-greek-notes` is protected only by hand. |
| RC-6 | `greek-builder.js` | #444's builder was not audited. It writes into the same search field, so GK-7 (a very long input) probably applies. |
| RC-7 | `desk-page.js:395, 489` | The Layout and Print windows are `role="dialog"` but not modal and have no focus trap; Escape works only while focus is inside (DK-13's pattern). |

## Work sessions

Proposed by Claude, 2026-11-03: a grouping of the open findings into tasks (**FA2-a** to
**FA2-z**) and the tasks into 11 sessions, not a decision. This replaces the earlier "Suggested
phases" (FA2-a to FA2-k), which the re-check made partly stale. Fixed and moot findings are left
out. Every other finding is in exactly one task.

**How the sessions were cut.** By the files they touch, so two sessions that run side by side do
not edit the same code; by the decisions that block them; and by whether the apps (BDR) must agree.
`desk-page.js` is touched by sessions 4 and 7; `panel.js` by 2 and 5; `store.js` by 6 and 9;
`search-core.js` by 8 and 9; `desk.css` by almost all of them (different regions; merge in
session order). Those pairs run one after the other.

**Order.**
- **Wave 1** (nothing here waits on another session): 2, 3, 4, then 1 and 8. Sessions 2, 3 and 4
  hold the Tier 1 items (NB-2, DI-1, DK-1); run those first. Sessions 1 and 8 are independent of
  everything and can run beside them.
- **Wave 2:** 5 (after 2), 6 (after 3), 7 (after 4).
- **Wave 3:** 9 (after 6 and 8), 10 (after 5 and 7), 11 (last, measure first).

How many run at once is BVJ's call; one at a time in the order 2, 3, 4, 1, 5, 6, 7, 8, 9, 10, 11
loses nothing.

### Session 1: Security residue

Independent. SEC-1 is done (#446). **FA2-a and FA2-b are done** (2026-11-03, branch `claude/audit2-session1`). FA2-c is held: decision 5's answer on the CSP is "not yet."

| Task | Findings | What |
|---|---|---|
| FA2-a | SEC-2 | Bound the `QUALIFIER_BEHIND` lookbehind in `scripture-refs.mjs` (shared by every reader, so run the rendered-output diff before and after, and cover E23's longest phrase). Add the tests the report names. |
| FA2-b | SEC-3, SEC-4, SEC-5 | Outside links in a sheet get `noopener noreferrer` and a new tab (`external-links.mjs`, `desk-sheet-format.mjs`); `?print=notes` needs a gesture and honors Hide my marks (`print-link.js`, `print-notes.js`); the Share dialog stops saying the link "never passes through a server" (`sheet-page.js`). |
| FA2-c | SEC Q1 | Enforce `connect-src 'self'` and `img-src 'self' data:` on `/desk/*`, `/sheets/*`, `/notebook/*` (`public/_headers`). **Not yet (BVJ, 2026-11-03; decision 5).** Edits the same file as FA2-u. |

### Session 2: A note is never lost (Tier 1)

Independent of everything else; session 5 builds on it. **Needs decisions 1 and 2.**

| Task | Findings | What |
|---|---|---|
| FA2-d | NB-2, DI-6, LV-1 | Guard `closePanel` and `showPanel` while a `stay` panel `changed()`; ask once; keep a `sessionStorage` draft; `beforeunload` while it holds words; return focus when the editor closes on Escape. Files: `note-editor.js`, `lit-panel.js`, `chapter-tools.js`. |
| FA2-e | NB-1, NB-15, NB-18 | Hide my marks minimizes instead of closing, or reopens on un-hide, and one visible reopen control stays (`panel.js`, `margin.js`, `SiteHeader.astro`); the Escape and undo wording and `aria-keyshortcuts` follow (`note-editor.js`, `actions.js`, `note-settings.js`). Retest the second Escape handler the Print menu added (`panel.js` near 500 to 535). |

### Session 3: Anchoring spec v3 (Tier 1, with BDR)

Independent. **Needs decision 4 and BDR's agreement**; the change is to the spec the apps copy.

| Task | Findings | What |
|---|---|---|
| FA2-f | DI-1 | Require the context floor for a single remaining occurrence too (`bestByContext` in `anchor-core.mjs`); for a `moved` across verses require both sides or raise a notice. Bump `ANCHOR_SPEC_VERSION` to 3, regenerate `test/fixtures/anchor-vectors.json` (`npm run build:anchor-vectors`), add the reword fuzz as a test, note it in STUDY-DESK.md "One notebook, three homes". |
| FA2-g | DI-2 | A typography-only change beside a mark must not drop it to the whole verse (`anchor-core.mjs`, `desk-change.mjs`). Same version bump, same vectors. |

### Session 4: Sheets and /desk (Tier 1)

Independent. Runs before session 7 (both edit `desk-page.js` and `sheet-pane.js`).

| Task | Findings | What |
|---|---|---|
| FA2-h | DK-1, plus SEC-1's second lock | A way for a keyboard-only reader to blank any word on a sheet (a word cursor, or a "choose words" mode with a button per word), in `sheet-lit.js`. In the same file, strip `img`, `script` and `on*` from imported chapter blocks before `importNode` (line 189). |
| FA2-i | DK-8 to DK-12, LV-3, RC-2 | Separator drag and keys; the silent close in `applyArrangement` and the new Reading arrangement (an announcement naming what closed, or undo before closing; decision 12); the fill-pane overflow; the second-tab layout write-back; the missing print rules for `.desk-ws`; the fallback row line. |

### Session 5: The Notebook panel follow-through

After session 2 (shares `panel.js`). **Needs decision 3** (FA2-k) and **decision 10** (NB-14).

**Status (2026-11-04, branch `claude/audit2-session5-notebook-panel`):** FA2-j, FA2-k and FA2-l are done. Decision 3 (BVJ, 2026-11-04): a second skip link, "Skip to the Notebook". Decision 10 (BVJ, 2026-11-04): keep the tints and draw highlighted text in the ink color. Two calls of Claude's, not BVJ's: the undo bar stays last in the page (the announcement names Ctrl+Z, ⌘Z on a Mac, which is the route a keyboard reader can use), and the persistence line stays in Settings, now drawn whenever Settings is selected, not on every tab. Contrast was not re-measured in a browser.

| Task | Findings | What |
|---|---|---|
| FA2-j | NB-3, NB-8, NB-11, NB-13, NB-17 | Four tabs fit the 280 to 350 px panel (`flex-wrap`, tighter padding or shorter labels, or a gear button; add the `data-font` allowance), plus the CSS and small layout items. Mostly `desk.css` and `panel.js`. |
| FA2-k | NB-4, NB-5, NB-9, NB-14 | An early keyboard route to the Notebook (a skip link, a toggle, or a key; decision 3); the undo bar placed where Tab reaches it, and an announcement that mentions Ctrl+Z; the persistence line on every tab; the highlight-tint contrast (decision 10). |
| FA2-l | NB-6, CP-1, NB-7, CP-3, CP-5, RC-3 | Finish what #441 started: fix "the foot of the panel" in three places; write the missing help sections (making notes and highlights, the tabs and Settings, Hide my marks, widths); the trash copy ("only a marker", the undo note); empty states that say how to start. |

### Session 6: Merge, import, store, trash (with BDR)

**Status (2026-11-04, branch `claude/audit2-session6-merge-store`):** FA2-m, FA2-n and FA2-o are done. Merge vectors are version 4 (three cases, two rule changes, for BDR to confirm, with the format's notes). Decision 7: E12's Trash exists, so the import summary points to it ("N deleted here since this copy was saved"), and no explicit "bring back" was built. **SEC Q2: option B (BVJ, 2026-11-04)**: a record the website can't edit is kept whatever its own fields hold, and the places that draw them check types (`glyph`, the print marks; `highlights.js` and `fillNoteWords` already did; `test/desk-hostile-records.test.js`). A trash record's held record is also checked for the fields every record carries (and its own, of a known kind) on import and in a restore. DI-5's button is built ("Ask this browser to keep it" in Settings, beside the silent day-later retry). DI-9's Keep now checks the record is unchanged rather than merging.

After session 3, so BDR gets one note covering both spec changes. **Needs decisions 5 (SEC Q2) and 7.**

| Task | Findings | What |
|---|---|---|
| FA2-m | DI-3, DI-7, DI-8, DI-12 | The shared record rules: converge on a trash record's words, keep labels when joining highlights and unknown fields when splitting, a clock clamp that survives skew, an `exported` time with an offset. New merge vectors; add `merge-sim.mjs` as a property test. |
| FA2-n | DI-4, DI-10, RC-1, SEC-6, NB-19 | Backup and trash safety: the import summary points to the Trash; check a trash record's held record (`deletedId`, fields) on import and in Restore, and run `planWrite` in `store.undo`; check the fields of a record `canEdit` refuses (decision 5, SEC Q2); size limits on a file's contents; "Saved <file>." only after the save happens. |
| FA2-o | DI-5, DI-9, DI-11, NB-12 | `store.js`: ask for persistent storage more than once; one transaction for each read-then-write; a version-aware upgrade handler (before the first `DB_VERSION` bump); the open-failure path. |

### Session 7: Focus, announcements, forced colors

After session 4 (shares `desk-page.js` and `sheet-pane.js`). Ends with a check by hand.

**Status (2026-11-04, branch `claude/audit2-session7-focus-announce`):** FA2-p, FA2-q and FA2-r are built and unit-suite green; none was run in a browser or with a screen reader. Calls of Claude's: the shared helper is `desk/focus-keep.js` (`redraw` by `data-focus-key`, plus `busy` for NB-16's `aria-disabled`); RC-7 keeps the Layout and Print windows as popups that close when focus leaves (BA63) rather than adding a trap, and Escape now also works from the title button (DK-13); the Search pane has one always-rendered live region (`sr-only`) in place of two hidden ones; Saving…/Saved is `aria-hidden` and only a failure is said; DK-16's `printHref` hardcoded `/` is left (a test pins it, and the site has no subpath).

| Task | Findings | What |
|---|---|---|
| FA2-p | DK-3, DK-4, NB-16, DK-13, RC-7 | One shared "restore focus after `replaceChildren`" helper, used by the sheet list, the Search pane, Pin and Unpin, and the Layout window; give the Layout and Print windows a trap or make them modal. |
| FA2-q | DK-2, DK-7, DK-14, DK-16, NB-10 | Live regions that probably never announce (the Search pane's status), the chatty autosave status, landmark inflation (the pane's accessible name got longer in #437), the present-mode clock, the destructive buttons' labels. |
| FA2-r | DK-6 | A forced-colors rule for the Search pane's choices and the Bible order toggle. Verify with emulation. |

**By hand, once, after this session:** NVDA, JAWS or VoiceOver on the desk (the audit never used
one; see "Not covered") and forced-colors emulation. Claude cannot do this; BVJ or a tester can.

### Session 8: Greek

Independent; can run beside any other session. Do GK-1 first, with a test over the committed data.

**Status (2026-11-03, branch `claude/audit2-session8-greek`):** FA2-s, FA2-t and FA2-u are done. GK-9's cache rule is `/greek/*` at a day of `max-age` with `must-revalidate` in `public/_headers` (BVJ, 2026-11-03: "add a day"), so after `build:greek` is re-run a returning reader may see the old files for up to 24 hours. Typed `ἡ`, `ἐξ` and `αὐτοῦ` (decision 9, first question) now ask which word: BVJ chose a clarifying question over a breathing-mark rule, 2026-11-03; the count was 58 spellings. The forced-colors, font and screen-reader items need a browser or a person to confirm.

| Task | Findings | What |
|---|---|---|
| FA2-s | GK-1, GK-4, GK-5, GK-6, GK-7, GK-8, GK-15, RC-6 | The form button searches the right word (88 form and lemma pairs); length rules agree between the tab and the search; the tokenizer; a long input (check `greek-builder.js` too); the insert-at-cursor joins; compatibility letters folded. |
| FA2-t | GK-2, GK-3, GK-11, GK-12, GK-16, GK-17, LV-2 | `lang` on the Greek and Hebrew inside lexicon entries (about 1.9 million and 32,000 characters); a patch for the text-critical signs under Atkinson and OpenDyslexic; the live-region and forced-colors items; the splitter's value. |
| FA2-u | GK-9, GK-13, GK-14, GK-18, GK-19 | A cache rule for `/greek/*` (decision 9); the credit line; the cached null in `search-core.js:1254`; the `NO_WORD` copy; the `>` prefix. Edits `public/_headers` along with FA2-c. |

### Session 9: Launch readiness and tests

After sessions 6 and 8 (`store.js`, `search-core.js`). **Needs decisions 6, 11 and 13.**

**Status (2026-11-04, branch `claude/audit2-session9-launch-tests`):** FA2-v, FA2-w and FA2-x are done except as noted. **Decisions (BVJ, 2026-11-04):** 6 is *no opt-out* (the desk isn't removable at launch; "they don't have to use it, and the only cost to them is that the notebook tab rides in the corner"), so `?desk=off` and `lit-desk-preview` retire with the flip, and a browser that can't draw highlights is offered no Highlight and says why; 11 is a lazy Greek search bundle, **not built** (see below); 13 is `fake-indexeddb` now, Playwright later and not a gate. Built: `test/desk-store.test.js` runs the real `store.js` (15 tests); `test/desk-storage-keys.test.js` reads `/privacy` against every storage key in `src/` and replaced the two self-compare tests (RC-5, LG-8); the wall-clock window is 10 minutes (LG-14); `/privacy` names the persistence request, `lastExport`, the tab messages and `history.state` (LG-2); `highlightsSupported()` (LG-5); the `:has()` hide rule split (LG-7); `deskEnabled()` is search's one read of the stamp (LG-3); the launch checklist and the `execCommand` decision (accept for version 1) are in the desk CLAUDE.md, "Launching" (LG-3, LG-4); the Greek build header names the repos and commits (LG-9); LG-11, LG-12 (root CLAUDE.md has about 1 KB of room, by moving the fonts bullet and the three desk routes out) and LG-15 (only `sameLabelName` and two CSS classes were dead; the other "dead exports" are used through the desk API objects). **Not built: LG-6 / LV-4.** `search-core.js` imports the Greek engine statically and `searchbar.js` and `search.js` call it synchronously, so loading it on demand is a refactor that needs a browser pass; the checklist item 11 holds it. Not done: LG-1's Playwright half (decision 13), deleting the history stand-in tests (they still pin the planners), and a Playwright-free import-graph test.

| Task | Findings | What |
|---|---|---|
| FA2-v | LG-1, LG-8, LG-14, RC-5 | Test the real `store.js` against `fake-indexeddb`; add a Playwright smoke test; replace the self-compare tests (including `desk-greek-notes.test.js:7`) with real ones; drop the wall-clock test. |
| FA2-w | LG-2, LG-3, LG-4, LG-5, LG-6, LV-4, LG-7 | `/privacy` lists persist, `lastExport`, BroadcastChannel and `history.state`; the launch checklist (Appendix F) done and `?desk=off` made to survive; a plan for the 12 `document.execCommand` calls; do not offer Highlight where the Custom Highlight API is missing; do not ship the Greek search engine in every page's bundle until launch; the `:has()` rule split from its list. |
| FA2-x | LG-9, LG-11, LG-12, LG-15 | Greek build header and licence text; the doc contradictions; make room in root `CLAUDE.md` (about 550 bytes left) by moving text to an area file, not by raising the limit; delete `sameLabelName` and the two dead CSS classes. |

### Session 10: Copy pass

After sessions 5 and 7, which edit the same strings. **Needs decision 11** (terminology).

| Task | Findings | What |
|---|---|---|
| FA2-y | CP-4, CP-6, CP-7, CP-8, CP-9, CP-10, CP-11, CP-13, CP-14, CP-15, CP-16, CP-17, CP-18, RC-4 | Every finding gives its replacement string. One name for the feature; Delete versus Remove; "my desk" versus "my notebook"; one wording each for highlighting and for removing a highlight, on the bar and in the announcement (name the function, not the line); `help.astro:101`'s "six bookmarks" read from the constant; validator text out of "Open a copy". |

### Session 11: Performance

Last; measure in a browser first and fix only what the numbers justify.

| Task | Findings | What |
|---|---|---|
| FA2-z | DK-5, DK-15, GK-10, GK-20, LG-10, LG-13 | Filter the remaining subscriptions (`lit-records.js`, My Notes); the LIT pane's fill; the Greek tab's arrow keys; one Greek data cache; the desk bundle a reader on a chapter pays for; the 3,397-function complexity map. |

Not in any session: the unaudited surfaces ("Not covered by this audit"), the apps' side of the
shared format, and decisions 8 (tombstones kept forever) and 12 (Duplicate sheet; Search easier to
find), which have no code until BVJ answers.

## What the orchestrator checked personally

- **DI-1**: re-ran `anchor-fuzz2.mjs`; the percentages match the report exactly, and the cause is
  in `anchor-core.mjs` (`bestByContext` applies the floor only when `starts.length > 1`).
- **DI-3**: re-ran `repro-merge.mjs`; X and Y still disagree after another exchange.
- **GK-1**: re-ran `formclick.mjs`; the clicked word's lemma is not among the results for the
  pairs listed (for example `Ὃ` goes to `ὁ`, `Ἐξ` to `ἕξ`).
- **SEC-1**: read the whole chain: `validateRecord` returns early at `desk-records.mjs:305`;
  `chapterHref` (`chapter-page.js:26`) and the `fetch` (`:122`) take `bookKey` unchecked;
  `readPassage` (`sheet-lit.js:123`) passes the stored module's value; `importNode` into the live
  document at `:189`; `readAll` (`sheet-copy.js:105`) has no guard between; the enforced CSP
  (`public/_headers:15`) has only `frame-ancestors`, `object-src`, `base-uri`, `form-action`,
  and the script and connect policy is report-only (`:34`). Re-ran the agent's repro: the record
  is stored and resolves to `https://attacker.example/x-1/`. **Not run:** the imported handler
  executing in a browser. It is standard DOM behavior, but unconfirmed.
- **LG-7**: read the rule; the `:has()` selector shares a list with the gate rule.
- **The live auditor** drove the dev server through 14 claims from the notebook and /desk reports:
  9 confirmed, 2 partly, 3 corrected (below).

## Corrections made by the live pass

- NB-1 happens for the H key only. Ticking "Hide my marks" in Settings leaves the panel open.
- NB-3 does not clip at 280px with Inter (it wraps); it clips with OpenDyslexic.
- NB-5: the undo bar is not the last child of `<body>`, but its Undo button is tab stop 216 of 231.
- DK-13 was not reproduced in the common case; DK-2 and DK-6 are partly confirmed (mechanism
  real, assistive-technology result untestable in the pane).

## What held up

- 2,708 tests pass (5.0 s); the desk, Greek and docs subset passes; 600 backtick tokens in the desk's
  CLAUDE.md resolve, and every "held by test/..." claim sampled is true.
- The gate: with the desk off, no `/greek/` request and no desk script or stylesheet, live and by
  import-graph (the Greek search code does ship, LG-6, LV-4).
- The sanitizer (90 payloads), `noteBodyHtml` (15), share-link decoding (decompression bomb,
  depth, `__proto__`), the hostile-import path, escaping in every Greek readback (60,000 queries).
- Greek data: all 260 chapters, NFC, every lemma resolving; search agreed with a brute-force
  matcher on 20,000 cases.
- Store atomicity, history, ribbons, Markdown escaping (200,000 random strings), scale at 27,700
  records (nothing quadratic).
- Keyboard and structure: a real tablist, separators with `aria-valuenow`, menus with focus return,
  present mode with `inert` and a dialog role, pane and sheet reordering by keys.
- Copy: no em dash and no British spelling except "tick"; curly quotes throughout; every number in
  copy matches its constant. Contrast: the computed text pairs clear 4.5:1 except NB-14 (green
  numerals inside a highlight) and one sheets-editor placeholder at 4.48:1.
- CSS: dark-mode pairs guarded and identical, no `ch` unit in desk text columns, 650 classes with
  two dead.

## Not covered by this audit

- **No screen reader** (NVDA, JAWS, VoiceOver, TalkBack) was used, so every announcement finding
  is a code read. **Forced colors, Safari, Firefox, touch screens, 400% zoom, a real print dialog,
  two screens, and the deployed analytics beacon** were not run. The live pass was Chromium in the
  built-in browser, in dev mode (unminified).
- The final step of SEC-1 (the injected handler running) and SEC-4 (whether each browser prints
  without a gesture).
- No `dist/` build was made, so bundle sizes are a rolldown proxy.
- The apps' side of the shared format, and phones and tablets (desktop-only by decision).

## Method

Eight read-only auditors, never more than one Opus and three Sonnet at a time. Opus took the two
slices that need reasoning to a counterexample (the merge and anchoring rules; the trust
boundaries). Sonnet took the broad reading and measuring slices. All were given the same brief
(Appendix I): read the relevant rules of `src/scripts/desk/CLAUDE.md`; treat marked owner
decisions as deliberate; grep Audit 1 before reporting; look first at the 19 commits since
2026-10-28; verify by running scripts against the real modules where possible. Their throwaway
scripts (merge fuzzing, anchor fuzzing, contrast, Greek integrity and escaping fuzz, sanitizer
payloads, import-graph and coverage maps) are in the session scratchpad and are worth keeping:
LG's report suggests committing four as `scripts/audit-desk-*.mjs`. Two sessions were cut off by
API rate limits and resumed with their work intact.

The eight reports follow in full, with heading levels shifted down so they nest under their
appendix. A line beginning "Live check" or "Re-run" was added after the fact; everything else is
the auditor's own text.

## Appendix A: Security (`SEC`, Opus)

Auditor: security slice. Branch `claude/phase5-work-sessions` (a57e155d), 2026-11-03.
Read-only; no browser, no dev server. Throwaway scripts used as evidence are in
`C:\Users\bcjoh\AppData\Local\Temp\claude\C--Users-bcjoh-GitHub-litbible\ad56297a-c1ae-439b-986a-dac3ca218054\scratchpad\sec\`
(`newer-sheet.mjs`, `sanitizer.mjs`, `notes.mjs`, `redos.mjs`, `scale.mjs`, `share-dos.mjs`, `deep.mjs`, `bigimport.mjs`).

### Summary

The desk's own HTML handling is in good shape: every sheet-text path goes through the sanitizer, the sanitizer and `noteBodyHtml` survived 105 hostile inputs with no markup or script getting through, share links refuse newer formats and decompression bombs, no window `message` listener exists, and nothing in the desk loads a third-party resource. BA66's fix holds for a sheet's formatted text. **But BA66's root cause is still open by another field**: a record this code "can't edit" (newer `sheetFormat` or `schema`) skips every field check, and a sheet passage's `bookKey` is turned straight into a fetch URL. A backup file can therefore point the desk at the attacker's server and get that server's HTML imported into the page (SEC-1, script injection). The second real problem is a quadratic regex in the scripture linker that lets a 1.5 KB share link freeze a tab for about 11 s (SEC-2). Since the CSP is report-only, any injection has free exfiltration; enforcing `connect-src` on the desk's pages alone would have blocked SEC-1 (a question for the owner, since report-only is a deliberate decision).

Counts: **Critical 1, High 0, Medium 1, Low 4, Nit 0** (6 findings).

### Findings

#### SEC-1 · Critical · security · NEW (an unfixed path of the BA66 class)

> **Status (2026-11-03, main `9cc05f24`):** Fixed by #446. The sink guard is complete; the four hardening items under it are open (FA2-c, FA2-h, FA2-n).

> **Checked by the orchestrator:** the code chain was read end to end (`desk-records.mjs:305`, `chapter-page.js:26` and `:122`, `sheet-lit.js:123` and `:189`, `sheet-copy.js:105`) and the agent’s repro re-run: the record is stored and resolves off-site. No guard exists between the stored module and the fetch, and the enforced CSP (`public/_headers:15`) does not restrict scripts or connections. The imported handler running in a browser was not tried.

**A backup file can plant a sheet whose passage makes the desk fetch HTML from the attacker's server and put it into the page, so the attacker's script runs on litbible.net.**

- **Where**: `src/lib/desk-records.mjs:305` (`validateRecord` returns before any field check when `!canEdit(r)`: a sheet with `sheetFormat` 2, or any record with `schema` 2); `src/lib/desk-export.mjs:688-690` (`planImport` keeps it; `cleanIncoming` sanitizes only the formatted `html`/`answer` fields, BA66's fix); `src/scripts/desk/chapter-page.js:26` (`chapterHref = \`${BASE}${bookKey}-${chapter}/\``, no check of `bookKey`) and `:122` (`fetch`); `src/scripts/desk/sheet-lit.js:123` (`readPassage` loads the chapter the module names) and `:189` (`words.append(document.importNode(b, true))`: the fetched page's blocks go into the live document). Reached from `/sheets/?id=` (`sheet-copy.js:105` `readAll`, `:137`), from the Sheet pane on /desk, read only included (`sheet-pane.js:836` → `sheet-lit.js:340-351`), and from present mode (`presentPassage`).
- **Attack scenario**: the attacker (anyone; say "a fellow study leader") sends a notebook backup (`.json`; a Web Annotation file's `lit.record` is read the same way, `desk-export.mjs:592`) with one sheet, `"sheetFormat": 2`, whose passage module has `"bookKey": "/attacker.example/x"`. The victim opens it with "Open a copy" on /notebook/ (the summary says only "1 new."), then opens the sheet from My sheets or on /desk, or follows `https://litbible.net/desk/?sheet=<id>`: the attacker chose the id and import keeps it, and `?sheet=` saves a Sheet pane for it into `lit-desk-layout` (`desk-page.js:1016-1029`), so from then on **every visit to /desk** draws it again. The page fetches `//attacker.example/x-1/`, which resolves to `https://attacker.example/x-1/`. The attacker's server answers with a copy of any real chapter page (`.chapter-paragraphs`, verse 1) carrying `<img src=x onerror=…>`, and `Access-Control-Allow-Origin: *`. `passageWords` imports those blocks into the live document, the image fails, and the handler runs on litbible.net's origin. **Gain**: every note, highlight, bookmark and sheet in IndexedDB, read and sent anywhere (the CSP's `connect-src` is report-only), or rewritten or deleted; it fires again each time, and the server decides when to serve the payload. Even with no CORS header the request goes out, so the attacker learns the victim's IP address, browser and when they opened the sheet.
- **Evidence**: `sec\newer-sheet.mjs` runs the real `parseImport` and `planImport`. A `sheetFormat: 2` sheet and a `schema: 2` sheet, each with that `bookKey` and a text part `<p>hello <img src=x onerror=alert(1)></p>`, are both kept ("stored? true"); the `html` comes out sanitized (`<p>hello</p>`, so BA66's fix holds) and the `bookKey` untouched. `chapterHref` gives `//attacker.example/x-1/`, which `new URL(…, "https://litbible.net/sheets/?id=…")` resolves to `https://attacker.example/x-1/`. The same sheet at `sheetFormat: 1` is refused (`bookKey "/attacker.example/x" is not a book`). The last step (an `<img onerror>` imported from a DOMParser document into the live one starts loading and runs its handler) is standard DOM behavior; it was not run here, since this audit drives no browser.
- **Same root, smaller effect**: a record of any kind with `schema: 2` skips every check, so `recordHref` (`src/lib/desk-store-core.mjs:342-349`) builds `//evil.example/john-3/#v16` for a note with `bookKey: "/evil.example/john"`, and What I've kept, My Notes, Places and the notebook search draw it as an ordinary reference link that leaves the site (reproduced: "1 new. href: //evil.example/john-3/#v16", shown as "/evil.example/john 3:16"). Trash records in a file are not validated at all (`desk-export.mjs:688`, `m.kind !== "trash"`), so whatever a trash record holds is unchecked if it is ever restored (only this tab's own deletions can be undone today, so this is latent). Sync from the apps (STUDY-DESK.md phase 4) will deliver newer-schema records as a matter of course, so this stops being a "someone sent me a file" case.
- **Fix**: guard the sink, then the record. (1) `chapterHref`, `recordHref` and `readHref` refuse a `bookKey` that is not `Object.hasOwn(BOOKS, key)` and a chapter that is not an integer in range (return null; `loadChapterPage` rejects), so no stored value can ever form a URL off the site. (2) `validateRecord` checks the fields the website itself turns into URLs or fetches (`bookKey`, `chapter`, `verse`, `endVerse`, and each passage module's) even when it can't edit the record: "carried untouched" need not mean "trusted to draw." (3) In `passageWords`, import the fetched blocks with `img`, `script`, `iframe`, `on*` attributes and non-local `href`/`src` removed, as a third lock (chapter pages carry none). (4) Validate the record inside an incoming trash record as an incoming live record is. (5) Enforce `connect-src` on the desk's pages (Questions, Q1), which alone blocks the fetch.
- **Check**: a test that `planImport` of a `sheetFormat: 2` sheet with `bookKey: "/x.example/y"` either refuses it or stores it so that `chapterHref` gives null; a `recordHref` test for a `schema: 2` note with that key.
- **Confidence**: High for the stored record and the off-site fetch (reproduced). The script-execution step follows from documented DOM behavior; to confirm, serve a CORS page from a second local origin and open the sheet in a browser.

#### SEC-2 · Medium · security · NEW (BA95's fix bounded one lookbehind, not this one)

> **Fixed in FA2-a (2026-11-03, branch claude/audit2-session1):** the test reads back at most `QUALIFIER_REACH` (256 characters, E23's longest phrase with every whitespace run at its longest; 209 today). `noteBodyHtml` of 400 KB of `LXX Ps 51:4 ` takes 80 ms, and the 480 KB sheet 120 ms in `sheetHtmlForShow`. A rendered diff of all 354 built pages, before and after, shows no change. **Found while fixing it, and worse than the finding:** eleven patterns in `scripture-refs.mjs` listed `\u00a0` beside `\s`, which already holds it, so each nonbreaking space in a run could match two ways and the failing case doubled per character (26 of them took 1.3 s, so a few dozen in a note would hang the tab outright). They list it no longer; behavior is the same, and a test holds it.

**Denial of service: a 1,510-character share link freezes the tab for about 11 seconds each time the sheet is drawn.**

- **Where**: `src/lib/scripture-refs.mjs:339` runs `QUALIFIER_BEHIND.test(text.slice(0, m.index))` (`:181`, `/(?:LXX|MT|Septuagint|Masoretic)(?:\s|\u00a0|&nbsp;)*$/`) for every outbound reference (Hebrew Bible or apocrypha), scanning the whole text before it each time, so the cost is quadratic in the text's length. Reached by `sheetHtmlForShow` (`desk-sheet-copy.mjs:128-130`) for every text and question part, and by `noteBodyHtml` (`desk-chains.mjs:60`) for every note. The build-time linker (footnotes, intros) shares it, but that text is the owner's.
- **Attack scenario**: an attacker sends a share link (or `.lit-sheet.md` file) for a sheet whose one text part is `LXX Ps 51:4` repeated to about 480 KB. It compresses to a 1,510-character link, which looks like any other. Opening it on /sheets/ freezes the tab for about 11 s; choosing the other copy or reloading does it again (the sheet stays in `history.state`). Copied into the desk, it does the same on /desk and in present mode. A note imported from a backup does it in the margin and the Notebook, which redraw often. **Gain**: nuisance only; nothing is read or lost.
- **Evidence**: `sec\scale.mjs`: `noteBodyHtml` of "LXX Ps 51:4 " repeated takes 138 ms at 50 KB, 517 ms at 100 KB, 2,021 ms at 200 KB and 8,861 ms at 400 KB (twice the length, four times the time); "Sirach 24 " and "Psalm 22:1 MT " behave the same. `sec\share-dos.mjs`: the 480 KB sheet is in canonical form (passes `validateSheet`), `shareFragment` makes a 1,510-character link, `openShare` takes 12 ms and one `sheetHtmlForShow` 11,290 ms. The regex alone costs 0.26 ms per call on 200 KB, times about 16,000 references.
- **Fix**: test the qualifier on a bounded window, `QUALIFIER_BEHIND.test(text.slice(Math.max(0, m.index - 40), m.index))` (a qualifier plus four spaces fits), as BA95 bounded `SP_BEHIND`. Consider a length cap on a note's body (there is none; see SEC-6).
- **Check**: `noteBodyHtml("LXX Ps 51:4 ".repeat(40000))` under 100 ms, in `test/scripture-refs.test.js`.
- **Confidence**: High (reproduced).

#### SEC-3 · Low · security · NEW

> **Fixed in FA2-b (2026-11-03, branch claude/audit2-session1):** `isExternalHref` reads an address with `new URL` as a browser would on this site, so all four open in a new tab with `noopener noreferrer`. `cleanHref` and the format are unchanged (the sanitized form is shared with the apps). `https:evil.example` with one scheme and no slashes is a path on this site, as a browser reads it there.

**Four spellings of an outside link in a sheet open in the same tab, without `noopener noreferrer`.**

- **Where**: `src/lib/external-links.mjs:26-30` (`isExternalHref` requires `//` after the scheme and takes the host up to the first `:`); the sanitizer's `cleanHref` (`src/lib/desk-sheet-format.mjs:290-297`) accepts anything starting `http:` or `https:`.
- **Attack scenario**: a shared sheet's text holds `<a href="https:\\evil.example/">`, `http:evil.example`, `https:/\evil.example/` or `https://litbible.net:443@evil.example/`. Browsers read all four as an address on evil.example, but `openExternalLinks` takes them for links on the site, so they open in the same tab, against the site's rule that outside links open in a new tab with `rel="noopener noreferrer"`; the last also reads as litbible.net at a glance. **Gain**: small: a same-tab trip to the attacker's page. `Referrer-Policy: strict-origin-when-cross-origin` already limits the referrer to the origin, so no sheet id leaks.
- **Evidence**: `sec\sanitizer.mjs` (90 hostile cases through `sanitizeSheetHtml`, `pastedSheetHtml`, `sheetHtmlForShow` and the last two chained, each parsed back with parse5 and every `href` resolved with WHATWG `URL`): these four are the only issues, flagged `EXTERNAL-NO-TARGET`.
- **Fix**: decide "external" by parsing, `new URL(href, "https://litbible.net/")`, and comparing `hostname`; or have `cleanHref` keep only `https?://` followed by a host, rewriting `\` to `/` as browsers do.
- **Confidence**: High (reproduced).

#### SEC-4 · Low · security · NEW

> **Fixed in FA2-b (2026-11-03, branch claude/audit2-session1):** only a press of the Print menu prints: it leaves a one-time mark for that address (`lit-desk-print-ask`, good for a minute, named in /privacy), so any other link just opens the chapter. With notes, the tab says why it didn't print while "Hide my marks" is on. The referrer check the fix first suggests was tried and dropped: the referrer can be stripped, which would stop the menu printing with no word why, and a link in a shared sheet on /desk would carry one. Prints the reader starts on the page itself still ignore the switches, by design.

**Privacy: any site can open a reader's print dialog with all their notes in it, even while "Hide my marks" is on.**

- **Where**: `src/scripts/desk/print-link.js:16-41` acts on `?print=notes` from any source; `src/scripts/desk/print-notes.js:36-40, 243` ignores the screen switches, "Hide my marks" included, by design for a print the reader asked for. The parameter came with /desk's Print menu (7529b0a9, after the prior audit).
- **Attack scenario**: a study leader is sharing their screen on a call with "Hide my marks" on (M1 exists for that). Someone posts `https://litbible.net/read/romans/?print=notes` in the chat ("here's the passage"); the leader clicks it. The tab opens straight into a print preview of Romans with every one of the leader's notes and highlights in the book typeset beside the text, on the shared screen. **Gain**: the participants read the leader's private notes. No click inside litbible.net is needed; the link alone does it.
- **Evidence**: read: `initPrintLink` runs on every Study View and Read View page with the desk on (`shell.js:168`), strips the parameter and calls `printNotes.print()` on `load` with no check of where the request came from; `can()` (`print-notes.js:243`) only asks whether the page has a text column. The Print menu's links carry `rel="noopener"` only (`desk-page.js:405-408`), so a same-origin `document.referrer` is available to check.
- **Fix**: act on `?print=` only when `document.referrer` is this origin's `/desk/` (or carry a one-time token the Print menu writes), and for `notes`, stand down while "Hide my marks" is on; strip the parameter either way, as now.
- **Confidence**: Medium (code read; whether each browser allows `window.print()` with no user gesture on load was not tried here; Chromium and Firefox generally do).

#### SEC-5 · Low · security · NEW

> **Fixed in FA2-b (2026-11-03, branch claude/audit2-session1):** the dialog says litbible.net never sees or stores the link, and that any service carrying it can read it. Claude's copy, not the owner's.

**Privacy: the Share dialog promises the link "never passes through a server," which isn't true of the services that carry it.**

- **Where**: `src/scripts/desk/sheet-page.js:496-500` ("The link holds the sheet itself, so it never passes through a server and nothing is stored.").
- **Attack scenario**: no attacker; a leader shares "Everything, for another leader" (answers and Leader only parts) by email, trusting the promise. The whole sheet is in the link, so the email provider stores it, a link scanner such as Outlook Safe Links rewrites the full address (fragment included) into its own URL and sends it to its servers on click, a messaging app's link preview may fetch it, and the browser's synced history keeps the original address with its fragment. What is true is narrower: litbible.net never receives it (the inline script in `sheets.astro:43-62` holds that, re-checked below).
- **Fix**: say what holds: "The link holds the sheet itself, so litbible.net never sees or stores it. Anyone who has the link, and any service that carries it, can read the sheet, so send the participant copy when you're unsure." (Claude's copy, not the owner's; no em dashes.)
- **Confidence**: High (the copy is as quoted; the carrier behavior is how those services work).

#### SEC-6 · Low · security · NEW

**Denial of service and storage: nothing limits the size of what a file brings in, so one record can slow the notebook for good.**

- **Where**: `src/scripts/desk/export-import.js:155` (`chosen.text()` of any file, no size check); `src/lib/desk-records.mjs:328-329` (a note's `body` is any string, no length cap; only sheets have one, 512 KB). The BA95 entry already noted "Notes have no length cap."
- **Attack scenario**: a backup someone sends holds one note on John 3 whose body is 50 MB. Opening the copy works ("1 new"), and from then on every draw of that note (the margin on John 3, My Notes, the notebook page) spends about 4.3 s in `noteBodyHtml` alone, plus the IndexedDB space; with SEC-2's pattern in it, minutes. The reader has to find and delete the note. **Gain**: nuisance.
- **Evidence**: `sec\bigimport.mjs`: an 82.7 MB backup of 150,000 notes plans in 535 ms ("150000 new."); a 51.3 MB backup with one 50 MB note plans in 24 ms ("1 new."), and `noteBodyHtml` of that note takes 4,308 ms.
- **Fix**: a body cap in `validateRecord` (say 64 KB, far beyond a margin note, with a clear "too long to keep" reason in the import summary), and a file-size check before `text()` (say 50 MB) with a sentence saying why.
- **Confidence**: High (reproduced).

### Sink table

Every DOM, URL, navigation, message and code sink in the desk's code and the shared modules named in the task, with what can reach it.

| Sink | Where | What reaches it | Verdict |
|---|---|---|---|
| `innerHTML` of a sheet's text | `sheet-copy.js:51` (`rich`: /sheets/ copies, present mode, presenter notes), `sheet-pane.js:890` (read-only sheets) | stored `html`/`answer` (import, share, sync) | Safe: `sheetHtmlForShow` (sanitize, then link, then new-tab) |
| editor load and save | `sheet-text.js:182, 200, 231` | stored html; the editable's own HTML | Safe: `sanitizeSheetHtml` both ways |
| paste and drop | `sheet-text.js:1011-1054` (`insertHTML`) | clipboard or dragged HTML from any page | Safe: `pastedSheetHtml`, files refused |
| link form | `sheet-text.js:88-96, 593-599` | typed address | Safe: allowlist, `escAttr`/`escText` |
| a note's words | `note-words.js:28` (`noteBodyHtml`) | note bodies (import, sync) | Safe: escaped, then the linker; 15 hostile bodies, nothing but `a.sref`/outbound links |
| marker glyph | `glyphs.js:28` via `notes-margin.js:431, 471, 621`, `record-rows.js:105`, `footnote-notes.js:187`, `change-notice.js:334`, `print-notes.js:188` | `record.marker` (unchecked on newer schema) | Safe: lookup table; a prototype name gives native-function text, no markup (see Improvements) |
| templates with `${…}` | `footnote-notes.js:201`, `notes-margin.js:437, 621, 640`, `note-editor.js:91`, `ribbon-form.js:74`, `labels-ui.js:42`, `panel.js:232`, `passage-bar.js:35`, `kept-list.js:49`, `tab-*.js`, `desk-page.js`, `note-settings.js` | references, quotes and labels through `escapeHtml`; ids (`n`, `idSuffix`, pane ids checked by BA59) | Safe: every reader string is escaped or set as `textContent` afterwards |
| Greek readback | `greek-find.js:376`, `search-pane.js:913`, also `search.js:1074`, `searchbar.js:626` | the typed query, resolved against the index | Safe: `describeGreekQuery` passes every piece through `text`/`greek` (escapers); `gap` is a `Number` |
| verse hit | `search-pane.js:605` | verse index text, query runs | Safe: `highlightVerseHit` escapes |
| QR code | `sheet-copy.js:306`, `sheet-page.js:534` (`data:` image) | chapter URL and label | Safe: `escapeXml` in `qr-svg.mjs` |
| lexicon HTML | `tab-greek.js:86-119` | built `public/greek/` data | Safe: inert `template`, rebuilt from an allowlist |
| DOMParser + import of a fetched page | `chapter-page.js:128` → `sheet-lit.js:189` | **the page at `chapterHref(bookKey)`** | **SEC-1**: `bookKey` unchecked for newer-format or newer-schema records |
| DOMParser + import, other | `search-pane.js:141, 765` (/glossary/), LIT pane, Footnotes and This verse panes | fixed same-origin URLs; places checked by `checkPassage` and the corpus | Safe |
| `fetch` | `chapter-page.js:122` | see above | **SEC-1** |
| `fetch`, other | `greek-data.js`, `release-feed.js`, `change-notice.js:244`, `search-pane.js:135`, `search-sheet.js:101`, `search-core.js`, `ref-preview.js:68` | fixed paths, or keys from site data or `HREF_RE` (`[0-9a-z]+`) | Safe: same origin only |
| `a.href` from a record | `record-rows.js:81`, `tab-mine.js:448, 492, 543, 582`, `places.js:143`, `notebook-search.js:160, 227`, `tab-verse.js:217` (`recordHref`) | record `bookKey`/`chapter` | Low, part of SEC-1: off-site for newer-schema records; never `javascript:` (always starts with `/`) |
| `a.href`, sanitized sheet links | `cleanHref` | sheet text | Safe scheme-wise (http, https, mailto, `/` path); SEC-3 for the new-tab rule |
| `a.href`, other | `whats-new.js:81, 98, 105` (release feed), `search-pane.js`, `sheet-page.js`, `sheet-pane.js:560, 565`, `search-sheet.js:428`, `desk-page.js:436` (`printHref` from a checked place), `sheet-share-gate.js:51` (fragment only) | site data, `encodeURIComponent(id)` | Safe |
| `target="_blank"` | `search-pane.js:121`, `tab-greek.js:451` (`noopener noreferrer`); `sheet-lit.js:756, 881, 951`, `desk-page.js:405-408` (`noopener`, same origin); `sheet-pane.js:561, 566` (same origin, no `rel`) | | Safe: same-origin openers only; outside links carry both |
| `window.open` | `sheet-present.js:567` | same-origin presenter URL | Safe |
| `window.print` | `print-link.js:24-40` | `?print=` from any link | **SEC-4** |
| `location.replace`/`reload`, `history.replaceState` | `sheets.astro:48-57`, `sheet-page.js:209, 361, 469`, `desk-page.js:1019`, `greek-link.js:26`, `print-link.js:21`, `tour.js:700` | same-origin paths | Safe |
| BroadcastChannel | `store.js:126-131` (`lit-desk`), `ribbon-follow.js:136-146` (`lit-desk-ribbon-tab`), `sheet-present.js:279` (`lit-present:<id>`) | same-origin tabs only | Safe: ids and kinds lead to re-reads from IndexedDB, never a write or markup; present messages checked by `presentMessage` and `checkState`; the ribbon channel can only drop a flag |
| `window` `message` | none in `src/` | | Nothing for another origin to talk to |
| `import()` | `desk-gate.js:34-53`, `search-core.js:1141` (`${base}pagefind/…`, build constant), `:1254, 1272` | literals | Safe |
| `eval`, `new Function`, string timers, `srcdoc`, `document.write`, `setAttribute('style'|'on*')` | none in the desk | | |

### Improvements

- **Look up markers with `Object.hasOwn`** in `glyph` (`glyphs.js:28`) and `MARKER_NAMES` (`print-notes.js:208`): a newer-schema note with marker `constructor` draws a blank glyph and prints "function Object() { [native code] }" as its marker name. Harmless, but one line.
- **Show an outside link's host in a shared sheet that hasn't been copied yet** (or draw its links as text until "Copy into my desk"): a `#share1.` link shows anyone's words on litbible.net's own address, under the site's header. Today that's spoofing with no account to steal; once sign-in arrives (phase 4) it is a credible phishing page.
- **Add `Cross-Origin-Opener-Policy: same-origin-allow-popups`** site-wide: a page that opened litbible.net with `window.open` keeps a handle to it and can later navigate the reader's /desk tab elsewhere (tab-nabbing). The presenter window is same-origin, so it keeps working.
- **Strip `?q=` from /notebook/'s address after reading it** (`notebook-page.js:390-391`), as `?sheet=`, `?greek=` and `?print=` are stripped, so a reader's notebook search words aren't left in the history entry or the analytics' page URL.
- **"Empty the trash now" is for a shared computer** (`notebook-page.js:137`): IndexedDB's files can keep deleted values on disk until the browser compacts them, so "Wipes the words … at once" is true of the notebook, not of the disk. Saying "from the notebook" would be exact.

### Questions for the owner

- **Q1. Enforce at least part of the CSP on the desk's pages before the desk is public, not at phase 4?** The report-only split (F2, 2026-07-10) rests on "a static site with no secrets," and the CLAUDE.md note says to revisit it when the site gains accounts. Once the desk ships, every reader's private notes sit in IndexedDB on this origin, so any injection (SEC-1, or a future sanitizer slip) can read and send them with nothing in the way. A path-scoped header is additive on Cloudflare Pages (both policies apply) and can't break the site's widgets elsewhere, e.g. for `/desk/*`, `/sheets/*` and `/notebook/*`: `Content-Security-Policy: connect-src 'self' https://cloudflareinsights.com https://sibforms.com https://*.sibforms.com; img-src 'self' data:` (verify against the report-only console first). That alone blocks SEC-1's fetch and image-beacon exfiltration. Stopping injected handlers (`onerror=`) needs `script-src` without `'unsafe-inline'`, which means hashes for the inline scripts (`Layout.astro:78, 81, 93, 121`, `sheets.astro:35`, the footer's); Astro 7.4.4 has `security.csp`, which hashes what it renders, and the desk's injected `<style>` would need its hash added. Note the report-only header has no `report-to`, so the "telemetry" it names reaches only a visitor's own console.
- **Q2. Should a record the website can't edit still be checked for the fields it draws?** Principle 6 ("carried untouched") is the reason `validateRecord` stops early; SEC-1 suggests checking, not changing, the location fields the website turns into URLs. That also sets the rule BDR's sync will need.
- **Q3. Does Cloudflare Web Analytics keep query strings?** `/sheets/?id=<uuid>` stays in the address while a sheet is shown, and `/desk/?sheet=` may be read before the desk strips it. The ids are random, so nothing of the sheet leaks, but if the dashboard keeps them they are per-reader identifiers in someone else's logs.

### What held up

- **The sanitizer** (`sanitizeSheetHtml`, `pastedSheetHtml`, `sheetHtmlForShow`), 90 hostile cases (`sec\sanitizer.mjs`), each output parsed back with parse5: script, `img onerror`, svg, math and namespace confusion, `noscript`/`style`/`title`/`textarea`/`xmp`/`iframe`/`noembed`/`noframes`/`plaintext`/`listing`/`select`/`template` mutation tricks, `javascript:`/`data:`/`vbscript:` with tabs, newlines, control characters, entities (`&#x09;`, `&Tab;`, `&NewLine;`, `&colon;`, `&#58;`) and case, protocol-relative and backslash paths (`//`, `/\`, `\\`, `/\t/`), `style` with `url()` and `expression()`, `base`, `form`, `meta refresh`, `srcdoc`, `svg use href`, `ping`, `download`, attribute breakouts with `&quot;`, comment and doctype tricks, the linker's private-use markers, `<em>Sirach</em>`, 5,000-deep nesting and a 200,000-character attribute. No element outside the format's set, no attribute but `href`/`data-*`/`class`/`target`/`rel`, no scheme but http, https and mailto, idempotent throughout, none over 200 ms. Only SEC-3's four spellings showed.
- **Every path that shows a sheet's words** uses `sheetHtmlForShow` or the sanitizer: the Sheet pane (editable and read only), /sheets/ copies, present mode and the presenter's notes, Copy for Word (which reads the drawn copy and escapes again, `sheet-word.js:25-26`), the share file's readable half (strips tags; its author controls the file anyway), and the title and subtitle, which are only ever `textContent` or `document.title`. The notebook search doesn't index sheets.
- **`noteBodyHtml`**: 15 hostile bodies (`sec\notes.mjs`) gave only `a.sref` and outbound links to `/…`, Sefaria and eBible.
- **The share decoder**: `fromBase64Url` refuses anything outside base64url; `inflate` counts while streaming and cancels past 1 MB; a module nested 200,000 deep is refused in 6 ms (`jsonBytes` catches the stack overflow); `__proto__` in a module or the sheet pollutes nothing; newer formats are refused; `copyOfShared` gives fresh ids. `fragmentInFile` takes the last data line, and 5 MB of crafted data lines scan in under 50 ms.
- **Import**: a record nested past 64 is skipped in 15 ms; 150,000 records plan in about half a second; ids of another kind are refused (rule 9); BA66's sanitizing of formatted text holds for newer formats and for sheets inside trash.
- **The fragment defence** (`sheets.astro:43-62`): it runs while the page parses, before Cloudflare's deferred beacon; listens on `popstate` and `hashchange` (BA78), reloads at most once, and rebuilds links from `history.state` (`sheet-share-gate.js`). Fragments are never in a `Referer`, and speculation-rule prefetches don't carry them. (BA78's deployed-site check was not repeated; no browser.)
- **Other origins**: there is no `window` `message` listener anywhere in `src/`, every BroadcastChannel is same-origin and leads to re-reads rather than writes, and `X-Frame-Options: DENY` plus `frame-ancestors 'none'` rule out clickjacking "Delete everything" or "Empty the trash now."
- **URL parameters**: `?greek=` (`parseGreekParam`, numbers only), `?sheet=` and `?id=` (store lookups only), `&view=` (two known values), `?desk=` (sets or clears the preview key only), `?desk-tour`, the notebook's `#…` (a failed `decodeURIComponent` only skips the scroll). Only `?print=` acts on the reader's data (SEC-4).
- **Stored values**: every `JSON.parse` of storage is in `try` and checked before use (`note-settings.js:109`, `release-feed.js:21`, `greek-commands.js:54`, `parseRibbonFlag`, `checkLayout`, the pre-paint script's `parseFloat`s with bounds); `lit-desk-tab` must name a real tab. The biggest desk value in storage is the release feed in sessionStorage (the JSON is about 220 KB), well under quota, and every `setItem` is in `try`.
- **Privacy**: no desk code fetches another origin (apart from SEC-1), loads a remote image or font, or prefetches; outside links carry `noreferrer`; `Referrer-Policy: strict-origin-when-cross-origin`. Every storage key the desk writes is named on /privacy (channel names aside). Trash keeps a deleted record 30 days, then a tombstone (id, kind, times), as M7 records; undo stacks live only for the visit.
- **Regex timing** (`sec\redos.mjs`): `sanitizeSheetHtml`/`pastedSheetHtml` stay linear on 512 KB to 2 MB of unclosed tags, nested lists, Word list paragraphs, `div` and `b` wrappers; the linker is linear on every pattern tried except SEC-2's; the Markdown import reads 5 MB in under a second.
- **Supply chain**: `npm audit --omit=dev` reports 0 vulnerabilities (network was available). The desk's runtime packages are `qrcode-generator` 2.0.4 (encoding only; the SVG is drawn by `qr-svg.mjs`) and `@fontsource-variable/playpen-sans` 5.3.0, both bundled and served from the site. No desk script or stylesheet comes from a third party; Cloudflare's beacon is edge-injected site-wide.
- **Headers the desk needs**: `Permissions-Policy` blocks only camera, microphone and geolocation, so the Window Management API, fullscreen and clipboard writes are available; `form-action` and `base-uri 'self'` are enforced. The repo's own tests for these areas pass (223 in `desk-sheet-share`, `desk-sheets`, `desk-export`, `scripture-refs`).

### Not reached

- **A browser run of SEC-1's last step** (the import running the handler) and of SEC-4 (whether each browser prints with no gesture). Both need a second local origin or the browser pane.
- **The deployed beacon's payload** on /desk/, /sheets/?id= and /notebook/?q= (Q3).
- **Present mode's Window Management flow** beyond reading `openPresenterWindow`.
- **Markdown export as an injection vector** into other Markdown tools (`escapeBody`); judged low value, since a file's author controls it anyway.

## Appendix B: Data integrity and sync-readiness (`DI`, Opus)

Auditor slice: the store, history, export and import, places and ribbons, the merge engine, the record
format and anchoring. Branch `claude/phase5-work-sessions` at `a57e155d`. Read-only; every claim below was
checked in code and, where marked, run. None of the slice's files changed in the four commits that touched
them since 2026-10-28 in a way that reverses an earlier fix. Those commits were BA89 to BA108 and the
Duplicate tab check (`aa7e65e2`); the ribbon code from them was read in full. Throwaway scripts are in the scratchpad directory
(`C:\Users\bcjoh\AppData\Local\Temp\claude\C--Users-bcjoh-GitHub-litbible\ad56297a-c1ae-439b-986a-dac3ca218054\scratchpad\`):
`merge-fuzz.mjs`, `merge-sim.mjs`, `merge-sim2.mjs`, `repro-merge.mjs`, `roundtrip.mjs`, `anchor-fuzz.mjs`,
`anchor-fuzz2.mjs`, `anchor-norm.mjs`, `anchor-decurl.mjs`, `hl-labels.mjs`, `clamp.mjs`, `scale.mjs`.

### Summary

The slice's foundations are sound. The 16 unit test files I ran first all pass (800 tests). The store aborts
partial writes. Every `store.change` builder waits only on IndexedDB reads. Backup and Web Annotation round
trips reproduce records exactly, including unknown kinds and fields. Nothing scales quadratically at
27,700 records. The serious problems are in two shared rules the apps will copy:

- **Anchoring** puts a mark silently on the wrong words when its own words are reworded and the same words
  appear elsewhere in the chapter. This happens in 38% of one-word marks and 15% of two-word marks. A change
  of typography alone drops 22% of nearby marks to the whole verse.
- **Merging** can leave two notebooks disagreeing forever about what a trash record holds. A restore then
  spreads the older words.

Other findings: a backup can't bring back deleted items (and says "yours are newer"), persistent storage is
asked for only once ever, a note being typed is lost when the page is left, joining highlights drops labels,
and the clamp is not ready for a sync.

**Counts: 1 High, 7 Medium, 4 Low.**

### Findings

#### DI-1 · High · data-integrity · NEW

> **Re-run by the orchestrator:** `anchor-fuzz2.mjs` reproduces the quoted rates exactly. They are conditional on a later revision that rewords a word inside the mark.
**A mark whose words are reworded lands silently on other words.**

- **Where**: `src/lib/anchor-core.mjs:147–162` (`bestByContext` applies the floor only when `starts.length > 1`), `:198–205` (`found`, then `moved` anywhere in the chapter); `src/lib/desk-change.mjs:139–144` (`found` and `moved` carry no notice).
- **What happens**: a reader highlights "based on the lord;" in Colossians 3:18. A later publish changes one word inside it. The `found` step fails. The `moved` step finds the same four words once in 3:20 and takes them with **no context check at all**, since the floor applies only when there are several occurrences. The highlight is now drawn on 3:20, with no notice. The same thing happens when a repeated formula elsewhere satisfies the 8-character floor on one side alone (Matthew 13:9's "Whoever has ears, listen!" moving to 13:43). A single remaining occurrence inside the verse is also taken blind: Luke 18:41 "What do **you** want me to do for you?", with the first "you" reworded, puts the mark on the second.
- **Evidence**: `anchor-fuzz2.mjs` ran about 60,000 trials over every published chapter's real anchor text (`chapterAnchorText`). Each trial rewords one word inside the mark and then calls `resolveAnchor` plus `changeNotice`. Share of marks drawn on other words **with no notice**:
  - 1 word: 38.1%
  - 2 words: 15.1%
  - 3 words: 6.7%
  - 4 words: 3.3%
  - 5 words: 2.1%

  Shortest examples:
  - Luke 17:32 "Lot’s" moved to 17:28
  - John 14:18 "I will" moved to 14:23
  - Mark 3:15 "to drive out" moved to 3:23
  - Colossians 3:18 moved to 3:20
  - Matthew 13:45 "the Heavenly Reign is like" moved to 13:47

  `anchor-fuzz.mjs`, which deletes or replaces the whole mark, gives similar rates. BA8 added the floor for repeated occurrences only. "`found` and `moved` carry no notice" is a recorded decision, so the defect is in what those two steps accept, not in the decision itself.
- **Fix**:
  - Whenever the stored quote carries at least `MIN_CONTEXT` characters of context, require that floor for a single occurrence too. This applies to both `found` and `moved`. Old quotes with no context are unaffected.
  - For `moved` out of the record's own verses, require context on both sides, or raise a notice.
  - It is the shared spec, so add vectors, bump `ANCHOR_SPEC_VERSION` to 3, and tell BDR (STUDY-DESK.md, "One notebook, three homes").
- **Confidence**: High.

> **Fixed in FA2-f (2026-11-03, branch claude/audit2-s3-anchoring-v3; spec version 3, awaiting BDR):** the floor holds for a single occurrence, `moved` needs 4 characters agreeing on each side, vectors regenerated, `STUDY-DESK-FORMAT.md` "Spec version 3".

#### DI-2 · Medium · data-integrity · NEW
**A change of typography alone, next to a mark, drops it to the whole verse with a notice.**

- **Where**: `src/lib/anchor-core.mjs:183–246`. `found` and `moved` match `exact` literally. In `textBetweenContext`, every head of the suffix and tail of the prefix keeps the changed character at its inner edge. `src/lib/desk-change.mjs:135` (`verse` always raises a notice).
- **What happens**: a mark made on `"Don't be afraid" - and…` meets today's `“Don’t be afraid” – and…`. Exact matching fails, and the context can't bracket the words, because the quote mark beside them is what changed. The mark falls to `verse` with the "verse" notice. If the reader presses Keep, a highlight is rewritten to the whole verse (`planKeep`), and the precision is gone for good. This contradicts C3's "punctuation passes don't count".
- **Evidence**:
  - `anchor-norm.mjs`: the case above returns `verse` with a `verse` notice. NFD text, doubled spaces, a no-break space and zero-width characters all stay `found`.
  - `anchor-decurl.mjs`: over the corpus, 503 of 2,282 marks touching a curly quote, apostrophe or en dash (22.0%), when made on straight-quote text, fall to `verse`. Example: 1 Corinthians 1:12 "I'll".
  - This is the position of every app highlight made before the August 2026 passes, and of every mark after a future mechanical pass.
- **Fix**: match on a typography-folded copy of both texts (the fold `desk-wording.mjs` already defines, with an offset map back to the real text), at least inside `textBetweenContext`. This is a spec change: vectors and a version bump, as for DI-1.
- **Confidence**: High (mechanism and count). Medium on how many app records it reaches.

> **Fixed in FA2-g (same branch; spec version 3, awaiting BDR):** `resolveAnchor` matches on a length-preserving typography fold (`foldTypography`), so offsets are unchanged. `desk-change.mjs` needed no edit: a mark that is `found` raises no notice.

#### DI-3 · Medium · data-integrity · NEW

> **Re-run by the orchestrator:** `repro-merge.mjs` reproduces the divergence.
**Two notebooks can disagree forever about a trash record's words, and a restore then spreads the older ones.**

- **Where**: `src/lib/desk-merge.mjs`:
  - `:303–310`: rule b swaps the trash record's `record` for the newer live copy without moving its `modified`.
  - `:188–207`: rule 6's donor does the same.
  - `:167–174`: an exact tie keeps the local copy.
- **What happens**: two browsers swap backup files.
  1. Browser X edits a note ("my newest words").
  2. Browser Y, not having seen the edit, deletes the note.
  3. X opens Y's backup. The deletion stands, and X's trash record takes "my newest words".
  4. Y opens X's backup. It is the same trash id with the same `modified`, so the tie keeps Y's own copy holding "first words".

  No further exchange changes either side. When Y restores the note, its restore (newer) reaches X, and "my newest words" is gone everywhere. That breaks the merge header's promise that "an undo or a restore from the trash brings back the reader's last words". The apps implement the same rules.
- **Evidence**:
  - `repro-merge.mjs` part 1, through the real `planImport` path, prints exactly this.
  - `merge-sim.mjs` simulates three devices creating, editing, deleting, restoring and redoing, then syncing at random with no clock skew and no tiebreak, settled to a fixpoint. 133 of 20,000 histories end diverged. `merge-sim2.mjs` shows all 133 differ only in held content: 0 when held content is ignored.
  - `merge-fuzz.mjs`, with a symmetric tiebreak, shows associativity failing in 687 of 20,000 cases and idempotence in 515, from the same cause: rule a picks whole same-id trash copies, while rule 6 merges content.
- **Fix**: merge copies of one trash id field-wise, as rule 6 already does across ids: the later `deletedAt`, the later `modified`, and the held record with the later held `modified`. In effect, add same-id copies to the collapse group instead of picking one by rule a. Add a vector for the two-browser case and a property test like `merge-sim.mjs` to `test/desk-merge.test.js`, and tell BDR.
- **Confidence**: High.

#### DI-4 · Medium · data-integrity · NEW
**Once a deletion is past Undo, a full backup can't bring it back, and the summary says "yours are newer".**

- **Where**: `src/lib/desk-export.mjs:724–739` (a file record with no local copy under its id is counted `keptHere`); rule b (`desk-merge.mjs:301–310`); the copy "for restoring it completely" (`export-import.js:51`, `desk-export.mjs:9`).
- **What happens**: a reader presses Delete everything (or deletes some notes) and leaves the page. Then they open the backup saved the day before. Every deletion is newer than the backup, so nothing comes back. The result reads "9 kept as they are here (yours are newer).", with no Open button. The reader has none of them. The trash holds them for 30 days, but nothing lists or restores the trash yet (E12, open).
- **Evidence**: `roundtrip.mjs` ("Delete everything, leave the page, open the backup") prints that sentence, with 0 of 9 live records afterwards. Rule b and A-F10 (a stale copy never revives a deletion) are deliberate; the wording and the missing way back are not.
- **Fix**:
  - Count these as "N deleted here since this copy was saved (on <date>)", not as kept.
  - Offer an explicit "Bring these back" that restores them as a new reader action, stamped now, so it wins under rule b.
  - Or ship E12 and point to it from that line.
- **Confidence**: High.

#### DI-5 · Medium · data-integrity · NEW
**Persistent storage is asked for once, ever.**

- **Where**: `src/scripts/desk/store.js:241–254`. Any stored `persistAsked` value ends asking for good, whatever `granted` was. `panel.js:445–453` shows "Your browser may clear it to free up space." and offers nothing to do about it.
- **What happens**: Chrome answers `persist()` silently, by engagement. On a reader's first write (low engagement) it usually says no. That answer is stored, so the notebook stays best-effort, and evictable under storage pressure, after months of daily use that would now earn a yes. In Firefox, one dismissed prompt is final.
- **Evidence**: read the code. Chrome's grant behavior is documented (web.dev, "Persistent storage"); not tested in a browser here.
- **Fix**: where `persist()` shows no prompt (Chromium), call it again at each open while `persisted()` is false. Elsewhere, add a button to the panel's line ("Ask this browser to keep it") and stop the meta value blocking it.
- **Confidence**: High on the code; Medium on Chrome's grant rate.

#### DI-6 · Medium · data-integrity · NEW

> **Fixed in FA2-d (same branch):** `beforeunload` while the editor holds words, and a `lit-desk-note-draft` sessionStorage draft offered back (named in /privacy).
**A note being typed is lost without warning when the page is left.**

- **Where**: `src/scripts/desk/note-editor.js` has no `pagehide`, `beforeunload` or draft handling. A grep of `src/scripts/desk/` finds those only in `sheet-pane.js`, `sheet-present.js` and `ribbon-follow.js`.
- **What happens**: the editor stands up to outside clicks (line 7). But a reload, closing the tab, a link followed in the page, or Back discards the words with no prompt. Sheets got BA72's last-typing save; notes didn't.
- **Evidence**: code and grep; not run in a browser.
- **Fix**: while `editorHolds()` is true, add a `beforeunload` prompt. Or keep a draft in `sessionStorage` on `input` and offer it back the next time the editor opens on that place.
- **Confidence**: High.

#### DI-7 · Medium · data-integrity · NEW
**Joining highlights drops the labels of the ones absorbed, and a split's new piece drops unknown fields.**

- **Where**: `src/lib/desk-highlights.mjs:249–257`. The survivor keeps only its own `labels`, and the others go to the trash. `:191–192`: `fresh` copies `labels` alone onto a split's second piece.
- **What happens**: a reader labels the highlight on "God" in John 3:16 "Prayer". Later they highlight the same color across "God… world", which joins it to an older highlight on "world". The joined mark has no label. "Prayer" survives only inside a trash record for 30 days, which nothing restores (E12). When a new color is placed in the middle of a highlight written by an app, the old highlight is cut in two, and the second piece loses that app's fields. That goes against principle 6 for the piece.
- **Evidence**: `hl-labels.mjs`:
  - survivor `labels: []`; trashed `labels: ['L-prayer']`
  - split pieces: the original keeps `appField`; the new piece has it `undefined`

  STUDY-DESK-FORMAT.md "Which records carry the result" mentions labels only for a split.
- **Fix**: give the survivor the union of the absorbed records' labels. Build a split's second piece from the original minus `id`, `created`, `modified` and the anchor fields, so unknown fields carry over. Say both in the format.
- **Confidence**: High.

#### DI-8 · Medium · longevity · NEW
**The clamp, and edit stamping, are not ready for a sync: seconds of clock skew drop ordinary edits.**

- **Where**:
  - `src/lib/desk-merge.mjs:271–281`: a record that ran ahead never beats anything held.
  - STUDY-DESK-FORMAT.md:737–748: "A sync service's cap is its own clock".
  - `src/lib/desk-records.mjs:177–182`: `editRecord` stamps `now`, never later than the version it replaces.
- **What happens**: a phone whose clock is 2 seconds fast saves an edit, and it syncs at once. The receiver's cap is its own "now", so the edit counts as ahead and is dropped, because the receiver holds the record. An incremental sync that has moved its cursor past the record never offers it again, so the edit is lost on the receiver for good. In the other direction, a device whose clock is behind writes edits stamped earlier than the version they edit, and those edits lose to that version on the next merge, on the device itself too. The rule was built for opening files (BA4), where it is right.
- **Evidence**: `clamp.mjs`: an edit 1 s ahead of the receiver writes nothing (`ahead: [false]`); the same record merged 5 s later lands.
- **Fix** (before phase 4, with BDR):
  - Treat a time within a tolerance (a few minutes) of the cap as not ahead.
  - Never let a sync cursor pass a dropped record.
  - Stamp an edit `max(now, record.modified + 1 ms)` in `editRecord`, a hybrid-clock step, so an edit always outranks the version it was made over.
- **Confidence**: High on the mechanism; the impact arrives with sync.

#### DI-9 · Low · data-integrity · NEW (the BA13 pattern, at sites BA13 didn't cover)
**Several writes still read in one transaction and write in another.**

- **Where**:
  - highlighting: `actions.js:286–303`, `byChapter` then `commit`
  - labels: `labels-ui.js:100–107, 117–124`; `notebook-page.js:202–203, 261–262, 272–273`
  - Delete everything and Empty the trash: `notebook-page.js:362–383`
  - Open a copy: `export-import.js:244–250`, `plan()` then `commit`
  - Keep: `change-notice.js:419–430`, with a possible `/api/version.json` fetch in between
- **What happens**: another tab's write that lands between the read and the write gets overwritten, through a following ribbon, a Sheet pane's autosave or an edit. For example:
  - Delete everything trashes the copy read before an edit, then removes the edited record.
  - Empty the trash puts a tombstone back beside a record another tab just restored.
  - Deleting a label rewrites notes from their pre-edit copies.

  The window is milliseconds, except for Open a copy: planning took about 0.6 s for 27,700 records in `scale.mjs`.
- **Fix**: run each through `store.change`. `planOpen`, `planHighlight`, `planDeleteLabel`, `planDeleteEverything` and `planEmptyTrashNow` are pure and take the records, so each can be handed `await all()` inside the builder.
- **Confidence**: High on the code; the likelihood is low.

#### DI-10 · Low · data-integrity · NEW
**A trash record's held record isn't checked, so it can carry another record's id or malformed fields.**

- **Where**:
  - `src/lib/desk-merge.mjs:130–141`: `problemWith` never compares `record.id` with `deletedId`.
  - `src/lib/desk-export.mjs:688`: trash records skip `validateRecord`, and nothing validates the held one.
  - `src/scripts/desk/store.js:355–361`: `store.undo` commits `planUndo` without `planWrite`.
- **What happens**: a backup file can hold a trash record that deletes id A but carries `record: { id: <the reader's own note B>, body: 12345 }`. It imports as "1 change in the trash". Restoring it (no caller today; E12's restore will be one) overwrites note B with the file's content and stores a record that fails validation. A sync would carry the same shape.
- **Evidence**: `repro-merge.mjs` part 2. The restore plan puts B's id with body `12345`. `planWrite` refuses it, but `store.undo` doesn't call `planWrite`.
- **Fix**: skip, and report, a trash record whose held record's id differs from `deletedId`, or whose held record of a known kind fails `validateRecord`. Route `store.undo` through `planWrite`.
- **Confidence**: High.

#### DI-11 · Low · longevity · NEW
**The database's upgrade handler isn't version-aware.**

- **Where**: `src/scripts/desk/store.js:80–90`.
- **What happens**: `onupgradeneeded` creates both stores and the indexes unconditionally. The first maintainer to raise `DB_VERSION` (for an index, say) will see `createObjectStore("records")` throw on every existing database. The upgrade aborts, `openStore` rejects, and every existing reader is told the browser can't keep a notebook. The data is intact but unreachable.
- **Evidence**: the code, against the IndexedDB spec (a ConstraintError for an existing store name).
- **Fix**: branch on `event.oldVersion` (`if (oldVersion < 1) { …create… }`), and leave a comment saying later versions add steps.
- **Confidence**: High.

#### DI-12 · Low · bug · NEW
**A file whose `exported` time has an offset can't be opened when a record in it is ahead of that time.**

- **Where**: `src/lib/desk-merge.mjs:219–222, 146–151`: the cap string is written into the record verbatim. `validateRecord` requires `Z`, through `planWrite`.
- **What happens**: the summary says "1 new… added with an earlier date" and offers Open. Pressing it fails with "That couldn’t be saved in this browser. Nothing was changed." An app-written backup with `+00:00` in `exported` would hit this.
- **Evidence**: `clamp.mjs` part 2.
- **Fix**: write the cap as `new Date(capMs).toISOString()`.
- **Confidence**: High.

### Improvements

- **Add the convergence simulation to the merge tests.** `merge-sim.mjs` is 100 lines and caught DI-3, which the hand-written vectors and the existing three-way test (`test/desk-merge.test.js:110`) can't reach.
- **Add the reworded-word fuzz to the anchor tests**, with an acceptance rate, so the next spec change is measured against DI-1's numbers.
- **Cache the notebook search's records.** `notebook-search.js:72` reads the whole store on every query. At 27,700 records (28 MB), a `structuredClone` proxy for `getAll` takes about 70 ms, plus about 107 ms for `searchNotebook`. A cache cleared by the store's BroadcastChannel would cut most of that.
- **Slim My Notes' re-read.** Each render reads `store.all()` (twice in the "everything" scope, `tab-mine.js:256, 270`), sheets' text included, and the panel subscribes with no filter (`panel.js:541`), so a following ribbon (every 4 s) triggers it. It is fine today; it is worth narrowing before notebooks grow.
- **Set a size cap on files chosen to open.** Reading is linear since BA10, but a 500 MB file still freezes the tab in `JSON.parse`.

### Questions for the owner

1. **Should a mark moved to another verse say so?** `found` and `moved` carrying no notice is the format's decision. DI-1 suggests at least `moved` across verses deserves one. This is BVJ's and BDR's call.
2. **Should a backup be able to bring back what was deleted since?** Only on an explicit request (DI-4), or never (A-F10 as it stands)?
3. **Phase 4 and whole-record newer-wins.** A following ribbon writes its whole record every 4 s, so a rename made on another device is overwritten by the next move. Two devices can also each make a "Prayer" label, or a sixth ribbon, and the merge keeps both, since uniqueness and the limit are checked only at creation. Field-level merge for places, and folding same-named labels, may be worth deciding before sync.
4. **Tombstones are kept forever** (rule c). Every highlight join, trim and undone add leaves one. That is a few hundred bytes each, so it is fine at any plausible size. Please confirm that is the intent, since it also means a backup grows without bound.

### What held up

- **Baseline**: the 16 test files for this slice pass (800 tests, `node --test`).
- **The merge's live records converge.** In 20,000 realistic three-device histories with no skew, the live set always converged; only held content diverged (DI-3). Commutativity held in all 20,000 random pairs with a symmetric tiebreak. Kind collisions are skipped. The clamp does what BA4 and BA12 intended for files.
- **Store atomicity**:
  - `apply` aborts the whole transaction on any throw (BA5).
  - All 12 `store.change` call sites wait only on `get` and `all` inside their builders, so no transaction can auto-commit early (checked `actions.js` (2), `history.js`, `note-editor.js`, `places.js`, `ribbon-follow.js`, `ribbon-form.js`, `search-pane.js`, `search-sheet.js`, `sheet-pane.js`, and `store.js` (2)).
  - The change message is posted only after `oncomplete`.
  - `writeNow` posts before its commit lands, but IndexedDB starts a later transaction on the same store only after an earlier one finishes, across connections, so a reading tab can't see the old state.
- **History**: entries ignore stamps, undoing an add writes a trash record (`undoTrash`), the overtaken check runs inside the write's transaction, and `lastEntry` can't be taken by another write (microtask ordering).
- **Principle 6**:
  - `editRecord` spreads every field; `migrateRecord` rewrites only in memory.
  - `planKeep`, the label plans, ribbon moves and `updateModule` all keep unknown fields.
  - A full backup round trip and a Web Annotation round trip (trash excepted, by design) reproduced, canonically identical: an unknown kind, a schema 2 note with a new field, a note with a nested unknown field, a sheet, a label, a ribbon, a pin and a trash record (`roundtrip.mjs`).
- **Markdown escaping**: 200,000 random strings of `# > \ < <!-- --> \r \t` and similar characters survived `escapeBody` and `unescapeBody` exactly. 4,000 whole-file round trips (headings, quotes, the end marker, HTML, NFD, emoji, zero-width characters) gave 0 mismatches.
- **Hostile files**: `__proto__` parses as an ordinary own field. Book keys like `constructor` or `toString` fail validation through the chapter range check. Duplicate ids are merged by rule a, and future times are clamped. Deep nesting is refused before any clone (`MAX_NESTING`).
- **Anchor normalization**: NFD text, no-break and doubled spaces, and zero-width characters still resolve `found`. Text moved into the next verse resolves `moved` on the right words (`anchor-norm.mjs`).
- **Scale** (`scale.mjs`, 5,000 notes, 20,000 highlights, 500 sheets, 200 labels and 2,000 trash records, 28 MB): nothing quadratic.

  | Operation | Time |
  |---|---|
  | `liveRecords` | 19 ms |
  | `filterRecords` | 33 ms |
  | `groupRecords` | 10 ms |
  | `labelCounts` | 4 ms |
  | a merge against itself | 0.4 s |
  | `planOpen` of the backup | 0.63 s |
  | `planOpen` of the Markdown | 0.59 s |
  | `toMarkdown` | 57 ms |
  | `toWebAnnotation` | 143 ms |
  | history entry for a 25,000-record import (20 MB of snapshots) | 87 ms |

- **Ids**: `crypto.randomUUID` for records and trash (122 random bits). The fallback exists only for history entry ids.
- **Ribbons**: rename, move and create read and write in one `store.change`, and the six-ribbon limit and name are checked at the write. The follower writes at most every 4 s, and only on a move.

### Not reached

- **Real-browser behavior.** I did not run quota exceeded, eviction, private windows, back-forward cache with BroadcastChannel, or the Duplicate tab race of two tabs loading within 250 ms. IndexedDB timings above are a `structuredClone` proxy.
- **Adversarial anchoring was run through the reference builder only** (`chapterAnchorText`), not through `desk-anchor-dom.mjs`'s page builder. `test/desk-anchor-dom.test.js` holds the two equal on every chapter.
- **`desk-sheets.mjs` and the sheet sanitizer's effect on unknown sheet markup** (the security slice), and `desk-wording.mjs`'s fold in detail.
- **The undo bar's timing and announcements** beyond reading the code.

## Appendix C: The Notebook panel, marks and first use (`NB`, Sonnet)

Auditor slice: usability, UI, accessibility and copy of the Notebook panel
(`panel.js` and its tabs), margin notes and marks, the note editor, undo bar,
first use and tour, the notebook page and help page, and the matching
`desk.css` selectors. Branch `claude/phase5-work-sessions`, checked 2026-11-03.
Read-only. Scratch scripts are in the scratchpad `nb/` folder:
`tabs.mjs` (tab-row widths from the real Inter and OpenDyslexic font files),
`contrast.mjs` and `hl.mjs` (contrast ratios).

### Summary

The panel's bones are sound: real tablist semantics with roving tabindex,
named landmark, focus return on minimize, no native dialogs, same-site links
only, reader text never becomes markup, both dark selectors paired, and every
text pair in the slice that I computed reaches 4.5:1 apart from one small case
(NB-14; a sheets-editor placeholder at 4.48:1 is another auditor's). The risk is concentrated in code and copy written on or after
2026-10-29 (Phase 5: Settings tab, no Close, header link to /desk) and in the
note editor.

Counts: **3 High, 4 Medium, 10 Low, 2 Nit** (19 findings, all NEW; nothing in
STUDY-DESK-AUDIT-1.md covers them, and no BA item was found reopened).

The three that matter most:

- Pressing **H** (Hide my marks) closes the Notebook completely on a Study View
  chapter and nothing on the page brings it back (NB-1).
- A note being written is **discarded with no warning** by Escape, Cancel, ×,
  and by clicking a verse number or footnote letter (NB-2).
- With **Settings added, four tabs no longer fit** the 280 to 350px panel;
  labels wrap at 1280px windows and "Settings" is clipped for OpenDyslexic or a
  larger browser font (NB-3).

### Findings

#### NB-1 · High · usability · NEW

> **Fixed in FA2-d/e (2026-11-03, branch claude/fa2-session2-notes-never-lost; not yet browser-checked):** H and "Hide my marks" now fold the Notebook to its tab and un-hiding expands it again, per the audit's recommendation

> **Live check (LV): confirmed for the H key only.** Ticking “Hide my marks” in the Settings tab hides the marks and leaves the panel open. After H the panel stays closed across a reload; the route back that exists is the search command “Open the Notebook.”

**Where**: `src/scripts/desk/panel.js:533-535` (the Hide listener calls
`close()`), `:342-353` (`close()` writes `lit-desk-panel=closed`), `:108` (only
`button[data-desk-toggle]` is wired); `src/scripts/desk/margin.js:350-353`
(`hide()` makes the whole rail hidden, tab included);
`src/components/SiteHeader.astro:98-110, 138-150` (header controls became
links to /desk in 89d34b0d); `src/pages/read/[book].astro:226-232` (the only
toggle button left, Read View only).

**What happens**: On a Study View chapter, a reader presses **H** (listed in
the Display tray and the tour) or ticks "Hide my marks". Marks hide and the
Notebook closes entirely: no panel and no "Notebook" tab. Pressing H again
brings the marks back but not the Notebook. "Closed" is stored
(`lit-desk-panel`), so every later page opens without it. The header's "Study Desk" now goes to /desk
rather than reopening the panel (before 10-29 the header Notebook button was
the way back). The ways back are all hidden: the search box command "Open the
Notebook" (`desk-commands.mjs:34-38`, shown when the panel is not open), the verse
menu's "Show in Notebook" (`actions.js:93-100`), the notebook page's start
choice, or `?desk=off` then `?desk=on`.

**Evidence**: Read all five sites above. `HIDE_EVENT` is heard only at
`panel.js:533` and it only closes, never reopens. `global.css:3518-3521` hides
only the *button* toggles on pages without a reading column, so the header's
`a[data-desk-toggle]` links show everywhere, and `panel.js:108` ignores them. The M1
record (`STUDY-DESK.md:3589-3594`) says Hide "closes the panel"; that was
written when a header toggle button existed. Rule 10 of the desk CLAUDE.md
(lines 273-283) removed Close and made the header links the same week, so the
two decisions together leave a dead end.

**Fix**: Make Hide *minimize* (`collapse()`; the tab stays) instead of close,
or remember that Hide closed it and reopen on un-hide. Also keep one visible
reopen control on Study View when the panel is closed.

**Confidence**: High (code path traced end to end; not run in a browser).

#### NB-2 · High · data-integrity · NEW

> **Fixed in FA2-d (same branch; not yet browser-checked):** `closePanel`/`showPanel`, verse numbers and footnote letters ask once while the editor holds words (`holdPanel`); the next ask discards.

> **Live check (LV): confirmed** for Escape, Cancel and a click on a verse number. The × was not driven separately.

**Where**: `src/scripts/desk/note-editor.js:232-237` (Cancel and × call
`closePanel()`), `:248-253`; `src/scripts/lit-panel.js:75-79` (Escape closes
any open panel), `:99-100` (`showPanel` begins with `closePanel()`);
`src/scripts/chapter-tools.js:812` (verse number) and `:910` (footnote
letter), neither guarded by `stay`.

**What happens**: A reader writes a paragraph in the note editor. Any of
these destroys it silently, with no confirmation and no draft kept: Escape
(very natural, for example to dismiss an IME candidate list), Cancel, ×, or a
click on a verse number or footnote letter to check something while writing.
The editor's `stay: true` only stops *outside clicks* (`lit-panel.js:59-61`).
Mouse hover previews are safe (`ref-preview.js:187-193` refuses to replace a
panel), so it is clicks and keys.

**Evidence**: The editor already knows when it holds unsaved words
(`changed()` at `note-editor.js:261`), and BA28 and BA37 were fixed because
the owner does not want those words lost. But `changed()` is consulted only by
the tour (`editorHolds`, `note-editor.js:43-53`), never by Escape, Cancel, ×
or `showPanel`.

**Fix**: In `closePanel`/`showPanel`, if the open panel is `stay` and
`changed?.()` is true, do not close. Keep the editor, move focus to its words,
and put a line in its `role="alert"` area ("You have unsaved words. Save, or
press Cancel again to discard"). For Cancel, × and Escape, ask once. Optionally
keep a `sessionStorage` draft and offer it back when the editor reopens.

**Confidence**: High on the code; not reproduced in a browser.

#### NB-3 · High · a11y · NEW

> **Live check (LV): wrapping confirmed** at 1280px (panel 304px, row 59px). **Clipping confirmed with OpenDyslexic** (Settings 54 to 81px cut off). Not reproduced at the 280px minimum with Inter, where the labels wrap and nothing clips.

**Where**: `src/styles/desk.css:188-206` (`.desk-panel__tabs`: flex, no wrap,
no scroll, no `white-space`), `src/scripts/desk/panel.js:164-229, 239-243` (the
four tabs), `src/lib/desk-margin.mjs:44-45` (panel 280 to 440px).

**What happens**: Phase 5 added "Settings" as a fourth tab on Study View
chapters (My Notes, This verse, Greek, Settings). I measured the labels with
the real Inter 600 and OpenDyslexic 700 files (`nb/tabs.mjs`; 14px, 10px side
padding, 4px gaps, panel border and 12px row padding subtracted):

| Font | One-line row | Narrowest row (words wrapped) | Room at 280 / 304 / 347 / 384 / 440px panel |
|---|---|---|---|
| Inter | 324px | 267px | 254 / 278 / 321 / 358 / 414px |
| OpenDyslexic | 469px | 369px | same |

The desk-margin comments give the panel as 304px at a 1280px window, 347px at
1366 and 384px at 1440. So at 1280px the row is 46px short: "My Notes" and "This
verse" wrap onto two lines and the whole row doubles in height. At the 280px
minimum (any narrow or floating window) the narrowest row, 267px, still
overflows by 13px, so the last tab is cut by `.desk-panel { overflow: hidden }`.
With OpenDyslexic, or a browser default font size of 20px, the row is wider
than the panel even at 1440px (369 > 358), and "Settings", the only home of
the switches, print buttons and help links, is mostly invisible to a mouse
user. A keyboard user arrowing to it makes the browser scroll the clipped
panel sideways. `desk.css` has no `[data-font]` compensation for the panel (the
styles CLAUDE.md says to buy space back for the accessibility fonts).

**Evidence**: Script output above; the CSS has no `flex-wrap`, `overflow-x`,
`nowrap` or `min-width` on the row or its tabs (grep of every
`desk-panel__tabs` rule). WCAG 1.4.4 and 1.4.10 apply (content lost when text
is enlarged or the window is narrow).

**Fix**: Give the row `flex-wrap: wrap` at minimum, with `white-space:
nowrap` on the labels, so no tab is ever clipped. Better: shrink padding to 8px
and gap to 2px, shorten labels (for example "Notes", "Verse"), or move
Settings to a gear button in the header beside the minimize button. Add the
usual `html[data-font="dyslexic"]` allowance.

**Confidence**: Medium. Widths are computed from font metrics without kerning
(about 2%), so the 1280px wrap is solid (15% deficit) but the 1366px case is
borderline. A screenshot at 1280px and with OpenDyslexic would confirm it.

#### NB-4 · Medium · a11y · NEW

> **Live check (LV): confirmed.** The first control in the Notebook is tab stop 216 of 229; the header’s Study Desk link is stop 10 and goes to /desk.

**Where**: `src/scripts/desk/margin.js:106-110` (the rail, which holds the
panel and the tab, is appended to the end of `<body>`); `src/layouts/Layout.astro:203`
(the only skip link); `src/scripts/keyboard-shortcuts.js:1-14` (no Notebook
key); `src/scripts/desk/panel.js:108`.

**What happens**: On a Study View chapter, intro, article or the glossary, a
sighted keyboard-only reader has no early way to reach the Notebook. The
header's "Study Desk" is a link to /desk, and the panel and its tab come after
the footer in tab order, so they must tab past every verse number, footnote
letter and footer link. Before 10-29 the header Notebook button was a few Tab
presses in and moved focus into the panel. What exists now: the verse menu's
"Show in Notebook" (Enter on a verse number), the search box command, and
landmark navigation for screen readers. None is discoverable.

**Evidence**: Greps for `data-desk-toggle` (only `SiteHeader.astro`,
`read/[book].astro`, `panel.js`, CSS) and for any key handler or skip link
naming the Notebook found nothing else.

**Fix**: Add a second skip link ("Skip to the Notebook", visible on focus, only
with the desk on) that opens, expands and focuses the panel, or restore a
button toggle beside the "Study Desk" link, or add a Keyboard-switch-aware key.

**Confidence**: High on the structure; impact estimated, not measured.

#### NB-5 · Medium · a11y · NEW

> **Live check (LV): confirmed, with a correction.** The undo bar is not the last child of body, but its Undo button is tab stop 216 of 231, and the announcement never mentions Ctrl+Z.

**Where**: `src/scripts/desk/undo-bar.js:62-74` (bar built and appended to the
end of `<body>`), `:104-111, 127-160` (`announce`, `showUndo`);
`src/lib/desk-announce.mjs` and the `showUndo` callers (`tab-mine.js:669`,
`note-editor.js:246`, and about twenty other call sites).

**What happens**: Deleting a note from the Notebook says (visually and through
the live region) "Yellow highlight on Romans 8:3 deleted." and offers Undo for
10 seconds. A keyboard or screen reader user cannot reach the Undo button in
that time because it is the last element in the document, and the spoken
message never says that Ctrl+Z (⌘Z) undoes it. The only mention of the key is
the Display tray's key list and a tour step. WCAG 2.2.1 is mitigated by Ctrl+Z
being permanent (as the file header argues), but only for a reader who knows.

**Fix**: Append "Press Ctrl+Z to undo." (platform-aware with `undoModifier()`)
to the live region text, and optionally to the bar. Or insert the bar next to
the panel, or move focus to Undo when the delete came from the keyboard.

**Confidence**: High on DOM position and wording; Medium on severity.

#### NB-6 · Medium · docs · NEW

> **Live check (LV): confirmed.**

**Where**: `src/lib/desk-first-use.mjs:230, 232, 276, 323`;
`src/pages/notebook/help.astro:53`; `src/scripts/desk/notebook-page.js:126`.

**What happens**: Phase 5 (89d34b0d) removed the × and moved the foot into the
Settings tab, but the tour and help still teach the old layout:
- Tour step "The Notebook" (both wordings): "» minimizes the Notebook ..., ×
  closes it, and the Notebook button brings it back." There is no ×, and the
  header control is now "Study Desk" (the vertical "Notebook" tab does bring
  it back).
- Tour step "Set the widths": "'Reset widths' at the foot of 'My Notes'". It is
  in Settings.
- Tour step "Where it's kept": "The foot of the panel says when you last saved
  a copy." It is in Settings.
- Help page: "You can change that at the foot of the panel."
- Notebook page: "a panel you close stays closed", but a reader cannot close
  it (except by H, NB-1).

The tour steps that mark things were updated (`tour.js` now opens Settings),
so the card text and the highlighted control disagree.

**Fix**: Rewrite the four strings; update `desk-first-use.mjs` and the tests
that read the step text (no test pins this wording; grep of `test/`).

**Confidence**: High.

#### NB-7 · Medium · docs · NEW

**Where**: `src/pages/notebook/help.astro:31-193` (headings: ways to keep,
saving a copy, deleting everything, places and ribbons, labels, the Greek tab,
search and commands, the tour, sharing, missing).

**What happens**: The help page, linked from the Notebook's Settings tab and
first-use card, never explains the basics: how to add a note, highlight or
bookmark (verse number, then "My Notebook"), what the margin shows, the
tabs, Hide my marks and H, Undo and Ctrl+Z, the Settings tab, or that the
header's "Study Desk" opens /desk. "Places and ribbons" is one sentence with
no how. The tour is the only teacher, it "never starts by itself", and a
reader who chose "Don't show this again" has none.

**Fix**: Add a short "Making notes, highlights and bookmarks" section and a
"The panel" section (tabs, Settings, minimize, H, Ctrl+Z). Also say in the
My Notes empty state how to add the first note (see Improvements).

**Confidence**: High.

#### NB-8 · Low · ui · NEW

**Where**: `src/scripts/desk/panel.js:154-156` (outer `settingsEl` takes class
`desk-panel__settings`) and `src/scripts/desk/note-settings.js:350-351`
(`panelNoteControls()` wraps its controls in another `div.desk-panel__settings`);
`src/styles/desk.css:304-312` (padding and font) and `:508-514` (flex row).

**What happens**: Phase 5 renamed `.desk-panel__foot` to `.desk-panel__settings`
(visible in the 89d34b0d diff) but the controls wrapper already used that name.
Both elements now get `padding: 10px 16px 14px` and `display: flex; flex-wrap:
wrap; gap: 6px 12px`, so the switches sit 16px deeper than the sibling lines
below them (page link, kept line, help links) and the Settings children flow as
a wrapping flex row rather than a stack.

**Fix**: Give the outer element its own class (for example
`desk-panel__settings-tab`) and leave `.desk-panel__settings` for the controls
row.

**Confidence**: Medium (class collision is certain; the visual effect is
inferred from the CSS, not seen).

#### NB-9 · Low · bug · NEW

**Where**: `src/scripts/desk/panel.js:182` (`afterRender` calls
`renderPersistence()` only from My Notes), `:445-453`, `:160` (the line lives
in Settings); `src/scripts/desk/tab-mine.js:241` (My Notes returns early when
not visible).

**What happens**: The warning "Your browser may clear it to free up space." is
drawn only after My Notes has rendered. If the remembered tab (`lit-desk-tab`)
is Settings or Greek when a page loads, My Notes never renders, so a reader who
goes straight to Settings never sees the warning until they have visited My
Notes. Phase 5 moved the line to a tab that cannot trigger its own drawing.

**Fix**: Call `renderPersistence()` when the panel is built and when Settings is
selected.

**Confidence**: High (code); trivial in impact.

#### NB-10 · Low · a11y · NEW

**Where**: `src/scripts/desk/notebook-page.js:333-350`.

**What happens**: "Delete everything..." and "Empty the trash now..." replace
the button with a `role="group"` named only "Confirm" and move focus to Cancel.
The question ("Are you sure? This deletes 12 items ...") is a plain `<p>` that
is not announced when focus lands on Cancel, so a screen reader user hears
"Cancel" with no context.

**Fix**: `aria-labelledby` the group to the question's `<p>` (give it an id), or
`aria-describedby` on Cancel and the confirm button.

**Confidence**: High.

#### NB-11 · Low · bug · NEW

**Where**: `src/scripts/desk/shell.js:80-81, 171-174`;
`src/scripts/desk-frame.js:95-114`; `src/scripts/desk/note-settings.js:226-281`.

**What happens**: `standDown()` removes the pre-paint stamps, the rail and
gutters, and the column move, but not what the shell already added when a later
step throws before `panelUp`: the Display tray's injected desk switches, hint,
"Reset widths", lettering row and the H and Ctrl+Z key lines (all marked
`data-desk`, with no CSS that hides them when `html[data-desk]` is gone,
unlike `[data-desk-toggle]` at `global.css:3518`), the undo root, the history's
Ctrl+Z listener, the notes `<aside>` and `data-desk-*` attributes. The page
looks like the ordinary reader's page except the tray still offers desk
settings that do nothing.

**Fix**: Add `html:not([data-desk]) [data-desk] { display: none }` beside the
toggle rule, and have `standDown` remove `.desk-undo` and `.desk-notes`.

**Confidence**: Medium (reasoned from code; needs a forced throw to see).

#### NB-12 · Low · bug · NEW

**Where**: `src/scripts/desk/store.js:80-94, 103-105`;
`src/scripts/desk/shell.js:72-76`.

**What happens**: `indexedDB.open` has no timeout and no `onblocked`. If the
request never settles (a known WebKit failure just after Safari starts, or a
connection that ignores `versionchange`), `start()` waits forever, the panel is
never built, `standDown()` never runs, and a page whose pre-paint stamped
`data-desk-expanded` stays narrowed with a dead right margin and visible
"Study Desk" link. /notebook/ would say "Loading the Study Desk..." forever.

**Fix**: Race the open against a timeout (about 8 seconds) and treat a timeout
as `store === null`, which already has a good message ("This browser isn't
letting the site keep a notebook ...").

**Confidence**: Low (no browser here; the Safari bug is from memory). A throttled
IndexedDB or a hung `open` in DevTools would confirm.

#### NB-13 · Low · usability · NEW

**Where**: `src/styles/desk.css:906-910, 1147-1151`;
`src/scripts/desk/note-editor.js:112`; `src/scripts/desk/note-words.js:23-33`.

**What happens**: A note typed in Hebrew (or mostly Hebrew) has no `dir` or
`unicode-bidi`, so it is laid out left to right: the line is left aligned and
final punctuation lands at the wrong end ("שלום." shows as ".שלום"). Mixed
English and a Hebrew word is fine, and Greek is fine (fonts are covered by the
character-range faces). The editor's `<textarea>` has the same base direction.

**Fix**: `unicode-bidi: plaintext` (or `dir="auto"`) on `.desk-note__text`,
`.desk-item__words`, `.desk-note-pop__text`, `.desk-verse__words` and the
editor textarea.

**Confidence**: Medium (standard bidi behaviour; not rendered here).

#### NB-14 · Low · a11y · NEW

**Where**: `src/styles/desk.css:1196-1201` (tints); `src/styles/global.css:2771-2778`
(verse numbers are `--green-text`).

**What happens**: A Study View highlight is painted over verse numbers and
footnote letters that fall inside its range. In light mode on the cream page
the green numeral (#0F6B33) over the blue tint is **4.04:1**, over pink
**4.06:1**, and over the green tint **4.42:1** (all small superscripts; 4.5:1
is required). Yellow passes (4.73:1). Dark mode passes on the page.
Weakening the tints cannot fix it (green on cream alone is 4.97:1: pink at 0.16
alpha is still 4.34:1, `nb/hl.mjs`).

**Fix**: Give the superscripts inside a highlight the ink color, or darken the
numeral slightly where it sits in a highlight (the `::highlight()` rule accepts
`color`), or use a darker green for `sup.vn` generally.

**Confidence**: High on the ratios; Low on how many numerals sit inside a range.

#### NB-15 · Low · usability · NEW

**Where**: `src/scripts/desk/note-editor.js:163-165, 223-225`;
`src/scripts/desk/actions.js:125-154`; `src/scripts/desk/undo-bar.js:63, 104-111`.

**What happens**: Highlighting turns "My highlights" back on if it was off
(`actions.js:310`), but saving a note or a bookmark while "Notes in the margin"
or "My bookmarks" is off (for instance after Hide my marks) shows nothing: the
editor closes, the announce text is `sr-only`, and the margin stays empty. After
NB-1 the Notebook is closed too, so a sighted reader has no sign the note was
kept.

**Fix**: Follow the highlight rule (switch the matching setting on), or show a
visible notice ("Note saved. It is hidden because Notes in the margin is off.
Show").

**Confidence**: High (traced).

#### NB-16 · Low · a11y · NEW

**Where**: `src/scripts/desk/pins.js:158-171` (also `footnote-notes.js:160`).

**What happens**: Pin and Unpin set `button.disabled = true` while the write is
in flight, then re-enable. A focused button that becomes disabled can lose
focus (browsers differ), so a keyboard user pressing Pin in a footnote popover
may land on the body. `tab-verse.js:171` already uses `aria-disabled` for this
reason.

**Fix**: Use `aria-disabled="true"` and ignore clicks while busy.

**Confidence**: Low (browser behaviour not tested here).

#### NB-17 · Low · ui · NEW

**Where**: `src/styles/desk.css:915-931` (margin note: no `max-height` once
open or hovered), `:431-437` (list rows expand on hover or focus).

**What happens**: A very long note (a pasted page) expands at its full length in
the margin when hovered or opened, over every note below it and possibly past
the end of the chapter. In My Notes a hovered long note grows the row, so
moving the pointer down past it makes the list jump and can skip rows.

**Fix**: Give an opened note a `max-height` with its own scroll, and open list
rows on focus or click only.

**Confidence**: Low (CSS reading; needs a browser and a long note).

#### NB-18 · Nit · a11y · NEW

`src/scripts/desk/note-settings.js:172` sets `aria-keyshortcuts="h"` on "Hide
my marks" whatever the Keyboard switch says, so with the switch off a screen
reader still advertises an H shortcut that does nothing. Set it only while
`lit-shortcuts` is not `off`, or drop it.

**Confidence**: High.

#### NB-19 · Nit · usability · NEW

`src/scripts/desk/export-import.js:119-132` records "last saved a copy" and
says "Saved <file>." as soon as the download starts, so a reader who cancels a
browser's save dialog is told the copy exists and the weekly reminder is
suppressed. A web page cannot see the cancel, so soften the line ("Started the
download of <file>") or say the browser may ask where to save.

**Confidence**: High.

### Improvements

- **Empty states teach the first step.** "Nothing kept for John 3 yet." and "No
  notes of yours on this verse." (`panel.js:131`, `tab-verse.js:118`) could add
  "Select a verse number, then Add a note."
- **Let the Notebook follow the Display tray's text size.** The panel is in rem
  at 15px (`desk.css:51`), while scripture and margin notes scale; a low-vision
  reader sets Extra large and the panel stays small.
- **Keep Tour, Help and "Tell us what's missing" visible.** All three now sit in
  the fourth tab; a small "?" in the panel head would keep them findable.
- **Many labels.** The label and color chip rows (`desk-mine__labels`,
  `desk-mine__colors`) sit above the list and can take a third of a 280px panel
  with 20 labels; a select above, say, 6 labels would save the room.
- **A visible, polite status line for sighted readers** where `announce()` is
  the only feedback (`undo-bar.js:104`), for example a note saved with the
  Notebook closed.
- **The danger confirmation** could say what Undo will or won't do ("You can
  undo this for 10 seconds" is only in the undo bar).
- **Per-tab focus loss on redraw.** My Notes redraws its whole list on every
  change including a following ribbon's place writes (`panel.js:541`,
  `tab-mine.js:284`), so a keyboard user's focus on a row can drop every few
  seconds while a ribbon follows; redraw only when `kinds` other than `place`
  changed, or restore focus by `data-id`.

### Questions for the owner

1. **Highlight strength in light mode.** Tint only is your decision (2026-10-09),
   but the tints are very faint on the cream page: yellow 1.05:1, green 1.13:1,
   blue and pink 1.23:1 against it (`nb/contrast.mjs`). Is that the intended
   strength, or would you accept stronger tints?
2. **Hide my marks: close or minimize?** The M1 record says it closes the panel
   (so a shared screen shows no list of notes). Since Close was removed and the
   header became a link, closing has no way back (NB-1). Would minimizing to the
   tab (which shows no notes) meet the privacy goal?
3. **Header "Study Desk" and the panel.** Was it intended that the header no
   longer opens the panel on Study View? Keyboard-only readers lost their early
   route (NB-4) and a closed panel lost its reopen (NB-1).
4. **Should the Notebook follow the Display tray's text size?** (See
   Improvements.)
5. **Unsaved words.** Is discarding on Escape and Cancel deliberate (NB-2), or
   should the editor warn or keep a draft?

### What held up

- **Tabs**: `role=tablist`/`tab`/`tabpanel` with `aria-selected`,
  `aria-controls`, roving `tabindex`, Arrow/Home/End, focus returned to the tab
  at `panel.js:297, 369`; each tab builds on its own and a failure shows "This
  tab couldn't load" (`panel.js:273-281, 643-648`).
- **Landmarks and names**: the panel is an `<aside>` named by its heading; the
  margin is an `<aside>` named "Notes in the margin"; the collapsed tab has
  `aria-expanded`/`aria-controls`; every icon button has a name that contains its
  visible word (Edit, Delete, Unpin).
- **Margin notes**: toggle buttons with `aria-expanded` and `aria-describedby`;
  the margin's Edit button carries an `sr-only` suffix naming its note; circles
  and flags are named for their verse; focus is kept across redraws (BA21
  holds).
- **Keys**: Escape in the panel stands down for the tray, shared panels,
  floating windows and the Greek search (`panel.js:399-406`, `greek-find.js:190`);
  the tour captures Escape; H and Ctrl+Z stand down in fields; Ctrl+Z is not
  single-key (2.1.4).
- **Dragging**: both width handles are `role=separator` with arrow-key steps
  and `aria-valuenow/text` (`widths.js:186-304`, `float-resize.js:33-103`), so
  2.5.7 has an alternative.
- **Targets**: circles 28px, caret 28px, tab buttons about 37px, the highlight
  flag is 18px with a 24px overlay (`desk.css:1897-1912`), settings rows 19.5px
  with 6px spacing (passes the spacing exception). The Edit button is about
  24.2px.
- **Contrast (computed, `nb/contrast.mjs`, `nb/extra.mjs`)**: every
  `rgba(ink, a)` text color in the slice at a >= 0.65 passes on the panel surface
  (light: 4.97 at 0.65, 5.79 at 0.70, 6.86 at 0.75; dark: 6.9 and up), including the
  captions and tab labels (`desk-note-pop__ref`, `desk-item__kind`, unselected
  tabs at 0.72, the Settings text at 0.72). The three that fall short are outside
  this slice or not text that needs it: 0.62 is 4.48 on raised and 4.12 on the
  page (the sheets editor's placeholder, `desk.css:5928, 5940`, a hair under), and
  0.3 to 0.5 are disabled controls and grips. Green text is 4.97 on cream, 6.34
  on raised, 7.08 on the dark panel, 8.12 on the dark page. The focus ring
  (`--focus-ring`, same green) clears 3:1 on cream, raised and dark. White on Deep
  Green is 6.6, white on the danger red `#9c2a1f` 7.60, and the hover pair
  (`on-green-fill` on `green-text`) 6.75 in dark. Bookmark red `#c62828`: 4.22 on
  cream, 3.43 on the dark page (2.99 on the dark panel, where it sits beside a text
  label, so it is not counted). Text on all eight highlight tints is 9.4:1 and up
  in both themes; green numerals on them are the NB-14 case.
- **Reduced motion and forced colors** covered for notes, circles, caret, tour
  scroll and the six smooth scrolls; the seg control, tab bar and flag states
  have forced-color rules (`desk.css:5946-6000`).
- **CSS conventions**: no `ch` unit in `desk.css` or the notebook stylesheets;
  `outline: none` appears only where a pseudo-element ring replaces it; both dark
  selectors are present for the tint, rich-text and warning tokens.
- **Copy**: no em dashes, British spellings or straight apostrophes in any
  reader-facing string in the slice's `.js` files (scanned); curly quotes and
  Oxford commas present; errors tell the reader what to do ("Reloading the page
  may bring it back", "Copy your words, then close this ...").
- **Safety**: no native dialogs; every link in the panel is same-site; the
  destructive confirmations default focus to Cancel; note text goes through
  `noteBodyHtml` or `textContent`.
- **Tests**: `node --test` on `desk-frame`, `desk-first-use`, `desk-prepaint`,
  `desk-margin`, `desk-announce`: 123 pass.

### Not reached

- **No browser was used.** Everything here is from reading and from font and
  contrast computation; NB-3's wrap, NB-12, NB-16 and NB-17 want a browser to
  confirm.
- WCAG items needing a browser: 2.4.11 (focus not obscured: the floating
  Notebook, the undo bar and the tour card can sit over a focused verse number),
  400% zoom and 320px reflow beyond the tab row, text-spacing overrides on the
  margin notes (`--desk-note-max` is measured once), `prefers-contrast`,
  Safari and Firefox behaviour, and a real screen reader.
- Read only by skimming (headers and ARIA/focus greps): `tab-verse.js`,
  `kept-list.js`, `record-rows.js`, `places.js`, `whats-new.js`, `change-notice.js`,
  `diff-view.js`, `read-marks.js`, `highlights.js`, `footnote-notes.js`,
  `prose-actions.js` (off while N11 is off), `glyphs.js`, `widths.js` and
  `float-resize.js` (keyboard and ARIA only). About a third of `notes-margin.js`
  and half of `tour.js` were read closely.
- The tour's per-step behavior at narrow windows and the Display tray's injected
  controls beyond what `note-settings.js` shows were not exercised, and of the
  desk's pages only /notebook/ and its help were read.

## Appendix D: The /desk workspace and sheets (`DK`, Sonnet)

Branch `claude/phase5-work-sessions`, read 2026-11-03. Read-only: nothing in the repo was changed. Throwaway scripts are in the scratchpad (`dk-layout.mjs`, `dk-dom.mjs`, `dk-count.mjs`, `dk-print.mjs`).

### Summary

The workspace is in good health. The layout rules are sound and tested, the separators, menus and sheet reordering have real keyboard models, present mode handles focus and `inert` correctly, and listeners are released when a pane is destroyed. The new Search pane (3m) is where most of the new problems are: it reads results with a live region that is not in the accessibility tree while empty, it loses focus on redraw, and its chosen states vanish in forced colors. No Critical findings.

Counts by severity: **Critical 0, High 1, Medium 5, Low 9, Nit 1** (16 findings). Of these, 7 are in code added since 2026-10-28 (the Search pane and /desk's Print menu), 9 are in older code the prior audit did not reach. No finding is a `KNOWN-OPEN` or `REGRESSION` of a BA item; BA51, BA54, BA57, BA61, BA79, BA121, BA122, BA123, BA125, BA150 and BA153 were re-checked in code and still hold.

The sharpest items: a keyboard-only reader cannot blank arbitrary words on a sheet (DK-1); the Search pane's status line is likely never announced (DK-2); a Sheet pane's autosave re-reads and repaints the notebook for every loaded chapter (DK-5).

### Findings

#### DK-1 · High · a11y · NEW

> **Fixed in FA2-h (2026-11-03, branch claude/audit2-session4; not yet browser-checked):** the passage takes focus (`tabindex=0`); arrows move a word cursor, Shift extends, Enter blanks the chosen words (`wordSpans`, `sheet-lit.js`); imported chapter blocks lose `img`, `script`, `on*` and `javascript:` addresses before `importNode` (SEC-1's second lock).

> **Live check (LV): confirmed.** Shift+Arrow leaves no selection in the passage text; only the key-term chip blanked a word.
**Where** `src/scripts/desk/sheet-lit.js:413-447` (`blankSelection`, the "Blank the selected words" button); the passage text it works on is built at `sheet-lit.js:179-243` (`passageWords`) and has no `tabindex`, role or key handler (grep of `sheet-lit.js` finds no `keydown` and no `tabindex`).
**What happens** A leader building a fill-in-the-blank handout can blank the key terms from the chips (`sheet-lit.js:462-480`, real buttons), but any other word has to be blanked by selecting it in the passage text with a mouse and pressing the button. The passage text is non-editable, non-focusable text, so Shift+Arrow has no caret to extend; the only keyboard route is the browser's caret browsing (F7), which the site neither mentions nor can count on. A keyboard-only or switch user therefore cannot make a custom blank. With no selection the button only says "Select words in this passage first" (`sheet-lit.js:420`).
**Evidence** Read `createPassageBody`; the only inputs that create a blank are the term chips, the selection button and the list's "Fill in … again" remove buttons. WCAG 2.1.1 (Keyboard, A) applies to the function, not just the control.
**Fix** Give the passage text a keyboard way to choose words: for example make the text `tabindex="0"` with an arrow-key word cursor (Space/Enter blanks the word under it, Shift+arrows extends), or a small "Blank words by number" field, or per-word toggle buttons in a "Choose words" mode. Say in the button's hint how a keyboard reader does it.
**Confidence** High that no site-provided keyboard route exists; Medium on severity (the preview is unreleased, and term chips cover the commonest blank).

#### DK-2 · Medium · a11y · NEW

> **Live check (LV): partly confirmed.** The status element is display:none while empty and is filled in the same task it is shown. Whether a screen reader announces it was not testable.
**Where** `src/scripts/desk/search-pane.js:209-213` (`status` and `note` are `role="status"`), `:245-251` (`say`, `tell`), `src/styles/desk.css:7311` (`.desk-search__status:empty { display: none }`) and `search-pane.js:213, 250` (`note.hidden = !text`).
**What happens** The Search pane tells a screen-reader user what happened ("Searching…", "12 keyword matches", "No results.", "Search failed.", "The sheet couldn’t be saved") only through these two elements. Both are `display: none` while empty and are shown in the same turn as their text is set. A live region that is created or un-hidden together with its content is commonly not announced (NVDA, JAWS and VoiceOver all miss it in some browsers), because the region has to exist in the accessibility tree before its text changes. So the pane's only feedback for typing a query is likely silent. The results list that follows is not announced either, and focus stays in the field.
**Evidence** Read the three draw paths (`empty`, `tooShort`, `drawResults`) and the CSS. Not tried with a screen reader.
**Fix** Keep the status element rendered (use `min-height` or a visually-hidden class instead of `:empty`/`hidden`), set its text after it is in the tree, and keep one polite region for the pane rather than two. The same holds for `tell`'s note and for the entry box's "Loading the entry…" (`search-pane.js:748`), which has no role at all.
**Confidence** Medium (the failure is screen-reader and browser dependent; confirm with NVDA and Chrome, and VoiceOver and Safari).

#### DK-3 · Medium · a11y · NEW

> **Live check (LV): confirmed.** Focus lands on BODY after “‹ All sheets” and after opening a sheet from the list. Delete was not driven.
**Where** `src/scripts/desk/sheet-pane.js:395-404` (`showList`), `:436-441` (the list's Delete), `:522-544` (`openSheet`, focus only for a new sheet), `:550-555` ("‹ All sheets").
**What happens** The Sheet pane swaps its whole content between the list and a sheet with `content.replaceChildren`. The button that was just pressed ("‹ All sheets", a sheet's name, "Delete …") is removed, so focus falls to the page body. The reader must Tab from the top of the page to get back to the pane. Nothing is announced either: `say()` is not called for these switches. A keyboard user who opens a sheet, goes back, and opens another repeats this each time; after Delete the undo bar appears but does not take focus. (BA21 fixed the same thing for notes deleted from a list; sheets were not covered.)
**Evidence** Read every call of `showList`/`openSheet`; none ends in a `.focus()`. `openSheet(id, { focusTitle: true })` is passed only from `newSheet`.
**Fix** After the switch, focus the pane's new heading or first control (the sheet's title field when opening, the "My sheets" heading or the next row after Delete, "New sheet" after "All sheets"), and call `say("Opened …")`/`say("My sheets")`.
**Confidence** High.

#### DK-4 · Medium · a11y · NEW

> **Live check (LV): confirmed** for the word choice. Exact form and Show more were not driven.
**Where** `src/scripts/desk/search-pane.js:947-966` (`choice` buttons, `aria-pressed`), `:973-983` ("Exact form only"), `:960-966` ("Show more words"), `:848-852` and `:935,987` ("Try again"), all running `run(q)` or `draw()`, which at `:369` does `groupsEl.replaceChildren()`.
**What happens** In the Search pane's Greek results, pressing a word choice, "Exact form only", "Try again" or "Show more words" with the keyboard redraws the group, so the button (or checkbox) that has focus is deleted. Focus drops to the page body and the keyboard user has to Tab back through the whole page to the results. The pressed button is also rebuilt, so `aria-pressed` is re-announced from scratch. The English paths are fine: `paged` hands focus to the first new row (`:497`) and the sort toggle re-focuses its replacement (`:584`).
**Evidence** Read `run`, `runGreek`, `paintWord`; no `focus()` after `run(q)` for these controls.
**Fix** Remember the control's identity (`data-focus-key`) before the redraw and focus its replacement afterwards, as `sheet-lit.js:446` does for the blank buttons.
**Confidence** High.

#### DK-5 · Medium · performance · NEW
**Where** `src/scripts/desk/lit-records.js:92-95` (`store.subscribe(() => { generation++; schedule(); })`, no filter), used twice (`highlights.js:112`, `verse-labels.js:54`); `src/scripts/desk/desk-panes.js:411` (My Notes `store.subscribe(() => tab.render())`, no filter); `src/scripts/desk/tab-mine.js:256, 270` (`render` calls `store.all()` twice).
**What happens** Every write to the notebook wakes every listener that did not pass a filter, including the Sheet pane's own autosave (a debounced write about 400 ms after typing stops, `sheet-text.js:39, 218`). On /desk with a LIT pane that has scrolled through N chapters, each such write makes `lit-records` re-read the notebook for each of the N chapters (an IndexedDB `byChapter` query each) in both the highlight watcher and the verse-label watcher, then repaints marks and rewrites every verse number's label; and a My Notes pane re-renders from two full `store.all()` clones (which include every sheet, up to 512 KB each). Sheets and "place" records touch no chapter text, so none of this is needed; `hearsChange` already supports `{ kinds }` and `{ except }` (BA107 used them for the other panes). I checked `hearsChange(undefined, ["sheet"])` is `true`.
**Evidence** Read the subscribers and `desk-store-core.mjs:217-222`. Not measured in a browser; the cost scales with chapters loaded and notebook size, so it is small in a fresh notebook and grows over time.
**Fix** Subscribe `lit-records` with `{ kinds: ["note", "highlight", "bookmark"] }` (what a chapter's marks are), My Notes and Kept with `{ except: ["place", "sheet"] }`, and have My Notes read `store.all()` once per render.
**Confidence** Medium (code-read; measure with a 40-chapter LIT pane and a 300 KB sheet).

#### DK-6 · Medium · a11y · NEW

> **Live check (LV): partly confirmed.** No forced-colors rule names the Search pane’s choice, the Bible order toggle or Stay here; the rendering was not testable.
**Where** `src/styles/desk.css:7509` (`.desk-search__choice[aria-pressed="true"]`), `:7431` (`.desk-search__btn--quiet[aria-pressed="true"]`, the "Bible order" toggle), `:4890` (`.desk-pane__pin[aria-pressed="true"]`, "Stay here"); the forced-colors block at `:5965-6040` lists the other chosen states (`.desk-greek__choice`, `.desk-ws__shape`, `.desk-fns__item--current`) but none of these three.
**What happens** In Windows contrast themes forced colors replaces border colors and drops the tint, so a chosen Greek word, an active "Bible order" and a pinned pane look the same as unchosen ones. `.desk-search__choice` is a copy of `.desk-greek__choice`, which BA141/BA142 fixed with a 3px `Highlight` border; the copy was made after that audit and did not get the same rule. "Stay here" keeps a bolder weight, which is only a faint cue.
**Evidence** Read the CSS; grepped the forced-colors blocks for `search`, `pane__pin`, `btn--quiet` (none). Not run in Chrome's forced-colors emulation.
**Fix** Add the same rules next to line 6017: `.desk-search__choice[aria-pressed="true"]` and `.desk-search__btn--quiet[aria-pressed="true"]` with a `3px solid Highlight` border (padding lessened to match), and the same for `.desk-pane__pin[aria-pressed="true"]`.
**Confidence** Medium (confirm in the emulation, light and dark).

#### DK-7 · Low · a11y · NEW
**Where** `src/scripts/desk/desk-page.js:539-562, 673` (pane `<section aria-labelledby>` pointing at a button whose `aria-label` is "The LIT pane: show something else here"); `src/scripts/desk/lit-pane.js:101-102` (`role="region"` "The LIT text"), `:187, :230` (every chapter `<section aria-labelledby>`); `src/scripts/desk/passage-bar.js:30-33` (`role="search"` named "Passage" on a form that is a picker, in every following pane); `search-pane.js:169-171` (`role="search"` form with no name).
**What happens** A `<section>` with an accessible name is a region landmark, so a page of four panes announces four regions named like an instruction ("The LIT pane: show something else here"), the pane `h2` is read the same way, and every chapter the LIT pane has loaded adds another landmark (60 chapters in a pane, 60 regions). The passage pickers and the Search pane add several `search` landmarks with the same name or none. A landmark list becomes unusable, and "Passage" is not a search.
**Evidence** HTML-AAM maps a named `section` to `region`; read the five sites. Not tried with a screen reader.
**Fix** Name the pane by its kind ("The LIT") and put the "show something else" text in `aria-description` or the menu's label; drop `aria-labelledby` on chapter sections (the `h3` is enough) or use `role="group"`; give the passage form `role="group"` and the Search form the name "Search the LIT".
**Confidence** Medium.

#### DK-8 · Low · a11y · NEW
**Where** `src/scripts/desk/desk-page.js:799-834` (separator pointer drag, arrow keys, double click).
**What happens** A line between panes can be moved by dragging, by arrow keys (keyboard) or evened out by double-click. A pointer user who cannot drag (head pointer, voice control, tremor) has no way to set a size other than "even", and WCAG 2.2 SC 2.5.7 asks for a single-pointer alternative to a drag. The Layout menu's arrangements are click-only but fix sizes at even shares. Moving a pane by dragging has equivalents (the "Show in this pane" menu and arrangements), so only resizing is affected. Separately, the line is a 6px target (`HANDLE`, `desk-layout.mjs:42`) with no larger hit area; WCAG 2.5.8 is probably met by the spacing exception but the handle is hard to land on.
**Evidence** Read `lineBetween`. The separator semantics (role, `aria-orientation`, `aria-valuenow`, labels, arrows, Shift for 10%) are otherwise correct.
**Fix** Show small "narrower / wider" buttons on the focused or hovered line, or in the pane menu ("Make this pane wider"); add an invisible 16 to 24px pseudo-element hit area to `.desk-split__handle`.
**Confidence** Medium.

> **Fixed in FA2-i (2026-11-03, branch claude/audit2-session4; not yet browser-checked):** the line has a 20px hit area, Home and End, and `aria-valuetext`. The pane menu also has Make this pane wider, narrower, taller and shorter (owner question 2, BVJ chose that option on 2026-11-03).

#### DK-9 · Low · usability · NEW
**Where** `src/lib/desk-layout.mjs:234-259` (`applyArrangement`), `src/scripts/desk/desk-page.js:304-309`.
**What happens** Choosing a layout with fewer slots than there are panes closes the extra panes from the end, silently. A reader with LIT, Greek, a Sheet pane and a Search pane who clicks "Two columns" loses the Sheet and Search panes (the Search pane's query and results, a Sheet pane's open sheet), `lit-desk-layout` is overwritten at once, and the announcement says only "Layout: Two columns." There is no undo (the desk's undo bar is not used for layout changes) and "My last layout" is already replaced. Also, a new slot is filled with "the first kind not yet open" (`:248`), so Search and Sheet come last in that order and the reader gets This verse first.
**Evidence** Read `applyArrangement`; ran `dk-layout.mjs` (a 3-pane layout re-applied to "One pane" keeps only the first).
**Fix** Say what closed in the announcement and, ideally, offer "Undo" through `showUndo`; keep the closed panes' kinds in the saved layout until the next arrangement. Fill new slots with the kinds the reader used most recently.
**Confidence** High.

> **Fixed in FA2-i (2026-11-03, branch claude/audit2-session4; not yet browser-checked):** a layout that closes panes names them and offers Undo through the undo bar.

#### DK-10 · Low · usability · NEW
**Where** `src/styles/desk.css:4983-4988` (`.desk-pane__body--fill`, `overflow: hidden`), `:7247-7252` (`.desk-search__top`, `flex: none`), `desk-pane` `min-height: 160px` (`:4800ish`).
**What happens** The Search pane's field, two menus, status line and note are one non-shrinking block (about 84 px, 110 px with a status, more when the note wraps to three lines at 280px wide) under a 40px header. At the 160px minimum height only 10 to 35px is left for results, and a wrapped note pushes the menus out of the pane with `overflow: hidden` and no scrollbar. A reader zoomed to 400% (a 320x180 viewport) gets a Search pane they cannot use.
**Evidence** Computed from the CSS; not measured in a browser.
**Fix** Let `.desk-search__top` scroll with the results when the pane is short (one scroller, `overflow-y: auto` on `.desk-search`), or collapse the type and book menus into a "Filters" disclosure below about 260px of height.
**Confidence** Medium.

> **Fixed in FA2-i (2026-11-03, branch claude/audit2-session4; not yet browser-checked):** the Search pane's field and menus scroll (max 60% of the pane) so results keep room.

#### DK-11 · Low · data-integrity · NEW

> **Fixed in FA2-i (2026-11-03, branch claude/audit2-session4; not yet browser-checked):** `save()` writes only `last` over the key as it is now; the start radios and Make this my default re-read it too.

> **Live check (LV): confirmed** with a simulated second tab: the next layout save wrote back start “last” and dropped “mine.”
**Where** `src/scripts/desk/desk-page.js:254` (`let saved = readSaved(readKey())`, read once) and `:481-484` (`save()` writes `{ ...saved, last: layout }`); no `storage` listener anywhere in the file.
**What happens** The layout key holds three things: the last layout, the reader's default and which one opens the page. Each /desk tab keeps its own copy of all three from load. If a second tab sets "Make this my default" (or "When this page opens, show: My default") and the first tab, opened earlier, then scrolls its LIT pane (which saves on every verse change), the first tab writes back its old `mine: null`, and the default and the opening choice are gone with no message. Two /desk tabs are plausible (the sheet page's "Edit on the Study Desk" opens `/desk/?sheet=`).
**Evidence** Read `save`, `refreshMenu`, `makeDefault`; no `storage` event handling.
**Fix** In `save()`, re-read the key and merge only `last` into it (leave `mine` and `start` to the tab that changed them), or listen for `storage` and adopt the other tab's `mine`/`start`.
**Confidence** High.

#### DK-12 · Low · usability · NEW
**Where** `src/styles/desk.css` (no `@media print` for `.desk-ws`, `.desk-pane`, `.desk-split`; checked every print block at 345, 1178, 1335, 1689, 2168, 2431, 2909, 3517, 6857, 7064) and `src/styles/print.css:53,106`.
**What happens** The header's Print menu is the designed route (BVJ 2026-10-29), but Ctrl+P on /desk still prints the workspace: pane chrome (close buttons, "Stay here", menus), scroll containers cut at their on-screen height, and the fixed-height panes box across pages. Someone who presses Ctrl+P instead of using the menu gets an unusable page and no hint of the menu.
**Evidence** Read the print blocks; not printed.
**Fix** Under `@media print` on `html[data-desk-workspace]`, hide the panes and show one line ("Use Print in the header to print a chapter."), or print the leading LIT pane's chapter.
**Confidence** Medium.

> **Fixed in FA2-i (2026-11-03, branch claude/audit2-session4; not yet browser-checked):** `@media print` on /desk hides the panes and says where Print is.

#### DK-13 · Low · a11y · NEW

> **Live check (LV): not reproduced in the common case** (Escape closed the menu and returned focus). The no-link case was not driven.
**Where** `src/scripts/desk/desk-page.js:422-441, 453-455` (`openPrintMenu`, `closePrintMenu`, the menu's Escape handler); `:371-373` (Layout menu's).
**What happens** When the Print menu has no link to show (a draft chapter, or no place), `(printLinks.find(...) ?? printMenu).focus?.()` calls `focus()` on a `div` with no `tabindex`, which does nothing. Focus stays on the Print button, but the Escape handler is on the menu, not the button, so Escape does nothing and the menu stays open until the reader clicks or Tabs away. The same applies to the Layout menu if the reader Shift+Tabs back to the button.
**Evidence** Read the code; no test run.
**Fix** Give the menus `tabindex="-1"` so they take focus, or attach the Escape handler to the button too.
**Confidence** High.

#### DK-14 · Low · a11y · NEW
**Where** `src/scripts/desk/sheet-pane.js:260-261, 295, 329` (`status` is `role="status"`, set to "Saving…" then "Saved" on every autosave).
**What happens** Each autosave (about every 400ms of a pause while typing) sets a polite live region twice. A screen-reader user typing in a sheet hears "Saving… Saved" repeatedly between phrases, and the text they typed is read after it. Failures ("Not saved, so that change was taken back", `:351-353`) are in the same region and deserve to be heard.
**Evidence** Read `change` and `buildSheet`.
**Fix** Keep "Saving…/Saved" visible but `aria-hidden` (or not live), and announce only failures and explicit actions through `say`.
**Confidence** Medium.

#### DK-15 · Low · performance · NEW
**Where** `src/scripts/desk/lit-pane.js:341-387` (`fill`), `:107-110` (`sections`), `src/scripts/desk/chapter-page.js:22-23` (`cache`, `loaded`), `src/scripts/desk/verse-labels.js:104-110` (`label` over every loaded chapter).
**What happens** A LIT pane never releases a chapter it has loaded (`sections` and the DOM only grow; each chapter is also kept in `chapter-page.js`'s caches). I rendered every published chapter with the real `prepareStudyParagraph` and parsed it: **211 chapters hold 41,045 elements (77,527 nodes), 195 elements a chapter on average, 613 at most (Luke 1)**, before the term lens, highlights and the page's second copy. So reading the whole New Testament in one pane is about 41k elements, and two LIT panes double it. That is heavy only on slow devices, but it also means `applyAll` in `verse-labels.js` walks every verse number of every loaded chapter on each change (8,000 for the whole book), and the cost grows with the 49 draft chapters when they publish.
**Evidence** `dk-dom.mjs` in the scratchpad. Not run in a browser.
**Fix** Optional: when more than about 30 sections are loaded, drop (replace with a measured placeholder of the same height) sections more than 3 pane heights from the reading line; at minimum bound `label()` to chapters near the pane's viewport.
**Confidence** High on the facts, Low on the need.

#### DK-16 · Nit · a11y · NEW
**Where** `src/scripts/desk/sheet-present.js:696-698` (`clock` is a `<p aria-label=...>`); `src/scripts/desk/sheet-pane.js:606, 687` (the "Nothing on this sheet yet" `<p>` is a child of a `role="list"`); `src/lib/desk-print-notes.mjs:173-175` (`printHref` hardcodes `/`, where `chapterHref` uses `BASE`).
**What happens** `aria-label` on a generic paragraph is ignored by some screen readers (use `role="timer"`); a non-listitem inside a list is invalid ARIA; the hardcoded `/` would break the Print menu if the site were ever served from a subpath.
**Fix** `role="timer"` with the label; move the empty note outside the list; pass `BASE` into `printHref`.
**Confidence** Medium.

### Improvements

- **Search is hard to find.** The Layout menu and the "When this page opens" note never mention it; only `/` and the pane-name menu reach it, and a new slot is filled with it last (`desk-layout.mjs:248`). A "+ Add pane" menu in the header (kinds in use, then the rest) would be the first place a reader looks.
- **Duplicate a sheet.** A leader reusing last week's handout has no "Duplicate" (grep finds none in `sheet-pane.js` or `desk-sheets.mjs`); the only copy route is a share link or file. The list also has no way to rename or search, which matters past a dozen sheets.
- **Sheet list: confirm what Delete does.** Delete is undoable from the bar, but the bar is time-limited and the list row gives no hint; "Delete …" next to "Open …" is easy to hit.
- **The "Leading" chip explains itself only in a `title`** (`desk-page.js:553`), which keyboard and touch readers never see; a visible "Leading: My Notes and others follow" line in the pane's menu would help.
- **`+ Passage` form** (`sheet-pane.js:944-1109`): focus does not move into the reference field when it opens and Escape does not close it, unlike the template chooser beside it (`:477-482`).
- **Glossary entry in the Search pane** (`search-pane.js:742-795`): the loading line and the arrival of the entry are silent; move focus to the entry's heading when it arrives.
- **Search "+" buttons** are `opacity: 0` until hover or focus (`desk.css:7449-7470`); a faint resting state would tell a pointer reader they exist.
- **Separators** could also answer Home and End (min and max), and carry `aria-valuetext` ("60 percent, My Notes 40 percent").
- **Sheet autosave status** would be clearer as a single "All changes saved" line that settles, instead of flipping between "Saving…" and "Saved".

### Questions for the owner

1. Should every chapter loaded in a LIT pane stay a landmark (DK-7), and should a long scroll ever release chapters (DK-15)? Both follow from "the pane scrolls the whole New Testament" (rule 18), which is deliberate.
2. Is a click-only way to set pane sizes wanted (DK-8), given the arrangements already offer click-only layouts?
3. Should a smaller arrangement ask or offer undo before closing panes (DK-9)? "Closed from the end" is documented in `applyArrangement`, so it may be intended.
4. Does the Search pane stay unrecorded between reloads by design (yes, per 3m); would a "recent searches" list that stays in the session be acceptable under /privacy's wording, since the desk keeps other session state?
5. Is "Duplicate sheet" planned? STUDY-DESK.md has no mention of it.

### What held up

- **Layout rules.** `dk-layout.mjs` exercised: `openKind` opens up to four panes and refuses a fifth; every arrangement fits 1280x700; `fitSizes` at 600x400 and 300x200 keeps minimums; `resize` never crushes a pane; `checkLayout` drops bad ids and sizes. `/` with no room says "Close a pane to open search." and a Greek hit with no room says so.
- **Separators** are proper: `role="separator"`, `aria-orientation`, `aria-valuemin/max/now` (kept current by `sizeSplit`), a name that says which panes it divides, arrows with Shift for 10%, `touch-action: none`.
- **The pane-name menu** (`desk-page.js:696-739`) has `menuitemradio`, arrows, Home and End, Escape and Tab handling, focus return, and is placed on the screen so it is not clipped (BA122).
- **Layout and Print menus** close on Escape (with focus back), on focusout, and on an outside press. The arrangements say why they are unavailable through `aria-describedby`.
- **Pane moving** by drag has Escape to cancel, a "No room here" refusal and an announcement, and the sheet's parts reorder with ↑/↓ buttons that keep focus and announce the new position, so dragging is never the only route (2.5.7 is met there).
- **Draw preserves state.** `draw()` reuses each pane's element, notes every scrolled box and the LIT pane's reading line (`keepScroll`, `keep`), and puts focus back (`desk-page.js:629-662`). Inputs keep value and selection. The caret of a `contenteditable` would be lost on a redraw, but no redraw is started from inside a sheet editor.
- **LIT pane.** No feedback loop: the `ResizeObserver` (`lit-pane.js:530`) watches the scroller's size and only changes `scrollTop` and a padding variable, neither of which resizes it. `fill()` cannot run away (stalled flags, `seq`, bounded by `AHEAD`). A failed chapter above or below shows "This chapter couldn’t be loaded." with Try again. `destroy()` removes the observer, frame, timers, lenses, tools and the page-text registration.
- **Listener hygiene across destroy**: LIT, Search (`offTarget`, commands window), Sheet (visibility, pageshow, pagehide, subscriptions, `openPanes`, blank highlight ranges) and the editor (`selectionchange`, `mousedown`) all remove what they add. Page-level listeners in `desk-page.js` live as long as the page.
- **Sheet editor.** Toolbar has `role="toolbar"`, a label naming the field, a roving tab stop, Left/Right/Home/End, `aria-pressed` on toggles, `aria-keyshortcuts`, menus with `menuitemradio`; Ctrl+Z inside the editor stays the editor's own; paste and drop go through the sanitizer; `input` only resets the HTML when the box is truly empty, so IME composition is not interrupted; saves flush on blur, pagehide and destroy.
- **Present mode.** `role="dialog"` with `aria-modal`, everything behind `inert`, keys heard in the capture phase on the document, a control about to be disabled hands focus to the stage first (BA79), focus returns to the opener, screens and reveals are announced through a polite region, Escape defers to the browser's full-screen exit. The pinned focus ring (LIT Green on `#111511`) is about 5.3:1.
- **Print.** `printLook` allows one desk print at a time and always removes the attribute (`afterprint`, or the reader's next focus, pointer or key); `print-notes.js` joins every split text node back into the original; `?print=` is stripped from the address before it prints; `printHref` and `parsePrintParam` agree (`dk-print.mjs`).
- **Share dialog** is a native modal `<dialog>` with its own heading, focus return and status line.
- **Copy.** No British spelling and no em dash in any reader-facing string of the slice; lists use the Oxford comma; "Study View", "Read View" and the pane names are consistent.
- **CSS.** New Search pane colors all come from tokens (no hand-written dark-mode values), focus rings use `--focus-ring`, no `ch` unit anywhere in `desk.css`, `sheets-page.css` or `desk-page.css`, controls are 26 to 30px except the 6px separators (DK-8), and the two dark-mode blocks are paired in the three places they occur.
- **Injection, in passing.** The Search pane's `innerHTML` uses are all escaped (`highlightVerseHit` escapes every run, `creditHtml(escapeHtml)`, `describeGreekQuery` with `escapeHtml`); a cloned glossary entry has its ids stripped and its links re-targeted; `readOnlyRich` goes through `sheetHtmlForShow`. Nothing alarming.

### Not reached

- No real browser, screen reader, forced-colors emulation, Safari, Firefox, touch or 400% zoom run: DK-1 to DK-6, DK-10 and DK-14 are code reads and should be confirmed that way.
- Not measured: the cost in DK-5 and DK-15 (a browser profile with a 40-chapter LIT pane, 300 notes and a 300 KB sheet would settle both).
- `sheet-lit.js` below line 460 (hint selects, footnote chooser, license card), `sheet-word.js`, `sheet-copy.js`, `search-sheet.js` and `desk-lit-text.mjs` were read only for structure; `desk-sheet-*.mjs` and the sanitizer belong to other auditors.
- Whether Safari's `window.print()` returns before the dialog closes (`print-look.js` relies on it for its "next event ends the look" fallback) was not tested.
- The first-arrival experience with a brand-new notebook was reasoned from the code (Continue reading place, My Notes empty state), not walked through.

## Appendix E: The Greek tab, Greek search and notebook search (`GK`, Sonnet)

Branch `claude/phase5-work-sessions`, checkout of 2026-11-03. Auditor: Greek slice.
Throwaway scripts are in `...\scratchpad\gk\` (integrity.mjs, battery1.mjs, battery2.mjs, formclick.mjs,
redos.mjs, brute.mjs, fuzz.mjs, fuzz2.mjs, nbsearch.mjs, langs.mjs, contrast.mjs and others). Nothing in the repo was touched.

### Summary

The slice is in good shape. The committed data is clean: all 260 chapters, 137,794 words, 7,942 verses, NFC throughout,
and every lemma reference resolves in the UBS, STEP and LSJ shards. The pure search modules survived about 130 hand-picked
queries, a 4,000-query end-to-end fuzz and a 60,000-query escaping fuzz with no exception and no unescaped output, and
`matchConstruction` agrees with a brute-force enumerator on 20,000 random cases. The 192 Greek-related unit tests pass.
Nothing downloads for a reader without the preview.

20 findings: 0 Critical, 0 High, 3 Medium, 15 Low, 2 Nit. All 20 are NEW; none of the BA110 to BA120 fixes has regressed.
The three Medium findings are real, user-visible and cheap to fix:
(1) the word-details "form" button searches a different word for 88 form/lemma pairs (3,850 words, including every
feminine article ἡ and every αὐτοῦ); (2) the lexicon entry bodies contain about 1.9 million Greek and 32,000 Hebrew
characters with no `lang` attribute anywhere; (3) the SBLGNT's text-critical signs have no font patch under
Atkinson Hyperlegible or OpenDyslexic, although the ⟦ ⟧ brackets do. The rest are edge cases, polish and two
low-confidence accessibility risks that need a screen reader or forced-colors browser to settle.

### Findings

#### GK-1 · Medium · bug · NEW

> **Re-run by the orchestrator:** `formclick.mjs` reproduces the mismatches (for example Ὃ goes to ὁ, Ἐξ to ἕξ).
**Where** `src/scripts/desk/tab-greek.js:887` (the form button), `src/scripts/desk/greek-find.js:300-303`,
`src/lib/greek-search.mjs:364-366`.

**What happens** In a word's details, the big Greek form at the top is a button that searches "this form, exact"
and prefers the clicked word's lemma. But `matchGreek` resolves a typed Greek word to *a lemma whose folded spelling
equals it, if there is one, and to the forms of other lemmas only when there is not* (`asLemma ?? byForm`). When the
form folds the same as some other word's headword, the clicked word's own lemma is never among the results, so
`greek-find.js` quietly shows the other word. Examples, all through `searchGreekAuto(..., { exactForm: true })`:

| Clicked form (lemma) | Words in the NT | Tab shows instead |
|---|---|---|
| αὐτοῦ (αὐτός) | 1,411 | lemma αὐτοῦ, 4 hits |
| ἡ (ὁ, the feminine article) | 953 + 27 (Ἡ) + 4 (ἥ) | ἤ "or/than", 346 hits |
| ἐξ (ἐκ) | 227 | ἕξ "six", 13 hits |
| ὃ (ὅς) | 203 | ὁ, 2,922 hits |
| ᾧ, οὗ (ὅς) | 119, 116 | ὦ/Ὦ; οὐ/οὗ/οὔ |
| εἶ (εἰμί) | 92 | εἰ "if", 502 hits |
| μόνον, πρῶτον, ἓν, οὓς, ᾖ, ᾗ ... | 70, 63, 52, 51, 43, 37 | another headword |

In all, 88 of 19,414 distinct (lemma, form) pairs, covering 3,850 of 137,794 words (2.8%), land on the wrong word.
The results header does name the lemma it found, but a reader who clicked the article ἡ is told about "or".
The same lemma-first rule hits typed command terms: `ἡ.fem` returns 0 matches, while `=ἡ` returns 1,100.

**Evidence** `formclick.mjs` runs `matchGreek` for every distinct (lemma, form) pair in the 260 chapter files and checks that
the clicked word's lemma is among the results (88 fail). `clickrepro.mjs` reproduces the tab's exact flow through
`searchGreekAuto`. The design line "A lemma typed directly finds that lemma alone" (greek-search.mjs:13) is about
what a reader types; the tab's starter is not typed, it knows the lemma it came from.

**Fix** Give the tab's form starter the clicked word's lemma id (the lemma string is unique in the index) and let
`searchGreek` honour a `lemmaId` that is not in `match.lemmas` when a form is being searched exactly; or, when
`exactForm` is set, have `matchGreek` return the union of `byFold` and `byForm` ids with the lemma match first.
Add a test over the committed data: for every pair, the form starter's result includes the clicked lemma.
For typed queries, decide separately whether `ἡ`, `ἐξ` and `αὐτοῦ` should also offer the article/ἐκ/αὐτός forms
(see Questions).

**Confidence** High.

> **Fixed in FA2-s (2026-11-03, branch claude/audit2-session8-greek; not yet browser-checked):** `matchGreek` takes `exactForm`: a form is also looked up among every lemma's forms, after the lemma it spells, and the tab's form button asks that way. A test runs every (lemma, form) pair of the committed text (19,414) and finds each lemma. A typed word that could be several (`ἡ`, `ἐξ`, `αὐτοῦ`) now offers each, commonest first (decision 9, BVJ 2026-11-03); a command query stays lemma-first.

#### GK-2 · Medium · a11y · NEW
**Where** `src/scripts/desk/tab-greek.js:86-119` (`sanitizeInto`), used at `:1093` and `:1124`; data in `public/greek/step/`, `lsj/`, `ubs/`.

**What happens** The STEPBible and LSJ entries, and the UBS definitions, are mostly English with Greek and Hebrew
quotations inside. Only the entry's headword (`<b lang="grc">`) is marked. The sanitizer keeps just `b`, `i`, `br`,
`span.lex-ref` and `abbr[title]` and no `lang`, and none of the committed HTML has one. A screen reader therefore
reads Greek and Hebrew letters in the English voice (skipped or spelled out). The scale, counted by `langs.mjs`:
STEP 5,349 entries, 4,925 with Greek (114,143 characters) and 3,305 with Hebrew (30,566); LSJ 5,350 entries, 5,253 with
Greek (1,775,076 characters) and 223 with Hebrew; UBS 2,082 of 5,363 entries with Greek. Zero `lang=` attributes.
This is WCAG 3.1.2 (Language of Parts, AA). I rate it Medium rather than High because the lemma, form, parsing, gloss
and Strong's number are all marked or in English; what is lost is the quoted Greek and Hebrew in the lexicon prose.

**Fix** In `sanitizeInto`'s text-node branch (or once, at `build:greek`), wrap runs of
`[\u0370-\u03FF\u1F00-\u1FFF]` (with the spaces, commas and combining marks between them) in `<span lang="grc">` and runs of
`[\u0590-\u05FF\uFB1D-\uFB4F]` in `<span lang="he">`. The same for UBS `def`, `glosses` and `comment`.

**Confidence** High on the facts; Medium on how a given screen reader voices it (not tested).

> **Fixed in FA2-t (2026-11-03, branch claude/audit2-session8-greek; not yet browser-checked):** `langRuns` (`desk-greek.mjs`) splits text into Greek, Hebrew and English runs; `sanitizeInto` and the UBS definition, glosses and comment wrap them in `lang` spans. Which voice a screen reader picks is untested.

#### GK-3 · Medium · compat · NEW
**Where** `src/styles/greek-hebrew-fonts.css:443-520` versus `src/styles/global.css:50-73` and `:2566-2573`.

**What happens** The six text-critical signs ⸀ ⸁ ⸂ ⸃ ⸄ ⸅ (8,705 in the Greek text, each a button that is the reader's only visual route to an apparatus note, and 111 more in the
apparatus itself) are patched into the site
fonts by `text-critical-signs.otf`, but only under `Crimson Text` (4 faces) and `Inter` (4 faces). The ⟦ ⟧ brackets
have the same kind of patch registered under `Inter`, `OpenDyslexic` and `Atkinson Hyperlegible Next Variable`, and
`global.css:63-67` records that Atkinson's brackets drew from Cambria Math until 2026-10 because the patch was missing.
The Display tray forces `font-family: 'OpenDyslexic', sans-serif !important` or
`'Atkinson Hyperlegible Next Variable', sans-serif !important` on every element (`global.css:2566-2573`), so with either
font chosen the signs fall through to whatever system font has U+2E00 to U+2E05, or to a missing-glyph box.
The Greek letters themselves are covered for both fonts (the Inter Greek files are registered under their names).
Readers who pick those fonts are exactly the readers the Display tray's accessibility fonts are for.

**Evidence** Read from the two stylesheets; `signs.mjs` counts U+2E00 to U+2E05 in the data. I could not render it
(no browser allowed), so the glyph that actually appears depends on the reader's system fonts.

**Fix** Register `/fonts/text-critical-signs.otf` under `OpenDyslexic` (400, 700, upright and italic as the family
declares) and `Atkinson Hyperlegible Next Variable` (`font-weight: 200 800`, normal and italic), `unicode-range: U+2E00-2E05`,
the way global.css does for the brackets. Confirm with `CSS.getPlatformFontsForNode` on `data-font="atkinson"` and `"dyslexic"`.

**Confidence** Medium (code is conclusive; the visible result needs a browser check).

> **Fixed in FA2-t (2026-11-03, branch claude/audit2-session8-greek; not yet browser-checked):** `text-critical-signs.otf` is registered under OpenDyslexic (400 and 700, upright and italic) and Atkinson (200 800, both styles). Not yet checked with `CSS.getPlatformFontsForNode`.

#### GK-4 · Low · usability · NEW
**Where** `src/lib/greek-search.mjs:181-184` (`longEnoughForGreek`) versus `src/scripts/search-core.js:1379-1385`
(`couldBeGreek`); message at `src/scripts/desk/greek-find.js:279-283`.

**What happens** `longEnoughForGreek` lets a two-character Latin query through ("anything else from two characters"),
but `couldBeGreek` then rejects any Latin query shorter than three characters. So `de` (δέ), `ou` (οὐ), `ei` (εἰ),
`en` (ἐν), `ho` (ὁ), and English glosses such as `go` or `be`, all return nothing, though `matchGreek` finds each
(`matchGreek("de")` gives δέ, δή; `"ou"` gives οὐ, οὗ, οὔ). In the tab the reader is told "No Greek matches. Try one
word at a time, or see the search commands." for what already is one word. These are some of the commonest Greek words.

**Evidence** `twochar.mjs`: 22 two-letter Latin queries, all `kind: null`, `longEnoughForGreek` true, `couldBeGreek` false.

**Fix** Make `couldBeGreek` accept two Latin letters when a transliteration key or gloss exists (it is cheap: `matchGreek`
already does the work), or lower its floor to 2 to match `longEnoughForGreek`, and keep one test that both gates agree.

**Confidence** High.

> **Fixed in FA2-s (2026-11-03, branch claude/audit2-session8-greek; not yet browser-checked):** `couldBeGreek` takes two Latin letters; a test holds it to `longEnoughForGreek`.

#### GK-5 · Low · bug · NEW
**Where** `src/lib/desk-search.mjs:29` and `:32`; note bodies are not normalized on save (no `normalize` in
`note-editor.js`, `store.js` or `desk-store-core.mjs`).

**What happens** The notebook search tokenizes with `/[\p{L}\p{N}]+/gu`, which excludes combining marks. Text in NFD
(typed or pasted from some keyboards, PDFs and macOS file names) is split at each accent, and an NFD query is split
the same way, so one form misses the other. Results from `nbsearch.mjs`:

| Note | Query | Result |
|---|---|---|
| NFC πίστις | NFC πίστις | found |
| NFD πίστις | NFC πίστις | miss |
| NFC πίστις | NFD πίστις | miss |
| NFD "naïve" | "naive" | miss |
| Hebrew with niqqud | bare consonants | miss (the points are marks, and U+05B0 to 05C7 is not folded) |
| "λόγοϲ" (lunate sigma) | "λόγος" | miss (greek-search.mjs folds ϲ, this does not) |

**Fix** Normalize both sides to NFC before tokenizing (`wordsOf` and `searchTokens`), include `\p{M}` in the word regex,
and extend `fold` with Hebrew points (U+0591 to U+05C7) and ϲ → σ.

**Confidence** High on behavior; Medium on how often NFD input arrives.
Related, not a defect at today's sizes: `readRecords()` does a full `getAll()` on every search, and 20,000 notes of about
600 characters took 1.7 s per query (790 ms for a miss). A typical notebook is far smaller.

> **Fixed in FA2-s (2026-11-03, branch claude/audit2-session8-greek; not yet browser-checked):** The notebook search's word pattern includes combining marks, and its fold drops Hebrew points and reads ϲ as σ. Both sides still go through the same fold, so NFC and NFD agree.

#### GK-6 · Low · bug · NEW
**Where** `src/scripts/desk/greek-find.js:413-421`, with `src/scripts/search-core.js:1431-1446` returning null for a failed shard.

**What happens** When an occurrence shard fails to load (offline, a 5xx), a normal search says "The verses couldn't be
loaded." with a Try again button, because `sel.count > 0` proves something is missing. In the exact-form case the check
is skipped (`&& !state.exact`), and the reader is told "This exact form doesn't occur. Clear “Exact form only” to see
every form." The checkbox is hidden (`otherForms` is false without the entry) and there is no retry. The form button
in the word details always searches exact, so this is the path a reader on a flaky connection meets first.

**Evidence** `offline.mjs` fails `greek/search/occ/*` and calls `searchGreekAuto("πίστεως", { exactForm: true })`: `total 0`,
`otherForms false`, no failure flag.

**Fix** Have `searchGreek` return `failed: true` when `loadGreekOccurrences` returns null for a lemma with `count > 0`, as
`searchGreekCommands` already does, and branch on that in `paint`.

**Confidence** High.

> **Fixed in FA2-s (2026-11-03, branch claude/audit2-session8-greek; not yet browser-checked):** `searchGreek` returns `failed` when a word's shard doesn't load, and the tab shows "The verses couldn’t be loaded" with Try again for an exact form too.

#### GK-7 · Low · performance · NEW
**Where** `src/lib/greek-query.mjs:196` (`PENDING`) and `:242` (the `while` that strips it).

**What happens** `parseGreekQuery` strips one pending token per loop turn, and each turn tests a regex that scans from
every start position, so a long run of trailing commas, dots, spaces or "exact " is quadratic. None of the three
inputs (tab, tray, /search) has a `maxlength`. Measured in node (`redos.mjs`, `battery2.mjs`):

| Input | 5,000 | 10,000 | 20,000 | 100,000 |
|---|---|---|---|---|
| `,` repeated | 135 ms | 490 ms | 2.0 s | 50.6 s |
| `.` repeated | 131 ms | 467 ms | 2.1 s | 56.4 s |
| `a`, spaces, `b` | 43 ms | 172 ms | 770 ms | 18.6 s |
| `exact ` repeated | 16 ms | 59 ms | 259 ms | 9.9 s (120k chars) |

A pasted 2.4 KB paragraph takes 8 ms, so this needs a deliberate or accidental giant paste; the tab runs the parser on the
main thread 180 ms after the last keystroke.

**Fix** Clamp the query (for example 300 characters) at the top of `searchGreekAuto`/`parseGreekQuery` and add a
`maxlength` to the inputs, or replace the loop with one anchored `(?:PENDING)+$` match.

**Confidence** High.

> **Fixed in FA2-s (2026-11-03, branch claude/audit2-session8-greek; not yet browser-checked):** `parseGreekQuery` reads at most 300 characters (`MAX_QUERY_LENGTH`); a 100,000-character run now takes under 10 ms. The builder's word field has a `maxLength`; the search bar's own field has none, since the clamp is what protects the parser.

#### GK-8 · Low · usability · NEW
**Where** `src/lib/greek-commands-ui.mjs:18` and `:30-46` (`insertAtCursor`, `JOINS`).

**What happens** The commands window inserts "=" at the cursor, joined to the text before it. Typing `πίστεως` and then
pressing "= This form only" gives `πίστεως=`, which the parser treats as a command still being typed and drops, so the
search silently stays on all 243 forms. "=" works only when pressed on an empty or word-start position. (The `"` and `/`
buttons are fine: `"` after a word is a stray quote, but `/` is meant to follow a word.)

**Evidence** `insert.mjs`: `("πίστεως", 7, "=")` returns `πίστεως=`; both queries return 243 hits.

**Fix** For "=", insert at the start of the word under the cursor (or select the word and wrap), and have the window
announce "Added: This form only." only when it changed the meaning.

**Confidence** High.

> **Fixed in FA2-s (2026-11-03, branch claude/audit2-session8-greek; not yet browser-checked):** "=" goes to the front of the word the cursor is in or after.

#### GK-9 · Low · performance · NEW
**Where** `public/_headers` (no `/greek/*` rule).

**What happens** Live check (`curl -I`): `/greek/text/john-3.json` and `/greek/search/lemmas.json` return
`Cache-Control: public, max-age=0, must-revalidate` and `cf-cache-status: DYNAMIC`. Every chapter, shard and index
file is revalidated on every page load, and Cloudflare does not hold JSON at the edge by default. `*.sg` alone
requests 54 parse files, and a chapter's worth of word clicks asks for dozens of shards, each a conditional
round trip. These files change only when `build:greek` is re-run by hand.

**Fix** Add `/greek/*` with `Cache-Control: public, max-age=86400, must-revalidate` (the `/assets/*` pattern in the same file) and,
if edge caching is wanted, a Cloudflare Cache Rule for `/greek/*`.

**Confidence** High.

> **Fixed in FA2-u (2026-11-03, branch claude/audit2-session8-greek):** `/greek/*` takes `public/_headers`' day of `max-age` with `must-revalidate`, the `/assets/*` pattern (BVJ, decision 9). Not checked against the deployed headers; `curl -I` a `/greek/` file after the deploy.

#### GK-10 · Low · performance · NEW
**Where** `src/scripts/desk/tab-greek.js:601-619` and `:693-701` (arrow keys call `select`), `:874-947`, `:1018-1035`;
`src/scripts/desk/greek-data.js:11-23` (the cache is never trimmed).

**What happens** Moving with the arrow keys *selects* each word, and selecting runs `showDetails`, which requests the
word's lexicon shard. `lexSeq` drops stale results but not stale requests. In STEPBible mode every word also loads
its STEP shard and its full LSJ shard (up to 200 KB raw, 68 KB gzipped). A chapter has about 400 distinct lemmas,
so holding an arrow key through it touches essentially every shard: expected 64 of 64 UBS or STEP and about 122 of 128
LSJ, roughly 7 MB gzipped and 25 MB of JSON to parse, then kept for the life of the page. Clicking words one at a time
is intentional and cheap; this is the keyboard path.

**Fix** Debounce the lexicon render by about 150 ms after the last move (announce the word at once), and drop shard
promises that nothing references when a pane is destroyed.

**Confidence** Medium (arithmetic from the shard sizes and a Strong's-mod-N distribution, not measured in a browser).

#### GK-11 · Low · a11y · NEW
**Where** `src/scripts/desk/tab-greek.js:337` (`p.lang = "grc"`), `:344` (`make("span", "sr-only", "Verse ")`), `:304`
(`aria-label="Apparatus note on verse N"`).

**What happens** Each paragraph is `lang="grc"`, and the English screen-reader label "Verse " and the verse digits, and
every sign button's English `aria-label`, sit inside it, so a screen reader that switches voice by `lang` reads them in
a Greek voice. The word details and results are correctly outside the Greek paragraphs.

**Fix** Put `lang="grc"` on each word button (or wrap each word) rather than on the paragraph, or set `lang="en"` on the
`sr-only` label and the sign buttons.

**Confidence** Medium (depends on the screen reader).

> **Fixed in FA2-t (2026-11-03, branch claude/audit2-session8-greek; not yet browser-checked):** `lang="grc"` is on each word button, not the paragraph.

#### GK-12 · Low · a11y · NEW
**Where** `src/scripts/desk/tab-greek.js:106-111` (`sanitizeInto` keeps `abbr[title]`) and the LSJ HTML in `public/greek/lsj/`; `desk.css:4064-4067` styles it as a dotted underline with `cursor: help`.

**What happens** The LSJ entries carry 76,389 `abbr[title]` tags (4,869 of 5,350 entries; the average title is 117 characters)
with the "revealing examples from Greek literature" as hover text. Hover is the only way in: an `abbr` is not focusable and
a touch screen has no hover. Keyboard-only readers cannot read any of the evidence, and screen readers vary in whether
they voice a title at all (WCAG 1.4.13 and 2.1.1 in spirit).

**Fix** Render the abbreviation as a button that opens a small popover (or add a "show sources" switch that expands the
titles inline), or at least add `tabindex="0"` and show the title on focus.

**Confidence** High on the facts.

> **Fixed in FA2-t (2026-11-03, branch claude/audit2-session8-greek; not yet browser-checked):** Each lexicon entry that cites sources gets a "Show sources" button that writes the abbreviations' titles out in brackets; the hover remains.

#### GK-13 · Low · docs · NEW
**Where** `src/scripts/desk/greek-find.js` (no credit drawn); rule 14/15 in `src/scripts/desk/CLAUDE.md` ("every group of
Greek search results carries `SEARCH_CREDIT`... a new place that shows Greek results draws it too").

**What happens** The tray, /search and the Search pane draw the credit under their Greek groups (searchbar.js:599,
search.astro:113, search-pane.js:860). The Greek tab's own result list does not, and the tab's "Sources and licenses"
sits at the foot of the *text*, which is hidden while results are showing (`greek-find.js:141`). The reader reaches it
only by pressing "Back to the text" and scrolling to the bottom. It is arguably covered by the tab, but the rule as written
says every place.

**Fix** Draw `creditHtml(escapeHtml)` (or the same parts) under the hits list, and say in rule 14 whether the tab is exempt.

**Confidence** High.

> **Fixed in FA2-u (2026-11-03, branch claude/audit2-session8-greek; not yet browser-checked):** The tab's results end with the one-line credit, its links in a new tab.

#### GK-14 · Low · longevity · NEW
**Where** `src/scripts/search-core.js:1254` and `:1272`; `src/scripts/desk/greek-data.js:25-27`; `src/scripts/desk/tab-greek.js:267-289`.

**What happens** (a) `deskSearchPromise ||= import(...).catch(() => null)` caches the *null*, so one failed dynamic import
(typically a page left open across a deploy, when the hashed chunk 404s) switches the notebook group and the commands
off until the page is reloaded; the Pagefind loader beside it deliberately forgets failures. (b) `loadChapterGreek` returns
the JSON unchecked; no code reads `format` for a chapter, UBS, STEP or LSJ file. A future format change would make
`build()` throw inside the `.then` of `ensure()`, leaving "Loading the Greek…" up for good with no message or retry.
`prepareIndex` and `decodeParseGroup` do check their formats and degrade properly.

**Fix** Clear the cached promise on failure, as `loadPagefind` does; check `d.format === 1 && Array.isArray(d.paragraphs)` in
`ensure()` and show the existing "couldn't be loaded" status with Try again.

**Confidence** Medium (reasoned from the code; not provoked in a browser).

> **Fixed in FA2-u (2026-11-03, branch claude/audit2-session8-greek; not yet browser-checked):** A failed desk-search or sheets import is forgotten, so the next call tries again; the tab checks a chapter file's format and says "couldn’t be loaded" with Try again.

#### GK-15 · Low · bug · NEW
**Where** `src/lib/greek-search.mjs:65-73` (`foldGreek`).

**What happens** Compatibility letters are dropped, not folded, because `NOT_GREEK` is `[^α-ω]`: `ϕίλος` (U+03D5) folds to
`ιλοσ`, `ϑεός` to `εοσ`, `ϖνεῦμα`, `ϱῆμα`, `ϰύριος` and `ϵγώ` likewise, and each finds nothing. These come from math keyboards and
copied web pages. (Lunate sigma ϲ and capital Ϲ are handled.)

**Fix** Map ϑ→θ, ϕ→φ, ϖ→π, ϱ→ρ, ϰ→κ, ϵ→ε (or use NFKD) before `NOT_GREEK`. `build:greek` uses the same function, so re-run
the build to check `public/greek/search/` does not change.

**Confidence** High.

> **Fixed in FA2-s (2026-11-03, branch claude/audit2-session8-greek; not yet browser-checked):** `foldGreek` maps ϑ ϕ ϖ ϱ ϰ ϵ to their letters. None occurs in the committed text or index, so `build:greek` output is unchanged (checked, not re-run).

#### GK-16 · Low · a11y · NEW (low confidence)
**Where** `src/scripts/desk/greek-find.js:276` and `:314`.

**What happens** `pane.setAttribute("aria-busy", "true")` is set on the results region, which *contains* the
`role="status"` line that announces the answer ("243 times in the New Testament"). The status text is written, then
`aria-busy` is removed, all in one task. Some screen reader and browser pairs hold back live-region changes inside a
busy ancestor and do not replay them when the flag clears, which would leave the result silent.

**Fix** Drop `aria-busy` (the status line already says "Searching…"), or set it on the list only.

**Confidence** Low. Confirm with NVDA and JAWS in Firefox and Chrome.

> **Fixed in FA2-t (2026-11-03, branch claude/audit2-session8-greek; not yet browser-checked):** `aria-busy` is gone from the results region.

#### GK-17 · Low · a11y · NEW (low confidence)
**Where** `src/styles/desk.css:6002-6005`.

**What happens** In forced colors the selected word is set to `background: Highlight; color: HighlightText`, without
`forced-color-adjust: none`. The file's own comment at `:5946-5964` and BA148 record that Chrome paints a Canvas
backplate behind forced text, which hid a `HighlightText` label on its `Highlight` fill; the segmented control fixes it
with `forced-color-adjust: none` (`:5986`). The selected Greek word, the main selection cue of the tab, may be
`HighlightText` on Canvas, unreadable on a light contrast theme. The apparatus row's `.is-lit` cue (`desk.css:3766`) is also
background-only and vanishes in forced colors.

**Fix** Add `forced-color-adjust: none` to that rule, and give `.is-lit` a `Highlight` outline or border.

**Confidence** Low. Confirm with Chrome's forced-colors emulation.

> **Fixed in FA2-t (2026-11-03, branch claude/audit2-session8-greek; not yet browser-checked):** The selected word opts out of forcing, as the chosen segment does, and the apparatus row's lit cue is a `Highlight` border. Not yet checked in forced-colors emulation.

#### GK-18 · Low · docs · NEW
**Where** `src/scripts/desk/tab-greek.js:209` (`NO_WORD`), `src/pages/notebook/help.astro:109-146`; the model in `src/lib/desk-greek.mjs:81-104`.

**What happens** The tab says "The arrow keys move between words", and the help page says "move through the words with the
arrow keys". In fact Left and Right step a word, **Up and Down jump a whole verse**, Home and End go to the chapter's
first and last word, and each move selects (and loads a lexicon entry). Nothing says so. The splitter's keys (Up and Down,
Shift for bigger steps, Home and End, Enter to reset) and its existence are also unmentioned, and so is that
the word buttons are one tab stop.

**Fix** One sentence in the help page, and a `title`/description on the word list or the NO_WORD line.

**Confidence** High.

> **Fixed in FA2-u (2026-11-03, branch claude/audit2-session8-greek; not yet browser-checked):** The tab's line and the help page name Left and Right, Up and Down, Home and End, the one Tab stop and the splitter's keys.

#### GK-19 · Nit · longevity · NEW
**Where** `src/lib/desk-commands.mjs` (`isCommandQuery`, the `>` prefix) and `src/lib/greek-query.mjs:207` (`isCommandQuery`, Greek).

Two different exported functions share a name and a meaning-by-context; `search-core.js` imports one and `notebook-search.js`
re-exports the other. Rename one (`isDeskCommandQuery`, `isGreekCommandQuery`) before a third caller imports the wrong one.
**Confidence** High.

> **Fixed in FA2-u (2026-11-03, branch claude/audit2-session8-greek; not yet browser-checked):** Renamed `isGreekCommandQuery` and `isDeskCommandQuery`.

#### GK-20 · Nit · performance · NEW
**Where** `src/scripts/desk/greek-data.js:11` and `src/scripts/search-core.js:1451`.

The tab and the search keep separate in-memory caches of the same `/greek/text/<chapter>.json`; a command-search row for the
chapter on screen fetches and parses it a second time (with GK-9's revalidation, a second conditional request).
Share one loader. **Confidence** High.

### Improvements

- Show the Greek verse, with the matched words marked, under each result row in the tab (the tray already has `formsLine`), so keyboard and screen-reader readers see what a hit is without a hover preview (previews open on pointer only: ref-preview.js, "focus alone opens nothing").
- A failed multi-word English query ("kingdom of God") says only "No Greek matches." Offer "Try one word at a time" and the first word as a button, as the `couldBeGreek` branch does.
- Stop-words ("the", "of") return 129 "Words that match" for "the"; a short hint ("a common English word; try a noun") would help.
- Word buttons are about 500 to 2,000 `aria-pressed` toggle buttons per chapter, so a screen reader announces "toggle button, not pressed" after every Greek word when reading. Consider `aria-roledescription="word"` without the pressed state (use `aria-current`), or a verse-text reading mode.
- The details' starters look like plain text until hovered. A faint dotted underline at rest, or a one-line "Click the form, lemma or number to search" caption, would make the five search routes discoverable.
- Make "Exact form only" say what it does ("this spelling, ignoring accents"): it compares folded forms, so ὁ and ὅ-forms of one lemma match each other.
- The `/greek/LICENSE.txt` link in the sources list navigates the reader away from the chapter in the same tab; open it in a new tab like the source links above it.
- The Greek rule modules (about 19 KB gzipped unminified) ship in the search bundle to every reader even with the preview off. Harmless, but could be a dynamic import behind `greekSearchEnabled()`.

### Questions for the owner

1. **Typed `ἡ`, `ἐξ`, `αὐτοῦ`:** the rule "a lemma typed directly finds that lemma alone" gives ἤ (or), ἕξ (six) and a four-hit adverb. Should a typed form that is *also* another word's headword offer both (a choice box, as ὦ/Ὦ does)? GK-1's fix for the tab does not depend on the answer.
2. **The article answer** ("ὁ is in 6,966 of 7,942 verses. To study it, search it beside a word: ὁ, θεός") was marked "a recommendation awaiting BVJ's confirmation" in `greek-search.mjs:193-195` and rule 15. **Confirmed (BVJ, 2026-11-03).**
3. **Credit in the tab's own results (GK-13):** is the tab's foot-of-text credit enough, or should its results carry the one-line credit like every other surface?
4. **Lexicon provenance:** STEP's headers say the full lexicon is "edited from the Full LSJ" and the brief one is "based on Abbott-Smith", and the TFLSJ header on disk still mentions Bill Mounce's Teknia dictionary for fill-ins. `LICENSE.txt` treats both as plain CC BY 4.0. Has STEP/Tyndale House confirmed no ShareAlike or restricted upstream sits behind the shards? (I could not check this.)
   **Checked online and decided (BVJ, 2026-11-03):** STEP's own terms are CC BY 4.0 with no ShareAlike, and Abbott-Smith is public domain, but the full LSJ and the Middle Liddell fill-ins are Perseus's text, which Perseus offers CC BY-SA (its `lexica` repository, license CC BY-SA 4.0, and STEP's own licences page lists the LSJ as CC-BY-SA), while STEP labels the file CC BY. A separate agreement with Tufts is possible (Perseus was at the 2018 meeting where STEP dropped its ND restriction) but nothing says so, and STEP's header notes its permission for Mounce's Teknia text but none for Perseus. **The cautious route was taken:** `lsj/` and the 55 "(ML)" entries in `step/` are licensed CC BY-SA 4.0 with Perseus credited (`public/greek/LICENSE.txt`, `greek-credits.mjs`). No "(MT)" entry is in our `step/` shards. Open: an email to STEPBible@Gmail.com asking whether an agreement lets the TFLSJ and Middle Liddell be CC BY; a yes would let both go back.
5. **Caching (GK-9):** is a day of `max-age` acceptable for `/greek/*` given `build:greek` is manual, or would you rather keep revalidation?

### What held up

- **Data integrity** (`integrity.mjs`, `refs.mjs`): all 260 chapter files (`{book}-{n}.json`), 137,794 words, 7,942 verses (equals `GREEK_VERSES`), all NFC, `format: 1` and `book`/`chapter` keys match the file name, no duplicate (verse, t), no empty text, every `pre`/`post` a string, every apparatus verse in its chapter. The one word with `lemma: -1`, John 8:5 Μωσῆς, is the documented MACULA spelling gap (STUDY-DESK.md); the tab shows "No parsing for this word." and no lexicon, and the search index has 137,793 words for that reason.
- **References resolve:** all 5,465 distinct lemma references have a UBS entry (76 have no UBS id, documented), a STEP entry and an LSJ entry (0 missing), sense indexes are in range, and every text lemma is in `lemmas.json`. Occurrence shards: ids sit in `id % 64`, per-lemma counts equal the occurrence lists, every lemma has an entry, and the 57 parse groups on disk equal `parse.json`'s counts and total 137,793.
- **Shard sizes:** UBS largest 64 KB, STEP 62 KB, LSJ 200 KB raw (68 KB gzipped), parse groups under 61 KB gzipped, `lemmas.json` 741 KB raw (222 KB gzipped). Only `search/occ/51.json` passes 300 KB raw (322 KB, 82 KB gzipped): the shard holding the article, fetched for searches in it.
- **Search correctness:** accents, breathings, ᾳ/ᾠ iota subscript, final sigma (ς, σ, ϲ, capitals), NFC and NFD Greek input, elision marks (ʼ ’ '), crasis (κἀγώ), Strong's forms (g4102, G04102, G0004102, strong:4102, Strong’s G4102, G1510 finds εἰμί), transliterations (xristos, Khristos, agreuo/agreuō, aggelos/angelos, psuche), `__proto__`, `constructor`, regex metacharacters, empty and whitespace queries, unmatched quotes, and the four-word cap: no exception, sensible results. `matchConstruction` equals a brute-force chain enumerator on 20,000 random cases (`brute.mjs`). Worst real query `*.sg, *.sg, *.sg, *.sg ~v &` takes 0.55 s warm (0.64 s cold), `*.gen/dat/acc/nom/voc` 77 ms; BA44's fix holds.
- **Escaping:** 60,000 random queries through `parseGreekQuery`, `resolveGreekQuery` and `describeGreekQuery` with the tab's escapers: 0 unescaped `<`, `>` or quote. Everything else the tab draws uses `textContent`; `sanitizeInto` is a second lock; credit links carry `target="_blank" rel="noopener noreferrer"`.
- **The gate:** no `greek/` fetch without `data-desk="on"` (`greekSearchEnabled()` guards every call in searchbar.js and search.js; `loadDeskSearch` and `loadDeskSheets` check the attribute; nothing in layouts or pages references `/greek/`).
- **Prior fixes still in place:** BA110 (`longEnoughForGreek`, article line), BA111 (`noteVerseFor`), BA112/113 (split values, `forgetsSplit`), BA114/115 (`destroy`, the window closing with its field), BA117, BA119, BA120 (`nearestVerse`), BA40 (σ folding in notebook search), BA46/47 (credit line, LICENSE text).
- **Accessibility basics:** `lang="grc"` on the paragraphs, word heading, lemma, forms and apparatus notes; roving single tab stop with `aria-pressed`; the splitter is a focusable `role="separator"` with `aria-valuemin/max/now/text`, Up/Down/Home/End/Enter and a visible focus ring on its grip; the details `section` is labelled and a polite atomic live region carries the word and its parsing in words; "×" and "Back to the text" return focus to the word, the results region is labelled, Escape closes only the search; every `focus()` passes `preventScroll`; reduced motion respected.
- **Contrast** (`contrast.mjs`, against `--surface-raised` and the cream `--surface`, light and dark): status 6.9, subhead and muted 5.8, code 5.0, parse 9.7, hit ref 8.2, `--green-text` verse numbers, signs and refs 6.3 (7.1 dark), ink on the selected-word tint 11.0, all above 4.5:1. The selected word also has a 2px green underline (6.3:1) so it does not rest on tint alone. The two panels the tab lives in use `--surface-raised`, so the cream figures are a margin only.
- **Licensing split:** `text/` and `ubs/` CC BY-SA 4.0, `step/` and `lsj/` CC BY 4.0, `search/` CC BY-SA 4.0 apart from STEP's brief glosses; `LICENSE.txt`, `SOURCES` and `SEARCH_CREDIT` name the same five sources and agree on each license. The bridge (LIT text) is outside `public/greek/`. The storage keys `lit-desk-lexicon`, `lit-desk-greek-split`, `lit-greek-commands` and `lit-greek-commands-pos` are named in /privacy.
- **Copy:** no em dashes, British spellings or straight quotes in the slice's reader-facing strings; Oxford commas present.
- **Tests:** `node --test` on the 13 Greek and desk-search test files: 192 pass, 0 fail; `verse-counts` and `desk-greek` also pass.

### Not reached

- Any real browser, screen reader or forced-colors session (GK-3, 11, 16 and 17 need one), Safari, touch.
- The actual rendered glyphs for the signs under Atkinson and OpenDyslexic; `CSS.getPlatformFontsForNode` was not run.
- Live behavior offline and with a throttled network (only simulated in node for the search index and shards).
- Re-running `npm run build:greek` to prove the committed data is reproducible (it writes into `public/greek/`; the sources are in `C:\Users\bcjoh\GitHub\greek-sources`). Timestamps show `public/greek/text` is from 2026-10-14.
- The Notebook panel's side of the Greek tab (`panel.js`, `showGreekWord`, `page.js greekChapter()`), the /desk Greek pane wiring (`desk-panes.js`) and the Search pane (`search-pane.js`), which belong to other slices; `search.js` and `searchbar.js` only where they call the Greek functions.
- Word-by-word comparison of the Greek against the SBLGNT source files (the unit tests in `greek-core.test.js` cover the build's comparison with MorphGNT).

## Appendix F: Longevity, engineering health and launch readiness (`LG`, Sonnet)

Branch `claude/phase5-work-sessions`, checkout of 2026-11-03. Read-only audit. Every measurement below was produced by a throwaway script in the scratchpad (`C:\Users\bcjoh\AppData\Local\Temp\claude\C--Users-bcjoh-GitHub-litbible\ad56297a-c1ae-439b-986a-dac3ca218054\scratchpad\lg-*.mjs`); the script name is quoted next to each result so it can be re-run.

### Summary

- The suite is healthy and the prose docs are unusually accurate. Whole `npm test`: 2,708 tests, 0 fail, 0 skipped, 5.0 s. The desk, Greek and claude-docs subset: 1,868 tests, 0 fail, 3.1 s. Of 600 backtick tokens in `src/scripts/desk/CLAUDE.md`, every file, key, constant and identifier resolves (one non-path, `.lit-sheet.md`, is an extension).
- The structural weakness is the browser half. 96% of the 23,266 lines in `src/scripts/desk/*.js` are never executed by a test (22,429 lines), including the IndexedDB shell `store.js`, which is tested only through in-memory stand-ins. All 55 pure `src/lib/desk-*` modules (13,075 lines) have tests.
- The gate holds for the desk proper (one tiny entry, `desk-gate.js`, 975 bytes gzipped, plus dynamic imports behind `data-desk="on"`), but the Greek search engine ships to every reader (about 10.6 KB gzipped of `greek-*.mjs` in `searchbar.js`, plus the Greek half of `search-core.js`).
- Launch is not one switch: the stamp is one script, but about a dozen other places read it, `?desk=off` cannot survive the flip, and there is no in-app way to turn the preview on or off today. A checklist with file:line is below.
- Privacy page names every key correctly (none stale) but omits the request for persistent storage, two meta values, and the BroadcastChannels.
- CSS is in good order: dark-mode pairs are present, guarded and identical; no `ch` unit in desk text columns; two dead selectors.
- Counts: Critical 0, High 0, Medium 5, Low 8, Nit 2.

### Findings

#### LG-1 · Medium · longevity · NEW
**Where** `src/scripts/desk/store.js:56-254` (IndexedDB shell), `panel.js`, `sheet-pane.js`, `notebook-page.js`, `history.js`, `desk-page.js`; coverage map `scratchpad/lg-cov.tsv` (from `lg-cov.mjs`).
**What happens** Of the 67 `src/scripts/desk/*.js` modules (23,266 lines): 53 modules / 18,216 lines are not imported or even named by any test; 8 / 4,213 lines are only matched as text (`panel.js`, `shell.js`, `sheet-pane.js`, `tab-greek.js`, `widths.js`, `store.js`, `history.js`, `commands.js`); 6 / 837 lines actually run under test with a fake DOM (`page.js`, `lit-records.js`, `record-rows.js`, `print-look.js`, `ribbon-follow.js`, `release-feed.js`); `desk-gate.js`, `float-window.js` and `greek-commands.js` also run. There is no jsdom or happy-dom dependency. The pure half is thoroughly covered, so tests are green while the code that writes the reader's notebook (transactions, `writeNow` on `pagehide`, `onupgradeneeded`, quota errors, BroadcastChannel, `navigator.storage.persist()`) is checked only by stand-ins: `test/desk-history.test.js:50` ("apply a plan the way store.js does"), `test/desk-sheets.test.js:1308` (a stand-in for `change(build)`), `test/desk-store-core.test.js:4`. If the shell and a stand-in drift, nothing fails. The prior audit's data bugs (BA5, BA13, BA72, BA128 to BA130) all sat in this layer.
Ranking of untested modules by size x store writes x storage x shared-page hooks (`lg-risk.mjs`): `sheet-pane.js` (1,203 lines, saves a sheet), `desk-page.js` (1,063, writes the layout key), `panel.js` (653, 10 storage touches), `sheet-present.js` (808), `tab-greek.js` (1,162), `search-pane.js` (1,068), `tour.js` (710, 14 shared-page hooks), `sheet-text.js` (1,094), `sheet-lit.js` (963), `widths.js` (313, 13 sessionStorage touches), `store.js` (422, 4 write paths), `notebook-page.js` (414, import/export commits).
**Evidence** `node lg-cov.mjs` (65 of the 123 desk-set modules are not imported by any test, 54 of them never named); `node lg-risk.mjs`; `package.json` devDependencies.
**Fix** (1) One test that runs the real `store.js` against `fake-indexeddb` (dev dependency, no browser): open/upgrade, `change` aborting on a throw, `writeNow`, two stores over a stubbed BroadcastChannel, a rejected `persist()`. Then delete the stand-ins that duplicate the shell. (2) A Playwright smoke test against `dist/` for the notebook page's save and open and /desk's layout save (the prior audit notes cloud sessions have Playwright ready, STUDY-DESK-AUDIT-1.md:74).
**Confidence** High

#### LG-2 · Medium · docs · NEW (same class as fixed BA42)
**Where** `src/pages/privacy.astro:97-152` against `src/scripts/desk/store.js:241-254`, `src/scripts/desk/first-use.js:312`, `src/lib/desk-store-core.mjs:19`, `src/lib/desk-places.mjs:112`, `src/scripts/desk/sheet-present.js:242`, `src/pages/sheets.astro:48`.
**What happens** Every `lit-desk-*` name the page lists exists in code (18 localStorage names and 7 sessionStorage names, none stale, none missing; `lg-keys.mjs` found no `lit-` key in `src/` that the page lacks except site-wide keys outside the notebook paragraph). It is silent about: (1) `askToPersist()` calls `navigator.storage.persist()` after the first write and stores `{ at, granted }` under the notebook's `persistAsked` meta value (some browsers show a permission prompt for it; nothing on the page says the notebook asks); (2) the `lastExport` meta value (date of the last saved copy); only `whatsNewSeen` is described; (3) three BroadcastChannels (`lit-desk` notebook change notices between tabs, `lit-desk-ribbon-tab`, one per presented sheet) that carry change notices and sheet state between the reader's own tabs; (4) a shared sheet link's contents are kept in `history.state.litSharedSheet` for the tab. None leaves the device, so this is disclosure completeness, not a leak, but desk rule 13 says to keep the page in step "if a key or what is stored changes".
**Evidence** `node lg-keys.mjs`; `grep` of every `getItem/setItem` call in the desk (full table in "Storage inventory" below).
**Fix** One sentence in "The notebook preview": the notebook asks your browser to keep its storage so it isn't cleared when space is short, remembers that it asked and when you last saved a copy, and tells your other open tabs about changes so they stay in step. See LG-8 for a test that stops this recurring.
**Confidence** High

#### LG-3 · Medium · docs · NEW
**Where** `src/layouts/Layout.astro:121` and about a dozen other sites (checklist in Appendix D); `src/scripts/desk/CLAUDE.md:519-520` ("Launch is that one function returning true").
**What happens** The launch claim is true only for the Greek search (`greekSearchEnabled`, `search-core.js:1292-1294`). The preview itself is stamped in one inline script (`Layout.astro:121`), but the consumers are scattered: `loadDeskSearch` and `loadDeskSheets` read `dataset.desk` directly (`search-core.js:1253`, `:1271`), `desk-gate.js:12,38,45,51`, `keyboard-shortcuts.js:62,117`, `sheet-share-gate.js:20`, `ScriptureLayout.astro:393`, `global.css:3518-3560`, `glossary.css:734-830`, `read-mode.css:47-80`, `SiteHeader.astro` (desk header rules, about 4.9 KB), and four pages' "preview" copy. Three things cannot be flipped cleanly: (a) `?desk=off` (`Layout.astro:121`) works by deleting the flag, so once the default flips it stops being an opt-out; the stored value must become an explicit "off"; (b) `lit-desk-preview` is read and written only in that one script (grep of `src/`), so there is no Settings switch to turn the desk on or off, which a launched feature needs; (c) the "part of a preview" notes on `/desk`, `/notebook`, `/sheets` and `sheet-share-gate.js:51` (which tells a computer to open `?desk=on`) are hard-coded copy. The root and desk CLAUDE.md do not list these sites together.
**Evidence** `grep -rn "dataset.desk\|data-desk\]\|hasAttribute(\"data-desk\")"`; `lg-graph.mjs`; table below.
**Fix** Add the checklist below to `STUDY-DESK.md` (or a "Launching" section of the desk CLAUDE.md), and make the opt-out a stored `lit-desk-preview=off` read by the same script plus a Settings-tab switch before launch. Replace the two direct `dataset.desk` reads in `search-core.js` with one exported `deskEnabled()`.
**Confidence** High

#### LG-4 · Medium · longevity · NEW
**Where** `src/scripts/desk/sheet-text.js:273, 274, 336, 346, 350, 387, 393, 535, 598, 599, 613, 1017` (12 `exec("...")` calls through the wrapper at `:130-136`, which calls `document.execCommand` at `:132`); `src/scripts/greek-commands.js:139` (guarded, with a fallback).
**What happens** The sheet editor's formatting (`formatBlock`, `indent`, `outdent`, `createLink`, `insertHTML`, `insertText`, `removeFormat`, `styleWithCSS`, `defaultParagraphSeparator`) and its paste path run on `document.execCommand`, which the HTML standard and MDN list as obsolete. All engines still ship it, so nothing breaks today, but engines differ in the markup they produce, and there is no recorded plan: `grep -i execCommand STUDY-DESK.md` finds nothing, and STUDY-DESK-AUDIT-1.md mentions it only for the Greek field (BA147). Mitigation that exists: output is re-sanitized to a canonical form (`sheetHtmlForShow`, `test/desk-sheet-copy.test.js:243-257`) and the wrapper try/catches. The Greek commands window's use is safe (typeof check, then falls back to setting `value`).
**Evidence** `grep -n 'exec("' sheet-text.js`; `grep -c "execCommand" STUDY-DESK.md` returns 0.
**Fix** Record the decision: either accept execCommand for version 1 and add a cross-browser golden-file test for the 8 commands the editor uses (feed `desk-sheet-format.mjs` the HTML each engine produces), or schedule a replacement behind the existing `createSheetText` interface.
**Confidence** Medium (about the future; High about the present state)

#### LG-5 · Medium · compat · NEW
**Where** `src/scripts/desk/highlights.js:41` (returns null without the API), `notes-margin.js:64,527`, `src/scripts/desk/actions.js:83-88` (offers Highlight regardless).
**What happens** Highlights are a tint drawn only through the CSS Custom Highlight API (Chrome 105, Safari 17.2, Firefox 140 per STUDY-DESK.md:8093). Where it is missing (Safari 16.x on macOS Big Sur, Firefox before 140), `createHighlights` returns null and the margin's lit words are skipped, but the verse menu and selection panel still show the four Highlight colors. A reader can make highlights, get a confirmation, and never see them; the records exist in the notebook. No message, no fallback. (Design "tint only" is the owner's; this is about the unsupported case.) Real-browser coverage of this is still open in the prior audit's FA1-v Mac and Firefox list (STUDY-DESK-AUDIT-1.md:2380-2388).
**Evidence** Read of `actions.js:83-88` and `highlights.js:41`; no `supported` check in `actions.js` (`grep -n supported actions.js` empty).
**Fix** Export one `highlightsSupported()` from `highlights.js`; have `actions.js` and the Settings switch show "Your browser can't draw highlights" instead of the colors, or fall back to a `<mark>`-free underline for the margin only. Add to the launch checklist.
**Confidence** Medium (code read; not run in an old browser)

#### LG-6 · Low · performance · NEW
**Where** `src/scripts/searchbar.js:49-52`, `src/scripts/search.js:47-49` (static imports of `greek-search.mjs`, `greek-query.mjs`, `greek-commands-ui.mjs`, `greek-credits.mjs`); `src/scripts/search-core.js:1279-1727` (449 of 1,727 lines are the Greek search).
**What happens** SearchBar is on every page (`src/scripts/CLAUDE.md`, "Every page has exactly one way in"), so `searchbar.js` is too. Its bundle carries the whole Greek query engine though `greekSearchEnabled()` is false for everyone: the four libs minify to 26.9 KB raw / 10.6 KB gzipped (rolldown, `lg-bundle2.mjs`), plus the Greek third of `search-core.js`. Rule 15 gates the Greek data, not the code, and the root rule "shared reader code never imports it statically" speaks of the desk; so this is arguably within the letter, but a reader pays about 14 KB gzipped on every page for a feature that is off.
**Evidence** `lg-graph.mjs` (edges from non-desk files into the desk set: `searchbar.js:49-52`, `search.js:47-49`, `greek-commands.js:29-31`, plus build-time frontmatter edges `Layout.astro:11`, `search.astro:4`); `lg-bundle2.mjs`.
**Fix** Import the four libs inside the `greekSearchEnabled()` branches (`await import(...)`), as `withCommands` already does for `greek-commands.js`; or accept it and state it in rule 15. Add a bundle-budget test (LG-8).
**Confidence** High on the import edges; Medium on byte counts (rolldown, not Astro's exact chunking; no `dist/` exists)

#### LG-7 · Low · compat · NEW

> **Checked by the orchestrator:** the rule at `src/styles/global.css:3518-3522` does put `:has()` in the same selector list as the gate.
**Where** `src/styles/global.css:3518-3522`.
**What happens** One rule hides every Notebook/Study Desk control for non-desk readers: `html:not([data-desk]) [data-desk-toggle], body:not(:has(...)) button[data-desk-toggle], .site-header--desk [data-desk-toggle] { display: none !important }`. A selector list with one invalid selector makes the whole rule invalid, so in an engine without `:has()` (Firefox before 121, Safari before 15.4; the repo sets no build target, so it depends on Vite's default floor, which I did not confirm) the rule is dropped and the "Study Desk" links and Read View's Notebook button show for everyone, desk off. The links go to /desk, which says the preview is off; the Read View button does nothing.
**Evidence** Read of the rule; `grep -c ":has(" global.css` = 9 uses, only this one in a shared list that hides a gated control. Not run in an old engine.
**Fix** Split the `:has()` selector into its own rule (a failure then only loses the "no reading column" case, never the main gate).
**Confidence** Medium

#### LG-8 · Low · longevity · NEW
**Where** `test/desk-layout.test.js:713-715`; `.github/workflows/ci.yml:24-43`.
**What happens** Rules held by prose only: (a) "the storage key is the one /privacy names" is `assert.equal(LAYOUT_KEY, "lit-desk-layout")`, a literal compared with itself; no test reads `privacy.astro` (the BA42 class of drift recurs, LG-2); (b) nothing asserts "readers download none of it": the import graph is guarded by CLAUDE.md alone, and LG-6 got in that way; CI's post-build step is only `check:links`; (c) nothing asserts the dark-mode pair rule across `desk.css` (my check, clean today, `lg-css.mjs`); (d) the "held by test/..." claims I sampled are all true (see What held up), so prose rules are well covered except these three.
**Evidence** `grep -rn privacy test/desk-*.test.js` returns only that line.
**Fix** Three small tests, each reusing a script from this audit: a key test (every `lit-desk-*`/`lit-sheet-*`/`lit-greek-*` literal in `src/` appears in `privacy.astro`: `lg-keys.mjs`), an import-graph test (allowed edges from non-desk files into the desk set: `lg-graph.mjs`), and a CSS pair test (`lg-css.mjs`).
**Confidence** High

#### LG-9 · Low · longevity · NEW
**Where** `scripts/build-greek.mjs:82` and header `:29-34`; `scripts/lib/morphgnt.mjs:7`; `public/greek/LICENSE.txt`.
**What happens** `npm run build:greek` needs four clones outside the repo. The default for `GREEK_SOURCES_DIR` is the owner's `C:\Users\bcjoh\GitHub\greek-sources`. Only MorphGNT's clone URL is written anywhere in the repo (`morphgnt.mjs:7`); there is no URL for UBS, no URL or tag for SBLGNT's apparatus clone, and no commit pins. The owner's clones are at macula-greek `8423afe` (2026-07-07), sblgnt `c4d241a` (2025-01-19), stepbible `cb4a117` (2026-10-13), ubs `33dcc8c` (2026-09-22), recorded nowhere in the repo. Output is committed and deterministic, so nothing breaks until a source changes; then a new maintainer cannot reproduce today's bytes. `build:anchor-vectors` needs git history (documented, `build-anchor-vectors.mjs:4-12`) and is fine.
**Evidence** `git -C ../greek-sources/<dir> log -1`; `grep -rn GREEK_SOURCES_DIR` finds the doc mentions but no manifest.
**Fix** A `scripts/greek-sources.md` (or a `sources.json` the script reads) with each repo URL and the commit that produced the committed output; default the directory to `../greek-sources`.
**Confidence** High

#### LG-10 · Low · performance · NEW
**Where** `src/scripts/desk/shell.js` (static imports), `panel.js` `TABS`.
**What happens** A desk-on reader on a chapter page loads the whole desk even though the Notebook starts minimized. Static closure of `shell.js` plus the gate, bundled with rolldown (`lg-bundle3.mjs`): 469,870 bytes raw / 140,649 gzipped across 7 chunks (`shell`, `store`, `tab-verse`, `whats-new`, `word-stem`, `desk-start`, `desk-gate`). This includes `desk.css` as a string (166,533 source bytes, 106,288 minified, 17,534 gzipped by lightningcss), the Greek tab and Greek search libs (`tab-verse` chunk, 160 KB raw), and the tour. For comparison: shell chunk alone 72.9 KB raw / 23.6 KB gzipped. Other pages: /notebook 281 KB raw / 81 KB gz; /desk 602 KB / 186 KB gz; /sheets 312 KB / 91 KB gz (QR library `qrcode.mjs` 43.9 KB raw is in the sheet chunk only). Data loads on use: a Greek chapter file (`public/greek/text/john-3.json` 41,505 bytes), `search/lemmas.json` 741,453 bytes on the first Greek search, lexicon shards when a word opens; Playpen Sans woff2 files (latin 196 KB, latin-ext 265 KB, greek 115 KB) only if a note uses them. Preview-only today, so cost is accepted; it matters at launch.
**Fix** Load each tab's module with `import()` when first shown (the Greek tab and its libs, Settings, the tour). In the proxy build the `tab-verse` and `whats-new` chunks are about 65 KB gzipped of the 141 KB and are only needed once a tab is opened (the `tab-verse` chunk also carries `search-core.js` here, so it would be shared in Astro's output).
**Confidence** Medium (proxy build, no `dist/`)

#### LG-11 · Low · docs · NEW
**Where** `src/scripts/desk/CLAUDE.md:285-286` vs `:274-276`; `:20`; `src/scripts/desk/CLAUDE.md:484-485` vs `public/greek/LICENSE.txt:8-11`; root `CLAUDE.md:195-196`; `README.md`.
**What happens** (1) Rule 10 says the Notebook has no Close (and no "Close the Notebook" command), then the naming paragraph still uses "Close the Notebook" as an example; the string occurs nowhere in `src/`. (2) The records table describes `STUDY-DESK-AUDIT-1.md` as BA1 to BA87 plus findings "from BA88 onward ... planned in phases FA1-w onward"; the file runs to BA153 and FA1-ae is done (#411). (3) Rule 14 says `text/` is CC BY-SA 4.0 "(MorphGNT, UBS)"; `LICENSE.txt` says MorphGNT is CC BY-SA 3.0 and the directory is licensed 4.0 (one-way compatible; the wording is imprecise: cross-slice, for the Greek auditor). (4) Root `CLAUDE.md:195` lists the build pipeline without `build:api2`, which `package.json`'s `build` script runs between `build:api` and `build:og`. (5) `README.md` mentions the desk only in the `build:greek` row (`:52`).
**Evidence** `lg-docdrift.mjs`, `lg-claims.mjs`, greps quoted.
**Fix** One edit each; the audit row is the one a new maintainer will act on.
**Confidence** High

#### LG-12 · Low · longevity · NEW
**Where** `CLAUDE.md` (39,691 bytes) and `test/claude-docs.test.js:20` (`ROOT_LIMIT = 40 * 1024`).
**What happens** 1,269 bytes (3%) of headroom. The next rule added at the root fails `npm test` for an unrelated change, and the pressure pushes text into the wrong file.
**Fix** Move the Tech Stack font bullet and the long `/notebook`, `/desk`, `/sheets` routing rows (CLAUDE.md:315-317) to `src/pages/CLAUDE.md` or the desk file with one-line pointers.
**Confidence** High

#### LG-13 · Low · longevity · NEW
**Where** whole desk; `lg-complex.mjs` (rolldown `parseAst`, 3,397 functions in 122 files).
**What happens** Where the next bugs will come from: giant closure factories whose locals are shared mutable state. Longest functions: `createGreekTab` 1,012 lines (`tab-greek.js:150`), `createSheetPane` 1,009 (`sheet-pane.js:194`), `createSheetText` 937 (`sheet-text.js:157`), `start` 906 (`desk-page.js:155`, cc 24), `createSearchPane` 906 (`search-pane.js:162`), `createNotesMargin` 663, `createTour` 614, `createMineTab` 551, `createPanel` 534 (cc 25), `createLitPane` 473. 29 functions exceed 150 lines, 47 exceed 100. Highest cyclomatic (rough): `draw` in `notes-margin.js:127` 43, `parseMarkdown` 40, `validateRecord` 40, `parseGreekQuery` 38. Nine files exceed 800 lines (largest 1,203). The pure logic is already in `lib/`; what remains is DOM wiring, which is exactly the untested part (LG-1). Duplicated helpers: `make(tag, cls, text)` is defined 13 times (12 desk files plus `greek-commands.js:75`), `el()` 7 times, `escapeHtml` 4 identical copies in desk files (`footnote-notes.js:311`, `note-editor.js:283`, `notes-margin.js:746`, `panel.js:650`; all call sites put it in element text or double-quoted attributes, so no injection risk, but they escape no `'`) plus 3 others, `announce`/`say` 8 times. Payoff ranking: (1) tests for `store.js` (LG-1); (2) a shared `dom.js` (`make`, `escapeHtml`, `announce`) so a fix lands once; (3) split `createSheetPane` and `createGreekTab` into view modules with explicit state.
**Fix** As ranked.
**Confidence** High on counts; Medium on the ranking (judgment)

#### LG-14 · Nit · longevity · NEW
**Where** `test/desk-merge.test.js:172-175`.
**What happens** `Date.parse(kept.modified) > Date.now() - 60_000` is a wall-clock window; a paused CI VM could exceed it. Everything else time-dependent pins `NOW` (`desk-first-use.test.js:16`). No desk test uses the network (the only `https://` strings are fixtures) or `Math.random`. node:test runs each file in its own process, so tests that install `globalThis.document` (`desk-panes-shared`, `ribbon-follow`, `greek-commands`, `float-window`) cannot leak into each other.
**Fix** Inject a clock or widen to 10 minutes.
**Confidence** Medium

#### LG-15 · Nit · longevity · NEW
**Where** dead exports: `src/lib/desk-first-use.mjs` `TOUR_LINK`; `src/lib/desk-labels.mjs` `sameLabelName`; `src/scripts/desk/notebook-search.js` `runCommand`, `renderTray`, `renderPageGroup`; `src/scripts/desk/search-sheet.js` `attachSearchSheets`. Dead CSS: `.desk-home-card__row` (`desk.css:2664`) and the `.desk-home-card__skip` selector in the group at `desk.css:2691`.
**What happens** Exported but referenced by no source file and no test (`lg-graph.mjs`; 37 more exports are used only inside their own file, so the `export` is unneeded). The two CSS classes have no use in `src/` (`lg-deadcss.mjs`, conservative: classes built by template such as `desk-print-mark--${color}`, `desk-split--${node.split}`, `sheet-blank--${copy}` and `desk-sheet__module--${type}` are counted as used). 650 desk classes checked, 2 dead.
**Fix** Delete them.
**Confidence** High

### Improvements

- Add `npm run test:desk` (`node --test test/desk-*.test.js test/greek-*.test.js test/ribbon-follow.test.js test/release-feed.test.js test/float-window.test.js`): the desk's tests live under three name patterns, so a desk edit has no obvious fast loop.
- Add a README section "The Study Desk (preview)" (README.md mentions it once): what it is, `?desk=on`, where the docs are.
- Put the launch checklist below into `STUDY-DESK.md` so launch day is a list, not an investigation.
- A per-tab lazy `import()` would take roughly 65 KB gzipped off the first desk load (LG-10).
- Commit the audit scripts (`lg-graph.mjs`, `lg-keys.mjs`, `lg-css.mjs`, `lg-cov.mjs`) as `scripts/audit-desk-*.mjs`; they are about 300 lines in total and answer questions the next audit will ask again.

### Questions for the owner

- Launch opt-out: will a Settings switch ("Turn the Study Desk off") ship with the launch? It decides what `?desk=off` and `lit-desk-preview` mean afterward (LG-3).
- Is the Greek search engine meant to ride in every reader's search bundle until launch, or should it load only with the preview (LG-6)?
- Which browsers are in scope for launch? Safari before 17.2 and Firefox before 140 draw no highlights (LG-5); Firefox before 121 and Safari before 15.4 lack `:has()` (LG-7). Neither `astro.config.mjs` nor `package.json` sets a target or browserslist.
- Should real-browser tests (Playwright) be a launch gate, given 96% of the browser half is unexecuted by tests (LG-1)?

### What held up

- **Tests:** 2,708 pass, 0 fail, 0 skipped, 5.0 s total (`node --test "test/**/*.js" "scripts/reconcile/test/**/*.mjs"`); desk, Greek and docs subset 1,868 pass in 3.1 s. No network use; no `Math.random`; clocks pinned except LG-14.
- **Test-guard claims in the doc are true:** `desk-prepaint.test.js:21-22` runs Layout.astro's script; `desk-frame.test.js:20` finds the `:has()` rule; `desk-margin.test.js:609-610` holds FIRST_PAINT to global.css and ScriptureLayout.astro; `desk-footnotes.test.js:28-30` reads every published chapter; `desk-anchor-dom.test.js:99-107` sweeps the LIT pane as a third view; `desk-sheet-templates.test.js:73` checks templates don't name the editor; `greek-query.test.js:258-320` holds COMMANDS and EXAMPLES to the parser and data; `desk-sheet-copy.test.js:243-257` forbids raw `innerHTML` of a sheet's html in any `sheet*.js`; `desk-first-use.test.js:246-248` covers the prose view.
- **Doc drift (`lg-docdrift.mjs`, `lg-claims.mjs`):** 600 backtick tokens (187 file names, 26 keys and attributes, 190 identifiers) resolve. 96 hand-picked values are right: MAX_TERMS 4 (`greek-query.mjs`), MAX_RIBBONS 6 (`desk-places.mjs:33`), MIN_PANEL_ROOM 300, toolbar floors 725 and 895 (`read-mode.css:55,75`), history depth 50, undo bar 10 s, `greekSearchEnabled` = `dataset.desk === "on"` (`search-core.js:1292`), PROSE_NOTES false (`note-sources.js:43`), commits 1f27b2e, aacdc92, 82af6a6 exist, branches `claude/desk-1d-hidden`, `-search`, `desk-2a-m10` exist, the three "Loading the Study Desk" notes exist, `sitemap` rules at `astro.config.mjs:58-63`.
- **Privacy:** no stale key; all 25 notebook keys it lists exist. No cookies from the desk (`document.cookie` appears only in `AppsLaunchPopover`, `WelcomePopover`, `announcement-gate`). No Cache API, no service worker, no other IndexedDB database anywhere in `src/`.
- **Gate:** the only non-desk file that statically imports the desk entry is `SiteHeader.astro:395` (`desk-gate.js`, 2,702 bytes raw / 975 gz with `desk-frame.js`); the shell, notebook page, /desk and sheet page are dynamic imports behind `dataset.desk === "on"` (`desk-gate.js:34,41,47,53`); `search-core.js:1253,1271` gate the two desk search modules; `desk.css` enters only through `?inline` (`boot.js:11`, `notebook-search.js:18`, `search-sheet.js:27`), never as a page stylesheet; `qrcode-generator` is imported only by `qr-svg.mjs`, used by two desk modules and a build script. No package is imported by any desk file except through `qr-svg.mjs`. **No static import cycle among desk modules; zero `console.log`, `debugger`, `TODO`, `FIXME` or `HACK` in the desk set; no commented-out code blocks; 62 `console.error` calls.**
- **CSS (`lg-css.mjs`, `lg-css2.mjs`, `lg-css3.mjs`):** the three `@media (prefers-color-scheme: dark)` blocks in `desk.css` (lines 1203, 5427, 6452) are each `:root:not([data-theme="light"])`-guarded and each has an identical `:root[data-theme="dark"]` twin (lines 1212, 5437, 6458); `sheets-page.css` has none because the paper is white and the presenter dark in both themes by design; no `ch` unit in any desk text column; `--focus-ring` used 42 times in `desk.css`, 4 in `sheets-page.css`; the only `outline: none` rules are on programmatic focus targets (`.desk-panel`, `.desk-home-card__title`, `.desk-tour`, `.desk-greek__app-item`) or hand the ring to `::after` (`desk.css:1063-1069`); segmented rings use `outline: 2px solid transparent` for forced colors; px font sizes: one (`sheets-page.css:1177`, 64px decorative); `!important`: 41 (desk.css 21, sheets-page.css 19, notebook.css 1), all for print overrides, `display: none` states and drag cursors; z-index: 15 declarations, max 10000 on `.present-stage` (`sheets-page.css:749`), then 1000 desk menu, 960 tour, 950 undo bar, 900 rail, 800 notes, 790 gutters, below the shared panels (1100) and Display tray (2000) as the comment at `desk.css:21-23` says, no conflicts found; hard-coded colors outside tokens: 29 declarations in `desk.css` (white-on-green button labels, `#c62828` bookmark red, the LIT green as rgba) and 40 in `sheets-page.css` (white paper and dark stage, by design).
- **Dependencies:** `qrcode-generator` 2.0.4 (MIT, zero dependencies, latest on npm, last modified 2025-08-07) and `@fontsource-variable/playpen-sans` 5.3.0 (OFL-1.1, zero dependencies) are the only desk-only packages; the root Dependabot stream (`.github/dependabot.yml`, directory `/`, pattern `*`, weekly) covers both. `@fontsource/cardo` and `noto-sans-hebrew` serve the Greek and Hebrew letters site-wide. All licenses (MIT, OFL) are compatible with the site.
- **Not a regression:** the desk CLAUDE.md claim "`/privacy`'s effective date was not bumped" is a recorded decision; I did not treat LG-2 as needing a bump.

### Appendix A: Test and module coverage (item 1)

`lg-cov.tsv` (module, lines, importing tests, naming tests). Totals for the desk set (67 `desk/*.js`, `desk-gate.js`, `desk-frame.js`, `float-window.js`, `greek-commands.js`, `sheet-share-gate.js`, `search-core.js`, 55 `src/lib/desk-*.mjs`, `greek-*.mjs`): 123 modules; 58 imported by a test; 11 only named; 54 never named. Every `src/lib/desk-*.mjs` and `greek-*.mjs` is imported by a test. `desk-frame.js` and `search-core.js` have their own tests. The 54 untested, by size: `sheet-text.js` 1,094; `search-pane.js` 1,068; `desk-page.js` 1,063; `sheet-lit.js` 963; `sheet-present.js` 808; `notes-margin.js` 749; `tour.js` 710; `tab-mine.js` 695; `sheet-page.js` 600; `lit-pane.js` 559; `greek-find.js` 515; `tab-verse.js` 496; `change-notice.js` 478; `search-sheet.js` 457; `desk-panes.js` 436; `notebook-page.js` 414; `print-notes.js` 409; `sheet-copy.js` 386; `margin.js` 372; `pins.js` 359; `note-settings.js` 357; `places.js` 353; `actions.js` 352; `first-use.js` 351; then 30 modules under 320 lines (the smallest, `glyphs.js`, 30).
Doc claims verified true: see What held up.

### Appendix B: Storage inventory (item 3)

localStorage (writers: file:line; readers in brackets):

| Key | Holds | Written | Read |
|---|---|---|---|
| `lit-desk-preview` | `"on"` (the preview flag) | `Layout.astro:121` (`?desk=on`) | `Layout.astro:121` |
| `lit-desk-panel` | `"open"`/`"closed"` | `panel.js:335,346` | `Layout.astro:121`, `desk-start.mjs:13`, `panel.js:118` |
| `lit-desk-min` | `"1"`/`"0"` minimized | `margin.js:136` | `Layout.astro:121`, `desk-start.mjs:14`, `margin.js:129` |
| `lit-desk-start` | `"min"`/`"open"`/`"closed"` | `notebook-page.js:63-64` | `Layout.astro:121`, `desk-start.mjs:12` |
| `lit-desk-tab` | last Notebook tab | `panel.js:421` | `panel.js:268` |
| `lit-desk-notes`, `-note-font`, `-bookmarks`, `-highlights`, `-read-highlights`, `-list` | display switches | `note-settings.js:85-86` | `note-settings.js:122`, `notebook-search.js:53-62` |
| `lit-desk-hide` | JSON of the settings saved by "Hide my marks" | `note-settings.js:105` | `note-settings.js:109` |
| `lit-desk-home` | where the notebook lives | `first-use.js:52` | `first-use.js:48` |
| `lit-desk-tour` | tour steps seen, `later:<date>`, `never` | `first-use.js:61` | `first-use.js:57`, `tour.js:51` |
| `lit-desk-lexicon` | `"step"` or absent | `greek-data.js:67-68` | `greek-data.js:59` |
| `lit-desk-layout` | the /desk layout, default, shared place, panes' places, sheet per pane (JSON) | `desk-page.js:127` | `desk-page.js:123` |
| `lit-sheet-paper` | Letter or A4 | `sheet-page.js:285` | `sheet-page.js:83` |
| `lit-greek-commands` | `"seen"` | `greek-commands.js:70` | `greek-commands.js:66` |

sessionStorage: `lit-desk-measure`, `lit-desk-width` (`widths.js:91-92`; read `Layout.astro:121`); `lit-desk-float-width` (`widths.js:71`); `lit-desk-greek-split` (`widths.js:85`, `tab-greek.js:780`); `lit-greek-commands-pos` (`greek-commands.js:62`); `lit-desk-ribbon` (flag with tab token; `ribbon-follow.js:80`, cleared `desk-gate.js:23`); `lit-desk-release-feed` (`release-feed.js:29`, the feed copy).

IndexedDB `lit-desk` (version 1; `store.js:56-89`): object stores `records` (keyPath `id`) and `meta`. Meta values: `persistAsked` (`store.js:249`), `lastExport` (`first-use.js:312` reads), `whatsNewSeen` (`desk-whats-new-view.mjs:19`). Read-only opens: `readonly-notebook.js:27` (never creates, aborts on upgrade). `navigator.storage.persist()` / `persisted()`: `store.js:243-249, 367-369`.

BroadcastChannel: `lit-desk` (`store.js:127`, name `desk-store-core.mjs:19`), `lit-desk-ribbon-tab` (`ribbon-follow.js:60`), per-sheet presentation channel (`sheet-present.js:242`, name `channelName` in `desk-present.mjs`), sheet pane (`sheet-pane.js`, 2 uses). History state: `history.state.litSharedSheet` (`sheets.astro:48`). Cookies: none. Cache API, service worker: none.

Desk reads, never writes: `lit_last_read` (`desk-passage.mjs:74`, `desk-places.mjs:7`, `places.js`), `lit_rm_resume_*` (`places.js:46`), the Display tray keys.

Missing from or wrongly described by `privacy.astro`: `persistAsked` and the persistence request; `lastExport`; BroadcastChannel; `history.state` (LG-2). Everything else matches.

### Appendix C: The gate, measured (item 4)

Edges from non-desk files into the desk set (`lg-graph.mjs`): static `Layout.astro:11 -> desk-margin.mjs` (frontmatter, build time, serialised into the inline script), `search.astro:4 -> greek-credits.mjs` (build time), `searchbar.js:49-52` and `search.js:47-49` (client, LG-6); `greek-commands.js:29-31` (lazy, imported with `import()` from both search UIs); dynamic `desk-gate.js:34,41,47,53`, `search-core.js:1254,1272`. Gate-side files and what they import: `desk-gate.js` -> `desk-frame.js`; `greek-commands.js` -> `float-window.js`, `desk-frame.js`, `search-core.js`, three Greek libs; `sheet-share-gate.js` -> `app-platform.mjs`.

Bytes (rolldown bundle with a small `?inline` plugin and lightningcss for CSS; Astro's chunking will differ; no `dist/` exists):

| What loads | JS raw / gz | Notes |
|---|---|---|
| Every page: `desk-gate.js` + `desk-frame.js` | 2,702 / 975 B | the whole desk for a non-desk reader |
| Every page: Greek libs in `searchbar.js` | 26,860 / 10,641 B | LG-6 |
| Desk-on chapter page (gate + shell closure) | 469,870 / 140,649 B | includes `desk.css` 106,288 min / 17,534 gz |
| /notebook | 281,118 / 81,068 B | |
| /desk | 602,386 / 186,221 B | |
| /sheets | 312,042 / 91,296 B | QR library 43.9 KB raw |
| `sheets-page.css` | 19,154 min / 4,483 gz | loaded by /sheets only |
| Desk rules inside shared CSS | about 11 KB raw | `global.css` 3.3 KB (19 rules), `glossary.css` 1.2 KB, `read-mode.css` 0.7 KB, `SiteHeader.astro` 4.9 KB, `[book].astro` 0.7 KB |
| Inline pre-paint script | 1,917 chars | every page, needed |

All 67 desk modules unbundled: 945,499 bytes raw (309,642 gz) JS plus 496,791 bytes (176,787 gz) for `src/lib/desk-*.mjs`. `public/greek/` is 640 files / 41 MB, committed and deployed (text 11 MB, lsj 18 MB, search 5.8 MB, step 3.5 MB, ubs 3.5 MB); the repo's whole `public/` is 1,787 files, far under Cloudflare Pages' file limit, but those files are publicly fetchable now whether or not the desk is on.

### Appendix D: Launch checklist (item 5)

Flip order matters: items 1 to 3 are the switch, the rest follow it.

1. `src/layouts/Layout.astro:121` pre-paint script: stop requiring `lit-desk-preview==='on'`; keep the `isAppPlatform`/touch exclusion; make `?desk=off` store an explicit off (LG-3). Comment block `:94-120` to rewrite.
2. `src/scripts/search-core.js:1292-1294` `greekSearchEnabled()` (Greek search; can launch alone) and `:1253`, `:1271` (direct `dataset.desk` reads).
3. `src/scripts/desk-gate.js:12,38,45,51` (consumers; need no change if item 1 stamps).
4. `src/scripts/keyboard-shortcuts.js:62,117` (`h` and the desk guard).
5. `src/scripts/sheet-share-gate.js:20-51`: delete the "turn the desk on" link and the computer branch.
6. `src/styles/global.css:3518-3522` (the hide rule, LG-7), `:3538-3560` (the 52/48 measure and widths), `glossary.css:734-830` ("Readers keep the wide glossary until the desk is released"), `read-mode.css:47-80`, `src/layouts/ScriptureLayout.astro:393`, `src/pages/read/[book].astro:224-230`, `SiteHeader.astro:101,141` (the `data-desk-toggle` links).
7. Pages' preview copy: `src/pages/desk.astro:43-50`, `notebook.astro:25-35`, `sheets.astro:68-75`, `notebook/help.astro:21,172`, plus the CSS `desk-page.css:36-44`, `notebook.css:34-42`, `sheets-page.css:1282-1295` (the loading/off pair). For no-JS and phones the "off" note must still say something true.
8. `src/pages/privacy.astro:97-152` ("Readers who switch on the notebook, a preview ... "); decide on the effective date (the desk doc says it was not bumped for the preview).
9. Indexing: `desk.astro:34`, `notebook.astro:19`, `notebook/help.astro:14`, `sheets.astro:32` (`robotsNoindex`), `astro.config.mjs:58-63` (sitemap filter), Pagefind default (`Layout.astro:20,202`). `/notebook` and `/sheets` should stay noindex; `/desk` and the help page are a decision.
10. `src/scripts/desk/note-sources.js:43` `PROSE_NOTES` stays false for version 1.
11. Browser floor: LG-5 and LG-7 decisions; Mac Safari and Firefox passes still open in the prior audit.
12. `src/scripts/desk-frame.js:95` `DESK_ATTRS` (what `standDown()` removes) and `src/scripts/announcement-gate.js:28` (`[data-desk-page]`) need no change but belong in the list.
13. Release notes (`src/data/release-notes.json` is automated), `llms.txt`/`llms-full.txt` (no desk mention today), README and CLAUDE.md "preview" wording.

A reader whose browser kept preview state: the `lit-desk-*` keys, the `lit-desk` IndexedDB (version 1) and the sessionStorage keys all keep working as they are; no code reads `lit-desk-preview` outside the one script, so after the flip it is inert. `?desk=off` today removes `lit-desk-preview` and `lit-desk-panel` but leaves the notebook's data, which is right. There is no migration path coded or needed while the preview has one user (BVJ); a future IndexedDB version bump has `onupgradeneeded` in `store.js:83`, and `readonly-notebook.js:32` aborts rather than upgrades.

### Appendix E: Browser compatibility (item 6)

| API | Where | Feature-detected? | Missing means |
|---|---|---|---|
| CSS Custom Highlight API (`CSS.highlights`, `::highlight`) | `highlights.js:41,124-165`, `notes-margin.js:64,527`, `read-marks.js:90`, `sheet-lit.js:247`, `tour.js:285`; 12 `::highlight` rules in `desk.css` | Yes everywhere | silent: no tints, no lit words, but the Highlight row still offered (LG-5) |
| `document.execCommand` | `sheet-text.js:132` (12 commands via the wrapper), `greek-commands.js:139` | try/catch; Greek one has a typeof check and fallback | sheet editor formatting degrades per engine; obsolete API (LG-4) |
| Window Management (`getScreenDetails`) | `sheet-present.js:552-578` | Yes (`typeof`, `screen.isExtended`, try/catch) | presenter view opens in a plain window |
| `CompressionStream`/`DecompressionStream("deflate-raw")` | `desk-sheet-share.mjs:90,96` | No | Opening a shared link reports "damaged" (the inflate path converts any error to `ShareError("damaged")`, `:110-112`, a misleading message); making a link rejects with a TypeError at `:184` (caller not read). Firefox before 113, Safari before 16.4; Low |
| `:has()` | 37 CSS uses (14 in desk CSS), `sheet-present.js:150` | n/a | desk rules lose single states; the shared hide rule loses everything (LG-7) |
| `inert` | `sheet-present.js:406-407,501` | No | content behind present mode stays focusable on Safari before 15.5, Firefox before 112 |
| `structuredClone` | `desk-history.mjs:53` (guarded, JSON fallback), `desk-page.js:862` (not guarded) | one of two | throws on Safari before 15.4 in /desk; Nit |
| `BroadcastChannel` | `store.js:126-127`, `ribbon-follow.js:58-60`, `sheet-present.js:242`, `sheet-pane.js` | Yes | no cross-tab sync; each tab alone |
| `crypto.randomUUID` | `desk-records.mjs:118` and 5 more | No | needs a secure context and Safari 15.4+; fails on plain http (LAN test) |
| `navigator.storage.persist` | `store.js:243` | Yes | no persistence request |
| `ClipboardItem` | `sheet-page.js:121-124` | Yes, with text fallback | plain text copy |
| `<dialog>.showModal` | `sheet-page.js:569` | No | Safari 15.4+ (fine) |
| `navigator.locks`, `Intl.Segmenter`, File System Access (`showSaveFilePicker`), anchor positioning, `field-sizing`, container queries, `@property`, `light-dark()`, nested CSS, view transitions | not used | n/a | n/a |
| popover attribute | not used in the desk (the "circle popover" is script-made) | n/a | n/a |
| `text-wrap` | 1 use, not desk | n/a | n/a |

### Not reached

- A real `dist/` build was not made (brief forbids a build); sizes come from a rolldown proxy. Astro's chunking, `?inline` minification and Brotli will change the numbers; the ratios (desk entry tiny, desk-on closure large, Greek libs in the search bundle) will not.
- No real browser was used. LG-5 and LG-7 are code reads plus the engines' published support, not observed failures.
- JS/CSS magic-number duplication was sampled only where a test exists (FIRST_PAINT, panel minimums); `280`/`160` in `desk-layout.mjs` against `desk.css` was not diffed.
- `npm audit` and a legal read of the Greek license mix were not done (cross-slice: Greek and security auditors).
- Per-finding "is it in STUDY-DESK-AUDIT-1.md" was checked by keyword (execCommand, persist, privacy, Custom Highlight, `:has(`, static import, BroadcastChannel, GREEK_SOURCES_DIR); the prior audit has no coverage map, no import-graph audit and no launch checklist, so those are NEW.

## Appendix G: Live browser verification and walkthrough (`LV`, Sonnet)

Branch `claude/phase5-work-sessions`, dev server on localhost:4321 started with `preview_start dev` (it served this tree: `/src/scripts/desk/search-pane.js` returned 200). Browser pane emulated at 1280x800 and 1024x768, light and dark. Everything below was measured in the page (`getBoundingClientRect`, `scrollWidth`, `document.activeElement`, `localStorage`, `performance`, MutationObserver, CSSOM) or driven with real key and mouse events through the pane. Repo untouched. Dev-mode caveats: files are unminified; Pagefind is not built, so `/pagefind/pagefind.js` returns 404 and the Search pane's note reads "The glossary, articles, and introductions couldn’t be searched just now" (both expected in dev); the Astro dev toolbar draws a dark bar at the bottom of every screenshot.

### Summary

Of the other-auditor claims I tried: 9 CONFIRMED (NB-1 for the H key, NB-2, NB-3 wrapping and OpenDyslexic clipping, NB-4, NB-5, DK-1, DK-3, DK-4, DK-11), 2 PARTLY (DK-2 and DK-6: the mechanism or CSS gap is real, the assistive-technology result is untestable here), and 3 corrections: NB-1 does not happen from the Settings "Hide my marks" checkbox, NB-3's clipping at 280px does not happen with Inter, and DK-13 was not reproduced. NB-6 is confirmed from source and the live panel header. The walkthrough found no console errors (the only one in the whole run is the dev-only Pagefind 404), no failed desk requests, no horizontal overflow on any desk page at 1024 or 1280, and the tour (16 steps), Present mode, /notebook/, /notebook/help/, the Search pane, Greek search and undo all worked. New findings are small: 4 Low and 1 Nit (no Critical, High or Medium). The gate holds: a desk-off reader fetches nothing from `/greek/`, `/src/scripts/desk/` or `desk.css`; it does load the Greek search modules (LV-4).

### Part 1: verification of other auditors' claims

| Claim | Verdict | What I measured or saw |
|---|---|---|
| NB-1 H closes the Notebook for good | CONFIRMED for the H key; NOT REPRODUCED for the Settings checkbox | Panel expanded (display flex, rail 307px). Pressed `h`: `.desk-panel` display none, `.desk-rail` hidden (0x0), `localStorage["lit-desk-panel"]="closed"`, and `data-desk-notes/bookmarks/highlights=off` set. Pressed `h` again: the three attributes cleared (marks back) but the panel stayed display none, rail hidden, key still "closed". After a full reload of /john-3/ it is still closed and has no tab. The header "Study Desk" is `<a href="/desk/">` (two copies, one visible). The route back that exists: typing "notebook" in the site search box lists a command "Open the Notebook"; clicking it set `lit-desk-panel="open"` and focus landed on `.desk-panel`. Correction to the report: ticking "Hide my marks" in the Settings tab (real click) hid the marks and left the panel open (display flex, key "open"); un-ticking restored them. Only the H key closes it. |
| NB-2 unsaved note words discarded silently | CONFIRMED (Escape, Cancel, verse-number click); the x button not driven separately | Opened the editor from the verse 16 menu, typed words. Escape: textarea gone, no confirm, no message, nothing saved, focus on `BODY`. 36 typed characters then a real click on the verse 15 number: editor replaced by "John 3:15 options", words lost. 19 characters then Cancel (real click): editor gone, no dialog, no undo bar, focus back on the verse number. (A verse number lying under the editor takes the click as a click on the editor, so test with a number clear of it.) |
| NB-3 tab labels wrap or clip | CONFIRMED for wrapping at 1280; CONFIRMED for clipping with OpenDyslexic; NOT REPRODUCED for clipping at 280px with Inter | At 1280x800 the panel is 304px. "My Notes" and "This verse" each lay out on 2 lines (line-height 21px, padding 8px 10px), every tab is 59 to 60px tall, row 59.4px. At the 280px minimum (arrow keys on "Resize the text and the Notebook", aria-valuenow 280) Inter still fits: tablist scrollWidth 278 = clientWidth 278, last tab right edge 1248 vs panel 1249 (it wraps, it does not clip). With `html[data-font="dyslexic"]`: at 280px tablist scrollWidth 360 vs clientWidth 278, the Settings tab is 107px wide with its right edge at x=1330 against a panel edge of 1249 (81px cut off, 30px visible); at 307px, 54px cut off; the row is still 59px tall. Same two-line wrapping at 1024px in dark mode (seen in a screenshot). |
| NB-4 no early keyboard route | CONFIRMED | On /john-3/ there are 229 visible tab stops. The header "Study Desk" link is stop 10 and goes to /desk/. The first control in `.desk-rail` is stop 216 (`desk-panel__desk`), after 16 footer links and 36 verse numbers. The only skip link is "Skip to content". |
| NB-5 undo bar unreachable | CONFIRMED, with a correction | After a highlight removal `.desk-undo` is `<body>` child 12 of 17 (before `.desk-rail`, `.desk-gutters`, `.desk-notes`, so not the very last), but its Undo button is tab stop 216 of 231, after the last footer link (213), and the bar lasts about 10 s. The `sr-only[role=status]` text is "Highlight removed from John 3:16." with no mention of Ctrl+Z; the visible `p#deskUndoText` repeats it (not aria-hidden). Ctrl+Z with focus on body worked and said "Undone: highlight on John 3:16 removed." |
| NB-6 tour and help teach a removed layout | CONFIRMED | `desk-first-use.mjs:230, 232` still say "× closes it, and the Notebook button brings it back". The live panel header has only "Minimize the Notebook" and the "Open on the Study Desk" link; no ×, and the header's control is a link to /desk/. (I walked all 16 tour steps with a loop; step 8's text matches the source.) |
| DK-1 keyboard-only blanking | CONFIRMED | Sheet pane (Bible study template) with John 3:16: `.desk-sheet__passage-text` has no `tabindex`, no `role`, contentEditable "inherit". The passage module's tab stops are Show in the LIT, move up/down/remove, "Blank the selected words", the key-term chip "trust" (the only chip for this verse), Select all, Unselect all and the hint fields. With focus on "Blank the selected words", Shift+Right x3 left `getSelection()` empty and Enter did nothing visible. The chip via Enter blanked it (6 blank elements) and kept focus on the chip (good). Every other word needs a mouse. |
| DK-2 Search pane status not announced | PARTLY (mechanism confirmed; announcement untestable) | `.desk-search__status[role=status]` is computed `display:none` while empty and `.desk-search__note` is `hidden`. A MutationObserver on the first query logged "Searching…" written while the element was already `display:block` in the same task (un-hidden and filled together). Later queries in that pane changed text in an already-rendered region ("Searching…" to "No results."). Focus stays in the input throughout. |
| DK-3 Sheet pane focus loss | CONFIRMED | Enter on "‹ All sheets": `document.activeElement` is `BODY` and the list is drawn. Enter on the sheet's row opened the sheet, active element again `BODY`. (New sheet correctly focuses "Sheet title"; "Add to ‘Untitled sheet’" from the verse menu returned focus to the verse number.) Delete not driven. |
| DK-4 Greek controls in the Search pane | CONFIRMED (word choice) | Kind menu "Greek", query `pistis`: three word choices. Focused the second and pressed Enter: it became `aria-pressed=true`, results redrew ("67 times in the New Testament"), and `document.activeElement` was `BODY`. Exact-form and Show-more not driven. |
| DK-6 forced colors | PARTLY | The pane cannot emulate forced-colors. Read the CSSOM: 20 selectors sit inside `@media (forced-colors: active)`, including `.desk-greek__choice[aria-pressed="true"]`, `.desk-ws__shape[aria-pressed="true"]`, `.desk-mine__label[aria-pressed="true"]`; none names `desk-search`, `desk-pane__pin` or `btn--quiet`. The CSS gap is real; the rendering is untested. |
| DK-11 two tabs and the layout key | CONFIRMED (second tab simulated) | I wrote `{...key, start:"mine", mine:last}` to `localStorage["lit-desk-layout"]` (what a second tab's "Make this my default" writes). Scrolling the LIT pane did not rewrite the key, but "Next chapter, John 4" in the first tab (a save) did: `start` back to "last", `mine` gone. |
| DK-13 Escape in the Print menu | NOT REPRODUCED in the common case | With links in the menu, Escape closed it and returned focus to the Print button. The failing case (no link to show) needs a draft chapter or no place; not driven. |

### Findings

#### LV-1 · Low · a11y · NEW
**Where** `src/scripts/desk/note-editor.js` close paths (Escape through `src/scripts/lit-panel.js:75-79`, Cancel and × at `note-editor.js:232-237`); `src/scripts/desk/tour.js` end of tour.
**What happens** Closing the note editor with Escape leaves focus on `<body>`, while closing it with Cancel returns focus to the verse number that opened it (measured: Escape gave `BODY`; Cancel gave `SUP`). A keyboard reader who presses Escape, the most natural key, has to Tab from the top of the page. Finishing the tour with "Done" also leaves focus on `BODY` (measured), after a window that took focus when it opened.
**Evidence** Real keystrokes in the pane, with `document.activeElement` read afterwards.
**Fix** Route Escape through the same close-and-restore-focus path Cancel uses, and have the tour restore focus to the Notebook tab or whatever held it before the tour began.
**Confidence** High on what was measured; Medium on the tour's cause.

#### LV-2 · Low · a11y · NEW
**Where** the Greek tab's splitter, `[role=separator][aria-label="Resize the Greek and the entry"]` (`src/scripts/desk/tab-greek.js`, `src/lib/desk-greek-split.mjs`).
**What happens** The separator is focusable (`tabindex=0`) and carries `aria-valuemin=25` and `aria-valuemax=75`, but has no `aria-valuenow` and no `aria-valuetext` until the first arrow key: read with the entry open, `aria-valuenow` was null. After two Up presses it read 58 with the text "Entry 58 percent, Greek 42 percent", so the key model works. A screen reader announces a splitter with no value on first focus, and ARIA requires `aria-valuenow` on a focusable separator. The panel's own splitters set theirs from the start (47 with "Text 47 characters wide", 307 with "Notebook 307 pixels wide").
**Evidence** Attribute dump of all four separators on John 3 with the Greek entry open.
**Fix** Set `aria-valuenow` and `aria-valuetext` when the entry opens, from the current split.
**Confidence** High.

> **Fixed in FA2-t (2026-11-03, branch claude/audit2-session8-greek; not yet browser-checked):** The separator is given its value when an entry opens.

#### LV-3 · Low · usability · NEW
**Where** `src/scripts/desk/record-rows.js` (the fallback line, about `:115-125`: `r.label ?? r.name ?? r.body ?? r.note ?? r.title ?? r.quote?.exact`), shown by `src/scripts/desk/kept-list.js:213` as "Other items" on /notebook/.
**What happens** An untitled sheet (a new sheet from a template, which the sheet list calls "Untitled sheet") is listed on /notebook/ as the row "Sheet" with the kind "Sheet", with "Labels…" and "Delete" buttons named only "Labels for sheet" and "Delete sheet". No title, no date, no link to `/sheets/?id=…`. With several sheets the rows and their Delete buttons are identical. (A titled sheet probably shows its title through `r.title`; I did not test one.)
**Evidence** Row HTML: `<span class="desk-item__ref">Sheet</span><span class="desk-item__kind">Sheet</span>` plus the two buttons, nothing else.
**Fix** For a sheet, fall back to "Untitled sheet", link to `/sheets/?id=` (it is a page of its own), and put the title in the button names.
**Confidence** High for an untitled sheet.

> **Fixed in FA2-i (2026-11-03, branch claude/audit2-session4; not yet browser-checked):** a sheet's row shows its name, links to `/sheets/?id=`, and names it in Labels and Delete.

#### LV-4 · Low · performance · NEW
**Where** `src/scripts/searchbar.js:49-52`, `src/scripts/search.js:47-49`, `src/scripts/greek-commands.js:29-31`, `src/lib/greek-commands-ui.mjs:13` (`import { SIGNS, W } from "./desk-greek.mjs"`), loaded for every reader.
**What happens** The desk-off page (`?desk=off`, fresh storage) still requests these in dev: `greek-query.mjs` 187KB, `greek-search.mjs` 137KB, `greek-commands-ui.mjs` 40KB, `desk-greek.mjs` 49KB, `word-stem.mjs` 48KB, `greek-credits.mjs` 17KB, `greek-parse.mjs` 12KB, `levenshtein.mjs` 5KB (about 495KB unminified), plus the always-present `desk-gate.js` 16KB and `desk-frame.js` 40KB. So the shared site-search bundle reaches a `src/lib/desk-greek.mjs` file through a static import, which the root rule ("shared reader code never imports [the desk] statically") discourages, although no `/greek/` data and no `src/scripts/desk/` file is fetched. In a production build Rollup should tree-shake `desk-greek.mjs` down to the two constants, so the real cost is probably small.
**Evidence** `performance.getEntriesByType("resource")` on the desk-off page: 70 non-Vite requests, none under `/greek/` or `/src/scripts/desk/`, but the eight modules above.
**Fix** Confirm with `npm run build` and inspect the search chunk (not done here: it writes `dist/`). If `desk-greek.mjs` is large there, move `SIGNS` and `W` to a small shared module.
**Confidence** Low on production size; High on the dev request list.

#### LV-5 · Nit · longevity · NEW

> **Status (2026-11-03, main `9cc05f24`):** Moot: #437 rebuilt the /desk header.
**Where** the /desk header (`src/scripts/desk/desk-page.js`): the Print button and the Layout button both carry the class `desk-ws__layout`.
**What happens** `document.querySelector(".desk-ws__layout")` returns the Print button, so any CSS, test or script meant for the Layout menu also reaches Print (it cost me a wrong click). Harmless today.
**Fix** Give Print its own class (`desk-ws__print`) and keep `desk-ws__layout` for Layout alone.
**Confidence** High.

### Part 2: walkthrough notes (first-time desk user, then keyboard-only)

- **First use.** Fresh storage on /john-3/?desk=on: the Notebook starts as a collapsed tab (a 40px rail). Expanding it shows the "Where should your notebook live?" card with two buttons, above everything else in My Notes. Choosing "Keep it in this browser" stored `lit-desk-home=browser`, removed the card and opened the tour offer in a window (focus on its title `h2`). Taking the tour: 16 steps (Marking the text 1 to 7, The Notebook 8 to 12, Finding and keeping 13 to 16), no console error, no page error, tab restored to My Notes, notes untouched, but focus ends on `BODY` (LV-1).
- **Marks.** Verse menu from a real click: Copy text, Copy link, Copy with footnotes, Make an image, Add a note, Bookmark, four highlight colors, Remove highlight, Show in Notebook, Ribbon here. A note (typed with real keys, saved by keyboard) put a handwriting note in the left margin at 1280 in dark mode, with "John 1:1" auto-linked; focus returned to the verse number ("Verse 8, 1 note of mine"). Bookmark: "Bookmarked John 3:2.", listed in My Notes (it appears about a second after the status). Highlight: "Highlighted yellow: John 3:16." Pinned footnote: "Footnote a pinned.", listed under "Pinned footnotes" with Unpin. Ctrl+Z worked. At 1024px with the panel open the margin column was hidden (0x0) and the notes live in the panel; no overflow (document 1009 = 1009).
- **Tabs.** My Notes (scope "John 3 / Everything", color filters, per-item Edit and Delete); This verse (the Greek line, then "My notes … Add a note"); Greek (SBLGNT text, 658 word buttons; clicking ἄνθρωπος opened the entry with parsing and the UBS senses; the splitter moves by arrows); Settings (Notes in the margin, My bookmarks, My highlights, Hide my marks, Remind me to save a copy; both Print buttons; Take the tour; Help; Tell us what’s missing). Greek search in the tab: `*.aor.impv` returned "Aorist imperatives · 762 matches in 615 verses" (21 rows, then Show more).
- **/desk.** Header menus: Print (three links, Escape returns focus to the button) and Layout (11 arrangements, "Make this my default", radios for what opens). "Two by two" gave four 613x347 panes with focus returned to Layout. The pane-kind menu works from the keyboard (Enter, End, Enter chose Search). Search pane: keyword `liberation` gave "48 topic matches • 119 keyword matches"; `zzzqq` gave "No results."; `ὁ θεός` gave "1,536 matches in 961 verses"; `pistis` with kind Greek gave three word choices. LIT pane: "Next chapter" moved it to John 4; scrolling to the end of John 4 loaded no further chapter (John 5 is probably a draft; not checked). At 1024x768 dark: four 485x347 panes, no clipped controls, no overflow.
- **Sheets.** New sheet from "Bible study" (the template picker takes focus on its first card, Enter chooses; the title field takes focus). Added John 3:16 from the verse menu by keyboard. /sheets/?id=… leader copy shows the blanked answer; participant copy hides it ("One term is left blank here. Its answer is on the leader copy.") and the title becomes "…, participant copy". Present mode: opens a `role=dialog` named "Presenting Untitled sheet", focus on it, the page inert; Right x2 gave "Screen 3 of 9"; Escape closed it with focus back on the Present button and `inert` cleared. Not opened: the presenter window, the print dialog, any download.
- **/notebook/ and /notebook/help/.** /notebook/ lists 12 headings, the highlight, the note, the bookmark and the sheet, with Save and Delete controls; no overflow; no console output. /notebook/help/ has 11 sections and every in-page anchor resolves.
- **Dark mode.** Panel (background rgb(29,29,31), text rgb(240,240,240)), /desk panes, margin note and editor were legible at 1024 and 1280; nothing looked unstyled. The only dark-mode defect seen is the tab wrapping already reported (NB-3).

### Part 3: gate and cost (dev mode: unminified, decoded bytes, because `transferSize` was 300 for cached files)

| | desk off (`?desk=off`, fresh) | desk on (`?desk=on`) |
|---|---|---|
| Requests, excluding `/@fs` Vite deps, `/@id` and fonts | 70 | 155 (85 more) |
| Under `/src/scripts/desk/` | 0 | 48 files, 2.92MB |
| `src/lib` modules the desk adds | 0 (the Greek search modules of LV-4 are in both) | 32 files, 1.89MB |
| `desk.css` (`?inline`) | not requested | 1 file, 175KB |
| Other additions | none | `greek-commands.js` 90KB, `float-window.js` 31KB, `verse-counts.js` 17KB, `article-slugs.json` 2.5KB |
| `/greek/` data | 0 requests | `/greek/text/john-3.json` (200), logged twice in the network list |
| Fonts | Inter 400/500/600/700, Crimson Text 600/700 | no extra font file at load (Playpen Sans for margin notes was not measured) |
| Timing (cached, localhost) | DOMContentLoaded 116ms, load 138ms | DCL 88 to 103ms, load 114 to 212ms, JS heap 30MB, 1272 elements |

The desk-on additions total about 5.1MB decoded in dev. Largest desk scripts: `tab-greek.js` 256KB, `notes-margin.js` 182KB, `tab-mine.js` 173KB, `tour.js` 171KB, `panel.js` 152KB, `tab-verse.js` 123KB, `greek-find.js` 109KB, `change-notice.js` 109KB, `print-notes.js` 93KB; libs `desk-sheet-format.mjs` 241KB, `desk-change.mjs` 143KB, `scripture-refs.mjs` 109KB, `desk-first-use.mjs` 98KB, `desk-records.mjs` 95KB. `tour.js` and `print-notes.js` loaded on this first visit (the tour offer was due); whether they are lazy on later visits was not checked. Gate confirmed: with the desk off there is no `/greek/` request, no desk script, no desk stylesheet. No jank noticed in either mode; two screenshots and one key action timed out while the pane was hidden (a pane effect, not the page).

### Improvements

- Give the first-use card a visible "Decide later", so the reader's own marks are not pushed under it: at 1024x768 the card fills the panel and the first mark is below the fold (the tour offer only starts once the question is answered, which is the owner's design).
- Say "Press Ctrl+Z to undo" in the undo bar's live text and its visible text (also NB-5).
- With the Notebook closed (NB-1) no control on a Study View page brings it back; a visible tab or button would close that gap.
- The Search pane's dev-only note ("couldn’t be searched just now") will puzzle anyone on `npm run dev`; a one-line dev hint ("Pagefind is built by `npm run build`") would save time.

### Questions for the owner

1. Is it intended that every reader, desk on or off, downloads the Greek search modules for the site search (LV-4)? That is the Greek-in-search behavior, but the gate rule in the root CLAUDE.md reads as if desk code stays out of shared bundles.
2. Should the H shortcut minimize the Notebook instead of closing it (NB-1)? Only the key does this today; the Settings switch already behaves well.

### What held up

- Real-event keyboard flows that worked: the pane-kind menu (Enter, End, Enter), the template picker's focus, the title field taking focus on a new sheet, the verse menu from Enter on a verse number, "Add to sheet" and Save returning focus to the verse number, Escape on the Print menu with focus restored, the Layout menu's focus restore, and Present mode (dialog name, inert page, arrows, Escape, focus restored).
- No console error, warning or failed request attributable to the desk across /john-3/, /desk/, /sheets/, /notebook/ and /notebook/help/ (only the dev Pagefind 404).
- /desk at 1024x768 in dark mode: four panes, no clipped control, `scrollWidth` equal to `clientWidth` on every pane head and body, no document overflow.
- Greek search: `*.aor.impv` (762 matches, 615 verses), `ὁ θεός` (1,536, 961), `pistis` with the Greek kind (three choices), an entry open on a word, and the splitter's arrow keys.
- Undo by Ctrl+Z with the right announcement; a bookmark, highlight, note and pinned footnote all appeared in My Notes and on /notebook/.
- The panel's width splitter (`aria-valuetext` "Notebook 307 pixels wide"), the margin splitter ("Text 47 characters wide") and the Layout menu radios.
- The `?desk=off` gate: no desk script, desk stylesheet or `/greek/` data request.
- The newsletter's `role=alert` and `role=status` texts in the footer are `display:none`, so they are not exposed.

### Not reached

Mouse dragging of a pane edge and drag-to-split; the footnote picker in a sheet; `#share1` shared sheets; "Copy for Word", Share, Print and download buttons (deliberately not pressed); the presenter-view window; a titled sheet on /notebook/; the 1366 and 1440 widths; reduced motion; forced-colors rendering and any screen reader; the Exact-form and Show-more Greek controls; a Search pane reference query; the "What's new" and history parts of Settings; Delete from the Sheet list; touch.

## Appendix H: Copy and terminology (`CP`, Sonnet)

Auditor: COPY AND TERMINOLOGY. Branch `claude/phase5-work-sessions`, checked out 2026-11-03.
Report complete. Method: acorn extraction of every string literal and template fragment in
`src/scripts/desk/*.js`, `desk-gate.js`, `desk-frame.js`, `greek-commands.js`,
`sheet-share-gate.js`, `src/lib/desk-*.mjs`, `greek-*.mjs` (8,563 literals, 1,755 judged
reader-facing; scripts in the scratchpad `cp/` folder), plus a hand read of
`desk.astro`, `notebook.astro`, `sheets.astro`, `notebook/help.astro` and `privacy.astro`.

### Summary

The desk's copy is in good shape on the mechanical rules: no em dashes, no punctuation outside curly quotes, no straight quotes in
anything a reader sees, no "...", Oxford commas intact after the BA134 to BA139 pass, and every number in copy matches its
constant. The one American-spelling miss is vocabulary ("tick", CP-6), from the newest code (the Search pane).
What is wrong is mostly **accuracy after Phase 5 and clarity of explanation**: 18 findings, 0 Critical, 0 High, **5 Medium**,
9 Low, 4 Nit. Medium: the stale tour/help text NB-6 found (CP-1, verified and extended with the "As I left it" note); a help
sentence that says a ribbon "marks it in the text" when only bookmarks do (CP-2); trash copy that promises 30-day recovery nobody
can use, and disagrees with the help page (CP-3); raw validator text shown in "Open a copy" (CP-4, reproduced); and My Notes
empty states that never say how to start (CP-5). The terminology audit (CP-11) found the feature has three names (Study Desk,
"the notebook preview", "a preview of new study tools"), Delete/Remove used for one action (CP-7), "my desk" for the notebook
(CP-8), and the words marker, mark, ribbon, copy, screen and tab each carrying two or three meanings. All accessibility checks of
text passed except title-only explanations (CP-9), one heading level (CP-12), and two announcement phrasings (CP-14).

### Findings

#### CP-1 · Medium · docs · NEW (extends NB-6)

**Where**: `src/lib/desk-first-use.mjs:230, 232, 276, 323`; `src/pages/notebook/help.astro:53`;
`src/scripts/desk/notebook-page.js:126` (the "As I left it" note).

**What happens**: NB-6 verified. Phase 5 (89d34b0d) removed the Notebook's × and moved the
foot of My Notes into the Settings tab, and the tour/help still teach the old layout:
- Tour "The Notebook" (both wordings, `:230` and `:232`): "» minimizes the Notebook to a tab
  at the window’s edge, × closes it, and the Notebook button brings it back." There is no ×.
  ("The Notebook button" is still true of the dock tab at the window's edge, which reads
  "Notebook", so only "× closes it" is plainly wrong; but the header control is now the
  "Study Desk" link, so the sentence is ambiguous.)
- Tour "Set the widths" (`:276`): "“Reset widths” at the foot of “My Notes” puts them back."
  It is in Settings.
- Tour "Where it’s kept" (`:323`): "The foot of the panel says when you last saved a copy."
  It is in Settings.
- Help (`help.astro:53`): "You can change that at the foot of the panel." The reminder
  checkbox is in Settings.
- Notebook page (`notebook-page.js:126`): "“As I left it” starts minimized, then follows what
  you last did: a panel you close stays closed, and one you open out stays open." A reader
  has no Close; only H ("Hide my marks") and the tour close it. (See NB-1.)

**Fix** (replacement strings):
- `:230` "“My Notes” lists what you’ve kept in this chapter, or everything. Select one to go to it. The » button minimizes the Notebook to a tab at the window’s edge, and that tab brings it back."
- `:232` "This lists what you’ve kept. Select one to go to it. The » button minimizes the Notebook to a tab at the window’s edge, and that tab brings it back."
- `:276` "… to make each wider or narrower. “Reset widths” in the Settings tab puts them back."
- `:323` "Your notebook is kept in this browser, on this computer. Nothing is sent anywhere. The Settings tab says when you last saved a copy."
- `help.astro:53` "You can change that in the Notebook’s Settings tab."
- `notebook-page.js:126` "“As I left it” starts minimized, then follows what you last did: a panel you minimize stays minimized, and one you open stays open."

**Confidence**: High.

#### CP-2 · Medium · docs · NEW

> **Status (2026-11-03, main `9cc05f24`):** Fixed by #434 (Bookmarks).

**Where**: `src/pages/notebook/help.astro:94-95` (compare `src/lib/desk-first-use.mjs:207`, the tour's ribbon step).

**What happens**: The help page's "Places and ribbons" section, the only help text on ribbons,
says "A place is a spot you want to return to, and a ribbon marks it in the text, so you can find
your way back to it." A ribbon does not mark anything in the text. A ribbon is a named place that
moves as you read on in a book (`ribbon-follow.js`; the tour: "A bookmark stays put; a ribbon moves
with you"). What the margin draws is a *bookmark*, as a red ribbon-shaped glyph
(`notes-margin.js:166-172`, class `desk-ribbon`, `aria-label` "Bookmark, Romans 8:3"). A reader who
follows the help looks for a ribbon in the text, finds only bookmarks, and the two words blur.

**Evidence**: read the `ribbon-follow.js` header, `notes-margin.js:162-173`, `places.js`, and the tour step.
No code draws a `place` record in the text.

**Fix**: replace the paragraph with: "A place is a spot you can come back to. A ribbon is a place you
name for a reading you are following, such as a study group’s. It moves with you as you read on in
that book, and you can open it later from Places in the Notebook or on the notebook page. A
bookmark is different: it stays on its verse, and a red mark beside the text shows it."

**Confidence**: High.

#### CP-3 · Medium · usability · NEW

**Where**: `src/scripts/desk/notebook-page.js:132` and `:137` (the "Delete everything" section),
`:304`; `src/lib/desk-export.mjs:464`; `src/pages/notebook/help.astro:81-87`.

**What happens**: The copy talks about "the trash" as if the reader could use it, and nothing in the
UI lets them. There is no screen that lists or restores the trash (grep of `src/scripts/desk`: the trash
is reached only through Undo/Ctrl+Z, 50 deep, for the life of the page). Yet:
- `:132` "Moves every note, highlight, bookmark, label, and place in this browser to the trash. You can
  undo it right away. The trash keeps each one for 30 days, then only a marker that it was deleted."
  A reader reads "kept for 30 days" as "recoverable for 30 days".
- `desk-export.mjs:464`, shown after choosing a file: "“Romans 8:3” has been deleted here since this
  copy was saved, so it was left out. It is in the trash, if you want it back." No control brings it back.
- Help (`help.astro:81-83`) says the opposite, correctly: "Undo ... brings it back until you leave the
  page; after that, only a saved copy does." The notebook page and the help page disagree.
- `:304` "Are you sure? This deletes 14 items from this browser." does not say Undo works right after,
  and "right away" in `:132` is undefined (it is Ctrl+Z until the page is left; the bar's button closes
  after 10 seconds).
- `:132` and `:137` say "only a marker that it was deleted" for what the code calls a tombstone: jargon,
  and "marker" also names a note's icon (the note editor's "Marker:" choice).

**Fix** (replacement strings):
- `:132` "Moves every note, highlight, bookmark, label, and place in this browser to the trash. Choose Undo
  (or press Ctrl+Z, ⌘Z on a Mac) to bring them back until you leave the page. After that, only a saved copy
  can. The trash is kept 30 days so that a copy you open later can’t bring a deleted item back, but you
  can’t open it yourself."
- `:137` "For a shared computer. Erases the words of everything in the trash now, instead of after 30 days.
  Only a note that each item was deleted stays. This can’t be undone."
- `desk-export.mjs:464`: drop " It is in the trash, if you want it back."
- `:304` "Are you sure? This deletes N items from this browser. You can undo it until you leave the page."

**Confidence**: High on the mismatch; Medium on severity (nothing is lost, readers are only misled).

#### CP-4 · Medium · usability · NEW

**Where**: `src/scripts/desk/export-import.js:199` ("A record was left out: ..."),
`src/lib/desk-export.mjs:689` (builds the reason from `validateRecord`), `:499`, `:555`, `:569`,
`:779-784` (`describeAhead`); `src/lib/desk-records.mjs:296-346` (the raw messages).

**What happens**: When "Open a copy" meets a file with a bad entry, the reader is shown developer
validation text. Run in node (`planImport` on three hand-broken records, script `cp/skipped.mjs`):
- "A record was left out: Color "purple" is not one of yellow, green, blue, pink."
- "A record was left out: Created is not an ISO 8601 UTC time; contentVersion is missing."
- "A record was left out: EndVerse comes before verse."
(`.replace(/^./, c => c.toUpperCase())` capitalizes a camelCase field name.) Also "This looks like JSON
but couldn’t be read." (`:555`), "This backup has no list of records." (`:569`), and `describeAhead`:
"3 records in this file were dated by a clock running ahead. Such a record never replaces, deletes, or
brings back anything here: 1 added with an earlier date, and yours kept for the other 2." ("Such a
record" and "yours" have no clear referent.) None says what to do next. The path is rare (a hand-edited
or damaged file, a clock set ahead), so Medium at most.

**Fix**: map the validator's problems to plain sentences in `planImport` (raw text to the console):
`reason: "It has a color the notebook doesn’t know."` / `"Its date couldn’t be read."` / `"Its verses are
out of order."` / generic `"It couldn’t be read."`; prefix "An item in this file was left out:" (not "A
record"); `:555` "This file isn’t a notebook copy this page can read. Choose a file saved with “Save a
copy.”"; `:569` "This backup file has no entries in it."; `describeAhead` → "3 items in this file carry
dates from a clock that was set ahead. They never replace or delete anything here: 1 was added with an
earlier date, and your own was kept for the other 2."

**Confidence**: High (reproduced).

#### CP-5 · Medium · usability · NEW

**Where**: `src/scripts/desk/panel.js:131` ("Nothing kept for ${here.label} yet."), `:137` (prose pages),
`src/scripts/desk/tab-mine.js:295` ("Nothing kept yet."), `src/scripts/desk/kept-list.js:161`
("Notes, highlights, and bookmarks you make while reading appear here."), `src/lib/desk-notebook.mjs:168`.

**What happens**: The first thing a reader sees in My Notes on a chapter, once the first-use card is
answered, is "Nothing kept for John 3 yet." It says there is nothing, not how to start. The notebook
page's version says what will appear but not how to make one. The tour is the only teacher (it "never
starts by itself"), the help page does not explain it (NB-7), so a reader who chose "Don’t show this
again" never learns that a verse number opens the "Add a note / Bookmark / Highlight" row.

**Fix**: `panel.js:131` → ``Nothing kept for ${here.label} yet. Select a verse number, then choose “Add a note,” “Bookmark,” or “Highlight.”``
(in Read View, `inReadView`: "Nothing kept for this book yet. Select some words, then choose “Bookmark” or
“Highlight.”"); `kept-list.js:161` → "Notes, highlights, and bookmarks you make while reading appear here. On a
chapter, select a verse number and choose “Add a note,” “Bookmark,” or “Highlight.”"

**Confidence**: High.

#### CP-6 · Low · docs · NEW

**Where**: `src/scripts/desk/search-sheet.js:144` ("Clear ticks"), `:180` (`${n} verses ticked.`),
`:181` ("Tick verses to choose; with none ticked, every result goes (N)."); `src/scripts/desk/sheet-lit.js:609-611`
("Select all" / "Unselect all"); `src/lib/desk-highlights.mjs:165` (developer message "is not a highlight colour").

**What happens**: "Tick" for a checkbox is British usage; the repo's rule is American for anything a reader
sees. The Search pane (3m, 2026-11-01) added these after the last copy pass (BA134 to BA139). That pass
found no British *spelling*, and "tick" is vocabulary. A scan of all 8,563 literals for -our/-re/-ise/-yse/
-lled, grey, whilst, learnt, towards and the like found no other reader-facing case. The one "colour" is a
thrown developer message, never shown (Nit). "Every result goes" is also unclear, and "Unselect" is not a
standard word.

**Fix**: `search-sheet.js:144` "Clear checks"; `:180` `${plural(...)} checked.`; `:181` "Check verses to choose.
With none checked, all N results go on the sheet."; `sheet-lit.js:611` "Clear all" (or "Deselect all");
`desk-highlights.mjs:165` "color".

**Confidence**: High.

#### CP-7 · Low · usability · NEW

**Where**: `src/scripts/desk/record-rows.js:152-161` and `tab-mine.js:561-562, 669` ("Delete", "... deleted.");
`src/scripts/desk/actions.js:116, 139, 255` ("Remove bookmark", "Bookmark on X removed.", "Remove highlight");
`src/scripts/desk/tab-verse.js:439-461` ("Remove", "Highlight on X removed."); `src/lib/desk-history.mjs:241-242`
(`describeEntry`: "deleted" for a note, "removed" for everything else); `change-notice.js:398, 453` ("Delete").

**What happens**: One action on one kind of record has two verbs, by surface. A bookmark comes off with
"Remove bookmark" in the verse menu, but in My Notes the button is "Delete" and the bar says "Bookmark on
Romans 8:3 deleted."; Undo then speaks the other word ("Undone: bookmark on Romans 8:3 removed", from
`describeEntry`). Help says "Deleting a note, bookmark, or highlight moves it to the trash." Labels,
ribbons and sheets are "Delete". "Unpin" is separate and fine.

**Fix**: one rule everywhere. Suggested: "Delete" for things the reader typed or named (notes, labels,
ribbons, sheets), "Remove" for marks put on the text (bookmarks, highlights): verse menu, This verse,
My Notes row, change notice, undo bar, help. Concretely `record-rows.js:152-161`, `tab-mine.js:561-562, 669`,
`kept-list.js:239` and `change-notice.js:398, 453` pick the verb from `r.kind`.

**Confidence**: High.

#### CP-8 · Low · usability · NEW

**Where**: `src/scripts/desk/sheet-page.js:450` (button "Copy into my desk"); neighbors `:446-447, :455, :475`.

**What happens**: The button on a shared sheet says "Copy into my desk", but the sentence above says "It isn’t
in your notebook until you copy it there." and afterwards "Copied into your notebook." "My desk" is a fresh
third name for the same place (the desk is the /desk page; sheets live in the notebook). "Copy" also means
three other things nearby (CP-12).

**Fix**: "Copy into my notebook".

**Confidence**: High.

#### CP-9 · Low · a11y · NEW

**Where**: `src/scripts/desk/desk-page.js:552-553` ("Leading" badge); `src/scripts/desk/sheet-pane.js:563, 568`
(links "Print or share…" and "Present…", new-tab notice), `:683, 763, 976`; `src/scripts/desk/sheet-page.js:296, 300,
303, 307, 503`; `src/scripts/desk/sheet-lit.js:445, 472`; `src/scripts/desk/sheet-present.js:392, 395, 397, 401`.

**What happens**: Sentence-length explanations are carried only by `title`. For a button or link a browser
exposes `title` as a description, but a keyboard-only sighted reader never sees the tooltip. The worst case
is the "Leading" badge: it is a non-interactive `<span>` whose only explanation is
`lead.title = "My Notes, This verse, Greek, and Footnotes follow this pane"`, and a title on a span is not
reliably exposed to anyone. "Leading" (typographic jargon) is then a bare word. "Print or share…" and
"Present…" open a new tab, and say so only in `title` ("... (opens in a new tab)"), while the license link in
the same code does it properly with an `aria-label` (`sheet-lit.js:883`).

**Fix**: for "Leading": make the badge's text self-explaining ("Others follow this pane") or add a visually
hidden `<span class="sr-only"> (My Notes, This verse, Greek, and Footnotes follow this pane)</span>`. For the two
links, add a visually hidden " (opens in a new tab)" to the link text as the license link does. For the rest,
use `aria-describedby` to a hidden span (the print buttons in `panel.js:489-505` already do) when the sentence
carries something the label doesn’t.

**Confidence**: High on the facts; Low-impact because the desk is desktop-only.

#### CP-10 · Low · docs · NEW

**Where**: `src/scripts/desk/sheet-present.js:726` (the presenter view's key line); `:800` and `src/lib/desk-present.mjs:376`
("Screen N of M").

**What happens**: The line "Keys, in either window: → or Page Down for the next screen, ← or Page Up for the one before, R to
reveal, Shift+R to cover again, F for footnotes." leaves out keys `presentKey` (`desk-present.mjs:276-301`)
really handles: Space (next), Shift+Space (previous), Home and End (first and last screen). "Screen" also means two
things in the same view: a step of the deck ("Screen 2 of 9", "Everything on this screen is revealed") and a
monitor ("If it’s on another screen ... drag its window to the room’s screen and choose Full screen there",
`:800`), so "next screen" can be read as "move the window to the next monitor".

**Fix**: "Keys, in either window: → , Page Down, or Space for the next step; ←, Page Up, or Shift+Space for the one
before; Home and End for the first and last; R to reveal; Shift+R to cover again; F for footnotes." and `:800`
"... drag its window to the room’s display and choose Full screen there." (or call a deck step a "slide"
throughout).

**Confidence**: High.

#### CP-11 · Low · docs · NEW

**Where**: across the desk; each pair below names its locations. This is the terminology audit the brief asked for.

**What happens (same thing, different words)**:
1. **The feature has three names.** "Study Desk" (header link, `desk.astro`, `/sheets` copy, privacy's "Study Desk page"),
   "the notebook preview" (`help.astro:12, 21`, `privacy.astro:111` "The notebook preview:", `notebook.astro` off message), and
   "a preview of new study tools" (off messages on all four pages). The help page, the only help, never mentions /desk, sheets
   or the Search pane (see NB-7). Recommend: "Study Desk" for the feature everywhere; "the Notebook" only for the panel;
   "my notebook" only for what the reader has kept.
2. **Where a shared sheet goes**: "my desk" (`sheet-page.js:450`) vs "your notebook" (CP-8).
3. **Take a mark off**: Delete vs Remove (CP-7).
4. **Dictionary form** (tour, help, Greek tab) vs **Lemmas** (`greek-credits.mjs:25`, "Lemmas and parsing: MorphGNT").
   Recommend "Dictionary forms and parsing".
5. **Two names for a list of what was kept**: the My Notes tab/pane and the pane kind "What I’ve kept"
   (`desk-layout.mjs:51, 56`, the notebook page's heading). Both list records, with different scopes; a reader choosing
   "Show in this pane" meets both. (Question for the owner.)
6. **The panel**: "panel" (Notebook panel, verse-menu panel), "pane" (/desk), "window" (Greek commands window, tour offer,
   presenter window), "tray" (Display), "dock". Mostly consistent by area; the cross-over is "a tab at the window’s edge"
   (tour `desk-first-use.mjs:230`), where "tab" also means My Notes/This verse and a browser tab ("changed in another tab").

**What happens (one word, different things)**:
- **marker**: a note's icon ("Marker: Question", `note-editor.js:106`, "(the marker only)"), "marker" for a deletion
  record (`notebook-page.js:132, 137`), and the "question marker" in `sheet-pane.js:993`.
- **mark / marks**: "Hide my marks" (umbrella for notes, highlights, bookmarks), "the mark" (a bookmark's "red mark"),
  "words you marked" (`desk-change.mjs:390-402`), "Your marks on the text" (`export-import.js:44`).
  The umbrella is defined only in the tour ("clears your notes, highlights, and bookmarks"), never on the switch.
- **ribbon**: the place feature, and a note marker named "Ribbon" (`desk-notes.mjs:198`), and the bookmark glyph is
  ribbon-shaped (CP-2).
- **copy**: leader copy / participant copy (a version), "Copy for Word" and "Copy link" (clipboard), "Save a copy" /
  "Open a copy" (backup), "Copy into my desk" (CP-8). The worst string is `sheet-page.js:303`: "Copy this copy with its
  headings, italics, and notice, to paste into Word, Google Docs, or Pages" → "Copy this version with its headings,
  italics, and notice, to paste into Word, Google Docs, or Pages".
- **screen**: CP-10. **tab**: above.

**Smaller casing/voice points**: the help page writes "the notebook’s Greek tab" (`help.astro:112`) for the panel's
tab, which the owner's rule (desk rule 10, BA138) capitalizes: "the Notebook’s Greek tab". The commands "Show My Notes" /
"Show This verse" capitalize a tab name mid-sentence, as the rule intends. Headings mix "What I’ve kept" with "What’s new
for you" on one page (`notebook-page.js:104`, `whats-new.js:120`).

**Fix**: apply the recommendations above; the strings are all one-line edits. Add a short "Words used here" note to
`src/scripts/desk/CLAUDE.md` rule 10 so the next session doesn’t reinvent "desk".

**Confidence**: High.

#### CP-12 · Low · a11y · NEW

> **Status (2026-11-03, main `9cc05f24`):** Moot: #434 deleted `places.js` and `desk-places.mjs`.

**Where**: `src/scripts/desk/places.js:73` (`document.createElement("h3")`), `src/scripts/desk/notebook-page.js:159-162`.

**What happens**: On /notebook every section is an `h2` ("What I’ve kept", "What’s new for you", "Labels", "The Notebook
panel", "Save a copy", "Delete everything"), and the jump list names "Places" among them, but the Places section's heading
is an `h3` (the same `placesSection()` serves the panel's My Notes tab, where h3 is right). In the heading outline "Places"
reads as a child of "What’s new for you". (The first "Delete everything" block has no heading and the second has
`h3` "Empty the trash now": acceptable.) Help-page and pane headings do not skip levels.

**Fix**: give `placesSection({ level })` (default 3) and pass 2 from `notebook-page.js:159`, with the `desk-np__h2` class.

**Confidence**: High.

#### CP-13 · Low · usability · NEW

**Where**: `src/scripts/desk/search-pane.js:448` ("Search failed."), `labels-ui.js:104, 111, 122, 129`,
`export-import.js:158, 172, 254`, `note-editor.js:141`, `places.js:274, 301`, `ribbon-form.js:137`,
`kept-list.js:239`, `sheet-pane.js:323, 502`, `search-pane.js:673, 680`, `sheet-page.js:561`,
`desk-export.mjs:548-562`; the private-window line (`tab-mine.js:251`, `notebook-page.js:86`, `desk-panes.js:357`,
`sheet-pane.js:207`, `search-sheet.js:311`, `sheet-page.js:590`).

**What happens**: About twenty messages say what failed and stop: "Search failed.", "That couldn’t be changed.", "That file
couldn’t be read.", "The note couldn’t be saved in this browser." Where a retry exists (`Try again` buttons on the LIT pane,
Greek, glossary and What’s new) the copy is good; the ones above give nothing to do. The private-window sentence ("This browser
isn’t letting the site keep a notebook. Private windows sometimes don’t.") ends on a hint, not a step. Not one blames the reader.

**Fix** (pattern, then examples): say what is safe, then one step. `note-editor.js:141` "The note couldn’t be saved in this
browser. Your words are still here: copy them, then try again."; `export-import.js:158, 172` "That file couldn’t be read. Choose
a file saved with “Save a copy.”"; `search-pane.js:448` "The search didn’t finish. Try again in a moment."; the private-window
line "... Private windows sometimes don’t. Open the site in a regular window to keep notes."

**Confidence**: High.

#### CP-14 · Low · a11y · NEW

**Where**: `src/lib/desk-announce.mjs:186` (`highlightedMessage`), `src/scripts/desk/actions.js:314-319`,
`src/lib/desk-history.mjs:241-258` (`describeEntry`).

**What happens**: One event, four sentences. A highlight added with no bar is announced "Highlighted yellow: Romans 8:3."
(`desk-announce.mjs:186`, the colon-and-word-order reads oddly aloud). The bar for the same event, when it overlaps another color,
says "Romans 8:3 highlighted yellow." (`actions.js:316`). Undoing a removal says "Undone: highlight on Romans 8:3 removed."
and redoing an addition "Redone: highlight on Romans 8:3 added.". A bookmark is "Bookmarked Romans 8:3." and "Bookmark on
Romans 8:3 removed.". No sentence is too long, none is silent, none speaks twice (one live region, `undo-bar.js:61`).

**Fix**: `highlightedMessage` → ``${ref} highlighted ${colorWord}.`` to match `actions.js:316`.

**Confidence**: High.

#### CP-15 · Nit · docs · NEW

**Where**: `src/scripts/desk/panel.js:449`.

**What happens**: "Your browser may clear it to free up space." sits in the Settings tab under "Kept in this browser. ..."; "it" has
no clear antecedent after Phase 5 moved the lines together.

**Fix**: "Your browser may clear this notebook to free up space."

**Confidence**: High.

#### CP-16 · Nit · longevity · NEW

**Where**: `src/lib/desk-ribbon-change.mjs:25` ("six ribbons", `MAX_RIBBONS = 6` in `desk-places.mjs:33`), `desk-first-use.mjs:207`
("up to six"), `first-use.js:133` ("a week", `REMIND_AFTER_DAYS = 7`), `notebook-page.js:132, 137` ("30 days", `TRASH_DAYS = 30`),
`greek-query.mjs:149` ("Up to four words", `MAX_TERMS = 4`), `sheet-lit.js:927` ("50%").

**What happens**: Every number in copy agrees with its constant today (verified, see "What held up"). Each is typed twice, so
a change to one limit leaves the sentence stale.

**Fix**: interpolate the constant where it is cheap (`desk-ribbon-change.mjs:25` can import `MAX_RIBBONS`); add a one-line
test that greps copy for the constants for the rest.

**Confidence**: High.

#### CP-17 · Nit · docs · NEW

**Where**: `src/pages/privacy.astro:111-146`.

**What happens**: Clear and honest, and every `lit-desk-*` key the code writes is named (see below). Two blemishes: the one
~230-word sentence lists twenty keys and is hard to scan; and `(lit-desk-measure, lit-desk-width, lit-desk-float-width, how wide
you made the notebook where it lies over the text` lumps `lit-desk-measure` in, which is the *text column's* width
(`widths.js:39`, "Text N characters wide"). The paragraph's name "The notebook preview" follows the older name (CP-11).

**Fix**: a short list with one key and one purpose per line; "The Study Desk preview:".

**Confidence**: High.

#### CP-18 · Nit · docs · NEW

**Where**: `src/scripts/greek-commands.js:381` ("Click a command to add it ..."), `src/pages/notebook/help.astro:118` ("Click a
word, or move through the words with the arrow keys"); `src/scripts/desk/sheet-word.js:116` (`text.push("———")`).

**What happens**: Everything else in the desk says "select" or "choose" ("Select a verse number", "choose “Save”"); these two
say "click". The Word copy's plain-text fallback for a horizontal line is three em dashes. It is a divider, not prose; it
was added with sheet printing (1f255d78, 2026-10-20, authored under the owner's name as a squash merge, so blame cannot
separate owner from Claude). No other em dash exists in any reader-facing string, page, help or privacy text.

**Fix**: "Select a command to add it ..."; "Select a word, or move through ..."; optionally "* * *" for the divider.

**Confidence**: High.

### Improvements

- Help page: add "Making notes, highlights, and bookmarks" and "The panel" sections (NB-7), plus one on /desk, sheets and the
  Search pane, so the help matches what the header's "Study Desk" link opens.
- Commands: there is no "Open the Study Desk", "Open my sheets", or "Show Settings" command, though every other destination has one.
- "Open the Notebook" and "Open the notebook page" differ by one capital letter and one word; a screen reader says them alike.
  "Show the Notebook panel" would be clearer.
- Pick one voice rule and write it into rule 10: controls the reader operates say "my" ("Hide my marks", "Search my notebook"),
  statements the site makes say "you/your" ("Your notebook", "What’s new for you"). "What I’ve kept" is a site heading in "my".
- The "Hide my marks" box has no hint on what it hides; the tray row could carry "Notes, highlights, and bookmarks" as its description.

### Questions for the owner

1. Tab labels: "My Notes" is title case; every other label (This verse, Greek, Settings, Footnotes, Sheet, What I’ve kept) is
   sentence case. BA139 chose "My Notes" for the tab; is the exception wanted?
2. A note's icon is named "Ribbon" (`desk-notes.mjs:198`, "the apps’ words") and the place feature is "ribbon", and the bookmark
   glyph is ribbon-shaped. Rename the icon (with the apps) or keep?
3. Should /desk's "What I’ve kept" pane and "My Notes" pane be one name?
4. The notebook page says labels "are your own tags", while the topics-vs-tags rename is open. Keep "tags" in that sentence?
5. The trash: CP-3's fix is wording only. If a restore view is wanted ("kept 30 days" suggests it), that is a feature, not a copy fix.

### What held up

- **Spelling, punctuation, quotes**: of 8,563 string literals (1,755 judged reader-facing) and the four pages, help and privacy
  paragraph, no British spelling except "tick" (CP-6); no comma or period outside a closing curly quote; every list of three or
  more in reader text has its Oxford comma (regex scan, hand-read the hits); every visible apostrophe and quotation mark is curly
  (the straight ones are in `console.error` and thrown developer messages only); every ellipsis is "…" (zero "..."). BA134 to
  BA138's fixes are intact.
- **Em dashes**: none in any reader-facing string, in `desk.astro`, `notebook.astro`, `sheets.astro`, `help.astro` or the
  privacy paragraph, and none in `desk.css`/page CSS `content:` strings (CP-18 is the only triple-dash divider). Git author
  cannot tell owner from Claude here (both `liberatingscripture` and the owner's name appear on squash merges), so nothing could be
  attributed; there was nothing to attribute.
- **Counts vs constants**: four words (`MAX_TERMS`), six ribbons, 30 days, a week, 50-deep undo (`HISTORY_LIMIT`), ten seconds
  (`CLOSE_AFTER_MS`), three lines (`NOTE_LINES = 3`, `desk-notes.mjs:47`), three list levels, three-letter search minimum
  (`MIN_QUERY_LEN = 3`), 50% (matches `read.astro:264`), 300 parts (the pane's message interpolates `SHEET_LIMITS.modules`).
- **Shortcuts vs handlers**: Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y (`history.js:212-226`) agree with the tour and the tray lines; the
  "H" line agrees with `keyboard-shortcuts.js`; the presenter's R, Shift+R and F, arrows and Page keys are real (CP-10 for the
  gaps); "Save as a file" and "Open a shared file" quoted in messages match the real buttons.
- **"Hide my notes" rename**: no leftover in any script, page, or command; only history in `CLAUDE.md`.
- **Accessible names**: about 60 `aria-label`s read against their visible text (Edit/Delete/Unpin/Labels…, the pane kind
  button, the "Wording changed" flag, the license link, ↑ ↓ × + buttons); no Label in Name failure. All 11 placeholders have a real
  or sr-only label. The undo bar has one live region, so nothing is spoken twice. No "click here"/"here" link text. The help page
  has h1 then h2, no skipped level.
- **Tone**: no message blames the reader; the change notice ("We couldn’t find the words you marked, so your note is on the whole
  verse for now") is the model for the rest.
- **Privacy paragraph vs storage**: comparing every `lit-*` string literal in the desk against `privacy.astro`, each storage key is
  named. The ones not named are site-wide font/theme keys covered elsewhere, `lit-notebook` (a file-format tag), and
  `lit-desk-ribbon-tab` (a BroadcastChannel, not storage).

### Not reached

- I rendered nothing (no browser, per the brief), so tour-card wording was checked in source, not in place.
- Printed output text (`print-notes.js`, sheet print copies) was read as strings only.
- `public/greek/` data text, the apps' copy, `desk.css` pseudo-element text beyond `content:` strings (only "Page break" exists).
- I did not re-verify NB-6's claim that `tour.js` now opens Settings; I checked only the card text.

## Appendix I: The brief every auditor was given

You are one auditor in a multi-agent audit of the **Study Desk** of the LIT Bible
website. Repo: `C:\Users\bcjoh\GitHub\litbible`, branch `claude/phase5-work-sessions`,
Windows (PowerShell and Git Bash both exist; run Python as `python`, never `python3`).

The Study Desk is a pre-release, desktop-only, off-by-default feature (`?desk=on`):
a notebook panel (notes, bookmarks, highlights, pinned footnotes, ribbons), a Greek
tab with Greek search, the `/desk` multi-pane workspace, and sheets (study handouts)
with print, present and share. Vanilla JS in `src/scripts/desk/`, pure logic in
`src/lib/desk-*.mjs`, CSS in `src/styles/desk.css`, pages `src/pages/{desk,notebook,sheets}.astro`.
About 45,000 lines. The owner wants a thorough audit covering: usability, UI issues and
improvements, accessibility, security, bugs and functionality, longevity and
sustainability, and anything else worth knowing. You own ONE slice (given in your
prompt). Other auditors own the rest, so stay in your slice except for brief
cross-slice notes.

### Ground rules

**READ-ONLY.** Do not edit, create, delete or commit any file in the repo. No git
commands that change state (no stash, checkout, reset, add, commit, merge). The only
file you write is your report, in the scratchpad directory, at the path your prompt
gives. You may run read-only commands, the repo's unit tests
(`node --test test/<file>`), and throwaway node scripts that you put in the
scratchpad directory (never in the repo). The `*.mjs` modules import cleanly in node,
so exercise the pure logic directly rather than only reading it.

**Do not start a dev server or open a browser** unless your prompt says you are the
live-browser auditor. Only one agent may drive the browser pane.

### Orientation: read before judging

1. `src/scripts/desk/CLAUDE.md` is the design record (about 1,060 lines). Do not read
   it whole. Grep it for the rule numbers your prompt lists and read those rules in
   full. Anything marked "(BVJ, <date>)" or described as an owner decision is
   **deliberate, not a defect**. If you think a deliberate decision is wrong, put it
   under "Questions for the owner", not in Findings.
2. Root `CLAUDE.md`, "Rules that apply everywhere": dark-mode styles need both
   selectors; size text columns with `--ch`, never the `ch` unit; focus rings use
   `--focus-ring`; links that leave the site open in a new tab with
   `rel="noopener noreferrer"`; the desk is downloaded only with `data-desk="on"` and
   shared code never statically imports it; reader-facing copy follows American
   spelling, the Oxford comma, and no em dashes in prose Claude writes (the owner's
   own text is exempt). For CSS findings also see `src/styles/CLAUDE.md`.
3. **A prior audit exists:** `STUDY-DESK-AUDIT-1.md` (188 KB, findings BA1 to BA153,
   ending 2026-10-28; too large to read whole). Read its "What held up" (about line
   2653) and "Not covered" (about line 2750) sections. **Grep it for the function,
   file or feature before you report anything.** Mark a finding `NEW` only if it is not
   there. A known BA item that is still unfixed, or has come back, is reported as
   `KNOWN-OPEN BAxx` or `REGRESSION BAxx`, with evidence.
4. **19 commits touched the desk after that audit** (since 2026-10-28: the Search pane
   3m, the Settings tab, the header's "Study Desk" link, "Hide my marks", print
   changes, and more). Run `git log --since=2026-10-28 --oneline -- <your paths>` and
   `git show` the relevant ones. New code is the least-audited; scrutinize it first.

### Standards of evidence

Every finding must be verified by reading the code at the cited file and line, and by
running it where practical. No speculation presented as fact. Mark anything you could
not confirm `Confidence: Low` and say what would confirm it. Prefer fewer, real,
well-evidenced findings over padding. Do not report style nits unless they affect
users or maintainability. Things that are good go in "What held up", not in Findings.
Quote line numbers as you saw them, from the current checkout.

### Report format

Write Markdown to the report path:

- `## Summary`: 5 to 8 lines on the health of your slice, with counts by severity.
- `## Findings`, ordered by severity. One block each:
  `### <PREFIX>-<n> · <Critical|High|Medium|Low|Nit> · <a11y|usability|ui|security|bug|data-integrity|performance|longevity|docs|compat> · <NEW|KNOWN-OPEN BAxx|REGRESSION BAxx>`
  then **Where** (`src/...:123`), **What happens** (a concrete scenario a user or
  maintainer would hit), **Evidence** (what you read or ran), **Fix** (concise and
  specific), **Confidence** (High, Medium or Low).
- `## Improvements`: worthwhile non-defects (usability and UI ideas), one line of
  rationale each.
- `## Questions for the owner`
- `## What held up`: what you checked and found sound, so nobody re-checks it.
- `## Not reached`: what you did not get to.

Cap at about 35 findings. Severity guide: **Critical** = data loss or corruption,
script injection, or a feature unusable for a class of users. **High** = likely
user-visible failure, or a WCAG A/AA blocker. **Medium** = real friction, or a bug in
a plausible scenario. **Low** = edge case or polish. **Nit** = trivial.

### Your final message to the orchestrator

Keep it SHORT (250 words at most): counts by severity, your top six findings in one
line each, and the report path. Everything else lives in the file.
