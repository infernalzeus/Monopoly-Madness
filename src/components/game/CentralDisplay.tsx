import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dice1,
  Dice2,
  User,
  Home,
  CreditCard,
  Gavel,
  AlertCircle,
  Handshake,
  Building,
  FileText,
  DollarSign
} from 'lucide-react';
import { GameEvent, DiceRoll } from '@/types/game';
import { formatSignedMoney, readableTextOn } from '@/lib/utils';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

interface CentralDisplayProps {
  currentEvent: GameEvent | null;
  currentPlayer: string;
  lastDiceRoll: DiceRoll | null;
  isRolling: boolean;
  onRollDice: () => void;
  onEndTurn?: () => void;
  canRoll: boolean;
  canEndTurn?: boolean;
  turnState?: string;
  playerColor: string;
  tradingEnabled?: boolean;
  onTradeClick?: () => void;
  isMyTurn?: boolean;
  turnTimer?: number | null;
  turnTimerDuration?: number;
}

// Dot positions for each die face (1-6)
const dieDots: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};

const DieFace: React.FC<{ value: number; isRolling: boolean; animDelay?: number }> = ({ value, isRolling, animDelay = 0 }) => {
  const dots = dieDots[value] ?? dieDots[1];
  return (
    <div
      className={`w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-lg border-2 border-gray-300 shadow-md relative flex-shrink-0 select-none
        ${isRolling ? 'animate-spin' : 'transition-all duration-200'}`}
      style={{ animationDuration: '0.15s', animationDelay: `${animDelay}ms` }}
    >
      {dots.map(([x, y], i) => (
        <div
          key={i}
          className="absolute w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-slate-800"
          style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
        />
      ))}
    </div>
  );
};

