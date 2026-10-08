# 🎲 Monopoly Madness Auction - Application Architecture & Developer Manual

> **Current Version: `v1.1.12`**  
> Version is displayed on the lobby start screen (`LobbySystem.tsx` header) and used as the prefix for all git commit summaries.  
> Format: `v<major>.<minor>.<patch>.<build>` — increment build on each fix, patch on each feature set, minor on design overhauls.

Welcome to the **Monopoly Madness Auction** technical architecture documentation. This document serves as a comprehensive system guide, directory map, state flowchart, and developer runbook. 

Whenever you need to introduce new features, tweak existing game mechanics, or debug state transitions, use this document to understand the underlying patterns, constraints, and data flows.

---

## 📌 Architectural Overview

Monopoly Madness Auction is a real-time, multiplayer-first board game built on React, TypeScript, and Tailwind CSS, powered by **Firebase Firestore** for serverless, conflict-free state synchronization. 

The application utilizes a **Unidirectional Data Flow** pattern paired with an **Event-Driven Pure Game Engine**:

```mermaid
graph TD
    UI[React Components / UI Panels] -->|User Interaction / Action| Hook[src/hooks/useGameLogic.ts]
    Hook -->|Local Offline Mode| LocalState[Internal React State]
    Hook -->|Multiplayer Room Mode| Firebase[Firebase Firestore: games collection]
    
    Firebase -->|Real-Time Subscription: onSnapshot| SyncState[Synchronized Room GameState]
    SyncState -->|Re-render UI| UI
    
    subgraph Core Engine Logic
        Hook -->|Inputs Current State & Action Params| Engine[src/gameEngine/core.ts]
        Engine -->|Performs Pure State Mutation| NewState[Next GameState]
        NewState -->|Returns Updated State| Hook
    end
```

### Key Pillars:
1. **Strict Decoupling of Logic and State**: The state is stored either in Firestore (multiplayer) or in a React state hook (local offline play). State transformations are calculated *exclusively* via pure functions defined in the `core.ts` game engine.
2. **Atomic Firestore Transactions**: To prevent race conditions in multiplayer rooms (e.g., two players bidding on the same millisecond or rolling at the same time), all state-mutating actions utilize Firestore `runTransaction`.
3. **Hybrid State Subscription**: The app seamlessly supports local offline gameplay (with bots) and multiplayer rooms. If a `roomId` is present, the hook subscribes to real-time updates via `onSnapshot` and writes updates to the database; otherwise, it degrades gracefully to standard React `useState` updates.

---

## 📂 Codebase Directory & File Mapping

```
monopoly-madness-auction/
├── src/
│   ├── types/
│   │   └── game.ts                # Strict TypeScript models and interface contracts
│   ├── gameEngine/
│   │   └── core.ts                # Pure engine functions (move, purchase, pay rent, bankruptcy)
│   ├── hooks/
│   │   ├── useGameLogic.ts        # Primary state management, Firebase transaction wrappers, deck shufflers
│   │   ├── use-toast.ts           # Toast notification hooks
│   │   └── use-mobile.tsx         # Mobile viewport handler
│   ├── components/
│   │   ├── ui/                    # Reusable shadcn/ui atoms (Dialogs, Buttons, Tabs, Drawers)
│   │   └── game/                  # Game-specific visual and logical components
│   │       ├── MonopolyGame.tsx   # Grand Orchestrator & View Controller
│   │       ├── MonopolyBoardLayout.tsx # SVG/Grid Monopoly Board Layout
│   │       ├── LobbySystem.tsx    # Room creation, joining, and configuration
│   │       ├── TeamPanel.tsx      # Team alliances and shared balances
│   │       ├── TradingSystem.tsx  # Dynamic property and cash trade builder
│   │       ├── AuctionPanel.tsx   # Regular turn bidding module
│   │       ├── PreAuctionPanel.tsx (removed v1.1.6)
│   │       ├── PlayerPanel.tsx    # Portfolio list, house builders, mortgages
│   │       ├── GameConsole.tsx    # Property configuration and customization
│   │       ├── DiceRoller.tsx     # 3D/Visual dice roll triggers
│   │       ├── RentPaymentDialog.tsx # Over-the-board rent collection popups
│   │       ├── GameLog.tsx        # Event feeds and historical logs
│   │       └── TransactionNotification.tsx # Toast overlay of transactions
│   ├── pages/
│   │   ├── Index.tsx              # Mount point for MonopolyGame
│   │   └── NotFound.tsx           # Fallback route
│   ├── lib/
│   │   ├── firebase.ts            # Firebase app init & Firestore database instance export
│   │   └── achievements.ts        # Achievement definitions, context builder, localStorage persistence
│   ├── App.tsx                    # Routing & global providers
│   ├── main.tsx                   # React DOM render entry
│   └── index.css                  # Global styles, tailwind configs, animations
```

---

## 📊 Domain Data Models (`src/types/game.ts`)

The entire game state is defined by a single unified object contract: `GameState`.

### 1. `Property`
Represents an individual board tile that players can land on, buy, build on, or mortgage:
* `id` (`string`): Unique identifier (e.g., `'prop-1'`).
* `name` (`string`): Indian-themed city name (e.g., `'Mumbai'`, `'Delhi'`).
* `type` (`'property' | 'railroad' | 'utility' | 'special'`): Space category.
* `colorGroup` (`string`): Grouping color (e.g., `'brown'`, `'darkBlue'`).
* `baseValue` & `currentValue` (`number`): Standard market values.
* `rent` (`number[]`): Multi-tier rent array matching house counts `[base, 1 house, 2 houses, 3 houses, 4 houses, hotel]`.
* `houses` (`number`) / `hasHotel` (`boolean`): Building progress.
* `owner` (`string | null`): Name of owning player, if any.
* `position` (`number`): `0-39` position on the board.

### 2. `Player`
An active participant in a lobby:
* `id` (`string`): Player ID (`'player-1'`, `'player-2'`, etc.).
* `name` (`string`): Nickname.
* `balance` (`number`): Current capital.
* `properties` (`string[]`): Owned Property IDs.
* `position` (`number`): Board position index `0-39`.
* `isActive` (`boolean`): Active indicator; set to `false` if bankrupt.
* `isInJail` (`boolean`) & `jailTurns` (`number`): Jailed status.
* `discoveredProperties` (`number[]`): Board tiles this player has landed on or uncovered.

### 3. `Auction`
Represents an active bidding event:
* `propertyId` (`string`): ID of property under auction.
* `startTime` / `duration` / `endTimestamp` (`number`): Dynamic epoch timers.
* `currentBid` (`number`): High bid.
* `highestBidder` (`string | null`): Name of the current leading bidder.
* `bids` (`AuctionBid[]`): Log of bidding increments.
* `isActive` (`boolean`): Status indicator.

### 4. `GameState`
The global state tree synced across all clients in a room:
```typescript
export interface GameState {
  properties: Property[];
  players: Player[];
  teams: Team[];
  currentAuction: Auction | null;
  settings: GameSettings;
  gamePhase: 'setup' | 'draft' | 'auction' | 'playing' | 'ended';
  turn: number;
  currentPlayer: string; // Active Player ID
  lastDiceRoll: DiceRoll | null;
  gameEvents: GameEvent[]; // Rolling history logs (capped to last 20)
  doubleCount: number;
  pendingPurchase: { propertyId: string; playerId: string } | null;
  pendingRent: { propertyId: string; owner: string; amount: number } | null;
  turnState: 'waiting_for_roll' | 'waiting_for_action' | 'processing' | 'completed';
  preAuctionPhase: boolean;
  consoleOpen: boolean;
  tradeOffers: TradeOffer[];
  winnerId?: string | null;
  turnEndTime?: number | null; // Ephemeral epoch countdown
}
```

