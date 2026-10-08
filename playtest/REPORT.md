# Emulator playtest report — 8 October 2026

**Outcome: FAIL.** Normal new-player joining, some bail payments and Rematch fail when Firestore rejects explicit `undefined` values. There is also a strict bankruptcy/current-player invariant gap and a previously documented timer-off disconnect stall. Game rules were not edited to make these pass.

The independent property/event card kit is described in [UI_CARDS.md](../UI_CARDS.md), including individual inline SVG city art. It is ready for integration; the live game still uses its existing cards.

## Isolation and method

- Only `demo-monopoly-playtest`, Auth `127.0.0.1:9199`, Firestore `127.0.0.1:8180`, and app `127.0.0.1:4187` were used. The emulator loaded the checked-in `firestore.rules`. `.env.local` was never read or used.
- `src/lib/firebase.ts` has the requested default-off `VITE_USE_EMULATOR === 'true'` switch, a `demo-` project guard, emulator connections before anonymous sign-in, and analytics disabled in emulator mode. Normal configuration follows the existing production branch.
- Vite's separate configuration uses `playtest/env` as its **envDir**, for both the emulator and missing-settings builds. The ignored `.env.emulator` contains only fake demo settings.
- Each Playwright page gets a separate browser context/anonymous uid. The app's existing screens and callbacks perform gameplay writes; Admin reads observe rooms and provision explicit fixtures. No security rules were loosened. Admin fixture provisioning itself bypasses rules; subsequent browser writes exercise them.
- PT01 prevents ordinary multiplayer setup. Consequently all successful three-player runs use authenticated **pre-seated reconnect fixtures**, not successful normal guest joining. The bot room is created through the real lobby UI. Its 2-second auction duration and optional three-property draft queue are fixture configuration.
- Long playthroughs use Playwright browser clocks to accelerate animation/turn/auction waits. The 90-second stall watchdog uses real Node wall time. Disconnect checks use real time without accelerated clocks. These tests do not establish real-device frame-rate or wide-area network latency guarantees.
- Engine fuzz imports/transpiles the actual `core.ts` and hook updater bodies, replacing React, clock and Firestore boundaries. Runtime-only exports expose draft/auction/turn updaters; source game files are untouched. React effects are not simulated. This explains why a transient bankruptcy state is visible and why in-memory checks cannot detect Firestore encoding failures.

## Findings

| ID | Severity / status | Scenario and minimal reproduction | Expected → actual | Likely cause |
|---|---|---|---|---|
| PT01 | P1, new blocker | `node playtest/repros/join.cjs`: create a 3-player room through UI; join one new guest. `node playtest/concurrent-joins.cjs`: eight independent uids attempt joining together. | Guest becomes seated → guest remains in lobby; eight concurrent joiners persist **zero** seats. Console: `Unsupported field value: undefined`. | `src/components/game/MonopolyGame.tsx:741`: `isSpectator: lateJoin || undefined` is included for every normal new join; Firestore rejects the update before it can commit. |
| PT02 | P1, new bot softlock / inert bail action | `node playtest/repros/bot-jail.cjs`: real bot room; seed bot jailed, positive rental income, enough cash, no jail cards, Free Parking pot disabled/absent. Wait for bot's normal bail action. The longer draft-bot playthrough also stalled for 90 real seconds at turn 41. | Bail releases the bot → write fails with `undefined` at `gameState.freeParkingPot`; bot remains jailed. With timer off no subsequent action rescues it. Human bail uses the same updater, although humans can choose Stay in jail. | `src/hooks/useGameLogic.ts:1165` copies absent `prev.freeParkingPot` into an explicit field. `getInitialState` does not initialize that field. This is distinct from the fixed A08 bot jail-card authorization bug. |
| PT03 | P2, new Rematch failure | `node playtest/repros/rematch.cjs`: reconnect the host to an ended fixture, click Rematch. | Fresh setup in same room → Firestore rejects the write; room stays ended. Back to lobby remains available. | `src/hooks/useGameLogic.ts:916` and `:919`: cleared `teamId` and `owner` are explicit `undefined` values. The old offline rematch check passes because it does not encode a Firestore write. |
| PT04 | P2, strict invariant gap | Seed 13; deletion-minimized 123-step replay: `node playtest/repros/fuzz-1.cjs`. Shorter focused valid mid-game fixture: `node playtest/repros/bankrupt-current.cjs` — one rent payment from a player with $1 against a $2 debt, three active players initially. | Playing always has one active current player → payer becomes inactive while remaining current; assertion reports `0 !== 1`. | `src/gameEngine/core.ts:475` completes the bankrupt actor's turn without transferring current player. `src/hooks/useGameLogic.ts:583` relies on that actor's client to advance after two seconds. A connected client normally recovers; the fuzz result alone is **not** proof of a permanent online stall. |
| PT05 | P1, known residual confirmed by UI | `node playtest/repros/disconnect.cjs`: pre-seat three players, timer off, close current player's tab, leave two clients connected for 91 seconds. | Another action or turn advancement within 90 seconds → turn remains unchanged. The timer-30 control advanced 0 → 1. | `src/hooks/useGameLogic.ts:558` only provides deadline recovery when a timer exists; `:583` completed-turn recovery belongs to current actor. This timer-off limitation was already noted in `AUDIT_REPORT.md` R9; it is not a new regression. |

