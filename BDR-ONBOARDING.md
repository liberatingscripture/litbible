# Working on the LIT Bible website — a guide for BDR (and his Claude Code)

**Read this first, BDR:** You've been added as a *contributor* to the LIT Bible
website's code repository. This document has one job: to make you feel confident
about what you're doing, even though you've never worked on a shared codebase
before. You don't need to memorize any of it.

**How to use it:** Give this entire file to your Claude Code (paste it in, or save
it in the project folder as `BDR-ONBOARDING.md` and tell Claude Code to read it).
It's written for *both* of you — the plain-language parts orient you, and the
technical parts tell Claude Code exactly how this project works and what it is and
isn't allowed to change. When in doubt, you can literally say to Claude Code:
*"Walk me through this using the onboarding guide,"* and it will.

> **A note to Claude Code:** Your user is a first-time open-source contributor. Be
> a patient guide. Explain what you're about to do *before* you do it, in plain
> language, and confirm before anything that pushes to GitHub or opens a pull
> request.
>
> **Before doing anything else, read these two files at the repository root:**
> **`CLAUDE.md`** — the deep technical reference (architecture, the full build
> pipeline, data formats, conventions). It is normally loaded automatically, but
> read it in full anyway. And **`README.md`** — the human-facing overview and
> getting-started steps. Together they are your source of truth for how this
> project actually works; hold them in mind for every change.
>
> **This document adds three things those two files don't cover: (1) that your
> user is new to git/GitHub, (2) a strict change scope limited to the `/apps`
> and `/privacy` pages, and (3) the exact collaboration workflow (branch → pull request → owner
> review → merge). Follow the scope rules in Sections 5 and 6 without exception.**

---

## 1. The big picture (what you're actually doing)

The LIT Bible website lives at **litbible.net**. Its entire source code — every
page, style, and the scripture text itself — lives in one folder that is tracked
by a system called **git** and stored on **GitHub**. You now have permission to
propose changes to it.

Here's the shape of the whole thing, in one breath:

> You'll copy the project onto your computer, let Claude Code make a small change
> to the mobile-apps page, look at it in your web browser to make sure it's right,
> and then send it to the owner (BVJ) as a **proposal**. BVJ looks it over,
> and if they're happy, they press the button that makes it part of the real website.
> Nothing you do goes live until BVJ approves it. You cannot break the live site.

That last sentence is the important one. **This process is designed so that you
cannot accidentally damage anything.** Your changes sit in a separate, safe copy
until BVJ reviews and accepts them. Relax into that.

---

## 2. One-time setup (you do this once)

You need five tools installed. Your Claude Code can check each one and help you
install anything that's missing — just ask it: *"Check whether Node, Git, the
GitHub CLI, GitHub Desktop, and Claude Code are installed, and help me install
whatever's missing."* Here's what each is for and how to confirm it's working.

| # | Tool | Why you need it | How to check it's installed |
|---|------|-----------------|-----------------------------|
| 1 | **GitHub Desktop** | The friendly app that copies ("clones") the project onto your computer and shows you its status visually. | Open the app; sign in with your GitHub account. |
| 2 | **Node.js** (latest LTS) | Runs the website locally on your computer so you can preview changes. | In a terminal: `node -v` should print a version like `v22.x` or newer. |
| 3 | **Git** | The engine underneath everything; Claude Code uses it to save and send your changes. | `git --version` prints a version. (On Windows, install "Git for Windows.") |
| 4 | **GitHub CLI** (`gh`) | Lets Claude Code create the change-proposals ("pull requests") for you. | `gh --version` prints a version. |
| 5 | **Claude Code** | Your AI collaborator that does the actual editing. | You already have it if you're reading this through it. |

### Step-by-step

1. **Accept the invitation.** BVJ added you as a collaborator. Check the email
   inbox for the GitHub account you gave him, or go to
   `https://github.com/liberatingscripture/litbible` while signed in — there will
   be a banner to **accept the invite**. You must accept it before you can send
   changes. *(Being a "collaborator" means you can send proposals directly from
   the main project — you do not need to make your own separate copy of it on
   GitHub.)*

2. **Install the five tools above** (Claude Code can walk you through each).

