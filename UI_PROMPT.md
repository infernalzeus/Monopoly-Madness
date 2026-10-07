# GPT UI-redesign prompt — Monopoly Madness Auction

Paste everything below the line into GPT (attach screenshots of: lobby, setup/waiting room, main board mid-game,
auction panel, trading dialog, jail dialog, rent dialog, player panel, game log, mobile width). Ask it to answer in
**one message with one HTML mockup file per screen** (see Deliverables).

---

You are a senior product designer + front-end engineer. Redesign the UI of **Monopoly Madness Auction**, a real-time
multiplayer Monopoly variant (React 18 + TypeScript + Vite + Tailwind + shadcn/ui; Firebase for sync). Rules logic is
off-limits — you are only changing presentation, layout, motion and information design. Everything you propose must be
implementable by editing the existing components without changing props' meaning.

## Product facts (so the design matches the game)
- 2–8 players online, or 1 player vs "Bot Noob". Phone, tablet and desktop all matter; most players join from phones.
- Variant rules the UI must express clearly: pre-game **draft auction** of chosen properties; **turn auctions** when a
  property is declined (live countdown, bid extends clock to ≥15 s); **trading market** (cash + properties both ways,
  blocked while a colour group has buildings); **teams** (teammates pay no rent between them, shared monopolies);
  **workers** (auto-build a house each time you pass GO); **blind-pick** (tiles hidden until discovered); mortgage;
  jail (pay 20% of rental income / stay / Get-Out-Of-Jail-Free card); **doubles roll again, 3 doubles → jail**;
  Chance/Community = ±10% of rental income by odd/even roll; GO pays 10% of your cash; turn timer; bankruptcy turns
  your tiles into grey neutral tiles; currency is `$` with big numbers (10M start) so number formatting matters.
- The board centre is the action stage: exactly one dialog owns it at a time (jail → card → rent → landed-on-own →
  purchase/auction). Keep that single-owner model.

## Current screens / components to cover
`LobbySystem` (create/join, settings, room list) · waiting room ("Start Game Now", presence ⚠ Away, property editor) ·
`MonopolyBoardLayout` + `CentralDisplay` (40-tile board, dice, timer, tokens, hop animation) · `AuctionPanel` ·
`TradingSystem` · `RentPaymentDialog` · jail dialog · Chance/Community dialog · `PlayerPanel` (balance, colour-grouped
mini property tiles, drag to reorder, mortgage) · `PropertyCard` (build/sell/mortgage) · `TeamPanel` · `GameLog` and
`TransactionNotification` toasts · `RulesPanel` · `GameConsole` (host property editor) · end-of-game / winner screen.

## Design goals (in priority order)
1. **Glanceability under time pressure.** Whose turn, how long left, what I owe/can do — readable in <1 s on a phone.
   Dense, structured, mechanism-first; no walls of text or marketing copy.
2. **One-thumb mobile layout.** Board scales to the viewport; primary action in thumb reach; bottom-sheet for
   player/property/log/trade instead of side panels; ≥44 px touch targets; no horizontal scroll.
3. **Money legibility.** Consistent number format (`$1.2M`), colour-coded gains/losses, short animated deltas on
   balances, never colour as the only signal (accessibility).
4. **Auction drama.** A live auction should feel like an auction: big current bid, highest bidder, shrinking ring
   timer, one-tap quick bids (+min, +25K, +50K), and a clear "you're winning / outbid" state.
5. **Property ownership at a glance.** Owner colour band/flag on tiles, building pips, mortgaged hatch, inactive
   (bankrupt) grey, team tint, blind-pick fog.
6. **Calm motion.** Dice, token hop, toast and dialog transitions that explain cause and effect; respect
   `prefers-reduced-motion`.

## Hard constraints
- Keep Tailwind + shadcn/ui; no new UI framework. Dark theme first (current look: slate-950/900 base, cyan/emerald/
  amber accents, neon glow) — evolve it, don't restart from a generic template. Light theme optional.
- **Icons: inline SVG only** (no emoji or icon-font glyphs for UI icons — they render pixelated at small sizes).
  Emoji are acceptable only for player *tokens*.
- No data-URI images. Mockups must be **populated with realistic data** (8 players, mid-game, real property names from
  the Global Edition: London, Paris, Tokyo, Dubai, Singapore…), not empty states.
- Accessibility: WCAG AA contrast, visible focus, keyboard-operable dialogs, aria-live for turn/auction changes.
- Performance: no heavy animation libraries; CSS transforms/opacity only; board must stay smooth on a mid-range phone.
- Don't change game rules, copy that states rules, or component prop contracts. If a design needs new data, list it
  explicitly under "Data/props needed" rather than assuming it.

## Deliverables
1. **A short design rationale** (≤200 words): the 3 biggest problems you see in the current UI and how the redesign fixes them.
2. **Design tokens**: colour palette (with roles), type scale, spacing, radii, elevation, motion durations — as a
   Tailwind `theme.extend` snippet + CSS variables.
3. **One self-contained `.html` mockup per screen** (inline CSS + inline SVG, no external assets), each at both
   **390×844 (phone)** and **1440×900 (desktop)** layouts, populated with realistic data. Screens: lobby, waiting room,
   main board (my turn), main board (not my turn), auction (I'm outbid), trade market, rent due, jail, card, player
   sheet, winner screen.
4. **Component map**: for each screen, which existing component files change and what new small components are
   needed (name, props, where used). Mark anything that needs new game-state data.
5. **Implementation order** in ≤6 steps, each independently shippable, lowest-risk first.
6. **What you deliberately did not change** and why.

Be concrete and opinionated; skip generic UX advice. If two options are close, pick one and say why.
