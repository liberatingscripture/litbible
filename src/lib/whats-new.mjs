// src/lib/whats-new.mjs
//
// The What's New page's entries (/whats-new; the design record, "News in the
// header"). Written by hand, here, and nowhere else: no feed reads this, the
// apps don't, and nothing writes it automatically.
//
// WHAT BELONGS: news that is not a change to the text. Site and app updates,
// new features, launches. WHAT DOESN'T: a change to the translation, its
// footnotes, the intros, the glossary, or the articles. Those are Release
// Notes' (src/data/release-notes.json, drafted from the pushes to main), never
// listed here.
//
// An entry:
//
//   {
//     id: "the-new-site-2027-02", // unique and never reused; lowercase letters,
//                                 // digits, and hyphens. The same style as an
//                                 // id in src/lib/news.mjs, so a header mark
//                                 // there can name the entry it points at
//     date: "2027-02-10",         // YYYY-MM-DD; the page writes it out
//     title: "...",
//     body: ["...", "..."],       // a few short paragraphs, as hand-written
//                                 // HTML (a link to another site carries
//                                 // target="_blank" rel="noopener noreferrer")
//   }
//
// Newest first. src/lib/news.mjs says only WHERE a header mark goes (a menu
// and a row); this file says what the news IS. Words: American spelling, the
// Oxford comma, curly quotes, no em dashes; "Study," never the old name; the
// design's code name is not public and never appears.
//
// Pure data: no DOM, no imports.

export const WHATS_NEW = Object.freeze([
  {
    // LAUNCH DATE TO CONFIRM: the session sets this when the new site goes live.
    id: "the-new-site-2027-02",
    date: "2027-02-10",
    title: "A new look for the site",
    body: [
      "The site has been redrawn, and the words are the same. Here is what you may notice.",
      "Three typefaces, each with one job. Headings are set in Fraunces, a soft serif with some warmth to it. Everything you read is set in Source Sans 3, sized for long stretches of reading. Buttons and small labels are set in Atkinson Hyperlegible Next, which was designed so that letters people often confuse look different from one another.",
      "A Read page whose chapters read on into each other, so you can keep going through a whole book without turning a page. Footnotes sit beside the line they belong to, where you can see both at once.",
      // CHECK AT LAUNCH: this paragraph describes Display and the phone's bar as
      // Phases 3 and 4 build them.
      "Display, the “Aa” in the header, holds your reading settings: the typeface, the text size, the line spacing, and light or dark. On a phone, a bar at the bottom keeps the chapters, search, and the menu within reach of your thumb.",
      "And <a href=\"/colophon\">How this site is made</a> says plainly how it is built, which faces and colors it uses and why, and what we promise about contrast, motion, and reading without JavaScript.",
    ],
  },
  {
    // The best-supported date in the repo (PR #27, which put the release
    // announcement on the site, 2026-07-20): BVJ to confirm.
    id: "the-apps-2026-07",
    date: "2026-07-20",
    title: "The LIT Bible apps are here",
    body: [
      "The Liberation and Inclusion Translation is now an app for iPhone, iPad, and Android. It keeps the whole text and footnotes on your device, so you can read anywhere, with no connection needed, and it stays free.",
      "Find both apps, and what they do, on the <a href=\"/apps\">apps page</a>.",
    ],
  },
]);
