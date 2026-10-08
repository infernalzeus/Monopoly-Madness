# Monopoly Madness — property and event cards

Presentation-only extension for v1.1.12. Import `src/ui-kit/tokens.css`, then the NEW `src/ui-kit/cards/tokens.css`, and named exports from `src/ui-kit/cards/index.ts`. No existing UI-kit file was edited; additive card tokens live in the new folder, resolving the brief’s token-extension/new-files-only conflict. Live integration is left to Claude.

The user requested individual city graphics during implementation: every current city has an original inline SVG silhouette, with a consistent neon-night treatment; Singapore has distinct three-tower waterfront artwork. No images, data URIs, external art requests, game rules, Firebase subscriptions, global state, timers or animation libraries occur in these components. Local inspect/reveal/selection state is presentation only.

## Data/props needed

- Exact rent-now, utility rule, monopoly/team boost eligibility, current mortgage payout, next progressive house cost and per-action prices/reasons must come from the existing engine/adapter. Never infer authority from a card face. Base house cost is explicitly labelled because Nth-house cost is progressive.
- Write pending/error state is not a GameState field; block repeat actions through supplied disabledReason while a write is pending.
- Original draft queue length/index, card draw history/event identity and reveal timing are not tracked by the kit. Supply these from application state or omit the corresponding feature.
- The board has **22 city properties + 4 railroads + 2 utilities = 28 ownable tiles**. flavour.ts includes those 28 and six extra city lines (Delhi, Mumbai, Shanghai, Madrid, Toronto, Cape Town), meeting the expanded 28-city writing brief without inventing new board tiles.
- Remount RevealCard with a stable draw/event key. No automatic outcome computation, surprise audio or auto-continue.
- Keep at most one modal decision/inspect owner mounted. Resolve or close a stage before opening another modal. The inspect view never sets body overflow.

## types

Replaces/augments: Shared public contracts.

PropertyCardProps.property is the existing Property record, unchanged. rentNow is caller-computed computeRent output or a utility dice rule label; do not use Property.rent[0] for every type. mortgageAmount is existing mortgagePayout(Property), since legacy Property.mortgageValue may differ from current-market payout. owner resolves Property.owner (player name) through GameState.players; PlayerIdentity uses Player.name/color/pieceIcon/teamId, local Player.id comparison and Team.name. hasMonopoly/teamBoosted use existing engine calculations. hidden derives settings.blindPickEnabled and Player.discoveredProperties (board positions). actions, selection, inspect and ordering callbacks are UI adapter responsibilities.

Exact public types:

```ts
export interface CardAction {
  /** Stable action key, supplied by adapter. */ id: 'build-house' | 'build-hotel' | 'sell' | 'mortgage' | 'unmortgage';
  /** Include the actual price in the adapter's label. */ label: string;
  /** Executes an authorized game action outside the kit. */ onAction: () => void;
  /** Visible reason when this action is unavailable. */ disabledReason?: string;
}

export interface PropertyCardProps {
  /** Existing property record; never mutated. */ property: Property;
  /** Size of the face. Full is a noninteractive title deed. */ size?: 'mini' | 'hand' | 'full';
  /** Actual payable rent, or a dice-based label, computed outside the kit. */ rentNow: number | string;
  /** Resolve owner and team from existing players/teams. */ owner?: PlayerIdentityProps;
  /** Existing monopoly calculation output. */ hasMonopoly?: boolean;
  /** Existing team rent/monopoly eligibility output. */ teamBoosted?: boolean;
  /** Blind-pick presentation mask; must also mask accessible text. */ hidden?: boolean;
  /** Current mortgage payout calculated by the adapter, not legacy mortgageValue. */ mortgageAmount: number;
  /** Authorized actions shown in the inspect footer. */ actions?: CardAction[];
  /** Controlled selected indicator (trade picker). */ selected?: boolean;
  /** Overrides opening inspect, e.g. toggles trade selection. */ onSelect?: () => void;
  /** Blocks selection with visible text, e.g. a built-group lock. */ selectionDisabledReason?: string;
  /** Initial inspect state for development/controlled mount previews. */ initiallyInspecting?: boolean;
  /** Optional drag-free ordering transitions; omit at boundaries. */ onMoveLeft?: () => void;
  /** Move right in the caller's presentation order. */ onMoveRight?: () => void;
  /** Report inspection changes; not a game transition. */ onInspectChange?: (open: boolean) => void;
}
```

