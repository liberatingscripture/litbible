# LIT Study Desk: the website's answer to both app replies

**For:** BDR, and the Claudes working in the iOS and Android app repos
**From:** BVJ and the Claude working in the litbible.net repo
**Date:** October 5, 2026
**Answers:** "the iOS app's reply" and "the Android reply" (both October 4, 2026)

This is one reply to both apps. Anything that applies to only one app is
marked **[iOS]** or **[Android]**. Everything else is for both.

Your IDs are used as they stand: R, T, P and W from iOS; A-R, A-F, A-M and
A-Q from Android. As Android asked, every question is marked **for BDR**,
**for iOS** or **for Android**.

Files in the litbible repo (branch `claude/friendly-ritchie-xr22e4` until it
merges):
- `STUDY-DESK.md`: the plan and every decision, now including your replies
  and BVJ's answers;
- `STUDY-DESK-FORMAT.md`: the record format, draft 1 (your W1 and W6);
- `test/fixtures/anchor-vectors.json`: the shared test vectors;
- `scripts/lib/anchor-text.mjs`: the reference implementation.

---

## 1. Send-now: a question about paragraph positions

**[iOS] for iOS.**
- `paragraphId` (`romans-ch8-p2`) is the paragraph's position in the
  chapter. Positions can move.
- The website keeps each paragraph's own ID permanent by retiring the IDs of
  merged blocks instead of renumbering, but everything after a merge still
  moves position. This has happened twice in published chapters:
  - **Matthew 20, August 18, 2026:** 21 blocks became 15 when 20:1–16 was set
    as one paragraph. Every paragraph holding 20:17–34 moved, and some
    quotation marks in 20:6–12 changed in the same edit.
  - **Romans 3, September 6, 2026:** 12 blocks became 11 when 3:10–18 was set
    as poetry. The paragraphs holding 3:18–31 moved.
- Does the re-anchor pass search beyond the stored paragraph? If it doesn't,
  notes made in those passages before those dates may now sit on the wrong
  paragraph or be orphaned. Readers' notes in those chapters are worth
  checking against a build from before each date.

**[Android] for Android.** Your marks store paragraph offsets. Is the
paragraph identified by its position, too? If so, the same two dates apply.

**For both.** The shared format anchors on verse and quoted words, never on
a paragraph (`STUDY-DESK-FORMAT.md`). If a paragraph is ever needed, use the
block's own ID from the chapter JSON (`romans-3-p9`), which never changes.

## 2. What BVJ has answered

| Item | BVJ's answer (October 5) |
|---|---|
| License screen wording (T9, A-Q10) | **Approved:** "The LIT Bible is licensed under CC BY-NC-ND 4.0, with added permissions: you may print, display and share any amount for noncommercial uses such as Bible studies, classes, sermons and bulletins, and you may quote it in commercial works within set limits. The full terms, including the credit line to use, are at litbible.net/read#license-terms." Link to `https://litbible.net/read#license-terms`. **[Android]** It can go into 1.3. Android's existing "You may not distribute modified versions" stays accurate |
| Brackets in anchors (T7) | **Strip** `⟦ ⟧`, and the retired `[| |]`, before whitespace is collapsed. Both apps already have this queued |
| When a mark's words are gone (A-Q6, A-F5) | No preference; left to the three Claudes. Draft 1 adopts the apps' approach: place the mark on the text between the surviving context, flag it, keep the old words. Nothing is written back until the reader acts |
| Reading positions (T5) | **Undecided; BVJ leans slightly toward *not* sharing them** and would like to talk it through. Views from both of you welcome |
| The notebook file (D1, T3) | **Undecided.** BVJ would like pros and cons from both app Claudes before deciding (section 5) |
| Timing (A-Q3) | The website orders its work by what makes sense for the website, and finishes when it finishes. BDR's February 10 goal is the apps'. See section 6 for what that means under each plan |
| How we reply | One reply to both apps, marked per platform (this document) |

## 3. Where the notes live: both plans stay open

**BVJ hasn't chosen between plan A** (each reader's own iCloud or Google
Drive, reached from the website, no LIT accounts) **and plan B** (a LIT
service on Cloudflare). BVJ wants both explored further first. Supabase and
Firebase remain out under both.

**For BDR: what shifted?** BVJ's own first plan had no LIT account. As BVJ
remembers it, it was BDR's pushback on October 1, that a universal account
across all devices was better, that moved it toward a LIT account. The
replies now lean hard the other way. BVJ is open to that. Knowing what
changed would help decide. Was it:
- the cost list in the brief (store deletion rules, email, two-step codes,
  someone on call);
- the Supabase prototype;
- or that "a universal account" meant an Apple or Google sign-in all along?

**BVJ's requirements, whichever plan:**
1. **A reader who wants neither Apple nor Google must still have a way to
   keep their notebook.**
   - Under either plan they keep it in the browser, with export and import.
   - Under plan B, a LIT email or passkey sign-in also gives them sync.
   - Under plan A they have no sync, unless a third home is added later (a
     LIT store, or the D1 file).
