// @ts-check
import { defineConfig } from 'astro/config';

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
  devToolbar: { enabled: false },
  compressHTML: true
});
