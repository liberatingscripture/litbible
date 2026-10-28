---
name: apps-studio
description: Apply BDR's edits to the litbible.net/apps page from the Apps Page Studio board, open the review with a preview link, and report back on the board; also marks merged requests live and reloads the board. Use for "/apps-studio", "apply my apps page changes", "check the Studio", or after an /apps Studio PR merges.
---

# The Apps Page Studio

Board: **https://claude.ai/artifact/1gEt13FJft9nksTPvixtyH**. It is **BDR's private artifact**: only a session signed in to BDR's claude.ai account can read or write it. A session in BVJ's account (or anyone else's) can't reach the board at all, so it can't run this skill. Tell the user to ask BDR, or to have BDR share the board with them.
Rules and background: `src/components/apps/CLAUDE.md` ("The page is data", "The Apps Page Studio"). Read it first.

BDR is a creative director, not an engineer. In chat, keep it short and plain: what got applied, the preview link, anything waiting on BDR's answer. Don't narrate tooling; the board shows progress. Never change BDR's words beyond curly quotes without asking.

## The board's data (ArtifactData, `url` = the board)

- `studio/page`: the seed, which is the page as it stands on main. Only you write it.
- `studio/draft`: BDR's unsent edits. **Never write it.**
- `requests/rNNNN`: one per batch BDR sends. Fields: `number`, `createdAt`, `status`, `statusAt`, `message`, `changes[]`, `log[]` (`{at, text}`), and the ones you write: `results` (`{ <change key>: {status, reason?} }`), `calls[]`, `pr` (`{number, url}`), `preview`.
- `status` runs `sent` → `working` → `review` → `live`, with `needs-you` whenever a call waits on BDR, who can also set `withdrawn`.
- A change is `{key, op, label, note?, …}`; `op` is `set` (`path`, `before`, `after`), `image` (`path`, `before`, `upload: {asset, name, width, height}`, `fileName`, `frame`, `alt?`), `add` (`collection`, `id`, `after`, `data`), `remove`, `order` (`collection`, `after`), or `note` (`text`, for you to do by hand). `core.mjs`'s header documents paths.
- A call is `{id, question, why?, options: [{id, label, detail?, recommended?}], answer: null}`; BDR answers on the board (`answer`, `answerNote`).

Every write to an existing document needs `if_version` from your last read. Append to `log`; don't rewrite earlier entries.

## Each run

1. Load the tool: `ToolSearch` with `select:ArtifactData`.
2. `ArtifactData list` the `requests` collection, then decide, in this order:
   - **`review` with its PR merged** (`gh pr view <n> --json state`): set `status: "live"` plus a log line, then reload the board (the "Reload the board" steps below).
   - **`needs-you` with every call answered**: carry on applying it, with the answers.
   - **`sent`**: apply it, oldest first. Several sent at once go on one branch and one PR, in number order.
   - **Nothing to do**: say so. If main has /apps changes the seed doesn't (compare `studio/page`'s `commit` with `git log origin/main -- src/content/apps-sections src/content/callouts src/content/examples src/content/seasons public/assets src/pages/apps.astro`), offer to reload the board.
3. Set `status: "working"` and add a log line, so the board shows it's in hand.

## Applying a request

4. **Work in a worktree, never in BDR's checkout.** If an earlier Studio request is still in `review` with an open PR, add to that branch (BDR's `before` values already include its changes). Otherwise, from the repo root:
   `git fetch origin && git worktree add .claude/worktrees/apps-studio-<number> -b claude/apps-studio-<number> origin/main`.
   Run `npm ci` there in the background if it has no `node_modules`; the scripts need `sharp`. The apply step doesn't use Astro's build. Astro can't build from a path containing an apostrophe; if yours does, check the page on the Cloudflare preview.
5. Save the request: `ArtifactData get` with `out_dir` set to your scratchpad. Download each upload with `Artifact read` on the board, `path` = the change's `upload.asset`, and `out_dir` = `<scratchpad>/uploads-<number>`. The file lands as `<asset id>.<ext>`.
6. Run, in the worktree:
   `npm run studio:apps -- apply --request=<saved json> --uploads=<uploads dir> --report=<scratchpad>/report-<number>.json`
