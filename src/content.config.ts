import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.enum(['subnetting', 'cisco', 'routing', 'switching', 'general']),
    tags: z.array(z.string()),
    readingTime: z.number().optional(),
    featured: z.boolean().default(false),
  }),
});

export const collections = { articles };
