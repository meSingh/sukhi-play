// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/**
 * The site builds into ../docs, which is where GitHub Pages serves from.
 *
 * The built output is committed. Publishing stays `git push`, the custom
 * domain and CNAME are untouched, and a build that breaks shows up as a diff
 * somebody can see rather than as a site that quietly stopped updating.
 */
export default defineConfig({
  site: 'https://sukhiplay.com',
  outDir: '../docs',
  // 'directory' gives /features/ rather than /features.html, and works on any
  // static host without relying on it to resolve an extensionless path.
  build: { format: 'directory', assets: 'build' },
  // A sitemap needs `site` above to know what the addresses are.
  integrations: [
    sitemap({
      // The .html files are redirect stubs for the addresses the site used to
      // have. Listing them would ask a crawler to index a meta-refresh.
      filter: (page) => !/\/[a-z-]+\.html$/.test(page),
      changefreq: 'weekly',
      lastmod: new Date()
    })
  ],
  devToolbar: { enabled: false },
  compressHTML: true
});