3. **Sign in to GitHub from the command line.** This is what lets Claude Code
   send your work to GitHub. In a terminal, run:
   ```
   gh auth login
   ```
   Choose **GitHub.com** → **HTTPS** → **Login with a web browser**, and when it
   asks *"Authenticate Git with your GitHub credentials?"* say **Yes**. Confirm
   it worked with `gh auth status`.

4. **Clone the project with GitHub Desktop.** In GitHub Desktop: **File → Clone
   repository → URL**, paste:
   ```
   https://github.com/liberatingscripture/litbible.git
   ```
   and pick a folder on your computer to put it in. "Cloning" just means *making
   your own working copy*. Note the folder location — that's where the project
   now lives.

5. **Open that folder in Claude Code**, and have it get oriented first. A good
   first instruction: *"Read `CLAUDE.md` and `README.md` in this repo so you
   understand how the project works, then install the project's building blocks."*
   The install command is:
   ```
   npm install
   ```
   (This downloads everything the site needs and sets up an automatic safety
   check. It only needs to be done once, and again occasionally if BVJ tells
   you dependencies changed.)

6. **Sanity check — see the site on your own machine.** Ask Claude Code to start
   the local preview:
   ```
   npm run dev
   ```
   Then open **http://localhost:4321/apps** in your web browser. If you see the
   apps page, everything works. Press `Ctrl+C` in the terminal to stop it when
   you're done. 🎉 You're set up.

---

## 3. The words people use (plain-language glossary)

Don't let the jargon intimidate you. Here's all of it, defined once:

- **Repository (or "repo")** — the project folder, with its full history. The LIT
  Bible repo is `liberatingscripture/litbible`.
- **Clone** — make your own working copy of the repo on your computer.
- **`main`** — the one true version of the project; what the live website is built
  from. You will **never** edit `main` directly. Think of it as the published
  master copy.
- **Branch** — a private, throwaway side-copy where you make changes without
  touching `main`. Every change you make starts by creating a branch. Think of it
  as a sandbox.
- **Commit** — a saved snapshot of your changes, with a short note describing them.
  Claude Code makes commits as it works.
- **Push** — upload your branch (and its commits) from your computer to GitHub.
- **Pull** — the reverse: download the latest version from GitHub to your computer.
- **PR = Pull Request** — the heart of collaboration. A **pull request** is a formal
  proposal that says *"here are my changes; please review them and, if you like
  them, pull them into `main`."* Despite the name, it's not you pulling anything —
  it's you *requesting* that the owner pull your work in. When you open a PR,
  GitHub shows exactly what you changed, line by line, and lets BVJ comment,
  request tweaks, approve, and merge. **This is how everything you do reaches the
  site.**
- **Review** — BVJ reading your PR and either approving it or asking for changes.
- **Merge** — the moment BVJ accepts your PR and your changes become part of
  `main`. **Only BVJ merges. You never merge your own work.**
- **CI = Continuous Integration** — an automatic robot on GitHub. The instant you
  open (or update) a PR, CI rebuilds the entire website from your changes and runs
  a battery of checks. If anything is broken, CI shows a **red ✗**; if all is well,
  a **green ✓**. It's a safety net that catches mistakes *before* BVJ even looks.
  More on this in Section 7.
- **CLI = Command-Line Interface** — a text-based way to run a program by typing
  commands. "GitHub CLI" (`gh`) is GitHub's command-line tool.

---

## 4. The everyday workflow (the loop you'll repeat)

This is the entire routine, start to finish. Claude Code does the mechanical
steps; your job is to describe what you want, look at the result, and approve
sending it. **You can just tell Claude Code: "Let's start a new change to the apps
page," and it should run this whole loop with you.**

1. **Start fresh.** Claude Code makes sure your copy is up to date with `main`
   (`git switch main`, then `git pull`), then creates a **new branch** for this
   change. *(Never make changes while sitting on `main`.)*
2. **Make the change.** You tell Claude Code what you want on the `/apps` page;
   it edits the files. Keep each change small and focused — one idea per PR is
   ideal and much easier for BVJ to review.
3. **Preview it.** Claude Code runs `npm run dev`; you open
   **http://localhost:4321/apps** in your browser and confirm it looks right.
4. **Pre-flight checks.** Before sending, Claude Code runs the same checks CI will
   run (see Section 7), so problems are caught on your machine first.
