# Study Desk Audit 6

Audited 2026-11-08 at commit `5c9a31a6` (`main`, branch `claude/desk-audit-6`), after Audit 5's
fixes and BVJ's decisions on it (#502, #504, #505) and the 53 commits since the last full code
audit (Audit 3, `60af379e`).

BVJ's brief had two parts:

1. **Part 1** repeats Audit 5's task with a Fable agent: an exhaustive audit of the Sheets as a
   new user, a ministry leader preparing to work with people. Every template, command, and part,
   combinations of parts within each template, how intuitive it is and how it could improve, and
   the rule that templates carry ghost prompts and no actual text in any field.
2. **Part 2** repeats the basis of Audits 1 to 3: the code from as many angles as could be
   thought of, by up to one Fable, two Opus, and four Sonnet agents, assigned by fit rather than
   to fill every slot.

Nothing in the repo was changed while auditing; every finding is a recommendation. IDs carry a 6
(`SH6`, `SEC6`, `DI6`, `NB6`, `DK6`, `GK6`, `LG6`, `VER6`) so they never collide with earlier
audits'. The full reports are the appendices.

**Status (2026-11-08, same day):** on BVJ's instruction to fix everything that needs no decision of theirs, every such finding was fixed on `claude/desk-audit-6-fixes` and is marked on its entry. BVJ's calls followed the same day (`claude/desk-audit-6-decisions`): SH6-3 (a) to (c) fixed and (d) declined, SH6-7 and DK6-1 fixed, NB6-8 no change, GK6-2 fixed (the root `LICENSE` has a third class, OTHER MATERIAL). Left open: DI6-5, put to BDR in STUDY-DESK.md on 2026-11-08 with S12's question on merging a sheet part by part. LG6-2 (in five extractions) and LG6-3 were finished the same day. SEC6-3's fix drops prompts from participant shares only; a leader share keeps them, and it is a one-line revert if BVJ wants prompts to travel. SH6-4's sentences name the book as the site writes it ("Psalms").

## Bottom line

**No Critical or High finding, after verification, in either part.** All 3,297 tests pass, all
260 chapters validate, `astro check` is clean, the build succeeds, and the link check finds no
broken target across 355 pages. The sanitizer held through 90 hostile cases and 60,000 random
runs again; the bookmark merge converged over 9,000 three-replica histories; anchor spec 4 over
all 173 chapter revisions in git history moved no mark silently; every record kind, including
#505's templates, minutes, and prompts, round-trips byte for byte on today's reader and on the one
before #505; the Greek indexes rebuilt from the raw text match what ships, and a brute-force
matcher agreed with Greek search on 2,000 random queries; the file writers produced well-formed
files on every hostile and awkward sheet tried. Nearly every fix from Audits 3, 4, and 5 holds.

**BVJ's rule for the templates holds everywhere.** Every part of all seven built-in templates, and
of a template of the reader's own, is a lone heading or empty, with its guidance in the `prompt`
field. No prompt reached paper, Present, the share link, the import, or (by code) a saved file
(Appendix A, section B).

What is left:

1. **What a participant receives from a template left mostly alone** (SH6-3). The editor shows
   ghost prompts under every heading, so the sheet looks full; the paper prints bare headings,
   three ruled lines under each empty question with no question above them, an empty key terms
   box's "None…" sentence, and a "LEADER ONLY" tag with nothing after it. Present already skips
   empty parts, and the help says a part left alone "stays blank." What should print is BVJ's
   call (below).
2. **Two bugs in the newest Sheets code.** Every "+ Your text", "+ Question", and "+ Key terms
   box" puts the cursor in the new card's minutes box instead of its text (SH6-1: `focus()`
   returns nothing, so the `??` fallback always runs; #505's minutes box is now the first input).
   A participant who opens a shared link is shown the leader's "what prints" notice, which names
   the blanked word (SH6-2: the check runs before `if (shared) return`). Both confirmed in the
   code by the orchestrator.