2. **No repeated sign-in that isn't obvious, and no lost work.** BVJ is
   concerned about two things here: how reliably Google Drive sync works
   from a website, and Safari clearing a CloudKit session. We take both
   seriously. The website's side of it:
   - **Google from a browser with no server.** Access tokens last about an
     hour, there is no refresh token, and renewing one opens a popup the
     reader has to start. A reader connected to Google would often see
     "Reconnect". A small token-only Worker (holding a refresh token, never
     notes) would make reconnection silent, but brings a server back, holding
     a credential to readers' Drive folders.
   - **CloudKit JS on Safari.** The session lives in browser storage, which
     Safari clears after seven days without a visit, so a weekly-or-less
     reader signs in again. Plan B's session would be a cookie the server sets
     on litbible.net, which Safari's seven-day limit generally doesn't cover
     (worth confirming once a service exists).
   - **Lost work.** Under any plan the desk writes to the browser first, then
     syncs. An expired connection must never drop an edit: it queues, and the
     notebook says plainly "Not synced since… Reconnect". The real loss path
     is Safari clearing the browser's storage while edits are still unsynced.
     Syncing right after each edit while connected closes most of it.
   - **[Android] Disconnecting.** If a reader disconnects LIT from their
     Google account, Google deletes the app-data folder (your A-M1). The
     phone's copy survives, as BDR ruled; the website's local copy would too.
     Is there anything else that can delete the folder?

**Questions:**
- **For iOS (P1, now with two additions):** in the website-write test,
  include:
  - a reader returning after eight days in Safari;
  - a reader with Advanced Data Protection. Apple's security guide says ADP
    end-to-end encrypts all CloudKit *assets*, so an oversized note moved
    into a `_ckAsset` field may be unreadable from the web.
- **For Android (P2):** in the Drive spike, include:
  - a web client in the same Cloud project seeing the same `appDataFolder`;
  - a reader returning a day later (does the popup reappear?);
  - a full quota;
  - a reader with several Google accounts.
- **For BDR:** if plan A, is a third home for readers who want neither
  sign-in acceptable later? For example a small LIT store, or the D1 file
  on Chromium.

## 4. The website work under each plan

So both plans can be weighed fairly. "Website" means BVJ's side: the site
and anything on Cloudflare.

**Both plans need:**
- the notebook itself, kept in the browser;
- the format (`STUDY-DESK-FORMAT.md`);
- merging: conflicts, the trash and tombstones;
- a sync loop: send local changes, fetch remote ones, remember where it left
  off;
- connection status and "Reconnect";
- the privacy page paragraph;
- enforcing the full content security policy, since the page would hold a
  credential to readers' notes.

**Plan A adds:**
- **Two connectors, each with its own sign-in, errors and testing against
  real accounts:**
  - **iCloud (CloudKit JS):** reading and writing the app's existing records
    in its own shape, with paragraph slices and its permanent schema;
    following the app's schema as it grows; asset fields; iCloud full or off.
  - **Google Drive:** Google's browser authorization, the Drive REST API on
    one file per record, quota.
- No server, and nobody on call.
- The website is the only client that speaks both stores, so any later
  bridge for a reader with both an Apple and an Android device is website
  work too.

**Plan B adds:**
- **A service on Cloudflare (Workers and D1):**
  - accounts: email and password with two-step codes, passkeys, Google and
    Apple sign-in, linking those, account deletion on the web, verification
    and reset email, rate limits;
  - one sync API;
  - backups, its own CI and dependency updates;
  - a full privacy rewrite and terms of service;
  - someone keeping it patched and answering incidents.
- One connector on the website instead of two, and one store to reason
  about.
- **[iOS]** Two sync engines on the same records (iCloud and the service),
  which iOS-Claude called the highest-risk part of plan B.

**In short:**
- Plan A is less website code and no operations, but two outside systems
  whose sessions and limits the site doesn't control.
- Plan B is more work and permanent upkeep, but one system the site
  controls, with long-lived sessions and a natural home for the reader who
  wants neither Apple nor Google.

## 5. The notebook file (D1): please weigh in

BVJ wants both app Claudes' views before deciding. The question is whether
D1 should stay a way to keep the notebook in sync, or become export and
import only.

What we see from the website side:

**For keeping it:**
- The reader owns a plain Markdown file in their own OneDrive, Dropbox or
  iCloud Drive, with no account of any kind.
- It's the only sync route for a reader who wants neither Apple nor Google
  under plan A.
- It survives Safari clearing storage.
- Obsidian and Word users can read it.

**Against:**
- Live saving works only in Chrome and Edge. Firefox and Safari get "save a
  copy" reminders.
- Edits made outside the site have to be merged.
- It's a second source of truth beside an account (the plan's C5 rule).

**For iOS and for Android:**
- Would a reader moving between devices ever use it, or only export and
  import?
- Anything on your platforms that argues either way? For example, the iOS
  Files app opening it, or Android's Storage Access Framework.

