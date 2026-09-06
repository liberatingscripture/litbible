# Topic tagging

**This file is the authority on how a chapter's `topics` array is chosen.**
CLAUDE.md carries the short version and points here.

An external `chapter_json_formatting.md` §9–§10 carried these rules previously.
It is outdated and is not in this repo; don't consult it, and don't reintroduce
a reference to it.

## What the tags are for

`topics` is a **search tag system** on litbible.net. Full-text search already
covers any word that literally appears in the translation (scripture through the
verse index, everything else through Pagefind). **Tags exist only to cover what
full-text search cannot.** Three jobs:

1. **Bridging vocabulary.** LIT uses non-traditional renderings. A reader
   searching "repentance" has to land on a chapter whose text says "reorienting
   the mind".
2. **Naming what the text doesn't.** Scene names, genre labels, and topical
   subjects a reader would type that appear nowhere in the text — "parable",
   "the Good Samaritan", "Feeding the 5000".
3. **Surfacing load-bearing themes.** Concepts that *do* appear in the text,
   tagged only where they carry theological or narrative weight. "love" is
   tagged in John 13–15 and 1 Corinthians 13, not in every chapter containing
   the word.

**Tags are not a concordance. This is the single most common failure mode.**

## How the search works, and why it shapes the tags

Search is **not case-sensitive but matches on exact prefix**, with ghost-text
autocomplete firing after the first few characters. So **a tag must begin with
the word a reader would type first**. Both "the Good Samaritan" and "Good
Samaritan" are needed, because different readers start at different points.
**Multiple tags for one concept at different entry points are intentional, not
redundant.**

## The significance filter

Do not tag every chapter where a concept or figure appears — only where it is
**load-bearing**.

- **Figures:** tag chapters containing an important, memorable story about them.
  Not every appearance.
- **Concepts and themes:** tag where the concept is prominently at stake or most
  fully developed. Not every passing mention.
- **Alt-translation pairs:** tag on key passages for that concept, not on every
  occurrence of the term.

The test: **"Would someone trying to find the important passage about X
correctly land on this chapter?"** If yes, tag it. If the figure or concept just
passes through, don't.

*Worked negative example:* Luke 19 mentions Pharisees in vv. 39–40 as a passing
foil. "Pharisees" was tagged there on a reflexive "named group appears in text"
basis, and was removed. That reflex is exactly what the filter is for.

## Tag categories

### 1. Alternative translations

Tag **both** the LIT term and the traditional one. **When one side of a pair is
present, both must be.**

| Traditional | LIT |
|---|---|
| Holy Spirit | Sacred Life-breath |
| eternal life + everlasting life | agelong life |
| Son of Man | Son of Humanity |
| baptism | immersion |
| John the Baptist | John the Immerser |
| kingdom of God | reign of God |
| repentance | reorientation of the mind |
| disciples | students |
| Sabbath | Shabbat |
| gospel + good news | triumphant message |
| Satan + devil | Adversary + False Accuser |
| Messiah | Christ |
| Savior | liberator |
| salvation | liberation |
| resurrection | reawakening |

Group rules:

- **eternal life / everlasting life / agelong life** — all three when any is present.
- **gospel / good news / triumphant message** — all three when any is present.
- **Satan / devil / Adversary / False Accuser** — all four when the figure is
  named or described as adversarial. Where only the adversary/opponent role is
  in view and not the accuser role, Satan / Adversary alone is acceptable.
- **Messiah / Christ** — always together.
- **salvation / liberation** — always together on load-bearing passages.
- **resurrection / reawakening** — always together.

### 2. Figure names