---

## ⚙️ The Game Engine (`src/gameEngine/core.ts`)

The game engine contains **pure state-transition functions**. They accept a `GameState` and parameters, and return a *new* copy of `GameState` without mutating any parameters in place.

* **`advanceTurn(state)`**:
  Finds the next active, non-spectator player in the circular queue. Updates the `currentPlayer`, resets the `turnState` to `'waiting_for_roll'`, clears ephemeral fields (`pendingPurchase`, `lastDiceRoll`), and appends a `"Turn X - Player Y's Turn"` game event.
  
* **`rollDiceLogic(state, diceResult)`**:
  Processes jail turn reduction if the player is in jail. If they are free, advances the player using `movePlayer`.
  
* **`movePlayer(state, spaces)`**:
  * Updates the current player's board position index (modulo 40).
  * Awards passing GO money if they wrapped around position 0.
  * Adds the tile to their `discoveredProperties` array.
  * Identifies the space type:
    * **Unowned Property/Railroad/Utility**: Sets state to `waiting_for_action` and populates `pendingPurchase`.
    * **Owned Property**: If owned by someone else, calculates the rent using `computeRent` and sets up `pendingRent` with turnState `waiting_for_action`.
    * **Tax Tile**: Immediately applies a 10% cash deduction via `applyPayment` and moves turnState to `completed`.
    * **Jail / Chance / Free Parking**: Triggers appropriate defaults.
    
* **`computeRent(properties, landedProperty, diceTotal)`**:
  * Standard properties: Base rent doubled if the owner holds a monopoly (all properties of that color group) without mortgages. Returns house/hotel tier rent if built.
  * Railroads: Incremental multiplier depending on total owned railroads (`[1: 25k, 2: 50k, 3: 100k, 4: 200k]`).
  * Utilities: Custom dice total scale factor (`4,000 * diceTotal` if 1 owned, `10,000 * diceTotal` if both owned).
  
* **`applyPayment(state, fromId, toPlayerName, amount, reason)`**:
  Adjusts player balances. If the paying player drops below 0:
  * Triggers **Bankruptcy** sequence.
  * Marks the player `isActive = false`.
  * Transfers all assets (properties, hotels) to the creditor (`toPlayerName`). If the creditor is the bank, mortgages are cleared and properties return to the wild.
  * Evaluates `checkWinCondition`.

---

## 🔄 Real-Time Synchronization & Hook Lifecycle (`src/hooks/useGameLogic.ts`)

`useGameLogic` acts as the reactive adapter between the components, the pure engine logic, and the Firestore DB.

```
                  ┌──────────────────────────────┐
                  │      useGameLogic(roomId)    │
                  └──────────────┬───────────────┘
                                 │
                     ┌───────────┴───────────┐
                     ▼                       ▼
            [ ROOM CODE PRESENT ]    [ NO ROOM CODE (LOCAL) ]
                     │                       │
         ┌───────────┴───────────┐           │
         ▼                       ▼           ▼
   Read Snapshot            Transactions    Write directly to
 (onSnapshot listener)    (runTransaction)  useState wrapper
         │                       │           │
         ▼                       ▼           ▼
   Set React State         Update remote DB   Local State Re-render
```

### 1. The React-to-Firestore Adapter Strategy:
```typescript
const [gameStateInternal, setGameStateInternal] = useState<GameState | null>(null);

const setGameState = useCallback((updater: any) => {
  if (!roomId) {
    // Offline Local Execution
    setGameStateInternal(prev => {
      const currentState = prev || getInitialState();
      return typeof updater === 'function' ? updater(currentState) : updater;
    });
    return;
  }
  
  // Real-Time Online Transaction Execution
  const roomRef = doc(db, 'games', roomId);
  runTransaction(db, async (transaction) => {
    const snap = await transaction.get(roomRef);
    const currentState = snap.data().gameState;
    let nextState = typeof updater === 'function' ? updater(currentState) : updater;
    
    transaction.update(roomRef, {
      gameState: nextState,
      lastUpdated: Date.now(),
      playerCount: nextState.players.length
    });
  });
}, [roomId, gameStateInternal]);
```

### 2. Standard Player Turn State Machine Flow:
```
[ waiting_for_roll ] ──( Roll Dice Event )──> [ processing ] (Animate)
                                                   │
                                            ( Land on space )
                                                   │
         ┌─────────────────────────┼───────────────┴────────────────────────┐
         ▼                         ▼                                        ▼
 [ Landed on Owned ]      [ Landed on Tax/Special ]             [ Landed on Unowned ]
         │                         │                                        │
    pendingRent               Calculate Tax                        pendingPurchase Offer
         │                         │                                        │
 ( Rent Dialog Open )       ( Apply Instantly )                      ┌──────┴──────┐
         │                         │                                 ▼             ▼
   [ Pay / Skip ]                  │                             [ Buy Now ]   [ Decline/Auction ]
         │                         │                                 │             │
         ▼                         ▼                                 │      ( Open AuctionPanel )
[ completed ] <────────────────────┴─────────────────────────────────┼─────────────┘
         │                                                           │
   ( 2s Delay )                                                      ▼
         │                                                   Property Acquired
         ▼
    advanceTurn()
```

---

## 🔨 Subsystems

### 1. Bidding & Auction Loop
* **Pre-Auction (Draft Phase)**: Enabled in custom settings, this module forces players to bid on a pool of predetermined properties (`preAuctionProperties`) before regular board movements commence.
* **Turn Auctions**: When a player lands on an unowned property but declines purchasing it, `AuctionPanel` presents a bidding window to all lobby members:
  * Minimum starting bid: **70% of base property value**.
  * Bids extend the auction timer back to a minimum of **15 seconds** if it falls below that limit, ensuring late-stage counters are possible.
  * Winner immediately receives ownership, the balance is deducted, and the game loop advances to the next player's turn.

### 2. Trading Panel
Accessible anytime during a player's turn:
* An interactive multi-asset builder compiles cash offers, requested properties, and offered properties.
* Offers are pushed to the `tradeOffers` array in `GameState` with a status of `'pending'`.
* The receiving player gets a real-time prompt to Accept or Reject, updating balances and ownership instantly.

---

## 🛠️ Step-by-Step Modification Guide

Follow this strict developer workflow when introducing new mechanics or editing existing parameters:

### Step 1: Update the TS Contracts (`src/types/game.ts`)
* If adding a new setting (e.g., *Double Rent on Utilities* or *Custom Bot Difficulty*), append it to the `GameSettings` interface.
* If adding a new space type or event type, ensure the types are registered under the appropriate unions.

### Step 2: Implement Pure Mutations in Engine (`src/gameEngine/core.ts`)
* Create a dedicated helper function for the calculation, or add a branch to an existing engine function (`computeRent`, `movePlayer`, etc.).
* **RULE**: Never modify parameters directly. Always copy sub-nodes using object destructuring (`{ ...state }`) and return clean outputs.

