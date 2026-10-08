# UI polish and playtest re-review — 8 October 2026

Reviewed against the current **v1.1.16** source, `UI_POLISH_PROMPT.md`, `PLAYTEST_PROMPT.md`, `ARCHITECTURE.canvas`, architecture release notes, card adapters, UI components and existing harness/report.

This is a review and implementation handoff. No game or UI fixes were applied. No fresh multi-client browser playthrough was run in this review. Earlier browser results remain historical evidence, not validation of v1.1.16.

## Main conclusions

1. **The polish pass is unimplemented.** `src/ui-kit/polish/`, `UI_POLISH.md` and `audit/ui-polish-preview.cjs` are absent. Existing UI and card kits are useful foundations, but do not satisfy the fourteen polish deliverables.
2. **Cards are now integrated.** v1.1.13–16 wired portfolio/title deeds, purchase/auction cards, event reveals and the trade picker. `UI_CARDS.md` and `playtest/REPORT.md` still describe live integration as pending; those statements are stale. Preserve the city-specific SVG art, including Singapore.
3. **The old playtest findings need reclassification.** Joining and bail have source fixes; Rematch has a serialization setting change. Bankruptcy and disconnect received recovery mechanisms. None of those changes has a fresh emulator acceptance result in this review.
4. **Update the harness before interpreting another full run.** Its sheet selectors and background page-scroll assumption describe an older UI. A failing outdated selector is not a game regression.

## UI polish: source-based priorities

This ranking is provisional, based on current implementation and exposure frequency. The prompt requires opening populated current-game fixtures at 390 and 1440 before claiming a visual audit; that browser audit remains to do. No current screenshots, measured contrast, overflow, frame rate or target-size certification is claimed here.

| Rank | Element / current evidence | Recommended work / replacement |
|---|---|---|
| 1 | Board readability and ownership: `MonopolyBoardLayout.tsx:336` uses `0.34rem` phone names (about 5.44 px at a 16 px root); `:372` explicitly renders an ownership/auction dot. | `BoardTile`: short codes + SVG, minimum 9 px tile text, owner banner/initial, distinct mortgage/neutral/auction/team states. Keep a full-name accessible tap summary. |
| 2 | Board centre: `CentralDisplay.tsx` supplies dice/actions; outer board at `MonopolyBoardLayout.tsx:390` is a plain square grid frame. | `BoardFrame` with restrained neon depth; keep Roll Dice visible and enabled on eligible turns. Layers must not intercept its clicks. |
| 3 | Dice: white rounded rectangles and rapid `animate-spin` in `CentralDisplay.tsx:65`. | `Dice`: pip faces, tumble/settle, doubles feedback, immediate reduced-motion result; display only caller-supplied outcomes. |
| 4 | Tokens: `MonopolyBoardLayout.tsx:55` uses 16 px phone discs; multiple tokens compete for tiny cells. | `Token` / `TokenStack`: legible rims, turn cue and predictable stacking. Preserve existing position/movement authority in the adapter. |
| 5 | Player panel: small cash/worth tiles and a rank that can disagree with standings (`PlayerPanel.tsx:201–205`). | `PlayerCard`: prominent fixed-width counters, caller-computed rank, status chips and optional caller-supplied sparkline. |
| 6 | Turn/header: `src/ui-kit/TurnStatus.tsx` has a compact label/phase/ring; header has several competing compact controls. | `TurnBanner`: one clear actor/phase hierarchy, readable timer urgency and token. Preserve skip/disconnect messaging. |
| 7 | Navigation: `SideDock.tsx:95` labels are `0.72rem` (about 11.52 px); desktop tab controls in `MonopolyGame.tsx:1130–1136` request 40 px minimum heights. | `NavBar` / `DockTabs`: minimum 12 px text, measured 44 px targets, badges, focus states and safe-area spacing. Six enabled phone items need a 320 px fixture. CSS minimums alone do not establish actual computed sizes. |
| 8 | Decision stages and auctions: existing `ActionStage` / dialog bodies / `AuctionStatus` are functional and cards are already embedded. | `StageFrame`, `StageHero`, `StageStat`, `StageActions`, `AuctionHall`: stronger kind accents and bid hierarchy. Keep exactly one decision owner, legal bid callbacks and sticky reachable actions. |
| 9 | Player/log rows: `SideDock.tsx:34–36` uses 0.65rem status chips (about 10.4 px); list surfaces are repetitive. | `ListRow` family plus `EmptyState` / `Skeleton`, with readable two-line hierarchy and trailing values. |
| 10 | Cash feedback and end states: transaction notifications already exist in `TransactionNotification.tsx`; achievements already exist in `MonopolyGame.tsx`. | Add balance-adjacent `MoneyDelta`; refine `Toast`, `AchievementPop`, `GameOverStage`. Do not describe existing notifications as absent. Use SVG icons, token-only emoji and bounded reduced-motion-safe effects. |

