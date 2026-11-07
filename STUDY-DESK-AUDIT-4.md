# Study Desk Audit 4 (scoped)

Audited 2026-11-07 at commit `4a5b7c3c` (`main`, the day Audit 3's work sessions landed), on
BVJ's brief of four areas: **security**, **whether every part is intuitive for a first-time
user**, **a critical look at both tours**, and **the user-facing copy behind the preview
switch**, improved where it needed it. Nothing outside the preview switch was changed: the
pages' "preview is off" notes, the shared flyout, `chapter-tools.js` and the search bar were
read but left alone.

Method: the desk's `CLAUDE.md`, Audit 3's top matter and security appendix, both tours' code
in full, every page the desk draws, and every string literal of two or more words in
`src/scripts/desk/`, `src/lib/desk-*.mjs`, `src/lib/greek-*.mjs`, the gate files and the help
page (2,630 strings, pulled by a script and read whole). Then a first visit in the browser
pane at 1500×950 with the site's storage cleared first: a chapter with the desk on, the
Notebook's first-use card and offer, the notebook tour end to end, `/desk` and its offer and
tour end to end, `/notebook/` and `/sheets/`. The 86 `innerHTML`/`insertAdjacentHTML` sinks,
the address parameters, the cross-window channels and the file and link readers were each
followed to what reaches them.

IDs carry a 4 (`SEC4`, `FU4`, `TR4`, `CP4`) so they never collide with the earlier audits'.
Fixed items say so; the rest are recommendations, several of them BVJ's call.

## Bottom line

**Security: nothing new above Nit.** Audit 3's five security fixes are on `main` and hold; the
sink sweep found every HTML sink fed static markup, an escaped string or sanitized HTML; the
address, file, link and cross-window readers each validate what they take. Two small
leftovers (SEC4-1, SEC4-2, both since fixed) and the standing CSP decision (SEC4-3).

**First use: in good shape, with one design question.** A first visit is quiet (a "Notebook"
tab at the window's edge and one pill), every empty state says what to do, the offers have
three plain answers, and both tours act on the real page and put it back, as checked live.
The one thing a first-time reader meets that does not explain itself is the opening question,
"Where should your notebook live?", whose two answers are the same place (FU4-1).

**The tours: keep both, minor adjustments, not a restart.** Ten and seven steps is the right
length, each step shows the thing working, Back, Skip this part, Skip the tour and Escape all
behave, and the ending restores the page. One step was broken (TR4-1, fixed): "Search and
commands" showed an empty search box, because the click that advances the tour also closes
the tray the step had just opened. Four wording and ordering changes followed on BVJ's yes (TR4-2, TR4-3,
TR4-5, TR4-6); TR4-4 is left as a suggestion.

**Copy: already close to the house style.** Of 2,630 strings, nine sentences were improved
(CP4-1 to CP4-7); the rest hold to the American conventions and the desk's naming rules.

## A. Security (`SEC4`)

### Audit 3's fixes, re-checked on `main`

- **SEC3-1** (a 1 MB ceiling for any schema): `validateRecord`'s common block refuses over
  `MAX_RECORD_BYTES` ("the record is too large to keep (over 1 MB as JSON)",
  `desk-records.mjs:293`), and `planImport` reports it ("It is too large to keep (over 1 MB).",
  `desk-export.mjs:725`). Holds.
- **SEC3-2** (the inert scrub): `makeInert` in `desk-inert.mjs`, applied in `chapter-page.js`'s
  `keepParts` and the intro pane; `sheet-lit.js` no longer carries its own copy. Holds.
- **SEC3-3** (participant slides): decision 6 (b) is recorded as built in session 3; not re-run
  here (no .pptx was generated in this audit).
- **SEC3-4** (name caps and the Sheets page's file reader): `BOOKMARK_NAME_MAX` and
  `LABEL_NAME_MAX` in `validateRecord` (`desk-records.mjs:332, 343`); `openFileRow` refuses
  over `MAX_SHARE_FILE_BYTES` before reading (`sheet-page.js:249`); `fragmentInFile` throws
  "too-large" past `MAX_FRAGMENT_LENGTH` before `replaceState`; `inflate` stops at
  `MAX_JSON_BYTES` (`desk-sheet-share.mjs:104-115`). Holds.
- **SEC3-5** (marker lookup): `markerName` is what print reads; not re-run.
- **SEC-1** (no off-site fetch): `chapterHref` and `introHref` still guard every `fetch` in
  `chapter-page.js:139` and `intro-pane.js:59`; the other fetches are fixed same-origin paths
  (`/api/version.json`, `/api/data/release-notes.json`, `/glossary/`, `/search/chapters/…`,
  `/greek/…`).

### The sink sweep

86 `innerHTML`/`insertAdjacentHTML` assignments in `src/scripts/desk/` and `src/lib/desk-*`.
Every one takes static markup, a `glyph()`/icon constant, text through `escapeHtml`, or
HTML that is sanitized first: a sheet through `sheetHtmlForShow` (allowlist of tags, `href`
through `cleanHref`, which strips control characters before reading the scheme and admits
only http, https, mailto and a same-site path), a lexicon entry through `sanitizeInto`'s
template walk, a note's body through `noteBodyHtml` (escaped before the linker runs), a
verse hit through `highlightVerseHit` (escaped around each `<mark>`), a QR code through
`qrSvg` with `escapeXml`. Flag text, reasons and names go through `textContent`.

Address parameters (`place`, `intro`, `sheet`, `greek`, `print`, `desk-tour`, `q`, and the
`#share1.` fragment) each pass a dedicated parser; the fragment's inline script moves it into
`history.state` before any deferred script can read the address. Cross-window traffic is
`BroadcastChannel` only, same-origin by nature, and every message is shape-checked
(`readChangeMessage`, `presentMessage` then `checkState`, the follower's token exchange);
the presenter window is `window.open` of a same-origin address. The sheet editor's link form
validates an address before `setLink`, and the saved sheet is re-sanitized anyway.

### Findings

#### SEC4-1 · Low · privacy · FIXED (2026-11-07)

> **Fixed:** `notebook-page.js` puts `q` into the filter and then drops it from the address
> with `replaceState`, keeping any other parameter (`?desk=on`) and the fragment.

**`/notebook/?q=<words>` keeps the reader's search words in the address**, so they sit in the
browser's history and in any bookmark of the page. `notebook-page.js:423` reads `q` into the
filter and leaves it. Nothing leaves the device, so this is tidiness, not exposure. Fix: after
`kept.setQuery(asked)`, `history.replaceState(history.state, "", location.pathname + location.hash)`,
as the tours and `?print` already do for their parameters.

#### SEC4-2 · Nit · robustness · FIXED (2026-11-07)

> **Fixed:** the decode is in a `try` (`partId`); a fragment that isn't valid
> percent-encoding names no part and the page stays where it is.

**A malformed fragment on `/notebook/` throws after the page is drawn.** `notebook-page.js:442`
runs `decodeURIComponent(window.location.hash.slice(1))`; `/notebook/#%E0` raises a `URIError`
from `start()`, an unhandled rejection logged to the console. The page is already drawn, so
nothing is lost. Fix: wrap the decode in `try`, or compare against the known section ids.

#### SEC4-3 · Standing · the CSP and COOP (Audit 2 decision 5)

The resource allowlist is still `Content-Security-Policy-Report-Only`, with no `report-to`,
and there is no `Cross-Origin-Opener-Policy`. Decision 5 ("not yet") stands and is not
re-argued here. One note for when it is revisited: the desk now keeps reader-written data in
the browser, so the cost of any future injection rose from "a defaced page" to "a notebook
read out"; this audit found no sink that would let one in.

## B. First-time intuitiveness (`FU4`)

What a first visit looks like, with the site's storage cleared: a chapter page with the desk
on shows one "Open in the Study Desk" pill in the toolbar and a vertical "Notebook" tab at the
window's edge; nothing else moves. The tab opens the Notebook on My Notes: the first-use card,
then "Continue reading", then the chapter filter and the empty line "Nothing kept for John 3
yet. Select a verse number, then choose “Add a note,” “Add bookmark,” or “Highlight.”"
Answering the card brings the tour offer beside the panel ("Take the tour now", "Remind me
later", "Don’t show this again"). `/desk` opens with the LIT beside My Notes and makes its
own offer 1.2 seconds later. `/notebook/` opens with a one-sentence explanation and jump
links; `/sheets/` says sheets are made on the Study Desk and links there. All of this reads
well and asks nothing a reader can't answer, with the exceptions below.

#### FU4-1 · Medium · design · for BVJ (D6)

**"Where should your notebook live?" asks a question with one answer.** Both buttons keep the
notebook in this browser; the only difference is a weekly reminder. The title promises a
choice of place (an account, a file, this computer), so a first-time reader pauses to find the
difference, reads two paragraphs, and learns there is none yet. The code's own header says
this is a placeholder "until an account or file option is decided (T3)". Recommendation: make
it a statement, not a question, until there is a second place to offer. A card headed "Your
notebook is kept in this browser" with the lead sentence as it is, one checkbox "Remind me to
save a copy", the Safari line where it applies, the "Ways to keep your notebook" link, and
one button, "Got it". `lit-desk-home` keeps its two values (the checkbox writes
`browser-remind`), so nothing else changes. Not changed here: the card is BVJ's D6 decision.

#### FU4-2 · Low · design · for BVJ (E9)

**On a first visit, "Continue reading" points at the page the reader is on.** The row appears
in My Notes the moment a chapter opens, because the chapter writes `lit_last_read` on
arrival, so a reader on John 3 sees "John 3 · Continue reading · Chapter View" at the top of
an otherwise empty list, and on `/desk` beside a LIT pane already on John 3. It is correct and
harmless, but it reads as a bookmark they didn't make. Recommendation: hide the row when it
names the chapter on the page (the notebook page and other chapters keep it). Not changed
here: E9 made it "the one place that is always there."

#### FU4-3 · Low · FIXED

**`/desk`'s My Notes pane said only "Nothing kept yet."** The panel on a chapter and the
notebook page both say where to start; the pane, which is most first-time readers' first
sight of My Notes, did not. `tab-mine.js`'s fallback now reads "Nothing kept yet. On a
chapter, select a verse number and choose “Add a note,” “Add bookmark,” or “Highlight.”", the
notebook page's sentence, so the three agree.

#### FU4-4 · Low · observation

**The Notebook's header is three icon-only controls** (the Preview badge, the desk link, »).
Each has a title and an accessible name, and the tour's step 5 explains ». Fine as it is; if
a first-time reader is ever seen hunting for "how do I get this out of the way," the » is
the candidate for a word.

#### FU4-5 · Low · observation

**"Notebook actions" under Settings cannot be guessed from its label**, though the window it
opens explains itself in one sentence. The label is BVJ's (2026-11-06, chosen over
"prompts"), so it is noted, not changed.

#### FU4-6 · Nit · observation

The offers and cards all use the same three-answer shape, the same copy register and the same
window; nothing a reader meets in the first ten minutes contradicts anything else. The one
word that shifts is "panel" for the Notebook in the first-use card's second option (fixed,
CP4-1).

## C. The tours (`TR4`)

Both tours were run end to end on a first visit, and the notebook tour a second time after
the fix. Each card sits beside the thing it names, Back and Next work, "Skip this part" hides
in the last part, Escape ends, the page and the Notebook come back as they were, and nothing
is written (the layout key and the notebook were checked after each run). The offer's "It
takes a minute" is about right for both.

**The call: keep both tours as they are built; adjust, don't restart.** The structure
(marking the text, the Notebook, finding and keeping; what's on the desk, changing it) is the
order a new reader needs things in, the steps act rather than describe, and BVJ's cut from 14
to 10 already removed the padding. What is left is one broken step and some wording.

#### TR4-1 · Medium · FIXED

**"Search and commands" (step 9) showed an empty search box.** Two causes. The search bar
closes its tray on any click outside itself (`searchbar.js:1404`), and the Next button's click
was still bubbling when the step dispatched its `input` event, so the tray opened and shut
within the same click. And the query it typed, "notebook", finds nothing in a first-time
reader's empty notebook: even with the tray open, the demonstration was "0 topic matches · 0
keyword matches". Fix in `tour.js`: the step waits a frame before acting, sends the search
bar a `focusin` so it loads its desk part (the commands), types ">" and places its card beside
the box rather than under it. The step now shows the list of ten commands on a chapter page.
The card's words changed to match (`desk-first-use.mjs`): "The search box searches your
notebook as well as the text. Typing “>” lists its commands, such as hiding your marks,
printing, and taking this tour again. Here it lists them." Verified live.

#### TR4-2 · Low · wording · FIXED (BVJ, 2026-11-07)

> **Fixed:** the "Move as I read" sentence is out of "Open the menu" in both views; the
> help page's Bookmarks section and the Edit bookmark form's hint carry it.

**Step 1, "Open the menu", carries four ideas in eight lines**: the verse menu, the selection
panel, that a bookmark stays put, and "Move as I read". The last is an advanced feature a
first-time reader will meet in the Edit bookmark form, whose hint explains it, and in the
help page. Dropping that sentence makes the card five lines. It was folded in when BVJ cut
the tour (2026-11-02), and `test/desk-first-use.test.js:378` records that fold, so this is
BVJ's call.

#### TR4-3 · Low · ordering · FIXED (BVJ, 2026-11-07)

> **Fixed, the first option:** "Pin a footnote" runs in part 2, "The Notebook", right after
> "This verse", whose tab lists the footnotes it pins. Still ten steps; part 1 is three.

**"Pin a footnote" is step 4 of 10, before the Notebook itself is shown.** Pinning is a niche
action; a first-time reader has just seen a note written and placed, and the next most useful
thing is the panel that keeps it (step 5). Two options: move "Pin a footnote" after "This
verse" (where footnotes are already on screen), or send it to the help page and run nine
steps. Either keeps the three parts.

#### TR4-4 · Low · wording

**"Undo, and a clean page" bundles two unrelated things**, Undo and "Hide my marks". Both are
worth a sentence and the pairing saves a step, so keep it, but the title could name both:
"Undo, and Hide my marks". Not changed: a one-line preference, left for BVJ.

#### TR4-5 · Low · wording · desk tour · FIXED (BVJ, 2026-11-07)

> **Fixed:** the two sentences are one: "For the tour the desk shows its original layout,
> and yours comes back at the end."

**"Your panes" ends with two sentences a first-time reader has no use for**: "For the tour the
desk shows its original layout. Yours comes back at the end." They matter only to a reader
replaying the tour with a layout of their own, and the offer already says "Nothing it does is
saved." Suggest one clause, "The desk shows its original layout for the tour; yours comes back
at the end," or moving it into the offer. The three later "only for the tour" lines (Stay
here, Add pane, Layout) earn their place, since each visibly changes the desk.

#### TR4-6 · Nit · wording · desk tour · FIXED (BVJ, 2026-11-07)

> **Fixed:** "With two LIT panes open, as here for the tour, the one you selected most
> recently is marked with a flag." BVJ's sentence otherwise stands.

**"Reading in sync" adds a second LIT pane without saying so.** "With two LIT panes open, the
one you selected most recently is marked with a flag" implies the reader opened them. Suggest
"A second LIT pane was added for this step: the flag marks the one you worked in last, and the
others follow it."

#### TR4-7 · Nit · observation

The dashed outline rule from E30 is applied consistently: controls are outlined, the page's
own text and the whole My Notebook row are not. The card never covers what it points at
except on step 9, which TR4-1 moved beside the box.

## D. Copy (`CP4`)

Every string of two or more words in the desk's code was read against the house rules
(American spelling, periods inside quotes, the Oxford comma, curly quotes, no em dashes,
"the Notebook" for the panel and "notebook" for what is kept, "Delete" for words and "Remove"
for marks, "Study Desk" for the feature). The copy holds to them. These were changed:

- **CP4-1** `first-use.js`: the second option's note began "The same, and the panel reminds
  you…". Now "Also kept in this browser, and the Notebook reminds you when it has been a week
  since your last copy…" ("the Notebook" by rule 10; the phrase "been a week since your last
  copy" is held by `test/desk-copy-constants.test.js`).
- **CP4-2** `commands-window.js`: "Type “>” in the search box to list these, or the start of a
  few of their words, such as “hide marks.”" read awkwardly. Now "…or type the first words of
  one, such as “hide marks.”"
- **CP4-3** `export-import.js`: the Markdown format's line "Words you change here come back in
  when you open it" was unclear about where "here" was. Now "Opens in any text editor, and
  words you change there come back when you open the file here."
- **CP4-4** `tab-mine.js`: the bare "Nothing kept yet." now carries the notebook page's hint
  (FU4-3).
- **CP4-5** `search-sheet.js` (two places), `sheet-pane.js`, `sheet-page.js`: the private-window
  notice in sheet contexts ended "Open the site in a regular window to keep notes" while the
  sentence was about sheets. Now "…to keep sheets."
- **CP4-6** `desk-first-use.mjs`: the search step's card (TR4-1).

Read and left alone, with a note:

- **CP4-7** `greek-builder.js:431`, "Read as a construction of these words…": specialist
  wording for a specialist tool; a reader who reaches the builder knows the word.
- The pages' "preview is off" notes (`desk.astro`, `notebook.astro`, `sheets.astro`) are
  outside the switch and were not touched; they read true for no-JS and phones.
- The help page reads well whole; its lede's "switched on for a few readers while it is tried
  out" is right for the preview and will go with the flip.

## Not covered

The sheet editor's toolbar and dialogs were read, not driven; no document or slide file was
generated; no screen reader, Safari or Firefox pass. The security re-check of SEC3-3 and
SEC3-5 is from the audit record and the code, not a generated file.
