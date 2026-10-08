import React, { useState } from 'react';
import {
  WorkersSheet, TeamsSheet, SelectedTileSummary,
  type WorkerAssignment, type TeamSummary, type PlayerIdentityProps
} from '@/ui-kit';
import { computeRent } from '@/gameEngine/core';
import { CardRail, JailCard } from '@/ui-kit/cards';
import { SheetShell, Fact, CurrencyAmount, PlayerIdentity } from '@/ui-kit';
import { cardProps, identityOf, type CardCtx } from './cardAdapters';
import type { GameState, Player, Property } from '@/types/game';

const identity = (p: Player, index: number, me: Player): PlayerIdentityProps => ({
  name: p.name, color: p.color, icon: p.pieceIcon, marker: index + 1, isYou: p.id === me.id, isBot: p.isBot, isBankrupt: !p.isActive && !p.isSpectator
});

const netWorthOf = (state: GameState, p: Player) =>
  p.balance + state.properties.filter(pr => pr.owner === p.name && !pr.isInactive).reduce((a, pr) => a + pr.currentValue, 0);

/** Rent a visitor would pay right now (engine rules incl. team monopolies) */
const rentOf = (state: GameState, property: Property): { rent?: number; rentLabel?: string } => {
  if (property.isInactive || property.isMortgaged) return {};
  if (property.type === 'utility') return { rentLabel: 'Dice roll × $4K (×10K with both utilities)' };
  if (property.type === 'special') return {};
  return { rent: computeRent(state.properties, property, 0, state.settings.teamsEnabled ? state.players : undefined) };
};

/* ───────────────────────── Workers ───────────────────────── */
interface WorkersHostProps {
  gameState: GameState; me: Player; isMyTurn: boolean; onClose: () => void;
  assignWorker: (propertyId: string, color: string) => void;
  removeWorker: (propertyId: string) => void;
  updateWorkerColor: (propertyId: string, color: string) => void;
}
export const WorkersHost: React.FC<WorkersHostProps> = ({ gameState, me, isMyTurn, onClose, assignWorker, removeWorker, updateWorkerColor }) => {
  const [colors, setColors] = useState<Record<string, string>>({});
  const canAssign = isMyTurn && gameState.turnState === 'waiting_for_roll';
  const assignments: WorkerAssignment[] = gameState.properties
    .filter(p => p.owner === me.name && p.type === 'property' && !p.isInactive)
    .map(p => {
      const worker = (gameState.workers || []).find(w => w.propertyId === p.id);
      return {
        propertyId: p.id, propertyName: p.name, assigned: !!worker, color: worker?.color ?? colors[p.id] ?? '#FFE5B4',
        disabledReason: !worker && !canAssign ? 'Assign workers on your own turn, before you roll.' : undefined
      };
    });
  return (
    <WorkersSheet
      assignments={assignments} open onClose={onClose}
      onAssign={id => assignWorker(id, colors[id] ?? '#FFE5B4')}
      onRemove={removeWorker}
      onColorChange={(id, color) => {
        setColors(c => ({ ...c, [id]: color }));
        if ((gameState.workers || []).some(w => w.propertyId === id)) updateWorkerColor(id, color);
      }}
    />
  );
};

/* ───────────────────────── Teams ───────────────────────── */
interface TeamsHostProps {
  gameState: GameState; me: Player; onClose: () => void;
  joinTeam: (teamId: string) => void; createTeam: (name: string) => void;
}
export const TeamsHost: React.FC<TeamsHostProps> = ({ gameState, me, onClose, joinTeam, createTeam }) => {
  const locked = gameState.turn >= gameState.players.length;
  const teams: TeamSummary[] = gameState.teams.map(t => {
    const members = gameState.players.filter(p => t.members.includes(p.id));
    const full = t.members.length >= 4;
    return {
      id: t.id, name: t.name, members: members.map(p => identity(p, gameState.players.indexOf(p), me)),
      combinedCash: members.reduce((s, p) => s + p.balance, 0),
      canJoin: !locked && !full && me.teamId !== t.id && me.isActive,
      disabledReason: locked ? 'Alliances are locked after the first round.' : full ? 'This team is full (4 players).' : undefined
    };
  });
  return (
    <TeamsSheet
      teams={teams} yourTeamId={me.teamId} open onClose={onClose}
      onJoin={joinTeam}
      onCreate={locked ? undefined : () => {
        const name = window.prompt('Name your team (max 24 characters):', 'Team');
        if (name && name.trim()) createTeam(name.trim());
      }}
    />
  );
};

/* ───────────────────────── Portfolio (property cards) ───────────────────────── */
/** The player's properties as inspectable cards (rail on phones, fan on desktop). Presentation order is local UI state. */
export const PortfolioCards: React.FC<{ ctx: CardCtx; spendJailCard?: () => void }> = ({ ctx, spendJailCard }) => {
  const [order, setOrder] = useState<string[]>([]);
  const { state, me } = ctx;
  const owned = state.properties.filter(p => p.owner === me.name);
  const sorted = [...owned].sort((a, b) => {
    const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.position - b.position;
  });
  return (
    <>
      {(me.jailCards || 0) > 0 && <JailCard count={me.jailCards || 0} onUse={me.isInJail && ctx.isMyTurn ? spendJailCard : undefined} />}
      {sorted.length === 0
        ? <p className="mma-ui mma-muted">You don't own any properties yet — land on one and buy it, or win one at auction.</p>
        : <CardRail cards={sorted.map(p => cardProps(ctx, p, 'hand'))} onReorder={setOrder} label="Your property cards" />}
    </>
  );
};

interface PortfolioHostProps { ctx: CardCtx; onClose: () => void; spendJailCard?: () => void }
export const PortfolioHost: React.FC<PortfolioHostProps> = ({ ctx, onClose, spendJailCard }) => {
  const { state, me } = ctx;
  const worth = (p: Player) => netWorthOf(state, p);
  const rank = 1 + state.players.filter(p => p.isActive && !p.isSpectator && worth(p) > worth(me)).length;
  return (
    <SheetShell title="Your portfolio" open onClose={onClose}>
      <PlayerIdentity {...identityOf(state, me, me)} />
      <div className="mma-facts">
        <Fact label="Cash"><CurrencyAmount amount={me.balance} /></Fact>
        <Fact label="Net worth"><CurrencyAmount amount={worth(me)} /></Fact>
        <Fact label="Rank">#{rank}</Fact>
      </div>
      <PortfolioCards ctx={ctx} spendJailCard={spendJailCard} />
    </SheetShell>
  );
};

/* ───────────────────────── Selected tile (phone) ───────────────────────── */
export const TileSummaryStrip: React.FC<{ gameState: GameState; property: Property; onDetails: () => void }> = ({ gameState, property, onDetails }) => (
  <SelectedTileSummary
    name={property.name} price={property.currentValue} ownerName={property.isOwned ? property.owner : undefined}
    isMortgaged={property.isMortgaged} isInactive={property.isInactive} {...rentOf(gameState, property)} onDetails={onDetails}
  />
);
