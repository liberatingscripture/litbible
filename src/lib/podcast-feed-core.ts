// src/lib/podcast-feed-core.ts
//
// The pure parsing core behind src/lib/fetchPodcastEpisodes.ts: RSS XML plus a
// manual-override map in, an Episode[] out. It holds no imports of its own, and
// that is the entire point.
//
// The shell can't be unit-tested. It opens with two build-tool-only specifiers —
// `../data/podcastOverrides.json` (needs an import attribute under Node) and
// `../data/podcast-feed.xml?raw` (a Vite suffix Node cannot resolve at all) — so
// `node --test` can't import it, and Node's built-in type stripping (the trick
// test/chapter-html.test.js uses on src/lib/chapter-html.ts) never gets a chance
// to run. That gap is not theoretical: it is how extractTag shipped matching
// `<itunes:episodeType>` when asked for `<itunes:episode>`, silently, for every
// episode in the feed.
//
// So this file is the same "pure core + thin shell" split the build scripts
// already use (scripts/lib/verse-index-core.mjs, glossary-feed-core.mjs,
// release-notes-core.mjs, alignment-audit-core.mjs). Keep it import-free and
// keep its TypeScript *erasable* — type aliases, annotations, interfaces only,
// no enums or namespaces — or type stripping stops working and the tests go
// dark again.

export interface EpisodeLink {
  label: string;
  url: string;
  external?: boolean;
}

export interface Episode {
  title: string;
  type: 'full' | 'bonus';
  season?: string;
  episode?: string;
  pubDate: string;
  links: EpisodeLink[];
}

export type OverrideEntry = {
  read?: string;
  spotify?: string;
  apple?: string;
  youtube?: string;
  season?: string;
};

const LINK_ORDER = [
  'Read the passage',
  'Listen on Apple Podcasts',
  'Listen on Spotify',
  'Watch on YouTube',
];

// Pages that are site-level routes, not scripture content
const EXCLUDED_SLUGS = new Set([
  'translation-commitments',
  'about',
  'support',
  'contact',
  'glossary',
  'courses',
  'articles',
  'read',
  'found-in-translation-podcast',
]);

const excludedTitles = new Set([
  'Looking Ahead',
  "What comes next? Soon you'll see...",
  'The Liberation and Inclusion Translation is here!',
]);

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')       // en-dash, em-dash → hyphen
    .replace(/[\u2018\u2019\u201A]/g, "'") // smart single quotes
    .replace(/[\u201C\u201D\u201E]/g, '"') // smart double quotes
    .replace(/[!?:]/g, '')                 // drop punctuation (handles RSS "...Translation:" mismatch)
    .replace(/\s+/g, ' ')
    .trim();
}

// Book name → litbible.net slug
const BOOK_ALIASES: Record<string, string> = {
  'matthew': 'matthew',
  'mark': 'mark',
  'luke': 'luke',
  'john': 'john',
  'acts': 'acts',
  'romans': 'romans',
  '1 corinthians': '1corinthians',
  '1corinthians': '1corinthians',
  '2 corinthians': '2corinthians',
  '2corinthians': '2corinthians',
  'galatians': 'galatians',
  'ephesians': 'ephesians',
  'philippians': 'philippians',
  'colossians': 'colossians',
  '1 thessalonians': '1thessalonians',
  '1thessalonians': '1thessalonians',
  '2 thessalonians': '2thessalonians',
  '2thessalonians': '2thessalonians',
  '1 timothy': '1timothy',
  '1timothy': '1timothy',
  '2 timothy': '2timothy',
  '2timothy': '2timothy',
  'titus': 'titus',
  'philemon': 'philemon',
  'hebrews': 'hebrews',
  'james': 'james',
  '1 peter': '1peter',
  '1peter': '1peter',
  '2 peter': '2peter',
  '2peter': '2peter',
  '1 john': '1john',
  '1john': '1john',
  '2 john': '2john',
  '2john': '2john',
  '3 john': '3john',
  '3john': '3john',
  'jude': 'jude',
  'revelation': 'revelation',
};

