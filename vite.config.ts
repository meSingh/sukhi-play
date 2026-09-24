import { defineConfig } from 'vite';

/**
 * Relative asset paths, always.
 *
 * Inside Sukhi Play this is served from a directory on a private scheme, not
 * from the root of a host, so an absolute /assets/... path resolves to nothing.
 * Building this way from the start is why there is no patch file here.
 */
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    // One file each. A child's machine may be a ten-year-old laptop, and a
    // waterfall of small requests over a private scheme buys nothing.
    assetsInlineLimit: 4096,
    cssCodeSplit: false
  }
});
