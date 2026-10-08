import React from 'react';
import { Home, Users, ScrollText, Handshake, UsersRound } from 'lucide-react';
import { formatSignedMoney } from '@/lib/utils';
import type { GameEvent, GameState, Player } from '@/types/game';

const compact = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n}`;

export const netWorthOf = (state: GameState, p: Player) =>
  p.balance + state.properties.filter(pr => pr.owner === p.name && !pr.isInactive).reduce((a, pr) => a + pr.currentValue, 0);

/** Compact standings: one row per player (replaces the old full-width "Players Overview" table). */
export const PlayersList: React.FC<{ state: GameState; me: Player }> = ({ state, me }) => {
  const rows = [...state.players]
    .filter(p => !p.isSpectator)
    .map(p => ({ p, worth: netWorthOf(state, p), props: state.properties.filter(x => x.owner === p.name && !x.isInactive) }))
    .sort((a, b) => Number(b.p.isActive) - Number(a.p.isActive) || b.worth - a.worth);
  return (
    <ol className="space-y-1.5">
      {rows.map(({ p, worth, props }, i) => {
        const turn = state.currentPlayer === p.id;
        return (
          <li key={p.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm ${turn ? 'border-sky-500/60 bg-sky-950/30' : 'border-slate-700 bg-slate-900/60'} ${!p.isActive ? 'opacity-50' : ''}`}>
            <span className="w-4 text-slate-400 font-mono text-xs">{i + 1}</span>
            <span className="w-1.5 self-stretch rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
            <span className="text-lg leading-none">{p.pieceIcon}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-slate-100">
                {p.name}{p.id === me.id ? ' (you)' : ''}
                {turn && <span className="ml-1.5 text-[0.65rem] uppercase text-sky-300">turn</span>}
                {p.isInJail && <span className="ml-1.5 text-[0.65rem] uppercase text-rose-300">jail</span>}
                {!p.isActive && <span className="ml-1.5 text-[0.65rem] uppercase text-slate-400">out</span>}
              </div>
              <div className="text-xs text-slate-400">{props.length} propert{props.length === 1 ? 'y' : 'ies'}</div>
            </div>
            <div className="text-right font-mono text-xs leading-tight">
              <div className="text-emerald-300 font-bold">{compact(p.balance)}</div>
              <div className="text-cyan-300">{compact(worth)}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
};

/** Inline game log (newest first). */
export const InlineLog: React.FC<{ events: GameEvent[] }> = ({ events }) => (
  <ol className="space-y-1">
    {[...events].reverse().map(e => (
      <li key={e.id} className="rounded-md bg-slate-900/60 border border-slate-800 px-2.5 py-1.5 text-xs">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold text-slate-200 truncate">{e.player}</span>
          <span className="text-slate-500 font-mono shrink-0">{new Date(e.timestamp).toLocaleTimeString('en-US', { hour12: false })}</span>
        </div>
        <div className="text-slate-300">{e.message}</div>
        {e.amount !== undefined && (
          <div className={`font-mono font-bold ${e.amount < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{formatSignedMoney(e.amount)}</div>
        )}
      </li>
    ))}
    {events.length === 0 && <li className="text-slate-500 text-sm">Nothing has happened yet.</li>}
  </ol>
);

export type NavId = 'properties' | 'players' | 'log' | 'trade' | 'teams';
const navIcons: Record<NavId, React.ReactNode> = {
  properties: <Home className="w-5 h-5" aria-hidden />, players: <Users className="w-5 h-5" aria-hidden />,
  log: <ScrollText className="w-5 h-5" aria-hidden />, trade: <Handshake className="w-5 h-5" aria-hidden />, teams: <UsersRound className="w-5 h-5" aria-hidden />
};

/** Phone bottom navigation: always-visible, labelled buttons that open the sheets. */
export const BottomNav: React.FC<{
  items: { id: NavId; label: string; badge?: number; active?: boolean; onClick: () => void }[];
}> = ({ items }) => (
  <nav aria-label="Game panels" className="lg:hidden shrink-0 grid gap-1.5 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
    {items.map(it => (
      <button
        key={it.id} onClick={it.onClick} aria-pressed={it.active}
        className={`relative min-h-[52px] rounded-xl border flex flex-col items-center justify-center gap-0.5 text-[0.72rem] font-semibold transition-colors ${it.active ? 'bg-cyan-500 text-slate-950 border-cyan-300' : 'bg-slate-800 text-slate-100 border-slate-600 active:bg-slate-700'}`}
      >
        {navIcons[it.id]}
        <span>{it.label}</span>
        {!!it.badge && <span className="absolute -top-1.5 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[0.65rem] font-bold flex items-center justify-center">{it.badge}</span>}
      </button>
    ))}
  </nav>
);
