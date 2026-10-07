import { useState, useCallback, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot, runTransaction, setDoc, getDoc } from 'firebase/firestore';
import {
  rollDiceLogic, handlePropertyPurchase, advanceTurn as advanceTurnLogic, computePlayerIncome,
  applyPayment, addEvent, resolvePendingCard, canBuildHouseOn, canBuildHotelOn, canSellBuildingOn, hasBuildingsInGroup,
  mortgagePayout, unmortgageCost, checkWinCondition
} from '../gameEngine/core';

// Advance turn AND always reset turnEndTime so the new player's timer is always fresh.
// Call this instead of advanceTurnLogic() directly whenever the turn should fully transition.
function withFreshTimer(prev: GameState): GameState {
  const next = advanceTurnLogic(prev);
  next.turnEndTime = (prev.settings.turnTimerDuration && prev.settings.turnTimerDuration > 0)
    ? Date.now() + (prev.settings.turnTimerDuration * 1000)
    : null;
  return next;
}
import {
  GameState,
  Property,
  Player,
  Auction,
  GameSettings,
  Team,
  AuctionBid,
  DiceRoll,
  GameEvent,
  GameMode,
  TradeOffer,
  Worker
} from '@/types/game';

const initialGameSettings: GameSettings = {
  gameMode: 'console',
  auctionsEnabled: true,
  teamsEnabled: true,
  mortgageEnabled: true,
  tradingEnabled: true,
  auctionDuration: 120,
  turnTimerDuration: 60,
  maxPlayers: 8,
  startingBalance: 10000000, // $10M starting balance
  passGoReward: 1000000,     // $1M minimum for passing GO
  jailFine: 500000,          // $500K to get out of jail
  allowPropertyEditing: true,
  isPrivate: false,
  gameType: 'standard',
  blindPickEnabled: false,
  preAuctionProperties: [],
  customPropertyLists: {
    'brown': ['prop-1', 'prop-3'],
    'lightBlue': ['prop-6', 'prop-8', 'prop-9'],
    'pink': ['prop-11', 'prop-13', 'prop-14'],
    'orange': ['prop-16', 'prop-18', 'prop-19'],
    'red': ['prop-21', 'prop-23', 'prop-24'],
    'yellow': ['prop-26', 'prop-27', 'prop-29'],
    'green': ['prop-31', 'prop-32', 'prop-34'],
    'darkBlue': ['prop-37', 'prop-39'],
    'railroads': ['prop-5', 'prop-15', 'prop-25', 'prop-35'],
    'utilities': ['prop-12', 'prop-28']
  }
};

const generateInitialProperties = (): Property[] => {
  const worldProperties = [
    // GO (position 0)
    { name: 'GO', type: 'special', colorGroup: undefined, rent: [0], position: 0 },

    // Brown Group (1-3)
    { name: 'London', type: 'property', colorGroup: 'brown', rent: [2000, 10000, 30000, 90000, 160000, 250000], position: 1 },
    { name: 'Community Chest', type: 'special', colorGroup: undefined, rent: [0], position: 2 },
    { name: 'Paris', type: 'property', colorGroup: 'brown', rent: [4000, 20000, 60000, 180000, 320000, 450000], position: 3 },

    // Income Tax (4)
    { name: 'Income Tax', type: 'special', colorGroup: undefined, rent: [0], position: 4 },

    // Railroad (5)
    { name: 'Orient Express', type: 'railroad', colorGroup: undefined, rent: [25000, 50000, 100000, 200000], position: 5 },

    // Light Blue Group (6-9)
    { name: 'New York', type: 'property', colorGroup: 'lightBlue', rent: [6000, 30000, 90000, 270000, 400000, 550000], position: 6 },
    { name: 'Chance', type: 'special', colorGroup: undefined, rent: [0], position: 7 },
    { name: 'Chicago', type: 'property', colorGroup: 'lightBlue', rent: [6000, 30000, 90000, 270000, 400000, 550000], position: 8 },
    { name: 'Los Angeles', type: 'property', colorGroup: 'lightBlue', rent: [8000, 40000, 100000, 300000, 450000, 600000], position: 9 },

    // Jail (10)
    { name: 'Jail', type: 'special', colorGroup: undefined, rent: [0], position: 10 },

    // Pink Group (11-14)
    { name: 'Tokyo', type: 'property', colorGroup: 'pink', rent: [10000, 50000, 150000, 450000, 625000, 750000], position: 11 },
    { name: 'Power Grid', type: 'utility', colorGroup: undefined, rent: [0], position: 12 },
    { name: 'Seoul', type: 'property', colorGroup: 'pink', rent: [10000, 50000, 150000, 450000, 625000, 750000], position: 13 },
    { name: 'Osaka', type: 'property', colorGroup: 'pink', rent: [12000, 60000, 180000, 500000, 700000, 900000], position: 14 },

    // Railroad (15)
    { name: 'Trans-Siberian Rail', type: 'railroad', colorGroup: undefined, rent: [25000, 50000, 100000, 200000], position: 15 },

    // Orange Group (16-19)
    { name: 'Dubai', type: 'property', colorGroup: 'orange', rent: [14000, 70000, 200000, 550000, 750000, 950000], position: 16 },
    { name: 'Community Chest', type: 'special', colorGroup: undefined, rent: [0], position: 17 },
    { name: 'Abu Dhabi', type: 'property', colorGroup: 'orange', rent: [14000, 70000, 200000, 550000, 750000, 950000], position: 18 },
    { name: 'Doha', type: 'property', colorGroup: 'orange', rent: [16000, 80000, 220000, 600000, 800000, 1000000], position: 19 },

    // Free Parking (20)
    { name: 'Free Parking', type: 'special', colorGroup: undefined, rent: [0], position: 20 },

    // Red Group (21-24)
    { name: 'Moscow', type: 'property', colorGroup: 'red', rent: [18000, 90000, 250000, 700000, 875000, 1050000], position: 21 },
    { name: 'Chance', type: 'special', colorGroup: undefined, rent: [0], position: 22 },
    { name: 'Berlin', type: 'property', colorGroup: 'red', rent: [18000, 90000, 250000, 700000, 875000, 1050000], position: 23 },
    { name: 'Rome', type: 'property', colorGroup: 'red', rent: [20000, 100000, 300000, 750000, 925000, 1100000], position: 24 },

    // Railroad (25)
    { name: 'Pan-Pacific Express', type: 'railroad', colorGroup: undefined, rent: [25000, 50000, 100000, 200000], position: 25 },

    // Yellow Group (26-29)
    { name: 'Sydney', type: 'property', colorGroup: 'yellow', rent: [22000, 110000, 330000, 800000, 975000, 1150000], position: 26 },
    { name: 'Melbourne', type: 'property', colorGroup: 'yellow', rent: [22000, 110000, 330000, 800000, 975000, 1150000], position: 27 },
    { name: 'Waterworks', type: 'utility', colorGroup: undefined, rent: [0], position: 28 },
    { name: 'Brisbane', type: 'property', colorGroup: 'yellow', rent: [24000, 120000, 360000, 850000, 1025000, 1200000], position: 29 },

    // Go to Jail (30)
    { name: 'Go to Jail', type: 'special', colorGroup: undefined, rent: [0], position: 30 },

    // Green Group (31-34)
    { name: 'São Paulo', type: 'property', colorGroup: 'green', rent: [26000, 130000, 390000, 900000, 1100000, 1275000], position: 31 },
    { name: 'Buenos Aires', type: 'property', colorGroup: 'green', rent: [26000, 130000, 390000, 900000, 1100000, 1275000], position: 32 },
    { name: 'Community Chest', type: 'special', colorGroup: undefined, rent: [0], position: 33 },
    { name: 'Mexico City', type: 'property', colorGroup: 'green', rent: [28000, 150000, 450000, 1000000, 1200000, 1400000], position: 34 },

    // Railroad (35)
    { name: 'Trans-Atlantic Rail', type: 'railroad', colorGroup: undefined, rent: [25000, 50000, 100000, 200000], position: 35 },

    // Chance (36)
    { name: 'Chance', type: 'special', colorGroup: undefined, rent: [0], position: 36 },

    // Dark Blue Group (37-39)
    { name: 'Singapore', type: 'property', colorGroup: 'darkBlue', rent: [35000, 175000, 500000, 1100000, 1300000, 1500000], position: 37 },
    { name: 'Luxury Tax', type: 'special', colorGroup: undefined, rent: [0], position: 38 },
    { name: 'Hong Kong', type: 'property', colorGroup: 'darkBlue', rent: [50000, 200000, 600000, 1400000, 1700000, 2000000], position: 39 }
  ];

  return worldProperties.map((prop, index) => ({
    id: `prop-${index}`,
    name: prop.name,
    type: prop.type as 'property' | 'railroad' | 'utility' | 'special',
    colorGroup: prop.colorGroup || null,
    baseValue: prop.type === 'property' ? prop.rent[0] * 10 : prop.type === 'railroad' ? 200000 : prop.type === 'utility' ? 150000 : 0,
    currentValue: prop.type === 'property' ? prop.rent[0] * 10 : prop.type === 'railroad' ? 200000 : prop.type === 'utility' ? 150000 : 0,
    rent: prop.rent,
    mortgageValue: prop.type === 'property' ? prop.rent[0] * 5 : prop.type === 'railroad' ? 100000 : prop.type === 'utility' ? 75000 : 0,
    houseCost: prop.type === 'property' ? prop.rent[0] * 5 : null,
    hotelCost: prop.type === 'property' ? prop.rent[0] * 5 : null,
    houses: 0,
    hasHotel: false,
    isOwned: false,
    isMortgaged: false,
    isInAuction: false,
    isInactive: false,
    position: prop.position,
    description: `${prop.name} — ${prop.type === 'property' ? 'Property' : prop.type === 'railroad' ? 'Railroad' : prop.type === 'utility' ? 'Utility' : 'Special'}`
  }));
};

