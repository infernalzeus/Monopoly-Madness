# Monopoly Madness Auction UI kit

Separate presentation kit for Claude to integrate after v1.1.8. No existing source, dependencies, rules, hooks or engine files were edited. React 18, TypeScript and installed lucide-react only. Import `src/ui-kit/tokens.css` once and named components from `src/ui-kit/index.ts`. The optional Tailwind theme snippet requires no Tailwind configuration change until integration.

## Integration contract

Props contain display data and callbacks. The game adapter remains authoritative for actor permissions, money, rent, bids, write state and all transitions. The kit does not subscribe to Firebase, run game timers or access game state. Helpers use effects only for focus, media queries and reduced motion. Render one ActionStage and at most one modal sheet at a time; close the sheet before mounting a stage. Do not nest dialogs. Mandatory decisions omit onDismiss. Body/actions are separate so the stage footer stays reachable.

For mobile map cells, keep every interactive cell at least 44px. An 11-cell Monopoly edge cannot fit at 320px at that size: integration must choose a responsive overview/list or a noninteractive board overview with separate accessible 44px navigation and selected-tile details. The fixture uses a responsive four-column map. Do not shrink an entire interactive 11×11 board to claim compliance.

## Data/props needed

- Original draft queue count/index: not recorded in GameState; do not infer total from a shrinking settings.preAuctionProperties array. Omit draftIndex/draftTotal until tracked by caller.
- Actor/action disabled reasons, quickBids/minIncrement, write pending/error, calculated rent/netWorth/rank, and final standings: existing adapter calculations or extra UI state, not new GameState fields. Revalidate all writes atomically.
- Away presence, local seat ID, host permission, stable numeric markers, selected tile, panel open state, controlled jail method/trade draft, clipboard success and presentation portfolio order: existing session/UI context, not Player fields.
- Trade age: TradeOffer has expiresAt but no createdAt. Show expiry (implemented); omit ageLabel unless timestamp provenance exists.
- Rematch: no canRematch field or guaranteed transition. Omit the capability until implemented.

## CurrencyAmount

Existing UI: `src/components/game/PropertyCard.tsx, PlayerPanel.tsx and monetary labels across game components`.

amount ← Player.balance, Property.currentValue, pendingRent.amount, pendingCard.amount, currentAuction.currentBid, or GameEvent.amount. signed/compact/tone are display choices; pending card sign comes from pendingCard.isReward.

Exact exported prop/data types (JSDoc retained):

```ts
export interface CurrencyAmountProps {
  /** Exact dollar value; finite numbers only. */ amount: number;
  /** Display + for positive values; losses always retain a true minus sign. */ signed?: boolean;
  /** Compact K/M/B display; exact value remains accessible. */ compact?: boolean;
  /** Semantic colour; signed gains/losses determine their own tone. */ tone?: Tone;
}
```

## PlayerIdentity

Existing UI: `src/components/game/PlayerPanel.tsx, GameOverview.tsx, LobbySystem.tsx and MonopolyBoardLayout.tsx player rows`.

name/color/icon/isBot ← Player.name/color/pieceIcon/isBot. isYou ← compare Player.id with the local seat ID. isBankrupt ← !Player.isActive after elimination (exclude spectators/setup). teamName ← teams matched by Player.teamId. marker ← stable seat number; size is layout.

Exact exported prop/data types (JSDoc retained):

```ts
export interface PlayerIdentityProps {
  /** Display name (never interpreted as HTML). */ name: string;
  /** Player identity stripe, #RGB or #RRGGBB. */ color: string;
  /** Plain-text emoji player token. */ icon?: string;
  /** Labels reflecting existing player/presence state. */ isYou?: boolean;
  /** Bot label. */ isBot?: boolean;
  /** Disconnected/away label supplied by the caller. */ isAway?: boolean;
  /** Eliminated label. */ isBankrupt?: boolean;
  /** Optional resolved team name. */ teamName?: string;
  /** Layout density; never reduces text below 14px. */ size?: 'sm' | 'md' | 'lg';
  /** Unique seat number or letter marker; defaults to initial. Supply 1–8 to distinguish same-initial players. */ marker?: string | number;
}
```