### Concrete UI correctness issue

**P2: inconsistent rank calculations.** `PlayerPanel.tsx:202–205` sorts by `balance + propertyCount * 100000`. `SideDock.tsx:9–10,19–20` sorts by cash plus actual property current values. Example: A has $100K cash and one $1M property; B has $500K cash and no property. The panel ranks B first while the Players list ranks A first. Supply one agreed rank/net-worth calculation through props; do not replicate the approximation in the new `PlayerCard`. Decide tie handling and bankrupt/spectator treatment consistently. This is source-confirmed, not a newly played browser failure.

### Polish implementation boundaries

- Follow the requested **new files only** boundary: `src/ui-kit/polish/`, `UI_POLISH.md`, `audit/ui-polish-preview.cjs`, and the generated-folder ignore line. Existing integration belongs in a later separately authorized wiring pass. Leave `LobbySystem.tsx` alone.
- Add namespaced polish tokens rather than editing the old kit's CSS. Supply typed/JSDoc props, populated previews and explicit replacements/GameState mappings for every component.
- `cardAdapters` is **`src/components/game/cardAdapters.ts`**, not `.tsx` as the prompt's brace list suggests.
- The old `audit/ui-preview.cjs` still names deleted `TradingSystem`, `PropertyCard` and `GameLog` components and loads CSS from `dist/assets`. Adapt the new harness to current components and a fresh isolated build; old generated pages are not current-game evidence.
- Required new components remain: BoardTile, BoardFrame, Dice, Token/TokenStack, TurnBanner/MoneyDelta, PlayerCard, NavBar/DockTabs, StageFrame/Hero/Stat/Actions, AuctionHall, ListRow family, Toast/AchievementPop, GameOverStage, EmptyState/Skeleton, and tokens.
- Data gaps: no persistent net-worth history was identified for a sparkline; accept an optional prop and honest empty state. Keep money, rent, mortgage, build costs, bid legality, timer deadlines and outcomes supplied by the engine/adapters. Never invent these from visual state.
- A 40-cell perimeter board cannot give every phone cell a disjoint 44 px target within 320 px. The architecture already treats it as a compact map with a readable summary. Document that exception explicitly and provide 44 px detail/action controls; do not claim all tile targets meet 44 px.
- Verify 320/390/1440, eight players, long Global Edition names, all mods/nav items, changing digit widths, normal/reduced motion, computed text contrast, no horizontal overflow and reachable sheet/decision footers. Physical-phone performance remains unmeasured.

## Playtest findings: current status

| ID | Current source / fresh result | Claude acceptance work |
|---|---|---|
| PT01 new-player join | `MonopolyGame.tsx:762` now conditionally adds `isSpectator` instead of writing undefined. `firebase.ts:29` enables `ignoreUndefinedProperties`. Old failure is **source-addressed, emulator retest pending**. | Run normal guest joining and eight simultaneous real UI joins; assert seats, unique ids and membership, then use ordinary joins in long multiplayer runs. |
| PT02 bot/human bail | Initial state sets `freeParkingPot: 0` (`useGameLogic.ts:209`); bail conditionally adds the pot (`:1167`). **Source-addressed, emulator retest pending**. | Run the focused bot-jail script and human Pay bail with pot disabled and enabled; verify cash, jail release and next action. Repeat both bot draft modes to 150 turns/end. |
| PT03 Rematch | Reset still assigns undefined (`useGameLogic.ts:918,921`), but Firestore now ignores undefined. **Mitigation present, emulator retest pending**, not the same unmitigated encoding bug. | Verify the serialized room returns to setup and old owners/team ids are actually cleared, including a previously teamed/property-owning fixture. Do not rely only on the in-memory rematch test. |
| PT04 bankrupt current actor | Fresh `node playtest/repros/bankrupt-current.cjs` still fails `current player is not active / 0 !== 1`. The new effect (`useGameLogic.ts:584–589`) permits another client to advance after 3.5 s. | Decide whether the required invariant must hold atomically. If yes, fix the transition. If an explicit completed-turn grace state is intended, document that contract and test bounded recovery independently; do not simply remove the assertion. Close the bankrupt client's tab and verify survivors recover exactly once. The pure-engine failure alone does not prove permanent online deadlock. |
| PT05 timer-off disconnect | Host-only **Skip their turn** appears for stale presence (`MonopolyGame.tsx:1024–1029`). This is manual recovery, not automatic advancement. | Test stale-presence threshold, host click and resulting turn/settlement. Also test current player = disconnected host, and host unavailable. A visible button alone does not satisfy the existing 90-second action/advance requirement; decide/document expected policy. |