const generateInitialPlayers = (): Player[] => {
  const playerNames = ['You', 'Alice', 'Bob', 'Charlie'];
  const colors = ['#06B6D4', '#F43F5E', '#F59E0B', '#10B981']; // cyan, rose, amber, emerald
  const icons = ['🔵', '🌸', '🔶', '💚'];

  return playerNames.map((name, index) => ({
    id: `player-${index + 1}`,
    name,
    balance: initialGameSettings.startingBalance,
    properties: [],
    position: 0, // All start at GO
    color: colors[index],
    isActive: true,
    isInJail: false,
    jailTurns: 0,
    pieceIcon: icons[index],
    discoveredProperties: [0] // Always discover GO
  }));
};

export const getInitialState = (): GameState => ({
    properties: generateInitialProperties(),
    players: generateInitialPlayers(),
    teams: [],
    currentAuction: null,
    settings: initialGameSettings,
    gamePhase: 'setup',
    turn: 0,
    currentPlayer: 'player-1',
    lastDiceRoll: null,
    gameEvents: [],
    doubleCount: 0,
    turnEndTime: null,
    pendingPurchase: null,
    winnerId: null,
    turnState: 'waiting_for_roll',
    preAuctionPhase: false,
    consoleOpen: true,
    tradeOffers: [],
    pendingRent: null,
    pendingCard: null,
    workers: []
  });