## TurnStatus

Existing UI: `src/components/game/CentralDisplay.tsx and MonopolyGame.tsx turn header`.

actorName ← currentPlayer (a player name). isMine ← currentPlayer matches local Player.name. secondsLeft ← caller clock using turnEndTime; totalSeconds ← settings.turnTimerDuration. phase ← caller label for turnState/gamePhase.

Exact exported prop/data types (JSDoc retained):

```ts
export interface TurnStatusProps {
  /** Resolved current player's name. */ actorName: string;
  /** Whether this client owns the turn. */ isMine: boolean;
  /** Caller-owned seconds; absent means no countdown. */ secondsLeft?: number;
  /** Effective total seconds for timer display. */ totalSeconds?: number;
  /** Human-readable phase label, supplied by the adapter. */ phase: string;
}
```

## ActionStage

Existing UI: `src/components/game/CentralDisplay.tsx action branches and RentPaymentDialog.tsx overlay`.

kind/title/subtitle/children/footer ← one caller-selected branch using pendingRent, pendingCard, pendingPurchase, currentAuction, current player isInJail and turnState. onDismiss only when rules allow closing; mandatory actions omit it.

Exact exported prop/data types (JSDoc retained):

```ts
export interface ActionStageProps {
  /** Priority-selected action. Caller renders exactly one stage at a time. */ kind: 'jail' | 'card' | 'rent' | 'purchase' | 'auction' | 'own-property';
  /** Accessible panel title. */ title: string;
  /** Optional contextual explanation. */ subtitle?: string;
  /** Scrollable content; not another modal. */ children: ReactNode;
  /** Sticky primary/secondary action row. */ footer: ReactNode;
  /** Optional close/Escape action. Omit for mandatory decisions. */ onDismiss?: () => void;
}
```

## AuctionStatus

Existing UI: `src/components/game/AuctionPanel.tsx and CentralDisplay.tsx auction view`.

propertyName ← properties matched by currentAuction.propertyId. currentBid/highestBidder/totalSeconds ← currentAuction.currentBid/highestBidder/duration (adapter must include extensions). secondsLeft ← currentAuction.endTimestamp and caller clock. you/balance ← local Player.name/balance. isSeller ← currentAuction.startedBy === local Player.name. isDraft ← preAuctionPhase/gamePhase. hasBid ← currentAuction.bids.some(b => b.player === local Player.name).

Exact exported prop/data types (JSDoc retained):

```ts
export interface AuctionStatusProps {
  /** Property being auctioned. */ propertyName: string;
  /** Live highest/start bid. */ currentBid: number;
  /** Current leading name, null before any bid. */ highestBidder: string | null;
  /** Local player's name. */ you: string;
  /** Caller-owned remaining time. */ secondsLeft: number;
  /** Effective timer duration; caller updates for extensions. */ totalSeconds: number;
  /** Legal next increment supplied by game adapter. */ minIncrement: number;
  /** Absolute legal bid amounts, not increments. */ quickBids: number[];
  /** Submit immediately; caller validates atomically. */ onBid: (amount: number) => void;
  /** Local cash available. */ balance: number;
  /** Seller cannot bid. */ isSeller: boolean;
  /** Pre-game draft indicator. */ isDraft?: boolean;
  /** One-based draft progress if known. */ draftIndex?: number;
  /** Original queue count if known. */ draftTotal?: number;
  /** Whether local player previously bid in this auction; derive from bids. */ hasBid?: boolean;
  /** Optional actor/rule/write blocking reason from caller. */ disabledReason?: string;
}
```

## PropertyTile

Existing UI: `src/components/game/MonopolyBoardLayout.tsx board cells; GameBoard.tsx alternate cells`.

name/price/colorGroup/houses/hasHotel/isMortgaged/isInactive/isInAuction ← Property.name/currentValue/colorGroup/houses/hasHotel/isMortgaged/isInactive/isInAuction. ownerName ← Property.owner; ownerColor ← matching Player.color. tokens ← players at Property.position; token name/icon/marker ← Player.name/pieceIcon/stable seat index. teamName ← owner Player.teamId resolved via teams. isHidden ← settings.blindPickEnabled and local Player.discoveredProperties (positions). size/selected/onSelect are caller-owned presentation.

