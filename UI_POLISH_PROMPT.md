# Codex prompt — premium in-game UI polish (everything EXCEPT the first lobby screen)

Run Codex from the repo root. Paste everything below the line.

---

Read `ARCHITECTURE.canvas`, `arch.md` (v1.1.14–v1.1.15), `UI_KIT.md`, `UI_CARDS.md`, `src/ui-kit/**`,
`src/components/game/{MonopolyGame,StageHost,SheetsHost,SideDock,TradeHost,cardAdapters}.tsx`,
`MonopolyBoardLayout.tsx`, `CentralDisplay.tsx`, `PlayerPanel.tsx`, `TeamPanel.tsx`, `AuctionPanel.tsx`, `GameConsole.tsx`, `RulesPanel.tsx`.

## Goal
Raise the in-game UI from "clean and functional" to **premium, eye-catching, game-like** — the polish level of a
strong mobile board/card game (think Legends of Runeterra's frames, glow and motion, with a neon-night Monopoly
identity). **Do NOT touch the first lobby screen** (`LobbySystem.tsx` create/join page) — it stays exactly as is.
Everything after the player enters a room is in scope: the waiting room, the board, dice, turn strip, side dock,
bottom nav, stage pop-ups, cards, panels, sheets, game-over.

## Rules of engagement
- **New files only**, under `src/ui-kit/polish/` (plus `UI_POLISH.md`, `audit/ui-polish-preview.cjs`, and a
  `.gitignore` line for the generated preview folder). Do **not** edit existing files — I wire your components in
  afterwards, exactly as with the card kit. Do not touch game logic, hooks, engine, Firebase, rules.
- Presentational only: props in, callbacks out. No new dependencies, no image files or data-URI assets, **no emoji
  icons** (emoji only for player tokens). Inline SVG / CSS only. Transforms and opacity for motion; honour
  `prefers-reduced-motion`. Keep it performant on a mid-range phone (≤ 40 board tiles + 8 tokens animating).
- Constraints that must keep holding: one-screen layout (no page scroll), modal stages never lock page scroll,
  ≥ 44 px touch targets, AA contrast, 320 px width without horizontal scroll, mobile bottom-nav + desktop side-dock
  structure stays.

## First, audit (write it into UI_POLISH.md before building)
Open the current UI (use/adapt `audit/ui-preview.cjs` fixtures at 390 and 1440 px) and list the **ten weakest
visual elements in the live game**, ranked by how dull/confusing they look and how often the player sees them.
Candidates I already suspect — confirm or replace with your own ranking:
1. **Board tiles** (`MonopolyBoardLayout`): tiny uppercase text, flat blocks; owners shown by a dot.
2. **Board centre / `CentralDisplay`**: dice, "Your Turn" pill, Trade button — functional but plain.
3. **Dice**: spin animation and result display.
4. **Player tokens** and token movement on the board.
5. **Player panel** (`PlayerPanel` header, cash / net-worth tiles, stats row).
6. **Turn strip** (`TurnStatus`) and header.
7. **Bottom nav** and **side-dock tabs**.
8. **Stage pop-ups** (`ActionStage`, rent / purchase / jail / auction bodies) — they work but feel like forms.
9. **Game log / players list** rows.
10. **Money changes** (no feedback when cash changes), toasts, achievements.

## Deliverables (each its own file in `src/ui-kit/polish/`, typed props with JSDoc, populated previews)
1. **`tokens.css` extension**: neon glow ramps, frame/rim gradients, glass surfaces, elevation, a motion scale
   (120/180/260/600 ms), foil sheen, subtle noise-free textures via CSS gradients only.
2. **`BoardTile`** (all sizes the board uses, corner + edge orientations): colour-group band with a gloss edge,
   readable name (rotated text where the board rotates, **never below 9 px on a phone**; on phones prefer short
   codes + icon with the full name in the tap summary), price, building pips (houses/hotel as small SVG
   buildings), **owner ownership flag/banner in the owner's colour with token initial** (not just a dot), mortgaged
   hatch + M, neutral/bankrupt X, in-auction pulse, monopoly gold rim, team tint, blind-pick fog. Corner tiles
   (GO, Jail, Free Parking, Go To Jail) and Chance / Community Chest / Tax / Railroad / Utility each get a distinct
   illustrated inline-SVG treatment.
3. **`BoardFrame`**: the board's outer frame + centre stage backdrop (animated subtle neon grid/vignette) that the
   existing centre content sits on.
4. **`Dice`**: 3D-feeling pip dice (CSS transforms), tumble animation with settle, doubles glow, reduced-motion = instant.
5. **`Token`**: premium token disc with coloured rim, glow when it's that player's turn, hop trail; `TokenStack`
   for several tokens on one tile without overlap chaos.
6. **`TurnBanner`** (replaces the turn strip look): whose turn, phase text, ring timer with urgency state, current
   player's token; plus a **`MoneyDelta`** component that floats "+$120K" / "−$80K" next to a balance when it changes.
7. **`PlayerCard`** (side-dock header): avatar token, cash and net-worth as big animated counters, rank medal,
   mini sparkline of net-worth history (prop-supplied array), status chips (jail, away, bot, team).
8. **`NavBar`** (phone bottom nav) and **`DockTabs`** (desktop tabs): icon + label, active glow, badge with pulse,
   safe-area aware.
9. **`StageFrame`**: a premium frame/header for `ActionStage` with a kind-specific accent (rent = red, card =
   amber, purchase = emerald, jail = rose, auction = gold) and entrance animation; plus restyled dialog-body
   sections (`StageHero`, `StageStat`, `StageActions`) so the existing bodies can adopt them.
10. **`AuctionHall`**: dramatic live-auction layout — big card, huge current bid with count-up, circular countdown,
    bidder avatars stack, "outbid!" shake, one-tap bid chips.
11. **`ListRow`** family for players / log / trade offers: avatar, two-line text, trailing value, swipe-free.
12. **`Toast` / `AchievementPop`**: refined toasts with accent icons and a small confetti burst (CSS only, 600 ms,
    disabled for reduced motion).
13. **`GameOverStage`**: winner podium with token, confetti, standings.
14. **`EmptyState`** and **`Skeleton`** components for panels with nothing yet.

## Verify & report (same standard as the card kit)
`audit/ui-polish-preview.cjs` renders populated fixtures for every component at 320 / 390 / 1440 px (8 players,
mid-game, Global Edition names). Measure: no horizontal overflow, no text < 9 px on tiles and < 12 px elsewhere,
targets ≥ 44 px, contrast ≥ 4.5:1, reduced-motion path, no layout shift when numbers change. Run
`npx tsc -p tsconfig.app.json --noEmit` (six known Radix errors only) and `npx vite build`. In `UI_POLISH.md`:
the ranked audit, exact prop types per component, **which existing file/element each replaces** and the GameState
fields that feed each prop, a "Data/props needed" list, and screenshots (before → after where you can). Report
failures as failures. Do not commit or push. End with a ≤ 10-line "wiki update" note.