No fixes are claimed for these findings. The former heartbeat, third-party trade acceptance, bot jail-card, empty-draft and draft-host recovery issues are not re-reported as open based on the old audit. The shipped offline suite now passes 26 checks, and the real host-disconnect draft test finishes successfully.

## Scenario × invariant results

“PASS to 150” refers to the individually verified runs in [verified-playthroughs.json](verified-playthroughs.json). It never means normal guest setup passed. Continuous Admin snapshot assertions cover balances, unique ids, ownership/portfolio agreement (excluding documented inactive historical tiles), active current player, auction count, status/phase agreement, winner/end agreement and monotonic turn counters. Every changed actor must increment the counter; every bid is not required to increment it.

| Scenario | Balances / ownership | Active current player | Auction / status / winner / turn | UI / liveness | Coverage |
|---|---|---|---|---|---|
| Standard, 3 players, timer off | PASS | PASS | PASS | PASS to 150 | Pre-seated fixture; visible enabled dice and Firestore result checked at human turns. |
| Auctions + draft queue 3, timer 30 | PASS | PASS | PASS | PASS to 150 | Draft resolves; declined purchases enter bank auctions. |
| Trading, 3 players | PASS in targeted transfers | PASS in fixtures | PASS in fixtures | 24 pair/action checks PASS | Six ordered pairs × accept/reject/withdraw/expire; turn/expiry fixtures explicitly configured. Unrelated players have no Accept control. |
| Workers + teams | PASS | PASS | PASS | PASS to 150 | Separate real-UI worker assign/remove, teammate exemption, shared-monopoly doubled rent and last-team victory checks pass. |
| Mortgage | PASS | PASS | PASS | PASS to 150 | Separate mortgage/unmortgage and mortgaged rent-skip checks pass. Even build succeeds; uneven build is unavailable. Selling is covered in fuzz/offline checks, not a dedicated live-UI sale. |
| Single player vs Bot Noob, no draft | PASS | PASS | PASS | One run PASS to 150 | Real UI creation; bail bug still affects this mode when its preconditions occur. |
| Bot + three-property draft | PASS until stall | PASS until stall | PASS until stall | FAIL PT02 | Draft completed; later bot bail stalled at turn 41. Draft itself is not the cause of the bail defect. |
| Eight concurrent new joins | No negative/duplicate seated ids; zero seats persisted | Not reached | Not reached | FAIL PT01 | Eight distinct authenticated contexts, simultaneous UI Join clicks. This does not verify successful contention handling. |
| Disconnect current player, timer 30 / 0 | PASS | PASS | PASS | PASS / FAIL PT05 | Real elapsed waits: 40 seconds / 91 seconds. |
| Disconnect during auction, timer 30 / 0 | PASS in final state | PASS | PASS | PASS both | Surviving clients resolved auctions. |
| Host closes mid-draft | PASS in final state | PASS | PASS | PASS | Surviving clients finished three-item draft and entered playing. |
| Refresh/reconnect | PASS | PASS | PASS | PASS | Same uid retained, no duplicate seat, host identity retained. |
| 2,000-seed engine/updater fuzz | PASS until reported failure | **FAIL in 78 seeds** | PASS until reported failure | Effects/network not simulated | 940,010 transitions; one unique strict invariant signature. |

Targeted feature cases assert their described outcomes; they are not substitutes for continuous full playthrough coverage of every rule combination. Successful runs assert at most one action stage and no persistent stage for someone else's decision, allowing a brief snapshot/render settling interval.

## Human-visible checks

- Rent, card and purchase stages allow actual background wheel scrolling at **390×844 and 1440×844**. Wheel events inside a contained sheet body are expected to scroll that body; the background test targets outside it.
- Portfolio, Teams, Workers, Trade and Log sheets open; Escape and close buttons restore focus. Portfolio/Workers/Trade/Log body scrolling was verified with actual wheel events; Teams content fits without needing scroll.
- The missing-settings build renders **“Monopoly Madness isn't configured”**, with zero page errors.
- UI failures above are visible dead ends or inert actions. The bot bail failure leaves the human waiting on Bot Noob. Rematch leaves the completed-game screen. Normal joining leaves the visitor on the lobby page with a generic error dialog.
- The existing Log opener is an emoji-only button (`📜`); its accessible name does not say “Game log”. This is a minor live-UI polish issue, separate from the new SVG-based card kit.
- New card fixtures: 78 normal/reduced-motion browser checks passed across 320/390/1440; full details and screenshots are in `audit/ui-cards-preview/`. Device FPS on a physical phone was not measured.

