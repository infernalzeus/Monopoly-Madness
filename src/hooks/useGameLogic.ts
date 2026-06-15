import { useState, useCallback, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot, runTransaction, setDoc, getDoc } from 'firebase/firestore';
import { rollDiceLogic, movePlayer, handlePropertyPurchase, advanceTurn as advanceTurnLogic, checkWinCondition, computeRent as computeRentLogic, computePlayerIncome } from '../gameEngine/core';
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
        const currentState = gameStateInternal || getInitialState();
        let nextState = typeof updater === 'function' ? updater(currentState) : updater;
        transaction.set(roomRef, { gameState: nextState, status: 'waiting' });
        return;
      }
      const currentState = snap.data().gameState;
      let nextState = typeof updater === 'function' ? updater(currentState) : updater;
      
      const updateData: any = { 
        gameState: nextState,
        lastUpdated: Date.now(),
        playerCount: nextState.players.length
      };

      // Also update top-level status if game ended
      if (nextState.gamePhase === 'ended') {
        updateData.status = 'ended';
      }

      transaction.update(roomRef, updateData);
    }).catch(console.error);
  }, [roomId, gameStateInternal]);
  
  // Provide a fallback initial state for immediate render
  const gameState = gameStateInternal || getInitialState();
  

  const [auctionTimer, setAuctionTimer] = useState<number | null>(null);
  const [turnTimer, setTurnTimer] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);

  // Chance and Community Chest decks (16 each). Simple representative effects.
  const chanceDeck = useState(() => shuffleArray([
    { id: 'ch-1', type: 'move', value: 0, message: 'Advance to GO (Collect $2,00,000)' },
    { id: 'ch-2', type: 'pay', value: 150000, message: 'Pay school fees of $1,50,000' },
    { id: 'ch-3', type: 'collect', value: 100000, message: 'Bank pays you dividend of $1,00,000' },
    { id: 'ch-4', type: 'move', value: 24, message: 'Advance to New Market' },
    { id: 'ch-5', type: 'jail', value: 0, message: 'Go to Jail' },
    { id: 'ch-6', type: 'outOfJail', value: 0, message: 'Get out of Jail free (keep until needed)' },
    { id: 'ch-7', type: 'collect', value: 50000, message: 'Your building loan matures – collect $50,000' },
    { id: 'ch-8', type: 'pay', value: 25000, message: 'Speeding fine – pay $25,000' },
    { id: 'ch-9', type: 'move', value: 11, message: 'Go to Brigade Road' },
    { id: 'ch-10', type: 'collect', value: 200000, message: 'You have won a crossword competition – collect $2,00,000' },
    { id: 'ch-11', type: 'pay', value: 100000, message: 'Pay income tax arrears of $1,00,000' },
    { id: 'ch-12', type: 'collect', value: 150000, message: 'Your stocks rise – collect $1,50,000' },
    { id: 'ch-13', type: 'move', value: 5, message: 'Take a trip on Mumbai Local – if you pass GO collect $2,00,000' },
    { id: 'ch-14', type: 'move', value: 39, message: 'Advance to DLF Phase 1' },
    { id: 'ch-15', type: 'collect', value: 50000, message: 'Insurance payout – collect $50,000' },
    { id: 'ch-16', type: 'pay', value: 50000, message: 'Doctor’s fees – pay $50,000' }
  ]))[0];
  const communityDeck = useState(() => shuffleArray([
    { id: 'cc-1', type: 'collect', value: 200000, message: 'Advance to GO (Collect $2,00,000)' },
    { id: 'cc-2', type: 'collect', value: 100000, message: 'You inherit $1,00,000' },
    { id: 'cc-3', type: 'pay', value: 50000, message: 'Pay hospital fees of $50,000' },
    { id: 'cc-4', type: 'collect', value: 50000, message: 'From sale of stock you get $50,000' },
    { id: 'cc-5', type: 'collect', value: 25000, message: 'Receive interest on 7% preference shares – $25,000' },
    { id: 'cc-6', type: 'jail', value: 0, message: 'Go to Jail' },
    { id: 'cc-7', type: 'outOfJail', value: 0, message: 'Get out of Jail free (keep until needed)' },
    { id: 'cc-8', type: 'pay', value: 25000, message: 'Pay education fees of $25,000' },
    { id: 'cc-9', type: 'collect', value: 50000, message: 'You have won second prize in a beauty contest – collect $50,000' },
    { id: 'cc-10', type: 'collect', value: 100000, message: 'Grand Opera Night – collect $1,00,000' },
    { id: 'cc-11', type: 'collect', value: 50000, message: 'Income tax refund – collect $50,000' },
    { id: 'cc-12', type: 'pay', value: 100000, message: 'Life insurance premium due – pay $1,00,000' },
    { id: 'cc-13', type: 'collect', value: 75000, message: 'Birthday gift – collect $75,000' },
    { id: 'cc-14', type: 'pay', value: 25000, message: 'Speeding fine – pay $25,000' },
    { id: 'cc-15', type: 'collect', value: 150000, message: 'Tax rebate – collect $1,50,000' },
    { id: 'cc-16', type: 'pay', value: 50000, message: 'Maintenance – pay $50,000' }
  ]))[0];
  const [heldOutOfJailCards, setHeldOutOfJailCards] = useState<Record<string, number>>({});

  // Helper function to add game events
  const addGameEvent = useCallback((type: GameEvent['type'], player: string, message: string, amount?: number) => {
    const event: any = {
      id: `event-${Date.now()}`,
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
  }, []);

  const advanceTurn = useCallback(() => {
    setGameState((prev: GameState) => {
      const next = advanceTurnLogic(prev);
      // Set turn end time if duration is configured
      if (prev.settings.turnTimerDuration && prev.settings.turnTimerDuration > 0) {
        next.turnEndTime = Date.now() + (prev.settings.turnTimerDuration * 1000);
      } else {
        next.turnEndTime = null;
      }
      return next;
    });
  }, [setGameState]);

  const endTurn = useCallback(() => {
    advanceTurn();
  }, [advanceTurn]);

  const getOwnedCount = useCallback((ownerName: string, filter: (p: Property) => boolean) => {
    return gameState.properties.filter(p => p.owner === ownerName && filter(p)).length;
  }, [gameState.properties]);

  const playerOwnsMonopoly = useCallback((ownerName: string, color: string) => {
    const group = gameState.properties.filter(p => p.type === 'property' && p.colorGroup === color);
    return group.length > 0 && group.every(p => p.owner === ownerName && !p.isMortgaged);
  }, [gameState.properties]);

  const computeRent = useCallback((property: Property, diceTotal: number | null) => {
    if (property.isMortgaged) return 0;
    if (property.type === 'railroad') {
      const ownerName = property.owner as string;
      const count = getOwnedCount(ownerName, p => p.type === 'railroad');
      const index = Math.max(1, Math.min(4, count)) - 1;
      return property.rent[index] || 0;
    }
    if (property.type === 'utility') {
      const ownerName = property.owner as string;
      const count = getOwnedCount(ownerName, p => p.type === 'utility');
      const mult = count >= 2 ? 10 : 4; // Standard rules: 4x or 10x dice total
      return (diceTotal || 0) * mult * 1000; // scale to thousands
    }
    if (property.type === 'property') {
      // rent array indexes: [base, 1h, 2h, 3h, 4h, hotel]
      if (property.hasHotel) return property.rent[5] || 0;
      if (property.houses > 0) return property.rent[property.houses] || 0;
      const hasMonopoly = property.colorGroup ? playerOwnsMonopoly(property.owner as string, property.colorGroup) : false;
      return hasMonopoly ? Math.round((property.rent[0] || 0) * 2) : (property.rent[0] || 0);
    }
    return 0;
  }, [getOwnedCount, playerOwnsMonopoly]);

  const applyPayment = useCallback((fromId: string, toPlayerName: string | null, amount: number, reason: string) => {
    setGameState(prev => {
      let players = [...prev.players];
      const payerIdx = players.findIndex(p => p.id === fromId);
      if (payerIdx === -1) return prev;
      let payer = players[payerIdx];
      payer = { ...payer, balance: payer.balance - amount };
      players[payerIdx] = payer;

      if (toPlayerName) {
        const receiverIdx = players.findIndex(p => p.name === toPlayerName);
        if (receiverIdx !== -1) {
          players[receiverIdx] = { ...players[receiverIdx], balance: players[receiverIdx].balance + amount };
        }
      }

      // Check bankruptcy
      if (payer.balance < 0) {
        // Transfer all properties to creditor if exists, else mortgage to bank and remove
        const creditorName = toPlayerName;
        const payerName = payer.name;
        const transferredProps = prev.properties.map(prop => {
          if (prop.owner === payerName) {
            if (creditorName) {
              return { ...prop, owner: creditorName };
            }
            return { ...prop, owner: null, isOwned: false, isMortgaged: false, houses: 0, hasHotel: false };
          }
          return prop;
        });

        players[payerIdx] = { ...payer, isActive: false };

        const activePlayers = players.filter(p => p.isActive);
        const winnerId = activePlayers.length === 1 ? activePlayers[0].id : null;

        return {
          ...prev,
          players,
          properties: transferredProps,
          gamePhase: winnerId ? 'ended' : prev.gamePhase,
          winnerId: winnerId || null
        };
      }

      return { ...prev, players };
    });
  }, [setGameState]);

  const startAuction = useCallback((propertyId: string, startedByName?: string, customStartingBid?: number) => {
    const property = gameState.properties.find(p => p.id === propertyId);
    if (!property || property.isOwned || property.isInAuction) return;

    const duration = gameState.settings.auctionDuration;
    const startTime = Date.now();
    const endTimestamp = startTime + (duration * 1000);
    const startingBid = customStartingBid !== undefined ? customStartingBid : Math.round(property.currentValue * 0.7);

    const auction: Auction = {
      propertyId,
      startTime,
      duration,
      endTimestamp,
      currentBid: startingBid,
      highestBidder: null,
      bids: [],
      isActive: true,
      startedBy: startedByName || null
    };

    setGameState(prev => ({
      ...prev,
      currentAuction: auction,
      pendingPurchase: null,
      properties: prev.properties.map(p =>
        p.id === propertyId ? { ...p, isInAuction: true } : p
      )
    }));

    setAuctionTimer(duration);
  }, [gameState.properties, gameState.settings.auctionDuration]);

  // Handle dice roll and player movement
  const handleDiceRoll = useCallback(() => {
    // SECURITY & SYNC: Only allow current player to roll if it's their turn and no roll is in progress
    if (gameState.currentPlayer !== localPlayerId || gameState.turnState !== 'waiting_for_roll' || isRolling) {
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

  
  const endAuction = useCallback(() => {
    setGameState(prev => {
      if (!prev.currentAuction) return prev;
      const { propertyId, highestBidder, currentBid, startedBy } = prev.currentAuction;

      const newProperties = prev.properties.map(p => {
        if (p.id === propertyId) {
          return highestBidder
            ? { ...p, isInAuction: false, isOwned: true, owner: highestBidder }
            : { ...p, isInAuction: false };
        }
        return p;
      });

      let newPlayers = prev.players;
      if (highestBidder) {
        newPlayers = prev.players.map(player => {
          if (player.name === highestBidder) {
            return {
              ...player,
              balance: player.balance - currentBid,
              properties: [...player.properties, propertyId]
            };
          }
          // Auction proceeds go to the player who initiated the auction (if any)
          if (startedBy && player.name === startedBy && player.name !== highestBidder) {
            return { ...player, balance: player.balance + currentBid };
          }
          return player;
        });
      }

      return { ...prev, properties: newProperties, players: newPlayers, currentAuction: null };
    });

    setAuctionTimer(null);
    advanceTurn();
  }, [advanceTurn]);

  // Auction timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (gameState.currentAuction) {
      interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((gameState.currentAuction!.endTimestamp - Date.now()) / 1000));
        setAuctionTimer(remaining);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gameState.currentAuction?.endTimestamp]);

  // Handle auction end when timer reaches 0
  useEffect(() => {
    if (auctionTimer === 0 && gameState.currentAuction) {
      endAuction();
    }
  }, [auctionTimer, gameState.currentAuction, endAuction]);

  // Turn timer effect — uses advanceTurnRef to avoid restarting the interval on every state update
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (gameState.turnEndTime && gameState.gamePhase === 'playing') {
      interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((gameState.turnEndTime! - Date.now()) / 1000));
        setTurnTimer(remaining);
        if (remaining === 0 && gameState.currentPlayer === localPlayerId) {
          advanceTurnRef.current();
        }
      }, 1000);
    } else {
      setTurnTimer(null);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.turnEndTime, gameState.gamePhase, gameState.currentPlayer, localPlayerId]);

  // Stable ref so the auto-advance timer is not reset by unrelated state updates (e.g. Firestore heartbeats)
  const advanceTurnRef = useRef(advanceTurn);
  useEffect(() => { advanceTurnRef.current = advanceTurn; }, [advanceTurn]);

  // Automatic turn advancement when status is 'completed'
  useEffect(() => {
    if (gameState.turnState === 'completed' && gameState.gamePhase === 'playing' && gameState.currentPlayer === localPlayerId) {
      const timer = setTimeout(() => {
        advanceTurnRef.current();
      }, 2000);
      return () => clearTimeout(timer);
    }
  // Deliberately omit advanceTurn — use ref to prevent Firestore updates from resetting the timer
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.turnState, gameState.gamePhase, gameState.currentPlayer, localPlayerId]);
  

  const placeBid = useCallback((amount: number, bidderId?: string) => {
    if (!gameState.currentAuction) return;

    const biddingPlayerId = bidderId || localPlayerId || gameState.currentPlayer;
    const biddingPlayer = gameState.players.find(p => p.id === biddingPlayerId);
    if (!biddingPlayer || biddingPlayer.balance < amount) return;

    const bid: AuctionBid = {
      player: biddingPlayer.name,
      amount,
      timestamp: Date.now()
    };

    const newDuration = Math.max(auctionTimer || 0, 15);
    const newEndTimestamp = Date.now() + (newDuration * 1000);

    setGameState(prev => ({
      ...prev,
      currentAuction: prev.currentAuction ? {
        ...prev.currentAuction,
        currentBid: amount,
        highestBidder: biddingPlayer.name,
        endTimestamp: newEndTimestamp,
        bids: [...prev.currentAuction.bids, bid]
      } : null
    }));

    // Reset timer to give others a chance to bid
    setAuctionTimer(newDuration);
  }, [gameState.currentAuction, gameState.players, gameState.currentPlayer, auctionTimer]);



  const purchaseProperty = useCallback((propertyId: string) => {
    setGameState((prev: GameState) => {
      const property = prev.properties.find(p => p.id === propertyId);
      const buyer = prev.players.find(p => p.id === prev.currentPlayer);

      // Buying a mortgaged property from its current owner at mortgage value
      if (property?.isMortgaged && property.isOwned && buyer) {
        const price = property.mortgageValue || Math.round(property.currentValue * 0.5);
        if (buyer.balance < price) return prev;
        const prevOwner = property.owner;
        const newProperties = prev.properties.map(p =>
          p.id === propertyId ? { ...p, isOwned: true, owner: buyer.name, isMortgaged: false } : p
        );
        const newPlayers = prev.players.map(p => {
          if (p.id === prev.currentPlayer) return { ...p, balance: p.balance - price, properties: [...p.properties, propertyId] };
          if (p.name === prevOwner) return { ...p, balance: p.balance + price, properties: p.properties.filter(pid => pid !== propertyId) };
          return p;
        });
        const ev = { id: `ev-${Date.now()}`, type: 'purchase' as const, player: buyer.name, message: `bought mortgaged ${property.name} for $${price.toLocaleString('en-US')}`, timestamp: Date.now(), amount: -price };
        return advanceTurnLogic({ ...prev, properties: newProperties, players: newPlayers, pendingPurchase: null, gameEvents: [...prev.gameEvents.slice(-19), ev] });
      }

      // Normal purchase
      let next = handlePropertyPurchase(prev, propertyId, prev.currentPlayer);
      if (next !== prev) return advanceTurnLogic(next);
      return next;
    });
  }, [setGameState]);

  const skipPurchase = useCallback(() => {
    const pending = gameState.pendingPurchase;
    if (!pending) return;
    const property = gameState.properties.find(p => p.id === pending.propertyId);
    const player = gameState.players.find(p => p.id === pending.playerId);

    setGameState(prev => ({
      ...prev,
      pendingPurchase: null,
      turnState: 'completed' as const
    }));

    if (player && property) {
      addGameEvent('purchase', player.name, `passed on buying ${property.name}`);
    }
    // Turn advancement is handled by the auto-advance useEffect (human) or bot useEffect (bot)
  }, [gameState.pendingPurchase, gameState.properties, gameState.players, addGameEvent]);

  // Make a simple purchase offer to another player for a specific property
  const makeOffer = useCallback((propertyId: string, toPlayerName: string, amount: number) => {
    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayer);
    const property = gameState.properties.find(p => p.id === propertyId);
    if (!currentPlayer || !property) return;

    addGameEvent(
      'trade',
      currentPlayer.name,
      `offered $${amount.toLocaleString('en-US')} to ${toPlayerName} for ${property.name}`,
      amount
    );
  }, [gameState.players, gameState.currentPlayer, gameState.properties, addGameEvent]);

  const mortgageProperty = useCallback((propertyId: string) => {
    const property = gameState.properties.find(p => p.id === propertyId);
    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayer);
    
    if (!property || !currentPlayer || property.owner !== currentPlayer.name || property.isMortgaged) {
      return;
    }

    const mortgageValue = Math.round(property.currentValue * 0.5);

    setGameState(prev => ({
      ...prev,
      properties: prev.properties.map(p =>
        p.id === propertyId ? { ...p, isMortgaged: true } : p
      ),
      players: prev.players.map(player =>
        player.id === gameState.currentPlayer
          ? { ...player, balance: player.balance + mortgageValue }
          : player
      )
    }));
    addGameEvent('mortgage', currentPlayer.name, `mortgaged ${property.name}`, mortgageValue);
  }, [gameState.properties, gameState.players, gameState.currentPlayer]);

  const unmortgageProperty = useCallback((propertyId: string) => {
    const property = gameState.properties.find(p => p.id === propertyId);
    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayer);
    if (!property || !currentPlayer || property.owner !== currentPlayer.name || !property.isMortgaged) return;
    const cost = Math.round(property.currentValue * 0.55); // 10% interest over 50%
    if (currentPlayer.balance < cost) return;
    setGameState(prev => ({
      ...prev,
      properties: prev.properties.map(p => p.id === propertyId ? { ...p, isMortgaged: false } : p),
      players: prev.players.map(pl => pl.id === currentPlayer.id ? { ...pl, balance: pl.balance - cost } : pl)
    }));
    addGameEvent('mortgage', currentPlayer.name, `unmortgaged ${property.name}`, -cost);
  }, [gameState.properties, gameState.players, gameState.currentPlayer, addGameEvent]);

  const canBuildHouse = useCallback((property: Property, ownerName: string) => {
    if (property.type !== 'property' || property.isMortgaged || property.hasHotel) return false;
    if (property.owner !== ownerName) return false;
    if (!property.colorGroup) return false;
    if (!playerOwnsMonopoly(ownerName, property.colorGroup)) return false;
    if (property.houses >= 4) return false;
    // Even build rule: cannot build more than one ahead of others in group
    const group = gameState.properties.filter(p => p.type === 'property' && p.colorGroup === property.colorGroup && p.owner === ownerName);
    const minHouses = Math.min(...group.map(g => g.houses));
    return property.houses <= minHouses;
  }, [gameState.properties, playerOwnsMonopoly]);

  const buildHouse = useCallback((propertyId: string) => {
    const property = gameState.properties.find(p => p.id === propertyId);
    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayer);
    if (!property || !currentPlayer) return;
    if (!canBuildHouse(property, currentPlayer.name)) return;
    // Progressive cost: each additional house on this property costs more
    const cost = (property.houseCost || 0) * (property.houses + 1);
    if (currentPlayer.balance < cost) return;
    setGameState(prev => ({
      ...prev,
      properties: prev.properties.map(p => p.id === propertyId ? { ...p, houses: p.houses + 1 } : p),
      players: prev.players.map(pl => pl.id === currentPlayer.id ? { ...pl, balance: pl.balance - cost } : pl)
    }));
    addGameEvent('build', currentPlayer.name, `built a house on ${property.name} for $${cost.toLocaleString('en-US')}`, -cost);
  }, [gameState.properties, gameState.players, gameState.currentPlayer, canBuildHouse, addGameEvent]);

  const sellHouse = useCallback((propertyId: string) => {
    const property = gameState.properties.find(p => p.id === propertyId);
    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayer);
    if (!property || !currentPlayer) return;
    if (property.type !== 'property' || property.houses <= 0) return;
    // Even selling rule: cannot make this lower than others by more than 1; we allow basic sell
    const refund = Math.round((property.houseCost || 0) * 0.5);
    setGameState(prev => ({
      ...prev,
      properties: prev.properties.map(p => p.id === propertyId ? { ...p, houses: p.houses - 1 } : p),
      players: prev.players.map(pl => pl.id === currentPlayer.id ? { ...pl, balance: pl.balance + refund } : pl)
    }));
    addGameEvent('build', currentPlayer.name, `sold a house on ${property.name} for $${refund.toLocaleString('en-US')}`, refund);
  }, [gameState.properties, gameState.players, gameState.currentPlayer, addGameEvent]);

  const buildHotel = useCallback((propertyId: string) => {
    const property = gameState.properties.find(p => p.id === propertyId);
    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayer);
    if (!property || !currentPlayer) return;
    if (property.type !== 'property' || property.hasHotel || property.houses !== 4) return;
    const cost = property.hotelCost || 0;
    if (currentPlayer.balance < cost) return;
    setGameState(prev => ({
      ...prev,
      properties: prev.properties.map(p => p.id === propertyId ? { ...p, hasHotel: true, houses: 0 } : p),
      players: prev.players.map(pl => pl.id === currentPlayer.id ? { ...pl, balance: pl.balance - cost } : pl)
    }));
    addGameEvent('build', currentPlayer.name, `built a hotel on ${property.name} for $${cost.toLocaleString('en-US')}`, -cost);
  }, [gameState.properties, gameState.players, gameState.currentPlayer, addGameEvent]);

  const sellHotel = useCallback((propertyId: string) => {
    const property = gameState.properties.find(p => p.id === propertyId);
    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayer);
    if (!property || !currentPlayer) return;
    if (property.type !== 'property' || !property.hasHotel) return;
    const refund = Math.round((property.hotelCost || 0) * 0.5);
    setGameState(prev => ({
      ...prev,
      properties: prev.properties.map(p => p.id === propertyId ? { ...p, hasHotel: false, houses: 4 } : p),
      players: prev.players.map(pl => pl.id === currentPlayer.id ? { ...pl, balance: pl.balance + refund } : pl)
    }));
    addGameEvent('build', currentPlayer.name, `sold a hotel on ${property.name} for $${refund.toLocaleString('en-US')}`, refund);
  }, [gameState.properties, gameState.players, gameState.currentPlayer, addGameEvent]);

  function movePlayerToJail(state: GameState, playerId: string): GameState {
    const players = state.players.map(p => p.id === playerId ? { ...p, position: 10, isInJail: true, jailTurns: 3 } : p);
    return { ...state, players };
  }

  const drawCard = useCallback((deck: 'chance' | 'community') => {
    const card = deck === 'chance' ? chanceDeck.shift() : communityDeck.shift();
    if (!card) return;
    const cp = gameState.players.find(p => p.id === gameState.currentPlayer);
    if (!cp) return;
    addGameEvent('card', cp.name, card.message);
    switch (card.type) {
      case 'collect':
        setGameState(prev => ({
          ...prev,
          players: prev.players.map(pl => pl.id === prev.currentPlayer ? { ...pl, balance: pl.balance + card.value } : pl)
        }));
        // Advance turn after card collection
        setTimeout(() => {
          advanceTurn();
        }, 100);
        break;
      case 'pay':
        applyPayment(gameState.currentPlayer, null, card.value, 'Card');
        // Advance turn after card payment
        setTimeout(() => {
          advanceTurn();
        }, 100);
        break;
      case 'move':
        setGameState(prev => ({
          ...prev,
          players: prev.players.map(pl => pl.id === prev.currentPlayer ? { ...pl, position: card.value } : pl)
        }));
        // Advance turn after card movement
        setTimeout(() => {
          advanceTurn();
        }, 100);
        break;
      case 'jail':
        setGameState(prev => movePlayerToJail(prev, prev.currentPlayer));
        // Advance turn after going to jail from card
        setTimeout(() => {
          advanceTurn();
        }, 100);
        break;
      case 'outOfJail':
        setHeldOutOfJailCards(prev => ({ ...prev, [gameState.currentPlayer]: (prev[gameState.currentPlayer] || 0) + 1 }));
        // Advance turn after getting out of jail card
        setTimeout(() => {
          advanceTurn();
        }, 100);
        break;
      default:
        break;
    }
    // Put card to bottom
    if (deck === 'chance') chanceDeck.push(card);
    else communityDeck.push(card);
  }, [addGameEvent, applyPayment, chanceDeck, communityDeck, gameState.currentPlayer, gameState.players]);

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
  }, []);

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
  }, []);

  const createTeam = useCallback((teamName: string) => {
    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayer);
    if (!currentPlayer) return;

    const newTeamId = `team-${Date.now()}`;
    const newTeam: Team = {
      id: newTeamId,
      name: teamName,
      members: [currentPlayer.id],
      sharedBalance: 0,
      color: currentPlayer.color
    };

    setGameState(prev => ({
      ...prev,
      teams: [...prev.teams, newTeam],
      players: prev.players.map(p =>
        p.id === currentPlayer.id ? { ...p, teamId: newTeamId } : p
      )
    }));
  }, [gameState.currentPlayer, gameState.players, setGameState]);

  const joinTeam = useCallback((teamId: string) => {
    const joinerId = localPlayerId || gameState.currentPlayer;
    const cp = gameState.players.find(p => p.id === joinerId);
    if (!cp) return;

    setGameState(prev => {
      const team = prev.teams.find(t => t.id === teamId);
      if (!team) return prev;

      // Keep both players fully active — just update team membership
      const newTeams = prev.teams.map(t =>
        t.id === teamId && !t.members.includes(cp.id)
          ? { ...t, members: [...t.members, cp.id] }
          : t
      );
      // Update each player's teamId field
      const newPlayers = prev.players.map(p =>
        p.id === cp.id ? { ...p, teamId } : p
      );
      return { ...prev, teams: newTeams, players: newPlayers };
    });
  }, [localPlayerId, gameState.currentPlayer, gameState.players, setGameState]);

  const updateSettings = useCallback((newSettings: Partial<GameSettings>) => {
    setGameState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...newSettings }
    }));
  }, []);

  // Game mode management
  const setGameMode = useCallback((mode: GameMode) => {
    setGameState(prev => {
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
      return next;
    });
  }, [setGameState]);

  const startPreAuction = useCallback(() => {
    if (gameState.settings.gameMode !== 'auction') return;
    
    setGameState(prev => ({
      ...prev,
      gamePhase: 'auction',
      preAuctionPhase: true,
      turnState: 'waiting_for_roll'
    }));
  }, [gameState.settings.gameMode]);

  const endPreAuction = useCallback(() => {
    setGameState(prev => {
      const next: GameState = {
        ...prev,
        gamePhase: 'playing',
        preAuctionPhase: false,
        turnState: 'waiting_for_roll'
      };
      if (prev.settings.turnTimerDuration && prev.settings.turnTimerDuration > 0) {
        next.turnEndTime = Date.now() + (prev.settings.turnTimerDuration * 1000);
      }
      return next;
    });
  }, [setGameState]);

  // Console management
  const toggleConsole = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      consoleOpen: !prev.consoleOpen
    }));
  }, []);

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
  }, []);

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
  }, []);

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
  }, []);

  const setPreAuctionProperties = useCallback((propertyIds: string[]) => {
    setGameState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        preAuctionProperties: propertyIds
      }
    }));
  }, []);

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
    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayer);
    if (!currentPlayer) return;

    const tradeOffer: TradeOffer = {
      id: `trade-${Date.now()}`,
      fromPlayer: currentPlayer.name,
      toPlayer,
      offeredProperties,
      requestedProperties,
      offeredCash,
      requestedCash,
      status: 'pending',
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };

    setGameState(prev => ({
      ...prev,
      tradeOffers: [...prev.tradeOffers, tradeOffer]
    }));

    addGameEvent(
      'trade',
      currentPlayer.name,
      `offered trade to ${toPlayer}`,
      offeredCash - requestedCash
    );
  }, [gameState.players, gameState.currentPlayer, addGameEvent]);

  const acceptTradeOffer = useCallback((offerId: string, acceptorName?: string) => {
    const offer = gameState.tradeOffers.find(o => o.id === offerId);
    if (!offer || offer.status !== 'pending') return;

    // Use provided acceptorName, or the intended toPlayer if not provided
    const actualAcceptor = acceptorName || offer.toPlayer;

    setGameState(prev => {
      const newProperties = prev.properties.map(prop => {
        // Transfer offered properties to the actual acceptor
        if (offer.offeredProperties.includes(prop.id)) {
          return { ...prop, owner: actualAcceptor };
        }
        // Transfer requested properties from the actual acceptor to the offerer
        if (offer.requestedProperties.includes(prop.id)) {
          return { ...prop, owner: offer.fromPlayer };
        }
        return prop;
      });

      const newPlayers = prev.players.map(player => {
        if (player.name === offer.fromPlayer) {
          return {
            ...player,
            balance: player.balance - offer.offeredCash + offer.requestedCash,
            properties: [
              ...player.properties.filter(p => !offer.offeredProperties.includes(p)),
              ...offer.requestedProperties
            ]
          };
        }
        if (player.name === actualAcceptor) {
          return {
            ...player,
            balance: player.balance + offer.offeredCash - offer.requestedCash,
            properties: [
              ...player.properties.filter(p => !offer.requestedProperties.includes(p)),
              ...offer.offeredProperties
            ]
          };
        }
        return player;
      });

      return {
        ...prev,
        properties: newProperties,
        players: newPlayers,
        tradeOffers: prev.tradeOffers.map(o => 
          o.id === offerId ? { ...o, status: 'accepted' as const, toPlayer: actualAcceptor } : o
        )
      };
    });

    addGameEvent('trade', actualAcceptor, `accepted trade from ${offer.fromPlayer}`);
  }, [gameState.tradeOffers, gameState.properties, gameState.players, addGameEvent]);

  const rejectTradeOffer = useCallback((offerId: string) => {
    setGameState(prev => ({
      ...prev,
      tradeOffers: prev.tradeOffers.map(o =>
        o.id === offerId ? { ...o, status: 'rejected' as const } : o
      )
    }));
  }, []);

  const cancelTradeOffer = useCallback((offerId: string) => {
    setGameState(prev => ({
      ...prev,
      tradeOffers: prev.tradeOffers.filter(o => o.id !== offerId)
    }));
  }, []);

  // Rent payment functions
  const payRent = useCallback(() => {
    if (!gameState.pendingRent) return;
    const property = gameState.properties.find(p => p.id === gameState.pendingRent!.propertyId);
    const payerName = gameState.players.find(p => p.id === gameState.currentPlayer)?.name || 'Unknown';

    setGameState(prev => {
      if (!prev.pendingRent) return prev;
      const { owner: rentOwner, amount: rentAmount } = prev.pendingRent;
      let players = [...prev.players];
      const payerIdx = players.findIndex(p => p.id === prev.currentPlayer);
      if (payerIdx === -1) return prev;
      players[payerIdx] = { ...players[payerIdx], balance: players[payerIdx].balance - rentAmount };
      const receiverIdx = players.findIndex(p => p.name === rentOwner);
      if (receiverIdx !== -1) {
        players[receiverIdx] = { ...players[receiverIdx], balance: players[receiverIdx].balance + rentAmount };
      }
      const event: any = {
        id: `event-${Date.now()}`,
        type: 'rent',
        player: payerName,
        message: `paid $${rentAmount.toLocaleString('en-US')} rent to ${rentOwner}${property ? ` for ${property.name}` : ''}`,
        timestamp: Date.now(),
        amount: -rentAmount
      };
      return {
        ...prev,
        players,
        pendingRent: null,
        turnState: 'completed' as const,
        gameEvents: [...prev.gameEvents.slice(-19), event]
      };
    });
    // Turn advancement handled by auto-advance useEffect (human) or bot useEffect (bot)
  }, [gameState.pendingRent, gameState.properties, gameState.currentPlayer, gameState.players, setGameState]);

  const skipRent = useCallback(() => {
    if (!gameState.pendingRent) return;
    setGameState(prev => ({
      ...prev,
      pendingRent: null,
      turnState: 'completed' as const
    }));
  }, [gameState.pendingRent, setGameState]);

  // Jail: pay 20% of property income to leave; if they can't afford or skip, decrement jailTurns
  const payJailFine = useCallback(() => {
    const cp = gameState.players.find(p => p.id === gameState.currentPlayer);
    if (!cp || !cp.isInJail) return;
    const { income } = computePlayerIncome(gameState.properties, cp.name);
    const fine = Math.round(income * 0.20);
    if (fine <= 0 || cp.balance < fine) return;
    setGameState(prev => ({
      ...prev,
      players: prev.players.map(p =>
        p.id === prev.currentPlayer
          ? { ...p, balance: p.balance - fine, isInJail: false, jailTurns: 0 }
          : p
      )
    }));
    addGameEvent('jail', cp.name, `paid $${fine.toLocaleString('en-US')} jail fine (20% of $${income.toLocaleString('en-US')} property income)`, -fine);
  }, [gameState.players, gameState.currentPlayer, gameState.properties, addGameEvent, setGameState]);

  const skipJailTurn = useCallback(() => {
    const cp = gameState.players.find(p => p.id === gameState.currentPlayer);
    if (!cp || !cp.isInJail) return;
    const remaining = Math.max(0, (cp.jailTurns || 0) - 1);
    setGameState(prev => ({
      ...prev,
      players: prev.players.map(p =>
        p.id === prev.currentPlayer
          ? { ...p, jailTurns: remaining, isInJail: remaining > 0 }
          : p
      ),
      turnState: 'completed' as const
    }));
    addGameEvent('jail', cp.name, remaining > 0 ? `stayed in jail (${remaining} turns left)` : 'released from jail (served time)');
  }, [gameState.currentPlayer, gameState.players, addGameEvent, setGameState]);

  // Compute jail fine amount for display
  const getJailFineAmount = useCallback((): { fine: number; income: number; numProperties: number } => {
    const cp = gameState.players.find(p => p.id === gameState.currentPlayer);
    if (!cp) return { fine: 0, income: 0, numProperties: 0 };
    const { income, numProperties } = computePlayerIncome(gameState.properties, cp.name);
    return { fine: Math.round(income * 0.20), income, numProperties };
  }, [gameState.currentPlayer, gameState.players, gameState.properties]);

  // Resolve pending card — always advances the turn regardless of card outcome
  const resolveCard = useCallback(() => {
    setGameState(prev => {
      const pc = prev.pendingCard;

      // Fallback: if pendingCard is gone (race condition) but we're still blocked, unblock the turn
      if (!pc) {
        if (prev.turnState === 'waiting_for_action' || prev.turnState === 'processing') {
          return advanceTurnLogic({ ...prev, pendingCard: null });
        }
        return prev;
      }

      const cp = prev.players.find(p => p.id === prev.currentPlayer);
      // Fallback: current player not found — still unblock
      if (!cp) {
        return advanceTurnLogic({ ...prev, pendingCard: null });
      }

      const cardLabel = pc.type === 'chance' ? 'Chance' : 'Community Chest';
      const rollLabel = `roll ${pc.diceRoll} — ${pc.diceRoll % 2 !== 0 ? 'odd' : 'even'}`;

      const event: GameEvent = {
        id: `event-${Date.now()}-${Math.random()}`,
        type: 'card',
        player: cp.name,
        message: (pc.amount ?? 0) > 0
          ? `${cardLabel} (${rollLabel}): ${pc.isReward ? '+' : '-'}$${(pc.amount ?? 0).toLocaleString('en-US')} from ${pc.numProperties} prop${pc.numProperties !== 1 ? 's' : ''}`
          : `${cardLabel} (${rollLabel}): No properties — no change`,
        timestamp: Date.now(),
        amount: (pc.amount ?? 0) > 0 ? (pc.isReward ? pc.amount : -(pc.amount ?? 0)) : undefined
      };

      const baseNext = { ...prev, pendingCard: null, gameEvents: [...prev.gameEvents.slice(-19), event as GameEvent] };

      // No income — skip balance change, advance immediately
      if ((pc.amount ?? 0) <= 0) {
        return advanceTurnLogic(baseNext);
      }

      const players = prev.players.map(p => {
        if (p.id !== prev.currentPlayer) return p;
        const delta = pc.isReward ? (pc.amount ?? 0) : -(pc.amount ?? 0);
        return { ...p, balance: p.balance + delta };
      });

      return advanceTurnLogic({ ...baseNext, players });
    });
  }, [setGameState]);

  // Workers: assign/remove
  const assignWorker = useCallback((propertyId: string, color: string) => {
    const cp = gameState.players.find(p => p.id === gameState.currentPlayer);
    if (!cp) return;
    const property = gameState.properties.find(p => p.id === propertyId);
    if (!property || property.owner !== cp.name || property.type !== 'property') return;
    const existing = (gameState.workers || []).find(w => w.propertyId === propertyId);
    if (existing) return;
    const newWorker: Worker = {
      id: `worker-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: cp.id,
      propertyId,
      color
    };
    setGameState(prev => ({ ...prev, workers: [...(prev.workers || []), newWorker] }));
    addGameEvent('build', cp.name, `assigned a worker to ${property.name}`);
  }, [gameState.players, gameState.currentPlayer, gameState.properties, gameState.workers, addGameEvent, setGameState]);

  const removeWorker = useCallback((propertyId: string) => {
    const cp = gameState.players.find(p => p.id === gameState.currentPlayer);
    const property = gameState.properties.find(p => p.id === propertyId);
    setGameState(prev => ({ ...prev, workers: (prev.workers || []).filter(w => w.propertyId !== propertyId) }));
    if (cp && property) addGameEvent('build', cp.name, `removed worker from ${property.name}`);
  }, [gameState.currentPlayer, gameState.players, gameState.properties, addGameEvent, setGameState]);

  const updateWorkerColor = useCallback((propertyId: string, color: string) => {
    setGameState(prev => ({
      ...prev,
      workers: (prev.workers || []).map(w => w.propertyId === propertyId ? { ...w, color } : w)
    }));
  }, [setGameState]);

  // Bot dice roll — bypasses localPlayerId check, only works for isBot players
  const rollDiceForBot = useCallback(() => {
    if (gameState.turnState !== 'waiting_for_roll') return;
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
  }, [gameState.currentPlayer, gameState.turnState, gameState.players, rollDice]);

  return {
    gameState,
    auctionTimer,
    turnTimer,
    isRolling,
    randomizeProperties,
    startAuction,
    placeBid,
    endAuction,
    purchaseProperty,
    skipPurchase,
    makeOffer,
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
    getJailFineAmount,
    // Card resolution
    resolveCard,
    // Worker functions
    assignWorker,
    removeWorker,
    updateWorkerColor,
    // Build eligibility check
    canBuildHouse
  };
};

// Utility: shuffle array copy
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}