Exact exported prop/data types (JSDoc retained):

```ts
export interface TileToken {
  /** Name for the tile's accessible token list. */ name: string;
  /** Plain-text player token. */ icon?: string;
  /** Distinct seat marker. */ marker?: string | number;
}

export interface PropertyTileProps {
  /** Global Edition property name. */ name: string;
  /** Current market price. */ price: number;
  /** Named group or #RGB/#RRGGBB colour. */ colorGroup?: string;
  /** Owner identity colour. */ ownerColor?: string;
  /** Owner name; omitted for unowned. */ ownerName?: string;
  /** Number of houses shown, supplied by engine. */ houses?: number;
  /** Hotel flag. */ hasHotel?: boolean;
  /** Mortgage flag. */ isMortgaged?: boolean;
  /** Neutral bankrupt property flag. */ isInactive?: boolean;
  /** Live auction flag. */ isInAuction?: boolean;
  /** Resolved team name, if applicable. */ teamName?: string;
  /** Tokens currently occupying tile. */ tokens?: TileToken[];
  /** Phone overview or desktop detailed tile. */ size?: 'map' | 'full';
  /** Open the selected-tile summary. */ onSelect?: () => void;
  /** Whether this tile is selected. */ selected?: boolean;
  /** Optional blind-pick mask. */ isHidden?: boolean;
}
```

## SelectedTileSummary

Existing UI: `src/components/game/MonopolyBoardLayout.tsx phone selected-property detail; PropertyCard.tsx compact summary`.

name/price/ownerName/isMortgaged/isInactive ← selected Property.name/currentValue/owner/isMortgaged/isInactive. rent/rentLabel ← existing rent calculation output, never raw Property.rent[0] for all property types. onDetails opens the caller detail view.

Exact exported prop/data types (JSDoc retained):

```ts
export interface SelectedTileSummaryProps {
  /** Selected tile name. */ name: string;
  /** Current market value. */ price: number;
  /** Current payable rent if known. */ rent?: number;
  /** Resolved owner. */ ownerName?: string;
  /** Mortgage label. */ isMortgaged?: boolean;
  /** Neutral inactive label. */ isInactive?: boolean;
  /** Optional caller-computed income/utility description. */ rentLabel?: string;
  /** Open accessible full details. */ onDetails?: () => void;
}
```

## RentDialogBody

Existing UI: `src/components/game/RentPaymentDialog.tsx and CentralDisplay.tsx rent body`.

propertyName ← properties matched by pendingRent.propertyId; owner/amount ← pendingRent.owner/amount; balance ← current actor Player.balance. onPay binds the existing payRent/declaration transition. onManageAssets opens the portfolio. actionsInBody=false with RentDialogActions in ActionStage.footer.

Exact exported prop/data types (JSDoc retained):

```ts
export interface RentDialogBodyProps {
  /** Landed property's name. */ propertyName: string;
  /** Creditor name from pendingRent.owner. */ owner: string;
  /** Exact debt; caller calculates rent. */ amount: number;
  /** Current payer cash. */ balance: number;
  /** Owner's pay/declaration transition callback. */ onPay: () => void;
  /** Optional open-portfolio action, not skip rent. */ onManageAssets?: () => void;
  /** Caller-supplied primary block reason. */ disabledReason?: string;
  /** Put actions in the body for standalone use; false when using sticky stage footer. */ actionsInBody?: boolean;
}
```

## JailDialogBody

Existing UI: `src/components/game/CentralDisplay.tsx jail branch`.

turnsRemaining ← current Player.jailTurns; jailCards ← Player.jailCards ?? 0; balance ← Player.balance. fine ← existing getJailFineAmount().fine output (income-based bail, not settings.jailFine). method/onMethodChange are controlled UI selection; onPay/onStay/onUseCard bind authorized existing transitions. actionsInBody=false plus JailDialogActions in the footer.

Exact exported prop/data types (JSDoc retained):

