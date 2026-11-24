# Pages

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory.

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
`/read/1-corinthians`. A known book with a chapter it doesn't have
(`/john-30`) gets "Did you mean John?" instead of a redirect; anything else,
and no JS, leaves the page as it was.

## Measuring Read View

**Don't measure Read View with Cloudflare's Visits view.** A visit is a page
view whose referrer isn't the site, and Read View is reached almost only from
inside it (Chapter View's toolbar, the /read card, the search links), so it
barely appears there. Use page views, and remember one Read View page view
can hold a whole book where Chapter View logs one per chapter.
