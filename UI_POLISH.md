# Premium in-game polish kit

## Audit, before implementation

Ranking carried forward from `CLAUDE_UI_PLAYTEST_HANDOFF.md`, against v1.1.16. This is the requested source-based ranking; new populated before/after fixtures and measurements are documented below rather than presenting older screenshots as current evidence.

1. Board readability/ownership: phone names are about 5.44 px; ownership is a dot. Replace with readable codes, SVG treatments and owner flags.
2. Board centre: plain grid frame and competing actions need depth and a clear primary action.
3. Dice: rapidly spinning flat rectangles need pip faces, tumble/settle and doubles feedback.
4. Tokens: tiny discs need stronger rims, turn cues and predictable stacking for eight players.
5. Player panel: small cash/worth tiles and inconsistent rank calculations need caller-supplied values and hierarchy.
6. Turn/header: actor, phase and urgency should read as one clear banner.
7. Navigation: compact text and desktop 40 px minimums need readable labels and measured 44 px controls.
8. Decision stages/auctions: existing card integration works; frames and bid hierarchy can be more expressive.
9. Player/log rows: repetitive surfaces and small status chips need clearer two-line rows.
10. Money/end states: transaction notifications already exist; add balance-adjacent deltas and refine achievements/podiums.

The 40-tile phone board remains a compact map, with full accessible names and a readable selected-tile summary containing a 44 px detail button. Tiny map cells are an explicit exception to 44 px targets. All other interactive controls must meet that minimum. The first create/join lobby remains untouched.

## Installation and boundaries

Import `src/ui-kit/polish/tokens.css` after existing kit/card CSS. Import named exports from `src/ui-kit/polish/index.ts`. React and installed project dependencies only; no added package, image file, data URI, Firebase access, game subscription or game-rule calculation. All artwork is inline SVG or CSS gradients. The Singapore fixture reuses the existing current `CityArt` component.

This is a standalone presentation kit for Claude to wire into the live game. No existing source was edited. The sole existing-file edit is the explicitly allowed generated-preview ignore line in `.gitignore`. The initial lobby remains unchanged. New wrapper exports do not modify the old UI kit or architecture canvas.

`StageFrame` offers two mutually exclusive modes: its default modal owns focus/Escape/restore via the current `useBottomSheet`; `inline` supplies decoration inside the existing `ActionStage` and owns no dialog or focus trap. Never wrap a modal StageFrame around an ActionStage. Optional `onDismiss` is omitted for mandatory decisions. Neither path changes body overflow. Body content scrolls separately from the sticky footer. Caller renders only one decision owner and closes an inspect/sheet before opening another.

Motion uses transforms/opacity at 120/180/260/600 ms; ambient backdrop and badge pulses are deliberately slow. Numeric count-up interpolates visible text for 260 ms, keeps accessible values exact and does not change financial state. All animations/transitions are disabled by actual reduced-motion media; `CountUp` also cancels its animation-frame loop and snaps to the latest value. Confetti has twelve particles and ends after 600 ms. Effects never auto-dismiss decisions or schedule game actions. Caller controls event identity/visibility for deltas, outbid, hops and achievements. Stable keys prevent unrelated state updates replaying effects.

## Replacement and data mapping

