import { defineCollection, z } from 'astro:content';

const pages = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    ogImage: z.string().optional(),
    draft: z.boolean().default(false),
    order: z.number().optional(),
  }),
});

export const collections = { pages };
