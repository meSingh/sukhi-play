/**
 * The smaller copies of the site's pictures, and where they live.
 *
 * Shared by scripts/images.mjs, which makes them before each build, and
 * components/Img.astro, which points the page at them. Both work out the same
 * list from the same rule, so neither has to read what the other wrote.
 *
 * The originals in public/ stay where they are and stay PNG: the README, the
 * store listings and the social previews link to them by address. The copies
 * go to public/img/, which is not committed; the built site in docs/ is.
 */

/** The widths a picture is offered at, up to its own. */
export const WIDTHS = [96, 160, 240, 480, 800, 1240, 1600];

export function widthsFor (width) {
  const out = WIDTHS.filter((w) => w < width);
  out.push(Math.min(width, WIDTHS[WIDTHS.length - 1]));
  return [...new Set(out)];
}

/** /screenshots/a.png at 480 is /img/screenshots/a-480.webp. */
export const copyPath = (src, w) => `/img${src.replace(/\.[a-z]+$/i, '')}-${w}.webp`;

/** The folders in public/ whose pictures get copies. */
export const FOLDERS = ['assets', 'screenshots'];
