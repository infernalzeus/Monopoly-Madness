import React, { useState } from 'react';
import {
  WorkersSheet, TeamsSheet, PlayerSheet, SelectedTileSummary, formatCurrency,
  type WorkerAssignment, type TeamSummary, type PortfolioProperty, type PlayerIdentityProps
} from '@/ui-kit';
import { computeRent, mortgagePayout, unmortgageCost } from '@/gameEngine/core';
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

/* ───────────────────────── Portfolio ───────────────────────── */
interface PortfolioHostProps {
  gameState: GameState; me: Player; isMyTurn: boolean; onClose: () => void;
  mortgageProperty: (id: string) => void; unmortgageProperty: (id: string) => void;
}
export const PortfolioHost: React.FC<PortfolioHostProps> = ({ gameState, me, isMyTurn, onClose, mortgageProperty, unmortgageProperty }) => {
  const [order, setOrder] = useState<string[]>([]);
  const owned = gameState.properties.filter(p => p.owner === me.name);
  const sorted = [...owned].sort((a, b) => {
    const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.position - b.position;
  });
  const rank = 1 + gameState.players.filter(p => p.isActive && !p.isSpectator && netWorthOf(gameState, p) > netWorthOf(gameState, me)).length;
  const mortgageOn = gameState.settings.mortgageEnabled;

  const properties: PortfolioProperty[] = sorted.map(p => {
    const base = { id: p.id, name: p.name, group: p.colorGroup, value: p.currentValue, isMortgaged: p.isMortgaged, isInactive: p.isInactive, ...rentOf(gameState, p) };
    if (p.isInactive) return base;
    if (!mortgageOn) return { ...base, disabledReason: 'Mortgage is off in this game.' };
    if (p.isMortgaged) {
      const cost = unmortgageCost(p);
      return { ...base, actionLabel: `Unmortgage −${formatCurrency(cost)}`, disabledReason: !isMyTurn ? 'Only on your turn.' : me.balance < cost ? 'Not enough cash.' : undefined };
    }
    return {
      ...base, actionLabel: `Mortgage +${formatCurrency(mortgagePayout(p))}`,
      disabledReason: !isMyTurn ? 'Only on your turn.' : p.houses > 0 || p.hasHotel ? 'Sell the buildings first.' : undefined
    };
  });

  return (
    <PlayerSheet
      player={identity(me, gameState.players.indexOf(me), me)} balance={me.balance} netWorth={netWorthOf(gameState, me)} rank={rank}
      properties={properties} open onClose={onClose}
      onPropertyAction={id => { const p = gameState.properties.find(x => x.id === id); if (p) (p.isMortgaged ? unmortgageProperty : mortgageProperty)(id); }}
      onReorder={setOrder}
    />
  );
};

/* ───────────────────────── Selected tile (phone) ───────────────────────── */
export const TileSummaryStrip: React.FC<{ gameState: GameState; property: Property; onDetails: () => void }> = ({ gameState, property, onDetails }) => (
  <SelectedTileSummary
    name={property.name} price={property.currentValue} ownerName={property.isOwned ? property.owner : undefined}
    isMortgaged={property.isMortgaged} isInactive={property.isInactive} {...rentOf(gameState, property)} onDetails={onDetails}
  />
);