### Harness changes needed before rerun

1. `playtest/ui-playtest.cjs:210` looks for **My properties / Worker assignment / 📜**. Current phone nav uses **Properties / Workers / Log**. Replace stale selectors and verify Escape, close-button focus return and real scroll in overflowing sheet bodies. The old emoji-only Log criticism is stale: current navigation uses a labelled SVG icon.
2. The UX test at `ui-playtest.cjs:190–199` requires the document's scrollTop to increase. v1.1.14 intentionally uses one screen without page scrolling. Revise regression 2 in the prompt and harness together: stages must not add a global scroll lock, existing scrollable dock/sheet content must remain usable, and the one-screen layout must not gain page overflow. Only require document scrolling in an explicit overflow fixture that tests the component contract independently.
3. Successful prior multiplayer runs used Admin-preseated reconnect fixtures because joining was broken. Keep fixtures for targeted rules cases, but add ordinary-create/join coverage now that PT01 is source-addressed. Clearly distinguish Admin setup (bypasses rules) from browser actions (exercise rules).
4. The prior full batch aborted after **585.61 seconds** due to emulator transport/back-channel/heap failure. Serial scheduling was added afterward but has not been validated end to end. Run serially, capture current per-command logs and a completed aggregate result; never reuse that aborted run as a current pass count.
5. Preserve historical 2,000-seed results (940,010 transitions, 78 failures) with their version. Fresh rerun is needed after any engine/invariant decision. The immediate bankruptcy assertion still fails today; its delayed React recovery is not simulated by this harness.
6. Complete the previously missing 150-turn trading playthrough, eight successful simultaneous joins and dedicated browser build/sell checks. Retest stage ownership/Pass→auction, Roll Dice→Firestore within 3 seconds, missing-env configuration UI, bot draft modes and disconnect/reconnect cases against the integrated cards.
7. Refresh obsolete comments/report claims that joining is still broken or cards are not integrated. Retain old failures as history with explicit status rather than silently replacing evidence.

## Fresh verification in this review

| Command | Result |
|---|---|
| `node audit/offline-checks.cjs` | **PASS: 26 passed, 0 failed**, including 12,719 seeded payment transitions. |
| `npx tsc -p tsconfig.app.json --noEmit` | **FAIL:** exactly six TS2307 diagnostics for missing Radix checkbox, collapsible, progress, separator, toggle-group and toggle packages. |
| `npx vite build --config playtest/vite.config.mjs --mode emulator` | **PASS:** 1,767 modules, 3.80 s Vite build; JS 1,107.04 kB / gzip 301.17 kB, chunk-size warning. Initial sandbox attempt hit Rollup EPERM; retry with normal filesystem access passed. |
| `node playtest/repros/bankrupt-current.cjs` | **FAIL:** `current player is not active`, `0 !== 1`. |
| Fresh emulator/browser full suite / 2,000-seed rerun / polish visual measurements | **NOT RUN in this review.** No new aggregate wall time or current browser pass count claimed. |

The isolated Vite config uses `playtest/env`, not `.env.local`. No production Firebase access, game-rule edits, commits, pushes or wiki edits occurred.

## Suggested work order

1. Correct harness selectors/scroll contract and reconcile report statuses with v1.1.16.
2. Verify joining, bail and Rematch on healthy emulators; settle bankruptcy grace-state and disconnect policy with focused tests.
3. Capture the required current 390/1440 visual audit; implement the presentation-only polish kit with 320/390/1440 previews and measured acceptance results.
4. Run the updated serial browser suite and 2,000 seeds; produce a versioned final pass/fail report and clear remaining gaps. Wire polish separately after the kit is reviewable.

## Wiki update for Claude Code

- Re-reviewed UI polish/playtest prompts against v1.1.16; polish kit remains unimplemented.
- Cards are integrated; earlier card/playtest integration notes are stale.
- Join/bail fixes and Rematch serialization mitigation require fresh emulator acceptance tests.
- Bankruptcy immediate invariant still fails; delayed survivor recovery now exists.
- Timer-off disconnect has host manual skip, not guaranteed automatic liveness.
- Harness sheet selectors and page-scroll contract need updating for the one-screen UI.
- Fresh offline suite: 26/26; isolated build passes; six existing Radix type errors remain.
- PlayerPanel rank approximation disagrees with actual-value standings; unify supplied ranks.
