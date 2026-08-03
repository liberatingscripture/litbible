# Source images archive

Pre-WebP originals for assets under `public/images/articles/` and
`public/assets/screenshots/`, plus retired brand assets. This folder is intentionally
**outside `public/`**, so nothing here ships to `dist/` or the deployed site —
the site serves the optimized WebP versions committed alongside the originals'
old paths.

Structure mirrors the `public/` tree the files came from, except for the
retired-asset folders, which are grouped by what they were:

```
_source-images/
  images/articles/       # original .jpg/.jpeg/.png article hero images
  screenshots/           # original app screenshot .png files (root + carousel/)
                         #   → ship to public/assets/screenshots/
  retired-emblem-2024/   # the pre-2026 site emblem + its icon set (see its README)
```

The screenshot originals keep their long descriptive names ("iPhone - Hebrews 1
- Advent.png") because the season and passage are worth knowing when you come
back to re-crop one. The shipped copies under `public/assets/screenshots/` are
renamed to lowercase-kebab, which drops that detail on purpose: those filenames
are mirrored to the Liberating Scripture Collective site, and identical names on
both sides are what keep the shared `/apps` components byte-for-byte equal.

If you need to regenerate a WebP (e.g. after cropping an original), convert
with `sharp`, matching the target longest-edge/quality used for that asset
group — see the O8 entry in `FIXLIST.md` for the sizing table.
