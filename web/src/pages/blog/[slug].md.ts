import type { APIRoute, GetStaticPaths } from 'astro';
import { isoDate, KINDS, posts, type Post } from '../../blog';
import { SITE } from '../../site';

/**
 * A blog post as the markdown it is written in, for anything that would
 * rather read that than the page: same words, a fraction of the tokens.
 * llms.txt links here. The questions at the end are added in the same form
 * the page shows them, so nothing is on one and not the other.
 */
export const getStaticPaths: GetStaticPaths = async () =>
  (await posts()).map((post) => ({ params: { slug: post.id }, props: { post } }));

export const GET: APIRoute = ({ props }) => {
  const { post } = props as { post: Post };
  const d = post.data;
  const faq = d.faq.length
    ? `\n\n## Questions parents ask\n\n${d.faq.map((f) => `### ${f.q}\n\n${f.a}`).join('\n\n')}`
    : '';
  const points = d.points.length ? `The short version:\n\n${d.points.map((p) => `- ${p}`).join('\n')}\n\n` : '';
  const sources = d.sources.length ? `\n\n## Sources\n\n${d.sources.map((s) => `- [${s.title}](${s.url})`).join('\n')}` : '';
  const text = `# ${d.title}\n\n> ${d.description}\n\nBy Mandeep Singh, ${isoDate(d.date)}. ${KINDS[d.kind].plural}. ${SITE}/blog/${post.id}/\n\n${points}${(post.body ?? '').trim()}${sources}${faq}\n`;
  return new Response(text, { headers: { 'content-type': 'text/markdown; charset=utf-8' } });
};
