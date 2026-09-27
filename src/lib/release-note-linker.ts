// Build-time shell for release-note-links.mjs: collects the glossary ids and
// article slugs a change description can point at, and returns the one
// function the release notes page and /read's "What's new" panel both call.

import { getCollection } from "astro:content";
import { linkChangeDescription } from "./release-note-links.mjs";
import { linkRefs } from "./scripture-refs-data.mjs";

export async function releaseNoteLinker(): Promise<(description: string) => string> {
  // Draft glossary entries aren't on /glossary, so nothing links to them.
  const glossary = (await getCollection("glossary")).filter((e) => !e.data.draft);
  const byTraditional = new Map(glossary.map((e) => [e.data.traditional, e.data.id]));
  const articleSlugs = new Set((await getCollection("articles")).map((e) => e.id));
  return (description) =>
    linkChangeDescription(description, {
      linkRefs,
      glossaryId: (traditional: string) => byTraditional.get(traditional) ?? null,
      articleSlugs,
    });
}
