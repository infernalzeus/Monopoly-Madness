# Codex UI-kit prompt — Monopoly Madness Auction

Run Codex from the repo root. Paste everything below the line.

---

Read UI_PROMPT.md, UI_AUDIT_REPORT.md, arch.md (v1.1.8 section) and the components in src/components/game/ first.

TASK: build a self-contained UI kit for Monopoly Madness Auction under a NEW folder `src/ui-kit/`. You may ONLY
create new files (src/ui-kit/**, audit/ui-kit-preview.cjs, UI_KIT.md). Do NOT edit any existing file, do not touch
game rules/hooks/engine, do not add dependencies (React 18 + TS + Tailwind + lucide-react are already installed;
lucide icons render inline SVG). I (Claude) will wire the kit into the game afterwards, so every component must be a
pure presentational drop-in: props in, callbacks out, no Firebase, no game logic, no global state.

DESIGN DIRECTION (evolve the current look, don't restart): dark slate-950/900/800 surfaces, cyan/emerald/amber/rose
accents, subtle neon glow. >=14px body text, >=44px touch targets, WCAG AA contrast (white-on-cyan/amber fails; use
dark ink on bright fills), no colour-only signals, `prefers-reduced-motion` respected, mobile-first at 360-430px and
scaling up to 1440px. Icons: inline SVG only (lucide-react or hand-written SVG) — NO emoji except player tokens.
Currency is `$` with large numbers (10M start): compact `$1.2M` primary, exact amount in title/aria-label.

BUILD THESE (each in its own file, named exports + default props where sensible, fully typed, JSDoc on props):
 1. tokens.ts + tokens.css — palette roles, type scale, spacing, radii, elevation, motion durations; also a
    `tailwind-theme-extend.snippet.ts` I can paste into tailwind.config.ts.
 2. CurrencyAmount — {amount, signed?, compact?, tone?} ; real minus sign "−", green gain / red loss + sign symbol,
    aria-label with exact value.
 3. PlayerIdentity — {name, color, icon (emoji token), isYou?, isBot?, isAway?, isBankrupt?, teamName?, size} ;
    colour stripe + dark/light text chosen for contrast (export `readableTextOn`), plus a shape/letter marker so 8
    players are distinguishable without colour.
 4. TurnStatus — {actorName, isMine, secondsLeft?, totalSeconds?, phase} ; sticky top strip; ring/bar timer that
    turns urgent under 10 s; aria-live="polite" announcements of turn changes only (not every second).
 5. ActionStage — {kind:'jail'|'card'|'rent'|'purchase'|'auction'|'own-property', title, subtitle?, children,
    footer} ; ONE action owner; on <640px renders as a bottom sheet (max-h 88vh, scrollable body, STICKY footer with
    the primary action in thumb reach); on >=640px renders centred in the board stage. role="dialog", focus moves in
    and is restored on close, Escape handling via an optional onDismiss.
 6. AuctionStatus — {propertyName, currentBid, highestBidder, you, secondsLeft, totalSeconds, minIncrement,
    quickBids[], onBid(amount), balance, isSeller, isDraft?, draftIndex?, draftTotal?} ; big bid, countdown ring
    (numeric time always shown), explicit states: "You're winning" / "You were outbid" / "Not bidding", one-tap quick
    bids that submit immediately (no second confirm), disabled reasons shown as text.
 7. PropertyTile (board cell) — {name, price, colorGroup, ownerColor?, ownerName?, houses, hasHotel, isMortgaged,
    isInactive, isInAuction, teamName?, tokens[], size:'map'|'full'} ; layers for ownership/mortgage (hatch + "M")/
    bankrupt neutral (grey + "X")/team tint; 'map' size is for phones (no text smaller than 9px — show a short code
    or icon and rely on a selected-tile summary), 'full' for desktop.
 8. SelectedTileSummary — readable detail strip shown under the board on phones when a tile is tapped.
 9. RentDialogBody, JailDialogBody, CardDialogBody, PurchaseDialogBody — the CONTENT of the stage for each situation
    (dark theme, debt/creditor first, amount large, one primary + one secondary action, plain-language reason when a
    button is disabled; rent offers "Declare bankruptcy" when unaffordable).
10. PlayerSheet (portfolio as a phone bottom sheet / desktop side panel), TradeSheet (two clearly labelled sides,
    proper <label htmlFor>, inputMode="numeric", min/step, shows the built-colour-group lock reason, expiry age),
    LogSheet, TeamsSheet, WorkersSheet.
11. GameOverCard — winner/team, standings, "Back to lobby", optional host-only "Rematch" (prop `canRematch`).
12. WaitingRoom — compact seat rows, room code with copy button, sticky Start button, Away badges, no horizontal
    scroll at 320px.
13. icons.tsx — one consolidated inline-SVG icon set (dice, house, hotel, jail, key, hammer/auction, handshake,
    team, worker, mortgage, bank, timer, trophy, copy, close) with `aria-hidden` + optional `title`.
14. useReducedMotion() hook and `useBottomSheet()` helper if you need them.

Also export a barrel `src/ui-kit/index.ts` and write `UI_KIT.md`: one section per component with the exact prop
types, which EXISTING component/file it replaces, and the existing GameState fields that feed each prop (use the real
field names from src/types/game.ts). If a component needs data that does not exist today (e.g. original draft
queue length, per-action "why disabled" reasons, write pending/error state), list it under "Data/props needed"
instead of inventing it.

PREVIEW + VERIFY: write `audit/ui-kit-preview.cjs` (model it on audit/ui-preview.cjs) that server-renders every
component with realistic populated data (8 players, mid-game, Global Edition names: London, Paris, Tokyo, Dubai,
Singapore…) to static HTML in `audit/ui-kit-preview/` (that folder is gitignored; do not commit it). Render each at
320, 390 and 1440px wide and check: no horizontal scroll, no text <12px outside 'map' tiles, all interactive targets
>=44px, contrast pairs >=4.5:1 (compute them). Run `npx tsc -p tsconfig.app.json --noEmit` (the six missing
@radix-ui errors are known) and `npx vite build`; both must show no NEW errors.

OUTPUT: list of files created, the verification commands + results (report failures as failures), screenshots/paths
of the preview HTML, and a short "wiki update" note (<=10 lines). Do not commit or push.
