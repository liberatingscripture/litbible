# Contributing to LIT Bible

Thanks for taking an interest in the **Liberation and Inclusion Translation
(LIT)** and the site that hosts it. This is a small, mostly one-person project,
so contributions of any size are genuinely welcome — from a typo fix to a
translation question.

## Translation feedback

If you've spotted something in the translation itself — a rendering you'd
question, a footnote that needs clarifying, a passage that doesn't read right
— the best way to reach out is the [contact page](https://litbible.net/contact).
That feedback goes directly to the translator and is read personally. You
don't need a GitHub account or any technical background to do this; a plain
email through the form is perfect.

## Reporting issues or proposing changes

Technical issues (broken links, rendering bugs, accessibility problems,
build failures) are welcome as GitHub issues or pull requests here in the
repo.

- **Issues**: describe what you saw, what you expected, and how to reproduce
  it if possible. A URL or screenshot helps a lot.
- **Pull requests**: small, focused PRs are easiest to review. If you're
  planning something larger (a new feature, a structural change), consider
  opening an issue first to talk it through.

## Repo internals

This repo uses a content-as-data architecture — no database, no CMS, the
scripture text and site content live directly in the repository. `CLAUDE.md`
at the repo root is the deep reference for how everything fits together:
directory layout, the build pipeline, data formats, and conventions. It's
written for an AI coding assistant, but it's just as useful for a human
contributor getting oriented.

## Editing chapter JSON

If your change touches anything under `src/data/chapters/`, run:

```sh
npm run validate:chapters
```

before opening a PR. This checks structure and cross-references and is also
enforced by a pre-commit hook, so a malformed chapter file can't be
committed. `npm run fix:chapters` can auto-fix formatting issues.

## License note

The site's code and the LIT translation text are licensed differently — see
the license notice on [litbible.net/read](https://litbible.net/read#license)
for how the translation itself may be reused. If you're contributing code,
you're doing so under the terms in this repository.
