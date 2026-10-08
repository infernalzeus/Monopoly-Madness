# Codex UI/UX prompt — property cards & event cards (Legends-of-Runeterra feel)

Run Codex from the repo root. Paste everything below the line.

---

Read `UI_KIT.md`, `arch.md` (v1.1.12 section), `src/types/game.ts`, `src/components/game/StageHost.tsx`,
`SheetsHost.tsx`, `MonopolyGame.tsx` and the existing `src/ui-kit/` first. The kit is presentation-only; keep it that way.

## The idea
Make the game's **things** feel like cards you hold, inspect and reveal — the way *Legends of Runeterra* presents
cards: a clean card frame, strong art area, a name banner, a few big stats, a rules-text box, rarity/colour
identity, hover/tap lift, and a smooth "expand to full card" inspect view. The theme is Monopoly Madness
(Global Edition: London, Paris, Tokyo, Dubai, Singapore, São Paulo …), dark neon UI, mobile-first.

## Deliverables (new files only, under `src/ui-kit/cards/`, plus `UI_CARDS.md` and `audit/ui-cards-preview.cjs`)

### 1. PropertyCard (the main piece)
A card for every ownable tile (property, railroad, utility). Three sizes from one component:
- **`mini`** (portfolio rail): ~96×132 — colour-group banner, city name, a house/hotel pip row, mortgaged hatch.
- **`hand`** (portfolio fan/grid): ~160×224 — banner, art area, name, rent-now stat, owner chip, state badges.
- **`full`** (inspect): ~320×460 on phones, up to ~380×540 desktop — the Indian-Monopoly **title-deed** feel:
  colour-group header band with the city name, **full rent table** (Rent / with 1,2,3,4 houses / with Hotel),
  mortgage value, house cost, hotel cost, "monopoly doubles unimproved rent" line, current market value, owner
  & team, and a short flavour line per city (write one witty line for each of the 28 city names + 4 railroads
  + 2 utilities in a `flavour.ts` data file — no real-brand claims, just city-flavour).
- **Art**: no image files and no data-URI images. Generate the art area as **inline SVG** — a stylised skyline
  or landmark silhouette per colour group (brown/light-blue/pink/orange/red/yellow/green/dark-blue, railroads,
  utilities), tinted with the group colour. One reusable `CityArt` component with a `variant` prop is fine.
- **States** that must be visible without relying on colour alone: unowned, owned-by-you, owned-by-other (owner
  chip with name + token), mortgaged (hatch + "MORTGAGED" ribbon), bankrupt/neutral (grey + "NEUTRAL"), in-auction
  (pulsing ring + "AUCTION"), has-monopoly (subtle gold rim + "MONOPOLY"), team-boosted, blind-pick hidden
  (card back with "?").
- **Interaction**: tap/click lifts the card (scale + shadow) and **expands** it into a modal inspect view with a
  shared-element-style transition (FLIP using CSS transforms only; no animation library). Inspect view shows the
  `full` card plus the action row (Build house / Build hotel / Sell / Mortgage / Unmortgage) supplied via props
  with per-action `disabledReason` text. Keyboard: Enter/Space opens, Esc closes, arrow keys move between
  cards in the rail, focus is restored. `prefers-reduced-motion`: no lift/expand animation, instant swap.
- **Portfolio**: `CardRail` (horizontal scroll-snap on phones; fan/overlap on desktop, hover lifts one card) and
  `CardGrid`; group-by-colour with a small header; drag-free reordering via move-left/right buttons in the inspect view.

### 2. Event cards: Chance, Community Chest, and "special" reveals
A `RevealCard` that **pops onto the screen** like drawing a card, replacing the plain dialog body:
- **Chance / Community Chest**: card back → flip (rotateY, 600 ms, reduced-motion = crossfade) → front showing the
  outcome. Front layout: category banner (CHANCE in amber, COMMUNITY CHEST in teal), big signed money amount
  (`+$120K` / `−$80K`), the dice-roll rule line ("Roll 7 · odd → reward"), income × 10% breakdown, and a
  **special-perk strip** for extras: "GET OUT OF JAIL FREE card earned (double roll)". Collect/Pay button in a
  sticky footer. Sound hooks optional via an `onReveal` callback (no audio in the kit).