7. Read the report and the diff (`git status`, `git diff`), then deal with each kind of result:
   - `applied` or `already`: done.
   - `conflict`: never force it. If the page changed under BDR's edit, or a picture failed, write a call: "Use my version" or "Keep what's live", with the reason in `why`.
   - `manual`: notes for you. Do them in code by the rules in `src/components/apps/CLAUDE.md` and `src/styles/CLAUDE.md` (both dark-mode selectors, `--focus-ring`, curly quotes, American spelling). If a note is unclear, write a call; don't guess. A note's `anchor` names the section it's about.
   - **A note with pictures is a picture BDR added to a section.** Its result's `files` lists them, already converted (and framed, if BDR asked, by the `frames` CLI). One upload used by two notes is one file. Lay each out where BDR's words say:
     - Make it a picture field of that section (`{src, alt, width, height}` under a key that says what it is, for example `phones.duo` in the hero or `devices.duo` in the showcase). Put it in the section's JSON, add it to the schema in `src/components/apps/collections.ts` (optional, so the LSC copy still builds), and draw it in the component and in `scripts/apps-studio/board/page.js` (with `im()`, so the board can swap it). Then run `npm run studio:apps -- board-css` if the styles changed. From then on it's an ordinary picture: `slotFor` treats it as a `picture`.
     - If its `alt` is empty, open the picture and write the alt text yourself.
     - Keep the layout's proportions. The showcase draws its devices at real-life scale; `BigScreens.astro`'s header has each device's size, including the iPhone Duo's estimate.
     - Check it at phone, tablet and desktop widths, in light and dark, before writing back. If you can't build here, check on the Cloudflare preview. Describe the placement in the PR.
   - Also read every change's `note`; it may ask for something beyond the change itself.
   - `warnings` (house style): mention them in the PR. If the words are BDR's new copy, write a call; don't fix them silently.
   - `problems`: nothing was written. Fix the cause, or ask BDR.
   - A picture: open each written WebP with Read and check it looks right (cropped, framed, not soft). The report notes a picture that's smaller than its spot.
   - A comparison's LIT text must match the chapter's own wording (`src/data/chapters/<book>-<n>.json`); if it doesn't, write a call.
8. Check: `node --test test/apps-studio.test.js`, `npm run studio:apps -- check`, and `npm test` if code changed. If you changed a component's styles, run `npm run studio:apps -- board-css` and commit `scripts/apps-studio/board/page.css`. If you changed its markup, change `scripts/apps-studio/board/page.js` to match.
9. Commit with the subject `apps: Studio request #<n>, <short summary>`. Push, and open the PR, or update the open one. PR body: each change in plain words with before → after; BDR's notes and your answers to them; files added or removed under `public/assets/` (LSC copies them, and the mirror notification lists them); `Preview: <url>`. Choose the merge method by the root `CLAUDE.md`'s rule and say which in the PR: usually squash, since a Studio request is one logical change. BVJ merges. Never merge it yourself.
10. Preview link: Cloudflare's branch alias, the branch with `/` turned to `-`, plus `.litbible.pages.dev/apps/`. For example, `claude/apps-studio-12` becomes https://claude-apps-studio-12.litbible.pages.dev/apps/. It's live once the Cloudflare check passes on the PR. Don't poll for it.
11. Write back with one `ArtifactData update` (pin `if_version`): `status` (`review`, or `needs-you` if you wrote calls), `statusAt`, `results` (each change key → `{status, reason}`), `pr`, `preview`, `calls`, and the log with one line added (for example "Opened the review; preview ready.").
12. In chat: one or two sentences, with the preview link and the PR link. If calls are waiting, ask BDR to answer them on the board and type /apps-studio again.

## Reload the board (after a merge)

- Update a checkout of main: a fresh worktree on `origin/main`, with `npm ci` there if needed. Run `npm run studio:apps -- seed --out=<scratchpad>/seed.json`.
- `ArtifactData get studio/page` for its version, then `set` it from `file_path`, pinned with `if_version`.
- If pictures changed, or anything in `scripts/apps-studio/board/`, `core.mjs` or `frontmatter.mjs` changed, republish the board. `npm run studio:apps -- board-files` prints the `file_path` and `files` map, with paths relative to the checkout. Publish to `url` = the board, with `root` = that checkout (so the files come from up-to-date main, not whatever branch BDR's folder is on), leaving out `capabilities` and `icon`, so it keeps both.

## Never

- Write `studio/draft`, or delete a request.
- Apply a change whose `before` doesn't match. That's a conflict for BDR to decide.
- Merge a PR, or push to main.
- Edit the page's words beyond curly quotes without BDR's answer.