All known forms, **central chapters only**: John the Baptist + John the
Immerser; Mary + Miriam (for Mary the mother of Jesus, also "Mary mother of
Jesus"); Mary Magdalene + Miriam the Tower; Judas + Judas Iscariot + Judah +
Kerioth + Iscariot.

### 3. Scene and story names

Formal and colloquial: Feeding the 5000 + feeding the five thousand + 5000 +
loaves and fishes; cleansing of the temple + Jesus cleanses the temple +
flipping tables + overturn tables; woman at the well + Samaritan woman; parable
of the fig tree + fig tree; lament over Jerusalem.

### 4. Memorable quote fragments

Multiple entry points: cast the first stone + let he who is without sin cast the
first stone; God so loved the world; it is finished; last will be first + first
will be last. Written **without internal punctuation** — the corpus has "love is
patient love is kind" and "if God is for us who is against us".

### 5. Greek/Hebrew/Aramaic/Latin terms

When the term is doing theological work in the passage and a scholar might
search it: logos, hamartia, agapao, phileo, metanoia, gehenna, diabolon,
stoicheia, authentein, paidagogos.

### 6. Topical subjects and thematic concepts

When prominently at stake: parable, healing, forgiveness, justice, love, faith,
prophecy, covenant, circumcision, disability, poverty, marginalization.

## What not to tag

- Anything failing the significance filter.
- **Thematic ethical/social question tags.** The topics system deliberately does
  not function as a topical Q&A directory. The absence of tags framed as
  social-issue lookups is a **values choice, not a gap**. Do not add them.

## Formatting rules

- **No hyphens standing in for spaces.** Hyphens only where part of the term
  itself. Correct: Life-breath, Sacred Life-breath, God-breathed, double-edged
  sword, well-being, seventy-two. Incorrect: agelong-life, triumphant-message,
  transforming-the-mind.
- No duplicate tags within a chapter.
- Alt-translation pairs complete — if one side is present, both are.
- **A chapter reaching 30+ tags must be re-reviewed against the significance
  filter** and trimmed where appropriate.
- Curly apostrophes, per the corpus prose convention ("Jairus’ daughter").

### Standardized casing

Casing does not affect search but must be consistent across chapters:

> Adversary, Advocate, Beelzebul, Caesar, Day of the Lord, False Accuser,
> Feeding the 5000, Gentiles, Holy Spirit, Jairus’ daughter (capital J only),
> John the Baptist, John the Immerser, Life-breath, Messiah, Moses, Palm Sunday,
> Pharisees, Sabbath, Sacred Life-breath, Satan, Savior, Shabbat, Son of
> Humanity, Son of Man, Spirit of Truth, Sukkot, The-One-Who-Is, Torah, Word
> (capital W for logos/Conversation).

Other people groups are lowercase unless the word begins the tag.

## Two things not to "fix"

1. **`topics-index.json` contains lowercase hyphenated keys.** Those are a build
   artifact of slugification (`normalizeTopic` in
   `scripts/build-topics-index.mjs`). Source chapter files use space-separated
   strings with proper-noun capitalization. **Do not normalize source files to
   match the index.**
2. Ten chapters have intentional verse-numbering gaps from SBLGNT
   text-critical omissions and are allowlisted in the validator. Not a topics
   concern; don't flag them as errors.

## File handling

`topics` sits between `description` and `paragraphs`; preserve that position
(`npm run fix:chapters` enforces the canonical order). Preserve existing
formatting: 2-space indent, literal Unicode characters rather than `\uXXXX`
escapes. Do not reorder, reformat, or touch `paragraphs` or `footnotes` while
editing topics.

`topics` is repo-only — not in the Word masters — so a fresh
`npm run import:chapter` writes `topics: []` and the array is filled in by hand.

## Topics go stale

Labels are often drawn from LIT's own wording, so changing a verse's rendering
can orphan one — `luke-12` carried `"compassion work"` after the text that
phrase came from was replaced. **Re-check a chapter's topics whenever its
wording changes**, the same way `npm run audit:alignment` is run after a verse
edit. See FOLLOW-UP-RECONCILIATION.md § "Topics arrays" for the pairing gaps
that pass found in Mark.

## Verification

There is **no validator rule for topics** — `validate-chapters.mjs` does not
check them, so these are hand-checked. Run this over every file touched:

```python
import json, sys
PAIRS = [
    {"Holy Spirit", "Sacred Life-breath"},
    {"eternal life", "everlasting life", "agelong life"},
    {"Son of Man", "Son of Humanity"},
    {"baptism", "immersion"},
    {"John the Baptist", "John the Immerser"},
    {"kingdom of God", "reign of God"},
    {"repentance", "reorientation of the mind"},
    {"disciples", "students"},
    {"Sabbath", "Shabbat"},
    {"gospel", "good news", "triumphant message"},
    {"Messiah", "Christ"},
    {"Savior", "liberator"},
    {"salvation", "liberation"},
    {"resurrection", "reawakening"},
]
ALLOWED_HYPHENS = {
    "Life-breath", "Sacred Life-breath", "God-breathed", "double-edged sword",
    "well-being", "seventy-two", "The-One-Who-Is",
}
def check(path):
    d = json.load(open(path, encoding="utf-8"))
    t = d.get("topics", [])
    problems = []
    if len(t) != len(set(t)):
        problems.append(f"duplicates: {sorted({x for x in t if t.count(x) > 1})}")
    for group in PAIRS:
        present = group & set(t)
        if present and present != group:
            problems.append(f"incomplete pair: have {sorted(present)}, missing {sorted(group - present)}")
    for tag in t:
        if "-" in tag and tag not in ALLOWED_HYPHENS:
            problems.append(f"suspect hyphen: {tag!r}")
    if len(t) >= 30:
        problems.append(f"{len(t)} tags — needs significance re-review")
    print(f"{path}: {len(t)} tags")
    for p in problems:
        print(f"   {p}")
    return not problems
ok = all([check(p) for p in sorted(sys.argv[1:])])
print("\nALL CLEAR" if ok else "\nISSUES FOUND")
```

The Satan / devil / Adversary / False Accuser group is deliberately absent from
that list, since partial sets are legitimate there — check it by hand.

## Working process

1. Read this file.
2. Read the **full text** of the chapter. The significance filter cannot be
   applied without reading the passage.
3. Read the topics of several already-tagged chapters across genres to calibrate
   density and phrasing — `john-3`, `luke-15`, `mark-5`, `romans-8`,
   `1corinthians-13`, `james-2`.
4. **Propose the tag list and get approval before writing it**, for the first
   chapter of a batch at minimum.
5. Report the tag count, the tags, a one-line justification for any borderline
   tag, and — separately — **the tags considered and rejected** under the
   significance filter. That rejected list is as useful for review as the tags.
