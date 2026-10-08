import { formatCurrency, type PlayerIdentityProps } from '@/ui-kit';
import type { CardAction, PropertyCardProps } from '@/ui-kit/cards';
import {
  buildLevel, canBuildHotelOn, canBuildHouseOn, canSellBuildingOn, computeRent, mortgagePayout, ownsFullGroup, sameTeam, unmortgageCost
} from '@/gameEngine/core';
import type { GameState, Player, Property } from '@/types/game';

export interface CardActions {
  buildHouse: (id: string) => void;
  buildHotel: (id: string) => void;
  sellHouse: (id: string) => void;
  sellHotel: (id: string) => void;
  mortgage: (id: string) => void;
  unmortgage: (id: string) => void;
}

export interface CardCtx {
  state: GameState;
  me: Player;
  isMyTurn: boolean;
  actions: CardActions;
}

export const identityOf = (state: GameState, p: Player, me: Player): PlayerIdentityProps => ({
  name: p.name, color: p.color, icon: p.pieceIcon, marker: state.players.indexOf(p) + 1, isYou: p.id === me.id, isBot: p.isBot,
  isBankrupt: !p.isActive && !p.isSpectator, teamName: state.teams.find(t => t.id === p.teamId)?.name
});

/**
 * Maps one Property to the card kit's props. Every number/label comes from the engine (rent, mortgage,
 * build rules); the kit only draws it. Actions are included only for the local owner, each with a visible reason when blocked.
 */
export function cardProps(ctx: CardCtx, p: Property, size: 'mini' | 'hand' | 'full' = 'hand'): PropertyCardProps {
  const { state, me, isMyTurn, actions } = ctx;
  const supply = !!state.settings.supplyLimits;
  const ownerPlayer = state.players.find(pl => pl.name === p.owner);
  const hasMonopoly = p.type === 'property' && p.isOwned && !!p.owner && ownsFullGroup(state.properties, p, p.owner);
  const group = p.colorGroup ? state.properties.filter(x => x.type === 'property' && x.colorGroup === p.colorGroup) : [];
  const teamBoosted = !!state.settings.teamsEnabled && p.type === 'property' && !hasMonopoly && group.length > 0 &&
    group.every(g => g.isOwned && g.owner && !g.isMortgaged && sameTeam(state.players, g.owner, group[0].owner));

  const rentNow: number | string = p.type === 'utility'
    ? 'Dice roll × $4K (× $10K with both utilities)'
    : computeRent(state.properties, p, 0, state.settings.teamsEnabled ? state.players : undefined);

  const cardActions: CardAction[] = [];
  if (p.owner === me.name && !p.isInactive && state.gamePhase === 'playing') {
    const turnReason = !isMyTurn ? 'Only on your turn.' : undefined;
    const level = buildLevel(p);
    if (p.type === 'property' && !p.isMortgaged) {
      if (!p.hasHotel && p.houses < 4) {
        const cost = (p.houseCost || 0) * (p.houses + 1);
        cardActions.push({
          id: 'build-house', label: `Build house ${formatCurrency(cost)}`, onAction: () => actions.buildHouse(p.id),
          disabledReason: turnReason ?? (!canBuildHouseOn(state.properties, p, me.name, supply) ? 'Needs the whole colour group, an even build and spare houses.' : me.balance < cost ? 'Not enough cash.' : undefined)
        });
      }
      if (!p.hasHotel && p.houses === 4) {
        const cost = p.hotelCost || 0;
        cardActions.push({
          id: 'build-hotel', label: `Build hotel ${formatCurrency(cost)}`, onAction: () => actions.buildHotel(p.id),
          disabledReason: turnReason ?? (!canBuildHotelOn(state.properties, p, me.name, supply) ? 'Every property in the group needs 4 houses first (and a hotel must be available).' : me.balance < cost ? 'Not enough cash.' : undefined)
        });
      }
    }
    if (level > 0) {
      const refund = p.hasHotel ? Math.round((p.hotelCost || 0) * 0.5) : Math.round((p.houseCost || 0) * p.houses * 0.5);
      cardActions.push({
        id: 'sell', label: `Sell ${p.hasHotel ? 'hotel' : 'house'} +${formatCurrency(refund)}`,
        onAction: () => (p.hasHotel ? actions.sellHotel : actions.sellHouse)(p.id),
        disabledReason: turnReason ?? (!canSellBuildingOn(state.properties, p, me.name, supply) ? 'Sell evenly — another property in the group has more buildings.' : undefined)
      });
    } else if (state.settings.mortgageEnabled) {
      if (p.isMortgaged) {
        const cost = unmortgageCost(p);
        cardActions.push({ id: 'unmortgage', label: `Unmortgage −${formatCurrency(cost)}`, onAction: () => actions.unmortgage(p.id), disabledReason: turnReason ?? (me.balance < cost ? 'Not enough cash.' : undefined) });
      } else {
        cardActions.push({ id: 'mortgage', label: `Mortgage +${formatCurrency(mortgagePayout(p))}`, onAction: () => actions.mortgage(p.id), disabledReason: turnReason });
      }
    }
  }

  return {
    property: p, size, rentNow, hasMonopoly, teamBoosted, mortgageAmount: mortgagePayout(p), actions: cardActions,
    owner: ownerPlayer ? identityOf(state, ownerPlayer, me) : undefined,
    hidden: !!state.settings.blindPickEnabled && !(me.discoveredProperties || []).includes(p.position)
  };
}