/**
 * Try to infer a "Read the passage" link from an episode title.
 * Returns the first chapter URL only (multi-chapter titles yield only the first).
 * Returns null if the title doesn't contain a clear "BookName Chapter" pattern.
 */
export function inferReadLink(title: string): string | null {
  const t = title.toLowerCase();

  for (const [bookName, slug] of Object.entries(BOOK_ALIASES)) {
    // Match "Book Chapter" appearing at the start of the title or after " – "
    // Handles: "Matthew 6", "Matthew 6 – subtitle",
    //          "Blood and Glory (Hebrews 6b-9)", "Hebrews 12:1-13",
    //          "Matthew 8 & 9 – ...", "Matthew 22-23 – ..."
    const pattern = new RegExp(
      `(?:^|[–-]\\s*|\\()${bookName}\\s+(\\d+)`,
      'i'
    );
    const match = t.match(pattern);
    if (match) {
      return `https://litbible.net/${slug}-${match[1]}`;
    }
  }

  return null;
}

export function unescapeHtml(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&'); // must be last
}

/**
 * Extract the text content of the first matching XML tag within a string.
 * Handles both plain and CDATA-wrapped content. Supports namespaced tags
 * (e.g. "itunes:season", "content:encoded").
 *
 * The `(?=[\s/>])` lookahead is load-bearing: it ends the tag NAME, so a tag
 * whose name is a prefix of another tag's can't match it. Without it,
 * `<itunes:episode[^>]*>` matches `<itunes:episodeType>` — `[^>]*` happily
 * swallows the "Type" — and since RedCircle emits episodeType BEFORE episode,
 * the match opened on the wrong tag and ran to the real `</itunes:episode>`,
 * returning a blob of intervening XML instead of the episode number.
 */
export function extractTag(xml: string, tag: string): string {
  const escapedTag = tag.replace(':', '\\:');
  const openTag = `<${escapedTag}(?=[\\s/>])[^>]*>`;
  const cdataRe = new RegExp(
    `${openTag}<!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${escapedTag}>`,
    'i'
  );
  const cdataMatch = cdataRe.exec(xml);
  if (cdataMatch) return cdataMatch[1];

  const plainRe = new RegExp(
    `${openTag}([\\s\\S]*?)<\\/${escapedTag}>`,
    'i'
  );
  const plainMatch = plainRe.exec(xml);
  return plainMatch ? plainMatch[1] : '';
}

