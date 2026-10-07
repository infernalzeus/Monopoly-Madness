import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText, DollarSign, Home, Gavel, Handshake,
  Building, CreditCard, AlertCircle, Dice1, Dice2
} from 'lucide-react';
import { GameEvent, Player } from '@/types/game';
import { formatSignedMoney } from '@/lib/utils';

interface GameLogProps {
  events: GameEvent[];
  players?: Player[];
}

const getEventIcon = (type: GameEvent['type']) => {
  switch (type) {
    case 'move': return <Dice1 className="w-3.5 h-3.5" />;
    case 'purchase': return <Home className="w-3.5 h-3.5" />;
    case 'rent': return <CreditCard className="w-3.5 h-3.5" />;
    case 'auction': return <Gavel className="w-3.5 h-3.5" />;
    case 'jail': return <AlertCircle className="w-3.5 h-3.5" />;
    case 'passGo': return <Dice2 className="w-3.5 h-3.5" />;
    case 'trade': return <Handshake className="w-3.5 h-3.5" />;
    case 'build': return <Building className="w-3.5 h-3.5" />;
    case 'bankrupt': return <AlertCircle className="w-3.5 h-3.5" />;
    case 'card': return <FileText className="w-3.5 h-3.5" />;
    case 'mortgage': return <DollarSign className="w-3.5 h-3.5" />;
    default: return <FileText className="w-3.5 h-3.5" />;
  }
};

const typeColor: Record<string, string> = {
  move: 'text-blue-400', purchase: 'text-green-400', rent: 'text-rose-400',
  auction: 'text-yellow-400', jail: 'text-rose-300', passGo: 'text-emerald-400',
  trade: 'text-purple-400', build: 'text-orange-400', bankrupt: 'text-red-500',
  card: 'text-indigo-400', mortgage: 'text-slate-400', tax: 'text-amber-400',
  pay: 'text-slate-400'
};

const GameLog: React.FC<GameLogProps> = ({ events, players = [] }) => {
  const getPlayer = (name: string) => players.find(p => p.name === name);

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString('en-US', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  const formatAmount = (amount?: number) => {
    if (amount === undefined) return '';
    return formatSignedMoney(amount);
  };

  return (
    <Card className="bg-gradient-to-br from-gray-800 to-gray-700 border-gray-600 h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-white text-base">
          <FileText className="w-4 h-4 text-gray-400" />
          Game Log
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-96 px-4">
          <div className="space-y-1.5 pb-3">
            {events.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No events yet</p>
              </div>
            ) : (
              events.slice().reverse().map((event, index) => {
                const player = getPlayer(event.player);
                const color = typeColor[event.type] || 'text-gray-400';
                return (
                  <div
                    key={`${event.id}-${index}`}
                    className="flex items-start gap-2.5 p-2.5 rounded-lg bg-gray-700/40 border border-gray-600/40 hover:bg-gray-700/60 transition-colors"
                  >
                    <div className={`flex-shrink-0 mt-0.5 ${color}`}>
                      {getEventIcon(event.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <Badge
                          variant="outline"
                          className={`text-[0.6rem] px-1 py-0 ${color} border-current bg-gray-800/80`}
                        >
                          {event.type.toUpperCase()}
                        </Badge>
                        <span className="text-[0.6rem] text-gray-500">{formatTime(event.timestamp)}</span>
                      </div>

                      {/* Player name with token */}
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {player && (
                          <span
                            className="text-sm leading-none"
                            dangerouslySetInnerHTML={{ __html: player.pieceIcon }}
                          />
                        )}
                        <span
                          className="text-sm font-semibold"
                          style={{ color: player?.color || '#e2e8f0' }}
                        >
                          {event.player}
                        </span>
                      </div>

                      <p className="text-xs text-gray-300 leading-relaxed">{event.message}</p>

                      {event.amount !== undefined && (
                        <div className={`text-xs font-bold mt-0.5 ${event.amount >= 0 ? 'text-green-400' : 'text-rose-400'}`}>
                          {formatAmount(event.amount)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default GameLog;