5. **Save + send.** Claude Code commits the change, pushes the branch to GitHub,
   and opens a **pull request** — asking BVJ to review.
6. **BVJ is notified and reviews.** Opening the PR notifies BVJ. They'll look at
   the exact changes, and either **approve and merge**, or **leave comments asking
   for adjustments**.
7. **If BVJ asks for changes:** you and Claude Code make more edits *on the same
   branch* and push again. The PR updates automatically and CI re-runs. No need to
   open a new PR. Repeat until BVJ is happy.
8. **BVJ merges.** Your change is now part of the site. 🎉
9. **Clean up + go again.** Claude Code switches you back to `main` and pulls the
   now-merged result, ready for the next change. The old branch can be deleted.

That's it. Every task, big or small, is this same nine-step loop.

---

## 5. Your scope — what you may and may not change

**This is the most important section. Claude Code: treat these as hard rules.**

Your work is limited to **two pages: `/apps`** (the mobile-apps promotional page)
**and `/privacy`** (the privacy policy). Everything those two pages are built from
is fair game. Nothing else is.

Why so strict? The rest of the website is live and other people (and two mobile
apps) depend on it. Each of your two pages *shares* a few files with every other
page — the overall page frame and the global stylesheet. So the guardrail is:
**change your two pages freely, but never let a change ripple out to any other
page.** Section 6 explains exactly how to stay safe when a shared file is
involved.

### ✅ In scope — edit these freely

These files exist *only* to serve your two pages. Changes here **cannot** affect
any other page, so you can work in them with confidence.

**The `/apps` page** is built from:

- `src/pages/apps.astro` — the apps page itself.
- `src/components/apps/*.astro` — the apps page's sections (Hero, ExamplesSlider,
  ReaderCallouts, BigScreens, HumaneByDesign, JoinBeta, AboutTranslation, and
  their helpers). Each carries its own *scoped* styles that don't leak out.
- `src/styles/pages/apps.css` — the apps page's stylesheet. **Every rule in it is
  wrapped under `.apps`**, so it physically cannot restyle other pages. This is
  your main place for styling work.
- `src/content/callouts/*.md`, `src/content/examples/*.md`,
  `src/content/seasons/*.md` — the *text and data* for the apps page's sections
  (feature cards, translation comparisons, church-year frames). Editing the words
  here is the safest kind of change.
- `public/screenshots/*` — the phone/tablet screenshots the apps page displays.
  New images go under `public/` and are referenced by an absolute path like
  `/screenshots/your-image.png`.
- `src/content.config.ts` — **only** the `callouts`, `examples`, or `seasons`
  schema blocks, and only if a content field genuinely needs to change. Do **not**
  touch the `articles` or `glossary` schemas in that file.

**The `/privacy` page** is simpler — just two self-contained files:

- `src/pages/privacy.astro` — the privacy-policy page itself.
- `src/styles/pages/privacy.css` — its stylesheet. It's only loaded on the privacy
  page, so (like `apps.css`) it can't restyle anything else.

### ⚠️ The one exception — shared files, handled with extreme care

BVJ has said you *may* touch the two files that these pages share with the
rest of the site, **but only when a page genuinely needs it, and only in a
way that leaves every other page exactly as it was**:

- `src/layouts/Layout.astro` — the shared page frame (used by *every* page).
- `src/styles/global.css` — the shared global stylesheet (loaded by *every* page).

Touching these is a last resort, not a first move. **Always prefer to solve the
problem inside the in-scope files above.** If a shared file truly must
change, follow Section 6 to the letter and prove no other page moved.

### 🚫 Off-limits — do not touch

Everything not listed above, including (but not limited to): the scripture chapter
pages and JSON in `src/data/`, the reading view, search, the glossary/articles
pages and their styles, other shared components like `SiteHeader.astro` and
`SiteFooter.astro`, the build scripts in the top-level `scripts/` folder, the
`workers/` folder, and the CI configuration in `.github/`. If a task seems to
require changing any of these, **stop and ask BVJ first** — it's outside the
agreed scope.

---

## 6. How to keep every other page safe (the golden rules)

