# Pages

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory.

## A Markdown file saved here is published

Astro makes a public page of every `.md` file in this folder and the ones
under it (it skips only a name that starts with `_` or `.`), so don't save a
note or a README here. A `CLAUDE.md` is the exception: Claude Code loads it
only by that name, so it can't be renamed out of Astro's way, and the build
takes its page out of `dist/` and the sitemap instead (`scripts/CLAUDE.md`,
"Build Pipeline," step 10). The dev server still shows it.

## The privacy page and the Terms of Use (`privacy.astro`, `terms.astro`)

They are the LIT Bible's policy for the website, both apps, and the
optional account, and every word is BVJ's once approved; the app sections
of `/privacy` are BDR's to correct. Step 4j of the Study Desk's plan wrote
the account parts (`STUDY-DESK.md`, step 4j, with BVJ's decisions of
2026-11-25). **BVJ chose a spare key by default on 2026-11-26**
(`STUDY-DESK.md`, "Decisions"), so the account parts change with the
plan's step SK5; until then they describe end-to-end encryption for every
reader. Six things to keep:

1. **A change to `/privacy` files an issue on the LSC site's repository**
   (`.github/workflows/apps-mirror-notify.yml`): LSC reviews its own
   policy by hand. It is not a mirror, so nothing copies the words. Say so
   in the pull request.
