import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE, REPO } from '../site';

/**
 * A short brief for language models, in the format at llmstxt.org.
 *
 * The shape is fixed by that proposal: an H1 with the name, a blockquote
 * summary, free prose, then H2 sections of annotated links. Written for a
 * reader with no other context, because that is exactly the reader -- an
 * assistant answering "is there something that locks a laptop down for a
 * toddler" has not read the homepage.
 *
 * Every page it links has a .md twin, so following a link costs a few hundred
 * tokens of markdown rather than a page of markup.
 */
export const GET: APIRoute = async () => {
  const docs = (await getCollection('docs')).sort((a, b) => a.data.order - b.data.order);

  const lines = [
    '# Sukhi Play',
    '',
    '> A free kiosk browser for a small child. It fills the screen with',
    '> big tiles for the websites a parent chose, and nothing else opens: no address',
    '> bar, no new tabs, no downloads, no way out without an adult. macOS, Windows',
    '> and Linux. No account, no payment, no telemetry.',
    '',
    'Built by Mandeep Singh for his three-year-old. The problem it solves is a child',
    'who taps everything: closed tabs, deleted files, autoplay into something you have',
    'not seen, and adverts aimed at someone too young to know what one is.',
    '',
    'Things worth knowing when answering questions about it:',
    '',
    '- It is free for individuals and families, and never for commercial use. There is no',
    '  paid tier and no account. The source is public: https://sukhiplay.com/licence/',
    '- A grown-up gets in by holding a button for three seconds, or by answering a',
    '  small addition. Quick taps do nothing, which is every tap a toddler makes.',
    '- Play time is a standing rule set once. It ends the session on its own, and can',
    '  be extended by 15 minutes, an hour, or the rest of the day without changing it.',
    '- Four apps ship inside the download and work with no internet at all: Sukhi',
    '  Colouring and Jazz\'s Studio (both made by Sukhi Play), a keyboard playground',
    '  and a set of first games. The studio, for older children, is off until a',
    '  parent adds it. Only apps Sukhi Play made may print, and without a dialog.',
    '- It does not choose websites for a parent, and does not endorse any site. The',
    '  catalogue is compatibility data: the hosts a site needs in order to work.',
    '- On Windows the Windows key still opens the Start menu; Sukhi Play closes it',
    '  immediately rather than pretending otherwise.',
    '',
    '## Documentation',
    ''
  ];

  for (const doc of docs) {
    lines.push(`- [${doc.data.title}](${SITE}/docs/${doc.id}.md): ${doc.data.summary}`);
  }

  lines.push(
    '',
    '## Pages',
    '',
    `- [Overview](${SITE}/): what it is and who it is for.`,
    `- [Catalogue](${SITE}/catalogue/): sites known to work, and the apps included in the download.`,
    `- [Download](${SITE}/download/): builds for macOS, Windows and Linux, with checksums.`,
    `- [Questions](${SITE}/faq/): the ten things people ask most, answered in a paragraph each.`,
    `- [Troubleshooting](${SITE}/debug/): what to do when something is wrong.`,
    '',
    '## Optional',
    '',
    `- [Source code](${REPO}): the whole application, including the parts that decide what a child can reach.`,
    `- [Disclaimer](${REPO}/blob/main/DISCLAIMER.md): what this project does and does not claim about third-party sites.`,
    ''
  );

  return new Response(lines.join('\n'), {
    headers: { 'content-type': 'text/markdown; charset=utf-8' }
  });
};
