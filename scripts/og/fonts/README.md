# OG-card fonts

Static font instances committed so `scripts/build-og-images.mjs` can convert
card text to SVG paths (via opentype.js) without depending on system fonts or
network access — same rendering on every machine and in CI.

| File | Family | Source |
|------|--------|--------|
| `fraunces-opsz144-500.ttf` | Fraunces, weight 500, optical size 144 (display cut) | Google Fonts static instance of the Fraunces variable font |
| `inter-400.ttf` | Inter, weight 400, subset to `A-Z a-z 0-9 & . space` | Google Fonts (`text=` subset) |

The Inter file is character-subsetted on purpose: the full Inter TTF carries
GSUB lookups opentype.js can't parse, and the card strings it renders (the
wordmark line and `litbible.net`) only need this charset. If a card ever needs
new Inter characters, re-download with a wider `text=` parameter.

These are deliberately NOT the `@fontsource` files the website itself uses:
the site ships woff2 text-cut instances, while the share cards need the
Fraunces display cut (opsz 144) at poster sizes, in a TTF container that
opentype.js can parse.

Both families are licensed under the SIL Open Font License 1.1 — see
`OFL.txt` in this directory.

- Fraunces: Copyright 2020 The Fraunces Project Authors
  (https://github.com/undercasetype/Fraunces)
- Inter: Copyright 2020 The Inter Project Authors
  (https://github.com/rsms/inter)
