# Study Desk Audit 5: Sheets

Audited 2026-11-07 at commit `19e263e5` (`main`), on BVJ's brief: an exhaustive audit of the
Sheets, as a new user who is a ministry leader preparing to work with people. Every template,
every command, every part type, and combinations of parts within each template; how intuitive it
is and how it could improve; and the templates' auto-populated text, which BVJ wants replaced
with ghost text prompts so that no actual text sits in a field. BDR added a flipside: what the
comparable apps and services do (Logos and the rest), for semi-academic study, sermon
preparation, and small-group guides. Nothing was changed in this audit; every finding is a
recommendation, and the fixes are proposed, not shipped.

Method: the Sheets code was read first (`desk-sheets.mjs`, `desk-sheet-templates.mjs`,
`desk-sheet-format.mjs`, `sheet-pane.js`, `sheet-text.js`, `sheet-lit.js`, `sheet-page.js`,
`sheet-present.js`, `search-sheet.js`, the share, copy, check, discussion, and gather rules, and
the help page's Sheets section). Then a first visit in the browser pane at 1500×950 with an empty
notebook (the notebook database held no records; a fresh origin was not available, so the earlier
sessions' tour deferrals and layout stayed in local storage, which touches none of this). From
/desk with the preview on: finding the Sheet pane, each of the five templates in turn, a title and
subtitle, a passage by typed reference, by the LIT pane's verse menu, and by a selection, blanks by
key term, by keyboard, and by selection, hints, the footnote choices and the give-away flag, every
add button, Move up and down, Remove and undo, Leader only, the commercial check, every toolbar
button and menu, Duplicate and Delete. Then the sheet's own page: both versions, paper, QR codes,
Copy, the Save as menu, the Share dialog and its link, Present with reveal and footnotes, the
presenter view, a shared link opened and imported, and a sheet made from /search. Print and the
file downloads were not run (a print dialog and a file save need the person's hand), and the
wording-changed notice can't be provoked without changing the text; both are unit-tested.

IDs carry a 5 (`SH5-`) so they never collide with the earlier audits'. Severity: High, Medium,
Low, Nit, Observation.

**Status (2026-11-07, same day):** on BVJ's instruction to implement everything that needed no
decision of theirs, SH5-1 to SH5-14 shipped on this audit's branch, with SH5-17's small things except
the page break's Leader only box and the "fill in" wording; SH5-15 (shared reader code) and SH5-16
(BVJ's call on the give-away flag) stayed open. **On 2026-11-08 BVJ decided the rest:** the flag
widens to a traditional word the hint doesn't show (SH5-16), the drag onto a term is fixed in the
shared lens (SH5-15), Lectio divina keeps prompts rather than printed lines, the page break loses
its Leader only box, and "fill in" stays with a help paragraph (SH5-17). The same day BVJ asked for
a way to add a part between parts without scrolling to the add bar. A "+" in every card's header
was the first answer and BVJ sent it back the same day: it didn't say it added *after* that card,
sitting at the top made that worse, and its "Passage…" opened the bar's form at the sheet's end,
which felt like a glitch. Now the space between two parts shows a line with an "Add" pill when
pointed at (BVJ's suggestion; it lies over the cards and takes no room), the pill's menu adds the
chosen part right there, and "Passage…" opens the passage form under the part above. The pane is
also renamed "Sheets" (it was "Sheet"). No finding in this audit is open; section D's recommendations were decided on 2026-11-08 and are marked there, with Discovery Bible Study and an inductive study (#3) still under discussion. The ghost prompts took section B's Design 2, an optional
`prompt` field, chosen by Claude under that instruction and reversible; Lectio divina's movement
lines became prompts too, under the rule that no field starts with text. The toolbar (SH5-6) is drawn
below the focused part, so clicking into a part grows the card downward instead of moving the words
under the pointer. Each fix is marked on its finding.

## Bottom line

**One real bug, and it is a bad one: three of the editor's menus do nothing.** Choosing a
paragraph style (Heading, Subheading, Quotation), a text alignment, or anything under Style (font,
size, color, background) closes the menu and applies nothing, with an uncaught exception in the
console (SH5-1). Bold, italic, underline, lists, links, the horizontal line, and clear formatting
all work. A leader who wants a heading in a part they wrote cannot make one today.

**The templates do the opposite of what a template should.** Every template but Blank canvas
ships sentences that print and go up on the room's screen as they stand ("A word of welcome, and a
moment of quiet before reading." printed on both versions of my Bible study sheet and showed on
screen 2 of the presentation; the Class session's first question carries a sample answer that
prints on the leader's version). BVJ's direction is right, and section B lays out every such
string and a design for ghost text that never prints (SH5-2).

**Where a passage lands is the next most confusing thing.** The reading part's ghost hint promises
the passage will go there, and it does on an untouched sheet. The moment the leader has clicked
into any part, the "after the part last worked in" rule wins, and passages land out of order or at
the end while the hint vanishes (SH5-3, SH5-4). Twice in this audit a passage landed somewhere
other than where the sheet said it would.

**Everything else is solid and often better than the comparable tools.** Blanks with hints, the
footnote choice that flags a give-away, the key terms box, the commercial check, leader and
participant versions, the QR codes, Present with reveal, the presenter view, sharing without a
server, Duplicate, undo everywhere, and a 110-passage sheet from a search that drew in under six
seconds. The rough spots are a first-time reader's path to the Sheet pane (SH5-5), a toolbar on
every part (SH5-6), and a handful of focus and default-value details (SH5-7 to SH5-14).

## A. Findings (`SH5`)

#### SH5-1 · High · bug · the Paragraph style, Text alignment, and Style menus apply nothing · FIXED (2026-11-07)

What happens: in any part's toolbar, open Paragraph style and choose Heading (mouse or keyboard):
the menu closes, the text stays a paragraph, the toolbar still says "Paragraph," and focus falls
to the page body. The same for Subheading and Quotation, for every alignment, and for every font,
size, color, and background under Style. The console shows, on every choice:

```
Uncaught NotFoundError: Failed to execute 'remove' on 'Element': The node to be removed is no
longer a child of this node. Perhaps it was moved in a 'blur' event handler?
    at close (sheet-text.js:723)
    at HTMLButtonElement.<anonymous> (sheet-text.js:766)
```

Why: the menu item's click handler runs `close(false)` and then `pick(...)`. `close()` calls
`openMenu.menu.remove()` while the focused menu item is inside that menu. Removing a focused
element fires `blur`, and the editor's own `focusout` handler (`el.addEventListener("focusout", …)`,
which closes menus and flushes a dirty edit) runs `closeMenus()` in the middle of that removal,
removing the same menu a second time. The outer `remove()` then finds the node is no longer a child
and throws, so `pick()` never runs. The handler has been there since the editor's first commit
(2026-10-19); either the menus have never applied anything, or Chromium began firing blur
synchronously on removal and the sequence became fatal since. Verified three ways: a real mouse
click, the keyboard (Arrow and Enter on the item), and a programmatic click; a logged event trace
shows the click reaching the item and no focus ever returning to the text. A twelve-line
reproduction in the same page (a focused button inside a box, a `focusout` handler on the box that
removes it, then `remove()` on it) throws the same NotFoundError in Chrome 152, which the pane
runs. The desk's other menus are safe from this because their `focusout` handlers act only when
`relatedTarget instanceof Node` (focus going nowhere, as on removal, is left alone: desk-page.js,
title-menu.js, sheet-save.js, panel-flyout.js); the editor's handler is the one that closes on any
focus loss.

Fix (small): in `close()`, take the menu out of `openMenu` before removing it, so a re-entrant
`closeMenus()` finds nothing to close:

```js
function close(refocus) {
  if (openMenu?.button !== button) return;
  const { menu } = openMenu;
  openMenu = null;
  menu.remove();
  button.setAttribute("aria-expanded", "false");
  button.removeAttribute("aria-controls");
  if (refocus) button.focus();
}
```

Verified live during the audit: with those lines in place (applied on the branch, then reverted,
since this audit changes nothing), choosing Subheading in the Opening part gave `<h3>`, the toolbar
read "Subheading," focus came back to the text, the sheet saved, and no error reached the console.
The keyboard path runs the same handler. Still to do with the fix: try each of the three menus in
Chrome, Firefox, and Safari (the desk's unit tests run without a DOM), and log it as the next E
number in `STUDY-DESK-FIXES.md` when it ships.

#### SH5-2 · Medium · design · the templates hold real text where prompts belong (BVJ's brief) · FIXED (2026-11-07)

What happens: four of the five templates fill their parts with sentences a leader is meant to
replace. Left as they are, they print on both versions and appear on the room's screen. Seen on
paper and on screen in this audit: "Opening / A word of welcome, and a moment of quiet before
reading." and "Closing / A prayer, a blessing, or a word for the week ahead." on the Bible study
sheet, both versions, and as screen 2 of the presentation. The Class session's first question
carries the answer "An answer for the leader's version.", which prints on the leader's version. The
full list is in section B, with the proposed prompts and the design. Only the reading part already
does this right: its instruction is ghost text the sheet never holds (BA70). E56 (2026-11-06) gave
the Question and Your text fields their generic ghost text but noted that "every template fills
its questions in," so the ghost text never shows on a template's own parts; this finding is the
other half of that entry.

Fix: section B.

#### SH5-3 · Medium · design · a passage lands wherever the leader last clicked, not where the sheet says · FIXED (2026-11-07)

What happens: on a fresh template a passage goes under the reading part (Reading, Read, The text),
as the ghost hint there promises. But `insertIndex` puts a new part after the part last focused or
clicked, and that rule wins for passages too. Seen twice: on the Bible study sheet, after a click
in the Romans 8:1–4 card, a selection from Romans 8:6 landed between 8:1–4 and 8:5, so the sheet
read 8:1–4, 8:6, 8:5; on the Sermon sheet, after a click in the last part, Luke 4:16–21 landed at
the very end while "The text" above still carried the hint "Add the passage with + Passage." A
leader who has typed a title, clicked around to read the template, and then adds the passage meets
this on their first sheet.

Fix: for passages only, drop the "last worked in" rule unless the part last worked in is itself a
passage (so adding a second passage right after the one being edited still works): a passage goes
after the last passage, or into the reading part while the sheet has none, or at the end. Text,
questions, spaces, and page breaks keep the current rule, which is right for them. Announce the
place as now ("added after Romans 8:1–4").

#### SH5-4 · Medium · design · the reading hint keys on the sheet, not on the part · FIXED (2026-11-07)

What happens: the hint "Add the passage with + Passage, or from the LIT pane's verse numbers."
shows under the reading heading until the sheet has any passage. Two wrong moments follow. Type a
sentence under "Reading" ("Read it aloud, slowly.") and the hint stays beneath your own words,
reading like a stray instruction. Add the passage somewhere else (SH5-3) and the hint vanishes
though the part is still empty. In Lectio divina the hint sits under the template's own paragraph
from the start.

Fix: show the hint while the reading part holds nothing but its heading and no passage sits
directly after it; hide it once the leader types in that part. With section B's design, this hint
becomes that part's prompt and follows the same rule as every other prompt.

#### SH5-5 · Medium · first use · a new leader has no path to a sheet · FIXED (2026-11-07)

What happens: /desk opens on the LIT beside My Notes. Nothing on the screen says sheet, handout,
print, or present. The way in is the title menu, then "Add pane," then "Add column" or "Add row,"
then a list of one-word kinds (The LIT, My Notes, This verse, Greek, Footnotes, Book Intro, Sheet,
Search), three levels down, with no description of what a Sheet is. The Sheet pane's own empty
state explains it well ("A sheet gathers passages and your own words into a handout for a study, a
class, or a sermon…"), but only once found. The desk tour (Audit 4) does not show the Sheet pane
either.

Fix, in order of weight: a "New sheet…" item in the title menu that adds a Sheet pane and opens the
template chooser in one step; a one-line description under each kind in the Add pane list (the
kinds menu already has room, and the help page has the sentences); and a tour step that adds a
Sheet pane. The pane's empty-state sentence can also name /sheets/ for printing.

#### SH5-6 · Medium · design · a formatting toolbar on every part · FIXED (2026-11-07)

What happens: every text part and both fields of every question draw the full toolbar (Paragraph
style, B, I, U, S, superscript, subscript, link, two lists, indent, outdent, alignment, Style, rule,
clear), wrapped to two rows at the pane's width. The Bible study template opens with ten toolbars in
a pane about 470px wide; a leader sees a wall of controls before any content, and the sheet reads as
a form rather than a document. The comparable tools (section D) show one toolbar for the active
editor.

Fix: one toolbar per Sheet pane, shown for the editor that has focus (at the top of its card, or
pinned above the parts list), with the same buttons; a part without focus shows its text only. The
toolbar's roving tabindex and `aria-controls` already point at one editable at a time, so the
change is mostly where it is drawn. Keep the "Answer (leader's version only)" label.

#### SH5-7 · Low · design · a question added with "+ Question" has no lines to write on · FIXED (2026-11-07)

What happens: the templates' questions have "Lines to write on 3"; a question added with the button
starts at 0, so on the participant version it prints as a bare question with nowhere to write
unless the leader notices the number field.

Fix: start a new question at 3 lines, the templates' value (`DEFAULTS.question` in
`desk-sheets.mjs` and `questionHtml`'s caller in the discussion rules already pass 3).

#### SH5-8 · Low · design · an empty part gets a blank screen in Present · FIXED (2026-11-07)

What happens: an empty text or question part (one added and never filled, as a leader will do)
becomes a screen of its own: screen 6 of my presentation was a black screen with nothing on it. On
paper an empty question prints nothing, so the two disagree.

Fix: `presentScreens` skips a text or question part whose html is empty, as the paper copy does.

#### SH5-9 · Low · design · blanks are listed one row per occurrence · FIXED (2026-11-07)

What happens: blanking "self-preservation" (four times in Romans 8:1–4) makes four rows, each with
the same hint select and its own ×, interleaved in reading order with the other terms' rows. With
three terms and one phrase blanked the list ran to nine rows. Changing the hint for one term means
four selects. The chip row above already works per term.

Fix: group a term's blanks under one row (the term, "4 times," one hint select, one ×), keeping a
row per phrase blank; or at least order rows by term. The record needs no change (the hint is
written to each blank as now).

#### SH5-10 · Low · accessibility · focus falls away after several actions · FIXED (2026-11-07)

What happens: after × on a blank's row, focus goes to the page body; after "+ Space" or
"+ Page break," focus lands on the new card's "Leader only" checkbox rather than its own field or
its grip; after "Import into my notebook" on /sheets/ and after "New sheet" in the /search gather
panel, focus goes to the top of the page ("Skip to content").

Fix: after removing a blank, focus the next blank's × or the Blanks heading; after adding a space
or page break, focus the lines field (space) or the card's Move up button (page break); after an
import or a gather, focus the status line or the "Open it on the Study Desk" link.

#### SH5-11 · Low · first use · the "+ Passage" field doesn't take focus · FIXED (2026-11-07)

What happens: pressing "+ Passage" opens the reference field at the bottom of the parts list, but
focus stays on the button, so the leader must click again before typing. The template chooser and
the link form both focus their first control.

Fix: focus the reference field when the form opens.

#### SH5-12 · Low · layout · a blank's custom hint pushes its × onto a new line · FIXED (2026-11-07)

What happens: with "My own hint…" chosen, the row holds the words, the verse, the select, the text
field, and the ×; at the pane's width the × wraps to a line of its own under the row.

Fix: let the text field take the row's remaining width and keep the × in the row, or put the hint
field on a second line by design.

#### SH5-13 · Low · design · the Sermon template's key terms box sits in the middle · FIXED (2026-11-07)

What happens: the Sermon preparation template orders The text, First reading, Key terms box,
Context, The good news here, Outline, For the congregation. On paper the box prints between the
preacher's first notes and the context section; every other template puts it near the end.

Fix: move the box after "For the congregation," or before "Outline."

#### SH5-14 · Low · design · a passage made from a selection prints as a bare fragment · FIXED (2026-11-07)

What happens: a selection added from the LIT pane becomes a passage headed by its verse ("Romans
8:6") with only the selected words ("death, but the thought pattern of the"). The card gives no sign
it is a part of the verse, and the copy prints the fragment as it stands, cut mid-phrase if the drag
was.

Fix: head the card "Romans 8:6 (part)" and print a fragment with leading and trailing ellipses when
it starts or ends mid-verse; the stored `quote` already tells which.

#### SH5-15 · Observation · a drag that ends on a key term opens the term card instead · FIXED (2026-11-08)

In the LIT pane, a selection whose mouse-up lands on an underlined key term (frequent in Romans 8)
opens the term lens card, and the selection panel with "Add to sheet" never appears. Shared reader
code, not the sheets'; noted here because a leader gathering passages meets it often.

*Fix (BVJ, 2026-11-08):* the cause was the lens's hover card, not its click. A drag that paused on
the term for the hover delay before its release opened the card mid-drag, which cut the selection
to its first word; the click handler already stood aside for a live selection. The lens now ignores
a pointer with a button down and leaves a selection that formed during the delay alone
(`term-lens.js`), so the selection panel appears as it does elsewhere. Chapter View shares the fix.

#### SH5-16 · Observation · the give-away flag reads the LIT's words only · FIXED (2026-11-08)

Blanking "self-preservation" did not flag footnotes a, b, and d ("Traditionally, 'flesh'"), since
the rule matches the blanked words, not the traditional word, and that word is the hint beneath the
blank anyway. Right by design when the hint is the traditional word; when the leader chooses "No
hint," a footnote naming the traditional word does give the answer away. BVJ's call whether the
flag should widen in that case.

*Fix (BVJ chose to widen it, 2026-11-08):* a printing blank now carries a `telltale`, the
traditional word of the term its words render, when its hint does not already show that word: with
"No hint" always, with a custom hint unless the hint names the word, never with the traditional hint
(`blankWords` in `desk-sheet-lit.mjs`). A footnote naming the telltale is flagged like one that
repeats the blank's words, in the editor, on paper, and in Present, and the flag's sentence names
the word ("deviation," traditionally "sin"). The key terms box is unchanged: it prints the
traditional word by design, and the leader chooses whether it is on the sheet.

#### SH5-17 · Nit · small things seen along the way · FIXED (2026-11-07, 2026-11-08)

- "+ Key terms box," when the sheet has one, is disabled with its reason only in the title and the
  accessible description; a word beside it ("already on the sheet") would say so to the eye.
- A page break offers "Leader only" and Move; a leader-only page break is meaningful but odd.
  *Dropped (BVJ, 2026-11-08):* a page break's card offers Move and Remove only; a break is on both
  versions. The format still allows `leaderOnly` on one, and a sheet that has it keeps it.
- Removing one of a term's blanks announces "“deviation” filled in again." while two remain blank.
- The Share dialog opens with focus on its × rather than on "What to share."
- The /search gather panel lists sheets by name and part count only; two sheets named "Come to me"
  (an original and an imported copy) can't be told apart there. The subtitle or the changed date,
  as the Sheet pane's list shows them, would do.
- The template chooser describes each template in one line; a short list of its parts would set
  expectations better ("Opening · Reading · 3 questions · Key terms · Closing"). **Added, then
  dropped (BVJ, 2026-11-08):** to a new reader the list read as noise, almost a mistake, since the
  description already says what the sheet holds in words. The one line stays.
- "Fill in" is the verb for undoing a blank in every label and announcement; "unblank" is what a
  leader will look for first. Keep "fill in" if BVJ prefers it, but add it to the help page.
  *Kept (BVJ, 2026-11-08):* "fill in" stays, and /desk/help gains a Blanks paragraph that says how
  a blank is made, hinted, flagged, and filled in again.

### What worked well

A first-time reader meets: a clear empty state; a title field that takes focus; autosave with
"Saving…" and "Saved"; undo for everything, from a moved part to a typed change made in another
part; the key-term chips, which make a fill-in-the-blank handout in two clicks; the keyboard route
to any blank (arrow by word, Enter); the footnote list with Select all, Clear all, and the amber
give-away note; the key terms box filling itself as passages arrive; "Show in the LIT"; the
verse menu and the selection panel offering the same "Add to “<sheet>”" row; the commercial check's
plain sentences; the sheet page's bar with versions, paper, QR codes, Copy, Save as, and Share; the
participant version's blanks with hints beneath and its key terms box note; Present's covers in the
traditional word, the reveal, the footnotes box, the presenter view with notes, the next screen and
a clock; a share link that never reaches a server and an import that becomes the reader's own
sheet; a 110-passage sheet from a search drawn in under six seconds; Duplicate and Delete with
undo. Every message read in American conventions, none in jargon.

## B. The templates' text, and ghost prompts in its place

### What each template holds today

Every string below is real text in a module's `html` (or `answer`), so it prints on both versions
and goes up in Present unless the leader deletes it. Headings are structure and should stay.

| Template | Part | Text that prints today |
|---|---|---|
| Bible study | Opening | A word of welcome, and a moment of quiet before reading. |
| | Reading | (heading only; the hint is ghost text already) |
| | Question 1 | What word or phrase stands out to you? |
| | Question 2 | What does this passage show about God, about people, and about the world? |
| | Question 3 | Where does this passage meet your life this week? |
| | Closing | A prayer, a blessing, or a word for the week ahead. |
| Sermon preparation | The text | (heading only) |
| | First reading | What I notice, what puzzles me, and what I want to look up. |
| | Context | Who wrote this, to whom, and what was happening around them. |
| | The good news here | What this passage offers the people who will hear it. |
| | Outline | 1. Opening 2. The text 3. The turn 4. Sending (a numbered list) |
| | For the congregation | One thing to carry into the week. |
| Class session | Goals for this session | • Goal (a bulleted list with one item) |
| | Reading | (heading only) |
| | Background (Leader only) | Notes for the leader: history, setting, and the words worth explaining. |
| | Question 1 | What is happening in this passage? Answer: An answer for the leader's version. |
| | Question 2 | What did you notice in the LIT's wording? |
| | Next time | The reading for next week, and anything to bring. |
| Lectio divina | Read | Read it slowly, aloud if you can, and notice a word or phrase that catches you. |
| | Reflect | Read it again. Stay with that word or phrase, and ask what it stirs in you. |
| | Pray | Read it a third time. Answer God in your own words, or with none. |
| | Rest | Let the words go, and rest in God's presence for a few minutes. |
| Blank canvas | (one text part) | nothing; the editor's placeholder shows |

Two kinds of text are mixed here. Most lines are instructions to the leader about what to write
("Who wrote this, to whom…"), which should never print. The Bible study's three questions and
Lectio divina's four movements are closer to content a leader might keep; even so, BVJ's rule is
that no field starts with text, and a prompt that says the same thing in the second person serves
both cases.

### The proposed prompts

Shown dimmed and in italics inside the field, like the reading hint, until the leader types; never
stored, printed, copied, shared, or presented.

| Template | Part | Prompt |
|---|---|---|
| Bible study | Opening | How you will begin: a welcome, a prayer, a moment of quiet. |
| | Reading | Add the passage with + Passage, or from the LIT pane's verse numbers. |
| | Question 1 | A first question for the group, such as "What word or phrase stands out to you?" |
| | Question 2 | A question about the passage, such as "What does it show about God, about people, and about the world?" |
| | Question 3 | A question that reaches into the week, such as "Where does this passage meet your life right now?" |
| | Closing | How you will end: a prayer, a blessing, or a word for the week ahead. |
| Sermon preparation | The text | Add the passage with + Passage, or from the LIT pane's verse numbers. |
| | First reading | What you notice on a first reading, what puzzles you, and what you want to look up. |
| | Context | Who wrote this, to whom, and what was happening around them. |
| | The good news here | What this passage offers the people who will hear it. |
| | Outline | Your outline, one line per movement: how you open, the text, the turn, the sending. |
| | For the congregation | One thing to carry into the week. |
| Class session | Goals for this session | What the class should know or be able to do by the end. One goal per line. |
| | Reading | Add the passage with + Passage, or from the LIT pane's verse numbers. |
| | Background | Notes for you as leader: history, setting, and the words worth explaining. These print on the leader's version only. |
| | Question 1 | A question about what happens in the passage. |
| | Question 1 answer | Optional. The answer you expect, or notes for you as leader. It prints only on the leader's version. |
| | Question 2 | A question about the LIT's wording, such as what a key term's traditional word was. |
| | Next time | The reading for next time, and anything to bring. |
| Lectio divina | Read | How to read: slowly, aloud if you can, noticing a word or phrase that catches you. |
| | Reflect | How to reflect: read it again and stay with that word or phrase, asking what it stirs. |
| | Pray | How to pray: read it a third time and answer God in your own words, or with none. |
| | Rest | How to rest: let the words go, and rest in God's presence for a few minutes. |

Lectio divina is the one template where BVJ may want the printed lines kept, since the four
movements' instructions are what a participant's sheet usually carries. The prompts above assume
the rule holds everywhere; if the lines stay, they should at least be the only template text that
does, and the hint should not sit under them (SH5-4).

### How to build it

Two designs were weighed.

**Design 1: prompts keyed by template and heading, drawn by the editor (no record change).**
`desk-sheet-templates.mjs` gains a table of prompts by template id and the part's opening heading
(as `READING_HEADINGS` keys the reading part today), and `partPrompt(sheet, module)` returns the
prompt while the module's html is exactly its heading (`^<h2>…</h2>$`) or empty. The Sheet pane
sets it as the editor's `data-hint`, the mechanism `READING_HINT` already uses (a `::after` with
`aria-description`), and the templates ship headings only. Questions have no heading to key on, so
their prompts would key on position among the template's questions, which drifts once a leader
reorders or deletes one. Nothing is stored, so a sheet made before the change keeps its text, and
the apps see nothing new.

**Design 2: an optional `prompt` field on text and question modules (recommended).** A template's
module carries `prompt: "How you will begin…"` (and a question its `answerPrompt`); the editor
shows the prompt as ghost text while the field holds only a heading or nothing, and every copy,
share, and presentation ignores the field (`modulesForCopy`, `sharedSheet`, `presentScreens` read
`html` only, so this is already true once the sanitizer leaves the field alone). `validateSheet`
accepts an optional string up to a short limit; an older reader keeps the field whole under
principle 6, and the format section in `STUDY-DESK-FORMAT.md` gains three lines. The reading hint
becomes the reading part's prompt, so SH5-4 is fixed by the same change, prompts survive reordering,
and the apps can show them. The cost is a small format addition, which is why it is BVJ's call; it
is the cleaner of the two by some distance.

Either way: the templates' tests (`desk-sheet-templates.test.js`) already check that template text
never mentions the editor's tools; they should also check that no template text part holds anything
but a heading and no question holds text, so the rule can't erode.

## C. Combinations tried

| Template | What was added or changed | Result |
|---|---|---|
| Bible study | title, subtitle; a sentence under Reading; Romans 8:1–4 by typed reference; blanks by chip (deviation ×3, self-preservation ×4, justice), by keyboard ("verdict against"), a custom hint, one blank removed; footnotes Clear all and Select all; Romans 8:5 from the verse menu; a selection from Romans 8:6; Move down and Ctrl+Z; + Your text with bold, italic, a link, a list, a rule, clear formatting; + Question; + Space; + Page break then Remove and Undo; + For discussion with no question notes; commercial check on and off; Print or share…, both versions, QR off and on, Copy, Save as menu, Share link, Present with reveal and footnotes, presenter view | all as described above; SH5-1, SH5-3, SH5-4, SH5-7, SH5-8, SH5-9, SH5-10, SH5-12 seen here |
| Sermon preparation | title; a click in the last part; Luke 4:16–21 by typed reference | passage landed at the end, not under The text (SH5-3); key terms box mid-sheet (SH5-13) |
| Class session | title; Mark 2:1–12 by typed reference with no part touched | landed under Reading as promised; Background's Leader only preset is a good demonstration; the sample answer prints (SH5-2) |
| Lectio divina | title; Matthew 11:28–30 by typed reference; participant share link opened in the same browser and imported | landed under Read; the hint sat under the template's paragraph (SH5-4); the shared copy and the import worked |
| Blank canvas | title; Philippians 4:4–7; Duplicate, then Delete the copy with undo offered | passage at the end as designed; "(copy)" title and focus in the title; delete announced with Undo |
| From /search | "Make a sheet of these verses" for 119 hits on "liberation" | a sheet of 110 passages, opened on /desk and drawn in under six seconds |

Not tried: drag by the grip with the mouse (Move up and down and their announcements were),
Print and "Save as PDF," the .docx, .odt, .rtf, .pptx, and .odp files (a save needs the person's
hand; the writers have golden-file tests), two tabs on one sheet, a sheet at the 300-part or 512 KB
limits, "+ For discussion" with question notes present, the wording-changed notice, A4 on paper.

## D. The comparable apps and services (BDR's flipside)

Researched 2026-11-07 from the vendors' documentation, help pages, sample guides, and user forums
by a parallel research pass; nothing was installed or run, so a vendor's claim may have changed and
"not found" means not found in the pages reached, not absent. The products: Logos Sermon Builder,
Bible Study Builder, and Faithlife Proclaim; Accordance, Olive Tree, Blue Letter Bible, STEP, Bible
Hub, and Bible Gateway Plus; Sermonary, Sermonly, SermonCentral, Pulpit AI, and Planning Center;
Subsplash, Tithely, and My Sermon Notes; YouVersion Events and Plans; Sefaria source sheets, the
model for S1; Lifeway's Explore the Bible and Life Connections, Zondervan's and Hendrickson's
video-study guides, and RightNow Media; the Discovery Bible Study, inductive, Swedish, and SOAP
worksheets; Soul Shepherding's lectio divina groups, Lectio 365, and Pray As You Go; ProPresenter,
EasyWorship, MediaShout, FreeShow, OpenLP, PowerPoint, and Google Slides; route.bible.

**Bottom line: no comparable makes a leader's and a participant's printout, blanks, Word and
slide files, and a room presentation from one document kept in the browser.** Sefaria comes
closest in shape (source and comment blocks, Google Docs and PDF export, a copy per student) and has
no blanks and no presenting. Logos has the blanks and the slides behind a subscription, with forum
reports of answers leaking into handouts and of fill-in slides not generating. Ghost-text
placeholders in a template were found nowhere in the landscape: templates there are pre-filled
structure with guiding questions (Subsplash's outline, Notion church templates) or wizards
(MediaShout, Logos). That is worth knowing for section B: a worksheet whose fixed prompts are the
thing the participant answers (the eight Discovery questions, Observe, Interpret, Apply) is a
different object from a leader's own text, and the Bible study template's three questions are the
one place the Sheets sit near that line.

### The matrix

| Product or format | Templates and prompts | Leader and participant | Blanks | Questions | Export | Present | Account |
|---|---|---|---|---|---|---|---|
| Logos Sermon Builder, Bible Study Builder | starter outlines, AI drafts | Text view and Handout view | fill-in, Hide answers, paired slides | question library and AI bank | Word, PDF, PowerPoint, Proclaim | Preaching Mode | subscription |
| Sefaria source sheets | copy a sheet | a copy per student | none found | comment blocks | Google Docs, PDF | none found | account |
| Sermonary | 3-point, verse-by-verse, own templates | none found | none found | none found | PDF, Word, slides | Podium Mode | paid |
| Planning Center | save a plan as a template | per-team notes | outline blanks, reveal in the app | none found | PDF with page size | none found | paid |
| Subsplash, Tithely, My Sermon Notes | outline builder | none found | fill-in notes, answer check | none found | notes PDF | none found | church plan |
| Lifeway, Life Connections | fixed lesson parts | leader guide and personal study guide | none found | leader-only extras | print | none found | purchase |
| Zondervan, Hendrickson, RightNow | fixed session schedule with minutes | participant guide and leader's guide | fill-ins with the key line below | numbered group questions | print, free leader PDFs | video-driven | purchase |
| Discovery, inductive, Swedish, SOAP | three to eight fixed prompts | one sheet for all | write-ins | built in | worksheets | none | none |
| Lectio divina guides | three timed rounds | leader outline, journal handout | none | a focus question per round | none found | audio apps | free apps |
| Proclaim, ProPresenter, EasyWorship, MediaShout | themes, Quick Screens, a wizard | none | fill-in reveal (ProPresenter) | none | save as a presentation | presenter view, stage display, remote | paid |
| FreeShow, OpenLP | templates, layout styles | none | none | none | several formats | browser stage view | free |
| Reference apps (Accordance, Olive Tree, Blue Letter, STEP, Bible Hub, Gateway Plus) | none | none | none | none | print, copy, CSV | Accordance slide show | mixed |

### Conventions a ministry leader will expect

1. **Separate leader and participant copies**, the leader's with commentary, extra questions,
   answers, and timing (Lifeway, Zondervan, Hendrickson, Logos, Planning Center). The Sheets do this.
2. **Minutes beside each part and a session total** (Zondervan's 60 to 90 minutes, Hendrickson's 60
   or 75, Planning Center's item lengths). Not in the Sheets.
3. **A repeatable arc**: Open, Consider, Apply; the Discovery questions; Observe, Interpret, Apply;
   the Swedish bulb, question mark, and arrow; SOAP; three lectio rounds. The Sheets' templates are
   arcs of this kind; the recognized formats are not among them.
4. **Blanks filled while listening, with the answers kept elsewhere**: the key line below the
   blank (Zondervan), a toggle (Logos), tap to reveal (Planning Center), an answer check (Tithely).
   The Sheets do this, and reveal on screen too.
5. **Writing room and between-meeting work** (Zondervan, Hendrickson). Space to write exists;
   "before next time" is a template question.
6. **Type a reference to insert a passage** (Logos, Proclaim's double brackets, ProPresenter,
   EasyWorship, MediaShout). The Sheets do this.
7. **Verse display choices on screen**: one verse per slide, per line, or continuous; the
   reference on every, the last, or no slide (ProPresenter, OpenLP). The Sheets show a passage whole
   and cut long ones at verse numbers only.
8. **A presenter view** with the next slide, notes, a clock or timer, and a second display
   (PowerPoint, Proclaim, MediaShout, OpenLP, Google Slides). The Sheets have it.
9. **Notices**: initials after quotations in non-saleable media and the full notice elsewhere
   (Crossway's ESV terms); quote limits and notice lines in one table (Sermonary). The Sheets print
   one full notice and check the commercial share.
10. **Reuse last week**: save or copy a plan, duplicate an event, keep your own templates (Planning
    Center, YouVersion, Sermonary). The Sheets have Duplicate only.
11. **Question help**: banks and AI starters with review (Logos, Pulpit AI); leader-only extras
    (Lifeway). Not in the Sheets beyond the templates' own questions.
12. **Invitational wording and no pressure to share** in group guides (Zondervan, Soul
    Shepherding). A copy matter for the prompts in section B.

### What the Sheets have that the landscape lacks

- Leader-only parts and answers that are left out of the participant version rather than toggled
  off (Logos's Hide answers had a leak bug; Zondervan prints the key in the participant's book).
- Blanks that print with answers on the leader's version and reveal one at a time in the room,
  with footnotes on screen (ProPresenter reveals on screen only; Planning Center in its app).
- OpenDocument output, .odt and .odp, found in no comparable.
- No account and no server: browser storage, and a link or file that carries the sheet itself.
- Passages that follow today's wording with a notice when it changes, a per-passage footnote
  choice, and a key terms box filled from the passages (Logos handouts may keep only the
  reference; Sefaria tells teachers to write a define-terms block by hand).
- Page breaks, ruled lines, and space to write as parts (Logos users ask for page breaks).
- A QR code per chapter on the printout (only route.bible, a separate tool, makes reference codes).

### Recommendations drawn from the landscape, ranked for a weekly leader

1. **"Save as my template" beside Duplicate** on the Sheet pane's list and the Sheets page: a
   leader's own arc, kept and started from again (Planning Center, Sermonary, YouVersion's
   duplicate). This also answers SH5-5 in part, since a leader's second sheet starts from their first.
2. **Optional minutes per part**, leader-only, totaled on the sheet and counted down in the
   presenter view (Zondervan, Hendrickson, Planning Center, PowerPoint's timer).
3. **More recognized arcs as templates**: Discovery Bible Study, inductive (Observe, Interpret,
   Apply), the Swedish method, and a video-session sheet with timed blanks. Each is a known shape
   leaders already teach from; each would need section B's prompts rather than text.
4. **A leader-only "Before you lead" part** in the group templates: materials, group size, and
   ground rules such as listening, confidentiality, and nobody having to share (Hendrickson,
   Zondervan, Soul Shepherding).
5. **Label questions Open, Consider, or Apply**, and ship a small, human-written starter bank per
   template that a leader picks from, in place of pre-filled question text (Life Connections,
   Logos's bank, Lifeway's extras). This is the landscape's answer to the question of what goes in
   an empty question field.
6. **Credit-line placement as a choice** in Present and Save as: first and last screens, every
   passage screen, or none; on paper, initials after each quotation and one full notice
   (ProPresenter's reference options, Crossway's terms, Sermonary's table).
7. **Leader notes as speaker notes in .pptx and .odp**, so PowerPoint's and Impress's own
   presenter views show them (today only the LIT's own presenter view does).
8. **A "what prints" check of the participant version** before Print and Save as, naming any
   answer, Leader only part, or blank's words that would appear (Logos's leak reports); and an
   optional answer key page on the leader's version (Zondervan's key line).
9. **The key terms box before the reading** in the Bible study template, or on a Present screen of
   its own (Sefaria puts "define terms" first; Lifeway repeats key doctrine each lesson). Pairs with
   SH5-13.
10. **A series**: share or save several sheets as one link or file (Sefaria's collections).
11. **A start-from-a-passage path and one finished example per template**: type a reference, pick a
    template, and the sheet opens with the passage in place (MediaShout's wizard, Logos's Get
    Started, Sefaria's "anatomy of a sheet," YouVersion's preview). Pairs with SH5-5 and SH5-11.
12. **In Present**, where absent: a blank-screen key, jump-to-part thumbnails, and an offline-ready
    check before the meeting (PowerPoint, OpenLP, MediaShout's local files, Lectio 365's download).

**BVJ's calls on these (2026-11-08)**, with what shipped on
`claude/audit-5-landscape`:

- **#1, Save as template: built.** "Save as template" on each row of My
  sheets keeps the sheet's parts, without its passages, as a template of the
  reader's own: a sheet record with `isTemplate: true` (STUDY-DESK-FORMAT.md,
  "The sheet's own fields"), listed under "My templates" (open to change it,
  or delete it), offered under "Your templates" in New sheet, and kept off
  /sheets' list and the /search gather panel. It stays a Sheets pane action:
  /sheets never edits.
- **#2, minutes per part: built.** A part's optional `minutes` (1 to 240;
  STUDY-DESK-FORMAT.md, "Modules"), set in a small box in each card's header;
  the editor shows the total, the leader's version prints "Planned N min"
  beside its name, and the presenter view counts each part down from the
  leader's first arrival and shows "Planned N min · M:SS in." Never on the
  participant's copy, the room's screen, or a participant share. The apps show
  sheets but don't edit them, so they keep the field and may ignore it.
  Per-part minutes don't print on paper or in the saved documents, only the
  total on the leader's version on screen and in print.
- **#3, more templates: the Swedish method built** (BVJ, 2026-11-08). Its
  three signs are the headings of three parts, each with ruled space, so the
  participants' copy carries the key; the explanations are prompts. The key
  terms box starts after the reading, so each reader meets the passage first.
  The video or podcast session is version 2. Discovery Bible Study and an
  inductive study are still under discussion (BVJ asked for background).
- **#4, Before you lead: built.** A Leader only part with a prompt opens the
  Bible study, Class session, and Lectio divina templates.
- **#5, labels on questions and a starter bank: version 2** (BVJ,
  2026-11-08).
- **#6, credit-line placement as a choice: declined** (BVJ agreed): where
  the credit goes follows the license terms, so it stays fixed.
- **#7, speaker notes in .pptx and .odp: already built** (the slides files,
  2026-11-06: Leader only parts and answers go in the speaker notes).
- **#8, a "what prints" check and an answer key: built.** On /sheets, the
  participant's version shows a quiet notice when a blank's words also print
  elsewhere on it (the title, a part, a question, another passage, or a
  footnote the leader chose to print; `src/lib/desk-sheet-leaks.mjs`); it
  never blocks printing. A blank's words repeated unblanked in the same
  passage aren't reported. The leader's version has "Add an answer key"
  (remembered per browser, not in the sheet), which ends it with each
  passage's blanks in order; it reaches Print, Copy, and the .docx, .odt and
  .rtf files, not the slides.
- **#9, the key terms box before the reading: built as a choice per sheet**
  (BVJ, 2026-11-08: "Definitely have it up front for class session.
  Probably for Bible study also."). Both templates now start with the box
  just before the reading, and the box's card has "Move before the reading"
  or "Move after the reading" (`keyTermsPlacement` in
  `desk-sheet-templates.mjs`), which places it against the reading part and
  the first run of passages. Sermon preparation keeps it last (SH5-13).
- **#10, a series; #11, start from a passage with examples: version 2**
  (STUDY-DESK.md, "Version 2: deferred and shelved").
- **#12, in Present: built in part.** B (or ".") blanks the room's screen to
  black and back; a step key while it is blank only brings the screen back,
  so a stray press can't skip a screen in the dark. The presenter view
  shows the state and has a button for it. Thumbnails to jump between parts
  were left out (Home, End and the arrows cover it), and so was an offline
  check (the sheet is already on the leader's machine).

### Sources

Logos: https://support.logos.com/hc/en-us/articles/360016747391-Sermon-Builder ·
https://www.logos.com/grow/sermon-planning-toolkit-the-swiss-army-knife-of-sermons/ ·
https://logos.com/grow/next-era-logos ·
https://community.logos.com/discussion/246162/exporting-handouts-with-blanks ·
https://community.logos.com/discussion/comment/1194912 ·
https://community.logos.com/discussion/246187/fill-in-new-slide-is-not-creating-blank-slides ·
https://www.logos.com/grow/how-to-power-your-sermon-presentation-from-the-pulpit/
Sefaria: https://voices.sefaria.org/sheets/228095 · https://voices.sefaria.org/sheets/621008 ·
https://voices.sefaria.org/sheets/299506 · https://voices.sefaria.org/sheets/225729 ·
https://voices.sefaria.org/sheets/192884 ·
https://help.sefaria.org/hc/en-us/articles/20532656851228-How-to-Export-Print-or-Share-a-Sheet
Sermon tools: https://sermonary.com/home/pro/ ·
https://support.sermonary.com/article/67-bible-translation-copyright-and-permission-notices ·
https://sermoncentral.com/content/pro-faqs · https://www.subsplash.com/blog/pulpit-ai-how-it-works ·
https://www.subsplash.com/blog/sermon-outline-template
Planning Center: https://www.planningcenter.com/blog/2024/12/beta-launch-announcing-sermon-notes-in-planning-center ·
https://help.planningcenter.com/en/139387-create-plan-reports.html ·
https://help.planningcenter.com/en/139467-set-up-the-service-order.html ·
https://help.planningcenter.com/en/139396-individual-plan-page-overview.html
Notes apps: https://subsplash.com/blog/fill-in-the-blank-notes-is-here ·
https://get.tithe.ly/blog/interactive-sermon-notes ·
https://churchleaders.com/pastors/pastor-articles/373669-sermon-notes.html
YouVersion: https://abnwt.com/articles/the-why-and-how-of-youversion-events ·
https://www.youversion.com/connect
Group guides: https://explorethebible.lifeway.com/?p=6956 · https://www.studygateway.com/download/9340 ·
https://g.christianbook.com/ns/pdf/leader/8624403.pdf ·
https://www.rightnowmedia.org/web-features/us-study-resources ·
https://www.lifeway.com/en/product/csb-life-connections-study-bible-P006103009
Methods: https://resources.fca.org/resources/discovery-bible-study-training · https://precept.org/?p=4737 ·
https://scripture-engagement.org/?p=545 · https://bibleinyear.com/blog/soap-bible-study-method ·
https://www.soulshepherding.org/lectio-divina-groups/
Presentation: https://proclaim.logos.com/ ·
https://support.proclaim.logos.com/hc/en-us/articles/19864188689037-Confidence-Monitor ·
https://support.renewedvision.com/hc/en-us/articles/360041347594-Using-Bibles-in-ProPresenter ·
https://worshiphousemedia.com/blogs/church-media-blog/creating-dynamic-slides-propresenter-6 ·
https://support.easyworship.com/support/solutions/articles/24000020401-scriptures ·
https://www.mediashout.com/wp-content/uploads/2019/04/V7-User-Guide-May-2020.pdf ·
https://freeshow.app/ · https://manual.openlp.org/library.html ·
https://support.microsoft.com/en-US/PowerPoint/training/use-presenter-view-in-powerpoint ·
https://support.google.com/docs/answer/1696787
Notices and codes: https://www.crossway.org/permissions/ · https://faith.tools/app/route-bible
Reference apps: https://www.accordancebible.com/Using-Accordance-To-Teach-A-Bible-Study-Part-5/ ·
https://help.olivetree.com/hc/en-us/articles/38801725375117-Exporting-Annotations-Notes-Highlights-Etc ·
https://www.blueletterbible.org/studytools · https://stepweb.atlassian.net/wiki/display/SUG/Quick+overview ·
https://biblehub.com/ · https://www.biblegateway.com/plus/

## E. Not covered

Printing and file saving (above), the Notebook's "My Notes" with sheets (it lists none by design),
phones and tablets (the desk does not run there), Firefox and Safari (the preview's standing gap
from Audit 1), the apps' side of the sheet format, and the release-notes feed. The reading pages'
verse menu and selection panel were used only in the LIT pane on /desk.
