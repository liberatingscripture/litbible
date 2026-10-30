# Build-time helpers (`src/lib/`)

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory. This directory is flat and serves several areas: `desk-*.mjs`, `anchor-core.mjs`, `greek-*.mjs` and `qr-svg.mjs` are the Study Desk's (read `src/scripts/desk/CLAUDE.md`), `alignment-gate.mjs` and `term-lens*.mjs` the alignment dataset's (read `src/data/alignment/CLAUDE.md`), and `chapter-html.ts` is the chapter render pipeline (read `src/data/chapters/CLAUDE.md`).
> Cross-references such as "below" or "rule 15" were written when all of
> this was one file, so they may point into another area file; the root's
> index says which file holds each section.

## Module map

From the root's project tree.

```
  lib/               # Server-side build helpers: chapter-html.ts (the shared
                     #   scripture-HTML transform pipeline — prepareStudyParagraph
                     #   / prepareReadParagraph; both views wrap each verse in
                     #   a data-verse span), draft-chapters.mjs (single source
                     #   for indexed:false draft data, and for draft intros —
                     #   used by astro.config.mjs, ReadMenu, and the /read
                     #   lede), chapter-nav.mjs + chapter-nav-data.mjs (the one
                     #   Previous/Next rule, which steps over drafts, and its
                     #   build shell), fetchPodcastEpisodes.ts +
                     #   podcast-feed-core.ts (shell/core split: the shell holds
                     #   the two imports Node can't resolve — the JSON overrides
                     #   and podcast-feed.xml?raw — so the core stays import-free
                     #   and `node --test` can reach it via type stripping. Keep
                     #   the core's TypeScript erasable or the tests go dark),
                     #   lsc-mark.mjs (see The LSC brand mark below),
                     #   scripture-refs.mjs + scripture-refs-data.mjs (the
                     #   render-time reference linker and its fs shell),
                     #   sefaria-refs.mjs (the Hebrew Bible it links out to
                     #   Sefaria, and the English→Hebrew verse map),
                     #   ebible-refs.mjs (the apocrypha it links to eBible.org),
                     #   glossary-crossrefs.mjs, release-note-links.mjs +
                     #   release-note-linker.ts (see "Scripture references link
                     #   at render" below), release-notes-view.mjs (how
                     #   /release-notes and its RSS feed present the JSON),
                     #   alignment-gate.mjs (the one display gate for the
                     #   alignment dataset), term-lens.mjs + term-lens-data.mjs
                     #   (the term lens and its fs shell), go-deeper.mjs +
                     #   go-deeper-data.ts ("Go deeper" and its build shell),
                     #   verse-image.mjs (the design and typesetting behind
                     #   "Make an image"), anchor-core.mjs + desk-*.mjs (the
                     #   Study Desk's pure modules: records, incl. the trash
                     #   record and footnote pins; the anchor text read off
                     #   the page; the wording comparison and the change
                     #   notice built on it (desk-change); the notebook's
                     #   write plans in desk-store-core; the sheet record,
                     #   its checks and its formatted-text sanitizer
                     #   (desk-sheet-format), the changes a sheet takes
                     #   (desk-sheets) and its passages (desk-sheet-passages),
                     #   the templates it starts from (desk-sheet-templates),
                     #   a search's or topic's passages (desk-sheet-gather),
                     #   the reader's questions on it (desk-sheet-discussion),
                     #   sharing it by link or file (desk-sheet-share),
                     #   and its copies on paper (desk-sheet-copy, with
                     #   qr-svg.mjs, the one QR drawing), and on a
                     #   screen for a room (desk-present);
                     #   merging two copies
                     #   of a notebook (desk-merge); finding a pinned
                     #   footnote again (desk-footnotes); the notebook page
                     #   and its files (desk-notebook, desk-export,
                     #   desk-labels), places and ribbons (desk-places), the
                     #   notebook search and commands
                     #   (desk-search, desk-commands) and first use
                     #   (desk-first-use); the Greek tab's helpers
                     #   (desk-greek); /desk's panes and their
                     #   layouts (desk-layout), the passages they show
                     #   (desk-passage), and the LIT pane's corpus and
                     #   text (desk-corpus, desk-lit-text)), greek-parse.mjs (MorphGNT's parsing
                     #   codes in words, shared with the phase 2 tool),
                     #   greek-search.mjs (searching the Greek: folding,
                     #   transliteration keys, matching; shared by both
                     #   search UIs, the Greek tab and build:greek),
                     #   greek-query.mjs (Greek search commands: parsing
                     #   and constructions, the readback, the commands
                     #   list) + greek-commands-ui.mjs (its pure UI helpers),
                     #   levenshtein.mjs, selection-end.mjs (where a
                     #   mouse selection of scripture ends when the drag
                     #   finishes off the text; chapter-tools.js),
                     #   osis.mjs (the OSIS book codes,
                     #   shared by chapter-html.ts and the export),
                     #   app-platform.mjs
                     #   (the one "is this a phone or tablet" test, read by
                     #   the desk's gate and the app announcement),
                     #   content-version.mjs (the build's content version,
                     #   stamped on <html> for desk records)
```

