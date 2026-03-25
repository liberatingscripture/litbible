import overridesData from '../data/podcastOverrides.json';

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

const RSS_URL =
  'https://feeds.redcircle.com/59ffbfb2-f814-469a-8522-416bb67c15f6';

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

type OverrideEntry = { read?: string; spotify?: string; apple?: string; youtube?: string };
const overrides: Record<string, OverrideEntry> = overridesData;

const excludedTitles = new Set([
  'Looking Ahead',
  "What comes next? Soon you'll see...",
  'The Liberation and Inclusion Translation is here!',
]);

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')       // en-dash, em-dash → hyphen
    .replace(/[\u2018\u2019\u201A]/g, "'") // smart single quotes
    .replace(/[\u201C\u201D\u201E]/g, '"') // smart double quotes
    .replace(/[!?:]/g, '')                 // drop punctuation (handles RSS "...Translation:" mismatch)
    .replace(/\s+/g, ' ')
    .trim();
}

// Build a normalized lookup map once at module load
const overrideLookup = new Map<string, OverrideEntry>();
for (const [title, links] of Object.entries(overrides)) {
  overrideLookup.set(normalizeTitle(title), links);
}

// Book name → litbible.net slug
const BOOK_ALIASES: Record<string, string> = {
  'matthew': 'matthew',
  'john': 'john',
  'ephesians': 'ephesians',
  'galatians': 'galatians',
  'hebrews': 'hebrews',
  'romans': 'romans',
  'james': 'james',
  '1 corinthians': '1corinthians',
  '1corinthians': '1corinthians',
};

/**
 * Try to infer a "Read the passage" link from an episode title.
 * Returns the first chapter URL only (multi-chapter titles yield only the first).
 * Returns null if the title doesn't contain a clear "BookName Chapter" pattern.
 */
function inferReadLink(title: string): string | null {
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

function unescapeHtml(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#43;/g, '+')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&'); // must be last
}

/**
 * Extract the text content of the first matching XML tag within a string.
 * Handles both plain and CDATA-wrapped content. Supports namespaced tags
 * (e.g. "itunes:season", "content:encoded").
 */
function extractTag(xml: string, tag: string): string {
  const escapedTag = tag.replace(':', '\\:');
  const cdataRe = new RegExp(
    `<${escapedTag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${escapedTag}>`,
    'i'
  );
  const cdataMatch = cdataRe.exec(xml);
  if (cdataMatch) return cdataMatch[1];

  const plainRe = new RegExp(
    `<${escapedTag}[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`,
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

function extractLinks(html: string): EpisodeLink[] {
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

export async function fetchEpisodes(): Promise<Episode[]> {
  const response = await fetch(RSS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch RSS feed: ${response.status}`);
  }
  const xml = await response.text();

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

    const season = extractTag(item, 'itunes:season').trim() || undefined;
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