When a change stays entirely inside the ✅ in-scope files, other pages are safe
**by construction** — those files don't feed any other page. The only way to
accidentally affect another page is by editing a **shared** file (`Layout.astro`
or `global.css`). So:

**Golden rule #1 — Look at the file list.** Before opening a PR, Claude Code should
check *which files the change touches* (`git status` / the PR's "Files changed").
If that list contains **only** in-scope files for your pages, you're safe — nothing else can
be affected. If it contains `Layout.astro`, `global.css`, or anything shared, the
remaining rules apply.

**Golden rule #2 — Additive and scoped only, in shared files.** In `global.css`,
do not change or remove an existing rule, color, or token that other pages rely
on. Instead, *add* something new — ideally a rule targeting the `.apps` selector
(e.g. `.apps .something { … }`), or a brand-new custom property that only the apps
page reads. In `Layout.astro`, don't change existing behavior; if the apps page
needs something new, add it behind a **new optional setting with a default that
keeps every existing page identical** (the file already does this with settings
like `bg`, `twitterCard`, etc.). The apps page already opts into its own look via
`bg="white"` — mirror that pattern.

**Golden rule #3 — Reuse the design tokens; don't redefine them.** The apps
stylesheet already maps the site's brand colors into its own names (for example,
its accent is the site's `--green-text`, and it uses `--green-deep` for solid
green buttons with white text). Style the apps page by *using* these existing
tokens, not by editing their definitions in `global.css`.

**Golden rule #4 — If you touched a shared file, prove other pages are unchanged.**
Claude Code should spot-check representative pages *before and after* the change
and confirm they look and behave identically. Check at least: the homepage `/`, a
scripture chapter (e.g. `/john-3`), `/read`, `/search`, `/glossary`, `/articles`,
and `/about`. Test in **both light and dark mode**, because the shared files carry
the site's theming. If anything on those pages shifts even slightly, the change is
not acceptable as-is — pull it back into your page-scoped files.

> Claude Code: a reliable way to prove this is to build the site on `main` and on
> your branch and compare the generated `dist/` output for non-apps pages — if a
> shared-file change leaked, the diff for those pages will show it. At minimum,
> eyeball the pages above in the dev preview in both themes.

---

## 7. Notes for Claude Code — repo facts, commands, and CI

This section is the technical brief. (BDR: you can skim this; it's mostly for your
Claude Code.)

**Claude Code: before anything else, read `CLAUDE.md` and `README.md` at the repo
root.** They are the authoritative reference for the architecture, the build
pipeline, data formats, and conventions. Everything below is a quick recap plus
the apps-specific specifics you won't find spelled out there.

### Stack
- **Astro 6** static site generator, **TypeScript** (strict). Vanilla CSS, no
  utility framework. No client-side JS framework — interactivity is
  progressive-enhancement vanilla JS. The apps page is presentational; it needs no
  client JS beyond what already exists.
- Requires **Node ≥ 22.12**. `npm install` also wires a git pre-commit hook that
  validates chapter JSON — irrelevant to apps work (it no-ops when no chapter
  files are staged), but don't bypass it with `--no-verify`.

### Local commands
```
npm run dev                 # local preview at http://localhost:4321 (use /apps)
npm run build               # full production build — exactly what CI does
npm run check:links         # verify no broken internal links (needs a build first)
npm test                    # unit tests
npm run validate:chapters   # chapter JSON check (passes trivially for apps work)
```

