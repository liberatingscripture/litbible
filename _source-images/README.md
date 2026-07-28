# Source images archive

Pre-WebP originals for assets under `public/images/articles/` and
`public/screenshots/`, plus retired brand assets. This folder is intentionally
**outside `public/`**, so nothing here ships to `dist/` or the deployed site —
the site serves the optimized WebP versions committed alongside the originals'
old paths.

Structure mirrors the `public/` tree the files came from, except for the
retired-asset folders, which are grouped by what they were:

```
_source-images/
  images/articles/       # original .jpg/.jpeg/.png article hero images
  screenshots/           # original app screenshot .png files (root + carousel/)
  retired-emblem-2024/   # the pre-2026 site emblem + its icon set (see its README)
```

If you need to regenerate a WebP (e.g. after cropping an original), convert
with `sharp`, matching the target longest-edge/quality used for that asset
group — see the O8 entry in `FIXLIST.md` for the sizing table.