3. **A fix that reached one path and not its sibling, again.** Lazy loading (#491) moved the
   first-stage "Skip to the Notebook" link out of `panel.js` without its `data-desk-skip`, and its
   hiding rule sits in `desk.css`, which the first stage doesn't load (NB6-1, a regression of
   NB3-10); the Display tray's hint and "Reset widths" render unstyled for the same reason (NB6-4).
   GK3-9's "couldn't load, Try again" reached the commands window and the Greek tab but not the
   single-word search in the tray and on /search (GK6-1). DI3-6's sanitize-before-validate reached
   editing but not import (DI6-1, latent until the sheet format's first canonical-form change).
   The Markdown share file writes a reader's `<` raw, BA41's sibling that DK3-12 missed (SEC6-1).
4. **Two docs about to bite.** The desk's `CLAUDE.md` is 153,369 bytes against its 153,600 cap,
   so the next rule added fails the docs test (LG6-1). The root `LICENSE` says everything not
   listed is MIT, which sweeps in `public/greek/` (CC BY and CC BY-SA) and the OFL fonts (GK6-2,
   BVJ's call).
5. **The next two years.** `createSheetPane` is 1,652 lines, up about 570 since Audit 3, now the
   desk's largest function; `start()` fell from 1,706 to 1,115 (LG6-2).

### Counts

After verification (Appendix H). Part 2's six slices reported 50 findings; the verifier
confirmed the 19 highest, lowered six by one step, could not reproduce one by its stated path
(SEC6-2, now a Nit), folded three duplicates, and promoted one of DI6's questions to a finding
(DI6-5). Two auditors' own Summary lines miscount: DK6's says 5 Low (it has 6), GK6's says 10
findings (it has 12).

| | Critical | High | Medium | Low | Nit | Observation |
|---|---|---|---|---|---|---|
| Part 1 (`SH6`) | 0 | 0 | 4 | 4 | 1 | 2 |
| Part 2 (all slices) | 0 | 0 | 4 | 31 | 14 | 0 |
| **Total** | **0** | **0** | **8** | **35** | **15** | **2** |

Part 1's four Medium findings were seen live; SH6-1 and SH6-2 were also confirmed in the code by
the orchestrator, and SH6-3 and SH6-4 are a design and a usability call rather than a fault to
reproduce. The Part 2 findings below Medium that the verifier didn't reach stand at their
auditor's rating.

## Priority list

### Tier 1: fix next (small; a reader meets each one, or it blocks the next change)

| ID | What | Size |
|---|---|---|
| SH6-1 | New text, question, and key terms parts focus the minutes box (`sheet-pane.js` `addPart`, the `?.() ??` chain) | one line |
| SH6-2 | A shared participant link shows the leader's leak notice naming the answer (`sheet-page.js` `draw`) | move one guard |
| LG6-1 | The desk's `CLAUDE.md` is 231 bytes under its cap; trim before the next rule | a docs pass |
| NB6-1 | The first-stage skip link lacks `data-desk-skip`; its hiding rule isn't loaded (NB3-10) | small |
| NB6-4 | The tray's desk hint and "Reset widths" are unstyled in the first stage | small |
| GK6-1 | A failed Greek load reads "No Greek words match" in the tray and /search, with no Try again | one line |
| SH6-6 | The custom-hint row's × wraps onto its own line again (SH5-12, in part) | CSS |
| SH6-5, DK6-11 | The gap pill's announcement ("Your text added after Your text") and its menu's arrows and End landing on the disabled Key terms line | small |
| NB6-3 | Margin marks and My Notes still say "the wording changed" for a moved note | copy |
| SEC6-1 | The Markdown share file writes a reader's `<` raw | small |

### Tier 2: after a decision, or before the desk is public

| ID | What |
|---|---|
| SH6-3 | What an untouched template part prints (decisions 1 and 2 below) |
| SH6-4 | An Old Testament book or a range across chapters is refused with the generic "isn't a reference" message; three messages instead of one |
| SH6-7 | Every template click saves an "Untitled sheet," and the list never names the template (decision 3) |
| GK6-2 | The root `LICENSE` and the Greek data and fonts (decision 4) |
| DK6-2 | The gap menu's lifecycle: it outlives scroll, resize, `draw()`, and the pane's `destroy()`, and a pick after its card is removed lands at the end or silently does nothing |
| NB6-2 | After a failed shell load, the tray keeps the desk's rows and focus drops to the body (standing down itself is BA29's design) |
| DK6-8, DI6-3 | "Save as template" on a passages-only sheet makes an empty template, and a sheet from it has no parts |
| SEC6-3 (= DK6-6) | `prompt` and `answerPrompt` travel in participant shares, against `promptOk`'s comment; the format's share table doesn't say `minutes` is dropped |
| DI6-1 | Import validates a sheet before sanitizing it; fix before any `SHEET_FORMAT` bump |
| DI6-5 | A followed bookmark's move undoes its deletion on another device (for BDR; asked in STUDY-DESK.md, 2026-11-08) |
| LG6-2 | Split `createSheetPane`, one extraction per sitting as LG3-3 did for `start()` (fixed 2026-11-08: the editor's closure 1,738 → 1,111 lines) |

### Tier 3: polish and nits

Everything else in the appendices: Greek search's edges (GK6-3 to GK6-12: all-caps iota
adscript, characters dropped without notice, five long bridge renderings unreachable, IME Escape,
cache ties), the remaining DK6, NB6, and LG6 Lows and Nits (Hebrew points in the leak check, the
telltale in questions and titles, the leak check's cost on very large sheets, untested modules,
dead exports, the shell's measured size against the doc), and SH6-8 to SH6-11.

## Themes

1. **The sibling path, for the third audit running.** Five findings (NB6-1, NB6-4, GK6-1,
   DI6-1, SEC6-1) are a fix or a move that reached one path and missed its twin; lazy loading
   alone produced two. A first-stage file that creates an element `panel.js` also creates should be
   checked against it attribute by attribute, and any rule a first-stage element needs belongs
   in a stylesheet the first stage loads.
2. **What the editor shows versus what the participant holds.** Ghost prompts make an unfinished
   sheet look finished. SH6-3, SH6-2, and Part 1's first idea (a participant preview in the
   editor) are one concern: the leader can't see the participant's copy where they work.
3. **Newest code, least tested.** #504 and #505 carry most of this audit's Sheets findings
   (SH6-1, SH6-5, DK6-1, DK6-2, DK6-11, SEC6-3, DK6-8); `sheet-present.js`, `kind-menu.js`,
   `title-menu.js`, `notebook-tab.js`, and `page-kind.js` have no test that names them (LG6-3).

## Decisions needed from the owner

1. **SH6-3 (d): should a template heading left untouched print?** Proposed: a text part that is
   still exactly its template heading (a lone heading with a `prompt`) prints nothing, while a
   heading the leader typed prints. The alternative keeps headings as cues and says so in the
   help.
2. **SH6-3 (a) to (c): should an empty question still give the participant its lines?** Proposed:
   no (Space is the part for lines), an empty key terms box prints nothing on paper, and a Leader
   only tag never prints alone. This also matches Present, which already skips empty parts.
3. **SH6-7: should "New sheet" write a record before the first change?** Seven abandoned
   "Untitled sheet" records in the audited origin suggest a leader compares templates by opening
   them.
4. **GK6-2: the root `LICENSE`.** Name `public/greek/` (CC BY 4.0 and CC BY-SA 4.0, by source)
   and the OFL fonts as outside the MIT grant, with pointers to their notices. A licensing call,
   so BVJ's.
5. **DK6-1: the gap pill's tab stops.** BVJ chose a pill reachable by Tab; on a 300-part sheet
   that is 300 extra stops. A roving pattern (one stop, arrows between gaps) would keep keyboard
   reach. Keep, or change?
6. **DI6-5, for BDR:** should a bookmark's move by a following device count as an edit that
   resurrects it after a delete elsewhere (rule b today), or should a delete win over a move?
   Asked in STUDY-DESK.md ("2026-11-08: two questions for BDR"), with the website's
   recommendation that a delete win over a move.
7. Part 1's smaller questions (Appendix A, section F): whether a template of the reader's own
   carries the `commercial` flag, and whether Lectio divina's "Read" prompt should mention the
   passage form. **Both answered (BVJ, 2026-11-08).** The `commercial` flag stays with the
   template, and the help page now says so: only a reader who ticked it carries it, and that reader
   is the one likeliest to make commercial material again. Lectio's four
   prompts now suggest what the leader might write
   ("Your words on how to read, such as “…”") instead of reading as the instructions themselves;
   the "Read" prompt doesn't name the form, which opens right under it.

## What the orchestrator checked personally

SH6-1 and SH6-2 in the code (`sheet-pane.js` `addPart`, `sheet-page.js` `draw`); NB6-1
(`first-stage.js` creates the link without the attribute `panel.js` sets, and the hiding rule is
`desk.css:755`); LG6-1's byte count. Part 1 found port 4321 already held by an `astro dev`; the
orchestrator confirmed it was serving the main checkout, clean at `5c9a31a6`, the audited commit.
The build's one-line rewrite of `src/data/podcast-feed.xml` in the audit worktree was reverted.

## Method

Seven auditors and one verifier, read-only in the repo, on the worktree pinned to `5c9a31a6`.
Models by fit:

- **Fable** for Part 1 (BVJ named it), the live walkthrough, where judgment about what a leader
  expects matters most; and for data integrity and sync-readiness (`DI6`), the format shared with
  both apps, where a wrong call is hardest to see in review. DI6 was cut off once by an API
  overload and re-ran from scratch.
- **Opus** for security (`SEC6`, reasoning from attacker input to a sink) and for the adversarial
  verification of the highest findings (`VER6`), which ran after the six code slices.
- **Sonnet** for the four broad reading slices: the Notebook panel, shared reader panels, and
  accessibility (`NB6`); /desk, the Sheets code, and saved files (`DK6`); Greek (`GK6`); and
  longevity, mechanical health, and the copy and CSS rules (`LG6`, which also took the
  mechanical work Haiku did in Audit 3, since this audit used no Haiku).

Only Part 1 drove the browser pane. Throwaway scripts (sanitizer and import fuzzing, the merge
and anchor runs, Greek brute-force matching, the writer probes, the verifier's reproductions) are
in the session scratchpad. The appendices are the reports in full, with heading levels shifted
down one; the briefs are Appendices I and J.

## Not covered

Printing and the file saves by hand (their inputs and the writers were read and run in node
instead); the Add pill's hover look and the tour's Sheets steps (the hidden pane runs no frames
and matches no hover); a real screen reader and a Windows contrast theme (NB6-5 and NB6-6 need
them); Firefox and Safari; phones and tablets (the desk doesn't run there); the apps' side of the
format; `desk-page.js` and the pane menu in DK6's slice; two tabs on one sheet.

## Appendix A: The Sheets as a new user (`SH6`, Fable)

Audited 2026-11-08 at commit `5c9a31a6` (`main`, read from the `claude/desk-audit-6` worktree), as a
first-time ministry leader preparing a Bible study, a sermon, a class, and a lectio divina session, on
BVJ's brief repeated from Audit 5 and with the newest code (#502, #504, #505) given the most weight.
Nothing in the repo was changed.

Method: the Sheets code was read first (`desk-sheets.mjs`, `desk-sheet-templates.mjs`, `desk-sheet-format.mjs`,
`desk-sheet-copy.mjs`, `desk-sheet-leaks.mjs`, `desk-sheet-share.mjs`, `desk-present.mjs`, `sheet-pane.js`,
`sheet-copy.js`, `sheet-page.js`, `sheet-present.js`, the help page's Sheets section, `STUDY-DESK-AUDIT-5.md`
whole, E56 to E62 in `STUDY-DESK-FIXES.md`, and the Sheets paragraphs of `src/scripts/desk/CLAUDE.md`). Then
the browser pane. `preview_start` for `dev` failed because an `astro dev` for the main checkout (same commit,
clean tree) was already on port 4321; that server was used and left running, since this session did not
start it. Pages were driven at 1000×700 (the pane's screenshots crop anything wider than about 800px, so
1500×950 was tried and dropped) and read through JavaScript and the accessibility tree, with screenshots
where the look mattered. The known traps held: the pane never fires `requestAnimationFrame` while hidden, so
the pane's own `say()` announcements (which wait a frame) read empty in many checks and were read from the
saved record instead; synthetic keyboard events do not reach Present's key handler, so B, the arrows, Space
and Ctrl+B/I were pressed with real keys on the fronted tab; the pane's clipboard is read-protected, so the
share link was built from the dumped record with the repo's own `shareLink()` in Node
(`...\scratchpad\audit6\sh6\make-link.mjs`) and opened in the pane. Print, "Save as PDF" and the five file
writers were not run (a dialog or a save needs a hand); their inputs were read instead (below).

The origin held, at the start: 15 sheets from the earlier audits (seven of them "Untitled sheet" with 0
passages), one template of the reader's own ("Untitled sheet", 8 parts), one trash record, no notes,
highlights or bookmarks, and the tours deferred. Eleven sheets and one template were made in this audit (all
titled "SH6 …" or made from them: the search sheet "Search: ‘peace’", an imported copy, a duplicate) and
every one was deleted at the end through the pane's own Delete, which moves them to the trash; the trash now
holds twelve more records (not emptied, since "Empty the trash now" would also take the owner's). Nothing
else in the notebook was touched; "+ From my notes…" was therefore tried only in its empty states.

IDs carry a 6 (`SH6-`). Severity: High, Medium, Low, Nit, Observation.

### Bottom line

**BVJ's rule holds: no template field starts with text, and no prompt reaches paper, the clipboard, a share,
a file, or the room's screen.** Every part of all seven templates (and every part of a template of the
reader's own) is a heading alone or empty, with its guidance in the `prompt` field; the leader and
participant copies, the eight Present screens, the shared participant link and the imported copy of it were
searched for every prompt sentence and none appeared, and the writers can't leak one because they read the
rendered copy, not the record (section B).

**What a participant receives from a template left mostly alone is the main thing to fix now.** A Class
session with no words typed prints, on the participant's version: "Goals for this session" with nothing
under it, a Key terms box saying "None of the sheet's passages uses a key term.", "Reading", nine ruled
lines with no question above them, and "Next time"; the leader's adds "LEADER ONLY Before you lead" and
"LEADER ONLY Background" as bare headings. The editor hides the emptiness with ghost prompts; the paper
doesn't, and Present already skips empty parts (SH6-3). Two smaller bugs in the newest code sit beside it:
every "+ Your text" and "+ Question" now puts the cursor in the new card's minutes box instead of its text
(SH6-1), and a participant who opens a shared link is shown the leader's "what prints" notice, which names
the blanked word (SH6-2).

**Everything Audit 5 fixed still holds** except two edges: the custom-hint row wraps its × onto a line of
its own again (SH5-12, now SH6-6), and the focus that SH5-10 settled for spaces and page breaks is lost for
text and questions by the minutes field (SH6-1). The gap's "Add" pill, the reading part's open passage form,
minutes and the planned total, the presenter view's countdown, the answer key, the B key, Save as template
and a sheet from it, the Swedish and Contextual templates, the key terms box's placement buttons, the
grouped blank rows, the telltale flag, Duplicate, Delete with undo, the search sheet, the share link and its
import all worked as described in the record.

### A. Findings (SH6)

##### SH6-1 · Medium · bug · a new text part, question, or key terms box puts the cursor in its minutes box · NEW · FIXED (2026-11-08)

**What happens:** press "+ Your text" (or "+ Question", "+ Key terms box", the gap pill's "Your text" or
"Question" by mouse or keyboard, or "Add N parts" in From my notes). The card appears and focus lands on
the small "– min" number field in its header, not in the text. A leader who starts typing types into the
minutes box; letters do nothing there and a number becomes planned minutes. Reproduced seven times:
`document.activeElement` was `input[type=number][aria-label="Minutes planned for Your text"]` after the bar's
"+ Your text", "Minutes planned for Question" after "+ Question", "Minutes planned for Key terms box" after
"+ Key terms box" (Lectio divina), and the same after the gap pill's keyboard pick. A space still focuses its
lines field and a page break its Move up button (SH5-10 holds for those).

**Where:** `src/scripts/desk/sheet-pane.js:1370`, `addPart`'s `after`:
`c?.inst?.focus?.() ?? c?.el.querySelector("[contenteditable], input, button")?.focus()`. `inst.focus()`
returns `undefined`, so the `??` fallback always runs too, and the first `input` in a card is now the minutes
field that #505 added to every header (before #505 it was the Leader only box, which SH5-10 reported for
spaces and page breaks; text and questions were saved by `inst.focus()` running first and nothing taking
focus back). The same line is at `sheet-pane.js:1691` (From my notes).

**Fix:** `if (c?.inst?.focus) c.inst.focus(); else c?.el.querySelector("[contenteditable], input, button")?.focus();`
in both places, and a card-level test that the new part's editable has focus. The key terms box has no
editable, so give it a sensible target too (its first "Move … the reading" button, else the Move up button).

**Confidence:** high.

##### SH6-2 · Medium · bug · a shared participant link shows the leader's "what prints" notice, naming the answer · NEW · FIXED (2026-11-08)

**What happens:** share "The participant's version", open the link (as a participant would). Above the
paper: "A blank's words also print elsewhere. “deviation,” blanked in Romans 8:1–4, also prints in text part
3." The notice exists so the leader can fix a leak before printing; shown to the participant it is itself the
leak, since it names the blanked word beside the line they are meant to fill in. Seen on the shared page
and again on the same page after "Import into my notebook".

**Where:** `src/scripts/desk/sheet-page.js:437-442`, `draw()`: `copyLeaks` runs whenever `copy === "participant"`,
and `if (shared) return` comes after it, so it skips only the wording check (`copyChecks`).

**Fix:** run the leak check only for the reader's own sheet: `if (copy === "participant" && !shared)`, or move the
`if (shared) return` above it. A unit test on `drawSheet` isn't available (DOM), so a note in the function's
comment that a shared page shows no leader-facing notices.

**Confidence:** high.

##### SH6-3 · Medium · design · a template's untouched parts print as bare headings, stray lines, and an empty box · NEW · FIXED (a) to (c); (d) DECLINED (BVJ, 2026-11-08)

**What happens:** make a Class session, add nothing, open Print or share. Participant version, top to bottom:
"Goals for this session" (heading, nothing under it), "Key terms" with "None of the sheet's passages uses a key
term.", "Reading" (heading alone), three blocks of three ruled lines with no question above them (96px each),
"Next time" (heading alone). Leader version adds "LEADER ONLY Before you lead" and "LEADER ONLY Background",
each a bare heading. The same for every template: on my Bible study sheet an empty Leader only question
printed a "LEADER ONLY" tag with nothing after it, two untouched template questions printed six unexplained
lines on the participant's handout, and "Closing" printed as a heading alone until I typed under it. Present
disagrees with paper (`presentScreens` skips an empty text or question part, SH5-8) and the help page says a
part left alone "stays blank", which a reader will take to mean nothing prints. The editor hides all of this:
with ghost prompts under every heading the sheet looks full.

**Where:** `src/scripts/desk/sheet-copy.js:388-399` (`renderCopy` prints every text, question and space
module whatever it holds), `:297-308` (`questionSection`: tag, empty rich, then `ruled(m.lines)` when
`lines` is set, which a template question always is), `:321-324` (`keyTermsSection` prints the "None…"
sentence on paper), and `desk-sheet-copy.mjs:41` (`modulesForCopy` filters by type and Leader only alone).
Present's rule is `presentScreens` in `desk-present.mjs`.

**Fix (proposed, BVJ's call on the heading part):** (a) a question with no words prints nothing, as it
presents nothing (a leader who wants lines has Space); (b) an empty key terms box prints nothing on paper
(its "None…" sentence belongs to the editor); (c) a Leader only tag never prints alone; (d) a text part that
is still exactly its template heading (a lone heading with a `prompt`, which a heading the leader typed
never has) prints nothing, so an untouched "Closing" or "Background" vanishes while a typed one stays. The
same rule gives Present its "Reading"-only screen back (SH6-10). If BVJ prefers headings to print as cues,
then at least (a) to (c), and a sentence in the help page saying that a template heading prints even when
nothing is typed under it.

**Confidence:** high on what prints; the fix is a design choice.

**Decision and fix (BVJ, 2026-11-08):** yes to (a) to (c), no to (d): a template's headings print as cues.
`printsOnPaper` (`desk-sheet-copy.mjs`) drops an empty text or question part from paper (a question with
no words keeps its place only on the leader's version when it has an answer), and `keyTermsSection`
returns nothing on paper for an empty box. The help page says a template's headings print as cues and an
empty question, key terms box or Leader only part prints nothing. SH6-10 stays as SH5-8 left it.

##### SH6-4 · Medium · usability · an Old Testament or multi-chapter reference is refused without saying why · NEW · FIXED (2026-11-08)

**What happens:** on the Sermon preparation sheet for Luke 4:16–21, type "Isaiah 61:1-2" into the passage
form (the text Jesus reads). The answer: "That isn't a reference the LIT can read. Try a book, a chapter, and
verses, such as Romans 5:6–10." The same for "Psalm 23" and for "Matthew 5-7". A leader who doesn't yet know
the LIT is a New Testament translation reads it as a typo and tries again; one who wants a three-chapter
reading gets no hint that one chapter at a time works ("Romans 8" alone does). The reference parser already
knows the Hebrew Bible and the apocrypha by name for the footnote linker (`sefaria-refs.mjs`, `ebible-refs.mjs`).

**Where:** `src/scripts/desk/sheet-pane.js:1725-1728`, the passage form's submit; `parseReference` in
`search-core.js`.

**Fix:** three messages instead of one: a Hebrew Bible or apocryphal book → "The LIT is a translation of the New
Testament, so Isaiah isn't in it. Type the verses into a Your text part, or link them from Sefaria."; a range
across chapters → "Add one chapter at a time: Matthew 5, then 6, then 7."; everything else the present
sentence. The first also fits the gap pill's form and the Search pane.

**Confidence:** high.

##### SH6-5 · Low · a11y · the gap pill's addition is announced as "Your text added after Your text." · NEW · FIXED (2026-11-08)

**What happens:** on the Bible study sheet, open the "Add" pill under Opening and choose Your text (keyboard
or mouse). The live region says "Your text added after Your text." The pill, its menu and the passage form
all call the part "Opening" ("Add a part after Opening", "Add a passage after Opening"); the announcement
alone falls back to the part's kind.

**Where:** `sheet-pane.js:1361`, `addPart`: `afterName = cards.get(after)?.name` (the kind) where the menu
passed `called` (the heading) at `:1424` and `:1421`.

**Fix:** pass `called` into `addPart(type, m.id, called)` and announce "Your text added after Opening."

**Confidence:** high.

##### SH6-6 · Low · ui · with "My own hint…" the blank row puts the × on a line of its own · REGRESSION SH5-12 (in part) · FIXED (2026-11-08)

**What happens:** blank "deviation" and choose My own hint…. In a 379px-wide pane the row becomes three
lines: words, "3 times, vv. 2, 3" and the select; then the × alone; then the hint field full width (measured
tops 255 / 283 / 313; screenshot taken). SH5-12 asked for the field to take the row's remaining width or sit
on a second line by design; the field is on its own line now, but the × wraps between them.

**Where:** `.desk-sheet__blank` / `.desk-sheet__hint-text` in `src/styles/desk.css` (the row is a wrapping
flex `li`, `sheet-lit.js` builds it with the field before the ×).

**Fix:** put the × before the hint field in the DOM (words, verse, select, ×, then the field with
`flex-basis: 100%`), or `order` the × ahead of the field in CSS.

**Confidence:** high.

##### SH6-7 · Low · usability · every click on a template saves an "Untitled sheet", and the list never says which template · NEW · FIXED (BVJ's decision, 2026-11-08)

**What happens:** "New sheet" then any template writes a sheet at once, so a leader who looks at two templates
to compare them has two "Untitled sheet · 0 passages" rows; the origin began with seven of them. The row
shows the subtitle, passage count and date, never the template, so none can be told apart without opening
it. A template of the reader's own saved from an untitled sheet is listed as "Untitled sheet" too, and a sheet
started from an own template takes the template's title, so "SH6 Bible study test" appeared twice in My sheets
and twice in the /search gather panel (told apart there only by part count).

**Decision and fix (BVJ, 2026-11-08):** don't save until the first edit, then autosave as before. New
sheet (and a template of the reader's own) shows the sheet as a `draft` the pane holds; its first change
writes it (`persistDraft`, its own undo step, then the change), as do Print, Present, and an add from the
LIT pane or the Search pane (`addTarget().ready`). Leaving it untouched leaves nothing. An untitled
sheet's row names its template ("Bible study · 0 passages").

**Where:** `sheet-pane.js:639-656` (`newSheet` saves before any change), `:519-526` (the row's meta),
`desk-sheets.mjs:167-175` (`sheetFromTemplate` keeps the title).

**Fix:** name the template in the row's meta when the sheet is untitled ("Bible study · 0 passages"), and
start a sheet from an own template with its title focused and selected (it already focuses it), or with "
(from template)" dropped on first save. Not persisting until a first change would be cleaner but changes the
autosave story; BVJ's call.

**Confidence:** high on the behavior.

##### SH6-8 · Low · copy · the leak notice points at "text part 3" · NEW · FIXED (2026-11-08)

**What happens:** "“deviation,” blanked in Romans 8:1–4, also prints in text part 3." The leader's parts have
headings ("Opening") or first words, and the editor never numbers them, so "text part 3" sends them counting
cards, Leader only ones included or not (they aren't on the participant copy, so the count differs from the
editor's).

**Where:** `sheet-copy.js:503-504` (`where: \`text part ${++texts}\``, `question ${++questions}`),
`desk-sheet-leaks.mjs:80` (`leakSentence`).

**Fix:** name the part by its heading or first words: "also prints in “Note the word deviation…”"; keep the
number only when the part has no words to quote.

**Confidence:** high.

##### SH6-9 · Nit · copy · the give-away flag's comma sits outside the quote · NEW · FIXED (2026-11-08)

"Gives away a blank (“self-preservation”, traditionally “flesh”), so it's left out until you decide." The
owner's rule puts the comma inside: (“self-preservation,” traditionally “flesh”). `sheet-lit.js:814`.

##### SH6-10 · Observation · a lone heading becomes a Present screen of its own · KNOWN-OPEN (SH5-8's rule)

Screen 4 of 8 on the Bible study sheet was the word "Reading" alone, before the passage; a Class session gives
"Goals for this session", "Reading" and "Next time" each a screen. `presentScreens` keeps a part with only a
heading by design (SH5-8); with SH6-3's rule (d) these would go.

##### SH6-11 · Observation · small things seen along the way · PARTLY (2026-11-08) (the orphaned sr-only descriptions are gone; the rest are observations)

- The Blank canvas's one text part shows the generic placeholder; every other template part has a prompt.
  Fine, but the Blank canvas is the one template where "A heading, instructions, a prayer, or anything else to
  print." is all a new leader gets.
- Typed quotes stay straight ('verdict') in a sheet that prints curly ones everywhere else; smart quotes on
  typing would match the translation's convention (idea, not a defect).
- Present's "Reveal" stays enabled after the last blank; pressing it says "Everything on this screen is
  revealed." Acceptable.
- Dragging a card announces nothing (Move up and down say "Moved to 5 of 14."). Drag is mouse-only, so a nit.
- On a shared sheet's page the hidden Present and Share buttons' `sr-only` descriptions stay in the DOM,
  orphaned ("Shows this sheet to a room…", "Sends this sheet to someone…"), so a screen reader reading the
  page in order meets two sentences about controls that aren't there (`sheet-page.js:398-411`).
- "Save as template" keeps the sheet's `commercial` flag, so a template saved from a commercial sheet starts
  every later sheet with the commercial check on. Probably right; worth a line in the help page.
  **Kept (BVJ, 2026-11-08), and the help page says so.**
- The "–" placeholder in the minutes box and the word "min" are the only visible cue to what the box is; the
  accessible name is good ("Minutes planned for Opening"), and the hover text explains it, but a first-time
  leader reads "– min" as a mystery field in every header. A tooltip-free cue such as "Minutes" in the
  placeholder, or showing the box only on hover or focus of the header, would quiet the cards (pairs with
  "Quiet controls on reading pages").

#### What worked well

Seen as a first-time leader: the title menu's "New sheet…" opens the chooser in one step; the chooser's one
line per template reads clearly and the two new arcs (Swedish method, Contextual Bible Study) are the ones a
group leader recognizes; every part opens as a heading with dimmed guidance under it and the guidance goes
the moment you type (SH5-4) and never prints; the reading part's passage form is already open and takes a
whole chapter ("Romans 8"), a period ("Jn 3.16") and an en dash; a typed passage lands under the reading, the
verse menu's and the selection's "Add to “SH6 Bible study test”" land after the last passage, and the gap
pill's "Passage…" lands exactly where asked, twice in a row in order (SH5-3); the gap pill's menu is a proper
menu (arrows, Home, End, Escape back to the pill, the key terms line disabled with "already on the sheet");
blanks by chip are grouped one row per term with the count and verses (SH5-9); the telltale flag appears the
moment the hint stops naming the traditional word and clears when the blank is filled in again (SH5-16); the
three editor menus apply and refocus the text (SH5-1); Ctrl+B, Ctrl+I and Ctrl+K work; one toolbar, under the
focused part (SH5-6); minutes total into "Planned time: 25 min (leader's version and presenter view only)",
print on the leader's version only, stay out of the participant share, and count down in the presenter view
("This part: 14:20 left"); the key terms box's "Move before/after the reading" moves it against the first run
of passages; Move, drag, Remove and Ctrl+Z all behave; the sheet page's leak notice catches a blanked word
typed into a part; "Add an answer key" ends the leader's version with "Romans 8:1–4: 1. deviation (a word for
missing the mark); …"; Present skips Leader only and empty parts, covers each blank with its hint, reveals one
at a time, puts footnotes up in a box, and B blanks the room to black while an arrow only brings it back
(verified with real keys); the presenter view shows the clock, the plan, the next screen, the Leader only
notes and the keys; the share dialog opens on "What to share" (SH5-17), explains the long link, and the
participant link opened and imported as the reader's own with focus on "Open it on the Study Desk"
(SH5-10); a 71-hit search made "Search: ‘peace’" with 70 passages in about four seconds; a sheet of 55 parts
drew and saved without strain; "(part)" passages print with ellipses (SH5-14); Duplicate names the copy and
Delete offers undo.

### B. Ghost prompts: every template part

Read from the saved record of a fresh sheet of each template (`html`, `answer`, `prompt`, `answerPrompt`) and
from the editor's DOM (`data-placeholder` on an empty field; `data-hint` plus `aria-description` under a lone
heading). "Leaks" was checked by searching the leader and participant copies (`/sheets/`), all Present screens
and the shared participant page for every prompt sentence (none found), by the share's JSON (the `prompt`
field travels in a share and in an own template, which is right: it is guidance for whoever edits, and nothing
prints it), and by code for the files: the .docx, .odt and .rtf writers take `readCopy(current)`, the rendered
paper (`sheet-page.js:507`), and the .pptx and .odp take `presentScreens`' `html`, so no writer ever sees the
field.

| Template | Part | Holds at creation | Prompt shown | Leaks |
|---|---|---|---|---|
| Bible study | Before you lead (Leader only) | `<h2>` only | For you alone: what to bring, and the ground rules you will name (listen well, what is shared stays here, nobody has to speak). Prints on the leader's version only. | none |
| | Opening | `<h2>` only | How you will begin: a welcome, a prayer, a moment of quiet. | none |
| | Key terms box | empty (`omit: []`) | (editor's own "None of the sheet's passages uses a key term yet…") | prints "None…" on paper when empty (SH6-3) |
| | Reading | `<h2>` only, passage form open | Type the reference in the form below, or add the passage from the LIT pane's verse numbers. | none |
| | Question 1 | `html ""`, `answer ""`, lines 3 | A first question for the group, such as “What word or phrase stands out to you?” / answer: generic "Optional. An answer or notes for you as leader…" | none (its 3 lines print, SH6-3) |
| | Question 2 | empty, lines 3 | A question about the passage, such as “What does it show about God, about people, and about the world?” | none |
| | Question 3 | empty, lines 3 | A question that reaches into the week, such as “Where does this passage meet your life right now?” | none |
| | Closing | `<h2>` only | How you will end: a prayer, a blessing, or a word for the week ahead. | none |
| Sermon preparation | The text | `<h2>` only, form open | (reading prompt) | none |
| | First reading | `<h2>` only | What you notice on a first reading, what puzzles you, and what you want to look up. | none |
| | Context | `<h2>` only | Who wrote this, to whom, and what was happening around them. | none |
| | The good news here | `<h2>` only | What this passage offers the people who will hear it. | none |
| | Outline | `<h2>` only | Your outline, one line per movement: how you open, the text, the turn, the sending. | none |
| | For the congregation | `<h2>` only | One thing to carry into the week. | none |
| | Key terms box (last) | empty | (editor's) | as above |
| Class session | Before you lead (Leader only) | `<h2>` only | (as Bible study) | none |
| | Goals for this session | `<h2>` only | What the class should know or be able to do by the end. One goal per line. | none |
| | Key terms box | empty | (editor's) | as above |
| | Reading | `<h2>` only, form open | (reading prompt) | none |
| | Background (Leader only) | `<h2>` only | Notes for you as leader: history, setting, and the words worth explaining. These print on the leader's version only. | none |
| | Question (Observe) | empty, lines 3 | Observe: a question about what the passage says, such as “Who is here, and what happens?” / answerPrompt: Optional. The answer you expect, or notes for you as leader. It prints only on the leader's version. | none |
| | Question (Interpret) | empty, lines 3 | Interpret: a question about what it means, such as why the LIT renders a key term as it does. | none |
| | Question (Apply) | empty, lines 3 | Apply: a question about what it means for us, such as “What would change if we took this seriously?” | none |
| | Next time | `<h2>` only | The reading for next time, and anything to bring. | none |
| Lectio divina | Before you lead (Leader only) | `<h2>` only | (as Bible study) | none |
| | Read | `<h2>` only, form open ("Read" is a reading heading) | How to read: slowly, aloud if you can, noticing a word or phrase that catches you. | none |
| | Reflect | `<h2>` only | How to reflect: read it again and stay with that word or phrase, asking what it stirs. | none |
| | Space (6 lines) | lines 6 | (none) | prints lines, by design |
| | Pray | `<h2>` only | How to pray: read it a third time and answer God in your own words, or with none. | none |
| | Space (6 lines) | lines 6 | | |
| | Rest | `<h2>` only | How to rest: let the words go, and rest in God's presence for a few minutes. | none |
| | Space (4 lines) | lines 4 | | |
| Swedish method | Before you lead (Leader only) | `<h2>` only | (as Bible study) | none |
| | Opening | `<h2>` only | How you will begin, and how this works: the passage read aloud, a quiet time to read it alone and mark it, then sharing. | none |
| | Reading | `<h2>` only, form open | (reading prompt) | none |
| | Key terms box | empty | (editor's) | as above |
| | Light: what shines out | `<h2>` only | Something in the passage that shines out or brings light. Mark it, then note it here. | none |
| | Space (3) | lines 3 | | |
| | Question: what puzzles you | `<h2>` only | Something you don't understand, or want to ask about. | none |
| | Space (3) | lines 3 | | |
| | Arrow: what speaks to you | `<h2>` only | Something that speaks to you personally, or to your life right now. | none |
| | Space (3) | lines 3 | | |
| | Sharing | `<h2>` only | How the group will share: a round of lights, then questions, then arrows. Anyone may pass. | none |
| | Closing | `<h2>` only | How you will end: a prayer, or a moment of quiet. | none |
| Contextual Bible Study | Before you lead (Leader only) | `<h2>` only | (as Bible study) | none |
| | Opening | `<h2>` only | How you will begin: a welcome, and the passage read aloud more than once, in more than one voice. | none |
| | Reading | `<h2>` only, form open | (reading prompt) | none |
| | Question | empty, lines 3 | A first question from the group's own reading, such as “What is this passage about?” | none |
| | Reading closely | `<h2>` only | A slower reading: who is in the passage, who has power, and whose voice is missing. | none |
| | Key terms box | empty | (editor's) | as above |
| | Question | empty, lines 3 | A question about the people in the passage, such as “Who is here, and what do we learn about each?” | none |
| | Question | empty, lines 3 | A question about power, such as “Who has power here, who is left out, and what does the passage do about it?” | none |
| | Our context | `<h2>` only | Back to the group's own life: where this passage meets your community today. | none |
| | Question | empty, lines 3 | A question such as “Where do we see this in our community now?” | none |
| | Action | `<h2>` only | What the group will do in response, together or alone, and when you will come back to it. | none |
| | Closing | `<h2>` only | How you will end: a prayer, a blessing, or a word for the week ahead. | none |
| Blank canvas | one text part | `html ""` | generic: A heading, instructions, a prayer, or anything else to print. | none |
| Own template ("SH6 Bible study test") | every part of the source sheet except its passages, same order, same text, minutes, Leader only, `commercial`, `prompt` fields kept; subtitle dropped; title kept | a part with words keeps them (so a template of your own can hold text, by design); an empty part keeps its prompt | prompts never print; the typed text does, as it should |

**The rule holds everywhere.** The one place "nothing in the fields" still produces print is not a prompt
but the structure around it: headings, empty question lines and the empty key terms box (SH6-3).

### C. Combinations tried

| Template | What was added or changed | Result |
|---|---|---|
| Bible study | title, subtitle; Romans 8:1–4 typed in the reading form; blanks by chip (deviation ×3, self-preservation ×4), No hint, a custom hint, one term filled in again; footnotes list; a sentence under Opening, then Subheading, Center and Serif from the three menus; a question and a leader's answer; minutes 10 and 15; the gap pill's Your text after Opening (keyboard); + Your text, + Question, + Space, + Page break from the bar; Leader only on an empty question; Move up; Remove and Ctrl+Z; Romans 7:6 from the verse menu; the key terms box moved after the reading; commercial check on; Closing dragged to the top; Ctrl+B, Ctrl+I, Ctrl+K; a text part naming the blanked word; Save as template, a sheet from it; both versions on /sheets, QR off and on, A4, answer key, the leak notice; Present (9 screens, reveal, footnotes, B, period, Space); presenter view; participant share link opened and imported | SH6-1, SH6-2, SH6-3, SH6-5, SH6-6, SH6-8, SH6-9 seen here; everything else as the record says |
| Sermon preparation | title; Escape on The text's open form; the gap pill's Passage… after Context with Luke 4:16–21 then 4:22–30; "Isaiah 61:1-2" refused; Luke 4:14–15 from the bar | the inline form stayed for the second passage and both landed in order; the bar's passage went after the last passage; SH6-4 |
| Class session | title; nothing else; both versions on /sheets | SH6-3 in full (bare headings, nine lines, the empty box's sentence) |
| Lectio divina | title; + Key terms box (went to the end, both Move buttons offered); Matthew 11:28–30 in Read's form; Duplicate, then Delete the copy with undo offered | box filled with "very being, traditionally soul, psuche"; the form was under Read as "Read" is a reading heading; copy titled "(copy)" and deleted with undo |
| Swedish method, Contextual Bible Study | title only; records and DOM read | prompts as in section B; Contextual's box sits mid-sheet by design ("elsewhere", both Move buttons) |
| Blank canvas | title; "Romans 8" whole chapter, "Matthew 5-7", "John 3:16-18", "Jn 3.16", "Psalm 23", "Romans 8:40", "Romans 8:1–4", "romans 8 1" typed; 50 spaces in 5.7 s; "+ From my notes…" (empty state); "Show in the LIT"; a selection of John 3:1 added from the LIT pane | whole chapter accepted; 8:40 refused with the chapter's last verse; the others refused generically (SH6-4); 55 parts drew and saved (11.7 KB); "(part)" printed with ellipses |
| From /search | "Make a sheet of these verses" for 71 hits on "peace"; the gather panel's list of sheets | "Made “Search: ‘peace’” with 70 passages", focus on the link; sheets listed with subtitle, parts and date |

Not tried: Print and "Save as PDF" (dialogs), the five file writers (saves; their inputs are read above), "+
From my notes…" with notes present and the passage form's "From my notebook" list (the notebook holds no
notes and none were made, see the header), a 300-part or 512 KB sheet (the limits are unit-tested), two
tabs editing one sheet, the wording-changed notice, the Add pill's hover appearance (hover doesn't register
while the pane is hidden), a mouse drag that ends on a key term (SH5-15), Firefox and Safari, the period key
(pressed once with no visible change; B and Space were confirmed).

### D. Audit 5 fixes re-checked

- SH5-1 (three menus): holds; Subheading, Center and Serif applied, saved, focus returned, console clean.
- SH5-2 (templates hold prompts, not text): holds for all seven templates and an own template (section B).
- SH5-3 (where a passage lands): holds; typed after the reading, verse menu after the last passage, bar after the last passage, pill exactly where asked.
- SH5-4 (prompt follows the part): holds; gone on the first typed word, back to nothing when a passage follows.
- SH5-5 (a path to a sheet): holds; "New sheet…" in the title menu opens the chooser; the tour has its two steps (not re-run).
- SH5-6 (one toolbar): holds visually; every editor still carries a toolbar in the DOM (ten per Bible study sheet), hidden until focused.
- SH5-7 (3 lines on + Question): holds.
- SH5-8 (empty parts skipped in Present): holds.
- SH5-9 (one blank row per term): holds ("3 times, vv. 2, 3").
- SH5-10 (focus after actions): holds for space, page break, import and gather; **lost for + Your text, + Question and + Key terms box by the minutes field (SH6-1)**.
- SH5-11 (passage field takes focus): holds for the pill's and the bar's forms; the reading part's open form takes none by design.
- SH5-12 (custom hint row): **partly regressed** (SH6-6): the field is on its own line, the × wraps alone between.
- SH5-13 (Sermon's key terms box last): holds.
- SH5-14 ("(part)" and ellipses): holds.
- SH5-15 (drag onto a term): not re-tested (synthetic selection).
- SH5-16 (telltale flag): holds; flagged with No hint and with a custom hint not naming "flesh", cleared on fill-in.
- SH5-17: "already on the sheet" beside the disabled button holds; the page break card has no Leader only box or minutes; "fill in" wording and its help paragraph hold; the Share dialog opens on the first radio; the gather panel shows subtitle and date; the chooser's one line stays.
- E58, E59, E60, E61, E62: the long-link note is in the dialog and the "Link copied" path (the copy was refused by the pane, and its fallback sentence read well); drag by the header works (synthetic) and the pill is `opacity: 0` idle (hover unverifiable here); the reading form opens by itself and Escape keeps it closed; "+ From my notes…" shows its two empty states correctly.

### E. Ideas to improve (ranked for a weekly leader; non-defects)

1. **Show the leader what the participant will hold, from the editor.** A "Participant preview" toggle in the
   Sheets pane (or the sheet page opening on the participant version when the leader's is what they just
   edited) would have made SH6-3 visible to every leader on their first sheet.
2. **Name the template in the list and start an own-template sheet with a fresh title field** (SH6-7).
3. **Old Testament help in the passage form**: when the book is Isaiah or a psalm, offer "Add it as a Your
   text part with a Sefaria link" in one click (SH6-4), since a sermon on Luke 4 or Hebrews needs the quoted
   text beside the LIT.
4. **A "Questions" part with several numbered questions** sharing one set of lines, or lines only under the
   last; the Class session's three questions as three cards is more header than content on a 380px pane.
5. **Smart quotes while typing** (SH6-11), so the leader's "sin" matches the translation's “sin.”
6. **Quiet the card headers**: minutes and Leader only appear on hover or focus of the header, Move and
   Remove stay; a first-time leader meets five controls above every part before any words.
7. **The leak notice in the editor too**, under the passage's Blanks list ("“deviation” also prints in
   Opening"), so the fix is made where the word was typed rather than on the print page.
8. **Explain the minutes box once**, in the planned-total line or the help page: that the total is on the
   leader's paper and the presenter view counts each part down.

### F. Questions for the owner

1. SH6-3 (d): should a template heading left untouched print? "Closing" with nothing under it can read as a
   cue to the leader (it is on the leader's copy) but on the participant's copy it is an empty section; and
   "LEADER ONLY Before you lead" with nothing under it is noise on the leader's. The proposed rule prints
   headings the leader typed and drops the template's own while nothing sits under them.
2. SH6-3 (a): should an empty template question still give the participant its three lines? If yes, the
   help page should say so and Present should show it too; if no, Space is the part for lines.
3. SH6-7: should "New sheet" write a record before the first change? Seven abandoned untitled sheets in the
   origin suggest a leader compares templates by opening them.
4. Should a template of the reader's own carry the `commercial` flag (it does)? **Yes (BVJ,
   2026-11-08):** it reaches only readers who ticked it; the help page says so.
5. The Lectio divina template opens the passage form under "Read" because "Read" is a reading heading; its
   prompt talks about how to read, not about the form. Right as it is, or should Lectio's prompt mention the
   passage too? **Answered (BVJ, 2026-11-08):** the prompts should encourage the leader to write such
   instructions, not supply them, so all four now read "Your words on how to …, such as “…”".

### G. Not covered

Printing and the file saves (inputs read instead), "+ From my notes…" and the passage form's "From my
notebook" list with records present (no notes were made, by the brief), the Add pill's hover look and the
tour's two Sheets steps (RAF and hover don't run while the pane is hidden), the period key, a drag that ends
on a key term, Firefox and Safari, the apps' side of the format, phones and tablets (the desk doesn't run
there), the Notebook page's view of sheets and the trash, and two tabs on one sheet.

## Appendix B: Security and trust boundaries (`SEC6`, Opus)

Auditor: security slice. Checkout `claude/desk-audit-6` at `5c9a31a6`, 2026-11-08. Read-only; no
browser, no dev server. Scripts are in
`C:\Users\bcjoh\AppData\Local\Temp\claude\C--Users-bcjoh-GitHub-litbible\7d300a9f-94db-4c39-856c-24bfb6d06c89\scratchpad\audit6\sec6\`
and run from the repo root as `node <script> .`. Audit 3's SEC3 scripts were copied there and
repointed at this checkout (`a2-sanitizer.mjs`, `a2-redos.mjs`, `sanitizer-fuzz.mjs`,
`writers.mjs`, `import-chain.mjs`, `schema2-body.mjs`, `biglabel.mjs`, `share-file-size.mjs`,
`sec2-recheck.mjs`). New for this audit: `share-new-fields.mjs`, plus inline `node -e` timings
quoted below.

### Summary

The trust boundaries hold. Nothing new since Audit 3 adds an HTML sink: the new fields
(`prompt`, `answerPrompt`, `minutes`, `isTemplate`) reach the page only through `dataset`,
`aria-description`, CSS `attr()` and `textContent`. The import doors check them: a prompt with
`<`, one over 200 characters, or minutes outside 1 to 240 is refused, and a share can't plant
`isTemplate`. The sanitizer is unchanged apart from the prompt check. It passed Audit 2's 90
hostile cases and 60,000 random runs again. The writers produce no field, DDE, object, remote
resource or odd zip name. The lazy loader imports only fixed same-origin modules. Every Audit 3
and Audit 4 security fix is still in place.

Two real but small findings come from the shared-sheet file (`shareFile`). Its Markdown half
decodes the reader's `&lt;` back into a raw `<`, so typed HTML goes into the `.md` file
unescaped, which BA41 fixed for the notebook's Markdown. Its two whitespace regexes are also
quadratic, and a newer-format sheet (whose text is never validated) reaches them from the
Sheets page's Share dialog.

Counts: **Critical 0, High 0, Medium 0, Low 2, Nit 1** (3 findings).

### Findings

#### SEC6-1 · Low · security · NEW · FIXED (2026-11-08)

**The shared sheet's file writes the reader's own `<` raw into its Markdown half, so typed HTML
renders, or runs, in a Markdown viewer.** This is the sibling of BA41 that DK3-12's fix missed.

- **Where**: `src/lib/desk-sheet-share.mjs:228-249` `plainText`, which turns `&lt;` and `&gt;`
  back into `<` and `>` (`:237-238`), and `:211-216` `markdownLine`, which escapes `\` `` ` ``
  `*` `_` and line-start marks but not `<`. `shareFile` (`:292-300`) passes the title and
  subtitle through `markdownLine` only, and every module's text through `plainText`.
  Compare `escapeBody` in `src/lib/desk-export.mjs:217-223` (BA41), which turns every `<` into
  `\<` for the notebook's Markdown copy.
- **What happens**: a leader types `<script>alert(1)</script>` or `<a href="javascript:…">`
  into a text part as words (stored safely as `&lt;script&gt;…`), or titles the sheet
  `<img src=x onerror=alert(1)>`. They choose Share… then "Export a Study Desk file (.md)". The
  file's human half holds those characters as live HTML. A Markdown viewer that renders inline
  HTML shows the reader's words as markup (a typed `<b>` turns bold, and a typed tag vanishes).
  A viewer that doesn't sanitize would run it. Most mainstream viewers (GitHub, VS Code) do
  sanitize, and the file's author could write any `.md` by hand anyway, so the security effect
  is small. It also contradicts DK3-12's aim, that the reader's own words "read as written in a
  Markdown viewer". The data line is untouched, and the site never renders this half.
- **Evidence**: `node -e` over the real `shareFile` with the title and text above. The first
  lines of the file were `# <img src=x onerror=alert(1)>` and
  `<script>alert(1)</script> and <a href="javascript:alert(1)">click</a>`.
- **Fix**: in `markdownLine`, also replace `<` with `\<`, as `escapeBody` does. That covers a
  line starting `<!--` too, so the separate `<!--` replace in `plainText` becomes belt and
  braces. Add a `desk-sheet-share.test.js` case that the head and a text part keep no raw `<`.
- **Confidence**: High (reproduced with the real module).

#### SEC6-2 · Low · security (availability) · NEW · FIXED (2026-11-08)

**`plainText` and `markdownLine` take quadratic time on a run of spaces or tabs. A newer-format
sheet reaches them unchecked from /sheets/'s Share dialog, so a hostile backup can hang the tab
for minutes.**

- **Where**: `src/lib/desk-sheet-share.mjs:215` (`/^([ \t]*\u0001?[ \t]*)(…)/gm`: two
  `[ \t]*` around an optional character backtrack over each other) and `:246`
  (`/[ \t]+\n/g`, tried from every space of a run that doesn't end in a newline).
  `src/scripts/desk/sheet-page.js:409, 422` offers Share for any stored sheet, with no
  `canEdit` gate, and `:743` calls `shareFile`. `validateRecord` stops at `canEdit` for a
  `sheetFormat` above this code's (principle 6), so such a sheet's `html` and `title` are never
  sanitized or whitespace-collapsed, and are bounded only by SEC3-1's 1 MB.
- **What happens**: someone sends a notebook backup holding a sheet with `"sheetFormat": 2`
  whose text part is `"<p>\n"` followed by 200,000 spaces. "Open a copy" keeps it. The reader
  opens it on /sheets/, chooses Share…, then "Export a Study Desk file (.md)". The tab hangs for
  about 48 seconds; near the 1 MB ceiling it is roughly 20 minutes. Closing the tab ends it, and
  nothing is lost. A sheet this code can edit is safe: the sanitizer collapses whitespace, so
  `plainText` of canonical text measured 0 ms at 40,000 characters. The copy the reader receives
  would be refused anyway ("newer"), so sharing a newer-format sheet buys nothing.
- **Evidence**: `node -e` over the real `shareFile` with a `sheetFormat: 2` record
  (`validateRecord` returned no problems): 50,000 spaces 3,049 ms, 100,000 spaces 12,263 ms,
  200,000 spaces 48,311 ms. `markdownLine` alone on `" \t"` runs: 10,000 characters 66 ms,
  40,000 characters 947 ms, 160,000 characters 17,855 ms.
- **Fix**: make both patterns linear. Use `/^([ \t]*)(\u0001[ \t]*)?([#>+-]|\d+(?=[.)]))/gm`
  (adjusting the callback), and `/[ \t]+$/gm` or a line-by-line `trimEnd()` in place of
  `[ \t]+\n`. Independently, disable Share (and Save as) on /sheets/ for a sheet `canEdit`
  refuses, as the Sheets pane already disables Duplicate. Add a timing case to
  `desk-hostile-records.test.js`.
- **Confidence**: High for the cost and the import path. Medium that the Sheets page draws
  and offers Share for a `sheetFormat: 2` sheet: read, not run in a browser.

#### SEC6-3 · Nit · docs · NEW · FIXED (2026-11-08)

**A prompt travels in every share, including a participant share, though the code says nothing
shares it.**

- **Where**: `src/lib/desk-sheet-format.mjs:939-943` (`promptOk`'s comment: "nothing prints,
  copies, shares or presents it"); `src/lib/desk-sheet-share.mjs:156-163` `plainModule`, which
  copies every field but `id`, `verseCopy` and `verseCopyAsOf`, blanks `answer`, and drops
  `minutes` for a participant. `STUDY-DESK-FORMAT.md` "Sharing a sheet" (`scope` row, around
  line 576) lists what a participant share leaves out and doesn't name `minutes`.
- **What happens**: `share-new-fields.mjs` shows a participant share's question carrying
  `["type","html","answer","lines","prompt","answerPrompt"]`, with `answer` blank. Nothing
  leaks today. A prompt is fixed template text (for example, "Optional. The answer you
  expect…"), and no control lets a leader write one. Even "Save as template" copies prompts
  unchanged. The risk is the next change: if prompts ever become editable, the comment would
  mislead whoever makes the participant share carry the leader's words.
- **Fix**: either drop `prompt` and `answerPrompt` in `plainModule` for a participant share,
  as `minutes` is dropped (a received sheet then shows the editor's default placeholders), or
  correct the comment to "shared, never printed…". Add "and no `minutes`" to the format's
  `scope` row.
- **Confidence**: High.

### Prior fixes re-checked

- **SEC3-1** (1 MB ceiling for any schema): holds. `validateRecord` common block
  (`desk-records.mjs`, `MAX_RECORD_BYTES`/`recordBytes`). `planImport` applies it to a trash
  record too. `schema2-body.mjs`: schema 2 note and `sheetFormat: 2` sheet both "kept 0 … too
  large to keep (over 1 MB)".
- **SEC3-2** (inert scrub): holds. `makeInert` (`desk-inert.mjs`) is applied in
  `chapter-page.js:52` `keepParts` and `intro-pane.js:70`. `plainAddress` refuses
  `java\tscript:`, `\u0001javascript:`, a leading space, `vbscript:` and `data:`. A soft hyphen,
  ZWSP, U+3000 or RLO inside the scheme reads as a relative address, as a browser reads it.
  `test/desk-inert.test.js` passes. (Audit 3's `inertcopy.mjs` tests the deleted `inertCopy`
  and is obsolete.)
- **SEC3-3** (participant slides): holds. `deckSlides(…, { participant })` empties every
  slide's `notes` (`desk-slides.mjs:397`), and `readSlides` passes it (`sheet-slides.js:133,
  200`).
- **SEC3-4** (name caps, Sheets page file reader): holds. `BOOKMARK_NAME_MAX` and
  `LABEL_NAME_MAX` are in `validateRecord`. `openFileRow` checks `MAX_SHARE_FILE_BYTES`
  (`sheet-page.js:262`). `fragmentInFile` throws "too-large" (`share-file-size.mjs`: three
  oversized cases refused).
- **SEC3-5** (marker lookup): holds. `print-notes.js:212` uses `markerName`, and
  `migrateRecord` uses `Object.hasOwn` (`desk-records.mjs:81`).
- **SEC4-1** (`?q=` on /notebook): holds. `notebook-page.js:425-431` reads `q` and then
  `replaceState`s it away, keeping `?desk=on` and the hash.
- **SEC4-2** (malformed fragment): holds. `partId` (`notebook-page.js:454-460`) catches the
  `URIError`.
- **SEC-1** (no off-site fetch): holds. `chapterHref` (`chapter-page.js:37, 134`) and
  `introHref` (`intro-pane.js:44, 55, 148`). `import-chain.mjs`: hostile `bookKey`s give href
  null, `chapterCodes` gives `[]`, and `introPath`/`parsePlaceParam`/`parseIntroParam` refuse
  `/evil`, `__proto__`, `constructor` and `//evil.example-1`.
  `test/desk-chapter-address.test.js` passes.
- **SEC-2** (QUALIFIER_REACH): holds (`scripture-refs.mjs:205`). `sec2-recheck.mjs`: 480 KB of
  "LXX Ps 51:4" takes 85 ms in `noteBodyHtml` and 82 ms in `sheetHtmlForShow`.
- **SEC-3** (external links): `test/external-links.test.js` passes. Every `target="_blank"` in
  `src/scripts/desk/` has `noopener` within three lines.
- **SEC-4** (print only on the menu's press): holds (`print-link.js:32`, `printWasAsked`).
- **SEC-6 / RC-1**: the 50 MB file check (`export-import.js:35, 159`). A trash record whose
  held copy fails is kept as its tombstone with a warning, and the copy is dropped
  (`desk-export.mjs:705-716`, DI3-4).
- **DK3-9 / Audit 3 Improvement "pass the resolved address"**: done. `readCopy` passes
  `docHref`, which returns `new URL(abs).href` for http, https and mailto only
  (`sheet-word.js:63`, `desk-sheet-doc.mjs:106-114`).
- Repo tests run for this slice, all passing (503 tests): `desk-hostile-records`,
  `desk-chapter-address`, `desk-inert`, `desk-sheet-share`, `external-links`,
  `desk-storage-keys`, `desk-present`, `desk-sheet-templates`, `desk-sheets`, `desk-sheet-doc`,
  `desk-slides`, `desk-gate-imports`, `desk-first-stage`, `desk-export`, `desk-records` and
  `desk-sheet-leaks`.

### Sink table

Only sinks new or changed since Audit 3 (`60af379e`) are listed, plus the new fields' paths.
Audit 3's table (Appendix A) and Audit 4's sweep still hold for the rest. A fresh grep of every
`innerHTML`/`insertAdjacentHTML` with an interpolation in `src/scripts/desk`, `src/scripts/*.js`
and `src/lib/desk-*.mjs` found only constants, `glyph`/icon markup, `escapeHtml`'d text,
`sheetHtmlForShow` and `qrSvg`.

| Sink | Where | What reaches it | Verdict |
|---|---|---|---|
| `data-placeholder` / CSS `attr()` | `sheet-text.js:205`, `desk.css:6628` | a module's `prompt`/`answerPrompt` (`promptOf`, `sheet-pane.js:119, 1278, 1326-1327`) | Safe: attribute text; `attr()` draws text only |
| `data-hint`, `aria-description` | `sheet-pane.js:945-957` `headingPrompt` | a text part's `prompt` | Safe: attributes; validated on import (no `<`, 200 characters or fewer) |
| Template lists | `sheet-pane.js:662-692` `ownTemplatesList` | an own template's title | Safe: `make(…, text)`, `aria-label` |
| Leaks notice | `sheet-page.js:603-612` `drawLeaks` | blank words, references (`leakSentence`) | Safe: `make("li", null, text)` |
| Answer key | `sheet-copy.js:447-470` | blank answers and hints (`answerKeyLine`) | Safe: `textContent`; leader copy only (`:412`, `copy === "leader"`) |
| Answer key in files | `sheet-word.js:194-198` → writers' `section`/`para` | the same text | Safe: `xmlEscape`/`rtfEscape`/`esc`; `writers.mjs` re-run: 0 problems in 118 parts, every RTF field a HYPERLINK, all ASCII |
| Presenter view clock and plan | `sheet-present.js:780-799` | `minutes` (`moduleMinutes` bounds 1 to 240), `Date.now()` | Safe: `textContent` |
| BroadcastChannel `blank` | `desk-present.mjs:146` `checkState` | `state.blank` from the other window | Safe: only `=== true` is kept; `screen` clamped |
| `localStorage['lit-sheet-answer-key']` | `sheet-page.js:75-85` | "on"/"off" | Safe; named in `/privacy` (`privacy.astro:148`); `desk-storage-keys` test passes |
| Shared-sheet `.md` human half | `desk-sheet-share.mjs:211-249, 292-300` | title, subtitle, module text | **SEC6-1** (raw `<`), **SEC6-2** (quadratic) |
| Share import, new fields | `sheetFromShared` → `validateRecord` | `prompt`, `answerPrompt`, `minutes`, `isTemplate` | Safe: `share-new-fields.mjs`: `<` in a prompt, 201 characters, a non-string, minutes 0/241/1.5/"5" refused; `isTemplate` never copied from a share (`fields` lists what is kept) |
| Backup import, own templates | `planImport` → `validateRecord` → `validateSheet` | `isTemplate` (boolean only) | Safe; `templateFromSheet`/`sheetFromTemplate` refuse a newer format (`mustEdit`) |
| Lazy desk loader | `desk-gate.js:66-82`, `first-stage.js:70`, `desk-first-stage.mjs:33-38` | `?greek`, `?desk-tour`, `?print` (presence only), session follow flag | Safe: fixed module specifiers only; a parameter can only make the shell load early. `first-stage.js:296` BroadcastChannel only triggers a re-read |
| `window.open` presenter | `sheet-present.js:70, 581-601` | `encodeURIComponent(sheet.id)` | Safe: same origin; the name is a window name only |
| `new RegExp` from input | `greek-commands-ui.mjs:87` | a word, escaped first | Safe |

### Improvements

- **Use `Object.hasOwn(BOOKS, …)` in `validateRecord`** (`desk-records.mjs:428`,
  `r.bookKey in BOOKS`). Still open from Audit 3: `constructor` passes the book test and is
  caught only by the chapter test (`import-chain.mjs`: "chapter is out of range").
- **Add `blob:` to the report-only `img-src`** (`public/_headers:34`). Still open from Audit 3.
  `printSlides` uses `blob:` images (`sheet-slides.js:297`), so an enforced policy would drop
  the slides' codes.
- **Strip `\p{Cf}` (U+202E, U+2066-2069) in `documentFileName`.** Still open:
  `writers.mjs` shows `"a\u202Egnp.exe"` kept as `a‮gnp.exe (leader).docx`.
- **Extend `test/desk-chapter-address.test.js`'s source check to `intro-pane.js`'s
  `introPath`.** Still open: the test never names it.
- **`Cross-Origin-Opener-Policy: same-origin-allow-popups`.** Still open (Audit 2 decision 5
  stands). The presenter window is same-origin, so `allow-popups` keeps it working.

### Questions for the owner

- **Q1 (SEC6-2).** Should a sheet of a newer format be shareable from /sheets/ at all? Its
  recipient on this version can't open it ("newer"). Disabling Share and Save as there, as
  Duplicate is in the Sheets pane, would also close SEC6-2's path whatever the regexes do.

### What held up

- **Sanitizer and paste path**: `a2-sanitizer.mjs` "cases 90 issues 0"; `sanitizer-fuzz.mjs`
  "runs 60000, failing 0" over `sanitizeSheetHtml`, `pastedSheetHtml` and `sheetHtmlForShow`.
  `a2-redos.mjs` timings are linear as before (the parseImport 5 MB headings case is 1.27 s,
  as at Audit 3). The editor's paste and drop go through `pastedSheetHtml`, then
  `sanitizeSheetHtml`, and every emit re-canonicalizes (`sheet-text.js:242, 1142-1180`).
- **Canonical text can't feed SEC6-2**: the sanitizer collapses whitespace, so 20,000
  `<b> </b>`, `<span> </span>` or `" &nbsp;"` pieces came out of `plainText` in 0 to 1 ms.
- **Writers** (`writers.mjs` re-run): docx, odt, pptx and odp parse strictly. No DDE, field,
  object, doctype, template or remote image. Zip entry names are fixed. RTF braces balance and
  every field is a HYPERLINK with an escaped address. (Its "docHtml javascript: true" line is a
  false positive: the probe matches the escaped text `&lt;text:a xlink:href="javascript…`, not
  an anchor. `docHtml` gets addresses only through `docHref`.)
- **Shared-sheet file**: a title that plants `<!-- lit-sheet share1.AAAA -->` on its own line,
  and a subtitle with an unclosed opener, still open as the real sheet, since `fragmentInFile`
  takes the last data line (`share-new-fields.mjs`).
- **`__proto__` in a shared module**: `sheetFromShared`'s copy loop sets the throwaway object's
  prototype, and the spread drops it. The module keeps `Object.prototype`, with no `leaderOnly`
  or `html` smuggled in.
- **Templates of your own**: a share never carries `isTemplate`. Every list on /sheets/ and in
  search-sheet filters `isOwnTemplate`. A newer-format template can't be copied in either
  direction.
- **Present and the presenter view**: `checkState` keeps `blank` only as `true` and clamps the
  screen. Minutes are bounded by `moduleMinutes` even for an unknown module type carrying
  `1e9`. The participant share drops `minutes` (`plainModule`).
- **Answer key**: gated on `copy === "leader"` in `renderCopy`, not only by the hidden checkbox.
- **URL parameters**: `place`, `intro`, `sheet`, `greek`, `print`, `desk-tour`, `q`, `id` and
  `view` each pass a parser or a store lookup, and each is stripped where it changes state.
  `?desk=on`/`?desk=off` is the known pre-paint switch.
- **CSP**: no new origin is loaded by the desk. Fonts, chapter and intro pages, `/greek/`,
  `/api/` and `/search/` are all `'self'`; QR codes are drawn locally.
- **`/desk/help`**: static, with no external links.

### Not reached

- Opening the exported `.md` (SEC6-1) in real Markdown viewers to see which render raw HTML.
- Confirming in a browser that /sheets/ draws a `sheetFormat: 2` sheet and offers Share
  (SEC6-2's UI path); read only.
- Cross-slice, not verified: Present's "Presenter view" on a shared sheet that isn't saved
  opens `/sheets/?id=<fresh id>&view=presenter`, which the store won't hold ("Sheet not
  found"). That is functionality, not security; noted for the Sheets slice.
- Several lists outside /sheets/ (`record-rows.js`, `search-pane.js`, `desk-panes.js`) don't
  reference `isOwnTemplate`. Whether templates show there as sheets is a functionality
  question, not checked.

## Appendix C: Data integrity and sync-readiness (`DI6`, Fable)

Checkout `C:\Users\bcjoh\GitHub\litbible\.claude\worktrees\desk-audit-6` at `5c9a31a6`. Read-only. Every claim below was run in node against the real modules; the scripts are in `C:\Users\bcjoh\AppData\Local\Temp\claude\C--Users-bcjoh-GitHub-litbible\7d300a9f-94db-4c39-856c-24bfb6d06c89\scratchpad\audit6\di6\` (named per paragraph). The pre-#505 modules (commit `60af379e`) were extracted to `di6/old60af/` with `git archive` for the older-reader checks. `npm run test:desk` passes (2,422 tests).

### Summary

The slice is sound and the new code since Audit 3 holds up under fuzzing. The bookmark-by-group merge (vectors 5, never fuzzed before) converges and is idempotent over 9,000 random three-replica histories inside the clock tolerance, with no record ever assembled from parts no replica wrote. Anchor spec 4, run over all 173 chapter revisions in git history, turns every one of the 18 `moved` results into one that carries `outsideVerses`, so the 15 silent wrong placements Audit 3 found all carry the notice now, and 0 silent moves remain. Every kind, the new `isTemplate`, `minutes`, `prompt` and `answerPrompt` fields included, round-trips byte for byte through the full backup and the Web Annotation file, with today's reader and with the pre-#505 reader (principle 6 holds), and the share drops exactly what the format says. All six DI3 fixes are still in the code with their tests. One real finding: the DI3-6 fix made the **edit** path tolerate a canonical-form drift, but the **import** path (and a share) still validate before they sanitize, so a sheet in an older canonical form is refused whole, and in the trash its words are dropped, against what the format says. Counts: Critical 0, High 0, Medium 1, Low 2, Nit 1.

### Findings

#### DI6-1 · Medium · data-integrity · NEW · FIXED (2026-11-08)

**Where**: `src/lib/desk-export.mjs:705` (`planImport`: a held sheet is judged by `validateRecord(migrateRecord(m.record))` before anything is sanitized), `:721-730` (`validateRecord(m)` first, `cleanIncoming(m)` only on the records that passed); `src/lib/desk-sheet-format.mjs:1065`, `:1069-1070` (`validateSheet` requires `sanitizeSheetHtml(m.html) === m.html`); `src/lib/desk-sheet-share.mjs:383-385` (`sheetFromShared`: `validateRecord` with no sanitizing first); `src/lib/desk-sheets.mjs:298` (`planSheetChange`, the one path that does run `cleanSheetText` first, DI3-6 fix b); `STUDY-DESK-FORMAT.md:495-498` ("Every client sanitizes it when it is saved and again when it is shown, whatever the sheet's sheetFormat … the website sanitizes these fields on every sheet it imports").

**What happens**: a backup holds a sheet whose formatted text was canonical when it was saved and isn't under today's sanitizer (a deliberate canonical-form change with a `SHEET_FORMAT` bump, which the golden corpus exists to make deliberate; or any sheet written as `sheetFormat` 1 by a client whose sanitizer differs in one detail). Opening the copy skips the live sheet whole: "It couldn't be read." The reader's sheet, title and questions included, never arrives, and the edit-path fix never gets a chance, since the sheet never enters the store. Worse, when such a sheet sits in a trash record, `planImport` keeps the deletion as a tombstone and drops the held sheet, telling the reader "its words couldn't be read, so it can't be restored": a deleted sheet in the 30-day window loses its words permanently on the way through a backup. A share from an older site version fails the same way at `sheetFromShared` ("This sheet couldn't be read"). `cleanIncoming` is reached only by records that already validate, so for a sheet of this code's format it can never change anything: the format's sentence about sanitizing on import is true only for `sheetFormat` 2+.

**Evidence**: `import-noncanonical-sheet.mjs`. A sheet with `<p><b>bold</b> and <i>italic</i></p>` (today's form is `<p><strong>bold</strong> and <em>italic</em></p>`): live in a backup, `put: 0`, skipped "It couldn't be read. / Module 1 (text): html is not in the sheet's formatted-text form"; inside a trash record, `put: [{ kind: "trash", holds: false }]` with the DI3-4 warning; the same sheet through `planSheetChange` saves (`changed: true`); `validateRecord(cleanSheetText(drifted))` is empty, so sanitizing first would have admitted it.

**Fix**: in `planImport`, sanitize before judging: `m = cleanIncoming(migrateRecord(r))`, then validate `m` and its held record (the held record's sanitized copy is what `cleanIncoming` already produces for a trash record). In `sheetFromShared`, run each module's `html` and `answer` through `sanitizeSheetHtml` before `validateRecord`, as `makeModule` does. Add a test with a pre-change form (the golden corpus has inputs whose output differs from the input, so a case can be taken from it). Keep the validation after it, so an unsanitizable value is still refused. One line in the format under "Formatted text" saying the website sanitizes **before** it checks, on import and on a share.

**Confidence**: High on the mechanism (run); the day it bites is the maintainer's, as DI3-6 said, but the trash path turns a refusal into a silent loss of words.

#### DI6-2 · Low · compat · NEW (sync-readiness) · FIXED (2026-11-08)

**Where**: `src/lib/desk-records.mjs:417` (`validateRecord`: `Array.isArray(r?.labels)` is required of every live record), `:415-416` (`client` and `contentVersion` must be strings); `src/lib/desk-export.mjs:724` (`planImport` skips a live record that fails it); `STUDY-DESK-FORMAT.md:67` (`labels`: "IDs of the reader's labels (M8); may be empty").

**What happens**: a live record from another client that leaves `labels` out (an app that has no labels feature and maps its records onto the format) is refused whole on import and, under phase 4, at sync: "It couldn't be read." The format's table presents `labels` as "may be empty" and never says a client must write it; nothing in the format says `client` and `contentVersion` are mandatory either, only what they hold. For trash records the website is already lenient (times that parse), so the strictness falls on exactly the records a reader cares about.

**Evidence**: `edge-probes.mjs`: `validateRecord` of a valid note without `labels` → `["labels is not a list of IDs"]`; with `labels: null` the same. Both apps' records are BDR's to map, and the apps don't use the format yet, which keeps this Low.

**Fix**: either read an absent `labels` as `[]` (validate it only when present, and let `migrateRecord` fill it in so the next write carries it), or add one line to the format's table stating which common fields are required of a live record. Either settles it before BDR writes the mapping.

**Confidence**: High on the behavior; Medium on the weight.

#### DI6-3 · Low · usability · NEW (cross-slice, the Sheets) · FIXED (2026-11-08)

**Where**: `src/lib/desk-sheets.mjs:143-156` (`templateFromSheet` keeps every part but the passages; nothing refuses a sheet that has nothing else), `:167-175` (`sheetFromTemplate`); `src/scripts/desk/sheet-pane.js:536-543` ("Save as template" is offered on every sheet the reader can edit; the only disabled case is a newer format).

**What happens**: a sheet made from a search (`template: "search"`, passages only; `search-sheet.js:386-396`, `search-pane.js:796-806`) or any sheet the leader built from passages alone gets "Save as template"; the template made has zero modules, and "New sheet" then offers a template that opens as a sheet with no parts at all and `template: "search"`. Nothing is lost, but the template is a dead end the list offers by name.

**Evidence**: `edge-probes.mjs`: `templateFromSheet(searchSheet).modules.length === 0`, `validateRecord` empty; `sheetFromTemplate` of it → `modules.length 0`, `template "search"`. Not run in a browser (the Sheets live walkthrough is Part 1's).

**Fix**: disable "Save as template" when `sheet.modules.every(m => m.type === "passage")`, with a title saying a template keeps the parts around the reading; or have `templateFromSheet` throw for such a sheet and `saveAsTemplate` say so.

**Confidence**: High on the mechanism; Low on how the empty sheet draws.

#### DI6-4 · Nit · docs · NEW · FIXED (2026-11-08)

**Where**: `STUDY-DESK-FORMAT.md:374` (the `template` field's list of ids), `src/scripts/desk/search-sheet.js:388` and `src/scripts/desk/search-pane.js:798` (`template: "search"`).

**What happens**: a maintainer reading the format doesn't learn that `search` is a template id the website writes; the list ends in "…", so nothing is wrong, but `search` is the one id no builder in `desk-sheet-templates.mjs` has, and a reader of `templateModules("search")` would get a throw.

**Fix**: add `search` to the list in the format with four words saying what it is.

**Confidence**: High.

### Prior fixes re-checked

- **DI3-1** (every stamp steps past what it replaces): holds. `trashRecord` `desk-records.mjs:259` (`laterThan(record.modified, now)`), `restoreFromTrash` `:293` (`laterThanAll(now, record.modified, trash.deletedAt)`), `restamped` `desk-history.mjs:147-155` with `timesOf` `:139` (now including a bookmark's two stamps). Tests `test/desk-merge.test.js:349`, `test/desk-history.test.js:206`. `edge-probes.mjs`: an undo at t3 of a move made at t5 is stamped `09:05:00.001Z` on all three stamps.
- **DI3-2** (spec 4, `outsideVerses`): holds. `anchor-core.mjs:259-262`; `desk-change.mjs:148` raises the notice; `desk-print-notes.mjs:56` answers "moved" for print; vectors `specVersion 4`. `anchor-revisions6.mjs` (Audit 3's walk, pointed at this checkout with spec 4 accounting): 474 revision pairs, 9,444 marks, `moved` 18, of which `outsideVerses` 18, inside 0; `wrongButNoticed` 15, silent `moved` 0. The 24 silent wrong placements left are all `found` (13 one-word, 6 three-word, 5 five-word marks inside a reworded verse), the residual Audit 3 named.
- **DI3-3** (bookmark by group): holds. `BOOKMARK_PLACE_FIELDS` `desk-records.mjs:132`, `bookmarkStamps` `:135-143`, `editRecord` `:217`, `createRecord` `:174`, `restoreFromTrash` `:299`; `mergeBookmark` `desk-merge.mjs:204-224`, used by `pickWithin` `:230` and `pickAcross` `:241`; `clamped` `:169-173`; the follower writes the place group with `contentVersion` `bookmark-follow.js:398-400`, `:438`. Vectors version 5, 73 cases, the five bookmark cases present. `bookmark-merge-fuzz.mjs` (below).
- **DI3-4** (a deletion whose held copy can't be read is kept as a tombstone): holds. `planImport` `desk-export.mjs:705-718`, `warnings`; test `test/desk-export.test.js:613`. Seen live in `import-noncanonical-sheet.mjs` (where it is also the path DI6-1 turns into a loss).
- **DI3-5** (`star` reads as `emphasis`): holds. `RENAMED_MARKERS` `desk-records.mjs:77`; `currentMarker` `:80`, `validateRecord` `:446`, `renameMarker` `:356`, the Markdown reader `desk-export.mjs:492`. Round trip: the `bookmark` marker came back as `ribbon` on both readers.
- **DI3-6** (golden corpus; `cleanSheetText` on the edit path): holds, on the edit path. `planSheetChange` `desk-sheets.mjs:298`; `test/desk-sheets.test.js:85` holds `sheet-text-golden.json` (`sheetFormat 1`, 300+ cases) byte for byte. Its sibling, the import path, is DI6-1.
- **Audit 3's store fix (#497)**: holds. `committed` `store.js:78-82` rejects with `tx.error`; tests `test/desk-store.test.js:92, 149`; the sheet pane's `failed` `sheet-pane.js:429-444` names the size case and takes the unsaved change back (not run in a browser).

### Improvements

- **Sanitize, then validate, at every door a sheet comes through** (DI6-1): `planImport`, `sheetFromShared`, and keep `planSheetChange`. One helper, one rule.
- **Keep `anchor-revisions6.mjs` beside `build-anchor-vectors.mjs`** (Audit 3 asked the same): it now records `outsideVerses`, and is the only measurement of spec 4 against real revisions. Run it before any `ANCHOR_SPEC_VERSION` bump.
- **Reconcile `deletedKind` with the held record's kind** on arrival: `planImport` accepts a trash record whose `deletedKind` differs from `record.kind` and keeps both (`edge-probes.mjs`: `["trash","highlight","bookmark"]`); `migrateRecord` could take `record.kind` when they disagree, as it fills a missing one.
- **State the required common fields once in the format** (DI6-2), whichever way the decision goes.
- **`emptyTrashRecord` never empties a trash record whose `deletedAt` won't parse** (`desk-records.mjs:313-314`), so such a record keeps its words forever. Only local corruption can make one (`problemWith` refuses it on arrival), so this is a one-line hardening, not a finding.
- **Tell BDR the clamp's cost for sync in one sentence** (question 2 below) before the transport is chosen.

### Questions for the owner

1. **A bookmark that moves as the reader reads undoes its own deletion.** Rule b compares the live `modified` with `deletedAt`, and a follower's move writes `modified` (the format's kind 4 says so). So: the phone deletes a followed bookmark; the laptop, still reading, writes a move two seconds later; when they meet the bookmark is back, at the laptop's place, on both (`edge-probes.mjs`: `delete(t5) vs follower move(t6) → ["bookmark"]`). DI3-3 settled renames and switches against moves, not deletions. Should a deletion beat a move (for a stamped bookmark, rule b could compare `deletedAt` with `editedAt`, since a move is reading, not an edit), or is this accepted as rule b?
2. **A device more than five minutes ahead never converges.** The never-beats rule is deliberate (BA4, BA12) and `bookmark-merge-fuzz.mjs` shows it exactly: 0 divergences in 9,000 histories inside the tolerance, and 69 of the runs that had a clock ten minutes fast end with three different copies after six full exchanges, permanently. For a file the website reports it ("a date from a clock that was set ahead"). Under plan C a phone with a wrong clock would lose every edit of an existing record at the service, silently unless the service tells it. For BDR: should the service's clock stamp writes (the `laterThan` step already makes stamps a hybrid clock), so a device's own clock never matters?
3. **Are `labels`, `client` and `contentVersion` required of an app's record** (DI6-2), or should the website read absent ones as empty?

### What held up

- **Bookmark merge by group** (`bookmark-merge-fuzz.mjs`, seeds 7, 99, 2024; 3,000 runs each): three replicas, moves, renames, labels, follow toggles, deletes and restores, a stampless app copy in a fifth of runs, a 90-second clock skew in a quarter, partial exchanges mid-run, then full pairwise exchange in two orders: identical sets on all three every time inside the tolerance; a repeated exchange writes nothing; every merged bookmark's place group and edit group is one some replica actually wrote. `edge-probes.mjs`: a move at t5 and a rename at t4 both survive in either order, with `modified` and `client` from the later write; a stampless app copy merges whole by rule a, as the format says.
- **Round trip** (`roundtrip.mjs`): 18 records of every kind (a labeled highlight with an app field, notes on a quote, on whole verses with the old `bookmark` marker, on a footnote, on a glossary entry, a bookmark that follows with `from`, a pin, a mark rule, a place, a hidden passage, an unknown kind at schema 3, a newer-schema note, a sheet with `minutes`, `prompt`, `answerPrompt`, `leaderOnly`, an unknown module type and a label, a template of the reader's own, a full trash record, a tombstone, and a deleted template): full backup → empty notebook, 0 missing, 0 changed (the marker renamed as intended); again into itself, 0 writes; the Web Annotation file the same for every live record; **the pre-#505 reader** reads the same backup to the same 18 records, 0 changed, edits the sheet and keeps `isTemplate`, `minutes` and `prompt`, and its `validateRecord` accepts the template (principle 6). A Markdown note edited in the file comes back as an edit; the unedited file writes nothing; the Markdown lists no sheet, template, prompt or minutes.
- **Sharing** (`share-roundtrip.mjs`): a leader share of a template carries `minutes`, both prompts, `leaderOnly`, the unknown module and `commercial`, and never `isTemplate` or labels; a participant share drops the Leader only part, the unknown module, `minutes` and every answer; both copies validate; a crafted share with `isTemplate`, module ids and `verseCopy` has them ignored and is refused for its bad `minutes` and `prompt`; the file round-trips and shows neither prompt nor minutes; a title holding `<!-- lit-sheet` comes back intact.
- **Templates and minutes as records**: `isTemplate` and `minutes` are validated (`desk-sheet-format.mjs:1030`, `:1059`; `minutes` on an unknown module type is left alone), kept by `duplicateSheet` and `templateFromSheet`, excluded from the three sheet lists (`sheet-pane.js:501-502`, `sheet-page.js:214`, `search-sheet.js:301`), and never written by `desk-sheet-check.mjs`, `desk-sheet-leaks.mjs` or `desk-present.mjs` (no write in any of the three). `setSheetFields` refuses `isTemplate`.
- **Validation edges**: `+00:00` refused and a fractionless `Z` time accepted, as the format says; an app tombstone with only `id`, `kind`, `modified`, `deletedId`, `deletedAt` is accepted (trash needs only times that parse); `modified` before `created` is accepted; a `verse` given as a string is refused.
- **History**: a stamp-only change is a no-op entry; an undo of a move restamps all three stamps past the move.
- **Store write paths**: every `store.change` caller not sampled by Audit 3 was read: `actions.js:458-475` (`planWrite`), `bookmark-form.js:204-211` (`planBookmarkEdit`), `note-editor.js:152-156` (`planEdit`), `search-pane.js:791-808` and `search-sheet.js:379-396` (`planSave`), `history.js:128-139` (`planWrite`), `bookmark-follow.js:382-401` and `:433-440` (`editRecord` of a record read in the transaction, `isFollowing` and `canEdit` checked); `pins.js:122`, `sheet-pane.js:642-746` and `sheet-page.js:640` go through `store.save` (`planSave`); the pagehide path `sheet-pane.js:1013-1031` goes through `writeNow`, which runs `planWrite`.
- **Format against code, line by line**: the common fields and the ISO rule, kind 2's markers and `RENAMED_MARKERS`, kind 4's label limit (40) and follow limit (6), kind 8's 200, kind 9's limits (512 KB, 300 modules, 200-character title, subtitle and prompt, 1 to 240 minutes, 0 to 20 and 1 to 40 lines), the share's drop list and participant scope, kind 10's tombstone and collapse rules, the clamp, the tolerance (5 minutes), the 1 MB ceiling, spec 4's `outsideVerses`, and the vectors' versions (`merge-vectors.json` 5, `anchor-vectors.json` spec 4, `api2-vectors.json` anchorSpec 4, `sheet-text-golden.json` sheetFormat 1) all agree, apart from DI6-1's sentence and DI6-4's list.

### Not reached

- Nothing in a browser: IndexedDB quota in a real browser, BroadcastChannel across tabs, the sheet pane's `pagehide` write, how an empty-modules sheet draws (DI6-3).
- The apps' resolvers, merge and mapping (BDR's side), and the Part 1 walkthrough's concerns (how `minutes` print and present, the print check, the give-away flag).
- `desk-sheet-check.mjs` and `desk-sheet-leaks.mjs` beyond confirming they write nothing.
- The Greek data under `public/greek/` (the Greek slice's).

## Appendix D: The Notebook panel, shared reader panels, and accessibility (`NB6`, Sonnet)

Checkout read: `C:\Users\bcjoh\GitHub\litbible\.claude\worktrees\desk-audit-6` at `5c9a31a6`. Read-only; no server or browser.
Method: read the diffs of every file in the slice since `60af379e`, read the surrounding code, checked the built `dist/` (built Nov 8) for the desk-off import graph, ran `npm run test:desk` (2422 pass, 0 fail) and the four gate/flyout/first-stage tests.

### Summary

The slice is in good shape. The Audit 3 and 4 fixes I re-checked are all still in the code, and the desk-off cost of the shared code holds: `dist/john-3/` pulls in only `desk-frame`, the gate, and a 14.8 KB `first-stage` chunk (dynamic), and nothing in the static import closure of a shared page reaches `src/scripts/desk/`.
The new risk is the two-stage loading (#491): stage one is a second, thinner desk, and a few things the old single-stage shell got for free (desk.css rules, a load that fails before the reader acts) no longer reach it.
Counts: 0 Critical, 0 High, 2 Medium, 5 Low, 3 Nit (10 findings). One is a regression of an Audit 3 fix (NB3-10), reached only through stage one.
Not confirmed live (no browser): the forced-colors finding and the screen-reader finding are Confidence Low and say what would confirm them.

### Findings

#### NB6-1 · Medium · a11y · REGRESSION NB3-10 · FIXED (2026-11-08)
**Where** `src/scripts/desk/first-stage.js:120-127` (the skip link built in `drawAndWait`); the hiding rule is `src/styles/desk.css:755` (`html[data-desk-show="off"] .skip-link[data-desk-skip]`); the attribute is set only at `src/scripts/desk/panel.js:732`.
**What happens** A keyboard reader who switched "Show the Notebook" off lands on a reading page where nothing is kept (so only stage one loads). Their first Tab stop after "Skip to content" is "Skip to the Notebook". Activating it runs `openWhenUp`, loads the shell, and `panel.open` un-hides the panel they had turned off and writes `lit-desk-panel = "open"`. NB3-10's fix (hide the link while the Notebook is off) lives in `desk.css` and keys on `data-desk-skip`; the stage-one link has neither, and stage one loads only `desk-tab.css`. Once the shell is up the panel's own link replaces this one, so the bug is only on pages where the shell has not loaded, which is every page with an empty notebook.
**Evidence** Read the three files above; `first-stage.js` creates `a.skip-link` with no `data-desk-skip`; the `SETTINGS_EVENT` handler at `first-stage.js:240-255` hides the rail on "off" but never the link; `panel.js:376-384` / `open` confirm the panel opens regardless of the show switch when called this way. `test/desk-first-stage.test.js` has no skip-link case. Same missing attribute also makes `desk-prose-anchor.mjs:39` and `glossary-selection.js:30` (which exclude `[data-desk-skip]` from page text) count the stage-one link's text on the glossary/article pages if those ever anchor there (N11 is off, so no effect today).
**Fix** In `first-stage.js` set `skip.setAttribute("data-desk-skip", "")` and either put the `display:none` rule in `desk-tab.css` (which stage one does load) or toggle `skip.hidden` in the `SETTINGS_EVENT` handler and at start when `state.open === false && show === "off"`. Add a test beside the existing first-stage ones.
**Confidence** High (code-read; the live repro is: `lit-desk-show=off`, empty notebook, Tab twice, Enter).

#### NB6-2 · Medium · usability · NEW · FIXED (2026-11-08) (the residue; standing down is BA29's design)
**Where** `src/scripts/desk/first-stage.js:160-168` (`want`'s `stand`), `src/lib/desk-first-stage.mjs:loadStageTwo`, `src/scripts/desk-frame.js:standDown`.
**What happens** Before #491 the desk's code loaded with the page, so "the chunk is gone" (a deploy while the tab was open; offline) showed up before the reader had done anything. Now the shell loads on the reader's first press. A reader with a tab open across a deploy (Pages serves only the new hashed chunks) presses the Notebook tab and the tab simply vanishes: `stand` runs `rail.destroy()`, `skip.remove()` and `standDown()`, the console gets one line, and nothing is said. Focus was on the pressed tab, so it drops to `<body>`. The Display tray keeps its injected "Show the Notebook / Notes in the margin / My bookmarks / Hide my marks / lettering" rows and key lines (added by stage one's `initNoteSettings`, marked `data-desk` but with no CSS that hides them when `data-desk` is removed), and the H key still answers: controls that do nothing, which BA29 set out to avoid.
**Evidence** Read `loadStageTwo` (any rejection ends in `stand()` and `null`), `want()` (`stand` is the only handler; `busy.removeAttribute("aria-busy")` runs, nothing else), `standDown` (removes attributes, rail and gutters only), and `injectIntoTray` in `note-settings.js` (rows carry `dataset.desk` and nothing removes them). `test/desk-first-stage.test.js` covers `loadStageTwo`'s `stand` call but not what the reader sees.
**Fix** When the press (not the background look) is what failed, keep the tab, take `aria-busy` off, and say so in a status line or the tab's tooltip ("The Notebook didn't load. Reload the page."); retry on the next press (forget the failed import, as `loadDeskSearch` does, GK-14). Move focus to the tab either way. Remove or hide `[data-desk]` tray rows in `standDown` (or have `note-settings.js` export a `teardown`).
**Confidence** High on the code path; the 404-after-deploy trigger is reasoned from how Pages serves hashed chunks, not reproduced.

#### NB6-3 · Low · a11y · NEW (extends DI3-2) · FIXED (2026-11-08)
**Where** `src/scripts/desk/notes-margin.js:497` (`circleElement`), `:510` and `:512` (`flagElement`: `aria-label` and `title`), `src/scripts/desk/tab-mine.js:652` (`drawChanged`).
**What happens** Audit 3's DI3-2 added a "moved" notice ("Words moved") and `flagText()` now says "Wording changed", "Not in the text" or "Words moved" on the inline flag (`notes-margin.js:476`) and the row flag. The margin circle's and mark's accessible names and tooltip were left saying "the wording changed" for every kind, so a screen-reader or tooltip user is told the wrong thing for a lost, moved, whole-verse or reworded notice (`NOTICE_KINDS` in `desk-change.mjs:70`). My Notes' count line likewise says "The wording has changed under N of these" for "moved" notices.
**Evidence** Read `flagText` (`change-notice.js:191`), `changeNotice` (`desk-change.mjs:148`, `moved` with `foundVerse`) and the four hard-coded strings.
**Fix** Build those strings from `flagText(notice)` (lower-cased), as line 476 now does; give `drawChanged` a `moved` count with its own sentence. `flagElement(r)` needs the notice passed in (it gets only the record).
**Confidence** High.

#### NB6-4 · Low · ui · NEW · FIXED (2026-11-08)
**Where** `src/scripts/desk/note-settings.js:335-342` adds `p.font-tray__hint` ("With verse numbers off, select any words…") and the "Reset widths" button (`font-tray__reset`) in stage one; their only styles are `src/styles/desk.css:764` and `:1808-1829`, which stage one does not load.
**What happens** On a Chapter View page with the shell not loaded, the Display tray's hint renders as an ordinary 1em paragraph in full ink with default margins, not the muted 0.8125rem line the design has; it changes look once the shell loads. "Reset widths", when shown, is an unstyled default button. Dark mode and forced colors are unaffected (no colors involved).
**Evidence** Read the two rules and `injectIntoTray`; `desk-tab.css` has neither. The desk CLAUDE.md says the tray works fully in stage one ("the Display tray opened included") without mentioning the styles.
**Fix** Move `.font-tray__hint`, `.font-tray__reset` (and `.desk-panel__reset`'s shared look) into `desk-tab.css`, or into `global.css` beside the other `.font-tray__*` rules; the tray's own styles already live there.
**Confidence** High (CSS read; not seen rendered).

#### NB6-5 · Low · a11y · NEW · needs a Windows contrast theme to confirm · FIXED (2026-11-08)
**Where** `src/styles/desk.css:1242-1270` (`::highlight(desk-hl-yellow|green|blue|pink)`), `:1193` (`desk-note-words`).
**What happens** The reader's highlights on the page are drawn only as a background tint through the CSS Custom Highlight API. The sheet-blank highlight has an underline "so it still shows with the tint taken away (forced colors)" (`desk.css:7411-7418`); the four reader highlights have none and no `forced-colors` rule. If the engine drops the tint for highlight pseudos under forced colors, a reader on a contrast theme sees no highlights at all, and the colors are not exposed to assistive technology either way. BA142 (Audit 1) fixed the swatches in the lists, and BVJ's 2026-10-09 call ("a highlight's color is its tint and nothing else") was made for those samples.
**Evidence** Code read only; I could not emulate forced colors.
**Fix** If confirmed: add `text-decoration: underline dotted` (allowed on `::highlight`) inside `@media (forced-colors: active)` for the four names, or accept it and record it as a known limit. Confirm with DevTools "Emulate forced colors" on a chapter that has a highlight.
**Confidence** Low.

#### NB6-6 · Low · a11y · NEW · needs a screen reader to confirm · FIXED (2026-11-08)
**Where** `src/scripts/verse-image.js:note()` (~line 233) and `swap()`/`fail()` (~lines 178-295); `src/scripts/chapter-tools.js:624-629` (`image.onFail`).
**What happens** NB3-2's fix puts focus back on the Share row after a failed image. The reason ("Too long for an image. Try fewer verses.") is a `role="status"` paragraph created and inserted in the same moment, which many screen readers do not announce, and focus has moved to the Share button, so the keyboard reader hears "Share, button" and not why the image step ended. Desk off and on alike.
**Evidence** Read `swap` (focus goes to the note, then `after(hadFocus)` calls `onFail`, which focuses the Share trigger).
**Fix** Announce through a live region that is already in the panel (one empty `role="status"` rendered with the panel), or put the reason in the Share trigger's `aria-describedby`.
**Confidence** Low.

#### NB6-7 · Low · copy · NEW · FIXED (2026-11-08)
**Where** `src/pages/desk/help.astro:220-221` ("The “Open in the Study Desk” button in the toolbar").
**What happens** #503 dropped "the" from the button ("Open in Study Desk", `ScriptureLayout.astro:230`); line 44 of the same page already says it right, so the page now names the button two ways. A search for the label finds only one because of the line wrap.
**Fix** "The “Open in Study Desk” button". Also stale: the comment at `desk-page.js:1209`.
**Confidence** High.

#### NB6-8 · Low · copy · NEW · NO CHANGE to the wording; a shared sheet now opens on a phone (BVJ, 2026-11-08)
**Where** `src/pages/notebook.astro:32`, `src/pages/desk.astro:48`, `src/pages/sheets.astro:72`.
**What happens** The desk-off message says the preview "isn't switched on in this browser". On a phone or tablet (which the site decided never gets the desk, memory: website study tools are desktop-only) it cannot be switched on, and the reader is sent here by the help page and by shared sheet links. The message suggests a setting that does not exist for them and points to nothing (the apps). Owner call on wording; see Questions.
**Confidence** High on the facts; the copy is the owner's.
**Decision (BVJ, 2026-11-08)** A phone or tablet has no reason to reach a desk page, so the wording stays. The one exception is a shared sheet's link, where anything leading somewhere a phone can't go must be hidden from sighted and screen-reader users alike. Checked: a phone opening a shared link gets only `sheet-share-gate.js`'s "Sheets open on a computer" line and "Copy the link"; the header's Study Desk link and every desk control render only under `html[data-desk]`, which a phone never gets. Nothing to hide today; a phone can't view the shared sheet itself.
**Then (BVJ, 2026-11-08, from a mock, layout A)** a phone or tablet opening a shared link sees the sheet: the Version choice (on a leader share), then Present, Print and Share… in one row that scrolls with the page, and a banner saying a computer is where to keep or change it. Present has no presenter view; the strip is a bar along the bottom, and a tap on the left third goes back while one anywhere else reveals the next blank or goes on. Share… hands the same link to the phone's share sheet. Nothing saves (no Import, Copy, Save as or desk link), and the notebook is never opened. `sheet-share-gate.js` imports `sheet-page.js` dynamically for this alone.

#### NB6-9 · Nit · longevity · NEW · FIXED (2026-11-08)
**Where** `src/styles/desk.css:2758-2767` (`.desk-home-card__options`, `__option`).
**What happens** FU4-1 replaced the two-answer list with a statement, a checkbox and "Got it" (`first-use.js:113-150`); the removed `options`/`option` classes are no longer built anywhere.
**Fix** Delete the dead rules. `grep` finds no other user.
**Confidence** High.

#### NB6-10 · Nit · a11y · NEW · FIXED (2026-11-08)
**Where** `src/scripts/desk/undo-bar.js` (the Undo button after `busy(fresh)`), `src/scripts/desk/panel.js:~500` ("Ask this browser to keep it", class `desk-panel__reset`).
**What happens** NB3-8 swapped `disabled` for `aria-disabled` + `busy()` so focus survives. Only `.desk-np__restore-all` and the title-menu items have an `[aria-disabled="true"]` look (`desk.css:3606`, `:4897`), so a pressed Undo or Ask button looks live for the moment it works. Screen readers hear "dimmed", sighted users get no cue.
**Fix** One shared `button[aria-disabled="true"]:not(...)` rule in `desk.css` (opacity .6, `cursor: progress`).
**Confidence** High.

### Prior fixes re-checked

All confirmed in code unless noted.
- **NB3-1** flyout click after hover: `panel-flyout.js` `openedBy` logic; `test/panel-flyout.test.js` has the cases. Holds.
- **NB3-2** failed image keeps the Share row: `verse-image.js` `fail()`/`onFail`, `chapter-tools.js:624`. Holds (see NB6-6 for the announcement).
- **NB3-3** focus after a margin note moves the pills: `keepPillFocus` in `footnote-pills.js`, called from `notes-margin.js` `markFootnotes`. Holds.
- **NB3-4** help page: `/desk/help/` exists, built, unique ids (checked `dist/desk/help/index.html`: 36 ids, no duplicates, noindex).
- **NB3-5** live count: `data-mine-status` region and `tell()` in `tab-mine.js`. Holds.
- **NB3-6 / LV3-1** Escape in the search field: `panel.js` keydown clears and dispatches `input`; `tab-mine.js`, `kept-list.js`, `search.js` hear `search` and `change`. Holds.
- **NB3-7** `foldedByHide`: `foldingByHide` flag, `panel.js`. Holds.
- **NB3-8** `busy()`/`isBusy()` on Undo, Ask, Restore all: holds (look: NB6-10).
- **NB3-9** `revealPanel` uses `rail.collapse()`: holds.
- **NB3-10** skip link hidden while the Notebook is off: holds in the shell, **REGRESSION in stage one** (NB6-1).
- **NB3-11** menu holds menu items only: `panel-flyout.js` `role="none"` and `aria-describedby` notes. Holds.
- **NB3-12** flyout closes on scroll and outside press: `away` listener, `watching` AbortController. Holds.
- **NB3-13** double Save guard: `saving` flag in `note-editor.js`, released in `finally`. Holds.
- **LV3-3** sheets out of My Notes: `withoutSheets` applied before every count and filter in `tab-mine.js render()`. Holds.
- **LV3-4** tour ends on a showing element: `returnFallback` in `tour-runner.js`/`tour.js` (the panel has `tabIndex = -1`, so the fallback can take focus). Holds.
- **FU4-1** (statement + "Got it"), **FU4-2** (`continueIsHere` in `desk-bookmarks.mjs:332`, passed as `here`), **TR4-1** (search step opens the tray after the card's click, types ">", fires `focusin`): hold. **SEC4-1 / SEC4-2** on `/notebook/` (`q` removed from the address, `partId` guards `decodeURIComponent`): hold.
- **SH5-15** term lens during a drag: `e.buttons` guard plus the selection re-check in the timer (`term-lens.js:293-306`). Holds; a press-and-hold with no movement still opens the card after 350 ms (collapsed selection), which is harmless.
- **Import graph (LG3-4)**: `test/desk-gate-imports.test.js` passes; I also read the built `dist/john-3` scripts' static imports: no desk chunk is statically reachable.

### Improvements

- Tour card (`tour-runner.js go()`): each step ends with `card.focus()`, so a keyboard reader presses Next, then Tabs four times (Skip, Skip part, Back, Next) to press it again. Keeping focus on Next when it was the pressed control would save eight to forty keystrokes per tour.
- The late-arriving rows (stage one's held `lit:panel-actions`): a verse menu or selection panel opened before the shell loads gets the "My Notebook" rows added in place. A sighted reader sees them appear; a screen-reader reader gets no announcement. A polite "My Notebook options added" status would cover it.
- `/desk/help/` is about 480 lines of dense paragraphs (the Sheets section is one long run) with no table of contents; the page's own `#` anchors exist but nothing lists them. A short "On this page" nav (as `/notebook/` has) would help the page the first-use card, tours and foot all link to.
- `panel-flyout.js` arrow handling has no Home/End; add them for parity with the panel's tab row, which has them.
- `tab-mine.js`: `speak = true` is set by `refilter()` and cleared only when `render()` reaches the status line; a render that returns early (no store, superseded `seq`) leaves it set and the next unrelated redraw (another tab's write) speaks a count. Clear it at the early returns.
- `firstSkip.after(skip)` in stage one and `aria-controls="deskPanel"` on the stage-one tab point at an element that does not exist until the shell loads; harmless, but `aria-controls` on a missing id is a validator warning. Drop it from the stage-one tab or add it in `handOver`.

### Questions for the owner

1. Windows contrast themes: should the four highlight colors get a non-color mark (a dotted underline) when forced colors is on, given the 2026-10-09 call that a highlight is "its tint and nothing else"? (NB6-5.)
2. Wording for the desk-off message on `/notebook`, `/desk`, `/sheets` for phones and tablets: keep "isn't switched on in this browser", or say it is for computers and point to the apps? (NB6-8.)
3. When the second stage fails to load after a press, is it acceptable to keep the tab and show a short "didn't load, reload the page" line, rather than standing the page down silently as the old shell did before the reader had acted? (NB6-2.)

### What held up

- Desk-off cost and gating: the static import closure of every shared script, layout, component and page stays out of `src/scripts/desk/`; `desk-gate.js` loads `first-stage.js` dynamically; the built chapter page loads 14.8 KB of desk code (gzip not measured) with nothing kept.
- `peekNotebook`: never creates the database (aborts the upgrade), closes its connection on every path, times out at 3 s into "load the shell", and treats any IndexedDB error as "can't tell, load". BroadcastChannel and `pageshow` re-looks cover another tab's write and the back-forward cache.
- Hand-over from stage one to the shell: `handOver` runs just before `createPanel`, `rail.destroy()` removes its listeners (resize, load, scroll, widths), focus returns to the new tab, held events replay only into the still-open panel. A failure after the hand-over still reaches `standDown`.
- The shared flyout: opens by hover, click or key with the right focus rules, leaves menu items only in the `role="menu"`, closes on scroll or an outside press, never hides with focus inside, passes over disabled and busy items; the 59 unit tests pass.
- Footnote pills: DOM order is now "Add a note" then Pin in all three modes, matching the drawing; the "⋯" stack is `visibility: hidden` when closed, so it is out of the tab order and the accessibility tree; Escape, outside click and focus-out close it.
- Undo bar: focus is restored when the bar closes with focus inside it (`giveFocusBack`, falls back to `#main-content`, which exists); a keyboard Undo that raises a Redo keeps its place.
- First-use card: a labelled section, a real checkbox with its note as description, a "Got it" button, focus to the tab body afterward; the reminder and tour-offer logic is unchanged and covered by tests.
- Term lens: the `pointerover` guard and the delayed re-check of the selection; click-to-open path unchanged.
- `/notebook/` page: `q` is stripped from the address with `replaceState`; a malformed fragment cannot throw; the label form's error is `role="alert"`; headings and the "On this page" nav are sound.
- Dark mode: no new hard-coded colors in the slice's CSS (`desk-tab.css` is all tokens); no `ch` unit use in the new rules I read; focus rings use the global `:focus-visible` or `--focus-ring`.
- Reduced motion: the note and circle transitions, the verse-image fade (`reduceMotion()`), the tour and pins scroll all honor it.

### Not reached

- Anything needing a browser: forced colors, 200% to 400% zoom/reflow of the panel and margin pills, a real screen reader, the late-rows announcement, the 404-after-deploy path in NB6-2.
- `kind-menu.js`, `title-menu.js`, `desk-page.js`, the pane code and the Sheets (other slices); `reading-display.js` beyond its diff stats.
- A full read of `notebook-page.js`'s Save/Open/Delete sections, `kept-list.js`'s row actions, `notebook-search.js`, `bookmark-follow.js` and `highlights.js` beyond the changed lines; the Greek tab (`tab-greek.js`).
- Cross-browser behavior of the `search` event on the My Notes and notebook-page fields (only read).

## Appendix E: The /desk workspace, the Sheets code, and saved files (`DK6`, Sonnet)

Checkout `claude/desk-audit-6` at `5c9a31a6`. Read-only. Scripts are in `...\scratchpad\audit6\dk6\` (`w.mjs`, `w2.mjs`, `kt.mjs`, `lk.mjs`, `lk2.mjs`).

### Summary

The new code from #502 to #505 is in good shape. The model operations (`desk-sheets.mjs`, `desk-sheet-templates.mjs`) are pure and well guarded, and I found no data-integrity or security defect. The file writers (.docx, .odt, .rtf, plus the text and HTML writers) survived hostile and awkward documents with no malformed XML, no unbalanced RTF braces, and no control characters or lone surrogates in the output. The 531 tests in the nine files for this slice pass. The findings are almost all in the new gap-pill UI and the leak check: a floating menu with no scroll, destroy or redraw handling, an unbounded Tab-stop count, and a quadratic leak check.

Counts: 0 Critical, 0 High, 3 Medium, 5 Low, 2 Nit. The Medium items are a11y, usability and performance, not data loss.

### Findings

#### DK6-1 · Medium · a11y · NEW · FIXED (BVJ's decision, 2026-11-08)
**Where** `src/scripts/desk/sheet-pane.js:1146-1153` (`buildCard`, the `.desk-sheet__after` zone and pill), `src/styles/desk.css:7097-7126` (`.desk-sheet__after-btn`, `opacity: 0`).
**What happens** Every card gets its own "+ Add" pill. The pill is `opacity: 0` rather than `display: none`, so each one is a permanent Tab stop. On a 300-part sheet a keyboard user crosses 300 extra invisible stops on top of each card's own controls (Move up, Move down, Remove, minutes, Leader only, and the editor). Each stop is announced to a screen reader as "Add a part after X, menu button". Only the focused one becomes visible, so sighted keyboard users get a good signal. Screen-reader users get a list of 300 identical-purpose buttons and no roving or skip mechanism.
**Evidence** Code and CSS read. `buildCard` appends the zone with a real `<button>` for every module, with no `tabindex=-1` and no roving arrangement.
**Decision and fix (BVJ, 2026-11-08)** the roving group. The pills are one Tab stop per sheet (the last focused, else the first part's; `syncGapStop`), up and down arrows, Home and End move between them, a visually hidden line describes the keys, and the help page gives the keyboard route.
**Fix** Make the pills a roving group per list (one tab stop, arrow keys between gaps), or at least give each card one "Add after this part" entry in its existing tools menu and keep the pill for pointer use (`tabindex="-1"`). Whichever is chosen, put the keyboard route in the help page.
**Confidence** High.

#### DK6-2 · Medium · bug · NEW · FIXED (2026-11-08)
**Where** `src/scripts/desk/sheet-pane.js:1380-1470` (`openInsertMenu`), `:1887-1903` (`destroy`).
**What happens** The gap menu is appended to `document.body` as `position: fixed` and positioned once. It has no scroll or resize listener (the pane menus in `kind-menu.js` close on any scroll or resize, per the design record), and `destroy()` and `draw()` know nothing about it.
- Scrolling the pane with the wheel while the menu is open leaves the menu floating at its old position, detached from its pill. Mouse wheel does not trigger `outside` (which listens to `pointerdown` only).
- If the pane is destroyed while the menu is open (a layout change, closing the pane, "Reset"), the menu element stays in `<body>` and the capture-phase `document` `pointerdown` listener is leaked until the next click.
- If the card that owns the pill is removed or redrawn (undo, another tab's save, Remove on that card), the menu stays open pointing at a detached `button`. Picking an item then adds the part at the end (`where()` falls back to `insertIndex`), and `openInlinePassage` returns silently with no form and no message because `cards.get(m.id)` is gone.
**Evidence** Read the whole function. There is no `scroll`/`resize` handler, no registration in `cards` or `insertForm`, and `destroy()` lacks any `close`.
**Fix** Close on `scroll` (capture) and `resize`, hold the open menu's `close` in a pane-level variable that `destroy()`, `showList()`, `setSheet` and `draw()` (when the owner card goes) call, and make `openInlinePassage` announce when its card is missing.
**Confidence** High on the scroll and destroy leaks (code-read); Medium on the undo-while-open path.

#### DK6-3 · Medium · performance · NEW · FIXED (2026-11-08)
**Where** `src/lib/desk-sheet-leaks.mjs:30-35, 62-72` (`containsPhrase`, `findLeaks`), called from `src/scripts/desk/sheet-copy.js:521` (`copyLeaks`).
**What happens** `containsPhrase(text, phrase)` re-tokenizes (`foldDiacritics`, lower-case, split) the whole surface text for every blank, so cost is blanks × surface size × surfaces. `findLeaks` is synchronous on the main thread and runs on each draw of the participant version on /sheets.
**Evidence** `lk2.mjs`: 40 blanks × 20 surfaces × 1.5 KB = 15 ms; 100 × 60 × 3 KB = 158 ms; 200 × 300 × 2 KB = 1.1 s; 200 × 300 × 10 KB = 5.9 s (`lk.mjs`). Real sheets sit at the small end, so this is a degradation for the big-sheet case only, but the fix is trivial.
**Fix** Tokenize each surface once (a `Set` of tokens plus the token array for phrase runs) and each blank phrase once, then compare. Optionally prefilter a surface with a Set of the first word of each phrase.
**Confidence** High (measured).

#### DK6-4 · Low · bug · NEW · FIXED (2026-11-08)
**Where** `src/lib/desk-sheet-leaks.mjs:30-35` (`tokens`), using `foldDiacritics` from `word-stem.mjs`.
**What happens** Hebrew points (niqqud) are combining marks that `\p{L}` does not match, and `foldDiacritics` does not remove them, so pointed Hebrew is split into fragments (`"שָׁלוֹם"` tokenizes to `["ש","לו","ם"]`). A blank on pointed Hebrew is therefore flagged only against text with the identical pointing. Unpointed "שלום" in a question or title is not flagged against a pointed blank, and the reverse. Greek is fine either way (NFC and NFD both matched).
**Evidence** `lk.mjs`: pointed vs pointed true; pointed blank vs unpointed text false; unpointed blank vs pointed text false.
**Fix** Strip `\p{Mn}` after NFD in `tokens` (for Hebrew points and Greek accents together), or make `\p{M}` part of the token class.
**Confidence** High.

#### DK6-5 · Low · bug · NEW · FIXED (2026-11-08)
**Where** `src/lib/desk-sheet-leaks.mjs:62-72` (`findLeaks`) vs `src/lib/desk-sheet-lit.mjs:359-394` (`blankWords`, `blanksGivenAway`).
**What happens** SH5-16 widened the footnote give-away flag with the blank's `telltale` (the term's traditional word), but the "what prints" check holds title, subtitle, text and question surfaces against `b.exact` only. A footnote naming "flesh" beside a blank on "self-preservation" is flagged; a question or title naming "flesh" is not, though it hands the same answer over when the hint is "No hint". The module header says the two checks "can't disagree"; for these surfaces they do.
**Evidence** Read: `findLeaks` passes `b.telltale` only into the footnote branch.
**Fix** Run `containsPhrase(s.text, b.telltale)` for the text surfaces too, with a sentence that names the traditional word, or record in the header that it is deliberately footnotes-only.
**Confidence** High.

#### DK6-6 · Low · usability · NEW · FIXED (2026-11-08)
**Where** `src/lib/desk-sheet-share.mjs:156-163` (`plainModule`).
**What happens** A participant share drops `minutes` but keeps `prompt` and `answerPrompt` on every part that survives. Those are the author's ghost prompts ("How you will begin: a welcome, a prayer…"), written for the leader. The recipient imports the sheet and sees them as dimmed prompts on a sheet they did not make, and the link carries up to 200 characters per part more than needed. `answerPrompt` ("It prints only on the leader's version") rides along on every question although the answer is emptied.
**Evidence** Read; `sheetFromShared` copies every non-DROP key.
**Fix** For `scope === "participant"` delete `prompt` and `answerPrompt` (leader scope keeps them). Decide whether a leader share should keep them too, since prompts are the template's, not the leader's content.
**Confidence** Medium (the owner may want prompts to travel).

#### DK6-7 · Low · usability · NEW · FIXED (2026-11-08)
**Where** `src/scripts/desk/sheet-pane.js:398-402` (`change`, `made.refused` branch).
**What happens** Any refusal other than the 300-part limit gets "That change couldn't be made, so the sheet is as it was. Reload the page, then try again." The pill menu's key terms entry is only disabled when the box exists in this tab's copy, so if another tab added one meanwhile, `addModule` throws "at most one key terms module" and the leader is told to reload, which does not help.
**Evidence** Read; `desk-sheets.mjs:addModule` throws that message and the regexp matches only `holds at most \d+ modules`.
**Fix** Map the key terms message to "A sheet has one key terms box, and it has one already."
**Confidence** Medium.

#### DK6-8 · Low · usability · NEW · FIXED (2026-11-08)
**Where** `src/lib/desk-sheets.mjs:146-170` (`sheetFromTemplate`, `templateFromSheet`), `src/lib/desk-sheets.mjs:105-125` (`duplicateSheet`).
**What happens** (a) `duplicateSheet` of one of the reader's templates keeps `isTemplate: true` and titles it "… (copy)", so Duplicate on a template (if reachable through any list) yields another template; confirmed in `kt.mjs`. I could not find a UI path that does it (My templates offers open and delete), so this is latent. (b) `sheetFromTemplate` does not check `isOwnTemplate`, so a caller can start a sheet "from" any sheet; the doc comment says the argument is "a record isOwnTemplate accepts" but nothing enforces it. (c) A template made from a sheet with only passages has zero parts; a sheet started from it has `modules: []` (no empty text part, unlike Blank), so the leader gets an empty parts list with only the add bar.
**Evidence** `kt.mjs` output: `tpl modules 0 true`, `new from empty tpl 0`, `dup keeps isTemplate: true`.
**Fix** (c) is the only one a user can meet: offer an empty text part when `modules` comes out empty, or refuse "Save as template" with a note when no part remains. (a) and (b): strip `isTemplate` in `duplicateSheet`, assert `isOwnTemplate` in `sheetFromTemplate`.
**Confidence** High on the facts; Low on user reach.

#### DK6-9 · Nit · copy · NEW · FIXED (2026-11-08)
**Where** `src/scripts/desk/sheet-pane.js:590` comment "after the built-in five" (there are seven); `src/lib/desk-sheet-templates.mjs` header still says nothing of own templates.
**Fix** Update the comments.

#### DK6-10 · Nit · longevity · NEW · FIXED (2026-11-08)
**Where** `src/scripts/desk/title-menu.js:340-357` (`startNewSheet`) and `sheet-pane.js:1870-1885` (`onNewSheet`).
**What happens** The Sheets pane answers `desk:sheet-new` by `paneId`; the event is dispatched right after `commit(next)`. This works because the pane registers its listener synchronously at build, but nothing documents or tests the ordering, so a later change that draws panes asynchronously (lazy pane modules, as for This verse and Greek) would drop the event silently, and the leader would see the list without the chooser open. A hold-and-replay like the one `lazyTab` uses would remove the dependency.
**Confidence** Low (no failure today).

### Prior fixes re-checked

- DK3-1 (a paragraph too long for a slide is cut after a sentence): `desk-slides.test.js` passes; the cutter is present in `desk-slides.mjs`.
- DK3-2 (leaving Reading by any way restores its marks): `leavesReading` is still run in `commit`; `desk-layout.test.js` passes.
- DK3-5 (`sup` for the reader's own superscript, not a footnote letter): `sup` is handled in `docRuns` and the three writers; `w.mjs` fed one without error.
- DK3-7 (arrows pass over disabled menu items): the new gap menu does not do this. Its only disabled item is "Key terms box"; it is `aria-disabled` but is kept in `items`, so ArrowDown/Up and Home/End **land on it**, contrary to the stated rule ("In every menu... the arrow keys, Home and End pass over a disabled item"). See DK6-11.
- SH5-1 (menu close re-entry via blur): the `closed` flag is present in `openInsertMenu`; the pick runs.
- SH5-2/SH5-4 (prompts never print, copy, present or count): `prompt`/`answerPrompt` are validated as plain text of at most 200 characters (`promptOk`) and are absent from `desk-sheet-copy`, `desk-present` and the three file writers' inputs (the writers read the DOM model, not modules).
- SH5-3, BA69 (passage insert position): `insertIndex`/`passageInsertIndex` behave as documented; `addPassage` falls back correctly when its `target.after` is gone.
- SH5-16 (telltale): present and correct for footnotes (see DK6-5 for the other surfaces).
- DI3-6 (a sanitizer drift does not freeze a sheet): `planSheetChange` still edits `cleanSheetText(current)`; `desk-sheets.test.js` passes.

#### DK6-11 · Low · a11y · REGRESSION DK3-7 · FIXED (2026-11-08)
**Where** `src/scripts/desk/sheet-pane.js:1396-1445` (`openInsertMenu`: `item(..., { disabled })`, the `keydown` handler, and the initial `items[0].focus()`).
**What happens** The new menu is a desk menu and breaks the rule BVJ set on 2026-11-07: arrows, Home and End must pass over a disabled item, and opening focuses the first enabled one. Here "Key terms box" (disabled once the sheet has one) is in `items`, so ArrowDown from "Page break" lands on it and Home/End can land on it too. Its reason is attached via `aria-describedby` on the item only, not as the menu's description, so a screen-reader user who skips it never hears the reason (`describeUnavailable` in `menu-reasons.js` is the shared mechanism).
**Evidence** Read: `items.push(b)` for every item; navigation indexes into `items` without filtering `aria-disabled`.
**Fix** Filter `items` by `aria-disabled !== "true"` when moving, and use `describeUnavailable` for the menu.
**Confidence** High.

### Improvements

- Share the "pick the part to add" list between the add bar and the gap menu (they are two copies of the same six entries); a drift like the one in DK6-11 is easier with two lists.
- `findLeaks` could return which surface kind caused each leak so the notice can say "in the title" vs "in a footnote" with different advice.
- A word on `/desk/help` for the pill's keyboard route once DK6-1 is decided.
- `moduleMinutes` silently ignores out-of-range stored values; the format validator rejects them, so a hostile sheet can't reach it, but a one-line comment would say why both exist.

### Questions for the owner

1. Should a participant share carry the template prompts (DK6-6)? They look like the author's working notes to a recipient.
2. Is the 300-pill tab order acceptable for version 1 (DK6-1), given desktop-only, or should the keyboard route be one control per list?
3. Should the "what prints" check stay silent on the traditional word in a question or title (DK6-5), or is footnotes-only intended?

### What held up

- **File writers** (`w.mjs`, `w2.mjs`): empty doc, 12-deep nested lists with empty innermost list, list items with no inlines, empty `box` and `quote`, `lines` count 0 and 100000, links with `&` and quotes, control characters (NUL, 0x08, 0x0B), lone surrogates, U+FFFE/U+FFFF, U+2028, an emoji, Greek and Hebrew with points mixed with Latin and blanks. Every XML part of .docx and .odt parsed with the repo's strict reader; output contained no control chars, no lone surrogates, no U+FFFE/F; RTF braces balanced (counting escapes) and the text ASCII-only, with non-BMP and lone surrogates escaped as `\uN?`. `docText` and `docHtml` did not throw on any of them.
- **Key terms placement** (`kt.mjs`): 20,000 random sheets (passages, a Reading heading, spaces, page breaks); for 16,677 with a box and a reading, `moveModule` to `before` and `after` always yields the matching `side`. Empty and null sheets return null.
- **Templates**: all seven build fresh ids per call; `templateFromSheet` drops passages only; `sheetFromTemplate` drops `isTemplate`; own templates are filtered from every other sheet list I could find (`search-sheet.js:301`, `sheet-page.js:214`, `sheet-pane.js:501`), and a share (`sharedSheet`) never carries `isTemplate`.
- **Limits**: `addModule` refuses the 301st part and a second key terms box; the pane maps the first to a clear sentence.
- **Insert-at-gap state**: after undo or removal, `lastModule` points to a missing id, `insertIndex` falls back to the end, and `addPassage`'s `target.after` falls back the same way. Sequential `await me.addPassage` keeps the target moving in order.
- **Minutes**: field saved on `change` (not per keystroke), range-checked, rounded, cleared with `undefined` (the `same` helper treats absent and undefined alike so no spurious write), `plannedTotal` includes leader-only parts and is shown only on the leader's version and presenter view; participant shares delete it.
- **Present**: `stepState` blank semantics (first press returns the screen, second steps), `checkState` clamps hostile state, keys with Ctrl/Alt/Cmd are the browser's.
- **Answer key**: handled in `readCopy` (`sheet-word.js:194`) so Copy and every file carry it.
- **Rename**: no user-visible "Sheet pane" text remains after the rename to "Sheets".
- **Tests**: `desk-layout`, `desk-sheets`, `desk-sheet-templates`, `desk-present`, `desk-sheet-leaks`, `desk-sheet-doc`, `desk-slides`, `desk-sheet-share`, `desk-sheet-prompts`: 531 pass, 0 fail.

### Not reached

- `desk-page.js` and the modules split from `start()` (pane menu, title menu) beyond `startNewSheet`: not read in depth; `desk-layout.mjs` only through its tests and the diff of #504 (the new kind order and "Sheets" label).
- The .pptx/.odp writers were not fuzzed (only their tests were run); the .docx/.odt/.rtf/text/HTML writers were.
- Print CSS for `/sheets`, the presenter view's window handling, and live behavior of the gap pill's hover zone (the z-index strip overlaps 6px of each neighbor's padding; could not check hit-testing without a browser).
- `sheet-text.js` paste handling and the `/sheets/` page's share/import flow beyond `desk-sheet-share.mjs`.

## Appendix F: The Greek tab, Greek search, and the Greek data (`GK6`, Sonnet)

Checkout `claude/desk-audit-6` @ `5c9a31a6`. Read-only. Throwaway scripts: `C:\Users\bcjoh\AppData\Local\Temp\claude\C--Users-bcjoh-GitHub-litbible\7d300a9f-94db-4c39-856c-24bfb6d06c89\scratchpad\audit6\gk6\` (`h.mjs` is a fetch-from-disk harness that imports the real `src/` modules; `a1` data vs text, `b1` brute-force constructions, `c1` Unicode variants, `d1` builder round trip, `e1/e2` lexicon HTML, `f1` hostile queries, `g1` load failure, `i1` translit/Strong's/gloss, `j1` timing, `l1/h2` bridge).

### Summary

The slice is in good shape. The committed data is exactly the text: 5,465 lemmas, 137,793 words (the one `lemma: -1` word, John 8:5 Μωσῆς, is the documented gap), every lemma count, shard entry, form list and all 57 parse groups agree with an independent rebuild from `public/greek/text/` (`a1.mjs`, 0 mismatches). Search matches an independent brute-force matcher on 2,000 random constructions (1 to 4 words, filters, `/` alternatives, five gap settings, any order, book filter): the only differences are the deliberate narrow fallback (`b1.mjs`). All 17 Audit 3 GK3 fixes and the Q1 fallback are still in the code and tested (248 Greek tests pass).
New problems are small. Counts: 0 Critical, 0 High, 2 Medium, 5 Low, 3 Nit (10 findings). One is an incomplete earlier fix (GK3-9's load-failure wording still wrong on two of four surfaces); one is a licensing-notice gap at the repo root, not in `public/greek/`.
Performance is fine: broadest queries (`*.sg`, four-term any-order `*.noun`) take 25 to 160 ms in Node; `lemmas.json` is 222 KB gzipped, all 57 parse groups 604 KB gzipped.

### Findings

#### GK6-1 · Medium · bug · NEW (incomplete GK3-9) · FIXED (2026-11-08)
**Where** `src/scripts/search-greek.js:~165-170` (`searchGreek`: `if (!index) return empty;`); consumers `src/scripts/searchbar.js:~980-1040` (tray) and `src/scripts/search.js:~1025-1035` (`writeGreekStatus`); compare `desk/greek-find.js:223` and `desk/search-pane.js:1085`, which re-probe `loadGreekIndex`.
**What happens** A reader with the desk on types a single Greek word (or Strong's number) in the search tray or on /search while `lemmas.json` can't load (offline, a 503, the lazy chunk failing). `searchGreek` returns the "empty" shape with `failed: false`, so both surfaces say "No Greek words match." (/search: "No Greek words match “πίστις.”") with no Try again. The reader concludes the word is not Greek. The commands path does it right (`failed: true`, "The Greek search couldn't be loaded." and Try again), and the Greek tab and Search pane work around the single-word case by asking `loadGreekIndex` again. Audit 3's GK3-9 fix says "/search, the tray and the Search pane read `res.failed`", but `failed` is only set for a shard, not for the index. The same wrong status appears if the `search-greek.js` module itself fails to import (`withGreek()` resolves null, `.catch(() => null)`).
**Evidence** `g1.mjs` with `lemmas.json` returning 503: `searchGreekAuto("πίστις")` gives `{kind:null, lemmas:0, failed:false}`; `"πίστις.gen"` gives `{kind:"commands", failed:true}`; `"pistis christos"` gives `failed:true`. Code read of the two surfaces confirms the single-word branch shows "No Greek words match."
**Fix** Have `searchGreek` return `failed: true` when `loadGreekIndex` is null (one line), and let the tray and /search treat a null result from `withGreek()` as failed. Then the probes in `greek-find.js` and `search-pane.js` can go. Add the `g1.mjs` case to `test/search-greek-auto.test.js`.
**Confidence** High.

#### GK6-2 · Medium · docs · NEW · FIXED (BVJ's decision, 2026-11-08)
**Where** `LICENSE:30-33` ("Everything not listed above is SOFTWARE under the MIT License"), against `public/greek/LICENSE.txt` and `src/lib/greek-credits.mjs`.
**What happens** The root license has two classes, MIT software and CC BY-NC-ND content, and sweeps everything else into MIT. That literally covers `public/greek/` (about 41 MB of third-party data: SBLGNT CC BY, MorphGNT CC BY-SA 3.0 and derived `text/` CC BY-SA 4.0, UBS CC BY-SA 4.0, `lsj/` and `(ML)` entries CC BY-SA 4.0 from Perseus, STEP CC BY 4.0), `public/fonts/text-critical-signs.otf` (OFL, derived from Cardo; its notice is `public/fonts/text-critical-signs-OFL.txt`), and the glossary bridge. Someone reusing the repo under "MIT" would take ShareAlike data without its terms. The per-directory `LICENSE.txt` is correct; nothing at the root points to it. This is the attribution surface that matters for a public GitHub repo, which is separate from the site's credit lines.
**Evidence** Read `LICENSE` in full: no mention of `public/greek`, SBLGNT, CC BY-SA, OFL or any third-party material (`grep -n -i "third\|SBLGNT\|OFL\|public/" LICENSE` returns nothing).
**Fix** Add a third class to `LICENSE`: "THIRD-PARTY DATA AND FONTS, under their own licenses: `public/greek/` (see `public/greek/LICENSE.txt`), `public/fonts/text-critical-signs.otf` (SIL OFL 1.1, see its notice), the `@fontsource` faces, `src/data/alignment/`'s MorphGNT-derived fields if any," and say the MIT grant does not extend to them. Owner (BVJ) to approve the wording.
**Confidence** High on the text; whether a lawyer wants more is not for me.
**Decision and fix (BVJ, 2026-11-08)** made. `LICENSE` gains a third class, OTHER MATERIAL, outside both grants: `public/greek/` (its `LICENSE.txt` governs), the Greek words quoted in `src/data/alignment-words/`, the two subset fonts and the share-card fonts (OFL 1.1, each with its notice; `public/fonts/bracket-markers-OFL.txt` is new, since nothing carried Noto Sans Math's notice), the podcast feed snapshot, and the site's images; npm packages keep their own licenses. `CONTRIBUTING.md` says so in a sentence. The stock images had no credit record in the repo (see the image credits). The two subset fonts' name tables carried no copyright; both generators now copy the source's copyright and license into it, and both fonts were regenerated (2026-11-08).

#### GK6-3 · Low · usability · NEW · FIXED (2026-11-08)
**Where** `src/lib/greek-search.mjs:69-79` (`foldGreek`), consumed by `matchGreek`.
**What happens** Iota adscript is not folded. A dative typed or pasted in capitals the traditional way, `ΘΕΩΙ`, `ΤΩΙ`, `ΚΑΙΡΩΙ`, folds to `θεωι` and finds nothing, while `θεῷ` and `ΘΕΩ` work. About 100 of the 19,414 (lemma, form) pairs are ᾳ/ῃ/ῳ forms. All-caps Greek is exactly how the SBLGNT's own titles and many printed headings are set. The reader sees "No Greek word matches" and no hint.
**Evidence** `m1.mjs`: `ΘΕΩΙ`, `ΚΑΙΡΩΙ`, `ΤΩΙ` give 0 lemmas; `c1.mjs` `upper` variant: 103 pairs fail (JS `toUpperCase` of ῳ gives ΩΙ, the same shape).
**Fix** In `matchGreek` only, when a Greek word finds nothing and ends in αι/ηι/ωι, retry without the final ι (after checking the fold lookups, so `καί` is unaffected). Keep `foldGreek` itself, since the build uses it for the index.
**Confidence** High.

#### GK6-4 · Low · usability · NEW · FIXED (2026-11-08)
**Where** `src/lib/greek-search.mjs:69-79` (`NOT_GREEK` strips every non-α-ω character), `matchGreek:~363-375`.
**What happens** Anything not a Greek letter inside a Greek-looking word is silently dropped, so the search is for a different word than the one typed, and nothing says so. `πίστις;gen` (semicolon for the dot) and `πίστις-gen` search plain πίστις (243 results, filter lost); `λόγοςx` finds λόγος; `µετά` with the Latin-1 micro sign U+00B5 (what some PDFs and word processors give for μ) folds to `ετα` and finds nothing; a Latin `s` or `o` for a Greek letter does the same (`πίστιs` is `πιστι`, no match). The no-match message echoes the typed word, which looks right to the reader.
**Evidence** `c1.mjs` odd-character block and `f1.mjs`.
**Fix** Cheap and safe: map U+00B5 to μ in `COMPAT`. For the rest, when a Greek query contains Latin letters or non-Greek letters beyond edge punctuation, say "Searched for πιστι; letters that aren't Greek were left out." or treat the query as no match.
**Confidence** High.

#### GK6-5 · Low · usability · NEW · FIXED (2026-11-08)
**Where** `src/lib/greek-search.mjs:~395` (`if (!qWords.length || qWords.length > 3) return none`) against `public/search/greek-bridge.json`.
**What happens** Five of the 274 LIT renderings in the glossary bridge have four words once hyphens split, so typing the LIT's own phrase finds nothing: "violation of marriage covenant", "pronouncement of well-being", "a cause of hardship", "the place of the dead", "hold us in suspense". They are in the bridge, counted and built, but unreachable by the field that is meant to reach them.
**Evidence** `h2.mjs`: 260 of 265 sampled renderings resolve; the five that don't are exactly these. Counted over all 274 renderings in a one-liner.
**Fix** In `matchGreek`, allow up to the longest rendering's word count when `bridge.byPhrase.has(phrase)`; or look up the bridge before the 3-word cut.
**Confidence** High.

#### GK6-6 · Low · bug · KNOWN-OPEN (Audit 3 improvement, search-greek.js) · FIXED (2026-11-08, #507: `loadGreekEntry` reports a failed shard)
**Where** `src/scripts/search-greek.js:~188-201` (`searchGreek`, the `lemmas.filter((l) => l.lit?.counted > 0)` step) and `loadGreekOccurrences:~126`.
**What happens** A Latin phrase that reaches lemmas through a LIT rendering counts each lemma's occurrences in the rendering's verses. If a shard fails to load, `loadGreekOccurrences` returns null, the count is 0, and the lemma is dropped as "never occurs there", so a transient network failure reads as "No Greek words match", not "couldn't load". Same family as GK6-1; it was listed as an improvement in Audit 3 and is unchanged.
**Evidence** Code read (`decodeOccurrences(null)` returns `[]`). Not run: needs a shard failure on a bridge query.
**Fix** Have `loadGreekOccurrences` distinguish "no such entry" from "failed" (throw or return a sentinel), and set `failed` on the result.
**Confidence** Medium.

#### GK6-7 · Low · bug · NEW · FIXED (2026-11-08)
**Where** `src/scripts/greek-builder.js:~129-165` (`load`, `info` Map, `infoFor`).
**What happens** A Latin word typed in a card is resolved with the glossary bridge (`needsBridge`). If the bridge fetch fails once, `loadGreekBridge` returns null, `resolveCard` runs without it, a LIT-only phrase such as "self-preservation" comes back `unknown`, and `info.set(key, entry)` keeps that verdict for the life of the window (only `status === "failed"` is retried). The card says "No Greek word matches" and the announcement repeats it, although the same query in the field would resolve on the next search.
**Evidence** Code read; `infoFor` only re-asks `failed`. Not run in a browser.
**Fix** In `load`, when `needsBridge(words)` and the bridge came back null, set `entry.status = "failed"` (retried on the next draw) instead of resolving without it.
**Confidence** Medium.

#### GK6-8 · Low · a11y · NEW · FIXED (2026-11-08)
**Where** `src/scripts/float-window.js:~120-126` (the window's `keydown` Escape handler).
**What happens** Escape closes the Greek search commands window without checking `e.isComposing`. In the builder's word box, a reader composing a polytonic letter with a dead key or an IME who presses Escape to cancel the composition closes the whole window, loses the card, and `compositionend` never draws. The builder deliberately handles `compositionstart/end`, so the case is expected to occur.
**Evidence** Code read of both. Not run (needs an IME).
**Fix** `if (e.key !== "Escape" || e.isComposing) return;`.
**Confidence** Medium.

#### GK6-9 · Low · longevity · NEW · FIXED (2026-11-08: every search file carries `build`, and a mismatch is fetched again from the server)
**Where** `public/_headers:72` (`/greek/*` cached a day, `must-revalidate`), `src/scripts/search-greek.js` (`loadGreekIndex`, `loadGreekOccurrences`, `loadGreekParseGroup`).
**What happens** A lemma's id is its position in `lemmas.json`, and the shards and parse groups store those ids. After a `build:greek` re-run (a source updated, a lemma added) a returning reader can hold the old `lemmas.json` and fetch new shards, or the reverse, for up to a day; nothing checks. The result is the wrong word's verses under a lemma, with no error. BVJ chose the day (GK-9), so this is only the missing guard.
**Evidence** Header file and loaders read; no stamp or format/hash check ties the files. Not reproduced.
**Fix** Put a `build` stamp (the generator's date or a content hash) in `lemmas.json`, each shard and `parse.json`, and treat a mismatch as `failed`; or cache-bust with `?v=<stamp>` on the fetches.
**Confidence** Medium.
**Fixed (2026-11-08)** `build:greek` writes `build`, a 12-character hash of the whole search output, into `lemmas.json`, each shard, `parse.json` and each parse group (a rerun with nothing new keeps it, so nothing is rewritten). `search-greek.js` reads a shard, `parse.json` or a parse group only when its `build` is the index's (`sameBuild`); otherwise it counts the file as not loaded, the next load of the index drops every file the page holds and fetches each with `cache: "no-cache"` (a bodiless 304 where nothing changed), and the search runs once more (`freshGreek`). A mismatch that persists, a deploy still arriving, is reported as a failure, and the next search tries again. A lemma chosen from a list drawn before such a refetch is matched against the same query's new list, so at worst another of that query's own lemmas is shown, under its own name. Tests: `greek-audit6.test.js` (a stale shard, a stale index, a stale parse group, a mismatch that stays) and `greek-search.test.js` (every committed file carries the index's stamp).

#### GK6-10 · Nit · bug · NEW · FIXED (2026-11-08)
**Where** `src/lib/greek-query.mjs:~175-215` (`LITERAL = "\u0001"`, `keep`, and the `literals[Number(head.slice(1))]` reads).
**What happens** The private sentinel for a quoted word is U+0001, which a pasted query can contain. `\u0001.gen` or `\u00010, πίστις` produces a term whose `words` is `[undefined]`, the message "No Greek word matches “undefined.”", and a builder card that writes as `.gen`. Not reachable by typing.
**Evidence** `f1.mjs`, `k1.mjs`.
**Fix** Strip control characters from the query first, or use a sentinel that the input is sanitized against.
**Confidence** High.

#### GK6-11 · Nit · copy · NEW · FIXED (2026-11-08)
**Where** `src/lib/greek-builder.mjs:~88-95` (`cannotSay`, case `"error"`) with `greek-query.mjs` `errorMessage` `tooLong`.
**What happens** A 300-plus-character search in the builder reads "…so it wasn't searched. Shorten it in the field. Fix it in the field, or start a new search here." Two sentences say the same thing.
**Evidence** `k1.mjs` output.
**Fix** For `tooLong`, return only `errorMessage(...).text` plus "Or start a new search here."
**Confidence** High.

#### GK6-12 · Nit · bug · NEW · FIXED (2026-11-08)
**Where** `src/lib/greek-builder.mjs:~108-115` (`needsQuotes`, `writeCard`).
**What happens** A quoted word that holds `.`, `/`, `*` or `=` is read into a card but written back without quotes (`"a.b"` becomes `a.b`, which re-reads as an error; `"*"` becomes `*`, any word). Greek words never hold these, so only a hand-typed field can do it.
**Evidence** `d1.mjs` round-trip fuzz (30,000 queries; after normalizing filter order and ignoring dropped empty cards, the only differences were these and a dangling "or" case); `k1.mjs`.
**Fix** Add the notation's symbols to `needsQuotes`.
**Confidence** High.

### Prior fixes re-checked

Audit 3 GK3 (session 4, PR #485) and Q1; all still in the code, all hold unless noted.
- GK3-1 holds: `desk-greek__show-sources` in `tab-greek.js:~139` and `desk.css:4392-4408`; `.desk-greek__sources` is the credit block only (`desk.css:4015`); `test/greek-audit3.test.js` guards class reuse.
- GK3-2 holds: `makeWordBox` makes the input once; `drawCard` replaces only `top` and `rest`; `syncWordBox` keeps the caret.
- GK3-3 holds: `global.css` `@media (forced-colors: active)` for pressed chip, "only" chip and ×; the Greek tab's `.desk-greek__show-sources[aria-pressed]` rule at `desk.css:6736`.
- GK3-4 and GK3-5 hold: `load` fetches the bridge when `needsBridge`; `readBuilder` reads two or three plain Latin words (`plain: true`). (GK6-7 is a gap in the first.)
- GK3-6 holds: `greekOfferFor` goes through `Object.create(null)` and `Object.hasOwn`; `constructor`, `__proto__`, `toString`, `hasOwnProperty` search without an offer (`f1.mjs`).
- GK3-7 holds: 300-character `tooLong` error, no cut, on every surface (`f1.mjs`, `j1.mjs`: 6,000 random 250-300 character strings, 0 throws, worst 2.5 ms).
- GK3-8, GK3-10, GK3-11, GK3-12, GK3-14, GK3-15, GK3-17 hold by code read (`appendLang` on the cite, `aria-pressed` alone; `speakLookup`; `LEXICON_PAUSE` only for arrow keys; `plainTextOf`; `loadGreekOffers` forgets a failure; `readCardText` notes; no `title` on chips).
- GK3-9 is incomplete: see GK6-1 (index and module load failures) and GK6-6 (shard failure for a LIT-rendered lemma).
- GK3-13 holds: `findNote` is one permanent `role="status"` element and says "Opening the Greek search…".
- Q1 narrow fallback holds and is the only source of difference between the engine and my brute force (`ἴδε.pl.2nd`, `ταχύ.nom`, `χάριν…`, all judged on the whole text).
- Audit 2 GK items spot-checked: GK-1 (all 19,414 lemma/form pairs found by their lemma, `c1.mjs`, 0 miss in NFC, NFD, lower, bare, lunate, final-sigma, punctuation, NBSP and zero-width variants; only the caps-iota case in GK6-3 differs), GK-5 (NFC vs NFD fold identically, 0 of 19,414 differ), GK-7, GK-9, GK-14, GK-15, GK-20 hold.

### Improvements

- The "Sources and licenses" block sits under the whole chapter's Greek, so a reader looking at an LSJ or UBS entry must scroll the text to the end to find who it is from. A one-line "From Perseus (CC BY-SA)" under each entry would put the credit where the text is.
- `SEARCH_CREDIT` omits Perseus although 25 search glosses are treated as CC BY-SA from Perseus (`LICENSE.txt` says so); the "licenses" link covers it, but the line says "glosses: UBS and STEP Bible".
- The "licenses" link and the tab's "the license note" open `/greek/LICENSE.txt` in the same tab, replacing the search results or the chapter. On-site so the rule is met, but a new tab would keep the reader's place.
- Splitter keys: Home sets the highest `aria-valuenow` (75) and End the lowest (25), the reverse of the APG splitter pattern; consistent with "Up raises the line" and documented, so only worth a word in the help page.
- `loadChapterGreek` in `greek-data.js` hardcodes base `"/"` while every other loader uses `BASE_URL`.
- Float-window `scroll` listener calls `place` and `getBoundingClientRect` on every scroll event while the commands window is open and unmoved; harmless today, cheap to throttle.
- `info` in the builder never evicts; fine for a window's life.

### Questions for the owner

1. **Root license (GK6-2).** Do you want the root `LICENSE` to name `public/greek/` and the fonts as third-party material outside the MIT grant? It is a statement about your repo, so it is your call (and possibly a lawyer's).
2. **Iota adscript (GK6-3).** Is a narrow retry for all-caps adscript forms wanted, or are readers expected to type lowercase?
3. **LIT renderings of four or more words (GK6-5).** Should they be searchable like the shorter ones? They are in the bridge on purpose.
4. **Search credit (improvement 2).** Should `SEARCH_CREDIT` name Perseus because some brief glosses are treated as its text, or does the "licenses" link suffice?

### What held up

- Data integrity (`a1.mjs`, `e1.mjs`, `e2.mjs`): 639 JSON files all parse, all NFC, no BOM; per-lemma counts, forms, shard occurrences and all 57 parse groups equal a rebuild from the text; every `<abbr title>` in `lsj/` and `step/` is well formed; lexicon HTML uses only `b`, `i`, `br`, `span.lex-ref` and `abbr[title]`, exactly what `sanitizeInto` keeps; 55 `(ML)` entries as `LICENSE.txt` and the rule say.
- Search correctness: 2,000 random constructions agree with an independent chain-search matcher on verses, per-first-word matches and marked words, including any-order and book filters (`b1.mjs`); 5,465 lemmas found by their own transliteration, Strong's number in seven spellings, and gloss head (`i1.mjs`, 0 miss).
- Hostile input: control characters, 300-character walls of symbols, quotes, prototype names (`constructor`, `__proto__`, `toString`), 20-digit gap numbers; no throw, no ReDoS, all under 3 ms after the length check.
- Builder: read and write round trip is stable over 30,000 random queries (GK6-12 and an "or" at the end aside); chips are `aria-pressed` buttons in labelled groups; the word box keeps focus and caret; focus returns to the pressed chip or the previous word; the window announces card adds and lookups; forced-colors and `--focus-ring` are in place; no `ch` unit; dark mode is token-driven.
- Credits: every surface that lists Greek results draws `SEARCH_CREDIT` or `SOURCES` from `greek-credits.mjs`; external links carry `target="_blank" rel="noopener noreferrer"`; `LICENSE.txt` equals the generator's text and is tested.
- American spelling and no em dashes in the reader-facing strings of this slice.
- Performance: see Summary. Biggest single file for a first Greek search is `lemmas.json` (222 KB gzipped); a broad `*.sg` query loads 54 of 57 parse groups (about 600 KB gzipped) and runs in 160 ms.

### Not reached

- Anything needing a browser, screen reader, IME or forced-colors emulation (GK6-7, GK6-8 and the rendering of the builder were read, not run).
- `desk-panes.js` Greek pane integration beyond `tab-greek.js` and `greek-find.js`; `desk/search-pane.js` Greek rendering beyond its failure handling.
- `scripts/build-greek.mjs` and `scripts/lib/greek-core.mjs` (build-time generators; their output was verified, not their code or the external source clones).
- The UBS `defs` and `glosses` through `langRuns` (Audit 3 covered STEP and LSJ).
- Hover-preview behaviour of result rows and the `?greek=` link handling in `greek-link.js`.

## Appendix G: Longevity, mechanical health, and the copy and CSS rules (`LG6`, Sonnet)

Checkout: `.claude/worktrees/desk-audit-6`, commit `5c9a31a6`. Scripts are in `scratchpad/audit6/lg6/` (`fnsize.mjs`, `clos.mjs`, `dead2.mjs`, `sweep.mjs`). Logs: `npmtest.log`, `build2.log`.

### Summary

The slice is in good mechanical health: every gate is green, the lazy-loading and import-graph protections from Audit 3 still hold, and the copy and CSS rules sweep found no violations. The risks are about maintenance. The desk's CLAUDE.md has 231 bytes of headroom under its cap. `createSheetPane` grew by about 570 lines in two days and is now the largest function in the desk, even though `start()` fell by about 590 lines. Several extracted modules have no tests. The shell's gzip weight grew by about 14 KB since Audit 3, and a figure in the docs is now stale. Counts: 0 Critical, 0 High, 2 Medium, 5 Low, 3 Nit. I found no instance of "a fix that reached one path and not its sibling" in #491 to #505 (see "What held up" for what I traced).

Gate results (this checkout, node_modules resolved from the parent):

| Command | Result | Time |
|---|---|---|
| `npm test` | 3297 pass, 0 fail, 0 skipped | 7.9 s test time (8.8 s wall) |
| `npm run validate:chapters` | 260 files valid | a few seconds |
| `npm run check` | 0 errors, 0 warnings, 53 hints | about 20 s |
| `npm run build` | success | 53 s |
| `npm run check:links` | OK: 355 pages, 41,078 internal links, no broken targets | a few seconds |

Side effect to know about: `npm run build` runs `fetch:podcast`, which rewrote the tracked file `src/data/podcast-feed.xml` (1 line). I did not revert it, because I may not run state-changing git commands. `git checkout -- src/data/podcast-feed.xml` in this worktree puts it back. `dist/` and the generated `public/` output are git-ignored.

### Findings

#### LG6-1 · Medium · docs · NEW (follows LG3-5) · FIXED (2026-11-08)
**Where** `src/scripts/desk/CLAUDE.md` (153,369 bytes) against `DESK_LIMIT = 150 * 1024` (153,600) in `test/claude-docs.test.js:30`.
**What happens** The file has 231 bytes of headroom. The next rule anyone adds to it fails `test/claude-docs.test.js`, and the author must then trim or raise the cap. Audit 3 measured 135,928 bytes and proposed a cap of about 140 KB "then lower it". The cap that shipped is 150 KB, and the file grew by 17.4 KB (13%) in the two days since, so the "meant to come down" intent has gone the other way. Claude Code loads the whole file the first time a session reads any desk file, which is about 38,000 tokens at the start of every desk session. The cap is working as a tripwire, but the headroom is gone before Audit 5's and 6's own follow-up rules are added.
**Evidence** `wc -c src/scripts/desk/CLAUDE.md` = 153369. 150 * 1024 = 153600. 378 lines were added to the file and 146 removed since `60af379e` (`git diff --numstat`).
**Fix** Do a deliberate trim before the next desk session. The best candidates are the largest single rules, such as the bookmarks and "Continue reading" bullet under rule 13 and rule 18, which read as build history. Move their "why" paragraphs to `STUDY-DESK-FIXES.md` under their E entries, as Audit 3's note suggests. Then set the cap to the new size plus about 5 KB, not to 150 KB.
**Confidence** High

#### LG6-2 · Medium · longevity · NEW (extends LG3-3) · FIXED (2026-11-08) (five extractions: the gap menu is insert-menu.js, createSheetPane 1,698 → 1,606 lines; the list view is my-sheets.js, createSheetEditor 1,738 → 1,589 lines; the two add forms are add-forms.js, 1,589 → 1,402; the card bodies are part-cards.js and the add bar add-bar.js, 1,402 → 1,111)
**Where** `src/scripts/desk/sheet-pane.js:253` `createSheetPane` (1,652 lines). The file is 1,904 lines. `sheet-text.js` `createSheetText` is 1,054 lines and `sheet-lit.js` `createPassageBody` is 351.
**What happens** Audit 3's LG3-3 was about `start()` in `desk-page.js`. It is now 1,115 lines, down from 1,706, because the kind menu (`kind-menu.js`, 403 lines) and title menu (`title-menu.js`, 405 lines) were extracted. That fix worked. The same growth has moved to the Sheets pane. `createSheetPane` was 1,084 lines at Audit 3 and gained about 570. Audit 5 added the gap "Add" pill and its menu, the passage form in place, own templates (`ownTemplatesList`, `newFromOwn`, `saveAsTemplate`), minutes, the answer key and the key terms placement into this one closure. About 85% of the 1,904-line file is one function. A fix to one sub-feature (the list view, the editor, the template chooser) has to be reasoned about against shared closure state (`sheet`, `content`, `seq`, `destroyed`, `paneId`). Audit 3 named this as the commonest source of the "fix reached one path not its sibling" bug.
**Evidence** `node scratchpad/audit6/lg6/fnsize.mjs` over `src/scripts/desk` and `src/lib/desk-*|greek-*`: 4,429 functions; 40 over 150 lines (36 at Audit 3), 63 over 100 (56). Top: `createSheetPane` 1652, `createGreekTab` 1123, `start` 1115, `createSearchPane` 1070, `createSheetText` 1054, `createMineTab` 809, `createNotesMargin` 690, `createPanel` 655. `git show 60af379e:src/scripts/desk/sheet-pane.js | wc -l` = 1287, now 1904 (+617).
**Fix** Take the next extraction from the Sheets pane, as the kind menu was taken from `start()`. The template chooser with "My templates" (`templateChooser`, `ownTemplatesList`, `newFromOwn`, `saveAsTemplate`, about 150 lines) and the gap pill with its menu are the most self-contained. Hand them `{ store, opCtx, say, openSheet, showList }` as `kind-menu.js` takes `{ getLayout, commit, announce }`. One extraction per sitting.
**Confidence** High on the numbers, Medium on the seams.
**Fixed (2026-11-08)** Since this entry, S12 moved the editor out of the pane: `createSheetPane` is a 100-line host in `sheets/sheet-pane.js`, and the closure this entry describes is `createSheetEditor` in `sheets/sheet-editor.js` (1,738 lines on `e1ae0ffb`). Two extractions so far. First, the gap pill's menu became `sheets/insert-menu.js`. Second, the list view became `sheets/my-sheets.js` (264 lines): "My sheets" and "My templates", each row's Duplicate, Save as template and Delete (the two Delete handlers now one, `removeRow`), `listProblem`, and `templateChooser`, which /sheets/ imports from there. The editor hands it `listHost` (`store`, `opCtx`, `idSuffix`, `say`, `content`, `openSheet`, `startFrom`, `showList`), and `showList` keeps only clearing the sheet view and reading the records. `createSheetEditor` was then 1,589 lines. Third, the two forms that bring things onto a sheet became `sheets/add-forms.js` (231 lines): the passage form (`openPassageForm`, a typed reference or a place from the notebook, used by the bar and by the form under a card) and the "+ From my notes…" chooser (`openFromNotes`), with their shared chapter read (`chapterText`). The editor hands them `addHost` (`store`, `ctx`, `opCtx`, `say`, `cards`, `sheet()`, `addPassage`, `change`, `insertIndex`, `focusNewPart`); where a part goes and the change that adds it stay the editor's, and `openInlinePassage` stays too, since it is the card's own placement of the form. `createSheetEditor` is now 1,402 lines. Fourth and fifth, on BVJ's request for the rest: each card's body became `sheets/part-cards.js` (256 lines: the passage, text, question, space and key terms bodies, the read-only drawing through `sheetHtmlForShow`, and the header's planned minutes and Leader only, as `cardBody` and `cardTools`, handed `cardHost`), and the add bar became `sheets/add-bar.js` (135 lines: its buttons with `ADD_TIPS`, the two forms under it, and the key terms button's one-box rule, `sheetChanged`). `createSheetEditor` is now 1,111 lines, down from 1,738, and what stays is the editor's own: saving, drawing and redrawing, the card around each body (`buildCard`: Move, Remove, dragging, the gap's pill), the conflict line and opening a sheet. That is one job with shared state (the sheet, the cards, the part last worked in), so LG6-2 is closed rather than split further; BA66's test now scans every file in `sheets/` and finds the read-only drawing in `part-cards.js`.

#### LG6-3 · Low · longevity · NEW (follows LG3-9) · FIXED (2026-11-08) (page-kind.js tested; (a) was already covered; (b) is `sheetPaneFor`, tested)
**Where** `src/scripts/desk/kind-menu.js` (403 lines), `title-menu.js` (405), `notebook-tab.js`, `page-kind.js`, `sheet-present.js` (882).
**What happens** These have no test file that names them (`grep -l` over `test/` for each name: kind-menu 0, title-menu 0, notebook-tab 0, page-kind 0, sheet-present 0). The pure rules behind most of them are tested: `addWhy`, `sizingFor` and `addBeside` in `desk-layout.mjs`; `partTimeWords`, `moduleMinutes` and `screenMinutes` in `desk-present.test.js`; `templateFromSheet` and `sheetFromTemplate` in `desk-sheets.test.js`. What is untested is the wiring: the flyout open/close and focus return in the two menus, `title-menu.js`'s `newSheet` ("uses the pane, else adds one as a column, else a row, then sends `desk:sheet-new`"), the B and "." blank key's "un-blank without stepping" rule in `sheet-present.js`, and the PROSE_NOTES switch. These are exactly the paths Audit 5's follow-ups changed after the refactor. A DOM stub in the `panel-flyout.test.js` and `mini-dom.js` style would cover them.
**Evidence** `grep -l` as above; `test/panel-flyout.test.js` and `test/desk-intro-text.test.js` exist and show the pattern.
**Fix** Two small tests, in order of value: (a) the blank-key rule, by exporting the key handler's decision as a pure function in `desk-present.mjs` (`presentKey` is already there, so check whether it already returns the un-blank case and test that); (b) `title-menu`'s `newSheet` branching, with the same stub as `panel-flyout.test.js`.
**Confidence** High that they are untested, Medium on their risk.
**Fixed (2026-11-08)** (a) needed no new export: `stepState` already holds the rule ("a step while blank only brings the screen back"), and `desk-present.test.js` tests it with `presentKey`'s B and "." (the `blank` tests). (b) The title menu's choice of pane for "New sheet…" is now `sheetPaneFor` in `desk-layout.mjs` (the first Sheets pane, else a new column, else a new row, else none), which `title-menu.js`'s `startNewSheet` calls; `desk-layout.test.js` tests all four. What stays untested is DOM wiring only: the two menus' flyouts and focus return, `notebook-tab.js`, and `sheet-pane.js` answering `desk:sheet-new` for its own pane. The files now live under `sheets/` where they are Sheets code (S12, step 0).

#### LG6-4 · Low · docs · NEW · FIXED (2026-11-08)
**Where** `src/scripts/desk/CLAUDE.md`, "Launching", the two-stage paragraph ("Measured on `dist/john-3/` (gzipped, 2026-11-07): ... 14 KB now ... and 130 KB once it opens").
**What happens** I measured the same page from this build. The first stage is 14.6 KB gzipped beyond the scripts a reading page already loads (17.9 KB for its whole closure), so the "14 KB" holds. The shell's closure beyond that base is now 138.3 KB gzipped (451,602 B raw), not 130 KB. That is about 14 KB more than the 124 KB Audit 3 measured, from the Sheets and template work reaching the shell's static closure. The claim in the doc is out of date, and a future "is the cost acceptable at launch" decision would start from a wrong number.
**Evidence** `node scratchpad/audit6/lg6/clos.mjs` after `npm run build`. Closures of static imports, in KB gzipped beyond the reading-page base (40.7 KB gz): `first-stage` 14.6, `shell` 138.3, `tab-greek` 53.2 (lazy), `tab-verse` 119.6 (includes shell parts), `tab-mine` 113.8, `notebook-page` 103.3, `sheet-page` 108.0, `desk-page` 202.3, `greek-commands` 22.0, `notebook-search` 48.4.
**Fix** Update the figure (say about 140 KB) and re-measure at launch. No code change is needed: the shell loads only when something needs drawing.
**Confidence** High

#### LG6-5 · Low · longevity · NEW · FIXED (2026-11-08)
**Where** Dead code: `RESTORE_REFUSALS` (`src/lib/desk-notebook.mjs:314`), `revealedBlank` (`src/lib/desk-slides.mjs:111`), `commandsWindowOpen` (`src/scripts/desk/commands-window.js:150`), `isBlockName` (`src/lib/desk-sheet-format.mjs:379`).
**What happens** Each is defined and referenced nowhere else (src, scripts or tests). `isBlockName` is reported by `astro check` as declared but never read. None affects users. They are listed because Audit 3's LG-15 swept dead exports and these have appeared since.
**Evidence** `node scratchpad/audit6/lg6/dead2.mjs`: 157 desk and Greek modules; those four have "only its definition" and no other reference in `src`, `scripts` or `test`. About 40 further exports are used only inside their own file (over-exported constants such as `MINUTES_MIN`, `MINUTES_MAX`, `FOLLOW_KEY`); I did not count those as dead.
**Fix** Delete the four. Leave the over-exported constants unless a module's interface is being tidied anyway.
**Confidence** High

#### LG6-6 · Low · a11y · NEW · NO CHANGE (the global :focus-visible rule draws --focus-ring; Appendix H)
**Where** `src/styles/desk.css:7097-7127` `.desk-sheet__after-btn`, and `.desk-sheet__after-btn:focus-visible` at 7123.
**What happens** The gap pill is `opacity: 0` until hovered or focused. On keyboard focus the rule only sets `opacity: 1`; it adds no ring of its own, while every other desk control uses `outline: 2px solid var(--focus-ring)` (for example 4408-4410 and 7037-7040 for the new minutes input). Whether the pill shows a visible ring then depends on the browser default for a `border: 0` button with a `--green-deep` background, or on a global `:focus-visible` rule (I did not confirm one exists). The root rule says "focus rings use `--focus-ring`". The line drawn across the gap (`::before`, `border-top: 2px solid var(--focus-ring)`) shows focus on the gap, so the case is partly covered. Every gap is also a tab stop, so a sheet of N parts adds N-1 stops, which is Part 1's territory to judge.
**Evidence** Reading `desk.css` 7074-7135; `grep -n "after-btn" desk.css`. Not verified live.
**Fix** Add `outline: 2px solid var(--focus-ring); outline-offset: 2px;` to the `:focus-visible` rule, so the ring is not left to the default.
**Confidence** Low (live check in Chrome and Firefox would confirm whether a default ring already draws)

#### LG6-7 · Low · longevity · NEW · FIXED (2026-11-08)
**Where** `src/lib/desk-store-core.mjs:193`, `src/lib/greek-search.mjs:251,255` (type hints from `npm run check`).
**What happens** `astro check` reports ts(2568) "Property 'kinds' may not exist on type '{ v: number; ids: any[]; }'" and "'glossHead' may not exist". Both are hint-level, run correctly, and are tested. They are listed because the check gives 0 errors, and these two would become errors if the repo ever turned on `checkJs` strictness for `src/lib`.
**Evidence** `npm run check` output.
**Fix** Declare the optional fields in the object's JSDoc. No hurry.
**Confidence** High

#### LG6-8 · Nit · longevity · NEW · FIXED (2026-11-08)
**Where** `src/scripts/desk/sheet-pane.js:640-660` and `:735-750`, `listProblem` and `duplicate`.
**What happens** `duplicate` repeats the body of `listProblem` by hand (find the list head, remove `.desk-sheet__made-not`, insert a status paragraph, call `say`) instead of calling it. They were written in the same file one function apart. It is a small instance of the sibling-copy shape: a later change to the problem notice (a class, a role) will reach one and not the other.
**Evidence** Reading `sheet-pane.js` 725-760.
**Fix** Replace the block in `duplicate` with `listProblem(text)`.
**Confidence** High

#### LG6-9 · Nit · security · NEW · FIXED (2026-11-08)
**Where** `src/lib/desk-sheet-share.mjs:72` `DROP` and `plainModule`.
**What happens** A participant share drops `answer`, `minutes`, Leader only parts and unknown types, but keeps a part's template `prompt` and a question's `answerPrompt`. Those are the template's own helper text, not the leader's words, so nothing private leaks today. If a leader types in the prompt field, which only the format allows, it would be shared. I could not find a UI that lets a leader edit a prompt, so this is theoretical.
**Evidence** `grep prompt desk-sheet-share.mjs` finds nothing; `plainModule` copies every field not in `DROP`.
**Fix** None now. If a prompt ever becomes editable, add `prompt` and `answerPrompt` to the participant scope's deletions.
**Confidence** Low

#### LG6-10 · Nit · docs · NEW · FIXED (2026-11-08)
**Where** `test/claude-docs.test.js:21-30` (the comment) against the cap.
**What happens** The comment says the cap "is meant to come down as the file is trimmed further, never to be raised". The cap is 150 KB; Audit 3's decision text proposed 140. Either the comment or the number should say which is intended. Covered by LG6-1's fix.
**Evidence** Reading the file.
**Fix** Set the cap with LG6-1's trim.
**Confidence** High

### Prior fixes re-checked

- **LG3-1** (launch checklist): holds. I re-ran the checklist's own grep (`lit-desk-preview|data-desk|dataset.desk|deskEnabled|desk=on|desk=off`) over `src public astro.config.mjs test`. Every non-desk file with a hit is either named in items 1 to 5 or matches only `data-desk-*` attributes (`announcement-gate.js`, `chapter-tools.js`, `glossary-selection.js`, `last-read.js`, `ref-preview.js`, `greek-commands.js`, `print.css`, `desk-prose-anchor.mjs`, `desk-margin.mjs`), which the checklist says to expect. Item 11 (Read View's retirement, with its three guard tests) is present.
- **LG3-2** (lazy desk): holds. See LG6-4: first stage 14.6 KB gzipped; the shell, `desk-page`, `notebook-page` and `sheet-page` are dynamic imports from `SiteHeader`'s script and are not in a reading page's static closure. `first-stage.js` imports `shell.js` dynamically.
- **LG3-3** (`start()`): partly. 1,706 lines to 1,115 (`kind-menu.js` and `title-menu.js` extracted). Growth moved to `createSheetPane` (LG6-2).
- **LG3-4** (import-graph test): holds. `test/desk-gate-imports.test.js` exists and passes (8 tests with `desk-storage-keys.test.js`).
- **LG3-5** (size cap): the test exists and passes, but the cap is nearly reached (LG6-1).
- **LG3-6** (doc identifiers): sampled `bookmarkState`, `deskPlaceHref` and the pill claims in the current doc; they match the code.
- **LG3-7** (storage keys vs `/privacy`): holds. The one new key since Audit 3, `lit-sheet-answer-key` (`sheet-page.js:77`), is named on `/privacy` (`privacy.astro:148`), and `test/desk-storage-keys.test.js` passes.
- **LG3-8** (package integrity): holds. `test/desk-package-integrity.test.js` exists and passes in the 3297.
- **LG3-9** (panel-flyout, intro-text, quota tests): holds. `test/panel-flyout.test.js` and `test/desk-intro-text.test.js` exist and pass.
- **LG3-10** (shared `make`, chevrons): not re-measured beyond noting `dom.js` is the import in the new `kind-menu.js` and `title-menu.js`.
- **LG3-11** (browser floor): `CompressionStream` is in item 9 of the checklist. New code since Audit 3 uses `:has()` only in CSS selectors in `desk.css` (`.desk-sheet__pick:has(input:disabled)`, `.desk-sheet__after:has(:focus-visible)`), which the Chrome 105, Safari 17.2 and Firefox 140 floor covers.
- **LG3-12** (executable gate tests): `desk-gate.js` still exports `loadShell` and `desk-first-stage.mjs` exports `loadStageTwo`; their tests pass.
- **LG3-13** (dead `.desk-np--pane`): holds. No `np--` class remains in `desk.css`.
- **LG3-14** (`settled()`): holds.
- **CP3-2 to CP3-7** (numbers typed into copy): `test/desk-copy-constants.test.js` exists and passes.
- **CP4-x**: the copy sweep (below) found nothing contradicting the CP4 fixes.

### Improvements

- Add a `test:desk` timing line to the checklist: the desk's tests are a large share of the 3297 and run in about 8 s in all, so there is no pressure to split them.
- The over-exported constants (about 40 exports used only inside their own module) could be made module-private when the file is next edited; it would make the real interface of each `desk-*.mjs` module visible.
- `scripts/` has 12 `ts(6133)` unused-variable hints (for example `scripts/import-chapter.mjs:95`, `scripts/reconcile/verify-bytes.mjs:31`). These are outside the desk, but the check is otherwise clean, so removing them would make future real hints easier to spot.

### Questions for the owner

1. The desk's CLAUDE.md is at its cap (LG6-1). Do you want a deliberate trim of the rules that are mostly build history, or do you prefer to raise the cap? I recommend the trim, since the file is read whole at the start of every desk session.
2. `createSheetPane` is now the largest function in the desk (LG6-2). Is a sitting to extract the template chooser and gap pill worth spending before launch, or does it wait until after?

### What held up

- **Gates.** All five commands pass (table above). `npm test` is 3297/3297 in 7.9 s. The build output has no warnings that touch the desk.
- **Import-graph gate** (`test/desk-gate-imports.test.js`) passes; the built `john-3` page's static closure contains no desk script (checked in `dist/`: the pre-desk base is 105.6 KB raw, 40.7 KB gz, and the desk chunks are only reachable through dynamic imports).
- **Desk weight on reading pages.** First stage 14.6 KB gz (see LG6-4); nothing else loads until needed. Playpen Sans fonts (264 KB and 196 KB woff2) are in `_astro` but are registered in `desk.css`, which loads only with the shell.
- **Copy sweep** over `src/scripts/desk/*.js`, `src/lib/desk-*.mjs`, `src/lib/greek-*.mjs`, `src/pages/desk/help.astro`, `desk.astro`, `notebook.astro`, `sheets.astro` (`sweep.mjs`, plus grep): no punctuation after a closing curly quote (periods and commas are inside), no em dashes in reader-facing strings (the only two hits are entity tables, `desk-footnotes.mjs:56` and `desk-sheet-format.mjs:111`), no British spellings in strings (the only grep hits were `aria-labelledby` attribute names), straight apostrophes only in `console.error` and thrown-error text which readers do not see, and the Oxford-comma heuristic found nothing in strings.
- **CSS rules.** No `ch` unit in `desk.css` or `desk-tab.css`. The three dark-mode blocks in `desk.css` (lines 1222, 6117, 7400) each have a matching `:root[data-theme="dark"]` twin (1231, 6127, 7406). New rules since Audit 3 use the `--ink-rgb` token for colors; the only literals are `#fff` on a `--green-deep` pill and a black shadow. New focus rules use `var(--focus-ring)` except LG6-6.
- **Outbound links.** All 22 `target = "_blank"` assignments under `src/scripts/desk/` have `rel` with `noopener` within three lines (scripted check: no "NO REL" output). The sheet-slides use sets `target` on an XML run, which is not an HTML link.
- **Sibling paths in #491 to #505.** I traced the new template feature: `isOwnTemplate` is filtered in all three sheet lists (`sheet-page.js:214`, `search-sheet.js:301`, `sheet-pane.js:501-502`) and the notebook lists drop sheets wholesale (`desk-notebook.mjs:92`); share output builds a fresh object so `isTemplate` is never shared (`sharedSheet`); the `?sheet=` deep link opens a template in the pane, which shows a note saying it is a template (`sheet-pane.js:839`). Minutes: dropped from participant shares (`desk-sheet-share.mjs:160`), counted on the leader's copy only (`sheet-copy.js:379`), and range-checked in the validator (`desk-sheet-format.mjs:1059`). The new storage key has its `/privacy` line.
- **Docs claims.** The launch checklist, the file map in `src/lib/CLAUDE.md` and the pointer table in the root `CLAUDE.md` match the files on disk (`test/claude-docs.test.js` passes).

### Not reached

- Whether the browser default ring shows on the gap pill (LG6-6): needs a live look.
- Running `npm run test:desk` separately (it is a subset of `npm test`, which passed).
- Duplication analysis beyond `duplicate`/`listProblem`: I did not run a general clone detector over the desk.
- Behavior of the built `/desk`, `/sheets` and `/notebook` pages under `?desk=on` (no browser, per the brief).
- The size of `public/greek/` data and its licensing (Part 1 or another slice).

## Appendix H: Adversarial verification of the highest findings (`VER6`, Opus)

Checkout `C:\Users\bcjoh\GitHub\litbible\.claude\worktrees\desk-audit-6` at `5c9a31a6`, read-only. No browser, no dev server. Scripts are in `C:\Users\bcjoh\AppData\Local\Temp\claude\C--Users-bcjoh-GitHub-litbible\7d300a9f-94db-4c39-856c-24bfb6d06c89\scratchpad\audit6\ver6\` and take the checkout path as their first argument (`node <script> C:/Users/bcjoh/GitHub/litbible/.claude/worktrees/desk-audit-6`).

### Summary

| ID | Auditor's severity | Verdict | Severity after verification |
|---|---|---|---|
| DK6-1 | Medium a11y | CONFIRMED, changed severity; partly DELIBERATE (tab reach is BVJ's design) | Low |
| DK6-2 | Medium bug | CONFIRMED, changed severity | Low |
| DK6-3 | Medium performance | CONFIRMED, changed severity | Low |
| DK6-11 | Low a11y, REGRESSION DK3-7 | CONFIRMED (better tagged NEW against DK3-7's standing rule; Home is fine, End and the arrows are not) | Low |
| NB6-1 | Medium a11y, REGRESSION NB3-10 | CONFIRMED, changed severity | Low (NB3-10 itself was Low) |
| NB6-2 | Medium usability | Partly DELIBERATE (BA29: stand down on a failed stage, "an old page after a deploy" named); the leftover tray rows and lost focus are real | Low |
| NB6-3 | Low a11y | CONFIRMED, narrower than stated (only `moved` is misnamed) | Low |
| NB6-4 | Low ui | CONFIRMED | Low |
| GK6-1 | Medium bug, incomplete GK3-9 | CONFIRMED | Medium |
| GK6-2 | Medium docs | CONFIRMED, and wider than stated (the OG and bracket fonts too) | Medium (owner's call) |
| DI6-1 | Medium data-integrity | CONFIRMED, changed severity (latent until the first canonical-form change) | Low, fix before any `SHEET_FORMAT` bump |
| DI6-2 | Low compat | Behavior CONFIRMED; the premise is wrong: the format's heading is "Fields every record carries" | Nit (docs at most) |
| DI6-3 | Low usability | CONFIRMED; DUPLICATE of DK6-8(c) | Low |
| SEC6-1 | Low security | CONFIRMED | Low |
| SEC6-2 | Low security (availability) | NOT REPRODUCED by the stated path (backup import sanitizes the text first); the regex cost is real but unreachable today | Nit (hardening) |
| SEC6-3 / DK6-6 | Nit docs / Low usability | CONFIRMED; DK6-6 is a DUPLICATE of SEC6-3 | Nit |
| LG6-1 | Medium docs | CONFIRMED | Medium |
| LG6-2 | Medium longevity | CONFIRMED (same family as LG3-3, left open by design one extraction per sitting) | Medium |
| DI6 question 1 (a follower's move undoes a delete) | question | A real finding, not just a question | Low, compat / sync-readiness, for BDR and BVJ |
| DI6 question 2 (a clock >5 min ahead never converges) | question | NOT a finding: an artifact of the fuzz's frozen clock; converges once real time passes the skew | — |

Same issue reported twice: DK6-6 = SEC6-3 (prompts travel in a participant share); DK6-8(c) = DI6-3 (a passages-only sheet makes an empty template); DK6-1 overlaps LG6-6 (the gap pill's tab stops; LG6-6's missing-ring half is answered by the global `:focus-visible` rule at `global.css:401`, which draws `--focus-ring`); GK6-1 and GK6-6 are one family (a load failure read as "no match").

Inflated: DK6-1, DK6-2, DK6-3, NB6-1, NB6-2, DI6-1 (each one step). Deflated: none of the ones verified; DI6's question 1 deserves to be a finding.

### Verdicts

#### DK6-1 · CONFIRMED, Low (was Medium); partly DELIBERATE · FIXED (BVJ's decision, 2026-11-08)
Every editable card gets a real `<button>` "+ Add" (`sheet-pane.js:1146-1153`, `buildCard`), `opacity: 0` in `desk.css:7097-7113`, so it is a tab stop. That it is reachable by Tab is BVJ's design: the desk CLAUDE.md (around line 1369) says the line and pill show on "pointing at the space under a card (or tabbing to it)", and E60 kept `:focus-visible` so "keyboard focus still lights it". The severity is inflated: each card already has the minutes field, the Leader only box, ↑, ↓, × and the editor (six or more stops), so the pill adds one stop per card, not a wall of 300 identical ones. Each has its own name ("Add a part after <part>"), and the global `:focus-visible` ring draws on it. What stays true is that a screen-reader user hears one more button per part. Evidence: code read (`sheet-pane.js:1060-1153`, `global.css:401-404`). Correction to the Fix: a roving group is a design change to BVJ's 2026-11-08 decision, so put it to the owner as a question rather than a defect fix.

#### DK6-2 · CONFIRMED, Low (was Medium) · FIXED (2026-11-08)
`openInsertMenu` (`sheet-pane.js:1383-1458`) appends a `position: fixed` menu (`desk.css:5429`) to `<body>`, places it once, and closes only on `pointerdown` outside, `focusout`, Tab or Escape. It has no `scroll` or `resize` listener, unlike `kind-menu.js:388-394`, and the pane's `destroy()` (`:1887-1903`) doesn't know about it. A wheel scroll moves no focus, so the menu stays where it was while the pill scrolls away. The undo case is narrower than stated. If the card is redrawn but still there (another tab's save), `addPart(type, m.id)` and `openInlinePassage` still find it by id and work. Only a card *removed* while the menu is open makes the pick fall back to the end, and makes "Passage…" do nothing. The menu still works, and a click anywhere closes it. That is cosmetic or a rare edge case, so Low. Evidence: code read; no browser. Fix as the auditor says (close on capture-phase `scroll` and on `resize`, and keep the open menu's `close` where `destroy()` can call it).

#### DK6-3 · CONFIRMED, Low (was Medium) · FIXED (2026-11-08)
`containsPhrase` re-tokenizes the surface for every blank (`desk-sheet-leaks.mjs:30-42`), and `findLeaks` loops blanks × surfaces. `ver6/leaks-bench.mjs` timings: 10 blanks × 10 surfaces × 1.5 KB = 3 ms; 40 × 20 × 1.5 KB = 8 ms; 100 × 60 × 3 KB = 118 ms; 200 × 300 × 2 KB = 690 ms. The call is in `sheet-page.js:440` only: once per draw of the participant version on /sheets, after the copy is shown, asynchronously and best-effort. It doesn't run on each keystroke or in the pane. Real sheets sit in the first two rows, so this is not real friction. The fix (tokenize each surface once) is still worth doing for its small size. The same script also confirms DK6-4: pointed and unpointed Hebrew don't match (`false false true`).

#### DK6-11 · CONFIRMED, Low; tag NEW, not REGRESSION · FIXED (2026-11-08)
`ver6/insert-menu-keys.mjs` pulls the keydown handler out of `openInsertMenu` verbatim and runs it on stub items with "Key terms box" `aria-disabled`. From Page break, ArrowDown lands on Key terms box (aria-disabled); from Passage, ArrowUp lands there too; End lands there as well. Home goes to Passage, which can never be disabled, and opening focuses `items[0]` (Passage), so "opening focuses the first enabled one" holds by accident. The rule it breaks is stated in the desk CLAUDE.md (around line 1590: "pass over a disabled line in every desk menu, and a disabled line's reason is also the menu's description … (`menu-reasons.js`)"). DK3-7's fix applied it to the menus that existed then. This is a new menu that never had it, so NEW (against DK3-7's rule) describes it better than REGRESSION. Fix as stated: filter `aria-disabled` items when moving, and call `describeUnavailable(menu, …)`.

#### NB6-1 · CONFIRMED, Low (was Medium) · FIXED (2026-11-08)
`first-stage.js:120-127` builds "Skip to the Notebook" with no `data-desk-skip`. The only hiding rule is `desk.css:755` (`html[data-desk-show="off"] .skip-link[data-desk-skip]`), and stage one loads only `desk-tab.css`, so the rule is neither loaded nor matching. The pre-paint script (`Layout.astro:126`) does set `data-desk-show="off"`, and stage one hides the tab (`showRail(state.open)`), but not the link. Its click (`first-stage.js:214-217`) calls `openWhenUp(null, tab)`, and once the shell is up `panel.open` opens the switched-off panel. That is NB3-10's scenario again, reached through stage one, so REGRESSION NB3-10 is fair. NB3-10 was Low (STUDY-DESK-AUDIT-3.md:897), and this is the same harm on a narrower path (pages with nothing kept), so it is Low too. Evidence: code read. Fix as stated. Toggling `skip.hidden` from the `SETTINGS_EVENT` handler is simpler than moving the CSS.

#### NB6-2 · Partly DELIBERATE; the residue is CONFIRMED, Low (was Medium) · FIXED (2026-11-08) (the residue; standing down is BA29's design)
Standing the page down silently when either stage fails to load is the recorded design. The desk CLAUDE.md (around line 195, BA29) says: "where either stage fails to load (offline, an old page after a deploy) … `standDown()` … takes the pre-paint stamps off". So the tab vanishing on a failed press is the decided behavior, not a defect. Asking for a "didn't load, reload" line is a fair question for the owner. Two things are real gaps in BA29's own promise. (1) `standDown` (`desk-frame.js:107-114`) removes attributes, the rail and the gutters, but not the Display tray rows stage one injected (`note-settings.js:313-368`, all `data-desk`). The only CSS gate is `html:not([data-desk]) [data-desk-toggle]` (`global.css:3982`), which doesn't match them, so dead controls remain. (2) Focus was on the removed tab and falls to `<body>`. Low: preview-only, and it needs a failed chunk load. Evidence: code read. Correction to the Fix: drop the "keep the tab" half unless BVJ revisits BA29; keep the tray-row teardown and the focus return.

#### NB6-3 · CONFIRMED, narrower; Low · FIXED (2026-11-08)
`flagText` (`change-notice.js:191`) has only three outputs: `lost` gives "Not in the text", `moved` gives "Words moved", and everything else gives "Wording changed". So for `changed`, `verse`, `reworded` and `whole`, the hard-coded "the wording changed" in `circleElement` (`notes-margin.js:497`) and `flagElement` (`:510-512`) is correct. A `lost` mark isn't drawn in the margin ("lost ones are left out", `:119`). The only misnamed kind is `moved`, plus `drawChanged` (`tab-mine.js:640-652`) counting `moved` as "The wording has changed". Correction to the What: "the wrong thing for a lost, moved, whole-verse or reworded notice" should read "for a moved notice".

#### NB6-4 · CONFIRMED, Low · FIXED (2026-11-08)
`.font-tray__hint` and `.font-tray__reset` are styled only in `desk.css` (`:764`, `:1808-1829`; grep finds them nowhere else). Stage one injects both through `initNoteSettings()` (`first-stage.js:77` → `note-settings.js:335-346`) and loads only `desk-tab.css`. The reset button's hiding still works without the CSS: its `[hidden]` rule only reinforces the UA's. Evidence: grep and code read.

#### GK6-1 · CONFIRMED, Medium · FIXED (2026-11-08)
`ver6/gk6-1.mjs` (my own fetch stub, `lemmas.json` answering 503) gives `πίστις` → `{kind:null, lemmas:0, failed:false}`, `G4102` → the same, and `πίστις.gen` → `{kind:"commands", failed:true}`. `searchGreek` returns `empty` with `failed: false` when the index is null (`search-greek.js:177-180`). /search's `writeGreekStatus` checks `!greek.lemmas.length` before `greek.failed` (`search.js:1028-1031`), so it says "No Greek words match “…”". The tray's failed branch requires `greek.selected` (`searchbar.js:1023`). So GK3-9's fix is incomplete for an index failure, as GK6 says. Medium stands: it says something false (the word isn't Greek) in a plausible offline or transient case. Correction to the Fix: also reorder `writeGreekStatus` so `failed` is checked before the empty-lemmas case.

#### GK6-2 · CONFIRMED, Medium (owner's call); wider than stated · FIXED (BVJ's decision, 2026-11-08)
The root `LICENSE` names two classes and says "Everything not listed above is SOFTWARE under the MIT License". It has no exception for `public/greek/` (whose own `LICENSE.txt` lists CC BY and CC BY-SA sources), `public/fonts/text-critical-signs.otf` (OFL, with its own notice), `public/fonts/bracket-markers.otf`, or `scripts/og/fonts/*.ttf` (with `OFL.txt` beside them). No prior audit raised it (grep of AUDIT-1 to 5 and FIXES). `git log -- LICENSE` shows it last changed in #248, before the Greek data landed. Correction: add the two fonts and the OG fonts to the list in the Fix. The glossary bridge is derived from the LIT's own glossary plus Greek lemmas, so it is not purely third-party; leave it out or have it described by the owner.

#### DI6-1 · CONFIRMED, Low (was Medium); fix before the first canonical-form change · FIXED (2026-11-08)
`ver6/di6-1.mjs` takes a `sheetFormat: 1` sheet whose text is `<p><b>bold</b> and <i>it</i></p>`. `validateRecord` gives "html is not in the sheet's formatted-text form", and after `cleanSheetText` it gives `[]`. `planImport` of it as a live record writes nothing and skips it with "It couldn’t be read." Inside a trash record it gives `put: [{kind:"trash", holds:false}]` with the DI3-4 warning (its words are dropped). A share holding the same is refused (`invalid`). The order is as stated: `planImport` validates (`desk-export.mjs:705`, `:721-727`), and only records that pass reach `cleanIncoming` (`:728`). That contradicts `cleanSheetText`'s own comment ("an import puts every sheet through this", `desk-sheet-format.mjs:906-909`) and the format's sentence. Severity: no sheet the website writes today is non-canonical, and the golden corpus makes any canonical change a deliberate `SHEET_FORMAT` bump. So this is latent, the import-side sibling of DI3-6, which was rated Low. It becomes Medium the day a canonical form moves: a backup restored into a fresh browser would then lose every older sheet. That makes it a must-fix before any such bump, which is how it should be recorded.

#### DI6-2 · Behavior CONFIRMED; premise wrong; Nit · FIXED (2026-11-08)
`validateRecord` does require `labels` to be an array, and `client` and `contentVersion` to be strings (`desk-records.mjs:415-417`). But the format's table is headed "**Fields every record carries**" (`STUDY-DESK-FORMAT.md:56`), and "may be empty" there means `[]`, not absent. The format already says an app's record must carry them. At most, one word ("required") could be added for BDR. Not a defect.

#### DI6-3 · CONFIRMED, Low; DUPLICATE of DK6-8(c) · FIXED (2026-11-08)
`ver6/di6-3.mjs`: a passages-only sheet (`template: "search"`) gives `templateFromSheet` a template with 0 modules that validates and has `isTemplate: true`; `sheetFromTemplate` of it gives 0 modules with `template: "search"`. "Save as template" is offered on every sheet `canEdit` accepts (`sheet-pane.js:536-543`). DK6 reported the same as DK6-8(c) (`kt.mjs`). Keep one entry.

#### SEC6-1 · CONFIRMED, Low · FIXED (2026-11-08)
`ver6/share-prompts.mjs` runs the real `shareFile` on a sheet titled `<img src=x onerror=alert(1)>` whose text holds `&lt;script&gt;…` and `&lt;b&gt;`. The file's lines come out as `# <img src=x onerror=alert(1)>` and `<script>alert(1)</script> a <b>bold</b>`. `markdownLine` (`desk-sheet-share.mjs:211-216`) doesn't escape `<`, and `plainText` decodes `&lt;` (`:237`). The notebook's Markdown escapes every `<` (`escapeBody`, `desk-export.mjs:217-223`, BA41). DK3-12's fix covered emphasis and line-start marks only. Low is right: the file is the reader's own, and a hand-written `.md` can hold anything.

#### SEC6-2 · NOT REPRODUCED by the stated path; Nit · FIXED (2026-11-08)
The regexes are quadratic, as stated: `ver6/share-prompts.mjs` timed `markdownLine` at 50 ms for 10,000 whitespace characters and 825 ms for 40,000, and `plainText` at 294 ms for 20,000 spaces and 1,894 ms for 50,000. But the route fails. SEC6 timed `shareFile` on a raw record, never imported. A backup import runs `cleanIncoming` → `cleanSheetText` on every sheet that validates, and a `sheetFormat: 2` sheet validates (only common fields and title/subtitle limits). `cleanSheetText` sanitizes `text.html` and `question.html`/`answer` "whatever its sheetFormat". `ver6/sec6-2-path.mjs` imports a `sheetFormat: 2` sheet holding 50,000-space runs through `planImport`: the stored text `html` comes out length 0 and the `answer` 8. `shareFile` on the imported record takes 22 ms, against 4,431 ms on the raw record. An unknown module type keeps its raw `html`, but `describeModules` never passes an unknown type to `plainText`. The title and subtitle are capped at 200 characters by `validateSheet`. A share can't bring in a newer format (`sheetFromShared` throws "newer", `desk-sheet-share.mjs:364`), and a format-1 share must be canonical. I found no way today to get an unsanitized whitespace run into a stored sheet's text. Making the two regexes linear is still cheap hardening (Nit). SEC6's Q1 (should a newer-format sheet be shareable at all) stands as a question.

#### SEC6-3 and DK6-6 · CONFIRMED, Nit; DK6-6 is a DUPLICATE
`ver6/share-prompts.mjs`: a participant share of a `bible-study` sheet keeps `prompt` on six text parts ("Type the reference in the form below, or…", and so on); `plainModule` drops only `id`, `verseCopy`, `verseCopyAsOf` and, for a participant share, `minutes` (`desk-sheet-share.mjs:72`, `:156-163`). DK6-6 calls these "the author's ghost prompts … written for the leader". In fact no control writes a prompt (grep finds no `prompt:` write in `src/scripts/desk/`). They are the built-in templates' fixed text, which the recipient would see on starting that template themselves, and they show only while a part is empty. The format also says a client "keeps the fields whole" (principle 6). So DK6-6's Low (usability) is inflated. SEC6-3's Nit (the `promptOk` comment says "nothing … shares it", which is wrong) is the right weight. One entry; the owner's question is whether a participant share should drop them.

#### LG6-1 · CONFIRMED, Medium · FIXED (2026-11-08)
`wc -c src/scripts/desk/CLAUDE.md` is 153,369 against `DESK_LIMIT = 150 * 1024` = 153,600 (`test/claude-docs.test.js:25`): 231 bytes of headroom. `node --test test/claude-docs.test.js` passes today. The file was 143,226 bytes at the commit that set the cap (`git show c3c4ba5b:…`), so it has grown about 10 KB under a cap whose comment says it is "meant to come down … never to be raised". The first Audit 6 work session that adds a rule will fail CI, so Medium for maintainers is fair.

#### LG6-2 · CONFIRMED, Medium · FIXED (2026-11-08) (five extractions: the gap menu is insert-menu.js, createSheetPane 1,698 → 1,606 lines; the list view is my-sheets.js, createSheetEditor 1,738 → 1,589 lines; the two add forms are add-forms.js, 1,589 → 1,402; the card bodies are part-cards.js and the add bar add-bar.js, 1,402 → 1,111)
`createSheetPane` runs from `sheet-pane.js:253` to the file's last line, 1904 (1,652 lines). The file was 1,287 lines at `60af379e`. This is the same shape as LG3-3, which Audit 3 left "partly open by design (one extraction per sitting)" (STUDY-DESK-AUDIT-3.md:297), now in a different function. It is a fair new finding in the KNOWN-OPEN LG3-3 family, and not a regression of anything.

#### DI6 question 1 · A real finding: Low, compat / sync-readiness, for BDR and BVJ
`ver6/follow-delete.mjs`: a followed bookmark deleted on the phone at 10:00:05 and moved by the laptop's follower at 10:00:06 comes back on both sides after a merge (`["bookmark@3:9"]` each way); a rename at 10:00:06 does the same, as rule b intends. So it follows rule b as written ("An edit later than a trash record's `deletedAt` brings the record back", STUDY-DESK-FORMAT.md:868). But the format also says a follower's move "is the reader's reading, so it makes no undo step" (`:170`). DI3-3 split the stamps (`placedAt`, `editedAt`) so that reading would stop overriding edits, and the case of a deletion was never weighed (grep of the audits, FIXES and the desk CLAUDE.md finds no follow-versus-delete decision). Today it needs a backup file carried between two devices while one keeps reading, so it is Low. Under sync it becomes routine: delete on the phone while the laptop tab is open on that book, and the bookmark returns. It belongs in the format's queue for BDR (compare `deletedAt` with `editedAt` for a stamped bookmark), not as a question only.

#### DI6 question 2 · NOT a finding
DI6's `bookmark-merge-fuzz.mjs` runs every final exchange at `t + 60 s`, while the fast replica's stamps are 10 minutes ahead. The clamp still treats them as future, so the replicas stay apart for as long as the simulated clock is frozen. `ver6/clock-ahead-later.mjs` is the same script with only the exchange time moved. At `t + 60 s` it gives 69 of 3,000 runs diverged (DI6's number). At `t + 15 min` it gives **0** diverged, 0 not idempotent, and 0 records made of parts no replica wrote. The design expects exactly that: "A sync that drops a record as ahead must not advance its cursor past it" (STUDY-DESK-FORMAT.md, "Room for skew"), so the ahead edit lands once real time reaches its stamp. A device whose clock stays fast keeps every new edit delayed by its skew. That is the deliberate price of BA4, BA12 and DI-8, already recorded "for BDR to confirm". DI6's suggestion of service-side stamps is reasonable advice for BDR, not a defect.

### Not reached

- Anything needing a browser: DK6-2's floating menu, NB6-1's live path, NB6-2's 404-after-deploy trigger (whether Cloudflare Pages drops a previous deployment's hashed chunks was not checked), NB6-4's rendering.
- DK6-1's screen-reader experience (code only).
- GK6-2's legal sufficiency (the owner's, possibly a lawyer's).
- Part 1's (live Sheets walkthrough) findings: not yet asked for.

## Appendix I: The brief Part 1 was given

You are the one auditor for Part 1 of Study Desk Audit 6 on the LIT Bible website. The owner
(BVJ; pronouns unstated, use they/them) gave this brief, repeating Audit 5's task:

> I want an exhaustive audit as if you were a new user to the Sheets functions. Try every
> feature from the viewpoint of a ministry leader preparing for working with people. How
> intuitive is it? How could it improve? Try every template and every command and module.
> Many of the templates have auto-populated text. I think that should all be replaced with
> ghost text prompts for guiding users. No actual text should be in the fields. Try various
> combinations of modules within each template.

### Where things stand

Audit 5 (`STUDY-DESK-AUDIT-5.md`, IDs `SH5-1` to `SH5-17`, 2026-11-07) did this same audit.
Read it first, whole (about 52 KB): its Status paragraph, its findings, section B (the
templates' text and the ghost prompts), section C (combinations tried and NOT tried), section D
(recommendations BVJ decided on 2026-11-08, each marked) and E (not covered). Since then these
landed on `main`: #502 (SH5 fixes, ghost prompts as an optional `prompt` field), #504 (BVJ's
decisions, adding a part from the gap between parts with an "Add" pill, the pane renamed
"Sheets", menu order), #505 (section D: templates of your own, minutes, the print check, the B
key, the key terms box's place). **That newest code is the least tested by a real user; spend
the most effort there**, and check that every Audit 5 fix still holds (report breakage as
`REGRESSION SH5-n`).

Specifically verify BVJ's rule: **no field in any template starts with actual text; only ghost
prompts**, which never print, copy, share, save into a file, or go up in Present. Check every
built-in template and a template of your own (save one from a sheet that has text, then make a
sheet from it: what carries over?). Build the full table of every template part and what it
shows.

### Code and docs to read first (repo checkout, read-only)

`C:\Users\bcjoh\GitHub\litbible\.claude\worktrees\desk-audit-6` (branch `claude/desk-audit-6`,
commit `5c9a31a6`, identical to `main`). Read this checkout, never other worktrees. The Sheets
code: `src/lib/desk-sheets.mjs`, `desk-sheet-templates.mjs`, `desk-sheet-format.mjs` and the
other `src/lib/desk-sheet*.mjs`; `src/scripts/desk/sheet-*.js`, `search-sheet.js`; `/desk/help`
(`src/pages/desk/help.astro` or similar) for the Sheets section. `src/scripts/desk/CLAUDE.md` is
the design record: grep it for Sheets, templates, prompt, Add pill, minutes, print check; anything
marked "(BVJ, <date>)" is a deliberate decision, not a defect (put disagreements under Questions
for the owner). Also grep `STUDY-DESK-FIXES.md` (E log) before reporting something as new.

### The browser

You are the ONLY agent allowed to drive the Browser pane in this phase. Start the dev server with
`preview_start` `{name: "dev"}` (it serves the main checkout, which is at the same commit). Open
`http://localhost:4321/desk?desk=on` (the preview flag). Read `anthropic-skills:built-in-browser`
guidance if you need it. Known traps in this pane (they look like bugs and are not):

- Load desk pages at a viewport 768px wide or wider; narrower emulates a touch phone and the desk
  never comes up. Audit 5 used 1500x950.
- A ref click scrolls its target to the viewport's center first; inside the Sheets pane's nested
  scroller a target near the end can't be centered and the click lands on the card above. Use
  `find` right before each click, or measure with `getBoundingClientRect` and click by coordinate;
  never reuse coordinates after anything that may have scrolled.
- While the app window is behind another, `requestAnimationFrame` never fires and `:hover`/
  `:focus` never match: the gap's "Add" pill reads `opacity: 0`. Drive it with `.click()` in JS,
  probe RAF with a 1.5 s race, never `await` a bare RAF. If screenshots time out, say so in the
  report rather than retrying forever.
- No fresh origin: don't clear localStorage or the `lit-desk` database (refused as destructive).
  Note what the origin holds at the start and audit on it. You MAY create, edit, duplicate and
  delete sheets you made yourself; delete your own test sheets at the end, and touch nothing else
  in the notebook.
- `window.open` (presenter view) becomes same-tab navigation in the pane.
- Print dialogs and file saves need a person's hand: don't trigger them; read the writers' code
  and tests instead and say so.

### Ground rules

READ-ONLY in the repo: no edits, no git state changes, no dev-server config changes. Write only
your report, at
`C:\Users\bcjoh\AppData\Local\Temp\claude\C--Users-bcjoh-GitHub-litbible\7d300a9f-94db-4c39-856c-24bfb6d06c89\scratchpad\audit6\part1-SH6.md`,
and throwaway scripts in `...\scratchpad\audit6\sh6\`. Run Python as `python`, never `python3`.
Reader-facing copy rules (for judging copy): American spelling, periods and commas inside closing
quotes, the Oxford comma, curly quotes, no em dashes in prose Claude wrote.

### What to try (at least)

Every template (each built-in one and one of your own); title, subtitle; passages by typed
reference, by the LIT pane's verse menu and by selection; the gap's Add pill between parts and its
inline passage form; every add-bar part (text, question with answer, blanks with hints and the
give-away flag, key terms box, space, page break, For discussion, minutes, whatever exists now);
Move up/down, drag, Remove and Undo; Leader only; every toolbar button and menu (paragraph style,
alignment, Style); keyboard shortcuts including the B key; the print check and commercial check;
Duplicate, Delete; the sheet's own page with both versions, paper, QR, Copy, Save as menu, Share
and the import of a shared link, Present with reveal, footnotes and presenter view; a sheet from
/search. Then **combinations of parts within each template** (vary order, add/remove, mix leader
only, long passages, many blanks, empty parts, a 50+ part sheet). Also try what Audit 5's section C
listed as not tried, where the pane allows. Keep a log of what you did.

Judge as a ministry leader preparing a Bible study, a sermon, a class, a lectio divina session:
where do you hesitate, what's unclear, what would you expect that isn't there, what does the
participant actually receive.

### Report format

- Header paragraph: date, commit, method (what you ran and how), what was in the origin.
- `## Bottom line`: the few things that matter most, in plain prose.
- `## A. Findings (SH6)`: `#### SH6-n · <High|Medium|Low|Nit|Observation> · <bug|usability|ui|a11y|copy> · <NEW|REGRESSION SH5-n|KNOWN-OPEN x>`
  with the title, then **What happens** (steps to reproduce), **Where** (file:line, function, when
  you traced it), **Fix** (specific), **Confidence**. Ordered by severity. Evidence over volume.
- `### What worked well`
- `## B. Ghost prompts: every template part` (a table: template, part, what the field holds at
  creation, the prompt shown, whether the prompt leaks into print/copy/share/Present/files). State
  plainly whether BVJ's rule holds everywhere.
- `## C. Combinations tried` (table, as Audit 5's) and what was not tried.
- `## D. Audit 5 fixes re-checked` (one line each: holds / regressed).
- `## E. Ideas to improve` (ranked for a weekly leader; non-defects).
- `## F. Questions for the owner`
- `## G. Not covered`

### Final message to the orchestrator

At most 200 words: counts by severity, your top five findings in a line each, whether the
no-text rule holds, and the report path.

## Appendix J: The brief every Part 2 auditor was given

You are one auditor in a multi-agent audit of the **Study Desk** of the LIT Bible website.
Repo checkout to read: `C:\Users\bcjoh\GitHub\litbible\.claude\worktrees\desk-audit-6`
(branch `claude/desk-audit-6`, commit `5c9a31a6`, identical to `main`). Read ONLY this
checkout, never the main checkout or other worktrees (other sessions work there).
Windows; PowerShell and Git Bash both exist; run Python as `python`, never `python3`.

The Study Desk is a pre-release, desktop-only, off-by-default feature (`?desk=on`): a
Notebook panel (notes, bookmarks, highlights, pinned footnotes, a trash), a Greek tab with
Greek search and a search builder, the `/desk` multi-pane workspace (LIT, My Notes, This
verse, Footnotes, Book Intro, Greek, search and Sheets panes), and sheets (study handouts)
with templates (built-in and the reader's own), ghost prompts, print, present, share, and
saving as documents and slides (.docx, .odt, .rtf, .md, .pptx, .odp, PDF). Vanilla JS in
`src/scripts/desk/` (about 91 files), pure logic in `src/lib/desk-*.mjs` (60 files), CSS in
`src/styles/desk.css`, pages `src/pages/{desk,notebook,sheets}.astro` and the help page
`/desk/help/`. The owner wants a thorough audit covering usability, UI, accessibility,
security, bugs and functionality, longevity and sustainability, and anything else worth
knowing, from as many angles as can be thought of. You own ONE slice (given in your prompt).
Stay in it except for brief cross-slice notes.

#### What is new since the last full audit (scrutinize first)

Audit 3 (the last full code audit) ran at commit `60af379e` (2026-11-06). Audits 4 (scoped:
security, first use, tours, copy) and 5 (the Sheets, as a new user) followed. Since Audit 3,
**53 commits** landed: Audit 3's work sessions (#477 to #499: anchor spec 4, bookmark merge
vectors 5, stamps and tombstones in import, lazy desk loading on reading pages, the one help
page at /desk/help, pane menu and title menu split out of `start()`, store write errors, Greek
search fallbacks), Audit 4 and its fixes (#500), and Audit 5 with its fixes and BVJ's decisions
(#502 to #505: ghost prompts as an optional `prompt` field, adding a part from the gap between
parts, the Sheets pane rename, templates of your own, minutes, the print check, the B key, the
key terms box's place, the give-away flag's traditional-word telltale, the term lens during a
drag). Run `git log --oneline 60af379e..HEAD -- <your paths>` and `git show` the relevant
ones. **New code is the least-audited; spend most of your effort there.**

A separate agent is auditing the Sheets live in the browser as a first-time ministry leader
(Part 1); you don't need to repeat a user walkthrough, but code-level Sheets bugs in your slice
are yours.

#### Ground rules

**READ-ONLY.** Do not edit, create, delete or commit any file in the repo. No git commands
that change state (no stash, checkout, reset, add, commit, merge, worktree). The only file you
write is your report, at the path your prompt gives, plus throwaway scripts in your own scratch
folder (your prompt gives it; never in the repo). You may run read-only commands, the repo's
unit tests (`node --test test/<file>`), and node scripts. The `*.mjs` modules import cleanly in
node, so exercise the pure logic directly (fuzz it, feed it hostile and awkward input) rather
than only reading it.

**Do not start a dev server or open a browser.** Another agent is using the browser pane.

#### Orientation: read before judging

1. `src/scripts/desk/CLAUDE.md` is the design record. Do not read it whole. Grep it for the
   features and rule numbers in your slice and read those parts in full. Anything marked
   "(BVJ, <date>)" or described as an owner decision is **deliberate, not a defect**. If you
   think a deliberate decision is wrong, put it under "Questions for the owner".
2. Root `CLAUDE.md`, "Rules that apply everywhere" and "Key Conventions": dark-mode styles need
   both selectors; size text columns with `--ch`, never the `ch` unit; focus rings use
   `--focus-ring`; links that leave the site open in a new tab with `rel="noopener noreferrer"`;
   the desk is downloaded only with `data-desk="on"` and shared code never statically imports
   it; reader-facing copy is American (color, periods and commas inside closing quotes), the
   Oxford comma always, curly quotes, and no em dashes in prose Claude wrote (the owner's own
   text is exempt).
3. **Five prior audits and a bug log exist. Check them before reporting anything.** All are too
   large to read whole except 4 and 5: grep them.
   - `STUDY-DESK-AUDIT-1.md` (BA1 to BA153, FA1-*).
   - `STUDY-DESK-AUDIT-2.md` (`SEC`, `DI`, `NB`, `DK`, `GK`, `LG`, `LV`, `CP`).
   - `STUDY-DESK-AUDIT-3.md` (`SEC3`, `DI3`, `NB3`, `DK3`, `GK3`, `LG3`, `LV3`, `CP3`). Read its
     "Work sessions" and "Decisions needed from the owner" sections: each session's Status says
     what was fixed and what was deliberately left; the decisions record BVJ's answers.
   - `STUDY-DESK-AUDIT-4.md` (`SEC4`, `FU4`, `TR4`, `CP4`), `STUDY-DESK-AUDIT-5.md` (`SH5`).
   - `STUDY-DESK-FIXES.md` (the E log): the owner's own bug and wish log, with decisions.
   - `STUDY-DESK-FORMAT.md`: the record format shared with the iOS/Android apps (BDR).
   Status tags: `NEW`; `KNOWN-OPEN <ID>` (a prior finding or E entry still open);
   `REGRESSION <ID>` (marked fixed, but broken again or incomplete, with evidence).
   Items a session's Status says were deliberately left are not findings unless the reason no
   longer holds.
4. **Check that Audit 3's (and 4's, where in your slice) fixes still hold.** For each finding
   in your slice's prefix marked fixed, confirm the fix is still in the code (the guard, the
   test). Report breakage as `REGRESSION`. List the ones that hold, one line each, under
   "Prior fixes re-checked".

#### Standards of evidence

Every finding must be verified by reading the code at the cited file and line, and by running
it where practical. No speculation presented as fact. Mark anything you could not confirm
`Confidence: Low` and say what would confirm it. Prefer fewer, real, well-evidenced findings
over padding. Do not report style nits unless they affect users or maintainability. Things that
are good go in "What held up". Quote line numbers from this checkout, and name the function too.

#### Report format

Write Markdown to the report path:

- `## Summary`: 5 to 8 lines on the health of your slice, with counts by severity.
- `## Findings`, ordered by severity. One block each:
  `### <PREFIX>-<n> · <Critical|High|Medium|Low|Nit> · <a11y|usability|ui|security|bug|data-integrity|performance|longevity|docs|compat|copy> · <NEW|KNOWN-OPEN x|REGRESSION x>`
  then **Where** (`src/...:123`, function), **What happens** (a concrete scenario a user or
  maintainer would hit), **Evidence** (what you read or ran; name your script), **Fix** (concise
  and specific), **Confidence** (High, Medium or Low).
- `## Prior fixes re-checked`
- `## Improvements`: worthwhile non-defects, one line of rationale each.
- `## Questions for the owner`
- `## What held up`: what you checked and found sound, so nobody re-checks it.
- `## Not reached`

Cap at about 30 findings. Severity guide: **Critical** = data loss or corruption, script
injection, or a feature unusable for a class of users. **High** = likely user-visible failure,
or a WCAG A/AA blocker. **Medium** = real friction, or a bug in a plausible scenario. **Low** =
edge case or polish. **Nit** = trivial.

#### Your final message to the orchestrator

Keep it SHORT (200 words at most): counts by severity, your top five findings in one line each,
and the report path. Everything else lives in the file.
