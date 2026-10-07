# Codex audit prompt — Monopoly Madness Auction

Paste everything below the line into Codex, run from the repo root
(`N:\Code\git repositories\My Repo\monopoly-madness-auction`).

---

You are auditing a real-time multiplayer Monopoly variant (React + TypeScript + Vite; Firebase Firestore as the only
backend). **Read `arch.md` first** (state machine, data model, v1.1.5 section), then `src/gameEngine/core.ts`,
`src/hooks/useGameLogic.ts`, `src/types/game.ts`, then the components. The vault canvas
`monopoly-madness-architecture.canvas` has the one-page picture.

## Ground rules
- **Audit first, change second.** Produce a findings report, then fix only items marked *Fix now* below. Do not
  restyle, rename, or reorganise. Match the surrounding code's density and idiom.
- Do **not** write to the LLM Wiki vault. End with a short "wiki update" note instead (what you changed, decisions).
- Never commit secrets. Firebase config comes from `.env.local` (`VITE_FIREBASE_*`, gitignored). Don't run the app
  against the production Firebase project; reason from code or use the Firebase emulator if you set one up.
- Don't push. Leave changes uncommitted for the owner to review.
- Verify with `npx tsc -p tsconfig.app.json --noEmit` (pre-existing errors for missing `@radix-ui/*` packages in
  `src/components/ui/*` are known and unrelated) and `npx vite build`.

## Architecture facts you must respect
1. **Clients are the authority.** There is no server. Every mutation is `setGameState(updater)` which runs the
   updater inside `runTransaction` against the *live* document. Any code that decides using React closure state and
   then writes is a bug (stale state / race). v1.1.5 fixed the worst offenders; find the rest.
2. `core.ts` is pure. Money moves through `applyPayment` (the single bankruptcy path) or in-transaction arithmetic.
3. Ownership is keyed by **player name** (`property.owner`, `Auction.highestBidder`, `TradeOffer.fromPlayer`), not id.
4. `gamePhase`: `setup → auction (draft) → playing → ended`. Automation (turn timer, auto-advance, bots, jail
   dialog) is gated on `'playing'`. A phase without a driver is a deadlock — this was the v1.1.4 auction-mode bug.
5. Settings that change rules: `auctionsEnabled`, `tradingEnabled`, `mortgageEnabled`, `teamsEnabled`,
   `blindPickEnabled`, `workersEnabled`, `turnTimerDuration`, `singlePlayer` (Bot Noob), `preAuctionProperties`.

## Task 1 — correctness audit of every rule × every mode
Build a matrix: **rows** = {roll/move, buy, decline→auction, draft auction, rent, tax, GO, jail (enter/pay/serve),
Chance/Community, build/sell house, hotel, mortgage/unmortgage, trade create/accept/reject/cancel/expire, bankruptcy,
win, turn timer, reconnect, workers} and **columns** = {standard, auctions on, trading on, workers on, blind-pick,
teams, single-player vs bot, mortgage off, turn timer off, 2 players, 8 players}. For each cell either confirm it is
correct by pointing at the code (`file:line`) or file a finding. Pay special attention to **combinations** — the
reported bugs came from modded games (auction / trade), not the vanilla path.

Specifically trace and report on:
- **Turn ownership races:** every path that can call `advanceTurn` / `withFreshTimer` (timer expiry, 2 s auto-advance,
  bots, End Turn button, `purchaseProperty`, `resolveCard`, `resolveAuction`, `payRent`+auto-advance). Can any two
  fire for one turn? Can any skip a player or a required step (rent, card, purchase decision)?
- **Auction:** start conditions, bid validation, timer extension, bidder bankruptcy/disconnect mid-auction, seller
  proceeds, property mortgaged/traded while in auction, clock skew between clients (endTimestamp is a client clock),
  draft with 0 / 1 / many properties, draft when a bot or a disconnected host is involved.
- **Trading:** offers involving mortgaged properties, properties with buildings (they currently transfer with the
  buildings and no even-build re-check), a bankrupt party, offers made on someone else's turn, third-party "accept"
  (`acceptorName`), cash-only trades, simultaneous accepts, expiry.
