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

/**
 * The blog: announcements, guides for parents, and what happened behind the
 * scenes, all written by Mandeep in the first person.
 *
 * Markdown for the same reasons as the docs, and served as markdown too at
 * /blog/<slug>.md. The description doubles as the short answer at the top of
 * the post, which is the sentence a search result or an assistant quotes, so
 * it is written to stand on its own.
 */
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    /** One or two sentences: the meta description, and the short answer. */
    description: z.string().max(200),
    date: z.coerce.date(),
    /** Set when a post is changed in substance after it was published. */
    updated: z.coerce.date().optional(),
    kind: z.enum(['announcement', 'guide', 'story']),
    topics: z.array(z.string()).default([]),
    /** A picture from public/, shown under the title and used for sharing. */
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    /** A line under the picture, when it needs one. */
    imageCaption: z.string().optional(),
    /**
     * Three or four sentences a parent could stop after: shown at the top as
     * "the short version". What an answer engine lifts, so each one stands
     * alone.
     */
    points: z.array(z.string()).default([]),
    /** Where a claim came from, listed at the end and marked up as citations. */
    sources: z.array(z.object({ title: z.string(), url: z.string().url() })).default([]),
    /** Follow-up questions, shown at the end and marked up for search. */
    faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
    draft: z.boolean().default(false)
  })
});

export const collections = { docs, blog };