### Pre-flight before every push (run these; fix anything that fails)
CI will run all of these on GitHub, so running them locally first means the PR
goes green the first time:
```
npm run validate:chapters
npm test
npm run build
npm run check:links
```
The full `npm run build` takes a minute or two and does a lot (that's normal). For
apps changes, the `astro build` stage inside it is what catches broken imports,
bad component references, and TypeScript errors. `check:links` catches any broken
link you introduced on the apps page.

### What CI checks (from `.github/workflows/ci.yml`)
On **every pull request** and every push to `main`, CI: installs dependencies →
validates chapter JSON → runs unit tests → does a **full production build** → checks
that every internal link resolves. A green ✓ on the PR means all of that passed. A
red ✗ means something needs fixing — open the failing check on GitHub to read the
log, fix it locally, and push again (the PR and CI update automatically).

### Git + PR mechanics (exact commands)
Start each change from an up-to-date `main`, on a new branch:
```
git switch main
git pull
git switch -c apps/<short-description>     # e.g. apps/join-beta-copy
```
After editing and passing pre-flight checks:
```
git add -A
git commit -m "fix(apps): <what changed>"   # or feat(apps): … — match repo style
git push -u origin apps/<short-description>
gh pr create --base main \
  --title "fix(apps): <what changed>" \
  --body "<one-paragraph summary of the change and why>" \
  --reviewer liberatingscripture
```
Notes:
- The `--reviewer liberatingscripture` flag requests BVJ's review so they're
  notified directly. *(BVJ: confirm that's the GitHub username you want review
  requests sent to.)*
- Any branch name that isn't `main` is fine; a descriptive `apps/…` prefix keeps
  things tidy. (Claude Code's own default `claude/…` branch names are fine too.)
- **Never** `git push` to `main`, and **never** merge the PR — leave merging to
  BVJ.

### Updating a PR after review feedback
Make more commits on the *same* branch and push again — the open PR updates itself
and CI re-runs. Don't open a second PR for the same piece of work.

### Keeping a branch current (only if BVJ's `main` moved and asks you to update)
```
git fetch origin
git merge origin/main       # Claude Code resolves any conflicts, then re-push
```

---

## 8. Guardrails & etiquette (quick do / don't)

**Do**
- Keep each PR small and about one thing.
- Preview in the browser and run the pre-flight checks before pushing.
- Write a clear PR title and a short description of *what* and *why*.
- Stay inside the `/apps` scope (Section 5).
- Ask BVJ when unsure — a question is cheaper than an unwanted change.

**Don't**
- Don't commit directly to `main` or merge your own PR.
- Don't edit files outside your scope (the `/apps` and `/privacy` pages) without
  checking with BVJ.
- Don't change existing rules/tokens in `global.css` or existing behavior in
  `Layout.astro` — additive and scoped only (Section 6).
- Don't hand-edit generated folders (`dist/`, `public/api/`, `public/og/`,
  `public/search/`, `.astro/`) — they're rebuilt automatically.
- Don't bypass the pre-commit hook (`--no-verify`) or force-push over `main`.
- Don't commit secrets, tokens, or passwords. (There aren't any here; keep it that
  way.)

---

## 9. When something goes wrong (it's fine — nothing is on fire)

- **CI shows a red ✗ on my PR.** Something in the build or checks failed. On the
  PR page, click **Details** next to the failed check to read the log, tell Claude
  Code what it says, fix it locally, run the pre-flight checks, and push again.
  The live site is untouched — a failing PR changes nothing.
- **I think I edited the wrong file / it looks broken.** Nothing is saved to the
  real site until BVJ merges. Ask Claude Code to show you what changed
  (`git status`, `git diff`) and to undo anything unwanted. Worst case, the whole
  branch can be thrown away and you start a new one from `main`.
- **"Merge conflict" appears.** This just means `main` and your branch both changed
  the same lines. Ask Claude Code to resolve it — it's routine.
- **I'm completely lost.** Tell Claude Code: *"Explain where I am in the workflow
  and what the safe next step is."* It can read the repo's state and orient you.
- **A change seems to need a file outside `/apps`.** Stop and message BVJ before
  doing it. That's the correct move, not a failure.

---

## 10. One-page cheat sheet

**Setup (once):** accept invite → install GitHub Desktop, Node, Git, gh, Claude
Code → `gh auth login` → clone with GitHub Desktop → `npm install` → `npm run dev`
→ visit `/apps`.

**Every change:**
`git switch main` → `git pull` → `git switch -c apps/<name>` → *(edit your page's files)*
→ preview `/apps` in browser → `npm run build && npm run check:links && npm test`
→ `git commit` → `git push` → `gh pr create --reviewer liberatingscripture` →
BVJ reviews & merges → back to `main`.

**Golden rule:** stay in your pages' own files; if a change touches `Layout.astro` or
`global.css`, make it additive/scoped and prove no other page changed.

**Never:** commit to `main`, merge your own PR, or edit outside your scope
without asking.

You've got this. Every safeguard here exists so that the worst thing that can
happen is a friendly "could you adjust this?" from BVJ — never a broken website.
