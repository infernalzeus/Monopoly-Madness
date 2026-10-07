import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users,
  Plus,
  Hash,
  Settings,
  Crown,
  Gamepad2,
  Gavel,
  Edit3,
  Handshake,
  Trash2,
  AlertCircle,
  Clock,
  Eye,
  Bot
} from 'lucide-react';
import { Lobby, GameSettings } from '@/types/game';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, deleteDoc, doc, orderBy, limit, getDoc } from 'firebase/firestore';
import { useEffect } from 'react';

interface LobbySystemProps {
  onCreateLobby: (settings: GameSettings, code: string, playerName: string, color: string, icon: string) => void;
  onJoinLobby: (code: string, playerName: string, color: string, icon: string) => void;
}

const tokenOptions = [
  { color: '#00C8E0', icon: '🌊', label: 'Cyan' },      // vivid cyan
  { color: '#7C3AED', icon: '⚡', label: 'Violet' },    // deep indigo-violet (distinct from fuchsia)
  { color: '#F43F5E', icon: '🌹', label: 'Rose' },      // keep
  { color: '#F59E0B', icon: '⭐', label: 'Amber' },     // keep
  { color: '#10B981', icon: '🍀', label: 'Emerald' },   // keep (user's favourite)
  { color: '#EC4899', icon: '🔮', label: 'Pink' },      // hot pink — clearly different from violet
];

