import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const legal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/legal' }),
  schema: z.object({
    title: z.string().min(1),
    navLabel: z.string().min(1),
    footer: z.boolean(),
    order: z.number().int().nonnegative(),
    description: z.string().min(1),
    version: z.string().min(1),
    status: z.enum(['draft', 'current', 'superseded']),
    lastUpdated: z.coerce.date(),
    effectiveDate: z.coerce.date().optional(),
  }),
});

export const collections = { legal };