## PropertyCard

Replaces/augments: src/components/game/PropertyCard.tsx; PlayerPanel.tsx; SheetsHost.tsx PortfolioHost.

Feeds the shared contract above. size is layout only. Full rent-table rows map Property.rent[0..5] for city properties and [0..3] for railroads; utilities use the supplied dice rule. House/hotel figures map Property.houses/hasHotel/houseCost/hotelCost. Market value maps currentValue; mortgage/inactive/auction badges map isMortgaged/isInactive/isInAuction; name/color band map name/colorGroup. Unowned uses isOwned=false; neutral retains historical owner. Full is a readable, noninteractive deed; mini/hand open InspectView. onSelect replaces inspect for trade selection. The entire hidden face and accessible label conceal identity.

See shared PropertyCardProps above.

## InspectView

Replaces/augments: src/components/game/PropertyCard.tsx inspect overlay; SheetsHost.tsx PortfolioHost.

Uses PropertyCardProps, origin from the trigger bounding rectangle, and onClose. Actions execute callbacks supplied by the adapter and display disabledReason verbatim. No body scroll lock; backdrop pointer events pass through outside the panel, while modal keyboard focus stays trapped. Enter/Space use native trigger semantics; Escape and unmount restore focus. onMoveLeft/onMoveRight are presentation order operations.

Exact public types:

```ts
export interface InspectViewProps extends PropertyCardProps {
  /** Source card bounds captured on the tap/click, for transform-only FLIP. */ origin?: DOMRect | null;
  /** Unmount inspect and restore trigger focus. */ onClose: () => void;
}
```

## CardRail

Replaces/augments: src/components/game/PlayerPanel.tsx; SheetsHost.tsx PortfolioHost.

cards resolve Player.properties IDs through GameState.properties and the shared contract. label/onReorder are UI state. Groups are Property.colorGroup or Property.type; ArrowLeft/ArrowRight navigate within a group. Phone scroll is intentionally confined to the rail, never the document. Desktop cards overlap in a restrained fan. Reordering is controlled through inspect buttons.

Exact public types:

```ts
export interface CardRailProps {
  /** Caller-ordered portfolio, grouped for display. */ cards: PropertyCardProps[];
  /** Accessible collection label. */ label?: string;
  /** Called with the new presentation order; never writes game state. */ onReorder?: (ids: string[]) => void;
}
```

## CardGrid

Replaces/augments: src/components/game/PlayerPanel.tsx; SheetsHost.tsx PortfolioHost.

Same cards mapping as CardRail; size hand, group headers, responsive wrapping. Supply at most 40 cards. No virtualization or per-card image resources.

Exact public types:

```ts
export interface CardGridProps {
  /** Populated property cards; keep collections at or below 40. */ cards: PropertyCardProps[];
  /** Accessible collection label. */ label?: string;
}
```

## CityArt

Replaces/augments: New inline illustration inside each property card.

variant maps Property.colorGroup (eight canonical keys), type railroad/utility; city maps Property.name. citySkylines.ts contains 28 individually drawn city silhouettes, including all 22 current cities and six optional future labels. Singapore has its own three-tower/sky-deck and waterfront silhouette. Group colour retains the existing board identity. title is optional descriptive text; art is decorative when adjacent to the card name.

Exact public types:

