import { defineCollection, z } from "astro:content";

const articles = defineCollection({
  type: "content",
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
  type: "content",
  schema: z.object({
    // Anchor ID used for #fragment links (e.g. "angel-message")
    id: z.string(),
    // Bold/strikethrough word shown in the entry heading
    traditional: z.string(),
    // Greek transliteration (not Pagefind-indexed)
    greek: z.string(),
    // LIT word(s); use " / " to separate slash-alternatives (e.g. "trust / faithfulness")
    lit: z.string(),
    // Label used in the "LIT Word Choice" navigation menu
    litMenu: z.string(),
    // Extra search tokens for the sr-only span
    srOnly: z.string(),
    // Optional parenthetical note rendered after the LIT word (not indexed)
    note: z.string().optional(),
    // Override the traditional menu label when it differs from `traditional`
    // (e.g. "Good [1]" displays as "Good -1-" in the menu)
    menuTraditional: z.string().optional(),
  }),
});

export const collections = {
  articles,
  glossary,
};