```ts
export interface JailDialogBodyProps {
  /** Jail turns left. */ turnsRemaining: number;
  /** Bail amount, already computed by caller. */ fine: number;
  /** Current available cash. */ balance: number;
  /** Number of Get Out of Jail Free cards held. */ jailCards?: number;
  /** Controlled release selection; does not perform release. */ method?: 'pay' | 'card';
  /** Controlled presentation selection callback. */ onMethodChange?: (method: 'pay' | 'card') => void;
  /** Pay fine transition. */ onPay: () => void;
  /** Serve a turn transition. */ onStay: () => void;
  /** Spend held jail card transition. */ onUseCard?: () => void;
  /** Owner-supplied rule/write block. */ disabledReason?: string;
  /** Set false when rendering JailDialogActions in stage footer. */ actionsInBody?: boolean;
}
```

## CardDialogBody

Existing UI: `src/components/game/CentralDisplay.tsx pending card branch`.

type/amount/isReward/diceRoll/income/numProperties/jailCard ← pendingCard fields with the same names. onResolve binds existing resolution. onDetails opens the calculation. actionsInBody=false plus CardDialogActions in the footer.

Exact exported prop/data types (JSDoc retained):

```ts
export interface CardDialogBodyProps {
  /** Card heading. */ type: 'chance' | 'community';
  /** Positive magnitude from PendingCard.amount. */ amount: number;
  /** Reward flag supplied by engine. */ isReward: boolean;
  /** Dice total that caused this card. */ diceRoll: number;
  /** Caller-computed rental income. */ income: number;
  /** Number of income-producing properties. */ numProperties: number;
  /** Doubles also award a jail card. */ jailCard?: boolean;
  /** Resolve once through the game adapter. */ onResolve: () => void;
  /** Optional view-calculation callback. */ onDetails?: () => void;
  /** Owner-supplied pending/error block. */ disabledReason?: string;
  /** False when actions are placed in stage footer. */ actionsInBody?: boolean;
}
```

## PurchaseDialogBody

Existing UI: `src/components/game/CentralDisplay.tsx purchase branch and PropertyCard.tsx purchase controls`.

propertyName/price ← properties matched by pendingPurchase.propertyId, Property.name/currentValue; balance ← pendingPurchase.playerId matched Player.balance. sellerName is only supplied for an actual seller flow. onBuy/onDecline/declineLabel bind the existing mode-specific decisions; actionsInBody=false plus PurchaseDialogActions in the footer.

Exact exported prop/data types (JSDoc retained):

```ts
export interface PurchaseDialogBodyProps {
  /** Property offered to the current actor. */ propertyName: string;
  /** Actual purchase price computed by caller. */ price: number;
  /** Buyer's current cash. */ balance: number;
  /** Buy transition. */ onBuy: () => void;
  /** Decline/auction decision owned by caller. */ onDecline: () => void;
  /** Honest secondary label (Pass or Start auction); kit does not choose the rule. */ declineLabel?: string;
  /** Rule/actor/write block from caller. */ disabledReason?: string;
  /** Optional mortgage-sale seller name. */ sellerName?: string;
  /** False when actions are in stage footer. */ actionsInBody?: boolean;
}
```

## PlayerSheet

Existing UI: `src/components/game/PlayerPanel.tsx`.

player ← PlayerIdentity mapping. balance ← Player.balance; properties ← Player.properties IDs resolved through properties. PortfolioProperty.id/name/group/value/isMortgaged/isInactive ← Property.id/name/colorGroup/currentValue/isMortgaged/isInactive. rent/rentLabel/netWorth/rank/actionLabel/disabledReason use existing caller calculations. onReorder updates a controlled presentation order; it must not reorder game state accidentally.

Exact exported prop/data types (JSDoc retained):

