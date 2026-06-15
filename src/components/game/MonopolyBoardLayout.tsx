import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Property, Player, GameEvent, DiceRoll, Worker } from '@/types/game';
import { Home, Hotel, Landmark, Building } from 'lucide-react';
import CentralDisplay from './CentralDisplay';


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
      if (steps === 0 || steps > 12) {
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

  const renderCell = (position: number) => {
    const property = getPropertyByPosition(position);
    if (!property) return <div key={position} className="bg-slate-900 border border-slate-800" style={{ gridRow: getGridPosition(position).row, gridColumn: getGridPosition(position).col }} />;

    const isDiscovered = !blindPickEnabled || (Array.isArray(discoveredProperties) && discoveredProperties.includes(position));
    const { row, col } = getGridPosition(position);
    const playersHere = getPlayersAtPosition(position);
    const isCorner = position % 10 === 0;

    if (isCorner) {
      // Jail corner — special two-zone layout
      if (position === 10) {
        const jailedHere = playersHere.filter(p => p.isInJail);
        const visitingHere = playersHere.filter(p => !p.isInJail);
        return (
          <div
            key={position}
            className="bg-slate-900 text-slate-200 border border-slate-800 rounded-sm relative overflow-hidden cursor-pointer hover:bg-slate-800 transition-colors"
            style={{ gridRow: row, gridColumn: col }}
            onClick={() => onPropertyClick(property)}
          >
            {/* Jail zone — top 65% */}
            <div className="absolute top-0 left-0 right-0 flex flex-col items-center justify-center" style={{ height: '65%' }}>
              <Building className="w-3 h-3 sm:w-5 sm:h-5 text-slate-400 flex-shrink-0" />
              <span className="text-[0.32rem] sm:text-[0.45rem] font-bold text-slate-300 uppercase mt-0.5">Jail</span>
              {jailedHere.length > 0 && (
                <div className="flex flex-wrap justify-center gap-0.5 mt-0.5">
                  {jailedHere.map((player, idx) => (
                    <AnimatedToken key={player.id} player={player} isMoving={isMoving[player.id]} delay={idx * 100} />
                  ))}
                </div>
              )}
            </div>
            {/* Just Visiting strip — bottom 35%, light gray shading */}
            <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-center border-t border-slate-600/60" style={{ height: '35%', backgroundColor: 'rgba(148,163,184,0.15)' }}>
              <span className="text-[0.28rem] sm:text-[0.38rem] text-slate-400 uppercase font-semibold leading-tight">Just Visiting</span>
              {visitingHere.length > 0 && (
                <div className="flex flex-wrap justify-center gap-0.5 mt-0.5">
                  {visitingHere.map((player, idx) => (
                    <AnimatedToken key={player.id} player={player} isMoving={isMoving[player.id]} delay={idx * 100} />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      }

      // Other corners — standard render
      let icon = null;
      if (position === 0) icon = <span className="text-lg sm:text-2xl font-black text-emerald-500">GO</span>;
      if (position === 20) icon = <Landmark className="w-4 h-4 sm:w-6 sm:h-6 text-sky-500" />;
      if (position === 30) icon = <Home className="w-4 h-4 sm:w-6 sm:h-6 text-rose-500" />;

      return (
        <div
          key={position}
          className="bg-slate-900 text-slate-200 border border-slate-800 flex flex-col items-center justify-center p-0.5 sm:p-1 shadow-sm rounded-sm relative overflow-hidden cursor-pointer hover:bg-slate-800 transition-colors"
          style={{ gridRow: row, gridColumn: col }}
          onClick={() => onPropertyClick(property)}
        >
          <div className="flex-shrink-0">{icon}</div>
          <span className="text-[0.38rem] sm:text-[0.5rem] font-bold text-center mt-0.5 uppercase leading-tight break-words w-full px-0.5 overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {isDiscovered ? property.name : '?'}
          </span>
          {playersHere.length > 0 && (
            <div className="absolute inset-0 flex justify-center items-center flex-wrap gap-0.5 sm:gap-1 p-0.5 overflow-hidden z-20">
              {playersHere.map((player, idx) => (
                <AnimatedToken key={player.id} player={player} isMoving={isMoving[player.id]} delay={idx * 100} />
              ))}
            </div>
          )}
        </div>
      );
    }

    // Property Render — use hex-based inline styles throughout
    const hexColor = getColorHex(property.colorGroup);
    const isHorizontal = row === 1 || row === 11;
    const colorBarClass = property.colorGroup
      ? (isHorizontal
          ? `h-[25%] w-full absolute ${row === 1 ? 'bottom-0' : 'top-0'}`
          : `w-[25%] h-full absolute ${col === 1 ? 'right-0' : 'left-0'}`)
      : '';

    let padClass = 'p-0.5';
    if (property.colorGroup) {
      if (row === 11) padClass = 'pt-[28%] px-0.5 pb-0.5';
      if (row === 1) padClass = 'pb-[28%] px-0.5 pt-0.5';
      if (col === 1) padClass = 'pr-[28%] py-0.5 pl-0.5';
      if (col === 11) padClass = 'pl-[28%] py-0.5 pr-0.5';
    }

    const isChanceOrCC = property.name === 'Chance' || property.name === 'Community Chest';

    return (
      <Card
        key={position}
        className={`
          cursor-pointer transition-all relative rounded-sm border border-slate-800 flex flex-col bg-slate-900
          ${selectedProperty?.id === property.id ? 'ring-2 ring-inset ring-blue-500 z-10' : 'hover:bg-slate-800'}
          ${isChanceOrCC ? 'bg-gradient-to-b from-slate-900 to-yellow-950/20' : ''}
        `}
        style={{ gridRow: row, gridColumn: col }}
        onClick={() => isDiscovered && onPropertyClick(property)}
      >
        {/* Colour bar — always use inline style so custom hex colours work */}
        {isDiscovered && hexColor && (
          <div className={`${colorBarClass} z-0`} style={{ backgroundColor: hexColor }} />
        )}

        {/* Chance / Community Chest ? icon */}
        {isDiscovered && isChanceOrCC && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[5]">
            <span className="font-black text-yellow-400/70 select-none" style={{ fontSize: 'clamp(0.5rem, 1.5vw, 1rem)', lineHeight: 1 }}>?</span>
          </div>
        )}

        <div className={`flex flex-col justify-between h-full w-full z-10 relative ${isDiscovered ? padClass : 'p-0.5'}`}>
          {/* Property name */}
          <div className="flex items-center justify-center w-full overflow-hidden flex-1 min-h-0">
            <p className="text-[0.34rem] sm:text-[0.48rem] font-bold text-slate-200 leading-[1.15] text-center uppercase break-words w-full line-clamp-3 overflow-hidden">
              {isDiscovered ? property.name : '???'}
            </p>
          </div>

          {isDiscovered && (
            <div className="flex flex-col items-center">
              {property.type === 'property' && (property.houses > 0 || property.hasHotel) && (
                <div className="flex gap-px mb-0.5">
                  {property.hasHotel ? (
                    <Hotel className="w-2 h-2 sm:w-3 sm:h-3 text-red-500" />
                  ) : (
                    Array.from({ length: property.houses }).map((_, idx) => (
                      <Home key={idx} className="w-1.5 h-1.5 sm:w-2 sm:h-2 text-green-500" />
                    ))
                  )}
                </div>
              )}
              {!isChanceOrCC && (
                <span className="text-[0.38rem] sm:text-[0.52rem] font-bold text-slate-400 tracking-tight">
                  ${(property.baseValue / 1000)}K
                </span>
              )}
            </div>
          )}

          {/* Player Tokens — z-20 so they sit above cell content but below fixed overlays */}
          {playersHere.length > 0 && (
            <div className="absolute inset-0 flex justify-center items-center flex-wrap gap-0.5 pointer-events-none p-0.5 z-20">
              {playersHere.map((player, idx) => (
                <AnimatedToken key={player.id} player={player} isMoving={isMoving[player.id]} delay={idx * 100} />
              ))}
            </div>
          )}
        </div>

        {/* Ownership / auction dot — direct child of Card (relative) so padding changes don't affect its size */}
        {isDiscovered && (property.isOwned || property.isInAuction) && (
          <div className="absolute top-0.5 right-0.5 z-[15] flex gap-0.5 pointer-events-none">
            {property.isOwned && (
              <div
                className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full border border-white/50 shadow-md flex-shrink-0"
                style={{ backgroundColor: players.find(p => p.name === property.owner)?.color || '#999' }}
              />
            )}
            {property.isInAuction && <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-yellow-400 rounded-full animate-pulse flex-shrink-0" />}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="bg-slate-800 p-2 sm:p-4 rounded-xl shadow-xl w-full">
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
          {children || (
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
        </div>
      </div>
    </div>
  );
};

export default MonopolyBoardLayout;