### Step 3: Wire Actions through Adapter Hook (`src/hooks/useGameLogic.ts`)
* Bind your new engine functions within `useGameLogic.ts`.
* Wrap the caller in a `setGameState` callback, ensuring it executes safely in both single-player state updates and multiplayer Firestore transactions.
* **Example of a new action**:
```typescript
const toggleDoubleRentSetting = useCallback((enabled: boolean) => {
  setGameState(prev => ({
    ...prev,
    settings: {
      ...prev.settings,
      doubleRentEnabled: enabled // your new field
    }
  }));
}, [setGameState]);
```

### Step 4: Add Visual Interfaces (`src/components/game/*`)
* Bind actions to interactive controls (buttons, switches, dialogs) inside React components.
* Retrieve state parameters exclusively from the top-level destructuring return of `useGameLogic` in `MonopolyGame.tsx`, and pass them down as read-only props or callback functions.

### Step 5: Test Execution Under Both Modes
* **Local Play**: Leave Room Code empty, add bots, and verify UI reactivity.
* **Multiplayer Play**: Host a lobby, open a separate browser instance to join via Room Code, and verify that both state transitions and transaction intervals execute successfully without conflicts.

---

## 🤖 Single Player Mode (vs Bot Noob)

A fully automated bot player named **"Bot Noob"** can be selected during lobby setup as the second player for a solo game.

### How to Enable
In the Lobby Settings dialog, select **"1 (vs Bot)"** under Players. This sets `singlePlayer: true`, `maxPlayers: 2`, and disables Teams. The note "You vs Bot Noob — game starts immediately" is shown.

### Startup Behavior
When the host creates a single-player lobby (`handleCreateLobby` in [MonopolyGame.tsx](src/components/game/MonopolyGame.tsx)):
* A second player record (`player-2`, `isBot: true`, `pieceIcon: '🤖'`) named **"Bot Noob"** is added automatically.
* `gamePhase` is set directly to `'playing'` — the waiting room is skipped entirely.
* The Firebase document is saved with `status: 'playing'`.

### Bot Turn Automation
A `useEffect` in `MonopolyGame.tsx` watches state changes for the bot's turns:

```
[ Bot's Turn Starts ] → wait 1.5s → rollDiceForBot()
[ Landed Unowned ]    → wait 1.2s → 60% buy / 40% skip (random)
[ Pending Rent ]      → wait 0.9s → payRent() (always pays)
```

`rollDiceForBot()` in `useGameLogic.ts` bypasses the `localPlayerId` equality guard that `handleDiceRoll` uses for human players, acting only when `currentPlayer.isBot === true`.

---

## 🎨 Customized Branding & Active Property Editor Subsystem

