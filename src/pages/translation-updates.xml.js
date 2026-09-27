// The release notes as an RSS feed: one item per publish, newest first,
// linking to that entry on /release-notes. Built from the same
// release-notes.json the apps sync as Translation Updates, which does not
// change for this. A website asset, never under /api.
import rss from "@astrojs/rss";
import releaseNotes from "../data/release-notes.json";
import { releaseNoteLinker } from "../lib/release-note-linker";
import { entryIds, renderDetailHtml, renderRelabelHtml } from "../lib/release-notes-view.mjs";

// Enough for a new subscriber to see recent history; the page has the rest.
const MAX_ITEMS = 20;

export async function GET(context) {
  const linkDescription = await releaseNoteLinker();
  const site = context.site ?? new URL("https://litbible.net");
  // The linker writes site-relative hrefs; a feed reader needs them absolute.
  const absolute = (html) => html.replace(/href="\/(?!\/)/g, `href="${site.origin}/`);
  const ids = entryIds(releaseNotes);

  return rss({
    title: "LIT Translation Updates",
    description:
      "Changes to the Liberation and Inclusion Translation as they are published: new chapters, revised wording, footnotes, book introductions, the glossary, and articles.",
    site,
    items: releaseNotes.slice(0, MAX_ITEMS).map((entry, i) => {
      const n = entry.changes.length;
      const list = entry.changes
        .map((change) => {
          const lines = [linkDescription(change.description)];
          if (change.detail) lines.push(renderDetailHtml(change.detail, { joiner: "<br>" }));
          if (change.relabel) lines.push(renderRelabelHtml(change.relabel));
          return `<li>${lines.join("<br>")}</li>`;
        })
        .join("");
      return {
        title: `${entry.label}: ${n} change${n === 1 ? "" : "s"}`,
        // The date is a calendar day; noon UTC keeps it on that day everywhere.
        pubDate: new Date(`${entry.date}T12:00:00Z`),
        // Absolute, because the library appends a slash to a relative link,
        // which would land after the fragment.
        link: new URL(`/release-notes/#${ids[i]}`, site).href,
        description: entry.changes
          .slice(0, 3)
          .map((change) => change.description)
          .join("; ") + (n > 3 ? `; and ${n - 3} more` : ""),
        content: absolute(`<ul>${list}</ul>`),
      };
    }),
    customData: `<language>en-us</language>`,
  });
}
