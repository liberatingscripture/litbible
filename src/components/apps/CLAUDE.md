# The /apps mirror

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory. It also governs `src/styles/pages/apps.css` and `src/content/{callouts,examples,seasons}/`.
> Cross-references such as "below" or "rule 15" were written when all of
> this was one file, so they may point into another area file; the root's
> index says which file holds each section.

- **The /apps mirror: litbible is upstream for the LSC site.**
  `liberatingscripture.org/apps` is the same page, and these files are kept
  **byte-for-byte identical** in both repos at the same paths: everything under
  `src/components/apps/`, `src/styles/pages/apps.css`, and the section content
  in `src/content/{callouts,examples,seasons}/`. Edit them **here**; LSC copies
  them across. Two things are deliberately NOT mirrored — `src/pages/apps.astro`
  (two sites can't share a canonical URL, so LSC keeps its own Layout props and
  JSON-LD) and LSC's `apps-bridge.css` (which exists precisely so `apps.css` can
  stay a pure mirror).
  The screenshot **bytes** under `public/assets/screenshots/` are a third,
  different case. They were an exception until LSC adopted litbible's
  ~2x-display-size copies (FIXLIST O8); the 12 files both repos ship are now
  byte-identical. But they are **matched by hand, not enforced**:
  `check-apps-mirror.mjs` reads every file as UTF-8 and folds CRLF, which
  mangles binaries, so putting them in `MIRRORED` would need a hash path the
  script doesn't have. Re-copy them if either side re-exports, and note that
  `_source-images/screenshots/` here now holds the only full-resolution
  originals outside LSC's git history.
  This is why **`public/assets/` is the mirrored asset tree** — `assets/screenshots/`
  and the two `assets/images/lit-app-icon.*` files use lowercase-kebab names with
  no spaces so both repos' components can carry identical `src` strings.
  `public/images/` is litbible-only and **cannot move**: it's referenced ~191
  times across ~84 files including chapter JSON, which ships to the native apps
  as an API contract.
  Enforcement runs from both ends. LSC's `apps-mirror.yml` fails a PR that edits
  a mirrored file into a state that doesn't match litbible's `main`, scoped to
  the PR's own changed files so LSC lagging behind never reddens an unrelated PR.
  In this repo, `.github/workflows/apps-mirror-notify.yml` opens (or comments on)
  an issue in the LSC repo when a mirrored file lands on `main`. It's
  **notify-only by design** — LSC being briefly behind is normal, and failing
  litbible's CI over it would put a red X on a contributor who did nothing wrong.
  It needs the `LSC_SYNC_TOKEN` secret and skips with a warning if it's absent.
  It diffs each push's **whole range** (`before..sha`), so it checks out full
  history. It used to fetch two commits deep and fall back to the last commit
  alone whenever `before` was missing, which is every multi-commit push. For a
  week (2026-09-23 to 09-30) that silently skipped five pushes touching
  `/apps` and `/privacy`, with every run green. Don't reintroduce a shallow
  fetch or a quiet fallback: if the base can't be found the job now fails with
  an error. To backfill a gap, run it by hand with the `since` input set to
  the last commit LSC was notified about; one issue then covers the range.
  That same workflow also watches `/privacy`, which is **not** a mirror: the two
  policies cover two different entities and are written separately (owner
  decision), so the notification says "review", never "copy".
