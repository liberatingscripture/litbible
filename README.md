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

You'll need [Node.js](https://nodejs.org) v22.12 or newer (required by Astro 6).

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

The production build runs in stages: refresh the podcast feed → generate topic
indexes → generate the verse search index → generate the mobile-app manifest →
generate the JSON API → generate chapter share images → compile the site with
Astro → build the Pagefind search index.

## Project layout

```
src/
  data/chapters/   # 260 chapter JSON files — the scripture text
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

## If something breaks badly

`DISASTER-RECOVERY.md` at the repo root lists every dashboard and secret
(by name, never value) behind the deployed site — Cloudflare, the domain,
email, the works — plus the from-zero redeploy path. Keep it updated when
an integration or secret changes.

## A note for contributors using Claude Code

This repo includes a `CLAUDE.md` file with detailed operational guidance for the
[Claude Code](https://claude.com/claude-code) AI assistant — data formats, build
internals, and conventions. It's a useful deep reference for humans too.
