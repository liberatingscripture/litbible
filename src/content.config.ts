import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { appsCollections } from "./components/apps/collections";

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
    /**
     * Held back from every reader-facing surface — /glossary, the SearchBar
     * term menu, and the apps' feed — while the entry is still being written.
     * The file stays in the collection on purpose: `build-alignment.mjs` reads
     * these files off disk as the scanner's seed, and an entry withdrawn from
     * the directory takes its alignment records with it (an unmatched
     * `glossary-scan` record is dropped by `mergeScanWithExisting` even once
     * confirmed). Draft here means unpublished, never absent.
     */
    draft: z.boolean().optional(),
  }),
});

export const collections = {
  articles,
  glossary,
  // The /apps page's collections (callouts, examples, seasons, appsSections),
  // defined in the mirrored directory so the LSC site's config shares them.
  ...appsCollections,
};
