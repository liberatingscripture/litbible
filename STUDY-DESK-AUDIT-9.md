# Study Desk Audit 9

Audited 2026-11-25 and 26, first at commit `3ef75d8e` and then at `37a7498e` (both `origin/main`,
read from the `claude/desk-audit-9-784320` worktree). The window is every pull request merged into
`main` after 1:00 pm Pacific on 2026-11-23 (after `fbcd83c0`): 33 of them, #680 to #712, which build
plan C's accounts and sync:

- the end-to-end encryption spec, its reference, and its test vectors (#680, #684 to #687, #691);
- the notebook service, a Cloudflare Worker with D1: its first code, its deploy workflow, sign-in, the
  account work and the check after it, and Turnstile (#688, #692, #695 to #697, #704, #712);
- the website's sync connector (#698), the freeze work (#694), and notes from the Greek (#693);
- the account pages and their ways in (#700, #703, #707, #708, #710, #711);
- somewhere for the content security policy's reports to go (#702);
- the records of BVJ's calls and iOS's answers, and the Claude docs (#681 to #683, #685, #699, #701,
  #709);
- four dependency bumps (#689, #690, #705, #706).

At BVJ's request the audit then took in **#713** (step 4j: the privacy policy, the Terms of Use, and
the words accounts need; merged as `37a7498e`) and **#714** (step 4j's last two choices approved;
audited open at `5b1ddf2f`, then merged as `549d75ac` with the same tree while this report was being
written). The worktree was moved forward to `37a7498e` for that, and every check was run again there.

BVJ's brief: examine "security, efficiency/speed/responsiveness, A11y, SEO, UI optimization,
performance, reliability, legality, ease of use, and anything else you can think of," **"and seamless
coherence across all the PRs for implementing this new system."** While it ran: "Add PR 713 and 714 to
the audit." The full brief the auditors worked from is Appendix R, and its addendum for #713 is
Appendix S.

Nothing in the code was changed. Every finding and every fix here is Claude's recommendation; nothing is
BVJ's decision unless it says so. IDs carry a 9 (`SEC9-1`, and `LP9b-1` for the second pass's); the
orchestrator's own are `ORC-a` to `ORC-h`. The full reports are the appendices, with their heading
levels shifted down one. Severities in this summary are the ones after verification (Appendices P and
Q), and each finding's state on `37a7498e` (Open, Fixed by #713, or Partly fixed by #713) is in
"Findings by area."

## Bottom line

**No Critical finding. One High at `3ef75d8e`, and #713 fixed it:** `/privacy` told readers the apps
keep everything on the device and the team can't reach it, and said nothing of the service that now
holds an account's data (LP9-1). At `37a7498e` no High remains.

After verification, **9 Medium**, 55 Low, and 30 Nit findings stand across both passes; with what #713 fixed taken out, 7 Medium, 50 Low, and 30 Nit are open on `37a7498e`.

The system holds together where it was designed together. The website, the service, the reference,
and the vectors agree member for member: every one of the 32 routes the website sends is routed and in
the spec, every refusal word the service can send is in the spec with one status, and the crypto sizes
and the approval code agree across the reference, the service, and the vectors (COH9). All 37 routes were walked for session kind and
ownership, and no object is reachable across accounts; 66 malformed or hostile WebAuthn and CBOR inputs
were refused (SEC9). 4,000 fuzzed multi-device histories in ten clock setups all converged, with no
record lost outright (SY9b). The account flows ran end to end in Chrome, six virtual devices against
the service's own code (LV9), and the header's new entry neither overlaps nor clips at 59 widths. All
5,105 site tests and 2,496 Worker tests pass, 260 chapters validate, `astro check` is clean, and
58,293 internal links resolve. The gate held: no account or sync code reaches a reader's page, and #713
added nothing to the desk's first stage (CP9, UX9b).

What is left:

1. **Nothing bounds what the service stores** (SV9-1, Medium, live on the preview). An account costs
   nothing to make from a script, since a request without an `Origin` header skips Turnstile by design,
   and the service's own code accepted 20 of 20 junk pushes, 10,000 rows and 75 MB, in a local run of
   that chain with Turnstile configured. No notebook is read or lost, but the preview can be filled,
   and if the account is on Workers Free, so can the whole account's day of D1 writes, which the
   content security policy's week of counts shares (DOC9-2). The runbook has no way to switch the
   service off or to find and remove one abusive account (SV9-4), and one address can fill the CSP
   Worker's daily cap in about two minutes (SV9-12). Which plan the account is on is recorded nowhere.
2. **Two trust seams.** A link carrying an approval code, opened on the computer that holds the
   notebook, fills in "Add a device" and presses Continue by itself, and the question it lands on
   leaves out the spec's "approve only a device you are holding," so one keypress can hand a stolen
   sign-in the whole keyring (SEC9-1). The deploy job installs about 200 packages and runs the tests in
   the same job that then holds a Cloudflare token reaching every Worker and D1 database on the account,
   production's included once it exists (SEC9-2).
3. **A joint between the layers.** "Sign out" fails, every time, on a computer that was removed and
   signed in again or whose notebook was replaced: the session belongs to no device, the page sends the
   request the service must refuse, and the spec steers an app to the same request (COH9-1). The fake
   service the website's tests run against drifts from the real one in four ways (SY9-2), and iOS's 22
   points from #701 have no line each saying taken, not taken, or BDR's, with the format freezing on
   December 24 (DOC9-1).
4. **The words now promise slightly more than the code shows.** #713 fixed the High and most of what
   step 4j was meant to cover (five earlier findings fixed, five more in part). But two of its new
   sentences are live on `litbible.net/privacy` today and not yet true or not yet checked: "nothing
   tracks you across sites," beside the podcast page's YouTube, Spotify, and Apple players and Give
   Lively's box on `/support` (LP9b-1), and "no record of where you connect from," while what
   Cloudflare's Workers Logs stores beside each of the service's lines has never been looked at
   (LP9b-4). Neither store's privacy form can yet be answered from the page (LP9-6, BDR).
5. **One accessibility fault with reach.** The "Are you sure" box for deleting the account, removing a
   device, and signing out is an unnamed group, and focus lands on the destructive button, so a screen
   reader hears only "Delete my account" (AC9-1). Contrast, forced colors, reduced motion, dark mode,
   and 320 px all passed on the account pages (LV9).
6. **The tests guard less than they look in the newest wiring.** Deliberate faults found where the tests are
   thin, though the code is right in every case. The service's suite caught all 104 faults TQ9
   planted (20 only through other files, TQ9-4). The website's crypto, passkey, and account code let 16
   of 68 through: no test would notice the device-card and holder-record seals reusing one nonce, the
   gap with the highest stakes in the audit, since a regression would let the service forge a device
   card and be sealed the next key without anyone seeing (TQ9-1); and two checks against a hostile
   service can be removed unnoticed, though one of them can't change anything today (TQ9-2). 11 of 51
   faults in the sync rules and engine survive (SY9b-1), and so does #713's "linked" wiring (UX9b-1).
   Each is Low after verification; the nonce tests should still come first, before accounts open.

### Counts

| | Critical | High | Medium | Low | Nit |
|---|---|---|---|---|---|
| The window, #680 to #712 (96 findings), as reported | 0 | 2 | 30 | 51 | 13 |
| The window, after verification | **0** | **1** | **7** | **45** | **24** |
| #713 and #714 (18 findings), as reported | 0 | 0 | 5 | 8 | 5 |
| #713 and #714, after verification | **0** | **0** | **2** | **10** | **6** |
| All, after verification | **0** | **1** | **9** | **55** | **30** |
| All, open on `37a7498e` (what #713 fixed taken out; a partly fixed finding counted by what remains, unless a new finding carries it) | **0** | **0** | **7** | **50** | **30** |

Two verifiers tried first to prove each finding wrong, then gave it a final severity. VER9 (Opus)
took security, the service, sync, cost, coherence, and tests, in four passes (the window, #713's policy,
#713's desk code, and TQ9): 61 items, 31 confirmed, 24 lowered, 7 folded, and no false positive in
full. It re-ran the chain behind SV9-1, COH9-1's two reproductions, SY9-1's lost scan, and four of
TQ9's surviving faults on a copy of `549d75ac`. VER9b (Sonnet) took accessibility, use, legal, docs,
and copy: 53 items, 25 confirmed, 15 lowered, 9 folded, 2 false positives (CP9-2, CP9-3), and 2
deliberate (LV9-9, CP9-5). Neither raised a finding. Where they disagreed, on DOC9-1 (VER9b Medium,
VER9 Low), this report takes VER9's reframed Low, which read the timing more closely: #701 merged eight
hours before the audit commit, during planned work. Where LP9b and UX9b disagreed on AC9-3, VER9's
reading (open) is taken. Most lowerings follow two rules: a fault that sits on the preview, which only
BVJ uses, or in production, which isn't deployed, belongs on the list for before accounts open rather
than in Medium; and a missing test is Low when the code it would guard is right today. Claims inside
standing findings that don't hold are in Appendix O.

## Proposed order of fixes

All of this is Claude's recommendation. "Who decides" names whose call it is; the numbered decisions are
in "Decisions needed from BVJ and BDR."

### Tier 1: next (small; each needs at most BVJ's yes on the words or the approach)

| ID | What | Who decides |
|---|---|---|
| LP9b-1 | `/privacy`: "We don't track you across sites," and one sentence naming the podcast page's players and Give Lively's box, which may set cookies under their own policies (VER9's wording) | BVJ approves the words (decision 3) |
| LP9b-4 | One look at a stored Workers Logs event for the preview; then turn stored logs off or change the two sentences | BVJ (decision 4) |
| SEC9-1 | Put "approve only a device you are holding, showing this code now" in the question, and stop pressing Continue for the reader; focus the question, not "Add device" | BVJ for the words and whether a link acts at all (decision 5) |
| COH9-1 | Sign out falls back to `DELETE /session` on `own_device`; fix the spec's two paragraphs and add an entry to the apps file | BVJ, BDR confirms (decision 6) |
| AC9-1 | Name the box by its question (`aria-labelledby`), describe the button by it, focus the question or Cancel, and let Escape cancel | none |
| SEC9-2 | Split each deploy workflow: test in a job with no environment, deploy in one that installs with `npm ci --ignore-scripts` and runs only wrangler; pin actions by SHA | BVJ (decision 7, which explains it) |
| SY9-1 | Put the touched ids back when a notebook read throws | none |
| SY9-2 | Bring the fake service's order of checks, `too_large`'s `what`, its token, and `rev` on a replace into line with the service | none |
| TQ9-1, TQ9-2, SY9b-1, UX9b-1 | Tests for the guards no test holds, the nonce tests first: two seals with no nonce differ, for all six sealing defaults; a vector for "a card naming another signing key"; the sync engine's stale hold, newer key in a pull, and catch-up bound; and #713's "linked" wiring | BVJ, BDR told when the vector lands (decision 15) |

### Tier 2: after a decision, and before accounts open to anyone else

| ID | What | Who decides |
|---|---|---|
| SV9-1, DOC9-2 | A per-account ceiling (rows and bytes) and a tighter `POST /rows` limit, a sweep of accounts that never finished, and the plan recorded | BVJ, then BDR for the new refusal (decisions 1 and 2) |
| SV9-4, SV9-5 | The runbook: how to stop the service, how to find and remove one account, and the cost of a large delete | BVJ (decision 8) |
| SV9-12 | Spread the CSP Worker's daily cap over the day (hourly allowances), so one sender can't blank a day | BVJ, during the week's count |
| SEC9-4 | Enforce the policy, without `'unsafe-inline'` in `script-src`, before accounts open (step 4i) | BVJ |
| LP9-6, LP9b-3 | Both stores' privacy forms declare the service's plain fields; `/privacy`'s list adds a waiting approval's model and platform | BDR (decision 9) |
| DOC9-1 | A triage line for each of iOS's 22 points and three key-storage points, before December 24 | BVJ's side, BDR on key storage (decision 10) |
| DOC9-3 | One "Before accounts open" list: Turnstile in production, the store forms, What's New, the CSP, this audit's gates | BVJ |
| LP9b-2, LP9b-5 to LP9b-9, LP9-9 | The rest of `/privacy`'s words: Apple's token, Turnstile and the apps, the two spec sentences on deletion, the "what changed" line, the 30 days, the Terms' license scope, and what a lawyer should look at | BVJ (decisions 11 and 12) |
| SV9-2, SV9-3 | Production's environment: BDR as a second reviewer or a reviewer-free rollback; a rollback the next push can't cancel | BVJ, when the environment is made |
| AC9-3, UX9b-2, UX9b-4, CP9-1 | The sign-out sentence and the recovery code; the reminder for a synced reader; a way to an account from the Notebook panel; one name for the local place | BVJ (decision 13) |
| SY9b-3 | The format's warning about clocks names revived deletions and buried restores too | BVJ and BDR |
| SEC9-6 | `permissions: contents: read` in `ci.yml`, or the repository's default token to read | BVJ |

### Tier 3: polish and nits

Everything else in "Findings by area": the remaining account-page Lows (AC9-2, AC9-4 to AC9-6, LV9-4),
the sync Lows (SY9b-2, SY9b-4), the service's indexes and migration checks (SV9-8, SV9-9, SV9-11), the
stale docs (DOC9-4 to DOC9-8, DOC9-10 to DOC9-12, ORC-b, ORC-g), the remaining test Lows (TQ9-3, TQ9-6, TQ9-7), UX9b-3, and every Nit.

## Findings by area

Each table lists every finding in its area once, with its severity after verification and its state on
`37a7498e`. A folded finding names the one that carries it. Tags: **gate** (not a fault today; must be
true before accounts open), **live** (in force on `litbible.net` or the preview today), **4j** (step
4j was expected to cover it), **BDR** (needs the apps' side), **KNOWN** (recorded before this audit). As
a fix ships, mark it in the State column here, as the desk file's "The records" asks.

### Security and the trust boundaries

| ID | Severity | As reported | State | Tag | What |
|---|---|---|---|---|---|
| SEC9-1 | **Medium** | Medium | Open (its point 4, focus on the question, done in #716) |  | A link carrying an approval code, opened on a computer that holds the notebook, fills in “Add a device” and presses Continue by itself, and the question it lands on lacks the spec’s “approve only a device you are holding,” so one keypress can hand a stolen sign-in the whole keyring |
| SEC9-2 | **Medium** | Medium | Open |  | The preview’s deploy job runs `npm ci` (install scripts on) and `npm test` in the same job and workspace as the steps that hold a Cloudflare token reaching every Worker and D1 database on the account, production’s included once it exists |
| SEC9-3 | (in SV9-1) | Medium | Open |  | No per-account storage limit (the same fault as SV9-1) |
| SEC9-4 | **Low** | Low | Open | gate | The policy step 4i plans to enforce keeps `'unsafe-inline'` in `script-src`; enforce it without that before accounts open, as the plan already says the full policy comes before sign-in |
| SEC9-5 | (in SV9-12) | Low | Open |  | Anyone can post CSP reports; a forged origin can top the week’s list |
| SEC9-6 | **Low** | Low | Open |  | `ci.yml` sets no `permissions`, and the repository’s default workflow token is write |
| SEC9-7 | **Nit** | Nit | Open |  | Five small, harmless departures from WebAuthn Level 3 (a missing user handle, `fmt` not matched by name, non-minimal encodings) |
| SEC9-8 | **Nit** | Nit | Open |  | The preview’s `POST /preview/passkeys` skips the lists’ version and the room check |
| ORC-c | (in SEC9-4) | Low | Open |  | Sign-in is live on the preview while the policy is report-only |
| ORC-d | (in CP9-5) | Low |  |  | `?account=preview` is a link anyone can send |

### The notebook service: data, operations, and cost

| ID | Severity | As reported | State | Tag | What |
|---|---|---|---|---|---|
| SV9-1 | **Medium** | High | Open | live | Nothing limits what one account, or the service, stores, and an account costs nothing to make (no `Origin` skips Turnstile, by design); reproduced locally: 20 of 20 junk pushes, 75 MB, no siteverify call. It can stop the preview and, on Workers Free, the account’s day of D1 writes |
| SV9-2 | **Low** | Medium | Open | gate | Production’s rollback job runs in the environment BVJ is to review, so BDR could not roll production back alone; set up the environment with that in mind |
| SV9-3 | **Low** | Medium | Open |  | A queued rollback of the preview can be canceled by a later push (one concurrency group, one pending run) |
| SV9-4 | **Low** | Medium | Open | gate | No way to switch the service off, or to find and remove one abusive account, in the runbook |
| SV9-5 | **Low** | Medium | Open | gate | An account large enough that its delete or replace passes D1’s 30 seconds fails every hour (the runbook’s manual route covers it) |
| SV9-6 | (in LP9b-4) | Medium | Fixed (#717) |  | Workers Logs is on for the service and off for the CSP Worker |
| SV9-7 | **Low** | Medium | Open | KNOWN | The hourly run’s query budget on Free, and a held request retried ahead of newer ones |
| SV9-8 | **Low** | Low | Open |  | A token added between Apple’s revocation and the account’s deletion is deleted unrevoked (Apple is off) |
| SV9-9 | **Low** | Low | Open |  | Three queries can’t use their index, and `challenges.account` has none |
| SV9-10 | **Low** | Low | Open |  | The runbook’s Turnstile rows are stale, and it doesn’t say whether a rollback restores an older secret |
| SV9-11 | **Low** | Low | Open |  | Nothing holds applied migrations unedited or shows one is atomic; a few write paths have no race test |
| SV9-12 | **Low** | Medium | Open |  | One address can fill the CSP Worker’s daily cap (5,000) in about two minutes, blanking a day of the week’s count, and a forged origin can top the list 4i works from |

### The website’s sync

| ID | Severity | As reported | State | Tag | What |
|---|---|---|---|---|---|
| SY9-1 | **Low** | Medium | Fixed (#716) |  | One failed notebook read in the engine’s scan drops the touched ids, so an edit waits, with the status saying “up to date,” until the next page load’s full scan |
| SY9-2 | **Low** | Low | Fixed (#716) |  | The fake service the website’s tests use differs from the real one: the order of its checks, `what: "body"`, a token the real service would refuse, `rev` on replace |
| SY9b-2 | **Low** | Low | Open |  | “Stop syncing” and sign-out don’t stop a pass already running: it can still merge, write sync state, and push |
| SY9b-3 | **Low** | Low | Open | BDR | With clocks an hour or a day apart, about a quarter of fuzzed histories revive a deletion or bury a restore; the format’s warning names only lost edits |
| SY9b-4 | **Low** | Low | Open |  | A refusal the engine doesn’t know is retried for ever behind one quiet line, with no notice |
| SY9b-5 | **Nit** | Low | Open |  | A visible tab’s 60 s poll cuts the backoff short (the `slow_down` half can’t happen today) |

### The account pages: use and accessibility

| ID | Severity | As reported | State | Tag | What |
|---|---|---|---|---|---|
| AC9-1 | **Medium** | Medium | Fixed (#716) |  | The “Are you sure” box (delete the account, remove a device, sign out) is an unnamed group, focus lands on the destructive button, and its question isn’t tied to it, so a screen reader hears only the button |
| AC9-2 | **Low** | Medium | Open |  | After Rename the home is redrawn with nothing said; other actions say their result next in reading order (rule 18) |
| AC9-3 | **Low** | Medium | Open | 4j | Signing out of a one-device notebook means the recovery code to get back, and the sign-out sentence (`signOutLinked`) doesn’t say so; #713 added context elsewhere (“Your passkey only signs you in,” the help page), not this sentence |
| AC9-4 | **Low** | Low | Open |  | The reason “Follows my account” is unavailable isn’t tied to the disabled radio |
| AC9-5 | **Low** | Low | Open |  | Two passkeys give two buttons named “Remove Passkey” |
| AC9-6 | **Low** | Low | Open |  | The printed recovery code is set in a serif (print.css wins over the monospace) |
| AC9-7 | **Nit** | Low | Open | 4j | The code’s groups aren’t numbered where shown, and the check asks for “Group 4” |
| AC9-8 | **Nit** | Low | Open |  | Internal words (“the preview’s sign-in,” “entries”) reach the page |
| AC9-9 | **Nit** | Low | Open |  | The copy test sweeps the sync words for dashes and quotes, not for punctuation inside quotes or British spelling |
| AC9-10 | **Nit** | Nit | Open |  | The status dot vanishes on hover of the header’s account button (not under Site 2.0) |
| AC9-11 | **Nit** | Nit | Open |  | The stop sentence shows twice on the account home |
| LV9-1 | (in AC9-1) | Medium | Fixed (#716) |  | Confirmed live |
| LV9-2 | (in AC9-2) | Medium | Open |  | Confirmed live |
| LV9-3 | (in AC9-3) | Medium | Open |  | Confirmed live |
| LV9-4 | **Low** | Low | Open |  | Showing a code for the new device removes the pressed button, and nothing moves focus to the code or says it |
| LV9-5 | (in AC9-5) | Low | Open |  | Same-named Remove buttons |
| LV9-6 | **Nit** | Low | Open |  | A removed device first reads “sign in again” before it learns it was removed (true for what it knows then) |
| LV9-7 | (in AC9-11) | Low | Open |  | The stop sentence repeated |
| LV9-8 | **Low** | Low | Fixed | 4j | /notebook/ said “It never leaves this computer” in a synced browser |
| LV9-9 | *Deliberate* | Low |  |  | A rename doesn’t survive sign out and in (signing out leaves the device list) |
| LV9-10 | **Nit** | Low | Open |  | Ordinary refusals are logged with `console.error` |
| LV9-11 | (in AC9-4) | Nit | Open |  | The disabled radio’s hint |
| LV9-12 | **Nit** | Nit | Open |  | The “Account” tooltip shows over its own open menu |
| LV9-13 | **Nit** | Nit | Open |  | About 37 px of extra space above the home page’s first rule |

### Privacy, the law, and the stores

| ID | Severity | As reported | State | Tag | What |
|---|---|---|---|---|---|
| LP9-1 | **High** | High | Fixed | 4j | /privacy said the apps keep everything on the device and the team can’t access it, with nothing about the service |
| LP9-2 | **Low** | Medium | Fixed | 4j | The effective date hadn’t moved through five changes (the promised “what changed” line is LP9b-7) |
| LP9-3 | **Medium** | Medium | Partly fixed (#713, #717) | 4j | Turnstile on the new-account step wasn’t disclosed (now named; what remains is LP9b-5) |
| LP9-4 | **Low** | Medium | Fixed | 4j | No retention was stated (now “until you delete them or the account”; sweeping idle accounts is BVJ’s call) |
| LP9-5 | **Low** | Medium | Fixed (#713, #717) | 4j | D1’s 30 days of history was on /delete-account/ only (now on /privacy; two spec sentences remain, LP9b-6) |
| LP9-6 | **Medium** | Medium | Partly fixed | BDR | Neither store’s form can be answered “no data collected”; the plain fields are now on /privacy, the forms are BDR’s (ask 21), and LP9b-3’s fields are still missing |
| LP9-7 | (in LP9b-4) | Medium | Fixed (#717) |  | Stored logs on |
| LP9-8 | **Low** | Low | Fixed | 4j | No minimum age (now 13, or the country’s higher age) |
| LP9-9 | **Low** | Low | Decided: for a lawyer (BVJ) | 4j | No controller, lawful basis, rights, or processors (the Collective, the processors, and the rights are now named; lawful basis, transfers, and a complaint route are not) |
| LP9-10 | **Nit** | Low | Open |  | Nothing ties Google on to Apple on (Apple 4.8); recorded, only a config guard is missing |
| LP9b-1 | **Medium** | Medium | Fixed (#717) | live | /privacy (new in #713) says “nothing tracks you across sites” and that Do Not Track has nothing to turn off, while the podcast page frames YouTube, Spotify, and Apple players and /support loads Give Lively on every visit |
| LP9b-2 | **Low** | Medium | Fixed (#717) | gate | /privacy says Apple’s token is “encrypted in our database”; it is readable to the service (encrypted only at rest) |
| LP9b-3 | **Low** | Medium | Fixed (#717) | gate | The “what the service keeps” list leaves out a waiting approval’s device model and platform, plain for up to ten minutes |
| LP9b-4 | **Medium** | Medium | Fixed (#717) | live | /privacy now tells readers the service keeps “no record of where you connect from” and its log says “nothing about who asked,” but what Cloudflare’s Workers Logs stores beside a line has never been looked at, and the preview has stored logs on |
| LP9b-5 | **Low** | Low | Partly fixed (#717) | gate | The page says making an account is Turnstile-protected; production sets no key yet, and an app’s request (no `Origin`) is never checked |
| LP9b-6 | **Low** | Low | Fixed (#717) |  | Two spec sentences still say a deleted account leaves nothing, against the spec’s own 30 days of history |
| LP9b-7 | **Low** | Low | Fixed (#717) |  | /privacy promises a “what changed” line for 30 days and a note in the apps’ What’s New; #713 added neither |
| LP9b-8 | **Low** | Low | Fixed (#717) |  | “After 30 days only a locked note” depends on a client opening the notebook; the service never drops the copy itself |
| LP9b-9 | **Low** | Low | Fixed (#717) |  | The Terms put the intros, glossary, and articles under a license page written for the text and footnotes |
| LP9b-10 | **Nit** | Nit | Fixed (#717) |  | “Still locked” is true of the notebook in backup history, not of its plain fields |

### Coherence of the interfaces

| ID | Severity | As reported | State | Tag | What |
|---|---|---|---|---|---|
| COH9-1 | **Medium** | Medium | Open | BDR | “Sign out” fails (`not_allowed`, `own_device`) on a computer that was removed and signed in again, or whose notebook was replaced, because the session has no device; `DELETE /session` would work, and the spec steers an app to the request that fails |
| COH9-2 | **Nit** | Low | Open |  | The `POST /holders` row names no refusal word for a passkey that already holds the key |
| COH9-3 | (in SY9-2) | Nit | Open (the fake's half fixed in #716; the spec's order and `what` remain) |  | Size before padding, and `too_large`’s `what` |

### The records: docs and decisions

| ID | Severity | As reported | State | Tag | What |
|---|---|---|---|---|---|
| DOC9-1 | **Low** | Medium | Open | BDR | iOS’s 22 points and three key-storage points (#701) have no line each saying taken, not taken, or BDR’s; a triage before the December 24 freeze (COH9’s table has each point’s state in code) |
| DOC9-2 | **Low** | Medium | Fixed (#717) |  | The spec and the service README say Free gives “a database” 100,000 rows written a day; Cloudflare says the allowance is the account’s |
| DOC9-3 | **Low** | Medium | Partly fixed |  | No single list of what must be true before accounts open (#713 extended rule 11; Turnstile in production, the store forms, What’s New, and the CSP are still elsewhere) |
| DOC9-4 | **Low** | Low | Open |  | Turnstile’s “off” wording survives in five places |
| DOC9-5 | **Low** | Low | Open |  | Four places still say the deletion page can’t delete |
| DOC9-6 | **Low** | Low | Open |  | The account file says /delete-account/ is in the sitemap; the config takes it out |
| DOC9-7 | **Nit** | Low | Open |  | The spec’s “a minute before `due` or twenty minutes after” reads like a window; it illustrates “until it is carried out” |
| DOC9-8 | **Low** | Low | Open |  | The spec’s front matter and “Order of work” stop at 4g |
| DOC9-9 | (in CP9-1) | Low | Open |  | One thing, several names |
| DOC9-10 | **Nit** | Low | Open |  | A root rule stated without the account gate’s exception |
| DOC9-11 | **Low** | Low | Open |  | Smaller stale sentences (sync rule 2 and a static import, STUDY-DESK.md’s size, ask 4) |
| DOC9-12 | **Nit** | Nit | Open |  | The spec reads item 51 as decided where it isn’t |
| ORC-a | (in DOC9-6) | Low | Open |  | The sitemap row |
| ORC-b | **Nit** | Nit | Open |  | `public/_headers` says no reader can be linked “until the account pages exist” |
| ORC-g | **Low** | Low | Open |  | `src/scripts/desk/CLAUDE.md` is 110,522 bytes at `37a7498e`, 4,166 under its cap (4,848 at `3ef75d8e`), against the 8 KB of room it asks to keep; this audit’s row takes 192 more, leaving 3,974 |

### Copy, search, and what ships to every reader

| ID | Severity | As reported | State | Tag | What |
|---|---|---|---|---|---|
| CP9-1 | **Low** | Low | Open | 4j? | The notebook’s place is “this computer,” “this browser,” and “this device”; #713 added more of each |
| CP9-2 | *False positive* | Nit |  |  | Straight apostrophes in developer strings no reader sees |
| CP9-3 | *False positive* | Nit |  |  | The app popover’s list has its Oxford comma (“notes and highlights” is one item) |
| CP9-4 | **Nit** | Low | Open |  | Every page carries about 8 KB of HTML comments (3 KB compressed), most from before the window; the repo is public, so nothing leaks |
| CP9-5 | *Deliberate (carries ORC-d)* | Low |  |  | `?account=preview` opens accounts from any page (BVJ’s switch, E230; KNOWN, the account file’s rule 11) |

### Performance

| ID | Severity | As reported | State | Tag | What |
|---|---|---|---|---|---|
| ORC-e | **Nit** | Low | Open |  | /account/ with the desk on loads the notebook and sync code before anything is asked (136.6 KB compressed against 50.6 KB) |
| ORC-f | **Nit** | Low | Open |  | /account/ shifts 0.074 as its first screen is drawn (inside “good”) |

### Tests

| ID | Severity | As reported | State | Tag | What |
|---|---|---|---|---|---|
| UX9b-1 | **Low** | Medium | Fixed (#716) | gate | Nothing tests #713’s “linked” wiring into the tour, the notebook page (the LV9-8 fix), the shell, and the panel’s nudge; five of seven planted faults there survived. The code is right today |
| TQ9-1 | **Low** | Medium | Fixed (#716) | gate | No test would notice if `sealDeviceCard` or `sealHolderRecord` used one nonce every time, though every production call relies on the default (the same fault in `sealRecord` is caught). The code is right; the stakes are the highest of any test gap here, since a regression would let the service forge a device card and be sealed the next key |
| TQ9-2 | **Low** | Medium | Open |  | Two guards against a hostile service have no test that fails without them: the signing-key check in `acceptGrant`, and “every key we hold must be in the incoming keyring” in `checkKeyring`. The second can’t change anything for a keyring the service sends (`parseKeyring` refuses it first), and `sign` is used for nothing in version 1 |
| TQ9-3 | **Low** | Low | Open |  | Eight smaller website faults survive: the page’s PRF input losing to the service’s extensions, an empty user handle, PRF output sharing the platform’s buffer, extractable imported keys, a multi-key approval proof, and two re-checks |
| TQ9-4 | **Nit** | Low | Open |  | The service’s full suite caught all 104 planted faults, but 20 only through other files: the unit file named for the code doesn’t hold UP, the five wrong proofs, the three approvals, and others; CI runs the full suite |
| TQ9-5 | **Nit** | Low | Open |  | The root suite’s D1 stand-in (`node:sqlite`) binds a missing value as NULL and takes over 100 binds, where workerd’s D1 throws on both; the service’s largest statement binds 14, and its own suite runs on workerd in CI |
| TQ9-6 | **Low** | Low | Open |  | The website’s fake passkeys lack the members real creation answers carry and a counting authenticator |
| TQ9-7 | **Low** | Low | Open | KNOWN | A few tests depend on the clock or machine speed; some assert an absence after a fixed wait |
| TQ9-8 | **Nit** | Nit | Open |  | Assertions that can’t fail (`toBeTruthy()` placations) and tests of source text instead of behavior |
| SY9b-1 | **Low** | Medium | Fixed (#716) |  | 11 of 51 deliberate faults in the sync rules and engine pass every test; three are real guards with none (a stale hold, a newer key in a pull, the catch-up bound) |

### PR #713’s desk code and words

| ID | Severity | As reported | State | Tag | What |
|---|---|---|---|---|---|
| UX9b-2 | **Low** | Low | Open |  | The backup reminder still says “You haven’t backed up your notebook yet” to a synced reader while the Settings line beside it says “Not backed up to a file yet” (`first-use.js:433` against `:438`) |
| UX9b-3 | **Low** | Low | Open |  | A browser whose link remains but can no longer sync (removed, or on another notebook) is still told “It syncs with your account” and shown no card; read, not run against a service |
| UX9b-4 | **Nit** | Low | Open |  | A reader who answered “this browser” has no way to an account from the Notebook panel (the header’s “Sign in” is one) |
| UX9b-5 | **Nit** | Nit | Open |  | A first write in the same tick as the page opening nudges a linked reader |
| UX9b-6 | **Nit** | Nit | Open |  | The first stage’s `desk-reminder.mjs` gained two functions it never uses (about 1 KB of source) |
| UX9b-7 | **Nit** | Nit | Open |  | “Set up an account…” is a link with an ellipsis beside a bordered button: it reads as secondary, and the ellipsis promises a dialog where it opens a page |

### PR #714

| ID | Severity | As reported | State | Tag | What |
|---|---|---|---|---|---|
| ORC-h | **Nit** | Nit | Open |  | #714 (merged as `549d75ac`) says the merge “filed” liberatingscripture.github.io#126; the workflow added a comment to that issue, open since 2026-11-11 |

## Coherence across the pull requests

BVJ asked for "seamless coherence across all the PRs for implementing this new system." Four agents
looked at it from different sides: COH9 (Opus) read the spec, the service, the website, the fake
service, and the apps file against each other; DOC9 (Sonnet) read the records (decisions, names, the
docs against the code); MH9 (Haiku) made the mechanical tables (refusal words, statuses, routes, asks
and items); and the second-pass auditors checked #713 against the rest.

**What agrees.** Every route the website sends (32, from seven files) is routed and in the spec. The
service can send 21 refusal words; all 21 are in the spec with one status, and all 17 `not_allowed`
rules are named. The request and answer shapes the website builds and reads match the service's member
for member (the grant body, `replaced`, `waiting`, a device's `how` and `by`), and the account tests
run the website's model against the service's own code, which is the strongest evidence of that. The
approval id, its link, the crypto sizes, and Turnstile agree across the spec, the reference, the
service, the vectors, and both apps-file entries. The decisions read the same everywhere DOC9 looked:
session lifetimes, who rolls back, production "prepared, not deployed," the "ask BDR" and "yes" lists,
and the numbering of asks 1 to 20 and items 1 to 90 with no gaps. Every change in the window that
touches what an app builds or sends has a dated entry in the apps file. #713's account facts match the
spec's "What the service holds," "Deleting the account," and session rules, as `src/pages/CLAUDE.md`
rule 2 asks, but for the four places in LP9b-2 to LP9b-4 and LP9b-8.

**What doesn't.** One fault with reach sits in a joint (COH9-1, above). The rest is drift in the text
around the decisions, each Low or Nit: the fake service against the real one (SY9-2); Turnstile's "off"
wording in five places after it went on in the preview (DOC9-4); "the deletion page can't delete" in
four places after it could (DOC9-5); an area file that puts `/delete-account/` in the sitemap when the
config takes it out (DOC9-6); the spec's front matter and order of work stopping at 4g (DOC9-8); the
D1 allowance described per database in two places and per account in a third (DOC9-2); a sentence
that reads like a cancel window (DOC9-7); and two spec sentences that say a deleted account leaves
nothing, against the spec's own 30 days of history (LP9b-6). The local place has three names, "this
computer," "this browser," and "this device," and #713 added more of each (CP9-1).

**What is missing.** A single list of what must be true before accounts open (DOC9-3), and a line for
each of iOS's points (DOC9-1). COH9's table gives each point's state in the code at `3ef75d8e`: none
fixed since iOS read `main`, two never real disagreements (5 and 6), and twenty standing (point 14 only
in part, points 20 and 21 harmless, and point 18 latent: `openSession` keeps a refused keyring in
memory). The table is in
Appendix J, under "What held up."

**Checked and not a fault.** MH9's three candidates were judged by the orchestrator and COH9: the
spec's "a minute before `due` or twenty minutes after" illustrates "until it is carried out" and is not
a window (DOC9-7 keeps it as a wording Nit); `DELETE /devices/:id`'s session rule agrees with the spec's
table; and "item 20, rule c" predates the window. The service README lists 16 of 37 routes on purpose
(it names the spec as its specification), and `POST /sign-in/challenge` answering only with a provider
on follows the spec's general rule.

## Step 4j and PR #713

Step 4j was being written while the audit ran, so the first auditors tagged what they expected it to
cover. LP9b checked each against `37a7498e`, and UX9b checked the desk's side:

| State on `37a7498e` | Findings |
|---|---|
| Fixed | LP9-1 (the High), LP9-2, LP9-4, LP9-8, LV9-8 |
| Partly fixed | LP9-3 (what remains is LP9b-5), LP9-5 (LP9b-6), LP9-6 (LP9b-3), LP9-9, DOC9-3 |
| Open, and carried by a new finding | LP9-7 and SV9-6 (now LP9b-4) |
| Open | AC9-3, LP9-10, AC9-7, AC9-8, CP9-1, DOC9-5, ORC-e |

LP9b counted AC9-3 as partly fixed. VER9 found otherwise: the sign-out sentence is unchanged
(`signOutLinked`, now `desk-account-words.mjs:154`), the clause LP9b cited was already there at
`3ef75d8e`, and what #713 added ("Your passkey only signs you in," the help page's recovery-code items)
is context around the sentence, not the fix. So it is open.

#713's own findings are LP9b-1 to LP9b-10 and UX9b-1 to UX9b-7, in their areas above. Two are live
(LP9b-1, LP9b-4); the rest are gates, wording, or tests. What held: the effective date moved and
`dateModified` with it; the account facts follow the spec; `/terms/` is indexed, canonical, in the
sitemap, and out of Pagefind like `/privacy`; the first-use card behaved in every state UX9b drove
(never answered, answered, linked, linked then unlinked, no store, accounts open and closed) and writes
nothing it shouldn't; the copy rules held over all 382 added lines; and `/privacy` and `/terms/` stay well
inside "good" (LCP 384 to 1,012 ms warm at 1366 px, CLS at most 0.0013).

**PR #714** records BVJ's approval of 4j's last two choices and its merge. Its facts check out (the
effective date is 2026-11-25 on both pages; #713 merged on 2026-11-25 Pacific) but for one word: the
merge did not file liberatingscripture.github.io#126; the workflow added a comment to that issue, which
has been open since 2026-11-11 (ORC-h, Nit).

## Decisions needed from BVJ and BDR

Each is Claude's recommendation; none is decided.

1. **Which Workers plan the account is on (BVJ, one look in the dashboard).** Cloudflare's Workers Free
   plan gives the whole account 100,000 D1 rows written a day and 50 queries per request; Workers Paid
   ($5 a month) gives 50 million rows a month and 1,000 queries. On Free, a flood of the preview also
   stops the CSP Worker's counts for the rest of the day (SV9-1, DOC9-2, SV9-7). Recommendation: record
   the plan in `DISASTER-RECOVERY.md`; if it is Paid, set a billing notification now.
2. **SV9-1: ceilings on what an account stores (BVJ, then BDR).** The service checks only form and
   size, by design, so it can't tell junk from a notebook. A ceiling is a row count and a byte total
   kept on the account and checked in the batch that already guards a push, answered with a refusal the
   apps must handle. Recommendation: size it from the largest real notebook with ample headroom, add a
   tighter limit on `POST /rows`, and sweep accounts with no notebook and no live session after a few
   days (which also settles LP9-4's remainder).
3. **LP9b-1: the tracking sentence on `/privacy` (BVJ).** Recommendation: change the words now ("We
   don't track you across sites," plus one sentence naming the players and Give Lively's box), and
   decide later whether YouTube moves to its no-cookie address or each player loads on a press.
4. **LP9b-4: the service's stored logs (BVJ).** Workers Logs is Cloudflare's stored copy of a Worker's
   log lines, kept for a few days and searchable in the dashboard; it is on for the notebook service
   and off for the CSP Worker. Nobody has looked at what Cloudflare stores beside each line.
   Recommendation: open one stored event for the preview. If it holds the address or the URL, turn
   stored logs off (live tailing still works) or change the two sentences; if not, write down what it
   holds in the service's README.
5. **SEC9-1: an approval link on a computer that holds the notebook (BVJ, BDR for the apps).**
   Recommendation: the question says to approve only a device you are holding that shows this code now;
   the page never presses Continue for the reader; and, if BVJ agrees, a computer with the notebook
   asks for the code the new device shows instead of taking one from a link.
6. **COH9-1: sign out after removal or replacement (BVJ decides, BDR confirms).** Recommendation: the
   website falls back to `DELETE /session` when the service answers `own_device`, and the spec says
   which request to send in each state.
7. **SEC9-2: the deploy job and its token (BVJ).** A GitHub Actions job is a sequence of steps on one
   machine, sharing its files; a package's install script runs during `npm ci`, so code from any of the
   service's 200 packages runs before the step that holds the Cloudflare token. Recommendation: test in
   one job with no secrets, deploy in another that installs without running scripts and runs only
   wrangler, and pin actions by their commit. Cloudflare can't narrow a token's D1 or Workers rights to
   one database or Worker, so the only way to keep the preview's token from production is a separate
   Cloudflare account for the preview; worth weighing before production is deployed.
8. **SV9-4: how the service is stopped in an emergency (BVJ).** Recommendation: pick one way (removing
   the custom domain in the dashboard, or deploying a build that answers 503), try it on the preview,
   and write it in the runbook with the queries that find the account doing harm.
9. **LP9-6 and LP9b-3: the stores' privacy forms (BDR).** Recommendation: declare the plain fields (the
   account and its ways in, device ids, times, a device's model and platform) as collected, and the
   notebook as end-to-end encrypted, from 4j's page.
10. **DOC9-1: iOS's points (BVJ's side, BDR on key storage).** Recommendation: one pass before December
    24 that gives each of the 22 points and the three key-storage points a line (taken, and where; not
    taken, and why; or BDR's), starting from COH9's table.
11. **LP9b-7: the "what changed" line (BVJ).** `/privacy` promises one at its top for 30 days and a
    note in the apps' What's New; #713 added neither. Recommendation: add the line now, dated
    2026-11-25, and ask BDR to carry the note in the next builds.
12. **LP9-9 and LP9b-9: what a lawyer should look at (BVJ).** The lawful basis, transfers, and a
    complaint route are not named; the Terms put the intros, glossary, and articles under a license
    page written for the text and footnotes. None of this is legal advice.
13. **The desk's words (BVJ).** Should the sign-out sentence say a one-device notebook will need the
    recovery code (AC9-3)? Should the backup reminder fire for a synced reader, and say "to a file"
    (UX9b-2; UX9b's pick: keep it on with those words)? Should the Notebook panel have a way to an
    account once a reader has answered (UX9b-4)? One name for the local place (CP9-1; UX9b's pick:
    "this browser" for where the notebook is kept, "this computer" for the file and hardware)? And is
    "Set up an account…" right as a link with an ellipsis that opens a page (UX9b-7)?
14. **SY9b-3: clocks far apart (BVJ and BDR).** About a quarter of fuzzed histories with clocks an hour
    or a day apart revive a deletion or bury a restore; the format warns only of lost edits.
    Recommendation: name both in the warning; no change to the rule.
15. **TQ9-1 and TQ9-2: the tests that come first (BVJ, then BDR).** Recommendation: before accounts
    open, a test per sealing default that seals twice with no nonce and expects two different nonces
    and ciphertexts that both open, and a new vector, "a card naming another signing key," so both
    apps are held to the same step; tell BDR when the vector lands, since it changes the vectors file.

## What was run, and what passed

Every command below ran in this worktree, first at `3ef75d8e` and again at `37a7498e`. Logs are in the
orchestrator's scratch folder, not the repo.

| What | At `3ef75d8e` | At `37a7498e` |
|---|---|---|
| `npm ci` at the root and in each of the three Workers | clean, 0 vulnerabilities in each | (not repeated; no lockfile changed) |
| `npm test` (both roots) | **5,094 pass, 0 fail**, 16 suites, 75.7 s | **5,105 pass, 0 fail**, 16 suites, 141.1 s |
| `npm run check` | 882 files, 0 errors, 0 warnings, 91 hints | 884 files, 0 errors, 0 warnings, 91 hints |
| `npm run validate:chapters` | 260 valid | 260 valid |
| `npm run build` | built; Pagefind 38 pages, 3,053 words | built; Pagefind 38 pages, 3,053 words |
| `npm run check:links` | 359 pages, 57,456 internal links, 0 broken | 360 pages, 58,293 internal links, 0 broken |
| `npx vitest run`, `workers/notebook-service/` | **2,377 pass**, 24 files | (no file under `workers/` changed) |
| `npx vitest run`, `workers/csp-reports/` | 80 pass, 6 files | (unchanged) |
| `npx vitest run`, `workers/contact-form/` | 39 pass, 1 file | (unchanged) |

The auditors' own runs, from their reports:

| What | Result |
|---|---|
| `node --test test/desk-crypto.test.js` (SEC9, COH9) | 36 of 36 |
| The account and sync tests against the service's own code (COH9) | 90 of 90 |
| Adversarial WebAuthn and CBOR cases (SEC9) | 66 cases: every malformed or hostile one refused; four non-canonical encodings accepted (SEC9-7, harmless) |
| Route authorization (SEC9) | all 37 routes walked for session kind and ownership; no object reachable across accounts |
| The no-`Origin` chain on the service's own code, Turnstile configured (VER9) | sign-up, setup, and 20 of 20 pushes accepted; 10,000 rows, 75.3 MB; no siteverify call (SV9-1) |
| Fuzzed multi-device histories (SY9b) | 4,000 histories in 10 clock setups: every one converged, none ping-ponged, no record lost outright |
| Mutation testing of the sync rules and engine (SY9b) | 51 single faults: 40 caught, 11 survived (SY9b-1) |
| Mutation testing of #713's wiring (UX9b) | 7 faults in the tour, runner, notebook page, and shell: 2 caught, 5 survived; 3 card faults caught (UX9b-1) |
| Mutation testing of the service (TQ9) | 104 single faults: all caught by the full 2,377-test suite; 20 missed by the test file named for the code (TQ9-4) |
| Mutation testing of the website's crypto, passkey, and account code (TQ9) | 68 single faults: 52 caught, 16 survived (13 real gaps, 3 probably equivalent; TQ9-1 to TQ9-3); four re-run by VER9 over 15 files and 276 tests on a copy of `549d75ac`, still surviving |
| The root suite's D1 stand-in against workerd's D1 (TQ9) | a missing bind is NULL in `node:sqlite` and an error in workerd; 101 binds pass in `node:sqlite` and fail in workerd (TQ9-5) |
| Keyrings fuzzed against `checkKeyring` with and without its "every held key" test (VER9) | 200,000 texts, 1,700 parsed: the two never disagree (TQ9-2) |
| Hostile rows planted for a device to pull (SY9b) | 10 kinds: each skipped, the pass ended up to date, good rows still arrived |
| Races at "Stop syncing" (SY9b) | reproduced twice with a gated service (SY9b-2) |
| D1 query plans (SV9) | auth, pages, lookups, sweeps, and deletes use their indexes, but for three (SV9-9) |
| The account flows end to end in headless Chrome 158 against `wrangler dev` with a local D1 (LV9) | six devices with virtual authenticators (PRF on): setup, recovery code, join by approval, sign out and in, rename, remove, key change, and delete all ran |
| The header with the account entry (LV9) | `/`, `/john-3/`, `/about/`, both entries, 760 to 1920 px (6 combinations by 59 widths): no overlap, clipping, or sideways scroll |
| Contrast, forced colors, reduced motion, dark mode, 320 px (LV9) | all passed on the account pages |
| The first-use card and tour in happy-dom (UX9b) | 6 states driven, 6 tests passed; no write that shouldn't happen |
| Copy rules over the window's diff (CP9) and #713's (UX9b) | 5,561 added lines and 294 reader-facing literals, then 382 lines: 0 em dashes, 0 straight quotes in reader text, 0 punctuation outside a closing quote, 0 British spellings |
| The account family in `dist/` (CP9) | eight pages noindex, out of the sitemap and Pagefind; no discovery file names them; `PREVIEW_SECRET` in no built file; chapter pages load none of the account or sync chunks |
| `/terms/` in `dist/` (orchestrator) | `index,follow`, canonical to itself, in the sitemap (291 locations), out of Pagefind |
| `public/api/` | no generator and no output contract changed in the window |

**Performance**, measured by the orchestrator in headless Chrome 158 over the DevTools protocol against
`astro preview` of the built site, with analytics, `/csp-report`, and both notebook hosts blocked:

| `/john-3/` at 1366 px, throttled (4x CPU, 150 ms, about 1.6 Mbps) | LCP | CLS | Scripts |
|---|---|---|---|
| A reader (no desk) | 1,232 ms | under 0.001 | |
| The desk on | 1,440 ms | under 0.001 | 34, 81.9 KB |
| The desk on, accounts open | 1,696 ms | under 0.001 | 36, 84.5 KB (the header's entry adds 2 files, 2.6 KB) |
| The same, with a stale `lit-desk-account-last` note | 1,932 ms | 0.0002 to 0.0006 (the nav moves once) | |

Total blocking time is 660 to 832 ms with the desk on against 209 ms for a reader (the desk's, not this
window's). Every reading page stays inside "good" for LCP and CLS. The account pages are the exception
for layout shift: `/account/` with the desk on and accounts open shifts **0.074** (the footer moves when
the first screen is drawn after paint), and signed out it loads 36 scripts, 136.6 KB compressed, against
50.6 KB with accounts closed (ORC-e, ORC-f). `/privacy` and `/terms/` at `37a7498e`, unthrottled: LCP
384 to 1,012 ms warm (2,496 ms on the first, cold run), CLS at most 0.0013, 204 to 238 KB, 16 to 19
scripts.

## What the orchestrator checked personally

These, in the code, before they went to a verifier: SEC9-1 (`notebook.js:989-994` fills "Add a
device" and clicks its button; `addAsk` at `desk-account-words.mjs:296` has no "holding"), SEC9-2 (the
workflow's lines 105 to 126), SV9-12's constants, SY9-1's emptied `touched` (`desk-sync-engine.mjs:391-392`),
LP9-1 to LP9-3 in `privacy.astro` at `3ef75d8e`, DOC9-1's timing and fixture, and LP9b-1's sentences on
the live page. MH9's three candidates (false positives, Appendix O). The orchestrator's own findings: the
sitemap claim (ORC-a, folded into DOC9-6), the `_headers` comment (ORC-b), the policy still report-only
while sign-in is live (ORC-c, folded into SEC9-4), the preview switch as a link anyone can send (ORC-d,
deliberate), the account page's eager imports and its layout shift (ORC-e, ORC-f), the desk file's
headroom (ORC-g), and #714's "filed" (ORC-h). #714's merged tree was compared with the head audited
(identical). The build's rewrite of `src/data/podcast-feed.xml` was reverted after each build; the
untracked `grep.exe.stackdump` in the worktree predates the audit and is not part of it. SY9b wrote a
scratch test into the repo by mistake and deleted it; `git status` confirmed the tree clean after
every agent.

**Told to BVJ during the audit, before this report:** SV9-1 is live on the preview (no storage ceiling,
and accounts can be made from a script). No secret was found in the repo or in `dist/`.

## Method

The audit was sixteen agents: fourteen auditors, read-only in the repo, on the worktree pinned
to `3ef75d8e` with its own `npm ci` and a production build, and two verifiers. Every auditor got the brief
in Appendix R; the two who audited #713 also got Appendix S. Each was told to verify its own findings
by a second look that tries to prove them wrong, to rank them Critical, High, Medium, Low, or Nit, and
to change no file in the repo. Models by fit:

- **Opus** for security (`SEC9`, reasoning from attacker input to a sink across a new service), for
  coherence (`COH9`, where a wrong call between four layers is hardest to see in review), and for the
  first verifier (`VER9`: security, the service, sync, cost, and coherence, then #713's two passes and
  TQ9's).
- **Sonnet** for the broad reading slices: the sync connector (`SY9`) and its deep pass (`SY9b`), the
  account pages (`AC9`), the service's reliability and cost (`SV9`), legality and policy (`LP9`), the
  live browser pass (`LV9`), the records (`DOC9`), test quality (`TQ9`), #713's policy and
  promises (`LP9b`) and its desk code and words (`UX9b`), and the second verifier (`VER9b`:
  accessibility, use, legal, docs, copy).
- **Haiku** for the fully specified checklists: copy rules and SEO (`CP9`) and the mechanical tables
  (`MH9`).

**A departure from the rule on subagents, reported here as it was to BVJ.** The root `CLAUDE.md` allows
two Sonnet agents at a time. The first wave started four Sonnet auditors at 04:32 UTC (SY9, AC9, SV9,
LP9; done 04:38 to 04:42), and a second wave started four more at 04:43 to 04:44 (SY9b, LV9, DOC9, TQ9),
both before BVJ's message at 04:47 allowing two more. From 04:47 the four ran within BVJ's allowance.
Haiku stayed within two and Opus within one throughout.

Throwaway scripts (the no-`Origin` chain, the quota and write measurements, the fuzzing and mutation
runs, the WebAuthn and CBOR cases, the route walk, the performance rig, the happy-dom state walk) are in
the session's scratch folder, not the repo.

## Not covered

- **Safari, Firefox, and a real phone.** Every browser run was Chrome 158, headless. The account pages
  are for computers, but the apps' web views and Safari's passkeys were not seen.
- **Real passkeys and the operating system's prompts.** LV9 used Chrome's virtual authenticator with
  PRF on. A platform authenticator without PRF (which turns "Follows my account" off, AC9-4) was not
  reached live, nor were iCloud Keychain, Google Password Manager, or a security key.
- **A screen reader.** The accessibility findings come from the accessibility tree, focus, and live
  regions read in code and in Chrome, not from NVDA, JAWS, or VoiceOver.
- **The Turnstile widget.** LV9 ran with Cloudflare's published always-pass test keys. The real widget,
  its look, and its behavior under the report-only policy were not seen.
- **The deployed services.** No request went to `notebook-preview.litbible.net` or
  `notebook.litbible.net`, and nothing touched Cloudflare; SV9-1's chain was run locally on the
  service's own code. Live `litbible.net` was read only by plain GETs of public pages and headers (the
  policy and `noindex` on `/account/` match the repo). The account's plan, D1's real write throughput,
  how long a large delete takes, and what a stored Workers Logs event holds are BVJ's to look at.
- **The apps.** Nothing of BDR's code was read; what the website asks of the apps was checked against
  the website's own records.
- **#713's desk states against a real service.** UX9b drove the card and tour in happy-dom; the removed
  and wrong-notebook states (UX9b-3) were read, not run.
- **Legal advice.** LP9 and LP9b name what a lawyer should look at. None of it is legal advice.

## Appendix A: Security and the trust boundaries (`SEC9`, Opus)

Slice: the crypto reference against its spec, passkeys and WebAuthn, sessions and every route's authorization, Apple and Google, the preview's way in, CORS, limits and Turnstile, the website's sinks and storage, the CSP and its report Worker, the workflows, and the supply chain. Commit `3ef75d8e`, window from `fbcd83c0`.

### Summary

Nothing URGENT: no secret in the repository, and nothing exploitable live on litbible.net or the preview that I could find without touching the preview. The service's authorization held everywhere I pushed: all 37 routes are scoped to the caller's account, a stolen sign-in gets no records and no lasting change, and the crypto reference, the CBOR decoder, and the passkey checks refused every forged input that mattered. The weak points are around the edges of that core: the website's approving screen can be driven by a link to "Add device" with the spec's warning missing, which turns a stolen sign-in into the whole notebook with one click by the reader; the preview's deploy job runs 200 packages' code in the same job that then holds a Cloudflare token reaching litbible.net's routes and production's database; and nothing limits how much one account stores. Counts: **Critical 0, High 0, Medium 3, Low 3, Nit 2.**

### Findings

##### SEC9-1 · Medium · security · NEW
**A link opened on a computer that holds the notebook goes straight to the "Add device" question, and that question leaves out the spec's warning, so a stolen sign-in becomes the whole notebook with one click by the reader.**

- **Where**: `src/scripts/desk/account/notebook.js:989-994` (the link's code fills "Add a device" and presses its Continue button); `notebook.js:825-838` (the found request becomes a confirm box with focus on "Add device"); `src/scripts/desk/account/page.js:78-86` (the code read from `#a=`); `src/lib/desk-account-words.mjs:296` (`addAsk`); `workers/notebook-service/src/approvals.js:29-31, 86-87` (any signed-in session that isn't open may post a request); `approvals.js:95-105` (the answer carries no time made and no way in). Spec: `STUDY-DESK-ENCRYPTION.md:961-963` ("By approval," step 4), `:150-154`, `:3226-3237` ("Still open," 87).
- **What happens**: someone who has the reader's sign-in but not the key (the exact case the spec says is contained: Apple or Google taken over once those are on, or a synced passkey under "this device only") picks an approval code, posts `POST /approvals` with its id, a MAC they can make because they chose the code, their own device keys, and a `model` of their choosing ("Chrome on Windows," up to 64 characters, bidi controls allowed). They send the reader `https://litbible.net/account/connect/#a=<code>` ("confirm your new device"). On any linked computer with the desk on, the account page opens without `?account=preview` (`account-gate.js` imports the page when the desk is on), reads the code, fills "Add a device," clicks Continue itself, checks the MAC (it is valid), and shows: Add “Chrome on Windows” (Website) to your notebook? with focus on "Add device." One Enter grants the keyring, sealed to the attacker's key: every key the notebook has had, so every record. The "Show a code instead" flow has the same race in a smaller form: whoever with a session sees the code first (a shared screen, a class) can post first, and the approving computer asks about their request.
- **Evidence**: read the code paths above. The spec, step 4: "The screen says to approve only a device the reader is holding." `grep -i holding src/lib/desk-account-words.mjs` finds nothing; the confirm box carries only `addAsk(model, platform)`. Item 87 records the link behavior ("with the notebook, it fills in “Add a device” and asks the reader to say yes") and also says "A computer has no camera to count on, so the website never scans," so on a computer this branch is reached only by a link someone clicked or pasted. The service's answer to `GET /approvals/:id` holds no `created` and no way in, so the page couldn't say when or how the request was made if it wanted to.
- **Why it isn't a false positive**: the MAC proves only that the requester knew the code, and here the attacker chose it. `postApprovals` refuses an open session, not a signed-in one. Nothing in "What this protects" or "Still open" weighs a link sent to the approving device (37 covers holding the three slots, not this). The account notice that announces a new device afterward comes after the keyring is gone, and the reader said yes to it.
- **Fix**: before launch, and for BVJ (the words, the flow) and BDR (the apps scan the same link and approve from it): (1) put the spec's sentence in the question (approve only a device you are holding, and that is showing this code now); (2) on a computer that holds the notebook, don't act on a link's code: show "Add a device" empty and ask for the code the new device shows; (3) add `created` and the requesting session's `through` (as a waiting request already has) to `GET /approvals/:id`, and show "asked 1 minute ago, signed in with Google"; (4) don't move focus to the yes button.
- **Confidence**: High on the mechanics (each step read in the code). Medium on likelihood, since it needs a stolen sign-in and a reader who follows a link; that combination is the one the design says it stops.

##### SEC9-2 · Medium · security · NEW
**The preview's deploy job installs and tests 200 packages in the same job that then holds a Cloudflare token reaching every Worker on the account, every D1 database, and litbible.net's Worker routes, so the comment's "npm ci and the tests above never see it" promises less isolation than it sounds.**

- **Where**: `.github/workflows/notebook-service-deploy.yml:105-110` (`npm ci`, `npm test`), `:116-126` (the token in the next steps' environment; the comment at `:114-115`), `:132-137` (the walkthrough gets `NOTEBOOK_PREVIEW_SECRET`); the production jobs repeat the shape. Token scope: `workers/notebook-service/README.md:600-603` ("Workers Scripts (edit), Workers Tail (read), and D1 (edit); on the `litbible.net` zone, Workers Routes (edit)").
- **What happens**: steps of one job share the runner's file system. A dependency version with a malicious install script (npm runs `preinstall`, `install`, and `postinstall` during `npm ci`), or malicious code loaded by vitest during `npm test`, can rewrite `node_modules/wrangler` or drop a background process. The next step runs `npx wrangler` from that `node_modules` with `CLOUDFLARE_API_TOKEN` in its environment. With that token: deploy a Worker on a `litbible.net` route and serve any script to every reader (the "code itself" threat the spec names, now without touching Pages), redeploy the forms' and the report Worker, and read, rewrite, or delete any D1 database on the account, which will include production's once it exists, without the production environment's required reviewer. The path in is ordinary: a Dependabot group for `workers/notebook-service` is merged to `main`, and that push runs this job.
- **Evidence**: `package-lock.json` in the package has 200 packages, 3 with install scripts today (esbuild, fsevents, workerd), counted with a one-line node script over `packages` and `hasInstallScript`. npm's docs ("Life Cycle Operation Order," https://docs.npmjs.com/cli/v11/using-npm/scripts): for `npm ci`, preinstall, install, and postinstall "all run after the actual installation of modules into `node_modules`." GitHub's "Secure use reference" (https://docs.github.com/en/actions/reference/security/secure-use, "Using third-party actions"): a compromised component "would have access to all secrets configured on your repository," and it advises pinning to a full commit SHA; the workflow pins `actions/checkout@v7` and `actions/setup-node@v7` by tag.
- **Why it isn't a false positive**: the environment's branch limit stops a workflow on another branch, not code that arrives on `main` through a dependency. Keeping the token out of the `npm ci` step's environment doesn't stop that step from changing what the later step runs. `test/config.test.js` holds the production jobs off a push; nothing separates installing from deploying.
- **Fix**: for BVJ: split each workflow into a test job with no environment and a deploy job that installs with `npm ci --ignore-scripts` and runs only wrangler (no vitest); pin actions to SHAs (Dependabot's `github-actions` stream already exists to move them); and narrow the preview token's reach. Whether Cloudflare can scope Workers Scripts or D1 to one Worker or one database I did not verify (from memory, it can't), so a separate Cloudflare account for the preview, or at least removing Workers Routes if a redeploy to an existing Custom Domain doesn't need it (the README says that is unknown), is the way to keep the preview's token away from production and the site.
- **Confidence**: Medium. The mechanism is certain; the trigger needs a compromised npm package, which has happened to widely used packages but is not an everyday event.

##### SEC9-3 · Medium · cost · KNOWN (understated: "Still open," 68 says a made-up account holds "nothing")
**Nothing limits how much one account stores, and accounts cost nothing to make, so one address can fill the notebook database and stop sync for every reader.**

- **Where**: `workers/notebook-service/src/rows.js:16, 91, 101-102` (each row up to 1 MiB plus tag, 500 rows a request, no total per account); `src/http.js:9` (4 MiB a body); `wrangler.jsonc:105` (1,200 requests a minute per address, per Cloudflare location); `src/turnstile.js:107` (no `Origin`, no check); `src/webauthn.js:4-6` (no attestation, so a script can be its own passkey); `src/scheduled.js:53-55` (expired sessions, approvals, and challenges are cleaned; accounts never are). Spec: `STUDY-DESK-ENCRYPTION.md:3004-3012`.
- **What happens**: a script makes an account without `Origin` (Turnstile skipped, "Still open," 86), sets up a notebook with the public reference code, and pushes padded junk rows at about 4 MB a request. D1's limits page (https://developers.cloudflare.com/d1/platform/limits/, main table): "Maximum database size: 10 GB (Workers Paid) / 500 MB (Free)," and the 10 GB "cannot be increased." That is under 200 requests on Free and about 2,600 on Paid, a few minutes at one address's limit if D1 keeps pace, and the limit is per location and per address. Rows written run out first on Free: 500 rows a request reaches the 100,000 a day the spec quotes in 200 requests. Once the database is full, every reader's push fails until someone finds and deletes the account by hand (the page doesn't say how a full database fails; that it refuses writes is from memory).
- **Evidence**: read `rows.js` for any `COUNT`, `SUM`, or size per account (none); item 68 weighs sign-up writes ("one row in two tables for each made-up account, at most 30 a minute from one address, holding nothing") and the daily-writes outage from challenges, not what an account may push after sign-up.
- **Why it isn't a false positive**: the per-request limits bound one request; the rate limit bounds one address's speed; nothing bounds an account's total or an address's total over time. Turnstile, even with BDR's attestation later, raises the cost of an account, not the size of one.
- **Fix**: a per-account cap on rows and stored bytes, checked in the guarded batch (needs BVJ's number, and a spec change for the apps: a new refusal such as `too_large` with `what: "notebook"`); Workers Paid before launch (item 68 already recommends it); and a sweep for accounts with no notebook and no session after some weeks.
- **Confidence**: High that no cap exists; Medium on the minutes, which depend on D1's write speed.

##### SEC9-4 · Low · security · NEW
**The policy step 4i plans to enforce keeps `'unsafe-inline'` in `script-src`, so enforcing it won't stop an injected inline script from using the session and device keys that the docs say it is there to protect.**

- **Where**: `public/_headers:38`; `STUDY-DESK.md:6020-6023` ("enforce it before sign-in ships, since the page will hold a credential to a reader's notes"); `public/CLAUDE.md:19-26`; `STUDY-DESK-ENCRYPTION.md` "What this protects" (the site "enforces its full Content Security Policy before sign-in ships"). Live headers on `https://litbible.net/account/connect/` (one plain GET) match the file.
- **What happens**: the session token and the device's keys sit in IndexedDB (`src/scripts/desk/sync/sync-db.js`). The private keys are non-extractable, but any script on the origin can use them while the page is open, and can read the token. With `'unsafe-inline'` enforced, an HTML injection anywhere on litbible.net still runs; `connect-src` would block a `fetch` to a foreign host, but not a navigation carrying the token away.
- **Evidence**: 16 files under `src/` carry `is:inline` scripts (`git grep -l`), including four pre-paint scripts in `src/layouts/Layout.astro` (107, 110, 122, 181), which is why the allowlist has `'unsafe-inline'`. I found no injection sink in the account, sync, or header code (every name and model is set with `textContent` or an attribute; the one `innerHTML` is a QR code built from local values with escaped text).
- **Why it isn't a false positive**: nothing in 4i's plan or the CLAUDE.md files mentions removing `'unsafe-inline'` (grep found no mention).
- **Fix**: before sign-in ships, replace `'unsafe-inline'` in `script-src` with hashes of the inline scripts (they are fixed text, and Astro can emit hashes; check the pinned Astro version's support), at least on `/account/`, `/account/connect/`, `/delete-account/`, and the desk pages. BVJ's call as part of 4i.
- **Confidence**: High on the fact; the impact needs an injection bug I didn't find.

##### SEC9-5 · Low · security · NEW
**Anyone can post CSP reports, and the summary presents them as "the list to work through" with no warning that a line may be forged, while step 4i's allowlist is decided from that list.**

- **Where**: `workers/csp-reports/src/index.js:11-21`; `src/store.js:22` (`DAILY_CAP = 5000`); `wrangler.jsonc:56` (120 posts a minute per address); `src/report.js` (`MAX_REPORTS = 20` a post); `src/summary.js:139`; `README.md:170-178`.
- **What happens**: from one address, 120 posts of 20 reports is 2,400 a minute, so the day's cap fills in about two minutes, after which real reports that day go uncounted (the summary does flag a full day). More quietly, a few posts claiming `script-src` blocked `https://cdn.example` on `/desk/` put that origin at the top of section 1, which is where the 4i review starts.
- **Evidence**: read the files above; the README's caution is that a week is thin and to walk pages in a real browser, not that entries can be fabricated.
- **Why it isn't a false positive**: the Worker trims and caps what is kept, which protects readers' privacy and D1's writes, not the integrity of the counts.
- **Fix**: one line in the README's "Reading a week" and at the top of the summary: an origin seen only in reports is never added to the policy until it is seen in a real browser on that page. No code change needed.
- **Confidence**: High.

##### SEC9-6 · Low · security · NEW
**`ci.yml`, which gained the three Worker test jobs in this window, sets no `permissions`, and the repository's default workflow token is write.**

- **Where**: `.github/workflows/ci.yml` (no `permissions:` key at any level); `gh api repos/liberatingscripture/litbible/actions/permissions/workflow` answers `"default_workflow_permissions":"write"`.
- **What happens**: on a push to `main` and on a pull request from a branch of this repository, every job (the site build and the three Workers) runs `npm ci` with a write-scoped `GITHUB_TOKEN`, which `actions/checkout` keeps in `.git/config` by default (from memory: its `persist-credentials` defaults to true). A malicious dependency could push branches, edit releases, or open issues and PRs as the workflow. It can't change workflows or bypass the `main` ruleset.
- **Evidence**: GitHub's "Secure use reference," "Principle of least privilege": "make sure that the `GITHUB_TOKEN` is granted the minimum required permissions," with the default set to read. `notebook-service-deploy.yml` already sets `permissions: contents: read`.
- **Why it isn't a false positive**: a fork's pull request gets a read-only token regardless, but pushes and same-repository branches (BDR's) don't.
- **Fix**: `permissions: contents: read` at the top of `ci.yml` (and `apps-mirror-notify.yml`, which I didn't read), and `persist-credentials: false` on checkouts that don't push. Or switch the repository default to read. BVJ's.
- **Confidence**: High.

##### SEC9-7 · Nit · security · NEW
**The passkey checks depart from WebAuthn Level 3 in five small places, none exploitable here.**

- **Where**: `workers/notebook-service/src/signin.js:144` (a sign-in with no user handle is accepted); `src/webauthn.js:212` (`fmt` only has to be text and `attStmt` a map: "packed" with junk, or "xyz," is accepted); `webauthn.js:70` (`topOrigin` ignored when `crossOrigin` isn't `true`); `webauthn.js:182` (a DER integer with any number of leading zero bytes is accepted); `src/cbor.js:30-40` (non-minimal integer encodings accepted).
- **What happens**: nothing a reader would meet. The standard (https://www.w3.org/TR/webauthn-3/): §7.2 step 6, for a user not identified before the ceremony, "verify that response.userHandle is present"; §7.1 step 21, "Determine the attestation statement format by performing a USASCII case-sensitive match on fmt"; step 22, "Verify that attStmt is a correct attestation statement"; step 24, "If no attestation was provided, verify that None attestation is acceptable under Relying Party policy."
- **Evidence**: `adversarial-webauthn.mjs` in my folder, output `adversarial-webauthn.out.txt`: 66 cases, and the four the strict reading would refuse are the non-minimal integer, two non-minimal DER signatures, and a BOM before the client data, all accepted.
- **Why it isn't a false positive** (that it is harmless): a keyed passkey's credential id is unique across accounts (the `ways_passkey` index), so the handle adds nothing; the service trusts no attestation, so reading "packed" as "none" changes no decision; challenges are single-use and the signature covers the exact bytes, so malleable encodings gain nothing.
- **Fix**: optional: refuse a missing user handle on discoverable sign-in (the website's helper already sends it), and treat any `fmt` other than "none" as "none" by name in a comment, so the next reader of `checkRegistration` sees it was meant.
- **Confidence**: High.

##### SEC9-8 · Nit · coherence · NEW
**The preview's `POST /preview/passkeys` adds a way in without moving the lists' version or checking room, against the rule every other change to the ways in keeps.**

- **Where**: `workers/notebook-service/src/preview.js` (`previewPasskey`, a bare `INSERT INTO ways`); compare `src/ways.js:101-105` and `workers/CLAUDE.md` ("A change to an account's ways in moves the lists' version, in a guarded batch").
- **What happens**: on the preview only, a client holding a cached `lists` can act on a passkey list that changed under it, and an account can pass 20 ways. Test data only, and unreachable in production.
- **Fix**: route it through `guard`, `moveLists`, and `needRoomForWay`, or say in its header that it skips them on purpose.
- **Confidence**: High.

### Improvements

- Pin every `uses:` to a full SHA (GitHub's "Pin actions to a full-length commit SHA"); Dependabot's `github-actions` stream will keep them moving.
- Add `created` to the approval answer even if SEC9-1's other fixes wait: it costs nothing and lets every client say how old a request is.
- Sweep accounts that never set up a notebook and have had no session for some weeks, so made-up accounts don't accumulate forever.
- `connectTitle`, `connectLede`, and `connectGo` in `desk-account-words.mjs:282-285` are used nowhere; if SEC9-1's fix keeps a screen for a link on the approving computer, these are its words, otherwise remove them.

### Questions for the owner

1. **Should a computer that holds the notebook act on an approval link at all?** For: it mirrors the apps (which take their part from their own state) and saves a reader who copied the link between their own devices some typing. Against: a computer can't scan, so the only way it gets this link is one that was sent or pasted, which is the phishing path in SEC9-1. **My pick**: no; on such a computer the link opens "Add a device" empty, with a line saying to type the code the new device shows. Joining by link on a computer without the notebook stays.
2. **Turnstile's `hostname` and `action` (the known open choice).** For checking them: Cloudflare's server-side validation page advises validating them when specified, and it is a few lines. Against: the widget is BVJ's, restricted to litbible.net, used for this one action, and siteverify already refuses a token from another widget's secret or a reused one, so the check adds little, and a wrong expected hostname (localhost on the preview) would lock out a real reader. **My pick**: check `hostname` against the page origins the service already accepts, skip `action`. Low risk either way; the real gap is the `Origin` bypass (86), which only attestation closes.
3. **A cap on what one account stores (SEC9-3).** For a cap: it is the only thing between one script and every reader's sync. Against: any cap is a refusal a reader with a very large notebook could meet, and it is a new interface rule for BDR. **My pick**: a generous cap (on the order of 100 MB of stored rows, far above the spec's 50,000-record example), refused as a named error, plus Workers Paid before launch.
4. **One Cloudflare account for the preview, production, and the site.** For keeping one: simpler, one bill, one dashboard. Against: the preview's token, which deploys on every merge touching the package, reaches production and the site (SEC9-2). **My pick**: give the preview its own Cloudflare account, or at least confirm in the dashboard which of the preview token's four permissions a redeploy needs, and drop the rest.

### What held up

- **Route authorization**: all 37 routes in `src/index.js` walked for session kind and object ownership. Every query is scoped by the caller's account; devices, holders, rows, and approvals key on `(account, id)`; `PUT` and `DELETE /devices/:id` act only on the caller's own device; accept is limited to the requesting session; grant, key changes, ways, and records need an open session once there is a notebook; a signed-in session gets the sealed material a joining device needs and nothing else; delete and replace from such a session wait seven days and any open session can cancel. No IDOR found.
- **Sessions**: 32 random bytes, only the SHA-256 kept, bearer only, never in a URL; five wrong proofs end the session; proofs compared in constant time; signed-in sessions never extended; removing a way or a device ends its sessions; `DELETE /session` ends only the caller's.
- **WebAuthn and CBOR**: 66 adversarial cases (`adversarial-webauthn.mjs`): duplicate keys, indefinite lengths, tags, floats, depth 9, lengths and counts past the buffer, unsafe integers, invalid UTF-8, trailing bytes, an off-curve point, P-384, EdDSA, short RSA, BS without BE, BE flipped, UV off, wrong RP, `crossOrigin: true`, wrong type, a credential id mismatch: all refused. A 40 KB nested item decodes in 18 ms. Challenges are spent by `DELETE ... RETURNING` before anything else is judged; the counter moves forward in one statement; the PRF output is stripped by the website (`desk-passkey.mjs:137-157`) and refused by the service (`passkey-form.js:118`).
- **Crypto**: `node --test test/desk-crypto.test.js` passes 36 of 36. Device and signing keys are non-extractable (`desk-crypto.mjs:466-481`) and `start.js:178-179` refuses to link an extractable one; 120-bit recovery codes and 80-bit approval codes make the offline guessing the service could do pointless; row AAD binds kid, id, modified, and deletion; the keyring never goes backward or drops a key; cards and holder records bind notebook, kid, and id. `scripts/lib/p256-fixed.mjs` is imported only by the vector builder and its test, never shipped.
- **Preview gate**: needs `PREVIEW_SIGN_IN` "on," `ENVIRONMENT` exactly "preview," and a secret of 32 or more characters, compared as SHA-256 digests with `timingSafeEqual`; it only ever reaches accounts whose way in is a preview name; production's config has none of the three.
- **Website**: every account and sync screen is built with `textContent` and attributes (`ui.js:17-28`), so decrypted device names and request models can't become markup; the QR SVG escapes its title; the service address is an allow-list of three (`desk-sync-link.mjs`), with local only on a local page; fetches go with `credentials: "omit"`, `redirect: "error"`, and no referrer; the provider return is checked against a 16-byte state, the same service, and five minutes, with fixed return paths (no open redirect). The `#a=` code never reaches a server: it is read and removed from the address, and Cloudflare's beacon (fetched `beacon.min.js`) clears `hash` and `search` before sending. BroadcastChannel and the Web Lock are same-origin, and a message only asks the leader to do what the page could do itself.
- **CORS**: exact origin match, no credentials, preflight refused for anything else. Storage matches what `/privacy` lists (IndexedDB `lit-desk-sync` and its account-page entries, `lit-desk-account`, `lit-desk-account-last`).
- **Workflows**: production jobs never run on a push and need an environment that doesn't exist; rollback inputs reach the shell as environment variables, not pasted text.

### Not reached

- Apple's identity token rules: Apple's "Verifying a user" page renders only with JavaScript and could not be fetched, so the Apple claim checks (`iss`, `aud`, `nonce`) were compared from memory; Google's were checked against its OpenID Connect page.
- WebAuthn Level 3 §7.2 past step 6: the fetched page was cut off there, so the later assertion steps were compared with Level 2 (https://www.w3.org/TR/webauthn-2/, §7.2 steps 11 to 22).
- The CSP report Worker in depth: I read its entry, its trimming, and the summary's structure, not `store.js`'s batch or whether the summary strips terminal control characters from stored text.
- `apps-mirror-notify.yml` and `release-notes.yml` (their PATs' scopes), and `scripts/check-production.mjs` beyond its use in the workflow.
- Any behavior on the preview itself, by the brief's rule, and the account pages in a real browser (they would load the site's analytics during the CSP week).
- Whether Cloudflare API tokens can be scoped to one Worker or one D1 database (SEC9-2 says "from memory").

## Appendix B: The notebook service: reliability, operations, and cost (`SV9`, Sonnet)

Slice: `workers/notebook-service/` (src, migrations, wrangler.jsonc, scripts, tests), `.github/workflows/notebook-service-deploy.yml` and the service jobs in `ci.yml`, the two Worker sections of `DISASTER-RECOVERY.md`, `RUNBOOK.md`, and `workers/csp-reports/` (reliability and cost only). Commit `3ef75d8e`. Nothing in the repository was changed and nothing live was touched. My scripts are in `…\scratchpad\audit9\SV9\`: `measure.mjs` (queries, rows touched, and query plans through the real service on SQLite), `quota.mjs` (the quota probe), `sched.mjs` (the hourly run's query count).

### Summary

No Critical. One High, seven Medium, four Low, plus improvements. The D1 write paths are in good shape: every read-then-write I traced is guarded or a single conditional statement, and I found no half-deleted account and no approval that can be used twice. What is missing is a ceiling. Nothing bounds how many rows, accounts, sessions, or bytes one signed-up address can put into the database, and that is the fault that decides both the Free-versus-Paid question and whether the service can always honor a deletion. The operations side has two real gaps: a queued rollback can be silently canceled, and production's rollback is gated on BVJ's click.

Counts: High 1, Medium 7, Low 4, Nit 0.

### Findings

##### SV9-1 · High · cost · NEW
**Nothing limits how much one account, or the whole service, may store: rows, accounts, and sessions are all unbounded, and a push of 500 rows is accepted over and over.**

- **Where**: `src/check.js:15-47` (`LIMITS` has `rowsPerRequest` and `pageRows` but no per-account count or byte ceiling), `src/rows.js` (`postRows` inserts whatever is open-session valid), `src/scheduled.js:44-48` (the sweep removes sessions, approvals, and challenges only), `wrangler.jsonc` (`REQUEST_LIMIT` 1,200 a minute per address).
- **What happens**: Anyone who can reach an open session can push sealed junk without end. The service checks form and size alone, by design, so it cannot tell junk from a notebook. A script needs a passkey account (a software authenticator, as `test/authenticator.js`, with no `Origin` header so Turnstile is skipped: `src/turnstile.js` checks only requests with an `Origin`), then `POST /notebook` with made-up sealed values, then `POST /rows`. Each request can carry 500 rows or 4 MB. Separately, a passkey sign-up creates an account that is never removed if the client does not finish (no sweep of accounts with no notebook and no live session), and `createSession` never caps sessions per account.
- **Evidence**: `quota.mjs`: 40 pushes of 500 rows each, 40 of 40 answered 200, 20,000 rows and 7.26 MB stored, no refusal. `measure.mjs`: one 500-row push is 3 D1 queries and 501 table rows changed (new rows also write two index entries each, so about 1,500 rows written; D1's pricing page counts an index write as a row written, "Indexes will add an additional written row when writes include the indexed column," https://developers.cloudflare.com/d1/platform/pricing/). Rows written per push is therefore about 1,000 to 1,500, so on Workers Free (100,000 rows written a day, then every query fails until 00:00 UTC, same page) 67 to 100 pushes spend the whole day for every reader and for the CSP Worker's database, which draws on the same allowance. Storage ceiling: 500 MB per database on Free, 10 GB on Paid (https://developers.cloudflare.com/d1/platform/limits/). A full database makes every write fail for every reader. On Paid the included 50 million rows a month are then $1 per million; the theoretical ceiling at the rate limit is far above the included amount, though D1's own write throughput (not measured here) bounds it.
- **Why it isn't a false positive**: I looked for a row or byte count on `accounts`, a limit in `check.js`, `rows.js`, `session.js`, and the spec (`grep` of `STUDY-DESK-ENCRYPTION.md` for quota, storage, and rows per account found only the per-request limit at line 1388). `workers/csp-reports/README.md` and the service README discuss challenge floods, but not this. The limiter is per address and, as `limits.js` itself says, approximate and per location, so several addresses multiply it.
- **Fix**: A per-account ceiling kept in the account row and enforced inside the existing guarded batch (a row count and a byte total that `postRows` adds to and `remove` subtracts from; refuse with `too_large`/`too_many` past it). Size it from the largest real notebook plus headroom, and tell BDR (it is an interface change: a new refusal for the apps). A stricter limiter for `POST /rows` than the general 1,200. A sweep for accounts with no notebook, no live session, and an age past a few days. A billing notification and Workers spending limit before production (https://developers.cloudflare.com/workers/platform/pricing/ says the limit "can affect every Worker on the account" and covers request and CPU charges; whether it stops D1 charges I could not confirm). Needs BVJ and BDR.
- **Confidence**: High on the missing ceiling (run and read). Medium on the dollar ceiling (D1 throughput unmeasured). 4j? No: it is about the service, not the privacy page.

##### SV9-2 · Medium · reliability · NEW
**Production's rollback job runs in the environment that BVJ is to be a required reviewer of, so BDR cannot roll production back alone, which is the reason the workflow exists.**

- **Where**: `.github/workflows/notebook-service-deploy.yml:252-260` (`rollback-production` uses `environment: notebook-production`), `README.md:863` ("add yourself as a required reviewer (so every production deploy waits for your click)"), `RUNBOOK.md` section 2 ("BVJ or BDR, no Cloudflare access needed"), `DISASTER-RECOVERY.md` ("Roll back, and who answers: as for the preview").
- **What happens**: The deploy and the rollback share one GitHub environment. A required reviewer on an environment holds every job that uses it. So at 2 a.m. BDR dispatches "rollback, production", and the job waits for BVJ. If BVJ is the one who is out of reach, nothing rolls back. The preview has no reviewer, so the preview's tried-and-tested rollback is not evidence for production's.
- **Evidence**: the quoted lines. No separate environment exists for rollback.
- **Why it isn't a false positive**: Neither the workflow header nor the README says rollback is exempt, and GitHub environments gate per job, not per workflow. Not yet live (the environment does not exist), so this is a design fault to fix before it does.
- **Fix**: A second environment for production rollback with no required reviewer but the same `main` branch limit (`notebook-production-rollback`), or document that production rollback waits for BVJ and say who else can approve. Needs BVJ.
- **Confidence**: High.

##### SV9-3 · Medium · reliability · NEW
**A queued rollback can be silently canceled by a later push, and nothing in the runbook tells the person who rolled back that the next merge redeploys the code they just rolled back from.**

- **Where**: `notebook-service-deploy.yml:81-83` (`concurrency` group per environment, `cancel-in-progress: false`), `RUNBOOK.md` sections 2 and 3.
- **What happens**: With `cancel-in-progress: false` GitHub still keeps only one pending run in a group and cancels an older pending one when a newer arrives: "any existing `pending` job or workflow in the same concurrency group will be canceled" (https://docs.github.com/en/actions/using-jobs/using-concurrency). Scenario: a bad deploy is running; BDR dispatches the rollback (pending); a merge touching the package lands (pending replaces it). The rollback never runs; the deploy of `main` does. Second: after a rollback succeeds, any later merge to the package or the workflow file redeploys `main`'s code over it, and section 2 does not say to stop deploys first (section 3 does, as a separate step).
- **Evidence**: the YAML and the quoted GitHub text. Not reproduced (I may not run workflows).
- **Why it isn't a false positive**: the same group name covers `deploy` and `rollback` for the preview, and for a push `inputs.environment` is empty so it falls to `'preview'`. I looked for a separate group for rollback and found none.
- **Fix**: Put rollback in its own concurrency group (`notebook-service-rollback-<env>`), and add one line to section 2: "then do section 3 before anything merges." Optionally have the rollback job set nothing itself, since it has no token for variables.
- **Confidence**: Medium-High (documented GitHub behavior, not exercised).

##### SV9-4 · Medium · reliability · NEW
**The service cannot be turned off by anyone, and the runbook has no way to find or remove one account that is doing harm.**

- **Where**: `RUNBOOK.md` (sections 1 to 9: stopping deploys is section 3; nothing stops the service), section 7 ("This needs the account's id, which no log holds; take it from the `waiting` table").
- **What happens**: For SV9-1 (a flood of rows), a leaked-data bug, or a runaway cost, the right first move is to make the service answer nothing, or to remove one account. Neither is written. Rollback does not help (the data is the fault). Section 7 only reaches accounts that have a due request. Which account fills the database is found with `SELECT account, COUNT(*) FROM rows GROUP BY account ORDER BY 2 DESC LIMIT 5`, which is not in the runbook, and the delete of a large one needs the chunked statement, whose Free-plan write cost (about 3 rows written per row deleted, so only about 6 chunks of 5,000 a day on Free) is not mentioned.
- **Evidence**: read of the runbook; `measure.mjs` shows 200,000 rows deleted by cascade is 600,000 rows written at 3 per row.
- **Why it isn't a false positive**: I searched the runbook and README for "off", "disable", "kill", and "pause" and found only the deploy switch.
- **Fix**: Add a "Stop it" section (the dashboard's Custom Domain removal, or a one-line `wrangler deploy` of a build that answers 503; pick and test one on the preview) and a "Find the account" section with the queries. Needs BVJ to choose the stop method.
- **Confidence**: High.

##### SV9-5 · Medium · data-integrity · NEW
**An account big enough that its cascade delete or its replace exceeds D1's 30 seconds can never be deleted or replaced by the service; the request fails every hour.**

- **Where**: `src/waiting.js:154-157` and `:211` (one `DELETE FROM accounts`, cascading through `rows`), `:237` (`DELETE FROM rows WHERE account = ?` in the replace batch), `scheduled.js`.
- **What happens**: Rows are unbounded (SV9-1), so one account can hold millions. The delete and the replace are single statements or one batch. D1 allows 30 seconds for a query (https://developers.cloudflare.com/d1/platform/limits/, "Maximum SQL query duration"), after which it rolls back. The hourly run catches the error, counts `failed`, and tries again the next hour, forever. Apple's tokens, revoked and forgotten first, stay forgotten. To the reader, "delete my account" never completes, which Apple and Google both require. Only `RUNBOOK.md` section 7 (manual, BVJ) clears it, and nothing alerts: `failed` is a counter in a log line.
- **Evidence**: `measure.mjs`: a cascade delete of 200,000 rows took 0.6 s on `node:sqlite`, which says nothing about D1's speed; D1's threshold is unknown to me. No test deletes more than a handful of rows (`test/scheduled.test.js`, `waiting-races.test.js`). The runbook knows the risk ("If a very large notebook ever makes it fail").
- **Why it isn't a false positive**: the 30-second limit is Cloudflare's; the runbook's own section 7 exists because of it. The fault I add is that the service has no automatic path and no alarm.
- **Fix**: With the ceiling from SV9-1 the problem mostly goes away. Otherwise let the hourly run delete rows in bounded batches (`LIMIT 5000` loops, with the waiting row kept until the last) and log a `stuck` count. Needs no decision from BDR.
- **Confidence**: Medium on reaching the limit in ordinary use (it needs a very large account), High on the missing path.

##### SV9-6 · Medium · privacy · NEW · 4j?
**The service keeps Workers Logs on, while the CSP Worker keeps it off for the reason that Cloudflare does not say what a stored line carries; the service's "nothing personal is logged" claim rests on a fact I could not confirm.**

- **Where**: `wrangler.jsonc:32-38` (`observability.enabled: true`, `invocation_logs: false`), `workers/CLAUDE.md` ("Nothing personal is stored or logged"), `README.md` "What is logged", `workers/csp-reports/README.md` ("Cloudflare's documentation doesn't say what it attaches to a stored log line (read 2026-11-24), so none is stored").
- **What happens**: Each request's `console.log` line is stored by Workers Logs (3 days on Free, 7 on Paid: https://developers.cloudflare.com/workers/observability/logs/workers-logs/). The service's own line holds no id. What Cloudflare adds to a stored event (the request's address, its path with a device or approval id in it, headers) the page does not say; it says only that invocation logs carry "details such as the Request, Response, and related metadata" and does not say whether custom-log events do. The two Workers apply opposite standards to the same unknown. RUNBOOK section 1 sends BDR to the dashboard's Logs, so the data is read in practice.
- **Evidence**: the quoted docs; `config.test.js` checks only `invocation_logs`.
- **Why it isn't a false positive**: this is a gap in what is known, not a proven leak. From memory I believe stored events do carry the request's URL, but I could not confirm it.
- **Fix**: BVJ opens one stored event in the dashboard and reads its fields; then either turn logs off here too (`tail` only, as the CSP Worker does) or write down what is stored and change "nothing personal is logged" and the privacy page accordingly. Needs BVJ.
- **Confidence**: Low on the leak, High on the inconsistency.

##### SV9-7 · Medium · reliability · NEW
**The hourly run's Free-plan budget and ordering mean a bad hour can leave the sweep undone and due deletions waiting, and a held request is retried in front of everything newer.**

- **Where**: `src/scheduled.js:27, 33-44`.
- **What happens**: The run reads 100 oldest due requests, carries each out, then sweeps. Each plain delete is 2 D1 calls: `sched.mjs` counts 22 calls for 10 due, 50 for 24, 52 for 25, 202 for 100. Free allows 50 queries per invocation (https://developers.cloudflare.com/d1/platform/limits/), so 25 or more due stops the run mid-loop and the sweep throws out of the handler. KNOWN (`README.md` "Production," step 1 says about two dozen). What the record understates: `ORDER BY due` puts requests held for Apple at the front each hour, so a run of 100 held requests (an Apple outage when many accounts have Apple ways) would never reach a newer one; and the loop does the sweep last, so a failing loop is the one place the sweep is lost.
- **Evidence**: `sched.mjs`.
- **Why it isn't a false positive**: the README records Free's budget and not the starvation; production is to be on Paid, where 100 requests fit up to 4 tokens each.
- **Fix**: Do the sweep first (it is one batch), and order held requests behind fresh ones (record a `tried` time, or take `ORDER BY due` from the oldest not held in this hour). Low urgency while Apple is off.
- **Confidence**: Medium.

##### SV9-8 · Low · reliability · NEW
**A token can be added to an account between the time Apple is told to forget it and the time the account is deleted, and then it is deleted without being revoked.**

- **Where**: `src/waiting.js:143-157` (revoke, then delete in separate calls), `src/ways.js:121-141` (a way and its token added under a guard on `kid` and `lists` only).
- **What happens**: Two sessions of an account that has no notebook (or two open sessions): one deletes, one adds an Apple way. If the add lands between `revokeApple` and the `DELETE`, the delete's condition (`kid = 0` or `OPEN_NOW`) still holds, and the cascade removes a token Apple was never told about. Apple still has an active refresh token for a deleted account; Apple's rule asks revocation.
- **Evidence**: read of both paths; no test covers a way added during a delete (`waiting-races.test.js` list). Apple is off, so none exists today.
- **Fix**: Make the final `DELETE` carry `AND NOT EXISTS (SELECT 1 FROM apple_tokens t JOIN ways w ON w.id = t.way WHERE w.account = ?)`, so a late token retries the revoke.
- **Confidence**: Medium (a narrow window, two devices at once).

##### SV9-9 · Low · performance · NEW
**Three queries read every row of a table because their index cannot be used, and one table's foreign key has no index.**

- **Where**: `src/signin.js:263` (`findWay`) and `src/ways.js:121` (`WHERE kind = ? AND subject = ?`), `src/ways.js:93-94` (`kind = 'passkey' AND subject = ? AND (public IS NOT NULL OR account = ?)`), migration 0003 (`challenges.account REFERENCES accounts ON DELETE CASCADE`, no index on it).
- **What happens**: The partial index `ways_sign_in ... WHERE kind <> 'passkey'` cannot serve a query that binds `kind`, and the `OR` defeats `ways_passkey`. So each Apple or Google sign-in (off today) and each added passkey reads every way in the database, and every account delete scans `challenges` to find children.
- **Evidence**: `measure.mjs`, `EXPLAIN QUERY PLAN`: `providerWay => SCAN ways`, `taken => SCAN ways`, `challengeFK => SCAN challenges`. The rest of the queries use their indexes (auth is two index searches; the rows page is a covering index).
- **Why it isn't a false positive**: the adding-a-passkey scan is live now and reachable by an open session; it reads N rows against Free's 5 million a day.
- **Fix**: Two literal queries instead of the `OR`, literal kinds in the provider lookups (or a plain index on `(kind, subject)`), and an additive migration `0004` with `CREATE INDEX challenges_account ON challenges(account)`.
- **Confidence**: High on the plans; Low in impact today.

##### SV9-10 · Low · docs · NEW
**The runbook has stale or missing rows for Turnstile, and says nothing about whether a rollback restores an older secret.**

- **Where**: `RUNBOOK.md` section 1 ("Only Apple sign-ins fail (`provider`, 502)"), section 8 (no `TURNSTILE_SECRET` row), section 4.
- **What happens**: `provider` now also means Turnstile unreachable or `TURNSTILE_SECRET` wrong (`src/turnstile.js`, `http.js` message), so a mis-set secret makes every browser sign-up fail with a word the runbook blames on Apple. A leaked or rotated `TURNSTILE_SECRET` has no procedure. Cloudflare says "Cloudflare creates a new version every time you upload code or change a Worker's settings or secrets" but nothing on whether rolling back to an older version restores the older secret (https://developers.cloudflare.com/workers/configuration/versions-and-deployments/); the rollbacks page is silent too. If it does, rotating `PREVIEW_SECRET` or the Apple key and then rolling back would bring the leaked value back. Time Travel: the runbook does not say a restore cancels in-flight queries or that restoring to before a migration leaves new code against an old schema (https://developers.cloudflare.com/d1/reference/time-travel/).
- **Fix**: Test secret-rotate-then-rollback on the preview once and write the result down; add the three lines.
- **Confidence**: High on the stale lines; the rollback and secret question is open.

##### SV9-11 · Low · tests · NEW
**Nothing holds applied migrations unedited, nothing shows one is atomic on failure, and a few write paths have no race test.**

- **Where**: `test/config.test.js`, `apply-migrations.js`, `.github/workflows/notebook-service-deploy.yml` (migrate step), the three race files.
- **What happens**: The rule "never edit an applied migration" is enforced by prose only. I could not confirm whether `wrangler d1 migrations apply` applies a file atomically; 0003 has four `ALTER TABLE ADD COLUMN`, and a half-applied file would fail on its rerun with a duplicate column, with the deploy skipped. What the three race files do not cover: an Apple way added during an account deletion (SV9-8); a replace followed by a setup inside one push's read-to-write window (the replace does not reset `rev`, so a stale guard `{kid:1, rev:R}` could match the new notebook; the window is milliseconds, so I did not rate it a finding); a large notebook's delete or replace; and the Free-plan 50-query budget for any request (POST /rows is 3 queries, so it fits).
- **Fix**: A test that hashes each migration file against a committed list; rehearse a deliberately failing migration on a scratch D1; add the missing race cases.
- **Confidence**: Medium.

##### SV9-12 · Medium · reliability · NEW (reported for the CSP Worker's week)
**The CSP Worker's daily cap is first come, first counted, so one address can fill a day in about two minutes, which blanks the week's measurement that the enforcement decision rests on.**

- **Where**: `workers/csp-reports/src/store.js:22` (`DAILY_CAP = 5000`, per UTC day, summed over all reports), `src/report.js:31` (up to 20 reports a post), `wrangler.jsonc` (`REPORT_LIMIT` 120 a minute).
- **What happens**: One address at the limit counts up to 2,400 reports a minute, so the day is full in about two minutes, and the rest of that day's real reports (including from readers) are dropped without a trace, since every answer is alike by design. Even without abuse, one noisy extension or page can exhaust the cap early in the day and bias what is counted toward the first hours (UTC night in the Americas). The cap protects D1's writes (about 5,250 a day at most), which is right, but it does not spread across rules, pages, or senders.
- **Evidence**: read of the two constants and the limiter; I did not post to the live Worker.
- **Fix**: A per-address-free way to spread the cap: reserve a share per rule (directive) or per hour, e.g. 5000 across 24 hourly allowances of 200. Cheap, no new data kept. (Abuse resistance is another auditor's; this is about the data's value.)
- **Confidence**: Medium-High.

### Improvements

- **Cost and plan**: Workers Free allows 100,000 requests a day for every Worker on the account together, 50 subrequests, and 10 ms CPU per request (https://developers.cloudflare.com/workers/platform/limits/); over the day's requests Cloudflare answers error 1027, and a route fails closed unless set to fail open, so the contact form and `/csp-report` go down with the notebook service. A visible tab polls once a minute (`connector.js` `POLL_MS = 60_000`), so a reader with a tab open 8 hours is about 480 requests a day and about 2,000 rows read; an ordinary active reader writes roughly 200 to 300 rows a day (pushes of a few rows at 2 to 3 rows each, one `seen` write an hour, one session extension a day). On Free that is about 200 daily readers before the requests allowance ends, and about 300 to 500 before the daily rows written. Production needs Paid (README and DISASTER-RECOVERY already say so): $5 a month, 10 million requests included then $0.30 a million (https://developers.cloudflare.com/workers/platform/pricing/), and D1 50 million rows written included then $1 a million. An abusive address within the limits: sign-in challenges are 60 a minute, 86,400 a day, about 6 rows written each (insert plus later delete, with two indexes) or about 520,000 rows written a day, which exhausts Free's whole allowance in under five hours and is about $0.50 a day over Paid's monthly included amount; the row pushes of SV9-1 are the expensive path. Set a billing alert and the Workers spending limit.
- The 500-row batch counts as one D1 query ("a `db.batch()` call counts as a single query," https://developers.cloudflare.com/d1/platform/limits/), so the design leans correctly on batches; `POST /rows` is 3 queries (read session, read current rows, one batch) and `GET /rows` is 3 (session, measure, page).
- Max stored text: a 1 MiB record sealed and base64url is about 1.40 million characters, under D1's 2,000,000-byte value limit; one bound parameter per list (`json_each`) keeps every statement under the 100-parameter limit.
- `OPTIONS` preflights skip the limiter (`index.js`, before `limit()`); harmless for D1, but each is a Worker request on Free's 100,000.
- A run that fails after commit (the conflict read after a row batch) answers 500 though the rows are written, and a retry then sees `changed` on its own writes. Rare; the sync engine should treat an identical sealed row as a match.

### Questions for the owner

1. **A per-account storage ceiling (SV9-1)?** Yes: the service stays blind, and an account holds at most N rows and M bytes, with a new refusal word for the apps. No: simplest, but the database, the daily budget, and deletion rest on rate limits alone. My pick: yes, with N and M set from the largest real notebook plus a generous margin. Needs BVJ and BDR (a new interface refusal).
2. **Production rollback without BVJ (SV9-2)?** A rollback-only environment with no reviewer lets BDR act alone; a reviewer on both keeps one human check on a rollback that is itself safe (code only). My pick: no reviewer on rollback. Needs BVJ.
3. **Logs on or off (SV9-6)?** Off matches the CSP Worker and the privacy page's promise, at the cost of seeing failures only through `wrangler tail`. On needs a stored line shown to hold nothing personal. My pick: read one stored event first, then decide.
4. **An off-Cloudflare copy of production's data?** The only backup is Time Travel in the same account; a lost or locked account loses it. `DISASTER-RECOVERY.md` calls this by design. My pick: keep it, since devices hold everything, but say in the privacy page that deletion also leaves a 30-day Time Travel copy (4j).

### What held up

- Every write that depends on a read was one batch with a guard, or one conditional statement: rows, devices, holders, key change, approvals (limit recounted inside the insert), proofs, ways, delete, cancel, carry-out, replace, session creation. The failing-guard test files cover forcing each at an exact point (about 60 cases across the three race files); I weakened none but found no read left unguarded.
- Deleting an account is one statement and clears every table: `ways` (and through it `apple_tokens`), `sessions`, `devices`, `holders`, `rows`, `approvals`, `challenges` (by account), and `waiting` all hang from `accounts` by `ON DELETE CASCADE`. Rate-limit counters are not in D1. `guard` is always empty.
- Removing a device or changing the key deletes the sessions of the removed devices in the same batch; a way's removal deletes the sessions that came through it; an approval is granted once (`granted_by IS NULL` in the update, plus a check of `meta.changes`) and accepted once (the delete is in the guarded batch).
- Query plans: auth, rows pages, row lookups, sweeps, due list, device and session deletes all use their indexes (`measure.mjs`).
- An unexpected exception inside the handler answers `500 error` with no stack and still carries the CORS headers (`withCors` is applied after the `catch`). Config parsing outside the `try` cannot throw on any value (`list` stringifies).
- Migrations 0001 to 0003 are additive: new tables, nullable columns, indexes. A rollback of one version against a migrated database is safe by inspection. Every command in the runbook exists and takes the flags written (`wrangler d1 time-travel restore --timestamp`, `wrangler rollback --yes --message`, checked with `--help`).
- The workflow's production jobs cannot run on a push, the Cloudflare token reaches only the steps that call Cloudflare, and the rollback's inputs reach the shell as environment variables.
- The CSP Worker's writes are bounded: at most 21 rows a post, 5,250 a day, one row per count (`WITHOUT ROWID`), and its prune is an index range.

### Not reached

- Real D1 behavior: the 30-second limit on a large delete, foreign keys being enforced (I believe D1 enables them by default and the workerd tests run against a real local D1, but I did not fetch the page), throughput, and whether `wrangler d1 migrations apply` is atomic per file.
- What a Workers Logs event stores for a custom line (SV9-6); whether a rollback restores older secrets.
- Which Workers plan BVJ's account is on today (not recorded in the repository).
- Running the GitHub workflow, a rollback, or a restore (forbidden); the concurrency finding is from GitHub's documentation.
- The Apple and Google paths against the real providers (off).

## Appendix C: The website's sync connector (`SY9`, Sonnet)

Slice: `src/lib/desk-sync*.mjs`, `src/scripts/desk/sync/*`, the sync-facing changes in `store.js`, `first-stage.js`, `desk-gate.js`, `desk-merge.mjs`, and the service's `rows.js`, `session.js`, `check.js`, `limits.js`, `db.js`, `http.js`. Commit `3ef75d8e`. Nothing in the repo was changed; scripts are in `…\scratchpad\audit9\SY9\`.

### Summary

One Medium (an edit can drop out of the push queue after one transient notebook read failure, while the status says "upToDate"), one Low (a test-fidelity gap between the fake service and the real one), and a short list of improvements. No Critical or High finding. The engine's design (queue as a difference, pull before push, removal only on evidence) held up against everything I tried, and the existing 35 engine tests pass here. The review was shallower than planned in three areas, listed under "Not reached."

Counts: Critical 0, High 0, Medium 1, Low 1, Nit 0.

### Findings

##### SY9-1 · Medium · data-integrity · NEW
**One failed notebook read inside the engine's change scan clears the touched ids first, so the edit is never pushed and the status reads "upToDate."**

- **Where**: `src/lib/desk-sync-engine.mjs`, `scan()`: `const changed = touched; touched = new Set();` runs before the `await notebook.get(id)` loop.
- **What happens**: The reader edits a note. `touch(ids)` records the id. The next pass calls `scan()`, which empties `touched` and then reads each id. If a read throws (IndexedDB `UnknownError`, a quota or blocked-database error, a closing connection), the pass ends in the `error` state, the ids are gone from memory, and no later pass rescans them. Later passes report `upToDate`, pending 0. The edit stays on this device only, until the record is touched again or a full rescan (reload, in the cases where `scanned` resets) happens. Another device never sees it.
- **Evidence**: `SY9\lostscan.mjs`. It edits a note, makes `notebook.get` throw once, and runs passes. Pass 1 returns `error`; passes 2 and 3 return `upToDate` with pending 0; a second device syncs and sees only the first version of the note.
- **Why it isn't a false positive**: I looked for a guard that restores `touched` or clears `scanned` on failure and found none in `scan()` or in the pass's catch path. The tests I read (`desk-sync-engine.test.js`) inject service failures, not notebook read failures, so none covers this.
- **Fix**: Keep the ids until the scan succeeds: copy `touched`, and on a throw merge them back (or set the full-rescan flag). Add a test whose `notebook.get` throws once.
- **Confidence**: High (reproduced). Reach is limited because it needs a read failure, which is rare, so Medium and not High.

##### SY9-2 · Low · tests · NEW
**The fake notebook service accepts things the real one refuses, so engine tests cannot catch failures that happen only on the real service.**

- **Where**: `test/helpers/fake-notebook-service.mjs` against `workers/notebook-service/src/{rows,session,check,account,http,db}.js`.
- **What happens**: The fake has no proof-body validation, checks size before auth (the real order is auth first, body read after `need`), has no session expiry or `reason` field, does not model the `transact` retry (3 tries, then 503 `busy`) or the guard, and has no rate limiter, so `slow_down` and `retry: 60` are exercised only by injected canned responses. A behavior that depends on those can pass in tests and fail on the preview.
- **Evidence**: Side-by-side reading; the real-service helper (`real-notebook-service.mjs`) exists, but I did not run the engine suite against it (see Not reached).
- **Why it isn't a false positive**: The differences are in code paths the engine reacts to (401 with a reason, 503, 429).
- **Fix**: Run the engine's scenario tests against the real-service helper too, at least for expiry, busy, and slow_down.
- **Confidence**: Medium (by reading, not by a failing case).

### Improvements

- The 2 s wait and 10 s maximum for change timers, the 60 s visible poll, and the leader-only pass keep an idle tab at one request per pass. Measured with `SY9\eff.mjs` (linear in records; no full reread when nothing changed). Nothing to change.
- `laterThan` (`desk-records.mjs`) clamps a stamp that would step more than 5 minutes past the clock to `now`; this matches the merge's "ahead" hold. A short comment in `desk-sync.mjs` saying a record stamped far ahead on one device is overwritten after its `due` time would help the next reader.
- The built chunks check for the gate: `store.js` and `first-stage.js` reach sync only through dynamic `import("./sync/start.js")`, and only `desk-sync-link.mjs` (imports nothing) is imported statically. `desk-sync-gate.test.js` and `desk-gate-imports.test.js` exist for this.

### Questions for the owner

- None that block. If SY9-1 is fixed by a full rescan on any scan error, the cost is one extra read of the notebook after a rare failure; the alternative (restoring only the ids) is cheaper and just as safe. My pick: restore the ids.

### What held up

- Rule 4: removal needs a synced trash record; a row missing without a trace is refetched by an audit, never deleted. I found no path that deletes for everyone because one browser lacks a row.
- Efficiency: one idle request per pass; passes scale linearly in records (`eff.mjs`, runs of increasing N); the round limit (8) and catch-up limit (3) bound a pass; backoff on `slow_down` follows the service's `retry`.
- Clamping and the exact tie: `SERVICE_WINS_TIE` plus the clamp keep two devices from ping-ponging on equal stamps in the cases I traced by reading.
- Gate (rule 2): the static import graph is clean as above.
- Baseline: `node --test test/desk-sync-engine.test.js` gives 35 pass, 0 fail.

### Not reached

- A fuzz run for clock skew and ping-pong histories, and the 2-hour-ahead scenario run end to end. I reasoned from `desk-merge.mjs` and `laterThan` only.
- An engine mutation that no test catches (made in a copy). Not done.
- `desk-sync-status.mjs` beyond its `NEEDS_READER` list, the notice files, `lists.js`, and `merge-vectors.json` v9 were not read in full; the notices and `needsReader` coverage question is unanswered.
- The `unlink` against an in-flight engine write race, and the built `dist/` chunks (I checked the import graph, not the chunk contents).
- Running the engine tests against the real service helper.

## Appendix D: Sync, the deep pass: fuzzing, mutation, and races (`SY9b`, Sonnet)

Slice: `src/lib/desk-sync.mjs`, `desk-sync-engine.mjs`, `desk-sync-status.mjs`, `src/scripts/desk/sync/{connector,start,sync-db,service}.js`, the account pages' leave and sign-out, and the notebook service's refusal words (`workers/notebook-service/src/http.js`). Commit `3ef75d8e`. Nothing in the repo was changed (a test file I wrote into it by mistake was deleted at once; `git status` is clean). Everything is in `…\scratchpad\audit9\SY9b\`: `fuzz.mjs`, `race.mjs`, `poison.mjs`, `mutate.mjs`, with outputs `fuzz-out.txt`, `mutate-log.txt`, `mutate-out.json`.

### Summary

No Critical or High finding. The sync converged in every one of 4,000 fuzzed multi-device histories, never ping-ponged, and lost no record. One Medium: 11 of 51 deliberate faults in the rules and engine survived the sync test suite, and three of them are real guards (a stale held row, a newer key seen in a pull, the catch-up bound). Four Low: "Stop syncing" does not stop a pass already running, the documented clock-skew cost is larger than the documents say for deletions, a non-reader `error` is retried for ever with no notice, and the 60 s poll defeats the backoff.

Counts: Critical 0, High 0, Medium 1, Low 4, Nit 0.

### Findings

##### SY9b-1 · Medium · tests · NEW
**Eleven of 51 single faults in `desk-sync.mjs` and `desk-sync-engine.mjs` pass every sync test; three are real guards with no test.**

- **Where**: `test/desk-sync.test.js`, `desk-sync-engine.test.js`, `desk-sync-engine-edges.test.js`, `desk-sync-property.test.js` (96 tests, all pass on the pristine copies).
- **What happens**: I copied both modules, made one fault at a time (a dropped guard, a flipped comparison, a skipped write, a changed evidence check), and ran the four test files against each copy (`mutate.mjs`; 3 parallel mirrors, 51 faults, 40 caught, 11 survived). The ones that matter:
  - **E10, a held row is never released when its revision is stale** (`rejudge`: `base.get(hold.id)?.rev !== hold.row.rev`). With the guard off, `rejudge` merges the stale row again over a newer record. Nothing in the suite makes a hold go stale.
  - **E7, a pull ignores a newer key id** (`pull`: `page.kid > keyring.current` throws `Behind`). With it off, rows sealed under a new key arrive as "aside" and wait for the next account check (every 15 minutes, `ACCOUNT_EVERY_MS`) or an `old_key` on a push, instead of fetching the new keyring at once. A device that only reads is behind for up to 15 minutes.
  - **E18, the catch-up loop unbounded** (`++behind > MAX_CATCH_UPS`). If a service always answered `old_key`, the pass would never end. The bound of 3 is untested.
- **Also surviving, smaller**: E9 (a record missing at push time is not rescanned: by reading, the stale summary could keep the plan non-empty for the rounds of a pass; not shown), E27 (`load()` keeping stale holds after an unknown failure), E4 (the 3600 s cap on a `slow_down` retry), D21 (`canOpenNow` always true: a held "aside" row is re-merged every pass instead of when it can be opened; behavior same, work wasted).
- **Near-equivalent, probably fine** (listed so they aren't re-found): D6 (`synced()` ignoring whether the trash copy still matches its entry: only the order of a removal against a later edit moves), E22 (push refreshing `local`: the scan already holds the same summary), E23 (a push answer's newer `kid`: the service's `old_key` refusal covers it), E21 (merged records written into `local`: redundant if the notebook's own `onChange` already touches them; I did not check what `{ record: false }` does in the browser store).
- **Why it isn't a false positive**: each survivor was run, not read; the patterns matched exactly once. The connector test (`desk-sync-connector.test.js`) was not run against the copies (see Not reached).
- **Fix**: three small tests: a hold whose entry moved on is released and not re-merged; a pull returning a page with a higher `kid` ends in a catch-up and the rows open; a service that answers `old_key` four times ends the pass in `error` with `reason: "behind"`. Add to each the count of requests made.
- **Confidence**: High for the survivors; Medium for which are real guards.

##### SY9b-2 · Low · reliability · NEW
**"Stop syncing" and sign-out do not stop a pass that is already running: it can still merge rows, write sync state, and push after the unlink returns.**

- **Where**: `src/scripts/desk/sync/start.js` (`unlink`, `stopCurrent`), `connector.js` (`stop()` does not abort or await the pass), `sync-db.js` (`conn()` is `db ?? connect()`, so a closed handle silently reopens), `src/scripts/desk/account/notebook.js` 132-139 and 625-640 (`leave` calls `unlink` directly, with no `signOutDevice` first).
- **What happens** (`race.mjs`, deterministic with a gated service):
  - S1: a pull is in flight when `unlink` returns. At that instant the sync DB is clean (no link, token, device, meta, rows). Released, the pass finishes: it merges another device's new note into the notebook (`["mine","t1"]` gains "late arrival from other device") and writes the sync DB again: cursor 3, the sealed keyring, the notebook id, one row entry, with no link, token, or device. No request was made after the unlink in S1.
  - S2: a push is in flight when `unlink` returns. It lands on the service (rows 1 to 2), one more `GET /rows?since=2` follows, and the sync DB again holds meta and rows.
  - In the sign-out path the service ends the session first (`signOutDevice`), so S2's later requests would get 401; the stop notice's "Stop syncing" button (`WORDS.stopLeave`) has no such guard, so the token still works.
  - S3 and S4 held up (below).
- **Why it matters**: a reader who pressed "Stop syncing" expects nothing more to go up or come in. The window is one pass; it is longest on a first sync of a large notebook. The leftovers are small (ids and digests, a keyring sealed to a device key that is gone), but a relink later reads that stale cursor and row entries.
- **Why it isn't a false positive**: reproduced twice with a gated service and checked at the database and the service.
- **Fix**: give the engine a `stopped` flag checked before each request and each write, make `connector.stop()` set it and await the running pass, and make `unlink` await that before `store.setMeta(SYNC_META, null)` and `db.clear()`. A closed `sync-db` handle should refuse, not reopen.
- **Confidence**: High (reproduced). Severity Low because it needs a pass in flight at the click.

##### SY9b-3 · Low · docs · NEW
**The clock-skew cost is real and larger for deletions than the format's warning says: with devices an hour or a day apart, a quarter of histories revive a deleted record or lose an edit.**

- **Where**: `STUDY-DESK-FORMAT.md`, "Two devices whose clocks differ"; `src/lib/desk-records.mjs` (`laterThan`, `CLOCK_TOLERANCE_MS` = 5 minutes).
- **What happens**: 4,000 seeded histories (10 configurations, 400 each; 3 or 4 devices; offline spells, reloads, lost answers, partial passes interleaved inside requests; edits, bookmark moves, deletes, restores, undo-of-delete). Over about 10,000 operations per configuration, counted against the world-time last action on each record:

  | Clocks | lost edits | deletions revived | restores/adds buried |
  |---|---|---|---|
  | one a day ahead, one an hour behind | 106 | 76 | 53 |
  | hour ahead, 30 min behind, day ahead | 83 | 83 | 53 |
  | three devices up to 3 hours behind | 104 | 73 | 52 |
  | within 8 minutes of each other | 14 | 5 | 2 |
  | equal | 0 | 0 | 0 |
  | the same with the offsets drifting while time moves | 102, 80, 100, 18 | 74, 86, 84, 10 | 53, 59, 52, 4 |

  The format documents that the faster clock's edit wins even over a later edit; it does not say a deletion can be undone the same way, or that a restore can be buried by an older deletion on a faster clock. These match the design, not a bug: every history converged.
- **Fix**: one sentence in that section naming deletions and restores. The product answer (warn when the account's devices differ by more than the tolerance; the engine already measures `clock`) is a question below.
- **Confidence**: High on the counts; the doc gap is by comparison with the text.

##### SY9b-4 · Low · reliability · NEW
**A refusal the engine does not know ends in `error`, is retried on a timer for ever, and is shown only as one line: no dot, no notice, no way out.**

- **Where**: `desk-sync-engine.mjs` `request()` (the last line throws `Refused(word)`), `run()` (publishes `state: "error"` with `reason`), `desk-sync-status.mjs` (`NEEDS_READER` has no `error`; its default says "Sync ran into a problem and will try again"), `connector.js` (`retryDelay`).
- **What happens**: of the service's words, these have a reader-visible stop: `sign_in` (signedOut), `slow_down` (slowed, waits the service's `retry`), `gone` and `not_found` for the keyring (removed), `no_notebook` (otherNotebook), `wrong_proof` and keyring or key failures (cantOpen), and `not_open` or `old_key` (a catch-up, then `error` only if it repeats). Everything else the service can say to a request this client makes (`too_large`, `bad_request`, `too_many`, `not_allowed`, `busy` after its retries, `error`, a non-JSON answer as `unreadable`) becomes `error`, which the connector retries from 5 s doubling to 5 minutes, without end. For a transient fault that is right; for a persistent one (a request the service always refuses) the reader sees the same line for days, `failures` grows, and nothing says "tell us."
- **Hostile or damaged rows do not cause this**: `poison.mjs` seals ten kinds of bad record (no kind, unknown kind, mismatched id, object body, trash with no `deletedId`, trash with a string record, bookmark nulls, year 275760, chapter 9999 and row-id mismatch) and plants them where a device pulls them. Every one is read as "skip", every pass ends `upToDate`, and a second device still receives the good notes. (A number for `modified` cannot be sealed at all: the seal refuses it.)
- **Fix**: after N consecutive failures with the same `reason` (say 5, about 10 minutes), put `error` in a reader-visible state like `needsReader`: a quiet notice with the reason word and a "Sync now" button, still retrying behind it.
- **Confidence**: High (code and states traced; a persistent whole-request refusal was not reproduced against the real service).

##### SY9b-5 · Low · efficiency · NEW
**In a visible tab the 60 s poll ends every backoff early: after a failure the next attempt comes within 60 s whatever the backoff or a `slow_down` says.**

- **Where**: `src/scripts/desk/sync/connector.js`: the poll (`POLL_MS`) calls `fire()`, which runs a pass and clears the retry timer.
- **What happens**: the engine's wait after a failure doubles from 5 s to 5 minutes, and `slow_down` carries a `retry` up to 3600 s. The poll fires at 60 s regardless, so the longer waits never apply to a visible tab. A service that says "slow down for 10 minutes" is asked again within a minute.
- **Fix**: let `fire()` from the poll respect a pending retry (`if (retryAt && now < retryAt) return`), and keep the user's "Sync now" immediate.
- **Confidence**: Medium (by reading the timers; not driven with fake timers).

### Improvements

- Adding the three tests in SY9b-1 raises the caught share from 40 of 51 to at least 43 of 51 without new fixtures; the remaining ones are efficiency or near-equivalent.
- `mutate.mjs` takes an id list (`node mutate.mjs D6,E7`), so the survivors can be rerun after a test is added; the whole run takes about 25 minutes with three workers.
- A `stopped` flag (SY9b-2) also lets the engine skip the "counting what is owed" step it does after a failure once it is stopped.

### Questions for the owner

- Should the stop notice's "Stop syncing" end the device's service session first (`signOutDevice`), as Sign out does? That removes the push-after-stop window at its source; the flag in SY9b-2 closes the rest.
- A faster clock beats a later edit by design. Is a one-line warning on the account page ("this device's clock is more than an hour from the service's") worth adding, since the engine already measures the offset? My pick: yes, quiet and only above the 5 minute tolerance.
- After how many failed passes in a row should `error` ask the reader to act (SY9b-4)? My pick: 5.

### What held up

- **Clocks**: 4,000 histories (400 for each of 10 configurations, two modes: clocks equalized before the final settle, and offsets left in place), 40 steps interleaved with partial syncs and lost answers. All 4,000 converged, all ended `upToDate` with pending 0, none made a push in the three extra passes after convergence (no ping-pong), and no record vanished. The exact-tie rule (`SERVICE_WINS_TIE`) never produced a diverging pair, and mutation D1 (flipping it) is caught by three tests.
- **Mutations**: 40 of 51 caught, including every rule-4 evidence change (D5, D20), the damper (D2, D3), clamp and hold changes (D4, D7, D8, D11, D23), rule 5 and 6 (D9, D10), ordering and batching (D13, D14, D15), the stuck copy (D12), cursor jumps (E6, E8), and the audit on a restored service (E5, E24). Several are caught by two or more tests, one (D17) by 21.
- **Key changes against a pass** (`race.mjs` S4): a device changed the key while another's push was sealed and waiting. No old-key row was accepted (`rows.js` rejects a `kid` other than the current), the pass got `old_key`, caught up, and ended `upToDate` with every service row on `kid` 2.
- **Adopt** (S5): `adoptHere` waits for the running pass before `engine.adopt`; the status ended `upToDate`.
- **Service ends the session** (S3): the status goes to `signedOut` with one notice bar; leaving removes it.
- **Hostile rows**: see SY9b-4; ten kinds, none wedges a pass.
- **Every engine state has words**: signedOut, removed, otherNotebook, cantOpen, slowed, offline, error, upToDate, syncing, and the connector's noKeys; `NEEDS_READER` holds signedOut, removed, otherNotebook, cantOpen, and noKeys, and the connector's `fire()` skips sending for those. Whole-request limits do not trip: `BODY_BUDGET` 4,000,000 is under 4 MiB and ids are ASCII.

### Not reached

- The connector's tests were not run against the mutants: the mirror reaches `src/scripts/` by a junction, which Node resolves to the real files, so the connector used the unmutated engine. The four engine and rules files were run. Mutations of `connector.js`, `start.js`, and `sync-db.js` were not made.
- No fuzz run against `real-notebook-service.mjs`; all 4,000 histories used the fake service. SY9-2's differences (no `slow_down`, no `busy` retry) still apply to the clock results.
- SY9b-4's persistent whole-request refusal was not reproduced, and SY9b-5 was not driven with fake timers.
- Whether `unlink` should refuse a reopened `sync-db` handle, and what a relink reads from the leftover state in SY9b-2, was read, not run.
- SY9-1 (the scan clearing `touched` first) was not re-run here.

## Appendix E: The account pages: use and accessibility (`AC9`, Sonnet)

Slice: the account pages, the header's account entry, the sync status line and notices, `desk-account-words.mjs`, `desk-sync-status.mjs`, and their styles. Commit `3ef75d8e`, read-only. Driver: `AC9\walk1.mjs` (happy-dom harness, imports the test helpers by absolute path). `node --test test/desk-account-page.test.js test/desk-account-words.test.js` passes (43 tests).

### Summary

No security items and nothing URGENT (security belongs to another auditor). 0 Critical, 0 High, 3 Medium, 5 Low, 2 Nit. The recurring theme is feedback: the account home rebuilds itself after every action, so a screen reader hears nothing about the result and focus lands on a hidden heading, and the confirmation boxes for destructive steps have no accessible name. The copy tests are good for `desk-account-words.mjs` but do not sweep `desk-sync-status.mjs` or sentences built inside the page scripts.

### Findings

##### AC9-1 · Medium · a11y · NEW
**The "Are you sure" box for deleting an account, removing a device, and signing out is an unnamed group, and focus goes to the destructive button, so a screen-reader reader hears only the button.**

- **Where**: `src/scripts/desk/account/ui.js` `confirmBox` (a `div role="group"` holding a `<p>`, no `aria-label` or `aria-describedby`); callers focus its first button.
- **What happens**: Press "Delete account…" and focus moves to "Delete my account"; press "Sign out" and focus moves to "Sign out of this computer". The question ("Signing out stops syncing on this computer…") is a sibling paragraph that is not read on focus. A keyboard or screen-reader reader lands on a destructive button with no stated consequence. There is no Escape to cancel.
- **Evidence**: `walk1.mjs` output: after the delete press, `activeElement` is `BUTTON.account__button--danger "Delete my account"`; the group's `role`, `aria-label`, `aria-labelledby`, and `aria-describedby` print as `group null null null`.
- **Why it isn't a false positive**: A role=group with no name is not announced as a region of its own; no `aria-describedby` is set anywhere on these buttons (grep of `src/scripts/desk/account/*.js`). WCAG 3.3.2 (fetched from https://www.w3.org/TR/WCAG22/): "Labels or instructions are provided when content requires user input." The instruction exists but is not programmatically tied to the control.
- **Fix**: Give the box `aria-labelledby` to its paragraph and put `aria-describedby` on the focused button, or focus the paragraph (`tabindex=-1`) first. Escape could cancel. Medium effort, no owner decision.
- **Confidence**: High for focus and names (run); Medium for how each screen reader voices an unnamed group.

##### AC9-2 · Medium · a11y · NEW
**After most account actions the home is rebuilt, focus drops to a visually hidden heading, and the result is not in a live region.**

- **Where**: `notebook.js` `again()` callers (rename around 799 to 801, remove, key change, cancel request); `ui.js` `note` is a plain `<p class="account__note">`.
- **What happens**: After renaming the computer, the row text changes but nothing is said, and focus goes to the `sr-only` "Your account" heading, so a keyboard reader loses their place in a long page (devices, ways, recovery, stop, delete) and must walk down again.
- **Evidence**: `walk1.mjs`: before rename focus is the name input; after Save, `focus: H2.account__title sr-only "Your account"`, `alert:` and `status:` both empty.
- **Why it isn't a false positive**: The `role=status` line exists in `ui.js` (line 48) but the rename path never writes to it. WCAG 4.1.3 (fetched): status messages "can be programmatically determined through role or properties such that they can be presented to the user." WCAG 2.4.3: "focusable components receive focus in an order that preserves meaning and operability."
- **Fix**: Redraw only the changed section, or return focus to the invoking row's button (or its replacement), and write results to the `role=status` line. Note the Sync status line is a good model.
- **Confidence**: High for rename; the same `again()` shape appears for the other actions (read, not run each).

##### AC9-3 · Medium · usability · NEW · 4j?
**Signing out on a one-device notebook can cut the reader off from sync, and the sign-out sentence does not say how to get back.**

- **Where**: `desk-account-words.mjs:147` (`signOutLinked`); `desk-account.mjs:649` `signOutDevice` (a DELETE of this device).
- **What happens**: "Signing out stops syncing on this computer and takes it off your notebook’s devices. Your notebook stays in this browser." A reader whose key lives "on this device only" who signs out no longer holds an enrolled device; getting back needs the recovery code. The sentence reassures about the local notebook but never mentions the recovery code, and a reader who skipped saving it has no route.
- **Evidence**: Wording above; the home's own text for "This device only" says a new device joins "by approval or with your recovery code."
- **Why it isn't a false positive**: The local data is safe (stated); the risk is losing the synced copy's reachability, not data. It is a usability gap rather than loss.
- **Fix**: Add a clause for a "This device only" reader: "To sync again you will need another device or your recovery code." BVJ's call on wording.
- **Confidence**: Medium (I did not run sign-out end to end).

##### AC9-4 · Low · a11y · NEW
**The reason the "Follows my account" choice is unavailable is not tied to the disabled radio.**

- **Where**: `notebook.js:316-324` (`choice`, `off`).
- **What happens**: The radio is disabled (not focusable) and its `followOff` hint is a sibling `<p>`; `aria-describedby` is null.
- **Evidence**: `walk1.mjs`: `[ 'account-key-account', true, null ]`.
- **Why it isn't a false positive**: A disabled control is skipped by Tab; only browse mode finds the hint. The repo's own rule for menus is that a disabled item's reason is described (`src/scripts/CLAUDE.md`, `describeUnavailable`).
- **Fix**: `aria-describedby` on the radio to the hint's id (works in browse and forms mode).
- **Confidence**: High.

##### AC9-5 · Low · a11y · NEW
**Two passkeys give two buttons with the same name ("Remove Passkey").**

- **Where**: `notebook.js:925` (`${WORDS.remove} ${wayWords(way.kind)}`).
- **What happens**: A reader with two passkeys hears two identical buttons; the date text that tells them apart is not in the name.
- **Evidence**: Code read; the device rows use the device's name and are fine (`:808`).
- **Why it isn't a false positive**: The visible row text differs, but WCAG 2.5.3 label in name is satisfied only for the visible "Remove"; the accessible name is still ambiguous when two rows exist.
- **Fix**: Add the row's date (or "first," "second") to the name.
- **Confidence**: Medium (whether a reader can hold two passkeys here was not checked).

##### AC9-6 · Low · usability · NEW
**The printed recovery code is set in a serif, not the code's monospace.**

- **Where**: `src/styles/print.css:77-80` (`html:not([data-font]) body * { font-family: Crimson Text … !important }` inside `@media print`) against `account.css:227` (monospace, no `!important`) and the `data-account-print="code"` block at `account.css:362`, which sets only border and size.
- **What happens**: The one sheet a reader keeps for years prints in Crimson Text. Crockford base32 removes I, L, O, and U, but a serif still makes 0, 5, S and 8 harder to tell at a glance.
- **Evidence**: Specificity read: `!important` wins over the account rule. Not printed (no real print here).
- **Why it isn't a false positive**: No `!important` mono rule exists for `.account__code` in print (grep of both files).
- **Fix**: In `account.css`'s print block, `font-family: ui-monospace, … !important` on `.account__code`. Then print once to confirm.
- **Confidence**: Medium (CSS read, not printed).

##### AC9-7 · Low · usability · NEW · 4j?
**The recovery code's groups are not numbered where it is shown, but the check asks for "Group 4" and "Group 6."**

- **Where**: `notebook.js` `showCode`/`codeFigure`; `desk-account-words.mjs` `codeGroupLabel`.
- **What happens**: The code appears as `BGKH-CHGV-MKYA-DEKP-25A8-853S`; the check asks for "Group 4" and "Group 6", so the reader must count. Handwritten copies may drop hyphens.
- **Evidence**: `walk1.mjs`: code text and check labels.
- **Why it isn't a false positive**: Counting is easy for most readers; this is polish, and the check does reach the right result, but a "Show the code again" retry exists, so it is Low.
- **Fix**: Show small numbers under each group (or name the groups "first… sixth").
- **Confidence**: High.

##### AC9-8 · Low · copy · NEW · 4j?
**Internal words reach readers: "the preview’s sign-in," "key," "holder," "entries."**

- **Where**: `desk-account-words.mjs:90, 94`; `desk-sync-status.mjs:70, 145-159` ("N entries couldn’t be sent to your account", "written by a newer version of LIT Bible").
- **What happens**: A reader meets "the preview’s sign-in" with no explanation of what it is, and "entries" where the rest of the page says "notes" or "changes."
- **Evidence**: Quoted lines above.
- **Why it isn't a false positive**: The desk preview has one user today, so reach is small; it matters when the preview widens.
- **Fix**: Words for BVJ; plainer: "this preview’s sign-in" described once, and "changes" for entries.
- **Confidence**: Medium.

##### AC9-9 · Low · tests · NEW
**The convention test sweeps `desk-account-words.mjs` only; `desk-sync-status.mjs` and the sentences built inside the page scripts are never checked.**

- **Where**: `test/desk-account-words.test.js:53-66` (imports only the words module); `src/lib/desk-sync-status.mjs` (`statusWords`, `STOPPED_WORDS`, `WAITING_WORDS`, `NEWS_WORDS`, `waitingSentence`).
- **What happens**: The no-em-dash, curly-quote, punctuation-inside-quote, and British-spelling checks cover about 150 sentences but not the sync words.
- **Evidence**: A grep for those exports in `test/` finds them only in the notice tests, which compare strings, not conventions. A hand grep of the sync-status file and account scripts found no violation today (no em dash, straight quote, or British spelling).
- **Why it isn't a false positive**: The current text is clean; the gap is the missing guard.
- **Fix**: Add the sync words to `everySentence()`. Also, `waitingSentence` (sync-status) duplicates `waitingWords` (account-words); one should call the other so they cannot drift.
- **Confidence**: High.

##### AC9-10 · Nit · ui · NEW
**The status dot disappears on hover of the header account button.**

- **Where**: `global.css` `.site-header__account-btn:hover` (green fill) vs the 8px `--green-text` dot in `desk-sync.css`.
- **What happens**: Green on green; the dot is invisible while the pointer rests on the button.
- **Evidence**: CSS read; not seen in a browser.
- **Why it isn't a false positive**: The dot also has `aria-description`, so no information is lost for screen readers.
- **Fix**: Give the dot a ring or switch its color on hover.
- **Confidence**: Medium.

##### AC9-11 · Nit · copy · NEW
**The stop sentence appears twice on the account home** (the stop group and the Sync status line), plus the `sr-only` say.

- **Where**: `notebook.js` `stopPart`; `status-line.js`.
- **Evidence**: Code read; not run.
- **Fix**: Show it once.
- **Confidence**: Low.

### Improvements

- The Join screen's "Waiting for the other device…" (`account__wait`, `notebook.js:553, 563, 858`) is a plain paragraph; making it `role=status` would let a screen reader know the page is waiting, and a timeout line should be live too.
- `unknownDevice` ("A device this computer can’t read. It is removed the next time the key changes.") has no Remove button; a reader cannot act on it.
- `/delete-account/` needs a passkey sign-in; a reader who lost the passkey is told only to write to app support, while the page says staff cannot delete accounts. Wording is for BDR and BVJ.

### Questions for the owner

1. After an action, should focus return to the row's control, or to the top of the home? Case for the control: keeps place on a long page. Case for the heading: simple and predictable after a full rebuild. My pick: return to the control and say the result in the status line.
2. Should the sign-out sentence mention the recovery code? Case for: honest about getting back. Case against: more words on a short sentence. My pick: yes, only when the key is "This device only."

### What held up

- `header-entry.js`: disclosure menu with `aria-expanded`, `aria-controls`, arrows, Home, End, Escape, and close on focusout; the button has an `sr-only` name; under 760px "Account" moves to the phone menu.
- Screen changes give the screen's title focus (`ui.js` `screens()`), skipping the first two screens; `role=alert` and `role=status` sit above the body. The wrong-code check puts the alert text in `role=alert` (`walk1.mjs`: "That doesn’t match the code…").
- Join and recovery entry allow paste, and a QR alternative exists for the approval code, so WCAG 3.3.8 (fetched, "is not required for any step in an authentication process unless that step provides at least one of the following") looks met; the setup check is not authentication.
- Theme tokens: every custom property used in `account.css`, `v2/account.css`, and `desk-sync.css` exists in `global.css` or `v2/base.css`; text columns use `--ch`; focus rings use `--focus-ring`; no `ch` unit. No dark selectors are needed because only theme-aware tokens are used.
- Copy: no em dash, straight quote, or British spelling in the words module or the sync-status file (swept by test and by grep).
- 43 existing tests pass.

### Not reached

- Contrast of the dot (3:1), disabled states (opacity 0.55 and 0.6), hint and placeholder colors: needs a real browser.
- The header at 760px, 1100px, 1400px, and with OpenDyslexic and Atkinson; 200% and 400% zoom at 320 CSS px; forced colors (the dot uses Highlight); reduced motion.
- How real screen readers voice `aria-description` on the dot and the unnamed confirm group.
- The Turnstile widget on sign-in, the print output of the recovery code, and the phone basics on a real phone.
- WCAG 2.4.11, 2.5.8, and 3.3.7 were not individually checked (no pointer-size or redundant-entry measurement); the quoted criteria are from the fetched WCAG 2.2 page.

## Appendix F: The live pass in Chrome (`LV9`, Sonnet)

Commit `3ef75d8e`, production `dist/` at `http://localhost:4321` (a Node static server, so `_headers` and the CSP were not exercised), `wrangler dev --env preview` on 8787 with a local D1. Headless Chrome 158 over CDP, one browser context per device (A to F), each with a virtual authenticator (PRF on). Local Turnstile used Cloudflare's published always-pass test keys (https://developers.cloudflare.com/turnstile/troubleshooting/testing/); `wrangler dev` started without trouble and the check did not block account creation (no blocker to record). No deployed host was contacted (the four URL patterns were blocked in every context). No secret was found; nothing URGENT.

### Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 3 (all confirm AC9 findings) |
| Low | 7 |
| Nit | 3 |

Part 3 (header at 760 to 1920 px, 6 combinations, 59 widths each) found no overlap, clipping, or horizontal scroll. Part 2 contrast, forced colors, reduced motion, dark mode, and 320 px all passed.

### Findings

##### LV9-1 · Medium · a11y · KNOWN (AC9-1, confirmed live)
**The "Delete my account" confirm takes focus on the destructive button, and its group has no name.**
- **Where**: `confirmBox` in `src/scripts/desk/account/ui.js`; seen on `/account/` ("Delete my account", "Remove" a device, "Sign out").
- **What happens**: Focus lands on the danger button (`BUTTON.account__button--danger "Delete my account"`). The AX tree shows the confirm group with no accessible name, and `aria-describedby` is null, so a screen reader user hears only the button's name, not "This deletes your account ... It can't be undone."
- **Evidence**: `document.activeElement` after "Delete account…" and after Remove (screenshots `30-D-remove-confirm.png`, `43-B-delete-confirm.png`); `ax-account-home.txt`. I did not test Escape.
- **Why it isn't a false positive**: Read live from the AX tree, not from source.
- **Fix**: Focus the explanatory text or Cancel; give the group a name; point `aria-describedby` at the warning.
- **Confidence**: High.

##### LV9-2 · Medium · a11y · KNOWN (AC9-2, confirmed live)
**After Rename, Remove, and Cancel the request, focus drops to a screen-reader-only H2, with no spoken result.**
- **Where**: `/account/` after each of those actions.
- **What happens**: `activeElement` is the visually hidden section heading. Nothing announces "Renamed" or "Removed"; the page text changes but no live region speaks it reliably (six or more `role=status` and `role=alert` nodes exist, and the sr-only sync copy lagged the visible one: 8:48 vs 8:49 PM).
- **Evidence**: `activeElement` dumps; screenshots `29-D-renamed.png`, `31-D-after-remove-B.png`, `47-A-canceled.png`.
- **Why it isn't a false positive**: Observed in the browser each time.
- **Fix**: Return focus to the control that made the change (or the next one) and speak the result in one polite live region.
- **Confidence**: High.

##### LV9-3 · Medium · usability · KNOWN (AC9-3, confirmed live) · 4j?
**A device-only account that signs out and then signs in by passkey needs the recovery code, and the sentence does not say so.**
- **Where**: Device E (a single-device, device-only account): sign out, then "Sign in with a passkey" (`48-E-device-only-code.png`, `50-E-signin-after-signout.png`).
- **What happens**: The passkey signs in but cannot open the notebook; the next screen asks for the recovery code while the earlier copy talks about "your passkey." A reader who never saved the code is stranded without being warned beforehand.
- **Evidence**: The flow above, repeated.
- **Fix**: Say it at the choice ("this device only: signing in on a new device needs your recovery code") and again at sign out.
- **Confidence**: High.

##### LV9-4 · Low · a11y · NEW
**After "Approve from another device" the focus stays on the page heading while a code and QR appear.**
- **Where**: Add a device, "Show a code for the new device instead" (`15-B-approval-code.png`, `16-A-add-device.png`).
- **What happens**: The code and QR are new content below the fold of the focus; rule 18 (a screen's heading takes focus) is not met for this in-page step, and nothing announces the code.
- **Fix**: Focus the code's heading or announce it politely.
- **Confidence**: Medium.

##### LV9-5 · Low · usability · NEW
**Devices share the default name and the same "Remove" button name.**
- **Where**: Devices list and the add-device confirm.
- **What happens**: Two or more "A browser on Windows" rows, each with a button named just "Remove" (the AX name has no device name). The add-device confirm names the new device exactly as this computer.
- **Evidence**: `ax-account-home.txt`; `17-A-after-approve.png`.
- **Fix**: `aria-label="Remove Device C"`; suffix a default name with a number.
- **Confidence**: High.

##### LV9-6 · Low · copy · NEW
**The removed device's first message is misleading.**
- **Where**: Device B after A removed it (`32-B-after-removed.png`, `33-B-sign-in-again.png`).
- **What happens**: First it says changes "will sync after you sign in again"; the later, true message is that the device "was removed from your notebook's devices." Signing in again does not resume syncing without joining again.
- **Fix**: Show only the second sentence.
- **Confidence**: Medium.

##### LV9-7 · Low · copy · NEW
**The same "stopped" sentence appears three times on one page.**
- **Where**: `/account/` when sync is stopped: the sync card, a status line, and a notice repeat it.
- **Fix**: Keep one visible, keep the sr-only copy in step with it.
- **Confidence**: Medium.

##### LV9-8 · Low · copy · NEW
**`/notebook/` says "It never leaves this computer unless you back it up" while the notebook is synced.**
- **Where**: `/notebook/` while signed in with sync on.
- **Fix**: Make the line depend on the sync state (this is a plain untruth for synced readers).
- **Confidence**: High.

##### LV9-9 · Low · usability · NEW
**A rename is lost on sign out and in.**
- **Where**: D renamed to "Test laptop D", then sign out and in: it shows the default name again on this device's list entry in one view.
- **What happens**: By design it may be per session, but it surprises. I saw the Devices list carry "Test laptop D" afterward in A's list, so the loss is local display only.
- **Confidence**: Low.

##### LV9-10 · Low · logging · NEW
**A wrong recovery code and a stale counter are logged with `console.error`.**
- **Where**: `AccountStop wrongCode`, `AccountRefusal passkey_refused` in the console.
- **What happens**: Ordinary user mistakes show as errors; `console.error` on a refused passkey includes the stack. Harmless, noisy for anyone testing and for error trackers.
- **Fix**: `console.debug` for expected refusals.
- **Confidence**: Medium.

##### LV9-11 · Nit · a11y · KNOWN (AC9-4, partly)
**The "Follows my account" radio's hint is not described.**
- I read the source rule but could not reach the disabled state live (it needs an authenticator without PRF; mine all had it). Not confirmed, not refuted.

##### LV9-12 · Nit · ui · NEW
**The header account menu overlaps the Notebook tab, and the "Account" tooltip shows over the menu edge.**
- **Where**: `51-menu-open.png`. Cosmetic; the menu is a popup, so overlap is expected, but the tooltip should be suppressed while the menu is open.

##### LV9-13 · Nit · ui · NEW
**About 37 px of extra blank space above the first rule on the home page.**
- Looks like a first-section margin. Low value.

### Improvements

- The dot is green for a deletion request, the same as "in sync." Consider a different color or shape so the one thing that needs attention does not look like the good state (contrast itself is fine: dot against its button above 3:1).
- Turnstile logs `Cannot find Widget ... consider using turnstile.remove()` after a sign-in screen is replaced; call `turnstile.remove()` when leaving the screen.
- One shared live region for results (see LV9-2) would also take care of LV9-4.

### Questions for the owner

1. Should a device-only account be allowed to use "Sign in with a passkey" at all after sign out, given it cannot open the notebook without the code?
2. Is losing a device's chosen name at sign out intended?

### What held up

- **Flows end to end, all worked**: account created under both key choices; the recovery code shown and two groups typed back (paste accepted); a note made in the Notebook synced to B; a second device joined by approval code, by the QR link address (the `#a=` fragment is stripped after use), and by recovery code; rename; remove (with the key changing); "Stop syncing on this computer"; a new recovery code; sign out and back in; a deletion request made from B, seen as a bar and dot on `/john-3/` (once per request, did not auto-close), canceled; `/delete-account/`'s box; and A's account deleted (header returned to "Sign in", the notebook stayed in the browser).
- **Keyboard**: the header menu (Tab, Enter, Escape, arrows) works with focus returned to the button.
- **Forced colors**: the dot, buttons, and focus rings are all visible (`53-forced-john3.png`, `54-forced-focus-account-btn.png`).
- **Contrast** (4 combos: light, dark by OS, `data-theme` light and dark): account page text at least 4.97:1; the notice text 14.77:1 to 15.35:1; "Review" 6.62:1 (white on #0F6B33); focus ring `2px solid #0F6B33` (`59-primary-focus-ring.png`). No failure.
- **Reduced motion**: with `prefers-reduced-motion: reduce`, no element on the account page or a chapter animates or transitions (149 did without it).
- **400% zoom (320 px)**: `/account/` and `/john-3/` have `scrollWidth` 305 against 320, no horizontal scrolling (the off-canvas menu is the only thing past the edge).
- **Header sweep** (760 to 1920 in 20 px steps; `/`, `/john-3/`, `/about/`; "Sign in" and the account button): header height 80 px throughout, no overlap of title, nav, or tools, no page-wide horizontal scroll. The long title swaps to "LIT Bible" at the first step above the documented thresholds: with "Sign in" at 1220 on `/` and a chapter and 1280 on `/about/`; with the button at 1200 and 1240. That matches the 1215/1260 and 1180/1225 measurements in the docs.
- The local Turnstile test keys worked with `wrangler dev`.

### Not reached

- AC9-10 (the dot on hover): the account was deleted before I got to the hover check; not confirmed or refuted.
- AC9-5 to AC9-9 and AC9-11 beyond what the flows above incidentally touched: not specifically tested.
- A real screen reader (only the AX tree), the CSP (the static server sends no `_headers`), printing, and the Turnstile widget against a live site key.
- Raw data: `sweep.json`, `contrast-*.json`, `ax-account-home.txt`, and the screenshots in `scratchpad/audit9/LV9/`.

## Appendix G: Legality, privacy, and the stores (`LP9`, Sonnet)

**This is not legal advice.** I am not a lawyer. Each legal question below names what a lawyer should look at. Standards were fetched on 2026-11-25 and are cited by URL; where I name a law (GDPR, CCPA, COPPA) I did not fetch its text, so those parts are from memory and marked so.

### Summary

Ten findings and several smaller notes: High 1, Medium 6, Low 3, Nit 0. The one High is that `/privacy` still describes a world with no notebook service: it says the apps keep everything on the device and collect no identifiers, while the service now holds account ids, passkey ids, device ids, timestamps and sealed notebooks in a Cloudflare D1 database. Step 4j is written to fix most of what follows, so nearly every finding is tagged `4j?`. What held up is notable: deletion is complete and tested (every table cascades from `accounts`, Apple tokens are revoked first), the CSP report Worker keeps exactly what the privacy page says, the storage-key list on the page matches the code (`test/desk-storage-keys.test.js`, 6 of 6 pass), no new runtime npm package ships, and the link files assert only what the passkey and universal-link design needs.

### Findings

##### LP9-1 · High · legal · NEW · 4j?
**`/privacy` says nothing about the notebook service, and two of its sentences become untrue when the apps sync.**

- **Where**: `src/pages/privacy.astro` (the "App (on both platforms)" paragraph; "Your reading data (app)"; "Content updates (app)"; the page's `description` and JSON-LD `description`), against `workers/notebook-service/migrations/0001_notebook.sql`, `0002_sign_in.sql`, `0003_account_work.sql`.
- **What happens**: the page says "The app does not collect your name, email address, device identifiers, or identifying information," "Everything you create in the app ... is stored privately on your device. The LIT Bible team cannot access this data," and the meta description says the apps "keep everything you create on your device." Once an app syncs, the service holds, in the clear: the account id; each provider's account id (`ways.subject`, Apple or Google `sub`); each passkey's credential id, public key and counter (`ways.public`, `count`); the account's WebAuthn user handle; each device's id (a UUID the device makes: a device identifier) with when it was added, how, and last seen; session rows with times and which way in; each row's id, `modified`, `deletedAt`, `rev` and padded size; a waiting request with platform and the kind of way in; and Apple's refresh token. During an approval it also holds the new device's `model` and `platform` (`approvals`). The sealed notebook itself is on LIT's servers. "The LIT Bible team cannot access this data" is true of content only; "does not collect device identifiers" is not true of the device ids. Nothing on the page says where the data is kept (D1; the preview's is western North America per `workers/notebook-service/README.md` line 841), how long, who the processors are, or how to delete it.
- **Evidence**: read `privacy.astro` whole; read all three migrations column by column; `git diff fbcd83c0 3ef75d8e -- src/pages/privacy.astro` shows the only additions were the key list, a paragraph about the browser's `lit-desk-sync` database, and the Security reports paragraph. Not one word on the service, accounts, or deletion. `STUDY-DESK.md` step 4j says the account section "comes from the spec's What the service holds."
- **Why it isn't a false positive**: accounts are closed to every reader today (so no one is misled right now except by the paragraphs about the browser database), but Apple's 5.1.1(i) requires the policy to "identify what data is collected, how, and all uses" and to "explain retention/deletion" (https://developer.apple.com/app-store/review/guidelines/, 5.1.1(i)), and Google's account-deletion rule expects retention practices to be disclosed in the policy (https://support.google.com/googleplay/android-developer/answer/13327111, "Data scope and retention"). An app that creates accounts cannot be submitted against this page.
- **Fix**: 4j's account section should list the table above in plain words (including device ids, timestamps, model and platform during an approval, and that the sealed notebook sits on LIT's servers), and rewrite the two app sentences to say "cannot read" rather than "cannot access" and to exclude the identifiers the service keeps. Update the meta and JSON-LD descriptions too. A lawyer should read the final text against the lists above.
- **Confidence**: High.

##### LP9-2 · Medium · legal · NEW · 4j?
**The page's effective date and `dateModified` were not moved by five changes to what it says.**

- **Where**: `src/pages/privacy.astro` ("Effective date: October 13, 2026"; JSON-LD `"dateModified": "2026-10-13"`; the "Changes to this policy" section).
- **What happens**: the page was edited by #698 (2026-11-24), #702, #703, #710 and #711 (2026-11-25; `git log -- src/pages/privacy.astro`), including a new data-handling paragraph on security reports that the site began collecting on 2026-11-25. Its own "Changes to this policy" section promises "updating the effective date above" for changes that materially affect data handling. The date still reads October 13.
- **Evidence**: `git log --format='%h %ad' -- src/pages/privacy.astro` lists those commits; the date lines are unchanged in the diff.
- **Why it isn't a false positive**: the security-reports paragraph is a material new collection (a page, rule and browser family, kept 30 days), so the page's own rule applies.
- **Fix**: set the date when 4j lands, and keep a short dated "what changed" line. A lawyer should say whether a notice of change is expected anywhere else (the apps' Translation Updates section, per the page).
- **Confidence**: High.

##### LP9-3 · Medium · privacy · NEW · 4j?
**Turnstile on the new-account step is not disclosed, and the page says more for Turnstile than Cloudflare does.**

- **Where**: `src/pages/privacy.astro` (the Turnstile paragraph names "the contact and subscribe forms" only); `src/scripts/desk/account/turnstile.js` (loads `https://challenges.cloudflare.com/turnstile/v0/api.js` when a reader presses "Create an account"); `workers/notebook-service/src/turnstile.js` (passes `cf-connecting-ip` to siteverify as `remoteip`).
- **What happens**: when accounts open, a reader creating one loads a Cloudflare script and frame, and the service sends the reader's IP address to Cloudflare. The page names neither. It also says Turnstile "does not track you across sites." Cloudflare's own Turnstile Privacy Addendum (https://www.cloudflare.com/turnstile-privacy-policy/) says Turnstile processes "client-side signals": client IP address, TLS fingerprint, User-Agent header, and sitekey and origin; that it does so for bot detection as the site's processor, and for improving its detection as Cloudflare's own controller (legitimate interests); and that it does not "directly identify any individuals." It states no retention period, and sends readers to the site operator for questions. The FAQ (https://developers.cloudflare.com/turnstile/frequently-asked-questions/) says it processes "only the data strictly necessary" and does not address disclosure.
- **Evidence**: the three files above; the two Cloudflare pages.
- **Why it isn't a false positive**: no other page text covers the sign-in step.
- **Fix**: name the new-account check, list the four signals in a sentence, and replace "does not track you across sites" with Cloudflare's own wording. Ask a lawyer whether naming Cloudflare as a controller for its own improvement purpose needs more than a link (GDPR transparency, from memory).
- **Confidence**: High on the gap; Medium that a lawyer would require more than a sentence.

##### LP9-4 · Medium · legal · NEW · 4j?
**Nothing on the page says how long an account's data is kept, and the service never deletes an idle or half-made account.**

- **Where**: `workers/notebook-service/src/scheduled.js` (sweeps only `sessions`, `approvals` and `challenges` past `expires`); `migrations/0001_notebook.sql` (`accounts`, `ways`, `devices`, `rows`); `src/pages/privacy.astro`.
- **What happens**: an account, its passkey credential id and public key, its Apple or Google `sub`, its device list with `seen` times, and its sealed rows stay until the reader deletes the account. An account that was created and never given a notebook (`kid` 0) stays forever too. A reader who loses every passkey and the recovery code can't sign in to delete, and has no other route (the delete page says so). Also, the spec says an approval is kept "for at most ten minutes," but its row, with the device's plain `model` and `platform`, lives until the next hourly sweep (up to about seventy minutes), and every deleted row remains in D1 Time Travel (see LP9-5).
- **Evidence**: read `scheduled.js` whole; `grep` for any other `DELETE FROM accounts` finds only the two in `waiting.js`.
- **Why it isn't a false positive**: Apple 5.1.1(i) asks the policy to explain retention; GDPR's storage-limitation principle (Art. 5(1)(e), from memory) would also ask for a stated period or reason.
- **Fix**: say "until you delete the account" in the policy, and decide whether to sweep never-finished accounts (for example, an account with no notebook and no session after 30 days). Say plainly that a reader who has lost every way in cannot be found, because the service keeps no name or email. A lawyer should say whether that is enough under GDPR Art. 11 (processing that doesn't require identification).
- **Confidence**: High on the facts; Medium on the legal weight.

##### LP9-5 · Medium · legal · NEW · 4j?
**Deleted data stays recoverable in D1 Time Travel, which `/delete-account/` discloses and `/privacy` and the spec do not.**

- **Where**: `src/pages/delete-account.astro` ("Backups, for up to 30 days"); `src/pages/privacy.astro` (the security-reports line "The counts are deleted after 30 days"); `STUDY-DESK-ENCRYPTION.md` line 746 ff., "What the service holds" ("Nor anything of a deleted account, not even that there was one"); `workers/csp-reports/src/store.js` (`KEEP_DAYS = 30`).
- **What happens**: Cloudflare's page (https://developers.cloudflare.com/d1/reference/time-travel/) says Time Travel is always on and restores a database "up to 30 days in the past (Workers Paid plan)" or "7 days (Workers Free plan)," overwriting in place; it cannot be turned off. So a deleted account can be restored for up to 30 days, and the CSP counts live up to 30 days longer than the page says (their content is not personal, so the CSP effect is small). The delete page's "up to 30 days" is correct as an upper bound. The spec sentence "not even that there was one" is wrong for those 30 days. `/privacy` is silent.
- **Evidence**: the Cloudflare page; the three files. I did not check which plan the account is on (not reachable without the dashboard).
- **Why it isn't a false positive**: Google requires retention such as backups to be "clearly disclosed, for example in your privacy policy" (answer 13327111, "Data scope and retention"). The delete page does that; the privacy policy, the document the store form links to, does not.
- **Fix**: put one sentence about the 30-day history in `/privacy` (and the apps' labels), fix the spec sentence, and say "up to 30 days" for the CSP counts. A lawyer should look at whether an erasure request under GDPR Art. 17 can wait for a backup to age out (the usual answer is yes if disclosed and the data stays unused; from memory).
- **Confidence**: High.

##### LP9-6 · Medium · legal · NEW · BDR
**The service cannot be answered "no data collected" on either store's form, and the E2EE exemption covers the sealed notebook only.**

- **Where**: the migrations above; Google's Data safety page (https://support.google.com/googleplay/android-developer/answer/10787469).
- **What happens**: Google defines "collect" as "transmitting data from your app off a user's device" and exempts end-to-end encrypted data only if "unreadable by anyone other than the sender and recipient," the developer included. The sealed notebook, cards and keyrings fit that. The plain fields do not: account and provider ids, passkey credential ids, device ids, timestamps, and the device model and platform in an approval or waiting request. Google says pseudonymous data "that can reasonably be linked back to a user" must be disclosed, and that the answers are the developer's responsibility and "not verified" by Google. Apple's equivalent is the privacy label plus 5.1.1(i) (the policy must match). Today's `/privacy` says the apps collect no identifiers, so a form answered from it would be wrong.
- **Evidence**: the pages and migrations above.
- **Why it isn't a false positive**: the spec itself lists those fields as "plain."
- **Fix**: BDR should declare user IDs and device IDs (and approximate usage timestamps) as collected, linked, for app functionality, and treat the notebook as E2E encrypted and not collected; the text in `/privacy` should be the source for both stores. A lawyer should confirm that treating the notebook as "not collected" fits the design, since LIT holds ciphertext, not keys.
- **Confidence**: Medium (I read Google's page; I did not see Apple's label questions, which are in App Store Connect).

##### LP9-7 · Medium · privacy · NEW · 4j?
**The notebook service keeps stored logs on while the CSP Worker turned them off for the very reason that applies here, and the README's "no address reaches a log" is unverified.**

- **Where**: `workers/notebook-service/wrangler.jsonc` (`observability.enabled: true`, `invocation_logs: false`); `workers/csp-reports/wrangler.jsonc` ("Cloudflare's documentation doesn't say what it attaches to a stored log line (read 2026-11-24), so nothing is stored"); `workers/notebook-service/README.md` "What is logged"; `src/index.js` lines 203 to 224.
- **What happens**: the service writes one stored log line per request (time, route pattern, status, refusal word, milliseconds) and one per hourly run. Cloudflare's Workers Logs page (https://developers.cloudflare.com/workers/observability/logs/workers-logs/) says logs are "enriched with information available to Cloudflare in the context of the invocation" and are kept 3 days (Free) or 7 days (Paid); it does not list what the enrichment is. The README says no address reaches a log and relies on turning off the invocation log. That is probably right, but it is not established, and the CSP Worker's author judged the same uncertainty enough to switch logging off. The privacy page says nothing about service logs.
- **Evidence**: the three files and the Cloudflare page. I could not tail the deployed preview (rule 3).
- **Why it isn't a false positive**: no test checks what a stored line carries; `test/config.test.js` holds the CSP Worker's logging off but not this one's content.
- **Fix**: BVJ can either (a) turn stored logs off here too and keep failures to `wrangler tail`, (b) read one stored preview line in the dashboard and record what it carries, or (c) state "time, route and status, kept up to 7 days" on the page. A lawyer needs only (c) plus the answer to (b).
- **Confidence**: Medium: nothing here shows a leak, only an unverified claim.

##### LP9-8 · Low · legal · NEW · 4j?
**No age is stated anywhere, and accounts will collect persistent identifiers from whoever signs up.**

- **Where**: `src/pages/privacy.astro` ("Children": "do not knowingly collect personal information from children"); no page or store text states a minimum age (grep of `src/pages` and `src/content` found none).
- **What happens**: the service issues an account id and a passkey credential id to any visitor who passes Turnstile. COPPA (US, from memory) reaches child-directed services and those with actual knowledge of a child under 13; a Bible translation site is not child-directed, but a stated age and a "we don't knowingly" line are the usual protection. GDPR Art. 8 (from memory) sets 13 to 16 by country where consent is the lawful basis. For the stores, Apple wants honest age-rating answers (2.3.6) and says the 4+ metadata rule applies to metadata (2.3.8); the apps' current rating and whether it was set with accounts in mind were not available to me.
- **Evidence**: the page text; STUDY-DESK.md 4j says the terms "carry a minimum age."
- **Fix**: 4j's terms. A lawyer should choose the age (13 is common in the US, 16 in parts of the EU) and say whether the apps' age ratings need to change with accounts.
- **Confidence**: High that none is stated.

##### LP9-9 · Low · legal · NEW · 4j?
**No controller is named, no lawful basis or rights section exists, and the transfer and processors are not set out.**

- **Where**: `src/pages/privacy.astro` ("the LIT Bible team"; Contact "litbible.net/contact"); the legal entity, the Liberating Scripture Collective (a 501(c)(3), `src/pages/about.astro` line 246), is not named on the page.
- **What happens**: for European readers, GDPR (from memory: Arts. 13, 15 to 22, 28, 44 to 46) asks for a named controller and contact, lawful basis, the rights (access, erasure, portability, objection, complaint), recipients and processors (Cloudflare, Brevo, and Apple or Google when sign-in is on), and the safeguard for transfers outside the EU (Cloudflare and the D1 location are in the US). Whether GDPR applies to a US nonprofit offering accounts worldwide turns on "targeting" and monitoring (Art. 3(2)); I cannot say it does or does not. The page does cover the portability idea in practice (a backup file from the notebook page) and erasure (delete-account), but never says so as rights.
- **Evidence**: the page text.
- **Fix**: 4j; a lawyer should say whether GDPR applies and, if so, what the transfer text needs (standard contractual clauses and the Data Privacy Framework come from Cloudflare's side; from memory).
- **Confidence**: High on the gap; I cannot judge applicability.

##### LP9-10 · Low · legal · NEW
**Nothing ties "Sign in with Google is on" to "Sign in with Apple is on," which Apple's 4.8 would ask for in the iOS app.**

- **Where**: `workers/notebook-service/src/providers.js` (`appleOn` and `googleOn` read separate variables); `src/signin.js` line 48 (the list of ways offered); `workers/notebook-service/test/config.test.js` (checks only that production sets neither).
- **What happens**: Apple 4.8 (https://developer.apple.com/app-store/review/guidelines/): apps using "Google Sign-In" to "set up or authenticate the user's primary account" must also offer an equivalent login that limits data to name and email, lets the user keep the email private, and does not track for advertising. The exceptions are an app that "exclusively uses your company's own account setup and sign-in systems" and four others (alternative marketplace, education or enterprise sign-in, a government ID, a client for a third-party service). A passkey-only app falls under the first exception; the moment Google is added, the first exception is gone and Sign in with Apple, which is built, is what satisfies the rule. Setting `GOOGLE_CLIENT_IDS` without the Apple ones would put an iOS build in breach. I did not see the rule text applied to "Apple plus Google plus passkey," but that combination has the equivalent option.
- **Evidence**: the code paths above.
- **Why it isn't a false positive**: no test or runbook line states the pairing.
- **Fix**: a RUNBOOK note, or a config test that fails if Google is set and Apple is not. BDR decides what the Android app offers.
- **Confidence**: Medium: depends on how reviewers read "primary account" for a notebook sync.

### Smaller notes (not findings)

- **`/delete-account/` against Google's rule** (answer 13327111): it names "LIT Bible, from the Liberating Scripture Collective" (Google asks the app or developer name as on the listing; I could not see the listing, BDR must match them exactly), its deletion path is near the top, and it tells readers what is kept and for how long. It does not yet let anyone ask for deletion without the app: the sign-in box draws only with `?account=preview`, and the page says "Accounts are not open yet." That is KNOWN (README of the service; spec "Still open," 70) and is correct for now. Apple's 5.1.1(v) ("If your app supports account creation, you must also offer account deletion within the app") is met only by BDR's in-app flows, which I did not see.
- **Apple token storage**: 5.1.1(v) says apps "may not store social network credentials or tokens off-device." The service stores Apple's refresh token only to revoke it (`apple_tokens`), and nothing is stored for Google. This is the standard revocation design; BDR should say so to a reviewer if asked.
- **E2EE claims**: `delete-account.astro` ("locked on your devices ... with a key we never have, so we can't read it") is accurate for content. It does not say the service can see timing and activity: each row's `modified`, `deletedAt`, and a size padded to 256 bytes are plain, and record ids are random UUIDs (`src/lib/desk-records.mjs` `newId`), so no verse reference leaks. The words for the first-time choice and "Ways to keep your notebook" (4j) should say "we can't read your notes," not "we can't see anything."
- **US state laws** (from memory): CCPA/CPRA applies to for-profit businesses that clear thresholds (about $25 million revenue, or data on 100,000 or more consumers or households, or half of revenue from selling or sharing data); a 501(c)(3) is not a "business" under it, and other state laws mostly exempt nonprofits or set similar thresholds. I would expect none to apply today, but a lawyer should confirm by state.
- **Cloudflare logs the page already mentions** ("may log basic request data at the network level"): still adequate for the edge.

### Improvements

- Put one table in `/privacy` of what the service holds, in the order of the spec's table, so the page, the stores' labels and the spec can't drift (`test/` could check the column list against the page).
- Say on `/privacy` that Apple's and Google's account ids are personal data the service keeps, and that no name or email is stored.
- Add a short "How to ask us about your data" line: because the service keeps no name or email, a request by email can't be matched; the way is the sign-in on `/delete-account/` (LP9-4).

### Questions for the owner

1. **Retention for never-used accounts.** Case for a sweep (for example, 30 days with no notebook): less to disclose, smaller database. Case against: a reader who starts setup, steps away and returns would lose it. My pick: sweep accounts that have no notebook and no live session after 30 days.
2. **Stored service logs.** Case for off, as the CSP Worker has it: nothing to disclose. Case for on: `wrangler tail` shows only live failures. My pick: read one stored preview line and decide; default to off for production.
3. **Minimum age.** 13, or 16 (the stricter EU line). I would take 13 with a lawyer's say on Europe.

### What held up

- **Deletion is complete**: `DELETE FROM accounts` cascades to `ways`, `sessions`, `devices`, `holders`, `rows`, `approvals`, `challenges` (by account), `apple_tokens` (through `ways`) and `waiting`; `test/waiting.test.js` line 446 checks the cascade. Apple's tokens are revoked first and a failure leaves the account in place. The seven-day wait runs from `waiting.due`, carried out by the hourly cron (up to about an hour late), 100 a run.
- **CSP report Worker keeps what the page says**: `counts` holds day, disposition, rule, blocked place, page path, source and browser family; the address is read only by the rate limiter; query strings, extension ids and the full user agent are dropped (`src/report.js`); stored logging is off (`observability.enabled: false`); the 30-day prune is `KEEP_DAYS`.
- **Storage keys on the page match the code** (6 of 6 tests); the new `lit-desk-sync` database is described value by value, and `sync-db.js` matches (no cookie, no local storage for the token).
- **Licenses**: the root gained no new package (only `simple-icons` 16.38.0 to 16.38.1). The two Workers have three direct dev packages (`wrangler` 4.166.0 MIT OR Apache-2.0, `vitest` 5.1.1 MIT, `@cloudflare/vitest-plugin` 1.9.0 MIT) and neither imports an npm package at run time (checked every `import` in `src/`), so nothing third-party ships. Their dev trees include LGPL-3.0 (`@img/sharp-libvips-*`, optional binaries), MPL-2.0 (`lightningcss`) and CC0, none distributed. `scripts/lib/p256-fixed.mjs` is original arithmetic over published curve constants, test-only. Fixtures: RFC 5869, RFC 4231, Wycheproof (Apache-2.0, `C2SP/wycheproof`), CFRG HPKE test vectors (repo `LICENSE.md`; GitHub reports no SPDX license), and W3C WebAuthn Level 3 section 16 (W3C Document License 2023, notice kept in the file). Low residual: the Wycheproof Apache text and notice are named but not copied in the repo; the HPKE and RFC vectors fall under the IETF Trust's terms, which a lawyer can confirm are fine for test data. Turnstile's own terms for a site were not separately fetchable beyond the addendum and FAQ above.
- **Link files**: `apple-app-site-association` claims only chapter paths and `/glossary` for `9KL9F7A3CR.com.litbible.app`, plus `webcredentials` (so the iOS app may use the site's passkeys); `assetlinks.json` gives `com.litbible.app` two certificate fingerprints with `handle_all_urls` and `get_login_creds`. The same two fingerprints are copied into `PASSKEY_ORIGINS` (a test keeps them equal). Nothing there should surprise a store; one thing to know is that any app signed by either certificate (an upload key, if one of the two is that) is trusted as a passkey origin. `apple-developer-merchantid-domain-association` is Give Lively's Apple Pay file (FIXLIST item), unrelated.

### Not reached

- The deployed services and dashboards: which Cloudflare plan the D1 databases are on (7 or 30 days of Time Travel), what a stored Workers Log line carries, the production D1 region.
- The Play and App Store listings (names, age ratings, privacy labels): BDR holds them.
- The text of GDPR, CCPA/CPRA, COPPA and the other state laws: not fetched, so every statement of them is from memory.
- Apple's guidelines past the first 100,000 characters of the page (4.8 and 5.1.1 were inside what I read).
- The in-app deletion screens, which are BDR's.

## Appendix H: PR #713: the privacy policy, the Terms, and their promises (`LP9b`, Sonnet)

Worktree at `37a7498e`, read-only. **Nothing here is legal advice.** Where a finding turns on a law, it says what a lawyer should look at and nothing more; every legal statement not tied to a page I fetched is from memory. I changed nothing in the repository, contacted no deployed host, and ran only `node --test test/desk-storage-keys.test.js test/csp-reporting.test.js` (13 pass) and `test/desk-first-use-linked.test.js` (11 pass). Scripts are in `…\scratchpad\audit9\LP9b\` (`sweep.py`, `oxford.py`). The orchestrator's `summary-713.txt` shows `npm test`, `check`, and `validate` exiting 0.

### Summary

10 findings: 0 Critical, 0 High, **4 Medium**, **5 Low**, **1 Nit**. Three of the Mediums are gates (false once accounts open); one is a fault today for any reader of `/privacy` (the podcast page's embeds against "nothing tracks you across sites"). Of the 18 earlier 4j items: **5 fixed, 8 partly fixed, 5 open**. The copy sweep over both pages found no violation of the reader-facing rules. Most of the page is accurate to the code; the faults are four sentences that say more than the code or the spec supports.

### Findings

##### LP9b-1 · Medium · privacy · NEW
**`/privacy` says "nothing tracks you across sites" and that the site doesn't track across other sites, but the podcast page frames YouTube, Spotify, and Apple players on load.**

- **Where**: `src/pages/privacy.astro` "In short" (third-party bullet, new in #713) and "Do Not Track" paragraph (in "Your choices"); `src/pages/found-in-translation-podcast.astro:163-206` (`<iframe src="https://www.youtube.com/embed/videoseries?...">`, a Spotify and an Apple iframe, all `loading="lazy"`).
- **What happens**: a reader who scrolls the podcast page makes their browser contact Google, Spotify, and Apple, with whatever cookies or identifiers those embeds set (from memory; YouTube's `youtube-nocookie.com` form avoids this until play, and the page uses plain `www.youtube.com`). The page names them only under "External links," "following these links." The cookie paragraph says the site sets "one cookie of its own," which is true, but the "Do Not Track" sentence ("there is nothing for a browser's Do Not Track signal to turn off") is the kind a CalOPPA-style reader of the page would read as covering embeds.
- **Evidence**: the three greps above; the old page (`git show 3ef75d8e:src/pages/privacy.astro`) had "does not track you across sites" only about Turnstile, so the broad sentence is #713's.
- **Why it isn't a false positive**: the sentence is about the site, and LIT itself does not track; the embeds are others' trackers. But the policy tells the reader there is nothing to turn off, and the embeds are the thing.
- **Fix**: add a sentence naming the embedded players on the podcast page and that those companies may set cookies or identifiers when it loads, or switch YouTube to the no-cookie host and load each on press. A lawyer should read the Do Not Track paragraph against CalOPPA (BVJ's research kept it "anyway").
- **Confidence**: Medium (what each embed sets was not tested; the structure is certain).

##### LP9b-2 · Medium · privacy · NEW · gate
**`/privacy` says Apple's token is "encrypted in our database"; the spec says it is plain to LIT and encrypted only at rest by the platform.**

- **Where**: `privacy.astro` ("With Apple or Google": "we also keep a token Apple issues, encrypted in our database"); `STUDY-DESK-ENCRYPTION.md:751` ("plain to LIT, encrypted at rest," LIT can read it); `workers/notebook-service/src/signin.js:276` (`INSERT ... apple_tokens (way, client, token, created)`, no sealing).
- **What happens**: a reader takes "encrypted in our database" with "locked so that we can't read it" a paragraph later. The token is readable to the service (it must be, to revoke). It "opens nothing in a notebook," so the harm is the sentence, not the data. Rule 2 of `src/pages/CLAUDE.md` says every fact is the service's.
- **Why it isn't a false positive**: D1 encrypts at rest, so the words are literally defensible; they still read as application-level locking beside the page's own use of "locked."
- **Fix**: "kept in our database, where we can read it; it opens nothing in your notebook." Apple is off, so this is a gate.
- **Confidence**: High.

##### LP9b-3 · Medium · privacy · NEW · gate
**The "what the service keeps, and can read" list leaves out the approval's device model and platform, while the page says your devices' names are locked.**

- **Where**: `privacy.astro` ("Locked before it leaves your device": "Your devices' names are locked the same way"; the "What the service keeps" list); `workers/notebook-service/migrations/0001_notebook.sql` (`approvals.platform`, `approvals.model`, plain, `expires` ten minutes); `STUDY-DESK-ENCRYPTION.md:~760` ("The new device's model and platform, nothing else"). Also unlisted: a passkey's signature counter and syncs flag, the account's random handle (spec table line 1).
- **What happens**: while a new device waits for approval (up to ten minutes) the service holds its model (for example a phone model) in the clear. The list is introduced as "what syncing needs" and reads as complete. LP9-6 named these fields; #713 listed most but not this one.
- **Why it isn't a false positive**: the list covers a waiting delete request ("what kind of device") but not the approval row, so the omission is not a different wording of something present.
- **Fix**: add "a device waiting to be approved: its model and platform, for up to ten minutes." The same fields feed BDR's store forms (ask 21), so add the counter and flags there.
- **Confidence**: High.

##### LP9b-4 · Medium · privacy · NEW · gate (carries LP9-7 and SV9-6)
**The page now states flatly that the service's log "says nothing about who asked," but what Cloudflare stores beside a custom log line is still unverified.**

- **Where**: `privacy.astro` ("What we never have": "nothing about who asked"; retention "the service's log lines: up to seven days"); `workers/notebook-service/wrangler.jsonc` (`observability.enabled: true`, `invocation_logs: false`); `src/index.js:203-224`; `STUDY-DESK.md` step 4j "Not verified" (names the seven days only).
- **What happens**: the service's own line holds no id. I fetched Cloudflare's Workers Logs page (https://developers.cloudflare.com/workers/observability/logs/workers-logs/, 2026-11-25): retention is 3 days Free, 7 days Paid, and it "doesn't specify" what a custom log's stored event carries beside what is passed to `console.log` (it says only invocation logs are "enriched"). The CSP Worker stores nothing for exactly this reason. So "nothing about who asked" and the README's "no address reaches a log" are claims about Cloudflare's metadata that nobody has read. The seven days is a Paid figure; "up to" keeps it true on Free (3).
- **Fix**: BVJ opens one stored event in the dashboard and records its fields, then keep the sentence or soften it to "our own line holds nothing about who asked; Cloudflare may add request details, kept the same time." Or turn stored logs off, as the CSP Worker does. 4j's "Not verified" should name this, not only the seven days.
- **Confidence**: Low on a leak, High that the claim is unverified.

##### LP9b-5 · Low · security · NEW · gate
**The page says "Create an account" is Turnstile-protected, but production's config sets no site key by design, and the apps are not checked.**

- **Where**: `privacy.astro` ("The contact and subscribe forms, and 'Create an account,' are protected..."); `workers/notebook-service/wrangler.jsonc` (production has no `TURNSTILE_SITE_KEY`; `secrets.required` only on preview); `test/config.test.js:103` asserts it undefined; `src/turnstile.js` header (only a request with an `Origin` is checked, so a program or an app skips it); Terms "Using the service fairly" ("create accounts by automated means").
- **What happens**: true of the website's box in the preview today. At launch it is true only if BVJ adds the key and secret to production, and it is never true of a request with no `Origin`. The Terms forbid what Turnstile only slows.
- **Fix**: add "make production's Turnstile key and secret" to the launch edits (`account/CLAUDE.md` rule 11 lists words, not config); say "from the website" on the page.
- **Confidence**: High.

##### LP9b-6 · Low · docs · NEW (LP9-5's remainder)
**Two spec sentences still say a deleted account leaves nothing, against the page and the spec's own Time Travel line.**

- **Where**: `STUDY-DESK-ENCRYPTION.md` "What the service holds" ("Nor anything of a deleted account, not even that there was one") and "Deleting the account" ("keeps nothing of a deleted account, not even that there was one"), against `:1243-1246` (Time Travel keeps the rows 30 days) and `privacy.astro`/`delete-account.astro` ("can remain in that history").
- **Fix**: add "for up to 30 days in the database's backup history." Rule 2 of `src/pages/CLAUDE.md` makes the spec the source, so the page and spec now disagree on a fact. #713 touched neither.
- **Confidence**: High.

##### LP9b-7 · Low · legal · NEW
**`/privacy` promises a "what changed" line for 30 days and a note in the apps' What's New, but #713 added neither, and the second is unconfirmed.**

- **Where**: `privacy.astro` "Changes to this policy"; `src/pages/CLAUDE.md` rule 4; `STUDY-DESK-FOR-THE-APPS.md` ask 21.1 ("BDR should confirm"); `terms.astro` "Changes" (no 30 days, says "at the top of this page").
- **What happens**: the rewrite is material by the page's own test, the old page promised the note in "Translation Updates," and the new one promises What's New. Nothing at the top of `/privacy` says what changed, and no app has confirmed it will. The two pages promise different periods.
- **Fix**: a dated "What changed" line on `/privacy` until 2026-12-25 (accounts are closed, so it can be short), or state that the change took effect on first publication; make the Terms say the same period.
- **Confidence**: High (page text); impact small before accounts open.

##### LP9b-8 · Low · privacy · NEW
**"After 30 days only a locked note that it was deleted" depends on a client opening the notebook; the service never drops the copy itself.**

- **Where**: `privacy.astro` retention list ("a deleted record"); `STUDY-DESK-ENCRYPTION.md:863-865` ("Dropping that copy after 30 days ... is the clients' job"); `src/lib/desk-records.mjs:345` (`emptyTrashRecord`, run on merge and store open).
- **What happens**: the service's `rows` keeps the full sealed copy until a device with the key opens, empties, and pushes the tombstone. A reader with every device idle keeps it past 30 days; locked, so low harm, but the sentence is a promise about the service.
- **Fix**: "after 30 days, the first of your devices to open your notebook replaces it with only a locked note that it was deleted."
- **Confidence**: Medium (I did not trace the push of an emptied record through the sync planner).

##### LP9b-9 · Low · legal · NEW
**The Terms make the Collective the party and say the intros, glossary, and articles are under the same license, but the license page is written by an individual and limited to the text and footnotes.**

- **Where**: `terms.astro` "Reading and sharing the LIT"; `src/pages/read.astro:262-290` ("I grant the permissions below ... apply to the LIT text and footnotes as written by the Liberating Scripture Collective"; licensed under CC BY-NC-ND to "Brandon C. Vélez Johnson"); footer license band ("© 2024 by Brandon C. Vélez Johnson").
- **What happens**: the licensor named is a person, the Terms' party is the Collective, and the Terms extend the license to material the license page does not name. They also say "those terms, not these" govern copying, so a gap sits between them.
- **Fix**: for a lawyer (below); a plain fix is to say whose license it is and to name what it covers in one place.
- **Confidence**: Medium (a reading of two pages; the ownership arrangement is not in the repo).

##### LP9b-10 · Nit · privacy · NEW
**"Can hold a deleted account, still locked" is true of the notebook, not of the plain fields (ids, times, a device model) in backup history.** `privacy.astro` last retention bullet; `delete-account.astro` says "Your notebook in it is still locked," which is exact. Use the delete page's wording. Confidence High.

### The promise table

"OK" means I found the code or config that makes it true.

| Promise (page) | Check | Result |
|---|---|---|
| Account keeps no name, email, or "record of where you connect from" | migrations: no such column; limiter key is not stored (`limits.js`) | OK. Device model and kind are kept (LP9b-3) |
| Turnstile passes the address to Cloudflare and the service keeps neither | `turnstile.js` `remoteip`, not stored | OK. Protection scope: LP9b-5 |
| Passkey: public key and id only | `ways`, `holders`: public, credential id | OK (counter and flags unlisted, LP9b-3) |
| Apple: id only, token "encrypted" | `apple_tokens`, plain | LP9b-2 |
| Session lists how, when, ends; token fingerprint | `sessions.token_hash` | OK |
| Session 30 days, extended by use to a year | `session.js` 30 and 365; only an open session extends | OK (a session that never opened the notebook stays 30, which the page doesn't say; Nit) |
| Record: id, changed, deleted, size to 256 bytes | `rows`; `PAD_BLOCK = 256` | OK |
| Trash copy 30 days, then a locked note | `TRASH_DAYS`; client drop | LP9b-8 |
| Sign-in 5 minutes; device waiting 10 minutes | `CHALLENGE_MS`; `APPROVAL_MINUTES` | OK |
| Waiting request 7 days, then carried out | `WAIT_DAYS`; hourly cron `17 * * * *` | OK (up to an hour late, unstated) |
| Request counts by address one minute | `ratelimits period 60` | OK |
| Log lines up to 7 days | Cloudflare page: 7 Paid, 3 Free | OK as "up to"; content: LP9b-4 |
| Backup history up to 30 days | Time Travel page: 30 Paid, 7 Free | OK as "up to" |
| Delete at once from a device with the key; wait 7 days otherwise | `waiting.js` `OPEN_NOW`; no-notebook account deletes at once | OK |
| Delete removes everything, Apple told | one cascade statement; `revokeApple` first | OK |
| Cancel by every device that holds the notebook | client (`sync/` notices, test in `test/desk-account-page.test.js`) | OK (client; not re-run) |
| Cookie `lit_apps_launch_v1`, 365 days | `AppsLaunchPopover.astro:377` | OK |
| Every storage key named | `test/desk-storage-keys.test.js` | OK, 13 of 13 pass |
| Security reports counted 30 days | `test/csp-reporting.test.js` | OK |
| A sheet link travels in the link | `desk-sheet-share.mjs` (fragment) | OK |
| "Account service limits how often a device asks" | `limits.js` | OK |
| Suspend or close an account | no code path (a right, not a promise) | OK as stated |
| "No ads, nothing tracks you across sites" | podcast page embeds | LP9b-1 |
| Terms: license at `/read#license-terms` | `read.astro:274` | OK; see LP9b-9 |
| Footer link, announcement gate | `SiteFooter.astro`, `announcement-gate.js` (`terms` added) | OK |

### The earlier 4j findings

| ID | Verdict | Line that shows it |
|---|---|---|
| LP9-1 apps "keep everything on device" | **Fixed** | `privacy.astro` description and "In short"; "Without an account, ..." then "With an account, a locked copy ... is synced" |
| LP9-2 stale date | **Fixed** (date and JSON-LD `2026-11-25`); the promised what-changed line is LP9b-7 | `privacy.astro:18,39` |
| LP9-3 Turnstile unnamed | **Partly**: named; production key, apps unchecked remain | LP9b-5 |
| LP9-4 retention unsaid | **Fixed**: "until you delete them or the account" (sweep of never-finished accounts stays BVJ's call) | `privacy.astro` retention list |
| LP9-5 Time Travel | **Partly**: page says 30 days; two spec sentences and "still locked" remain | LP9b-6, -10 |
| LP9-6 store forms | **Partly**: plain fields listed; approval model/platform and counter missing; ask 21 hands forms to BDR | LP9b-3 |
| LP9-7 logs, SV9-6 (folded) | **Partly** (counted once each): the page states contents and seven days (LP9's option c); the content is still unread | LP9b-4 |
| LP9-8 no age | **Fixed**: 13 or the country's higher age, in "Children" and Terms; nothing checks it, by design | `terms.astro` "Accounts" |
| LP9-9 controller, rights | **Partly**: the Collective and a 501(c)(3) named; Cloudflare, Brevo, Apple, Google named; "Your choices" gives access, correction, deletion worldwide. No lawful basis, transfer note (US hosting), complaint route, or response time | `privacy.astro` "Scope," "Your choices" |
| LP9-10 Apple 4.8 pairing | **Open**: no guard that Google implies Apple | `providers.js` unchanged |
| AC9-3 sign-out and recovery code | **Partly**: both setup choices now say a new device needs approval or the recovery code; the sign-out sentence (`signedOutNow`) still doesn't | `desk-account-words.mjs` `deviceBody`; `signedOutNow` |
| AC9-7 "Group 4" counting | **Open** (Nit) | `codeGroupLabel` unchanged |
| AC9-8 "preview", "entries" | **Open** (Nit) | `WAY_WORDS` unchanged |
| LV9-8 stale "kept in this browser" when linked | **Fixed**: linked forms for the tour, card, Settings line, notebook intro, backup lede, tested both ways | `test/desk-first-use-linked.test.js` (11 pass) |
| CP9-1 "browser" vs "computer" | **Open**: #713 adds "Keep it in this browser," "Stop syncing on this computer," "Stopping on one computer" | `privacy.astro`, `desk-account-words.mjs` |
| DOC9-3 "before accounts open" list | **Partly**: rule 11 now lists the words and dates that come out; Turnstile production, store forms, apps' What's New, and the effective date are in no list | `account/CLAUDE.md` rule 11 |
| DOC9-5 stale README "box" | **Open**: no `workers/` file touched | `workers/notebook-service/README.md:916` |

**Fixed 5, partly fixed 8, open 5** (18 items; LP9-7 and SV9-6 counted separately).

### The Terms of Use and the new privacy sections: what a lawyer should look at

Not legal advice. #714's list ("For a lawyer, if BVJ wants one") holds: the minimum age's wording, the liability paragraph, governing law and the courts, the sufficiency of the sign-in sentence, whether a passkey credential id is "personal data" under Oregon's act, and the state app-store laws. Items it does not hold, from the pages as written:

1. **Who licenses and who contracts** (LP9b-9): the Collective is the party; an individual is the licensor.
2. **Liability limit**: it protects "volunteers and contributors" (does that reach BDR and contractors?), has no carve-out for gross negligence or willful acts, and no indemnity, severability, or assignment clause. Whether Oregon limits such releases by a nonprofit is a lawyer's question.
3. **Assent**: the Terms sentence is a small hint under the "Create an account" button and its Turnstile line (`page.js:290-304`), above the Apple and Google buttons. #714 lists sufficiency; it does not list that the apps' sign-in (ask 21.4) is unseen and that "using the account after a change means you accept" is assent by use.
4. **Notice of changes** by a line on the website and "in the apps" alone (the service holds no email address), with two different periods (LP9b-7).
5. **Suspension or closing "from how the service is being used"** with no notice or appeal; the 90-day end-of-service notice has a carve-out for "a law."
6. **Sensitive data**: a Bible notebook may reveal religious belief; whether sealed ciphertext the service cannot read is "sensitive data" under Oregon, Colorado, and similar acts, and whether "we can't read it" is accurate enough given the Apple token and plain fields (LP9b-2, -3).
7. **Third-party embeds and Do Not Track** (LP9b-1).
8. **"Wherever you live you can ask what we hold"**: a worldwide promise, with no response time, and a service that cannot identify an account from a message; GDPR Article 11-type identification, controller named, lawful basis, transfers outside the EU, and Brevo and Cloudflare as processors.
9. **Children**: "we don't knowingly collect" beside a stated age of 13 and a parent's right to delete a child's account, with no way to find it.
10. **App stores**: Apple's standard license agreement (the Terms assume it, ask 21.4) and Play's Families and target-audience rules.

### Coherence

Seven days, 30 days, 10 minutes, five minutes, and "deleted at once from a device with the key" agree across `/privacy`, `/terms/`, `/delete-account/`, the help page's new topics, `STUDY-DESK.md` step 4j, the apps file's entry, and the service. Disagreements: LP9b-6 (spec), LP9b-7 (change period), LP9b-10 (what stays locked in backups). The footer (`SiteFooter.astro` twice), the announcement gate (`terms` in `SUPPRESSED_PATHS`), `test/desk-storage-keys.test.js`, and `test/csp-reporting.test.js` all hold. `apps-mirror-notify.yml` fires on `privacy.astro` but not on `terms.astro` (not a finding: Terms are not LSC's mirror; BVJ may want LSC told).

### Copy rules

`sweep.py` ran over the 539 added lines of `git diff 3ef75d8e 37a7498e` for both pages: no em or en dash, no straight quote or apostrophe in prose (the hits are JSON-LD, comments, and `aria-labelledby`), no punctuation outside a closing quote, no British spelling. `oxford.py` flagged candidate series; each was a pair, a clause, or already carried the comma. Clean.

### Improvements

- Say on `/privacy` that an approval row's code lasts ten minutes and a session that never opened the notebook does not extend.
- A config test failing if Google is set without Apple (LP9-10).
- Add `terms.astro` to the LSC notice workflow if LSC wants to know.

### Questions for the owner

1. **Read one stored log event before launch (LP9b-4)?** Yes: settles two sentences and the README; cost, one dashboard visit. No: soften the page. My pick: yes.
2. **Name the podcast embeds in the policy, or switch to the no-cookie YouTube host and click-to-load (LP9b-1)?** Naming is cheap; loading on press removes the cause. My pick: name them now, change the players later.
3. **A "what changed" line now, or none because accounts are closed (LP9b-7)?** My pick: a short dated line.

### What held up

Every number on the account half (30, 365, 5, 10 minutes, 7 days, 256) matched `session.js`, `passkey-form.js`, `approvals.js`, `waiting.js`, and `desk-crypto.mjs`; 15 of 15 retention and deletion promises traced to code. The storage-key and CSP tests pass; the key list matches the code (two code-only keys are allowlisted). Deleting is one cascading statement. Nothing in the service stores the request address.

### Not reached

The deployed preview and dashboard (plan, log fields, Time Travel window); a browser (the Terms hint's placement was read from `page.js`, not seen); Apple's and Google's current store forms (LP9 cited them, I did not refetch); whether an emptied trash record is pushed (LP9b-8).

## Appendix I: PR #713: the desk's code and words (`UX9b`, Sonnet)

Audited at `37a7498e`. Scripts and copies are in `…\scratchpad\audit9\UX9b\` (`states.test.mjs` drives the real modules in happy-dom; `mut\` is a copy of `src/` and a few tests, with `run.mjs` and `run2.mjs` applying one fault at a time).

### Summary

0 Critical, 0 High, 1 Medium, 3 Low, 3 Nit. The first-time card works in every state I drove (never answered, answered, linked, linked then unlinked, no store, accounts open and closed), and the tour and the card write nothing they shouldn't. The first stage and the pages every reader loads gained no import, stylesheet, or module. The main weakness is tests: five of seven faults I planted in the new wiring (tour, tour runner, notebook page, shell) were not caught by any test. Of the earlier findings, LV9-8 is fixed; AC9-3, AC9-7, AC9-8, CP9-1, and ORC-e are open.

### Findings

##### UX9b-1 · Medium · tests · NEW
**The wiring that carries "linked" into the tour, the notebook page, and the panel's nudge has no test; five of seven planted faults survived.**

- **Where**: `tour.js` (`readLinked`, `linked,` passed to `runner.start`), `tour-runner.js:247` (`stepBody(step, run.view, { linked })`), `notebook-page.js` (the `linked` read before `notebookIntro`), `shell.js:181` (`store` handed to `createTour`), `panel.js:445` (`nudgeLine(accountsOpen())`).
- **What happens**: `test/desk-first-use-linked.test.js` tests the pure words (`stepBody`, `notebookIntro`, `nudgeLine`) and the card and foot through `createFirstUse`, which is good and drives behavior. But no test runs a tour with a linked store, draws `/notebook/`'s first line, or opens the panel's nudge. A change that always passes `linked: false` to the tour, drops the link read on the notebook page (which is the LV9-8 fix), or forgets `store` in the shell leaves every test green, and a synced reader is told again that "nothing is sent anywhere."
- **Evidence**: `mut\run2.mjs` over 12 tour, panel, shell, notebook, first-use, and Sheet test files (baseline 1 failure from a missing worker in the copy). Faults: tour passes `linked: false`, runner ignores `linked`, notebook page ignores the link, tour's link read forced false, shell drops `store`: all five left the count at the baseline. Planting a fault in `nudgeLine(accountsOpen())` changed the count by one, which I read as a flake, not a catch (inconclusive). Card faults were caught: dropping `!linked` in `drawCard` (+2), in the `onEntry` guard (+2), and the reminder tick on the open card's Keep button (+1). The account page's Terms link has an assertion (`desk-account-page.test.js:93-96`) but that test needs `workers/` and would not run in my copy, so I did not run that fault.
- **Why it isn't a false positive**: I grepped `test/` for `nudgeLine`, `notebookIntro`, and `linked` near `createTour`: only the new test file names them, and only as pure functions.
- **Fix**: add three small happy-dom tests: start the tour runner with `linked: true` and read the `kept` step's body; run `notebook-page.js`'s start with a linked fake store (or extract the intro line into a function the page and test share); trigger the panel's first-write nudge with `data-account="open"`.
- **Confidence**: High on the survivors; Medium on the nudge (one noisy result).

##### UX9b-2 · Low · copy · NEW
**The backup reminder's words ignore the account, though the Settings line beside it now names the file.**

- **Where**: `desk-reminder.mjs` `reminderText` ("It’s been 9 days since you backed up your notebook." and "You haven’t backed up your notebook yet.") and `backedUpSaid`; compare `savedLine(..., { linked })` ("Not backed up to a file yet.").
- **What happens**: #713 made `savedLine` say "to a file" because, in its own comment, "backed up" alone "would read as the account’s copy standing behind." The reminder bar and the Settings notice (`first-use.js`, `noticeText`) were left on the old words. A reader who asked for reminders before syncing is told on the same screen "You haven’t backed up your notebook yet" and, in the foot, "Not backed up to a file yet." The first reads as if the account copy doesn't count.
- **Evidence**: `states.test.mjs`, third test: `reminderState({ home: "browser-remind", ... })` is `bar: true`, text as quoted, while `savedLine(null, now, { linked: true })` is "Not backed up to a file yet." The reminder module doesn't know about links at all (`desk-first-stage.mjs` `peekReminder` reads no link).
- **Why it isn't a false positive**: a linked reader can hold `browser-remind` (answered earlier, or the checkbox stays in the foot for a linked reader). Nobody newly picks it on the card, since a linked browser never sees the card.
- **Fix**: give `reminderText` a `linked` option as `savedLine` has, and say "to a file." Question for BVJ below: should the reminder fire at all for a synced reader.
- **Confidence**: High.

##### UX9b-3 · Low · coherence · NEW
**A browser whose link remains but can no longer sync is still told "It syncs with your account" and is shown neither card.**

- **Where**: `first-use.js` `refresh` (`linked = readLink(...) != null`), `notebookIntro(true)`, the tour's `linked` body, `keptLine(true)`, `help.astro` "Stop syncing on this computer: offered when this computer can no longer sync (signed out, removed, or on another notebook)."
- **What happens**: "Linked" is "a link record exists." The help page's own list says the link can outlast the ability to sync (removed from the devices, or another notebook). In that state My Notebook says "It syncs with your account, locked with a key we never have," the Settings foot says "Kept in this browser and in your account," and the tour says it is "synced with your account." Also the reader who never answered gets no card and no nudge, which is the "a reader who chose nothing gets no nudge" rule applied one step too far: they chose nothing and have no working account.
- **Evidence**: read of `sync/start.js:205-217` (`unlink` is the only thing that clears `SYNC_META`) against the help text; not driven against a real removed device.
- **Why it isn't a false positive**: sign out itself calls `unlink`, so the plain sign-out case is fine; this is only the removed and wrong-notebook cases. The Settings status line says the truth, so it's Low.
- **Fix**: key these lines on "linked and able to sync" if the sync status exposes it, or soften to "is linked to your account."
- **Confidence**: Medium (the removed state wasn't run).

##### UX9b-4 · Low · usability · NEW
**A reader who answered "this browser" before accounts opened never meets the choice again and has no route to an account from the desk's own panel.**

- **Where**: `first-use.js` `drawCard` (`unanswered = canKeep && !getHome() && !linked`); the foot's links are Take the tour, Help, and feedback only.
- **What happens**: the account link exists only on the unanswered card. An answered reader reaches `/account/` through the header's "Sign in" (account file), the help page's link, or by typing it. In the Notebook panel there is no way in.
- **Evidence**: `states.test.mjs`, last test: with `home: "browser"` and accounts open both cards are hidden and the foot's links are `/desk/help/` and `/contact/?about=study-desk`.
- **Why it isn't a false positive**: the header's entry (E231) covers a reader with a header; the Notebook panel is a second place readers look. Reach today is BVJ alone.
- **Fix**: a quiet "Account" or "Ways to keep your notebook" link in the foot, or the Settings tab's Keep group, where accounts are open. Needs BVJ.
- **Confidence**: Medium.

##### UX9b-5 · Nit · reliability · NEW
**A first write in the same tick as the page opening nudges a linked reader.**

- **Where**: `first-use.js` `store?.onEntry(...)` guard reads `linked`, which is false until `refresh` resolves.
- **Evidence**: `states.test.mjs`, second test: a write before `getMeta` resolves gives one reveal for a linked store. In life a write within a few milliseconds of load is unlikely, so Nit.
- **Fix**: also await the first `refresh` before honoring the nudge, or let `reveal` re-check `linked`.
- **Confidence**: High.

##### UX9b-6 · Nit · performance · NEW
**Stage one's `desk-reminder.mjs` grew by two functions it never uses.**

- **Where**: `desk-reminder.mjs` (`notebookIntro`, `backupLede`, about 1 KB of source), reached by stage one through `reminder.js` and `desk-first-stage.mjs`.
- **What happens**: negligible bytes, but it is the one place #713 touched something the first stage loads. The rule ("the first stage stays light") holds in kind.
- **Fix**: none needed; if the first stage is re-measured at launch, note it. Moving the two words to `desk-first-use.mjs` (which re-exports the module) would keep stage one exactly as it was.
- **Confidence**: High.

##### UX9b-7 · Nit · usability · NEW
**The choice's second answer is a plain link with an ellipsis, so it reads as secondary and as a dialog.**

- **Where**: `first-use.js` (`.desk-home-card__account`), `desk.css:2991`.
- **What happens**: "Keep it in this browser" is a bordered button; "Set up an account…" is a green underlined link that navigates away in the same tab. BVJ's rule is that no account is plainly an option, and the two are visually unequal in the other direction (the account looks lesser). The ellipsis promises a dialog; it opens a page. At 13px it is under 24px tall, but its neighbors are more than 24px away, so WCAG 2.5.8 is met by the spacing exception.
- **Fix**: drop the ellipsis or make it a second button-styled link; BVJ's call.
- **Confidence**: Low (taste).

### Improvements

- A heading is focusable (`tabIndex = -1`) on both forms of the card, as before; the choice is a `section` labeled by its h3, and tab order is title, reminder checkbox, Keep button, account link, Ways link: sensible.
- `test/desk-first-use-linked.test.js` is the right kind of test (drives happy-dom, asserts what the page shows and stores). Extend it as in UX9b-1.
- The help page's "An account" topic documents a feature closed to everyone but BVJ and links `/account/`, which shows one line without `?account=preview`. It says "being tested, and not open to everyone yet," so it isn't untrue, but at launch it should be reconsidered with the account file's launch edits.

### Questions for the owner

1. **Should the backup reminder fire for a synced reader?** For: a file is "the one copy that needs no browser, account, or key" (the new backup lead's own words), so the reminder stays useful; and it only fires for those who asked. Against: the account is a second copy, so a week's nag may feel wrong. My pick: keep it on, with the words from UX9b-2.
2. **One name for the local place?** (CP9-1.) The new words use "this browser" 17 times, "this computer" 6, "this device" once, and "your device" 6 in lines added by #713, sometimes in one sentence ("stops syncing on this computer … stays in this browser," `desk-account-words.mjs:154`; the card's "stays on this computer … this browser’s data"). My pick: "this browser" for where the notebook is kept, "this computer" only for the file and hardware ("on your own computer"), and "device" only in "This device only" and "your devices," which BVJ kept.

### Gate, state walk, and the earlier findings

**The gate (item 2): held.** `git diff 3ef75d8e 37a7498e` on `first-stage.js`, `desk-gate.js`, `notebook-tab.js`, and `src/layouts` is empty. The footer's new link is markup. `announcement-gate.js` gained `terms` in a regex. The new card, tour, and notebook words all load with the shell or the notebook page. Only UX9b-6 touches a stage-one import.

**State walk (item 1, `states.test.mjs`, 6 tests passed).**

| State | Card | Nudge | Writes |
|---|---|---|---|
| never answered, accounts closed | statement | yes, once | none until "Got it" |
| never answered, accounts open | choice | yes, "Choose where to keep it." | none until Keep |
| answered "this browser" | none | none | none |
| linked | none | none (race: UX9b-5) | none |
| linked, then unlinked | back on next refresh | yes | none |
| no store | none, no foot controls | none | none (`localStorage.length` 0) |
| tour, any state | not started here | n/a | `readLinked` only reads |

**The earlier findings.**

- **AC9-3: open.** `desk-account-words.mjs:154` (`signOutLinked`) is unchanged and says nothing of the recovery code; the new help line ("Sign out: syncing stops on this computer ... the notebook stays in this browser") repeats it. `deviceBody` now says what the passkey can do, but not that sign-out leaves one needing the code.
- **AC9-7: open.** `codeGroupLabel` (line 298) is unchanged.
- **AC9-8: open.** "the preview’s sign-in" and "entries" are untouched by #713.
- **LV9-8: fixed.** `notebook-page.js` now reads the link before drawing and writes `notebookIntro(linked)`; the unlinked sentence remains for unlinked readers. Edge: UX9b-3.
- **CP9-1: open.** Counts for the same files, before and after (raw, comments included): "this browser" 143 to 160, "this computer" 57 to 60, "this device" 68 to 70 (CP9-1's counts were reader-facing strings only; mine are broader). #713 chose to keep "This device only."
- **ORC-e: open.** `account/page.js` changed only to add the Terms link (+15 lines); the imports that load `notebook.js` and the sync for a signed-out reader are unchanged.

### What held up

- Copy rules over every added line in the listed files (382 lines, by script): no em dash, no straight quote in a string, no British spelling, no `”.` or `”,` misplacement, Oxford commas present ("a key we never have" lines, the backup lede, the help lists). Added comments carry straight quotes, which the rule allows.
- Dark mode and focus: the new CSS adds only `var(--ink-rgb)` hairlines and sizes by `var(--desk-ui)`; links take the existing `--green-text` rule and the site's global focus ring; no new tooltip or `title`; no new text column.
- The hidden attribute on both cards works (`.desk-home-card[hidden]` is present, desk.css:2926).
- 53 tests passed in my copy for the two first-use files; the tour, panel, and notebook tests pass at baseline.

### Not reached

- The built pages and a real browser: I worked from source and happy-dom, and did not use `dist/`.
- `desk-account-page.test.js` and the Terms link's mutation: the test needs `workers/`, which my copy lacks.
- The removed-device and wrong-notebook states (UX9b-3) against a real service; those are the preview's and off-limits.
- Screen reader output and 200 percent zoom on the new card.

## Appendix J: Coherence of the system, end to end (`COH9`, Opus)

Commit `3ef75d8e`, read-only. Scripts and outputs are in
`…\scratchpad\audit9\COH9\`:
`signout-after-replace.test.mjs` (two page-level reproductions over the service's own code) with
`signout-after-replace.out.txt`; `routes-and-words.mjs` with `routes-and-words.out.txt`;
`mismatched-jwk.mjs` with `mismatched-jwk.out.txt`; `crypto-test.out.txt`; `account-sync-tests.out.txt`.

### Summary

Three findings: 0 Critical, 0 High, 1 Medium, 1 Low, 1 Nit. The layers agree far better than
they disagree: every route the website sends is routed and in the spec, every refusal word and
every `not_allowed` rule the service can send is in the spec, the request and answer shapes the
website builds and reads match the service member for member, and the crypto sizes and the
approval code agree across the reference, the service, and the vectors. The one fault with reach
is in the joint between them: **"Sign out" fails, every time, on a computer that was removed or
whose notebook was replaced**, because the service refuses `DELETE /devices/:id` from a session
attached to no device, the page sends that request anyway and treats the refusal as an error, and
the spec describes a case the service makes unreachable while saying nothing of the one that
happens. I reproduced both paths on the real page over the service's own code. For iOS's 22
points (PR #701), the table under "What held up" gives each a status: **none has been fixed in
code since iOS read `main`**, two were never disagreements, and twenty still stand (one only in
part), most of them harmless to the website today and all of them DOC9-1's to route.

### Findings

##### COH9-1 · Medium · reliability · NEW
**"Sign out" fails with `not_allowed` / `own_device` on a computer that was removed and signed in again, or whose account's notebook was replaced, and the spec gives an app no way to know which request to send there.**

- **Where**: `src/scripts/desk/account/notebook.js:711-718` (the sign-out question's `onYes`);
  `src/lib/desk-account.mjs:649-656` (`signOutDevice`, which tolerates only `sign_in`);
  `workers/notebook-service/src/devices.js:170`
  (`if (!auth.sessionDevice || params.id !== auth.sessionDevice) notAllowed("own_device")`);
  `workers/notebook-service/src/waiting.js:241` (a carried-out replace sets every session's
  `device` to NULL); `workers/notebook-service/src/key.js:93` (removing a device deletes its
  sessions); `STUDY-DESK-ENCRYPTION.md:1445-1447`, `:1491`, `:1534-1536`.
- **What happens**: the page signs out with `DELETE /devices/<id>` whenever this browser still
  keeps a device (`connector.device()` is non-null), and falls back to `DELETE /session` only
  when it keeps none. Two documented states leave the browser with a device and a session that
  is attached to none:
  1. **Removed, then signed in again.** Another device removes this one (its sessions are
     deleted, `key.js:93`); the page says "signed out," the reader presses "Sign in again," the
     new session's proof is answered `gone`, and the page says "removed." This is the path
     `STUDY-DESK-FOR-THE-APPS.md:476` describes as what the website shows.
  2. **The notebook was replaced.** After the seven days, `carryOutReplace` sets every session's
     `device` to NULL; the old computer's page says "Your account's notebook was replaced."
  In both, the home still offers "Sign out" (and the header's "Sign out" link opens the same
  question). The reader confirms; the service answers 422 `not_allowed` with
  `rule: "own_device"`; `onYes` rethrows anything but `sign_in`, `gone`, and `not_found`; the
  page shows "Something went wrong, and nothing was changed. Try again." Trying again never
  works. The browser stays linked and the service session stays alive. The only way out on that
  screen is "Stop syncing on this computer," which unlinks locally and sends nothing, so the
  session lives on the service, held by no one, until it expires.
- **Evidence**: `signout-after-replace.test.mjs` drives the real page with the repo's own
  helpers (`test/helpers/account-page.mjs`, the real store and connector, the service's own
  `src/` on SQLite). Both tests end with "signed out shown: false | still linked: true | generic
  failure shown: true." For the replace case the script then sends the same session's requests
  directly: `DELETE /devices/:id` answers 422
  `{"error":"not_allowed","rule":"own_device"}`, and `DELETE /session` answers 200
  (`signout-after-replace.out.txt`). The spec frames the routes by history, not by the session:
  "`DELETE /session` is how a device that never joined the notebook signs out ... A device that
  has joined signs out with `DELETE /devices/<id>`" (`:1445-1447`), and "If its entry is already
  gone (another device removed it), its sessions are ended" (`:1535`). That second case can't
  arise as written, because removal already deleted those sessions (`key.js:93`), while the case
  that does arise (a fresh session after removal, or any session after a replace) is refused.
  The table's "a session attached to that device" (`:1491`) is accurate; the bullets steer a
  client the wrong way, and `own_device` is named for `PUT` only (`:1532`).
- **Why it isn't a false positive**: I looked for a guard on each side. The page's catch lists
  three words and not this one; `signOutDevice` catches `sign_in` only; no page test signs out
  from a stop (`test/desk-account-page.test.js` signs out only from a healthy home, `:585-605`,
  and from a phone that never joined, `:846`); the service's tests prove the refusal on purpose
  (`workers/notebook-service/test/devices.test.js:519`, "refuses a session attached to no device
  as not_allowed own_device"). So each side is tested and right by its own lights; the joint is
  untested. Reach today is BVJ alone on the preview, which is why this is Medium, not High: the
  reader has a way out on the same screen, and nothing is lost.
- **Fix** (a recommendation): on the website, when `DELETE /devices/:id` is refused `own_device`,
  end the session with `DELETE /session` and then `leave()` as now; or, simpler, send
  `DELETE /session` whenever the sync's state is a stop (`removed`, `otherNotebook`, `cantOpen`)
  and `DELETE /devices/:id` only from a working link. Add a page test for each stop. In the spec,
  rewrite the two bullets by what the session is: a session attached to this device signs out with
  `DELETE /devices/<id>`, and any other session (never joined, removed, replaced, or not yet
  proved) with `DELETE /session`; drop or reword the unreachable "entry already gone" case; name
  `own_device` under `DELETE` as well as `PUT`. That last part changes what the apps build, so it
  needs a dated entry in `STUDY-DESK-FOR-THE-APPS.md` and BDR's eye (BVJ to decide the wording).
- **Confidence**: High. Both paths reproduced on the real page and the real service code; the
  refusal and its rule are quoted from the service's own answer.

##### COH9-2 · Low · coherence · KNOWN (iOS's answers, point 15, not taken: DOC9-1)
**The spec explains `exists` with `what: "passkey"` only as "a way in already, to this account or another," but `POST /holders` sends it for "this notebook already has a holder for that passkey," and the holders section never names the refusal.**

- **Where**: `STUDY-DESK-ENCRYPTION.md:2078` (the table: "For `passkey` and `way` under 'Signing
  in' and 'Ways to sign in': it is some account's way in already") and `:2013-2015` (the same,
  under "Ways to sign in"); `:1492` (`POST /holders`' row lists "has no holder yet" as a check
  but no word for it); `workers/notebook-service/src/devices.js:205-207`
  (`refuse(409, "exists", { what: "passkey" })` when a holder has that credential);
  `src/lib/desk-account-words.mjs:380` (the website words `exists` only for `waiting`).
- **What happens**: an app that words refusals from the table tells its reader that the passkey
  "belongs to an account already" when the truth is that this passkey already opens this
  notebook. The website shows its default sentence. iOS noticed the neighboring point (one fault,
  two words, against `POST /notebook/key`'s `one_holder_per_passkey`); the misleading gloss in the
  table is what the record understates.
- **Evidence**: the three spec lines and the service line quoted above; `routes-and-words.out.txt`
  confirms `exists` is in the spec's table and the fake has no `exists` at all.
- **Why it isn't a false positive**: the table's first sentence ("That id, or the one thing of
  that kind, is already there") covers it generically, but the next sentence narrows `passkey` to
  the sign-in meaning, and nothing in the holders section restores the other meaning.
- **Fix**: one sentence in the holders section ("a passkey that already holds the key is `exists`
  with `what: 'passkey'`"), and in the table say `passkey` means either, by route. BVJ's side; no
  change to the interface.
- **Confidence**: High for the text; Medium that an app would word it wrongly.

##### COH9-3 · Nit · coherence · NEW (the `what` half is iOS's point 9)
**For a row, the service checks size before padding, while the spec lists the padding check before the size check; and `too_large` carries a `what` the spec's table doesn't list.**

- **Where**: `STUDY-DESK-ENCRYPTION.md:1597-1599` (order: `nonce`, `ct` including "not a multiple
  of 256 bytes plus 16", then `too_large`); `workers/notebook-service/src/rows.js:90-93` (`ct` if
  not base64url, then `too_large`, then `ct` for the padding); `rows.js:102`
  (`what: "rows"`); `test/helpers/fake-notebook-service.mjs:258` (`what: "body"`);
  `STUDY-DESK-ENCRYPTION.md:2086` (`too_large` carries `limit`).
- **What happens**: a row both over 1,048,592 bytes and off the 256-byte grid is refused
  `too_large` by the service and `ct` by the spec's order. No client acts on the difference (the
  website never sends either; clients ignore unknown members), so only a conformance test would
  trip on it.
- **Fix**: move `too_large` before the padding check in the spec's sentence (or split `ct` there
  as the code does), and list `what` under `too_large` in the table. Bring the fake's `what` in line
  with `readJson` (`{ limit }` only).
- **Confidence**: High.

### Improvements

- **Hold the fake to the service by running both** (builds on SY9-2). The root suite now has
  `test/helpers/real-notebook-service.mjs`, which the account tests already use. The engine's
  tests that don't need a fault at an exact point could run against it, and a short parity test
  could send the same requests to both and compare `error`, `what`, `rule`, and the answer's
  member names. iOS ran 275 checks against a Swift copy of the fake, so its drift (points 7 to 13
  below) is now drift in a second codebase too. The fake's header and `sync/CLAUDE.md:235-238`
  still claim it repeats "the same words, statuses, shapes, sizes, and order of checks," which no
  test holds.
- **Name the stop states in the sign-out code** (with COH9-1's fix): a single helper that picks
  the route from the sync's state keeps the header's link, the home's button, and any later caller
  in step.
- **Give `exists` a sentence per `what`** in `failureWords` (`holder`, `recovery`, `passkey`,
  `device`), since all four can reach the account pages through a race or a second tab, and today
  each reads "Something went wrong."

### Questions for the owner

1. **Who should fix COH9-1's route choice: the client or the service?** Case for the service:
   let `DELETE /devices/:id` from a session attached to no device end just that session, so
   "sign out" is one request whatever happened. Case against: that widens what a session that
   never proved anything may call on a device's path, and it hides a client's confusion about its
   own state. My pick: the client (fall back to `DELETE /session`), with the spec's bullets
   rewritten, and no change to the service. BVJ to decide; BDR to confirm for the apps.
2. **Should "Stop syncing on this computer" end the service session too?** Case for: today it
   leaves a live session on the service for up to 30 days that no one holds, and a reader would
   assume stopping ends it. Case against: in the "signed out" stop there is no session to end, and
   the button must work offline. My pick: yes, a best-effort `DELETE /session` whose failure is
   ignored.

### What held up

**Routes** (`routes-and-words.out.txt`): the router has 37; the spec's tables 33, plus `GET /`
and the two preview routes in their own sections and `POST /ways/google` written beside Apple's
(script artifacts, not gaps). The website sends 32 distinct routes from seven files, and every one
is routed and in the spec. The service README lists 16 by design: it says the spec is its
specification (`workers/notebook-service/README.md:9-10`), so MH9's "16 of 37" is not a gap.
`POST /sign-in/challenge` routed only with a provider on (`index.js:106`) is what the spec's
general rule says ("A way that is off answers `not_found` on every path of its own,"
`STUDY-DESK-ENCRYPTION.md:1768`); the challenge belongs to Apple and Google alone.

**Refusal words**: the service can send 21 words; the spec's table holds 20, and the 21st,
`preview_secret`, is in the prose (`:2106`). All 17 `not_allowed` rules are named in the spec.
Every status agrees (MH9's Table 1, checked). On MH9's open items: the eight words missing from
the fake are words the four routes it serves can't send, except `too_large`'s `what` (COH9-3); the
account sentences that fall to the default are, but for `own_device` (COH9-1) and `exists`
(Improvements), states the website can't reach by construction (it sends `distinct_ids`,
`every_device`, `every_holder`, and the rest correctly, and a race is answered `lists_changed`
first, `old_key` or `lists_changed` (`key.js:48-49`), both with a sentence of their own); the sync line's default for other words is
right for words that mean a bug. `too_large`'s extra `what` is harmless because a client ignores
a member it doesn't know (spec `:1355`), and noted as COH9-3. The cancel window (spec `:1706`),
`DELETE /devices/:id`'s session (the table agrees; the bullets are COH9-1), and "item 20, rule c"
were judged by the orchestrator; the apps file's "(item 4)" and "(item 7)" at `:1370` and `:1377`
are DOC9-11.4's.

**Wire shapes**, read on both sides: the grant body `{kid, card, keyring: {enc, ct}, mac}`
(`desk-account.mjs:376`, `approvals.js:127-130`) and its reading into `acceptGrant`
(`desk-account.mjs:395-399`); `replaced` as `{when, platform, through}` (`account.js:32`,
`desk-sync-status.mjs:256-262`); `waiting` as `{what, asked, due, platform, through, mine}`
(`waiting.js`, `desk-account-words.mjs:309-312`, `desk-sync-status.mjs:207-214`); a device's
`how` and `by` (`account.js:111`, `approvals.js:188`, `desk-sync-status.mjs:241`). The approval id:
10 bytes, HKDF to 16, 32 lowercase hex (`desk-crypto.mjs:1221-1222`) against
`/^[0-9a-f]{32}$/` (`check.js:51`); the link's 16 Crockford characters from 80 bits. Turnstile
agrees across the spec (`:1795`, `:1808`, `:1837-1849`, `:2085`, `:2099`), `turnstile.js`
(`not_allowed`/`turnstile`, `provider`/`which: "turnstile"`, no `Origin` skips), and both apps-file
entries (an app sends no `Origin`, so nothing changes for it). `SERVICE_WINS_TIE` is one constant
(`desk-sync.mjs:86`) described alike in `STUDY-DESK-FORMAT.md:1553` and `sync/CLAUDE.md` rule 9,
for BDR to confirm. The body budget (4,000,000 UTF-16 units) sits 194,304 under the service's
4,194,304 bytes, and a push body is ASCII JSON, so the units are bytes.

**Tests run**: `node --test test/desk-crypto.test.js`, 36 of 36 (`crypto-test.out.txt`);
`test/desk-account.test.js`, `test/desk-sync-engine.test.js`, and
`test/desk-sync-engine-edges.test.js`, 90 of 90 (`account-sync-tests.out.txt`). The account
flows there run the website's model against the service's own code, which is the strongest
evidence that the shapes agree.

**The apps list against #700 to #712**: every change that touches what an app builds or sends has
a dated entry (Turnstile on the service, 2026-11-24; Turnstile on in the preview; the account
pages; the waiting-request and new-device notice, for BDR to confirm). E230 (`?account=` on every
page) and E231 (the header's width) are the website's alone and rightly have none. The one gap is
COH9-1's, which needs an entry once fixed.

#### iOS's 22 points (apps file, "2026-11-24, iOS's answers"), at `3ef75d8e`

No file these points name has changed since iOS read `main` at `c7c729fe`, except the engine's
`Offline` moving to a file of its own (`git log c7c729fe..HEAD` on each path). "Stands" means the
disagreement is still in the repo; "who" is who acts.

| # | Point | Status | Where it stands now | Who |
|---|---|---|---|---|
| 1 | `TextDecoder` drops a leading BOM; spec silent | Stands (spec only) | No "byte order" sentence for records in the spec; both clients behave alike | BVJ's side: one sentence |
| 2 | A lone surrogate in a `\u` escape | Stands (spec only) | No "surrogate" in the spec | BVJ's side: say none is carried |
| 3 | Holder record whose `public` isn't `d`'s own: no vector | Stands (vector gap) | The website refuses it too: WebCrypto's import throws, which the reference reports as `privateKey` (`desk-crypto.mjs:444`); Node 24 refuses a mismatched pair (`mismatched-jwk.out.txt`); browsers not tried | BVJ's side: add a vector |
| 4 | Canonically equivalent ids compared as equal | Stands (vector gap) | The vectors' only non-NFC text is whitespace (lines 477, 905); no id pair tests it | BVJ's side: add a vector; Android to check |
| 5 | CryptoKit can't take an HPKE sender key | Never a disagreement | iOS's platform note | None |
| 6 | CryptoKit can't take an ECDSA nonce | Never a disagreement | The spec allows verifying only | None |
| 7 | Fake's `token-1` vs `BEARER`'s 43 characters | Stands | `fake-notebook-service.mjs:143`, `session.js` `BEARER` | Website (SY9-2) |
| 8 | Fake resets `rev` on replace; the service doesn't | Stands, the fake is wrong | Spec `:2563` and `:2999` say the counter is not reset; `fake:216` resets it | Website (fake) |
| 9 | `too_large`'s `what` | Stands | `http.js` `{limit}`, `rows.js:102` `rows`, `fake:258` `body` | Website (COH9-3) |
| 10 | Fake's proof checks no form | Stands | `fake:329-346` against `account.js` `postProof` | Website (fake) |
| 11 | `GET /keyring`'s `bad_request` `field: "device"` | Stands | `devices.js` `getKeyring`; the spec's row lists only `not_found` | BVJ's side: the row |
| 12 | Fake's `ways: []` and fixed `expires` | Stands | `fake:314-315` | Website (fake) |
| 13 | Order of checks; no Content-Type check in the fake | Stands | `http.js` `readJson` needs `application/json`; the fake doesn't | Website (fake) |
| 14 | `previewPasskey` reads the body before the session | Stands in part | `preview.js:89-94`: `sign_in` first, then the body, then `not_open`; preview only | Website, if at all |
| 15 | One fault, two words (`one_holder_per_passkey` vs `exists`/`passkey`) | Stands | `key.js:68`, `account.js:94`, `devices.js:205-207`; and the spec misglosses it (COH9-2) | BVJ's side |
| 16 | Malformed id: `bad_request`/`id` vs `gone`/`way` | Stands | `approvals.js:21`; `ways.js:181` (any id not this account's, well formed or not) | BVJ's side: say so, or align |
| 17 | `platform` and `model` count UTF-16 units | Stands (spec only) | `check.js` `needText` uses `value.length`; no "UTF-16" in the spec | BVJ's side: one sentence |
| 18 | `openSession` keeps another notebook's keyring | Stands, latent | `desk-sync-engine.mjs:267-281`: `keyring` is set before the notebook check, so a refused keyring stays in memory and the next pass skips both checks; needs a sealed keyring for another notebook in storage | Website: set it after the check |
| 19 | `adopt` checks nothing with no keyring in memory | Stands | Engine unchanged | Website |
| 20 | `rowSize` counts UTF-16 units against bytes | Stands, harmless | Rows' JSON is ASCII; 194,304 bytes of slack | Website, if at all |
| 21 | The edges test's `waiting` isn't the interface's shape | Stands, harmless | `test/desk-sync-engine-edges.test.js:489`; the engine passes `waiting` through, and readers act only on `delete` or `replace` | Website (test) |
| 22 | `request` accepts a 200 with no `time` | Stands | Engine `request()` unchanged | Website |

So: **0 fixed, 2 never real (5, 6), 20 stand** (14 in part; 20 and 21 harmless; 18 latent). The
three key-storage points iOS raised after the list (`sign_in` meaning two things, the reinstall
guard, a session tied to its service) are spec questions, not disagreements, and stand as asked.

### Not reached

- **Browsers' JWK check** for point 3: tried in Node 24 only. Chrome, Safari, and Firefox were not
  run (no browser runs were made, by the brief's rules on analytics).
- **The deployed services**: nothing was sent to the preview; Turnstile's real siteverify and its
  `provider` path were read, not run.
- **Android**: nothing in the repo speaks for it.
- **The `cantOpen` stop** (fewer than five wrong proofs, the session left unattached) almost
  certainly meets COH9-1 as well, by the same code; I reproduced only the removed and replaced
  paths.
- **The spec's "Still open" items one by one** (MH9 numbered them; I checked only those this
  slice touches: 86 for Turnstile, the tie rule, and the ones iOS answered).

## Appendix K: Coherence of the records (`DOC9`, Sonnet)

### Summary

Twelve findings: 0 Critical, 0 High, 3 Medium, 8 Low, 1 Nit. The decisions themselves held together well: session lifetimes (30 days, an open session kept up to 365), who rolls back (the GitHub workflow), production "prepared, not deployed," the "ask BDR" and "yes" lists for items 41 to 90, and the numbering (asks 1 to 20, items 1 to 90, no gaps) read the same everywhere I looked. What drifted is the text around them: Turnstile's "off" wording survived in five places after it went on in the preview; the deletion page is described as "can't delete yet" in four places after step 4h built the box; one area file says the page is in the sitemap when the config removes it; the spec's front matter stops at 4g; and BDR's long iOS answer (PR #701) was never acknowledged by any later change. Two things are missing rather than wrong: one list of what must be true before accounts open, and a place that tracks iOS's findings. I read the spec, the apps file, STUDY-DESK.md 4a to 4l, the area files, the READMEs, the RUNBOOK, DISASTER-RECOVERY.md, and BDR-ONBOARDING.md, and checked about 45 concrete claims against code (list under "What held up"). MH9's tables (`…\scratchpad\audit9\MH9.md`) were used for numbering and routes. Notes: `…\scratchpad\audit9\DOC9\notes.md`.

### Findings

##### DOC9-1 · Medium · coherence · NEW
**BDR's iOS answers (PR #701) were never taken in: no later change acts on, answers, or tracks any of its 22 discrepancies or three key-storage points.**

- **Where**: `STUDY-DESK-FOR-THE-APPS.md` "2026-11-24, iOS's answers" (lines 488 to 664); `test/desk-sync-engine-edges.test.js:489`; `STUDY-DESK-ENCRYPTION.md` (no hit); `STUDY-DESK.md` 4g and 4h.
- **What happens**: #701 merged 2026-11-25 11:59; #700, #703, #704, and #707 to #712 merged after it. iOS reported, as things "each ... the website's to weigh": its test builds `waiting` as `{what: "notebook", since, ready, from}`, "which isn't the interface's shape"; the fake hands out `"token-1"` which `BEARER` would refuse; `too_large` carries `what: "rows"` that the spec table doesn't list; the spec could say a client batches by bytes (a padded record can be 1 MiB), that no record carries a lone surrogate, and that the `platform` and `model` limits count UTF-16 units; and `sign_in` "means two things" (expired session: keep keys; deleted account: clear them) that "a client can't tell ... from the word alone"; plus a reinstall guard and a per-service session item. Nothing records which of these the website accepted. The spec has no mention of surrogates, canonical equivalence, or the guard, and the website's own test still builds the wrong `waiting` shape (line 489 unchanged). The spec's item 89 touches the `sign_in` ambiguity for a deleted account without citing iOS's point. Silence reads as "taken," and the freeze (December 24) will carry them unresolved.
- **Evidence**: `grep -n -i 'surrogate\|canonically\|by bytes as well\|probe item' STUDY-DESK-ENCRYPTION.md STUDY-DESK.md` finds nothing; `git log` order as above.
- **Why it isn't a false positive**: I looked for a ledger in the spec's "Still open," the apps file's asks 1 to 20, and STUDY-DESK.md 4h; the apps file itself says "each is the website's to weigh."
- **Fix**: one pass by BVJ's side that gives each of the 22 plus three a line (taken with where, not taken with why, or for BDR); add the spec sentences iOS asked for (byte batching, UTF-16 limits, no lone surrogate); fix the test's `waiting` shape and the fake's `what: "body"`. Not 4j.
- **Confidence**: High.

##### DOC9-2 · Medium · cost · NEW
**The spec and the service README say Workers Free gives "a database" 100,000 rows written a day; the CSP Worker's README says it is one allowance shared by every database on the account, including the notebook preview.**

- **Where**: `STUDY-DESK-ENCRYPTION.md:3027` ("On Workers Free a database gets 100,000 rows written a day"); `workers/notebook-service/README.md:830`; `workers/notebook-service/RUNBOOK.md:34`; against `workers/csp-reports/README.md:92-93` ("every D1 database draws on one allowance of 100,000 rows written a day, which the notebook service's preview shares") and lines 95-97 (100,000 requests a day across every Worker).
- **What happens**: the "seven hours" figure and "Production needs Workers Paid for a reason the step didn't name" are computed as if production had its own 100,000. If the account is on Free, the preview, the CSP counter (up to 10,000 a day), and any future production database share it, so one address at the sign-in limit stops all of them sooner than seven hours.
- **Evidence**: Cloudflare's D1 pricing page (https://developers.cloudflare.com/d1/platform/pricing/): Free rows written "100,000 / day"; its FAQ says "When your account hits the daily read and/or write limits, you will not be able to run queries against D1," which points to an account-level limit but does not say so outright. Whether the account is on Free is not recorded anywhere I read.
- **Why it isn't a false positive**: no document reconciles the two statements.
- **Fix**: say "the account" in the three places, record the plan, and note that the preview and the CSP Worker share the day's writes. Needs BVJ to confirm the plan.
- **Confidence**: Medium (the vendor page is not explicit).

##### DOC9-3 · Medium · coherence · NEW
**Nothing lists, in one place, what must be true before accounts open to readers; the conditions are spread over six documents, and the one list that exists (account `CLAUDE.md` rule 11) covers only code switches.**

- **Where**: `STUDY-DESK.md` dates list ("the full policy is enforced before sign-in is"; privacy page and terms "live before either app ships sync"), 4f ("sign-in and 'Delete account' ... live before an Android build ... goes to review"), 4h ("What is left of 4h": a look at the Turnstile widget; real devices), 4i (walk each kind of page, the donation box above all); `workers/notebook-service/README.md` "Production" (Workers Paid, BVJ's database); spec item 90 (Apple and Google ids, return addresses); account `CLAUDE.md` rule 11 ("Opening accounts to everyone is its own change": the switch, the key, the notes, the `/delete-account/` rule, the header rule, noindex, `SERVICES`).
- **What happens**: whoever opens accounts must reassemble: the CSP enforced after the week (with the gaps list: `/support/`'s givelively styles and fonts) and a look with the Turnstile widget on the page; production deployed and its plan chosen; privacy and terms (4j); the delete box open (Play); the first-time choice's final words; real devices (4l); Apple and Google ids or a decision to launch without. Some are order-dependent: enforcing the CSP with the widget never seen on the page could break sign-up (the widget needs `challenges.cloudflare.com`; it is in the report-only list's `script-src` and `frame-src`, so it would likely pass, but no one has looked).
- **Evidence**: grep for "before accounts open" and "accounts open" finds only prose in the places above; no checklist.
- **Why it isn't a false positive**: 4l and "What it waits on" in STUDY-DESK.md list risks and dependencies, not gates with state.
- **Fix**: a short "Before accounts open" list in STUDY-DESK.md (item, owner, state) that rule 11 and the service README point to. `4j?` may add items.
- **Confidence**: High that it is absent; its value is a judgment.

##### DOC9-4 · Low · docs · NEW
**Turnstile's "off" wording survived in five places after it went on in the preview (2026-11-25).**

- **Where**, each against `workers/notebook-service/README.md:25, 93-94, 907`, `wrangler.jsonc` (`TURNSTILE_SITE_KEY` set, `TURNSTILE_SECRET` in `secrets.required`), and `DISASTER-RECOVERY.md:174`:
  1. `STUDY-DESK-ENCRYPTION.md`, "Changed in step 4h," item 1 (line 2707): "Neither key is set on the preview or in production yet, so today nothing answers differently."
  2. `STUDY-DESK-ENCRYPTION.md:3224`, item 86: "Neither key is set on any deployment yet."
  3. `STUDY-DESK-ENCRYPTION.md:1778`: "On the preview today it answers `["passkey"]`" (it also answers `turnstile` now).
  4. `workers/notebook-service/README.md:721-742`: "Built in step 4h and off"; "both off until a widget and its secret exist."
  5. `DISASTER-RECOVERY.md:116-119`: "**Turnstile** — two separate widgets, one per form," against the same file's lines 23, 39, and 174 ("three"). Its rebuild steps omit the third widget.
  (The apps file's 2026-11-25 entry and ask 18 are right.)
- **What happens**: BDR's session reading item 86 believes the preview doesn't check; a test client sending an `Origin` to `POST /sign-in/new-passkey/options` without a token now gets `not_allowed` (rule `turnstile`).
- **Fix**: edit the five. **Confidence**: High.

##### DOC9-5 · Low · docs · NEW
**The deletion page is described as unable to delete, unlinked, and taking no request in four places, after 4h built its box.**

- **Where**: `workers/notebook-service/README.md:916-917` ("The deletion page can't delete yet ... step 4h adds the sign-in and the button"); `workers/CLAUDE.md:210-213` ("unlinked until accounts open, and it can't delete anything until the website's sign-in (step 4h) adds the button"); `STUDY-DESK-ENCRYPTION.md` item 70 (about line 3041: "linked from nowhere"; "takes no request yet"); `STUDY-DESK-FOR-THE-APPS.md` ask 15 ("The page can do that only once the website has sign-in (step 4h)"). Code: `src/pages/delete-account.astro:8-18` (the box is built) and `src/scripts/desk/account/page.js:376` (the account home links to the page).
- **Fix**: say the box is built, opens only where accounts are open, and the page is linked from the account home. **Confidence**: High.

##### DOC9-6 · Low · docs · NEW
**`src/scripts/desk/account/CLAUDE.md` says `/delete-account/` is "in the sitemap, as the stores require"; the config removes it from the sitemap.**

- **Where**: that file's "Routes" table against `astro.config.mjs:81-82` (`if (slug === 'delete-account') return false;`), the page's own header comment, `workers/CLAUDE.md:210`, `DISASTER-RECOVERY.md:222`, and spec item 70 ("out of search and the sitemap"). Root `CLAUDE.md:230` says "noindex."
- **What happens**: a session told "in the sitemap" would add it back; Play needs the address, not a sitemap entry. Rule 11's launch list names whether `/account/` stays noindex but not whether `/delete-account/` rejoins the sitemap (DR says it will once accounts open).
- **Fix**: correct the row; add the sitemap question to the launch list (DOC9-3). **Confidence**: High.

##### DOC9-7 · Low · docs · NEW
**The spec's cancel rule for a waiting request is garbled and matches no code.**

- **Where**: `STUDY-DESK-ENCRYPTION.md:1706`: "Until it is carried out it can be canceled, a minute before `due` or twenty minutes after." `workers/notebook-service/src/waiting.js:184-199` has no time check. (MH9 raised it; I confirmed in code.)
- **Fix**: delete the clause; "until it is carried out" is what the code does. **Confidence**: High.

##### DOC9-8 · Low · docs · NEW
**The spec's front matter and "Order of work" were not updated past 4g, and one sentence overstates what waits on BDR alone.**

- **Where**: `STUDY-DESK-ENCRYPTION.md:3-8` (status lists 4b, 4c, 4e, 4f; paragraphs add 4g; neither 4d nor 4h appears, though "Changed in step 4h" exists at line 2656); "Order of work" item 3 (line 2257): "Deploying it to the preview address is BVJ's to do or to ask for (the service's README has the steps)" (done 2026-11-23); item 6 doesn't say 4g and 4h are built. "Still open" opens with "1 to 15 now wait on BDR alone," but item 14 contains the exact-tie proposal "which BVJ has not decided," and `src/scripts/desk/sync/CLAUDE.md` rule 9 keeps `SERVICE_WINS_TIE` as the shipped behavior. Every place agrees it is a proposal (STUDY-DESK.md 4d, spec 14, the format's "Clocks," ask 11.3, sync rule 9), so the decision record is coherent; only the "BDR alone" sentence is loose.
- **Fix**: add 4d and 4h to the status paragraphs; drop the deploy sentence; qualify "1 to 15." **Confidence**: High.

##### DOC9-9 · Low · copy · NEW
**One thing, several names.**

| Thing | Names (where) | What a reader sees |
|---|---|---|
| The key's home | "Follows my account" (setup choice, `desk-account-words.mjs:168`); "Follows your account" (home, line 229); spec and CLAUDE.md: "follows my account" | both, in first then second person |
| Sign-in methods | "Ways to sign in" (heading), "way to sign in" (`wayLast`); "way in" (spec, CLAUDE.md, `header-entry.js`); "a new way to open the notebook" (a holder); "holder" (spec, code) | "ways to sign in" only; never "way in" or "holder" |
| This machine | "this computer" (sync status, "Stop syncing on this computer"); "this device" (choice "This device only," removal fallback) | both |
| The service | "the notebook service" (README, CLAUDE.md), "the service" (spec), "the sync service" (BDR-ONBOARDING), "the sync Worker" (STUDY-DESK.md 4c) | docs only |
| Cloudflare plans | "Workers Free/Paid," "the Free plan," "Free" | docs only |
| The preview's sign-in | "the preview's way in" (spec, README), `POST /preview/session`, `PREVIEW_SIGN_IN` | docs only; consistent enough |
| Recovery and approval | "recovery code" everywhere; "approval code" only in spec and one code comment; reader sees "the code the other device shows" | fine |

Nothing is a bug; the first row is the one a reader could notice. **Fix**: pick one voice (`4j?` owns the first-time choice's words). **Confidence**: High on the facts, Low that it matters.

##### DOC9-10 · Low · docs · NEW
**A root rule is stated without its exceptions: the account code loads for readers without the Study Desk.**

- **Where**: root `CLAUDE.md:85` ("The Study Desk is downloaded only with `data-desk="on"`, save a shared sheet's link opened on a phone") against account `CLAUDE.md` rules 11 and 12: `account-gate.js` is the static script on `/account/`, `/account/connect/`, and `/delete-account/` for every visitor, and `page.js` (the "basics" of rule 12) runs on every device, phones included, once accounts are open. `Layout.astro`'s pre-paint script reads `?account=` on every page.
- **What happens**: no reader is affected today (accounts closed). At launch every `/delete-account/` visitor on any device gets the account code, and the root rule is what the next session trusts.
- **Fix**: add "and the account pages' own gate" to the root rule and to the launch list. **Confidence**: High.

##### DOC9-11 · Low · docs · NEW
**Smaller stale sentences, each checked against code or a later record.**

1. `src/scripts/desk/sync/CLAUDE.md` rule 2: "Only `desk/store.js` and `desk/first-stage.js` import `start.js`," but `desk/account/notebook.js:93` imports it statically (loaded only with `data-desk="on"`), and the same file calls the account pages its "only caller."
2. Account `CLAUDE.md`, "Testing": the rig "runs against the deployed preview with `?account=preview`" from `http://localhost:4321`; with Turnstile on for `litbible.net` alone, an account can't be begun that way (its own "Where it stands" and STUDY-DESK.md 4h say so; "Testing" doesn't).
3. `STUDY-DESK-FOR-THE-APPS.md` 4c entry (line 1096): "A session lasts 30 days (40), which sign-in may change." Not marked overtaken by item 52, though the file's rule says an overtaken entry is marked.
4. `STUDY-DESK-FOR-THE-APPS.md:1370, 1377` cite "item 4" and "item 7" for what are items 2 and 4 in the spec's "Still open"; `src/lib/desk-records.mjs:27, 278, 317` cite "item 20, rule c" where the talk-through table has rule c at row 19 (MH9; the second not rechecked by me).
5. `src/lib/desk-records.mjs` (comment above `RENAMED_MARKERS`), `STUDY-DESK-FORMAT.md:157-161`, and STUDY-DESK.md 4d say "the apps haven't listed the names they ever wrote (ask 4)." iOS has (eight names, all covered by the six markers plus `RENAMED_MARKERS`); only Android's answer is open.
6. `BDR-ONBOARDING.md:262-274`: "The vectors go under `test/fixtures/`" and "the website's side of sync once it's built" are both done; it lists `workers/` as outside BDR's areas though BDR is second responder for the service and rolls it back from the Actions tab, and says nothing of that.
7. `src/pages/privacy.astro:106-111` describes Turnstile for the contact forms only ("invisible" mode); the notebook service's widget is Managed and appears when a reader presses "Create an account." `4j?`
8. Root `CLAUDE.md` calls `STUDY-DESK.md` "about 500 KB"; it is 691 KB.
9. `public/CLAUDE.md` agent-discovery bullet: "The site has no auth ... or write API" is true only while accounts are closed.

**Confidence**: High on each quoted pair.

##### DOC9-12 · Nit · docs · NEW
**A report can be read as a vote.** The spec's "Seen in the browser run" says a copied counting passkey is refused "as 51 says it should be," while item 51 is undecided and BVJ leans the other way. The text only reports what happened, but a skimmer may take it as support for refusing.

- **Fix**: say "as the service does today."

### Improvements

- Give the apps file a short "since you last read" line per day; it has 20 asks and 20 entries, and BDR's answer in #701 sits beneath five newer entries.
- A test that fails when a doc's "(item N)" points at a "Still open" item whose heading doesn't match (MH9's three cites); the numbers keep growing.
- Say in the service README whether the account is on Workers Free (DOC9-2); RUNBOOK 3 depends on it.

### Questions for the owner

1. **Is the account on Workers Free or Paid today?** For answering now: DOC9-2's shared allowance turns on it. For waiting: production isn't deployed. My pick: answer now; it is one dashboard look.
2. **Should one "Before accounts open" list live in STUDY-DESK.md?** For: DOC9-3. Against: step 4l may be that already. My pick: yes, one line per gate with owner and state.
3. **Which of iOS's 22 findings does BVJ's side take?** For deciding now: each is cheap before the freeze. Against: BDR may have settled some in the apps. My pick: take the spec-wording ones (bytes, UTF-16, surrogates) and the test fixes; leave key storage to BDR with an acknowledgment line.

### What held up

Decisions that read the same in every place I compared:
- Sessions: 30 days, extended by use to 365 (`session.js:37-39`), in STUDY-DESK.md 4e, spec items 40 and 52 and line 1346, and the apps file's 4e entry (the 4c entry is the unmarked one, DOC9-11).
- Rollback: the GitHub workflow (`name: Notebook service`; "Run workflow," environment `preview`, action `rollback`) agrees across STUDY-DESK.md 4c, spec 17, apps asks 6 and 10, `workers/CLAUDE.md`, `.github/CLAUDE.md`, and `DISASTER-RECOVERY.md`. The production jobs are gated by `NOTEBOOK_PRODUCTION_DEPLOYS` (not set) and an environment BVJ has not made (`notebook-service-deploy.yml:195-260`); "prepared, not deployed" everywhere, with a placeholder database id in `wrangler.jsonc`.
- Turnstile apart from DOC9-4: preview only, widget for `litbible.net` alone, apps unchecked without `Origin`; BVJ's yes is for the website's widget (68), the design is Claude's (86), and the apps' attestation question is open (ask 18).
- Recommendation versus decision: no place says BVJ decided the exact-tie rule, item 51, or item 62. The "ask BDR" items (41, 45, 48, 53, 61, 65, 67, 70, 73, 81, 83, 84) match between STUDY-DESK.md 4e, 4f, and 4g, the spec, and asks 13, 14, and 16. The "eight choices BVJ kept" in 4h (seven plus the three-second wait) matches account `CLAUDE.md`.
- Numbering: spec items 1 to 90 and asks 1 to 20 have no gap or duplicate (MH9); the counts in prose ("yes to thirteen," "fifteen choices," "eleven choices") match their lists.
- Vectors: merge vectors `version` 9 with 91 cases and crypto `vectorsVersion` 2 equal `CRYPTO_VECTORS_VERSION`, as the docs say.
- The handovers' stale sentences are gone: "Nothing in the website imports the service," "seen by neither BVJ nor BDR," and "sign-in to come" in the apps file's 4c entry return no grep hits.
- About 45 claims true against code, including every module and helper named in the sync and account `CLAUDE.md` files (all exist), `NEWS_EVERY_MS = 15 * 60_000`, `REST_WAIT_MS = 3000`, `WAIT_DAYS = 7`, limits 60 and 1,200, `SERVICES` (three origins), `SERVICE_WINS_TIE`, `RENAMED_MARKERS` (`bookmark`, `ribbon`, `star`), six `MARKERS`; `lit-desk-account`, `lit-desk-account-last`, and `lit-desk-sync` all named on `/privacy`; `invocation_logs: false`; production's config has no `PREVIEW_*`; `secrets.required` holds `PREVIEW_SECRET` and `TURNSTILE_SECRET`; `_headers` names both notebook origins in `connect-src`, carries `report-uri` plus `report-to` and `Reporting-Endpoints: csp=...`; `ci.yml`'s three Worker test jobs; the `summary` script in `workers/csp-reports`; the sitemap rules for the account pages.

### Not reached

- Android's side: no Android answers exist to check.
- Each of the roughly 65 "Still open" cross-references (MH9 did them; I spot-checked three).
- The 4d diff of `STUDY-DESK-FORMAT.md` beyond the marker, vectors, and clock sections.
- Whether the live account is on Workers Free (DOC9-2); the dashboard is out of bounds.
- `/privacy`'s full account section (step 4j is writing it).

## Appendix L: The mechanical tables (`MH9`, Haiku)

Saved by the orchestrator from MH9's returned message (MH9 did not write the file itself). Commit `3ef75d8e`, read-only. Scripts and raw outputs: `scratchpad\audit9\MH9\` (still-open.mjs, status-sentences.mjs, asks.mjs, refs.mjs, refs2.mjs, still-open-refs-multiline.txt). MH9 did not run tests; everything is from reading and grep. These are tables for the coherence auditor to judge, not findings.

Mismatch counts: Table 1, 18. Table 2, 1. Table 3, 3. Table 4, 25 (23 routes with a column gap, plus 2 notes).

### Table 1: refusal words

Spec = `STUDY-DESK-ENCRYPTION.md`, "What the service answers when it refuses" (lines 2069 to 2090, prose 2092 to 2106). Service = `workers/notebook-service/src`. Fake = `test/helpers/fake-notebook-service.mjs`. Website = `src/lib` (`desk-sync-engine.mjs` "engine", `desk-account-words.mjs` "words"). Every word's status agrees across spec and service; no word has two statuses.

| word | spec | service (file:line) | in fake | website handling | reader sentence |
|---|---|---|---|---|---|
| sign_in | 401 | 401 (session.js:93,107,188) | yes | engine:216 signedOut; words:382 | yes; sync status.mjs:114 |
| not_open | 403 | 403 (session.js:147; waiting.js:133,190) | yes | engine:221 Behind | no (account side default, words:389) |
| old_key | 409 | 409 (approvals.js:174; rows.js:135; session.js:159) | yes | engine:221 Behind; words:383 | yes |
| wrong_proof | 403 | 403 (session.js:190) | yes | engine:259 cantOpen; words:383 | yes; sync status.mjs:131 |
| lists_changed | 409 | 409 (session.js:164) | NO | words:383 | yes |
| already_set_up | 409 | 409 (account.js:119) | yes | words:381 | yes |
| no_notebook | 409 | 409 (session.js:153) | yes | engine:261 otherNotebook | no (account side) |
| exists | 409 | 409 (approvals.js:51,52,135,147,179; devices.js:83,201-207; preview.js:101; signin.js:214; ways.js:98,123,133; waiting.js:91) | NO | words:380 (waiting only) | partial |
| gone | 410 | 410 (account.js:56; approvals.js:25; devices.js:82; signin.js:87; ways.js:89,181; waiting.js:191) | yes | engine:260 removed; words:384 | yes |
| not_found | 404 | 404 (index.js:187; devices.js:57) | yes | engine:235 removed (keyring only) | no |
| bad_request | 400 | 400 (http.js bad(); devices.js:51) | yes | none | no |
| not_allowed | 422 | 422 (http.js notAllowed; 17 rules, all named in spec) | NO | words:377-379 (turnstile, last_way, passkey_holds_key only) | partial |
| passkey_refused | 403 | 403 (passkey-form.js:93; signin.js:115,143,144,158) | NO | words:375-376 | yes |
| token_refused | 403 | 403 (signin.js:227) | NO | words:386 | yes |
| provider | 502 | 502 (signin.js:228; ways.js:188,192; waiting.js:145; turnstile.js:83,86,90) | NO | words:387 | yes |
| too_large | 413 | 413 (http.js readJson; rows.js:102) | yes (fake:258,376) | none | no |
| too_many | 429 | 429 (approvals.js:53; lists.js:120,125; ways.js:44) | NO | words:385 | yes |
| slow_down | 429 | 429 (limits.js:65, retry 60; Retry-After index.js:167) | yes | engine:217-219 slowed; words:385 | yes |
| busy | 503 | 503 (db.js:86; session.js:82; signin.js:327,335) | yes | engine:212 (retries twice); words:385 | yes |
| error | 500 | 500 (index.js:212) | yes | engine:210 fallback; words:389 generic | default only |
| preview_secret | 401 | 401 (preview.js:52) | NO | none (website never calls preview routes) | no |

Mismatches:
1. `too_large` carries `what: "rows"` (rows.js:102); the fake sends `what: "body"` (fake:258); the spec lists only `limit`.
2 to 9. Eight words missing from the fake: lists_changed, exists, not_allowed, too_many, provider, passkey_refused, token_refused, preview_secret.
10 to 17. Eight words with no reader sentence on the account side (failureWords falls to the default at words:389): not_open, no_notebook, not_found, bad_request, too_large, preview_secret, exists (every kind but waiting), not_allowed (every rule but turnstile, last_way, passkey_holds_key: holder_needed, already_open, own_device, every_device, every_holder, keep_own_device, requester, no_grant, distinct_ids, one_recovery, one_holder_per_passkey, passkey_unknown, passkey_not_synced, prf_results).
18. Sync side: the status line (desk-sync-status.mjs:131-133) gives every other sync refusal word the same default sentence ("Sync ran into a problem..."), since engine:630 publishes reason = the word and status.mjs has no case for it.

### Table 2: numbers and limits

All agree across spec, service, website, README, and the apps file (max record 1,048,576 plaintext; 500 rows a push; pages of 500 rows and 4,194,304 characters; 100 devices; 20 holders; 20 ways; 3 approvals at once; sessions 30 days, extended by use to 365, a day's step; challenges five minutes; approval code 10 bytes, 16 Crockford characters, ten minutes; recovery code 15 bytes, 24 characters in six groups; five wrong proofs; seven days' wait; hourly run, 100 due per run; trash 30 days; key 32 bytes, nonce 12, tag 16, padding 256; card and holder record up to 4,096; keyring up to 65,536; PRF input "lit-notebook/1 prf"; crypto vectors version 2; merge vectors version 9; body 4,194,304 (client budget 4,000,000); Turnstile token 2,048; identity token 8,192; rate limits 60 and 1,200 a minute; retry 60 s), except:

- **Cancel window.** The spec (line 1706) says a request can be canceled until carried out, "a minute before due or twenty minutes after"; nothing in the service (`waiting.js:184-199` `deleteWaiting` has no time check), the website (`desk-account-session.mjs:187`), the README, the apps file, or the tests implements a window. (MH9's reading; to be checked against the spec's sentence.)
- The website keeps no cap of its own on devices, holders, or ways (the service enforces them).

### Table 3: numbering

(a) The spec's "Still open": items 1 to 90, in order, no gap, no duplicate. Statuses (abbreviated): BVJ decided or said yes with BDR to confirm on 3, 14 (one part not decided), 15, 17, 21, 23, 31, 32, 34, 37, 39, 40, 42 to 44, 46, 47, 49, 50, 52, 54 to 60, 63, 64, 66, 68 (part), 69, 71, 74 to 80, 82, 85 to 88, 90; "ask BDR" on 41, 45, 48, 53, 61, 65, 67, 70, 73, 81, 83, 84; open with no answer: 51 (BVJ leans no), 62; no status words: 1, 2, 4 to 13, 16, 18 to 20, 22, 24 to 30, 33, 35, 36, 38, 89. 72 is a record of tests waiting on BDR's identifiers.

(b) `STUDY-DESK-FOR-THE-APPS.md`: asks 1 to 20, no gap, no duplicate; in-body "Ask N" headings agree.

(c) 65 explicit "Still open" references across the repo: none points at a missing item. Subject checks that fail (Medium confidence each):
- `src/lib/desk-records.mjs:27, :278, :317` and `test/desk-records.test.js:173` cite "item 20, rule c" for BDR's 2026-10-09 answer on deleting; the talk-through table in `STUDY-DESK.md` lists rule c's subject ("Tombstones after the trash empties") as row 19.
- `STUDY-DESK-FOR-THE-APPS.md:1370` cites "(item 4; BVJ)" for the reader choosing whether the key follows the account; in the spec's "Still open," item 4 is the signing key and the reader's choice is item 2 (the list this cites may be another).
- `STUDY-DESK-FOR-THE-APPS.md:1377` cites "(item 7)" for device signing keys "reserved now and enforced later"; in "Still open," item 7 is the key proof and the signing key is item 4 (same caveat).

### Table 4: routes

Every router route appears in the spec; no spec route is missing from the router; no route the website sends is missing from the router or the spec. The website sends none of `GET /`, `POST /preview/session`, `POST /preview/passkeys`. The service README lists 16 of the 37 routes; it omits `GET /`, `DELETE /session`, `GET /holders`, `POST /holders`, `GET /keyring`, `GET /devices`, `POST /devices`, `DELETE /devices/:id`, `POST /approvals`, `GET /approvals/:id`, `POST /approvals/:id/grant`, `POST /approvals/:id/accept`, `POST /sign-in/passkey/options`, `POST /sign-in/passkey`, `POST /sign-in/new-passkey`, `POST /sign-in/google`, `POST /sign-in/challenge`, `POST /ways/passkey/options`, `POST /ways/passkey`, `POST /ways/apple`, `POST /ways/google` (the README may defer to the spec on purpose).

Notes:
- `DELETE /devices/:id`: the spec's column says "a session attached to that device"; the code takes any signed-in session and then refuses `not_allowed` `own_device` (devices.js:170). To be checked.
- `POST /sign-in/challenge` is routed only where Apple or Google is on (index.js:106); the spec's table does not say so.
- `POST /approvals/:id/accept`: spec "the session that made the request"; code `needNotebook` plus `not_allowed` `requester` (approvals.js:170). Agrees in effect.

### Not reached

Website failure handling outside the account words and the sync engine; the waiting-request sentences in full; the website's merge-vector version check; "seven days" wording in the website; the apps file's session wording beyond the lines cited; the spec's preview routes' session kinds.

## Appendix M: Copy rules and SEO (`CP9`, Haiku)

Saved by the orchestrator from CP9's returned message (CP9 did not write the file itself). Scripts and outputs: `scratchpad\audit9\CP9\` (added.diff, scan.mjs, literals.cjs, lits.jsonl, htmltext.cjs, text-*.txt, terms.cjs, pf.cjs, loaders.cjs).

### Summary

The copy rules hold in the window's reader text. The real problems are word drift for the same local place ("this computer," "this browser," "this device"), internal planning notes shipped in inline scripts on every page, and the client-side `?account=preview` gate (documented as intended, KNOWN). The SEO state of the account-family pages is clean. No secret found; nothing loaded live or sent to the preview service. Counts: Critical 0, High 0, Medium 0, Low 3, Nit 2.

### Part 1: copy rules

Checks (zero violations unless stated): em dash U+2014, 0 in the 5,561-line diff, 0 in 294 literals, 0 in the four rendered pages; en dash 0; straight double quotes in reader text 0; straight apostrophes in reader text 0 (only developer strings, rows 1 to 7 below); a period or comma outside a closing quote 0; a semicolon or colon inside one 0; British spellings 0 (the "labelled" hits are `aria-labelledby`); Oxford comma in the window's copy, 0 misses (one outside the window, row 8); "log in" or "login" 0.

| # | file:line | text | rule |
|---|---|---|---|
| 1 | src/scripts/desk/account/turnstile.js:21 | "turnstile: the widget didn't start" | straight apostrophe (developer error string) |
| 2 | src/scripts/desk/account/turnstile.js:22 | "turnstile: the widget couldn't be loaded" | same |
| 3 | src/scripts/desk/sync/start.js:179 | "the device's private key can be read out" | same (error detail) |
| 4 | src/scripts/desk/sync/connector.js:264 | "the tabs couldn't agree on one to sync" | same (log text) |
| 5 | src/scripts/desk/sync/connector.js:279 | "desk-sync: the tab that syncs didn't answer" | same |
| 6 | src/scripts/desk/sync/sync-db.js:90 | "desk-sync: IndexedDB isn't available" | same |
| 7 | src/scripts/desk/sync/sync-db.js:126 | "desk-sync: the loop's state is written by the loop" | same (thrown Error) |
| 8 | src/components/AppsLaunchPopover.astro:80 (outside the window) | "Daily and Lectionary readings, notes and highlights" | Oxford comma |

Word variants used two ways for one thing:
- The local notebook's place: "this computer" 34 (desk-account-words.mjs 18, desk-sync-status.mjs 16); "this browser" 14 (words 10, desk-reminder.mjs 2, connector.js 2); "this device" 7 (all in words, e.g. :171 "This device only," :230, :231, :234); "your device(s)" 5; "your browser" 3. Example: desk-account-words.mjs:136 "The notebook in this browser is still here." against desk-sync-status.mjs:127 "The notebook on this computer is still here."
- Adding a second computer: "Add a device" (connect.astro:22, :28, title and H1) against "join," "joined," "join by approval" (desk-account-words.mjs:196, :213, :230).
- Consistent and fine: "sign in" (verb), "sign-in" (noun), "Sign in" (button); "Sign out"; "Remove" for devices, passkeys, and ways against "delete" for the account; "recovery code" (never "recovery key"); account and notebook.
- Nit: the account menu is "Account and devices" (SiteHeader.astro:231, :310) on a computer and "Account" in the phone menu (SiteHeader.astro:661).

### Part 2: SEO and leaks in dist/

Account-family pages (account, account/connect, delete-account, desk, desk/help, notebook, sheets, collections): all `noindex,follow`, canonical to self (except `notebook/help/index.html`, a 324-byte meta-refresh stub, noindex, canonical to /desk/help/). None is in `sitemap-0.xml` (290 locations; only /privacy/ matches the account paths). No `data-pagefind-body` on any; the body carries `data-pagefind-ignore` (Layout.astro:262). The 38 Pagefind fragments, decoded, hold no URL for these paths.

Discovery files (robots.txt, llms.txt, llms-full.txt, .well-known/api-catalog, apple-app-site-association, assetlinks.json): no mention of account, notebook, desk, preview, sync, or delete. `_headers` names the two notebook hosts only in the report-only CSP's `connect-src`.

Sensitive strings: `notebook-preview.litbible.net` and `notebook.litbible.net`, 2 files each (`_astro/desk-sync-link.*.js`, `_headers`); `account=preview`, 355 HTML files (the inline header script and its comments); `PREVIEW_SECRET`, 0; `lit-desk-account`, 355 HTML files and 3 chunks; `TURNSTILE`, 0 (lowercase in 6 chunks and the existing newsletter script).

Chunk-to-page map: `account-gate.*.js` (1.1 KB) is loaded statically by /account/, /account/connect/, and /delete-account/, and loads `page.js` only if the switch is set or `data-desk="on"`. `page.*.js`, `desk-account-words.*.js`, `desk-sync-link.*.js`, and `header-entry.*.js` are reached only through gated `import()`s (header-entry only with `data-desk="on"` and `data-account="open"`). Chapter pages load no sensitive chunk.

`dist/api/`: names no notebook, passkeys, lit-desk, Study Desk, accounts, or sign-in feature; "account" and "sync" occur only in scripture and glossary text.

### Findings

##### CP9-1 · Low · copy · NEW
**The same local place is "this computer," "this browser," and "this device."**

- **Where**: `src/lib/desk-account-words.mjs:136` against `src/lib/desk-sync-status.mjs:127`; "This device only" at words :171, :230, :234 beside :196 "This computer needs the notebook's key."
- **What happens**: a reader meets three names for one place on the same screen family.
- **Evidence**: counts above (`CP9\terms.cjs`).
- **Fix**: one term, "this computer," with "browser" only where the passkey belongs to the browser. Needs BVJ's copy decision.
- **Confidence**: High.

##### CP9-2 · Nit · copy · NEW
**Developer strings (rows 1 to 7) use straight apostrophes.** Fix: curly ones if any ever reaches a reader; otherwise leave. Confidence: Medium (reach to the UI not traced).

##### CP9-3 · Nit · copy · NEW (outside the window)
**An Oxford-comma miss in `AppsLaunchPopover.astro:80`** (row 8), shown on every page. BDR or BVJ owns this copy. Confidence: High.

##### CP9-4 · Low · privacy / docs · NEW
**Internal planning notes ship to every reader's page.**

- **Where**: `src/layouts/Layout.astro:123` (HTML comment "(STUDY-DESK.md, phase 1b)"), `:171` (inside an `is:inline` script, "(BVJ, 2026-11-25)"); `src/components/SiteHeader.astro:379` (inline script comments naming "step 4h," "E130," `lit-desk-account-last`, and `desk/account/header-entry.js`).
- **What happens**: every page's HTML carries dated owner initials, step names, and internal file paths.
- **Evidence**: `dist/john-3/index.html`: "BVJ" 3, "STUDY-DESK" 1, "step 4h" 1, "E130" 1.
- **Fix**: move these notes into bundled modules (whose comments are stripped) or out of `is:inline` scripts and HTML comments. Nothing secret; low priority.
- **Confidence**: High.

##### CP9-5 · Low · security / privacy · KNOWN (`src/scripts/desk/account/CLAUDE.md`, rule 11)
**`?account=preview` works from any URL on every page.** The gate is client-side; real protection rests on the preview service's own checks. Rule 11 records this as intended. Fix: keep it until launch, then retire the switch; confirm the service enforces Turnstile and rate limits by itself. Confidence: Medium.

### Improvements

- `notebook/help/index.html` is a meta-refresh stub; a redirect in `astro.config.mjs` would stop it being a page.
- `src/pages/account/connect.astro:15` says the apps claim /account/ under BDR's proposal 6b, but `apple-app-site-association` does not yet list `/account` or `/account/*`. A watch item for the apps' release.

### Questions for the owner

1. Which term for the local place: "this computer" (34 uses, CP9's pick, since the desk is desktop-only), "this browser," or "this device"?
2. Should `?account=preview` stay openable from any URL until launch? CP9's pick: yes, with the service's own checks confirmed.
3. Strip internal notes from inline scripts and comments now, or at launch? CP9's pick: now.

### What held up

No em dashes, straight double quotes, misplaced punctuation, or British spellings in the window's reader text; "sign in" and "sign-in" used consistently; "remove" and "delete" follow the object; eight account-family pages noindex, self-canonical, out of the sitemap and Pagefind; no discovery file names the account pages or the service; `PREVIEW_SECRET` absent from `dist/`; `dist/api` untouched by the feature; chapter pages download none of the sensitive chunks.

### Not reached

No request to litbible.net or the preview service; the Turnstile key and the service's checks; Apple's and Google's policy pages.

## Appendix N: Test quality (`TQ9`, Sonnet)

Slice: the notebook service's tests (`workers/notebook-service/test/`), the website's crypto, passkey, and account tests, and the stand-ins they run on. Commit `3ef75d8e`. Nothing in the repo was changed; every mutation ran on a copy in `TQ9\ns\` (service) or `TQ9\web\` (website).

### Summary

I made 172 deliberate faults, one at a time: 104 in the service's `src/` and 68 in the website's `desk-crypto.mjs`, `desk-passkey.mjs`, and `desk-account.mjs`. The service's full suite (2,377 tests) caught all 104, but 20 of them (19%) were not caught by the test file that is named for the code, only by some other file. On the website, 52 of 68 were caught and **16 survived** every behavior test I ran (23.5%). Three of the 16 are probably equivalent (WebCrypto would reject the same input anyway); 13 are real gaps. The most serious: the default nonce of the device-card and holder-record seals is never exercised by a test (all-zero nonces would pass), the check that a grant's signing key matches the device is untested, and so is the rule that an incoming keyring must keep every key the device already holds. Findings: 0 Critical, 0 High, 2 Medium, 5 Low, 1 Nit. No secret and no live vulnerability was found.

### Findings

##### TQ9-1 · Medium · tests · NEW
**No test would notice if `sealDeviceCard` or `sealHolderRecord` used the same nonce every time, though every production call relies on the default.**

- **Where**: `src/lib/desk-crypto.mjs:1044` (`sealDeviceCard`), `:1143` (`sealHolderRecord`); callers `src/lib/desk-account.mjs:119`, `:173`, `:511` pass no nonce. Sibling defaults at `:1059`, `:1073`, `:1078`, `:1257` follow the same pattern (not mutated; same expectation).
- **What happens**: a reader's device card is sealed under the notebook key each time the card changes. If a refactor turned the default into a constant (or dropped `randomBytes`), every card would reuse one AES-GCM nonce under one key, which exposes the XOR of plaintexts and the authentication key. The suite stays green.
- **Evidence**: mutations X11 and X12 (default `randomBytes(NONCE_BYTES)` replaced with `new Uint8Array(NONCE_BYTES)`) survived `desk-crypto`, `desk-account`, `desk-passkey`, `desk-account-page`, `-providers`, `-words`, and the five `desk-sync-*` files (results in `res-web4.json`, `res-web3.json`). By contrast X13 (the random generator itself returns zeros) and the matching `sealRecord` default were caught, so the property is tested for rows and not for cards. The tests pass explicit nonces from the published vectors, so the default path has no assertion.
- **Why it isn't a false positive**: I looked for a "two seals differ" test on these two functions; none exists. The one failure I first saw was an artifact of my copy (`desk-sync-gate` fails at baseline there because `src/styles` is absent), which I excluded.
- **Fix**: add a test per sealer: seal the same input twice with no nonce and assert the two nonces and ciphertexts differ and each opens. Cheap and mechanical.
- **Confidence**: High. The faults ran and the output was read.

##### TQ9-2 · Medium · tests · NEW
**Two guards that protect the notebook key from a wrong device or a rolled-back keyring have no test that fails without them: the signing-key check in `acceptGrant`, and "every key we hold must be in the incoming keyring" in `checkKeyring`.**

- **Where**: `src/lib/desk-crypto.mjs` `acceptGrant` (the `opened.sign` against `device.sign` comparison) and `checkKeyring` (`if (!theirs || !bytesEqual(theirs, key)) refuse("keyChanged")`).
- **What happens**: if the first were dropped, a grant card whose signing key is not the device's would be accepted. If the second were weakened, a service that returns a keyring with an old key missing would be believed. Both are the checks the encryption design leans on against a hostile service.
- **Evidence**: X27 (signing-key comparison removed) and X17 (`!theirs ||` removed) survived all the behavior files above. The primary `desk-crypto.test.js` has the vectors but never builds a card with the wrong `sign`, nor a keyring that lacks a held kid.
- **Why it isn't a false positive**: neighbors X14 to X16 and X18 to X26 (the other `checkKeyring` and `openHolder` checks, `acceptGrant`'s other checks) were caught, so these two are the specific untested branches. `desk-sync-engine` and `connector` exercise `checkKeyring` only with consistent keyrings.
- **Fix**: add negative cases: an approver's card whose `sign` differs from the asker's, and an incoming keyring missing one held kid (expect `keyChanged`).
- **Confidence**: High.

##### TQ9-3 · Low · tests · NEW
**Eight smaller website faults also survive: the page's PRF input losing to the service's extensions, an empty user handle sent, PRF output aliasing the platform's buffer, extractable imported keys, a multi-key approval proof, `makeGrant`'s own MAC re-check, and the request's point checks.**

- **Where**: `src/lib/desk-passkey.mjs` (`extensions: { ...(publicKey.extensions ?? {}), ...prfExtension(prfInput) }` in both the request and creation builders; the `userHandle` length test; `Uint8Array.from(asBytes(first))`), `src/lib/desk-crypto.mjs` (the `false` extractable flag on the ECDH and HMAC imports; `makeGrant`'s `checkApprovalRequest` call; `checkApprovalRequest`'s `needPoint` calls), `src/lib/desk-account.mjs` (`proofOf(held)` at accept).
- **What happens**: none is exploitable today. They are defenses that rely on one source line: PK3 and PK4 (service extensions spread after the page's PRF input) would let a hostile service choose the salt the PRF is evaluated on; X29 and X30 (keys importable as extractable) widen the exposure if a page script is compromised; PK9 shares a buffer the platform may reuse; AC4 shows tests never use a keyring of more than one key at accept time.
- **Evidence**: PK3, PK4, PK5, PK9, X29, X30, AC4, AC6, AC7 survived (`res-web4.json`). PK6 to PK8, PK10 (the PRF-results-copied-into-the-answer variants, the allow list, `userVerification`) were caught, so the main PRF rule is held.
- **Why it isn't a false positive**: AC6 is partly redundant: `desk-account.mjs:360` calls `checkApprovalRequest` before granting. That is why it is only Low. X32 (`hmacVerify` length), X41 (group bound 6 to 7), and X50 (point validation before `importKey`) also survived, and I judge them likely equivalent because WebCrypto rejects the same input; I did not prove it.
- **Fix**: one assertion each: `extractable === false` on the imported keys; a service extension named `prf` does not change the input the authenticator saw; mutate the buffer after `prfOutput` and see the answer unchanged.
- **Confidence**: Medium (the survivors are certain; whether each matters is judgment).

##### TQ9-4 · Low · tests · NEW
**The service's unit files do not hold several security rules that their names suggest they hold; only other files catch a change.**

- **Where**: `workers/notebook-service/test/webauthn.test.js`, `sessions.test.js`, `approvals.test.js`, `waiting.test.js`, `rows.test.js`.
- **What happens**: no reader loses anything today because the full suite catches each. But a change reviewed against `webauthn.test.js` alone would pass, and CI cost is in running the whole thing.
- **Evidence** (`res-service.json`): survived the nearest file, caught only by the full suite: skip the UP flag (W2), drop the BS-without-BE rule (W4), accept attested data in an assertion (W8), RSA minimum size (W13), EC curve unchecked (W14), CBOR byte-string overrun (C3) and array-count lie (C4), sessions' one-year cap (S2), renewal of a session that is not open (S3), device-entry removal ending a session (S5), wrong-proof limit 5 to 6 (S6), wrong proofs not counted (S7), bearer length (S10), grant under another kid at accept (A5), grant pre-check (A7), limit of 3 in progress off by one (A9), delete or replace carried out before due (Wa3, Wa6), rows write guard not pinning `rev` (R5), and a loosened local-origin pattern (P3). 20 of 104.
- **Why it isn't a false positive**: each was proven caught by the 2,377-test run (failure counts of 1 to 19). The only place a gap is plausible is S6 and S7 (19 tests fail, none in `sessions.test.js`): the five-wrong-proofs rule is tested only through account flows.
- **Fix**: none urgent. If a rule is a named guarantee (UP, five wrong proofs, three approvals), give it a one-line unit test beside the code.
- **Confidence**: High.

##### TQ9-5 · Low · tests · NEW
**The root suite runs the real service on a `node:sqlite` D1 stand-in that is more forgiving than the real D1, so it cannot catch a missing bind or an over-long bind list.**

- **Where**: `test/helpers/real-notebook-service.mjs` (the D1 stand-in); used by `desk-account.test.js`, `desk-account-page.test.js`, `desk-account-providers.test.js`, and the sync tests.
- **What happens**: a statement with fewer bound values than placeholders runs with NULL for the rest. In workerd's D1 (what `vitest` in `workers/notebook-service` uses) the same statement throws `Wrong number of parameter bindings`. The stand-in also has no limit of 100 bound parameters (workerd throws on 101) and models no per-invocation query limit.
- **Evidence**: `d1probe.mjs` (Node) and `ns/test/probe.test.js` (workerd). Findings: fewer binds is NULL on `node:sqlite` and a throw on workerd; 101 binds is fine on `node:sqlite` and a throw on workerd; 1,100 sequential queries pass on both (the local workerd does not enforce the documented per-invocation cap, which I did not fetch and so cannot cite); cascading deletes report changes counts that include cascades on both.
- **Why it isn't a false positive**: the service's own `vitest` suite runs in workerd on the real migrations, so the service itself is covered. The risk is limited to the website-side flows that depend on the stand-in for the service's behavior (the answer is sound only as long as the other suite is also run).
- **Fix**: make the stand-in throw on a bind-count mismatch and on more than 100 binds (two lines each), so both suites agree.
- **Confidence**: High on the differences; Low-severity because of the other suite.

##### TQ9-6 · Low · tests · NEW
**`fake-credentials.mjs` is thin where real authenticators differ, so a few real-device behaviors are tested only in the service's unit tests.**

- **Where**: `test/helpers/fake-credentials.mjs`; `workers/notebook-service/test/authenticator.js`.
- **What happens**: the fake accepts only `{syncs, prf, alg}` at creation, so a counting authenticator (signature counter that rises) is unreachable from the account-page tests; it ignores `signal`, `userVerification`, `pubKeyCredParams`, and `timeout`; the PRF is `SHA-256(secret||input)` rather than the real HMAC-secret; creation responses lack the `publicKey`, `publicKeyAlgorithm`, and `authenticatorData` members that real `toJSON` and Android responses carry (no test mentions `publicKeyAlgorithm`). `authenticator.js` uses a zero AAGUID and counter 0 unless asked.
- **Evidence**: read both files; grep for `publicKeyAlgorithm` in `test/` found nothing. Strengths: `webauthn.test.js` does run the W3C vectors (`none-es256`, `packed-*`, `none-es256-crossOrigin`) and Android client data without `crossOrigin` (about line 402), and `passkeys.test.js` (about line 511) covers a missing `crossOrigin`.
- **Why it isn't a false positive**: those unit tests cover the service side; what is missing is the website page's handling of those real shapes.
- **Fix**: add a second fake creation shape (with the extra members) and a counting option to `create`.
- **Confidence**: Medium.

##### TQ9-7 · Low · tests · KNOWN (`limits.test.js` minute boundary, `greek-query.test.js` timing: named in the brief) plus NEW (the rest)
**A few tests depend on the wall clock or machine speed and can fail on a slow or unlucky run.**

- **Where**: `workers/notebook-service/test/limits.test.js` (windows align to the wall clock; a `beforeEach` waits for the next minute when under 6 s remain, so a run sleeps up to 60 s about one time in six); `waiting.test.js:472` (`took < 10_000` for deleting 20,000 rows) and `:139-147` (`asked >= started` against `Date.now()`); `test/greek-query.test.js:474` (matching under 3,000 ms) and `:531` (parse under 500 ms); fixed sleeps as settle waits: `desk-account-page.test.js:254` (20 ms), `desk-account-providers.test.js:47` (20 ms), `desk-sync-account-notice.test.js:146` (15 ms, 20 uses) and `:611, :617` (30 ms), `test/helpers/account-page.mjs:130` (10 ms after each press).
- **What happens**: under CI load the thresholds can trip or a settle can be too short. The `desk-sync-account-notice` ones also assert an absence ("no bar") after a fixed wait, which passes if the work simply has not run yet.
- **Evidence**: read each; `limits.test.js`'s own comment says it failed a CI run on 2026-11-24. Session-expiry tolerance (29.9 to 30.1 days) at `account.test.js:102`, `passkeys.test.js:187`, `preview.test.js:162`, `providers.test.js:1291` is safe.
- **Why it isn't a false positive**: each is mitigated (the boundary wait, generous thresholds), which is why this is Low. I did not rerun them under load.
- **Fix**: for the absence checks, wait on an event or a `settled()` that awaits the notice's own promise; for the timing checks, keep the ceilings loose or drop them for a count of operations.
- **Confidence**: Medium.

##### TQ9-8 · Nit · tests · NEW
**Some assertions cannot fail or test source text instead of behavior.**

- **Where**: `expect(x).toBeTruthy()` or `toBeDefined()` closing a test, as unused-variable placation: `account.test.js:134, 159, 348`, `devices.test.js:282, 373`, `key.test.js:421`, `rows.test.js:643`, `preview.test.js:85`, `setup.test.js:129`, `limits.test.js:226`. `test/desk-account-header.test.js` (about line 292) asserts an exact minified substring of `Layout.astro`'s pre-paint script, which `desk-prepaint.test.js:170-174` already drives, and breaks on any reformat; the same file, `desk-account-page.test.js:74-79` (`account-gate.js` strings), and `desk-prepaint.test.js` (about 258-270) check wiring by regex.
- **What happens**: nothing wrong today; the placations add no coverage and the source-text checks fail for the wrong reason when the code is reformatted.
- **Fix**: delete the placations; replace the substring test with the behavior one already beside it.
- **Confidence**: High.

### Improvements

- Add a "mutation checklist" in `workers/CLAUDE.md` or the tests' header: the 13 real survivors above are the cheapest regression tests this slice could gain (about 15 assertions).
- Make the website's service stand-in refuse what workerd refuses (TQ9-5); it is two small checks.
- Several website tests assert through `desk-sync-gate.test.js`'s import walk, which depends on `src/styles` existing; if anyone copies the suite elsewhere (as I did) it fails at baseline for that reason alone. Not a repo bug, but worth one comment.

### Questions for the owner

None that only BVJ or BDR can decide. (If BVJ wants a standing mutation check, the harness `TQ9\mutate.mjs` and lists `muts-service.json`, `muts-web.json` are reusable; its cost is about a minute per mutation on the service, 10 to 30 seconds on the website.)

### What held up

- **Service**: 104 mutations across `webauthn.js` (15), `passkey-form.js` (4), `cbor.js` (7), sessions (10), routing and limits (6), approvals (13), waiting and scheduling (8), turnstile (6), preview gating (5), CORS and HTTP (7), rows (9), the check tables (4), sign-in challenges (7), plus ways, key, and device cases (3). 104 of 104 caught by the full 2,377-test suite; 84 caught by the nearest file. Includes Turnstile failing closed, the preview's three gates, the single-use challenge, origin and counter checks, and the 7-day waiting guard (the waiting and scheduled files caught every "before due" fault except that two needed the second file).
- **Website**: 52 of 68 caught by the primary files (`desk-crypto`, `desk-account`, `desk-passkey`), including all of the AAD fields, `sealRecord`'s nonce handling, the other `checkKeyring` and `openHolder` checks (all four), `acceptGrant`'s other checks, recovery-code normalization (except the group bound), approval-key derivation, tag length, `keyProofHash`, and the PRF-results-in-the-answer variants.
- **Fixtures**: `webauthn.test.js` runs the W3C attestation vectors and the Android client-data shapes.
- **Local D1**: batch is one transaction with rollback on a CHECK failure, as in production; BLOBs are moot since the schema stores base64url text.

### Not reached

- Mutations in the sync engine (`desk-sync.mjs`, `desk-sync-engine.mjs`): SY9b's.
- Comparing `fake-notebook-service.mjs` to the real service: done in `SY9.md`.
- `fake-providers.mjs` (Apple and Google are off): read, not mutated.
- The service's per-invocation query limits and parameter caps: I did not fetch Cloudflare's documentation, so the limits are as observed locally, not cited.
- Mutations in `workers/csp-reports`, the deploy workflow, and `desk-sync-property`'s randomized runs (it passed every survivor run but I did not vary its seed).
- Flakiness was read, not measured under load.
- In the repo, `git status` shows `src/scripts/desk/CLAUDE.md` modified. I did not touch it (my work was in copies); it presumably belongs to another auditor or the orchestrator.

## Appendix O: False positives, deliberate choices, and claims that don't hold

Kept so a later audit doesn't raise them again. Each was argued against by a verifier or the
orchestrator and did not hold, in full or in part.

### False positives in full

| Raised by | Claim | Why it doesn't hold |
|---|---|---|
| CP9-2 | Straight apostrophes in reader text | They are in developer strings no reader sees; nothing prints `.message` (VER9b) |
| CP9-3 | The app popover's list lacks its Oxford comma | "notes and highlights" is one item, and the line predates the window (VER9b) |
| MH9 | The spec's cancel window disagrees with the service | "a minute before `due` or twenty minutes after" illustrates "until it is carried out" (the hourly run); the code does exactly that (`STUDY-DESK-ENCRYPTION.md:1705-1707`). Kept as a wording Nit, DOC9-7 (orchestrator) |
| MH9 | `DELETE /devices/:id` refuses what the spec allows | `devices.js:168` refuses `own_device` unless the session is attached to that device, as the spec's table says (`:1491`). The case the bullets miss is COH9-1 (orchestrator, COH9) |
| MH9 | "Item 20, rule c" is unexplained | It predates the window (2026-10-12) and is the table's row 19 (orchestrator) |
| MH9 | The service README lists 16 of 37 routes | By design: the README names the spec as its specification (COH9) |
| MH9 | `POST /sign-in/challenge` is routed only with a provider on | The spec's general rule: "A way that is off answers `not_found` on every path of its own" (COH9) |

### Deliberate

| Raised by | Why it stays |
|---|---|
| LV9-9 | A rename doesn't survive signing out and in: sign out takes the device off the list, which the sentence says (VER9b) |
| CP9-5, with ORC-d | `?account=preview` opens accounts from any page and is a link anyone can send: BVJ chose the switch (E230), and the account file's rule 11 records it (VER9b) |

### Claims inside a standing finding that don't hold

| Finding | Claim | Why not |
|---|---|---|
| SV9-1 | The CSP Worker shares the day's writes | Only if the account is on Workers Free, which no record says (VER9) |
| SV9-3 | The next merge redeploys what was rolled back | Production never deploys on a push (VER9) |
| SV9-5 | A large account "can never be deleted" | By the service alone; RUNBOOK section 7 covers it by hand (VER9) |
| SEC9-1, fix 3 | Add the request's age to `GET /approvals/:id` | It already answers `expires`, ten minutes after the request; only the requester's way in is missing (VER9) |
| SY9b-5 | `slow_down` cuts the backoff short | The service always sends `retry: 60`, equal to the poll (VER9) |
| COH9-2 | The spec misglosses `passkey` | The table's narrowing is scoped to "Signing in" and "Ways to sign in" (VER9) |
| DOC9-1 | iOS's answers were "never taken in" | Eight hours and nine planned PRs after #701; the ask is a triage line (VER9) |
| LV9-5 | The device's Remove button has no device name | It has an `aria-label` with the name (`notebook.js:808`); the passkey's two don't (VER9b) |
| LV9-7 | The stop sentence shows three times | Twice; the notice is suppressed on the account page (`stopped-notice.js:128`) (VER9b) |
| LP9-5 | The spec doesn't say Time Travel keeps the rows | It does (`:1243-1246`); two other sentences say the opposite (VER9b) |
| AC9-9 | The sync words are never checked for copy | `test/desk-sync-status.test.js:144, 262` check some (VER9b) |
| TQ9-2 | Removing the "every held key" check lets a service's rolled-back keyring through | `parseKeyring` refuses any keyring whose kids aren't exactly 1 to `current`, and the backward check runs first; 200,000 fuzzed keyrings, no disagreement. It guards only keyrings this client builds (VER9) |

## Appendix P: Verification: security, the service, sync, cost, coherence, #713, and tests (`VER9`, Opus)

Commit audited: `3ef75d8e`. Nothing in the repository was changed by me, and nothing was sent to either notebook service. My scripts and outputs are in `…\scratchpad\audit9\VER9\`: `chain-no-origin.mjs` (+ `.out.txt`), `lostscan-reload.mjs` (+ `.out.txt`), `coh9-1-rerun.out.txt`, `turnstile-vitest.out.txt`, `privacy-live.html` (one plain GET of `/privacy/`).

**Method alert (not URGENT).** While I worked, the worktree's branch `claude/desk-audit-9-784320` moved from `3ef75d8e` to `37a7498e` (#713, step 4j, merged 21:22 Pacific). The reflog records it as "merge origin/main: Fast-forward"; I ran no command that changes HEAD. #713 touches 28 files, none under `workers/`, `.github/`, `src/lib/desk-sync*`, `src/scripts/desk/sync/`, or `notebook.js`. Of the files I cite, it changed `desk-account-words.mjs` (`addAsk` is identical, line 296 at `3ef75d8e`), `page.js` (a terms link; lines after 290 shift by 11), and `privacy.astro` (it now describes the service's logs, which bears on SV9-6). I re-read those three at `3ef75d8e` with `git show`. The other verifier may be reading `37a7498e`.

### Summary

36 items checked: 14 confirmed, 16 lowered, 0 raised, 6 folded, 0 false positives in full (six findings carry a claim that doesn't hold; listed below). Final severities of the items that stand: **Critical 0, High 0, Medium 4, Low 20, Nit 6.** The four Mediums are SV9-1 (no storage ceiling, live on the preview), SEC9-1 (approval link and missing warning), SEC9-2 (install and test share a job with the Cloudflare token), and COH9-1 (Sign out fails after removal or replacement). Most lowerings follow one rule: the fault is real but sits on the preview (BVJ only, test data) or in production, which isn't deployed, and no reader would meet it as merged; most of these belong on a "before production" list rather than in Medium.

### Verdicts

| ID | As reported | Verdict | Final | Reason and evidence |
|---|---|---|---|---|
| SV9-1 | High | Lowered (carries SEC9-3) | **Medium** | Live on the preview today: `chain-no-origin.out.txt` runs the service's own code with a Turnstile key and secret set, no `Origin`: sign-up 200, setup from the public reference 200, 20 of 20 pushes accepted, 10,000 rows and 75.3 MB stored, 0 siteverify calls. What it denies is a test service and, if the account is on Free, a day of D1 writes; no notebook is read or lost, so it meets no High clause |
| SEC9-3 | Medium | Folded into SV9-1 | (Medium) | The same fault. It adds one true point: "Still open," 68 (spec 3004-3012) weighs sign-up only ("holding nothing") |
| SEC9-1 | Medium | Confirmed | **Medium** | `notebook.js:989-994` fills "Add a device" from the link and clicks its button; `addAsk` (`desk-account-words.mjs:296` at `3ef75d8e`) lacks spec 963's "approve only a device the reader is holding." Needs a stolen sign-in: today only a passkey or the preview secret (Apple and Google off) |
| SEC9-2 | Medium | Confirmed | **Medium** | Workflow 105-126: `npm ci` (no `--ignore-scripts`) and `npm test`, then `npx wrangler` with the token, one job, one workspace; actions pinned by tag. Cloudflare lists D1 and Workers Scripts as account-scope permissions with no per-resource scoping, so the preview's token will reach production's database past its reviewer |
| SV9-2 | Medium | Lowered | Low | True: GitHub's required reviewers "approve workflow jobs that reference the environment," rollback included. But `notebook-production` doesn't exist yet; it is a setup step to get right when BVJ makes it |
| SV9-3 | Medium | Lowered | Low | GitHub confirms "At most one job or workflow run can be `pending`" and a newer one cancels it. But production never runs on a push (`deploy-production`'s `if`), and its group is separate, so only the preview's queued rollback can be canceled by a merge |
| SV9-4 | Medium | Lowered | Low | RUNBOOK sections 1 to 9 have no "stop the service" and no "find the account." BVJ holds the dashboard, the preview has a wipe (README), production isn't deployed: a runbook gap for the launch list |
| SV9-5 | Medium | Lowered | Low | D1's limit is "Maximum SQL query duration: 30 seconds"; the delete is one statement (`waiting.js` `carryOutDelete`) and the replace one batch (`carryOutReplace`). It needs an account far past ordinary use, and RUNBOOK 6 and 7 already send a `failed` count to a manual chunked delete |
| SV9-7 | Medium | Lowered | Low | Free's "50" queries per invocation is KNOWN (README "Production," step 1); production is to be on Paid ("1000"). The starvation needs Apple on (it is off) and over 100 held requests at once |
| SV9-12 | Medium | Lowered (carries SEC9-5) | Low | Numbers confirmed (`store.js:21` 5,000; `wrangler.jsonc:56` 120 a minute; `report.js:31` 20 a post; about 2.1 minutes). Needs a deliberate sender; the summary flags a capped day (`summary.js:114, 131-133`); the README's walk in a real browser is the backstop; at about 27 page views a day no honest source nears the cap |
| SEC9-5 | Low | Folded into SV9-12 | (Low) | The same Worker and the same remedy (one README line) |
| SV9-6 | Medium | Lowered (carries LP9-7) | Low | Cloudflare's Workers Logs page says custom `console.log` output "will be visible" and is silent on what it attaches when `invocation_logs` is false. The service's own lines (`index.js:203-224`, `scheduled.js:47, 66, 68`) hold no id or address. At `3ef75d8e` no public page made a claim. See the paragraph: #713 now does |
| LP9-7 | Medium | Folded into SV9-6 | (Low) | The same unverified fact |
| SY9-1 | Medium | Lowered | Low | Reproduced, and a reload recovers it: `lostscan-reload.out.txt` shows device b gets the edit once device a's engine is rebuilt. Every page load starts with `scanned = false` (`desk-sync-engine.mjs:132`), so on this multi-page site the next navigation pushes the edit. It needs an IndexedDB read to throw |
| SY9b-1 | Medium | Lowered | Low | 11 of 51 survive (`SY9b\mutate-log.txt`: D6, D21, E4, E7, E9, E10, E18, E21 to E23, E27). E7, E10, and E18 are real guards with no test, but the guards exist (`desk-sync-engine.mjs:342, 381, 602`) and 4,000 fuzzed histories converge: a coverage gap, not a fault anyone meets |
| SY9b-2 | Low | Confirmed | Low | `connector.js:437-452`: `stop()` neither aborts nor awaits `running`; `start.js:213-226` clears storage after it |
| SY9b-3 | Low | Confirmed | Low | `STUDY-DESK-FORMAT.md:1375-1400` names lost edits, not revived deletions or buried restores |
| SY9b-4 | Low | Confirmed | Low | `connector.js:170-171` retries `error` on `retryDelay` without end, with the default status line |
| SY9b-5 | Low | Lowered | Nit | The `slow_down` half can't happen: the service always sends `retry: 60` (`limits.js:45, 65`), equal to `POLL_MS`. What remains is a visible tab retrying a failing service every 60 s instead of up to 5 minutes |
| SY9-2 | Low | Confirmed (carries COH9-3, MH9 Table 1 items 1 to 9) | Low | The fake checks the body's size before the session, with `what: "body"` (`fake:258`), hands out `token-1` (`fake:143`) where `BEARER` needs 43 characters (`session.js:48`), and resets `rev` on a replace; its header still claims "the same ... order of checks" |
| COH9-3 | Nit | Folded into SY9-2 | (Low) | The spec's order of `ct` and `too_large`, and `what` on `too_large`: the same drift, one item |
| MH9 T1 | inventory | Folded into SY9-2 | (Low) | The eight words the fake lacks can't be sent on its five routes (`lists_changed` comes from `needCurrentLists`, `session.js:163-165`, used by lists, not rows); only the `what` is drift |
| COH9-1 | Medium | Confirmed | **Medium** | I re-ran COH9's test: 2 of 2 reproduce (`coh9-1-rerun.out.txt`). `DELETE /session` exists (`index.js:45`) and answers 200 to the same session. The spec frames the choice by history (`STUDY-DESK-ENCRYPTION.md:1445-1447, 1534-1536`), which steers an app wrong |
| COH9-2 | Low | Lowered | Nit | The table's narrow gloss is scoped "under 'Signing in' and 'Ways to sign in'" (spec 2078), so for `POST /holders` the general sentence ("the one thing of that kind is already there") applies. What remains: the `POST /holders` row (1492) names no word |
| DOC9-1 | Medium | Lowered (reframed) | Low | #701 merged 2026-11-25 19:59 UTC (11:59 Pacific); the audit commit is 20:11 Pacific. Eight hours and nine PRs of planned 4h work later, "never taken in" overstates. Five of COH9's table rows checked and true (7, 8, 11, 17, 18). The ask should be a triage line per point before the December 24 freeze |
| DOC9-2 | Medium | Lowered | Low | Cloudflare's D1 pricing FAQ: "When your account hits the daily read and/or write limits, you will not be able to run queries against D1." The spec (3027) and README (830) say "a database gets." A wording error; the recommendation (production on Paid) holds either way |
| SEC9-4 | Low | Confirmed (carries ORC-c) | Low | `_headers:38`: `'unsafe-inline'` in the report-only `script-src` that 4i will enforce; no injection sink found. One launch gate with ORC-c |
| ORC-c | Low | Folded into SEC9-4 | (Low) | The same gate: enforce the policy, without `'unsafe-inline'` in `script-src`, before accounts open |
| SEC9-6 | Low | Confirmed | Low | `gh api .../actions/permissions/workflow`: `"default_workflow_permissions":"write"`; `ci.yml` sets no `permissions`; GitHub's workflow syntax: the token's permissions "are initially set to the default setting" |
| SV9-8 | Low | Confirmed | Low | `waiting.js` `deleteAccount`: `revokeApple` once, then the `DELETE` in a separate call; no test races a way added between them. Apple is off |
| SV9-9 | Low | Confirmed | Low | `ways_sign_in` is partial (`WHERE kind <> 'passkey'`, migration 0001:44), so a bound `kind = ?` can't use it; `challenges.account` has no index (0002:39) |
| SV9-11 | Low | Confirmed | Low | The only migration check is `config.test.js:78` (`migrations_dir`) |
| ORC-e | Low | Lowered | Nit | `page.js:422` (at `3ef75d8e`) imports `notebook.js` on every desk-on visit; only desk-on browsers pay, and they load the store and sync code on other pages already |
| ORC-f | Low | Lowered | Nit | 0.074 is inside web.dev's "a CLS score of 0.1 or less" |
| SEC9-7 | Nit | Confirmed | Nit | Harmless departures from WebAuthn Level 3, as SEC9 argues |
| SEC9-8 | Nit | Confirmed | Nit | Preview-only route, test data |

### Lowered or reframed, with reasons

**SV9-1 (High to Medium), with SEC9-3.** The exposure is live today, as the orchestrator told BVJ: the repository is public (`gh api` says `"visibility":"public"`), the preview's address is in `_headers`, a request with no `Origin` skips Turnstile by design (`turnstile.js:107`, "Still open," 86), and the service asks for no attestation, so the public test authenticator signs up. `chain-no-origin.mjs` shows the whole chain on the service's own code with Turnstile configured, with no request to the preview. What an attacker gains: no one's records (accounts are scoped, rows sealed); the ability to stop the preview (about 3.8 MB a push, so its 500 MB on Free fills in about 135 pushes, and a push writes about 1,000 to 1,500 rows, so Free's day of writes goes in 70 to 100); free hidden storage they can fetch back with `GET /rows`; and, if the account is on Free, the account's day of D1 writes. That last one is the part that matters this week: Cloudflare's FAQ speaks of "your account" hitting the limit, so a flood would also silence the CSP Worker for the rest of that UTC day, and the summary would show a quiet day with no flag (it flags only its own cap). Recovery is a wipe of the preview or midnight UTC. On Paid the risk is cost, and a per-account cap alone doesn't bound it: a push that rewrites rows at their current `rev` is accepted (`rows.js`, `row.rev !== stands`) and writes rows without growing storage, so the fix needs a tighter limit on `POST /rows` beside the cap. None of this reads, changes, or loses a reader's data, blocks a store review, or breaks a law, and in ordinary use nothing is lost (devices keep their notebooks), so it is Medium and a gate before production. The one thing worth doing now, during the CSP week, is BVJ's look at which plan the account is on.

**SV9-2, SV9-3, SV9-4, SV9-5, SV9-7 (Medium to Low).** Each is real and each is about production, which isn't deployed, or about the preview, where BVJ holds the dashboard and a wipe. SV9-2's fix is free at the moment BVJ makes the environment: GitHub says "Only one of the required reviewers needs to approve," so adding BDR as a second reviewer (or a reviewer-free rollback environment) keeps the workflow's purpose. SV9-3's second half (a merge redeploys what was rolled back) is false for production, and GitHub's `queue: max` ("Up to 100 jobs or workflow runs can be `pending`") or a separate rollback group fixes the first. SV9-4 and SV9-5 belong in the same runbook pass. SV9-7's budget is already recorded. All five go on the launch list.

**SV9-12 with SEC9-5 (Medium to Low).** Anyone can do it now, but what they spoil is a week's measurement that is already flagged when a day caps, and whose decision the README tells the reader to check in a real browser. No reader's data is involved.

**SV9-6 with LP9-7 (Medium to Low), with a note.** As merged, the claim "no address reaches a log" was internal (README, `workers/CLAUDE.md`) and unverified, not false. **But #713, merged after the audit commit and live on litbible.net now** (`privacy-live.html`), tells readers: "The service doesn’t keep or log the address your requests come from," and "the service’s log lines: up to seven days." Whether a stored Workers Logs event carries the request's address or URL is exactly what Cloudflare's page doesn't say. So BVJ's one look at a stored preview event is now due before accounts open: if it carries the address or URL, turn stored logs off (as the CSP Worker does) or change the page.

**SY9-1 (Medium to Low).** The mechanism is as reported, but the reach is small: an IndexedDB read has to throw, and every page load builds a new engine whose first pass scans everything. On a multi-page site that is the next navigation. The residual fault is the "upToDate" status meanwhile; the fix (restore the ids on a throw) is still right.

**SY9b-1 (Medium to Low), SY9b-5 (Low to Nit), COH9-2 (Low to Nit).** A missing test is not a fault a reader meets; SY9b-5's `slow_down` case can't occur with today's service; COH9-2's "misgloss" is scoped to two sections by its own words.

**DOC9-1 (Medium to Low, reframed).** The 22 points are real and untracked, and COH9's table is accurate where I checked it. But eight hours after #701, during scheduled 4h merges, the finding should ask for a ledger (taken, not taken and why, or BDR's) before the format freeze, not imply the answers were ignored. The substantive points are carried by SY9-2, COH9-2, COH9-3, and point 18 (`openSession` sets `keyring` before the notebook check, `desk-sync-engine.mjs:266-281`).

**DOC9-2 (Medium to Low).** The vendor page favors the CSP README's reading (account-wide). The other two places have the wrong word; no decision changes.

**ORC-e and ORC-f (Low to Nit).** Desk-only cost, cached in practice; CLS inside the "good" threshold.

### False positives

None in full. Claims inside findings that don't hold:

- **SV9-3**: "the next merge redeploys the code they just rolled back from" is false for production, which never deploys on a push.
- **SY9b-5**: the `slow_down` case: the service's `retry` is always 60 s.
- **COH9-2**: the table's narrowing of `passkey` is explicitly scoped to "Signing in" and "Ways to sign in."
- **DOC9-1**: "never taken in," after eight hours.
- **SEC9-1, fix (3)**: `GET /approvals/:id` already answers `expires` (`approvals.js:104`), ten minutes after the request, so a client can already say how old it is; only the requester's `through` is missing.
- **SV9-5**: "can never be deleted ... by the service": by the service alone, yes; RUNBOOK 7 covers it by hand, as SV9 notes.
- **SV9-1**: the CSP Worker shares the allowance only if the account is on Free, which no record says.

### Folds

- **SV9-1** carries SEC9-3.
- **SV9-12** carries SEC9-5.
- **SV9-6** carries LP9-7.
- **SY9-2** carries COH9-3 and MH9 Table 1 items 1 to 9 (the fake's `what: "body"` and its eight missing words).
- **SEC9-4** carries ORC-c.

### Decisions for BVJ or BDR

1. **Which Cloudflare plan the account is on today** (BVJ, one dashboard look): on Free a preview flood also silences the CSP week's counts for a day; on Paid, set a billing alert now.
2. **SV9-1**: a per-account ceiling (rows and bytes) and a tighter `POST /rows` limit, their numbers, and a new refusal for the apps (BVJ, BDR).
3. **SEC9-1**: whether a computer that holds the notebook acts on an approval link at all, and the words of the "holding" sentence (BVJ; BDR for the apps).
4. **SEC9-2**: split install and test from deploy, and whether the preview gets its own Cloudflare account, since D1 and Workers Scripts can't be scoped below the account (BVJ).
5. **COH9-1**: fall back to `DELETE /session` in the client or change the service, and the spec's wording with an apps entry (BVJ decides, BDR confirms).
6. **SV9-6**: read one stored Workers Logs event, then keep logs or turn them off, now that /privacy makes the claim (BVJ).
7. **SV9-2**: BDR as a second required reviewer, or a rollback environment, when `notebook-production` is made (BVJ).
8. **SV9-4**: how the service is stopped in an emergency (BVJ).
9. **DOC9-1**: a triage line for each of iOS's 22 points and three key-storage points before December 24 (BVJ's side; BDR on key storage).
10. **SEC9-4 with ORC-c**: hashes for the inline scripts in place of `'unsafe-inline'` before the policy is enforced and accounts open (BVJ, in 4i).
11. **SEC9-6**: the repository's default token to read, or `permissions` in `ci.yml` (BVJ).

### Not reached

- The account's Cloudflare plan, D1's real write throughput, and how long a large delete takes on D1: no Cloudflare access by rule, so the SV9-1 minutes and the SV9-5 threshold stay estimates.
- What a stored Workers Logs event carries (SV9-6): Cloudflare's page is silent and the dashboard is BVJ's.
- Whether the deployed preview matches `wrangler.jsonc` at `3ef75d8e`: no request to it, by rule. The chain was run locally only.
- SEC9-2: whether a GitHub-hosted runner kills a background process between steps; from memory it cleans up orphans only at the job's end, which is what the finding assumes.
- SY9b's 25-minute mutation run was not repeated; I used its log.
- The accessibility, copy, docs, and legal findings (SV9-10, DOC9-3 to DOC9-12, the rest of LP9, AC9, LV9, CP9, TQ9) are the second verifier's.

### #713 (LP9b)

Second pass, on BVJ's addendum (`BRIEF-713.md`): the worktree at `37a7498e` is intended. Same method: each finding was first argued against, then given a final severity. 10 items checked (LP9b-1 to LP9b-5 in depth, LP9b-6 to LP9b-10 at a glance): 8 confirmed, 2 lowered, 0 raised, 0 false positives, and one earlier item folded in (my SV9-6 now goes under LP9b-4). Combined with the first pass, the items that stand are **Critical 0, High 0, Medium 6, Low 26, Nit 7**.

| ID | As reported | Verdict | Final | Reason and evidence |
|---|---|---|---|---|
| LP9b-1 | Medium | Confirmed (fix widened) | **Medium** | New in #713: "There are no ads, nothing tracks you across sites" (`privacy.astro:89`) and Do Not Track (`:609-612`, "nothing for a browser’s Do Not Track signal to turn off"); neither is in `git show 3ef75d8e:src/pages/privacy.astro`. Against: `found-in-translation-podcast.astro:163-206` frames `www.youtube.com/embed`, Spotify, and Apple players, and `support.astro:19-23` loads Give Lively's script on every visit (LP9b missed this one). Google says the standard embed lets views influence "the viewer’s browsing experience on YouTube," which privacy-enhanced mode "prevents" (https://support.google.com/youtube/answer/171780). A false sentence any reader of `/privacy` can meet today; not High: LIT keeps nothing from it, and the record carries the Do Not Track paragraph voluntarily (`STUDY-DESK.md:6149-6151`) |
| LP9b-2 | Medium | Lowered | Low | Confirmed in text: "a token Apple issues, encrypted in our database" (`privacy.astro:333-334`) beside "encrypted" meaning sealed elsewhere on the page (`:244, :247`); spec 751: "plain to LIT, encrypted at rest"; `signin.js:279` stores it as is. But the sentence is literally true, the page says Apple is "not offered yet" (`:330`), no token exists, and the token "opens nothing in the notebook." A gate, not a fault anyone meets |
| LP9b-3 | Medium | Lowered | Low | Confirmed: "What the service keeps, and can read" (`privacy.astro:348-377`) omits an approval's plain `model` and `platform` (migration 0001, `approvals`), and "Your devices’ names are locked" (`:319`) is not quite true while one waits, since `model` becomes the card's first name (spec item 88). The window is ten minutes by `expires`, up to about 70 until the hourly sweep removes it (`scheduled.js:53-55`). Accounts are closed; a gate. It matters most if an app sends the phone's own name as `model` (item 88 asks BDR) |
| LP9b-4 | Medium | Confirmed (carries SV9-6, LP9-7) | **Medium** | The page now states it to readers, live (`privacy-live.html`): "It keeps ... no record of where you connect from" (`privacy.astro:84-86`) and "The service doesn’t keep or log the address your requests come from" (`:391`), "log lines: up to seven days" (`:428`). Workers Logs stays on (`wrangler.jsonc`), and Cloudflare's page doesn't say what it stores beside a custom line. The claim is in force today for everyone who uses the preview (BVJ, and BDR's iPhone build). That public claim is the new evidence that lifts my Low |
| SV9-6 | Low (VER9) | Folded into LP9b-4 | (Medium) | The same unverified fact; LP9b-4 is the one item now |
| LP9b-5 | Low | Confirmed | Low | `privacy.astro:139-141` names "Create an account" as Turnstile-protected; production sets no key by design (`workers/notebook-service/test/config.test.js:103`), and a request with no `Origin` is never checked (`turnstile.js:107`). True on the preview's website box today; a launch edit |
| LP9b-6 | Low | Confirmed (glance) | Low | Spec 767 and 1255 ("not even that there was one") against spec 1244-1246 (Time Travel keeps the rows) |
| LP9b-7 | Low | Confirmed (glance) | Low | "say what changed at the top of this page" (`privacy.astro:639-640`); the top (`:30-46`) has only the date and the lede |
| LP9b-8 | Low | Confirmed (glance) | Low | Spec 862-865: dropping the trash copy "is the clients’ job" |
| LP9b-9 | Low | Confirmed (glance) | Low | Two pages read as LP9b says; whose license it is belongs to a lawyer and BVJ (the second verifier's area) |
| LP9b-10 | Nit | Confirmed (glance) | Nit | `delete-account.astro`'s "Your notebook in it is still locked" is the exact form |

**LP9b-1, the fairest fix.** Make the sentences true now, in words; change the players later if BVJ wants. (1) "Nothing tracks you across sites" becomes "We don't track you across sites." (2) One sentence, in "In short" or beside Do Not Track, saying that the podcast page shows players from YouTube, Spotify, and Apple Podcasts, and the Support page shows Give Lively's donation box; when they load, those companies may set cookies or learn of the visit, under their own policies, and whether they honor Do Not Track is theirs. (3) Optional code: YouTube's `www.youtube-nocookie.com` host (Google's own instruction is to change the embed's domain; `_headers` `frame-src` would gain it), or a click-to-load for each player. The domain change alone doesn't make "nothing tracks you" true: Google's page promises less personalization, not no cookies. So the words come first.

**LP9b-2 and LP9b-3, lowered.** Both are real inaccuracies and both must be fixed before accounts open (LP9b's words are right). Neither is in force for any reader today: Apple is off and the page says so, and no approval can be made from litbible.net without `?account=preview`. Neither involves data a reader would consider sensitive, unless an app sends the phone's own name as `model`, which is BDR's answer to item 88 and is the one reason to fix LP9b-3's list rather than the device-name sentence alone.

**LP9b-4 supersedes SV9-6.** At `3ef75d8e` the claim was internal, so Low. #713 made it public, specific ("no record of where you connect from"), and in force today, so it is Medium until BVJ reads one stored event. If the event holds the address or the URL: turn stored logs off (as the CSP Worker does, keeping `wrangler tail`), or change both sentences. If it doesn't, write down what it holds in the README, and the finding closes.

**Decisions added for BVJ.**
12. **LP9b-1**: name the embeds now (words), and whether to switch YouTube to the no-cookie host or load players on press later (BVJ).
13. **LP9b-4** replaces decision 6 above: one look at a stored preview log event, then logs off or the two sentences changed (BVJ).

### Third pass: UX9b

Third pass, at the coordinator's request: UX9b's findings on #713's desk code, at `37a7498e`, same method. I re-ran UX9b's `states.test.mjs` from the scratchpad (6 of 6 pass, and the values it prints match the report: one nudge for a linked store on a first-tick write; the reminder due with "You haven’t backed up your notebook yet." beside "Not backed up to a file yet."; an answered foot's links `/desk/help/` and `/contact/?about=study-desk`). I did not re-run the mutation script; instead I searched the whole `test/` root, which UX9b's 12-file run did not cover. 7 items checked: 5 confirmed, 2 lowered, 0 raised, 0 folded, 0 false positives (one part of UX9b-2 drops). With the first two passes, the items that stand are **Critical 0, High 0, Medium 6, Low 29, Nit 11**.

| ID | As reported | Verdict | Final | Reason and evidence |
|---|---|---|---|---|
| UX9b-1 | Medium (tests) | Lowered | Low | The gap is real: no file in `test/` reads the tour's "kept" body through `tour.js:105-114, 433` and `tour-runner.js:247`, draws `/notebook/`'s first line through `notebook-page.js:110-118`, or fires `panel.js:445`'s nudge with accounts open (searched all of `test/` for `SYNC_META`, `linked`, `notebookIntro`, `desk-np__intro`, `nudgeLine`; the ten files that name `notebook-page`, seven outside UX9b's subset, assert nothing about its first line). But the code is right today, the words are tested as pure functions (`desk-first-use-linked.test.js:83-98`), and the fault a regression would bring back is LV9-8, itself Low (VER9b). Same kind as SY9b-1, not worse |
| UX9b-2 | Low (copy) | Confirmed (narrowed) | Low | `first-use.js:433` sets the Settings notice to `reminderText` (`desk-reminder.mjs:117-122`, no `linked`), while `:438` writes `savedLine(..., { linked })`. Linking never touches `HOME_KEY` (only `first-use.js` and `reminder.js` write it), so a `browser-remind` reader keeps the old words; `savedLine`'s own comment (`desk-reminder.mjs:65-68`) gives the reason they mislead. `backedUpSaid` (`:180-182`) reports a download and needs no link wording, so that part of the claim drops |
| UX9b-3 | Low (coherence) | Confirmed | Low | "Linked" is `readLink(...) != null` (`first-use.js:315-318`, `notebook-page.js:112`, `tour.js:108`), and only `unlink` (`sync/start.js:213-217`) clears it, from sign-out and Stop syncing (`account/notebook.js:132-134, 720`). So a removed or replaced-notebook browser keeps "It syncs with your account" (`desk-reminder.mjs:85`). Not lower: the sentence sits directly above the status line that says otherwise (`notebook-page.js:118-119`). Not higher: the stop is never silent (`stopped-notice.js:6-20`), and both states are rare |
| UX9b-4 | Low (usability) | Lowered | Nit | True that the panel's foot has no account link once answered (re-run above). But the header's "Sign in" is on every page with the desk on, on a computer, with accounts open (`src/scripts/desk/account/CLAUDE.md` rule 17, E231), and not offering the account again to a reader who chose "this browser" fits BVJ's "no account is plainly an option." A design question, not a gap |
| UX9b-5 | Nit | Confirmed | Nit | Re-run: one reveal for a linked store on a write before `getMeta` resolves; `first-use.js:458` reads `linked` while it is still false |
| UX9b-6 | Nit | Confirmed | Nit | Stage one reaches `desk-reminder.mjs` only by `import("./reminder.js")` (`first-stage.js:77-78`), gated on the reader having asked for reminders; about 1 KB more, for them alone |
| UX9b-7 | Nit | Confirmed | Nit | The ellipsis is new in #713 (`desk-first-use.mjs:55`). By the usual convention an ellipsis marks a command that needs more input before it completes, which a setup page does, so only the link's visual weight is in question: taste |

**UX9b-1 against SY9b-1.** The same kind. Both are planted faults that survive in code that does the right thing today, with the pure logic under test, and neither is a fault a reader meets. If anything this one is smaller: SY9b-1's survivors are guards in the sync engine's data path, while these carry one boolean into three sentences. The sentence a regression would restore ("nothing is sent anywhere" in a linked browser) is LV9-8, which VER9b kept at Low because only BVJ's browser is linked. The promise matters, so UX9b's three happy-dom tests are worth adding, but that does not lift the gap above Low. It belongs on the launch checklist: before accounts open, these three wirings should have a test.

**AC9-3: open, as UX9b says.** AC9-3 is about the sign-out sentence, `signOutLinked`: "Signing out stops syncing on this computer and takes it off your notebook’s devices. Your notebook stays in this browser." #713 left it unchanged (`desk-account-words.mjs:154` now, `:147` at `3ef75d8e`; it moved only because seven lines were added above it), and `account/notebook.js:709` still shows it as the sign-out prompt. LP9b's "partly" rests on two misreadings. First, `deviceBody`'s "A new device joins when one you already use approves it, or with your recovery code" was already there at `3ef75d8e:172`; AC9-3's own evidence quotes it. Second, LP9b names `signedOutNow` (`:142`), the line shown after signing out, not the sentence AC9-3 names. What #713 did add is context, not the fix: "Your passkey only signs you in" (`deviceBody`, `:181`) and the help page's "The recovery code" and "Another computer" items (`help.astro:1437-1446`). The help page's new sign-out item (`help.astro:1465-1467`, "syncing stops on this computer, which leaves your notebook’s devices, and the notebook stays in this browser") repeats the prompt without the code. Severity stays at VER9b's Low.

**Decisions added for BVJ.**
14. **UX9b-2**: should the backup reminder keep firing in a browser that syncs, and if so, should its words say "to a file" (UX9b's pick: yes to both)?
15. **UX9b-4**: should the Notebook panel's foot or Settings tab offer the account where accounts are open, beside the header's "Sign in"?
16. **AC9-3** (VER9b's decision 2 stands): add the recovery code to `signOutLinked` for a "This device only" reader.

### Fourth pass: TQ9

Fourth pass, at the coordinator's request: TQ9's findings on test quality, read at `549d75ac`. Between `3ef75d8e` and `549d75ac`, the only file TQ9 cites that changed is `test/desk-account-page.test.js` (4 lines added, the Terms link from #713), and no finding rests on it. TQ9's backup of `desk-crypto.mjs` matches the repo byte for byte. I re-ran X11, X12, X17, and X27 on my own copy (`VER9\tq`, exported from `549d75ac` with `git archive`, packages through a junction I removed afterward). The run covered 15 files and 276 tests, six files more than TQ9's set (`desk-account-header`, `desk-sync-property`, `desk-sync-account-notice`, `desk-sync-status-line`, `desk-storage-keys`, `desk-sync-gate`). Baseline 0 failures; all four mutations still 0 (`VER9\tq-run.out.txt`). I also fuzzed X17 (`VER9\x17-equiv.mjs`, `x17-equiv.out.txt`): of 200,000 random keyring texts, 1,700 parse, and on every one the real `checkKeyring` and the mutant agree against three held keyrings. 8 items checked: 4 confirmed, 4 lowered, 0 raised, 0 folded, 0 false positives in full (half of TQ9-2 is an equivalent mutant). Across all four passes, the items that stand are **Critical 0, High 0, Medium 6, Low 34, Nit 14**.

| ID | As reported | Verdict | Final | Reason and evidence |
|---|---|---|---|---|
| TQ9-1 | Medium | Lowered | Low | The gap is real. Production relies on the defaults: `desk-account.mjs:119` and `:511` (`sealDeviceCard`), `:173` (`sealHolderRecord`), and through the sibling defaults `:174`, `:372`, `:577`, `:586`. The only "two seals differ" test is `sealRecord`'s (`desk-crypto.test.js:854`); the round trip at `:907` seals a holder record with the default and only opens it. X11 and X12 survive my wider run. Lowered because today's code is right and a broken generator (X13) is caught. This is the same kind as SY9b-1 and UX9b-1, but with the highest stakes of any gap (below) |
| TQ9-2 | Medium | Lowered | Low | **X27**: survives, and no vector has a card naming another `sign` (the vectors' `approval.refused` has two `card` cases: another public key, another device id). Yet the spec's step 6 names the check (`STUDY-DESK-ENCRYPTION.md:978-985`). But version 1 uses `sign` for nothing (`:457`). The service can't forge a card (sealed under the notebook key, device id in the AAD, `:972-974`), and it can't change a request's `sign` either: that field is under the MAC (vector "the request's signing key swapped for another"). **X17**: equivalent for every keyring from the service. `parseKeyring` refuses any keyring whose kids aren't exactly 1 to `current` (`desk-crypto.mjs:925-931`), and `backward` runs first (`:954`), so "a keyring with an old key missing would be believed" can't happen. Fuzz: 0 differences. The branch guards only keyrings this client builds itself (`adopt`: `desk-sync-engine.mjs:683`, `connector.js:415`) |
| TQ9-3 | Low | Confirmed | Low | Lines as cited (`desk-passkey.mjs:110, 124, 164, 211`; `desk-crypto.mjs:301, 344, 441`). `desk-account.mjs:360` makes AC6 partly redundant, as TQ9 says |
| TQ9-4 | Low | Lowered | Nit | All 20 faults are caught by the service's full suite, which CI runs on every pull request (`ci.yml:75-93`) and the deploy runs again (`notebook-service-deploy.yml:110`). No fault can get through; the question is only where a rule's test lives |
| TQ9-5 | Low | Lowered | Nit | Re-ran `d1probe.mjs`: confirmed, a missing bind is NULL on `node:sqlite`. But the service never comes near 100 binds: its largest statement has 14 placeholders (`approvals.js`), and lists go in as one `json_each(?)` bind (`rows.js:142, 189, 209, 222`; `key.js:92-95`). A missing bind in any statement the service runs fails its workerd suite in CI. Worth the two lines in the stand-in; not a gap anyone meets |
| TQ9-6 | Low | Confirmed | Low | `fake-credentials.mjs` is as described, and no test names `publicKeyAlgorithm`. BVJ's real passkeys on the preview exercise the real shapes today, so this only matters for catching a regression |
| TQ9-7 | Low (partly KNOWN) | Confirmed | Low | `limits.test.js:34` records the CI failure; `waiting.test.js:472` and `desk-sync-account-notice.test.js:145` (`settled` waits 15 ms) are as cited. Mitigated, as TQ9 says |
| TQ9-8 | Nit | Confirmed | Nit | `account.test.js:134`, `devices.test.js:282`, and `key.test.js:421` each end with `toBeTruthy()` on a value set earlier |

**TQ9-1 and TQ9-2 against SY9b-1 and UX9b-1.** All four are the same kind: tests missing for code that is right today. No reader meets any of them, so each is Low under the brief's rubric, which makes even "a missing guard with no exploit today" Low (and here the guard exists). They differ in stakes.

TQ9-1 is the worst test gap this audit found. Suppose a refactor turned either default into a constant. Every device card, or every holder record under one secret key, would then reuse one AES-GCM nonce under one key. The service stores those cards. With two tags under one nonce it can solve for GCM's authentication key. It already knows or can guess most of a card's plaintext, since a device's public keys and model travel in the approval request (`desk-account.mjs:326`). So it could write a card that opens and names a public key of its own. At the next change of key, the honest device seals the new keyring to the public key in each card it opens (`desk-account.mjs:578-579`). That is a silent route to the notebook key. TQ9's two tests (seal twice with no nonce, assert the nonces and ciphertexts differ and each opens) should be the first tests added, before accounts open. They should cover all six defaults, not two.

TQ9-2 is weaker than reported. Half of it can't be reached from the service; the other half guards a field version 1 never reads. Its useful fix is a vector, not just a website test: a grant whose card names another `sign`. That holds the apps to step 6 as well, before version 2 turns signatures on.

**Decision added for BVJ.**
17. Before accounts open, add the nonce-freshness tests for the six sealing defaults (TQ9-1), and a "card with another signing key" vector to `notebook-crypto-vectors.json`, which both apps run (TQ9-2). Tell BDR when the vector lands.

## Appendix Q: Verification: accessibility, use, legal, docs, and copy (`VER9b`, Sonnet)

Commit `3ef75d8e`, read-only. I changed nothing in the repo, contacted no deployed host, and ran no test (reading and `node -e` on the already built `dist/` only). Standards: I did not re-fetch WCAG, Apple, or Google pages; where a verdict leans on one, I say it rests on the auditor's fetched citation or on memory. Nothing here is legal advice; where LP9 raises a legal question, it stays "what a lawyer should look at."

### Tally

53 items checked (45 named in the brief plus 8 that were folded into them). Confirmed 25, Lowered 15, Raised 0, Folded 9, False positive 2, Deliberate 2.

### Table

"Carries" means the folded IDs ride on it. Severity is final, by the brief's rubric. A finding 4j will plainly cover keeps its gate severity and the tag.

| ID | As reported | Verdict | Final | Tag | Reason and evidence |
|---|---|---|---|---|---|
| AC9-1 (carries LV9-1) | Medium a11y | Confirmed | Medium | | `ui.js:127-136` `confirmBox` is a `div role="group"` with a bare `<p>`; `notebook.js:719, 755, 837` and `page.js` callers focus the first button (the destructive one). No `aria-describedby` anywhere in `account/*.js`; no Escape handler outside the header menu. LV9 saw it in the AX tree. |
| AC9-2 (carries LV9-2) | Medium a11y | Lowered | Low | | Rule 18 of `account/CLAUDE.md` makes "the screen's heading takes focus" the design. The result sentence is passed to `showHome(ctx, note)` and drawn as a `<p class="account__note">` right after that heading (`notebook.js:669`), so remove, key change, wayAdded, and addDeviceDone all say their result next in reading order. Only Rename (`:799-801`, `again()` with no text) and a no-op Save say nothing. Real, with a workaround and a narrow reach; not announced by a live region. |
| AC9-3 (carries LV9-3) | Medium usability | Lowered | Low | 4j | Words at `desk-account-words.mjs:147` and `:230` are 4j's ("Ways to keep your notebook," the first-time choice). Nothing is lost: local notebook stays; a "This device only" reader who signed out needs the recovery code, which setup forced them to type back two groups of. LV9 confirms the flow, not data loss. |
| AC9-4 (carries LV9-11) | Low a11y | Confirmed | Low | | `notebook.js:316-324`: disabled radio, `followOff` hint is a sibling `<p>`, no `aria-describedby`. Reached only when the passkey can't carry the key. |
| AC9-5 (carries LV9-5) | Low a11y | Confirmed | Low | | `notebook.js:925` names every way "Remove Passkey." LV9's claim that device Remove buttons have no device name is wrong against `:808` (`aria-label` has the name); they duplicate only when two devices share a default name. |
| AC9-6 | Low usability | Confirmed | Low | | `print.css:77-80` `html:not([data-font]) body *` with `!important` beats `account.css:227`'s monospace; the print block at `:362` sets only border and size. CSS read, not printed. |
| AC9-7 | Low usability | Lowered | Nit | 4j | The code is hyphen-grouped (`BGKH-CHGV-...`), so counting to "Group 4" is easy, and a retry exists. Polish; the code screen's words are 4j's. |
| AC9-8 | Low copy | Lowered | Nit | | The word "preview" appears only for the preview sign-in kind (`desk-account-words.mjs:90, 94`), which production's config never offers; "entries" is the notebook's own term in `desk-sync-status.mjs:145-159`. BVJ is the only reader. |
| AC9-9 | Low tests | Lowered | Nit | | Partly false: `test/desk-sync-status.test.js:144` and `:262` already sweep the sync words for dashes and straight quotes. What is missing is the punctuation-inside-quote and British-spelling checks there. The duplicate `waitingSentence` (`desk-sync-status.mjs:194`) beside `waitingWords` (`desk-account-words.mjs:308`) is real. |
| AC9-10 | Nit ui | Confirmed | Nit | | `global.css:865` green fill on hover with the `desk-sync.css` green dot. Narrower than reported: under `data-restyle` (Site 2.0, `restyle.css:123`) hover is a light tile, so the dot shows. Not seen in a browser. |
| AC9-11 (carries LV9-7) | Nit copy | Confirmed | Nit | | The stop block (`stopPart`, `notebook.js:611-640`) and the Sync card (`status-line.js` in the slot) both say the line. LV9's "three times" overcounts: `stopped-notice.js:128` suppresses the notice on the account page ("The account page shows the stop and its step itself"). Two visible, plus the sr-only copy. |
| LV9-4 | Low a11y | Confirmed | Low | | `notebook.js:857-858`: the pressed "Show a code" button is removed by `add.replaceChildren(...)`, so focus falls to the body (LV9 says it stays on the heading; either way nothing moves focus to or announces the code). |
| LV9-6 | Low copy | Lowered | Nit | | `desk-sync-status.mjs:115` ("after you sign in again") is the signed-out state, true for what the client knows then (its session was refused); `:122` is the removed state, which appears only once the service says so. A removed device can't know first. |
| LV9-9 | Low usability | Deliberate | none | | Sign out takes the computer off the device list (`signOutDevice`, and the sentence at `desk-account-words.mjs:147` says so), so signing in again joins as a new device with a default name. LV9 itself rated it Low confidence. |
| LV9-8 | Low copy | Confirmed | Low | 4j, KNOWN | Listed as 4j's in `src/scripts/desk/sync/CLAUDE.md:213-217` and `STUDY-DESK.md:5632`. Untrue only in a linked browser (BVJ's). |
| LV9-10 | Low logging | Lowered | Nit | | `ui.js:46` logs every `fail()` with `console.error` by design; no reader-facing effect. |
| LV9-12 | Nit ui | Confirmed | Nit | | Cosmetic tooltip over the open menu; not re-seen. |
| LV9-13 | Nit ui | Confirmed | Nit | | Not re-seen (no browser); LV9 itself says "looks like." |
| LP9-1 | High legal | Confirmed | High | 4j | `privacy.astro:9, 19` (descriptions say the apps "keep everything you create on your device"), `:254-265` ("does not collect," "cannot access"); the only window additions are the browser's `lit-desk-sync` paragraph and the security-reports paragraph. Not a fault today (accounts closed, the apps do not sync), but a hard gate: `STUDY-DESK.md` says the page is live before either app ships sync, and Apple's 5.1.1(i) (LP9's citation) wants the policy to match. 4j's account section "comes from the spec's What the service holds" (`STUDY-DESK.md:6105`), so it is covered, and stays High as a gate. |
| LP9-2 | Medium legal | Lowered | Low | 4j | Verified: five PRs (#698, #702, #703, #710, #711) touched `privacy.astro`; date lines `:18`, `:39` unchanged. The new paragraph (CSP counts, 30 days) is non-personal, and 4j resets the date. The cost is a page that breaks its own "Changes" promise (`:394-398`) for a few days. |
| LP9-3 (carries DOC9-11.7) | Medium privacy | Confirmed | Medium | 4j | `privacy.astro:104-111` names "the contact and subscribe forms" and "does not track you across sites"; the new-account widget (`turnstile.js`) is not mentioned. A gate; 4j's "what the service holds" does not obviously name Turnstile, so it should be on 4j's list. |
| LP9-4 | Medium legal | Lowered | Low | 4j | Confirmed in code: `scheduled.js:53-55` sweeps only `sessions`, `approvals`, `challenges`; `DELETE FROM accounts` exists only in `waiting.js`. But no law I know of (from memory) requires sweeping; stating "until you delete the account" in 4j's page meets the retention disclosure. The sweep is an owner decision, listed below. The approval-row lag (up to an hour past ten minutes) is real and tiny. |
| LP9-5 | Medium legal | Lowered | Low | 4j | Partly false: the spec does record Time Travel (`STUDY-DESK-ENCRYPTION.md:1243-1246`, "keeps the account's rows ... until they age out, 30 days"), as do `DISASTER-RECOVERY.md:204`, the README, and the RUNBOOK. What is wrong is two sentences that contradict it (`:767`, `:1255`: "nothing of a deleted account, not even that there was one"), and `/privacy`'s silence, which 4j's deletion text covers. |
| LP9-6 | Medium legal | Confirmed | Medium | BDR, 4j | The plain fields (ids, timestamps, device model and platform in an approval) are what the migrations hold; a store form answered from today's `/privacy` ("no identifiers") would be wrong. A gate before a store submission. BDR answers the forms, 4j supplies the text they source from. Rests on LP9's fetched Google page. |
| LP9-8 | Low legal | Confirmed | Low | 4j | `STUDY-DESK.md:6106` says the terms "carry a minimum age," so this is plainly 4j's; the lawyer picks the age. |
| LP9-9 | Low legal | Confirmed | Low | 4j? | No controller, lawful basis, rights, or processors list on the page; 4j's description does not say it covers them. What a lawyer should look at: whether GDPR applies to a US nonprofit offering accounts worldwide. |
| LP9-10 | Low legal | Lowered | Nit | KNOWN | Recorded: `STUDY-DESK.md:1836-1837` and `STUDY-DESK-BRIEF-FOR-BDR.md:136` ("Google sign-in on iOS requires an equivalent private option, which Sign in with Apple satisfies (Apple guideline 4.8)"). What remains is only a mechanical guard (a config test that fails on Google without Apple). Both providers are off and untried. |
| DOC9-1 | Medium coherence | Confirmed | Medium | | Documentary half: `STUDY-DESK-FOR-THE-APPS.md:488-664` carries the 22 discrepancies and three key-storage points and says each is "the website's to weigh"; no later entry, the spec, or `STUDY-DESK.md` records what was taken. Test fixture `test/desk-sync-engine-edges.test.js:489` still builds `{what: "notebook", since, ready, from}`, and the apps file's own item 21 says that isn't the interface's shape. Item 20 (`rowSize` counts UTF-16 units against a byte limit) is a code claim for VER9. Timing softens it: hours old, freeze about December 24. |
| DOC9-3 | Medium coherence | Lowered | Low | 4j? | Confirmed absent (no "before accounts open" list; `account/CLAUDE.md:157-164` covers code switches only). But the ordering that matters is already in the plan ("the full policy is enforced before sign-in is"; privacy and terms before sync; 4l). A missing checklist is an improvement, not a fault. 4j may add items. |
| DOC9-4 | Low docs | Confirmed | Low | | All five checked: `STUDY-DESK-ENCRYPTION.md:1778, 2706, 3225`; `README.md:723, 739`; `DISASTER-RECOVERY.md:116` ("two separate widgets") against its own `:23, :39, :174` ("three"). |
| DOC9-5 | Low docs | Confirmed | Low | | `workers/notebook-service/README.md:916-917`, `workers/CLAUDE.md:210-213`, spec `:3053` ("takes no request yet"), apps file ask 15 (`:289`) predate the box 4h built. "Unlinked until accounts open" is still right. |
| DOC9-6 (carries ORC-a) | Low docs | Confirmed | Low | | `account/CLAUDE.md:48` says "in the sitemap, as the stores require"; `astro.config.mjs:80-81` removes it, and the page is noindex. Play needs the address, not a sitemap entry. |
| DOC9-7 | Low docs | Lowered | Nit | | Agree with the orchestrator. `waiting.js:184-199` has no time check, matching "until it is carried out." "A minute before `due` or twenty minutes after" reads as two examples of that window (the cron runs hourly), not a rule. |
| DOC9-8 | Low docs | Confirmed | Low | | Status paragraph (`:3-8`) lists 4b, 4c, 4e, 4f, and 4g but not 4d or 4h; "Order of work" item 3 (`:2257`) still says deploying to preview is BVJ's to do; "1 to 15 now wait on BDR alone" (`:2715`) sits beside item 14's undecided tie rule. |
| DOC9-9 | Low copy | Folded into CP9-1 | | | Its "this computer / this device" row is CP9-1; the rest is doc-only vocabulary with no reader effect. |
| DOC9-10 | Low docs | Lowered | Nit | | Root `CLAUDE.md:85` is about the desk's code. The account gate is `account/CLAUDE.md` rules 11 and 12, which the root table points to for "the account pages." A one-clause addition. |
| DOC9-11 | Low docs | Confirmed | Low | | Checked: sync rule 2 vs `notebook.js:93` static import of `start.js`; `STUDY-DESK.md` is 691,521 bytes against "about 500 KB"; `desk-records.mjs:89` still says ask 4 unanswered although iOS answered; the 4c entry's "30 days (40)." Item 7 goes to LP9-3. |
| DOC9-12 | Nit docs | Confirmed | Nit | | Spec `:2688` says refusal is "as 51 says it should be"; item 51 (`:2919`) says it is not decided and "the service refuses until it is." |
| CP9-1 (carries DOC9-9) | Low copy | Confirmed | Low | 4j? | "This browser" vs "this computer" is partly principled (the notebook and passkey belong to a browser, not a machine), so it needs BVJ's pick, not a sweep. "This device only" is a choice title, which 4j owns. |
| CP9-2 | Nit copy | False positive | none | | The straight apostrophes are in developer error strings; nothing in `failureWords` or `desk-sync-status.mjs` shows `.message` to a reader (grep). |
| CP9-3 | Nit copy | False positive | none | | `AppsLaunchPopover.astro:79-81`: "Daily and Lectionary readings, notes and highlights, and the whole New Testament offline" has the comma before the last "and"; "notes and highlights" is one item. Outside the window anyway. |
| CP9-4 | Low privacy | Lowered | Nit | | The repo is public (`gh repo view`: PUBLIC), so dated owner initials and step names leak nothing. What remains is weight: `dist/john-3/index.html` has 22 HTML comments, 7,944 bytes of 139,008; gzip 37,776 bytes with them, 34,686 without (about 3 KB, brotli less). Mostly from before the window (Layout.astro's comments grew by about 1.3 KB of characters in it). Move them into bundled modules when convenient. |
| CP9-5 (carries ORC-d) | Low security | Deliberate | Nit | KNOWN | `account/CLAUDE.md:143-164` rule 11 (BVJ, 2026-11-24, "Yes, your picks"). "Closed to every reader" means unadvertised; the service's Turnstile and limits are the protection. A stranger who uses the link and creates a preview account is covered by LP9-1's disclosure gap, not a new fault. |
| ORC-b | Nit docs | Confirmed | Nit | | `public/_headers:35-37` says "which no reader can be until the account pages exist"; they exist, behind `?account=preview`. |
| ORC-g | Low docs | Confirmed | Low | | `src/scripts/desk/CLAUDE.md` is 109,840 bytes; `DESK_LIMIT` is 112 x 1024 = 114,688 (`test/claude-docs.test.js:28`); headroom 4,848, under the 8 KB the file's header (`:15-17`) asks for. The test fails only past the limit, so the next section added may fail it. |

### Lowered, raised, or found false: short paragraphs

**AC9-2 (Medium to Low).** The auditors read focus-on-heading as a fault, but it is rule 18 in `account/CLAUDE.md`, and the result note follows the heading in reading order. Only Rename says nothing. The better fix (return focus to the row's control and write to the `role=status` line) is a change of the rule, which is BVJ's.

**AC9-3 and LV9-3 (Medium to Low).** The auditors are right about the flow: a "This device only" reader who signs out and signs back in by passkey is asked for the recovery code, with the earlier copy talking about the passkey. But the local notebook is untouched, the reader typed back two groups of the code at setup, and the words belong to 4j. It is a usability gap at the point of a choice 4j is rewriting.

**LP9-2 (Medium to Low).** The date is wrong and the page breaks its own promise, but what changed is non-personal counts and 4j's rewrite will move the date. If BVJ wants it right now, it is a one-line change.

**LP9-4 (Medium to Low).** The facts hold. What the page must do is say "until you delete the account," which is 4j. Whether to sweep never-finished accounts is a design decision (below), not a law's demand that I can point to.

**LP9-5 (Medium to Low).** The spec already says Time Travel keeps a deleted account's rows for 30 days (`:1243-1246`); LP9 was right that two other sentences say the opposite and `/privacy` is silent. Fix the two sentences; 4j says it once on the page.

**LP9-10 (Low to Nit, KNOWN).** The 4.8 rule is recorded in `STUDY-DESK.md:1836` and the BDR brief. The only open item is a cheap guard.

**DOC9-3 (Medium to Low).** A list is nice to have; every gate it would hold is already written down somewhere, and 4l is the private beta that tests them.

**LV9-9 (Deliberate).** It follows from sign out taking the device off the list, which the sentence says.

**CP9-4 (Low to Nit).** It is not a leak (the repo is public), only about 3 KB gzip per page that grew by about 1.3 KB in the window.

**CP9-5 (Deliberate, Nit).** BVJ chose the switch.

### False positives

- **CP9-2**: the straight apostrophes are in strings no reader sees (nothing prints `.message`).
- **CP9-3**: the list has its Oxford comma; "notes and highlights" is one item; and it is outside the window.
- **Partial false positives inside confirmed items**: LV9-5's "the AX name has no device name" (the device Remove button has `aria-label` with the name, `notebook.js:808`); LV9-7's "three times" (the notice is suppressed on the account page, `stopped-notice.js:128`); LP9-5's "not the spec" (the spec has it at `:1243-1246`); AC9-9's "never checked" (`test/desk-sync-status.test.js:144, 262`).

### Folds

- AC9-1 carries LV9-1.
- AC9-2 carries LV9-2.
- AC9-3 carries LV9-3.
- AC9-4 carries LV9-11.
- AC9-5 carries LV9-5.
- AC9-11 carries LV9-7.
- DOC9-6 carries ORC-a.
- CP9-5 carries ORC-d.
- CP9-1 carries DOC9-9.
- LP9-3 carries DOC9-11 item 7 (the privacy page names Turnstile for the contact forms only).

### Decisions for BVJ or BDR

1. BVJ: after an account action, return focus to the row's control and write the result to the `role=status` line, or keep rule 18 (heading takes focus) and add a result note to Rename? (AC9-2)
2. BVJ (4j): should the sign-out sentence and the "This device only" choice say a new device needs the recovery code? (AC9-3)
3. BVJ: one name for the local place ("this computer," "this browser," or "this device"), or keep "browser" where the key and passkey belong to it? (CP9-1)
4. BVJ: sweep accounts that never finished (no notebook, no live session, 30 days), or state "until you delete the account" and keep them? (LP9-4)
5. BVJ (4j): set the effective date and add a dated "what changed" line when the page lands; add Turnstile on the new-account step and the 30-day Time Travel history to 4j's list. (LP9-2, LP9-3, LP9-5)
6. BVJ: take the stale spec sentences (`STUDY-DESK-ENCRYPTION.md:767, 1255, 2688`, the front matter, and the five Turnstile "off" places) in one docs pass. (DOC9-4, DOC9-8, DOC9-12, LP9-5)
7. BVJ: give each of iOS's 22 discrepancies and three key-storage points a recorded answer (taken where, not taken why, or for BDR), and fix the test fixture at `test/desk-sync-engine-edges.test.js:489`. (DOC9-1)
8. BDR: declare the service's plain fields (account and provider ids, device ids, timestamps, device model and platform) as collected on both stores' forms, sourced from 4j's page; keep the sealed notebook as end-to-end encrypted. (LP9-6)
9. BVJ: add a "Before accounts open" list to `STUDY-DESK.md` (item, owner, state), pointed to by rule 11 and the service README, or declare 4l that list. (DOC9-3)
10. BVJ: trim `src/scripts/desk/CLAUDE.md` before the next addition; headroom is 4,848 bytes against an 8 KB ask. (ORC-g)

### Not reached

- No browser: AC9-10 (hover), LV9-12 and LV9-13 (menu overlap, 37 px gap), and AC9-6 (the printed code) were judged from CSS and LV9's notes, not seen.
- I did not re-fetch WCAG 2.2, Apple's guidelines, Google's Data safety page, or Cloudflare's Time Travel and Turnstile pages; verdicts on those lean on LP9's and AC9's fetched citations, and any statement of GDPR, COPPA, or CCPA is from memory and is a question for a lawyer.
- Nothing about the deployed preview or the dashboard (plan, Time Travel window, stored log content).
- DOC9-11 items 2, 3, 4 and 6 were not re-checked line by line; items 1, 5, 8, and 9's sources were.

## Appendix R: The auditors' brief

You are one auditor in Study Desk Audit 9 of the LIT Bible repository. Read this whole brief before
you start, then the part of the task your own prompt gives you.

### The project in five lines

LIT Bible (litbible.net) is an Astro static site for the Liberation and Inclusion Translation of the
New Testament. Its Study Desk is a desktop study tool behind `?desk=on`, keeping a reader's notebook
in the browser (IndexedDB). Since 2026-11-23 the work is Phase 4: optional sync of that notebook with
the iOS and Android apps (built by BDR) through "plan C": a small LIT service on Cloudflare (a Worker
with D1, `workers/notebook-service/`, deployed as a preview at `https://notebook-preview.litbible.net`;
production prepared, not deployed) holding each notebook end-to-end encrypted, with passkey sign-in
(Sign in with Apple and Google built and switched off). The owner is BVJ; the only desk user so far
is BVJ. The account pages are closed to every reader unless one browser opens them with
`?account=preview`.

### What is audited

- **Commit `3ef75d8e`** (`origin/main` on 2026-11-25), checked out read-only in
  `.claude\worktrees\desk-audit-9-784320`. The window opened at
  `fbcd83c0` (main before PR #680). `git diff fbcd83c0 3ef75d8e -- <path>` shows what a file gained.
- 33 merged pull requests, in merge order: #680 to #685 (spec drafts, the call's record), #686 and
  #687 (crypto reference and vectors), #688, #691, #692 (notebook service and its deploy workflow),
  #693 (notes from the Greek), #694 (format freeze work), #695 (sign-in), #696 and #697 (account work;
  #697 landed by rebase as `4231ce2e` and `89ec8396`), #698 (website connector), #699 (CLAUDE.md
  reorganization), #702 (CSP report Worker, `workers/csp-reports/`), #689, #690, #705, #706
  (Dependabot), #701 (BDR's iOS answers), #700, #703, #704, #707 to #712 (account pages, Turnstile,
  notices, the header's entry).
- Also the older code these touch or depend on (the desk's store and merge engine, the header,
  `public/_headers`, `/privacy`, `/delete-account/`, `public/.well-known/`).

### Rules for you (hard)

1. **Change nothing in the repository.** No edits, no commits, no `git stash`, no `git checkout`, no
   index-changing git command, no `npm ci`/`npm install` (the orchestrator installed packages). Write
   only inside your own folder: `…\scratchpad\audit9\<YOUR-ID>\`
   (scripts, notes, outputs). Your report is `…\scratchpad\audit9\<YOUR-ID>.md`.
2. **Do not run `npm run build`** (the orchestrator does; `dist/` will exist once it has). Running
   tests is fine: `node --test test/<file>` from the worktree root, or a worker's `npx vitest run
   <file>` inside its directory once its `node_modules` exists. Don't run the whole root suite
   (the orchestrator does), and don't run anything that writes into the repo.
3. **Never touch the deployed services.** No request of any kind to `notebook-preview.litbible.net`
   or any `notebook.litbible.net`, no `wrangler deploy`, no remote D1 command, no `wrangler secret`,
   nothing on Cloudflare or GitHub that creates or changes anything. Reading public pages and headers
   of `litbible.net` with a plain GET is allowed, but never POST to `/csp-report` and never load a
   page in a browser that runs its analytics (the week of CSP reports, 2026-11-25 to 12-01, must count
   readers only). Read GitHub with `gh` read-only commands only (`gh pr view`, `gh api` GETs). Never
   ask for, print, or write down a secret. If you find a secret in the repo, or a vulnerability live on
   litbible.net or the preview, stop and put it at the very top of your report marked URGENT, quoting
   no secret.
4. **Big files are never read whole.** `STUDY-DESK.md` (690 KB), `STUDY-DESK-FIXES.md`, the
   `STUDY-DESK-AUDIT-*.md` files, and `STUDY-DESK-ENCRYPTION.md` (260 KB): grep for the heading or ID
   (`grep -n '^#' FILE` lists headings) and read that section with an offset. `STUDY-DESK-FORMAT.md`
   (100 KB) and `STUDY-DESK-FOR-THE-APPS.md` (88 KB) likewise.
5. **Area rules.** Before reading code in an area, read its `CLAUDE.md` (the root `CLAUDE.md` has the
   table). Most relevant: `src/scripts/desk/CLAUDE.md`, `src/scripts/desk/sync/CLAUDE.md`,
   `src/scripts/desk/account/CLAUDE.md`, `workers/CLAUDE.md`, `public/CLAUDE.md`, `.github/CLAUDE.md`,
   `src/styles/CLAUDE.md`, `src/components/CLAUDE.md`. A rule written there is the design; a code path
   that breaks it is a finding, and a rule that is wrong or unsafe is a finding about the rule.
6. **Windows machine.** Run Python as `python` or `py`, never `python3`. Use absolute paths. The Bash
   tool is Git Bash; PowerShell is also available.
7. **Standards from their documentation, not memory.** When a finding rests on WebAuthn, OWASP,
   WCAG 2.2, a store's policy, a law, or Cloudflare's limits, fetch the page and cite it (URL and the
   section). If you cannot fetch it, say the claim is from memory.

### How to find and write findings

- **Fresh eyes.** Form your own view from the code and the design record. Earlier audits, handover
  notes, and "known limits" are only for tagging a finding after you have it, never for choosing where
  to look.
- **Prove each finding before you write it, then try to prove it wrong.** A finding needs evidence: a
  file and line, a test or script you ran (keep it in your folder and name it), or an exact quotation
  of two places that disagree. Then look for the guard, test, or doc that would make it false. If you
  can't decide, say "Confidence: Medium" and why. Do not report a finding you have not checked against
  the current code.
- **Severity** (after your own second look):
  - **Critical**: a reader's notebook or key can be read or destroyed by someone else, a secret is
    exposed, or an exploit is live now.
  - **High**: real risk to a reader's data, account, or privacy under plausible conditions; or a thing
    that would block an app-store review, break a law, or lose data in ordinary use once accounts open.
  - **Medium**: a real fault a reader or BDR would meet, with a workaround or limited reach; or a
    disagreement between spec, service, and clients that will cause a bug when the apps build to it.
  - **Low**: a small fault, a missing guard with no exploit today, a stale doc that misleads.
  - **Nit**: polish.
- **Tags**: `NEW`, or `KNOWN` with where it is already recorded (a "Still open" number in
  `STUDY-DESK-ENCRYPTION.md`, an ask in `STUDY-DESK-FOR-THE-APPS.md`, a "known limit" in an area
  `CLAUDE.md` or `STUDY-DESK.md`). A KNOWN item is reported only if the record understates it or no
  one has decided it and it matters. Also say `4j?` when the in-progress step 4j (the privacy page,
  the terms, "Ways to keep your notebook," and the first-time choice's words, being written now in
  another session) may already be covering it.
- **Shape of each finding** (exactly this, IDs `<YOUR-ID>-1`, `-2`, ...):

```
#### <ID>-1 · Medium · security · NEW
**One sentence that says what is wrong.**

- **Where**: `path:line` (and others).
- **What happens**: the concrete scenario: who does what, and what goes wrong.
- **Evidence**: what you read or ran, with numbers; the script's file name in your folder.
- **Why it isn't a false positive**: the guard or test you looked for and why it doesn't cover this.
- **Fix**: the recommendation (a recommendation, never a decision; say if it needs BVJ or BDR).
- **Confidence**: High / Medium / Low, and why.
```

- Categories: security, privacy, data-integrity, reliability, performance, a11y, seo, ui, usability,
  legal, coherence, docs, tests, maintainability, cost, copy.
- **Report layout** (your `.md`): a title with your ID and slice; one paragraph "Summary" with counts
  by severity; "Findings" (most severe first); "Improvements" (worth doing, not faults); "Questions for
  the owner" (decisions only BVJ or BDR can make, each with the case each way and your pick);
  "What held up" (what you tried to break and couldn't, with numbers); "Not reached" (what you could
  not check, and why). Plain prose: American spelling, the Oxford comma, periods and commas inside
  closing quotation marks, and **no em dashes** (use a comma, colon, or parentheses).
- Keep the report focused: no padding, no restating the code. Quote at most a line or two of code per
  finding.
- When you finish, reply with only: your report's path, the counts by severity, and the three most
  important findings in one line each.

## Appendix S: The brief's addendum for PRs #713 and #714

Read `BRIEF.md` first; every rule there holds. This page changes only what is audited.

- On BVJ's instruction (2026-11-25, evening), the audit also covers **PR #713**, "Study Desk step 4j: privacy policy, Terms of Use, and the words accounts need," merged as `37a7498e` at 21:22 Pacific on 2026-11-25, and **PR #714**, "Study Desk docs: step 4j's last two choices approved, and its merge" (open, head `5b1ddf2f`, one file, `STUDY-DESK.md`, +7/-4; the orchestrator audits it).
- **The worktree is now at `37a7498e`** (the audit branch was fast-forwarded to `origin/main`). `git diff 3ef75d8e 37a7498e -- <path>` shows what #713 changed: 28 files, +1,330/-139, among them `src/pages/privacy.astro` (+315), the new `src/pages/terms.astro`, `STUDY-DESK.md` (+100), `STUDY-DESK-FOR-THE-APPS.md` (+76), `src/lib/desk-first-use.mjs`, `src/lib/desk-reminder.mjs`, `src/lib/desk-account-words.mjs`, `src/scripts/desk/first-use.js`, `tour.js`, `tour-runner.js`, `notebook-page.js`, `panel.js`, `shell.js`, `export-import.js`, `src/scripts/desk/account/page.js`, `src/pages/desk/help.astro`, `src/pages/delete-account.astro`, `src/components/SiteFooter.astro`, `src/scripts/announcement-gate.js`, `src/styles/desk.css`, four tests (one new, `test/desk-first-use-linked.test.js`), and four `CLAUDE.md` files (`src/pages/CLAUDE.md` gained a section on the two pages: read it).
- **The orchestrator is running `npm test`, `npm run check`, the build, and the link check at `37a7498e` now.** Don't run any of them, and don't rely on `dist/` until the file `…\scratchpad\audit9\logs\summary-713.txt` ends with the line `done` (read it once when you need `dist/`; if it isn't there yet, work from source and say so).
- **The earlier findings 4j was expected to cover.** Step 4j was being written while the audit ran, so the auditors tagged findings "4j" or "4j?". The verified state of those findings is in `…\scratchpad\audit9\VER9b.md` (its table) and the reports it cites (`LP9.md`, `AC9.md`, `LV9.md`, `CP9.md`, `DOC9.md`, `SV9.md`). Part of your job is to say, for each such finding, whether #713 **fixed** it, **partly fixed** it (and what remains), or left it **open**, with the line that shows it.