### 1. Customized Brand Assets
* **Custom SVG Icon (`public/favicon.svg`)**: A high-end vector logo designed specifically for *Monopoly Madness*, combining a gold-bordered coin with glowing drop-shadows, a stylized 3D Monopoly top hat with an accent ribbon, dual angled red-piped dice, a mahogany auction gavel, and a red plaque displaying `"MONOPOLY MADNESS"`.
* **Favicon Integration**: Linked as a modern SVG favicon in [index.html](file:///n:/Code/git%20repositories/monopoly-madness-auction/index.html) (`type="image/svg+xml"`) for perfect resolution scaling.
* **In-Game Assets**: Integrated directly as an animated, glowing icon in the headers of [LobbySystem.tsx](file:///n:/Code/git%20repositories/monopoly-madness-auction/src/components/game/LobbySystem.tsx) and [MonopolyGame.tsx](file:///n:/Code/git%20repositories/monopoly-madness-auction/src/components/game/MonopolyGame.tsx).

### 2. Property Editor Persistence Fix

**Root cause (now fixed):** `updateProperty` and `applyPayment` both had empty `[]` `useCallback` dependency arrays, so they captured the *initial* `setGameState` created at component mount when `roomId` is still `undefined`. Any edit was written only to local React state, not Firestore. The next game action (advanceTurn, rollDice) ran its own Firestore transaction, read the server state (without edits), and wrote it back — reverting everything.

**Fix applied:**
* `updateProperty` — added `setGameState` to deps array.
* `applyPayment` — added `setGameState` to deps array.
* `payRent` — consolidated into a **single `setGameState` call** (one Firestore transaction covers both the balance transfer and the `pendingRent` clear). The `addGameEvent` call is now inlined inside the state updater.

### 3. Connected Dynamic Property Editor
The Property Editor is now fully wired into the game loop, moving it from a lobby-only configuration step into a live, interactive game moderator console:
* **Active Game Editing**: If `allowPropertyEditing` is active, the lobby host sees a live `"✏️ Edit Properties"` button in the active gameplay header. This mounts and opens the [GameConsole.tsx](file:///n:/Code/git%20repositories/monopoly-madness-auction/src/components/game/GameConsole.tsx) on-the-fly at any turn of the game.
* **Expanded Edit Capabilities**: The host can edit the property's **Name**, **Space Type** (`'property' | 'railroad' | 'utility' | 'special'`), and **Color Group**. This redefines how properties behave with each other, allowing the creation of custom monopolies and custom board space types dynamically.
* **Type-Aware Dynamic Rent Grid**: Rent inputs dynamically adjust based on the edited **Space Type**:
  * *Standard Property*: Customizes all 6 rent levels (`[Base, 1 House, 2 Houses, 3 Houses, 4 Houses, Hotel]`).
  * *Railroad*: Customizes all 4 incremental ownership levels (`[1 Owned, 2 Owned, 3 Owned, 4 Owned]`).
  * *Utility*: Customizes the 2 multipliers (`[1 Utility, 2 Utilities]`).
* **Firestore Real-time Replication**: Save triggers immediately broadcast the modified parameters to the Firestore database. Mapped components (such as board cell labels, property cards, rent dialogs, and engine payment deductions) reactively recalculate based on the updated properties array, ensuring instant game-wide consistency.

---

## 🔨 Turn-Based Seller Auction

When **Auction Mode** is enabled in lobby settings, players who land on an unowned property can choose to **sell it by auction** instead of buying it themselves.

### Auction Flow (Turn-Based)
```
[ Land on Unowned ] → Buy Now | 🔨 Auction | Pass
                                  ↓
                      [ Set Starting Bid UI ]
                      - Preset % buttons: 70% / 85% / 100%
                      - Custom input
                      - "Launch Auction" confirms
                                  ↓
                      [ Live Auction runs for auctionDuration ]
                      - All other players bid
                      - Seller CANNOT bid on their own auction
                                  ↓
                      [ Auction Ends ]
                      - Winner: gets property, pays currentBid
                      - Seller (startedBy): receives currentBid proceeds
                      - If no bids: property stays unowned, turn advances
```

### Key Fields
* `Auction.startedBy` (`string | null`): Name of the player who initiated the auction. When set, `endAuction()` in `useGameLogic.ts` transfers `currentBid` from winner to this player.
* `startAuction(propertyId, startedByName?, customStartingBid?)` — accepts the initiating player name and optional starting bid.
* Pre-auction draft phase (`preAuctionPhase: true`) has `startedBy: null`, so proceeds go to the bank (no one).
* "Skip/Pass" on a property now always advances the turn (`turnState: 'completed'`) regardless of auction mode being on or off.

---

## 🏆 Color Group Monopoly Bonus

Owning all properties in a color group grants a **2× base rent** multiplier (no houses needed).

### How it works
* `computeRent()` in `core.ts` already computes the monopoly bonus: if all `colorGroup` properties share the same `owner` and none are mortgaged, `rent[0] * 2` is returned.
* The **PropertyCard** (`PropertyCard.tsx`) now shows a **Color Group Bonus** section:
  * Color stripe header bar with the group's CSS color class.
  * `colorGroup` badge (e.g., "brown") in the card header.
  * List of all properties in the group with live ownership status.
  * Yellow "🏆 MONOPOLY — [Player] earns 2× base rent" banner when achieved.
  * Grey "Own all N for 2× base rent bonus" hint when not achieved.
* The `allProperties?: Property[]` prop on `PropertyCard` provides the full board context for live group status.
* **Editable via Property Editor**: the `colorGroup` field can be changed in the GameConsole Properties tab, reassigning which monopoly group a property belongs to for that session.

---

## ⚙️ PassGO Income Model

When a player completes a full lap of the board (position wraps past 0), they receive **10% of their current cash balance** (rounded to the nearest ₹1,000) instead of a flat reward, subject to a floor of the `settings.passGoReward` amount (default ₹200,000).

```
passGoBonus = max( round(balance × 0.10 / 1000) × 1000, passGoReward )
```

This means:
- Wealthy players earn more when passing GO, incentivising continued play.
- Players on low cash still get at least the flat reward as a safety net.
- A `passGo` game event is emitted with the exact amount.

---

## 🎨 Player Token Colour System

Player tokens use a **dedicated palette** that is visually distinct from the 8 board property colour groups (brown, lightBlue, pink, orange, red, yellow, green, darkBlue):

| Token | Colour | Hex | Notes |
|---|---|---|---|
| 🌊 Cyan | Default P1 | `#06B6D4` | Picker option 1 |
| ⚡ Purple | P2 | `#9333EA` | Picker option 2 |
| 🌹 Rose | P3 | `#F43F5E` | Picker option 3 |
| ⭐ Amber | P4 | `#F59E0B` | Picker option 4 |
| 🍀 Emerald | P5 | `#10B981` | Picker option 5 |
| 🔮 Fuchsia | P6 | `#E879F9` | Picker option 6 — replaced former Violet (`#8B5CF6`) to eliminate duplicate purple |
| 🤖 Neon Magenta | Bot Noob | `#FF0090` | **Not in picker palette** — always unique |

**Bot Noob always uses `#FF0090`** (neon magenta), which is distinct from all 6 player options and from all 8 board property color groups.

Players choose their token from the colour picker **before entering the lobby** — both the Create Lobby and Join Lobby forms show 6 swatch circles. The selected colour and icon are passed through `onCreateLobby` / `onJoinLobby` props and stored in the `Player` record.

### Property Group Colours (board stripes)

Stored as named keys in `colorGroupHex` (MonopolyBoardLayout) and `colorGroupHex` (PropertyCard). The board renders these as **inline CSS `backgroundColor`** (not Tailwind classes), which means the Property Editor can store **any arbitrary `#RRGGBB` hex value** in `property.colorGroup` and it will render correctly on the board and in PropertyCard.

| Key | Hex | Board group |
|---|---|---|
| `brown` | `#8B4513` | Delhi / Patna |
| `lightBlue` | `#87CEFA` | Mumbai / Pune / Nashik |
| `pink` | `#FF69B4` | Bangalore / Mysore / Mangalore |
| `orange` | `#FF8C00` | Chennai / Coimbatore / Madurai |
| `red` | `#EF4444` | Kolkata / Durgapur / Siliguri |
| `yellow` | `#FFD700` | Gurgaon / Noida / Faridabad |
| `green` | `#22C55E` | Hyderabad / Secunderabad / Warangal |
| `darkBlue` | `#1D4ED8` | Indore / Bhopal |

Any `#hex` value stored in `property.colorGroup` is auto-detected and rendered via inline style.

---

## 🏢 Team Mode (Non-Spectator Alliance)

Teams now keep **both players fully active** — no merging, no spectator assignment.

### How it works
* `createTeam` creates a team and assigns `teamId` to the creator's `Player` record.
* `joinTeam` adds the joiner to `team.members` and updates their `teamId` — both players keep their own balance, properties, and turns.
* **Combined Wealth** is displayed in the `TeamPanel` (sum of all member balances).
* **Monopoly Bonus Synergy**: the `TeamPanel` UI notes that colour group bonuses count across teammates' properties. (Full engine-level synergy for cross-team monopoly rent multiplier is tracked as a future enhancement — the existing `computeRent` path already handles colour group monopoly; teams sharing colour groups naturally benefit if one buys a property adjacent to a teammate's.)

### UI (TeamPanel.tsx)
* **Not in a team**: Shows "Create Team" form and a list of open teams with combined team wealth.
* **In a team**: Shows each member's name, individual balance, and a "Combined Wealth" total. Accepts `players?: Player[]` prop for member details.

---

---

## 🎨 Token Colour System (v1.0.9.7)

The six picker tokens were updated to be fully distinct — the former "Violet" (`#8B5CF6`) was too close to "Purple" (`#9333EA`). It is now **Fuchsia** (`#E879F9`). Each token also has a unique emoji icon:

| Token | Colour | Hex | Icon |
|---|---|---|---|
| 🌊 Cyan | Default P1 | `#00C8E0` | Wave — vivid cyan |
| ⚡ Violet | P2 | `#7C3AED` | Lightning — deep indigo-violet |
| 🌹 Rose | P3 | `#F43F5E` | Rose |
| ⭐ Amber | P4 | `#F59E0B` | Star |
| 🍀 Emerald | P5 | `#10B981` | Clover — unchanged (user favourite) |
| 🔮 Pink | P6 | `#EC4899` | Crystal Ball — hot pink, distinct from violet |

---

## 🔒 Jail Mechanics (v1.0.9.7)

**Pay-to-leave system**: A jailed player cannot simply roll and continue — on their turn they must choose between paying bail or staying in jail.

- **Bail fine** = 20% of the player's total current property income (sum of active rent tiers across all non-mortgaged owned properties).
- `payJailFine()` in `useGameLogic.ts` computes the fine using `computePlayerIncome()` from `core.ts`, deducts it, and sets `isInJail: false`.
- `skipJailTurn()` decrements `jailTurns` and marks `turnState: 'completed'`.
- The **Jail Dialog** renders inside the board overlay whenever `isMyTurn && myPlayer.isInJail && turnState === 'waiting_for_roll'`.
- **Jailed owners cannot collect rent**: `movePlayer()` in `core.ts` checks if the property owner is `isInJail` before creating `pendingRent`; jailed owners are skipped entirely.

---

## 🎲 Chance & Community Chest (v1.0.9.7)

Chance and Community Chest no longer use a shuffled deck. Instead they use an **income-based roll system**:

- A `?` symbol renders over each Chance/CC tile on the board (yellow tinted background).
- When a player lands on one, `movePlayer()` in `core.ts` calls `computePlayerIncome()` and stores a `PendingCard` in `GameState.pendingCard`:
  - `isReward = diceRoll % 2 !== 0` (odd = reward, even = penalty)
  - `amount = Math.round(totalIncome × 0.10)`
- The `PendingCard` dialog in `MonopolyGame.tsx` shows the income math and a Collect/Pay button.
- `resolveCard()` in `useGameLogic.ts` applies the balance change and clears `pendingCard`.

### `PendingCard` schema
```typescript
{ type: 'chance' | 'community'; diceRoll: number; income: number; amount: number; isReward: boolean; numProperties: number }
```

---

## 👷 Workers Mode (v1.0.9.7)

An optional game config mode where players assign autonomous **workers** to owned properties. Workers auto-build one house each time their owner passes GO.

### Enabling
Toggle **Workers Mode** in the Lobby Settings dialog. Sets `GameSettings.workersEnabled = true`.

### Worker Data Model
```typescript
export interface Worker {
  id: string;
  ownerId: string;  // player ID
  propertyId: string;
  color: string;    // hex — range: black (#000) → #FFE5B4 (median) → white (#FFF)
}
```
Workers are stored in `GameState.workers[]`.

### Build Logic
In `movePlayer()` (`core.ts`), when `passedGo && settings.workersEnabled`:
- Iterates the current player's workers.
- For each assigned property: if `houses < 4`, increments by 1; if `houses === 4`, converts to hotel.
- One house per GO pass per worker.

### UI
- **👷 Workers** button in the game header (shown when `workersEnabled`).
- **Worker Assignment Panel** (Dialog): lists owned properties, color picker (black → `#FFE5B4` → white gradient + custom input), Assign / Recolor / Remove buttons.
- **WorkerFace** component (`MonopolyBoardLayout.tsx`): a tiny rounded face with blinking eyes rendered beside the property name. Uses `useEffect` for random blink timing. No other facial features.

---

## 🤖 v1.1.3 — Bot AI, Reconnection & Achievements

### Summary of all changes in this version

| Area | Change |
|---|---|
| **Version** | Bumped to v1.1.3 across lobby byline, rules footer, and arch.md |
| **Bot stale closures** | Bot automation in `MonopolyGame.tsx` now stores all called functions (`resolveCard`, `endTurn`, `payRent`, `payJailFine`, `skipJailTurn`, `purchaseProperty`, `skipPurchase`, `rollDiceForBot`, `acceptTradeOffer`, `rejectTradeOffer`) in `useRef` pairs. Timer callbacks call `ref.current()` instead of the captured closure, eliminating stale-function bugs (root cause of bot getting stuck on Chance / Community Chest). |
| **Bot trade interaction** | Bot Noob now automatically responds to trade offers addressed to it. A `useRef<Set<string>>` tracks already-responded offer IDs. After a 2–4 s human-like delay, the bot accepts if the value it receives is ≥ 85% of the value it gives (or with 25% random goodwill), otherwise rejects. |
| **Player reconnection** | `handleJoinLobby` now updates a reconnecting player's color and icon in Firestore when they rejoin with the same name but a different token selection, and explicitly sets `isActive: true`. The player ID is correctly restored so all game actions work immediately after reconnection. |
| **Achievements system** | New `src/lib/achievements.ts` defines 10 milestones (First Step, Landlord, Property Mogul, Millionaire, Cash King, Monopolist, Developer, Hotel Magnate, Deal Maker, Survivor). A `useEffect` in `MonopolyGame.tsx` checks conditions on each meaningful state change and persists unlocked IDs to `localStorage` keyed by player name. Unlocks trigger toast notifications. |
| **Achievements UI** | Trophy button `🏆 X/10` added to the game header. Clicking opens a dialog listing all achievements with lock/unlock visual states (greyed-out + grayscale when locked). |
| **Google Play note** | Google Play Games SDK is Android-only; web-based achievement persistence uses `localStorage` in v1.1.3. Firebase Auth + Firestore cloud sync can be layered in a future version using `mm_ach_{playerName}` as the key schema. |

---

## 🔧 v1.1.12 — live-test fixes + cleanup

**Live-test regressions fixed (v1.1.11):** Roll Dice was missing (empty `StageHost` element replaced the dice display — `MonopolyBoardLayout` now always renders `CentralDisplay` and layers `children` over it) and inert (`handleDiceRoll` closed over a stale `gamePhase`; added to deps) · **modal scroll lock removed** (`useBottomSheet` no longer sets `body{overflow:hidden}`; pending decisions no longer freeze the page) · "You's Turn" → "Your Turn". **Small items:** Bot Noob builds a house before rolling when it owns a full group and has 3× the cost in cash · hotel sell-back respects the 32-house supply (`canSellBuildingOn(..., supplyLimits)`, also in auto-liquidation) · drafts already work for the bot (bids run in the 'auction' phase). **Deleted unused panels:** `TradingSystem`, `GameLog`, `RentPaymentDialog`, `GameOverview`, `GameBoard`, `DiceRoller`, `Gameboard/`. Prompts: `UI_CARDS_PROMPT.md` (Runeterra-style property/event cards), `PLAYTEST_PROMPT.md` refreshed with the regressions above.

---

## 🔧 v1.1.11 — remaining kit pieces wired (`SheetsHost.tsx`)

`WorkersHost` (WorkersSheet), `TeamsHost` (TeamsSheet; team name via a prompt), `PortfolioHost` (PlayerSheet: cash, net worth, rank, true rent labels, Mortgage/Unmortgage with the engine's amounts and reasons when disabled), `TileSummaryStrip` (SelectedTileSummary). On phones/tablets (<1024px) tapping a tile shows a readable summary strip under the board with a Details button; "My properties" and "Teams" buttons open bottom sheets and the old PlayerPanel/TeamPanel are desktop-only. Desktop keeps tile-tap → details overlay. Not replaced: board cells (`PropertyTile` — the 11×11 board can't meet 44px targets on a phone, so the board stays a map with the summary strip as the accessible detail), `PlayerIdentity`/`CurrencyAmount` inside legacy panels.

---

## 🔧 v1.1.10 — UI kit wired in

Codex built `src/ui-kit/` (presentation-only; contract in `UI_KIT.md`). Wired via two adapters so rules stay in the hook: **`StageHost.tsx`** picks the ONE action that owns the board stage (jail → card → rent → own property → auction → purchase) and renders it with the kit's `ActionStage` + dialog bodies (phone = bottom sheet with a sticky action footer, desktop = centred stage); **`TradeHost.tsx`** maps GameState → `TradeSheet` (labels, lock reasons, expiry, recipient-only Accept). Also wired: `TurnStatus` strip (shared countdown), `GameOverCard` (+ host Rematch), `WaitingRoom`, `LogSheet`, `AuctionStatus` (one-tap bids, outbid state, seller Collect in the footer). Sheets on desktop sit in a right-hand `SheetDock`; the Game Log button drops below the sheets (z-90).

Behaviour changes: the **seller "Start auction" (custom starting bid) button is gone from the UI** — Pass now opens a bank auction automatically when auctions are on (the hook action `startAuction` still exists). The "make an offer on an owned tile" panel still uses the old `AuctionPanel`.

Not yet wired (kit components that exist): `PropertyTile`/`SelectedTileSummary` (phone board), `PlayerSheet`, `TeamsSheet`, `WorkersSheet`, `PlayerIdentity`/`CurrencyAmount` in the legacy panels.

---

## 🔧 v1.1.9 — Rule decisions + remaining features

**Decisions made (change in the named place if you disagree):** **A10** declining a property with auctions on → automatic **bank auction** (`skipPurchase`); the seller "Start auction" path (custom bid, proceeds to seller) still exists · **A11** seller start bid floor = 10% of market value (default 70%), enforced in `startAuction` · **A13** bankrupt tiles stay **neutral tiles** (historical owner kept, no rent/purchase); RulesPanel now says so · **A14** rent pending to a player who has since gone out is **waived** · **Teams** can only be formed in the first round (`turn < players.length`), TeamPanel shows the lock.

**New:** **Auto-liquidation** (`autoLiquidate`, `applyPayment(..., {liquidate:true})`): tax, card penalties and a timed-out rent first sell buildings (highest first, even-sell) then mortgage; an explicit *Declare bankruptcy* skips it · **Free Parking pot** (lobby toggle `freeParkingPot`; bank payments incl. jail fines feed `GameState.freeParkingPot`, landing collects) · **Supply limits** (toggle `supplyLimits`: 32 houses / 12 hotels, enforced for humans and workers) · **Spectators**: joining a running game adds a watch-only seat (`isSpectator`) · **Rematch** (host, after game over: same seats, fresh game, back to setup) · ended rooms linger 1 h before cleanup · pending trade offers capped at 5 per sender · **Server-clock estimate**: `lib/clock.ts` `serverNow()`; a Firestore `serverTimestamp()` probe per client sets the offset, every timer uses it · **Room membership**: `members.{uid}` on the room doc; `firestore.rules` now lets only seated uids update (a joiner may add exactly their own uid) · JS dice/hop animations honour reduced motion · dead `onSell`/`onTrade` stubs removed.

Still open: **A02** (a seated player can still write any state — needs a server/Cloud Functions), supply-limit rule for selling a hotel back to 4 houses, interactive playtest (`PLAYTEST_PROMPT.md`), the UI-kit redesign (`UI_KIT_PROMPT.md`) and wiring it in.

---

## 🔧 v1.1.8 — UI audit fixes (`UI_AUDIT_REPORT.md`)

**U01** the workers nudge replaced the whole centre stage (no Roll Dice in workers mode) → it is now a banner above the board (`MonopolyBoardLayout` also gained a non-replacing `stageOverlay` prop) · **U02** action panels: `m-auto` centring (no clipped headers) and a **bottom sheet on phones** (`max-sm:fixed`, `role="dialog"`) · **U05** `formatSignedMoney()` (`lib/utils.ts`): losses render `−$750,000` in log, toasts, centre display · **U07** `readableTextOn()` picks dark/light text on player-colour badges (white on cyan/amber failed AA) · **U08** board tiles show mortgaged (hatch + M), bankrupt/neutral (grey + X), larger owner dot, keyboard-operable tiles with labels · **U09** waiting room no longer overflows at 390px · **U10** persistent game-over card (winner/team, standings, Back to lobby; rematch intentionally absent) · **U04** 44px minimum touch target on coarse pointers (`index.css`, opt-out `.no-touch-min`, used by board tiles) · **U06** (part) tiles/mini cards are buttons, Escape closes property overlays, `role=dialog` on overlays, polite `aria-live` status region · **U12/U13** (part) mortgaged tiles say "Mortgaged · no rent", utilities "dice × …", mortgage/unmortgage amounts match the engine (50% of market value, +10%) · **U14** `prefers-reduced-motion` CSS · **U15** (part) aria-labels on icon-only header buttons.

Not done (design work for the GPT redesign): U03 phone board legibility, U11 auction hierarchy/ring, U16 trade form, U17 phone sheets/editor layout, dark-theming `RentPaymentDialog`, emoji→SVG icons, JS dice/hop reduced-motion, draft progress/eligibility reasons (needs new data).

---

## 🔧 v1.1.7 — Codex audit fixes

Source: `AUDIT_REPORT.md` (code review, not playtested). Fixed: **A01** host heartbeat no longer rewrites the whole room (only `lastUpdated`) · **A03** every callback now depends on `setGameState`, which itself is stable (reads local state through a ref) — reject/cancel trade, settings, property editor, save/reset were silently local-only after joining · **A04/A05** jail pay/stay/card and `resolveCard` validate actor + the turn the click was made on inside the transaction; the blind "advance if blocked" fallback is gone · **A06** only the addressed player can accept/decline a trade, only the sender can withdraw · **A07** workers use `canBuildHouseOn/HotelOn` (full group, even build) and assignment is live-validated · **A08** `withActor` lets a human client drive the bot's turn · **A09** every active human can drive the draft (staggered by rank) · **A12** auctions are identified by `startTime`; bids/resolve carry it; a turn auction must come from the live purchase offer; only the seller can Collect early; sellers can't bid; bid log capped at 30 · **A15** one team membership per player, empty teams removed, win re-evaluated · **A16** bot answers every offer (timers no longer cancelled by later offers) · **A17** no-op writes skipped, write failures surface as a toast, expired offers pruned · **A18** error text no longer tells you to open the database · **A19** single-player runs the draft queue · **A20** room `status` derived from phase on every write · **A21** timer expiry carries the deadline it was scheduled for · host reconnect regains host UI · the "waiting for players" early return moved below all hooks (hook-order crash) · GO minimum in `RulesPanel` uses the setting.

Open (need an owner rule decision): **A10** decline→auction automatic vs optional · **A11** minimum starting bid (70% shown, 10% accepted) · **A13** bankrupt tiles: neutral-with-historical-owner vs transfer · **A14** rent owed at arrival vs at payment · team consent policy. Architectural: **A02** per-action authorisation needs a server.

---

## 🔧 v1.1.6 — Half-built features completed + identity/auth

| Feature | Behaviour |
|---|---|
| **Doubles** | Roll doubles → same player rolls again (after resolving the move). `doubleCount` tracks the streak; **3rd double → Jail**. Jailed/bankrupt players don't re-roll. The extra roll clears `lastDiceRoll`, so idling out on it hands the turn over normally. Implemented in `rollDiceLogic` + `advanceTurn` (`core.ts`). |
| **Teams** | `sameTeam()`: teammates **don't pay each other rent** and **count towards each other's colour-group monopolies** (rent ×2, `computeRent(…, teamPlayers)`). **Win:** once any player is eliminated, the game ends when every survivor is on one team (`winnerTeamId`, win toast names the team). `Team.sharedBalance` is unused — Combined Wealth is derived. |
| **Get Out of Jail Free** | House rule: landing on Chance/Community Chest **on a double** also awards a card (`Player.jailCards`, `PendingCard.jailCard`). Jail dialog has *Use card*; Bot Noob uses it first. (Rule choice is arbitrary — change in `movePlayer`.) |
| **Trading buildings** | Standard rule: nothing in a colour group can be traded while any property in it has buildings (`hasBuildingsInGroup`). Enforced at create + accept; `TradingSystem` hides locked properties. |
| **Anonymous auth** | `firebase.ts` `authReady` signs every browser in anonymously (uid persisted by Firebase). Seats store `Player.uid`; **a name already bound to another uid can't be reclaimed** (impersonation fix). If the provider is off it resolves `null` and the app still runs. |
| **Firestore rules** | `firestore.rules`: signed-in only, ≤8 players, 40 properties, `hostUid` immutable, host-only delete, room id length. Rooms now carry `hostUid`. Deploy **after** enabling Anonymous auth (README → Firebase setup). |
| **Cleanup** | Unmounted `PreAuctionPanel.tsx` and the hook's duplicate `computeRent` removed. |

Still open: client-clock authority (`Date.now()` for timers), per-action authorisation (rules can't check game logic), Free Parking pot, supply limits, spectator-after-bankruptcy, rematch/room cleanup, tests runner.

---

## 🔧 v1.1.5 — Rules-Engine Audit Fixes (auction / trade / bankruptcy / draft)

Root cause theme: several flows lived only in React callbacks reading a *stale client copy* of state, so
multiplayer races and modded settings (auctions, trading, workers, mortgage) could corrupt the game.
All the fixes below validate against the **live transaction state** and share one rules module (`core.ts`).

| Area | Bug | Fix |
|---|---|---|
| **Auction draft (auctionsEnabled)** | Game entered `gamePhase:'auction'` and **never left it** — nothing drove the draft (`PreAuctionPanel` is not mounted), and turn auto-advance / turn timer / bots / jail dialog are all gated on `'playing'`. Every auction-mode game was half-broken. | `nextDraftStep()` in `useGameLogic.ts`: host client auctions each `settings.preAuctionProperties` entry in turn (consumed from the queue so unsold ones aren't retried), then flips to `'playing'` with player 1 first. No draft properties → straight to play. `startPreAuction` no longer requires `gameMode==='auction'`. Draft auctions don't consume a turn. |
| **Auction vs turn timer** | 60 s turn timer < 120 s auction → turn advanced mid-auction, then `endAuction` advanced again → a player was skipped. | Turn clock paused while `currentAuction` exists (`startAuction` nulls `turnEndTime`, auction end restarts it); `advanceTurn` is a no-op during an auction. |
| **Stale auction timer** | A client's `auctionTimer` stayed `0` after an auction; the next auction was ended instantly with no bids. | Countdown derived from `endTimestamp` in an effect that resets to `null` when no auction; `resolveAuction` rejects calls before `endTimestamp − 1.5 s`. The seller's "Collect" button uses `endAuctionNow` (forced). |
| **Bid races** | `placeBid` checked a stale balance/bid client-side; a lower bid could overwrite a higher one. | Re-validated inside the transaction: bidder active, balance, not already winning, `amount > currentBid` (first bid `>=` start), auction still open. |
| **Winner can't pay** | Winner's balance could go negative if they spent money during the auction. | `resolveAuction` checks the winner can still pay; otherwise "went unsold". |
| **Rent bankruptcy** | `payRent` just subtracted — balance went negative, player stayed in. Timer expiry **dodged rent entirely**. | `payRent` → engine `applyPayment` (bankruptcy). `advanceTurn` (`core.ts`) now `settlePending()`s rent / card before moving on. Rent dialog offers *Declare Bankruptcy* when unaffordable. |
| **Card penalty** | Could push balance negative without bankruptcy. | `resolvePendingCard()` (core) uses `applyPayment`. |
| **Bankruptcy consistency** | Two divergent implementations (hook transferred assets to creditor; core made them neutral tiles); creditor received money the payer didn't have. | Single `applyPayment` in core: creditor gets only available cash; assets → neutral inactive tiles (buildings cleared); workers removed; pending trades rejected; `bankrupt` event. Dead hook copy + dead `drawCard`/decks deleted. |
| **Trades** | `acceptTradeOffer` moved properties with no ownership/balance/expiry checks → could steal a property that had since been traded elsewhere, create negative cash, or duplicate ids. Offers were attributed to *current turn player* not the sender. | Full re-validation in the transaction (ownership, not in auction, both active, cash, expiry); invalid offers auto-cancelled with a log line; other pending offers touching moved properties are rejected; workers on moved properties removed; `tradingEnabled` enforced; resolved offers capped. |
| **Building rules** | Hotel counted as level 0 so one hotel froze building in the group; `sellHouse/sellHotel/buildHotel` had no ownership/monopoly check (could sell/build on **opponents'** properties); sell refund ignored progressive cost; mortgage allowed with buildings; `mortgageEnabled` ignored. | Rules centralised in `core.ts` (`buildLevel`, `canBuildHouseOn`, `canBuildHotelOn`, `canSellBuildingOn`, `mortgagePayout`, `unmortgageCost`); even-build/even-sell with hotel = level 5; every action validated in-transaction for the acting player. |
| **Join race** | `handleJoinLobby` was read-modify-write: two simultaneous joins overwrote each other and `player-${length+1}` collided after a removal. | Runs in `runTransaction`; id = max+1; rejects joins after start. Host remove-player also transactional. |
| **Misc** | Dice could be rolled outside `'playing'`; duplicate turn advances (timer + auto-advance + bot); disconnected current player stalled the table. | `advanceTurn(expectTurn)` is idempotent; any client takes over an expired turn after a 5 s grace; roll gated on phase. |

### Known gaps (open — see `AUDIT_PROMPT.md`)
Doubles / extra roll, team-mode win condition and shared-monopoly rent, out-of-jail cards, trading buildings,
client-clock authority (use Firestore `serverTimestamp`), name-based identity (reconnect-by-name impersonation),
open Firestore rules, no automated tests beyond `core.ts` scenario checks.

---

## 🔧 v1.1.4 — Turn-Timer & Multiplayer Bug Fixes

### Summary of all changes in this version

| Area | Change |
|---|---|
| **Version** | Bumped to v1.1.4 across lobby byline and arch.md |
| **Stale `turnEndTime` (root cause fix)** | Added `withFreshTimer()` helper in `useGameLogic.ts`. Every path that calls `advanceTurnLogic()` directly (`purchaseProperty`, `resolveCard`, `endAuction`) now also resets `turnEndTime` for the incoming player. Previously the new player inherited the PREVIOUS player's (possibly expired) timer epoch, causing the new turn to be immediately skipped by the timer effect. |
| **Auction end race condition** | `endAuction` now merges property transfer + turn advance into a single `setGameState` transaction. The existing `if (!prev.currentAuction) return prev` guard ensures only the first client to write wins; subsequent clients are no-ops. Removed the separate `advanceTurn()` call that all clients were firing independently. |
| **Turn timer initialization** | `turnEndTime` is now set on game start for both paths: single-player (`handleCreateLobby`) and multiplayer auto-start (`handleJoinLobby`). First turn now always has a countdown. |
| **Host "Start Game Now" button** | Setup screen now shows a green "🚀 Start Game Now (N players)" button for the host when ≥ 2 players have joined, eliminating the requirement to fill all `maxPlayers` slots before the game can begin. Fixes Workers mode and any scenario where the host wants to start early. |
| **Timer visible during jail/card dialogs** | Turn timer badge now appears inside the Jail dialog header and the Chance/Community Chest card dialog header (right-aligned). Previously the z-50 board overlay covered `CentralDisplay` which was the only place the timer rendered. |
| **Purchase overlay scoped to current player** | Board overlay (z-50) is no longer triggered for non-current players by `pendingPurchaseData`. Non-current players see the board normally while someone else is deciding to buy. Auctions still show to all players. |
| **Player presence in lobby** | Each player now sends a heartbeat to `playerPresence.{playerId}` in Firestore every 20 seconds. Setup screen shows "⚠️ Away" badge for players silent > 45 s. Host can click ✕ to remove an away player. |

---

## 🔧 v1.1.2 — Fixes & Trading Overhaul

### Summary of all changes in this version

| Area | Change |
|---|---|
| **Version** | Bumped to v1.1.2 |
| **Turn stuck / delays** | Auto-advance timer now uses a `useRef` for `advanceTurn` so Firestore heartbeat updates no longer reset the 2-second countdown; same fix applied to the turn-timer interval. |
| **Own-property landing** | `movePlayer` sets `turnState: 'waiting_for_action'` when landing on your own property. Board overlay shows "Build House / Hotel" + "End Turn" buttons (turn timer still applies). |
| **Trading — both parties** | `TradingSystem` now shows the target player's properties in a "Properties You're Requesting" section once a trading partner is selected. |
| **Trading — cancel** | Trade creator gets an ✕ button on their pending offer; `cancelTradeOffer` hook function removes the offer from state immediately. |
| **Trading — timer** | Expiry countdown badge removed from all trade offer cards. |
| **Players panel** | Overview table below the board is now sorted by net worth (descending, active players first). A "Net Worth" column (cash + property values) was added. |
| **Rent currency** | `formatCurrency` in `RentPaymentDialog` and `GameOverview` changed from Indian lakh notation (`$1.0L`) to western notation (`$1.00M` / `$500K`). |
| **Rent monopoly bonus** | `computeRent` now filters to `type === 'property'` tiles and requires all group properties to be un-mortgaged before applying the 2× multiplier (matches stated rules). `GameConsole` now saves `colorGroup` as `null` (not `''`) to preserve monopoly detection. |
| **Toast auto-dismiss** | Fixed `TransactionNotification` cleanup: the timer `Map` is cleared correctly on each effect run, so events auto-dismiss after 3 s instead of persisting forever. |
| **Worker costs** | Workers now deduct progressive costs when auto-building: Nth house on a property costs `houseCost × N`. A hotel costs `hotelCost`. Builds are skipped if the player cannot afford them. Manual `buildHouse` also uses the same progressive scaling. |
| **Worker assignment** | Assign button is disabled when it is not your turn or after you have rolled. A pulsing nudge tooltip appears in the board centre on your pre-roll phase to remind you. |

---

## 🎲 v1.1.1 — Animations, Panel Overhaul & Bug Fixes

### Summary of all changes in this version

| Area | Change |
|---|---|
| **Version** | Bumped to v1.1.1 across lobby byline, rules footer, and arch.md |
| **Dice animation** | `CentralDisplay.tsx` — spinning dot-face dice cycle at 80ms when `isRolling`; snap to actual result on land. `DieFace` SVG-dot component shows accurate pip layout for each value. Dice display is always visible once a roll has happened (even when the property action overlay covers the board centre). |
| **Token hop animation** | `MonopolyBoardLayout.tsx` — tokens step tile-by-tile at 333 ms/tile (3 tiles/sec). `displayPositions` ref tracks visual position; teleports (>12 tiles, e.g. Go to Jail) snap instantly. `isMoving` drives the existing `animate-bounce` on `AnimatedToken`. |
| **Toast auto-dismiss** | `TransactionNotification.tsx` — events auto-hide after **3 seconds** (was 10 s); close button now correctly removes the card via local `dismissedIds` state. Toast repositioned to `top-16` so it doesn't overlap the game header. |
| **Continue button fix** | `resolveCard` in `useGameLogic.ts` — null-pendingCard fallback now forcibly unblocks the turn (`advanceTurnLogic`). Guards use `?? 0` on `amount` to handle Firestore serialisation of zero. Local `cardResolved` flag in `MonopolyGame.tsx` instantly hides the dialog when clicked, giving responsive UI while the async Firestore transaction settles. |
| **Turn notification** | `MonopolyGame.tsx` — Web Audio API plays a 3-note ascending chord (C6→E6→G6) when it becomes the local player's turn; `document.title` switches to "🎲 It's YOUR Turn! — Monopoly Madness" and resets to "Monopoly Madness" otherwise. |
| **Player panel** | `PlayerPanel.tsx` — complete rehaul: properties displayed **2-per-row mini tiles** grouped by colour. Each tile expands inline to show full rent tier table, house/hotel costs, mortgage value, and Mortgage/Unmortgage button. Colour groups are **drag-to-reorder** via HTML5 drag API (the `colorOrder` state persists for the session). |
| **Metadata** | `index.html` — removed Loveable OG image/twitter handle; set proper `og:title`, `og:description`, and `twitter` tags for Monopoly Madness. Tab `<title>` = "Monopoly Madness". |

---

## 🌍 v1.0.9.8 — Global Edition

### Summary of all changes in this version

| Area | Change |
|---|---|
| **Properties** | All 22 city/utility/railroad names replaced with international cities (London, Paris, New York … Hong Kong) |
| **Currency** | All ₹ references replaced with $ across every component, hook, and engine file |
| **Starting balance** | $10,000,000 (was $1,500,000). passGoReward → $1,000,000; jailFine → $500,000 |
| **Lobby page** | Version badge updated; byline changed; feature highlight pills added; Active Lobbies always shows 'waiting' games; token conflict prevention when joining |
| **Chance/CC bug** | `resolveCard` now directly calls `advanceTurnLogic` (was relying on auto-advance useEffect which could miss); "Continue" button always advances turn |
| **Workers** | White smile added to WorkerFace (larger eyes, clear gap between eyes and smile); gradient bar removed from panel; description updated |
| **Board text** | `break-all` → `break-words` on property name cells; corner tiles (GO/Jail/Free Parking/Go to Jail) now clickable |
| **Auction** | Seller sees "Collect Bid" or "End Auction (turn passes)" button during live auction |
| **Property offers** | Offer panel only shows on my turn after rolling; Pass button advances turn; sends real TradeOffer; `offerDismissed` state prevents stale display |
| **Mortgage** | Landing on a mortgaged property owned by another player opens a "Buy at Mortgage Price" prompt (pendingPurchase path, purchaseProperty handles it) |
| **Bankruptcy** | Player with balance < 0 → inactive; properties become `isInactive: true` (neutral tiles, no rent, no purchase); toast shown to bankrupt player and all others |
| **Win condition** | `checkWinCondition` unchanged; win/loss toasts shown via `useToast` in MonopolyGame |
| **Header** | Removed Phase badge and Current Player CardContent; header is now a single compact row |

---

## 🏠 Property Purchase Offers (v1.0.9.8)

When a player lands on a property owned by another player, a **Purchase Offer** panel appears in the board center (alongside or after the rent dialog).

### Flow
- Panel triggers only when: it is the local player's turn **and** they have rolled (turnState ≠ `waiting_for_roll`) **and** the tile they are on is owned by someone else.
- The offer is sent as a `TradeOffer` via `createTradeOffer` (requestedProperties=[propertyId], offeredCash=amount, offeredProperties=[], requestedCash=0).
- The owner accepts or declines via the **Trading** panel (badge shown when pending offers exist).
- **Pass** button: dismisses the panel for the current landing. If turnState is `waiting_for_action` with no other pending items, also advances the turn.
- Panel auto-resets when the player moves to a new position.

### Auction Seller End-Early (v1.0.9.8)
- The player who initiated a turn auction now sees a **Collect / End Auction** button below the "waiting for bids" notice.
- If bids exist: button reads *Collect ₹{amount} from {bidder}* — clicks `endAuction()` immediately, awarding the property.
- If no bids: button reads *End Auction (no bids — turn passes)* — `endAuction()` still runs, property stays unowned and turn advances.

---

## 🚦 Developer Checklist for Modifications

Before committing any modifications, run through this quick checklist:

* [ ] **Strict Typing**: No using of `any` types for new state elements. Verify all shapes are described in `src/types/game.ts`.
* [ ] **Side-Effect-Free Engine**: Is `core.ts` completely free of window, canvas, animation, or browser-specific state calls? (All timers and animations belong exclusively in components or React effects).
* [ ] **Local-First Fallback**: Does the feature function correctly when `roomId` is undefined? (Verify that state updaters do not crash when Firestore refs are absent).
* [ ] **Conflict Prevention**: If a state change involves player balances, property transfers, or dice states, is it running inside a transaction wrapper (`runTransaction` inside `setGameState`)?