- **Money conservation:** write a property-style check (random action sequences against `core.ts` + pure
  transitions) asserting total cash + (bank flows) is conserved and no active player ever has `balance < 0`.
- **Bankruptcy:** current player bankrupt mid-turn, bankrupt creditor, last two players, auction/trade in flight,
  workers, `winnerId` set exactly once, `status:'ended'` written.
- **Rent edge cases:** utility rent scale, railroad count, monopoly doubling vs mortgaged group members, owner in
  jail, owner bankrupt, landing on own property, mortgaged property of another player (purchase-at-mortgage path).
- **Tax / GO / cards:** rounding, GO bonus on the move that also lands on Go to Jail, Chance with 0 properties.

## Task 2 — missing or half-built features (report, rank, don't build unless marked)
- Doubles / extra roll / triple-double jail (`GameState.doubleCount` and `DiceRoll.isDouble` exist but are unused).
- Teams: `Team.sharedBalance` unused; win condition when all remaining players share a team; cross-teammate
  monopoly rent bonus (TeamPanel claims it).
- "Get out of jail free" (deleted dead code; decide: implement or drop from the rules text).
- Mortgage interest / forced liquidation before bankruptcy (sell buildings → mortgage → declare).
- Spectator mode after bankruptcy; rejoin as spectator.
- Free Parking pot, house/hotel supply limits (decide per variant rules, document in `RulesPanel`).
- Rematch / reset-room flow, and cleaning up ended rooms in Firestore.

## Task 3 — robustness & security
- Firestore: document growth (1 MiB cap — `gameEvents`, `tradeOffers`, `bids`), transaction contention with 8 players,
  `runTransaction(...).catch(console.error)` swallowing failures (surface to the UI), listener leaks, optimistic UI
  lag (`cardResolved` local flag pattern — find similar double-click hazards).
- Identity: reconnect-by-name allows impersonation; no per-player secret. Propose the smallest fix (stored token in
  localStorage + hashed in doc) without adding a backend.
- Firestore rules: current guidance is `allow read, write: if true`. Propose rules that at least restrict writes to
  the `games/{room}` shape and cap size, and say what cannot be enforced without a server.
- Timers: replace `Date.now()` authority with `serverTimestamp()`/offset estimation, or document the tolerance.
- Dead code & duplicate logic (e.g. `computeRent` exists in both core and the hook; `PreAuctionPanel.tsx` is unmounted;
  `makeOffer`, `handleSellProperty`, `handleTradeOffer` stubs). List what to delete vs wire up.

## Task 4 — tests
There is no test runner. Propose (and, if cheap, add) **Vitest** with:
1. `core.test.ts` — the scenarios in the v1.1.5 notes: unaffordable rent ⇒ bankruptcy and creditor gets only what
   existed; `advanceTurn` settles pending rent/card; hotel counts as level 5 for even build/sell; dice ignored
   outside `'playing'`; ended game doesn't advance.
2. Extract the hook's transaction updaters (`nextDraftStep`, auction resolve, trade accept) into pure functions in
   `core.ts` (or a sibling) so they are testable without React/Firebase, then test: draft with empty queue goes
   straight to play; unsold draft property isn't retried; auction winner who can't pay ⇒ unsold; stale trade is
   cancelled not applied; two sequential `placeBid`s with the lower arriving second is rejected.
3. A seeded fuzz test: random legal actions for N players, assert invariants after every step (no negative active
   balance, each property has ≤1 owner, `player.properties` agrees with `property.owner`, exactly one current player
   who is active, at most one live auction, `winnerId` ⇒ exactly one active player).

## Output format
1. **Findings table**: `id · severity (blocker/major/minor) · mode(s) · file:line · what breaks · repro in ≤3 steps ·
   proposed fix · Fix now? (y/n)`. Blockers/majors that are small and local are *Fix now*.
2. **Matrix** from Task 1 (compact; ✅ / ⚠ id / ❌ id).
3. **Feature gap ranking** with effort (S/M/L) and the rule decision the owner has to make.
4. The fixes you applied (diff summary), tests added, and the exact commands you ran with their results — report
   failures as failures.
5. A "wiki update" note: shipped / decisions / status change, ≤10 lines.