2. **Every fact about the account is one the notebook service does**:
   what it keeps, how long, and deleting come from
   `STUDY-DESK-ENCRYPTION.md` ("What the service holds," "Deleting the
   account," "Waiting seven days," "Session lifetime") and the service's
   README ("What is logged"). Change them together, as `/delete-account/`
   does.
3. **Both pages say accounts are not open yet** until they are; the launch
   edits are listed in `src/scripts/desk/account/CLAUDE.md`, rule 11.
4. **A material change moves the effective date** (and `dateModified` in
   the JSON-LD), is said at the top of the page for 30 days, and is noted
   in the apps' What's New (BVJ, 2026-11-25, for BDR to confirm). The
   release notes never carry it: they are drafted from chapters, intros,
   the glossary, and articles alone.
5. **`/privacy` names every storage key the site writes**
   (`test/desk-storage-keys.test.js`), and its security reports paragraph
   carries the counts' retention (`test/csp-reporting.test.js`). `/terms/`
   uses `/privacy`'s stylesheets as they are, as `/delete-account/` does,
   and the app announcement stays off both (`announcement-gate.js`).
6. **No lawyer for now** (BVJ, 2026-11-26). A question that would go to a
   lawyer (the wording of a promise, a law that may apply, what the stores
   ask) gets a thorough research pass by Fable instead, and Fable's
   recommendation is followed, BVJ "acknowledging we understand that it
   can't give lawyer-level advice." The questions are one list, in
   `STUDY-DESK.md`, "Order of work," 4, "The lawyer questions, for Fable";
   a new one gets a line there. A pull request that rests on one says it is
   Fable's research, not legal advice.

## The license page (`license.astro`)

The license notice, in the owner's words, moved off the foot of /read
(Featherboa, "The ways in, and /read"). Its ids (`license`, `license-terms`,
`sblgnt-disclaimer`) are addresses the apps and Study link, so they stay.
**`/read` forwards the three old fragments** with `location.replace` from an
`is:inline` script in its head (so /read doesn't flash first). Inline is safe
there: the enforced policy has no `script-src`, and the report-only one allows
inline (`public/CLAUDE.md`). Installed apps keep the old link until a later
release, so **don't remove the forwarding**. The page's script opens a
disclosure when the address names it. Its words change only with the owner.

## The colophon (`colophon.astro`)

"How this site is made" at `/colophon`, linked from the footer (Featherboa,
"The dares," ix): the faces and why, what each color means, and the promises
about contrast, motion, and reading without JavaScript, so it is also the
site's accessibility statement. **Every fact on it follows the site's code and
the record** (`SITE-FEATHERBOA.md`: "Type," "Color," "Night," "Motion,"
"Sizes, space, and the measure," "The kit"), so when one of those changes,
change the page: `test/colophon.test.js` holds the faces to `faces.css` and
`tokens.css`, the colors, speeds, and target sizes to the tokens, and the
licenses to the font packages and `icons.mjs`. Say only what the code does;
a promise the site doesn't keep yet stays off the page. **Its sentence that
an AI writes much of the code, and the one after it saying who translates
the text, are BVJ's to word, keep, or drop** (`SITE-FEATHERBOA-BUILD.md`,
Q2); they stay together, and "Who makes it" is marked in the file.

## The What's New page (`whats-new.astro`)

`/whats-new` is news that is not a change to the text: site and app updates,
feature releases, launches. **Its entries are written by hand in
`src/lib/whats-new.mjs`** (newest first, each `{ id, date, title, body }`),
and **nothing writes them automatically**: no feed carries the page and the
apps don't read it. It is **not Release Notes**, which hold changes to the
text and are drafted from pushes to `main`. The page has no row in any header
menu (the footer links it, and a menu carrying a "New" mark ends with "See
what's new"), so `places.mjs` names it as a page in no place. **`src/lib/news.mjs`
says where a header mark goes, by an entry's `id`; `whats-new.mjs` says what
the news is**, in the same id style, so a mark can name the entry it points
at. Words: no design code name, "Study" never "Study Desk"
(`test/whats-new.test.js`). Each entry's date is a draft until BVJ confirms it.

## The podcast page (`found-in-translation-podcast.astro`)

`/podcast` redirects here. The "All Episodes" list is RSS-driven off the
`fetch:podcast` snapshot plus `podcastOverrides.json`. Above it sit three
embeds, **deliberately three different shapes, measured off the rendered
players, and they must not be given one shared height again** (that is what
cropped the video):

- **YouTube ("Latest Episodes") is hand-pinned**, and nothing in the build
  refreshes it. It is **show-level, not episode-level** so it doesn't go stale
  on its own: it frames the channel's curated *"Found in Translation"*
  playlist (`videoseries?list=PLZJ2_…`), which the show owner keeps current.
  **Don't re-pin it to a single video or a per-book playlist**: that is what
  silently went stale before (it sat on the app-launch episode, then on the
  1 Corinthians playlist). The auto-uploads playlist (`UU` + the channel id
  minus `UC`) is the other self-maintaining option, rejected because it also
  carries the channel's Shorts. A `youtu.be` or `/playlist?list=…` URL can't
  be framed (`X-Frame-Options`); only `/embed/…` can. The frame is 16:9.
- **Spotify is derived at build time** (`latestSpotifyEmbedUrl`, BVJ
  2026-11-23): its show card lagged the feed, so the page frames the newest
  episode with a Spotify link, falling back to the show embed. It is 152px:
  its scrubber, skip controls, and running time only appear below ~250px, so
  the taller layout shows *less*, not more.
- **Apple is derived at build time** (`latestAppleEmbedUrl`) from the newest
  episode carrying an Apple link. Apple retired the episode-list layout its
  show embed used to have, leaving a single card whose only play button is the
  show's *Trailer*, so a show-level Apple embed now advertises a 2021 teaser
  under a heading that says "Latest Episodes." No height or parameter brings
  the list back. Deriving the URL rather than pinning an episode keeps the
  anti-staleness property the other two get from being show-level. It falls
  back to the show embed (a taller card, hence two heights) when no episode
  has an Apple link yet. Apple's episode row is a flat 160px at any width;
  its show card is 16:9.

**The Apple and Spotify embeds are capped at 660px**, Apple's own figure:
neither card grows past it, so a wider frame shows a dead band down the right
(what the previous 900px cap did).

**"Read the passage" URLs are canonicalized to https + apex + trailing slash**
(`canonicalizeReadUrl`), because the RSS description carries our own domain in
four spellings (http/https x apex/www), exactly as it was typed into RedCircle,
and the site builds to directory format so a slashless path is 308'd. Only
litbible.net is rewritten; a third-party read link keeps its own scheme.

## The 404 page (`404.astro`)

Its script reads the address with `resolveMistypedPath` (in `search-core.js`,
the same parser as the search box), so a guessable scripture address lands on
its page: `/John-3`, `/jn-3`, `/john-3-16`, `/john/3`, `/1-corinthians-13`,
`/read/1-corinthians`. Read View's old address lands where a real one now
forwards (`src/lib/read-view-retirement.mjs`): the chapter's page, and a
book alone at its chapter 1 rather than its introduction. A known book
with a chapter it doesn't have (`/john-30`) gets "Did you mean John?"
instead of a redirect; anything else, and no JS, leaves the page as it
was.

## Measuring the Read page

**Don't measure reading with Cloudflare's Visits view.** A visit is a page
view whose referrer isn't the site, and most chapters are reached from
inside it, so they barely appear there; use page views. **A chapter's page
reads on through its book, and its address follows by `replaceState`**
(`src/scripts/read-on.js`). The site's own `lit_pv` counts page loads
only, but Cloudflare's beacon, in a browser with the Navigation API, hears
the `navigate` event `replaceState` fires and reports each chapter the
address moves to as a page view; in one without it, only the chapter
opened counts. So a chapter's page views mix the two. Read View's old
addresses forward (`read/[book].astro`) and may log a view of their own
first. (From the beacon's code, read 2026-11-27; not yet seen in the
dashboard.) Before Phase 4 one Read View page view could hold a whole book.