function isContentPage(url: string): boolean {
  try {
    const u = new URL(url);
    const slug = u.pathname.replace(/^\//, '').replace(/\/$/, '');
    return slug.length > 0 && !EXCLUDED_SLUGS.has(slug);
  } catch {
    return false;
  }
}

export function extractLinks(html: string): EpisodeLink[] {
  const links: EpisodeLink[] = [];
  const seen = new Set<string>();
  const hrefRe = /href=["']([^"'\s]+)["']/g;
  let m: RegExpExecArray | null;

  while ((m = hrefRe.exec(html)) !== null) {
    const url = m[1];
    if (seen.has(url)) continue;
    seen.add(url);

    if (url.includes('litbible.net/') && isContentPage(url)) {
      links.push({ label: 'Read the passage', url });
    } else if (url.includes('drive.google.com')) {
      links.push({ label: 'Read the passage', url, external: true });
    } else if (url.includes('podcasts.apple.com') && url.includes('i=')) {
      links.push({ label: 'Listen on Apple Podcasts', url, external: true });
    } else if (url.includes('open.spotify.com/episode')) {
      links.push({ label: 'Listen on Spotify', url, external: true });
    } else if (url.includes('youtu.be') || url.includes('youtube.com/watch')) {
      links.push({ label: 'Watch on YouTube', url, external: true });
    }
  }

  return links;
}

/**
 * Parse the committed RSS snapshot into the Episode[] the podcast page renders.
 * `overrides` is podcastOverrides.json's shape: episode title → manual links.
 * Feed order is preserved (RedCircle ships newest-first).
 */
export function parseEpisodes(
  xml: string,
  overrides: Record<string, OverrideEntry>
): Episode[] {
  // Normalized lookup, so an override key matches a feed title that differs
  // only by dash style, smart quotes, or trailing punctuation.
  const overrideLookup = new Map<string, OverrideEntry>();
  for (const [title, links] of Object.entries(overrides)) {
    overrideLookup.set(normalizeTitle(title), links);
  }

  const episodes: Episode[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let itemMatch: RegExpExecArray | null;

  while ((itemMatch = itemRe.exec(xml)) !== null) {
    const item = itemMatch[1];

    // 1. Skip trailers and preview episodes
    const episodeType = extractTag(item, 'itunes:episodeType').trim() || 'full';
    if (episodeType === 'trailer') continue;

    const title = unescapeHtml(extractTag(item, 'title').trim());
    if (excludedTitles.has(title)) continue;
    const titleLower = title.toLowerCase();
    if (
      titleLower.includes('preview') ||
      titleLower.includes('previewing') ||
      titleLower.includes('teaser')
    ) {
      continue;
    }

    let season = extractTag(item, 'itunes:season').trim() || undefined;
    const episode = extractTag(item, 'itunes:episode').trim() || undefined;
    const pubDate = unescapeHtml(extractTag(item, 'pubDate').trim());

    const contentEncoded = extractTag(item, 'content:encoded');
    const description = extractTag(item, 'description');
    const rawContent = contentEncoded || description;

    // content:encoded is double-encoded inside CDATA; unescape before parsing hrefs
    const html = unescapeHtml(rawContent);

    // 2. Extract links from RSS description
    let links = extractLinks(html);

    // 3. Keep only the first "Read the passage" link (multi-chapter episodes may have several)
    let foundRead = false;
    links = links.filter((l) => {
      if (l.label === 'Read the passage') {
        if (foundRead) return false;
        foundRead = true;
      }
      return true;
    });

    // 4. If no read link from RSS, try inferring from the episode title
    if (!links.some((l) => l.label === 'Read the passage')) {
      const inferred = inferReadLink(title);
      if (inferred) {
        links.push({ label: 'Read the passage', url: inferred, external: false });
      }
    }

    // 5. Merge manual overrides — read override replaces RSS; others are additive
    const overrideMatch = overrideLookup.get(normalizeTitle(title));
    if (overrideMatch?.season) {
      season = overrideMatch.season;
    }
    if (overrideMatch) {
      if (overrideMatch.read) {
        // Replace any RSS-extracted read link with the corrected override URL
        links = links.filter((l) => l.label !== 'Read the passage');
        links.push({ label: 'Read the passage', url: overrideMatch.read, external: false });
      }
      if (
        overrideMatch.apple &&
        !links.some((l) => l.label === 'Listen on Apple Podcasts')
      ) {
        links.push({
          label: 'Listen on Apple Podcasts',
          url: overrideMatch.apple,
          external: true,
        });
      }
      if (
        overrideMatch.spotify &&
        !links.some((l) => l.label === 'Listen on Spotify')
      ) {
        links.push({
          label: 'Listen on Spotify',
          url: overrideMatch.spotify,
          external: true,
        });
      }
      if (
        overrideMatch.youtube &&
        !links.some((l) => l.label === 'Watch on YouTube')
      ) {
        links.push({
          label: 'Watch on YouTube',
          url: overrideMatch.youtube,
          external: true,
        });
      }
    }

    // 6. Sort into consistent order: Read → Apple → Spotify → YouTube
    links.sort(
      (a, b) => LINK_ORDER.indexOf(a.label) - LINK_ORDER.indexOf(b.label)
    );

    episodes.push({
      title,
      type: episodeType === 'bonus' ? 'bonus' : 'full',
      season,
      episode,
      pubDate,
      links,
    });
  }

  // Feed is already newest-first; return as-is
  return episodes;
}
