import React, { useState, useEffect } from 'react';
import { ACHIEVEMENTS, getAchievementContext, loadUnlockedAchievements, saveUnlockedAchievements } from '@/lib/achievements';
import MonopolyBoardLayout from './MonopolyBoardLayout';
import CentralDisplay from './CentralDisplay';
import AuctionPanel from './AuctionPanel';
import PlayerPanel from './PlayerPanel';
import SpecialPropertyInfo from './SpecialPropertyInfo';
import RulesPanel from './RulesPanel';
import GameConsole from './GameConsole';
import LobbySystem from './LobbySystem';
import TransactionNotification from './TransactionNotification';
import TeamPanel from './TeamPanel';
import { db, authReady, currentUid } from '@/lib/firebase';
import { setClockOffset } from '@/lib/clock';
import { readableTextOn } from '@/lib/utils';
import '@/ui-kit/tokens.css';
import '@/ui-kit/cards/tokens.css';
import { DoublesBanner, InspectView } from '@/ui-kit/cards';
import { cardProps, type CardCtx } from './cardAdapters';
import { TurnStatus, GameOverCard, WaitingRoom, LogSheet } from '@/ui-kit';
import StageHost from './StageHost';
import TradeHost from './TradeHost';
import { WorkersHost, TeamsHost, PortfolioHost, PortfolioCards, PlayersSheet, TileSummaryStrip } from './SheetsHost';
import { PlayersList, InlineLog, BottomNav, netWorthOf } from './SideDock';
import { doc, getDoc, setDoc, onSnapshot, updateDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
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

/** Positions a kit sheet as a right-hand dock on desktop; on phones the kit's own bottom sheet takes over. */
const SheetDock: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="fixed z-[150] right-4 top-16 bottom-4 w-[min(480px,calc(100vw-2rem))] max-sm:contents pointer-events-none [&>*]:pointer-events-auto">{children}</div>
);

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
  const [showRules, setShowRules] = useState(false);
  const [selectedSpecialProperty, setSelectedSpecialProperty] = useState<Property | null>(null);
  const [offerDismissed, setOfferDismissed] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [unlockedAchievements, setUnlockedAchievements] = useState<Set<string>>(new Set());
  // Local flag to immediately hide the card dialog on click (Firestore update is async)
  const [cardResolved, setCardResolved] = useState(false);
  // Wait for anonymous sign-in (resolves to null if the provider is off — the app then runs unauthenticated)
  const [authChecked, setAuthChecked] = useState(false);
  const [winnerDismissed, setWinnerDismissed] = useState(false);
  const [roomCopied, setRoomCopied] = useState(false);
  const [isPortfolioOpen, setIsPortfolioOpen] = useState(false);
  const [doublesBanner, setDoublesBanner] = useState<'double' | 'triple' | null>(null);
  const [isTeamsOpen, setIsTeamsOpen] = useState(false);
  const [isPlayersOpen, setIsPlayersOpen] = useState(false);
  const [sideTab, setSideTab] = useState<'properties' | 'players' | 'log' | 'teams'>('properties');
  const [summaryProperty, setSummaryProperty] = useState<Property | null>(null);
  useEffect(() => { authReady.then(() => setAuthChecked(true)); }, []);
  // Player presence: maps playerId → last heartbeat epoch (stored outside gameState in Firestore)
  const [playerPresence, setPlayerPresence] = useState<Record<string, number>>({});
  const { toast } = useToast();
  
  const {
    gameState,
    auctionTimer,
    turnTimer,
    isRolling,
    randomizeProperties,
    startAuction,
    placeBid,
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
    spendJailCard,
    getJailFineAmount,
    resolveCard,
    assignWorker,
    removeWorker,
    updateWorkerColor,
    canBuildHouse,
    rematch
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
          if ((activeCp.jailCards || 0) > 0) {
            spendJailCardRef.current();
          } else if (fine > 0 && jailBalance >= fine) {
            payJailFineRef.current();
          } else {
            skipJailTurnRef.current();
          }
        }, 900);
      } else {
        timer = setTimeout(() => {
          // Bot Noob builds a house when it owns a full colour group and has plenty of cash
          const target = gameState.properties.find(p => p.owner === activeCp.name && p.type === 'property' && canBuildHouse(p, activeCp.name)
            && activeCp.balance >= (p.houseCost || 0) * (p.houses + 1) * 3);
          if (target) buildHouse(target.id);
          rollDiceForBotRef.current();
        }, 1200);
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

  // Bot Noob trade responder — accept/reject offers addressed to the bot.
  // Each offer is scheduled once; the timer is NOT cancelled when another offer arrives (that used to strand the
  // first one), and the decision re-reads the live offer when it fires.
  const botScheduledTradeIds = React.useRef<Set<string>>(new Set());
  const liveStateRef = React.useRef(gameState);
  liveStateRef.current = gameState;
  const botOfferKey = gameState.tradeOffers
    .filter(o => o.status === 'pending' && gameState.players.find(p => p.isBot)?.name === o.toPlayer)
    .map(o => o.id).join(',');
  useEffect(() => {
    const botPlayer = liveStateRef.current.players.find(p => p.isBot);
    if (!botPlayer || liveStateRef.current.gamePhase !== 'playing' || !botOfferKey) return;
    botOfferKey.split(',').forEach(offerId => {
      if (botScheduledTradeIds.current.has(offerId)) return;
      botScheduledTradeIds.current.add(offerId);
      setTimeout(() => {
        const st = liveStateRef.current;
        const offer = st.tradeOffers.find(o => o.id === offerId);
        if (!offer || offer.status !== 'pending') return;
        const valueOf = (ids: string[]) => ids.reduce((sum, id) => sum + (st.properties.find(p => p.id === id)?.currentValue || 0), 0);
        const giveValue = valueOf(offer.requestedProperties) + offer.requestedCash;
        const getValue = valueOf(offer.offeredProperties) + offer.offeredCash;
        // Accept if getting >= 85% of value given, or 25% random goodwill
        if (getValue >= giveValue * 0.85 || Math.random() < 0.25) acceptTradeOfferRef.current(offer.id, botPlayer.name);
        else rejectTradeOfferRef.current(offer.id);
      }, 2000 + Math.random() * 2000);
    });
  }, [botOfferKey]);

  // Bot Noob bids on live auctions (independent of whose turn it is)
  useEffect(() => {
    const botPlayer = gameState.players.find(p => p.isBot);
    if (!botPlayer || !gameState.currentAuction || (gameState.gamePhase !== 'playing' && gameState.gamePhase !== 'auction')) return;

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

  // "Doubles — roll again" / "three doubles" banner for 1.5 s after a double roll (non-blocking)
  const rollKey = gameState.lastDiceRoll ? `${gameState.turn}-${gameState.lastDiceRoll.dice1}-${gameState.lastDiceRoll.dice2}` : '';
  useEffect(() => {
    if (!rollKey || !gameState.lastDiceRoll?.isDouble) return;
    const roller = gameState.players.find(p => p.id === gameState.currentPlayer);
    setDoublesBanner(roller?.isInJail ? 'triple' : 'double');
    const t = setTimeout(() => setDoublesBanner(null), 1600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollKey]);

  // Escape closes the property / special-tile overlays
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSelectedProperty(null); setSelectedSpecialProperty(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // A rejected/failed Firestore write used to vanish into the console
  useEffect(() => {
    const onWriteError = (e: Event) => {
      toast({ title: 'Action not saved', description: `The server rejected or lost that move (${(e as CustomEvent).detail}). Check your connection and try again.`, variant: 'destructive', duration: 6000 });
      setCardResolved(false);
    };
    window.addEventListener('mma:write-error', onWriteError);
    return () => window.removeEventListener('mma:write-error', onWriteError);
  }, [toast]);

  // Win toast — fires once when winnerId is set
  useEffect(() => {
    if (!gameState.winnerId) return;
    const winner = gameState.players.find(p => p.id === gameState.winnerId);
    if (!winner) return;
    const winningTeam = gameState.winnerTeamId ? gameState.teams.find(t => t.id === gameState.winnerTeamId) : null;
    const iWon = winningTeam ? myPlayer.teamId === winningTeam.id : winner.id === localPlayerId;
    if (iWon) {
      toast({ title: '🏆 You Win!', description: winningTeam ? `Team ${winningTeam.name} is the last alliance standing!` : `Congratulations ${winner.name}! You're the last player standing!`, duration: 12000 });
    } else {
      toast({ title: winningTeam ? `🏆 Team ${winningTeam.name} Wins!` : `🏆 ${winner.name} Wins!`, description: winningTeam ? 'Only one alliance is left standing.' : `${winner.name} is the last player standing. Better luck next time!`, duration: 8000 });
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
  const spendJailCardRef = React.useRef(spendJailCard);
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
  useEffect(() => { spendJailCardRef.current = spendJailCard; }, [spendJailCard]);
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


  // Host heartbeat and cleanup
  useEffect(() => {
    if (!isLobbyOwner || !lobbyCode) return;

    // Heartbeat every 30 seconds to keep game active
    const heartbeat = setInterval(async () => {
      try {
        // Touch ONLY lastUpdated. (It used to read the whole room and write it back, which could revert a
        // game action committed in between — including the 'ended' status.)
        await updateDoc(doc(db, 'games', lobbyCode), { lastUpdated: Date.now() });
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

  // Subscribe to playerPresence field (stored at doc root, outside gameState)
  // The same listener estimates this browser's clock offset from a Firestore server timestamp ("clock probe")
  // so turn and auction timers count down to the same instant on every device.
  const lastProbeMs = React.useRef<number | null>(null);
  useEffect(() => {
    if (!lobbyCode || showLobby) return;
    const roomRef = doc(db, 'games', lobbyCode);
    const uid = currentUid();
    const unsub = onSnapshot(roomRef, snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      setPlayerPresence(data.playerPresence || {});
      const probe = uid ? data.clockProbe?.[uid] : null;
      if (!snap.metadata.hasPendingWrites && probe?.toMillis) {
        const ms = probe.toMillis();
        if (ms !== lastProbeMs.current) { lastProbeMs.current = ms; setClockOffset(ms - Date.now()); }
      }
    });
    const sendProbe = () => { if (uid) updateDoc(roomRef, { [`clockProbe.${uid}`]: serverTimestamp() }).catch(() => {}); };
    sendProbe();
    const probeTimer = setInterval(sendProbe, 5 * 60 * 1000);
    return () => { unsub(); clearInterval(probeTimer); };
  }, [lobbyCode, showLobby]);

  // Heartbeat: every player updates their own presence entry every 20 seconds
  useEffect(() => {
    if (!lobbyCode || showLobby || !localPlayerId) return;
    const roomRef = doc(db, 'games', lobbyCode);
    const ping = () => updateDoc(roomRef, { [`playerPresence.${localPlayerId}`]: Date.now() }).catch(() => {});
    ping();
    const interval = setInterval(ping, 20000);
    return () => clearInterval(interval);
  }, [lobbyCode, showLobby, localPlayerId]);

  // Remove a player from the lobby (host only, setup phase)
  const removePlayerFromLobby = async (playerId: string) => {
    if (!isLobbyOwner || !lobbyCode) return;
    try {
      const roomRef = doc(db, 'games', lobbyCode);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) return;
        const st = snap.data().gameState as GameState;
        const updated = { ...st, players: st.players.filter(p => p.id !== playerId) };
        tx.update(roomRef, { gameState: updated, playerCount: updated.players.length, lastUpdated: Date.now() });
      });
    } catch (e) { console.error('Failed to remove player:', e); }
  };

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
  }, [myPlayer?.position, gameState.currentPlayer]);

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
  const cardCtx: CardCtx = {
    state: gameState, me: myPlayer, isMyTurn,
    actions: { buildHouse, buildHotel, sellHouse, sellHotel, mortgage: mortgageProperty, unmortgage: unmortgageProperty }
  };
  const ownedProperties = gameState.properties.filter(p => p.owner === currentPlayer.name);

  const handlePropertyClick = (property: Property) => {
    if (property.type === 'special') {
      setSelectedSpecialProperty(property);
    } else if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      setSummaryProperty(property); // phones/tablets: readable summary under the board, details one tap away
    } else {
      setSelectedProperty(property);
    }
  };

  const handleStartAuction = (propertyId: string) => {
    startAuction(propertyId);
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
        uid: currentUid() || undefined,
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

      // A configured draft queue runs before play, even against the bot
      const draftFirst = !!(settings.auctionsEnabled && (settings.preAuctionProperties || []).length > 0);
      const firstState: GameState = {
         ...initialState,
         players,
         workers: [],
         pendingCard: null,
         gamePhase: settings.singlePlayer ? (draftFirst ? 'auction' : 'playing') : 'setup',
         preAuctionPhase: !!(settings.singlePlayer && draftFirst),
         // Initialize the turn timer immediately for single-player so the first turn has a countdown
         turnEndTime: (settings.singlePlayer && settings.turnTimerDuration && settings.turnTimerDuration > 0)
           ? Date.now() + (settings.turnTimerDuration * 1000)
           : null,
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
        hostUid: currentUid() || null,
        members: currentUid() ? { [currentUid() as string]: true } : {},
        lastUpdated: Date.now(),
        playerCount: players.length
      });

      setLobbyCode(code);
      setLocalPlayerId('player-1');
      setIsLobbyOwner(true);
      setShowLobby(false);
    } catch (e: any) {
      console.error("Firebase Room Creation Error:", e);
      alert("Failed to create the room. Check that Anonymous sign-in is enabled in the Firebase console and that firestore.rules is deployed (see README → Firebase setup). Error: " + e.message);
    }
  };

  const handleJoinLobby = async (code: string, playerName: string, color?: string, icon?: string) => {
    try {
      const roomRef = doc(db, 'games', code);
      // One transaction: simultaneous joins can no longer overwrite each other or share a player id
      const result = await runTransaction(db, async (tx): Promise<{ id: string; host?: boolean } | { error: string }> => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) return { error: 'Room not found! Please check the code and try again.' };
        const data = snap.data();
        const state = data.gameState as GameState;

        const myUid = currentUid() || undefined;
        const existingPlayer = state.players.find(p => p.name === playerName);
        if (existingPlayer) {
          // A seat is bound to the browser (anonymous uid) that took it; another device can't claim the name.
          // Legacy seats without a uid are claimed by whoever reconnects first.
          if (existingPlayer.uid && myUid && existingPlayer.uid !== myUid) {
            return { error: `"${playerName}" is already taken by another player. Pick a different name (or rejoin from the browser you started with).` };
          }
          // Reconnect: restore identity, apply any newly-selected token color/icon
          const updatedPlayers = state.players.map(p =>
            p.id === existingPlayer.id
              ? { ...p, uid: p.uid || myUid, color: color || p.color, pieceIcon: icon || p.pieceIcon }
              : p
          );
          tx.update(roomRef, { gameState: { ...state, players: updatedPlayers }, lastUpdated: Date.now(), ...(myUid ? { [`members.${myUid}`]: true } : {}) });
          return { id: existingPlayer.id, host: !!myUid && data.hostUid === myUid };
        }

        const lateJoin = state.gamePhase !== 'setup';
        // Joining a running game is allowed as a spectator (watch only; never takes a turn or counts as a survivor)
        if (!lateJoin && state.players.length >= state.settings.maxPlayers) return { error: 'Lobby is currently full!' };
        if (state.gamePhase === 'ended') return { error: 'That game has ended.' };

        // Highest existing id + 1 (length + 1 collides after a player is removed)
        const maxId = state.players.reduce((m, p) => Math.max(m, parseInt(p.id.replace('player-', ''), 10) || 0), 0);
        const joinedPlayerId = `player-${maxId + 1}`;
        const colors = ['#00C8E0', '#7C3AED', '#F43F5E', '#F59E0B', '#10B981', '#EC4899', '#F97316', '#06B6D4'];
        const icons = ['🌊', '⚡', '🌹', '⭐', '🍀', '🔮', '🔸', '🌐'];
        const newPlayer: Player = {
          id: joinedPlayerId,
          name: playerName || `Player ${state.players.length + 1}`,
          balance: lateJoin ? 0 : (state.settings.startingBalance || 1500000),
          ...(lateJoin ? { isSpectator: true } : {}),
          properties: [],
          position: 0,
          color: color || colors[state.players.length] || '#000',
          isActive: true,
          isInJail: false,
          jailTurns: 0,
          pieceIcon: icon || icons[state.players.length] || '👤',
          uid: myUid,
          discoveredProperties: [0]
        };

        const next: GameState = { ...state, players: [...state.players, newPlayer] };
        // Auto-start when the lobby fills. With auctions on this enters the draft; the host's client
        // drives it (and falls through to normal play when no draft properties were chosen).
        if (!lateJoin && next.players.length === next.settings.maxPlayers) {
          if (next.settings.auctionsEnabled) {
            next.preAuctionPhase = true;
            next.gamePhase = 'auction';
          } else {
            next.gamePhase = 'playing';
            if (next.settings.turnTimerDuration && next.settings.turnTimerDuration > 0) {
              next.turnEndTime = Date.now() + (next.settings.turnTimerDuration * 1000);
            }
          }
        }
        tx.update(roomRef, {
          gameState: next, lastUpdated: Date.now(), playerCount: next.players.length,
          status: next.gamePhase === 'setup' ? 'waiting' : 'playing',
          ...(myUid ? { [`members.${myUid}`]: true } : {})
        });
        return { id: joinedPlayerId };
      });

      if ('error' in result) {
        alert(result.error);
        return;
      }
      setLobbyCode(code);
      setLocalPlayerId(result.id);
      setIsLobbyOwner(!!result.host); // a reconnecting host gets the host UI back
      setShowLobby(false);
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

  if (!authChecked) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-cyan-300 font-mono">Connecting…</div>;
  }

  // Show lobby system if not in game yet
  if (showLobby) {
    return <LobbySystem onCreateLobby={handleCreateLobby} onJoinLobby={handleJoinLobby} />;
  }

  if (gameState.gamePhase === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl space-y-3">
          <WaitingRoom
            roomCode={lobbyCode}
            seats={gameState.players.map((p, i) => ({
              name: p.name, color: p.color, icon: p.pieceIcon, marker: i + 1,
              isYou: p.id === localPlayerId, isBot: p.isBot,
              isAway: !p.isBot && (!playerPresence[p.id] || Date.now() - playerPresence[p.id] > 45000)
            }))}
            maxPlayers={gameState.settings.maxPlayers}
            isHost={isLobbyOwner}
            onStart={isLobbyOwner ? handleStartGame : undefined}
            startDisabledReason={gameState.players.length < 2 ? 'Need at least 2 players to start.' : undefined}
            onCopy={(code) => {
              navigator.clipboard?.writeText(code).then(() => { setRoomCopied(true); setTimeout(() => setRoomCopied(false), 2000); }).catch(() => {});
            }}
            copied={roomCopied}
            onEditProperties={isLobbyOwner && gameState.settings.allowPropertyEditing ? () => setIsEditorOpen(true) : undefined}
          />
          {isLobbyOwner && gameState.players.some(p => p.id !== localPlayerId && !p.isBot && (!playerPresence[p.id] || Date.now() - playerPresence[p.id] > 45000)) && (
            <div className="rounded-xl bg-slate-900/70 border border-slate-700 p-3 space-y-2">
              <p className="text-sm text-slate-300">Players who look disconnected — remove them to free their seat:</p>
              <div className="flex flex-wrap gap-2">
                {gameState.players.filter(p => p.id !== localPlayerId && !p.isBot && (!playerPresence[p.id] || Date.now() - playerPresence[p.id] > 45000)).map(p => (
                  <button key={p.id} onClick={() => removePlayerFromLobby(p.id)} className="min-h-[44px] px-4 rounded-lg bg-red-900/60 hover:bg-red-800 border border-red-600 text-red-100 text-sm font-semibold">
                    Remove {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
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
    <div className="h-[100dvh] flex flex-col gap-2 bg-slate-950 p-2 lg:p-3 text-slate-100 overflow-hidden">
      {/* Screen-reader status: whose turn + latest event (polite, so it never interrupts) */}
      <div className="sr-only" role="status" aria-live="polite">
        {gameState.gamePhase === 'ended' ? 'Game over.' : `${currentPlayer.name}'s turn.`}{' '}
        {gameState.gameEvents.length > 0 ? `${gameState.gameEvents[gameState.gameEvents.length - 1].player} ${gameState.gameEvents[gameState.gameEvents.length - 1].message}` : ''}
      </div>

      {/* Persistent result screen (kit GameOverCard) */}
      {gameState.gamePhase === 'ended' && !winnerDismissed && (() => {
        const winner = gameState.players.find(p => p.id === gameState.winnerId);
        const winTeam = gameState.winnerTeamId ? gameState.teams.find(t => t.id === gameState.winnerTeamId) : null;
        const worth = (p: Player) => p.isActive ? p.balance + gameState.properties.filter(pr => pr.owner === p.name && !pr.isInactive).reduce((a, pr) => a + pr.currentValue, 0) : 0;
        const ordered = [...gameState.players].filter(p => !p.isSpectator).sort((a, b) => Number(b.isActive) - Number(a.isActive) || worth(b) - worth(a));
        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Game over">
            <div className="w-full max-w-lg space-y-3">
              <GameOverCard
                winnerName={winner?.name ?? 'Nobody'}
                winnerTeamName={winTeam?.name}
                standings={ordered.map((p, i) => ({
                  rank: i + 1, netWorth: worth(p),
                  player: { name: p.name, color: p.color, icon: p.pieceIcon, marker: gameState.players.indexOf(p) + 1, isYou: p.id === localPlayerId, isBot: p.isBot, isBankrupt: !p.isActive }
                }))}
                onBackToLobby={() => { window.location.href = window.location.pathname; }}
                isHost={isLobbyOwner}
                canRematch={isLobbyOwner}
                onRematch={() => { setWinnerDismissed(false); rematch(); }}
              />
              <button onClick={() => setWinnerDismissed(true)} className="w-full min-h-[44px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm border border-slate-600">View the final board</button>
            </div>
          </div>
        );
      })()}

      {/* Rules Panel */}
      {showRules && (
        <RulesPanel settings={gameState.settings} onClose={() => setShowRules(false)} />
      )}

      {/* Special Property Info Overlay */}
      {selectedSpecialProperty && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          role="dialog" aria-modal="true" aria-label="Tile information"
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

      {/* Property title deed: same card + actions as the portfolio (board tile tap, phone summary → Details) */}
      {selectedProperty && (() => {
        const live = gameState.properties.find(p => p.id === selectedProperty.id) ?? selectedProperty;
        return <InspectView {...cardProps(cardCtx, live, 'full')} origin={null} onClose={() => setSelectedProperty(null)} />;
      })()}

      {/* Dialogs & Overlays removed from global space to board space */}
      
      {/* Game Header — compact single row */}
      <Card className="shrink-0 bg-slate-900 border border-slate-800 shadow-md py-0">
        <CardHeader className="py-1.5 px-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <img src="/favicon.svg" alt="Monopoly Madness Icon" className="w-6 h-6 animate-pulse" />
              <span className="text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-500">Monopoly Madness</span>
              <Badge className="bg-emerald-900/50 border-emerald-500/50 text-emerald-300 font-mono px-3 border-2 shadow-sm text-sm">
                {lobbyCode}
              </Badge>
              <Badge className="hidden sm:flex bg-indigo-900/50 text-indigo-300 border border-indigo-700/50 px-2 items-center gap-1 text-xs">
                <span dangerouslySetInnerHTML={{__html: myPlayer.pieceIcon}} />
                <span>{myPlayer.name}</span>
              </Badge>
              <Badge className="bg-slate-800/80 text-slate-300 border border-slate-600 px-2 text-xs">
                Turn {gameState.turn + 1} · {gameState.players.filter(p => p.isActive).length} active
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              {isLobbyOwner && gameState.settings.allowPropertyEditing && (
                <Button aria-label="Property editor" onClick={() => setIsEditorOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-7 px-2 border border-purple-400/50">
                  ✏️ Edit
                </Button>
              )}
              {gameState.settings.workersEnabled && (
                <Button aria-label="Worker assignment" onClick={() => setIsWorkerPanelOpen(true)} className="bg-amber-700 hover:bg-amber-600 text-white font-bold text-xs h-7 px-2 border border-amber-500/50">
                  👷
                </Button>
              )}
              <Button aria-label="Achievements" onClick={() => setShowAchievements(true)} className="bg-yellow-700/80 hover:bg-yellow-600 text-white font-bold text-xs h-7 px-2 border border-yellow-500/50" title="Achievements">
                🏆 {unlockedAchievements.size}/{ACHIEVEMENTS.length}
              </Button>
              <Button aria-label="Game rules" onClick={() => setShowRules(true)} className="bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs h-7 px-2 border border-slate-500/60">
                📖
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main layout: board + side dock (desktop) / bottom nav (phone). Everything fits one screen — no page scrolling. */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2 lg:gap-3">
        <div className="min-h-0 min-w-0 flex flex-col items-stretch justify-start gap-2 lg:flex-none lg:w-[min(100%,calc(100dvh-236px))]">
      {/* Turn strip: whose turn, what is expected, shared countdown */}
      <div className="shrink-0">
        <TurnStatus
          actorName={currentPlayer.name}
          isMine={isMyTurn}
          secondsLeft={turnTimer !== null && (gameState.settings.turnTimerDuration ?? 0) > 0 && gameState.gamePhase === 'playing' && !gameState.currentAuction ? turnTimer : undefined}
          totalSeconds={gameState.settings.turnTimerDuration || 60}
          phase={
            gameState.gamePhase === 'ended' ? 'Game over'
            : gameState.currentAuction ? (gameState.preAuctionPhase ? 'Draft auction in progress' : 'Auction in progress')
            : gameState.gamePhase === 'auction' ? 'Preparing the draft'
            : gameState.turnState === 'waiting_for_roll' ? (isMyTurn ? 'Roll the dice' : `Waiting for ${currentPlayer.name} to roll`)
            : gameState.turnState === 'waiting_for_action' ? (isMyTurn ? 'A decision is needed' : `${currentPlayer.name} is deciding`)
            : gameState.turnState === 'processing' ? 'Moving…'
            : 'Turn ending'
          }
        />
      </div>

      {doublesBanner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[180] pointer-events-none">
          <DoublesBanner triple={doublesBanner === 'triple'} visible />
        </div>
      )}
      {(() => {
        // Host escape hatch: with the turn timer off, a player who left would freeze the table
        const seen = playerPresence[currentPlayer.id];
        const away = !currentPlayer.isBot && !isMyTurn && gameState.gamePhase === 'playing' && !gameState.currentAuction && (!seen || Date.now() - seen > 45000);
        return away && isLobbyOwner ? (
          <div className="shrink-0 flex items-center justify-between gap-3 rounded-xl border border-amber-500/50 bg-amber-950/40 p-3 text-sm text-amber-100">
            <span>{currentPlayer.name} looks disconnected.</span>
            <button onClick={endTurn} className="min-h-[44px] px-4 rounded-lg bg-amber-500 text-slate-950 font-bold">Skip their turn</button>
          </div>
        ) : null;
      })()}

          {showWorkerNudge && (
            <div role="status" className="w-full max-w-4xl bg-amber-900/80 border border-amber-500/60 text-amber-100 text-xs sm:text-sm font-semibold px-4 py-2 rounded-lg text-center">
              Assign workers before rolling — open Workers in the header
            </div>
          )}
          <div className="w-full max-w-[calc(100dvh-272px)] mx-auto lg:max-w-none">
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
            canRoll={gameState.turnState === 'waiting_for_roll' && isMyTurn && gameState.gamePhase === 'playing'}
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
            <StageHost
              gameState={gameState}
              me={myPlayer}
              isMyTurn={isMyTurn}
              showJail={!!showJailDialog}
              jailFine={jailFine}
              pendingCard={myPendingCard}
              onCardResolving={() => setCardResolved(true)}
              rent={myPendingRentData ? { propertyName: myPendingRentData.property?.name ?? 'Property', owner: myPendingRentData.owner, amount: myPendingRentData.amount } : null}
              landedOnOwn={landedOnOwnProperty ? (propertyOnMyTile ?? null) : null}
              auctionTimer={auctionTimer}
              actions={{ payJailFine, spendJailCard, skipJailTurn, resolveCard, payRent, purchaseProperty, skipPurchase, placeBid, endAuctionNow, buildHouse, buildHotel, endTurn, canBuildHouse }}
              cardCtx={cardCtx}
              fallback={ownedPropertyOnTile ? (
                <div className="absolute inset-0 z-50 flex p-1 sm:p-4 bg-slate-950/90 rounded-sm overflow-y-auto overflow-x-hidden max-sm:fixed max-sm:z-[120] max-sm:p-0 max-sm:items-end" role="dialog" aria-modal="true" aria-label="Make an offer">
                  <div className="w-full max-w-sm h-fit m-auto max-sm:m-0 max-sm:max-w-none max-sm:max-h-[88vh] max-sm:overflow-y-auto max-sm:rounded-t-2xl">
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
                      onEndAuction={endAuctionNow}
                      players={gameState.players.map(p => p.name)}
                      currentPlayer={myPlayer.name}
                      auctionsEnabled={gameState.settings.auctionsEnabled}
                    />
                  </div>
                </div>
              ) : null}
            />
          </MonopolyBoardLayout>
          </div>
        </div>

        {/* Desktop side dock: portfolio cards / players / log / teams as tabs */}
        <aside className="hidden lg:flex flex-1 min-w-[380px] max-w-[680px] min-h-0 flex-col rounded-xl border border-slate-700 bg-slate-900/70">
          <div role="tablist" aria-label="Game panels" className="shrink-0 flex gap-1 p-1.5 border-b border-slate-700">
            {([
              ['properties', 'Properties'], ['players', 'Players'], ['log', 'Log'],
              ...(gameState.settings.teamsEnabled ? [['teams', 'Teams']] : [])
            ] as [typeof sideTab, string][]).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={sideTab === id} onClick={() => setSideTab(id)}
                className={`flex-1 min-h-[40px] rounded-lg text-sm font-semibold transition-colors ${sideTab === id ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}>{label}</button>
            ))}
            {gameState.settings.workersEnabled && (
              <button onClick={() => setIsWorkerPanelOpen(o => !o)} className="min-h-[40px] px-3 rounded-lg text-sm font-semibold bg-amber-700 hover:bg-amber-600 text-white">Workers</button>
            )}
            {gameState.settings.tradingEnabled && (
              <button onClick={() => setIsTradingOpen(true)} className="relative min-h-[40px] px-3 rounded-lg text-sm font-semibold bg-purple-700 hover:bg-purple-600 text-white">
                Trade{gameState.tradeOffers.filter(o => o.status === 'pending' && o.toPlayer === myPlayer.name).length > 0 && <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 text-xs">{gameState.tradeOffers.filter(o => o.status === 'pending' && o.toPlayer === myPlayer.name).length}</span>}
              </button>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-2">
            {sideTab === 'properties' && (
              <PlayerPanel
                currentPlayer={myPlayer}
                allPlayers={gameState.players}
                ownedProperties={myOwnedProperties}
                workers={gameState.workers || []}
                workersEnabled={gameState.settings.workersEnabled}
                onMortgage={mortgageProperty}
                onUnmortgage={unmortgageProperty}
                cardsSlot={<PortfolioCards ctx={cardCtx} spendJailCard={spendJailCard} />}
                rank={1 + gameState.players.filter(p => p.isActive && !p.isSpectator && netWorthOf(gameState, p) > netWorthOf(gameState, myPlayer)).length}
              />
            )}
            {sideTab === 'players' && <PlayersList state={gameState} me={myPlayer} />}
            {sideTab === 'log' && <InlineLog events={gameState.gameEvents} />}
            {sideTab === 'teams' && gameState.settings.teamsEnabled && (
              <TeamPanel currentPlayer={myPlayer} teams={gameState.teams} players={gameState.players}
                onJoinTeam={joinTeam} onCreateTeam={createTeam} locked={gameState.turn >= gameState.players.length} />
            )}
          </div>
        </aside>
      </div>

      {/* Phone: always-visible money strip */}
      <div className="lg:hidden shrink-0 flex items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm">
        <span className="text-slate-400">Cash <strong className="text-cyan-300 font-mono">${myPlayer.balance.toLocaleString('en-US')}</strong></span>
        <span className="text-slate-400">Worth <strong className="text-white font-mono">${(myPlayer.balance + myOwnedProperties.filter(p => !p.isInactive).reduce((a, p) => a + p.currentValue, 0)).toLocaleString('en-US')}</strong></span>
        <span className="text-slate-400">{myOwnedProperties.length} props</span>
      </div>

      {/* Phone: selected-tile summary floats above the nav; labelled nav buttons open the sheets */}
      {summaryProperty && (() => {
        const live = gameState.properties.find(p => p.id === summaryProperty.id) ?? summaryProperty;
        return (
          <div className="lg:hidden fixed inset-x-2 bottom-[84px] z-[60] rounded-xl bg-slate-900 border border-slate-600 shadow-2xl">
            <button aria-label="Dismiss tile summary" onClick={() => setSummaryProperty(null)} className="absolute -top-3 -right-1 z-10 h-8 w-8 rounded-full bg-slate-700 text-slate-100 text-sm no-touch-min">✕</button>
            <TileSummaryStrip gameState={gameState} property={live} onDetails={() => setSelectedProperty(live)} />
          </div>
        );
      })()}
      <BottomNav items={[
        { id: 'properties', label: 'Properties', active: isPortfolioOpen, onClick: () => setIsPortfolioOpen(o => !o) },
        { id: 'players', label: 'Players', active: isPlayersOpen, onClick: () => setIsPlayersOpen(o => !o) },
        { id: 'log', label: 'Log', active: isLogOpen, onClick: () => setIsLogOpen(o => !o) },
        ...(gameState.settings.tradingEnabled ? [{ id: 'trade' as const, label: 'Trade', badge: gameState.tradeOffers.filter(o => o.status === 'pending' && o.toPlayer === myPlayer.name).length, active: isTradingOpen, onClick: () => setIsTradingOpen(o => !o) }] : []),
        ...(gameState.settings.teamsEnabled ? [{ id: 'teams' as const, label: 'Teams', active: isTeamsOpen, onClick: () => setIsTeamsOpen(o => !o) }] : []),
        ...(gameState.settings.workersEnabled ? [{ id: 'workers' as const, label: 'Workers', active: isWorkerPanelOpen, onClick: () => setIsWorkerPanelOpen(o => !o) }] : [])
      ]} />

      {/* Trading (kit TradeSheet via adapter) */}
      {isTradingOpen && (
        <SheetDock>
          <TradeHost
            gameState={gameState} me={myPlayer} cardCtx={cardCtx} onClose={() => setIsTradingOpen(false)}
            createTradeOffer={createTradeOffer} acceptTradeOffer={acceptTradeOffer}
            rejectTradeOffer={rejectTradeOffer} cancelTradeOffer={cancelTradeOffer}
          />
        </SheetDock>
      )}
      {isPlayersOpen && (
        <SheetDock>
          <PlayersSheet state={gameState} me={myPlayer} onClose={() => setIsPlayersOpen(false)} />
        </SheetDock>
      )}

      {/* Workers (kit WorkersSheet via adapter) */}
      {gameState.settings.workersEnabled && isWorkerPanelOpen && (
        <SheetDock>
          <WorkersHost gameState={gameState} me={myPlayer} isMyTurn={isMyTurn} onClose={() => setIsWorkerPanelOpen(false)}
            assignWorker={assignWorker} removeWorker={removeWorker} updateWorkerColor={updateWorkerColor} />
        </SheetDock>
      )}

      {/* Portfolio sheet (phones) */}
      {isPortfolioOpen && (
        <SheetDock>
          <PortfolioHost ctx={cardCtx} onClose={() => setIsPortfolioOpen(false)} spendJailCard={spendJailCard} />
        </SheetDock>
      )}

      {/* Teams sheet (phones) */}
      {gameState.settings.teamsEnabled && isTeamsOpen && (
        <SheetDock>
          <TeamsHost gameState={gameState} me={myPlayer} onClose={() => setIsTeamsOpen(false)} joinTeam={joinTeam} createTeam={createTeam} />
        </SheetDock>
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

      {/* Game log (kit LogSheet) */}
      {isLogOpen && (
        <SheetDock>
          <LogSheet
            open
            onClose={() => setIsLogOpen(false)}
            entries={[...gameState.gameEvents].reverse().map(e => ({
              id: e.id, player: e.player, message: e.message, amount: e.amount, type: e.type,
              timeLabel: new Date(e.timestamp).toLocaleTimeString('en-US', { hour12: false })
            }))}
          />
        </SheetDock>
      )}

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