## Fuzz evidence and limits

Command: `node playtest/fuzz.cjs --seeds=2000` — **exit 1**, 2,000 seeds, 940,010 transitions, 78 failing seeds, one unique signature: `current player is not active / 0 !== 1`. Seed 13's original trace has 225 actions; deletion minimization retained 123. This is a deletion-minimized trace, not a proof of global shortest length; the dedicated one-action fixture provides the smaller focused reproduction.

Coverage includes 243,444 human rolls; 8,908 bot rolls; 87,072 rent payments; 36,800 card resolutions; 25,414 purchases; 17,609 declines; 7,207 bids; 5,787 auction resolutions; 49,147 trade creations; 16,308 accepts; 16,339 rejects; 16,433 withdrawals; 47,046 house builds; 33,103 house sales; 720 hotel builds; 982 hotel sales; 33,631 mortgages; 20,457 unmortgages; 18,180 worker assignments; 6,062 jail skips; 4,812 bail actions; 1,241 jail-card uses; 982 draft steps; 23,280 explicit turn/timer advances; and 37,705 duplicate/late callback replays. Actions which a live guard rejects remain valid replay/race probes; not every invocation must change state.

Fuzz does not run Firestore serialization/security rules, browser rendering, React effect scheduling, or all concurrent transaction interleavings. The real bail/Rematch failures demonstrate those limits. “No skipped player” is bounded by observed turn progression and guards; exhaustive fairness across distributed failures is not established.

## Run and reproduce

Tools were installed in an isolated temporary directory; the application package manifest/lockfile were not changed. Requirements: Node/npm, installed Edge, Java 21 (existing Android Studio runtime), and local tools:

```powershell
npm install --prefix "$env:TEMP\monopoly-playtest-tools" firebase-tools@15.33.0 playwright firebase-admin --no-audit --no-fund --cache "$env:TEMP\monopoly-playtest-npm-cache"
```

From the repository root, start each service in its own terminal:

```powershell
.\playtest\start-emulators.ps1
.\playtest\start-app.ps1
```

The emulator launcher uses a 6 GB Java heap and four logical worker CPUs, the demo-only single-project flags, and a byte-for-byte copy of the checked-in rules. It launches Firestore locally and the Auth emulator through Firebase CLI. No Firebase login/deploy is required. `MONOPOLY_PLAYTEST_TOOLS` can override the tools directory.

Full batch, one command:

```powershell
node playtest/run.cjs
```

Individual commands:

| Purpose | Command |
|---|---|
| Fuzz + minimized replay files | `node playtest/fuzz.cjs --seeds=2000` |
| Any long scenario | `node playtest/ui-playtest.cjs play-standard --fast-clock` (also `play-auction`, `play-teams`, `play-mortgage`, `play-trading`) |
| Both bot draft modes | `node playtest/ui-playtest.cjs bot --fast-clock` |
| Trading/mortgage/workers | `node playtest/ui-playtest.cjs features` |
| Rent/team/build/win landings | `node playtest/ui-playtest.cjs landing` |
| Stage scroll + phone sheets | `node playtest/ui-playtest.cjs ux` |
| Disconnect watchdog | `node playtest/ui-playtest.cjs disconnect` |
| Refresh / mid-auction / mid-draft disconnect | `node playtest/ui-playtest.cjs reconnect` |
| New joining / simultaneous joining | `node playtest/repros/join.cjs` / `node playtest/concurrent-joins.cjs` |
| Bail / Rematch / strict bankruptcy | `node playtest/repros/bot-jail.cjs` / `node playtest/repros/rematch.cjs` / `node playtest/repros/bankrupt-current.cjs` |
| Missing settings | `npx vite build --config playtest/vite.config.mjs --mode missing --outDir playtest/artifacts/missing-build`, then `node playtest/missing-env.cjs` |
| Existing offline regressions | `node audit/offline-checks.cjs` |

Expected failure output is preserved, rather than turning known findings into passing tests:

```text
node playtest/repros/join.cjs
players: 1
Error joining room: FirebaseError: Function Transaction.update() called with invalid data.
Unsupported field value: undefined
FAIL: guest join left 1 players, expected 2

node playtest/concurrent-joins.cjs
expectedPlayers: 8, actualPlayers: 0, uniqueUids: 8
Eight concurrent new joins did not persist / 0 !== 8

node playtest/repros/bot-jail.cjs
FAIL: Bot bail write rejected; bot stays jailed with timer off / true !== false
Console: Unsupported field value: undefined (found in field gameState.freeParkingPot)

node playtest/repros/rematch.cjs
FAIL: Rematch write rejected; room remains ended / 'ended' !== 'setup'

node playtest/repros/bankrupt-current.cjs
FAIL: current player is not active / 0 !== 1

node playtest/repros/disconnect.cjs
disconnect-timer-30: PASS, before 0, after 1
disconnect-timer-0: FAIL, Disconnected current player left turn stalled for 91 seconds
```