```ts
export interface PortfolioProperty {
  /** Property id returned to callbacks. */ id: string;
  /** Property label. */ name: string;
  /** Group name for presentation. */ group?: string;
  /** Current value. */ value: number;
  /** Payable current rent, computed by caller. */ rent?: number;
  /** Dice-based/other rent description if needed. */ rentLabel?: string;
  /** Mortgage state. */ isMortgaged?: boolean;
  /** Neutral tile state. */ isInactive?: boolean;
  /** Correct legal action label including price. */ actionLabel?: string;
  /** Caller-provided eligibility reason. */ disabledReason?: string;
}

export interface PlayerSheetProps {
  /** Player presentation data. */ player: PlayerIdentityProps;
  /** Cash balance. */ balance: number;
  /** Correct net worth/rank from caller. */ netWorth: number;
  /** Optional rank. */ rank?: number;
  /** Ordered portfolio rows. */ properties: PortfolioProperty[];
  /** Caller-approved property action. */ onPropertyAction?: (id: string) => void;
  /** Optional controlled order change; keyboard-operable alternative to dragging. */ onReorder?: (ids: string[]) => void;
  /** Controlled visibility. */ open?: boolean;
  /** Close sheet. */ onClose?: () => void;
}
```

## TradeSheet

Existing UI: `src/components/game/TradingSystem.tsx`.

you/recipients ← local Player.name and eligible players[].name. choices ← ownership-resolved properties[].id/name; lock reasons from existing building/ownership rules. offers ← tradeOffers filtered by status === pending; id/fromPlayer/toPlayer/offeredCash/requestedCash/expiresAt map directly; offeredNames/requestedNames resolve offeredProperties/requestedProperties IDs. now supplied by caller clock. draft fields map to the same trade fields on submission; cash remains strings until caller validates it. Permissions and callbacks remain in the adapter.

Exact exported prop/data types (JSDoc retained):

```ts
export interface TradePropertyChoice {
  /** Actual property id. */ id: string;
  /** Property name. */ name: string;
  /** Explicit caller-derived built-group/ownership lock reason. */ lockedReason?: string;
}

export interface TradeDraft {
  /** Recipient player name. */ toPlayer: string;
  /** Selected property ids on each side. */ offeredProperties: string[];
  /** Requested ids. */ requestedProperties: string[];
  /** Controlled cash inputs; empty input remains empty. */ offeredCash: string;
  /** Requested cash input. */ requestedCash: string;
}

export interface TradePreviewOffer {
  /** Actual offer id. */ id: string;
  /** From player name. */ fromPlayer: string;
  /** Recipient player name. */ toPlayer: string;
  /** Display property names, resolved by caller. */ offeredNames: string[];
  /** Requested names. */ requestedNames: string[];
  /** Cash on each side. */ offeredCash: number;
  /** Requested cash. */ requestedCash: number;
  /** Exact expiry timestamp. */ expiresAt: number;
  /** Derived age label if available; TradeOffer has no createdAt field. */ ageLabel?: string;
  /** Authorized controls supplied by caller. */ canAccept?: boolean;
  /** Can reject as recipient. */ canReject?: boolean;
  /** Can withdraw as sender. */ canCancel?: boolean;
  /** Explicit blocked reason. */ disabledReason?: string;
}

export interface TradeSheetProps {
  /** Actor name. */ you: string;
  /** Eligible recipient names. */ recipients: string[];
  /** Controlled offer form. */ draft: TradeDraft;
  /** Controlled form updates; never commits a trade. */ onDraftChange: (draft: TradeDraft) => void;
  /** Available properties for each side, including visible locked rows. */ offeredChoices: TradePropertyChoice[];
  /** Recipient's choices. */ requestedChoices: TradePropertyChoice[];
  /** Populated pending offer cards. */ offers: TradePreviewOffer[];
  /** Owner's current time; no timer/global clock in this component. */ now: number;
  /** Submit controlled draft. */ onSubmit: () => void;
  /** Optional game transitions. */ onAccept?: (id: string) => void;
  /** Reject transition. */ onReject?: (id: string) => void;
  /** Withdraw transition. */ onCancel?: (id: string) => void;
  /** In-flight write state. */ pending?: boolean;
  /** User-visible write error. */ error?: string;
  /** Caller-computed create eligibility reason. */ submitDisabledReason?: string;
  /** Controlled visibility. */ open?: boolean;
  /** Close callback. */ onClose?: () => void;
}
```

## LogSheet

Existing UI: `src/components/game/GameLog.tsx`.

entries ← gameEvents. id/player/message/amount/type map directly from GameEvent; timeLabel derives GameEvent.timestamp with caller clock. Preserve the event amount sign; do not guess a sign from type.

Exact exported prop/data types (JSDoc retained):

