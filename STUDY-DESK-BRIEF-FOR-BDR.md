# LIT Study Desk and account sync: a brief for the apps

**For:** BDR's Claude, working in the LIT Bible iOS and Android app codebases
**From:** BVJ (owner of litbible.net) and the Claude that drafted the plan with them in the website repo
**Date:** October 1, 2026 (revised October 2)
**Status:** Planning only. Nothing is built on the website or in the apps yet.

The full plan, with mockups, is here: https://claude.ai/artifact/8Eyhmzd1xGTUPrjkwwSUqp. The litbible repo's complete record of the project, kept current, is `STUDY-DESK.md`. This brief is the part that concerns the apps, written so you can work from it without that page. Where the plan uses an ID (N3, C8, M13), it is given here so BDR and BVJ can cross-reference.

---

## How to use this brief

1. Read it all once.
2. **Look at the actual app code before answering anything.** Several of our assumptions about the apps are guesses (listed in "What we assumed about the apps"). Correct them from the code.
3. Answer the requests in "What we're asking for", in order.
4. Then do the most important part: **tell us what we've missed.** You know the apps and their platforms better than we do. "What we'd like you to think through" has prompts, but don't stop at them.
5. Reply in the format under "How to reply", so BVJ can bring it back to the website side.

Please be direct. If something in the plan is a bad idea for the apps, say so and say why.

---

## The project in one paragraph

