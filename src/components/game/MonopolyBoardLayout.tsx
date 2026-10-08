import React, { useState, useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Property, Player, GameEvent, DiceRoll, Worker } from '@/types/game';
import { Home, Hotel, Landmark, Building } from 'lucide-react';
import CentralDisplay from './CentralDisplay';
import { BoardTile, BoardFrame } from '@/ui-kit/polish';
import { ownsFullGroup } from '@/gameEngine/core';


interface MonopolyBoardLayoutProps {
  properties: Property[];
  players: Player[];
  onPropertyClick: (property: Property) => void;
  selectedProperty?: Property | null;
  lastDiceRoll?: DiceRoll | null;
  currentEvent?: GameEvent | null;
  currentPlayer: string;
  isRolling?: boolean;
  onRollDice: () => void;
  onEndTurn?: () => void;
  canRoll: boolean;
  canEndTurn?: boolean;
  turnState?: string;
  playerColor: string;
  children?: React.ReactNode;
  stageOverlay?: React.ReactNode; // shown over the central display WITHOUT replacing it (e.g. hints)
  blindPickEnabled?: boolean;
  discoveredProperties?: number[];
  tradingEnabled?: boolean;
  onTradeClick?: () => void;
  isMyTurn?: boolean;
  turnTimer?: number | null;
  turnTimerDuration?: number;
  workers?: Worker[];
}

const AnimatedToken: React.FC<{ 
  player: Player; 
  isMoving: boolean; 
  delay?: number;
}> = ({ player, isMoving, delay = 0 }) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isMoving) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 1000 + delay);
      return () => clearTimeout(timer);
    }
  }, [isMoving, delay]);

  return (
    <div
      className={`
        w-4 h-4 sm:w-7 sm:h-7 rounded-full border-2 border-white shadow-xl text-[0.4rem] sm:text-xs flex items-center justify-center font-bold
        transition-all duration-300 ease-out z-20 ring-1 ring-black/50
        ${isAnimating ? 'animate-bounce scale-110' : 'scale-100'}
      `}
      style={{ 
        backgroundColor: player.color,
        boxShadow: isAnimating 
          ? '0 0 0 4px rgba(0,0,0,0.5), 0 6px 12px rgba(0,0,0,0.4)' 
          : '0 0 0 1.5px rgba(0,0,0,0.2)',
        animationDelay: `${delay}ms`
      }}
      title={player.name}
    >
      <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" dangerouslySetInnerHTML={{ __html: player.pieceIcon }} />
    </div>
  );
};

