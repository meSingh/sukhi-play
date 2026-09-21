/**
 * The tile drawings, one per shape.
 *
 * The same set the app draws, so a site's picture on the website is the
 * picture a child will see. No favicons and no third-party logos: every one of
 * these is ours, which is what makes the page safe to publish.
 */
export const SHAPES: Record<string, string> = {
  star: '<path d="M50 8 62 38 94 41 70 62 77 93 50 76 23 93 30 62 6 41 38 38Z"/>',
  rocket: '<path d="M50 6c12 12 18 26 18 40v14H32V46c0-14 6-28 18-40Z"/><path d="M32 52 16 70l12-2 4 10Z"/><path d="M68 52l16 18-12-2-4 10Z"/><circle cx="50" cy="40" r="7" fill="#fff" fill-opacity=".55"/>',
  ball: '<circle cx="50" cy="50" r="40"/><path d="M22 34c18 10 38 10 56 0M22 66c18-10 38-10 56 0M50 10v80" stroke="#fff" stroke-opacity=".5" stroke-width="5" fill="none"/>',
  blocks: '<rect x="14" y="52" width="32" height="32" rx="6"/><rect x="54" y="52" width="32" height="32" rx="6"/><rect x="34" y="16" width="32" height="32" rx="6"/>',
  note: '<circle cx="34" cy="72" r="16"/><rect x="44" y="14" width="8" height="58" rx="4"/><path d="M52 14c14 4 24 10 26 22-6-8-14-12-26-14Z"/>',
  leaf: '<path d="M78 16C40 16 20 36 20 64c0 8 2 14 4 20 6-24 22-40 46-48-18 12-30 28-34 48 30 4 46-22 42-68Z"/>',
  drop: '<path d="M50 8c16 22 28 36 28 50a28 28 0 1 1-56 0c0-14 12-28 28-50Z"/>',
  bolt: '<path d="M56 6 24 54h20l-8 40 34-50H50Z"/>',
  heart: '<path d="M50 86C20 62 12 47 22 34c10-13 24-8 28 4 4-12 18-17 28-4 10 13 2 28-28 52Z"/>',
  cloud: '<circle cx="36" cy="58" r="16"/><circle cx="53" cy="44" r="21"/><circle cx="70" cy="58" r="14"/><rect x="30" y="54" width="44" height="20" rx="10"/>',
  moon: '<path d="M64 14a36 36 0 1 0 20 56A30 30 0 0 1 64 14Z"/>',
  flower: '<circle cx="50" cy="28" r="14"/><circle cx="72" cy="44" r="14"/><circle cx="63" cy="70" r="14"/><circle cx="37" cy="70" r="14"/><circle cx="28" cy="44" r="14"/><circle cx="50" cy="50" r="12" fill="#fff" fill-opacity=".55"/>',
  fish: '<ellipse cx="45" cy="50" rx="29" ry="19"/><path d="M74 50 94 33v34Z"/><circle cx="33" cy="44" r="4.5" fill="#fff" fill-opacity=".85"/>',
  book: '<path d="M20 24h24a8 8 0 0 1 8 8v46a11 11 0 0 0-8-4H20Z"/><path d="M80 24H56a8 8 0 0 0-8 8v46a11 11 0 0 1 8-4h24Z" fill-opacity=".6"/>',
  paint: '<path d="M50 16c19 0 34 13 34 29 0 11-9 14-15 16-6 2-9 5-9 10 0 7-6 12-13 12-18 0-31-15-31-33S31 16 50 16Z"/><circle cx="37" cy="39" r="5.5" fill="#fff" fill-opacity=".8"/><circle cx="56" cy="34" r="5.5" fill="#fff" fill-opacity=".8"/><circle cx="67" cy="49" r="5.5" fill="#fff" fill-opacity=".8"/>',
  car: '<path d="M24 58h52l-6-16a11 11 0 0 0-10-7H40a11 11 0 0 0-10 7Z"/><rect x="16" y="56" width="68" height="16" rx="8"/><circle cx="33" cy="76" r="8"/><circle cx="67" cy="76" r="8"/>'
};
