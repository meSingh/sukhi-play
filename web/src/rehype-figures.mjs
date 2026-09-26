/**
 * Pictures inside markdown, served the way components/Img.astro serves them.
 *
 * A paragraph holding only an image from public/ becomes a <figure>: a
 * <picture> with the WebP copies scripts/images.mjs made, the width and height
 * read from the file (so nothing jumps as it loads), lazy loading, and the
 * image's title, if it has one, as the caption:
 *
 *   ![What the picture shows](/screenshots/01-launcher.png "The caption")
 *
 * Without this a post's pictures would be full-size PNGs with no dimensions,
 * which is exactly what web/scripts/check-images.mjs exists to refuse.
 */
import { join } from 'node:path';
import sharp from 'sharp';
import { copyPath, widthsFor } from './images.mjs';

const PUBLIC = join(process.cwd(), 'public');
const el = (tagName, properties = {}, children = []) => ({ type: 'element', tagName, properties, children });

function onlyImage (node) {
  if (node.type !== 'element' || node.tagName !== 'p') return null;
  const kids = node.children.filter((c) => !(c.type === 'text' && !c.value.trim()));
  return kids.length === 1 && kids[0].type === 'element' && kids[0].tagName === 'img' ? kids[0] : null;
}

export default function rehypeFigures () {
  return async (tree) => {
    const jobs = [];
    const walk = (parent) => {
      parent.children?.forEach((node, i) => {
        const img = onlyImage(node);
        if (img && typeof img.properties.src === 'string' && img.properties.src.startsWith('/')) {
          jobs.push({ parent, i, img });
        } else if (node.children) walk(node);
      });
    };
    walk(tree);

    for (const { parent, i, img } of jobs) {
      const src = img.properties.src;
      const caption = img.properties.title;
      let width, height, srcset;
      try {
        const meta = await sharp(join(PUBLIC, src)).metadata();
        width = meta.width; height = meta.height;
        if (/\.(png|jpe?g|webp)$/i.test(src)) srcset = widthsFor(width).map((w) => `${copyPath(src, w)} ${w}w`).join(', ');
      } catch { /* not a local picture sharp can read: leave the <img> as written */ continue; }

      const sizes = '(min-width: 1060px) 720px, 92vw';
      const image = el('img', { src, alt: img.properties.alt ?? '', width, height, loading: 'lazy', decoding: 'async' });
      const picture = srcset
        ? el('picture', {}, [el('source', { type: 'image/webp', srcSet: srcset, sizes }), image])
        : image;
      const kids = [picture];
      if (caption) kids.push(el('figcaption', {}, [{ type: 'text', value: caption }]));
      // An upright picture (a phone) is shown narrower, or it fills the screen.
      parent.children[i] = el('figure', { className: height > width ? ['post-fig', 'post-fig--tall'] : ['post-fig'] }, kids);
    }
  };
}
