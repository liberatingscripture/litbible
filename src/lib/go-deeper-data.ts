// Build-time shell for "Go deeper" (go-deeper.mjs): loads the podcast feed,
// the articles and the glossary once per build, then answers per chapter.
import { getCollection } from "astro:content";
import { BOOKS, bookKeyToLabel } from "../data/books.js";
import { fetchEpisodes } from "./fetchPodcastEpisodes";
import { episodeChapters } from "./podcast-feed-core";
import { linkRefs } from "./scripture-refs-data.mjs";
import { scanDraftIntros } from "./draft-chapters.mjs";
import { gatedTermIds } from "./term-lens-data.mjs";
import { byChapter, chapterLinks, goDeeperRows } from "./go-deeper.mjs";

export type Link = { label: string; href: string };
export type EpisodeItem = { title: string; links: Link[] };
export type ArticleItem = { title: string; href: string };
export type TermItem = { label: string; href: string };
export type Row =
  | { kind: "listen"; label: string; items: EpisodeItem[]; more: EpisodeItem[] }
  | { kind: "read"; label: string; items: ArticleItem[]; more: ArticleItem[] }
  | { kind: "terms"; label: string; items: TermItem[]; more: TermItem[] }
  | { kind: "book"; label: string; items: Link[]; more: Link[] };

const PLATFORM: Record<string, string> = {
  "Listen on Apple Podcasts": "Apple Podcasts",
  "Listen on Spotify": "Spotify",
  "Watch on YouTube": "YouTube",
};

type Loaded = {
  episodes: Map<string, EpisodeItem[]>;
  articles: Map<string, ArticleItem[]>;
  glossary: Map<string, string>;
};
let loaded: Promise<Loaded> | null = null;

function load(): Promise<Loaded> {
  loaded ??= (async () => {
    // Feed order is newest first, which is the order a chapter lists them.
    const episodes = (await fetchEpisodes()).filter((e) => e.links.some((l) => PLATFORM[l.label]));
    const episodeItems = byChapter(
      episodes.map((e) => ({
        item: {
          title: e.title,
          links: e.links
            .filter((l) => PLATFORM[l.label])
            .map((l) => ({ label: PLATFORM[l.label], href: l.url })),
        },
        keys: episodeChapters(e).map((c) => `${c.bookKey}-${c.chapter}`),
      })),
      (x) => x.keys,
    );

    const articles = (await getCollection("articles")).sort(
      (a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime(),
    );
    const articleItems = byChapter(
      articles.map((a) => ({
        item: { title: a.data.title, href: `/articles/${a.id}/` },
        keys: chapterLinks(linkRefs(a.rendered?.html ?? "")).filter(
          (k) => k.replace(/-\d+$/, "") in BOOKS,
        ),
      })),
      (x) => x.keys,
    );

    const glossary = new Map(
      (await getCollection("glossary"))
        .filter((e) => !e.data.draft)
        .map((e) => [e.data.id, e.data.litMenu]),
    );

    const unwrap = <T>(m: Map<string, { item: T }[]>) =>
      new Map([...m].map(([k, list]) => [k, list.map((x) => x.item)]));
    return { episodes: unwrap(episodeItems), articles: unwrap(articleItems), glossary };
  })();
  return loaded;
}

/**
 * @param termOrder glossary ids in the order the chapter first uses them (the
 *   term lens's marks), so the row reads in text order; ids the chapter shows
 *   but the order lacks go last
 */
export async function goDeeperFor(bookKey: string, chapter: number, termOrder: string[] = []): Promise<Row[]> {
  const { episodes, articles, glossary } = await load();
  const key = `${bookKey}-${chapter}`;
  const ids = gatedTermIds(bookKey, chapter).filter((id) => glossary.has(id));
  const ordered = [...new Set([...termOrder.filter((id) => ids.includes(id)), ...ids])];
  const intro = scanDraftIntros().has(bookKey)
    ? null
    : { label: `Introduction to ${bookKeyToLabel(bookKey)}`, href: `/${bookKey}-intro/` };
  return goDeeperRows({
    episodes: episodes.get(key) ?? [],
    articles: articles.get(key) ?? [],
    terms: ordered.map((id) => ({ label: glossary.get(id)!, href: `/glossary/#${id}` })),
    intro,
  }) as Row[];
}
