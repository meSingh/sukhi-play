/**
 * Whether the blog is out.
 *
 * While posts are still being reviewed, the blog is built but nothing on the
 * site links to it: not the header, the footer, the home page, the About page,
 * the catalogue or the playground. Its pages are marked noindex and left out
 * of the sitemap, the RSS link and llms.txt, so the only way in is its
 * address, and Lighthouse CI (lighthouserc.js) leaves it out. Set this to
 * true to release it; every one of those comes back.
 */
export const BLOG_PUBLIC = false;