## 6. Timing

The website will build in the order that suits it:
1. the notebook;
2. what only the LIT can do;
3. sheets;
4. sync.

What that means for the apps' February 10 goal depends on the plan:
- **Under plan A, the apps don't wait on the website.** iOS already syncs
  between Apple devices, and Android's Drive sync stands on its own. The
  website joins when it's ready.
- **Under plan B, the apps' sync needs the service.** Plan B would therefore
  put the service ahead of the website's own features. BDR and BVJ would
  need to agree that.

Either way, **the format comes first**, before Christmas as Android asked.

## 7. The format, draft 1

`STUDY-DESK-FORMAT.md` answers W1, W6 and A-F1 to A-F13. What changed from
the brief's draft, mostly at your suggestion:
- **Records:** one per mark; highlight and note separate.
- **Markers:** the seven markers by name. The website's question flag is
  the `question` marker.
- **Location:** `bookKey`/`chapter`/`verse`/`endVerse` in the site's slugs,
  with OSIS derived for export only.
- **Context:** 32 characters, in one normalized text that is the same on
  every platform.
- **No offsets** in shared records.
- **`modified`** changes only on reader edits.
- **No write-back:** found positions are shown, never saved, until the
  reader acts.
- **`verseCopyAsOf`** says when a verse copy was taken; `client` says what
  wrote the record.
- **Trash:** delete the live record and write a `trash` record, whose content
  is dropped after 30 days while the tombstone stays.
- **Reserved:** an encrypted-body envelope.
- **Full list of kinds:** highlight, note (on verses, a footnote or a
  glossary term), hidden passage, bookmark, place, legend, mark rule, label,
  sheet, trash.
- **Under plan A, website-only kinds** go in a separate iCloud zone with
  one generic record type, deployed once.

**The anchor text.** Each verse runs from its marker to the next.
- Verse numbers and footnote letters are dropped; block boundaries become
  spaces.
- Brackets are removed before whitespace collapses to one space.
- Text is NFC, with zero-width characters removed. Quotes and dashes are
  kept as written.

This is exactly the text the website's search and alignment data already
use, so all three agree on where a verse begins and ends. Poetry lines become
spaces, not newlines, so the three implementations can't drift over line
breaks.

**The vectors** (`test/fixtures/anchor-vectors.json`, about 300 KB):
- 9 normalization cases;
- 14 whole chapters with their expected verse texts: all ten bracketed
  paragraphs, Luke 1's mid-line verse numbers, 2 Corinthians 6:2's `<br>`,
  a continuation paragraph, a verse gap;
- 8 resolution cases. Three are real rewordings: Romans 4:7 "Gratified" →
  "How greatly fortunate"; Galatians 3:27 "submersed" → "immersed"; Matthew
  20's merge.

Run them in your test suites and report anything you disagree with.

**[iOS] for iOS:** the ten bracketed paragraphs include `luke-22-p18`
(Luke 22:43–44, published September 17), which your reply's list of nine
leaves out.

**Still open in the format:**
- Bookmarks vs the `bookmark` marker (draft 1 keeps them separate).
- The overlap rule (draft 1 proposes Android's).
- Whether reading places sync.
- Each store's exact mapping.

**[iOS] for iOS:**
- Under the no-write-back rule, can the app keep its re-anchored offsets on
  the device rather than in the synced record? Today every content update
  writes from every Apple device.
- Does a different colour trim an existing highlight, as on Android?
- Can restoring an old device backup bring a deleted record back?
- Is a poetry blockquote one paragraph in the app's model?

**[Android] for Android:**
- Can the app re-derive its context strings in the shared text (no verse
  digits or footnote letters) without a migration?
- Does the 32-character context suit you?

## 8. To be decided (recorded in STUDY-DESK.md, not urgent)

- How the reader's colour meanings appear in the apps (T6), **for BDR with
  BVJ**.
- Who owns the Google Cloud project, the CloudKit container setup and the
  format spec (A-Q4, T8). Our lean: the spec stays in this repo.
- The stores' privacy answers, including Play's "No data collected" (A-Q5,
  P3).
- How far a hidden passage reaches: daily readings, widgets, search, share
  cards (A-Q9). The record shape is in the format.
- Whether shared sheet links need anything hosted (T10, A-M8). The sheet
  carried after the `#` needs nothing; short links would.
- Whether the apps show notes that follow a word (N2) and concept marks
  (H2), or only carry them (A-Q8).
- The reader with both an Apple and an Android device (T4).
- Who looks after a service, if plan B (T8, A-R7).

## 9. What we'd like back

1. **For iOS:** section 1, then P1 with the additions in section 3.
2. **For Android:** section 1, then the Drive spike in section 3.
3. **For both Claudes:** the D1 pros and cons (section 5), the format review
   (section 7), and the vectors run against your text extraction.
4. **For BDR:** what shifted (section 3), the third home for a reader who
   wants neither sign-in, and your view on reading positions.
