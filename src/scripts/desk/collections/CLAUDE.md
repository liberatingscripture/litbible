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

## Where the code is

- **Now (step 1, the record and its model, no UI):**
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
- **Later:** the collection page, Add to collection, This verse's
  Collections line and the notebook page's "Delete all collections" box,
  client code in this directory.

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
  the same plan, so one undo reverts both. Erasing one outright is a plain
  deletion and leaves its collections alone. The apps don't do this.
- **Bulk deletes stay apart**: "Delete all notes and marks" and "Delete all
  sheets" take no collection; `planDeleteCollections` does.
- **Never a row** of My Notes or My Notebook, nor counted there; a
  collection's change wakes no view of marks (`NO_CHAPTER_KINDS`).
- **Markdown lists collections for people and never reads them back**, like
  Places and Labels.

## Every look is one the site already has (decision 25)

BVJ, 2026-11-18, on the first mocks: no new color, toggle, menu, bar,
window, or button style. Each piece of the UI takes an existing class, and
a new button joins one of restyle.css's `:is()` lists (E126) rather than
getting a rule of its own. Before writing a style for collections, find the
pattern it copies; if none fits, ask BVJ rather than drawing one. What the
second draft of the mocks takes from where:

- **The page**: My sheets' title, "New…" button and rows (`desk-sheet__*`);
  "‹ My collections" is `sheets-page__back`. The members lie on a
  `.v2-sheet` as the desk's own rows (`record-rows.js`), group names are
  `.v2-label`, and a heading starts with `.v2-rule`.
- **The order switch** is `.desk-seg` (My Notes' segmented choice). Sky
  never marks a toggle (E159).
- **Moving in My order** is the sheet editor's grip to drag
  (`desk-sheet__grip`) and its ↑ and ↓ (`desk-sheet__icon`), not a menu.
- **The rule's line** is a plain line with `.desk-item__stop` links.
- **The undo bar** is `showUndo`'s, with its `link`.
- **"Add to collection ▸"** is a `flyoutRow`, so `panel-flyout.js` places it
  (6px right of its trigger, level with the trigger's top).
- **New collection, All collections, and the label's shortcut** are E154's
  pick window (`openPickWindow`, `desk-pick`), with `desk-editor__actions`
  (Cancel ordinary, the save button primary).
- **A row's "Collections…"** is the Labels popover's twin (`desk-labels`,
  `showPanel`).

A button that matches its background is a sitewide problem (E158), fixed in
the classes, never with a collections-only rule.