| New component | Existing file/element to replace or decorate | Caller data / GameState fields |
|---|---|---|
| tokens.css | Additive theme after `src/ui-kit/tokens.css` | None; namespaced `mp-` rules |
| BoardTile | `MonopolyBoardLayout.tsx` tile/corner rendering | `properties[].name/type/colorGroup/currentValue/houses/hasHotel/isMortgaged/isInactive/isInAuction`; owner resolved from players by name; monopoly from engine; teams tint from resolved team; discovery from local player's discoveredProperties; orientation from position |
| BoardFrame | `MonopolyBoardLayout.tsx` outer square and centre backdrop | Children supplied by current board; no geometry/turn calculations |
| Dice | `CentralDisplay.tsx` DieFace pair/result | `lastDiceRoll.dice1/dice2/isDouble`, existing `isRolling`, authoritative can-roll reason and handleDiceRoll callback |
| Token / TokenStack | `MonopolyBoardLayout.tsx` AnimatedToken and local token grouping; bidder list | `players[].id/name/color/pieceIcon`, supplied position grouping, currentPlayer and existing visual movement phase |
| TurnBanner | `src/ui-kit/TurnStatus.tsx`; current header turn presentation | Actor resolved by `currentPlayer`, supplied local ownership, phase from turnState/pending decisions, existing caller clock seconds/duration |
| MoneyDelta | Beside balances in `PlayerPanel.tsx` and phone money strip | Caller-supplied signed transaction delta and stable event id, never reconstructed from arbitrary event amount |
| PlayerCard | `PlayerPanel.tsx` header/cash/worth/rank | `Player.balance`, caller-computed netWorth/rank, pieceIcon/color/name, jail/bot flags, presence-derived away and resolved team name; optional UI history |
| NavBar | `SideDock.tsx` BottomNav | Enabled panels from settings; local open/active state; incoming pending `tradeOffers` count and open callbacks |
| DockTabs | `MonopolyGame.tsx` desktop tab/Trade/Workers buttons | Same panel descriptor props; caller owns selection and panel rendering |
| StageFrame / StageHero / StageStat / StageActions | `ActionStage.tsx`, bodies selected by `StageHost.tsx` | Selected action kind, pendingRent/pendingPurchase/pendingCard and jailed actor; caller-computed amounts, authority/reasons and callbacks. StageHero can also decorate the in-room WaitingRoom, without changing first lobby |
| AuctionHall | `AuctionStatus.tsx` / `AuctionPanel.tsx` live auction area | `currentAuction.currentBid/highestBidder/bids`, supplied timer, caller-resolved unique bidders, legal quick bids/reasons; pass existing PropertyFace via card slot using `cardAdapters.ts` |
| ListRow / PlayerRow / LogRow / TradeRow | `SideDock.tsx` PlayersList/InlineLog; TradeSheet offer rows; WaitingRoom seats | Supplied labels/amounts from players, gameEvents, tradeOffers; caller-resolved identity and optional selection callback |
| Toast | `TransactionNotification.tsx` and existing toast rendering | Supplied event title/detail/tone; dismissal remains caller-owned |
| AchievementPop | `MonopolyGame.tsx` achievement feedback | Existing achievement title/description/unlock event identity; no achievement computation |
| GameOverStage | `GameOverCard.tsx` | `winnerId` resolved to player/team label; already ordered standings with caller-computed net worth/rank; authorized host Rematch and lobby callbacks |
| EmptyState / Skeleton | Empty/loading portfolio, log, trade, teams, workers panels | Caller owns loaded/empty state and any next-step callback; no loading network logic |

## Data/props needed

- One agreed rank/net-worth calculation must be supplied by the adapter, with explicit tie and bankrupt/spectator policy. This kit does not reproduce PlayerPanel's old approximate rank calculation.
- Net-worth history is optional caller UI data, not a new persisted field. When absent, PlayerCard says history is unavailable; it never invents a trend.
- Supply legal quick-bid amounts, spending permission, disabled/write-pending reasons, current rent and building/mortgage prices from engine/adapters. Components invoke callbacks only; adapters revalidate transactions.
- Supply exact countdown seconds/duration from the existing server-clock estimate. Ring never starts a clock. Supply stable unique bidder identities and display ordering.
- Owner flags use a readable initial on a dark background plus a decorative owner-colour stripe, so arbitrary player colours never become low-contrast text backgrounds. Colour is never the only ownership cue.
- Navigation is caller-filtered for enabled modes. At 320 px six items use two rows of three; at 390 px they fit one row. This preserves labelled 44 px controls without shrinking text. The board frame must receive the remaining viewport space from the host layout.
- Compact-map labels are at least 9 px; standalone tile labels at least 12 px. Full names and state are accessible on compact-map buttons, with a selected-tile summary and 44 px Details action. Blind pick must mask summary/inspect props too, not only the tile art.
- MoneyDelta amounts, achievements, movement phases and outbid identity need caller event keys to replay deliberately. Parent controls lifetime. Pending asynchronous actions should pass a disabled reason to prevent duplicate submission.
- StageFrame is not a replacement for game action-priority logic. `StageHost` remains responsible for actor authority and selecting one stage. No new rule, engine or Firebase change is part of this kit.