```ts
export type ArtVariant = keyof typeof groupColors;

export interface CityArtProps {
  /** One reusable skyline silhouette per group/infrastructure type. */ variant: ArtVariant;
  /** Actual city name; selects its individual landmark silhouette when available. */ city?: string;
  /** Optional accessible title; decorative by default. */ title?: string;
}
```

## RevealCard

Replaces/augments: src/components/game/StageHost.tsx pending-card branch; CentralDisplay.tsx special events.

kind/title/lines/perk are display labels from the adapter. For chance/community, amount is PendingCard.amount with sign from PendingCard.isReward; lines can use diceRoll/income/numProperties. Current rules: odd roll rewards, even roll penalizes. A double is even: the Community Chest fixture correctly shows a penalty plus PendingCard.jailCard perk. Go-to-jail uses Player.isInJail; free parking amount uses GameState.freeParkingPot or the settled GameEvent.amount; Pass GO uses the actual GameEvent.amount. onContinue binds the existing resolution; continueLabel is Collect/Pay/Continue. No clocks, audio or game calculations. Click Reveal card for uncontrolled reveal, or drive revealed externally. onReveal fires once per mount; use an event key for each new draw.

Exact public types:

```ts
export type RevealKind='chance'|'community'|'go-to-jail'|'free-parking'|'pass-go';

export interface RevealCardProps {
  /** Presentation category. */ kind: RevealKind;
  /** Actual outcome heading from adapter. */ title: string;
  /** Signed outcome amount; omit when no cash changes. */ amount?: number;
  /** Rule/breakdown strings supplied by adapter, never calculated here. */ lines: string[];
  /** Optional double-roll jail-card award or other extra. */ perk?: string;
  /** Authorized resolve callback. */ onContinue: () => void;
  /** Collect/Pay/Continue label supplied by adapter. */ continueLabel: string;
  /** Explicit permission/write reason. */ disabledReason?: string;
  /** Optional controlled front/back state; defaults to back. */ revealed?: boolean;
  /** Optional observer/sound hook called once when front is revealed. */ onReveal?: () => void;
}
```

## DoublesBanner

Replaces/augments: src/components/game/CentralDisplay.tsx doubles notification.

triple derives lastDiceRoll.isDouble and doubleCount / actual jail event. visible/onFinished are presentation state. Normal banner animation lasts 1500ms and does not block input. There is no timer in the kit. Reduced motion disables the animation; the owner must control visibility/unmount timing because animationend is absent.

Exact public types:

```ts
export interface DoublesBannerProps {
  /** Triple doubles sends the actor to jail. */ triple?: boolean;
  /** Controlled visibility; owner may unmount after 1500ms. No kit timer. */ visible?: boolean;
  /** Notify after the 1.5s presentation animation ends; owner controls unmount. */ onFinished?: () => void;
}
```

## JailCard

Replaces/augments: src/components/game/SheetsHost.tsx PortfolioHost; StageHost.tsx jail branch.

count maps local Player.jailCards ?? 0. onUse binds spendJailCard only when the actor is eligible; disabledReason describes actor/turn/write restrictions. No card is spent inside the kit.

Exact public types:

```ts
export interface JailCardProps {
  /** Actual held Player.jailCards count. */ count: number;
  /** Optional authorized spend callback in jail. */ onUse?: () => void;
  /** Rule/write availability reason. */ disabledReason?: string;
}
```

## AuctionCard

Replaces/augments: src/components/game/StageHost.tsx auction branch.

card maps properties matched by currentAuction.propertyId plus the shared contract. auction is the existing AuctionStatusProps: currentBid/highestBidder/duration/endTimestamp/bids/startedBy from currentAuction, local Player.name/balance, preAuctionPhase, and caller clock/quick-bid eligibility. Do not derive original draft totals from the shrinking queue.

Exact public types:

```ts
export interface AuctionCardProps {
  /** Deed presentation data. */ card: PropertyCardProps;
  /** Existing live bid-panel props, owned by adapter. */ auction: AuctionStatusProps;
}
```

