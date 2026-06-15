import React, { useState, useEffect } from 'react';
import { ACHIEVEMENTS, getAchievementContext, loadUnlockedAchievements, saveUnlockedAchievements } from '@/lib/achievements';
import MonopolyBoardLayout from './MonopolyBoardLayout';
import CentralDisplay from './CentralDisplay';
import AuctionPanel from './AuctionPanel';
import PlayerPanel from './PlayerPanel';
import PropertyCard from './PropertyCard';
import SpecialPropertyInfo from './SpecialPropertyInfo';
import RulesPanel from './RulesPanel';
import GameConsole from './GameConsole';
import LobbySystem from './LobbySystem';
import TransactionNotification from './TransactionNotification';
import TradingSystem from './TradingSystem';
import RentPaymentDialog from './RentPaymentDialog';
import GameLog from './GameLog';
import TeamPanel from './TeamPanel';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useGameLogic, getInitialState } from '@/hooks/useGameLogic';
import { Property, GameMode, GameSettings, GameEvent, GameState, Player } from '@/types/game';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, Users, TrendingUp, Settings, Gavel, Handshake } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';

const MonopolyGame: React.FC = () => {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showLobby, setShowLobby] = useState(true);
  const [isLobbyOwner, setIsLobbyOwner] = useState(false);
  const [lobbyCode, setLobbyCode] = useState('');
  const [showPreAuctionDialog, setShowPreAuctionDialog] = useState(false);
  const [currentDisplayEvent, setCurrentDisplayEvent] = useState<GameEvent | null>(null);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [localPlayerId, setLocalPlayerId] = useState<string>('');
  
  // Local setup state mirrors a subset of settings for initial configuration
  const [setupAuctionsEnabled, setSetupAuctionsEnabled] = useState(false);
  const [setupTeamsEnabled, setSetupTeamsEnabled] = useState(true);
  const [setupMortgageEnabled, setSetupMortgageEnabled] = useState(true);
  const [setupTradingEnabled, setSetupTradingEnabled] = useState(false);
  const [setupAuctionDuration, setSetupAuctionDuration] = useState(120);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isTradingOpen, setIsTradingOpen] = useState(false);
  const [isWorkerPanelOpen, setIsWorkerPanelOpen] = useState(false);
  const [workerPickColor, setWorkerPickColor] = useState('#FFE5B4');
  const [workerPickPropertyId, setWorkerPickPropertyId] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [selectedSpecialProperty, setSelectedSpecialProperty] = useState<Property | null>(null);
  const [offerDismissed, setOfferDismissed] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [unlockedAchievements, setUnlockedAchievements] = useState<Set<string>>(new Set());
  // Local flag to immediately hide the card dialog on click (Firestore update is async)
  const [cardResolved, setCardResolved] = useState(false);
  const { toast } = useToast();
  
  const {
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
    resetGame,
    setGameMode,
    startPreAuction,
    toggleConsole,
    updatePropertyList,
    addPropertyToList,
    removePropertyFromList,
    setPreAuctionProperties,
    updateProperty,
    createTradeOffer,
    acceptTradeOffer,
    rejectTradeOffer,
    cancelTradeOffer,
    payRent,
    skipRent,
    payJailFine,
    skipJailTurn,
    getJailFineAmount,
    resolveCard,
    assignWorker,
    removeWorker,
    updateWorkerColor,
    canBuildHouse
  } = useGameLogic(!showLobby ? lobbyCode : undefined, localPlayerId);

  const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayer);
  const myPlayer = gameState.players.find(p => p.id === localPlayerId) || currentPlayer;
  // Hoisted before all hooks so turn-notification effects can depend on it safely
  const isMyTurn = gameState.currentPlayer === localPlayerId;

  useEffect(() => {
    console.log("Game Phase:", gameState.gamePhase);
    console.log("Current Player ID:", gameState.currentPlayer);
    console.log("Local Player ID:", localPlayerId);
  }, [gameState.gamePhase, gameState.currentPlayer, localPlayerId]);

  // Bot Noob automation — fires on every relevant state change
  useEffect(() => {
    const activeCp = gameState.players.find(p => p.id === gameState.currentPlayer);
    if (!activeCp?.isBot || gameState.gamePhase !== 'playing') return;

    let timer: ReturnType<typeof setTimeout>;

    if (gameState.turnState === 'waiting_for_roll' && !isRolling) {
      if (activeCp.isInJail) {
        const jailBalance = activeCp.balance;
        timer = setTimeout(() => {
          const { fine } = getJailFineAmount();
          if (fine > 0 && jailBalance >= fine) {
            payJailFineRef.current();
          } else {
            skipJailTurnRef.current();
          }
        }, 900);
      } else {
        timer = setTimeout(() => rollDiceForBotRef.current(), 1200);
      }
    } else if (gameState.turnState === 'waiting_for_action') {
      if (gameState.pendingCard) {
        timer = setTimeout(() => resolveCardRef.current(), 300);
      } else if (gameState.pendingPurchase) {
        const pendingPropId = gameState.pendingPurchase.propertyId;
        const prop = gameState.properties.find(p => p.id === pendingPropId);
        const canAfford = prop && activeCp.balance >= prop.currentValue;
        timer = setTimeout(() => {
          if (canAfford && Math.random() > 0.4) {
            purchasePropertyRef.current(pendingPropId);
          } else {
            skipPurchaseRef.current();
          }
        }, 1200);
      } else if (gameState.pendingRent) {
        timer = setTimeout(() => payRentRef.current(), 700);
      } else {
        timer = setTimeout(() => endTurnRef.current(), 1200);
      }
    } else if (gameState.turnState === 'completed') {
      timer = setTimeout(() => endTurnRef.current(), 1200);
    }

    return () => { if (timer) clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    gameState.currentPlayer,
    gameState.turnState,
    gameState.pendingPurchase,
    gameState.pendingRent,
    gameState.pendingCard,
    gameState.gamePhase,
    gameState.players,
    isRolling
  ]);

  // Bot Noob trade responder — accept/reject offers addressed to the bot
  const botRespondedTradeIds = React.useRef<Set<string>>(new Set());
  useEffect(() => {
    const botPlayer = gameState.players.find(p => p.isBot);
    if (!botPlayer || gameState.gamePhase !== 'playing') return;

    const unhandled = gameState.tradeOffers.filter(
      o => o.status === 'pending'
        && o.toPlayer === botPlayer.name
        && !botRespondedTradeIds.current.has(o.id)
    );
    if (unhandled.length === 0) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    unhandled.forEach(offer => {
      botRespondedTradeIds.current.add(offer.id);
      const botName = botPlayer.name;
      // Capture property values now (before async delay)
      const giveValue = offer.requestedProperties.reduce((sum, id) => {
        const p = gameState.properties.find(prop => prop.id === id);
        return sum + (p?.currentValue || 0);
      }, 0) + offer.requestedCash;
      const getValue = offer.offeredProperties.reduce((sum, id) => {
        const p = gameState.properties.find(prop => prop.id === id);
        return sum + (p?.currentValue || 0);
      }, 0) + offer.offeredCash;

      timers.push(setTimeout(() => {
        // Accept if getting >= 85% of value given, or 25% random goodwill
        if (getValue >= giveValue * 0.85 || Math.random() < 0.25) {
          acceptTradeOfferRef.current(offer.id, botName);
        } else {
          rejectTradeOfferRef.current(offer.id);
        }
      }, 2000 + Math.random() * 2000));
    });

    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    gameState.tradeOffers.length,
    gameState.gamePhase
  ]);

  // Bot Noob bids on live auctions (independent of whose turn it is)
  useEffect(() => {
    const botPlayer = gameState.players.find(p => p.isBot);
    if (!botPlayer || !gameState.currentAuction || gameState.gamePhase !== 'playing') return;

    const auction = gameState.currentAuction;
    // Bot doesn't bid on its own auction
    if (auction.startedBy === botPlayer.name) return;
    // Bot doesn't need to outbid itself
    if (auction.highestBidder === botPlayer.name) return;

    const minBid = auction.currentBid + 10000;
    if (botPlayer.balance < minBid) return;

    // ~55% chance to bid, with a random human-like delay
    if (Math.random() > 0.45) {
      const bidIncrement = [10000, 20000, 30000, 50000][Math.floor(Math.random() * 4)];
      const timer = setTimeout(() => {
        placeBid(minBid + bidIncrement, botPlayer.id);
      }, 1800 + Math.random() * 2500);
      return () => clearTimeout(timer);
    }
  }, [
    gameState.currentAuction?.propertyId,
    gameState.currentAuction?.currentBid,
    gameState.currentAuction?.highestBidder,
    gameState.gamePhase
  ]);

  // Win toast — fires once when winnerId is set
  useEffect(() => {
    if (!gameState.winnerId) return;
    const winner = gameState.players.find(p => p.id === gameState.winnerId);
    if (!winner) return;
    if (winner.id === localPlayerId) {
      toast({ title: '🏆 You Win!', description: `Congratulations ${winner.name}! You're the last player standing!`, duration: 12000 });
    } else {
      toast({ title: `🏆 ${winner.name} Wins!`, description: `${winner.name} is the last player standing. Better luck next time!`, duration: 8000 });
    }
  }, [gameState.winnerId]);

  // Turn notification — ding sound + tab title when it becomes the local player's turn
  const prevIsMyTurn = React.useRef(false);
  useEffect(() => {
    const wasMyTurn = prevIsMyTurn.current;
    prevIsMyTurn.current = isMyTurn;

    if (!wasMyTurn && isMyTurn && gameState.gamePhase === 'playing') {
      // Ding sound via Web Audio API
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046, ctx.currentTime);          // C6
        osc.frequency.setValueAtTime(1318, ctx.currentTime + 0.12);   // E6
        osc.frequency.setValueAtTime(1567, ctx.currentTime + 0.24);   // G6
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.7);
        setTimeout(() => ctx.close(), 1000);
      } catch (_) {}

      document.title = "🎲 It's YOUR Turn! — Monopoly Madness";
    } else if (!isMyTurn && gameState.gamePhase === 'playing') {
      document.title = 'Monopoly Madness';
    }
  }, [isMyTurn, gameState.gamePhase]);

  // Reset tab title when game ends or on unmount
  useEffect(() => {
    return () => { document.title = 'Monopoly Madness'; };
  }, []);

  // Loss toast — fires when a player goes inactive (bankrupt)
  const prevActivePlayers = React.useRef<Set<string>>(new Set());

  // Stable refs for bot automation — prevents stale closures in timer callbacks
  const resolveCardRef = React.useRef(resolveCard);
  const endTurnRef = React.useRef(endTurn);
  const payRentRef = React.useRef(payRent);
  const payJailFineRef = React.useRef(payJailFine);
  const skipJailTurnRef = React.useRef(skipJailTurn);
  const purchasePropertyRef = React.useRef(purchaseProperty);
  const skipPurchaseRef = React.useRef(skipPurchase);
  const rollDiceForBotRef = React.useRef(rollDiceForBot);
  const acceptTradeOfferRef = React.useRef(acceptTradeOffer);
  const rejectTradeOfferRef = React.useRef(rejectTradeOffer);
  useEffect(() => { resolveCardRef.current = resolveCard; }, [resolveCard]);
  useEffect(() => { endTurnRef.current = endTurn; }, [endTurn]);
  useEffect(() => { payRentRef.current = payRent; }, [payRent]);
  useEffect(() => { payJailFineRef.current = payJailFine; }, [payJailFine]);
  useEffect(() => { skipJailTurnRef.current = skipJailTurn; }, [skipJailTurn]);
  useEffect(() => { purchasePropertyRef.current = purchaseProperty; }, [purchaseProperty]);
  useEffect(() => { skipPurchaseRef.current = skipPurchase; }, [skipPurchase]);
  useEffect(() => { rollDiceForBotRef.current = rollDiceForBot; }, [rollDiceForBot]);
  useEffect(() => { acceptTradeOfferRef.current = acceptTradeOffer; }, [acceptTradeOffer]);
  useEffect(() => { rejectTradeOfferRef.current = rejectTradeOffer; }, [rejectTradeOffer]);

  // Achievement load / check ref
  const achievementsLoadedRef = React.useRef(false);
  const unlockedAchRef = React.useRef<Set<string>>(new Set());
  useEffect(() => {
    const currentActiveIds = new Set(gameState.players.filter(p => p.isActive).map(p => p.id));
    gameState.players.forEach(p => {
      if (prevActivePlayers.current.has(p.id) && !currentActiveIds.has(p.id)) {
        if (p.id === localPlayerId) {
          toast({ title: '💸 You\'re Bankrupt!', description: 'Your balance dropped below zero. Your properties are now inactive.', variant: 'destructive', duration: 10000 });
        } else {
          toast({ title: `💸 ${p.name} Bankrupt!`, description: `${p.name} ran out of money and is out of the game.`, duration: 6000 });
        }
      }
    });
    prevActivePlayers.current = currentActiveIds;
  }, [gameState.players]);

  // Reset cardResolved whenever the turn changes or pendingCard is cleared by Firestore
  useEffect(() => { setCardResolved(false); }, [gameState.currentPlayer, gameState.pendingCard]);

  // Achievement tracking — checks on meaningful state changes, persists to localStorage
  const myPlayerForAch = gameState.players.find(p => p.id === localPlayerId);
  useEffect(() => {
    if (!myPlayerForAch || gameState.gamePhase !== 'playing') return;
    if (!achievementsLoadedRef.current) {
      achievementsLoadedRef.current = true;
      const loaded = loadUnlockedAchievements(myPlayerForAch.name);
      unlockedAchRef.current = loaded;
      setUnlockedAchievements(new Set(loaded));
      return;
    }
    const ctx = getAchievementContext(
      myPlayerForAch.name,
      myPlayerForAch.balance,
      gameState.properties,
      gameState.tradeOffers,
      gameState.turn
    );
    const newOnes = ACHIEVEMENTS.filter(a => !unlockedAchRef.current.has(a.id) && a.check(ctx));
    if (newOnes.length > 0) {
      newOnes.forEach(a => unlockedAchRef.current.add(a.id));
      saveUnlockedAchievements(myPlayerForAch.name, unlockedAchRef.current);
      setUnlockedAchievements(new Set(unlockedAchRef.current));
      newOnes.forEach(ach => toast({
        title: `${ach.icon} Achievement Unlocked!`,
        description: `${ach.title} — ${ach.description}`,
        duration: 5000,
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    myPlayerForAch?.balance,
    myPlayerForAch?.name,
    gameState.properties.filter(p => p.owner === myPlayerForAch?.name).length,
    gameState.tradeOffers.filter(o => o.status === 'accepted').length,
    gameState.turn,
    gameState.gamePhase,
  ]);

  if (!currentPlayer || !myPlayer) {
    console.log("Waiting for players...");
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-xl font-bold flex flex-col items-center text-slate-700">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          Loading Game State...
        </div>
      </div>
    );
  }

  const myOwnedProperties = gameState.properties.filter(p => p.owner === myPlayer.name);
  const ownedProperties = gameState.properties.filter(p => p.owner === currentPlayer.name);

  // Host heartbeat and cleanup
  useEffect(() => {
    if (!isLobbyOwner || !lobbyCode) return;

    // Heartbeat every 30 seconds to keep game active
    const heartbeat = setInterval(async () => {
      try {
        const roomRef = doc(db, 'games', lobbyCode);
        const snap = await getDoc(roomRef);
        if (snap.exists()) {
          const data = snap.data();
          await setDoc(roomRef, {
            ...data,
            lastUpdated: Date.now()
          });
        }
      } catch (e) {
        console.error("Heartbeat error:", e);
      }
    }, 30000);

    // Cleanup on beforeunload (best effort)
    const handleUnload = async (e: BeforeUnloadEvent) => {
      // We can't await here reliably, but we can try to send a delete request
      const roomRef = doc(db, 'games', lobbyCode);
      // navigator.sendBeacon or similar? Firestore doesn't support sendBeacon directly.
      // We'll rely on the heartbeat timeout for cleanup if this fails.
      // But we can try a quick update to mark as inactive
      const data = { status: 'ended', lastUpdated: Date.now() };
      // This might not finish, which is why the heartbeat timeout is the primary mechanism.
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [isLobbyOwner, lobbyCode]);

  // Manage current display event with 1-second timer
  useEffect(() => {
    if (gameState.gameEvents.length > 0) {
      const latestEvent = gameState.gameEvents[gameState.gameEvents.length - 1];
      setCurrentDisplayEvent(latestEvent);
      
      // Clear the display after 1 second
      const timer = setTimeout(() => {
        setCurrentDisplayEvent(null);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [gameState.gameEvents]);

  const currentAuctionData = gameState.currentAuction ? {
    property: gameState.properties.find(p => p.id === gameState.currentAuction!.propertyId)!,
    currentBid: gameState.currentAuction.currentBid,
    highestBidder: gameState.currentAuction.highestBidder,
    timeRemaining: auctionTimer || 0,
    bids: gameState.currentAuction.bids,
    startedBy: gameState.currentAuction.startedBy || null
  } : null;

  // Pending purchase UI data
  const pendingPurchaseData = gameState.pendingPurchase ? {
    property: gameState.properties.find(p => p.id === gameState.pendingPurchase!.propertyId)!,
    isMine: gameState.pendingPurchase.playerId === localPlayerId
  } : null;

  // Pending rent UI data
  const myPendingRentData = gameState.pendingRent && gameState.currentPlayer === localPlayerId ? {
    property: gameState.properties.find(p => p.id === gameState.pendingRent!.propertyId)!,
    owner: gameState.pendingRent.owner,
    amount: gameState.pendingRent.amount
  } : null;

  // Jail dialog: show when it's my turn, I'm in jail, waiting to roll
  const showJailDialog = isMyTurn && myPlayer.isInJail && gameState.turnState === 'waiting_for_roll' && gameState.gamePhase === 'playing';
  const { fine: jailFine, income: jailIncome, numProperties: jailNumProperties } = showJailDialog ? getJailFineAmount() : { fine: 0, income: 0, numProperties: 0 };

  // Pending card dialog — also suppressed locally once resolved (Firestore update is async)
  const myPendingCard = gameState.pendingCard && gameState.currentPlayer === localPlayerId && !cardResolved
    ? gameState.pendingCard : null;

  // Offer panel: only shown on MY turn, after rolling (not while waiting to roll), and when I'm standing
  // on a property owned by someone else. Reset dismissed state when my position changes.
  const propertyOnMyTile = gameState.properties.find(p => p.position === myPlayer.position);
  const ownedPropertyOnTile = (
    isMyTurn &&
    gameState.turnState !== 'waiting_for_roll' &&
    gameState.turnState !== 'completed' &&
    !gameState.pendingRent &&
    !offerDismissed &&
    gameState.settings.auctionsEnabled &&
    propertyOnMyTile &&
    propertyOnMyTile.isOwned &&
    propertyOnMyTile.owner !== myPlayer.name
  ) ? propertyOnMyTile : null;

  // Detect landing on own property — show a build-house / end-turn window
  const landedOnOwnProperty = (
    isMyTurn &&
    gameState.turnState === 'waiting_for_action' &&
    !gameState.pendingPurchase &&
    !gameState.pendingRent &&
    !gameState.pendingCard &&
    !gameState.currentAuction &&
    !showJailDialog &&
    propertyOnMyTile?.isOwned === true &&
    propertyOnMyTile?.owner === myPlayer.name
  );

  // Show worker assignment nudge when it's my turn and I haven't rolled yet
  const showWorkerNudge = (
    isMyTurn &&
    gameState.turnState === 'waiting_for_roll' &&
    gameState.settings.workersEnabled &&
    gameState.gamePhase === 'playing' &&
    !myPlayer.isInJail
  );

  // Reset offer dismissed state when local player moves to a new position
  useEffect(() => {
    setOfferDismissed(false);
  }, [myPlayer.position, gameState.currentPlayer]);

  const handlePropertyClick = (property: Property) => {
    if (property.type === 'special') {
      setSelectedSpecialProperty(property);
    } else {
      setSelectedProperty(property);
    }
  };

  const handleStartAuction = (propertyId: string) => {
    startAuction(propertyId);
  };

  const handleSellProperty = (propertyId: string, amount: number) => {
    // Implementation for selling property to other players or bank
    console.log(`Selling property ${propertyId} for $${amount}`);
  };

  const handleTradeOffer = (toPlayer: string, offeredProps: string[], requestedProps: string[]) => {
    // Implementation for trading properties
    console.log('Trade offer:', { toPlayer, offeredProps, requestedProps });
  };

  const handleCreateLobby = async (settings: GameSettings, code: string, playerName: string, color?: string, icon?: string) => {
    try {
      const roomRef = doc(db, 'games', code);
      const initialState = getInitialState();
      const hostPlayer: Player = {
        id: 'player-1',
        name: playerName || 'Host',
        balance: settings.startingBalance || 1500000,
        properties: [],
        position: 0,
        color: color || '#06B6D4',
        isActive: true,
        isInJail: false,
        jailTurns: 0,
        pieceIcon: icon || '🔵',
        discoveredProperties: [0]
      };

      let players: Player[] = [hostPlayer];

      if (settings.singlePlayer) {
        const botPlayer: Player = {
          id: 'player-2',
          name: 'Bot Noob',
          balance: settings.startingBalance || 1500000,
          properties: [],
          position: 0,
          color: '#FF0090',  // Neon magenta — distinct from all 6 player token options
          isActive: true,
          isInJail: false,
          jailTurns: 0,
          pieceIcon: '🤖',
          isBot: true,
          discoveredProperties: [0]
        };
        players = [hostPlayer, botPlayer];
      }

      const firstState: GameState = {
         ...initialState,
         players,
         workers: [],
         pendingCard: null,
         gamePhase: settings.singlePlayer ? 'playing' : 'setup',
         settings: {
           ...initialState.settings,
           ...settings,
           gameMode: settings.auctionsEnabled ? 'auction' : 'classic'
         }
      };

      await setDoc(roomRef, {
        gameState: firstState,
        status: settings.singlePlayer ? 'playing' : 'waiting',
        hostName: playerName,
        lastUpdated: Date.now(),
        playerCount: players.length
      });

      setLobbyCode(code);
      setLocalPlayerId('player-1');
      setIsLobbyOwner(true);
      setShowLobby(false);
    } catch (e: any) {
      console.error("Firebase Room Creation Error:", e);
      alert("Failed to create the room! Please verify your Firebase Security Rules say 'allow read, write: if true;'. Error: " + e.message);
    }
  };

  const handleJoinLobby = async (code: string, playerName: string, color?: string, icon?: string) => {
    try {
      const roomRef = doc(db, 'games', code);
      const snap = await getDoc(roomRef);
      if (snap.exists()) {
        const data = snap.data();
        const state = data.gameState as GameState;
        
        let joinedPlayerId = '';
        const existingPlayer = state.players.find(p => p.name === playerName);
        if (existingPlayer) {
          // Reconnect: restore identity, apply any newly-selected token color/icon
          joinedPlayerId = existingPlayer.id;
          const updatedPlayers = state.players.map(p =>
            p.id === existingPlayer.id
              ? { ...p, color: color || p.color, pieceIcon: icon || p.pieceIcon, isActive: true }
              : p
          );
          await setDoc(roomRef, { ...data, gameState: { ...state, players: updatedPlayers }, lastUpdated: Date.now() });
        } else {
          if (state.players.length >= state.settings.maxPlayers) {
            alert('Lobby is currently full!');
            return;
          }
          
          joinedPlayerId = `player-${state.players.length + 1}`;
          const colors = ['#00C8E0', '#7C3AED', '#F43F5E', '#F59E0B', '#10B981', '#EC4899', '#F97316', '#06B6D4'];
          const icons = ['🌊', '⚡', '🌹', '⭐', '🍀', '🔮', '🔸', '🌐'];
          const newPlayer: Player = {
            id: joinedPlayerId,
            name: playerName || `Player ${state.players.length + 1}`,
            balance: state.settings.startingBalance || 1500000,
            properties: [],
            position: 0,
            color: color || colors[state.players.length] || '#000',
            isActive: true,
            isInJail: false,
            jailTurns: 0,
            pieceIcon: icon || icons[state.players.length] || '👤',
            discoveredProperties: [0]
          };
          
          state.players.push(newPlayer);
          
          // Check auto-start
          if (state.players.length === state.settings.maxPlayers) {
            if (state.settings.auctionsEnabled) {
              state.preAuctionPhase = true;
              state.gamePhase = 'auction';
            } else {
              state.gamePhase = 'playing';
            }
          }
          await setDoc(roomRef, { 
            ...data, 
            gameState: state,
            lastUpdated: Date.now(),
            playerCount: state.players.length
          });
        }
        
        setLobbyCode(code);
        setLocalPlayerId(joinedPlayerId);
        setIsLobbyOwner(false);
        setShowLobby(false);
      } else {
        alert("Room not found! Please check the code and try again.");
      }
    } catch (error) {
      console.error("Error joining room:", error);
      alert("Error joining room. Check console for details.");
    }
  };

  const handleStartGame = () => {
    setShowPreAuctionDialog(false);
    if (gameState.settings.auctionsEnabled) {
      startPreAuction();
    } else {
      // For classic mode, just set the game phase to playing
      setGameMode('classic');
    }
  };

  const handleDismissEvent = (eventId: string) => {
    // In a real implementation, this would remove the event from the game state
    console.log('Dismissing event:', eventId);
  };

  // Show lobby system if not in game yet
  if (showLobby) {
    return <LobbySystem onCreateLobby={handleCreateLobby} onJoinLobby={handleJoinLobby} />;
  }

  if (gameState.gamePhase === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="text-center text-white bg-slate-900/50 p-8 rounded-xl border border-cyan-400/30">
          <h1 className="text-4xl font-bold mb-4">Waiting for players to join...</h1>
          <p className="text-2xl mb-8 font-mono bg-black/40 py-2 px-4 rounded-lg inline-block text-green-400">
            Lobby Code: {lobbyCode}
          </p>
          <p className="text-xl mb-4 text-cyan-200">
            Players Joined: {gameState.players.length} / {gameState.settings.maxPlayers}
          </p>
          <div className="mt-8 flex justify-center gap-4 flex-wrap max-w-2xl mx-auto">
            {gameState.players.map(p => (
              <Badge key={p.id} style={{backgroundColor: p.color}} className="text-xl py-3 px-6 shadow-lg text-white border-2 border-white/20">
                <span className="mr-2 text-2xl" dangerouslySetInnerHTML={{__html: p.pieceIcon}} /> {p.name}
              </Badge>
            ))}
          </div>
          {isLobbyOwner && gameState.settings.allowPropertyEditing && (
            <div className="mt-8 flex justify-center">
              <Button onClick={() => setIsEditorOpen(true)} className="bg-purple-600 hover:bg-purple-700 font-bold text-lg px-8 py-4 shadow-xl border border-purple-400/50 transition-all hover:scale-105">
                ✏️ Open Property Editor
              </Button>
            </div>
          )}
          <p className="mt-12 text-slate-400 italic">
            The game will start automatically when the lobby limit is reached.
          </p>
        </div>
        
        <GameConsole
           isOpen={isEditorOpen}
           onClose={() => setIsEditorOpen(false)}
           properties={gameState.properties}
           customPropertyLists={gameState.settings.customPropertyLists || {}}
           preAuctionProperties={gameState.settings.preAuctionProperties || []}
           gameMode={gameState.settings.gameMode}
           onUpdateProperty={updateProperty}
           onUpdatePropertyList={updatePropertyList}
           onAddPropertyToList={addPropertyToList}
           onRemovePropertyFromList={removePropertyFromList}
           onSetPreAuctionProperties={setPreAuctionProperties}
           onSetGameMode={setGameMode}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100">
      {/* Rules Panel */}
      {showRules && (
        <RulesPanel settings={gameState.settings} onClose={() => setShowRules(false)} />
      )}

      {/* Special Property Info Overlay */}
      {selectedSpecialProperty && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedSpecialProperty(null)}
        >
          <div className="w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <SpecialPropertyInfo property={selectedSpecialProperty} players={gameState.players} />
            <p className="text-center text-slate-400 text-xs mt-3 animate-pulse">Click anywhere to close</p>
          </div>
        </div>
      )}

      {/* Transaction Notifications */}
      <TransactionNotification 
        events={gameState.gameEvents}
        onDismiss={handleDismissEvent}
      />

      {/* Property Details Overlay - Center Screen */}
      {selectedProperty && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedProperty(null)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm transform transition-all animate-in zoom-in-95 duration-200">
            <PropertyCard
              property={selectedProperty}
              isOwned={selectedProperty.isOwned}
              canBuyHouse={isMyTurn && selectedProperty.owner === myPlayer.name}
              canBuyHotel={isMyTurn && selectedProperty.owner === myPlayer.name}
              onBuyHouse={() => buildHouse(selectedProperty.id)}
              onBuyHotel={() => buildHotel(selectedProperty.id)}
              onSellHouse={() => sellHouse(selectedProperty.id)}
              onSellHotel={() => sellHotel(selectedProperty.id)}
              onMortgage={() => mortgageProperty(selectedProperty.id)}
              onUnmortgage={() => unmortgageProperty(selectedProperty.id)}
              allProperties={gameState.properties}
            />
            <p className="text-center text-slate-400 text-xs mt-4 animate-pulse">Click anywhere to close</p>
          </div>
        </div>
      )}

      {/* Dialogs & Overlays removed from global space to board space */}
      
      {/* Game Header — compact single row */}
      <Card className="mb-3 bg-slate-900 border border-slate-800 shadow-md py-0">
        <CardHeader className="py-2 px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <img src="/favicon.svg" alt="Monopoly Madness Icon" className="w-6 h-6 animate-pulse" />
              <span className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-500">Monopoly Madness</span>
              <Badge className="bg-emerald-900/50 border-emerald-500/50 text-emerald-300 font-mono px-3 border-2 shadow-sm text-sm">
                {lobbyCode}
              </Badge>
              <Badge className="bg-indigo-900/50 text-indigo-300 border border-indigo-700/50 px-2 flex items-center gap-1 text-xs">
                <span dangerouslySetInnerHTML={{__html: myPlayer.pieceIcon}} />
                <span>{myPlayer.name}</span>
              </Badge>
              <Badge className="bg-slate-800/80 text-slate-300 border border-slate-600 px-2 text-xs">
                Turn {gameState.turn + 1} · {gameState.players.filter(p => p.isActive).length} active
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              {isLobbyOwner && gameState.settings.allowPropertyEditing && (
                <Button onClick={() => setIsEditorOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-7 px-2 border border-purple-400/50">
                  ✏️ Edit
                </Button>
              )}
              {gameState.settings.workersEnabled && (
                <Button onClick={() => setIsWorkerPanelOpen(true)} className="bg-amber-700 hover:bg-amber-600 text-white font-bold text-xs h-7 px-2 border border-amber-500/50">
                  👷
                </Button>
              )}
              <Button onClick={() => setShowAchievements(true)} className="bg-yellow-700/80 hover:bg-yellow-600 text-white font-bold text-xs h-7 px-2 border border-yellow-500/50" title="Achievements">
                🏆 {unlockedAchievements.size}/{ACHIEVEMENTS.length}
              </Button>
              <Button onClick={() => setShowRules(true)} className="bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs h-7 px-2 border border-slate-500/60">
                📖
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Game Layout */}
      <div className="flex flex-col gap-6">
        {/* Top/Main Area - Game Board and Dice */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="w-full lg:w-3/4 flex justify-center">
          <MonopolyBoardLayout
            properties={gameState.properties}
            players={gameState.players}
            onPropertyClick={handlePropertyClick}
            selectedProperty={selectedProperty}
            lastDiceRoll={gameState.lastDiceRoll}
            currentEvent={currentDisplayEvent}
            currentPlayer={currentPlayer.name}
            isRolling={isRolling}
            onRollDice={handleDiceRoll}
            onEndTurn={endTurn}
            canRoll={gameState.turnState === 'waiting_for_roll' && isMyTurn}
            canEndTurn={gameState.turnState === 'completed' && isMyTurn}
            turnState={gameState.turnState}
            playerColor={currentPlayer.color}
            blindPickEnabled={gameState.settings.blindPickEnabled}
            discoveredProperties={myPlayer.discoveredProperties}
            workers={gameState.workers || []}
            tradingEnabled={gameState.settings.tradingEnabled}
            onTradeClick={() => setIsTradingOpen(true)}
            isMyTurn={isMyTurn}
            turnTimer={isMyTurn ? turnTimer : null}
            turnTimerDuration={gameState.settings.turnTimerDuration}
          >
            {(showJailDialog || myPendingCard || myPendingRentData || currentAuctionData || pendingPurchaseData || ownedPropertyOnTile || landedOnOwnProperty) ? (
              <div className="absolute inset-0 z-50 flex items-center justify-center p-1 sm:p-4 bg-slate-950/90 rounded-sm backdrop-blur-sm overflow-y-auto overflow-x-hidden pointer-events-auto">
                <div className="w-full max-w-sm h-fit">
                  {showJailDialog ? (
                    <div className="bg-slate-900 rounded-xl shadow-2xl w-full border-2 border-rose-500 p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">🔒</span>
                        <div>
                          <h3 className="text-lg font-bold text-rose-400">You're in Jail!</h3>
                          <p className="text-xs text-slate-400">{myPlayer.jailTurns} turn{myPlayer.jailTurns !== 1 ? 's' : ''} remaining</p>
                        </div>
                      </div>
                      {jailFine > 0 ? (
                        <div className="bg-rose-950/40 rounded-lg p-3 border border-rose-800/50 text-sm space-y-1">
                          <p className="text-slate-300">Income properties: <span className="text-white font-bold">{jailNumProperties}</span></p>
                          <p className="text-slate-300">Total rental income: <span className="text-white font-bold">${jailIncome.toLocaleString('en-US')}</span></p>
                          <p className="text-slate-300">Bail fine (20%): <span className="text-rose-300 font-bold">${jailFine.toLocaleString('en-US')}</span></p>
                          <p className="text-xs text-slate-500">Pay now to roll and move freely this turn.</p>
                        </div>
                      ) : (
                        <p className="text-slate-400 text-sm">You have no property income — you cannot afford bail.</p>
                      )}
                      <div className="flex gap-3">
                        {jailFine > 0 && myPlayer.balance >= jailFine && (
                          <button
                            onClick={payJailFine}
                            className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors"
                          >
                            Pay ${jailFine.toLocaleString('en-US')} &amp; Roll
                          </button>
                        )}
                        <button
                          onClick={skipJailTurn}
                          className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
                        >
                          Stay in Jail
                        </button>
                      </div>
                    </div>
                  ) : myPendingCard ? (
                    <div className={`bg-slate-900 rounded-xl shadow-2xl w-full border-2 ${myPendingCard.isReward ? 'border-yellow-500' : 'border-red-600'} p-5 space-y-4`}>
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{myPendingCard.type === 'chance' ? '🎲' : '📋'}</span>
                        <div>
                          <h3 className={`text-lg font-bold ${myPendingCard.isReward ? 'text-yellow-400' : 'text-red-400'}`}>
                            {myPendingCard.type === 'chance' ? 'Chance' : 'Community Chest'}
                          </h3>
                          <p className="text-xs text-slate-400">Dice roll: {myPendingCard.diceRoll} ({myPendingCard.diceRoll % 2 !== 0 ? 'odd → reward' : 'even → penalty'})</p>
                        </div>
                      </div>
                      {myPendingCard.amount > 0 ? (
                        <div className={`rounded-lg p-3 border text-sm space-y-1 ${myPendingCard.isReward ? 'bg-yellow-950/40 border-yellow-800/50' : 'bg-red-950/40 border-red-800/50'}`}>
                          <p className="text-slate-300">Total property income: <span className="text-white font-bold">${myPendingCard.income.toLocaleString('en-US')}</span></p>
                          <p className="text-slate-300">Properties owned: <span className="text-white font-bold">{myPendingCard.numProperties}</span></p>
                          <p className="text-slate-300">10% of income: <span className={`font-bold ${myPendingCard.isReward ? 'text-yellow-300' : 'text-red-300'}`}>{myPendingCard.isReward ? '+' : '-'}${myPendingCard.amount.toLocaleString('en-US')}</span></p>
                        </div>
                      ) : (
                        <p className="text-slate-400 text-sm">No properties — no reward or penalty this time.</p>
                      )}
                      <button
                        onClick={() => { setCardResolved(true); resolveCard(); }}
                        className={`w-full font-bold py-2 px-4 rounded-lg text-sm transition-colors text-white ${myPendingCard.isReward ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-red-700 hover:bg-red-800'}`}
                      >
                        {(myPendingCard.amount ?? 0) > 0 ? (myPendingCard.isReward ? `Collect $${(myPendingCard.amount ?? 0).toLocaleString('en-US')}` : `Pay $${(myPendingCard.amount ?? 0).toLocaleString('en-US')}`) : 'Continue'}
                      </button>
                    </div>
                  ) : myPendingRentData ? (
                    <div className="bg-slate-900 rounded-xl shadow-2xl w-full border border-slate-700">
                      <RentPaymentDialog
                        property={myPendingRentData.property}
                        amount={myPendingRentData.amount}
                        owner={myPendingRentData.owner}
                        onPayRent={payRent}
                        onSkipRent={skipRent}
                        currentPlayerBalance={myPlayer.balance || 0}
                      />
                    </div>
                  ) : landedOnOwnProperty ? (
                    <div className="bg-slate-900 rounded-xl shadow-2xl w-full border-2 border-emerald-500 p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">🏠</span>
                        <div>
                          <h3 className="text-lg font-bold text-emerald-400">Your Property</h3>
                          <p className="text-xs text-slate-400">{propertyOnMyTile?.name}</p>
                        </div>
                      </div>
                      {propertyOnMyTile && propertyOnMyTile.type === 'property' && !propertyOnMyTile.hasHotel && (
                        <div className="bg-emerald-950/40 rounded-lg p-3 border border-emerald-800/50 text-sm space-y-1">
                          <p className="text-slate-300">Houses: <span className="text-white font-bold">{propertyOnMyTile.houses} / 4</span></p>
                          <p className="text-slate-300">Next house cost: <span className="text-emerald-300 font-bold">${((propertyOnMyTile.houseCost || 0) * (propertyOnMyTile.houses + 1)).toLocaleString('en-US')}</span></p>
                        </div>
                      )}
                      <div className="flex gap-3">
                        {propertyOnMyTile && propertyOnMyTile.type === 'property' && !propertyOnMyTile.hasHotel && (
                          propertyOnMyTile.houses < 4 ? (
                            canBuildHouse(propertyOnMyTile, myPlayer.name) ? (
                              <button
                                onClick={() => { buildHouse(propertyOnMyTile.id); endTurn(); }}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors"
                              >
                                Build House 🏠
                              </button>
                            ) : (
                              <p className="flex-1 text-xs text-amber-400 text-center self-center">
                                Need full color group to build
                              </p>
                            )
                          ) : (
                            <button
                              onClick={() => { buildHotel(propertyOnMyTile.id); endTurn(); }}
                              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors"
                            >
                              Build Hotel 🏨
                            </button>
                          )
                        )}
                        <button
                          onClick={endTurn}
                          className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
                        >
                          End Turn
                        </button>
                      </div>
                    </div>
                  ) : (
                    <AuctionPanel
                      currentAuction={currentAuctionData}
                      pendingPurchase={pendingPurchaseData}
                      ownedPropertyOnTile={ownedPropertyOnTile}
                      onPlaceBid={placeBid}
                      onBuyNow={() => {
                        if (gameState.pendingPurchase) {
                          purchaseProperty(gameState.pendingPurchase.propertyId);
                        }
                      }}
                      onSkipPurchase={() => skipPurchase()}
                      onStartAuction={(pid, startingBid) => startAuction(pid, myPlayer.name, startingBid)}
                      onMakeOffer={(amount) => {
                        if (ownedPropertyOnTile && ownedPropertyOnTile.owner) {
                          createTradeOffer(
                            ownedPropertyOnTile.owner,
                            [],
                            [ownedPropertyOnTile.id],
                            amount,
                            0
                          );
                        }
                      }}
                      onPassOffer={() => {
                        setOfferDismissed(true);
                        if (gameState.turnState === 'waiting_for_action' && !gameState.pendingRent && !gameState.pendingPurchase) {
                          endTurn();
                        }
                      }}
                      onEndAuction={endAuction}
                      players={gameState.players.map(p => p.name)}
                      currentPlayer={myPlayer.name}
                      auctionsEnabled={gameState.settings.auctionsEnabled}
                    />
                  )}
                </div>
              </div>
            ) : showWorkerNudge ? (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 pointer-events-none select-none">
                <div className="bg-amber-900/90 border border-amber-500/60 text-amber-200 text-xs font-semibold px-4 py-2 rounded-full shadow-lg animate-pulse whitespace-nowrap">
                  👷 Assign workers before rolling — tap 👷 in the header
                </div>
              </div>
            ) : null}
          </MonopolyBoardLayout>
          </div>
          
            <div className="w-full lg:w-1/4 space-y-6">
              {/* Active Mode Pills */}
              <div className="flex flex-wrap gap-1 justify-center">
                {[
                  gameState.settings.auctionsEnabled   && { label: '🔨 Auctions',    bg: 'bg-yellow-700/80 border-yellow-500/60' },
                  gameState.settings.teamsEnabled       && { label: '🤝 Teams',        bg: 'bg-indigo-700/80 border-indigo-500/60' },
                  gameState.settings.tradingEnabled     && { label: '🔄 Trading',      bg: 'bg-green-700/80 border-green-500/60' },
                  gameState.settings.workersEnabled     && { label: '👷 Workers',      bg: 'bg-amber-700/80 border-amber-500/60' },
                  gameState.settings.allowPropertyEditing && { label: '✏️ Editor',     bg: 'bg-purple-700/80 border-purple-500/60' },
                  gameState.settings.blindPickEnabled   && { label: '🙈 Blind Pick',   bg: 'bg-slate-600/80 border-slate-400/60' },
                  gameState.settings.mortgageEnabled    && { label: '🏦 Mortgage',     bg: 'bg-rose-700/80 border-rose-500/60' },
                  !gameState.settings.auctionsEnabled && !gameState.settings.teamsEnabled && !gameState.settings.tradingEnabled
                    && { label: '🎲 Classic',     bg: 'bg-cyan-700/80 border-cyan-500/60' },
                ].filter(Boolean).map((m: any) => (
                  <span key={m.label} className={`text-[0.65rem] font-semibold text-white px-2 py-0.5 rounded-full border ${m.bg}`}>
                    {m.label}
                  </span>
                ))}
              </div>
              
              {/* My Portfolio */}
              <PlayerPanel
                currentPlayer={myPlayer}
                allPlayers={gameState.players}
                ownedProperties={myOwnedProperties}
                workers={gameState.workers || []}
                workersEnabled={gameState.settings.workersEnabled}
                onMortgage={mortgageProperty}
                onUnmortgage={unmortgageProperty}
                onSell={handleSellProperty}
                onTrade={handleTradeOffer}
              />

              {/* Team Panel - Only visible if teams enabled */}
              {gameState.settings.teamsEnabled && (
                <TeamPanel
                  currentPlayer={myPlayer}
                  teams={gameState.teams}
                  players={gameState.players}
                  onJoinTeam={joinTeam}
                  onCreateTeam={createTeam}
                />
              )}
            </div>
        </div>

        {/* Bottom Section - Control Panels */}
        <div className="flex flex-col gap-6">
          {/* Only show relevant panels based on game state */}
          {(gameState.gamePhase as string) !== 'setup' && (
            <>
              {/* Players Summary Table - Dark theme */}
              <Card className="bg-black border border-slate-800 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-400" />
                    Players Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-800">
                          <TableHead className="w-8 text-slate-300">#</TableHead>
                          <TableHead className="text-slate-300">Player</TableHead>
                          <TableHead className="text-slate-300">Cash</TableHead>
                          <TableHead className="text-slate-300">Net Worth</TableHead>
                          <TableHead className="text-slate-300 min-w-28">Properties</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...gameState.players]
                          .map(p => {
                            const propVal = gameState.properties.filter(prop => prop.owner === p.name).reduce((s, prop) => s + prop.currentValue, 0);
                            return { ...p, netWorth: p.balance + propVal };
                          })
                          .sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0) || b.netWorth - a.netWorth)
                          .map((p, idx) => {
                          const propsOwned = gameState.properties.filter(prop => prop.owner === p.name);
                          const isCurrent = gameState.currentPlayer === p.id;
                          const fmtNW = (n: number) => n >= 1000000 ? `$${(n/1000000).toFixed(2)}M` : n >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${n}`;
                          return (
                            <TableRow key={p.id} className={`border-slate-800 flex-1 ${isCurrent ? 'bg-slate-900/50' : ''} ${!p.isActive ? 'opacity-40' : ''}`}>
                              <TableCell className="text-slate-400 font-bold text-sm">{idx + 1}</TableCell>
                              <TableCell className="text-slate-100 font-medium">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg" style={{ color: p.color }} dangerouslySetInnerHTML={{__html: p.pieceIcon}} />
                                  <span>{p.name} {p.id === localPlayerId ? '(You)' : ''}</span>
                                  {isCurrent && (
                                    <Badge className="ml-1 bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[0.65rem] px-1 py-0 uppercase">Turn</Badge>
                                  )}
                                  {p.isInJail && (
                                    <Badge variant="destructive" className="ml-1 text-[0.65rem] px-1 py-0">Jail ({p.jailTurns})</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-emerald-400 font-mono font-bold tracking-tight">{fmtNW(p.balance)}</TableCell>
                              <TableCell className="text-cyan-300 font-mono font-bold tracking-tight">{fmtNW((p as any).netWorth)}</TableCell>
                              <TableCell className="text-slate-200">
                                {propsOwned.length === 0 ? (
                                  <span className="text-slate-600 italic text-xs">None</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {propsOwned.map(op => (
                                      <Badge key={op.id} variant="secondary" className="text-[0.65rem] bg-slate-800 text-slate-300 border-slate-700 py-0">
                                        {op.name}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Trading System Dialog */}
              <Dialog open={isTradingOpen} onOpenChange={setIsTradingOpen}>
                <DialogContent className="max-w-4xl bg-slate-900 border border-purple-500 max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-purple-400 flex items-center gap-2">
                      <Handshake className="w-6 h-6" />
                      Trading Market
                    </DialogTitle>
                  </DialogHeader>
                  <TradingSystem
                    currentPlayer={myPlayer}
                    allPlayers={gameState.players}
                    ownedProperties={myOwnedProperties}
                    allProperties={gameState.properties}
                    tradeOffers={gameState.tradeOffers}
                    onCreateTradeOffer={createTradeOffer}
                    onAcceptTradeOffer={acceptTradeOffer}
                    onRejectTradeOffer={rejectTradeOffer}
                    onCancelTradeOffer={cancelTradeOffer}
                    onPlaceTradeBid={() => {}}
                  />
                </DialogContent>
              </Dialog>

              {/* Game Log Drawer Trigger */}
              <div className="fixed bottom-4 right-4 z-[150]">
                <Button 
                  onClick={() => setIsLogOpen(true)} 
                  className="bg-slate-800 text-white hover:bg-slate-700 shadow-xl border border-slate-600 flex items-center gap-2 px-6 py-4 rounded-full"
                >
                  📜 <span className="hidden sm:inline">Game Log</span>
                </Button>
              </div>
            </>
          )}

          {/* Pre-Auction Dialog */}
          <Dialog open={showPreAuctionDialog} onOpenChange={setShowPreAuctionDialog}>
            <DialogContent className="max-w-md bg-slate-900 border-2 border-yellow-500 text-white">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-yellow-500 flex items-center gap-3">
                  <Gavel className="w-6 h-6" />
                  Pre-Auction Phase
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-slate-300">
                  Auction mode is enabled! You will now bid for properties before starting the standard game.
                </p>
                <div className="bg-yellow-500/10 p-4 rounded-lg border border-yellow-500/20">
                  <h4 className="font-bold text-yellow-400 mb-2">Rules:</h4>
                  <ul className="text-sm text-slate-300 space-y-2">
                    <li className="flex gap-2"><span>•</span> <span>Starting bids are 70% of market value.</span></li>
                    <li className="flex gap-2"><span>•</span> <span>Highest bidder wins property instantly.</span></li>
                    <li className="flex gap-2"><span>•</span> <span>Main game starts after all properties are auctioned.</span></li>
                  </ul>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  onClick={handleStartGame}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-6 text-lg"
                >
                  Start Bidding
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Workers Panel Dialog */}
      {gameState.settings.workersEnabled && (
        <Dialog open={isWorkerPanelOpen} onOpenChange={setIsWorkerPanelOpen}>
          <DialogContent className="max-w-lg bg-slate-900 border-2 border-amber-500 text-white max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-amber-400 flex items-center gap-2">
                👷 Worker Assignment
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-slate-400 text-sm">
                Workers live on your properties and build automatically — one house each time you pass GO. At 4 houses they upgrade to a hotel. Pick their look before assigning.
              </p>
              {/* Worker color picker */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-amber-300">Worker Appearance</label>
                <div className="flex gap-2 flex-wrap items-center">
                  {['#000000', '#3A3A3A', '#7A6A5A', '#B8A090', '#FFE5B4', '#FFF0D8', '#FFFFFF'].map(c => (
                    <button
                      key={c}
                      onClick={() => setWorkerPickColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${workerPickColor === c ? 'border-amber-400 scale-110' : 'border-slate-600'}`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                  <input
                    type="color"
                    value={workerPickColor}
                    onChange={e => setWorkerPickColor(e.target.value)}
                    className="w-7 h-7 rounded cursor-pointer border border-slate-600 bg-transparent"
                    title="Custom color"
                  />
                </div>
              </div>

              {/* Property list for assignment */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-amber-300">Your Properties</label>
                {myOwnedProperties.filter(p => p.type === 'property').length === 0 ? (
                  <p className="text-slate-500 text-sm italic">You don't own any properties yet.</p>
                ) : (
                  myOwnedProperties.filter(p => p.type === 'property').map(prop => {
                    const worker = (gameState.workers || []).find(w => w.propertyId === prop.id);
                    return (
                      <div key={prop.id} className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-700">
                        <div className="flex items-center gap-2 min-w-0">
                          {worker && (
                            <div className="w-4 h-4 rounded-full border border-black/30 flex-shrink-0" style={{ backgroundColor: worker.color }} title="Worker" />
                          )}
                          <span className="text-sm text-white truncate">{prop.name}</span>
                          <span className="text-xs text-slate-500">
                            {prop.hasHotel ? '🏨' : prop.houses > 0 ? `🏠×${prop.houses}` : '—'}
                          </span>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {!worker ? (
                            <button
                              onClick={() => assignWorker(prop.id, workerPickColor)}
                              disabled={!isMyTurn || gameState.turnState !== 'waiting_for_roll'}
                              title={(!isMyTurn || gameState.turnState !== 'waiting_for_roll') ? 'Can only assign before rolling on your turn' : ''}
                              className="text-xs bg-amber-700 hover:bg-amber-600 text-white px-2 py-1 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Assign
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => updateWorkerColor(prop.id, workerPickColor)}
                                className="text-xs bg-slate-600 hover:bg-slate-500 text-white px-2 py-1 rounded transition-colors"
                              >
                                Recolor
                              </button>
                              <button
                                onClick={() => removeWorker(prop.id)}
                                className="text-xs bg-red-800 hover:bg-red-700 text-white px-2 py-1 rounded transition-colors"
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Achievements Dialog */}
      <Dialog open={showAchievements} onOpenChange={setShowAchievements}>
        <DialogContent className="max-w-md bg-slate-900 border-2 border-yellow-500 text-white max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-yellow-400 flex items-center gap-2">
              🏆 Achievements <span className="text-base font-normal text-slate-400 ml-1">({unlockedAchievements.size} / {ACHIEVEMENTS.length})</span>
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 py-2">
            {ACHIEVEMENTS.map(ach => {
              const unlocked = unlockedAchievements.has(ach.id);
              return (
                <div
                  key={ach.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    unlocked
                      ? 'border-yellow-500/50 bg-yellow-950/30'
                      : 'border-slate-700 bg-slate-800/20 opacity-40 grayscale'
                  }`}
                >
                  <span className="text-2xl flex-shrink-0">{ach.icon}</span>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-white">{ach.title}</div>
                    <div className="text-xs text-slate-400">{ach.description}</div>
                  </div>
                  {unlocked && <span className="ml-auto text-yellow-400 text-lg flex-shrink-0">✓</span>}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-600 text-center pt-2 border-t border-slate-800">
            Saved locally in your browser · Google Play integration coming soon
          </p>
        </DialogContent>
      </Dialog>

      {/* Bottom Drawer: Game Log — z-[200] ensures it renders above player token z-20 tokens */}
      <Drawer open={isLogOpen} onOpenChange={setIsLogOpen}>
        <DrawerContent className="max-h-[70vh] bg-slate-900 border-t border-slate-700 z-[200]">
          <div className="mx-auto w-12 h-1 bg-slate-700 rounded-full my-4" />
          <DrawerHeader>
            <DrawerTitle className="text-white flex items-center justify-center gap-2 text-xl">
              📜 Monopoly Game History
            </DrawerTitle>
          </DrawerHeader>
          <div className="p-4 overflow-y-auto custom-scrollbar">
            <GameLog events={gameState.gameEvents} players={gameState.players} />
          </div>
        </DrawerContent>
      </Drawer>

      {/* Game Editor Console for Active Game Editing */}
      <GameConsole
         isOpen={isEditorOpen}
         onClose={() => setIsEditorOpen(false)}
         properties={gameState.properties}
         customPropertyLists={gameState.settings.customPropertyLists || {}}
         preAuctionProperties={gameState.settings.preAuctionProperties || []}
         gameMode={gameState.settings.gameMode}
         onUpdateProperty={updateProperty}
         onUpdatePropertyList={updatePropertyList}
         onAddPropertyToList={addPropertyToList}
         onRemovePropertyFromList={removePropertyFromList}
         onSetPreAuctionProperties={setPreAuctionProperties}
         onSetGameMode={setGameMode}
      />
    </div>
  );
};

export default MonopolyGame;