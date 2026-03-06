import { defineCollection, z } from 'astro:content';

const projects = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum(['ML', 'Computer Vision', 'NLP', 'Data Engineering', 'MLOps', 'LLM/AI']),
    domain: z.string(),
    icon: z.string(),
    gradient: z.string(),
    technologies: z.array(z.string()),
    github: z.string(),
    result: z.string(),
    featured: z.boolean().default(false),
    order: z.number().default(99),
    screenshots: z.array(z.object({ src: z.string(), alt: z.string() })).default([]),
  }),
});

export const collections = { projects };
