# LIT Bible — Claude Project Instructions

## Project Overview

**LIT Bible** is a static website for the *Liberation and Inclusion Translation* (LIT) of the New Testament — a trauma-informed, justice-oriented Bible translation. The site is built with Astro and uses a content-as-data architecture with 260 JSON chapter files covering the full New Testament.

## Tech Stack

- **Framework**: Astro 5 (static site generator)
- **Language**: TypeScript (strict mode)
- **Styling**: Vanilla CSS (no utility framework)
- **Search**: Pagefind (static, build-time search indexing)
- **Icons**: simple-icons
- **Runtime**: Node.js (build scripts only; zero client-side JS framework)

## Common Commands

```bash
npm run dev              # Start dev server at localhost:4321
npm run build            # Full production build (topics → API → Astro → Pagefind)
npm run preview          # Build + preview locally
npm run validate:chapters # Validate chapter JSON files
npm run fix:chapters     # Auto-fix chapter JSON issues
```

### Build Pipeline (in order)

1. `build:topics` — generates `public/topics-index.json` from chapter data
2. `build:api` — generates `public/api/content.json` from chapter data
3. `astro build` — compiles site to `dist/`
4. `pagefind` — indexes `dist/` and outputs `public/search/`

## Project Structure

```
src/
  components/   # Reusable Astro components (SiteHeader, SearchBar, etc.)
  content/      # Astro content collections (articles as Markdown)
  data/
    chapters/   # 260 JSON files — one per NT chapter (e.g. john-3.json)
    books.js    # NT book constants (keys, names, chapter counts)
    intros/     # Book intro data (currently empty)
  layouts/      # Page layout templates (Layout, ScriptureLayout, ReadLayout)
  pages/        # Route-based pages ([slug].astro, glossary.astro, etc.)
  styles/       # CSS (global.css, read-mode.css, articles.css)
  utils/        # Utility functions (hbq-normalize.ts)
scripts/        # Build and validation scripts (Node.js .mjs files)
public/         # Static assets + generated outputs (api/, search/, topics-index.json)
```

## Chapter JSON Format

Each file in `src/data/chapters/` follows this structure:

```json
{
  "bookKey": "john",
  "chapter": 3,
  "type": "epistle",
  "title": "...",
  "description": "...",
  "topics": ["topic-slug"],
  "paragraphs": [
    {
      "type": "paragraph",
      "content": "<span class=\"vn\" id=\"v1\">1</span> HTML text..."
    }
  ],
  "footnotes": [
    {
      "id": "fn1",
      "ref": "1",
      "content": "Footnote text..."
    }
  ]
}
```

- **Verse numbers** are `<span class="vn" id="vN">N</span>` elements inline in paragraph content
- **Topics** are slugs that map to `public/topics-index.json`
- Run `npm run validate:chapters` after editing chapter JSON

## Key Conventions

- **Book keys**: lowercase, no spaces, no hyphens — e.g. `john`, `1corinthians`, `revelation`
- **File naming**: `{bookKey}-{chapter}.json` — e.g. `1corinthians-1.json`
- **Generated files** (`public/api/`, `public/search/`, `public/topics-index.json`) are git-ignored; always regenerated at build time
- **No client-side JS framework** — interactions are handled with vanilla JS in `.astro` files
- **Content collections** for articles are defined in `src/content/config.ts`

## Important Files

| Path | Purpose |
|------|---------|
| `src/data/books.js` | Source of truth for NT book list and chapter counts |
| `src/pages/[slug].astro` | Dynamic scripture chapter pages |
| `src/styles/global.css` | Main stylesheet (33KB) |
| `scripts/validate-chapters.mjs` | Chapter JSON validator |
| `scripts/build-topics-index.mjs` | Topic index generator |
| `astro.config.mjs` | Astro configuration |
| `pagefind.yml` | Search index config (excludes footnote refs) |
