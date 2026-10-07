import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { X, DollarSign, Home, TrendingUp, TrendingDown } from 'lucide-react';
import { GameEvent } from '@/types/game';
import { formatSignedMoney } from '@/lib/utils';

interface TransactionNotificationProps {
  events: GameEvent[];
  onDismiss: (eventId: string) => void;
}

const TransactionNotification: React.FC<TransactionNotificationProps> = ({
  events,
  onDismiss
}) => {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const timerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Auto-dismiss events after 3 seconds
  useEffect(() => {
    const now = Date.now();
    events.forEach(event => {
      if (timerRef.current.has(event.id)) return;
      const remaining = 3000 - (now - event.timestamp);
      if (remaining <= 0) {
        setDismissedIds(prev => new Set([...prev, event.id]));
        return;
      }
      const t = setTimeout(() => {
        setDismissedIds(prev => new Set([...prev, event.id]));
        timerRef.current.delete(event.id);
      }, remaining);
      timerRef.current.set(event.id, t);
    });

    return () => {
      // Cancel active timers but keep the map intact so we don't re-schedule on next render
      timerRef.current.forEach((t, id) => {
        clearTimeout(t);
        timerRef.current.delete(id);
      });
    };
  }, [events]);

  const handleDismiss = (eventId: string) => {
    setDismissedIds(prev => new Set([...prev, eventId]));
    const t = timerRef.current.get(eventId);
    if (t) { clearTimeout(t); timerRef.current.delete(eventId); }
    onDismiss(eventId);
  };

  const visibleEvents = events
    .filter(event =>
      ['purchase', 'rent', 'trade', 'build', 'mortgage'].includes(event.type) &&
      !dismissedIds.has(event.id)
    )
    .slice(-3);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'purchase': return <Home className="w-4 h-4 text-green-400 flex-shrink-0" />;
      case 'rent': return <DollarSign className="w-4 h-4 text-red-400 flex-shrink-0" />;
      case 'trade': return <TrendingUp className="w-4 h-4 text-blue-400 flex-shrink-0" />;
      case 'build': return <Home className="w-4 h-4 text-purple-400 flex-shrink-0" />;
      case 'mortgage': return <TrendingDown className="w-4 h-4 text-orange-400 flex-shrink-0" />;
      default: return <DollarSign className="w-4 h-4 text-gray-400 flex-shrink-0" />;
    }
  };

  const getEventBg = (type: string) => {
    switch (type) {
      case 'purchase': return 'bg-green-950 border-green-700/60 text-green-100';
      case 'rent': return 'bg-red-950 border-red-700/60 text-red-100';
      case 'trade': return 'bg-blue-950 border-blue-700/60 text-blue-100';
      case 'build': return 'bg-purple-950 border-purple-700/60 text-purple-100';
      case 'mortgage': return 'bg-orange-950 border-orange-700/60 text-orange-100';
      default: return 'bg-slate-800 border-slate-600 text-slate-100';
    }
  };

  if (visibleEvents.length === 0) return null;

  return (
    <div className="fixed top-16 right-3 z-[60] space-y-2 max-w-xs pointer-events-auto">
      {visibleEvents.map((event) => (
        <Card
          key={event.id}
          className={`${getEventBg(event.type)} border shadow-xl animate-in slide-in-from-right duration-300`}
        >
          <CardContent className="p-2.5">
            <div className="flex items-start gap-2">
              {getEventIcon(event.type)}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold truncate">{event.player}</div>
                <div className="text-[0.7rem] opacity-80 leading-tight">{event.message}</div>
                {event.amount !== undefined && (
                  <div className={`text-xs font-bold mt-0.5 ${event.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatSignedMoney(event.amount)}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleDismiss(event.id)}
                className="flex-shrink-0 w-5 h-5 rounded hover:bg-white/20 flex items-center justify-center transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default TransactionNotification;