## Preview and verification commands

`node audit/ui-polish-preview.cjs --check` builds the current app using the isolated `playtest/vite.config.mjs --mode emulator`, generates 33 populated HTML pages and a browser bundle, starts its own loopback preview server, then checks 320/390/1440 with normal and actual reduced-motion media. It never reads `.env.local`. Tools use the already installed isolated Playwright/Edge path; `MONOPOLY_PLAYTEST_TOOLS` overrides it. No installation or package change occurs.

`node audit/ui-polish-preview.cjs --serve` generates a fresh isolated build and serves the gallery at `http://127.0.0.1:4190/index.html`. Generated files/screenshot/results are ignored under `audit/ui-polish-preview/`. `--check --serve` keeps the gallery running after checks.

Fixtures cover every exported component, eight identities, 40 perimeter tiles, all special tile kinds/orientations and state variants, six navigation items, long names, both dice phases, sparse/loading states, every modal accent, large money values and standings. `before-board` renders the **current** `MonopolyBoardLayout` / `CentralDisplay` with safe synthetic props and CSS from the fresh build; it does not use the stale old preview script or connect to a room. Fixture financial amounts and non-authoritative demonstration names are illustrative. Screenshots are before → after component comparisons, not screenshots of production gameplay.

Hardware FPS on a physical mid-range phone is not established by desktop browser layout tests. CSS gradients are reviewed visually; computed text-pair checks use the nearest opaque background and are a bounded contrast check rather than pixel sampling every gradient stop.

## Verification results — 8 October 2026

| Check | Result |
|---|---|
| Populated gallery | **33 HTML pages:** 11 scenes × 320/390/1440, every component represented |
| Browser matrix | **66 cases:** 60 polish + 6 current-board baseline cases, normal and real reduced-motion media; **0 polish failures**, **0 page errors** |
| Horizontal/page overflow | **PASS** across polish fixtures. All pages keep content scrolling inside the fixture body. Phone/desktop board stays within one viewport |
| Typography | **PASS:** no polish text below 12 px, except documented 9 px compact-map labels; token artwork is decorative and not a text label |
| Targets | **PASS:** at least 44 × 44 px for non-map controls; compact-map cell exception explicitly retained |
| Computed text contrast | **PASS:** 2,356 text/background pairs; minimum **8.12:1**, above 4.5:1. Decorative SVG/gradients and token artwork are excluded from text-pair counting |
| Reduced motion | **PASS:** animation checks include elements and their pseudo-elements; dice stop instantly, count-up snaps, confetti is disabled |
| Modal accents / scrolling / footer / Escape and focus return | **PASS: 18 cases**, six kinds × three widths. Exactly one dialog, real wheel scroll in overflowing bodies, action footer inside viewport and opener focus restored |
| Background page scrolling | **PASS:** actual wheel at 390 and 1440 on a deliberately overflowing background fixture while a decision is mounted; no body overflow mutation |
| Financial/callback checks | **PASS:** balance container stays at the same position/size when changing $120K → $123,456,789; exact accessible amount, bid callback and Roll Dice callback checked |
| Blind pick | **PASS:** hidden tile exposes no price/owner and selected summary says Undiscovered tile |
| Fresh isolated app build | **PASS:** current Vite app built through `playtest/vite.config.mjs --mode emulator` before previews; bundle-size warning remains. New preview bundle separately compiles the new kit with installed esbuild |
| TypeScript | **FAIL:** `npx tsc -p tsconfig.app.json --noEmit` reports exactly six existing TS2307 missing Radix packages: checkbox, collapsible, progress, separator, toggle-group, toggle. No polish diagnostics |
| Physical-phone FPS / live integration | **NOT VERIFIED / NOT WIRED:** presentation kit only. Largest measured polish fixture has 557 DOM nodes; board fixture renders 40 tiles. Eight-token movement fixture is provided, not a hardware performance certification |

