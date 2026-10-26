# GitHub configuration

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory.
> Cross-references such as "below" or "rule 15" were written when all of
> this was one file, so they may point into another area file; the root's
> index says which file holds each section.

## Dependabot

From the root's project tree.

```
.github/dependabot.yml  # Three update streams: npm at `/`, npm at
                     #   `/workers/contact-form` (separate dep tree), and
                     #   github-actions. Minor/patch are grouped into one weekly
                     #   PR per stream; majors stay ungrouped so each gets the
                     #   hand-checked treatment (see the Astro 7 pins above).
                     #   0.x direct deps (@astrojs/check, sharp) are excluded
                     #   from the groups too, since Dependabot grades a 0.x
                     #   bump "minor" although `^0.35` won't admit 0.36; keep
                     #   those lists in step with package.json. A group PR can
                     #   still carry a transitive major (see the file's
                     #   header comment).
                     #   The worker stream has a second group, `worker-runtime`,
                     #   so @cloudflare/vitest-plugin and wrangler always bump
                     #   together (bumped apart, they split the worker's tree).
                     #   Dependabot can't follow a package rename: the plugin
                     #   was @cloudflare/vitest-pool-workers until 2026-08, and
                     #   the frozen old name drew no PRs for six weeks while the
                     #   new one shipped the fixes. When an upstream package
                     #   goes quiet while its siblings keep releasing, check its
                     #   repo for a rename.
                     #   Security-advisory PRs are a SEPARATE track this file
                     #   doesn't configure — grouped by the repo's "Grouped
                     #   security updates" setting, and they can carry a major
                     #   (see the file's header comment)
```
