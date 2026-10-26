/**
 * How the /apps sections turn their data (src/content/apps-sections/) into
 * markup. Mirrored with everything else in this directory, and read by the
 * Apps Page Studio's scripts, so a rule here is a rule there: see
 * scripts/apps-studio/core.mjs, which restates `inline` for the board and is
 * tested against this file.
 */
import type { CollectionEntry } from "astro:content";

/** One section's data, narrowed to its kind. */
export type Section<K extends string> = Extract<
  CollectionEntry<"appsSections">["data"],
  { kind: K }
>;

/**
 * The copy's one inline format: *italic* marks a phrase, and a line break in
 * the text is a line break on the page. Everything else is plain text, and is
 * escaped here, so a field can never carry markup of its own.
 */
export function inline(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
}

/** The classes a section's `background` puts on it: none for plain. */
export function band(background: string): string {
  if (background === "plain") return "";
  if (background === "soft") return "band--soft";
  return `band--tint band--${background}`;
}

/**
 * Whether a text link leaves litbible.net, and so opens in a new tab, as
 * every external link on the site does. Links to litbible.net itself, written
 * in full so the LSC copy of this page reaches them too, stay in the tab.
 */
export function leavesSite(href: string): boolean {
  return /^https?:\/\//i.test(href) && !/^https?:\/\/(www\.)?litbible\.net(\/|$)/i.test(href);
}
