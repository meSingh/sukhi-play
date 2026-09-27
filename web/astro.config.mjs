// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import rehypeFigures from './src/rehype-figures.mjs';
import { BLOG_PUBLIC } from './src/blog-public.mjs';
import { readdirSync, readFileSync } from 'node:fs';

/**
 * When each blog post last changed, for the sitemap: its `updated` date, or
 * the date it was published. Read from the front matter here because the
 * sitemap is written outside Astro's content layer.
 */
const POSTED = Object.fromEntries(readdirSync('./src/content/blog').filter((f) => f.endsWith('.md')).map((f) => {
  const head = readFileSync(`./src/content/blog/${f}`, 'utf8').split('---')[1] ?? '';
  const when = head.match(/^updated:\s*"?([\d-]+)/m)?.[1] ?? head.match(/^date:\s*"?([\d-]+)/m)?.[1];
  return [f.replace(/\.md$/, ''), when];
}));

/**
 * The site builds into ../docs, which is where GitHub Pages serves from.
 *
 * The built output is committed. Publishing stays `git push`, the custom
 * domain and CNAME are untouched, and a build that breaks shows up as a diff
 * somebody can see rather than as a site that quietly stopped updating.
 */
export default defineConfig({
  site: 'https://sukhiplay.com',
  // Pictures in markdown get WebP copies, sizes and captions (see the file).
  markdown: { rehypePlugins: [rehypeFigures] },
  outDir: '../docs',
  // 'directory' gives /features/ rather than /features.html, and works on any
  // static host without relying on it to resolve an extensionless path.
  build: { format: 'directory', assets: 'build' },
  /**
   * The American spelling lands on the British one.
   *
   * The app is Sukhi Colouring, spelled the way it is spelled everywhere else
   * in this project, and that is the address in the sitemap. But /coloring/ is
   * what half the world will type, and GitHub Pages serves files rather than
   * redirects, so Astro writes a meta-refresh page for it at build time -- the
   * same thing the hand-written stubs in public/ do for the addresses this
   * site used to have.
   */
  redirects: {
    '/playground/coloring': '/playground/colouring/',
    '/coloring': '/colouring/',
    '/license': '/licence/'
  },

  // A sitemap needs `site` above to know what the addresses are.
  integrations: [
    sitemap({
      // The .html files are redirect stubs for the addresses the site used to
      // have. Listing them would ask a crawler to index a meta-refresh.
      // The 404 is not an address, it is what happens when there isn't one.
      filter: (page) =>
        !/\/[a-z-]+\.html$/.test(page) &&
        !/\/404\/?$/.test(page) &&
        // The misspellings above are redirects, not addresses.
        !/\/(playground\/)?coloring\/?$/.test(page) &&
        !/\/license\/?$/.test(page) &&
        // The blog stays out of the sitemap until it is released.
        (BLOG_PUBLIC || !/\/blog\//.test(page)),
      changefreq: 'weekly',
      lastmod: new Date(),
      // A post's own date rather than the day of the build.
      serialize (item) {
        const slug = item.url.match(/\/blog\/([^/]+)\/$/)?.[1];
        if (slug && POSTED[slug]) return { ...item, lastmod: new Date(POSTED[slug]).toISOString(), changefreq: 'monthly' };
        return item;
      }
    })
  ],
  devToolbar: { enabled: false },
  compressHTML: true
});