The final browser/build run took **63.29 seconds** through result collection. Earlier verification caught a disabled-primary contrast failure (1.34:1); it was corrected and the matrix rerun. Visual inspection caught nonuniform intrinsic-width map buttons; map cells now fill their grid cells. The initial strict type check also caught incomplete synthetic Property fixtures, corrected before final checks. No failures were hidden by modifying existing game code or excluding failing polish components. Baseline pages are recorded separately because old live-board typography/targets are the before state, not polish acceptance results.

Raw generated evidence: `audit/ui-polish-preview/checks.json` and `isolated-build.log`. Preview source and the harness are new files; the build and screenshots are generated/ignored. The harness uses installed Edge and isolated Playwright, not production Firebase. A default root-env Vite build was deliberately replaced with the equivalent isolated build to preserve the playtest environment boundary.

## Screenshots

Current-board baseline at 390 (current components inside the new fixture shell):

![Current board before polish](audit/ui-polish-preview/before-board-390.png)

Polish board at 390; all eight tokens, full-name summary and labelled navigation:

![Polish board at 390](audit/ui-polish-preview/fresh-board-390.png)

Desktop board/dock and live-auction component:

![Polish board at 1440](audit/ui-polish-preview/board-1440.png)
![Auction with existing Singapore city art](audit/ui-polish-preview/auction-390.png)

Scrollable jail decision with reachable footer:

![Jail stage](audit/ui-polish-preview/stage-jail-390.png)

Baseline and after images were inspected directly. The ten-item ranking remains the requested handoff ranking; this fixture comparison supports the board/centre/dice/token priorities. It is not a full production-room visual audit or an assertion that the new components have been wired into gameplay.

## Deliverable manifest

All fourteen requested groups are implemented: (1) tokens.css; (2) BoardTile; (3) BoardFrame; (4) Dice; (5) Token/TokenStack; (6) TurnBanner/MoneyDelta; (7) PlayerCard; (8) NavBar/DockTabs; (9) StageFrame/StageHero/StageStat/StageActions; (10) AuctionHall; (11) ListRow/PlayerRow/LogRow/TradeRow; (12) Toast/AchievementPop; (13) GameOverStage; (14) EmptyState/Skeleton. Each implementation component has its own file; named row variants share the explicitly requested ListRow family. Shared contracts/SVG helpers, exports and populated fixtures live in shared.tsx, index.ts and preview.tsx.


## Exact exported contracts

Extracted from the new TypeScript declarations, including JSDoc. `DockTabs` consumes `NavBarProps`; ListRow family aliases consume `ListRowProps`. Shared `Identity`, `Action` and `GlyphName` contracts are included.

### AchievementPop.tsx

```ts
export interface AchievementPopProps {
    title: string; /** Caller-supplied explanation. */
    detail: string;
}
```

### AuctionHall.tsx

```ts
export interface AuctionHallProps {
    /** Existing property card face, not another inspect dialog. */ card: ReactNode;
    /** Exact current bid. */ currentBid: number;
    /** Caller-resolved leader. */ leader?: string;
    /** Caller-owned remaining seconds. */ seconds: number;
    /** Caller-owned effective duration. */ totalSeconds: number;
    /** Stable unique bidder identities. */ bidders: Identity[];
    /** Whether local player was outbid; replay with a new key for a new event. */ outbid?: boolean;
    /** Exact legal bid labels/callbacks; component never adds a bid increment. */ bids: Action[];
}
```

### BoardFrame.tsx

```ts
export interface BoardFrameProps {
    /** Caller-owned tile grid and centre content. */ children: ReactNode;
    /** Accessible board label. */ label?: string;
    /** Disable the subtle backdrop animation. */ ambient?: boolean;
}
```

### BoardTile.tsx

