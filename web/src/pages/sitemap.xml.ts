import type { APIRoute } from 'astro';
import { SITE } from '../site';

/**
 * The sitemap, at the address everybody actually tries.
 *
 * @astrojs/sitemap writes sitemap-index.xml and sitemap-0.xml and offers no
 * way to rename them. /sitemap.xml is the conventional address -- it is what
 * Search Console, Bing, and every third-party checker reaches for first, and
 * it is what a person types when they want to see whether a site has one. It
 * was a 404 here, which reads as "no sitemap" whatever robots.txt says.
 *
 * So this is a sitemap index at that address, pointing at the file the
 * integration generates. An index rather than a copy of the list, because two
 * files listing the same URLs is two things to keep in step, and the one that
 * drifts is always the one a crawler read.
 */
export const GET: APIRoute = () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITE}/sitemap-0.xml</loc>
  </sitemap>
</sitemapindex>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' }
  });
};
