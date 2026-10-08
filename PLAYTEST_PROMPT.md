# Codex playtest prompt — actually play Monopoly Madness

The first audit (`AUDIT_REPORT.md`) was a code review: Codex was told not to touch Firebase or a browser, so no game
was ever played. This prompt makes it **play** the game with several simulated players against the **Firebase emulator**
(never the real project) and report what breaks. Paste everything below the line into Codex at the repo root.

---

Goal: find bugs by *playing*, not reading. Build a local multi-client playtest harness and run it. Read `arch.md`
(v1.1.7 – v1.1.12 sections), `AUDIT_REPORT.md` and `audit/offline-checks.cjs` first — don't re-report fixed items.

## Hard rules
- **Never** use the real Firebase project or `.env.local`. Use the Firestore + Auth **emulators** only; point the app at
  them with a separate `.env.emulator` (gitignored) and `connectFirestoreEmulator` / `connectAuthEmulator` behind an
  `import.meta.env.VITE_USE_EMULATOR === 'true'` switch in `src/lib/firebase.ts` (default off — do not change prod behaviour).
- Deploy `firestore.rules` to the emulator so the rules are exercised too. If Java/firebase-tools can't be installed,
  say so and fall back to Task B only.
- No pushes, no commits; leave changes uncommitted. Don't edit game rules to make tests pass — report instead.
- Report failures as failures, with the exact command and output.


## Regressions that already shipped once — your harness MUST catch these
These got through because nobody clicked through the real UI. Drive the real screens (Playwright), don't just call hooks:
1. **Roll Dice missing/inert in a single-player vs-bot game** (v1.1.11): the dice display was replaced by an empty action stage; separately `handleDiceRoll` read a stale `gamePhase` so every click logged "Dice roll rejected". Assert: at the start of every human turn a *visible, enabled* Roll Dice button exists and clicking it changes `lastDiceRoll` in Firestore within 3 s.
2. **Page scroll locked while a pop-up is open** (rent, card, purchase): assert `document.scrollingElement.scrollTop` can change (wheel/touch) while an action stage is open, on desktop and at 390 px.
3. **Blank page when `VITE_FIREBASE_*` missing** — build once without env vars and assert the "isn't configured" screen renders instead of a white page.
4. Turn never stalls: for each scenario assert that within 90 s of any human turn starting, either an action has occurred or the turn timer advanced the turn.
5. Action stage priority: at most one stage visible; never a stage for someone else's decision; Pass → bank auction when auctions are on.
6. Phone sheets (portfolio, teams, workers, trade, log) open, are scrollable, close with Escape / the close button, and focus returns to the opener.

## Task A — real multi-client playthroughs (Playwright)
Install Playwright as a **dev** dependency only if needed. Drive 2–4 browser contexts (each its own anonymous uid)
against `vite` + emulators. Script scenarios that cover **mod combinations**, each run to a natural end or 150 turns:
1. standard, 3 players, timer off
2. auctions on + draft queue of 3 properties, 3 players, timer 30 s
3. trading on: create / accept / reject / cancel / expire between every pair; try accepting someone else's offer
4. workers on + teams on (teammate rent exemption, shared monopoly, last-team win)
5. mortgage on: mortgage → rent skip → unmortgage; build/sell with even-build
6. single-player vs Bot Noob, auctions on, with and without a draft queue
7. 8 players joining at the same instant (use `Promise.all`) — check no lost joins / duplicate ids
8. a player closing the tab mid-turn and mid-auction (timer on and off); host closing mid-draft; refresh and reconnect
Each scenario: assert after every state change (read the Firestore doc via the emulator Admin SDK) the invariants —
no active balance < 0, each property ≤1 owner, `player.properties` ⇔ `property.owner` (except documented neutral
bankrupt tiles), exactly one active current player, ≤1 live auction, `status` matches `gamePhase`, `winnerId` ⇒ game
ended, turn counter strictly increases, no player is skipped without a timeout. Capture a console log and a
screenshot on any failure.

## Task B — headless engine/updater fuzz (no browser)
Extract or import the pure updaters (`core.ts`, plus `nextDraftStep`/auction/trade updaters — extract them if they're
still inside the hook) and run a seeded random *legal-action* fuzz: N∈[2,8] players, random settings combination,
random legal actions (roll, buy, decline, bid, trade, build, sell, mortgage, jail choices, end turn, timer expiry,
duplicate/late delivery of an earlier action to simulate races). Assert the same invariants after every step. Run
≥2,000 seeds. Minimise any failing seed to the shortest action list and keep it as a regression test.

## Task C — what a human would notice
While playing, note UX dead-ends: a dialog with no way out, a button that does nothing, a state where nobody can act
(softlock), confusing copy that contradicts the rules text in `RulesPanel.tsx`, lag/jank on a 390×844 viewport.

## Output
1. Findings table `id · severity · scenario · seed/steps to reproduce · expected vs actual · likely cause (file:line)`.
2. For each softlock/crash: the minimal repro script, saved under `playtest/repros/`.
3. Harness files added (`playtest/`), how to run them (one command each), and wall-clock of a full run.
4. A pass/fail table: scenarios × invariants.
5. "Wiki update" note ≤10 lines.
