import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE } from '../site';
import { KINDS, isoDate, posts } from '../blog';

/**
 * The whole manual and the whole blog as one markdown file, for an assistant
 * that would rather read everything once than follow twenty links. The short
 * brief with links is /llms.txt; this is the long form of the same thing.
 */
export const GET: APIRoute = async () => {
  const docs = (await getCollection('docs')).sort((a, b) => a.data.order - b.data.order);
  const blog = await posts();
  const out = [
    '# Sukhi Play: the manual and the blog, in full',
    '',
    '> A free locked-down browser for small children, for macOS, Windows and Linux,',
    '> made by Mandeep Singh for his own son. This file holds every page of the',
    `> documentation and every blog post. The brief is at ${SITE}/llms.txt.`,
    ''
  ];
  for (const d of docs) {
    out.push(`## ${d.data.title}`, '', `${SITE}/docs/${d.id}/`, '', `> ${d.data.summary}`, '', (d.body ?? '').trim(), '');
  }
  for (const p of blog) {
    const d = p.data;
    out.push(`## ${d.title}`, '', `${SITE}/blog/${p.id}/ (${KINDS[d.kind].plural}, ${isoDate(d.date)}, by Mandeep Singh)`, '', `> ${d.description}`, '');
    if (d.points.length) out.push(...d.points.map((pt) => `- ${pt}`), '');
    out.push((p.body ?? '').trim(), '');
    for (const f of d.faq) out.push(`**${f.q}** ${f.a}`, '');
    if (d.sources.length) out.push('Sources:', ...d.sources.map((s) => `- ${s.title}: ${s.url}`), '');
  }
  return new Response(out.join('\n'), { headers: { 'content-type': 'text/markdown; charset=utf-8' } });
};