const MonopolyBoardLayout: React.FC<MonopolyBoardLayoutProps> = ({
  properties,
  players,
  onPropertyClick,
  selectedProperty,
  lastDiceRoll,
  currentEvent,
  currentPlayer,
  isRolling = false,
  onRollDice,
  onEndTurn,
  canRoll,
  canEndTurn,
  turnState,
  playerColor,
  children,
  stageOverlay,
  blindPickEnabled = false,
  discoveredProperties = [],
  tradingEnabled = false,
  onTradeClick,
  isMyTurn = false,
  turnTimer = null,
  turnTimerDuration = 0,
  workers = []
}) => {
  // displayPositions: visual position of each token (may lag behind actual position during hop anim)
  const [displayPositions, setDisplayPositions] = useState<Record<string, number>>({});
  const [isMoving, setIsMoving] = useState<Record<string, boolean>>({});

  // Track actual positions across renders to detect changes
  const prevPosRef = useRef<Record<string, number>>({});
  // Keep scheduled timers so we can cancel on unmount or re-trigger
  const hopTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reducedMotion = usePrefersReducedMotion();

  // Stable key built from each player's actual position — only recompute when positions change
  const posKey = players.map(p => `${p.id}:${p.position}`).join('|');

  useEffect(() => {
    // Cancel any in-flight hop animations
    hopTimers.current.forEach(t => clearTimeout(t));
    hopTimers.current = [];

    players.forEach(player => {
      const prev = prevPosRef.current[player.id];
      const next = player.position;

      if (prev === undefined) {
        // First time: place token immediately
        prevPosRef.current[player.id] = next;
        setDisplayPositions(d => ({ ...d, [player.id]: next }));
        return;
      }
      if (prev === next) return; // No change

      prevPosRef.current[player.id] = next;

      // Steps going forward around the board (wraps at 40)
      const steps = (next - prev + 40) % 40;

      // For teleports (Go to Jail, etc.) — > 12 steps — snap directly
      if (steps === 0 || steps > 12 || reducedMotion) {
        setDisplayPositions(d => ({ ...d, [player.id]: next }));
        setIsMoving(m => ({ ...m, [player.id]: true }));
        const t = setTimeout(() => setIsMoving(m => ({ ...m, [player.id]: false })), 400);
        hopTimers.current.push(t);
        return;
      }

      // Hop one tile at a time — 3 tiles per second (333ms each)
      const MS_PER_TILE = 333;
      for (let i = 1; i <= steps; i++) {
        const stepPos = (prev + i) % 40;
        const delay = i * MS_PER_TILE;

        const t1 = setTimeout(() => {
          setDisplayPositions(d => ({ ...d, [player.id]: stepPos }));
          setIsMoving(m => ({ ...m, [player.id]: true }));
        }, delay);

        const t2 = setTimeout(() => {
          setIsMoving(m => ({ ...m, [player.id]: false }));
        }, delay + 220); // brief hop lasts 220ms per tile

        hopTimers.current.push(t1, t2);
      }
    });

    return () => {
      hopTimers.current.forEach(t => clearTimeout(t));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posKey]);

  // Named property group → hex colour mapping
  const colorGroupHex: Record<string, string> = {
    'brown': '#8B4513',
    'lightBlue': '#87CEFA',
    'pink': '#FF69B4',
    'orange': '#FF8C00',
    'red': '#EF4444',
    'yellow': '#FFD700',
    'green': '#22C55E',
    'darkBlue': '#1D4ED8'
  };

  // Return hex for any colorGroup value (named key or raw #hex)
  const getColorHex = (colorGroup: string | null | undefined): string | null => {
    if (!colorGroup) return null;
    if (colorGroup.startsWith('#')) return colorGroup;
    return colorGroupHex[colorGroup] || null;
  };

  // Use display position (animated) instead of actual position
  const getPlayersAtPosition = (position: number) =>
    players.filter(p => (displayPositions[p.id] ?? p.position) === position);
  const getPropertyByPosition = (position: number) => properties.find(p => p.position === position);

  const getGridPosition = (position: number) => {
    if (position >= 0 && position <= 10) return { row: 11, col: 11 - position }; // Bottom
    if (position >= 11 && position <= 20) return { row: 11 - (position - 10), col: 1 }; // Left
    if (position >= 21 && position <= 30) return { row: 1, col: position - 19 }; // Top
    if (position >= 31 && position <= 39) return { row: position - 29, col: 11 }; // Right
    return { row: 1, col: 1 };
  };

  // Short map codes: initials for multi-word names, else the first three letters
  const codeOf = (name: string) => {
    const words = name.replace(/[^\p{L}\p{N} ]/gu, '').split(' ').filter(Boolean);
    return (words.length > 1 ? words.map(w => w[0]).join('').slice(0, 3) : name.slice(0, 3)).toUpperCase();
  };
  const kindOf = (p: Property) =>
    p.name === 'GO' ? 'go' : p.name === 'Jail' ? 'jail' : p.name === 'Free Parking' ? 'parking' : p.name === 'Go to Jail' ? 'go-jail'
    : p.name === 'Chance' ? 'chance' : p.name === 'Community Chest' ? 'chest' : p.name.toLowerCase().includes('tax') ? 'tax'
    : p.type === 'railroad' ? 'railroad' : p.type === 'utility' ? 'utility' : 'city';
  const money = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M` : `$${Math.round(n / 1e3)}K`;

  const renderCell = (position: number) => {
    const { row, col } = getGridPosition(position);
    const property = getPropertyByPosition(position);
    if (!property) return <div key={position} className="bg-slate-900 border border-slate-800" style={{ gridRow: row, gridColumn: col }} />;

    const isDiscovered = !blindPickEnabled || (Array.isArray(discoveredProperties) && discoveredProperties.includes(position));
    const playersHere = getPlayersAtPosition(position);
    const ownerPlayer = property.isOwned ? players.find(p => p.name === property.owner) : undefined;
    // top edge stays upright (upside-down names are unreadable on a phone); sides rotate like a real board
    const orientation = position % 10 === 0 ? 'bottom' : row === 11 ? 'bottom' : col === 1 ? 'left' : row === 1 ? 'bottom' : 'right';
    const kind = kindOf(property);
    const buyable = property.type === 'property' || property.type === 'railroad' || property.type === 'utility';

    return (
      <div key={position} className="relative min-w-0 min-h-0" style={{ gridRow: row, gridColumn: col }}>
        <BoardTile
          name={property.name} code={codeOf(property.name)} kind={kind}
          price={buyable ? money(property.currentValue) : undefined}
          groupColor={getColorHex(property.colorGroup) ?? undefined}
          owner={ownerPlayer ? { id: ownerPlayer.id, name: ownerPlayer.name, color: ownerPlayer.color, token: ownerPlayer.pieceIcon } : undefined}
          houses={property.houses} hotel={property.hasHotel} mortgaged={property.isMortgaged} neutral={property.isInactive}
          auction={property.isInAuction}
          monopoly={property.type === 'property' && property.isOwned && !!property.owner && ownsFullGroup(properties, property, property.owner)}
          hidden={!isDiscovered} orientation={orientation as 'bottom' | 'left' | 'top' | 'right'} size="map"
          selected={selectedProperty?.id === property.id}
          onSelect={isDiscovered ? () => onPropertyClick(property) : undefined}
        />
        {playersHere.length > 0 && (
          <div className="absolute inset-0 flex justify-center items-center flex-wrap gap-0.5 p-0.5 z-20 pointer-events-none">
            {playersHere.map((player, idx) => (
              <AnimatedToken key={player.id} player={player} isMoving={isMoving[player.id]} delay={idx * 100} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <BoardFrame label="Game board">
    <div className="p-2 sm:p-3 w-full">
      <div className="relative w-full aspect-square max-w-4xl mx-auto grid grid-cols-11 grid-rows-11 gap-[1px] sm:gap-[2px] bg-slate-950 border-2 sm:border-4 border-slate-900 rounded-sm p-[1px] sm:p-[2px]">
        {properties.length > 0 ? (
          Array.from({ length: 40 }).map((_, i) => renderCell(i))
        ) : (
          <div className="col-span-full row-span-full flex items-center justify-center text-white">
            Loading properties...
          </div>
        )}
        
        {/* Central Space */}
        <div className="bg-slate-950 flex flex-col items-center justify-center p-2 sm:p-4 lg:p-6 shadow-inner border border-slate-800 relative" style={{ gridRow: '2 / 11', gridColumn: '2 / 11' }}>
          {stageOverlay}
          {/* The dice/turn display is ALWAYS rendered; an action stage (children) is layered on top of it. */}
          {(
            <CentralDisplay
               currentEvent={currentEvent}
               currentPlayer={currentPlayer}
               lastDiceRoll={lastDiceRoll}
               isRolling={isRolling}
               onRollDice={onRollDice}
               onEndTurn={onEndTurn}
               canRoll={canRoll}
               canEndTurn={canEndTurn}
               turnState={turnState}
               playerColor={playerColor}
               tradingEnabled={tradingEnabled}
               onTradeClick={onTradeClick}
               isMyTurn={isMyTurn}
               turnTimer={turnTimer}
               turnTimerDuration={turnTimerDuration}
            />
          )}
          {children}
        </div>
      </div>
    </div>
    </BoardFrame>
  );
};

export default MonopolyBoardLayout;