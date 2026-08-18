import overridesData from '../data/podcastOverrides.json';
import feedXml from '../data/podcast-feed.xml?raw';
import { parseEpisodes } from './podcast-feed-core';
import type { Episode, OverrideEntry } from './podcast-feed-core';

// The data shell. All parsing lives in ./podcast-feed-core.ts, which imports
// nothing — the two specifiers above are exactly what kept this module out of
// `node --test`, so they are the only thing left here. See that file's header.
export type { Episode, EpisodeLink, OverrideEntry } from './podcast-feed-core';

// The RSS feed is fetched by scripts/fetch-podcast-feed.mjs (first step of
// `npm run build`) and committed as src/data/podcast-feed.xml. Parsing the
// committed snapshot here means a RedCircle outage can never fail a deploy —
// the build just uses the last successful snapshot.

const overrides: Record<string, OverrideEntry> = overridesData;

export async function fetchEpisodes(): Promise<Episode[]> {
  return parseEpisodes(feedXml, overrides);
}
