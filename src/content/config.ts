import { defineCollection, z } from 'astro:content';

const blogs = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishedDate: z.date(),
    updatedDate: z.date().optional(),
    author: z.string().default("Stéphane Karasiewicz"),
    tags: z.array(z.string()),
    featured: z.boolean().default(false),
    readingTimeMinutes: z.number().optional(),
  }),
});

export const collections = { blogs };
