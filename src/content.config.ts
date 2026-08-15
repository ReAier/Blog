import { pathToFileURL } from 'node:url';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { getContentPaths } from './lib/content-paths';

const managedContentImage = z.string().regex(
  /^(?:\.\.\/images\/|images\/)[a-z0-9][a-z0-9-]*-[a-f0-9]{12}\.webp$/,
  'Managed cover images must point to images/<name>-<hash>.webp.',
);
const publicImagePath = z.string().regex(/^\/(?!\/)[^\r\n]+$/, 'Public cover paths must start with /.');
const absoluteImageUrl = z.url().refine(
  (value) => value.startsWith('https://') || value.startsWith('http://'),
  'Remote cover images must use HTTP or HTTPS.',
);

const blog = defineCollection({
  loader: glob({ base: pathToFileURL(getContentPaths().blog), pattern: '**/*.md' }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    tags: z.array(z.string().min(1)).default([]),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
    cover: z.union([managedContentImage, publicImagePath, absoluteImageUrl]).optional(),
  }).strict(),
});

export const collections = { blog };