## TradeCardPicker

Replaces/augments: src/components/game/TradeHost.tsx give/receive choices.

choices resolve owned properties for TradeOffer.fromPlayer/toPlayer; card data follows the shared contract. selectedIds map draft offeredProperties/requestedProperties. lockedReason comes from existing hasBuildingsInGroup, isInAuction and ownership eligibility. Locked choices are native disabled buttons with visible associated reasons. onToggle updates only the controlled draft.

Exact public types:

```ts
export interface TradeCardChoice {
  /** Existing property card data. */ card: PropertyCardProps;
  /** Built group, auction or ownership restriction from adapter. */ lockedReason?: string;
}

export interface TradeCardPickerProps {
  /** Label the give/receive side explicitly. */ label: string;
  /** Owned cards, including visibly locked choices. */ choices: TradeCardChoice[];
  /** Controlled selection of actual property IDs. */ selectedIds: string[];
  /** Toggle intent; adapter checks authorization and ownership. */ onToggle: (id:string) => void;
}
```

## Files created

- `src/ui-kit/cards/AuctionCard.tsx`
- `src/ui-kit/cards/CardGrid.tsx`
- `src/ui-kit/cards/CardRail.tsx`
- `src/ui-kit/cards/CityArt.tsx`
- `src/ui-kit/cards/citySkylines.ts`
- `src/ui-kit/cards/DoublesBanner.tsx`
- `src/ui-kit/cards/flavour.ts`
- `src/ui-kit/cards/index.ts`
- `src/ui-kit/cards/InspectView.tsx`
- `src/ui-kit/cards/JailCard.tsx`
- `src/ui-kit/cards/preview.tsx`
- `src/ui-kit/cards/PropertyCard.tsx`
- `src/ui-kit/cards/RevealCard.tsx`
- `src/ui-kit/cards/tokens.css`
- `src/ui-kit/cards/TradeCardPicker.tsx`
- `src/ui-kit/cards/types.ts`
- `UI_CARDS.md`
- `audit/ui-cards-preview.cjs`
- Generated `audit/ui-cards-preview/` (ignored): HTML, bundle, measurements and screenshots.

## Verification

`node audit/ui-cards-preview.cjs --serve` generates 39 populated pages and serves http://127.0.0.1:4186/index.html. In a second terminal, `node audit/ui-cards-preview.cjs --check` uses temporary Playwright tools (MONOPOLY_PLAYTEST_TOOLS override, otherwise TEMP/monopoly-playtest-tools) and installed Edge. It checks 320/390/1440 × normal/reduced-motion, keyboard navigation, inspect focus/escape/restore, actual wheel scrolling behind inspect, and reveal/continue callbacks. Outputs `playwright-checks.json` and screenshots in the generated folder.

- Token contrast: 43 computed pairs, minimum 4.76:1, zero failures.
- Browser verification: **78 pages passed**, 3,984 measured text/background pairs, minimum 9.44:1; no overflow, undersized targets or reduced-motion failures. Keyboard, inspect focus/escape/restore, background wheel scroll and reveal callbacks passed. Full-card artwork keeps the whole individual skyline visible. An initial reduced-motion interaction check caught the invisible front intercepting the Reveal button; hidden faces now have pointer-events:none and the interaction is rechecked.
- `npx tsc -p tsconfig.app.json --noEmit`: FAIL with exactly the six known missing Radix packages; no new diagnostics.
- Safe build command: `npx vite build --config playtest/vite.config.mjs --mode emulator`: PASS (isolated envDir; never reads .env.local). Bundle-size warning is recorded, not a build failure. Production integration remains unverified.
- Initial preview-server launch failed with EADDRINUSE on 4175; current preview server uses 4186.

The 40-card fixture verifies layout and node counts; device-specific frame-rate guarantees are not claimed. All animation transitions use transforms/opacity; there are no per-card raster downloads.
