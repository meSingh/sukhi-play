import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';

/**
 * The markdown a documentation page is written in, served as itself.
 *
 * llms.txt points here rather than at the HTML: same words, a fraction of the
 * tokens, and nothing to misparse. It is the source file, so it cannot drift
 * from the rendered page.
 */
export const getStaticPaths: GetStaticPaths = async () => {
  const docs = await getCollection('docs');
  return docs.map((doc) => ({ params: { slug: doc.id }, props: { doc } }));
};

export const GET: APIRoute = ({ props }) => {
  const { doc } = props as { doc: Awaited<ReturnType<typeof getCollection<'docs'>>>[number] };
  const text = `# ${doc.data.title}\n\n> ${doc.data.summary}\n\n${doc.body ?? ''}`;
  return new Response(text, {
    headers: { 'content-type': 'text/markdown; charset=utf-8' }
  });
};
