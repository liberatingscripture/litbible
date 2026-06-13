import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const articles = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/articles" }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    author: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().optional(),
    heroImage: z.string().optional(),
  }),
});

const glossary = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/glossary" }),
  schema: z.object({
    id: z.string(),
    traditional: z.string(),
    greek: z.string(),
    lit: z.string(),
    litMenu: z.string(),
    srOnly: z.string(),
    note: z.string().optional(),
    menuTraditional: z.string().optional(),
  }),
});

export const collections = {
  articles,
  glossary,
};