- **Doubles bonus**: a small "DOUBLES — roll again" banner card that slides in from the top for 1.5 s (non-blocking,
  `role="status"`), and a "TRIPLE DOUBLES — GO TO JAIL" red variant.
- **Jail card** (held card): a collectible-looking "Get Out of Jail Free" card shown in the portfolio and in the
  jail dialog, with a count badge.
- **Go to Jail / Free Parking pot / Pass GO** reveal: reuse `RevealCard` with different banner colour + icon.
Props must be presentational: `{ kind, title, amount?, lines[], perk?, onContinue, continueLabel }`.

### 3. Auction & trade as cards
- `AuctionCard`: the property's `full` card on the left/top with the live bid panel (existing `AuctionStatus`)
  attached — the auction should read as "this card is up for bid".
- `TradeCardPicker`: pick properties for a trade by tapping `mini` cards (selected state with check + group
  border), with the built-colour-group lock shown as a padlock ribbon plus the reason text.

### 4. Polish & motion tokens
Extend `tokens.css` with card tokens (frame radius, rarity-style group colours, glow, foil shimmer on monopoly
cards). Foil shimmer is a CSS gradient sweep on `:hover`/inspect only and is disabled for reduced motion.

## Constraints
- **New files only** under `src/ui-kit/cards/` (+ `UI_CARDS.md`, `audit/ui-cards-preview.cjs`, optional
  `.gitignore` line for the generated preview folder). Do NOT edit existing files; I will wire it in.
- React 18 + TS + Tailwind already installed; **no new dependencies**, no image/data-URI assets, no emoji icons
  (emoji only for player tokens), inline SVG only.
- Presentational only: props in, callbacks out; no Firebase, game logic, timers or global state. Use existing
  field names from `src/types/game.ts` (Property, Player, PendingCard, TradeOffer…) in the mapping docs.
- Accessibility: AA contrast (compute and report), ≥44 px targets, focus order, `aria-label` with the full card
  text (name, group, owner, rent now, state), reduced motion, 320 px phone width with no horizontal scroll.
- Performance: transforms/opacity only; ≤ 40 cards rendered at once must stay smooth — virtualise nothing, but keep
  each card to a handful of DOM nodes and no per-card images.
- The old issue to avoid: a modal stage **must not lock page scroll** (players need to scroll the board/portfolio
  behind a pending decision). Do not set `overflow:hidden` on `body`.

## UI_CARDS.md must contain
Exact prop types per component, which current file each replaces/augments (`PropertyCard.tsx`, `PlayerPanel.tsx`,
`StageHost.tsx` card branch, `SheetsHost.tsx` PortfolioHost, `TradeHost.tsx`), the GameState fields feeding each
prop, and a "Data/props needed" list for anything the engine doesn't provide today (e.g. per-action
`disabledReason`s, original draft index, card draw history).

## Verify & report
Write `audit/ui-cards-preview.cjs` (model on `audit/ui-kit-preview.cjs`) rendering populated fixtures: a
portfolio of 12 mixed cards (monopoly, mortgaged, houses, hotel, railroad, utility), the inspect view of London
and Tokyo, a Chance reveal (front + back), a Community Chest with the jail-card perk, a doubles banner, a trade
picker, an auction card. Check at 320/390/1440 px: no horizontal overflow, no text < 12 px (except mini card
codes ≥ 9 px), targets ≥ 44 px, contrast ≥ 4.5:1, reduced-motion path. Run `npx tsc -p tsconfig.app.json --noEmit`
(six known Radix errors only) and `npx vite build`. Report failures as failures, list files created, give
screenshots paths, and end with a ≤10-line "wiki update" note. Do not commit or push.
