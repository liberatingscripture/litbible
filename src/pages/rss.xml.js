import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const articles = await getCollection('articles');

  const sorted = articles.sort(
    (a, b) => new Date(b.data.date) - new Date(a.data.date)
  );

  return rss({
    title: 'LIT Bible Articles',
    description:
      'Essays on translation, liberation, trauma-informed faith, and the Jesus way — from the Liberation and Inclusion Translation.',
    site: context.site,
    items: sorted.map((article) => ({
      title: article.data.title,
      pubDate: article.data.date,
      description: article.data.description,
      link: `/articles/${article.slug}/`,
    })),
    customData: `<language>en-us</language>`,
  });
}
