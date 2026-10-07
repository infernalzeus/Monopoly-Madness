import React, { useState } from 'react';
import { TradeSheet, type TradeDraft, type TradePropertyChoice, type TradePreviewOffer } from '@/ui-kit';
import { hasBuildingsInGroup } from '@/gameEngine/core';
import { serverNow } from '@/lib/clock';
import type { GameState, Player } from '@/types/game';

interface TradeHostProps {
  gameState: GameState;
  me: Player;
  onClose: () => void;
  createTradeOffer: (toPlayer: string, offered: string[], requested: string[], offeredCash: number, requestedCash: number) => void;
  acceptTradeOffer: (offerId: string, acceptorName?: string) => void;
  rejectTradeOffer: (offerId: string) => void;
  cancelTradeOffer: (offerId: string) => void;
}

const EMPTY: TradeDraft = { toPlayer: '', offeredProperties: [], requestedProperties: [], offeredCash: '', requestedCash: '' };

/** Adapter between GameState and the presentation-only TradeSheet. All rules stay in the game hook. */
const TradeHost: React.FC<TradeHostProps> = ({ gameState, me, onClose, createTradeOffer, acceptTradeOffer, rejectTradeOffer, cancelTradeOffer }) => {
  const [draft, setDraft] = useState<TradeDraft>(EMPTY);
  const props = gameState.properties;

  const choicesFor = (ownerName: string): TradePropertyChoice[] =>
    props.filter(p => p.owner === ownerName && !p.isInactive).map(p => ({
      id: p.id, name: p.name,
      lockedReason: p.isInAuction ? 'In an auction right now.' : hasBuildingsInGroup(props, p) ? 'Sell the buildings in this colour group first.' : undefined
    }));

  const recipients = gameState.players.filter(p => p.id !== me.id && p.isActive && !p.isSpectator).map(p => p.name);
  const nameOf = (id: string) => props.find(p => p.id === id)?.name ?? id;

  const offers: TradePreviewOffer[] = gameState.tradeOffers
    .filter(o => o.status === 'pending' && (o.fromPlayer === me.name || o.toPlayer === me.name))
    .map(o => ({
      id: o.id, fromPlayer: o.fromPlayer, toPlayer: o.toPlayer,
      offeredNames: o.offeredProperties.map(nameOf), requestedNames: o.requestedProperties.map(nameOf),
      offeredCash: o.offeredCash, requestedCash: o.requestedCash, expiresAt: o.expiresAt,
      canAccept: o.toPlayer === me.name, canReject: o.toPlayer === me.name, canCancel: o.fromPlayer === me.name
    }));

  const offeredCash = parseInt(draft.offeredCash, 10) || 0;
  const requestedCash = parseInt(draft.requestedCash, 10) || 0;
  const submitDisabledReason =
    !draft.toPlayer ? 'Choose who to trade with.'
    : draft.offeredProperties.length + draft.requestedProperties.length === 0 && offeredCash === 0 && requestedCash === 0 ? 'Add something to the offer.'
    : offeredCash > me.balance ? 'You cannot offer more cash than you have.'
    : undefined;

  return (
    <TradeSheet
      you={me.name} recipients={recipients} draft={draft} onDraftChange={setDraft}
      offeredChoices={choicesFor(me.name)} requestedChoices={draft.toPlayer ? choicesFor(draft.toPlayer) : []}
      offers={offers} now={serverNow()}
      onSubmit={() => {
        if (submitDisabledReason) return;
        createTradeOffer(draft.toPlayer, draft.offeredProperties, draft.requestedProperties, offeredCash, requestedCash);
        setDraft(EMPTY);
      }}
      onAccept={id => acceptTradeOffer(id, me.name)} onReject={rejectTradeOffer} onCancel={cancelTradeOffer}
      submitDisabledReason={submitDisabledReason} open onClose={onClose}
    />
  );
};

export default TradeHost;
