# Retired emblem (2024–2026)

The original LIT Bible emblem: a dark-green disc carrying white line-art of a
flame, globe, laurel wreaths and an open book. Replaced in July 2026 by
`public/images/lit-logo-2026.svg` / `lit-logo-2026-ring.svg`.

Kept here — outside `public/`, so nothing ships — because the mark is the
project's visual history and may be wanted for a retrospective, print piece, or
if the new mark is ever rolled back.

| File | What it was |
|------|-------------|
| `lit-logo.png` | 1000×1000 raster master; everything else derived from it |
| `lit-logo.webp` | 1000px web copy, used at the 220px footer/hero sizes |
| `lit-logo-96.webp` | 96×96, cut for the 48px header slot |
| `favicon.svg` | a hand-vectorized **redraw** of the mark, maintained independently of the raster master — the drift risk that `scripts/build-favicons.mjs` now exists to prevent |
| `favicon.ico`, `favicon-32x32.png`, `apple-touch-icon.png`, `web-app-manifest-192x192.png`, `web-app-manifest-512x512.png` | the icon set as it shipped |

The replacements are generated from the two committed SVGs by
`npm run build:favicons`.
