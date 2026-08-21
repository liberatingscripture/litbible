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

// --- /apps promo page collections (section content as data) ---

const callouts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/callouts" }),
  schema: z.object({
    title: z.string(),
    order: z.number(),
    /** Platform shown in the paired screenshot */
    platform: z.enum(["ios", "android"]),
    /** Light or dark mode for the paired screenshot */
    mode: z.enum(["light", "dark"]),
    /** Accent color name used in the paired screenshot */
    accent: z.enum(["advent", "christmas", "lent", "easter", "ot"]),
    /** Side the screenshot lives on at desktop widths */
    imageSide: z.enum(["left", "right"]),
    /** Path under /public to the framed screenshot */
    image: z.string().optional(),
  }),
});

const examples = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/examples" }),
  schema: z.object({
    reference: z.string(),
    /** 'hero' surfaces it in the first-taste comparison; 'deeper' stores it */
    placement: z.enum(["hero", "deeper"]),
    order: z.number(),
    comparison: z.enum(["NIV", "NRSV", "ESV", "KJV"]),
    litText: z.string(),
    traditionalText: z.string(),
    note: z.string().optional(),
  }),
});

const seasons = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/seasons" }),
  schema: z.object({
    name: z.string(),
    order: z.number(),
    /** CSS custom property name (matches a --season-* token in apps.css) */
    colorVar: z.string(),
    image: z.string().optional(),
  }),
});

export const collections = {
  articles,
  glossary,
  callouts,
  examples,
  seasons,
};