Complete unabridged per-command output, screenshots, console logs, room states and full-batch timing are generated in ignored `playtest/artifacts/`. `full-run.json` and `run-*.log` identify the recorded final batch; `ui-results-<mode>.json` records case results. The batch deliberately exits nonzero when any test fails.

## Verification and run limitations

- Existing offline suite: **26 passed, 0 failed**.
- `npx tsc -p tsconfig.app.json --noEmit`: **FAIL**, exactly the six known missing Radix packages (`checkbox`, `collapsible`, `progress`, `separator`, `toggle-group`, `toggle`). No new diagnostics.
- `npx vite build --config playtest/vite.config.mjs --mode emulator`: **PASS**, bundle-size warning. The safe isolated config is used instead of a default build that could load `.env.local`.
- Missing-settings build and configuration-screen browser assertion: **PASS**.
- Initial emulator startup failed because its rules path was outside the configured directory; copying the unchanged rules to ignored artifacts resolved that setup problem.
- Two early emulator runs exhausted Java heap (`java.lang.OutOfMemoryError: Java heap space`); the preserved `emulator-heap-failure.log` records this environment failure. Those transport timeouts/stale views are not classified as game bugs.
- An early fixture identity probe re-imported a development module after hot reload, which could trigger another anonymous sign-in. It was replaced with a read of persisted browser identity; affected fixture runs were rerun. Early sub-second render/state assertions were also changed to allow snapshots to settle and writes to retry. Archived early output is not a passing game result.
- No production deployment, production Firebase access, commits, pushes or wiki edits occurred.

Final batch: `node playtest/run.cjs` ran for **585.61 seconds (9 min 46 s)** before it was stopped because the emulator became unresponsive and exhausted Java heap again. It is **ABORTED / FAIL**, not a completed passing suite. The recorded batch completed standard and auction playthroughs successfully; later workers/teams, mortgage, trading, bot and targeted UI attempts failed with transport errors/timeouts. Fuzz completed and reproduced the same 78 invariant failures (269.80 s under concurrent load; the initial standalone run took 158.83 s). No trustworthy aggregate pass count or clean full-run wall time is claimed. Individual successes above are separate earlier runs. See `artifacts/full-run.json` and `artifacts/run-*.log`.

The dedicated live-UI 150-turn trading run remains unverified because of the transport failure; its 24 targeted pair/action cases passed earlier. Eight successful simultaneous joins remain unverified because PT01 prevents seating. These are explicit coverage gaps.

After that aborted three-worker attempt, the batch launcher was changed to run serially by default, save progress incrementally, and skip emulator-dependent jobs when a five-second local health probe fails. `--workers=3` opts into concurrency. That revised full-batch scheduling was syntax-checked but not rerun; no claim is made that it resolves the emulator's underlying transport/heap problem.

## Files added / changed

New `playtest/`: emulator/app launchers, `firebase.json`, isolated `vite.config.mjs`, `tools.cjs`, `browser-uid.cjs`, `engine.cjs`, `invariants.cjs`, `fuzz.cjs`, `ui-probe.cjs`, `ui-playtest.cjs`, `concurrent-joins.cjs`, `bot-fixture.cjs`, `feature-scenarios.cjs`, `landing-scenarios.cjs`, `reconnect-scenarios.cjs`, `jail-serialization.cjs`, `rematch-scenario.cjs`, `build-race.cjs`, `missing-env.cjs`, `run.cjs`, this report, `verified-playthroughs.json`, and `repros/` scripts/seed data. `build-race.cjs` is a passing delayed-delivery regression probe, not an open finding.

Only existing source change: default-off emulator support in `src/lib/firebase.ts`; `.gitignore` adds local environment/generated-output exclusions. The card deliverables and their exact file manifest are in `UI_CARDS.md`. Existing untracked `.claude/settings.local.json` was left untouched.

## Wiki update for Claude Code

- Added standalone property/event card kit with individual original city SVGs, including Singapore; live wiring remains to do.
- Emulator playtesting found normal-join, bail and Rematch Firestore encoding failures; no rule fixes were applied.
- Confirmed strict current-player gap on bankruptcy and existing timer-off disconnect stall.
- 2,000-seed fuzz exercised 940,010 transitions; 78 seeds hit one invariant signature; focused replays saved.
- Record browser fixtures, limitations and final timing from this report; production remains unverified.