```ts
export interface LogEntry {
  /** GameEvent id. */ id: string;
  /** GameEvent.player. */ player: string;
  /** GameEvent.message. */ message: string;
  /** Signed GameEvent.amount. */ amount?: number;
  /** Display time derived from GameEvent.timestamp. */ timeLabel: string;
  /** GameEvent.type presentation label. */ type: string;
}

export interface LogSheetProps {
  /** Caller-ordered recent events (newest first recommended). */ entries: LogEntry[];
  /** Controlled visibility. */ open?: boolean;
  /** Close sheet. */ onClose?: () => void;
}
```

## TeamsSheet

Existing UI: `src/components/game/TeamPanel.tsx`.

teams[].id/name ← Team.id/name; members resolve Team.members using Player.id; combinedCash sums matched Player.balance. yourTeamId ← local Player.teamId. Team.sharedBalance is not presented as a shared bank. Join/create eligibility and callbacks are caller-owned.

Exact exported prop/data types (JSDoc retained):

```ts
export interface TeamSummary {
  /** Team.id. */ id: string;
  /** Team.name. */ name: string;
  /** Resolved member identities. */ members: PlayerIdentityProps[];
  /** Sum of balances, not a fictitious shared bank. */ combinedCash: number;
  /** Caller-authorized join availability. */ canJoin?: boolean;
  /** Rule/consent reason if join blocked. */ disabledReason?: string;
}

export interface TeamsSheetProps {
  /** Teams with resolved members. */ teams: TeamSummary[];
  /** Current team id if assigned. */ yourTeamId?: string;
  /** Join transition. */ onJoin?: (id: string) => void;
  /** Open caller-owned creation flow. */ onCreate?: () => void;
  /** Controlled visibility. */ open?: boolean;
  /** Close sheet. */ onClose?: () => void;
}
```

## WorkersSheet

Existing UI: `src/components/game/MonopolyGame.tsx workers nudge/list and PlayerPanel.tsx worker controls`.

assignments[].propertyId/propertyName ← Property.id/name for local eligible portfolio. assigned/color ← workers matched by Worker.ownerId (player ID) and Worker.propertyId. onAssign/onRemove/onColorChange bind existing authorized worker actions. Do not automatically assign from the kit.

Exact exported prop/data types (JSDoc retained):

```ts
export interface WorkerAssignment {
  /** Property id. */ propertyId: string;
  /** Property name. */ propertyName: string;
  /** Caller-selected worker colour. */ color: string;
  /** Existing assignment flag. */ assigned: boolean;
  /** Caller-computed building/assignment reason. */ disabledReason?: string;
}

export interface WorkersSheetProps {
  /** Eligible and locked properties with current assignments. */ assignments: WorkerAssignment[];
  /** Assign worker transition. */ onAssign: (propertyId: string) => void;
  /** Remove worker transition. */ onRemove: (propertyId: string) => void;
  /** Controlled colour updates. */ onColorChange: (propertyId: string, color: string) => void;
  /** Controlled visibility. */ open?: boolean;
  /** Close sheet. */ onClose?: () => void;
}
```

## GameOverCard

Existing UI: `src/components/game/CentralDisplay.tsx winner branch and MonopolyGame.tsx end-state UI`.

winnerName ← players matched by winnerId; winnerTeamName ← teams matched by winnerTeamId. standings.player ← PlayerIdentity mapping; rank/netWorth derive existing final calculations. onBackToLobby/isHost come from existing session/lobby owner state. canRematch defaults false; supply onRematch only for a real rematch flow.

Exact exported prop/data types (JSDoc retained):

```ts
export interface Standing {
  /** Identity in final order. */ player: PlayerIdentityProps;
  /** Final rank from caller. */ rank: number;
  /** Final net worth, computed by caller. */ netWorth: number;
}

export interface GameOverCardProps {
  /** Winner name or team presentation. */ winnerName: string;
  /** Team name for team victory. */ winnerTeamName?: string;
  /** Final standings, already sorted. */ standings: Standing[];
  /** Return to lobby callback. */ onBackToLobby: () => void;
  /** Host-controlled permission, false by default. */ isHost?: boolean;
  /** True only if a real rematch flow exists. */ canRematch?: boolean;
  /** Actual rematch callback, never simulated. */ onRematch?: () => void;
}
```

