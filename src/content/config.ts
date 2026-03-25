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

export const collections = { projects, blogs };