## Conventions

- **Scripture references link at render, never in the data.** Footnotes
  (Study View), book intros, article bodies, glossary bodies, and release-note
  descriptions are passed through `linkScriptureRefs` (`src/lib/scripture-refs.mjs`,
  pure and unit-tested; `scripture-refs-data.mjs` is its fs shell) as the page is
  built, so "Romans 2:24" becomes `<a class="sref" href="/romans-2/#v24">`, and
  "Deuteronomy 30:15" a `<a class="sefaria-ref">` to that verse on Sefaria. The
  chapter JSON, the intro files, `release-notes.json` and the glossary feed all
  keep their plain text, because the apps and the changelog read those. Five
  rules, each a decision rather than a limitation:
  1. **Explicit references only**: a book name or SBL abbreviation plus a
     chapter, verse or range, and list continuations after one ("John 3:35;
     5:20", "10:23, 33", "1 Corinthians 11 and 14"). Relative forms ("vv. 9–11",
     "verse 10", a bare "(1:20–25)") stay plain: one footnote is stored
     byte-identically in 1 Corinthians 12 and 14 and means chapter 14 in both, so
     the host chapter is not a safe assumption. A bare number after a semicolon
     is left alone too, since it could be a chapter or a verse. A book title
     set in italics links with its numbers (`<em>Sirach</em> 24`), the italics
     kept inside the link: the linker reads one run of text at a time, so it
     swaps a known title's tags for two private-use markers first and swaps
     them back after. The notes don't italicize book titles (owner,
     2026-09-28); this is for the next one that does.
  2. **Other scripture links out** (audit X14, owner 2026-09-28): the Hebrew
     Bible to Sefaria, the apocrypha to the World English Bible on eBible.org.
     - **Sefaria, in Hebrew numbering.** `src/lib/sefaria-refs.mjs` holds the
       books and the map, which is the whole job: the notes cite verses the
       English way (the owner cites psalms by English numbering only), Sefaria
       numbers them the Hebrew way, and the two part in 63 psalms (the heading
       is verse 1, so "Psalm 22:1" is Hebrew 22:2) and 63 other chapters ("Joel
       2:28" is Hebrew 3:1; the Decalogue's short commandments are one Hebrew
       verse). The map was derived by comparing verse counts across all 39
       books, then checked verse by verse against Sefaria's JPS 1917 text,
       which found Psalm 13: the same length in both, numbered differently. So
       **counts alone prove nothing, and the map changes only with the same
       text check**, never from memory. A range keeps its end, since Sefaria
       shows the passage, and a whole chapter the numbering moves links its
       exact Hebrew range ("Malachi 4" is Malachi 3:19–24).
       **Every link names its English: the 2023 JPS Tanakh: Gender-Sensitive
       Edition** (`ENGLISH_VERSION`, owner 2026-09-29), so a change to
       Sefaria's default can't change what readers meet. It was already the
       default and was kept, over the 1985 JPS, the 1917 JPS and the Koren
       Jerusalem Bible, as the closest to the LIT's inclusive commitments,
       knowing it parts from the LIT in places (Isaiah 53:12 has "sinners").
       bible.com's CEB was weighed the same day (English numbering, so no
       map) and declined: the owner would rather readers meet, and the site
       support, Sefaria. Every Sefaria version shares the Hebrew numbering,
       so swapping the version never touches the map.
     - **eBible.org for every apocryphal book** (`src/lib/ebible-refs.mjs`):
       public domain, a nonprofit site with no ads, numbered as English Bibles
       number these books, so no map. Sefaria was the first choice and was
       dropped for these: its English covers only parts of them (Wisdom stops
       at 2:3), translated from the Hebrew fragments and numbered differently
       in places. The verse counts were read from eBible's own pages, including
       the verses it leaves out as modern English Bibles do (Sirach 26:20–27).
       A range opens at its first verse, since eBible can't highlight a span.
       Sirach 30–36 is where English Bibles disagree with each other, so check
       a citation there against the page. 1 Enoch isn't in the WEB and stays
       plain.
  3. **A reference tagged with another translation stays plain** ("Mark 7:21–22
     ESV", "(John 12:16 NIV)"): it cites *that* wording, and linking it to the LIT
     text would misattribute the quotation (owner, 2026-09-27). The tag covers the
     whole list before it. "LIT" is ours and links normally. A Hebrew Bible
     reference that links out also stays plain when it names a text the other
     site doesn't show, after it ("Psalm 40:6 LXX", "Alter's Translation") or
     before it ("LXX Ps 51:4"), since that text's numbering or wording is the
     one being cited.
  4. **A verse the page has no anchor for links the chapter** (a gap like Matthew
     17:21, or a draft), which is what keeps `check:links` green. That checker
     now resolves a range `#v16-18` when both ends exist, so it validates every
     link this writes. Links to draft chapters carry `data-draft`.
  5. **Existing links, `<code>`, and attributes are never touched**, so a
     hand-written article link keeps its own target.
  **A reader's own note is linked in a mode of its own**
  (`linkScriptureRefs(html, { mode: "note", hasVerse })`, called by
  `desk-chains.mjs`; BVJ, 2026-10-26, BA89 and BA94), since footnotes are typed
  carefully and notes aren't. Three things differ, and everything else above
  holds. **Lists are stricter**: a continuation links only when it is itself a
  chapter:verse, so "Romans 8:28, 3 reasons" and "8:28, 30" link 8:28 alone
  while "8:28, 9:1" and "8:28; 9:1" link both; and a verse `hasVerse` refuses
  links nothing, with the counts from `src/data/verse-counts.js` (the last
  verse number of every chapter, checked by `test/verse-counts.test.js`
  against the SBLGNT and the LIT), so "Luke 2:100" stays plain while a gap
  inside a chapter (Matthew 17:21) still lands on its chapter (rule 4).
  **Names are looser**: a New Testament book matches in any case and in the
  common short forms in `NOTE_SHORT_NAMES` ("john 3:16", "Jn 3:16", "1Cor
  13:4", "Revelations"), a period may separate chapter and verse ("Gal 3.28"),
  and a name not written as the site writes it links only with a verse, so
  "mark 3 places" stays plain. Hebrew Bible and apocrypha names stay
  exact-case, since a lowercase "is 3:15" is a time, not Isaiah. The short-name
  set is a recommendation awaiting BVJ's confirmation (STUDY-DESK.md,
  Decisions, 2026-10-28 and 2026-10-29). **A range into a later chapter keeps its end** on the
  link as `data-end` ("John 3:16–4:2" gets `4:2`, "Hebrews 6–9" gets `9`), which
  `citedRefs` reads to list the span chapter by chapter. Footnotes, intros,
  articles, the glossary and release notes keep the five rules exactly; the
  Study Desk's sheets (`sheetHtmlForShow`) read a sheet's own words in note
  mode, as a note's (BVJ, 2026-10-29), so a note copied onto a sheet links
  the same in both. The lookbehind that
  keeps "1 John" from matching as "John" bounds its whitespace run
  (`SP_BEHIND`, at most four), since an unbounded one stalled a note of 40,000
  spaces for 3.5 seconds (BA95); this holds in every mode.
  On `/glossary`, `linkGlossaryCrossRefs` also turns `the entry for “X”` into a
  jump to that entry, resolving X through the feed's own `normalizeLabel` so the
  page and iOS agree; the phrase itself ships verbatim (see The Glossary Feed).
  Release-note rows that name an intro, a glossary entry or an article link by
  their fixed wording (`release-note-links.mjs`).
  **Previews** (`src/scripts/ref-preview.js`): hovering a reference with a mouse,
  or tapping one on a touch screen, shows its verses (up to six) in the shared
  floating panel with an "Open John 3 →" link. A mouse click and the keyboard
  still just follow the link. They read the per-chapter files `build:verses`
  writes, and apply to `a.sref`, the glossary's "Where it appears" lists, and
  hand-written scripture links in article bodies, never to navigation. A
  Sefaria or eBible link has no preview; it is an ordinary link to another site.
  `src/scripts/lit-panel.js` is the one panel all reader tools share (verse
  menu, footnote popover, selection panel, preview): one open at a time, closed
  by an outside click or Escape. A click inside the Study Desk's Notebook
  panel doesn't count as outside, and a panel is placed clear of it (see
  below).
