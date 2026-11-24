# GitHub configuration

> Part of this repo's Claude docs; the index is in the root `CLAUDE.md`.
> Claude Code loads this file by itself the first time a session reads a file
> in this directory.

## Dependabot

```
.github/dependabot.yml  # Four update streams: npm at `/`, npm at
                     #   `/workers/contact-form` and at
                     #   `/workers/notebook-service` (separate dep trees), and
                     #   github-actions. Minor/patch are grouped into one weekly
                     #   PR per stream; majors stay ungrouped so each gets the
                     #   hand-checked treatment (`scripts/CLAUDE.md`, "The toolchain's pins").
                     #   0.x direct deps (@astrojs/check, sharp) are excluded
                     #   from the groups too, since Dependabot grades a 0.x
                     #   bump "minor" although `^0.35` won't admit 0.36; keep
                     #   those lists in step with package.json. A group PR can
                     #   still carry a transitive major (see the file's
                     #   header comment).
                     #   Each Worker's stream has a second group
                     #   (`worker-runtime`, `notebook-runtime`), so
                     #   @cloudflare/vitest-plugin and wrangler always bump
                     #   together (bumped apart, they split that Worker's tree).
                     #   The two Workers' lockfiles are independent, so their
                     #   runtime PRs arrive separately: verify both the same way.
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

## Workflows that touch Cloudflare

`workflows/notebook-service-deploy.yml` deploys the notebook service's
preview from `main` and rolls it back. BVJ chose it on 2026-11-23 as the way
BDR rolls the service back. **It is on (since 2026-11-23), so a merge to
`main` that touches `workers/notebook-service/` deploys the preview.** Both
jobs are skipped unless the repository variable `NOTEBOOK_PREVIEW_DEPLOYS` is
`on`, which is its switch (`workers/CLAUDE.md`). Its secrets belong in a GitHub
environment limited to `main` (`notebook-preview`), never in plain repository
secrets, so that a workflow pushed on another branch can't read the
Cloudflare token. **Since step 4f (2026-11-24) the same file holds two
production jobs, off and never run**: they run only from "Run workflow" with
environment `production`, never on a push, only while
`NOTEBOOK_PRODUCTION_DEPLOYS` is `on` (it is not set), and from an
environment of their own, `notebook-production`, which BVJ has not made.
The service's `test/config.test.js` fails if either gains a `push`
condition. It deploys with the wrangler in the package's own lockfile,
not with an action that brings its own. The other workflows (`ci.yml`,
`release-notes.yml`, `apps-mirror-notify.yml`) never touch Cloudflare: the
site deploys through the Pages project's own git connection.