export const useGameLogic = (roomId?: string, localPlayerId?: string) => {
    const [gameStateInternal, setGameStateInternal] = useState<GameState | null>(null);

  useEffect(() => {
    if (!roomId) return;
    const roomRef = doc(db, 'games', roomId);
    let isMounted = true;
    
    // Create room if it doesn't exist
    getDoc(roomRef).then(snap => {
      if (!snap.exists()) {
        const initialStateToUse = gameStateInternal || getInitialState();
        setDoc(roomRef, { gameState: initialStateToUse, status: 'waiting' });
      }
    });

    const unsubscribe = onSnapshot(roomRef, (snap) => {
      if (snap.exists() && isMounted) {
        setGameStateInternal(snap.data().gameState);
      }
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [roomId]);

  // Latest local copy, read through a ref so setGameState keeps a stable identity
  const stateRef = useRef<GameState | null>(null);
  stateRef.current = gameStateInternal;

  const setGameState = useCallback((updater: any) => {
    if (!roomId) {
      setGameStateInternal(prev => {
        const currentState = prev || getInitialState();
        return typeof updater === 'function' ? updater(currentState) : updater;
      });
      return;
    }
    const roomRef = doc(db, 'games', roomId);
    runTransaction(db, async (transaction) => {
      const snap = await transaction.get(roomRef);
      if (!snap.exists()) {
        // Just created, doc not ready, write it here manually:
        const currentState = stateRef.current || getInitialState();
        let nextState = typeof updater === 'function' ? updater(currentState) : updater;
        transaction.set(roomRef, { gameState: nextState, status: 'waiting' });
        return;
      }
      const currentState = snap.data().gameState;
      let nextState = typeof updater === 'function' ? updater(currentState) : updater;
      // An updater that returns its input made no change — don't write (every client races to resolve
      // auctions/turns, so most of those calls are expected no-ops)
      if (nextState === currentState) return;

      const updateData: any = { 
        gameState: nextState,
        lastUpdated: Date.now(),
        playerCount: nextState.players.length
      };

      // Keep the lobby-visible status in step with the phase
      updateData.status = nextState.gamePhase === 'ended' ? 'ended' : nextState.gamePhase === 'setup' ? 'waiting' : 'playing';

      transaction.update(roomRef, updateData);
    }).catch((e: any) => {
      console.error(e);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('mma:write-error', { detail: e?.code || String(e) }));
    });
  }, [roomId]);
  
  // Provide a fallback initial state for immediate render
  const gameState = gameStateInternal || getInitialState();
  

  const [auctionTimer, setAuctionTimer] = useState<number | null>(null);
  const [turnTimer, setTurnTimer] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);

  // Helper function to add game events
  const addGameEvent = useCallback((type: GameEvent['type'], player: string, message: string, amount?: number) => {
    const event: any = {
      id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      player,
      message,
      timestamp: Date.now()
    };
    if (amount !== undefined) {
      event.amount = amount;
    }
    
    setGameState(prev => ({
      ...prev,
      gameEvents: [...prev.gameEvents.slice(-19), event as GameEvent] // Keep last 20 events
    }));
  }, [setGameState]);

  // Dice rolling function
  const rollDice = useCallback((): DiceRoll => {
    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const total = dice1 + dice2;
    const isDouble = dice1 === dice2;
    
    return { dice1, dice2, total, isDouble };
  }, [setGameState]);

  // Advance the turn inside one transaction. `expectTurn` makes the call idempotent: if another client
  // (timer, auto-advance, bot, End Turn button) already advanced, the stale caller is a no-op.
  // Never advances mid-auction (the auction's own end advances) or outside the 'playing' phase.
  const advanceTurn = useCallback((expectTurn?: number, expectEnd?: number | null) => {
    setGameState((prev: GameState) => {
      if (prev.gamePhase !== 'playing' || prev.currentAuction) return prev;
      if (typeof expectTurn === 'number' && prev.turn !== expectTurn) return prev;
      // A roll refreshes the deadline without changing the turn, so a timer expiry submitted for the OLD
      // deadline must not end the freshly-rolled turn
      if (expectEnd !== undefined && (prev.turnEndTime ?? null) !== expectEnd) return prev;
      return withFreshTimer(prev);
    });
  }, [setGameState]);

  const endTurn = useCallback(() => {
    advanceTurn(gameState.turn);
  }, [advanceTurn, gameState.turn]);

  // The local player's id, falling back to whoever's turn it is (local/offline play)
  const actingId = (prev: GameState) => localPlayerId || prev.currentPlayer;


  const makeAuction = (property: Property, duration: number, startedBy?: string | null, customStartingBid?: number): Auction => {
    const startTime = Date.now();
    return {
      propertyId: property.id,
      startTime,
      duration,
      endTimestamp: startTime + duration * 1000,
      currentBid: customStartingBid !== undefined ? customStartingBid : Math.round(property.currentValue * 0.7),
      highestBidder: null,
      bids: [],
      isActive: true,
      startedBy: startedBy || null
    };
  };

  const startAuction = useCallback((propertyId: string, startedByName?: string, customStartingBid?: number) => {
    setGameState((prev: GameState) => {
      if (prev.currentAuction || !prev.settings.auctionsEnabled) return prev;
      // A turn auction must come from the live purchase offer, started by the player it was made to
      if (!prev.preAuctionPhase) {
        const pp = prev.pendingPurchase;
        if (prev.gamePhase !== 'playing' || !pp || pp.propertyId !== propertyId) return prev;
        const starter = prev.players.find(p => p.id === pp.playerId);
        if (!starter || (localPlayerId && !starter.isBot && starter.id !== localPlayerId)) return prev;
      }
      if (customStartingBid !== undefined && !(Number.isFinite(customStartingBid) && customStartingBid > 0)) return prev;
      const property = prev.properties.find(p => p.id === propertyId);
      if (!property || property.isOwned || property.isInAuction || property.isInactive || property.type === 'special') return prev;
      const auction = makeAuction(property, prev.settings.auctionDuration, startedByName, customStartingBid === undefined ? undefined : Math.round(customStartingBid));
      return {
        ...prev,
        currentAuction: auction,
        pendingPurchase: null,
        turnEndTime: null, // the turn clock is paused while an auction runs; endAuction restarts it
        properties: prev.properties.map(p => p.id === propertyId ? { ...p, isInAuction: true } : p)
      };
    });
  }, [setGameState, localPlayerId]);

  // ── Pre-game draft: auctions the host's preAuctionProperties one by one, then starts play ──
  // Idempotent: a no-op unless we are in the draft with no live auction.
  const nextDraftStep = (prev: GameState): GameState => {
    if (!prev.preAuctionPhase || prev.currentAuction || prev.gamePhase === 'ended') return prev;
    const queue = prev.settings.preAuctionProperties || [];
    const nextId = queue.find(id => {
      const p = prev.properties.find(pp => pp.id === id);
      return p && !p.isOwned && !p.isInAuction && !p.isInactive && p.type !== 'special';
    });
    if (nextId) {
      const property = prev.properties.find(p => p.id === nextId)!;
      return {
        ...prev,
        gamePhase: 'auction',
        currentAuction: makeAuction(property, prev.settings.auctionDuration, null),
        settings: { ...prev.settings, preAuctionProperties: queue.filter(id => id !== nextId) },
        properties: prev.properties.map(p => p.id === nextId ? { ...p, isInAuction: true } : p)
      };
    }
    const first = prev.players.find(p => p.isActive && !p.isSpectator) || prev.players[0];
    const started: GameState = {
      ...prev,
      gamePhase: 'playing',
      preAuctionPhase: false,
      currentPlayer: first.id,
      turnState: 'waiting_for_roll',
      lastDiceRoll: null,
      settings: { ...prev.settings, preAuctionProperties: [] },
      turnEndTime: prev.settings.turnTimerDuration && prev.settings.turnTimerDuration > 0
        ? Date.now() + prev.settings.turnTimerDuration * 1000 : null
    };
    return addEvent(started, 'move', first.name, 'Draft complete — the game begins!');
  };

  const advanceDraft = useCallback(() => {
    setGameState((prev: GameState) => nextDraftStep(prev));
  }, [setGameState]);

  // Every active human may drive the draft (the transition is idempotent) — staggered by rank so the
  // first human normally does it and the others only step in if that client has disconnected.
  const humanRank = localPlayerId
    ? gameState.players.filter(p => !p.isBot && !p.isSpectator && p.isActive).findIndex(p => p.id === localPlayerId)
    : -1;
  useEffect(() => {
    if (humanRank < 0 || !gameState.preAuctionPhase || gameState.currentAuction || gameState.gamePhase === 'ended') return;
    const t = setTimeout(() => advanceDraft(), 800 + humanRank * 2500);
    return () => clearTimeout(t);
  }, [humanRank, gameState.preAuctionPhase, gameState.currentAuction, gameState.gamePhase, advanceDraft]);

  // Handle dice roll and player movement
  const handleDiceRoll = useCallback(() => {
    // SECURITY & SYNC: Only allow current player to roll if it's their turn and no roll is in progress
    if (gameState.gamePhase !== 'playing' || gameState.currentPlayer !== localPlayerId || gameState.turnState !== 'waiting_for_roll' || isRolling) {
      console.warn("Dice roll rejected: Unauthorized or already rolling.");
      return;
    }

    const diceResult = rollDice(); // Pre-generate to avoid transaction retry randomness
    setIsRolling(true);
    
    // Simulate dice roll animation delay
    setTimeout(() => {
      setGameState((prev: GameState) => {
        // Double-check state inside transaction to prevent race conditions
        if (prev.currentPlayer !== localPlayerId || prev.turnState !== 'waiting_for_roll') {
          return prev;
        }
        const next = rollDiceLogic(prev, diceResult);
        if (next === prev) return prev;
        // Reset turn timer for the new sub-phase if needed
        if (prev.settings.turnTimerDuration && prev.settings.turnTimerDuration > 0) {
          next.turnEndTime = Date.now() + (prev.settings.turnTimerDuration * 1000);
        }
        return next;
      });
      setIsRolling(false);
    }, 800);
  }, [gameState.currentPlayer, gameState.turnState, localPlayerId, isRolling, setGameState, rollDice]);

  

  // Property randomization
  const randomizeProperties = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      properties: prev.properties.map(property => {
        if (!property.isOwned && property.type === 'property') {
          const variance = 0.3; // 30% variance
          const multiplier = 1 + (Math.random() - 0.5) * variance;
          const newValue = Math.round(property.baseValue * multiplier / 10000) * 10000;
          const newRent = property.rent.map(r => Math.round(r * multiplier / 1000) * 1000);
          
          return {
            ...property,
            currentValue: newValue,
            rent: newRent
          };
        }
        return property;
      })
    }));
    
    addGameEvent('move', 'Game Master', 'randomized all property values');
  }, [addGameEvent]);

  
  // Resolve the live auction in ONE transaction. `force` is only for the seller's "Collect" button;
  // timer-driven calls are ignored until the auction has really expired (guards stale-timer double-ends).
  const resolveAuction = useCallback((force: boolean, expectStart?: number) => {
    setGameState((prev: GameState) => {
      const a = prev.currentAuction;
      if (!a) return prev; // someone else already resolved it
      if (expectStart !== undefined && a.startTime !== expectStart) return prev; // a different (newer) auction
      if (force) {
        // Only the player who opened the auction may close it early
        const me = prev.players.find(p => p.id === localPlayerId);
        if (!a.startedBy || !me || me.name !== a.startedBy) return prev;
      }
      if (!force && Date.now() < a.endTimestamp - 1500) return prev;
      const property = prev.properties.find(p => p.id === a.propertyId);
      const bidder = a.highestBidder ? prev.players.find(p => p.name === a.highestBidder) : undefined;
      // Bidder must still be able to pay — their balance may have changed since they bid
      const sold = !!(bidder && bidder.isActive && bidder.balance >= a.currentBid && property && !property.isOwned);

      const properties = prev.properties.map(p => {
        if (p.id !== a.propertyId) return p;
        return sold ? { ...p, isInAuction: false, isOwned: true, owner: bidder!.name } : { ...p, isInAuction: false };
      });
      const players = sold
        ? prev.players.map(pl => {
            if (pl.id === bidder!.id) return { ...pl, balance: pl.balance - a.currentBid, properties: [...pl.properties, a.propertyId] };
            // Proceeds go to the player who opened the auction (none for the draft: the bank keeps it)
            if (a.startedBy && pl.name === a.startedBy) return { ...pl, balance: pl.balance + a.currentBid };
            return pl;
          })
        : prev.players;

      let next: GameState = { ...prev, properties, players, currentAuction: null };
      next = addEvent(next, 'auction', bidder?.name || a.startedBy || 'Bank',
        sold ? `won ${property?.name} for $${a.currentBid.toLocaleString('en-US')}`
             : `${property?.name ?? 'property'} went unsold`, sold ? -a.currentBid : undefined);

      // Draft auctions don't consume a turn — the draft driver starts the next one / begins play
      if (prev.preAuctionPhase) return next;
      return withFreshTimer(next);
    });
  }, [setGameState, localPlayerId]);

  const endAuction = useCallback(() => resolveAuction(false), [resolveAuction]);
  const auctionStart = gameState.currentAuction?.startTime;
  const endAuctionNow = useCallback(() => resolveAuction(true, auctionStart), [resolveAuction, auctionStart]);
  const resolveAuctionRef = useRef(resolveAuction);
  useEffect(() => { resolveAuctionRef.current = resolveAuction; }, [resolveAuction]);

  // Auction countdown derived from the shared endTimestamp. Resets cleanly when no auction is live
  // (a stale 0 from the previous auction used to end the next one instantly).
  useEffect(() => {
    const a = gameState.currentAuction;
    if (!a) { setAuctionTimer(null); return; }
    const tick = () => {
      const ms = a.endTimestamp - Date.now();
      setAuctionTimer(Math.max(0, Math.ceil(ms / 1000)));
      if (ms <= 0) resolveAuctionRef.current(false, a.startTime);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [gameState.currentAuction?.endTimestamp, gameState.currentAuction?.propertyId]);

  // Stable ref so the auto-advance timers are not reset by unrelated state updates (e.g. Firestore heartbeats)
  const advanceTurnRef = useRef(advanceTurn);
  useEffect(() => { advanceTurnRef.current = advanceTurn; }, [advanceTurn]);

  // Turn timer. The current player advances their own turn at 0; if they've gone away, any other
  // client takes over after a 5 s grace so the game can never stall on a disconnected player.
  // Paused during auctions.
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    if (gameState.turnEndTime && gameState.gamePhase === 'playing' && !gameState.currentAuction) {
      const endAt = gameState.turnEndTime;
      const turnAtStart = gameState.turn;
      const tick = () => {
        const ms = endAt - Date.now();
        setTurnTimer(Math.max(0, Math.floor(ms / 1000)));
        if (ms <= 0 && (gameState.currentPlayer === localPlayerId || ms < -5000)) {
          advanceTurnRef.current(turnAtStart, endAt);
        }
      };
      tick();
      interval = setInterval(tick, 1000);
    } else {
      setTurnTimer(null);
    }

    return () => { if (interval) clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.turnEndTime, gameState.gamePhase, gameState.currentPlayer, gameState.turn, !!gameState.currentAuction, localPlayerId]);

  // Automatic turn advancement when status is 'completed'
  useEffect(() => {
    if (gameState.turnState === 'completed' && gameState.gamePhase === 'playing' && !gameState.currentAuction && gameState.currentPlayer === localPlayerId) {
      const turnAtStart = gameState.turn;
      const timer = setTimeout(() => {
        advanceTurnRef.current(turnAtStart);
      }, 2000);
      return () => clearTimeout(timer);
    }
  // Deliberately omit advanceTurn — use ref to prevent Firestore updates from resetting the timer
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.turnState, gameState.gamePhase, gameState.currentPlayer, gameState.turn, !!gameState.currentAuction, localPlayerId]);

  const expectStart = gameState.currentAuction?.startTime;
  const placeBid = useCallback((amount: number, bidderId?: string) => {
    const biddingPlayerId = bidderId || localPlayerId || gameState.currentPlayer;
    if (!Number.isFinite(amount) || amount <= 0) return;
    amount = Math.round(amount);
    setGameState((prev: GameState) => {
      const a = prev.currentAuction;
      if (!a) return prev;
      if (expectStart !== undefined && a.startTime !== expectStart) return prev; // intended for an earlier auction
      const bidder = prev.players.find(p => p.id === biddingPlayerId);
      if (!bidder || !bidder.isActive || bidder.isSpectator || bidder.balance < amount) return prev;
      if (a.highestBidder === bidder.name) return prev;                       // already winning
      if (a.startedBy && bidder.name === a.startedBy) return prev;            // the seller can't bid on their own auction
      if (Date.now() > a.endTimestamp + 1000) return prev;                    // bidding closed
      if (a.highestBidder ? amount <= a.currentBid : amount < a.currentBid) return prev; // lost a bid race / too low

      const now = Date.now();
      const bid: AuctionBid = { player: bidder.name, amount, timestamp: now };
      return {
        ...prev,
        currentAuction: {
          ...a,
          currentBid: amount,
          highestBidder: bidder.name,
          endTimestamp: now + Math.max(a.endTimestamp - now, 15000), // a late bid extends the clock to >= 15 s
          bids: [...a.bids, bid].slice(-30) // keep the room document small
        }
      };
    });
  }, [setGameState, localPlayerId, gameState.currentPlayer, expectStart]);

  const purchaseProperty = useCallback((propertyId: string) => {
    setGameState((prev: GameState) => {
      if (prev.gamePhase !== 'playing') return prev;
      // Must match the offer that was actually made to the current player
      const pending = prev.pendingPurchase;
      if (!pending || pending.propertyId !== propertyId || pending.playerId !== prev.currentPlayer) return prev;
      const property = prev.properties.find(p => p.id === propertyId);
      const buyer = prev.players.find(p => p.id === prev.currentPlayer);
      if (!property || !buyer || !buyer.isActive) return prev;

      // Buying a mortgaged property from its current owner at its mortgage value
      if (property.isMortgaged && property.isOwned) {
        const price = mortgagePayout(property);
        if (buyer.balance < price) return prev;
        const prevOwner = property.owner;
        const newProperties = prev.properties.map(p =>
          p.id === propertyId ? { ...p, owner: buyer.name, isMortgaged: false } : p
        );
        const newPlayers = prev.players.map(p => {
          if (p.id === buyer.id) return { ...p, balance: p.balance - price, properties: [...p.properties, propertyId] };
          if (p.name === prevOwner) return { ...p, balance: p.balance + price, properties: p.properties.filter(pid => pid !== propertyId) };
          return p;
        });
        const bought = addEvent({ ...prev, properties: newProperties, players: newPlayers, pendingPurchase: null },
          'purchase', buyer.name, `bought mortgaged ${property.name} for $${price.toLocaleString('en-US')}`, -price);
        return withFreshTimer(bought);
      }

      // Normal purchase
      const next = handlePropertyPurchase(prev, propertyId, buyer.id);
      return next !== prev ? withFreshTimer(next) : prev;
    });
  }, [setGameState]);

  const skipPurchase = useCallback(() => {
    setGameState((prev: GameState) => {
      const pending = prev.pendingPurchase;
      if (!pending) return prev;
      const property = prev.properties.find(p => p.id === pending.propertyId);
      const player = prev.players.find(p => p.id === pending.playerId);
      const next: GameState = { ...prev, pendingPurchase: null, turnState: 'completed' as const };
      return player && property ? addEvent(next, 'purchase', player.name, `passed on buying ${property.name}`) : next;
    });
    // Turn advancement is handled by the auto-advance useEffect (human) or bot useEffect (bot)
  }, [setGameState]);

  // ── Mortgage & building actions ────────────────────────────────────────────────
  // All validate against the LIVE transaction state (not the client's possibly stale copy) and act
  // only for the player whose turn it is.
  const withActor = (fn: (prev: GameState, actor: Player) => GameState) => (prev: GameState): GameState => {
    if (prev.gamePhase !== 'playing') return prev;
    const actor = prev.players.find(p => p.id === prev.currentPlayer);
    // The bot's turn is driven by a human client; otherwise only the player whose turn it is may act
    if (!actor || !actor.isActive || (localPlayerId && prev.currentPlayer !== localPlayerId && !actor.isBot)) return prev;
    return fn(prev, actor);
  };

  const mortgageProperty = useCallback((propertyId: string) => {
    setGameState(withActor((prev, actor) => {
      if (!prev.settings.mortgageEnabled) return prev;
      const property = prev.properties.find(p => p.id === propertyId);
      // Buildings must be sold before a property can be mortgaged
      if (!property || property.owner !== actor.name || property.isMortgaged || property.isInactive) return prev;
      if (property.houses > 0 || property.hasHotel) return prev;
      const payout = mortgagePayout(property);
      const next = {
        ...prev,
        properties: prev.properties.map(p => p.id === propertyId ? { ...p, isMortgaged: true } : p),
        players: prev.players.map(pl => pl.id === actor.id ? { ...pl, balance: pl.balance + payout } : pl)
      };
      return addEvent(next, 'mortgage', actor.name, `mortgaged ${property.name}`, payout);
    }));
  }, [setGameState, localPlayerId]);

  const unmortgageProperty = useCallback((propertyId: string) => {
    setGameState(withActor((prev, actor) => {
      if (!prev.settings.mortgageEnabled) return prev;
      const property = prev.properties.find(p => p.id === propertyId);
      if (!property || property.owner !== actor.name || !property.isMortgaged) return prev;
      const cost = unmortgageCost(property); // mortgage value + 10% interest
      if (actor.balance < cost) return prev;
      const next = {
        ...prev,
        properties: prev.properties.map(p => p.id === propertyId ? { ...p, isMortgaged: false } : p),
        players: prev.players.map(pl => pl.id === actor.id ? { ...pl, balance: pl.balance - cost } : pl)
      };
      return addEvent(next, 'mortgage', actor.name, `unmortgaged ${property.name}`, -cost);
    }));
  }, [setGameState, localPlayerId]);

  const canBuildHouse = useCallback((property: Property, ownerName: string) =>
    canBuildHouseOn(gameState.properties, property, ownerName), [gameState.properties]);

  const buildHouse = useCallback((propertyId: string) => {
    setGameState(withActor((prev, actor) => {
      const property = prev.properties.find(p => p.id === propertyId);
      if (!property || !canBuildHouseOn(prev.properties, property, actor.name)) return prev;
      // Progressive cost: the Nth house on a property costs houseCost * N
      const cost = (property.houseCost || 0) * (property.houses + 1);
      if (actor.balance < cost) return prev;
      const next = {
        ...prev,
        properties: prev.properties.map(p => p.id === propertyId ? { ...p, houses: p.houses + 1 } : p),
        players: prev.players.map(pl => pl.id === actor.id ? { ...pl, balance: pl.balance - cost } : pl)
      };
      return addEvent(next, 'build', actor.name, `built a house on ${property.name} for $${cost.toLocaleString('en-US')}`, -cost);
    }));
  }, [setGameState, localPlayerId]);

  const sellHouse = useCallback((propertyId: string) => {
    setGameState(withActor((prev, actor) => {
      const property = prev.properties.find(p => p.id === propertyId);
      if (!property || property.hasHotel || property.houses <= 0) return prev;
      if (!canSellBuildingOn(prev.properties, property, actor.name)) return prev;
      // Refund half of what that house cost (cost scales with its number)
      const refund = Math.round((property.houseCost || 0) * property.houses * 0.5);
      const next = {
        ...prev,
        properties: prev.properties.map(p => p.id === propertyId ? { ...p, houses: p.houses - 1 } : p),
        players: prev.players.map(pl => pl.id === actor.id ? { ...pl, balance: pl.balance + refund } : pl)
      };
      return addEvent(next, 'build', actor.name, `sold a house on ${property.name} for $${refund.toLocaleString('en-US')}`, refund);
    }));
  }, [setGameState, localPlayerId]);

  const buildHotel = useCallback((propertyId: string) => {
    setGameState(withActor((prev, actor) => {
      const property = prev.properties.find(p => p.id === propertyId);
      if (!property || !canBuildHotelOn(prev.properties, property, actor.name)) return prev;
      const cost = property.hotelCost || 0;
      if (actor.balance < cost) return prev;
      const next = {
        ...prev,
        properties: prev.properties.map(p => p.id === propertyId ? { ...p, hasHotel: true, houses: 0 } : p),
        players: prev.players.map(pl => pl.id === actor.id ? { ...pl, balance: pl.balance - cost } : pl)
      };
      return addEvent(next, 'build', actor.name, `built a hotel on ${property.name} for $${cost.toLocaleString('en-US')}`, -cost);
    }));
  }, [setGameState, localPlayerId]);

  const sellHotel = useCallback((propertyId: string) => {
    setGameState(withActor((prev, actor) => {
      const property = prev.properties.find(p => p.id === propertyId);
      if (!property || !property.hasHotel || !canSellBuildingOn(prev.properties, property, actor.name)) return prev;
      const refund = Math.round((property.hotelCost || 0) * 0.5);
      const next = {
        ...prev,
        properties: prev.properties.map(p => p.id === propertyId ? { ...p, hasHotel: false, houses: 4 } : p),
        players: prev.players.map(pl => pl.id === actor.id ? { ...pl, balance: pl.balance + refund } : pl)
      };
      return addEvent(next, 'build', actor.name, `sold a hotel on ${property.name} for $${refund.toLocaleString('en-US')}`, refund);
    }));
  }, [setGameState, localPlayerId]);

  // Save/Load
  const saveGame = useCallback(() => {
    const toSave = JSON.stringify(gameState);
    try { localStorage.setItem('mma:gameState', toSave); } catch {}
  }, [gameState]);

  const loadGame = useCallback(() => {
    try {
      const s = localStorage.getItem('mma:gameState');
      if (!s) return;
      const parsed: GameState = JSON.parse(s);
      setGameState(parsed);
    } catch {}
  }, [setGameState]);

  const resetGameToInitial = useCallback(() => {
    setGameState({
      properties: generateInitialProperties(),
      players: generateInitialPlayers(),
      teams: [],
      currentAuction: null,
      settings: initialGameSettings,
      gamePhase: 'setup',
      turn: 0,
      currentPlayer: 'player-1',
      lastDiceRoll: null,
      gameEvents: [],
      doubleCount: 0,
      pendingPurchase: null,
      winnerId: null,
      turnState: 'waiting_for_roll',
      preAuctionPhase: false,
      consoleOpen: false,
      tradeOffers: [],
      pendingRent: null,
      pendingCard: null,
      workers: []
    });
  }, [setGameState]);

  // One membership per player: moving to a team removes you from the old one, and empty teams disappear.
  // Win is re-evaluated because a membership change can leave every survivor on one team.
  const moveToTeam = (prev: GameState, playerId: string, teamId: string, newTeam?: Team): GameState => {
    const base = newTeam ? [...prev.teams, newTeam] : prev.teams;
    if (!base.some(t => t.id === teamId)) return prev;
    const teams = base
      .map(t => t.id === teamId
        ? { ...t, members: t.members.includes(playerId) ? t.members : [...t.members, playerId] }
        : { ...t, members: t.members.filter(m => m !== playerId) })
      .filter(t => t.members.length > 0);
    const players = prev.players.map(p => p.id === playerId ? { ...p, teamId } : p);
    return checkWinCondition({ ...prev, teams, players });
  };

  const createTeam = useCallback((teamName: string) => {
    const name = (teamName || '').trim().slice(0, 24);
    if (!name) return;
    setGameState((prev: GameState) => {
      const me = prev.players.find(p => p.id === (localPlayerId || prev.currentPlayer));
      if (!me || !me.isActive || !prev.settings.teamsEnabled) return prev;
      const newTeamId = `team-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      const newTeam: Team = { id: newTeamId, name, members: [me.id], sharedBalance: 0, color: me.color };
      return moveToTeam(prev, me.id, newTeamId, newTeam);
    });
  }, [setGameState, localPlayerId]);

  const joinTeam = useCallback((teamId: string) => {
    setGameState((prev: GameState) => {
      const me = prev.players.find(p => p.id === (localPlayerId || prev.currentPlayer));
      if (!me || !me.isActive || !prev.settings.teamsEnabled || me.teamId === teamId) return prev;
      return moveToTeam(prev, me.id, teamId);
    });
  }, [setGameState, localPlayerId]);

  const updateSettings = useCallback((newSettings: Partial<GameSettings>) => {
    setGameState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...newSettings }
    }));
  }, [setGameState]);

  // Game mode management
  const setGameMode = useCallback((mode: GameMode) => {
    setGameState((prev: GameState) => {
      const isStarting = mode !== 'console';
      const next: GameState = {
        ...prev,
        settings: { ...prev.settings, gameMode: mode },
        gamePhase: mode === 'auction' ? 'auction' : mode === 'console' ? 'setup' : 'playing',
        preAuctionPhase: mode === 'auction',
        consoleOpen: mode === 'console',
        turnState: 'waiting_for_roll'
      };
      if (isStarting && prev.settings.turnTimerDuration && prev.settings.turnTimerDuration > 0) {
        next.turnEndTime = Date.now() + (prev.settings.turnTimerDuration * 1000);
      }
      // 'auction' mode hands over to the draft driver (which also falls straight through to play when
      // the host picked no draft properties)
      return mode === 'auction' ? nextDraftStep(next) : next;
    });
  }, [setGameState]);

  // Begin the pre-game draft. Not gated on gameMode: the host can change gameMode in the editor and the
  // game must still start. With no draft properties this goes straight to play.
  const startPreAuction = useCallback(() => {
    setGameState((prev: GameState) => nextDraftStep({ ...prev, gamePhase: 'auction', preAuctionPhase: true, turnState: 'waiting_for_roll' }));
  }, [setGameState]);

  // Host skips whatever is left of the draft
  const endPreAuction = useCallback(() => {
    setGameState((prev: GameState) =>
      nextDraftStep({ ...prev, preAuctionPhase: true, currentAuction: null,
        properties: prev.properties.map(p => p.isInAuction ? { ...p, isInAuction: false } : p),
        settings: { ...prev.settings, preAuctionProperties: [] } }));
  }, [setGameState]);

  // Console management
  const toggleConsole = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      consoleOpen: !prev.consoleOpen
    }));
  }, [setGameState]);

  const updatePropertyList = useCallback((listName: string, propertyIds: string[]) => {
    setGameState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        customPropertyLists: {
          ...prev.settings.customPropertyLists,
          [listName]: propertyIds
        }
      }
    }));
  }, [setGameState]);

  const addPropertyToList = useCallback((listName: string, propertyId: string) => {
    setGameState(prev => {
      const currentList = prev.settings.customPropertyLists[listName] || [];
      if (currentList.includes(propertyId)) return prev;
      
      return {
        ...prev,
        settings: {
          ...prev.settings,
          customPropertyLists: {
            ...prev.settings.customPropertyLists,
            [listName]: [...currentList, propertyId]
          }
        }
      };
    });
  }, [setGameState]);

  const removePropertyFromList = useCallback((listName: string, propertyId: string) => {
    setGameState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        customPropertyLists: {
          ...prev.settings.customPropertyLists,
          [listName]: (prev.settings.customPropertyLists[listName] || []).filter(id => id !== propertyId)
        }
      }
    }));
  }, [setGameState]);

  const setPreAuctionProperties = useCallback((propertyIds: string[]) => {
    setGameState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        preAuctionProperties: propertyIds
      }
    }));
  }, [setGameState]);

  // Property editing
  const updateProperty = useCallback((propertyId: string, updates: Partial<Property>) => {
    setGameState(prev => ({
      ...prev,
      properties: prev.properties.map(p =>
        p.id === propertyId ? { ...p, ...updates } : p
      )
    }));
  }, [setGameState]);

  // Trading functions
  const createTradeOffer = useCallback((
    toPlayer: string,
    offeredProperties: string[],
    requestedProperties: string[],
    offeredCash: number,
    requestedCash: number
  ) => {
    setGameState((prev: GameState) => {
      if (!prev.settings.tradingEnabled) return prev;
      // The offer comes from the local player, not whoever's turn it happens to be
      const from = prev.players.find(p => p.id === actingId(prev));
      const to = prev.players.find(p => p.name === toPlayer);
      if (!from || !to || !from.isActive || !to.isActive || from.id === to.id) return prev;
      if (offeredCash < 0 || requestedCash < 0 || offeredCash > from.balance) return prev;
      const owns = (ids: string[], name: string) => ids.every(id => {
        const p = prev.properties.find(pp => pp.id === id);
        return p && p.owner === name && !p.isInAuction && !p.isInactive && !hasBuildingsInGroup(prev.properties, p);
      });
      if (!owns(offeredProperties, from.name) || !owns(requestedProperties, to.name)) return prev;

      const tradeOffer: TradeOffer = {
        id: `trade-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fromPlayer: from.name,
        toPlayer,
        offeredProperties,
        requestedProperties,
        offeredCash,
        requestedCash,
        status: 'pending',
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      };
      // Keep the doc small: drop old resolved offers, keep every pending one
      const now = Date.now();
      const live = prev.tradeOffers.map(o => o.status === 'pending' && now > o.expiresAt ? { ...o, status: 'rejected' as const } : o);
      const kept = live.filter(o => o.status === 'pending').concat(
        live.filter(o => o.status !== 'pending').slice(-10)
      );
      return addEvent({ ...prev, tradeOffers: [...kept, tradeOffer] }, 'trade', from.name,
        `offered trade to ${toPlayer}`, offeredCash - requestedCash);
    });
  }, [setGameState, localPlayerId]);

  // Everything is re-validated against the live state: ownership, balances, expiry. A stale offer
  // (a property moved since it was made) is cancelled instead of "stealing" it from a third player.
  const acceptTradeOffer = useCallback((offerId: string, acceptorName?: string) => {
    setGameState((prev: GameState) => {
      const offer = prev.tradeOffers.find(o => o.id === offerId);
      if (!offer || offer.status !== 'pending' || !prev.settings.tradingEnabled) return prev;

      const cancel = (reason: string): GameState => addEvent(
        { ...prev, tradeOffers: prev.tradeOffers.map(o => o.id === offerId ? { ...o, status: 'rejected' as const } : o) },
        'trade', offer.fromPlayer, `trade with ${offer.toPlayer} cancelled — ${reason}`);

      if (Date.now() > offer.expiresAt) return cancel('offer expired');
      const from = prev.players.find(p => p.name === offer.fromPlayer);
      // Only the player the offer was made to can accept it (the bot's reply is driven by a human client)
      const acceptor = prev.players.find(p => p.name === offer.toPlayer);
      if (acceptor && !acceptor.isBot && localPlayerId && acceptor.id !== localPlayerId) return prev;
      if (!from || !acceptor || !from.isActive || !acceptor.isActive || from.id === acceptor.id) return cancel('a player is no longer available');

      const owns = (ids: string[], name: string) => ids.every(id => {
        const p = prev.properties.find(pp => pp.id === id);
        return p && p.owner === name && !p.isInAuction && !p.isInactive;
      });
      const traded = [...offer.offeredProperties, ...offer.requestedProperties]
        .map(id => prev.properties.find(pp => pp.id === id));
      if (traded.some(p => p && hasBuildingsInGroup(prev.properties, p))) return cancel('sell the buildings in that colour group first');
      if (!owns(offer.offeredProperties, from.name) || !owns(offer.requestedProperties, acceptor.name)) return cancel('ownership changed');
      if (from.balance < offer.offeredCash) return cancel(`${from.name} can't cover the cash`);
      if (acceptor.balance < offer.requestedCash) return cancel(`${acceptor.name} can't cover the cash`);

      const moved = new Set([...offer.offeredProperties, ...offer.requestedProperties]);
      const properties = prev.properties.map(prop => {
        if (offer.offeredProperties.includes(prop.id)) return { ...prop, owner: acceptor.name };
        if (offer.requestedProperties.includes(prop.id)) return { ...prop, owner: from.name };
        return prop;
      });
      const players = prev.players.map(pl => {
        if (pl.id === from.id) {
          return { ...pl, balance: pl.balance - offer.offeredCash + offer.requestedCash,
            properties: [...pl.properties.filter(id => !offer.offeredProperties.includes(id)), ...offer.requestedProperties] };
        }
        if (pl.id === acceptor.id) {
          return { ...pl, balance: pl.balance + offer.offeredCash - offer.requestedCash,
            properties: [...pl.properties.filter(id => !offer.requestedProperties.includes(id)), ...offer.offeredProperties] };
        }
        return pl;
      });
      // Workers follow the property's owner, so drop workers on properties that changed hands
      const workers = (prev.workers || []).filter(w => !moved.has(w.propertyId));
      const tradeOffers = prev.tradeOffers.map(o => {
        if (o.id === offerId) return { ...o, status: 'accepted' as const, toPlayer: acceptor.name };
        // Any other pending offer touching a property that just moved is now invalid
        if (o.status === 'pending' && [...o.offeredProperties, ...o.requestedProperties].some(id => moved.has(id))) {
          return { ...o, status: 'rejected' as const };
        }
        return o;
      });
      return addEvent({ ...prev, properties, players, workers, tradeOffers }, 'trade', acceptor.name, `accepted trade from ${from.name}`);
    });
  }, [setGameState]);

  const rejectTradeOffer = useCallback((offerId: string) => {
    setGameState((prev: GameState) => {
      const o = prev.tradeOffers.find(x => x.id === offerId);
      if (!o || o.status !== 'pending') return prev;
      const to = prev.players.find(p => p.name === o.toPlayer);
      if (to && !to.isBot && localPlayerId && to.id !== localPlayerId) return prev; // only the recipient declines
      return { ...prev, tradeOffers: prev.tradeOffers.map(x => x.id === offerId ? { ...x, status: 'rejected' as const } : x) };
    });
  }, [setGameState, localPlayerId]);

  const cancelTradeOffer = useCallback((offerId: string) => {
    setGameState((prev: GameState) => {
      const o = prev.tradeOffers.find(x => x.id === offerId);
      if (!o) return prev;
      const from = prev.players.find(p => p.name === o.fromPlayer);
      if (from && localPlayerId && from.id !== localPlayerId) return prev; // only the sender withdraws
      return { ...prev, tradeOffers: prev.tradeOffers.filter(x => x.id !== offerId) };
    });
  }, [setGameState, localPlayerId]);

  // Rent payment. Goes through the engine's applyPayment so an unaffordable rent bankrupts the payer
  // (previously the balance just went negative and the player stayed in the game).
  const payRent = useCallback(() => {
    setGameState((prev: GameState) => {
      if (!prev.pendingRent) return prev;
      const { owner, amount, propertyId } = prev.pendingRent;
      const payer = prev.players.find(p => p.id === prev.currentPlayer);
      if (!payer) return prev;
      const property = prev.properties.find(p => p.id === propertyId);
      const couldPay = payer.balance >= amount;
      let next: GameState = { ...prev, pendingRent: null };
      next = applyPayment(next, payer.id, owner, amount, 'Rent');
      next = addEvent(next, 'rent', payer.name,
        couldPay ? `paid $${amount.toLocaleString('en-US')} rent to ${owner}${property ? ` for ${property.name}` : ''}`
                 : `couldn't cover $${amount.toLocaleString('en-US')} rent to ${owner}`, -amount);
      return next.gamePhase === 'ended' ? next : { ...next, turnState: 'completed' as const };
    });
    // Turn advancement handled by auto-advance useEffect (human) or bot useEffect (bot)
  }, [setGameState]);

  // Rent can never be skipped (the dialog disables the button); kept so the prop contract holds.
  const skipRent = payRent;

  // Jail actions compute everything inside the live updater and require the same turn the click was made on,
  // so a double-click or a late timeout can't charge twice or touch the next player.
  const payJailFine = useCallback(() => {
    const turnAtCall = gameState.turn;
    setGameState(withActor((prev, actor) => {
      if (prev.turn !== turnAtCall || !actor.isInJail || prev.turnState !== 'waiting_for_roll') return prev;
      const { income } = computePlayerIncome(prev.properties, actor.name);
      const fine = Math.round(income * 0.20);
      if (fine <= 0 || actor.balance < fine) return prev;
      const next = {
        ...prev,
        players: prev.players.map(p => p.id === actor.id ? { ...p, balance: p.balance - fine, isInJail: false, jailTurns: 0 } : p)
      };
      return addEvent(next, 'jail', actor.name, `paid $${fine.toLocaleString('en-US')} jail fine (20% of $${income.toLocaleString('en-US')} property income)`, -fine);
    }));
  }, [setGameState, localPlayerId, gameState.turn]);

  // Spend a Get Out of Jail Free card: free release, you still roll this turn
  const spendJailCard = useCallback(() => {
    const turnAtCall = gameState.turn;
    setGameState(withActor((prev, actor) => {
      if (prev.turn !== turnAtCall || !actor.isInJail || (actor.jailCards || 0) <= 0 || prev.turnState !== 'waiting_for_roll') return prev;
      const next = {
        ...prev,
        players: prev.players.map(p => p.id === actor.id ? { ...p, jailCards: (p.jailCards || 0) - 1, isInJail: false, jailTurns: 0 } : p)
      };
      return addEvent(next, 'jail', actor.name, 'used a Get Out of Jail Free card');
    }));
  }, [setGameState, localPlayerId, gameState.turn]);

  const skipJailTurn = useCallback(() => {
    const turnAtCall = gameState.turn;
    setGameState(withActor((prev, actor) => {
      if (prev.turn !== turnAtCall || !actor.isInJail || prev.turnState !== 'waiting_for_roll') return prev;
      const remaining = Math.max(0, (actor.jailTurns || 0) - 1);
      const next: GameState = {
        ...prev,
        players: prev.players.map(p => p.id === actor.id ? { ...p, jailTurns: remaining, isInJail: remaining > 0 } : p),
        turnState: 'completed' as const
      };
      return addEvent(next, 'jail', actor.name, remaining > 0 ? `stayed in jail (${remaining} turns left)` : 'released from jail (served time)');
    }));
  }, [setGameState, localPlayerId, gameState.turn]);

  // Compute jail fine amount for display
  const getJailFineAmount = useCallback((): { fine: number; income: number; numProperties: number } => {
    const cp = gameState.players.find(p => p.id === gameState.currentPlayer);
    if (!cp) return { fine: 0, income: 0, numProperties: 0 };
    const { income, numProperties } = computePlayerIncome(gameState.properties, cp.name);
    return { fine: Math.round(income * 0.20), income, numProperties };
  }, [gameState.currentPlayer, gameState.players, gameState.properties]);

  // Resolve pending card — only ever acts on a card that is still pending for the turn the click was made on
  const resolveCard = useCallback(() => {
    const turnAtCall = gameState.turn;
    setGameState((prev: GameState) => {
      if (!prev.pendingCard || prev.turn !== turnAtCall) return prev;
      const resolved = resolvePendingCard(prev);
      return resolved.gamePhase === 'ended' ? resolved : withFreshTimer(resolved);
    });
  }, [setGameState, gameState.turn]);

  // Workers: assign/remove — validated against the live state, on your own turn, before you roll
  const assignWorker = useCallback((propertyId: string, color: string) => {
    setGameState(withActor((prev, actor) => {
      if (!prev.settings.workersEnabled) return prev;
      const property = prev.properties.find(p => p.id === propertyId);
      if (!property || property.owner !== actor.name || property.type !== 'property' || property.isInactive) return prev;
      if ((prev.workers || []).some(w => w.propertyId === propertyId)) return prev;
      const newWorker: Worker = {
        id: `worker-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ownerId: actor.id,
        propertyId,
        color
      };
      return addEvent({ ...prev, workers: [...(prev.workers || []), newWorker] }, 'build', actor.name, `assigned a worker to ${property.name}`);
    }));
  }, [setGameState, localPlayerId]);

  const removeWorker = useCallback((propertyId: string) => {
    setGameState(withActor((prev, actor) => {
      const worker = (prev.workers || []).find(w => w.propertyId === propertyId);
      if (!worker || worker.ownerId !== actor.id) return prev;
      const property = prev.properties.find(p => p.id === propertyId);
      const next = { ...prev, workers: (prev.workers || []).filter(w => w.propertyId !== propertyId) };
      return property ? addEvent(next, 'build', actor.name, `removed worker from ${property.name}`) : next;
    }));
  }, [setGameState, localPlayerId]);

  const updateWorkerColor = useCallback((propertyId: string, color: string) => {
    setGameState((prev: GameState) => ({
      ...prev,
      workers: (prev.workers || []).map(w =>
        w.propertyId === propertyId && (!localPlayerId || w.ownerId === localPlayerId) ? { ...w, color } : w)
    }));
  }, [setGameState, localPlayerId]);

  // Bot dice roll — bypasses localPlayerId check, only works for isBot players
  const rollDiceForBot = useCallback(() => {
    if (gameState.gamePhase !== 'playing' || gameState.turnState !== 'waiting_for_roll') return;
    const cp = gameState.players.find(p => p.id === gameState.currentPlayer);
    if (!cp?.isBot) return;

    const diceResult = rollDice();
    setIsRolling(true);
    setTimeout(() => {
      setGameState((prev: GameState) => {
        const cpCheck = prev.players.find(p => p.id === prev.currentPlayer);
        if (!cpCheck?.isBot || prev.turnState !== 'waiting_for_roll') return prev;
        return rollDiceLogic(prev, diceResult);
      });
      setIsRolling(false);
    }, 800);
  }, [gameState.currentPlayer, gameState.turnState, gameState.gamePhase, gameState.players, rollDice]);

  return {
    gameState,
    auctionTimer,
    turnTimer,
    isRolling,
    randomizeProperties,
    startAuction,
    placeBid,
    endAuction,
    endAuctionNow,
    purchaseProperty,
    skipPurchase,
    mortgageProperty,
    unmortgageProperty,
    createTeam,
    joinTeam,
    updateSettings,
    handleDiceRoll,
    rollDiceForBot,
    buildHouse,
    sellHouse,
    buildHotel,
    sellHotel,
    endTurn,
    saveGame,
    loadGame,
    resetGame: resetGameToInitial,
    // New game mode functions
    setGameMode,
    startPreAuction,
    endPreAuction,
    toggleConsole,
    updatePropertyList,
    addPropertyToList,
    removePropertyFromList,
    setPreAuctionProperties,
    updateProperty,
    // Trading functions
    createTradeOffer,
    acceptTradeOffer,
    rejectTradeOffer,
    cancelTradeOffer,
    // Rent payment functions
    payRent,
    skipRent,
    // Jail functions
    payJailFine,
    skipJailTurn,
    spendJailCard,
    getJailFineAmount,
    // Card resolution
    resolveCard,
    // Worker functions
    assignWorker,
    removeWorker,
    updateWorkerColor,
    // Build eligibility check
    canBuildHouse,
    advanceDraft
  };
};