The website, litbible.net, is getting a **Study Desk**: a notebook for **places** (where you're reading), **bookmarks**, **highlights** and **notes**, plus **sheets**. A sheet is passages arranged with the reader's own text between them, for printing or presenting to a class or study group. It is **desktop only**: phones and tablets already have the free LIT apps, so the website becomes the place you prepare at a desk, and the apps stay the place you read anywhere. **No account is the default**, and the notebook lives in the browser. On October 1, BVJ and BDR agreed to add an **optional account that syncs the notebook between the website and both apps**. That sync is why this brief exists.

## Background the apps already know, restated so we agree on it

- The website is a static Astro site on Cloudflare Pages. The apps consume its **content API** under `/api/` (`version.json`, `manifest.json`, `data/*`). The apps poll `version.json` and download the files whose hashes changed.
- **The Study Desk does not change that contract.** Chapter JSON, `/api/`, the glossary feed, `topics.json` and the release notes feed all stay exactly as they are. Accounts would be a **separate service**, outside `/api/`.
- The apps already have their own notes and highlights: four highlight colors, an inline note tool that quotes the words, and a note mark in the left margin. They are backed up through **iCloud** (iOS) and **Android backup**, with no LIT server involved.
- **The LIT's text keeps changing.** The release notes list 491 changes since March 29, 2026, 211 of them to wording. Any note anchored to the text has to survive the wording changing under it. This is the single biggest design constraint, and it affects the apps' existing notes as much as the website's.
- **The license changed on October 1** and is live at https://litbible.net/read#license-terms. Noncommercial use has no amount limits, teaching handouts may leave blanks, and commercial quotation within limits needs no permission. The notice grants its permissions "to anyone who reads this notice or uses the LIT Bible website or apps", which is why we're asking the apps to link to it (request 1).

## What the website will build (so you know what will arrive in synced data)

Phases 1 to 3 are website only and need nothing from the apps. They matter here because their records are what an account would sync.

**Notes (N1 to N9, M11)**
- Notes attach to a verse, a range, or a phrase within a verse. They are always dated.
- Notes can be marked as **questions**, and a sheet gathers these into a "For discussion" section.
- **N3: notes that notice the translation moved.** Each note and highlight stores a **copy of its verse as it read when the note was made**. When a later publish changes the wording, the note says so and shows what changed. The comparison evens out quotes, dashes and spaces, so punctuation-only changes don't count. A highlight whose words are gone falls back to the whole verse.
- **N2: notes that follow a word.** A note on a glossary term (for example *sarx*, rendered "self-preservation") shows wherever the translation renders that term, across all its English renderings. It uses the published alignment dataset.
- **N8: a private note before a hard passage**, with the passage **blurred** until the reader clicks to show it. This is trauma-informed and private to the reader. Screen readers get the same protection.
- **M11:** notes on a footnote.

**Places and bookmarks (B1 to B4)**
- "Continue reading", one position per book, and a few **named ribbons** ("Thursday group") that move as you read from them.
- Bookmarks can have an optional label and remember how you got there (a search, an episode, an intro).

**Highlights (H1, H2)**
- **Four colors, the same number as the apps.** Each color has a meaning the reader names ("promise", "question", "harm", "liberation").
- **H2: concept marks**, for example "mark *pistis* in Galatians". These are saved as a **rule**, not as individual marks, so they follow newly reviewed data.

**Sheets (S1 to S10, M2 to M9)**
- Sheets have their own page, with leader and participant copies, fill-in-the-blank handouts, a footnote picker, present mode, Word export, and shared links.
- Printed sheets carry **QR codes per chapter that open the chapter in the app** if it's installed.
- Sheets are **computer only for now**. A sheet link opened on a phone says to open it on a computer. The record format and addresses are chosen so **the apps could take sheets on later**.

**Across the desk (D1 to D6, M1, M7, M8)**
- D1: the notebook can also save into a **Markdown file** the reader picks, so it syncs through their own OneDrive, Dropbox or iCloud Drive with no account.
- D5: an optional **lock (passphrase) for shared computers**, encrypting the notebook in the browser.
- D6: a **first-time choice**. Keep the notebook on this computer (optionally also in a file), or create an account. Each choice explains what it means.
- M7: a **trash** holding deleted items for 30 days. M8: personal tags.

## How the website stores and anchors things (draft, open to change)

The draft below is what we most need you to check against the apps.

- **Storage:** IndexedDB in the browser. Every record has a **permanent ID**, a **last-modified time**, a **deletion marker** (tombstone) and a **schema version**, so it can sync later.
- **Verse anchor:** every verse on the site carries an OSIS reference (`Rom.8.3`). Ranges are two OSIS refs.
- **Phrase anchor:** the W3C Web Annotation **TextQuoteSelector**. It stores the exact words plus a little text before and after, then finds them again on each visit. If the words are gone, it falls back to the verse and shows N3's notice.
- **Footnote letters are never anchors**, because they relabel whenever a note is added or removed. On September 3, Romans 4's notes m to v became o to x.
- **Text normalization for anchoring and comparison:** verse numbers and footnote letters removed, the disputed-passage markers ⟦ ⟧ stripped, and whitespace collapsed. Quotes and dashes are evened out for N3's comparison. **The apps must normalize identically**, or a phrase quoted on one platform won't be found on the other. CLAUDE.md in the website repo notes the apps currently have no equivalent of the website's bracket-marker strip.
- **Format:** marks on the text (notes, highlights, bookmarks, questions, tags) use the **W3C Web Annotation** JSON shape. Sheets and places use a small versioned LIT format.

A sketch of one highlight with a note, to react to rather than adopt:

```json
{
  "@context": "http://www.w3.org/ns/anno.jsonld",
  "id": "urn:uuid:7f3c1e0a-...",
  "type": "Annotation",
  "motivation": ["highlighting", "commenting"],
  "created": "2026-09-12T16:04:00Z",
  "modified": "2026-09-12T16:10:00Z",
  "body": { "type": "TextualBody", "format": "text/plain",
            "value": "Self-preservation as the drive to protect my standing." },
  "target": {
    "source": "https://litbible.net/romans-8/",
    "selector": [
      { "type": "FragmentSelector", "value": "v3-4" },
      { "type": "TextQuoteSelector",
        "exact": "rendered a verdict against deviation in self-preservation",
        "prefix": "under deviation and ", "suffix": " so that the Torah" }
    ]
  },
  "lit": {
    "schema": 1,
    "osis": ["Rom.8.3", "Rom.8.4"],
    "verseCopy": { "Rom.8.3": "…verse text as it read on 2026-09-12…" },
    "contentVersion": "v20260912.ab12cd34",
    "color": "<the apps' own color name>",
    "deleted": false
  }
}
```

**Two rules we want every client to follow (audit C8):**
1. **Keep what you don't understand.** Every client, the apps included, preserves record kinds and fields it doesn't recognise, untouched, and writes them back. Otherwise a newer website feature would be silently deleted by an older app, or the reverse.
2. **Highlight colors are stored by the apps' own color names**, so a highlight is the same color on every device. The website maps its reader-named meanings onto those.

## Accounts and sync: what's decided

- **No login stays the default** everywhere. The website works fully without an account.
- **An account adds full sync** of the notebook between the desktop website, the iOS app and the Android app.
- **Sign-in methods:** email and password with two-step verification (authenticator app plus recovery codes, no SMS), **passkeys**, **Google**, and **Apple**.
- "Log in with iCloud" means **Sign in with Apple** as an identity method. Synced notes would live in a LIT sync service, not in the reader's iCloud, because Android readers can't use iCloud. Our suggestion is to leave today's iCloud and Android backup alone for readers who never sign in, and to copy their notes into the account when they do. How the apps handle that move is BDR's call.
- **One source of truth at a time (C5).** Signed out, the device holds the notebook. Signed in, the account is the truth.
- **Conflicts keep both versions** of a note edited on two devices before syncing, and the reader chooses. Highlights, bookmarks and places take the latest change. Deletions sit in the trash for 30 days on every device.
- **Account pages work on every device**, phones included (C1), even though the notebook UI is desktop only.
- **BVJ leans toward end-to-end encryption** (C19), so only the reader's devices can read their notes. This suits a trauma-informed translation, and N8's notes especially. The cost is a recovery key the reader must keep. It also shapes share links and anything server-side.
- **The likely server** is a Cloudflare Worker on its own subdomain (for example account.litbible.net) with D1, or Supabase. It stays outside `/api/`.

**Sign-in providers we compared** (BDR's view should decide):

| Option | For the apps | Notes |
|---|---|---|
| Better Auth on Cloudflare (Workers + D1) | No official Swift/Kotlin SDK; the apps call its HTTP endpoints | No new vendor, open source, runs in BVJ's Cloudflare account |
| Supabase | Official Swift and Kotlin SDKs for auth and data; native Google/Apple | Least app work. Passkeys were in beta in mid-2026, so check |
| Clerk, Auth0 and similar | Varies | Specialists own security; pricing and lock-in vary |
| Firebase | Mature SDKs | No built-in passkeys as of mid-2026, and Google holds the notes; we'd leave it out |

**Store and platform obligations we know of**, for you to confirm or extend:
- Apple guideline 4.8: Google sign-in on iOS requires an equivalent private option, which Sign in with Apple satisfies.
- Apple 5.1.1(v): account deletion inside the app, and **revoking Sign in with Apple tokens** on deletion.
- Google Play: in-app account deletion, **plus a web page** for deletion requests.
- Both stores: privacy labels and the Data safety form change once the apps hold an email address and notes.
- Passkeys shared across web and apps: add `webcredentials` to the site's `apple-app-site-association` and `get_login_creds` to `assetlinks.json` (the site publishes both today for app links), plus the apps' associated-domains and Credential Manager setup.
- **Account linking:** someone who signs in with Google on Android and Apple on iPhone gets two accounts unless they're linked, and Hide My Email addresses won't match. "Add another way to sign in" is needed from the first version.
- Transactional email for verification and resets, with the sending domain registered for Apple's private relay.

## What we're asking for

These are BDR's list from the plan, in the order we'd tackle them.

1. **Link the license terms from both apps.** The address is https://litbible.net/read#license-terms, from About or Settings, or wherever fits the apps. It should open in a browser, since the apps don't show /read. This waits on nothing else and can go in the next app update. (Since October 2 that address opens the collapsed terms on arrival, so the link lands on the terms themselves.)
2. **Agree the record format before any code** (C8, C22). Check the draft above against how each app stores notes and highlights today, and propose changes. Changing a format after people have notes in it is the expensive kind of change, so this comes first even if accounts come later.
3. **Who handles sign-in.** Recommend a provider from the table, or another one, based on the apps' needs.
4. **End-to-end encryption or not** (C19). BVJ leans end-to-end. Say what it costs the apps: key storage in the Keychain and Keystore, recovery, adding a new device, and what it rules out on the server.
5. **What happens to today's iCloud and Android backups** when a reader signs in, and when they sign out or delete the account.
6. **What syncs.** Notes, highlights, bookmarks and places, certainly. Sheets, Display settings and reading positions too?
7. **Who looks after the service.** It holds people's private notes, so someone has to apply security updates and respond to incidents.
8. **One key for the lock, the file and the account** (C6). BVJ said probably yes.
9. **The blur in the apps** (C7, N8). Until the apps honor N8's "hide this passage until I choose", the website keeps that setting on the computer and says so when a signed-in reader sets it. Would the apps implement it, and when?
10. **Keep unknown records and use the apps' color names** (C8), as described above. Can both apps do this, and what are the four color names?
11. **Website accounts first?** (M13) Accounts could launch for computers before the apps join, provided the record format is agreed first. BVJ said probably.
12. **A Mac app.** BDR is considering one. Say what it would change: Mac readers would get a home outside Safari's 7-day storage clearing, and sheets, print and present mode would stay on the website unless the Mac app takes them on.

## What we assumed about the apps (please correct)

- Highlights and notes are anchored somehow to verse text, and the apps have some approach, or none, for when the text changes after a content sync.
- The apps have exactly four highlight colors with internal names.
- The iOS app syncs notes through iCloud (CloudKit or iCloud key-value or document storage) and Android relies on Android Auto Backup, with no LIT server.
- The iOS app claims litbible.net chapter addresses (`/<book>-*`) and `/glossary` through `apple-app-site-association`. The Android app's claimed paths live in its manifest, which we haven't seen.
- The apps read raw chapter HTML from `/api/` and extract text without stripping ⟦ ⟧.
- Neither app has accounts, analytics identities or any server of its own today.

## What we'd like you to think through

Treat these as starting points.

- **Anchoring across a moving text.** How do the apps anchor notes today, and what happens to an existing app highlight when its verse is reworded? Is TextQuoteSelector plus a stored verse copy workable on mobile, and is the normalization rule above implementable identically in Swift and Kotlin? Should the rule live in one shared spec, with test vectors drawn from the corpus?
- **Migration.** Existing app notes have no permanent IDs, verse copies or tombstones. How do they become sync records without duplicates, if a reader signs in on two devices that both carry the same backed-up notes?
- **Sync mechanics on mobile.** Background sync limits on iOS and Android, offline edits, clock skew (last-write-wins needs trustworthy timestamps), batching, and conflicts the plan doesn't mention.
- **Interplay with the content sync.** The apps gate content updates on `version.json`. Should note records carry the content `version` they were made against, and should the apps show N3's "this verse changed" too? The release notes feed already carries `location` (book, chapter, verse) for deep links.
- **Encryption on devices.** Key derivation, storage, biometric unlock, what a lost phone means, and how a new device gets the key. How do passkeys, if any, interact with an E2EE key?
- **Store review risk.** Anything in Sign in with Apple, account deletion, privacy labels or Data safety that tends to cause rejections or delays.
- **Deep links for the desk.** Printed QR codes open a chapter in the app. Is the Android app's link handling claiming the right paths? Should the apps later claim sheet addresses, and would anything in the current link setup capture /read or account pages by mistake?
- **Accessibility parity.** Highlights announced in words, and a second cue besides color. Do the apps already do this?
- **Anything the apps do that the website should copy** (labels, gestures, the note mark), so readers who use both see one product.
- **Effort and order.** A rough size for the app work in each item, and which items block others.

## How to reply

Please produce one Markdown file for BVJ with these sections:

1. **Corrections.** Each assumption above that's wrong, with what the code actually does (file paths welcome).
2. **Answers to requests 1 to 12.** One short section each: a recommendation, the reason, and the app-side cost (S, M or L).
3. **Record format review.** The draft with your proposed changes, and the four color names.
4. **What we missed.** Risks, platform rules, edge cases and better ideas, most important first.
5. **Questions for BVJ.** Anything only the owner can decide.

Keep the website-side constraints in mind: no change to `/api/` or chapter JSON, no login by default, the notebook desktop-only on the web, and a strong preference for readers' privacy.