const LobbySystem: React.FC<LobbySystemProps> = ({ onCreateLobby, onJoinLobby }) => {
  const [showCreateLobby, setShowCreateLobby] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [activeGames, setActiveGames] = useState<any[]>([]);
  const [deleteCooldown, setDeleteCooldown] = useState<number | null>(null);
  const [generatedCode] = useState(() => Math.floor(100000 + Math.random() * 900000).toString());
  const [selectedTokenIdx, setSelectedTokenIdx] = useState(0);
  const [takenTokenColors, setTakenTokenColors] = useState<string[]>([]);
  const [lobbySettings, setLobbySettings] = useState<GameSettings>({
    gameMode: 'classic',
    auctionsEnabled: false,
    teamsEnabled: true,
    mortgageEnabled: true,
    tradingEnabled: false,
    auctionDuration: 120,
    maxPlayers: 4,
    startingBalance: 10000000,
    passGoReward: 1000000,
    jailFine: 500000,
    allowPropertyEditing: false,
    preAuctionProperties: [],
    customPropertyLists: {},
    isPrivate: false,
    gameType: 'standard',
    blindPickEnabled: false,
    turnTimerDuration: 60
  });

  // Fetch active games and cleanup inactive ones
  useEffect(() => {
    // We query more games than we display to identify stale ones for cleanup
    const q = query(collection(db, 'games'), orderBy('lastUpdated', 'desc'), limit(50));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const now = Date.now();
      const hideThreshold = now - 60000; // 1 minute to hide from lobby
      const deleteThreshold = now - 600000; // 10 minutes for final deletion from DB
      
      const visibleGames: any[] = [];
      const staleIds: string[] = [];

      snap.docs.forEach(docSnap => {
        const data = docSnap.data() as any;
        const lastUpdated = data.lastUpdated || 0;
        const status = data.status;
        const gamePhase = data.gameState?.gamePhase;
        const isPrivate = data.gameState?.settings?.isPrivate;

        // A game is active for lobby display if it hasn't ended.
        // 'waiting' lobbies always show (so joining players can find them).
        // 'playing' games show while recently heartbeated.
        const isActuallyEnded = status === 'ended' || gamePhase === 'ended';
        const isActiveForLobby = !isActuallyEnded && (
          status === 'waiting' || lastUpdated > hideThreshold
        );

        if (isActiveForLobby && !isPrivate) {
          visibleGames.push({ id: docSnap.id, ...data });
        }
        
        // Auto-delete if game ended OR hasn't been updated for 10 minutes
        if ((isActuallyEnded && lastUpdated < now - 3600000) || (!isActuallyEnded && lastUpdated < deleteThreshold)) {
          staleIds.push(docSnap.id);
        }
      });

      setActiveGames(visibleGames);
      
      // Perform automatic cleanup of stale/ended games (ended rooms linger for an hour so the result card + rematch stay usable;
      // only the host's browser is allowed to delete by the Firestore rules, others fail silently)
      if (staleIds.length > 0) {
        staleIds.forEach(async (id) => {
          try {
            await deleteDoc(doc(db, 'games', id));
            console.log(`Auto-deleted inactive/ended game: ${id}`);
          } catch (err) {
            // Silently fail if someone else deleted it first or permission denied
          }
        });
      }
    });

    // Load delete cooldown
    const lastDelete = localStorage.getItem('lastDeleteTime');
    if (lastDelete) {
      const cooldownTime = 60 * 60 * 1000; // 1 hour
      const timePassed = Date.now() - parseInt(lastDelete);
      if (timePassed < cooldownTime) {
        setDeleteCooldown(cooldownTime - timePassed);
        const timer = setInterval(() => {
          const remaining = cooldownTime - (Date.now() - parseInt(lastDelete));
          if (remaining <= 0) {
            setDeleteCooldown(null);
            clearInterval(timer);
          } else {
            setDeleteCooldown(remaining);
          }
        }, 1000);
        return () => {
          unsubscribe();
          clearInterval(timer);
        };
      }
    }

    return () => unsubscribe();
  }, []);

  // Fetch taken token colors when a 6-digit join code is entered
  useEffect(() => {
    if (joinCode.length !== 6) { setTakenTokenColors([]); return; }
    getDoc(doc(db, 'games', joinCode)).then(snap => {
      if (snap.exists()) {
        const taken = ((snap.data() as any)?.gameState?.players || []).map((p: any) => p.color as string);
        setTakenTokenColors(taken);
        // Auto-select first available token
        const firstFree = tokenOptions.findIndex(t => !taken.includes(t.color));
        if (firstFree !== -1 && taken.includes(tokenOptions[selectedTokenIdx]?.color)) {
          setSelectedTokenIdx(firstFree);
        }
      }
    });
  }, [joinCode]);

  const handleDeleteGame = async (gameId: string, hostName: string, status: string, lastUpdated: number) => {
    // Check cooldown
    if (deleteCooldown !== null) {
      alert(`Please wait ${Math.ceil(deleteCooldown / 60000)} minutes before deleting another game.`);
      return;
    }

    // Check if user is host or game is inactive
    const isHost = playerName && hostName === playerName;
    const isInactive = status === 'ended' || (Date.now() - lastUpdated) > 60000; // 1 minute since last update (heartbeat failure)

    if (!isHost && !isInactive) {
      alert("You can only delete games that you hosted or those that are inactive (over 1 minute since last update).");
      return;
    }

    if (!confirm(`Are you sure you want to delete game ${gameId}?`)) return;

    try {
      await deleteDoc(doc(db, 'games', gameId));
      localStorage.setItem('lastDeleteTime', Date.now().toString());
      setDeleteCooldown(60 * 60 * 1000);
      alert("Game deleted successfully.");
    } catch (e: any) {
      console.error("Error deleting game:", e);
      alert("Failed to delete game: " + e.message);
    }
  };

  const handleCreateLobby = () => {
    if (!playerName.trim()) { alert('Please enter your name to create a lobby.'); return; }
    const token = tokenOptions[selectedTokenIdx];
    onCreateLobby(lobbySettings, generatedCode, playerName.substring(0, 16), token.color, token.icon);
  };

  const handleJoinLobby = () => {
    if (!playerName.trim()) { alert('Please enter your name to join the lobby.'); return; }
    if (joinCode.length === 6) {
      const token = tokenOptions[selectedTokenIdx];
      onJoinLobby(joinCode, playerName.substring(0, 16), token.color, token.icon);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl sm:text-6xl font-bold text-white mb-3 flex items-center justify-center gap-4">
            <img src="/favicon.svg" alt="Monopoly Madness Icon" className="w-16 h-16 sm:w-20 sm:h-20 animate-pulse" />
            Monopoly Madness
          </h1>
          <p className="text-xl text-cyan-200 mb-1 font-semibold">
            Roll dice. Snap up cities. Watch your rivals go broke. 🎲
          </p>
          <p className="text-sm text-cyan-400/70 mb-5">
            Buy, bid at auction, build with workers, team up with friends — or take on Bot Noob solo. Last millionaire standing wins!
          </p>
          <p className="text-xs text-cyan-400/40 font-mono tracking-wider mb-6">v1.1.11</p>
          {/* Feature highlight pills */}
          <div className="flex flex-wrap justify-center gap-2 mb-2">
            {[
              { icon: '🌍', text: 'Global Cities' },
              { icon: '🔨', text: 'Live Auctions' },
              { icon: '🤝', text: 'Team Up' },
              { icon: '🔄', text: 'Trading' },
              { icon: '👷', text: 'Workers' },
              { icon: '✏️', text: 'Property Editor' },
              { icon: '🏦', text: 'Mortgages' },
              { icon: '🤖', text: 'vs Bot Noob' },
            ].map(f => (
              <span key={f.text} className="bg-white/10 border border-white/20 text-white/80 text-xs px-3 py-1 rounded-full flex items-center gap-1.5">
                {f.icon} {f.text}
              </span>
            ))}
          </div>
        </div>

        {/* Main Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Create Lobby */}
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-cyan-400 shadow-2xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-cyan-300 flex items-center justify-center gap-3">
                <Crown className="w-8 h-8 text-yellow-400" />
                Create Lobby
              </CardTitle>
              <p className="text-cyan-200">
                Start a new game and invite friends
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <Badge className="text-lg px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                  Lobby Code: {generatedCode}
                </Badge>
                <p className="text-sm text-slate-400 mt-2">
                  Share this code with friends to join
                </p>
              </div>

              <div className="space-y-4">
                <Label htmlFor="createPlayerName" className="text-cyan-200 font-semibold">
                  Your Name
                </Label>
                <Input
                  id="createPlayerName"
                  placeholder="Enter your name (max 16 chars)"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value.slice(0, 16))}
                  className="bg-slate-700 border-cyan-400/50 text-cyan-100 focus:border-cyan-400"
                  maxLength={16}
                />
                <div>
                  <Label className="text-cyan-200 font-semibold text-sm mb-2 block">Token Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {tokenOptions.map((opt, idx) => (
                      <button
                        key={opt.color}
                        type="button"
                        title={opt.label}
                        onClick={() => setSelectedTokenIdx(idx)}
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-base transition-transform hover:scale-110 ${selectedTokenIdx === idx ? 'border-white scale-110' : 'border-transparent opacity-60'}`}
                        style={{ backgroundColor: opt.color }}
                      >
                        <span style={{ fontSize: '0.8rem' }}>{opt.icon}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Button
                onClick={() => setShowCreateLobby(true)}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold py-3 text-lg"
              >
                <Settings className="w-5 h-5 mr-2" />
                Configure & Create Lobby
              </Button>
            </CardContent>
          </Card>

          {/* Join Lobby */}
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-green-400 shadow-2xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-green-300 flex items-center justify-center gap-3">
                <Users className="w-8 h-8 text-green-400" />
                Join Lobby
              </CardTitle>
              <p className="text-green-200">
                Enter a lobby code to join an existing game
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label htmlFor="lobbyCode" className="text-green-200 font-semibold">
                  Lobby Code
                </Label>
                <Input
                  id="lobbyCode"
                  placeholder="Enter 6-digit code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center text-2xl font-mono bg-slate-700 border-green-400/50 text-green-100 focus:border-green-400"
                  maxLength={6}
                />
                <div className="flex gap-2">
                  {Array.from({ length: 6 }, (_, i) => (
                    <div
                      key={i}
                      className={`w-8 h-8 border-2 rounded flex items-center justify-center text-lg font-bold ${i < joinCode.length
                          ? 'border-green-400 bg-green-400/20 text-green-300'
                          : 'border-slate-600 text-slate-500'
                        }`}
                    >
                      {joinCode[i] || ''}
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <Label htmlFor="joinPlayerName" className="text-green-200 font-semibold mb-2 block">Your Name</Label>
                  <Input
                    id="joinPlayerName"
                    placeholder="Enter your name (max 16 chars)"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value.slice(0, 16))}
                    className="bg-slate-700 border-green-400/50 text-green-100 focus:border-green-400"
                    maxLength={16}
                  />
                  <div className="mt-3">
                    <Label className="text-green-200 font-semibold text-sm mb-2 block">Token Color</Label>
                    <div className="flex gap-2 flex-wrap">
                      {tokenOptions.map((opt, idx) => {
                        const isTaken = takenTokenColors.includes(opt.color);
                        return (
                          <button
                            key={opt.color}
                            type="button"
                            title={isTaken ? `${opt.label} — taken` : opt.label}
                            disabled={isTaken}
                            onClick={() => !isTaken && setSelectedTokenIdx(idx)}
                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-base transition-transform ${isTaken ? 'opacity-25 cursor-not-allowed' : 'hover:scale-110 cursor-pointer'} ${selectedTokenIdx === idx && !isTaken ? 'border-white scale-110' : 'border-transparent opacity-60'}`}
                            style={{ backgroundColor: opt.color }}
                          >
                            {isTaken ? <span className="text-[0.55rem] font-black text-white">✕</span> : <span style={{ fontSize: '0.8rem' }}>{opt.icon}</span>}
                          </button>
                        );
                      })}
                    </div>
                    {takenTokenColors.length > 0 && (
                      <p className="text-xs text-slate-400 mt-1">Crossed tokens are already taken in this lobby.</p>
                    )}
                  </div>
                </div>
              </div>

              <Button
                onClick={handleJoinLobby}
                disabled={joinCode.length !== 6}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-3 text-lg disabled:opacity-50"
              >
                <Hash className="w-5 h-5 mr-2" />
                Join Lobby
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Active Games List */}
        <div className="mt-12 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
              <Gamepad2 className="w-8 h-8 text-cyan-400" />
              Active Lobbies
            </h2>
            {deleteCooldown !== null && (
              <Badge variant="outline" className="text-amber-400 border-amber-400 gap-2">
                <Clock className="w-4 h-4" />
                Delete Cooldown: {Math.ceil(deleteCooldown / 60000)}m
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeGames.length === 0 ? (
              <div className="col-span-full py-12 text-center bg-slate-800/30 rounded-xl border-2 border-dashed border-slate-700">
                <p className="text-slate-400 text-lg">No active lobbies found. Create one to start!</p>
              </div>
            ) : (
              activeGames.map((game) => {
                const isInactive = (Date.now() - (game.lastUpdated || 0)) > 60000;
                const isMyGame = playerName && game.hostName === playerName;

                return (
                  <Card key={game.id} className="bg-slate-800/80 border-slate-700 hover:border-cyan-400/50 transition-colors backdrop-blur-sm">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-xl font-mono text-cyan-300">#{game.id}</CardTitle>
                          <div className="flex flex-wrap gap-2 mt-1">
                            <p className="text-sm text-slate-400 flex items-center gap-1">
                              <Crown className="w-3 h-3 text-yellow-500" />
                              {game.hostName || 'Unknown'}
                            </p>
                            <Badge 
                              variant="outline" 
                              className={`text-[0.65rem] capitalize ${
                                game.gameState?.settings?.auctionsEnabled 
                                  ? 'text-yellow-400 border-yellow-500/50 bg-yellow-500/10' 
                                  : game.gameState?.settings?.teamsEnabled 
                                    ? 'text-indigo-400 border-indigo-500/50 bg-indigo-500/10' 
                                    : 'text-cyan-400 border-cyan-500/50 bg-cyan-500/10'
                              }`}
                            >
                              {game.gameState?.settings?.auctionsEnabled ? 'Auction Focus' : game.gameState?.settings?.teamsEnabled ? 'Team Up' : 'Standard'}
                            </Badge>
                          </div>
                        </div>
                        <Badge className={`${game.status === 'waiting' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                          {game.status || 'Active'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center text-sm mb-4">
                        <div className="flex items-center gap-2 text-slate-300">
                          <Users className="w-4 h-4" />
                          <span>{game.playerCount || 0} / {game.gameState?.settings?.maxPlayers || 4}</span>
                        </div>
                        <div className="text-slate-400">
                          {isInactive ? (
                            <span className="flex items-center gap-1 text-amber-400">
                              <AlertCircle className="w-3 h-3" /> Offline
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-emerald-400">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              Live
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            setJoinCode(game.id);
                            // Scroll to top
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="flex-1 bg-slate-700 hover:bg-slate-600 border-slate-600 text-white text-xs h-8"
                        >
                          Select Code
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-8 w-8"
                          disabled={!isMyGame && !isInactive}
                          onClick={() => handleDeleteGame(game.id, game.hostName, game.status, game.lastUpdated)}
                          title={isMyGame || isInactive ? "Delete game" : "Cannot delete active games of others"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Create Lobby Settings Dialog */}
        <Dialog open={showCreateLobby} onOpenChange={setShowCreateLobby}>
          <DialogContent className="max-w-2xl bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-cyan-400 max-h-[92vh] flex flex-col p-0">
            <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
              <DialogTitle className="text-2xl font-bold text-cyan-300 flex items-center gap-3">
                <Settings className="w-6 h-6" />
                Lobby Settings
              </DialogTitle>
            </DialogHeader>

            <div className="overflow-y-auto flex-1 px-6 pb-6 space-y-6">
              {/* Game Options */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-cyan-300">Game Options</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg border border-cyan-400/30">
                    <div className="flex items-center gap-3">
                      <Gavel className="w-5 h-5 text-yellow-400" />
                      <div>
                        <Label className="text-cyan-200 font-semibold">Auction Mode</Label>
                        <p className="text-xs text-slate-400">Land on a property → set a starting price → other players bid → you collect the winning amount</p>
                      </div>
                    </div>
                    <Switch
                      checked={lobbySettings.auctionsEnabled}
                      onCheckedChange={(checked) =>
                        setLobbySettings(prev => ({ ...prev, auctionsEnabled: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg border border-cyan-400/30">
                    <div className="flex items-center gap-3">
                      <Edit3 className="w-5 h-5 text-purple-400" />
                      <div>
                        <Label className="text-cyan-200 font-semibold">Property Editor</Label>
                        <p className="text-xs text-slate-400">Host edits property names, rents & colors — changes apply for this session only</p>
                      </div>
                    </div>
                    <Switch
                      checked={lobbySettings.allowPropertyEditing}
                      onCheckedChange={(checked) =>
                        setLobbySettings(prev => ({ ...prev, allowPropertyEditing: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg border border-cyan-400/30">
                    <div className="flex items-center gap-3">
                      <Handshake className="w-5 h-5 text-green-400" />
                      <div>
                        <Label className="text-cyan-200 font-semibold">Trading</Label>
                        <p className="text-xs text-slate-400">Allow property trading</p>
                      </div>
                    </div>
                    <Switch
                      checked={lobbySettings.tradingEnabled}
                      onCheckedChange={(checked) =>
                        setLobbySettings(prev => ({ ...prev, tradingEnabled: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg border border-cyan-400/30">
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-blue-400" />
                      <div>
                        <Label className="text-cyan-200 font-semibold">Teams</Label>
                        <p className="text-xs text-slate-400">Enable team play</p>
                      </div>
                    </div>
                    <Switch
                      disabled={lobbySettings.maxPlayers <= 2}
                      checked={lobbySettings.maxPlayers > 2 ? lobbySettings.teamsEnabled : false}
                      onCheckedChange={(checked) =>
                        setLobbySettings(prev => ({ ...prev, teamsEnabled: checked }))
                      }
                    />
                  </div>
                    <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg border border-cyan-400/30">
                      <div className="flex items-center gap-3">
                        <Plus className="w-5 h-5 text-indigo-400" />
                        <div>
                          <Label className="text-cyan-200 font-semibold">Private Room</Label>
                          <p className="text-xs text-slate-400">Hidden from public lobby list</p>
                        </div>
                      </div>
                      <Switch
                        checked={lobbySettings.isPrivate}
                        onCheckedChange={(checked) =>
                          setLobbySettings(prev => ({ ...prev, isPrivate: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg border border-cyan-400/30">
                      <div className="flex items-center gap-3">
                        <Eye className="w-5 h-5 text-pink-400" />
                        <div>
                          <Label className="text-cyan-200 font-semibold">Blind Pick</Label>
                          <p className="text-xs text-slate-400">Board properties are hidden until a player lands on them</p>
                        </div>
                      </div>
                      <Switch
                        checked={lobbySettings.blindPickEnabled}
                        onCheckedChange={(checked) =>
                          setLobbySettings(prev => ({ ...prev, blindPickEnabled: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg border border-cyan-400/30">
                      <div>
                        <Label className="text-cyan-200 font-semibold">Free Parking pot</Label>
                        <p className="text-xs text-slate-400">Taxes, card penalties and jail fines go into a pot; landing on Free Parking collects it</p>
                      </div>
                      <Switch checked={!!lobbySettings.freeParkingPot} onCheckedChange={(checked) => setLobbySettings(prev => ({ ...prev, freeParkingPot: checked }))} />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg border border-cyan-400/30">
                      <div>
                        <Label className="text-cyan-200 font-semibold">Building supply limits</Label>
                        <p className="text-xs text-slate-400">Classic scarcity: only 32 houses and 12 hotels exist in the whole game</p>
                      </div>
                      <Switch checked={!!lobbySettings.supplyLimits} onCheckedChange={(checked) => setLobbySettings(prev => ({ ...prev, supplyLimits: checked }))} />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg border border-cyan-400/30">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">👷</span>
                        <div>
                          <Label className="text-cyan-200 font-semibold">Workers Mode</Label>
                          <p className="text-xs text-slate-400">Assign workers to properties — they auto-build one house each time you pass GO</p>
                        </div>
                      </div>
                      <Switch
                        checked={!!lobbySettings.workersEnabled}
                        onCheckedChange={(checked) =>
                          setLobbySettings(prev => ({ ...prev, workersEnabled: checked }))
                        }
                      />
                    </div>
                </div>
              </div>

              {/* Game Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-cyan-300">Game Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <div className="space-y-2">
                    <Label className="text-cyan-200 font-semibold">Players</Label>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        type="button"
                        variant={lobbySettings.singlePlayer ? "default" : "outline"}
                        className={`flex-1 ${lobbySettings.singlePlayer ? 'bg-purple-600 hover:bg-purple-700 text-white border-transparent' : 'border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white'}`}
                        onClick={() => setLobbySettings(prev => ({
                          ...prev,
                          singlePlayer: true,
                          maxPlayers: 2,
                          teamsEnabled: false
                        }))}
                      >
                        <Bot className="w-3 h-3 mr-1" />
                        1 (vs Bot)
                      </Button>
                      {[2, 3, 4].map(num => (
                        <Button
                          key={num}
                          type="button"
                          variant={!lobbySettings.singlePlayer && lobbySettings.maxPlayers === num ? "default" : "outline"}
                          className={`flex-1 ${!lobbySettings.singlePlayer && lobbySettings.maxPlayers === num ? 'bg-cyan-600 hover:bg-cyan-700 text-white border-transparent' : 'border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white'}`}
                          onClick={() => setLobbySettings(prev => ({
                            ...prev,
                            singlePlayer: false,
                            maxPlayers: num,
                            teamsEnabled: num === 2 ? false : prev.teamsEnabled
                          }))}
                        >
                          {num} Players
                        </Button>
                      ))}
                    </div>
                    {lobbySettings.singlePlayer && (
                      <p className="text-xs text-purple-300 flex items-center gap-1">
                        <Bot className="w-3 h-3" />
                        You vs Bot Noob — game starts immediately
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-cyan-200 font-semibold">Turn Timer</Label>
                    <div className="flex gap-2">
                      {[0, 30, 60, 90].map(sec => (
                        <Button
                          key={sec}
                          type="button"
                          variant={lobbySettings.turnTimerDuration === sec ? "default" : "outline"}
                          className={`flex-1 ${lobbySettings.turnTimerDuration === sec || (!lobbySettings.turnTimerDuration && sec === 0) ? 'bg-cyan-600 hover:bg-cyan-700 text-white border-transparent' : 'border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white'}`}
                          onClick={() => setLobbySettings(prev => ({ 
                            ...prev, 
                            turnTimerDuration: sec
                          }))}
                        >
                          {sec === 0 ? 'Off' : `${sec}s`}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-full md:col-span-2">
                    <Label className="text-cyan-200 font-semibold">Starting Balance</Label>
                    <Input
                      type="number"
                      value={lobbySettings.startingBalance}
                      onChange={(e) =>
                        setLobbySettings(prev => ({
                          ...prev,
                          startingBalance: parseInt(e.target.value) || 1500000
                        }))
                      }
                      className="bg-slate-700 border-cyan-400/50 text-cyan-100"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <Button
                  onClick={() => setShowCreateLobby(false)}
                  variant="outline"
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateLobby}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold"
                >
                  <Gamepad2 className="w-4 h-4 mr-2" />
                  Create & Start Lobby
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default LobbySystem;

