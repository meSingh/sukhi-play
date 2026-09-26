/**
 * The blog's posts, in order, and the few things every blog page needs to
 * know about them. One place, so the index, the posts, the feed, the home
 * page and llms.txt can never disagree about what is published.
 */
import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

/**
 * What each kind is called where a parent reads it, the address of its own
 * page, and the colour its covers and labels use.
 */
export const KINDS = {
  guide: {
    label: 'For parents', plural: 'For parents', slug: 'for-parents', tone: 'mint',
    blurb: 'What works with small children and computers: screen time, laptops, keyboards and printing, from one parent to another.'
  },
  announcement: {
    label: 'Announcement', plural: 'Announcements', slug: 'announcements', tone: 'violet',
    blurb: 'Every new version of Sukhi Play, every new app in the playground, and every change that matters to a family using it.'
  },
  story: {
    label: 'Behind the scenes', plural: 'Behind the scenes', slug: 'behind-the-scenes', tone: 'amber',
    blurb: 'How it is made, and what went wrong on the way, told plainly.'
  }
} as const;

export type Kind = keyof typeof KINDS;
export const KIND_ORDER: Kind[] = ['guide', 'announcement', 'story'];

export const AUTHOR = {
  '@type': 'Person',
  '@id': 'https://www.msingh.com/#me',
  name: 'Mandeep Singh',
  url: 'https://www.msingh.com',
  image: 'https://sukhiplay.com/assets/mandeep.png',
  sameAs: ['https://github.com/meSingh']
};

/** Published posts, newest first. Drafts are left out of every build. */
export async function posts (): Promise<Post[]> {
  return (await getCollection('blog', (p) => !p.data.draft))
    // On a shared date, news first: it is what changed that day, and the
    // guides published alongside it will still be there tomorrow.
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime()
      || Number(b.data.kind === 'announcement') - Number(a.data.kind === 'announcement')
      || a.id.localeCompare(b.id));
}

export const minutes = (p: Post): number =>
  Math.max(1, Math.round((p.body ?? '').split(/\s+/).filter(Boolean).length / 200));

export const longDate = (d: Date): string =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

/** Up to n other posts, the same kind or sharing a topic first. */
export function related (all: Post[], post: Post, n = 3): Post[] {
  const score = (p: Post) =>
    (p.data.kind === post.data.kind ? 2 : 0) + p.data.topics.filter((t) => post.data.topics.includes(t)).length;
  return all.filter((p) => p.id !== post.id)
    .map((p) => ({ p, s: score(p) }))
    .sort((a, b) => b.s - a.s || b.p.data.date.getTime() - a.p.data.date.getTime())
    .slice(0, n)
    .map((x) => x.p);
}
