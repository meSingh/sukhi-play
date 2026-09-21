import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * The documentation, as markdown.
 *
 * Markdown rather than .astro pages for two reasons: the content is prose and
 * belongs in a format a person can edit without knowing the framework, and a
 * markdown source can be served as-is to anything that would rather read it
 * that way -- which is what llms.txt points at.
 */
const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    /** One sentence. Used for the meta description and the docs index. */
    summary: z.string(),
    /** Lower numbers come first. */
    order: z.number(),
    /** Which part of the manual this belongs to. */
    group: z.enum(['Getting started', 'Using it', 'Under the bonnet', 'When things go wrong'])
  })
});

export const collections = { docs };
