/**
 * The /apps page's content collections, defined once for both sites.
 *
 * This file is mirrored with the rest of src/components/apps/, and each
 * site's src/content.config.ts spreads `appsCollections` into its own
 * `collections`. The schemas used to be pasted into both configs by hand,
 * which is a copy nothing checked; here a change reaches the LSC site the way
 * any other /apps change does.
 *
 * The Apps Page Studio writes these files (scripts/apps-studio/), so a field
 * added here needs a matching rule there, and its tests will say so.
 */
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

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

// --- The page's sections, one JSON file each, in `order` ---
//
// Every word, image, and background on the page that isn't a callout, an
// example, or a season lives here. Prose fields take the one inline format
// render.ts reads: *italic*, and a line break where the text has one.

/** An image as the page shows it; width and height give its shape before it loads. */
const image = z.object({
  src: z.string(),
  alt: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const link = z.object({ label: z.string(), href: z.string() });

/** A store button: the first is drawn solid, the second outlined. */
const button = z.object({
  platform: z.enum(["ios", "android"]),
  label: z.string(),
  href: z.string(),
});

/**
 * A section's band: plain (the page), soft (the quiet grey), or a tint of a
 * season's color or LIT Green, mixed like the callout cards so it holds in
 * both themes. apps.css draws each one.
 */
const background = z
  .enum(["plain", "soft", "advent", "christmas", "lent", "easter", "ot", "green"])
  .default("plain");

const base = {
  /** Position on the page, smallest first. */
  order: z.number(),
  /** Kept in the files but left off the page. */
  hidden: z.boolean().optional(),
  background,
};

const appsSections = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/apps-sections" }),
  schema: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("hero"),
      ...base,
      title: z.string(),
      subtitle: z.string(),
      buttons: z.array(button).length(2),
      /** Two phones, slightly overlapped: `back` behind, `front` in front. */
      phones: z.object({ back: image, front: image }),
    }),
    z.object({
      kind: z.literal("about"),
      ...base,
      title: z.string(),
      text: z.string(),
      link: link.optional(),
    }),
    z.object({
      kind: z.literal("examples"),
      ...base,
      eyebrow: z.string(),
      title: z.string(),
      /** The label over the LIT column; the example itself is the `examples` entry placed `hero`. */
      litLabel: z.string(),
    }),
    z.object({
      kind: z.literal("reader"),
      ...base,
      /** The church-year carousel after the callouts; its frames are the `seasons` entries. */
      carousel: z.object({
        title: z.string(),
        text: z.string(),
        /** The passage every frame shows, as its alt text names it. */
        passage: z.string(),
        /** What a screen reader hears for the whole stage. */
        stageLabel: z.string(),
        /** The size every season's screenshot shares. */
        frame: z.object({
          width: z.number().int().positive(),
          height: z.number().int().positive(),
        }),
      }),
    }),
    z.object({
      kind: z.literal("bigscreens"),
      ...base,
      eyebrow: z.string(),
      title: z.string(),
      text: z.string(),
      /** A tablet and an unfolded foldable, composed at real-life scale. */
      devices: z.object({ tablet: image, foldable: image, duo: image.optional() }),
    }),
    z.object({
      kind: z.literal("humane"),
      ...base,
      eyebrow: z.string(),
      title: z.string(),
      negations: z.array(z.string()),
      paragraphs: z.array(z.string()).min(1),
      link: link.optional(),
    }),
    z.object({
      kind: z.literal("get-app"),
      ...base,
      title: z.string(),
      text: z.string(),
      buttons: z.array(button).length(2),
    }),
  ]),
});

export const appsCollections = { callouts, examples, seasons, appsSections };