```ts
export interface BoardTileProps {
    /** Full name, also used in the accessible tap summary. */ name: string;
    /** Short phone map code, never an unexplained accessible name. */ code: string;
    /** Distinct inline SVG treatment. */ kind?: Extract<GlyphName, 'city' | 'go' | 'jail' | 'parking' | 'go-jail' | 'chance' | 'chest' | 'tax' | 'railroad' | 'utility'>;
    /** Caller-formatted price; not computed by the tile. */ price?: string;
    /** Group band colour, decorative. */ groupColor?: string;
    /** Owner identity; flag uses initial plus colour. */ owner?: Identity;
    /** Existing building counts. */ houses?: number;
    /** Existing hotel flag. */ hotel?: boolean;
    /** Mortgage state. */ mortgaged?: boolean;
    /** Bankrupt/neutral state. */ neutral?: boolean;
    /** Live auction highlight. */ auction?: boolean;
    /** Caller-computed monopoly eligibility. */ monopoly?: boolean;
    /** Team tint, decorative only. */ teamColor?: string;
    /** Masks all property/owner/price information. */ hidden?: boolean;
    /** Edge orientation supplied by board geometry. */ orientation?: 'bottom' | 'left' | 'top' | 'right';
    /** Compact map or roomy standalone tile. */ size?: 'map' | 'detail';
    /** Selected state from board owner. */ selected?: boolean;
    /** Opens a caller-owned readable summary. Map cells are the documented target-size exception. */ onSelect?: () => void;
}
```

### Dice.tsx

```ts
export interface DiceProps {
    /** Actual engine result, never randomly generated by presentation. */ values: readonly [
        number,
        number
    ];
    /** Caller controls rolling phase. */ rolling?: boolean;
    /** Caller supplies doubles state. */ doubles?: boolean;
    /** Optional authorized roll action. */ onRoll?: () => void;
    /** Reason the roll cannot currently run. */ disabledReason?: string;
}
```

### EmptyState.tsx

```ts
export interface EmptyStateProps {
    title: string; /** Useful next-step explanation. */
    detail: string; /** Contextual SVG. */
    icon?: GlyphName; /** Optional authorized next step. */
    action?: Action;
}
```

### GameOverStage.tsx

```ts
export interface Standing {
    player: Identity; /** Exact caller-computed rank. */
    rank: number; /** Exact caller-computed worth. */
    netWorth: number;
}
export interface GameOverStageProps {
    /** Caller-resolved winner or representative token. */ winner: Identity;
    /** Winner/team display label. */ winnerLabel: string;
    /** Already ordered caller-computed standings. */ standings: Standing[];
    /** Back/rematch actions with caller authority. */ actions: Action[];
}
```

### ListRow.tsx

```ts
export interface ListRowProps {
    /** Primary text. */ title: string;
    /** Secondary explanation. */ detail: string;
    /** Optional player avatar. */ player?: Identity;
    /** Optional event icon. */ icon?: GlyphName;
    /** Caller-formatted amount/status. */ trailing?: ReactNode;
    /** Optional full-row selection callback. */ onSelect?: () => void;
}
```

### MoneyDelta.tsx

```ts
export interface MoneyDeltaProps {
    /** Signed amount supplied by caller; not inferred from events. */ amount: number;
    /** Caller-owned visibility; remount with a stable transaction key to replay motion. */ visible?: boolean;
}
```

### NavBar.tsx

```ts
export interface NavItem {
    /** Stable panel id. */ id: string;
    /** Readable label. */ label: string;
    /** SVG icon. */ icon: GlyphName;
    /** Caller-controlled active state. */ active?: boolean;
    /** Caller-supplied pending count. */ badge?: number;
    /** Open/select panel callback. */ onClick: () => void;
}
export interface NavBarProps {
    items: NavItem[];
}
```

### PlayerCard.tsx

```ts
export interface PlayerCardProps {
    /** Player identity. */ player: Identity;
    /** Exact current cash. */ cash: number;
    /** Exact caller-computed net worth; never computed in this component. */ netWorth: number;
    /** Caller-computed rank including tie policy. */ rank: number;
    /** Optional caller-owned history, never synthesized. */ history?: number[];
    /** Caller-resolved jail/away/bot/team labels. */ statuses?: string[];
}
```

### shared.tsx

