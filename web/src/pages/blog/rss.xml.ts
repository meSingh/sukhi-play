import type { APIRoute } from 'astro';
import { KINDS, posts } from '../../blog';
import { SITE } from '../../site';

/**
 * The blog as an RSS feed, written by hand rather than with a package: it is
 * one loop over the posts, and the site has no other use for the dependency.
 */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = async () => {
  const all = await posts();
  const items = all.map((p) => {
    const url = `${SITE}/blog/${p.id}/`;
    return `    <item>
      <title>${esc(p.data.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${p.data.date.toUTCString()}</pubDate>
      <dc:creator>Mandeep Singh</dc:creator>
      <category>${esc(KINDS[p.data.kind].plural)}</category>
      <description>${esc(p.data.description)}</description>
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>The Sukhi Play blog</title>
    <link>${SITE}/blog/</link>
    <atom:link href="${SITE}/blog/rss.xml" rel="self" type="application/rss+xml"/>
    <description>Announcements, guides for parents of small children, and what happened behind the scenes, by Mandeep Singh.</description>
    <language>en-gb</language>
${all[0] ? `    <lastBuildDate>${all[0].data.date.toUTCString()}</lastBuildDate>\n` : ''}${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
};