const CentralDisplay: React.FC<CentralDisplayProps> = ({
  currentEvent,
  currentPlayer,
  lastDiceRoll,
  isRolling,
  onRollDice,
  onEndTurn,
  canRoll,
  canEndTurn,
  turnState,
  playerColor,
  tradingEnabled = false,
  onTradeClick,
  isMyTurn = false,
  turnTimer = null,
  turnTimerDuration = 0
}) => {
  const [displayText, setDisplayText] = useState<string>('');
  const [isAnimating, setIsAnimating] = useState(false);
  // Animated dice values while rolling
  const [animDice, setAnimDice] = useState<[number, number]>([1, 1]);
  const rollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  // Cycle dice faces rapidly while rolling
  useEffect(() => {
    if (isRolling && !reducedMotion) {
      rollInterval.current = setInterval(() => {
        setAnimDice([
          Math.ceil(Math.random() * 6),
          Math.ceil(Math.random() * 6),
        ]);
      }, 80);
    } else {
      if (rollInterval.current) {
        clearInterval(rollInterval.current);
        rollInterval.current = null;
      }
      // Snap to actual result
      if (lastDiceRoll) setAnimDice([lastDiceRoll.dice1, lastDiceRoll.dice2]);
    }
    return () => {
      if (rollInterval.current) clearInterval(rollInterval.current);
    };
  }, [isRolling, lastDiceRoll, reducedMotion]);

  const getEventIcon = (type: GameEvent['type']) => {
    switch (type) {
      case 'move':        return <Dice1 className="w-6 h-6" />;
      case 'purchase':   return <Home className="w-6 h-6" />;
      case 'rent':       return <CreditCard className="w-6 h-6" />;
      case 'auction':    return <Gavel className="w-6 h-6" />;
      case 'jail':       return <AlertCircle className="w-6 h-6" />;
      case 'passGo':     return <Dice2 className="w-6 h-6" />;
      case 'trade':      return <Handshake className="w-6 h-6" />;
      case 'build':      return <Building className="w-6 h-6" />;
      case 'bankrupt':   return <AlertCircle className="w-6 h-6" />;
      case 'card':       return <FileText className="w-6 h-6" />;
      case 'mortgage':   return <DollarSign className="w-6 h-6" />;
      default:           return <FileText className="w-6 h-6" />;
    }
  };

  const getEventColor = (type: GameEvent['type']) => {
    switch (type) {
      case 'move':      return 'text-blue-400';
      case 'purchase':  return 'text-green-400';
      case 'rent':      return 'text-red-400';
      case 'auction':   return 'text-yellow-400';
      case 'jail':      return 'text-red-400';
      case 'passGo':    return 'text-green-400';
      case 'trade':     return 'text-purple-400';
      case 'build':     return 'text-orange-400';
      case 'bankrupt':  return 'text-red-500';
      case 'card':      return 'text-indigo-400';
      case 'mortgage':  return 'text-gray-400';
      default:          return 'text-gray-400';
    }
  };

  const formatAmount = (amount?: number) => {
    if (amount === undefined) return '';
    return formatSignedMoney(amount);
  };

  useEffect(() => {
    if (currentEvent) {
      setIsAnimating(true);
      setDisplayText(currentEvent.message);
      const timer = setTimeout(() => setIsAnimating(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [currentEvent]);

  useEffect(() => {
    if (isRolling) {
      setIsAnimating(true);
      setDisplayText(`${currentPlayer} is rolling...`);
    }
  }, [isRolling, currentPlayer]);

  // Show dice whenever we have a roll OR are rolling
  const showDice = isRolling || !!lastDiceRoll;
  const d1 = isRolling ? animDice[0] : (lastDiceRoll?.dice1 ?? 1);
  const d2 = isRolling ? animDice[1] : (lastDiceRoll?.dice2 ?? 1);

  return (
    <Card className="bg-gradient-to-br from-gray-800 to-gray-700 border-2 border-gray-600 shadow-2xl h-full">
      <CardContent className="p-3 h-full flex flex-col items-center justify-center gap-2">
        {/* Current Player Badge */}
        <Badge
          className="text-xs sm:text-sm px-3 py-1 text-white border-2 flex items-center gap-1"
          style={{ backgroundColor: playerColor, borderColor: playerColor, color: readableTextOn(playerColor) }}
        >
          <User className="w-3 h-3" />
          {isMyTurn ? 'Your Turn' : `${currentPlayer}'s Turn`}
        </Badge>

        {/* Dice display — always visible once a roll happened or rolling */}
        {showDice && (
          <div className="flex items-center gap-2">
            <DieFace value={d1} isRolling={isRolling} animDelay={0} />
            <DieFace value={d2} isRolling={isRolling} animDelay={30} />
            {!isRolling && lastDiceRoll && (
              <span className="text-base sm:text-lg font-black text-white ml-1">
                = {lastDiceRoll.total}
                {lastDiceRoll.isDouble && <span className="text-yellow-400 text-xs ml-1">DBL!</span>}
              </span>
            )}
          </div>
        )}

        {/* Roll button / turn state */}
        <div className="flex flex-col items-center gap-2 w-full">
          {turnState === 'completed' ? (
            <div className="text-emerald-400 text-xs font-bold animate-pulse flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Auto Advancing...
            </div>
          ) : (
            <>
              <button
                onClick={onRollDice}
                disabled={!canRoll || isRolling}
                className={`
                  px-6 py-2.5 rounded-full font-black text-xs sm:text-sm uppercase tracking-widest transition-all duration-200 transform
                  ${canRoll && !isRolling
                    ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] hover:scale-105 active:scale-95'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                  }
                  ${isRolling ? 'animate-pulse' : ''}
                `}
              >
                {isRolling ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin inline-block w-3 h-3 border-2 border-black border-t-transparent rounded-full" />
                    Rolling...
                  </span>
                ) : '🎲 Roll Dice'}
              </button>

              {turnTimer !== null && turnTimerDuration > 0 && (
                <Badge variant="outline" className={`text-base px-3 py-0.5 font-mono border-2 transition-colors ${turnTimer <= 10 ? 'border-red-500 text-red-400 animate-pulse' : 'border-cyan-500/50 text-cyan-400'}`}>
                  ⏳ {turnTimer}s
                </Badge>
              )}
            </>
          )}
        </div>

        {/* Trade button */}
        {tradingEnabled && isMyTurn && !isRolling && (
          <button
            onClick={onTradeClick}
            className="px-4 py-1.5 rounded-lg font-bold text-xs bg-purple-600 hover:bg-purple-700 text-white shadow-lg transition-all active:scale-95 flex items-center gap-1"
          >
            <Handshake className="w-3 h-3" />
            Trade
          </button>
        )}

        {/* Current event */}
        <div className="text-center min-h-[40px] flex items-center justify-center w-full">
          {currentEvent ? (
            <div className={`transition-all duration-300 ${isAnimating ? 'scale-105 opacity-100' : 'scale-100 opacity-80'} w-full`}>
              <div className={`flex items-center justify-center gap-1 mb-0.5 ${getEventColor(currentEvent.type)}`}>
                {getEventIcon(currentEvent.type)}
              </div>
              <div className="text-[0.65rem] text-gray-300 leading-snug">{displayText}</div>
              {currentEvent.amount !== undefined && (
                <div className={`text-xs font-bold ${currentEvent.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatAmount(currentEvent.amount)}
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500 text-xs">
              {isRolling ? 'Rolling dice...' : 'Waiting for action...'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CentralDisplay;