```ts
export interface Identity {
    /** Stable seat id. */ id: string;
    /** Public display name. */ name: string;
    /** Caller-supplied CSS colour; decorative only. */ color: string;
    /** Player token, the only place emoji are allowed. */ token?: ReactNode;
}
export interface Action {
    /** Unique UI action id. */ id: string;
    /** Complete label, including caller-computed prices. */ label: string;
    /** Authorized caller callback. */ onClick: () => void;
    /** Visible rule or write-pending reason. */ disabledReason?: string;
    /** Primary visual emphasis. */ primary?: boolean;
}
export type GlyphName = 'city' | 'go' | 'jail' | 'parking' | 'go-jail' | 'chance' | 'chest' | 'tax' | 'railroad' | 'utility' | 'house' | 'hotel' | 'players' | 'log' | 'trade' | 'teams' | 'workers' | 'trophy' | 'close';
```

### Skeleton.tsx

```ts
export interface SkeletonProps {
    rows?: number; /** Accessible loading description. */
    label?: string;
}
```

### StageActions.tsx

```ts
export interface StageActionsProps {
    actions: Action[];
}
```

### StageFrame.tsx

```ts
export interface StageFrameProps {
    /** Kind-specific frame accent. */ kind: 'rent' | 'card' | 'purchase' | 'jail' | 'auction' | 'own-property';
    /** Accessible decision title. */ title: string;
    /** Optional explanation. */ subtitle?: string;
    /** Scrollable body, never a nested modal. */ children: ReactNode;
    /** Sticky actions supplied by caller. */ footer: ReactNode;
    /** Optional Escape/close action; omit for mandatory decisions. */ onDismiss?: () => void;
    /** Inline decoration inside an existing ActionStage; avoids a second dialog/focus owner. */ inline?: boolean;
}
```

### StageHero.tsx

```ts
export interface StageHeroProps {
    /** Kind icon. */ icon: GlyphName;
    /** Main readable title. */ title: string;
    /** Description or rule explanation. */ children?: ReactNode;
}
```

### StageStat.tsx

```ts
export interface StageStatProps {
    label: string; /** Exact caller-owned value. */
    value: ReactNode; /** Optional contextual help. */
    detail?: string;
}
```

### Toast.tsx

```ts
export interface ToastProps {
    /** Message title. */ title: string;
    /** Supporting explanation. */ detail?: string;
    /** Semantic visual accent. */ tone?: 'info' | 'gain' | 'loss';
    /** Original SVG treatment. */ icon?: GlyphName;
    /** Optional caller-owned dismissal; no automatic timers. */ onDismiss?: () => void;
}
```

### Token.tsx

```ts
export interface TokenProps {
    /** Public seat identity. */ player: Identity;
    /** Caller-owned turn indicator. */ active?: boolean;
    /** Caller-owned movement phase; replay with a new key for each hop. */ moving?: boolean;
    /** Pixel diameter. Map tokens may be small; noninteractive. */ size?: number;
}
```

### TokenStack.tsx

```ts
export interface TokenStackProps {
    /** Up to eight identities, in stable caller-owned order. */ players: Identity[];
    /** Active seat id. */ activeId?: string;
    /** Compact board placement or bidder/avatar stack. */ compact?: boolean;
    /** Caller-owned currently hopping seat ids; at most eight tokens render. */ movingIds?: string[];
}
```

### TurnBanner.tsx

```ts
export interface TurnBannerProps {
    /** Current actor. */ player: Identity;
    /** Local turn ownership. */ isMine?: boolean;
    /** Authoritative readable phase. */ phase: string;
    /** Optional caller-owned countdown. */ seconds?: number;
    /** Effective caller-owned timer duration. */ totalSeconds?: number;
}
```

## Wiki update for Claude Code

- Built all fourteen presentation-only polish groups under `src/ui-kit/polish/`; live wiring remains separate.
- Added responsive populated preview harness and exact prop/replacement mappings in `UI_POLISH.md`.
- 60 polish browser cases and 18 modal checks pass; six baseline cases recorded separately.
- Fresh isolated app build passes; TypeScript retains six existing missing Radix-package errors.
- Compact phone map uses 9 px codes plus readable summary/44 px details; non-map controls meet 44 px.
- Rank/net worth, legal prices/bids/timers and history stay caller-owned; no game/Firebase/lobby edits.
- No commits, pushes or wiki-file edits occurred.
