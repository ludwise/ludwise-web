import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const legal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/legal' }),
  schema: z.object({
    policyId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    locale: z.string().min(2),
    translationStatus: z.enum(['source', 'draft', 'approved']),
    title: z.string().min(1),
    navLabel: z.string().min(1),
    footer: z.boolean(),
    order: z.number().int().nonnegative(),
    description: z.string().min(1),
    version: z.string().min(1),
    sourceVersion: z.string().min(1).optional(),
    status: z.enum(['draft', 'current', 'superseded']),
    lastUpdated: z.coerce.date(),
    effectiveDate: z.coerce.date().optional(),
  }),
});

export const collections = { legal };