- **Every link that leaves the site opens in a new tab** (owner, 2026-10-01).
  For rendered bodies that is `openExternalLinks` in `src/lib/external-links.mjs`
  (pure, unit-tested), called from `linkRefs`, the one function footnotes,
  intros, articles, glossary bodies and release notes already pass through, so
  the Sefaria and eBible links get it too. It adds `target="_blank"` and
  `rel="noopener noreferrer"` to an absolute http(s) anchor on another host,
  extends an existing `rel` rather than replacing it, and leaves a link to
  litbible.net in full alone. The chapter JSON, intro files and articles keep
  their plain `<a href>`, since the apps read them and a `target` is a website
  decision. Anchors written by hand in `.astro` files can't pass through a
  string transform, so they carry the same two attributes in the markup; a
  new one needs them too. Check with a scan of built `dist/` HTML for an
  external anchor missing either.
- **"Go deeper" closes every published chapter** (audit X3, owner
  2026-09-28): `GoDeeper.astro`, right after Previous/Next and above the
  notes, with one row per kind that has something (Listen, Read, Key terms,
  Book), so a chapter never shows an empty row. Everything is worked out at
  build (`go-deeper-data.ts`, with the pure rules in `go-deeper.mjs`):
  - **Listen** takes the episodes whose **title** names the chapter
    (`episodeChapters` in `podcast-feed-core.ts`: "Matthew 14 & 15",
    "Matthew 16-18", "Hebrews 6b-9"; a dash after a verse is a verse range).
    Only a title naming no chapter falls back to the "Read the passage" link,
    since those links come from RedCircle as typed and three pointed at the
    wrong chapter until overrides fixed them. `inferReadLink` keeps its
    first-chapter contract for the podcast page. Episodes link out to Apple
    Podcasts, Spotify and YouTube, because the podcast page has no
    per-episode anchors.
  - **Read** takes the articles whose rendered body links the chapter,
    counting the render-time reference links (`a.sref`) as well as
    hand-written ones, newest first.
  - **Key terms** are the gated glossary terms, in the order the term lens
    first marks them, linking to `/glossary/#id`; **Book** is the intro,
    unless it is a draft.
  - **Two episodes and three articles show**; the rest wait behind an
    "N more" `<details>` (owner: a collapsing space, not a hard limit). It
    needs no JS and shifts nothing on load. Galatians 3, Hebrews 6 and
    Matthew 5 were the only chapters with any held back in 2026-09.
  The section is `data-pagefind-ignore`d and hidden in print.
