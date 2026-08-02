# LIT Bible

The website for the **Liberation and Inclusion Translation (LIT)** of the New
Testament — a trauma-informed, justice-oriented translation from the original
languages, produced by the [Liberating Scripture Collective](https://liberatingscripture.org).

Live site: **[litbible.net](https://litbible.net)**

## What this is

A static website with a **content-as-data** design. The scripture text lives in
the repository itself — 260 JSON files, one per New Testament chapter — alongside
Markdown for book introductions, a glossary, and articles. There's no database
and no CMS: the build reads these files and compiles a fast static site, plus
JSON APIs that the companion iOS and Android apps consume.

Built with [Astro](https://astro.build) and TypeScript. Scripture search runs
against a build-generated verse index (verse-exact results and deep links);
[Pagefind](https://pagefind.app) covers the glossary, articles, and book
introductions. No front-end
framework — interactivity is plain JavaScript layered on as progressive
enhancement, so the site works fully with JavaScript disabled.

## Getting started

You'll need [Node.js](https://nodejs.org) at or above the floor in
`package.json`'s `engines` field. (That floor is set by the test suite, which
relies on Node's built-in TypeScript type stripping, not by Astro — Astro's own
minimum is lower.)

```sh
npm install        # install dependencies (also wires up the git pre-commit hook)
npm run dev        # start the dev server at http://localhost:4321
```

## Common commands

| Command | What it does |
| :------ | :----------- |
| `npm run dev` | Start the local dev server at `localhost:4321` |
| `npm run build` | Full production build into `dist/` (see pipeline below) |
| `npm run preview` | Build, then preview the production site locally |
| `npm run check` | Type-check `.astro`/`.ts` files |
| `npm run validate:chapters` | Check all chapter JSON files for errors |
| `npm run fix:chapters` | Auto-fix chapter JSON formatting |
| `npm test` | Run the unit test suite |
| `npm run check:links` | Verify every internal link in a production build resolves |
| `npm run build:favicons` | Regenerate the favicon and app-icon set from the emblem SVGs (only needed when the logo changes) |
| `npm run build:alignment` | Rescan the text for glossary-term renderings (only needed when the text or the glossary changes) |
| `npm run review:alignment` | Open the local review tool for that dataset (see below) |

The production build runs in stages: refresh the podcast feed → generate topic
indexes → generate the verse search index → generate the mobile-app manifest →
generate the JSON API → generate chapter share images → compile the site with
Astro → build the Pagefind search index.

## Project layout

```
src/
  data/chapters/   # 260 chapter JSON files — the scripture text
  data/alignment/  # Where each Greek term's LIT rendering appears (see below)
  data/intros/     # Book introductions (Markdown)
  content/         # Glossary + articles (Markdown content collections)
  pages/           # Routes (scripture, reading view, glossary, articles, …)
  components/       # Reusable Astro UI components
  layouts/         # Page templates
  scripts/         # Client-side JavaScript (progressive enhancement)
  styles/          # CSS
scripts/           # Build & validation scripts (Node.js)
public/            # Static assets + generated output (API, search index)
workers/           # Cloudflare Worker for the contact + app-support forms (deployed separately)
```

## Editing the scripture text

Chapter content lives in `src/data/chapters/<book>-<chapter>.json`
(e.g. `john-3.json`). After editing any chapter file, run:

```sh
npm run validate:chapters
```

A git pre-commit hook also validates staged chapter files automatically, so a
malformed chapter can't be committed.

## The alignment dataset

`src/data/alignment/` records where each Greek term's LIT rendering actually
appears in the text — the corpus-wide view a footnote can't give you, since a
footnote only ever speaks about its own verse. The glossary renders it as the
"Where it appears" list under each entry.

Unlike the rest of the generated output, these files are **committed**: they
carry review state, so re-running the generator merges with what a human has
already checked rather than overwriting it.

```sh
npm run build:alignment
```

Run it after editing the scripture text or the glossary. It isn't part of
`npm run build` — a build shouldn't rewrite files you've reviewed.

### Reviewing it

The scan can only find renderings the glossary already lists, which is a real
ceiling: the glossary's headline for a term is rarely the only way the text
renders it. The review tool closes that gap by working from the Greek instead.
It lists every verse where a term's Greek word occurs, proposes a rendering
where it can, and records what you decide.

```sh
npm run review:alignment
```

It opens on `localhost:4500` and saves each decision as you make it. It needs a
local copy of the [MorphGNT](https://github.com/morphgnt/sblgnt) analysis of the
Greek text — the tool tells you how to fetch one if it's missing. That copy is a
reference for the tool only; nothing from it is published, and it stays out of
the repository.

## If something breaks badly

`DISASTER-RECOVERY.md` at the repo root lists every dashboard and secret
(by name, never value) behind the deployed site — Cloudflare, the domain,
email, the works — plus the from-zero redeploy path. Keep it updated when
an integration or secret changes.

## A note for contributors using Claude Code

This repo includes a `CLAUDE.md` file with detailed operational guidance for the
[Claude Code](https://claude.com/claude-code) AI assistant — data formats, build
internals, and conventions. It's a useful deep reference for humans too.
