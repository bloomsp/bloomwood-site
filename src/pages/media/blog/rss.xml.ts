import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context: { site: URL }) {
  const posts = (await getCollection('blog', ({ data }) => !data.draft))
    .filter((p) => p.slug.startsWith('media/'))
    .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());

  return rss({
    title: 'Bloomwood Media Blog',
    description: 'Articles and updates from Bloomwood Media.',
    site: context.site,
    items: posts.map((p) => ({
      title: p.data.title,
      pubDate: p.data.pubDate,
      description: p.data.description,
      link: `/media/blog/${p.slug.replace(/^media\//, '')}/`,
      categories: p.data.tags,
    })),
  });
}