- **The release notes page and its RSS feed only present that JSON.**
  `src/lib/release-notes-view.mjs` (pure, unit-tested) turns each change's
  `detail` into old text struck through beside the new, groups entries by
  month, and gives each entry an id; `src/scripts/release-notes.js` runs the
  page's filters. Three things to keep in step:
  1. **`parseDetail` restates the drafter's `detail` grammar** (`v. 21:` /
     `fn. bb (v. 37):` prefixes, `"old" → "new"`, `added "…"`,
     `removed "…"`, joined with `; `). A new shape in
     `release-notes-core.mjs` needs a matching rule there. It degrades rather
     than breaks: a detail that doesn't parse shows as written. Quoted text can
     contain straight quotes (the 2026-08 cleanup logged them), so a quotation
     ends where the grammar allows, never at the first `"`.
  2. **Entry ids are permalinks** (`/release-notes/#2026-09-26`, used by the
     feed and /read's "What's new"). A second publish on one day gets `-2`,
     counted from the oldest entry so prepending never renumbers one.
  3. **The filters read a row's book from `location`, else from the
     description's leading label**, since older rows and intro and
     new-chapter rows carry no `location`. A description that stopped
     leading with the book label would drop out of the book filter.
  The feed carries the 20 most recent publishes. It is a website asset, never
  under `/api/`. The Study Desk's change notice reads the same JSON
  (`releaseNoteFor` in `src/lib/desk-change.mjs`) to date a change under a
  reader's mark, taking a `text_updated` row's verses from its description
  ("Luke 11:2, 20, 43–44, 47 — text updated"), so that wording is load-bearing
  there too.