## WaitingRoom

Existing UI: `src/components/game/LobbySystem.tsx and MonopolyGame.tsx waiting-room branch`.

roomCode ← Lobby.code / existing lobbyCode UI state; seats ← GameState.players identities plus presence; maxPlayers ← settings.maxPlayers or Lobby.maxPlayers; isHost ← existing lobby owner state (Lobby.ownerId/session). onCopy/copied are controlled clipboard success; onStart/onEditProperties bind existing host actions.

Exact exported prop/data types (JSDoc retained):

```ts
export interface WaitingRoomProps {
  /** Exact room code. */ roomCode: string;
  /** Current seat identities and presence. */ seats: PlayerIdentityProps[];
  /** Configured maximum seats. */ maxPlayers: number;
  /** Whether local client is host. */ isHost?: boolean;
  /** Caller-approved start action. */ onStart?: () => void;
  /** Start availability reason, not calculated here. */ startDisabledReason?: string;
  /** Clipboard action delegated to caller. */ onCopy: (code: string) => void;
  /** Caller confirms copy succeeded. */ copied?: boolean;
  /** Optional host editor entry. */ onEditProperties?: () => void;
}
```

## tokens.ts

New shared helper for the components above; no GameState fields are read internally. Palette, type scale, spacing, radii, shadows, duration and touch-target constants; matching scoped CSS variables and Tailwind extension snippet.

```ts
export type Tone = 'neutral' | 'info' | 'gain' | 'loss' | 'warning';
```

## icons.tsx

New shared helper for the components above; no GameState fields are read internally. Consolidated inline SVG set. Icons default to aria-hidden; a title gives the icon an accessible name. Emoji are restricted to player tokens.

```ts
export type IconName = keyof typeof glyphs;

export interface IconProps {
  /** Glyph from the shared inline-SVG set. */ name: IconName;
  /** Optional accessible image title; omit for icons beside text. */ title?: string;
  /** Pixel size; does not change the control's target area. */ size?: number;
  /** Optional styling hook. */ className?: string;
}
```

## primitives.tsx

New shared helper for the components above; no GameState fields are read internally. 

```ts
export interface KitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Bright fill or neutral outline. */ variant?: 'primary' | 'secondary' | 'danger';
  /** Plain-language reason shown below a disabled action. */ disabledReason?: string;
}

export interface TimerRingProps {
  /** Caller-owned countdown; never starts a clock. */ seconds: number;
  /** Effective total/extension denominator from caller. */ total?: number;
}

export interface ActionOption {
  /** Complete visible action label. */ label: string;
  /** Owner's action callback. */ onClick: () => void;
  /** Explicitly disable the action. */ disabled?: boolean;
  /** Owner-supplied rule/write reason. */ disabledReason?: string;
}
```

## SheetShell.tsx

New shared helper for the components above; no GameState fields are read internally. 

```ts
export interface SheetShellProps {
  /** Accessible title. */ title: string;
  /** Controlled visibility. */ open?: boolean;
  /** Close callback. */ onClose?: () => void;
  /** Body, no nested dialog. */ children: ReactNode;
  /** Optional sticky bottom actions. */ footer?: ReactNode;
}
```

## useReducedMotion.ts

New shared helper for the components above; no GameState fields are read internally. useReducedMotion(): boolean, true during SSR; follows prefers-reduced-motion. tokens.css also disables motion independently.

## useBottomSheet.ts

New shared helper for the components above; no GameState fields are read internally. useBottomSheet(options?: BottomSheetOptions): { ref: React.RefObject<HTMLDivElement>; isMobile: boolean }. Trap/restore focus and lock background scroll for a modal; Escape only invokes the supplied callback.

```ts
export interface BottomSheetOptions {
  /** Mount/open state supplied by the owner. */ open?: boolean;
  /** Escape/close callback; absence makes a required decision non-dismissible. */ onDismiss?: () => void;
  /** Trap focus when true; use false for a nonmodal desktop side panel. */ modal?: boolean;
}
```

## Created-file manifest

