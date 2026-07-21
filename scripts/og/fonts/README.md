# OG-card fonts

Static font instances committed so `scripts/build-og-images.mjs` can convert
card text to SVG paths (via opentype.js) without depending on system fonts or
network access — same rendering on every machine and in CI.

| File | Family | Source |
|------|--------|--------|
| `fraunces-opsz144-500.ttf` | Fraunces, weight 500, optical size 144 (display cut) | Google Fonts static instance of the Fraunces variable font |
| `inter-400.ttf` | Inter, weight 400, subset to `A-Z a-z 0-9 & . ' space` | Google Fonts (`text=` subset) |
| `inter-400italic.ttf` | Inter, weight 400, *italic*, same subset as `inter-400.ttf` | Google Fonts (`text=` subset) |

The italic exists for one word: the `/apps` card's tagline is the site's own
hero line ("A New Testament that's *for* everyone."), and "for" needs the
same `<em>` emphasis the live page gives it. Rather than switch fonts
mid-sentence (the tagline is Inter throughout, not Fraunces), the card
renders "for" as a separate `textPath` call in `inter-400italic.ttf` at the
same size/color, positioned by the preceding/following segments' measured
widths.

The Inter files are character-subsetted on purpose: the full Inter TTF
carries GSUB lookups opentype.js can't parse, and the card strings they
render (the wordmark line, `litbible.net`, and the `/apps` card's copy) only
need this charset. Note what is therefore **absent**: comma, colon, and every
dash. If a card ever needs new Inter characters, re-download with a wider
`text=` parameter — both the roman and italic files, if the new character
appears in an emphasized word too.

To regenerate: request the legacy (non-variable) Google Fonts CSS endpoint
with an old-browser user agent, which serves a raw TTF instead of WOFF2/EOT —
`curl -A "Mozilla/5.0 (Linux; U; Android 2.2) AppleWebKit/533.1 (KHTML, like
Gecko) Version/4.0 Mobile Safari/533.1"
"https://fonts.googleapis.com/css?family=Inter:400&text=<url-encoded chars>"`
(append `italic` to `Inter:400` for the italic face) returns a `@font-face`
with a `format('truetype')` `src` URL; download that URL. (A plain modern UA,
or omitting the UA override, returns EOT — a different container opentype.js
can't parse either — so the UA matters.)

opentype substitutes `.notdef` for a missing character without erroring, which
would ship a tofu box in a card nobody re-inspects, so `build-og-images.mjs`
glyph-checks every string it draws and throws instead. A build failing with
"font is missing glyphs" means either reword the card copy or widen the subset
here.

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