- `src/ui-kit/ActionStage.tsx`
- `src/ui-kit/AuctionStatus.tsx`
- `src/ui-kit/CardDialogBody.tsx`
- `src/ui-kit/CurrencyAmount.tsx`
- `src/ui-kit/GameOverCard.tsx`
- `src/ui-kit/icons.tsx`
- `src/ui-kit/index.ts`
- `src/ui-kit/JailDialogBody.tsx`
- `src/ui-kit/LogSheet.tsx`
- `src/ui-kit/PlayerIdentity.tsx`
- `src/ui-kit/PlayerSheet.tsx`
- `src/ui-kit/preview.tsx`
- `src/ui-kit/primitives.tsx`
- `src/ui-kit/PropertyTile.tsx`
- `src/ui-kit/PurchaseDialogBody.tsx`
- `src/ui-kit/RentDialogBody.tsx`
- `src/ui-kit/SelectedTileSummary.tsx`
- `src/ui-kit/SheetShell.tsx`
- `src/ui-kit/tailwind-theme-extend.snippet.ts`
- `src/ui-kit/TeamsSheet.tsx`
- `src/ui-kit/tokens.css`
- `src/ui-kit/tokens.ts`
- `src/ui-kit/TradeSheet.tsx`
- `src/ui-kit/TurnStatus.tsx`
- `src/ui-kit/useBottomSheet.ts`
- `src/ui-kit/useReducedMotion.ts`
- `src/ui-kit/WaitingRoom.tsx`
- `src/ui-kit/WorkersSheet.tsx`
- `audit/ui-kit-preview.cjs`
- `UI_KIT.md`
- Generated `audit/ui-kit-preview/`: 39 HTML scene/width pages, index, client bundle/entry, contrast JSON, screenshots and browser measurement results. No generated files should be committed. **Existing .gitignore currently ignores audit/ui-preview/, but does not ignore audit/ui-kit-preview/.** This discrepancy is recorded here; existing .gitignore was not edited.

## Preview and verification

`node audit/ui-kit-preview.cjs` renders every exported main component in populated fixtures, using only the kit. `node audit/ui-kit-preview.cjs --serve` serves http://127.0.0.1:4174/index.html. Set browser viewport to the link width (320, 390, 1440); a filename alone cannot set a viewport. Hydration enables callback and focus checks; no Firebase is loaded.

- 39 browser measurements: no horizontal document overflow, no text below 12px outside map cells, no interactive control below 44px.
- 33 computed semantic and eight-player identity contrast pairs: minimum 4.76:1; zero failures. See generated contrast.json. Borders and decorative stripes are excluded from the text-contrast claim.
- 1,369 actual rendered text/background measurements across the 39 pages: minimum 4.76:1; zero failures. See generated browser-checks.json, which also records the viewport geometry checks.
- Immediate quick-bid callback, disabled insufficient-cash bid, focus entry/trap, Escape and focus restoration verified in browser.
- `npx tsc -p tsconfig.app.json --noEmit`: FAIL, only the six known missing Radix modules (checkbox, collapsible, progress, separator, toggle-group, toggle); no new diagnostics. The root `npx tsc --noEmit` succeeds but is not the app check.
- `npx vite build`: PASS. Existing app is still unwired; therefore preview bundling plus app type-check verify the kit itself, while Vite verifies the unchanged app build.

No game integration or multiplayer/game-rule verification is claimed. Importing the kit is a separate follow-up.

`readableTextOn(color: string): '#020617' | '#ffffff'` chooses ink for a supplied hexadecimal identity fill. `formatCurrency(amount: number, compact?: boolean, signed?: boolean): string` formats dollars with a true minus sign and an exact accessible alternative in CurrencyAmount. Arbitrary custom player colours should be checked during integration; the eight fixture identity colours were verified.

Screenshots: `audit/ui-kit-preview/auction-390.jpg`, `waiting-320.jpg`, `overview-1440.jpg`. Static preview index: `audit/ui-kit-preview/index.html`.

Scope verification: SHA-256 comparison of all 95 pre-existing workspace files captured before this task found zero changed or missing files. No commits or pushes were made. Build output remains in the existing ignored dist directory.
